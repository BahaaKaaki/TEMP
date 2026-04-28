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

export function pptxFontSize(size, fallback = 10) {
  const numeric = Number(size ?? fallback);
  return Math.max(10, Number.isFinite(numeric) ? numeric : fallback);
}

// ── Footer branding ──────────────────────────────────────────────────────────

let _footerBranding = 'Strategy&';
let _tplPositions = null;

export function setFooterBranding(branding) {
  _footerBranding = branding ?? 'Strategy&';
}

export function setTemplatePositions(positions) {
  _tplPositions = positions || null;
}

export function addFooter(slide, slideNum, totalSlides, slideType) {
  if (!slide || !slideNum) return;
  if (slideType === 'cover') return;

  const numPos = _tplPositions?.slideNum;
  const numFont = numPos?.font || {};
  slide.addText(String(slideNum), {
    x: numPos?.x ?? 11.5,
    y: numPos?.y ?? 7.05,
    w: numPos?.w ?? 1.3,
    h: numPos?.h ?? 0.25,
    fontFace: numFont.fontFace || 'Arial',
    fontSize: pptxFontSize(numFont.fontSize, 10),
    bold: numFont.bold || false,
    color: COLORS.meta,
    align: 'right',
  });
}

// ── Section tracker ──────────────────────────────────────────────────────────

export function addSectionTracker(slide, sectionLabel, subSectionLabel) {
  if (!sectionLabel && !subSectionLabel) return;

  if (sectionLabel) {
    const sectionW = Math.max(1.0, sectionLabel.length * 0.065 + 0.35);
    slide.addShape('rect', { x: 0, y: 0, w: sectionW, h: 0.28, fill: { color: COLORS.maroon } });
    slide.addText(sectionLabel, { x: 0.05, y: 0, w: sectionW - 0.1, h: 0.28, fontFace: 'Arial', fontSize: 10, bold: true, color: COLORS.white, valign: 'middle' });

    if (subSectionLabel) {
      const subW = Math.max(0.8, subSectionLabel.length * 0.06 + 0.3);
      const subX = sectionW + 0.04;
      slide.addShape('rect', { x: subX, y: 0, w: subW, h: 0.25, fill: { color: COLORS.coal } });
      slide.addText(subSectionLabel, { x: subX + 0.05, y: 0, w: subW - 0.1, h: 0.25, fontFace: 'Arial', fontSize: 10, bold: true, color: COLORS.white, valign: 'middle' });
    }
  } else if (subSectionLabel) {
    const subW = Math.max(0.8, subSectionLabel.length * 0.06 + 0.3);
    slide.addShape('rect', { x: 0, y: 0, w: subW, h: 0.25, fill: { color: COLORS.coal } });
    slide.addText(subSectionLabel, { x: 0.05, y: 0, w: subW - 0.1, h: 0.25, fontFace: 'Arial', fontSize: 10, bold: true, color: COLORS.white, valign: 'middle' });
  }
}

// ── Title / subtitle helpers ─────────────────────────────────────────────────

export function addTitle(slide, text) {
  slide.addText(text, { x: LAYOUT.titleX, y: LAYOUT.titleY, w: LAYOUT.titleW, h: 0.8, fontFace: 'Georgia', fontSize: 28, color: COLORS.main });
}

export function addSubtitle(slide, text) {
  slide.addText(text, { x: LAYOUT.subtitleX, y: LAYOUT.subtitleY, w: LAYOUT.subtitleW, h: 0.4, fontFace: 'Arial', fontSize: 18, color: COLORS.red, bold: true });
}

// ── Source note ──────────────────────────────────────────────────────────────

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
      if (t && !texts.includes(t)) texts.push(t);
    });
  }
  if (texts.length === 0) return;
  const ftrPos = _tplPositions?.footer;
  const ftrFont = ftrPos?.font || {};
  slide.addText(texts.join(' | '), {
    x: ftrPos?.x ?? 2.5,
    y: ftrPos?.y ?? 7.05,
    w: ftrPos?.w ?? 8.5,
    h: ftrPos?.h ?? 0.25,
    fontFace: ftrFont.fontFace || 'Arial',
    fontSize: pptxFontSize(ftrFont.fontSize, 10),
    italic: ftrFont.italic ?? true,
    color: COLORS.meta,
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
