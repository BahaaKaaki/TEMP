/**
 * Smart Template Matching Service
 *
 * Matches slides to templates based on structural analysis, not just metadata.
 * Uses HTML structure, CSS classes, and element counts to find the best match.
 */

import { SLIDE_TEMPLATES } from '../utils/slideTemplates';

// =============================================================================
// STRUCTURAL FEATURE EXTRACTION
// =============================================================================

/**
 * Extract structural features from HTML for matching
 */
export function extractStructuralFeatures(html) {
  if (!html) return null;

  // Extract all CSS classes
  const classMatches = html.match(/class="([^"]+)"/g) || [];
  const allClasses = new Set();
  classMatches.forEach(match => {
    const classes = match.replace('class="', '').replace('"', '').split(/\s+/);
    classes.forEach(cls => {
      if (cls.trim()) allClasses.add(cls.trim());
    });
  });

  // Key structural classes that define template types
  const structuralClasses = {
    // Layout types
    'card-row': 'cards',
    'three-cards': 'cards',
    'card': 'cards',
    'two-col': 'two-column',
    'col-left': 'two-column',
    'col-right': 'two-column',
    'grid-2x2': 'grid',
    'grid-cell': 'grid',
    'swot-grid': 'swot',
    'swot-cell': 'swot',
    'timeline-container': 'timeline',
    'timeline-row': 'timeline',
    'process-flow': 'process',
    'process-step': 'process',
    'quote-box': 'quote',
    'content-list': 'bullets',
    'agenda-list': 'executiveSummary',
    'agenda-item': 'executiveSummary',
    'exec-summary-grid': 'executiveSummary',
    'exec-summary-cell': 'executiveSummary',
    'team-grid': 'team',
    'team-member': 'team',
    'grid-3x2': 'grid-3x2',
    'grid-3x2-item': 'grid-3x2',
    'stat-highlight': 'stat',
    'comparison-table': 'table',
    'horizontal-roadmap': 'roadmap',
    'roadmap-item': 'roadmap',
    'cover-slide': 'cover',
    'cover-title': 'cover',
    'thank-you-slide': 'closing',
    'kpi-block': 'kpi',
    'kpi-value': 'kpi',
    // Strategic Insight template
    'strategic-insight-layout': 'insight',
    'insight-hero': 'insight',
    'insight-evidence': 'insight',
    'evidence-pillar': 'insight',
    'insight-impact-strip': 'insight',
  };

  // Identify primary layout type based on classes
  const detectedTypes = new Set();
  allClasses.forEach(cls => {
    if (structuralClasses[cls]) {
      detectedTypes.add(structuralClasses[cls]);
    }
  });

  // Count specific elements
  const counts = {
    cards: (html.match(/class="[^"]*card[^"]*"/g) || []).filter(m => !m.includes('card-row') && !m.includes('card-header')).length,
    kpiBlocks: (html.match(/class="[^"]*kpi-block[^"]*"/g) || []).length,
    gridCells: (html.match(/class="[^"]*grid-cell[^"]*"/g) || []).length,
    swotCells: (html.match(/class="[^"]*swot-cell[^"]*"/g) || []).length,
    timelineRows: (html.match(/class="[^"]*timeline-row[^"]*"/g) || []).length,
    processSteps: (html.match(/class="[^"]*process-step[^"]*"/g) || []).length,
    bulletItems: (html.match(/<li[^>]*>/g) || []).length,
    agendaItems: (html.match(/class="[^"]*agenda-item[^"]*"/g) || []).length,
    teamMembers: (html.match(/class="[^"]*team-member[^"]*"/g) || []).length,
    iconItems: (html.match(/class="[^"]*icon-item[^"]*"/g) || []).length,
    roadmapItems: (html.match(/class="[^"]*roadmap-item[^"]*"/g) || []).length,
    detailItems: (html.match(/class="[^"]*detail-item[^"]*"/g) || []).length,
    tableRows: (html.match(/<tr[^>]*>/g) || []).length,
  };

  // Detect master type
  let masterType = 'standard';
  if (allClasses.has('master-cover') || allClasses.has('cover-slide')) masterType = 'cover';
  else if (allClasses.has('master-blank')) masterType = 'blank';
  else if (allClasses.has('master-titleOnly')) masterType = 'titleOnly';

  return {
    classes: Array.from(allClasses),
    layoutTypes: Array.from(detectedTypes),
    counts,
    masterType,
    hasTitle: html.includes('class="title"') || html.includes('<h1'),
    hasSubtitle: html.includes('class="subtitle"') || html.includes('<h2'),
  };
}

