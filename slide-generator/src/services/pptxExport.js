// Native PPTX export service.
//
// Dispatches slide HTML/CSS to one of the vendored DOM-to-PPTX libraries or
// to the in-repo paired-llm emitter. Every engine produces editable pptxgenjs
// elements. No LLM involvement at export time; the paired engine just reads
// pre-computed ops the LLM authored during slide generation.
//
// Engines:
//   'paired-llm'       - slide-generator/src/services/pairedPptx (reads
//                        slide.pptxOps authored by the LLM; falls back to
//                        llm-dom-to-pptx for slides that do not carry ops).
//   'llm-dom-to-pptx'  - llm-dom-to-pptx@1.2.7 (gradients + shadows + SVG
//                        rasterization + speaker notes; no native tables).
//   'html-to-pptx'     - joker-duzhong/html-to-pptx (native tables + charts;
//                        no gradients/shadows/SVG).
//
// See slide-generator/src/vendor/*/README.md for the per-engine feature matrix.

import PptxGenJS from 'pptxgenjs';
import { saveAs } from 'file-saver';
import { themeToCSS } from '../utils/themeUtils';
import SHELL_CSS from '../styles/slides.css?raw';
import { html2pptx } from '../vendor/html-to-pptx/index.js';
import { exportLlmDomToPptx } from '../vendor/llm-dom-to-pptx/llm-dom-to-pptx.js';
import {
  CANVAS as PAIRED_CANVAS,
  emitPairedSlide,
  validatePaired,
  summarizeValidation,
  DEFAULT_HARD_TOLERANCE_PX,
} from './pairedPptx/index.js';

// Match slide-generator's widescreen 16:9 canvas.
const SLIDE_PX = { w: 960, h: 540 };
const LAYOUT_IN = { w: 13.333, h: 7.5 };

// Root class used to tag each offscreen slide so engines can querySelectorAll it.
const PAGE_CLASS = 'pptx-export-page';

export const PPTX_EXPORT_ENGINES = [
  {
    id: 'paired-llm',
    label: 'paired-llm (LLM co-generated ops, experimental)',
    description:
      'Uses LLM-authored pptxOps per slide for maximum editability. Falls back to llm-dom-to-pptx when a slide lacks ops or fails bbox validation.',
  },
  {
    id: 'llm-dom-to-pptx',
    label: 'llm-dom-to-pptx (v1.2.7, Jan 2026)',
    description:
      'Best DOM-walk fidelity. Rasterizes gradients/shadows/SVG backgrounds to PNG but keeps all text editable.',
  },
  {
    id: 'html-to-pptx',
    label: 'html-to-pptx (joker-duzhong, Dec 2025)',
    description:
      'Fully native shapes (no images). Loses gradients/shadows/SVG; best for plain text layouts.',
  },
];

// Default to paired-llm. When a slide carries LLM-authored pptxOps the
// paired engine emits fully native editable elements; when it doesn't (or
// validation fails), it silently falls back to llm-dom-to-pptx, so users
// never see a worse result than the previous default.
export const DEFAULT_PPTX_ENGINE = 'paired-llm';

function reportProgress(onProgress, payload) {
  if (typeof onProgress === 'function') {
    try {
      onProgress(payload);
    } catch (err) {
      console.warn('[pptxExport] onProgress callback threw:', err);
    }
  }
}

function ensurePptxExtension(name) {
  if (!name) return 'presentation.pptx';
  return name.endsWith('.pptx') ? name : `${name}.pptx`;
}

// Extracts the inner HTML of the outer `.slide` wrapper if present, so the
// export page element itself can carry both `.slide` and the engine page class
// without nesting another `.slide` inside.
function extractSlideInner(slideHtml) {
  if (!slideHtml) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = slideHtml;
  const inner = tmp.querySelector('.slide');
  return inner ? inner.innerHTML : slideHtml;
}

// Freeze SVG paint so the vendor's XMLSerializer-based rasterization preserves
// colors authored via external CSS. Without this, fills set in a <style> block
// are lost during cloneNode -> serialize -> Blob -> Image, and every path
// renders with the SVG default (black).
const SVG_PAINT_ATTRS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'fill-opacity',
  'opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
];

function inlineSvgStyles(root) {
  const elements = root.querySelectorAll('svg *');
  elements.forEach((el) => {
    const computed = window.getComputedStyle(el);
    SVG_PAINT_ATTRS.forEach((attr) => {
      const val = computed.getPropertyValue(attr);
      if (!val || val === 'none') return;
      if (el.getAttribute(attr)) return;
      el.setAttribute(attr, val.trim());
    });
  });
}

