/**
 * Layout Validation Service
 * Detects overflow and overlap issues in slide layouts
 */

// Slide dimensions (standard 16:9 aspect ratio)
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

// Frame boundaries (standard positioning)
const FRAME_BOUNDS = {
  left: 35,
  top: 137,
  width: 890,
  height: 353,
  right: 925, // 35 + 890
  bottom: 490, // 137 + 353
};

/**
 * Validates a slide's layout for overflow and overlap issues
 * @param {HTMLElement|string} slideContent - DOM element or HTML string to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with issues array
 */
export function validateSlideLayout(slideContent, options = {}) {
  const {
    checkOverflow = true,
    checkOverlap = true,
    frameBounds = FRAME_BOUNDS,
  } = options;

  // Create a temporary container to parse HTML if string provided
  let container;
  let isTemporary = false;

  if (typeof slideContent === 'string') {
    container = createOffscreenContainer(slideContent);
    isTemporary = true;
  } else if (slideContent instanceof HTMLElement) {
    container = slideContent;
  } else {
    return {
      valid: true,
      issues: [],
      summary: 'No content to validate',
    };
  }

  const issues = [];

  try {
    // Find the slide element
    const slideEl = container.querySelector('.slide') || container;

    if (checkOverflow) {
      const overflowIssues = detectOverflow(slideEl, frameBounds);
      issues.push(...overflowIssues);
    }

    if (checkOverlap) {
      const overlapIssues = detectOverlap(slideEl);
      issues.push(...overlapIssues);
    }

    // Check for content extending beyond slide boundaries
    const boundaryIssues = detectBoundaryViolations(slideEl, frameBounds);
    issues.push(...boundaryIssues);

  } finally {
    // Clean up temporary container
    if (isTemporary && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    summary: generateSummary(issues),
    suggestions: generateSuggestions(issues),
  };
}

/**
 * Creates an offscreen container to render and measure HTML
 */
function createOffscreenContainer(html) {
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    width: ${SLIDE_WIDTH}px;
    height: ${SLIDE_HEIGHT}px;
    overflow: visible;
    visibility: hidden;
  `;
  container.className = 'slide-render-container';
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

/**
 * Detects overflow issues - content hidden by overflow:hidden or extending beyond containers
 */
function detectOverflow(slideEl, frameBounds) {
  const issues = [];

  // Check frame overflow
  const frame = slideEl.querySelector('.frame');
  if (frame) {
    const frameOverflow = checkElementOverflow(frame, 'frame');
    if (frameOverflow) {
      issues.push(frameOverflow);
    }
  }

  // Check common container elements for overflow
  const containers = [
    '.card',
    '.card-row',
    '.kpi-block',
    '.timeline-content',
    '.grid-cell',
    '.col-left',
    '.col-right',
    '.two-col',
    '.quote-box',
    '.detail-item',
  ];

  containers.forEach(selector => {
    const elements = slideEl.querySelectorAll(selector);
    elements.forEach((el, index) => {
      const overflow = checkElementOverflow(el, `${selector.slice(1)}-${index + 1}`);
      if (overflow) {
        issues.push(overflow);
      }
    });
  });

  // Check text elements that might be truncated
  const textElements = slideEl.querySelectorAll('.title, .subtitle, h1, h2, h3, h4, p, .kpi-label, .impact-box');
  textElements.forEach((el, index) => {
    const textOverflow = checkTextOverflow(el, index);
    if (textOverflow) {
      issues.push(textOverflow);
    }
  });

  return issues;
}

/**
 * Checks if an element has content overflow
 */
function checkElementOverflow(el, identifier) {
  const style = window.getComputedStyle(el);
  const hasOverflowHidden = style.overflow === 'hidden' ||
                            style.overflowX === 'hidden' ||
                            style.overflowY === 'hidden';

  const scrollHeight = el.scrollHeight;
  const clientHeight = el.clientHeight;
  const scrollWidth = el.scrollWidth;
  const clientWidth = el.clientWidth;

  const verticalOverflow = scrollHeight > clientHeight + 2; // 2px tolerance
  const horizontalOverflow = scrollWidth > clientWidth + 2;

  if ((verticalOverflow || horizontalOverflow) && hasOverflowHidden) {
    return {
      type: 'overflow',
      severity: 'warning',
      element: identifier,
      elementSelector: getElementSelector(el),
      details: {
        vertical: verticalOverflow ? {
          content: scrollHeight,
          container: clientHeight,
          hidden: scrollHeight - clientHeight,
        } : null,
        horizontal: horizontalOverflow ? {
          content: scrollWidth,
          container: clientWidth,
          hidden: scrollWidth - clientWidth,
        } : null,
      },
      message: `Content in ${identifier} is being clipped. ${verticalOverflow ? `${scrollHeight - clientHeight}px hidden vertically.` : ''} ${horizontalOverflow ? `${scrollWidth - clientWidth}px hidden horizontally.` : ''}`.trim(),
    };
  }

  return null;
}

/**
 * Checks if text is being truncated (ellipsis or clipped)
 */
function checkTextOverflow(el, index) {
  const style = window.getComputedStyle(el);
  const hasEllipsis = style.textOverflow === 'ellipsis';
  const hasHiddenOverflow = style.overflow === 'hidden';

  // Check if text is actually being truncated
  if (hasEllipsis && hasHiddenOverflow && el.scrollWidth > el.clientWidth) {
    const classes = el.className || el.tagName.toLowerCase();
    return {
      type: 'text-truncation',
      severity: 'info',
      element: `${classes}-${index + 1}`,
      elementSelector: getElementSelector(el),
      details: {
        fullWidth: el.scrollWidth,
        visibleWidth: el.clientWidth,
        truncated: el.scrollWidth - el.clientWidth,
      },
      message: `Text in ${classes} is being truncated with ellipsis.`,
    };
  }

  return null;
}

/**
 * Detects overlapping elements
 */
function detectOverlap(slideEl) {
  const issues = [];

  // Get all positioned content elements (not structural containers)
  const contentSelectors = [
    '.title',
    '.subtitle',
    '.card',
    '.kpi-block',
    '.timeline-marker',
    '.timeline-content',
    '.grid-cell',
    '.quote-box',
    '.cover-title',
    '.cover-category',
    '.cover-branding',
    '.cover-date',
  ];

  const elements = [];
  contentSelectors.forEach(selector => {
    slideEl.querySelectorAll(selector).forEach(el => {
      const rect = el.getBoundingClientRect();
      const slideRect = slideEl.getBoundingClientRect();

      // Convert to slide-relative coordinates
      elements.push({
        el,
        selector,
        rect: {
          left: rect.left - slideRect.left,
          top: rect.top - slideRect.top,
          right: rect.right - slideRect.left,
          bottom: rect.bottom - slideRect.top,
          width: rect.width,
          height: rect.height,
        },
        identifier: getElementSelector(el),
      });
    });
  });

  // Check for overlaps between elements
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];

      // Skip if one is a child of the other
      if (a.el.contains(b.el) || b.el.contains(a.el)) {
        continue;
      }

      const overlap = calculateOverlap(a.rect, b.rect);
      if (overlap.area > 100) { // More than 100px^2 overlap
        issues.push({
          type: 'overlap',
          severity: overlap.area > 500 ? 'error' : 'warning',
          elements: [a.identifier, b.identifier],
          details: {
            overlapArea: Math.round(overlap.area),
            overlapPercentA: Math.round((overlap.area / (a.rect.width * a.rect.height)) * 100),
            overlapPercentB: Math.round((overlap.area / (b.rect.width * b.rect.height)) * 100),
            overlapRect: overlap.rect,
          },
          message: `Elements "${a.identifier}" and "${b.identifier}" overlap by ${Math.round(overlap.area)}px².`,
        });
      }
    }
  }

  return issues;
}

/**
 * Calculates the overlap between two rectangles
 */
function calculateOverlap(rectA, rectB) {
  const overlapLeft = Math.max(rectA.left, rectB.left);
  const overlapTop = Math.max(rectA.top, rectB.top);
  const overlapRight = Math.min(rectA.right, rectB.right);
  const overlapBottom = Math.min(rectA.bottom, rectB.bottom);

  const width = Math.max(0, overlapRight - overlapLeft);
  const height = Math.max(0, overlapBottom - overlapTop);
  const area = width * height;

  return {
    area,
    rect: { left: overlapLeft, top: overlapTop, width, height },
  };
}

/**
 * Detects elements extending beyond frame or slide boundaries
 */
function detectBoundaryViolations(slideEl, frameBounds) {
  const issues = [];
  const slideRect = slideEl.getBoundingClientRect();

  // Check frame contents
  const frame = slideEl.querySelector('.frame');
  if (frame) {
    const frameRect = frame.getBoundingClientRect();
    const frameRelative = {
      left: frameRect.left - slideRect.left,
      top: frameRect.top - slideRect.top,
      right: frameRect.right - slideRect.left,
      bottom: frameRect.bottom - slideRect.top,
    };

    // Check children of frame
    Array.from(frame.children).forEach((child, index) => {
      const childRect = child.getBoundingClientRect();
      const childRelative = {
        left: childRect.left - slideRect.left,
        top: childRect.top - slideRect.top,
        right: childRect.right - slideRect.left,
        bottom: childRect.bottom - slideRect.top,
      };

      const violations = [];

      // Check if child extends beyond frame
      if (childRelative.bottom > frameBounds.bottom + 5) {
        violations.push(`extends ${Math.round(childRelative.bottom - frameBounds.bottom)}px below frame`);
      }
      if (childRelative.right > frameBounds.right + 5) {
        violations.push(`extends ${Math.round(childRelative.right - frameBounds.right)}px past right edge`);
      }
      if (childRelative.left < frameBounds.left - 5) {
        violations.push(`extends ${Math.round(frameBounds.left - childRelative.left)}px past left edge`);
      }

      if (violations.length > 0) {
        issues.push({
          type: 'boundary-violation',
          severity: 'error',
          element: getElementSelector(child),
          details: {
            elementBounds: childRelative,
            frameBounds,
            violations,
          },
          message: `Element ${getElementSelector(child)} ${violations.join(' and ')}.`,
        });
      }
    });
  }

  // Check elements that should be outside the frame (title, subtitle)
  const title = slideEl.querySelector('.title, h1.title');
  const subtitle = slideEl.querySelector('.subtitle, h2.subtitle');

  [title, subtitle].forEach((el, index) => {
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const relativeRight = rect.right - slideRect.left;

    if (relativeRight > SLIDE_WIDTH) {
      issues.push({
        type: 'boundary-violation',
        severity: 'warning',
        element: index === 0 ? 'title' : 'subtitle',
        elementSelector: getElementSelector(el),
        details: {
          extends: Math.round(relativeRight - SLIDE_WIDTH),
        },
        message: `${index === 0 ? 'Title' : 'Subtitle'} extends ${Math.round(relativeRight - SLIDE_WIDTH)}px beyond slide edge.`,
      });
    }
  });

  return issues;
}

/**
 * Gets a human-readable selector for an element
 */
function getElementSelector(el) {
  if (!el) return 'unknown';

  let selector = el.tagName.toLowerCase();

  if (el.id) {
    return `#${el.id}`;
  }

  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(' ').filter(c => c && !c.startsWith('editable') && !c.startsWith('draggable'));
    if (classes.length > 0) {
      selector = '.' + classes.join('.');
    }
  }

  // Add index if there are siblings with same selector
  const parent = el.parentElement;
  if (parent) {
    const siblings = parent.querySelectorAll(selector);
    if (siblings.length > 1) {
      const index = Array.from(siblings).indexOf(el);
      selector += `:nth-child(${index + 1})`;
    }
  }

  return selector;
}

