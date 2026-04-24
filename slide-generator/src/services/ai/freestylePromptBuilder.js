import DEFAULT_SHELL from '../../guides/freestyle-shell.md?raw';
import DEFAULT_THEME from '../../guides/freestyle-theme.md?raw';
import DEFAULT_VIBE from '../../guides/freestyle-vibe.md?raw';
import DEFAULT_WRITING from '../../guides/freestyle-writing.md?raw';
import DEFAULT_PPTX_HINTS from '../../guides/freestyle-pptx-hints.md?raw';

export { DEFAULT_SHELL, DEFAULT_THEME, DEFAULT_VIBE, DEFAULT_WRITING, DEFAULT_PPTX_HINTS };

export const FREESTYLE_PRESETS = {
  default: {
    id: 'default',
    name: 'Strategy& Default',
    description: 'Clean consulting style with Strategy& branding, design tokens, and executive typography.',
    shell: null,
    theme: null,
    vibe: null,
    writing: null,
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Stripped-back design with maximum white space, minimal borders, and typography-driven hierarchy.',
    shell: null,
    theme: null,
    vibe: `# Vibe -- Minimal Clean

Maximum clarity, minimum objects. Use whitespace and typography for hierarchy; avoid cards/panels unless content genuinely needs containment. Use one accent move per slide, thin \`var(--border)\` dividers only when spacing is insufficient, and keep everything grayscale otherwise. Avoid shadows, heavy borders, rounded containers, and decorative fills.`,
    writing: null,
  },
  bold: {
    id: 'bold',
    name: 'Bold Impact',
    description: 'High-contrast, large typography, and strong visual weight for executive presentations.',
    shell: null,
    theme: null,
    vibe: `# Vibe -- Bold Impact

Design for persuasion with high contrast and fewer, larger elements. Make the key number, claim, or decision unmistakable with oversized Arial KPIs, strong accent blocks, heavy dividers, or assertive bands. Any accent/status fill must use \`var(--on-accent)\`. Minimum text size 13px. Avoid subtle, passive, low-contrast treatments.`,
    writing: null,
  },
  data: {
    id: 'data',
    name: 'Data-Heavy',
    description: 'Optimized for dense data, tables, metrics, and analytical content.',
    shell: null,
    theme: null,
    vibe: `# Vibe -- Data-Heavy Analytical

Prioritize precise grids, dense but readable tables, compact KPI rows, clear units, and footer sources. Body may use 11px; labels/footnotes may use 10px. Use \`var(--border)\`, \`var(--surface)\`, and \`var(--surface-alt)\` for structure; reserve \`var(--accent)\` for the most important data point and status tokens for real trends/risks. Avoid decoration, vague units, and unsourced data.`,
    writing: null,
  },
};

export function getPreset(presetId) {
  return FREESTYLE_PRESETS[presetId] || FREESTYLE_PRESETS.default;
}

export function buildFreestyleSystemPrompt(settings = {}) {
  const preset = settings.freestylePreset ? getPreset(settings.freestylePreset) : null;

  const shellCustom = !!(settings.freestyleShell && settings.freestyleShell.trim());
  const themeCustom = !!(settings.freestyleTheme && settings.freestyleTheme.trim());
  const vibeCustom = !!(settings.freestyleVibe && settings.freestyleVibe.trim());
  const writingCustom = !!(settings.freestyleWriting && settings.freestyleWriting.trim());

  const shell = shellCustom ? settings.freestyleShell : (preset?.shell || DEFAULT_SHELL);
  const theme = themeCustom ? settings.freestyleTheme : (preset?.theme || DEFAULT_THEME);
  const vibe = vibeCustom ? settings.freestyleVibe : (preset?.vibe || DEFAULT_VIBE);
  const writing = writingCustom ? settings.freestyleWriting : (preset?.writing || DEFAULT_WRITING);
  const hints = DEFAULT_PPTX_HINTS;

  const assembled = [shell, theme, vibe, writing, hints].join('\n\n---\n\n');

  console.groupCollapsed(
    '[FreestylePrompt] Assembled system prompt (%d chars) — Shell:%s Theme:%s Vibe:%s Writing:%s Hints:default',
    assembled.length,
    shellCustom ? 'CUSTOM' : 'default',
    themeCustom ? 'CUSTOM' : 'default',
    vibeCustom ? 'CUSTOM' : 'default',
    writingCustom ? 'CUSTOM' : 'default'
  );
  console.groupCollapsed('Shell (%d chars)', shell.length);
  console.log(shell);
  console.groupEnd();
  console.groupCollapsed('Theme (%d chars)', theme.length);
  console.log(theme);
  console.groupEnd();
  console.groupCollapsed('Vibe (%d chars)', vibe.length);
  console.log(vibe);
  console.groupEnd();
  console.groupCollapsed('Writing (%d chars)', writing.length);
  console.log(writing);
  console.groupEnd();
  console.groupCollapsed('Hints (%d chars)', hints.length);
  console.log(hints);
  console.groupEnd();
  console.groupEnd();

  return assembled;
}

/**
 * Append the PPTX export-guidance hint guide to an arbitrary system prompt.
 * Used by HTML-producing prompt builders that do not go through the freestyle
 * assembler (slide editing, transforms, storyline fills) so every generation
 * path that produces slide HTML teaches the LLM to emit lightweight PPTX
 * comments for export-risky elements.
 */
export function appendPptxHintsGuide(systemPrompt) {
  if (!systemPrompt) return DEFAULT_PPTX_HINTS;
  return `${systemPrompt}\n\n---\n\n${DEFAULT_PPTX_HINTS}`;
}
