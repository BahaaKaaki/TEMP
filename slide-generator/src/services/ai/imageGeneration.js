import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import { getVibePromptContext, isBaseVibe } from '../../utils/vibes';
import { parseModelRef, findProvider, getCredentials, buildProviderHeaders, buildGeminiEndpoint, buildGeminiHeaders, isGemini3Model, isGemini25Model, extractGeminiResponseText } from './models.js';
import { callWithModelFallback, getFallbackModels } from './apiClient.js';
import { TITLE_HEADER_RULES } from './constants.js';

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
export async function generateImage(imagePrompt, settings, referenceImageDataUri = null) {
  const imageModelRef = settings.imageModel;
  if (!imageModelRef) {
    throw new Error('No image model configured. Set imageModel in Settings (e.g., "pwc:gemini-3-pro-image-preview").');
  }

  try {
    return await _generateImageInner(imagePrompt, settings, referenceImageDataUri, imageModelRef);
  } catch (err) {
    if (err.message?.includes('rate limit') || err.message?.includes('429')) throw err;

    const { providerId, modelName } = parseModelRef(imageModelRef);
    const fallbacks = getFallbackModels(settings, providerId, modelName, 'image');
    if (fallbacks.length === 0) throw err;

    console.warn(`[ImageGen] Primary model "${modelName}" failed: ${err.message.slice(0, 150)}`);

    for (const fb of fallbacks) {
      try {
        const fbRef = `${providerId}:${fb}`;
        console.log(`[ImageGen] Trying fallback image model: ${fbRef}`);
        return await _generateImageInner(imagePrompt, { ...settings, imageModel: fbRef }, referenceImageDataUri, fbRef);
      } catch (fbErr) {
        if (fbErr.message?.includes('rate limit') || fbErr.message?.includes('429')) throw fbErr;
        console.warn(`[ImageGen] Fallback "${fb}" also failed: ${fbErr.message.slice(0, 100)}`);
      }
    }
    throw err;
  }
}

