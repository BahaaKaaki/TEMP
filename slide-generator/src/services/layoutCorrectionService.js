/**
 * Smart Layout Correction Service
 *
 * Analyzes WHY overflow occurs and applies intelligent fixes based on:
 * 1. Template type (cards, bullets, dashboard, etc.)
 * 2. Content structure (item count, text density)
 * 3. Proportional scaling rather than fixed deltas
 */

// Template-specific fix strategies
const TEMPLATE_STRATEGIES = {
  // AUTO-LAYOUT SYSTEM (new flex-based components)
  'auto-layout': {
    analyze: (el) => ({
      rows: countElements(el, '.auto-row'),
      cols: countElements(el, '.auto-col'),
      grids: countElements(el, '.auto-grid'),
      items: countElements(el, '.content-box, .metric-box, .section-box'),
    }),
    fixes: [
      { type: 'reduce', selector: '.auto-row, .auto-col, .auto-grid', property: 'gap', percent: 0.6, min: 6 },
      { type: 'reduce', selector: '.content-box, .section-box', property: 'padding', percent: 0.75, min: 10 },
      { type: 'reduce', selector: '.metric-box', property: 'padding', percent: 0.7, min: 8 },
      { type: 'font', selector: '.content-box p, .section-box p', percent: 0.9, min: 10 },
      { type: 'font', selector: '.content-box h3, .section-box h4', percent: 0.9, min: 11 },
      { type: 'font', selector: '.metric-box .value', percent: 0.85, min: 22 },
    ],
  },

  // Card-based layouts
  'two-cards': {
    analyze: (el) => countElements(el, '.card'),
    fixes: [
      { type: 'flex', selector: '.card-row', property: 'align-items', value: 'stretch' },
      { type: 'reduce', selector: '.card', property: 'padding', percent: 0.8, min: 12 },
      { type: 'reduce', selector: '.card-list li', property: 'margin-bottom', percent: 0.5, min: 2 },
      { type: 'reduce', selector: '.impact-box', property: 'padding', percent: 0.7, min: 6 },
      { type: 'font', selector: '.card p, .card li', percent: 0.9, min: 10 },
    ],
  },
  'four-cards': {
    analyze: (el) => countElements(el, '.card'),
    fixes: [
      { type: 'reduce', selector: '.card-row', property: 'gap', percent: 0.6, min: 8 },
      { type: 'reduce', selector: '.card', property: 'padding', percent: 0.7, min: 10 },
      { type: 'hide', selector: '.card-list', condition: (el) => el.closest('.card').querySelectorAll('li').length > 2 },
      { type: 'font', selector: '.card p', percent: 0.85, min: 9 },
      { type: 'font', selector: '.card h3', percent: 0.9, min: 11 },
    ],
  },

  // Dashboard/metrics
  'dashboard': {
    analyze: (el) => countElements(el, '.dashboard-metric'),
    fixes: [
      { type: 'reduce', selector: '.dashboard-grid', property: 'gap', percent: 0.7, min: 8 },
      { type: 'reduce', selector: '.dashboard-metric', property: 'padding', percent: 0.75, min: 10 },
      { type: 'font', selector: '.metric-label', percent: 0.9, min: 9 },
      { type: 'font', selector: '.metric-value', percent: 0.85, min: 24 },
    ],
  },

  // Case study (3 horizontal sections)
  'case-study': {
    analyze: (el) => countElements(el, '.case-section'),
    fixes: [
      { type: 'reduce', selector: '.case-study-layout', property: 'gap', percent: 0.6, min: 6 },
      { type: 'reduce', selector: '.case-section', property: 'padding', percent: 0.75, min: 10 },
      { type: 'font', selector: '.case-section p, .case-section li', percent: 0.9, min: 9 },
      { type: 'hide', selector: '.case-section ul', condition: (el) => el.closest('.case-section').querySelector('p') },
    ],
  },

  // Checklist
  'checklist': {
    analyze: (el) => countElements(el, '.check-item'),
    fixes: [
      { type: 'reduce', selector: '.check-item', property: 'padding', percent: 0.7, min: 6 },
      { type: 'reduce', selector: '.check-item', property: 'margin-bottom', percent: 0.5, min: 4 },
      { type: 'font', selector: '.check-text', percent: 0.9, min: 10 },
    ],
  },

  // Funnel
  'funnel': {
    analyze: (el) => countElements(el, '.funnel-stage'),
    fixes: [
      { type: 'reduce', selector: '.funnel-container', property: 'gap', percent: 0.5, min: 3 },
      { type: 'reduce', selector: '.funnel-stage', property: 'padding', percent: 0.7, min: 10 },
      { type: 'font', selector: '.stage-value', percent: 0.85, min: 18 },
    ],
  },

  // Pyramid
  'pyramid': {
    analyze: (el) => countElements(el, '.pyramid-tier'),
    fixes: [
      { type: 'reduce', selector: '.pyramid-container', property: 'gap', percent: 0.5, min: 4 },
      { type: 'reduce', selector: '.pyramid-tier', property: 'padding', percent: 0.75, min: 12 },
      { type: 'font', selector: '.tier-content p', percent: 0.9, min: 9 },
    ],
  },

  // Split layout
  'split': {
    analyze: (el) => ({
      leftItems: countElements(el, '.split-left li'),
      hasPlaceholder: !!el.querySelector('.visual-placeholder'),
    }),
    fixes: [
      { type: 'reduce', selector: '.split-layout', property: 'gap', percent: 0.75, min: 16 },
      { type: 'reduce', selector: '.split-left', property: 'gap', percent: 0.7, min: 8 },
      { type: 'reduce', selector: '.content-list li', property: 'margin-bottom', percent: 0.6, min: 4 },
      { type: 'font', selector: '.split-left p, .split-left li', percent: 0.9, min: 10 },
    ],
  },

  // Risk matrix
  'risk-matrix': {
    analyze: (el) => countElements(el, '.matrix-cell'),
    fixes: [
      { type: 'reduce', selector: '.risk-matrix', property: 'gap', percent: 0.7, min: 4 },
      { type: 'reduce', selector: '.matrix-cell', property: 'padding', percent: 0.7, min: 8 },
      { type: 'font', selector: '.matrix-cell', percent: 0.9, min: 9 },
    ],
  },

  // Generic/bullets
  'generic': {
    analyze: (el) => ({
      bulletCount: countElements(el, 'li'),
      paragraphCount: countElements(el, 'p'),
    }),
    fixes: [
      { type: 'reduce', selector: '.frame', property: 'padding', percent: 0.85, min: 20 },
      { type: 'reduce', selector: 'ul, ol', property: 'margin', percent: 0.7, min: 4 },
      { type: 'reduce', selector: 'li', property: 'margin-bottom', percent: 0.6, min: 2 },
      { type: 'lineHeight', selector: 'p, li', percent: 0.95, min: 1.25 },
      { type: 'font', selector: 'p, li', percent: 0.92, min: 10 },
    ],
  },
};

