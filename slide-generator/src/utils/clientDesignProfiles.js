import { DEFAULT_THEME } from './themeUtils';

export const CLIENT_PROFILE_SCHEMA_VERSION = 1;

export const PROFILE_TEMPLATE_SLOT = {
  DEFAULT: 'default',
};

const STC_THEME = {
  name: 'STC',
  defaultVariant: 'stc_purple_consulting',
  alternateVariants: [
    {
      id: 'editorial_serif_outlook',
      name: 'Editorial serif outlook',
      usage: 'Use only when explicitly generating a sector outlook, white-paper, or editorial title-page style.',
      colors: {
        heading: '#111111',
        kicker: '#A32020',
        meta: '#4A4F57',
        page: '#FFFFFF',
      },
      fonts: {
        title: 'Georgia, "Times New Roman", serif',
        body: 'Arial, sans-serif',
      },
    },
  ],
  colors: {
    accent: '#4F008C',
    accentHover: '#A54EE1',
    accentSoft: '#FBF8FE',
    onAccent: '#FFFFFF',
    heading: '#4F008C',
    body: '#1D252D',
    muted: '#515360',
    page: '#FFFFFF',
    surface: '#FBF8FE',
    surfaceAlt: '#EDD5FF',
    border: '#DBB8F3',
    success: '#00C48C',
    successSoft: '#D9F7EE',
    warning: '#FFDD40',
    warningSoft: '#FFF6CC',
    danger: '#FF375E',
    dangerSoft: '#FFE1E8',
    info: '#1BCED8',
    neutral: '#8E9AA0',
    coverDark: '#28004E',
    kicker: '#FF375E',
    surfaceLilac: '#F2E6FA',
  },
  fonts: {
    title: '"STC Forward"',
    heading: '"STC Forward"',
    body: '"STC Forward"',
  },
  layout: {
    cssVars: {
      '--left-x': '15px',
      '--title-y': '28px',
      '--title-w': '931px',
      '--title-font-size': '24px',
      '--title-font-weight': '400',
      '--title-line-height': '1.15',
      '--subtitle-y': '105px',
      '--subtitle-w': '931px',
      '--subtitle-color': '#FF375E',
      '--subtitle-font-size': '18px',
      '--subtitle-font-weight': '400',
      '--frame-y': '134px',
      '--frame-w': '931px',
      '--frame-h': '340px',
      '--footer-x': '15px',
      '--footer-y': '494px',
      '--footer-bottom': 'auto',
      '--footer-w': '931px',
      '--footer-font-size': '8px',
      '--footer-padding-bottom': '0',
      '--source-x': '15px',
      '--source-y': '494px',
      '--source-w': '465px',
      '--source-h': '19px',
      '--slide-num-x': '935px',
      '--slide-num-y': '519px',
      '--slide-num-w': '14px',
      '--slide-num-h': '10px',
    },
  },
};

const STC_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  },
  standardContent: {
    title: { x: 15, y: 28, w: 931, h: 71 },
    subtitle: { x: 15, y: 105, w: 931, h: 19 },
    body: { x: 15, y: 134, w: 931, h: 340 },
    source: { x: 15, y: 494, w: 465, h: 19 },
    slideNumber: { x: 935, y: 519, w: 14, h: 10 },
    sectionTracker: {
      text: { x: 57, y: 10, w: 300, h: 14 },
    },
  },
  cover: {
    title: { x: 35, y: 292, w: 671, h: 178 },
    footer: { x: 0, y: 520, w: 960, h: 9 },
  },
  denseTableMatrix: {
    contentBand: { x: 15, y: 134, w: 931, h: 336 },
    legendReserveBottomPx: 20,
  },
  orgChartProcess: {
    contentBand: { x: 15, y: 120, w: 931, h: 370 },
    legendPreferredAnchor: 'bottom-right inside content',
  },
};

const STC_FREESTYLE_OVERRIDES = {
  shell: `Default to a 16:9 white STC board template on a 960x540 canvas. These STC positions replace any generic shell defaults:
- Section tracker: keep the STC logo clear. Use text-only tracker chrome at top y=10px, x=57px, 9px text, and color #9E21FF. Do not use arrow or chevron markers.
- h1.title: left 15px, top 28px, width 931px, height about 71px, STC Forward regular 24px, color #4F008C.
- h2.subtitle: left 15px, top 105px, width 931px, height about 19px, STC Forward regular 18px, color #FF375E.
- div.frame: left 15px, top 134px, width 931px, height 340px. Design all custom content inside this STC frame, not the generic 904x366 frame.
- footer: source at bottom-left around x=15 y=494 and slide number bottom-right around x=935 y=519, both STC Forward 8px.
Use structured content in the middle band and keep the bottom footer band clear. Use the standard content bands exactly unless the user explicitly asks for a cover, divider, appendix, or editorial variant.`,
  theme: `Use STC purple (#4F008C) for titles, structural headers, major bars, and primary emphasis. Use tracker lavender (#9E21FF) for section tracker chrome without arrow or chevron markers. Use coral (#FF375E) as the subtitle/kicker accent, vivid lavender (#A54EE1 family) only for small markers, pale lilac surfaces (#EDD5FF to #FBF8FE), charcoal body text (#1D252D), and white backgrounds. Do not let the content topic override the brand palette; even ocean/science topics should remain STC purple/coral/lilac rather than blue-led. Do not use Office blue/orange or raw theme yellow/green/cyan as dominant colors. Treat the serif black/red outlook style as an explicit alternate editorial variant, not the default.`,
  // Testing live: align with base slide-html-generator (executive whitespace, not packed exhibits).
  vibe: `Board-ready, strategy-consulting, precise, modular, high-clarity, low-decoration. Use strong hierarchy, tight alignment, restrained accents, generous white space in the header, balanced structured content in the middle band (avoid crowding; prefer the base generator's executive density guidance), and tiny unobtrusive footer chrome. Avoid playful UI, consumer-product styling, heavy shadows, and decorative gradients except on approved photo covers.`,
  writing: `Write conclusion-led titles. Use short analytical subtitles that name the lens, not the takeaway. Keep copy executive, factual, and directive. Use selective emphasis only for the highest-value words; do not bold every lead phrase by default. Avoid slogans, fluff, generic headings, and marketing language.`,
  css: `Use square-cornered boxes by default, thin 0.75-1.25pt borders, purple header bars, lilac body panels, dark body text, and reversed white text on dark fills. STC Forward reads heavy: use font-weight 400 for body copy, 500 for local headings, card titles, stage titles, labels, and subtitles, and reserve 700 for step numbers, KPIs, or rare emphasis only. Use chevrons, tabs, trackers, and thin connector lines for structure. Avoid default chart palettes, rounded consumer cards, strong shadows, and gradient fills except on photo covers.`,
  pptx: `Export with explicit shape positioning, not theme-only assumptions. Preserve title/subtitle/source/page coordinates, keep logo as a real asset, suppress hidden master placeholders unless intentionally used, maintain footer/page chrome on non-cover slides, and do not surface dormant labels such as Confidential, Public, or Back to Main unless the chosen layout specifically requires them.`,
};

const STC_COMPONENT_PATTERNS = [
  {
    name: 'table',
    structure: 'Purple header bars, light lilac body cells, thin borders, dark text.',
    useWhen: 'Assessments, capability maps, scoring, and comparisons.',
    avoid: ['default PowerPoint blue tables', 'rainbow fills', 'heavy zebra striping'],
  },
  {
    name: 'matrix',
    structure: 'Pale lilac regions with white/lilac cards and clear quadrant or column logic.',
    useWhen: 'Prioritization, feasibility/impact, and portfolio mapping.',
    avoid: ['overfilled quadrants', 'too many accent colors'],
  },
  {
    name: 'numbered_cards',
    structure: 'Repeatable modules with a number marker, short header, and concise text.',
    useWhen: 'Steps, initiatives, priorities, and workstreams.',
    avoid: ['rounded consumer cards', 'drop shadows', 'icon clutter'],
  },
  {
    name: 'process_flow',
    structure: 'Horizontal stages, chevrons, thin arrows, and framed panels.',
    useWhen: 'Frameworks, implementation approaches, and governance sequences.',
    avoid: ['3D arrows', 'connector spaghetti', 'decorative gradients'],
  },
  {
    name: 'org_chart',
    structure: 'Level-coded nodes with thin connectors and a bottom/right legend inside content.',
    useWhen: 'Hierarchy, operating model, and benchmark structures.',
    avoid: ['rainbow org boxes', 'inconsistent level coding'],
  },
  {
    name: 'section_tracker',
    structure: 'Small numbered tabs or breadcrumb strip with one active state.',
    useWhen: 'Repeated multi-part sequences.',
    avoid: ['global use on every slide'],
  },
];

const STC_PPTX_CONTRACT = {
  slideSize: '16:9 widescreen',
  fontPolicy: 'Use STC Forward as the explicit fontFace for every text box. Do not use Arial, Georgia, Calibri, Aptos, or generic fallbacks.',
  logoPolicy: 'Small STC logo top-left on white slides; white/reversed logo on photo covers as needed.',
  sourcePolicy: 'Bottom-left on non-cover slides.',
  pageNumberPolicy: 'Bottom-right on non-cover slides.',
  titlePolicy: 'Top 18 percent band.',
  subtitlePolicy: 'Directly below title in coral.',
  hiddenPlaceholderPolicy: 'Do not surface Confidential, Public, Back to Main, or appendix-return chrome unless explicitly required by the chosen layout.',
  borderWeightPt: { min: 0.75, max: 1.25 },
};

// Live test (2026-05): minimal STC contract so the base slide-html-generator prompt drives
// whitespace and consulting judgment; STC stays mostly tokens + layout appendix + overrides below.
const STC_PROMPT_CONTRACT = `# STC profile — minimal generation contract (testing)

Follow the base Slide HTML Generator for balance, whitespace, contrast (including \`var(--on-accent)\` on dark fills), and executive density. STC-specific additions only:

## Brand and typography
- Use semantic theme tokens only inside \`.slide .frame\` (no ad-hoc hex); active theme encodes STC purple primary, coral subtitle accent, charcoal body, lilac surfaces.
- STC Forward for typography in generated CSS; do not use Georgia or Strategy& maroon styling cues.

## Layout and chrome
- Respect the STC layout contract appended below (title, subtitle, frame, footer bands and tracker placement). Keep tracker text-only and logo-safe as in the CLIENT LAYOUT CONTRACT.

## Avoid
- Strategy& footer branding or maroon-forward palette as the dominant look.
- Yellow as a dominant slide color.
- Random source/legend placement outside the footer band unless part of a structured exhibit inside the frame.`;

