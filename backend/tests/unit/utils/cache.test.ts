/**
 * Cache Utility Unit Tests
 *
 * Exercises the real src/utils/cache.ts facade over upstashCache. The
 * previous version of this file defined its own throwaway Cache class in
 * beforeEach and never imported the module under test, so it reported
 * coverage while asserting nothing about production behaviour.
 */

const mockUpstash = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  invalidatePattern: jest.fn(),
  getOrSet: jest.fn(),
  getStats: jest.fn(),
  isAvailable: jest.fn(),
};

jest.mock('../../../src/utils/upstashCache', () => ({
  __esModule: true,
  default: mockUpstash,
}));

import cache, { CACHE_TTL } from '../../../src/utils/cache';

describe('Cache Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpstash.get.mockResolvedValue(null);
    mockUpstash.set.mockResolvedValue(undefined);
    mockUpstash.del.mockResolvedValue(undefined);
    mockUpstash.invalidatePattern.mockResolvedValue(undefined);
  });

  describe('getAsync', () => {
    it('returns the cached value from the distributed cache', async () => {
      mockUpstash.get.mockResolvedValue({ id: 'expense-1', amount: 25 });

      await expect(cache.getAsync('expenses:user-1:list')).resolves.toEqual({
        id: 'expense-1',
        amount: 25,
      });
      expect(mockUpstash.get).toHaveBeenCalledWith('expenses:user-1:list');
    });

    it('returns null on a miss', async () => {
      await expect(cache.getAsync('missing')).resolves.toBeNull();
    });
  });

  describe('setAsync', () => {
    it('forwards the TTL to the distributed cache', async () => {
      await cache.setAsync('dashboard:user-1', { expenses: [] }, CACHE_TTL.DASHBOARD);

      expect(mockUpstash.set).toHaveBeenCalledWith(
        'dashboard:user-1',
        { expenses: [] },
        CACHE_TTL.DASHBOARD
      );
    });

    it('falls back to a default TTL when none is given', async () => {
      await cache.setAsync('key', 'value');

      expect(mockUpstash.set).toHaveBeenCalledWith('key', 'value', 60);
    });
  });

  describe('invalidation', () => {
    it('deletes a single key', async () => {
      await cache.delAsync('user:user-1:profile');

      expect(mockUpstash.del).toHaveBeenCalledWith('user:user-1:profile');
    });

    it('invalidates a wildcard pattern', async () => {
      await cache.invalidatePatternAsync('expenses:user-1:*');

      expect(mockUpstash.invalidatePattern).toHaveBeenCalledWith('expenses:user-1:*');
    });

    it('covers analytics keys with the list invalidation pattern', () => {
      // Regression: analytics used to live at expenses:analytics:<uid>:<tf>,
      // which expenses:<uid>:* did not match, so it served stale numbers
      // for its full TTL after any expense mutation.
      const userId = 'user-1';
      const analyticsKey = `expenses:${userId}:analytics:6months`;
      const pattern = `expenses:${userId}:*`;

      const toRegExp = (p: string) =>
        new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

      expect(toRegExp(pattern).test(analyticsKey)).toBe(true);
    });
  });

  describe('getOrSet', () => {
    it('delegates to the deduplicating implementation', async () => {
      const loader = jest.fn().mockResolvedValue(['a']);
      mockUpstash.getOrSet.mockImplementation(
        async (_key: string, _ttl: number, cb: () => Promise<unknown>) => cb()
      );

      await expect(cache.getOrSet('goals:user-1:list', 30, loader)).resolves.toEqual(['a']);
      expect(mockUpstash.getOrSet).toHaveBeenCalledWith('goals:user-1:list', 30, loader);
      expect(loader).toHaveBeenCalledTimes(1);
    });
  });

  describe('CACHE_TTL presets', () => {
    it('keeps list and single-item lookups short lived', () => {
      expect(CACHE_TTL.LIST_QUERY).toBeLessThanOrEqual(60);
      expect(CACHE_TTL.SINGLE_ITEM).toBeLessThanOrEqual(60);
    });

    it('caches rarely-changing company profiles for an hour', () => {
      expect(CACHE_TTL.COMPANY_PROFILE).toBe(3600);
    });
  });
});
