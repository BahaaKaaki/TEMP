/**
 * PPTX export post-pass for inline SVG icons.
 *
 * Generated PPTX code often recreates editable text/shapes well, but small
 * inline SVG glyphs lose fidelity. This service renders only icon-sized SVG
 * hosts from the HTML preview into high-DPI transparent PNGs, then overlays
 * them on the generated PPTX slide.
 */

import SHELL_CSS from '../styles/slides.css?raw';
import { getActiveClientProfile } from '../utils/clientDesignProfiles.js';
import { themeToCSS } from '../utils/themeUtils.js';
import {
  getSlideMeasureClientChromeCss,
  getSlideMeasureContainerCss,
} from './slidePreviewMeasureCss.js';

const MIN_ICON_PX = 6;
const MAX_ICON_PX = 180;
const MAX_ICON_AREA = 200 * 200;
const ICON_RASTER_SCALE = 4;
const MAX_ICON_HOST_TO_SVG_AREA_RATIO = 12;

const ICON_HOST_SELECTOR = [
  '.icon',
  '.card-icon',
  '.kpi-icon',
  '.card-icon-circle',
  '.bullet-icon',
].join(',');

const ICON_CLASS_RE = /(?:^|[\s_-])icon(?:$|[\s_-])/i;

const PREVIEW_PARITY_CSS = `
[data-pptx-svg-icon-measure] .slide-render-container,
[data-pptx-svg-icon-measure] .slide-render-container * {
  box-sizing: border-box;
}
`;

const LARGE_VISUAL_SELECTOR = [
  '.auto-chart',
  '.bar-chart',
  '.chart',
  '.diagram',
  '.graph',
  '.map',
  '.plot',
  '.sparkline',
  '.timeline',
  'table',
].join(',');

const PAINT_TAGS = new Set([
  'path',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'rect',
  'text',
  'use',
  'g',
]);

function escapeHtmlAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toPptxImageData(dataUrlOrRawBase64) {
  if (!dataUrlOrRawBase64 || typeof dataUrlOrRawBase64 !== 'string') return null;
  const value = dataUrlOrRawBase64.trim().replace(/\s+/g, '');
  if (!value) return null;
  if (value.toLowerCase().startsWith('data:image/')) return value;
  if (value.toLowerCase().includes('base64,')) return `data:${value}`;
  return `data:image/png;base64,${value}`;
}

function extractAllStyleBlocksFromHtml(html) {
  const styleBlocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    const css = match[1]?.trim();
    if (css) styleBlocks.push(css);
  }
  return styleBlocks.join('\n\n');
}