// =============================================================================
// TEMPLATE SIGNATURES
// =============================================================================

/**
 * Pre-computed signatures for built-in templates
 * These define the structural "fingerprint" of each template
 */
const TEMPLATE_SIGNATURES = {
  cover: {
    primaryTypes: ['cover'],
    requiredClasses: ['cover-slide', 'cover-title'],
    optionalClasses: ['cover-category', 'cover-branding', 'cover-date'],
    counts: {},
    masterType: 'cover',
  },
  threeCards: {
    primaryTypes: ['cards'],
    requiredClasses: ['card-row'],
    optionalClasses: ['card', 'card-header-row', 'card-icon-circle', 'card-num', 'impact-box'],
    counts: { cards: 3 },
    masterType: 'standard',
  },
  kpiMetrics: {
    primaryTypes: ['two-column', 'kpi'],
    requiredClasses: ['two-col', 'kpi-block'],
    optionalClasses: ['kpi-value', 'kpi-label', 'detail-item'],
    counts: { kpiBlocks: 3, detailItems: 3 },
    masterType: 'standard',
  },
  timeline: {
    primaryTypes: ['timeline'],
    requiredClasses: ['timeline-container', 'timeline-row'],
    optionalClasses: ['timeline-marker', 'timeline-content'],
    counts: { timelineRows: [2, 5] }, // Range
    masterType: 'standard',
  },
  quote: {
    primaryTypes: ['quote'],
    requiredClasses: ['quote-box'],
    optionalClasses: ['quote-text', 'quote-author'],
    counts: {},
    masterType: 'standard',
  },
  bulletPoints: {
    primaryTypes: ['bullets'],
    requiredClasses: ['content-list'],
    optionalClasses: [],
    counts: { bulletItems: [3, 10] },
    masterType: 'standard',
  },
  grid2x2: {
    primaryTypes: ['grid'],
    requiredClasses: ['grid-2x2'],
    optionalClasses: ['grid-cell'],
    counts: { gridCells: 4 },
    masterType: 'standard',
  },
  swotAnalysis: {
    primaryTypes: ['swot'],
    requiredClasses: ['swot-grid'],
    optionalClasses: ['swot-cell', 'swot-strength', 'swot-weakness', 'swot-opportunity', 'swot-threat'],
    counts: { swotCells: 4 },
    masterType: 'standard',
  },
  comparisonTable: {
    primaryTypes: ['table'],
    requiredClasses: ['comparison-table'],
    optionalClasses: ['score-high', 'score-med', 'score-low'],
    counts: { tableRows: [3, 10] },
    masterType: 'standard',
  },
  processFlow: {
    primaryTypes: ['process'],
    requiredClasses: ['process-flow'],
    optionalClasses: ['process-step', 'step-number', 'step-content', 'process-arrow'],
    counts: { processSteps: [3, 6] },
    masterType: 'standard',
  },
  statHighlight: {
    primaryTypes: ['stat'],
    requiredClasses: ['stat-highlight'],
    optionalClasses: ['stat-main', 'stat-number', 'stat-label', 'stat-context'],
    counts: {},
    masterType: 'titleOnly',
  },
  grid3x2: {
    primaryTypes: ['grid-3x2'],
    requiredClasses: ['grid-3x2'],
    optionalClasses: ['grid-3x2-item'],
    counts: { gridItems: 6 },
    masterType: 'standard',
  },
  teamShowcase: {
    primaryTypes: ['team'],
    requiredClasses: ['team-grid'],
    optionalClasses: ['team-member', 'member-avatar', 'member-role'],
    counts: { teamMembers: 4 },
    masterType: 'standard',
  },
  executiveSummary: {
    primaryTypes: ['executiveSummary'],
    requiredClasses: ['agenda-list'],
    optionalClasses: ['agenda-item', 'agenda-num'],
    counts: { agendaItems: [3, 6] },
    masterType: 'standard',
  },
  roadmapTimeline: {
    primaryTypes: ['roadmap'],
    requiredClasses: ['horizontal-roadmap'],
    optionalClasses: ['roadmap-item', 'roadmap-card', 'roadmap-dot'],
    counts: { roadmapItems: [3, 5] },
    masterType: 'standard',
  },
  thankYou: {
    primaryTypes: ['cover', 'closing'],
    requiredClasses: ['thank-you-slide'],
    optionalClasses: ['thank-you-title', 'contact-info'],
    counts: {},
    masterType: 'cover',
  },
};

