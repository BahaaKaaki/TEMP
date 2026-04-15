import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { checkDatabaseHealth, closeDatabasePool } from './config/database';
import { initRedis, closeRedis } from './config/redis';
import fs from 'fs';
import path from 'path';

// One-time cleanup: remove any user-uploaded PPTX master template that
// was accidentally uploaded (e.g., the 36MB Playbook-bod.pptx).
// The default template in assets/ is always the fallback.
function cleanupUploadedTemplate() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const pptxPath = path.join(uploadsDir, 'pptx-master.pptx');
  const metaPath = path.join(uploadsDir, 'pptx-master.meta.json');
  try {
    if (fs.existsSync(pptxPath)) {
      const stats = fs.statSync(pptxPath);
      // Remove if >1MB (the correct template is ~32KB)
      if (stats.size > 1_000_000) {
        fs.unlinkSync(pptxPath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        logger.info(`Removed oversized uploaded template (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      }
    }
  } catch (e) {
    // ignore — uploads dir may not exist
  }
}

async function main() {
  try {
    // Clean up any oversized uploaded templates
    cleanupUploadedTemplate();

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
