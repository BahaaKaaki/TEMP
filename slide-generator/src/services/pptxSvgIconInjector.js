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
    }
  } finally {
    host.remove();
  }
}
