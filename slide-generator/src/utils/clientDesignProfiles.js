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
  vibe: `Board-ready, strategy-consulting, precise, modular, high-clarity, low-decoration. Use strong hierarchy, tight alignment, restrained accents, generous white space in the header, denser structured content in the middle, and tiny unobtrusive footer chrome. Avoid playful UI, consumer-product styling, heavy shadows, and decorative gradients except on approved photo covers.`,
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

const STC_PROMPT_CONTRACT = `# STC Client Design Contract

## Theme
- Use STC purple (#4F008C) as the primary accent. Do NOT treat PowerPoint accent1 yellow as the primary brand accent.
- Use white backgrounds for content slides, with pale violet surfaces (#FBF8FE / #EDD5FF) and thin violet borders (#DBB8F3) for grouping.
- Use dark navy (#1D252D) for titles and body text.
- Use red/pink (#FF375E) for subtitles, warning emphasis, and selected labels.
- Use green (#00C48C) for recommendations, positive options, or approved status.
- Use yellow (#FFDD40), orange (#FF6A39), cyan (#1BCED8), and gray (#8E9AA0) as secondary accents only.

## Typography
- Use STC Forward for titles, headings, labels, tables, and body copy. Do not declare Arial or generic fallback families in generated STC HTML/CSS.
- Do not use Georgia for STC slides.
- Content-slide titles use STC Forward 24px regular in purple #4F008C. Subtitles use STC Forward 18px regular in #FF375E. Footer/source and page numbers use STC Forward 8px.
- Keep visible text at 10px or larger except footer/source, page numbers, trackers, and compact tags may use 8px. Body/table text should target 12px and section/card titles 14px+.
- STC Forward reads heavy: use 400 for body copy, 500 for local headings/labels/card titles, and 700 only for step numbers, KPIs, or rare emphasis.

## Layout and chrome
- STC slides use a 960x540 canvas mapped from 13.33x7.5 in.
- Content-slide title band: title around x=15, y=29, w=931, h=71.
- Section tracker band: logo-safe text-only tracker around x=57, y=10, 9px text, color #9E21FF. Never place tracker chrome at x=0 over the logo, and do not add arrow/chevron markers.
- Subtitle band: around x=15, y=105, w=931, h=19.
- Main content band: around x=15, y=134, w=931, h=340.
- Source/footer band: bottom-left around x=15, y=495; slide number bottom-right around x=935, y=519.
- Content slides should keep title/subtitle in the top band, dense exhibit content in the middle band, and source/legend/page number in the bottom band.
- Cover slides may use dark purple/blue photographic or abstract backgrounds with white logo and large white title blocks.

## Component patterns
- Prefer compact consulting exhibits: dense matrices, tables, org-chart boxes, value-chain groupings, chevron process flows, and long-list columns.
- Use numbered purple header cards for sections and workstreams.
- Use tables with purple row or column headers and white content cells.
- Use small icons sparingly as visual indicators, not decorative clutter.
- Maintain high information density, but use precise grid/table alignment so the slide remains readable.

## Avoid
- Do not use Strategy& maroon (#8E1E1E / #A32020), Strategy& footer branding, or Georgia titles.
- Do not make yellow the dominant slide color.
- Do not create sparse marketing slides for analytical STC content.
- Do not place source notes or legends randomly inside the main content area unless they are part of a table or matrix.`;

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
  name: 'PIF LDC',
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

const PIF_PROMPT_CONTRACT = `# PIF LDC Client Design Contract

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
};

export const CLIENT_DESIGN_PROFILES = {
  strategy: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'strategy',
    name: 'Strategy& Default',
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
    name: 'STC',
    description: 'Use STC purple, dense exhibit layouts, and STC TMT reference-deck behavior.',
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
    name: 'PIF LDC',
    description: 'Use the PIF LDC implementation-guide master shell with Fund typography, PIF green/gold/mint colors, and blank footer/source text by default.',
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
};

export const CLIENT_DESIGN_PROFILE_OPTIONS = Object.values(CLIENT_DESIGN_PROFILES).map(profile => ({
  id: profile.id,
  name: profile.name,
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
