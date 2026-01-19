"use strict";
/**
 * Rate Limiter Middleware
 *
 * Provides request rate limiting with Upstash Redis persistence for distributed
 * environments and in-memory caching for performance. Uses a unified caching
 * layer for consistency with the rest of the application.
 *
 * Security: Fails CLOSED on errors - uses in-memory fallback to continue
 * enforcing rate limits even when Redis is unavailable.
 *
 * Features:
 * - Per-user/per-IP tracking
 * - In-memory cache with Redis persistence
 * - Rate limit headers (X-RateLimit-*)
 * - Configurable presets for different endpoint types
 * - Fail-closed behavior with in-memory fallback on errors
 *
 * @module middleware/rateLimiter
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = exports.rateLimiter = exports.clearRateLimits = void 0;
const upstashCache_1 = __importDefault(require("../utils/upstashCache"));
const logger_1 = __importDefault(require("../utils/logger"));
/** In-memory cache for rate limit data */
const rateLimitCache = new Map();
/** Cache TTL in milliseconds (1 minute) */
const CACHE_TTL = 60 * 1000;
/** Write-behind flush interval in milliseconds (10 seconds) */
const FLUSH_INTERVAL = 10 * 1000;
/** Minimum increment before persisting to Redis */
const WRITE_THRESHOLD = 5;
/** Track if we're in degraded mode (Redis unavailable) */
let isDegradedMode = false;
/** Time when degraded mode started */
let degradedModeStartTime = 0;
/** How long to wait before retrying Redis (30 seconds) */
const DEGRADED_MODE_RETRY_INTERVAL = 30 * 1000;
/** Rate limit key prefix for Redis */
const RATE_LIMIT_PREFIX = 'ratelimit:';
/**
 * Get a unique identifier for rate limiting.
 * Uses user ID for authenticated requests, IP for anonymous.
 *
 * @param req - Express request object
 * @returns Unique rate limit key
 */
const getRateLimitKey = (req) => {
    var _a;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) {
        return `user_${req.user.uid}_${ip}`;
    }
    return `ip_${ip}`;
};
/**
 * Check if we should retry Redis after being in degraded mode
 */
const shouldRetryRedis = () => {
    if (!isDegradedMode)
        return true;
    return Date.now() - degradedModeStartTime >= DEGRADED_MODE_RETRY_INTERVAL;
};
/**
 * Enter degraded mode (Redis unavailable)
 */
const enterDegradedMode = () => {
    if (!isDegradedMode) {
        isDegradedMode = true;
        degradedModeStartTime = Date.now();
        logger_1.default.warn('Rate limiter entering degraded mode - using in-memory only', {
            timestamp: new Date().toISOString()
        });
    }
};
/**
 * Exit degraded mode (Redis recovered)
 */
const exitDegradedMode = () => {
    if (isDegradedMode) {
        isDegradedMode = false;
        logger_1.default.info('Rate limiter exiting degraded mode - Redis recovered', {
            degradedDuration: Date.now() - degradedModeStartTime
        });
    }
};
/**
 * Get rate limit data from cache or Redis
 * In degraded mode, uses in-memory cache only to continue enforcing limits.
 *
 * @param key - Rate limit key
 * @returns Rate limit data or null if not found
 */
const getRateLimitData = async (key) => {
    const redisKey = `${RATE_LIMIT_PREFIX}${key}`;
    // Check cache first - this is our primary source in degraded mode
    const cached = rateLimitCache.get(key);
    if (cached && Date.now() - cached.lastRequest < CACHE_TTL) {
        return {
            count: cached.count,
            resetTime: cached.resetTime,
            lastRequest: cached.lastRequest
        };
    }
    // In degraded mode or if cache is valid, skip Redis
    if (isDegradedMode && !shouldRetryRedis()) {
        return cached ? {
            count: cached.count,
            resetTime: cached.resetTime,
            lastRequest: cached.lastRequest
        } : null;
    }
    try {
        const data = await upstashCache_1.default.get(redisKey);
        // If we were in degraded mode, we've now recovered
        // (successful Redis call, regardless of whether data exists)
        if (isDegradedMode) {
            exitDegradedMode();
        }
        if (data) {
            // Populate cache from Redis
            rateLimitCache.set(key, { ...data, dirty: false, lastFlushedCount: data.count });
            return data;
        }
        return null;
    }
    catch (error) {
        logger_1.default.error('Error fetching rate limit data from Redis:', { error, key });
        enterDegradedMode();
        // Return cached data if available, otherwise null
        return cached ? {
            count: cached.count,
            resetTime: cached.resetTime,
            lastRequest: cached.lastRequest
        } : null;
    }
};
/**
 * Update rate limit data in cache (write-behind pattern)
 * Only marks as dirty; actual Redis write happens in flush
 *
 * @param key - Rate limit key
 * @param data - Rate limit data to store
 */
