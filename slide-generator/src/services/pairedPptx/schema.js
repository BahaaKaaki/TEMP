// Paired PPTX co-generation: closed-set schema for the LLM's structured output.
//
// The LLM emits a single JSON object with the preview HTML plus a parallel
// array of `pptxOps` describing the exported slide as native pptxgenjs calls.
// Every positioned element gets a `data-pptx-id` in the HTML and a matching
// `id` in the op, so the validator can cross-check bboxes before we emit the
// .pptx.
//
// Exports:
//   - PAIRED_SLIDE_JSON_SCHEMA: JSON Schema for OpenAI structured outputs.
//   - validatePairedOutput(obj): lightweight runtime validator used as a
//     safety net for providers that do not enforce json_schema server-side,
//     and for local unit tests of emitter fixtures.
//
// Coordinates: pixels in the 960x540 canvas. Emitter converts to inches.

export const CANVAS = Object.freeze({ wPx: 960, hPx: 540, wIn: 13.333, hIn: 7.5 });

export const PPTX_OP_TYPES = Object.freeze([
  'addText',
  'addShape',
  'addImage',
  'addTable',
  'addChart',
  'addGroup',
  'rasterize',
]);

export const PPTX_SHAPES = Object.freeze(['rect', 'roundRect', 'ellipse', 'line']);
export const PPTX_CHART_TYPES = Object.freeze(['bar', 'col', 'line', 'pie', 'area', 'doughnut']);
export const PPTX_ALIGNS = Object.freeze(['left', 'center', 'right']);
export const PPTX_VALIGNS = Object.freeze(['top', 'middle', 'bottom']);
export const PPTX_VERT_MODES = Object.freeze(['vert', 'vert270', 'eaVert', 'mongolianVert']);

// ───────────────────────────── JSON Schema ─────────────────────────────────
//
// Written by hand (not generated from Zod) to keep the dependency footprint
// zero. Uses OpenAI-compatible strict mode constraints:
//   - every object declares `additionalProperties: false`
//   - every object lists every defined property in `required` (OpenAI's strict
//     mode rejects partial `required` arrays)
//   - union ops use `anyOf` with a literal `op` discriminator

const hexColor = {
  type: 'string',
  description: 'RRGGBB hex without # prefix (or CSS color name). Example: "0066CC".',
};

const textRun = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: {
      type: 'string',
      description: 'Literal text content. Write in the final case - do not use CSS text-transform.',
    },
    bold: { type: 'boolean' },
    italic: { type: 'boolean' },
    underline: { type: 'boolean' },
    strike: { type: 'boolean' },
    superscript: { type: 'boolean' },
    subscript: { type: 'boolean' },
    breakLine: { type: 'boolean', description: 'Insert a line break after this run.' },
    color: hexColor,
    fontSize: { type: 'number', description: 'Points.' },
    fontFace: { type: 'string' },
    charSpacing: {
      type: 'number',
      description: 'Character spacing in points. Omit or use 0 for default.',
    },
    hyperlinkUrl: { type: 'string' },
  },
  required: [
    'text', 'bold', 'italic', 'underline', 'strike', 'superscript', 'subscript',
    'breakLine', 'color', 'fontSize', 'fontFace', 'charSpacing', 'hyperlinkUrl',
  ],
};

const fill = {
  type: 'object',
  additionalProperties: false,
  properties: {
    color: hexColor,
    transparency: { type: 'number', description: '0-100 (percent transparent).' },
  },
  required: ['color', 'transparency'],
};

const line = {
  type: 'object',
  additionalProperties: false,
  properties: {
    color: hexColor,
    width: { type: 'number', description: 'Points.' },
    dashType: { type: 'string', enum: ['solid', 'dash', 'dot'] },
    transparency: { type: 'number' },
  },
  required: ['color', 'width', 'dashType', 'transparency'],
};

const baseBoxProps = {
  id: { type: 'string', description: 'Must match a data-pptx-id on the paired HTML element.' },
  x: { type: 'number', description: 'Pixels from the left edge of the 960x540 canvas.' },
  y: { type: 'number', description: 'Pixels from the top edge of the 960x540 canvas.' },
  w: { type: 'number', description: 'Width in pixels.' },
  h: { type: 'number', description: 'Height in pixels.' },
};

