import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Operational errors are safe to send to clients.
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

interface ErrorResponse {
  success: false;
  error: string;
  stack?: string;
}

// Express error handler.
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  if (isOperational) {
    logger.warn(`Operational error: ${message}`, { 
      path: req.path,
      method: req.method,
      statusCode,
      userId: req.user?.uid
    });
  } else {
    logger.error(`Unexpected error: ${err.message}`, { 
      path: req.path,
      method: req.method,
      stack: err.stack,
      userId: req.user?.uid
    });
  }

  const response: ErrorResponse = {
    success: false,
    error: message,
  };

  if (process.env.NODE_ENV === 'development' && !isOperational) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// Wrap async handlers and forward errors.
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