const updateRateLimitDataInCache = (key, data) => {
    const existing = rateLimitCache.get(key);
    // Reset lastFlushedCount if this is a new window (different resetTime)
    // This prevents negative incrementsSinceFlush when windows change
    const lastFlushedCount = existing && existing.resetTime === data.resetTime
        ? existing.lastFlushedCount
        : 0;
    const incrementsSinceFlush = data.count - lastFlushedCount;
    rateLimitCache.set(key, {
        ...data,
        lastFlushedCount,
        // Mark dirty when increments since last flush reach threshold
        dirty: incrementsSinceFlush >= WRITE_THRESHOLD
    });
};
/**
 * Flush dirty cache entries to Redis
 * Called periodically to persist rate limit data
 */
const flushDirtyEntries = async () => {
    const dirtyEntries = [];
    for (const [key, entry] of rateLimitCache.entries()) {
        if (entry.dirty) {
            dirtyEntries.push([key, entry]);
        }
    }
    if (dirtyEntries.length === 0)
        return;
    try {
        // Flush to Redis in parallel
        await Promise.all(dirtyEntries.map(async ([key, entry]) => {
            const redisKey = `${RATE_LIMIT_PREFIX}${key}`;
            // Skip if already expired - delete from cache instead
            if (entry.resetTime <= Date.now()) {
                rateLimitCache.delete(key);
                return;
            }
            const ttlSeconds = Math.ceil((entry.resetTime - Date.now()) / 1000);
            // Capture the count we're flushing
            const flushedCount = entry.count;
            await upstashCache_1.default.set(redisKey, {
                count: entry.count,
                resetTime: entry.resetTime,
                lastRequest: entry.lastRequest
            }, ttlSeconds);
            // Update lastFlushedCount and dirty flag
            const current = rateLimitCache.get(key);
            if (current) {
                // Always update lastFlushedCount to what we flushed
                current.lastFlushedCount = flushedCount;
                // Only mark clean if no new increments occurred during flush
                if (current.count === flushedCount) {
                    current.dirty = false;
                }
                // If count changed, entry remains dirty and will be flushed again
            }
        }));
        logger_1.default.debug(`Flushed ${dirtyEntries.length} rate limit entries to Redis`);
    }
    catch (error) {
        logger_1.default.error('Error flushing rate limit data to Redis:', { error });
        // Re-mark entries as dirty for retry using keys (not stale references)
        // This prevents race condition when entries are replaced during flush
        for (const [key] of dirtyEntries) {
            const current = rateLimitCache.get(key);
            if (current) {
                current.dirty = true;
            }
        }
        enterDegradedMode();
    }
};
/**
 * Cleanup expired entries from in-memory cache
 */
const cleanupExpiredEntries = () => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of rateLimitCache.entries()) {
        if (entry.resetTime < now) {
            rateLimitCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger_1.default.debug(`Cleaned ${cleaned} expired rate limit entries from memory`);
    }
};
/**
 * Clear all rate limits (development/testing only)
 */
const clearRateLimits = async () => {
    try {
        rateLimitCache.clear();
        // Clear from Redis using pattern
        await upstashCache_1.default.invalidatePattern(`${RATE_LIMIT_PREFIX}*`);
        logger_1.default.info('Cleared all rate limit entries');
    }
    catch (error) {
        logger_1.default.error('Error clearing rate limits:', { error });
    }
};
exports.clearRateLimits = clearRateLimits;
// Schedule periodic flush and cleanup (only in non-serverless environments)
// In serverless, rely on request-based flushing
if (typeof global !== 'undefined' && process.env.VERCEL !== '1') {
    setInterval(flushDirtyEntries, FLUSH_INTERVAL);
    setInterval(cleanupExpiredEntries, 60 * 1000); // Cleanup every minute
}
/**
 * Rate limiter middleware factory
 *
 * Creates a rate limiting middleware with configurable limits.
 * Uses write-behind caching to minimize Redis writes.
 *
 * Security: Fails CLOSED on errors - continues enforcing limits using
 * in-memory cache when Redis is unavailable. Does NOT allow requests
 * through unmetered on errors.
 *
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // 100 requests per 15 minutes
 * app.use(rateLimiter(100, 15 * 60 * 1000));
 * ```
 */
