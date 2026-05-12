// PptxGenJS helpers — shared constants, footer/tracker utilities, and
// createRendererFromCode (used by templateValidation.js).

export const COLORS = {
  main: '111111',
  secondary: '222222',
  red: 'A32020',
  maroon: '8E1E1E',
  meta: '4A4F57',
  zone1: 'F7F9FB',
  zone2: 'EEF2F6',
  rose: 'F8E3E3',
  coal: '4B4F55',
  border: 'E6E9EE',
  white: 'FFFFFF',
  lightGray: 'E0E0E0',
  success: '059669',
  successSoft: 'DCFCE7',
  danger: 'DC2626',
  dangerSoft: 'FEE2E2',
};

export const LAYOUT = {
  titleX: 0.48,
  titleY: 0.42,
  titleW: 12.36,
  subtitleX: 0.48,
  subtitleY: 1.40,
  subtitleW: 12.36,
  frameX: 0.48,
  frameY: 1.90,
  frameW: 12.36,
  frameH: 4.9,
  footerY: 7.05,
  cardGap: 0.22,
  cardRadius: 0.05,
};

const PPTX_SLIDE_W = 13.333;
const STRATEGY_FOOTER_FONT_SIZE = 7.5;
const STRATEGY_SOURCE_DEFAULT = { x: 2.66, y: 6.95, w: 8.0, h: 0.3 };
const STRATEGY_SLIDE_NUM_DEFAULT = { x: 10.628, y: 7.092, w: 2.218, h: 0.12 };

export function pptxFontSize(size, fallback = 10, floor = 10) {
  const numeric = Number(size ?? fallback);
  return Math.max(floor, Number.isFinite(numeric) ? numeric : fallback);
}

// ── Footer branding ──────────────────────────────────────────────────────────

let _footerBranding = 'Strategy&';
let _tplPositions = null;
let _profileFontFace = null;

export function setFooterBranding(branding) {
  _footerBranding = branding ?? 'Strategy&';
}

export function setTemplatePositions(positions) {
  _tplPositions = positions || null;
}

export function setPptxFontFace(fontFace) {
  _profileFontFace = fontFace || null;
}

function profileFontFace(fallback) {
  return _profileFontFace || fallback;
}

function profilePositions() {
  return _tplPositions || null;
}

export function addFooter(slide, slideNum, totalSlides, slideType) {
  if (!slide || !slideNum) return;
  if (slideType === 'cover') return;

  const positions = profilePositions();
  const numPos = positions?.slideNum;
  const numFont = numPos?.font || {};
  const numFill = numFont.fill ? { fill: { color: numFont.fill }, line: { color: numFont.fill, transparency: 100 } } : {};
  slide.addText(String(slideNum), {
    x: numPos?.x ?? STRATEGY_SLIDE_NUM_DEFAULT.x,
    y: numPos?.y ?? STRATEGY_SLIDE_NUM_DEFAULT.y,
    w: numPos?.w ?? STRATEGY_SLIDE_NUM_DEFAULT.w,
    h: numPos?.h ?? STRATEGY_SLIDE_NUM_DEFAULT.h,
    fontFace: numFont.fontFace || profileFontFace('Arial'),
    fontSize: pptxFontSize(numFont.fontSize, STRATEGY_FOOTER_FONT_SIZE, STRATEGY_FOOTER_FONT_SIZE),
    bold: numFont.bold || false,
    color: numFont.color || COLORS.meta,
    align: numFont.align || 'right',
    ...numFill,
  });
}

// ── Section tracker ──────────────────────────────────────────────────────────

