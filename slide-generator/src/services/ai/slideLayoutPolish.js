import { callWithModelFallback } from './apiClient.js';
import { applyPromptOverride, recordPromptPayload } from './promptOverrides.js';
import { parseGeneratedSlides } from './slideGeneration.js';
import { slideUsesRasterFrameImage } from './imageGeneration.js';

const DEFAULT_LAYOUT_POLISH_SYSTEM = `You are a slide layout QA engineer for 960x540 consulting slides (HTML + scoped CSS).

Your job is to fix obvious VISUAL and LAYOUT defects in the body area. Typical fixes:
- White space misuse (large empty gaps, unbalanced padding/margins)
- Repeating tags, chips, or labels that should sit in an even grid (equal columns/rows, consistent gutters)
- Misaligned cards/boxes (uneven tops, ragged columns, different widths when they should match)
- Overlaps between elements
- Overflow (text or boxes pushed outside div.frame or past the slide bounds)
- Weak aesthetics (tighten spacing rhythm, align to a clear grid, balance visual weight)

STRICT — DO NOT CHANGE:
- h1.title: same text, attributes, and chrome band (do not move or restyle the title block)
- h2.subtitle: same text and band when present
- footer.footer: same content and structure
- Section tracker chrome on .slide (data-section, data-subsection, and related tracker attributes)
- Factual copy inside the frame (same words, numbers, and labels — reflow/wrap only, no rewrites)
- Brand palette: keep var(--token) and existing colors; do not invent new hex colors

You MAY change:
- CSS in <style> blocks (scoped to this slide)
- HTML structure and layout INSIDE div.frame only
- Flex/grid, gaps, sizes, alignment, and overflow rules to fit the 890x353px frame band

Return ONLY the corrected <style> block(s) plus the complete .slide HTML. No markdown fences, no commentary.`;

const CHROME_SELECTORS = ['h1.title', 'h2.subtitle', 'footer.footer'];

/**
 * @param {object} settings
 * @returns {boolean}
 */
export function isSlideLayoutPolishEnabled(settings) {
  return settings?.slideLayoutPolish !== false;
}

/**
 * @param {{ html?: string, customCSS?: string }} slide
 * @returns {boolean}
 */