function pxRectToInches(rect, canvas = STC_LAYOUT_CONTRACT.canvas) {
  if (!rect || !canvas?.widthPx || !canvas?.widthIn) return null;
  const scale = canvas.widthIn / canvas.widthPx;
  const round = value => Number((value * scale).toFixed(3));
  return {
    x: round(rect.x),
    y: round(rect.y),
    w: round(rect.w),
    h: round(rect.h),
  };
}

const STC_PPTX_FONTS = {
  title: { fontFace: 'STC Forward', fontSize: 24, bold: false },
  subtitle: { fontFace: 'STC Forward', fontSize: 18, bold: false },
  body: { fontFace: 'STC Forward', fontSize: 12, bold: false },
  footer: { fontFace: 'STC Forward', fontSize: 8, italic: false, bold: false, color: '515360' },
  slideNum: { fontFace: 'STC Forward', fontSize: 8, bold: false, color: '515360' },
};

const stcStandardInches = {
  title: { ...pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.title), font: STC_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.subtitle), font: STC_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.body), font: STC_PPTX_FONTS.body },
  footer: { ...pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.source), font: STC_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.slideNumber), font: STC_PPTX_FONTS.slideNum },
  sectionTracker: {
    variant: 'stcBreadcrumb',
    text: {
      ...pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.sectionTracker.text),
      font: { fontFace: 'STC Forward', fontSize: 9, bold: true, color: '9E21FF' },
    },
    colors: { text: '9E21FF', subText: '515360' },
  },
};

const PIF_THEME = {
  name: 'PIF',
  defaultVariant: 'pif_ldc_implementation_guide',
  colors: {
    accent: '#005C4D',
    accentHover: '#00332A',
    accentSoft: '#E5F4EF',
    onAccent: '#FFFFFF',
    heading: '#C3984D',
    body: '#00332A',
    muted: '#7F7F7F',
    page: '#FFFFFF',
    surface: '#FFFCF2',
    surfaceAlt: '#F4EBDD',
    border: '#D9C6A3',
    success: '#02CC99',
    successSoft: '#D4F3EC',
    warning: '#C3984D',
    warningSoft: '#EFE4D2',
    danger: '#B21D41',
    dangerSoft: '#F7E1DD',
    info: '#005A65',
    neutral: '#7F7F7F',
    coverDark: '#00332A',
    kicker: '#C3984D',
    pifGreen: '#005C4D',
    pifDarkGreen: '#00332A',
    pifGold: '#C3984D',
    pifGoldAlt: '#C4995B',
    pifMint: '#02CC99',
  },
  fonts: {
    title: '"Fund Light", "Fund Regular", Arial, sans-serif',
    heading: '"Fund Light", "Fund Regular", Arial, sans-serif',
    body: '"Fund Light", "Fund Regular", Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '35px',
      '--title-y': '27px',
      '--title-w': '597px',
      '--title-font-size': '15px',
      '--title-font-weight': '400',
      '--title-line-height': '1.12',
      '--subtitle-y': '5px',
      '--subtitle-w': '192px',
      '--subtitle-color': '#C3984D',
      '--subtitle-font-size': '8px',
      '--subtitle-font-weight': '400',
      '--frame-y': '81px',
      '--frame-w': '891px',
      '--frame-h': '397px',
      '--footer-x': '35px',
      '--footer-y': '506px',
      '--footer-bottom': 'auto',
      '--footer-w': '891px',
      '--footer-font-size': '8px',
      '--footer-padding-bottom': '0',
      '--source-x': '35px',
      '--source-y': '506px',
      '--source-w': '720px',
      '--source-h': '16px',
      '--slide-num-x': '890px',
      '--slide-num-y': '506px',
      '--slide-num-w': '43px',
      '--slide-num-h': '29px',
    },
  },
};

const PIF_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 10,
    heightIn: 5.625,
  },
  standardContent: {
    logo: { x: 35, y: 23, w: 80, h: 36 },
    title: { x: 132, y: 27, w: 597, h: 25 },
    titleRule: { x: 132, y: 52, w: 597, h: 1 },
    subtitle: { x: 765, y: 5, w: 192, h: 18 },
    body: { x: 35, y: 81, w: 891, h: 397 },
    source: { x: 35, y: 506, w: 720, h: 16 },
    slideNumber: { x: 890, y: 506, w: 43, h: 29 },
    // Centered top tab matching LDC reference deck (slide 22+).
    // Measured from the actual PPTX: pill is x=4.022 y=0.002 w=1.957 h=0.186
    // inches on a 10in canvas — so it sits horizontally centered. Width is
    // auto-fit to the label by resolveTrackerTabs; final x is recomputed from
    // placement: 'center' so any label length stays centered.
    sectionTracker: { x: 0, y: 0, w: 188, h: 18 },
  },
  cover: {
    logo: { x: 34, y: 23, w: 80, h: 36 },
    title: { x: 34, y: 199, w: 667, h: 67 },
    subtitle: { x: 34, y: 273, w: 666, h: 35 },
  },
  stageMatrix: {
    stageRow: { x: 130, y: 82, w: 796, h: 45 },
    rowLabels: { x: 32, w: 92 },
  },
};

const PIF_FREESTYLE_OVERRIDES = {
  shell: `Use the PIF LDC implementation-guide master shell on a 960x540 canvas. These PIF positions replace generic shell defaults:
- PIF logo: x=35, y=23, w=80, h=36.
- h1.title: x=132, y=27, w=597, h=25, Fund Light 15px, PIF Gold #C3984D, with a thin gold rule directly below.
- Do not render a visible h2.subtitle on standard PIF body slides. Router subtitles are planning context only unless the user explicitly asks for a compact in-exhibit label.
- div.frame: x=35, y=81, w=891, h=397. Keep every exhibit, table, matrix, chart, and callout inside this frame.
- footer/source: bottom-left around x=35, y=506; blank by default unless real source text exists.
- page number: bottom-right gold block around x=890, y=506, w=43, h=29 with centered white page number.
Use the LDC content shell for now; treat the DC opportunity-pitch deck as component inspiration, not a second master family.`,
  theme: `Use PIF dark green (#00332A), PIF green (#005C4D), PIF gold (#C3984D/#C4995B), mint (#02CC99), white/light-neutral surfaces, and gray secondary copy. Do not use dormant purple (#5F007F), navy (#28176F), Strategy& maroon, review yellow, or review red as dominant colors. Keep the palette restrained and institutional.`,
  vibe: `Formal sovereign-investment implementation guide, calm, precise, grid-led, dense but legible. Use thin rules, stage matrices, compact rows, green/gold hierarchy, and restrained mint accents. Avoid consumer-product cards, playful icons, heavy shadows, and decorative gradients.`,
  writing: `Write implementation-guide language: direct, specific, and operational. Prefer concise exhibit labels, stage names, decision criteria, and action-oriented titles. Do not turn the page into marketing copy or surface hidden master labels such as National Development Division unless the user explicitly provides them.`,
  css: `Use square-cornered modules, thin green/gold rules, sand or pale-mint fills, dark-green body text, and compact Fund typography. PIF pages have no broad subtitle band; use small in-exhibit labels when needed. Keep source/footer text blank unless a real source is provided.`,
  pptx: `Export on a 10 x 5.625 in canvas using Fund Light/Fund Regular, PIF green/gold colors, the verified LDC geometry, a real top-left PIF logo asset, and the gold page-number block. Keep objects editable, suppress hidden master/review/scratch artifacts, and do not surface dormant labels from the source template.`,
};

const PIF_COMPONENT_PATTERNS = [
  {
    name: 'ldc_stage_matrix',
    structure: 'Gold stage row with left row labels, compact cells, dotted or thin row separators, and green/gold emphasis.',
    useWhen: 'Governance, value-chain, stage-by-stage implementation, and operating-model flows.',
    avoid: ['standalone oversized cards', 'missing row labels', 'content outside the body frame'],
  },
  {
    name: 'opportunity_grid',
    structure: 'Sand tabs or badges, pale mint rows, compact opportunity labels, and thin green/gold rules.',
    useWhen: 'Opportunity-category lists, investment idea inventories, and compact pitch-page content.',
    avoid: ['busy icon grids', 'rainbow categories', 'oversized typography'],
  },
  {
    name: 'opportunity_profile',
    structure: 'Two-column investment profile with dark-green section pills, gray detail copy, and compact KPI rows.',
    useWhen: 'Detailed opportunity or investment profile pages inside the LDC shell.',
    avoid: ['many font sizes', 'heavy footer bars', 'content outside the frame'],
  },
  {
    name: 'question_rows',
    structure: 'Left label, mint divider, and right prompt text in airy horizontal rows.',
    useWhen: 'Discussion guides, interview prompts, and decision questions.',
    avoid: ['bullet walls', 'decorative icons'],
  },
];

