import * as appInsights from 'applicationinsights';

const aiConnStr = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
if (aiConnStr) {
  appInsights.setup(aiConnStr)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .start();
}

import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { checkDatabaseHealth, closeDatabasePool } from './config/database';
import { initRedis, closeRedis } from './config/redis';

async function main() {
  try {
    // Initialize Redis (optional)
    await initRedis();

    // Check database connection
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      logger.error('Database connection failed');
      process.exit(1);
    }
    logger.info('Database connection verified');

    // Start server
    const server = app.listen(env.PORT, () => {
      logger.info(`Server started on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`API URL: ${env.API_URL}`);
      logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await closeRedis();
          await closeDatabasePool();
          logger.info('All connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
