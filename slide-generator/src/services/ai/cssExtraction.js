import { debugLog, LogLevel } from '../../utils/debugLog';
import SHELL_CSS from '../../styles/slides.css?raw';
import { DEFAULT_THEME } from '../../utils/themeUtils';

/**
 * Build CSS context for LLM editing and the Slide Editor "Rendered" tab.
 *
 * Returns, in order:
 *   1. The slide's `customCSS` when non-empty (matrix, card, template-specific rules)
 *   2. The full `slides.css` shell (base `.slide` rules plus STC/PIF/DGE profile blocks)
 *
 * The `html` argument is reserved for future selective extraction; callers may
 * pass it for logging consistency.
 *
 * @param {string} html - The slide's HTML (unused for filtering today)
 * @param {string} [customCSS=''] - The slide's per-slide custom CSS
 */
export function extractRelevantCSS(html, customCSS = '') {
  const parts = [];

  if (customCSS && customCSS.trim()) {
    parts.push('/* === Slide Custom CSS === */');
    parts.push(customCSS.trim());
  }

  if (SHELL_CSS) {
    parts.push('/* === Shell CSS (base variables and structure) === */');
    parts.push(SHELL_CSS.trim());
  }

  const result = parts.join('\n\n');
  debugLog(LogLevel.DEBUG, 'extractRelevantCSS', 'Built CSS context for LLM edit', {
    customCSSLength: customCSS?.length || 0,
    shellCSSLength: SHELL_CSS?.length || 0,
    totalLength: result.length,
  });

  return result;
}

// Parse CSS custom property definitions from the shell CSS
function parseShellVariables() {
  if (!SHELL_CSS) return {};
  const vars = {};

  const baseMatch = SHELL_CSS.match(/\.slide\s*\{([^}]+)\}/);
  if (baseMatch) {
    const re = /--([\w-]+)\s*:\s*([^;]+);/g;
    let m;
    while ((m = re.exec(baseMatch[1])) !== null) {
      vars[`--${m[1]}`] = m[2].trim();
    }
  }

  return vars;
}

const THEME_VAR_MAP = {
  accent: '--accent', accentHover: '--accent-hover', accentSoft: '--accent-soft',
  onAccent: '--on-accent', heading: '--heading', body: '--body', muted: '--muted',
  page: '--page', surface: '--surface', surfaceAlt: '--surface-alt', border: '--border',
  success: '--success', successSoft: '--success-soft', warning: '--warning',
  warningSoft: '--warning-soft', danger: '--danger', dangerSoft: '--danger-soft',
  neutralFill: '--neutral-fill', roseFill: '--rose-fill',
};

const LEGACY_ALIAS_MAP = {
  heading: '--main', body: '--secondary', muted: '--meta',
  accent: '--maroon', accentHover: '--red', accentSoft: '--rose',
  surface: '--zone1', surfaceAlt: '--zone2',
};

/**
 * Build a complete variable map: shell defaults overridden by theme values,
 * plus legacy aliases so PPTX export resolves old token names.
 */
function buildVariableMap(theme) {
  const vars = parseShellVariables();

  const t = theme || DEFAULT_THEME;
  if (t.colors) {
    for (const [key, token] of Object.entries(THEME_VAR_MAP)) {
      if (t.colors[key]) vars[token] = t.colors[key];
    }
    for (const [key, alias] of Object.entries(LEGACY_ALIAS_MAP)) {
      if (t.colors[key]) vars[alias] = t.colors[key];
    }
  }

  // Resolve any var() references in shell defaults (e.g. --main: var(--heading))
  for (const [name, value] of Object.entries(vars)) {
    const ref = value.match(/^var\(--([\w-]+)\)$/);
    if (ref && vars[`--${ref[1]}`]) {
      vars[name] = vars[`--${ref[1]}`];
    }
  }

  return vars;
}

/**
 * Resolve CSS custom properties (var(--token)) to actual hex values.
 * Merges shell CSS defaults with theme overrides so PPTX export gets
 * concrete color values matching the active theme.
 */
export function resolveCustomProperties(cssText, theme) {
  if (!cssText) return cssText;
  const vars = buildVariableMap(theme);
  return cssText.replace(/var\(--([\w-]+)(?:\s*,\s*([^)]+))?\)/g, (match, name, fallback) => {
    const resolved = vars[`--${name}`];
    if (resolved) {
      if (resolved.startsWith('var(')) {
        const innerMatch = resolved.match(/var\(--([\w-]+)/);
        if (innerMatch && vars[`--${innerMatch[1]}`]) {
          return vars[`--${innerMatch[1]}`];
        }
      }
      return resolved;
    }
    return fallback ? fallback.trim() : match;
  });
}

// ============================================
// CONTEXT-FETCH DETECTION
// ============================================

// Detect if GPT response is a context request (not actual content)
export function detectContextRequest(response) {
  if (!response || typeof response !== 'string') return null;

  // Check if response is a context request JSON
  const trimmed = response.trim();
  if (!trimmed.startsWith('{') || !trimmed.includes('needsMoreContext')) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.needsMoreContext === true) {
      return {
        needsMoreContext: true,
        contextType: parsed.contextType || 'slide_html',
        slideIndices: parsed.slideIndices || [],
        reason: parsed.reason || 'Additional context needed',
      };
    }
  } catch {
    // Not valid JSON, treat as normal response
  }
  return null;
}

// Build additional context based on GPT's request
export function buildRequestedContext(request, slides, storyline, templates) {
  const contextParts = [];

  switch (request.contextType) {
    case 'slide_html':
      if (request.slideIndices && request.slideIndices.length > 0) {
        for (const idx of request.slideIndices) {
          if (slides[idx]) {
            contextParts.push(`=== SLIDE ${idx + 1}: "${slides[idx].title}" ===\n${slides[idx].html}`);
          }
        }
      }
      break;

    case 'template':
      if (request.templateId) {
        const template = templates.find(t => t.id === request.templateId);
        if (template) {
          contextParts.push(`=== TEMPLATE: ${template.title} ===\n${template.html}`);
        }
      }
      break;

    case 'storyline':
      if (storyline && storyline.length > 0) {
        contextParts.push('=== STORYLINE ===');
        storyline.forEach((s, i) => {
          contextParts.push(`${i + 1}. ${s.title}${s.keyMessage ? ` [${s.keyMessage}]` : ''}`);
        });
      }
      break;

    default:
      break;
  }

  return contextParts.join('\n\n');
}