const addTextOp = {
  type: 'object',
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['addText'] },
    ...baseBoxProps,
    runs: { type: 'array', items: textRun, minItems: 1 },
    align: { type: 'string', enum: [...PPTX_ALIGNS] },
    valign: { type: 'string', enum: [...PPTX_VALIGNS] },
    rotate: { type: 'number', description: 'Degrees, 0-359. Use vert for 90/270.' },
    vert: { type: 'string', enum: [...PPTX_VERT_MODES] },
    lineSpacing: { type: 'number', description: 'Points. 0 = default.' },
    fill: { ...fill },
    wrap: { type: 'boolean' },
  },
  required: ['op', 'id', 'x', 'y', 'w', 'h', 'runs', 'align', 'valign', 'rotate', 'vert', 'lineSpacing', 'fill', 'wrap'],
};

const addShapeOp = {
  type: 'object',
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['addShape'] },
    ...baseBoxProps,
    shape: { type: 'string', enum: [...PPTX_SHAPES] },
    fill: { ...fill },
    line: { ...line },
    rectRadius: { type: 'number', description: '0-1. Roundness ratio for roundRect.' },
    rotate: { type: 'number' },
  },
  required: ['op', 'id', 'x', 'y', 'w', 'h', 'shape', 'fill', 'line', 'rectRadius', 'rotate'],
};

const addImageOp = {
  type: 'object',
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['addImage'] },
    ...baseBoxProps,
    data: {
      type: 'string',
      description: 'data: URL with base64 payload, or empty string if using path.',
    },
    path: {
      type: 'string',
      description: 'URL or path to an image asset, or empty string if using data.',
    },
    rotate: { type: 'number' },
  },
  required: ['op', 'id', 'x', 'y', 'w', 'h', 'data', 'path', 'rotate'],
};

const tableCell = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    bold: { type: 'boolean' },
    fill: { ...fill },
    align: { type: 'string', enum: [...PPTX_ALIGNS] },
    valign: { type: 'string', enum: [...PPTX_VALIGNS] },
    color: hexColor,
    fontSize: { type: 'number' },
  },
  required: ['text', 'bold', 'fill', 'align', 'valign', 'color', 'fontSize'],
};

const addTableOp = {
  type: 'object',
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['addTable'] },
    ...baseBoxProps,
    rows: {
      type: 'array',
      items: { type: 'array', items: tableCell },
      minItems: 1,
      description: 'Row-major 2D array of cells.',
    },
    colW: {
      type: 'array',
      items: { type: 'number' },
      description: 'Column widths in pixels. Empty array means auto.',
    },
    border: { ...line },
  },
  required: ['op', 'id', 'x', 'y', 'w', 'h', 'rows', 'colW', 'border'],
};

const chartSeries = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    labels: { type: 'array', items: { type: 'string' } },
    values: { type: 'array', items: { type: 'number' } },
  },
  required: ['name', 'labels', 'values'],
};

const addChartOp = {
  type: 'object',
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['addChart'] },
    ...baseBoxProps,
    chartType: { type: 'string', enum: [...PPTX_CHART_TYPES] },
    data: { type: 'array', items: chartSeries, minItems: 1 },
    barDir: { type: 'string', enum: ['col', 'bar'] },
    chartColors: { type: 'array', items: hexColor },
    showLegend: { type: 'boolean' },
    showValue: { type: 'boolean' },
  },
  required: ['op', 'id', 'x', 'y', 'w', 'h', 'chartType', 'data', 'barDir', 'chartColors', 'showLegend', 'showValue'],
};

const addGroupOp = {
  type: 'object',
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['addGroup'] },
    id: { type: 'string' },
    label: { type: 'string', description: 'Human-readable tag for debugging.' },
    // Recursion would make the schema cyclic; OpenAI's strict mode rejects
    // `$ref` cycles, so instead groups are a flat logical tag: the children
    // live in the top-level pptxOps array and mention `groupId: <this id>`.
  },
  required: ['op', 'id', 'label'],
};

