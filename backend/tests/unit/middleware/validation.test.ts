/**
 * Validation Middleware Unit Tests
 * 
 * Tests request validation using Joi schemas including:
 * - Body validation
 * - Parameter validation
 * - Query validation
 * - Error response format
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { validateBody, validateParams, validateQuery, validate } from '../../../src/middleware/validation';

describe('Validation Middleware', () => {
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
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();
  });

  describe('validateBody', () => {
    const schema = Joi.object({
      name: Joi.string().required().trim(),
      amount: Joi.number().required().positive(),
      category: Joi.string().optional().trim(),
    });

    it('should pass validation with valid body', () => {
      mockRequest.body = {
        name: 'Test Expense',
        amount: 100.50,
        category: 'Food',
      };

      validateBody(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should fail validation with missing required field', () => {
      mockRequest.body = {
        name: 'Test Expense',
        // amount is missing
      };

      validateBody(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.any(Array),
        })
      );
    });

    it('should fail validation with invalid type', () => {
      mockRequest.body = {
        name: 'Test',
        amount: 'not-a-number',
      };

      validateBody(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should strip unknown properties', () => {
      mockRequest.body = {
        name: 'Test',
        amount: 50,
        unknownField: 'should be removed',
      };

      validateBody(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.body.unknownField).toBeUndefined();
    });

    it('should trim string values', () => {
      mockRequest.body = {
        name: '  Test Expense  ',
        amount: 100,
      };

      validateBody(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.name).toBe('Test Expense');
    });

    it('should coerce values to expected types', () => {
      mockRequest.body = {
        name: 'Test',
        amount: '100.50', // String that should become number
      };

      validateBody(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(typeof mockRequest.body.amount).toBe('number');
      expect(mockRequest.body.amount).toBe(100.50);
    });

    it('should collect all validation errors', () => {
      mockRequest.body = {};

      validateBody(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      // Should have errors for both name and amount
      expect(response.details.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateParams', () => {
    const schema = Joi.object({
      id: Joi.string().trim().min(8).max(128).required(),
    });

    it('should pass validation with valid params', () => {
      mockRequest.params = {
        id: 'expense-12345678',
      };

      validateParams(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail validation with missing param', () => {
      mockRequest.params = {};

      validateParams(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should fail validation with invalid param length', () => {
      mockRequest.params = {
        id: 'short', // Less than 8 characters
      };

      validateParams(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should store validated params in validatedParams', () => {
      mockRequest.params = {
        id: 'expense-12345678',
      };

      validateParams(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.validatedParams).toBeDefined();
      expect(mockRequest.validatedParams?.id).toBe('expense-12345678');
    });

    it('should update req.params with string-coerced values', () => {
      const numericSchema = Joi.object({
        page: Joi.number().integer().positive(),
      });

      mockRequest.params = {
        page: '5',
      };

      validateParams(numericSchema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(typeof mockRequest.params.page).toBe('string');
      expect(mockRequest.params.page).toBe('5');
    });
  });

  describe('validateQuery', () => {
    const schema = Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(50),
      cursor: Joi.string().optional(),
      sortBy: Joi.string().valid('date', 'amount', 'name').default('date'),
    });

    it('should pass validation with valid query', () => {
      mockRequest.query = {
        limit: '25',
        sortBy: 'amount',
      };

      validateQuery(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should apply default values', () => {
      mockRequest.query = {};

      validateQuery(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.query.limit).toBe(50);
      expect(mockRequest.query.sortBy).toBe('date');
    });

    it('should fail validation with invalid enum value', () => {
      mockRequest.query = {
        sortBy: 'invalid-sort',
      };

      validateQuery(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should fail validation with value outside range', () => {
      mockRequest.query = {
        limit: '500', // Max is 100
      };

      validateQuery(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should strip unknown query params', () => {
      mockRequest.query = {
        limit: '10',
        unknownParam: 'should be removed',
      };

      validateQuery(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.query.unknownParam).toBeUndefined();
    });

    it('should coerce string to number for numeric fields', () => {
      mockRequest.query = {
        limit: '30',
      };

      validateQuery(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.query.limit).toBe(30);
      expect(typeof mockRequest.query.limit).toBe('number');
    });
  });

  describe('validate (deprecated alias)', () => {
    it('should work the same as validateBody', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
      });

      mockRequest.body = { name: 'Test' };

      validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});

