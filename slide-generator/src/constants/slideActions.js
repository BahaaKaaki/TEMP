export const PRIMARY_ACTIONS = [
  {
    id: 'fix_overflow',
    label: 'Fix Overflow',
    prompt: 'Ensure all content fits within the slide boundaries vertically. Nothing should extend beyond the bottom boundary. Avoid reducing font size unless absolutely necessary. First use spacing, layout, and visual simplification. Preserve meaning and structure as much as possible. DO NOT change any text content. Keep h1, h2, h3, h4 text identical.',
  },
  {
    id: 'fix_overlap',
    label: 'Fix Overlap',
    prompt: 'Resolve any overlap between slide elements while preserving the slide meaning. Use spacing, alignment, resizing non-essential components, simplifying crowded areas, or refining the layout as needed. DO NOT change, remove, or reword any text content. Keep h1, h2, h3, h4 text identical.',
  },
  {
    id: 'make_less_wordy',
    label: 'Less Wordy',
    prompt: 'Reduce the amount of text while preserving the meaning, key terms, and intent of the slide. Remove repetition, tighten wording, and keep only what is necessary.',
  },
  {
    id: 'simplify_slide',
    label: 'Simplify',
    prompt: 'Make the slide easier to understand and less crowded. Reduce complexity, improve structure, simplify visuals, and make the message easier to absorb without changing the core meaning.',
  },
  {
    id: 'make_executive',
    label: 'Executive',
    prompt: 'Rewrite the slide for senior audiences. Lead with the key message and so-what, sharpen the takeaway, reduce unnecessary detail, and make the page more decision-oriented.',
  },
];

export const ARABIC_TRANSLATION_PROMPT = `Translate ALL text content on this slide to Arabic. This includes titles, subtitles, body text, labels, captions, legends, footnotes, and any visible text. Also translate numbers to Arabic-Indic numerals where contextually appropriate. Set dir="rtl" on the root container. Use a clean Arabic font stack: 'Noto Sans Arabic', 'Segoe UI', 'Tahoma', sans-serif. Maintain the visual design, colors, spacing, and hierarchy.

CRITICAL — RTL LAYOUT MIRRORING:
Arabic reads right-to-left. You MUST mirror the entire spatial layout, not just text alignment:
- Flip horizontal alignment: left-aligned becomes right-aligned and vice versa.
- SWAP COLUMNS: If there are two columns (e.g. items 1-3 on the left, items 4-5 on the right), you MUST physically swap them so that items 1-3 appear on the RIGHT and items 4-5 on the LEFT. The first/primary content must be on the right because Arabic readers scan right-to-left.
- For flex layouts: add flex-direction: row-reverse (or swap the HTML order of children).
- For grid layouts: reverse the column order in the HTML or use direction: rtl on the grid container.
- For absolutely positioned elements: swap left offsets to right offsets and vice versa.
- Numbered sequences (1, 2, 3...) must flow right-to-left: item 1 on the far right, last item on the far left.
- Timelines, process flows, and arrows must flow right-to-left.
- Preserve logical relationships — if a label points to a chart, keep that spatial link.

CRITICAL — FOOTER RULES:
The <footer class="footer"> has exactly three <span> children: (1) branding, (2) source, (3) page number.
- Do NOT translate, move, remove, or reorder ANY of the three footer spans.
- Keep the branding span (e.g. "Strategy&") EXACTLY as-is — same text, same position (first span).
- Keep the page number span (third span) as a plain Western numeral — do NOT convert to Arabic-Indic.
- The source span (second, class="source") may be translated if it has content, but keep it in the second position.
- Do NOT add dir="rtl" to the footer — it must remain LTR so branding stays left and page number stays right.

CRITICAL — BRAND NAMES:
Do NOT translate or reorder brand names and proper nouns such as "Strategy&", "PwC", or any company/product names. Keep them in their original Latin-script form. Wrap any Latin-script brand names outside the footer in <span dir="ltr" style="unicode-bidi:isolate"> to prevent RTL character reordering.`;

