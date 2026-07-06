/**
 * Entra ID auth + staff allowlist middleware (Route B of allowlist-experiment-2026-04-23).
 *
 * Design:
 *   1. Frontend uses MSAL to sign in against our Entra tenant/app registration
 *      and attaches the user's ID token to every /api/* call as
 *      Authorization: Bearer <jwt>.
 *   2. entraAuthMiddleware verifies the JWT signature against the tenant's
 *      JWKS, validates audience = AZURE_CLIENT_ID and issuer = tenant v2.0
 *      endpoint, and attaches req.user = { email, oid }.
 *   3. allowlistMiddleware looks up req.user.email in a lowercased Set loaded
 *      from ALLOWLIST_PATH and either logs, allows, or 403s based on mode.
 *
 * Three operating modes (ALLOWLIST_MODE env var):
 *   - 'off'     : both middlewares short-circuit. Identical to pre-PR behaviour.
 *                 Used in dev and as a safety default while this PR sits on main.
 *   - 'log'     : JWT required; non-listed users logged but allowed. Used to
 *                 verify claim mapping end-to-end before enforcement.
 *   - 'enforce' : JWT required; non-listed users get 403 ACCESS_DENIED.
 *
 * Why three modes and not a single boolean:
 *   The reverted PR #51 flip caused an immediate 403 incident because we had no
 *   way to observe the (email <-> claim) mapping with real users under real
 *   tokens before enforcement. 'log' mode gives us a safe observation window.
 */

import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthedUser {
  email: string | null;
  oid: string | null;
  name: string | null;
  /** Raw token payload, useful for /api/whoami debugging. */
  rawClaims: Record<string, unknown>;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthedUser;
  }
}

// ─── Allowlist state ────────────────────────────────────────────────────────

const allowlist = new Set<string>();
let allowlistLoaded = false;
let allowlistSource: string | null = null;

function resolveAllowlistPath(): string {
  const raw = env.ALLOWLIST_PATH;
  if (path.isAbsolute(raw)) return raw;
  // Resolve relative to process.cwd() so deployment layouts that place
  // config/allowlist.txt next to the compiled bundle work without tweaking env.
  return path.resolve(process.cwd(), raw);
}

/**
 * Reads config/allowlist.txt into a Set of lowercased emails. Empty lines and
 * lines starting with '#' are ignored. Failure to read is fatal only when the
 * mode is not 'off' -- in 'off' mode we stay quiet so this PR can sit on main
 * without forcing every environment to ship an allowlist file.
 */
export function initAllowlist(): void {
  allowlist.clear();
  allowlistLoaded = false;
  allowlistSource = null;

  const mode = env.ALLOWLIST_MODE;
  if (mode === 'off') {
    logger.info('[allowlist] mode=off -- middleware is a no-op');
    return;
  }

  const filePath = resolveAllowlistPath();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      allowlist.add(trimmed.toLowerCase());
    }
    allowlistLoaded = true;
    allowlistSource = filePath;
    logger.info(
      '[allowlist] loaded %d entries from %s (mode=%s)',
      allowlist.size,
      filePath,
      mode,
    );
  } catch (err: any) {
    logger.error(
      '[allowlist] FAILED to read %s: %s. Refusing to start in mode=%s.',
      filePath,
      err?.message || err,
      mode,
    );
    // Intentional: if the operator flipped enforcement but the file is missing
    // we must fail loudly rather than default-allow or default-deny silently.
    throw new Error(`Allowlist file missing at ${filePath} but ALLOWLIST_MODE=${mode}`);
  }
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowlist.has(email.toLowerCase());
}

export function getAllowlistStatus(): {
  mode: 'off' | 'log' | 'enforce';
  loaded: boolean;
  size: number;
  source: string | null;
} {
  return {
    mode: env.ALLOWLIST_MODE,
    loaded: allowlistLoaded,
    size: allowlist.size,
    source: allowlistSource,
  };
}

// ─── JWT verification ───────────────────────────────────────────────────────

let _jwks: jwksClient.JwksClient | null = null;

function getJwks(): jwksClient.JwksClient {
  if (_jwks) return _jwks;
  const tenant = env.AZURE_TENANT_ID;
  if (!tenant) {
    throw new Error('AZURE_TENANT_ID must be set when ALLOWLIST_MODE is not "off"');
  }
  _jwks = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
    cache: true,
    cacheMaxAge: 24 * 60 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });
  return _jwks;
}

function getSigningKey(header: JwtHeader, callback: SigningKeyCallback): void {
  if (!header.kid) {
    callback(new Error('JWT header missing kid'));
    return;
  }
  getJwks().getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, key?.getPublicKey());
  });
}

function verifyIdToken(token: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        audience: env.AZURE_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/v2.0`,
        algorithms: ['RS256'],
        clockTolerance: 10,
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(decoded as Record<string, any>);
      },
    );
  });
}

/**
 * Best-effort email extraction. Entra ID ID tokens expose the user's email via
 * several claim names depending on account type (member vs guest, federated
 * identity, B2B, etc.). We try them in decreasing order of reliability.
 */
function extractEmail(claims: Record<string, any>): string | null {
  const candidates = [
    'preferred_username', // Most common for work accounts
    'upn',
    'email',
    'unique_name',
    'mail',
  ];
  for (const key of candidates) {
    const val = claims[key];
    if (typeof val === 'string' && val.includes('@')) {
      return val.toLowerCase();
    }
  }
  return null;
}

// ─── Middlewares ────────────────────────────────────────────────────────────

/**
 * Verifies the Entra ID JWT, attaches req.user. 401 on missing/invalid token.
 * No-op when ALLOWLIST_MODE === 'off'.
 */
export async function entraAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (env.ALLOWLIST_MODE === 'off') {
    next();
    return;
  }

  const header = req.header('authorization') || req.header('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Missing Authorization: Bearer <idToken> header',
    });
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Empty bearer token' });
    return;
  }

  try {
    const claims = await verifyIdToken(token);
    req.user = {
      email: extractEmail(claims),
      oid: typeof claims.oid === 'string' ? claims.oid : null,
      name: typeof claims.name === 'string' ? claims.name : null,
      rawClaims: claims,
    };
    next();
  } catch (err: any) {
    logger.warn('[entraAuth] JWT verification failed: %s', err?.message || err);
    res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Enforces the staff allowlist. Must run AFTER entraAuthMiddleware so req.user
 * is populated. In 'log' mode, violations are logged but the request proceeds.
 * In 'enforce' mode, non-listed users receive 403 ACCESS_DENIED.
 * No-op when ALLOWLIST_MODE === 'off'.
 */
export function allowlistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const mode = env.ALLOWLIST_MODE;
  if (mode === 'off') {
    next();
    return;
  }

  const email = req.user?.email || null;
  const allowed = isAllowed(email);

  if (!allowed) {
    if (mode === 'enforce') {
      logger.warn(
        '[allowlist] BLOCKED path=%s email=%s oid=%s',
        req.path,
        email || '(none)',
        req.user?.oid || '(none)',
      );
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message:
          'Your account is not on the approved staff list. Contact the Strategy& admin team if you believe this is a mistake.',
      });
      return;
    }
    // mode === 'log'
    logger.warn(
      '[allowlist] LOG-ONLY path=%s email=%s oid=%s (would block in enforce mode)',
      req.path,
      email || '(none)',
      req.user?.oid || '(none)',
    );
  }

  next();
}