const PIF_PPTX_CONTRACT = {
  slideSize: '10 x 5.625 in screen16x9, mapped from 960 x 540 px',
  fontPolicy: 'Use Fund Light for normal title/body text and Fund Regular only for page numbers or limited emphasis. Do not use Aptos, Calibri, Georgia, STC Forward, or generic Office defaults.',
  defaultFontFace: 'Fund Light',
  allowedFontFaces: ['Fund Light', 'Fund Regular', 'Fund Med', 'Fund SemBd'],
  logoPolicy: 'PIF logo top-left on standard content slides.',
  sourcePolicy: 'Footer/source text is blank by default; show source text only when a real source exists.',
  pageNumberPolicy: 'Bottom-right gold page block with centered editable white page number.',
  titlePolicy: 'Content title at x=132 y=27 w=597 h=25 on the 960x540 canvas; Fund Light 11pt in PPTX / 15px in HTML; PIF Gold.',
  subtitlePolicy: 'No visible broad subtitle band on standard PIF body slides. Optional lens labels must be compact in-exhibit labels only.',
  hiddenPlaceholderPolicy: 'Do not surface National Development Division, Arabic labels, Confidential/Public labels, review notes, scratch content, or hidden think-cell artifacts unless explicitly requested.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const PIF_PROMPT_CONTRACT = `# PIF Client Design Contract

## Master
- Use one LDC implementation-guide master shell. Do not invent alternate PIF master families.
- Use the PIF logo at x=35 y=23 w=80 h=36.
- Use the content title at x=132 y=27 w=597 h=25 in PIF Gold, Fund Light, 15px HTML / 11pt PPTX.
- Use the body frame at x=35 y=81 w=891 h=397.
- Use the bottom-right gold page block around x=890 y=506.
- Keep footer/source text blank by default; sources appear only when real source text is provided.
- Do not render h2.subtitle on standard body slides. If the router supplies a subtitle, use it only to understand the requested lens.

## Theme
- Use PIF dark green (#00332A), PIF green (#005C4D), PIF gold (#C3984D/#C4995B), mint (#02CC99), white/light neutrals, and gray secondary text.
- Do not use dormant purple #5F007F, navy #28176F, Strategy& maroon, review yellow, or review red as dominant colors.

## Typography
- Use Fund Light and Fund Regular. Avoid default Office typography.
- Dense body/detail text can be compact; do not solve overflow with oversized cards or alternate shells.

## Components
- Use LDC stage matrix, opportunity grid, opportunity profile, and question-row components only inside the body frame.
- Treat DC opportunity-pitch ideas as body components, not as a second master.
- Do not surface hidden placeholders, scratch pages, review comments, or think-cell artifacts.`;

const PIF_PPTX_FONTS = {
  title: { fontFace: 'Fund Light', fontSize: 11, bold: false, color: 'C3984D' },
  subtitle: { fontFace: 'Fund Light', fontSize: 8, bold: false, color: 'C3984D' },
  body: { fontFace: 'Fund Light', fontSize: 9, bold: false, color: '00332A' },
  footer: { fontFace: 'Fund Light', fontSize: 8, italic: false, bold: false, color: '7F7F7F' },
  slideNum: { fontFace: 'Fund Regular', fontSize: 7, minFontSize: 7, bold: false, color: 'FFFFFF', fill: 'C3984D', align: 'center' },
};

const pifStandardInches = {
  logo: pxRectToInches(PIF_LAYOUT_CONTRACT.standardContent.logo, PIF_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(PIF_LAYOUT_CONTRACT.standardContent.title, PIF_LAYOUT_CONTRACT.canvas), font: PIF_PPTX_FONTS.title },
  titleRule: { ...pxRectToInches(PIF_LAYOUT_CONTRACT.standardContent.titleRule, PIF_LAYOUT_CONTRACT.canvas), color: 'C3984D' },
  subtitle: { ...pxRectToInches(PIF_LAYOUT_CONTRACT.standardContent.subtitle, PIF_LAYOUT_CONTRACT.canvas), font: PIF_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(PIF_LAYOUT_CONTRACT.standardContent.body, PIF_LAYOUT_CONTRACT.canvas), font: PIF_PPTX_FONTS.body },
  footer: { ...pxRectToInches(PIF_LAYOUT_CONTRACT.standardContent.source, PIF_LAYOUT_CONTRACT.canvas), font: PIF_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(PIF_LAYOUT_CONTRACT.standardContent.slideNumber, PIF_LAYOUT_CONTRACT.canvas), font: PIF_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(PIF_LAYOUT_CONTRACT.standardContent.sectionTracker, PIF_LAYOUT_CONTRACT.canvas),
    colors: { fill: '00332A', text: 'FFFFFF', subFill: '005C4D', subText: 'FFFFFF' },
    // Match the LDC reference: Fund Light, ~7.88pt, NOT bold.
    font: { fontFace: 'Fund Light', fontSize: 8, bold: false },
    placement: 'center',
    canvasW: PIF_LAYOUT_CONTRACT.canvas.widthIn, // 10in — pill centers on this width, not Strategy&'s 13.333
    align: 'center',
    paddingX: 0.32,
    textInset: 0.08,
  },
};

const FYA_THEME = {
  name: 'FYA',
  defaultVariant: 'fya_warm_institutional',
  colors: {
    accent: '#CE9C3E',
    accentHover: '#92732A',
    accentSoft: '#EFE4C8',
    onAccent: '#000000',
    heading: '#000000',
    body: '#111111',
    muted: '#6F6A5F',
    page: '#F9F7ED',
    surface: '#F9F7ED',
    surfaceAlt: '#F0E8D8',
    border: '#D8C890',
    success: '#3F8E50',
    successSoft: '#E5F0E2',
    warning: '#CE9C3E',
    warningSoft: '#EFE4C8',
    danger: '#D83731',
    dangerSoft: '#F3D8D4',
    info: '#92732A',
    neutral: '#767171',
    coverDark: '#6E4527',
    kicker: '#CE9C3E',
    fyaGold: '#CE9C3E',
    fyaGreen: '#3F8E50',
    fyaRed: '#D83731',
    fyaBrown: '#6E4527',
    fyaSand: '#F0E8D8',
  },
  fonts: {
    title: 'Poppins, Arial, sans-serif',
    heading: 'Poppins, Arial, sans-serif',
    body: 'Poppins, Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '26px',
      '--title-y': '41px',
      '--title-w': '867px',
      '--title-font-size': '22px',
      '--title-font-weight': '400',
      '--title-line-height': '1.18',
      '--subtitle-y': '119px',
      '--subtitle-w': '867px',
      '--subtitle-color': '#CE9C3E',
      '--subtitle-font-size': '18px',
      '--subtitle-font-weight': '400',
      '--frame-y': '145px',
      '--frame-w': '904px',
      '--frame-h': '350px',
      '--footer-x': '26px',
      '--footer-y': '500px',
      '--footer-bottom': 'auto',
      '--footer-w': '904px',
      '--footer-font-size': '8px',
      '--footer-padding-bottom': '0',
      '--source-x': '190px',
      '--source-y': '500px',
      '--source-w': '560px',
      '--source-h': '14px',
      '--slide-num-x': '792px',
      '--slide-num-y': '511px',
      '--slide-num-w': '138px',
      '--slide-num-h': '12px',
    },
  },
};

const FYA_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  },
  standardContent: {
    logo: { x: 26, y: 500, w: 139, h: 26 },
    title: { x: 26, y: 41, w: 867, h: 56 },
    subtitle: { x: 26, y: 119, w: 867, h: 19 },
    body: { x: 26, y: 145, w: 904, h: 350 },
    source: { x: 190, y: 500, w: 560, h: 14 },
    date: { x: 820, y: 500, w: 110, h: 14 },
    slideNumber: { x: 792, y: 511, w: 138, h: 12 },
    sectionTracker: { x: 0, y: 0, w: 134, h: 17 },
  },
  cover: {
    logo: { x: 26, y: 500, w: 139, h: 26 },
    title: { x: 26, y: 92, w: 860, h: 95 },
    subtitle: { x: 26, y: 202, w: 760, h: 28 },
  },
};

const FYA_FREESTYLE_OVERRIDES = {
  shell: `Use the Federal Youth Authority (FYA) warm institutional master on a 960x540 canvas. These FYA positions replace generic shell defaults:
- h1.title: left 26px, top 41px, width about 867px, Poppins regular, 22px, black, compact institutional headline.
- h2.subtitle: left 26px, top 119px, width about 867px, Poppins regular 18px, FYA gold #CE9C3E.
- div.frame: left 26px, top 145px, width 904px, height 350px. Keep exhibits inside this body frame.
- Footer/source/date/page chrome sits in the bottom band around y=500–526. Keep all content clear of the bottom footer band.
- FYA logo appears bottom-left; do not use Strategy& footer branding on FYA slides.
Use the FYA standard content slide as the default. Cover/divider variants are allowed only when explicitly requested.`,
  theme: `Use FYA warm cream (#F9F7ED), gold (#CE9C3E), green (#3F8E50), brown (#6E4527), red (#D83731), sand neutrals, and black text. Keep the page warm and institutional. Do not use Strategy& maroon, STC purple/coral, PIF green/gold combinations, or DGE blue as the dominant palette.`,
  vibe: `Federal government youth-agenda style: optimistic, warm, official, structured, and polished. Use rounded institutional panels, warm sand surfaces, compact tables, gold rules, and restrained iconography. Avoid dark consulting slides, generic SaaS dashboards, neon gradients, and playful consumer cards.`,
  writing: `Write in concise government-strategy language for youth policy, engagement, governance, initiatives, and national agenda content. Keep labels short and executive.`,
  css: `Use Poppins throughout. Prefer warm cream backgrounds, gold dividers, green or red status accents, and subtle brown icon strokes. Keep borders thin and modules clean.`,
  pptx: `Export on a 13.333 x 7.5 in canvas using Poppins, FYA warm cream/gold/green/brown/red palette, the bundled FYA master, bottom-left FYA logo asset, editable footer/page chrome, and no Strategy& branding.`,
};

const FYA_COMPONENT_PATTERNS = [
  {
    name: 'pillar_cards',
    structure: 'Warm rounded cards with gold heading strips, compact body copy, and brown or gold icons.',
    useWhen: 'Youth pillars, initiatives, strategic priorities, and policy themes.',
    avoid: ['cold gray cards', 'Strategy& maroon bars', 'oversized decorative icons'],
  },
  {
    name: 'engagement_map',
    structure: 'Structured stakeholder bands or swimlanes using gold separators, green highlights, and warm neutral panels.',
    useWhen: 'Stakeholder engagement, phase planning, governance, and consultation flows.',
    avoid: ['rainbow stakeholder colors', 'dense unbounded lists', 'content in footer band'],
  },
  {
    name: 'governance_matrix',
    structure: 'Compact matrix with warm cream cells, gold rules, black headings, and green/red responsibility markers.',
    useWhen: 'Governance structures, cadence, roles, approvals, and decision rights.',
    avoid: ['blue government palette', 'PIF dark green master', 'large empty generic cards'],
  },
];

const FYA_PPTX_CONTRACT = {
  slideSize: { w: 13.333, h: 7.5 },
  defaultFontFace: 'Poppins',
  allowedFontFaces: ['Poppins'],
  logoPolicy: 'FYA logo bottom-left on standard slides.',
  sourcePolicy: 'Use footer/source text only when real source text exists; keep it compact in the bottom band.',
  pageNumberPolicy: 'Bottom-right page number/date chrome in Poppins, dark neutral text.',
  titlePolicy: 'Content title at x=26 y=41 w=867 on the 960x540 canvas, Poppins SemiBold, black.',
  subtitlePolicy: 'Use a compact gold subtitle at x=26 y=119 when the slide has a meaningful lens label; otherwise keep the body frame aligned to the standard band.',
  hiddenPlaceholderPolicy: 'Do not surface hidden template scratch content, think-cell artifacts, or unrelated stakeholder logos unless explicitly part of the requested content.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const FYA_PROMPT_CONTRACT = `# FYA Client Design Contract

## Master
- Use one Federal Youth Authority warm institutional master shell. Do not invent a Strategy&, STC, PIF, or DGE variant.
- Use the body frame at x=26 y=145 w=904 h=350 on the 960x540 canvas.
- Keep the bottom footer/logo/date/page band clear.
- Do not render Strategy& footer branding.

## Theme
- Use FYA warm cream (#F9F7ED), gold (#CE9C3E), green (#3F8E50), brown (#6E4527), red (#D83731), sand neutrals, and black text.
- Avoid blue-led, purple-led, or maroon-led slide systems.

## Typography
- Use Poppins for title, headings, labels, and body copy.
- Keep titles compact and official; use dense but legible exhibit copy.

## Components
- Prefer pillar cards, engagement maps, governance matrices, phase plans, compact timelines, and stakeholder grids inside the body frame.
- Use warm neutral panels, thin gold rules, green/red status markers, and restrained brown/gold icons.`;

const FYA_PPTX_FONTS = {
  title: { fontFace: 'Poppins', fontSize: 22, bold: false, color: '000000' },
  subtitle: { fontFace: 'Poppins', fontSize: 18, bold: false, color: 'CE9C3E' },
  body: { fontFace: 'Poppins', fontSize: 10, bold: false, color: '111111' },
  footer: { fontFace: 'Poppins', fontSize: 8, italic: false, bold: false, color: '6F6A5F' },
  slideNum: { fontFace: 'Poppins', fontSize: 8, bold: false, color: '6F6A5F' },
};

const fyaStandardInches = {
  logo: pxRectToInches(FYA_LAYOUT_CONTRACT.standardContent.logo, FYA_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(FYA_LAYOUT_CONTRACT.standardContent.title, FYA_LAYOUT_CONTRACT.canvas), font: FYA_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(FYA_LAYOUT_CONTRACT.standardContent.subtitle, FYA_LAYOUT_CONTRACT.canvas), font: FYA_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(FYA_LAYOUT_CONTRACT.standardContent.body, FYA_LAYOUT_CONTRACT.canvas), font: FYA_PPTX_FONTS.body },
  footer: { ...pxRectToInches(FYA_LAYOUT_CONTRACT.standardContent.source, FYA_LAYOUT_CONTRACT.canvas), font: FYA_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(FYA_LAYOUT_CONTRACT.standardContent.slideNumber, FYA_LAYOUT_CONTRACT.canvas), font: FYA_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(FYA_LAYOUT_CONTRACT.standardContent.sectionTracker, FYA_LAYOUT_CONTRACT.canvas),
    colors: { fill: 'CE9C3E', subFill: '92732A', text: '000000', subText: 'FFFFFF' },
    font: { fontFace: 'Poppins', fontSize: 8, bold: true },
    paddingX: 0.18,
    textInset: 0.05,
  },
};

const DGE_THEME = {
  name: 'DGE',
  defaultVariant: 'dge_blue_brand',
  // Palette anchored to the visible blues in the native DGE master (DGE page_v1.0.pptx).
  // The dominant header/section bands use a gradient #2A70AD -> #005393 -> #00437B.
  // We pick the middle stop #005393 as the single primary brand blue (closest match to the
  // perceived gradient color), with #00437B as deepest navy and #2A70AD as the bright top.
  // #203864 also appears in chrome shapes but is darker than the visible bands; keep it as
  // a secondary chrome accent only.
  colors: {
    accent: '#005393',
    accentHover: '#00437B',
    accentSoft: '#E8EEF5',
    onAccent: '#FFFFFF',
    // Native DGE writes text in black or white only — blue is reserved for fills/bands.
    heading: '#000000',
    body: '#000000',
    muted: '#4A5568',
    page: '#FFFFFF',
    surface: '#F2F2F2',
    surfaceAlt: '#E7E6E6',
    border: '#7DA1C4',
    success: '#005393',
    successSoft: '#D4E2F0',
    warning: '#2A70AD',
    warningSoft: '#E8EEF5',
    danger: '#B21D41',
    dangerSoft: '#F7E1DD',
    info: '#7DA1C4',
    neutral: '#6B7280',
    coverDark: '#00437B',
    // Subtitle / kicker text is also black in native DGE; the bright blue is for fills only.
  kicker: '#000000',
    /** Native primary brand blue — middle gradient stop, dominant visible blue on bands */
    dgePrimaryBlue: '#005393',
    /** Bright top of the native band gradient */
    dgeBrightBlue: '#2A70AD',
    /** Deepest gradient stop — covers and darkest fills */
    dgeDeepNavy: '#00437B',
    /** Secondary chrome navy used in small structural shapes */
    dgeChromeBlue: '#203864',
    dgeStructuralBlue: '#32516E',
    dgeLightBlue: '#7DA1C4',
    dgeHighlightBlue: '#A6CAEC',
  },
  fonts: {
    title: '"Noto Sans", "Noto Kufi Arabic", "Segoe UI", Arial, sans-serif',
    heading: '"Noto Sans", "Noto Kufi Arabic", "Segoe UI", Arial, sans-serif',
    body: '"Noto Sans", "Noto Kufi Arabic", "Segoe UI", Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '33px',
      '--title-y': '30px',
      '--title-w': '660px',
      '--title-font-size': '30px',
      '--title-font-weight': '400',
      '--title-line-height': '1.15',
      '--subtitle-y': '108px',
      '--subtitle-w': '660px',
      '--subtitle-color': '#000000',
      '--subtitle-font-size': '12px',
      '--subtitle-font-weight': '500',
      '--frame-y': '112px',
      '--frame-w': '894px',
      '--frame-h': '371px',
      '--footer-x': '33px',
      '--footer-y': '493px',
      '--footer-bottom': 'auto',
      '--footer-w': '894px',
      '--footer-font-size': '9px',
      '--footer-padding-bottom': '0',
      '--source-x': '33px',
      '--source-y': '493px',
      '--source-w': '79px',
      '--source-h': '18px',
      '--slide-num-x': '900px',
      '--slide-num-y': '493px',
      '--slide-num-w': '40px',
      '--slide-num-h': '18px',
    },
  },
};

const DGE_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  },
  standardContent: {
    // Lockup matched to the native DGE master (DGE page_v1.0.pptx slide 1):
    // x≈763 y≈31 w≈164 h≈38 px. The bundled PNG is the verbatim native image3.png
    // (2000x468, ratio 4.274) and the band aspect (164/38 = 4.316) is the closest
    // PowerPoint-pixel approximation, so PptxGenJS stretch leaves no visible band.
    logo: { x: 763, y: 31, w: 164, h: 38 },
    title: { x: 33, y: 30, w: 660, h: 72 },
    subtitle: { x: 33, y: 108, w: 660, h: 0 },
    // With standard DGE subtitles suppressed, body starts higher while still
    // clearing two-line titles and the top-right lockup.
    body: { x: 24, y: 112, w: 912, h: 371 },
    source: { x: 33, y: 493, w: 79, h: 18 },
    slideNumber: { x: 900, y: 493, w: 40, h: 18 },
    /** Top-of-slide tab strip (HTML ::before/::after + PPTX addSectionTracker) */
    sectionTracker: { x: 0, y: 0, w: 480, h: 22 },
  },
  heroCover: {
    heroImageBand: { x: 0, y: 0, w: 960, h: 325 },
    title: { x: 33, y: 345, w: 437, h: 46 },
    subtitle: { x: 33, y: 430, w: 203, h: 32 },
    meta: { x: 33, y: 493, w: 110, h: 18 },
    brandLockup: { x: 763, y: 450, w: 164, h: 38 },
    classificationStrip: { x: 0, y: 526, w: 960, h: 14 },
  },
  sectionDivider: {
    topImageBand: { x: 0, y: 0, w: 960, h: 319 },
    sectionLabel: { x: 33, y: 345, w: 210, h: 80 },
  },
  timeline: {
    title: { x: 33, y: 30, w: 244, h: 44 },
    subtitle: { x: 33, y: 75, w: 64, h: 22 },
    railY: 146,
    cardGroups: [
      { x: 38, y: 184, w: 185, h: 271 },
      { x: 264, y: 184, w: 185, h: 271 },
      { x: 501, y: 184, w: 185, h: 271 },
      { x: 733, y: 184, w: 185, h: 271 },
    ],
  },
  imagePanel: {
    panel: { x: 524, y: 107, w: 404, h: 327 },
    panelTitle: { x: 554, y: 168, w: 344, h: 44 },
    panelBody: { x: 552, y: 233, w: 336, h: 160 },
  },
};

const DGE_FREESTYLE_OVERRIDES = {
  shell: `DGE Abu Dhabi government communications shell on 960x540:
- Top-right DGE / Abu Dhabi lockup x≈763 y≈31 w≈164 h≈38, matching DGE page_v1.0; do not resize it smaller and do not place content over it.
- h1.title: x=33 y=30 w=660, max two lines at ~30px/1.15 (ellipsis if longer), Noto Sans SemiBold, black #000000. PPTX title chrome: typeface Noto Sans SemiBold with bold enabled. Native short-title decks use a tight band; long consulting headlines should stay within the two-line title cap.
- DGE production slides normally do not use subtitles. Do not generate or render h2.subtitle on DGE standard content slides; use the body frame for any kicker/context if absolutely required by content.
- div.frame: x=24 y=112 w=912 h=371 — body band starts higher because standard subtitles are suppressed, while still clearing two-line titles, the lockup, footer row (y≈493), and classification strip (y=526–540). Frame extends to within ~24px of the slide right edge, matching the native template (no wide white right margin). Use timeline_4step layout contract when you need the exact four-card x positions from the native template.
- footer topic label: bottom-left x=33 y=493; keep blank unless a real source exists.
- slide number: bottom-right ~x=900 y=493.
- Bottom classification strip zone y=526–540 is reserved for OPEN | مفتوحة style chrome; keep frame content above y≈500.`,
  theme: `Primary brand blue **#005393** (the dominant visible blue on native DGE header bands and scope rows — middle stop of the native gradient). Deepest navy **#00437B** (cover backgrounds and darkest fills, deepest gradient stop). Bright top-of-band **#2A70AD**. Secondary chrome navy **#203864** for small structural shapes only (do not use as a dominant fill). Light panel **#7DA1C4** for soft sections, very light **#A6CAEC** for tinted backgrounds, white page, pale neutrals #E7E6E6 / #F2F2F2. **All slide text — titles, subtitles, body, labels, KPIs — must be black #000000 on light surfaces or white #FFFFFF on dark blue fills. Never use blue for text; the blue palette is reserved for fills, panels, bands, and rules.** Muted secondary text uses #4A5568 grey. Do not use #063360 (not in the native palette). Ignore Aptos theme slots (Office defaults) for color decisions.`,
  vibe: `Modern government brand: calm, enabling, trusted, bilingual-friendly, spacious, image-led heroes, rounded cards, soft blue panels, minimal noise.`,
  writing: `Prefer a single-line slide title when possible (native DGE masters assume a short headline); if the title must run long, keep it to two lines max and do not add a subtitle. Short declarative titles, concise institutional copy, minimal bullets.`,
  css: `Rounded cards, thin blue outlines, soft blue fills, white reverse text on #005393 panels (the native DGE band blue), generous margins, large photographic hero bands when appropriate.`,
  pptx: `16:9 widescreen (13.333 x 7.5 in). Hard-code Noto Sans for body English text; prefer bundled master chrome over raw theme slots. Preserve top-right lockup and bottom classification strip from the DGE master when merging templates.`,
};

const DGE_COMPONENT_PATTERNS = [
  {
    name: 'hero_banner',
    structure: 'Top image band plus lower-left title, subtitle, and meta.',
    useWhen: 'Cover and closing hero slides.',
    avoid: ['Dense bullets or charts inside the hero band'],
  },
  {
    name: 'white_editorial_content',
    structure: 'Headline, subline, full-width body band under the subtitle.',
    useWhen: 'Narrative and explanatory interior slides.',
    avoid: ['Letting body content collide with the top-right lockup or the bottom classification strip'],
  },
  {
    name: 'section_divider',
    structure: 'Top image band plus large section numeral/label.',
    useWhen: 'Chapter breaks only.',
    avoid: ['Long paragraphs under the section label'],
  },
  {
    name: 'timeline_4step',
    structure: 'Horizontal rail with four rounded cards; one active card emphasized.',
    useWhen: 'Roadmaps and phased journeys.',
    avoid: ['More than five steps on the same shell'],
  },
  {
    name: 'image_overlay_panel',
    structure: 'Full-bleed image with right-side blue panel for title and short copy.',
    useWhen: 'Vision, mission, who we are.',
    avoid: ['Charts inside the narrow panel'],
  },
];

const DGE_PPTX_CONTRACT = {
  slideSize: '16:9 widescreen (13.333 x 7.5 in from 960 x 540 px)',
  fontPolicy: 'Use Noto Sans family faces explicitly: Noto Sans SemiBold for standard slide titles (PPTX: fontFace Noto Sans SemiBold, bold true), Noto Sans Medium for subtitles and compact chrome, Noto Sans Regular for body. Do not use Aptos, Calibri, Georgia, STC Forward, or Fund fonts unless mixing a quoted hero line in Cairo where the user requests it.',
  defaultFontFace: 'Noto Sans',
  allowedFontFaces: ['Noto Sans', 'Noto Sans SemiBold', 'Noto Sans Medium', 'Noto Kufi Arabic', 'Cairo'],
  logoPolicy: 'Top-right DGE / Abu Dhabi lockup on standard interior slides.',
  sourcePolicy: 'Footer topic label bottom-left; blank unless real source text exists.',
  pageNumberPolicy: 'Bottom-right near footer band; do not collide with classification strip.',
  titlePolicy: 'Standard interior title band: black #000000, Noto Sans SemiBold ~30pt with bold enabled in PPTX; prefer one line (template slide 7); long titles may use at most two lines before ellipsis so the subtitle row does not overlap.',
  subtitlePolicy: 'Subtitle band: black #000000, Noto Sans Medium ~12pt at y≈108px below the title block; optional on dense slides.',
  hiddenPlaceholderPolicy: 'Do not surface dormant Office placeholder labels or generic click-to-edit prompts from unused masters.',
  themeTrustLevel: 'low',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const DGE_PROMPT_CONTRACT = `# DGE Client Design Contract

## Master and trust
- Treat the bundled DGE template as the chrome authority: top-right lockup, bottom classification strip, and hero geometry override generic Office theme slots (Aptos colors are not authoritative).
- Standard white content: title 33,30 (black, Noto Sans SemiBold ~30pt; PPTX chrome uses SemiBold typeface with bold true; reserve up to **two lines** then ellipsis—subtitle is fixed at **y=108** so it never overlaps wrapped titles) / subtitle 33,108 (black, Noto Sans Medium ~12pt) / body frame **24,132 size 912x351** (extended to match native right margin) / top-right lockup **709,31,218x51** (cover-sized lockup for legibility) / footer label 33,493 / reserve bottom strip 526–540px for classification chrome.
- Section/subsection tracker pills and band fills (e.g. SCOPE/ACHIEVEMENTS row): fill **#005393** with white label text. This is the dominant native band blue (middle gradient stop). Tracker chrome can use the secondary navy #203864 if a darker pill tone is needed.

## Theme
- Primary brand blue **#005393** for panels, top tabs, section trackers, scope rows, and structural emphasis (this is the dominant visible blue in the native DGE master — the middle stop of the native band gradient). Deepest navy **#00437B** for cover and darkest fills (the deepest gradient stop). Bright **#2A70AD** for top-of-band highlights. Secondary chrome navy **#203864** for small structural shapes only — never as a dominant fill. Light panel **#7DA1C4** for soft sections, very light **#A6CAEC** for tinted backgrounds, neutrals #E7E6E6 / #F2F2F2, white backgrounds.
- **Text color rule (strict):** all titles, subtitles, body copy, labels, KPIs, captions, and chrome text are either black **#000000** on light surfaces or white **#FFFFFF** on dark blue fills. Blue is reserved for fills, panels, bands, and rules — never for text. Muted secondary text uses #4A5568 grey.
- Do not use **#063360** — it is not present in the native DGE template palette.
- Forbidden as dominant fills: Office orange #E97132, bright green #196B24, cyan #0F9ED5, magenta #A02B93, lime #4EA72E.

## Typography
- Titles: Noto Sans SemiBold (font-weight 600 in HTML). Subtitles: Noto Sans Medium. Body: Noto Sans Regular with Noto Kufi Arabic in the stack for bilingual decks. Cairo is an optional hero/process accent only when the user explicitly requests that variant.

## Writing
- Government communications tone: short headlines, minimal bullets, future-oriented, institutional optimism.

## Patterns
- Reference hero cover, section divider, four-step timeline, and image+right-panel layouts from the profile component list; keep slides airy.`;

const DGE_PPTX_FONTS = {
  title: { fontFace: 'Noto Sans SemiBold', fontSize: 30, bold: true, color: '000000' },
  subtitle: { fontFace: 'Noto Sans Medium', fontSize: 12, bold: false, color: '000000' },
  body: { fontFace: 'Noto Sans', fontSize: 10, bold: false, color: '1A1A1A' },
  footer: { fontFace: 'Noto Sans', fontSize: 9, italic: false, bold: false, color: '4A5568' },
  slideNum: { fontFace: 'Noto Sans', fontSize: 9, bold: false, color: '4A5568' },
};

const dgeStandardInches = {
  logo: pxRectToInches(DGE_LAYOUT_CONTRACT.standardContent.logo, DGE_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(DGE_LAYOUT_CONTRACT.standardContent.title, DGE_LAYOUT_CONTRACT.canvas), font: DGE_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(DGE_LAYOUT_CONTRACT.standardContent.subtitle, DGE_LAYOUT_CONTRACT.canvas), font: DGE_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(DGE_LAYOUT_CONTRACT.standardContent.body, DGE_LAYOUT_CONTRACT.canvas), font: DGE_PPTX_FONTS.body },
  footer: { ...pxRectToInches(DGE_LAYOUT_CONTRACT.standardContent.source, DGE_LAYOUT_CONTRACT.canvas), font: DGE_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(DGE_LAYOUT_CONTRACT.standardContent.slideNumber, DGE_LAYOUT_CONTRACT.canvas), font: DGE_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(DGE_LAYOUT_CONTRACT.standardContent.sectionTracker, DGE_LAYOUT_CONTRACT.canvas),
    colors: { fill: '005393', subFill: '005393', text: 'FFFFFF', subText: 'FFFFFF' },
    font: { fontFace: 'Noto Sans Medium', fontSize: 8, bold: false },
    paddingX: 0.22,
    textInset: 0.05,
  },
};

export const CLIENT_DESIGN_PROFILES = {
  strategy: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'strategy',
    navLabel: 'Strategy&',
    name: 'Strategy&',
    description: 'Use the default Edwin Strategy& consulting style.',
    status: 'default',
    footerBranding: 'Strategy&',
    theme: DEFAULT_THEME,
    layoutContract: null,
    promptContract: '',
    designContract: '',
    pptxMaster: {
      mode: 'user-uploaded',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: false,
      storageKey: 'client-template:strategy:default',
      serverSync: 'legacy-single-slot',
    },
    chrome: null,
    evidence: {
      source: 'Edwin default theme and template library',
    },
    validationRules: {
      disallowedColors: [],
      disallowedFonts: [],
      disallowedFooterText: [],
      requiredColors: [],
    },
  },
  stc: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'stc',
    navLabel: 'STC',
    name: 'STC',
    description: 'STC purple palette and dense exhibit layouts.',
    status: 'sandbox-0.1',
    footerBranding: '',
    theme: STC_THEME,
    layoutContract: STC_LAYOUT_CONTRACT,
    freestyleOverrides: STC_FREESTYLE_OVERRIDES,
    componentPatterns: STC_COMPONENT_PATTERNS,
    pptxContract: STC_PPTX_CONTRACT,
    promptContract: STC_PROMPT_CONTRACT,
    designContract: STC_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:stc:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'stc',
      notes: 'Default STC master is served from backend assets; user-uploaded STC templates remain profile-bound local overrides.',
    },
    chrome: {
      footerText: '',
      positions: stcStandardInches,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'MCN and BCN Org Structure',
          slides: 52,
          layouts: 12,
          masters: 5,
          themeFonts: ['Arial', 'Arial'],
        },
        {
          label: 'BoD 2026 Digitization Initiatives',
          slides: 35,
          layouts: 17,
          masters: 6,
          themeFonts: ['STC Forward', 'STC forward'],
        },
        {
          label: 'Board Affairs BoD Management Playbook',
          slides: 1,
          layouts: 1,
          masters: 1,
          themeFonts: ['STC Forward', 'Arial'],
          role: 'canonical standard content-slide geometry reference',
        },
      ],
      rawThemeSlots: {
        dk1: '#1D252D',
        lt1: '#FFFFFF',
        dk2: '#4F008C',
        lt2: '#FF375E',
        accent1: '#FFDD40',
        accent2: '#FF6A39',
        accent3: '#00C48C',
        accent4: '#1BCED8',
        accent5: '#A54EE1',
        accent6: '#8E9AA0',
      },
      artifacts: [
        'tmp/client-template-sandbox/out/stc_generation_contract.md',
        'tmp/client-template-sandbox/out/stc_profile_report.md',
        'tmp/client-template-sandbox/out/stc_vision_audit.json',
        'tmp/client-template-sandbox/out/generation_test_report.json',
      ],
      generationTest: {
        verdict: 'contract_improved',
        positives: 6,
        negatives: 0,
      },
      alternateDecks: [
        {
          label: 'Telecom industry outlook editorial variant',
          role: 'alternate editorial style; do not blend into default purple consulting profile',
        },
      ],
      notes: [
        'Observed STC usage maps purple #4F008C to primary accent, despite raw PowerPoint accent1 being yellow.',
        'Reference decks are high-density consulting exhibits with VCS content layouts, tables, matrices, org charts, and process flows.',
      ],
    },
    validationRules: {
      requiredColors: ['#4F008C', '#FF375E', '#1D252D', '#FFFFFF'],
      preferredSurfaceColors: ['#EDD5FF', '#F5EDFB', '#FBF8FE', '#DBB8F3'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4472C4', '#ED7D31'],
      forbiddenDominantColors: ['#4472C4', '#ED7D31', '#FFDD40', '#00C48C', '#1BCED8'],
      disallowedFonts: ['Georgia', 'Calibri', 'Aptos'],
      disallowedFooterText: ['Strategy&'],
      minFontPx: 10,
      targetBodyFontPx: 12,
      fontSizesPt: {
        titleStandard: { min: 24, max: 34 },
        titleCover: { min: 36, max: 48 },
        titleDivider: { min: 28, max: 44 },
        subtitle: { min: 14, max: 18 },
        body: { min: 10, max: 14 },
        bodyDense: { min: 8, max: 11 },
        footer: { min: 7, max: 9 },
      },
      layoutBands: {
        titleMaxBottomPct: 18,
        subtitleMaxBottomPct: 25,
        contentStartPct: 24,
        footerStartPct: 91,
      },
      density: {
        maxBulletsStandard: 6,
        maxModulesStandard: 6,
        minBodyPt: 8,
      },
      chrome: {
        requireLogo: true,
        requirePageNumberNonCover: true,
        requireSourceNonCover: true,
        forbidHeavyFooterBar: true,
        forbidAccidentalAppendixNavigation: true,
      },
    },
  },
  pif: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'pif',
    navLabel: 'PIF',
    name: 'PIF',
    description: 'Public Investment Fund style: Fund typography, green and gold palette, implementation-guide layout.',
    status: 'ldc-0.1',
    footerBranding: '',
    theme: PIF_THEME,
    layoutContract: PIF_LAYOUT_CONTRACT,
    freestyleOverrides: PIF_FREESTYLE_OVERRIDES,
    componentPatterns: PIF_COMPONENT_PATTERNS,
    pptxContract: PIF_PPTX_CONTRACT,
    promptContract: PIF_PROMPT_CONTRACT,
    designContract: PIF_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:pif:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'pif',
      forceBundledDefault: true,
      useProfileChrome: true,
      notes: 'Default PIF master is served from backend assets; user-uploaded PIF templates remain profile-bound local overrides.',
    },
    chrome: {
      footerText: '',
      positions: pifStandardInches,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'LDC Implementation Guide',
          fileName: '11192024_LDC_Implementation Guide_vSend.pptx',
          slides: 97,
          layouts: 66,
          masters: 5,
          role: 'bundled master and canonical LDC content shell',
          dominantLayouts: [
            { layout: 47, slides: 46, role: 'dense matrix/governance content' },
            { layout: 29, slides: 21, role: 'methodology and decision-analysis content' },
            { layout: 5, slides: 12, role: 'roadmap and section-preface content' },
          ],
        },
        {
          label: 'DC Opportunity in KSA Pitch Deck',
          fileName: '20260409_DC Opportunity in KSA_Pitch Deck_vDraft_Excl. Profiles_KN_kj (1).pptx',
          slides: 23,
          layouts: 92,
          masters: 4,
          role: 'component/style reference only, not a second selectable master',
        },
      ],
      notes: [
        'The LDC guide is a 10 x 5.625 in screen16x9 deck mapped to 960 x 540 px for canvas preview.',
        'Visible text uses Fund Light heavily even though some theme font slots are generic Office fonts.',
        'Footer/source text is intentionally blank by default in generated PIF slides.',
      ],
    },
    validationRules: {
      requiredColors: ['#00332A', '#005C4D', '#C3984D', '#02CC99', '#FFFFFF'],
      preferredSurfaceColors: ['#FFFCF2', '#F4EBDD', '#EFE4D2', '#D4F3EC'],
      disallowedColors: ['#5F007F', '#28176F', '#FFC000', '#FF0000', '#8E1E1E', '#A32020', '#4F008C'],
      forbiddenDominantColors: ['#5F007F', '#28176F', '#FFC000', '#FF0000', '#8E1E1E', '#A32020'],
      disallowedFonts: ['Aptos', 'Calibri', 'Georgia', 'STC Forward'],
      disallowedFooterText: ['Strategy&', 'National Development Division', 'NATIONAL DEVELOPMENT DIVISION'],
      minFontPx: 8,
      targetBodyFontPx: 10,
      fontSizesPt: {
        titleStandard: { min: 10, max: 12 },
        titleCover: { min: 30, max: 34 },
        subtitle: { min: 7, max: 9 },
        body: { min: 8, max: 12 },
        bodyDense: { min: 8, max: 10 },
        footer: { min: 7, max: 8 },
      },
      layoutBands: {
        logoSafeBottomPct: 15,
        titleMaxBottomPct: 16,
        contentStartPct: 15,
        footerStartPct: 93,
      },
      density: {
        maxBulletsStandard: 6,
        maxModulesStandard: 6,
        minBodyPt: 8,
      },
      chrome: {
        requireLogo: true,
        requirePageNumberNonCover: true,
        requireSourceNonCover: false,
        forbidHeavyFooterBar: true,
        forbidAccidentalAppendixNavigation: true,
      },
    },
  },
  fya: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'fya',
    navLabel: 'FYA',
    name: 'Federal Youth Authority',
    description: 'Federal Youth Authority template: Poppins, warm cream canvas, gold/green institutional palette.',
    status: 'brand-0.1',
    footerBranding: '',
    theme: FYA_THEME,
    layoutContract: FYA_LAYOUT_CONTRACT,
    freestyleOverrides: FYA_FREESTYLE_OVERRIDES,
    componentPatterns: FYA_COMPONENT_PATTERNS,
    pptxContract: FYA_PPTX_CONTRACT,
    promptContract: FYA_PROMPT_CONTRACT,
    designContract: FYA_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:fya:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'fya',
      forceBundledDefault: true,
      useProfileChrome: true,
      assetVersion: 'fya-logo-native-v1',
      notes: 'Default FYA master is served from backend assets; uploads stay profile-bound in local storage.',
    },
    chrome: {
      footerText: '',
      positions: fyaStandardInches,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'FYA Template for Edwin',
          fileName: 'FYA Template for Edwin.pptx',
          slides: 5,
          layouts: 11,
          masters: 4,
          role: 'bundled master and canonical FYA visual system',
        },
      ],
      rawThemeSlots: {
        lt1: '#F9F7ED',
        dk1: '#000000',
        accent1: '#CE9C3E',
        accent2: '#3F8E50',
        accent3: '#92732A',
        accent4: '#D83731',
        accent5: '#6E4527',
      },
      notes: [
        'The bundled FYA deck is 13.333 x 7.5in widescreen mapped to 960 x 540px for canvas preview.',
        'Visible theme font is Poppins; fallback Office Aptos/Calibri slots are not authoritative.',
        'Logo asset is extracted from the native template media image11.png.',
      ],
    },
    validationRules: {
      requiredColors: ['#F9F7ED', '#CE9C3E', '#3F8E50', '#6E4527', '#D83731', '#000000'],
      preferredSurfaceColors: ['#F9F7ED', '#F0E8D8', '#EFE4C8', '#E8E0C8'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#005393', '#00332A', '#005C4D'],
      forbiddenDominantColors: ['#8E1E1E', '#A32020', '#4F008C', '#005393', '#00332A'],
      disallowedFonts: ['Georgia', 'STC Forward', 'Fund Light', 'Noto Sans', 'Aptos', 'Calibri'],
      disallowedFooterText: ['Strategy&', 'Department of Government Enablement', 'National Development Division'],
      minFontPx: 8,
      targetBodyFontPx: 12,
      fontSizesPt: {
        titleStandard: { min: 20, max: 24 },
        titleCover: { min: 34, max: 44 },
        subtitle: { min: 16, max: 19 },
        body: { min: 9, max: 13 },
        bodyDense: { min: 8, max: 10 },
        footer: { min: 7, max: 9 },
      },
      layoutBands: {
        logoSafeBottomPct: 8,
        titleMaxBottomPct: 20,
        subtitleMaxBottomPct: 26,
        contentStartPct: 27,
        footerStartPct: 92,
      },
      density: {
        maxBulletsStandard: 6,
        maxModulesStandard: 6,
        minBodyPt: 8,
      },
      chrome: {
        requireLogo: true,
        requirePageNumberNonCover: true,
        requireSourceNonCover: false,
        forbidHeavyFooterBar: true,
        forbidAccidentalAppendixNavigation: true,
      },
    },
  },
  dge: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'dge',
    navLabel: 'DGE',
    name: 'Department of Government Enablement',
    description: 'DGE Abu Dhabi template: Noto Sans, blue government palette, top-right lockup, editorial body column.',
    status: 'brand-0.1',
    footerBranding: '',
    theme: DGE_THEME,
    layoutContract: DGE_LAYOUT_CONTRACT,
    freestyleOverrides: DGE_FREESTYLE_OVERRIDES,
    componentPatterns: DGE_COMPONENT_PATTERNS,
    pptxContract: DGE_PPTX_CONTRACT,
    promptContract: DGE_PROMPT_CONTRACT,
    designContract: DGE_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:dge:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'dge',
      forceBundledDefault: true,
      useProfileChrome: true,
      assetVersion: 'dge-logo-native-2000x468-v2',
      notes: 'Bundled DGE master from backend assets; uploads stay profile-bound in local storage.',
    },
    chrome: {
      footerText: '',
      positions: dgeStandardInches,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'DGE Presentation Template (Edwin)',
          fileName: '20260512_DGE_PPT Presentation Template_Edwin.pptx',
          role: 'bundled master; hybrid Aptos theme slots with direct-formatted DGE visuals',
        },
      ],
      keyObservedLayouts: ['1_Title Slide', 'Title Slide', '1_Comparison', '1_Content with Caption'],
      keyObservedRisks: [
        'Embedded themes remain generic Office Aptos',
        'Multiple master families in one file',
        'Cairo appears on some hero slides alongside Noto',
      ],
      notes: [
        'Treat master chrome and shape system as higher trust than raw theme XML.',
        'Bundled Noto Sans TTFs ship for canvas/PPTX (SemiBold/Medium/Regular/Bold as needed); add Noto Kufi Arabic files to assets when available.',
        'Top-right lockup raster: backend/assets/client-templates/dge/logo.png (sourced from the DGE master; re-crop if export picks up stray separator pixels).',
      ],
    },
    validationRules: {
      requiredColors: ['#005393', '#00437B', '#2A70AD', '#7DA1C4', '#FFFFFF'],
      preferredSurfaceColors: ['#E7E6E6', '#F2F2F2', '#E8EEF5', '#A6CAEC'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#C3984D', '#063360'],
      forbiddenDominantColors: ['#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'],
      disallowedFonts: ['Aptos', 'Calibri', 'Georgia', 'STC Forward', 'Fund Light'],
      disallowedFooterText: ['Strategy&'],
      minFontPx: 9,
      targetBodyFontPx: 14,
      fontSizesPt: {
        titleStandard: { min: 28, max: 32 },
        titleCover: { min: 30, max: 34 },
        subtitle: { min: 12, max: 14 },
        body: { min: 10, max: 11 },
        bodyDense: { min: 9, max: 10 },
        footer: { min: 9, max: 9 },
      },
      layoutBands: {
        logoSafeRightPct: 20,
        titleMaxBottomPct: 14,
        contentStartPct: 28,
        footerStartPct: 91,
      },
      density: {
        maxBulletsStandard: 4,
        maxModulesStandard: 6,
        minBodyPt: 9,
      },
      chrome: {
        requireLogo: true,
        requirePageNumberNonCover: true,
        requireSourceNonCover: false,
        forbidHeavyFooterBar: true,
        forbidAccidentalAppendixNavigation: true,
      },
    },
  },
};

