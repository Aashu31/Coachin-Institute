import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool, pool } from './db/pool.js';
import { closeQueues } from './queues/attendanceQueue.js';
import { disconnectRedis } from './queues/redis.js';
import { logger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  await pool.query('SELECT 1');

  // Initialize Redis and queues (non-blocking for demo without Redis)
  let redisAvailable = false;
  try {
    const { connectRedis } = await import('./queues/redis.js');
    await connectRedis();
    redisAvailable = true;
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.warn('Redis not available - BullMQ queues disabled', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const { httpServer } = createApp();

  httpServer.listen(env.PORT, () => {
    logger.info('P.D.O Classes API is listening', {
      url: `http://localhost:${env.PORT}`,
      environment: env.NODE_ENV,
      timezone: env.APP_TIMEZONE,
      redis: redisAvailable ? 'connected' : 'unavailable (queues disabled)',
    });
  });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info('Shutting down API', { signal });

    const forceExitTimer = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000);
    forceExitTimer.unref();

    try {
      if (redisAvailable) {
        await closeQueues();
        await disconnectRedis();
      }
      await closePool();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Failed to close resources', {
        message: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

bootstrap().catch((error: unknown) => {
  logger.error('API failed to start', {
    message: error instanceof Error ? error.message : String(error),
    stack: env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
