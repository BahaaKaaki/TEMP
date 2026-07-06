import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import {
  stripProviderPrefix, isGeminiModel, isGemini3Model, isGemini25Model,
  isReasoningModel, omitChatCompletionsTemperature, mapReasoningToThinkingBudget, mapReasoningToThinkingLevel,
  extractGeminiResponseText, parseModelRef, findProvider, getCredentials,
  buildProviderHeaders, buildGeminiEndpoint, buildGeminiHeaders,
} from './models.js';
// authFetch attaches an Entra ID token on same-origin /api/ calls and is a
// passthrough for third-party provider URLs, so it's safe to swap in here.
import { authFetch } from '../authFetch.js';

// Shared mutable state for the last API request params (used by audit logging)
export const _apiState = { lastRequestParams: null };

// Attach an optional router-only consulting-skill marker to an outgoing request
// body. The backend AI proxy reads `_skillId`, prepends the matching skill's
// markdown + clarify rule to the system prompt, and strips the field before
// forwarding to the upstream model.
//
// Guard: only attach when the request is actually going through our PwC proxy
// (identified by `authType === 'server'` or an `/api/ai/` endpoint). Direct
// provider calls (OpenAI, Anthropic, Gemini) would reject `_skillId` as an
// unknown field and have no way to process it anyway.
export function attachSkillIdToBody(body, settings, creds) {
  if (!body || typeof body !== 'object') return body;
  const rawId = settings?._skillId;
  const skillId = typeof rawId === 'string' && rawId.trim() ? rawId.trim() : null;
  if (!skillId) return body;

  const endpoint = creds?.apiEndpoint || '';
  const goesThroughProxy = creds?.authType === 'server' || endpoint.startsWith('/api/ai/');
  if (!goesThroughProxy) return body;

  body._skillId = skillId;
  return body;
}

/**
 * Call router with images - multimodal API call
 * Analyzes images with the user's query context
 */
