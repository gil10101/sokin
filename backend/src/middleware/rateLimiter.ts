import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import logger from '../utils/logger';

interface RateLimitData {
  count: number;
  resetTime: number;
  lastRequest: number;
}

// Cache for rate limit data to reduce Firestore calls
const rateLimitCache = new Map<string, RateLimitData>();
const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Get a unique identifier for rate limiting
 * Uses IP address and optionally user ID for authenticated requests
 */
const getRateLimitKey = (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // For authenticated requests, use user ID + IP for more granular limiting
  if (req.user?.uid) {
    return `user_${req.user.uid}_${ip}`;
  }

  // For anonymous requests, use IP only
  return `ip_${ip}`;
};

/**
 * Get rate limit data from Firestore with caching
 */
const getRateLimitData = async (key: string): Promise<RateLimitData | null> => {
  // Check cache first
  const cached = rateLimitCache.get(key);
  if (cached && Date.now() - cached.lastRequest < CACHE_TTL) {
    return cached;
  }

  try {
    if (!db) {
      logger.error('Database not initialized');
      return null;
    }

    const rateLimitRef = db.collection('rateLimits').doc(key);
    const doc = await rateLimitRef.get();

    if (doc.exists) {
      const data = doc.data() as RateLimitData;
      rateLimitCache.set(key, data);
      return data;
    }

    return null;
  } catch (error) {
    logger.error('Error fetching rate limit data:', { error, key });
    return null;
  }
};

/**
 * Update rate limit data in Firestore
 */
const updateRateLimitData = async (key: string, data: RateLimitData): Promise<void> => {
  try {
    if (!db) {
      logger.error('Database not initialized');
      return;
    }

    const rateLimitRef = db.collection('rateLimits').doc(key);
    await rateLimitRef.set(data, { merge: true });

    // Update cache
    rateLimitCache.set(key, data);
  } catch (error) {
    logger.error('Error updating rate limit data:', { error, key });
  }
};

/**
 * Clean up expired rate limit entries (run periodically)
 */
export const cleanupExpiredRateLimits = async (): Promise<void> => {
  try {
    if (!db) {
      logger.error('Database not initialized');
      return;
    }

    const now = Date.now();
    const expiredQuery = db.collection('rateLimits').where('resetTime', '<', now);

    const snapshot = await expiredQuery.get();
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info(`Cleaned up ${snapshot.size} expired rate limit entries`);
  } catch (error) {
    logger.error('Error cleaning up expired rate limits:', { error });
  }
};

// Set up periodic cleanup (every 30 minutes)
if (typeof global !== 'undefined') {
  setInterval(cleanupExpiredRateLimits, 30 * 60 * 1000);
}

/**
 * Function to clear rate limits (for development/testing)
 */
export const clearRateLimits = async (): Promise<void> => {
  try {
    if (!db) {
      logger.error('Database not initialized');
      return;
    }

    const snapshot = await db.collection('rateLimits').get();
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Clear cache
    rateLimitCache.clear();

    logger.info(`Cleared ${snapshot.size} rate limit entries`);
  } catch (error) {
    logger.error('Error clearing rate limits:', { error });
  }
};

/**
 * Rate limiter middleware using Firestore for persistence and scalability
 */
export const rateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: boolean = false,
  skipErrors: boolean = false
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = getRateLimitKey(req);
    const now = Date.now();

    try {
      let rateLimitData = await getRateLimitData(key);

      // Initialize if no data exists or window has expired
      if (!rateLimitData || rateLimitData.resetTime < now) {
        rateLimitData = {
          count: 0,
          resetTime: now + windowMs,
          lastRequest: now
        };
      }

      // Check if limit exceeded
      if (rateLimitData.count >= maxRequests) {
        const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);

        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitData.resetTime / 1000).toString(),
          'Retry-After': retryAfter.toString()
        });

        logger.warn('Rate limit exceeded', {
          key,
          count: rateLimitData.count,
          maxRequests,
          retryAfter
        });

        res.status(429).json({
          error: 'Too many requests, please try again later.',
          retryAfter,
          limit: maxRequests,
          remaining: 0,
          resetTime: rateLimitData.resetTime
        });
        return;
      }

      // Increment counter
      rateLimitData.count += 1;
      rateLimitData.lastRequest = now;

      // Update Firestore
      await updateRateLimitData(key, rateLimitData);

      // Set rate limit headers
      const remaining = Math.max(0, maxRequests - rateLimitData.count);
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitData.resetTime / 1000).toString()
      });

      // Store rate limit info on response for potential rollback
      (res as any).rateLimitData = { key, data: rateLimitData };

      next();

    } catch (error) {
      logger.error('Rate limiter error:', { error, key });

      // On error, allow request to proceed but log the issue
      // This prevents rate limiter failures from blocking legitimate requests
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': 'unknown',
        'X-RateLimit-Reset': 'unknown'
      });

      next();
    }
  };
};

/**
 * Create different rate limiters for different use cases
 */
export const createRateLimiter = {
  // Standard API rate limiter
  api: () => rateLimiter(100, 15 * 60 * 1000), // 100 requests per 15 minutes

  // Stricter rate limiter for authentication endpoints
  auth: () => rateLimiter(5, 15 * 60 * 1000), // 5 requests per 15 minutes

  // More lenient for read-only operations
  read: () => rateLimiter(200, 15 * 60 * 1000), // 200 requests per 15 minutes

  // Very strict for password reset and similar sensitive operations
  sensitive: () => rateLimiter(3, 60 * 60 * 1000), // 3 requests per hour

  // Custom rate limiter
  custom: (maxRequests: number, windowMs: number) => rateLimiter(maxRequests, windowMs)
}; 