export const CLIENT_DESIGN_PROFILE_OPTIONS = Object.values(CLIENT_DESIGN_PROFILES).map(profile => ({
  id: profile.id,
  name: profile.name,
  navLabel: profile.navLabel || profile.name,
  description: profile.description,
  status: profile.status,
}));

export function getClientDesignProfile(profileId) {
  return CLIENT_DESIGN_PROFILES[profileId] || CLIENT_DESIGN_PROFILES.strategy;
}

export function getActiveClientProfile(settings = {}) {
  return getClientDesignProfile(settings.clientDesignProfileId || 'strategy');
}

export function getClientProfileTheme(profileId) {
  return getClientDesignProfile(profileId).theme;
}

export function getClientProfileFooterBranding(settings = {}, fallback = 'Strategy&') {
  const profile = getActiveClientProfile(settings);
  if (profile && Object.prototype.hasOwnProperty.call(profile, 'footerBranding')) {
    return settings.footerBranding ?? profile.footerBranding ?? '';
  }
  return settings.footerBranding ?? fallback;
}

export function getClientProfileTemplateStorageKey(profileId = 'strategy', templateId = PROFILE_TEMPLATE_SLOT.DEFAULT) {
  const profile = getClientDesignProfile(profileId);
  const configured = profile.pptxMaster?.storageKey;
  if (templateId === PROFILE_TEMPLATE_SLOT.DEFAULT && configured) return configured;
  return `client-template:${profile.id}:${templateId || PROFILE_TEMPLATE_SLOT.DEFAULT}`;
}