export async function callRouterWithImages(settings, systemPrompt, contextInfo, images, opts = {}) {
  const creds = getCredentials(settings);
  const { maxTokens = 4096 } = settings;

  console.log('[callRouterWithImages] Starting with', images.length, 'image(s), provider:', creds.provider, 'model:', creds.rawModel);

  // For images, prefer OpenAI/GPT-4o as it has better vision
  // But use whatever model is configured
  const provider = settings.providers?.find(p => p.id === creds.provider);
  if (!provider?.apiKey) {
    console.error('[callRouterWithImages] No API key for provider:', creds.provider);
    throw new Error(`No API key configured for "${creds.provider}" provider. Please add it in Settings to use image analysis.`);
  }

  // Build image content parts
  const imageContent = images.map(img => {
    // Extract base64 and mime type from data URL
    const matches = (img.imageData || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.warn('[callRouterWithImages] Invalid image data format');
      return null;
    }
    const [, mimeType, base64] = matches;

    if (creds.isGeminiProvider) {
      return {
        inline_data: {
          mime_type: mimeType,
          data: base64,
        },
      };
    } else {
      return {
        type: 'image_url',
        image_url: {
          url: img.imageData, // Full data URL
          detail: 'high',
        },
      };
    }
  }).filter(Boolean);

  if (imageContent.length === 0) {
    // Fallback to text-only if images couldn't be processed
    return callWithModelFallback(settings, systemPrompt, contextInfo, { role: 'text' });
  }

  // Build the prompt with image context
  const imagePrompt = `You are viewing ${images.length} image(s) attached by the user.
Analyze the image(s) in context of the user's request below.

${contextInfo}

IMPORTANT - DETAILED IMAGE ANALYSIS:
When the image shows a slide/presentation to recreate:
- Create exactly ONE slide that mimics it
- In your instruction, describe ALL visual details:
  * Exact text content (titles, bullets, labels)
  * Font sizes (large title, medium subtitle, small body)
  * Font colors (e.g., "dark blue title #1e3a5f", "gray text #6b7280")
  * Background color or gradient
  * Layout structure (centered, left-aligned, columns, cards)
  * Spacing and margins (tight, spacious)
  * Any icons, shapes, or decorative elements
  * Charts/diagrams structure if present
- Use position: "start" for title/cover slides, "end" for content slides
- Do NOT create multiple slides from a single slide image`;

  if (creds.isGeminiProvider) {
    // Gemini format
    const endpoint = buildGeminiEndpoint(creds);
    const routerModelName = creds.rawModel || creds.model;
    const requestBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: imagePrompt },
            ...imageContent,
          ],
        },
      ],
      generationConfig: {
        temperature: settings.temperature || 0.1,
        maxOutputTokens: maxTokens,
        topP: 0.95,
      },
    };

    // Add thinkingConfig for Gemini thinking models in router
    const routerReasoning = settings.reasoningEffort || 'low';
    if (isGemini3Model(routerModelName)) {
      const thinkingLevel = mapReasoningToThinkingLevel(routerReasoning, routerModelName);
      if (thinkingLevel) {
        requestBody.generationConfig.thinkingConfig = { thinkingLevel };
      }
    } else if (isGemini25Model(routerModelName)) {
      const thinkingBudget = mapReasoningToThinkingBudget(routerReasoning);
      requestBody.generationConfig.thinkingConfig = { thinkingBudget };
    }

    attachSkillIdToBody(requestBody, settings, creds);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildGeminiHeaders(creds),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return extractGeminiResponseText(data.candidates?.[0]?.content?.parts);
  } else {
    // OpenAI format — use creds (normalised endpoint/auth) not raw provider
    const headers = buildProviderHeaders(creds);

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: imagePrompt },
          ...imageContent,
        ],
      },
    ];

    const requestBody = {
      model: creds.model,
      messages,
      max_tokens: maxTokens,
      temperature: settings.temperature || 0.1,
    };

    attachSkillIdToBody(requestBody, settings, creds);

    const response = await authFetch(creds.apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

// ─── Global concurrency semaphore ───────────────────────────────────────────
// Caps the number of simultaneous API calls across the entire app (all users
// in the same browser tab, all paths: router, slide creation, agent, etc.).
// Prevents overwhelming the LiteLLM proxy / upstream API with too many
// concurrent connections, which causes "Connection error" on model groups.
let _apiMaxConcurrent = 5;
let _apiActiveCount = 0;
const _apiWaitQueue = [];

// Allow settings to update the concurrency cap at runtime
export function setApiMaxConcurrent(n) {
  _apiMaxConcurrent = Math.max(1, Math.min(50, n || 5));
  // If cap increased, drain queued waiters
  while (_apiWaitQueue.length > 0 && _apiActiveCount < _apiMaxConcurrent) {
    _apiActiveCount++;
    _apiWaitQueue.shift()();
  }
}

export function _acquireApiSlot() {
  if (_apiActiveCount < _apiMaxConcurrent) {
    _apiActiveCount++;
    return Promise.resolve();
  }
  // Queue this caller until a slot frees up
  return new Promise(resolve => _apiWaitQueue.push(resolve));
}

export function _releaseApiSlot() {
  if (_apiWaitQueue.length > 0) {
    // Wake the next waiter (slot stays occupied)
    const next = _apiWaitQueue.shift();
    next();
  } else {
    _apiActiveCount--;
  }
}

// Call Gemini API with proper format (handles all providers despite the name)
export async function callGeminiAPI(settings, systemPrompt, userPrompt, opts = {}) {
  // Acquire a concurrency slot (blocks if API_MAX_CONCURRENT already in flight)
  await _acquireApiSlot();
  try {
    return await _callGeminiAPIInner(settings, systemPrompt, userPrompt, opts);
  } finally {
    _releaseApiSlot();
  }
}

async function _callGeminiAPIInner(settings, systemPrompt, userPrompt, opts = {}) {
  const creds = getCredentials(settings);
  const { maxTokens } = settings;
  delete settings._routerSearchGroundingDebug;

  // Non-Gemini provider: use buildRequestBody (handles Responses API for GPT-5.x)
  if (!creds.isGeminiProvider) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    const requestBody = buildRequestBody(settings, messages);

    const headers = buildProviderHeaders(creds);

    console.log('[callGeminiAPI/non-Gemini] FETCH →', {
      endpoint: creds.apiEndpoint,
      model: creds.model,
      useResponsesAPI: creds.useResponsesAPI,
      bodyModel: requestBody.model,
      authType: headers['api-key'] ? 'api-key' : headers['x-api-key'] ? 'x-api-key' : 'Bearer',
      tools: requestBody.tools || 'none',
    });

    // Retry on transient connection / 5xx errors (NOT 429 — rate limits should fail fast)
    const MAX_RETRIES = 3;
    const BASE_DELAYS = [2000, 4000, 8000];
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Add random jitter (0-50%) to avoid thundering herd when multiple users retry simultaneously
          const jitter = Math.random() * 0.5;
          const delay = Math.round(BASE_DELAYS[attempt - 1] * (1 + jitter));
          console.log(`[callGeminiAPI/non-Gemini] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms (jittered)...`);
          await new Promise(r => setTimeout(r, delay));
        }

        const response = await authFetch(creds.apiEndpoint, {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: JSON.stringify(requestBody),
          ...(opts.signal ? { signal: opts.signal } : {}),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          const errMsg = error.error?.message || `API error: ${response.status}`;
          // 429 = rate limited — fail immediately, retrying would worsen congestion for all users
          if (response.status === 429) {
            const rateLimitErr = new Error(errMsg);
            rateLimitErr.isRateLimit = true;
            rateLimitErr.status = 429;
            console.warn(`[callGeminiAPI/non-Gemini] 429 rate limited — failing fast (no retry):`, errMsg.slice(0, 200));
            throw rateLimitErr;
          }
          if (response.status >= 500) {
            console.warn(`[callGeminiAPI/non-Gemini] ${response.status} error (attempt ${attempt + 1}):`, errMsg.slice(0, 300));
            lastError = new Error(errMsg);
            lastError.status = response.status;
            continue;
          }
          throw new Error(errMsg);
        }
        const data = await response.json();
        console.log('[callGeminiAPI/non-Gemini] Response status:', data.status || 'ok',
          'model:', creds.model, 'useResponsesAPI:', creds.useResponsesAPI);
        const vGroundAll = data.vertex_ai_grounding_metadata || [];
        const allQueries = vGroundAll.flatMap(g => g.webSearchQueries || []);
        if (allQueries.length > 0) {
          console.log('%c[Web Search] CONFIRMED — %d queries executed', 'color:#059669; font-weight:bold', allQueries.length, allQueries);
        } else if (requestBody.tools?.length > 0) {
          console.warn('[Web Search] tools were sent but no grounding metadata in response');
        }
        const content = parseAPIResponseContent(data, creds);
        if (!content || content.trim() === '') {
          console.warn('[callGeminiAPI/non-Gemini] Empty content from', creds.model,
            'Response keys:', Object.keys(data),
            'output length:', data.output?.length || 0,
            'output_text:', data.output_text ? 'present' : 'absent',
            'choices:', data.choices?.length || 0);
        }
        if (settings._extraTools?.length > 0) {
          const urls = vGroundAll.flatMap(g =>
            (g.groundingChunks || []).map(c => c.web?.uri || c.retrievedContext?.uri).filter(Boolean)
          );
          settings._routerSearchGroundingDebug = {
            provider: creds.provider,
            groundingReceived: vGroundAll.length > 0,
            searchQueriesFromMetadata: allQueries,
            sourceUrls: [...new Set(urls)].slice(0, 25),
          };
        }
        return content;
      } catch (fetchErr) {
        if (fetchErr.isRateLimit || fetchErr.message?.includes('API error:')) throw fetchErr;
        console.warn(`[callGeminiAPI/non-Gemini] Connection error (attempt ${attempt + 1}):`, fetchErr.message);
        lastError = fetchErr;
        if (attempt >= MAX_RETRIES) break;
      }
    }
    // Provide a clearer error for connection failures (DNS, network, VPN)
    const endpoint = creds.apiEndpoint || '(unknown)';
    const hostMatch = endpoint.match(/\/\/([^/]+)/);
    const host = hostMatch ? hostMatch[1] : endpoint;
    const modelLabel = creds.model || '(unknown model)';
    const connErr = new Error(
      lastError?.status >= 500
        ? `Server error ${lastError.status} from ${host} (model: ${modelLabel}) after ${MAX_RETRIES + 1} attempts. The API server may be temporarily unavailable.`
        : `Could not connect to ${host} (model: ${modelLabel}). Check your network connection, VPN, and that the endpoint URL is correct. (${lastError?.message || 'unknown error'})`
    );
    connErr.status = lastError?.status;
    throw connErr;
  }

  const endpoint = buildGeminiEndpoint(creds);
  const modelName = creds.rawModel || creds.model;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: maxTokens || 8192,
      temperature: settings.temperature || 0.7,
      topP: 0.95,
    }
  };

  // Add thinkingConfig for Gemini thinking models
  // Resolve reasoning effort: explicit setting → default 'low' for thinking models
  const effectiveReasoning = settings.reasoningEffort || 'low';
  if (isGemini3Model(modelName)) {
    const thinkingLevel = mapReasoningToThinkingLevel(effectiveReasoning, modelName);
    if (thinkingLevel) {
      body.generationConfig.thinkingConfig = {
        thinkingLevel,
      };
    }
  } else if (isGemini25Model(modelName)) {
    const thinkingBudget = mapReasoningToThinkingBudget(effectiveReasoning);
    body.generationConfig.thinkingConfig = { thinkingBudget };
  }

  // Add extra tools if caller requested (e.g., router with web search)
  if (settings._extraTools?.length > 0) {
    // For Gemini, map web_search_preview → googleSearch grounding
    body.tools = settings._extraTools.map(t =>
      t.type === 'web_search_preview' ? { googleSearch: {} } : t
    );
  }

  // Log Gemini request params — same format as non-Gemini [API→] log
  const _geminiReqParams = {
    model: modelName,
    max_tokens: body.generationConfig.maxOutputTokens || null,
    reasoning: effectiveReasoning,
    thinkingConfig: body.generationConfig.thinkingConfig || null,
    temperature: body.generationConfig.temperature ?? null,
    endpoint: endpoint?.slice(0, 80),
  };
  console.log(`%c[API→] ${_geminiReqParams.model}  max_tokens=${_geminiReqParams.max_tokens}  reasoning=${_geminiReqParams.reasoning}  thinkingConfig=${JSON.stringify(_geminiReqParams.thinkingConfig)}  temp=${_geminiReqParams.temperature}  tools=${JSON.stringify(body.tools || 'none')}`, 'color:#6a9fb5');
  // Expose for audit log consumers (same as non-Gemini path)
  _apiState.lastRequestParams = _geminiReqParams;

  // Retry on transient network / 5xx errors (mirrors non-Gemini retry logic above)
  const GEMINI_MAX_RETRIES = 3;
  const GEMINI_BASE_DELAYS = [2000, 4000, 8000];
  let lastGeminiError = null;
  let response;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const jitter = Math.random() * 0.5;
        const delay = Math.round(GEMINI_BASE_DELAYS[attempt - 1] * (1 + jitter));
        console.log(`[callGeminiAPI/Gemini] Retry ${attempt}/${GEMINI_MAX_RETRIES} after ${delay}ms (jittered)...`);
        await new Promise(r => setTimeout(r, delay));
      }

      response = await fetch(endpoint, {
        method: 'POST',
        headers: buildGeminiHeaders(creds),
        body: JSON.stringify(body),
        ...(opts.signal ? { signal: opts.signal } : {}),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errMsg = error.error?.message || `Gemini API error: ${response.status}`;
        // 429 = rate limited — fail immediately
        if (response.status === 429) {
          const rateLimitErr = new Error(errMsg);
          rateLimitErr.isRateLimit = true;
          console.warn(`[callGeminiAPI/Gemini] 429 rate limited — failing fast (no retry):`, errMsg.slice(0, 200));
          throw rateLimitErr;
        }
        if (response.status >= 500) {
          console.warn(`[callGeminiAPI/Gemini] ${response.status} error (attempt ${attempt + 1}):`, errMsg.slice(0, 300));
          lastGeminiError = new Error(errMsg);
          lastGeminiError.status = response.status;
          continue;
        }
        throw new Error(errMsg);
      }

      // Success — break out of retry loop
      break;
    } catch (fetchErr) {
      if (fetchErr.isRateLimit) throw fetchErr;
      if (fetchErr.message?.includes('Gemini API error:')) throw fetchErr;
      // Network / connection error — retry if attempts remain
      console.warn(`[callGeminiAPI/Gemini] Network error (attempt ${attempt + 1}):`, fetchErr.message);
      lastGeminiError = fetchErr;
      if (attempt >= GEMINI_MAX_RETRIES) break;
    }
  }

  if (!response || !response.ok) {
    const hostMatch = endpoint.match(/\/\/([^/]+)/);
    const host = hostMatch ? hostMatch[1] : endpoint;
    const connErr = new Error(
      lastGeminiError?.status >= 500
        ? `Server error ${lastGeminiError.status} from ${host} after ${GEMINI_MAX_RETRIES + 1} attempts. The Gemini API may be temporarily unavailable.`
        : `Could not connect to ${host}. Check your network connection and API key. (${lastGeminiError?.message || 'unknown error'})`
    );
    connErr.status = lastGeminiError?.status;
    throw connErr;
  }

  const data = await response.json();
  console.log('[Gemini API] Full response data:', JSON.stringify(data, null, 2));

  // Log token usage breakdown
  const usage = data.usageMetadata;
  if (usage) {
    console.log('[Gemini API] Token usage:', {
      promptTokens: usage.promptTokenCount,
      thinkingTokens: usage.thoughtsTokenCount || 0,
      outputTokens: usage.candidatesTokenCount,
      total: usage.totalTokenCount,
    });
  }

  // Check prompt-level blocking FIRST (before looking at candidates)
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) {
    console.error('[Gemini API] Prompt blocked:', blockReason, data.promptFeedback);
    throw new Error(`Gemini blocked the request (reason: ${blockReason}). Try rephrasing or using a different model.`);
  }

  const candidate = data.candidates?.[0];
  const grounding = candidate?.groundingMetadata || data.vertex_ai_grounding_metadata?.[0];
  if (grounding) {
    console.log('%c[Gemini API] Web search CONFIRMED', 'color:#059669; font-weight:bold', {
      searchQueries: grounding.webSearchQueries || grounding.searchQueries,
    });
  } else if (body.tools?.some(t => t.googleSearch)) {
    console.warn('[Gemini API] googleSearch tool was sent but NO groundingMetadata in response — search may not have fired');
  }

  if (!candidate) {
    console.error('[Gemini API] No candidates in response:', JSON.stringify(data, null, 2));
    throw new Error('Gemini returned no candidates — the request may have been filtered. Try a different model.');
  }

  const content = extractGeminiResponseText(candidate?.content?.parts);
  const finishReason = candidate?.finishReason;

  // Throw on safety/block finish reasons instead of silently returning empty
  if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    console.warn('[Gemini API] Finish reason:', finishReason, '- Response blocked or filtered');
    if (!content || content.trim() === '') {
      throw new Error(`Gemini response blocked (finishReason: ${finishReason}). The content may have triggered safety filters. Try a different model or rephrase.`);
    }
  }

  // Log when response is empty for debugging (still possible with STOP/MAX_TOKENS)
  if (!content || content.trim() === '') {
    console.warn('[Gemini API] Empty content extracted. Candidate:', JSON.stringify(candidate, null, 2));
    console.warn('[Gemini API] Parts count:', candidate?.content?.parts?.length || 0,
      'Finish reason:', finishReason,
      'Block reason:', blockReason || 'none');
  }
  if (settings._extraTools?.length > 0) {
    const chunks = grounding?.groundingChunks || [];
    const urls = chunks.map(c => c.web?.uri).filter(Boolean);
    const qRaw = grounding?.webSearchQueries || grounding?.searchQueries;
    const searchQueriesFromMetadata = Array.isArray(qRaw) ? qRaw : qRaw ? [qRaw] : [];
    settings._routerSearchGroundingDebug = {
      provider: 'gemini',
      groundingReceived: !!grounding,
      searchQueriesFromMetadata,
      sourceUrls: [...new Set(urls)].slice(0, 25),
    };
  }
  return content;
}

