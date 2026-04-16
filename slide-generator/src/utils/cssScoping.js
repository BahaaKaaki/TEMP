/**
 * Per-slide CSS namespacing.
 *
 * Scopes every CSS rule to a specific slide via [data-slide-id="UUID"],
 * preventing cross-slide style bleed in thumbnails, fullscreen, and HTML export.
 *
 * CSS is scoped at storage time (generation/edit), not at render time.
 */

/**
 * Prefix every CSS rule selector with [data-slide-id="slideId"].
 * Rules already scoped or @-rules are left untouched.
 */
export function scopeCSS(css, slideId) {
  if (!css || !slideId) return css || '';
  const attr = `[data-slide-id="${slideId}"]`;

  return css.replace(
    /([^{}@/][^{}]*?)\s*\{/g,
    (match, rawSelectors) => {
      // Skip @-rules (@media, @keyframes, etc.)
      if (rawSelectors.trim().startsWith('@')) return match;
      // Skip comments
      if (rawSelectors.trim().startsWith('/*')) return match;

      const scoped = rawSelectors
        .split(',')
        .map(sel => {
          sel = sel.trim();
          if (!sel || sel.startsWith('@') || sel.startsWith('/*')) return sel;
          // Already scoped
          if (sel.includes('data-slide-id')) return sel;
          // Starts with .slide — insert attr right after .slide token
          if (/^\.slide(?=[\s.[:#>+~])/.test(sel)) {
            return sel.replace(/^\.slide/, `.slide${attr}`);
          }
          // Any other selector — prefix with .slide[attr]
          return `.slide${attr} ${sel}`;
        })
        .join(', ');

      return `${scoped} {`;
    }
  );
}

/**
 * Strip [data-slide-id="..."] from CSS so the AI sees clean selectors.
 * Used before sending existing CSS as context to the LLM.
 */
export function unscopeCSS(css) {
  if (!css) return '';
  return css.replace(/\[data-slide-id="[^"]*"\]\s*/g, '');
}
