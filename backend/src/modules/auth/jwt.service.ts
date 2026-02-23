import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { cache } from '../../config/redis';
import { v4 as uuidv4 } from 'uuid';

interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Parse duration string to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // Default 15 minutes

  const [, value, unit] = match;
  const num = parseInt(value!, 10);

  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 60 * 60;
    case 'd': return num * 60 * 60 * 24;
    default: return 900;
  }
}

const ACCESS_EXPIRY_SECONDS = parseDuration(env.JWT_ACCESS_EXPIRY);
const REFRESH_EXPIRY_SECONDS = parseDuration(env.JWT_REFRESH_EXPIRY);

// Generate access token
export function generateAccessToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    type: 'access',
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
}

// Generate refresh token
export function generateRefreshToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    type: 'refresh',
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
}

// Generate token pair
export function generateTokenPair(userId: string, email: string): TokenPair {
  return {
    accessToken: generateAccessToken(userId, email),
    refreshToken: generateRefreshToken(userId, email),
    expiresIn: ACCESS_EXPIRY_SECONDS,
  };
}

// Verify access token
export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return payload;
}

// Verify refresh token
export function verifyRefreshToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return payload;
}

// Blacklist a token (for logout)
export async function blacklistToken(token: string, expiresInSeconds: number): Promise<void> {
  const jti = jwt.decode(token) as { exp?: number };
  if (!jti) return;

  // Use remaining time until expiry
  const ttl = Math.max(expiresInSeconds, 1);
  await cache.set(`blacklist:${token}`, '1', ttl);
}

// Check if token is blacklisted
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  return cache.exists(`blacklist:${token}`);
}

// Generate session ID for tracking
export function generateSessionId(): string {
  return uuidv4();
}

// Store refresh token with session
export async function storeRefreshToken(
  userId: string,
  sessionId: string,
  refreshToken: string
): Promise<void> {
  const key = `refresh:${userId}:${sessionId}`;
  await cache.set(key, refreshToken, REFRESH_EXPIRY_SECONDS);
}

// Revoke refresh token
export async function revokeRefreshToken(userId: string, sessionId: string): Promise<void> {
  const key = `refresh:${userId}:${sessionId}`;
  await cache.del(key);
}

// Revoke all refresh tokens for user (logout everywhere)
export async function revokeAllUserTokens(userId: string): Promise<void> {
  // Note: This is simplified - in production, you'd use Redis SCAN
  // For now, we just invalidate based on user ID prefix
  // The actual tokens will still work until they expire
  // A more robust solution would track all session IDs
  await cache.set(`revoked:${userId}`, String(Date.now()), REFRESH_EXPIRY_SECONDS);
}

// Check if user tokens have been revoked
export async function areUserTokensRevoked(userId: string, tokenIssuedAt: number): Promise<boolean> {
  const revokedAtStr = await cache.get(`revoked:${userId}`);
  if (!revokedAtStr) return false;

  const revokedAt = parseInt(revokedAtStr, 10);
  return tokenIssuedAt * 1000 < revokedAt;
}