// Builds the offscreen DOM tree that both engines will read. Mirrors the CSS
// stack used by SlidePreview: slides.css shell -> theme vars -> deck sharedCSS
// -> per-slide customCSS. Returns the created root so the caller can clean up.
async function buildOffscreenDeck(slides, { theme, sharedCSS, darkMode }) {
  const root = document.createElement('div');
  root.setAttribute('data-pptx-export-root', 'true');
  root.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: -20000px',
    'background: #ffffff',
    'z-index: -1',
    'pointer-events: none',
  ].join(';');

  const themeCSS = theme ? themeToCSS(theme) : '';
  const combinedCustomCSS = slides
    .map((s) => s.customCSS || '')
    .filter(Boolean)
    .join('\n\n');

  const style = document.createElement('style');
  style.textContent = [SHELL_CSS, themeCSS, sharedCSS || '', combinedCustomCSS].join('\n\n');
  root.appendChild(style);

  slides.forEach((slide) => {
    const page = document.createElement('div');
    page.className = `${PAGE_CLASS} slide`;
    if (slide.id) page.setAttribute('data-slide-id', slide.id);
    if (darkMode) page.setAttribute('data-dark-mode', 'true');
    page.style.cssText = [
      `width: ${SLIDE_PX.w}px`,
      `height: ${SLIDE_PX.h}px`,
      'position: relative',
      'overflow: hidden',
      'background: #ffffff',
      'margin: 0 0 8px 0',
      'box-sizing: border-box',
    ].join(';');
    page.innerHTML = extractSlideInner(slide.html);
    root.appendChild(page);
  });

  document.body.appendChild(root);

  try {
    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      await document.fonts.ready;
    }
  } catch (err) {
    console.warn('[pptxExport] document.fonts.ready failed:', err);
  }

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  inlineSvgStyles(root);

  return root;
}

async function exportWithHtmlToPptx(slides, filename, buildCtx, onProgress) {
  reportProgress(onProgress, { phase: 'rendering', processed: 0, total: slides.length });
  const root = await buildOffscreenDeck(slides, buildCtx);
  try {
    reportProgress(onProgress, { phase: 'generating', processed: slides.length, total: slides.length });
    const pptx = await html2pptx(PAGE_CLASS, {
      layout: 'LAYOUT_WIDE',
      width: LAYOUT_IN.w,
      height: LAYOUT_IN.h,
    });
    await pptx.writeFile({ fileName: ensurePptxExtension(filename) });
    reportProgress(onProgress, { phase: 'complete', processed: slides.length, total: slides.length });
  } finally {
    if (root.parentNode) root.parentNode.removeChild(root);
  }
}

async function exportWithLlmDomToPptx(slides, filename, buildCtx, onProgress) {
  reportProgress(onProgress, { phase: 'rendering', processed: 0, total: slides.length });
  const root = await buildOffscreenDeck(slides, buildCtx);
  try {
    reportProgress(onProgress, { phase: 'generating', processed: slides.length, total: slides.length });
    await exportLlmDomToPptx(`.${PAGE_CLASS}`, { fileName: ensurePptxExtension(filename) });
    reportProgress(onProgress, { phase: 'complete', processed: slides.length, total: slides.length });
  } finally {
    if (root.parentNode) root.parentNode.removeChild(root);
  }
}

