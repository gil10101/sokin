/**
 * Distributed cache facade over Upstash Redis.
 *
 * The single in-memory tier lives inside upstashCache (short backfill TTL so
 * cross-instance invalidation stays visible); this module adds the app's TTL
 * presets and the async API controllers use.
 */

import upstashCache from './upstashCache';

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
  PORTFOLIO: 60,
  /** User settings - infrequently updated */
  USER_SETTINGS: 600,
  /** Stock quotes - real-time */
  STOCK_QUOTE: 30,
  /** Company profiles - rarely change */
  COMPANY_PROFILE: 3600,
} as const;

class Cache {
  /**
   * Get a value from the distributed cache
   */
  async getAsync<T>(key: string): Promise<T | null> {
    return upstashCache.get<T>(key);
  }

  /**
   * Set a value in the distributed cache
   */
  async setAsync<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
    await upstashCache.set(key, value, ttlSeconds);
  }

  /**
   * Delete a key from the distributed cache
   */
  async delAsync(key: string): Promise<void> {
    await upstashCache.del(key);
  }

  /**
   * Delete all keys matching a pattern (e.g. 'expenses:123:*')
   */
  async invalidatePatternAsync(pattern: string): Promise<void> {
    await upstashCache.invalidatePattern(pattern);
  }

  /**
   * @deprecated Use invalidatePatternAsync — kept as an alias for callers
   */
  invalidatePattern(pattern: string): Promise<void> {
    return this.invalidatePatternAsync(pattern);
  }

  /**
   * Cache-aside helper with stampede protection: concurrent misses for the
   * same key share one callback execution.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    callback: () => Promise<T>
  ): Promise<T> {
    return upstashCache.getOrSet(key, ttlSeconds, callback);
  }

  /**
   * Cache statistics (for health/debug endpoints)
   */
  getStats(): ReturnType<typeof upstashCache.getStats> {
    return upstashCache.getStats();
  }
}

// Export singleton instance
const cache = new Cache();
export default cache;
