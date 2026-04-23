/**
 * Embedding-based Template Matching Service
 *
 * Uses vector embeddings for semantic template matching at scale.
 * Designed to handle 1000+ templates efficiently.
 *
 * Flow:
 * 1. User request → Generate embedding
 * 2. Search vector space → Return top 3 matches
 * 3. GPT picks best match and designs slide
 */

import { SLIDE_TEMPLATES, getTemplateFlex } from '../utils/slideTemplates';
import { authFetch } from './authFetch.js';

// =============================================================================
// TEMPLATE FAMILIES - Groups of similar templates
// =============================================================================

export const TEMPLATE_FAMILIES = {
  'cover-opening': {
    qualifier: 'Title Opening',
    description: 'Cover slides, title slides, section openers, working placeholders',
    templates: ['cover', 'blank', 'instructionSlide'],
  },
  'cards-columns': {
    qualifier: 'Card Columns',
    description: 'Multi-column cards (2, 3, 4 cards) with icons and content, column boxes',
    templates: ['twoCards', 'twoCardsB', 'twoCardsC', 'twoCardsD', 'twoCardsE', 'threeCards', 'threeCardsB', 'threeCardsC', 'threeCardsD', 'threeCardsE', 'fourCards', 'fourCardsB', 'fourCardsC', 'fourCardsD', 'fourCardsE', 'grid3x2', 'twoColumnBoxes', 'threeColumnBoxes', 'qualSlide'],
  },
  'grid-matrix': {
    qualifier: 'Grid Matrix',
    description: '2x2, 2x3, 3x3 grids, matrices, quadrant layouts, priority matrices',
    templates: ['grid2x2', 'grid2x3', 'grid3x3', 'priorityMatrix', 'nineBoxMatrix'],
  },
  'kpi-metrics': {
    qualifier: 'KPI Metrics',
    description: 'KPI blocks, statistics, numbers, performance metrics, scorecards',
    templates: ['kpiMetrics', 'statHighlight', 'scorecard'],
  },
  'timeline-roadmap': {
    qualifier: 'Timeline Roadmap',
    description: 'Horizontal timelines, milestones, roadmaps, phases, workplans, gantt',
    templates: ['timeline', 'roadmapTimeline', 'workplan'],
  },
  'process-flow': {
    qualifier: 'Process Flow',
    description: 'Process steps, arrows, flows, sequences, chevrons, phases',
    templates: ['processFlow', 'chevronFlow', 'outcomeApproach', 'projectStepDetail', 'customerJourney'],
  },
  'comparison': {
    qualifier: 'Comparison Layout',
    description: 'Before/after, pros/cons, side-by-side comparisons, current vs future',
    templates: ['prosAndCons', 'beforeAfter', 'problemSolution', 'currentFutureState', 'optionsRecommendation'],
  },
  'table-list': {
    qualifier: 'Table List',
    description: 'Tables, comparison tables, dense data tables, structured lists, options comparison',
    templates: ['comparisonTable', 'denseTable'],
  },
  'text-bullets': {
    qualifier: 'Text Bullets',
    description: 'Bullet points, dense bullets, text-heavy slides, lists, numbered lists, high-density content',
    templates: ['bulletPoints', 'numberedList', 'bulletsDense', 'numberedRows', 'numberedRowsB', 'numberedRowsC'],
  },
  'quote-callout': {
    qualifier: 'Quote Callout',
    description: 'Quotes, testimonials, callouts, emphasis, strategic insights',
    templates: ['quote', 'valueProposition', 'strategicInsight'],
  },
  'team-people': {
    qualifier: 'Team People',
    description: 'Team showcases, org charts, people profiles',
    templates: ['teamShowcase'],
  },
  'analysis-framework': {
    qualifier: 'Analysis Framework',
    description: 'SWOT, strategic frameworks, 2x2 analysis, issue trees, MECE',
    templates: ['swotAnalysis', 'issueTree'],
  },
  'summary-recap': {
    qualifier: 'Summary Recap',
    description: 'Executive summaries, key points, takeaways, recommendations, insights, executive overview',
    templates: ['executiveSummary', 'executiveSummaryVertical', 'executiveSummaryHorizontal', 'insightToAction', 'recommendationSummary'],
  },
  'closing-cta': {
    qualifier: 'Closing CTA',
    description: 'Thank you, next steps, call to action, closing slides',
    templates: ['thankYou', 'nextSteps'],
  },
  'exhibit-chart': {
    qualifier: 'Data Exhibit',
    description: 'Charts, graphs, data visualizations, bar charts, trend lines, waterfall',
    templates: ['barChartExhibit', 'waterfallChart', 'dualCharts'],
  },
};

// =============================================================================
// VARIANT GROUPS - Templates that are visual variants of the same logical layout.
// Used for:
//   1. Random variant swapping (agent variety)
//   2. Smart suggestions (suggest sibling variants first)
// Each group contains templates with the SAME item count / structure,
// just different visual styling.
// =============================================================================

export const VARIANT_GROUPS = {
  twoCards:           ['twoCards', 'twoCardsB', 'twoCardsC', 'twoCardsD', 'twoCardsE'],
  threeCards:         ['threeCards', 'threeCardsB', 'threeCardsC', 'threeCardsD', 'threeCardsE'],
  fourCards:          ['fourCards', 'fourCardsB', 'fourCardsC', 'fourCardsD', 'fourCardsE'],
  executiveSummary:   ['executiveSummary', 'executiveSummaryVertical', 'executiveSummaryHorizontal'],
  bulletPoints:       ['bulletPoints', 'bulletPointsVertical', 'bulletPointsLetters', 'bulletPointsChecks', 'bulletPointsTwoCol'],
  numberedRows:       ['numberedRows', 'numberedRowsB', 'numberedRowsC'],
};

// Reverse lookup: templateId → group array
const _variantIndex = {};
for (const [, group] of Object.entries(VARIANT_GROUPS)) {
  for (const id of group) {
    _variantIndex[id] = group;
  }
}

/**
 * Get the variant siblings for a template (excluding itself).
 * Returns empty array if the template has no variants.
 */
export function getVariantSiblings(templateId) {
  const group = _variantIndex[templateId];
  if (!group) return [];
  return group.filter(id => id !== templateId);
}

// =============================================================================
// TEMPLATE QUALIFICATIONS - Rich metadata for each template
// =============================================================================