/**
 * Generates a human-readable summary of issues
 */
function generateSummary(issues) {
  if (issues.length === 0) {
    return 'No layout issues detected. Slide appears correctly formatted.';
  }

  const counts = {
    overflow: 0,
    overlap: 0,
    'boundary-violation': 0,
    'text-truncation': 0,
  };

  issues.forEach(issue => {
    counts[issue.type] = (counts[issue.type] || 0) + 1;
  });

  const parts = [];
  if (counts.overflow > 0) parts.push(`${counts.overflow} overflow issue(s)`);
  if (counts.overlap > 0) parts.push(`${counts.overlap} overlapping element(s)`);
  if (counts['boundary-violation'] > 0) parts.push(`${counts['boundary-violation']} boundary violation(s)`);
  if (counts['text-truncation'] > 0) parts.push(`${counts['text-truncation']} truncated text element(s)`);

  return `Found ${issues.length} layout issue(s): ${parts.join(', ')}.`;
}

/**
 * Generates suggestions for fixing issues
 */
function generateSuggestions(issues) {
  if (issues.length === 0) return [];

  const suggestions = [];
  const seenTypes = new Set();

  issues.forEach(issue => {
    if (seenTypes.has(issue.type)) return;
    seenTypes.add(issue.type);

    switch (issue.type) {
      case 'overflow':
        suggestions.push({
          type: 'overflow',
          suggestion: 'Reduce content amount or use smaller font sizes. Consider splitting content across multiple slides.',
          autoFix: 'reduce-content',
        });
        break;
      case 'overlap':
        suggestions.push({
          type: 'overlap',
          suggestion: 'Reposition overlapping elements or reduce their sizes. Check absolute positioning values.',
          autoFix: 'reposition-elements',
        });
        break;
      case 'boundary-violation':
        suggestions.push({
          type: 'boundary-violation',
          suggestion: 'Move elements within the frame boundaries. Adjust positioning or reduce content width.',
          autoFix: 'fit-to-frame',
        });
        break;
      case 'text-truncation':
        suggestions.push({
          type: 'text-truncation',
          suggestion: 'Shorten text content or increase container width. Consider using a more concise wording.',
          autoFix: 'shorten-text',
        });
        break;
    }
  });

  return suggestions;
}