function formatRect(rect) {
  if (!rect) return '';
  return `x=${rect.x}, y=${rect.y}, w=${rect.w}, h=${rect.h}`;
}

export function buildClientLayoutContractBlock(profile) {
  if (!profile?.layoutContract) return '';
  const layout = profile.layoutContract;
  const standard = layout.standardContent || {};
  const cover = layout.cover || {};
  return `CLIENT LAYOUT CONTRACT:
- Canvas: ${layout.canvas?.widthPx || 960}x${layout.canvas?.heightPx || 540}px (${layout.canvas?.widthIn || 13.333}x${layout.canvas?.heightIn || 7.5}in)
- Standard title band: ${formatRect(standard.title)}
- Standard subtitle band: ${formatRect(standard.subtitle)}
- Standard body/content band: ${formatRect(standard.body)}
- Standard source/footer band: ${formatRect(standard.source)}
- Standard slide number band: ${formatRect(standard.slideNumber)}
${cover.title ? `- Cover title band: ${formatRect(cover.title)}\n` : ''}${layout.denseTableMatrix?.contentBand ? `- Dense table/matrix content band: ${formatRect(layout.denseTableMatrix.contentBand)}\n` : ''}${layout.orgChartProcess?.contentBand ? `- Org/process content band: ${formatRect(layout.orgChartProcess.contentBand)}\n` : ''}`;
}

