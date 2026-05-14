import SHELL_CSS from '../styles/slides.css?raw';
import { themeToCSS } from '../utils/themeUtils.js';
import { addFooter, addSourceNote } from './pptxRenderers.js';
import {
  getSlideMeasureClientChromeCss,
  getSlideMeasureContainerCss,
} from './slidePreviewMeasureCss.js';

const DEFAULT_CANVAS = { widthPx: 960, heightPx: 540, widthIn: 13.333, heightIn: 7.5 };
const MAX_TEXT_NODES = 140;
const MAX_SHAPE_NODES = 220;
const ICON_RASTER_SCALE = 3;
const UNSUPPORTED_SELECTOR = [
  'canvas',
  'video',
  'iframe',
  '.auto-chart[data-chart]',
  '.chart canvas',
].join(',');
const TEXT_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'TD', 'TH', 'SPAN', 'DIV', 'STRONG', 'EM', 'B', 'I']);
const NON_TEXT_TAGS = new Set(['SVG', 'IMG', 'CANVAS', 'VIDEO', 'IFRAME', 'STYLE', 'SCRIPT', 'META', 'LINK', 'BR', 'HR']);
const CHROME_SELECTOR = '.client-chrome, footer, .footer, .slide-footer, .page-number, [data-no-edit]';
const STRUCTURAL_SELECTOR = [
  '.frame', '.card', '.lever', '.anchor', '.item', '.row', '.cell', '.phase', '.box', '.panel', '.block', '.tile',
  '.matrix', '.quadrant', '.timeline', '.step', '.stage', '.bar', '.band', '.pill', '.badge', '.icon', '.card-icon', '.kpi-icon', '.bullet-icon',
].join(',');

function escapeHtmlAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripStyleTagsFromHtml(html = '') {
  return String(html || '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
}

function extractAllStyleBlocksFromHtml(html = '') {
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    if (match[1]?.trim()) blocks.push(match[1].trim());
  }
  return blocks.join('\n\n');
}

function estimateTrackerOffset(sectionLabel = '', profile = null) {
  const labelLength = String(sectionLabel || '').length;
  const isStc = profile?.id === 'stc';
  const base = isStc ? 38 : 22;
  const charWidth = isStc ? 6.1 : 4.8;
  const min = isStc ? 190 : 0;
  const max = isStc ? 360 : 360;
  return Math.min(max, Math.max(min, Math.round(labelLength * charWidth + base)));
}

function stripClientProfileChrome(html = '') {
  return html
    .replace(/<img\b[^>]*class="[^"]*\bclient-chrome-[a-z0-9_-]+-logo\b[^"]*"[^>]*>/gi, '')
    .replace(/<div\b[^>]*class="[^"]*\bclient-chrome-[a-z0-9_-]+-wordmark\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/\s*data-client-profile="[^"]*"/gi, '');
}

function injectClientProfileChrome(html, profile) {
  const cleanedHtml = stripClientProfileChrome(html || '');
  if (!profile?.id || profile.id === 'strategy' || !cleanedHtml) return cleanedHtml;
  const isSpecialMaster = /\b(master-cover|master-blank|master-emptyPage)\b/i.test(cleanedHtml)
    || /cover-slide|cover-branding|section-divider-slide|separator-slide/i.test(cleanedHtml);
  const withProfile = cleanedHtml.replace(/class="slide([^"]*)"/, `class="slide$1" data-client-profile="${escapeHtmlAttr(profile.id)}"`);
  if (isSpecialMaster) return withProfile;
  const logoVersion = profile?.pptxMaster?.assetVersion || profile?.status || '1';
  const logoSrc = ['stc', 'pif', 'dge'].includes(profile.id)
    ? `/api/assets/client-templates/${profile.id}/logo.png?v=${encodeURIComponent(logoVersion)}`
    : '';
  const wordmarkLabel = profile.id === 'pif' ? 'PIF' : profile.id === 'stc' ? 'stc' : (profile.navLabel || profile.name || profile.id);
  const markup = logoSrc
    ? `<img class="client-chrome client-chrome-${escapeHtmlAttr(profile.id)}-logo" data-no-edit src="${escapeHtmlAttr(logoSrc)}" alt="${escapeHtmlAttr(profile.name || profile.id)}" />`
    : `<div class="client-chrome client-chrome-${escapeHtmlAttr(profile.id)}-wordmark" data-no-edit>${escapeHtmlAttr(wordmarkLabel)}</div>`;
  return withProfile.replace(/(<div\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>)/i, `$1${markup}`);
}

