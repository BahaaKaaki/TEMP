import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import { getVibePromptContext, isBaseVibe } from '../../utils/vibes';
import { parseModelRef, findProvider, getCredentials, buildProviderHeaders, buildGeminiEndpoint, buildGeminiHeaders, isGemini3Model, isGemini25Model, extractGeminiResponseText } from './models.js';
import { callWithModelFallback, getFallbackModels } from './apiClient.js';
import { TITLE_HEADER_RULES } from './constants.js';
import { authFetch } from '../authFetch.js';
import {
  buildClientProfileContext,
  buildClientValidationBlock,
  getActiveClientProfile,
  getClientProfileFooterBranding,
} from '../../utils/clientDesignProfiles.js';
import { DEFAULT_THEME } from '../../utils/themeUtils.js';
import { applyPromptOverride, recordPromptPayload } from './promptOverrides.js';

const FRAME_CAPTURE_W = 904;
const FRAME_CAPTURE_H = 366;

/** Visual Uplift always uses Gemini 3 Pro Image (chat + reference image), not Settings image model. */
export const VISUAL_UPLIFT_IMAGE_MODEL = 'pwc:vertex_ai.gemini-3-pro-image-preview';

/** Visual Uplift system prompt (placeholders: layoutGuidance, clientProfileName). */
export const VISUAL_UPLIFT_PROMPT = `You are enhancing ONLY the content-area visual inside a strategy consulting slide.

This is NOT a full slide. The title, subtitle, footer, page number, frame, and slide chrome already exist outside this image. Your output should be only the diagram/content visual that sits inside the slide frame.

INPUT:
- A reference image of the current content-area visual may be provided.
- Existing text, labels, pillars, categories, steps, relationships, and structure must be preserved.
- Optional layout guidance: {layoutGuidance}
- Optional client style: {clientProfileName}

TASK:
Transform the current content into a polished strategy consulting-style visual while preserving the factual meaning and all important labels.

You may improve:
- Layout clarity
- Spacing and alignment
- Visual hierarchy
- Grouping and flow
- Shape consistency
- Typography balance
- Use of consulting diagram patterns such as pillars, value chains, matrices, chevrons, swimlanes, hub-and-spoke, operating model layers, or phased roadmaps

You must preserve:
- All factual content
- All labels and key terms
- The number of pillars, phases, steps, categories, or workstreams
- The logical order and relationships between items
- Any hierarchy implied by the original content
- The intent of the original diagram

Do NOT:
- Add a slide title, heading, subtitle, footer, source line, page number, or logo
- Add borders, frames, cards around the entire image, or slide template chrome
- Add decorative accent bars along the edges
- Replace the content with generic stock imagery
- Use photos, 3D effects, heavy gradients, ornamental illustrations, or decorative art
- Invent new facts, labels, categories, metrics, or relationships
- Remove or rename pillars, phases, or categories unless explicitly instructed

STYLE:
Create a clean, premium strategy consulting diagram:
- White background
- Flat vector shapes
- Thin lines
- Structured grid
- Crisp spacing
- Clear information hierarchy
- Minimal, purposeful icons only where they improve comprehension
- Professional executive-ready look
- Suitable for a top-tier consulting presentation
- Use the client palette from BRAND & LAYOUT CONTEXT: accent for key structure, pale surfaces for cards/panels, semantic greens/reds/ambers only where content implies them — not a single-color wash
- When a reference image is provided, preserve its color roles (header fills vs body panels vs highlights) while improving clarity

FORMAT:
- Extra-wide landscape content area
- Target aspect ratio: approximately 2.5:1
- Optimized for a 904×366 container
- Edge-to-edge content on white background
- No surrounding slide template elements

OUTPUT GOAL:
Produce a visually upgraded version of the existing content that feels like a polished consulting slide diagram, not a decorative image. The result should make the same information easier to understand, more structured, and more executive-ready.`;

function extractAllFrameContentForUplift(frameHtml) {
  if (typeof document === 'undefined') return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = frameHtml;
  const frame = tempDiv.querySelector('.frame');
  const root = frame || tempDiv;
  return root.innerText?.replace(/\n{3,}/g, '\n\n').trim() || '';
}

/** Deck theme when set; otherwise the active client profile theme. */
export function resolveFrameImageTheme(settings, deckTheme = null) {
  if (deckTheme?.colors) return deckTheme;
  const profile = getActiveClientProfile(settings);
  return profile?.theme || DEFAULT_THEME;
}

/**
 * Shared palette instructions for frame images (generateImageSlide + Visual Uplift).
 * Pairs with brand tokens from buildFrameImageStyleContext — does not duplicate full profile JSON.
 */
export function buildFrameImagePaletteGuidance(settings, theme = null, options = {}) {
  const { skipValidation = false, includeValidation = true } = options;
  const resolvedTheme = resolveFrameImageTheme(settings, theme);
  const profile = getActiveClientProfile(settings);
  const c = resolvedTheme?.colors || {};
  const accent = c.accent || '#8E1E1E';
  const heading = c.heading || '#111111';
  const body = c.body || '#222222';
  const surface = c.surface || '#F7F9FB';
  const surfaceAlt = c.surfaceAlt || '#EEF2F6';
  const border = c.border || '#E6E9EE';
  const success = c.success || '#059669';
  const warning = c.warning || '#d97706';
  const danger = c.danger || '#dc2626';
  const info = c.info || '#2563eb';

  const lines = [
    'PALETTE & COLOR USAGE (use multiple tokens — not a single accent wash):',
    `- Primary accent (${accent}): pillar headers, chevrons, matrix axes, key bars, and primary emphasis`,
    `- Heading/body text (${heading} / ${body}): labels on light fills; near-black on white`,
    `- Card/panel fills (${surface} / ${surfaceAlt}): alternate surfaces for grouped blocks`,
    `- Borders/dividers (${border}): thin rules between cells and sections`,
    `- Semantic fills only when content warrants: success ${success}, warning ${warning}, danger ${danger}, info ${info}`,
    '- Background: plain white edge-to-edge; flat vector shapes; no gradients, photos, or 3D',
    '- When a reference image is provided, preserve its color roles (which fill is header vs panel vs highlight) while polishing layout',
    '- Do NOT render hex codes, font names, or technical annotations in the image',
  ];

  const extraColorTokens = Object.entries(c)
    .filter(([key, value]) => value && !['accent', 'heading', 'body', 'page', 'surface', 'surfaceAlt', 'border', 'success', 'warning', 'danger', 'info', 'muted', 'onAccent', 'accentHover', 'accentSoft'].includes(key))
    .map(([key, value]) => `${key}: ${value}`);
  if (extraColorTokens.length > 0) {
    lines.push(`- Profile-specific tokens: ${extraColorTokens.join('; ')}`);
  }

  if (includeValidation && !skipValidation) {
    const validationBlock = formatProfileColorRules(profile);
    if (validationBlock) lines.push(validationBlock);
  }

  return lines.join('\n');
}