async function _generateImageInner(imagePrompt, settings, referenceImageDataUri, imageModelRef) {
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
    const isPwcOrProxy = apiUrl.includes('/chat/completions') || isAzureStyle;
    const requestModel = isAzureStyle ? `azure.${modelName}` : modelName;

    if (isPwcOrProxy) {
      // PwC / Azure-style proxy: use the existing /chat/completions endpoint.
      // Send OpenAI-format messages + Gemini-specific generationConfig fields.
      // The proxy forwards these extra fields to the Gemini backend.
      const geminiEndpoint = apiUrl; // keep /chat/completions as-is

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

  // ── OpenAI-compatible (GPT-Image-1, DALL-E 3, Azure proxies) ──
  let imageEndpoint;
  if (apiUrl.includes('/chat/completions')) {
    imageEndpoint = apiUrl.replace('/chat/completions', '/images/generations');
  } else if (apiUrl.includes('api.openai.com')) {
    imageEndpoint = 'https://api.openai.com/v1/images/generations';
  } else {
    imageEndpoint = apiUrl.replace(/\/+$/, '') + '/images/generations';
  }

  const azureModel = isAzureStyle ? `azure.${modelName}` : modelName;
  const requestBody = {
    model: azureModel,
    prompt: imagePrompt,
    n: 1,
    size: isGptImage1 ? '1536x1024' : (isDallE ? '1792x1024' : '1024x1024'),
    quality: isGptImage1 ? 'high' : 'hd',
  };
  if (isGptImage1) {
    requestBody.output_format = 'b64_json';
  } else {
    requestBody.response_format = 'b64_json';
  }

  console.log('[generateImage] OpenAI image call:', { imageEndpoint, model: azureModel, provider: providerId });

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

      const response = await fetch(endpoint, {
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

      console.log('[generateImage] Image generated successfully');
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
// Extract base64 image data URI from slide HTML (for image editing)
export function extractImageDataUri(html) {
  if (!html) return null;
  const match = html.match(/src="(data:image\/[^"]+)"/);
  return match ? match[1] : null;
}

export async function generateImageSlide(instruction, settings, mode = 'content', contextInfo = {}) {
  const { layoutGuidance, vibe, footerBranding = 'Strategy&', slideNumber = 1, totalSlides, existingImageDataUri } = contextInfo;

  // Only inject vibe variation for non-base vibes — base vibe is the default consulting style
  const vibeContext = (vibe && !isBaseVibe(vibe)) ? getVibePromptContext(vibe) : '';

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
  const imagePrompt = `You are generating a CONTENT IMAGE for a strategy consulting slide (Strategy&/McKinsey/BCG style). This is NOT a slide — it is a raw visual that will be embedded inside an existing HTML slide that already has its own title, subtitle, and footer. Your job is ONLY to produce the visual content itself.

DO NOT INCLUDE ANY OF THESE — they already exist in the HTML around this image:
• NO title, heading, or header text of any kind
• NO subtitle or label text at the top
• NO footer, source line, caption, or page number
• NO border, frame, outline, or surrounding box
• NO rounded corners, card shapes, or drop shadows
• NO background shape or container wrapping the content
• NO decorative vertical bar or accent stripe along the left or right edge

THE IMAGE MUST BE: just the raw framework/diagram on a plain white background, edge-to-edge, with NO surrounding elements.

TARGET DIMENSIONS: ${mode === 'full' ? 'Wide landscape 16:9 (960×540 container)' : 'Extra-wide landscape ~2.5:1 (890×353 container) — arrange content horizontally, keep it short and wide, not tall'}

VISUAL TO GENERATE: ${visualDirective}
${contentContext}
VERTICAL LOGIC: This image will appear below a title (h1) that states a "so what" insight. Your visual must SUPPORT that claim with evidence, structure, or a framework. The reader should look at the title, then the image, and think "yes, the data/structure proves the title's point." Do NOT generate a generic illustration — generate a specific analytical visual that substantiates the argument. Use the REAL content (names, numbers, entities) from the instruction — not generic placeholders.

CONSULTING VISUAL STYLE — Think like a Strategy& or McKinsey slide designer:
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

VISUAL STYLE:
- Primary accent color: deep maroon/burgundy for key shapes, highlights, and emphasis
- Body text: near-black on white or light backgrounds
- Shape fills: very light grey or pale rose for cards and surfaces
- Borders and dividers: light grey, thin lines
- Positive indicators: green. Negative: red. Caution: amber. Info: blue.
- Background: plain white, edge to edge
- Do NOT invent bright or neon colors — keep the palette muted and professional
${vibeContext ? `STYLE VARIATION: ${vibeContext}\n` : ''}${existingImageDataUri ? 'EDIT MODE: A reference image is provided. Modify it according to the instructions above while preserving its overall structure and style.\n' : ''}Content must fill the entire image area edge-to-edge with no margins or padding.`;

  console.log(`[generateImageSlide] mode=${mode}, instruction="${instruction.slice(0, 100)}...", layoutGuidance="${layoutGuidance || 'none'}", hasExistingImage=${!!existingImageDataUri}`);

  if (mode === 'full') {
    // Full image slide — just generate the image (pass reference if editing)
    const imageDataUri = await generateImage(imagePrompt, settings, existingImageDataUri || null);
    const title = (textInstruction || cleanInstruction).slice(0, 80).replace(/[<>"]/g, '').replace(/\[[^\]]*\]/g, '').trim();

    return {
      id: `slide-${Date.now()}`,
      title,
      html: `<div class="slide slide-image-full">
  <img src="${imageDataUri}" alt="${title}" class="slide-image-cover" />
</div>`,
      type: 'image-full',
      templateId: 'image-full',
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
      generateImage(imagePrompt, settings, existingImageDataUri || null),
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
