import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on('error', (_err: Error) => {
      // Redis v3.x is incompatible with BullMQ (requires v5.0+).
      // The app works without Redis - queues are gracefully disabled in attendanceQueue.ts.
      // Suppress repetitive connection errors to keep server logs clean.
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
  }
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status === 'wait') {
    await client.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export async function acquireRedisLock(
  key: string,
  ttlMs: number,
): Promise<{ success: boolean; release: () => Promise<void> }> {
  const client = getRedisClient();
  const lockKey = `lock:${key}`;
  const result = await client.set(lockKey, '1', 'PX', ttlMs, 'NX');
  if (result === 'OK') {
    let released = false;
    return {
      success: true,
      release: async () => {
        if (released) return;
        released = true;
        await client.del(lockKey);
      },
    };
  }
  return { success: false, release: async () => {} };
}