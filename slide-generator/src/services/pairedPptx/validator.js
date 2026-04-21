// Paired PPTX validator: two-phase defense for the LLM's structured output.
//
// Phase 1 - Schema: ensures every op is well-formed before it reaches the
// emitter. Delegates to validatePairedOutput() from schema.js.
//
// Phase 2 - DOM-bbox cross-check: for every op with an `id`, look up
// `[data-pptx-id="<id>"]` on the paired offscreen slide element and compare
// the CSS bbox with the op's coords. This catches the class of errors where
// the LLM authored two channels that drifted apart (e.g. moved an element in
// HTML but forgot to update pptxOps). The exporter uses the drift report to
// decide between:
//   - soft drift  (<= softTolerancePx per axis): log + continue
//   - hard drift  (any axis > hardTolerancePx): regenerate once, then fall
//     back to the llm-dom-to-pptx engine for the whole slide.

import { validatePairedOutput } from './schema.js';

export const DEFAULT_SOFT_TOLERANCE_PX = 4;
export const DEFAULT_HARD_TOLERANCE_PX = 12;

/**
 * Compare every positioned op to the bbox of its paired HTML element.
 * Ops with `op === 'addGroup'` are skipped (no geometry by design).
 *
 * @param {object} pairedOutput - { html, customCss, pptxOps }
 * @param {HTMLElement} slideEl - the rendered offscreen slide root element.
 *   Must itself be sized 960x540 and have `position: relative` so child
 *   bboxes are comparable to op coords.
 * @param {object} [options]
 * @param {number} [options.softTolerancePx=4]
 * @param {number} [options.hardTolerancePx=12]
 * @returns {{
 *   ok: boolean,
 *   hardFailures: Array<{ id: string, expected: object, actual: object, diff: object }>,
 *   softFailures: Array<{ id: string, expected: object, actual: object, diff: object }>,
 *   missing: string[],
 *   unmatchedDomIds: string[],
 * }}
 */
export function crossValidateBboxes(pairedOutput, slideEl, options = {}) {
  const softTol = options.softTolerancePx ?? DEFAULT_SOFT_TOLERANCE_PX;
  const hardTol = options.hardTolerancePx ?? DEFAULT_HARD_TOLERANCE_PX;
  const hardFailures = [];
  const softFailures = [];
  const missing = [];

  if (!slideEl || typeof slideEl.getBoundingClientRect !== 'function') {
    return { ok: false, hardFailures, softFailures, missing, unmatchedDomIds: [] };
  }
  const containerRect = slideEl.getBoundingClientRect();

  const seenOpIds = new Set();
  for (const op of pairedOutput?.pptxOps || []) {
    if (!op || op.op === 'addGroup') continue;
    if (typeof op.id !== 'string' || !op.id) continue;
    seenOpIds.add(op.id);

    const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(op.id) : op.id;
    const el = slideEl.querySelector(`[data-pptx-id="${safeId}"]`);
    if (!el) {
      missing.push(op.id);
      continue;
    }
    const r = el.getBoundingClientRect();
    const actual = {
      x: r.left - containerRect.left,
      y: r.top - containerRect.top,
      w: r.width,
      h: r.height,
    };
    const expected = { x: op.x, y: op.y, w: op.w, h: op.h };
    const diff = {
      dx: Math.abs(actual.x - expected.x),
      dy: Math.abs(actual.y - expected.y),
      dw: Math.abs(actual.w - expected.w),
      dh: Math.abs(actual.h - expected.h),
    };
    const worst = Math.max(diff.dx, diff.dy, diff.dw, diff.dh);
    if (worst > hardTol) hardFailures.push({ id: op.id, expected, actual, diff });
    else if (worst > softTol) softFailures.push({ id: op.id, expected, actual, diff });
  }

  // Stray data-pptx-ids in the DOM without a matching op are informational:
  // they suggest the LLM tagged an element but forgot to emit the op.
  const unmatchedDomIds = [];
  const tagged = slideEl.querySelectorAll('[data-pptx-id]');
  tagged.forEach((el) => {
    const id = el.getAttribute('data-pptx-id');
    if (id && !seenOpIds.has(id)) unmatchedDomIds.push(id);
  });

  return {
    ok: hardFailures.length === 0 && missing.length === 0,
    hardFailures,
    softFailures,
    missing,
    unmatchedDomIds,
  };
}

/**
 * Run both validation phases. Returns a pure-JS report suitable for logging
 * and decision-making; does not throw.
 *
 * @param {object} pairedOutput
 * @param {HTMLElement|null} [slideEl]
 * @param {object} [options]
 * @returns {{
 *   ok: boolean,
 *   schema: { ok: boolean, errors: object[] },
 *   bbox: ReturnType<typeof crossValidateBboxes> | null,
 * }}
 */
export function validatePaired(pairedOutput, slideEl = null, options = {}) {
  const schema = validatePairedOutput(pairedOutput);
  const bbox = slideEl ? crossValidateBboxes(pairedOutput, slideEl, options) : null;
  const ok = schema.ok && (!bbox || bbox.ok);
  return { ok, schema, bbox };
}

/**
 * Build a single-line summary for logs.
 */
export function summarizeValidation(report) {
  const parts = [];
  if (!report.schema.ok) parts.push(`schema(${report.schema.errors.length} errors)`);
  else parts.push('schema(ok)');
  if (report.bbox) {
    if (report.bbox.hardFailures.length) parts.push(`hardDrift(${report.bbox.hardFailures.length})`);
    if (report.bbox.softFailures.length) parts.push(`softDrift(${report.bbox.softFailures.length})`);
    if (report.bbox.missing.length) parts.push(`missingDom(${report.bbox.missing.length})`);
    if (report.bbox.unmatchedDomIds.length) parts.push(`stray(${report.bbox.unmatchedDomIds.length})`);
    if (report.bbox.ok && !parts.some((p) => p.includes('Drift'))) parts.push('bbox(ok)');
  }
  return parts.join(' ');
}