export function buildRequestBody(settings, messages) {
  const { temperature, maxTokens, reasoningEffort } = settings;
  const verbosity = settings.verbosity || null; // 'low'|'medium'|'high' or null
  // Get the actual model name to send to the API (strip providerId: prefix, apply azure. if needed)
  const creds = getCredentials(settings);
  const model = creds.model; // Already has azure. prefix if applicable

  // GPT-5.x on OpenAI uses the Responses API format
  if (creds.useResponsesAPI) {
    // Convert messages array to Responses API input format
    // System message becomes instructions, user/assistant become input items
    let instructions = '';
    const inputItems = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        instructions += (instructions ? '\n\n' : '') + msg.content;
      } else {
        inputItems.push({ role: msg.role, content: msg.content });
      }
    }
    // If only one user message with no assistant messages, use simple string input
    const input = inputItems.length === 1 && inputItems[0].role === 'user'
      ? inputItems[0].content
      : inputItems;

    const body = { model, input };
    if (instructions) body.instructions = instructions;

    // Reasoning effort (nested format for Responses API)
    if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') {
      body.reasoning = { effort: reasoningEffort };
    }

    // Temperature (only if not using reasoning); gpt-5.5 rejects non-default temperature
    if (!(isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none')) {
      if (!omitChatCompletionsTemperature(model) && temperature !== undefined && temperature !== null) {
        body.temperature = temperature;
      }
    }

    // Max output tokens (ensure integer for proxy compat)
    if (maxTokens) body.max_output_tokens = parseInt(maxTokens, 10) || maxTokens;

    // Text verbosity
    if (verbosity) body.text = { verbosity };

    // Extra tools (e.g., web_search_preview for router with search enabled)
    if (settings._extraTools?.length > 0) {
      body.tools = body.tools || [];
      for (const tool of settings._extraTools) {
        body.tools.push(tool);
      }
    }

    // Merge custom params from provider config
    if (creds.customParams && typeof creds.customParams === 'object') {
      Object.assign(body, creds.customParams);
    }

    attachSkillIdToBody(body, settings, creds);

    console.log('[buildRequestBody] Responses API →', {
      model: body.model,
      max_output_tokens: body.max_output_tokens,
      reasoning: body.reasoning,
      temperature: body.temperature,
      verbosity: body.text?.verbosity,
      instructionsLen: body.instructions?.length || 0,
      inputType: typeof body.input === 'string' ? 'string' : `array[${body.input?.length}]`,
      inputLen: typeof body.input === 'string' ? body.input.length : body.input?.reduce((s, m) => s + (m.content?.length || 0), 0),
      tools: body.tools?.length || 0,
      skillId: body._skillId || 'none',
    });
    return body;
  }

  // Anthropic Messages API (direct api.anthropic.com calls)
  // System message must be a top-level field, not in messages array.
  // Response format: { content: [{type: "text", text: "..."}] }
  if (creds.isAnthropicProvider) {
    let system = '';
    const anthropicMessages = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n\n' : '') + msg.content;
      } else {
        anthropicMessages.push({ role: msg.role, content: msg.content });
      }
    }
    const body = {
      model,
      messages: anthropicMessages,
      max_tokens: parseInt(maxTokens, 10) || 4096,
    };
    if (system) body.system = system;
    const noTemp = /claude-opus-4-[78]|claude-sonnet-4-6/i.test(model);
    if (!noTemp && temperature !== undefined && temperature !== null) body.temperature = temperature;

    // Merge custom params from provider config (e.g., budget_tokens for extended thinking)
    if (creds.customParams && typeof creds.customParams === 'object') {
      Object.assign(body, creds.customParams);
    }

    attachSkillIdToBody(body, settings, creds);

    console.log('[buildRequestBody] Anthropic Messages API →', {
      model: body.model,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      system_len: body.system?.length || 0,
      messageCount: body.messages?.length,
      totalInputChars: body.messages?.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : 0), 0),
      skillId: body._skillId || 'none',
    });
    return body;
  }

  // Non-Responses API (legacy chat completions for GPT-4, o1, etc.)
  const body = {
    model: model,
    messages: messages,
  };

  if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') {
    body.reasoning_effort = reasoningEffort;
  } else if (!omitChatCompletionsTemperature(model) && temperature !== undefined && temperature !== null) {
    body.temperature = temperature;
  }
  // Always send max_tokens — reasoning models need it too (ensure integer for proxy compat)
  if (maxTokens) body.max_tokens = parseInt(maxTokens, 10) || maxTokens;

  // Extra tools (e.g., web_search_preview for search-enabled slide creation)
  if (settings._extraTools?.length > 0) {
    body.tools = settings._extraTools;
  }

  // Merge custom params from provider config
  if (creds.customParams && typeof creds.customParams === 'object') {
    Object.assign(body, creds.customParams);
  }

  attachSkillIdToBody(body, settings, creds);

  console.log('[buildRequestBody] Chat Completions →', {
    model: body.model,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    reasoning_effort: body.reasoning_effort,
    messageCount: body.messages?.length,
    totalInputChars: body.messages?.reduce((s, m) => s + (m.content?.length || 0), 0),
    tools: body.tools?.length || 0,
    skillId: body._skillId || 'none',
  });
  return body;
}

