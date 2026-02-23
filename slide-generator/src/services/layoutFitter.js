/**
 * Layout Fitter Service
 * Smart content fitting - inspects first, squeezes only if needed
 */

// Minimum font sizes (in px) to maintain readability
const MIN_FONT_SIZES = {
  h3: 12,
  h4: 11,
  p: 10,
  span: 10,
  li: 10,
  td: 9,
  th: 10,
  div: 10,
  default: 10,
};

// Elements to skip (headers, footers, titles)
const SKIP_SELECTORS = [
  '.title', '.subtitle', '.footer', 'h1', 'h2.subtitle',
  '.cover-title', '.cover-category', '.cover-branding', '.cover-date',
];

/**
 * Check if element should be skipped
 */
function shouldSkip(el) {
  for (const selector of SKIP_SELECTORS) {
    if (el.matches?.(selector) || el.closest?.(selector)) return true;
  }
  return false;
}

/**
 * Get computed font size in pixels
 */
function getFontSize(el) {
  return parseFloat(window.getComputedStyle(el).fontSize) || 14;
}

/**
 * Get minimum font size for element type
 */
function getMinFontSize(el) {
  return MIN_FONT_SIZES[el.tagName.toLowerCase()] || MIN_FONT_SIZES.default;
}

/**
 * Get all text-containing elements within the frame
 */
function getTextElements(frameEl) {
  const elements = [];
  const walker = document.createTreeWalker(
    frameEl,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
        const hasText = Array.from(node.childNodes).some(
          child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()
        );
        const isTextEl = ['P', 'SPAN', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'STRONG', 'EM', 'DIV'].includes(node.tagName);
        return (hasText || (isTextEl && node.textContent.trim())) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    }
  );
  let node;
  while (node = walker.nextNode()) elements.push(node);
  return elements;
}

/**
 * INSPECT: Check frame overflow status
 */
function inspectFrame(frameEl) {
  const rect = frameEl.getBoundingClientRect();
  const scrollH = frameEl.scrollHeight;
  const scrollW = frameEl.scrollWidth;

  const overflowH = scrollH - rect.height;
  const overflowW = scrollW - rect.width;
  const isOverflowing = overflowH > 2 || overflowW > 2;
  const ratio = Math.max(scrollH / rect.height, scrollW / rect.width);

  return {
    isOverflowing,
    overflowH: Math.max(0, overflowH),
    overflowW: Math.max(0, overflowW),
    ratio,
    frameHeight: rect.height,
    frameWidth: rect.width,
    contentHeight: scrollH,
    contentWidth: scrollW,
  };
}

/**
 * Reduce font sizes proportionally
 */
function reduceFontSizes(textElements, factor = 0.95) {
  let anyReduced = false;
  for (const el of textElements) {
    const current = getFontSize(el);
    const min = getMinFontSize(el);
    const newSize = Math.max(min, current * factor);
    if (newSize < current) {
      el.style.fontSize = `${newSize}px`;
      anyReduced = true;
    }
  }
  return anyReduced;
}

/**
 * Reduce line heights
 */
function reduceLineHeights(textElements, minRatio = 1.2) {
  for (const el of textElements) {
    const computed = window.getComputedStyle(el);
    const lh = parseFloat(computed.lineHeight);
    const fs = parseFloat(computed.fontSize);
    if (!isNaN(lh) && !isNaN(fs) && lh / fs > minRatio) {
      el.style.lineHeight = `${minRatio}`;
    }
  }
}

/**
 * Reduce spacing (padding, margins, gaps)
 */
function reduceSpacing(frameEl, factor = 0.85) {
  const containers = frameEl.querySelectorAll('.card, .grid-cell, .kpi-block, .key-point, .content-box, .section-box, [style*="padding"]');

  for (const el of containers) {
    const cs = window.getComputedStyle(el);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    if (pt > 6) el.style.paddingTop = `${Math.max(6, pt * factor)}px`;
    if (pb > 6) el.style.paddingBottom = `${Math.max(6, pb * factor)}px`;

    const mb = parseFloat(cs.marginBottom) || 0;
    if (mb > 6) el.style.marginBottom = `${Math.max(6, mb * factor)}px`;
  }

  // Reduce gaps
  const flexGrid = frameEl.querySelectorAll('.card-row, .two-col, .grid-2x2, .key-points, [style*="gap"]');
  for (const el of flexGrid) {
    const gap = parseFloat(window.getComputedStyle(el).gap) || 0;
    if (gap > 8) el.style.gap = `${Math.max(8, gap * factor)}px`;
  }
}

