import { SLIDE_TEMPLATES, getTemplateFlex, getTemplateGuidance } from '../../utils/slideTemplates';
import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import { searchTemplatesByEmbedding, searchTemplatesByKeywords, selectBestTemplate, randomizeFamilyVariant, estimateItemCount } from '../templateEmbeddings';
import { getCredentials } from './models.js';
import { callWithModelFallback, getFastModelSettings } from './apiClient.js';
import { CHART_GEOMETRY_GUIDE, CSS_STYLE_GUIDE, DEFAULT_SYSTEM_PROMPT, TITLE_HEADER_RULES, TYPOGRAPHY_SIZE_GUIDE, FREESTYLE_COMPONENT_GUIDE, getWorkLevelInstructions } from './constants.js';
import { buildFreestyleSystemPrompt } from './freestylePromptBuilder.js';
import { extractSingleSlide, flattenNestedFrames, ensureSlideStructure } from './slideGeneration.js';
import { currentDateString, safeJSONParse } from './router.js';
import { applyPromptOverride, appendPromptOverride, recordPromptPayload } from './promptOverrides.js';

// Helper to get master-specific instructions for template generation
export function getMasterInstructions(master) {
  const instructions = {
    standard: `This master has:
- Title area at top (24px from top, left 28px, width 904px)
- Subtitle below title (95px from top)
- Content frame at top:127px, 904x366px
- Footer at bottom
Use: <h1 class="title">...</h1>, <h2 class="subtitle">...</h2>, <div class="frame">...</div>, <footer class="footer">...</footer>`,

    blank: `This master is a BLANK CANVAS - NO title and NO subtitle!
- Content frame starts at 28px from top, 904x468px (expanded height)
- Footer at bottom
DO NOT include any <h1 class="title"> or <h2 class="subtitle"> elements.
Use: <div class="frame">...</div>, <footer class="footer">...</footer>`,

    titleOnly: `This master has only a title - NO subtitle!
- Title area at top (24px from top, left 28px, width 904px)
- Content frame at top:72px, 904x424px (more vertical space)
- Footer at bottom
DO NOT include <h2 class="subtitle"> element.
Use: <h1 class="title">...</h1>, <div class="frame">...</div>, <footer class="footer">...</footer>`,

    cover: `This master is for COVER/TITLE slides - centered, branded layout:
- No standard title/subtitle structure
- No footer (cover slides don't have page numbers)
- Frame at top:140px with auto height
Use cover-specific classes: .cover-slide, .cover-category, .cover-title, .cover-branding, .cover-date
Do NOT include regular .title, .subtitle, or .footer elements.`,

    emptyPage: `This master is a FULL PAGE with NO margins, NO borders, NO frame constraints!
- Content fills the entire 960x540px slide
- No title, no subtitle, no footer - completely empty canvas
- Use absolute positioning for elements anywhere on the slide
DO NOT include any .title, .subtitle, .frame, or .footer elements.
Position all content with absolute positioning directly in the .slide container.`,
  };

  return instructions[master] || instructions.standard;
}

