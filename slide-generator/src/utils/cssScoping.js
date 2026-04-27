/**
 * Per-slide CSS namespacing.
 *
 * Scopes every CSS rule to a specific slide via [data-slide-id="<slide id>"],
 * preventing cross-slide style bleed in thumbnails, fullscreen, and HTML export.
 *
 * CSS is scoped at storage time (generation/edit), not at render time.
 * Template CSS is intentionally reused rather than regenerated, then scoped to
 * the concrete slide ID when the slide is added or updated.
 */

export const TYPOGRAPHY_FLOORS = Object.freeze({
  absolute: 10,
  body: 12,
  sectionTitle: 14,
});

const SMALL_TEXT_SELECTOR_RE = /\b(footer|source|footnote|caption|meta|label|badge|chip|axis|tick|legend|unit|note|small)\b/i;
const SECTION_TITLE_SELECTOR_RE = /\b(h3|h4|heading|headline|section|pillar|card-title|cell-title|grid-title|dense-title|timeline-title|kp-title)\b/i;
const BODY_TEXT_SELECTOR_RE = /\b(p|li|td|th|body|text|copy|desc|description|content|insight|takeaway|bullet|cell|card)\b/i;

function formatPx(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function typographyFloorForSelector(selector) {
  if (SMALL_TEXT_SELECTOR_RE.test(selector)) return TYPOGRAPHY_FLOORS.absolute;
  if (SECTION_TITLE_SELECTOR_RE.test(selector)) return TYPOGRAPHY_FLOORS.sectionTitle;
  if (BODY_TEXT_SELECTOR_RE.test(selector)) return TYPOGRAPHY_FLOORS.body;
  return TYPOGRAPHY_FLOORS.absolute;
}

function clampFontSizeDeclarations(body, minSize) {
  return body
    .replace(/font-size\s*:\s*([0-9]*\.?[0-9]+)px/gi, (match, size) => {
      const numeric = Number(size);
      if (!Number.isFinite(numeric) || numeric >= minSize) return match;
      return match.replace(`${size}px`, `${formatPx(minSize)}px`);
    })
    .replace(/(font\s*:\s*[^;{}]*?)([0-9]*\.?[0-9]+)px(?=[/\s;])/gi, (match, prefix, size) => {
      const numeric = Number(size);
      if (!Number.isFinite(numeric) || numeric >= minSize) return match;
      return `${prefix}${formatPx(minSize)}px`;
    });
}

/**
 * Normalize generated/template CSS to the deck typography contract.
 * The model can still choose hierarchy, but it cannot store unreadable text.
 */
export function normalizeSlideTypographyCSS(css) {
  if (!css) return '';

  return css.replace(/([^{}@][^{}]*?)\{([^{}]*)\}/g, (match, selector, body) => {
    const minSize = typographyFloorForSelector(selector);
    const normalizedBody = clampFontSizeDeclarations(body, minSize);
    return `${selector}{${normalizedBody}}`;
  });
}

export function normalizeSlideTypographyHTML(html) {
  if (!html) return html || '';

  return html.replace(
    /<([a-z][\w:-]*)([^>]*?)\sstyle=(["'])([\s\S]*?)\3([^>]*)>/gi,
    (match, tagName, beforeStyle, quote, styleBody, afterStyle) => {
      const classAttr = `${beforeStyle} ${afterStyle}`.match(/\sclass=(["'])([\s\S]*?)\1/i)?.[2] || '';
      const minSize = typographyFloorForSelector(`${tagName} ${classAttr}`);
      const normalizedStyle = clampFontSizeDeclarations(styleBody, minSize);
      return `<${tagName}${beforeStyle} style=${quote}${normalizedStyle}${quote}${afterStyle}>`;
    }
  );
}

/**
 * Prefix every CSS rule selector with [data-slide-id="slideId"].
 * Rules already scoped or @-rules are left untouched.
 */
export function scopeCSS(css, slideId) {
  if (!css || !slideId) return css || '';
  const normalizedCSS = normalizeSlideTypographyCSS(css);
  const attr = `[data-slide-id="${slideId}"]`;

  return normalizedCSS.replace(
    /((?:\s*\/\*[\s\S]*?\*\/\s*)*[^{}@/][^{}]*?)\s*\{/g,
    (match, rawSelectors) => {
      // Skip @-rules (@media, @keyframes, etc.)
      if (rawSelectors.trim().startsWith('@')) return match;

      // Keep leading comments, but scope the selector that follows them.
      // Without this, blocks like "/* Chart */\n.slide .foo {" remained
      // unscoped because the whole prelude started with a comment.
      const commentPrefix = rawSelectors.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)+)/)?.[1] || '';
      const selectorText = rawSelectors.slice(commentPrefix.length);
      if (!selectorText.trim()) return match;

      const scoped = selectorText
        .split(',')
        .map(sel => {
          sel = sel.trim();
          if (!sel || sel.startsWith('@') || sel.startsWith('/*')) return sel;
          // Already scoped
          if (sel.includes('data-slide-id')) return sel;
          // Starts with .slide — insert attr right after .slide token
          if (/^\.slide(?=[\s.[:#>+~])/.test(sel)) {
            return sel.replace(/^\.slide/, `.slide${attr}`);
          }
          // Any other selector — prefix with .slide[attr]
          return `.slide${attr} ${sel}`;
        })
        .join(', ');

      return `${commentPrefix}${scoped} {`;
    }
  );
}

/**
 * Strip [data-slide-id="..."] from CSS so the AI sees clean selectors.
 * Used before sending existing CSS as context to the LLM.
 */
export function unscopeCSS(css) {
  if (!css) return '';
  // Remove the [data-slide-id="..."] but preserve the space after .slide
  // .slide[data-slide-id="x"] .frame → .slide .frame
  return css.replace(/\[data-slide-id="[^"]*"\]/g, '');
}