// Parse API response — normalizes Responses API, Anthropic Messages, and Chat Completions formats
export function parseAPIResponseContent(data, creds) {
  if (creds?.useResponsesAPI) {
    // Responses API: output is an array of output items
    // Find the first message output item with text content
    const output = data.output || [];
    for (const item of output) {
      if (item.type === 'message' && item.content) {
        for (const part of item.content) {
          if (part.type === 'output_text' && part.text) return part.text;
          if (part.type === 'text' && part.text) return part.text;
        }
      }
    }
    // Fallback: check for direct text in output
    if (data.output_text) return data.output_text;
    return '';
  }
  // Anthropic Messages API: { content: [{ type: "text", text: "..." }] }
  if (creds?.isAnthropicProvider && data.content && Array.isArray(data.content)) {
    return data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n') || '';
  }
  // Chat Completions format
  return data.choices?.[0]?.message?.content || '';
}

// ─── Model fallback across provider's available models ────────────────────
// When a model fails (non-rate-limit), try other models from the same
// provider before giving up. Uses the live /api/ai/models list when available.

export function getFallbackModels(settings, providerId, failedModel, role) {
  let models = [];
  try {
    const cached = localStorage.getItem('pwc_fetched_models');
    if (cached) models = JSON.parse(cached);
  } catch (_) { /* ignore parse errors */ }

  if (!models.length) {
    const provider = findProvider(settings, providerId);
    models = provider?.models || [];
  }

  return models.filter(m => {
    if (m === failedModel) return false;
    if (role !== 'image' && m.includes('image')) return false;
    if (role === 'image' && !m.includes('image')) return false;
    return true;
  });
}

