// AI Service for generating slides via GPT
import { SLIDE_TEMPLATES, getTemplateFlex, getTemplateGuidance } from '../utils/slideTemplates';
import { debugLog, LogLevel } from '../utils/debugLog';
import { audit } from '../utils/auditLog';
import { getVibePromptContext, isBaseVibe } from '../utils/vibes';
// Import the COMPLETE CSS directly from slides.css - single source of truth
// This is 2700+ lines with 229 unique component classes
import FULL_SLIDE_CSS from '../styles/slides.css?raw';
// Import the freestyle slide guide - single source of truth for freestyle generation
import FREESTYLE_SLIDE_GUIDE from '../guides/freestyle-slide-guide.md?raw';
// Import embedding-based template matching
import {
  findBestTemplate,
  searchTemplatesByEmbedding,
  searchTemplatesByKeywords,
  selectBestTemplate,
  initializeTemplateEmbeddings,
  randomizeFamilyVariant,
  estimateItemCount,
  TEMPLATE_QUALIFICATIONS,
  TEMPLATE_FAMILIES,
} from './templateEmbeddings';

// Re-export embedding functions for external use
export {
  findBestTemplate,
  searchTemplatesByEmbedding,
  searchTemplatesByKeywords,
  initializeTemplateEmbeddings,
  TEMPLATE_QUALIFICATIONS,
  TEMPLATE_FAMILIES,
};

// Export the full CSS for use in other modules
export { FULL_SLIDE_CSS };

// Log CSS import status on module load
if (FULL_SLIDE_CSS) {
  console.log(`[aiService] FULL_SLIDE_CSS loaded: ${FULL_SLIDE_CSS.length} characters`);
} else {
  console.error('[aiService] WARNING: FULL_SLIDE_CSS failed to load!');
}

// CSS Style Guide - exact values from slides.css for AI reference
// This ensures AI-generated content matches the theme exactly
export const CSS_STYLE_GUIDE = `
=== CSS STYLE GUIDE ===

CRITICAL: ALWAYS use CSS custom properties (tokens) instead of hardcoded colors!
This ensures dark mode and vibes work automatically.

SEMANTIC TOKENS (use var(--token-name) in styles):
Text tokens:
  var(--heading)     - Headings, titles, h1-h6 (dark text, inverts in dark mode)
  var(--body)        - Body text, paragraphs (dark text, inverts in dark mode)
  var(--muted)       - Subtle text, meta, captions

Accent tokens:
  var(--accent)      - Primary accent color (maroon/brand color)
  var(--accent-soft) - Light accent background (for icon circles, highlights)
  var(--on-accent)   - Text on accent backgrounds (white)

Surface tokens:
  var(--page)        - Page/slide background (white, inverts to dark)
  var(--surface)     - Card/container background (light gray, inverts)
  var(--surface-alt) - Alternate surface
  var(--border)      - Borders and dividers

Legacy tokens (prefer semantic tokens above):
  var(--main), var(--secondary), var(--meta), var(--maroon)
  var(--zone1), var(--zone2), var(--rose), var(--coal), var(--red)

EXAMPLE - Using tokens in inline styles:
CORRECT: style="color: var(--heading)"
CORRECT: style="background: var(--surface)"
CORRECT: style="border-color: var(--accent)"
WRONG: style="color: #111111" (hardcoded - won't work in dark mode!)

FONTS:
- Titles (h1, .title): Georgia, serif - 28px, color: var(--heading)
- Subtitles (h2, .subtitle): Arial, sans-serif - 18px bold, color: var(--accent)
- Card titles (h3): Arial, sans-serif - 14px bold, color: var(--heading)
- Body text (p): Arial, sans-serif - 12px, color: var(--body)
- KPI values: Georgia, serif - 42px bold, color: var(--accent)
- KPI labels: Arial, sans-serif - 13px, color: var(--muted)
- Footer: Arial, sans-serif - 10px, color: var(--muted)

POSITIONING (pixels):
- Title: top 30px, left 35px, width 890px
- Subtitle: top 101px, left 35px
- Frame (content area): top 137px, left 35px, width 890px
- Footer: at bottom of slide

STANDARD COMPONENTS:
- Cards: background var(--surface), border-radius 4px, border-top 5px solid var(--accent)
- KPI blocks: background var(--surface), border-left 4px solid var(--accent)
- Icon circles: 40px round, background var(--accent-soft)
- Impact boxes: border-left 3px solid var(--accent), background var(--accent-soft)
- Lists: ALWAYS use a class — content-list (card-like, accent border), exec-bullet-list (premium padded), insight-list (→ arrows), check-list (✓ circles), styled-list (— dividers)
- Detail items: background var(--surface), border-left 3px solid var(--accent), padded

REMEMBER: Use tokens for ALL colors to ensure dark mode compatibility!

=== END CSS VALUES ===`;

// ── Work Level prompt builder ─────────────────────────────────────────────────
// Generates scaling instructions based on work level setting.
// Contexts: 'slide' (regular chatbot slide), 'agent' (agentic slide creation), 'report' (HTML report)
export function getWorkLevelInstructions(level, context = 'slide') {
  const lvl = (level || 'medium').toLowerCase();

  if (context === 'report') {
    const REPORT_LEVELS = {
      low: `OUTPUT DEPTH: FOCUSED
- Each section: 3-5 key points with supporting data and analysis
- Include charts, tables, and visual elements for every section
- Use ALL research data — do not skip findings
- Target ~30-45K chars total output`,
      medium: `OUTPUT DEPTH: RICH & COMPREHENSIVE
- Deliver thorough analysis with full supporting evidence
- Each section: deep treatment with ALL data points, statistics, examples, and implications
- Rich narrative with detailed exhibits, multiple chart types, tables, and visual elements
- Include strategic recommendations with supporting rationale
- Every data point from the research MUST appear — nothing gets summarized away
- Target ~50-80K chars total output — use the full token budget`,
      high: `OUTPUT DEPTH: DETAILED & EXHAUSTIVE
- Deliver comprehensive, deep analysis — leave nothing out
- Each section: exhaustive treatment with every data point, every statistic, every example
- Rich narrative with detailed exhibits, chart descriptions, case references, cross-references
- Include strategic recommendations with implementation considerations
- Every finding from the research gets its own visual treatment
- Target ~70-100K chars total output — maximize content depth`,
      very_high: `OUTPUT DEPTH: MAXIMUM — PUBLICATION QUALITY
- Produce an exhaustive, publication-quality report
- Every section gets full analytical depth — leave absolutely nothing out
- Detailed data analysis, cross-references, trend breakdowns, scenario modeling
- Extended strategic recommendations with implementation considerations
- Include appendix-level detail inline where relevant
- Every data point, every statistic, every finding gets thorough treatment
- Target ~100K+ chars total output — use ALL available token budget`,
    };
    return REPORT_LEVELS[lvl] || REPORT_LEVELS.medium;
  }

  if (context === 'agent') {
    const AGENT_LEVELS = {
      low: `WORK DEPTH: EFFICIENT
- Researchers: gather key facts only, skip deep-dives
- Analysts: 2-3 core insights per topic, concise synthesis
- Compiler: lean slide content — key message + essential supporting points
- Aim for efficient, focused output — quality over quantity`,
      medium: `WORK DEPTH: BALANCED
- Researchers: solid coverage, gather relevant data and context
- Analysts: 3-5 insights per topic with supporting evidence
- Compiler: well-developed slide content with clear narrative
- Balance thoroughness with efficiency`,
      high: `WORK DEPTH: THOROUGH
- Researchers: comprehensive research — explore adjacent angles, gather rich data
- Analysts: deep analysis with multiple data points, trends, implications
- Compiler: detailed slide content with rich supporting material, examples, data
- Produce content that could stand alone as executive reference material
- Use the full token budget — more detail is better`,
      very_high: `WORK DEPTH: MAXIMUM
- Researchers: exhaustive research — leave no stone unturned, explore all angles
- Analysts: full analytical depth — every data point, every implication, every cross-reference
- Compiler: maximum-detail slide content — dense, data-rich, comprehensive
- Each slide should be a complete analytical exhibit
- Use ALL available tokens — pack in maximum useful information
- Think of this as due-diligence level work`,
    };
    return AGENT_LEVELS[lvl] || AGENT_LEVELS.medium;
  }

  // Default: slide context (regular chatbot slide creation)
  const SLIDE_LEVELS = {
    low: `CONTENT DEPTH: MINIMAL
- Lean, focused slides — key message + 2-3 supporting points max
- Bullets: max 6-8 words each, max 3 bullets
- Prefer visual impact over text density
- Leave generous white space — the slide should feel AIRY`,
    medium: `CONTENT DEPTH: BALANCED
- Clear key message with focused supporting content
- Bullets: concise (6-10 words each), max 4-5 bullets
- Cards: max 3 cards, each with a short title + 1-2 lines
- LESS IS MORE — a clean slide with 3 strong points beats 6 weak ones
- White space is a design asset — do NOT fill every inch`,
    high: `CONTENT DEPTH: DETAILED
- Rich, informative slides with solid content
- Include specific data points, examples, and evidence
- Bullets: up to 12 words, max 6 bullets
- Content should be comprehensive but never cramped
- Leave some breathing room — readability over density`,
    very_high: `CONTENT DEPTH: MAXIMUM
- Dense, information-rich slides — every element earns its place
- Include data, examples, implications, and cross-references
- Bullets can be detailed sentences, up to 8 bullets per slide
- Maximize useful content within the slide frame
- Think McKinsey exhibit-level detail — dense but structured`,
  };
  return SLIDE_LEVELS[lvl] || SLIDE_LEVELS.medium;
}

// Writing style guide for slide titles and headers
// This ensures consistent consulting-quality content
export const SLIDE_WRITING_STYLE = `
=== SLIDE WRITING STYLE (CRITICAL) ===

h1.title (BLACK, LARGE - the HEADER):
- A VERBAL "so what" SENTENCE with insight (contains verbs, makes a claim)
- 8-10 WORDS max — short, punchy, scannable
- NEVER end with a period (.) or any punctuation — no periods, no exclamation marks
- This is the KEY TAKEAWAY - what should the reader remember?
- Must be a complete thought with a verb, not just a label
- CORRECT: "AI will transform education within five years" (7 words)
- CORRECT: "Revenue grew 45% driven by digital transformation" (7 words)
- CORRECT: "Three strategic pillars unlock $50M in savings" (7 words)
- WRONG: "Financial Performance" (no verb, no insight - that's a title!)
- WRONG: "Overview." (no periods ever!)
- WRONG: "AI-driven digital transformation enables sustainable competitive advantage across markets." (too long + period)

h2.subtitle (BURGUNDY/RED, SMALLER - the TITLE):
- SHORT NOUN PHRASE: 3-4 words only, NO VERBS
- Acts as a topic label/category for the page
- SENTENCE CASE: Only first word capitalized, plus proper nouns
- CORRECT: "Financial performance" (3 words, noun phrase)
- CORRECT: "Strategic framework" (2 words)
- CORRECT: "Market analysis" (2 words)
- CORRECT: "Key growth drivers" (3 words)
- WRONG: "Revenue grew 45%" (has a verb - that's a header!)
- WRONG: "Key Growth Drivers" (wrong case - Growth/Drivers shouldn't be capitalized)

SENTENCE CASE RULES FOR TITLES (h2):
- First word always capitalized
- Proper nouns (names, places, brands, acronyms) capitalized
- All other words lowercase
- NO VERBS - just nouns and adjectives

REMEMBER: h1 = HEADER (verbal sentence with insight, 8-10 words max, NEVER ends with a period), h2 = TITLE (noun phrase, 3-4 words, NO verbs)

VERTICAL LOGIC (CRITICAL):
- The header/title MUST match the content structure exactly
- If header says "Three pillars..." → content MUST have exactly 3 items
- If header says "Five key drivers..." → content MUST have exactly 5 items
- If content has 4 cards, header must reference 4 (not 3 or 5)
- Count the items in your content FIRST, then write the header to match
- WRONG: Header says "3-step approach" but content shows 5 steps
- WRONG: Header says "Four priorities" but content has 3 cards
- RIGHT: Header says "Three pillars drive growth" + content has exactly 3 cards

=== END WRITING STYLE ===`;

// Compact version for template filling - saves context tokens
export const TITLE_HEADER_RULES = `WRITING RULES: h1.title (black) = HEADER: a business "so what" sentence (8-12 WORDS MAX, contains verbs, makes a strategic claim or insight). CRITICAL: NEVER end h1 with a period (.) or any punctuation. Keep it SHORT — if over 12 words, cut it down. The header conveys a KEY BUSINESS MESSAGE — not a description of what's on the slide. NEVER start headers with a number or count (e.g., "9 actions...", "4 pillars..."). Instead lead with the insight or outcome. GOOD: "AI operations will cut carbon footprint by 40%" (8 words), "Strategic pillars position us for market growth" (7 words). BAD: "9 actions deliver measurable low carbon AI operations" (starts with number), "AI-driven transformation enables sustainable competitive advantage across global markets." (too long + period). TITLE PRESERVATION: The h1 header MUST stay about the SLIDE'S EXISTING TOPIC — never rewrite it to match the edit instruction. If the user says "refine visuals" or "make it cleaner", the h1 must still be about the slide's business content (e.g., "AI delivers 3x ROI in year one"), NOT about visual refinement. Only change the h1 if the user EXPLICITLY provides new title content (e.g., "title: X", "change the heading to X", or gives a clear business message to use). USER-PROVIDED TITLES: If the instruction explicitly contains a title or "so what" sentence intended as content, USE IT — preserve the user's specific data, claims, and terminology. You may lightly adjust to fit the 8-12 word format but NEVER replace their specific insight with a generic label. h2.subtitle (burgundy) = TITLE: 3-4 word noun phrase (NO verbs, topic label only, SENTENCE CASE, no periods). CONSISTENCY: if the header mentions a specific count, the content MUST have exactly that many items — so prefer NOT mentioning counts in headers. SOURCE/CITATION: Any source attribution or citation text MUST go ONLY in the <footer> element — NEVER place "Source:" labels or citation text inside the slide content area (<div class="frame">). TITLE FORMATTING: NEVER wrap title text in <strong>, <b>, or <em> tags — titles must be plain text only. CSS handles all styling. METADATA: NEVER include system tags like [Design Style: ...], [Vibe: ...], [SEARCH ...], or any bracketed metadata in titles or subtitles — those are system instructions, not content.`;

// Lean router prompt for first GPT call - minimal tokens for intent classification
export const LEAN_ROUTER_PROMPT = `You are a slide assistant router. Classify user intent and return action plan.

TOOLS: edit_slide, create_slide, create_from_template, create_slides_batch, switch_template, delete_slide, reorder_slide, answer_question, generate_storyline, populate_slides

RULES:
- "create/add/make slide" → create_slide or create_from_template
- "edit/change/fix/update" → edit_slide
- "this slide" or "current slide" → edit_slide with NO slideIndex (uses current)
- "populate/fill from storyline" → populate_slides
- "switch/convert template" → switch_template
- Questions without changes → answer_question
- Greetings/small talk (hi, hello, thanks, bye) → answer_question (NEVER create slides)

CRITICAL - SLIDE INDEXING:
- slideIndex is 0-BASED: "slide 1" → slideIndex:0, "slide 2" → slideIndex:1
- For "this slide" or "current slide" → DO NOT include slideIndex, system will use current
- Look at "← CURRENT" marker in slide list to identify which slide is selected

Return JSON only:
{"understanding":"one sentence","steps":[{"action":"tool","params":{}}],"contextStrategy":{"slideIndices":[],"reason":"brief"}}`;

// ============================================
// RULE-BASED ROUTER (No API call needed)
// ============================================

// Template keyword mappings - maps keywords to template IDs
const TEMPLATE_KEYWORDS = {
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
const INTENT_PATTERNS = {
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
function repairJSON(jsonStr) {
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
function safeJSONParse(jsonStr, context = 'unknown') {
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
      console.error(`[${context}] JSON repair failed. Original:`, jsonStr.substring(0, 200));
      throw firstError;
    }
  }
}

// Check if prompt is about element-level changes (not slide-level)
function isElementLevelAction(prompt) {
  return INTENT_PATTERNS.addElement.test(prompt) ||
         INTENT_PATTERNS.removeElement.test(prompt) ||
         INTENT_PATTERNS.changeElement.test(prompt) ||
         INTENT_PATTERNS.moveElement.test(prompt) ||
         INTENT_PATTERNS.resizeElement.test(prompt) ||
         INTENT_PATTERNS.styleElement.test(prompt);
}

// Check if user provides detailed layout descriptions (should use freestyle)
// This detects when users are being very specific about custom arrangements
function isDetailedLayoutDescription(prompt) {
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
function parseSlideReferences(prompt, slideCount) {
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

// Enhanced template matching with scoring
function matchTemplateFromPrompt(prompt) {
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

  return result;
}

// Export for testing
export { TEMPLATE_KEYWORDS, INTENT_PATTERNS };

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
const EXCLUDED_TEMPLATES = ['blank', 'cover', 'instructionSlide'];

// Short usage hints for data/chart templates — helps the router pick the right one
const TEMPLATE_USAGE_HINTS = {
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

function buildTemplateList() {
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
- freestyle: Custom layout composed from components. USE WHEN content doesn't naturally fit any template above, or item count is outside all capacity ranges. The slide designer has a full toolkit of layouts (cards, grids, timelines, split views, KPI blocks, bullet lists, process flows, stat highlights, etc.) and will choose the best one based on the content.
  Optional "layoutGuidance" field: Describe the CONTENT SHAPE, not the layout name. Examples: "3 strategic pillars each with a metric", "before vs after comparison", "5 quarterly milestones with deliverables", "one hero stat with supporting context". The designer picks the visual treatment.

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

function getRouterSystemPrompt() {
  return `You are a slide presentation router/planner. Create execution plans based on the user's request.
TODAY: ${currentDateString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRST: DECIDE WHETHER TO ASK CLARIFYING QUESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEFAULT BEHAVIOR: BUILD THE PLAN — unless the request is too short/vague to produce good slides.

SKIP QUESTIONS (just build) when:
- The request is any kind of edit, rework, addition, or restyle ("fix this slide", "add a slide about X", "switch template", "rework slide 3")
- The request gives a clear topic WITH some direction or context (e.g., "create slides about our Q3 performance focusing on revenue growth", "make a deck on AI trends for the board")
- The prompt contains "User clarification:" — the user already answered. Build now.
- The prompt contains "PENDING PLAN" + "User reply:" — there was already a plan waiting for approval. See the PENDING PLAN section below.
- The request starts with "PRESENTATION CONTENT" — agent mode, context is complete.
- The request includes attached documents or pasted data.
- The deck already has slides (the user is iterating, not starting from scratch)

ASK QUESTIONS when ANY of these is true:
- The user gives only a SHORT TOPIC (1-4 words) without any context, angle, or details (e.g., "Market Analysis", "Digital Transformation", "Company Overview"). Ask what specific angle/scope they want and how many slides.
- The user is asking to create a FULL NEW presentation from scratch AND the topic is genuinely ambiguous
- The request is LARGE-SCALE (10+ slides, full deck, comprehensive presentation, "create everything about X") — ask 1-2 questions to confirm scope, key angles, and what to prioritize.
- You truly lack the minimum information to produce anything useful
- Maximum 2-3 focused questions. Never more.

When asking, return ONLY a "questions" array (no "plan"). Each question: { "question": string, "options": [2-5 specific choices] }.
Focus questions on CONTENT and SCOPE — what angle, what key points, how many slides. Do NOT ask about audience or style.

Example:
{
  "questions": [
    {"question": "What aspect of growth should this focus on?", "options": ["Revenue growth trends", "User/customer growth", "Market expansion strategy", "Team growth & hiring"]}
  ]
}

If the request is clear enough → skip questions and build the plan below.

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

SECTION DIVIDERS:
- Only include sectionDivider slides when a section has 5 or more body slides.
- Small sections (fewer than 5 slides) do NOT need a divider — the sectionTracker label is enough.
- Exception: if the user explicitly asks for section separators/dividers, include them regardless of section size.

Do NOT try to write detailed instructions — the system injects the full curated content automatically.
Keep step instructions minimal: just the Key Message + Data Points if present.

Steps see ONLY: (1) your instruction (which gets replaced with the full stored instruction), (2) contextSlides content if provided.

ACTIONS: create_slide, edit_slide, delete_slide, switch_template, answer_question

CRITICAL: Greetings and small talk (hi, hello, hey, thanks, bye) MUST use answer_question. NEVER create slides for conversational messages.

CRITICAL - "contextSlides" MECHANISM:
When user references specific slides (e.g., "detail slide 3", "like page 5", "based on current slide"):
- EACH step MUST have its own "contextSlides": [index, ...] array (0-based indices)
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

IMAGE-BASED SLIDE CREATION:
When content shows "[SLIDE IMAGE]" - create ONE slide mimicking that image.

${AI_ROUTER_TEMPLATES}

TEMPLATE SELECTION:
- Match template to content structure (3 items → threeCards, process → timeline)
- CAPACITY: Each template shows [min-max items] in the list above. RESPECT these limits strictly.
  If your content has 5 points, do NOT pick a template with max 4. Pick one that fits (e.g., executiveSummary [3-5] instead of threeCards [3]).
  If your exec summary needs 6 sections, no exec template fits — use "freestyle" or split into two overview slides.
- SPLITTING: When content exceeds a template's max capacity, DUPLICATE the template across multiple slides rather than cramming.
  Example: 15 initiatives → use initiativesLongList twice (slides 1-10 and 11-15), NOT one overflowing slide.
- FLEXIBLE: Item count within the stated range — templates adjust automatically
- NOT FLEXIBLE: Structural depth (phases-only vs phases-with-substeps needs different template)
- If no template fits the item count, use "freestyle" with layoutGuidance for custom layout
- VISUAL VARIETY (CRITICAL): A deck MUST feel visually diverse. Every slide should look different from its neighbors.
  - NEVER use the same templateId for consecutive slides (unless content absolutely demands it, like a CV series).
  - For freestyle slides: vary your layoutGuidance descriptions. If one slide describes "3 pillars with metrics", the next should NOT also be "3 items with metrics" — use a different content shape (e.g., timeline, comparison, stat highlight, numbered steps).
  - Across a full deck, aim for at least 3 distinct visual patterns. A 5-slide deck with 5 card-row slides is a failure.
  - Mix structural templates with freestyle. Mix card-based with list-based with grid-based with metric-based.
  - There are 70+ templates available plus freestyle — use that variety.

FREESTYLE WITH LAYOUT GUIDANCE:
When using templateId: "freestyle", you can optionally provide a "layoutGuidance" field.
The slide designer has a rich toolkit and will choose the best layout based on the content. Your guidance should describe the CONTENT SHAPE, not dictate a specific layout.

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

CONTENT FIDELITY — PRESERVE THE ESSENCE (CRITICAL):
You are a ROUTER, not an editor. Your job is to SELECT templates and PASS THROUGH content — not to rewrite, paraphrase, or reinterpret the user's content.
- NEVER change the meaning, tone, or form of the user's content. If the user provides questions, they MUST remain as questions. If the user provides bullet points, they MUST remain as bullet points. If the user provides specific phrasing, PRESERVE it.
- WRONG: User says "What are our growth levers?" → Router rewrites to "Key growth levers" (turned question into statement)
- RIGHT: User says "What are our growth levers?" → Router passes "What are our growth levers?" as-is
- WRONG: User says "3 risks: supply chain, currency, regulation" → Router rewrites to "Three key risk categories in operations"
- RIGHT: Pass "3 risks: supply chain, currency, regulation" as-is
- When the user provides STRUCTURED CONTENT (slide-by-slide specs, numbered items, specific data), pass it through VERBATIM in the instruction field. Do not summarize, reorganize, or rephrase.
- You may ADD context (e.g., data points, trackers) but NEVER SUBTRACT or MODIFY what the user wrote.

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

SECTION TRACKER + EXECUTIVE SUMMARY:
For structured decks (7+ slides or when the agent provides SECTION TRACKERS), every body slide carries a "sectionTracker" label — a short tab shown on the slide (e.g. "1. Strategy", "2. Financials"). Section trackers are useful navigation labels regardless of whether an executive summary slide is included.
The executiveSummary template (optional) shows numbered boxes in a 4-column grid — each box has a number, an INSIGHT-DRIVEN title (4-7 words — a mini-conclusion, NOT a generic label; e.g. "Digital up 40% despite headwinds" NOT "Market Overview"), and a one-sentence insight (8 words max). When included, it provides a high-level overview of the deck. If present, its items should correspond 1:1 to the section trackers on body slides.

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
- "create N slides" = output ALL steps (up to 30 max)
- INDEXING: 0-based internally. "slide 1" = index 0
- Put ALL guidance in "instruction" field - no separate content field
- EACH step referencing slides MUST have contextSlides with exact indices (up to 5)
- Reference items by position (pillar 1, item 2, first bullet, etc.) - NEVER invent names
- AUTO COVER: When creating a new deck from scratch (empty deck or no cover exists), ALWAYS add a cover slide as the FIRST step (templateId: "cover", position: "start"). This applies regardless of how many slides are being created.

DECK STRUCTURE & STORYTELLING (think like a senior consulting partner):
- PYRAMIDAL STRUCTURE: Lead with the answer/governing thought. The structure after the cover depends on the REQUEST — do NOT default to a proposal format. Match the deck structure to what the user actually asked for.
- FOR LARGE DECKS (7+ slides or when SECTION TRACKERS are provided): Cover → [optional Executive Summary (ONE slide, 2-5 key themes, template: executiveSummary)] → Body Slides → Wrap-up. IMPORTANT: If the prompt already contains an executive summary, table of contents, deck overview, section preview, or any tracking/overview slide, do NOT add another — just pick the right template for the existing one. When the prompt says the slide list is complete, add ONLY the cover and pick templates — no new slides of any kind. In AGENT MODE, NEVER add an executive summary — the agent's slide list is final.
- FOR SMALL DECKS (≤6 slides or when NO section trackers are provided): Cover → Content Slides → Closing. No executive summary — go straight to content.
- PARENT-CHILD GROUPING: When there are N key points (e.g., 3 pillars, 4 strategies), create a summary/overview slide FIRST that names all N, then one detail slide per point. The overview slide is the "parent" and the detail slides are its "children".
  Example: "3 Growth Pillars" overview slide → Pillar 1 detail → Pillar 2 detail → Pillar 3 detail
- ONE MESSAGE PER SLIDE: Never crowd a slide with multiple themes. Each slide makes exactly one point. If content is too dense, split into multiple slides.
- FLOW: Every slide must logically connect to the next. No orphan slides. The reader should feel a seamless narrative arc tailored to the topic.
- WHITE SPACE IS GOOD: Prefer more slides with clean, focused content over fewer slides crammed with information.
- TEMPLATE VARIETY: Slides within the same section MUST use DIFFERENT templates to avoid visual monotony. If a section has 3 slides about market data, DON'T use barChartExhibit for all 3 — vary between barChartExhibit, twoColumnExhibit, statFocusExhibit, etc. Pick the template that best fits each slide's specific content type.
- CLOSING SLIDE: The last slide should match the content — a summary, key takeaways, or synthesis. Do NOT always default to "next steps" or "action plan" — only include those if the request is genuinely about a proposal or plan that warrants them.

SLIDE TITLES TELL THE STORY (CRITICAL):
For EVERY slide step, embed the title and subtitle at the START of the instruction using these markers:
  TITLE: [8-12 word business insight header — verbal, makes a strategic claim]
  SUBTITLE: [3-4 word noun phrase topic label]
  Then the content on the next line.

Example instruction: "TITLE: Strategic pillars position us for sustained market growth\nSUBTITLE: Growth Strategy\n3 pillars: 1) Innovation - modernize systems, 2) Growth - 3 new markets, 3) Efficiency - cut 20%"

The generation step MUST use these exact titles — it may lightly adjust word count but must preserve the specific data, claims, and terminology.

If someone reads ONLY the TITLE: lines top-to-bottom, they should understand the entire argument.
- BAD: "TITLE: Market Overview" → "TITLE: Analysis" → "TITLE: Strategy" (labels, not a story)
- GOOD: "TITLE: Iraq is a $12B untapped market" → "TITLE: Three entry paths with different risk profiles" → "TITLE: Phased approach minimizes risk"
When the agent provides SLIDE TITLE in the instruction, use it as the TITLE: marker. Do not replace it with a generic label.

CROSS-SLIDE COHERENCE (CRITICAL — slides are generated independently in parallel):
Each slide is built by a separate AI call that sees ONLY its own instruction (+ any contextSlides). Slides do NOT see each other's content during generation. YOU are the only one who sees the whole picture, so YOU must ensure coherence:

1. BAKE SHARED DATA INTO EVERY INSTRUCTION: If slide 3 lists "Top 5 opportunities: A, B, C, D, E" and slides 8-12 detail each one, you MUST name the EXACT opportunity in each detail slide's instruction. Do NOT say "detail the first opportunity" — say "detail Opportunity A: [specific name/description]". The sub-agent for slide 8 has NO idea what slide 3 said unless you tell it.

2. USE contextFromStep FOR DEPENDENT SLIDES: When a detail slide MUST match a summary slide's content, add "contextFromStep": N (the step index of the summary). This injects the summary slide's HTML into the detail slide's context so it can read the exact items.

3. USE EXECUTION GROUPS FOR DEPENDENCIES: Put the summary/overview slide in an earlier group so it's created FIRST. Then detail slides in a later group can reference it via contextFromStep.
   Example: "groups": [[0, 1], [2, 3, 4, 5, 6]] — cover + exec summary first, then all body slides.
   When detail slides need to reference the overview: "groups": [[0], [1], [2, 3, 4, 5]] — cover first, then overview, then details that reference it.

4. CONSISTENT TERMINOLOGY: If you name something "Digital Transformation" in the overview instruction, use EXACTLY "Digital Transformation" in detail slide instructions — not "Digital Innovation" or "Tech Modernization".

5. NUMBERS AND DATA POINTS: When specific numbers appear in one slide (e.g., "$4.2B market size"), repeat the EXACT same number in related slides. Don't let parallel sub-agents invent different figures.

6. SEARCH FOR REAL DATA: When the topic involves facts, statistics, or current information, add "searchQuery" to the relevant slides. Real data prevents the sub-agents from hallucinating inconsistent numbers. Prefer one good search on the overview slide, then use contextFromStep to propagate those results to detail slides.

SLIDE POSITIONING:
- POSITION values: "start", "end", {"after_slide": N}, "after_previous"
- Title/Cover slides MUST use position: "start"
- Content slides use "end" or "after_previous"
- Multiple slides: first gets specific position, rest use "after_previous"

STEP-LEVEL WEB SEARCH:
Check the "Web search available" field in CURRENT STATE. If YES, you MAY add a "searchQuery" field to steps that would benefit from real data. The search runs BEFORE the slide is created and results are injected into the step's context.
- searchQuery must be PRECISE to what THIS SLIDE needs — not a broad topic search
  WRONG: "S&P 500 performance" ← too broad, will return generic info
  RIGHT: "S&P 500 annual returns 2020 2021 2022 2023 ${new Date().getFullYear()} percentage" ← precise, gets the exact numbers the slide needs
  RIGHT: "Apple revenue Q4 ${new Date().getFullYear()} earnings results" ← specific company, specific quarter
- WHEN TO ADD searchQuery:
  - The topic involves data, statistics, financials, market info, or recent events
  - The instruction lacks specific numbers, metrics, or current figures
  - The slide would be stronger with real data instead of generic statements
- AGENT MODE EXCEPTION: When the prompt starts with "PRESENTATION CONTENT (from consulting team research)", the consulting team already researched and embedded data into the slide instructions. Do NOT add searchQuery — the data is already there. Only add searchQuery if a slide explicitly says it needs fresh data.
- Do NOT add searchQuery if: the instruction already contains specific numbers, or the slide is purely conceptual (e.g. "thank you" slide, executive overview, process diagram)

RESPONSE FORMAT (JSON only):

Example — simple request (no agent, no documents):
{
  "plan": [
    {"action":"create_slide","templateId":"cover","position":"start","instruction":"Digital Transformation Strategy - Q1 2025 Initiative"},
    {"action":"create_slide","templateId":"freestyle","layoutGuidance":"3 strategic pillars, each with a key metric and one-sentence impact","position":"after_previous","instruction":"3 pillars: 1) Innovation - modernize systems, 2) Growth - 3 new markets, 3) Efficiency - cut 20%"},
    {"action":"create_slide","templateId":"freestyle","layoutGuidance":"5 implementation milestones with deliverables across H2 2025","position":"after_previous","instruction":"Implementation roadmap: 5 key milestones for H2 2025"}
  ],
  "groups": [[0,1,2]],
  "sourceSlides": [],
  "needsStoryline": false,
  "needsReplanning": false
}
Note: layoutGuidance describes the content shape — the designer picks the visual treatment (cards, grids, timelines, etc.).
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

REMEMBER:
- DOCUMENTS/AGENT = rich context → extract and include ALL research (numbers, findings, context, explanations) in each step's instruction
- In agent mode: YOU choose templates, agent provides content + research only
- NEVER drop or summarize research — pass the full Instruction + Data Points through to the step instruction
- SLIDES: You can't see content (only titles) → use contextSlides, reference by position`;
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
  } = context;

  // Get router model - use big model if requested, otherwise pick based on agentMode
  const defaultRouterModel = 'gemini:gemini-2.0-flash';
  const bigModel = settings.model || 'openai:gpt-4o'; // Use main model as "big" model

  // When not in agent mode, use chatbot router settings (if configured), allowing more freedom
  const effectiveRouterModel = !agentMode && settings.chatRouterModel
    ? settings.chatRouterModel
    : (settings.routerModel || defaultRouterModel);
  const effectiveReasoningEffort = !agentMode
    ? (settings.chatRouterReasoningEffort || 'medium')
    : (settings.routerReasoningEffort || 'none');
  const effectiveMaxTokens = !agentMode
    ? (settings.chatRouterMaxTokens || 16384)
    : (settings.routerMaxTokens || 16384);
  const effectiveSearchEnabled = !agentMode
    ? (settings.chatRouterSearchEnabled !== undefined ? settings.chatRouterSearchEnabled : true)
    : (settings.routerSearchEnabled || false);

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

  // Add web search tool if router search is enabled (same pattern as agent search)
  if (effectiveSearchEnabled) {
    routerSettings._extraTools = [{
      type: 'web_search_preview',
      search_context_size: settings.searchContextSize || 'medium',
    }];
  }

  // Build compact slide list — index, title, and template type. Mark the current slide.
  const slideList = slideSummaries.length > 0
    ? slideSummaries.map(s => {
        const isCurrent = s.index === currentSlideIndex;
        let line = `  ${s.index}: "${s.title}" (${s.template || 'custom'})${isCurrent ? '  ← CURRENT SLIDE' : ''}`;
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

  const searchAvailable = !!(settings.searchEnabled && settings.searchEndpoint && settings.searchApiKey);

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

  const contextInfo = `CURRENT STATE:
- Total slides: ${slideCount}
- User is viewing slide index ${currentSlideIndex} (0-based) → slide ${currentSlideIndex + 1} of ${slideCount}. "this slide" or "current slide" = index ${currentSlideIndex}.
- Has cover slide: ${hasCoverSlide ? 'YES' : 'NO'}
- Storyline: ${storylineSummary || 'none'}
- Max parallel steps per group: ${parallelBatchSize}
- Web search available: ${searchAvailable ? 'YES — add "searchQuery" to steps that need real-time or specific data' : 'NO — do not add searchQuery'}
${layoutSummary ? `- LAYOUTS ALREADY IN DECK: ${layoutSummary} — DO NOT repeat the most-used layouts. Pick different templates and content shapes for new slides.` : ''}
${agentModeNote}${imageModeNote}${documentSection}
SLIDE TITLES:
${slideList}
${referencedSlidesSection}
${activeFlow ? `\nACTIVE FLOW: "${activeFlow.name}"
Overall guidance: ${activeFlow.overallGuidance || 'none'}
Sections:
${activeFlow.sections.map((s, i) => `  ${i + 1}. template="${s.templateHint}" | instruction="${s.instruction}"${s.isRepeatable ? ` | REPEATABLE (${s.repeatSource})` : ''}`).join('\n')}
` : ''}
USER REQUEST: "${routerPrompt}"`;

  const routerCallStart = Date.now();

  try {
    // Log context size for debugging
    const contextWords = contextInfo.split(/\s+/).length;
    const contextChars = contextInfo.length;
    const estimatedTokens = Math.ceil(contextChars / 4); // Rough estimate: 4 chars per token

    const hasImages = pendingImages && pendingImages.length > 0;

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
      prompt: userPrompt.slice(0, 100),
      contextWords,
      contextChars,
      estimatedTokens,
      hasImages,
    });

    // Retry with jittered backoff: immediate → ~1.5s, then give up
    // 429 (rate limit) fails fast — retrying worsens congestion for all concurrent users
    let response;
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
            getRouterSystemPrompt(),
            contextInfo,
            pendingImages
          );
        } else {
          response = await callGeminiAPI(
            routerSettings,
            getRouterSystemPrompt(),
            contextInfo
          );
        }

        console.log('[AI Router] Full response:', response);

        // Check for empty response
        if (!response || response.trim() === '') {
          if (attempt < routerBaseDelays.length - 1) {
            console.warn(`[AI Router] Empty response on attempt ${attempt + 1} — retrying. Prompt length: ${contextInfo.length} chars`);
            continue;
          }
          console.error('[AI Router] Empty response after all retries. Model:', routerModelRef, 'Prompt length:', contextInfo.length, 'chars', 'Has docs:', hasDocumentsAttached);
          debugLog(LogLevel.WARN, 'aiRouteRequest', 'Empty response from API after retries', {
            model: routerModelRef,
            promptLength: contextInfo.length,
            hasDocuments: hasDocumentsAttached,
            documentContentLength: documentContent?.length || 0,
          });
          throw new Error(`AI router returned an empty response (model: ${routerModelRef}, prompt: ${contextInfo.length} chars, docs: ${hasDocumentsAttached ? 'yes' : 'no'}). The API may be overloaded. Please try again.`);
        }
        break; // Got a valid response
      } catch (routerErr) {
        // 429 = rate limit — fail immediately, retrying worsens congestion
        if (routerErr.isRateLimit) {
          console.warn(`[AI Router] Rate limited — failing fast (no retry/fallback)`);
          throw routerErr;
        }
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
        // All retries exhausted — try fallback to main model if different (not on rate limit)
        const mainModel = settings.model;
        if (mainModel && mainModel !== routerModelRef) {
          console.warn(`[AI Router] Router model "${routerModelRef}" failed after retries: ${routerErr.message.slice(0, 200)}`);
          console.log(`[AI Router] Falling back to main model: ${mainModel}`);
          try {
            const fallbackRouterSettings = { ...routerSettings, model: mainModel };
            response = await callGeminiAPI(fallbackRouterSettings, getRouterSystemPrompt(), contextInfo);
            break; // Fallback succeeded
          } catch (fallbackErr) {
            console.error(`[AI Router] Fallback model "${mainModel}" also failed:`, fallbackErr.message.slice(0, 200));
          }
        }
        throw routerErr; // Non-retryable error, no fallback available
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
      debugLog(LogLevel.WARN, 'aiRouteRequest', 'No JSON in response', { responsePreview: cleanResponse.slice(0, 200) });
      throw new Error(`AI router returned invalid response (no JSON). Response was: "${cleanResponse.slice(0, 100)}...". Please try again.`);
    }

    let parsed;
    try {
      parsed = safeJSONParse(jsonMatch[0], 'AI Router');
    } catch (parseError) {
      console.error('[AI Router] JSON parse error:', parseError, 'Raw:', jsonMatch[0]);
      throw new Error(`AI router returned malformed JSON: ${parseError.message}. Please try again.`);
    }

    console.log('[AI Router] Parsed:', parsed);

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
    });
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
      // Expected = 1 cover + N agent slides = fullInstructionMap.size + 1.
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

        return {
          action: step.action,
          templateId: step.templateId || null,
          slideIndex: step.slideIndex ?? null,
          contextSlides: step.contextSlides || [],
          instruction: mergedInstruction,
          position: step.position || 'end',
          contextFromStep: step.contextFromStep ?? null,
          // Content from documents/images passed by router (factual mode)
          content: step.content || null,
          // Optional: search query if this step needs fresh web data
          searchQuery: step.searchQuery || null,
          // Section tracker (main) — e.g. "1. Strategy"
          sectionTracker: step.sectionTracker || null,
          // Sub-section tracker (secondary)
          subSectionTracker: step.subSectionTracker || null,
          // Layout guidance for freestyle slides (e.g., "2x2", "icons", "numbered")
          layoutGuidance: step.layoutGuidance || null,
        };
      }),
      groups: parsed.groups || null,
      needsReplanning: parsed.needsReplanning || false,
      contextNeeded: {
        type: contextSlideIndices.length > 0 ? 'slide_html' : 'none',
        slideIndices: contextSlideIndices,
        includeTemplate: !!firstStep.templateId,
        includeStoryline: parsed.needsStoryline || false,
        reason: `Plan needs ${contextSlideIndices.length} source slide(s)`,
      },
      params: {
        slideIndex: firstStep.slideIndex ?? currentSlideIndex,
      },
      aiRouted: true,
      // Batch continuation - if more slides are requested than max batch (5)
      remainingCount: parsed.remainingCount || 0,
      // Debug info for UI display
      routerDebug: {
        model: routerModelRef,
        contextSent: {
          slideCount,
          currentSlideIndex,
          layoutSummary,
          storylineSummary,
          slideSummaries,
        },
        systemPrompt: getRouterSystemPrompt(),
        userPrompt: contextInfo,
        rawResponse: response,
        parsedResponse: parsed,
      },
    };

    debugLog(LogLevel.INFO, 'aiRouteRequest', 'AI routing complete', {
      intent: result.intent,
      template: result.templateMatch?.templateId,
      confidence: parsed.confidence,
    });

    // Audit log for router calls — visible in AuditLogViewer
    const routerDuration = Date.now() - routerCallStart;
    const routerRole = agentMode ? 'router:agent' : 'router:chatbot';
    audit(routerRole, result.intent === 'clarify' ? 'asked questions' : `routed: ${result.intent}`, {
      model: routerModelRef,
      query: userPrompt.slice(0, 300),
      context: `${parsed.plan?.length || 0} steps, confidence: ${parsed.confidence || 'n/a'}`,
      maxTokens: routerSettings.maxTokens || null,
      reasoningEffort: routerSettings.reasoningEffort || null,
      searchEnabled: effectiveSearchEnabled,
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
      query: userPrompt.slice(0, 300),
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

// ============================================
// END CONTEXT-FETCH DETECTION
// ============================================

// Default system prompt - can be overridden in settings
export const DEFAULT_SYSTEM_PROMPT = `You are an expert Strategy& consulting presentation designer. Generate professional, executive-quality HTML slides.

${CSS_STYLE_GUIDE}

CONTENT MODE - CRITICAL:
You MUST ALWAYS produce a complete slide. Never return JSON errors or "no context" messages.

1. FACTUAL MODE (when "=== SOURCE CONTENT ===" is provided):
   - Use ONLY the provided source content to fill the slide
   - Do NOT invent additional data - stick to what's given
   - Adapt the template to fit the content (fewer items is OK)

2. CREATIVE MODE (when no source content is provided):
   - Generate appropriate professional content to fill the template
   - Create realistic consulting-style data, metrics, and insights
   - Make the slide useful and complete with generated content

In both modes: ALWAYS output valid HTML. Never output JSON or error messages.

EXECUTIVE DESIGN PRINCIPLES:
- Slides must be CLEAN, UNCLUTTERED, and BREATHABLE - less is more
- Maximum 3-4 key points per slide - executives don't read walls of text
- Use whitespace strategically - crowded slides lose the audience
- Every element must earn its place - remove anything that doesn't add value
- HEADER (h1): verbal "so what" sentence 10-12 words (e.g., "AI delivers 3x ROI in year one"), TITLE (h2): noun phrase 3-4 words NO verbs (e.g., "Implementation results")
- SECTION TITLES (h3, h4): insight-driven phrases 4-7 words that convey a takeaway — never generic labels. Write a mini-conclusion the reader can understand without reading the body. GOOD: "Digital up 40% despite headwinds", "Three gaps eroding margins", "Talent shortage blocks expansion". BAD: "Market Overview", "Key Findings", "Cost Analysis", "Next Steps". Think: if someone only reads the titles, do they get the story?
- Visual hierarchy is critical: one main message per slide
- Think boardroom-ready: would a CEO present this?

CONSULTING STORYTELLING (for multiple slides):
- PYRAMID PRINCIPLE: Lead with the answer, then support with evidence
- MECE: Mutually Exclusive, Collectively Exhaustive - no overlaps, no gaps
- STORY FLOW: Each slide connects logically to the next
- If creating slides about "3 pillars", consider: 1 overview + 3 detail slides
- Build arguments that executives can follow without explanation

TEMPLATE DISCIPLINE - CRITICAL:
- STRICTLY FOLLOW THE TEMPLATE STRUCTURE - replicate the exact HTML structure, classes, and layout
- DO NOT add, remove, or rearrange structural elements (columns, sections, panels) unless user explicitly requests it
- DO NOT invent new CSS classes or HTML structures - use exactly what the template provides
- DO NOT add inline styles, change colors, or add visual elements (shapes, borders, backgrounds) not in template
- If user specifies a different structure, follow their instructions; otherwise, match the template exactly
- When in doubt, replicate the template structure precisely - consistency is more important than creativity

ITEM COUNT FLEXIBILITY (bullets, cards, pillars):
- DEFAULT: Keep the template's item count — this is the strongly preferred behavior
- NEVER merge distinct entities (specific names, products, data rows, table entries, items explicitly listed by user)
- CAN adjust count only when content clearly requires it (e.g., user explicitly lists 5 named things for a 3-card template)
- Use common sense: named/specific items must stay separate; abstract concepts can be consolidated to match template count

UNSTRUCTURED TEXT (text dumps):
- If user provides a paragraph or unstructured text, YOU decide the best way to structure it visually
- NEVER output raw paragraphs or text blocks — always extract key points and organize them into a VISUAL component (cards, bullets, grids, KPIs, etc.)
- Extract key points and organize them to fit the template's layout
- Slight rewording is OK to make content fit cleanly into bullets, cards, or sections
- The goal is to make the content VISUAL and STRUCTURED, not to preserve exact wording of raw text

FRAME FIT — CRITICAL:
- Content MUST fit within the .frame (890×353px). NEVER let content overflow or extend beyond the frame boundaries.
- If you have too many items, reduce count or shorten text — a clean 4-card layout beats a cramped 8-card layout.
- For side-by-side layouts (two-col, split-layout, card-row): ensure left and right content have BALANCED heights. If one column is much taller, reduce its content. Unbalanced columns cause wrapping/overlap.
- ALWAYS use the pre-styled CSS classes (card-row, two-col, split-layout, grid-2x2) for side-by-side layouts — do NOT create custom float, inline-block, or absolute positioning that can break.

CONTENT GUIDELINES:
- Use specific data, percentages, and metrics - executives want facts
- Professional consulting tone - strategic, data-driven, actionable
- Cards: impactful headers + supporting text + impact-box where applicable
- Use emoji icons sparingly in card-icon-circle elements (🎯 ⚙️ 🚀 📊 💡)

LIST QUALITY (CRITICAL — never leave bullets looking "plain"):
- ALWAYS add a class to every <ul> or <ol> — use: content-list (default, card-like with accent border), exec-bullet-list (premium), insight-list (arrows), check-list (checks), styled-list (em-dash dividers)
- Every <li> MUST have: <strong>Bold lead phrase</strong> — explanation with data (15-25 words total)
- NEVER write bare lists without a class or plain text bullets without the bold+dash pattern
- For 5+ items, use content-list compact or exec-bullet-list to avoid overflow

LAYOUT 1 - COVER SLIDE (use for first slide):
<div class="slide cover-slide">
  <div class="frame">
    <div class="cover-category">DIGITAL TRANSFORMATION</div>
    <div class="cover-title">Enterprise AI Strategy Framework for Sustainable Growth</div>
  </div>
  <div class="cover-branding">Strategy&</div>
  <div class="cover-date">December 2025</div>
</div>

LAYOUT 2 - THREE-CARD PILLARS (best for frameworks, phases, pillars):
<div class="slide">
  <h1 class="title">Three strategic pillars drive enterprise AI adoption at scale</h1>
  <h2 class="subtitle">Strategic Framework</h2>
  <div class="frame">
    <div class="card-row">
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">🎯</div>
          <div class="card-num">01</div>
        </div>
        <h3>Foundation Layer</h3>
        <p>Establish robust data infrastructure with unified governance protocols.</p>
        <div class="impact-box">Timeline: 6-12 months</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">⚙️</div>
          <div class="card-num">02</div>
        </div>
        <h3>Capability Building</h3>
        <p>Deploy AI tools across customer service, operations, and planning.</p>
        <div class="impact-box">Timeline: 12-18 months</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">🚀</div>
          <div class="card-num">03</div>
        </div>
        <h3>Scale & Optimize</h3>
        <p>Enterprise rollout with continuous improvement and benchmarking.</p>
        <div class="impact-box">Timeline: 18-24 months</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>2</span>
  </footer>
</div>

LAYOUT 3 - TWO-COLUMN KPI (best for metrics, results):
<div class="slide">
  <h1 class="title">AI implementation delivers 3x returns within first year</h1>
  <h2 class="subtitle">Performance Metrics</h2>
  <div class="frame">
    <div class="two-col">
      <div class="col-left">
        <div class="kpi-block">
          <div class="kpi-value">47%</div>
          <div class="kpi-label">Reduction in processing time</div>
        </div>
        <div class="kpi-block">
          <div class="kpi-value">3.2x</div>
          <div class="kpi-label">Return on investment</div>
        </div>
        <div class="kpi-block">
          <div class="kpi-value">$12M</div>
          <div class="kpi-label">Annual cost savings</div>
        </div>
      </div>
      <div class="col-right">
        <div class="detail-item">
          <h4>Process Automation</h4>
          <p>65% reduction in manual data entry across operations.</p>
        </div>
        <div class="detail-item">
          <h4>Customer Experience</h4>
          <p>AI handles 40% of inquiries with 92% satisfaction.</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>3</span>
  </footer>
</div>

LAYOUT 4 - TIMELINE (best for roadmaps):
<div class="slide">
  <h1 class="title">Implementation roadmap spans 18 months in three phases</h1>
  <h2 class="subtitle">Project Timeline</h2>
  <div class="frame">
    <div class="timeline-container">
      <div class="timeline-row">
        <div class="timeline-marker">Q1-Q2</div>
        <div class="timeline-content">
          <h4>Discovery & Planning</h4>
          <p>Assess current state, identify quick wins, build business case.</p>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-marker">Q3-Q4</div>
        <div class="timeline-content">
          <h4>Pilot & Iterate</h4>
          <p>Launch pilots in 2-3 units, gather learnings, refine approach.</p>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-marker">Y2</div>
        <div class="timeline-content">
          <h4>Scale & Optimize</h4>
          <p>Enterprise rollout with performance tracking dashboards.</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>4</span>
  </footer>
</div>

LAYOUT 5 - QUOTE/INSIGHT:
<div class="slide">
  <h1 class="title">Executive leadership recognizes transformational impact</h1>
  <h2 class="subtitle">Leadership Perspective</h2>
  <div class="frame">
    <div class="quote-box">
      <p class="quote-text">"This initiative has fundamentally changed how we operate. The efficiency gains alone justified the investment."</p>
      <p class="quote-author">— Sarah Chen, Chief Digital Officer</p>
    </div>
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>5</span>
  </footer>
</div>

LAYOUT 6 - CONTENT LIST (keep to 4-5 items max — every li needs <strong> lead + em-dash + detail):
<div class="slide">
  <h1 class="title">Five critical success factors drive transformation outcomes</h1>
  <h2 class="subtitle">Key recommendations</h2>
  <div class="frame">
    <ul class="content-list">
      <li><strong>Executive sponsorship from day one</strong> — C-suite visibility ensures resources and removes cross-functional blockers</li>
      <li><strong>Change management alongside technology</strong> — 70% of transformations fail due to people, not tech</li>
      <li><strong>High-impact, low-complexity first</strong> — early wins build momentum and fund the broader roadmap</li>
      <li><strong>Cross-functional teams</strong> — blending business domain experts with engineers prevents ivory tower solutions</li>
      <li><strong>Clear metrics from the start</strong> — define KPIs upfront to track progress and communicate wins to stakeholders</li>
    </ul>
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>6</span>
  </footer>
</div>

LAYOUT 7 - 2x2 GRID:
<div class="slide">
  <h1 class="title">Four capability areas define the transformation agenda</h1>
  <h2 class="subtitle">Capability Framework</h2>
  <div class="frame">
    <div class="grid-2x2">
      <div class="grid-cell">
        <h4>Data & Analytics</h4>
        <p>Unified platform with real-time analytics and self-service BI.</p>
      </div>
      <div class="grid-cell">
        <h4>Process Automation</h4>
        <p>40-60% reduction in manual effort across target processes.</p>
      </div>
      <div class="grid-cell">
        <h4>Customer Intelligence</h4>
        <p>360° view with predictive insights for personalization.</p>
      </div>
      <div class="grid-cell">
        <h4>Digital Products</h4>
        <p>New revenue streams targeting 15% of revenue in 3 years.</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>7</span>
  </footer>
</div>

RULES:
1. Return ONLY raw HTML, no markdown code blocks
2. Each slide wrapped in <div class="slide">
3. KEEP IT CLEAN - executives hate crowded slides
4. Use insight-driven headlines with the key message
5. Include specific numbers and percentages
6. Less text, more impact - every word must count
7. PAGE NUMBERS: Footer second span should contain ONLY the page number (e.g., "2"), NOT "2 / 5". Numbers are updated dynamically.
8. COVER & THANK YOU SLIDES: These use cover-branding for the brand name. Do NOT add a <footer> element — they already have cover-branding. Adding a footer creates duplicate branding.
9. VERTICAL LOGIC: The header (h1) MUST be consistent with the content below it. If the header says "Three pillars..." the slide MUST have exactly 3 items. If you have 4 cards, write "Four key drivers..." not "Three...". Count your content items FIRST, then write the header to match.
10. LIST QUALITY: Every <ul>/<ol> MUST have a class (content-list, exec-bullet-list, insight-list, check-list, styled-list). Every <li> MUST use <strong>Lead</strong> — detail pattern. Never output bare unstyled lists.`;

// Freestyle component guide - comprehensive layout examples and strict constraints for custom slides
export const FREESTYLE_COMPONENT_GUIDE = `# SLIDE VISUAL THEME & STRUCTURE

## CSS TOKENS (always use var(--token) — NEVER hardcode colors!)
Text: var(--heading), var(--body), var(--muted)
Accent: var(--accent), var(--accent-soft), var(--on-accent)
Surfaces: var(--page), var(--surface), var(--surface-alt), var(--border)
Fonts: Titles = Georgia serif 28px, Subtitles = Arial bold 18px, Body = Arial 12px
Icons: 🎯 ⚙️ 🚀 📈 💰 👥 ⚡ 🔧 📊 💡 ✓ → ★

CRITICAL — INLINE STYLE RULES:
- NEVER use inline styles for layout or positioning (no position, top, left, width, height, display:flex, display:grid, float, transform).
- NEVER hardcode colors (no #hex, no rgb(), no color names). ALWAYS use var(--token).
- The ONLY acceptable inline styles: color with tokens (style="color: var(--accent)"), margin-top for minor spacing, font-weight for emphasis.
- ALL layout and sizing is handled by the pre-styled CSS classes below. Trust them.

## SLIDE STRUCTURE (every slide MUST follow this exact wrapper — no exceptions)
<div class="slide">
  <h1 class="title">One clear "so what" insight — 8-12 words, full sentence</h1>
  <h2 class="subtitle">Short Label (2-4 words, noun phrase, no verbs)</h2>
  <div class="frame">
    <!-- ONE layout component here — pick from examples below -->
  </div>
  <footer class="footer"><span>Brand</span><span>1</span></footer>
</div>

POSITIONING (handled by CSS — do NOT override):
- h1.title: absolute at top 30px, Georgia 28px, full width
- h2.subtitle: absolute at top 101px, Arial bold 18px, accent color
- div.frame: absolute at top 137px, 890px wide × 353px tall — ALL content goes here
- footer: absolute at bottom

## LAYOUT SELECTION — pick ONE layout based on content type and item count:
- 2-3 key items/pillars/phases → card-row (cards)
- 4 items in categories → grid-2x2
- 5-6 items in categories → grid-3x2
- 3-6 bullet points → content-list
- Metrics + context → two-col (KPIs left, details right)
- 3-4 sequential steps → process-flow (horizontal)
- 4-6 numbered steps → agenda-list (vertical)
- Chronological milestones → timeline-container
- One big number with context → stat-highlight + content-list below
- Two sides to compare → split-layout
- Multi-option comparison → comparison-table
- Bar data → bar-chart-h

## HEIGHT BUDGET — content frame is 890×353px. PLAN before building:
- card-row (3 cards): ~300px → h3 + 1-2 sentences + impact-box per card
- card-row (4 cards): ~280px → h3 + 1 short sentence per card (skip impact-box)
- grid-2x2 (4 cells): ~300px → h4 + 1 paragraph (max 25 words) per cell
- grid-3x2 (6 cells): ~320px → h4 + 1 short line (max 15 words) per cell
- content-list (4-5 bullets): ~200-250px → each bullet 15-25 words with bold lead
- two-col (KPI+details): ~300px → 3 KPIs left, 2-3 detail items right
- process-flow (3-4 steps): ~280px → step-number + h4 + short p per step
- agenda-list (4-6 items): ~300px → number + h4 + short p per item
- timeline (3-5 rows): ~300px → marker + h4 + short p per row
- stat-highlight + bullets: ~200px stat + ~100px bullets = ~300px total
- split-layout: ~320px → balanced content each side (4-5 bullets max per side)
- comparison-table: ~300px → max 5 rows × 4 columns
- bar-chart-h: ~250px → max 5 bars

IF CONTENT RISKS OVERFLOW → reduce item count or shorten text. NEVER let content extend beyond the frame.
IF CONTENT IS TOO SPARSE (under ~200px) → add data points, context, implications. Don't leave empty space.

## DESIGN PROCESS — think like a template designer, not a content writer

STEP 1: Count the user's content items.
STEP 2: Pick the layout from the CONTENT BUDGETS below.
STEP 3: If items exceed the budget → split into 2 slides or trim. Never cram.
STEP 4: Fill the layout. Leave breathing room. Less is more.

## CONTENT BUDGETS — hard limits per layout (exceeding these causes overflow)

content-list:        max 5 items × 20 words each (~250px)
exec-bullet-list:    max 4 items × 22 words each (~320px)
card-row:            max 3 cards × (h3 + 25-word p + impact-box) (~310px)
grid-2x2:            exactly 4 cells × (h4 + 20-word p) (~300px)
two-col (KPIs):      max 3 KPIs + 3 detail-items × (h4 + 15-word p) (~320px)
split-layout:        max 3 items per side × 12 words each. NO extras below it (~300px)
process-flow:        max 4 steps × (h4 + 15-word p) (~120px)
timeline-container:  max 3 rows × (marker + h4 + 18-word p) (~200px)
key-points compact:  max 4 points × (h4 + 18-word p) (~300px)
stat-highlight:      1 stat only (~100px). Can combine with content-list.compact (max 3 items × 15 words)

FILL THE FRAME: Content should use 60-90% of the 353px frame height. Avoid large empty spaces.
- If content is sparse → add data points, context, implications, or pick a denser layout.
- If using process-flow (~120px) or timeline (~200px) alone, pad with richer descriptions to fill the space.
- Cards, grids, and split-layouts naturally fill the frame when items have enough text (15-25 words).

CHOOSING A LAYOUT:
- 2-3 concepts with detail → card-row
- 4 concepts → grid-2x2
- 4-5 bullet points → content-list or exec-bullet-list
- 2 sides to compare → split-layout with styled-list (max 3 items per side)
- 3 KPIs + context → two-col
- Sequential steps → process-flow (max 4) or timeline-container (max 3)
- 1 hero number → stat-highlight (optionally + 3 compact bullets)

## QUALITY RULES

LISTS: Always use a named class (content-list, exec-bullet-list, styled-list, insight-list, check-list). Never bare <ul>/<ol>.
BULLETS: <li><strong>Bold lead (3-6 words)</strong> — supporting detail with data</li>. No emojis in bullet text.
CARDS: card-header-row (card-icon-circle + card-num) + h3 + p (15-30 words) + optional impact-box. Emojis only inside card-icon-circle.
KPIs: kpi-value + kpi-label. Meaningful labels, not "Metric 1."
TITLES: h1 should state a "so what" insight, not a generic label.

## APPROVED CSS CLASSES (only these exist — do NOT invent class names)

Layout: card-row, two-col (col-left + col-right), split-layout (split-left + split-right), grid-2x2 (grid-cell), grid-3x2 (grid-3x2-item), process-flow (process-step + process-arrow), timeline-container (timeline-row), comparison-table
Content: card, card-header-row, card-icon-circle, card-num, impact-box, kpi-block (kpi-value + kpi-label), detail-item, stat-highlight (stat-main + stat-number + stat-label), key-points (key-point + key-point-number + key-point-content)
Lists: content-list, content-list compact, exec-bullet-list, styled-list, insight-list, check-list
Other: visual-placeholder, split-callout (inside split-left/right only)

If a class is NOT listed above, do NOT use it. It has no CSS and will render as raw unstyled HTML.

## STRUCTURE EXAMPLES — replicate the HTML/CSS structure, NOT the content

IMPORTANT: These examples show which CSS classes and HTML structure to use for each layout type. The topics, titles, data, and metrics below are PLACEHOLDERS — do NOT reproduce them. Always generate original content based on what the user actually asks for.

EXAMPLE 1 — Bullet list (content-list):
<div class="slide">
  <h1 class="title">Mediterranean restaurant chain grew 34% by rethinking the dining experience</h1>
  <h2 class="subtitle">Growth drivers</h2>
  <div class="frame">
    <ul class="content-list">
      <li><strong>Open-kitchen format lifted average ticket 22%</strong> — guests spend more when they see food prepared, with appetizer orders up 40%</li>
      <li><strong>Seasonal menu rotation doubled repeat visits</strong> — quarterly menu refreshes drove a 2.1x increase in 90-day return rate</li>
      <li><strong>Delivery partnerships added $9M in off-premise revenue</strong> — dark kitchen model in 3 cities kept margins above 28%</li>
      <li><strong>Staff retention improved to 85%</strong> — profit-sharing program and 4-day work week cut turnover by half</li>
    </ul>
  </div>
  <footer class="footer"><span>Strategy&</span><span>1</span></footer>
</div>

EXAMPLE 2 — Three cards (card-row):
<div class="slide">
  <h1 class="title">University research output tripled by investing in three core areas</h1>
  <h2 class="subtitle">Research strategy</h2>
  <div class="frame">
    <div class="card-row">
      <div class="card">
        <div class="card-header-row"><div class="card-icon-circle">🔬</div><div class="card-num">01</div></div>
        <h3>Lab modernization</h3>
        <p>Replaced 15-year-old equipment across 8 departments; new shared imaging center serves 200+ researchers.</p>
        <div class="impact-box">$22M capital / 40% utilization gain</div>
      </div>
      <div class="card">
        <div class="card-header-row"><div class="card-icon-circle">🌍</div><div class="card-num">02</div></div>
        <h3>Global partnerships</h3>
        <p>Signed joint programs with 12 institutions across 6 countries — co-authored papers rose from 80 to 310 per year.</p>
        <div class="impact-box">3.8x publication growth</div>
      </div>
      <div class="card">
        <div class="card-header-row"><div class="card-icon-circle">💡</div><div class="card-num">03</div></div>
        <h3>PhD funding reform</h3>
        <p>Guaranteed 4-year stipends replaced annual renewals; completion rates jumped from 62% to 89%.</p>
        <div class="impact-box">27pp completion uplift</div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>2</span></footer>
</div>

EXAMPLE 3 — 2×2 grid:
<div class="slide">
  <h1 class="title">City transit ridership depends on frequency and last-mile connectivity</h1>
  <h2 class="subtitle">Route performance matrix</h2>
  <div class="frame">
    <div class="grid-2x2">
      <div class="grid-cell">
        <h4>🚀 High frequency, good connections</h4>
        <p>Central metro lines carry 68% of daily riders. Peak headways under 4 minutes keep platform dwell times low.</p>
      </div>
      <div class="grid-cell">
        <h4>⚡ High frequency, poor connections</h4>
        <p>Express buses run often but miss feeder links — 35% of riders need a second transfer adding 18 minutes.</p>
      </div>
      <div class="grid-cell">
        <h4>⚙️ Low frequency, good connections</h4>
        <p>Suburban rail connects well to buses but 20-minute headways push commuters to cars during off-peak.</p>
      </div>
      <div class="grid-cell">
        <h4>📊 Low frequency, poor connections</h4>
        <p>Outer ring routes serve 12% of the network but carry only 3% of trips — candidates for on-demand shuttle pilots.</p>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>3</span></footer>
</div>

EXAMPLE 4 — KPI metrics + detail columns (two-col):
<div class="slide">
  <h1 class="title">E-commerce replatforming cut page-load times in half and lifted conversion 18%</h1>
  <h2 class="subtitle">Site performance</h2>
  <div class="frame">
    <div class="two-col">
      <div class="col-left">
        <div class="kpi-block">
          <div class="kpi-value">1.2s</div>
          <div class="kpi-label">Average page load (was 2.6s)</div>
        </div>
        <div class="kpi-block">
          <div class="kpi-value">4.8%</div>
          <div class="kpi-label">Checkout conversion rate</div>
        </div>
        <div class="kpi-block">
          <div class="kpi-value">$31M</div>
          <div class="kpi-label">Incremental annual revenue</div>
        </div>
      </div>
      <div class="col-right">
        <div class="detail-item">
          <h4>Mobile experience</h4>
          <p>Responsive redesign lifted mobile conversion from 2.1% to 3.9% — now 55% of total orders.</p>
        </div>
        <div class="detail-item">
          <h4>Search relevance</h4>
          <p>New search engine reduced zero-result queries from 14% to 3%, adding 120K monthly product views.</p>
        </div>
        <div class="detail-item">
          <h4>Cart abandonment</h4>
          <p>One-click checkout and saved payment methods dropped abandonment from 72% to 58%.</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>4</span></footer>
</div>

EXAMPLE 5 — Process flow (horizontal steps):
<div class="slide">
  <h1 class="title">Feature films move through four production phases over 18-24 months</h1>
  <h2 class="subtitle">Production pipeline</h2>
  <div class="frame">
    <div class="process-flow">
      <div class="process-step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h4>Development</h4>
          <p>Script drafts, storyboards, casting shortlists, and budget lock — typically 4-6 months.</p>
        </div>
      </div>
      <div class="process-arrow">→</div>
      <div class="process-step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h4>Pre-production</h4>
          <p>Location scouting, crew hiring, set construction, and rehearsals — 2-3 months of preparation.</p>
        </div>
      </div>
      <div class="process-arrow">→</div>
      <div class="process-step">
        <div class="step-number">3</div>
        <div class="step-content">
          <h4>Principal photography</h4>
          <p>On-set filming across locations, dailies review, and schedule adjustments — 6-12 weeks.</p>
        </div>
      </div>
      <div class="process-arrow">→</div>
      <div class="process-step">
        <div class="step-number">4</div>
        <div class="step-content">
          <h4>Post-production</h4>
          <p>Editing, VFX, color grading, sound mix, and test screenings — 6-9 months to final cut.</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>5</span></footer>
</div>

EXAMPLE 6 — Timeline (chronological milestones):
<div class="slide">
  <h1 class="title">Urban park renovation will transform 12 acres of unused waterfront by 2027</h1>
  <h2 class="subtitle">Project timeline</h2>
  <div class="frame">
    <div class="timeline-container">
      <div class="timeline-row">
        <div class="timeline-marker">2025</div>
        <div class="timeline-content">
          <h4>Community design and permitting</h4>
          <p>Public workshops, architect selection, environmental review, and city council approval for the master plan.</p>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-marker">2026</div>
        <div class="timeline-content">
          <h4>Phase 1 construction</h4>
          <p>Waterfront promenade, playground, and native garden — opening 4 acres to the public by fall.</p>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-marker">2027</div>
        <div class="timeline-content">
          <h4>Phase 2 and grand opening</h4>
          <p>Amphitheater, boat launch, and café pavilion complete the remaining 8 acres for year-round use.</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>6</span></footer>
</div>

EXAMPLE 7 — Split layout (side-by-side comparison) — styled-list uses em-dash markers with divider lines:
<div class="slide">
  <h1 class="title">New curriculum replaced rote memorization with project-based learning across all grades</h1>
  <h2 class="subtitle">Education reform</h2>
  <div class="frame">
    <div class="split-layout">
      <div class="split-left">
        <h3 style="color: var(--accent)">Previous approach</h3>
        <ul class="styled-list">
          <li><strong>Lecture-heavy format</strong> — 80% of class time spent on one-way instruction with limited student interaction</li>
          <li><strong>Standardized testing focus</strong> — curriculum designed around exam content rather than skill development</li>
          <li><strong>Isolated subjects</strong> — math, science, and language taught separately with no cross-disciplinary projects</li>
          <li><strong>Annual assessment only</strong> — student progress measured by year-end exams, missing early intervention windows</li>
        </ul>
      </div>
      <div class="split-right">
        <h3 style="color: var(--accent)">New model</h3>
        <ul class="styled-list">
          <li><strong>Student-led projects</strong> — 60% of time on collaborative real-world problems, with teachers as facilitators</li>
          <li><strong>Competency milestones</strong> — students advance by demonstrating mastery, not by calendar progression</li>
          <li><strong>Integrated themes</strong> — quarterly capstones combine STEM, humanities, and communication skills</li>
          <li><strong>Continuous feedback</strong> — bi-weekly check-ins and portfolio reviews replace high-stakes annual exams</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>7</span></footer>
</div>

EXAMPLE 8 — Stat highlight with supporting context (safe combo: stat-highlight + compact content-list):
<div class="slide">
  <h1 class="title">Marathon training program cut average finish times by 26 minutes in one season</h1>
  <h2 class="subtitle">Athletic performance</h2>
  <div class="frame">
    <div class="stat-highlight">
      <div class="stat-main">
        <span class="stat-number">3:18</span>
      </div>
      <div class="stat-label">Average finish time (down from 3:44 the previous year)</div>
    </div>
    <ul class="content-list compact">
      <li><strong>Periodized training</strong> — structured 16-week cycles with progressive overload reduced injury rate by 40%</li>
      <li><strong>Nutrition coaching</strong> — personalized fueling plans improved late-race pacing by an average of 8 seconds per mile</li>
      <li><strong>Recovery protocols</strong> — mandatory rest weeks and sleep tracking brought weekly training consistency above 90%</li>
    </ul>
  </div>
  <footer class="footer"><span>Strategy&</span><span>8</span></footer>
</div>

EXAMPLE 9 — Executive bullet list (premium padded bullets with hover effects):
<div class="slide">
  <h1 class="title">Four initiatives reduced hospital readmission rates from 18% to 9% in two years</h1>
  <h2 class="subtitle">Patient outcomes</h2>
  <div class="frame">
    <ul class="exec-bullet-list">
      <li><strong>Discharge planning starts on admission</strong> — care coordinators now assign follow-up appointments before the patient leaves the ward</li>
      <li><strong>Medication reconciliation at every handoff</strong> — pharmacy reviews cut adverse drug events by 62% across all departments</li>
      <li><strong>Home monitoring for chronic patients</strong> — remote vitals tracking flagged 1,400 early interventions in the first year alone</li>
      <li><strong>Community health worker visits</strong> — weekly check-ins for high-risk patients closed gaps in food access and transportation</li>
    </ul>
  </div>
  <footer class="footer"><span>Strategy&</span><span>9</span></footer>
</div>

EXAMPLE 10 — Numbered key points (circled numbers with structured content):
<div class="slide">
  <h1 class="title">Regenerative farming practices restored soil health and improved yields within three seasons</h1>
  <h2 class="subtitle">Agricultural principles</h2>
  <div class="frame">
    <div class="key-points compact">
      <div class="key-point">
        <div class="key-point-number">1</div>
        <div class="key-point-content">
          <h4>Cover cropping year-round</h4>
          <p>Clover and rye planted between cash crops prevent erosion and fix nitrogen — reducing fertilizer costs 30%.</p>
        </div>
      </div>
      <div class="key-point">
        <div class="key-point-number">2</div>
        <div class="key-point-content">
          <h4>Rotational grazing</h4>
          <p>Moving livestock across paddocks every 3 days lets pastures recover — soil organic matter rose from 2% to 5%.</p>
        </div>
      </div>
      <div class="key-point">
        <div class="key-point-number">3</div>
        <div class="key-point-content">
          <h4>No-till planting</h4>
          <p>Eliminating plowing preserves soil structure and earthworm populations — water infiltration improved 4x.</p>
        </div>
      </div>
      <div class="key-point">
        <div class="key-point-number">4</div>
        <div class="key-point-content">
          <h4>Composting and biochar</h4>
          <p>On-farm composting diverts 100% of crop waste — biochar amendments lock carbon for 500+ years.</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>10</span></footer>
</div>

## RULES

1. WRAPPER: div.slide > h1.title + h2.subtitle + div.frame + footer.footer.
2. ONE LAYOUT PER FRAME: Put exactly ONE layout component inside .frame. No stacking.
   Only exception: stat-highlight + content-list.compact (max 3 items).
3. RESPECT CONTENT BUDGETS: Never exceed the max items for your chosen layout (see table above).
4. APPROVED CLASSES ONLY: Every class you use must be in the APPROVED CSS CLASSES list above. Inventing classes produces raw unstyled HTML.
5. NO EMOJIS IN BODY TEXT: No emojis in <li>, <p>, <strong>, or <h3>/<h4>. Emojis go only inside card-icon-circle.
6. NO INLINE POSITIONING: No position, display, float, width, height, transform in style attributes.
7. NO HARDCODED COLORS: Use var(--token). No #hex, no rgb(), no color names.
8. INSIGHT TITLES: h1 should state a "so what" conclusion, not a label.
9. BOLD LEAD PATTERN: <li><strong>Bold phrase</strong> — explanation with data</li>. No plain text bullets.
10. SPLIT INTO MULTIPLE SLIDES: If content exceeds any budget, create 2+ slides. Never cram.

## CSS CLASS REFERENCE (all pre-styled — use class names exactly as shown)
Layout containers: card-row, two-col (col-left + col-right), split-layout (split-left + split-right), grid-2x2 (grid-cell ×4), grid-3x2 (grid-3x2-item ×6)
Cards: card > card-header-row > (card-icon-circle + card-num) + h3 + p + impact-box
Lists (choose ONE — never bare <ul>):
  - ul.content-list > li — default choice: card-like bullets with accent left border and surface background
  - ul.content-list.compact > li — tighter variant for 5+ items or when combined with stat-highlight
  - ul.exec-bullet-list > li — premium padded bullets with hover effects (best for strategic points)
  - ul.insight-list > li — arrow (→) markers for findings/takeaways
  - ul.check-list > li — green checkmark circles for completed items/requirements
  - ul.styled-list > li — em-dash markers with divider lines (best for comparisons/split layouts)
  - div.key-points > div.key-point > (div.key-point-number + div.key-point-content > h4 + p) — numbered circles
  - div.key-points.compact — tighter variant for 4+ numbered items
Callouts: div.text-callout, div.quote-box > (p.quote-text + p.quote-author)
KPIs: div.kpi-block > (div.kpi-value + div.kpi-label)
Stats: div.stat-highlight > div.stat-main > (span.stat-dollar + span.stat-number + span.stat-unit) + div.stat-label
Process: div.process-flow > (div.process-step > div.step-number + div.step-content > h4 + p) + div.process-arrow between steps
Agenda: div.agenda-list > div.agenda-item > (div.agenda-num + div.agenda-content > h4 + p)
Timeline: div.timeline-container > div.timeline-row > (div.timeline-marker + div.timeline-content > h4 + p)
Tables: table.comparison-table > thead + tbody (td classes: score-high, score-med, score-low). Max 5 rows × 4 cols.
Charts: div.bar-chart-h > div.bar-row > (span.bar-label + div.bar-track > div.bar-fill[style="width:XX%"] + span.bar-value). Max 5 bars.
Auto-layout: div.auto-row, div.auto-col, div.auto-grid.cols-2/cols-3/cols-4
Box types: content-box (.accent), metric-box, section-box (.challenge/.solution/.result), highlight-box

Content frame: 890×353px. Content must fill this space comfortably — not overflowing, not half-empty.`;

// Models that support reasoning effort parameter
const REASONING_MODELS = ['gpt-5', 'gpt-5.1', 'gpt-5.2', 'gpt-5-mini', 'o1', 'o1-mini', 'o1-preview'];

// GPT 5.x models that use the OpenAI Responses API (/v1/responses)
// These use: input (not messages), max_output_tokens, reasoning.effort, text.verbosity
const GPT5_MODELS = ['gpt-5', 'gpt-5.1', 'gpt-5.2', 'gpt-5-mini'];

// Gemini models use Google's API format
const GEMINI_MODELS = ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];

// Gemini 3 models that support thinkingConfig (thinkingLevel instead of budget)
const GEMINI3_MODELS = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];

// Gemini 2.5 models that support thinkingConfig (thinkingBudget — integer token count)
const GEMINI25_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash'];

// Strip "providerId:" prefix from model references like "openai:gpt-4o"
function stripProviderPrefix(model) {
  if (!model) return model;
  const idx = model.indexOf(':');
  return idx === -1 ? model : model.slice(idx + 1);
}

function isReasoningModel(model) {
  const m = stripProviderPrefix(model);
  return REASONING_MODELS.some(rm => m.toLowerCase().includes(rm.toLowerCase()));
}

function isGPT5Model(model) {
  const m = stripProviderPrefix(model);
  return GPT5_MODELS.some(gm => m.toLowerCase().includes(gm.toLowerCase()));
}

function isGeminiModel(model) {
  const m = stripProviderPrefix(model);
  return GEMINI_MODELS.some(gm => m.toLowerCase().includes(gm.toLowerCase()));
}

function isGemini3Model(model) {
  const m = stripProviderPrefix(model);
  return GEMINI3_MODELS.some(gm => m.toLowerCase().includes(gm.toLowerCase()));
}

function isGemini25Model(model) {
  const m = stripProviderPrefix(model);
  return GEMINI25_MODELS.some(gm => m.toLowerCase().includes(gm.toLowerCase()));
}

// Map reasoningEffort setting to Gemini 2.5 thinkingBudget (integer token count)
// Without this, thinking tokens consume the maxOutputTokens budget, truncating actual output
function mapReasoningToThinkingBudget(reasoningEffort) {
  switch ((reasoningEffort || '').toLowerCase()) {
    case 'none': return 0;
    case 'low': return 1024;
    case 'medium': return 8192;
    case 'high': return 24576;
    default: return 8192; // Reasonable default to prevent thinking from consuming output budget
  }
}

// Map reasoningEffort setting to Gemini 3 thinkingLevel
// Pro supports: LOW, HIGH (no MINIMAL)
// Flash supports: MINIMAL, LOW, MEDIUM, HIGH
function mapReasoningToThinkingLevel(reasoningEffort, model) {
  const isPro = (model || '').toLowerCase().includes('pro');
  switch ((reasoningEffort || '').toLowerCase()) {
    case 'none':
      // Use lowest available level
      return isPro ? 'LOW' : 'MINIMAL';
    case 'low':
      return 'LOW';
    case 'medium':
      return isPro ? 'HIGH' : 'MEDIUM';
    case 'high':
      return 'HIGH';
    default:
      return null; // Let the API use its default
  }
}

function isClaudeModel(model) {
  return stripProviderPrefix(model).toLowerCase().includes('claude');
}

// Get provider from model name (legacy fallback)
function getProviderFromModel(model) {
  const m = stripProviderPrefix(model);
  if (isGeminiModel(m)) return 'gemini';
  if (isClaudeModel(m)) return 'anthropic';
  return 'openai';
}

// Extract the actual response text from Gemini parts, skipping thinking/thought parts
function extractGeminiResponseText(parts) {
  if (!parts || parts.length === 0) return '';
  // Filter out thought parts (Gemini 3 models include { thought: true } parts)
  const responseParts = parts.filter(p => !p.thought);
  // Try non-thought parts first
  const nonThoughtText = responseParts.map(p => p.text).filter(Boolean).join('');
  if (nonThoughtText) return nonThoughtText;
  // Fall back to ALL parts (including thought parts) if non-thought text was empty
  // This handles Gemini 3 models that sometimes put the response in thought parts
  const allText = parts.map(p => p.text).filter(Boolean).join('');
  if (allText) {
    console.warn('[Gemini API] No non-thought text found, using thought text as fallback');
  }
  return allText;
}

// Parse "providerId:modelName" format used in settings
function parseModelRef(ref) {
  if (!ref) return { providerId: '', modelName: '' };
  const idx = ref.indexOf(':');
  if (idx === -1) return { providerId: '', modelName: ref };
  return { providerId: ref.slice(0, idx), modelName: ref.slice(idx + 1) };
}

// Look up a provider by id from the providers array
function findProvider(settings, providerId) {
  const providers = settings.providers || [];
  if (Array.isArray(providers)) {
    return providers.find(p => p.id === providerId);
  }
  // Legacy object format fallback
  return providers[providerId];
}

// Check if the settings have any usable API key (for UI-level validation)
export function hasAnyApiKey(settings) {
  if (settings.apiKey) return true;
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  return providers.some(p => !!p.apiKey);
}

// Get the correct API credentials based on the model ref (providerId:modelName)
function getCredentials(settings) {
  const modelRef = settings.model || 'openai:gpt-4o';
  const { providerId, modelName } = parseModelRef(modelRef);

  // Look up provider from array
  const provider = findProvider(settings, providerId);

  if (provider) {
    const apiUrl = provider.apiUrl || '';
    // For direct Azure OpenAI endpoints, don't add azure. prefix (deployment is in URL)
    const isDirectAzure = apiUrl.includes('openai.azure.com');
    const azureModel = (provider.azurePrefix && !isDirectAzure) ? `azure.${modelName}` : modelName;
    // GPT-5.x models use the Responses API endpoint
    let apiEndpoint = apiUrl;
    const useResponsesAPI = isGPT5Model(modelName) && !provider.azurePrefix
      && apiEndpoint.includes('api.openai.com');
    if (useResponsesAPI) {
      apiEndpoint = 'https://api.openai.com/v1/responses';
    }
    // Parse custom headers/params (JSON strings from provider config)
    let customHeaders = {};
    let customParams = {};
    try { if (provider.customHeaders) customHeaders = JSON.parse(provider.customHeaders); } catch (_) { /* ignore invalid JSON */ }
    try { if (provider.customParams) customParams = JSON.parse(provider.customParams); } catch (_) { /* ignore invalid JSON */ }

    return {
      apiKey: provider.apiKey || settings.apiKey || '',
      apiEndpoint,
      model: azureModel,
      rawModel: modelName,
      provider: providerId,
      isGeminiProvider: provider.geminiNativeFormat
        || (provider.apiUrl || '').includes('generativelanguage.googleapis.com')
        || ((provider.apiUrl || '').includes('aiplatform.googleapis.com')
          && !(provider.apiUrl || '').includes('/chat/completions')),
      isAnthropicProvider: (provider.apiUrl || '').includes('anthropic.com')
        || isClaudeModel(modelName),
      azurePrefix: provider.azurePrefix || false,
      authType: provider.authType || 'auto',
      useResponsesAPI,
      customHeaders,
      customParams,
    };
  }

  // Fallback: no provider found — try legacy detection from model name
  const legacyProvider = getProviderFromModel(modelName);
  const legacyConfig = Array.isArray(settings.providers)
    ? settings.providers.find(p => p.id === legacyProvider)
    : settings.providers?.[legacyProvider];

  return {
    apiKey: legacyConfig?.apiKey || legacyConfig?.apiKey || settings.apiKey || '',
    apiEndpoint: legacyConfig?.apiUrl || legacyConfig?.apiEndpoint || settings.apiEndpoint || 'https://api.openai.com/v1/chat/completions',
    model: modelName,
    rawModel: modelName,
    provider: legacyProvider,
    isGeminiProvider: isGeminiModel(modelName),
    isAnthropicProvider: isClaudeModel(modelName),
    azurePrefix: false,
    authType: 'auto',
    useResponsesAPI: false,
  };
}

// Build auth headers for non-Gemini API calls.
// Centralises auth so all call paths (callGeminiAPI, agentChat, callRouterWithImages)
// use the same logic. Supports Azure OpenAI (api-key), Anthropic (x-api-key), and
// Bearer token (OpenAI, LiteLLM proxies, enterprise gateways).
function buildProviderHeaders(creds) {
  const headers = { 'Content-Type': 'application/json' };
  const authType = creds.authType || 'auto';
  const url = creds.apiEndpoint || '';

  // Server-managed auth: backend proxy adds the API key — no client-side auth needed
  if (authType === 'server') {
    // No auth headers needed
  } else if (authType === 'api-key' || (authType === 'auto' && (url.includes('openai.azure.com') || creds.azurePrefix))) {
    headers['api-key'] = creds.apiKey;
  } else if (authType === 'auto' && url.includes('anthropic.com')) {
    headers['x-api-key'] = creds.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  } else {
    headers['Authorization'] = `Bearer ${creds.apiKey}`;
  }
  if (creds.customHeaders && typeof creds.customHeaders === 'object') {
    Object.assign(headers, creds.customHeaders);
  }
  return headers;
}

// Build Gemini endpoint from credentials
function buildGeminiEndpoint(creds) {
  const baseUrl = creds.apiEndpoint || 'https://generativelanguage.googleapis.com/v1beta';
  // If it's a Gemini-style base URL, construct the model endpoint
  if (baseUrl.includes('generativelanguage.googleapis.com')) {
    return `${baseUrl}/models/${creds.rawModel || creds.model}:generateContent?key=${creds.apiKey}`;
  }
  // Custom endpoint (Vertex AI, etc.) — use as-is
  return baseUrl;
}

// Build headers for Gemini API calls
// Standard Gemini API: key is in the URL, no auth header needed
// Vertex AI / custom endpoints: need Authorization: Bearer header
function buildGeminiHeaders(creds) {
  const headers = { 'Content-Type': 'application/json' };
  const apiUrl = creds.apiEndpoint || '';
  if (!apiUrl.includes('generativelanguage.googleapis.com') && creds.apiKey) {
    headers['Authorization'] = `Bearer ${creds.apiKey}`;
  }
  return headers;
}

/**
 * Call router with images - multimodal API call
 * Analyzes images with the user's query context
 */
async function callRouterWithImages(settings, systemPrompt, contextInfo, images) {
  const creds = getCredentials(settings);
  const { maxTokens = 4096 } = settings;

  console.log('[callRouterWithImages] Starting with', images.length, 'image(s), provider:', creds.provider, 'model:', creds.rawModel);

  // For images, prefer OpenAI/GPT-4o as it has better vision
  // But use whatever model is configured
  const provider = settings.providers?.find(p => p.id === creds.provider);
  if (!provider?.apiKey) {
    console.error('[callRouterWithImages] No API key for provider:', creds.provider);
    throw new Error(`No API key configured for "${creds.provider}" provider. Please add it in Settings to use image analysis.`);
  }

  // Build image content parts
  const imageContent = images.map(img => {
    // Extract base64 and mime type from data URL
    const matches = (img.imageData || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.warn('[callRouterWithImages] Invalid image data format');
      return null;
    }
    const [, mimeType, base64] = matches;

    if (creds.isGeminiProvider) {
      return {
        inline_data: {
          mime_type: mimeType,
          data: base64,
        },
      };
    } else {
      return {
        type: 'image_url',
        image_url: {
          url: img.imageData, // Full data URL
          detail: 'high',
        },
      };
    }
  }).filter(Boolean);

  if (imageContent.length === 0) {
    // Fallback to text-only if images couldn't be processed
    return callGeminiAPI(settings, systemPrompt, contextInfo);
  }

  // Build the prompt with image context
  const imagePrompt = `You are viewing ${images.length} image(s) attached by the user.
Analyze the image(s) in context of the user's request below.

${contextInfo}

IMPORTANT - DETAILED IMAGE ANALYSIS:
When the image shows a slide/presentation to recreate:
- Create exactly ONE slide that mimics it
- In your instruction, describe ALL visual details:
  * Exact text content (titles, bullets, labels)
  * Font sizes (large title, medium subtitle, small body)
  * Font colors (e.g., "dark blue title #1e3a5f", "gray text #6b7280")
  * Background color or gradient
  * Layout structure (centered, left-aligned, columns, cards)
  * Spacing and margins (tight, spacious)
  * Any icons, shapes, or decorative elements
  * Charts/diagrams structure if present
- Use position: "start" for title/cover slides, "end" for content slides
- Do NOT create multiple slides from a single slide image`;

  if (creds.isGeminiProvider) {
    // Gemini format
    const endpoint = buildGeminiEndpoint(creds);
    const routerModelName = creds.rawModel || creds.model;
    const requestBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: imagePrompt },
            ...imageContent,
          ],
        },
      ],
      generationConfig: {
        temperature: settings.temperature || 0.1,
        maxOutputTokens: maxTokens,
        topP: 0.95,
      },
    };

    // Add thinkingConfig for Gemini thinking models in router
    const routerReasoning = settings.reasoningEffort || 'low';
    if (isGemini3Model(routerModelName)) {
      const thinkingLevel = mapReasoningToThinkingLevel(routerReasoning, routerModelName);
      if (thinkingLevel) {
        requestBody.generationConfig.thinkingConfig = { thinkingLevel };
      }
    } else if (isGemini25Model(routerModelName)) {
      const thinkingBudget = mapReasoningToThinkingBudget(routerReasoning);
      requestBody.generationConfig.thinkingConfig = { thinkingBudget };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildGeminiHeaders(creds),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return extractGeminiResponseText(data.candidates?.[0]?.content?.parts);
  } else {
    // OpenAI format — use creds (normalised endpoint/auth) not raw provider
    const headers = buildProviderHeaders(creds);

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: imagePrompt },
          ...imageContent,
        ],
      },
    ];

    const requestBody = {
      model: creds.model,
      messages,
      max_tokens: maxTokens,
      temperature: settings.temperature || 0.1,
    };

    const response = await fetch(creds.apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

// ─── Global concurrency semaphore ───────────────────────────────────────────
// Caps the number of simultaneous API calls across the entire app (all users
// in the same browser tab, all paths: router, slide creation, agent, etc.).
// Prevents overwhelming the LiteLLM proxy / upstream API with too many
// concurrent connections, which causes "Connection error" on model groups.
let _apiMaxConcurrent = 5;
let _apiActiveCount = 0;
const _apiWaitQueue = [];

// Allow settings to update the concurrency cap at runtime
export function setApiMaxConcurrent(n) {
  _apiMaxConcurrent = Math.max(1, Math.min(50, n || 5));
  // If cap increased, drain queued waiters
  while (_apiWaitQueue.length > 0 && _apiActiveCount < _apiMaxConcurrent) {
    _apiActiveCount++;
    _apiWaitQueue.shift()();
  }
}

function _acquireApiSlot() {
  if (_apiActiveCount < _apiMaxConcurrent) {
    _apiActiveCount++;
    return Promise.resolve();
  }
  // Queue this caller until a slot frees up
  return new Promise(resolve => _apiWaitQueue.push(resolve));
}

function _releaseApiSlot() {
  if (_apiWaitQueue.length > 0) {
    // Wake the next waiter (slot stays occupied)
    const next = _apiWaitQueue.shift();
    next();
  } else {
    _apiActiveCount--;
  }
}

// Call Gemini API with proper format (handles all providers despite the name)
export async function callGeminiAPI(settings, systemPrompt, userPrompt) {
  // Acquire a concurrency slot (blocks if API_MAX_CONCURRENT already in flight)
  await _acquireApiSlot();
  try {
    return await _callGeminiAPIInner(settings, systemPrompt, userPrompt);
  } finally {
    _releaseApiSlot();
  }
}

async function _callGeminiAPIInner(settings, systemPrompt, userPrompt) {
  const creds = getCredentials(settings);
  const { maxTokens } = settings;

  // Non-Gemini provider: use buildRequestBody (handles Responses API for GPT-5.x)
  if (!creds.isGeminiProvider) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    const requestBody = buildRequestBody(settings, messages);

    const headers = buildProviderHeaders(creds);

    console.log('[callGeminiAPI/non-Gemini] FETCH →', {
      endpoint: creds.apiEndpoint,
      model: creds.model,
      useResponsesAPI: creds.useResponsesAPI,
      bodyModel: requestBody.model,
      authType: headers['api-key'] ? 'api-key' : headers['x-api-key'] ? 'x-api-key' : 'Bearer',
    });

    // Retry on transient connection / 5xx errors (NOT 429 — rate limits should fail fast)
    const MAX_RETRIES = 3;
    const BASE_DELAYS = [2000, 4000, 8000];
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Add random jitter (0-50%) to avoid thundering herd when multiple users retry simultaneously
          const jitter = Math.random() * 0.5;
          const delay = Math.round(BASE_DELAYS[attempt - 1] * (1 + jitter));
          console.log(`[callGeminiAPI/non-Gemini] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms (jittered)...`);
          await new Promise(r => setTimeout(r, delay));
        }

        const response = await fetch(creds.apiEndpoint, {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          const errMsg = error.error?.message || `API error: ${response.status}`;
          // 429 = rate limited — fail immediately, retrying would worsen congestion for all users
          if (response.status === 429) {
            const rateLimitErr = new Error(errMsg);
            rateLimitErr.isRateLimit = true;
            rateLimitErr.status = 429;
            console.warn(`[callGeminiAPI/non-Gemini] 429 rate limited — failing fast (no retry):`, errMsg.slice(0, 200));
            throw rateLimitErr;
          }
          if (response.status >= 500) {
            console.warn(`[callGeminiAPI/non-Gemini] ${response.status} error (attempt ${attempt + 1}):`, errMsg.slice(0, 300));
            lastError = new Error(errMsg);
            lastError.status = response.status;
            continue;
          }
          throw new Error(errMsg);
        }
        const data = await response.json();
        console.log('[callGeminiAPI/non-Gemini] Response status:', data.status || 'ok',
          'model:', creds.model, 'useResponsesAPI:', creds.useResponsesAPI);
        const content = parseAPIResponseContent(data, creds);
        if (!content || content.trim() === '') {
          console.warn('[callGeminiAPI/non-Gemini] Empty content from', creds.model,
            'Response keys:', Object.keys(data),
            'output length:', data.output?.length || 0,
            'output_text:', data.output_text ? 'present' : 'absent',
            'choices:', data.choices?.length || 0);
        }
        return content;
      } catch (fetchErr) {
        if (fetchErr.isRateLimit || fetchErr.message?.includes('API error:')) throw fetchErr;
        console.warn(`[callGeminiAPI/non-Gemini] Connection error (attempt ${attempt + 1}):`, fetchErr.message);
        lastError = fetchErr;
        if (attempt >= MAX_RETRIES) break;
      }
    }
    // Provide a clearer error for connection failures (DNS, network, VPN)
    const endpoint = creds.apiEndpoint || '(unknown)';
    const hostMatch = endpoint.match(/\/\/([^/]+)/);
    const host = hostMatch ? hostMatch[1] : endpoint;
    const connErr = new Error(
      lastError?.status >= 500
        ? `Server error ${lastError.status} from ${host} after ${MAX_RETRIES + 1} attempts. The API server may be temporarily unavailable.`
        : `Could not connect to ${host}. Check your network connection, VPN, and that the endpoint URL is correct. (${lastError?.message || 'unknown error'})`
    );
    connErr.status = lastError?.status;
    throw connErr;
  }

  const endpoint = buildGeminiEndpoint(creds);
  const modelName = creds.rawModel || creds.model;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: maxTokens || 8192,
      temperature: settings.temperature || 0.7,
      topP: 0.95,
    }
  };

  // Add thinkingConfig for Gemini thinking models
  // Resolve reasoning effort: explicit setting → default 'low' for thinking models
  const effectiveReasoning = settings.reasoningEffort || 'low';
  if (isGemini3Model(modelName)) {
    const thinkingLevel = mapReasoningToThinkingLevel(effectiveReasoning, modelName);
    if (thinkingLevel) {
      body.generationConfig.thinkingConfig = {
        thinkingLevel,
      };
    }
  } else if (isGemini25Model(modelName)) {
    const thinkingBudget = mapReasoningToThinkingBudget(effectiveReasoning);
    body.generationConfig.thinkingConfig = { thinkingBudget };
  }

  // Add extra tools if caller requested (e.g., router with web search)
  if (settings._extraTools?.length > 0) {
    // For Gemini, map web_search_preview → googleSearch grounding
    body.tools = settings._extraTools.map(t =>
      t.type === 'web_search_preview' ? { googleSearch: {} } : t
    );
  }

  // Log Gemini request params — same format as non-Gemini [API→] log
  const _geminiReqParams = {
    model: modelName,
    max_tokens: body.generationConfig.maxOutputTokens || null,
    reasoning: effectiveReasoning,
    thinkingConfig: body.generationConfig.thinkingConfig || null,
    temperature: body.generationConfig.temperature ?? null,
    endpoint: endpoint?.slice(0, 80),
  };
  console.log(`%c[API→] ${_geminiReqParams.model}  max_tokens=${_geminiReqParams.max_tokens}  reasoning=${_geminiReqParams.reasoning}  thinkingConfig=${JSON.stringify(_geminiReqParams.thinkingConfig)}  temp=${_geminiReqParams.temperature}`, 'color:#6a9fb5');
  // Expose for audit log consumers (same as non-Gemini path)
  agentChat._lastRequestParams = _geminiReqParams;

  // Retry on transient network / 5xx errors (mirrors non-Gemini retry logic above)
  const GEMINI_MAX_RETRIES = 3;
  const GEMINI_BASE_DELAYS = [2000, 4000, 8000];
  let lastGeminiError = null;
  let response;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const jitter = Math.random() * 0.5;
        const delay = Math.round(GEMINI_BASE_DELAYS[attempt - 1] * (1 + jitter));
        console.log(`[callGeminiAPI/Gemini] Retry ${attempt}/${GEMINI_MAX_RETRIES} after ${delay}ms (jittered)...`);
        await new Promise(r => setTimeout(r, delay));
      }

      response = await fetch(endpoint, {
        method: 'POST',
        headers: buildGeminiHeaders(creds),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errMsg = error.error?.message || `Gemini API error: ${response.status}`;
        // 429 = rate limited — fail immediately
        if (response.status === 429) {
          const rateLimitErr = new Error(errMsg);
          rateLimitErr.isRateLimit = true;
          console.warn(`[callGeminiAPI/Gemini] 429 rate limited — failing fast (no retry):`, errMsg.slice(0, 200));
          throw rateLimitErr;
        }
        if (response.status >= 500) {
          console.warn(`[callGeminiAPI/Gemini] ${response.status} error (attempt ${attempt + 1}):`, errMsg.slice(0, 300));
          lastGeminiError = new Error(errMsg);
          lastGeminiError.status = response.status;
          continue;
        }
        throw new Error(errMsg);
      }

      // Success — break out of retry loop
      break;
    } catch (fetchErr) {
      if (fetchErr.isRateLimit) throw fetchErr;
      if (fetchErr.message?.includes('Gemini API error:')) throw fetchErr;
      // Network / connection error — retry if attempts remain
      console.warn(`[callGeminiAPI/Gemini] Network error (attempt ${attempt + 1}):`, fetchErr.message);
      lastGeminiError = fetchErr;
      if (attempt >= GEMINI_MAX_RETRIES) break;
    }
  }

  if (!response || !response.ok) {
    const hostMatch = endpoint.match(/\/\/([^/]+)/);
    const host = hostMatch ? hostMatch[1] : endpoint;
    const connErr = new Error(
      lastGeminiError?.status >= 500
        ? `Server error ${lastGeminiError.status} from ${host} after ${GEMINI_MAX_RETRIES + 1} attempts. The Gemini API may be temporarily unavailable.`
        : `Could not connect to ${host}. Check your network connection and API key. (${lastGeminiError?.message || 'unknown error'})`
    );
    connErr.status = lastGeminiError?.status;
    throw connErr;
  }

  const data = await response.json();
  console.log('[Gemini API] Full response data:', JSON.stringify(data, null, 2));

  // Log token usage breakdown
  const usage = data.usageMetadata;
  if (usage) {
    console.log('[Gemini API] Token usage:', {
      promptTokens: usage.promptTokenCount,
      thinkingTokens: usage.thoughtsTokenCount || 0,
      outputTokens: usage.candidatesTokenCount,
      total: usage.totalTokenCount,
    });
  }

  // Check prompt-level blocking FIRST (before looking at candidates)
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) {
    console.error('[Gemini API] Prompt blocked:', blockReason, data.promptFeedback);
    throw new Error(`Gemini blocked the request (reason: ${blockReason}). Try rephrasing or using a different model.`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    console.error('[Gemini API] No candidates in response:', JSON.stringify(data, null, 2));
    throw new Error('Gemini returned no candidates — the request may have been filtered. Try a different model.');
  }

  const content = extractGeminiResponseText(candidate?.content?.parts);
  const finishReason = candidate?.finishReason;

  // Throw on safety/block finish reasons instead of silently returning empty
  if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    console.warn('[Gemini API] Finish reason:', finishReason, '- Response blocked or filtered');
    if (!content || content.trim() === '') {
      throw new Error(`Gemini response blocked (finishReason: ${finishReason}). The content may have triggered safety filters. Try a different model or rephrase.`);
    }
  }

  // Log when response is empty for debugging (still possible with STOP/MAX_TOKENS)
  if (!content || content.trim() === '') {
    console.warn('[Gemini API] Empty content extracted. Candidate:', JSON.stringify(candidate, null, 2));
    console.warn('[Gemini API] Parts count:', candidate?.content?.parts?.length || 0,
      'Finish reason:', finishReason,
      'Block reason:', blockReason || 'none');
  }
  return content;
}

function buildRequestBody(settings, messages) {
  const { temperature, maxTokens, reasoningEffort } = settings;
  const verbosity = settings.verbosity || null; // 'low'|'medium'|'high' or null
  // Get the actual model name to send to the API (strip providerId: prefix, apply azure. if needed)
  const creds = getCredentials(settings);
  const model = creds.model; // Already has azure. prefix if applicable

  // GPT-5.x on OpenAI uses the Responses API format
  if (creds.useResponsesAPI) {
    // Convert messages array to Responses API input format
    // System message becomes instructions, user/assistant become input items
    let instructions = '';
    const inputItems = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        instructions += (instructions ? '\n\n' : '') + msg.content;
      } else {
        inputItems.push({ role: msg.role, content: msg.content });
      }
    }
    // If only one user message with no assistant messages, use simple string input
    const input = inputItems.length === 1 && inputItems[0].role === 'user'
      ? inputItems[0].content
      : inputItems;

    const body = { model, input };
    if (instructions) body.instructions = instructions;

    // Reasoning effort (nested format for Responses API)
    if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') {
      body.reasoning = { effort: reasoningEffort };
    }

    // Temperature (only if not using reasoning)
    if (!(isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none')) {
      if (temperature !== undefined && temperature !== null) body.temperature = temperature;
    }

    // Max output tokens (ensure integer for proxy compat)
    if (maxTokens) body.max_output_tokens = parseInt(maxTokens, 10) || maxTokens;

    // Text verbosity
    if (verbosity) body.text = { verbosity };

    // Extra tools (e.g., web_search_preview for router with search enabled)
    if (settings._extraTools?.length > 0) {
      body.tools = body.tools || [];
      for (const tool of settings._extraTools) {
        body.tools.push(tool);
      }
    }

    // Merge custom params from provider config
    if (creds.customParams && typeof creds.customParams === 'object') {
      Object.assign(body, creds.customParams);
    }

    console.log('[buildRequestBody] Responses API →', {
      model: body.model,
      max_output_tokens: body.max_output_tokens,
      reasoning: body.reasoning,
      temperature: body.temperature,
      verbosity: body.text?.verbosity,
      instructionsLen: body.instructions?.length || 0,
      inputType: typeof body.input === 'string' ? 'string' : `array[${body.input?.length}]`,
      inputLen: typeof body.input === 'string' ? body.input.length : body.input?.reduce((s, m) => s + (m.content?.length || 0), 0),
      tools: body.tools?.length || 0,
    });
    return body;
  }

  // Anthropic Messages API (direct api.anthropic.com calls)
  // System message must be a top-level field, not in messages array.
  // Response format: { content: [{type: "text", text: "..."}] }
  if (creds.isAnthropicProvider) {
    let system = '';
    const anthropicMessages = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n\n' : '') + msg.content;
      } else {
        anthropicMessages.push({ role: msg.role, content: msg.content });
      }
    }
    const body = {
      model,
      messages: anthropicMessages,
      max_tokens: parseInt(maxTokens, 10) || 4096,
    };
    if (system) body.system = system;
    if (temperature !== undefined && temperature !== null) body.temperature = temperature;

    // Merge custom params from provider config (e.g., budget_tokens for extended thinking)
    if (creds.customParams && typeof creds.customParams === 'object') {
      Object.assign(body, creds.customParams);
    }

    console.log('[buildRequestBody] Anthropic Messages API →', {
      model: body.model,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      system_len: body.system?.length || 0,
      messageCount: body.messages?.length,
      totalInputChars: body.messages?.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : 0), 0),
    });
    return body;
  }

  // Non-Responses API (legacy chat completions for GPT-4, o1, etc.)
  const body = {
    model: model,
    messages: messages,
  };

  if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') {
    body.reasoning_effort = reasoningEffort;
  } else {
    body.temperature = temperature;
  }
  // Always send max_tokens — reasoning models need it too (ensure integer for proxy compat)
  if (maxTokens) body.max_tokens = parseInt(maxTokens, 10) || maxTokens;

  // Merge custom params from provider config
  if (creds.customParams && typeof creds.customParams === 'object') {
    Object.assign(body, creds.customParams);
  }

  console.log('[buildRequestBody] Chat Completions →', {
    model: body.model,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    reasoning_effort: body.reasoning_effort,
    messageCount: body.messages?.length,
    totalInputChars: body.messages?.reduce((s, m) => s + (m.content?.length || 0), 0),
  });
  return body;
}

// Parse API response — normalizes Responses API, Anthropic Messages, and Chat Completions formats
function parseAPIResponseContent(data, creds) {
  if (creds?.useResponsesAPI) {
    // Responses API: output is an array of output items
    // Find the first message output item with text content
    const output = data.output || [];
    for (const item of output) {
      if (item.type === 'message' && item.content) {
        for (const part of item.content) {
          if (part.type === 'output_text' && part.text) return part.text;
          if (part.type === 'text' && part.text) return part.text;
        }
      }
    }
    // Fallback: check for direct text in output
    if (data.output_text) return data.output_text;
    return '';
  }
  // Anthropic Messages API: { content: [{ type: "text", text: "..." }] }
  if (creds?.isAnthropicProvider && data.content && Array.isArray(data.content)) {
    return data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n') || '';
  }
  // Chat Completions format
  return data.choices?.[0]?.message?.content || '';
}

// Helper to get settings for fast model calls (assessments, template selection)
function getFastModelSettings(settings) {
  const fastModel = settings.fastModel || 'openai:gpt-5-mini';
  // If empty, use main model
  if (!fastModel) return { ...settings, temperature: 0.3, maxTokens: 200 };

  // Validate that the fast model's provider actually has an API key
  const { providerId } = parseModelRef(fastModel);
  const provider = findProvider(settings, providerId);
  if (!provider?.apiKey) {
    // Fast model provider has no key — fall back to main model
    console.warn(`[getFastModelSettings] No API key for fast model provider "${providerId}", falling back to main model`);
    return { ...settings, temperature: 0.3, maxTokens: 200 };
  }

  return {
    ...settings,
    model: fastModel,
    temperature: 0.3, // Lower temperature for more deterministic assessments
    maxTokens: 200, // Keep responses short
  };
}

// Generate a short summary for a slide based on its content
export function generateSlideSummary(html, type, title) {
  // Extract key content elements for the summary
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;

  if (!tempDiv) {
    // Server-side fallback
    return `[${type}] ${title || 'Untitled'}`;
  }

  tempDiv.innerHTML = html;

  // Get key text elements
  const mainTitle = tempDiv.querySelector('.title, .cover-title, h1')?.textContent?.trim() || '';
  const subtitle = tempDiv.querySelector('.subtitle, .cover-category, h2')?.textContent?.trim() || '';

  // Build a concise summary
  let summary = `[${type}]`;
  if (mainTitle) {
    summary += ` "${mainTitle.substring(0, 50)}${mainTitle.length > 50 ? '...' : ''}"`;
  }
  if (subtitle) {
    summary += ` - ${subtitle}`;
  }

  return summary;
}

// Extract comprehensive metadata from slide HTML (without needing full HTML for context)
export function extractSlideMetadata(html, type, title) {
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;

  if (!tempDiv) {
    return {
      title: title || 'Untitled',
      type: type || 'custom',
      headers: [],
      keyPoints: [],
      structure: 'unknown',
      elementCount: 0,
    };
  }

  tempDiv.innerHTML = html;

  // Extract all headers
  const headers = [];
  tempDiv.querySelectorAll('h1, h2, h3, h4, .title, .subtitle, .cover-title').forEach(el => {
    const text = el.textContent?.trim();
    if (text && !headers.includes(text)) {
      headers.push(text);
    }
  });

  // Extract key points (list items, bullet points)
  const keyPoints = [];
  tempDiv.querySelectorAll('li, .bullet-item, .key-point, .card-title').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length < 200) {
      keyPoints.push(text.substring(0, 100));
    }
  });

  // Detect structure/layout
  const hasGrid = tempDiv.querySelector('.grid, .cards-grid, .timeline') !== null;
  const hasColumns = tempDiv.querySelector('.two-column, .column, .left-column, .right-column') !== null;
  const hasList = tempDiv.querySelector('ul, ol, .content-list') !== null;
  const hasQuote = tempDiv.querySelector('blockquote, .quote, .quote-text') !== null;
  const hasImage = tempDiv.querySelector('img, .image, .chart') !== null;
  const cardCount = tempDiv.querySelectorAll('.card, .stat-card, .feature-card').length;

  let structure = 'standard';
  if (type === 'cover' || tempDiv.querySelector('.cover-title')) structure = 'cover';
  else if (hasGrid && cardCount >= 3) structure = `grid-${cardCount}-cards`;
  else if (hasColumns) structure = 'two-column';
  else if (hasList) structure = 'content-list';
  else if (hasQuote) structure = 'quote';
  else if (hasImage) structure = 'media';

  // Count content elements
  const elementCount = tempDiv.querySelectorAll('h1, h2, h3, p, li, .card, img').length;

  return {
    title: headers[0] || title || 'Untitled',
    type: type || 'custom',
    headers: headers.slice(0, 5), // Limit to 5 headers
    keyPoints: keyPoints.slice(0, 6), // Limit to 6 key points
    structure,
    elementCount,
  };
}

// Extract slide content for AI context (NO raw HTML - just structured text)
export function extractSlideContentForAI(html, options = {}) {
  const { maxLength = 500, includeStructure = true } = options;
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;

  if (!tempDiv) {
    return '[Slide content]';
  }

  tempDiv.innerHTML = html;

  // Extract structured content
  const title = tempDiv.querySelector('.title, .cover-title, h1')?.textContent?.trim() || '';
  const subtitle = tempDiv.querySelector('.subtitle, .cover-category, h2')?.textContent?.trim() || '';

  // Get all text content in logical order
  const contentParts = [];

  // Headers (h3, h4)
  tempDiv.querySelectorAll('h3, h4, .card-title, .kpi-label').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length > 2) contentParts.push(`• ${text}`);
  });

  // Key values/metrics
  tempDiv.querySelectorAll('.kpi-value, .stat-value, .metric-value').forEach(el => {
    const text = el.textContent?.trim();
    if (text) contentParts.push(`[${text}]`);
  });

  // Paragraphs and descriptions
  tempDiv.querySelectorAll('p, .description, .card-body').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length > 10) contentParts.push(text.substring(0, 150));
  });

  // List items
  tempDiv.querySelectorAll('li').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length > 5) contentParts.push(`- ${text.substring(0, 100)}`);
  });

  // Build output
  let output = '';
  if (title) output += `Title: "${title}"\n`;
  if (subtitle) output += `Subtitle: ${subtitle}\n`;
  if (contentParts.length > 0) {
    output += `Content:\n${contentParts.slice(0, 10).join('\n')}`;
  }

  // Add structure info if requested
  if (includeStructure) {
    const hasCards = tempDiv.querySelector('.card, .grid-cell') !== null;
    const hasList = tempDiv.querySelector('ul, ol, .content-list') !== null;
    const hasKPI = tempDiv.querySelector('.kpi-block, .kpi-value') !== null;
    const hasGrid = tempDiv.querySelector('.grid-2x2, .card-row') !== null;

    const structure = [];
    if (hasCards) structure.push('cards');
    if (hasList) structure.push('list');
    if (hasKPI) structure.push('KPIs');
    if (hasGrid) structure.push('grid');
    if (structure.length > 0) {
      output += `\nLayout: ${structure.join(', ')}`;
    }
  }

  return output.substring(0, maxLength) || '[Empty slide]';
}

// Build lightweight deck outline (no HTML, just metadata)
export function buildDeckOutline(slides, storyline = null) {
  const outline = slides.map((slide, index) => {
    const meta = slide.metadata || extractSlideMetadata(slide.html, slide.type, slide.title);
    return {
      index: index + 1,
      title: meta.title,
      type: meta.type,
      structure: meta.structure,
      headers: meta.headers,
      keyPoints: meta.keyPoints?.slice(0, 3) || [],
      isSkeleton: slide.isSkeleton || false,
      storyPointId: slide.storyPointId || null,
    };
  });

  // Add storyline context if available
  let storylineContext = null;
  if (storyline && storyline.length > 0) {
    storylineContext = storyline.map((point, i) => ({
      index: i + 1,
      title: point.title,
      description: point.description || '',
      keyMessage: point.keyMessage || '',
      hasSlide: outline.some(s => s.storyPointId === point.id),
    }));
  }

  return { slides: outline, storyline: storylineContext };
}

// Build context string based on detail level
export function buildContextString(slides, contextLevel = 'outline', storyline = null) {
  if (!slides || slides.length === 0) {
    return { context: 'No slides in deck yet.', tokenEstimate: 10 };
  }

  let context = '';
  let tokenEstimate = 0;

  if (contextLevel === 'full') {
    // Full context but using extracted content instead of raw HTML
    context = slides.map((slide, i) => {
      const content = extractSlideContentForAI(slide.html, { maxLength: 600 });
      return `--- Slide ${i + 1}: ${slide.title} [${slide.type}] ---\n${content}`;
    }).join('\n\n');
    tokenEstimate = Math.ceil(context.length / 4);

  } else if (contextLevel === 'metadata') {
    // Metadata only (headers, key points, structure)
    const outline = buildDeckOutline(slides, storyline);
    context = `DECK STRUCTURE (${slides.length} slides):\n\n`;
    context += outline.slides.map(s => {
      let entry = `${s.index}. [${s.type}/${s.structure}] "${s.title}"`;
      if (s.headers.length > 1) {
        entry += `\n   Headers: ${s.headers.slice(1).join(', ')}`;
      }
      if (s.keyPoints.length > 0) {
        entry += `\n   Key points: ${s.keyPoints.join('; ')}`;
      }
      if (s.isSkeleton) entry += ' [SKELETON]';
      return entry;
    }).join('\n');

    if (outline.storyline) {
      context += `\n\nSTORYLINE (${outline.storyline.length} points):\n`;
      context += outline.storyline.map(p => {
        let entry = `${p.index}. ${p.title}`;
        if (p.description) entry += ` - ${p.description}`;
        if (p.keyMessage) entry += ` [Key: ${p.keyMessage}]`;
        entry += p.hasSlide ? ' ✓' : ' (no slide)';
        return entry;
      }).join('\n');
    }
    tokenEstimate = Math.ceil(context.length / 4);

  } else {
    // Outline only (lightest - just titles and types)
    context = `DECK OUTLINE (${slides.length} slides):\n`;
    context += slides.map((slide, i) => {
      const summary = slide.summary || generateSlideSummary(slide.html, slide.type, slide.title);
      return `${i + 1}. ${summary}${slide.isSkeleton ? ' [SKELETON]' : ''}`;
    }).join('\n');

    if (storyline && storyline.length > 0) {
      context += `\n\nSTORYLINE: ${storyline.map(p => p.title).join(' → ')}`;
    }
    tokenEstimate = Math.ceil(context.length / 4);
  }

  return { context, tokenEstimate };
}

// Build MINIMAL context for slide editing - position + lightweight neighbor info
// This reduces token usage significantly while keeping the agent informed
export function buildMinimalEditContext(slides, currentIndex, options = {}) {
  const {
    includeNeighbors = true,  // Include neighbor slide summaries
    includeStoryline = false, // Include storyline titles
    includeDeckStructure = true, // Include full deck structure with summaries
    includeInstructions = true, // Include pending instructions/comments for current slide
    storyline = [],
    neighborRange = 2,        // How many slides before/after to include detailed info
  } = options;

  const total = slides.length;
  const current = slides[currentIndex];

  if (!current) return { positionContext: '', neighborContext: '', storylineContext: '', deckStructure: '', instructionsContext: '' };

  // Position context (always included)
  let positionContext = `SLIDE POSITION: ${currentIndex + 1} of ${total}`;
  if (currentIndex === 0) positionContext += ' (First slide)';
  else if (currentIndex === total - 1) positionContext += ' (Last slide)';

  // Neighbor context with content summaries (not just types/titles)
  let neighborContext = '';
  if (includeNeighbors && total > 1) {
    const neighbors = [];
    const start = Math.max(0, currentIndex - neighborRange);
    const end = Math.min(total - 1, currentIndex + neighborRange);

    for (let i = start; i <= end; i++) {
      if (i === currentIndex) continue;
      const slide = slides[i];
      const position = i < currentIndex ? 'before' : 'after';
      const distance = Math.abs(i - currentIndex);
      // Use stored summary or generate one - includes content, not just title
      const summary = slide.summary || generateSlideSummary(slide.html, slide.type, slide.title);
      neighbors.push(`  ${i + 1}. ${summary} (${distance} slide${distance > 1 ? 's' : ''} ${position})`);
    }

    if (neighbors.length > 0) {
      neighborContext = `\nNEARBY SLIDES:\n${neighbors.join('\n')}`;
    }
  }

  // Storyline context (high-level titles only)
  let storylineContext = '';
  if (includeStoryline && storyline && storyline.length > 0) {
    const titles = storyline.map((p, i) => `${i + 1}. ${p.title}`).join(' → ');
    storylineContext = `\nSTORYLINE: ${titles}`;
  }

  // Full deck structure with summaries (lightweight overview)
  let deckStructure = '';
  if (includeDeckStructure && total > 1) {
    const structure = slides.map((slide, i) => {
      const marker = i === currentIndex ? '→ ' : '  ';
      const summary = slide.summary || generateSlideSummary(slide.html, slide.type, slide.title);
      return `${marker}${i + 1}. ${summary}`;
    }).join('\n');
    deckStructure = `\nDECK STRUCTURE:\n${structure}`;
  }

  // Pending instructions/comments for current slide
  let instructionsContext = '';
  if (includeInstructions && current.comments && current.comments.length > 0) {
    const pendingComments = current.comments.filter(c => !c.addressed);
    if (pendingComments.length > 0) {
      const commentsList = pendingComments.map((c, i) => `  ${i + 1}. ${c.text}`).join('\n');
      instructionsContext = `\nPENDING INSTRUCTIONS FOR THIS SLIDE:\n${commentsList}\n\nIMPORTANT: Address these instructions when editing this slide. Mark them as addressed when complete.`;
    }
  }

  return { positionContext, neighborContext, storylineContext, deckStructure, instructionsContext };
}

// Generate or update the summary for a slide after edits
export function updateSlideSummary(slide) {
  if (!slide) return slide;
  // Always regenerate summary based on current HTML content
  const newSummary = generateSlideSummary(slide.html, slide.type, slide.title);
  return { ...slide, summary: newSummary };
}

// Build deck context string from existing slides with hierarchy
function buildDeckContext(existingSlides, storyline = []) {
  if (!existingSlides || existingSlides.length === 0) {
    return '';
  }

  // Build hierarchy tree for indentation
  const getIndent = (slide) => {
    let indent = 0;
    let current = slide;
    while (current.parentId) {
      indent++;
      current = existingSlides.find(s => s.id === current.parentId);
      if (!current) break;
    }
    return '  '.repeat(indent);
  };

  const context = existingSlides.map((slide, index) => {
    const summary = slide.summary || generateSlideSummary(slide.html, slide.type, slide.title);
    const indent = getIndent(slide);
    const parent = slide.parentId ? existingSlides.find(s => s.id === slide.parentId) : null;
    const parentNote = parent ? ` (under: ${parent.title || 'parent'})` : '';
    const layout = detectSlideLayout(slide.html);
    const layoutTag = layout !== 'unknown' ? ` [layout: ${layout}]` : '';
    return `  ${index + 1}. ${indent}${summary}${parentNote}${layoutTag}`;
  }).join('\n');

  // Include storyline ONLY if explicitly requested (for create operations, not edits)
  // Storyline context is optional - pass includeStoryline=true when creating slides
  let storylineContext = '';

  // Count layout frequency for diversity guidance
  const layoutCounts = {};
  existingSlides.forEach(s => {
    const l = detectSlideLayout(s.html);
    if (l !== 'unknown' && l !== 'cover') layoutCounts[l] = (layoutCounts[l] || 0) + 1;
  });
  const usedLayouts = Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([l, c]) => `${l}(×${c})`);
  const diversityNote = usedLayouts.length > 0
    ? `\nLAYOUT DIVERSITY: The deck already uses: ${usedLayouts.join(', ')}. AVOID repeating the most-used layouts. Pick a DIFFERENT layout for the new slide(s) unless the content absolutely requires it.`
    : '';

  return `
EXISTING DECK STRUCTURE (${existingSlides.length} slides):
${context}
${diversityNote}
IMPORTANT:
- New slides will be added AFTER these existing slides
- Maintain the hierarchical structure (child slides support their parent section)
- No cover slide in the middle, maintain narrative continuity`;
}

/**
 * Detect the primary layout component used in a slide's HTML.
 * Returns a short label like "card-row", "grid-2x2", "content-list", etc.
 */
export function detectSlideLayout(html) {
  if (!html) return 'unknown';
  // Order matters — check more specific patterns first
  const patterns = [
    [/class="[^"]*\bgrid-2x2\b/, 'grid-2x2'],
    [/class="[^"]*\bcard-row\b/, 'card-row'],
    [/class="[^"]*\bcontent-list\b/, 'content-list'],
    [/class="[^"]*\bsplit-layout\b/, 'split-layout'],
    [/class="[^"]*\btwo-col\b/, 'two-col'],
    [/class="[^"]*\bstat-highlight\b/, 'stat-highlight'],
    [/class="[^"]*\bprocess-flow\b/, 'process-flow'],
    [/class="[^"]*\btimeline-container\b/, 'timeline'],
    [/class="[^"]*\bquote-block\b/, 'quote-block'],
    [/class="[^"]*\bcover\b/, 'cover'],
  ];
  for (const [re, label] of patterns) {
    if (re.test(html)) return label;
  }
  return 'freestyle';
}

// Build minimal storyline summary (used only when relevant)
export function buildStorylineSummary(storyline, compact = true) {
  if (!storyline || storyline.length === 0) return '';

  if (compact) {
    return storyline.map(p => p.title).join(' → ');
  }

  return storyline.map((p, i) => {
    const parentNote = p.parentId ? ` (child of: ${storyline.find(sp => sp.id === p.parentId)?.title || 'parent'})` : '';
    return `  ${i + 1}. ${p.title}${parentNote}${p.keyMessage ? ` - ${p.keyMessage}` : ''}`;
  }).join('\n');
}

// ============================================
// IMAGE GENERATION
// ============================================

/**
 * Call an image generation API to produce a slide visual.
 * Uses settings.imageModel (format: "providerId:modelName").
 * Supports:
 *   - Gemini 3 Pro Image (generateContent with responseModalities: ["TEXT","IMAGE"])
 *   - Gemini Imagen (predict endpoint)
 *   - OpenAI GPT-Image-1, DALL-E 3 (/images/generations)
 *   - Azure/PwC proxies for all of the above
 * Returns a data:image/png;base64,... URI string.
 */
export async function generateImage(imagePrompt, settings, referenceImageDataUri = null) {
  const imageModelRef = settings.imageModel;
  if (!imageModelRef) {
    throw new Error('No image model configured. Set imageModel in Settings (e.g., "pwc:gemini-3-pro-image-preview").');
  }

  const { providerId, modelName } = parseModelRef(imageModelRef);
  const provider = findProvider(settings, providerId);
  if (!provider?.apiKey) {
    throw new Error(`No API key configured for "${providerId}" provider. Add it in Settings to use image generation.`);
  }

  const apiUrl = provider.apiUrl || '';
  const isAzureStyle = provider.azurePrefix || apiUrl.includes('openai.azure.com');

  // Build auth headers (same logic as text API calls)
  const headers = { 'Content-Type': 'application/json' };
  if (provider.authType === 'server') {
    // Server-managed auth: backend proxy adds the key
  } else if (provider.authType === 'api-key' || isAzureStyle) {
    headers['api-key'] = provider.apiKey;
  } else if (provider.authType === 'bearer') {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  } else if (apiUrl.includes('anthropic.com')) {
    headers['x-api-key'] = provider.apiKey;
  } else {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  // Detect model type
  const isGeminiImageModel = modelName.includes('gemini') && modelName.includes('image');
  const isGeminiImagen = modelName.includes('imagen');
  const isGptImage1 = modelName.includes('gpt-image');
  const isDallE = modelName.includes('dall-e');

  // ── Gemini 3 Pro Image (generateContent with responseModalities) ──
  if (isGeminiImageModel) {
    const isPwcOrProxy = apiUrl.includes('/chat/completions') || isAzureStyle;
    const requestModel = isAzureStyle ? `azure.${modelName}` : modelName;

    if (isPwcOrProxy) {
      // PwC / Azure-style proxy: use the existing /chat/completions endpoint.
      // Send OpenAI-format messages + Gemini-specific generationConfig fields.
      // The proxy forwards these extra fields to the Gemini backend.
      const geminiEndpoint = apiUrl; // keep /chat/completions as-is

      // Build message content: text prompt + optional reference image for editing
      let messageContent;
      if (referenceImageDataUri) {
        // Multipart: send reference image + text instruction for image editing
        messageContent = [
          { type: 'image_url', image_url: { url: referenceImageDataUri } },
          { type: 'text', text: imagePrompt },
        ];
      } else {
        messageContent = imagePrompt;
      }

      const requestBody = {
        model: requestModel,
        messages: [
          { role: 'user', content: messageContent },
        ],
        // Gemini-specific fields — the proxy passes these through to the backend
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '16:9' },
        },
      };

      console.log('[generateImage] Gemini Image via proxy /chat/completions:', { geminiEndpoint, model: requestModel, provider: providerId });

      return await _callImageEndpoint(geminiEndpoint, headers, requestBody, (data) => {
        // The proxy may return Gemini-native or OpenAI-compatible format.
        // Log full response structure for debugging.
        const msg = data.choices?.[0]?.message;
        console.log('[generateImage] Proxy response structure:', {
          topKeys: Object.keys(data),
          hasChoices: !!data.choices?.length,
          msgKeys: msg ? Object.keys(msg) : null,
          contentType: msg ? (Array.isArray(msg.content) ? 'array' : typeof msg.content) : null,
          contentSample: msg ? (Array.isArray(msg.content)
            ? msg.content.map(b => ({ type: b.type, keys: Object.keys(b) }))
            : (typeof msg.content === 'string' ? msg.content.slice(0, 200) : null)) : null,
          hasParts: !!msg?.parts,
        });

        // Try Gemini native: candidates[0].content.parts[].inline_data
        const candidateParts = data.candidates?.[0]?.content?.parts || [];
        for (const part of candidateParts) {
          if (part.inline_data?.data) {
            const mimeType = part.inline_data.mime_type || 'image/png';
            return `data:${mimeType};base64,${part.inline_data.data}`;
          }
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${part.inlineData.data}`;
          }
        }

        // OpenAI-compatible: choices[0].message
        if (msg) {
          // PwC proxy format: message.images[] with image_url data URIs
          if (Array.isArray(msg.images) && msg.images.length > 0) {
            for (const img of msg.images) {
              // image_url can be a string or an object like {url: "data:..."}
              if (img.image_url) {
                if (typeof img.image_url === 'string') return img.image_url;
                if (typeof img.image_url === 'object') {
                  if (img.image_url.url) return img.image_url.url;
                  if (img.image_url.data) return `data:image/png;base64,${img.image_url.data}`;
                }
              }
              if (img.url) return img.url;
              if (img.b64_json) return `data:image/png;base64,${img.b64_json}`;
            }
          }

          // Case 1: content is multipart array
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              // OpenAI image_url block
              if (block.type === 'image_url' && block.image_url?.url) {
                return block.image_url.url;
              }
              // Anthropic-style image block
              if (block.type === 'image' && block.source?.data) {
                const mimeType = block.source.media_type || 'image/png';
                return `data:${mimeType};base64,${block.source.data}`;
              }
              // Gemini inline_data passed through in content array
              if (block.inline_data?.data) {
                const mimeType = block.inline_data.mime_type || 'image/png';
                return `data:${mimeType};base64,${block.inline_data.data}`;
              }
              if (block.inlineData?.data) {
                const mimeType = block.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${block.inlineData.data}`;
              }
              // Some proxies use {type: "image", data: "base64..."}
              if (block.type === 'image' && typeof block.data === 'string') {
                return `data:image/png;base64,${block.data}`;
              }
              // Block with b64 field
              if (block.b64_json) {
                return `data:image/png;base64,${block.b64_json}`;
              }
              // Scan any object block for base64 data fields
              if (typeof block === 'object' && block !== null) {
                for (const val of Object.values(block)) {
                  if (typeof val === 'string' && val.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(val.slice(0, 100))) {
                    console.log('[generateImage] Found likely base64 in content block field');
                    return `data:image/png;base64,${val}`;
                  }
                }
              }
            }
          }

          // Case 2: content is a string — could be base64 or contain embedded data URI
          if (typeof msg.content === 'string') {
            const content = msg.content;
            // Check for embedded data URI
            const dataUriMatch = content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
            if (dataUriMatch) {
              return dataUriMatch[0];
            }
            // Check if the entire string is base64 (long, no spaces)
            if (content.length > 1000 && !content.includes(' ') && /^[A-Za-z0-9+/=\n]+$/.test(content.slice(0, 200))) {
              console.log('[generateImage] Message content appears to be raw base64');
              return `data:image/png;base64,${content.replace(/\n/g, '')}`;
            }
          }

          // Case 3: message has Gemini-style parts directly
          if (Array.isArray(msg.parts)) {
            for (const part of msg.parts) {
              if (part.inline_data?.data) {
                const mimeType = part.inline_data.mime_type || 'image/png';
                return `data:${mimeType};base64,${part.inline_data.data}`;
              }
              if (part.inlineData?.data) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${part.inlineData.data}`;
              }
            }
          }
        }

        // Fallback: b64_json in OpenAI images format
        if (data.data?.[0]?.b64_json) {
          return `data:image/png;base64,${data.data[0].b64_json}`;
        }

        console.warn('[generateImage] Could not extract image from proxy response. Full choices[0].message:', JSON.stringify(msg, null, 2)?.slice(0, 3000));
        return null;
      });
    }

    // Direct Gemini API (Vertex AI or generativelanguage.googleapis.com)
    let geminiEndpoint;
    if (apiUrl.includes('aiplatform.googleapis.com')) {
      geminiEndpoint = `${apiUrl.replace(/\/+$/, '')}/publishers/google/models/${modelName}:generateContent`;
    } else if (apiUrl.includes('generativelanguage.googleapis.com')) {
      geminiEndpoint = `${apiUrl}/models/${modelName}:generateContent?key=${provider.apiKey}`;
    } else {
      geminiEndpoint = `${apiUrl.replace(/\/+$/, '')}/models/${modelName}:generateContent`;
    }

    // Build parts: text + optional reference image for editing
    const parts = [{ text: imagePrompt }];
    if (referenceImageDataUri) {
      // Extract mime type and base64 data from data URI
      const match = referenceImageDataUri.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (match) {
        parts.unshift({ inline_data: { mime_type: match[1], data: match[2] } });
      }
    }

    const requestBody = {
      model: modelName,
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      },
    };

    console.log('[generateImage] Gemini Image direct generateContent:', { geminiEndpoint, model: modelName, provider: providerId, hasRefImage: !!referenceImageDataUri });

    return await _callImageEndpoint(geminiEndpoint, headers, requestBody, (data) => {
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inline_data?.data) {
          const mimeType = part.inline_data.mime_type || 'image/png';
          return `data:${mimeType};base64,${part.inline_data.data}`;
        }
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    });
  }

  // ── Gemini Imagen (predict endpoint) ──
  if (isGeminiImagen) {
    let imagenEndpoint;
    if (apiUrl.includes('generativelanguage.googleapis.com')) {
      imagenEndpoint = `${apiUrl}/models/${modelName}:predict?key=${provider.apiKey}`;
    } else if (apiUrl.includes('/chat/completions')) {
      imagenEndpoint = apiUrl.replace('/chat/completions', `/models/${modelName}:predict`);
    } else {
      imagenEndpoint = `${apiUrl.replace(/\/+$/, '')}/models/${modelName}:predict`;
    }

    const requestBody = {
      instances: [{ prompt: imagePrompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9' },
    };

    console.log('[generateImage] Imagen predict call:', { imagenEndpoint, model: modelName, provider: providerId });

    return await _callImageEndpoint(imagenEndpoint, headers, requestBody, (data) => {
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      return b64 ? `data:image/png;base64,${b64}` : null;
    });
  }

  // ── OpenAI-compatible (GPT-Image-1, DALL-E 3, Azure proxies) ──
  let imageEndpoint;
  if (apiUrl.includes('/chat/completions')) {
    imageEndpoint = apiUrl.replace('/chat/completions', '/images/generations');
  } else if (apiUrl.includes('api.openai.com')) {
    imageEndpoint = 'https://api.openai.com/v1/images/generations';
  } else {
    imageEndpoint = apiUrl.replace(/\/+$/, '') + '/images/generations';
  }

  const azureModel = isAzureStyle ? `azure.${modelName}` : modelName;
  const requestBody = {
    model: azureModel,
    prompt: imagePrompt,
    n: 1,
    size: isGptImage1 ? '1536x1024' : (isDallE ? '1792x1024' : '1024x1024'),
    quality: isGptImage1 ? 'high' : 'hd',
  };
  if (isGptImage1) {
    requestBody.output_format = 'b64_json';
  } else {
    requestBody.response_format = 'b64_json';
  }

  console.log('[generateImage] OpenAI image call:', { imageEndpoint, model: azureModel, provider: providerId });

  return await _callImageEndpoint(imageEndpoint, headers, requestBody, (data) => {
    const b64 = data.data?.[0]?.b64_json;
    return b64 ? `data:image/png;base64,${b64}` : null;
  });
}

/**
 * Internal: call an image endpoint with retry logic and parse the response.
 * @param {string} endpoint - API URL
 * @param {object} headers - Request headers
 * @param {object} body - Request body
 * @param {function} extractImage - (responseData) => dataUri | null
 * @returns {string} data:image/...;base64,... URI
 */
async function _callImageEndpoint(endpoint, headers, body, extractImage) {
  const MAX_RETRIES = 2;
  const BASE_DELAYS = [3000, 6000];
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_DELAYS[attempt - 1];
        console.log(`[generateImage] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errMsg = error.error?.message || `Image API error: ${response.status}`;
        if (response.status === 429) {
          throw new Error(`Image generation rate limited: ${errMsg}`);
        }
        lastError = new Error(errMsg);
        if (response.status >= 500) continue; // retry on 5xx
        throw lastError;
      }

      const data = await response.json();
      const dataUri = extractImage(data);

      if (!dataUri) {
        throw new Error('Image API returned no image data');
      }

      console.log('[generateImage] Image generated successfully');
      return dataUri;

    } catch (err) {
      lastError = err;
      if (err.message.includes('rate limited') || err.message.includes('429')) throw err;
      if (attempt === MAX_RETRIES) throw lastError;
    }
  }
  throw lastError || new Error('Image generation failed after retries');
}

/**
 * Generate a complete image slide (HTML) with AI-generated visuals.
 * @param {string} instruction - Content instruction from router
 * @param {object} settings - Full settings object
 * @param {'full'|'content'} mode - 'full' = full-bleed image, 'content' = image in frame with text
 * @param {object} contextInfo - { layoutGuidance, vibe, footerBranding, slideNumber, totalSlides }
 * @returns {object} { id, title, html, type, templateId }
 */
// Extract base64 image data URI from slide HTML (for image editing)
export function extractImageDataUri(html) {
  if (!html) return null;
  const match = html.match(/src="(data:image\/[^"]+)"/);
  return match ? match[1] : null;
}

export async function generateImageSlide(instruction, settings, mode = 'content', contextInfo = {}) {
  const { layoutGuidance, vibe, footerBranding = 'Strategy&', slideNumber = 1, totalSlides, existingImageDataUri } = contextInfo;

  // Only inject vibe variation for non-base vibes — base vibe is the default consulting style
  const vibeContext = (vibe && !isBaseVibe(vibe)) ? getVibePromptContext(vibe) : '';

  // Clean instruction for IMAGE prompt: strip all metadata (vibe tags, search hints, context blocks)
  // These should NOT appear in the image or be rendered as text
  const cleanInstruction = instruction
    .replace(/\[Design Style:[^\]]*\]/g, '')               // strip vibe tags
    .replace(/\[Vibe:[^\]]*\]/g, '')                        // strip vibe short hints
    .replace(/\[SEARCH THE WEB[^\]]*\]/g, '')              // strip search hints
    .replace(/\[CONTEXT FROM EXISTING SLIDES[\s\S]*$/g, '') // strip slide context blocks
    .replace(/Layout\/Design Instructions:[\s\S]*/s, '')   // strip layout section, keep topic/content before it
    .trim();

  // Text instruction for TITLE/SUBTITLE generation: preserve search directives so the text
  // model can use web search (via _extraTools) to ground titles in real data.
  // CRITICAL: Strip ALL visual/layout guidance — only keep the substantive content message.
  const textInstruction = instruction
    .replace(/\[Design Style:[^\]]*\]/g, '')               // strip vibe tags
    .replace(/\[Vibe:[^\]]*\]/g, '')                        // strip vibe short hints
    .replace(/\[CONTEXT FROM EXISTING SLIDES[\s\S]*$/g, '') // strip slide context blocks
    .replace(/Layout\/Design Instructions:[\s\S]*/s, '')   // strip layout section, keep topic/content before it
    // Strip visual guidance patterns — template placeholders and framework descriptions
    .replace(/\[Main heading[^\]]*\]/gi, '')                // strip "[Main heading that summarizes...]"
    .replace(/\[Subtitle[^\]]*\]/gi, '')                    // strip "[Subtitle]" or "[Subtitle text]"
    .replace(/\[Card \d[^\]]*\]/gi, '')                     // strip "[Card 1 Title]", "[Card 2 description]"
    .replace(/\[Icon\]/gi, '')                              // strip "[Icon]"
    .replace(/\[Company\]/gi, '')                           // strip "[Company]"
    .replace(/\[Key point \d\]/gi, '')                      // strip "[Key point 1]"
    .replace(/\[Metric[^\]]*\]/gi, '')                      // strip "[Metric 1]" etc.
    .replace(/\[Area \d[^\]]*\]/gi, '')                     // strip "[Area 1 Title]" etc.
    .replace(/\[Brief description[^\]]*\]/gi, '')           // strip "[Brief description...]"
    .replace(/\[Your [\w\s]+ here\]/gi, '')                 // strip "[Your title here]" etc.
    .trim();

  // When layoutGuidance exists, use it as the visual structure directive. But also pass the
  // instruction content so the image model knows what data, labels, and entities to put IN the
  // diagram — not just the diagram shape. Without content, the image model creates generic
  // diagrams with placeholder labels instead of real data.
  let visualDirective;
  let contentContext = '';
  if (layoutGuidance) {
    visualDirective = layoutGuidance;
    // Extract the substantive content from the instruction (strip metadata, keep data/message)
    // This tells the image model WHAT to put in the visual structure
    const contentForImage = cleanInstruction
      .replace(/\[RESEARCH DATA[^\]]*\]/g, '')        // strip research header tags
      .replace(/\[VISUAL LAYOUT:[^\]]*\]/g, '')        // strip layout tags (already in layoutGuidance)
      .slice(0, 800);                                   // cap to avoid overwhelming the image model
    if (contentForImage.length > 30) {
      contentContext = `\n\nCONTENT TO REPRESENT IN THE VISUAL:\n${contentForImage}\n\nUse the ACTUAL data points, names, labels, and numbers from the content above in your diagram. Do NOT use generic placeholders like "Item 1", "Category A" — use the real entities and values from the content.`;
    }
  } else {
    // No layout guidance — use the instruction itself as both visual hint and content
    visualDirective = cleanInstruction.slice(0, 400);
  }

  // Build the image prompt — reframe as "raw content image", NOT a slide
  const imagePrompt = `You are generating a CONTENT IMAGE for a strategy consulting slide (Strategy&/McKinsey/BCG style). This is NOT a slide — it is a raw visual that will be embedded inside an existing HTML slide that already has its own title, subtitle, and footer. Your job is ONLY to produce the visual content itself.

DO NOT INCLUDE ANY OF THESE — they already exist in the HTML around this image:
• NO title, heading, or header text of any kind
• NO subtitle or label text at the top
• NO footer, source line, caption, or page number
• NO border, frame, outline, or surrounding box
• NO rounded corners, card shapes, or drop shadows
• NO background shape or container wrapping the content
• NO decorative vertical bar or accent stripe along the left or right edge

THE IMAGE MUST BE: just the raw framework/diagram on a plain white background, edge-to-edge, with NO surrounding elements.

TARGET DIMENSIONS: ${mode === 'full' ? 'Wide landscape 16:9 (960×540 container)' : 'Extra-wide landscape ~2.5:1 (890×353 container) — arrange content horizontally, keep it short and wide, not tall'}

VISUAL TO GENERATE: ${visualDirective}
${contentContext}
VERTICAL LOGIC: This image will appear below a title (h1) that states a "so what" insight. Your visual must SUPPORT that claim with evidence, structure, or a framework. The reader should look at the title, then the image, and think "yes, the data/structure proves the title's point." Do NOT generate a generic illustration — generate a specific analytical visual that substantiates the argument. Use the REAL content (names, numbers, entities) from the instruction — not generic placeholders.

CONSULTING VISUAL STYLE — Think like a Strategy& or McKinsey slide designer:
Use structured consulting frameworks, NOT generic infographics. Examples of what to generate:
- Value chains (horizontal flow of connected stages with labels)
- Chevron arrows (sequential process steps, left to right)
- 2×2 matrices (labeled axes, items in quadrants)
- SWOT / PESTEL grids (labeled quadrants or sections)
- Waterfall charts (incremental bars showing build-up or breakdown)
- Pyramid / triangle diagrams (layered hierarchy)
- Hub-and-spoke models (central concept with connected elements)
- Comparison tables (simple rows/columns with check marks or values)
- Stacked bar breakdowns (segment composition)
- Funnel diagrams (stages narrowing down)
- Venn diagrams (2-3 overlapping circles)
- Roadmap / timeline (horizontal phases with milestones)
- Bridge charts (walk from A to B with incremental steps)
DO NOT generate: decorative illustrations, stock-photo-style scenes, abstract art, generic infographics with random shapes, or clip-art style visuals. This is CONSULTING, not marketing.

EXECUTION: Flat shapes, thin clean lines, solid fills. NO photographs, NO gradients, NO 3D effects, NO decorative flourishes.

CLIENT-READY IMAGE — absolutely NO metadata, technical specs, or implementation details visible:
- NEVER show font names, font sizes, point values, pixel values, hex color codes, or CSS properties as text in the image
- NEVER show labels like "12pt", "14px", "Arial", "Bold", "#8E1E1E", "maroon" or similar technical annotations
- The image must look like it came from a professional design agency — clean, polished, ready to present to a C-suite client
- Only CONTENT labels appear in the image: category names, data values, axis labels, short descriptions

TEXT LABELS:
- All body text should be small and uniform in size — think standard diagram label size
- Section headings and axis titles can be slightly larger and bold, but only slightly
- Keep all labels to 3-4 words max. NO long sentences.
- Every label must have strong contrast: dark text on light fills, white text on dark fills

VISUAL STYLE:
- Primary accent color: deep maroon/burgundy for key shapes, highlights, and emphasis
- Body text: near-black on white or light backgrounds
- Shape fills: very light grey or pale rose for cards and surfaces
- Borders and dividers: light grey, thin lines
- Positive indicators: green. Negative: red. Caution: amber. Info: blue.
- Background: plain white, edge to edge
- Do NOT invent bright or neon colors — keep the palette muted and professional
${vibeContext ? `STYLE VARIATION: ${vibeContext}\n` : ''}${existingImageDataUri ? 'EDIT MODE: A reference image is provided. Modify it according to the instructions above while preserving its overall structure and style.\n' : ''}Content must fill the entire image area edge-to-edge with no margins or padding.`;

  console.log(`[generateImageSlide] mode=${mode}, instruction="${instruction.slice(0, 100)}...", layoutGuidance="${layoutGuidance || 'none'}", hasExistingImage=${!!existingImageDataUri}`);

  if (mode === 'full') {
    // Full image slide — just generate the image (pass reference if editing)
    const imageDataUri = await generateImage(imagePrompt, settings, existingImageDataUri || null);
    const title = (textInstruction || cleanInstruction).slice(0, 80).replace(/[<>"]/g, '').replace(/\[[^\]]*\]/g, '').trim();

    return {
      id: `slide-${Date.now()}`,
      title,
      html: `<div class="slide slide-image-full">
  <img src="${imageDataUri}" alt="${title}" class="slide-image-cover" />
</div>`,
      type: 'image-full',
      templateId: 'image-full',
    };

  } else {
    // Image-content mode: generate image + text in parallel
    const textPrompt = `Based on this content instruction, generate slide text components in the style of a senior Strategy& consultant.

FULL CONTENT INSTRUCTION (use this to understand WHAT the slide is about):
${textInstruction}
${layoutGuidance ? `\n(DO NOT use this in title/subtitle — this is only context about what the accompanying image depicts: ${layoutGuidance})` : ''}

VERTICAL LOGIC is CRITICAL: The title (h1) is the "so what" — it makes the key claim or insight. The image visual (being generated separately) provides the EVIDENCE or STRUCTURE that supports that claim. Title and visual must tell a coherent story together.

CONTENT FIDELITY: Ground your title in the ACTUAL content above. The user's specific data, claims, and terminology must appear in the title — do NOT replace them with vague labels.
- If instruction has a clear "so what" sentence, USE IT as the title (lightly trim to 8-12 words if needed, but keep the user's key words and data).
- If instruction says "Revenue grew 18% driven by APAC expansion" → title: "APAC expansion drives 18% revenue growth" (user's data preserved)
- If instruction says "3 risks: supply chain (high), currency (medium), regulation (low)" → title: "Supply chain risk dominates the risk landscape" (user's entities preserved)
- If instruction contains questions, keep them as questions in the title.
- Do NOT invent data or claims that aren't in the instruction.
- Do NOT replace specific content with generic labels (e.g., "Revenue grew 18%" → "Financial Performance Overview" is WRONG).

CRITICAL — TITLE AND SUBTITLE MUST BE PURE CONTENT, NEVER VISUAL GUIDANCE:
- NEVER describe the visual format in the title (e.g., "2x2 matrix shows..." or "Three-pillar framework for..." is WRONG)
- NEVER reference diagram types, chart types, axes, quadrants, or layout structures in the title
- NEVER use template placeholder text like "[Main heading...]", "[Subtitle]", "[Card Title]" etc.
- The title states the BUSINESS INSIGHT or STRATEGIC CLAIM — what the audience should CONCLUDE
- The subtitle is a short TOPIC LABEL (e.g., "Market Analysis", "Growth Strategy") — never a visual description
- BAD title: "Hub-and-spoke model for digital capabilities" (describes the diagram, not the insight)
- BAD title: "2x2 matrix of implementation complexity vs impact" (describes axes, not the conclusion)
- GOOD title: "Four digital capabilities anchor the transformation" (states the insight the visual proves)
- GOOD title: "High-impact initiatives require minimal complexity" (states the conclusion from the matrix)

Generate:
1. title: An insight-driven "so what" sentence (8-12 words max, NEVER end with a period). This is the KEY TAKEAWAY — what should the reader conclude from looking at the visual? Must contain a verb and make a strategic claim grounded in the actual content.
   - GOOD: "Three capability gaps limit our market expansion" (title) + (image shows a gap analysis framework)
   - GOOD: "Digital maturity drives 40% higher margins" (title) + (image shows correlation chart)
   - BAD: "Digital Maturity Overview" (just a label, no insight)
   - BAD: "Our digital transformation journey." (period at end, no "so what")
2. subtitle: A short section/topic label (2-3 words, noun phrase, no verbs). NEVER a diagram/chart type description.
3. footer: Brief source attribution if relevant, or leave empty

NEVER include metadata tags like [Design Style: ...], [Vibe: ...], or [SEARCH ...] in the title or subtitle — those are system metadata, not content.
NEVER include visual guidance like diagram types, chart labels, framework names, axes descriptions, or layout instructions in the title or subtitle — those describe the IMAGE, not the INSIGHT.

Return ONLY valid JSON: {"title": "...", "subtitle": "...", "footer": ""}`;

    // Run image generation and text generation in parallel (pass reference image if editing)
    const [imageDataUri, textContent] = await Promise.all([
      generateImage(imagePrompt, settings, existingImageDataUri || null),
      callGeminiAPI(settings, 'You are a Strategy& consulting presentation writer. Return only valid JSON.', textPrompt),
    ]);

    // Parse text response — use textInstruction (content-only) as fallback, not cleanInstruction
    const fallbackTitle = (textInstruction || cleanInstruction).slice(0, 60);
    let title = fallbackTitle;
    let subtitle = '';
    let footer = '';
    try {
      const cleaned = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      title = parsed.title || fallbackTitle;
      subtitle = parsed.subtitle || '';
      footer = parsed.footer || '';
    } catch (e) {
      console.warn('[generateImageSlide] Failed to parse text response, using fallback title:', e.message);
    }

    // Post-process: strip any visual guidance that leaked into title/subtitle
    const stripVisualGuidance = (text) => text
      .replace(/\[[^\]]*\]/g, '')                          // strip all bracket placeholders
      .replace(/\b\d+[x×]\d+\s*(matrix|grid)\b/gi, '')    // strip "2x2 matrix" etc.
      .replace(/\b(x-axis|y-axis|quadrant|hub-and-spoke|chevron|funnel|venn|waterfall)\b/gi, '') // strip chart jargon
      .replace(/\s{2,}/g, ' ')                             // collapse multiple spaces
      .trim();
    title = stripVisualGuidance(title);
    subtitle = stripVisualGuidance(subtitle);
    // If title got stripped to empty, use fallback
    if (!title) title = fallbackTitle;

    const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeSubtitle = subtitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeFooter = footer.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const slideNum = totalSlides ? `${slideNumber} / ${totalSlides}` : `${slideNumber}`;

    return {
      id: `slide-${Date.now()}`,
      title,
      html: `<div class="slide">
  <h1 class="title">${safeTitle}</h1>
  ${safeSubtitle ? `<h2 class="subtitle">${safeSubtitle}</h2>` : ''}
  <div class="frame">
    <img src="${imageDataUri}" alt="${safeTitle}" class="frame-image" />
  </div>
  <footer class="footer"><span>${footerBranding}</span><span>${slideNum}</span></footer>
</div>`,
      type: 'image-content',
      templateId: 'image-content',
    };
  }
}

// Layout guidance patterns for freestyle slides — prevents overlap and overflow
// by giving the AI specific structural constraints for each layout type.
export const LAYOUT_GUIDANCE_MAP = {
  '2x2': {
    label: '2×2 Grid',
    instruction: `LAYOUT: 2×2 GRID (4 items in a square grid)
- Use <div class="grid-2x2"> with exactly 4 <div class="grid-cell"> children
- Each cell: <h4> title (max 5 words) + <p> description (max 20 words) or a short <ul> (2-3 items)
- Total grid height MUST stay under 320px — keep cell content SHORT
- DO NOT add cards, KPIs, or other components outside the grid
- DO NOT nest grids or add extra rows — exactly 4 cells, no more`,
  },
  '3-cards': {
    label: '3 Cards',
    instruction: `LAYOUT: 3 HORIZONTAL CARDS
- Use <div class="card-row"> with exactly 3 <div class="card"> children
- Each card: icon circle + card-num + <h3> title (max 4 words) + <p> (max 15 words) + optional impact-box
- Card row height MUST stay under 300px — no extra content below the cards
- DO NOT add bullets, KPIs, or other elements outside the card-row`,
  },
  '4-cards': {
    label: '4 Cards',
    instruction: `LAYOUT: 4 HORIZONTAL CARDS (tight spacing)
- Use <div class="card-row"> with exactly 4 <div class="card"> children
- Each card: icon circle + <h3> title (max 3 words) + <p> (max 15 words)
- OMIT impact-box to save space — 4 cards are tight
- Card row height MUST stay under 300px
- DO NOT add any content outside the card-row — no bullets, no KPIs below`,
  },
  'icons': {
    label: 'Icon-Led Items',
    instruction: `LAYOUT: ICON-LED ITEMS (3-6 items, each with icon + title + description)
- Use <div class="card-row"> or <div class="grid-2x2"> / <div class="grid-3x2"> depending on item count
- 3 items → card-row with 3 cards (icon + title + desc)
- 4 items → grid-2x2 (icon + title + desc in each cell)
- 5-6 items → grid-3x2 (icon + title + short desc)
- Each item: prominent emoji icon + <h3>/<h4> title (max 4 words) + <p> (max 20 words)
- Total height MUST stay under 340px — scale description length to item count`,
  },
  'numbered': {
    label: 'Numbered Steps',
    instruction: `LAYOUT: NUMBERED LIST / PROCESS STEPS
- Use <div class="agenda-list"> with <div class="agenda-item"> children, OR
  <div class="process-flow"> with <div class="process-step"> + <div class="process-arrow"> for horizontal flow
- For vertical list (4+ items): agenda-list — each item has agenda-num (01, 02...) + h4 title + p description
- For horizontal flow (3-4 steps): process-flow — each step has step-number + h4 + p
- Max 6 items for vertical, max 4 for horizontal
- Keep descriptions under 15 words each
- Total height MUST stay under 350px — if 6 items, use very short descriptions`,
  },
  'split': {
    label: 'Two-Column Split',
    instruction: `LAYOUT: TWO-COLUMN SPLIT
- Use <div class="split-layout"> or <div class="two-col"> for left/right layout
- Left side: one content type (KPIs, stat-highlight, or content list)
- Right side: different content type (bullets, description, or styled-list)
- Each column MUST stay under 350px height
- DO NOT stack more than one component per column
- Good combos: stat-highlight left + bullets right, KPI blocks left + description right`,
  },
  'kpi-row': {
    label: 'KPI Metrics Row',
    instruction: `LAYOUT: KPI METRICS ROW (3-5 big numbers)
- Use a horizontal flex container with 3-5 <div class="kpi-block"> items
- Each KPI: <div class="kpi-value"> (big number/stat) + <div class="kpi-label"> (short label, max 4 words)
- KPI row height is naturally ~100px — you can add ONE supporting element below (content-list with max 4 bullets, or a text-callout)
- DO NOT add cards, grids, or heavy content below KPIs — keep it light`,
  },
  'bullets': {
    label: 'Bullet Points',
    instruction: `LAYOUT: CLEAN BULLET LIST
- Use <ul class="content-list"> with <li> items
- Maximum 4-5 bullet points — fewer is better, keep it scannable
- Each bullet: max 12 words, start with a bold key phrase
- You may add ONE element above (e.g., a short intro paragraph or text-callout)
- Total content height MUST stay under 350px
- DO NOT add cards, grids, or KPIs alongside bullets`,
  },
  'timeline': {
    label: 'Timeline',
    instruction: `LAYOUT: TIMELINE (3-6 milestones)
- Use <div class="timeline-container"> with <div class="timeline-row"> children
- Each row: <div class="timeline-marker"> (Q1, 2024, Phase 1, etc.) + <div class="timeline-content"> with <h4> + <p>
- Maximum 5 rows to prevent overflow — if more milestones, use only key ones
- Keep descriptions under 15 words each
- Total height MUST stay under 350px`,
  },
  'comparison': {
    label: 'Comparison',
    instruction: `LAYOUT: COMPARISON (side-by-side or table)
- For 2 options: use <div class="split-layout"> — each side gets a header + bullet list
- For 3+ options: use <table class="comparison-table"> with thead + tbody
- Table: max 5 rows, max 4 columns — use score-high/score-med/score-low classes for visual coding
- Split: max 5 bullets per side
- Total height MUST stay under 350px — reduce rows/bullets if needed`,
  },
  'stat-focus': {
    label: 'Stat Focus',
    instruction: `LAYOUT: SINGLE STAT FOCUS (one big number with context)
- Use <div class="stat-highlight"> as the centerpiece — one big number with label
- Below: optional text-callout or content-list (max 3 bullets) for context
- This layout should feel SPACIOUS — lots of white space around the stat
- Total content height MUST stay under 250px
- DO NOT add cards, grids, or heavy content — the stat IS the slide`,
  },
  'mixed': {
    label: 'Mixed Layout',
    instruction: `LAYOUT: MIXED / COMBINATION (use with caution — highest overflow risk)
- Combine at most 2 component types (e.g., KPI row + bullet list, or stat-highlight + card-row)
- CRITICAL: Total height budget is 350px. Plan before building:
  * KPI row: ~100px, Card row: ~280px, Bullet list: ~25px/item, Grid 2x2: ~320px
  * NEVER combine card-row + grid (overflow guaranteed)
  * NEVER combine card-row + bullet list with 4+ items
- Safe combos: KPI row (~100px) + bullets (4 items ~100px) = ~200px ✓
- Unsafe combos: card-row (~280px) + bullets (4 items ~100px) = ~380px ✗`,
  },
};

export async function generateSlides(prompt, settings, slideCount = 3, existingSlides = [], templateId = null, customTemplate = null, contextInfo = null) {
  // Apply slideCreator role overrides if configured
  const scRole = settings.roleSettings?.slideCreator || {};
  const effectiveSettings = { ...settings };
  if (scRole.model) effectiveSettings.model = scRole.model;
  if (scRole.maxTokens) effectiveSettings.maxTokens = scRole.maxTokens;
  if (scRole.reasoningEffort) effectiveSettings.reasoningEffort = scRole.reasoningEffort;
  if (scRole.temperature !== '' && scRole.temperature !== undefined) effectiveSettings.temperature = scRole.temperature;
  settings = effectiveSettings;

  const creds = getCredentials(settings);
  const { systemPrompt } = settings;

  // Determine if this is freestyle mode (no specific template)
  const isFreestyle = !templateId || templateId === 'freestyle' || templateId === 'custom';

  // Check if user has a CUSTOM system prompt (not empty and different from default)
  const hasCustomSystemPrompt = systemPrompt && systemPrompt.trim() !== '' && systemPrompt !== DEFAULT_SYSTEM_PROMPT;

  // Use concise component guide for freestyle, full examples for template-based generation
  let activeSystemPrompt;
  if (hasCustomSystemPrompt) {
    // User has a custom system prompt - use it
    activeSystemPrompt = systemPrompt;
  } else if (isFreestyle && !customTemplate) {
    // Freestyle mode: single markdown guide is the entire system prompt
    // User's custom guide from settings takes priority if set
    activeSystemPrompt = settings.freestyleGuide && settings.freestyleGuide.trim() !== ''
      ? settings.freestyleGuide
      : FREESTYLE_SLIDE_GUIDE;
  } else {
    // Template mode: use full examples
    activeSystemPrompt = DEFAULT_SYSTEM_PROMPT;
  }

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Handle 'auto' slide count - AI decides based on content
  const isAutoCount = slideCount === null || slideCount === 'auto';
  const targetCount = isAutoCount ? null : (parseInt(slideCount) || 3);

  // Build context from existing slides (include storyline if available)
  const storyline = contextInfo?.storyline || [];
  const existingDeckContext = buildDeckContext(existingSlides, storyline);
  const startingSlideNum = existingSlides.length + 1;

  // Build current slide reference context if available
  let currentSlideContext = '';
  if (contextInfo?.currentSlide) {
    const current = contextInfo.currentSlide;
    currentSlideContext = `
=== CURRENT SLIDE REFERENCE (Slide ${current.slideNumber} of ${current.totalSlides}) ===
You are viewing this slide: "${current.title || 'Untitled'}" [${current.type || 'custom'}]
The user may want you to expand on, detail, or create follow-up slides based on this content:
${current.html.substring(0, 3000)}
=== END CURRENT SLIDE ===
`;
  }

  // Build full deck overview if available
  let deckOverview = '';
  if (contextInfo?.allSlides && contextInfo.allSlides.length > 0) {
    deckOverview = `
=== EXISTING DECK STRUCTURE (${contextInfo.allSlides.length} slides) ===
${contextInfo.allSlides.map((s, i) => `${i + 1}. "${s.title || 'Untitled'}" [${s.type || 'custom'}]${s.summary ? ` - ${s.summary}` : ''}`).join('\n')}
=== END DECK STRUCTURE ===
`;
  }

  // Check if there's already a cover slide
  const hasCover = existingSlides.some(s => s.type === 'cover');
  const coverInstruction = hasCover
    ? '- DO NOT include a cover slide (one already exists at the beginning)'
    : '- ALWAYS start with a cover slide (templateId: "cover", position: "start") — every new deck needs a cover page';

  // Build template instruction if a specific template is selected
  let templateInstruction = '';
  const template = customTemplate || (templateId && SLIDE_TEMPLATES[templateId]);
  const isBlankMaster = template && (template.master === 'blank' || (template.html && template.html.includes('master-blank')));
  if (template) {
    if (isBlankMaster) {
      // Blank-master templates (section dividers, etc.) have custom full-bleed layouts.
      // Do NOT add title/subtitle/frame — reproduce the template structure exactly.
      templateInstruction = `
TEMPLATE STYLE GUIDE: "${template.title}"
${template.description || ''}

Use this template as your EXACT STRUCTURE (reproduce faithfully):
${template.html}

FULL-BLEED TEMPLATE — CRITICAL:
- This template uses a BLANK SLIDE MASTER (master-blank) with a custom layout.
- Do NOT add <h1 class="title">, <h2 class="subtitle">, or <div class="frame"> elements.
- Reproduce the template's HTML structure EXACTLY — only replace placeholder text in brackets.
- Keep the same CSS classes (section-divider-*, separator-*, etc.) as the template.
- The outer <div class="slide master-blank ..."> MUST keep its exact classes.`;
    } else {
      templateInstruction = `
TEMPLATE STYLE GUIDE: "${template.title}"
${template.description || ''}

Use this template as your STYLE GUIDE (flexible adaptation allowed):
${template.html}

FLEXIBLE ADAPTATION RULES:
- Match the LAYOUT TYPE (cards, bullets, grid, etc.) and CSS classes
- CAN adjust item count: template has 3 cards but need 4? Add a 4th card in same style
- CAN adjust item count: template has 5 bullets but need 3? Use only 3 bullets
- Use SAME CSS class names for consistency
- Stay WITHIN THE FRAME boundaries

VISUAL VARIATIONS - Make each slide unique:
- Use DIFFERENT icons for each item (🎯 🚀 💡 📊 ⚡ 🔧 📈 ✅ 🔑 💰 🏆 📋 🎨 🔒 🌐)
- Don't repeat the same icon within a slide
- Vary numbering styles where appropriate (01/02/03, A/B/C, i/ii/iii)
- Vary impact box metrics (Timeline, ROI, Savings, Growth, etc.)

CRITICAL STRUCTURE:
- <h1 class="title"> MUST be a DIRECT child of <div class="slide">, NOT inside the frame
- <h2 class="subtitle"> MUST be a DIRECT child of <div class="slide">, NOT inside the frame
- <div class="frame"> contains ONLY the main content
- Order: <div class="slide"> → h1.title → h2.subtitle → div.frame → footer`;
    }
  }

  // Build slide count instruction
  let countInstruction = '';
  if (isAutoCount) {
    countInstruction = `Decide the appropriate number of slides (1-5) based on the content needs. Generate as many slides as necessary to properly cover the topic.`;
  } else {
    const totalSlides = existingSlides.length + targetCount;
    countInstruction = `Generate exactly ${targetCount} slide(s).
- These will be slides ${startingSlideNum} to ${startingSlideNum + targetCount - 1} of the deck
- Number the footer as "X / ${totalSlides}" starting from ${startingSlideNum}`;
  }

  // Check if user provided explicit layout instructions in the prompt
  const hasLayoutInstructions = prompt.includes('Layout/Design Instructions:') ||
    /\b(circle|pillar|hub|spoke|stacked|boxes? on|columns? on|left.*right|split layout|grid layout|\d+\s*(boxes?|cards?|items?|sections?)\s*(on|left|right))/i.test(prompt);

  // Extract layout instructions if present
  let contentPart = prompt;
  let layoutPart = '';
  if (prompt.includes('Layout/Design Instructions:')) {
    const parts = prompt.split('Layout/Design Instructions:');
    contentPart = parts[0].trim();
    layoutPart = parts[1]?.trim() || '';
  } else if (hasLayoutInstructions) {
    // The whole prompt contains layout info, use it as layout instruction
    layoutPart = prompt;
  }

  // Build layout instruction based on mode (template-based only — freestyle uses the guide)
  let layoutInstruction = '';
  if (template) {
    layoutInstruction = `- Use ONLY the ${template.title} layout for all slides`;
  } else if (!isFreestyle) {
    // Non-freestyle, non-template: provide layout guidance from router if available
    const layoutGuidance = contextInfo?.layoutGuidance || null;
    const layoutGuidanceSpec = layoutGuidance ? LAYOUT_GUIDANCE_MAP[layoutGuidance] : null;
    if (layoutGuidanceSpec) {
      layoutInstruction = `- **LAYOUT GUIDANCE**: Use the ${layoutGuidanceSpec.label} pattern
${layoutGuidanceSpec.instruction}
- Follow the layout guidance above STRICTLY to prevent overflow and overlap`;
    } else if (layoutGuidance) {
      layoutInstruction = `- **LAYOUT GUIDANCE**: "${layoutGuidance}"
- Build this layout using the available CSS classes from the style guide`;
    } else {
      layoutInstruction = `- Choose the best layout for the content
- IMPORTANT: Vary layouts across slides.`;
    }
  }
  // For freestyle: layoutInstruction stays empty — the guide handles layout selection

  // Build user prompt — freestyle gets a clean, minimal prompt; template mode gets the full one
  let userPrompt;

  if (isFreestyle && !template) {
    // === FREESTYLE USER PROMPT ===
    // The system prompt (the .md guide) has all the rules. User prompt is just content + context.
    const freestyleIntro = hasLayoutInstructions
      ? `Create a slide about the following content, using a layout that matches the user's intent:

CONTENT AND LAYOUT INTENT: ${contentPart || prompt}
${layoutPart !== contentPart && layoutPart !== prompt ? `LAYOUT DESCRIPTION: ${layoutPart}` : ''}`
      : `Create professional presentation slide(s) about: "${prompt}"`;

    // Pass router's layout hint as a soft suggestion (not a rigid spec)
    const routerLayoutGuidance = contextInfo?.layoutGuidance || null;
    const layoutHint = routerLayoutGuidance
      ? `\nLAYOUT HINT (from narrative planner): "${routerLayoutGuidance}" — consider this, but choose whatever layout best serves the content. You are not bound to it.`
      : '';

    userPrompt = `${freestyleIntro}
TODAY: ${currentDateString()}
${currentSlideContext}${deckOverview}${existingDeckContext}${layoutHint}
${TITLE_HEADER_RULES}

TITLE / SUBTITLE PASSTHROUGH:
If the content request starts with "TITLE:" and/or "SUBTITLE:" markers, use those EXACTLY as the slide's h1.title and h2.subtitle respectively.
You may lightly adjust word count to fit the 8-12 word format but MUST preserve the specific data, claims, and terminology.

REQUIREMENTS:
${countInstruction}
${coverInstruction}
- Footer branding: use "${settings.footerBranding || 'Strategy&'}" in the footer <span> (left side)
${contextInfo?.currentSlide ? '- If the user is referencing "this slide" or "this page", they mean the CURRENT SLIDE REFERENCE shown above' : ''}
${getWorkLevelInstructions(settings.workLevelSlide, 'slide')}

CONTENT FIDELITY:
- TOPIC PROMPT (e.g., "AI trends") → you generate the content. Be professional, specific, data-rich.
- PRECISE CONTENT (specific bullets, data, phrasing) → you are a LAYOUT ENGINE. Arrange their content as-is. Do NOT reword.
- If the user provides questions, they MUST remain as questions.
- If the user provides specific data/numbers/names, reproduce them EXACTLY.
- SOURCE/CITATION: Sources go ONLY in <footer>, never inside <div class="frame">.

Return the slide(s) as raw HTML, separated by a blank line between each slide.`;

  } else {
    // === TEMPLATE / NON-FREESTYLE USER PROMPT ===
    const promptIntro = hasLayoutInstructions
      ? `Create a slide about the following content, using a layout that matches the user's intent:

CONTENT AND LAYOUT INTENT: ${contentPart || prompt}
${layoutPart !== contentPart && layoutPart !== prompt ? `LAYOUT DESCRIPTION: ${layoutPart}` : ''}

Follow the DESIGN PROCESS from the guide: count items, pick layout, check budget, fill. If content exceeds the layout budget, split into multiple slides.`
      : `Generate professional presentation slide(s) about: "${prompt}"`;

    userPrompt = `${promptIntro}
TODAY: ${currentDateString()}
${currentSlideContext}${deckOverview}${existingDeckContext}
${templateInstruction}
${TITLE_HEADER_RULES}

TITLE / SUBTITLE PASSTHROUGH:
If the content request starts with "TITLE:" and/or "SUBTITLE:" markers, use those EXACTLY as the slide's h1.title and h2.subtitle respectively.
You may lightly adjust word count to fit the 8-12 word format but MUST preserve the specific data, claims, and terminology.
These markers come from the narrative router which sees the full story arc — respect them.

REQUIREMENTS:
${countInstruction}
${layoutInstruction}
${coverInstruction}
- When the user provides only a topic or rough prompt, generate realistic professional content to fill the slide.
- When the user provides specific content (data, phrasing, bullet points, questions), USE THEIR CONTENT as-is — do NOT generate replacement content.
- Make the layout informative and visually balanced
- Maintain narrative flow with any existing slides
${getWorkLevelInstructions(settings.workLevelSlide, 'slide')}
- SOURCE/CITATION: Any source attribution (e.g., "Source: McKinsey 2024") goes ONLY in the <footer> — NEVER inside <div class="frame"> content area.
- Footer branding: use "${settings.footerBranding || 'Strategy&'}" in the footer <span> (left side)
${contextInfo?.currentSlide ? '- If the user is referencing "this slide" or "this page", they mean the CURRENT SLIDE REFERENCE shown above' : ''}

CONTENT FIDELITY — PRESERVE THE USER'S CONTENT:
The user's instruction is the PRIMARY input. Distinguish between two modes:
A) TOPIC PROMPT (e.g., "AI trends", "Q3 performance") — you generate the content. Be professional and detailed.
B) PRECISE CONTENT (e.g., specific bullets, data points, exact phrasing, questions) — you are a LAYOUT ENGINE. Arrange their content into the slide structure. Do NOT reword, summarize, or "professionalize" it.

How to tell which mode: if the instruction contains specific sentences, bullet points, data with numbers, named entities, or questions — it's PRECISE. Treat their text as copy-ready.

Rules for PRECISE content:
- NEVER change the meaning, tone, or form of the user's content to fit the layout.
- If the user provides QUESTIONS, they MUST remain as questions — do NOT rephrase them as statements or labels.
- If the user provides SPECIFIC PHRASING, keep it verbatim. Do not paraphrase, shorten, or "improve" their words.
- If the user provides specific data, numbers, percentages, or names, reproduce them EXACTLY.
- You may lightly restructure for the layout (e.g., split a long sentence across card title + description) but the WORDS must stay the same.
- ADAPT THE LAYOUT TO THE CONTENT, not the content to the layout. Content is the deliverable — the layout serves it.
- Only trim content if it physically overflows the 353px frame — and even then, cut the least important parts, don't reword what remains.

Even for PRECISE content, always use CSS components (card-row, split-layout, content-list, grid-2x2, etc.) rather than raw paragraphs or unstyled lists. Structure their content into the layout — each point becomes a card, a list item, a grid cell, etc.

Return the slide(s) as raw HTML, separated by a blank line between each slide.`;
  }

  try {
    let content;

    content = await callGeminiAPI(settings, activeSystemPrompt, userPrompt);

    // Safety check: if AI returned JSON instead of HTML, retry once with clear instruction
    const isJsonResponse = content.trim().startsWith('{') && content.trim().endsWith('}');
    if (isJsonResponse) {
      debugLog(LogLevel.WARN, 'generateSlides', 'AI returned JSON instead of HTML, retrying', { preview: content.slice(0, 200) });

      const retryPrompt = `${userPrompt}

IMPORTANT: You MUST output valid HTML slides. Do NOT return JSON. Generate the slides now using your best judgment. If you don't have specific data, create realistic consulting content.`;

      let retryContent;
      retryContent = await callGeminiAPI(settings, activeSystemPrompt, retryPrompt);
      content = retryContent;
    }

    // Parse the generated HTML into individual slides
    const slides = parseGeneratedSlides(content);

    if (slides.length === 0) {
      throw new Error('No valid slides were generated. The AI may need more specific instructions. Please try again with more details.');
    }

    return slides;
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(
        'Network error: could not reach the API endpoint (ERR_NAME_NOT_RESOLVED or connection refused). ' +
        'Verify the provider URL in Settings is correct and reachable from your network.'
      );
    }
    throw error;
  }
}

// Helper: Extract a complete div element starting from a position, using depth tracking
function extractDivWithDepth(html, startPos) {
  // Find the opening tag end
  const openTagEnd = html.indexOf('>', startPos);
  if (openTagEnd === -1) return null;

  let depth = 1;
  let pos = openTagEnd + 1;
  const len = html.length;

  while (pos < len && depth > 0) {
    // Look for next tag
    const nextOpen = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);

    if (nextClose === -1) break; // No more closing tags

    if (nextOpen !== -1 && nextOpen < nextClose) {
      // Found an opening div before the next close
      depth++;
      pos = html.indexOf('>', nextOpen) + 1;
    } else {
      // Found a closing div
      depth--;
      if (depth === 0) {
        return {
          fullMatch: html.substring(startPos, nextClose + 6),
          content: html.substring(openTagEnd + 1, nextClose),
          endPos: nextClose + 6,
        };
      }
      pos = nextClose + 6;
    }
  }

  return null;
}

// Flatten nested slides - when AI wraps slide in another slide div
function flattenNestedSlides(html) {
  let modified = html;
  let iterations = 0;
  const maxIterations = 3;

  while (iterations < maxIterations) {
    // Check for nested slide pattern: <div class="slide..."><div class="slide...">
    const nestedPattern = /<div\s+class=["']slide[^"']*["'][^>]*>\s*<div\s+class=["']slide[^"']*["']/i;
    const match = modified.match(nestedPattern);

    if (!match) break;

    // Find the outer slide div
    const outerSlideMatch = modified.match(/<div\s+class=["'](slide[^"']*)["'][^>]*>/i);
    if (!outerSlideMatch) break;

    const outerStart = modified.indexOf(outerSlideMatch[0]);
    const outerDiv = extractDivWithDepth(modified, outerStart);

    if (!outerDiv || !outerDiv.content) break;

    // Check if the outer's content starts with another slide div
    const innerSlideMatch = outerDiv.content.match(/^\s*<div\s+class=["'](slide[^"']*)["'][^>]*>/i);

    if (innerSlideMatch) {
      // Found nested slide - extract the inner one
      const innerStart = outerDiv.content.indexOf(innerSlideMatch[0]);
      const innerDiv = extractDivWithDepth(outerDiv.content, innerStart);

      if (innerDiv) {
        // Use the inner slide's class (it likely has more info like master-standard)
        const innerClass = innerSlideMatch[1];
        // Replace outer with inner
        modified = modified.substring(0, outerStart) +
          `<div class="${innerClass}">${innerDiv.content}</div>` +
          modified.substring(outerStart + outerDiv.fullMatch.length);
        iterations++;
        continue;
      }
    }

    break;
  }

  if (iterations > 0) {
    debugLog(LogLevel.INFO, 'flattenNestedSlides', `Flattened ${iterations} level(s) of nested slides`);
  }

  return modified;
}

// Flatten nested frames - when AI wraps content in a frame that's already inside a frame
function flattenNestedFrames(html) {
  let modified = html;
  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    // Find all frame divs using proper pattern
    const framePattern = /<div([^>]*class=["'][^"']*\bframe\b[^"']*["'][^>]*)>/gi;
    let match;
    let foundNested = false;

    // Reset regex
    framePattern.lastIndex = 0;

    while ((match = framePattern.exec(modified)) !== null) {
      const outerStart = match.index;
      const outerAttrs = match[1];

      // Extract the full outer frame with proper depth tracking
      const outerDiv = extractDivWithDepth(modified, outerStart);
      if (!outerDiv) continue;

      const outerContent = outerDiv.content;

      // Check if outer content contains another frame div
      const innerFrameMatch = outerContent.match(/<div([^>]*class=["'][^"']*\bframe\b[^"']*["'][^>]*)>/i);

      if (innerFrameMatch) {
        // Found nested frame - extract it properly
        const innerStart = outerContent.indexOf(innerFrameMatch[0]);
        const innerDiv = extractDivWithDepth(outerContent, innerStart);

        if (innerDiv) {
          // Remove the inner frame wrapper, keep its content
          const newOuterContent = outerContent.substring(0, innerStart) +
            innerDiv.content +
            outerContent.substring(innerStart + innerDiv.fullMatch.length);

          // Replace the outer frame with updated content
          const newOuterDiv = `<div${outerAttrs}>${newOuterContent}</div>`;
          modified = modified.substring(0, outerStart) + newOuterDiv + modified.substring(outerStart + outerDiv.fullMatch.length);

          foundNested = true;
          break;
        }
      }
    }

    if (!foundNested) break;
    iterations++;
  }

  if (iterations > 0) {
    debugLog(LogLevel.INFO, 'flattenNestedFrames', `Flattened ${iterations} level(s) of nested frames`);
  }

  return modified;
}

// Ensure slide HTML has proper structure with .title, .subtitle, .frame classes
function ensureSlideStructure(html) {
  // Skip cover slides - they have their own structure
  if (html.includes('cover-slide') || html.includes('cover-title')) {
    return html;
  }

  // Skip section divider and blank-master slides — they use custom full-bleed layouts
  // without standard title/subtitle/frame structure
  if (html.includes('section-divider-slide') || html.includes('separator-slide') || html.includes('master-blank')) {
    return html;
  }

  // First, flatten any nested slides that AI might have created
  html = flattenNestedSlides(html);

  // Then, flatten any nested frames
  html = flattenNestedFrames(html);

  // Try to extract and restructure the content
  const slideMatch = html.match(/<div\s+class=["']slide[^"']*["'][^>]*>([\s\S]*)<\/div>\s*$/i);
  if (!slideMatch) return html;

  let innerContent = slideMatch[1];
  const slideClass = html.match(/<div\s+class=["']([^"']+)["']/i)?.[1] || 'slide';

  // Check if title is a direct child of slide (proper structure)
  // Proper structure: title/subtitle are siblings of frame, not inside it
  const directTitleMatch = innerContent.match(/^\s*(<h1[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>[^<]*<\/h1>)/i);
  const hasProperTitle = directTitleMatch !== null;

  // Check if there's a frame with content that shouldn't be there (title/subtitle inside frame)
  // Use proper depth tracking instead of greedy/lazy regex
  let frameInnerContent = '';
  const frameOpenTagMatch = innerContent.match(/<div[^>]*class=["'][^"']*\bframe\b[^"']*["'][^>]*>/i);
  if (frameOpenTagMatch) {
    const frameStartPos = innerContent.indexOf(frameOpenTagMatch[0]);
    const extractedFrame = extractDivWithDepth(innerContent, frameStartPos);
    if (extractedFrame) {
      frameInnerContent = extractedFrame.content;
    }
  }
  const titleInsideFrame = frameInnerContent && /class=["'][^"']*\btitle\b[^"']*["']/.test(frameInnerContent);
  const subtitleInsideFrame = frameInnerContent && /class=["'][^"']*\bsubtitle\b[^"']*["']/.test(frameInnerContent);

  // If structure is already proper (title outside frame), return as-is
  if (hasProperTitle && frameOpenTagMatch && !titleInsideFrame) {
    return html;
  }

  // Need to restructure - extract all elements regardless of nesting

  // Extract footer first (from anywhere)
  let footerHtml = '';
  const footerMatch = innerContent.match(/<footer[^>]*>[\s\S]*?<\/footer>/i);
  if (footerMatch) {
    footerHtml = footerMatch[0];
    if (!footerHtml.includes('class=')) {
      footerHtml = footerHtml.replace('<footer', '<footer class="footer"');
    }
    innerContent = innerContent.replace(footerMatch[0], '');
  }

  // Extract h1 for title (from anywhere in content, including inside frame)
  // Match h1 with any content including nested tags
  let titleHtml = '';
  const h1Match = innerContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    // Strip inner HTML tags and get text only
    const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim();
    if (h1Text) {
      titleHtml = `<h1 class="title">${h1Text}</h1>`;
      innerContent = innerContent.replace(h1Match[0], '');
    }
  }

  // Extract h2 for subtitle (from anywhere in content)
  let subtitleHtml = '';
  const h2Match = innerContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2Match) {
    const h2Text = h2Match[1].replace(/<[^>]+>/g, '').trim();
    if (h2Text) {
      subtitleHtml = `<h2 class="subtitle">${h2Text}</h2>`;
      innerContent = innerContent.replace(h2Match[0], '');
    }
  }

  // Clean up remaining content
  let frameContent = innerContent.trim();

  // Check if content already has a frame div
  const hasExistingFrame = /<div[^>]*class=["'][^"']*\bframe\b[^"']*["'][^>]*>/i.test(frameContent);

  if (hasExistingFrame) {
    // Content already has a frame - extract it properly using depth tracking (not greedy regex)
    const frameOpenMatch = frameContent.match(/<div[^>]*class=["'][^"']*\bframe\b[^"']*["'][^>]*>/i);
    if (frameOpenMatch) {
      const frameStartPos = frameContent.indexOf(frameOpenMatch[0]);
      const extractedFrame = extractDivWithDepth(frameContent, frameStartPos);

      if (extractedFrame) {
        // Get content before and after the frame div
        const beforeFrame = frameContent.substring(0, frameStartPos).trim();
        const afterFrame = frameContent.substring(extractedFrame.endPos).trim();

        // Use the existing frame as-is
        frameContent = extractedFrame.fullMatch;

        // If there's content outside the frame, include it inside
        if (beforeFrame || afterFrame) {
          const frameInner = extractedFrame.content.trim();
          frameContent = `<div class="frame">${beforeFrame}${beforeFrame ? ' ' : ''}${frameInner}${afterFrame ? ' ' : ''}${afterFrame}</div>`;
        }
      }
    }
  } else if (frameContent) {
    // No frame exists, wrap content in frame
    // Check if content is a single div - if so, add frame class to it
    const singleDivMatch = frameContent.match(/^<div([^>]*)>([\s\S]*)<\/div>$/i);
    if (singleDivMatch && !singleDivMatch[1].includes('frame')) {
      const existingAttrs = singleDivMatch[1];
      if (existingAttrs.includes('class=')) {
        frameContent = `<div${existingAttrs.replace(/class=["']([^"']*)["']/i, 'class="frame $1"')}>${singleDivMatch[2]}</div>`;
      } else {
        frameContent = `<div class="frame"${existingAttrs}>${singleDivMatch[2]}</div>`;
      }
    } else if (!singleDivMatch) {
      frameContent = `<div class="frame">${frameContent}</div>`;
    }
  }

  // Clean up frameContent - remove empty frame
  if (frameContent.match(/^<div[^>]*class=["'][^"']*frame[^"']*["'][^>]*>\s*<\/div>$/i)) {
    frameContent = '';
  }

  // VALIDATION: If we ended up with no frame content but original HTML had substantial content,
  // return the original HTML to prevent empty slides
  if (!frameContent.trim() && innerContent.length > 200) {
    console.warn('[ensureSlideStructure] Frame content was stripped but original had content. Returning original HTML.');
    return html;
  }

  // Reconstruct the slide with proper structure
  const parts = [titleHtml, subtitleHtml, frameContent, footerHtml].filter(p => p.trim());

  // VALIDATION: Don't create a slide with only title/subtitle and no content
  if (!frameContent.trim() && (titleHtml || subtitleHtml)) {
    // If there's no frame but original had more content, preserve it
    if (innerContent.replace(/<h1[^>]*>[^<]*<\/h1>/gi, '').replace(/<h2[^>]*>[^<]*<\/h2>/gi, '').trim().length > 50) {
      console.warn('[ensureSlideStructure] Would create empty slide body. Returning original HTML.');
      return html;
    }
  }

  // Build final HTML
  let finalHtml = `<div class="${slideClass}">
  ${parts.join('\n  ')}
</div>`.replace(/\n\s*\n/g, '\n');

  // Final safety check - flatten any nested frames that might have slipped through
  finalHtml = flattenNestedFrames(finalHtml);

  return finalHtml;
}

// Extract a single slide from AI response when we expect only one slide
// If AI returns multiple slides (e.g., both original and transformed), pick the last one
function extractSingleSlide(content) {
  if (!content || typeof content !== 'string') return content || '';
  // Clean up code blocks and format markers
  let cleanContent = content
    .replace(/```html\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/\[Slide\s*\d+\s*HTML\]/gi, '') // Strip "[Slide N HTML]" markers AI sometimes outputs
    .trim();

  // Count slide divs - use a simple approach to find all slide opening tags
  const slideOpenings = cleanContent.match(/<div\s+class=["']slide[^"']*["']/gi) || [];

  if (slideOpenings.length <= 1) {
    // Only one or zero slides - return as is
    return cleanContent;
  }

  // Multiple slides found - extract the last one (most likely the transformed version)
  debugLog(LogLevel.WARN, 'extractSingleSlide', `AI returned ${slideOpenings.length} slides when 1 expected, extracting last one`);

  // Find all slide blocks and take the last one
  const slideRegex = /<div\s+class=["']slide[^"']*["'][^>]*>[\s\S]*?<\/div>\s*(?=<div\s+class=["']slide|$)/gi;
  const matches = cleanContent.match(slideRegex) || [];

  if (matches.length > 0) {
    // Return the last slide (most likely the transformed/filled one)
    return matches[matches.length - 1].trim();
  }

  // Fallback: try to extract using a simpler pattern for the last slide div
  // Find the position of the last <div class="slide...
  let lastSlideStart = -1;
  for (let i = cleanContent.length - 1; i >= 0; i--) {
    const remaining = cleanContent.substring(i);
    if (remaining.match(/^<div\s+class=["']slide/i)) {
      lastSlideStart = i;
      break;
    }
  }

  if (lastSlideStart > 0) {
    return cleanContent.substring(lastSlideStart).trim();
  }

  // Couldn't parse properly, return original
  return cleanContent;
}

function parseGeneratedSlides(content) {
  // Clean up the content
  let cleanContent = content
    .replace(/```html\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // SAFETY CHECK: Reject JSON responses that slipped through (needsMoreContext, errors, etc.)
  if (cleanContent.startsWith('{') && cleanContent.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleanContent);
      if (parsed.needsMoreContext || parsed.error || parsed.contextType) {
        console.error('[parseGeneratedSlides] Rejecting JSON response:', cleanContent.substring(0, 200));
        return []; // Return empty - will trigger "No valid slides" error
      }
    } catch {
      // Not valid JSON, continue processing
    }
  }

  // Split by slide divs
  const slideRegex = /<div\s+class=["']slide[^"']*["'][^>]*>[\s\S]*?<\/div>\s*(?=<div\s+class=["']slide|$)/gi;
  const matches = cleanContent.match(slideRegex) || [];

  if (matches.length === 0) {
    // Try wrapping the whole content as a single slide - but NOT if it looks like JSON
    if (cleanContent.length > 0 && !cleanContent.startsWith('{')) {
      let html = `<div class="slide">\n${cleanContent}\n</div>`;
      html = ensureSlideStructure(html);
      const title = extractTitle(html);
      const type = detectSlideType(html);
      return [
        {
          html,
          title,
          type,
          summary: generateSlideSummary(html, type, title),
        },
      ];
    }
    return [];
  }

  return matches.map((html, index) => {
    let trimmedHtml = html.trim();
    // Ensure proper structure
    trimmedHtml = ensureSlideStructure(trimmedHtml);
    const title = extractTitle(trimmedHtml) || `Slide ${index + 1}`;
    const type = detectSlideType(trimmedHtml);
    return {
      html: trimmedHtml,
      title,
      type,
      summary: generateSlideSummary(trimmedHtml, type, title),
    };
  });
}

/**
 * Extract a meaningful title from slide HTML content
 * Looks for title elements, headers, and prominent text
 * @param {string} html - The slide HTML content
 * @returns {string|null} - Extracted title or null
 */
export function extractTitleFromHTML(html) {
  if (!html) return null;

  // Try to find title in various elements (regex for server-side compatibility)
  const patterns = [
    /<h1[^>]*class=["'][^"']*title[^"']*["'][^>]*>([^<]+)<\/h1>/i,
    /<div[^>]*class=["'][^"']*cover-title[^"']*["'][^>]*>([^<]+)<\/div>/i,
    /<div[^>]*class=["'][^"']*title[^"']*["'][^>]*>([^<]+)<\/div>/i,
    /<h1[^>]*>([^<]+)<\/h1>/i,
    /<h2[^>]*class=["'][^"']*title[^"']*["'][^>]*>([^<]+)<\/h2>/i,
    /<h2[^>]*>([^<]+)<\/h2>/i,
    // Card titles (take first one)
    /<div[^>]*class=["'][^"']*card-title[^"']*["'][^>]*>([^<]+)<\/div>/i,
    // Section headers
    /<div[^>]*class=["'][^"']*section-header[^"']*["'][^>]*>([^<]+)<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const title = match[1].trim();
      if (title.length > 3) { // Ignore very short matches
        return title.substring(0, 80); // Allow slightly longer titles
      }
    }
  }

  // Fallback: try DOM parsing if available
  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const selectors = ['.title', '.cover-title', 'h1', 'h2', '.card-title', '.section-header'];
    for (const sel of selectors) {
      const el = tempDiv.querySelector(sel);
      if (el?.textContent?.trim()?.length > 3) {
        return el.textContent.trim().substring(0, 80);
      }
    }
  }

  return null;
}

// Legacy alias for internal use
function extractTitle(html) {
  return extractTitleFromHTML(html);
}

function detectSlideType(html) {
  if (html.includes('cover-slide') || html.includes('cover-title')) return 'cover';
  if (html.includes('card-row')) return 'three-cards';
  if (html.includes('two-col') || html.includes('kpi-block')) return 'kpi';
  if (html.includes('timeline-container')) return 'timeline';
  if (html.includes('quote-box')) return 'quote';
  if (html.includes('content-list')) return 'bullets';
  if (html.includes('grid-2x2')) return 'grid';
  return 'custom';
}

// Focused prompt for editing slides - flexible template matching with variations
// Exported for transparency in approval dialogs
export const EDIT_SYSTEM_PROMPT = `You are an expert Strategy& consulting slide designer and editor.

=== YOUR PRIMARY GOAL ===
EXECUTE THE USER'S INSTRUCTION. This is your main task.
The template and existing HTML are CONTEXT to help you - not constraints to limit you.

=== INSTRUCTION INTERPRETATION ===
Analyze the user's instruction to determine the MODE:

MODE A — TWEAK (default): Small changes — fix text, adjust spacing, change a color, add a bullet, fix overlap.
→ Preserve the existing layout structure. Follow template discipline strictly.

MODE B — REDESIGN: The user wants a fundamentally different layout — "make this a grid", "change to horizontal bars", "completely redo this", "make it a 3-card layout", "redesign as a timeline", "convert to bullets".
→ You have FULL creative freedom. You may change the entire HTML structure.
→ Use the AVAILABLE CSS CLASSES below for new layouts.
→ PRESERVE ALL CONTENT — every data point, title, subtitle, and text must survive.
→ The content is sacred; the layout is yours to reinvent.

MODE C — CONTENT CHANGE: The user specifies new content — "title should be X", "add a point about Y", "change the subtitle to Z".
→ Apply the content change. Preserve the layout structure.
→ If the user says "title: X" or "subtitle: Y" or "TITLE: X" or "SUBTITLE: X", use those EXACTLY.

${CSS_STYLE_GUIDE}

STYLING RULES:
1. Use CSS classes for styling - NEVER add inline styles
2. NEVER add extra decorative elements (accent bars, overlays, backgrounds)
3. The CSS classes determine appearance - match theme colors above

TEMPLATE DISCIPLINE (for MODE A — TWEAK):
- STRICTLY FOLLOW THE TEMPLATE STRUCTURE - replicate the exact HTML structure, classes, and layout
- DO NOT add, remove, or rearrange structural elements (columns, sections, panels) unless user explicitly requests it
- PRESERVE EXACT WORDING — do NOT rephrase, summarize, or rewrite the user's text when switching templates
- DO NOT invent new CSS classes or HTML structures - use exactly what the template provides
- DO NOT add inline styles, change colors, or add visual elements (shapes, borders, backgrounds) not in template

HEADING QUALITY:
- SECTION TITLES (h3, h4): insight-driven phrases 4-7 words — never generic labels. Write a mini-conclusion the reader can grasp without the body text. GOOD: "Digital up 40% despite headwinds", "Three gaps eroding margins". BAD: "Market Overview", "Key Findings", "Cost Analysis".

AVAILABLE CSS CLASSES (for MODE B — REDESIGN):
Layout containers: card-row, two-col (col-left + col-right), split-layout (split-left + split-right), grid-2x2 (grid-cell ×4), grid-3x2 (grid-3x2-item ×6)
Cards inside card-row: card > card-header-row > (card-icon-circle + card-num) + h3 + p + impact-box. Variants: two-cards, four-cards (+ compact on cards)
Lists (ALWAYS use a class — never bare <ul>):
  - ul.content-list > li — card-like bullets with accent left border (default choice)
  - ul.content-list.compact > li — tighter variant for 5+ items
  - ul.exec-bullet-list > li — premium padded bullets with hover effects
  - ul.insight-list > li — arrow (→) markers for findings
  - ul.check-list > li — green checkmark circles
  - ul.styled-list > li — em-dash markers with divider lines
  - div.key-points > div.key-point > (div.key-point-number + div.key-point-content > h4 + p) — numbered circles
Every <li> MUST use: <strong>Lead phrase</strong> — detail with data
Callouts: div.text-callout, div.quote-box > (p.quote-text + p.quote-author)
KPIs: div.kpi-block > (div.kpi-value + div.kpi-label)
Stats: div.stat-highlight > div.stat-main > (span.stat-dollar + span.stat-number + span.stat-unit) + div.stat-label
Process: div.process-flow > (div.process-step > div.step-number + div.step-content) + div.process-arrow
Timeline: div.timeline-container > div.timeline-row > (div.timeline-marker + div.timeline-content > h4 + p)
Tables: table.comparison-table > thead + tbody
Charts: div.bar-chart-h > div.bar-row > (span.bar-label + div.bar-track > div.bar-fill + span.bar-value)
Auto-layout: div.auto-row, div.auto-col, div.auto-grid.cols-2/cols-3/cols-4
Box types: content-box (.accent), metric-box, section-box (.challenge/.solution/.result), highlight-box

ITEM COUNT FLEXIBILITY — CONTENT DRIVES STRUCTURE:
- The slide's existing content count is SACRED. Never drop items to match a template default.
- If template has 3 cards but content has 5 points: CREATE 5 cards with the same CSS classes.
- If template has 4 columns but content has 2: USE 2 columns, adjust grid CSS.
- Adjust grid-template-columns, card widths, and spacing to accommodate the actual count.
- When expanding beyond template default: lighten text per item (shorter descriptions) to keep it clean.

UNSTRUCTURED TEXT (text dumps):
- If user provides a paragraph or unstructured text, YOU decide the best way to structure it VISUALLY
- NEVER output raw paragraphs or text blocks — always use a structured visual component (cards, bullets, grids, KPIs, etc.)
- Extract key points and organize them to fit the template's layout
- Slight rewording is OK to make content fit cleanly into bullets, cards, or sections
- The goal is to make the content VISUAL and STRUCTURED, not to preserve exact wording of raw text

FRAME FIT — CRITICAL:
- Content MUST fit within the .frame (890×353px). NEVER let content overflow or extend beyond the frame.
- If content is too dense, reduce item count or shorten text — clarity over density.
- For side-by-side layouts (two-col, split-layout, card-row): ensure left and right content have BALANCED heights to prevent wrapping/overlap.
- ALWAYS use pre-styled CSS classes for layout — do NOT create custom float, inline-block, or absolute positioning.

POPULATE/FILL REQUESTS:
- When user says "populate", "fill" → replace placeholder text with real content
- Apply item count flexibility rules above
- Keep ALL other structural elements identical to template

TEMPLATE MATCHING - STRICT REPLICATION:
When a TEMPLATE REFERENCE is provided:
1. Replicate the EXACT HTML structure and CSS classes
2. Keep the SAME layout type (don't change cards to bullets, don't add/remove columns)
3. KEEP the template's item count by default — only change if content has distinct named items that can't be merged
4. If user specifies a different structure, follow their instructions; otherwise, match template exactly

ADAPTATION RULES:
- STRUCTURE is NOT flexible: don't add panels, columns, sections not in template
- ITEM COUNT: strongly prefer template default; only adjust for distinct/named items that can't be consolidated
- MUST keep same layout TYPE (don't change cards to bullets)
- MUST use same CSS classes - the CSS handles all visual styling
- MUST stay within the .frame boundaries

ICON VARIETY (in card-icon-circle only):
- Use different relevant emojis: 🎯 🚀 💡 📊 ⚡ 🔧 📈 ✅ 🔑 💰 🏆 📋 🎨 🔒 🌐
- Vary icon choices based on content meaning

WHAT MUST STAY IDENTICAL:
- All CSS class names (the stylesheet handles styling)
- HTML element hierarchy and nesting
- Frame positioning (.frame is positioned by CSS)

WHAT CAN CHANGE:
- Text content (titles, paragraphs, labels)
- Number of items (add/remove cards, bullets, etc.)
- Icon emojis (in .card-icon-circle)
- Specific values and data points

DESIGN PRINCIPLES:
- Headlines: INSIGHT-DRIVEN, 8-10 words max, NEVER end with a period (e.g., "AI delivers 3x ROI across divisions" not "AI Results.")
- One main message per slide
- VERTICAL LOGIC: Header must match content count exactly. "Three pillars" = exactly 3 items. Count content first, then write the header.

CUSTOM CSS:
- If you need styles not in the provided CSS, add custom CSS
- For custom styles, output them AFTER the HTML in a <style> block
- Custom CSS should use .slide prefix for scoping
- Example: <style>.slide .my-custom-class { color: red; }</style>

OUTPUT FORMAT:
Return the modified HTML first, then optionally add a <style> block for custom CSS.
Example:
<div class="slide">...</div>
<style>.slide .custom { ... }</style>

No explanations or markdown.`;

// Context tiers for smart context selection
const CONTEXT_TIERS = {
  LOCAL: 'local',       // Just the slide itself - for simple formatting/content edits
  NEIGHBOR: 'neighbor', // Slide + prev/next - for flow and transition edits
  DECK: 'deck',         // Full deck overview - for structural and narrative edits
};

// AI-based context strategy analysis
// Uses a quick AI call to determine optimal context tier and strategy
async function analyzeContextStrategy(instruction, slideInfo, settings) {
  const creds = getCredentials(settings);

  // Quick fallback if no API key (use keyword matching)
  if (!creds.apiKey) {
    return { tier: CONTEXT_TIERS.LOCAL, guidance: null };
  }

  const analysisPrompt = `Analyze this slide editing instruction to determine what context is needed.

INSTRUCTION: "${instruction}"

CURRENT SLIDE INFO:
- Position: Slide ${slideInfo.slideNumber || '?'} of ${slideInfo.totalSlides || '?'}
- Title: "${slideInfo.title || 'Untitled'}"
- Type: ${slideInfo.type || 'unknown'}

Respond in JSON only:
{
  "tier": "local" | "neighbor" | "deck",
  "reasoning": "<brief reason>",
  "focusAreas": ["<what to pay attention to>"]
}

TIER DEFINITIONS:
- "local": Only this slide needed (formatting, content edits, styling)
- "neighbor": Need prev/next slides (transitions, flow, avoiding overlap)
- "deck": Need full deck view (restructuring, MECE, narrative, consistency)

Keep reasoning under 20 words.`;

  try {
    let content;

    content = await callGeminiAPI(
      { ...settings, temperature: 0.1, maxTokens: 200 },
      'You analyze editing instructions. Respond only in JSON.',
      analysisPrompt
    );

    // Parse JSON response with repair for common AI response issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = safeJSONParse(content, 'Context Strategy');

    // Validate tier
    const tier = ['local', 'neighbor', 'deck'].includes(analysis.tier)
      ? analysis.tier
      : CONTEXT_TIERS.LOCAL;

    return {
      tier,
      reasoning: analysis.reasoning || null,
      focusAreas: analysis.focusAreas || [],
    };
  } catch (error) {
    console.warn('Context analysis failed, using local tier:', error.message);
    return { tier: CONTEXT_TIERS.LOCAL, guidance: null };
  }
}

// Quick keyword-based fallback (used when AI analysis is skipped)
function quickContextTier(instruction) {
  const lower = instruction.toLowerCase();

  // Deck-level keywords
  const deckKeywords = ['restructure', 'MECE', 'narrative', 'all slides', 'entire deck', 'consistent', 'throughout'];
  if (deckKeywords.some(k => lower.includes(k.toLowerCase()))) {
    return CONTEXT_TIERS.DECK;
  }

  // Neighbor-level keywords
  const neighborKeywords = ['transition', 'previous', 'next', 'overlap', 'flow', 'build on', 'redundant'];
  if (neighborKeywords.some(k => lower.includes(k.toLowerCase()))) {
    return CONTEXT_TIERS.NEIGHBOR;
  }

  return CONTEXT_TIERS.LOCAL;
}

// Function to improve an existing slide with smart context selection
// slideInfo: { html, title, type, templateId, slideNumber, totalSlides }
// deckContext: { previous, next, allSlides } - optional, used based on instruction analysis
// options: { useAIAnalysis: true } - whether to use AI to determine context (default: true)
export async function improveSlide(slideHtmlOrInfo, instruction, settings, deckContext = null, options = {}) {
  // Apply quickEdit role overrides if configured
  const qeRole = settings.roleSettings?.quickEdit || {};
  if (qeRole.model) settings = { ...settings, model: qeRole.model };
  if (qeRole.maxTokens) settings = { ...settings, maxTokens: qeRole.maxTokens };
  if (qeRole.reasoningEffort) settings = { ...settings, reasoningEffort: qeRole.reasoningEffort };
  if (qeRole.temperature !== '' && qeRole.temperature !== undefined) settings = { ...settings, temperature: qeRole.temperature };

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Support both old signature (html string) and new signature (info object)
  const slideInfo = typeof slideHtmlOrInfo === 'string'
    ? { html: slideHtmlOrInfo }
    : slideHtmlOrInfo;

  const { html, title, type, templateId, slideNumber, totalSlides, comments, templateHtml, templateName, customCSS, sharedCSS, minimalContext } = slideInfo;

  // MINIMAL CONTEXT MODE: If minimalContext is provided, use it directly
  // This significantly reduces token usage while keeping agent informed
  let positionContext = '';
  let neighborContext = '';
  let deckOverview = '';
  let contextStrategy = { tier: CONTEXT_TIERS.LOCAL, reasoning: null, focusAreas: [] };

  if (minimalContext) {
    // Use pre-built minimal context (position + lightweight neighbor/deck info)
    positionContext = minimalContext.positionContext ? `\n${minimalContext.positionContext}` : '';
    neighborContext = minimalContext.neighborContext || '';
    if (minimalContext.storylineContext) {
      neighborContext += minimalContext.storylineContext;
    }
    // Include pending instructions for this slide
    if (minimalContext.instructionsContext) {
      neighborContext += minimalContext.instructionsContext;
    }
    // Include deck structure if available (contains summaries of all slides)
    if (minimalContext.deckStructure) {
      deckOverview = minimalContext.deckStructure;
    }
    console.log('[Context] Using MINIMAL context mode - position + summaries');
  } else if (deckContext) {
    // Legacy full context mode (for backwards compatibility)
    const useAIAnalysis = options.useAIAnalysis !== false; // Default true

    if (useAIAnalysis) {
      // Use AI to determine optimal context strategy
      contextStrategy = await analyzeContextStrategy(instruction, slideInfo, settings);
      console.log(`[Context] AI selected tier: ${contextStrategy.tier} - ${contextStrategy.reasoning || 'no reason given'}`);
    } else {
      // Quick keyword-based fallback
      contextStrategy.tier = quickContextTier(instruction);
    }

    // Build position context (always useful)
    if (slideNumber && totalSlides) {
      positionContext = `\nSLIDE POSITION: Slide ${slideNumber} of ${totalSlides}`;
      if (slideNumber === 1) {
        positionContext += ' (First slide)';
      } else if (slideNumber === totalSlides) {
        positionContext += ' (Last slide)';
      }
    }
  } else {
    // No context provided - just use position if available
    if (slideNumber && totalSlides) {
      positionContext = `\nSLIDE POSITION: Slide ${slideNumber} of ${totalSlides}`;
      if (slideNumber === 1) {
        positionContext += ' (First slide)';
      } else if (slideNumber === totalSlides) {
        positionContext += ' (Last slide)';
      }
    }
  }

  const contextTier = contextStrategy.tier;

  // Build metadata context
  let metadataContext = '';
  if (title || type) {
    metadataContext = `\nSLIDE INFO: "${title || 'Untitled'}"`;
    if (type) metadataContext += ` [${type}]`;
  }

  // Build neighbor context if needed (only in legacy mode, skip if minimalContext provided)
  // In minimal mode, neighborContext is already set from minimalContext above
  if (!minimalContext && deckContext && (contextTier === CONTEXT_TIERS.NEIGHBOR || contextTier === CONTEXT_TIERS.DECK)) {
    if (deckContext.previous) {
      neighborContext += `\n\n--- PREVIOUS SLIDE ---\nTitle: "${deckContext.previous.title || 'Untitled'}"`;
      if (deckContext.previous.type) neighborContext += ` [${deckContext.previous.type}]`;
      if (deckContext.previous.summary) neighborContext += `\nSummary: ${deckContext.previous.summary}`;
      // Use extracted content instead of raw HTML
      neighborContext += `\n${extractSlideContentForAI(deckContext.previous.html, { maxLength: 400 })}`;
    }
    if (deckContext.next) {
      neighborContext += `\n\n--- NEXT SLIDE ---\nTitle: "${deckContext.next.title || 'Untitled'}"`;
      if (deckContext.next.type) neighborContext += ` [${deckContext.next.type}]`;
      if (deckContext.next.summary) neighborContext += `\nSummary: ${deckContext.next.summary}`;
      // Use extracted content instead of raw HTML
      neighborContext += `\n${extractSlideContentForAI(deckContext.next.html, { maxLength: 400 })}`;
    }
  }

  // Build deck overview if needed (only in legacy mode, skip if minimalContext provided)
  if (!minimalContext && deckContext && contextTier === CONTEXT_TIERS.DECK && deckContext.allSlides) {
    deckOverview = `\n\n=== DECK STRUCTURE (${deckContext.allSlides.length} slides) ===`;
    deckContext.allSlides.forEach((s, idx) => {
      const marker = (idx + 1 === slideNumber) ? ' ← CURRENT' : '';
      deckOverview += `\n${idx + 1}. "${s.title || 'Untitled'}" [${s.type || 'custom'}]${marker}`;
    });
  }

  // Build AI guidance section if available
  let aiGuidance = '';
  if (contextStrategy.reasoning || (contextStrategy.focusAreas && contextStrategy.focusAreas.length > 0)) {
    aiGuidance = '\n\nAI ANALYSIS OF YOUR REQUEST:';
    if (contextStrategy.reasoning) {
      aiGuidance += `\n- Strategy: ${contextStrategy.reasoning}`;
    }
    if (contextStrategy.focusAreas && contextStrategy.focusAreas.length > 0) {
      aiGuidance += `\n- Focus areas: ${contextStrategy.focusAreas.join(', ')}`;
    }
    aiGuidance += `\n- Context level: ${contextTier.toUpperCase()}`;
  }

  // Build comment context if there are pending comments on this slide
  let commentContext = '';
  if (comments && comments.length > 0) {
    const pendingComments = comments.filter(c => !c.addressed);
    if (pendingComments.length > 0) {
      commentContext = '\n\nPENDING COMMENTS TO ADDRESS:';
      pendingComments.forEach((comment, idx) => {
        commentContext += `\n${idx + 1}. "${comment.text}"`;
      });
      commentContext += '\n\nIMPORTANT: Consider these comments when making your edits. If the user instruction relates to a comment, make sure to address it in your changes.';
    }
  }

  // Build the prompt with appropriate context level
  const contextNote = contextTier !== CONTEXT_TIERS.LOCAL
    ? `\n(Using ${contextTier} context - deck information included below)`
    : '';

  // Extract CSS that applies to this slide's classes
  const relevantCSS = extractRelevantCSS(html);
  let cssContext = '';
  if (relevantCSS || customCSS) {
    cssContext = `

=== CSS STYLES FOR THIS SLIDE (read and understand these) ===
These are the EXACT CSS rules that style this slide. Preserve all class names.
${relevantCSS}
${customCSS ? `\n--- SLIDE-SPECIFIC CUSTOM CSS ---\n${customCSS}\n--- END CUSTOM CSS ---` : ''}
=== END CSS STYLES ===`;
  }

  // Build template reference context (for guidance, not strict matching)
  let templateContext = '';
  if (templateHtml && templateName) {
    templateContext = `

=== TEMPLATE REFERENCE (for styling guidance) ===
Template: "${templateName}" (${templateId || type || 'custom'})
This template provides the base styling. You may adapt its structure if needed to fulfill the user's request.
If the user's instruction requires more/fewer elements than the template, ADD or REMOVE elements accordingly.
Example: If template has 3 cards but user needs 5 points, create 5 cards with the same styling.
=== END TEMPLATE REFERENCE ===`;
  }

  const userPrompt = `=== PRIMARY OBJECTIVE ===
USER INSTRUCTION: ${instruction}

This is your MAIN TASK. Everything else below is context to help you execute this instruction.
The user's request takes priority over preserving existing structure or template constraints.
CRITICAL: The instruction above is a META-COMMAND about how to modify the slide — it is NOT the slide's content topic. The h1/h2 MUST remain about the slide's existing business topic. Do NOT rewrite headers to match the instruction wording (e.g., if instruction is "refine visuals", keep the h1 about the business content, NOT about visual refinement).

=== CURRENT SLIDE (to be modified) ===
${html}
${cssContext}${positionContext}${metadataContext}${contextNote}${neighborContext}${deckOverview}${aiGuidance}${commentContext}${templateContext}

${TITLE_HEADER_RULES}

=== OUTPUT RULES ===
1. EXECUTE THE USER'S INSTRUCTION as your primary goal
2. Preserve CSS class names for consistent styling
3. If content count doesn't match template (e.g., 5 items for 3-card layout), ADAPT the layout
4. Footer branding: use "${settings.footerBranding || 'Strategy&'}" in footer left span
5. Return ONLY the modified HTML`;

  debugLog(LogLevel.INFO, 'improveSlide', `Starting edit: "${instruction.substring(0, 100)}..."`, {
    slideTitle: title,
    slideType: type,
    htmlLength: html?.length,
    hasTemplate: !!templateHtml,
  });

  try {
    let content;

    content = await callGeminiAPI(settings, EDIT_SYSTEM_PROMPT, userPrompt);

    // Check if GPT requested more context (max 1 retry)
    const contextRequest = detectContextRequest(content);
    if (contextRequest) {
      debugLog(LogLevel.INFO, 'improveSlide', `GPT requested more context: ${contextRequest.reason}`, contextRequest);

      // Build the requested context from deck
      const additionalContext = buildRequestedContext(
        contextRequest,
        deckContext?.slides || [],
        deckContext?.storyline || [],
        SLIDE_TEMPLATES
      );

      if (additionalContext) {
        const retryPrompt = `${userPrompt}

=== ADDITIONAL CONTEXT (as requested) ===
${additionalContext}
=== END ADDITIONAL CONTEXT ===

Now please modify the slide as requested.`;

        let retryContent;
        retryContent = await callGeminiAPI(settings, EDIT_SYSTEM_PROMPT, retryPrompt);
        content = retryContent;
      } else {
        // Context not available - retry and tell AI to proceed without it
        debugLog(LogLevel.WARN, 'improveSlide', `Requested context not available: ${contextRequest.reason}`);

        const retryPrompt = `${userPrompt}

NOTE: You requested additional context ("${contextRequest.reason}") but that information is not available in the system. Please proceed with modifying the slide using your best judgment and the information already provided. Do not request more context - modify the slide now.`;

        let retryContent;
        retryContent = await callGeminiAPI(settings, EDIT_SYSTEM_PROMPT, retryPrompt);
        content = retryContent;
      }
    }

    // Extract single slide (AI may return multiple versions - take the last one)
    content = extractSingleSlide(content) || '';

    // Extract customCSS from <style> blocks if present
    let extractedCustomCSS = customCSS || ''; // Start with existing customCSS
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatch) {
      const newCSS = styleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '').trim()).join('\n\n');
      if (newCSS) {
        extractedCustomCSS = extractedCustomCSS
          ? `${extractedCustomCSS}\n\n/* AI-generated styles */\n${newCSS}`
          : newCSS;
      }
      // Remove style blocks from content
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
    }

    // VALIDATION: Check if result is valid HTML
    const hasSlideDiv = content.includes('<div') && content.includes('class=');
    const hasContent = content.length > 100;
    const hasFrame = content.includes('frame') || content.includes('cover');

    debugLog(LogLevel.INFO, 'improveSlide', `AI returned ${content.length} chars`, {
      hasSlideDiv,
      hasContent,
      hasFrame,
      hasCustomCSS: !!extractedCustomCSS,
      preview: content.substring(0, 200),
    });

    // If AI returned empty or invalid content, return original HTML
    if (!hasSlideDiv || !hasContent) {
      debugLog(LogLevel.ERROR, 'improveSlide', 'AI returned empty/invalid HTML - returning original', {
        contentLength: content.length,
        hasSlideDiv,
        returnedContent: content.substring(0, 500),
      });
      return { html, customCSS: extractedCustomCSS }; // Return original HTML instead of empty
    }

    // If AI returned HTML without proper frame/content structure, warn but still return
    if (!hasFrame && html.includes('frame')) {
      debugLog(LogLevel.WARN, 'improveSlide', 'AI response missing frame structure', {
        originalHadFrame: true,
        responsePreview: content.substring(0, 300),
      });
    }

    return { html: content, customCSS: extractedCustomCSS };
  } catch (error) {
    debugLog(LogLevel.ERROR, 'improveSlide', `Error: ${error.message}`, { stack: error.stack });
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Improve slide with template conversion - edit content while changing to a new template
// slidePosition is optional: { slideNumber, totalSlides }
export async function improveSlideWithTemplate(slideHtml, instruction, template, settings, slidePosition = null) {
  // Apply templateSwitcher role overrides if configured
  const tsRole = settings.roleSettings?.templateSwitcher || {};
  if (tsRole.model) settings = { ...settings, model: tsRole.model };
  if (tsRole.maxTokens) settings = { ...settings, maxTokens: tsRole.maxTokens };
  if (tsRole.reasoningEffort) settings = { ...settings, reasoningEffort: tsRole.reasoningEffort };
  if (tsRole.temperature !== '' && tsRole.temperature !== undefined) settings = { ...settings, temperature: tsRole.temperature };

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Build slide position context if provided
  let positionContext = '';
  if (slidePosition && slidePosition.slideNumber && slidePosition.totalSlides) {
    const { slideNumber, totalSlides } = slidePosition;
    positionContext = `\nSLIDE POSITION: This is slide ${slideNumber} of ${totalSlides}`;
    if (slideNumber === 1) {
      positionContext += ' (First slide - typically cover/introduction)';
    } else if (slideNumber === totalSlides) {
      positionContext += ' (Last slide - closing/summary)';
    }
    positionContext += `\nIMPORTANT: Footer page numbers are injected dynamically - do NOT hardcode page numbers in the footer.`;
  }

  const userPrompt = `=== PRIMARY OBJECTIVE ===
USER INSTRUCTION: ${instruction || 'Convert to this template, preserving the key content'}

This is your MAIN TASK. The template below is a GUIDE, not a strict constraint.
${positionContext}

=== CURRENT SLIDE (source content) ===
${slideHtml}

=== TARGET TEMPLATE (styling guide) ===
Template: ${template.title}
Description: ${template.description || 'Professional consulting slide'}

TEMPLATE HTML (use as styling reference):
${template.html}

=== CONTENT FITTING RULES (HIGHEST PRIORITY) ===
1. Identify the MAIN PILLARS / TOP-LEVEL SECTIONS in the source (e.g. 3 strategy areas, 4 departments).
2. PRESERVE the number of main pillars — do NOT merge or drop top-level sections.
3. FIT content to the target template intelligently:
   - If source has MORE items than template slots → group related items into available slots, or add slots if template allows
   - If source has FEWER items than template slots → remove empty slots and adjust grid/layout CSS
4. ADAPT body text to fit the visual space:
   - Condense verbose bullets into concise points when space is tight
   - Expand thin content with sub-bullets or brief elaboration if the target has more room
   - Keep the SAME IDEAS and KEY MESSAGES — rewording for brevity is OK, dropping ideas is NOT
5. The template should look well-filled — not empty, not overflowing. Use your judgment.

=== CRITICAL RULES ===
1. USER INSTRUCTION IS PRIMARY - execute what the user asked for
2. PRESERVE ALL KEY IDEAS — same main sections, same core messages, same data points
   - Rewording for brevity or expansion is allowed when fitting content to the template
   - Dropping or merging top-level items is NOT allowed
3. LEVERAGE THE TARGET TEMPLATE WELL - use its CSS classes, styling patterns, and visual structure. Actually redesign the layout to match the template's intent (cards, timelines, metrics, etc.)
4. Extract meaningful content from current slide (titles, points, metrics) — never lose data
5. Headlines should be business insights (up to 15 words, e.g., "Revenue grew 45% driven by three new market entries" not "Revenue Results")
6. If the USER INSTRUCTION contains "TITLE:" or "SUBTITLE:" markers, use those for the output slide's title/subtitle
7. If footer has page number, use slide ${positionContext ? 'position from above' : 'number'}

Return ONLY the transformed HTML.`;

  try {
    let content;

    content = await callGeminiAPI(settings, EDIT_SYSTEM_PROMPT, userPrompt);

    // Extract single slide (AI may return both original and transformed - take the last one)
    content = extractSingleSlide(content);

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Improve slide with context from neighboring slides
// slideInfo can be: string (html) for backwards compat, or object with full context
export async function improveSlideWithContext(slideHtmlOrInfo, instruction, neighboringSlides, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Support both old signature (html string) and new signature (info object)
  const slideInfo = typeof slideHtmlOrInfo === 'string'
    ? { html: slideHtmlOrInfo }
    : slideHtmlOrInfo;

  const { html, title, type, templateId, slideNumber, totalSlides } = slideInfo;

  // Build position header
  let positionHeader = '';
  if (slideNumber && totalSlides) {
    positionHeader = `\n=== YOU ARE EDITING SLIDE ${slideNumber} OF ${totalSlides} ===`;
    if (slideNumber === 1) {
      positionHeader += '\n(This is the FIRST slide - typically cover/introduction)';
    } else if (slideNumber === totalSlides) {
      positionHeader += '\n(This is the LAST slide - closing/summary)';
    }
  }

  // Build slide metadata
  let metadataStr = '';
  if (title || type || templateId) {
    metadataStr = '\n\nCURRENT SLIDE INFO:';
    if (title) metadataStr += `\n- Title: "${title}"`;
    if (type) metadataStr += `\n- Layout Type: ${type}`;
    if (templateId) metadataStr += `\n- Template: ${templateId}`;
  }

  // Build neighboring slides context (NO raw HTML - use extracted content)
  let contextStr = '';
  if (neighboringSlides.previous) {
    const prevSlide = neighboringSlides.previous;
    contextStr += `\n\n--- PREVIOUS SLIDE (${slideNumber ? slideNumber - 1 : '?'}) ---`;
    contextStr += `\nTitle: "${prevSlide.title || 'Untitled'}"`;
    if (prevSlide.type) contextStr += ` | Type: ${prevSlide.type}`;
    if (prevSlide.summary) {
      contextStr += `\nSummary: ${prevSlide.summary}`;
    }
    contextStr += `\n${extractSlideContentForAI(prevSlide.html, { maxLength: 400 })}`;
  }
  if (neighboringSlides.next) {
    const nextSlide = neighboringSlides.next;
    contextStr += `\n\n--- NEXT SLIDE (${slideNumber ? slideNumber + 1 : '?'}) ---`;
    contextStr += `\nTitle: "${nextSlide.title || 'Untitled'}"`;
    if (nextSlide.type) contextStr += ` | Type: ${nextSlide.type}`;
    if (nextSlide.summary) {
      contextStr += `\nSummary: ${nextSlide.summary}`;
    }
    contextStr += `\n${extractSlideContentForAI(nextSlide.html, { maxLength: 400 })}`;
  }

  // Build full deck overview with clear structure
  let deckOverview = '';
  if (neighboringSlides.allSlides && neighboringSlides.allSlides.length > 0) {
    deckOverview = `\n\n=== FULL DECK STRUCTURE (${neighboringSlides.allSlides.length} slides) ===`;
    neighboringSlides.allSlides.forEach((slide, idx) => {
      const marker = (idx + 1 === slideNumber) ? ' ← YOU ARE HERE' : '';
      const slideType = slide.type ? ` [${slide.type}]` : '';
      deckOverview += `\n${idx + 1}. ${slide.title || 'Untitled'}${slideType}${marker}`;
      if (slide.summary && idx + 1 !== slideNumber) {
        deckOverview += `\n   └─ ${slide.summary.substring(0, 100)}`;
      }
    });
  }

  const userPrompt = `TASK: Edit this slide while considering its position and context in the presentation.
${positionHeader}${metadataStr}

CURRENT SLIDE HTML (this is what you are editing):
${html}
${contextStr}
${deckOverview}

USER INSTRUCTION: ${instruction}

GUIDELINES:
1. Apply the user's instruction to the CURRENT SLIDE only
2. Be aware of what comes before and after - maintain narrative flow
3. Ensure MECE (Mutually Exclusive, Collectively Exhaustive) with related slides
4. Don't repeat content that's covered in neighboring slides
5. Maintain consistent terminology, tone, and visual style with the deck
6. Keep professional consulting tone

Return ONLY the modified HTML for the current slide.`;

  try {
    let content;

    content = await callGeminiAPI(settings, EDIT_SYSTEM_PROMPT, userPrompt);

    // Extract single slide (AI may return multiple versions - take the last one)
    content = extractSingleSlide(content);

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Edit multiple slides at once
export async function improveMultipleSlides(slides, instruction, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const totalSlides = slides.length;

  // Build slides data for the prompt with position context
  const slidesData = slides.map((slide, idx) => {
    const position = idx + 1;
    let positionNote = '';
    if (position === 1) positionNote = ' (FIRST - typically cover/intro)';
    else if (position === totalSlides) positionNote = ' (LAST - typically conclusion)';

    return {
      index: position,
      title: slide.title || 'Untitled',
      type: slide.type || 'custom',
      positionNote,
      html: slide.html.substring(0, 2500), // Slightly more context per slide
    };
  });

  // Build deck overview first
  const deckOverview = `=== DECK STRUCTURE (${totalSlides} slides) ===
${slidesData.map(s => `${s.index}. "${s.title}" [${s.type}]${s.positionNote}`).join('\n')}`;

  const userPrompt = `TASK: Apply the instruction to ALL slides in this deck.

${deckOverview}

=== SLIDES TO EDIT ===
${slidesData.map(s => `
--- SLIDE ${s.index} of ${totalSlides}: "${s.title}" [${s.type}]${s.positionNote} ---
${s.html}
`).join('\n')}

USER INSTRUCTION: ${instruction}

REQUIREMENTS:
1. Apply the instruction consistently across ALL slides
2. Be aware of each slide's position in the deck (first, middle, last)
3. Maintain narrative flow and coherence between slides
4. Keep each slide's layout structure but modify content as instructed
5. Ensure MECE (no overlapping content, no gaps in the story)
6. First slide should feel like an opening, last slide should feel like a closing

Return the modified HTML for ALL slides in this EXACT format:
---SLIDE_1---
[Complete HTML for slide 1]
---SLIDE_2---
[Complete HTML for slide 2]
...continue for all ${totalSlides} slides.`;

  try {
    let content;

    content = await callGeminiAPI(settings, EDIT_SYSTEM_PROMPT, userPrompt);

    // Clean up
    content = content
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse the response to extract individual slides
    const results = [];
    const slidePattern = /---SLIDE_(\d+)---\s*([\s\S]*?)(?=---SLIDE_\d+---|$)/g;
    let match;

    while ((match = slidePattern.exec(content)) !== null) {
      const slideIndex = parseInt(match[1]) - 1;
      const slideHtml = match[2].trim();
      if (slideIndex >= 0 && slideIndex < slides.length && slideHtml) {
        results[slideIndex] = slideHtml;
      }
    }

    // Fill in any missing slides with original content
    for (let i = 0; i < slides.length; i++) {
      if (!results[i]) {
        results[i] = slides[i].html; // Keep original if parsing failed
      }
    }

    return results;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Generate PPTX export code for a single slide
export async function generateSlideExportCode(slideHtml, slideType, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const exportPrompt = `Generate JavaScript code using PptxGenJS to recreate this HTML slide as a PowerPoint slide.

HTML Slide:
${slideHtml}

Slide Type: ${slideType}

Requirements:
1. Use PptxGenJS library syntax
2. Return a function that takes (pptx, slideNum, totalSlides) as parameters
3. The function should add one slide to the pptx object
4. Use these colors: maroon=#8E1E1E, red=#A32020, main=#111111, meta=#4A4F57, zone1=#F7F9FB
5. Slide size is 13.333 x 7.5 inches (standard 16:9)
6. Extract all text content from the HTML and position it appropriately
7. Return ONLY the JavaScript function code, no explanations

Example output format:
function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  slide.addText("Title", { x: 0.5, y: 0.5, fontSize: 28, color: "111111" });
  // ... more slide content
}`;

  try {
    let content;
    const systemPrompt = 'You are a JavaScript code generator specializing in PptxGenJS. Return only valid JavaScript code, no markdown or explanations.';

    content = await callGeminiAPI(settings, systemPrompt, exportPrompt);

    // Clean up
    content = content
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Transform an existing slide to a different template
export async function transformSlideToTemplate(slideHtml, targetTemplateId, settings, customTemplate = null) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Handle freestyle - no transformation needed, just return original
  if (!targetTemplateId || targetTemplateId === 'freestyle' || targetTemplateId === 'custom') {
    return slideHtml;
  }

  // Use custom template if provided, otherwise look up built-in template
  const targetTemplate = customTemplate || SLIDE_TEMPLATES[targetTemplateId];
  if (!targetTemplate) {
    console.warn(`[transformSlideToTemplate] Template "${targetTemplateId}" not found, returning original`);
    return slideHtml;
  }

  const transformPrompt = `Transform this slide's content to a new layout, making smart decisions about how content fits the target structure.

CURRENT SLIDE HTML:
${slideHtml}

TARGET LAYOUT: ${targetTemplate.title}
${targetTemplate.description}

TARGET HTML STRUCTURE:
${targetTemplate.html}

Instructions:
1. Identify the MAIN PILLARS / TOP-LEVEL SECTIONS in the source slide (e.g. 3 cards, 4 columns, 2 comparison blocks)
2. PRESERVE the number of main pillars — do NOT merge or drop top-level sections
3. FIT content to the target template intelligently:
   - If source has MORE items than template slots → group related items into the available slots, or add slots if the template structure allows it
   - If source has FEWER items than template slots → remove empty slots and adjust the grid/layout CSS
4. ADAPT body text to fit:
   - Condense verbose bullets into concise points when space is tight
   - Expand thin content with sub-bullets or brief elaboration if the target has more room
   - Keep the SAME IDEAS and KEY MESSAGES — rewording for brevity is OK, dropping ideas is NOT
5. REPLICATE the target template's CSS classes and styling patterns exactly
6. Maintain the same topic, message, and tone — just change the visual presentation
7. Keep the footer with the same page numbers
8. Return ONLY the transformed HTML, no explanations

GOAL: The target template should look well-filled — not empty, not overflowing. Use your judgment on text density.

Return the transformed slide HTML that uses the EXACT ${targetTemplate.title} layout structure.`;

  try {
    let content;

    content = await callGeminiAPI(settings, EDIT_SYSTEM_PROMPT, transformPrompt);

    // Clean up
    content = content
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Helper to get master-specific instructions for template generation
function getMasterInstructions(master) {
  const instructions = {
    standard: `This master has:
- Title area at top (30px from top)
- Subtitle below title (101px from top)
- Content frame starting at 137px from top, height 353px
- Footer at bottom
Use: <h1 class="title">...</h1>, <h2 class="subtitle">...</h2>, <div class="frame">...</div>, <footer class="footer">...</footer>`,

    blank: `This master is a BLANK CANVAS - NO title and NO subtitle!
- Content frame starts at 35px from top with full height (455px)
- Footer at bottom
- Use the entire slide area for content
DO NOT include any <h1 class="title"> or <h2 class="subtitle"> elements.
Use: <div class="frame">...</div>, <footer class="footer">...</footer>`,

    titleOnly: `This master has only a title - NO subtitle!
- Title area at top (30px from top)
- Content frame starting at 90px from top, height 400px (more vertical space)
- Footer at bottom
DO NOT include <h2 class="subtitle"> element.
Use: <h1 class="title">...</h1>, <div class="frame">...</div>, <footer class="footer">...</footer>`,

    cover: `This master is for COVER/TITLE slides - centered, branded layout:
- No standard title/subtitle structure
- No footer (cover slides don't have page numbers)
- Use centered cover elements
Use cover-specific classes: .cover-slide, .cover-category, .cover-title, .cover-branding, .cover-date
Do NOT include regular .title, .subtitle, or .footer elements.`,

    emptyPage: `This master is a FULL PAGE with NO margins, NO borders, NO frame constraints!
- Content starts at position 0,0 and fills the entire 960x540px slide
- No title, no subtitle, no footer - completely empty canvas
- Use absolute positioning for elements anywhere on the slide
- The entire slide area is available with no padding or margins
DO NOT include any .title, .subtitle, .frame, or .footer elements.
Position all content with absolute positioning directly in the .slide container.`,
  };

  return instructions[master] || instructions.standard;
}

// Generate a new template from a description/prompt
export async function generateTemplate(description, settings, master = 'standard') {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Get master-specific instructions
  const masterInstructions = getMasterInstructions(master);

  // Use the concise component guide for template creation
  // Use custom guide from settings if available, otherwise use default
  const guideToUse = settings.freestyleGuide && settings.freestyleGuide.trim() !== ''
    ? settings.freestyleGuide
    : FREESTYLE_COMPONENT_GUIDE;
  const freestyleSystemPrompt = `You are an expert consulting presentation designer creating reusable slide templates.

${guideToUse}

Return ONLY raw HTML. Use placeholder text like "[Title here]" for content areas.`;

  const templatePrompt = `CRITICAL: You MUST create EXACTLY the layout described. Do NOT substitute with a different layout.

USER REQUEST:
"${description}"

HEIGHT PLANNING (CRITICAL - prevent overflow):
- Usable content area: ~400-420px tall (slide is ~540px total minus title/subtitle/footer)
- PLAN element count to fit: 3 cards (~280px), 4 bullets (~100px), grid 2x2 (~350px)
- NEVER combine multiple heavy components (e.g., cards + grid)
- If many items needed, use COMPACT styles or split across slides

RULES - FOLLOW EXACTLY:
1. If user says "3x3 matrix/grid" → create a 3x3 grid (9 cells in 3 rows × 3 columns)
2. If user says "2x2" → create exactly 4 cells in 2 rows × 2 columns
3. If user says "4 cards" → create exactly 4 cards (use class="compact" for 4+)
4. If user says "timeline with 5 steps" → create exactly 5 timeline items (compact)
5. MATCH THE EXACT STRUCTURE REQUESTED - don't interpret or change it
6. If structure would overflow, use compact variants or smaller text

SLIDE MASTER: ${master.toUpperCase()}
${masterInstructions}

PLACEHOLDER TEXT FORMAT:
- "[Row 1, Col 1 title]"
- "[Cell description]"
- Use numbers: 01, 02, 03... for cell labels

Return ONLY the HTML wrapped in <div class="slide">...</div>. The layout MUST match "${description}" exactly and FIT within the slide.`;

  try {
    let content;

    content = await callGeminiAPI(settings, freestyleSystemPrompt, templatePrompt);

    // Clean up code blocks
    content = content
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // If slide wrapper is missing, try to wrap the content
    if (!content.includes('class="slide"') && !content.includes("class='slide'")) {
      // Check if it has frame content we can wrap
      if (content.includes('class="frame"') || content.includes("class='frame'")) {
        content = `<div class="slide">
  <h1 class="title">[Title]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  ${content}
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`;
      } else {
        // Wrap the entire content in a basic slide structure
        content = `<div class="slide">
  <h1 class="title">[Title]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    ${content}
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`;
      }
    }

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// =============================================================================
// EMBEDDING-BASED TEMPLATE SELECTION (Token-efficient)
// =============================================================================

/**
 * Select template using embeddings + GPT (token-optimized)
 * Flow: Embeddings find top 3 → GPT picks best from those 3
 * Much more efficient than sending all templates to GPT
 */
export async function selectTemplateWithEmbeddings(userPrompt, availableTemplates, settings, options = {}) {
  const { returnDetails = false, minConfidence = 30, useGPTSelection = true } = options;

  debugLog(LogLevel.INFO, 'selectTemplateEmbeddings', `Finding template for: "${userPrompt.substring(0, 50)}..."`);

  try {
    // Step 1: Use embeddings to find top 3 candidates
    const candidates = await searchTemplatesByEmbedding(userPrompt, settings, 3);

    if (!candidates || candidates.length === 0) {
      debugLog(LogLevel.WARN, 'selectTemplateEmbeddings', 'No embedding candidates found');
      // Fall back to bulletPoints as default
      const fallbackTemplate = availableTemplates.find(t => t.id === 'bulletPoints') || availableTemplates[0];
      return returnDetails ? {
        template: fallbackTemplate,
        confidence: 40,
        modifications: [],
        reasoning: 'Fallback - no candidates found',
        method: 'fallback',
      } : fallbackTemplate;
    }

    debugLog(LogLevel.INFO, 'selectTemplateEmbeddings', `Top 3 candidates: ${candidates.map(c => `${c.templateId}(${c.confidence}%)`).join(', ')}`);

    // Step 2: If top match is very confident (>75%), use it directly without GPT
    if (candidates[0].confidence >= 75) {
      const topCandidate = candidates[0];
      const template = availableTemplates.find(t => t.id === topCandidate.templateId);

      if (template) {
        debugLog(LogLevel.INFO, 'selectTemplateEmbeddings', `High confidence direct match: ${topCandidate.templateId}`);
        const detail = {
          template,
          confidence: topCandidate.confidence,
          modifications: [],
          reasoning: `High confidence embedding match: ${topCandidate.qualification?.layoutSummary || topCandidate.templateId}`,
          method: 'embedding-direct',
          alternatives: candidates.slice(1).map(c => ({
            templateId: c.templateId,
            confidence: c.confidence,
          })),
        };
        const randomized = randomizeFamilyVariant({ templateId: topCandidate.templateId });
        if (randomized.variantOf) {
          const swapped = availableTemplates.find(t => t.id === randomized.templateId);
          if (swapped) {
            detail.template = swapped;
            detail.reasoning += ` (variant swap: ${randomized.templateId})`;
          }
        }
        return returnDetails ? detail : detail.template;
      }
    }

    // Step 3: Use GPT to select from top 3 (if enabled and multiple candidates)
    if (useGPTSelection && candidates.length > 1) {
      const selected = await selectBestTemplate(userPrompt, candidates, settings);

      if (selected) {
        const template = availableTemplates.find(t => t.id === selected.templateId);

        if (template) {
          debugLog(LogLevel.INFO, 'selectTemplateEmbeddings', `GPT selected: ${selected.templateId}`);
          const detail = {
            template,
            confidence: selected.confidence,
            modifications: [],
            reasoning: `GPT selected from top 3: ${selected.qualification?.layoutSummary || selected.templateId}`,
            method: 'embedding-gpt',
            alternatives: candidates.filter(c => c.templateId !== selected.templateId).map(c => ({
              templateId: c.templateId,
              confidence: c.confidence,
            })),
          };
          const randomized = randomizeFamilyVariant({ templateId: selected.templateId });
          if (randomized.variantOf) {
            const swapped = availableTemplates.find(t => t.id === randomized.templateId);
            if (swapped) {
              detail.template = swapped;
              detail.reasoning += ` (variant swap: ${randomized.templateId})`;
            }
          }
          return returnDetails ? detail : detail.template;
        }
      }
    }

    // Step 4: Fall back to top embedding match
    const bestCandidate = candidates[0];
    const template = availableTemplates.find(t => t.id === bestCandidate.templateId);

    if (template && bestCandidate.confidence >= minConfidence) {
      const detail = {
        template,
        confidence: bestCandidate.confidence,
        modifications: [],
        reasoning: `Best embedding match: ${bestCandidate.qualification?.layoutSummary || bestCandidate.templateId}`,
        method: 'embedding-fallback',
      };
      const randomized = randomizeFamilyVariant({ templateId: bestCandidate.templateId });
      if (randomized.variantOf) {
        const swapped = availableTemplates.find(t => t.id === randomized.templateId);
        if (swapped) {
          detail.template = swapped;
          detail.reasoning += ` (variant swap: ${randomized.templateId})`;
        }
      }
      return returnDetails ? detail : detail.template;
    }

    // No good match found
    return returnDetails ? {
      template: null,
      confidence: 0,
      modifications: [],
      reasoning: 'No template matched above minimum confidence',
      method: 'none',
      closestTemplate: candidates[0] ? availableTemplates.find(t => t.id === candidates[0].templateId) : null,
      closestTemplateConfidence: candidates[0]?.confidence || 0,
    } : null;

  } catch (error) {
    debugLog(LogLevel.ERROR, 'selectTemplateEmbeddings', `Error: ${error.message}`);

    // Fall back to keyword search (uses static import)
    const keywordMatches = searchTemplatesByKeywords(userPrompt, 3);

    if (keywordMatches.length > 0) {
      const best = keywordMatches[0];
      const template = availableTemplates.find(t => t.id === best.templateId);

      if (template) {
        const detail = {
          template,
          confidence: best.confidence,
          modifications: [],
          reasoning: `Keyword fallback: ${best.templateId}`,
          method: 'keyword-fallback',
        };
        const randomized = randomizeFamilyVariant({ templateId: best.templateId });
        if (randomized.variantOf) {
          const swapped = availableTemplates.find(t => t.id === randomized.templateId);
          if (swapped) {
            detail.template = swapped;
            detail.reasoning += ` (variant swap: ${randomized.templateId})`;
          }
        }
        return returnDetails ? detail : detail.template;
      }
    }

    return returnDetails ? { template: null, confidence: 0, modifications: [], reasoning: error.message } : null;
  }
}

// AI-based template selection with confidence scoring and modification detection
// Returns: { template, confidence, modifications, reasoning, isVariant }
// NOTE: For token efficiency, prefer selectTemplateWithEmbeddings() instead
export async function selectTemplateWithAI(userPrompt, availableTemplates, settings, options = {}) {
  const { returnDetails = false, minConfidence = 30 } = options;

  // Try embedding-based selection first (more token-efficient)
  try {
    const embeddingResult = await selectTemplateWithEmbeddings(userPrompt, availableTemplates, settings, { returnDetails: true, minConfidence });

    if (embeddingResult?.template && embeddingResult.confidence >= minConfidence) {
      debugLog(LogLevel.INFO, 'selectTemplateWithAI', `Using embedding result: ${embeddingResult.template.id} (${embeddingResult.confidence}%)`);
      return returnDetails ? embeddingResult : embeddingResult.template;
    }
  } catch (err) {
    debugLog(LogLevel.WARN, 'selectTemplateWithAI', `Embedding selection failed: ${err.message}, falling back to full LLM`);
  }

  // Fall back to full LLM selection if embeddings didn't work well
  // Use fast model for template selection
  const fastSettings = getFastModelSettings(settings);
  const creds = getCredentials(fastSettings);

  if (!creds.apiKey) {
    return returnDetails ? { template: null, confidence: 0, modifications: [], reasoning: 'No API key' } : null;
  }

  // Create detailed template summary for AI evaluation, including item capacity from flex rules
  const templateSummary = availableTemplates.map((t, idx) => {
    const flex = getTemplateFlex(t.id);
    const capacityStr = flex
      ? `\n   Capacity: ${flex.min}-${flex.max} ${flex.element}s (default ${flex.default})${flex.layout === 'grid' && flex.gridBase ? ` [${flex.gridBase[0]}×${flex.gridBase[1]} grid${flex.gridAlts ? ', can adapt to ' + flex.gridAlts.map(a => `${a[0]}×${a[1]}`).join('/') : ''}]` : ''}`
      : '';
    return `${idx + 1}. ID: "${t.id}"
   Title: ${t.title}
   Description: ${t.description || 'Professional slide layout'}
   Category: ${t.category || 'General'}
   Best for: ${getTemplateBestFor(t.id)}${capacityStr}${t.note ? `\n   Requirements: ${t.note.slice(0, 150)}` : ''}`;
  }).join('\n\n');

  // Estimate item count from user prompt for smarter selection
  const { count: estimatedItems, confidence: countConf } = estimateItemCount(userPrompt);
  const itemCountHint = estimatedItems > 0
    ? `\n\nDETECTED ITEM COUNT: ~${estimatedItems} distinct items (${countConf} confidence). Choose templates whose capacity range includes ${estimatedItems}. If the count is ${estimatedItems}, a template with default ${estimatedItems} is ideal.`
    : '';

  const selectionPrompt = `You are an expert slide deck designer. Templates should SERVE the content - never force content into ill-fitting templates.

USER'S REQUEST:
"${userPrompt}"${itemCountHint}

AVAILABLE TEMPLATES:
${templateSummary}

SMART TEMPLATE SELECTION:
Templates should serve the content, NOT force content into templates.

ITEM COUNT IS CRITICAL:
- Count the number of distinct items/points in the user's content
- Choose templates whose Capacity range (min-max) includes the item count
- NEVER choose a template with more default slots than items (e.g., don't use 6-cell grid for 4 items)
- Prefer templates whose default matches the item count exactly

ONLY USE A TEMPLATE IF:
- The content NATURALLY fits the template structure (e.g., 3 distinct points → 3-cards)
- The item count falls within the template's min-max capacity range
- You have ACTUAL data for the template's required fields

PREFER FREESTYLE WHEN:
- Content is unique or doesn't match any template pattern
- Content would require inventing placeholder content to fill template slots
- Template requires data you don't have (times, metrics, icons)

GRID ADAPTATION (when using a grid template):
- If item count < template default, specify the adapted grid dimensions in modifications
- Example: 4 items on a 2×3 grid → add modification "adapt grid to 2×2"
- Example: 3 items on a 3×2 grid → add modification "adapt grid to 3×1"
- NEVER leave grid cells empty — always adapt the grid to match item count

QUALITY over template-matching: A clean freestyle slide with real content beats a template padded with filler.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "selectedTemplateId": "templateId or null if freestyle",
  "confidence": 85,
  "isVariant": false,
  "modifications": ["drop time column", "use only 2 cards"],
  "reasoning": "Content has exactly 3 distinct pillars that map naturally to 3-cards template",
  "layoutGuidance": null,
  "closestTemplateId": "bestMatchingTemplateId",
  "closestTemplateConfidence": 75,
  "closestTemplateReasoning": "Brief reason this template is the closest match"
}

IMPORTANT: If content doesn't naturally fit ANY template, choose freestyle (selectedTemplateId: null). A well-designed freestyle slide is better than a forced template fit.
When choosing freestyle, you MUST also set "layoutGuidance" to a descriptive creative brief for the designer.
Be specific — write like a manager: "left side: big stat, right side: 3 bullet points" or "2x2 grid with icons, each cell has bold title and one line".
You can use a known pattern name (2x2, 3-cards, bullets, split, kpi-row, timeline, etc.) OR write a custom description. The more prescriptive, the better.`;

  try {
    let response;

    response = await callGeminiAPI(fastSettings, 'You are a template selection expert. Always respond with valid JSON.', selectionPrompt);

    // Parse JSON response with repair for common AI response issues
    let parsed;
    try {
      // Clean response - remove markdown code blocks if present
      const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = safeJSONParse(cleanedResponse, 'Template Selection');
    } catch (parseError) {
      // Fallback: try to extract template ID from response
      const idMatch = response.match(/"selectedTemplateId"\s*:\s*"([^"]+)"/);
      if (idMatch) {
        parsed = { selectedTemplateId: idMatch[1], confidence: 50, modifications: [] };
      } else {
        console.warn('Failed to parse template selection response:', response);
        return returnDetails ? { template: null, confidence: 0, modifications: [], reasoning: 'Parse error' } : null;
      }
    }

    const {
      selectedTemplateId,
      confidence = 50,
      isVariant = false,
      modifications = [],
      reasoning = '',
      layoutGuidance: parsedLayoutGuidance = null,
      closestTemplateId,
      closestTemplateConfidence = 0,
      closestTemplateReasoning = '',
    } = parsed;

    // Find closest template (always provided, even when freestyle selected)
    const closestTemplate = closestTemplateId
      ? availableTemplates.find(t =>
          t.id.toLowerCase() === closestTemplateId.toLowerCase() ||
          t.id.toLowerCase().includes(closestTemplateId.toLowerCase())
        )
      : null;

    // Log for debugging
    debugLog(LogLevel.INFO, 'selectTemplate', `Selected: ${selectedTemplateId} (${confidence}%)`, {
      isVariant,
      modifications,
      reasoning,
      layoutGuidance: parsedLayoutGuidance,
      closest: closestTemplateId ? `${closestTemplateId} (${closestTemplateConfidence}%)` : 'none',
    });

    // Check if freestyle was selected (no template or explicit freestyle)
    const isFreestyle = !selectedTemplateId || selectedTemplateId === 'null' || selectedTemplateId === 'freestyle';

    if (isFreestyle) {
      // Return with closest template info for user choice
      if (returnDetails) {
        return {
          template: null,
          confidence: 0,
          modifications: [],
          reasoning: reasoning || 'Freestyle selected',
          isVariant: false,
          isFreestyle: true,
          layoutGuidance: parsedLayoutGuidance,
          closestTemplate,
          closestTemplateConfidence,
          closestTemplateReasoning,
        };
      }
      return null;
    }

    // Find the matching template
    const matchedTemplate = availableTemplates.find(t =>
      t.id.toLowerCase() === selectedTemplateId.toLowerCase() ||
      t.id.toLowerCase().includes(selectedTemplateId.toLowerCase()) ||
      selectedTemplateId.toLowerCase().includes(t.id.toLowerCase())
    );

    if (!matchedTemplate) {
      // Fallback to closest template if main selection not found
      if (closestTemplate && closestTemplateConfidence >= minConfidence) {
        if (returnDetails) {
          return {
            template: closestTemplate,
            confidence: closestTemplateConfidence,
            modifications,
            reasoning: closestTemplateReasoning || 'Fallback to closest match',
            isVariant,
            closestTemplate,
            closestTemplateConfidence,
            closestTemplateReasoning,
          };
        }
        return closestTemplate;
      }
      return returnDetails
        ? { template: null, confidence: 0, modifications: [], reasoning: 'Template not found', closestTemplate, closestTemplateConfidence, closestTemplateReasoning }
        : null;
    }

    // Randomize variant for variety (same logic as embedding path)
    const randomized = randomizeFamilyVariant({ templateId: matchedTemplate.id });
    const finalTemplate = randomized.variantOf
      ? (availableTemplates.find(t => t.id === randomized.templateId) || matchedTemplate)
      : matchedTemplate;
    const variantNote = randomized.variantOf ? ` (variant swap: ${randomized.templateId})` : '';

    // Return with or without details - always include closest for transparency
    if (returnDetails) {
      return {
        template: finalTemplate,
        confidence,
        modifications,
        reasoning: reasoning + variantNote,
        isVariant,
        closestTemplate: closestTemplate || matchedTemplate,
        closestTemplateConfidence: closestTemplateConfidence || confidence,
        closestTemplateReasoning: closestTemplateReasoning || reasoning,
      };
    }

    // For backwards compatibility, just return the template
    // But attach modifications as a property if present
    if (modifications.length > 0) {
      finalTemplate._modifications = modifications;
      finalTemplate._isVariant = isVariant;
    }

    return finalTemplate;
  } catch (error) {
    console.warn('AI template selection failed:', error);
    debugLog(LogLevel.ERROR, 'selectTemplate', `Error: ${error.message}`);
    return returnDetails
      ? { template: null, confidence: 0, modifications: [], reasoning: error.message }
      : null;
  }
}

// Helper: Get best-use description for each template type
function getTemplateBestFor(templateId) {
  const bestFor = {
    'cover': 'Title slides, presentation openers, section dividers',
    'threeCards': 'Three key points, features, pillars, options to compare',
    'fourCards': 'Four items, quadrants, categories, features',
    'twoColumn': 'Side-by-side comparison, text with image, split content',
    'bulletPoints': 'Lists, multiple points, takeaways, key items',
    'kpiMetrics': 'Key numbers, statistics, metrics, performance data',
    'prosAndCons': 'Advantages/disadvantages, compare two sides, trade-offs',
    'beforeAfter': 'Transformations, improvements, state changes',
    'roadmapTimeline': 'Project phases, timelines, step-by-step processes',
    'milestoneTracker': 'Progress tracking, achievements, key dates',
    'problemSolution': 'Challenge and resolution, pain points and fixes',
    'quote': 'Testimonials, key quotes, highlighted statements',
    'teamProfiles': 'Team introductions, speaker bios, profiles',
    'pricingTable': 'Pricing tiers, plan comparison, package options',
    'dataChart': 'Charts, graphs, data visualization placeholders',
    'imageGallery': 'Multiple images, portfolio, visual showcase',
    'pyramid': 'Hierarchical concepts, priorities, layered ideas',
    'process': 'Workflows, step-by-step guides, procedures',
    'swot': 'SWOT analysis, 4-quadrant analysis',
    'executive-summary': 'High-level overview, summary for executives',
  };
  return bestFor[templateId] || 'General purpose professional slide';
}

// Plan templates for multiple slides - AI decides which template fits each slide
export async function planSlidesWithTemplates(userPrompt, slideCount, availableTemplates, settings) {
  // Use fast model for planning - this should be quick!
  const fastSettings = getFastModelSettings(settings);
  const creds = getCredentials(fastSettings);

  if (!creds.apiKey) {
    return null; // Fall back to single template approach
  }

  // Create a MINIMAL summary of available templates - just ID and best use case
  const templateSummary = availableTemplates.slice(0, 15).map(t =>
    `${t.id}: ${t.title}`
  ).join('\n');

  const planningPrompt = `Plan ${slideCount} slides for: "${userPrompt}"

TEMPLATES:
${templateSummary}

For each slide, pick best template. Use "freestyle" if none fit.

RESPOND AS JSON ARRAY ONLY:
[{"slideNumber":1,"templateId":"cover","contentDescription":"Main title"},{"slideNumber":2,"templateId":"threeCards","contentDescription":"Key points"}]`;

  try {
    let response;

    response = await callGeminiAPI(fastSettings, 'Respond ONLY with JSON array.', planningPrompt);

    // Clean and parse the JSON response with repair for common AI response issues
    let cleanedResponse = response.trim();
    // Remove markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const plan = safeJSONParse(cleanedResponse, 'Plan Slides');

    // Validate the plan structure
    if (!Array.isArray(plan) || plan.length === 0) {
      return null;
    }

    // Map template IDs to actual templates and validate
    return plan.map((item, index) => {
      const templateId = item.templateId?.toLowerCase()?.replace(/['"]/g, '') || 'freestyle';

      // Find matching template
      let matchedTemplate = null;
      if (templateId !== 'freestyle') {
        matchedTemplate = availableTemplates.find(t =>
          t.id.toLowerCase() === templateId ||
          t.id.toLowerCase().includes(templateId) ||
          templateId.includes(t.id.toLowerCase())
        );
      }

      return {
        slideNumber: index + 1,
        templateId: matchedTemplate?.id || null,
        template: matchedTemplate,
        contentDescription: item.contentDescription || userPrompt,
      };
    });
  } catch (error) {
    console.warn('AI slide planning failed:', error);
    return null;
  }
}

// ─── Data-aware template re-evaluation ───────────────────────────────────────
// Analyzes the instruction content and validates whether the router's template
// choice actually fits the data shape.  Returns the original templateId when the
// match is fine, or a better-fitting templateId when there's a clear mismatch.
// This is a fast, local heuristic — no API call needed.
export function reEvaluateTemplateForData(templateId, instruction) {
  if (!templateId || !instruction) return templateId;

  const text = instruction.toLowerCase();

  // Only re-evaluate chart/data templates — leave structural templates alone
  const dataTemplates = new Set([
    'barChartExhibit', 'waterfallChart', 'graphInsights',
    'dualCharts', 'peerBenchmark', 'indexBenchmark', 'percentileBenchmark',
    'competitiveBenchmark', 'gapAnalysis', 'kpiMetrics',
  ]);
  if (!dataTemplates.has(templateId)) return templateId;

  // ── Heuristic signals ────────────────────────────────────────────────────

  // Count distinct entity-like names (Company X, [Name]:, capitalized proper nouns before numbers)
  // Simple proxy: count occurrences of patterns like "Company A 12%", "Apple: $18B", or list-style "• Google"
  const entityPatterns = text.match(
    /(?:^|\n|[•\-–])\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*[:=]?\s*[\d$€£¥%]/gm
  );
  const estimatedEntities = entityPatterns ? new Set(
    entityPatterns.map(m => m.replace(/^[\s•\-–]+/, '').split(/[\s:=]/)[0].toLowerCase())
  ).size : 0;

  // Detect time references
  const yearPattern = /\b20[0-9]{2}\b/g;
  const yearMatches = text.match(yearPattern);
  const uniqueYears = yearMatches ? new Set(yearMatches).size : 0;
  const hasQuarters = /\bq[1-4]\b/i.test(text);
  const hasTimePeriods = uniqueYears >= 2 || hasQuarters;

  // Detect comparison keywords
  const comparisonKeywords = /\b(vs\.?|versus|compared?\s+to|benchmark|peer|competitor|ranking|rank|top\s+\d|relative\s+to)\b/i;
  const isComparison = comparisonKeywords.test(text);

  // Detect multiple metrics per entity (table-like data)
  const multiMetric = /\b(revenue|margin|growth|return|roe|roic|ebitda|eps|nps|market\s+share|debt)\b/gi;
  const metricMatches = text.match(multiMetric);
  const uniqueMetrics = metricMatches ? new Set(metricMatches.map(m => m.toLowerCase())).size : 0;

  // ── Mismatch detection ───────────────────────────────────────────────────

  // MISMATCH 1: indexBenchmark chosen but 3+ entities (indexBenchmark is for 2 entities over time)
  if (templateId === 'indexBenchmark' && estimatedEntities >= 3) {
    console.log(`[reEvaluateTemplate] Overriding ${templateId} → peerBenchmark (${estimatedEntities} entities, indexBenchmark supports 2)`);
    return 'peerBenchmark';
  }

  // MISMATCH 3: peerBenchmark chosen but only 1 entity with time series data → use indexBenchmark
  if (templateId === 'peerBenchmark' && estimatedEntities <= 1 && hasTimePeriods) {
    console.log(`[reEvaluateTemplate] Overriding ${templateId} → indexBenchmark (1 entity over time)`);
    return 'indexBenchmark';
  }

  // MISMATCH 4: barChartExhibit chosen but data has multiple metrics per entity (table layout better)
  if (templateId === 'barChartExhibit' && estimatedEntities >= 3 && uniqueMetrics >= 3) {
    console.log(`[reEvaluateTemplate] Overriding ${templateId} → peerBenchmark (${estimatedEntities} entities × ${uniqueMetrics} metrics)`);
    return 'peerBenchmark';
  }

  return templateId;
}

// Fill a template with content using AI - preserves template structure while customizing content
// Now supports modifications: array of changes to apply (e.g., "add icons", "change to 4 columns")
// options.agentMode: true = agent mode, false = chatbot mode (affects role settings and audit log)
export async function fillTemplateWithAI(template, contentDescription, settings, modifications = [], options = {}) {
  const { agentMode = false } = options;
  const startTime = Date.now();

  // Save the default model before role overrides — used as fallback if role model fails
  const defaultModel = settings.model;

  // Apply slideCreator role overrides based on mode
  // Fall back to legacy 'slideCreator' key for backward compatibility
  const roleKey = agentMode ? 'slideCreatorAgent' : 'slideCreatorChatbot';
  const scRole = settings.roleSettings?.[roleKey]
    || settings.roleSettings?.slideCreator
    || {};
  if (scRole.model) settings = { ...settings, model: scRole.model };
  if (scRole.maxTokens) settings = { ...settings, maxTokens: scRole.maxTokens };
  if (scRole.reasoningEffort) settings = { ...settings, reasoningEffort: scRole.reasoningEffort };
  if (scRole.temperature !== '' && scRole.temperature !== undefined) settings = { ...settings, temperature: scRole.temperature };
  // Stash default model for fallback when role model fails
  settings = { ...settings, _defaultModel: defaultModel };

  console.log('[fillTemplateWithAI] Role resolution →', {
    agentMode,
    roleKey,
    roleOverrides: {
      model: scRole.model || '(none)',
      maxTokens: scRole.maxTokens || '(none)',
      reasoningEffort: scRole.reasoningEffort || '(none)',
      temperature: scRole.temperature !== undefined && scRole.temperature !== '' ? scRole.temperature : '(none)',
    },
    effectiveSettings: {
      model: settings.model,
      maxTokens: settings.maxTokens,
      reasoningEffort: settings.reasoningEffort,
      temperature: settings.temperature,
    },
  });

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Check if template has attached modifications from smart selection
  const allModifications = [
    ...(template._modifications || []),
    ...modifications,
  ];

  // Build modification instructions if any
  const modificationSection = allModifications.length > 0
    ? `\n\nTEMPLATE MODIFICATIONS REQUIRED:
The user wants a VARIANT of this template. Apply these modifications while keeping the base structure:
${allModifications.map((m, i) => `${i + 1}. ${m}`).join('\n')}

When applying modifications:
- If asked to change number of items (e.g., "4 cards instead of 3"), duplicate or remove elements as needed
- If asked to add icons/images, add appropriate placeholders (use emoji or descriptive text like [Icon: chart])
- If asked to change layout orientation, reorganize the flex/grid structure
- Keep the same CSS classes and styling approach, just adapt the structure`
    : '';

  // Detect if we have source content (factual mode) vs creative mode
  const hasSourceContent = contentDescription.includes('=== SOURCE CONTENT');
  const modeGuidance = hasSourceContent
    ? `FACTUAL MODE - SOURCE DATA PROVIDED:
The content request includes "=== SOURCE CONTENT ===" section.
- Use ONLY the data from that section to fill the template
- Do NOT invent additional data points, metrics, or text
- Adapt the template structure to fit the actual data (fewer items is OK)
- If source has 3 items and template has 4 slots, use only 3 slots`
    : `CREATIVE MODE - GENERATE CONTENT:
No source data provided - this is a topic/theme request.
- Generate realistic, professional consulting content to fill the template
- Create appropriate data, metrics, insights that would make sense for this topic
- Fill ALL template slots with generated content
- Make the slide useful and complete`;

  // Build flex rules section for the prompt
  const flex = getTemplateFlex(template.id);
  let flexSection;
  if (!flex || flex.layout === 'fixed') {
    flexSection = `2. ITEM COUNT: Keep the template's default item count. Do NOT add or remove structural elements.
3. If content is TOO MUCH — prioritize and trim, do not add extra items.
4. If content is TOO LITTLE — in FACTUAL mode remove unused slots, in CREATIVE mode fill naturally.`;
  } else {
    let lines = [`2. ITEM COUNT FLEX: This template defaults to ${flex.default} ${flex.element}s (allowed range: ${flex.min}-${flex.max}).`,
      `   - PREFER the default count of ${flex.default}. Only deviate if the content clearly has a different number of distinct items that would be awkward to force into ${flex.default}.`,
      `   - Acceptable range: ${flex.min}-${flex.max}. Never go outside this — the visual breaks.`];
    if (flex.layout === 'grid' && flex.gridAlts) {
      lines.push(`   - GRID LAYOUT: Base is ${flex.gridBase[0]}×${flex.gridBase[1]} (${flex.default} cells). Allowed alternatives: ${flex.gridAlts.map(a => `${a[0]}×${a[1]} (${a[0]*a[1]} cells)`).join(', ')}. Do NOT create free-form arrangements.`);
      lines.push(`   - ADAPT GRID TO ITEM COUNT: If the content has fewer items than ${flex.default}, you MUST change the grid dimensions to match. For example, with ${flex.gridAlts[0]?.[0]*flex.gridAlts[0]?.[1] || '?'} items use ${flex.gridAlts[0]?.[0]}×${flex.gridAlts[0]?.[1]}. NEVER leave grid cells empty.`);
    }
    if (flex.scaling === 'shrink-rows') {
      lines.push(`   - CRITICAL FIT RULE: If you ADD rows/items beyond ${flex.default}, you MUST shrink ALL content proportionally so everything stays within the slide boundaries. Reduce font sizes, padding, and spacing. The slide must not overflow.`);
    } else if (flex.scaling === 'lighten-cols') {
      lines.push(`   - CRITICAL FIT RULE: If you ADD columns/items beyond ${flex.default}, you MUST reduce text per item to avoid crowding. Shorter titles, fewer bullets per card, tighter descriptions. Less text per item = more items fit.`);
    }
    lines.push(`3. If content is TOO LITTLE — in FACTUAL mode remove unused slots (down to ${flex.min}), in CREATIVE mode fill naturally.`);
    if (flex.note) lines.push(`   Note: ${flex.note}`);
    flexSection = lines.join('\n');
  }

  const fillPrompt = `You are filling in content for a Strategy& consulting slide template.
TODAY: ${currentDateString()}

TEMPLATE NAME: ${template.title}
TEMPLATE DESCRIPTION: ${template.description || 'Professional consulting slide'}
${template.note ? `\nTEMPLATE FILLING GUIDANCE:\n${template.note}\n` : ''}
${(() => { const g = getTemplateGuidance(template.id); return g ? `\nCONTENT GUIDANCE (recommended density to avoid overflow):\n${g}\n` : ''; })()}
${modeGuidance}

USER'S CONTENT REQUEST:
"${contentDescription}"${modificationSection}

TITLE EXTRACTION: If the content request starts with "TITLE:" and/or "SUBTITLE:" markers, use them DIRECTLY:
- "TITLE: ..." → h1.title (the header). Preserve the specific data, claims, and terminology. Lightly adjust to fit 8-12 words.
- "SUBTITLE: ..." → h2.subtitle (the topic label). Use as-is for the 3-4 word noun phrase.
Also recognize "SLIDE TITLE:" or "KEY MESSAGE:" as title sources.
Do NOT replace a specific insight with a generic label.

TEMPLATE HTML STRUCTURE:
${template.html}

${TITLE_HEADER_RULES}

CONTENT FIDELITY — PRESERVE THE USER'S CONTENT (HIGHEST PRIORITY):
The user's content is the PRIMARY deliverable. The template is a VEHICLE for that content, not the other way around.

First, determine the content mode:
A) TOPIC PROMPT (e.g., "AI trends", "Q3 performance") — generate realistic professional content. Fill the template with invented but plausible data.
B) PRECISE CONTENT (contains specific sentences, bullets, data with numbers, named entities, questions) — you are a LAYOUT ENGINE. Place their content into template slots. Do NOT reword.

Rules for PRECISE content:
- NEVER change the meaning, tone, or form of the user's content to fit the template.
- If the user provides QUESTIONS, they MUST remain as questions — do NOT rephrase as statements. "What drives our growth?" stays as "What drives our growth?", NOT "Key growth drivers".
- If the user provides SPECIFIC PHRASING, keep that phrasing verbatim. Do not paraphrase, shorten, or "professionalize".
- If the user provides specific data points, numbers, or names, reproduce them EXACTLY. Do not round, summarize, or paraphrase.
- You may lightly restructure for the template (e.g., split a sentence across title + body) but the WORDS must stay the same.
- ADAPT THE TEMPLATE TO THE CONTENT, not the content to the template. If the content doesn't naturally fit the template's slot structure, adjust the template (add/remove slots, change grid) — but NEVER distort the content.
- Only trim if content physically overflows — and even then, cut the least important parts, don't reword what remains.

INTELLIGENT CONTENT REPRESENTATION:
Before filling, THINK about how to represent the content smartly:
- COUNT the user's actual distinct items/points. This determines template structure.
- If the user has 4 items and the template defaults to 6 slots: ADAPT the template (remove 2 slots, change grid dimensions). Do NOT leave empty slots or pad with filler.
- If the user has 7 items and the template holds 4: CONSOLIDATE related items into groups that fit. Don't just drop 3 items — merge and restructure intelligently.
- Lead with the MOST IMPORTANT or IMPACTFUL item, not alphabetical or arbitrary order.
- Each card/cell/row should carry equal visual weight — if one item has much more text, trim it or split the others.
- For grid templates: change the grid CSS to match actual item count (e.g., grid-template-columns changes from 3 columns to 2).

RESPECT THE TEMPLATE - CRITICAL:
1. STRICTLY REPLICATE the template's HTML structure and CSS classes - do not improvise
${flexSection}
4. NEVER add structural elements not in the template (panels, columns, sections, icons) unless user explicitly requests
5. ITEM COUNT: match the content's natural item count. Remove unused HTML elements rather than leaving them empty. Adjust grid CSS (grid-template-columns, grid-template-rows) to match.
6. For unstructured text: extract key points, organize to fit the template, then remove excess HTML slots to match
7. Keep the slide CLEAN and PROFESSIONAL - consistency over creativity

EXECUTIVE WRITING STYLE - MANDATORY:
- Write like a senior consultant: INSIGHT-DRIVEN, CONCISE
- Card descriptions: 1-2 short lines max, not paragraphs
- KPI labels: 2-4 words. Values: number + unit only.
- Headers: verbal insight leading with outcome, never starting with a number count. GOOD: "Revenue grew 15% driven by new markets" BAD: "3 key revenue drivers" or "Revenue Overview"
- CLOSING/THANK YOU slides: Do NOT invent names, emails, phone numbers, or contact details. A thank you slide should simply say "Thank You" or a brief closing message — nothing more.
- SOURCE/CITATION: Any source attribution or citation (e.g., "Source: McKinsey 2024") MUST go ONLY in the <footer> element. NEVER place source labels or citations inside the content area (<div class="frame">).
- NEVER write long paragraphs on a slide — break into short key phrases
- LESS IS MORE: Fill the visual SPACE with layout (spacing, alignment) not with more text. The slide should feel light and easy to scan at a glance.

OVERFLOW PREVENTION (CRITICAL):
- The slide has a FIXED frame of 890×353px. Content MUST NOT overflow this boundary.
- If content risks overflow: CUT content first. Remove the weakest point, shorten descriptions, reduce item count. LESS content that fits cleanly is ALWAYS better than cramming.
- Only AFTER trimming content, if still tight, THEN slightly reduce font-size (by 1px max) or tighten padding.
- NEVER pack so much text that the slide feels "wall of text". Slides should feel LIGHT and easy to scan.
- A slide with 3 strong points and breathing room is better than 6 points crammed together.

ABSOLUTE RULES:
- You MUST always output valid HTML - never return JSON or error messages
- DO NOT remove slide wrapper, title, subtitle, or footer structure (EXCEPTION: blank-master templates like sectionDivider do NOT have title/subtitle/frame — reproduce their structure exactly as shown)
- Maintain the template's visual rhythm and spacing
- VERTICAL LOGIC: The header (h1) MUST match content count. If content has 3 cards, header must say "Three..." not "Five...". Count items first, then write header.
- STRUCTURAL DIRECTIVES: If the content request contains [STRUCTURE: ...], you MUST follow it exactly. It overrides flex defaults. E.g., [STRUCTURE: exactly 5 items] means produce exactly 5, even if template default is 3.

Return ONLY the filled HTML, no explanations.`;

  try {
    let content;

    // Primary attempt with the configured model
    console.log('[fillTemplateWithAI] Calling model:', settings.model, 'template:', template.id);
    try {
      content = await callGeminiAPI(settings, DEFAULT_SYSTEM_PROMPT, fillPrompt);
    } catch (primaryErr) {
      // Don't fall back on rate limit — the proxy is overloaded, a different model won't help
      if (primaryErr.isRateLimit) {
        console.warn(`[fillTemplateWithAI] Rate limited — not attempting fallback model`);
        throw primaryErr;
      }
      // If the role model differs from the global default, fall back to the default model
      const fallbackModel = settings._defaultModel;
      const currentModel = settings.model;
      if (fallbackModel && fallbackModel !== currentModel) {
        console.warn(`[fillTemplateWithAI] Model "${currentModel}" failed: ${primaryErr.message.slice(0, 200)}`);
        console.log(`[fillTemplateWithAI] Falling back to default model: ${fallbackModel}`);
        const fallbackSettings = { ...settings, model: fallbackModel };
        try {
          content = await callGeminiAPI(fallbackSettings, DEFAULT_SYSTEM_PROMPT, fillPrompt);
        } catch (fallbackErr) {
          console.error(`[fillTemplateWithAI] Fallback model "${fallbackModel}" also failed:`, fallbackErr.message.slice(0, 200));
          throw primaryErr; // Throw original error — both failed
        }
      } else {
        throw primaryErr; // No fallback available
      }
    }

    // Extract single slide (AI may return both template example and filled - take the last one)
    content = extractSingleSlide(content) || '';

    // If slide wrapper is missing, wrap the content properly
    if (!content.includes('class="slide"') && !content.includes("class='slide'")) {
      // Blank-master templates (section dividers etc.) use custom structure without title/subtitle/frame
      const isBlankMasterTemplate = template && (template.master === 'blank' || (template.html && template.html.includes('master-blank')));
      if (isBlankMasterTemplate) {
        // Preserve the original template's outer wrapper classes
        const outerClassMatch = template.html.match(/class="([^"]+)"/);
        const outerClass = outerClassMatch ? outerClassMatch[1] : 'slide master-blank';
        content = `<div class="${outerClass}">
  ${content}
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`;
      } else {
        // Check if content has frame content
        const hasFrame = content.includes('class="frame"') || content.includes("class='frame'");
        const hasTitle = content.includes('class="title"') || content.includes("class='title'");
        const hasFooter = content.includes('class="footer"') || content.includes("class='footer'");

        let wrappedContent = content;

        // If it's just the frame content, add title/subtitle/footer
        if (hasFrame && !hasTitle) {
          wrappedContent = `<h1 class="title">These findings drive strategic decision-making</h1>
  <h2 class="subtitle">Key Insights</h2>
  ${content}`;
        }

        // If no footer, add one
        if (!hasFooter) {
          wrappedContent += `
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>`;
        }

        // If no frame at all, wrap in frame
        if (!hasFrame) {
          wrappedContent = `<h1 class="title">These findings drive strategic decision-making</h1>
  <h2 class="subtitle">Key Insights</h2>
  <div class="frame">
    ${content}
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>`;
        }

        // Always wrap in slide div
        content = `<div class="slide">
  ${wrappedContent}
</div>`;
      }
    }

    // Final validation - this should now always pass
    if (!content.includes('class="slide"') && !content.includes("class='slide'")) {
      // Last resort: force wrap
      content = `<div class="slide">
  <h1 class="title">This content was generated based on template structure</h1>
  <h2 class="subtitle">Generated Content</h2>
  <div class="frame">
    ${content}
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`;
    }

    // Flatten any nested frames that AI might have created
    content = flattenNestedFrames(content);

    // Audit log for slide creator calls
    const creatorRole = agentMode ? 'slideCreator:agent' : 'slideCreator:chatbot';
    audit(creatorRole, `created: ${template.id || 'freestyle'}`, {
      model: settings.model,
      query: contentDescription.slice(0, 300),
      context: template.title || 'freestyle slide',
      maxTokens: settings.maxTokens || null,
      reasoningEffort: settings.reasoningEffort || null,
      temperature: settings.temperature ?? null,
      duration: Date.now() - startTime,
      inputLen: fillPrompt.length,
      outputLen: content?.length || 0,
      status: 'ok',
    });

    return content;
  } catch (error) {
    // Audit log for failures
    const creatorRole = agentMode ? 'slideCreator:agent' : 'slideCreator:chatbot';
    audit(creatorRole, 'slide creation failed', {
      model: settings.model,
      query: contentDescription.slice(0, 300),
      duration: Date.now() - startTime,
      status: 'error',
      error: error.message,
    });

    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * BULK slide generation - generates multiple slides in ONE API call
 * @param {Array} slideSpecs - Array of { template, instruction, contextSlideIndices, contextSlides }
 * @param {Object} settings - API settings
 * @param {Object} options - { agentMode: boolean } - affects role settings and audit log
 * @returns {Promise<Array>} Array of generated HTML strings
 */
export async function fillTemplatesBulkWithAI(slideSpecs, settings, options = {}) {
  const { agentMode = true } = options; // Bulk is typically agent mode
  const startTime = Date.now();

  // Save the default model before role overrides — used as fallback if role model fails
  const defaultModel = settings.model;

  // Apply slideCreator role overrides based on mode
  // Fall back to legacy 'slideCreator' key for backward compatibility
  const roleKey = agentMode ? 'slideCreatorAgent' : 'slideCreatorChatbot';
  const scRole = settings.roleSettings?.[roleKey]
    || settings.roleSettings?.slideCreator
    || {};
  if (scRole.model) settings = { ...settings, model: scRole.model };
  if (scRole.maxTokens) settings = { ...settings, maxTokens: scRole.maxTokens };
  if (scRole.reasoningEffort) settings = { ...settings, reasoningEffort: scRole.reasoningEffort };
  if (scRole.temperature !== '' && scRole.temperature !== undefined) settings = { ...settings, temperature: scRole.temperature };
  settings = { ...settings, _defaultModel: defaultModel };

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  if (!slideSpecs || slideSpecs.length === 0) {
    return [];
  }

  // OPTIMIZE: Deduplicate context slides - collect all unique ones
  const uniqueContextMap = new Map(); // pageIndex -> { title, html }
  slideSpecs.forEach(spec => {
    if (spec.contextSlides && spec.contextSlideIndices) {
      spec.contextSlideIndices.forEach((idx, i) => {
        if (!uniqueContextMap.has(idx) && spec.contextSlides[i]) {
          uniqueContextMap.set(idx, spec.contextSlides[i]);
        }
      });
    }
  });

  // Build shared reference content section (only once for all slides)
  let sharedContextSection = '';
  if (uniqueContextMap.size > 0) {
    const contextEntries = [...uniqueContextMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, slide]) => `[PAGE ${idx + 1}] "${slide.title || 'Untitled'}":\n${slide.html}`)
      .join('\n\n---\n\n');

    sharedContextSection = `
=== REFERENCE CONTENT (use as source material) ===
${contextEntries}
=== END REFERENCE CONTENT ===

`;
  }

  // Build the bulk prompt with all slides (reference pages by number, not HTML)
  const slidesSection = slideSpecs.map((spec, i) => {
    const template = spec.template;
    const instruction = spec.instruction || 'Fill with appropriate professional content';
    // Only reference pages that actually have content in uniqueContextMap
    const validContextIndices = (spec.contextSlideIndices || []).filter(idx => uniqueContextMap.has(idx));
    const contextRefs = validContextIndices.length > 0
      ? `USE CONTENT FROM: Page ${validContextIndices.map(idx => idx + 1).join(', Page ')}`
      : '';

    // Include content if present (factual mode)
    const contentSection = spec.content
      ? `SOURCE CONTENT (use this data, do NOT invent):\n${spec.content}\n`
      : '';

    return `
=== SLIDE ${i + 1} ===
TEMPLATE: ${template.title}
DESCRIPTION: ${template.description || 'Professional consulting slide'}
${contextRefs ? `${contextRefs}\n` : ''}${contentSection}INSTRUCTION: ${instruction}

TEMPLATE HTML:
${template.html}
=== END SLIDE ${i + 1} ===`;
  }).join('\n\n');

  const bulkPrompt = `You are generating MULTIPLE Strategy& consulting slides in ONE response.
TODAY: ${currentDateString()}

${TITLE_HEADER_RULES}
${sharedContextSection}
SLIDES TO GENERATE (${slideSpecs.length} total):
${slidesSection}

RESPECT EACH TEMPLATE - CRITICAL:
- STRICTLY REPLICATE each template's HTML structure and CSS classes - do not improvise
- ITEM COUNT: strongly prefer template default — only adjust for distinct/named items that can't be consolidated
- NEVER add structural elements not in the template (panels, columns, sections, icons) unless user explicitly requests
- DO NOT add inline styles, change colors, or add visual elements (shapes, borders, backgrounds) not in template
- If content is TOO MUCH: prioritize key items within the template structure
- If content is TOO LITTLE: In factual mode use only what's provided; in creative mode generate to fill
- For unstructured text with no specific phrasing: extract key points, organize to fit template count, slight rewording OK
- Keep slides CLEAN and PROFESSIONAL - consistency over creativity

CONTENT FIDELITY — PRESERVE THE USER'S CONTENT (HIGHEST PRIORITY):
Determine the content mode for EACH slide:
A) TOPIC/CREATIVE — instruction is a short topic or rough prompt → generate professional content.
B) PRECISE — instruction contains specific sentences, data, phrasing, questions → use their exact words. Do NOT reword.

For PRECISE content:
- NEVER change the meaning, tone, or form of the user's content to fit the template.
- If content contains QUESTIONS, keep them as questions — do NOT rephrase as statements or labels.
- If content contains SPECIFIC PHRASING, preserve it verbatim. Do not paraphrase, shorten, or "professionalize".
- Reproduce specific data, numbers, and names EXACTLY as provided.
- You may restructure for the template slots (split across title + body) but the WORDS must stay the same.
- ADAPT THE TEMPLATE TO THE CONTENT, not the content to the template. Content is the deliverable.
- Only trim if content physically overflows — cut the least important parts, don't reword what remains.

CRITICAL INSTRUCTIONS:
1. Generate ALL ${slideSpecs.length} slides in your response - ALWAYS produce HTML
2. Separate each slide with: <!-- SLIDE_SEPARATOR -->
3. Keep the EXACT HTML structure and CSS classes from each template
4. Replace only text content to match each instruction
5. Keep professional consulting tone - data-driven, insight-focused
6. Standard slides MUST have the slide wrapper, title, subtitle, frame, and footer. EXCEPTION: blank-master slides (e.g., sectionDivider with class "master-blank") do NOT have title/subtitle/frame — reproduce their template HTML structure exactly
7. When a slide has "SOURCE CONTENT", use ONLY that data (factual mode)
8. When no source content provided, generate appropriate content (creative mode)
9. NEVER output JSON or error messages - ALWAYS output valid HTML

OUTPUT FORMAT (output ONLY raw HTML, no labels or markers):
<div class="slide ...">...</div>
<!-- SLIDE_SEPARATOR -->
<div class="slide ...">...</div>
<!-- SLIDE_SEPARATOR -->
<div class="slide ...">...</div>

Return ONLY the HTML slides separated by <!-- SLIDE_SEPARATOR -->, no explanations.`;

  try {
    let content;

    // Primary attempt with the configured model (callGeminiAPI handles both Gemini and non-Gemini)
    console.log('[fillTemplatesBulk] Calling model:', settings.model, 'slides:', slideSpecs.length);
    try {
      content = await callGeminiAPI(settings, DEFAULT_SYSTEM_PROMPT, bulkPrompt);
    } catch (primaryErr) {
      // Don't fall back on rate limit — proxy is overloaded, different model won't help
      if (primaryErr.isRateLimit) {
        console.warn(`[fillTemplatesBulk] Rate limited — not attempting fallback model`);
        throw primaryErr;
      }
      // Fall back to default model if role model differs
      const fallbackModel = settings._defaultModel;
      const currentModel = settings.model;
      if (fallbackModel && fallbackModel !== currentModel) {
        console.warn(`[fillTemplatesBulk] Model "${currentModel}" failed: ${primaryErr.message.slice(0, 200)}`);
        console.log(`[fillTemplatesBulk] Falling back to default model: ${fallbackModel}`);
        const fallbackSettings = { ...settings, model: fallbackModel };
        try {
          content = await callGeminiAPI(fallbackSettings, DEFAULT_SYSTEM_PROMPT, bulkPrompt);
        } catch (fallbackErr) {
          console.error(`[fillTemplatesBulk] Fallback model "${fallbackModel}" also failed:`, fallbackErr.message.slice(0, 200));
          throw primaryErr;
        }
      } else {
        throw primaryErr;
      }
    }

    // Split response by separator
    const slides = content.split(/<!--\s*SLIDE_SEPARATOR\s*-->/).map(s => s.trim()).filter(Boolean);

    console.log('[BulkGeneration] Generated', slides.length, 'slides from', slideSpecs.length, 'specs');

    // Process each slide (wrap if needed, flatten nested frames)
    const processedSlides = slides.map((slideHtml, i) => {
      let processed = extractSingleSlide(slideHtml);

      // Wrap if needed
      if (!processed.includes('class="slide"') && !processed.includes("class='slide'")) {
        const hasFrame = processed.includes('class="frame"') || processed.includes("class='frame'");
        const hasTitle = processed.includes('class="title"') || processed.includes("class='title'");
        const hasFooter = processed.includes('class="footer"') || processed.includes("class='footer'");

        // Extract any existing footer from content before wrapping in frame
        // to avoid footer ending up INSIDE frame (where overflow:hidden clips it)
        let contentBody = processed;
        let existingFooter = '';
        if (hasFooter) {
          const footerMatch = processed.match(/<footer\s+class=["']footer["'][^>]*>[\s\S]*?<\/footer>/i);
          if (footerMatch) {
            existingFooter = footerMatch[0];
            contentBody = processed.replace(footerMatch[0], '').trim();
          }
        }

        const footer = existingFooter || `<footer class="footer">
    <span>Strategy&</span>
    <span>${i + 1} / ${slides.length}</span>
  </footer>`;
        const title = hasTitle ? '' : `<h1 class="title">Key insights from analysis</h1>
  <h2 class="subtitle">Slide ${i + 1}</h2>
  `;

        let wrapped;
        if (hasFrame) {
          wrapped = `${title}${contentBody}
  ${footer}`;
        } else {
          wrapped = `${title}<div class="frame">${contentBody}</div>
  ${footer}`;
        }
        processed = `<div class="slide">\n  ${wrapped}\n</div>`;
      }

      return flattenNestedFrames(processed);
    });

    // If we got fewer slides than requested, log warning
    if (processedSlides.length < slideSpecs.length) {
      console.warn('[BulkGeneration] Got fewer slides than requested:', processedSlides.length, 'vs', slideSpecs.length);
    }

    // Audit log for bulk slide creator calls
    const creatorRole = agentMode ? 'slideCreator:agent' : 'slideCreator:chatbot';
    audit(creatorRole, `bulk created: ${processedSlides.length} slides`, {
      model: settings.model,
      query: `${slideSpecs.length} slide specs`,
      context: slideSpecs.map(s => s.template?.id || 'freestyle').join(', '),
      maxTokens: settings.maxTokens || null,
      reasoningEffort: settings.reasoningEffort || null,
      temperature: settings.temperature ?? null,
      duration: Date.now() - startTime,
      inputLen: bulkPrompt.length,
      outputLen: content?.length || 0,
      status: 'ok',
    });

    return processedSlides;
  } catch (error) {
    // Audit log for failures
    const creatorRole = agentMode ? 'slideCreator:agent' : 'slideCreator:chatbot';
    audit(creatorRole, 'bulk creation failed', {
      model: settings.model,
      query: `${slideSpecs.length} slide specs`,
      duration: Date.now() - startTime,
      status: 'error',
      error: error.message,
    });

    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// AI-based HTML quality validation - checks layout similarity to prompt
export async function validateHtmlWithAI(html, originalPrompt, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required for AI validation.');
  }

  const systemPrompt = `You are a strict quality assurance expert for Strategy& consulting slide design.
Your job is to critically evaluate HTML slide quality on TWO key aspects:

1. LAYOUT MATCH TO PROMPT - Does the slide design match what was requested?
2. CONTENT QUALITY - Is it clean, professional, executive-ready?

Be HARSH and CRITICAL. Good slides are rare. Most slides have issues.

LAYOUT ISSUES (check if design matches the original request):
- Wrong layout type (e.g., requested cards but got bullets)
- Missing requested elements (icons, KPIs, timeline, etc.)
- Layout doesn't fit the content type requested
- Design doesn't convey the requested message/structure

CONTENT OVERFLOW ISSUES (CRITICAL):
- Text that would extend beyond slide boundaries
- Too many elements crammed into the space
- Paragraphs that are too long to fit properly
- Cards/cells with text that would overflow their containers

QUALITY ISSUES:
- Missing .slide container
- Walls of text (>50 words in a paragraph)
- More than 5 bullet points or 4 cards
- Generic headlines (not insight-driven)
- Poor visual hierarchy`;

  const userPrompt = `EVALUATE THIS SLIDE HTML:
${html}

${originalPrompt ? `ORIGINAL PROMPT/REQUEST: "${originalPrompt}"

CRITICAL: Check if the layout/design MATCHES what was requested in the prompt above.
- Does it use the right layout type for the request?
- Does it include all the elements that were requested?
- Does the design structure fit the content being asked for?` : ''}

CHECK FOR CONTENT OVERFLOW:
- Would any text extend beyond its container?
- Are there elements that would overlap or collide?
- Is there too much content for the available space?

Respond in this EXACT JSON format:
{
  "score": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "verdict": "<PASS/FAIL/WARNING>",
  "summary": "<one sentence summary>",
  "layoutMatch": {
    "matches": <true/false>,
    "matchScore": <0-100>,
    "issues": ["<what doesn't match the request>"]
  },
  "overflowCheck": {
    "hasOverflow": <true/false>,
    "overflowAreas": ["<where content might overflow>"]
  },
  "issues": [
    {"severity": "critical|major|minor", "issue": "<description>"}
  ],
  "suggestions": ["<improvement suggestion>"]
}

Be CRITICAL. Most slides should score 40-70. Only truly excellent slides score 80+.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Parse JSON response
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('AI HTML validation error:', error);
    return {
      score: 50,
      grade: 'C',
      verdict: 'WARNING',
      summary: 'Could not complete AI validation',
      layoutMatch: { matches: true, matchScore: 50, issues: [] },
      overflowCheck: { hasOverflow: false, overflowAreas: [] },
      issues: [{ severity: 'minor', issue: error.message }],
      suggestions: [],
    };
  }
}

// AI-based PPTX code validation
export async function validatePptxCodeWithAI(pptxCode, html, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required for AI validation.');
  }

  const systemPrompt = `You are a PptxGenJS code quality expert.
Evaluate if the given PPTX rendering code will correctly reproduce the HTML slide.

Check for:
1. Does it create a slide? (pptx.addSlide())
2. Does it extract content from the HTML?
3. Does it position elements correctly?
4. Will it handle the main visual elements (titles, cards, text)?
5. Does it call addFooter?
6. Any syntax errors or issues?`;

  const userPrompt = `EVALUATE THIS PPTX RENDERING CODE:

HTML TO RENDER:
${html.substring(0, 1500)}

PPTX CODE:
${pptxCode.substring(0, 2500)}

Respond in this EXACT JSON format:
{
  "score": <number 0-100>,
  "willRender": <true/false>,
  "verdict": "<PASS/FAIL/WARNING>",
  "issues": [
    {"severity": "critical|major|minor", "issue": "<description>"}
  ],
  "missingElements": ["<elements from HTML not handled>"],
  "suggestions": ["<improvement>"]
}`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('AI PPTX validation error:', error);
    return {
      score: 50,
      willRender: true,
      verdict: 'WARNING',
      issues: [{ severity: 'minor', issue: error.message }],
      missingElements: [],
      suggestions: [],
    };
  }
}

// Call Gemini Vision API with image
async function callGeminiVisionAPI(settings, systemPrompt, userPromptText, imageBase64) {
  const creds = getCredentials(settings);
  // Use the current model if it's Gemini, otherwise default to gemini-1.5-flash for vision
  const visionModel = isGeminiModel(creds.rawModel || creds.model) ? (creds.rawModel || creds.model) : 'gemini-1.5-flash';

  const endpoint = buildGeminiEndpoint({ ...creds, rawModel: visionModel });

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPromptText },
          {
            inline_data: {
              mime_type: 'image/png',
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.3,
      topP: 0.95,
    }
  };

  // Add thinkingConfig for Gemini thinking models in vision calls (keep budget low for validation)
  if (isGemini3Model(visionModel)) {
    body.generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
  } else if (isGemini25Model(visionModel)) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 1024 };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildGeminiHeaders(creds),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini Vision API error: ${response.status}`);
  }

  const data = await response.json();
  return extractGeminiResponseText(data.candidates?.[0]?.content?.parts);
}

// Vision-based validation using GPT or Gemini with image analysis
export async function validateWithVision(imageBase64, originalPrompt, settings, validationType = 'layout') {
  const creds = getCredentials(settings);
  const visionModel = settings.visionModel || 'gpt-4o';

  if (!creds.apiKey) {
    throw new Error('API key is required for vision validation.');
  }

  let systemPrompt, userPromptText;

  if (validationType === 'layout') {
    systemPrompt = `You are a visual design quality expert for consulting slides.
Analyze the slide image and evaluate:
1. Does the layout match what was requested in the prompt?
2. Is content overflowing or overlapping?
3. Is text readable and well-positioned?
4. Is the visual hierarchy clear?
5. Is this executive/boardroom quality?`;

    userPromptText = `ANALYZE THIS SLIDE IMAGE.

${originalPrompt ? `ORIGINAL REQUEST: "${originalPrompt}"

Does this slide visually match what was requested? Check:
- Layout type matches request
- All requested elements are present
- Visual structure fits the content` : 'Evaluate the overall visual quality.'}

CHECK FOR VISUAL ISSUES:
- Text overflow or cutoff
- Overlapping elements
- Poor spacing/alignment
- Cluttered appearance

Respond in JSON:
{
  "score": <0-100>,
  "verdict": "<PASS/FAIL/WARNING>",
  "layoutMatches": <true/false>,
  "hasOverflow": <true/false>,
  "overflowAreas": ["<areas with overflow>"],
  "visualIssues": ["<issue>"],
  "suggestions": ["<improvement>"]
}`;
  } else if (validationType === 'comparison') {
    systemPrompt = `You are a visual fidelity expert comparing HTML rendering to PowerPoint export.
Your job is to determine if the PowerPoint version accurately reproduces the HTML version.`;

    userPromptText = `Compare these two slide renderings:
IMAGE 1 (Left/First): HTML rendering
IMAGE 2 (Right/Second): PowerPoint export

Evaluate FIDELITY - does the PPTX match the HTML?
- Text content: Same text present?
- Layout: Same positioning?
- Visual style: Similar colors/fonts?
- Elements: All elements reproduced?

Respond in JSON:
{
  "score": <0-100>,
  "verdict": "<PASS/FAIL/WARNING>",
  "isFaithful": <true/false>,
  "missingElements": ["<elements in HTML but not PPTX>"],
  "positionIssues": ["<positioning differences>"],
  "styleIssues": ["<style differences>"],
  "summary": "<one sentence summary>"
}`;
  }

  try {
    let content;

    if (creds.isGeminiProvider) {
      // Gemini native vision API
      content = await callGeminiVisionAPI(settings, systemPrompt, userPromptText, imageBase64);
    } else {
      // OpenAI-compatible vision API (GPT-4o, Claude via proxy, etc.)
      const headers = buildProviderHeaders(creds);
      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPromptText },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ];
      const requestBody = {
        model: creds.model,
        messages,
        max_tokens: 1000,
        temperature: 0.3,
      };
      const response = await fetch(creds.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Vision API error: ${response.status}`);
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('Vision validation error:', error);
    return {
      score: 50,
      verdict: 'WARNING',
      layoutMatches: true,
      hasOverflow: false,
      overflowAreas: [],
      visualIssues: [`Vision analysis failed: ${error.message}`],
      suggestions: [],
    };
  }
}

// Compare HTML and PPTX images for fidelity
export async function compareHtmlToPptxVisually(htmlImageBase64, pptxImageBase64, settings) {
  const creds = getCredentials(settings);
  const visionModel = settings.visionModel || 'gpt-4o';

  if (!creds.apiKey) {
    throw new Error('API key is required for visual comparison.');
  }

  const systemPrompt = `You are a visual fidelity expert comparing HTML slide rendering to PowerPoint export.
Evaluate how faithfully the PowerPoint reproduces the HTML version.`;

  const userPrompt = `Compare these two slide images:
- FIRST IMAGE: HTML rendering (the source)
- SECOND IMAGE: PowerPoint export (should match the source)

Evaluate FULL FIDELITY:
1. Is all text content present in PPTX?
2. Are elements positioned similarly?
3. Are colors and styles similar?
4. Are any elements missing or extra?

Respond in JSON:
{
  "fidelityScore": <0-100>,
  "verdict": "<PASS/FAIL/WARNING>",
  "textMatch": {"score": <0-100>, "issues": ["<text differences>"]},
  "layoutMatch": {"score": <0-100>, "issues": ["<position differences>"]},
  "styleMatch": {"score": <0-100>, "issues": ["<style differences>"]},
  "missingInPptx": ["<elements missing from PPTX>"],
  "extraInPptx": ["<unexpected elements in PPTX>"],
  "summary": "<overall assessment>"
}`;

  try {
    let content;

    const geminiVisionModel = creds.rawModel || creds.model;
    const endpoint = buildGeminiEndpoint({ ...creds, rawModel: geminiVisionModel });

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: 'user',
        parts: [
          { text: userPrompt },
          { inline_data: { mime_type: 'image/png', data: htmlImageBase64 } },
          { inline_data: { mime_type: 'image/png', data: pptxImageBase64 } },
        ]
      }],
      generationConfig: { maxOutputTokens: 1200, temperature: 0.3, topP: 0.95 }
    };

    // Add thinkingConfig for Gemini thinking models in vision comparison (keep budget low for validation)
    if (isGemini3Model(geminiVisionModel)) {
      body.generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
    } else if (isGemini25Model(geminiVisionModel)) {
      body.generationConfig.thinkingConfig = { thinkingBudget: 1024 };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildGeminiHeaders(creds),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Vision API error: ${response.status}`);
    }

    const data = await response.json();
    content = extractGeminiResponseText(data.candidates?.[0]?.content?.parts);

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('Visual comparison error:', error);
    return {
      fidelityScore: 50,
      verdict: 'WARNING',
      textMatch: { score: 50, issues: [] },
      layoutMatch: { score: 50, issues: [] },
      styleMatch: { score: 50, issues: [] },
      missingInPptx: [],
      extraInPptx: [],
      summary: `Visual comparison failed: ${error.message}`,
    };
  }
}

// Generate PptxGenJS renderer code for a custom template
export async function generatePptxRendererCode(templateHtml, templateTitle, settings) {
  // Apply pptxGenerator role overrides if configured
  const pptxRole = settings.roleSettings?.pptxGenerator || {};
  if (pptxRole.model) settings = { ...settings, model: pptxRole.model };
  if (pptxRole.maxTokens) settings = { ...settings, maxTokens: pptxRole.maxTokens };
  if (pptxRole.reasoningEffort) settings = { ...settings, reasoningEffort: pptxRole.reasoningEffort };
  if (pptxRole.temperature !== '' && pptxRole.temperature !== undefined) settings = { ...settings, temperature: pptxRole.temperature };

  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const systemPrompt = `You are an expert JavaScript developer specializing in PptxGenJS library.
Your task is to generate a JavaScript function that renders a slide from HTML to PowerPoint.

PPTXGENJS REFERENCE:
- Slide size: 13.333 x 7.5 inches (16:9)
- Coordinates are in inches from top-left
- Colors are hex without # (e.g., "8E1E1E")

COLOR PALETTE:
- maroon: '8E1E1E' (accent)
- red: 'A32020' (subtitles)
- main: '111111' (text)
- secondary: '222222' (body)
- meta: '4A4F57' (footer)
- zone1: 'F7F9FB' (light bg)
- border: 'E6E9EE'

RULES:
1. Return ONLY the function body code (no function wrapper)
2. Extract content from slideData.html using DOM parsing
3. Use provided helpers: addFooter, addTitle, addSubtitle
4. Position elements to match the HTML layout visually`;

  const userPrompt = `Generate PptxGenJS code to render this template to PowerPoint.

TEMPLATE: "${templateTitle}"

HTML:
${templateHtml}

Generate code that:
1. Creates a slide: const slide = pptx.addSlide();
2. Parses the HTML: const parser = new DOMParser(); const doc = parser.parseFromString(slideData.html, 'text/html');
3. Extracts and positions all text/shapes to match the HTML layout
4. Calls addFooter(slide, slideNum, totalSlides) at the end

Return ONLY the JavaScript code (no markdown, no explanation). The code will be wrapped in:
function(pptx, slideData, slideNum, totalSlides) { YOUR_CODE_HERE }`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Clean up code blocks
    content = content
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Chat with context - for Q&A and debugging without modifying slides
export async function chatWithContext(question, context, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Build context description
  let contextDescription = '';

  // Current slide context
  if (context.currentSlide) {
    const slide = context.currentSlide.slide;
    contextDescription += `
=== CURRENT SLIDE (Slide ${context.currentSlide.index + 1}) ===
Title: "${slide.title || 'Untitled'}"
Type: ${slide.type || 'custom'}
HTML Content:
${slide.html}
=== END CURRENT SLIDE ===
`;
  }

  // Referenced slides (from "slide 5", "this slide", etc.)
  if (context.referencedSlides && context.referencedSlides.length > 0) {
    for (const ref of context.referencedSlides) {
      const slide = ref.slide;
      contextDescription += `
=== REFERENCED SLIDE ${ref.index + 1} (${ref.type}) ===
Title: "${slide.title || 'Untitled'}"
Type: ${slide.type || 'custom'}
HTML Content:
${slide.html}
=== END SLIDE ${ref.index + 1} ===
`;
    }
  }

  // Full deck overview
  if (context.allSlides && context.allSlides.length > 0) {
    contextDescription += `
=== FULL DECK OVERVIEW (${context.totalSlides} slides) ===
${context.allSlides.map((s, i) => {
  const isCurrent = context.currentSlide && context.currentSlide.index === i;
  const marker = isCurrent ? ' ← CURRENTLY VIEWING' : '';
  return `${i + 1}. "${s.title || 'Untitled'}" [${s.type || 'custom'}]${marker}${s.summary ? `\n   Summary: ${s.summary}` : ''}`;
}).join('\n')}
=== END DECK OVERVIEW ===
`;
  }

  const systemPrompt = `You are a helpful assistant for a slide presentation tool.
You have full context of the user's presentation deck and can answer questions about slides.

IMPORTANT RULES:
1. You CAN see slide content - describe what you see accurately
2. When user references "this slide" or "current slide", look at CURRENT SLIDE section
3. When user references "slide 5", look for SLIDE 5 in the context
4. Be specific - quote text, describe layouts, mention data/numbers you see
5. If asked to identify pillars/points, extract them from the HTML content
6. Keep responses informative and relevant

CONTEXT SECTIONS:
- CURRENT SLIDE: The slide the user is currently viewing
- REFERENCED SLIDES: Specific slides mentioned in the question
- FULL DECK OVERVIEW: Summary of all slides with titles and types`;

  const userPrompt = `${contextDescription}

USER QUESTION: ${question}

Answer based on the context provided above. Be specific and quote actual content from the slides when relevant.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * AI triage: decides whether a request needs full agent mode (research + planning)
 * or can go directly to the router for simple execution.
 * Uses the fast model for a quick, cheap decision.
 * @param {string} userPrompt - The user's request
 * @param {Object} context - Current deck state (slideCount, storylineSummary, slideSummaries)
 * @param {Object} settings - API settings
 * @returns {Promise<{useAgent: boolean, reason: string}>}
 */
export async function triageRequest(userPrompt, context, settings) {
  const fastSettings = settings.fastModel
    ? { ...settings, model: settings.fastModel }
    : settings;

  const slideSummary = context.slideSummaries?.length > 0
    ? context.slideSummaries.map(s => `  ${s.index + 1}. "${s.title}" (${s.type})`).join('\n')
    : '(empty deck)';

  const prompt = `Decide if this user request needs the full content agent (research, planning, structuring) or can go directly to the slide router (simple create/edit/delete).

CURRENT DECK (${context.slideCount || 0} slides):
${slideSummary}
${context.storylineSummary ? `Storyline: ${context.storylineSummary}` : '(no storyline)'}

USER REQUEST: "${userPrompt}"

USE AGENT when the request:
- Needs web research (current data, statistics, market info, recent events)
- Asks for a multi-slide presentation on a topic (even if short, e.g. "now do risks")
- Needs content planning/storyline thinking (structure, narrative arc)
- Asks about a topic that requires domain knowledge the user hasn't provided
- Continues or extends an existing deck with new substantive content

SKIP AGENT (go directly to router) when the request:
- Is a simple edit to existing slides (change color, fix text, swap template)
- Is a layout/design request (fix overflow, resize, rearrange)
- Adds a single simple slide with no research needed (e.g. "add a thank you slide")
- Is a delete, reorder, or template switch
- Is a question about the tool itself

Reply with ONLY valid JSON: {"useAgent": true/false, "reason": "brief explanation"}`;

  try {
    const result = await agentChat(prompt, fastSettings, {
      systemPrompt: 'You are a routing classifier. Return JSON only, no commentary.',
      returnJSON: true,
      temperature: 0,
      maxTokens: 100,
    });

    if (result && typeof result === 'object') {
      console.log('[Triage]', result.useAgent ? 'AGENT' : 'ROUTER', '-', result.reason);
      return { useAgent: !!result.useAgent, reason: result.reason || '' };
    }
    if (typeof result === 'string') {
      const parsed = JSON.parse(result);
      console.log('[Triage]', parsed.useAgent ? 'AGENT' : 'ROUTER', '-', parsed.reason);
      return { useAgent: !!parsed.useAgent, reason: parsed.reason || '' };
    }
  } catch (err) {
    console.warn('[Triage] Failed, defaulting to agent:', err.message);
  }
  // Default: use agent for safety
  return { useAgent: true, reason: 'triage failed, defaulting to agent' };
}

/**
 * Simple chat function for agent reasoning
 * Used by the agentic executor for general purpose AI calls
 *
 * @param {string} prompt - The user prompt
 * @param {Object} settings - API settings
 * @param {Object} options - Options like systemPrompt, returnJSON, temperature
 * @returns {Promise<string|Object>} The AI response (string or parsed JSON)
 */
export async function agentChat(prompt, settings, options = {}) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const {
    systemPrompt = 'You are a helpful AI assistant.',
    returnJSON = false,
    temperature = 0.7,
    maxTokens = 4096,
    reasoningEffort,
    timeout = 360000, // 6 minute default timeout
  } = options;

  // ── Auto-inject search tool when searchEnabled is true ──
  // Models with built-in search (Gemini googleSearch, GPT web_search_preview)
  // just need the tool added to the request — same endpoint, same key.
  // This avoids needing a separate search endpoint/model/key configuration.
  let effectiveSettings = settings;
  if (settings.searchEnabled && !settings._extraTools?.length) {
    const searchTool = {
      type: 'web_search_preview',
      search_context_size: settings.searchContextSize || 'medium',
    };
    effectiveSettings = { ...settings, _extraTools: [searchTool] };
    console.log(`%c[agentChat] Search enabled — injecting ${creds.isGeminiProvider ? 'googleSearch' : 'web_search_preview'} tool`, 'color:#059669');
  }

  try {
    let content;

    if (creds.isGeminiProvider) {
      // Use existing Gemini API handler — merge options maxTokens + reasoningEffort into settings
      const mergedReasoning = reasoningEffort || settings.reasoningEffort || 'low';
      console.log(`%c[agentChat→Gemini] model=${creds.model}  reasoningEffort=${mergedReasoning}  maxTokens=${maxTokens}  search=${!!effectiveSettings._extraTools?.length}`, 'color:#6a9fb5');
      content = await callGeminiAPI({ ...effectiveSettings, maxTokens, reasoningEffort: mergedReasoning }, systemPrompt, prompt);
    } else {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];

      const requestBody = buildRequestBody(
        { ...effectiveSettings, temperature, maxTokens, ...(reasoningEffort !== undefined ? { reasoningEffort } : {}) },
        messages
      );

      // Set up timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Build headers based on provider type
      const headers = buildProviderHeaders(creds);

      // JSON mode: only for endpoints known to support it (OpenAI direct, not enterprise proxies/Azure/Anthropic)
      const isDirectOpenAI = (creds.apiEndpoint || '').includes('api.openai.com');
      if (returnJSON && !creds.useResponsesAPI && isDirectOpenAI) {
        requestBody.response_format = { type: 'json_object' };
      }

      // Log actual request params sent to API — visible in browser console + audit
      const _reqParams = {
        model: requestBody.model,
        max_tokens: requestBody.max_tokens || requestBody.max_output_tokens || null,
        reasoning: requestBody.reasoning_effort || requestBody.reasoning?.effort || null,
        temperature: requestBody.temperature ?? null,
        json_mode: !!requestBody.response_format,
        endpoint: creds.apiEndpoint?.slice(0, 80),
      };
      console.log(`%c[API→] ${_reqParams.model}  max_tokens=${_reqParams.max_tokens}  reasoning=${_reqParams.reasoning}  temp=${_reqParams.temperature}  json=${_reqParams.json_mode}`, 'color:#6a9fb5');
      // Expose for audit log consumers
      agentChat._lastRequestParams = _reqParams;

      // Retry on transient 5xx errors (NOT 429 — rate limit should fail fast).
      // Each attempt goes through the concurrency semaphore.
      const AGENT_MAX_RETRIES = 2;
      const AGENT_RETRY_BASE = 2000;
      let lastAgentErr = null;

      for (let attempt = 0; attempt <= AGENT_MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const jitter = Math.random() * 0.5;
          const delay = Math.round(AGENT_RETRY_BASE * attempt * (1 + jitter));
          console.log(`[agentChat] Retry ${attempt}/${AGENT_MAX_RETRIES} after ${delay}ms (jittered)...`);
          await new Promise(r => setTimeout(r, delay));
        }

        await _acquireApiSlot();
        try {
          let response;
          try {
            response = await fetch(creds.apiEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(requestBody),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const errMsg = error.error?.message || `API error: ${response.status}`;
            // 429 = rate limited — fail immediately
            if (response.status === 429) {
              const rateLimitErr = new Error(errMsg);
              rateLimitErr.isRateLimit = true;
              throw rateLimitErr;
            }
            // 5xx = transient — retry
            if (response.status >= 500 && attempt < AGENT_MAX_RETRIES) {
              console.warn(`[agentChat] ${response.status} error (attempt ${attempt + 1}):`, errMsg.slice(0, 200));
              lastAgentErr = new Error(errMsg);
              continue;
            }
            throw new Error(errMsg);
          }

          const data = await response.json();
          content = parseAPIResponseContent(data, creds);
          break; // Success — exit retry loop
        } catch (fetchErr) {
          if (fetchErr.isRateLimit) throw fetchErr;
          if (fetchErr.message?.includes('API error:')) throw fetchErr;
          // Connection error — retry if attempts remain
          console.warn(`[agentChat] Connection error (attempt ${attempt + 1}):`, fetchErr.message);
          lastAgentErr = fetchErr;
          if (attempt >= AGENT_MAX_RETRIES) break;
        } finally {
          _releaseApiSlot();
        }
      }

      if (!content && lastAgentErr) throw lastAgentErr;
    }

    // Parse JSON if requested
    if (returnJSON && content) {
      try {
        // First try direct parse (cleanest case)
        return JSON.parse(content.trim());
      } catch {
        // Try to extract JSON from response with extra text
        try {
          // Find the first { and last matching } using brace counting
          const startIdx = content.indexOf('{');
          if (startIdx !== -1) {
            let braceCount = 0;
            let endIdx = -1;
            for (let i = startIdx; i < content.length; i++) {
              if (content[i] === '{') braceCount++;
              if (content[i] === '}') braceCount--;
              if (braceCount === 0) {
                endIdx = i;
                break;
              }
            }
            if (endIdx !== -1) {
              const jsonStr = content.slice(startIdx, endIdx + 1);
              return JSON.parse(jsonStr);
            }
          }
        } catch (extractError) {
          console.warn('[agentChat] JSON extraction failed:', extractError.message);
        }
        console.warn('[agentChat] Could not parse JSON, returning null');
        return null;
      }
    }

    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`API call timed out after ${Math.round(timeout / 1000)}s`);
    }
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * Perform a web search using the configured search endpoint.
 * Uses the /responses API with web_search_preview tool.
 *
 * @param {string} query - The search query
 * @param {Object} settings - API settings (must have search config)
 * @returns {Promise<string>} The search result text
 */
export async function webSearch(query, settings) {
  // Check if search is enabled and configured
  if (!settings.searchEnabled) {
    console.log('[webSearch] Search is disabled');
    return null;
  }

  if (!settings.searchEndpoint || !settings.searchApiKey || !settings.searchModel) {
    // Custom search endpoint not configured — this is normal when using built-in Gemini/GPT search.
    // Only the custom "Agent Research" search endpoint needs these fields.
    console.log('[webSearch] Custom search endpoint not configured (searchEndpoint/searchApiKey/searchModel) — skipping.');
    return null;
  }

  try {
    const requestBody = {
      model: settings.searchModel,
      input: query,
      tools: [
        {
          type: 'web_search_preview',
          search_context_size: settings.searchContextSize || 'medium',
        },
      ],
      max_output_tokens: settings.searchMaxTokens || 128000,
    };

    console.log('[webSearch] Searching:', query.substring(0, 100) + '...');

    const headers = { 'Content-Type': 'application/json' };
    const isServerProxy = settings.searchApiKey === 'server-managed' || (settings.searchEndpoint || '').startsWith('/api/');
    if (!isServerProxy) {
      if (settings.searchAuthHeader === 'bearer') {
        headers['Authorization'] = `Bearer ${settings.searchApiKey}`;
      } else {
        headers['api-key'] = settings.searchApiKey;
      }
    }

    const response = await fetch(settings.searchEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[webSearch] API error:', error);
      throw new Error(error.error?.message || `Search API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract text from response - /responses API format
    // Response structure: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
    let resultText = '';

    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.text) {
              resultText += content.text + '\n';
            }
          }
        }
      }
    }

    console.log('[webSearch] Got result:', resultText.substring(0, 200) + '...');
    return resultText.trim() || null;

  } catch (error) {
    console.error('[webSearch] Error:', error.message);
    // Don't throw - just return null so agent can continue without search
    return null;
  }
}

/**
 * Perform research using the search endpoint — search + analysis in ONE call.
 * Sends the full worker prompt to the search endpoint with web_search_preview tool,
 * so the model searches the web AND produces analysis in a single API call.
 * This is the same endpoint used by slide creation's web search.
 *
 * @param {string} fullPrompt - The complete worker research prompt (persona + task + instructions)
 * @param {Object} settings - API settings (must have searchEndpoint, searchApiKey, searchModel)
 * @returns {Promise<string|null>} The model's full research response, or null if not configured
 */
export async function researchWithSearch(fullPrompt, settings) {
  if (!settings.searchEndpoint || !settings.searchApiKey || !settings.searchModel) {
    console.log('[researchWithSearch] Search endpoint not configured — falling back to standard LLM');
    return null;
  }

  try {
    const requestBody = {
      model: settings.searchModel,
      input: fullPrompt,
      tools: [
        {
          type: 'web_search_preview',
          search_context_size: settings.searchContextSize || 'medium',
        },
      ],
      max_output_tokens: settings.searchMaxTokens || 128000,
    };

    console.log('[researchWithSearch] Sending full research prompt to search endpoint...');

    const headers = { 'Content-Type': 'application/json' };
    const isServerProxy = settings.searchApiKey === 'server-managed' || (settings.searchEndpoint || '').startsWith('/api/');
    if (!isServerProxy) {
      if (settings.searchAuthHeader === 'bearer') {
        headers['Authorization'] = `Bearer ${settings.searchApiKey}`;
      } else {
        headers['api-key'] = settings.searchApiKey;
      }
    }

    const response = await fetch(settings.searchEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[researchWithSearch] API error:', error);
      throw new Error(error.error?.message || `Search+Research API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract text from Responses API format
    // Response structure: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
    let resultText = '';

    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.text) {
              resultText += content.text + '\n';
            }
          }
        }
      }
    }

    const trimmed = resultText.trim();
    console.log('[researchWithSearch] Got research result:', trimmed.substring(0, 200) + '...');
    return trimmed || null;

  } catch (error) {
    console.error('[researchWithSearch] Error:', error.message);
    // Don't throw — caller will fall back to standard _llm()
    return null;
  }
}

/**
 * Analyze content/documents deeply and create a structured plan for slide creation.
 * This is the "deep thinking" step that processes documents before creating slides.
 * Uses the main model (not fast model) for comprehensive analysis.
 *
 * @param {string} instruction - What the user wants to do with the content
 * @param {string} documentContent - Full text content from uploaded documents
 * @param {Object} settings - API settings
 * @param {Object} options - Additional options like storyline context
 * @returns {Promise<Object>} Analysis result with structured content plan
 */
export async function analyzeContentForSlides(instruction, documentContent, settings, options = {}) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const { storyline = null, slideCount = null } = options;

  // Clear prompt about the relationship between request and document
  const systemPrompt = `The user provides a REQUEST and SOURCE MATERIAL.
Create slides that fulfill the REQUEST using content FROM the source material.

IMPORTANT: Create the actual output - not slides about HOW you're creating it.
- If asked to "summarize" → create summary slides with actual summary content
- If asked to "create a proposal" → create proposal slides with actual proposal content
- NEVER create slides like "How we summarized" or "Our methodology"

Return JSON:
{"slides":[{"slideNumber":1,"title":"...","content":{"headline":"...","points":["..."]}}]}`;

  // User prompt - request first, then source material
  const userPrompt = `REQUEST: ${instruction}

SOURCE MATERIAL:
${documentContent}`;

  try {
    // Use deep analysis model if configured, otherwise fall back to main model
    const analysisModelRef = settings.deepAnalysisModel || settings.model;
    const analysisReasoningEffort = settings.deepAnalysisReasoningEffort || 'medium';

    // Create settings for the analysis call with reasoning effort
    const analysisSettings = {
      ...settings,
      model: analysisModelRef,
      reasoningEffort: analysisReasoningEffort,
      maxTokens: 8192, // Allow longer responses for detailed analysis
    };

    // Get credentials for the analysis model
    const analysisCreds = getCredentials(analysisSettings);

    console.log('[AnalyzeContent] Starting deep content analysis...', {
      model: analysisModelRef,
      reasoningEffort: analysisReasoningEffort,
    });
    debugLog(LogLevel.INFO, 'analyzeContentForSlides', 'Starting analysis', {
      model: analysisModelRef,
      reasoningEffort: analysisReasoningEffort,
      instructionLength: instruction.length,
      documentLength: documentContent.length,
    });

    let analysis;

    analysis = await callGeminiAPI(analysisSettings, systemPrompt, userPrompt);

    console.log('[AnalyzeContent] Analysis complete, length:', analysis.length);

    // Parse JSON from response (handle markdown code blocks)
    let parsedAnalysis = null;
    try {
      let cleanResponse = analysis;
      if (analysis.includes('```json')) {
        cleanResponse = analysis.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (analysis.includes('```')) {
        cleanResponse = analysis.replace(/```\s*/g, '');
      }

      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedAnalysis = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('[AnalyzeContent] Could not parse JSON, using raw analysis:', parseError.message);
    }

    debugLog(LogLevel.INFO, 'analyzeContentForSlides', 'Analysis complete', {
      analysisLength: analysis.length,
      parsedSlides: parsedAnalysis?.slides?.length || 0,
    });

    return {
      analysis,  // Raw text response
      parsed: parsedAnalysis,  // Structured JSON if available
      slides: parsedAnalysis?.slides || [],  // Array of slide specs
      summary: parsedAnalysis?.summary || '',
      totalSlides: parsedAnalysis?.totalSlides || parsedAnalysis?.slides?.length || 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[AnalyzeContent] Error:', error);
    debugLog(LogLevel.ERROR, 'analyzeContentForSlides', 'Analysis failed', {
      error: error.message,
    });
    throw error;
  }
}

// Generate a storyline from a prompt - returns array of story points with hierarchy
export async function generateStoryline(prompt, settings, options = {}) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Default to 10 slides for a well-structured deck if not specified
  const { slideCount = 10, existingStoryline = null } = options;

  const systemPrompt = `You are a presentation strategist creating storylines with consulting-grade communication standards.

Let the user's request drive the structure entirely. Do NOT impose a fixed narrative arc or activity flow.

CONSULTING COMMUNICATION STANDARDS:
- PYRAMID PRINCIPLE: Lead with the answer/insight, then support with evidence. Each slide answers "so what?"
- MECE: Mutually Exclusive, Collectively Exhaustive — no overlapping content between slides, no gaps in logic
- Executive-friendly: no fluff, every slide earns its place, headlines are insights not labels, data over vague statements
- If a slide introduces multiple concepts, consider whether each needs its own detail slide
- If including an overview/summary slide, its points should map 1:1 to subsequent detail slides
- Do NOT have two consecutive summary/overview slides — one is enough

DEPTH vs BREADTH:
- For a short deck: stay high-level, one slide per major concept
- For a longer deck: include overview slides PLUS detail slides for each point
- If you introduce N pillars/phases, ensure each gets its own detail slide

HIERARCHY:
- Main sections are ROOT level (parentId: null)
- Supporting details or sub-steps should be CHILDREN of their parent
- Use parentId to create logical groupings

POINT TYPES — use whatever fits the content:
"cover", "executive-summary", "context", "approach", "approach-step", "insight",
"recommendation", "case-study", "comparison", "timeline", "conclusion", "appendix",
or any other descriptive type that fits.

OUTPUT FORMAT:
Return a JSON array of story points:
[
  {
    "title": "Short title (3-4 words)",
    "description": "What this slide should convey",
    "keyMessage": "The main insight or takeaway",
    "pointType": "appropriate type",
    "parentId": null or parent index (0-based)
  }
]`;

  let userPrompt = `Create a storyline for a ${slideCount}-slide presentation on:
${prompt}

${existingStoryline ? `\nEXISTING STORYLINE TO REFINE:\n${JSON.stringify(existingStoryline, null, 2)}\n\nRefine and improve this storyline while maintaining the core structure.` : ''}

For ${slideCount} slides, balance depth and breadth appropriately.

STRUCTURAL CONSISTENCY:
- If an overview/executive summary slide previews N points, there MUST be detail slides for ALL N — no gaps
- Conversely, EVERY body slide must trace back to a point in the overview — no orphan slides that weren't previewed
- If you define an approach with N steps, any timeline must match those same N phases
- Every overview slide's items must map 1:1 to subsequent detail slides
- If you want to add "Next Steps", "Recommendations", or any extra topic, it MUST be listed in the overview slide too
- Be internally consistent — don't introduce concepts that aren't developed
- The deck should tell one coherent story, not multiple unrelated frameworks
- Think of the executive summary as a TABLE OF CONTENTS — it must cover 100% of what follows, and nothing follows that isn't in it

Return ONLY the JSON array, no explanation.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Parse JSON from response with repair for common AI response issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const storyline = safeJSONParse(content, 'Storyline');

    // Validate structure
    if (!Array.isArray(storyline)) {
      throw new Error('Invalid storyline format - expected array');
    }

    // Process storyline - convert parentId indices to actual IDs
    const baseId = Date.now();
    const processedStoryline = storyline.map((point, idx) => ({
      id: `story-${baseId}-${idx}`,
      title: point.title || `Point ${idx + 1}`,
      description: point.description || '',
      suggestedLayout: point.suggestedLayout || 'content-list',
      keyMessage: point.keyMessage || '',
      pointType: point.pointType || 'insight',
      parentId: null, // Will be set below
      order: idx,
    }));

    // Now resolve parentId references (index to actual ID)
    processedStoryline.forEach((point, idx) => {
      const originalPoint = storyline[idx];
      if (originalPoint.parentId !== null && originalPoint.parentId !== undefined) {
        const parentIdx = typeof originalPoint.parentId === 'number' ? originalPoint.parentId : parseInt(originalPoint.parentId);
        if (!isNaN(parentIdx) && parentIdx >= 0 && parentIdx < processedStoryline.length && parentIdx !== idx) {
          point.parentId = processedStoryline[parentIdx].id;
        }
      }
    });

    // Post-process: strip redundant agenda immediately after executive-summary
    for (let i = 1; i < processedStoryline.length; i++) {
      const prev = processedStoryline[i - 1];
      const curr = processedStoryline[i];
      const prevIsOverview = prev.pointType === 'executive-summary' || prev.suggestedLayout === 'executiveSummary';
      const currIsOverview = curr.pointType === 'executive-summary' || curr.suggestedLayout === 'executiveSummary';
      if (prevIsOverview && currIsOverview) {
        debugLog(LogLevel.INFO, 'generateStoryline', `Removing redundant adjacent overview slide: "${curr.title}"`);
        processedStoryline.splice(i, 1);
        i--; // re-check same index
      }
    }

    return processedStoryline;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// AI-powered sync: Generate storyline from existing slides (full analysis)
// Analyzes slide content and creates a proper storyline with hierarchy
export async function syncStorylineFromSlidesAI(slides, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  if (!slides || slides.length === 0) {
    return [];
  }

  // Extract content from each slide (without raw HTML)
  const slidesSummary = slides.map((slide, idx) => ({
    index: idx,
    id: slide.id,
    title: slide.title || `Slide ${idx + 1}`,
    type: slide.type || 'unknown',
    summary: slide.summary || '',
    content: extractSlideContentForAI(slide.html, { maxLength: 300 }),
  }));

  const systemPrompt = `You are a presentation strategist analyzing an existing slide deck to extract its storyline.

Your job is to analyze the slides and create a structured storyline that captures:
1. The narrative flow and key messages
2. The logical hierarchy (which slides support which)
3. Proper point types for each slide
4. Key messages and descriptions

POINT TYPES:
- "cover": Opening/title slide
- "executive-summary": Key takeaways
- "context": Background, situation
- "approach": Methodology overview
- "approach-step": Individual methodology step
- "insight": Key finding or data
- "recommendation": Specific action
- "case-study": Example or proof
- "comparison": Before/after, options
- "timeline": Roadmap, phases
- "conclusion": Summary, key takeaways, or synthesis
- "appendix": Supporting detail

HIERARCHY RULES:
- Identify parent-child relationships based on content
- Methodology/approach steps should be children of the approach section
- Supporting details should be children of their main point
- Use slideIndex to reference the parent slide

OUTPUT FORMAT - Return JSON array:
[
  {
    "slideIndex": 0,
    "slideId": "original-slide-id",
    "title": "Short title label (3-4 words, no periods)",
    "description": "What this slide conveys",
    "keyMessage": "The main takeaway",
    "pointType": "insight",
    "suggestedLayout": "three-card",
    "parentSlideIndex": null or index of parent slide
  }
]`;

  const userPrompt = `Analyze these ${slides.length} slides and generate a storyline:

SLIDES:
${JSON.stringify(slidesSummary, null, 2)}

Extract the storyline, identifying:
1. The key message of each slide
2. The hierarchy (which slides are sub-points of others)
3. The appropriate point type
4. Better short titles (3-4 words) if current ones are too long

Return ONLY the JSON array.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Parse JSON with repair for common AI response issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const storylineData = safeJSONParse(content, 'Storyline Data');

    if (!Array.isArray(storylineData)) {
      throw new Error('Invalid response format');
    }

    // Convert to proper storyline format with IDs
    const baseId = Date.now();
    const processedStoryline = storylineData.map((point, idx) => ({
      id: `story-${baseId}-${idx}`,
      slideId: point.slideId || slides[point.slideIndex]?.id,
      title: point.title || `Point ${idx + 1}`,
      description: point.description || '',
      keyMessage: point.keyMessage || '',
      suggestedLayout: point.suggestedLayout || 'content-list',
      pointType: point.pointType || 'insight',
      parentId: null, // Resolved below
      order: idx,
    }));

    // Resolve parent references
    storylineData.forEach((point, idx) => {
      if (point.parentSlideIndex !== null && point.parentSlideIndex !== undefined) {
        const parentIdx = typeof point.parentSlideIndex === 'number'
          ? point.parentSlideIndex
          : parseInt(point.parentSlideIndex);
        if (!isNaN(parentIdx) && parentIdx >= 0 && parentIdx < processedStoryline.length && parentIdx !== idx) {
          processedStoryline[idx].parentId = processedStoryline[parentIdx].id;
        }
      }
    });

    debugLog(LogLevel.INFO, 'syncStorylineFromSlides', `Generated storyline with ${processedStoryline.length} points from ${slides.length} slides`);

    return processedStoryline;
  } catch (error) {
    debugLog(LogLevel.ERROR, 'syncStorylineFromSlides', error.message);
    throw error;
  }
}

// AI-powered sync: Analyze storyline vs slides and return sync actions
// Returns: { reorder: [], skeletons: [], hierarchyFixes: [], comments: [] }
export async function syncSlidesFromStorylineAI(storyline, slides, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  if (!storyline || storyline.length === 0) {
    return { reorder: [], skeletons: [], hierarchyFixes: [], comments: [] };
  }

  // Build slide summary
  const slidesSummary = slides.map((slide, idx) => ({
    index: idx,
    id: slide.id,
    title: slide.title || `Slide ${idx + 1}`,
    type: slide.type,
    storyPointId: slide.storyPointId,
    parentId: slide.parentId,
    isSkeleton: slide.isSkeleton || false,
  }));

  // Build storyline summary
  const storylineSummary = storyline.map((point, idx) => ({
    index: idx,
    id: point.id,
    title: point.title,
    pointType: point.pointType,
    suggestedLayout: point.suggestedLayout,
    parentId: point.parentId,
    keyMessage: point.keyMessage,
    hasSlide: slides.some(s => s.storyPointId === point.id),
  }));

  const systemPrompt = `You are a presentation organizer syncing slides with a storyline.

The STORYLINE is the source of truth. Your job is to:
1. Figure out how to REORDER slides to match storyline order
2. Identify storyline points that need NEW SKELETON slides
3. Fix slide HIERARCHY to match storyline hierarchy
4. Add COMMENTS to slides that need content adjustments

RULES:
- Do NOT suggest deleting slides
- For missing storyline points, create skeleton placeholders
- Match slides to storyline points by storyPointId or title similarity
- Preserve existing slide content, just reorganize

OUTPUT FORMAT - Return JSON object:
{
  "reorder": [
    { "slideId": "slide-id", "newIndex": 0, "reason": "Move to match storyline position" }
  ],
  "skeletons": [
    {
      "storyPointId": "story-point-id",
      "title": "Slide title from storyline",
      "insertAfterSlideId": "slide-id or null for start",
      "suggestedLayout": "three-card",
      "reason": "Missing slide for storyline point"
    }
  ],
  "hierarchyFixes": [
    { "slideId": "slide-id", "newParentId": "parent-slide-id or null", "reason": "Match storyline hierarchy" }
  ],
  "comments": [
    { "slideId": "slide-id", "comment": "Consider updating title to match storyline key message", "priority": "medium" }
  ]
}`;

  const userPrompt = `Sync these slides with the storyline:

STORYLINE (source of truth):
${JSON.stringify(storylineSummary, null, 2)}

CURRENT SLIDES:
${JSON.stringify(slidesSummary, null, 2)}

Analyze and return sync actions to:
1. Reorder slides to match storyline sequence
2. Create skeletons for missing storyline points
3. Fix hierarchy to match storyline structure
4. Add comments for slides that need attention

Return ONLY the JSON object.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Parse JSON with repair for common AI response issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const syncActions = safeJSONParse(content, 'Sync Actions');

    // Validate structure
    const result = {
      reorder: Array.isArray(syncActions.reorder) ? syncActions.reorder : [],
      skeletons: Array.isArray(syncActions.skeletons) ? syncActions.skeletons : [],
      hierarchyFixes: Array.isArray(syncActions.hierarchyFixes) ? syncActions.hierarchyFixes : [],
      comments: Array.isArray(syncActions.comments) ? syncActions.comments : [],
    };

    debugLog(LogLevel.INFO, 'syncSlidesFromStoryline',
      `Sync plan: ${result.reorder.length} reorders, ${result.skeletons.length} skeletons, ${result.hierarchyFixes.length} hierarchy fixes, ${result.comments.length} comments`);

    return result;
  } catch (error) {
    debugLog(LogLevel.ERROR, 'syncSlidesFromStoryline', error.message);
    throw error;
  }
}

// Generate skeleton slides from storyline - headers/titles only, no content
export async function generateSkeletonSlides(storyline, availableTemplates, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Build template catalog (just IDs, names, and descriptions - no HTML sent to GPT)
  const templateCatalog = availableTemplates.map(t => ({
    id: t.id,
    title: t.title,
    category: t.category || 'General',
    description: t.description || '',
    suggestedFor: t.suggestedFor || '',
    // Include note for smarter template selection (truncate if too long)
    requirements: t.note ? t.note.slice(0, 200) : '',
  }));

  const systemPrompt = `You are matching story points to slide templates. DO NOT generate any HTML.

Your job is to:
1. Match each story point to the best template based on content type
2. Provide a clear title and subtitle for each slide

AVAILABLE TEMPLATES:
${JSON.stringify(templateCatalog, null, 2)}

OUTPUT FORMAT - Return ONLY a JSON array:
[
  {
    "storyPointId": "the story point ID",
    "templateId": "matched template ID from the list above",
    "title": "Clear slide title based on key message",
    "subtitle": "Section or category text"
  }
]

MATCHING GUIDELINES:
- "cover" template for intro/title slides
- "three-card" for 3 pillars/categories/items
- "two-column" for comparisons or dual concepts
- "timeline" for sequential/chronological content
- "quote" for key statements or testimonials
- "content-list" for lists of points
- "2x2-grid" for quadrant analysis or 4 concepts
- Use the first story point's suggestedLayout if provided`;

  const userPrompt = `Match templates for this storyline:
${JSON.stringify(storyline.map(p => ({
  id: p.id,
  title: p.title,
  description: p.description,
  keyMessage: p.keyMessage,
  suggestedLayout: p.suggestedLayout,
})), null, 2)}

Return ONLY the JSON array with templateId, title, subtitle for each story point.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Parse JSON with repair for common AI response issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const matches = safeJSONParse(content, 'Skeleton Matches');

    if (!Array.isArray(matches)) {
      throw new Error('Invalid format - expected array');
    }

    // Build skeleton slides by using actual template HTML
    return matches.map((match, idx) => {
      const storyPoint = storyline.find(p => p.id === match.storyPointId) || storyline[idx];
      const template = availableTemplates.find(t => t.id === match.templateId);
      const slideNum = idx + 1;
      const totalSlides = storyline.length;

      // Get template HTML and convert to skeleton
      let html;
      if (template && template.html) {
        html = createSkeletonFromTemplate(template.html, {
          title: match.title || storyPoint?.title || `Slide ${slideNum}`,
          subtitle: match.subtitle || storyPoint?.keyMessage || '',
          slideNum,
          totalSlides,
          branding: settings?.footerBranding,
        });
      } else {
        // Fallback if no template found
        html = getDefaultSkeletonHtml(slideNum, totalSlides, settings?.footerBranding);
      }

      return {
        storyPointId: match.storyPointId || storyPoint?.id || null,
        title: match.title || storyPoint?.title || `Slide ${slideNum}`,
        subtitle: match.subtitle || '',
        templateId: match.templateId || null,
        html,
        isSkeleton: true,
        skeletonApproved: false,
      };
    });
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Convert template HTML to skeleton format by keeping structure but clearing content
function createSkeletonFromTemplate(templateHtml, options) {
  const { title, subtitle, slideNum, totalSlides, branding } = options;
  const footerBrand = branding || 'Strategy&';
  let html = templateHtml;

  // Replace title
  html = html.replace(
    /<h1[^>]*class="[^"]*title[^"]*"[^>]*>[\s\S]*?<\/h1>/gi,
    `<h1 class="title">${escapeHtml(title)}</h1>`
  );

  // Replace subtitle
  html = html.replace(
    /<h2[^>]*class="[^"]*subtitle[^"]*"[^>]*>[\s\S]*?<\/h2>/gi,
    `<h2 class="subtitle">${escapeHtml(subtitle)}</h2>`
  );

  // Clear paragraph content with placeholder
  html = html.replace(
    /<p[^>]*>[\s\S]*?<\/p>/gi,
    '<p>[Content pending]</p>'
  );

  // Clear list items with placeholder
  html = html.replace(
    /<li[^>]*>[\s\S]*?<\/li>/gi,
    '<li>[Item pending]</li>'
  );

  // Replace h3 headers with placeholder headers
  let h3Count = 0;
  html = html.replace(
    /<h3[^>]*>[\s\S]*?<\/h3>/gi,
    () => {
      h3Count++;
      return `<h3>[Section ${h3Count}]</h3>`;
    }
  );

  // Update footer page numbers
  html = html.replace(
    /<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/gi,
    `<footer class="footer"><span>${footerBrand}</span><span>${slideNum}</span></footer>`
  );

  // Ensure proper slide structure (title/subtitle outside frame)
  html = ensureSlideStructure(html);

  return html;
}

// Helper to escape HTML entities
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper for default skeleton HTML
function getDefaultSkeletonHtml(slideNum, totalSlides, branding = 'Strategy&') {
  // Return a cleaner skeleton that's easy for AI to fill
  return `<div class="slide master-standard">
  <h1 class="title">Slide Title</h1>
  <h2 class="subtitle">Key Message</h2>
  <div class="frame">
    <ul class="content-list">
      <li>First key point</li>
      <li>Second key point</li>
      <li>Third key point</li>
    </ul>
  </div>
  <footer class="footer">
    <span>${branding}</span>
    <span>${slideNum} / ${totalSlides}</span>
  </footer>
</div>`;
}

// Fill a skeleton slide with actual content
// This takes the skeleton HTML (which is based on a template) and fills in actual content
export async function fillSkeletonSlide(skeletonSlide, storyPoint, settings, options = {}) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const { template = null, comments = [] } = options;

  // Build template structure reference
  let templateRef = '';
  if (template && template.html) {
    templateRef = `
ORIGINAL TEMPLATE STRUCTURE (for reference):
Template: "${template.title}"
${template.description ? `Purpose: ${template.description}` : ''}

You MUST preserve this exact HTML structure - only replace the text content inside elements.
Do NOT change div structure, class names, or element hierarchy.`;
  }

  const systemPrompt = `You are filling a skeleton slide with content from the storyline.

CRITICAL - TEMPLATE PRESERVATION:
1. PRESERVE the EXACT HTML structure - same divs, classes, elements
2. ONLY replace text content inside elements (placeholders like "[Content pending]")
3. Keep ALL class names, IDs, and element attributes unchanged
4. Do NOT add new elements or remove existing ones
5. The template structure is the VALUE - preserve it exactly

CRITICAL - USE STORYLINE CONTENT:
1. Use the provided TITLE as the slide title - do not change it
2. Use the KEY MESSAGE as subtitle or in a prominent position
3. Use the DESCRIPTION to fill bullet points and content areas
4. Do NOT invent new content - use what's in the storyline
5. You may rephrase for conciseness but keep the meaning

${comments.length > 0 ? 'ADDRESS USER COMMENTS: Incorporate feedback while keeping structure.' : ''}
${templateRef}

Return ONLY the filled HTML, no explanation or markdown.`;

  // Extract storyline content
  const titleToUse = storyPoint?.title || skeletonSlide.title;
  const keyMessage = storyPoint?.keyMessage || '';
  const description = storyPoint?.description || '';

  let userPrompt = `SKELETON HTML (preserve this EXACT structure):
${skeletonSlide.html}

=== STORYLINE CONTENT TO USE ===

TITLE: ${titleToUse}
${keyMessage ? `KEY MESSAGE: ${keyMessage}` : ''}
${description ? `DESCRIPTION/CONTENT:\n${description}` : ''}
${storyPoint?.suggestedLayout ? `LAYOUT TYPE: ${storyPoint.suggestedLayout}` : ''}

${comments.length > 0 ? `=== USER COMMENTS TO ADDRESS ===\n${comments.map(c => `- ${c}`).join('\n')}\n` : ''}
${TITLE_HEADER_RULES}

=== INSTRUCTIONS ===
1. Fill content areas using the DESCRIPTION - break into logical bullet points
2. PRESERVE the exact HTML structure - only change text inside elements
3. Keep all CSS classes and element hierarchy

Return ONLY the completed HTML.`;

  try {
    let content;

    // Use higher token limit to avoid truncation on complex templates
    const contentSettings = { ...settings, maxTokens: Math.max(settings.maxTokens || 4096, 8192) };

    content = await callGeminiAPI(contentSettings, systemPrompt, userPrompt);

    // Clean up
    content = content
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Ensure proper slide structure (title/subtitle outside frame)
    content = ensureSlideStructure(content);

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Populate slides with content - works for both new slides and existing slides
// Takes story points and fills HTML with actual content
export async function populateSlides(storyline, existingSlides, availableTemplates, settings, options = {}) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  const { batchSize = 3, onProgress = null } = options;
  const results = [];

  // Map pointType to best template IDs (in order of preference)
  // Template preferences per point type — spread across varied templates to avoid
  // repetition. The findBestTemplate helper will prefer unused templates from this list.
  const POINT_TYPE_TO_TEMPLATES = {
    'cover': ['cover', 'blank'],
    'executive-summary': ['executiveSummary', 'threeCards', 'kpiMetrics'],
    'context': ['kpiMetrics', 'threeCards', 'bulletPoints', 'grid2x2'],
    'approach': ['processFlow', 'grid3x2', 'threeCards'],
    'approach-step': ['statHighlight', 'quote', 'bulletPoints'],
    'insight': ['statHighlight', 'threeCards', 'quote', 'grid2x2'],
    'recommendation': ['grid3x2', 'bulletPoints', 'threeCards'],
    'case-study': ['quote', 'grid2x2', 'threeCards'],
    'comparison': ['comparisonTable', 'grid2x2', 'threeCards'],
    'timeline': ['timeline', 'roadmapTimeline', 'processFlow'],
    'conclusion': ['statHighlight', 'bulletPoints', 'threeCards'],
    'appendix': ['bulletPoints', 'comparisonTable', 'grid2x2'],
  };

  // Track which templates have been used (for diversity)
  const usedTemplateCounts = {};

  // Helper to find best template for a story point (avoids recently-used templates)
  const findBestTemplate = (storyPoint) => {
    // First priority: explicitly set templateId (user override — always honor)
    if (storyPoint.templateId) {
      const explicit = availableTemplates.find(t => t.id === storyPoint.templateId);
      if (explicit) return explicit;
    }

    // Second priority: suggestedLayout
    if (storyPoint.suggestedLayout) {
      const suggested = availableTemplates.find(t =>
        t.id === storyPoint.suggestedLayout ||
        t.type === storyPoint.suggestedLayout
      );
      if (suggested) return suggested;
    }

    // Third priority: map pointType to appropriate template, preferring unused ones
    const pointType = storyPoint.pointType || 'insight';
    const preferredTemplateIds = POINT_TYPE_TO_TEMPLATES[pointType] || ['threeCards', 'bulletPoints'];

    // Sort preferences: unused templates first, then by original order
    const sorted = [...preferredTemplateIds].sort((a, b) => (usedTemplateCounts[a] || 0) - (usedTemplateCounts[b] || 0));

    for (const templateId of sorted) {
      const match = availableTemplates.find(t => t.id === templateId);
      if (match) return match;
    }

    // Last resort: first available template (but NOT content-list if we can avoid it)
    const nonBullet = availableTemplates.find(t => t.id !== 'bulletPoints' && t.type !== 'content-list');
    return nonBullet || availableTemplates[0];
  };

  // Helper: detect if HTML is empty/blank (no real content)
  const isEmptySlide = (html) => {
    if (!html) return true;
    // Remove HTML tags and check what's left
    const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    // Check for placeholder patterns or minimal content
    const placeholderPatterns = [
      /^\s*$/,
      /^\[.*\]$/,
      /^(Title|Subtitle|Content|Placeholder)\s*$/i,
      /^Slide\s+\d+$/i,
    ];
    if (placeholderPatterns.some(p => p.test(textContent))) return true;
    // Check for mostly placeholders
    const bracketCount = (html.match(/\[[^\]]+\]/g) || []).length;
    const realTextLength = textContent.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, '').length;
    if (bracketCount >= 2 && realTextLength < 30) return true;
    return false;
  };

  // Helper: generate a brief layout description from template/type
  const getLayoutDescription = (templateId, template, title) => {
    const LAYOUT_DESCRIPTIONS = {
      'cover': 'cover slide with title and subtitle',
      'threeCards': '3-column cards layout',
      'grid2x2': '2x2 grid with 4 sections',
      'kpiMetrics': 'large KPI numbers with labels',
      'statHighlight': 'featured statistic with context',
      'bulletPoints': 'bullet point list',
      'timeline': 'horizontal timeline with phases',
      'roadmapTimeline': 'roadmap with milestones',
      'processFlow': 'step-by-step process flow',
      'quote': 'quote highlight with attribution',
      'comparisonTable': 'comparison table layout',
      'grid3x2': '3×2 grid with titles and descriptions',
      'pyramidDiagram': 'pyramid hierarchy diagram',
    };
    return LAYOUT_DESCRIPTIONS[templateId] || template?.description || `${templateId} layout`;
  };

  // Track previous slide designs (brief descriptions, not HTML)
  const previousDesigns = [];

  // Process in batches
  for (let i = 0; i < storyline.length; i += batchSize) {
    const batch = storyline.slice(i, i + batchSize);
    const batchResults = [];

    // Process slides SEQUENTIALLY within batch so each slide sees previous designs
    for (let batchIdx = 0; batchIdx < batch.length; batchIdx++) {
      const storyPoint = batch[batchIdx];
      const globalIdx = i + batchIdx;

      // Find existing slide for this story point
      const existingSlide = existingSlides.find(s => s.storyPointId === storyPoint.id);

      // Determine base HTML - use existing slide HTML or template HTML
      let baseHtml;
      let template = null;
      let layoutType = 'freestyle';

      if (existingSlide && existingSlide.html && !isEmptySlide(existingSlide.html)) {
        // Use existing slide HTML as base (it has real content)
        baseHtml = existingSlide.html;
        template = availableTemplates.find(t => t.id === existingSlide.templateId);
        layoutType = existingSlide.layoutType || template?.id || 'custom';
      } else {
        // Slide is empty or doesn't exist - find best template based on story point type
        template = findBestTemplate(storyPoint);
        baseHtml = template?.html || getDefaultSkeletonHtml(globalIdx + 1, storyline.length, settings?.footerBranding);
        layoutType = template?.id || 'freestyle';
      }

      // Get last 3 slide designs for context (lightweight descriptions)
      const recentDesigns = previousDesigns.slice(-3);

      // Fill the HTML with actual content, passing previous designs for context
      const filledHtml = await fillSlideWithContent(baseHtml, storyPoint, template, settings, recentDesigns);

      // Track this slide's design for next slides
      const resultLayoutType = template?.id || layoutType;
      const designDesc = getLayoutDescription(resultLayoutType, template, storyPoint.title);
      previousDesigns.push({ title: storyPoint.title, design: designDesc });
      // Track template usage count for diversity
      if (resultLayoutType) usedTemplateCounts[resultLayoutType] = (usedTemplateCounts[resultLayoutType] || 0) + 1;

      batchResults.push({
        storyPointId: storyPoint.id,
        existingSlideId: existingSlide?.id || null,
        title: storyPoint.title,
        html: filledHtml,
        templateId: template?.id || null,
        layoutType: resultLayoutType,
        isNew: !existingSlide,
      });
    }

    results.push(...batchResults);

    // Report progress
    if (onProgress) {
      onProgress({
        completed: Math.min(i + batchSize, storyline.length),
        total: storyline.length,
        phase: `Populating slides ${Math.min(i + batchSize, storyline.length)}/${storyline.length}`,
      });
    }
  }

  return results;
}

// Fill a single slide with content - uses storyline content and preserves template
// previousDesigns: array of {title, design} describing recent slide layouts (for variety)
async function fillSlideWithContent(html, storyPoint, template, settings, previousDesigns = []) {
  // Use the main model for content filling - needs quality output
  const creds = getCredentials(settings);

  // Detect template structure type from HTML
  const detectTemplateType = (html) => {
    if (html.includes('cover-slide') || html.includes('cover-title')) return 'cover';
    if (html.includes('card-row') || html.includes('class="card"')) return 'cards';
    if (html.includes('kpi-block') || html.includes('kpi-value')) return 'kpi';
    if (html.includes('timeline-row') || html.includes('timeline-item')) return 'timeline';
    if (html.includes('quote-box') || html.includes('quote-text')) return 'quote';
    if (html.includes('process-step') || html.includes('process-flow')) return 'process';
    if (html.includes('comparison-table') || html.includes('compare-row')) return 'comparison';
    if (html.includes('grid-2x2') || html.includes('grid-cell')) return 'grid';
    if (html.includes('content-list') || html.includes('<ul')) return 'bullets';
    return 'generic';
  };

  // Detect if this is a skeleton (has placeholder text)
  const isSkeleton = /\[Content pending\]|\[Item pending\]|\[Section \d+\]|\[Pending\]|\[Title\]|\[Subtitle\]/i.test(html);

  const templateType = detectTemplateType(html);

  // Template-specific filling instructions
  const TEMPLATE_FILLING = {
    'cover': `COVER SLIDE:
- Put the TITLE in the .cover-title or main title element
- Put the KEY MESSAGE or a tagline in .cover-category/.cover-subtitle
- DO NOT add any bullet points or extra content`,

    'cards': `CARDS LAYOUT:
- You have multiple cards to fill - distribute content EVENLY across ALL cards
- Each card <h3>: short headline (3-5 words) summarizing one aspect
- Each card <p>: 1-2 sentence description of that aspect
- Split the description into logical parts - one per card
- DO NOT put all content in the first card`,

    'kpi': `KPI/METRICS SLIDE:
- .kpi-value elements: put BIG numbers, percentages, or dollar amounts
- .kpi-label elements: put what the metric measures
- Extract numbers from description OR create realistic business metrics`,

    'timeline': `TIMELINE SLIDE:
- Each timeline marker: date, quarter, or phase (Q1, Phase 1, etc.)
- Each timeline content: brief description of what happens in that phase
- Distribute content chronologically across timeline items`,

    'quote': `QUOTE SLIDE:
- .quote-text: put the KEY MESSAGE as a powerful quote
- .quote-author: attribution (role, name if mentioned)`,

    'process': `PROCESS FLOW:
- Each step number: keep as-is or use sequential numbers
- Each step title: 2-4 word action label
- Each step description: what happens in this step`,

    'grid': `GRID LAYOUT:
- Each grid cell <h4>: short headline for that quadrant/cell
- Each grid cell <p>: brief content for that cell
- Distribute content evenly across all cells`,

    'bullets': `BULLET POINTS:
- Convert the description into 3-5 clear, actionable bullet points
- Each bullet: one complete thought, parallel structure
- Each bullet: clear and focused`,

    'comparison': `COMPARISON:
- Fill table headers with what's being compared
- Fill each cell with brief, comparable values`,

    'generic': `Fill all placeholder text with real content from the description.`,
  };

  const titleContent = storyPoint.title || 'Untitled';
  const keyMessage = storyPoint.keyMessage || '';
  const description = storyPoint.description || '';

  // Build design context from previous slides for variety and consistency
  let designContext = '';
  if (previousDesigns.length > 0) {
    const designList = previousDesigns.map((s, i) =>
      `${i + 1}. "${s.title}" - ${s.design}`
    ).join('\n');
    designContext = `

PREVIOUS SLIDES (for design variety - avoid repetitive layouts):
${designList}`;
  }

  // System prompt - emphasize filling with content adaptation
  const systemPrompt = `You are filling a slide ${isSkeleton ? 'SKELETON' : 'template'} with real content.

OUTPUT RULES:
1. Output ONLY raw HTML starting with <div class="slide
2. NO markdown code blocks, NO explanation text
3. Use the same CSS classes and styling patterns

CONTENT ADAPTATION (CRITICAL):
- If content has MORE items than template slots, ADD more elements with same styling
- If content has FEWER items than template slots, REMOVE extra elements
- Example: Description has 5 key points but template has 3 cards → create 5 cards
- The CONTENT determines the structure, not the template

CONTENT RULES:
1. REPLACE all placeholder text with REAL content from description
2. Fill the title with the provided TITLE
3. Fill the subtitle with the KEY MESSAGE
4. ${TEMPLATE_FILLING[templateType]}`;

  // Build clearer user prompt
  const userPrompt = `SLIDE HTML (use as styling guide):
${html}

CONTENT TO FILL:
TITLE: "${titleContent}"
KEY MESSAGE: "${keyMessage || 'Use title as subtitle'}"
DESCRIPTION: "${description || 'Create brief professional content based on the title'}"${designContext}

YOUR TASK:
1. Replace the title/h1 content with: "${titleContent}"
2. Replace subtitle/h2 content with: "${keyMessage || titleContent}"
3. Fill ALL content from the DESCRIPTION - this is the PRIMARY content source
4. ADAPT structure if needed: more content items = more elements, fewer = fewer
5. Use the same CSS classes but modify element count to fit content
6. Professional consulting tone - insight-driven, data-focused

Output the filled slide HTML only.`;

  try {
    let content;

    // Use higher token limit for slide content to avoid truncation on complex templates
    const contentSettings = { ...settings, maxTokens: Math.max(settings.maxTokens || 4096, 8192) };

    content = await callGeminiAPI(contentSettings, systemPrompt, userPrompt);

    // Clean up AI response - remove markdown, explanatory text, placeholders
    content = content
      // Remove markdown code blocks
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      // Remove any text before the HTML starts
      .replace(/^[\s\S]*?(<div\s+class=["']slide)/i, '$1')
      // Remove any trailing non-HTML text after the last </div>
      // Note: Only remove plain text, not HTML - use [^<]* instead of [\s\S]*
      .replace(/(<\/div>)\s*[^<]*$/, '$1')
      .trim();

    // Remove placeholder text patterns
    content = content
      .replace(/\[Title\s*Pending\]/gi, '')
      .replace(/\[Subtitle\]/gi, '')
      .replace(/\[Content\s*will\s*be\s*added\]/gi, '')
      .replace(/\[Content\]/gi, '')
      .replace(/\[Key\s*Message\]/gi, '')
      .replace(/\[Description\]/gi, '')
      .replace(/\[Placeholder\]/gi, '')
      .replace(/\[Insert\s*\w+\s*here\]/gi, '')
      .replace(/\[Your\s+\w+\s+here\]/gi, '')
      .replace(/\[TODO[^\]]*\]/gi, '')
      .replace(/\[\.\.\.\]/g, '');

    // Clean up empty elements that might result from placeholder removal
    content = content
      .replace(/<h1[^>]*>\s*<\/h1>/gi, '')
      .replace(/<h2[^>]*>\s*<\/h2>/gi, '')
      .replace(/<p>\s*<\/p>/gi, '')
      .replace(/<li>\s*<\/li>/gi, '');

    // Ensure proper slide structure
    content = ensureSlideStructure(content);

    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// AI-powered context assessment: determine what context is needed for a request
// This is a lightweight call to optimize context passing
// Fast rule-based context assessment - NO API call needed
function assessContextNeeds(userRequest, deckState) {
  const request = userRequest.toLowerCase();

  // Default: minimal context
  const result = {
    includeStoryline: false,
    storylineDetail: 'compact',
    includeSlideContent: false,
    slideContentScope: 'none',
    reasoning: 'default',
  };

  // Check for storyline-related keywords
  if (/storyline|narrative|story\s*points|populate.*from|fill.*skeleton/i.test(request)) {
    result.includeStoryline = true;
    result.storylineDetail = 'full';
    result.reasoning = 'storyline keywords detected';
  }

  // Check for deck-wide operations
  if (/summarize.*deck|overview|exec.*summary|all\s*slides|entire\s*deck|whole\s*deck/i.test(request)) {
    result.includeSlideContent = true;
    result.slideContentScope = 'all';
    result.reasoning = 'deck-wide operation';
    return result;
  }

  // Check for current slide operations
  if (/this\s*slide|current\s*slide|uplift|improve|fix|change|edit|update|make\s*it/i.test(request)) {
    result.includeSlideContent = true;
    result.slideContentScope = 'current';
    result.reasoning = 'current slide edit';
    return result;
  }

  // Check for referenced slides
  if (/like\s*slide|match\s*slide|similar\s*to|copy.*slide|based\s*on\s*slide/i.test(request)) {
    result.includeSlideContent = true;
    result.slideContentScope = 'referenced';
    result.reasoning = 'references other slides';
    return result;
  }

  // Check for specific slide mentions
  if (/slide\s*#?\d+|first\s*slide|last\s*slide|previous\s*slide|next\s*slide/i.test(request)) {
    result.includeSlideContent = true;
    result.slideContentScope = 'referenced';
    result.reasoning = 'specific slide mentioned';
    return result;
  }

  return result;
}

// Create an execution plan for agent mode
export async function createAgentExecutionPlan(userRequest, context, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // LEAN CONTEXT: Pre-computed summaries, no slide/storyline arrays
  const {
    slideCount = 0,
    currentSlideIndex = -1,
    currentSlideTitle = null,
    layoutSummary = '',      // e.g., "bullets:3, cards:2, dashboard:1"
    storylineSummary = '',   // e.g., "Intro → Problem → Solution → Results"
    hasSkeletons = false,
  } = context;

  // LEAN ROUTER: Minimal context for fast intent classification
  const systemPrompt = `${LEAN_ROUTER_PROMPT}

CONTEXT: ${slideCount} slides, current=${currentSlideIndex + 1}${currentSlideTitle ? ` "${currentSlideTitle}"` : ''}, storyline=${storylineSummary ? 'yes' : 'no'}, skeletons=${hasSkeletons ? 'pending' : 'no'}`;

  // LEAN USER PROMPT: Just request + pre-computed summaries
  const userPrompt = `${userRequest}

DECK: ${slideCount} slides${currentSlideIndex >= 0 ? `, viewing slide ${currentSlideIndex + 1}` : ''}
${layoutSummary ? `LAYOUTS USED: ${layoutSummary}` : ''}
${storylineSummary ? `STORYLINE: ${storylineSummary}` : ''}

Return JSON only.`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Parse JSON with repair for common AI response issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const plan = safeJSONParse(content, 'Agent Execution Plan');

    return {
      understanding: plan.understanding || 'Processing request',
      steps: plan.steps || [],
      estimatedSlides: plan.estimatedSlides || 0,
      requiresApproval: plan.requiresApproval || false,
      contextStrategy: plan.contextStrategy || null,
    };
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    // Return a fallback plan for parsing errors
    console.warn('Failed to parse execution plan:', error);
    return {
      understanding: 'Processing your request',
      steps: [{ action: 'answer_question', description: 'Handling request', params: {} }],
      estimatedSlides: 0,
      requiresApproval: false,
      contextStrategy: null,
    };
  }
}

// Export planning guidelines summary for transparency in approval dialogs
export function getAgentPlanningGuidelines() {
  return `You are an intelligent AI agent for creating and editing slide presentations.
You have access to TOOLS that let you create, edit, and manage slides. Think step by step.

AVAILABLE TOOLS:

📝 EDITING TOOLS:
1. "edit_slide" - Edit the current slide (or specific slide)
2. "edit_all" - Edit all slides with same instruction

➕ CREATION TOOLS:
3. "create_slide" - Create a single new slide (adds at end)
4. "insert_slide_at" - Insert slide at specific position
5. "create_slides_batch" - Create multiple slides at once
6. "add_separator" - Add a section separator/divider slide
7. "create_from_template" - Create slide using a specific template
8. "switch_template" - Change existing slide to a different template/layout

🔄 REORDERING TOOLS:
8. "move_slide" - Move a slide to a different position

📋 TEMPLATE TOOLS:
6. "find_template" - Search for best matching template
7. "list_templates" - Show available templates to user

📖 STORYLINE TOOLS:
8. "generate_storyline" - Create narrative structure for presentation
9. "generate_skeletons" - Create skeleton slides from storyline
10. "populate_slides" - Fill slides with actual content

IMPORTANT RULES:
- DISTINGUISH CREATE vs EDIT:
  - CREATE intent: "create", "add", "make", "generate", "new slide" → use create_slide
  - EDIT intent: "change", "update", "fix", "modify", "edit" → use edit_slide
- For edits: "slide 2" → slideIndex: 1 (0-based)
- Chain tools when needed: find_template → create_from_template
- For multi-slide requests, use create_slides_batch

DECK CREATION GUIDELINES:
- If user asks for a "deck" without specifying count: default to 10-12 slides max
- Think like a consultant: PYRAMID structure (lead with answer, support with evidence)
- MECE: Mutually Exclusive, Collectively Exhaustive (no overlaps, no gaps)
- If presenting 3 pillars/phases in depth: 1 overview + 3 detail slides = 4 slides minimum
- Story flow: Each slide should connect logically to the next
- Structure depends on deck size:
  - Large decks (7+ slides): Cover → Executive Summary (3-5 key themes) → Body slides (grouped logically) → Closing
  - Small decks (≤6 slides): Cover → Body slides → Closing (no exec summary needed)
  - Adapt the body structure to the request — do NOT default to a proposal format (problem/solution/next steps) unless the user explicitly asks for one.
- Executive Summary: if included, ONE slide (executiveSummary template) with 2-5 themed sections. This is the ONLY overview/summary slide — never add a second one.

TEMPLATE PRESERVATION (CRITICAL):
- When editing, PRESERVE the existing HTML structure/template
- Only change text content, NOT layout or structure
- "edit" means content change within same template
- To change template/layout, user must EXPLICITLY ask

LAYOUT SELECTION - USER INSTRUCTIONS TAKE PRIORITY:
- If user describes a SPECIFIC layout (boxes, columns, stacked, split, grid, counts), use FREESTYLE
- Freestyle triggers: "2 boxes left, 3 on right", "split layout", "4 cards", custom layout descriptions
- User layout instructions override template matching
- Template matching only when user describes content without layout details
- Freestyle uses component guide (cards, KPIs, splits, grids, bullets, quotes, etc.)`;
}

// Transform element content into a widget format using GPT
// This takes the existing content of an element and transforms it into a specified widget type
// vibeHint: optional string like "Minimal icons, sharp corners..." from getVibePromptContext()
export async function transformElementToWidget(elementContent, widgetTemplate, settings, vibeHint = '') {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  // Extract text content from HTML if provided as HTML
  const textContent = elementContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // Build vibe-aware instructions
  const vibeInstruction = vibeHint ? `\n- Design style: ${vibeHint}` : '';

  const systemPrompt = `You are an expert at transforming content into structured HTML widgets for executive presentations.

Your task: Take the user's existing content and fit it into the provided widget HTML template.
- PRESERVE the meaning and key information from the original content
- FILL IN all placeholders like [Title], [Value], [Description] etc. with actual content
- Use the original content to inform what goes in each placeholder
- If the original content doesn't have enough for all placeholders, create sensible content that fits
- Keep text professional - this is for executive presentations
- Numbers should look real and specific (not just "XX%")
- Use appropriate icons/emojis where placeholders like [Icon] exist${vibeInstruction}

IMPORTANT: Return ONLY the filled-in HTML widget. No explanations, no markdown code blocks, just the raw HTML.`;

  const userPrompt = `Original Element Content:
${textContent}

Widget Template to fill:
${widgetTemplate}

Transform the original content into this widget format. Return only the filled HTML.`;

  try {
    const response = await fetch(creds.apiEndpoint, {
      method: 'POST',
      headers: buildProviderHeaders(creds),
      body: JSON.stringify(buildRequestBody(
        { ...settings, temperature: 0.7, maxTokens: 2000 },
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      )),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let widgetHtml = parseAPIResponseContent(data, creds)?.trim();

    if (!widgetHtml) {
      throw new Error('No response from AI');
    }

    // Clean up any markdown code blocks if present
    widgetHtml = widgetHtml.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();

    return widgetHtml;
  } catch (error) {
    console.error('[transformElementToWidget] Error:', error);
    throw error;
  }
}

// ============================================
// VIBE REIMAGINATION
// ============================================

/**
 * Reimagine a slide's visual layout for a specific vibe
 * Uses the same API infrastructure as other AI functions
 *
 * @param {string} slideHtml - The original slide HTML
 * @param {string} vibeId - The target vibe (bold, corporate, creative, data, minimal)
 * @param {Object} vibeConfig - Vibe configuration { name, description, patterns }
 * @param {Object} settings - API settings
 * @returns {Promise<string>} - The reimagined slide HTML
 */
export async function reimagineSlideWithVibe(slideHtml, vibeId, vibeConfig, settings) {
  const creds = getCredentials(settings);

  if (!creds.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  console.log(`[reimagineSlideWithVibe] Starting: vibeId=${vibeId}, model=${creds.model}`);

  const systemPrompt = `You are a Strategy& presentation designer applying the "${vibeConfig.name}" visual style.

=== CRITICAL: WHAT YOU MUST PRESERVE ===
1. LAYOUT STRUCTURE - If slide has 3 cards, output must have 3 cards. If it has a table, keep the table. If it has a timeline, keep the timeline. NEVER flatten to plain text.
2. ALL TEXT CONTENT - Every word, number, label, bullet point must appear exactly as in the original
3. SEMANTIC MEANING - Cards stay cards, lists stay lists, metrics stay metrics

=== WHAT YOU CHANGE: VISUAL STYLING ONLY ===
Apply the "${vibeConfig.name}" vibe by changing ONLY:
- Colors and backgrounds
- Border styles and thickness
- Font weights and sizes (within limits)
- Shadows and rounded corners
- Icon/number styling
- Spacing and padding

${vibeConfig.gptDescription || vibeConfig.description}

${vibeConfig.patterns || ''}

=== TECHNICAL CONSTRAINTS ===
- Frame content: max 860px wide × 350px tall
- Font sizes: body 11-14px, titles 14-17px, accent numbers up to 48px
- Colors: #8E1E1E (maroon), #A32020 (red), #111111 (text), #4A4F57 (grey), #E6E9EE (border), #F7F9FB (bg)

=== OUTPUT FORMAT ===
Return ONLY valid HTML starting with <div class="slide ...> and ending with </div>. No markdown, no explanation.`;

  const userPrompt = `Apply "${vibeConfig.name.toUpperCase()}" visual styling to this slide.

ORIGINAL SLIDE:
${slideHtml}

INSTRUCTIONS:
1. Keep the EXACT same layout structure (same number of cards/rows/columns)
2. Keep ALL text content unchanged
3. Only change visual styling: colors, borders, backgrounds, fonts, shadows
4. Output complete slide HTML only`;

  try {
    let content;

    content = await callGeminiAPI(settings, systemPrompt, userPrompt);

    // Clean up markdown blocks first
    content = content
      .replace(/```html\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    // Extract just the slide HTML - find the opening <div class="slide and its matching closing </div>
    const slideStartMatch = content.match(/<div[^>]*class="[^"]*slide[^"]*"[^>]*>/i);
    if (!slideStartMatch) {
      console.warn('[reimagineSlideWithVibe] No slide div found in response');
      console.warn('[reimagineSlideWithVibe] Response preview:', content.substring(0, 500));
      throw new Error('Invalid HTML structure returned from API');
    }

    const slideStartIndex = content.indexOf(slideStartMatch[0]);

    // Find the matching closing </div> by counting nested divs
    let depth = 0;
    let slideEndIndex = -1;
    let i = slideStartIndex;

    while (i < content.length) {
      if (content.substring(i, i + 4).toLowerCase() === '<div') {
        depth++;
        i += 4;
      } else if (content.substring(i, i + 6).toLowerCase() === '</div>') {
        depth--;
        if (depth === 0) {
          slideEndIndex = i + 6;
          break;
        }
        i += 6;
      } else {
        i++;
      }
    }

    if (slideEndIndex === -1) {
      console.warn('[reimagineSlideWithVibe] Could not find matching closing div');
      throw new Error('Malformed HTML structure returned from API');
    }

    // Extract just the slide HTML
    const extractedHtml = content.substring(slideStartIndex, slideEndIndex).trim();

    console.log(`[reimagineSlideWithVibe] Success: Reimagined with ${vibeId} vibe (${extractedHtml.length} chars)`);
    return extractedHtml;

  } catch (error) {
    console.error('[reimagineSlideWithVibe] Error:', error.message);
    throw error;
  }
}
