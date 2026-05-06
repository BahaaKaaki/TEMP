// Model detection, provider lookup, and credential resolution
import { debugLog, LogLevel } from '../../utils/debugLog';

// Strip "providerId:" prefix from model references like "openai:gpt-4o"
export function stripProviderPrefix(model) {
  if (!model) return model;
  const idx = model.indexOf(':');
  return idx === -1 ? model : model.slice(idx + 1);
}

// Pattern-based model detection -- covers current and future versions automatically
const _RE_GPT5 = /\bgpt-5/i;
const _RE_REASONING = /\b(gpt-5|o1|o3)\b/i;
const _RE_GEMINI = /\bgemini-/i;
const _RE_GEMINI3 = /\bgemini-3/i;
const _RE_GEMINI25 = /\bgemini-2\.5/i;

export function isReasoningModel(model) { return _RE_REASONING.test(stripProviderPrefix(model)); }
export function isGPT5Model(model) { return _RE_GPT5.test(stripProviderPrefix(model)); }

/**
 * LiteLLM / some gateways reject custom `temperature` for `gpt-5.5` (only the provider
 * default is accepted). Chat completions must omit `temperature` for these models.
 */
export function omitChatCompletionsTemperature(model) {
  return /\bgpt-5\.5\b/i.test(stripProviderPrefix(model || ''));
}
export function isGeminiModel(model) { return _RE_GEMINI.test(stripProviderPrefix(model)); }
export function isGemini3Model(model) { return _RE_GEMINI3.test(stripProviderPrefix(model)); }
export function isGemini25Model(model) { return _RE_GEMINI25.test(stripProviderPrefix(model)); }

// Map reasoningEffort setting to Gemini 2.5 thinkingBudget (integer token count)
// Without this, thinking tokens consume the maxOutputTokens budget, truncating actual output
export function mapReasoningToThinkingBudget(reasoningEffort) {
  switch ((reasoningEffort || '').toLowerCase()) {
    case 'none': return 0;
    case 'low': return 1024;
    case 'medium': return 8192;
    case 'high': return 24576;
    default: return 8192; // Reasonable default to prevent thinking from consuming output budget
  }
}

// Map reasoningEffort setting to Gemini 3 thinkingLevel
// Pro supports: LOW, HIGH (no MINIMAL)
// Flash supports: MINIMAL, LOW, MEDIUM, HIGH
export function mapReasoningToThinkingLevel(reasoningEffort, model) {
  const isPro = (model || '').toLowerCase().includes('pro');
  switch ((reasoningEffort || '').toLowerCase()) {
    case 'none':
      // Use lowest available level
      return isPro ? 'LOW' : 'MINIMAL';
    case 'low':
      return 'LOW';
    case 'medium':
      return isPro ? 'HIGH' : 'MEDIUM';
    case 'high':
      return 'HIGH';
    default:
      return null; // Let the API use its default
  }
}

export function isClaudeModel(model) {
  return stripProviderPrefix(model).toLowerCase().includes('claude');
}

// Get provider from model name (legacy fallback)
export function getProviderFromModel(model) {
  const m = stripProviderPrefix(model);
  if (isGeminiModel(m)) return 'gemini';
  if (isClaudeModel(m)) return 'anthropic';
  return 'openai';
}

// Extract the actual response text from Gemini parts, skipping thinking/thought parts
export function extractGeminiResponseText(parts) {
  if (!parts || parts.length === 0) return '';
  // Filter out thought parts (Gemini 3 models include { thought: true } parts)
  const responseParts = parts.filter(p => !p.thought);
  // Try non-thought parts first
  const nonThoughtText = responseParts.map(p => p.text).filter(Boolean).join('');
  if (nonThoughtText) return nonThoughtText;
  // Fall back to ALL parts (including thought parts) if non-thought text was empty
  // This handles Gemini 3 models that sometimes put the response in thought parts
  const allText = parts.map(p => p.text).filter(Boolean).join('');
  if (allText) {
    console.warn('[Gemini API] No non-thought text found, using thought text as fallback');
  }
  return allText;
}

// Parse "providerId:modelName" format used in settings
export function parseModelRef(ref) {
  if (!ref) return { providerId: '', modelName: '' };
  const idx = ref.indexOf(':');
  if (idx === -1) return { providerId: '', modelName: ref };
  return { providerId: ref.slice(0, idx), modelName: ref.slice(idx + 1) };
}

// Look up a provider by id from the providers array
export function findProvider(settings, providerId) {
  const providers = settings.providers || [];
  if (Array.isArray(providers)) {
    return providers.find(p => p.id === providerId);
  }
  // Legacy object format fallback
  return providers[providerId];
}

// Check if the settings have any usable API key (for UI-level validation)
export function hasAnyApiKey(settings) {
  if (settings.apiKey) return true;
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  return providers.some(p => !!p.apiKey);
}

