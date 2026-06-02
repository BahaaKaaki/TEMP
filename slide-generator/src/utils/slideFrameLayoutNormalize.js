/**
 * Auto-fit dense body layouts inside div.frame (overflow:hidden).
 * Appends scoped-safe CSS for portfolio matrices and roadmap phase columns.
 */

export const DENSE_FRAME_LAYOUT_MARKER = '/* edwin-dense-frame-layout */';
const PORTFOLIO_PATCH_MARKER = '/* edwin-dense-frame-layout:portfolio */';
const ROADMAP_PATCH_MARKER = '/* edwin-dense-frame-layout:roadmap */';

const PORTFOLIO_LAYOUT_RULES = `${PORTFOLIO_PATCH_MARKER}
.slide .frame {
  padding-top: 4px;
  padding-bottom: 4px;
}
.slide .frame .portfolio {
  flex: 1;
  min-height: 0;
  min-width: 0;
  grid-template-rows: 38px minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1fr) !important;
}
.slide .frame .portfolio .cell {
  padding: 8px 10px;
}
.slide .frame .portfolio .rowHead {
  padding: 8px 10px;
}
`;

const ROADMAP_LAYOUT_RULES = `${ROADMAP_PATCH_MARKER}
.slide[data-client-profile="se"] .frame {
  --neutral-fill: #BFBFBF;
  --rose-fill: #008BB9;
  --accent: #001F5E;
}
.slide .frame {
  padding-top: 4px;
  padding-bottom: 4px;
}
.slide .frame .roadmap {
  min-height: 0;
  min-width: 0;
  gap: 8px !important;
}
.slide .frame .timeline {
  height: 30px !important;
  flex-shrink: 0;
  margin-bottom: 0 !important;
}
.slide .frame .phases {
  flex: 1;
  min-height: 0;
  min-width: 0;
  gap: 8px !important;
  grid-template-rows: minmax(0, 1fr) !important;
  align-items: stretch;
}
.slide .frame .phase {
  min-height: 0;
  height: 100%;
  max-height: 100%;
}
.slide .frame .pHead {
  padding: 8px 10px !important;
  flex-shrink: 0;
}
.slide .frame .pBody {
  flex: 1;
  min-height: 0;
  padding: 10px !important;
  gap: 6px !important;
}
.slide .frame .objText {
  font-size: 11px !important;
  line-height: 1.3 !important;
}
.slide .frame .outList {
  gap: 4px !important;
  min-height: 0;
}
.slide .frame .outList li {
  font-size: 11px !important;
  line-height: 1.3 !important;
  padding-left: 10px !important;
}
.slide .frame .outList li::before {
  top: 4px !important;
  width: 4px !important;
  height: 4px !important;
}
`;

/**
 * @param {string} css
 * @returns {boolean}
 */
function hasPortfolioLayoutPatch(css) {
  return css.includes(PORTFOLIO_PATCH_MARKER)
    || (css.includes(DENSE_FRAME_LAYOUT_MARKER) && css.includes('.frame .portfolio'));
}

/**
 * @param {string} css
 * @returns {boolean}
 */
function hasRoadmapLayoutPatch(css) {
  return css.includes(ROADMAP_PATCH_MARKER)
    || (css.includes(DENSE_FRAME_LAYOUT_MARKER) && css.includes('.frame .roadmap'));
}

/**
 * @param {string} [html]
 * @returns {boolean}
 */
export function slideHasDensePortfolioMatrix(html = '') {
  if (!html || typeof html !== 'string') return false;
  if (!/\bclass=["'][^"']*\bframe\b/.test(html)) return false;
  if (/\bportfolio\b/.test(html)) return true;

  const frameMatch = html.match(
    /<div[^>]*class=["'][^"']*\bframe\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<footer/i
  );
  if (!frameMatch) return false;
  const frameBody = frameMatch[1];
  const colHeads = (frameBody.match(/\bcolHead\b/g) || []).length;
  const rowHeads = (frameBody.match(/\browHead\b/g) || []).length;
  return colHeads >= 3 && rowHeads >= 2;
}

/**
 * @param {string} [html]
 * @returns {boolean}
 */
export function slideHasRoadmapPhasesLayout(html = '') {
  if (!html || typeof html !== 'string') return false;
  if (!/\bclass=["'][^"']*\bframe\b/.test(html)) return false;
  if (/\broadmap\b/.test(html)) return true;

  const frameMatch = html.match(
    /<div[^>]*class=["'][^"']*\bframe\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<footer/i
  );
  if (!frameMatch) return false;
  const frameBody = frameMatch[1];
  const phases = (frameBody.match(/\bclass=["'][^"']*\bphase\b/g) || []).length;
  const pHeads = (frameBody.match(/\bpHead\b/g) || []).length;
  const hasPhasesGrid = /\bphases\b/.test(frameBody);
  const hasTimeline = /\btimeline\b/.test(frameBody);
  return hasPhasesGrid && phases >= 3 && pHeads >= 3 && hasTimeline;
}

/**
 * @param {string} html
 * @returns {boolean}
 */
export function slideHasSeClientProfile(html = '') {
  return /data-client-profile=["']se["']/i.test(html);
}

/**
 * Replace Strategy& chart tokens and tertiary pinks on SE slides.
 * @param {string} css
 * @returns {string}
 */
export function normalizeSeClientColorTokens(css = '') {
  if (!css) return css;
  return css
    .replace(/--rose-fill\s*:\s*#d4687a/gi, '--rose-fill: #008BB9')
    .replace(/--neutral-fill\s*:\s*#4b5563/gi, '--neutral-fill: #BFBFBF')
    .replace(/#d4687a/gi, '#008BB9')
    .replace(/#D4687A/g, '#008BB9');
}

/**
 * @param {{ html?: string, customCSS?: string }} slide
 * @returns {{ html: string, customCSS: string }}
 */
export function normalizeDenseFrameLayoutSlide({ html = '', customCSS = '' } = {}) {
  let css = customCSS || '';
  if (slideHasSeClientProfile(html)) {
    css = normalizeSeClientColorTokens(css);
  }
  const patches = [];

  if (slideHasDensePortfolioMatrix(html) && !hasPortfolioLayoutPatch(css)) {
    patches.push(PORTFOLIO_LAYOUT_RULES);
  }
  if (slideHasRoadmapPhasesLayout(html) && !hasRoadmapLayoutPatch(css)) {
    patches.push(ROADMAP_LAYOUT_RULES);
  }

  if (patches.length === 0) {
    return { html, customCSS: css };
  }

  const blocks = patches.join('\n');
  const withHeader = css.includes(DENSE_FRAME_LAYOUT_MARKER)
    ? blocks
    : `${DENSE_FRAME_LAYOUT_MARKER}\n${blocks}`;

  return {
    html,
    customCSS: css ? `${css.trim()}\n\n${withHeader}` : withHeader,
  };
}