function formatProfileColorRules(profile) {
  const block = buildClientValidationBlock(profile);
  if (!block) return '';
  return block.replace(/^CLIENT VALIDATION RULES:\n/, 'Profile color rules:\n');
}

/**
 * Shared brand/style context for frame images (new image slides + Visual Uplift).
 * Uses the same client design profile + deck theme + image vibe as generateImageSlide.
 */
export function buildFrameImageStyleContext(settings, theme, options = {}) {
  const {
    slide = null,
    imageVibe = 'default',
    includeTheme = true,
    includeVibe = true,
    includeComponents = true,
    includeValidation = true,
  } = options;

  const parts = [];
  const templateLabel = slide?.templateId || slide?.type;
  if (templateLabel) {
    parts.push(`Slide template: ${templateLabel}`);
  }

  if (includeTheme) {
    const profile = getActiveClientProfile(settings);
    const resolvedTheme = resolveFrameImageTheme(settings, theme);
    const profileBlock = profile?.id !== 'strategy'
      ? buildClientProfileContext(settings, {
        includeTheme: true,
        includeLayout: false,
        includeValidation,
        includeEvidence: false,
        includePromptSections: false,
        includeComponents,
        includePptx: false,
      })
      : '';

    if (profileBlock) {
      parts.push(profileBlock);
      parts.push(buildFrameImagePaletteGuidance(settings, theme, {
        skipValidation: includeValidation,
        includeValidation,
      }));
    } else {
      parts.push(
        `ACTIVE CLIENT PROFILE: ${profile?.name || 'Strategy&'} (strategy)`,
        `Semantic theme tokens:\n${JSON.stringify(resolvedTheme, null, 2)}`,
      );
      if (includeValidation) {
        const validationBlock = buildClientValidationBlock(profile);
        if (validationBlock) parts.push(validationBlock);
      }
      parts.push(buildFrameImagePaletteGuidance(settings, theme, { includeValidation }));
    }
  }

  if (includeVibe && imageVibe && !isBaseVibe(imageVibe)) {
    const vibeCtx = getVibePromptContext(imageVibe);
    if (vibeCtx) parts.push(`Image vibe variation:\n${vibeCtx}`);
  }

  return parts.join('\n\n');
}

function buildUserLayoutChangeSection(layoutGuidance) {
  const text = String(layoutGuidance || '').trim();
  if (!text || text === 'None') return '';
  return `

USER LAYOUT REQUEST (highest priority — overrides default layout preservation):
${text}
Reorganize the diagram to satisfy this request (e.g. column count, grid, matrix, flow direction).
Keep every label, fact, metric, and relationship; do not drop or invent content.`;
}

function buildVisualUpliftPrompt({
  settings,
  layoutGuidance,
  clientProfileName,
  frameContent,
  title,
  subtitle,
  styleContext,
}) {
  const basePrompt = applyPromptOverride(settings, 'visualUplift.system', VISUAL_UPLIFT_PROMPT);
  let prompt = basePrompt
    .replace(/\{layoutGuidance\}/g, layoutGuidance || 'None')
    .replace(/\{clientProfileName\}/g, clientProfileName || 'Strategy&');

  const layoutChangeSection = buildUserLayoutChangeSection(layoutGuidance);
  if (layoutChangeSection) {
    prompt += layoutChangeSection;
  }

  const sections = [];
  if (styleContext) {
    sections.push(`BRAND & LAYOUT CONTEXT:\n${styleContext}`);
  }
  if (frameContent) {
    sections.push(`EXISTING FRAME CONTENT (preserve every label, number, term, and relationship):\n${frameContent}`);
  }
  if (title || subtitle) {
    const lines = [];
    if (title) lines.push(`Title (context only — do not render in image): "${title}"`);
    if (subtitle) lines.push(`Subtitle (context only — do not render in image): ${subtitle}`);
    sections.push(`SLIDE CONTEXT:\n${lines.join('\n')}`);
  }
  if (sections.length > 0) {
    prompt += `\n\n---\n${sections.join('\n\n')}`;
  }
  return prompt;
}

/** PwC / Edwin backend proxy (chat or images), not direct Vertex/OpenAI URLs. */
function isPwCProxyUrl(apiUrl, provider) {
  return provider?.authType === 'server'
    || (apiUrl || '').includes('/api/ai/')
    || (apiUrl || '').includes('/chat/completions');
}

/** Resolve OpenAI-style /images/generations URL for the configured provider. */
function resolveImageGenerationsEndpoint(apiUrl) {
  const url = apiUrl || '';
  if (url.includes('/api/ai/chat')) return '/api/ai/images/generations';
  if (url.includes('/chat/completions')) {
    return url.replace('/v1/chat/completions', '/v1/images/generations')
      .replace('/chat/completions', '/images/generations');
  }
  if (url.includes('api.openai.com')) return 'https://api.openai.com/v1/images/generations';
  if (url) return `${url.replace(/\/+$/, '')}/images/generations`;
  return '/api/ai/images/generations';
}

// ============================================
// IMAGE GENERATION
// ============================================

/**
 * Call an image generation API to produce a slide visual.
 * Uses settings.imageModel (format: "providerId:modelName").
 * Supports:
 *   - Gemini 3 Pro Image (generateContent with responseModalities: ["TEXT","IMAGE"])
 *   - Gemini Imagen (predict endpoint)
 *   - OpenAI GPT-Image-1, DALL-E 3 (/images/generations)
 *   - Azure/PwC proxies for all of the above
 * Returns a data:image/png;base64,... URI string.
 */
export async function generateImage(imagePrompt, settings, referenceImageDataUri = null, imageOptions = {}) {
  const imageModelRef = imageOptions.modelRef || settings.imageModel;
  if (!imageModelRef) {
    throw new Error('No image model configured. Set imageModel in Settings (e.g., "pwc:openai.gpt-image-1.5").');
  }

  return await _generateImageInner(imagePrompt, settings, referenceImageDataUri, imageModelRef, imageOptions);
}

function resolveGptImageParams(imageOptions = {}) {
  return {
    quality: imageOptions.quality || 'medium',
    size: imageOptions.size || '1536x1024',
  };
}

