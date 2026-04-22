// PPTX Hint Comments -- parser, stripper, prompt formatter.
//
// The slide-generation LLM embeds absolute-position hints as HTML comments
// immediately before the elements they describe, for example:
//
//   <!-- pptx x=28 y=24 w=904 h=50 font=Georgia:28 color=#111111 align=left -->
//   <h1 class="title">Ocean coloration</h1>
//
// These hints are ground truth at export time: absolute pixel coordinates in
// the 960 x 540 canvas, hex colors, px font size. Every value is optional;
// missing keys fall back to CSS-driven inference.
//
// The module exposes three helpers consumed by pptxService.js:
//
//   parsePptxHints(html)          -> Array of structured hints
//   stripPptxHintComments(html)   -> HTML with the pptx comments removed
//   formatHintsForPrompt(hints)   -> Prompt-ready text block

// Supported keys: x, y, w, h (px integers), font ("Family:Size[:Weight]"),
// color ("#RRGGBB"), bg ("#RRGGBB"), align (left/center/right),
// valign (top/middle/bottom), radius (px), bold (flag), italic (flag).

const HINT_COMMENT_RE = /<!--\s*pptx\b([\s\S]*?)-->/g;
const NEXT_OPEN_TAG_RE = /<([a-zA-Z][\w-]*)\b([^>]*)>/;

function toInt(v) {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/px$/i, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parseFont(value) {
  if (!value) return null;
  const parts = String(value).split(':').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const [family, size, weight] = parts;
  const sizeNum = size ? parseFloat(size) : null;
  return {
    family: family || null,
    size: Number.isFinite(sizeNum) ? sizeNum : null,
    weight: weight || null,
  };
}

function normaliseHex(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{3,8}$/.test(withHash) ? withHash.toUpperCase() : null;
}

function parseKeyValues(str) {
  const pairs = {};
  if (!str) return pairs;
  const re = /(\w[\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const key = m[1];
    const value = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
    if (value === undefined) pairs[key] = true;
    else pairs[key] = value;
  }
  return pairs;
}

function buildHints(kv) {
  const h = {};
  const x = toInt(kv.x); if (x !== null) h.x = x;
  const y = toInt(kv.y); if (y !== null) h.y = y;
  const w = toInt(kv.w); if (w !== null) h.w = w;
  const height = toInt(kv.h); if (height !== null) h.h = height;
  const font = parseFont(kv.font); if (font) h.font = font;
  const color = normaliseHex(kv.color); if (color) h.color = color;
  const bg = normaliseHex(kv.bg); if (bg) h.bg = bg;
  if (kv.align) h.align = String(kv.align).toLowerCase();
  if (kv.valign) h.valign = String(kv.valign).toLowerCase();
  const radius = toInt(kv.radius); if (radius !== null) h.radius = radius;
  if (kv.bold === true || kv.bold === 'true') h.bold = true;
  if (kv.italic === true || kv.italic === 'true') h.italic = true;
  return h;
}

function findNextOpenTag(html, startIdx) {
  const slice = html.slice(startIdx);
  const match = slice.match(NEXT_OPEN_TAG_RE);
  if (!match) return null;
  return {
    tag: match[1].toLowerCase(),
    attrs: match[2] || '',
    offset: startIdx + (match.index || 0),
  };
}

function extractClassName(attrs) {
  const m = attrs && attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return m ? (m[1] || m[2] || '').trim() : '';
}

/**
 * Parse every `<!-- pptx ... -->` comment from an HTML string, pairing each
 * with the element that follows it. Returns `[]` if no hints are present,
 * which means the exporter should fall back to CSS-only inference.
 *
 * @param {string} html
 * @returns {Array<{index:number, tag:string, className:string, hints:object, raw:string}>}
 */
export function parsePptxHints(html) {
  if (!html || typeof html !== 'string') return [];
  const results = [];
  HINT_COMMENT_RE.lastIndex = 0;
  let m;
  while ((m = HINT_COMMENT_RE.exec(html)) !== null) {
    const commentEnd = m.index + m[0].length;
    const next = findNextOpenTag(html, commentEnd);
    if (!next) continue;
    const kv = parseKeyValues(m[1]);
    const hints = buildHints(kv);
    if (Object.keys(hints).length === 0) continue;
    results.push({
      index: results.length,
      tag: next.tag,
      className: extractClassName(next.attrs),
      hints,
      raw: m[1].trim(),
    });
  }
  return results;
}

/**
 * Remove only `<!-- pptx ... -->` comments from an HTML string. Any other
 * comments (`<!-- plain note -->`) are preserved. Use this before sending
 * HTML to the exporter LLM so the structured hints block is the single
 * source of truth and the HTML payload is clean.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripPptxHintComments(html) {
  if (!html) return html;
  return html.replace(HINT_COMMENT_RE, '').replace(/\n{3,}/g, '\n\n');
}

function formatOneHint(entry) {
  const { tag, className, hints: k } = entry;
  const selector = className
    ? `${tag}.${className.split(/\s+/).filter(Boolean).join('.')}`
    : tag;
  const parts = [];
  if (k.x !== undefined) parts.push(`x=${k.x}px`);
  if (k.y !== undefined) parts.push(`y=${k.y}px`);
  if (k.w !== undefined) parts.push(`w=${k.w}px`);
  if (k.h !== undefined) parts.push(`h=${k.h}px`);
  if (k.font) {
    const f = [k.font.family];
    if (k.font.size != null) f.push(`${k.font.size}px`);
    if (k.font.weight) f.push(`weight=${k.font.weight}`);
    parts.push(`font=${f.filter(Boolean).join(' ')}`);
  }
  if (k.color) parts.push(`color=${k.color}`);
  if (k.bg) parts.push(`bg=${k.bg}`);
  if (k.align) parts.push(`align=${k.align}`);
  if (k.valign) parts.push(`valign=${k.valign}`);
  if (k.radius !== undefined) parts.push(`radius=${k.radius}px`);
  if (k.bold) parts.push('bold');
  if (k.italic) parts.push('italic');
  return `[${entry.index + 1}] ${selector}\n    ${parts.join(', ')}`;
}

/**
 * Render the hints as a single text block ready to drop into the PPTX
 * export LLM prompt. Returns an empty string when there are no hints so
 * callers can trivially skip the section for unhinted slides.
 *
 * @param {Array<object>} hints
 * @returns {string}
 */
export function formatHintsForPrompt(hints) {
  if (!Array.isArray(hints) || hints.length === 0) return '';
  const header = [
    '========== ELEMENT HINTS (ground truth for geometry, font, color) ==========',
    'Each entry below is an element from the source HTML with absolute-position values',
    'placed there by the generator. Use them verbatim -- they override any inference',
    'you would make from the CSS layout.',
    '',
    'Coordinates are in px inside the 960 x 540 canvas. Convert to inches with:',
    '  inches = px * 13.333 / 960',
    'Font size in px maps 1:1 to pt. Colors are hex (drop the leading # for PptxGenJS).',
    '',
  ].join('\n');
  const body = hints.map(formatOneHint).join('\n');
  return `${header}${body}\n========== END HINTS ==========`;
}
