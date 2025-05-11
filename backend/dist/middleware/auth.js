"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("./errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
// Authentication middleware
const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('Unauthorized: No token provided', 401, true);
        }
        const token = authHeader.split(' ')[1];
        try {
            if (!firebase_1.auth) {
                throw new errorHandler_1.AppError('Firebase auth not initialized', 500, false);
            }
            const decodedToken = await firebase_1.auth.verifyIdToken(token);
            req.user = {
                uid: decodedToken.uid,
                email: decodedToken.email
            };
            next();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.default.error('Error verifying token:', { error: errorMessage });
            throw new errorHandler_1.AppError('Unauthorized: Invalid token', 401, true);
        }
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
        }
        else {
            logger_1.default.error('Authentication error:', { error });
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
exports.auth = auth;
