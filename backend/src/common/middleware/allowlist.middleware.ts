import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

// Headers injected by Azure App Service Easy Auth on every authenticated
// request. In Entra ID tenants the UPN header and the `mail` claim often
// differ (e.g. `alice@pwcinternal.com` for sign-in vs `alice@pwc.com` on HR
// records), so we accept a match on either.
const EASY_AUTH_UPN_HEADER = 'x-ms-client-principal-name';
const EASY_AUTH_PRINCIPAL_HEADER = 'x-ms-client-principal';
const EASY_AUTH_TENANT_HEADER = 'x-ms-client-principal-idp';

// Claim types to look for inside the base64-encoded principal payload.
// Both the short form (`upn`, `email`) and the WS-Federation long form
// (`http://schemas.xmlsoap.org/.../upn`) can appear depending on the issuer.
const EMAIL_LIKE_CLAIM_TYPES = [
  'upn',
  'email',
  'emails',
  'mail',
  'preferred_username',
  'unique_name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
];

const ALLOWLIST_CANDIDATE_PATHS = [
  process.env.ALLOWLIST_FILE_PATH,
  path.resolve(process.cwd(), 'config/allowlist.txt'),
  path.resolve(process.cwd(), '../config/allowlist.txt'),
  '/home/site/wwwroot/config/allowlist.txt',
].filter((p): p is string => Boolean(p));

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
    logger.error(
      'Allowlist enforcement enabled but allowlist is empty. Refusing to continue -- fix ALLOWLIST_EMAILS or the deployed config/allowlist.txt.'
    );
    throw new Error('ALLOWLIST_ENFORCE=true but no emails loaded');
  }
}

export function getAllowlistSummary(): {
  size: number;
  source: string;
  loadedAt: string | null;
  enforce: boolean;
} {
  return {
    size: state?.emails.size ?? 0,
    source: state?.source ?? 'uninitialised',
    loadedAt: state?.loadedAt?.toISOString() ?? null,
    enforce: process.env.ALLOWLIST_ENFORCE === 'true',
  };
}

function hashUpn(id: string): string {
  return crypto.createHash('sha256').update(id).digest('hex').slice(0, 10);
}

function isExempt(req: Request): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix));
}

function isLocalDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

// Collect every plausible email/UPN identifier Easy Auth passes through. The
// full `x-ms-client-principal` header is base64-encoded JSON containing all
// claims on the signed-in identity.
interface PrincipalSummary {
  identifiers: string[];      // lowercased, deduped, all email-like values
  claimTypes: string[];       // sorted list of claim type names (for debug)
  parseError?: string;
}

function extractIdentifiers(req: Request): PrincipalSummary {
  const collected = new Set<string>();
  const claimTypes = new Set<string>();

  const upnHeader = req.header(EASY_AUTH_UPN_HEADER);
  if (upnHeader && upnHeader.trim()) {
    const lower = upnHeader.trim().toLowerCase();
    collected.add(lower);
    claimTypes.add('header:x-ms-client-principal-name');
  }

  const principalHeader = req.header(EASY_AUTH_PRINCIPAL_HEADER);
  let parseError: string | undefined;
  if (principalHeader) {
    try {
      const decoded = Buffer.from(principalHeader, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as { claims?: Array<{ typ?: string; val?: string }> };
      for (const claim of parsed.claims ?? []) {
        if (!claim?.typ || !claim?.val) continue;
        const typ = claim.typ.toLowerCase();
        claimTypes.add(typ);
        const val = String(claim.val).trim().toLowerCase();
        if (val.includes('@') && EMAIL_LIKE_CLAIM_TYPES.some((c) => typ === c.toLowerCase())) {
          collected.add(val);
        }
      }
    } catch (err) {
      parseError = (err as Error).message;
    }
  }

  return {
    identifiers: [...collected],
    claimTypes: [...claimTypes].sort(),
    parseError,
  };
}

export function allowlistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (isExempt(req)) return next();
  if (isLocalDev() && !process.env.ALLOWLIST_FORCE_IN_DEV) return next();

  const enforce = process.env.ALLOWLIST_ENFORCE === 'true';
  const summary = extractIdentifiers(req);
  const tenantHeader = req.header(EASY_AUTH_TENANT_HEADER) || '';

  if (summary.identifiers.length === 0) {
    if (enforce) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign-in required' } });
      return;
    }
    logger.info(
      'allowlist[log-only] path=%s decision=no_identifier claims=%s parseErr=%s',
      req.path,
      summary.claimTypes.join(',') || 'none',
      summary.parseError || 'none'
    );
    return next();
  }

  const allowlist = state?.emails ?? new Set<string>();
  const matched = summary.identifiers.find((id) => allowlist.has(id));
  const allowed = Boolean(matched);

  // Stable hash for the first identifier so we can correlate events without
  // leaking the real UPN. The domain is logged separately in clear so we can
  // still spot policy violations (e.g. a non-pwc.com sign-in).
  const primary = summary.identifiers[0];
  const userHash = hashUpn(primary);
  const domain = primary.includes('@') ? primary.split('@', 2)[1] : 'none';

  logger.info(
    'allowlist path=%s user#%s @%s tenant=%s identifiers=%d allowed=%s matched_on=%s enforce=%s',
    req.path,
    userHash,
    domain,
    tenantHeader || 'none',
    summary.identifiers.length,
    allowed,
    matched ? hashUpn(matched) : 'none',
    enforce
  );

  if (!allowed && enforce) {
    res.status(403).json({
      error: { code: 'ACCESS_DENIED', message: 'Access denied. Contact the Edwin admin.' },
    });
    return;
  }

  (req as Request & { authUser?: { email: string } }).authUser = { email: matched || primary };
  return next();
}

// Diagnostic helper used by /internal/whoami. Returns only hashed identifiers
// plus the set of claim types; never real UPNs or display names.
export function describeCurrentPrincipal(req: Request): {
  hasPrincipal: boolean;
  identifierCount: number;
  identifiers: Array<{ hash: string; domain: string; inAllowlist: boolean }>;
  claimTypes: string[];
  parseError?: string;
  allowlistSize: number;
  enforce: boolean;
  tenantIdp: string;
} {
  const summary = extractIdentifiers(req);
  const tenantIdp = req.header(EASY_AUTH_TENANT_HEADER) || '';
  const allowlist = state?.emails ?? new Set<string>();
  return {
    hasPrincipal: summary.identifiers.length > 0,
    identifierCount: summary.identifiers.length,
    identifiers: summary.identifiers.map((id) => ({
      hash: hashUpn(id),
      domain: id.includes('@') ? id.split('@', 2)[1] : 'none',
      inAllowlist: allowlist.has(id),
    })),
    claimTypes: summary.claimTypes,
    parseError: summary.parseError,
    allowlistSize: allowlist.size,
    enforce: process.env.ALLOWLIST_ENFORCE === 'true',
    tenantIdp,
  };
}
