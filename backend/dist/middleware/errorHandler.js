"use strict";
/**
 * Error Handler Middleware
 *
 * Provides centralized error handling for the Express application.
 * Distinguishes between operational errors (expected, like validation)
 * and programmer errors (unexpected, like bugs).
 *
 * Features:
 * - Custom AppError class for operational errors
 * - Stack trace exposure only in development
 * - Structured logging for error tracking
 * - Consistent error response format
 *
 * @module middleware/errorHandler
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = exports.AppError = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Custom error class for operational errors
 *
 * Use this for expected errors that should be communicated to the client,
 * such as validation failures, authentication errors, or resource not found.
 *
 * @example
 * ```typescript
 * // Throw in a controller or middleware
 * throw new AppError('User not found', 404, true);
 *
 * // For internal errors that shouldn't expose details
 * throw new AppError('Database connection failed', 500, false);
 * ```
 */
class AppError extends Error {
    /**
     * Create a new AppError
     *
     * @param message - Error message (sent to client for operational errors)
     * @param statusCode - HTTP status code (default: 500)
     * @param isOperational - Whether this is an expected error (default: true)
     */
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        // Capture stack trace, excluding constructor call from it
        Error.captureStackTrace(this, this.constructor);
        // Ensure the name property is set correctly for instanceof checks
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
/**
 * Global error handler middleware
 *
 * Should be the last middleware in the Express middleware chain.
 * Handles all errors thrown or passed via next(error).
 *
 * @param err - Error object (can be AppError or generic Error)
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (required for Express to recognize as error handler)
 *
 * @example
 * ```typescript
 * // In Express app setup (must be last)
 * app.use(errorHandler);
 * ```
 */
const errorHandler = (err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) => {
    var _a, _b;
    // Default error properties
    let statusCode = 500;
    let message = 'Internal Server Error';
    let isOperational = false;
    // Handle known operational errors
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        isOperational = err.isOperational;
    }
    // Log the error with appropriate level
    if (isOperational) {
        logger_1.default.warn(`Operational error: ${message}`, {
            path: req.path,
            method: req.method,
            statusCode,
            userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid
        });
    }
    else {
        logger_1.default.error(`Unexpected error: ${err.message}`, {
            path: req.path,
            method: req.method,
            stack: err.stack,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
    }
    // Build response
    const response = {
        success: false,
        error: message,
    };
    // Include stack trace only in development for non-operational errors
    if (process.env.NODE_ENV === 'development' && !isOperational) {
        response.stack = err.stack;
    }
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
/**
 * Async handler wrapper to catch errors in async route handlers
 *
 * Wraps an async function and forwards any errors to the error handler middleware.
 * This eliminates the need for try-catch in every async route handler.
 *
 * @param fn - Async route handler function
 * @returns Wrapped function that catches errors
 *
 * @example
 * ```typescript
 * // Without asyncHandler (verbose)
 * router.get('/', async (req, res, next) => {
 *   try {
 *     const data = await fetchData();
 *     res.json(data);
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 *
 * // With asyncHandler (clean)
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await fetchData();
 *   res.json(data);
 * }));
 * ```
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