function stripStyleTagsFromHtml(html) {
  return String(html || '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
}

function prepareSlideMarkupForMeasure(html, slide, settings) {
  let markup = stripStyleTagsFromHtml(html);
  if (!markup.trim()) return '';
  if (!/\bclass=["'][^"']*\bslide\b/i.test(markup)) {
    markup = `<div class="slide">${markup}</div>`;
  }

  const profile = getActiveClientProfile(settings || {});
  const attrs = [];
  if (slide?.id && !/\sdata-slide-id=/.test(markup)) {
    attrs.push(`data-slide-id="${escapeHtmlAttr(slide.id)}"`);
  }
  if (profile?.id && profile.id !== 'strategy' && !/\sdata-client-profile=/.test(markup)) {
    attrs.push(`data-client-profile="${escapeHtmlAttr(profile.id)}"`);
  }
  if (!attrs.length) return markup;

  return markup.replace(
    /(<div\b[^>]*\bclass=["'][^"']*\bslide\b[^"']*["'][^>]*)(>)/i,
    (_match, open, close) => `${open} ${attrs.join(' ')}${close}`,
  );
}

function buildMeasureStylesheet(slide, settings) {
  const theme = settings?.theme || null;
  const embeddedCss = extractAllStyleBlocksFromHtml(slide?.html || '');
  return [
    SHELL_CSS,
    getSlideMeasureContainerCss(),
    PREVIEW_PARITY_CSS,
    getSlideMeasureClientChromeCss(),
    theme ? themeToCSS(theme) : '',
    slide?.customCSS || '',
    embeddedCss,
  ].filter(Boolean).join('\n\n');
}

function getCanvasMeta(settings) {
  const profile = getActiveClientProfile(settings || {});
  const canvas = profile?.layoutContract?.canvas || {};
  return {
    widthPx: Number(canvas.widthPx) || 960,
    heightPx: Number(canvas.heightPx) || 540,
    widthIn: Number(canvas.widthIn) || 13.333,
    heightIn: Number(canvas.heightIn) || 7.5,
  };
}

function pxRectToSlideInches(xPx, yPx, wPx, hPx, meta) {
  return {
    x: (xPx / meta.widthPx) * meta.widthIn,
    y: (yPx / meta.heightPx) * meta.heightIn,
    w: Math.max((wPx / meta.widthPx) * meta.widthIn, 0.05),
    h: Math.max((hPx / meta.heightPx) * meta.heightIn, 0.05),
  };
}

function isIconSizedRect(rect) {
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width < MIN_ICON_PX || height < MIN_ICON_PX) return false;
  if (width > MAX_ICON_PX || height > MAX_ICON_PX) return false;
  if (width * height > MAX_ICON_AREA) return false;
  return true;
}

function findIconHost(svg) {
  const specific = svg.closest(ICON_HOST_SELECTOR);
  if (specific) return specific;

  let node = svg.parentElement;
  for (let depth = 0; depth < 5 && node && !node.classList?.contains('slide'); depth += 1, node = node.parentElement) {
    const className = typeof node.className === 'string' ? node.className : '';
    if (ICON_CLASS_RE.test(className)) return node;
  }
  return svg;
}

function hasTextOutsideSvg(host, svg) {
  if (!host || host === svg || typeof document === 'undefined') return false;
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || svg.contains(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  return Boolean(walker.nextNode());
}

function shouldUseIconHostBox(host, svg, hostRect, svgRect) {
  if (!host || host === svg) return false;
  if (!isIconSizedRect(hostRect)) return false;
  if (hasTextOutsideSvg(host, svg)) return false;

  const svgArea = Math.max(1, (svgRect?.width || 0) * (svgRect?.height || 0));
  const hostArea = Math.max(1, (hostRect?.width || 0) * (hostRect?.height || 0));
  if (hostArea / svgArea > MAX_ICON_HOST_TO_SVG_AREA_RATIO) return false;

  const style = getComputedStyle(host);
  const hasVisibleFill = style.backgroundColor && !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.backgroundColor);
  const hasVisibleBorder = style.borderStyle !== 'none' && Number.parseFloat(style.borderWidth || '0') > 0;
  const className = typeof host.className === 'string' ? host.className : '';
  const isExplicitChip = /\b(card-icon-circle|icon-chip|icon-circle|icon-badge)\b/i.test(className);

  return hasVisibleFill || hasVisibleBorder || isExplicitChip;
}

function resolveIconRasterTarget(svg, rootRect) {
  const host = findIconHost(svg);
  const svgRect = svg.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const svgSized = isIconSizedRect(svgRect);
  const useHostBox = shouldUseIconHostBox(host, svg, hostRect, svgRect);

  if (!svgSized && !useHostBox) return null;
  if (svg.closest(LARGE_VISUAL_SELECTOR) && !useHostBox) return null;

  const boxRect = useHostBox ? hostRect : svgRect;
  const xPx = boxRect.left - rootRect.left;
  const yPx = boxRect.top - rootRect.top;
  if (xPx + boxRect.width < 0 || yPx + boxRect.height < 0) return null;

  return {
    boxRect,
    captureElement: useHostBox ? host : svg,
    sourceW: Math.max(1, svgRect.width || boxRect.width),
    sourceH: Math.max(1, svgRect.height || boxRect.height),
  };
}

async function captureElementToPngData(el) {
  const html2canvas = (await import('html2canvas')).default;
  const rect = el.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const canvas = await html2canvas(el, {
    width,
    height,
    scale: ICON_RASTER_SCALE,
    backgroundColor: null,
    logging: false,
    useCORS: true,
    scrollX: 0,
    scrollY: 0,
  });
  return toPptxImageData(canvas.toDataURL('image/png'));
}

function walkOrigClone(orig, clone, visitor) {
  visitor(orig, clone);
  const origChildren = [...orig.children];
  const cloneChildren = [...clone.children];
  const length = Math.min(origChildren.length, cloneChildren.length);
  for (let i = 0; i < length; i += 1) {
    walkOrigClone(origChildren[i], cloneChildren[i], visitor);
  }
}

function cloneSvgWithComputedPaint(svgEl) {
  const clone = svgEl.cloneNode(true);
  walkOrigClone(svgEl, clone, (orig, cloned) => {
    if (orig.nodeType !== 1 || cloned.nodeType !== 1) return;
    const tag = cloned.tagName.toLowerCase();
    if (!PAINT_TAGS.has(tag)) return;

    const style = getComputedStyle(orig);
    const fill = style.fill;
    const stroke = style.stroke;
    const strokeWidth = style.strokeWidth;

    cloned.setAttribute('color', style.color || '#000000');
    if (!fill || fill === 'none' || fill.includes('rgba(0, 0, 0, 0)')) {
      cloned.setAttribute('fill', 'none');
    } else {
      cloned.setAttribute('fill', fill);
    }
    if (stroke && stroke !== 'none' && !stroke.includes('rgba(0, 0, 0, 0)')) {
      cloned.setAttribute('stroke', stroke);
    }
    if (strokeWidth && strokeWidth !== '0px') cloned.setAttribute('stroke-width', strokeWidth);
    if (style.strokeLinecap && style.strokeLinecap !== 'butt') cloned.setAttribute('stroke-linecap', style.strokeLinecap);
    if (style.strokeLinejoin && style.strokeLinejoin !== 'miter') cloned.setAttribute('stroke-linejoin', style.strokeLinejoin);
    if (style.opacity && style.opacity !== '1') cloned.setAttribute('opacity', style.opacity);
  });
  return clone;
}

async function rasterSerializedSvgToPngData(svg, outputCssW, outputCssH, sourceCssW, sourceCssH) {
  const clone = cloneSvgWithComputedPaint(svg);
  const sw = Math.max(1, Math.round(sourceCssW));
  const sh = Math.max(1, Math.round(sourceCssH));
  const ow = Math.max(1, Math.round(outputCssW));
  const oh = Math.max(1, Math.round(outputCssH));

  clone.setAttribute('width', String(sw));
  clone.setAttribute('height', String(sh));
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const raw = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([raw], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG image decode failed'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(ow * ICON_RASTER_SCALE));
    canvas.height = Math.max(1, Math.round(oh * ICON_RASTER_SCALE));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d canvas context');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const imgW = Math.max(1, img.naturalWidth || sw);
    const imgH = Math.max(1, img.naturalHeight || sh);
    const scale = Math.min(canvas.width / imgW, canvas.height / imgH);
    const drawW = Math.round(imgW * scale);
    const drawH = Math.round(imgH * scale);
    const drawX = Math.round((canvas.width - drawW) / 2);
    const drawY = Math.round((canvas.height - drawH) / 2);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    return toPptxImageData(canvas.toDataURL('image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * @param {*} pptxSlide PptxGenJS slide instance
 * @param {{ html?: string, customCSS?: string, id?: string }} slide
 * @param {object|null} settings
 */
export async function injectRasterizedSvgIcons(pptxSlide, slide, settings) {
  if (typeof document === 'undefined') return;
  if (!pptxSlide?.addImage || !String(slide?.html || '').includes('<svg')) return;

  const meta = getCanvasMeta(settings);
  const host = document.createElement('div');
  host.setAttribute('data-pptx-svg-icon-measure', '1');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${meta.widthPx}px`,
    height: `${meta.heightPx}px`,
    opacity: '1',
    pointerEvents: 'none',
    overflow: 'hidden',
    margin: '0',
    padding: '0',
    zIndex: '1',
    background: '#fff',
  });

  const styleEl = document.createElement('style');
  styleEl.textContent = buildMeasureStylesheet(slide, settings);
  host.appendChild(styleEl);

  const renderWrap = document.createElement('div');
  renderWrap.className = 'slide-render-container';
  renderWrap.style.cssText = `width:${meta.widthPx}px;height:${meta.heightPx}px;position:relative;overflow:hidden;margin:0;padding:0;`;
  renderWrap.innerHTML = prepareSlideMarkupForMeasure(slide.html || '', slide, settings);
  host.appendChild(renderWrap);

  document.body.appendChild(host);

  let injected = 0;
  try {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* Font readiness is best-effort for export measurement. */
      }
    }

    const rootRect = renderWrap.getBoundingClientRect();
    const allSvgs = [...renderWrap.querySelectorAll('svg')];
    const outermostSvgs = allSvgs.filter(svg => !allSvgs.some(other => other !== svg && other.contains(svg)));

    for (const svg of outermostSvgs) {
      const target = resolveIconRasterTarget(svg, rootRect);
      if (!target) continue;

      let data = null;
      try {
        data = await captureElementToPngData(target.captureElement);
      } catch (error) {
        console.warn('[PPTX] html2canvas SVG icon capture failed:', error?.message || error);
      }
      if (!data) {
        try {
          data = await rasterSerializedSvgToPngData(
            svg,
            target.boxRect.width,
            target.boxRect.height,
            target.sourceW,
            target.sourceH,
          );
        } catch (error) {
          console.warn('[PPTX] Serialized SVG icon raster failed:', error?.message || error);
        }
      }
      if (!data) continue;

      const box = pxRectToSlideInches(
        target.boxRect.left - rootRect.left,
        target.boxRect.top - rootRect.top,
        target.boxRect.width,
        target.boxRect.height,
        meta,
      );

      try {
        pptxSlide.addImage({ data, x: box.x, y: box.y, w: box.w, h: box.h });
        injected += 1;
      } catch (error) {
        console.warn('[PPTX] slide.addImage for SVG icon failed:', error?.message || error);
      }
    }

    if (injected > 0) {
      console.info(`[PPTX] Injected ${injected} rasterized SVG icon(s) for slide ${slide?.id || '(unknown)'}`);
      // Deterministic post-pass: remove any LLM-emitted primitive shapes
      // (rect / ellipse / roundRect) that are mostly covered by an injected
      // image. This is the "once and for all" fix for chip-doubling — the
      // LLM may still draw a chip ellipse from the CSS it sees, but the
      // dedupe pass cleanly removes redundant shapes regardless. See
      // /tmp/chip-doubling-test/repro.mjs for the 8-fixture test suite.
      try {
        const removed = dedupeShapesUnderImages(pptxSlide);
        if (removed > 0) {
          console.info(`[PPTX] Removed ${removed} LLM shape(s) covered by rasterized icons (dedupe).`);
        }
      } catch (error) {
        console.warn('[PPTX] Shape-dedupe pass failed:', error?.message || error);
      }
    }
  } finally {
    host.remove();
  }
}

// Primitive shapes added via PptxGenJS slide.addShape are stored with
// _type='text' and a `shape` field. We treat these names as "chip-like"
// for the purposes of the dedupe pass.
const _DEDUPE_PRIMITIVE_SHAPES = new Set([
  'rect', 'roundRect', 'ellipse', 'oval', 'roundedRect',
]);

function _hasMeaningfulText(obj) {
  // A primitive shape carrying real text content (e.g. numbered roadmap stop,
  // titled banner) is content -- never remove it even if an image overlaps.
  if (typeof obj.text === 'string') return obj.text.trim().length > 0;
  if (Array.isArray(obj.text) && obj.text.length > 0) return true;
  return false;
}

/**
 * Remove primitive shapes that are mostly covered by a rasterized image.
 *
 * Rationale: the LLM PPTX-export prompt instructs the model to "render
 * surrounding cards, icon chips/backgrounds" -- so it draws e.g. an
 * addShape('ellipse', { fill: rose }) for chip backgrounds. The runtime
 * pptxSvgIconInjector ALSO captures the same chip + svg as a single
 * atomic raster image. Both layers stack, producing the fuzzy-halo /
 * misaligned-chip artefact (#FIFA-export-2026-05, V31, V33).
 *
 * Three previous prompt-side fixes (PRs #117, #118, #119, #120, #121)
 * relied on the LLM following conditional rules; binary inspection of
 * V33 export proved the LLM still drew chips a fraction of the time.
 *
 * This pass works deterministically AFTER both renderers have run:
 *   - Iterate slide._slideObjects
 *   - For each rasterized image, find primitive shapes (rect / ellipse /
 *     roundRect) whose bounding box overlaps the image by >= 50%, and
 *     whose area is within 5x of the image's area
 *   - Skip shapes that carry text (numbered circles, titled banners)
 *   - Splice removed shapes out of the array in place
 *
 * Tuning notes (see /tmp/chip-doubling-test/repro.mjs):
 *   - 50% overlap threshold catches the V31 ~0.25in CSS-vs-DOM drift case
 *     while keeping small icon glyphs inside larger chips (rasterizer
 *     SVG-only path produces ~37% overlap, intentionally below threshold).
 *   - 5x area-ratio cap prevents removing card frames or full-bleed
 *     backgrounds when an icon happens to sit somewhere inside them.
 *
 * @param {*} pptxSlide PptxGenJS slide instance with _slideObjects array
 * @param {object} [opts]
 * @param {number} [opts.minOverlapFraction=0.5] fraction of shape covered
 * @param {number} [opts.maxAreaRatio=5] cap on image-vs-shape area ratio
 * @returns {number} count of shapes removed
 */
export function dedupeShapesUnderImages(pptxSlide, opts = {}) {
  const minOverlapFraction = opts.minOverlapFraction ?? 0.5;
  const maxAreaRatio = opts.maxAreaRatio ?? 5;
  const objs = pptxSlide?._slideObjects;
  if (!Array.isArray(objs) || objs.length === 0) return 0;

  const imageBoxes = [];
  for (const obj of objs) {
    if (obj?._type !== 'image') continue;
    const o = obj.options || {};
    if (typeof o.x !== 'number' || typeof o.y !== 'number'
      || typeof o.w !== 'number' || typeof o.h !== 'number') continue;
    imageBoxes.push({ x: o.x, y: o.y, w: o.w, h: o.h });
  }
  if (imageBoxes.length === 0) return 0;

  let removed = 0;
  for (let i = objs.length - 1; i >= 0; i -= 1) {
    const obj = objs[i];
    if (obj?._type !== 'text') continue;
    if (!obj.shape || !_DEDUPE_PRIMITIVE_SHAPES.has(obj.shape)) continue;
    if (_hasMeaningfulText(obj)) continue;
    const o = obj.options || {};
    if (typeof o.x !== 'number' || typeof o.y !== 'number'
      || typeof o.w !== 'number' || typeof o.h !== 'number') continue;
    const shapeArea = Math.max(o.w * o.h, 1e-6);
    for (const img of imageBoxes) {
      const ox = Math.max(o.x, img.x);
      const oy = Math.max(o.y, img.y);
      const ex = Math.min(o.x + o.w, img.x + img.w);
      const ey = Math.min(o.y + o.h, img.y + img.h);
      if (ex <= ox || ey <= oy) continue;
      const overlap = (ex - ox) * (ey - oy);
      const imgArea = Math.max(img.w * img.h, 1e-6);
      if (overlap / shapeArea < minOverlapFraction) continue;
      if (imgArea > shapeArea * maxAreaRatio) continue;
      if (imgArea * maxAreaRatio < shapeArea) continue;
      objs.splice(i, 1);
      removed += 1;
      break;
    }
  }
  return removed;
}

// ── DOM-position measurement (for export-LLM grounding) ─────────────────────
// Render the slide HTML in the same offscreen measure-DOM the rasterizer
// uses, walk every classed element, and emit a compact list of pixel
// bounding boxes. The export LLM then uses those exact coordinates instead
// of trying to derive them from CSS rules (which drifts ~0.1-0.3in for any
// CSS that uses flex / grid / centering).
//
// Same pipeline as injectRasterizedSvgIcons up to the awaitFonts barrier;
// kept separate to keep the call sites independent (raster injection and
// position measurement can be combined later if helpful).

const _DOM_POSITION_INTERESTING_TAGS = new Set([
  'div', 'section', 'article', 'aside', 'header', 'footer', 'nav',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'a', 'li', 'ul', 'ol',
  'figure', 'figcaption', 'img', 'svg',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
]);

/**
 * Measure every classed element in the slide's offscreen render and return
 * (cls, tag, x, y, w, h) tuples in pixels relative to the slide top-left.
 *
 * Returns [] if document is unavailable, the slide has no HTML, or
 * measurement fails — caller should treat empty as "fall back to legacy
 * CSS-derived positions".
 */
export async function measureSlideDomElementPositions(slide, settings) {
  if (typeof document === 'undefined') return [];
  if (!slide?.html || typeof slide.html !== 'string') return [];

  const meta = getCanvasMeta(settings);
  const host = document.createElement('div');
  host.setAttribute('data-pptx-dom-position-measure', '1');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${meta.widthPx}px`,
    height: `${meta.heightPx}px`,
    opacity: '1',
    pointerEvents: 'none',
    overflow: 'hidden',
    margin: '0',
    padding: '0',
    zIndex: '1',
    background: '#fff',
  });

  const styleEl = document.createElement('style');
  styleEl.textContent = buildMeasureStylesheet(slide, settings);
  host.appendChild(styleEl);

  const renderWrap = document.createElement('div');
  renderWrap.className = 'slide-render-container';
  renderWrap.style.cssText = `width:${meta.widthPx}px;height:${meta.heightPx}px;position:relative;overflow:hidden;margin:0;padding:0;`;
  renderWrap.innerHTML = prepareSlideMarkupForMeasure(slide.html, slide, settings);
  host.appendChild(renderWrap);

  document.body.appendChild(host);

  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* font readiness is best-effort */ }
    }

    const rootRect = renderWrap.getBoundingClientRect();
    const positions = [];
    const seenTuples = new Set();

    for (const el of renderWrap.querySelectorAll('[class]')) {
      // Skip svg internals — the rasterizer captures the icon as one unit;
      // exposing every <path>/<circle> inside it would just bloat the prompt.
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const tag = el.tagName.toLowerCase();
      if (!_DOM_POSITION_INTERESTING_TAGS.has(tag)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      const cls = (el.getAttribute('class') || '').trim();
      if (!cls) continue;
      const x = Math.round(rect.left - rootRect.left);
      const y = Math.round(rect.top - rootRect.top);
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      // Drop elements positioned outside the visible slide area
      // (offscreen scroll containers, helper measure nodes, etc).
      if (x + w < 0 || y + h < 0) continue;
      if (x > meta.widthPx || y > meta.heightPx) continue;
      // Dedupe identical (cls, tag, x, y, w, h) tuples — common when CSS
      // wraps a single child, producing a parent and child with the same
      // box.
      const key = `${tag}.${cls}|${x},${y},${w},${h}`;
      if (seenTuples.has(key)) continue;
      seenTuples.add(key);
      positions.push({ tag, cls, x, y, w, h });
    }

    return positions;
  } catch (err) {
    console.warn('[PPTX] measureSlideDomElementPositions failed:', err?.message || err);
    return [];
  } finally {
    host.remove();
  }
}

/**
 * Format the position list as a compact prompt block. Caps the number of
 * lines so prompt growth stays bounded for slides with hundreds of nodes.
 */
export function formatDomPositionsForPrompt(positions, opts = {}) {
  const maxEntries = opts.maxEntries ?? 80;
  if (!Array.isArray(positions) || positions.length === 0) return '';

  // Prioritise: keep top-level layout containers first, then drill down.
  // Sort by y then x so the list reads roughly top-to-bottom.
  const sorted = positions.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const trimmed = sorted.slice(0, maxEntries);

  const lines = trimmed.map(p => {
    // Compact selector: tag + first 2-3 class tokens.
    const sel = (p.cls || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const selStr = sel ? `${p.tag}.${sel}` : p.tag;
    return `${selStr.padEnd(40, ' ')} ${String(p.w).padStart(4)}x${String(p.h).padStart(3)} @ ${String(p.x).padStart(4)},${String(p.y).padStart(3)}`;
  });

  const truncatedNote = positions.length > maxEntries
    ? `\n(${positions.length - maxEntries} additional smaller elements omitted)`
    : '';

  return [
    'DOM POSITIONS (canvas px, top-left origin, slide is 960x540):',
    'These are the actual rendered positions from the slide HTML — they reflect the',
    'real flex / grid / padding / centring layout, not just the static CSS rules.',
    'For every element you draw, USE THESE EXACT pixel coordinates instead of',
    'recomputing from CSS. Convert px to inches: x_in = x_px * 13.333 / 960,',
    'y_in = y_px * 7.5 / 540, w_in = w_px * 13.333 / 960, h_in = h_px * 7.5 / 540.',
    '',
    ...lines,
    truncatedNote,
  ].filter(Boolean).join('\n');
}
