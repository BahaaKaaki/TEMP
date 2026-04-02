import { debugLog, LogLevel } from '../../utils/debugLog';
import { getVibePromptContext, isBaseVibe } from '../../utils/vibes';
import { getCredentials, buildProviderHeaders } from './models.js';
import { callWithModelFallback, buildRequestBody, parseAPIResponseContent } from './apiClient.js';

// Transform element content into a widget format using GPT
// This takes the existing content of an element and transforms it into a specified widget type
// vibeHint: optional string like "Minimal icons, sharp corners..." from getVibePromptContext()
export async function transformElementToWidget(elementContent, widgetTemplate, settings, vibeHint = '') {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Extract text content from HTML if provided as HTML
  const textContent = elementContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // Build vibe-aware instructions
  const vibeInstruction = vibeHint ? `\n- Design style: ${vibeHint}` : '';

  const systemPrompt = `You are an expert at transforming content into structured HTML widgets for executive presentations.

Your task: Take the user's existing content and fit it into the provided widget HTML template.
- PRESERVE the meaning and key information from the original content
- FILL IN all placeholders like [Title], [Value], [Description] etc. with actual content
- Use the original content to inform what goes in each placeholder
- If the original content doesn't have enough for all placeholders, create sensible content that fits
- Keep text professional - this is for executive presentations
- Numbers should look real and specific (not just "XX%")
- Use appropriate icons/emojis where placeholders like [Icon] exist${vibeInstruction}

IMPORTANT: Return ONLY the filled-in HTML widget. No explanations, no markdown code blocks, just the raw HTML.`;

  const userPrompt = `Original Element Content:
${textContent}

Widget Template to fill:
${widgetTemplate}

Transform the original content into this widget format. Return only the filled HTML.`;

  try {
    const response = await fetch(creds.apiEndpoint, {
      method: 'POST',
      headers: buildProviderHeaders(creds),
      body: JSON.stringify(buildRequestBody(
        { ...settings, temperature: 0.7, maxTokens: 2000 },
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      )),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let widgetHtml = parseAPIResponseContent(data, creds)?.trim();

    if (!widgetHtml) {
      throw new Error('No response from AI');
    }

    // Clean up any markdown code blocks if present
    widgetHtml = widgetHtml.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();

    return widgetHtml;
  } catch (error) {
    console.error('[transformElementToWidget] Error:', error);
    throw error;
  }
}

// ============================================
// VIBE REIMAGINATION
// ============================================

/**
 * Reimagine a slide's visual layout for a specific vibe
 * Uses the same API infrastructure as other AI functions
 *
 * @param {string} slideHtml - The original slide HTML
 * @param {string} vibeId - The target vibe (bold, corporate, creative, data, minimal)
 * @param {Object} vibeConfig - Vibe configuration { name, description, patterns }
 * @param {Object} settings - API settings
 * @returns {Promise<string>} - The reimagined slide HTML
 */
export async function reimagineSlideWithVibe(slideHtml, vibeId, vibeConfig, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  console.log(`[reimagineSlideWithVibe] Starting: vibeId=${vibeId}, model=${creds.model}`);

  const systemPrompt = `You are a Strategy& presentation designer applying the "${vibeConfig.name}" visual style.

=== CRITICAL: WHAT YOU MUST PRESERVE ===
1. CONTENT ESSENCE - The slide's message, data, arguments, and conclusions must remain identical. Do NOT rewrite, rephrase, summarize, or add content.
2. ALL TEXT - Every word, number, label, bullet point must appear exactly as in the original. No paraphrasing.
3. LAYOUT STRUCTURE - If slide has 3 cards, output must have 3 cards. If it has a table, keep the table. If it has a timeline, keep the timeline. NEVER flatten to plain text.
4. SEMANTIC MEANING - Cards stay cards, lists stay lists, metrics stay metrics

=== WHAT YOU CHANGE: VISUAL STYLING ONLY ===
Apply the "${vibeConfig.name}" vibe by changing ONLY:
- Colors and backgrounds
- Border styles and thickness
- Font weights and sizes (within limits)
- Shadows and rounded corners
- Icon/number styling
- Spacing and padding

${vibeConfig.gptDescription || vibeConfig.description}

${vibeConfig.patterns || ''}

=== TECHNICAL CONSTRAINTS ===
- Frame content: max 860px wide × 350px tall
- Font sizes: body 11-14px, titles 14-17px, accent numbers up to 48px
- Colors: #8E1E1E (maroon), #A32020 (red), #111111 (text), #4A4F57 (grey), #E6E9EE (border), #F7F9FB (bg)

=== OUTPUT FORMAT ===
Return ONLY valid HTML starting with <div class="slide ...> and ending with </div>. No markdown, no explanation.`;

  const userPrompt = `Apply "${vibeConfig.name.toUpperCase()}" visual styling to this slide.

ORIGINAL SLIDE:
${slideHtml}

INSTRUCTIONS:
1. Keep the EXACT same layout structure (same number of cards/rows/columns)
2. Keep ALL text content word-for-word — do NOT rewrite, rephrase, add, or remove any content
3. The slide's message and substance must be identical after reimagining
4. Only change visual styling: colors, borders, backgrounds, fonts, shadows
5. Output complete slide HTML only`;

  try {
    let content;

    content = await callWithModelFallback(settings, systemPrompt, userPrompt);

    // Clean up markdown blocks first
    content = content
      .replace(/```html\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    // Extract just the slide HTML - find the opening <div class="slide and its matching closing </div>
    const slideStartMatch = content.match(/<div[^>]*class="[^"]*slide[^"]*"[^>]*>/i);
    if (!slideStartMatch) {
      console.warn('[reimagineSlideWithVibe] No slide div found in response');
      console.warn('[reimagineSlideWithVibe] Response preview:', content.substring(0, 500));
      throw new Error('Invalid HTML structure returned from API');
    }

    const slideStartIndex = content.indexOf(slideStartMatch[0]);

    // Find the matching closing </div> by counting nested divs
    let depth = 0;
    let slideEndIndex = -1;
    let i = slideStartIndex;

    while (i < content.length) {
      if (content.substring(i, i + 4).toLowerCase() === '<div') {
        depth++;
        i += 4;
      } else if (content.substring(i, i + 6).toLowerCase() === '</div>') {
        depth--;
        if (depth === 0) {
          slideEndIndex = i + 6;
          break;
        }
        i += 6;
      } else {
        i++;
      }
    }

    if (slideEndIndex === -1) {
      console.warn('[reimagineSlideWithVibe] Could not find matching closing div');
      throw new Error('Malformed HTML structure returned from API');
    }

    // Extract just the slide HTML
    const extractedHtml = content.substring(slideStartIndex, slideEndIndex).trim();

    console.log(`[reimagineSlideWithVibe] Success: Reimagined with ${vibeId} vibe (${extractedHtml.length} chars)`);
    return extractedHtml;

  } catch (error) {
    console.error('[reimagineSlideWithVibe] Error:', error.message);
    throw error;
  }
}