// =============================================================================
// MATCHING ALGORITHM
// =============================================================================

/**
 * Calculate similarity score between slide features and template signature
 * Returns 0-100 score
 */
function calculateSimilarity(features, signature) {
  if (!features || !signature) return 0;

  let score = 0;
  let maxScore = 0;

  // 1. Primary type match (40 points)
  maxScore += 40;
  const typeOverlap = features.layoutTypes.filter(t => signature.primaryTypes.includes(t));
  if (typeOverlap.length > 0) {
    score += 40 * (typeOverlap.length / signature.primaryTypes.length);
  }

  // 2. Required classes match (30 points)
  maxScore += 30;
  const requiredMatches = signature.requiredClasses.filter(cls => features.classes.includes(cls));
  if (signature.requiredClasses.length > 0) {
    score += 30 * (requiredMatches.length / signature.requiredClasses.length);
  } else {
    score += 30; // No required classes = full points
  }

  // 3. Optional classes match (15 points)
  maxScore += 15;
  if (signature.optionalClasses.length > 0) {
    const optionalMatches = signature.optionalClasses.filter(cls => features.classes.includes(cls));
    score += 15 * (optionalMatches.length / signature.optionalClasses.length);
  } else {
    score += 15;
  }

  // 4. Element count match (10 points)
  maxScore += 10;
  let countScore = 10;
  for (const [key, expected] of Object.entries(signature.counts)) {
    const actual = features.counts[key] || 0;
    if (Array.isArray(expected)) {
      // Range check
      if (actual >= expected[0] && actual <= expected[1]) {
        // Good match
      } else {
        countScore -= 5;
      }
    } else {
      // Exact or close match
      if (actual === expected) {
        // Perfect
      } else if (Math.abs(actual - expected) <= 1) {
        countScore -= 2;
      } else {
        countScore -= 5;
      }
    }
  }
  score += Math.max(0, countScore);

  // 5. Master type match (5 points)
  maxScore += 5;
  if (features.masterType === signature.masterType) {
    score += 5;
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * Find the best matching template for a slide
 *
 * @param {string} html - Slide HTML content
 * @param {Array} customTemplates - User's custom templates (optional)
 * @returns {Object} { templateId, templateTitle, confidence, source, pptxRendererCode }
 */
export function findBestTemplateMatch(html, customTemplates = []) {
  if (!html) {
    return { templateId: null, confidence: 0, source: 'none' };
  }

  const features = extractStructuralFeatures(html);
  let bestMatch = { templateId: null, templateTitle: null, confidence: 0, source: 'generic', pptxRendererCode: null };

  // 1. Check custom templates first
  for (const template of customTemplates) {
    if (template.html && template.pptxRendererCode) {
      const templateFeatures = extractStructuralFeatures(template.html);
      if (templateFeatures) {
        // Direct feature comparison for custom templates
        const similarity = calculateCustomTemplateSimilarity(features, templateFeatures);
        if (similarity > bestMatch.confidence) {
          bestMatch = {
            templateId: template.id,
            templateTitle: template.title,
            confidence: similarity,
            source: 'custom',
            pptxRendererCode: template.pptxRendererCode,
          };
        }
      }
    }
  }

  // 2. Check built-in templates
  for (const [templateId, signature] of Object.entries(TEMPLATE_SIGNATURES)) {
    const similarity = calculateSimilarity(features, signature);
    if (similarity > bestMatch.confidence) {
      const builtInTemplate = SLIDE_TEMPLATES[templateId];
      bestMatch = {
        templateId,
        templateTitle: builtInTemplate?.title || templateId,
        confidence: similarity,
        source: 'builtin',
        pptxRendererCode: builtInTemplate?.pptxRendererCode || null,
      };
    }
  }

  return bestMatch;
}

/**
 * Calculate similarity between two sets of extracted features (for custom templates)
 */
function calculateCustomTemplateSimilarity(slideFeatures, templateFeatures) {
  if (!slideFeatures || !templateFeatures) return 0;

  let score = 0;

  // 1. Layout type overlap (40 points)
  const typeOverlap = slideFeatures.layoutTypes.filter(t => templateFeatures.layoutTypes.includes(t));
  if (templateFeatures.layoutTypes.length > 0) {
    score += 40 * (typeOverlap.length / templateFeatures.layoutTypes.length);
  }

  // 2. Key class overlap (40 points)
  // Focus on structural classes, not utility classes
  const structuralClasses = [
    'card-row', 'card', 'two-col', 'grid-2x2', 'grid-cell', 'swot-grid', 'swot-cell',
    'timeline-container', 'timeline-row', 'process-flow', 'process-step', 'quote-box',
    'content-list', 'agenda-list', 'team-grid', 'grid-3x2', 'stat-highlight',
    'comparison-table', 'horizontal-roadmap', 'kpi-block', 'cover-slide', 'thank-you-slide'
  ];

  const slideStructural = slideFeatures.classes.filter(c => structuralClasses.includes(c));
  const templateStructural = templateFeatures.classes.filter(c => structuralClasses.includes(c));

  if (templateStructural.length > 0) {
    const overlap = slideStructural.filter(c => templateStructural.includes(c));
    score += 40 * (overlap.length / templateStructural.length);
  }

  // 3. Count similarity (20 points)
  let countScore = 20;
  for (const [key, templateCount] of Object.entries(templateFeatures.counts)) {
    const slideCount = slideFeatures.counts[key] || 0;
    if (templateCount > 0) {
      const diff = Math.abs(slideCount - templateCount);
      if (diff === 0) {
        // Perfect
      } else if (diff === 1) {
        countScore -= 3;
      } else {
        countScore -= 7;
      }
    }
  }
  score += Math.max(0, countScore);

  return Math.round(score);
}

// =============================================================================
// SMART TEMPLATE DECISION
// =============================================================================

/**
 * Decide whether to use template JS or generic JS for PPTX export
 *
 * @param {Object} slide - Slide object with html, templateId, etc.
 * @param {Array} customTemplates - User's custom templates
 * @returns {Object} { useTemplate: boolean, templateId, templateTitle, confidence, pptxRendererCode, reason }
 */
export function decideTemplateUsage(slide, customTemplates = []) {
  if (!slide?.html) {
    return {
      useTemplate: false,
      confidence: 0,
      reason: 'No HTML content',
    };
  }

  // Step 1: Check if slide has explicit templateId that still matches
  if (slide.templateId) {
    // Check custom templates
    const customMatch = customTemplates.find(t => t.id === slide.templateId);
    if (customMatch?.pptxRendererCode) {
      // Verify the structure still matches
      const match = findBestTemplateMatch(slide.html, customTemplates);
      if (match.templateId === slide.templateId && match.confidence >= 50) {
        return {
          useTemplate: true,
          templateId: match.templateId,
          templateTitle: match.templateTitle,
          confidence: match.confidence,
          pptxRendererCode: customMatch.pptxRendererCode,
          source: 'custom',
          reason: `Matches original template "${customMatch.title}" (${match.confidence}% confidence)`,
        };
      }
    }

    // Check built-in templates
    const builtInMatch = SLIDE_TEMPLATES[slide.templateId];
    if (builtInMatch?.pptxRendererCode) {
      const match = findBestTemplateMatch(slide.html, customTemplates);
      if (match.templateId === slide.templateId && match.confidence >= 50) {
        return {
          useTemplate: true,
          templateId: match.templateId,
          templateTitle: match.templateTitle,
          confidence: match.confidence,
          pptxRendererCode: builtInMatch.pptxRendererCode,
          source: 'builtin',
          reason: `Matches original template "${builtInMatch.title}" (${match.confidence}% confidence)`,
        };
      }
    }
  }

  // Step 2: Find best structural match (regardless of templateId)
  const bestMatch = findBestTemplateMatch(slide.html, customTemplates);

  // High confidence (70%+): Use template
  if (bestMatch.confidence >= 70 && bestMatch.pptxRendererCode) {
    return {
      useTemplate: true,
      templateId: bestMatch.templateId,
      templateTitle: bestMatch.templateTitle,
      confidence: bestMatch.confidence,
      pptxRendererCode: bestMatch.pptxRendererCode,
      source: bestMatch.source,
      reason: `Structure matches "${bestMatch.templateTitle}" template (${bestMatch.confidence}% confidence)`,
    };
  }

  // Medium confidence (50-70%): Use template but note it's not a strong match
  if (bestMatch.confidence >= 50 && bestMatch.pptxRendererCode) {
    return {
      useTemplate: true,
      templateId: bestMatch.templateId,
      templateTitle: bestMatch.templateTitle,
      confidence: bestMatch.confidence,
      pptxRendererCode: bestMatch.pptxRendererCode,
      source: bestMatch.source,
      reason: `Partial match to "${bestMatch.templateTitle}" template (${bestMatch.confidence}% confidence)`,
    };
  }

  // Low confidence: Use generic/freestyle
  return {
    useTemplate: false,
    templateId: null,
    templateTitle: null,
    confidence: bestMatch.confidence,
    pptxRendererCode: null,
    source: 'generic',
    reason: bestMatch.confidence > 0
      ? `No strong template match (best: "${bestMatch.templateTitle}" at ${bestMatch.confidence}%)`
      : 'Freestyle slide - using generic PPTX patterns',
  };
}

/**
 * Parse user intent to determine if they want template or freestyle
 *
 * @param {string} userPrompt - User's request text
 * @returns {Object} { wantsTemplate: boolean, templateHint: string|null, wantsFreestyle: boolean }
 */
export function parseUserIntent(userPrompt) {
  if (!userPrompt) return { wantsTemplate: null, templateHint: null, wantsFreestyle: false };

  const prompt = userPrompt.toLowerCase();

  // Freestyle indicators
  const freestyleKeywords = ['freestyle', 'free style', 'custom', 'from scratch', 'blank', 'freeform', 'free-form'];
  const wantsFreestyle = freestyleKeywords.some(kw => prompt.includes(kw));

  // Template type indicators
  const templateHints = {
    'swot': ['swot', 'strengths weaknesses', 'strength weakness'],
    'cover': ['cover', 'title slide', 'opening slide', 'intro slide'],
    'threeCards': ['three cards', '3 cards', 'three pillars', '3 pillars', 'three columns', '3 columns'],
    'kpiMetrics': ['kpi', 'metrics', 'performance', 'dashboard', 'numbers'],
    'timeline': ['timeline', 'roadmap', 'phases', 'milestones'],
    'quote': ['quote', 'testimonial', 'statement'],
    'bulletPoints': ['bullet', 'list', 'points', 'recommendations'],
    'grid2x2': ['2x2', 'quadrant', 'four box', '4 box', 'matrix'],
    'comparisonTable': ['comparison', 'table', 'versus', 'vs.', 'compare'],
    'processFlow': ['process', 'flow', 'steps', 'workflow', 'methodology'],
    'executiveSummary': ['executive summary', 'summary', 'outline', 'roadmap', 'structure'],
    'team': ['team', 'people', 'members', 'leadership'],
    'thankYou': ['thank you', 'thanks', 'closing', 'end slide', 'questions'],
  };

  let templateHint = null;
  for (const [templateId, keywords] of Object.entries(templateHints)) {
    if (keywords.some(kw => prompt.includes(kw))) {
      templateHint = templateId;
      break;
    }
  }

  return {
    wantsTemplate: templateHint !== null,
    templateHint,
    wantsFreestyle,
  };
}

// =============================================================================
// EXPORTS FOR DEBUGGING
// =============================================================================

export { TEMPLATE_SIGNATURES };