// Get the correct API credentials based on the model ref (providerId:modelName)
export function getCredentials(settings) {
  const modelRef = settings.model || 'openai:gpt-4o';
  const { providerId, modelName } = parseModelRef(modelRef);

  // Look up provider from array
  const provider = findProvider(settings, providerId);

  if (provider) {
    const apiUrl = provider.apiUrl || '';
    // For direct Azure OpenAI endpoints, don't add azure. prefix (deployment is in URL)
    const isDirectAzure = apiUrl.includes('openai.azure.com');
    const azureModel = (provider.azurePrefix && !isDirectAzure) ? `azure.${modelName}` : modelName;
    // GPT-5.x models use the Responses API endpoint
    let apiEndpoint = apiUrl;
    const useResponsesAPI = isGPT5Model(modelName) && !provider.azurePrefix
      && apiEndpoint.includes('api.openai.com');
    if (useResponsesAPI) {
      apiEndpoint = 'https://api.openai.com/v1/responses';
    }
    // Parse custom headers/params (JSON strings from provider config)
    let customHeaders = {};
    let customParams = {};
    try { if (provider.customHeaders) customHeaders = JSON.parse(provider.customHeaders); } catch (_) { /* ignore invalid JSON */ }
    try { if (provider.customParams) customParams = JSON.parse(provider.customParams); } catch (_) { /* ignore invalid JSON */ }

    return {
      apiKey: provider.apiKey || settings.apiKey || '',
      apiEndpoint,
      model: azureModel,
      rawModel: modelName,
      provider: providerId,
      isGeminiProvider: provider.geminiNativeFormat
        || (provider.apiUrl || '').includes('generativelanguage.googleapis.com')
        || ((provider.apiUrl || '').includes('aiplatform.googleapis.com')
          && !(provider.apiUrl || '').includes('/chat/completions')),
      isAnthropicProvider: (provider.apiUrl || '').includes('anthropic.com')
        || isClaudeModel(modelName),
      azurePrefix: provider.azurePrefix || false,
      authType: provider.authType || 'auto',
      useResponsesAPI,
      customHeaders,
      customParams,
    };
  }

  // Fallback: no provider found — try legacy detection from model name
  const legacyProvider = getProviderFromModel(modelName);
  const legacyConfig = Array.isArray(settings.providers)
    ? settings.providers.find(p => p.id === legacyProvider)
    : settings.providers?.[legacyProvider];

  return {
    apiKey: legacyConfig?.apiKey || legacyConfig?.apiKey || settings.apiKey || '',
    apiEndpoint: legacyConfig?.apiUrl || legacyConfig?.apiEndpoint || settings.apiEndpoint || 'https://api.openai.com/v1/chat/completions',
    model: modelName,
    rawModel: modelName,
    provider: legacyProvider,
    isGeminiProvider: isGeminiModel(modelName),
    isAnthropicProvider: isClaudeModel(modelName),
    azurePrefix: false,
    authType: 'auto',
    useResponsesAPI: false,
  };
}

// Build auth headers for non-Gemini API calls.
// Centralises auth so all call paths (callGeminiAPI, agentChat, callRouterWithImages)
// use the same logic. Supports Azure OpenAI (api-key), Anthropic (x-api-key), and
// Bearer token (OpenAI, LiteLLM proxies, enterprise gateways).
export function buildProviderHeaders(creds) {
  const headers = { 'Content-Type': 'application/json' };
  const authType = creds.authType || 'auto';
  const url = creds.apiEndpoint || '';

  // Server-managed auth: backend proxy adds the API key — no client-side auth needed
  if (authType === 'server') {
    // No auth headers needed
  } else if (authType === 'api-key' || (authType === 'auto' && (url.includes('openai.azure.com') || creds.azurePrefix))) {
    headers['api-key'] = creds.apiKey;
  } else if (authType === 'auto' && url.includes('anthropic.com')) {
    headers['x-api-key'] = creds.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  } else {
    headers['Authorization'] = `Bearer ${creds.apiKey}`;
  }
  if (creds.customHeaders && typeof creds.customHeaders === 'object') {
    Object.assign(headers, creds.customHeaders);
  }
  return headers;
}

// Build Gemini endpoint from credentials
export function buildGeminiEndpoint(creds) {
  const baseUrl = creds.apiEndpoint || 'https://generativelanguage.googleapis.com/v1beta';
  // If it's a Gemini-style base URL, construct the model endpoint
  if (baseUrl.includes('generativelanguage.googleapis.com')) {
    return `${baseUrl}/models/${creds.rawModel || creds.model}:generateContent?key=${creds.apiKey}`;
  }
  // Custom endpoint (Vertex AI, etc.) — use as-is
  return baseUrl;
}

// Build headers for Gemini API calls
// Standard Gemini API: key is in the URL, no auth header needed
// Vertex AI / custom endpoints: need Authorization: Bearer header
export function buildGeminiHeaders(creds) {
  const headers = { 'Content-Type': 'application/json' };
  const apiUrl = creds.apiEndpoint || '';
  if (!apiUrl.includes('generativelanguage.googleapis.com') && creds.apiKey) {
    headers['Authorization'] = `Bearer ${creds.apiKey}`;
  }
  return headers;
}