function trackerCharUnits(char) {
  if (/\s/.test(char)) return 0.45;
  if (/[ilI1|.,:;]/.test(char)) return 0.45;
  if (/[mwMW@#%&]/.test(char)) return 1.3;
  if (/[A-Z0-9]/.test(char)) return 1.1;
  return 1.0;
}

function measureTrackerLabel(label, { fontSize = 8, bold = false, paddingX = 0.22, minW = 0.7, maxW = 5.2 } = {}) {
  const text = String(label || '').trim();
  const units = [...text].reduce((sum, char) => sum + trackerCharUnits(char), 0);
  const boldFactor = bold ? 1.08 : 1;
  const estimated = units * (fontSize / 120) * boldFactor + paddingX;
  return Math.min(maxW, Math.max(minW, Number(estimated.toFixed(3))));
}

function ellipsizeTrackerLabel(label, availableTextW, options = {}) {
  const text = String(label || '').trim();
  if (!text) return text;
  const marker = '...';
  const fits = value => measureTrackerLabel(value, { ...options, paddingX: 0, minW: 0, maxW: 99 }) <= availableTextW;
  if (fits(text)) return text;
  if (availableTextW <= 0 || !fits(marker)) return marker;
  let next = text;
  while (next.length > 0 && !fits(`${next}${marker}`)) {
    next = next.slice(0, -1).trimEnd();
  }
  return next ? `${next}${marker}` : marker;
}

function resolveTrackerTabs(tabs, { startX = 0, safeRight = PPTX_SLIDE_W - 0.48, gap = 0.03, placement = 'left', canvasW = PPTX_SLIDE_W } = {}) {
  const visibleTabs = tabs.filter(tab => tab?.label);
  if (visibleTabs.length === 0) return [];
  const available = Math.max(0, safeRight - startX - gap * (visibleTabs.length - 1));
  const measured = visibleTabs.map(tab => ({
    ...tab,
    naturalW: measureTrackerLabel(tab.label, tab),
  }));
  const naturalTotal = measured.reduce((sum, tab) => sum + tab.naturalW, 0);

  let widths = measured.map(tab => tab.naturalW);
  if (naturalTotal > available) {
    const minTotal = measured.reduce((sum, tab) => sum + (tab.minW || 0.7), 0);
    const flexible = Math.max(0, available - minTotal);
    const naturalFlex = measured.reduce((sum, tab) => sum + Math.max(0, tab.naturalW - (tab.minW || 0.7)), 0) || 1;
    widths = measured.map(tab => {
      const minW = tab.minW || 0.7;
      return minW + flexible * (Math.max(0, tab.naturalW - minW) / naturalFlex);
    });
  }

  // Compute final widths (clamped to minW), then derive an effective startX
  // when placement is 'center' so the resolved tab group centers on the slide.
  const finalWidths = measured.map((tab, index) =>
    Number(Math.max(tab.minW || 0.7, widths[index]).toFixed(3))
  );
  let effectiveStartX = startX;
  if (placement === 'center') {
    const totalW = finalWidths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, finalWidths.length - 1);
    effectiveStartX = Number(Math.max(0, (canvasW - totalW) / 2).toFixed(3));
  }

  let x = effectiveStartX;
  return measured.map((tab, index) => {
    const w = finalWidths[index];
    const textW = Math.max(0, w - (tab.paddingX || 0.22));
    const resolved = {
      ...tab,
      x,
      w,
      text: ellipsizeTrackerLabel(tab.label, textW, tab),
    };
    x = Number((x + w + gap).toFixed(3));
    return resolved;
  });
}

function addTrackerTab(slide, tab) {
  if (!tab?.text) return;
  const shapeOptions = {
    x: tab.x,
    y: tab.y,
    w: tab.w,
    h: tab.h,
    fill: { color: tab.fill },
  };
  if (tab.line) shapeOptions.line = tab.line;
  slide.addShape('rect', shapeOptions);
  const inset = tab.textInset ?? 0.04;
  const textOptions = {
    x: tab.x + inset,
    y: tab.y,
    w: Math.max(0.05, tab.w - inset * 2),
    h: tab.h,
    fontFace: tab.fontFace || profileFontFace('Arial'),
    fontSize: tab.fontSize || 8,
    bold: tab.bold ?? true,
    color: tab.color || COLORS.white,
    valign: 'middle',
    margin: 0,
    fit: 'shrink',
    breakLine: false,
  };
  if (tab.align) textOptions.align = tab.align;
  slide.addText(tab.text, textOptions);
}

function addStcBreadcrumbTracker(slide, sectionLabel, subSectionLabel, tracker) {
  const textPos = tracker?.text || { x: 0.792, y: 0.139, w: 4.167, h: 0.194 };
  const colors = tracker?.colors || {};
  const textColor = colors.text || '9E21FF';
  const subTextColor = colors.subText || COLORS.meta;
  const font = textPos.font || {};
  const fontSize = pptxFontSize(font.fontSize, 9, 8);
  if (!sectionLabel && !subSectionLabel) return;

  const tabs = resolveTrackerTabs([
    {
      label: sectionLabel,
      fontSize,
      bold: font.bold ?? true,
      minW: 2.64,
      maxW: 5.0,
      paddingX: 0.36,
    },
    {
      label: subSectionLabel,
      fontSize,
      bold: false,
      minW: 1.2,
      maxW: 5.0,
      paddingX: 0.36,
    },
  ], { startX: textPos.x, safeRight: PPTX_SLIDE_W - 0.48, gap: 0.14 });

  for (const [index, tab] of tabs.entries()) {
    slide.addText(tab.text, {
      x: tab.x,
      y: textPos.y - 0.004,
      w: tab.w,
      h: Math.max(textPos.h || 0.18, 0.18),
      fontFace: font.fontFace || profileFontFace('STC Forward'),
      fontSize,
      bold: index === 0 && sectionLabel ? (font.bold ?? true) : false,
      color: index === 0 && sectionLabel ? textColor : subTextColor,
      margin: 0,
      valign: 'mid',
      fit: 'shrink',
      breakLine: false,
    });
  }
}

export function addSectionTracker(slide, sectionLabel, subSectionLabel) {
  if (!sectionLabel && !subSectionLabel) return;

  const positions = profilePositions();
  if (positions?.sectionTracker?.variant === 'stcBreadcrumb') {
    addStcBreadcrumbTracker(slide, sectionLabel, subSectionLabel, positions.sectionTracker);
    return;
  }

  // Profile-driven default tab tracker. Strategy& uses the original maroon defaults;
  // PIF (and any other profile) can override colors/font/geometry/placement via
  // chrome.positions.sectionTracker without needing a code branch.
  const cfg = positions?.sectionTracker || {};
  const colors = cfg.colors || {};
  const font = cfg.font || {};
  const placement = cfg.placement || 'left';
  const canvasW = cfg.canvasW || PPTX_SLIDE_W;
  const startX = cfg.x ?? 0;
  const tabY = cfg.y ?? 0;
  const tabH = cfg.h ?? 0.23;
  const subTabH = cfg.subH ?? Math.max(0, tabH - 0.02);
  const fontFace = font.fontFace;
  const fontSize = font.fontSize ?? 8;
  const bold = font.bold ?? true;
  const align = cfg.align;
  const safeRight = (cfg.safeRight ?? canvasW - 0.48);

  const tabs = resolveTrackerTabs([
    {
      label: sectionLabel,
      fill: colors.fill || COLORS.maroon,
      color: colors.text || COLORS.white,
      y: tabY,
      h: tabH,
      fontFace,
      fontSize,
      bold,
      align,
      minW: cfg.minW ?? 0.92,
      maxW: cfg.maxW ?? 5.6,
      paddingX: cfg.paddingX ?? 0.22,
      textInset: cfg.textInset ?? 0.05,
    },
    {
      label: subSectionLabel,
      fill: colors.subFill || COLORS.coal,
      color: colors.subText || COLORS.white,
      y: tabY,
      h: subTabH,
      fontFace,
      fontSize,
      bold,
      align,
      minW: 0.78,
      maxW: 5.3,
      paddingX: 0.2,
      textInset: 0.05,
    },
  ], {
    startX,
    safeRight,
    placement,
    canvasW,
    gap: sectionLabel && subSectionLabel ? 0.03 : 0,
  });

  for (const tab of tabs) {
    addTrackerTab(slide, tab);
  }
}

// ── Title / subtitle helpers ─────────────────────────────────────────────────

export function addTitle(slide, text) {
  slide.addText(text, { x: LAYOUT.titleX, y: LAYOUT.titleY, w: LAYOUT.titleW, h: 0.8, fontFace: profileFontFace('Georgia'), fontSize: 28, color: COLORS.main });
}

export function addSubtitle(slide, text) {
  slide.addText(text, { x: LAYOUT.subtitleX, y: LAYOUT.subtitleY, w: LAYOUT.subtitleW, h: 0.4, fontFace: profileFontFace('Arial'), fontSize: 18, color: COLORS.red, bold: true });
}

// ── Source note ──────────────────────────────────────────────────────────────

// Authoring/research metadata that must never reach the final deck. If any of
// these appear in the source text scraped from slide HTML, drop the entry.
// Mirrors the SlidePreview-side filter so the bug-fix guard applies even if
// the upstream channel changes.
const NON_RENDERABLE_SOURCE_MARKERS = [
  'search web',
  'search this source',
  'generated from slide source text',
  'use as source for',
  'use as general contextual anchor',
  'needs source',
  'needs_source',
  'web_search_query',
];

function isLeakedSourceText(value) {
  if (typeof value !== 'string') return false;
  const lower = value.toLowerCase();
  return NON_RENDERABLE_SOURCE_MARKERS.some(marker => lower.includes(marker));
}

export function addSourceNote(slide, html) {
  if (!html) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const selectors = [
    'footer .source', '.graph-source', '.exhibit-source', '.chart-source',
    '.chart-commentary-source', '.benefit-sources', '.source-note',
    '.exec-takeaway-source', '.stat-source',
  ];
  const texts = [];
  for (const sel of selectors) {
    doc.querySelectorAll(sel).forEach(el => {
      const t = el.textContent?.trim();
      if (!t || texts.includes(t)) return;
      if (isLeakedSourceText(t)) return;
      texts.push(t);
    });
  }
  if (texts.length === 0) return;
  const positions = profilePositions();
  const ftrPos = positions?.footer;
  const ftrFont = ftrPos?.font || {};
  slide.addText(texts.join(' | '), {
    x: ftrPos?.x ?? STRATEGY_SOURCE_DEFAULT.x,
    y: ftrPos?.y ?? STRATEGY_SOURCE_DEFAULT.y,
    w: ftrPos?.w ?? STRATEGY_SOURCE_DEFAULT.w,
    h: ftrPos?.h ?? STRATEGY_SOURCE_DEFAULT.h,
    fontFace: ftrFont.fontFace || profileFontFace('Arial'),
    fontSize: pptxFontSize(ftrFont.fontSize, STRATEGY_FOOTER_FONT_SIZE, STRATEGY_FOOTER_FONT_SIZE),
    italic: ftrFont.italic ?? true,
    color: ftrFont.color || COLORS.meta,
    align: 'left',
  });
}

// ── parseHTML ────────────────────────────────────────────────────────────────

export function parseHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '<div></div>', 'text/html');
  const getText = (selector) => { const el = doc.querySelector(selector); return el ? el.textContent.trim() : ''; };
  const getAll = (selector) => Array.from(doc.querySelectorAll(selector)).map(el => el.textContent.trim());
  const getAllElements = (selector) => Array.from(doc.querySelectorAll(selector));
  return { doc, getText, getAll, getAllElements };
}

