import { debugLog, LogLevel } from '../../utils/debugLog';
import FULL_SLIDE_CSS from '../../styles/slides.css?raw';

// Extract relevant CSS rules for a given HTML string
// Uses FULL_SLIDE_CSS imported from slides.css (2700+ lines, 229 classes)
export function extractRelevantCSS(html) {
  if (!html || !FULL_SLIDE_CSS) {
    debugLog(LogLevel.WARN, 'extractRelevantCSS', 'Missing html or FULL_SLIDE_CSS', {
      hasHtml: !!html,
      hasCss: !!FULL_SLIDE_CSS,
      cssLength: FULL_SLIDE_CSS?.length || 0
    });
    return '';
  }

  // Base classes that are handled separately - don't include in matching
  // These match too broadly since most CSS rules contain ".slide"
  const baseClasses = new Set([
    'slide', 'master-standard', 'master-blank', 'master-cover',
    'master-titleOnly', 'master-emptyPage', 'master-content'
  ]);

  // Find all class names used in the HTML
  const classMatches = html.match(/class="([^"]+)"/g) || [];
  const usedClasses = new Set();

  classMatches.forEach(match => {
    const classes = match.replace('class="', '').replace('"', '').split(/\s+/);
    classes.forEach(cls => {
      const trimmed = cls.trim();
      // Skip base classes - they're handled separately in isRelevantSelector
      if (trimmed && !baseClasses.has(trimmed)) {
        usedClasses.add(trimmed);
      }
    });
  });

  // Also find HTML elements used (for element-level CSS like h1, h2, p, li, etc.)
  const elementMatches = html.match(/<(\w+)[\s>]/g) || [];
  const usedElements = new Set();
  elementMatches.forEach(match => {
    const el = match.replace(/</, '').replace(/[\s>]/, '').toLowerCase();
    if (el && !['div', 'span'].includes(el)) usedElements.add(el);
  });

  debugLog(LogLevel.DEBUG, 'extractRelevantCSS', `Found ${usedClasses.size} classes, ${usedElements.size} elements in HTML`, {
    classes: Array.from(usedClasses).slice(0, 20),
    elements: Array.from(usedElements)
  });

  // Note: Don't return early if usedClasses is empty - we still want base rules like :root and .slide

  // Build regex patterns for the classes
  const relevantRules = [];
  const cssLines = FULL_SLIDE_CSS.split('\n');
  let inRule = false;
  let currentRule = '';
  let braceCount = 0;

  // Helper to check if a selector line matches our used classes/elements
  const isRelevantSelector = (line) => {
    // Always include :root (CSS variables)
    if (line.includes(':root')) return true;

    // Include base .slide rule (exact match for the container)
    if (/^\.slide\s*\{/.test(line.trim())) return true;

    // Include .slide * rules (global rules for slide children)
    if (/^\.slide\s+\*/.test(line.trim())) return true;

    // Check if selector matches any of our used classes
    for (const cls of usedClasses) {
      // Match .classname or .slide .classname or .slide.classname
      if (line.includes(`.${cls}`) &&
          (line.includes(`.${cls} `) || line.includes(`.${cls},`) ||
           line.includes(`.${cls}{`) || line.includes(`.${cls}:`) ||
           line.includes(`.${cls})`))) {
        return true;
      }
      // Also check for exact class at end of selector
      if (line.includes(`.${cls}`) && (
          line.endsWith(`.${cls} {`) || line.endsWith(`.${cls}{`) ||
          line.includes(`.${cls} `) || line.includes(`.${cls},`))) {
        return true;
      }
    }

    // Check for element selectors within .slide context
    for (const el of usedElements) {
      // Match .slide h1, .slide p, etc.
      if (new RegExp(`\\.slide\\s+${el}[\\s,:{]`).test(line)) return true;
      // Match .classname h1, etc. where classname is used
      for (const cls of usedClasses) {
        if (new RegExp(`\\.${cls}\\s+${el}[\\s,:{]`).test(line)) return true;
      }
    }

    return false;
  };

  for (const line of cssLines) {
    if (!inRule) {
      if (isRelevantSelector(line) && line.includes('{')) {
        inRule = true;
        currentRule = line;
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        if (braceCount <= 0) {
          relevantRules.push(currentRule);
          inRule = false;
          currentRule = '';
        }
      }
    } else {
      currentRule += '\n' + line;
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      if (braceCount <= 0) {
        relevantRules.push(currentRule);
        inRule = false;
        currentRule = '';
      }
    }
  }

  // Deduplicate rules (same selector might appear multiple times)
  const uniqueRules = [];
  const seenSelectors = new Set();

  for (const rule of relevantRules) {
    // Extract selector (everything before first {)
    const selectorMatch = rule.match(/^([^{]+)\{/);
    if (selectorMatch) {
      const selector = selectorMatch[1].trim();
      if (!seenSelectors.has(selector)) {
        seenSelectors.add(selector);
        uniqueRules.push(rule);
      }
    } else {
      uniqueRules.push(rule);
    }
  }

  const result = uniqueRules.join('\n\n');
  debugLog(LogLevel.DEBUG, 'extractRelevantCSS', `Extracted ${uniqueRules.length} unique CSS rules (${result.length} chars) from ${relevantRules.length} total`, {
    sampleClasses: Array.from(usedClasses).filter(c => c.includes('swot')),
    hasSWOT: result.includes('swot')
  });

  return result;
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
