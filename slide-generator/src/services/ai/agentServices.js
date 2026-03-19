import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import { getCredentials, buildProviderHeaders, parseModelRef, findProvider } from './models.js';
import { callGeminiAPI, buildRequestBody, parseAPIResponseContent, _acquireApiSlot, _releaseApiSlot, _apiState } from './apiClient.js';
import { LEAN_ROUTER_PROMPT } from './constants.js';
import { safeJSONParse } from './router.js';

// Generate PptxGenJS renderer code for a custom template
export async function generatePptxRendererCode(templateHtml, templateTitle, settings) {
  // Apply pptxGenerator role overrides if configured
  const pptxRole = settings.roleSettings?.pptxGenerator || {};
  if (pptxRole.model) settings = { ...settings, model: pptxRole.model };
  if (pptxRole.maxTokens) settings = { ...settings, maxTokens: pptxRole.maxTokens };
  if (pptxRole.reasoningEffort) settings = { ...settings, reasoningEffort: pptxRole.reasoningEffort };
  if (pptxRole.temperature !== '' && pptxRole.temperature !== undefined) settings = { ...settings, temperature: pptxRole.temperature };

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const systemPrompt = `You are an expert JavaScript developer specializing in PptxGenJS library.
Your task is to generate a JavaScript function that renders a slide from HTML to PowerPoint.

PPTXGENJS REFERENCE:
- Slide size: 13.333 x 7.5 inches (16:9)
- Coordinates are in inches from top-left
- Colors are hex without # (e.g., "8E1E1E")

COLOR PALETTE:
- maroon: '8E1E1E' (accent)
- red: 'A32020' (subtitles)
- main: '111111' (text)
- secondary: '222222' (body)
- meta: '4A4F57' (footer)
- zone1: 'F7F9FB' (light bg)
- border: 'E6E9EE'

RULES:
1. Return ONLY the function body code (no function wrapper)
2. Extract content from slideData.html using DOM parsing
3. Use provided helpers: addFooter, addTitle, addSubtitle
4. Position elements to match the HTML layout visually`;

  const userPrompt = `Generate PptxGenJS code to render this template to PowerPoint.

TEMPLATE: "${templateTitle}"

HTML:
${templateHtml}

Generate code that:
1. Creates a slide: const slide = pptx.addSlide();
2. Parses the HTML: const parser = new DOMParser(); const doc = parser.parseFromString(slideData.html, 'text/html');
3. Extracts and positions all text/shapes to match the HTML layout
4. Calls addFooter(slide, slideNum, totalSlides) at the end

Return ONLY the JavaScript code (no markdown, no explanation). The code will be wrapped in:
function(pptx, slideData, slideNum, totalSlides) { YOUR_CODE_HERE }`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Clean up code blocks
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

// Chat with context - for Q&A and debugging without modifying slides
export async function chatWithContext(question, context, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Build context description
  let contextDescription = '';

  // Current slide context
  if (context.currentSlide) {
    const slide = context.currentSlide.slide;
    contextDescription += `
=== CURRENT SLIDE (Slide ${context.currentSlide.index + 1}) ===
Title: "${slide.title || 'Untitled'}"
Type: ${slide.type || 'custom'}
HTML Content:
${slide.html}
=== END CURRENT SLIDE ===
`;
  }

  // Referenced slides (from "slide 5", "this slide", etc.)
  if (context.referencedSlides && context.referencedSlides.length > 0) {
    for (const ref of context.referencedSlides) {
      const slide = ref.slide;
      contextDescription += `
=== REFERENCED SLIDE ${ref.index + 1} (${ref.type}) ===
Title: "${slide.title || 'Untitled'}"
Type: ${slide.type || 'custom'}
HTML Content:
${slide.html}
=== END SLIDE ${ref.index + 1} ===
`;
    }
  }

  // Full deck overview
  if (context.allSlides && context.allSlides.length > 0) {
    contextDescription += `
=== FULL DECK OVERVIEW (${context.totalSlides} slides) ===
${context.allSlides.map((s, i) => {
  const isCurrent = context.currentSlide && context.currentSlide.index === i;
  const marker = isCurrent ? ' ← CURRENTLY VIEWING' : '';
  return `${i + 1}. "${s.title || 'Untitled'}" [${s.type || 'custom'}]${marker}${s.summary ? `\n   Summary: ${s.summary}` : ''}`;
}).join('\n')}
=== END DECK OVERVIEW ===
`;
  }

  const systemPrompt = `You are a helpful assistant for a slide presentation tool.
You have full context of the user's presentation deck and can answer questions about slides.

IMPORTANT RULES:
1. You CAN see slide content - describe what you see accurately
2. When user references "this slide" or "current slide", look at CURRENT SLIDE section
3. When user references "slide 5", look for SLIDE 5 in the context
4. Be specific - quote text, describe layouts, mention data/numbers you see
5. If asked to identify pillars/points, extract them from the HTML content
6. Keep responses informative and relevant

CONTEXT SECTIONS:
- CURRENT SLIDE: The slide the user is currently viewing
- REFERENCED SLIDES: Specific slides mentioned in the question
- FULL DECK OVERVIEW: Summary of all slides with titles and types`;

  const userPrompt = `${contextDescription}

USER QUESTION: ${question}

Answer based on the context provided above. Be specific and quote actual content from the slides when relevant.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * AI triage: decides whether a request needs full agent mode (research + planning)
 * or can go directly to the router for simple execution.
 * Uses the fast model for a quick, cheap decision.
 * @param {string} userPrompt - The user's request
 * @param {Object} context - Current deck state (slideCount, storylineSummary, slideSummaries)
 * @param {Object} settings - API settings
 * @returns {Promise<{useAgent: boolean, reason: string}>}
 */
export async function triageRequest(userPrompt, context, settings) {
  const fastSettings = settings.fastModel
    ? { ...settings, model: settings.fastModel }
    : settings;

  const slideSummary = context.slideSummaries?.length > 0
    ? context.slideSummaries.map(s => `  ${s.index + 1}. "${s.title}" (${s.type})`).join('\n')
    : '(empty deck)';

  const prompt = `Decide if this user request needs the full content agent (research, planning, structuring) or can go directly to the slide router (simple create/edit/delete).

CURRENT DECK (${context.slideCount || 0} slides):
${slideSummary}
${context.storylineSummary ? `Storyline: ${context.storylineSummary}` : '(no storyline)'}

USER REQUEST: "${userPrompt}"

USE AGENT when the request:
- Needs web research (current data, statistics, market info, recent events)
- Asks for a multi-slide presentation on a topic (even if short, e.g. "now do risks")
- Needs content planning/storyline thinking (structure, narrative arc)
- Asks about a topic that requires domain knowledge the user hasn't provided
- Continues or extends an existing deck with new substantive content

SKIP AGENT (go directly to router) when the request:
- Is a simple edit to existing slides (change color, fix text, swap template)
- Is a layout/design request (fix overflow, resize, rearrange)
- Adds a single simple slide with no research needed (e.g. "add a thank you slide")
- Is a delete, reorder, or template switch
- Is a question about the tool itself

Reply with ONLY valid JSON: {"useAgent": true/false, "reason": "brief explanation"}`;

  try {
    const result = await agentChat(prompt, fastSettings, {
      systemPrompt: 'You are a routing classifier. Return JSON only, no commentary.',
      returnJSON: true,
      temperature: 0,
      maxTokens: 100,
    });

    if (result && typeof result === 'object') {
      console.log('[Triage]', result.useAgent ? 'AGENT' : 'ROUTER', '-', result.reason);
      return { useAgent: !!result.useAgent, reason: result.reason || '' };
    }
    if (typeof result === 'string') {
      const parsed = JSON.parse(result);
      console.log('[Triage]', parsed.useAgent ? 'AGENT' : 'ROUTER', '-', parsed.reason);
      return { useAgent: !!parsed.useAgent, reason: parsed.reason || '' };
    }
  } catch (err) {
    console.warn('[Triage] Failed, defaulting to agent:', err.message);
  }
  // Default: use agent for safety
  return { useAgent: true, reason: 'triage failed, defaulting to agent' };
}

/**
 * Simple chat function for agent reasoning
 * Used by the agentic executor for general purpose AI calls
 *
 * @param {string} prompt - The user prompt
 * @param {Object} settings - API settings
 * @param {Object} options - Options like systemPrompt, returnJSON, temperature
 * @returns {Promise<string|Object>} The AI response (string or parsed JSON)
 */
export async function agentChat(prompt, settings, options = {}) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const {
    systemPrompt = 'You are a helpful AI assistant.',
    returnJSON = false,
    temperature = 0.7,
    maxTokens = 4096,
    reasoningEffort,
    timeout = 360000, // 6 minute default timeout
  } = options;

  // ── Auto-inject search tool when searchEnabled is true ──
  // Models with built-in search (Gemini googleSearch, GPT web_search_preview)
  // just need the tool added to the request — same endpoint, same key.
  // This avoids needing a separate search endpoint/model/key configuration.
  let effectiveSettings = settings;
  if (settings.searchEnabled && !settings._extraTools?.length) {
    const searchTool = {
      type: 'web_search_preview',
      search_context_size: settings.searchContextSize || 'medium',
    };
    effectiveSettings = { ...settings, _extraTools: [searchTool] };
    console.log(`%c[agentChat] Search enabled — injecting ${creds.isGeminiProvider ? 'googleSearch' : 'web_search_preview'} tool`, 'color:#059669');
  }

  try {
    let content;

    if (creds.isGeminiProvider) {
      // Use existing Gemini API handler — merge options maxTokens + reasoningEffort into settings
      const mergedReasoning = reasoningEffort || settings.reasoningEffort || 'low';
      console.log(`%c[agentChat→Gemini] model=${creds.model}  reasoningEffort=${mergedReasoning}  maxTokens=${maxTokens}  search=${!!effectiveSettings._extraTools?.length}`, 'color:#6a9fb5');
      content = await callGeminiAPI({ ...effectiveSettings, maxTokens, reasoningEffort: mergedReasoning }, systemPrompt, prompt);
    } else {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];

      const requestBody = buildRequestBody(
        { ...effectiveSettings, temperature, maxTokens, ...(reasoningEffort !== undefined ? { reasoningEffort } : {}) },
        messages
      );

      // Set up timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Build headers based on provider type
      const headers = buildProviderHeaders(creds);

      // JSON mode: only for endpoints known to support it (OpenAI direct, not enterprise proxies/Azure/Anthropic)
      const isDirectOpenAI = (creds.apiEndpoint || '').includes('api.openai.com');
      if (returnJSON && !creds.useResponsesAPI && isDirectOpenAI) {
        requestBody.response_format = { type: 'json_object' };
      }

      // Log actual request params sent to API — visible in browser console + audit
      const _reqParams = {
        model: requestBody.model,
        max_tokens: requestBody.max_tokens || requestBody.max_output_tokens || null,
        reasoning: requestBody.reasoning_effort || requestBody.reasoning?.effort || null,
        temperature: requestBody.temperature ?? null,
        json_mode: !!requestBody.response_format,
        endpoint: creds.apiEndpoint?.slice(0, 80),
      };
      console.log(`%c[API→] ${_reqParams.model}  max_tokens=${_reqParams.max_tokens}  reasoning=${_reqParams.reasoning}  temp=${_reqParams.temperature}  json=${_reqParams.json_mode}`, 'color:#6a9fb5');
      // Expose for audit log consumers
      agentChat._lastRequestParams = _reqParams;
      _apiState.lastRequestParams = _reqParams;

      // Retry on transient 5xx errors (NOT 429 — rate limit should fail fast).
      // Each attempt goes through the concurrency semaphore.
      const AGENT_MAX_RETRIES = 2;
      const AGENT_RETRY_BASE = 2000;
      let lastAgentErr = null;

      for (let attempt = 0; attempt <= AGENT_MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const jitter = Math.random() * 0.5;
          const delay = Math.round(AGENT_RETRY_BASE * attempt * (1 + jitter));
          console.log(`[agentChat] Retry ${attempt}/${AGENT_MAX_RETRIES} after ${delay}ms (jittered)...`);
          await new Promise(r => setTimeout(r, delay));
        }

        await _acquireApiSlot();
        try {
          let response;
          try {
            response = await fetch(creds.apiEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(requestBody),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const errMsg = error.error?.message || `API error: ${response.status}`;
            // 429 = rate limited — fail immediately
            if (response.status === 429) {
              const rateLimitErr = new Error(errMsg);
              rateLimitErr.isRateLimit = true;
              throw rateLimitErr;
            }
            // 5xx = transient — retry
            if (response.status >= 500 && attempt < AGENT_MAX_RETRIES) {
              console.warn(`[agentChat] ${response.status} error (attempt ${attempt + 1}):`, errMsg.slice(0, 200));
              lastAgentErr = new Error(errMsg);
              continue;
            }
            throw new Error(errMsg);
          }

          const data = await response.json();
          content = parseAPIResponseContent(data, creds);
          break; // Success — exit retry loop
        } catch (fetchErr) {
          if (fetchErr.isRateLimit) throw fetchErr;
          if (fetchErr.message?.includes('API error:')) throw fetchErr;
          // Connection error — retry if attempts remain
          console.warn(`[agentChat] Connection error (attempt ${attempt + 1}):`, fetchErr.message);
          lastAgentErr = fetchErr;
          if (attempt >= AGENT_MAX_RETRIES) break;
        } finally {
          _releaseApiSlot();
        }
      }

      if (!content && lastAgentErr) throw lastAgentErr;
    }

    // Parse JSON if requested
    if (returnJSON && content) {
      try {
        // First try direct parse (cleanest case)
        return JSON.parse(content.trim());
      } catch {
        // Try to extract JSON from response with extra text
        try {
          // Find the first { and last matching } using brace counting
          const startIdx = content.indexOf('{');
          if (startIdx !== -1) {
            let braceCount = 0;
            let endIdx = -1;
            for (let i = startIdx; i < content.length; i++) {
              if (content[i] === '{') braceCount++;
              if (content[i] === '}') braceCount--;
              if (braceCount === 0) {
                endIdx = i;
                break;
              }
            }
            if (endIdx !== -1) {
              const jsonStr = content.slice(startIdx, endIdx + 1);
              return JSON.parse(jsonStr);
            }
          }
        } catch (extractError) {
          console.warn('[agentChat] JSON extraction failed:', extractError.message);
        }
        console.warn('[agentChat] Could not parse JSON, returning null');
        return null;
      }
    }

    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`API call timed out after ${Math.round(timeout / 1000)}s`);
    }
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * Perform a web search using the configured search endpoint.
 * Uses the /responses API with web_search_preview tool.
 *
 * @param {string} query - The search query
 * @param {Object} settings - API settings (must have search config)
 * @returns {Promise<string>} The search result text
 */
export async function webSearch(query, settings) {
  // Check if search is enabled and configured
  if (!settings.searchEnabled) {
    console.log('[webSearch] Search is disabled');
    return null;
  }

  if (!settings.searchEndpoint || !settings.searchApiKey || !settings.searchModel) {
    // Custom search endpoint not configured — this is normal when using built-in Gemini/GPT search.
    // Only the custom "Agent Research" search endpoint needs these fields.
    console.log('[webSearch] Custom search endpoint not configured (searchEndpoint/searchApiKey/searchModel) — skipping.');
    return null;
  }

  try {
    const requestBody = {
      model: settings.searchModel,
      input: query,
      tools: [
        {
          type: 'web_search_preview',
          search_context_size: settings.searchContextSize || 'medium',
        },
      ],
      max_output_tokens: settings.searchMaxTokens || 128000,
    };

    console.log('[webSearch] Searching:', query.substring(0, 100) + '...');

    const headers = { 'Content-Type': 'application/json' };
    const isServerProxy = settings.searchApiKey === 'server-managed' || (settings.searchEndpoint || '').startsWith('/api/');
    if (!isServerProxy) {
      if (settings.searchAuthHeader === 'bearer') {
        headers['Authorization'] = `Bearer ${settings.searchApiKey}`;
      } else {
        headers['api-key'] = settings.searchApiKey;
      }
    }

    const response = await fetch(settings.searchEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[webSearch] API error:', error);
      throw new Error(error.error?.message || `Search API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract text from response - /responses API format
    // Response structure: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
    let resultText = '';

    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.text) {
              resultText += content.text + '\n';
            }
          }
        }
      }
    }

    console.log('[webSearch] Got result:', resultText.substring(0, 200) + '...');
    return resultText.trim() || null;

  } catch (error) {
    console.error('[webSearch] Error:', error.message);
    // Don't throw - just return null so agent can continue without search
    return null;
  }
}

