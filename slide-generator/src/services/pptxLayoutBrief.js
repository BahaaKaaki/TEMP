/**
 * pptxLayoutBrief.js — Analyze HTML+CSS at export time and produce a structured
 * layout description for the PPTX export LLM. This is injected into the export
 * prompt so the LLM doesn't have to reverse-engineer flex/grid from raw CSS.
 *
 * Runs in-browser, no DOM needed — parses CSS text + HTML string directly.
 */

const PX_TO_IN = 13.333 / 960;

function px2in(px) {
  return (px * PX_TO_IN).toFixed(2);
}

/**
 * Parse CSS text into a map of selector → { property: value }
 */
function parseCSSRules(cssText) {
  const rules = {};
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let m;
  while ((m = ruleRegex.exec(cssText)) !== null) {
    const selector = m[1].trim().replace(/\[data-slide-id="[^"]*"\]\s*/g, '');
    const props = {};
    m[2].split(';').forEach(decl => {
      const [prop, ...valParts] = decl.split(':');
      if (prop && valParts.length) {
        props[prop.trim()] = valParts.join(':').trim();
      }
    });
    rules[selector] = { ...rules[selector], ...props };
  }
  return rules;
}

/**
 * Extract the last class from a selector like ".slide .frame .card-layout .card"
 */
function lastClass(selector) {
  const parts = selector.split(/\s+/);
  const last = parts[parts.length - 1];
  return last.startsWith('.') ? last : null;
}

/**
 * Find CSS rule for a given class name (searches all selectors ending with that class)
 */
function findRule(rules, className) {
  const target = '.' + className;
  for (const [sel, props] of Object.entries(rules)) {
    if (lastClass(sel) === target) return props;
  }
  return null;
}

/**
 * Parse grid-template-columns into pixel widths
 */
function parseGridColumns(value, containerW) {
  if (!value) return [];
  const parts = value.trim().split(/\s+/);
  const cols = [];
  let frTotal = 0;
  let fixedTotal = 0;

  parts.forEach(p => {
    if (p.endsWith('fr')) {
      frTotal += parseFloat(p);
      cols.push({ type: 'fr', value: parseFloat(p) });
    } else if (p.endsWith('px')) {
      const px = parseFloat(p);
      fixedTotal += px;
      cols.push({ type: 'px', value: px });
    } else if (p === '1fr') {
      frTotal += 1;
      cols.push({ type: 'fr', value: 1 });
    }
  });

  const remaining = containerW - fixedTotal;
  return cols.map(c => c.type === 'fr' ? Math.round(remaining * c.value / frTotal) : c.value);
}

/**
 * Describe a single element's visual properties from CSS
 */
function describeElement(className, props, indent = '') {
  if (!props) return null;
  const parts = [];

  // Geometry hints from CSS
  const w = props.width ? parseInt(props.width) : null;
  const h = props.height ? parseInt(props.height) : null;
  if (w || h) {
    const dims = [w ? `w=${w}px/${px2in(w)}in` : '', h ? `h=${h}px/${px2in(h)}in` : ''].filter(Boolean).join(' ');
    parts.push(dims);
  }

  // Background
  const bg = props.background || props['background-color'];
  if (bg && bg !== 'transparent' && bg !== 'none') {
    parts.push(`fill=${bg.replace('#', '')}`);
  }

  // Border radius
  const radius = props['border-radius'];
  if (radius) parts.push(`radius=${radius}`);

  // Font
  const font = props['font-family'] || props.font;
  const fontSize = props['font-size'];
  const fontWeight = props['font-weight'];
  const color = props.color;

  const fontParts = [];
  if (font) {
    const face = font.split(',')[0].replace(/['"]/g, '').trim();
    fontParts.push(face);
  }
  if (fontSize) fontParts.push(fontSize);
  if (fontWeight === '700' || fontWeight === 'bold') fontParts.push('bold');
  if (color) fontParts.push(color.replace('#', ''));

  if (fontParts.length) parts.push(`font: ${fontParts.join(' ')}`);

  // Layout
  const display = props.display;
  const gridCols = props['grid-template-columns'];
  const flexDir = props['flex-direction'];
  const gap = props.gap;

  if (gridCols) parts.push(`grid: ${gridCols}${gap ? ' gap=' + gap : ''}`);
  else if (display === 'flex') {
    parts.push(`flex${flexDir === 'column' ? '-col' : '-row'}${gap ? ' gap=' + gap : ''}`);
  }

  if (!parts.length) return null;
  return `${indent}.${className}: ${parts.join(' | ')}`;
}

/**
 * Walk HTML to find elements with classes, build a tree description
 */
function walkHTML(html) {
  const elements = [];
  // Match elements with class attributes inside .frame
  const frameMatch = html.match(/<div[^>]*class="frame"[^>]*>([\s\S]*?)(?=<footer|$)/i);
  if (!frameMatch) return elements;

  const frameContent = frameMatch[1];
  const tagRegex = /<(\w+)[^>]*class="([^"]*)"[^>]*>/gi;
  let tag;
  while ((tag = tagRegex.exec(frameContent)) !== null) {
    const classes = tag[2].split(/\s+/).filter(c =>
      c && !['slide', 'frame', 'title', 'subtitle', 'footer'].includes(c)
    );
    if (classes.length) {
      const depth = (frameContent.substring(0, tag.index).match(/<(?!\/)\w/g) || []).length;
      elements.push({ classes, depth: Math.min(depth, 4) });
    }
  }
  return elements;
}

/**
 * Main: Build a layout brief from HTML + resolved CSS
 *
 * @param {string} html - The slide HTML
 * @param {string} css - The resolved CSS (variables already substituted)
 * @returns {string} A structured layout description for the export LLM
 */
export function buildLayoutBrief(html, css) {
  if (!html || !css) return '';

  const rules = parseCSSRules(css);
  const elements = walkHTML(html);

  if (!elements.length) return '';

  const lines = ['LAYOUT BRIEF (computed from CSS — use for positioning):'];

  // Describe the overall structure
  const described = new Set();
  for (const el of elements) {
    for (const cls of el.classes) {
      if (described.has(cls)) continue;
      described.add(cls);
      const props = findRule(rules, cls);
      if (!props) continue;
      const indent = '  '.repeat(Math.min(el.depth, 3));
      const desc = describeElement(cls, props, indent);
      if (desc) lines.push(desc);
    }
  }

  if (lines.length <= 1) return '';
  return lines.join('\n');
}
