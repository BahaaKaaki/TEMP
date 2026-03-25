import { SLIDE_TEMPLATES } from '../../utils/slideTemplates';
import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import { getVibePromptContext, isBaseVibe } from '../../utils/vibes';
import { getCredentials } from './models.js';
import { callWithModelFallback } from './apiClient.js';
import { CSS_STYLE_GUIDE, EDIT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT, TITLE_HEADER_RULES, FREESTYLE_COMPONENT_GUIDE, getWorkLevelInstructions } from './constants.js';
import { extractRelevantCSS, detectContextRequest, buildRequestedContext } from './cssExtraction.js';
import { extractSlideContentForAI, generateSlideSummary, extractSlideMetadata, buildDeckContext } from './slideContext.js';
import { extractSingleSlide, flattenNestedFrames, extractTitleFromHTML, ensureSlideStructure } from './slideGeneration.js';
import { currentDateString, safeJSONParse } from './router.js';

// Context tiers for smart context selection
export const CONTEXT_TIERS = {
  LOCAL: 'local',       // Just the slide itself - for simple formatting/content edits
  NEIGHBOR: 'neighbor', // Slide + prev/next - for flow and transition edits
  DECK: 'deck',         // Full deck overview - for structural and narrative edits
};

// AI-based context strategy analysis
// Uses a quick AI call to determine optimal context tier and strategy
export async function analyzeContextStrategy(instruction, slideInfo, settings) {
  const creds = getCredentials(settings);

  // Quick fallback if no API key (use keyword matching)
  if (!creds.apiKey) {
    return { tier: CONTEXT_TIERS.LOCAL, guidance: null };
  }

  const analysisPrompt = `Analyze this slide editing instruction to determine what context is needed.

INSTRUCTION: "${instruction}"

CURRENT SLIDE INFO:
- Position: Slide ${slideInfo.slideNumber || '?'} of ${slideInfo.totalSlides || '?'}
- Title: "${slideInfo.title || 'Untitled'}"
- Type: ${slideInfo.type || 'unknown'}

Respond in JSON only:
{
  "tier": "local" | "neighbor" | "deck",
  "reasoning": "<brief reason>",
  "focusAreas": ["<what to pay attention to>"]
}

TIER DEFINITIONS:
- "local": Only this slide needed (formatting, content edits, styling)
- "neighbor": Need prev/next slides (transitions, flow, avoiding overlap)
- "deck": Need full deck view (restructuring, MECE, narrative, consistency)

Keep reasoning under 20 words.`;

  try {
    let content;

    content = await callWithModelFallback(
      { ...settings, temperature: 0.1, maxTokens: 200 },
      'You analyze editing instructions. Respond only in JSON.',
      analysisPrompt
    );

    // Parse JSON response with repair for common AI response issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = safeJSONParse(content, 'Context Strategy');

    // Validate tier
    const tier = ['local', 'neighbor', 'deck'].includes(analysis.tier)
      ? analysis.tier
      : CONTEXT_TIERS.LOCAL;

    return {
      tier,
      reasoning: analysis.reasoning || null,
      focusAreas: analysis.focusAreas || [],
    };
  } catch (error) {
    console.warn('Context analysis failed, using local tier:', error.message);
    return { tier: CONTEXT_TIERS.LOCAL, guidance: null };
  }
}

// Quick keyword-based fallback (used when AI analysis is skipped)
export function quickContextTier(instruction) {
  const lower = instruction.toLowerCase();

  // Deck-level keywords
  const deckKeywords = ['restructure', 'MECE', 'narrative', 'all slides', 'entire deck', 'consistent', 'throughout'];
  if (deckKeywords.some(k => lower.includes(k.toLowerCase()))) {
    return CONTEXT_TIERS.DECK;
  }

  // Neighbor-level keywords
  const neighborKeywords = ['transition', 'previous', 'next', 'overlap', 'flow', 'build on', 'redundant'];
  if (neighborKeywords.some(k => lower.includes(k.toLowerCase()))) {
    return CONTEXT_TIERS.NEIGHBOR;
  }

  return CONTEXT_TIERS.LOCAL;
}

