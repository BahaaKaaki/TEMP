import DEFAULT_SHELL from '../../guides/freestyle-shell.md?raw';
import DEFAULT_THEME from '../../guides/freestyle-theme.md?raw';
import DEFAULT_VIBE from '../../guides/freestyle-vibe.md?raw';
import DEFAULT_WRITING from '../../guides/freestyle-writing.md?raw';
import DEFAULT_PPTX_HINTS from '../../guides/freestyle-pptx-hints.md?raw';
import { appendClientDesignContract, applyClientProfilePromptSections, rewritePromptGeometryForClientProfile, getActiveClientProfile } from '../../utils/clientDesignProfiles.js';
import DEFAULT_SLIDE_HTML_GENERATOR_PROMPT from '../../guides/slide-html-generator-prompt.md?raw';
import { getCatalog as getIconCatalogState, formatCatalogForPrompt } from '../icons/iconCatalog.js';

export {
  DEFAULT_SHELL,
  DEFAULT_THEME,
  DEFAULT_VIBE,
  DEFAULT_WRITING,
  DEFAULT_PPTX_HINTS,
  DEFAULT_SLIDE_HTML_GENERATOR_PROMPT,
};

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

Design for maximum clarity with minimum visual elements.

## Core principles
1. **White space is the primary design tool** -- generous margins, no content touching edges.
2. **Typography carries hierarchy** -- size, weight, and case distinguish levels. No borders or backgrounds needed for separation.
3. **One accent color maximum** -- use \`var(--accent)\` on a single element per slide (a number, a border, an icon). Everything else is grayscale.
4. **No containers** -- avoid cards, boxes, panels. Use spacing and alignment to group content.
5. **Thin hairline dividers** -- 1px \`var(--border)\` only when spatial separation is insufficient.

## What to avoid
- Background fills on sections or cards
- Drop shadows
- Rounded corners on containers
- Multiple colors on a single slide
- Bold borders or thick accents`,
    writing: null,
  },
  bold: {
    id: 'bold',
    name: 'Bold Impact',
    description: 'High-contrast, large typography, and strong visual weight for executive presentations.',
    shell: null,
    theme: null,
    vibe: `# Vibe -- Bold Impact

Design for maximum visual impact and persuasion.

## Core principles
1. **Oversized numbers and KPIs** -- key statistics at 36-48px, making them the undeniable focal point.
2. **High contrast sections** -- use \`var(--accent)\` backgrounds with \`var(--on-accent)\` text for headers and callouts.
3. **Thick accent elements** -- 6px+ left borders, heavy dividers, bold underlines.
4. **All-caps section headings** -- h3/h4 in uppercase for commanding presence.
5. **Fewer items, bigger presence** -- 3 items at large size beats 6 items at small size.

## Color strategy
- Use \`var(--accent)\` as dominant background color for hero sections
- Use \`var(--accent-soft)\` for secondary emphasis
- Reserve white for contrast areas within dark sections
- Status colors (\`var(--success)\`, \`var(--danger)\`) at larger, more prominent sizes

## What to avoid
- Subtle styling -- everything should be deliberate and visible
- Small text -- minimum 13px for any text
- Low-contrast combinations
- Passive visual treatments`,
    writing: null,
  },
  data: {
    id: 'data',
    name: 'Data-Heavy',
    description: 'Optimized for dense data, tables, metrics, and analytical content.',
    shell: null,
    theme: null,
    vibe: `# Vibe -- Data-Heavy Analytical

Design for maximum information density while maintaining readability.

## Core principles
1. **Grid-first layout** -- use CSS Grid for precise alignment of data elements.
2. **Compact but readable type** -- keep body text at 12px; use 10px only for labels, axes, legends, chips, sources, and footnotes.
3. **Dense tables** -- compact padding (4-6px), alternating row backgrounds with \`var(--surface)\` and \`var(--surface-alt)\`.
4. **Metrics dashboard style** -- KPI cards with number + label + trend indicator arranged in tight grids.
5. **Source citations on every data slide** -- footnote sources in the footer.

## Color strategy
- Use status colors extensively: \`var(--success)\` for positive, \`var(--danger)\` for negative, \`var(--warning)\` for neutral
- Use \`var(--accent)\` sparingly -- only for the single most important data point
- Use \`var(--border)\` generously for table structure and separators
- Use \`var(--muted)\` for secondary labels and units

## What to avoid
- Decorative elements that compete with data
- Large empty spaces -- fill with relevant context
- Rounded corners on data tables (use sharp edges for precision)
- Omitting units or sources`,
    writing: null,
  },
};

