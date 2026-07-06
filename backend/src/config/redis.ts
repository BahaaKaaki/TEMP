import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

// Redis client (optional - gracefully degrades if not available)
let redis: Redis | null = null;

export function getRedis(): Redis | null {
  return redis;
}

export async function initRedis(): Promise<void> {
  if (!env.REDIS_URL) {
    logger.warn('Redis URL not configured - running without Redis (sessions will be stateless)');
    return;
  }

  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    // Test connection
    await redis.ping();
    logger.info('Redis connection verified');
  } catch (error) {
    logger.warn('Redis connection failed - running without Redis:', error);
    redis = null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    logger.info('Redis connection closed');
  }
}

// Simple in-memory fallback for when Redis is not available
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

export const cache = {
  async get(key: string): Promise<string | null> {
    if (redis) {
      return redis.get(key);
    }
    // Memory fallback
    const item = memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (redis) {
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value);
      } else {
        await redis.set(key, value);
      }
      return;
    }
    // Memory fallback
    memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
    });
  },

  async del(key: string): Promise<void> {
    if (redis) {
      await redis.del(key);
      return;
    }
    memoryStore.delete(key);
  },

  async exists(key: string): Promise<boolean> {
    if (redis) {
      return (await redis.exists(key)) === 1;
    }
    return memoryStore.has(key);
  },
};
