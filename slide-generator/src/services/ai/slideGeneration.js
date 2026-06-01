import { SLIDE_TEMPLATES } from '../../utils/slideTemplates';
import { debugLog, LogLevel } from '../../utils/debugLog';
import { audit } from '../../utils/auditLog';
import { getCredentials } from './models.js';
import { callWithModelFallback } from './apiClient.js';
import { CHART_GEOMETRY_GUIDE, CSS_STYLE_GUIDE, DEFAULT_SYSTEM_PROMPT, TITLE_HEADER_RULES, TYPOGRAPHY_SIZE_GUIDE, getWorkLevelInstructions } from './constants.js';
import { buildFreestyleSystemPrompt } from './freestylePromptBuilder.js';
import { generateSlideSummary, buildDeckContext } from './slideContext.js';
import { currentDateString } from './router.js';
import { LAYOUT_GUIDANCE_MAP } from './imageGeneration.js';
import { applyPromptOverride, appendPromptOverride, recordPromptPayload } from './promptOverrides.js';
import { appendClientDesignContract, buildClientChartGeometryGuide, getActiveClientProfile, getClientProfileFooterBranding, rewritePromptGeometryForClientProfile } from '../../utils/clientDesignProfiles.js';
import { isSlideLayoutPolishEnabled, polishGeneratedSlides } from './slideLayoutPolish.js';
import { normalizeDenseFrameLayoutSlide } from '../../utils/slideFrameLayoutNormalize.js';

// ============================================
// FREESTYLE VALIDATION (brand compliance)
// ============================================

const _HARDCODED_COLOR_RE = /#[0-9a-f]{3,8}\b|rgb\(|rgba\(|hsl\(/gi;
const _ALLOWED_INLINE_LAYOUT = /\b(position|top|left|right|bottom|width|height|display|float|flex|grid|transform)\s*:/i;
const _DESIGN_TOKEN_RE = /var\(--/;
const _CHART_GEOMETRY_CLASS_RE = /\b(chart|waterfall|wf-|bar|column|axis|connector|plot|series|line|gantt|funnel|matrix|quadrant|scatter|baseline)\b/i;

const _BASE_CLASSES = new Set(['slide', 'title', 'subtitle', 'frame', 'footer', 'cover-slide', 'section-divider-slide', 'thank-you-slide', 'master-standard', 'master-default', 'master-blank', 'master-titleOnly', 'master-cover', 'master-emptyPage']);

export function validateFreestyleHTML(html, customCSS) {
  const issues = [];

  const isCover = html.includes('cover-slide');

  // Check slide structure
  if (!/<h1\s[^>]*class="[^"]*\btitle\b/.test(html) && !isCover) {
    issues.push('Missing h1.title — every slide needs an insight-driven headline');
  }
  if (!/<div\s[^>]*class="[^"]*\bframe\b/.test(html) && !isCover && !html.includes('master-blank')) {
    issues.push('Missing div.frame — content must be inside the frame container');
  }

  // Check for hardcoded colors in inline styles (not in <style> blocks — those are OK as long as they use tokens)
  const inlineStyleMatches = html.matchAll(/<[^>]+\sstyle=(["'])([\s\S]*?)\1[^>]*>/gi);
  for (const styleAttr of inlineStyleMatches) {
    const tag = styleAttr[0] || '';
    const value = styleAttr[2] || '';
    const colorMatches = value.match(_HARDCODED_COLOR_RE);
    if (colorMatches) {
      issues.push(`Hardcoded color in inline style: "${colorMatches[0]}" — use var(--token) instead`);
    }
    if (_ALLOWED_INLINE_LAYOUT.test(value) && !_CHART_GEOMETRY_CLASS_RE.test(tag)) {
      issues.push(`Layout property in inline style — move layout CSS to the <style> block`);
    }
  }

  // Check <style> block for hardcoded colors (light check — flag obvious ones)
  if (customCSS) {
    const cssLines = customCSS.split('\n');
    for (const line of cssLines) {
      if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;
      const colorHits = line.match(_HARDCODED_COLOR_RE);
      if (colorHits && !_DESIGN_TOKEN_RE.test(line)) {
        issues.push(`Hardcoded color in CSS: "${colorHits[0]}" — use var(--accent), var(--surface), etc.`);
        break;
      }
    }
  }

  // Check that custom classes in HTML have matching CSS rules
  if (!isCover) {
    const classMatches = html.match(/class="([^"]+)"/g) || [];
    const htmlClasses = new Set();
    for (const match of classMatches) {
      const classes = match.replace('class="', '').replace('"', '').split(/\s+/);
      for (const c of classes) {
        if (c && !_BASE_CLASSES.has(c)) htmlClasses.add(c);
      }
    }
    if (htmlClasses.size > 0 && !customCSS) {
      issues.push(`Missing <style> block — the slide uses custom classes (${[...htmlClasses].slice(0, 4).join(', ')}) but has no scoped CSS. Add a <style> block with rules for all custom classes.`);
    }
  }

  // Check for dark-on-dark contrast violations: accent background without on-accent text
  if (customCSS) {
    const accentBgRe = /background\s*:\s*var\(--accent\)/gi;
    const hasAccentBg = accentBgRe.test(customCSS);
    if (hasAccentBg && !customCSS.includes('var(--on-accent)')) {
      issues.push('Contrast violation: element uses var(--accent) background but text is not set to var(--on-accent). Dark text on a dark maroon background is unreadable — add color: var(--on-accent) to elements with accent backgrounds.');
    }
  }

  // Warn about bare unstyled lists (plain <ul> or <ol> without a styled wrapper)
  if (!isCover) {
    const frameMatch = html.match(/<div[^>]*class="[^"]*\bframe\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<footer/i);
    if (frameMatch) {
      const frameContent = frameMatch[1];
      const hasBareLists = /<(?:ul|ol)(?:\s[^>]*)?>[\s\S]*?<\/(?:ul|ol)>/i.test(frameContent);
      const hasStyledWrapper = /<div\s+class="[^"]+"/i.test(frameContent);
      if (hasBareLists && !hasStyledWrapper) {
        issues.push('Plain unstyled list detected inside .frame — wrap list items in styled cards, use accent borders, or apply a structured list pattern. Do not use bare <ul>/<ol>.');
      }
    }
  }

  return issues;
}

