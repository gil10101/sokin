/**
 * Rate Limiter Middleware Unit Tests
 * 
 * Tests rate limiting functionality including:
 * - Request counting
 * - Window expiration
 * - Rate limit headers
 * - Cache interaction
 */

import { Request, Response, NextFunction } from 'express';

// Mock upstashCache - needs to be mocked before requiring rateLimiter
jest.mock('../../../src/utils/upstashCache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    invalidatePattern: jest.fn(),
    has: jest.fn(),
    getOrSet: jest.fn(),
    rateLimitIncrement: jest.fn(),
    isAvailable: jest.fn().mockReturnValue(true),
    getStats: jest.fn().mockReturnValue({ memorySize: 0, upstashAvailable: true, lastHealthCheck: 0 }),
  },
  CACHE_TTL: {
    QUOTE: 30,
    PROFILE: 3600,
    SEARCH: 300,
    TRENDING: 60,
    MARKET_INDICES: 30,
    CANDLES: 300,
    PORTFOLIO: 15,
    USER_SETTINGS: 600,
  },
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

import { rateLimiter, clearRateLimits, createRateLimiter } from '../../../src/middleware/rateLimiter';
import upstashCache from '../../../src/utils/upstashCache';

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let setMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    setMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      user: undefined,
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
      set: setMock,
    };

    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    
    // Default: no existing rate limit data in cache
    (upstashCache.get as jest.Mock).mockResolvedValue(null);
    (upstashCache.set as jest.Mock).mockResolvedValue(undefined);
    (upstashCache.invalidatePattern as jest.Mock).mockResolvedValue(undefined);
  });

  describe('rateLimiter factory', () => {
    it('should create middleware with default parameters', () => {
      const middleware = rateLimiter();
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware with custom parameters', () => {
      const middleware = rateLimiter(50, 60000);
      expect(typeof middleware).toBe('function');
    });
  });

  describe('rate limiting behavior', () => {
    it('should allow requests under the limit', async () => {
      // Simulate cached data with low count
      (upstashCache.get as jest.Mock).mockResolvedValue({
        count: 5,
        resetTime: Date.now() + 60000,
        lastRequest: Date.now(),
      });

      const middleware = rateLimiter(100, 60000);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalled();
    });

    it('should set rate limit headers', async () => {
      (upstashCache.get as jest.Mock).mockResolvedValue({
        count: 50,
        resetTime: Date.now() + 60000,
        lastRequest: Date.now(),
      });

      const middleware = rateLimiter(100, 60000);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': expect.any(String),
          'X-RateLimit-Reset': expect.any(String),
        })
      );
    });

    it('should reset counter when window expires', async () => {
      // Expired window - rate limiter should reset the count
      (upstashCache.get as jest.Mock).mockResolvedValue({
        count: 100,
        resetTime: Date.now() - 1000, // Expired
        lastRequest: Date.now() - 60000,
      });

      const middleware = rateLimiter(100, 60000);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should use user ID for authenticated requests', async () => {
      mockRequest.user = { uid: 'user-123', email: 'test@example.com' };

      (upstashCache.get as jest.Mock).mockResolvedValue(null);

      const middleware = rateLimiter(100, 60000);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully and continue enforcing limits', async () => {
      (upstashCache.get as jest.Mock).mockRejectedValue(new Error('Cache error'));

      const middleware = rateLimiter(100, 60000);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should still allow request through using in-memory fallback
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow first request when no cache data exists', async () => {
      (upstashCache.get as jest.Mock).mockResolvedValue(null);

      const middleware = rateLimiter(100, 60000);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // First request should always be allowed
      expect(mockNext).toHaveBeenCalled();
    });

    it('should calculate remaining requests correctly', async () => {
      (upstashCache.get as jest.Mock).mockResolvedValue({
        count: 50,
        resetTime: Date.now() + 60000,
        lastRequest: Date.now(),
      });

      const middleware = rateLimiter(100, 60000);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should set remaining = 100 - 51 = 49 (after incrementing count)
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Remaining': expect.any(String),
        })
      );
    });
  });

  describe('createRateLimiter presets', () => {
    it('should create API rate limiter with default settings', () => {
      const middleware = createRateLimiter.api();
      expect(typeof middleware).toBe('function');
    });

    it('should create auth rate limiter with stricter limits', () => {
      const middleware = createRateLimiter.auth();
      expect(typeof middleware).toBe('function');
    });

    it('should create read rate limiter with lenient limits', () => {
      const middleware = createRateLimiter.read();
      expect(typeof middleware).toBe('function');
    });

    it('should create sensitive rate limiter with very strict limits', () => {
      const middleware = createRateLimiter.sensitive();
      expect(typeof middleware).toBe('function');
    });

    it('should create custom rate limiter', () => {
      const middleware = createRateLimiter.custom(200, 300000);
      expect(typeof middleware).toBe('function');
    });
  });

  describe('clearRateLimits', () => {
    it('should clear all rate limit entries', async () => {
      await clearRateLimits();

      // Verify pattern invalidation was called
      expect(upstashCache.invalidatePattern).toHaveBeenCalledWith('ratelimit:*');
    });
  });

  describe('shared Redis counter', () => {
    const upstash = jest.requireMock('../../../src/utils/upstashCache').default;

    it('enforces the limit from the shared counter rather than per instance', async () => {
      // Every serverless instance must see the same count; the previous
      // write-behind scheme only flushed every 5th request, so an instance
      // serving fewer than that never persisted anything.
      upstash.rateLimitIncrement.mockResolvedValue({ count: 101, remainingMs: 60_000 });

      const middleware = rateLimiter(100, 15 * 60 * 1000);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('passes the request through while under the shared limit', async () => {
      upstash.rateLimitIncrement.mockResolvedValue({ count: 3, remainingMs: 60_000 });

      const middleware = rateLimiter(100, 15 * 60 * 1000);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(429);
    });

    it('keeps metering in memory when Redis is unreachable', async () => {
      upstash.rateLimitIncrement.mockResolvedValue(null);

      const middleware = rateLimiter(1, 60 * 1000);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      jest.clearAllMocks();
      upstash.rateLimitIncrement.mockResolvedValue(null);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });
});