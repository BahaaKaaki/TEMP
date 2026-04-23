import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

// Header injected by Azure App Service Easy Auth for every authenticated request.
// Contains the authenticated user's UPN (work email for Entra ID).
const EASY_AUTH_UPN_HEADER = 'x-ms-client-principal-name';
// Companion header with the authenticated tenant id; used for a defence-in-depth
// check that the token was issued by the PwC tenant.
const EASY_AUTH_TENANT_HEADER = 'x-ms-client-principal-idp';

const PWC_TENANT_ID = '513294a0-3e20-41b2-a970-6d30bf1546fa';

// Paths searched (first hit wins). The first two keep the list out of the
// repository; the third is the expected location after `./deploy.sh` on Azure
// App Service, where files land under /home/site/wwwroot.
const ALLOWLIST_CANDIDATE_PATHS = [
  process.env.ALLOWLIST_FILE_PATH,
  path.resolve(process.cwd(), 'config/allowlist.txt'),
  path.resolve(process.cwd(), '../config/allowlist.txt'),
  '/home/site/wwwroot/config/allowlist.txt',
].filter((p): p is string => Boolean(p));

// Routes that must stay open even when enforcement is on. `/health` is the
// App Service warm-up probe; if it starts returning 403 the platform will
// assume the app is unhealthy and stop routing traffic to it.
const EXEMPT_PATH_PREFIXES = ['/health'];

interface AllowlistState {
  emails: Set<string>;
  source: string;
  loadedAt: Date;
}

let state: AllowlistState | null = null;

function parseAllowlistText(raw: string): Set<string> {
  const emails = new Set<string>();
  for (const line of raw.split(/\r?\n|,/)) {
    const trimmed = line.trim().toLowerCase();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.includes('@')) emails.add(trimmed);
  }
  return emails;
}

function loadAllowlist(): AllowlistState {
  const envValue = process.env.ALLOWLIST_EMAILS;
  if (envValue && envValue.trim()) {
    const emails = parseAllowlistText(envValue);
    return { emails, source: 'env:ALLOWLIST_EMAILS', loadedAt: new Date() };
  }

  for (const candidate of ALLOWLIST_CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf-8');
        const emails = parseAllowlistText(raw);
        return { emails, source: `file:${candidate}`, loadedAt: new Date() };
      }
    } catch (err) {
      logger.warn('Allowlist read failed for %s: %s', candidate, (err as Error).message);
    }
  }

  return { emails: new Set<string>(), source: 'none', loadedAt: new Date() };
}

export function initAllowlist(): void {
  state = loadAllowlist();
  const enforce = process.env.ALLOWLIST_ENFORCE === 'true';
  logger.info(
    'Allowlist initialised: source=%s size=%d enforce=%s',
    state.source,
    state.emails.size,
    enforce
  );
  if (enforce && state.emails.size === 0) {
    // Critical guardrail. If enforcement is on and we have no list, we would
    // 403 everyone including ourselves; failing closed here forces an operator
    // to fix the config instead of staring at a silent lockout.
    logger.error(
      'Allowlist enforcement enabled but allowlist is empty. Refusing to continue — fix ALLOWLIST_EMAILS or the deployed config/allowlist.txt.'
    );
    throw new Error('ALLOWLIST_ENFORCE=true but no emails loaded');
  }
}

export function getAllowlistSummary(): { size: number; source: string; loadedAt: string | null; enforce: boolean } {
  return {
    size: state?.emails.size ?? 0,
    source: state?.source ?? 'uninitialised',
    loadedAt: state?.loadedAt?.toISOString() ?? null,
    enforce: process.env.ALLOWLIST_ENFORCE === 'true',
  };
}

function hashUpn(upn: string): string {
  return crypto.createHash('sha256').update(upn).digest('hex').slice(0, 10);
}

function isExempt(req: Request): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix));
}

// In non-production environments (e.g. `npm run dev` on a laptop) there is no
// Easy Auth in front of the app, so the header will never be present. Skipping
// the check keeps local development ergonomic without weakening production.
function isLocalDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function allowlistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (isExempt(req)) return next();
  if (isLocalDev() && !process.env.ALLOWLIST_FORCE_IN_DEV) return next();

  const enforce = process.env.ALLOWLIST_ENFORCE === 'true';
  const upnHeader = req.header(EASY_AUTH_UPN_HEADER) || '';
  const tenantHeader = req.header(EASY_AUTH_TENANT_HEADER) || '';
  const upn = upnHeader.trim().toLowerCase();

  if (!upn) {
    // No Easy Auth header means the request did not go through the App Service
    // authentication front door. Either Easy Auth is mis-configured or someone
    // is bypassing it (e.g. hitting the container directly). Fail closed when
    // enforcing, log when in log-only mode.
    if (enforce) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign-in required' } });
      return;
    }
    logger.info('allowlist[log-only] path=%s decision=no_upn', req.path);
    return next();
  }

  const allowed = state?.emails.has(upn) ?? false;
  const userHash = hashUpn(upn);
  const domain = upn.includes('@') ? upn.split('@', 2)[1] : 'none';

  logger.info(
    'allowlist path=%s user#%s @%s tenant=%s allowed=%s enforce=%s',
    req.path,
    userHash,
    domain,
    tenantHeader || 'none',
    allowed,
    enforce
  );

  if (!allowed && enforce) {
    res.status(403).json({
      error: { code: 'ACCESS_DENIED', message: 'Access denied. Contact the Edwin admin.' },
    });
    return;
  }

  // Propagate for downstream consumers (controllers, audit logs).
  (req as Request & { authUser?: { email: string } }).authUser = { email: upn };
  return next();
}
