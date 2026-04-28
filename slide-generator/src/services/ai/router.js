import { SLIDE_TEMPLATES, getTemplateFlex, getTemplateGuidance } from '../../utils/slideTemplates';
import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import { selectBestTemplate, randomizeFamilyVariant, estimateItemCount } from '../templateEmbeddings';
import { parseModelRef, findProvider, getCredentials } from './models.js';
import { callWithModelFallback, callRouterWithImages, attachSkillIdToBody } from './apiClient.js';
import { applyPromptOverride, recordPromptPayload } from './promptOverrides.js';
import { CONTEXT_LEVELS, normalizeContextLevel } from './slideContext.js';
import { authFetch } from '../authFetch.js';

// ============================================
// RULE-BASED ROUTER (No API call needed)
// ============================================

// Template keyword mappings - maps keywords to template IDs
export const TEMPLATE_KEYWORDS = {
  // Data & Metrics
  'dashboard': ['dashboard', 'metrics dashboard', 'kpi dashboard', 'overview dashboard'],
  'metricDashboard': ['metric', 'metrics', 'kpi', 'kpis', 'performance'],
  'bigNumber': ['big number', 'stat', 'statistic', 'headline number', 'key figure'],
  'statHighlight': ['highlight stat', 'featured stat', 'key stat'],
  'kpiMetrics': ['kpi', 'key performance'],

  // Cards layouts
  'threeCards': ['three cards', '3 cards', 'triple cards', 'three features', '3 features'],
  'twoCards': ['two cards', '2 cards', 'dual cards', 'two features', '2 features', 'two options'],
  'fourCards': ['four cards', '4 cards', 'quad cards', 'four features', '4 features'],

  // Comparison & Analysis
  'comparisonTable': ['comparison', 'compare', 'versus', 'vs', 'side by side'],
  'prosAndCons': ['dual list', 'two column list', 'split columns list', 'balanced columns'],
  'swotAnalysis': ['four quadrant', 'color coded grid', '2x2 color grid', 'quad grid'],
  'riskMatrix': ['3x3 matrix', '3x3 grid', 'nine cell grid', 'axis matrix'],
  'beforeAfter': ['contrast columns', 'split contrast', 'left right contrast'],

  // Process & Timeline
  'timeline': ['timeline', 'history', 'evolution', 'chronology'],
  'roadmapTimeline': ['roadmap', 'milestones', 'journey'],
  'processFlow': ['process', 'flow', 'workflow', 'steps', 'procedure', 'how to'],
  'chevronFlow': ['chevron', 'chevrons', 'chevron flow', 'project phases', 'phase diagram', 'phases approach', 'implementation phases', 'transformation phases', 'phases with activities'],
  'outcomeApproach': ['outcome approach', 'outcomes approach', 'workstreams', 'deliverables approach'],
  'projectStepDetail': ['step detail', 'phase detail', 'activities and deliverables', 'key activities'],
  'workplan': ['workplan', 'work plan', 'gantt', 'project schedule', 'timeline weeks', 'project timeline'],
  'funnel': ['funnel', 'conversion', 'sales funnel', 'pipeline'],
  'strategyQuadrant': ['center quadrant', 'quadrant center focus', '2x2 center circle', 'quad grid center'],

  // MBB Consulting templates
  'issueTree': ['issue tree', 'mece', 'problem decomposition', 'hypothesis tree'],
  'priorityMatrix': ['priority matrix', '2x2 matrix', 'effort impact', 'prioritization'],
  'nineBoxMatrix': ['nine box', '9 box', 'ge mckinsey', 'portfolio matrix'],
  'scorecard': ['scorecard', 'rag status', 'harvey ball', 'status tracker'],
  'insightToAction': ['insight to action', 'insights actions', 'so what now what', 'findings recommendations'],
  'recommendationSummary': ['numbered cards', 'numbered card grid', 'card grid with badges'],
  'currentFutureState': ['state columns', 'dual state split', 'two state columns'],
  'barChartExhibit': ['bar chart', 'column chart', 'bar graph'],
  'waterfallChart': ['waterfall', 'bridge chart', 'variance bridge'],

  // Content layouts
  'bulletPoints': ['bullets', 'bullet points', 'key points', 'list', 'points'],
  'grid2x2': ['grid', '2x2', 'quadrant', 'four sections', 'matrix'],
  'keyFinding': ['key finding', 'finding', 'insight', 'conclusion', 'recommendation', 'thesis', 'evidence'],
  'grid3x2': ['grid', '3x2 grid', 'six items', 'features grid', 'capabilities grid'],

  // Opening & Closing
  'cover': ['cover', 'title slide', 'opening', 'intro slide'],
  'executiveSummary': ['executive overview', 'content overview', 'overview', 'outline', 'structure preview', 'roadmap', 'executive summary', 'exec summary', 'tldr', 'summary'],
  'thankYou': ['thank you', 'thanks', 'closing', 'end slide', 'questions'],
  'nextSteps': ['next steps', 'action items', 'follow up', 'to do'],

  // Special
  'quote': ['quote', 'testimonial', 'customer quote', 'saying'],
  'teamShowcase': ['team', 'people', 'leadership', 'our team', 'meet the team'],
  'caseStudy': ['sidebar grid', 'sidebar with grid', 'left panel right grid', 'overview with detail grid'],
  'problemSolution': ['numbered split panels', 'dual numbered panels', 'two panels with metrics'],
  'valueProposition': ['hero pillars', 'hero statement pillars', 'bold statement with supports', 'main claim with pillars'],
  'qualSlide': ['qual', 'qualification', 'case study', 'credential', 'situation impact', 'how we helped', 'engagement summary', 'client story'],
  'checklist': ['checklist', 'todo', 'requirements', 'criteria'],
  'sectionDivider': ['section', 'divider', 'chapter', 'part'],

  // Organizational Structure
  'orgExecutive': ['executive org', 'leadership team', 'c-suite', 'executive structure', 'leadership chart', 'executive chart'],
  'orgCorporate': ['org chart', 'organization chart', 'corporate structure', 'company structure', 'reporting structure', 'hierarchy chart', 'organizational chart'],
  'orgDepartment': ['department structure', 'team structure', 'department org', 'team breakdown', 'department chart', 'team org'],
  'orgMatrix': ['matrix org', 'matrix structure', 'dual reporting', 'cross-functional org', 'matrix organization'],
  'orgFlat': ['flat org', 'flat structure', 'agile team', 'squad structure', 'horizontal structure', 'flat team'],
  'orgHierarchyLarge': ['full org', 'complete org', 'large org chart', 'detailed org', 'full hierarchy', 'company org', 'full org chart'],
  'orgFunctional': ['functional org', 'function breakdown', 'roles and responsibilities', 'department roles', 'team roles', 'functional breakdown'],

  // Governance & Operating Model
  'raciMatrix': ['raci', 'raci matrix', 'responsibility matrix', 'accountable responsible', 'rasci', 'responsibility assignment'],
  'governanceStructure': ['governance', 'governance structure', 'governance model', 'oversight', 'governance framework', 'committee structure'],
  'decisionRights': ['decision rights', 'decision matrix', 'decision authority', 'approval matrix', 'escalation matrix', 'authorization matrix'],
  'operatingModel': ['operating model', 'business model', 'operating framework', 'target operating model', 'tom', 'business operating model'],
  'operatingModelDetailed': ['detailed operating model', 'operating model breakdown', 'operating model components', 'full operating model'],
  'processMap': ['process map', 'swim lane', 'swimlane', 'cross-functional process', 'process diagram', 'workflow diagram'],
  'sipocDiagram': ['sipoc', 'supplier input process output', 'process overview', 'sipoc diagram', 'process boundary'],
  'serviceCatalog': ['service catalog', 'services offered', 'service portfolio', 'service menu', 'service list', 'shared services'],
  'capabilityMap': ['capability map', 'capability model', 'business capabilities', 'capability matrix', 'capability framework', 'capability architecture'],

  // Freestyle / Custom layouts - explicit trigger for component-based layouts
  'freestyle': ['freestyle', 'free style', 'custom layout', 'flexible layout', 'creative layout', 'custom design', 'unique layout', 'bespoke', 'custom slide'],

  // Image slides - AI-generated visual slides
  'image-full': ['image slide', 'visual slide', 'illustration slide', 'infographic', 'generate image', 'ai image', 'picture slide', 'diagram image', 'visual diagram', 'full image slide'],
  'image-content': ['image with text', 'illustrated slide', 'visual with title', 'image and text', 'image content slide'],
};

// Intent patterns for action classification
export const INTENT_PATTERNS = {
  // SLIDE-LEVEL actions (explicitly mention "slide" or "page")
  createSlide: /\b(create|make|generate|build|new)\b.*\b(slide|page)\b/i,
  addSlide: /\b(add)\b.*\b(slide|page)\b/i,
  createMultiple: /\b(create|add|make|generate)\b.*\b(\d+)\s*(slides?|pages?)\b/i,
  deleteSlide: /\b(delete|remove|drop)\b.*\b(the\s*)?(slide|page)\b/i,
  reorderSlide: /\b(move|reorder|rearrange|swap)\b.*\b(slide|page)\b/i,
  switchTemplate: /\b(switch|change|convert|use)\b.*\b(template|layout)\b/i,
  editAllSlides: /\b(all|every|each)\s*(slides?|pages?)\b/i,

  // ELEMENT-LEVEL actions (modify content within a slide - these are EDIT actions)
  addElement: /\b(add|insert|include|put)\b.*\b(a |an |the |some )?(title|subtitle|heading|text|paragraph|bullet|point|image|icon|chart|graph|table|list|section|card|box|column|row|number|statistic|kpi|quote|logo|footer|header|diagram|callout|highlight|emphasis)\b/i,
  removeElement: /\b(remove|delete|drop|hide|get rid of)\b.*\b(the |this |that )?(title|subtitle|heading|text|paragraph|bullet|point|image|icon|chart|graph|table|list|section|card|box|column|row|number|statistic|kpi|quote|logo|footer|header|diagram|callout|element|item)\b/i,
  changeElement: /\b(change|update|modify|edit|fix|improve|revise|tweak|adjust|replace|reword|rephrase)\b.*\b(the |this |that )?(title|subtitle|heading|text|paragraph|bullet|point|content|wording|copy|message|description|label|caption|value|number)\b/i,
  moveElement: /\b(move|reposition|shift|relocate)\b.*\b(the |this |that )?(title|subtitle|heading|text|paragraph|bullet|section|card|box|element|item)\b/i,
  resizeElement: /\b(resize|enlarge|shrink|make.*(bigger|smaller|larger))\b/i,
  styleElement: /\b(style|color|bold|italic|underline|highlight|emphasize|font|background|border)\b/i,

  // GENERAL edit intent (fallback - if mentions "this slide" or general edit words)
  editThis: /\b(this|current|the)\s*(slide|page)\b/i,
  editGeneral: /\b(edit|change|update|modify|fix|improve|revise|tweak|adjust)\b/i,

  // OTHER actions
  storyline: /\b(storyline|narrative|story\s*points?|structure)\b/i,
  populate: /\b(populate|fill|generate\s*content|flesh\s*out)\b/i,
  greeting: /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening|day)|howdy|sup|yo|hiya|thanks|thank\s*you|cheers|bye|goodbye)\b[!?.\s]*$/i,
  question: /^(what|how|why|when|where|who|can|could|would|should|is|are|do|does)\b/i,
  likeSlide: /\b(like|similar\s*to|same\s*as|copy|based\s*on)\s*(slide|page)?\s*#?(\d+)/i,
};

// Repair common JSON issues from AI responses
// Handles: trailing commas, missing commas between objects, truncated arrays/objects
export function repairJSON(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') return jsonStr;

  let repaired = jsonStr.trim();

  // Remove trailing commas before closing brackets/braces
  // e.g., [1, 2, 3,] -> [1, 2, 3]
  repaired = repaired.replace(/,(\s*[\]}])/g, '$1');

  // Fix missing commas between array elements (object followed by object)
  // e.g., [{...}{...}] -> [{...},{...}]
  repaired = repaired.replace(/\}(\s*)\{/g, '},$1{');

  // Fix missing commas between array elements (value followed by object)
  // e.g., [true{...}] -> [true,{...}]
  repaired = repaired.replace(/(true|false|null|\d+|"[^"]*")(\s*)\{/g, '$1,$2{');

  // Fix missing commas between array elements (object followed by value)
  // e.g., [{...}true] -> [{...},true]
  repaired = repaired.replace(/\}(\s*)(true|false|null|\d+|")/g, '},$1$2');

  // Try to close truncated JSON by counting brackets
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  // If truncated, try to close properly
  if (openBraces > closeBraces || openBrackets > closeBrackets) {
    // Remove any trailing incomplete key-value pairs
    repaired = repaired.replace(/,\s*"[^"]*":\s*$/, '');
    repaired = repaired.replace(/,\s*"[^"]*"\s*$/, '');
    repaired = repaired.replace(/,\s*$/, '');

    // Close missing brackets/braces
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repaired += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repaired += '}';
    }
  }

  return repaired;
}

// Safe JSON parse with repair fallback
export function safeJSONParse(jsonStr, context = 'unknown') {
  // First try parsing as-is
  try {
    return JSON.parse(jsonStr);
  } catch (firstError) {
    // Try with repairs
    const repaired = repairJSON(jsonStr);
    try {
      const result = JSON.parse(repaired);
      console.log(`[${context}] JSON repaired successfully`);
      return result;
    } catch (secondError) {
      // Re-throw with original error message for better debugging
      console.error(`[${context}] JSON repair failed. Original:`, jsonStr);
      throw firstError;
    }
  }
}

// Check if prompt is about element-level changes (not slide-level)
export function isElementLevelAction(prompt) {
  return INTENT_PATTERNS.addElement.test(prompt) ||
         INTENT_PATTERNS.removeElement.test(prompt) ||
         INTENT_PATTERNS.changeElement.test(prompt) ||
         INTENT_PATTERNS.moveElement.test(prompt) ||
         INTENT_PATTERNS.resizeElement.test(prompt) ||
         INTENT_PATTERNS.styleElement.test(prompt);
}

// Check if user provides detailed layout descriptions (should use freestyle)
// This detects when users are being very specific about custom arrangements
export function isDetailedLayoutDescription(prompt) {
  const lower = prompt.toLowerCase();

  // Position terms
  const positionTerms = ['left', 'right', 'top', 'bottom', 'center', 'middle', 'corner',
                         'side', 'above', 'below', 'next to', 'beside', 'alongside',
                         'horizontal', 'vertical', 'aligned', 'positioned'];

  // Size/dimension terms
  const sizeTerms = ['wide', 'narrow', 'tall', 'short', 'large', 'small', 'full-width',
                     'half', 'third', 'quarter', 'split', 'equal', 'px', 'percent', '%'];

  // Structural/arrangement terms
  const structureTerms = ['layout', 'arrange', 'structure', 'grid', 'columns', 'rows',
                          'section', 'area', 'zone', 'space', 'container', 'wrapper',
                          'header', 'footer', 'sidebar'];

  // Count matching terms
  let posCount = positionTerms.filter(t => lower.includes(t)).length;
  let sizeCount = sizeTerms.filter(t => lower.includes(t)).length;
  let structCount = structureTerms.filter(t => lower.includes(t)).length;

  // Detailed layout if:
  // - 3+ position terms (describing specific placements)
  // - 2+ position + 2+ structure terms (complex arrangement)
  // - Multiple "with X on the left, Y on the right" patterns
  const hasComplexPattern = /\b(on the (left|right|top|bottom)|at the (top|bottom|center))\b.*\b(on the|at the|in the)\b/i.test(prompt);
  const hasMultiColumnSpec = /\b(left column|right column|first column|second column|left side|right side)\b/i.test(prompt);
  const hasExplicitLayout = /\b(layout|custom layout|specific layout|exact layout)\b/i.test(lower);

  return (posCount >= 3) ||
         (posCount >= 2 && structCount >= 2) ||
         hasComplexPattern ||
         hasMultiColumnSpec ||
         hasExplicitLayout;
}

// Parse slide references from prompt
export function parseSlideReferences(prompt, slideCount) {
  const refs = [];

  // "slide 3", "slide #3", "page 5"
  const numPattern = /\b(?:slide|page)\s*#?\s*(\d+)/gi;
  let match;
  while ((match = numPattern.exec(prompt)) !== null) {
    const idx = parseInt(match[1]) - 1;
    if (idx >= 0 && idx < slideCount) refs.push(idx);
  }

  // "first slide", "last slide"
  if (/\bfirst\s*(?:slide|page)\b/i.test(prompt)) refs.push(0);
  if (/\blast\s*(?:slide|page)\b/i.test(prompt) && slideCount > 0) refs.push(slideCount - 1);

  return [...new Set(refs)]; // dedupe
}

function normalizeSlideIndexArray(value, slideCount) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(v => Number(v))
    .filter(v => Number.isInteger(v) && v >= 0 && (slideCount <= 0 || v < slideCount)))];
}

function inferContextLevel(userPrompt, { scope = 'plan', needsStoryline = false, referenceSlides = [], targetSlides = [] } = {}) {
  const prompt = String(userPrompt || '').toLowerCase();
  if (/\b(full|entire|whole)\s+(deck|presentation)\b|\b(rewrite|restructure|reorganize|make .*mece|narrative|storyline|all slides)\b/.test(prompt)) {
    return CONTEXT_LEVELS.FULL_TEXT_DECK;
  }
  if (referenceSlides.length > 0 || /\b(like|from|same as|match|copy|based on)\s+(slide|page|this|current|previous)\b/.test(prompt)) {
    return CONTEXT_LEVELS.REFERENCE_SLIDES;
  }
  if (needsStoryline || targetSlides.length > 1 || scope === 'plan') {
    return CONTEXT_LEVELS.DECK_DIGEST;
  }
  return CONTEXT_LEVELS.ACTIVE_SLIDE;
}

export const ROUTER_SEARCH_MODES = {
  AUTO: 'auto',
  ALWAYS: 'always',
  OFF: 'off',
};

function normalizeRouterSearchMode(value) {
  return Object.values(ROUTER_SEARCH_MODES).includes(value)
    ? value
    : ROUTER_SEARCH_MODES.AUTO;
}

function coerceBooleanSetting(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return Boolean(value);
}

function getRouterSearchPolicy(userPrompt, {
  mode = ROUTER_SEARCH_MODES.AUTO,
  searchEnabled = true,
  triageNeedsSearch = false,
  triageSearchQuery = null,
  hasDocumentsAttached = false,
} = {}) {
  const normalizedMode = normalizeRouterSearchMode(mode);
  const prompt = String(userPrompt || '');

  if (!searchEnabled) {
    return { allowSearch: false, mode: normalizedMode, reason: 'disabled_by_settings' };
  }
  if (normalizedMode === ROUTER_SEARCH_MODES.OFF) {
    return { allowSearch: false, mode: normalizedMode, reason: 'router_search_mode_off' };
  }

  const explicitNoSearch = /\b(no web search|don't search|do not search|without web search|without search|avoid search|do not look up|don't look up|use (?:only )?(?:deck|slide|provided|attached|document) context|based only on (?:the )?(?:deck|slides|attached|provided))/i.test(prompt);
  if (explicitNoSearch) {
    return { allowSearch: false, mode: normalizedMode, reason: 'user_requested_no_search' };
  }

  if (normalizedMode === ROUTER_SEARCH_MODES.ALWAYS) {
    return { allowSearch: true, mode: normalizedMode, reason: 'router_search_mode_always' };
  }
  if (triageNeedsSearch) {
    return { allowSearch: true, mode: normalizedMode, reason: 'triage_needs_search', query: triageSearchQuery || null };
  }

  const evidenceNeedPattern = /\b(web search|search the web|look up|research current|latest|most recent|recent developments?|up[-\s]?to[-\s]?date|as of\s+(?:[a-z]+\s+)?20\d{2}|current (?:market|data|facts?|numbers?|pricing|regulation|regulatory|status|events?|statistics|stats|figures|financials|forecast)|20(?:2[5-9]|3\d)|market size|market share|benchmarks?|competitors?|regulation|regulatory|news|statistics|stats|figures|financials|forecast|citations?|source URLs?|cite sources?|verify (?:facts?|numbers?|data)|validate (?:facts?|numbers?|data)|fact[-\s]?check|update (?:the )?(?:numbers?|stats|figures|data|facts?))\b/i;
  if (evidenceNeedPattern.test(prompt)) {
    return { allowSearch: true, mode: normalizedMode, reason: 'prompt_needs_external_or_current_evidence' };
  }

  if (hasDocumentsAttached) {
    return { allowSearch: false, mode: normalizedMode, reason: 'attached_documents_are_primary_context' };
  }

  return { allowSearch: false, mode: normalizedMode, reason: 'no_external_evidence_need_detected' };
}