// Generate a new template from a description/prompt
export async function generateTemplate(description, settings, master = 'standard') {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Get master-specific instructions
  const masterInstructions = getMasterInstructions(master);

  // Use the concise component guide for template creation
  // Use custom guide from settings if available, otherwise use default
  const guideToUse = buildFreestyleSystemPrompt(settings);
  const freestyleSystemPrompt = `You are an expert consulting presentation designer creating reusable slide templates.

${guideToUse}

Return ONLY raw HTML. Use placeholder text like "[Title here]" for content areas.`;

  const templatePrompt = `CRITICAL: You MUST create EXACTLY the layout described. Do NOT substitute with a different layout.

USER REQUEST:
"${description}"

HEIGHT PLANNING (CRITICAL - prevent overflow):
- Usable content area: ~400-420px tall (slide is ~540px total minus title/subtitle/footer)
- PLAN element count to fit: 3 cards (~280px), 4 bullets (~100px), grid 2x2 (~350px)
- NEVER combine multiple heavy components (e.g., cards + grid)
- If many items needed, use COMPACT styles or split across slides

RULES - FOLLOW EXACTLY:
1. If user says "3x3 matrix/grid" → create a 3x3 grid (9 cells in 3 rows × 3 columns)
2. If user says "2x2" → create exactly 4 cells in 2 rows × 2 columns
3. If user says "4 cards" → create exactly 4 cards (use class="compact" for 4+)
4. If user says "timeline with 5 steps" → create exactly 5 timeline items (compact)
5. MATCH THE EXACT STRUCTURE REQUESTED - don't interpret or change it
6. If structure would overflow, use compact variants or smaller text

SLIDE MASTER: ${master.toUpperCase()}
${masterInstructions}

PLACEHOLDER TEXT FORMAT:
- "[Row 1, Col 1 title]"
- "[Cell description]"
- Use numbers: 01, 02, 03... for cell labels

Return ONLY the HTML wrapped in <div class="slide">...</div>. The layout MUST match "${description}" exactly and FIT within the slide.`;

  try {
    let content;

    content = await callWithModelFallback(settings, freestyleSystemPrompt, templatePrompt);

    // Clean up code blocks
    content = content
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // If slide wrapper is missing, try to wrap the content
    // Match class="slide" or class="slide ..." (with extra classes like master-blank)
    if (!/class=["']slide[\s"']/i.test(content)) {
      if (content.includes('class="frame"') || content.includes("class='frame'")) {
        content = `<div class="slide">
  <h1 class="title">[Title]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  ${content}
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`;
      } else {
        content = `<div class="slide">
  <h1 class="title">[Title]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    ${content}
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`;
      }
    }

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// =============================================================================
// EMBEDDING-BASED TEMPLATE SELECTION (Token-efficient)
// =============================================================================

/**
 * Select template using embeddings + GPT (token-optimized)
 * Flow: Embeddings find top 3 → GPT picks best from those 3
 * Much more efficient than sending all templates to GPT
 */
export async function selectTemplateWithEmbeddings(userPrompt, availableTemplates, settings, options = {}) {
  const { returnDetails = false, minConfidence = 30, useGPTSelection = true } = options;

  debugLog(LogLevel.INFO, 'selectTemplateEmbeddings', `Finding template for: "${userPrompt.substring(0, 50)}..."`);

  try {
    // Step 1: Use embeddings to find top 3 candidates
    const candidates = await searchTemplatesByEmbedding(userPrompt, settings, 3);

    if (!candidates || candidates.length === 0) {
      debugLog(LogLevel.WARN, 'selectTemplateEmbeddings', 'No embedding candidates found');
      // Fall back to bulletPoints as default
      const fallbackTemplate = availableTemplates.find(t => t.id === 'bulletPoints') || availableTemplates[0];
      return returnDetails ? {
        template: fallbackTemplate,
        confidence: 40,
        modifications: [],
        reasoning: 'Fallback - no candidates found',
        method: 'fallback',
      } : fallbackTemplate;
    }

    debugLog(LogLevel.INFO, 'selectTemplateEmbeddings', `Top 3 candidates: ${candidates.map(c => `${c.templateId}(${c.confidence}%)`).join(', ')}`);

    // Step 2: If top match is very confident (>75%), use it directly without GPT
    if (candidates[0].confidence >= 75) {
      const topCandidate = candidates[0];
      const template = availableTemplates.find(t => t.id === topCandidate.templateId);

      if (template) {
        debugLog(LogLevel.INFO, 'selectTemplateEmbeddings', `High confidence direct match: ${topCandidate.templateId}`);
        const detail = {
          template,
          confidence: topCandidate.confidence,
          modifications: [],
          reasoning: `High confidence embedding match: ${topCandidate.qualification?.layoutSummary || topCandidate.templateId}`,
          method: 'embedding-direct',
          alternatives: candidates.slice(1).map(c => ({
            templateId: c.templateId,
            confidence: c.confidence,
          })),
        };
        const randomized = randomizeFamilyVariant({ templateId: topCandidate.templateId });
        if (randomized.variantOf) {
          const swapped = availableTemplates.find(t => t.id === randomized.templateId);
          if (swapped) {
            detail.template = swapped;
            detail.reasoning += ` (variant swap: ${randomized.templateId})`;
          }
        }
        return returnDetails ? detail : detail.template;
      }
    }

    // Step 3: Use GPT to select from top 3 (if enabled and multiple candidates)
    if (useGPTSelection && candidates.length > 1) {
      const selected = await selectBestTemplate(userPrompt, candidates, settings);

      if (selected) {
        const template = availableTemplates.find(t => t.id === selected.templateId);

        if (template) {
          debugLog(LogLevel.INFO, 'selectTemplateEmbeddings', `GPT selected: ${selected.templateId}`);
          const detail = {
            template,
            confidence: selected.confidence,
            modifications: [],
            reasoning: `GPT selected from top 3: ${selected.qualification?.layoutSummary || selected.templateId}`,
            method: 'embedding-gpt',
            alternatives: candidates.filter(c => c.templateId !== selected.templateId).map(c => ({
              templateId: c.templateId,
              confidence: c.confidence,
            })),
          };
          const randomized = randomizeFamilyVariant({ templateId: selected.templateId });
          if (randomized.variantOf) {
            const swapped = availableTemplates.find(t => t.id === randomized.templateId);
            if (swapped) {
              detail.template = swapped;
              detail.reasoning += ` (variant swap: ${randomized.templateId})`;
            }
          }
          return returnDetails ? detail : detail.template;
        }
      }
    }

    // Step 4: Fall back to top embedding match
    const bestCandidate = candidates[0];
    const template = availableTemplates.find(t => t.id === bestCandidate.templateId);

    if (template && bestCandidate.confidence >= minConfidence) {
      const detail = {
        template,
        confidence: bestCandidate.confidence,
        modifications: [],
        reasoning: `Best embedding match: ${bestCandidate.qualification?.layoutSummary || bestCandidate.templateId}`,
        method: 'embedding-fallback',
      };
      const randomized = randomizeFamilyVariant({ templateId: bestCandidate.templateId });
      if (randomized.variantOf) {
        const swapped = availableTemplates.find(t => t.id === randomized.templateId);
        if (swapped) {
          detail.template = swapped;
          detail.reasoning += ` (variant swap: ${randomized.templateId})`;
        }
      }
      return returnDetails ? detail : detail.template;
    }

    // No good match found
    return returnDetails ? {
      template: null,
      confidence: 0,
      modifications: [],
      reasoning: 'No template matched above minimum confidence',
      method: 'none',
      closestTemplate: candidates[0] ? availableTemplates.find(t => t.id === candidates[0].templateId) : null,
      closestTemplateConfidence: candidates[0]?.confidence || 0,
    } : null;

  } catch (error) {
    debugLog(LogLevel.ERROR, 'selectTemplateEmbeddings', `Error: ${error.message}`);

    // Fall back to keyword search (uses static import)
    const keywordMatches = searchTemplatesByKeywords(userPrompt, 3);

    if (keywordMatches.length > 0) {
      const best = keywordMatches[0];
      const template = availableTemplates.find(t => t.id === best.templateId);

      if (template) {
        const detail = {
          template,
          confidence: best.confidence,
          modifications: [],
          reasoning: `Keyword fallback: ${best.templateId}`,
          method: 'keyword-fallback',
        };
        const randomized = randomizeFamilyVariant({ templateId: best.templateId });
        if (randomized.variantOf) {
          const swapped = availableTemplates.find(t => t.id === randomized.templateId);
          if (swapped) {
            detail.template = swapped;
            detail.reasoning += ` (variant swap: ${randomized.templateId})`;
          }
        }
        return returnDetails ? detail : detail.template;
      }
    }

    return returnDetails ? { template: null, confidence: 0, modifications: [], reasoning: error.message } : null;
  }
}

// AI-based template selection with confidence scoring and modification detection
// Returns: { template, confidence, modifications, reasoning, isVariant }
// NOTE: For token efficiency, prefer selectTemplateWithEmbeddings() instead
export async function selectTemplateWithAI(userPrompt, availableTemplates, settings, options = {}) {
  const { returnDetails = false, minConfidence = 30 } = options;

  // Try embedding-based selection first (more token-efficient)
  try {
    const embeddingResult = await selectTemplateWithEmbeddings(userPrompt, availableTemplates, settings, { returnDetails: true, minConfidence });

    if (embeddingResult?.template && embeddingResult.confidence >= minConfidence) {
      debugLog(LogLevel.INFO, 'selectTemplateWithAI', `Using embedding result: ${embeddingResult.template.id} (${embeddingResult.confidence}%)`);
      return returnDetails ? embeddingResult : embeddingResult.template;
    }
  } catch (err) {
    debugLog(LogLevel.WARN, 'selectTemplateWithAI', `Embedding selection failed: ${err.message}, falling back to full LLM`);
  }

  // Fall back to full LLM selection if embeddings didn't work well
  // Use fast model for template selection
  const fastSettings = getFastModelSettings(settings);
  const creds = getCredentials(fastSettings);

  if (!creds.apiKey) {
    return returnDetails ? { template: null, confidence: 0, modifications: [], reasoning: 'No API key' } : null;
  }

  // Create detailed template summary for AI evaluation, including item capacity from flex rules
  const templateSummary = availableTemplates.map((t, idx) => {
    const flex = getTemplateFlex(t.id);
    const capacityStr = flex
      ? `\n   Capacity: ${flex.min}-${flex.max} ${flex.element}s (default ${flex.default})${flex.layout === 'grid' && flex.gridBase ? ` [${flex.gridBase[0]}×${flex.gridBase[1]} grid${flex.gridAlts ? ', can adapt to ' + flex.gridAlts.map(a => `${a[0]}×${a[1]}`).join('/') : ''}]` : ''}`
      : '';
    return `${idx + 1}. ID: "${t.id}"
   Title: ${t.title}
   Description: ${t.description || 'Professional slide layout'}
   Category: ${t.category || 'General'}
   Best for: ${getTemplateBestFor(t.id)}${capacityStr}${t.note ? `\n   Requirements: ${t.note.slice(0, 150)}` : ''}`;
  }).join('\n\n');

  // Estimate item count from user prompt for smarter selection
  const { count: estimatedItems, confidence: countConf } = estimateItemCount(userPrompt);
  const itemCountHint = estimatedItems > 0
    ? `\n\nDETECTED ITEM COUNT: ~${estimatedItems} distinct items (${countConf} confidence). Choose templates whose capacity range includes ${estimatedItems}. If the count is ${estimatedItems}, a template with default ${estimatedItems} is ideal.`
    : '';

  const selectionPrompt = `You are an expert slide deck designer. Templates should SERVE the content - never force content into ill-fitting templates.

USER'S REQUEST:
"${userPrompt}"${itemCountHint}

AVAILABLE TEMPLATES:
${templateSummary}

SMART TEMPLATE SELECTION:
Templates should serve the content, NOT force content into templates.

ITEM COUNT IS CRITICAL:
- Count the number of distinct items/points in the user's content
- Choose templates whose Capacity range (min-max) includes the item count
- NEVER choose a template with more default slots than items (e.g., don't use 6-cell grid for 4 items)
- Prefer templates whose default matches the item count exactly

ONLY USE A TEMPLATE IF:
- The content NATURALLY fits the template structure (e.g., 3 distinct points → 3-cards)
- The item count falls within the template's min-max capacity range
- You have ACTUAL data for the template's required fields

PREFER FREESTYLE WHEN:
- Content is unique or doesn't match any template pattern
- Content would require inventing placeholder content to fill template slots
- Template requires data you don't have (times, metrics, icons)

GRID ADAPTATION (when using a grid template):
- If item count < template default, specify the adapted grid dimensions in modifications
- Example: 4 items on a 2×3 grid → add modification "adapt grid to 2×2"
- Example: 3 items on a 3×2 grid → add modification "adapt grid to 3×1"
- NEVER leave grid cells empty — always adapt the grid to match item count

QUALITY over template-matching: A clean freestyle slide with real content beats a template padded with filler.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "selectedTemplateId": "templateId or null if freestyle",
  "confidence": 85,
  "isVariant": false,
  "modifications": ["drop time column", "use only 2 cards"],
  "reasoning": "Content has exactly 3 distinct pillars that map naturally to 3-cards template",
  "layoutGuidance": null,
  "closestTemplateId": "bestMatchingTemplateId",
  "closestTemplateConfidence": 75,
  "closestTemplateReasoning": "Brief reason this template is the closest match"
}

IMPORTANT: If content doesn't naturally fit ANY template, choose freestyle (selectedTemplateId: null). A well-designed freestyle slide is better than a forced template fit.
When choosing freestyle, you MUST also set "layoutGuidance" to a descriptive creative brief for the designer.
Be specific — write like a manager: "left side: big stat, right side: 3 bullet points" or "2x2 grid with icons, each cell has bold title and one line".
You can use a known pattern name (2x2, 3-cards, bullets, split, kpi-row, timeline, etc.) OR write a custom description. The more prescriptive, the better.`;

  try {
    let response;

    response = await callWithModelFallback(fastSettings, 'You are a template selection expert. Always respond with valid JSON.', selectionPrompt);

    // Parse JSON response with repair for common AI response issues
    let parsed;
    try {
      // Clean response - remove markdown code blocks if present
      const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = safeJSONParse(cleanedResponse, 'Template Selection');
    } catch (parseError) {
      // Fallback: try to extract template ID from response
      const idMatch = response.match(/"selectedTemplateId"\s*:\s*"([^"]+)"/);
      if (idMatch) {
        parsed = { selectedTemplateId: idMatch[1], confidence: 50, modifications: [] };
      } else {
        console.warn('Failed to parse template selection response:', response);
        return returnDetails ? { template: null, confidence: 0, modifications: [], reasoning: 'Parse error' } : null;
      }
    }

    const {
      selectedTemplateId,
      confidence = 50,
      isVariant = false,
      modifications = [],
      reasoning = '',
      layoutGuidance: parsedLayoutGuidance = null,
      closestTemplateId,
      closestTemplateConfidence = 0,
      closestTemplateReasoning = '',
    } = parsed;

    // Find closest template (always provided, even when freestyle selected)
    const closestTemplate = closestTemplateId
      ? availableTemplates.find(t =>
          t.id.toLowerCase() === closestTemplateId.toLowerCase() ||
          t.id.toLowerCase().includes(closestTemplateId.toLowerCase())
        )
      : null;

    // Log for debugging
    debugLog(LogLevel.INFO, 'selectTemplate', `Selected: ${selectedTemplateId} (${confidence}%)`, {
      isVariant,
      modifications,
      reasoning,
      layoutGuidance: parsedLayoutGuidance,
      closest: closestTemplateId ? `${closestTemplateId} (${closestTemplateConfidence}%)` : 'none',
    });

    // Check if freestyle was selected (no template or explicit freestyle)
    const isFreestyle = !selectedTemplateId || selectedTemplateId === 'null' || selectedTemplateId === 'freestyle';

    if (isFreestyle) {
      // Return with closest template info for user choice
      if (returnDetails) {
        return {
          template: null,
          confidence: 0,
          modifications: [],
          reasoning: reasoning || 'Freestyle selected',
          isVariant: false,
          isFreestyle: true,
          layoutGuidance: parsedLayoutGuidance,
          closestTemplate,
          closestTemplateConfidence,
          closestTemplateReasoning,
        };
      }
      return null;
    }

    // Find the matching template
    const matchedTemplate = availableTemplates.find(t =>
      t.id.toLowerCase() === selectedTemplateId.toLowerCase() ||
      t.id.toLowerCase().includes(selectedTemplateId.toLowerCase()) ||
      selectedTemplateId.toLowerCase().includes(t.id.toLowerCase())
    );

    if (!matchedTemplate) {
      // Fallback to closest template if main selection not found
      if (closestTemplate && closestTemplateConfidence >= minConfidence) {
        if (returnDetails) {
          return {
            template: closestTemplate,
            confidence: closestTemplateConfidence,
            modifications,
            reasoning: closestTemplateReasoning || 'Fallback to closest match',
            isVariant,
            closestTemplate,
            closestTemplateConfidence,
            closestTemplateReasoning,
          };
        }
        return closestTemplate;
      }
      return returnDetails
        ? { template: null, confidence: 0, modifications: [], reasoning: 'Template not found', closestTemplate, closestTemplateConfidence, closestTemplateReasoning }
        : null;
    }

    // Randomize variant for variety (same logic as embedding path)
    const randomized = randomizeFamilyVariant({ templateId: matchedTemplate.id });
    const finalTemplate = randomized.variantOf
      ? (availableTemplates.find(t => t.id === randomized.templateId) || matchedTemplate)
      : matchedTemplate;
    const variantNote = randomized.variantOf ? ` (variant swap: ${randomized.templateId})` : '';

    // Return with or without details - always include closest for transparency
    if (returnDetails) {
      return {
        template: finalTemplate,
        confidence,
        modifications,
        reasoning: reasoning + variantNote,
        isVariant,
        closestTemplate: closestTemplate || matchedTemplate,
        closestTemplateConfidence: closestTemplateConfidence || confidence,
        closestTemplateReasoning: closestTemplateReasoning || reasoning,
      };
    }

    // For backwards compatibility, just return the template
    // But attach modifications as a property if present
    if (modifications.length > 0) {
      finalTemplate._modifications = modifications;
      finalTemplate._isVariant = isVariant;
    }

    return finalTemplate;
  } catch (error) {
    console.warn('AI template selection failed:', error);
    debugLog(LogLevel.ERROR, 'selectTemplate', `Error: ${error.message}`);
    return returnDetails
      ? { template: null, confidence: 0, modifications: [], reasoning: error.message }
      : null;
  }
}

// Helper: Get best-use description for each template type
export function getTemplateBestFor(templateId) {
  const bestFor = {
    'cover': 'Title slides, presentation openers, section dividers',
    'threeCards': 'Three key points, features, pillars, options to compare',
    'fourCards': 'Four items, quadrants, categories, features',
    'twoColumn': 'Side-by-side comparison, text with image, split content',
    'bulletPoints': 'Lists, multiple points, takeaways, key items',
    'kpiMetrics': 'Key numbers, statistics, metrics, performance data',
    'prosAndCons': 'Advantages/disadvantages, compare two sides, trade-offs',
    'beforeAfter': 'Transformations, improvements, state changes',
    'roadmapTimeline': 'Project phases, timelines, step-by-step processes',
    'milestoneTracker': 'Progress tracking, achievements, key dates',
    'problemSolution': 'Challenge and resolution, pain points and fixes',
    'quote': 'Testimonials, key quotes, highlighted statements',
    'teamProfiles': 'Team introductions, speaker bios, profiles',
    'pricingTable': 'Pricing tiers, plan comparison, package options',
    'dataChart': 'Charts, graphs, data visualization placeholders',
    'imageGallery': 'Multiple images, portfolio, visual showcase',
    'pyramid': 'Hierarchical concepts, priorities, layered ideas',
    'process': 'Workflows, step-by-step guides, procedures',
    'swot': 'SWOT analysis, 4-quadrant analysis',
    'executive-summary': 'High-level overview, summary for executives',
  };
  return bestFor[templateId] || 'General purpose professional slide';
}

// Plan templates for multiple slides - AI decides which template fits each slide
export async function planSlidesWithTemplates(userPrompt, slideCount, availableTemplates, settings) {
  // Use fast model for planning - this should be quick!
  const fastSettings = getFastModelSettings(settings);
  const creds = getCredentials(fastSettings);

  if (!creds.apiKey) {
    return null; // Fall back to single template approach
  }

  // Create a MINIMAL summary of available templates - just ID and best use case
  const templateSummary = availableTemplates.slice(0, 15).map(t =>
    `${t.id}: ${t.title}`
  ).join('\n');

  const planningPrompt = `Plan ${slideCount} slides for: "${userPrompt}"

TEMPLATES:
${templateSummary}

For each slide, pick best template. Use "freestyle" if none fit.

RESPOND AS JSON ARRAY ONLY:
[{"slideNumber":1,"templateId":"cover","contentDescription":"Main title"},{"slideNumber":2,"templateId":"threeCards","contentDescription":"Key points"}]`;

  try {
    let response;

    response = await callWithModelFallback(fastSettings, 'Respond ONLY with JSON array.', planningPrompt);

    // Clean and parse the JSON response with repair for common AI response issues
    let cleanedResponse = response.trim();
    // Remove markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const plan = safeJSONParse(cleanedResponse, 'Plan Slides');

    // Validate the plan structure
    if (!Array.isArray(plan) || plan.length === 0) {
      return null;
    }

    // Map template IDs to actual templates and validate
    return plan.map((item, index) => {
      const templateId = item.templateId?.toLowerCase()?.replace(/['"]/g, '') || 'freestyle';

      // Find matching template
      let matchedTemplate = null;
      if (templateId !== 'freestyle') {
        matchedTemplate = availableTemplates.find(t =>
          t.id.toLowerCase() === templateId ||
          t.id.toLowerCase().includes(templateId) ||
          templateId.includes(t.id.toLowerCase())
        );
      }

      return {
        slideNumber: index + 1,
        templateId: matchedTemplate?.id || null,
        template: matchedTemplate,
        contentDescription: item.contentDescription || userPrompt,
      };
    });
  } catch (error) {
    console.warn('AI slide planning failed:', error);
    return null;
  }
}

// ─── Data-aware template re-evaluation ───────────────────────────────────────
// Analyzes the instruction content and validates whether the router's template
// choice actually fits the data shape.  Returns the original templateId when the
// match is fine, or a better-fitting templateId when there's a clear mismatch.
// This is a fast, local heuristic — no API call needed.
export function reEvaluateTemplateForData(templateId, instruction) {
  if (!templateId || !instruction) return templateId;

  const text = instruction.toLowerCase();

  // Only re-evaluate chart/data templates — leave structural templates alone
  const dataTemplates = new Set([
    'barChartExhibit', 'waterfallChart', 'graphInsights',
    'dualCharts', 'peerBenchmark', 'indexBenchmark', 'percentileBenchmark',
    'competitiveBenchmark', 'gapAnalysis', 'kpiMetrics',
  ]);
  if (!dataTemplates.has(templateId)) return templateId;

  // ── Heuristic signals ────────────────────────────────────────────────────

  // Count distinct entity-like names (Company X, [Name]:, capitalized proper nouns before numbers)
  // Simple proxy: count occurrences of patterns like "Company A 12%", "Apple: $18B", or list-style "• Google"
  const entityPatterns = text.match(
    /(?:^|\n|[•\-–])\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*[:=]?\s*[\d$€£¥%]/gm
  );
  const estimatedEntities = entityPatterns ? new Set(
    entityPatterns.map(m => m.replace(/^[\s•\-–]+/, '').split(/[\s:=]/)[0].toLowerCase())
  ).size : 0;

  // Detect time references
  const yearPattern = /\b20[0-9]{2}\b/g;
  const yearMatches = text.match(yearPattern);
  const uniqueYears = yearMatches ? new Set(yearMatches).size : 0;
  const hasQuarters = /\bq[1-4]\b/i.test(text);
  const hasTimePeriods = uniqueYears >= 2 || hasQuarters;

  // Detect comparison keywords
  const comparisonKeywords = /\b(vs\.?|versus|compared?\s+to|benchmark|peer|competitor|ranking|rank|top\s+\d|relative\s+to)\b/i;
  const isComparison = comparisonKeywords.test(text);

  // Detect multiple metrics per entity (table-like data)
  const multiMetric = /\b(revenue|margin|growth|return|roe|roic|ebitda|eps|nps|market\s+share|debt)\b/gi;
  const metricMatches = text.match(multiMetric);
  const uniqueMetrics = metricMatches ? new Set(metricMatches.map(m => m.toLowerCase())).size : 0;

  // ── Mismatch detection ───────────────────────────────────────────────────

  // MISMATCH 1: indexBenchmark chosen but 3+ entities (indexBenchmark is for 2 entities over time)
  if (templateId === 'indexBenchmark' && estimatedEntities >= 3) {
    console.log(`[reEvaluateTemplate] Overriding ${templateId} → peerBenchmark (${estimatedEntities} entities, indexBenchmark supports 2)`);
    return 'peerBenchmark';
  }

  // MISMATCH 3: peerBenchmark chosen but only 1 entity with time series data → use indexBenchmark
  if (templateId === 'peerBenchmark' && estimatedEntities <= 1 && hasTimePeriods) {
    console.log(`[reEvaluateTemplate] Overriding ${templateId} → indexBenchmark (1 entity over time)`);
    return 'indexBenchmark';
  }

  // MISMATCH 4: barChartExhibit chosen but data has multiple metrics per entity (table layout better)
  if (templateId === 'barChartExhibit' && estimatedEntities >= 3 && uniqueMetrics >= 3) {
    console.log(`[reEvaluateTemplate] Overriding ${templateId} → peerBenchmark (${estimatedEntities} entities × ${uniqueMetrics} metrics)`);
    return 'peerBenchmark';
  }

  return templateId;
}

// Fill a template with content using AI - preserves template structure while customizing content
// Now supports modifications: array of changes to apply (e.g., "add icons", "change to 4 columns")
// options.agentMode: true = agent mode, false = chatbot mode (affects role settings and audit log)
export async function fillTemplateWithAI(template, contentDescription, settings, modifications = [], options = {}) {
  const { agentMode = false } = options;
  const startTime = Date.now();

  // Save the default model before role overrides — used as fallback if role model fails
  const defaultModel = settings.model;

  // Apply slideCreator role overrides based on mode
  // Fall back to legacy 'slideCreator' key for backward compatibility
  const roleKey = agentMode ? 'slideCreatorAgent' : 'slideCreatorChatbot';
  const scRole = settings.roleSettings?.[roleKey]
    || settings.roleSettings?.slideCreator
    || {};
  if (scRole.model) settings = { ...settings, model: scRole.model };
  if (scRole.maxTokens) settings = { ...settings, maxTokens: scRole.maxTokens };
  if (scRole.reasoningEffort) settings = { ...settings, reasoningEffort: scRole.reasoningEffort };
  if (scRole.temperature !== '' && scRole.temperature !== undefined) settings = { ...settings, temperature: scRole.temperature };
  // Stash default model for fallback when role model fails
  settings = { ...settings, _defaultModel: defaultModel };

  console.log('[fillTemplateWithAI] Role resolution →', {
    agentMode,
    roleKey,
    roleOverrides: {
      model: scRole.model || '(none)',
      maxTokens: scRole.maxTokens || '(none)',
      reasoningEffort: scRole.reasoningEffort || '(none)',
      temperature: scRole.temperature !== undefined && scRole.temperature !== '' ? scRole.temperature : '(none)',
    },
    effectiveSettings: {
      model: settings.model,
      maxTokens: settings.maxTokens,
      reasoningEffort: settings.reasoningEffort,
      temperature: settings.temperature,
    },
  });

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Check if template has attached modifications from smart selection
  const allModifications = [
    ...(template._modifications || []),
    ...modifications,
  ];

  // Build modification instructions if any
  const modificationSection = allModifications.length > 0
    ? `\n\nTEMPLATE MODIFICATIONS REQUIRED:
The user wants a VARIANT of this template. Apply these modifications while keeping the base structure:
${allModifications.map((m, i) => `${i + 1}. ${m}`).join('\n')}

When applying modifications:
- If asked to change number of items (e.g., "4 cards instead of 3"), duplicate or remove elements as needed
- If asked to add icons/images, add appropriate placeholders (use emoji or descriptive text like [Icon: chart])
- If asked to change layout orientation, reorganize the flex/grid structure
- Keep the same CSS classes and styling approach, just adapt the structure`
    : '';

  // Detect if we have source content (factual mode) vs creative mode
  const hasSourceContent = contentDescription.includes('=== SOURCE CONTENT');
  const modeGuidance = hasSourceContent
    ? `FACTUAL MODE - SOURCE DATA PROVIDED:
The content request includes "=== SOURCE CONTENT ===" section.
- Use ONLY the data from that section to fill the template
- Do NOT invent additional data points, metrics, or text
- Adapt the template structure to fit the actual data (fewer items is OK)
- If source has 3 items and template has 4 slots, use only 3 slots`
    : `CREATIVE MODE - GENERATE CONTENT:
No source data provided - this is a topic/theme request.
- Generate realistic, professional consulting content to fill the template
- Create appropriate data, metrics, insights that would make sense for this topic
- Fill ALL template slots with generated content
- Make the slide useful and complete`;

  // Build flex rules section for the prompt
  const flex = getTemplateFlex(template.id);
  let flexSection;
  if (!flex || flex.layout === 'fixed') {
    flexSection = `2. ITEM COUNT: Keep the template's default item count. Do NOT add or remove structural elements.
3. If content is TOO MUCH — prioritize and trim, do not add extra items.
4. If content is TOO LITTLE — in FACTUAL mode remove unused slots, in CREATIVE mode fill naturally.`;
  } else {
    let lines = [`2. ITEM COUNT FLEX: This template defaults to ${flex.default} ${flex.element}s (allowed range: ${flex.min}-${flex.max}).`,
      `   - PREFER the default count of ${flex.default}. Only deviate if the content clearly has a different number of distinct items that would be awkward to force into ${flex.default}.`,
      `   - Acceptable range: ${flex.min}-${flex.max}. Never go outside this — the visual breaks.`];
    if (flex.layout === 'grid' && flex.gridAlts) {
      lines.push(`   - GRID LAYOUT: Base is ${flex.gridBase[0]}×${flex.gridBase[1]} (${flex.default} cells). Allowed alternatives: ${flex.gridAlts.map(a => `${a[0]}×${a[1]} (${a[0]*a[1]} cells)`).join(', ')}. Do NOT create free-form arrangements.`);
      lines.push(`   - ADAPT GRID TO ITEM COUNT: If the content has fewer items than ${flex.default}, you MUST change the grid dimensions to match. For example, with ${flex.gridAlts[0]?.[0]*flex.gridAlts[0]?.[1] || '?'} items use ${flex.gridAlts[0]?.[0]}×${flex.gridAlts[0]?.[1]}. NEVER leave grid cells empty.`);
    }
    if (flex.scaling === 'shrink-rows') {
      lines.push(`   - CRITICAL FIT RULE: If you ADD rows/items beyond ${flex.default}, you MUST shrink ALL content proportionally so everything stays within the slide boundaries. Reduce font sizes, padding, and spacing. The slide must not overflow.`);
    } else if (flex.scaling === 'lighten-cols') {
      lines.push(`   - CRITICAL FIT RULE: If you ADD columns/items beyond ${flex.default}, you MUST reduce text per item to avoid crowding. Shorter titles, fewer bullets per card, tighter descriptions. Less text per item = more items fit.`);
    }
    lines.push(`3. If content is TOO LITTLE — in FACTUAL mode remove unused slots (down to ${flex.min}), in CREATIVE mode fill naturally.`);
    if (flex.note) lines.push(`   Note: ${flex.note}`);
    flexSection = lines.join('\n');
  }

  let fillPrompt = `You are filling in content for a Strategy& consulting slide template.
TODAY: ${currentDateString()}

TEMPLATE NAME: ${template.title}
TEMPLATE DESCRIPTION: ${template.description || 'Professional consulting slide'}
${template.note ? `\nTEMPLATE FILLING GUIDANCE:\n${template.note}\n` : ''}
${(() => { const g = getTemplateGuidance(template.id); return g ? `\nCONTENT GUIDANCE (recommended density to avoid overflow):\n${g}\n` : ''; })()}
${modeGuidance}

USER'S CONTENT REQUEST:
"${contentDescription}"${modificationSection}

TITLE EXTRACTION: If the content request starts with "TITLE:" and/or "SUBTITLE:" markers, use them DIRECTLY:
- "TITLE: ..." → h1.title (the header). Preserve the specific data, claims, and terminology. Lightly adjust to fit 8-12 words.
- "SUBTITLE: ..." → h2.subtitle (the topic label). Use as-is for the 3-4 word noun phrase.
Also recognize "SLIDE TITLE:" or "KEY MESSAGE:" as title sources.
Do NOT replace a specific insight with a generic label.

TEMPLATE HTML STRUCTURE:
${template.html}

${CHART_GEOMETRY_GUIDE}

${TYPOGRAPHY_SIZE_GUIDE}

${TITLE_HEADER_RULES}

CONTENT FIDELITY — PRESERVE THE USER'S CONTENT (HIGHEST PRIORITY):
The user's content is the PRIMARY deliverable. The template is a VEHICLE for that content, not the other way around.

First, determine the content mode:
A) TOPIC PROMPT (e.g., "AI trends", "Q3 performance") — generate realistic professional content. Fill the template with invented but plausible data.
B) PRECISE CONTENT (contains specific sentences, bullets, data with numbers, named entities, questions) — you are a LAYOUT ENGINE. Place their content into template slots. Do NOT reword.

Rules for PRECISE content:
- NEVER change the meaning, tone, or form of the user's content to fit the template.
- If the user provides QUESTIONS, they MUST remain as questions — do NOT rephrase as statements. "What drives our growth?" stays as "What drives our growth?", NOT "Key growth drivers".
- If the user provides SPECIFIC PHRASING, keep that phrasing verbatim. Do not paraphrase, shorten, or "professionalize".
- If the user provides specific data points, numbers, or names, reproduce them EXACTLY. Do not round, summarize, or paraphrase.
- You may lightly restructure for the template (e.g., split a sentence across title + body) but the WORDS must stay the same.
- ADAPT THE TEMPLATE TO THE CONTENT, not the content to the template. If the content doesn't naturally fit the template's slot structure, adjust the template (add/remove slots, change grid) — but NEVER distort the content.
- Only trim if content physically overflows — and even then, cut the least important parts, don't reword what remains.

INTELLIGENT CONTENT REPRESENTATION:
Before filling, THINK about how to represent the content smartly:
- COUNT the user's actual distinct items/points. This determines template structure.
- If the user has 4 items and the template defaults to 6 slots: ADAPT the template (remove 2 slots, change grid dimensions). Do NOT leave empty slots or pad with filler.
- If the user has 7 items and the template holds 4: CONSOLIDATE related items into groups that fit. Don't just drop 3 items — merge and restructure intelligently.
- Lead with the MOST IMPORTANT or IMPACTFUL item, not alphabetical or arbitrary order.
- Each card/cell/row should carry equal visual weight — if one item has much more text, trim it or split the others.
- For grid templates: change the grid CSS to match actual item count (e.g., grid-template-columns changes from 3 columns to 2).

RESPECT THE TEMPLATE - CRITICAL:
1. STRICTLY REPLICATE the template's HTML structure and CSS classes - do not improvise
${flexSection}
4. NEVER add structural elements not in the template (panels, columns, sections, icons) unless user explicitly requests
5. ITEM COUNT: match the content's natural item count. Remove unused HTML elements rather than leaving them empty. Adjust grid CSS (grid-template-columns, grid-template-rows) to match.
6. For unstructured text: extract key points, organize to fit the template, then remove excess HTML slots to match
7. Keep the slide CLEAN and PROFESSIONAL - consistency over creativity

EXECUTIVE WRITING STYLE - MANDATORY:
- Write like a senior consultant: INSIGHT-DRIVEN, CONCISE
- Card descriptions: 1-2 short lines max, not paragraphs
- KPI labels: 2-4 words. Values: number + unit only.
- Headers: verbal insight leading with outcome, never starting with a number count. GOOD: "Revenue grew 15% driven by new markets" BAD: "3 key revenue drivers" or "Revenue Overview"
- CLOSING/THANK YOU slides: Do NOT invent names, emails, phone numbers, or contact details. A thank you slide should simply say "Thank You" or a brief closing message — nothing more.
- SOURCE/CITATION: Any source attribution or citation (e.g., "Source: McKinsey 2024") MUST go ONLY in the <footer> element. NEVER place source labels or citations inside the content area (<div class="frame">).
- NEVER write long paragraphs on a slide — break into short key phrases
- LESS IS MORE: Fill the visual SPACE with layout (spacing, alignment) not with more text. The slide should feel light and easy to scan at a glance.

OVERFLOW PREVENTION (CRITICAL):
- The slide has a FIXED frame of 904×366px. Content MUST NOT overflow this boundary.
- If content risks overflow: CUT content first. Remove the weakest point, shorten descriptions, reduce item count. LESS content that fits cleanly is ALWAYS better than cramming.
- Only AFTER trimming content, if still tight, THEN slightly reduce font-size (by 1px max) or tighten padding.
- Never reduce below the typography floors above: body text 12px, section/pillar/card titles 14px, all small labels at least 10px.
- NEVER pack so much text that the slide feels "wall of text". Slides should feel LIGHT and easy to scan.
- A slide with 3 strong points and breathing room is better than 6 points crammed together.

ABSOLUTE RULES:
- You MUST always output valid HTML - never return JSON or error messages
- DO NOT remove slide wrapper, title, subtitle, or footer structure (EXCEPTION: blank-master templates like sectionDivider do NOT have title/subtitle/frame — reproduce their structure exactly as shown)
- Maintain the template's visual rhythm and spacing
- VERTICAL LOGIC: The header (h1) MUST match content count. If content has 3 cards, header must say "Three..." not "Five...". Count items first, then write header.
- STRUCTURAL DIRECTIVES: If the content request contains [STRUCTURE: ...], you MUST follow it exactly. It overrides flex defaults. E.g., [STRUCTURE: exactly 5 items] means produce exactly 5, even if template default is 3.
- Do NOT return a <style> block for named templates. Template CSS is applied separately; use existing template classes. Inline numeric styles are allowed only for chart geometry values.

Return ONLY the filled HTML, no explanations.`;
  fillPrompt = appendPromptOverride(settings, 'slideGen.templateUser', fillPrompt);

  try {
    let content;
    const templateSystemPrompt = applyPromptOverride(settings, 'slideGen.templateSystem', DEFAULT_SYSTEM_PROMPT);

    console.log('[fillTemplateWithAI] Calling model:', settings.model, 'template:', template.id);
    recordPromptPayload('slideGen.templateSystem', {
      model: settings.model,
      templateId: template.id,
      systemPrompt: templateSystemPrompt,
      userPrompt: fillPrompt,
    });
    content = await callWithModelFallback(settings, templateSystemPrompt, fillPrompt);

    // Extract single slide (AI may return both template example and filled - take the last one)
    content = extractSingleSlide(content) || '';
    if (template.css) {
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
    }

    // If slide wrapper is missing, wrap the content properly
    // Use regex to match class="slide" or class="slide ..." (with extra classes)
    const hasSlideClass = (s) => /class=["']slide[\s"']/i.test(s);
    if (!hasSlideClass(content)) {
      // Blank-master templates (section dividers etc.) use custom structure without title/subtitle/frame
      const isBlankMasterTemplate = template && (template.master === 'blank' || (template.html && template.html.includes('master-blank')));
      if (isBlankMasterTemplate) {
        // Preserve the original template's outer wrapper classes
        const outerClassMatch = template.html.match(/class="([^"]+)"/);
        const outerClass = outerClassMatch ? outerClassMatch[1] : 'slide master-blank';
        content = `<div class="${outerClass}">
  ${content}
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`;
      } else {
        // Check if content has frame content
        const hasFrame = content.includes('class="frame"') || content.includes("class='frame'");
        const hasTitle = content.includes('class="title"') || content.includes("class='title'");
        const hasFooter = content.includes('class="footer"') || content.includes("class='footer'");

        let wrappedContent = content;

        // If it's just the frame content, add title/subtitle/footer
        if (hasFrame && !hasTitle) {
          wrappedContent = `<h1 class="title">These findings drive strategic decision-making</h1>
  <h2 class="subtitle">Key Insights</h2>
  ${content}`;
        }

        // If no footer, add one
        if (!hasFooter) {
          wrappedContent += `
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>`;
        }

        // If no frame at all, wrap in frame
        if (!hasFrame) {
          wrappedContent = `<h1 class="title">These findings drive strategic decision-making</h1>
  <h2 class="subtitle">Key Insights</h2>
  <div class="frame">
    ${content}
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>`;
        }

        // Always wrap in slide div
        content = `<div class="slide">
  ${wrappedContent}
</div>`;
      }
    }

    // Final validation - this should now always pass
    if (!hasSlideClass(content)) {
      // Last resort: force wrap
      content = `<div class="slide">
  <h1 class="title">This content was generated based on template structure</h1>
  <h2 class="subtitle">Generated Content</h2>
  <div class="frame">
    ${content}
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`;
    }

    // Flatten any nested frames that AI might have created
    content = flattenNestedFrames(content);

    // Audit log for slide creator calls
    const creatorRole = agentMode ? 'slideCreator:agent' : 'slideCreator:chatbot';
    audit(creatorRole, `created: ${template.id || 'freestyle'}`, {
      model: settings.model,
      query: contentDescription.slice(0, 300),
      context: template.title || 'freestyle slide',
      maxTokens: settings.maxTokens || null,
      reasoningEffort: settings.reasoningEffort || null,
      temperature: settings.temperature ?? null,
      duration: Date.now() - startTime,
      inputLen: fillPrompt.length,
      outputLen: content?.length || 0,
      status: 'ok',
    });

    return content;
  } catch (error) {
    // Audit log for failures
    const creatorRole = agentMode ? 'slideCreator:agent' : 'slideCreator:chatbot';
    audit(creatorRole, 'slide creation failed', {
      model: settings.model,
      query: contentDescription.slice(0, 300),
      duration: Date.now() - startTime,
      status: 'error',
      error: error.message,
    });

    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * BULK slide generation - generates multiple slides in ONE API call
 * @param {Array} slideSpecs - Array of { template, instruction, contextSlideIndices, contextSlides }
 * @param {Object} settings - API settings
 * @param {Object} options - { agentMode: boolean } - affects role settings and audit log
 * @returns {Promise<Array>} Array of generated HTML strings
 */
export async function fillTemplatesBulkWithAI(slideSpecs, settings, options = {}) {
  const { agentMode = true } = options; // Bulk is typically agent mode
  const startTime = Date.now();

  // Save the default model before role overrides — used as fallback if role model fails
  const defaultModel = settings.model;

  // Apply slideCreator role overrides based on mode
  // Fall back to legacy 'slideCreator' key for backward compatibility
  const roleKey = agentMode ? 'slideCreatorAgent' : 'slideCreatorChatbot';
  const scRole = settings.roleSettings?.[roleKey]
    || settings.roleSettings?.slideCreator
    || {};
  if (scRole.model) settings = { ...settings, model: scRole.model };
  if (scRole.maxTokens) settings = { ...settings, maxTokens: scRole.maxTokens };
  if (scRole.reasoningEffort) settings = { ...settings, reasoningEffort: scRole.reasoningEffort };
  if (scRole.temperature !== '' && scRole.temperature !== undefined) settings = { ...settings, temperature: scRole.temperature };
  settings = { ...settings, _defaultModel: defaultModel };

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  if (!slideSpecs || slideSpecs.length === 0) {
    return [];
  }

  // OPTIMIZE: Deduplicate context slides - collect all unique ones
  const uniqueContextMap = new Map(); // pageIndex -> { title, html }
  slideSpecs.forEach(spec => {
    if (spec.contextSlides && spec.contextSlideIndices) {
      spec.contextSlideIndices.forEach((idx, i) => {
        if (!uniqueContextMap.has(idx) && spec.contextSlides[i]) {
          uniqueContextMap.set(idx, spec.contextSlides[i]);
        }
      });
    }
  });

  // Build shared reference content section (only once for all slides)
  let sharedContextSection = '';
  if (uniqueContextMap.size > 0) {
    const contextEntries = [...uniqueContextMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, slide]) => `[PAGE ${idx + 1}] "${slide.title || 'Untitled'}":\n${slide.html}`)
      .join('\n\n---\n\n');

    sharedContextSection = `
=== REFERENCE CONTENT (use as source material) ===
${contextEntries}
=== END REFERENCE CONTENT ===

`;
  }

  // Build the bulk prompt with all slides (reference pages by number, not HTML)
  const slidesSection = slideSpecs.map((spec, i) => {
    const template = spec.template;
    const instruction = spec.instruction || 'Fill with appropriate professional content';
    // Only reference pages that actually have content in uniqueContextMap
    const validContextIndices = (spec.contextSlideIndices || []).filter(idx => uniqueContextMap.has(idx));
    const contextRefs = validContextIndices.length > 0
      ? `USE CONTENT FROM: Page ${validContextIndices.map(idx => idx + 1).join(', Page ')}`
      : '';

    // Include content if present (factual mode)
    const contentSection = spec.content
      ? `SOURCE CONTENT (use this data, do NOT invent):\n${spec.content}\n`
      : '';

    return `
=== SLIDE ${i + 1} ===
TEMPLATE: ${template.title}
DESCRIPTION: ${template.description || 'Professional consulting slide'}
${contextRefs ? `${contextRefs}\n` : ''}${contentSection}INSTRUCTION: ${instruction}

TEMPLATE HTML:
${template.html}
=== END SLIDE ${i + 1} ===`;
  }).join('\n\n');

  let bulkPrompt = `You are generating MULTIPLE Strategy& consulting slides in ONE response.
TODAY: ${currentDateString()}

${TITLE_HEADER_RULES}
${sharedContextSection}
SLIDES TO GENERATE (${slideSpecs.length} total):
${slidesSection}

RESPECT EACH TEMPLATE - CRITICAL:
- STRICTLY REPLICATE each template's HTML structure and CSS classes - do not improvise
- ITEM COUNT: strongly prefer template default — only adjust for distinct/named items that can't be consolidated
- NEVER add structural elements not in the template (panels, columns, sections, icons) unless user explicitly requests
- DO NOT add inline styles, change colors, or add visual elements (shapes, borders, backgrounds) not in template
- If content is TOO MUCH: prioritize key items within the template structure
- If content is TOO LITTLE: In factual mode use only what's provided; in creative mode generate to fill
- For unstructured text with no specific phrasing: extract key points, organize to fit template count, slight rewording OK
- Keep slides CLEAN and PROFESSIONAL - consistency over creativity

CONTENT FIDELITY — PRESERVE THE USER'S CONTENT (HIGHEST PRIORITY):
Determine the content mode for EACH slide:
A) TOPIC/CREATIVE — instruction is a short topic or rough prompt → generate professional content.
B) PRECISE — instruction contains specific sentences, data, phrasing, questions → use their exact words. Do NOT reword.

For PRECISE content:
- NEVER change the meaning, tone, or form of the user's content to fit the template.
- If content contains QUESTIONS, keep them as questions — do NOT rephrase as statements or labels.
- If content contains SPECIFIC PHRASING, preserve it verbatim. Do not paraphrase, shorten, or "professionalize".
- Reproduce specific data, numbers, and names EXACTLY as provided.
- You may restructure for the template slots (split across title + body) but the WORDS must stay the same.
- ADAPT THE TEMPLATE TO THE CONTENT, not the content to the template. Content is the deliverable.
- Only trim if content physically overflows — cut the least important parts, don't reword what remains.

CRITICAL INSTRUCTIONS:
1. Generate ALL ${slideSpecs.length} slides in your response - ALWAYS produce HTML
2. Separate each slide with: <!-- SLIDE_SEPARATOR -->
3. Keep the EXACT HTML structure and CSS classes from each template
4. Replace only text content to match each instruction
5. Keep professional consulting tone - data-driven, insight-focused
6. Standard slides MUST have the slide wrapper, title, subtitle, frame, and footer. EXCEPTION: blank-master slides (e.g., sectionDivider with class "master-blank") do NOT have title/subtitle/frame — reproduce their template HTML structure exactly
7. When a slide has "SOURCE CONTENT", use ONLY that data (factual mode)
8. When no source content provided, generate appropriate content (creative mode)
9. NEVER output JSON or error messages - ALWAYS output valid HTML

OUTPUT FORMAT (output ONLY raw HTML, no labels or markers):
<div class="slide ...">...</div>
<!-- SLIDE_SEPARATOR -->
<div class="slide ...">...</div>
<!-- SLIDE_SEPARATOR -->
<div class="slide ...">...</div>

Return ONLY the HTML slides separated by <!-- SLIDE_SEPARATOR -->, no explanations.`;
  bulkPrompt = appendPromptOverride(settings, 'slideGen.templateUser', bulkPrompt);

  try {
    let content;
    const templateSystemPrompt = applyPromptOverride(settings, 'slideGen.templateSystem', DEFAULT_SYSTEM_PROMPT);

    console.log('[fillTemplatesBulk] Calling model:', settings.model, 'slides:', slideSpecs.length);
    recordPromptPayload('slideGen.templateSystem', {
      model: settings.model,
      slideCount: slideSpecs.length,
      systemPrompt: templateSystemPrompt,
      userPrompt: bulkPrompt,
    });
    content = await callWithModelFallback(settings, templateSystemPrompt, bulkPrompt);

    // Split response by separator
    const slides = content.split(/<!--\s*SLIDE_SEPARATOR\s*-->/).map(s => s.trim()).filter(Boolean);

    console.log('[BulkGeneration] Generated', slides.length, 'slides from', slideSpecs.length, 'specs');

    // Process each slide (wrap if needed, flatten nested frames)
    const processedSlides = slides.map((slideHtml, i) => {
      let processed = extractSingleSlide(slideHtml);

      // Wrap if needed (regex handles class="slide" and class="slide ..." with extra classes)
      if (!/class=["']slide[\s"']/i.test(processed)) {
        const hasFrame = processed.includes('class="frame"') || processed.includes("class='frame'");
        const hasTitle = processed.includes('class="title"') || processed.includes("class='title'");
        const hasFooter = processed.includes('class="footer"') || processed.includes("class='footer'");

        // Extract any existing footer from content before wrapping in frame
        // to avoid footer ending up INSIDE frame (where overflow:hidden clips it)
        let contentBody = processed;
        let existingFooter = '';
        if (hasFooter) {
          const footerMatch = processed.match(/<footer\s+class=["']footer["'][^>]*>[\s\S]*?<\/footer>/i);
          if (footerMatch) {
            existingFooter = footerMatch[0];
            contentBody = processed.replace(footerMatch[0], '').trim();
          }
        }

        const footer = existingFooter || `<footer class="footer">
    <span>Strategy&</span>
    <span>${i + 1} / ${slides.length}</span>
  </footer>`;
        const title = hasTitle ? '' : `<h1 class="title">Key insights from analysis</h1>
  <h2 class="subtitle">Slide ${i + 1}</h2>
  `;

        let wrapped;
        if (hasFrame) {
          wrapped = `${title}${contentBody}
  ${footer}`;
        } else {
          wrapped = `${title}<div class="frame">${contentBody}</div>
  ${footer}`;
        }
        processed = `<div class="slide">\n  ${wrapped}\n</div>`;
      }

      return flattenNestedFrames(processed);
    });

    // If we got fewer slides than requested, log warning
    if (processedSlides.length < slideSpecs.length) {
      console.warn('[BulkGeneration] Got fewer slides than requested:', processedSlides.length, 'vs', slideSpecs.length);
    }

    // Audit log for bulk slide creator calls
    const creatorRole = agentMode ? 'slideCreator:agent' : 'slideCreator:chatbot';
    audit(creatorRole, `bulk created: ${processedSlides.length} slides`, {
      model: settings.model,
      query: `${slideSpecs.length} slide specs`,
      context: slideSpecs.map(s => s.template?.id || 'freestyle').join(', '),
      maxTokens: settings.maxTokens || null,
      reasoningEffort: settings.reasoningEffort || null,
      temperature: settings.temperature ?? null,
      duration: Date.now() - startTime,
      inputLen: bulkPrompt.length,
      outputLen: content?.length || 0,
      status: 'ok',
    });

    return processedSlides;
  } catch (error) {
    // Audit log for failures
    const creatorRole = agentMode ? 'slideCreator:agent' : 'slideCreator:chatbot';
    audit(creatorRole, 'bulk creation failed', {
      model: settings.model,
      query: `${slideSpecs.length} slide specs`,
      duration: Date.now() - startTime,
      status: 'error',
      error: error.message,
    });

    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}