/**
 * Perform research using the search endpoint — search + analysis in ONE call.
 * Sends the full worker prompt to the search endpoint with web_search_preview tool,
 * so the model searches the web AND produces analysis in a single API call.
 * This is the same endpoint used by slide creation's web search.
 *
 * @param {string} fullPrompt - The complete worker research prompt (persona + task + instructions)
 * @param {Object} settings - API settings (must have searchEndpoint, searchApiKey, searchModel)
 * @returns {Promise<string|null>} The model's full research response, or null if not configured
 */
export async function researchWithSearch(fullPrompt, settings) {
  if (!settings.searchEndpoint || !settings.searchApiKey || !settings.searchModel) {
    console.log('[researchWithSearch] Search endpoint not configured — falling back to standard LLM');
    return null;
  }

  try {
    const requestBody = {
      model: settings.searchModel,
      input: fullPrompt,
      tools: [
        {
          type: 'web_search_preview',
          search_context_size: settings.searchContextSize || 'medium',
        },
      ],
      max_output_tokens: settings.searchMaxTokens || 128000,
    };

    console.log('[researchWithSearch] Sending full research prompt to search endpoint...');

    const headers = { 'Content-Type': 'application/json' };
    const isServerProxy = settings.searchApiKey === 'server-managed' || (settings.searchEndpoint || '').startsWith('/api/');
    if (!isServerProxy) {
      if (settings.searchAuthHeader === 'bearer') {
        headers['Authorization'] = `Bearer ${settings.searchApiKey}`;
      } else {
        headers['api-key'] = settings.searchApiKey;
      }
    }

    const response = await fetch(settings.searchEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[researchWithSearch] API error:', error);
      throw new Error(error.error?.message || `Search+Research API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract text from Responses API format
    // Response structure: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
    let resultText = '';

    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.text) {
              resultText += content.text + '\n';
            }
          }
        }
      }
    }

    const trimmed = resultText.trim();
    console.log('[researchWithSearch] Got research result:', trimmed.substring(0, 200) + '...');
    return trimmed || null;

  } catch (error) {
    console.error('[researchWithSearch] Error:', error.message);
    // Don't throw — caller will fall back to standard _llm()
    return null;
  }
}

/**
 * Analyze content/documents deeply and create a structured plan for slide creation.
 * This is the "deep thinking" step that processes documents before creating slides.
 * Uses the main model (not fast model) for comprehensive analysis.
 *
 * @param {string} instruction - What the user wants to do with the content
 * @param {string} documentContent - Full text content from uploaded documents
 * @param {Object} settings - API settings
 * @param {Object} options - Additional options like storyline context
 * @returns {Promise<Object>} Analysis result with structured content plan
 */
export async function analyzeContentForSlides(instruction, documentContent, settings, options = {}) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const { storyline = null, slideCount = null } = options;

  // Clear prompt about the relationship between request and document
  const systemPrompt = `The user provides a REQUEST and SOURCE MATERIAL.
Create slides that fulfill the REQUEST using content FROM the source material.

IMPORTANT: Create the actual output - not slides about HOW you're creating it.
- If asked to "summarize" → create summary slides with actual summary content
- If asked to "create a proposal" → create proposal slides with actual proposal content
- NEVER create slides like "How we summarized" or "Our methodology"

Return JSON:
{"slides":[{"slideNumber":1,"title":"...","content":{"headline":"...","points":["..."]}}]}`;

  // User prompt - request first, then source material
  const userPrompt = `REQUEST: ${instruction}

SOURCE MATERIAL:
${documentContent}`;

  try {
    // Use deep analysis model if configured, otherwise fall back to main model
    const analysisModelRef = settings.deepAnalysisModel || settings.model;
    const analysisReasoningEffort = settings.deepAnalysisReasoningEffort || 'medium';

    // Create settings for the analysis call with reasoning effort
    const analysisSettings = {
      ...settings,
      model: analysisModelRef,
      reasoningEffort: analysisReasoningEffort,
      maxTokens: 8192, // Allow longer responses for detailed analysis
    };

    // Get credentials for the analysis model
    const analysisCreds = getCredentials(analysisSettings);

    console.log('[AnalyzeContent] Starting deep content analysis...', {
      model: analysisModelRef,
      reasoningEffort: analysisReasoningEffort,
    });
    debugLog(LogLevel.INFO, 'analyzeContentForSlides', 'Starting analysis', {
      model: analysisModelRef,
      reasoningEffort: analysisReasoningEffort,
      instructionLength: instruction.length,
      documentLength: documentContent.length,
    });

    let analysis;

    analysis = await callGeminiAPI(analysisSettings, systemPrompt, userPrompt);

    console.log('[AnalyzeContent] Analysis complete, length:', analysis.length);

    // Parse JSON from response (handle markdown code blocks)
    let parsedAnalysis = null;
    try {
      let cleanResponse = analysis;
      if (analysis.includes('```json')) {
        cleanResponse = analysis.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (analysis.includes('```')) {
        cleanResponse = analysis.replace(/```\s*/g, '');
      }

      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedAnalysis = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('[AnalyzeContent] Could not parse JSON, using raw analysis:', parseError.message);
    }

    debugLog(LogLevel.INFO, 'analyzeContentForSlides', 'Analysis complete', {
      analysisLength: analysis.length,
      parsedSlides: parsedAnalysis?.slides?.length || 0,
    });

    return {
      analysis,  // Raw text response
      parsed: parsedAnalysis,  // Structured JSON if available
      slides: parsedAnalysis?.slides || [],  // Array of slide specs
      summary: parsedAnalysis?.summary || '',
      totalSlides: parsedAnalysis?.totalSlides || parsedAnalysis?.slides?.length || 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[AnalyzeContent] Error:', error);
    debugLog(LogLevel.ERROR, 'analyzeContentForSlides', 'Analysis failed', {
      error: error.message,
    });
    throw error;
  }
}

// AI-powered context assessment: determine what context is needed for a request
// This is a lightweight call to optimize context passing
// Fast rule-based context assessment - NO API call needed
export function assessContextNeeds(userRequest, deckState) {
  const request = userRequest.toLowerCase();

  // Default: minimal context
  const result = {
    includeStoryline: false,
    storylineDetail: 'compact',
    includeSlideContent: false,
    slideContentScope: 'none',
    reasoning: 'default',
  };

  // Check for storyline-related keywords
  if (/storyline|narrative|story\s*points|populate.*from|fill.*skeleton/i.test(request)) {
    result.includeStoryline = true;
    result.storylineDetail = 'full';
    result.reasoning = 'storyline keywords detected';
  }

  // Check for deck-wide operations
  if (/summarize.*deck|overview|exec.*summary|all\s*slides|entire\s*deck|whole\s*deck/i.test(request)) {
    result.includeSlideContent = true;
    result.slideContentScope = 'all';
    result.reasoning = 'deck-wide operation';
    return result;
  }

  // Check for current slide operations
  if (/this\s*slide|current\s*slide|uplift|improve|fix|change|edit|update|make\s*it/i.test(request)) {
    result.includeSlideContent = true;
    result.slideContentScope = 'current';
    result.reasoning = 'current slide edit';
    return result;
  }

  // Check for referenced slides
  if (/like\s*slide|match\s*slide|similar\s*to|copy.*slide|based\s*on\s*slide/i.test(request)) {
    result.includeSlideContent = true;
    result.slideContentScope = 'referenced';
    result.reasoning = 'references other slides';
    return result;
  }

  // Check for specific slide mentions
  if (/slide\s*#?\d+|first\s*slide|last\s*slide|previous\s*slide|next\s*slide/i.test(request)) {
    result.includeSlideContent = true;
    result.slideContentScope = 'referenced';
    result.reasoning = 'specific slide mentioned';
    return result;
  }

  return result;
}

// Create an execution plan for agent mode
export async function createAgentExecutionPlan(userRequest, context, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // LEAN CONTEXT: Pre-computed summaries, no slide/storyline arrays
  const {
    slideCount = 0,
    currentSlideIndex = -1,
    currentSlideTitle = null,
    layoutSummary = '',      // e.g., "bullets:3, cards:2, dashboard:1"
    storylineSummary = '',   // e.g., "Intro → Problem → Solution → Results"
    hasSkeletons = false,
  } = context;

  // LEAN ROUTER: Minimal context for fast intent classification
  const systemPrompt = `${LEAN_ROUTER_PROMPT}

CONTEXT: ${slideCount} slides, current=${currentSlideIndex + 1}${currentSlideTitle ? ` "${currentSlideTitle}"` : ''}, storyline=${storylineSummary ? 'yes' : 'no'}, skeletons=${hasSkeletons ? 'pending' : 'no'}`;

  // LEAN USER PROMPT: Just request + pre-computed summaries
  const userPrompt = `${userRequest}

DECK: ${slideCount} slides${currentSlideIndex >= 0 ? `, viewing slide ${currentSlideIndex + 1}` : ''}
${layoutSummary ? `LAYOUTS USED: ${layoutSummary}` : ''}
${storylineSummary ? `STORYLINE: ${storylineSummary}` : ''}

Return JSON only.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Parse JSON with repair for common AI response issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const plan = safeJSONParse(content, 'Agent Execution Plan');

    return {
      understanding: plan.understanding || 'Processing request',
      steps: plan.steps || [],
      estimatedSlides: plan.estimatedSlides || 0,
      requiresApproval: plan.requiresApproval || false,
      contextStrategy: plan.contextStrategy || null,
    };
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    // Return a fallback plan for parsing errors
    console.warn('Failed to parse execution plan:', error);
    return {
      understanding: 'Processing your request',
      steps: [{ action: 'answer_question', description: 'Handling request', params: {} }],
      estimatedSlides: 0,
      requiresApproval: false,
      contextStrategy: null,
    };
  }
}

// Export planning guidelines summary for transparency in approval dialogs
export function getAgentPlanningGuidelines() {
  return `You are an intelligent AI agent for creating and editing slide presentations.
You have access to TOOLS that let you create, edit, and manage slides. Think step by step.

AVAILABLE TOOLS:

📝 EDITING TOOLS:
1. "edit_slide" - Edit the current slide (or specific slide)
2. "edit_all" - Edit all slides with same instruction

➕ CREATION TOOLS:
3. "create_slide" - Create a single new slide (adds at end)
4. "insert_slide_at" - Insert slide at specific position
5. "create_slides_batch" - Create multiple slides at once
6. "add_separator" - Add a section separator/divider slide
7. "create_from_template" - Create slide using a specific template
8. "switch_template" - Change existing slide to a different template/layout

🔄 REORDERING TOOLS:
8. "move_slide" - Move a slide to a different position

📋 TEMPLATE TOOLS:
6. "find_template" - Search for best matching template
7. "list_templates" - Show available templates to user

📖 STORYLINE TOOLS:
8. "generate_storyline" - Create narrative structure for presentation
9. "generate_skeletons" - Create skeleton slides from storyline
10. "populate_slides" - Fill slides with actual content

IMPORTANT RULES:
- DISTINGUISH CREATE vs EDIT:
  - CREATE intent: "create", "add", "make", "generate", "new slide" → use create_slide
  - EDIT intent: "change", "update", "fix", "modify", "edit" → use edit_slide
- For edits: "slide 2" → slideIndex: 1 (0-based)
- Chain tools when needed: find_template → create_from_template
- For multi-slide requests, use create_slides_batch

DECK CREATION GUIDELINES:
- If user asks for a "deck" without specifying count: default to 10-12 slides max
- Think like a consultant: PYRAMID structure (lead with answer, support with evidence)
- MECE: Mutually Exclusive, Collectively Exhaustive (no overlaps, no gaps)
- If presenting 3 pillars/phases in depth: 1 overview + 3 detail slides = 4 slides minimum
- Story flow: Each slide should connect logically to the next
- Structure depends on deck size:
  - Large decks (7+ slides): Cover → Executive Summary (3-5 key themes) → Body slides (grouped logically) → Closing
  - Small decks (≤6 slides): Cover → Body slides → Closing (no exec summary needed)
  - Adapt the body structure to the request — do NOT default to a proposal format (problem/solution/next steps) unless the user explicitly asks for one.
- Executive Summary: if included, ONE slide (executiveSummary template) with 2-5 themed sections. This is the ONLY overview/summary slide — never add a second one.

TEMPLATE PRESERVATION (CRITICAL):
- When editing, PRESERVE the existing HTML structure/template
- Only change text content, NOT layout or structure
- "edit" means content change within same template
- To change template/layout, user must EXPLICITLY ask

LAYOUT SELECTION - USER INSTRUCTIONS TAKE PRIORITY:
- If user describes a SPECIFIC layout (boxes, columns, stacked, split, grid, counts), use FREESTYLE
- Freestyle triggers: "2 boxes left, 3 on right", "split layout", "4 cards", custom layout descriptions
- User layout instructions override template matching
- Template matching only when user describes content without layout details
- Freestyle uses component guide (cards, KPIs, splits, grids, bullets, quotes, etc.)`;
}