export const TEMPLATE_QUALIFICATIONS = {
  blank: {
    family: 'cover-opening',
    layoutSummary: 'Empty full canvas',
    designSummary: 'Minimal blank',
    description: 'Full-page empty canvas with no title or subtitle. Use for custom diagrams, section dividers, large images, or when complete creative freedom is needed.',
    keywords: ['blank', 'empty', 'custom', 'canvas', 'divider', 'section', 'image', 'diagram'],
  },
  instructionSlide: {
    family: 'cover-opening',
    layoutSummary: 'Title with instruction box',
    designSummary: 'Working placeholder',
    description: 'Working slide with title, subtitle, and large central instruction box. Use as placeholder for slides in development, partner notes, content directions, or when you need to specify what should go on a slide.',
    keywords: ['instruction', 'notes', 'working', 'placeholder', 'empty', 'directions', 'todo', 'partner', 'draft', 'develop', 'tbd', 'pending'],
  },
  cover: {
    family: 'cover-opening',
    layoutSummary: 'Title with category',
    designSummary: 'Bold corporate',
    description: 'Opening slide with category tag at top, large title in center, company branding and date at bottom. Use as first slide or major section opener.',
    keywords: ['cover', 'title', 'opening', 'first', 'introduction', 'section', 'start', 'beginning'],
  },
  threeCards: {
    family: 'cards-columns',
    layoutSummary: '3 horizontal cards',
    designSummary: 'Uplifted cards',
    description: 'Three vertical cards side by side, each with icon circle, number, heading, body text, and impact box at bottom. Ideal for frameworks, pillars, phases, or options.',
    keywords: ['three', 'cards', 'columns', 'pillars', 'options', 'framework', 'phases', 'steps', '3'],
  },
  twoCards: {
    family: 'cards-columns',
    layoutSummary: '2 horizontal cards',
    designSummary: 'Uplifted cards',
    description: 'Two wide cards side by side with icon, number label, heading, body text, bullet list, and impact box. For dual-category content.',
    keywords: ['two', 'cards', 'columns', 'dual', 'compare', 'options', '2'],
  },
  twoCardsB: {
    family: 'cards-columns',
    layoutSummary: '2 cards with banners',
    designSummary: 'Gradient banner cards',
    description: 'Two cards with colorful gradient banner headers (teal/amber), icon in banner, body text, bullet list, and pill metric.',
    keywords: ['two', 'cards', 'banner', 'gradient', 'dual', '2'],
  },
  twoCardsC: {
    family: 'cards-columns',
    layoutSummary: '2 cards with stripes',
    designSummary: 'Left-stripe cards',
    description: 'Two cards with thick vertical left stripe accent, square icon badge, roman numerals, body text, bullet list, dark pill metric.',
    keywords: ['two', 'cards', 'stripe', 'dual', '2'],
  },
  threeCardsB: {
    family: 'cards-columns',
    layoutSummary: '3 minimal flat sections',
    designSummary: 'Flat divider sections',
    description: 'Three borderless sections separated by thin vertical dividers with colored dot, letter label, title with colored underline, body text, and bottom metric.',
    keywords: ['three', 'cards', 'minimal', 'flat', 'sections', '3'],
  },
  threeCardsC: {
    family: 'cards-columns',
    layoutSummary: '3 dark-header cards',
    designSummary: 'Dark header blocks',
    description: 'Three cards with dark colored header blocks (navy/burgundy/forest), icon + title in header, light body, per-card accent metric box.',
    keywords: ['three', 'cards', 'dark', 'header', 'accent', '3'],
  },
  fourCards: {
    family: 'cards-columns',
    layoutSummary: '4 horizontal cards',
    designSummary: 'Compact cards',
    description: 'Four compact cards side by side with icon, number, heading, body text, and impact box. For comprehensive frameworks.',
    keywords: ['four', 'cards', 'columns', 'compact', 'framework', '4'],
  },
  fourCardsB: {
    family: 'cards-columns',
    layoutSummary: '4 centered icon cards',
    designSummary: 'Pastel icon-top cards',
    description: 'Four cards with centered icon badge on pastel tinted backgrounds (blue/green/amber/rose), title, description, and tag label.',
    keywords: ['four', 'cards', 'icon', 'pastel', 'centered', '4'],
  },
  fourCardsC: {
    family: 'cards-columns',
    layoutSummary: '4 horizontal rows',
    designSummary: 'Bar-style rows',
    description: 'Four horizontal bar rows stacked vertically, each with colored pip, icon, title + description, and metric badge on right.',
    keywords: ['four', 'cards', 'rows', 'horizontal', 'bars', 'compact', '4'],
  },
  twoCardsD: {
    family: 'cards-columns',
    layoutSummary: '2 block-header cards',
    designSummary: 'Burgundy block header',
    description: 'Two cards with solid burgundy header bar containing number + title, then bulleted content below. Clean and structured — no icons.',
    keywords: ['two', 'cards', 'block', 'numbered', 'bullets', 'simple', '2'],
  },
  twoCardsE: {
    family: 'cards-columns',
    layoutSummary: '2 horizontal stripe rows',
    designSummary: 'Stripe rows',
    description: 'Two full-width horizontal rows stacked vertically. Each has large burgundy number on left, title + description on right. Sequential reading flow.',
    keywords: ['two', 'cards', 'rows', 'horizontal', 'stripes', 'numbered', '2'],
  },
  threeCardsD: {
    family: 'cards-columns',
    layoutSummary: '3 block-header cards',
    designSummary: 'Burgundy block header',
    description: 'Three cards with solid burgundy header bar containing number + title, then bulleted content below. Clean and structured — no icons.',
    keywords: ['three', 'cards', 'block', 'numbered', 'bullets', 'simple', '3'],
  },
  threeCardsE: {
    family: 'cards-columns',
    layoutSummary: '3 horizontal stripe rows',
    designSummary: 'Stripe rows',
    description: 'Three full-width horizontal rows stacked vertically. Each has large burgundy number on left, title + description on right.',
    keywords: ['three', 'cards', 'rows', 'horizontal', 'stripes', 'numbered', '3'],
  },
  fourCardsD: {
    family: 'cards-columns',
    layoutSummary: '4 block-header cards',
    designSummary: 'Burgundy block header',
    description: 'Four compact cards with solid burgundy header bar containing number + title, then bulleted content below. No icons — tight layout.',
    keywords: ['four', 'cards', 'block', 'numbered', 'bullets', 'simple', '4'],
  },
  fourCardsE: {
    family: 'cards-columns',
    layoutSummary: '4 horizontal stripe rows',
    designSummary: 'Stripe rows',
    description: 'Four full-width horizontal rows stacked vertically. Each has large burgundy number on left, title + description on right. Compact.',
    keywords: ['four', 'cards', 'rows', 'horizontal', 'stripes', 'numbered', '4'],
  },
  numberedRows: {
    family: 'text-bullets',
    layoutSummary: '5 numbered rows with circles',
    designSummary: 'Circle-numbered list',
    description: 'Stacked horizontal rows separated by ruled lines. Each has burgundy circle number, bold title, and description. Ordered lists, steps, ranked items.',
    keywords: ['numbered', 'rows', 'list', 'steps', 'ordered', 'ranked', 'items', 'findings', '5'],
  },
  numberedRowsB: {
    family: 'text-bullets',
    layoutSummary: '5 numbered rows with bands',
    designSummary: 'Alternating-band list',
    description: 'Stacked rows with alternating grey/white backgrounds. Large bold number, title, description. Prioritized lists, action items, findings.',
    keywords: ['numbered', 'rows', 'bands', 'alternating', 'list', 'priority', 'actions', '5'],
  },
  numberedRowsC: {
    family: 'text-bullets',
    layoutSummary: '5 numbered rows with accent',
    designSummary: 'Accent-bar list',
    description: 'Compact rows with left burgundy accent bar. Serif number, title, description. Findings, recommendations, key takeaways.',
    keywords: ['numbered', 'rows', 'accent', 'compact', 'list', 'findings', 'recommendations', '5'],
  },
  kpiMetrics: {
    family: 'kpi-metrics',
    layoutSummary: '2-column KPI grid',
    designSummary: 'Data-focused',
    description: 'Two columns: left has 3 large KPI values with labels, right has 3 detail items. Use for results, performance dashboards, ROI showcases.',
    keywords: ['kpi', 'metrics', 'numbers', 'results', 'performance', 'dashboard', 'roi', 'statistics', 'data'],
  },
  timeline: {
    family: 'timeline-roadmap',
    layoutSummary: 'Horizontal timeline',
    designSummary: 'Connected phases',
    description: 'Horizontal timeline with connected phases, each phase has icon, title, and description. Use for project timelines, history, or phase planning.',
    keywords: ['timeline', 'phases', 'history', 'milestones', 'chronological', 'schedule', 'plan', 'dates'],
  },
  quote: {
    family: 'quote-callout',
    layoutSummary: 'Centered quote box',
    designSummary: 'Elegant emphasis',
    description: 'Large centered quote with quotation marks, attribution below. Use for testimonials, key messages, or impactful statements.',
    keywords: ['quote', 'testimonial', 'message', 'statement', 'citation', 'emphasis', 'highlight'],
  },
  bulletPoints: {
    family: 'text-bullets',
    layoutSummary: 'Vertical bullet list',
    designSummary: 'Clean text',
    description: 'Simple vertical list of bullet points with title and subtitle. Use for lists, talking points, agenda items, or key takeaways.',
    keywords: ['bullets', 'list', 'points', 'text', 'items', 'takeaways', 'talking points'],
  },
  grid2x2: {
    family: 'grid-matrix',
    layoutSummary: '2x2 grid matrix',
    designSummary: 'Quadrant layout',
    description: 'Four equal cells in 2x2 grid, each with title and content. Use for categorization, matrix analysis, or comparing 4 items.',
    keywords: ['grid', 'matrix', '2x2', 'quadrant', 'four', 'categories', 'comparison', '4'],
  },
  comparisonTable: {
    family: 'table-list',
    layoutSummary: 'Multi-column table',
    designSummary: 'Structured table',
    description: 'Table with header row and multiple columns for comparing options. Use for feature comparison, pricing tables, or structured data.',
    keywords: ['table', 'comparison', 'columns', 'features', 'pricing', 'structured', 'data', 'options'],
  },
  processFlow: {
    family: 'process-flow',
    layoutSummary: 'Horizontal arrow flow',
    designSummary: 'Step sequence',
    description: 'Horizontal process with numbered steps connected by arrows. Each step has number, title, and description. Use for workflows, procedures.',
    keywords: ['process', 'flow', 'steps', 'workflow', 'procedure', 'sequence', 'arrows', 'stages'],
  },
  chevronFlow: {
    family: 'process-flow',
    layoutSummary: 'Chevron phases with numbered boxes',
    designSummary: 'Consulting chevron',
    description: 'Professional chevron arrows showing phases with numbered sub-step boxes below each. Consulting-style for project phases, transformation roadmaps, methodologies, implementation approaches.',
    keywords: ['chevron', 'phases', 'consulting', 'mckinsey', 'bcg', 'transformation', 'roadmap', 'methodology', 'approach', 'implementation', 'project', 'stages', 'workstreams'],
  },
  outcomeApproach: {
    family: 'process-flow',
    layoutSummary: 'Horizontal steps with sub-outcomes',
    designSummary: 'Outcome-driven approach',
    description: 'Horizontal rows with main outcome box on left and numbered sub-outcome boxes on right. Hierarchical numbering (1, 1.1, 1.2). Use for outcome-based planning, project approaches, workstreams.',
    keywords: ['outcome', 'approach', 'workstream', 'objectives', 'deliverables', 'numbered', 'hierarchy', 'goals', 'results', 'planning'],
  },
  projectStepDetail: {
    family: 'process-flow',
    layoutSummary: 'Activities and outcomes split',
    designSummary: 'Phase detail view',
    description: 'Split layout with key activities on right and outcomes on left. Detailed view of a single project phase or step. Use for phase breakdowns, workstream details.',
    keywords: ['step', 'detail', 'activities', 'outcomes', 'phase', 'breakdown', 'workstream', 'deliverables', 'tasks'],
  },
  statHighlight: {
    family: 'kpi-metrics',
    layoutSummary: 'Large centered stat',
    designSummary: 'Impact number',
    description: 'Single large statistic in center with context and supporting points. Use to emphasize one key number or result.',
    keywords: ['stat', 'statistic', 'number', 'highlight', 'impact', 'key', 'result', 'single'],
  },
  grid3x2: {
    family: 'cards-columns',
    layoutSummary: '3×2 grid (6 cells)',
    designSummary: '6-item grid',
    description: '3-column by 2-row grid of cells, each with title and description. Use for features, capabilities, benefits, or services overview.',
    keywords: ['grid', '3x2', 'six', 'features', 'capabilities', 'benefits', 'services', 'cells'],
  },
  teamShowcase: {
    family: 'team-people',
    layoutSummary: 'Team member cards',
    designSummary: 'People focused',
    description: 'Cards for team members with photo placeholder, name, title, and bio. Use for team introductions or organizational slides.',
    keywords: ['team', 'people', 'members', 'staff', 'org', 'organization', 'profiles', 'bios'],
  },
  swotAnalysis: {
    family: 'analysis-framework',
    layoutSummary: 'Color-coded 2x2 grid',
    designSummary: '4-quadrant layout',
    description: 'Four color-coded quadrants in a 2x2 grid. Each quadrant has a header and bullet list. Use when content divides into exactly 4 categories.',
    keywords: ['four', 'quadrant', 'grid', '2x2', 'categories', 'four-part', 'color-coded', 'framework', 'matrix'],
  },
  executiveSummary: {
    family: 'summary-recap',
    layoutSummary: 'Numbered executive summary',
    designSummary: 'Numbered section preview',
    description: 'Numbered summary of key sections with titles and descriptions. Each item previews an upcoming slide or section. Use as executive summary, content structure guide, or roadmap.',
    keywords: ['summary', 'executive summary', 'structure', 'outline', 'contents', 'roadmap', 'sections', 'preview'],
  },
  thankYou: {
    family: 'closing-cta',
    layoutSummary: 'Centered thank you',
    designSummary: 'Closing message',
    description: 'Closing slide with thank you message, contact info, and call to action. Use as final slide.',
    keywords: ['thank', 'closing', 'end', 'final', 'contact', 'questions', 'goodbye'],
  },
  roadmapTimeline: {
    family: 'timeline-roadmap',
    layoutSummary: 'Phase roadmap',
    designSummary: 'Project phases',
    description: 'Horizontal roadmap with phases, each phase has title, description, and timeline. Use for project plans, strategic roadmaps.',
    keywords: ['roadmap', 'phases', 'plan', 'project', 'strategy', 'future', 'milestones', 'quarters'],
  },
  executiveSummaryVertical: {
    family: 'summary-recap',
    layoutSummary: 'Summary with highlights',
    designSummary: 'Key points vertical columns',
    description: 'Executive summary with three vertical columns for key findings, recommendations, and outcomes.',
    keywords: ['summary', 'executive', 'overview', 'highlights', 'key', 'recap', 'tldr'],
  },
  executiveSummaryHorizontal: {
    family: 'summary-recap',
    layoutSummary: 'Summary horizontal rows',
    designSummary: 'Key points horizontal',
    description: 'Executive summary with horizontal rows for situation, findings, and next steps.',
    keywords: ['summary', 'executive', 'overview', 'highlights', 'key', 'recap', 'horizontal'],
  },
  prosAndCons: {
    family: 'comparison',
    layoutSummary: 'Two-column dual list',
    designSummary: 'Side-by-side lists',
    description: 'Two balanced columns with icon-marked items. Each item has title and description. Use when content divides into two equal groups.',
    keywords: ['two', 'columns', 'split', 'dual', 'side-by-side', 'left-right', 'balanced', 'versus', 'compare'],
  },
  problemSolution: {
    family: 'comparison',
    layoutSummary: 'Two numbered panels',
    designSummary: 'Split panels with metrics',
    description: 'Two side-by-side panels each with numbered items and a bottom metric. Use when content has two groups of 3 items with quantified summaries.',
    keywords: ['two', 'panels', 'numbered', 'split', 'dual', 'metric', 'groups', 'sections'],
  },
  beforeAfter: {
    family: 'comparison',
    layoutSummary: 'Contrast split with arrow',
    designSummary: 'Left vs right contrast',
    description: 'Two columns with arrow divider. Left items marked ✗, right items marked ✓. Use when content contrasts two sides with 3-4 items each.',
    keywords: ['contrast', 'split', 'two', 'columns', 'arrow', 'left-right', 'compare', 'opposing'],
  },
  valueProposition: {
    family: 'quote-callout',
    layoutSummary: 'Hero statement + pillars',
    designSummary: 'Bold statement with supports',
    description: 'Large hero statement at top with icon, then 3 numbered pillars below each with title, description, and stat. Use when content has one main claim supported by 3 quantified pillars.',
    keywords: ['hero', 'statement', 'pillars', 'bold', 'claim', 'emphasis', 'main-point', 'supporting'],
  },
  strategicInsight: {
    family: 'quote-callout',
    layoutSummary: 'Hero insight with evidence',
    designSummary: 'Premium insight',
    description: 'Premium insight layout with bold hero statement at top, three evidence pillars in middle, and impact strip with metrics at bottom. Use for key findings, recommendations, or investment theses.',
    keywords: ['insight', 'strategic', 'finding', 'recommendation', 'thesis', 'evidence', 'impact', 'key', 'headline', 'hero'],
  },
  nextSteps: {
    family: 'closing-cta',
    layoutSummary: 'Action items list',
    designSummary: 'Checklist style',
    description: 'List of next steps or action items with owners and timelines. Use before closing to define follow-ups.',
    keywords: ['next', 'steps', 'actions', 'follow', 'todo', 'tasks', 'owners', 'timeline', 'checklist'],
  },
  // MBB Consulting Templates
  insightToAction: {
    family: 'summary-recap',
    layoutSummary: 'Key insights to recommendations',
    designSummary: 'Insight-action bridge',
    description: 'Split layout with key insights/findings on left and recommended actions on right. Bridges analysis to recommendations.',
    keywords: ['insight', 'action', 'recommendation', 'finding', 'takeaway', 'implication', 'so what', 'therefore', 'conclude'],
  },
  issueTree: {
    family: 'analysis-framework',
    layoutSummary: 'MECE issue decomposition',
    designSummary: 'Structured tree',
    description: 'Hierarchical issue tree showing MECE breakdown of a problem. Root issue branches into sub-issues. McKinsey problem structuring approach.',
    keywords: ['issue', 'tree', 'mece', 'decomposition', 'problem', 'structure', 'hierarchy', 'breakdown', 'analysis', 'mckinsey', 'hypothesis'],
  },
  workplan: {
    family: 'timeline-roadmap',
    layoutSummary: 'Gantt-style workplan',
    designSummary: 'Project timeline',
    description: 'Horizontal workplan showing workstreams with timeline bars across weeks/months. Project management and consulting engagement planning.',
    keywords: ['workplan', 'gantt', 'project', 'timeline', 'workstream', 'schedule', 'weeks', 'months', 'milestones', 'phases', 'plan'],
  },
  priorityMatrix: {
    family: 'grid-matrix',
    layoutSummary: '2x2 priority matrix',
    designSummary: 'Quadrant analysis',
    description: 'Priority matrix with two axes (e.g., effort vs impact). Items plotted in quadrants. Use for prioritization decisions.',
    keywords: ['priority', 'matrix', '2x2', 'quadrant', 'effort', 'impact', 'value', 'complexity', 'prioritize', 'decision', 'plot'],
  },
  nineBoxMatrix: {
    family: 'grid-matrix',
    layoutSummary: 'GE-McKinsey 9-box',
    designSummary: 'Portfolio matrix',
    description: 'Nine-box matrix for portfolio analysis (like GE-McKinsey). Two axes create 9 cells with color-coded zones.',
    keywords: ['nine', 'box', '9-box', 'ge', 'portfolio', 'matrix', 'strategy', 'business', 'unit', 'invest', 'divest', 'hold'],
  },
  scorecard: {
    family: 'kpi-metrics',
    layoutSummary: 'RAG scorecard',
    designSummary: 'Status tracking',
    description: 'Scorecard with multiple criteria, RAG status indicators, and Harvey balls for progress. Performance tracking and assessment.',
    keywords: ['scorecard', 'rag', 'status', 'red', 'amber', 'green', 'harvey', 'ball', 'progress', 'assessment', 'criteria', 'tracking'],
  },
  barChartExhibit: {
    family: 'exhibit-chart',
    layoutSummary: 'Bar chart with insight',
    designSummary: 'Data comparison',
    description: 'Bar chart exhibit for comparing values across categories. Includes insight title, chart, and source footnotes.',
    keywords: ['bar', 'chart', 'comparison', 'category', 'data', 'exhibit', 'value', 'compare', 'analysis'],
  },
  waterfallChart: {
    family: 'exhibit-chart',
    layoutSummary: 'Waterfall bridge',
    designSummary: 'Value bridge',
    description: 'Waterfall chart showing how value changes from start to end through incremental steps. Revenue bridges, cost waterfalls.',
    keywords: ['waterfall', 'bridge', 'walk', 'delta', 'change', 'increment', 'revenue', 'cost', 'contribution', 'variance'],
  },
  currentFutureState: {
    family: 'comparison',
    layoutSummary: 'Two-column state contrast',
    designSummary: 'Side-by-side with indicators',
    description: 'Two columns with contrasting visual indicators. Left column shows one state, right column shows another. Use when content divides into two contrasting groups of 3-4 items.',
    keywords: ['two', 'columns', 'contrast', 'split', 'state', 'side-by-side', 'comparison', 'dual'],
  },
  recommendationSummary: {
    family: 'summary-recap',
    layoutSummary: 'Numbered card grid',
    designSummary: 'Numbered detail cards',
    description: 'Grid of numbered cards. Each has a number badge, title, description, and highlighted outcome. Supports 2-4 cards. Use for items that each need title + detail + metric.',
    keywords: ['numbered', 'cards', 'grid', 'detail', 'items', 'badges', 'outcomes', 'structured'],
  },
  numberedList: {
    family: 'text-bullets',
    layoutSummary: 'Numbered items',
    designSummary: 'Ordered list',
    description: 'Numbered list with large numbers and supporting text. For ordered steps, ranked items, or sequential points.',
    keywords: ['numbered', 'list', 'ordered', 'steps', 'sequence', 'rank', 'priority', 'count', 'items'],
  },
  customerJourney: {
    family: 'process-flow',
    layoutSummary: 'Horizontal journey stages',
    designSummary: 'Journey map with sentiment',
    description: 'Horizontal stages with touchpoints and sentiment indicators. Maps customer experience across awareness, consideration, purchase, onboarding, retention.',
    keywords: ['customer', 'journey', 'experience', 'touchpoint', 'sentiment', 'funnel', 'awareness', 'retention', 'onboarding', 'cx', 'ux', 'user', 'flow', 'map'],
  },
  optionsRecommendation: {
    family: 'comparison',
    layoutSummary: 'Options grid with recommendation',
    designSummary: 'Decision matrix',
    description: 'Side-by-side option columns evaluated against criteria rows, with one option highlighted as recommended. For decision slides, vendor selection, strategy options.',
    keywords: ['options', 'recommendation', 'decision', 'evaluate', 'criteria', 'vendor', 'selection', 'compare', 'choose', 'alternative', 'best', 'fit'],
  },
  dualCharts: {
    family: 'exhibit-chart',
    layoutSummary: 'Two charts side by side',
    designSummary: 'Dual bar charts with commentary',
    description: 'Two bar charts displayed side by side, each with a commentary box below. For comparing datasets, before/after metrics, regional breakdowns, or year-over-year analysis.',
    keywords: ['dual', 'chart', 'two', 'compare', 'side', 'bar', 'graph', 'before', 'after', 'region', 'year', 'data', 'metrics', 'commentary'],
  },
  qualSlide: {
    family: 'cards-columns',
    layoutSummary: '3-column case study',
    designSummary: 'Situation, How We Helped, Impact columns',
    description: 'Qualification / credential slide with three columns: Situation (anonymized client context), How We Helped (approach), Impact (disguised results). All content must be sanitized for external use.',
    keywords: ['qual', 'qualification', 'credential', 'case study', 'situation', 'impact', 'approach', 'engagement', 'client', 'sanitized', 'anonymized', 'how we helped'],
  },
  // High-density templates (commit 62ad468)
  grid2x3: {
    family: 'grid-matrix',
    layoutSummary: '2×3 grid (6 cells)',
    designSummary: '6-cell grid with headings',
    description: '2-column by 3-row grid of cells, each with heading and description. Taller rows than grid3x2 allow more text per cell. Use for 6 categories, capabilities, workstreams, or feature groups.',
    keywords: ['grid', '2x3', 'six', '6', 'cells', 'categories', 'capabilities', 'features', 'workstreams', 'groups', 'matrix'],
  },
  grid3x3: {
    family: 'grid-matrix',
    layoutSummary: '3×3 grid (9 cells)',
    designSummary: '9-cell compact grid',
    description: '3-column by 3-row grid of 9 compact cells, each with heading and one line. Extremely dense — use when you need to show 9 items at a glance: criteria, categories, segments.',
    keywords: ['grid', '3x3', 'nine', '9', 'cells', 'compact', 'dense', 'categories', 'segments', 'criteria', 'matrix', 'overview'],
  },
  bulletsDense: {
    family: 'text-bullets',
    layoutSummary: '3-col x 4-row grid of numbered cards',
    designSummary: 'High-density card grid with burgundy numbered squares',
    description: 'Grid of 8-15 compact cards (3 columns × 4 rows). Each card: burgundy numbered square + small burgundy title + brief description. Light grey background. Use when you need many ordered items: requirements, checklist, action items, findings, recommendations.',
    keywords: ['dense', 'bullets', 'numbered', 'cards', 'grid', 'many', 'items', 'compact', 'requirements', 'checklist', 'inventory', 'features', 'high-density', '10', '12', '15', 'action items', 'findings'],
  },
  bulletPointsIconGrid: {
    family: 'text-bullets',
    layoutSummary: '2x2 icon grid with numbered badges',
    designSummary: 'Four numbered icon cards',
    description: 'Strict 2x2 grid of 4 icon cards with circular numbered badges. Each card: badge, title, short description. Use for 4 pillars, capabilities, or principles needing equal visual weight.',
    keywords: ['icon', 'grid', '2x2', 'four', '4', 'pillars', 'badges', 'numbered', 'cards', 'capabilities', 'principles', 'key points'],
  },
  iconGrid2x3: {
    family: 'text-bullets',
    layoutSummary: '2x3 icon grid with numbered badges',
    designSummary: 'Six numbered icon cards in 2 columns',
    description: 'Strict 2x3 grid (2 columns, 3 rows) of 6 icon cards with circular numbered badges. Each card: badge, title, short description. Use for 6 pillars, capabilities, or principles.',
    keywords: ['icon', 'grid', '2x3', 'six', '6', 'pillars', 'badges', 'numbered', 'cards', 'capabilities', 'principles', 'key points'],
  },
  twoColumnBoxes: {
    family: 'cards-columns',
    layoutSummary: '2 columns of stacked boxes',
    designSummary: 'Dual column boxes',
    description: 'Two columns with 5-10 stacked boxes each. Column header at top, each box is a single short label. Use for categorized lists, groupings, two-way classification, or sorted items.',
    keywords: ['two', 'column', 'boxes', 'stacked', 'categories', 'groups', 'classification', 'sorted', 'labels', 'dual', 'lists'],
  },
  threeColumnBoxes: {
    family: 'cards-columns',
    layoutSummary: '3 columns of stacked boxes',
    designSummary: 'Triple column boxes',
    description: 'Three columns with 5-10 stacked boxes each at ultra-compact font. Column header at top, each box is a short label. Use for three-way categorization, priority tiers, grouped items.',
    keywords: ['three', 'column', 'boxes', 'stacked', 'categories', 'tiers', 'priority', 'grouped', 'triple', 'labels', 'classification', 'compact'],
  },
  denseTable: {
    family: 'table-list',
    layoutSummary: '10-15 row × 5-6 col data table',
    designSummary: 'Dense data table',
    description: 'High-density data table with 10-15 rows and 5-6 columns at 9px font with zebra striping. Use for detailed data: financial tables, comparison matrices, scoring rubrics, detailed specs.',
    keywords: ['table', 'dense', 'data', 'rows', 'columns', 'financial', 'matrix', 'scoring', 'rubric', 'specs', 'detailed', 'large', 'many', 'zebra'],
  },
};

