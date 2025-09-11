"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = exports.rateLimiter = exports.clearRateLimits = exports.cleanupExpiredRateLimits = void 0;
const firebase_1 = require("../config/firebase");
const logger_1 = __importDefault(require("../utils/logger"));
// Cache for rate limit data to reduce Firestore calls
const rateLimitCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute cache
/**
 * Get a unique identifier for rate limiting
 * Uses IP address and optionally user ID for authenticated requests
 */
const getRateLimitKey = (req) => {
    var _a;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // For authenticated requests, use user ID + IP for more granular limiting
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) {
        return `user_${req.user.uid}_${ip}`;
    }
    // For anonymous requests, use IP only
    return `ip_${ip}`;
};
/**
 * Get rate limit data from Firestore with caching
 */
const getRateLimitData = async (key) => {
    // Check cache first
    const cached = rateLimitCache.get(key);
    if (cached && Date.now() - cached.lastRequest < CACHE_TTL) {
        return cached;
    }
    try {
        if (!firebase_1.db) {
            logger_1.default.error('Database not initialized');
            return null;
        }
        const rateLimitRef = firebase_1.db.collection('rateLimits').doc(key);
        const doc = await rateLimitRef.get();
        if (doc.exists) {
            const data = doc.data();
            rateLimitCache.set(key, data);
            return data;
        }
        return null;
    }
    catch (error) {
        logger_1.default.error('Error fetching rate limit data:', { error, key });
        return null;
    }
};
/**
 * Update rate limit data in Firestore
 */
const updateRateLimitData = async (key, data) => {
    try {
        if (!firebase_1.db) {
            logger_1.default.error('Database not initialized');
            return;
        }
        const rateLimitRef = firebase_1.db.collection('rateLimits').doc(key);
        await rateLimitRef.set(data, { merge: true });
        // Update cache
        rateLimitCache.set(key, data);
    }
    catch (error) {
        logger_1.default.error('Error updating rate limit data:', { error, key });
    }
};
/**
 * Clean up expired rate limit entries (run periodically)
 */
const cleanupExpiredRateLimits = async () => {
    try {
        if (!firebase_1.db) {
            logger_1.default.error('Database not initialized');
            return;
        }
        const now = Date.now();
        const expiredQuery = firebase_1.db.collection('rateLimits').where('resetTime', '<', now);
        const snapshot = await expiredQuery.get();
        const batch = firebase_1.db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        logger_1.default.info(`Cleaned up ${snapshot.size} expired rate limit entries`);
    }
    catch (error) {
        logger_1.default.error('Error cleaning up expired rate limits:', { error });
    }
};
exports.cleanupExpiredRateLimits = cleanupExpiredRateLimits;
// Set up periodic cleanup (every 30 minutes)
if (typeof global !== 'undefined') {
    setInterval(exports.cleanupExpiredRateLimits, 30 * 60 * 1000);
}
/**
 * Function to clear rate limits (for development/testing)
 */
const clearRateLimits = async () => {
    try {
        if (!firebase_1.db) {
            logger_1.default.error('Database not initialized');
            return;
        }
        const snapshot = await firebase_1.db.collection('rateLimits').get();
        const batch = firebase_1.db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        // Clear cache
        rateLimitCache.clear();
        logger_1.default.info(`Cleared ${snapshot.size} rate limit entries`);
    }
    catch (error) {
        logger_1.default.error('Error clearing rate limits:', { error });
    }
};
exports.clearRateLimits = clearRateLimits;
/**
 * Rate limiter middleware using Firestore for persistence and scalability
 */
const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000, // 15 minutes
skipSuccessfulRequests = false, skipErrors = false) => {
    return async (req, res, next) => {
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
                logger_1.default.warn('Rate limit exceeded', {
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
            res.rateLimitData = { key, data: rateLimitData };
            next();
        }
        catch (error) {
            logger_1.default.error('Rate limiter error:', { error, key });
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
exports.rateLimiter = rateLimiter;
/**
 * Create different rate limiters for different use cases
 */
exports.createRateLimiter = {
    // Standard API rate limiter
    api: () => (0, exports.rateLimiter)(100, 15 * 60 * 1000), // 100 requests per 15 minutes
    // Stricter rate limiter for authentication endpoints
    auth: () => (0, exports.rateLimiter)(5, 15 * 60 * 1000), // 5 requests per 15 minutes
    // More lenient for read-only operations
    read: () => (0, exports.rateLimiter)(200, 15 * 60 * 1000), // 200 requests per 15 minutes
    // Very strict for password reset and similar sensitive operations
    sensitive: () => (0, exports.rateLimiter)(3, 60 * 60 * 1000), // 3 requests per hour
    // Custom rate limiter
    custom: (maxRequests, windowMs) => (0, exports.rateLimiter)(maxRequests, windowMs)
};
