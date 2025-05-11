"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
// Custom error class
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    // Default error status and message
    let statusCode = 500;
    let message = 'Internal Server Error';
    let isOperational = false;
    // Handle known operational errors
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        isOperational = err.isOperational;
    }
    // Log error
    if (isOperational) {
        logger_1.default.warn(`Operational error: ${message}`, {
            path: req.path,
            method: req.method,
            statusCode
        });
    }
    else {
        logger_1.default.error(`Unexpected error: ${err.message}`, {
            path: req.path,
            method: req.method,
            stack: err.stack
        });
    }
    // Send response
    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && !isOperational ? { stack: err.stack } : {})
    });
};
exports.errorHandler = errorHandler;