export function buildClientValidationBlock(profile) {
  const rules = profile?.validationRules;
  if (!rules) return '';
  const parts = [];
  if (rules.requiredColors?.length) parts.push(`Required/expected colors: ${rules.requiredColors.join(', ')}`);
  if (rules.preferredSurfaceColors?.length) parts.push(`Preferred surfaces/borders: ${rules.preferredSurfaceColors.join(', ')}`);
  if (rules.disallowedColors?.length) parts.push(`Do not use colors: ${rules.disallowedColors.join(', ')}`);
  if (rules.forbiddenDominantColors?.length) parts.push(`Never use as dominant colors: ${rules.forbiddenDominantColors.join(', ')}`);
  if (rules.disallowedFonts?.length) parts.push(`Do not use fonts: ${rules.disallowedFonts.join(', ')}`);
  if (rules.disallowedFooterText?.length) parts.push(`Do not use footer text: ${rules.disallowedFooterText.join(', ')}`);
  if (rules.minFontPx) parts.push(`Minimum visible font size: ${rules.minFontPx}px`);
  return parts.length ? `CLIENT VALIDATION RULES:\n- ${parts.join('\n- ')}` : '';
}

function buildClientFreestyleOverridesBlock(profile) {
  const overrides = profile?.freestyleOverrides;
  if (!overrides) return '';
  return `CLIENT FREESTYLE PROMPT SECTIONS:
- Shell/layout: ${overrides.shell}
- Theme: ${overrides.theme}
- Vibe/design principles: ${overrides.vibe}
- Writing style: ${overrides.writing}
- CSS/components: ${overrides.css}
- PPTX export: ${overrides.pptx}`;
}