// Helper functions
function countElements(container, selector) {
  return container.querySelectorAll(selector).length;
}

function detectTemplateType(slideElement) {
  const classes = slideElement.className || '';
  const frame = slideElement.querySelector('.frame');
  const frameClasses = frame?.className || '';
  const html = slideElement.innerHTML || '';

  // Check for AUTO-LAYOUT components first (new flex system)
  if (html.includes('auto-row') || html.includes('auto-col') || html.includes('auto-grid')) return 'auto-layout';
  if (html.includes('content-box') || html.includes('metric-box') || html.includes('section-box')) return 'auto-layout';

  // Check for specific template indicators
  if (html.includes('four-cards') || classes.includes('four-cards')) return 'four-cards';
  if (html.includes('two-cards') || classes.includes('two-cards')) return 'two-cards';
  if (html.includes('dashboard-grid') || html.includes('dashboard-metric')) return 'dashboard';
  if (html.includes('case-study') || html.includes('case-section')) return 'case-study';
  if (html.includes('checklist') || html.includes('check-item')) return 'checklist';
  if (html.includes('funnel-container') || html.includes('funnel-stage')) return 'funnel';
  if (html.includes('pyramid-container') || html.includes('pyramid-tier')) return 'pyramid';
  if (html.includes('split-layout') || html.includes('split-left')) return 'split';
  if (html.includes('risk-matrix') || html.includes('matrix-cell')) return 'risk-matrix';

  return 'generic';
}

