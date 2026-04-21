// Paired PPTX emitter: pure translation from pptxOps JSON to pptxgenjs calls.
//
// Ports every fidelity lesson learned in llm-dom-to-pptx.js (text-transform
// written in the HTML as final case; letter-spacing -> charSpacing;
// sup/sub; hyperlink; line-through; writing-mode / transform: rotate).
// The LLM is responsible for baking those semantics into the op fields, so
// the emitter stays deterministic - no DOM measurement, no CSS parsing.
//
// The one exception is `rasterize`: when the LLM cannot express a region
// (complex inline SVG, radial gradient, etc.), it emits `{ op: 'rasterize',
// id, x, y, w, h }` and the emitter looks up `[data-pptx-id="<id>"]` on the
// offscreen DOM root (if one was provided), rasterizes that element via an
// inline SVG round-trip (for <svg>) or html2canvas (for anything else), and
// calls addImage.

import { CANVAS } from './schema.js';

const PX_TO_IN = CANVAS.wIn / CANVAS.wPx;

function pxToInch(px) {
  const n = parseFloat(px);
  if (!Number.isFinite(n)) return 0;
  return n * PX_TO_IN;
}

function safeNum(val, min = 0) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return min;
  return n < min ? min : n;
}

function normColor(c) {
  if (!c) return null;
  const s = String(c).trim();
  if (!s) return null;
  if (s.startsWith('#')) return s.slice(1).toUpperCase();
  if (/^[0-9a-f]{3,8}$/i.test(s)) return s.toUpperCase();
  return s;
}

function toFillObj(fillSpec) {
  if (!fillSpec) return null;
  const color = normColor(fillSpec.color);
  if (!color) return null;
  const out = { color };
  if (Number.isFinite(fillSpec.transparency) && fillSpec.transparency > 0) {
    out.transparency = fillSpec.transparency;
  }
  return out;
}

function toLineObj(lineSpec) {
  if (!lineSpec) return null;
  const color = normColor(lineSpec.color);
  if (!color) return null;
  const out = { color };
  if (Number.isFinite(lineSpec.width) && lineSpec.width > 0) out.width = lineSpec.width;
  if (lineSpec.dashType && lineSpec.dashType !== 'solid') out.dashType = lineSpec.dashType;
  if (Number.isFinite(lineSpec.transparency) && lineSpec.transparency > 0) {
    out.transparency = lineSpec.transparency;
  }
  return out;
}

function toPptxRuns(runs) {
  if (!Array.isArray(runs)) return [];
  const out = [];
  for (const run of runs) {
    if (!run) continue;
    // breakLine runs carry no text
    if (run.breakLine && !run.text) {
      out.push({ text: '', options: { breakLine: true } });
      continue;
    }
    const options = {};
    if (run.bold) options.bold = true;
    if (run.italic) options.italic = true;
    if (run.underline) options.underline = { style: 'sng' };
    if (run.strike) options.strike = 'sngStrike';
    if (run.superscript) options.superscript = true;
    if (run.subscript) options.subscript = true;
    if (run.breakLine) options.breakLine = true;
    const color = normColor(run.color);
    if (color) options.color = color;
    if (Number.isFinite(run.fontSize) && run.fontSize > 0) options.fontSize = run.fontSize;
    if (run.fontFace) options.fontFace = run.fontFace;
    if (Number.isFinite(run.charSpacing) && Math.abs(run.charSpacing) >= 0.1) {
      options.charSpacing = run.charSpacing;
    }
    if (run.hyperlinkUrl) {
      options.hyperlink = { url: run.hyperlinkUrl };
    }
    out.push({ text: String(run.text ?? ''), options });
  }
  return out;
}

function boxToInches(op) {
  return {
    x: safeNum(pxToInch(op.x), 0),
    y: safeNum(pxToInch(op.y), 0),
    w: safeNum(pxToInch(op.w), 0.01),
    h: safeNum(pxToInch(op.h), 0.01),
  };
}