function buildClientComponentPatternsBlock(profile) {
  if (!profile?.componentPatterns?.length) return '';
  return `CLIENT COMPONENT PATTERNS:
${profile.componentPatterns.map(pattern => `- ${pattern.name}: ${pattern.structure} Use when: ${pattern.useWhen} Avoid: ${(pattern.avoid || []).join(', ')}`).join('\n')}`;
}

function buildClientPptxContractBlock(profile) {
  if (!profile?.pptxContract) return '';
  return `CLIENT PPTX CONTRACT:
${JSON.stringify(profile.pptxContract, null, 2)}`;
}

export function buildClientPromptSection(sectionName, settings = {}) {
  const profile = getActiveClientProfile(settings);
  if (!profile || profile.id === 'strategy' || !profile.freestyleOverrides) return '';
  const value = profile.freestyleOverrides[sectionName];
  if (!value) return '';
  return `# Active Client Profile Override -- ${profile.name}

${value}`;
}

function rewriteFreestyleShellForProfile(shell, profile) {
  if (!shell || !profile?.layoutContract?.standardContent) return shell || '';
  const standard = profile.layoutContract.standardContent;
  const title = standard.title;
  const subtitle = standard.subtitle;
  const body = standard.body;
  const source = standard.source;
  const slideNumber = standard.slideNumber;
  const titleFont = profile.theme?.fonts?.title || 'Arial, sans-serif';
  const subtitleFont = profile.theme?.fonts?.heading || 'Arial, sans-serif';
  const titleColor = profile.theme?.colors?.heading || profile.theme?.colors?.accent || '#4F008C';
  const subtitleColor = profile.theme?.colors?.kicker || profile.theme?.colors?.danger || '#FF375E';
  const titleFontSize = profile.theme?.layout?.cssVars?.['--title-font-size'] || '24px';
  const subtitleFontSize = profile.theme?.layout?.cssVars?.['--subtitle-font-size'] || '18px';

  return shell
    .replace(
      /\| `h1\.title` \|[^\n]+/,
      `| \`h1.title\` | top: ${title.y}px, left: ${title.x}px, width: ${title.w}px, height: ${title.h}px -- ${titleFont} regular ${titleFontSize}, ${titleColor} |`,
    )
    .replace(
      /\| `h2\.subtitle` \|[^\n]+/,
      `| \`h2.subtitle\` | top: ${subtitle.y}px, left: ${subtitle.x}px, width: ${subtitle.w}px, height: ${subtitle.h}px -- ${subtitleFont} regular ${subtitleFontSize}, ${subtitleColor} |`,
    )
    .replace(
      /\| `div\.frame` \|[^\n]+/,
      `| \`div.frame\` | top: ${body.y}px, left: ${body.x}px, **${body.w} x ${body.h} px** -- ${profile.name} content canvas |`,
    )
    .replace(
      /\| `footer` \|[^\n]+/,
      `| \`footer\` | source bottom-left around x=${source.x}, y=${source.y}; slide number bottom-right around x=${slideNumber.x}, y=${slideNumber.y} |`,
    )
    .replace(/904 x 366/g, `${body.w} x ${body.h}`)
    .replace(/904x366/g, `${body.w}x${body.h}`)
    .replace(/904 x 366 px/g, `${body.w} x ${body.h} px`)
    .replace(/366 px height or 904 px width/g, `${body.h} px height or ${body.w} px width`)
    .replace(/Size in pixels relative to the \*\*904 x 366\*\* frame/g, `Size in pixels relative to the **${body.w} x ${body.h}** frame`);
}

