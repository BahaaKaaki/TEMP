import { config } from 'dotenv';
import { z } from 'zod';

// Load .env file
config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  API_URL: z.string().default('http://localhost:3001'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Database (optional - will use in-memory if not available)
  DATABASE_URL: z.string().default('postgresql://localhost:5432/slide_generator'),
  DATABASE_POOL_SIZE: z.string().default('10').transform(Number),

  // Redis (optional for dev)
  REDIS_URL: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32).default('change-me-set-via-env-file-32chars!!'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32).default('change-me-set-via-env-file-32chars!!'),

  // Email (optional for dev)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((val) => val ? Number(val) : undefined),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // Storage
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  // AI Proxy (PwC Shared Services)
  PWC_API_KEY: z.string().default(''),
  PWC_API_BASE_URL: z.string().default('https://genai-sharedservice-emea.pwcinternal.com'),

  // Basic Auth (set real values in .env or Azure App Settings)
  BASIC_AUTH_USER: z.string().default(''),
  BASIC_AUTH_PASS: z.string().default(''),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