export const MORE_ACTIONS = [
  {
    category: 'Core Fixes',
    actions: [
      { id: 'reduce_clutter', label: 'Reduce Clutter', prompt: 'Remove non-essential elements that do not materially improve understanding. DO NOT change any text content. Keep h1, h2, h3, h4 text identical.' },
      { id: 'rebalance_layout', label: 'Rebalance Layout', prompt: 'Adjust the layout so the slide feels more balanced and visually well distributed. DO NOT change any text content. Keep h1, h2, h3, h4 text identical.' },
      { id: 'use_space_better', label: 'Use Space Better', prompt: 'Make more efficient use of the available slide area without making it feel cramped. DO NOT change any text content. Keep h1, h2, h3, h4 text identical.' },
    ],
  },
  {
    category: 'Language',
    actions: [
      { id: 'translate_to_arabic', label: 'Translate to Arabic', prompt: ARABIC_TRANSLATION_PROMPT },
    ],
  },
  {
    category: 'Content',
    actions: [
      { id: 'enrich_slide', label: 'Enrich', prompt: 'Add useful clarity, precision, or supporting detail where needed without making it too dense.' },
      { id: 'make_more_informative', label: 'More Informative', prompt: 'Increase explanatory value by adding context, definitions, or supporting detail.' },
      { id: 'make_more_persuasive', label: 'More Persuasive', prompt: 'Strengthen the communication so the slide is more convincing.' },
      { id: 'make_more_commercial', label: 'More Commercial', prompt: 'Orient the slide more toward value, impact, opportunity, and benefits.' },
      { id: 'make_more_strategic', label: 'More Strategic', prompt: 'Elevate the slide from detail to implication and direction.' },
      { id: 'make_more_action_oriented', label: 'More Action-Oriented', prompt: 'Focus the slide on next steps, owners, priorities, or decisions.' },
      { id: 'make_more_analytical', label: 'More Analytical', prompt: 'Strengthen the fact base, structure, and explicit logic of the page.' },
      { id: 'make_more_balanced', label: 'More Balanced', prompt: 'Present a more even-handed view including trade-offs or constraints.' },
      { id: 'make_more_insight_led', label: 'More Insight-Led', prompt: 'Shift from descriptive to insight-driven messaging.' },
    ],
  },
  {
    category: 'Audience',
    actions: [
      { id: 'make_client_ready', label: 'Client-Ready', prompt: 'Polish the slide for external sharing and professional quality.' },
      { id: 'make_board_ready', label: 'Board-Ready', prompt: 'Make the slide concise, high-level, and decision-focused for board audiences.' },
      { id: 'make_appendix_style', label: 'Appendix-Style', prompt: 'Convert the slide into detailed reference material suitable for an appendix.' },
      { id: 'make_working_team', label: 'Working-Team Style', prompt: 'Adapt the slide for practical internal working sessions.' },
    ],
  },
  {
    category: 'Structure',
    actions: [
      { id: 'sharpen_headline', label: 'Sharpen Headline', prompt: 'Rewrite the title into a clearer message-led headline.' },
      { id: 'add_so_what', label: 'Add So-What', prompt: 'Make the implication explicit and clarify why the content matters.' },
      { id: 'improve_flow', label: 'Improve Flow', prompt: 'Reorganize the slide so the logic reads more smoothly.' },
      { id: 'improve_structure', label: 'Improve Structure', prompt: 'Clarify sections, grouping, and layout hierarchy.' },
      { id: 'clarify_labels', label: 'Clarify Labels', prompt: 'Improve headings, captions, and labels so the page is easier to scan.' },
      { id: 'tighten_logic', label: 'Tighten Logic', prompt: 'Strengthen internal logic and consistency. Remove vague or disconnected points.' },
      { id: 'improve_readability', label: 'Improve Readability', prompt: 'Make the page easier to read at a glance.' },
      { id: 'improve_hierarchy', label: 'Improve Hierarchy', prompt: 'Make relative importance more obvious through structure and emphasis.' },
      { id: 'make_scannable', label: 'Make Scannable', prompt: 'Adapt content so a senior reader can grasp it quickly.' },
    ],
  },
  {
    category: 'Data & Visuals',
    actions: [
      { id: 'simplify_table', label: 'Simplify Table', prompt: 'Make the table easier to read by reducing clutter and highlighting essentials. DO NOT change any data values.' },
      { id: 'simplify_chart', label: 'Simplify Chart', prompt: 'Make the chart easier to interpret and strengthen the main message.' },
      { id: 'add_chart_takeaway', label: 'Add Chart Takeaway', prompt: 'Make the chart key message explicit in the title or annotations.' },
      { id: 'highlight_key_numbers', label: 'Highlight Key Numbers', prompt: 'Emphasize the most important figures, comparisons, or movements.' },
      { id: 'make_data_digestible', label: 'Make Data Digestible', prompt: 'Present quantitative information in a way that is easier to absorb quickly.' },
      { id: 'improve_emphasis', label: 'Improve Emphasis', prompt: 'Make the most important content stand out more clearly.' },
      { id: 'increase_whitespace', label: 'Increase Whitespace', prompt: 'Create more breathing room between elements. DO NOT change any text content.' },
      { id: 'align_elements', label: 'Align Elements', prompt: 'Improve consistency of alignment and positioning. DO NOT change any text content.' },
      { id: 'improve_visual_balance', label: 'Improve Visual Balance', prompt: 'Refine the page so no area feels too heavy or too empty. DO NOT change any text content.' },
      { id: 'standardize_formatting', label: 'Standardize Formatting', prompt: 'Make formatting more consistent across text, shapes, and spacing.' },
    ],
  },
  {
    category: 'Transformation',
    actions: [
      { id: 'convert_to_exec_summary', label: 'To Executive Summary', prompt: 'Turn the slide into a concise high-level summary page.' },
      { id: 'convert_to_appendix', label: 'To Appendix', prompt: 'Turn the slide into a supporting-detail page.' },
      { id: 'turn_into_storyline', label: 'To Storyline Slide', prompt: 'Make the page read like part of a clear narrative.' },
      { id: 'turn_into_action', label: 'To Action Slide', prompt: 'Reshape the slide around actions, owners, priorities, or next steps.' },
      { id: 'turn_into_decision', label: 'To Decision Slide', prompt: 'Reshape the slide around a decision, options, rationale, and recommendation.' },
      { id: 'turn_into_issue', label: 'To Issue Slide', prompt: 'Frame the content around a problem, implication, and response.' },
    ],
  },
  {
    category: 'Tone',
    actions: [
      { id: 'make_more_formal', label: 'More Formal', prompt: 'Use a more professional and formal tone.' },
      { id: 'make_sharper', label: 'Sharper', prompt: 'Use crisper and more direct wording.' },
      { id: 'make_more_neutral', label: 'More Neutral', prompt: 'Reduce loaded or overly promotional language.' },
      { id: 'make_more_confident', label: 'More Confident', prompt: 'Use firmer, more assertive language while staying credible.' },
      { id: 'make_more_diplomatic', label: 'More Diplomatic', prompt: 'Soften the wording while preserving the message.' },
    ],
  },
];
