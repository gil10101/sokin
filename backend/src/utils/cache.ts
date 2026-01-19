/**
 * Cache wrapper with Upstash + memory fallback.
 * Use async methods in serverless environments.
 */

import upstashCache from './upstashCache';
import logger from './logger';

/**
 * Cache item interface for in-memory storage
 */
interface CacheItem<T> {
  value: T;
  expiry: number;
}

/**
 * Cache TTL presets for different data types (in seconds)
 */
export const CACHE_TTL = {
  /** Single item lookups - short lived */
  SINGLE_ITEM: 30,
  /** List queries - short lived */
  LIST_QUERY: 30,
  /** Dashboard aggregations - longer lived */
  DASHBOARD: 600,
  /** User portfolio data - frequently updated */
  PORTFOLIO: 15,
  /** User settings - infrequently updated */
  USER_SETTINGS: 600,
  /** Stock quotes - real-time */
  STOCK_QUOTE: 30,
  /** Company profiles - rarely change */
  COMPANY_PROFILE: 3600,
} as const;

/**
 * Unified Cache class providing both sync and async interfaces
 */
class Cache {
  private memoryCache: Map<string, CacheItem<unknown>>;
  private defaultTtl: number;

  constructor(defaultTtlSeconds: number = 60) {
    this.memoryCache = new Map();
    this.defaultTtl = defaultTtlSeconds * 1000; // Convert to milliseconds
    
    // Set up periodic cleanup only in non-serverless environments
    // In serverless (Vercel), function instances are ephemeral and setInterval
    // would either never run or cause memory leaks across cold starts
    if (typeof setInterval !== 'undefined' && process.env.VERCEL !== '1') {
      setInterval(() => this.cleanup(), 60000); // Clean up every minute
    }
  }

  // Sync (memory only, legacy).

