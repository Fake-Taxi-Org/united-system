import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || process.env.REDIS_INTERNAL_URL || 'redis://localhost:6379';

// Strip the redis:// scheme for logging since Node's URL puts port on host for non-http schemes.
const hostMatch = redisUrl.match(/^redis:\/\/(?:[^@]+@)?([^:/]+)(?::(\d+))?/);
const logHost = hostMatch ? hostMatch[1] + (hostMatch[2] ? `:${hostMatch[2]}` : '') : 'unknown';
console.log(`[CACHE] Using Redis at ${logHost}`);

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      console.warn('[CACHE] Redis connection failed, caching disabled');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
});

redis.on('error', (err) => {
  console.warn('[CACHE] Redis error:', err.message);
});

redis.on('connect', () => {
  console.log('[CACHE] Redis connected successfully');
});

redis.on('ready', () => {
  console.log('[CACHE] Redis ready for commands');
});

export interface CacheOptions {
  ttl?: number;
}

export const cacheService = {
  async connect(): Promise<boolean> {
    try {
      await redis.connect();
      return true;
    } catch (error) {
      console.warn('[CACHE] Connection failed:', error instanceof Error ? error.message : 'Unknown');
      return false;
    }
  },

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('[CACHE] Get error:', error instanceof Error ? error.message : 'Unknown');
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<boolean> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[CACHE] Set error:', error instanceof Error ? error.message : 'Unknown');
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.warn('[CACHE] Del error:', error instanceof Error ? error.message : 'Unknown');
      return false;
    }
  },

  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        return await redis.del(...keys);
      }
      return 0;
    } catch (error) {
      console.warn('[CACHE] DelPattern error:', error instanceof Error ? error.message : 'Unknown');
      return 0;
    }
  },

  async isConnected(): Promise<boolean> {
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  },
};

export default cacheService;