async function _generateImageInner(imagePrompt, settings, referenceImageDataUri, imageModelRef, imageOptions = {}) {
  const { providerId, modelName } = parseModelRef(imageModelRef);
  const provider = findProvider(settings, providerId);
  if (!provider?.apiKey) {
    throw new Error(`No API key configured for "${providerId}" provider. Add it in Settings to use image generation.`);
  }

  console.log(`[ImageGen] Generating image with model ${modelName} via provider ${providerId}`);

  const apiUrl = provider.apiUrl || '';
  const isAzureStyle = provider.azurePrefix || apiUrl.includes('openai.azure.com');

  // Build auth headers (same logic as text API calls)
  const headers = { 'Content-Type': 'application/json' };
  if (provider.authType === 'server') {
    // Server-managed auth: backend proxy adds the key
  } else if (provider.authType === 'api-key' || isAzureStyle) {
    headers['api-key'] = provider.apiKey;
  } else if (provider.authType === 'bearer') {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  } else if (apiUrl.includes('anthropic.com')) {
    headers['x-api-key'] = provider.apiKey;
  } else {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  // Detect model type
  const isGeminiImageModel = modelName.includes('gemini') && modelName.includes('image');
  const isGeminiImagen = modelName.includes('imagen');
  const isGptImage1 = modelName.includes('gpt-image');
  const isDallE = modelName.includes('dall-e');

  // ── Gemini 3 Pro Image (generateContent with responseModalities) ──
  if (isGeminiImageModel) {
    const isPwcOrProxy = isPwCProxyUrl(apiUrl, provider) || isAzureStyle;
    const requestModel = isAzureStyle ? `azure.${modelName}` : modelName;

    if (isPwcOrProxy) {
      // PwC / Edwin proxy: POST /api/ai/chat → upstream /chat/completions
      const geminiEndpoint = apiUrl;

      // Build message content: text prompt + optional reference image for editing
      let messageContent;
      if (referenceImageDataUri) {
        // Multipart: send reference image + text instruction for image editing
        messageContent = [
          { type: 'image_url', image_url: { url: referenceImageDataUri } },
          { type: 'text', text: imagePrompt },
        ];
      } else {
        messageContent = imagePrompt;
      }

      const requestBody = {
        model: requestModel,
        messages: [
          { role: 'user', content: messageContent },
        ],
        // Gemini-specific fields — the proxy passes these through to the backend
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '16:9' },
        },
      };

      console.log('[generateImage] Gemini Image via proxy /chat/completions:', { geminiEndpoint, model: requestModel, provider: providerId });

      return await _callImageEndpoint(geminiEndpoint, headers, requestBody, (data) => {
        // The proxy may return Gemini-native or OpenAI-compatible format.
        // Log full response structure for debugging.
        const msg = data.choices?.[0]?.message;
        console.log('[generateImage] Proxy response structure:', {
          topKeys: Object.keys(data),
          hasChoices: !!data.choices?.length,
          msgKeys: msg ? Object.keys(msg) : null,
          contentType: msg ? (Array.isArray(msg.content) ? 'array' : typeof msg.content) : null,
          contentSample: msg ? (Array.isArray(msg.content)
            ? msg.content.map(b => ({ type: b.type, keys: Object.keys(b) }))
            : (typeof msg.content === 'string' ? msg.content.slice(0, 200) : null)) : null,
          hasParts: !!msg?.parts,
        });

        // Try Gemini native: candidates[0].content.parts[].inline_data
        const candidateParts = data.candidates?.[0]?.content?.parts || [];
        for (const part of candidateParts) {
          if (part.inline_data?.data) {
            const mimeType = part.inline_data.mime_type || 'image/png';
            return `data:${mimeType};base64,${part.inline_data.data}`;
          }
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${part.inlineData.data}`;
          }
        }

        // OpenAI-compatible: choices[0].message
        if (msg) {
          // PwC proxy format: message.images[] with image_url data URIs
          if (Array.isArray(msg.images) && msg.images.length > 0) {
            for (const img of msg.images) {
              // image_url can be a string or an object like {url: "data:..."}
              if (img.image_url) {
                if (typeof img.image_url === 'string') return img.image_url;
                if (typeof img.image_url === 'object') {
                  if (img.image_url.url) return img.image_url.url;
                  if (img.image_url.data) return `data:image/png;base64,${img.image_url.data}`;
                }
              }
              if (img.url) return img.url;
              if (img.b64_json) return `data:image/png;base64,${img.b64_json}`;
            }
          }

          // Case 1: content is multipart array
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              // OpenAI image_url block
              if (block.type === 'image_url' && block.image_url?.url) {
                return block.image_url.url;
              }
              // Anthropic-style image block
              if (block.type === 'image' && block.source?.data) {
                const mimeType = block.source.media_type || 'image/png';
                return `data:${mimeType};base64,${block.source.data}`;
              }
              // Gemini inline_data passed through in content array
              if (block.inline_data?.data) {
                const mimeType = block.inline_data.mime_type || 'image/png';
                return `data:${mimeType};base64,${block.inline_data.data}`;
              }
              if (block.inlineData?.data) {
                const mimeType = block.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${block.inlineData.data}`;
              }
              // Some proxies use {type: "image", data: "base64..."}
              if (block.type === 'image' && typeof block.data === 'string') {
                return `data:image/png;base64,${block.data}`;
              }
              // Block with b64 field
              if (block.b64_json) {
                return `data:image/png;base64,${block.b64_json}`;
              }
              // Scan any object block for base64 data fields
              if (typeof block === 'object' && block !== null) {
                for (const val of Object.values(block)) {
                  if (typeof val === 'string' && val.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(val.slice(0, 100))) {
                    console.log('[generateImage] Found likely base64 in content block field');
                    return `data:image/png;base64,${val}`;
                  }
                }
              }
            }
          }

          // Case 2: content is a string — could be base64 or contain embedded data URI
          if (typeof msg.content === 'string') {
            const content = msg.content;
            // Check for embedded data URI
            const dataUriMatch = content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
            if (dataUriMatch) {
              return dataUriMatch[0];
            }
            // Check if the entire string is base64 (long, no spaces)
            if (content.length > 1000 && !content.includes(' ') && /^[A-Za-z0-9+/=\n]+$/.test(content.slice(0, 200))) {
              console.log('[generateImage] Message content appears to be raw base64');
              return `data:image/png;base64,${content.replace(/\n/g, '')}`;
            }
          }

          // Case 3: message has Gemini-style parts directly
          if (Array.isArray(msg.parts)) {
            for (const part of msg.parts) {
              if (part.inline_data?.data) {
                const mimeType = part.inline_data.mime_type || 'image/png';
                return `data:${mimeType};base64,${part.inline_data.data}`;
              }
              if (part.inlineData?.data) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${part.inlineData.data}`;
              }
            }
          }
        }

        // Fallback: b64_json in OpenAI images format
        if (data.data?.[0]?.b64_json) {
          return `data:image/png;base64,${data.data[0].b64_json}`;
        }

        console.warn('[generateImage] Could not extract image from proxy response. Full choices[0].message:', JSON.stringify(msg, null, 2)?.slice(0, 3000));
        return null;
      });
    }

    // Direct Gemini API (Vertex AI or generativelanguage.googleapis.com)
    let geminiEndpoint;
    if (apiUrl.includes('aiplatform.googleapis.com')) {
      geminiEndpoint = `${apiUrl.replace(/\/+$/, '')}/publishers/google/models/${modelName}:generateContent`;
    } else if (apiUrl.includes('generativelanguage.googleapis.com')) {
      geminiEndpoint = `${apiUrl}/models/${modelName}:generateContent?key=${provider.apiKey}`;
    } else {
      geminiEndpoint = `${apiUrl.replace(/\/+$/, '')}/models/${modelName}:generateContent`;
    }

    // Build parts: text + optional reference image for editing
    const parts = [{ text: imagePrompt }];
    if (referenceImageDataUri) {
      // Extract mime type and base64 data from data URI
      const match = referenceImageDataUri.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (match) {
        parts.unshift({ inline_data: { mime_type: match[1], data: match[2] } });
      }
    }

    const requestBody = {
      model: modelName,
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      },
    };

    console.log('[generateImage] Gemini Image direct generateContent:', { geminiEndpoint, model: modelName, provider: providerId, hasRefImage: !!referenceImageDataUri });

    return await _callImageEndpoint(geminiEndpoint, headers, requestBody, (data) => {
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inline_data?.data) {
          const mimeType = part.inline_data.mime_type || 'image/png';
          return `data:${mimeType};base64,${part.inline_data.data}`;
        }
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    });
  }

  // ── Gemini Imagen (predict endpoint) ──
  if (isGeminiImagen) {
    let imagenEndpoint;
    if (apiUrl.includes('generativelanguage.googleapis.com')) {
      imagenEndpoint = `${apiUrl}/models/${modelName}:predict?key=${provider.apiKey}`;
    } else if (apiUrl.includes('/chat/completions')) {
      imagenEndpoint = apiUrl.replace('/chat/completions', `/models/${modelName}:predict`);
    } else {
      imagenEndpoint = `${apiUrl.replace(/\/+$/, '')}/models/${modelName}:predict`;
    }

    const requestBody = {
      instances: [{ prompt: imagePrompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9' },
    };

    console.log('[generateImage] Imagen predict call:', { imagenEndpoint, model: modelName, provider: providerId });

    return await _callImageEndpoint(imagenEndpoint, headers, requestBody, (data) => {
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      return b64 ? `data:image/png;base64,${b64}` : null;
    });
  }

  // ── OpenAI-compatible (GPT-Image-1/2, DALL-E 3, Azure proxies) ──
  const imageEndpoint = resolveImageGenerationsEndpoint(apiUrl);

  const azureModel = isAzureStyle ? `azure.${modelName}` : modelName;
  const gptParams = isGptImage1 ? resolveGptImageParams(imageOptions) : null;
  const requestBody = {
    model: azureModel,
    prompt: imagePrompt,
    n: 1,
    size: gptParams?.size || (isDallE ? '1792x1024' : '1024x1024'),
    quality: gptParams?.quality || (isDallE ? 'hd' : 'standard'),
  };
  if (isGptImage1) {
    requestBody.output_format = 'b64_json';
  } else {
    requestBody.response_format = 'b64_json';
  }

  console.log('[generateImage] OpenAI image call:', {
    imageEndpoint,
    model: azureModel,
    provider: providerId,
    size: requestBody.size,
    quality: requestBody.quality,
  });

  return await _callImageEndpoint(imageEndpoint, headers, requestBody, (data) => {
    const b64 = data.data?.[0]?.b64_json;
    return b64 ? `data:image/png;base64,${b64}` : null;
  });
}

/**
 * Internal: call an image endpoint with retry logic and parse the response.
 * @param {string} endpoint - API URL
 * @param {object} headers - Request headers
 * @param {object} body - Request body
 * @param {function} extractImage - (responseData) => dataUri | null
 * @returns {string} data:image/...;base64,... URI
 */
export async function _callImageEndpoint(endpoint, headers, body, extractImage) {
  const MAX_RETRIES = 2;
  const BASE_DELAYS = [3000, 6000];
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_DELAYS[attempt - 1];
        console.log(`[generateImage] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await authFetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errMsg = error.error?.message || `Image API error: ${response.status}`;
        if (response.status === 429) {
          throw new Error(`Image generation rate limited: ${errMsg}`);
        }
        lastError = new Error(errMsg);
        if (response.status >= 500) continue; // retry on 5xx
        throw lastError;
      }

      const data = await response.json();
      const dataUri = extractImage(data);

      if (!dataUri) {
        throw new Error('Image API returned no image data');
      }

      const usedModel = response.headers.get('X-Edwin-Image-Model-Used');
      const requestedModel = response.headers.get('X-Edwin-Image-Model-Requested');
      if (usedModel && usedModel !== requestedModel) {
        console.warn(`[generateImage] Requested ${requestedModel}; served via ${usedModel}`);
      } else {
        console.log('[generateImage] Image generated successfully');
      }
      return dataUri;

    } catch (err) {
      lastError = err;
      if (err.message.includes('rate limited') || err.message.includes('429')) throw err;
      if (attempt === MAX_RETRIES) throw lastError;
    }
  }
  throw lastError || new Error('Image generation failed after retries');
}

