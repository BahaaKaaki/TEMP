import type { Request } from 'express';
import { env } from '../config/env';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isLoopbackOrigin(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  } catch {
    return true;
  }
}

/**
 * Public base URL for links returned to callers (e.g. FDI handoff `url` field).
 * Uses `FRONTEND_URL` when it targets a non-loopback host. If it still looks like
 * local dev (unset / default), derives origin from the request in production so
 * Azure App Service does not emit `http://localhost:5173/?handoff=...`.
 */
export function resolveFrontendBaseUrl(req: Request): string {
  const configured = stripTrailingSlash(env.FRONTEND_URL);
  if (!isLoopbackOrigin(configured)) {
    return configured;
  }

  const host = req.get('x-forwarded-host') || req.get('host');
  if (env.NODE_ENV === 'production' && host) {
    const rawProto =
      req.get('x-forwarded-proto') || req.protocol || 'https';
    const proto = rawProto.split(',')[0]?.trim() || 'https';
    return `${proto}://${host}`;
  }

  return configured;
}