// ────────────────────────────── Op handlers ─────────────────────────────────

function emitAddText(slide, op) {
  const { x, y, w, h } = boxToInches(op);
  const runs = toPptxRuns(op.runs);
  if (runs.length === 0) return;
  const textOpts = { x, y, w, h, wrap: op.wrap !== false, inset: 0 };
  if (op.align) textOpts.align = op.align;
  if (op.valign) textOpts.valign = op.valign;
  if (Number.isFinite(op.lineSpacing) && op.lineSpacing > 0) textOpts.lineSpacing = op.lineSpacing;
  if (op.vert) textOpts.vert = op.vert;
  else if (Number.isFinite(op.rotate) && op.rotate !== 0) textOpts.rotate = op.rotate;
  const fill = toFillObj(op.fill);
  if (fill) textOpts.fill = fill;
  slide.addText(runs, textOpts);
}

function emitAddShape(slide, op) {
  const { x, y, w, h } = boxToInches(op);
  const shape = op.shape || 'rect';
  const opts = { x, y, w, h };
  const fill = toFillObj(op.fill);
  if (fill) opts.fill = fill;
  const line = toLineObj(op.line);
  if (line) opts.line = line;
  if (Number.isFinite(op.rectRadius) && op.rectRadius > 0 && shape === 'roundRect') {
    opts.rectRadius = Math.min(1, Math.max(0, op.rectRadius));
  }
  if (Number.isFinite(op.rotate) && op.rotate !== 0) opts.rotate = op.rotate;
  slide.addShape(shape, opts);
}

function emitAddImage(slide, op) {
  const { x, y, w, h } = boxToInches(op);
  const opts = { x, y, w, h };
  if (op.data) opts.data = op.data;
  else if (op.path) opts.path = op.path;
  else return;
  if (Number.isFinite(op.rotate) && op.rotate !== 0) opts.rotate = op.rotate;
  slide.addImage(opts);
}

function emitAddTable(slide, op) {
  const { x, y, w, h } = boxToInches(op);
  if (!Array.isArray(op.rows) || op.rows.length === 0) return;
  const rows = op.rows.map((row) =>
    row.map((cell) => {
      if (!cell) return { text: '' };
      const opts = {};
      if (cell.bold) opts.bold = true;
      const color = normColor(cell.color);
      if (color) opts.color = color;
      const fill = toFillObj(cell.fill);
      if (fill) opts.fill = fill;
      if (cell.align) opts.align = cell.align;
      if (cell.valign) opts.valign = cell.valign;
      if (Number.isFinite(cell.fontSize) && cell.fontSize > 0) opts.fontSize = cell.fontSize;
      return { text: String(cell.text ?? ''), options: opts };
    }),
  );
  const tableOpts = { x, y, w, h };
  if (Array.isArray(op.colW) && op.colW.length > 0) {
    tableOpts.colW = op.colW.map(pxToInch);
  }
  const border = toLineObj(op.border);
  if (border) {
    tableOpts.border = {
      type: 'solid',
      pt: Math.max(0.5, border.width || 1),
      color: border.color,
    };
  }
  slide.addTable(rows, tableOpts);
}

function emitAddChart(pres, slide, op) {
  const { x, y, w, h } = boxToInches(op);
  const chartTypeMap = {
    bar: pres.ChartType.bar,
    col: pres.ChartType.bar,
    line: pres.ChartType.line,
    pie: pres.ChartType.pie,
    area: pres.ChartType.area,
    doughnut: pres.ChartType.doughnut,
  };
  const type = chartTypeMap[op.chartType] || pres.ChartType.bar;
  const chartOpts = {
    x, y, w, h,
    barDir: op.barDir || (op.chartType === 'bar' ? 'bar' : 'col'),
    showLegend: !!op.showLegend,
    showValue: !!op.showValue,
  };
  if (Array.isArray(op.chartColors) && op.chartColors.length > 0) {
    chartOpts.chartColors = op.chartColors.map(normColor).filter(Boolean);
  }
  slide.addChart(type, op.data, chartOpts);
}

