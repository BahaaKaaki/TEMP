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