export function shouldPolishSlide(slide) {
  const html = slide?.html || '';
  if (!html || !/\bclass=["'][^"']*slide\b/.test(html)) return false;
  if (slideUsesRasterFrameImage(html)) return false;
  if (/cover-slide|thank-you-slide|section-divider-slide|master-blank|master-emptyPage/i.test(html)) {
    return false;
  }
  return true;
}

/**
 * @param {{ html?: string, customCSS?: string }} slide
 * @returns {string}
 */
export function assembleSlideHtmlForPolish(slide) {
  const body = slide?.html || '';
  const css = slide?.customCSS?.trim();
  if (!css) return body;
  return `<style>\n${css}\n</style>\n${body}`;
}

/**
 * Restore title, subtitle, footer, and tracker attrs from the pre-polish slide.
 * @param {string} originalCombined
 * @param {string} polishedCombined
 * @returns {string}
 */
export function restoreSlideChrome(originalCombined, polishedCombined) {
  if (typeof DOMParser === 'undefined') return polishedCombined;
  try {
    const parser = new DOMParser();
    const toBody = (html) => {
      const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
      return doc.body;
    };
    const origBody = toBody(originalCombined);
    const polBody = toBody(polishedCombined);
    const origSlide = origBody.querySelector('.slide');
    const polSlide = polBody.querySelector('.slide');
    if (!origSlide || !polSlide) return polishedCombined;

    for (const attr of ['data-section', 'data-subsection', 'data-client-profile']) {
      if (origSlide.hasAttribute(attr)) {
        polSlide.setAttribute(attr, origSlide.getAttribute(attr));
      } else {
        polSlide.removeAttribute(attr);
      }
    }

    for (const sel of CHROME_SELECTORS) {
      const origEl = origSlide.querySelector(sel);
      const polEl = polSlide.querySelector(sel);
      if (origEl) {
        const clone = origEl.cloneNode(true);
        if (polEl) polEl.replaceWith(clone);
        else polSlide.insertBefore(clone, polSlide.firstChild);
      } else if (polEl) {
        polEl.remove();
      }
    }

    const styles = [...polBody.querySelectorAll('style')].map((s) => s.outerHTML).join('\n');
    return styles ? `${styles}\n${polSlide.outerHTML}` : polSlide.outerHTML;
  } catch (err) {
    console.warn('[LayoutPolish] restoreSlideChrome failed:', err?.message || err);
    return polishedCombined;
  }
}

/**
 * @param {string} raw
 * @param {{ html?: string, customCSS?: string, title?: string }} originalSlide
 * @returns {{ html: string, customCSS?: string, title?: string }}
 */
export function mergePolishedSlide(raw, originalSlide) {
  const parsed = parseGeneratedSlides(raw);
  if (!parsed.length) return originalSlide;
  const polished = parsed[0];
  const originalCombined = assembleSlideHtmlForPolish(originalSlide);
  const polishedCombined = assembleSlideHtmlForPolish(polished);
  const mergedCombined = restoreSlideChrome(originalCombined, polishedCombined);
  const merged = parseGeneratedSlides(mergedCombined)[0] || polished;
  return {
    ...originalSlide,
    html: merged.html,
    customCSS: merged.customCSS || originalSlide.customCSS,
    title: originalSlide.title || merged.title,
    layoutPolished: true,
  };
}

/**
 * @param {string} slideHtml
 * @param {object} settings
 * @param {{ instruction?: string, isFreestyle?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function polishSlideHtml(slideHtml, settings, options = {}) {
  const model =
    settings.layoutPolishModel ||
    settings.fastModel ||
    settings.model;
  const polishSettings = {
    ...settings,
    model,
    temperature: 0.12,
    maxTokens: settings.layoutPolishMaxTokens || 24576,
    reasoningEffort: settings.layoutPolishReasoningEffort || 'low',
  };

  const systemPrompt = applyPromptOverride(
    settings,
    'layoutPolish.system',
    DEFAULT_LAYOUT_POLISH_SYSTEM
  );

  const focus = options.instruction
    ? `\nOriginal slide intent (for layout context only — do not change chrome copy):\n${options.instruction.slice(0, 1200)}\n`
    : '';

  const userPrompt = `Polish this slide for layout quality. Fix frame/body issues only.${focus}

${slideHtml}`;

  recordPromptPayload('layoutPolish.system', {
    model: polishSettings.model,
    systemPrompt,
    userPromptLength: userPrompt.length,
  });

  const content = await callWithModelFallback(polishSettings, systemPrompt, userPrompt);
  return content.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();
}

/**
 * Post-generation layout pass (one fast LLM call per slide).
 * @param {Array<object>} slides
 * @param {object} settings
 * @param {{ instruction?: string, isFreestyle?: boolean }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function polishGeneratedSlides(slides, settings, options = {}) {
  if (!isSlideLayoutPolishEnabled(settings) || !slides?.length) {
    return slides;
  }

  const polished = [];
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    if (!shouldPolishSlide(slide)) {
      polished.push(slide);
      continue;
    }

    const combined = assembleSlideHtmlForPolish(slide);
    try {
      console.log(
        '%c[LayoutPolish] Polishing slide %d/%d (%d chars)',
        'color:#2563eb;font-weight:bold',
        i + 1,
        slides.length,
        combined.length
      );
      const raw = await polishSlideHtml(combined, settings, options);
      if (!raw || (!raw.includes('class="slide') && !raw.includes("class='slide"))) {
        console.warn('[LayoutPolish] Invalid response — keeping original');
        polished.push(slide);
        continue;
      }
      polished.push(mergePolishedSlide(raw, slide));
    } catch (err) {
      console.warn('[LayoutPolish] Failed — keeping original:', err?.message || err);
      polished.push(slide);
    }
  }

  return polished;
}