  /**
   * Set a value in the in-memory cache (synchronous)
   * @deprecated Use setAsync for distributed caching in serverless environments
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const expiry = Date.now() + (ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl);
    this.memoryCache.set(key, { value, expiry });
    
    // Also set in Upstash asynchronously (fire and forget)
    upstashCache.set(key, value, ttlSeconds || Math.floor(this.defaultTtl / 1000))
      .catch(err => logger.debug('Async cache set failed', { key, error: err?.message }));
  }

  /**
   * Get a value from the in-memory cache (synchronous)
   * @deprecated Use getAsync for distributed caching in serverless environments
   */
  get<T>(key: string): T | null {
    const item = this.memoryCache.get(key) as CacheItem<T> | undefined;
    
    if (!item) {
      return null;
    }
    
    // Check if the item has expired
    if (item.expiry < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Check if a key exists and is not expired (synchronous)
   * @deprecated Use hasAsync for distributed caching in serverless environments
   */
  has(key: string): boolean {
    const item = this.memoryCache.get(key);
    
    if (!item) {
      return false;
    }
    
    if (item.expiry < Date.now()) {
      this.memoryCache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a key from cache (synchronous)
   * @deprecated Use delAsync for distributed caching in serverless environments
   */
  del(key: string): void {
    this.memoryCache.delete(key);
    
    // Also delete from Upstash asynchronously
    upstashCache.del(key)
      .catch(err => logger.debug('Async cache delete failed', { key, error: err?.message }));
  }

  /**
   * Clear all in-memory cache entries
   */
  clear(): void {
    this.memoryCache.clear();
    
    // Also clear Upstash asynchronously
    upstashCache.clear()
      .catch(err => logger.debug('Async cache clear failed', { error: err?.message }));
  }

  /**
   * Delete keys matching a pattern (synchronous memory + async Upstash)
   * @deprecated Use invalidatePatternAsync for consistent distributed behavior
   */
  invalidatePattern(pattern: string): Promise<void> {
    return this.invalidatePatternAsync(pattern);
  }

  // Async (distributed).

  /**
   * Set a value in the distributed cache (asynchronous)
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   */
  async setAsync<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || Math.floor(this.defaultTtl / 1000);
    
    // Set in both memory and Upstash
    const expiry = Date.now() + (ttl * 1000);
    this.memoryCache.set(key, { value, expiry });
    
    await upstashCache.set(key, value, ttl);
  }

  /**
   * Get a value from the distributed cache (asynchronous)
   * First checks memory, then Upstash
   * 
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  async getAsync<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryItem = this.memoryCache.get(key) as CacheItem<T> | undefined;
    
    if (memoryItem && memoryItem.expiry >= Date.now()) {
      return memoryItem.value;
    }
    
    // If not in memory, try Upstash
    const upstashValue = await upstashCache.get<T>(key);
    
    if (upstashValue !== null) {
      // Cache in memory with minimal TTL to minimize staleness window
      // Very short backfill prevents serving stale data after Upstash expiry
      this.memoryCache.set(key, { 
        value: upstashValue, 
        expiry: Date.now() + 2000 // 2 seconds - minimal backfill TTL
      });
    }
    
    return upstashValue;
  }

  /**
   * Check if a key exists in the distributed cache (asynchronous)
   * 
   * @param key - Cache key
   * @returns True if key exists
   */
  async hasAsync(key: string): Promise<boolean> {
    // Check memory first
    if (this.has(key)) {
      return true;
    }
    
    // Check Upstash
    return await upstashCache.has(key);
  }

  /**
   * Delete a key from the distributed cache (asynchronous)
   * 
   * @param key - Cache key to delete
   */
  async delAsync(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await upstashCache.del(key);
  }

  /**
   * Delete all keys matching a pattern (asynchronous)
   * 
   * @param pattern - Key pattern (e.g., 'user:123:*')
   */
  async invalidatePatternAsync(pattern: string): Promise<void> {
    // Clear matching keys from memory cache
    // Escape regex metacharacters before converting wildcard to regex
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
    
    // Clear from Upstash
    await upstashCache.invalidatePattern(pattern);
  }

  /**
   * Get or set pattern - fetch from cache or execute callback (asynchronous)
   * 
   * This is the recommended pattern for cache-aside loading.
   * 
   * @param key - Cache key
   * @param ttlSeconds - TTL in seconds
   * @param callback - Function to execute if cache miss
   * @returns Cached or fresh value
   * 
   * @example
   * ```typescript
   * const expenses = await cache.getOrSet(
   *   `expenses:${userId}`,
   *   30,
   *   async () => fetchExpensesFromDb(userId)
   * );
   * ```
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    callback: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cached = await this.getAsync<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute callback and cache result
    const value = await callback();
    await this.setAsync(key, value, ttlSeconds);
    return value;
  }

  /**
   * Get or set with stale-while-revalidate pattern
   * 
   * Returns cached data immediately if available (even if stale),
   * and triggers a background refresh if data is older than softTtl.
   * 
   * @param key - Cache key
   * @param softTtlSeconds - TTL after which background refresh is triggered
   * @param hardTtlSeconds - TTL after which data is considered expired
   * @param callback - Function to execute for fresh data
   * @returns Cached or fresh value
   */
  async getOrSetStale<T>(
    key: string,
    softTtlSeconds: number,
    hardTtlSeconds: number,
    callback: () => Promise<T>
  ): Promise<T> {
    const cacheKey = key;
    const metaKey = `${key}:meta`;
    
    // Check memory cache first
    const memoryItem = this.memoryCache.get(cacheKey) as CacheItem<T> | undefined;
    const metaItem = this.memoryCache.get(metaKey) as CacheItem<{ cachedAt: number }> | undefined;
    
    const now = Date.now();
    
    if (memoryItem && memoryItem.expiry >= now) {
      // Check if we should trigger background refresh
      if (metaItem) {
        const age = (now - metaItem.value.cachedAt) / 1000;
        if (age > softTtlSeconds) {
          // Trigger background refresh
          this.backgroundRefresh(cacheKey, metaKey, hardTtlSeconds, callback);
        }
      }
      return memoryItem.value;
    }
    
    // Try Upstash
    const [upstashValue, upstashMeta] = await Promise.all([
      upstashCache.get<T>(cacheKey),
      upstashCache.get<{ cachedAt: number }>(metaKey)
    ]);
    
    if (upstashValue !== null) {
      // Populate memory cache
      this.memoryCache.set(cacheKey, { 
        value: upstashValue, 
        expiry: now + (hardTtlSeconds * 1000)
      });
      
      if (upstashMeta) {
        this.memoryCache.set(metaKey, {
          value: upstashMeta,
          expiry: now + (hardTtlSeconds * 1000)
        });
        
        const age = (now - upstashMeta.cachedAt) / 1000;
        if (age > softTtlSeconds) {
          this.backgroundRefresh(cacheKey, metaKey, hardTtlSeconds, callback);
        }
      }
      
      return upstashValue;
    }
    
    // Cache miss - fetch fresh data
    const value = await callback();
    const cachedAt = Date.now();
    
    // Store with metadata
    await Promise.all([
      this.setAsync(cacheKey, value, hardTtlSeconds),
      this.setAsync(metaKey, { cachedAt }, hardTtlSeconds)
    ]);
    
    return value;
  }

  /**
   * Background refresh helper (fire and forget)
   */
  private backgroundRefresh<T>(
    cacheKey: string,
    metaKey: string,
    ttlSeconds: number,
    callback: () => Promise<T>
  ): void {
    // Fire and forget
    callback()
      .then(async (value) => {
        await Promise.all([
          this.setAsync(cacheKey, value, ttlSeconds),
          this.setAsync(metaKey, { cachedAt: Date.now() }, ttlSeconds)
        ]);
        logger.debug('Background cache refresh completed', { key: cacheKey });
      })
      .catch(err => {
        logger.debug('Background cache refresh failed', { key: cacheKey, error: err?.message });
      });
  }

  // ============================================
  // Internal Methods
  // ============================================

  /**
   * Remove all expired items from the in-memory cache
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiry < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired memory cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    upstashStats: ReturnType<typeof upstashCache.getStats>;
  } {
    return {
      memorySize: this.memoryCache.size,
      upstashStats: upstashCache.getStats(),
    };
  }
}

// Export singleton instance
const cache = new Cache();
export default cache;