export async function generateSlides(prompt, settings, slideCount = 3, existingSlides = [], templateId = null, customTemplate = null, contextInfo = null, opts = {}) {
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
    activeSystemPrompt = applyPromptOverride(settings, 'slideGen.freestyleSystem', buildFreestyleSystemPrompt(settings));
  } else {
    // Template mode: use full examples
    activeSystemPrompt = applyPromptOverride(settings, 'slideGen.templateSystem', DEFAULT_SYSTEM_PROMPT);
  }
  activeSystemPrompt = appendClientDesignContract(rewritePromptGeometryForClientProfile(activeSystemPrompt, settings), settings);

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
- Use right-footer page numbers starting from ${startingSlideNum}; do not use "X / ${totalSlides}" unless the user explicitly asks for total-page notation`;
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

  const footerBranding = getClientProfileFooterBranding(settings, 'Strategy&');
  const footerLeftInstruction = footerBranding
    ? `left: "${footerBranding}"`
    : 'left: empty string unless a real source or footer label is provided';

  if (isFreestyle && !template) {
    const runtimeSystemContract = [
      `RUNTIME FOOTER CONTRACT:
- Use footer spans as: left ${footerLeftInstruction}, center <span class="source"> for a real source or footnote only, right page number only.
- If no real source exists, keep the source span empty.`,
      getWorkLevelInstructions(settings.workLevelSlide, 'slide'),
      settings.userPreferences
        ? `USER PREFERENCES:
${settings.userPreferences}