// ────────────────────────────── Rasterize ──────────────────────────────────

async function svgElementToDataUrl(svg) {
  try {
    const cloned = svg.cloneNode(true);
    const rect = svg.getBoundingClientRect();
    const w = safeNum(rect.width, 24);
    const h = safeNum(rect.height, 24);
    cloned.setAttribute('width', w);
    cloned.setAttribute('height', h);
    const xml = new XMLSerializer().serializeToString(cloned);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w * 2;
        canvas.height = h * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

async function domElementToDataUrl(element) {
  if (!element) return null;
  if (element.tagName === 'svg' || element.tagName === 'SVG') {
    return svgElementToDataUrl(element);
  }
  // Non-SVG: try html2canvas if available. Kept dynamic so the emitter never
  // pulls html2canvas into the bundle path when rasterize ops are unused.
  try {
    const mod = await import('html2canvas');
    const html2canvas = mod.default || mod;
    const canvas = await html2canvas(element, { backgroundColor: null, scale: 2 });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[pairedPptx/emitter] rasterize failed (html2canvas):', err?.message || err);
    return null;
  }
}

async function emitRasterize(slide, op, domRoot) {
  if (!domRoot) {
    console.warn(`[pairedPptx/emitter] rasterize op "${op.id}" skipped (no domRoot)`);
    return;
  }
  const el = domRoot.querySelector(`[data-pptx-id="${CSS.escape(op.id)}"]`);
  if (!el) {
    console.warn(`[pairedPptx/emitter] rasterize op "${op.id}" skipped (no matching data-pptx-id)`);
    return;
  }
  const dataUri = await domElementToDataUrl(el);
  if (!dataUri) return;
  const { x, y, w, h } = boxToInches(op);
  slide.addImage({ data: dataUri, x, y, w, h });
}

// ────────────────────────────── Public API ─────────────────────────────────

/**
 * Emit a single slide into an existing pptxgenjs presentation.
 *
 * @param {object} pres - pptxgenjs Presentation instance.
 * @param {object} slide - pres.addSlide() result.
 * @param {Array} ops - pptxOps array.
 * @param {object} [options]
 * @param {HTMLElement|null} [options.domRoot=null] - offscreen slide element
 *   used for rasterize ops. When null, rasterize ops are skipped.
 * @returns {Promise<{ emitted: number, skipped: number, rasterized: number }>}
 */
export async function emitPairedSlide(pres, slide, ops, options = {}) {
  const { domRoot = null } = options;
  let emitted = 0;
  let skipped = 0;
  let rasterized = 0;
  if (!Array.isArray(ops)) return { emitted, skipped, rasterized };

  for (const op of ops) {
    if (!op || typeof op !== 'object') {
      skipped++;
      continue;
    }
    try {
      switch (op.op) {
        case 'addText':
          emitAddText(slide, op); emitted++; break;
        case 'addShape':
          emitAddShape(slide, op); emitted++; break;
        case 'addImage':
          emitAddImage(slide, op); emitted++; break;
        case 'addTable':
          emitAddTable(slide, op); emitted++; break;
        case 'addChart':
          emitAddChart(pres, slide, op); emitted++; break;
        case 'addGroup':
          // Flat groups: serve as logical tags only.
          skipped++; break;
        case 'rasterize':
          await emitRasterize(slide, op, domRoot); rasterized++; break;
        default:
          console.warn(`[pairedPptx/emitter] unknown op "${op?.op}"`);
          skipped++;
      }
    } catch (err) {
      console.error(`[pairedPptx/emitter] op "${op.op}" (id=${op.id}) threw:`, err);
      skipped++;
    }
  }
  return { emitted, skipped, rasterized };
}
