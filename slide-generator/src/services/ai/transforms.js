import { debugLog, LogLevel } from '../../utils/debugLog';
import { getCredentials, buildProviderHeaders } from './models.js';
import { callWithModelFallback, buildRequestBody, parseAPIResponseContent } from './apiClient.js';
import { appendPptxHintsGuide } from './freestylePromptBuilder.js';

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
        [{ role: 'system', content: appendPptxHintsGuide(systemPrompt) }, { role: 'user', content: userPrompt }]
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
 * Extract structured content from slide HTML so the reimagine prompt
 * receives plain text anchors instead of the original markup.
 */
function extractSlideContent(html) {
  const text = (regex) => {
    const m = html.match(regex);
    return m ? m[1].replace(/<[^>]*>/g, '').trim() : '';
  };

  const title = text(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const subtitle = text(/<h2[^>]*>([\s\S]*?)<\/h2>/i);

  const footerMatch = html.match(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/i);
  const footer = footerMatch ? footerMatch[0] : '';

  let bodyHtml = html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '')
    .replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, '')
    .replace(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/i, '')
    .replace(/<div[^>]*class="[^"]*section-tracker[^"]*"[^>]*>[\s\S]*?<\/div>/i, '');

  const bodyText = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div|td|th|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, subtitle, bodyText, footer };
}

/**
 * Reimagine a slide's visual layout for a specific vibe.
 * Extracts content first so the AI builds a fresh layout around
 * immutable title/subtitle anchors.
 */
export async function reimagineSlideWithVibe(slideHtml, vibeId, vibeConfig, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  console.log('[reimagineSlideWithVibe] Starting: vibeId=%s, model=%s', vibeId, creds.model);

  const { title, subtitle, bodyText, footer } = extractSlideContent(slideHtml);
  console.log('[reimagineSlideWithVibe] Extracted — title: %s, subtitle: %s, body length: %d',
    title.substring(0, 60), subtitle.substring(0, 40), bodyText.length);

  const systemPrompt = `You are a Strategy& presentation designer who REIMAGINES slide layouts.

=== YOUR TASK ===
Create a completely NEW visual layout and design for the content below.
You are NOT restyling existing HTML — you are designing from scratch.

=== IMMUTABLE TEXT — COPY EXACTLY, CHARACTER FOR CHARACTER ===
${title ? `H1 TITLE (use verbatim as the <h1>): "${title}"` : '(no title)'}
${subtitle ? `H2 SUBTITLE (use verbatim as the <h2>): "${subtitle}"` : '(no subtitle)'}

These strings are LOCKED. Do not rephrase, shorten, reword, or paraphrase them.
If you change even one word in the title or subtitle, the output is INVALID.

=== BODY CONTENT TO PRESENT ===
${bodyText}

Present this body content using a fresh layout of your choosing.
You may restructure how information is grouped (cards, lists, columns, etc.)
but every fact, number, label, and sentence must appear in the output.

=== VISUAL STYLE: "${vibeConfig.name}" ===
${vibeConfig.gptDescription || vibeConfig.description}
${vibeConfig.patterns || ''}

=== TECHNICAL CONSTRAINTS ===
- Frame content: max 860px wide × 350px tall
- Font sizes: body 11-14px, titles 14-17px, accent numbers up to 48px
- Colors: #8E1E1E (maroon), #A32020 (red), #111111 (text), #4A4F57 (grey), #E6E9EE (border), #F7F9FB (bg)
${footer ? `- Include this exact footer at the end of the slide div:\n${footer}` : ''}

=== OUTPUT FORMAT ===
Return ONLY valid HTML starting with <div class="slide ...> and ending with </div>.
No markdown fences, no explanation.`;

  const userPrompt = `Reimagine this slide with the "${vibeConfig.name.toUpperCase()}" style.

CRITICAL REMINDERS:
- The <h1> must contain EXACTLY: "${title}"
- The <h2> must contain EXACTLY: "${subtitle}"
- Design a FRESH layout — do NOT copy the original HTML structure
- Every piece of body content must appear in the output
- Output complete slide HTML only`;

  try {
    let content;

    content = await callWithModelFallback(settings, appendPptxHintsGuide(systemPrompt), userPrompt);

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
