// Theme configuration and CSS generation utilities.
// A theme is a JSON object mapping semantic token names to concrete values.
// themeToCSS() converts a theme config into a CSS custom-properties block
// that is injected on `.slide` at render and export time.

export const DEFAULT_THEME = {
  name: 'Strategy&',
  colors: {
    accent: '#8E1E1E',
    accentHover: '#A32020',
    accentSoft: '#F8E3E3',
    onAccent: '#FFFFFF',
    heading: '#111111',
    body: '#222222',
    muted: '#6b7280',
    page: '#FFFFFF',
    surface: '#F7F9FB',
    surfaceAlt: '#EEF2F6',
    border: '#E6E9EE',
    success: '#059669',
    successSoft: 'rgba(16, 185, 129, 0.15)',
    warning: '#d97706',
    warningSoft: 'rgba(245, 158, 11, 0.15)',
    danger: '#dc2626',
    dangerSoft: 'rgba(220, 38, 38, 0.15)',
    neutralFill: '#4b5563',
    roseFill: '#d4687a',
  },
  fonts: {
    title: 'Georgia, serif',
    heading: 'Arial, sans-serif',
    body: 'Arial, sans-serif',
  },
};

const COLOR_TOKEN_MAP = {
  accent: '--accent',
  accentHover: '--accent-hover',
  accentSoft: '--accent-soft',
  onAccent: '--on-accent',
  heading: '--heading',
  body: '--body',
  muted: '--muted',
  page: '--page',
  surface: '--surface',
  surfaceAlt: '--surface-alt',
  border: '--border',
  success: '--success',
  successSoft: '--success-soft',
  warning: '--warning',
  warningSoft: '--warning-soft',
  danger: '--danger',
  dangerSoft: '--danger-soft',
  neutralFill: '--neutral-fill',
  roseFill: '--rose-fill',
  info: '--info',
  infoSoft: '--info-soft',
  neutral: '--neutral',
  kicker: '--kicker',
  coverDark: '--cover-dark',
  surfaceLilac: '--surface-lilac',
};

const FONT_TOKEN_MAP = {
  title: '--font-title',
  heading: '--font-heading',
  body: '--font-body',
};

// Legacy aliases that must update when the theme changes.
// The shell CSS defines these as var(--semantic-token) references, but when
// themeToCSS() overrides the semantic tokens, CSS var() references resolve
// correctly. We still emit explicit legacy overrides so that hardcoded
// fallback values in older template CSS also pick up the new theme.
const LEGACY_ALIAS_MAP = {
  heading: '--main',
  body: '--secondary',
  muted: '--meta',
  accent: '--maroon',
  accentHover: '--red',
  accentSoft: '--rose',
  surface: '--zone1',
  surfaceAlt: '--zone2',
};

/**
 * Convert a theme config object into a CSS string of custom properties
 * scoped to `.slide`. Emits both semantic tokens and legacy aliases so
 * that all template CSS resolves correctly.
 */
export function themeToCSS(theme) {
  if (!theme) return '';
  const lines = [];

  if (theme.colors) {
    for (const [key, token] of Object.entries(COLOR_TOKEN_MAP)) {
      const value = theme.colors[key];
      if (value) lines.push(`  ${token}: ${value};`);
    }
    for (const [key, alias] of Object.entries(LEGACY_ALIAS_MAP)) {
      const value = theme.colors[key];
      if (value) lines.push(`  ${alias}: ${value};`);
    }
  }

  if (theme.fonts) {
    for (const [key, token] of Object.entries(FONT_TOKEN_MAP)) {
      const value = theme.fonts[key];
      if (value) lines.push(`  ${token}: ${value};`);
    }
  }

  if (theme.layout?.cssVars) {
    for (const [token, value] of Object.entries(theme.layout.cssVars)) {
      if (token && value !== undefined && value !== null && value !== '') {
        lines.push(`  ${token}: ${value};`);
      }
    }
  }

  if (lines.length === 0) return '';
  return `.slide {\n${lines.join('\n')}\n}`;
}
