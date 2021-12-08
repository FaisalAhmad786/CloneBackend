import {Request, Response, NextFunction} from "express";
import {Connection} from "mongoose";
import ErrorHandler from "../../errorHandling/errorHandler";
import connectToDB from "../../database/connectToDB";
import {ITicket} from "../../models/ITicket";
import createResource from "../../shared/createResource";
import {Ticket} from "../../models/classes/Ticket";
import TicketSchema from "../../models/TicketSchema";
import sendResponse from "../../shared/sendResponse";
import {IBus} from "../../models/IBus";
import viewWithFilter from "../../shared/viewWithFilter";
import BusSchema from "../../models/BusSchema";
import updateResource from "../../shared/updateResource";

export async function postTicket(req: Request, res: Response, next: NextFunction) {
    let dbConnection!: Connection;
    try {
        dbConnection = connectToDB(process.env.CONNECTION_STRING!, next);
        const {userId, busId, seatNumbers, dateOfJourney, timeOfJourney, to, from, isTicketCancelled} = req.body;
        const ticketFromUI: ITicket = new Ticket(busId, dateOfJourney, seatNumbers, timeOfJourney, userId, from, to, isTicketCancelled);
        const buses: IBus[] = await viewWithFilter<IBus>(dbConnection, 'Bus', BusSchema, {
            _id: busId
        });
        if (buses.length == 0) {
            next(new ErrorHandler(404, `No Resource found with id = ${busId}`));
            return;
        }
        const expectedSeatsToBeBooked: string[] = ticketFromUI.seatNumbers;
        const alreadyBookedSeats: string[] = buses[0].alreadyBookedSeats;
        let seatFound: boolean = false;
        for (let expectedSeat of expectedSeatsToBeBooked) {
            for (let seat of alreadyBookedSeats) {
                if (expectedSeat === seat) {
                    seatFound = true;
                    break;
                }
            }
            if (seatFound) {
                break;
            }
        }
        if (!seatFound) {
            const updatedBookedSeats: string[] = [...expectedSeatsToBeBooked, ...alreadyBookedSeats];
            const remainingSeats: number = buses[0].remainingSeats;
            if (remainingSeats >= ticketFromUI.seatNumbers.length) {
                dbConnection = connectToDB(process.env.CONNECTION_STRING!, next);
                await updateResource<IBus>(dbConnection, 'Bus', BusSchema, busId, {
                    remainingSeats: remainingSeats - ticketFromUI.seatNumbers.length,
                    alreadyBookedSeats: updatedBookedSeats
                });
                try {
                    dbConnection = connectToDB(process.env.CONNECTION_STRING!, next);
                    const createdTicket: ITicket = await createResource<ITicket>(dbConnection, 'Ticket', TicketSchema, ticketFromUI);
                    sendResponse(res, 201, createdTicket);
                } catch (err: any) {
                    dbConnection = connectToDB(process.env.CONNECTION_STRING!, next);
                    await updateResource<IBus>(dbConnection, 'Bus', BusSchema, busId, {
                        remainingSeats: remainingSeats,
                        alreadyBookedSeats
                    });
                    next(new ErrorHandler(500, `It seems that we are having some trouble booking the tickets.\n Do not worry we are on it`));
                    return;
                }
            } else {
                next(new ErrorHandler(406, `Seats are not available.`));
            }
        } else {
            next(new ErrorHandler(406, `One or more seats are already booked`));
        }

    } catch (err: any) {
        if (err instanceof ErrorHandler) {
            next(err);
            return;
        }
        next(new ErrorHandler(500, err.message));
    } finally {
        await dbConnection.close();
    }
}
