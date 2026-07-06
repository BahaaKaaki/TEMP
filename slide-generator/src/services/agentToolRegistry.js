/**
 * Agent Tool Registry
 *
 * Defines all tools available to the agentic system.
 * Each tool has:
 * - name: Unique identifier
 * - description: What the tool does AND when to use it (for AI reasoning)
 * - activeForm: Present continuous form for UI display
 * - cost: Budget credits consumed (0 = free, used by generic agent)
 * - parameters: JSON schema of inputs
 * - execute: Async function to run the tool
 *
 * Adding a new tool requires ZERO changes to the core agent loop.
 * Just add an entry here with a good description.
 *
 * NOTE: Tools use configured AI models + optional web search (when searchEnabled).
 * Web search uses the same /responses API endpoint configured in Settings.
 */

import { generateSlides, improveSlide, generateStoryline, agentChat, fillTemplateWithAI, fillTemplatesBulkWithAI, aiRouteRequest, extractTitleFromHTML, researchWithSearch, reEvaluateTemplateForData, generateImageSlide, extractImageDataUri, detectSlideLayout } from './aiService';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { getClientProfileFooterBranding } from '../utils/clientDesignProfiles';
import { ragRetrieve, formatRAGContext } from './knowledgeBaseRAG';

/**
 * Search with built-in model search first, fallback to dedicated endpoint.
 * Gemini uses googleSearch grounding, GPT uses web_search_preview — both
 * just need the tool added to the same API call. No separate endpoint needed.
 */
async function _searchWithFallback(query, settings) {
  // Built-in model search: Gemini uses googleSearch grounding, GPT uses web_search_preview.
  // Both just need the tool added to the same API call — no separate endpoint.
  const searchTool = { type: 'web_search_preview', search_context_size: settings.searchContextSize || 'medium' };
  const result = await agentChat(
    `Search the web for: ${query}\n\nReturn detailed factual findings with data points and statistics.${settings.searchIncludeSources ? ' List source URLs at the end under "Sources:".' : ' Do NOT include any URLs or links.'}`,
    { ...settings, _extraTools: [searchTool], searchEnabled: false },
    { returnJSON: false, temperature: 0.3, maxTokens: settings.searchMaxTokens || 16384, timeout: 120000 }
  );
  if (result && typeof result === 'string' && result.trim().length > 50) return result.trim();
  return null;
}

/**
 * Tool definition structure
 * @typedef {Object} ToolDefinition
 * @property {string} name - Tool identifier
 * @property {string} description - Human-readable description
 * @property {string} activeForm - Present continuous form for UI
 * @property {Object} parameters - JSON schema for parameters
 * @property {Function} execute - Async function to run the tool
 */

/**
 * Create the tool registry with all available tools
 * @param {Object} context - Context object with state, actions, services, etc.
 */