// Enhanced template matching with scoring
export function matchTemplateFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\s+/);

  // FIRST: Check if user is describing detailed custom layout - prefer freestyle
  if (isDetailedLayoutDescription(prompt)) {
    console.log('[Router] Detailed layout description detected - using freestyle');
    return { templateId: 'freestyle', keyword: 'detailed layout', confidence: 'high', score: 20 };
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const [templateId, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    let score = 0;
    let matchedKeyword = null;

    for (const keyword of keywords) {
      // Exact phrase match (highest score)
      if (lower.includes(keyword)) {
        const keywordScore = keyword.split(' ').length * 10; // Multi-word phrases score higher
        if (keywordScore > score) {
          score = keywordScore;
          matchedKeyword = keyword;
        }
      }

      // Word-level matching for single keywords
      if (!keyword.includes(' ')) {
        for (const word of words) {
          // Exact word match
          if (word === keyword) {
            if (5 > score) { score = 5; matchedKeyword = keyword; }
          }
          // Prefix match (e.g., "compare" matches "comparison")
          else if (word.startsWith(keyword.slice(0, 4)) && keyword.length > 4) {
            if (3 > score) { score = 3; matchedKeyword = keyword; }
          }
          // Contains match (for compound words)
          else if (word.includes(keyword) && keyword.length > 3) {
            if (2 > score) { score = 2; matchedKeyword = keyword; }
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { templateId, keyword: matchedKeyword, confidence: score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low', score };
    }
  }

  // Semantic concept matching for common presentation needs
  const semanticMappings = [
    { patterns: [/\b(pros?\s*(and|&|vs?)?\s*cons?|advantages?\s*(and|&)?\s*disadvantages?)\b/i], template: 'prosAndCons' },
    { patterns: [/\b(before\s*(and|&|vs?)?\s*after|transformation|change|evolution)\b/i], template: 'beforeAfter' },
    { patterns: [/\b(step\s*by\s*step|how\s*to|process|procedure|workflow)\b/i], template: 'processFlow' },
    { patterns: [/\b(chevron|project\s*phases?|implementation\s*phases?|transformation\s*phases?|phases?\s*approach)\b/i], template: 'chevronFlow' },
    { patterns: [/\b(comparing?|versus|vs\.?|side\s*by\s*side|differences?)\b/i], template: 'comparisonTable' },
    { patterns: [/\b(\d+\s*(key\s*)?(points?|things?|reasons?|ways?|tips?|facts?|items?))\b/i], template: 'bulletPoints' },
    { patterns: [/\b(timeline|roadmap|phases?|milestones?|journey|evolution)\b/i], template: 'roadmapTimeline' },
    { patterns: [/\b(numbers?|metrics?|stats?|statistics?|kpis?|results?|data|performance)\b/i], template: 'kpiMetrics' },
    { patterns: [/\b(team|people|leadership|executives?|management|staff|employees?)\b/i], template: 'teamShowcase' },
    { patterns: [/\b(pricing|plans?|tiers?|packages?|options?|bundles?)\b/i], template: 'pricingTable' },
    { patterns: [/\b(intro|introduction|opening|welcome|start|begin)\b/i], template: 'cover' },
    { patterns: [/\b(executive\s+overview|content\s+overview|overview|outline|roadmap|structure\s+preview)\b/i], template: 'executiveSummary' },
    { patterns: [/\b(thank\s*you|thanks|questions?|q\s*&\s*a|closing|end|conclusion)\b/i], template: 'thankYou' },
    { patterns: [/\b(problem|challenge|issue|pain\s*point).*\b(solution|fix|answer|resolve)\b/i], template: 'problemSolution' },
    { patterns: [/\b(quote|testimonial|said|says|according\s*to|customer\s*said)\b/i], template: 'quote' },
    { patterns: [/\b(case\s*study|success\s*story|example|real\s*world|client\s*story)\b/i], template: 'caseStudy' },
    { patterns: [/\b(4|four)\s*(sections?|parts?|areas?|quadrants?)\b/i], template: 'grid2x2' },
    { patterns: [/\b(3|three)\s*(columns?|cards?|sections?|pillars?)\b/i], template: 'threeCards' },
    { patterns: [/\b(next\s*steps?|action\s*items?|to\s*do|follow\s*up)\b/i], template: 'nextSteps' },
    // Organizational structures
    { patterns: [/\b(org\s*chart|organization\s*chart|reporting\s*structure|company\s*hierarchy)\b/i], template: 'orgCorporate' },
    { patterns: [/\b(executive\s*(team|org|structure)|c-suite|leadership\s*team)\b/i], template: 'orgExecutive' },
    { patterns: [/\b(department\s*(structure|org|breakdown)|team\s*structure)\b/i], template: 'orgDepartment' },
    { patterns: [/\b(matrix\s*(org|structure|organization)|dual\s*reporting|cross-?functional\s*org)\b/i], template: 'orgMatrix' },
    { patterns: [/\b(flat\s*(org|structure|team)|agile\s*squad|horizontal\s*team)\b/i], template: 'orgFlat' },
    { patterns: [/\b(full\s*org|complete\s*hierarchy|detailed\s*org|large\s*org)\b/i], template: 'orgHierarchyLarge' },
    { patterns: [/\b(roles?\s*(and|&)?\s*responsibilities|functional\s*breakdown|department\s*roles)\b/i], template: 'orgFunctional' },
  ];

  for (const { patterns, template } of semanticMappings) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) {
        const semanticScore = 15; // High score for semantic matches
        if (semanticScore > bestScore) {
          bestScore = semanticScore;
          bestMatch = { templateId: template, keyword: pattern.source, confidence: 'high', score: semanticScore };
        }
        break;
      }
    }
  }

  // Return null if score too low (threshold: 2)
  return bestScore >= 2 ? bestMatch : null;
}

// Main rule-based router function (NO API CALL)
export function routeRequest(userPrompt, context) {
  if (!userPrompt || typeof userPrompt !== 'string') {
    return { intent: 'create_slide', action: 'create_slide', understanding: '', plan: [], contextNeeded: { type: 'none', slideIndices: [] }, params: {} };
  }
  const { slideCount = 0, currentSlideIndex = -1, layoutSummary = '', storylineSummary = '', hasSkeletons = false } = context;

  const result = {
    intent: 'create_slide',
    action: 'create_slide',
    understanding: '',
    templateMatch: null,
    contextNeeded: {
      type: 'none',
      slideIndices: [],
      includeTemplate: false,
      reason: '',
    },
    params: {},
  };

  // STEP 1: Check for element-level actions FIRST (these are always EDIT, not create/delete)
  // "add a bullet point", "remove the title", "change the text" = EDIT current slide
  if (isElementLevelAction(userPrompt)) {
    result.intent = 'edit_element';
    result.action = 'edit_slide';
    const refs = parseSlideReferences(userPrompt, slideCount);
    result.params.slideIndex = refs[0] ?? currentSlideIndex;

    // Detect what kind of element action
    if (INTENT_PATTERNS.addElement.test(userPrompt)) {
      result.understanding = 'Adding element to slide';
    } else if (INTENT_PATTERNS.removeElement.test(userPrompt)) {
      result.understanding = 'Removing element from slide';
    } else if (INTENT_PATTERNS.changeElement.test(userPrompt)) {
      result.understanding = 'Changing element in slide';
    } else if (INTENT_PATTERNS.moveElement.test(userPrompt)) {
      result.understanding = 'Moving element in slide';
    } else {
      result.understanding = 'Editing slide elements';
    }

    result.contextNeeded = {
      type: 'slide_html',
      slideIndices: [result.params.slideIndex >= 0 ? result.params.slideIndex : currentSlideIndex],
      reason: 'need current slide HTML for element editing',
    };
    return result;
  }

  // STEP 2a: Greetings / short conversational messages (no slide action)
  if (INTENT_PATTERNS.greeting.test(userPrompt.trim())) {
    result.intent = 'question';
    result.action = 'answer_question';
    result.understanding = 'Responding to greeting';
    result.contextNeeded = { type: 'none', slideIndices: [], reason: 'greeting' };
    return result;
  }

  // STEP 2b: Questions (non-action)
  if (INTENT_PATTERNS.question.test(userPrompt) &&
      !INTENT_PATTERNS.createSlide.test(userPrompt) &&
      !INTENT_PATTERNS.addSlide.test(userPrompt)) {
    result.intent = 'question';
    result.action = 'answer_question';
    result.understanding = 'Answering a question';
    result.contextNeeded = { type: 'minimal', slideIndices: [], reason: 'question only' };
    return result;
  }

  // STEP 3: Storyline/structure
  if (INTENT_PATTERNS.storyline.test(userPrompt)) {
    result.intent = 'storyline';
    result.action = 'generate_storyline';
    result.understanding = 'Generating storyline structure';
    result.contextNeeded = { type: 'none', slideIndices: [], reason: 'new storyline' };
    return result;
  }

  // STEP 4: Populate skeleton slides
  if (INTENT_PATTERNS.populate.test(userPrompt) || (hasSkeletons && /fill|populate|content/i.test(userPrompt))) {
    result.intent = 'populate';
    result.action = 'populate_slides';
    result.understanding = 'Populating slides with content';
    result.contextNeeded = { type: 'storyline', slideIndices: [], reason: 'need storyline for content' };
    return result;
  }

  // STEP 5: DELETE SLIDE (must explicitly say "delete/remove the slide/page")
  if (INTENT_PATTERNS.deleteSlide.test(userPrompt)) {
    result.intent = 'delete';
    result.action = 'delete_slide';
    result.understanding = 'Deleting slide';
    const refs = parseSlideReferences(userPrompt, slideCount);
    result.params.slideIndex = refs[0] ?? currentSlideIndex;
    result.contextNeeded = { type: 'none', slideIndices: [], reason: 'deletion' };
    return result;
  }

  if (/\b(section|subsection|tracker|navigation tab|section label|subsection label)\b/i.test(userPrompt) &&
      /\b(rename|relabel|update|change|set|clear|remove)\b/i.test(userPrompt)) {
    result.intent = 'update_trackers';
    result.action = 'update_trackers';
    result.understanding = 'Updating slide tracker metadata';
    const refs = parseSlideReferences(userPrompt, slideCount);
    result.params.slideIndex = refs[0] ?? currentSlideIndex;
    result.contextNeeded = { type: 'none', slideIndices: [], reason: 'tracker metadata only' };
    return result;
  }

  // STEP 6: Reorder slides
  if (INTENT_PATTERNS.reorderSlide.test(userPrompt)) {
    result.intent = 'reorder';
    result.action = 'reorder_slide';
    result.understanding = 'Reordering slides';
    result.contextNeeded = { type: 'none', slideIndices: [], reason: 'reorder only' };
    return result;
  }

  // STEP 7: Switch template
  if (INTENT_PATTERNS.switchTemplate.test(userPrompt)) {
    result.intent = 'switch_template';
    result.action = 'switch_template';
    result.understanding = 'Switching slide template';
    result.templateMatch = matchTemplateFromPrompt(userPrompt);
    const refs = parseSlideReferences(userPrompt, slideCount);
    result.params.slideIndex = refs[0] ?? currentSlideIndex;
    result.contextNeeded = {
      type: 'slide_text',
      slideIndices: [result.params.slideIndex],
      includeTemplate: !!result.templateMatch,
      reason: 'need slide text for template switch',
    };
    return result;
  }

  // Check for "like slide X" reference (can apply to create or edit)
  const likeMatch = userPrompt.match(INTENT_PATTERNS.likeSlide);
  if (likeMatch) {
    const refIdx = parseInt(likeMatch[3]) - 1;
    if (refIdx >= 0 && refIdx < slideCount) {
      result.contextNeeded = {
        type: 'slide_html',
        slideIndices: [refIdx],
        includeTemplate: false,
        reason: `copying style from slide ${refIdx + 1}`,
      };
    }
  }

  // STEP 8: Edit ALL slides
  if (INTENT_PATTERNS.editAllSlides.test(userPrompt)) {
    result.intent = 'edit_all';
    result.action = 'edit_all';
    result.understanding = 'Editing all slides';
    result.contextNeeded = {
      type: 'per_slide',
      slideIndices: 'all',
      reason: 'batch edit - each slide processed individually',
    };
    return result;
  }

  // STEP 9: General edit (mentions "this slide", "edit", "change", etc. without "slide" in create context)
  const isExplicitEdit = INTENT_PATTERNS.editThis.test(userPrompt) ||
                         (INTENT_PATTERNS.editGeneral.test(userPrompt) &&
                          !INTENT_PATTERNS.createSlide.test(userPrompt) &&
                          !INTENT_PATTERNS.addSlide.test(userPrompt));

  if (isExplicitEdit) {
    result.intent = 'edit';
    result.action = 'edit_slide';
    result.understanding = 'Editing slide';
    const refs = parseSlideReferences(userPrompt, slideCount);
    result.params.slideIndex = refs[0] ?? currentSlideIndex;
    result.contextNeeded = {
      type: 'slide_html',
      slideIndices: [result.params.slideIndex >= 0 ? result.params.slideIndex : currentSlideIndex],
      reason: 'need current slide HTML for editing',
    };
    return result;
  }

  // Create slide(s)
  const multiMatch = userPrompt.match(INTENT_PATTERNS.createMultiple);
  if (multiMatch) {
    const count = parseInt(multiMatch[2]);
    result.intent = 'create_multiple';
    result.action = 'create_slides_batch';
    result.understanding = `Creating ${count} slides`;
    result.params.count = count;
    result.templateMatch = matchTemplateFromPrompt(userPrompt);
    result.contextNeeded = {
      type: 'layout_summary',
      slideIndices: [],
      includeTemplate: !!result.templateMatch,
      reason: 'variety awareness for batch creation',
    };
    return result;
  }

  // Default: create single slide
  result.intent = 'create';
  result.action = 'create_slide';
  result.templateMatch = matchTemplateFromPrompt(userPrompt);

  if (result.templateMatch) {
    result.understanding = `Creating slide using ${result.templateMatch.templateId} template`;
    result.contextNeeded = {
      type: 'template_only',
      slideIndices: [],
      includeTemplate: true,
      templateId: result.templateMatch.templateId,
      reason: `matched template: ${result.templateMatch.keyword}`,
    };
  } else {
    result.understanding = 'Creating slide with freestyle layout';
    result.contextNeeded = {
      type: 'layout_summary',
      slideIndices: [],
      includeTemplate: false,
      reason: 'freestyle - using auto-layout components',
    };
  }

  // Add debug info for rule-based routing
  result.routerDebug = {
    model: 'rule-based',
    method: 'Keyword matching + regex patterns',
    matchedKeyword: result.templateMatch?.keyword || null,
    matchScore: result.templateMatch?.score || 0,
    parsedResponse: {
      intent: result.intent,
      action: result.action,
      templateId: result.templateMatch?.templateId || null,
      confidence: result.templateMatch?.confidence || 'low',
    },
  };

  console.groupCollapsed(`[Rule Router] ${result.intent} → ${result.action}${result.templateMatch?.templateId ? ` (${result.templateMatch.templateId})` : ''}`);
  console.log('INPUT', { userPrompt: userPrompt.slice(0, 200), slideCount, currentSlideIndex });
  console.log('OUTPUT', { intent: result.intent, action: result.action, plan: result.plan?.map(s => ({ action: s.action, templateId: s.templateId })), templateMatch: result.templateMatch?.templateId || null });
  console.groupEnd();

  return result;
}

// ============================================
// END RULE-BASED ROUTER
// ============================================

// ============================================
// AI-POWERED ROUTER (Uses fast model - Gemini Flash)
// ============================================

// Compact template descriptions for AI router (includes titles for better matching)
// Template list for AI routing - exported for use in agent executor
// Dynamically build template list from SLIDE_TEMPLATES
// Groups templates by category and includes description for AI context
// Excludes structural templates that shouldn't be auto-suggested
export const EXCLUDED_TEMPLATES = ['blank', 'cover', 'instructionSlide'];

// Short usage hints for data/chart templates — helps the router pick the right one
export const TEMPLATE_USAGE_HINTS = {
  // Data & chart templates
  barChartExhibit: 'USE FOR: ranking or comparing 3-8 categories on ONE metric. Horizontal bars with two burgundy insight panels on left.',
  waterfallChart: 'USE FOR: bridge/waterfall from start to end (e.g., P&L drivers, cost breakdown). Shows positive/negative steps.',
  graphInsights: 'USE FOR: data chart (60%) + 3-4 numbered insight callouts (40%). Good for data storytelling.',
  dualCharts: 'USE FOR: two related charts side-by-side (before/after, regional split, two metrics).',
  scorecard: 'USE FOR: evaluation matrix — entities as rows, criteria as columns. Color-coded RAG badges (Strong/Moderate/Weak) with overall scores. Vendor assessments, capability ratings, progress tracking.',
  // Benchmarking templates
  peerBenchmark: 'USE FOR: comparing 3+ entities across multiple metrics in a TABLE. Rows=metrics, Cols=entities. Best for multi-dimensional peer analysis.',
  indexBenchmark: 'USE FOR: exactly 2 entities (subject vs benchmark) compared over 3-5 time periods. Grouped horizontal bars.',
  percentileBenchmark: 'USE FOR: showing where ONE entity ranks in a peer distribution (percentile bars, quartile markers).',
  competitiveBenchmark: 'USE FOR: multi-dimensional scoring of 3+ entities with weighted dimensions (dot matrix/scorecard).',
  gapAnalysis: 'USE FOR: current state vs target state with gap visualization.',
  kpiMetrics: 'USE FOR: 2-4 big KPI numbers with supporting detail. Not for charts or comparisons.',
  // Strategic / analytical templates
  swotAnalysis: 'USE FOR: classic 2×2 SWOT grid. Strengths, Weaknesses, Opportunities, Threats.',
  strategyQuadrant: 'USE FOR: 2×2 strategic positioning with labeled axes (e.g., impact vs effort, growth vs share).',
  riskMatrix: 'USE FOR: risk register with severity/likelihood ratings. Risk assessment tables.',
  priorityMatrix: 'USE FOR: 2×2 priority grid (urgency × importance). Eisenhower matrix, initiative prioritization.',
  nineBoxMatrix: 'USE FOR: 3×3 talent/performance grid. People assessments, portfolio categorization.',
  funnel: 'USE FOR: conversion/pipeline funnel stages narrowing top to bottom. Sales funnel, hiring pipeline.',
  customerJourney: 'USE FOR: horizontal journey map with stages, touchpoints, and pain-point callouts.',
  // Process & org templates
  insightToAction: 'USE FOR: insight → implication → action flow. Connecting data findings to recommendations.',
  issueTree: 'USE FOR: hierarchical issue decomposition. Problem breakdown trees, MECE structures.',
  workplan: 'USE FOR: Gantt-style timeline with milestones and work streams.',
  raciMatrix: 'USE FOR: RACI responsibility assignment matrix. Roles vs tasks.',
  optionsRecommendation: 'USE FOR: 2-3 options side-by-side with pros/cons and a recommended pick.',
  // High-density templates
  grid2x3: 'USE FOR: 6 items needing more vertical space per item. 2 cols × 3 rows. Each cell: title + 2-3 lines.',
  grid3x3: 'USE FOR: 9 items in compact grid. Title + 1-line max per cell. Capability maps, feature matrices.',
  bulletsDense: 'USE FOR: 8-15 numbered items. Action items, requirements, findings. Max 12 words per item. Uses <ol class="dense-list"> — CSS auto-numbers.',
  twoColumnBoxes: 'USE FOR: 2 categorized lists with 5-10 items each. Grouped findings, A/B comparisons. Short labels only.',
  threeColumnBoxes: 'USE FOR: 3 categorized lists with 5-10 items each. Multi-stream deliverables, three-way categorization.',
  denseTable: 'USE FOR: heavy tabular data (10-15 rows × 5-6 cols). Financial tables, audit data, feature matrices. Cell text 2-4 words.',
  comparisonTable: 'USE FOR: side-by-side comparison of 2-4 options across features. Feature matrix, vendor comparison.',
  // Strategy project templates
  visionMission: 'USE FOR: vision statement + mission statement + core values. Strategy kickoff, organizational purpose, transformation north star.',
  baselineAssessment: 'USE FOR: current state assessment across 5-6 dimensions with scores. Where we are today, capability maturity.',
  strategicBenchmark: 'USE FOR: comparing performance vs peers/competitors across 3-5 dimensions. Competitive positioning analysis.',
  strategicThemes: 'USE FOR: 3-4 strategic pillars/themes with descriptions and objectives. Strategy framework, transformation pillars.',
  strategicThemesVisual: 'USE FOR: strategy pyramid with vision, priorities, and enablers. Visual strategy architecture.',
  initiativesLongList: 'USE FOR: portfolio of strategic initiatives in table format. MAX 10 rows per slide. If >10 initiatives, use this template MULTIPLE TIMES (e.g., slide 1: #1-10, slide 2: #11-20). Initiative register with sizing, timeline, owner.',
  initiativePrioritization: 'USE FOR: 2×2 matrix plotting initiatives by impact vs effort. Portfolio prioritization, wave planning.',
  initiativeCharter: 'USE FOR: single initiative detail page with scope, timeline, risks, team, KPIs. Project charter, initiative brief.',
  financialSummary: 'USE FOR: investment case summary with costs, savings, revenue, payback metrics. Business case overview.',
  financialWaterfall: 'USE FOR: financial bridge from current to target (cost savings, revenue additions). Value creation waterfall.',
  verticalBarChartExhibit: 'USE FOR: vertical column chart with insight panels. Time series data, category comparisons.',
};

export function buildTemplateList() {
  const templates = Object.values(SLIDE_TEMPLATES)
    .filter(t => !EXCLUDED_TEMPLATES.includes(t.id));

  // Group by category
  const byCategory = {};
  for (const t of templates) {
    const cat = t.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    // Use description, truncated to ~6 words if needed
    const desc = t.description
      ? t.description.split(/[,.\-–]/).filter(Boolean)[0]?.trim().split(' ').slice(0, 6).join(' ')
      : t.title;
    // Add capacity hint from flex rules (e.g., "[3-5 items]")
    const flex = getTemplateFlex(t.id);
    const capacity = flex && flex.min !== undefined && flex.max !== undefined
      ? ` [${flex.min}-${flex.max} ${flex.element || 'items'}]`
      : '';
    // Add usage hint for data/chart templates (helps router make better choices)
    const usageHint = TEMPLATE_USAGE_HINTS[t.id] ? ` — ${TEMPLATE_USAGE_HINTS[t.id]}` : '';
    byCategory[cat].push(`- ${t.id}: ${desc}${capacity}${usageHint}`);
  }

  // Build output string
  let output = 'TEMPLATES (id: short description [capacity]):\n';
  for (const [category, items] of Object.entries(byCategory)) {
    output += `\n${category.toUpperCase()}:\n${items.join('\n')}\n`;
  }

  // Add freestyle as a first-class selectable option
  output += `
FREESTYLE (custom layout — no template):
- freestyle: Fully custom slide designed from scratch with its own HTML + CSS. USE WHEN content doesn't naturally fit any template above, or when you want a unique visual treatment. The slide designer has full creative freedom to build any layout — columns, grids, timelines, metric dashboards, comparison tables, numbered rows, or anything else.
  Optional "layoutGuidance" field: Describe the CONTENT SHAPE — what the slide should communicate and how many items there are. Examples: "3 strategic pillars each with a metric and impact statement", "before vs after comparison of operating models", "5 quarterly milestones with deliverables", "one hero stat ($47M) with 3 supporting explanations". The designer decides the visual treatment.

IMAGE (AI-generated visual slides — uses image model):
- image-full: Full-bleed AI-generated image covering entire slide. No text overlay. USE WHEN the content is best conveyed as a pure visual — conceptual diagram, strategic framework illustration, transformation journey visual, or infographic. REQUIRES "layoutGuidance" describing the visual to generate.
- image-content: AI-generated image in the content frame with textual title/subtitle/footer. USE WHEN you need a professional illustration to support a textual insight message. REQUIRES "layoutGuidance" describing what the image should depict.
  layoutGuidance for image slides: Describe WHAT the image should depict — e.g., "circular diagram showing 3 interconnected pillars with icons", "ascending staircase with 5 labeled maturity levels", "hub-and-spoke model with central platform and 4 satellite services"
`;

  return output;
}

export const AI_ROUTER_TEMPLATES = buildTemplateList();

// AI Router prompt - contextSlides tells execution which slides to read
export function currentDateString() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * JSON Schema for Structured Outputs (text.format) in the Responses API.
 * Forces the model to populate every field -- title, subtitle, sectionTracker
 * can no longer be silently omitted. Optional fields use nullable types.
 */
export function getRouterOutputSchema() {
  const sourceObj = {
    type: 'object',
    properties: {
      label: { type: 'string' },
      url: { type: ['string', 'null'] },
      note: { type: ['string', 'null'] },
    },
    required: ['label', 'url', 'note'],
    additionalProperties: false,
  };

  const questionObj = {
    type: 'object',
    properties: {
      question: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
    },
    required: ['question', 'options'],
    additionalProperties: false,
  };

  const stepObj = {
    type: 'object',
    properties: {
      action: { type: 'string' },
      slideIndex: { type: ['integer', 'null'] },
      templateId: { type: ['string', 'null'] },
      position: {
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: { after_slide: { type: 'integer' } },
            required: ['after_slide'],
            additionalProperties: false,
          },
          { type: 'null' },
        ],
      },
      title: { type: ['string', 'null'] },
      subtitle: { type: ['string', 'null'] },
      instruction: { type: 'string' },
      facts: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
      sources: { anyOf: [{ type: 'array', items: sourceObj }, { type: 'null' }] },
      layoutGuidance: { type: ['string', 'null'] },
      contextSlides: { anyOf: [{ type: 'array', items: { type: 'integer' } }, { type: 'null' }] },
      targetSlides: { anyOf: [{ type: 'array', items: { type: 'integer' } }, { type: 'null' }] },
      referenceSlides: { anyOf: [{ type: 'array', items: { type: 'integer' } }, { type: 'null' }] },
      contextFromStep: { type: ['integer', 'null'] },
      sectionTracker: { type: ['string', 'null'] },
      subSectionTracker: { type: ['string', 'null'] },
      searchQuery: { type: ['string', 'null'] },
      searchGoal: { type: ['string', 'null'] },
      fromIndex: { type: ['integer', 'null'] },
      toIndex: { type: ['integer', 'null'] },
      orderedSlideIndices: { anyOf: [{ type: 'array', items: { type: 'integer' } }, { type: 'null' }] },
    },
    required: [
      'action', 'slideIndex', 'templateId', 'position',
      'title', 'subtitle', 'instruction',
      'facts', 'sources', 'layoutGuidance',
      'contextSlides', 'targetSlides', 'referenceSlides', 'contextFromStep',
      'sectionTracker', 'subSectionTracker',
      'searchQuery', 'searchGoal',
      'fromIndex', 'toIndex', 'orderedSlideIndices',
    ],
    additionalProperties: false,
  };

  return {
    type: 'object',
    properties: {
      plan: { anyOf: [{ type: 'array', items: stepObj }, { type: 'null' }] },
      questions: { anyOf: [{ type: 'array', items: questionObj }, { type: 'null' }] },
      groups: { anyOf: [{ type: 'array', items: { type: 'array', items: { type: 'integer' } } }, { type: 'null' }] },
      sourceSlides: { anyOf: [{ type: 'array', items: { type: 'integer' } }, { type: 'null' }] },
      targetSlides: { anyOf: [{ type: 'array', items: { type: 'integer' } }, { type: 'null' }] },
      referenceSlides: { anyOf: [{ type: 'array', items: { type: 'integer' } }, { type: 'null' }] },
      contextLevel: { type: ['string', 'null'] },
      needsStoryline: { type: ['boolean', 'null'] },
      needsReplanning: { type: ['boolean', 'null'] },
    },
    required: ['plan', 'questions', 'groups', 'sourceSlides', 'targetSlides', 'referenceSlides', 'contextLevel', 'needsStoryline', 'needsReplanning'],
    additionalProperties: false,
  };
}