/**
 * Generate a complete image slide (HTML) with AI-generated visuals.
 * @param {string} instruction - Content instruction from router
 * @param {object} settings - Full settings object
 * @param {'full'|'content'} mode - 'full' = full-bleed image, 'content' = image in frame with text
 * @param {object} contextInfo - { layoutGuidance, vibe, footerBranding, slideNumber, totalSlides }
 * @returns {object} { id, title, html, type, templateId }
 */
function parseSlideChrome(html) {
  if (typeof document === 'undefined') {
    return { title: '', subtitle: '', footerBranding: 'Strategy&', slideNumber: '', frameText: '' };
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.querySelector('h1.title')?.textContent?.trim()
    || doc.querySelector('.cover-title')?.textContent?.trim()
    || doc.querySelector('h1')?.textContent?.trim()
    || '';
  const subtitle = doc.querySelector('h2.subtitle')?.textContent?.trim()
    || doc.querySelector('.cover-category')?.textContent?.trim()
    || '';
  const footer = doc.querySelector('footer.footer');
  const footerSpans = footer ? [...footer.querySelectorAll('span')] : [];
  const footerBranding = footerSpans[0]?.textContent?.trim() || 'Strategy&';
  const slideNumber = footerSpans.length > 0 ? footerSpans[footerSpans.length - 1]?.textContent?.trim() || '' : '';
  const frame = doc.querySelector('.frame');
  const frameHtml = frame
    ? `<div class="frame">${frame.innerHTML}</div>`
    : html;
  const frameText = extractAllFrameContentForUplift(frameHtml);
  return { title, subtitle, footerBranding, slideNumber, frameText };
}

async function captureFrameReference(html) {
  if (typeof document === 'undefined') return null;
  try {
    const { captureSlideAsImage } = await import('../templateValidation.js');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const frame = doc.querySelector('.frame');
    const inner = frame?.innerHTML || html;
    const shell = `<div class="slide" style="width:${FRAME_CAPTURE_W}px;height:${FRAME_CAPTURE_H}px;background:#fff;margin:0;padding:0;overflow:hidden"><div class="frame" style="width:100%;height:100%;overflow:hidden">${inner}</div></div>`;
    const b64 = await captureSlideAsImage(shell, FRAME_CAPTURE_W, FRAME_CAPTURE_H);
    return b64 ? `data:image/png;base64,${b64}` : null;
  } catch (e) {
    console.warn('[upliftSlideWithImage] Frame capture failed:', e.message);
    return null;
  }
}

/**
 * Visual uplift: keep title/subtitle/footer, regenerate the content frame with the image model.
 * Uses the current slide HTML (and optional screenshot) as reference.
 */
export async function upliftSlideWithImage(slide, settings, options = {}) {
  const {
    userPrompt = '',
    footerBranding: footerBrandingOverride,
    slideNumber = 1,
    theme = null,
    imageVibe = 'default',
    includeThemeContext = settings?.visualUpliftIncludeTheme !== false,
    includeVibeContext = settings?.visualUpliftIncludeVibe !== false,
  } = options;

  if (!settings?.providers?.length && !settings?.imageModel) {
    throw new Error('Visual Uplift requires the PwC provider in Settings.');
  }

  const html = slide?.html || '';
  if (!html.trim()) {
    throw new Error('Slide has no HTML content to uplift.');
  }

  const isFullBleed = slide.templateId === 'image-full' || slide.type === 'image-full';
  const layoutGuidance = userPrompt.trim() || '';

  if (isFullBleed) {
    const instruction = parseSlideChrome(html).frameText || slide.title || 'Enhance this visual';
    return generateImageSlide(instruction, settings, 'full', {
      layoutGuidance,
      footerBranding: footerBrandingOverride || 'Strategy&',
      slideNumber,
      existingImageDataUri: extractImageDataUri(html),
      imageModelRef: VISUAL_UPLIFT_IMAGE_MODEL,
    });
  }

  const { title, subtitle, footerBranding, slideNumber: parsedNum, frameText } = parseSlideChrome(html);
  const displayTitle = title || slide?.title || 'Slide';
  const footerBrand = footerBrandingOverride || footerBranding;
  const pageNum = parsedNum || String(slideNumber);

  let referenceImageDataUri = extractImageDataUri(html);
  if (!referenceImageDataUri) {
    referenceImageDataUri = await captureFrameReference(html);
  }

  const activeProfile = getActiveClientProfile(settings);
  const styleContext = buildFrameImageStyleContext(settings, theme, {
    slide,
    imageVibe,
    includeTheme: includeThemeContext,
    includeVibe: includeVibeContext,
    includeComponents: true,
    includeValidation: true,
  });
  const imagePrompt = buildVisualUpliftPrompt({
    settings,
    layoutGuidance,
    clientProfileName: activeProfile.name || 'Strategy&',
    frameContent: frameText,
    title: displayTitle,
    subtitle,
    styleContext,
  });

  recordPromptPayload('visualUplift', {
    model: VISUAL_UPLIFT_IMAGE_MODEL,
    layoutGuidance: layoutGuidance || null,
    clientProfileName: activeProfile.name || 'Strategy&',
    includeThemeContext,
    includeVibeContext,
    imageVibe,
    templateId: slide?.templateId,
    hasReferenceImage: !!referenceImageDataUri,
    promptLength: imagePrompt.length,
    frameContentLength: frameText?.length || 0,
    prompt: imagePrompt,
  });

  console.log(
    `[upliftSlideWithImage] model=${VISUAL_UPLIFT_IMAGE_MODEL}, title="${displayTitle.slice(0, 60)}", hasRef=${!!referenceImageDataUri}, layoutGuidance="${layoutGuidance.slice(0, 120)}", promptLen=${imagePrompt.length}`
  );

  const imageDataUri = await generateImage(imagePrompt, settings, referenceImageDataUri, {
    modelRef: VISUAL_UPLIFT_IMAGE_MODEL,
  });

  const safeTitle = displayTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeSubtitle = subtitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safePage = String(pageNum).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return {
    id: slide.id,
    title: displayTitle,
    html: `<div class="slide">
  <h1 class="title">${safeTitle}</h1>
  ${subtitle ? `<h2 class="subtitle">${safeSubtitle}</h2>` : ''}
  <div class="frame">
    <img src="${imageDataUri}" alt="${safeTitle}" class="frame-image" />
  </div>
  <footer class="footer"><span>${footerBrand}</span><span class="source"></span><span>${safePage}</span></footer>
</div>`,
    type: 'image-content',
    templateId: 'image-content',
    customCSS: slide.customCSS || '',
    imageEditPipeline: 'uplift',
  };
}

// Extract base64 image data URI from slide HTML (for image editing)
export function extractImageDataUri(html) {
  if (!html) return null;
  const match = html.match(/src="(data:image\/[^"]+)"/);
  return match ? match[1] : null;
}