function getComputedValue(element, property) {
  const computed = window.getComputedStyle(element);
  const value = computed.getPropertyValue(property);
  return parseFloat(value) || 0;
}

function applyProportionalFix(element, property, percent, min) {
  const current = getComputedValue(element, property);
  const newValue = Math.max(current * percent, min);

  if (newValue < current) {
    element.style[property] = `${Math.round(newValue)}px`;
    return { applied: true, from: current, to: newValue };
  }
  return { applied: false };
}

function applyFontFix(element, percent, min) {
  const current = getComputedValue(element, 'font-size');
  const newValue = Math.max(current * percent, min);

  if (newValue < current) {
    element.style.fontSize = `${Math.round(newValue)}px`;
    return { applied: true, from: current, to: newValue };
  }
  return { applied: false };
}

function applyLineHeightFix(element, percent, min) {
  const current = getComputedValue(element, 'line-height');
  const fontSize = getComputedValue(element, 'font-size');
  const ratio = current / fontSize;
  const newRatio = Math.max(ratio * percent, min);

  if (newRatio < ratio) {
    element.style.lineHeight = String(newRatio.toFixed(2));
    return { applied: true, from: ratio.toFixed(2), to: newRatio.toFixed(2) };
  }
  return { applied: false };
}

/**
 * Inspect slide and return detailed analysis
 */
export function inspectSlide(slideElement) {
  if (!slideElement) {
    return { success: false, error: 'No slide element', hasIssues: false, issues: [] };
  }

  const slideRect = slideElement.getBoundingClientRect();
  const frame = slideElement.querySelector('.frame');
  const footer = slideElement.querySelector('.footer');

  const inspection = {
    slide: { width: Math.round(slideRect.width), height: Math.round(slideRect.height) },
    templateType: detectTemplateType(slideElement),
    elements: {},
    issues: [],
    overflow: 0,
  };

  // Check frame overflow
  if (frame) {
    const frameRect = frame.getBoundingClientRect();
    inspection.elements.frame = {
      height: Math.round(frameRect.height),
      contentHeight: Math.round(frame.scrollHeight),
      bottom: Math.round(frameRect.bottom - slideRect.top),
    };

    const overflow = frame.scrollHeight - frameRect.height;
    if (overflow > 5) {
      inspection.overflow = Math.round(overflow);
      inspection.issues.push({
        type: 'frame-overflow',
        severity: 'high',
        message: `Content overflows by ${Math.round(overflow)}px`,
        overflow: Math.round(overflow),
      });
    }
  }

  // Check frame-footer overlap
  if (frame && footer) {
    const frameBottom = frame.getBoundingClientRect().bottom - slideRect.top;
    const footerTop = footer.getBoundingClientRect().top - slideRect.top;

    if (frameBottom > footerTop + 2) {
      const overlap = Math.round(frameBottom - footerTop);
      inspection.overflow = Math.max(inspection.overflow, overlap);
      inspection.issues.push({
        type: 'overlap',
        severity: 'high',
        message: `Frame overlaps footer by ${overlap}px`,
        overlap,
      });
    }
  }

  // Check elements extending beyond slide
  const contentElements = slideElement.querySelectorAll('.card, .dashboard-metric, .case-section, .funnel-stage, .pyramid-tier, .check-item');
  contentElements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const bottom = rect.bottom - slideRect.top;
    if (bottom > slideRect.height) {
      const overflow = Math.round(bottom - slideRect.height);
      inspection.overflow = Math.max(inspection.overflow, overflow);
      inspection.issues.push({
        type: 'element-overflow',
        severity: 'medium',
        message: `${el.className.split(' ')[0]} extends ${overflow}px beyond slide`,
        overflow,
      });
    }
  });

  inspection.hasIssues = inspection.issues.length > 0;
  inspection.summary = inspection.hasIssues
    ? `${inspection.templateType}: ${inspection.overflow}px overflow`
    : 'No issues';

  return inspection;
}