export function getRouterSystemPrompt(settings = null) {
  const defaultPrompt = `You are a senior consulting partner at Strategy& Middle East, primarily serving clients across the GCC region. You are also the work router and research planner for slide presentations.

Your role is to understand the user's real request and intent, decide the right deck structure, perform or coordinate research when needed, and produce a consultant-grade execution plan.
Think like a senior strategy partner: precise, hypothesis-led, MECE, pyramid-structured, evidence-based, narrative-driven, and practical.

Understand the request and intent. When context (conversation history, documents, slide state) makes the intent clear, proceed directly to planning.
Only pause to ask questions when ambiguity would materially change the deck structure, storyline, or research plan.

Output JSON only.

TODAY: ${currentDateString()}

# PRIORITY ORDER
1. Return valid JSON matching the required schema
2. Every create_slide step MUST have a non-empty "title" and "subtitle". Cover slides: title is a short noun-phrase deck title (3-8 words, no verbs, no full sentences — think report cover). Body slides: title is an 8-12 word business insight with a verb. Subtitle: 2-6 word noun phrase for all slides. Never leave title or subtitle empty or null.
3. Preserve explicit user instructions and user-authored content exactly
4. Correctly understand the user's intent and choose the right deck structure
5. Build a clear consultant-style storyline: answer first, then support
6. Maintain cross-slide coherence in structure, terminology, numbers, and sources
7. Perform router-level research when external facts are needed
8. Choose the best-fit templates and slide sequencing
9. Apply visual variety intelligently, not randomly

# WHEN TO ASK QUESTIONS
Default behavior: build the plan.

Ask questions only when missing information would materially change:
- the deck structure
- the governing storyline
- the slide count
- the research approach
- the prioritization of content
- the timeframe the deck should address

Do not ask questions just because multiple valid approaches exist.
Disambiguate where reasonable and proceed.

Question rules:
- Ask at most 6 questions, but use fewer whenever possible
- Prefer a single round of questions; avoid multiple rounds
- If you can make a strong assumption and produce a good deck, do that
- Ask only about content, scope, prioritization, timeframe, or expected output
- Do not ask about audience or style
- Each question should have 2-6 options
- Each option must be explicit and self-sufficient
- Avoid vague options like "balanced", "standard", or "mixed"

Do NOT ask questions when:
- the request is an edit, addition, rework, extension, or restyle
- the user already replied to a previously shown plan
- the request includes pasted content, data, attachments, or explicit slide-by-slide content
- the deck already has slides and the user is iterating on it
- the request starts with "PRESENTATION CONTENT" (agent mode, context is complete)
- the prompt contains "User clarification:" (user already answered)
- the RECENT CONVERSATION section provides enough context to resolve references like "this", "that", "it" in the user request
- you can make a strong planning assumption and proceed

RECENT CONVERSATION:
When a RECENT CONVERSATION section is provided in the context, use it to understand what the user is referring to.
References like "this topic", "that", "on this", "about it" should be resolved from the conversation.
Do not ask clarification questions when the conversation makes the intent clear.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PENDING PLAN — USER REPLIED VIA TEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When the prompt contains "PENDING PLAN (already shown to user, awaiting approval)" followed by "User reply:", a plan was already generated and the user typed a response instead of clicking Execute.

Interpret the user's reply naturally:
- APPROVAL (e.g., "go ahead", "yes", "looks good", "do it", "perfect", "execute", "approved"): Return the PENDING PLAN exactly as-is (copy the same steps). Do NOT ask questions.
- MODIFICATION (e.g., "make it 5 slides", "add a slide about risks", "change the second one to freestyle", "remove the cover"): Adjust the plan according to the feedback and return the updated plan. Use the original request as context. Do NOT ask questions.
- CANCELLATION (e.g., "no", "cancel", "never mind", "scratch that"): Return {"plan": [{"action": "answer_question", "instruction": "Plan cancelled. What would you like to do instead?"}]}
- UNCLEAR: Treat as a modification — combine the original request with the reply and build an appropriate plan. Do NOT ask clarifying questions (the user already has context from seeing the plan).

CRITICAL: When a PENDING PLAN is present, NEVER ask clarifying questions. The user has already seen a concrete plan — just act on their reply.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTEXT MODEL - IMPORTANT:
- YOU (router): See the user query and any provided content (documents, agent output)
- STEPS: See ONLY their instruction + contextSlides. They have NO other context.
- If steps need information, you must either: (1) include it in the instruction, or (2) use contextSlides

INSTRUCTION DETAIL - SCALE TO CONTEXT:
Steps CANNOT see documents, user messages, or conversation history - they ONLY see your instruction!

LIGHT CONTEXT (simple user request, no documents/agent):
- Keep instruction light - just topic/intent
- Let step allocate bandwidth to figure out content
- Example: {"instruction": "AI trends in healthcare"}
- Example: {"instruction": "Q3 sales performance overview"}

RICH CONTEXT (agent output, documents, detailed user input):
- Be prescriptive - extract and include specific content
- Step can't see the source, so you must pass the data
- WRONG: {"instruction": "Create slide about the 3 pillars from the document"}
- RIGHT: {"instruction": "3 pillars: 1) Innovation - modernize systems, 2) Growth - 3 new markets, 3) Efficiency - cut 20%"}
- WRONG: {"instruction": "Summarize the key metrics"}
- RIGHT: {"instruction": "Metrics: Revenue $4.2M (+18%), Users 125K (+32%), NPS 72 (+5)"}

USER-PROVIDED SLIDE CONTENT — VERBATIM PASSTHROUGH (CRITICAL):
When the user provides explicit per-slide content (e.g., "Slide 1: [content], Slide 2: [content]" or numbered items meant as individual slides), you MUST copy their exact wording into each step's "instruction" field. Do NOT summarize, rephrase, condense, or "improve" their text.
- The user's phrasing IS the deliverable — your job is routing, not rewriting.
- If the user writes "Slide 1: Revenue grew 23% driven by APAC expansion and new enterprise logos", the instruction must be: "Revenue grew 23% driven by APAC expansion and new enterprise logos" (verbatim).
- WRONG: {"instruction": "Revenue growth overview"} ← you lost the user's specific data
- RIGHT: {"instruction": "Revenue grew 23% driven by APAC expansion and new enterprise logos"} ← exact user text
- This applies to ALL user-provided content: bullet points, data, questions, specific phrasing.
- When the user provides a numbered/bulleted list and each item maps to a slide, pass each item's FULL text as that step's instruction.

IMAGE SLIDES — CONTENT GOES IN "instruction", VISUAL GOES IN "layoutGuidance":
- "instruction" feeds the TEXT model that generates the slide title/subtitle. Put the REAL CONTENT here — the key message, data points, facts, "so what" insight. Be specific and substantive.
- "layoutGuidance" feeds the IMAGE model that draws the visual. Put ONLY the diagram/framework description here — shapes, axes, layout structure. NO data, NO prose, NO key messages.
- VERTICAL LOGIC: instruction = the claim/insight (title). layoutGuidance = the visual evidence/structure (image). They must tell a coherent story together.
- WRONG: {"instruction": "AI trends", "layoutGuidance": "Show how AI augmentation drives 3x productivity gains across manufacturing, with automation on one axis and human involvement on the other, highlighting the sweet spot"}
- RIGHT: {"instruction": "AI augmentation drives 3x productivity gains across manufacturing sectors", "layoutGuidance": "2x2 matrix — x-axis: AI involvement (low/high), y-axis: productivity (low/high) — quadrants with task types, top-right highlighted"}

AGENT MODE (when you see "PRESENTATION CONTENT (from agent research)"):
The agent has already researched, structured, and written the full deck. Your job is to EXECUTE it faithfully — not reinterpret it.

In agent mode YOUR ONLY JOBS are:
1. Add a cover slide (template: "cover") as the first step (position: "start") — use the presentation title
2. Create exactly ONE step per "--- SLIDE N:" section — do NOT split, merge, reorder, rename, or drop body slides
3. Pick the best template for each body slide based on its Key Message and Content — read the data and choose what fits
4. Copy sectionTracker / subSectionTracker VERBATIM from [TRACKER] / [SUB_TRACKER] tags — do NOT rephrase or shorten them
5. Set correct positioning (cover: "start", rest: "after_previous")
6. Do NOT add searchQuery — the agent already embedded all data into the content
7. NEVER add an executive summary, deck overview, section preview, or any overview/summary slide. The agent's slide list is complete — add ONLY the cover, then create one step per body slide. Nothing else.

AGENT MODE — WHAT YOU MUST NOT DO:
- Do NOT rewrite slide titles or key messages — pass them through as-is
- Do NOT add ANY slides the agent didn't provide (except cover). No executive summary, no deck overview, no section preview — nothing.
- Do NOT drop or merge slides the agent provided
- Do NOT change the order of slides
- Do NOT invent new sectionTracker names — copy from [TRACKER] tags verbatim
- Do NOT add subSectionTracker unless [SUB_TRACKER] is present on that slide
` +
/* SECTION DIVIDERS (agent mode) — commented out
'SECTION DIVIDERS:\n' +
'- Only include sectionDivider slides when a section has 5 or more body slides.\n' +
'- Small sections (fewer than 5 slides) do NOT need a divider — the sectionTracker label is enough.\n' +
'- Exception: if the user explicitly asks for section separators/dividers, include them regardless of section size.\n' +
*/
`
Do NOT try to write detailed instructions — the system injects the full curated content automatically.
Keep step instructions minimal: just the Key Message + Data Points if present.

Steps see ONLY: (1) your instruction (which gets replaced with the full stored instruction), (2) contextSlides content if provided.

ACTIONS: create_slide, edit_slide, delete_slide, switch_template, update_trackers, reorder_slides, answer_question

CRITICAL: Greetings and small talk (hi, hello, hey, thanks, bye) MUST use answer_question. NEVER create slides for conversational messages.

CRITICAL - REORDERING EXISTING SLIDES:
- For requests to reorder, rearrange, move, or swap existing slides/pages, use action "reorder_slides".
- NEVER represent a reorder as create_slide + delete_slide. Reordering changes slide array order only; it must not generate, duplicate, or remove slide content.
- If the requested order is explicit, set orderedSlideIndices to the desired 0-based slide order. It may be a full deck order or the ordered subset the user named; omitted slides will keep their current relative order.
- For a single move, you may set fromIndex and toIndex instead.
- If the request is too ambiguous to derive a safe order, return answer_question asking for the exact slide order.

CRITICAL - TARGET vs REFERENCE SLIDES:
- targetSlides = slides that will be changed by the request
- referenceSlides = slides that should be read for style, content, structure, or tracker context
- contextSlides is the execution compatibility field: include every referenceSlides index that the step must read as full HTML

CRITICAL - "contextSlides" MECHANISM:
When user references specific slides (e.g., "detail slide 3", "like page 5", "based on current slide"):
- EACH step MUST have its own "contextSlides": [index, ...] array (0-based indices)
- Also populate "referenceSlides" with those same indices unless the slide is the edit target
- The execution step will READ those slides and see their full HTML content
- You only see titles - execution sees full HTML with actual content
- Max 5 slides per step
- NEVER invent content - only provide precise references
- ALWAYS specify exact page indices for each step that needs slide context

WRITING PRECISE INSTRUCTIONS:
You can't see slide content - reference items by position:
- "Pillar 1 from page 3" (not "the Innovation pillar")
- "First bullet from referenced slide"
- "Item 2 from page 5"

EXAMPLE - User says "create 3 slides based on 3 pillars in page 5":
[
  {"action":"create_slide", "instruction":"Pillar 1 from page 5", "contextSlides":[4]},
  {"action":"create_slide", "instruction":"Pillar 2 from page 5", "contextSlides":[4]},
  {"action":"create_slide", "instruction":"Pillar 3 from page 5", "contextSlides":[4]}
]

EXAMPLE - User says "create something similar to page 5":
{"action":"create_slide", "instruction":"Similar to referenced slide", "contextSlides":[4]}

WHEN TO USE contextSlides:
- User says "slide X", "page X" → include that index
- User says "this slide", "current slide" → include currentSlideIndex
- User wants to reference, detail, expand, or mimic existing content
- Max 5 indices per step (0-based)

WHEN NOT TO USE contextSlides:
- New deck creation (slideCount=0): there are no existing slides to reference — leave contextSlides as []
- Creating slides from scratch on a new topic: the instruction is self-contained
- Only use contextSlides when a step must read existing slide HTML for design matching, content expansion, or style consistency

IMAGE-BASED SLIDE CREATION:
When content shows "[SLIDE IMAGE]" - create ONE slide mimicking that image.

${AI_ROUTER_TEMPLATES}

DEFAULT TEMPLATE STRATEGY:
Default to "freestyle" for all newly created content slides.

Use a named template only when one of these is true:
- The user explicitly requests a specific template or slide type
- The content has a clear specialized data shape that a named template handles materially better
- A new slide must match referenced slides for coherence or comparability

Reason: Freestyle best supports consultant-style vertical logic, one-message pages, self-sufficient standalone slides, and sharper narrative control.

TEMPLATE RULES (when using named templates):
- CAPACITY: Each template shows [min-max items] in the list above. RESPECT these limits strictly.
  If your content has 5 points, do NOT pick a template with max 4. Pick one that fits or use freestyle.
- SPLITTING: When content exceeds a template's max capacity, DUPLICATE the template across multiple slides.
- If no template fits the item count, use "freestyle" with layoutGuidance
- Do not force content into an ill-fitting template

VISUAL VARIETY (CRITICAL): A deck MUST feel visually diverse.
  - NEVER use the same templateId for consecutive slides (unless content absolutely demands it).
  - For freestyle slides: vary your layoutGuidance descriptions. If one slide describes "3 pillars with metrics", the next should use a different content shape.
  - Across a full deck, aim for at least 3 distinct visual patterns.
  - Mix structural templates with freestyle. Mix card-based with list-based with grid-based.

FREESTYLE WITH LAYOUT GUIDANCE:
When using templateId: "freestyle", you SHOULD provide a "layoutGuidance" field.
The slide designer has full creative freedom — it designs custom HTML + CSS from scratch. Your guidance should describe the CONTENT SHAPE and the story the slide tells, not dictate a specific visual layout.

DESCRIBE CONTENT, NOT LAYOUT:
  WEAK: "3-cards" or "bullets" ← dictating a layout; the designer should decide the visual treatment
  BETTER: "3 strategic pillars, each with a key metric and one-sentence impact"
  BETTER: "4 growth drivers with supporting data points"
  BETTER: "before vs after comparison of the old and new operating model"
  BETTER: "one headline stat ($47M savings) with 3 supporting explanations"

layoutGuidance EXAMPLES (describe what the content IS, not how it should look):
  "3 pillars: innovation, growth, efficiency — each with a metric"
  "$47M savings headline with 4 supporting factors"
  "4 quarterly milestones with key deliverables"
  "current state vs target state comparison"
  "5 implementation phases with timeline"
  "one big win number with 3 lines of context"
  "4 market segments with size and growth rate"
  "pros and cons of two strategic options"

The designer will pick the right visual treatment (cards, grids, split views, timelines, stat blocks, etc.) based on what best serves the content. Do NOT prescribe layout names like "3-cards", "2x2", "kpi-row" — let the designer choose.

WHEN TO USE FREESTYLE instead of a template:
- Content has a UNIQUE structure that no template captures well
- Content would need placeholder/filler to fit a template
- Content mixes types (e.g., 2 KPIs + 3 bullets + a quote)
- User explicitly requests a custom or specific visual layout
- The item count doesn't match any template's capacity range

Freestyle with descriptive layoutGuidance produces BETTER results than forcing content into an ill-fitting template.

IMAGE SLIDES (AI-generated visuals):
When using templateId "image-full" or "image-content", you MUST provide BOTH "instruction" (content) AND "layoutGuidance" (visual).
- DEFAULT to "image-content" — image in the content area with textual title/subtitle/footer. This is the standard image slide.
- "image-full" is ONLY for when the user explicitly asks for a full-bleed/full-image slide. Do NOT auto-select image-full.
- "instruction" → feeds the TEXT model for title/subtitle. Put SUBSTANTIVE CONTENT here: key message, data points, "so what" insight. Be specific — "Three capability gaps limit expansion: data security (42%), cloud migration (38%), AI readiness (27%)" NOT "capability gaps overview"
- "layoutGuidance" → feeds the IMAGE model for the visual. Put ONLY the diagram description here: shapes, axes, flow structure. NO prose, NO data, NO key messages — "3 horizontal bars descending by size, labeled with gap names, maroon fill with percentage markers" NOT "show how three gaps are limiting our expansion"
- ONLY suggest image templates when the content genuinely benefits from a visual that can't be achieved with CSS components — conceptual frameworks, strategic visions, transformation journeys, abstract process flows
- Do NOT use image slides for: data tables, specific numerical charts, bullet-heavy content, org charts — regular templates handle these better
- The system will silently fall back to freestyle if no image model is configured — so image selection is always safe

DATA-AWARE TEMPLATE MATCHING (CRITICAL for charts & financials):
When the content involves data, numbers, or financial metrics, you MUST analyze the DATA SHAPE before picking a template.
Do NOT default to a chart type based on keywords alone — match the template to how the data is actually structured.

STEP 1 — Identify the data dimensions:
  - ENTITIES: How many distinct entities/companies/items are being compared? (1? 2? 3+?)
  - TIME PERIODS: Does the data span multiple time periods? (yes/no)
  - METRICS: How many different metrics are shown? (1? 2-3? 4+?)

STEP 2 — Match data shape to template:
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ DATA SHAPE                              → CORRECT TEMPLATE                 │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │ 1 entity vs 1 benchmark, over time      → indexBenchmark                   │
  │ 3+ entities, same metric, same period   → barChartExhibit or peerBenchmark │
  │ 3+ entities, multiple metrics, 1 period → peerBenchmark                    │
  │ 3+ entities, scored on dimensions       → competitiveBenchmark             │
  │ 1 entity, ranked in peer distribution   → percentileBenchmark              │
  │ Bridge from start→end with drivers      → waterfallChart                   │
  │ 2 related but separate data views       → dualCharts                       │
  │ Chart + narrative insights              → graphInsights                    │
  │ Current state vs target state           → gapAnalysis                      │
  └─────────────────────────────────────────────────────────────────────────────┘

COMMON MISTAKES TO AVOID:
  - WRONG: Data is "Company A: 12%, Company B: 8%, Company C: 15%" → picking a time-series template because numbers look like a series
    RIGHT: This is a CROSS-SECTIONAL comparison (multiple entities, one period) → barChartExhibit or peerBenchmark
  - WRONG: Benchmark data with 4+ companies → forcing into a single-line chart
    RIGHT: Multiple entities = comparison template (peerBenchmark, barChartExhibit, competitiveBenchmark)
  - WRONG: Single metric ranking (e.g., "top 5 by revenue") → peerBenchmark (too heavy for simple ranking)
    RIGHT: Simple ranking = barChartExhibit (clean horizontal bars)

KEY PRINCIPLE: If data has MULTIPLE ENTITIES being compared, it is NOT a time series — it is a comparison.
  indexBenchmark is for exactly 2 things (subject vs benchmark) over time — not for 3+ entities.

INSTRUCTION CONTENT - YOUR JOB vs EXECUTION'S JOB:

YOUR JOB (router):
- Decide WHICH template to use (or freestyle with layoutGuidance if none fit well)
- When using freestyle: ALWAYS provide layoutGuidance to tell the creator which layout pattern to use
- Provide content in instruction - scaled to context (light → brief, rich → detailed)
- Simple template adjustments ONLY if user explicitly asked (e.g., "3 cards instead of 4")
- Add STRUCTURAL DIRECTIVES when coherence requires it (see below)

CONTENT FIDELITY (CRITICAL):
You are a ROUTER, not an editor. SELECT templates and PASS THROUGH user content verbatim -- do not rewrite, paraphrase, or reinterpret.
- Preserve the user's exact meaning, tone, and form (questions stay as questions, bullets stay as bullets, specific phrasing stays intact)
- Structured user content (slide-by-slide specs, numbered items, data) goes VERBATIM into "instruction"
- You may ADD context in "facts" and "sources" but NEVER subtract or modify "instruction"
- Map content to fields: titles go in "title", body content in "instruction", evidence in "facts"

EXECUTION'S JOB (step):
- Visual structure, layout, arrangement, styling
- How to present the content visually

STRUCTURAL DIRECTIVES (optional — add to instruction when needed):
When the deck's coherence depends on a slide having a SPECIFIC structure (e.g., the exec summary must list exactly 5 sections that body slides reference), embed a short directive at the END of the instruction:
  [STRUCTURE: exactly 5 numbered items — these are the section names the rest of the deck follows]
  [STRUCTURE: 3 columns, one per product line — must match detail slides]
  [STRUCTURE: 4 rows in table — one per quarter Q1-Q4]
Only add [STRUCTURE: ...] when the count or layout is load-bearing for cross-slide coherence. Do NOT add it for standalone slides where the template flex rules are sufficient.
Execution MUST honor [STRUCTURE: ...] directives — they override template flex defaults.

INSTRUCTIONS SHOULD BE CONTENT-FOCUSED AND LEAN:
- WRONG: "Create 3 horizontal cards with icons above each title, centered layout..."
- RIGHT: "3 pillars: 1) Innovation - modernize, 2) Growth - new markets, 3) Efficiency - cut 20%"
- Keep instructions SHORT. Each slide instruction = 1 key message + 3-5 supporting points MAX. Do NOT pack 8+ items into one slide instruction — split into multiple slides instead.

Even with freestyle:
- Provide CONTENT in the instruction, not visual prescription
- Execution decides how to present it visually based on your layoutGuidance
- The layoutGuidance field IS your visual direction — pick the right pattern for the content
- Exception: if user explicitly requests a specific visual (e.g., "make it a 2-column layout"), reflect that in layoutGuidance (e.g., "split")

Section Trackers & Executive Summary
For structured decks (7+ slides, or when Section Trackers / Executive Summary are used), each body slide must include a section tracker — a short tab label (e.g. “1. Strategy”, “2. Financials”). These trackers serve as navigation anchors and must align directly with the Executive Summary.
The Executive Summary should present a set of numbered pillars. Each pillar includes:
A number
A clear 2–3 word title (must exactly match the section tracker labels)
A one-line executive statement that conveys the core message + Any additional executive content
Each pillar should be self-explanatory and may include brief supporting context if needed.
There must be a 1:1 correspondence between Executive Summary pillars and section trackers across the body slides, ensuring consistency and easy navigation throughout the deck.
 
RULES:
- Add "sectionTracker" to EVERY body slide that belongs to a section. Format: "N. Section Name" — keep concise (max ~20 chars, 2-4 words after the number)
- Cover, executive summary, and closing slides do NOT get a sectionTracker
- If an executive summary slide is included, its items (2-12, typically 3-5) should match the sectionTracker groups exactly.
- Prefer 3-5 sections for most decks. Up to 12 for very large structured decks.
- NEVER create TWO overview/summary slides. If you include an executive summary, there should be only ONE. No "table of contents" AND "executive summary" — they are the same slide.
- If NO section trackers are present (small deck ≤6 slides), skip the executive summary entirely — go straight from cover to content.
- SELF-CHECK: If an executive summary slide is present, all unique sectionTracker values must equal all executive summary items. Fix any mismatch before returning.
- When the agent provides a DECK STRUCTURE block listing sections, use those EXACT names as trackers.

DOUBLE TRACKER (sub-section tracker):
When a section from the executive summary is itself a multi-step topic (e.g. "Our Approach" has 4 phases, or "Implementation Plan" has 3 stages), the detail slides within that section should carry BOTH:
1. "sectionTracker" — the main section label (e.g. "2. Our Approach") — same for all slides in this section
2. "subSectionTracker" — a secondary label for the sub-step (e.g. "Phase 1: Discovery", "Phase 2: Design")
The sub-section tracker appears as a grey box next to the main maroon tracker.
- Only add subSectionTracker when a section has multiple detail slides that each represent a distinct sub-step
- Format: very short label (e.g. "Phase 1", "Discovery", "Pillar A") — max ~15 chars, 1-3 words
- Do NOT add subSectionTracker if a section has only one slide
- Example: exec summary point "3. Approach" breaks into 3 phases →
  slide A: sectionTracker "3. Approach", subSectionTracker "Phase 1: Discover"
  slide B: sectionTracker "3. Approach", subSectionTracker "Phase 2: Define"
  slide C: sectionTracker "3. Approach", subSectionTracker "Phase 3: Deliver"

RULES:
- "add element" (bullet, text) = edit_slide (NOT create)
- "rename/relabel/update trackers/sections/subsections only" = update_trackers (NOT edit_slide)
- "create N slides" = output ALL steps (up to 30 max)
- INDEXING: 0-based internally. "slide 1" = index 0
- Use separate fields: title, subtitle, instruction, facts, sources — do not merge them into one combined block
- EACH step referencing slides MUST have contextSlides/referenceSlides with exact indices (up to 5)
- Reference items by position (pillar 1, item 2, first bullet, etc.) - NEVER invent names
- AUTO COVER: When creating a new deck from scratch (empty deck or no cover exists) AND the user requests 3 or more slides, ALWAYS add a cover slide as the FIRST step (templateId: "cover", position: "start"). For 1-2 slide requests, do NOT add a cover — just create the requested content slides directly.
- Greetings, thanks, bye, and other conversational messages must use "answer_question"

DECK STRUCTURE & STORYTELLING (think like a senior consulting partner):
- PYRAMIDAL STRUCTURE: Lead with the answer/governing thought. The structure after the cover depends on the REQUEST — do NOT default to a proposal format. Match the deck structure to what the user actually asked for.
- FOR LARGE DECKS (7+ slides or when SECTION TRACKERS are provided): Cover → [optional Executive Summary (ONE slide, 2-5 key themes, template: executiveSummary)] → Body Slides → Wrap-up. IMPORTANT: If the prompt already contains an executive summary, table of contents, deck overview, section preview, or any tracking/overview slide, do NOT add another — just pick the right template for the existing one. When the prompt says the slide list is complete, add ONLY the cover and pick templates — no new slides of any kind. In AGENT MODE, NEVER add an executive summary — the agent's slide list is final.
- FOR SMALL DECKS (≤6 slides or when NO section trackers are provided): Cover → Content Slides → Closing. No executive summary — go straight to content.
` +
/* SECTION DIVIDERS (deck structure) — commented out
'- SECTION DIVIDERS (templateId "sectionDivider"):\n' +
'  - Only add a sectionDivider slide when a section contains 5 or more body slides. Smaller sections do NOT need a divider — the sectionTracker label is sufficient.\n' +
'  - Place each sectionDivider IMMEDIATELY BEFORE the first body slide of its section (after the previous section\'s last slide).\n' +
'  - There must be exactly ONE sectionDivider per qualifying section — never duplicate, never omit for qualifying sections.\n' +
'  - The sectionDivider instruction should contain the section name matching the sectionTracker label (e.g. "2. Financials").\n' +
'  - Do NOT add sectionDividers for the first section if it directly follows an executive summary (the exec summary already introduces it).\n' +
'  - Exception: if the user explicitly asks for section separators/dividers, include them for all sections regardless of size.\n' +
*/
`- PARENT-CHILD GROUPING: When there are N key points (e.g., 3 pillars, 4 strategies), create a summary/overview slide FIRST that names all N, then one detail slide per point. The overview slide is the "parent" and the detail slides are its "children".
  Example: "3 Growth Pillars" overview slide → Pillar 1 detail → Pillar 2 detail → Pillar 3 detail
- ONE MESSAGE PER SLIDE: Never crowd a slide with multiple themes. Each slide makes exactly one point. If content is too dense, split into multiple slides.
- FLOW: Every slide must logically connect to the next. No orphan slides. The reader should feel a seamless narrative arc tailored to the topic.
- WHITE SPACE IS GOOD: Prefer more slides with clean, focused content over fewer slides crammed with information.
- TEMPLATE VARIETY: Slides within the same section MUST use DIFFERENT templates to avoid visual monotony. If a section has 3 slides about market data, DON'T use barChartExhibit for all 3 — vary between barChartExhibit, twoColumnExhibit, statFocusExhibit, etc. Pick the template that best fits each slide's specific content type.
- CLOSING SLIDE: The last slide should match the content — a summary, key takeaways, or synthesis. Do NOT always default to "next steps" or "action plan" — only include those if the request is genuinely about a proposal or plan that warrants them.

STEP FIELDS — STRUCTURED OUTPUT (CRITICAL):
Each step may include these separate fields. Do NOT merge them into one combined block.

- action: the operation (create_slide, edit_slide, delete_slide, switch_template, update_trackers, reorder_slides, answer_question)
- slideIndex: (REQUIRED for edit_slide and delete_slide) 0-based index of the slide to modify. Slide 1 = 0, Slide 7 = 6.
- templateId: which template to use
- position: where to place the slide
- title: for cover slides — short noun-phrase deck title (3-8 words, no verbs). For body slides — 8-12 word business insight with a verb, makes a strategic claim
- subtitle: reinforcing sub-headline — 2-6 word noun phrase, no verbs. Must differ from sectionTracker.
- instruction: the slide body content, user-provided wording, or core directive
- facts: array of supporting evidence, data points, or proof points needed to populate the slide
- sources: array of backing references for externally sourced facts (each: {label, url, note})
- layoutGuidance: for freestyle — describes the logical content shape
- contextSlides: array of 0-based slide indices to reference
- targetSlides: array of 0-based slide indices changed by this step; for single edit, usually [slideIndex]
- referenceSlides: array of 0-based slide indices read but not directly changed
- contextFromStep: step index whose output this step depends on
- sectionTracker: section label for navigation (e.g., "1. Market Context")
- subSectionTracker: sub-section label (e.g., "Phase 1")
- update_trackers steps: set slideIndex plus sectionTracker/subSectionTracker. Keep instruction short and do not request HTML regeneration.
- searchQuery: precise search query for slide-specific data
- searchGoal: what the search must retrieve (use alongside searchQuery)
- fromIndex / toIndex: 0-based indices for a single reorder_slides move. Use null for all other actions.
- orderedSlideIndices: 0-based desired order for reorder_slides. Use null for all other actions.

Field separation rules:
- "title" and "subtitle" are SEPARATE from "instruction" — do not embed TITLE:/SUBTITLE: markers in instruction
- "facts" contains supporting evidence separate from the user's content in "instruction"
- "sources" contains references separate from facts
- If the user provides explicit content, preserve it exactly in "instruction"; put additional evidence in "facts"

TITLES AND SUBTITLES TELL THE STORY (CRITICAL):
Every create_slide step MUST have both "title" and "subtitle" as non-empty strings. NEVER leave them empty, null, or omit them.

Cover title: Short noun-phrase deck title (3-8 words). No verbs, no full sentences. Think report cover page (e.g. "Digital Transformation Strategy 2026", "GCC Market Entry Assessment").
Body slide title: 8-12 word business insight with a verb. Makes a strategic claim about the slide's content.
Subtitle (all slides): 2-6 word noun phrase. Reinforces the title with a category or framing. The subtitle must NOT duplicate the sectionTracker — they serve different purposes (subtitle = thematic framing visible on the slide; sectionTracker = navigation tab label).

Titles and subtitles must be self-sufficient and readable on their own. If someone reads only the title and subtitle of each slide in sequence, they should understand the full story of the deck.

- BAD: title "Market Overview", subtitle "Saudi Arabia" (labels, not a story)
- BAD: title "", subtitle "" (empty fields — NEVER do this)
- BAD: subtitle "4. Applications", sectionTracker "4. Applications" (duplicated — subtitle must differ from tracker)
- GOOD: title "Demand is recovering, but growth remains concentrated in two segments", subtitle "Recovery Analysis"
- GOOD: subtitle "Modern Applications", sectionTracker "4. Applications" (different framing, no duplication)
- GOOD sequence: "Iraq is a $12B untapped market" -> "Three entry paths with different risk profiles" -> "Phased approach minimizes risk"

When the agent provides a SLIDE TITLE in the instruction, use it as the title field. Do not replace it with a generic label.

SELF-CHECK: Before returning, verify every body create_slide step has a non-empty "title" containing a business insight with a verb. Cover titles must be short noun-phrase deck titles (3-8 words, no verbs). Fix any empty or generic titles.

CROSS-SLIDE COHERENCE (CRITICAL — slides are generated independently in parallel):
Each slide is built by a separate AI call that sees ONLY its own instruction (+ any contextSlides). Slides do NOT see each other's content during generation. YOU are the only one who sees the whole picture, so YOU must ensure coherence:

1. BAKE SHARED DATA INTO EVERY INSTRUCTION: If slide 3 lists "Top 5 opportunities: A, B, C, D, E" and slides 8-12 detail each one, you MUST name the EXACT opportunity in each detail slide's instruction. Do NOT say "detail the first opportunity" — say "detail Opportunity A: [specific name/description]". The sub-agent for slide 8 has NO idea what slide 3 said unless you tell it.

2. USE contextFromStep FOR DEPENDENT SLIDES: When a detail slide MUST match a summary slide's content, add "contextFromStep": N (the step index of the summary). This injects the summary slide's HTML into the detail slide's context so it can read the exact items.

3. USE EXECUTION GROUPS FOR DEPENDENCIES: Put the summary/overview slide in an earlier group so it's created FIRST. Then detail slides in a later group can reference it via contextFromStep.
   Example: "groups": [[0, 1], [2, 3, 4, 5, 6]] — cover + exec summary first, then all body slides.
   When detail slides need to reference the overview: "groups": [[0], [1], [2, 3, 4, 5]] — cover first, then overview, then details that reference it.

4. CONSISTENT TERMINOLOGY: If you name something "Digital Transformation" in the overview instruction, use EXACTLY "Digital Transformation" in detail slide instructions — not "Digital Innovation" or "Tech Modernization".

5. NUMBERS AND DATA POINTS: When specific numbers appear in one slide (e.g., "$4.2B market size"), repeat the EXACT same number in related slides. Don't let parallel sub-agents invent different figures.

6. SEARCH GROUNDING — HOW IT WORKS:
You may be called with router inline search enabled or disabled. Check "Router inline search policy" in the current state.
When router inline search is enabled, your web search during planning gives YOU rich context for building the plan. The slide generation models that execute each step receive:
  (a) The facts[] and sources[] you include in each step (primary grounding data)
  (b) OPTIONAL: Raw, detailed per-step search results — triggered ONLY when you set searchQuery + searchGoal
Because each step sees only its own facts[] (not your full search context), include ALL relevant facts for each step.
When router inline search is disabled but slide execution search is available, set searchQuery + searchGoal for slides that need external, current, or verified facts.
When neither router nor slide execution search is available, do not invent current facts; ask a clarification question if current evidence is required.

7. SAME-FORMAT FREESTYLE SLIDES:
When the router judges that multiple NEW slides should repeat the same visual format, it MUST treat them as a dependent slide family, not fully parallel slides.
For freestyle slides:
- Create the FIRST slide in the family in its OWN group (e.g., groups: [[0], [1], [2,3,4], [5]])
- Set each later slide's "contextFromStep" to that FIRST slide's exact step index
- Put the dependent slides in a LATER group — they MUST NOT be in the same group as the slide they reference. This is critical: contextFromStep only works if the referenced step has already finished generating.
- In each later slide's "instruction", explicitly write: "Match the exact format/structure of the referenced slide from step N"
- Do not use vague phrases like "same as above"
- Do not rely on layoutGuidance alone when exact format reuse is needed
Apply this whenever slides are repetitive by nature, such as one-slide-per-pillar, one-slide-per-country, one-slide-per-workstream, one-slide-per-initiative, or repeated case-study/detail pages.
Example grouping for a 5-slide deck where slides 1-4 should match:
  groups: [[0], [1], [2,3,4]]  — step 0 is cover, step 1 is the format leader, steps 2-4 reference step 1
 
SLIDE POSITIONING:
- POSITION values: "start", "end", {"after_slide": N}, "after_previous"
- Title/Cover slides MUST use position: "start"
- Content slides use "end" or "after_previous"
- Multiple slides: first gets specific position, rest use "after_previous"

INLINE SEARCH BEHAVIOR:
If router inline search is enabled, you have a web search tool. When the user's topic requires current data, external facts, or named entities:
- Make MULTIPLE separate search calls for different entities or aspects — do NOT try to cover everything in one broad query
- Search for each major entity, company, or topic area SEPARATELY to get thorough, targeted results
- Use targeted queries with "latest", "most recent", or date ranges (e.g., "April 2026")
- Verify you have the NEWEST information for each entity before finalizing your plan
- For a topic covering 3+ entities (e.g., "compare AI labs"), make at least one search per entity
- For structural edits, reformatting, tracker updates, template switches, or topics where deck/document context is sufficient, skip searching entirely
If router inline search is disabled, do not behave as if you searched. Use the deck/documents provided, and use per-step searchQuery + searchGoal only when slide execution needs fresh facts.

SEARCH QUERY STRATEGY — CRITICAL:
Do NOT restrict every query to site: prefixes. site: queries only match the exact domain and miss subdomains, developer portals, release notes, and changelog pages.

Use a THREE-STEP search approach:

Step 1 — LANDSCAPE DISCOVERY (always do this first):
  Before searching for specific entities, run 1-2 broad landscape queries to discover WHO the current players are. Do NOT rely on your training data to know which companies, products, or entities are relevant — the landscape may have changed.
  Examples:
    "top frontier AI models April 2026" (discovers current players)
    "latest major LLM releases 2026" (discovers recent launches)
    "leading companies in [topic] 2026" (discovers current market leaders)
    "ongoing armed conflicts 2026" (discovers current geopolitical state)
  This step lets the search engine tell you what is current, rather than you guessing from training data.

Step 2 — ENTITY DEEP-DIVE (broad queries per entity):
  For each entity discovered in Step 1, search WITHOUT site: restriction (e.g., "latest xAI Grok model release 2026"). This catches developer docs, third-party coverage, and subdomains (e.g., docs.x.ai vs x.ai).

Step 3 — OFFICIAL VERIFICATION (optional, targeted):
  Follow up with site-specific queries only when you need to verify a specific claim against the official source.

Additional rules:
- NEVER skip Step 1 — your training data about "who the players are" may be outdated. A new competitor, model, country, or entity may have emerged since your training cutoff.
- Always include at least one BROAD query (no site: prefix) per major entity to catch what site-specific queries miss
- Developer docs and API release notes often live on separate subdomains (docs.*, api.*, developer.*) — site: queries on the main domain will miss these
- If a broad query surfaces a newer version or release than your site-specific query found, search again to verify it
- Do NOT assume your first search found the latest — always cross-check with at least one differently-phrased query per entity

ROUTER-LEVEL RESEARCH (DEFAULT APPROACH):
When external facts, statistics, market data, named entities, timelines, current events, or benchmarks are needed, the router should research centrally first, then distribute facts to each slide.

Default rule:
- Research what materially improves the deck
- Include key facts directly in the step's "facts" array
- Include relevant backing references in the step's "sources" array
- Keep terminology and numbers identical across related slides
- Prefer a shared research base at the executive-summary level, then reuse it across child slides
- For current or changing topics, research current facts unless the user explicitly asks for a historical cut

PER-STEP SEARCH (searchQuery + searchGoal):
Per-step search triggers a SEPARATE, dedicated web search call that feeds raw results directly to the slide generation model. This is independent from your own search — it runs a fresh query and returns raw, unfiltered results.

PURPOSE: Per-step search should COMPLEMENT your research, not repeat it. Your facts[] contain what you already found. The per-step search should go DEEPER or VERIFY with different queries to catch what you may have missed.

WHEN TO SET searchQuery + searchGoal:
- Slides presenting multiple statistics, percentages, or financial figures
- Detailed comparisons (vendor landscape, market sizing, peer benchmarks)
- Current events with evolving timelines or recent developments
- Specific named entities with recent data the generation model may not have

WHEN YOUR facts[] ARRAY IS SUFFICIENT (no searchQuery needed):
- Cover slides, section dividers, conceptual frameworks
- Slides referencing only 1-2 simple facts already captured in facts[]
- Slides that are purely structural or analytical (no external data)
- Slides where the instruction already contains all needed specifics

WRITING EFFECTIVE searchQuery VALUES:
The searchQuery is used as a web search query by a different model. Write it to DISCOVER information, not echo what you already know.

  CRITICAL RULES:
  - DO NOT put specific facts or names you already found into searchQuery — those are already in facts[]
  - DO frame the query to find the LATEST/MOST RECENT information on the topic
  - DO use phrases like "most recent", "latest", "as of [current month year]", "[month] [year] update"
  - DO ask the query from the perspective of "what might I have missed?"
  - KEEP queries concise and search-engine-friendly (not full sentences)

  BAD: searchQuery without searchGoal
  BAD searchQuery: "AI market" (too vague)
  BAD searchQuery: "OpenAI GPT-5.4 Anthropic Claude Opus 4.6 Gemini 2.5 Pro comparison" (echoes your own findings back)
  GOOD searchQuery: "most recent AI model releases each major lab April 2026"
  GOOD searchQuery: "UAE generative AI market size latest estimates 2025 2026"
  GOOD searchGoal: "Find the most current data for each entity on this slide, including any releases or updates I may have missed"

MANDATORY: Every searchQuery MUST have a paired searchGoal. Steps with searchQuery but no searchGoal may be skipped.

Rules:
- For a typical 6-slide deck on current data, expect 2-4 steps with searchQuery (data-heavy content slides)
- For an edit or restructuring request, expect 0 steps with searchQuery
- AGENT MODE: When the prompt starts with "PRESENTATION CONTENT", do NOT add searchQuery — the agent already embedded data
- Do NOT add searchQuery if the instruction already contains all the specific numbers and data needed
- The user can add or remove per-step search on any step in the plan review UI, so your judgment is a smart default, not a final decision

RESPONSE FORMAT (JSON only):

Example — simple request (no agent, no documents):
{
  "plan": [
    {"action":"create_slide","templateId":"cover","position":"start","title":"Digital Transformation Strategy 2026","subtitle":"Transformation Priorities","instruction":"Digital Transformation Strategy"},
    {"action":"create_slide","templateId":"freestyle","position":"after_previous","title":"Three priorities will drive the majority of near-term value creation","subtitle":"Strategic Priorities","instruction":"3 priorities: 1) modernize core systems, 2) improve growth analytics, 3) automate service workflows","facts":["Core systems modernization accounts for the largest share of operational delays","Commercial teams lack consistent customer-level analytics","Service workflows remain highly manual in three high-volume processes"],"layoutGuidance":"one governing message with 3 priority areas, each supported by one proof point"},
    {"action":"create_slide","templateId":"freestyle","position":"after_previous","title":"A phased rollout minimizes risk while delivering quick wins","subtitle":"Implementation Roadmap","instruction":"Implementation roadmap: 5 key milestones for H2 2026","layoutGuidance":"5 implementation milestones with deliverables and timeline"}
  ],
  "groups": [[0,1,2]],
  "sourceSlides": [],
  "needsStoryline": false,
  "needsReplanning": false
}
Note: title and subtitle are separate fields. facts contains supporting evidence. layoutGuidance describes the content shape — the designer picks the visual treatment.
For image slides, layoutGuidance describes what the AI image model should generate. Use CONSULTING FRAMEWORKS — not generic infographics:
- Value chains, chevron flows, 2×2 matrices, SWOT grids, waterfall charts, pyramids, hub-and-spoke, bridge charts, funnels, Venn diagrams, comparison tables, roadmaps/timelines.
- Be specific: name the axes, label the quadrants, describe the flow direction.

Example — image slide (image-content is the default; only use image-full when user explicitly asks):
{
  "plan": [
    {"action":"create_slide","templateId":"image-content","layoutGuidance":"2x2 matrix — x-axis: implementation complexity (low to high), y-axis: business impact (low to high) — plot 4 initiatives in quadrants with short labels","position":"after_previous","instruction":"initiative prioritization"}
  ]
}

Example — agent mode (cover + one step per body slide, NO executive summary, trackers from [TRACKER] tags):
{
  "plan": [
    {"action":"create_slide","templateId":"cover","position":"start","instruction":"Industry Analysis: SaaS Market 2025"},
    {"action":"create_slide","templateId":"barChartExhibit","position":"after_previous","sectionTracker":"1. Industry Landscape","instruction":"Global market sizing by segment 2022-2025: Enterprise $1.8T (+12%), Consumer $1.4T (+5%), Government $1.0T (+3%)."},
    {"action":"create_slide","templateId":"kpiMetrics","position":"after_previous","sectionTracker":"2. Competitive Dynamics","instruction":"Competitive positioning: Player A 28% share (down from 32%), Player B 22% share (up from 18%), margin pressure across the board."},
    {"action":"create_slide","templateId":"threeCards","position":"after_previous","sectionTracker":"3. Strategic Implications","instruction":"3 priority areas: 1. Product Innovation (invest in AI features), 2. Geographic Expansion (APAC underweight), 3. Pricing Architecture (shift to consumption model)."},
    {"action":"create_slide","templateId":"bullets","position":"after_previous","sectionTracker":"3. Strategic Implications","subSectionTracker":"Product Innovation","contextFromStep":3,"instruction":"Product Innovation deep-dive: current feature gaps, AI integration roadmap, expected uplift in NPS."},
    {"action":"create_slide","templateId":"bullets","position":"after_previous","sectionTracker":"3. Strategic Implications","subSectionTracker":"Geographic Expansion","contextFromStep":3,"instruction":"Geographic Expansion deep-dive: APAC TAM $600B, current penetration 4%, go-to-market via partnerships."},
    {"action":"create_slide","templateId":"bullets","position":"after_previous","sectionTracker":"3. Strategic Implications","subSectionTracker":"Pricing Architecture","contextFromStep":3,"instruction":"Pricing Architecture deep-dive: current per-seat vs proposed consumption-based, revenue impact modeling."}
  ],
  "groups": [[0],[1,2,3],[4,5,6]],
  "sourceSlides": [],
  "needsStoryline": false,
  "needsReplanning": false
}
Note: groups [[0],[1,2,3],[4,5,6]] = cover alone → body slides in parallel → detail slides reference overview via contextFromStep:3

Example — asking clarification questions (ONLY when criteria above are met):
{
  "questions": [
    {"question": "What kind of deck should I create?", "options": ["Business update — performance, results, risks", "Strategy deck — market context, recommendations", "Project proposal — objectives, approach, timeline", "Training / educational — concepts, examples, takeaways"]},
    {"question": "How many slides do you need?", "options": ["3-5 (concise brief)", "6-10 (standard deck)", "10+ (comprehensive)"]}
  ]
}
CRITICAL: When asking questions, return ONLY the "questions" array — do NOT wrap questions in a "plan" with "answer_question". The "questions" key triggers the structured card UI with clickable options.

REMEMBER:
- DOCUMENTS/AGENT = rich context → extract and include ALL research (numbers, findings, context, explanations) in each step's instruction
- In agent mode: YOU choose templates, agent provides content + research only
- NEVER drop or summarize research — pass the full Instruction + Data Points through to the step instruction
- SLIDES: You can't see content (only titles) → use contextSlides, reference by position`;
  return applyPromptOverride(settings, 'router.system', defaultPrompt);
}