// Escape hatch: "this region is too complex to express as ops - please
// rasterize the DOM element with this data-pptx-id into a PNG and place it
// at these coordinates." Kept rare by construction; an LLM that can't express
// a region here has already failed the "prefer HTML for charts" prompt rule.
const rasterizeOp = {
  type: 'object',
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['rasterize'] },
    ...baseBoxProps,
    reason: { type: 'string', description: 'Short explanation (inline SVG, chart, gradient...).' },
  },
  required: ['op', 'id', 'x', 'y', 'w', 'h', 'reason'],
};

const pairedSlideSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    html: {
      type: 'string',
      description:
        'The slide HTML. Use data-pptx-id on every positioned element that also appears in pptxOps.',
    },
    customCss: {
      type: 'string',
      description: 'Scoped CSS for the slide. Empty string if none.',
    },
    pptxOps: {
      type: 'array',
      items: {
        anyOf: [
          addTextOp,
          addShapeOp,
          addImageOp,
          addTableOp,
          addChartOp,
          addGroupOp,
          rasterizeOp,
        ],
      },
    },
  },
  required: ['html', 'customCss', 'pptxOps'],
});

export const PAIRED_SLIDE_JSON_SCHEMA = Object.freeze({
  name: 'PairedSlideOutput',
  strict: true,
  schema: pairedSlideSchema,
});

// Deck-level wrapper: `generateSlides()` asks the LLM for N slides per call,
// so the paired path returns `{ slides: [PairedSlideOutput, ...] }`.
export const PAIRED_DECK_JSON_SCHEMA = Object.freeze({
  name: 'PairedDeckOutput',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      slides: {
        type: 'array',
        items: pairedSlideSchema,
        minItems: 1,
      },
    },
    required: ['slides'],
  },
});

// ───────────────────────────── Runtime validator ────────────────────────────
//
// Light-touch validator used as a safety net. Structured outputs enforce the
// schema server-side for providers that support it; this validator catches
// drift for providers that don't (Anthropic, Gemini, local fixtures), and
// gives emitter.js a strong invariant: every op it sees already has an id,
// coords in range, and a recognized `op` tag.

function fail(errors, path, message) {
  errors.push({ path, message });
}

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateBox(op, path, errors) {
  for (const key of ['x', 'y', 'w', 'h']) {
    if (!isFiniteNum(op[key])) fail(errors, `${path}.${key}`, `${key} must be a finite number`);
  }
  if (typeof op.id !== 'string' || !op.id) fail(errors, `${path}.id`, 'id must be a non-empty string');
  if (isFiniteNum(op.w) && op.w <= 0) fail(errors, `${path}.w`, 'w must be > 0');
  if (isFiniteNum(op.h) && op.h <= 0) fail(errors, `${path}.h`, 'h must be > 0');
}