/**
 * Formats validation result for AI agent consumption
 */
export function formatValidationForAgent(validationResult) {
  if (validationResult.valid) {
    return 'LAYOUT_CHECK: PASS - No issues detected.';
  }

  const lines = ['LAYOUT_CHECK: ISSUES_FOUND'];
  lines.push(validationResult.summary);
  lines.push('');
  lines.push('DETAILED ISSUES:');

  validationResult.issues.forEach((issue, index) => {
    lines.push(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
    if (issue.elements) {
      lines.push(`   Elements: ${issue.elements.join(', ')}`);
    }
    if (issue.elementSelector) {
      lines.push(`   Selector: ${issue.elementSelector}`);
    }
  });

  if (validationResult.suggestions.length > 0) {
    lines.push('');
    lines.push('SUGGESTED FIXES:');
    validationResult.suggestions.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.suggestion}`);
    });
  }

  return lines.join('\n');
}

/**
 * Quick check function that returns boolean
 */
export function hasLayoutIssues(slideContent, options = {}) {
  const result = validateSlideLayout(slideContent, options);
  return !result.valid;
}

/**
 * Get only error-level issues (ignoring warnings and info)
 */
export function getLayoutErrors(slideContent, options = {}) {
  const result = validateSlideLayout(slideContent, options);
  return result.issues.filter(issue => issue.severity === 'error');
}
