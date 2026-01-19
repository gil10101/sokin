"use strict";
/**
 * Upstash Redis Cache Implementation
 *
 * A distributed caching layer using Upstash Redis REST API.
 * Features:
 * - REST-based API (no socket connection required)
 * - Automatic fallback to in-memory cache
 * - TTL support with configurable durations
 * - JSON serialization for complex objects
 * - Error resilient with graceful degradation
 *
 * Environment Variables:
 * - UPSTASH_REDIS_REST_URL: Upstash Redis REST endpoint
 * - UPSTASH_REDIS_REST_TOKEN: Upstash authentication token
 *
 * @example
 * ```typescript
 * import upstashCache from './utils/upstashCache';
 *
 * // Set a value with TTL
 * await upstashCache.set('user:123', userData, 3600);
 *
 * // Get a value
 * const data = await upstashCache.get<UserData>('user:123');
 * ```
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_TTL = void 0;
const logger_1 = __importDefault(require("./logger"));
/**
 * Cache configuration constants
 */
const CACHE_CONFIG = {
    /** Default TTL in seconds (5 minutes) */
    DEFAULT_TTL: 300,
    /** Request timeout in milliseconds */
    REQUEST_TIMEOUT: 5000,
    /** Maximum retry attempts for failed requests */
    MAX_RETRIES: 2,
    /** Delay between retries in milliseconds */
    RETRY_DELAY: 100,
};
/**
 * TTL presets for different data types (in seconds)
 */
exports.CACHE_TTL = {
    /** Real-time stock quotes - refresh frequently */
    QUOTE: 30,
    /** Company profiles - rarely change */
    PROFILE: 3600,
    /** Search results - moderate caching */
    SEARCH: 300,
    /** Trending stocks list */
    TRENDING: 60,
    /** Market indices */
    MARKET_INDICES: 30,
    /** Historical candle data */
    CANDLES: 300,
    /** User portfolio data */
    PORTFOLIO: 15,
    /** User preferences/settings */
    USER_SETTINGS: 600,
};
/**
 * UpstashCache class providing distributed caching with fallback
 */
