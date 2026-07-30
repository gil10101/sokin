/**
 * Redis/Upstash Mock
 * 
 * Mocks Upstash Redis REST API for testing caching functionality
 * without requiring actual Redis connectivity.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// In-memory cache store for mock
const mockCacheStore = new Map<string, { value: string; expiry: number | null }>();

// Mock Upstash Redis REST client
export const mockUpstashClient = {
  get: jest.fn(async (key: string): Promise<string | null> => {
    const entry = mockCacheStore.get(key);
    if (!entry) return null;
    
    // Check expiry
    if (entry.expiry && Date.now() > entry.expiry) {
      mockCacheStore.delete(key);
      return null;
    }
    
    return entry.value;
  }),
  
  set: jest.fn(async (_key: string, _value: string): Promise<string> => {
    mockCacheStore.set(_key, { value: _value, expiry: null });
    return 'OK';
  }),
  
  setex: jest.fn(async (key: string, ttl: number, value: string): Promise<string> => {
    mockCacheStore.set(key, { 
      value, 
      expiry: Date.now() + (ttl * 1000) 
    });
    return 'OK';
  }),
  
  del: jest.fn(async (key: string): Promise<number> => {
    const existed = mockCacheStore.has(key);
    mockCacheStore.delete(key);
    return existed ? 1 : 0;
  }),
  
  keys: jest.fn(async (pattern: string): Promise<string[]> => {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(mockCacheStore.keys()).filter(key => regex.test(key));
  }),
  
  exists: jest.fn(async (key: string): Promise<number> => {
    const entry = mockCacheStore.get(key);
    if (!entry) return 0;
    
    if (entry.expiry && Date.now() > entry.expiry) {
      mockCacheStore.delete(key);
      return 0;
    }
    
    return 1;
  }),
  
  ttl: jest.fn(async (key: string): Promise<number> => {
    const entry = mockCacheStore.get(key);
    if (!entry) return -2; // Key doesn't exist
    if (!entry.expiry) return -1; // No expiry
    
    const remaining = Math.floor((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }),
  
  expire: jest.fn(async (key: string, seconds: number): Promise<number> => {
    const entry = mockCacheStore.get(key);
    if (!entry) return 0;
    
    entry.expiry = Date.now() + (seconds * 1000);
    return 1;
  }),
  
  mget: jest.fn(async (...keys: string[]): Promise<(string | null)[]> => {
    return keys.map(key => {
      const entry = mockCacheStore.get(key);
      if (!entry) return null;
      
      if (entry.expiry && Date.now() > entry.expiry) {
        mockCacheStore.delete(key);
        return null;
      }
      
      return entry.value;
    });
  }),
  
  mset: jest.fn(async (pairs: Record<string, string>): Promise<string> => {
    Object.entries(pairs).forEach(([key, value]) => {
      mockCacheStore.set(key, { value, expiry: null });
    });
    return 'OK';
  }),
  
  incr: jest.fn(async (key: string): Promise<number> => {
    const entry = mockCacheStore.get(key);
    const currentValue = entry ? parseInt(entry.value, 10) : 0;
    const newValue = currentValue + 1;
    mockCacheStore.set(key, { value: newValue.toString(), expiry: entry?.expiry ?? null });
    return newValue;
  }),
  
  decr: jest.fn(async (key: string): Promise<number> => {
    const entry = mockCacheStore.get(key);
    const currentValue = entry ? parseInt(entry.value, 10) : 0;
    const newValue = currentValue - 1;
    mockCacheStore.set(key, { value: newValue.toString(), expiry: entry?.expiry ?? null });
    return newValue;
  }),
  
  flushall: jest.fn(async (): Promise<string> => {
    mockCacheStore.clear();
    return 'OK';
  }),
};

// Mock fetch for Upstash REST API
export const mockUpstashFetch = jest.fn(async (url: string, options: RequestInit): Promise<{ ok: boolean; status: number; json: () => Promise<{ result: unknown }> }> => {
  const body = options.body ? JSON.parse(options.body as string) : null;
  const command = body?.[0]?.toUpperCase();
  
  let result: unknown = null;
  
  switch (command) {
    case 'GET':
      result = await mockUpstashClient.get(body[1]);
      break;
    case 'SET':
      result = await mockUpstashClient.set(body[1], body[2]);
      break;
    case 'SETEX':
      result = await mockUpstashClient.setex(body[1], body[2], body[3]);
      break;
    case 'DEL':
      result = await mockUpstashClient.del(body[1]);
      break;
    case 'KEYS':
      result = await mockUpstashClient.keys(body[1]);
      break;
    case 'EXISTS':
      result = await mockUpstashClient.exists(body[1]);
      break;
    case 'TTL':
      result = await mockUpstashClient.ttl(body[1]);
      break;
    case 'EXPIRE':
      result = await mockUpstashClient.expire(body[1], body[2]);
      break;
    default:
      result = null;
  }
  
  return {
    ok: true,
    status: 200,
    json: async () => ({ result }),
  };
});

// Helper to set cache entry directly
export const setCacheEntry = (key: string, value: unknown, ttlSeconds?: number): void => {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  mockCacheStore.set(key, {
    value: stringValue,
    expiry: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null,
  });
};

// Helper to get cache entry directly
export const getCacheEntry = (key: string): unknown | null => {
  const entry = mockCacheStore.get(key);
  if (!entry) return null;
  
  if (entry.expiry && Date.now() > entry.expiry) {
    mockCacheStore.delete(key);
    return null;
  }
  
  try {
    return JSON.parse(entry.value);
  } catch {
    return entry.value;
  }
};

// Helper to clear cache store
export const clearCacheStore = (): void => {
  mockCacheStore.clear();
};

// Reset all mocks
export const resetRedisMocks = (): void => {
  Object.values(mockUpstashClient).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as jest.Mock).mockClear();
    }
  });
  mockUpstashFetch.mockClear();
  clearCacheStore();
};

// Get current cache size
export const getCacheSize = (): number => mockCacheStore.size;

// Get all cache keys
export const getCacheKeys = (): string[] => Array.from(mockCacheStore.keys());

export default {
  mockUpstashClient,
  mockUpstashFetch,
  setCacheEntry,
  getCacheEntry,
  clearCacheStore,
  resetRedisMocks,
  getCacheSize,
  getCacheKeys,
};
