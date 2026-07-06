import { callWithModelFallback } from './apiClient.js';
import { applyPromptOverride, recordPromptPayload } from './promptOverrides.js';
import { parseGeneratedSlides } from './slideGeneration.js';
import { slideUsesRasterFrameImage } from './imageGeneration.js';
import {
  buildClientLayoutContractBlock,
  getActiveClientProfile,
} from '../../utils/clientDesignProfiles.js';
import { normalizeDenseFrameLayoutSlide } from '../../utils/slideFrameLayoutNormalize.js';

export const DEFAULT_LAYOUT_POLISH_SYSTEM = `You are a slide layout QA engineer for 960x540 consulting slides (HTML + scoped CSS).

Your job is to fix obvious VISUAL and LAYOUT defects in the body area. Typical fixes:
- White space misuse (large empty gaps, unbalanced padding/margins)
- Repeating tags, chips, or labels that should sit in an even grid (equal columns/rows, consistent gutters)
- Misaligned cards/boxes (uneven tops, ragged columns, different widths when they should match)
- Overlaps between elements
- Overflow (text or boxes pushed outside div.frame or past the slide bounds)
- Dense CSS grids/matrices where the last row is clipped (see DENSE GRIDS below)
- Weak aesthetics (tighten spacing rhythm, align to a clear grid, balance visual weight)

DENSE GRIDS / PORTFOLIO MATRICES / ROADMAP PHASE COLUMNS (inside div.frame only):
- div.frame uses overflow:hidden — content taller than the body band is clipped (often the bottom grid row).
- If .frame is display:flex; flex-direction:column and the table uses flex:1, the flex child needs min-height:0 (and usually min-width:0).
- Use grid-template-rows with minmax(0, 1fr) (not bare 1fr) so rows can shrink below bullet-list min-content height.
- Reduce cell padding and font-size slightly before allowing the grid to extend past the frame bottom.
- Roadmap layouts (.roadmap > .timeline + .phases): .roadmap and .phases need min-height:0; phase cards need height:100% with .pBody { min-height:0 } so card bottoms are not clipped.

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
- Flex/grid, gaps, sizes, alignment, and overflow rules so all body content fits inside the active body/content band (coordinates are appended below — use those, not generic 904x366 assumptions)

Return ONLY the corrected <style> block(s) plus the complete .slide HTML. No markdown fences, no commentary.`;

/** Strategy& default when no client layoutContract is active. */
export const DEFAULT_STRATEGY_FRAME_GEOMETRY = `ACTIVE SLIDE GEOMETRY (Strategy& default, 960x540 canvas):
- h1.title band: x=28, y=24, w=904, h=66 (locked — do not move)
- h2.subtitle band: x=28, y=95, w=904, h=25 (locked — do not move)
- div.frame body band: x=28, y=127, w=904, h=366 — all layout fixes must keep content inside this rectangle
- Footer/source band: y≈493–510; frame content must not enter the footer band`;

/**
 * Profile-aware title/subtitle/frame/footer coordinates for the polish model.
 * @param {object} [settings]
 * @returns {string}
 */
export function buildLayoutPolishGeometryBlock(settings = {}) {
  const profile = getActiveClientProfile(settings);
  const contract = buildClientLayoutContractBlock(profile);
  if (contract) {
    const label = profile?.name || profile?.id || 'active profile';
    return `${contract}
POLISH GEOMETRY RULES (${label}):
- div.frame must align with the Standard body/content band above (same x, y, w, h).
- Do not resize or relocate h1.title, h2.subtitle, or footer.footer bands.
- No element inside .frame may extend below the body band bottom edge or outside its width.`;
  }
  return DEFAULT_STRATEGY_FRAME_GEOMETRY;
}

/**
 * System prompt = user override (or default) + mandatory geometry block for active profile.
 * @param {object} [settings]
 * @returns {string}
 */
export function buildLayoutPolishSystemPrompt(settings = {}) {
  const base = applyPromptOverride(
    settings,
    'layoutPolish.system',
    DEFAULT_LAYOUT_POLISH_SYSTEM
  );
  return `${base}\n\n${buildLayoutPolishGeometryBlock(settings)}`;
}

/** User message template. Placeholders: {instructionBlock}, {slideHtml} */
export const DEFAULT_LAYOUT_POLISH_USER_TEMPLATE = `Polish this slide for layout quality. Fix frame/body issues only.{instructionBlock}

{slideHtml}`;

const CHROME_SELECTORS = ['h1.title', 'h2.subtitle', 'footer.footer'];

/**
 * @param {string} slideHtml
 * @param {object} settings
 * @param {{ instruction?: string }} [options]
 * @returns {string}
 */
export function buildLayoutPolishUserPrompt(slideHtml, settings, options = {}) {
  const instructionBlock = options.instruction
    ? `\nOriginal slide intent (for layout context only — do not change chrome copy):\n${options.instruction.slice(0, 1200)}\n`
    : '';
  const template = applyPromptOverride(
    settings,
    'layoutPolish.user',
    DEFAULT_LAYOUT_POLISH_USER_TEMPLATE
  );
  return template
    .replace(/\{instructionBlock\}/g, instructionBlock)
    .replace(/\{slideHtml\}/g, slideHtml);
}

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
  const layoutNorm = normalizeDenseFrameLayoutSlide({
    html: merged.html,
    customCSS: merged.customCSS || originalSlide.customCSS || '',
  });
  return {
    ...originalSlide,
    html: merged.html,
    customCSS: layoutNorm.customCSS || originalSlide.customCSS,
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

  const systemPrompt = buildLayoutPolishSystemPrompt(settings);

  const userPrompt = buildLayoutPolishUserPrompt(slideHtml, settings, options);

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
