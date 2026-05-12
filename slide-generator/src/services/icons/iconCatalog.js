/**
 * Strategy& icon catalog client.
 *
 * Fetches the manifest published at /api/assets/icons/strategy/manifest.json,
 * caches it in localStorage keyed by version + sha, and exposes lookup helpers
 * used by both the freestyle prompt builder and the runtime icon resolver.
 *
 * Design notes:
 * - The manifest is ~650KB JSON listing every extracted icon. We keep it in
 *   memory (a single Map keyed by slug) and persist a compact copy in
 *   localStorage so reloads skip the network round-trip.
 * - Per-icon SVG bodies are NOT pre-fetched here -- iconResolver fetches them
 *   lazily on first use, since most decks only reference a handful of icons.
 * - Two snapshots of the catalog are exposed to the freestyle prompt builder:
 *     getPromptCatalog()        -> generic icons only (~128 entries, ~2K tokens)
 *     getPromptCatalog(category) -> a single category subset
 *   Practice-area icons are intentionally omitted from the default prompt to
 *   stay within budget; the runtime resolver still serves any slug from the
 *   manifest.
 */

import { authFetch } from '../authFetch.js';

const MANIFEST_URL = '/api/assets/icons/strategy/manifest.json';
const STORAGE_KEY = 'edwin.iconCatalog.v1';
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** @typedef {{ slug: string, category: string, displayName: string, keywords: string[], file: string }} IconRecord */

let _catalog = null;     // { version, generatedAt, sha256_12, icons: IconRecord[], bySlug: Map }
let _loadPromise = null; // de-duplicate concurrent first-loads

function readCachedManifest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.cachedAt || !parsed.manifest) return null;
    if (Date.now() - parsed.cachedAt > STORAGE_TTL_MS) return null;
    return parsed.manifest;
  } catch {
    return null;
  }
}

function writeCachedManifest(manifest) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cachedAt: Date.now(),
      manifest,
    }));
  } catch {
    // QuotaExceededError or private mode -- harmless, in-memory cache still works.
  }
}

function indexCatalog(manifest) {
  const bySlug = new Map();
  for (const icon of manifest.icons || []) {
    bySlug.set(icon.slug, icon);
  }
  return {
    version: manifest.version || 'unknown',
    generatedAt: manifest.generatedAt || null,
    sha256_12: manifest.sha256_12 || null,
    iconCount: manifest.iconCount || (manifest.icons || []).length,
    categories: manifest.categories || {},
    icons: manifest.icons || [],
    bySlug,
  };
}

/**
 * Load the catalog. Resolves to the catalog object; subsequent calls return
 * the cached value. Network failures fall back to localStorage; a hard
 * failure (no cache + no network) returns an empty catalog so callers
 * degrade gracefully instead of throwing.
 */
export async function loadCatalog() {
  if (_catalog) return _catalog;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    // Try network first (cheap conditional fetch -- the manifest has a
    // Cache-Control: max-age=86400 from the backend so a 304 is fast).
    try {
      const res = await authFetch(MANIFEST_URL);
      if (res.ok) {
        const manifest = await res.json();
        writeCachedManifest(manifest);
        _catalog = indexCatalog(manifest);
        return _catalog;
      }
    } catch (err) {
      // fall through to cache
    }

    const cached = readCachedManifest();
    if (cached) {
      _catalog = indexCatalog(cached);
      return _catalog;
    }

    // Empty catalog -- the resolver will leave <icon> tags in place so the
    // failure mode is visible rather than silently swallowed.
    _catalog = indexCatalog({ icons: [] });
    return _catalog;
  })();

  try {
    return await _loadPromise;
  } finally {
    _loadPromise = null;
  }
}

export function getCatalog() {
  return _catalog;
}

export function findBySlug(slug) {
  return _catalog?.bySlug.get(slug) || null;
}

/**
 * Render the prompt-catalog string. Default: generic-large + generic-small.
 * Pass a categories array to override (e.g. ['generic-large', 'health-large']).
 *
 * Format (compact, ~50-70 chars per icon):
 *   slug-here — keyword1, keyword2, keyword3, keyword4
 */
export function formatCatalogForPrompt(options = {}) {
  if (!_catalog) return '';
  const {
    categories = ['generic-large', 'generic-small'],
    maxKeywordsPerIcon = 6,
  } = options;

  const want = new Set(categories);
  const seen = new Set();
  const lines = [];

  for (const icon of _catalog.icons) {
    if (!want.has(icon.category)) continue;
    if (seen.has(icon.slug)) continue;
    seen.add(icon.slug);
    const kw = (icon.keywords || []).slice(0, maxKeywordsPerIcon).join(', ');
    lines.push(`${icon.slug} — ${kw}`);
  }
  return lines.join('\n');
}

/** Total list of categories present in the catalog (for category-filtered fetches). */
export function listCategories() {
  return Object.keys(_catalog?.categories || {});
}
