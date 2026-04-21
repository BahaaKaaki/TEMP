/**
 * pptxDomMeasure.js — Render a slide offscreen and measure every element's
 * exact bounding rect via getBoundingClientRect(). Produces a position map
 * the PPTX export LLM uses instead of reverse-engineering CSS flex/grid.
 */

import SHELL_CSS from '../styles/slides.css?raw';

const MAX_ELEMENTS = 60;
const SKIP_CLASSES = new Set(['slide', 'frame', 'title', 'subtitle', 'footer', 'source']);

function waitForLayout() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb.startsWith('#') ? rgb : null;
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

function isDefaultBg(hex) {
  if (!hex) return true;
  const h = hex.toUpperCase();
  return h === '#FFFFFF' || h === '#FFF' || h === 'transparent';
}

function stripScoping(html) {
  return html.replace(/\s*data-slide-id="[^"]*"/g, '');
}

function stripCssScoping(css) {
  if (!css) return '';
  return css.replace(/\[data-slide-id="[^"]*"\]\s*/g, '');
}

/**
 * Render a slide offscreen and measure all elements inside .frame.
 *
 * @param {string} html - The slide HTML (with or without <style> blocks)
 * @param {string} customCSS - The slide's custom CSS (scoped or unscoped)
 * @returns {Promise<string>} A text map of element positions for the export prompt
 */
export async function measureSlideLayout(html, customCSS) {
  if (!html) return '';

  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:960px;height:540px;overflow:hidden;';
  document.body.appendChild(container);

  try {
    const styleEl = document.createElement('style');
    styleEl.textContent = [
      SHELL_CSS || '',
      stripCssScoping(customCSS || ''),
    ].join('\n');
    container.appendChild(styleEl);

    const cleanHtml = stripScoping(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    container.insertAdjacentHTML('beforeend', cleanHtml);

    await waitForLayout();

    const slideEl = container.querySelector('.slide');
    if (!slideEl) return '';

    const slideRect = slideEl.getBoundingClientRect();
    const frameEl = slideEl.querySelector('.frame');
    if (!frameEl) return '';

    const elements = frameEl.querySelectorAll('*');
    const lines = ['ELEMENT POSITIONS (px from slide origin, measured from rendered DOM):'];
    let count = 0;

    for (const el of elements) {
      if (count >= MAX_ELEMENTS) break;

      const classes = Array.from(el.classList).filter(c => !SKIP_CLASSES.has(c));
      if (classes.length === 0) continue;

      const rect = el.getBoundingClientRect();
      const x = Math.round(rect.left - slideRect.left);
      const y = Math.round(rect.top - slideRect.top);
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      if (w === 0 || h === 0) continue;

      const style = getComputedStyle(el);

      // Geometry
      let line = `.${classes[0]}: x=${x} y=${y} w=${w} h=${h}`;

      // Background
      const bg = rgbToHex(style.backgroundColor);
      if (!isDefaultBg(bg)) line += ` | bg=${bg}`;

      // Border radius
      const radius = style.borderRadius;
      if (radius && radius !== '0px') line += ` radius=${radius}`;

      // Font info
      const fontFamily = style.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim();
      const fontSize = style.fontSize;
      const fontWeight = style.fontWeight;
      const color = rgbToHex(style.color);
      const isBold = fontWeight === '700' || fontWeight === 'bold';

      const hasText = el.childNodes.length > 0 &&
        Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());

      if (hasText || el.tagName === 'SPAN' || el.tagName === 'P' || el.tagName === 'H3' || el.tagName === 'H4') {
        const parts = [fontFamily, fontSize];
        if (isBold) parts.push('bold');
        if (color) parts.push(`color=${color}`);
        line += ` | font=${parts.join(' ')}`;
      }

      // Nesting depth for indentation
      let depth = 0;
      let parent = el.parentElement;
      while (parent && parent !== frameEl) {
        depth++;
        parent = parent.parentElement;
      }
      const indent = '  '.repeat(Math.min(depth, 4));

      lines.push(indent + line);
      count++;
    }

    if (lines.length <= 1) return '';
    return lines.join('\n');
  } finally {
    document.body.removeChild(container);
  }
}