/**
 * Smart fix loop - uses template-specific strategies
 */
export function agenticFixLoop(slideElement, options = {}) {
  const { maxIterations = 15, onStep = null, slideIndex = 0, slideTitle = 'Untitled' } = options;
  const slideLabel = `Slide ${slideIndex + 1}: "${slideTitle}"`;
  const log = [];

  // Initial inspection
  let inspection = inspectSlide(slideElement);
  log.push({ type: 'inspect', message: `🔍 [${slideLabel}] ${inspection.templateType} - ${inspection.summary}`, data: inspection });
  if (onStep) onStep(log[log.length - 1]);

  if (!inspection.hasIssues) {
    log.push({ type: 'complete', message: `✅ [${slideLabel}] No issues detected` });
    if (onStep) onStep(log[log.length - 1]);
    return { success: true, log, finalInspection: inspection, slideIndex, slideTitle };
  }

  // Get template-specific strategy
  const strategy = TEMPLATE_STRATEGIES[inspection.templateType] || TEMPLATE_STRATEGIES['generic'];
  const fixes = [...strategy.fixes]; // Clone to track progress

  log.push({
    type: 'reason',
    message: `🧠 [${slideLabel}] Overflow: ${inspection.overflow}px\nUsing ${inspection.templateType} strategy with ${fixes.length} fix stages`,
  });
  if (onStep) onStep(log[log.length - 1]);

  // Apply fixes iteratively
  let iteration = 0;
  let fixIndex = 0;
  let lastOverflow = inspection.overflow;

  while (iteration < maxIterations && fixIndex < fixes.length && inspection.hasIssues) {
    iteration++;
    const fix = fixes[fixIndex];

    // Apply the fix
    const elements = slideElement.querySelectorAll(fix.selector);
    let appliedCount = 0;

    elements.forEach((el) => {
      // Check condition if present
      if (fix.condition && !fix.condition(el)) return;

      let result;
      switch (fix.type) {
        case 'reduce':
          result = applyProportionalFix(el, fix.property, fix.percent, fix.min);
          break;
        case 'font':
          result = applyFontFix(el, fix.percent, fix.min);
          break;
        case 'lineHeight':
          result = applyLineHeightFix(el, fix.percent, fix.min);
          break;
        case 'flex':
          el.style[fix.property] = fix.value;
          result = { applied: true };
          break;
        case 'hide':
          if (fix.condition && fix.condition(el)) {
            el.style.display = 'none';
            result = { applied: true };
          }
          break;
        default:
          result = { applied: false };
      }

      if (result?.applied) appliedCount++;
    });

    if (appliedCount > 0) {
      log.push({
        type: 'applied',
        iteration,
        message: `✓ ${fix.type} on ${fix.selector} (${appliedCount} elements)`,
      });
      if (onStep) onStep(log[log.length - 1]);

      // Re-inspect
      inspection = inspectSlide(slideElement);
      const improvement = lastOverflow - inspection.overflow;

      log.push({
        type: 'verify',
        iteration,
        message: inspection.hasIssues
          ? `📏 ${inspection.overflow}px remaining (${improvement > 0 ? `-${improvement}px` : 'no change'})`
          : `📏 Fixed! No overflow remaining`,
        data: inspection,
      });
      if (onStep) onStep(log[log.length - 1]);

      if (!inspection.hasIssues) {
        log.push({ type: 'complete', message: `✅ [${slideLabel}] Fixed in ${iteration} steps` });
        if (onStep) onStep(log[log.length - 1]);
        return { success: true, log, finalInspection: inspection, iterations: iteration, slideIndex, slideTitle };
      }

      // If no improvement, move to next fix
      if (improvement <= 0) {
        fixIndex++;
      }
      lastOverflow = inspection.overflow;
    } else {
      fixIndex++;
    }
  }

  // If still overflowing, suggest content reduction
  if (inspection.hasIssues) {
    const suggestion = getSuggestion(inspection, slideElement);
    log.push({
      type: 'exhausted',
      message: `⚠️ [${slideLabel}] ${inspection.overflow}px overflow remains\n💡 ${suggestion}`,
    });
    if (onStep) onStep(log[log.length - 1]);
  }

  return {
    success: false,
    log,
    finalInspection: inspection,
    iterations: iteration,
    remainingIssues: inspection.issues,
    slideIndex,
    slideTitle,
  };
}