function validateTextRun(run, path, errors) {
  if (!run || typeof run !== 'object') {
    fail(errors, path, 'run must be an object');
    return;
  }
  if (typeof run.text !== 'string') fail(errors, `${path}.text`, 'text must be a string');
  for (const b of ['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'breakLine']) {
    if (b in run && typeof run[b] !== 'boolean') {
      fail(errors, `${path}.${b}`, `${b} must be boolean`);
    }
  }
  if ('fontSize' in run && run.fontSize !== null && !isFiniteNum(run.fontSize)) {
    fail(errors, `${path}.fontSize`, 'fontSize must be a number');
  }
}

function validateOp(op, index, errors) {
  const path = `pptxOps[${index}]`;
  if (!op || typeof op !== 'object') {
    fail(errors, path, 'op must be an object');
    return;
  }
  if (!PPTX_OP_TYPES.includes(op.op)) {
    fail(errors, `${path}.op`, `unknown op "${op.op}"`);
    return;
  }
  if (op.op === 'addGroup') {
    if (typeof op.id !== 'string' || !op.id) fail(errors, `${path}.id`, 'id required');
    return;
  }
  validateBox(op, path, errors);
  if (op.op === 'addText') {
    if (!Array.isArray(op.runs) || op.runs.length === 0) {
      fail(errors, `${path}.runs`, 'addText requires at least one run');
    } else {
      op.runs.forEach((r, i) => validateTextRun(r, `${path}.runs[${i}]`, errors));
    }
    if (op.vert && !PPTX_VERT_MODES.includes(op.vert)) {
      fail(errors, `${path}.vert`, `unknown vert "${op.vert}"`);
    }
  } else if (op.op === 'addShape') {
    if (!PPTX_SHAPES.includes(op.shape)) {
      fail(errors, `${path}.shape`, `unknown shape "${op.shape}"`);
    }
  } else if (op.op === 'addImage') {
    if (!op.data && !op.path) {
      fail(errors, path, 'addImage requires either data or path');
    }
  } else if (op.op === 'addTable') {
    if (!Array.isArray(op.rows) || op.rows.length === 0) {
      fail(errors, `${path}.rows`, 'addTable requires at least one row');
    }
  } else if (op.op === 'addChart') {
    if (!PPTX_CHART_TYPES.includes(op.chartType)) {
      fail(errors, `${path}.chartType`, `unknown chartType "${op.chartType}"`);
    }
    if (!Array.isArray(op.data) || op.data.length === 0) {
      fail(errors, `${path}.data`, 'addChart requires at least one series');
    }
  }
}

/**
 * Validate a PairedSlideOutput blob. Does NOT enforce strict-mode field
 * presence - missing optional fields are fine. Catches obvious structural
 * problems that would crash the emitter.
 *
 * @param {unknown} obj
 * @returns {{ ok: boolean, errors: { path: string, message: string }[] }}
 */
export function validatePairedOutput(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    fail(errors, '$', 'expected object');
    return { ok: false, errors };
  }
  if (typeof obj.html !== 'string' || !obj.html.trim()) {
    fail(errors, 'html', 'html must be a non-empty string');
  }
  if ('customCss' in obj && typeof obj.customCss !== 'string') {
    fail(errors, 'customCss', 'customCss must be a string when present');
  }
  if (!Array.isArray(obj.pptxOps)) {
    fail(errors, 'pptxOps', 'pptxOps must be an array');
    return { ok: errors.length === 0, errors };
  }
  const seenIds = new Map();
  obj.pptxOps.forEach((op, i) => {
    validateOp(op, i, errors);
    if (op && typeof op.id === 'string' && op.id) {
      if (seenIds.has(op.id)) {
        fail(errors, `pptxOps[${i}].id`, `duplicate id "${op.id}" (also at index ${seenIds.get(op.id)})`);
      } else {
        seenIds.set(op.id, i);
      }
    }
  });
  return { ok: errors.length === 0, errors };
}

/**
 * Validate a PairedDeckOutput blob: { slides: [PairedSlideOutput, ...] }.
 *
 * @param {unknown} obj
 * @returns {{ ok: boolean, errors: { path: string, message: string }[], slideReports: Array<ReturnType<typeof validatePairedOutput>> }}
 */
export function validatePairedDeck(obj) {
  const errors = [];
  const slideReports = [];
  if (!obj || typeof obj !== 'object') {
    fail(errors, '$', 'expected object');
    return { ok: false, errors, slideReports };
  }
  if (!Array.isArray(obj.slides) || obj.slides.length === 0) {
    fail(errors, 'slides', 'slides must be a non-empty array');
    return { ok: false, errors, slideReports };
  }
  obj.slides.forEach((s, i) => {
    const report = validatePairedOutput(s);
    slideReports.push(report);
    if (!report.ok) {
      for (const err of report.errors) {
        fail(errors, `slides[${i}].${err.path}`, err.message);
      }
    }
  });
  return { ok: errors.length === 0, errors, slideReports };
}

/**
 * Extract the pptxOps-supported opIds expected to appear as data-pptx-id
 * attributes in the paired HTML.
 */
export function opIdsForCrossCheck(pptxOps) {
  const out = [];
  for (const op of pptxOps || []) {
    if (op && typeof op.id === 'string' && op.id && op.op !== 'addGroup') out.push(op.id);
  }
  return out;
}