export function getPreset(presetId) {
  return FREESTYLE_PRESETS[presetId] || FREESTYLE_PRESETS.default;
}

/**
 * Build the Strategy& icon-catalog prompt section. Returns '' when:
 *   - the catalog isn't loaded yet (first session before manifest fetch)
 *   - the active client profile isn't Strategy& (other clients ship their own
 *     icon libraries via this same hook in the future)
 */
function buildIconCatalogSection(settings) {
  const profile = getActiveClientProfile(settings || {});
  if (!profile || profile.id !== 'strategy') return '';
  const catalog = getIconCatalogState();
  if (!catalog || !catalog.iconCount) return '';
  const list = formatCatalogForPrompt({ categories: ['generic-large', 'generic-small'] });
  if (!list) return '';
  return [
    '## Strategy& icon library (brand-compliant line-art icons)',
    '',
    'Use these icons whenever a slide calls for a small pictogram (KPI badges,',
    'card icons, bullet markers, etc.). Reference an icon by emitting:',
    '',
    '    <icon name="slug-here"/>',
    '',
    'inside any container with a class like `card-icon-circle`, `bullet-icon`,',
    '`card-icon`, or `icon`. The runtime expands the token to inline SVG before',
    'render. Icons inherit color via `currentColor`, so set the surrounding',
    'container\'s `color: var(--accent)` (already the default for `.icon`).',
    '',
    'Do NOT paste raw `<svg>` markup -- always use the token form. Do NOT make',
    'up slugs that are not in the list below; pick the closest match.',
    '',
    'Available slugs (slug — keywords):',
    '',
    list,
  ].join('\n');
}

export function buildFreestyleSystemPrompt(settings = {}) {
  const preset = settings.freestylePreset ? getPreset(settings.freestylePreset) : null;

  const shellCustom = !!(settings.freestyleShell && settings.freestyleShell.trim());
  const themeCustom = !!(settings.freestyleTheme && settings.freestyleTheme.trim());
  const vibeCustom = !!(settings.freestyleVibe && settings.freestyleVibe.trim());
  const writingCustom = !!(settings.freestyleWriting && settings.freestyleWriting.trim());
  const presetCustom = !!(preset && preset.id !== 'default');

  const baseSections = {
    shell: shellCustom ? settings.freestyleShell : (presetCustom ? preset?.shell : ''),
    theme: themeCustom ? settings.freestyleTheme : (presetCustom ? preset?.theme : ''),
    vibe: vibeCustom ? settings.freestyleVibe : (presetCustom ? preset?.vibe : ''),
    writing: writingCustom ? settings.freestyleWriting : (presetCustom ? preset?.writing : ''),
    hints: DEFAULT_PPTX_HINTS,
  };
  const { shell, theme, vibe, writing, hints } = applyClientProfilePromptSections(baseSections, settings, {
    includeShell: false,
  });

  const extraSections = [];
  if (shell) extraSections.push(shell);
  if (theme) extraSections.push(theme);
  if (vibe) extraSections.push(vibe);
  if (writing) extraSections.push(writing);

  const iconCatalogSection = buildIconCatalogSection(settings);
  if (iconCatalogSection) extraSections.push(iconCatalogSection);

  const basePrompt = rewritePromptGeometryForClientProfile(DEFAULT_SLIDE_HTML_GENERATOR_PROMPT, settings);
  const assembled = appendClientDesignContract(
    [basePrompt, ...extraSections, hints].join('\n\n---\n\n'),
    settings
  );

  console.groupCollapsed(
    '[FreestylePrompt] Assembled system prompt (%d chars) — Base:slide-html-generator Preset:%s Shell:%s Theme:%s Vibe:%s Writing:%s Hints:default',
    assembled.length,
    presetCustom ? preset.id : 'default',
    shellCustom ? 'CUSTOM' : 'default',
    themeCustom ? 'CUSTOM' : 'default',
    vibeCustom ? 'CUSTOM' : 'default',
    writingCustom ? 'CUSTOM' : 'default'
  );
  console.groupCollapsed('Base (%d chars)', basePrompt.length);
  console.log(basePrompt);
  console.groupEnd();
  extraSections.forEach((section, index) => {
    console.groupCollapsed('Extra section %d (%d chars)', index + 1, section.length);
    console.log(section);
    console.groupEnd();
  });
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
