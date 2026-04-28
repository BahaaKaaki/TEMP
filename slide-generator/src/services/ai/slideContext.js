import { SLIDE_TEMPLATES } from '../../utils/slideTemplates';

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

  const allTextLines = getVisibleTextLines(tempDiv);

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

  // Freestyle slides often use arbitrary div/span class names. Fall back to
  // DOM text-node order so router context still sees point labels.
  allTextLines.forEach(text => {
    if (!text || text === title || text === subtitle) return;
    if (contentParts.some(part => normalizeComparableLabel(part) === normalizeComparableLabel(text))) return;
    contentParts.push(text.substring(0, 150));
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

// Format a list of 1-based slide indices as a compact human-readable range.
// Examples: [5] -> "slide 5", [5,6,7] -> "slides 5-7", [5,7,9] -> "slides 5, 7, 9".
function formatSlideIndexRange(indices) {
  if (!indices || indices.length === 0) return '';
  const sorted = [...indices].sort((a, b) => a - b);
  if (sorted.length === 1) return `slide ${sorted[0]}`;
  const contiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  if (contiguous) return `slides ${sorted[0]}-${sorted[sorted.length - 1]}`;
  return `slides ${sorted.join(', ')}`;
}

// Build a compact bracketed tag for a slide's section / subsection labels.
// Returns '' when neither label is present.
function formatSlideSectionTag(slide) {
  const sec = slide?.sectionLabel ? String(slide.sectionLabel).trim() : '';
  const sub = slide?.subSectionLabel ? String(slide.subSectionLabel).trim() : '';
  if (sec && sub) return ` [${sec} / ${sub}]`;
  if (sec) return ` [${sec}]`;
  if (sub) return ` [${sub}]`;
  return '';
}

// Build a section-map block summarizing which slides belong to which
// section/subsection. Returns '' when no slide carries a section label.
// Contiguous runs of the same sectionLabel are merged into one group so
// the output reflects how sections are actually laid out in the deck.
export function buildSectionMap(slides) {
  if (!Array.isArray(slides) || slides.length === 0) return '';
  const hasAnyLabel = slides.some(s => s?.sectionLabel || s?.subSectionLabel);
  if (!hasAnyLabel) return '';

  const groups = [];
  let currentGroup = null;
  slides.forEach((slide, i) => {
    const sec = slide?.sectionLabel ? String(slide.sectionLabel).trim() : '';
    const sub = slide?.subSectionLabel ? String(slide.subSectionLabel).trim() : '';
    const key = sec || '(unsectioned)';
    if (!currentGroup || currentGroup.key !== key) {
      currentGroup = { key, label: sec, slides: [], subs: [] };
      groups.push(currentGroup);
    }
    currentGroup.slides.push(i + 1);
    if (sub) {
      const existing = currentGroup.subs.find(s => s.label === sub);
      if (existing) existing.slides.push(i + 1);
      else currentGroup.subs.push({ label: sub, slides: [i + 1] });
    }
  });

  const lines = ['SECTION MAP:'];
  for (const g of groups) {
    const label = g.label || '(unsectioned)';
    lines.push(`  ${label}: ${formatSlideIndexRange(g.slides)}`);
    for (const sub of g.subs) {
      lines.push(`    - ${sub.label}: ${formatSlideIndexRange(sub.slides)}`);
    }
  }
  // Convention note so the editing model respects how trackers are wired into
  // the deck narrative (one-to-one with the executive summary pillars).
  lines.push('');
  lines.push('SECTION TRACKER CONVENTION:');
  lines.push('  - Section trackers appear as a colored navigation tab on each body slide; they typically mirror the Executive Summary pillars 1:1.');
  lines.push('  - Cover, Executive Summary, Section Divider and Closing slides intentionally carry no tracker — do NOT add one.');
  lines.push('  - The slide subtitle is thematic framing and must differ from the tracker label.');
  lines.push('  - Do NOT rename, renumber, or invent new trackers during an edit — keep the deck\'s section structure stable unless the user explicitly asks to change it.');
  return lines.join('\n');
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

  // Section tracker: preserve the slide's section/subsection framing so the
  // model keeps wording aligned with how the deck advertises this page.
  const sec = current.sectionLabel ? String(current.sectionLabel).trim() : '';
  const sub = current.subSectionLabel ? String(current.subSectionLabel).trim() : '';
  if (sec && sub) positionContext += `\nSECTION: ${sec} / SUBSECTION: ${sub}`;
  else if (sec) positionContext += `\nSECTION: ${sec}`;
  else if (sub) positionContext += `\nSUBSECTION: ${sub}`;

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

  // Full deck structure with summaries (lightweight overview).
  // Per-slide section tags let the model cross-reference each entry with the
  // SECTION MAP below without re-checking, and the map itself gives a
  // whole-deck view of how slides are grouped into sections.
  let deckStructure = '';
  if (includeDeckStructure && total > 1) {
    const structure = slides.map((slide, i) => {
      const marker = i === currentIndex ? '→ ' : '  ';
      const summary = slide.summary || generateSlideSummary(slide.html, slide.type, slide.title);
      return `${marker}${i + 1}. ${summary}${formatSlideSectionTag(slide)}`;
    }).join('\n');
    deckStructure = `\nDECK STRUCTURE:\n${structure}`;

    const sectionMap = buildSectionMap(slides);
    if (sectionMap) {
      deckStructure += `\n\n${sectionMap}`;
    }
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
export function buildDeckContext(existingSlides, storyline = []) {
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

export const CONTEXT_LEVELS = {
  ACTIVE_SLIDE: 'active_slide',
  REFERENCE_SLIDES: 'reference_slides',
  DECK_DIGEST: 'deck_digest',
  FULL_TEXT_DECK: 'full_text_deck',
};

export function normalizeContextLevel(level, fallback = CONTEXT_LEVELS.DECK_DIGEST) {
  return Object.values(CONTEXT_LEVELS).includes(level) ? level : fallback;
}

function cleanStructureText(text) {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/^(?:\d+|[ivx]+)[.)\s:-]+/i, '')
    .replace(/^[-*\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparableLabel(text) {
  return cleanStructureText(text)
    .replace(/^\d+\.\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toShortTrackerTitle(title, fallback = 'Section') {
  const cleaned = cleanStructureText(title) || fallback;
  return cleaned.split(/\s+/).slice(0, 4).join(' ');
}

function formatTrackerLabel(index, title) {
  return `${index + 1}. ${toShortTrackerTitle(title)}`;
}

function getVisibleTextLines(root) {
  if (!root || typeof document === 'undefined') return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (['STYLE', 'SCRIPT', 'NOSCRIPT', 'SVG'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[aria-hidden="true"], .sr-only, .visually-hidden')) return NodeFilter.FILTER_REJECT;
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const lines = [];
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (text) lines.push(text);
  }
  return lines;
}

function isNoiseSummaryLabel(text) {
  const normalized = normalizeComparableLabel(text);
  return !normalized ||
    normalized === 'key message' ||
    normalized === 'executive summary' ||
    normalized === 'summary' ||
    normalized === 'content' ||
    normalized === 'takeaways';
}

function isExecutiveSummarySlide(slide = {}) {
  const haystack = `${slide.templateId || ''} ${slide.type || ''} ${slide.layoutType || ''} ${slide.title || ''}`.toLowerCase();
  if (haystack.includes('executivesummary') ||
    haystack.includes('executive summary') ||
    haystack.includes('exec summary') ||
    haystack.includes('executive')) {
    return true;
  }

  if (!slide.html || typeof document === 'undefined') return false;
  const container = document.createElement('div');
  container.innerHTML = slide.html;
  const subtitle = container.querySelector('.subtitle, .cover-category, h2')?.textContent || '';
  const classNames = Array.from(container.querySelectorAll('[class]'))
    .map(el => el.className)
    .join(' ');
  const textHint = `${subtitle} ${classNames}`.toLowerCase();
  return textHint.includes('executive summary') ||
    textHint.includes('exec summary') ||
    /\bexec[-_\s]?summary\b/.test(textHint);
}

function getTextFromElement(el, selectors) {
  for (const selector of selectors) {
    const found = el.querySelector(selector);
    const text = found?.textContent?.trim();
    if (text) return text;
  }
  return el.textContent?.trim() || '';
}

function extractSummaryItemTitle(node) {
  const titleSelectors = [
    'h3',
    'h4',
    'h5',
    '.agenda-title',
    '.summary-title',
    '.summary-label',
    '.card-title',
    '.item-title',
    '.point-title',
    '.takeaway-title',
    '.factor-title',
    '.pillar-title',
    '.theme-title',
    '.heading',
    '.label',
    '.title',
    'strong',
    'b',
  ];
  const directTitle = cleanStructureText(getTextFromElement(node, titleSelectors));
  if (directTitle && !isNoiseSummaryLabel(directTitle)) return directTitle;

  const lines = getVisibleTextLines(node)
    .map(cleanStructureText)
    .filter(line => line && !isNoiseSummaryLabel(line));

  const standaloneNumberIndex = lines.findIndex(line => /^\d{1,2}$/.test(line));
  if (standaloneNumberIndex >= 0) {
    const nextLine = lines.slice(standaloneNumberIndex + 1).find(line => !/^\d{1,2}$/.test(line));
    if (nextLine) return nextLine;
  }

  const numberedLine = lines.find(line => /^\d{1,2}[.)\s:-]+/.test(line));
  if (numberedLine) return cleanStructureText(numberedLine);

  const conciseLine = lines.find(line => line.split(/\s+/).length <= 10 && line.length <= 90);
  if (conciseLine) return conciseLine;

  return lines[0] || '';
}

function extractNumberedSummaryItemsFromText(slide, slideIndex) {
  if (!slide?.html || typeof document === 'undefined') return [];
  const container = document.createElement('div');
  container.innerHTML = slide.html;
  const lines = getVisibleTextLines(container)
    .map(cleanStructureText)
    .filter(line => line && !isNoiseSummaryLabel(line));

  const items = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    let title = '';
    if (/^\d{1,2}$/.test(current)) {
      title = lines.slice(i + 1).find(line => !/^\d{1,2}$/.test(line)) || '';
    } else {
      const numbered = current.match(/^(\d{1,2})[.)\s:-]+(.+)$/);
      if (numbered) title = numbered[2];
    }

    title = cleanStructureText(title);
    const key = normalizeComparableLabel(title);
    if (!title || title.length < 3 || seen.has(key) || isNoiseSummaryLabel(title)) continue;
    seen.add(key);
    items.push({
      index: items.length,
      slideIndex,
      slideId: slide.id,
      title,
      trackerLabel: formatTrackerLabel(items.length, title),
    });
  }
  return items.slice(0, 12);
}

function extractExecutiveSummaryItems(slide, slideIndex) {
  if (!slide?.html || typeof document === 'undefined') return [];

  const container = document.createElement('div');
  container.innerHTML = slide.html;
  const itemNodes = [
    ...container.querySelectorAll([
      '.exec-section',
      '.exec-v-col',
      '.exec-h-row',
      '.agenda-item',
      '.summary-cell',
      '.summary-card',
      '.summary-item',
      '.takeaway',
      '.takeaway-card',
      '.point',
      '.point-card',
      '.key-point',
      '.factor',
      '.factor-card',
      '.pillar',
      '.pillar-card',
      '.theme',
      '.theme-card',
      '.grid-cell',
      '.card',
      'li',
    ].join(', ')),
  ];

  const seen = new Set();
  const extracted = itemNodes
    .map((node, itemIndex) => {
      const title = cleanStructureText(extractSummaryItemTitle(node));
      if (!title || title.length < 3 || isNoiseSummaryLabel(title)) return null;
      const key = normalizeComparableLabel(title);
      if (!key || seen.has(key)) return null;
      seen.add(key);
      return {
        index: itemIndex,
        slideIndex,
        slideId: slide.id,
        title,
        trackerLabel: formatTrackerLabel(itemIndex, title),
      };
    })
    .filter(Boolean)
    .slice(0, 12);

  if (extracted.length >= 2) {
    return extracted.map((item, index) => ({
      ...item,
      index,
      trackerLabel: formatTrackerLabel(index, item.title),
    }));
  }

  return extractNumberedSummaryItemsFromText(slide, slideIndex);
}

export function buildDeckStructure(slides = []) {
  const safeSlides = Array.isArray(slides) ? slides : [];
  const sectionMap = new Map();
  let executiveSummary = null;

  safeSlides.forEach((slide, index) => {
    if (!executiveSummary && isExecutiveSummarySlide(slide)) {
      executiveSummary = {
        slideIndex: index,
        slideId: slide.id,
        title: slide.title || 'Executive Summary',
        items: extractExecutiveSummaryItems(slide, index),
      };
    }

    if (slide.sectionLabel) {
      const key = slide.sectionLabel;
      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          index: sectionMap.size,
          label: key,
          normalizedLabel: normalizeComparableLabel(key),
          slideIndices: [],
          slideIds: [],
          subSections: [],
        });
      }
      const section = sectionMap.get(key);
      section.slideIndices.push(index);
      section.slideIds.push(slide.id);
      if (slide.subSectionLabel && !section.subSections.includes(slide.subSectionLabel)) {
        section.subSections.push(slide.subSectionLabel);
      }
    }
  });

  const sections = Array.from(sectionMap.values());
  const executiveItems = executiveSummary?.items || [];
  const missingFromTrackers = executiveItems
    .filter((item, index) => {
      const section = sections[index];
      if (!section) return true;
      return section.normalizedLabel !== normalizeComparableLabel(item.trackerLabel) &&
        !section.normalizedLabel.includes(normalizeComparableLabel(item.title));
    })
    .map(item => item.trackerLabel);

  const missingFromExecutiveSummary = sections
    .filter((section, index) => {
      const item = executiveItems[index];
      if (!item) return true;
      const itemLabel = normalizeComparableLabel(item.trackerLabel);
      return section.normalizedLabel !== itemLabel &&
        !section.normalizedLabel.includes(normalizeComparableLabel(item.title));
    })
    .map(section => section.label);

  return {
    executiveSummary,
    sections,
    trackerAlignment: {
      status: executiveItems.length === 0 || sections.length === 0
        ? 'unknown'
        : (missingFromTrackers.length === 0 && missingFromExecutiveSummary.length === 0 ? 'aligned' : 'mismatch'),
      missingFromTrackers,
      missingFromExecutiveSummary,
    },
  };
}

export function planTrackerSyncFromDeckStructures(beforeStructure, afterStructure) {
  const beforeItems = beforeStructure?.executiveSummary?.items || [];
  const afterItems = afterStructure?.executiveSummary?.items || [];
  const beforeSections = beforeStructure?.sections || [];

  if (beforeItems.length === 0 || afterItems.length === 0 || beforeItems.length !== afterItems.length) {
    return [];
  }

  return beforeItems.flatMap((beforeItem, index) => {
    const afterItem = afterItems[index];
    const section = beforeSections[index];
    if (!afterItem || !section || !section.label) return [];

    const newLabel = formatTrackerLabel(index, afterItem.title);
    if (normalizeComparableLabel(section.label) === normalizeComparableLabel(newLabel)) return [];

    return section.slideIds.map(slideId => ({
      slideId,
      oldSectionLabel: section.label,
      newSectionLabel: newLabel,
      reason: `Executive summary item ${index + 1} changed from "${beforeItem.title}" to "${afterItem.title}"`,
    }));
  });
}

export function buildDeckContextDigest(slides = [], options = {}) {
  const {
    activeSlideIndex = -1,
    storyline = [],
    maxContentCharsPerSlide = 500,
    contextLevel = CONTEXT_LEVELS.DECK_DIGEST,
    referenceSlides = [],
  } = options;

  const safeSlides = Array.isArray(slides) ? slides : [];
  const normalizedContextLevel = normalizeContextLevel(contextLevel);
  const referenceSet = new Set((referenceSlides || []).filter(idx => Number.isInteger(idx) && idx >= 0));
  const layoutCounts = {};
  const slideSummaries = safeSlides.map((slide, index) => {
    const template = slide.templateId || slide.layoutType || slide.type || 'custom';
    layoutCounts[template] = (layoutCounts[template] || 0) + 1;
    const slideBudget = normalizedContextLevel === CONTEXT_LEVELS.FULL_TEXT_DECK
      ? Math.max(maxContentCharsPerSlide, 1400)
      : referenceSet.has(index)
        ? Math.max(maxContentCharsPerSlide, 1000)
        : maxContentCharsPerSlide;
    const contentText = extractSlideContentForAI(slide.html || '', {
      maxLength: slideBudget,
      includeStructure: true,
    });
    return {
      index,
      id: slide.id,
      title: slide.title || 'Untitled',
      template,
      type: slide.type || 'custom',
      sectionLabel: slide.sectionLabel || null,
      subSectionLabel: slide.subSectionLabel || null,
      summary: slide.summary || generateSlideSummary(slide.html, slide.type, slide.title),
      textSummary: contentText,
      isEmpty: !slide.html || contentText === '[Empty slide]',
    };
  });

  const layoutSummary = Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([template, count]) => `${template}:${count}`)
    .join(', ');

  const activeSlide = activeSlideIndex >= 0 ? safeSlides[activeSlideIndex] : null;
  const activeSlideContext = activeSlide ? {
    index: activeSlideIndex,
    id: activeSlide.id,
    title: activeSlide.title || 'Untitled',
    template: activeSlide.templateId || activeSlide.layoutType || activeSlide.type || 'custom',
    sectionLabel: activeSlide.sectionLabel || null,
    subSectionLabel: activeSlide.subSectionLabel || null,
    textSummary: extractSlideContentForAI(activeSlide.html || '', {
      maxLength: Math.max(maxContentCharsPerSlide, 700),
      includeStructure: true,
    }),
    previousTitle: activeSlideIndex > 0 ? safeSlides[activeSlideIndex - 1]?.title || 'Untitled' : null,
    nextTitle: activeSlideIndex < safeSlides.length - 1 ? safeSlides[activeSlideIndex + 1]?.title || 'Untitled' : null,
  } : null;

  const referenceSlideContexts = Array.from(referenceSet)
    .map(index => {
      const slide = safeSlides[index];
      if (!slide) return null;
      return {
        index,
        id: slide.id,
        title: slide.title || 'Untitled',
        template: slide.templateId || slide.layoutType || slide.type || 'custom',
        sectionLabel: slide.sectionLabel || null,
        subSectionLabel: slide.subSectionLabel || null,
        textSummary: extractSlideContentForAI(slide.html || '', {
          maxLength: normalizedContextLevel === CONTEXT_LEVELS.FULL_TEXT_DECK ? 1400 : 1000,
          includeStructure: true,
        }),
      };
    })
    .filter(Boolean);

  const enrichedStoryline = Array.isArray(storyline) && storyline.length > 0
    ? storyline.map((point, index) => {
        const slideIndex = point.slideId ? safeSlides.findIndex(s => s.id === point.slideId) : -1;
        const slide = slideIndex >= 0 ? safeSlides[slideIndex] : null;
        const parts = [
          `${index + 1}. ${point.title || slide?.title || 'Untitled'}`,
          point.description ? `Description: ${point.description}` : null,
          point.keyMessage ? `Key: ${point.keyMessage}` : null,
          slide ? `Slide ${slideIndex + 1}: ${slide.title || 'Untitled'}${formatSlideSectionTag(slide)}` : 'No linked slide',
          slide ? `Text: ${extractSlideContentForAI(slide.html || '', { maxLength: 360, includeStructure: false })}` : null,
        ].filter(Boolean);
        return parts.join(' | ');
      }).join('\n')
    : '';

  return {
    slideCount: safeSlides.length,
    contextLevel: normalizedContextLevel,
    slideSummaries,
    layoutSummary,
    sectionMap: buildSectionMap(safeSlides),
    deckStructure: buildDeckStructure(safeSlides),
    referenceSlideContexts,
    storylineSummary: enrichedStoryline || buildStorylineSummary(storyline, false),
    activeSlideContext,
  };
}
