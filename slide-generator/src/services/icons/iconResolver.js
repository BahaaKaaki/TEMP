/**
 * Icon token resolver.
 *
 * The freestyle prompt instructs the LLM to emit Strategy& icons as compact
 * tokens like `<icon name="light-bulb"/>` (or `<icon name="..."></icon>`).
 * This resolver runs on the slide HTML before it lands in the DOM (preview)
 * and before pptxSvgIconInjector runs (export), replacing each token with the
 * inline SVG body fetched from /api/assets/icons/strategy/<category>/<slug>.svg.
 *
 * Two memoization layers:
 *   - SVG body cache  : Map<slug, string> per session (in-memory)
 *   - In-flight fetch : Map<slug, Promise<string>> to dedupe concurrent
 *                       requests for the same slug
 *
 * Failure modes:
 *   - Unknown slug    -> token is replaced with an empty span, the slug is
 *                        logged once via console.warn so it's visible in dev
 *   - Network failure -> slug fetch is retried on next render; in the
 *                        meantime the token is left in place (visible failure)
 */

import { authFetch } from '../authFetch.js';
import { loadCatalog, findBySlug } from './iconCatalog.js';

// Strict element-name match: `<icon` must be followed by whitespace, `/`, or
// `>`. This rejects look-alikes like `<icon-foo/>` or `<iconpath/>`.
const ICON_TOKEN_RE = /<icon(?=[\s/>])([^>]*?)\/>|<icon(?=[\s>])([^>]*)>\s*<\/icon>/gi;
const NAME_ATTR_RE = /\bname\s*=\s*"([^"]+)"|\bname\s*=\s*'([^']+)'/i;
const CLASS_ATTR_RE = /\bclass\s*=\s*"([^"]+)"|\bclass\s*=\s*'([^']+)'/i;

const _svgCache = new Map();          // slug -> svg body string
const _inflight = new Map();          // slug -> Promise<string>
const _missingSlugs = new Set();      // logged once each

function attrValue(re, source) {
  if (!source) return '';
  const m = source.match(re);
  return m ? (m[1] || m[2] || '') : '';
}

async function fetchIconSvg(slug) {
  if (_svgCache.has(slug)) return _svgCache.get(slug);
  if (_inflight.has(slug)) return _inflight.get(slug);

  const icon = findBySlug(slug);
  if (!icon) {
    if (!_missingSlugs.has(slug)) {
      _missingSlugs.add(slug);
      // eslint-disable-next-line no-console
      console.warn(`[iconResolver] unknown icon slug: "${slug}"`);
    }
    return null;
  }

  const url = `/api/assets/icons/strategy/${icon.file}`;
  const promise = (async () => {
    try {
      const res = await authFetch(url);
      if (!res.ok) {
        return null;
      }
      const body = await res.text();
      _svgCache.set(slug, body);
      return body;
    } catch {
      return null;
    } finally {
      _inflight.delete(slug);
    }
  })();
  _inflight.set(slug, promise);
  return promise;
}

/**
 * Replace `<icon name="slug"/>` tokens in `html` with inline SVG markup.
 * Resolves to the new HTML string. Catalog must be loadable; if it fails,
 * tokens are left in place.
 */
export async function resolveIconTokens(html) {
  if (!html || typeof html !== 'string' || !html.includes('<icon')) {
    return html;
  }

  // Make sure the catalog is loaded before any lookups.
  await loadCatalog();

  // Pass 1: collect all slugs we need so we can fetch them in parallel.
  const tokens = []; // [{ start, end, slug, classAttr }]
  ICON_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = ICON_TOKEN_RE.exec(html)) !== null) {
    const attrSource = m[1] || m[2] || '';
    const slug = attrValue(NAME_ATTR_RE, attrSource).trim();
    if (!slug) continue;
    tokens.push({
      start: m.index,
      end: m.index + m[0].length,
      slug,
      classAttr: attrValue(CLASS_ATTR_RE, attrSource).trim(),
    });
  }
  if (tokens.length === 0) return html;

  // Fetch unique slugs in parallel.
  const uniqueSlugs = [...new Set(tokens.map((t) => t.slug))];
  const fetched = await Promise.all(uniqueSlugs.map((s) => fetchIconSvg(s)));
  const bodyBySlug = new Map();
  uniqueSlugs.forEach((slug, i) => {
    bodyBySlug.set(slug, fetched[i]);
  });

  // Pass 2: rebuild the string segment by segment.
  let cursor = 0;
  const out = [];
  for (const tok of tokens) {
    out.push(html.slice(cursor, tok.start));
    const body = bodyBySlug.get(tok.slug);
    if (!body) {
      // Leave the original token so the failure is visible in dev.
      out.push(html.slice(tok.start, tok.end));
    } else {
      out.push(rewriteSvgWithClass(body, tok.classAttr, tok.slug));
    }
    cursor = tok.end;
  }
  out.push(html.slice(cursor));
  return out.join('');
}

/**
 * Inject `class="..."` and `data-icon-slug="..."` into the root <svg> tag.
 * The default class is "icon" so existing pptxSvgIconInjector picks it up.
 */
function rewriteSvgWithClass(svgBody, extraClass, slug) {
  const baseClass = 'icon';
  const cls = extraClass ? `${baseClass} ${extraClass}` : baseClass;

  return svgBody.replace(/^<svg\b([^>]*)>/i, (match, attrs) => {
    let next = attrs || '';
    // Replace existing class attr or append a new one.
    if (/\bclass\s*=/.test(next)) {
      next = next.replace(/\bclass\s*=\s*"([^"]*)"|\bclass\s*=\s*'([^']*)'/, (full, dq, sq) => {
        const prior = (dq ?? sq ?? '').trim();
        return `class="${cls}${prior ? ' ' + prior : ''}"`;
      });
    } else {
      next = ` class="${cls}"${next}`;
    }
    if (!/\bdata-icon-slug\s*=/.test(next)) {
      next += ` data-icon-slug="${slug}"`;
    }
    return `<svg${next}>`;
  });
}

/** Test-only: clear caches between unit tests. */
export function _resetCachesForTests() {
  _svgCache.clear();
  _inflight.clear();
  _missingSlugs.clear();
}