// Current date string for prompt injection
function todayString() {
  const now = new Date();
  const d = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${d}, ${t}`;
}

export function createToolRegistry(context) {
  const {
    state,
    actions,
    settings,
    knowledgeBase,
    addMessage,
    recordAiIO,
    onProgress,
    activeFlow,
  } = context;

  // Mutable ref for batch slide progress — the agent sets this before executing create_slides_batch
  // so the tool can update individual numbered steps in the UI
  const _batchProgress = { fn: null };

  const registry = {
    // Mutable ref for agent to inject batch progress callback
    _batchProgress,

    // ==========================================
    // KNOWLEDGE & RESEARCH TOOLS (Local only)
    // ==========================================

    search_knowledge_base: {
      name: 'search_knowledge_base',
      description: 'Search the local knowledge base for relevant information including uploaded documents, CVs, case studies, and company info. Use when: the task mentions specific people, projects, qualifications, or company data that might exist in uploaded documents. Free — costs no budget.',
      activeForm: 'Searching knowledge base',
      cost: 0,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          category: {
            type: 'string',
            description: 'Optional category filter (qualifications, cvs, products, company, case_studies, documents)',
          },
        },
        required: ['query'],
      },
      execute: async ({ query, category }) => {
        onProgress?.({ phase: 'searching', message: 'Searching knowledge base...' });

        const entries = knowledgeBase?.entries || {};

        // Use RAG retrieval with TF-IDF scoring
        const ragResults = ragRetrieve(query, entries, {
          topK: 10,
          categories: category ? [category] : undefined,
          minScore: 1,
        });

        // Format results for the agent — include full content
        const formattedResults = ragResults.map(r => ({
          category: r.categoryId,
          score: Math.round(r.score * 10) / 10,
          ...r.entry,
        }));

        // Also provide a formatted context block the agent can use directly
        const contextBlock = formatRAGContext(ragResults, { includeAllFields: true });

        recordAiIO?.({
          tool: 'search_knowledge_base',
          input: { query, category },
          output: { resultsCount: ragResults.length },
        });

        return {
          success: true,
          query,
          category,
          results: formattedResults,
          totalMatches: ragResults.length,
          formattedContext: contextBlock,
        };
      },
    },

    research_topic: {
      name: 'research_topic',
      description: 'Use AI to research and gather information about a topic. Generates insights, key points, statistics, and recommendations. Use when: you need substantive data or analysis to build slide content — market data, trends, best practices, comparisons. Be specific in the topic for better results.',
      activeForm: 'Researching topic',
      cost: 3,
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The topic to research',
          },
          focus: {
            type: 'string',
            description: 'What aspect to focus on — use any relevant lens (e.g., overview, statistics, trends, risks, opportunities, competitive landscape, etc.)',
          },
          depth: {
            type: 'string',
            description: 'How deep to go: "brief", "moderate", "comprehensive"',
          },
        },
        required: ['topic'],
      },
      execute: async ({ topic, focus = 'overview', depth = 'moderate' }) => {
        onProgress?.({ phase: 'researching', message: `Researching: ${topic}` });

        try {
          const depthInstructions = {
            brief: '3-5 bullet points, under 200 words total.',
            moderate: '5-8 bullet points with supporting data, under 400 words total.',
            comprehensive: '8-12 bullet points with detailed data, under 600 words total.',
          };

          const wantSources = settings.searchIncludeSources;
          const researchPrompt = `Research this topic and return structured findings. No filler.
TODAY: ${todayString()}

TOPIC: ${topic}
FOCUS: ${focus}
LENGTH: ${depthInstructions[depth] || depthInstructions.moderate}

IMPORTANT: You have web search capabilities. USE THEM. Search for real, current data.
Produce REAL DATA. Every number must be real. No placeholders.
Do NOT describe methodology — actually find and present the data.
${wantSources ? 'Collect all source URLs and list them in a "sources" array — deduplicated, at the end.' : 'Do NOT include any URLs or links in your response.'}

Return JSON. Each bullet should be a fact or insight:
{
  "summary": "One-sentence executive summary with a key number",
  "keyPoints": ["key point 1 with specific data", "key point 2 with specific data", ...],
  "data": ["specific stat or fact"] (if applicable),
  "analysis": ["analytical insight backed by data"] (if applicable)${wantSources ? ',\n  "sources": ["https://source1.com", "..."]' : ''}
}
No filler. Just facts and insights.`;

          // One-call: search endpoint does web search + analysis together
          let result = await researchWithSearch(researchPrompt, settings);
          if (result) {
            // Parse JSON from search endpoint's text response
            try {
              const jsonMatch = result.match(/\{[\s\S]*\}/);
              if (jsonMatch) result = JSON.parse(jsonMatch[0]);
            } catch (_) { /* keep as text if not JSON */ }
          } else {
            // Fallback to standard LLM if no search endpoint configured
            result = await agentChat(
              researchPrompt,
              settings,
              { returnJSON: true, temperature: 0.7 }
            );
          }

          recordAiIO?.({
            tool: 'research_topic',
            input: { topic, focus, depth },
            output: { hasResult: !!result },
          });

          return {
            success: true,
            topic,
            research: result,
          };
        } catch (error) {
          return {
            success: false,
            topic,
            error: error.message,
          };
        }
      },
    },

    generate_benchmarks: {
      name: 'generate_benchmarks',
      description: 'Generate benchmark data and comparisons for a given topic using AI knowledge. Use when: you need comparative data, competitive analysis, or side-by-side metrics for a comparison slide.',
      activeForm: 'Generating benchmarks',
      cost: 2,
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The topic to benchmark (e.g., "cloud adoption rates", "AI maturity")',
          },
          compareWith: {
            type: 'array',
            description: 'Items to compare (e.g., ["AWS", "Azure", "GCP"])',
            items: { type: 'string' },
          },
          metrics: {
            type: 'array',
            description: 'Metrics to include (e.g., ["market share", "growth rate"])',
            items: { type: 'string' },
          },
        },
        required: ['topic'],
      },
      execute: async ({ topic, compareWith, metrics }) => {
        onProgress?.({ phase: 'generating', message: `Generating benchmarks for: ${topic}` });

        try {
          const benchmarkPrompt = `Generate benchmark/comparison data for a presentation:
TODAY: ${todayString()}

TOPIC: ${topic}
${compareWith?.length ? `COMPARE: ${compareWith.join(', ')}` : ''}
${metrics?.length ? `METRICS: ${metrics.join(', ')}` : ''}

IMPORTANT: You have web search capabilities. USE THEM. Search for real, current data.
Use REAL data from reports, filings, or credible sources.
Do NOT estimate — use the real numbers. Note the source for each data point.

Return JSON:
{
  "title": "Benchmark title",
  "description": "Brief context",
  "data": [
    { "name": "Item 1", "metrics": { "metric1": "value1", "metric2": "value2" } },
    ...
  ],
  "insights": ["Key observation 1 with specific data", "Key observation 2 with specific data"],
  "source": "Specific data source (report name, date)"
}`;

          // One-call: search endpoint does web search + analysis together
          let result = await researchWithSearch(benchmarkPrompt, settings);
          if (result) {
            // Parse JSON from search endpoint's text response
            try {
              const jsonMatch = result.match(/\{[\s\S]*\}/);
              if (jsonMatch) result = JSON.parse(jsonMatch[0]);
            } catch (_) { /* keep as text if not JSON */ }
          } else {
            // Fallback to standard LLM if no search endpoint configured
            result = await agentChat(
              benchmarkPrompt,
              settings,
              { returnJSON: true, temperature: 0.7 }
            );
          }

          recordAiIO?.({
            tool: 'generate_benchmarks',
            input: { topic, compareWith, metrics },
            output: { hasData: !!result?.data },
          });

          return {
            success: true,
            topic,
            benchmarks: result,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    },

    // ==========================================
    // SLIDE CREATION TOOLS
    // ==========================================

    create_slide: {
      name: 'create_slide',
      description: 'Create a single new slide. Provide a detailed instruction describing the content — template selection is automatic. Use when: creating exactly one slide. For multiple slides, prefer create_slides_batch (more efficient). Include all relevant data points in the instruction.',
      activeForm: 'Creating slide',
      cost: 2,
      parameters: {
        type: 'object',
        properties: {
          instruction: {
            type: 'string',
            description: 'Detailed instruction for what the slide should contain',
          },
          position: {
            type: 'string',
            description: 'Where to insert: "start", "end", or number for specific position',
          },
          contextSlides: {
            type: 'array',
            description: 'Array of slide indices (0-based) to include as context. Max 5.',
            items: { type: 'number' },
          },
          content: {
            type: 'object',
            description: 'Research/content data from previous step (passed via usesOutput)',
          },
          sectionLabel: {
            type: 'string',
            description: 'Section navigation label (e.g., "1. Introduction") — appears in section tracker',
          },
          subSectionLabel: {
            type: 'string',
            description: 'Sub-section label within a section',
          },
          layoutGuidance: {
            type: 'string',
            description: 'Visual/layout guidance for the slide (e.g., "2x2 matrix", "horizontal bar chart", "process flow with 4 steps"). Passed to image model for image slides and to freestyle generator. Ignored when a structured template is matched.',
          },
        },
        required: ['instruction'],
      },
      execute: async ({ instruction, position = 'end', contextSlides, content, sectionLabel, subSectionLabel, layoutGuidance }) => {
        if (!instruction || instruction.trim() === '') {
          return { success: false, error: 'Instruction is required to create a slide' };
        }

        // Append research data to instruction if provided
        let fullInstruction = instruction;
        if (content) {
          let researchContext = '';
          if (content.summary) {
            researchContext += `Summary: ${content.summary}\n`;
          }
          if (content.keyPoints?.length > 0) {
            researchContext += `Key Points:\n${content.keyPoints.map(p => `  • ${p}`).join('\n')}\n`;
          }
          if (content.statistics?.length > 0) {
            researchContext += `Statistics:\n${content.statistics.map(s => `  • ${s}`).join('\n')}\n`;
          }
          if (content.insights?.length > 0) {
            researchContext += `Insights:\n${content.insights.map(i => `  • ${i}`).join('\n')}\n`;
          }
          if (content.recommendations?.length > 0) {
            researchContext += `Recommendations:\n${content.recommendations.map(r => `  • ${r}`).join('\n')}\n`;
          }
          if (!researchContext) {
            researchContext = JSON.stringify(content).slice(0, 1000);
          }
          fullInstruction = `${instruction}\n\n[RESEARCH DATA - use these facts and figures:]\n${researchContext}`;
        }

        // Keep the enriched instruction (with research data but without vibe) separate.
        // This is the original structured content that should be passed as-is to sub-agents.
        const enrichedInstruction = fullInstruction;

        onProgress?.({ phase: 'routing', message: `Planning slide: ${instruction.slice(0, 50)}...` });

        try {
          // Build context for the router — include template field (same as regular chatbot)
          const slideSummaries = state.slides.map((s, i) => ({
            index: i,
            title: s.title || 'Untitled',
            template: s.templateId || s.layoutType || s.type || 'custom',
            pendingComments: [],
          }));

          // Build storyline summary (same as regular chatbot)
          const storylineSummary = (state.storyline || [])
            .map(s => s.title)
            .join(' → ');

          // Build referenced slides info if contextSlides provided
          let referencedSlides = null;
          if (contextSlides && Array.isArray(contextSlides) && contextSlides.length > 0) {
            const validIndices = contextSlides.slice(0, 5).filter(idx => idx >= 0 && idx < state.slides.length);
            referencedSlides = validIndices.map(idx => ({
              index: idx,
              title: state.slides[idx]?.title || 'Untitled',
              slide: state.slides[idx],
            }));
          }

          // Try the AI router for template selection; fall back to direct generation if router fails
          let routeResult = null;
          try {
            routeResult = await aiRouteRequest(fullInstruction, {
              slideCount: state.slides.length,
              currentSlideIndex: state.slides.length - 1,
              slideSummaries,
              storylineSummary,
              activeFlow: activeFlow || undefined,
              referencedSlides,
              agentMode: true,
              preferImageSlides: !!settings.imageModel && !!settings.preferImageSlides,
            }, settings);
          } catch (routerErr) {
            console.warn('[create_slide] Router failed, falling back to direct generation:', routerErr.message);
          }

          let newSlide;
          let templateId = null;

          // Agent mode: strip any cover/thankYou/sectionDivider steps the router may have auto-added
          if (routeResult?.plan?.length > 0) {
            routeResult.plan = routeResult.plan.filter(s =>
              s.templateId !== 'cover' && s.templateId !== 'thankYou' && s.templateId !== 'sectionDivider'
            );
          }

          if (routeResult?.plan?.length > 0) {
            // Execute the first step from the router's plan.
            // Use original enriched instruction (not the router's possibly-condensed version).
            // The router is only consulted for template selection and metadata.
            const step = routeResult.plan[0];
            templateId = step.templateId;
            const stepInstruction = enrichedInstruction;
            const stepSources = Array.isArray(step.sources) ? step.sources : [];

            // If step needs search, inject search tool into settings — one call that searches + generates
            let stepSettings = settings;
            if (step.searchQuery) {
              stepSettings = {
                ...settings,
                _extraTools: [{
                  type: 'web_search_preview',
                  search_context_size: settings.searchContextSize || 'medium',
                }],
              };
            }

            onProgress?.({ phase: 'generating', message: `Creating slide${templateId ? ` (${templateId})` : ''}${step.searchQuery ? ' + searching' : ''}...` });

            let generationInstruction = stepInstruction;

            // Add search hint to prompt so model knows what to look up
            if (step.searchQuery) {
              generationInstruction = `${generationInstruction}\n\n[SEARCH THE WEB for: "${step.searchQuery}" — use real data, numbers, and facts from your search results. Be executive, not wordy.]`;
            }
            const contextIndices = step.contextSlides || (contextSlides ? contextSlides.slice(0, 5) : []);
            if (contextIndices.length > 0) {
              const validIndices = contextIndices.filter(idx => idx >= 0 && idx < state.slides.length);
              if (validIndices.length > 0) {
                const contextSlidesHtml = validIndices
                  .map(idx => {
                    const slide = state.slides[idx];
                    return `[Page ${idx + 1}] "${slide.title}" (${slide.type || 'custom'}):\n${slide.html}`;
                  })
                  .join('\n\n---\n\n');
                generationInstruction = `${generationInstruction}\n\n[CONTEXT FROM EXISTING SLIDES:]\n${contextSlidesHtml}`;
              }
            }

            // Re-evaluate template choice against actual data shape (catches router mismatches)
            const validatedTemplateId = reEvaluateTemplateForData(templateId, generationInstruction);
            if (validatedTemplateId !== templateId) {
              console.log(`[create_slide] Template re-evaluated: ${templateId} → ${validatedTemplateId}`);
              templateId = validatedTemplateId;
            }

            // Handle image slide templates
            if ((templateId === 'image-full' || templateId === 'image-content') && settings.imageModel) {
              try {
                const imageMode = templateId === 'image-full' ? 'full' : 'content';
                // Prefer user-provided layoutGuidance over router's version
                const effectiveLayoutGuidance = layoutGuidance || step?.layoutGuidance || null;
                const imageResult = await generateImageSlide(generationInstruction, settings, imageMode, {
                  layoutGuidance: effectiveLayoutGuidance,
                  vibe: state.imageVibe,
                  footerBranding: getClientProfileFooterBranding(settings, 'Strategy&'),
                  slideNumber: state.slides.length + 1,
                });
                if (imageResult?.html) {
                  newSlide = {
                    ...imageResult,
                    ...(stepSources.length > 0 ? { sources: stepSources } : {}),
                    ...(sectionLabel ? { sectionLabel } : {}),
                    ...(subSectionLabel ? { subSectionLabel } : {}),
                  };
                }
              } catch (imgErr) {
                console.warn('[create_slide] Image generation failed, falling back to freestyle:', imgErr.message);
                // newSlide remains null → falls through to freestyle
              }
            }

            // Use template if router selected one (same as regular chatbot)
            if (!newSlide && templateId && templateId !== 'freestyle' && templateId !== 'image-full' && templateId !== 'image-content') {
              const template = SLIDE_TEMPLATES?.[templateId];

              if (template) {
                try {
                  const filledHtml = await fillTemplateWithAI(template, generationInstruction, stepSettings, [], { agentMode: true });
                  if (filledHtml) {
                    const extractedTitle = extractTitleFromHTML(filledHtml);
                    newSlide = {
                      id: `slide-${Date.now()}`,
                      title: extractedTitle || template.title || 'Untitled',
                      html: filledHtml,
                      type: templateId,
                      templateId: templateId,
                      ...(stepSources.length > 0 ? { sources: stepSources } : {}),
                      ...(sectionLabel ? { sectionLabel } : {}),
                      ...(subSectionLabel ? { subSectionLabel } : {}),
                    };
                  }
                } catch (templateErr) {
                  console.warn('[create_slide] Template fill failed, falling back to freestyle:', templateErr.message);
                }
              }
            }

            // Fall back to freestyle if no template or template failed
            if (!newSlide) {
              // Embed user-provided visual guidance for freestyle generation
              let freestyleInstruction = generationInstruction;
              const effectiveLayoutGuidance = layoutGuidance || step?.layoutGuidance;
              if (effectiveLayoutGuidance) {
                freestyleInstruction = `${freestyleInstruction}\n\n[VISUAL LAYOUT: ${effectiveLayoutGuidance}]`;
              }
              const result = await generateSlides(freestyleInstruction, settings, 1, state.slides);
              if (result?.length > 0) {
                newSlide = {
                  ...result[0],
                  ...(stepSources.length > 0 ? { sources: stepSources } : {}),
                  ...(sectionLabel ? { sectionLabel } : {}),
                  ...(subSectionLabel ? { subSectionLabel } : {}),

                };
              }
            }
          } else {
            // Router returned no plan or was unavailable — direct generation with vibe
            onProgress?.({ phase: 'generating', message: `Creating slide (freestyle)...` });
            const result = await generateSlides(fullInstruction, settings, 1, state.slides);
            if (result?.length > 0) {
              newSlide = {
                ...result[0],
                ...(sectionLabel ? { sectionLabel } : {}),
                ...(subSectionLabel ? { subSectionLabel } : {}),
              };
            }
          }

          // Validate the slide
          if (!newSlide || !newSlide.html) {
            return { success: false, error: 'Generated slide has no content' };
          }

          // Add the slide at the specified position
          if (position === 'start') {
            actions.insertSlideAt(0, newSlide);
          } else if (position === 'end') {
            actions.addSlide(newSlide);
          } else if (typeof position === 'number') {
            actions.insertSlideAt(position, newSlide);
          } else {
            actions.addSlide(newSlide);
          }

          recordAiIO?.({
            tool: 'create_slide',
            input: { instruction: instruction.slice(0, 100), routerTemplateId: templateId, position },
            output: { slideId: newSlide.id, title: newSlide.title },
          });

          return {
            success: true,
            slideId: newSlide.id,
            slideIndex: state.slides.length,
            title: newSlide.title,
            templateId: templateId || 'freestyle',
            message: `Created slide: ${newSlide.title || instruction.slice(0, 50)}`,
          };
        } catch (error) {
          console.error('[create_slide] Error:', error);
          return {
            success: false,
            error: error.message || 'Unknown error creating slide',
          };
        }
      },
    },

    create_slides_batch: {
      name: 'create_slides_batch',
      description: 'Create multiple slides at once — far more efficient than calling create_slide repeatedly. Each slide spec has instruction (required) and optional contextSlides and sectionLabel. Template selection is AUTOMATIC via the router — do NOT specify templateId. Put ALL relevant content into each instruction — each slide only sees its own instruction.',
      activeForm: 'Creating multiple slides',
      cost: 3,
      parameters: {
        type: 'object',
        properties: {
          slides: {
            type: 'array',
            description: 'Array of slide specifications',
            items: {
              type: 'object',
              properties: {
                instruction: { type: 'string', description: 'Detailed instruction for this slide — include all data, key message, and content type' },
                contextSlides: { type: 'array', description: 'Slide indices (0-based) for context', items: { type: 'number' } },
                sectionLabel: { type: 'string', description: 'Section tracker label (e.g., "1. Introduction")' },
                subSectionLabel: { type: 'string', description: 'Sub-section label' },
                layoutGuidance: { type: 'string', description: 'Visual/layout guidance (e.g., "2x2 matrix", "waterfall chart"). Passed to image/freestyle slides. Ignored when a structured template is matched.' },
              },
            },
          },
          content: {
            type: 'object',
            description: 'Optional shared content/research to use for all slides',
          },
        },
        required: ['slides'],
      },
      execute: async ({ slides, content }) => {
        if (!slides || !Array.isArray(slides) || slides.length === 0) {
          return { success: false, error: 'Slides array is required and must not be empty' };
        }

        onProgress?.({ phase: 'generating', message: `Creating ${slides.length} slides...` });

        // Build shared context for the router
        const slideSummaries = state.slides.map((s, idx) => ({
          index: idx,
          title: s.title || 'Untitled',
          template: s.templateId || s.layoutType || s.type || 'custom',
          pendingComments: [],
        }));
        const storylineSummary = (state.storyline || []).map(s => s.title).join(' → ');

        const results = [];
        // Track layouts used within this batch for diversity
        const batchUsedLayouts = [];
        for (let i = 0; i < slides.length; i++) {
          const spec = slides[i];

          if (!spec.instruction || spec.instruction.trim() === '') {
            results.push({ success: false, index: i, error: 'Missing instruction' });
            continue;
          }

          onProgress?.({
            phase: 'generating',
            message: `Creating slide ${i + 1}/${slides.length}: ${spec.instruction.slice(0, 40)}...`,
            current: i + 1,
            total: slides.length,
          });

          // Update individual numbered slide steps in the agent's UI widget
          _batchProgress.fn?.(i, slides.length, 'active');

          try {
            // Build instruction with research data and context
            let fullInstruction = spec.instruction;

            // Add context from referenced slides (up to 5)
            if (spec.contextSlides && Array.isArray(spec.contextSlides) && spec.contextSlides.length > 0) {
              const validIndices = spec.contextSlides.slice(0, 5).filter(idx => idx >= 0 && idx < state.slides.length);
              if (validIndices.length > 0) {
                const contextSlidesHtml = validIndices
                  .map(idx => {
                    const slide = state.slides[idx];
                    return `[Page ${idx + 1}] "${slide.title}" (${slide.type || 'custom'}):\n${slide.html}`;
                  })
                  .join('\n\n---\n\n');
                fullInstruction = `${fullInstruction}\n\n[CONTEXT FROM EXISTING SLIDES:]\n${contextSlidesHtml}`;
              }
            }

            // Add shared content/research if provided
            if (content) {
              let researchContext = '';
              if (content.summary) researchContext += `Summary: ${content.summary}\n`;
              if (content.keyPoints?.length > 0) researchContext += `Key Points:\n${content.keyPoints.map(p => `  • ${p}`).join('\n')}\n`;
              if (content.statistics?.length > 0) researchContext += `Statistics:\n${content.statistics.map(s => `  • ${s}`).join('\n')}\n`;
              if (content.insights?.length > 0) researchContext += `Insights:\n${content.insights.map(ii => `  • ${ii}`).join('\n')}\n`;
              if (content.recommendations?.length > 0) researchContext += `Recommendations:\n${content.recommendations.map(r => `  • ${r}`).join('\n')}\n`;
              if (!researchContext) researchContext = JSON.stringify(content).slice(0, 1000);
              fullInstruction = `${fullInstruction}\n\n[RESEARCH DATA:]\n${researchContext}`;
            }

            // Keep the enriched instruction (with research/context but without vibe) separate.
            // This is the original structured content that should be passed as-is to sub-agents.
            // The router only uses the full prompt (with vibe) for template selection.
            const enrichedInstruction = fullInstruction;

            // Try the AI router for template selection; fall back to direct generation if router fails
            let routeResult = null;
            try {
              routeResult = await aiRouteRequest(fullInstruction, {
                slideCount: state.slides.length + i,
                currentSlideIndex: state.slides.length + i - 1,
                slideSummaries,
                storylineSummary,
                activeFlow: activeFlow || undefined,
                agentMode: true,
                preferImageSlides: !!settings.imageModel && !!settings.preferImageSlides,
              }, settings);
            } catch (routerErr) {
              console.warn(`[create_slides_batch] Router failed for slide ${i + 1}, falling back:`, routerErr.message);
            }

            let newSlide = null;

            // Agent mode: strip any cover/thankYou/sectionDivider steps the router may have auto-added
            if (routeResult?.plan?.length > 0) {
              routeResult.plan = routeResult.plan.filter(s =>
                s.templateId !== 'cover' && s.templateId !== 'thankYou' && s.templateId !== 'sectionDivider'
              );
            }

            if (routeResult?.plan?.length > 0) {
              const step = routeResult.plan[0];
              let templateId = step.templateId;
              const stepSources = Array.isArray(step.sources) ? step.sources : [];
              // Always use the original enriched instruction (not the router's possibly-condensed version).
              // The router is only consulted for template selection, search queries, and layout guidance.
              const stepInstruction = enrichedInstruction;

              // If step needs search, inject search tool — one call that searches + generates
              let stepSettings = settings;
              if (step.searchQuery) {
                stepSettings = {
                  ...settings,
                  _extraTools: [{
                    type: 'web_search_preview',
                    search_context_size: settings.searchContextSize || 'medium',
                  }],
                };
              }

              let genInstruction = stepInstruction;
              if (step.searchQuery) {
                genInstruction = `${genInstruction}\n\n[SEARCH THE WEB for: "${step.searchQuery}" — use real data, numbers, and facts from your search results. Be executive, not wordy.]`;
              }

              // Re-evaluate template choice against actual data shape (catches router mismatches)
              const validatedBatchTemplateId = reEvaluateTemplateForData(templateId, genInstruction);
              if (validatedBatchTemplateId !== templateId) {
                console.log(`[create_slides_batch] Slide ${i + 1}: template re-evaluated: ${templateId} → ${validatedBatchTemplateId}`);
                templateId = validatedBatchTemplateId;
              }

              // Handle image slide templates
              if ((templateId === 'image-full' || templateId === 'image-content') && settings.imageModel) {
                try {
                  const imageMode = templateId === 'image-full' ? 'full' : 'content';
                  // Prefer user-provided layoutGuidance over router's version
                  const effectiveLayoutGuidance = spec.layoutGuidance || step?.layoutGuidance || null;
                  const imageResult = await generateImageSlide(genInstruction, settings, imageMode, {
                    layoutGuidance: effectiveLayoutGuidance,
                    vibe: state.imageVibe,
                    footerBranding: getClientProfileFooterBranding(settings, 'Strategy&'),
                    slideNumber: state.slides.length + i + 1,
                  });
                  if (imageResult?.html) {
                    newSlide = {
                      ...imageResult,
                      id: `slide-${Date.now()}-${i}`,
                      ...(stepSources.length > 0 ? { sources: stepSources } : {}),
                      ...(spec.sectionLabel ? { sectionLabel: spec.sectionLabel } : {}),
                      ...(spec.subSectionLabel ? { subSectionLabel: spec.subSectionLabel } : {}),
                    };
                  }
                } catch (imgErr) {
                  console.warn(`[create_slides_batch] Image gen failed for slide ${i + 1}, falling back:`, imgErr.message);
                  // newSlide remains null → falls through to freestyle
                }
              }

              // Use template if router selected one
              if (!newSlide && templateId && templateId !== 'freestyle' && templateId !== 'image-full' && templateId !== 'image-content') {
                const template = SLIDE_TEMPLATES?.[templateId];
                if (template) {
                  try {
                    const filledHtml = await fillTemplateWithAI(template, genInstruction, stepSettings, [], { agentMode: true });
                    if (filledHtml) {
                      const extractedTitle = extractTitleFromHTML(filledHtml);
                      newSlide = {
                        id: `slide-${Date.now()}-${i}`,
                        title: extractedTitle || template.title || 'Untitled',
                        html: filledHtml,
                        type: templateId,
                        templateId,
                        ...(stepSources.length > 0 ? { sources: stepSources } : {}),
                        ...(spec.sectionLabel ? { sectionLabel: spec.sectionLabel } : {}),
                        ...(spec.subSectionLabel ? { subSectionLabel: spec.subSectionLabel } : {}),

                      };
                    }
                  } catch (templateErr) {
                    console.warn(`[create_slides_batch] Template fill failed for slide ${i + 1}:`, templateErr.message);
                  }
                }
              }

              // Fallback to freestyle if template failed or none selected
              if (!newSlide) {
                // Embed user-provided visual guidance for freestyle generation
                let freestyleInstruction = genInstruction;
                const effectiveLayoutGuidance = spec.layoutGuidance || step?.layoutGuidance;
                if (effectiveLayoutGuidance) {
                  freestyleInstruction = `${freestyleInstruction}\n\n[VISUAL LAYOUT: ${effectiveLayoutGuidance}]`;
                }
                // Inject layout diversity hint from batch history
                if (batchUsedLayouts.length > 0) {
                  freestyleInstruction = `${freestyleInstruction}\n\n[LAYOUT DIVERSITY: This batch already used: ${batchUsedLayouts.join(', ')}. Pick a DIFFERENT layout for visual variety.]`;
                }
                const genResult = await generateSlides(freestyleInstruction, stepSettings, 1, state.slides);
                if (genResult?.length > 0 && genResult[0]?.html) {
                  newSlide = {
                    ...genResult[0],
                    ...(stepSources.length > 0 ? { sources: stepSources } : {}),
                    ...(spec.sectionLabel ? { sectionLabel: spec.sectionLabel } : {}),
                    ...(spec.subSectionLabel ? { subSectionLabel: spec.subSectionLabel } : {}),

                  };
                }
              }
            } else {
              // Router returned no plan or was unavailable -- direct generation
              let genInstruction = fullInstruction;
              // Inject layout diversity hint from batch history
              if (batchUsedLayouts.length > 0) {
                genInstruction = `${genInstruction}\n\n[LAYOUT DIVERSITY: This batch already used: ${batchUsedLayouts.join(', ')}. Pick a DIFFERENT layout for visual variety.]`;
              }
              const genResult = await generateSlides(genInstruction, settings, 1, state.slides);
              if (genResult?.length > 0 && genResult[0]?.html) {
                newSlide = {
                  ...genResult[0],
                  ...(spec.sectionLabel ? { sectionLabel: spec.sectionLabel } : {}),
                  ...(spec.subSectionLabel ? { subSectionLabel: spec.subSectionLabel } : {}),
                };
              }
            }

            if (newSlide?.html) {
              actions.addSlide(newSlide);
              // Track layout for diversity in subsequent slides
              const detectedLayout = detectSlideLayout(newSlide.html);
              if (detectedLayout && detectedLayout !== 'unknown' && detectedLayout !== 'cover') {
                batchUsedLayouts.push(detectedLayout);
              }
              // Update slideSummaries so the router sees this slide's template in future iterations
              slideSummaries.push({
                index: slideSummaries.length,
                title: newSlide.title || 'Untitled',
                template: newSlide.templateId || detectedLayout || 'freestyle',
                pendingComments: [],
              });
              results.push({
                success: true,
                index: i,
                slideId: newSlide.id,
                title: newSlide.title,
                templateId: newSlide.templateId || 'freestyle',
              });
            } else {
              results.push({ success: false, index: i, error: 'No valid content generated' });
            }
          } catch (error) {
            console.error(`[create_slides_batch] Error on slide ${i + 1}:`, error);
            results.push({ success: false, index: i, error: error.message || 'Unknown error' });
          }

          // Small delay between slides to avoid rate limits
          if (i < slides.length - 1) {
            await new Promise(r => setTimeout(r, 100));
          }
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        recordAiIO?.({
          tool: 'create_slides_batch',
          input: { slideCount: slides.length, hasContent: !!content },
          output: { created: successCount, failed: failedCount },
        });

        return {
          success: successCount > 0,
          created: successCount,
          failed: failedCount,
          total: slides.length,
          results,
          message: `Created ${successCount}/${slides.length} slides${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
        };
      },
    },

    // ==========================================
    // FULL PRESENTATION BUILD (hand to legacy router)
    // ==========================================

    build_presentation: {
      name: 'build_presentation',
      description: 'Build the entire presentation. Sends ALL slides to the router in ONE call — the router handles template selection, exec summary sync, trackers, and batch execution. Each slide instruction must be RICH and self-contained (all data, facts, key message baked in). The router figures out the rest.',
      activeForm: 'Building full presentation',
      cost: 1,
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Presentation title (used for cover slide if needed)',
          },
          slides: {
            type: 'array',
            description: 'Array of slide specifications — the router will pick templates, set trackers, and order them',
            items: {
              type: 'object',
              properties: {
                instruction: { type: 'string', description: 'DETAILED instruction with all data, key message, and context baked in. Must be self-contained. Include [TRACKER: Section Name] tag if the slide belongs to a section.' },
                sectionTracker: { type: 'string', description: 'Section tracker label (e.g. "1. Market Analysis"). Slides sharing the same tracker form a section group.' },
                layoutGuidance: { type: 'string', description: 'Visual/layout guidance (e.g., "2x2 matrix", "waterfall chart"). Passed to image/freestyle slides. Ignored when a structured template is matched.' },
              },
            },
          },
        },
        required: ['slides'],
      },
      execute: async ({ title, slides: slideSpecs }) => {
        if (!slideSpecs || !Array.isArray(slideSpecs) || slideSpecs.length === 0) {
          return { success: false, error: 'Slides array is required and must not be empty' };
        }

        const batchSize = settings.parallelSlideGeneration || 3;

        onProgress?.({ phase: 'routing', message: `Planning ${slideSpecs.length} slides with router...` });

        // ─── Step 1: Build a combined prompt for the router ───
        // Each slide instruction already contains --- SLIDE N: Title --- [TYPE: ct] and [TRACKER: ...]
        // from the compile step. Just concatenate them — no extra wrapper needed.
        const slideDescriptions = slideSpecs.map((spec) => spec.instruction).join('\n\n');

        // The manager explicitly creates the exec overview slide (slide 1) and body slides.
        // The router just needs to pick templates and add a cover. No auto-creation of exec overview.
        const totalSlideCount = slideSpecs.length;
        const hasExecOverview = slideSpecs.some(s => s._isExecOverview);
        const combinedPrompt = `PRESENTATION CONTENT (from consulting team research):\nTODAY: ${todayString()}\n${title ? `Title: ${title}\n` : ''}SLIDES: ${totalSlideCount} slides below. Produce ALL ${totalSlideCount} — do NOT drop or merge any. Add a cover slide before slide 1.\nCRITICAL: The slide list is COMPLETE. Your ONLY job is to add a cover and pick the best template for each existing slide. Do NOT add ANY extra slides — no executive summary, no table of contents, no deck overview, no section preview, no tracking page, nothing. If any of these already exist in the slides below, just pick the right template for them.\nORDER IS FIXED: Create slides in EXACTLY this order. Do NOT reorder or skip sections.\n\n${slideDescriptions}`;

        // Build context for router — pass empty deck so the router creates a FULL deck
        // (with cover slide, proper ordering, trackers, etc.)
        const slideSummaries = state.slides.map((s, i) => ({
          index: i,
          title: s.title || 'Untitled',
          template: s.templateId || s.layoutType || s.type || 'custom',
          pendingComments: [],
        }));
        // For agent builds: extract storyline flow from enriched title if present
        // (agent embeds "STORYLINE FLOW: ..." in the title for the router to use)
        const existingStoryline = (state.storyline || []).map(s => s.title).join(' → ');
        const flowMatch = (title || '').match(/STORYLINE FLOW:\s*(.+)/);
        const storylineSummary = flowMatch ? flowMatch[1].trim() : existingStoryline;

        // ─── Step 2: Call router ONCE for the entire deck ───
        // agentMode: false — we want the full router plan (cover, all slides, proper positions)
        let routeResult = null;
        try {
          routeResult = await aiRouteRequest(combinedPrompt, {
            slideCount: state.slides.length,
            currentSlideIndex: state.slides.length - 1,
            slideSummaries,
            storylineSummary,
            activeFlow: activeFlow || undefined,
            parallelBatchSize: batchSize,
            agentMode: false,
            // Pass image mode preference so the router picks image-content templates when appropriate
            preferImageSlides: !!settings.imageModel && !!settings.preferImageSlides,
          }, settings);
        } catch (routerErr) {
          console.warn('[build_presentation] Router failed:', routerErr.message);
          return { success: false, error: `Router failed: ${routerErr.message}` };
        }

        if (!routeResult?.plan?.length) {
          return { success: false, error: 'Router returned no plan' };
        }

        // Keep ALL plan steps including cover, thankYou, sectionDivider
        // — the router knows best how to structure the full deck
        const planSteps = routeResult.plan;

        // Emit router plan so the agent/UI can show slide structure
        const routerPlan = planSteps.map((s, i) => ({
          index: i,
          templateId: s.templateId || 'freestyle',
          instruction: s.instruction || '',
        }));
        onProgress?.({
          phase: 'generating',
          message: `Creating ${planSteps.length} slides (${batchSize} at a time)...`,
          routerPlan,
        });

        // Notify agent of the router plan so it can update batch step labels
        _batchProgress.fn?.(-1, planSteps.length, 'plan', routerPlan);

        // ─── Step 3: Execute plan steps in batches ───
        // Each batch groups N slides into a single API call via fillTemplatesBulkWithAI.
        // Batch size is controlled by settings.slideCreationBatchSize (default 3).
        // Batches are processed sequentially; freestyle slides fall back to individual calls.
        const results = [];
        const stepOutputs = {};
        let lastInsertedIndex = -1;
        const creationBatchSize = settings.slideCreationBatchSize || 3;

        // Track execution groups if provided (same as standard flow)
        const groups = routeResult.groups && routeResult.groups.length > 0
          ? routeResult.groups
          : [planSteps.map((_, i) => i)]; // Default: all steps in one group

        const normalizeStepDependencyIndex = (step) => {
          if (step?.contextFromStep === null || step?.contextFromStep === undefined) return null;
          const dependency = Number(step.contextFromStep);
          return Number.isInteger(dependency) ? dependency : NaN;
        };
        const dependencyIssues = [];
        for (let idx = 0; idx < planSteps.length; idx++) {
          const dependency = normalizeStepDependencyIndex(planSteps[idx]);
          if (dependency === null) continue;
          if (!Number.isInteger(dependency)) {
            dependencyIssues.push(`Step ${idx} has an invalid contextFromStep value: ${planSteps[idx].contextFromStep}`);
          } else if (dependency < 0 || dependency >= planSteps.length) {
            dependencyIssues.push(`Step ${idx} depends on missing step ${dependency}`);
          } else if (dependency >= idx) {
            dependencyIssues.push(`Step ${idx} depends on step ${dependency}, which has not run yet`);
          } else {
            planSteps[idx].contextFromStep = dependency;
          }
        }
        if (dependencyIssues.length > 0) {
          throw new Error(`Router plan has invalid step dependencies:\n${dependencyIssues.join('\n')}`);
        }

        const cleanSlideCSSForAI = (customCSS = '') =>
          String(customCSS || '').replace(/\[data-slide-id="[^"]*"\]\s*/g, '');

        const appendContextFromStep = (instruction, step) => {
          const dependency = normalizeStepDependencyIndex(step);
          if (dependency === null) return instruction;
          const prevOutput = stepOutputs[dependency];
          if (!prevOutput) {
            throw new Error(`Step depends on previous step ${dependency}, but that step did not produce reusable output.`);
          }
          let previousContext = prevOutput.html || '';
          if (prevOutput.customCSS) {
            previousContext = `<style>\n${cleanSlideCSSForAI(prevOutput.customCSS)}\n</style>\n${previousContext}`;
          }
          return `${instruction}\n\n[CONTEXT FROM PREVIOUSLY CREATED SLIDE (Step ${dependency}) - "${prevOutput.title || 'Untitled'}":\n${previousContext}]\n\nIf this slide extends or compares the same entities as the referenced slide, reuse the same entity names, labels, ordering, and visual structure unless the instruction explicitly says to change them.`;
        };

        // Helper: prepare a step's instruction (enrichment, vibe, search hint)
        // Returns { instruction, stepSettings } — stepSettings has _extraTools when search is needed
        //
        // When structured slides were provided, always use the original slideSpec instruction
        // rather than the router's (possibly condensed/rewritten) version. The router is only
        // consulted for template selection and metadata — the original content passes through as-is.
        const prepareStepInstruction = (step, stepIdx) => {
          let stepInstruction = step.instruction || '';
          // Prefer user-provided layoutGuidance from original spec over router's version.
          // Falls back to router's layoutGuidance when the original spec doesn't provide one.
          let specLayoutGuidance = null;

          // Map body plan steps back to original slideSpecs by order (skip cover).
          // After routing, planSteps = cover + body slides in order, so body step N → slideSpecs[N].
          const isCover = step.templateId === 'cover';
          if (!isCover) {
            const bodyStepIdx = planSteps.slice(0, stepIdx).filter(s => s.templateId !== 'cover').length;
            const originalSpec = slideSpecs[bodyStepIdx];
            if (originalSpec?.instruction) {
              stepInstruction = originalSpec.instruction;
            }
            if (originalSpec?.layoutGuidance) {
              specLayoutGuidance = originalSpec.layoutGuidance;
            }
          }

          // Fallback for cover or unmapped steps
          if (stepInstruction.length < 50) {
            const specIdx = stepIdx;
            const fallbackSpec = slideSpecs[specIdx] || slideSpecs[stepIdx];
            if (fallbackSpec?.instruction) stepInstruction = fallbackSpec.instruction;
            if (!specLayoutGuidance && fallbackSpec?.layoutGuidance) specLayoutGuidance = fallbackSpec.layoutGuidance;
          }
          // Resolve effective layout guidance: user-provided > router's
          const layoutGuidance = specLayoutGuidance || step.layoutGuidance || null;

          // If step needs search, inject search tool into settings -- the generation call will search inline
          let stepSettings = settings;
          if (step.searchQuery) {
            stepSettings = {
              ...settings,
              _extraTools: [{
                type: 'web_search_preview',
                search_context_size: settings.searchContextSize || 'medium',
              }],
            };
            stepInstruction = `${stepInstruction}\n\n[SEARCH THE WEB for: "${step.searchQuery}" — use real data, numbers, and facts from your search results. Be executive, not wordy.]`;
            console.log(`[build_presentation] Step ${stepIdx + 1}: inline search for "${step.searchQuery.substring(0, 80)}"`);
          }
          stepInstruction = appendContextFromStep(stepInstruction, step);
          return { instruction: stepInstruction, stepSettings, layoutGuidance };
        };

        // Helper: resolve final template ID (re-evaluate for data shape)
        const resolveTemplate = (step, stepInstruction) => {
          let finalTemplateId = step.templateId;
          if (finalTemplateId && finalTemplateId !== 'freestyle') {
            const reEvalId = reEvaluateTemplateForData(finalTemplateId, stepInstruction);
            if (reEvalId !== finalTemplateId) {
              console.log(`[build_presentation] Template re-evaluated: ${finalTemplateId} → ${reEvalId}`);
              finalTemplateId = reEvalId;
            }
          }
          return finalTemplateId;
        };

        // Helper: insert a slide into the deck
        const insertSlide = (newSlide, step) => {
          const pos = step.position;
          const dataWithFlag = { ...newSlide, skipActiveChange: true };
          if (pos === 'start') {
            actions.insertSlideAt(0, dataWithFlag);
            lastInsertedIndex = 0;
          } else if (pos === 'after_previous' && lastInsertedIndex >= 0) {
            actions.insertSlideAt(lastInsertedIndex + 1, dataWithFlag);
            lastInsertedIndex = lastInsertedIndex + 1;
          } else if (typeof pos === 'object' && pos?.after_slide !== undefined) {
            const insertAt = pos.after_slide + 1;
            actions.insertSlideAt(insertAt, dataWithFlag);
            lastInsertedIndex = insertAt;
          } else {
            actions.addSlide(dataWithFlag);
            lastInsertedIndex = state.slides.length;
          }
        };

        for (const group of groups) {
          // Split group into sub-batches of creationBatchSize
          for (let batchStart = 0; batchStart < group.length;) {
            const batchIndices = [];
            for (let cursor = batchStart; cursor < group.length && batchIndices.length < creationBatchSize; cursor++) {
              const stepIdx = group[cursor];
              const dependency = normalizeStepDependencyIndex(planSteps[stepIdx]);
              if (dependency !== null && batchIndices.includes(dependency) && batchIndices.length > 0) {
                break;
              }
              batchIndices.push(stepIdx);
            }
            if (batchIndices.length === 0) batchIndices.push(group[batchStart]);
            batchStart += batchIndices.length;

            // Phase 1: Prepare all steps in this batch (instructions, template resolution)
            const prepared = [];
            for (const stepIdx of batchIndices) {
              const step = planSteps[stepIdx];
              _batchProgress.fn?.(stepIdx, planSteps.length, 'active');
              onProgress?.({
                phase: 'generating',
                message: `Slide ${stepIdx + 1} of ${planSteps.length}...`,
                current: stepIdx + 1,
                total: planSteps.length,
              });
              const { instruction, stepSettings, layoutGuidance } = prepareStepInstruction(step, stepIdx);
              const finalTemplateId = resolveTemplate(step, instruction);
              const template = (finalTemplateId && finalTemplateId !== 'freestyle')
                ? SLIDE_TEMPLATES?.[finalTemplateId] : null;
              prepared.push({ stepIdx, step, instruction, stepSettings, finalTemplateId, template, layoutGuidance });
            }

            // Phase 2: Separate templated vs image vs freestyle steps
            const isImageTemplate = (id) => id === 'image-full' || id === 'image-content';
            const templated = prepared.filter(p => p.template && !isImageTemplate(p.finalTemplateId));
            const imageSlides = prepared.filter(p => isImageTemplate(p.finalTemplateId) && settings.imageModel);
            const freestyle = prepared.filter(p =>
              !p.template && !isImageTemplate(p.finalTemplateId) ||
              isImageTemplate(p.finalTemplateId) && !settings.imageModel  // image fallback to freestyle
            );

            // Phase 3a: Bulk-generate templated slides (ONE API call for the batch)
            // If any step needs search, enable _extraTools on the bulk settings — the model
            // searches inline while generating all slides in a single call.
            const hasSearchSteps = prepared.some(p => p.stepSettings._extraTools?.length > 0);
            const bulkSettings = hasSearchSteps
              ? { ...settings, _extraTools: [{ type: 'web_search_preview', search_context_size: settings.searchContextSize || 'medium' }] }
              : settings;
            let bulkResults = [];
            if (templated.length > 0) {
              const bulkSpecs = templated.map(p => ({
                template: p.template,
                instruction: p.instruction,
              }));
              console.log(`[build_presentation] Bulk generating ${templated.length} slides in one call${hasSearchSteps ? ' (with search)' : ''}`);
              try {
                const bulkHtmls = await fillTemplatesBulkWithAI(bulkSpecs, bulkSettings, { agentMode: true });
                bulkResults = templated.map((p, i) => ({
                  ...p,
                  html: bulkHtmls[i] || null,
                }));
              } catch (bulkErr) {
                // Bulk failed (timeout, overload) — retry individually, sequentially to reduce load
                console.warn(`[build_presentation] Bulk generation failed, retrying individually (sequential):`, bulkErr.message);
                for (const p of templated) {
                  try {
                    const html = await fillTemplateWithAI(p.template, p.instruction, p.stepSettings, [], { agentMode: true });
                    bulkResults.push({ ...p, html });
                  } catch (indErr) {
                    console.warn(`[build_presentation] Individual fill failed for step ${p.stepIdx + 1}:`, indErr.message);
                    bulkResults.push({ ...p, html: null });
                  }
                }
              }
            }

            // Phase 3b: Generate image slides (uses image model for visual + text model for title/subtitle)
            let imageResults = [];
            if (imageSlides.length > 0) {
              console.log(`[build_presentation] Generating ${imageSlides.length} image slides`);
              for (const p of imageSlides) {
                try {
                  const imageMode = p.finalTemplateId === 'image-full' ? 'full' : 'content';
                  // p.layoutGuidance already resolved: user-provided > router's (from prepareStepInstruction)
                  const imageResult = await generateImageSlide(p.instruction, settings, imageMode, {
                    layoutGuidance: p.layoutGuidance || null,
                    vibe: state.imageVibe,
                    footerBranding: getClientProfileFooterBranding(settings, 'Strategy&'),
                    slideNumber: state.slides.length + p.stepIdx + 1,
                  });
                  imageResults.push({ ...p, html: imageResult?.html || null, genData: imageResult });
                } catch (imgErr) {
                  console.warn(`[build_presentation] Image gen failed for step ${p.stepIdx + 1}, will fallback to freestyle:`, imgErr.message);
                  // Fall back to freestyle for this slide — embed visual guidance
                  try {
                    let fallbackInstruction = p.instruction;
                    if (p.layoutGuidance) {
                      fallbackInstruction = `${fallbackInstruction}\n\n[VISUAL LAYOUT: ${p.layoutGuidance}]`;
                    }
                    const genResult = await generateSlides(fallbackInstruction, p.stepSettings, 1, state.slides);
                    const html = genResult?.[0]?.html || null;
                    imageResults.push({ ...p, html, genData: genResult?.[0] });
                  } catch (fallbackErr) {
                    imageResults.push({ ...p, html: null });
                  }
                }
              }
            }

            // Phase 4: Generate freestyle slides in parallel, retry failures sequentially
            let freestyleResults = [];
            if (freestyle.length > 0) {
              const parallelResults = await Promise.all(freestyle.map(async (p) => {
                try {
                  // Embed visual guidance for freestyle generation
                  let fsInstruction = p.instruction;
                  if (p.layoutGuidance) {
                    fsInstruction = `${fsInstruction}\n\n[VISUAL LAYOUT: ${p.layoutGuidance}]`;
                  }
                  const genResult = await generateSlides(fsInstruction, p.stepSettings, 1, state.slides);
                  const html = genResult?.[0]?.html || null;
                  return { ...p, html, genData: genResult?.[0], ok: true };
                } catch (err) {
                  console.warn(`[build_presentation] Freestyle gen failed for step ${p.stepIdx + 1}:`, err.message);
                  return { ...p, html: null, ok: false };
                }
              }));
              const failed = [];
              for (const r of parallelResults) {
                if (r.ok) {
                  freestyleResults.push(r);
                } else {
                  failed.push(r);
                }
              }
              if (failed.length > 0) {
                console.log(`[build_presentation] Retrying ${failed.length} failed freestyle slides sequentially...`);
                for (const p of failed) {
                  try {
                    let fsInstruction = p.instruction;
                    if (p.layoutGuidance) {
                      fsInstruction = `${fsInstruction}\n\n[VISUAL LAYOUT: ${p.layoutGuidance}]`;
                    }
                    const genResult = await generateSlides(fsInstruction, p.stepSettings, 1, state.slides);
                    const html = genResult?.[0]?.html || null;
                    freestyleResults.push({ ...p, html, genData: genResult?.[0] });
                  } catch (retryErr) {
                    console.warn(`[build_presentation] Freestyle retry also failed for step ${p.stepIdx + 1}:`, retryErr.message);
                    freestyleResults.push({ ...p, html: null });
                  }
                }
              }
            }

            // Phase 5: Merge results and insert in original order
            const allResults = [...bulkResults, ...imageResults, ...freestyleResults]
              .sort((a, b) => a.stepIdx - b.stepIdx);

            for (const r of allResults) {
              let newSlide = null;

              if (r.html) {
                if (r.template) {
                  const extractedTitle = extractTitleFromHTML(r.html);
                  newSlide = {
                    id: `slide-${Date.now()}-${r.stepIdx}`,
                    title: extractedTitle || r.template.title || 'Untitled',
                    html: r.html,
                    type: r.finalTemplateId,
                    templateId: r.finalTemplateId,
                    ...(Array.isArray(r.step.sources) && r.step.sources.length > 0 ? { sources: r.step.sources } : {}),
                    ...(r.step.sectionTracker ? { sectionLabel: r.step.sectionTracker } : {}),
                    ...(r.step.subSectionTracker ? { subSectionLabel: r.step.subSectionTracker } : {}),
                  };
                } else {
                  // Freestyle
                  newSlide = {
                    ...(r.genData || {}),
                    html: r.html,
                    ...(Array.isArray(r.step.sources) && r.step.sources.length > 0 ? { sources: r.step.sources } : {}),
                    ...(r.step.sectionTracker ? { sectionLabel: r.step.sectionTracker } : {}),
                    ...(r.step.subSectionTracker ? { subSectionLabel: r.step.subSectionTracker } : {}),
                  };
                }
              }

              // If template fill returned null, try freestyle fallback
              if (!newSlide && r.template) {
                try {
                  const genResult = await generateSlides(r.instruction, settings, 1, state.slides);
                  if (genResult?.[0]?.html) {
                    newSlide = {
                      ...genResult[0],
                      ...(Array.isArray(r.step.sources) && r.step.sources.length > 0 ? { sources: r.step.sources } : {}),
                      ...(r.step.sectionTracker ? { sectionLabel: r.step.sectionTracker } : {}),
                      ...(r.step.subSectionTracker ? { subSectionLabel: r.step.subSectionTracker } : {}),
                    };
                  }
                } catch (e) { /* already logged */ }
              }

              if (newSlide?.html) {
                insertSlide(newSlide, r.step);
                stepOutputs[r.stepIdx] = {
                  html: newSlide.html,
                  customCSS: newSlide.customCSS,
                  title: newSlide.title,
                  slideId: newSlide.id,
                };
                results.push({
                  success: true,
                  index: r.stepIdx,
                  slideId: newSlide.id,
                  title: newSlide.title,
                  templateId: r.finalTemplateId || 'freestyle',
                });
              } else {
                results.push({ success: false, index: r.stepIdx, error: 'No content generated' });
              }
              _batchProgress.fn?.(r.stepIdx, planSteps.length, newSlide?.html ? 'complete' : 'error');
            }
          }
        }

        // Sync storyline after all slides inserted
        try { actions.syncStorylineFromSlides?.(); } catch (e) { /* ignore */ }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        // Summarize what the router actually planned (for agent logging)
        const routerPlanSummary = planSteps.map((s, i) => {
          const tracker = s.sectionTracker ? `[${s.sectionTracker}]` : '';
          const tmpl = s.templateId || 'freestyle';
          return `${i + 1}. ${tmpl}${tracker ? ` ${tracker}` : ''}`;
        }).join(', ');

        recordAiIO?.({
          tool: 'build_presentation',
          input: { slideCount: slideSpecs.length, batchSize, title, sections: [...new Set(slideSpecs.map(s => s.sectionTracker).filter(Boolean))], fullPrompt: combinedPrompt },
          output: { created: successCount, failed: failedCount, planSteps: planSteps.length, routerPlanSummary },
        });

        return {
          success: successCount > 0,
          created: successCount,
          failed: failedCount,
          total: planSteps.length,
          results,
          routerPlanSummary,
          routerPrompt: combinedPrompt,  // Exact prompt sent to the router — for engagement audit
          routerPlan: planSteps.map(s => ({
            templateId: s.templateId || 'freestyle',
            instruction: (s.instruction || '').slice(0, 300),
            sectionTracker: s.sectionTracker || null,
          })),
          message: `Built presentation: ${successCount}/${planSteps.length} slides${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
        };
      },
    },

    edit_slide: {
      name: 'edit_slide',
      description: 'Edit an existing slide with new instructions. Use when: a slide needs changes (content update, style fix, reorganization). Requires slideIndex (0-based) and instruction describing the change.',
      activeForm: 'Editing slide',
      cost: 2,
      parameters: {
        type: 'object',
        properties: {
          slideIndex: {
            type: 'number',
            description: 'Index of the slide to edit (0-based)',
          },
          instruction: {
            type: 'string',
            description: 'What changes to make',
          },
        },
        required: ['slideIndex', 'instruction'],
      },
      execute: async ({ slideIndex, instruction }) => {
        const slide = state.slides[slideIndex];
        if (!slide) {
          return { success: false, error: `Slide at index ${slideIndex} not found` };
        }

        // Detect image slides — regenerate via image model instead of text editing
        const isImageSlide = slide.templateId === 'image-full' || slide.templateId === 'image-content';

        onProgress?.({ phase: 'editing', message: `${isImageSlide ? 'Regenerating image for' : 'Editing'} slide ${slideIndex + 1}...` });

        try {
          let newHtml, newCSS;

          if (isImageSlide && settings.imageModel) {
            const imageMode = slide.templateId === 'image-full' ? 'full' : 'content';
            const existingImage = extractImageDataUri(slide.html);
            const imageResult = await generateImageSlide(instruction, settings, imageMode, {
              layoutGuidance: instruction,
              vibe: state.imageVibe,
              footerBranding: getClientProfileFooterBranding(settings, 'Strategy&'),
              slideNumber: slideIndex + 1,
              totalSlides: state.slides.length,
              existingImageDataUri: existingImage,
            });
            newHtml = imageResult?.html;
          } else {
            const result = await improveSlide(slide.html, instruction, settings);
            newHtml = typeof result === 'string' ? result : result?.html;
            newCSS = typeof result === 'object' ? result?.customCSS : undefined;
          }

          if (newHtml) {
            actions.updateSlide(slide.id, {
              html: newHtml,
              ...(newCSS ? { customCSS: newCSS } : {}),
              ...(isImageSlide ? { templateId: slide.templateId, type: slide.type } : {}),
            });

            recordAiIO?.({
              tool: 'edit_slide',
              input: { slideIndex, instruction },
              output: { updated: true },
            });

            return {
              success: true,
              slideId: slide.id,
              slideIndex,
              message: `Edited slide ${slideIndex + 1}`,
            };
          }

          return { success: false, error: 'Failed to generate edit' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    },

    // ==========================================
    // ANALYSIS TOOLS
    // ==========================================

    analyze_content: {
      name: 'analyze_content',
      description: 'Analyze text content to extract key points, statistics, and insights for slides. Use when: you have raw text (from documents, research, or KB) that needs structuring for presentation.',
      activeForm: 'Analyzing content',
      cost: 2,
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The content to analyze',
          },
          focus: {
            type: 'string',
            description: 'What to focus on: "key_points", "statistics", "quotes", "all"',
          },
        },
        required: ['content'],
      },
      execute: async ({ content, focus = 'all' }) => {
        onProgress?.({ phase: 'analyzing', message: 'Analyzing content...' });

        try {
          const analysisPrompt = `Analyze the following content and extract (today: ${todayString()}):
${focus === 'all' || focus === 'key_points' ? '- Key points and main arguments' : ''}
${focus === 'all' || focus === 'statistics' ? '- Statistics, numbers, and data points' : ''}
${focus === 'all' || focus === 'quotes' ? '- Notable quotes or statements' : ''}

Content:
${content.slice(0, 8000)}

Return a JSON object with the extracted information.`;

          const result = await agentChat(
            analysisPrompt,
            settings,
            { returnJSON: true }
          );

          recordAiIO?.({
            tool: 'analyze_content',
            input: { contentLength: content.length, focus },
            output: { analyzed: true },
          });

          return {
            success: true,
            analysis: result,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    },

    // ==========================================
    // PLANNING TOOLS
    // ==========================================

    plan_presentation: {
      name: 'plan_presentation',
      description: 'Create a structured presentation plan/storyline with sections and flow. Use when: you need a detailed outline before creating slides. For simpler tasks (1-3 slides), skip this and create slides directly.',
      activeForm: 'Planning presentation',
      cost: 2,
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The main topic or goal of the presentation',
          },
          content: {
            type: 'string',
            description: 'Optional source content to base the presentation on',
          },
          slideCount: {
            type: 'number',
            description: 'Target number of slides (default: auto)',
          },
          audience: {
            type: 'string',
            description: 'Target audience description',
          },
        },
        required: ['topic'],
      },
      execute: async ({ topic, content, slideCount, audience }) => {
        onProgress?.({ phase: 'planning', message: 'Creating presentation plan...' });

        try {
          const result = await generateStoryline(
            topic,
            settings,
            {
              content,
              slideCount,
              audience,
            }
          );

          recordAiIO?.({
            tool: 'plan_presentation',
            input: { topic, slideCount, audience },
            output: { sections: result?.sections?.length || 0 },
          });

          return {
            success: true,
            storyline: result,
            sections: result?.sections || [],
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    },

    // ==========================================
    // VALIDATION TOOLS
    // ==========================================

    validate_slides: {
      name: 'validate_slides',
      description: 'Validate the current slides for layout issues, content quality, and consistency. Use when: slides have been created and you want to check quality before marking done. Free — costs no budget.',
      activeForm: 'Validating slides',
      cost: 0,
      parameters: {
        type: 'object',
        properties: {
          slideIndices: {
            type: 'array',
            description: 'Indices of slides to validate (empty for all)',
            items: { type: 'number' },
          },
        },
      },
      execute: async ({ slideIndices }) => {
        const indicesToCheck = slideIndices?.length > 0
          ? slideIndices
          : state.slides.map((_, i) => i);

        const issues = [];
        for (const idx of indicesToCheck) {
          const slide = state.slides[idx];
          if (!slide) continue;

          // Basic validation checks
          const slideIssues = [];

          // Check for empty content
          if (!slide.html || slide.html.trim().length < 50) {
            slideIssues.push({ type: 'warning', message: 'Slide appears to have minimal content' });
          }

          // Check for missing title
          if (!slide.html.includes('<h1') && !slide.html.includes('class="title"')) {
            slideIssues.push({ type: 'warning', message: 'Slide may be missing a title' });
          }

          if (slideIssues.length > 0) {
            issues.push({ slideIndex: idx, issues: slideIssues });
          }
        }

        return {
          success: true,
          validated: indicesToCheck.length,
          issuesFound: issues.length > 0,
          issues,
        };
      },
    },

    // ==========================================
    // UTILITY TOOLS
    // ==========================================

    think: {
      name: 'think',
      description: 'Take a moment to think through a problem or plan next steps. Use this to reason about complex tasks. Free — no budget cost.',
      activeForm: 'Thinking',
      cost: 0,
      parameters: {
        type: 'object',
        properties: {
          thought: {
            type: 'string',
            description: 'The thought or reasoning to process',
          },
        },
        required: ['thought'],
      },
      execute: async ({ thought }) => {
        // This is a no-op tool that allows the agent to "think" visibly
        recordAiIO?.({
          tool: 'think',
          input: { thought },
          output: { processed: true },
        });

        return {
          success: true,
          thought,
          message: 'Thought processed',
        };
      },
    },

    report_progress: {
      name: 'report_progress',
      description: 'Report progress or status to the user. Use sparingly — only for long-running tasks. Free — no budget cost.',
      activeForm: 'Reporting progress',
      cost: 0,
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Progress message to show',
          },
          percentage: {
            type: 'number',
            description: 'Optional percentage complete (0-100)',
          },
        },
        required: ['message'],
      },
      execute: async ({ message, percentage }) => {
        addMessage?.({
          type: 'assistant',
          content: `📊 ${message}${percentage !== undefined ? ` (${percentage}%)` : ''}`,
        });

        return { success: true, reported: message };
      },
    },

    add_task: {
      name: 'add_task',
      description: 'Add a new task to the current task list. Use this when you discover additional work needed during execution. Free — no budget cost.',
      activeForm: 'Adding task',
      cost: 0,
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Description of the task (imperative form)',
          },
          insertAfterCurrent: {
            type: 'boolean',
            description: 'Whether to insert after current task (default: true) or at end',
          },
        },
        required: ['content'],
      },
      execute: async ({ content, insertAfterCurrent = true }) => {
        // This will be handled by the executor
        return {
          success: true,
          action: 'add_task',
          content,
          insertAfterCurrent,
        };
      },
    },

    complete_execution: {
      name: 'complete_execution',
      description: 'Signal that the overall task is complete. Use this when all work is done and output has been verified. Free — no budget cost.',
      activeForm: 'Completing execution',
      cost: 0,
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Summary of what was accomplished',
          },
        },
        required: ['summary'],
      },
      execute: async ({ summary }) => {
        return {
          success: true,
          action: 'complete',
          summary,
        };
      },
    },
  };

  return registry;
}

/**
 * Get tool definitions formatted for AI prompt
 */
export function getToolDefinitionsForPrompt(registry) {
  const tools = Object.values(registry);

  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * Get a compact tool list for AI context
 */
export function getCompactToolList(registry) {
  const tools = Object.values(registry);

  return tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
}