/** Slides whose frame is a raster image (image templates or post-Visual Uplift). */
export function slideUsesRasterFrameImage(slide) {
  const html = slide?.html || '';
  const tid = slide?.templateId || slide?.type || '';
  if (tid === 'image-full' || tid === 'image-content') return true;
  return /class=["']frame-image["']/i.test(html) || /src=["']data:image\//i.test(html);
}

/**
 * Edit a slide by regenerating its frame image (not HTML/CSS text edit).
 * Uplift-style frames use Gemini Visual Uplift; plan image slides use Settings image model.
 */
export async function editRasterImageSlide(slide, instruction, settings, options = {}) {
  const {
    slideNumber = 1,
    totalSlides = 1,
    theme = null,
    imageVibe = 'default',
    userPrompt = '',
    footerBranding,
  } = options;

  const promptText = String(userPrompt || instruction || '').trim();
  const isFullBleed = (slide?.templateId || slide?.type) === 'image-full';
  const pipeline = slide?.imageEditPipeline;
  const useUpliftPipeline =
    pipeline === 'uplift' ||
    (pipeline !== 'generate' && !isFullBleed && /class=["']frame-image["']/i.test(slide?.html || ''));

  if (useUpliftPipeline) {
    return upliftSlideWithImage(slide, settings, {
      userPrompt: promptText,
      slideNumber,
      theme,
      imageVibe,
      footerBranding,
    });
  }

  if (!settings?.imageModel) {
    throw new Error('Image slide edits require an image model in Settings.');
  }

  return generateImageSlide(instruction, settings, isFullBleed ? 'full' : 'content', {
    layoutGuidance: promptText,
    vibe: imageVibe,
    footerBranding: footerBranding ?? getClientProfileFooterBranding(settings, 'Strategy&'),
    slideNumber,
    totalSlides,
    existingImageDataUri: extractImageDataUri(slide?.html),
    theme,
  });
}

export async function generateImageSlide(instruction, settings, mode = 'content', contextInfo = {}) {
  const { layoutGuidance, vibe, footerBranding = 'Strategy&', slideNumber = 1, totalSlides, existingImageDataUri, imageModelRef, theme = null } = contextInfo;
  const imageGenOptions = imageModelRef ? { modelRef: imageModelRef } : {};

  const vibeContext = (vibe && !isBaseVibe(vibe)) ? getVibePromptContext(vibe) : '';
  const activeProfile = getActiveClientProfile(settings);
  const clientProfileContext = buildFrameImageStyleContext(settings, theme, {
    imageVibe: vibe,
    includeTheme: true,
    includeVibe: false,
    includeComponents: true,
    includeValidation: true,
  });

  // Clean instruction for IMAGE prompt: strip all metadata (vibe tags, search hints, context blocks)
  // These should NOT appear in the image or be rendered as text
  const cleanInstruction = instruction
    .replace(/\[Design Style:[^\]]*\]/g, '')               // strip vibe tags
    .replace(/\[Vibe:[^\]]*\]/g, '')                        // strip vibe short hints
    .replace(/\[SEARCH THE WEB[^\]]*\]/g, '')              // strip search hints
    .replace(/\[CONTEXT FROM EXISTING SLIDES[\s\S]*$/g, '') // strip slide context blocks
    .replace(/Layout\/Design Instructions:[\s\S]*/s, '')   // strip layout section, keep topic/content before it
    .trim();

  // Text instruction for TITLE/SUBTITLE generation: preserve search directives so the text
  // model can use web search (via _extraTools) to ground titles in real data.
  // CRITICAL: Strip ALL visual/layout guidance — only keep the substantive content message.
  const textInstruction = instruction
    .replace(/\[Design Style:[^\]]*\]/g, '')               // strip vibe tags
    .replace(/\[Vibe:[^\]]*\]/g, '')                        // strip vibe short hints
    .replace(/\[CONTEXT FROM EXISTING SLIDES[\s\S]*$/g, '') // strip slide context blocks
    .replace(/Layout\/Design Instructions:[\s\S]*/s, '')   // strip layout section, keep topic/content before it
    // Strip visual guidance patterns — template placeholders and framework descriptions
    .replace(/\[Main heading[^\]]*\]/gi, '')                // strip "[Main heading that summarizes...]"
    .replace(/\[Subtitle[^\]]*\]/gi, '')                    // strip "[Subtitle]" or "[Subtitle text]"
    .replace(/\[Card \d[^\]]*\]/gi, '')                     // strip "[Card 1 Title]", "[Card 2 description]"
    .replace(/\[Icon\]/gi, '')                              // strip "[Icon]"
    .replace(/\[Company\]/gi, '')                           // strip "[Company]"
    .replace(/\[Key point \d\]/gi, '')                      // strip "[Key point 1]"
    .replace(/\[Metric[^\]]*\]/gi, '')                      // strip "[Metric 1]" etc.
    .replace(/\[Area \d[^\]]*\]/gi, '')                     // strip "[Area 1 Title]" etc.
    .replace(/\[Brief description[^\]]*\]/gi, '')           // strip "[Brief description...]"
    .replace(/\[Your [\w\s]+ here\]/gi, '')                 // strip "[Your title here]" etc.
    .trim();

  // When layoutGuidance exists, use it as the visual structure directive. But also pass the
  // instruction content so the image model knows what data, labels, and entities to put IN the
  // diagram — not just the diagram shape. Without content, the image model creates generic
  // diagrams with placeholder labels instead of real data.
  let visualDirective;
  let contentContext = '';
  if (layoutGuidance) {
    visualDirective = layoutGuidance;
    // Extract the substantive content from the instruction (strip metadata, keep data/message)
    // This tells the image model WHAT to put in the visual structure
    const contentForImage = cleanInstruction
      .replace(/\[RESEARCH DATA[^\]]*\]/g, '')        // strip research header tags
      .replace(/\[VISUAL LAYOUT:[^\]]*\]/g, '')        // strip layout tags (already in layoutGuidance)
      .slice(0, 800);                                   // cap to avoid overwhelming the image model
    if (contentForImage.length > 30) {
      contentContext = `\n\nCONTENT TO REPRESENT IN THE VISUAL:\n${contentForImage}\n\nUse the ACTUAL data points, names, labels, and numbers from the content above in your diagram. Do NOT use generic placeholders like "Item 1", "Category A" — use the real entities and values from the content.`;
    }
  } else {
    // No layout guidance — use the instruction itself as both visual hint and content
    visualDirective = cleanInstruction.slice(0, 400);
  }

  // Build the image prompt — reframe as "raw content image", NOT a slide
  const imagePrompt = `You are generating a CONTENT IMAGE for a strategy consulting slide (${activeProfile.name || 'Strategy&'} style). This is NOT a slide — it is a raw visual that will be embedded inside an existing HTML slide that already has its own title, subtitle, and footer. Your job is ONLY to produce the visual content itself.

DO NOT INCLUDE ANY OF THESE — they already exist in the HTML around this image:
• NO title, heading, or header text of any kind
• NO subtitle or label text at the top
• NO footer, source line, caption, or page number
• NO border, frame, outline, or surrounding box
• NO rounded corners, card shapes, or drop shadows
• NO background shape or container wrapping the content
• NO decorative vertical bar or accent stripe along the left or right edge

THE IMAGE MUST BE: just the raw framework/diagram on a plain white background, edge-to-edge, with NO surrounding elements.

TARGET DIMENSIONS: ${mode === 'full' ? 'Wide landscape 16:9 (960×540 container)' : 'Extra-wide landscape ~2.5:1 (904×366 container) — arrange content horizontally, keep it short and wide, not tall'}

VISUAL TO GENERATE: ${visualDirective}
${contentContext}
VERTICAL LOGIC: This image will appear below a title (h1) that states a "so what" insight. Your visual must SUPPORT that claim with evidence, structure, or a framework. The reader should look at the title, then the image, and think "yes, the data/structure proves the title's point." Do NOT generate a generic illustration — generate a specific analytical visual that substantiates the argument. Use the REAL content (names, numbers, entities) from the instruction — not generic placeholders.

CONSULTING VISUAL STYLE — Think like a top-tier consulting slide designer:
Use structured consulting frameworks, NOT generic infographics. Examples of what to generate:
- Value chains (horizontal flow of connected stages with labels)
- Chevron arrows (sequential process steps, left to right)
- 2×2 matrices (labeled axes, items in quadrants)
- SWOT / PESTEL grids (labeled quadrants or sections)
- Waterfall charts (incremental bars showing build-up or breakdown)
- Pyramid / triangle diagrams (layered hierarchy)
- Hub-and-spoke models (central concept with connected elements)
- Comparison tables (simple rows/columns with check marks or values)
- Stacked bar breakdowns (segment composition)
- Funnel diagrams (stages narrowing down)
- Venn diagrams (2-3 overlapping circles)
- Roadmap / timeline (horizontal phases with milestones)
- Bridge charts (walk from A to B with incremental steps)
DO NOT generate: decorative illustrations, stock-photo-style scenes, abstract art, generic infographics with random shapes, or clip-art style visuals. This is CONSULTING, not marketing.

EXECUTION: Flat shapes, thin clean lines, solid fills. NO photographs, NO gradients, NO 3D effects, NO decorative flourishes.

CLIENT-READY IMAGE — absolutely NO metadata, technical specs, or implementation details visible:
- NEVER show font names, font sizes, point values, pixel values, hex color codes, or CSS properties as text in the image
- NEVER show labels like "12pt", "14px", "Arial", "Bold", "#8E1E1E", "maroon" or similar technical annotations
- The image must look like it came from a professional design agency — clean, polished, ready to present to a C-suite client
- Only CONTENT labels appear in the image: category names, data values, axis labels, short descriptions

TEXT LABELS:
- All body text should be small and uniform in size — think standard diagram label size
- Section headings and axis titles can be slightly larger and bold, but only slightly
- Keep all labels to 3-4 words max. NO long sentences.
- Every label must have strong contrast: dark text on light fills, white text on dark fills

${clientProfileContext ? `\nACTIVE CLIENT PROFILE GUIDANCE:\n${clientProfileContext}\n` : ''}
${vibeContext ? `STYLE VARIATION: ${vibeContext}\n` : ''}${existingImageDataUri ? 'EDIT MODE: A reference image is provided. Modify it according to the instructions above while preserving its overall structure and style.\n' : ''}Content must fill the entire image area edge-to-edge with no margins or padding.`;

  console.log(`[generateImageSlide] mode=${mode}, instruction="${instruction.slice(0, 100)}...", layoutGuidance="${layoutGuidance || 'none'}", hasExistingImage=${!!existingImageDataUri}`);

  if (mode === 'full') {
    // Full image slide — just generate the image (pass reference if editing)
    const imageDataUri = await generateImage(imagePrompt, settings, existingImageDataUri || null, imageGenOptions);
    const title = (textInstruction || cleanInstruction).slice(0, 80).replace(/[<>"]/g, '').replace(/\[[^\]]*\]/g, '').trim();

    return {
      id: `slide-${Date.now()}`,
      title,
      html: `<div class="slide slide-image-full">
  <img src="${imageDataUri}" alt="${title}" class="slide-image-cover" />
</div>`,
      type: 'image-full',
      templateId: 'image-full',
      imageEditPipeline: 'generate',
    };

  } else {
    // Image-content mode: generate image + text in parallel
    const textPrompt = `Based on this content instruction, generate slide text components in the style of a senior Strategy& consultant.

FULL CONTENT INSTRUCTION (use this to understand WHAT the slide is about):
${textInstruction}
${layoutGuidance ? `\n(DO NOT use this in title/subtitle — this is only context about what the accompanying image depicts: ${layoutGuidance})` : ''}

VERTICAL LOGIC is CRITICAL: The title (h1) is the "so what" — it makes the key claim or insight. The image visual (being generated separately) provides the EVIDENCE or STRUCTURE that supports that claim. Title and visual must tell a coherent story together.

CONTENT FIDELITY: Ground your title in the ACTUAL content above. The user's specific data, claims, and terminology must appear in the title — do NOT replace them with vague labels.
- If instruction has a clear "so what" sentence, USE IT as the title (lightly trim to 8-12 words if needed, but keep the user's key words and data).
- If instruction says "Revenue grew 18% driven by APAC expansion" → title: "APAC expansion drives 18% revenue growth" (user's data preserved)
- If instruction says "3 risks: supply chain (high), currency (medium), regulation (low)" → title: "Supply chain risk dominates the risk landscape" (user's entities preserved)
- If instruction contains questions, keep them as questions in the title.
- Do NOT invent data or claims that aren't in the instruction.
- Do NOT replace specific content with generic labels (e.g., "Revenue grew 18%" → "Financial Performance Overview" is WRONG).

CRITICAL — TITLE AND SUBTITLE MUST BE PURE CONTENT, NEVER VISUAL GUIDANCE:
- NEVER describe the visual format in the title (e.g., "2x2 matrix shows..." or "Three-pillar framework for..." is WRONG)
- NEVER reference diagram types, chart types, axes, quadrants, or layout structures in the title
- NEVER use template placeholder text like "[Main heading...]", "[Subtitle]", "[Card Title]" etc.
- The title states the BUSINESS INSIGHT or STRATEGIC CLAIM — what the audience should CONCLUDE
- The subtitle is a short TOPIC LABEL (e.g., "Market Analysis", "Growth Strategy") — never a visual description
- BAD title: "Hub-and-spoke model for digital capabilities" (describes the diagram, not the insight)
- BAD title: "2x2 matrix of implementation complexity vs impact" (describes axes, not the conclusion)
- GOOD title: "Four digital capabilities anchor the transformation" (states the insight the visual proves)
- GOOD title: "High-impact initiatives require minimal complexity" (states the conclusion from the matrix)

Generate:
1. title: An insight-driven "so what" sentence (8-12 words max, NEVER end with a period). This is the KEY TAKEAWAY — what should the reader conclude from looking at the visual? Must contain a verb and make a strategic claim grounded in the actual content.
   - GOOD: "Three capability gaps limit our market expansion" (title) + (image shows a gap analysis framework)
   - GOOD: "Digital maturity drives 40% higher margins" (title) + (image shows correlation chart)
   - BAD: "Digital Maturity Overview" (just a label, no insight)
   - BAD: "Our digital transformation journey." (period at end, no "so what")
2. subtitle: A short section/topic label (2-3 words, noun phrase, no verbs). NEVER a diagram/chart type description.
3. footer: Brief source attribution if relevant, or leave empty

NEVER include metadata tags like [Design Style: ...], [Vibe: ...], or [SEARCH ...] in the title or subtitle — those are system metadata, not content.
NEVER include visual guidance like diagram types, chart labels, framework names, axes descriptions, or layout instructions in the title or subtitle — those describe the IMAGE, not the INSIGHT.

Return ONLY valid JSON: {"title": "...", "subtitle": "...", "footer": ""}`;

    // Run image generation and text generation in parallel (pass reference image if editing)
    const [imageDataUri, textContent] = await Promise.all([
      generateImage(imagePrompt, settings, existingImageDataUri || null, imageGenOptions),
      callWithModelFallback(settings, 'You are a Strategy& consulting presentation writer. Return only valid JSON.', textPrompt),
    ]);

    // Parse text response — use textInstruction (content-only) as fallback, not cleanInstruction
    const fallbackTitle = (textInstruction || cleanInstruction).slice(0, 60);
    let title = fallbackTitle;
    let subtitle = '';
    let footer = '';
    try {
      const cleaned = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      title = parsed.title || fallbackTitle;
      subtitle = parsed.subtitle || '';
      footer = parsed.footer || '';
    } catch (e) {
      console.warn('[generateImageSlide] Failed to parse text response, using fallback title:', e.message);
    }

    // Post-process: strip any visual guidance that leaked into title/subtitle
    const stripVisualGuidance = (text) => text
      .replace(/\[[^\]]*\]/g, '')                          // strip all bracket placeholders
      .replace(/\b\d+[x×]\d+\s*(matrix|grid)\b/gi, '')    // strip "2x2 matrix" etc.
      .replace(/\b(x-axis|y-axis|quadrant|hub-and-spoke|chevron|funnel|venn|waterfall)\b/gi, '') // strip chart jargon
      .replace(/\s{2,}/g, ' ')                             // collapse multiple spaces
      .trim();
    title = stripVisualGuidance(title);
    subtitle = stripVisualGuidance(subtitle);
    // If title got stripped to empty, use fallback
    if (!title) title = fallbackTitle;

    const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeSubtitle = subtitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeFooter = footer.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return {
      id: `slide-${Date.now()}`,
      title,
      html: `<div class="slide">
  <h1 class="title">${safeTitle}</h1>
  ${safeSubtitle ? `<h2 class="subtitle">${safeSubtitle}</h2>` : ''}
  <div class="frame">
    <img src="${imageDataUri}" alt="${safeTitle}" class="frame-image" />
  </div>
  <footer class="footer"><span>${footerBranding}</span><span class="source"></span><span>${slideNumber}</span></footer>
</div>`,
      type: 'image-content',
      templateId: 'image-content',
      imageEditPipeline: 'generate',
    };
  }
}