// ============================================
// TIER 1: QUICK CLASSIFIER (unified entry point)
// ============================================

const CLASSIFIER_SYSTEM_PROMPT = `You are a slide-editing request classifier. Given a user prompt, the currently active slide info, and a deck overview, classify the request.

Return ONLY valid JSON with these fields:
- scope: "single_slide" | "multi_slide" | "full_deck" | "qa"
- action: "create" | "edit" | "improve" | "delete" | "switch_template" | "answer"
- targetSlides: array of 0-indexed slide indices the action applies to (Slide 1 = index 0, Slide 3 = index 2, etc.)
- needsPlanner: boolean - true if this needs multi-step planning (multi-slide creation, complex restructuring)
- needsSearch: boolean - true if the request needs current web data/facts/statistics
- searchQuery: string or null - if needsSearch, a concise search query
- templateId: string or null - if a specific template/layout was requested
- instruction: string - the core instruction for execution

Rules:
- Greetings, thanks, and conversational messages: scope "qa", action "answer", needsPlanner false
- Simple edits to the active slide: scope "single_slide", needsPlanner false
- Creating a new deck from scratch: scope "full_deck", action "create", needsPlanner true
- Adding multiple slides: scope "multi_slide", action "create", needsPlanner true
- Questions about slides or content: scope "qa", action "answer", needsPlanner false
- Requests mentioning current data, latest, or recent: needsSearch true
- Use 0-based indices: Slide 1 = index 0, Slide 3 = index 2
- CROSS-SLIDE: If the user says "make slide X like slide Y" or otherwise targets a DIFFERENT slide than the active slide, set needsPlanner true (the planner can target specific slides by index)`;