function injectPageNumber(html = '', pageNumber) {
  if (!html) return html;
  const replacement = `<footer class="footer"><span>Strategy&</span><span class="source"></span><span>${pageNumber}</span></footer>`;
  if (/<footer\b[^>]*class="[^"]*\bfooter\b[^"]*"[^>]*>[\s\S]*?<\/footer>/i.test(html)) {
    return html.replace(/<footer\b[^>]*class="[^"]*\bfooter\b[^"]*"[^>]*>[\s\S]*?<\/footer>/i, replacement);
  }
  return html.replace(/<\/div>\s*$/i, `${replacement}</div>`);
}

function prepareSlideHtml(slide, slideNum, totalSlides, profile) {
  let html = stripStyleTagsFromHtml(slide?.html || '');
  if (!/class=["'][^"']*\bslide\b/i.test(html)) html = `<div class="slide">${html}</div>`;
  if ((html.includes('section-divider-slide') || html.includes('separator-slide')) && !html.includes('master-blank')) {
    html = html.replace(/class="slide([^"]*)"/, 'class="slide master-blank$1"');
  }
  if (html.includes('cover-slide') || html.includes('cover-branding')) {
    html = html.replace(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/gi, '');
  }
  if (slide?.sectionLabel) {
    html = html.replace(/class="slide([^"]*)"/, `class="slide$1" data-section="${escapeHtmlAttr(slide.sectionLabel)}"`);
  }
  if (slide?.subSectionLabel) {
    const trackerOffset = estimateTrackerOffset(slide.sectionLabel, profile);
    html = html.replace(/class="slide([^"]*)"/, `class="slide$1" data-subsection="${escapeHtmlAttr(slide.subSectionLabel)}" style="--tracker-offset: ${trackerOffset}px"`);
  }
  html = html.replace(/class="slide([^"]*)"/, `class="slide$1" data-slide-id="${escapeHtmlAttr(slide?.id || `slide-${slideNum}`)}"`);
  html = injectPageNumber(html, slideNum, totalSlides);
  return injectClientProfileChrome(html, profile);
}

function getCanvasMeta(profile) {
  const canvas = profile?.layoutContract?.canvas || {};
  return {
    widthPx: Number(canvas.widthPx) || DEFAULT_CANVAS.widthPx,
    heightPx: Number(canvas.heightPx) || DEFAULT_CANVAS.heightPx,
    widthIn: Number(canvas.widthIn) || DEFAULT_CANVAS.widthIn,
    heightIn: Number(canvas.heightIn) || DEFAULT_CANVAS.heightIn,
  };
}

function buildStylesheet(slide, settings, profile) {
  return [
    SHELL_CSS,
    getSlideMeasureContainerCss(),
    getSlideMeasureClientChromeCss(),
    settings?.theme ? themeToCSS(settings.theme) : '',
    slide?.customCSS || '',
    extractAllStyleBlocksFromHtml(slide?.html || ''),
    profile?.id === 'strategy' ? '' : '',
  ].filter(Boolean).join('\n\n');
}

function pxToIn(px, axis, meta) {
  return (px / (axis === 'y' ? meta.heightPx : meta.widthPx)) * (axis === 'y' ? meta.heightIn : meta.widthIn);
}

function domRectToPptx(rect, rootRect, meta) {
  return {
    x: pxToIn(rect.left - rootRect.left, 'x', meta),
    y: pxToIn(rect.top - rootRect.top, 'y', meta),
    w: Math.max(pxToIn(rect.width, 'x', meta), 0.01),
    h: Math.max(pxToIn(rect.height, 'y', meta), 0.01),
  };
}

function cleanColor(value) {
  if (!value || value === 'transparent') return null;
  const text = String(value).trim();
  const rgba = text.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map(v => v.trim());
    const alpha = parts.length >= 4 ? Number(parts[3]) : 1;
    if (Number.isFinite(alpha) && alpha <= 0.02) return null;
    const nums = parts.slice(0, 3).map(Number);
    if (nums.every(Number.isFinite)) return nums.map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  const hex = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    if (hex.length === 3) return hex.split('').map(ch => ch + ch).join('').toUpperCase();
    return hex.toUpperCase();
  }
  return null;
}

function parsePx(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function isVisibleElement(el, rootRect) {
  if (!(el instanceof Element)) return false;
  if (el.closest(CHROME_SELECTOR)) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.02) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  if (rect.right < rootRect.left || rect.left > rootRect.right || rect.bottom < rootRect.top || rect.top > rootRect.bottom) return false;
  return true;
}