// Layout guidance patterns for freestyle slides — prevents overlap and overflow
// by giving the AI specific structural constraints for each layout type.
export const LAYOUT_GUIDANCE_MAP = {
  '2x2': {
    label: '2×2 Grid',
    instruction: `LAYOUT: 2×2 GRID (4 items in a square grid)
- Use <div class="grid-2x2"> with exactly 4 <div class="grid-cell"> children
- Each cell: <h4> title (max 5 words) + <p> description (max 20 words) or a short <ul> (2-3 items)
- Total grid height MUST stay under 320px — keep cell content SHORT
- DO NOT add cards, KPIs, or other components outside the grid
- DO NOT nest grids or add extra rows — exactly 4 cells, no more`,
  },
  '3-cards': {
    label: '3 Cards',
    instruction: `LAYOUT: 3 HORIZONTAL CARDS
- Use <div class="card-row"> with exactly 3 <div class="card"> children
- Each card: icon circle + card-num + <h3> title (max 4 words) + <p> (max 15 words) + optional impact-box
- Card row height MUST stay under 300px — no extra content below the cards
- DO NOT add bullets, KPIs, or other elements outside the card-row`,
  },
  '4-cards': {
    label: '4 Cards',
    instruction: `LAYOUT: 4 HORIZONTAL CARDS (tight spacing)
- Use <div class="card-row"> with exactly 4 <div class="card"> children
- Each card: icon circle + <h3> title (max 3 words) + <p> (max 15 words)
- OMIT impact-box to save space — 4 cards are tight
- Card row height MUST stay under 300px
- DO NOT add any content outside the card-row — no bullets, no KPIs below`,
  },
  'icons': {
    label: 'Icon-Led Items',
    instruction: `LAYOUT: ICON-LED ITEMS (3-6 items, each with icon + title + description)
- Use <div class="card-row"> or <div class="grid-2x2"> / <div class="grid-3x2"> depending on item count
- 3 items → card-row with 3 cards (icon + title + desc)
- 4 items → grid-2x2 (icon + title + desc in each cell)
- 5-6 items → grid-3x2 (icon + title + short desc)
- Each item: prominent emoji icon + <h3>/<h4> title (max 4 words) + <p> (max 20 words)
- Total height MUST stay under 340px — scale description length to item count`,
  },
  'numbered': {
    label: 'Numbered Steps',
    instruction: `LAYOUT: NUMBERED LIST / PROCESS STEPS
- Use <div class="agenda-list"> with <div class="agenda-item"> children, OR
  <div class="process-flow"> with <div class="process-step"> + <div class="process-arrow"> for horizontal flow
- For vertical list (4+ items): agenda-list — each item has agenda-num (01, 02...) + h4 title + p description
- For horizontal flow (3-4 steps): process-flow — each step has step-number + h4 + p
- Max 6 items for vertical, max 4 for horizontal
- Keep descriptions under 15 words each
- Total height MUST stay under 350px — if 6 items, use very short descriptions`,
  },
  'split': {
    label: 'Two-Column Split',
    instruction: `LAYOUT: TWO-COLUMN SPLIT
- Use <div class="split-layout"> or <div class="two-col"> for left/right layout
- Left side: one content type (KPIs, stat-highlight, or content list)
- Right side: different content type (bullets, description, or styled-list)
- Each column MUST stay under 350px height
- DO NOT stack more than one component per column
- Good combos: stat-highlight left + bullets right, KPI blocks left + description right`,
  },
  'kpi-row': {
    label: 'KPI Metrics Row',
    instruction: `LAYOUT: KPI METRICS ROW (3-5 big numbers)
- Use a horizontal flex container with 3-5 <div class="kpi-block"> items
- Each KPI: <div class="kpi-value"> (big number/stat) + <div class="kpi-label"> (short label, max 4 words)
- KPI row height is naturally ~100px — you can add ONE supporting element below (content-list with max 4 bullets, or a text-callout)
- DO NOT add cards, grids, or heavy content below KPIs — keep it light`,
  },
  'bullets': {
    label: 'Bullet Points',
    instruction: `LAYOUT: CLEAN BULLET LIST
- Use <ul class="content-list"> with <li> items
- Maximum 4-5 bullet points — fewer is better, keep it scannable
- Each bullet: max 12 words, start with a bold key phrase
- You may add ONE element above (e.g., a short intro paragraph or text-callout)
- Total content height MUST stay under 350px
- DO NOT add cards, grids, or KPIs alongside bullets`,
  },
  'timeline': {
    label: 'Timeline',
    instruction: `LAYOUT: TIMELINE (3-6 milestones)
- Use <div class="timeline-container"> with <div class="timeline-row"> children
- Each row: <div class="timeline-marker"> (Q1, 2024, Phase 1, etc.) + <div class="timeline-content"> with <h4> + <p>
- Maximum 5 rows to prevent overflow — if more milestones, use only key ones
- Keep descriptions under 15 words each
- Total height MUST stay under 350px`,
  },
  'comparison': {
    label: 'Comparison',
    instruction: `LAYOUT: COMPARISON (side-by-side or table)
- For 2 options: use <div class="split-layout"> — each side gets a header + bullet list
- For 3+ options: use <table class="comparison-table"> with thead + tbody
- Table: max 5 rows, max 4 columns — use score-high/score-med/score-low classes for visual coding
- Split: max 5 bullets per side
- Total height MUST stay under 350px — reduce rows/bullets if needed`,
  },
  'stat-focus': {
    label: 'Stat Focus',
    instruction: `LAYOUT: SINGLE STAT FOCUS (one big number with context)
- Use <div class="stat-highlight"> as the centerpiece — one big number with label
- Below: optional text-callout or content-list (max 3 bullets) for context
- This layout should feel SPACIOUS — lots of white space around the stat
- Total content height MUST stay under 250px
- DO NOT add cards, grids, or heavy content — the stat IS the slide`,
  },
  'mixed': {
    label: 'Mixed Layout',
    instruction: `LAYOUT: MIXED / COMBINATION (use with caution — highest overflow risk)
- Combine at most 2 component types (e.g., KPI row + bullet list, or stat-highlight + card-row)
- CRITICAL: Total height budget is 350px. Plan before building:
  * KPI row: ~100px, Card row: ~280px, Bullet list: ~25px/item, Grid 2x2: ~320px
  * NEVER combine card-row + grid (overflow guaranteed)
  * NEVER combine card-row + bullet list with 4+ items
- Safe combos: KPI row (~100px) + bullets (4 items ~100px) = ~200px ✓
- Unsafe combos: card-row (~280px) + bullets (4 items ~100px) = ~380px ✗`,
  },
};