/**
 * Tier 1 Quick Classifier -- lightweight intent detection.
 * Runs on the classifier model (~1-2s) to determine scope and whether the
 * full Tier 2 planner is needed.
 *
 * @param {string} userPrompt
 * @param {Object} context - { slides, activeSlideIndex, activeSlide }
 * @param {Object} settings - must include classifierModel (or fastModel fallback)
 * @returns {Promise<Object>} classification result
 */
export async function classifyRequest(userPrompt, context, settings) {
  const {
    slides = [],
    activeSlideIndex = -1,
    activeSlide = null,
  } = context;

  const classifierModel = settings.classifierModel || settings.fastModel || 'pwc:openai.gpt-5.4-mini';
  const classifierSettings = {
    ...settings,
    model: classifierModel,
    maxTokens: 300,
    temperature: 0,
  };

  const slideCount = slides.length;
  const activeInfo = activeSlide
    ? `ACTIVE SLIDE: Slide ${activeSlideIndex + 1} of ${slideCount} - "${activeSlide.title || 'Untitled'}"${activeSlide.templateId ? ` (template: ${activeSlide.templateId})` : ''}`
    : `NO ACTIVE SLIDE (${slideCount} slides in deck)`;

  const deckOverview = slideCount > 0
    ? `DECK: ${slides.map((s, i) => `${i + 1}. ${s.title || 'Untitled'}${i === activeSlideIndex ? ' [ACTIVE]' : ''}`).join(', ')}`
    : 'DECK: Empty (no slides yet)';

  const userMessage = `${activeInfo}\n${deckOverview}\n\nUSER: ${userPrompt}`;

  try {
    const raw = await callWithModelFallback(
      classifierSettings,
      CLASSIFIER_SYSTEM_PROMPT,
      userMessage,
      { role: 'text' }
    );

    const jsonMatch = raw?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Classifier] No JSON in response, falling back to planner');
      return {
        scope: 'full_deck',
        action: 'create',
        targetSlides: [],
        needsPlanner: true,
        needsSearch: false,
        searchQuery: null,
        templateId: null,
        instruction: userPrompt,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('[Classifier] Result:', parsed);
    return {
      scope: parsed.scope || 'single_slide',
      action: parsed.action || 'edit',
      targetSlides: Array.isArray(parsed.targetSlides) ? parsed.targetSlides : [],
      needsPlanner: !!parsed.needsPlanner,
      needsSearch: !!parsed.needsSearch,
      searchQuery: parsed.searchQuery || null,
      templateId: parsed.templateId || null,
      instruction: parsed.instruction || userPrompt,
    };
  } catch (err) {
    console.error('[Classifier] Error, falling back to planner:', err);
    return {
      scope: 'full_deck',
      action: 'create',
      targetSlides: [],
      needsPlanner: true,
      needsSearch: false,
      searchQuery: null,
      templateId: null,
      instruction: userPrompt,
    };
  }
}