// ── Renderer helpers bundle ──────────────────────────────────────────────────

const rendererHelpers = { addFooter, addTitle, addSubtitle, addSourceNote, COLORS, LAYOUT, parseHTML };

export function createRendererFromCode(codeString) {
  try {
    if (codeString.trim().startsWith('function render(') || codeString.trim().startsWith('function(')) {
      const createRenderer = new Function('helpers', `
        const { addFooter, addTitle, addSubtitle, addSourceNote, COLORS, LAYOUT, parseHTML } = helpers;
        const rendererFn = ${codeString};
        return function(pptx, slideData, slideNum, totalSlides) {
          return rendererFn(pptx, slideData, slideNum, totalSlides, helpers);
        };
      `);
      return createRenderer(rendererHelpers);
    } else {
      const wrappedCode = `
        return function(pptx, slideData, slideNum, totalSlides) {
          const { addFooter, addTitle, addSubtitle, addSourceNote, COLORS, LAYOUT, parseHTML } = helpers;
          ${codeString}
        };
      `;
      return new Function('helpers', wrappedCode)(rendererHelpers);
    }
  } catch (error) {
    console.error('Error creating renderer from code:', error);
    return null;
  }
}

export function renderWithStoredCode(pptx, slideData, slideNum, totalSlides) {
  if (!slideData.pptxRendererCode) return false;
  try {
    const renderer = createRendererFromCode(slideData.pptxRendererCode);
    if (renderer) { renderer(pptx, slideData, slideNum, totalSlides); return true; }
  } catch (error) { console.warn('Error rendering with stored code:', error); }
  return false;
}

export function getRendererForSlide() { return null; }

export { rendererHelpers };