// =============================================================================
// EMBEDDING CACHE - Stores pre-computed embeddings
// =============================================================================

// In-memory cache for embeddings (would use IndexedDB for persistence)
let embeddingCache = new Map();

/**
 * Build the search text for a template (what gets embedded)
 */
export function buildTemplateSearchText(templateId) {
  const qual = TEMPLATE_QUALIFICATIONS[templateId];
  const template = SLIDE_TEMPLATES[templateId];
  if (!qual || !template) return null;

  const family = TEMPLATE_FAMILIES[qual.family];

  // Combine all searchable text
  return [
    qual.layoutSummary,
    qual.designSummary,
    qual.description,
    qual.keywords.join(' '),
    family?.qualifier || '',
    family?.description || '',
    template.title,
    template.description,
  ].join(' ').toLowerCase();
}

// =============================================================================
// CONTENT-BASED TEMPLATE SUGGESTIONS (no API call needed)
// =============================================================================

/**
 * Extract text content and structural signals from slide HTML.
 */
function analyzeSlideContent(html) {
  if (!html) return { text: '', itemCount: 0, signals: [] };

  // Strip HTML tags to get raw text
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  // Count structural elements
  const cardCount = (html.match(/class=["'][^"']*\bcard\b/gi) || []).length;
  const bulletCount = (html.match(/<li[\s>]/gi) || []).length;
  const kpiCount = (html.match(/class=["'][^"']*kpi/gi) || []).length;
  const gridCellCount = (html.match(/class=["'][^"']*grid-cell/gi) || []).length;
  const tableRowCount = (html.match(/<tr[\s>]/gi) || []).length;
  const timelineCount = (html.match(/class=["'][^"']*timeline/gi) || []).length;
  const processCount = (html.match(/class=["'][^"']*process-step/gi) || []).length;
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length;
  const h4Count = (html.match(/<h4[\s>]/gi) || []).length;

  // Detect content patterns → signals
  const signals = [];
  const numberPattern = /\b\d+[%xX]|\$[\d,.]+[MBKmk]?|\d+\.\d+x\b/g;
  const numbers = text.match(numberPattern) || [];

  if (numbers.length >= 2) signals.push('has-metrics');
  if (cardCount >= 2) signals.push('has-cards');
  if (bulletCount >= 3) signals.push('has-bullets');
  if (kpiCount >= 1) signals.push('has-kpi');
  if (gridCellCount >= 3) signals.push('has-grid');
  if (tableRowCount >= 3) signals.push('has-table');
  if (timelineCount >= 1) signals.push('has-timeline');
  if (processCount >= 2) signals.push('has-process');
  // Detect exec summary structure
  if (/class=["'][^"']*\b(exec-summary|executive-layout|exec-v-|exec-h-)/i.test(html)) {
    signals.push('has-exec-summary');
  }

  // Detect comparison/contrast patterns
  if (/\b(vs\.?|versus|compared|before|after|current|future|pros?|cons?)\b/i.test(text)) {
    signals.push('has-comparison');
  }
  if (/\b(step|phase|stage|workflow|process)\b/i.test(text)) {
    signals.push('has-process-text');
  }
  if (/\b(quarter|q[1-4]|month|week|year|timeline|roadmap|milestone)\b/i.test(text)) {
    signals.push('has-timeline-text');
  }

  // Estimate primary item count from most prominent structure
  const itemCount = Math.max(cardCount, Math.ceil(bulletCount / 1), gridCellCount, h3Count, h4Count) || 0;

  return { text, itemCount, signals, cardCount, bulletCount, h3Count };
}

/**
 * Score a template against slide content. Higher = better fit.
 * Pure client-side: uses keyword overlap + structural matching.
 */
function scoreTemplate(templateId, qual, analysis) {
  let score = 0;
  const { text, itemCount, signals, cardCount } = analysis;

  // 1. Keyword match (weight: 3 per keyword hit)
  for (const kw of qual.keywords) {
    if (text.includes(kw.toLowerCase())) {
      score += 3;
    }
  }

  // 2. Description word overlap (weight: 1 per word)
  const descWords = qual.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  for (const word of descWords) {
    if (text.includes(word)) score += 1;
  }

  // 3. Structural signal matching (weight: 10)
  const family = qual.family;
  if (signals.includes('has-cards') && family === 'cards-columns') score += 10;
  if (signals.includes('has-bullets') && family === 'text-bullets') score += 10;
  if (signals.includes('has-kpi') && family === 'kpi-metrics') score += 10;
  if (signals.includes('has-metrics') && family === 'kpi-metrics') score += 8;
  if (signals.includes('has-grid') && family === 'grid-matrix') score += 10;
  if (signals.includes('has-table') && family === 'table-list') score += 10;
  if (signals.includes('has-timeline') && family === 'timeline-roadmap') score += 10;
  if (signals.includes('has-timeline-text') && family === 'timeline-roadmap') score += 5;
  if (signals.includes('has-process') && family === 'process-flow') score += 10;
  if (signals.includes('has-process-text') && family === 'process-flow') score += 5;
  if (signals.includes('has-comparison') && family === 'comparison') score += 10;
  // Exec summary content → boost exec summary templates
  if (signals.includes('has-exec-summary') && family === 'summary-recap') {
    const execIds = new Set(VARIANT_GROUPS.executiveSummary || []);
    if (execIds.has(templateId)) score += 15;
  }

  // 4. Item count proximity (weight: up to 8)
  if (itemCount > 0) {
    const templateItemCounts = {
      twoCards: 2, twoCardsB: 2, twoCardsC: 2, twoCardsD: 2, twoCardsE: 2,
      threeCards: 3, threeCardsB: 3, threeCardsC: 3, threeCardsD: 3, threeCardsE: 3,
      fourCards: 4, fourCardsB: 4, fourCardsC: 4, fourCardsD: 4, fourCardsE: 4,
      numberedRows: 5, numberedRowsB: 5, numberedRowsC: 5,
      grid2x2: 4, swotAnalysis: 4, bulletPointsIconGrid: 4,
      grid3x2: 6, iconGrid2x3: 6, grid2x3: 6,
      grid3x3: 9,
      prosAndCons: 2, beforeAfter: 2, problemSolution: 2, currentFutureState: 2,
    };
    const expected = templateItemCounts[templateId];
    if (expected) {
      const diff = Math.abs(itemCount - expected);
      if (diff === 0) score += 8;
      else if (diff === 1) score += 5;
      else if (diff === 2) score += 2;
    }
  }

  // 5. Card count bonus for card templates
  if (cardCount >= 2 && family === 'cards-columns') {
    if (cardCount === 2 && templateId.startsWith('twoCard')) score += 6;
    if (cardCount === 3 && templateId.startsWith('threeCard')) score += 6;
    if (cardCount === 4 && templateId.startsWith('fourCard')) score += 6;
  }

  return score;
}

// Templates that are unique / should never suggest switching away from
const UNIQUE_TEMPLATES = new Set(['cover', 'blank', 'thankYou']);

// Detect the content "type" from HTML class names
function detectContentType(html) {
  if (!html) return null;
  if (/class=["'][^"']*\bcover\b/i.test(html) || /class=["'][^"']*\bcover-/i.test(html)) return 'cover';
  if (/class=["'][^"']*\bexec-summary/i.test(html) || /class=["'][^"']*\bexecutive-layout/i.test(html) || /class=["'][^"']*\bexec-v-/i.test(html) || /class=["'][^"']*\bexec-h-/i.test(html)) return 'executiveSummary';
  if (/class=["'][^"']*\bthank-you/i.test(html)) return 'thankYou';
  return null;
}

/**
 * Suggest templates for the given slide HTML content.
 * Returns ranked array of { id, score, reason } (top N).
 *
 * Smart logic:
 * - Unique templates (cover, blank, thankYou): return empty — no switching
 * - Variant siblings (same group): boosted so they appear first
 * - Content-type aware: exec summary content → suggest exec summary variants
 *
 * @param {string} html - The slide's current HTML
 * @param {string|null} currentTemplateId - The slide's current template (excluded from results)
 * @param {number} limit - Max suggestions to return
 * @returns {Array<{id: string, score: number, reason: string}>}
 */
export function suggestTemplatesForContent(html, currentTemplateId = null, limit = 6) {
  // Don't suggest alternatives for unique/singleton templates
  if (currentTemplateId && UNIQUE_TEMPLATES.has(currentTemplateId)) return [];

  const contentType = detectContentType(html);
  // Cover / thankYou content shouldn't suggest switching
  if (contentType === 'cover' || contentType === 'thankYou') return [];

  const analysis = analyzeSlideContent(html);
  if (!analysis.text || analysis.text.length < 20) return [];

  // Pre-compute variant siblings of the current template
  const variantSiblings = new Set(currentTemplateId ? getVariantSiblings(currentTemplateId) : []);

  // If content is executive summary, also treat all exec summary templates as relevant
  const execGroup = new Set(VARIANT_GROUPS.executiveSummary || []);
  const isExecContent = contentType === 'executiveSummary';

  const scored = [];
  for (const [templateId, qual] of Object.entries(TEMPLATE_QUALIFICATIONS)) {
    if (templateId === currentTemplateId) continue;
    // Skip non-content templates from suggestions
    if (UNIQUE_TEMPLATES.has(templateId) || templateId === 'instructionSlide') continue;

    let score = scoreTemplate(templateId, qual, analysis);

    // Boost variant siblings — they're the most natural alternatives
    if (variantSiblings.has(templateId)) {
      score += 25;
    }

    // Boost executive summary templates when current content is exec summary
    if (isExecContent && execGroup.has(templateId)) {
      score += 20;
    }

    if (score > 0) {
      scored.push({ id: templateId, score, reason: qual.layoutSummary });
    }
  }

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Generate embedding for text using OpenAI API
 */
async function generateEmbedding(text, apiKey, apiEndpoint = 'https://api.openai.com/v1/embeddings') {
  const response = await authFetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// =============================================================================
// MAIN API - Template Matching Functions
// =============================================================================

/**
 * Generate embeddings for multiple texts in a batch (more efficient)
 */
async function generateEmbeddingsBatch(texts, apiKey, apiEndpoint = 'https://api.openai.com/v1/embeddings') {
  const response = await authFetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  // OpenAI returns embeddings in same order as input
  return data.data.map(d => d.embedding);
}

/**
 * Get OpenAI API key from settings (needed for embeddings)
 */
function getOpenAIKey(settings) {
  // Embeddings require OpenAI API - check for OpenAI-specific key first
  const openaiKey = settings?.providers?.openai?.apiKey;
  if (openaiKey) {
    console.log('[TemplateEmbeddings] Using OpenAI provider key');
    return openaiKey;
  }

  // Fallback to generic apiKey only if it looks like OpenAI (starts with sk-)
  const genericKey = settings?.apiKey;
  if (genericKey && genericKey.startsWith('sk-')) {
    console.log('[TemplateEmbeddings] Using generic OpenAI key');
    return genericKey;
  }

  // Check if endpoint is OpenAI-compatible
  const endpoint = settings?.providers?.openai?.apiEndpoint || settings?.apiEndpoint;
  if (endpoint && endpoint.includes('openai.com') && genericKey) {
    console.log('[TemplateEmbeddings] Using key with OpenAI endpoint');
    return genericKey;
  }

  return null;
}

/**
 * Initialize embeddings for all templates
 * Uses batch embedding for efficiency (single API call)
 */
export async function initializeTemplateEmbeddings(settings) {
  const apiKey = getOpenAIKey(settings);
  if (!apiKey) {
    console.warn('[TemplateEmbeddings] No OpenAI API key found, using keyword fallback');
    console.warn('[TemplateEmbeddings] Available providers:', Object.keys(settings?.providers || {}));
    return false;
  }

  console.log('[TemplateEmbeddings] Initializing embeddings for templates...');

  const templateIds = Object.keys(TEMPLATE_QUALIFICATIONS);

  // Skip templates already cached
  const toEmbed = templateIds.filter(id => !embeddingCache.has(id));

  if (toEmbed.length === 0) {
    console.log('[TemplateEmbeddings] All templates already cached');
    return true;
  }

  // Build search texts for all templates
  const textsToEmbed = [];
  const idsToEmbed = [];

  for (const templateId of toEmbed) {
    const searchText = buildTemplateSearchText(templateId);
    if (searchText) {
      textsToEmbed.push(searchText);
      idsToEmbed.push(templateId);
    }
  }

  try {
    // Batch embed all templates in one API call
    console.log(`[TemplateEmbeddings] Batch embedding ${textsToEmbed.length} templates...`);
    const embeddings = await generateEmbeddingsBatch(textsToEmbed, apiKey);

    // Store in cache
    for (let i = 0; i < idsToEmbed.length; i++) {
      embeddingCache.set(idsToEmbed[i], embeddings[i]);
    }

    console.log(`[TemplateEmbeddings] Initialized ${embeddingCache.size}/${templateIds.length} templates`);
    return true;
  } catch (err) {
    console.error('[TemplateEmbeddings] Batch embedding failed:', err.message);
    return false;
  }
}

// Track if we've attempted initialization
let initializationAttempted = false;

/**
 * Estimate the number of distinct content items in a user prompt.
 * Uses heuristics: bullet markers, numbered lists, comma-separated phrases,
 * explicit count words ("3 pillars", "four areas"), etc.
 * Returns { count, confidence } where confidence is 'high'|'medium'|'low'.
 */
export function estimateItemCount(text) {
  if (!text) return { count: 0, confidence: 'low' };
  const lower = text.toLowerCase();

  // 1. Explicit number words: "3 pillars", "four key areas", "5 main points"
  const explicitMatch = lower.match(
    /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\b\s+(?:key\s+|main\s+|core\s+|critical\s+|strategic\s+|primary\s+)?(?:pillars?|cards?|areas?|points?|items?|steps?|phases?|themes?|ideas?|drivers?|factors?|metrics?|kpis?|blocks?|categories?|sections?|dimensions?|columns?|rows?|cells?|elements?|findings?|insights?|recommendations?|priorities?|initiatives?|objectives?|principles?|strategies?|options?|approaches?|streams?|components?|capabilities?|enablers?|levers?)\b/
  );
  if (explicitMatch) {
    const numWords = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const n = numWords[explicitMatch[1]] || parseInt(explicitMatch[1], 10);
    if (n >= 1 && n <= 20) return { count: n, confidence: 'high' };
  }

  // 2. Numbered lists: "1. ...", "1) ...", "(1) ..."
  const numberedItems = text.match(/(?:^|\n)\s*(?:\d+[.)]\s|\(\d+\)\s)/g);
  if (numberedItems && numberedItems.length >= 2) {
    return { count: numberedItems.length, confidence: 'high' };
  }

  // 3. Bullet markers: "- item", "• item", "* item"
  const bulletItems = text.match(/(?:^|\n)\s*[•\-\*▪▸►]\s+\S/g);
  if (bulletItems && bulletItems.length >= 2) {
    return { count: bulletItems.length, confidence: 'high' };
  }

  // 4. Colon-separated labels: "Innovation: ...", "Growth: ..."
  const colonItems = text.match(/(?:^|\n)\s*[A-Z][a-zA-Z\s]{1,30}:\s/g);
  if (colonItems && colonItems.length >= 2) {
    return { count: colonItems.length, confidence: 'medium' };
  }

  // 5. Comma-separated list in a single sentence: "A, B, C, and D"
  const commaListMatch = lower.match(/(?:including|such as|like|namely|specifically|covers?|about|discuss)\s+([^.]+)/);
  if (commaListMatch) {
    const parts = commaListMatch[1].split(/,\s*|\s+and\s+|\s+&\s+/).filter(p => p.trim().length > 1);
    if (parts.length >= 2) return { count: parts.length, confidence: 'medium' };
  }

  return { count: 0, confidence: 'low' };
}

/**
 * Compute a penalty/boost for a template based on item count fit.
 * Returns a multiplier (0.5 to 1.2) applied to the embedding similarity.
 * - Perfect match with default: 1.2 boost
 * - Within min-max range: 1.0 (no penalty)
 * - Slightly outside range: 0.7 penalty
 * - Way outside range: 0.5 penalty
 */
function itemCountFitMultiplier(templateId, estimatedCount) {
  if (!estimatedCount || estimatedCount <= 0) return 1.0; // Unknown count, no adjustment

  const flex = getTemplateFlex(templateId);
  if (!flex) return 1.0; // No flex rules, no adjustment

  // Perfect match with default
  if (estimatedCount === flex.default) return 1.15;

  // Within min-max range
  if (estimatedCount >= flex.min && estimatedCount <= flex.max) return 1.05;

  // Slightly outside (1 item off either end)
  if (estimatedCount === flex.min - 1 || estimatedCount === flex.max + 1) return 0.8;

  // Way outside range — significant penalty
  const distance = estimatedCount < flex.min
    ? flex.min - estimatedCount
    : estimatedCount - flex.max;
  return Math.max(0.5, 1.0 - distance * 0.15);
}

/**
 * Search for matching templates using embeddings
 * Returns top N matches sorted by similarity
 * Auto-initializes embeddings on first use
 */
export async function searchTemplatesByEmbedding(query, settings, topN = 3) {
  console.log(`[TemplateEmbeddings] Search query: "${query.substring(0, 80)}..."`);

  const apiKey = getOpenAIKey(settings);

  if (!apiKey) {
    console.log('[TemplateEmbeddings] No OpenAI API key, using keyword fallback');
    return searchTemplatesByKeywords(query, topN);
  }

  // Auto-initialize embeddings on first use
  if (embeddingCache.size === 0 && !initializationAttempted) {
    initializationAttempted = true;
    console.log('[TemplateEmbeddings] Auto-initializing embeddings on first use...');
    await initializeTemplateEmbeddings(settings);
  }

  // If still empty after init attempt, use keywords
  if (embeddingCache.size === 0) {
    console.log('[TemplateEmbeddings] Cache empty after init, using keyword fallback');
    return searchTemplatesByKeywords(query, topN);
  }

  try {
    console.log(`[TemplateEmbeddings] Searching with embeddings (${embeddingCache.size} templates cached)`);

    // Estimate item count from query for item-count-aware scoring
    const { count: estimatedItems, confidence: countConfidence } = estimateItemCount(query);
    if (estimatedItems > 0) {
      console.log(`[TemplateEmbeddings] Estimated ${estimatedItems} items (confidence: ${countConfidence})`);
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query.toLowerCase(), apiKey);

    // Compute similarity with all cached templates, adjusted by item-count fit
    const scores = [];
    for (const [templateId, templateEmbedding] of embeddingCache) {
      const rawSimilarity = cosineSimilarity(queryEmbedding, templateEmbedding);
      // Apply item-count multiplier: boosts templates that fit the item count,
      // penalizes templates with too many/few slots
      const countMultiplier = (estimatedItems > 0 && countConfidence !== 'low')
        ? itemCountFitMultiplier(templateId, estimatedItems)
        : 1.0;
      const adjustedSimilarity = rawSimilarity * countMultiplier;
      scores.push({ templateId, similarity: adjustedSimilarity, rawSimilarity, countMultiplier });
    }

    // Sort by adjusted similarity and return top N
    scores.sort((a, b) => b.similarity - a.similarity);

    // Use more candidates to ensure we don't miss good fits after count adjustment
    const candidatePool = Math.min(scores.length, topN * 2);
    const results = scores.slice(0, candidatePool).map(s => {
      // Scale similarity (typically 0.3-0.9) to confidence (0-100)
      const scaledConfidence = Math.round(Math.max(0, (s.similarity - 0.3) / 0.6) * 100);
      return {
        templateId: s.templateId,
        template: SLIDE_TEMPLATES[s.templateId],
        qualification: TEMPLATE_QUALIFICATIONS[s.templateId],
        similarity: s.similarity,
        rawSimilarity: s.rawSimilarity,
        countMultiplier: s.countMultiplier,
        confidence: Math.min(100, scaledConfidence),
        estimatedItems,
      };
    }).slice(0, topN);

    // Log the results
    console.log('[TemplateEmbeddings] Top matches:');
    results.forEach((r, i) => {
      const countInfo = r.countMultiplier !== 1.0 ? ` [count fit: ×${r.countMultiplier.toFixed(2)}]` : '';
      console.log(`  ${i + 1}. ${r.templateId}: ${r.confidence}% (raw: ${r.rawSimilarity.toFixed(3)})${countInfo} - ${r.qualification?.layoutSummary}`);
    });

    return results;
  } catch (err) {
    console.warn('[TemplateEmbeddings] Embedding search failed:', err.message);
    return searchTemplatesByKeywords(query, topN);
  }
}

// Consulting-specific phrase patterns for smarter matching
const PHRASE_PATTERNS = {
  // Process and methodology
  'project phases': ['chevronFlow', 'processFlow', 'outcomeApproach'],
  'implementation approach': ['chevronFlow', 'outcomeApproach', 'workplan'],
  'transformation roadmap': ['chevronFlow', 'roadmapTimeline', 'workplan'],
  'project plan': ['workplan', 'timeline', 'chevronFlow'],
  'workstream': ['workplan', 'outcomeApproach', 'chevronFlow'],
  'gantt': ['workplan'],

  // Analysis and frameworks
  'issue tree': ['issueTree'],
  'mece': ['issueTree'],
  'problem structure': ['issueTree'],
  'priority matrix': ['priorityMatrix'],
  '2x2': ['priorityMatrix', 'grid2x2'],
  'nine box': ['nineBoxMatrix'],
  '9-box': ['nineBoxMatrix'],
  'portfolio': ['nineBoxMatrix'],
  'swot': ['swotAnalysis'],

  // Data and exhibits
  'bar chart': ['barChartExhibit'],
  'waterfall': ['waterfallChart'],
  'bridge': ['waterfallChart'],
  'exhibit': ['barChartExhibit'],

  // Comparison and state
  'current state': ['currentFutureState'],
  'future state': ['currentFutureState'],
  'as-is': ['currentFutureState'],
  'to-be': ['currentFutureState'],
  'before after': ['beforeAfter', 'currentFutureState'],
  'pros cons': ['prosAndCons'],

  // Summary and recommendations
  'recommendation': ['recommendationSummary', 'insightToAction'],
  'key insight': ['insightToAction', 'strategicInsight'],
  'takeaway': ['insightToAction', 'executiveSummaryVertical'],
  'executive summary': ['executiveSummaryVertical', 'executiveSummaryHorizontal'],
  'so what': ['insightToAction'],

  // Metrics and tracking
  'scorecard': ['scorecard'],
  'rag status': ['scorecard'],
  'kpi': ['kpiMetrics', 'scorecard'],
  'metrics': ['kpiMetrics', 'scorecard'],

  // Process details
  'activities': ['projectStepDetail'],
  'deliverables': ['projectStepDetail', 'outcomeApproach'],
  'phase detail': ['projectStepDetail'],
  'step detail': ['projectStepDetail'],

  // Customer journey
  'customer journey': ['customerJourney'],
  'journey map': ['customerJourney'],
  'touchpoint': ['customerJourney'],
  'user experience': ['customerJourney'],
  'cx map': ['customerJourney'],

  // Options & recommendation
  'options': ['optionsRecommendation'],
  'decision matrix': ['optionsRecommendation'],
  'vendor selection': ['optionsRecommendation'],
  'option analysis': ['optionsRecommendation', 'comparisonTable'],

  // Dual charts
  'two charts': ['dualCharts'],
  'dual chart': ['dualCharts'],
  'side by side chart': ['dualCharts'],
  'compare data': ['dualCharts', 'comparisonTable'],
};

/**
 * Keyword-based fallback search (no API needed)
 * Enhanced with consulting-specific phrase matching
 */
export function searchTemplatesByKeywords(query, topN = 3) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const scores = Object.entries(TEMPLATE_QUALIFICATIONS).map(([templateId, qual]) => {
    const searchText = buildTemplateSearchText(templateId) || '';

    // Count keyword matches
    let matches = 0;
    for (const word of queryWords) {
      if (searchText.includes(word)) matches++;
      // Bonus for keyword array matches
      if (qual.keywords.some(k => k.includes(word) || word.includes(k))) matches += 2;
    }

    // Check for phrase pattern matches (big bonus)
    for (const [phrase, templates] of Object.entries(PHRASE_PATTERNS)) {
      if (queryLower.includes(phrase) && templates.includes(templateId)) {
        matches += 5; // Strong boost for phrase matches
      }
    }

    // Family match bonus
    const family = TEMPLATE_FAMILIES[qual.family];
    if (family && queryLower.includes(family.qualifier.toLowerCase())) {
      matches += 3;
    }

    const similarity = queryWords.length > 0 ? matches / (queryWords.length * 3 + 5) : 0;

    return {
      templateId,
      template: SLIDE_TEMPLATES[templateId],
      qualification: qual,
      similarity: Math.min(similarity, 1),
      confidence: Math.round(Math.min(similarity, 1) * 100),
    };
  });

  scores.sort((a, b) => b.similarity - a.similarity);
  return scores.slice(0, topN);
}

/**
 * GPT-powered final selection from top candidates
 * Takes top 3 matches and uses LLM to pick the best one
 */
export async function selectBestTemplate(userRequest, candidates, settings) {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Resolve provider from settings (array-based registry)
  const providers = Array.isArray(settings?.providers) ? settings.providers : [];
  const modelRef = settings?.fastModel || settings?.model || 'openai:gpt-4o-mini';
  const refIdx = modelRef.indexOf(':');
  const providerId = refIdx !== -1 ? modelRef.slice(0, refIdx) : '';
  const modelName = refIdx !== -1 ? modelRef.slice(refIdx + 1) : modelRef;
  const provider = providers.find(p => p.id === providerId) || providers.find(p => !!p.apiKey);
  const apiKey = provider?.apiKey || settings?.apiKey;

  if (!apiKey) {
    // No API key, return highest similarity match
    return candidates[0];
  }

  const isOpenAI = (provider?.apiUrl || '').includes('api.openai.com');
  const GPT5_NAMES = ['gpt-5', 'gpt-5.1', 'gpt-5.2', 'gpt-5-mini'];
  const isGPT5 = GPT5_NAMES.some(g => modelName.toLowerCase().includes(g.toLowerCase()));
  const useResponsesAPI = isGPT5 && isOpenAI && !provider?.azurePrefix;
  const apiEndpoint = useResponsesAPI
    ? 'https://api.openai.com/v1/responses'
    : provider?.apiUrl || settings?.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
  const actualModel = provider?.azurePrefix ? `azure.${modelName}` : modelName;

  // Estimate item count for smarter selection
  const { count: estimatedItems, confidence: countConf } = estimateItemCount(userRequest);

  // Build compact prompt for selection with item-count awareness
  const candidateDescriptions = candidates.map((c, i) => {
    const flex = getTemplateFlex(c.templateId);
    const capacityHint = flex ? ` [${flex.min}-${flex.max} ${flex.element}s, default ${flex.default}]` : '';
    return `${i + 1}. ${c.templateId}: ${c.qualification.layoutSummary} - ${c.qualification.designSummary}.${capacityHint} ${c.qualification.description.substring(0, 100)}`;
  }).join('\n');

  const itemCountHint = estimatedItems > 0
    ? `\nThe user's content appears to have ~${estimatedItems} distinct items. Prefer templates whose capacity range includes ${estimatedItems}. Do NOT pick a template with more default slots than items — empty slots look bad.`
    : '';

  const systemPrompt = `You are a presentation template selector. Given a user request and template options, pick the BEST match. Consider both semantic fit AND item count fit. Reply with ONLY the number (1, 2, or 3).`;

  const userPrompt = `User wants: "${userRequest}"${itemCountHint}

Options:
${candidateDescriptions}

Best match (1-${candidates.length}):`;

  // Build auth headers — support Azure (api-key), Anthropic (x-api-key), and Bearer
  const authHeaders = { 'Content-Type': 'application/json' };
  const authType = provider?.authType || 'auto';
  const providerUrl = provider?.apiUrl || '';
  if (authType === 'api-key' || (authType === 'auto' && (providerUrl.includes('openai.azure.com') || provider?.azurePrefix))) {
    authHeaders['api-key'] = apiKey;
  } else {
    authHeaders['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    let requestBody;
    if (useResponsesAPI) {
      requestBody = {
        model: actualModel,
        instructions: systemPrompt,
        input: userPrompt,
        max_output_tokens: 16,
        temperature: 0,
      };
    } else {
      requestBody = {
        model: actualModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 5,
        temperature: 0,
      };
    }

    const response = await authFetch(apiEndpoint, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      return candidates[0];
    }

    const data = await response.json();
    let answer;
    if (useResponsesAPI) {
      const output = data.output || [];
      for (const item of output) {
        if (item.type === 'message' && item.content) {
          for (const part of item.content) {
            if ((part.type === 'output_text' || part.type === 'text') && part.text) {
              answer = part.text.trim();
              break;
            }
          }
          if (answer) break;
        }
      }
      answer = answer || data.output_text?.trim() || '1';
    } else {
      answer = data.choices?.[0]?.message?.content?.trim() || '1';
    }
    const selection = parseInt(answer, 10);

    if (selection >= 1 && selection <= candidates.length) {
      console.log(`[TemplateSelection] GPT selected option ${selection}: ${candidates[selection - 1].templateId}`);
      return candidates[selection - 1];
    }
  } catch (err) {
    console.warn('[TemplateSelection] GPT selection failed:', err.message);
  }

  return candidates[0];
}

/**
 * Main API: Find best template for a user request
 * Combines embedding search + GPT selection
 */
export async function findBestTemplate(userRequest, settings) {
  console.log(`[TemplateMatch] Finding template for: "${userRequest.substring(0, 50)}..."`);

  // Step 1: Get top 3 candidates via embedding search
  const candidates = await searchTemplatesByEmbedding(userRequest, settings, 3);

  if (candidates.length === 0) {
    console.log('[TemplateMatch] No candidates found, using default');
    return {
      templateId: 'bulletPoints',
      template: SLIDE_TEMPLATES.bulletPoints,
      qualification: TEMPLATE_QUALIFICATIONS.bulletPoints,
      confidence: 50,
      method: 'default',
    };
  }

  console.log(`[TemplateMatch] Top 3 candidates:`, candidates.map(c => `${c.templateId}(${c.confidence}%)`));

  // Step 2: If top match is very confident (>80%), use it directly
  if (candidates[0].confidence >= 80) {
    console.log(`[TemplateMatch] High confidence match: ${candidates[0].templateId}`);
    const result = { ...candidates[0], method: 'embedding-direct' };
    return randomizeFamilyVariant(result);
  }

  // Step 3: Use GPT to select from top 3
  const selected = await selectBestTemplate(userRequest, candidates, settings);
  const result = { ...selected, method: 'embedding-gpt' };
  return randomizeFamilyVariant(result);
}

/**
 * Randomly swap a selected template for a sibling from the same VARIANT GROUP.
 * Uses VARIANT_GROUPS (tight groups: same item count, different visual style)
 * instead of TEMPLATE_FAMILIES (broad categories that mix different item counts).
 *
 * This adds variety so presentations don't always use threeCards — they might
 * get threeCardsB or threeCardsC. But a threeCards will NEVER become a twoCards.
 *
 * Uses uniform random: each variant in the group has equal probability.
 */
export function randomizeFamilyVariant(result) {
  if (!result?.templateId) return result;

  const siblings = _variantIndex[result.templateId];
  if (!siblings || siblings.length <= 1) return result;

  // Equal weight for all variants in the group
  const pool = siblings.filter(id => SLIDE_TEMPLATES[id]);

  const pick = pool[Math.floor(Math.random() * pool.length)];

  if (pick !== result.templateId) {
    console.log(`[TemplateVariant] Swapped ${result.templateId} → ${pick} (variant group)`);
    return {
      ...result,
      templateId: pick,
      template: SLIDE_TEMPLATES[pick],
      qualification: TEMPLATE_QUALIFICATIONS[pick],
      variantOf: result.templateId,
    };
  }

  return result;
}

/**
 * Get family information for a template
 */
export function getTemplateFamily(templateId) {
  const qual = TEMPLATE_QUALIFICATIONS[templateId];
  if (!qual) return null;

  return {
    familyId: qual.family,
    family: TEMPLATE_FAMILIES[qual.family],
    qualification: qual,
  };
}

/**
 * Get all templates in a family
 */
export function getTemplatesInFamily(familyId) {
  const family = TEMPLATE_FAMILIES[familyId];
  if (!family) return [];

  return family.templates.map(id => ({
    templateId: id,
    template: SLIDE_TEMPLATES[id],
    qualification: TEMPLATE_QUALIFICATIONS[id],
  })).filter(t => t.template);
}

/**
 * Export cache for persistence (e.g., to IndexedDB)
 */
export function exportEmbeddingCache() {
  const data = {};
  for (const [key, value] of embeddingCache) {
    data[key] = value;
  }
  return data;
}

/**
 * Import cache from persistence
 */
export function importEmbeddingCache(data) {
  embeddingCache.clear();
  for (const [key, value] of Object.entries(data)) {
    embeddingCache.set(key, value);
  }
  console.log(`[TemplateEmbeddings] Imported ${embeddingCache.size} embeddings from cache`);
}