Apply these unless the specific user request contradicts them.`
        : '',
    ].filter(Boolean).join('\n\n');

    activeSystemPrompt = `${activeSystemPrompt}\n\n---\n\n${runtimeSystemContract}`;
  }

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

REQUIREMENTS:
${countInstruction}
${coverInstruction}
${contextInfo?.currentSlide ? '- If the user is referencing "this slide" or "this page", they mean the CURRENT SLIDE REFERENCE shown above' : ''}`;
    userPrompt = appendPromptOverride(settings, 'slideGen.freestyleUser', userPrompt);

  } else {
    // === TEMPLATE / NON-FREESTYLE USER PROMPT ===
    const promptIntro = hasLayoutInstructions
      ? `Create a slide about the following content, using a layout that matches the user's intent:

CONTENT AND LAYOUT INTENT: ${contentPart || prompt}
${layoutPart !== contentPart && layoutPart !== prompt ? `LAYOUT DESCRIPTION: ${layoutPart}` : ''}

Follow the DESIGN PROCESS from the guide: count items, pick layout, check budget, fill. If content exceeds the layout budget, split into multiple slides.`
      : `Generate professional presentation slide(s) about: "${prompt}"`;

    const activeProfile = getActiveClientProfile(settings);
    const frameHeight = activeProfile?.layoutContract?.standardContent?.body?.h || 366;
    const chartGeometryGuide = buildClientChartGeometryGuide(settings, CHART_GEOMETRY_GUIDE);

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
- Footer: three spans — ${footerLeftInstruction}, center: <span class="source"> (footnote if citing a source, otherwise empty), right: page number
${contextInfo?.currentSlide ? '- If the user is referencing "this slide" or "this page", they mean the CURRENT SLIDE REFERENCE shown above' : ''}

${chartGeometryGuide}

${TYPOGRAPHY_SIZE_GUIDE}

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
- Only trim content if it physically overflows the ${frameHeight}px frame — and even then, cut the least important parts, don't reword what remains.

Even for PRECISE content, always use CSS components (card-row, split-layout, content-list, grid-2x2, etc.) rather than raw paragraphs or unstyled lists. Structure their content into the layout — each point becomes a card, a list item, a grid cell, etc.
${settings.userPreferences ? `\nUSER PREFERENCES (apply unless contradicted by the specific request above):\n${settings.userPreferences}\n` : ''}
Return the slide(s) as raw HTML, separated by a blank line between each slide.`;
    userPrompt = appendPromptOverride(settings, 'slideGen.templateUser', userPrompt);
  }

  console.groupCollapsed(
    '[SlideGeneration] Full LLM prompt (system: %d chars, user: %d chars)',
    activeSystemPrompt.length, userPrompt.length
  );
  console.groupCollapsed('System prompt (%d chars)', activeSystemPrompt.length);
  console.log(activeSystemPrompt);
  console.groupEnd();
  console.groupCollapsed('User prompt (%d chars)', userPrompt.length);
  console.log(userPrompt);
  console.groupEnd();
  console.groupEnd();

  recordPromptPayload(isFreestyle && !customTemplate ? 'slideGen.freestyleSystem' : 'slideGen.templateSystem', {
    model: settings.model,
    systemPrompt: activeSystemPrompt,
    userPrompt,
    slideCount,
    isFreestyle,
  });

  try {
    let content;

    content = await callWithModelFallback(settings, activeSystemPrompt, userPrompt, opts);

    // Safety check: if AI returned JSON instead of HTML, retry once with clear instruction
    const isJsonResponse = content.trim().startsWith('{') && content.trim().endsWith('}');
    if (isJsonResponse) {
      debugLog(LogLevel.WARN, 'generateSlides', 'AI returned JSON instead of HTML, retrying', { preview: content.slice(0, 200) });

      const retryPrompt = `${userPrompt}

IMPORTANT: You MUST output valid HTML slides. Do NOT return JSON. Generate the slides now using your best judgment. If you don't have specific data, create realistic consulting content.`;

      let retryContent;
      retryContent = await callWithModelFallback(settings, activeSystemPrompt, retryPrompt);
      content = retryContent;
    }

    // Freestyle validation + one-shot correction loop (brand compliance)
    // Gated behind settings.freestyleSelfCorrection (default off) to avoid extra LLM round-trip
    if (isFreestyle && !template && settings.freestyleSelfCorrection) {
      const preStyleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      const preCustomCSS = preStyleMatch
        ? preStyleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '').trim()).join('\n')
        : '';
      const validationIssues = validateFreestyleHTML(content, preCustomCSS);
      if (validationIssues.length > 0) {
        console.log('%c[Freestyle] Validation found %d issue(s), requesting correction',
          'color:#d97706; font-weight:bold', validationIssues.length, validationIssues);

        const correctionPrompt = `The HTML you generated has these issues:
${validationIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Fix ONLY these issues. Keep all content, titles, and structure otherwise unchanged.
Return the corrected <style> block + slide HTML.

Original output:
${content}`;

        try {
          const corrected = await callWithModelFallback(settings, activeSystemPrompt, correctionPrompt);
          const corrStyleMatch = corrected.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
          const corrCSS = corrStyleMatch
            ? corrStyleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '').trim()).join('\n')
            : '';
          const correctedIssues = validateFreestyleHTML(corrected, corrCSS);
          if (correctedIssues.length < validationIssues.length) {
            console.log('%c[Freestyle] Correction resolved %d of %d issues',
              'color:#059669; font-weight:bold',
              validationIssues.length - correctedIssues.length, validationIssues.length);
            content = corrected;
          } else {
            console.log('[Freestyle] Correction did not improve — keeping original');
          }
        } catch (correctionErr) {
          console.warn('[Freestyle] Correction call failed, keeping original:', correctionErr.message?.slice(0, 100));
        }
      } else {
        console.log('%c[Freestyle] Validation passed — no issues found', 'color:#059669');
      }
    }

    // Parse the generated HTML into individual slides
    let slides = parseGeneratedSlides(content);

    if (slides.length === 0) {
      throw new Error('No valid slides were generated. The AI may need more specific instructions. Please try again with more details.');
    }

    // V1 layout polish: fast second pass before the slide is shown (overflow, grids, alignment)
    if (isSlideLayoutPolishEnabled(settings)) {
      slides = await polishGeneratedSlides(slides, settings, {
        instruction: prompt,
        isFreestyle: Boolean(isFreestyle && !template),
      });
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
export function extractDivWithDepth(html, startPos) {
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
export function flattenNestedSlides(html) {
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
export function flattenNestedFrames(html) {
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
export function ensureSlideStructure(html) {
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
  } else {
    footerHtml = '<footer class="footer"><span></span><span></span></footer>';
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
export function extractSingleSlide(content) {
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
    // Strip any preamble text the model may have prepended before the slide div
    const slideStart = cleanContent.search(/<div\s+class=["']slide/i);
    if (slideStart > 0) {
      cleanContent = cleanContent.substring(slideStart);
    }
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

export function parseGeneratedSlides(content) {
  // Clean up the content
  let cleanContent = content
    .replace(/```html\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/```css\n?/g, '')
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

  // Extract <style> blocks into customCSS (freestyle slides may include scoped styles)
  let customCSS = '';
  const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styleMatches = cleanContent.match(styleBlockRegex);
  if (styleMatches) {
    customCSS = styleMatches
      .map(s => s.replace(/<\/?style[^>]*>/gi, '').trim())
      .filter(Boolean)
      .join('\n\n');
    cleanContent = cleanContent.replace(styleBlockRegex, '').trim();
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
      const layoutNorm = normalizeDenseFrameLayoutSlide({ html, customCSS: customCSS || '' });
      return [
        {
          html,
          title,
          type,
          summary: generateSlideSummary(html, type, title),
          ...(layoutNorm.customCSS ? { customCSS: layoutNorm.customCSS } : {}),
        },
      ];
    }
    return [];
  }

  return matches.map((html, index) => {
    let trimmedHtml = html.trim();
    // Extract any per-slide <style> blocks that ended up inside the slide div
    let slideCSS = customCSS;
    const inlineStyles = trimmedHtml.match(styleBlockRegex);
    if (inlineStyles) {
      const extraCSS = inlineStyles
        .map(s => s.replace(/<\/?style[^>]*>/gi, '').trim())
        .filter(Boolean)
        .join('\n\n');
      slideCSS = slideCSS ? `${slideCSS}\n\n${extraCSS}` : extraCSS;
      trimmedHtml = trimmedHtml.replace(styleBlockRegex, '').trim();
    }
    trimmedHtml = ensureSlideStructure(trimmedHtml);
    const title = extractTitle(trimmedHtml) || `Slide ${index + 1}`;
    const type = detectSlideType(trimmedHtml);
    const layoutNorm = normalizeDenseFrameLayoutSlide({
      html: trimmedHtml,
      customCSS: slideCSS || '',
    });
    return {
      html: trimmedHtml,
      title,
      type,
      summary: generateSlideSummary(trimmedHtml, type, title),
      ...(layoutNorm.customCSS ? { customCSS: layoutNorm.customCSS } : {}),
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
    /<div[^>]*class=["'][^"']*section-divider-title[^"']*["'][^>]*>([^<]+)<\/div>/i,
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

export function detectSlideType(html) {
  if (html.includes('cover-slide') || html.includes('cover-title')) return 'cover';
  if (html.includes('card-row')) return 'three-cards';
  if (html.includes('two-col') || html.includes('kpi-block')) return 'kpi';
  if (html.includes('timeline-container')) return 'timeline';
  if (html.includes('quote-box')) return 'quote';
  if (html.includes('content-list')) return 'bullets';
  if (html.includes('grid-2x2')) return 'grid';
  return 'custom';
}
