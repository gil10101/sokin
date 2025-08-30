import logger from './logger'

type RedisClient = {
  get: (key: string) => Promise<string | null>
  setex: (key: string, ttl: number, value: string) => Promise<void>
  del: (key: string) => Promise<void>
  keys: (pattern: string) => Promise<string[]>
}

let client: RedisClient | null = null

function ensureClient(): RedisClient | null {
  if (client !== null) return client
  const url = process.env.REDIS_URL
  if (!url) {
    logger.warn('REDIS_URL not set; Redis caching disabled')
    return null
  }
  try {
    // Lazy require to avoid hard dependency when not used
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis')
    client = new Redis(url)
    return client
  } catch (e) {
    logger.warn('ioredis not installed; Redis caching disabled')
    return null
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const c = ensureClient()
  if (!c) return null
  try {
    const raw = await c.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (e) {
    logger.error('Redis get error', { error: (e as Error).message })
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const c = ensureClient()
  if (!c) return
  try {
    await c.setex(key, ttlSeconds, JSON.stringify(value))
  } catch (e) {
    logger.error('Redis set error', { error: (e as Error).message })
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const c = ensureClient()
  if (!c) return
  try {
    const keys = await c.keys(pattern)
    if (keys.length) {
      await Promise.all(keys.map((k) => c!.del(k)))
    }
  } catch (e) {
    logger.error('Redis invalidate error', { error: (e as Error).message })
  }
}