export async function callWithModelFallback(settings, systemPrompt, userPrompt, opts = {}) {
  const modelRef = settings.model;
  const { providerId, modelName } = parseModelRef(modelRef);

  try {
    return await callGeminiAPI(settings, systemPrompt, userPrompt, opts);
  } catch (err) {
    if (err.isRateLimit || err.name === 'AbortError') throw err;

    const fallbacks = getFallbackModels(settings, providerId, modelName, opts.role);
    if (fallbacks.length === 0) throw err;

    console.warn(`[ModelFallback] Primary model "${modelName}" failed: ${(err.message || String(err)).slice(0, 150)}`);

    for (const fallbackModel of fallbacks) {
      try {
        const ref = `${providerId}:${fallbackModel}`;
        console.log(`[ModelFallback] Trying fallback: ${ref}`);
        const fbSettings = { ...settings, model: ref };
        return await callGeminiAPI(fbSettings, systemPrompt, userPrompt, opts);
      } catch (fbErr) {
        if (fbErr.isRateLimit || fbErr.name === 'AbortError') throw fbErr;
        console.warn(`[ModelFallback] "${fallbackModel}" also failed: ${(fbErr.message || String(fbErr)).slice(0, 100)}`);
      }
    }
    throw err;
  }
}

// Helper to get settings for fast model calls (assessments, template selection)
export function getFastModelSettings(settings) {
  const fastModel = settings.fastModel || 'openai:gpt-5.4-nano';
  // If empty, use main model
  if (!fastModel) return { ...settings, temperature: 0.3, maxTokens: 200 };

  // Validate that the fast model's provider actually has an API key
  const { providerId } = parseModelRef(fastModel);
  const provider = findProvider(settings, providerId);
  if (!provider?.apiKey) {
    // Fast model provider has no key — fall back to main model
    console.warn(`[getFastModelSettings] No API key for fast model provider "${providerId}", falling back to main model`);
    return { ...settings, temperature: 0.3, maxTokens: 200 };
  }

  return {
    ...settings,
    model: fastModel,
    temperature: 0.3, // Lower temperature for more deterministic assessments
    maxTokens: 200, // Keep responses short
  };
}