// ── Unified Triage System Prompt ──
export const TRIAGE_SYSTEM_PROMPT = `You are a presentation assistant triage agent. Given a user prompt and the current deck state, return a JSON classification.

Return ONLY valid JSON with these fields:
- scope: "qa" | "direct" | "plan"
- needsSearch: boolean - true if the content requires current/real-time data
- needsStoryline: boolean - true if the request involves editing across the deck or needs awareness of the narrative flow
- searchQuery: string or null - a concise search query if needsSearch is true
- isTemplateSwitch: boolean - true if user wants to switch the slide template/layout
- templateId: string or null - the target template if switching
- targetSlides: array of 0-indexed slide indices affected (Slide 1 = index 0)
- referenceSlides: array of 0-indexed slide indices used as style/content/structure references
- contextLevel: "active_slide" | "reference_slides" | "deck_digest" | "full_text_deck" - how much text-only deck context the router should receive
- instruction: string - the core instruction for execution

SCOPES:
- "qa": The user is asking a question or making conversation, NOT requesting slide changes.
  Examples: "what does slide 3 say?", "thanks", "hello", "how many slides do I have?"
- "direct": A single-slide action on the active slide — edit, improve, fill, populate, or template switch. No multi-step planning needed. The request must ONLY involve the active slide with NO references to other slides.
  Examples: "make this more concise", "add a third column", "switch to comparison template", "fix the title", "fill this slide with X", "populate this with Y", "add content about Z"
  IMPORTANT: If an active slide exists (even if empty), and the user wants to fill, populate, or add content to THAT slide, use "direct" — NOT "plan".
  EXCEPT: If the request references other slides (e.g., "format like slide 2", "use content from slide 3", "match the previous slide"), use "plan" instead — the direct path only has context of the active slide.
- "plan": Multi-slide creation, deck restructuring, complex operations, or any request that needs the full router.
  Examples: "create 6 slides about AI", "restructure the deck", "add 3 more slides on risks", "delete slides 2-4"
  Only use "plan" when the user wants MULTIPLE new slides or cross-slide operations.

isTemplateSwitch rules:
- TRUE only when user explicitly asks to SWITCH or CHANGE the template type (e.g. "switch to comparison", "change to timeline")
- FALSE for content edits like "add a column", "remove a row", "make it 3-column"
- FALSE for styling changes like "make it bold", "change colors"
- When in doubt, set false

needsStoryline rules:
- TRUE when the request involves creating a multi-slide deck, restructuring the deck, or editing with awareness of the narrative arc
- TRUE for "edit the deck", "restructure", "reorder slides", "add context slides", or any cross-slide narrative operation
- FALSE for single-slide edits, template switches, Q&A, or isolated content changes
- When in doubt, set false

contextLevel rules:
- "active_slide": isolated active-slide edit with no cross-slide dependency
- "reference_slides": user asks to match, copy, compare, expand, or use another slide/page as a reference
- "deck_digest": normal deck planning, add slides, tracker changes, or section-aware requests
- "full_text_deck": whole-deck rewrite/restructure/MECE/storyline work where slide-by-slide text is needed
- If the request names another slide/page, put that 0-based index in referenceSlides

Additional rules:
- Greetings, thanks, conversational → scope "qa"
- Simple edits to active slide → scope "direct"
- Active slide exists (even if [empty]) + user wants to fill/populate/edit it → scope "direct"
- Creating new decks, adding multiple slides → scope "plan"
- Requests mentioning current data, latest, recent → needsSearch true
- Use 0-based indices: Slide 1 = index 0, Slide 3 = index 2
- CROSS-SLIDE: Any request that references, targets, or compares OTHER slides (not just the active one) → scope "plan". Examples: "make slide X like slide Y", "format this like slide 2", "use the content from slide 3", "apply this format to all slides", "edit slides 2-4", "make the other slides match", "do this to the rest of the deck", "update all content slides", "copy the layout from the first slide"
- EMPTY DECK (0 slides) + creation request → scope "plan"
- If no active slide and request is not a question → scope "plan"

ATTACHED DOCUMENTS rules:
- When ATTACHED DOCUMENTS are listed, the user has uploaded files whose content is available.
- "create/build/make a presentation/deck from this/these" + attached docs → scope "plan"
- "summarize this file on the slide" + active slide + attached docs → scope "direct"
- "fill this slide with data from the document" + active slide + attached docs → scope "direct"
- Creating MULTIPLE slides from attached docs → scope "plan"
- Filling/editing a SINGLE active slide using attached docs → scope "direct"

CHAT HISTORY rules:
- When RECENT CHAT is provided, use it to resolve references like "this topic", "that", "it", "the same", etc.
- If the user says "make a slide about this" after discussing a topic in chat, infer the topic from the conversation — do NOT ask for clarification.
- Include the resolved topic in the "instruction" field so downstream steps have full context.`;

/**
 * Unified Triage -- replaces both the Tier 1 classifyRequest and Tier 2 mini-classifier.
 * Always runs, even on empty decks. Returns scope, search needs, template switch detection,
 * and optional clarifying questions.
 *
 * @param {string} userPrompt
 * @param {Object} context - { slides, activeSlideIndex, activeSlide, attachedFiles }
 * @param {Object} settings - must include classifierModel (or fastModel fallback)
 * @returns {Promise<Object>} triage result
 */
export async function triageRequest(userPrompt, context, settings) {
  const {
    slides = [],
    activeSlideIndex = -1,
    activeSlide = null,
    deckContextDigest = null,
    attachedFiles = [],
    chatHistory = [],
  } = context;

  const triageModel = settings.classifierModel || settings.fastModel || 'pwc:openai.gpt-5.4-mini';
  const triageSettings = {
    ...settings,
    model: triageModel,
    maxTokens: 600,
    temperature: 0,
  };

  const slideCount = slides.length;
  const activeInfo = activeSlide
    ? `ACTIVE SLIDE: Slide ${activeSlideIndex + 1} of ${slideCount} - "${activeSlide.title || 'Untitled'}"${activeSlide.templateId ? ` (template: ${activeSlide.templateId})` : ''}${activeSlide.html && activeSlide.html.length > 50 ? ' [has content]' : ' [empty]'}`
    : `NO ACTIVE SLIDE (${slideCount} slides in deck)`;

  const deckOverview = slideCount > 0
    ? `DECK: ${(deckContextDigest?.slideSummaries || slides).map((s, i) => `${(s.index ?? i) + 1}. ${s.title || 'Untitled'}${s.template ? ` (${s.template})` : ''}${s.sectionLabel ? ` [${s.sectionLabel}]` : ''}${s.subSectionLabel ? ` > ${s.subSectionLabel}` : ''}${(s.index ?? i) === activeSlideIndex ? ' [ACTIVE]' : ''}`).join(', ')}`
    : 'DECK: Empty (no slides yet)';

  const activeDigest = deckContextDigest?.activeSlideContext
    ? `\nACTIVE SLIDE TEXT:\n${deckContextDigest.activeSlideContext.textSummary || '[Empty slide]'}`
    : '';
  const structureDigest = deckContextDigest
    ? `\nDECK DIGEST:\nLayout mix: ${deckContextDigest.layoutSummary || 'none'}\n${deckContextDigest.sectionMap || 'No section trackers set.'}\n${deckContextDigest.storylineSummary ? `Storyline:\n${deckContextDigest.storylineSummary}` : ''}`
    : '';

  const filesInfo = attachedFiles.length > 0
    ? `\nATTACHED DOCUMENTS: ${attachedFiles.map(f => f.fileName || f.name || 'file').join(', ')}`
    : '';

  const trimMsg = (text) => {
    if (text.length <= 600) return text;
    return text.slice(0, 300) + ' ... ' + text.slice(-300);
  };
  const recentChat = chatHistory.length > 0
    ? `\nRECENT CHAT:\n${chatHistory.map(m => `${m.type === 'user' ? 'User' : 'Assistant'}: ${trimMsg(m.content)}`).join('\n')}\n`
    : '';

  const userMessage = `${activeInfo}${activeDigest}\n${deckOverview}${structureDigest}${filesInfo}${recentChat}\n\nUSER: ${userPrompt}`;

  try {
    const systemPrompt = applyPromptOverride(settings, 'triage.system', TRIAGE_SYSTEM_PROMPT);
    recordPromptPayload('triage.system', {
      model: triageModel,
      systemPrompt,
      userPrompt: userMessage,
    });
    const raw = await callWithModelFallback(
      triageSettings,
      systemPrompt,
      userMessage,
      { role: 'text' }
    );

    const jsonMatch = raw?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Triage] No JSON in response, falling back to plan');
      return {
        scope: 'plan',
        needsSearch: false,
        needsStoryline: false,
        searchQuery: null,
        isTemplateSwitch: false,
        templateId: null,
        targetSlides: [],
        referenceSlides: [],
        contextLevel: inferContextLevel(userPrompt, { scope: 'plan' }),
        instruction: userPrompt,
        questions: [],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const scope = ['qa', 'direct', 'plan'].includes(parsed.scope)
      ? parsed.scope
      : 'plan';

    const targetSlides = normalizeSlideIndexArray(parsed.targetSlides, slideCount);
    const parsedReferenceSlides = normalizeSlideIndexArray(parsed.referenceSlides, slideCount);
    const fallbackReferenceSlides = parsedReferenceSlides.length > 0
      ? parsedReferenceSlides
      : parseSlideReferences(userPrompt, slideCount).filter(idx => idx !== activeSlideIndex);
    const contextLevel = normalizeContextLevel(
      parsed.contextLevel,
      inferContextLevel(userPrompt, {
        scope,
        needsStoryline: !!parsed.needsStoryline,
        referenceSlides: fallbackReferenceSlides,
        targetSlides,
      })
    );

    const triageResult = {
      scope,
      needsSearch: !!parsed.needsSearch,
      needsStoryline: !!parsed.needsStoryline,
      searchQuery: parsed.searchQuery || null,
      isTemplateSwitch: !!parsed.isTemplateSwitch,
      templateId: parsed.templateId || null,
      targetSlides,
      referenceSlides: fallbackReferenceSlides,
      contextLevel,
      instruction: parsed.instruction || userPrompt,
      questions: [],
    };

    console.groupCollapsed(`[Triage] scope=${triageResult.scope} | search=${triageResult.needsSearch} | model=${triageModel}`);
    console.log('INPUT', { model: triageModel, slideCount, activeSlide: activeSlide?.title || null, userPrompt: userPrompt.slice(0, 200) });
    console.log('FULL INPUT MESSAGE', userMessage);
    console.log('OUTPUT', triageResult);
    console.log('RAW RESPONSE', raw);
    console.groupEnd();

    return triageResult;
  } catch (err) {
    console.error('[Triage] Error, falling back to plan:', err);
    return {
      scope: 'plan',
      needsSearch: false,
      needsStoryline: false,
      searchQuery: null,
      isTemplateSwitch: false,
      templateId: null,
      targetSlides: [],
      referenceSlides: [],
      contextLevel: inferContextLevel(userPrompt, { scope: 'plan' }),
      instruction: userPrompt,
      questions: [],
    };
  }
}

/**
 * AI-powered router using a fast model (Gemini Flash by default)
 * Replaces rule-based template matching with AI understanding
 * @param {string} userPrompt - User's request
 * @param {Object} context - Current context (slideCount, currentSlideIndex, etc.)
 * @param {Object} settings - API settings including fastModel
 * @returns {Promise<Object>} Routing result with intent, template, and context needs
 */