// Paired-LLM engine. When every slide carries validated pptxOps, the ops feed
// directly into a fresh pptxgenjs deck. If any slide lacks ops or fails hard
// bbox validation, the engine silently falls back to llm-dom-to-pptx for the
// entire deck so the user gets one consistent file.
async function exportWithPairedLlm(slides, filename, buildCtx, onProgress) {
  reportProgress(onProgress, { phase: 'rendering', processed: 0, total: slides.length });

  // Quick check: is any slide missing ops? If so, fall back now and skip the
  // offscreen DOM build for nothing.
  const missingOps = slides.some(
    (s) => !Array.isArray(s?.pptxOps) || s.pptxOps.length === 0,
  );
  if (missingOps) {
    console.log(
      '[pptxExport/paired-llm] %d slide(s) lack pptxOps — falling back to llm-dom-to-pptx for the full deck.',
      slides.filter((s) => !Array.isArray(s?.pptxOps) || s.pptxOps.length === 0).length,
    );
    return exportWithLlmDomToPptx(slides, filename, buildCtx, onProgress);
  }

  // All slides have ops. Build the offscreen deck so we can cross-validate the
  // op coords against data-pptx-id bounding boxes and support rasterize ops
  // that need the live DOM.
  const root = await buildOffscreenDeck(slides, buildCtx);
  const pageEls = root.querySelectorAll(`.${PAGE_CLASS}`);

  try {
    let softDriftSlides = 0;
    let hardDriftSlides = 0;
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const report = validatePaired(
        { html: slide.html, customCss: slide.customCSS || '', pptxOps: slide.pptxOps },
        pageEls[i] || null,
      );
      console.log('[pptxExport/paired-llm] slide %d: %s', i + 1, summarizeValidation(report));
      if (!report.schema.ok) {
        console.warn(
          '[pptxExport/paired-llm] slide %d schema failed — falling back to DOM walker for the full deck.',
          i + 1,
          report.schema.errors.slice(0, 5),
        );
        return exportWithLlmDomToPptx(slides, filename, buildCtx, onProgress);
      }
      const hard = report.bbox?.hardFailures?.length || 0;
      const missing = report.bbox?.missing?.length || 0;
      if (hard > 0 || missing > 0) {
        hardDriftSlides++;
        console.warn(
          '[pptxExport/paired-llm] slide %d hard bbox drift (>%dpx): %d element(s), %d missing DOM node(s) — falling back to DOM walker for the full deck.',
          i + 1,
          DEFAULT_HARD_TOLERANCE_PX,
          hard,
          missing,
        );
        return exportWithLlmDomToPptx(slides, filename, buildCtx, onProgress);
      }
      if ((report.bbox?.softFailures?.length || 0) > 0) softDriftSlides++;
    }

    reportProgress(onProgress, { phase: 'generating', processed: 0, total: slides.length });

    const pres = new PptxGenJS();
    pres.defineLayout({
      name: 'PAIRED_WIDE',
      width: PAIRED_CANVAS.wIn,
      height: PAIRED_CANVAS.hIn,
    });
    pres.layout = 'PAIRED_WIDE';

    for (let i = 0; i < slides.length; i++) {
      const pres_slide = pres.addSlide();
      await emitPairedSlide(pres, pres_slide, slides[i].pptxOps, {
        domRoot: pageEls[i] || null,
      });
      reportProgress(onProgress, {
        phase: 'generating',
        processed: i + 1,
        total: slides.length,
      });
    }

    await pres.writeFile({ fileName: ensurePptxExtension(filename) });

    reportProgress(onProgress, {
      phase: 'complete',
      processed: slides.length,
      total: slides.length,
      pairedSlides: slides.length,
      softDriftSlides,
      hardDriftSlides,
    });
  } finally {
    if (root.parentNode) root.parentNode.removeChild(root);
  }
}

/**
 * Export slides to a native editable PPTX file.
 *
 * @param {Array} slides - slide objects ({ id, html, customCSS, title, type, ... }).
 * @param {string} filename - target filename (".pptx" appended if missing).
 * @param {object} settings - { theme, sharedCSS, darkMode }.
 * @param {Function} [onProgress] - called with { phase, processed, total }.
 * @param {object} [engineOptions] - { engine: 'html-to-pptx' | 'llm-dom-to-pptx' }.
 * @returns {Promise<void>}
 */
export async function exportToPPTX(slides, filename, settings = {}, onProgress = null, engineOptions = {}) {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error('[pptxExport] no slides to export');
  }

  const { engine = DEFAULT_PPTX_ENGINE } = engineOptions;
  const buildCtx = {
    theme: settings.theme || null,
    sharedCSS: settings.sharedCSS || '',
    darkMode: Boolean(settings.darkMode),
  };

  if (engine === 'html-to-pptx') {
    return exportWithHtmlToPptx(slides, filename, buildCtx, onProgress);
  }
  if (engine === 'llm-dom-to-pptx') {
    return exportWithLlmDomToPptx(slides, filename, buildCtx, onProgress);
  }
  if (engine === 'paired-llm') {
    return exportWithPairedLlm(slides, filename, buildCtx, onProgress);
  }
  throw new Error(`[pptxExport] unknown engine: ${engine}`);
}

/**
 * Run both engines against the same slide set. Produces two downloads with
 * suffixed filenames so the user can compare side-by-side in PowerPoint.
 */
export async function exportBakeoff(slides, baseFilename, settings = {}, onProgress = null) {
  const base = baseFilename.replace(/\.pptx$/i, '');
  const results = [];
  for (const engine of PPTX_EXPORT_ENGINES) {
    reportProgress(onProgress, {
      phase: 'engine-start',
      engine: engine.id,
      total: PPTX_EXPORT_ENGINES.length,
    });
    try {
      await exportToPPTX(
        slides,
        `${base}.${engine.id}.pptx`,
        settings,
        onProgress,
        { engine: engine.id },
      );
      results.push({ engine: engine.id, ok: true });
    } catch (err) {
      console.error(`[pptxExport] ${engine.id} failed:`, err);
      results.push({ engine: engine.id, ok: false, error: err.message });
    }
  }
  reportProgress(onProgress, { phase: 'bakeoff-complete', results });
  return results;
}

// Re-exported for callers that want to bundle their own Blob/writeFile pipeline.
export { saveAs };
