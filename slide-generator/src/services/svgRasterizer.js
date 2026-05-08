// SVG → PNG rasterizer for PPTX export.
//
// Inline <svg> icons render perfectly in the HTML preview but the LLM translator
// cannot forward them to PptxGenJS (PowerPoint has no inline-SVG primitive, and
// pptxgenjs.addImage expects raster data). Without this step the model falls back
// to emoji / unicode placeholders, producing the fuzzy rasters seen on export.
//
// This module walks a slide's HTML, rasterizes every inline <svg> to a PNG data
// URI at 4× target resolution, and swaps each <svg> for an <img data-pptx-role="icon">
// the translator can round-trip with slide.addImage(...).

const ICON_ROLE = 'icon';
const RASTER_SCALE = 4; // supersample so icons stay crisp at any slide zoom
const INLINE_STYLE_PROPS = [
  'stroke',
  'fill',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'strokeDasharray',
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'color',
];

function createSandbox() {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:960px;height:540px;pointer-events:none;opacity:0;contain:strict;';
  document.body.appendChild(host);
  return host;
}

function cssCamelToProp(camel) {
  return camel.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function inlineComputedStyles(node, win) {
  if (!(node instanceof win.Element)) return;
  const computed = win.getComputedStyle(node);
  const decls = [];
  for (const prop of INLINE_STYLE_PROPS) {
    const cssProp = cssCamelToProp(prop);
    const value = computed.getPropertyValue(cssProp);
    if (value && value !== 'none' && value !== 'normal') {
      decls.push(`${cssProp}:${value}`);
    }
  }
  if (decls.length) {
    const existing = node.getAttribute('style') || '';
    node.setAttribute('style', `${decls.join(';')};${existing}`);
  }
  for (const child of node.children) inlineComputedStyles(child, win);
}

function svgToPngDataUri(svgString, widthPx, heightPx) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(widthPx * RASTER_SCALE));
        canvas.height = Math.max(1, Math.round(heightPx * RASTER_SCALE));
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        cleanup();
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
    img.onerror = (err) => { cleanup(); reject(err || new Error('SVG decode failed')); };
    img.src = url;
  });
}

async function rasterizeSingleSvg(liveSvg, win) {
  const rect = liveSvg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || Number(liveSvg.getAttribute('width')) || 24));
  const height = Math.max(1, Math.round(rect.height || Number(liveSvg.getAttribute('height')) || 24));

  const clone = liveSvg.cloneNode(true);
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  inlineComputedStyles(clone, win);

  const serialized = new XMLSerializer().serializeToString(clone);
  const dataUri = await svgToPngDataUri(serialized, width, height);
  return { dataUri, width, height };
}

// Replace an <svg> node in a *separate* DOM (the one that will be serialized
// back to the prompt) given the corresponding live node's rasterized output.
function replaceSvgInOutputDom(outputSvg, { dataUri, width, height }) {
  const doc = outputSvg.ownerDocument;
  const img = doc.createElement('img');
  img.setAttribute('data-pptx-role', ICON_ROLE);
  img.setAttribute('src', dataUri);
  img.setAttribute('width', String(width));
  img.setAttribute('height', String(height));
  img.setAttribute('alt', '');
  img.setAttribute('style', `width:${width}px;height:${height}px;display:inline-block;`);
  outputSvg.parentNode?.replaceChild(img, outputSvg);
}

/**
 * Rasterize every inline <svg> in a slide HTML string to PNG <img> tags.
 *
 * Returns the HTML with substitutions applied. Falls back to the original
 * string on any failure so export never regresses below today's behavior.
 *
 * @param {string} slideHtml Full slide HTML (must include its <style> block so
 *   computed styles resolve correctly, e.g. stroke:var(--accent)).
 * @returns {Promise<string>} Rewritten HTML string.
 */
export async function rasterizeInlineSvgs(slideHtml) {
  if (!slideHtml || typeof slideHtml !== 'string') return slideHtml;
  if (!slideHtml.includes('<svg')) return slideHtml;
  if (typeof document === 'undefined' || typeof window === 'undefined') return slideHtml;

  let sandbox = null;
  try {
    sandbox = createSandbox();
    sandbox.innerHTML = slideHtml;

    const liveSvgs = Array.from(sandbox.querySelectorAll('svg'));
    if (liveSvgs.length === 0) return slideHtml;

    // Build a detached parse of the same HTML that we can mutate and serialize
    // back out — querySelectorAll order is stable across both trees.
    const parser = new DOMParser();
    const outputDoc = parser.parseFromString(`<body>${slideHtml}</body>`, 'text/html');
    const outputSvgs = Array.from(outputDoc.querySelectorAll('svg'));

    if (outputSvgs.length !== liveSvgs.length) {
      console.warn('[SVG Rasterizer] SVG count mismatch between live/output DOM; skipping');
      return slideHtml;
    }

    // Force layout so getBoundingClientRect returns real sizes.
    void sandbox.offsetHeight;

    const raster = await Promise.all(
      liveSvgs.map((live) => rasterizeSingleSvg(live, window).catch((err) => {
        console.warn('[SVG Rasterizer] Failed to rasterize one SVG; leaving inline.', err);
        return null;
      }))
    );

    let replaced = 0;
    raster.forEach((result, idx) => {
      if (!result) return;
      replaceSvgInOutputDom(outputSvgs[idx], result);
      replaced += 1;
    });

    if (replaced === 0) return slideHtml;
    console.log('[SVG Rasterizer] Converted %d/%d inline SVG(s) to PNG.', replaced, liveSvgs.length);
    return outputDoc.body.innerHTML;
  } catch (err) {
    console.warn('[SVG Rasterizer] Rasterization failed; falling back to original HTML.', err);
    return slideHtml;
  } finally {
    if (sandbox?.parentNode) sandbox.parentNode.removeChild(sandbox);
  }
}
