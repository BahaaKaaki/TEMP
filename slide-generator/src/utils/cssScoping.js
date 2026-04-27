/**
 * Per-slide CSS namespacing.
 *
 * Scopes every CSS rule to a specific slide via [data-slide-id="<slide id>"],
 * preventing cross-slide style bleed in thumbnails, fullscreen, and HTML export.
 *
 * CSS is scoped at storage time (generation/edit), not at render time.
 * Template CSS is intentionally reused rather than regenerated, then scoped to
 * the concrete slide ID when the slide is added or updated.
 */

/**
 * Prefix every CSS rule selector with [data-slide-id="slideId"].
 * Rules already scoped or @-rules are left untouched.
 */
export function scopeCSS(css, slideId) {
  if (!css || !slideId) return css || '';
  const attr = `[data-slide-id="${slideId}"]`;

  return css.replace(
    /((?:\s*\/\*[\s\S]*?\*\/\s*)*[^{}@/][^{}]*?)\s*\{/g,
    (match, rawSelectors) => {
      // Skip @-rules (@media, @keyframes, etc.)
      if (rawSelectors.trim().startsWith('@')) return match;

      // Keep leading comments, but scope the selector that follows them.
      // Without this, blocks like "/* Chart */\n.slide .foo {" remained
      // unscoped because the whole prelude started with a comment.
      const commentPrefix = rawSelectors.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)+)/)?.[1] || '';
      const selectorText = rawSelectors.slice(commentPrefix.length);
      if (!selectorText.trim()) return match;

      const scoped = selectorText
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

      return `${commentPrefix}${scoped} {`;
    }
  );
}

/**
 * Strip [data-slide-id="..."] from CSS so the AI sees clean selectors.
 * Used before sending existing CSS as context to the LLM.
 */
export function unscopeCSS(css) {
  if (!css) return '';
  // Remove the [data-slide-id="..."] but preserve the space after .slide
  // .slide[data-slide-id="x"] .frame → .slide .frame
  return css.replace(/\[data-slide-id="[^"]*"\]/g, '');
}
