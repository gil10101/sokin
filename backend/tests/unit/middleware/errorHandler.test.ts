/**
 * Error Handler Middleware Unit Tests
 * 
 * Tests centralized error handling including:
 * - AppError class behavior
 * - Operational vs programmer error distinction
 * - Response format consistency
 * - Stack trace exposure in development
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler, asyncHandler } from '../../../src/middleware/errorHandler';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import logger from '../../../src/utils/logger';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockNext = jest.fn();

    mockRequest = {
      path: '/api/test',
      method: 'GET',
      user: { uid: 'user-123', email: 'test@example.com' },
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();
  });

  describe('AppError', () => {
    it('should create an operational error with correct properties', () => {
      const error = new AppError('Test error message', 400, true);

      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should default to status 500 and operational true', () => {
      const error = new AppError('Internal error');

      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should be an instance of Error', () => {
      const error = new AppError('Test', 404, true);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Stack test', 500, false);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Stack test');
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError with correct status code', () => {
      const error = new AppError('Not found', 404, true);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Not found',
        })
      );
    });

    it('should handle generic Error with 500 status code', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal Server Error',
        })
      );
    });

    it('should log operational errors with warn level', () => {
      const error = new AppError('Validation failed', 400, true);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Operational error: Validation failed',
        expect.objectContaining({
          path: '/api/test',
          method: 'GET',
          statusCode: 400,
        })
      );
    });

    it('should log programmer errors with error level', () => {
      const error = new Error('Unexpected error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Unexpected error: Unexpected error',
        expect.objectContaining({
          path: '/api/test',
          method: 'GET',
          stack: expect.any(String),
        })
      );
    });

    it('should not expose stack trace in production for operational errors', () => {
      process.env.NODE_ENV = 'production';
      const error = new AppError('Test error', 400, true);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.stack).toBeUndefined();

      process.env.NODE_ENV = 'test';
    });

    it('should expose stack trace in development for non-operational errors', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Dev error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.stack).toBeDefined();

      process.env.NODE_ENV = 'test';
    });

    it('should include user ID in logs when available', () => {
      const error = new AppError('User error', 400, true);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user-123',
        })
      );
    });

    it('should handle missing user gracefully', () => {
      mockRequest.user = undefined;
      const error = new AppError('No user', 401, true);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('asyncHandler', () => {
    it('should pass successful result through', async () => {
      const asyncFn = jest.fn().mockResolvedValue(undefined);
      const wrapped = asyncHandler(asyncFn);

      await wrapped(mockRequest as Request, mockResponse as Response, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    });

    it('should catch errors and call next', async () => {
      const testError = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(testError);
      const wrapped = asyncHandler(asyncFn);

      await wrapped(mockRequest as Request, mockResponse as Response, mockNext);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should forward AppError to next', async () => {
      const appError = new AppError('App error', 400, true);
      const asyncFn = jest.fn().mockRejectedValue(appError);
      const wrapped = asyncHandler(asyncFn);

      await wrapped(mockRequest as Request, mockResponse as Response, mockNext);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(appError);
    });
  });
});