function getDirectText(el) {
  return [...el.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent || '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasElementChildrenWithText(el) {
  return [...el.children].some(child => {
    if (NON_TEXT_TAGS.has(child.tagName)) return false;
    return (child.textContent || '').replace(/\s+/g, ' ').trim().length > 0;
  });
}

function shouldRenderTextElement(el) {
  if (!TEXT_TAGS.has(el.tagName)) return false;
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (el.matches('footer, footer *, .footer, .footer *, .client-chrome, .client-chrome *')) return false;
  if (el.querySelector('svg,img,canvas,video,iframe') && !getDirectText(el)) return false;
  const directText = getDirectText(el);
  if (!directText && hasElementChildrenWithText(el)) return false;
  if (el.children.length > 0 && !directText && !['STRONG', 'EM', 'B', 'I', 'SPAN'].includes(el.tagName)) return false;
  const parent = el.parentElement;
  if (parent && TEXT_TAGS.has(parent.tagName) && getDirectText(parent)) return false;
  return true;
}

function shouldRenderShapeElement(el) {
  if (el.classList?.contains('slide')) return false;
  if (NON_TEXT_TAGS.has(el.tagName)) return false;
  if (shouldRenderTextElement(el) && !el.matches(STRUCTURAL_SELECTOR)) return false;
  const style = getComputedStyle(el);
  const bg = cleanColor(style.backgroundColor);
  const border = cleanColor(style.borderTopColor || style.borderColor);
  const borderWidth = Math.max(parsePx(style.borderTopWidth), parsePx(style.borderRightWidth), parsePx(style.borderBottomWidth), parsePx(style.borderLeftWidth));
  const hasFill = Boolean(bg && bg !== 'FFFFFF');
  const hasBorder = Boolean(border && borderWidth >= 0.5);
  const isKnownStructural = el.matches(STRUCTURAL_SELECTOR);
  return hasFill || hasBorder || isKnownStructural;
}

function pptxFontSize(style, rect, text) {
  const px = parsePx(style.fontSize, 14);
  let pt = px * 0.75;
  if (text.length > 130 && rect.height < 45) pt = Math.min(pt, 10);
  return Math.max(7.5, Math.min(34, Number(pt.toFixed(1))));
}

function pptxRadiusType(style) {
  const radius = Math.max(
    parsePx(style.borderTopLeftRadius),
    parsePx(style.borderTopRightRadius),
    parsePx(style.borderBottomRightRadius),
    parsePx(style.borderBottomLeftRadius),
  );
  return radius >= 8 ? 'roundRect' : 'rect';
}

function addShapeFromElement(slide, el, rootRect, meta) {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const box = domRectToPptx(rect, rootRect, meta);
  if (box.w <= 0.015 || box.h <= 0.015) return false;

  const fill = cleanColor(style.backgroundColor);
  const lineColor = cleanColor(style.borderTopColor || style.borderColor);
  const lineWidthPx = Math.max(parsePx(style.borderTopWidth), parsePx(style.borderRightWidth), parsePx(style.borderBottomWidth), parsePx(style.borderLeftWidth));
  const options = {
    ...box,
    margin: 0,
    fill: fill ? { color: fill, transparency: Math.round((1 - Number(style.opacity || 1)) * 100) || 0 } : { transparency: 100 },
    line: lineColor && lineWidthPx > 0 ? { color: lineColor, width: Math.max(0.25, lineWidthPx * 0.5) } : { color: fill || 'FFFFFF', transparency: 100 },
  };
  slide.addShape(pptxRadiusType(style), options);
  return true;
}

function addTextFromElement(slide, el, rootRect, meta) {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const box = domRectToPptx(rect, rootRect, meta);
  if (box.w <= 0.02 || box.h <= 0.02) return false;
  const color = cleanColor(style.color) || '111111';
  const fontWeight = Number.parseInt(style.fontWeight, 10);
  const align = ['center', 'right', 'justify'].includes(style.textAlign) ? style.textAlign : 'left';
  const fontFace = (style.fontFamily || 'Arial').split(',')[0].replace(/["']/g, '').trim() || 'Arial';
  slide.addText(text, {
    ...box,
    fontFace,
    fontSize: pptxFontSize(style, rect, text),
    bold: Number.isFinite(fontWeight) ? fontWeight >= 600 : /bold/i.test(style.fontWeight),
    italic: style.fontStyle === 'italic',
    color,
    align,
    valign: style.display.includes('flex') || style.alignItems === 'center' ? 'mid' : 'top',
    margin: 0.02,
    fit: 'shrink',
    breakLine: false,
  });
  return true;
}

async function elementToPngData(el, { scale = ICON_RASTER_SCALE, type = 'image/png', quality = 0.92 } = {}) {
  const html2canvas = (await import('html2canvas')).default;
  const rect = el.getBoundingClientRect();
  const canvas = await html2canvas(el, {
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
    scale,
    backgroundColor: null,
    logging: false,
    useCORS: true,
    allowTaint: true,
    scrollX: 0,
    scrollY: 0,
  });
  return canvas.toDataURL(type, quality);
}

async function addImageElement(slide, el, rootRect, meta) {
  const rect = el.getBoundingClientRect();
  const box = domRectToPptx(rect, rootRect, meta);
  if (box.w <= 0.02 || box.h <= 0.02) return false;
  const data = el.tagName === 'IMG' && el.currentSrc ? el.currentSrc : await elementToPngData(el);
  slide.addImage({ data, ...box, altText: el.getAttribute('alt') || 'image' });
  return true;
}

function shouldUseDomMeasuredRenderer(slide, settings = {}) {
  if (settings?.pptxRenderMode === 'ai') return false;
  if (settings?.pptxRenderMode === 'dom-measured') return true;
  const html = String(slide?.html || '');
  if (!html.trim()) return false;
  if (html.includes('<svg') || /class="[^"]*(icon|timeline|roadmap|matrix|lever|card|phase|agenda|row|grid)/i.test(html)) return true;
  return false;
}

export function choosePptxRenderMode(slide, settings = {}) {
  return shouldUseDomMeasuredRenderer(slide, settings) ? 'dom-measured' : 'ai';
}

export async function renderSlideWithDomMeasurement(pptx, slideData, slideNum, totalSlides, settings = {}, profile = null) {
  if (typeof document === 'undefined') return false;
  if (!shouldUseDomMeasuredRenderer(slideData, settings)) return false;

  const meta = getCanvasMeta(profile);
  const host = document.createElement('div');
  host.setAttribute('data-pptx-dom-measure', '1');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-14000px',
    top: '0',
    width: `${meta.widthPx}px`,
    height: `${meta.heightPx}px`,
    overflow: 'hidden',
    pointerEvents: 'none',
    background: '#fff',
    zIndex: '1',
  });

  const styleEl = document.createElement('style');
  styleEl.textContent = buildStylesheet(slideData, settings, profile);
  host.appendChild(styleEl);

  const renderWrap = document.createElement('div');
  renderWrap.className = 'slide-render-container';
  renderWrap.style.cssText = `width:${meta.widthPx}px;height:${meta.heightPx}px;position:relative;overflow:hidden;margin:0;padding:0;`;
  renderWrap.innerHTML = prepareSlideHtml(slideData, slideNum, totalSlides, profile);
  host.appendChild(renderWrap);
  document.body.appendChild(host);

  try {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
    const slideEl = renderWrap.querySelector('.slide');
    if (!slideEl || slideEl.querySelector(UNSUPPORTED_SELECTOR)) return false;
    const rootRect = slideEl.getBoundingClientRect();
    const visible = [...slideEl.querySelectorAll('*')].filter(el => isVisibleElement(el, rootRect));
    const textEls = visible.filter(shouldRenderTextElement).slice(0, MAX_TEXT_NODES);
    const shapeEls = visible.filter(el => shouldRenderShapeElement(el) && !textEls.includes(el)).slice(0, MAX_SHAPE_NODES);
    if (textEls.length === 0 && shapeEls.length < 2) return false;

    const pptxSlide = pptx.addSlide();
    shapeEls
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .forEach(el => addShapeFromElement(pptxSlide, el, rootRect, meta));

    for (const el of visible.filter(el => ['SVG', 'IMG'].includes(el.tagName))) {
      await addImageElement(pptxSlide, el, rootRect, meta).catch(error => {
        console.warn('[PPTX DOM] image/svg capture failed:', error?.message || error);
      });
    }

    textEls
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .forEach(el => addTextFromElement(pptxSlide, el, rootRect, meta));

    addSourceNote(pptxSlide, slideData.html);
    addFooter(pptxSlide, slideNum, totalSlides);
    console.info(`[PPTX DOM] Rendered slide ${slideNum} using DOM-measured renderer`);
    return true;
  } finally {
    host.remove();
  }
}
