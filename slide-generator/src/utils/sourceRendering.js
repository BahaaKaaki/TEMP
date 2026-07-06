/**
 * Central rules for which slide "sources" may be shown as hyperlinks / verification cards.
 * Search-engine result pages and label-only research candidates must never be promoted to citations.
 */

/** @param {string} [rawUrl] */
export function isSearchEngineResultsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = url.pathname.toLowerCase();
    if (host === 'google.com' && path.startsWith('/search')) return true;
    if (host === 'bing.com' && path.startsWith('/search')) return true;
    if (host === 'duckduckgo.com' && (path === '/' || path.startsWith('/?q='))) return true;
    if (host === 'search.yahoo.com') return true;
    return false;
  } catch {
    return false;
  }
}

const INTERNAL_METADATA_PHRASES = /\b(search this source|search web|generated from slide source text|use as source for|use as general contextual anchor)\b/i;

/**
 * Router / planner blobs that are not validated citations.
 * @param {Record<string, unknown>} source
 */
export function isResearchCandidateSource(source) {
  if (!source || typeof source !== 'object') return false;
  const t = String(source.type || source.sourceKind || '').toLowerCase();
  if (t === 'web_search' || t === 'web_search_query') return true;
  if (String(source.generatedFrom || '').toLowerCase() === 'slide_text') return true;
  const sk = String(source.sourceKind || '').toLowerCase();
  if (sk === 'web_search_query' || sk === 'generated_from_slide_text' || sk === 'user_provided') return true;
  const label = String(source.label || source.title || '');
  if (/^user-provided\b/i.test(label.trim())) return true;
  if (INTERNAL_METADATA_PHRASES.test(String(source.note || source.snippet || source.description || ''))) return true;
  return false;
}

/**
 * Whether this source may be shown in the sources inspector with an outbound hyperlink.
 * @param {Record<string, unknown>} source Normalized { url, type, label, ... } from extractSlideSources or mergeStepSources
 */
export function isRenderableSlideSource(source) {
  if (!source || typeof source !== 'object') return false;
  if (source.renderable === false) return false;
  if (isResearchCandidateSource(source)) return false;

  if (source.fileId || source.documentId) return true;

  const url = String(source.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (isSearchEngineResultsUrl(url)) return false;

  const type = String(source.type || '').toLowerCase();
  if (type === 'search' || type === 'text' || type === 'unverified') return false;

  if (type === 'link' || type === 'url' || type === 'metadata') return true;

  return true;
}

/**
 * @param {unknown[]} sources
 * @returns {Record<string, unknown>[]}
 */
export function filterRenderableSlideSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.filter(s => isRenderableSlideSource(s));
}