class UpstashCache {
    constructor() {
        this.healthCheckTimer = null;
        this.cleanupTimer = null;
        this.pendingPromises = new Map();
        this.restUrl = process.env.UPSTASH_REDIS_REST_URL;
        this.restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        this.memoryCache = new Map();
        this.isUpstashAvailable = !!(this.restUrl && this.restToken);
        this.lastHealthCheck = 0;
        if (!this.isUpstashAvailable) {
            logger_1.default.warn('Upstash Redis not configured - using in-memory cache only', {
                hasUrl: !!this.restUrl,
                hasToken: !!this.restToken,
            });
        }
        else {
            logger_1.default.info('Upstash Redis cache initialized');
        }
        // Periodic cleanup of expired memory cache entries
        // Only in non-serverless environments - Vercel functions are ephemeral
        // Store the interval reference for proper cleanup in tests/HMR
        if (process.env.VERCEL !== '1') {
            this.cleanupTimer = setInterval(() => this.cleanupMemoryCache(), 60000);
        }
    }
    /**
     * Execute an Upstash Redis command via REST API
     */
    async executeCommand(command) {
        if (!this.isUpstashAvailable || !this.restUrl || !this.restToken) {
            return null;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CACHE_CONFIG.REQUEST_TIMEOUT);
        try {
            const response = await fetch(`${this.restUrl}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.restToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(command),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Upstash request failed: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(`Upstash error: ${data.error}`);
            }
            return data.result;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    logger_1.default.warn('Upstash request timeout');
                }
                else {
                    logger_1.default.error('Upstash command failed', {
                        error: error.message,
                        command: command[0],
                    });
                }
            }
            // Mark Upstash as temporarily unavailable
            this.isUpstashAvailable = false;
            this.lastHealthCheck = Date.now();
            // Schedule health check to re-enable (clear existing timer to prevent leaks)
            if (this.healthCheckTimer) {
                clearTimeout(this.healthCheckTimer);
            }
            this.healthCheckTimer = setTimeout(() => this.checkUpstashHealth(), 30000);
            return null;
        }
    }
    /**
     * Check if Upstash is available and re-enable if recovered
     */
    async checkUpstashHealth() {
        if (!this.restUrl || !this.restToken)
            return;
        // Clear any existing health check timer
        if (this.healthCheckTimer) {
            clearTimeout(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        try {
            // Temporarily enable to perform health check
            // (executeCommand short-circuits when isUpstashAvailable is false)
            this.isUpstashAvailable = true;
            const result = await this.executeCommand(['PING']);
            if (result === 'PONG') {
                this.isUpstashAvailable = true;
                logger_1.default.info('Upstash Redis connection restored');
            }
            else {
                this.isUpstashAvailable = false;
                // Schedule another health check
                this.healthCheckTimer = setTimeout(() => this.checkUpstashHealth(), 30000);
            }
        }
        catch {
            this.isUpstashAvailable = false;
            // Schedule another health check
            this.healthCheckTimer = setTimeout(() => this.checkUpstashHealth(), 30000);
        }
    }
    /**
     * Clean up expired entries from memory cache
     */
    cleanupMemoryCache() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.expiry < now) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger_1.default.debug(`Cleaned ${cleaned} expired memory cache entries`);
        }
    }
    /**
     * Get a value from memory cache
     */
    getFromMemory(key) {
        const entry = this.memoryCache.get(key);
        if (!entry)
            return null;
        if (entry.expiry < Date.now()) {
            this.memoryCache.delete(key);
            return null;
        }
        return entry.value;
    }
    /**
     * Set a value in memory cache
     */
    setInMemory(key, value, ttlSeconds) {
        this.memoryCache.set(key, {
            value,
            expiry: Date.now() + (ttlSeconds * 1000),
        });
    }
    /**
     * Get a value from cache
     *
     * @param key - Cache key
     * @returns Cached value or null if not found/expired
     */
    async get(key) {
        // Try memory cache first (fastest)
        const memoryValue = this.getFromMemory(key);
        if (memoryValue !== null) {
            return memoryValue;
        }
        // Try Upstash if available
        if (this.isUpstashAvailable) {
            try {
                const result = await this.executeCommand(['GET', key]);
                if (result !== null) {
                    const parsed = JSON.parse(result);
                    // Cache in memory with fixed TTL to avoid extra network call
                    // Using 60s as safe default - eliminates latency from TTL query
                    this.setInMemory(key, parsed, 60);
                    return parsed;
                }
            }
            catch {
                logger_1.default.debug('Failed to parse cached value', { key });
            }
        }
        return null;
    }
    /**
     * Set a value in cache with TTL
     *
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttlSeconds - Time to live in seconds (default: 300)
     */
    async set(key, value, ttlSeconds = CACHE_CONFIG.DEFAULT_TTL) {
        let serialized;
        try {
            serialized = JSON.stringify(value);
        }
        catch (error) {
            // Handle circular references or unsupported types
            logger_1.default.warn('Failed to serialize cache value', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Still cache in memory even if serialization fails
            this.setInMemory(key, value, ttlSeconds);
            return;
        }
        // Always set in memory cache
        this.setInMemory(key, value, ttlSeconds);
        // Try to set in Upstash
        if (this.isUpstashAvailable) {
            await this.executeCommand(['SETEX', key, ttlSeconds.toString(), serialized]);
        }
    }
    /**
     * Delete a key from cache
     *
     * @param key - Cache key to delete
     */
    async del(key) {
        // Delete from memory
        this.memoryCache.delete(key);
        // Delete from Upstash
        if (this.isUpstashAvailable) {
            await this.executeCommand(['DEL', key]);
        }
    }
    /**
     * Delete multiple keys matching a pattern
     * Uses SCAN instead of KEYS to avoid blocking Redis
     *
     * @param pattern - Key pattern (e.g., 'user:*')
     */
    async invalidatePattern(pattern) {
        // Clear matching keys from memory cache
        // Escape regex special characters before converting wildcard to regex
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
            }
        }
        // For Upstash, use SCAN to avoid blocking (KEYS is an anti-pattern)
        if (this.isUpstashAvailable) {
            try {
                const keysToDelete = [];
                let cursor = '0';
                // SCAN iterates non-blockingly through keys
                do {
                    const result = await this.executeCommand(['SCAN', cursor, 'MATCH', pattern, 'COUNT', '100']);
                    if (result) {
                        cursor = result[0];
                        keysToDelete.push(...result[1]);
                    }
                    else {
                        break;
                    }
                } while (cursor !== '0');
                // Delete in batches to avoid large commands
                if (keysToDelete.length > 0) {
                    for (let i = 0; i < keysToDelete.length; i += 100) {
                        const batch = keysToDelete.slice(i, i + 100);
                        await this.executeCommand(['DEL', ...batch]);
                    }
                }
            }
            catch {
                logger_1.default.warn('Failed to invalidate cache pattern', { pattern });
            }
        }
    }
    /**
     * Check if a key exists in cache
     *
     * @param key - Cache key
     * @returns True if key exists and is not expired
     */
    async has(key) {
        // Check memory first
        if (this.getFromMemory(key) !== null) {
            return true;
        }
        // Check Upstash
        if (this.isUpstashAvailable) {
            const result = await this.executeCommand(['EXISTS', key]);
            return result === 1;
        }
        return false;
    }
    /**
     * Clear all cache entries
     * WARNING: FLUSHDB clears the entire Redis database
     * Only enable via UPSTASH_ALLOW_FLUSHDB=true if using dedicated cache instance
     */
    async clear() {
        this.memoryCache.clear();
        if (this.isUpstashAvailable) {
            // Safety check: only allow FLUSHDB if explicitly enabled
            if (process.env.UPSTASH_ALLOW_FLUSHDB === 'true') {
                await this.executeCommand(['FLUSHDB']);
            }
            else {
                logger_1.default.warn('FLUSHDB blocked - set UPSTASH_ALLOW_FLUSHDB=true to enable');
            }
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            memorySize: this.memoryCache.size,
            upstashAvailable: this.isUpstashAvailable,
            lastHealthCheck: this.lastHealthCheck,
        };
    }
    /**
     * Get or set pattern - fetch from cache or execute callback
     * Includes cache stampede protection via promise deduplication
     *
     * @param key - Cache key
     * @param ttlSeconds - TTL in seconds
     * @param callback - Function to execute if cache miss
     * @returns Cached or fresh value
     */
    async getOrSet(key, ttlSeconds, callback) {
        // Try cache first
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        // Check if there's already a pending request for this key (cache stampede protection)
        const pending = this.pendingPromises.get(key);
        if (pending) {
            return pending;
        }
        // Execute callback and cache result
        const promise = (async () => {
            try {
                const value = await callback();
                await this.set(key, value, ttlSeconds);
                return value;
            }
            finally {
                this.pendingPromises.delete(key);
            }
        })();
        this.pendingPromises.set(key, promise);
        return promise;
    }
}
// Export singleton instance
const upstashCache = new UpstashCache();
exports.default = upstashCache;
