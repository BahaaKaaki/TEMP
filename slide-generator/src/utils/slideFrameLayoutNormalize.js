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

export const NEOM_CONTRAST_MARKER = '/* edwin-neom-contrast */';

const NEOM_DARK_TEXT = /#(?:13100[Dd]|007[Bb][Bb]5|000000|222222)|var\(--(?:heading|body|accent|info)\b/;

const NEOM_DARK_FILL_BG = /background(?:-color)?\s*:\s*(?:#13100[dD]|var\(--neutral-fill)/i;

const NEOM_CONTRAST_RULES = `${NEOM_CONTRAST_MARKER}
.slide[data-client-profile="neom"] .frame {
  --neutral-fill: #13100D;
  --on-neutral-fill: #FFFFFF;
}
.slide[data-client-profile="neom"] .frame [style*="background: var(--neutral-fill)"],
.slide[data-client-profile="neom"] .frame [style*="background:var(--neutral-fill)"],
.slide[data-client-profile="neom"] .frame [style*="background-color: var(--neutral-fill)"],
.slide[data-client-profile="neom"] .frame [style*="background-color:var(--neutral-fill)"] {
  color: #FFFFFF !important;
}
.slide[data-client-profile="neom"] .frame [style*="background: var(--neutral-fill)"] *,
.slide[data-client-profile="neom"] .frame [style*="background:var(--neutral-fill)"] * {
  color: #FFFFFF !important;
}
.slide[data-client-profile="neom"] .frame .hub,
.slide[data-client-profile="neom"] .frame .hub * {
  color: #FFFFFF !important;
}
.slide[data-client-profile="neom"] .frame .hubBar {
  color: #13100D !important;
}
.slide[data-client-profile="neom"] .frame .capNum {
  background: #13100D !important;
  color: #FFFFFF !important;
}
.slide[data-client-profile="neom"] .frame .capHead,
.slide[data-client-profile="neom"] .frame .capTitle {
  color: #13100D !important;
}
.slide[data-client-profile="neom"] .frame :is(.stepNum, .stepBadge, .phaseNum, .numBadge, .indexBox, .numBox) {
  background: #13100D !important;
  color: #FFFFFF !important;
}
`;

/**
 * @param {string} [html]
 * @returns {boolean}
 */
export function slideHasNeomClientProfile(html = '') {
  return /data-client-profile=["']neom["']/i.test(html);
}

/**
 * NEOM badges use dark #13100D fills with white text (NAFB5). Strategy& grey fills leak in generation.
 * @param {string} css
 * @returns {string}
 */
export function normalizeNeomClientColorTokens(css = '') {
  if (!css) return css;
  let next = css
    .replace(/--neutral-fill\s*:\s*#4[bB]5563/gi, '--neutral-fill: #13100D')
    .replace(/--neutral-fill\s*:\s*#4[Ee]4[Cc]4[aA]/gi, '--neutral-fill: #13100D')
    .replace(/--neutral-fill\s*:\s*#898786/gi, '--neutral-fill: #13100D')
    .replace(/--on-neutral-fill\s*:\s*#[^;]+/gi, '--on-neutral-fill: #FFFFFF');

  next = next.replace(/([^{}@]+)\{([^{}]*)\}/g, (block, selector, body) => {
    const hasGreyBg = /background(?:-color)?\s*:\s*(?:#(?:4[bB]5563|4[Ee]4[Cc]4[aA]|898786)|var\(--neutral-fill)/i.test(body);
    const hasDarkFillBg = NEOM_DARK_FILL_BG.test(body);
    if (!hasGreyBg && !hasDarkFillBg) return block;
    let fixedBody = body
      .replace(/background(?:-color)?\s*:\s*#(?:4[bB]5563|4[Ee]4[Cc]4[aA]|898786)/gi, 'background: #13100D')
      .replace(/background(?:-color)?\s*:\s*var\(--neutral-fill[^;)]*\)/gi, 'background: var(--neutral-fill, #13100D)');
    if (hasDarkFillBg || hasGreyBg) {
      fixedBody = fixedBody.replace(/color\s*:\s*var\(--on-accent\)/gi, 'color: var(--on-neutral-fill, #FFFFFF)');
    }
    if ((hasDarkFillBg || hasGreyBg) && (NEOM_DARK_TEXT.test(fixedBody) || !/color\s*:/i.test(fixedBody))) {
      fixedBody = fixedBody.replace(/color\s*:\s*[^;]+/gi, 'color: #FFFFFF');
      if (!/color\s*:/i.test(fixedBody)) {
        fixedBody = `${fixedBody.trim().replace(/;\s*$/, '')}; color: #FFFFFF`;
      }
    }
    return `${selector}{${fixedBody}}`;
  });

  next = next.replace(/([^{}@]+)\{([^{}]*)\}/g, (block, selector, body) => {
    const hasYellowBg = /background(?:-color)?\s*:\s*(?:#EBC03F|var\(--accent)/i.test(body);
    if (hasYellowBg || !/color\s*:\s*var\(--on-accent\)/i.test(body)) return block;
    const darkBadgeSelector = /\.(?:hub|capNum|stepNum|stepBadge|phaseNum|numBadge|indexBox|numBox)\b/i.test(selector);
    if (!darkBadgeSelector && !NEOM_DARK_FILL_BG.test(body)) return block;
    const fixedBody = body.replace(/color\s*:\s*var\(--on-accent\)/gi, 'color: var(--on-neutral-fill, #FFFFFF)');
    return `${selector}{${fixedBody}}`;
  });

  return next;
}

/**
 * Fix inline grey badge fills with dark index text on existing NEOM slides.
 * @param {string} html
 * @returns {string}
 */
export function normalizeNeomContrastInHtml(html = '') {
  if (!html) return html;
  return html.replace(/style=(["'])([\s\S]*?)\1/gi, (match, quote, styleBody) => {
    const hasGreyBg = /background(?:-color)?\s*:\s*(?:#(?:4[bB]5563|4[Ee]4[Cc]4[aA]|898786)|var\(--neutral-fill)/i.test(styleBody);
    if (!hasGreyBg) return match;
    let style = styleBody
      .replace(/background(?:-color)?\s*:\s*#(?:4[bB]5563|4[Ee]4[Cc]4[aA]|898786)/gi, 'background:#13100D')
      .replace(/background(?:-color)?\s*:\s*var\(--neutral-fill[^;)]*\)/gi, 'background:#13100D');
    if (NEOM_DARK_TEXT.test(style) || !/color\s*:/i.test(style)) {
      style = style.replace(/color\s*:\s*[^;]+/gi, 'color:#FFFFFF');
      if (!/color\s*:/i.test(style)) style += ';color:#FFFFFF';
    }
    return `style=${quote}${style}${quote}`;
  });
}

function hasNeomContrastPatch(css) {
  return css.includes(NEOM_CONTRAST_MARKER);
}

/**
 * @param {{ html?: string, customCSS?: string }} slide
 * @returns {{ html: string, customCSS: string }}
 */
export function normalizeNeomContrastSlide({ html = '', customCSS = '' } = {}) {
  if (!slideHasNeomClientProfile(html)) {
    return { html, customCSS: customCSS || '' };
  }
  let css = normalizeNeomClientColorTokens(customCSS || '');
  const nextHtml = normalizeNeomContrastInHtml(html);
  if (!hasNeomContrastPatch(css)) {
    css = css ? `${css.trim()}\n\n${NEOM_CONTRAST_RULES}` : NEOM_CONTRAST_RULES;
  }
  return { html: nextHtml, customCSS: css };
}

/**
 * @param {{ html?: string, customCSS?: string }} slide
 * @returns {{ html: string, customCSS: string }}
 */
export function normalizeDenseFrameLayoutSlide({ html = '', customCSS = '' } = {}) {
  let css = customCSS || '';
  let nextHtml = html;
  if (slideHasSeClientProfile(html)) {
    css = normalizeSeClientColorTokens(css);
  }
  if (slideHasNeomClientProfile(html)) {
    const neomNorm = normalizeNeomContrastSlide({ html: nextHtml, customCSS: css });
    nextHtml = neomNorm.html;
    css = neomNorm.customCSS;
  }
  const patches = [];

  if (slideHasDensePortfolioMatrix(html) && !hasPortfolioLayoutPatch(css)) {
    patches.push(PORTFOLIO_LAYOUT_RULES);
  }
  if (slideHasRoadmapPhasesLayout(html) && !hasRoadmapLayoutPatch(css)) {
    patches.push(ROADMAP_LAYOUT_RULES);
  }

  if (patches.length === 0) {
    return { html: nextHtml, customCSS: css };
  }

  const blocks = patches.join('\n');
  const withHeader = css.includes(DENSE_FRAME_LAYOUT_MARKER)
    ? blocks
    : `${DENSE_FRAME_LAYOUT_MARKER}\n${blocks}`;

  return {
    html: nextHtml,
    customCSS: css ? `${css.trim()}\n\n${withHeader}` : withHeader,
  };
}