/**
 * Apply scale transform as last resort
 */
function applyScale(frameEl, scale) {
  let wrapper = frameEl.querySelector('.fit-scale-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'fit-scale-wrapper';
    wrapper.style.transformOrigin = 'top left';
    wrapper.style.width = `${100 / scale}%`;
    while (frameEl.firstChild) wrapper.appendChild(frameEl.firstChild);
    frameEl.appendChild(wrapper);
  }
  wrapper.style.transform = `scale(${scale})`;
}

/**
 * Main: Fit content to frame
 * Smart approach: inspect first, squeeze only if needed
 */
export function fitContentToFrame(slideEl, options = {}) {
  const { maxIterations = 15, debug = false } = options;

  const frameEl = slideEl.querySelector('.frame');
  if (!frameEl) {
    return { success: false, error: 'No .frame element found', status: 'no-frame' };
  }

  // STEP 1: INSPECT
  const initial = inspectFrame(frameEl);

  if (debug) {
    console.log('[Fit] Inspecting...', initial);
  }

  // If not overflowing, no action needed
  if (!initial.isOverflowing) {
    if (debug) console.log('[Fit] Content fits perfectly, no changes needed');
    return {
      success: true,
      status: 'fits',
      message: 'Content already fits within frame',
      inspection: initial,
      adjustments: null,
    };
  }

  // STEP 2: SQUEEZE (only if needed)
  if (debug) {
    console.log(`[Fit] Content overflows by ${initial.overflowH}px height, ${initial.overflowW}px width`);
    console.log('[Fit] Starting squeeze process...');
  }

  const textElements = getTextElements(frameEl);
  let adjustments = { fontReductions: 0, lineHeightReduced: false, spacingReductions: 0, scaleApplied: null };

  // Phase 1: Reduce fonts
  let iteration = 0;
  while (inspectFrame(frameEl).isOverflowing && iteration < maxIterations) {
    if (!reduceFontSizes(textElements, 0.94)) break;
    adjustments.fontReductions++;
    iteration++;
  }

  // Phase 2: Reduce line heights
  if (inspectFrame(frameEl).isOverflowing) {
    reduceLineHeights(textElements, 1.25);
    adjustments.lineHeightReduced = true;
  }

  // Phase 3: Reduce spacing
  let spacingIter = 0;
  while (inspectFrame(frameEl).isOverflowing && spacingIter < 4) {
    reduceSpacing(frameEl, 0.8);
    adjustments.spacingReductions++;
    spacingIter++;
  }

  // Phase 4: Scale as last resort
  const afterAdjust = inspectFrame(frameEl);
  if (afterAdjust.isOverflowing) {
    const scale = Math.max(0.75, 1 / afterAdjust.ratio - 0.01);
    applyScale(frameEl, scale);
    adjustments.scaleApplied = scale;
  }

  const final = inspectFrame(frameEl);

  if (debug) {
    console.log('[Fit] Complete:', { adjustments, final });
  }

  return {
    success: !final.isOverflowing,
    status: final.isOverflowing ? 'partial' : 'squeezed',
    message: final.isOverflowing
      ? `Reduced but still overflows by ${final.overflowH.toFixed(0)}px`
      : `Squeezed to fit (${adjustments.fontReductions} font reductions${adjustments.scaleApplied ? `, scaled to ${Math.round(adjustments.scaleApplied * 100)}%` : ''})`,
    inspection: { initial, final },
    adjustments,
  };
}

/**
 * Reset all fit adjustments
 */
export function resetFitAdjustments(slideEl) {
  const frameEl = slideEl.querySelector('.frame');
  if (!frameEl) return;

  // Remove scale wrapper
  const wrapper = frameEl.querySelector('.fit-scale-wrapper');
  if (wrapper) {
    while (wrapper.firstChild) frameEl.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  }

  // Reset inline styles
  frameEl.querySelectorAll('*').forEach(el => {
    el.style.fontSize = '';
    el.style.lineHeight = '';
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    el.style.marginBottom = '';
    el.style.gap = '';
  });
}

/**
 * Get overflow status without making changes
 */
export function getOverflowStatus(slideEl) {
  const frameEl = slideEl.querySelector('.frame');
  if (!frameEl) return { hasFrame: false };

  const info = inspectFrame(frameEl);
  return {
    hasFrame: true,
    ...info,
  };
}

/**
 * Check if slide has fit adjustments applied
 */
export function hasFitAdjustments(slideEl) {
  const frameEl = slideEl.querySelector('.frame');
  return frameEl?.querySelector('.fit-scale-wrapper') != null;
}