const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
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
                    'Retry-After': retryAfter.toString(),
                    // Include degraded mode indicator for monitoring consistency
                    ...(isDegradedMode ? { 'X-RateLimit-Mode': 'degraded' } : {})
                });
                logger_1.default.warn('Rate limit exceeded', {
                    key,
                    count: rateLimitData.count,
                    maxRequests,
                    retryAfter,
                    degradedMode: isDegradedMode
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
            // Update cache (write-behind - no immediate Redis write)
            updateRateLimitDataInCache(key, rateLimitData);
            // Set rate limit headers
            const remaining = Math.max(0, maxRequests - rateLimitData.count);
            res.set({
                'X-RateLimit-Limit': maxRequests.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': Math.ceil(rateLimitData.resetTime / 1000).toString()
            });
            // Add header indicating degraded mode for monitoring
            if (isDegradedMode) {
                res.set('X-RateLimit-Mode', 'degraded');
            }
            // Flush on every Nth request in serverless environments
            if (process.env.VERCEL === '1' && rateLimitData.count % WRITE_THRESHOLD === 0) {
                // Fire and forget - don't block the response
                flushDirtyEntries().catch(err => logger_1.default.debug('Background flush failed', { error: err === null || err === void 0 ? void 0 : err.message }));
            }
            next();
        }
        catch (error) {
            // FAIL CLOSED: On unexpected error, use in-memory only tracking
            // This ensures rate limiting continues even if there's an issue
            logger_1.default.error('Rate limiter error - using in-memory fallback:', { error, key });
            enterDegradedMode();
            // Get or initialize in-memory data
            let cached = rateLimitCache.get(key);
            if (!cached || cached.resetTime < now) {
                cached = {
                    count: 0,
                    resetTime: now + windowMs,
                    lastRequest: now,
                    dirty: false,
                    lastFlushedCount: 0
                };
            }
            // Check limit using in-memory data
            if (cached.count >= maxRequests) {
                const retryAfter = Math.ceil((cached.resetTime - now) / 1000);
                res.set({
                    'X-RateLimit-Limit': maxRequests.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': Math.ceil(cached.resetTime / 1000).toString(),
                    'Retry-After': retryAfter.toString(),
                    'X-RateLimit-Mode': 'degraded'
                });
                logger_1.default.warn('Rate limit exceeded (degraded mode)', {
                    key,
                    count: cached.count,
                    maxRequests,
                    retryAfter
                });
                res.status(429).json({
                    error: 'Too many requests, please try again later.',
                    retryAfter,
                    limit: maxRequests,
                    remaining: 0,
                    resetTime: cached.resetTime
                });
                return;
            }
            // Increment counter in memory
            cached.count += 1;
            cached.lastRequest = now;
            cached.dirty = true;
            rateLimitCache.set(key, cached);
            // Set headers
            const remaining = Math.max(0, maxRequests - cached.count);
            res.set({
                'X-RateLimit-Limit': maxRequests.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': Math.ceil(cached.resetTime / 1000).toString(),
                'X-RateLimit-Mode': 'degraded'
            });
            next();
        }
    };
};
exports.rateLimiter = rateLimiter;
/**
 * Pre-configured rate limiters for different endpoint types
 */
exports.createRateLimiter = {
    /** Standard API rate limiter: 100 requests per 15 minutes */
    api: () => (0, exports.rateLimiter)(100, 15 * 60 * 1000),
    /** Strict rate limiter for auth endpoints: 20 requests per 15 minutes */
    auth: () => (0, exports.rateLimiter)(20, 15 * 60 * 1000),
    /** Lenient rate limiter for read operations: 200 requests per 15 minutes */
    read: () => (0, exports.rateLimiter)(200, 15 * 60 * 1000),
    /** Very strict for sensitive operations: 3 requests per hour */
    sensitive: () => (0, exports.rateLimiter)(3, 60 * 60 * 1000),
    /** Custom rate limiter with specified limits */
    custom: (maxRequests, windowMs) => (0, exports.rateLimiter)(maxRequests, windowMs)
};
