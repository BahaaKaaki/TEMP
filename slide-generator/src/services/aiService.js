// AI Service barrel file — re-exports all sub-modules for backward compatibility.
// All implementation lives in ./ai/*.js modules.

// ── Raw asset imports (re-exported for consumers) ────────────────────────────
import SHELL_CSS from '../styles/slides.css?raw';
export { SHELL_CSS };
export { SHELL_CSS as FULL_SLIDE_CSS };

if (SHELL_CSS) {
  console.log(`[aiService] SHELL_CSS loaded: ${SHELL_CSS.length} characters`);
} else {
  console.error('[aiService] WARNING: SHELL_CSS failed to load!');
}

// ── Re-exports from templateEmbeddings (pass-through) ────────────────────────
export {
  findBestTemplate,
  searchTemplatesByEmbedding,
  searchTemplatesByKeywords,
  initializeTemplateEmbeddings,
  TEMPLATE_QUALIFICATIONS,
  TEMPLATE_FAMILIES,
} from './templateEmbeddings';

// ── constants.js — prompts, style guides, work-level instructions ────────────
export {
  CSS_STYLE_GUIDE,
  getWorkLevelInstructions,
  SLIDE_WRITING_STYLE,
  TITLE_HEADER_RULES,
  LEAN_ROUTER_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  FREESTYLE_COMPONENT_GUIDE,
  EDIT_SYSTEM_PROMPT,
} from './ai/constants.js';

// ── models.js — model detection, provider lookup, credentials ────────────────
export {
  hasAnyApiKey,
} from './ai/models.js';

// ── apiClient.js — API calls, concurrency, request/response ──────────────────
export {
  callGeminiAPI,
  callWithModelFallback,
  setApiMaxConcurrent,
} from './ai/apiClient.js';

// ── router.js — rule-based + AI-powered routing ──────────────────────────────
export {
  TEMPLATE_KEYWORDS,
  INTENT_PATTERNS,
  AI_ROUTER_TEMPLATES,
  currentDateString,
  routeRequest,
  aiRouteRequest,
  classifyRequest,
  triageRequest,
} from './ai/router.js';

// ── cssExtraction.js — CSS extraction + context-fetch detection ──────────────
export {
  extractRelevantCSS,
  detectContextRequest,
  buildRequestedContext,
} from './ai/cssExtraction.js';

// ── slideContext.js — metadata, summaries, deck context ──────────────────────
export {
  generateSlideSummary,
  extractSlideMetadata,
  extractSlideContentForAI,
  buildDeckOutline,
  buildContextString,
  buildMinimalEditContext,
  buildDeckContextDigest,
  buildDeckStructure,
  planTrackerSyncFromDeckStructures,
  CONTEXT_LEVELS,
  normalizeContextLevel,
  updateSlideSummary,
  detectSlideLayout,
  buildStorylineSummary,
} from './ai/slideContext.js';

export {
  PROMPT_OVERRIDE_DEFS,
  getPromptOverride,
  applyPromptOverride,
  appendPromptOverride,
  recordPromptPayload,
  getLastPromptPayloads,
} from './ai/promptOverrides.js';

// ── slideGeneration.js — core generation, freestyle, parsing ─────────────────
export {
  generateSlides,
  extractTitleFromHTML,
} from './ai/slideGeneration.js';

export {
  polishGeneratedSlides,
  polishSlideHtml,
  isSlideLayoutPolishEnabled,
  shouldPolishSlide,
  DEFAULT_LAYOUT_POLISH_SYSTEM,
  DEFAULT_LAYOUT_POLISH_USER_TEMPLATE,
  buildLayoutPolishUserPrompt,
} from './ai/slideLayoutPolish.js';

// ── slideEditing.js — improve, template switch, batch edit ───────────────────
export {
  improveSlide,
  improveSlideWithTemplate,
  improveSlideWithContext,
  improveMultipleSlides,
  buildDeckContextForSwitch,
  generateSlideExportCode,
  transformSlideToTemplate,
} from './ai/slideEditing.js';

// ── imageGeneration.js — image generation + image slides ─────────────────────
export {
  generateImage,
  generateImageSlide,
  upliftSlideWithImage,
  extractImageDataUri,
  slideUsesRasterFrameImage,
  editRasterImageSlide,
  VISUAL_UPLIFT_PROMPT,
  LAYOUT_GUIDANCE_MAP,
} from './ai/imageGeneration.js';

// ── templateSelection.js — selection, filling, bulk fill ─────────────────────
export {
  generateTemplate,
  selectTemplateWithEmbeddings,
  selectTemplateWithAI,
  planSlidesWithTemplates,
  reEvaluateTemplateForData,
  fillTemplateWithAI,
  fillTemplatesBulkWithAI,
} from './ai/templateSelection.js';

// ── validation.js — HTML, PPTX, vision validation ───────────────────────────
export {
  validateHtmlWithAI,
  validatePptxCodeWithAI,
  validateWithVision,
  compareHtmlToPptxVisually,
} from './ai/validation.js';

// ── agentServices.js — agent, search, chat, triage, planning ─────────────────
export {
  generatePptxRendererCode,
  chatWithContext,
  agentTriageRequest,
  agentChat,
  webSearch,
  researchWithSearch,
  analyzeContentForSlides,
  createAgentExecutionPlan,
  getAgentPlanningGuidelines,
} from './ai/agentServices.js';

// ── storyline.js — storyline, skeleton, population ───────────────────────────
export {
  generateStoryline,
  syncStorylineFromSlidesAI,
  syncSlidesFromStorylineAI,
  generateSkeletonSlides,
  fillSkeletonSlide,
  populateSlides,
} from './ai/storyline.js';

// ── transforms.js — widget transform, vibe reimagine ────────────────────────
export {
  transformElementToWidget,
  reimagineSlideWithVibe,
} from './ai/transforms.js';

// ── improveSlideOrchestrator.js — shared context + search for improve calls ─
export {
  buildEnrichedSlideInfo,
  enrichInstructionWithSearch,
  improveSlideWithSearch,
  trimSearchResult,
} from './ai/improveSlideOrchestrator.js';
