import { SLIDE_TEMPLATES } from '../../utils/slideTemplates';
import { buildMinimalEditContext } from './slideContext.js';
import { improveSlide } from './slideEditing.js';
import { webSearch } from './agentServices.js';
import { currentDateString } from './router.js';

const SEARCH_CONTEXT_BUDGET = 8000;

/**
 * Trim search text to a budget while keeping both the opening overview
 * and the closing summary/table which search models typically place last.
 */
export function trimSearchResult(text, budget = SEARCH_CONTEXT_BUDGET) {
  if (text.length <= budget) return text;

  const headBudget = Math.floor(budget * 0.6);
  const tailBudget = budget - headBudget;

  const head = text.substring(0, headBudget);
  const tail = text.substring(text.length - tailBudget);

  return head + '\n\n[...middle section trimmed for brevity...]\n\n' + tail;
}

/**
 * Build a fully enriched slideInfo object with deck context, position,
 * neighbor summaries, template reference, and comments.
 *
 * Used by AIChatbot batch-edit paths that need heavy context.
 * NOT used by the Improve bar (which stays lightweight).
 */
export function buildEnrichedSlideInfo(slide, slides, storyline, options = {}) {
  const { templateList = SLIDE_TEMPLATES, neighborRange = 2 } = options;
  const slideIndex = slides.findIndex(s => s.id === slide.id);

  const templates = Array.isArray(templateList) ? templateList : Object.values(templateList);
  const templateKey = slide.templateId || slide.type;
  const matchingTemplate = templates.find(t => t.id === templateKey);

  const minimalContext = buildMinimalEditContext(slides, slideIndex, {
    includeNeighbors: true,
    includeStoryline: storyline?.length > 0,
    storyline,
    neighborRange,
  });

  return {
    html: slide.html,
    customCSS: slide.customCSS || '',
    title: slide.title || '',
    type: slide.type,
    templateId: slide.templateId || slide.type || '',
    slideNumber: slideIndex + 1,
    totalSlides: slides.length,
    comments: slide.comments || [],
    templateHtml: matchingTemplate?.html || null,
    templateName: matchingTemplate?.title || null,
    minimalContext,
  };
}

/**
 * Append a search-facts grounding block to an instruction string.
 * Returns the original instruction unchanged when search is disabled,
 * unconfigured, or returns no results.
 */
export async function enrichInstructionWithSearch(instruction, settings) {
  if (!settings.searchEnabled) return instruction;
  if (!settings.searchEndpoint || !settings.searchApiKey || !settings.searchModel) {
    return instruction;
  }

  try {
    const dateStr = currentDateString();
    const result = await webSearch(`${instruction} ${dateStr}`, settings);
    if (result) {
      const trimmed = trimSearchResult(result);
      return instruction
        + `\n\n=== KEY FACTS FROM WEB SEARCH (current as of ${dateStr}) ===\n`
        + `${trimmed}\n=== END KEY FACTS ===\n`
        + 'IMPORTANT: Use ONLY dates, names, and facts from the above search context. '
        + 'Do NOT use outdated information from training data.\n';
    }
  } catch (err) {
    console.warn('[improveSlideWithSearch] Search failed, proceeding without:', err.message);
  }

  return instruction;
}

/**
 * Lightweight slide-improve orchestrator for the Improve bar and AIPrompt.
 *
 * Passes only the current slide's HTML + CSS to the LLM (no neighbors,
 * no deck structure, no position context) for fast, focused edits.
 * Optionally prepends web-search grounding when the user opts in.
 *
 * @param {object}  slide        - Slide object from state (must have .html)
 * @param {string}  instruction  - User instruction / prompt text
 * @param {object}  settings     - App settings (model, search config, etc.)
 * @param {object}  [options]
 * @param {boolean} [options.skipSearch]   - Skip web search (default true)
 * @param {string}  [options.extraContext] - Additional context to append
 */
export async function improveSlideWithSearch(slide, instruction, settings, options = {}) {
  const { extraContext, skipSearch = true } = options;

  const slideInfo = {
    html: slide.html,
    customCSS: slide.customCSS || '',
    templateId: slide.templateId || slide.type || '',
    title: slide.title || '',
  };

  let enrichedInstruction = skipSearch
    ? instruction
    : await enrichInstructionWithSearch(instruction, settings);

  if (extraContext) {
    enrichedInstruction += extraContext;
  }

  return improveSlide(slideInfo, enrichedInstruction, settings);
}
