import { SLIDE_TEMPLATES } from '../../utils/slideTemplates';
import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import { getCredentials } from './models.js';
import { callGeminiAPI } from './apiClient.js';
import { TITLE_HEADER_RULES } from './constants.js';
import { safeJSONParse } from './router.js';
import { extractSlideContentForAI } from './slideContext.js';
import { ensureSlideStructure } from './slideGeneration.js';

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
export function createSkeletonFromTemplate(templateHtml, options) {
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
export function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper for default skeleton HTML
export function getDefaultSkeletonHtml(slideNum, totalSlides, branding = 'Strategy&') {
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
export async function fillSlideWithContent(html, storyPoint, template, settings, previousDesigns = []) {
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