/**
 * Generate smart suggestion based on template and content
 */
function getSuggestion(inspection, slideElement) {
  const type = inspection.templateType;

  switch (type) {
    case 'auto-layout': {
      const boxes = countElements(slideElement, '.content-box, .section-box');
      const metrics = countElements(slideElement, '.metric-box');
      if (boxes > 3) return `Too many content boxes (${boxes}). Use max 2-3.`;
      if (metrics > 6) return `Too many metrics (${metrics}). Use max 6.`;
      return 'Reduce content in boxes or use fewer components';
    }
    case 'four-cards':
      return 'Consider using 2-card layout or removing bullet points from cards';
    case 'two-cards':
      return 'Reduce bullet points per card or shorten descriptions';
    case 'dashboard':
      return 'Consider using 4 metrics instead of 6, or shorter labels';
    case 'case-study':
      return 'Shorten descriptions or remove bullet points from sections';
    case 'checklist':
      return 'Reduce number of checklist items or use 2 columns';
    case 'funnel':
      return 'Use fewer funnel stages or shorter labels';
    case 'pyramid':
      return 'Shorten tier descriptions';
    case 'split':
      return 'Reduce bullet points or shorten the paragraph';
    case 'generic': {
      const liCount = countElements(slideElement, 'li');
      if (liCount > 6) return `Too many bullet points (${liCount}). Aim for 4-6 max.`;
      return 'Reduce text length or number of items';
    }
    default:
      return 'Reduce content amount or switch to a different template';
  }
}

/**
 * Format inspection for display
 */
export function formatInspection(inspection) {
  const lines = [`**Template:** ${inspection.templateType}`];
  lines.push(`**Overflow:** ${inspection.overflow}px`);

  if (inspection.issues.length > 0) {
    lines.push('\n**Issues:**');
    inspection.issues.forEach((i) => {
      lines.push(`• ${i.message}`);
    });
  }

  return lines.join('\n');
}

/**
 * Reset inline styles
 */
export function resetCSSFixes(slideElement) {
  const selectors = [
    // Auto-layout components
    '.auto-row', '.auto-col', '.auto-grid', '.content-box', '.metric-box', '.section-box', '.highlight-box',
    // Legacy templates
    '.card', '.dashboard-metric', '.case-section', '.check-item', '.funnel-stage',
    '.pyramid-tier', '.frame', 'p', 'li', 'h3', 'h4', 'ul', 'ol', '.card-row', '.dashboard-grid',
    '.split-layout', '.split-left', '.content-list', '.impact-box', '.metric-value', '.metric-label',
    '.case-study-layout', '.checklist-layout', '.funnel-container', '.pyramid-container', '.matrix-cell'
  ];

  selectors.forEach((sel) => {
    slideElement.querySelectorAll(sel).forEach((el) => {
      el.style.cssText = '';
    });
  });
}

// Legacy exports
export const detectLayoutIssues = (el) => {
  const i = inspectSlide(el);
  return { hasIssues: i.hasIssues, overflow: i.issues[0], details: i.issues.map((x) => x.message) };
};

export const attemptCSSFixes = (el, opts) => {
  const r = agenticFixLoop(el, opts);
  return {
    success: r.success,
    attempts: r.iterations || 0,
    appliedFixes: r.log.filter((l) => l.type === 'applied').map((l) => ({ fixName: l.message })),
    remainingIssues: r.finalInspection,
    log: r.log.map((l) => l.message),
    message: r.success ? `Fixed in ${r.iterations} steps` : 'CSS fixes exhausted',
  };
};

export const generateGPTContext = () => 'Layout issues remain. Consider reducing content.';

export default {
  inspectSlide,
  agenticFixLoop,
  formatInspection,
  resetCSSFixes,
  detectLayoutIssues,
  attemptCSSFixes,
  generateGPTContext,
  TEMPLATE_STRATEGIES,
};
