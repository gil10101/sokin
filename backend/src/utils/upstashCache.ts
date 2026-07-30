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

import logger from './logger';

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
export const CACHE_TTL = {
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
 * In-memory cache entry interface
 */
interface MemoryCacheEntry<T> {
  value: T;
  expiry: number;
}

/**
 * Upstash Redis response interface
 */
interface UpstashResponse<T = unknown> {
  result: T;
  error?: string;
}

/**
 * UpstashCache class providing distributed caching with fallback
 */
class UpstashCache {
  private readonly restUrl: string | undefined;
  private readonly restToken: string | undefined;
  private readonly memoryCache: Map<string, MemoryCacheEntry<unknown>>;
  private isUpstashAvailable: boolean;
  private lastHealthCheck: number;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly pendingPromises = new Map<string, Promise<unknown>>();

  constructor() {
    this.restUrl = process.env.UPSTASH_REDIS_REST_URL;
    this.restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    this.memoryCache = new Map();
    this.isUpstashAvailable = !!(this.restUrl && this.restToken);
    this.lastHealthCheck = 0;

    if (!this.isUpstashAvailable) {
      logger.warn('Upstash Redis not configured - using in-memory cache only', {
        hasUrl: !!this.restUrl,
        hasToken: !!this.restToken,
      });
    } else {
      logger.info('Upstash Redis cache initialized');
    }

    // Periodic cleanup of expired memory cache entries
    // Only in non-serverless environments - Vercel functions are ephemeral
    // Store the interval reference for proper cleanup in tests/HMR
    if (process.env.VERCEL !== '1') {
      this.cleanupTimer = setInterval(() => this.cleanupMemoryCache(), 60000);
    }
  }

  /**
   * Whether Upstash is currently reachable. Callers can use this to
   * distinguish "cache miss" from "cache down" (fail-closed decisions).
   */
  isAvailable(): boolean {
    return this.isUpstashAvailable;
  }

  /**
   * In serverless there are no long-lived timers, so recovery from an
   * Upstash outage happens lazily: after 30s of being marked down, the next
   * command is allowed to try again.
   */
  private maybeLazyReprobe(): void {
    if (
      !this.isUpstashAvailable &&
      this.restUrl &&
      this.restToken &&
      Date.now() - this.lastHealthCheck >= 30000
    ) {
      this.isUpstashAvailable = true;
      this.lastHealthCheck = Date.now();
    }
  }

  /**
   * Execute an Upstash Redis command via REST API
   */
  private async executeCommand<T>(command: string[]): Promise<T | null> {
    this.maybeLazyReprobe();
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

      const data: UpstashResponse<T> = await response.json();

      if (data.error) {
        throw new Error(`Upstash error: ${data.error}`);
      }

      return data.result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.warn('Upstash request timeout');
        } else {
          logger.error('Upstash command failed', { 
            error: error.message,
            command: command[0],
          });
        }
      }

      // Mark Upstash as temporarily unavailable
      this.isUpstashAvailable = false;
      this.lastHealthCheck = Date.now();

      // Long-running processes probe on a timer; serverless instances rely on
      // the lazy re-probe in executeCommand (a pending timer would keep the
      // function instance from freezing cleanly).
      if (process.env.VERCEL !== '1') {
        if (this.healthCheckTimer) {
          clearTimeout(this.healthCheckTimer);
        }
        this.healthCheckTimer = setTimeout(() => this.checkUpstashHealth(), 30000);
      }

      return null;
    }
  }

  /**
   * Execute several commands atomically-ish in one round trip via the
   * Upstash REST pipeline endpoint. Returns per-command results, or null
   * when Upstash is unreachable.
   */
  private async executePipeline(commands: string[][]): Promise<Array<UpstashResponse> | null> {
    this.maybeLazyReprobe();
    if (!this.isUpstashAvailable || !this.restUrl || !this.restToken) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CACHE_CONFIG.REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${this.restUrl}/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Upstash pipeline failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as Array<UpstashResponse>;
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error('Upstash pipeline failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.isUpstashAvailable = false;
      this.lastHealthCheck = Date.now();
      if (process.env.VERCEL !== '1') {
        if (this.healthCheckTimer) {
          clearTimeout(this.healthCheckTimer);
        }
        this.healthCheckTimer = setTimeout(() => this.checkUpstashHealth(), 30000);
      }
      return null;
    }
  }

  /**
   * Atomic fixed-window rate-limit increment.
   *
   * INCR + EXPIRE NX + PTTL in a single pipeline round trip, so every
   * serverless instance shares one authoritative counter per key. Returns
   * the post-increment count and the window's remaining time, or null when
   * Upstash is unreachable (caller decides the fallback policy).
   */
  async rateLimitIncrement(
    key: string,
    windowSeconds: number
  ): Promise<{ count: number; remainingMs: number } | null> {
    const results = await this.executePipeline([
      ['INCR', key],
      ['EXPIRE', key, windowSeconds.toString(), 'NX'],
      ['PTTL', key],
    ]);

    if (!results || results.length !== 3) return null;
    if (results.some(r => r.error)) {
      logger.warn('Rate limit pipeline returned an error', {
        errors: results.map(r => r.error).filter(Boolean),
      });
      return null;
    }

    const count = Number(results[0].result);
    let remainingMs = Number(results[2].result);
    if (!Number.isFinite(count)) return null;
    // PTTL returns -1 for keys without expiry (e.g. EXPIRE NX raced) — heal it
    if (!Number.isFinite(remainingMs) || remainingMs < 0) {
      await this.executeCommand(['EXPIRE', key, windowSeconds.toString()]);
      remainingMs = windowSeconds * 1000;
    }

    return { count, remainingMs };
  }

  /**
   * Check if Upstash is available and re-enable if recovered
   */
  private async checkUpstashHealth(): Promise<void> {
    if (!this.restUrl || !this.restToken) return;

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
        logger.info('Upstash Redis connection restored');
      } else {
        this.isUpstashAvailable = false;
        // Schedule another health check
        this.healthCheckTimer = setTimeout(() => this.checkUpstashHealth(), 30000);
      }
    } catch {
      this.isUpstashAvailable = false;
      // Schedule another health check
      this.healthCheckTimer = setTimeout(() => this.checkUpstashHealth(), 30000);
    }
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiry < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired memory cache entries`);
    }
  }

  /**
   * Get a value from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key) as MemoryCacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    if (entry.expiry < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Set a value in memory cache
   */
  private setInMemory<T>(key: string, value: T, ttlSeconds: number): void {
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
  async get<T>(key: string, backfillTtlSeconds: number = 2): Promise<T | null> {
    // Try memory cache first (fastest)
    const memoryValue = this.getFromMemory<T>(key);
    if (memoryValue !== null) {
      return memoryValue;
    }

    // Try Upstash (executeCommand handles availability + lazy re-probe)
    try {
      const result = await this.executeCommand<string>(['GET', key]);

      if (result !== null) {
        const parsed = JSON.parse(result) as T;

        // Short memory backfill only: a long TTL here would make
        // cross-instance invalidation (DEL from another function instance)
        // invisible until the local copy expired.
        this.setInMemory(key, parsed, backfillTtlSeconds);

        return parsed;
      }
    } catch {
      logger.debug('Failed to parse cached value', { key });
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
  async set<T>(key: string, value: T, ttlSeconds: number = CACHE_CONFIG.DEFAULT_TTL): Promise<void> {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      // Handle circular references or unsupported types
      logger.warn('Failed to serialize cache value', { 
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
  async del(key: string): Promise<void> {
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
  async invalidatePattern(pattern: string): Promise<void> {
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
        const keysToDelete: string[] = [];
        let cursor = '0';
        
        // SCAN iterates non-blockingly through keys
        do {
          const result = await this.executeCommand<[string, string[]]>(['SCAN', cursor, 'MATCH', pattern, 'COUNT', '100']);
          if (result) {
            cursor = result[0];
            keysToDelete.push(...result[1]);
          } else {
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
      } catch {
        logger.warn('Failed to invalidate cache pattern', { pattern });
      }
    }
  }

  /**
   * Check if a key exists in cache
   * 
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    // Check memory first
    if (this.getFromMemory(key) !== null) {
      return true;
    }

    // Check Upstash
    if (this.isUpstashAvailable) {
      const result = await this.executeCommand<number>(['EXISTS', key]);
      return result === 1;
    }

    return false;
  }

  /**
   * Clear all cache entries
   * WARNING: FLUSHDB clears the entire Redis database
   * Only enable via UPSTASH_ALLOW_FLUSHDB=true if using dedicated cache instance
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.isUpstashAvailable) {
      // Safety check: only allow FLUSHDB if explicitly enabled
      if (process.env.UPSTASH_ALLOW_FLUSHDB === 'true') {
        await this.executeCommand(['FLUSHDB']);
      } else {
        logger.warn('FLUSHDB blocked - set UPSTASH_ALLOW_FLUSHDB=true to enable');
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    upstashAvailable: boolean;
    lastHealthCheck: number;
  } {
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
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    callback: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if there's already a pending request for this key (cache stampede protection)
    const pending = this.pendingPromises.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    // Execute callback and cache result
    const promise = (async () => {
      try {
        const value = await callback();
        await this.set(key, value, ttlSeconds);
        return value;
      } finally {
        this.pendingPromises.delete(key);
      }
    })();
    
    this.pendingPromises.set(key, promise);
    return promise;
  }
}

// Export singleton instance
const upstashCache = new UpstashCache();
export default upstashCache;

