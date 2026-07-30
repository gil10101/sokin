/**
 * Rate Limiter Middleware
 *
 * Fixed-window rate limiting backed by an atomic Upstash Redis
 * INCR+EXPIRE pipeline, so every serverless instance shares one
 * authoritative counter per key. When Redis is unreachable the limiter
 * fails CLOSED onto a per-instance in-memory window — requests stay
 * metered, never unmetered.
 *
 * @module middleware/rateLimiter
 */

import { Request, Response, NextFunction } from 'express';
import upstashCache from '../utils/upstashCache';
import logger from '../utils/logger';

/** Rate limit key prefix for Redis */
const RATE_LIMIT_PREFIX = 'ratelimit:';

/** In-memory fallback window state (fail-closed mode) */
interface MemoryWindow {
  count: number;
  resetTime: number;
}

const memoryWindows = new Map<string, MemoryWindow>();

/** Cap fallback map growth on long-lived processes */
const MEMORY_WINDOW_MAX_KEYS = 10_000;

/**
 * Get a unique identifier for rate limiting.
 * Uses user ID for authenticated requests, IP for anonymous.
 */
const getRateLimitKey = (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (req.user?.uid) {
    return `user_${req.user.uid}`;
  }

  return `ip_${ip}`;
};

const sweepExpiredMemoryWindows = (now: number): void => {
  if (memoryWindows.size < MEMORY_WINDOW_MAX_KEYS) return;
  for (const [key, window] of memoryWindows.entries()) {
    if (window.resetTime <= now) {
      memoryWindows.delete(key);
    }
  }
};

/**
 * Fail-closed fallback: per-instance fixed window used only while Redis is
 * unreachable. Weaker than the shared counter (per-instance), but requests
 * are never let through unmetered.
 */
const incrementInMemory = (
  key: string,
  windowMs: number,
  now: number
): { count: number; remainingMs: number } => {
  sweepExpiredMemoryWindows(now);

  let window = memoryWindows.get(key);
  if (!window || window.resetTime <= now) {
    window = { count: 0, resetTime: now + windowMs };
    memoryWindows.set(key, window);
  }
  window.count += 1;
  return { count: window.count, remainingMs: window.resetTime - now };
};

const sendLimitExceeded = (
  res: Response,
  maxRequests: number,
  remainingMs: number,
  degraded: boolean
): void => {
  const retryAfter = Math.max(1, Math.ceil(remainingMs / 1000));
  const resetTime = Date.now() + remainingMs;

  res.set({
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
    'Retry-After': retryAfter.toString(),
    ...(degraded ? { 'X-RateLimit-Mode': 'degraded' } : {}),
  });

  res.status(429).json({
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter,
    limit: maxRequests,
    remaining: 0,
    resetTime,
  });
};

/**
 * Clear all rate limits (development/testing only)
 */
export const clearRateLimits = async (): Promise<void> => {
  memoryWindows.clear();
  try {
    await upstashCache.invalidatePattern(`${RATE_LIMIT_PREFIX}*`);
    logger.info('Cleared all rate limit entries');
  } catch (error) {
    logger.error('Error clearing rate limits:', { error });
  }
};

/**
 * Rate limiter middleware factory (fixed window).
 *
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 *
 * @example
 * ```typescript
 * // 100 requests per 15 minutes
 * app.use(rateLimiter(100, 15 * 60 * 1000));
 * ```
 */
export const rateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000
) => {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = getRateLimitKey(req);
    const redisKey = `${RATE_LIMIT_PREFIX}${windowSeconds}:${key}`;
    const now = Date.now();

    let count: number;
    let remainingMs: number;
    let degraded = false;

    try {
      const shared = await upstashCache.rateLimitIncrement(redisKey, windowSeconds);
      if (shared) {
        ({ count, remainingMs } = shared);
      } else {
        degraded = true;
        ({ count, remainingMs } = incrementInMemory(redisKey, windowMs, now));
      }
    } catch (error) {
      // Unexpected limiter bug — still fail closed via the memory window
      logger.error('Rate limiter error - using in-memory fallback:', { error, key });
      degraded = true;
      ({ count, remainingMs } = incrementInMemory(redisKey, windowMs, now));
    }

    if (degraded) {
      res.set('X-RateLimit-Mode', 'degraded');
    }

    if (count > maxRequests) {
      logger.warn('Rate limit exceeded', { key, count, maxRequests, degraded });
      sendLimitExceeded(res, maxRequests, remainingMs, degraded);
      return;
    }

    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - count).toString(),
      'X-RateLimit-Reset': Math.ceil((now + remainingMs) / 1000).toString(),
    });

    next();
  };
};

/**
 * Pre-configured rate limiters for different endpoint types
 */
export const createRateLimiter = {
  /** Standard API rate limiter: 100 requests per 15 minutes */
  api: () => rateLimiter(100, 15 * 60 * 1000),

  /** Strict rate limiter for auth endpoints: 20 requests per 15 minutes */
  auth: () => rateLimiter(20, 15 * 60 * 1000),

  /** Lenient rate limiter for read operations: 200 requests per 15 minutes */
  read: () => rateLimiter(200, 15 * 60 * 1000),

  /** Very strict for sensitive operations: 3 requests per hour */
  sensitive: () => rateLimiter(3, 60 * 60 * 1000),

  /** Custom rate limiter with specified limits */
  custom: (maxRequests: number, windowMs: number) => rateLimiter(maxRequests, windowMs)
};
