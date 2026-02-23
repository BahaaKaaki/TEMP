import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { cache } from '../../config/redis';

// Standard rate limiter
export const standardLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    error: {
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Too many login attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI endpoint rate limiter (more restrictive)
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    error: {
      code: 'AI_RATE_LIMIT',
      message: 'AI rate limit exceeded, please wait a moment',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom Redis-based rate limiter for per-organization limits
export async function checkOrganizationRateLimit(
  orgId: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const key = `ratelimit:${orgId}:${endpoint}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // Simple counter-based rate limiting
  const countKey = `${key}:count`;
  const resetKey = `${key}:reset`;

  const resetAtStr = await cache.get(resetKey);
  const resetAt = resetAtStr ? parseInt(resetAtStr, 10) : 0;

  // If window has expired, reset
  if (resetAt < now) {
    await cache.set(countKey, '1', windowSeconds);
    await cache.set(resetKey, String(now + windowSeconds * 1000), windowSeconds);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }

  const countStr = await cache.get(countKey);
  const count = countStr ? parseInt(countStr, 10) : 0;

  if (count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(resetAt),
    };
  }

  await cache.set(countKey, String(count + 1), windowSeconds);
  return {
    allowed: true,
    remaining: maxRequests - count - 1,
    resetAt: new Date(resetAt),
  };
}
