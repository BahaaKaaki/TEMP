/**
 * Vibe Regenerator Service
 *
 * Applies vibes by adding data-vibe attribute to slides.
 * All visual styling is handled by CSS in slides.css using [data-vibe="..."] selectors.
 *
 * This is the ONLY place that modifies slide HTML for vibes.
 * It's deterministic, simple, and works with ANY template.
 */

import { getVibe, isBaseVibe, VIBES } from '../utils/vibes';

/**
 * Apply a vibe to a slide by adding the data-vibe attribute.
 * CSS in slides.css handles all visual changes.
 */
export async function regenerateWithVibe(slideHtml, vibeId, settings) {
  // Base vibe - remove vibe attribute to use default styling
  if (isBaseVibe(vibeId)) {
    console.log('[VibeRegen] Base vibe - removing data-vibe attribute');
    const cleanedHtml = removeVibeAttribute(slideHtml);
    return { html: cleanedHtml, success: true, isBase: true };
  }

  const vibe = getVibe(vibeId);
  console.log(`[VibeRegen] Applying "${vibe.name}" vibe via CSS`);

  try {
    const styledHtml = applyVibeAttribute(slideHtml, vibeId);
    return { html: styledHtml, success: true, vibeId };
  } catch (error) {
    console.error('[VibeRegen] Error:', error.message);
    return {
      html: slideHtml,
      success: false,
      error: error.message || 'Failed to apply vibe',
    };
  }
}

/**
 * Add data-vibe attribute to slide
 */
function applyVibeAttribute(html, vibeId) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const slide = doc.querySelector('.slide');

  if (!slide) {
    console.warn('[VibeRegen] No .slide element found');
    return html;
  }

  slide.setAttribute('data-vibe', vibeId);
  return slide.outerHTML;
}

/**
 * Remove data-vibe attribute from slide
 */
function removeVibeAttribute(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const slide = doc.querySelector('.slide');

  if (!slide) {
    return html;
  }

  slide.removeAttribute('data-vibe');
  return slide.outerHTML;
}

/**
 * Check if vibe application is available
 * CSS-based vibes are always available
 */
export function canRegenerateVibes(settings) {
  return true;
}

/**
 * Batch apply vibe to multiple slides
 */
export async function batchRegenerateWithVibe(slides, vibeId, settings, onProgress) {
  const results = [];

  console.log(`[VibeRegen] Batch: Applying "${vibeId}" to ${slides.length} slides`);

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const slideName = slide.title || `Slide ${i + 1}`;

    if (onProgress) {
      onProgress({ current: i + 1, total: slides.length, slideName, status: 'processing' });
    }

    const result = await regenerateWithVibe(slide.html, vibeId, settings);
    results.push({
      ...slide,
      html: result.html,
      vibeApplied: result.success ? vibeId : null,
      vibeError: result.error,
    });

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: slides.length,
        slideName,
        status: result.success ? 'completed' : 'error',
        error: result.error,
      });
    }
  }

  const successCount = results.filter(r => r.vibeApplied).length;
  console.log(`[VibeRegen] Batch complete: ${successCount}/${slides.length}`);

  return results;
}

/**
 * Get all available vibes with descriptions
 */
export function getAvailableVibes() {
  return Object.values(VIBES).map(v => ({
    id: v.id,
    name: v.name,
    description: v.description,
    aiHint: v.aiHint,
    isBase: v.isBase || false,
  }));
}