export async function aiRouteRequest(userPrompt, context, settings) {
  if (!userPrompt || typeof userPrompt !== 'string') {
    throw new Error('aiRouteRequest requires a non-empty string prompt');
  }
  const {
    slideCount = 0,
    currentSlideIndex = -1,
    slideSummaries = [],      // Array of {index, title, pendingComments}
    storylineSummary = '',    // Brief storyline description
    layoutSummary = '',       // e.g., "bullets:3, cards:2"
    sectionMap = '',
    activeSlideContext = null,
    deckContextDigest = null,
    deckStructure = null,
    contextLevel = CONTEXT_LEVELS.DECK_DIGEST,
    referenceSlides = [],
    targetSlides = [],
    triageNeedsSearch = false,
    triageSearchQuery = null,
    activeFlow = null,
    parallelBatchSize = 3,    // Max parallel steps per group (from settings.parallelSlideGeneration)
    // FULL document content - router makes all decisions directly
    hasDocumentsAttached = false,
    documentContent = null,
    // Pending images to analyze with this query
    pendingImages = null,
    // Optional: use big model for complex requests
    useBigModel = false,
    // Slides explicitly referenced in the prompt (e.g., "slide 3", "page 5")
    referencedSlides = null,
    // When true, agent is driving slide creation — skip auto-cover, single slide per call
    agentMode = false,
    // When true, user selected "Image-based" mode — prefer image-content templates
    preferImageSlides = false,
    // Panel scope: 'slide' = user focused on current slide, 'deck' = full deck operations
    contextMode = 'deck',
    chatHistory = [],
  } = context;
  const normalizedContextLevel = normalizeContextLevel(contextLevel || deckContextDigest?.contextLevel);
  const normalizedReferenceSlides = normalizeSlideIndexArray(referenceSlides, slideCount);
  const normalizedTargetSlides = normalizeSlideIndexArray(targetSlides, slideCount);

  // Get router model - use big model if requested, otherwise unified routerModel
  const defaultRouterModel = 'pwc:openai.gpt-5.4';
  const bigModel = settings.model || 'pwc:bedrock.anthropic.claude-opus-4-7';

  // Unified router: single model for all routing (chatRouterModel kept for backward compat)
  const effectiveRouterModel = useBigModel ? bigModel
    : (settings.routerModel || settings.chatRouterModel || defaultRouterModel);
  const effectiveReasoningEffort = settings.routerReasoningEffort || settings.chatRouterReasoningEffort || 'medium';
  const effectiveMaxTokens = !agentMode
    ? (settings.chatRouterMaxTokens || 16384)
    : (settings.routerMaxTokens || 16384);
  const routerSearchToggleEnabled = !agentMode
    ? coerceBooleanSetting(settings.chatRouterSearchEnabled, true)
    : coerceBooleanSetting(settings.routerSearchEnabled, false);
  const effectiveSearchEnabled = coerceBooleanSetting(settings.searchEnabled, true) && routerSearchToggleEnabled;
  const routerSearchMode = normalizeRouterSearchMode(settings.routerSearchMode || settings.chatRouterSearchMode);

  console.log('[Router Search]', 'Toggle:', {
    agentMode,
    effectiveSearchEnabled,
    routerSearchMode,
    globalSearchEnabled: settings.searchEnabled,
    chatRouterSearchEnabled: settings.chatRouterSearchEnabled,
    routerSearchEnabled: settings.routerSearchEnabled,
  });

  const routerModelRef = useBigModel ? bigModel : effectiveRouterModel;
  const { providerId: routerProviderId, modelName: routerModelName } = parseModelRef(routerModelRef);

  // Check that an API key is available for the router model's provider
  const routerProviderObj = findProvider(settings, routerProviderId);
  if (!routerProviderObj?.apiKey) {
    throw new Error(`API key for provider "${routerProviderId}" is required for the router model "${routerModelName}". Please add it in Settings.`);
  }

  const routerSettings = {
    ...settings,
    model: routerModelRef,
    temperature: 0.1,  // Very low temperature for consistent JSON
    maxTokens: effectiveMaxTokens,
    reasoningEffort: effectiveReasoningEffort,
  };

  // Router-only consulting-skill injection. We attach `_skillId` to the request
  // body so the backend AI proxy can prepend the skill's markdown + clarify rule
  // as the router's system prompt. Other call paths (slide render, edits,
  // transforms, validation) never set `_skillId`, so they are not affected.
  const selectedSkillId = typeof settings?.selectedSkillId === 'string' && settings.selectedSkillId.trim()
    ? settings.selectedSkillId.trim()
    : null;
  if (selectedSkillId) {
    routerSettings._skillId = selectedSkillId;
    console.log('[skills] router attaching skillId=%s model=%s', selectedSkillId, routerModelRef);
  }

  // Detect whether the router model supports the Responses API. GPT/o-series can
  // use it with or without web_search_preview; the search policy decides tools.
  const isGPTRouter = routerModelName.includes('gpt-') || routerModelName.includes('o3') || routerModelName.includes('o4-');
  const canUseRouterResponsesAPI = isGPTRouter && settings.searchEndpoint && !agentMode;
  const routerSearchPolicy = getRouterSearchPolicy(userPrompt, {
    mode: routerSearchMode,
    searchEnabled: effectiveSearchEnabled,
    triageNeedsSearch,
    triageSearchQuery,
    hasDocumentsAttached,
  });
  const canUseInlineSearch = canUseRouterResponsesAPI && routerSearchPolicy.allowSearch;
  console.log('[Router Search]', 'Policy:', {
    canUseRouterResponsesAPI,
    canUseInlineSearch,
    isGPTRouter,
    hasSearchEndpoint: !!settings.searchEndpoint,
    searchEnabled: effectiveSearchEnabled,
    agentMode,
    ...routerSearchPolicy,
  });

  // Build compact slide list — index, title, template, section labels. Mark the current slide.
  const slideList = slideSummaries.length > 0
    ? slideSummaries.map(s => {
        const isCurrent = s.index === currentSlideIndex;
        let line = `  ${s.index}: "${s.title}" (${s.template || 'custom'})`;
        if (s.sectionLabel) line += ` [${s.sectionLabel}]`;
        if (s.subSectionLabel) line += ` > ${s.subSectionLabel}`;
        if (isCurrent) line += '  <- CURRENT SLIDE';
        if (s.pendingComments && s.pendingComments.length > 0) {
          line += ` [COMMENTS: ${s.pendingComments.join('; ')}]`;
        }
        return line;
      }).join('\n')
    : '  (no slides yet)';
  const hasCoverSlide = slideSummaries.some(s => s.template === 'cover');

  // Build document section with FULL content (router decides everything)
  const documentSection = hasDocumentsAttached && documentContent
    ? `\n=== ATTACHED DOCUMENTS (FULL CONTENT) ===
${documentContent}
=== END DOCUMENTS ===\n`
    : '\nDOCUMENTS ATTACHED: NO\n';

  // Build referenced slides section - tells router which slides user mentioned
  const referencedSlidesSection = referencedSlides && referencedSlides.length > 0
    ? `\nREFERENCED SLIDES (user mentioned these - you MUST include their indices in contextSlides):
${referencedSlides.map(r => `  - Index ${r.index} = Page ${r.index + 1}: "${r.title || 'untitled'}"`).join('\n')}
`
    : '';

  const searchAvailable = !!(coerceBooleanSetting(settings.searchEnabled, true) && settings.searchEndpoint && settings.searchApiKey);

  console.log('[Router Search]', 'Prompt hint "Web search available":', searchAvailable ? 'YES' : 'NO',
    '(custom search endpoint:', searchAvailable,
    '| router inline search allowed:', !!canUseInlineSearch, ')');

  // ── Condense agent-generated prompts for the router ──
  // Agent prompts contain verbose per-slide instructions (~30-50K chars) that overwhelm the router.
  // The router only needs: flow (order, types, trackers), data points, user intent, and guidance.
  // Full instructions are stored separately and merged back into the plan after routing.
  let routerPrompt = userPrompt;
  let fullInstructionMap = null; // Map<slideNum, fullInstruction> for post-routing merge

  const isAgentPrompt = userPrompt.includes('--- SLIDE ') && userPrompt.includes('PRESENTATION CONTENT');
  if (isAgentPrompt && userPrompt.length > 8000) {
    fullInstructionMap = new Map();
    const condensedSections = [];
    const slidePattern = /--- SLIDE (\d+): (.*?) ---([^]*?)(?=--- SLIDE \d|--- CLOSING|={5,}INSTRUCTIONS|$)/g;
    let match;
    while ((match = slidePattern.exec(userPrompt)) !== null) {
      const slideNum = parseInt(match[1]);
      const slideTitle = match[2].trim();
      const body = match[3];

      // Extract structured fields
      const trackerMatch = body.match(/\[TRACKER:\s*([^\]]+)\]/);
      const subTrackerMatch = body.match(/\[SUB_TRACKER:\s*([^\]]+)\]/);
      const keyMsgMatch = body.match(/Key Message:\s*(.+)/);
      const instrMatch = body.match(/Instruction:\s*([\s\S]*?)(?=\nData Points:|$)/);
      const dataMatch = body.match(/Data Points:\s*([\s\S]*?)$/);

      // Store full instruction for post-routing merge (this is the bulk of the text)
      const fullInstruction = instrMatch?.[1]?.trim() || '';
      fullInstructionMap.set(slideNum, fullInstruction);

      // Condensed version: title + tracker + key message + content for exec overview
      let condensed = `--- SLIDE ${slideNum}: ${slideTitle} ---`;
      if (trackerMatch) condensed += `\n[TRACKER: ${trackerMatch[1]}]`;
      if (subTrackerMatch) condensed += `\n[SUB_TRACKER: ${subTrackerMatch[1]}]`;
      if (keyMsgMatch) condensed += `\nKey Message: ${keyMsgMatch[1].trim()}`;

      // Executive overview (slide 1, no tracker): keep full content so router sees deck structure
      const isExecOverview = slideNum === 1 && !trackerMatch && slideTitle.toLowerCase().includes('overview');
      if (isExecOverview && fullInstruction) {
        condensed += `\nContent: ${fullInstruction}`;
      }
      // Keep data points — these are short research facts the router needs to see
      if (dataMatch?.[1]?.trim()) condensed += `\nData Points: ${dataMatch[1].trim()}`;
      condensedSections.push(condensed);
    }

    if (condensedSections.length > 0) {
      // Rebuild: user intent (preamble) + condensed slides + closing + router guidance
      const preambleMatch = userPrompt.match(/^([\s\S]*?)(?=--- SLIDE 1)/);
      const preamble = preambleMatch?.[1] || '';
      const closingMatch = userPrompt.match(/(--- CLOSING ---[\s\S]*?)(?=={5,}\n)/);
      const closingSection = closingMatch?.[1] || '';
      const instrBlockMatch = userPrompt.match(/(={5,}\nINSTRUCTIONS[\s\S]*$)/);
      const instrBlock = instrBlockMatch?.[1] || '';

      routerPrompt = preamble + condensedSections.join('\n') +
        (closingSection ? '\n' + closingSection : '') +
        (instrBlock ? '\n' + instrBlock : '') +
        '\n\nNOTE: Each slide\'s detailed Instruction text is stored separately and will be ' +
        'injected automatically after routing. Choose the best template for each slide based ' +
        'on its Key Message and content.';

      console.log('[AI Router] Condensed agent prompt:', userPrompt.length, '→', routerPrompt.length, 'chars',
        `(${condensedSections.length} slides, ${fullInstructionMap.size} instructions stored)`);
    }
  }

  // ── Extract per-slide content from direct user prompts ──
  // When the user provides "Slide 1: [content], Slide 2: [content]" or similar numbered patterns,
  // store the exact text so we can verify/restore it after routing (the router may summarize).
  let userSlideContentMap = null;
  if (!isAgentPrompt) {
    // Match patterns like: "Slide 1: ...", "Slide 2 - ...", "1. ...", "1) ..."
    // followed by content up to the next slide marker or end of input
    const slideMarkerPattern = /(?:slide\s*#?\s*(\d+)\s*[:–—-]|^(\d+)[.)]\s)/gim;
    const markers = [];
    let m;
    while ((m = slideMarkerPattern.exec(userPrompt)) !== null) {
      markers.push({ num: parseInt(m[1] || m[2]), index: m.index, matchEnd: m.index + m[0].length });
    }
    if (markers.length >= 2) {
      userSlideContentMap = new Map();
      for (let i = 0; i < markers.length; i++) {
        const contentStart = markers[i].matchEnd;
        const contentEnd = i + 1 < markers.length ? markers[i + 1].index : userPrompt.length;
        const content = userPrompt.slice(contentStart, contentEnd).trim();
        if (content) {
          userSlideContentMap.set(markers[i].num, content);
        }
      }
      if (userSlideContentMap.size >= 2) {
        console.log(`[AI Router] Extracted ${userSlideContentMap.size} user-provided slide contents for verbatim passthrough`);
      } else {
        userSlideContentMap = null; // Not enough to be meaningful
      }
    }
  }

  const agentModeNote = agentMode
    ? `\nAGENT MODE: The agent is driving slide creation. Create exactly ONE step for the given instruction.
- Do NOT add a cover slide — the agent handles deck structure.
- Do NOT reorder, split, or add slides — just pick the best template for this single instruction.\n`
    : '';

  const imageModeNote = preferImageSlides
    ? `\nIMAGE-BASED MODE: The user has selected image-based slides.
TEMPLATE RULE: For every create_slide step, use templateId "image-content" (NOT freestyle, NOT regular templates).
EXCEPTION: Cover slides (position: "start") MUST use templateId "cover", NOT "image-content".
INSTRUCTION (content for title/subtitle): Put the SUBSTANTIVE CONTENT here — key message, data points, facts, "so what" insight.
  This feeds the text model that generates the slide title and subtitle. Be specific and rich.
  GOOD: "Three digital capability gaps limit market expansion — security (42%), cloud (38%), AI readiness (27%)"
  BAD: "digital capability gaps" (too vague — text model can't generate a strong title)
LAYOUT GUIDANCE (visual for image model): Put ONLY the diagram/framework description — shapes, axes, flow, structure.
  This feeds the image model that draws the visual. NO prose, NO data, NO key messages.
  Use CONSULTING FRAMEWORKS: value chains, chevrons, 2×2 matrices, SWOT, waterfall charts, pyramids, hub-and-spoke, bridge charts, funnels, Venn diagrams, comparison tables, roadmaps.
  GOOD: "3 horizontal bars descending by size, labeled with gap categories, maroon fill"
  BAD: "show how three digital gaps are limiting our expansion into new markets" (this is content, not a visual description)
SEARCH: Include a searchQuery when real data would strengthen the title — the text model can use web search.\n`
    : `\nTEMPLATE RULE: Do NOT use "image-content" or "image-full" templates. The user has NOT selected image mode. Use only standard templates (freestyle, named templates like threeCards, twoColumns, etc.).\n`;

  const recentConversation = chatHistory.length > 0
    ? `\nRECENT CONVERSATION:\n${chatHistory.map(m => `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}\n`
    : '';

  const activeSlideBlock = activeSlideContext
    ? `\nACTIVE PAGE CONTEXT:\n- Slide ${activeSlideContext.index + 1}: "${activeSlideContext.title}" (${activeSlideContext.template || 'custom'})\n${activeSlideContext.sectionLabel ? `- Section: ${activeSlideContext.sectionLabel}\n` : ''}${activeSlideContext.subSectionLabel ? `- Subsection: ${activeSlideContext.subSectionLabel}\n` : ''}${activeSlideContext.previousTitle ? `- Previous: "${activeSlideContext.previousTitle}"\n` : ''}${activeSlideContext.nextTitle ? `- Next: "${activeSlideContext.nextTitle}"\n` : ''}- Text-only content:\n${activeSlideContext.textSummary || '[Empty slide]'}\n`
    : '';

  const sectionMapBlock = sectionMap || deckContextDigest?.sectionMap
    ? `\n${sectionMap || deckContextDigest.sectionMap}\n`
    : '';

  const effectiveDeckStructure = deckStructure || deckContextDigest?.deckStructure || null;
  const deckStructureBlock = effectiveDeckStructure
    ? `\nDECK STRUCTURE MODEL:
- Executive summary: ${effectiveDeckStructure.executiveSummary ? `slide ${effectiveDeckStructure.executiveSummary.slideIndex + 1} "${effectiveDeckStructure.executiveSummary.title}" with ${effectiveDeckStructure.executiveSummary.items?.length || 0} item(s)` : 'none detected'}
${effectiveDeckStructure.executiveSummary?.items?.length ? `- Executive summary items: ${effectiveDeckStructure.executiveSummary.items.map(item => item.trackerLabel).join('; ')}` : ''}
- Sections: ${(effectiveDeckStructure.sections || []).map(section => `${section.label} -> slides ${section.slideIndices.map(i => i + 1).join(', ')}`).join(' | ') || 'none'}
- Tracker alignment: ${effectiveDeckStructure.trackerAlignment?.status || 'unknown'}
- Tracker rule: when adding or updating section trackers from an executive summary, do NOT set a section tracker on the executive summary slide unless the user explicitly asks. Apply the executive summary item labels to the corresponding body/detail slides.\n`
    : '';

  const referenceContextBlock = deckContextDigest?.referenceSlideContexts?.length
    ? `\nREFERENCE SLIDE TEXT CONTEXT:
${deckContextDigest.referenceSlideContexts.map(ref => `- Slide ${ref.index + 1}: "${ref.title}" (${ref.template})${ref.sectionLabel ? ` [${ref.sectionLabel}]` : ''}\n${ref.textSummary}`).join('\n\n')}\n`
    : '';

  const contextInfo = `CURRENT STATE:
- Total slides: ${slideCount}
- User is viewing slide index ${currentSlideIndex} (0-based) → slide ${currentSlideIndex + 1} of ${slideCount}. "this slide" or "current slide" = index ${currentSlideIndex}.
- Context policy: ${normalizedContextLevel}
- Target slides from triage: ${normalizedTargetSlides.length ? normalizedTargetSlides.map(i => i + 1).join(', ') : 'none'}
- Reference slides from triage: ${normalizedReferenceSlides.length ? normalizedReferenceSlides.map(i => i + 1).join(', ') : 'none'}
- Has cover slide: ${hasCoverSlide ? 'YES' : 'NO'}
- Storyline: ${storylineSummary || 'none'}
- Max parallel steps per group: ${parallelBatchSize}
- Web search available to slide execution: ${searchAvailable ? 'YES — add "searchQuery" to steps that need real-time or specific data' : 'NO — do not add searchQuery'}
- Router inline search policy: ${canUseInlineSearch ? `ENABLED (${routerSearchPolicy.reason})` : `DISABLED (${routerSearchPolicy.reason})`}
- Slide style preference: ${settings.slideStylePreference === 'freestyle' ? 'FREESTYLE — always use templateId "freestyle" for create_slide steps (except cover/sectionDivider)' : settings.slideStylePreference === 'templates' ? 'TEMPLATES — always use a named template for create_slide steps, never "freestyle"' : 'AUTO — choose the best template or freestyle based on content'}
- Context mode: ${contextMode === 'slide' ? 'THIS SLIDE — user is focused on editing the current slide. Prefer edit_slide for the current slide unless the prompt clearly asks to create new slides.' : 'DECK — user is working on the full deck. Free to create, edit, delete, or batch-operate across slides.'}
${layoutSummary ? `- LAYOUTS ALREADY IN DECK: ${layoutSummary} — DO NOT repeat the most-used layouts. Pick different templates and content shapes for new slides.` : ''}
${activeSlideBlock}${sectionMapBlock}${deckStructureBlock}${referenceContextBlock}${agentModeNote}${imageModeNote}${documentSection}
SLIDE TITLES:
${slideList}
${referencedSlidesSection}
${activeFlow ? `\nACTIVE FLOW: "${activeFlow.name}"
Overall guidance: ${activeFlow.overallGuidance || 'none'}
Sections:
${activeFlow.sections.map((s, i) => `  ${i + 1}. template="${s.templateHint}" | instruction="${s.instruction}"${s.isRepeatable ? ` | REPEATABLE (${s.repeatSource})` : ''}`).join('\n')}
` : ''}${recentConversation}${settings.userPreferences ? `\nUSER PREFERENCES (apply to all slides unless overridden):\n${settings.userPreferences}\n` : ''}
USER REQUEST: "${routerPrompt}"`;

  let routerSearchRawText = '';
  let routerSearchCallCount = 0;
  let routerSearchQueries = [];
  let response;

  const routerCallStart = Date.now();

  const hasImages = pendingImages && pendingImages.length > 0;
  const contextWords = contextInfo.split(/\s+/).length;
  const contextChars = contextInfo.length;
  const estimatedTokens = Math.ceil(contextChars / 4);

  console.log('[AI Router] Context stats:', {
    words: contextWords,
    chars: contextChars,
    estimatedTokens,
    hasDocuments: hasDocumentsAttached,
    hasImages,
    imageCount: pendingImages?.length || 0,
    useBigModel,
  });
  console.log('[AI Router] Calling router model:', routerModelRef);
  debugLog(LogLevel.INFO, 'aiRouteRequest', 'Calling AI router', {
    model: routerSettings.model,
    prompt: userPrompt,
    contextWords,
    contextChars,
    estimatedTokens,
    hasImages,
  });

  const routerSystemPrompt = getRouterSystemPrompt(settings);
  recordPromptPayload('router.system', {
    model: routerSettings.model,
    systemPrompt: routerSystemPrompt,
    userPrompt: contextInfo,
    hasImages,
  });

  try {
    // ── PATH A: Responses API (GPT models) ──
    // Single call with Structured Outputs. The web search tool is attached only
    // when the search policy says this request needs external/current evidence.
    if (canUseRouterResponsesAPI && !hasImages) {
      console.log('[Router Search] Using Responses API%s',
        canUseInlineSearch ? ' with inline web_search_preview' : ' without search tools');

      const responsesEndpoint = (settings.searchEndpoint || '').startsWith('/api/')
        ? settings.searchEndpoint
        : '/api/ai/responses';
      const isServerProxy = (settings.searchApiKey === 'server-managed') || responsesEndpoint.startsWith('/api/');
      const responsesBody = {
        model: routerModelName,
        instructions: routerSystemPrompt,
        input: contextInfo,
        max_output_tokens: effectiveMaxTokens,
        text: {
          format: {
            type: 'json_schema',
            name: 'slide_plan',
            strict: true,
            schema: getRouterOutputSchema(),
          },
        },
      };
      if (canUseInlineSearch) {
        responsesBody.tools = [{ type: 'web_search_preview', search_context_size: settings.searchContextSize || 'medium' }];
      }
      if (effectiveReasoningEffort && effectiveReasoningEffort !== 'none') {
        responsesBody.reasoning = { effort: effectiveReasoningEffort };
      }

      // The inline Responses-API path bypasses buildRequestBody, so we have to
      // wire `_skillId` onto the body ourselves. `_skillId` was placed on
      // `routerSettings` (not `settings`) by aiRouteRequest above, so we pass
      // that one. The helper is a no-op unless the call is going through our
      // PwC proxy.
      attachSkillIdToBody(responsesBody, routerSettings, {
        authType: isServerProxy ? 'server' : 'user',
        apiEndpoint: responsesEndpoint,
      });
      if (responsesBody._skillId) {
        console.log('[skills] router Responses API body carries skillId=%s endpoint=%s', responsesBody._skillId, responsesEndpoint);
      } else if (routerSettings._skillId) {
        console.warn('[skills] router selected skillId=%s but body did not receive _skillId (endpoint=%s) — check attachSkillIdToBody gate', routerSettings._skillId, responsesEndpoint);
      }

      const responsesHeaders = { 'Content-Type': 'application/json' };
      if (!isServerProxy) {
        responsesHeaders[settings.searchAuthHeader === 'bearer' ? 'Authorization' : 'api-key'] =
          settings.searchAuthHeader === 'bearer' ? `Bearer ${settings.searchApiKey}` : settings.searchApiKey;
      }

      let resp = await authFetch(responsesEndpoint, {
        method: 'POST', headers: responsesHeaders, body: JSON.stringify(responsesBody),
      });

      // Fallback: if the proxy rejects text.format, retry without it
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData.error?.message || `Responses API error: ${resp.status}`;
        const isFormatError = errMsg.includes('text') || errMsg.includes('format') || errMsg.includes('json_schema') || resp.status === 400;
        if (isFormatError && responsesBody.text) {
          console.warn('[Router Search] Structured output rejected by proxy, retrying without text.format:', errMsg);
          delete responsesBody.text;
          resp = await authFetch(responsesEndpoint, {
            method: 'POST', headers: responsesHeaders, body: JSON.stringify(responsesBody),
          });
        }
        if (!resp.ok) {
          const finalErr = isFormatError
            ? await resp.json().catch(() => ({}))
            : errData;
          const finalMsg = finalErr.error?.message || errMsg;
          console.warn('[Router Search] Responses API failed, falling back to Chat Completions:', finalMsg);
          throw new Error(finalMsg);
        }
      }

      const data = await resp.json();
      let planText = '';
      let searchCallCount = 0;
      const searchQueries = [];

      if (data.output && Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item.type === 'web_search_call') {
            searchCallCount++;
            const action = item.action || {};
            if (action.query) searchQueries.push(action.query);
            if (Array.isArray(action.queries)) searchQueries.push(...action.queries);
          } else if (item.type === 'message' && item.content) {
            for (const c of item.content) {
              if (c.type === 'output_text' && c.text) {
                planText += c.text;
              }
            }
          }
        }
      }
      routerSearchCallCount = searchCallCount;
      routerSearchQueries = [...new Set(searchQueries)].slice(0, 12);

      console.log('[Router Search] Responses API: %d search call(s), plan %d chars', searchCallCount, planText.length);

      if (!planText.trim()) {
        throw new Error('Responses API returned empty plan text');
      }

      response = planText.trim();
      // Don't populate searchRawContext from the plan text -- the Responses API
      // doesn't expose raw search results separately. The router's plan instructions
      // already incorporate search data, and per-step searchQuery handles grounding.

      console.log('[AI Router] Full response:', response);

    } else {
      // ── PATH B: Legacy two-step (pre-search + Chat Completions) ──
      // Used for non-GPT models, agent mode, or image-based routing.
      let routerSearchContext = '';

      const searchConfigured = searchAvailable && coerceBooleanSetting(settings.searchEnabled, true) && settings.searchEndpoint && settings.searchModel && !agentMode && routerSearchPolicy.allowSearch;
      if (searchConfigured && (!canUseRouterResponsesAPI || hasImages)) {
        try {
          const searchQuery = `${routerPrompt} latest ${currentDateString()}`;
          console.log('[Router Search] Pre-searching for router context:', searchQuery);
          const searchBody = {
            model: settings.searchModel,
            input: searchQuery,
            tools: [{ type: 'web_search_preview', search_context_size: settings.searchContextSize || 'medium' }],
            max_output_tokens: settings.searchMaxTokens || 32000,
          };
          const searchHeaders = { 'Content-Type': 'application/json' };
          const isServerProxy = settings.searchApiKey === 'server-managed' || (settings.searchEndpoint || '').startsWith('/api/');
          if (!isServerProxy) {
            searchHeaders[settings.searchAuthHeader === 'bearer' ? 'Authorization' : 'api-key'] =
              settings.searchAuthHeader === 'bearer' ? `Bearer ${settings.searchApiKey}` : settings.searchApiKey;
          }
          const searchResp = await authFetch(settings.searchEndpoint, {
            method: 'POST', headers: searchHeaders, body: JSON.stringify(searchBody),
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            let resultText = '';
            if (searchData.output && Array.isArray(searchData.output)) {
              for (const item of searchData.output) {
                if (item.type === 'web_search_call') {
                  routerSearchCallCount++;
                  const action = item.action || {};
                  if (action.query) routerSearchQueries.push(action.query);
                  if (Array.isArray(action.queries)) routerSearchQueries.push(...action.queries);
                } else if (item.type === 'message' && item.content) {
                  for (const c of item.content) { if (c.text) resultText += c.text + '\n'; }
                }
              }
            }
            if (resultText.trim()) {
              routerSearchRawText = resultText.trim();
              routerSearchQueries = [...new Set(routerSearchQueries)].slice(0, 12);
              routerSearchContext = `\n=== WEB SEARCH RESULTS (current as of ${currentDateString()}) ===\n${routerSearchRawText}\n=== END SEARCH RESULTS ===\nIMPORTANT: Use the search results above to inform your plan with CURRENT, accurate data and dates. Do not rely on outdated training knowledge.\n`;
              console.log('[Router Search] Pre-search returned', resultText.length, 'chars for router context');
            }
          } else {
            console.warn('[Router Search] Pre-search HTTP error:', searchResp.status);
          }
        } catch (searchErr) {
          console.warn('[Router Search] Pre-search failed:', searchErr.message);
        }
      }

      const contextInfoWithSearch = routerSearchContext
        ? `${contextInfo}\n${routerSearchContext}`
        : contextInfo;

      const routerBaseDelays = [0, 1500];
      for (let attempt = 0; attempt < routerBaseDelays.length; attempt++) {
        if (attempt > 0) {
          const jitter = Math.random() * 0.5;
          const delay = Math.round(routerBaseDelays[attempt] * (1 + jitter));
          console.log(`[AI Router] Retry ${attempt}/1 after ${delay}ms (jittered)...`);
          await new Promise(r => setTimeout(r, delay));
        }
        try {
          if (hasImages) {
            console.log('[AI Router] Using multimodal call with', pendingImages.length, 'image(s)');
            response = await callRouterWithImages(
              routerSettings,
              routerSystemPrompt,
              contextInfoWithSearch,
              pendingImages
            );
          } else {
            response = await callWithModelFallback(
              routerSettings,
              routerSystemPrompt,
              contextInfoWithSearch,
              { role: 'text' }
            );
          }

          console.log('[AI Router] Full response:', response);

          if (!response || response.trim() === '') {
            if (attempt < routerBaseDelays.length - 1) {
              console.warn(`[AI Router] Empty response on attempt ${attempt + 1} — retrying`);
              continue;
            }
            throw new Error(`AI router returned an empty response (model: ${routerModelRef}, prompt: ${contextInfo.length} chars)`);
          }
          break;
        } catch (routerErr) {
          if (routerErr.isRateLimit) throw routerErr;
          if (attempt < routerBaseDelays.length - 1 && (
            routerErr.message.includes('empty response') ||
            routerErr.message.includes('Network error') ||
            routerErr.message.includes('Failed to fetch') ||
            routerErr.message.includes('overloaded') ||
            routerErr.message.includes('500') ||
            routerErr.message.includes('502') ||
            routerErr.message.includes('503')
          )) {
            console.warn(`[AI Router] Retryable error on attempt ${attempt + 1}:`, routerErr.message);
            continue;
          }
          throw routerErr;
        }
      }
    }

    // Parse JSON response - handle markdown code blocks
    // Remove markdown code block wrapper if present
    let cleanResponse = response;
    if (response.includes('```json')) {
      cleanResponse = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    } else if (response.includes('```')) {
      cleanResponse = response.replace(/```\s*/g, '');
    }

    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI Router] No JSON found in response:', cleanResponse);
      debugLog(LogLevel.WARN, 'aiRouteRequest', 'No JSON in response', { responsePreview: cleanResponse });
      throw new Error(`AI router returned invalid response (no JSON). Response was: "${cleanResponse}". Please try again.`);
    }

    let parsed;
    try {
      parsed = safeJSONParse(jsonMatch[0], 'AI Router');
    } catch (parseError) {
      console.error('[AI Router] JSON parse error:', parseError, 'Raw:', jsonMatch[0]);
      throw new Error(`AI router returned malformed JSON: ${parseError.message}. Please try again.`);
    }

    console.log('[AI Router] Parsed (full):', JSON.stringify(parsed, null, 2));

    // ─── Clarification questions — router needs more info before planning ───
    if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return {
        intent: 'clarification',
        action: 'clarification',
        needsClarification: true,
        questions: parsed.questions.map(q => ({
          question: q.question || q,
          options: q.options || [],
        })),
        plan: [],
        aiRouted: true,
      };
    }

    // Handle new plan format or legacy single-action format
    const plan = parsed.plan || [{
      action: parsed.intent || 'create_slide',
      templateId: parsed.templateId,
      slideIndex: parsed.slideIndex,
      contextSlides: parsed.contextSlides || [],
      targetSlides: parsed.targetSlides || null,
      referenceSlides: parsed.referenceSlides || null,
      instruction: '',
    }];

    // Collect all source/context slides from the plan
    const sourceSlides = new Set(parsed.sourceSlides || []);
    plan.forEach(step => {
      if (step.slideIndex !== null && step.slideIndex !== undefined) {
        sourceSlides.add(step.slideIndex);
      }
      if (Array.isArray(step.contextSlides)) {
        step.contextSlides.forEach(idx => sourceSlides.add(idx));
      }
      if (Array.isArray(step.referenceSlides)) {
        step.referenceSlides.forEach(idx => sourceSlides.add(idx));
      }
    });
    normalizedReferenceSlides.forEach(idx => sourceSlides.add(idx));
    const contextSlideIndices = [...sourceSlides].sort((a, b) => a - b);

    // First step determines primary action/template for backwards compatibility
    const firstStep = plan[0] || {};

    // Map to standard router result format
    const result = {
      intent: firstStep.action || 'create_slide',
      action: firstStep.action || 'create_slide',
      understanding: plan.length > 1
        ? `Plan: ${plan.length} steps (${plan.map(s => s.action).join(' → ')})`
        : firstStep.templateId
          ? `${firstStep.action} using ${firstStep.templateId} template`
          : `${firstStep.action} (freestyle)`,
      templateMatch: firstStep.templateId ? {
        templateId: firstStep.templateId,
        confidence: 'high',
        reason: 'AI selected',
      } : null,
      // Safety: when agent provided the slides (fullInstructionMap exists), the router should
      // only add a cover + one step per agent slide. Strip any extra slides the router invented
      // (executiveSummary, sectionDivider, thankYou, etc.) beyond the expected count.
      plan: (fullInstructionMap && fullInstructionMap.size > 0
        ? (() => {
            const expectedCount = fullInstructionMap.size + 1; // cover + agent slides
            if (plan.length > expectedCount) {
              // Router added extra slides. Keep cover (first) + exactly N body create_slide steps.
              const kept = [];
              let bodyKept = 0;
              for (const step of plan) {
                if (step.templateId === 'cover' && kept.length === 0) {
                  kept.push(step);
                } else if ((step.action === 'create_slide' || step.action === 'create_from_template') && bodyKept < fullInstructionMap.size) {
                  kept.push(step);
                  bodyKept++;
                } else {
                  console.warn(`[AI Router] Stripped router-added step "${step.templateId || step.action}" — agent slide list is complete (expected ${expectedCount}, got ${plan.length})`);
                }
              }
              return kept;
            }
            return plan;
          })()
        : plan
      ).map((step, stepIdx) => {
        // ── Post-routing merge: restore full instructions ──
        // When we condensed the agent prompt, the router only saw slide flow + data points.
        // Now we inject the full instruction text back so step execution gets all the content.
        // For direct user prompts with per-slide content, we also verify/restore the user's exact text.
        let mergedInstruction = step.instruction || '';
        const isCreateStep = step.action === 'create_slide' || step.action === 'create_from_template';

        if (fullInstructionMap && fullInstructionMap.size > 0 && isCreateStep) {
          // Agent mode: restore full instruction from stored map
          const isBodyStep = (s) =>
            (s.action === 'create_slide' || s.action === 'create_from_template') &&
            s.templateId !== 'cover';
          const priorBodySteps = plan.slice(0, stepIdx).filter(isBodyStep).length;
          const isCover = step.templateId === 'cover';
          const slideNum = isCover ? -1 : priorBodySteps + 1;
          const fullInstr = fullInstructionMap.get(slideNum);
          if (fullInstr) {
            const routerDataPoints = (step.instruction || '').match(/Data Points:\s*([\s\S]*)/)?.[1]?.trim();
            mergedInstruction = fullInstr;
            if (routerDataPoints && !fullInstr.includes(routerDataPoints)) {
              mergedInstruction += '\nData Points: ' + routerDataPoints;
            }
            console.log(`[AI Router] Merged full instruction for step ${stepIdx} (SLIDE ${slideNum}): ${mergedInstruction.length} chars`);
          }
        } else if (userSlideContentMap && userSlideContentMap.size > 0 && isCreateStep) {
          // Direct user prompt: restore verbatim user content if the router condensed it.
          // Match body-step index to user's slide number (1-indexed).
          const isBodyStep = (s) =>
            (s.action === 'create_slide' || s.action === 'create_from_template') &&
            s.templateId !== 'cover';
          const priorBodySteps = plan.slice(0, stepIdx).filter(isBodyStep).length;
          const isCover = step.templateId === 'cover';
          const slideNum = isCover ? -1 : priorBodySteps + 1;
          const userContent = userSlideContentMap.get(slideNum);
          if (userContent) {
            // Check if the router's instruction significantly shortened the user's content.
            // If so, restore the original. Allow the router's version if it's at least 70% of the original length
            // (router may add template guidance or minor reformatting, which is fine).
            const routerLen = (step.instruction || '').length;
            const userLen = userContent.length;
            if (userLen > 40 && routerLen < userLen * 0.7) {
              console.log(`[AI Router] Restoring user content for step ${stepIdx} (slide ${slideNum}): router had ${routerLen} chars, user provided ${userLen} chars`);
              mergedInstruction = userContent;
            }
          }
        }

        const normalizedSearchQuery = step.searchQuery || null;
        if (normalizedSearchQuery) {
          console.log('[Router Search]', `Step ${stepIdx} (post-merge): searchQuery for slide generation → "${normalizedSearchQuery}"`,
            '(injected into executor prompt as [SEARCH THE WEB for: …] when settings.searchEnabled)');
        }

        let resolvedSlideIndex = step.slideIndex ?? null;
        if (resolvedSlideIndex == null && step.action === 'edit_slide') {
          const refsFromInstruction = parseSlideReferences(step.instruction || '', slideCount);
          if (refsFromInstruction.length > 0) {
            resolvedSlideIndex = refsFromInstruction[0];
          }
        }

        const stepReferenceSlides = normalizeSlideIndexArray(step.referenceSlides, slideCount);
        const stepContextSlides = normalizeSlideIndexArray([
          ...(step.contextSlides || []),
          ...stepReferenceSlides,
        ], slideCount);
        const stepTargetSlides = normalizeSlideIndexArray(
          step.targetSlides || (resolvedSlideIndex != null ? [resolvedSlideIndex] : []),
          slideCount
        );

        return {
          action: step.action,
          templateId: step.templateId || null,
          slideIndex: resolvedSlideIndex,
          contextSlides: stepContextSlides,
          targetSlides: stepTargetSlides,
          referenceSlides: stepReferenceSlides,
          instruction: mergedInstruction,
          position: step.position || 'end',
          contextFromStep: step.contextFromStep ?? null,
          content: typeof step.content === 'string' ? step.content : (step.content ? JSON.stringify(step.content) : null),
          searchQuery: normalizedSearchQuery,
          searchGoal: step.searchGoal || null,
          title: step.title || null,
          subtitle: step.subtitle || null,
          facts: Array.isArray(step.facts) ? step.facts : null,
          sources: Array.isArray(step.sources) ? step.sources : null,
          sectionTracker: step.sectionTracker || null,
          subSectionTracker: step.subSectionTracker || null,
          layoutGuidance: step.layoutGuidance || null,
          fromIndex: Number.isInteger(step.fromIndex) ? step.fromIndex : null,
          toIndex: Number.isInteger(step.toIndex) ? step.toIndex : null,
          orderedSlideIndices: normalizeSlideIndexArray(step.orderedSlideIndices, slideCount),
        };
      }),
      groups: parsed.groups || null,
      contextLevel: normalizeContextLevel(parsed.contextLevel, normalizedContextLevel),
      targetSlides: normalizeSlideIndexArray(parsed.targetSlides || normalizedTargetSlides, slideCount),
      referenceSlides: normalizeSlideIndexArray(parsed.referenceSlides || normalizedReferenceSlides, slideCount),
      needsReplanning: parsed.needsReplanning || false,
      contextNeeded: {
        type: contextSlideIndices.length > 0 ? 'slide_html' : 'none',
        slideIndices: contextSlideIndices,
        includeTemplate: !!firstStep.templateId,
        includeStoryline: parsed.needsStoryline || false,
        reason: `Plan needs ${contextSlideIndices.length} source slide(s)`,
      },
      params: {
        slideIndex: (() => {
          if (firstStep.slideIndex != null) return firstStep.slideIndex;
          if (firstStep.action === 'edit_slide' || firstStep.action === 'delete_slide') {
            const refs = parseSlideReferences(firstStep.instruction || userPrompt, slideCount);
            if (refs.length > 0) return refs[0];
          }
          return currentSlideIndex;
        })(),
      },
      aiRouted: true,
      searchSource: routerSearchCallCount > 0 ? 'inline' : (routerSearchRawText ? 'presearch' : 'none'),
      // Batch continuation - if more slides are requested than max batch (5)
      remainingCount: parsed.remainingCount || 0,
      // Debug info for UI display
      routerDebug: {
        model: routerModelRef,
        contextSent: {
          slideCount,
          currentSlideIndex,
          layoutSummary,
          sectionMap: sectionMap || deckContextDigest?.sectionMap || '',
          activeSlideContext,
          contextLevel: normalizedContextLevel,
          referenceSlides: normalizedReferenceSlides,
          targetSlides: normalizedTargetSlides,
          deckStructure: effectiveDeckStructure,
          deckContextDigest,
          storylineSummary,
          slideSummaries,
        },
        systemPrompt: routerSystemPrompt,
        userPrompt: contextInfo,
        rawResponse: response,
        parsedResponse: parsed,
        searchPolicy: routerSearchPolicy,
        routerSearchAllowed: canUseInlineSearch,
        routerSearchUsed: routerSearchCallCount > 0 || !!routerSearchRawText,
        searchCallCount: routerSearchCallCount,
        searchQueries: routerSearchQueries,
      },
    };

    // Path A (Responses API with inline search): when the router actually searched
    // inline, searchRawContext is empty because the API doesn't expose raw results.
    // Synthesize searchRawContext from all facts/sources in the plan so
    // buildSearchFactsBlock() can provide baseline grounding for every step.
    if (routerSearchCallCount > 0 && !routerSearchRawText && result.plan) {
      const factLines = [];
      for (const step of result.plan) {
        if (Array.isArray(step.facts)) {
          factLines.push(...step.facts);
        }
        if (Array.isArray(step.sources)) {
          for (const src of step.sources) {
            const label = typeof src === 'string' ? src : `${src.label || ''} (${src.url || ''})`;
            factLines.push(label);
          }
        }
      }
      if (factLines.length > 0) {
        routerSearchRawText = factLines.join('\n');
        console.log('[Router Search] Synthesized searchRawContext from %d plan facts/sources (%d chars)',
          factLines.length, routerSearchRawText.length);
      }
    }

    // Attach pre-search context so downstream slide generation can use it
    // for ALL slides (including cover/dividers that lack their own searchQuery).
    if (routerSearchRawText) {
      result.searchRawContext = routerSearchRawText;
      console.log('[Router Search] Attached searchRawContext to route result:', result.searchRawContext.length, 'chars');
    }

    const searchSteps = result.plan?.filter(s => s.searchQuery) || [];
    if (searchSteps.length > 0) {
      console.log('[Router Search]', `Plan: ${searchSteps.length} step(s) with searchQuery (step-level slide gen search):`,
        searchSteps.map((s, i) => ({
          planIndex: result.plan.indexOf(s),
          action: s.action,
          templateId: s.templateId,
          query: s.searchQuery,
        })));
      console.log('[Router Search]', 'Slide-gen search will run if settings.searchEnabled; each query above is appended to that step’s prompt.');
    } else if (result.plan?.length > 0) {
      console.log('[Router Search]', `Plan: ${result.plan.length} step(s), none with searchQuery`);
    }

    debugLog(LogLevel.INFO, 'aiRouteRequest', 'AI routing complete', {
      intent: result.intent,
      template: result.templateMatch?.templateId,
      confidence: parsed.confidence,
    });

    console.groupCollapsed(`[AI Router] ${result.intent} → ${result.plan?.length || 0} steps | model=${routerModelRef} | search=${result.searchSource}`);
    console.log('INPUT', { model: routerModelRef, userPrompt: userPrompt.slice(0, 300), slideCount, contextMode, searchAvailable: effectiveSearchEnabled, searchPolicy: routerSearchPolicy });
    console.log('FULL CONTEXT INFO', contextInfo);
    console.log('OUTPUT', { intent: result.intent, confidence: parsed.confidence, planSteps: result.plan?.map(s => ({ action: s.action, templateId: s.templateId, title: s.title })), searchRawContextLen: routerSearchRawText?.length || 0 });
    console.log('RAW RESPONSE', response);
    console.log('PARSED JSON', parsed);
    console.groupEnd();

    // Audit log for router calls — visible in AuditLogViewer
    const routerDuration = Date.now() - routerCallStart;
    const routerRole = agentMode ? 'router:agent' : 'router:chatbot';
    audit(routerRole, result.intent === 'clarify' ? 'asked questions' : `routed: ${result.intent}`, {
      model: routerModelRef,
      query: userPrompt,
      context: `${parsed.plan?.length || 0} steps, confidence: ${parsed.confidence || 'n/a'}`,
      maxTokens: routerSettings.maxTokens || null,
      reasoningEffort: routerSettings.reasoningEffort || null,
      searchEnabled: routerSearchCallCount > 0 || !!routerSearchRawText,
      searchPolicy: routerSearchPolicy.reason,
      temperature: routerSettings.temperature ?? null,
      duration: routerDuration,
      inputLen: contextInfo.length,
      outputLen: response?.length || 0,
      status: 'ok',
    });

    return result;

  } catch (error) {
    debugLog(LogLevel.ERROR, 'aiRouteRequest', 'AI router failed', {
      error: error.message,
    });
    const routerRole = agentMode ? 'router:agent' : 'router:chatbot';
    audit(routerRole, 'router failed', {
      model: routerModelRef,
      query: userPrompt,
      duration: Date.now() - routerCallStart,
      status: 'error',
      error: error.message,
    });
    // Re-throw with user-friendly message
    if (error.message.includes('API key') || error.message.includes('Router model') || error.message.includes('invalid response') || error.message.includes('malformed JSON')) {
      throw error; // Already user-friendly
    }
    throw new Error(`AI router error: ${error.message}`);
  }
}

// ============================================
// END AI-POWERED ROUTER
// ============================================