// Function to improve an existing slide with smart context selection
// slideInfo: { html, title, type, templateId, slideNumber, totalSlides }
// deckContext: { previous, next, allSlides } - optional, used based on instruction analysis
// options: { useAIAnalysis: true } - whether to use AI to determine context (default: true)
export async function improveSlide(slideHtmlOrInfo, instruction, settings, deckContext = null, options = {}) {
  // Apply quickEdit role overrides if configured
  const qeRole = settings.roleSettings?.quickEdit || {};
  if (qeRole.model) settings = { ...settings, model: qeRole.model };
  if (qeRole.maxTokens) settings = { ...settings, maxTokens: qeRole.maxTokens };
  if (qeRole.reasoningEffort) settings = { ...settings, reasoningEffort: qeRole.reasoningEffort };
  if (qeRole.temperature !== '' && qeRole.temperature !== undefined) settings = { ...settings, temperature: qeRole.temperature };

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Support both old signature (html string) and new signature (info object)
  const slideInfo = typeof slideHtmlOrInfo === 'string'
    ? { html: slideHtmlOrInfo }
    : slideHtmlOrInfo;

  const { html, title, type, templateId, slideNumber, totalSlides, comments, templateHtml, templateName, customCSS, sharedCSS, minimalContext } = slideInfo;

  // MINIMAL CONTEXT MODE: If minimalContext is provided, use it directly
  // This significantly reduces token usage while keeping agent informed
  let positionContext = '';
  let neighborContext = '';
  let deckOverview = '';
  let contextStrategy = { tier: CONTEXT_TIERS.LOCAL, reasoning: null, focusAreas: [] };

  if (minimalContext) {
    // Use pre-built minimal context (position + lightweight neighbor/deck info)
    positionContext = minimalContext.positionContext ? `\n${minimalContext.positionContext}` : '';
    neighborContext = minimalContext.neighborContext || '';
    if (minimalContext.storylineContext) {
      neighborContext += minimalContext.storylineContext;
    }
    // Include pending instructions for this slide
    if (minimalContext.instructionsContext) {
      neighborContext += minimalContext.instructionsContext;
    }
    // Include deck structure if available (contains summaries of all slides)
    if (minimalContext.deckStructure) {
      deckOverview = minimalContext.deckStructure;
    }
    console.log('[Context] Using MINIMAL context mode - position + summaries');
  } else if (deckContext) {
    // Legacy full context mode (for backwards compatibility)
    const useAIAnalysis = options.useAIAnalysis !== false; // Default true

    if (useAIAnalysis) {
      // Use AI to determine optimal context strategy
      contextStrategy = await analyzeContextStrategy(instruction, slideInfo, settings);
      console.log(`[Context] AI selected tier: ${contextStrategy.tier} - ${contextStrategy.reasoning || 'no reason given'}`);
    } else {
      // Quick keyword-based fallback
      contextStrategy.tier = quickContextTier(instruction);
    }

    // Build position context (always useful)
    if (slideNumber && totalSlides) {
      positionContext = `\nSLIDE POSITION: Slide ${slideNumber} of ${totalSlides}`;
      if (slideNumber === 1) {
        positionContext += ' (First slide)';
      } else if (slideNumber === totalSlides) {
        positionContext += ' (Last slide)';
      }
    }
  } else {
    // No context provided - just use position if available
    if (slideNumber && totalSlides) {
      positionContext = `\nSLIDE POSITION: Slide ${slideNumber} of ${totalSlides}`;
      if (slideNumber === 1) {
        positionContext += ' (First slide)';
      } else if (slideNumber === totalSlides) {
        positionContext += ' (Last slide)';
      }
    }
  }

  const contextTier = contextStrategy.tier;

  // Build metadata context
  let metadataContext = '';
  if (title || type) {
    metadataContext = `\nSLIDE INFO: "${title || 'Untitled'}"`;
    if (type) metadataContext += ` [${type}]`;
  }

  // Build neighbor context if needed (only in legacy mode, skip if minimalContext provided)
  // In minimal mode, neighborContext is already set from minimalContext above
  if (!minimalContext && deckContext && (contextTier === CONTEXT_TIERS.NEIGHBOR || contextTier === CONTEXT_TIERS.DECK)) {
    if (deckContext.previous) {
      neighborContext += `\n\n--- PREVIOUS SLIDE ---\nTitle: "${deckContext.previous.title || 'Untitled'}"`;
      if (deckContext.previous.type) neighborContext += ` [${deckContext.previous.type}]`;
      if (deckContext.previous.summary) neighborContext += `\nSummary: ${deckContext.previous.summary}`;
      // Use extracted content instead of raw HTML
      neighborContext += `\n${extractSlideContentForAI(deckContext.previous.html, { maxLength: 400 })}`;
    }
    if (deckContext.next) {
      neighborContext += `\n\n--- NEXT SLIDE ---\nTitle: "${deckContext.next.title || 'Untitled'}"`;
      if (deckContext.next.type) neighborContext += ` [${deckContext.next.type}]`;
      if (deckContext.next.summary) neighborContext += `\nSummary: ${deckContext.next.summary}`;
      // Use extracted content instead of raw HTML
      neighborContext += `\n${extractSlideContentForAI(deckContext.next.html, { maxLength: 400 })}`;
    }
  }

  // Build deck overview if needed (only in legacy mode, skip if minimalContext provided)
  if (!minimalContext && deckContext && contextTier === CONTEXT_TIERS.DECK && deckContext.allSlides) {
    deckOverview = `\n\n=== DECK STRUCTURE (${deckContext.allSlides.length} slides) ===`;
    deckContext.allSlides.forEach((s, idx) => {
      const marker = (idx + 1 === slideNumber) ? ' ← CURRENT' : '';
      deckOverview += `\n${idx + 1}. "${s.title || 'Untitled'}" [${s.type || 'custom'}]${marker}`;
    });
  }

  // Build AI guidance section if available
  let aiGuidance = '';
  if (contextStrategy.reasoning || (contextStrategy.focusAreas && contextStrategy.focusAreas.length > 0)) {
    aiGuidance = '\n\nAI ANALYSIS OF YOUR REQUEST:';
    if (contextStrategy.reasoning) {
      aiGuidance += `\n- Strategy: ${contextStrategy.reasoning}`;
    }
    if (contextStrategy.focusAreas && contextStrategy.focusAreas.length > 0) {
      aiGuidance += `\n- Focus areas: ${contextStrategy.focusAreas.join(', ')}`;
    }
    aiGuidance += `\n- Context level: ${contextTier.toUpperCase()}`;
  }

  // Build comment context if there are pending comments on this slide
  let commentContext = '';
  if (comments && comments.length > 0) {
    const pendingComments = comments.filter(c => !c.addressed);
    if (pendingComments.length > 0) {
      commentContext = '\n\nPENDING COMMENTS TO ADDRESS:';
      pendingComments.forEach((comment, idx) => {
        commentContext += `\n${idx + 1}. "${comment.text}"`;
      });
      commentContext += '\n\nIMPORTANT: Consider these comments when making your edits. If the user instruction relates to a comment, make sure to address it in your changes.';
    }
  }

  // Build the prompt with appropriate context level
  const contextNote = contextTier !== CONTEXT_TIERS.LOCAL
    ? `\n(Using ${contextTier} context - deck information included below)`
    : '';

  // Extract CSS that applies to this slide's classes
  const relevantCSS = extractRelevantCSS(html);
  let cssContext = '';
  if (relevantCSS || customCSS) {
    cssContext = `

=== CSS STYLES FOR THIS SLIDE (read and understand these) ===
These are the EXACT CSS rules that style this slide. Preserve all class names.
${relevantCSS}
${customCSS ? `\n--- SLIDE-SPECIFIC CUSTOM CSS ---\n${customCSS}\n--- END CUSTOM CSS ---` : ''}
=== END CSS STYLES ===`;
  }

  // Build template reference context (for guidance, not strict matching)
  let templateContext = '';
  if (templateHtml && templateName) {
    templateContext = `

=== TEMPLATE REFERENCE (for styling guidance) ===
Template: "${templateName}" (${templateId || type || 'custom'})
This template provides the base styling. You may adapt its structure if needed to fulfill the user's request.
If the user's instruction requires more/fewer elements than the template, ADD or REMOVE elements accordingly.
Example: If template has 3 cards but user needs 5 points, create 5 cards with the same styling.
=== END TEMPLATE REFERENCE ===`;
  }

  const userPrompt = `=== PRIMARY OBJECTIVE ===
USER INSTRUCTION: ${instruction}

This is your MAIN TASK. Everything else below is context to help you execute this instruction.
The user's request takes priority over preserving existing structure or template constraints.
CRITICAL: The instruction above is a META-COMMAND about how to modify the slide — it is NOT the slide's content topic. The h1/h2 MUST remain about the slide's existing business topic. Do NOT rewrite headers to match the instruction wording (e.g., if instruction is "refine visuals", keep the h1 about the business content, NOT about visual refinement).

=== CURRENT SLIDE (to be modified) ===
${html}
${cssContext}${positionContext}${metadataContext}${contextNote}${neighborContext}${deckOverview}${aiGuidance}${commentContext}${templateContext}

${TITLE_HEADER_RULES}

=== OUTPUT RULES ===
1. EXECUTE THE USER'S INSTRUCTION as your primary goal
2. Preserve CSS class names for consistent styling
3. If content count doesn't match template (e.g., 5 items for 3-card layout), ADAPT the layout
4. Footer branding: use "${settings.footerBranding || 'Strategy&'}" in footer left span
5. Return ONLY the modified HTML`;

  debugLog(LogLevel.INFO, 'improveSlide', `Starting edit: "${instruction.substring(0, 100)}..."`, {
    slideTitle: title,
    slideType: type,
    htmlLength: html?.length,
    hasTemplate: !!templateHtml,
  });

  try {
    let content;

    content = await callWithModelFallback(settings, EDIT_SYSTEM_PROMPT, userPrompt);

    // Check if GPT requested more context (max 1 retry)
    const contextRequest = detectContextRequest(content);
    if (contextRequest) {
      debugLog(LogLevel.INFO, 'improveSlide', `GPT requested more context: ${contextRequest.reason}`, contextRequest);

      // Build the requested context from deck
      const additionalContext = buildRequestedContext(
        contextRequest,
        deckContext?.slides || [],
        deckContext?.storyline || [],
        SLIDE_TEMPLATES
      );

      if (additionalContext) {
        const retryPrompt = `${userPrompt}

=== ADDITIONAL CONTEXT (as requested) ===
${additionalContext}
=== END ADDITIONAL CONTEXT ===

Now please modify the slide as requested.`;

        let retryContent;
        retryContent = await callWithModelFallback(settings, EDIT_SYSTEM_PROMPT, retryPrompt);
        content = retryContent;
      } else {
        // Context not available - retry and tell AI to proceed without it
        debugLog(LogLevel.WARN, 'improveSlide', `Requested context not available: ${contextRequest.reason}`);

        const retryPrompt = `${userPrompt}

NOTE: You requested additional context ("${contextRequest.reason}") but that information is not available in the system. Please proceed with modifying the slide using your best judgment and the information already provided. Do not request more context - modify the slide now.`;

        let retryContent;
        retryContent = await callWithModelFallback(settings, EDIT_SYSTEM_PROMPT, retryPrompt);
        content = retryContent;
      }
    }

    // Extract single slide (AI may return multiple versions - take the last one)
    content = extractSingleSlide(content) || '';

    // Extract customCSS from <style> blocks if present
    let extractedCustomCSS = customCSS || ''; // Start with existing customCSS
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatch) {
      const newCSS = styleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '').trim()).join('\n\n');
      if (newCSS) {
        extractedCustomCSS = extractedCustomCSS
          ? `${extractedCustomCSS}\n\n/* AI-generated styles */\n${newCSS}`
          : newCSS;
      }
      // Remove style blocks from content
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
    }

    // VALIDATION: Check if result is valid HTML
    const hasSlideDiv = content.includes('<div') && content.includes('class=');
    const hasContent = content.length > 100;
    const hasFrame = content.includes('frame') || content.includes('cover');

    debugLog(LogLevel.INFO, 'improveSlide', `AI returned ${content.length} chars`, {
      hasSlideDiv,
      hasContent,
      hasFrame,
      hasCustomCSS: !!extractedCustomCSS,
      preview: content.substring(0, 200),
    });

    // If AI returned empty or invalid content, return original HTML
    if (!hasSlideDiv || !hasContent) {
      debugLog(LogLevel.ERROR, 'improveSlide', 'AI returned empty/invalid HTML - returning original', {
        contentLength: content.length,
        hasSlideDiv,
        returnedContent: content.substring(0, 500),
      });
      return { html, customCSS: extractedCustomCSS }; // Return original HTML instead of empty
    }

    // If AI returned HTML without proper frame/content structure, warn but still return
    if (!hasFrame && html.includes('frame')) {
      debugLog(LogLevel.WARN, 'improveSlide', 'AI response missing frame structure', {
        originalHadFrame: true,
        responsePreview: content.substring(0, 300),
      });
    }

    return { html: content, customCSS: extractedCustomCSS };
  } catch (error) {
    debugLog(LogLevel.ERROR, 'improveSlide', `Error: ${error.message}`, { stack: error.stack });
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * Build a compact deck context summary for AI-powered template switching.
 * Includes a one-line-per-slide "deck map", neighbor HTML, and detected recurring pillars.
 *
 * @param {Array} slides - All slides in the deck ({ html, title, templateId, type })
 * @param {number} currentIndex - 0-based index of the slide being switched
 * @returns {{ deckMap: string, neighborContext: string, pillarNote: string }}
 */
export function buildDeckContextForSwitch(slides, currentIndex) {
  if (!slides || slides.length === 0) return { deckMap: '', neighborContext: '', pillarNote: '' };

  const deckMap = slides.map((s, i) => {
    const marker = i === currentIndex ? ' <-- THIS SLIDE' : '';
    const title = s.title || extractTitleFromHTML(s.html) || '(untitled)';
    const tmpl = s.templateId || s.type || 'unknown';
    return `  ${i + 1}. [${tmpl}] "${title}"${marker}`;
  }).join('\n');

  let neighborContext = '';
  if (currentIndex > 0 && slides[currentIndex - 1]) {
    const prev = slides[currentIndex - 1];
    const prevTitle = prev.title || extractTitleFromHTML(prev.html) || '(untitled)';
    neighborContext += `\n--- PREVIOUS SLIDE (${currentIndex}) ---\nTitle: "${prevTitle}" | Template: ${prev.templateId || prev.type || 'unknown'}\n${prev.html}\n`;
  }
  if (currentIndex < slides.length - 1 && slides[currentIndex + 1]) {
    const next = slides[currentIndex + 1];
    const nextTitle = next.title || extractTitleFromHTML(next.html) || '(untitled)';
    neighborContext += `\n--- NEXT SLIDE (${currentIndex + 2}) ---\nTitle: "${nextTitle}" | Template: ${next.templateId || next.type || 'unknown'}\n${next.html}\n`;
  }

  const pillarCounts = {};
  for (const s of slides) {
    if (!s.html) continue;
    const h3s = s.html.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];
    for (const h3 of h3s) {
      const text = h3.replace(/<[^>]+>/g, '').trim().toLowerCase();
      if (text.length > 1 && text.length < 60) {
        pillarCounts[text] = (pillarCounts[text] || 0) + 1;
      }
    }
  }
  const recurring = Object.entries(pillarCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  let pillarNote = '';
  if (recurring.length > 0) {
    pillarNote = `\nDECK-WIDE RECURRING THEMES (appear across multiple slides):\n${recurring.map(([name, count]) => `  - "${name}" (${count} slides)`).join('\n')}\nYou MUST preserve these themes/pillars exactly if they appear in the current slide.\n`;
  }

  return { deckMap, neighborContext, pillarNote };
}

// Improve slide with template conversion - edit content while changing to a new template
// slidePosition is optional: { slideNumber, totalSlides }
// deckContext is optional: { deckMap, neighborContext, pillarNote } from buildDeckContext()
// userGuidance is optional: free-text instruction from the user
export async function improveSlideWithTemplate(slideHtml, instruction, template, settings, slidePosition = null, deckContext = null, userGuidance = null) {
  // Apply templateSwitcher role overrides if configured
  const tsRole = settings.roleSettings?.templateSwitcher || {};
  if (tsRole.model) settings = { ...settings, model: tsRole.model };
  if (tsRole.maxTokens) settings = { ...settings, maxTokens: tsRole.maxTokens };
  if (tsRole.reasoningEffort) settings = { ...settings, reasoningEffort: tsRole.reasoningEffort };
  if (tsRole.temperature !== '' && tsRole.temperature !== undefined) settings = { ...settings, temperature: tsRole.temperature };

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Build slide position context if provided
  let positionContext = '';
  if (slidePosition && slidePosition.slideNumber && slidePosition.totalSlides) {
    const { slideNumber, totalSlides } = slidePosition;
    positionContext = `\nSLIDE POSITION: This is slide ${slideNumber} of ${totalSlides}`;
    if (slideNumber === 1) {
      positionContext += ' (First slide - typically cover/introduction)';
    } else if (slideNumber === totalSlides) {
      positionContext += ' (Last slide - closing/summary)';
    }
    positionContext += `\nIMPORTANT: Footer page numbers are injected dynamically - do NOT hardcode page numbers in the footer.`;
  }

  // Build deck context sections if provided
  let deckMapSection = '';
  let neighborSection = '';
  let pillarSection = '';
  if (deckContext) {
    if (deckContext.deckMap) {
      deckMapSection = `\n=== DECK OVERVIEW (all slides) ===\n${deckContext.deckMap}\n`;
    }
    if (deckContext.pillarNote) {
      pillarSection = deckContext.pillarNote;
    }
    if (deckContext.neighborContext) {
      neighborSection = `\n=== NEIGHBORING SLIDES (for continuity) ===\n${deckContext.neighborContext}\n`;
    }
  }

  const primaryInstruction = userGuidance
    ? `${userGuidance}\n\nDefault action: ${instruction || 'Convert to this template, preserving the key content'}`
    : (instruction || 'Convert to this template, preserving the key content');

  const userPrompt = `=== PRIMARY OBJECTIVE ===
USER INSTRUCTION: ${primaryInstruction}

This is your MAIN TASK. The template below is a GUIDE, not a strict constraint.
${positionContext}
${deckMapSection}${pillarSection}
=== CURRENT SLIDE (source content) ===
${slideHtml}
${neighborSection}
=== TARGET TEMPLATE (styling guide) ===
Template: ${template.title}
Description: ${template.description || 'Professional consulting slide'}

TEMPLATE HTML (use as styling reference):
${template.html}

=== PILLAR PRESERVATION (HIGHEST PRIORITY) ===
Think like a management consultant redesigning a slide:
1. COUNT the top-level sections/pillars in the source (e.g., 3 cards = 3 pillars, 4 grid cells = 4 pillars).
2. The target slide MUST have the EXACT SAME number of top-level sections. This is non-negotiable.
   - If source has 3 pillars and target template shows 4 slots → REMOVE one slot from the target HTML.
   - If source has 4 pillars and target template shows 3 slots → ADD one slot to the target HTML.
   - NEVER merge two source pillars into one. NEVER invent a new pillar.
3. Each pillar's TITLE must be preserved VERBATIM (consulting rule: action titles are sacred).
4. Each pillar's core data points, metrics, and key messages must be preserved.
5. Body text may be condensed or expanded to fit the new layout, but no IDEAS may be dropped.

=== CONTENT FITTING RULES ===
1. ADAPT body text to fit the visual space:
   - Condense verbose bullets into concise points when space is tight
   - Expand thin content with sub-bullets if the target has more room
   - Keep the SAME IDEAS and KEY MESSAGES
2. The template should look well-filled — not empty, not overflowing. Use your judgment.
3. LEVERAGE THE TARGET TEMPLATE WELL — use its CSS classes, styling patterns, and visual structure.

=== CRITICAL RULES ===
1. USER INSTRUCTION IS PRIMARY — execute what the user asked for
2. The slide's H1 title (action title) must be preserved VERBATIM — it IS the insight
3. Extract meaningful content from current slide (titles, points, metrics) — never lose data
4. If footer has page number, use slide ${positionContext ? 'position from above' : 'number'}
5. Footer page numbers are injected dynamically — do NOT hardcode them

Return ONLY the transformed HTML.`;

  try {
    let content;

    content = await callWithModelFallback(settings, EDIT_SYSTEM_PROMPT, userPrompt);

    // Extract single slide (AI may return both original and transformed - take the last one)
    content = extractSingleSlide(content);

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Improve slide with context from neighboring slides
// slideInfo can be: string (html) for backwards compat, or object with full context
export async function improveSlideWithContext(slideHtmlOrInfo, instruction, neighboringSlides, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Support both old signature (html string) and new signature (info object)
  const slideInfo = typeof slideHtmlOrInfo === 'string'
    ? { html: slideHtmlOrInfo }
    : slideHtmlOrInfo;

  const { html, title, type, templateId, slideNumber, totalSlides } = slideInfo;

  // Build position header
  let positionHeader = '';
  if (slideNumber && totalSlides) {
    positionHeader = `\n=== YOU ARE EDITING SLIDE ${slideNumber} OF ${totalSlides} ===`;
    if (slideNumber === 1) {
      positionHeader += '\n(This is the FIRST slide - typically cover/introduction)';
    } else if (slideNumber === totalSlides) {
      positionHeader += '\n(This is the LAST slide - closing/summary)';
    }
  }

  // Build slide metadata
  let metadataStr = '';
  if (title || type || templateId) {
    metadataStr = '\n\nCURRENT SLIDE INFO:';
    if (title) metadataStr += `\n- Title: "${title}"`;
    if (type) metadataStr += `\n- Layout Type: ${type}`;
    if (templateId) metadataStr += `\n- Template: ${templateId}`;
  }

  // Build neighboring slides context (NO raw HTML - use extracted content)
  let contextStr = '';
  if (neighboringSlides.previous) {
    const prevSlide = neighboringSlides.previous;
    contextStr += `\n\n--- PREVIOUS SLIDE (${slideNumber ? slideNumber - 1 : '?'}) ---`;
    contextStr += `\nTitle: "${prevSlide.title || 'Untitled'}"`;
    if (prevSlide.type) contextStr += ` | Type: ${prevSlide.type}`;
    if (prevSlide.summary) {
      contextStr += `\nSummary: ${prevSlide.summary}`;
    }
    contextStr += `\n${extractSlideContentForAI(prevSlide.html, { maxLength: 400 })}`;
  }
  if (neighboringSlides.next) {
    const nextSlide = neighboringSlides.next;
    contextStr += `\n\n--- NEXT SLIDE (${slideNumber ? slideNumber + 1 : '?'}) ---`;
    contextStr += `\nTitle: "${nextSlide.title || 'Untitled'}"`;
    if (nextSlide.type) contextStr += ` | Type: ${nextSlide.type}`;
    if (nextSlide.summary) {
      contextStr += `\nSummary: ${nextSlide.summary}`;
    }
    contextStr += `\n${extractSlideContentForAI(nextSlide.html, { maxLength: 400 })}`;
  }

  // Build full deck overview with clear structure
  let deckOverview = '';
  if (neighboringSlides.allSlides && neighboringSlides.allSlides.length > 0) {
    deckOverview = `\n\n=== FULL DECK STRUCTURE (${neighboringSlides.allSlides.length} slides) ===`;
    neighboringSlides.allSlides.forEach((slide, idx) => {
      const marker = (idx + 1 === slideNumber) ? ' ← YOU ARE HERE' : '';
      const slideType = slide.type ? ` [${slide.type}]` : '';
      deckOverview += `\n${idx + 1}. ${slide.title || 'Untitled'}${slideType}${marker}`;
      if (slide.summary && idx + 1 !== slideNumber) {
        deckOverview += `\n   └─ ${slide.summary.substring(0, 100)}`;
      }
    });
  }

  const userPrompt = `TASK: Edit this slide while considering its position and context in the presentation.
${positionHeader}${metadataStr}

CURRENT SLIDE HTML (this is what you are editing):
${html}
${contextStr}
${deckOverview}

USER INSTRUCTION: ${instruction}

GUIDELINES:
1. Apply the user's instruction to the CURRENT SLIDE only
2. Be aware of what comes before and after - maintain narrative flow
3. Ensure MECE (Mutually Exclusive, Collectively Exhaustive) with related slides
4. Don't repeat content that's covered in neighboring slides
5. Maintain consistent terminology, tone, and visual style with the deck
6. Keep professional consulting tone

Return ONLY the modified HTML for the current slide.`;

  try {
    let content;

    content = await callWithModelFallback(settings, EDIT_SYSTEM_PROMPT, userPrompt);

    // Extract single slide (AI may return multiple versions - take the last one)
    content = extractSingleSlide(content);

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Edit multiple slides at once
export async function improveMultipleSlides(slides, instruction, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const totalSlides = slides.length;

  // Build slides data for the prompt with position context
  const slidesData = slides.map((slide, idx) => {
    const position = idx + 1;
    let positionNote = '';
    if (position === 1) positionNote = ' (FIRST - typically cover/intro)';
    else if (position === totalSlides) positionNote = ' (LAST - typically conclusion)';

    return {
      index: position,
      title: slide.title || 'Untitled',
      type: slide.type || 'custom',
      positionNote,
      html: slide.html.substring(0, 2500), // Slightly more context per slide
    };
  });

  // Build deck overview first
  const deckOverview = `=== DECK STRUCTURE (${totalSlides} slides) ===
${slidesData.map(s => `${s.index}. "${s.title}" [${s.type}]${s.positionNote}`).join('\n')}`;

  const userPrompt = `TASK: Apply the instruction to ALL slides in this deck.

${deckOverview}

=== SLIDES TO EDIT ===
${slidesData.map(s => `
--- SLIDE ${s.index} of ${totalSlides}: "${s.title}" [${s.type}]${s.positionNote} ---
${s.html}
`).join('\n')}

USER INSTRUCTION: ${instruction}

REQUIREMENTS:
1. Apply the instruction consistently across ALL slides
2. Be aware of each slide's position in the deck (first, middle, last)
3. Maintain narrative flow and coherence between slides
4. Keep each slide's layout structure but modify content as instructed
5. Ensure MECE (no overlapping content, no gaps in the story)
6. First slide should feel like an opening, last slide should feel like a closing

Return the modified HTML for ALL slides in this EXACT format:
---SLIDE_1---
[Complete HTML for slide 1]
---SLIDE_2---
[Complete HTML for slide 2]
...continue for all ${totalSlides} slides.`;

  try {
    let content;

    content = await callWithModelFallback(settings, EDIT_SYSTEM_PROMPT, userPrompt);

    // Clean up
    content = content
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse the response to extract individual slides
    const results = [];
    const slidePattern = /---SLIDE_(\d+)---\s*([\s\S]*?)(?=---SLIDE_\d+---|$)/g;
    let match;

    while ((match = slidePattern.exec(content)) !== null) {
      const slideIndex = parseInt(match[1]) - 1;
      const slideHtml = match[2].trim();
      if (slideIndex >= 0 && slideIndex < slides.length && slideHtml) {
        results[slideIndex] = slideHtml;
      }
    }

    // Fill in any missing slides with original content
    for (let i = 0; i < slides.length; i++) {
      if (!results[i]) {
        results[i] = slides[i].html; // Keep original if parsing failed
      }
    }

    return results;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Generate PPTX export code for a single slide
export async function generateSlideExportCode(slideHtml, slideType, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const exportPrompt = `Generate JavaScript code using PptxGenJS to recreate this HTML slide as a PowerPoint slide.

HTML Slide:
${slideHtml}

Slide Type: ${slideType}

Requirements:
1. Use PptxGenJS library syntax
2. Return a function that takes (pptx, slideNum, totalSlides) as parameters
3. The function should add one slide to the pptx object
4. Use these colors: maroon=#8E1E1E, red=#A32020, main=#111111, meta=#4A4F57, zone1=#F7F9FB
5. Slide size is 13.333 x 7.5 inches (standard 16:9)
6. Extract all text content from the HTML and position it appropriately
7. Return ONLY the JavaScript function code, no explanations

Example output format:
function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  slide.addText("Title", { x: 0.5, y: 0.5, fontSize: 28, color: "111111" });
  // ... more slide content
}`;

  try {
    let content;
    const systemPrompt = 'You are a JavaScript code generator specializing in PptxGenJS. Return only valid JavaScript code, no markdown or explanations.';

    content = await callWithModelFallback(settings, systemPrompt, exportPrompt);

    // Clean up
    content = content
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Transform an existing slide to a different template.
// Now delegates to the enhanced improveSlideWithTemplate for a unified code path.
// Accepts optional deckContext and userGuidance for deck-aware switching.
export async function transformSlideToTemplate(slideHtml, targetTemplateId, settings, customTemplate = null, slidePosition = null, deckContext = null, userGuidance = null) {
  if (!targetTemplateId || targetTemplateId === 'freestyle' || targetTemplateId === 'custom') {
    return slideHtml;
  }

  const targetTemplate = customTemplate || SLIDE_TEMPLATES[targetTemplateId];
  if (!targetTemplate) {
    console.warn(`[transformSlideToTemplate] Template "${targetTemplateId}" not found, returning original`);
    return slideHtml;
  }

  return improveSlideWithTemplate(
    slideHtml,
    'Convert to this template, preserving all content and pillars exactly',
    targetTemplate,
    settings,
    slidePosition,
    deckContext,
    userGuidance,
  );
}

// Helper to get master-specific instructions for template generation
export function getMasterInstructions(master) {
  const instructions = {
    standard: `This master has:
- Title area at top (30px from top)
- Subtitle below title (101px from top)
- Content frame starting at 137px from top, height 353px
- Footer at bottom
Use: <h1 class="title">...</h1>, <h2 class="subtitle">...</h2>, <div class="frame">...</div>, <footer class="footer">...</footer>`,

    blank: `This master is a BLANK CANVAS - NO title and NO subtitle!
- Content frame starts at 35px from top with full height (455px)
- Footer at bottom
- Use the entire slide area for content
DO NOT include any <h1 class="title"> or <h2 class="subtitle"> elements.
Use: <div class="frame">...</div>, <footer class="footer">...</footer>`,

    titleOnly: `This master has only a title - NO subtitle!
- Title area at top (30px from top)
- Content frame starting at 90px from top, height 400px (more vertical space)
- Footer at bottom
DO NOT include <h2 class="subtitle"> element.
Use: <h1 class="title">...</h1>, <div class="frame">...</div>, <footer class="footer">...</footer>`,

    cover: `This master is for COVER/TITLE slides - centered, branded layout:
- No standard title/subtitle structure
- No footer (cover slides don't have page numbers)
- Use centered cover elements
Use cover-specific classes: .cover-slide, .cover-category, .cover-title, .cover-branding, .cover-date
Do NOT include regular .title, .subtitle, or .footer elements.`,

    emptyPage: `This master is a FULL PAGE with NO margins, NO borders, NO frame constraints!
- Content starts at position 0,0 and fills the entire 960x540px slide
- No title, no subtitle, no footer - completely empty canvas
- Use absolute positioning for elements anywhere on the slide
- The entire slide area is available with no padding or margins
DO NOT include any .title, .subtitle, .frame, or .footer elements.
Position all content with absolute positioning directly in the .slide container.`,
  };

  return instructions[master] || instructions.standard;
}