export function rewritePromptGeometryForClientProfile(prompt, settings = {}) {
  const profile = getActiveClientProfile(settings);
  if (!prompt || !profile?.layoutContract?.standardContent || profile.id === 'strategy') return prompt || '';

  const standard = profile.layoutContract.standardContent;
  const title = standard.title;
  const subtitle = standard.subtitle;
  const body = standard.body;
  const source = standard.source;
  const slideNumber = standard.slideNumber;
  const fontTitle = profile.theme?.fonts?.title || 'Arial, sans-serif';
  const fontHeading = profile.theme?.fonts?.heading || 'Arial, sans-serif';
  const headingColor = profile.theme?.colors?.heading || profile.theme?.colors?.accent || '#111111';
  const subtitleColor = profile.theme?.colors?.kicker || profile.theme?.colors?.accent || '#A32020';
  const titleFontSize = profile.theme?.layout?.cssVars?.['--title-font-size'] || '24px';
  const subtitleFontSize = profile.theme?.layout?.cssVars?.['--subtitle-font-size'] || '18px';

  return rewriteFreestyleShellForProfile(prompt, profile)
    .replace(
      /- `h1\.title`: top 24px, left 28px, width 904px, Georgia 28px/g,
      `- \`h1.title\`: top ${title.y}px, left ${title.x}px, width ${title.w}px, ${fontTitle} ${titleFontSize} regular, ${headingColor}`
    )
    .replace(
      /- `h2\.subtitle`: top 95px, left 28px, width 904px, Arial bold 18px/g,
      `- \`h2.subtitle\`: top ${subtitle.y}px, left ${subtitle.x}px, width ${subtitle.w}px, ${fontHeading} ${subtitleFontSize} regular, ${subtitleColor}`
    )
    .replace(
      /- `\.frame`: top 127px, left 28px, size \*\*904 x 366 px\*\*/g,
      `- \`.frame\`: top ${body.y}px, left ${body.x}px, size **${body.w} x ${body.h} px**`
    )
    .replace(/The `\.frame` is exactly \*\*904 x 366 px\*\*/g, `The \`.frame\` is exactly **${body.w} x ${body.h} px**`)
    .replace(/Design everything to fit inside 904 x 366 px/g, `Design everything to fit inside ${body.w} x ${body.h} px`)
    .replace(/pixel-based sizing relative to the 904 x 366 px frame/g, `pixel-based sizing relative to the ${body.w} x ${body.h} px frame`)
    .replace(/fits inside the 904 x 366 px frame/g, `fits inside the ${body.w} x ${body.h} px frame`)
    .replace(/904 x 366 px/g, `${body.w} x ${body.h} px`)
    .replace(/904 x 366/g, `${body.w} x ${body.h}`)
    .replace(/904x366/g, `${body.w}x${body.h}`)
    .replace(/904px width/g, `${body.w}px width`)
    .replace(/366px frame/g, `${body.h}px frame`)
    .replace(/366px/g, `${body.h}px`);
}

export function buildClientChartGeometryGuide(settings = {}, baseGuide = '') {
  const profile = getActiveClientProfile(settings);
  const body = profile?.layoutContract?.standardContent?.body;
  if (!baseGuide || !body || profile.id === 'strategy') return baseGuide || '';

  return `${baseGuide
    .replace(/viewBox="0 0 904 366"/g, `viewBox="0 0 ${body.w} ${body.h}"`)
    .replace(/904 x 366/g, `${body.w} x ${body.h}`)
    .replace(/904x366/g, `${body.w}x${body.h}`)
    .replace(/366px frame/g, `${body.h}px frame`)
    .replace(/904px width/g, `${body.w}px width`)}

CLIENT PROFILE CHART GEOMETRY:
- The active ${profile.name} content band is ${body.w}x${body.h}px at x=${body.x}, y=${body.y}; all chart marks, axes, labels, legends, and callouts must stay inside that band.
- If a chart needs more space than ${body.w}x${body.h}px, simplify the exhibit or split content across slides instead of letting it spill into the footer or margins.`;
}

export function applyClientProfilePromptSections(sections = {}, settings = {}, options = {}) {
  const profile = getActiveClientProfile(settings);
  if (!profile || profile.id === 'strategy' || !profile.freestyleOverrides) return sections;

  const CORE_GENERATOR_GUARDRAILS = `Non-negotiable carry-over from the base slide generator prompt:
- Keep sentence-like text in one inline-flow container; do not split one sentence across sibling flex/grid blocks.
- Convert repeated peer labels/tags into one shared row/column header structure instead of duplicating labels inside each peer card.
- Preserve one dominant structure, avoid crowding, and keep all content non-overlapping and non-overflowing inside the frame.
- Keep color-token, scoped-CSS, and readability-floor rules active; profile style can tune aesthetics but must not relax these constraints.`;

  const includeShell = options.includeShell !== false;
  const next = { ...sections };
  if (includeShell) {
    next.shell = rewriteFreestyleShellForProfile(next.shell, profile);
  }
  for (const sectionName of ['shell', 'theme', 'vibe', 'writing', 'hints']) {
    if (sectionName === 'shell' && !includeShell) continue;
    const profileSection = sectionName === 'hints'
      ? profile.freestyleOverrides.pptx
      : profile.freestyleOverrides[sectionName];
    if (!profileSection) continue;
    const heading = `# Active Client Profile -- ${profile.name} ${sectionName === 'hints' ? 'PPTX Export' : sectionName}`;
    next[sectionName] = `${next[sectionName] || ''}

---

${heading}

${profileSection}`.trim();
  }
  next.vibe = `${next.vibe || ''}

---

# Active Client Profile -- Core Generator Guardrails

${CORE_GENERATOR_GUARDRAILS}`.trim();
  return next;
}

export function buildClientDesignContract(settings = {}) {
  const profile = getActiveClientProfile(settings);
  const contract = profile?.promptContract || profile?.designContract;
  if (!contract) return '';
  const layoutBlock = buildClientLayoutContractBlock(profile);
  const validationBlock = buildClientValidationBlock(profile);
  const overridesBlock = buildClientFreestyleOverridesBlock(profile);
  const patternsBlock = buildClientComponentPatternsBlock(profile);
  const pptxBlock = buildClientPptxContractBlock(profile);
  return `CLIENT DESIGN PROFILE: ${profile.name}
Profile id: ${profile.id}
Schema version: ${profile.schemaVersion || CLIENT_PROFILE_SCHEMA_VERSION}
Profile version/status: ${profile.status || 'unknown'}

${contract}

${layoutBlock ? `---\n\n${layoutBlock}\n` : ''}${overridesBlock ? `---\n\n${overridesBlock}\n` : ''}${patternsBlock ? `---\n\n${patternsBlock}\n` : ''}${pptxBlock ? `---\n\n${pptxBlock}\n` : ''}${validationBlock ? `---\n\n${validationBlock}` : ''}`.trim();
}

export function buildClientProfileContext(settings = {}, options = {}) {
  const profile = getActiveClientProfile(settings);
  if (!profile || profile.id === 'strategy') return '';
  const {
    includeTheme = true,
    includeLayout = true,
    includeValidation = true,
    includeEvidence = false,
    includePromptSections = true,
    includeComponents = true,
    includePptx = false,
  } = options;
  const sections = [
    `ACTIVE CLIENT PROFILE: ${profile.name} (${profile.id})`,
    `Default variant: ${profile.theme?.defaultVariant || 'default'}`,
    profile.theme?.alternateVariants?.length
      ? `Alternate variants: ${profile.theme.alternateVariants.map(variant => `${variant.id} (${variant.usage})`).join('; ')}`
      : '',
    `Footer/source text: ${getClientProfileFooterBranding(settings, '') || '[blank unless a real source is provided]'}`,
  ].filter(Boolean);
  if (includeTheme && profile.theme) {
    sections.push(`Semantic theme tokens:\n${JSON.stringify(profile.theme, null, 2)}`);
  }
  if (includeLayout) {
    const layoutBlock = buildClientLayoutContractBlock(profile);
    if (layoutBlock) sections.push(layoutBlock);
  }
  if (includePromptSections) {
    const overridesBlock = buildClientFreestyleOverridesBlock(profile);
    if (overridesBlock) sections.push(overridesBlock);
  }
  if (includeComponents) {
    const patternsBlock = buildClientComponentPatternsBlock(profile);
    if (patternsBlock) sections.push(patternsBlock);
  }
  if (includePptx) {
    const pptxBlock = buildClientPptxContractBlock(profile);
    if (pptxBlock) sections.push(pptxBlock);
  }
  if (includeValidation) {
    const validationBlock = buildClientValidationBlock(profile);
    if (validationBlock) sections.push(validationBlock);
  }
  if (includeEvidence && profile.evidence) {
    sections.push(`Profile evidence:\n${JSON.stringify(profile.evidence, null, 2)}`);
  }
  return sections.join('\n\n');
}

export function appendClientDesignContract(systemPrompt, settings = {}) {
  const basePrompt = systemPrompt || '';
  const contract = buildClientDesignContract(settings);
  if (!contract || basePrompt.includes('CLIENT DESIGN PROFILE:')) return basePrompt;
  return `${basePrompt}

---

${contract}`;
}
