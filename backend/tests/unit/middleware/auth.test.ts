/**
 * Auth Middleware Unit Tests
 * 
 * Tests authentication middleware functionality including:
 * - Token validation
 * - User object attachment
 * - Error handling
 * - Development mode behavior
 */

import { Request, Response, NextFunction } from 'express';

// Mock Firebase Admin before importing auth
const mockVerifyIdToken = jest.fn();
jest.mock('../../../src/config/firebase', () => ({
  auth: {
    verifyIdToken: mockVerifyIdToken,
  },
  db: null,
}));

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

import { auth, validateAuthConfig } from '../../../src/middleware/auth';
import { AppError } from '../../../src/middleware/errorHandler';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      headers: {},
      user: undefined,
    };
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    
    mockNext = jest.fn();
    
    // Reset environment
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_MOCK_AUTH;
    
    jest.clearAllMocks();
  });

  describe('auth middleware', () => {
    it('should call next with AppError when no Authorization header', async () => {
      mockRequest.headers = {};

      await auth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: expect.stringContaining('No token provided'),
        })
      );
    });

    it('should call next with AppError for invalid Authorization header format', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token123',
      };

      await auth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: expect.stringContaining('No token provided'),
        })
      );
    });

    it('should authenticate valid token and attach user to request', async () => {
      const mockDecodedToken = {
        uid: 'test-user-123',
        email: 'test@example.com',
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      mockRequest.headers = {
        authorization: 'Bearer valid-token-123',
      };

      await auth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token-123');
      expect(mockRequest.user).toEqual({
        uid: 'test-user-123',
        email: 'test@example.com',
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with AppError for invalid tokens', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      await auth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: expect.stringContaining('Invalid token'),
        })
      );
    });

    it('should use mock user when ALLOW_MOCK_AUTH=true in development mode', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_MOCK_AUTH = 'true';

      mockVerifyIdToken.mockRejectedValue(new Error('Token verification failed'));

      mockRequest.headers = {
        authorization: 'Bearer some-token',
      };

      await auth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.uid).toMatch(/^dev-user-/);
      expect(mockRequest.user?.email).toBe('dev@example.com');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject invalid token when ALLOW_MOCK_AUTH is not set in development', async () => {
      process.env.NODE_ENV = 'development';
      // ALLOW_MOCK_AUTH is not set

      mockVerifyIdToken.mockRejectedValue(new Error('Token verification failed'));

      mockRequest.headers = {
        authorization: 'Bearer some-token',
      };

      await auth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });

    it('should call next with AppError for expired tokens', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token has expired'));

      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      await auth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });
  });

  describe('validateAuthConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should throw error when CRON_SECRET is not configured', () => {
      delete process.env.CRON_SECRET;

      expect(() => validateAuthConfig()).toThrow(/CRON_SECRET/);
    });

    it('should throw error when CRON_SECRET is too short', () => {
      process.env.CRON_SECRET = 'short';

      expect(() => validateAuthConfig()).toThrow(/32 characters/);
    });

    it('should validate successfully with proper configuration', () => {
      process.env.CRON_SECRET = 'a'.repeat(32);
      
      expect(() => validateAuthConfig()).not.toThrow();
    });

    it('should validate ALLOWED_CRON_IPS format', () => {
      process.env.CRON_SECRET = 'a'.repeat(32);
      process.env.ALLOWED_CRON_IPS = '192.168.1.1,10.0.0.1';

      expect(() => validateAuthConfig()).not.toThrow();
    });

    it('should allow localhost in ALLOWED_CRON_IPS', () => {
      process.env.CRON_SECRET = 'a'.repeat(32);
      process.env.ALLOWED_CRON_IPS = 'localhost,192.168.1.1';

      expect(() => validateAuthConfig()).not.toThrow();
    });
  });
});
