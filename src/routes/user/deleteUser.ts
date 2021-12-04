import {NextFunction, Request, Response} from "express";
import {Connection} from "mongoose";
import ErrorHandler from "../../errorHandling/errorHandler";
import connectToDB from "../../database/connectToDB";
import {IUser} from "../../models/IUser";
import deleteResource from "../../shared/deleteResource";
import UserSchema from "../../models/UserSchema";
import sendResponse from "../../shared/sendResponse";

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
    let dbConnection!: Connection;
    try {
        let id = req.params.id;
        dbConnection = connectToDB(process.env.CONNECTION_STRING!);
        const deletedUser: IUser | null = await deleteResource(dbConnection, 'User', UserSchema, id);
        if (!deletedUser) {
            next(new ErrorHandler(404, `No Resource found with id = ${id}`));
            return;
        }
        sendResponse(res, 200, deletedUser);
    } catch (err: any) {
        next(new ErrorHandler(500, err.message));
    } finally {
        await dbConnection.close();
    }
}
