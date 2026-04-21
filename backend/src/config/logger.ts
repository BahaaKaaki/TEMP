import winston from 'winston';
import { env, isDev } from './env';

const { combine, timestamp, printf, colorize, errors, splat } = winston.format;

// Custom format for development
//
// `splat()` enables sprintf-style interpolation so calls like
// `logger.info('foo %s', bar)` render as `foo <bar>` instead of leaving the
// literal `%s` placeholder in the output. Many call sites across the backend
// rely on this pattern (ai-proxy, skills, themes, auth), so it must be part of
// the base format chain in both dev and prod profiles.
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: isDev ? devFormat : prodFormat,
  defaultMeta: { service: 'slide-generator-api' },
  transports: [
    new winston.transports.Console(),
  ],
});

// Stream for Morgan HTTP logging
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
