// Public API for the in-repo Paired PPTX co-generation module.
//
// Architecture: a single LLM call emits both slide HTML/CSS (preview) and a
// parallel pptxOps array (editable PPTX instructions). A cross-validator
// ensures the two channels agree, then a deterministic emitter converts the
// ops into a .pptx via pptxgenjs.
//
// Usage from the export service:
//
//   import { validatePaired, emitPairedSlide } from './pairedPptx';
//
//   const report = validatePaired(paired, slideEl);
//   if (!report.ok) { ... fall back to llm-dom-to-pptx ... }
//   await emitPairedSlide(pres, slide, paired.pptxOps, { domRoot: slideEl });

export {
  CANVAS,
  PAIRED_SLIDE_JSON_SCHEMA,
  PAIRED_DECK_JSON_SCHEMA,
  PPTX_OP_TYPES,
  PPTX_SHAPES,
  PPTX_CHART_TYPES,
  PPTX_VERT_MODES,
  validatePairedOutput,
  validatePairedDeck,
  opIdsForCrossCheck,
} from './schema.js';

export { emitPairedSlide } from './emitter.js';

export {
  DEFAULT_SOFT_TOLERANCE_PX,
  DEFAULT_HARD_TOLERANCE_PX,
  crossValidateBboxes,
  validatePaired,
  summarizeValidation,
} from './validator.js';
