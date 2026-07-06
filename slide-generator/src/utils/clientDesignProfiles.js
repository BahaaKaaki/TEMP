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
  css: `Use square-cornered boxes by default, thin 0.75-1.25pt borders, purple header bars, lilac body panels, dark body text, and reversed white text on dark fills. STC Forward reads heavy: use font-weight 400 for body copy, 500 for local headings, card titles, stage titles, labels, and subtitles, and reserve 700 for step numbers, KPIs, or rare emphasis only. STC font sizing — pin these values; do not split the difference because STC Forward looks dense: body copy, descriptions, and table cells = 12px; pillar headers, section heads, card titles, and stage titles = 14px. Never use 13px for any visible text on STC slides. Use chevrons, tabs, trackers, and thin connector lines for structure. Avoid default chart palettes, rounded consumer cards, strong shadows, and gradient fills except on photo covers.`,
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

const TDREDC_THEME = {
  name: 'TDREDC',
  defaultVariant: 'tdredc_excom_template',
  colors: {
    accent: '#005C4D',
    accentHover: '#00332A',
    accentSoft: '#E5F4EF',
    onAccent: '#FFFFFF',
    heading: '#595959',
    body: '#00332A',
    muted: '#7F7F7F',
    page: '#FFFFFF',
    surface: '#FFFCF2',
    surfaceAlt: '#F2F2F2',
    border: '#DCC29C',
    success: '#29BA74',
    successSoft: '#D4F3EC',
    warning: '#C4995B',
    warningSoft: '#EFE4D2',
    danger: '#B21D41',
    dangerSoft: '#F7E1DD',
    info: '#005A65',
    neutral: '#7F7F7F',
    coverDark: '#00332A',
    kicker: '#9D7539',
    tdredcGreen: '#005C4D',
    tdredcDarkGreen: '#00332A',
    tdredcGold: '#C4995B',
    tdredcBrown: '#654B25',
    tdredcMint: '#29BA74',
    pillarRise: '#46121D',
    pillarNora: '#9D7539',
    pillarCorporate: '#2C2C2C',
    panelDark: '#00342B',
  },
  fonts: {
    title: '"Fund Light", "Fund Regular", Arial, sans-serif',
    heading: '"Fund Light", "Fund Regular", Arial, sans-serif',
    body: '"Fund Light", "Fund Regular", Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '33px',
      '--title-y': '45px',
      '--title-w': '805px',
      '--title-font-size': '22px',
      '--title-font-weight': '400',
      '--title-line-height': '1.12',
      '--subtitle-y': '5px',
      '--subtitle-w': '192px',
      '--subtitle-color': '#9D7539',
      '--subtitle-font-size': '8px',
      '--subtitle-font-weight': '400',
      '--frame-y': '80px',
      '--frame-w': '885px',
      '--frame-h': '418px',
      '--footer-x': '33px',
      '--footer-y': '506px',
      '--footer-bottom': 'auto',
      '--footer-w': '885px',
      '--footer-font-size': '8px',
      '--footer-padding-bottom': '0',
      '--source-x': '33px',
      '--source-y': '506px',
      '--source-w': '720px',
      '--source-h': '16px',
      '--slide-num-x': '892px',
      '--slide-num-y': '514px',
      '--slide-num-w': '43px',
      '--slide-num-h': '29px',
      '--pillar-rise': '#46121D',
      '--pillar-nora': '#9D7539',
      '--pillar-corporate': '#2C2C2C',
      '--panel-dark': '#00342B',
      '--legend-mint': '#29BA74',
    },
  },
};

const TDREDC_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  },
  standardContent: {
    title: { x: 112, y: 45, w: 805, h: 29 },
    subtitle: { x: 765, y: 5, w: 192, h: 18 },
    body: { x: 33, y: 80, w: 885, h: 418 },
    source: { x: 33, y: 506, w: 720, h: 16 },
    slideNumber: { x: 892, y: 514, w: 43, h: 29 },
    sectionTracker: { x: 0, y: 0, w: 188, h: 18 },
  },
  cover: {
    logo: { x: 33, y: 18, w: 234, h: 82 },
    title: { x: 33, y: 192, w: 728, h: 65 },
    subtitle: { x: 33, y: 257, w: 728, h: 28 },
  },
};

const TDREDC_PPTX_CONTRACT = {
  slideSize: '13.333 x 7.5 in widescreen, mapped from 960 x 540 px',
  fontPolicy: 'Use Fund Light for normal title/body text and Fund Regular only for page numbers or limited emphasis. Do not use Aptos, Calibri, Georgia, STC Forward, or generic Office defaults.',
  defaultFontFace: 'Fund Light',
  allowedFontFaces: ['Fund Light', 'Fund Regular', 'Fund Med', 'Fund SemBd'],
  logoPolicy: 'TDREDC logo lockup (image2.svg — green TDREDC on white) at x=33 y=18 w=234 h=82 on cover slides only; standard ExCom body slides (slideLayout2) have no header logo.',
  sourcePolicy: 'Footer/source text is blank by default; show source text only when a real source exists.',
  pageNumberPolicy: 'Bottom-right gold page block with centered editable white page number.',
  titlePolicy: 'Content title at x=112 y=45 w=805 h=29 full-width header band; Fund Light 22px HTML / 16pt PPTX; charcoal #595959.',
  subtitlePolicy: 'No visible broad subtitle band on standard TDREDC body slides. Optional lens labels must be compact in-exhibit labels only.',
  hiddenPlaceholderPolicy: 'Do not surface Confidential/Public labels, review notes, scratch content, or hidden think-cell artifacts unless explicitly requested.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const TDREDC_PROMPT_CONTRACT = `# TDREDC profile — minimal generation contract

Follow the base Slide HTML Generator for balance, whitespace, contrast, and executive density. TDREDC-specific additions only:

## Brand and typography
- Use semantic theme tokens inside \`.slide .frame\` (no ad-hoc hex); active theme encodes TDREDC green/gold/brown palette and Fund typography.
- Fund Light / Fund Regular only; do not use Georgia, STC Forward, or Strategy& maroon styling cues.

## Layout and chrome
- Respect the TDREDC layout contract appended below (title, frame, footer, page-number block).
- Do not place a logo on standard body slides — native ExCom content layout has title only. Cover slides may receive the bundled lockup via chrome; never draw logo text or a fake wordmark in slide HTML.
- Place h1.title at x=112 y=45 w=805 h=29 on standard body slides.
- Do not render h2.subtitle on standard body slides unless the user explicitly asks for a compact in-exhibit label.
- Keep footer/source text blank unless a real source is provided.

## Workstream pillar colors (Executive Summary, agenda matrices, section headers)
- Rise: \`--pillar-rise\` / #46121D (maroon header fill, white label text).
- North of Riyadh Area (NoRA): \`--pillar-nora\` / #9D7539 (gold/brown header fill, white label text).
- Corporate Matters: \`--pillar-corporate\` / #2C2C2C (charcoal header fill, white label text).
- Agenda legend labels (Rise, NoRA): \`--legend-mint\` / #29BA74.
- Dense update panels may use \`--panel-dark\` / #00342B with white body text.
- Green section bands use \`--accent\` / #005C4D; brown sub-label chips use \`--tdredc-brown\` / #654B25.

## Avoid
- Strategy& footer branding or maroon-forward palette as the dominant look.
- STC purple, DGE blue, or unrelated client palettes.
- Hidden master placeholders, review notes, scratch pages, or think-cell artifacts.`;

const TDREDC_PPTX_FONTS = {
  title: { fontFace: 'Fund Light', fontSize: 16, bold: false, color: '595959' },
  subtitle: { fontFace: 'Fund Light', fontSize: 8, bold: false, color: '9D7539' },
  body: { fontFace: 'Fund Light', fontSize: 9, bold: false, color: '00332A' },
  footer: { fontFace: 'Fund Light', fontSize: 8, italic: false, bold: false, color: '7F7F7F' },
  slideNum: { fontFace: 'Fund Regular', fontSize: 7, minFontSize: 7, bold: false, color: 'FFFFFF', fill: 'C4995B', align: 'center' },
};

const tdredcCoverInches = {
  logo: pxRectToInches(TDREDC_LAYOUT_CONTRACT.cover.logo, TDREDC_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(TDREDC_LAYOUT_CONTRACT.cover.title, TDREDC_LAYOUT_CONTRACT.canvas), font: TDREDC_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(TDREDC_LAYOUT_CONTRACT.cover.subtitle, TDREDC_LAYOUT_CONTRACT.canvas), font: TDREDC_PPTX_FONTS.subtitle },
};

const tdredcStandardInches = {
  title: { ...pxRectToInches(TDREDC_LAYOUT_CONTRACT.standardContent.title, TDREDC_LAYOUT_CONTRACT.canvas), font: TDREDC_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(TDREDC_LAYOUT_CONTRACT.standardContent.subtitle, TDREDC_LAYOUT_CONTRACT.canvas), font: TDREDC_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(TDREDC_LAYOUT_CONTRACT.standardContent.body, TDREDC_LAYOUT_CONTRACT.canvas), font: TDREDC_PPTX_FONTS.body },
  footer: { ...pxRectToInches(TDREDC_LAYOUT_CONTRACT.standardContent.source, TDREDC_LAYOUT_CONTRACT.canvas), font: TDREDC_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(TDREDC_LAYOUT_CONTRACT.standardContent.slideNumber, TDREDC_LAYOUT_CONTRACT.canvas), font: TDREDC_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(TDREDC_LAYOUT_CONTRACT.standardContent.sectionTracker, TDREDC_LAYOUT_CONTRACT.canvas),
    font: { fontFace: 'Fund Light', fontSize: 8, bold: false },
    placement: 'center',
    canvasW: TDREDC_LAYOUT_CONTRACT.canvas.widthIn,
    align: 'center',
    paddingX: 0.32,
    textInset: 0.08,
  },
};

// ── NPC (National Planning Council — State of Qatar) ───────────────────────────
// Qatar Gov Colour Palette: Qatar maroon (#8A1538 cover panel / #89143C accent1)
// on white, Calibri typography, cover-only emblem lockup (top-right), and a
// signature gold-outlined diamond page-number marker bottom-right.
const NPC_THEME = {
  name: 'NPC',
  defaultVariant: 'npc_qatar_gov',
  colors: {
    accent: '#89143C',
    accentHover: '#6E1029',
    accentSoft: '#F3E1E7',
    onAccent: '#FFFFFF',
    heading: '#89143C',
    body: '#000000',
    muted: '#595959',
    page: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#ECE8DF',
    border: '#D9D2C4',
    success: '#129B82',
    successSoft: '#DCEEEA',
    warning: '#A29160',
    warningSoft: '#EFEBDD',
    danger: '#89143C',
    dangerSoft: '#F3E1E7',
    info: '#0F4260',
    neutral: '#4194B3',
    coverDark: '#8A1538',
    kicker: '#A29160',
    npcMaroon: '#8A1538',
    npcMaroonAlt: '#89143C',
    npcTeal: '#0F4260',
    npcGreen: '#129B82',
    npcBlue: '#4194B3',
    npcGold: '#A29160',
    npcSand: '#ECE8DF',
    npcPale: '#FDF49C',
  },
  fonts: {
    title: 'Calibri, Arial, sans-serif',
    heading: 'Calibri, Arial, sans-serif',
    body: 'Calibri, Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '21px',
      '--title-y': '31px',
      '--title-w': '909px',
      '--title-font-size': '28px',
      '--title-font-weight': '700',
      '--title-line-height': '1.12',
      '--subtitle-y': '96px',
      '--subtitle-w': '909px',
      '--subtitle-color': '#000000',
      '--subtitle-font-size': '18px',
      '--subtitle-font-weight': '700',
      '--frame-y': '133px',
      '--frame-w': '909px',
      '--frame-h': '345px',
      '--footer-x': '21px',
      '--footer-y': '500px',
      '--footer-bottom': 'auto',
      '--footer-w': '909px',
      '--footer-font-size': '8px',
      '--footer-padding-bottom': '0',
      '--source-x': '21px',
      '--source-y': '500px',
      '--source-w': '792px',
      '--source-h': '22px',
      '--slide-num-x': '886px',
      '--slide-num-y': '498px',
      '--slide-num-w': '55px',
      '--slide-num-h': '21px',
      '--npc-maroon': '#8A1538',
      '--npc-teal': '#0F4260',
      '--npc-green': '#129B82',
      '--npc-blue': '#4194B3',
      '--npc-gold': '#A29160',
      '--npc-sand': '#ECE8DF',
    },
  },
};

const NPC_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  },
  standardContent: {
    title: { x: 21, y: 31, w: 909, h: 60 },
    subtitle: { x: 21, y: 96, w: 909, h: 30 },
    body: { x: 21, y: 133, w: 909, h: 345 },
    source: { x: 21, y: 500, w: 792, h: 22 },
    slideNumber: { x: 886, y: 498, w: 55, h: 21 },
    sectionTracker: { x: 0, y: 0, w: 188, h: 18 },
  },
  cover: {
    logo: { x: 697, y: 21, w: 233, h: 68 },
    title: { x: 87, y: 196, w: 722, h: 41 },
    subtitle: { x: 87, y: 247, w: 337, h: 32 },
  },
};

const NPC_PPTX_CONTRACT = {
  slideSize: '13.333 x 7.5 in widescreen, mapped from 960 x 540 px',
  fontPolicy: 'Use Calibri for titles, body, footnotes, and page numbers; Calibri Light only for large cover display headings. Do not use Aptos, Georgia, Times, Fund fonts, STC Forward, or generic Office defaults.',
  defaultFontFace: 'Calibri',
  allowedFontFaces: ['Calibri', 'Calibri Light'],
  logoPolicy: 'NPC + Qatar-emblem lockup (image3.emf -> logo.png) at x=697 y=21 w=233 h=68 on the cover only; standard "Titel & Content" body slides have no header logo (title-only). Back cover uses the reversed white lockup centered.',
  sourcePolicy: 'Footnote/source text is blank by default; show source text only when a real source exists.',
  pageNumberPolicy: 'Bottom-right maroon (#89143C) page number, 7pt, centered inside a gold-outlined (#A29160) diamond marker with no fill.',
  titlePolicy: 'Content title at x=21 y=31 w=909 h=60; Calibri 24-28pt bold, Qatar maroon #89143C. Optional 18pt bold black kicker/subtitle directly beneath at y=96.',
  subtitlePolicy: 'Cover subtitle is white ~25pt over the maroon panel; body slides use an optional compact bold kicker line, not a wide band.',
  hiddenPlaceholderPolicy: 'Suppress embedded think-cell OLE objects ("think-cell data - do not delete") and master lorem-ipsum placeholders.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const NPC_PROMPT_CONTRACT = `# NPC profile — minimal generation contract

Follow the base Slide HTML Generator for balance, whitespace, contrast, and executive density. NPC-specific additions only:

## Brand and typography
- Use semantic theme tokens inside \`.slide .frame\` (no ad-hoc hex); the active theme encodes the National Planning Council (State of Qatar) palette and Calibri typography.
- Calibri for all normal text; Calibri Light only for large cover display headings. Do not use Georgia, STC Forward, Fund fonts, or Strategy& maroon cues.

## Layout and chrome
- Respect the NPC layout contract appended below (title, frame, footnote, page-number block).
- Content title is Qatar maroon (#89143C), bold, at x=21 y=31 w=909. An optional bold black kicker line may sit directly under the title.
- Do not place a logo on standard body slides — the native "Titel & Content" layout is title-only. Cover slides receive the bundled NPC + Qatar-emblem lockup (top-right) via chrome; never draw a fake wordmark in slide HTML.
- Page number sits bottom-right inside a gold-outlined diamond marker; keep footnote/source text blank unless a real source is provided.

## Qatar palette (categorical accents on matrices / section chips)
- Maroon \`--npc-maroon\` #8A1538 (primary), deep teal-blue \`--npc-teal\` #0F4260, green \`--npc-green\` #129B82, blue \`--npc-blue\` #4194B3, gold \`--npc-gold\` #A29160, sand \`--npc-sand\` #ECE8DF.

## Avoid
- Strategy& footer branding or a maroon-forward Strategy& palette as the dominant look.
- STC purple, DGE blue, or unrelated client palettes.
- Hidden master placeholders, review notes, scratch pages, or think-cell artifacts.`;

const NPC_PPTX_FONTS = {
  title: { fontFace: 'Calibri', fontSize: 24, bold: true, color: '89143C' },
  subtitle: { fontFace: 'Calibri', fontSize: 14, bold: true, color: '000000' },
  body: { fontFace: 'Calibri', fontSize: 11, bold: false, color: '000000' },
  footer: { fontFace: 'Calibri', fontSize: 8, italic: false, bold: false, color: '595959' },
  slideNum: { fontFace: 'Calibri', fontSize: 7, minFontSize: 7, bold: false, color: '89143C', align: 'center' },
};

const npcCoverInches = {
  logo: pxRectToInches(NPC_LAYOUT_CONTRACT.cover.logo, NPC_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(NPC_LAYOUT_CONTRACT.cover.title, NPC_LAYOUT_CONTRACT.canvas), font: { ...NPC_PPTX_FONTS.title, fontSize: 36, color: 'FFFFFF' } },
  subtitle: { ...pxRectToInches(NPC_LAYOUT_CONTRACT.cover.subtitle, NPC_LAYOUT_CONTRACT.canvas), font: { ...NPC_PPTX_FONTS.subtitle, bold: false, color: 'FFFFFF' } },
};

const npcStandardInches = {
  title: { ...pxRectToInches(NPC_LAYOUT_CONTRACT.standardContent.title, NPC_LAYOUT_CONTRACT.canvas), font: NPC_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(NPC_LAYOUT_CONTRACT.standardContent.subtitle, NPC_LAYOUT_CONTRACT.canvas), font: NPC_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(NPC_LAYOUT_CONTRACT.standardContent.body, NPC_LAYOUT_CONTRACT.canvas), font: NPC_PPTX_FONTS.body },
  footer: { ...pxRectToInches(NPC_LAYOUT_CONTRACT.standardContent.source, NPC_LAYOUT_CONTRACT.canvas), font: NPC_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(NPC_LAYOUT_CONTRACT.standardContent.slideNumber, NPC_LAYOUT_CONTRACT.canvas), font: NPC_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(NPC_LAYOUT_CONTRACT.standardContent.sectionTracker, NPC_LAYOUT_CONTRACT.canvas),
    font: { fontFace: 'Calibri', fontSize: 8, bold: false },
    placement: 'center',
    canvasW: NPC_LAYOUT_CONTRACT.canvas.widthIn,
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
    success: '#CE9C3E',
    successSoft: '#EFE4C8',
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
      '--subtitle-y': '100px',
      '--subtitle-w': '597px',
      '--subtitle-color': '#CE9C3E',
      '--subtitle-font-size': '18px',
      '--subtitle-font-weight': '400',
      '--frame-y': '132px',
      '--frame-w': '904px',
      '--frame-h': '363px',
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
    subtitle: { x: 26, y: 100, w: 597, h: 25 },
    body: { x: 26, y: 132, w: 904, h: 363 },
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
- h2.subtitle: left 26px, top 100px, width about 597px, Poppins regular 18px, FYA gold #CE9C3E.
- div.frame: left 26px, top 132px, width 904px, height 363px. Keep exhibits inside this body frame.
- Footer/source/date/page chrome sits in the bottom band around y=500–526. Keep all content clear of the bottom footer band.
- FYA logo appears bottom-left; do not use Strategy& footer branding on FYA slides.
Use the FYA standard content slide as the default. Cover/divider variants are allowed only when explicitly requested.`,
  theme: `Use FYA warm cream (#F9F7ED), gold (#CE9C3E), brown (#6E4527), red (#D83731), sand neutrals, and black text. Green (#3F8E50) is allowed only as a very small status marker or check, never as a card fill, anchor band, large panel, or dominant background. Keep the page warm and institutional. Do not use Strategy& maroon, STC purple/coral, PIF green/gold combinations, DGE blue, or MoS green bands as the dominant palette.`,
  vibe: `Federal government youth-agenda style: optimistic, warm, official, structured, and polished. Use rounded institutional panels, warm sand surfaces, compact tables, gold rules, and restrained iconography. Avoid dark consulting slides, generic SaaS dashboards, neon gradients, and playful consumer cards.`,
  writing: `Write in concise government-strategy language for youth policy, engagement, governance, initiatives, and national agenda content. Keep labels short and executive.`,
  css: `Use Poppins throughout. Prefer warm cream backgrounds, gold dividers, sand panels, and subtle brown icon strokes. Use red sparingly for risk; use green only for tiny status markers. Do not use pale-green callout panels. Keep borders thin and modules clean.`,
  pptx: `Export on a 13.333 x 7.5 in canvas using Poppins, FYA warm cream/gold/brown/red palette, the bundled FYA master, bottom-left FYA logo asset, editable footer/page chrome, and no Strategy& branding.`,
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
    structure: 'Structured stakeholder bands or swimlanes using gold separators, brown/gold highlights, and warm neutral panels.',
    useWhen: 'Stakeholder engagement, phase planning, governance, and consultation flows.',
    avoid: ['rainbow stakeholder colors', 'dense unbounded lists', 'content in footer band'],
  },
  {
    name: 'governance_matrix',
    structure: 'Compact matrix with warm cream cells, gold rules, black headings, and tiny green/red responsibility markers only.',
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
  subtitlePolicy: 'Use a compact gold subtitle at x=26 y=100 w=597 when the slide has a meaningful lens label; otherwise keep the body frame aligned to the standard band.',
  hiddenPlaceholderPolicy: 'Do not surface hidden template scratch content, think-cell artifacts, or unrelated stakeholder logos unless explicitly part of the requested content.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const FYA_PROMPT_CONTRACT = `# FYA Client Design Contract

## Master
- Use one Federal Youth Authority warm institutional master shell. Do not invent a Strategy&, STC, PIF, or DGE variant.
- Use the body frame at x=26 y=132 w=904 h=363 on the 960x540 canvas.
- Keep the bottom footer/logo/date/page band clear.
- Do not render Strategy& footer branding.

## Theme
- Use FYA warm cream (#F9F7ED), gold (#CE9C3E), brown (#6E4527), red (#D83731), sand neutrals, and black text.
- Green (#3F8E50) is only for tiny status/check markers. Never use green or pale-green as a large panel, card background, anchor band, or section fill.
- Avoid blue-led, purple-led, maroon-led, or green-led slide systems.

## Typography
- Use Poppins for title, headings, labels, and body copy.
- Keep titles compact and official; use dense but legible exhibit copy.

## Components
- Prefer pillar cards, engagement maps, governance matrices, phase plans, compact timelines, and stakeholder grids inside the body frame.
- Use warm neutral panels, thin gold rules, tiny status markers only, and restrained brown/gold icons.`;

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

const MOS_THEME = {
  name: 'MoS',
  defaultVariant: 'mos_sport_performance_green',
  colors: {
    accent: '#0B5921',
    accentHover: '#073B16',
    accentSoft: '#E7F3EA',
    onAccent: '#FFFFFF',
    heading: '#000000',
    body: '#2C2C2C',
    muted: '#7F7F7F',
    page: '#FFFFFF',
    surface: '#F2F2F2',
    surfaceAlt: '#E7F3EA',
    border: '#80C7A7',
    success: '#0E762C',
    successSoft: '#DFF3E6',
    warning: '#BD9608',
    warningSoft: '#F6EBC4',
    danger: '#670F31',
    dangerSoft: '#F3DDE6',
    info: '#074F77',
    neutral: '#7F7F7F',
    coverDark: '#073B16',
    kicker: '#0E762C',
    mosDarkGreen: '#073B16',
    mosGreen: '#0B5921',
    mosBrightGreen: '#0E762C',
    mosGold: '#BD9608',
    mosLightGreen: '#80C7A7',
  },
  fonts: {
    title: '"Sakkal Majalla", Arial, sans-serif',
    heading: '"Sakkal Majalla", Arial, sans-serif',
    body: '"Sakkal Majalla", Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '35px',
      '--title-y': '28px',
      '--title-w': '890px',
      '--title-font-size': '28px',
      '--title-font-weight': '700',
      '--title-line-height': '1.12',
      '--subtitle-y': '104px',
      '--subtitle-w': '890px',
      '--subtitle-color': '#073B16',
      '--subtitle-font-size': '18px',
      '--subtitle-font-weight': '700',
      '--frame-y': '132px',
      '--frame-w': '890px',
      '--frame-h': '349px',
      '--footer-x': '0px',
      '--footer-y': '503px',
      '--footer-bottom': 'auto',
      '--footer-w': '960px',
      '--footer-font-size': '10px',
      '--footer-padding-bottom': '0',
      '--source-x': '132px',
      '--source-y': '518px',
      '--source-w': '710px',
      '--source-h': '16px',
      '--slide-num-x': '914px',
      '--slide-num-y': '518px',
      '--slide-num-w': '20px',
      '--slide-num-h': '16px',
    },
  },
};

const MOS_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  },
  standardContent: {
    logo: { x: 18, y: 510, w: 95, h: 25 },
    title: { x: 35, y: 28, w: 890, h: 72 },
    subtitle: { x: 35, y: 104, w: 890, h: 24 },
    body: { x: 35, y: 132, w: 890, h: 349 },
    source: { x: 132, y: 518, w: 710, h: 16 },
    slideNumber: { x: 914, y: 518, w: 20, h: 16 },
    sectionTracker: { x: 106, y: 12, w: 110, h: 12 },
  },
  cover: {
    logo: { x: 739, y: 18, w: 179, h: 88 },
    title: { x: 76, y: 150, w: 310, h: 90 },
    subtitle: { x: 76, y: 258, w: 305, h: 32 },
  },
};

const MOS_FREESTYLE_OVERRIDES = {
  shell: `Use the Ministry of Sport (MoS) performance-management master on a 960x540 canvas. These MoS positions replace generic shell defaults:
- h1.title: left 35px, top 28px, width about 890px, Sakkal Majalla bold 28px, black, compact one- to two-line headline.
- h2.subtitle: left 35px, top 104px, width about 890px, Sakkal Majalla bold 18px, dark MoS green #073B16.
- div.frame: left 35px, top 132px, width 890px, height 349px. Keep performance exhibits, tables, chains, and benchmark cards inside this body frame.
- Footer/source/page chrome sits in the dark-green bottom band around y=503–540; keep content clear of the footer.
- MoS logo appears bottom-left on standard content pages and larger/top-right on covers where the master uses image-led hero layouts.
Use standard white content pages with dark-green footer bands by default; reserve stadium/photo covers and section dividers for explicit cover/section requests.`,
  theme: `Use MoS dark green (#073B16), primary green (#0B5921), bright green (#0E762C), light green #80C7A7, white, light gray #F2F2F2, and charcoal #2C2C2C. Use gold #BD9608 only as a tiny secondary accent when necessary, never as a dominant card/header color. Do not use Strategy& maroon, STC purple, PIF dark green/gold pairing, DGE blue, or FYA cream as the dominant system.`,
  vibe: `Sport-sector performance management: official, analytical, structured, and energetic. Use green benchmark bands, arrow chains, KPI tables, pillar cards, and concise methodology blocks. Avoid decorative consumer sport styling and generic SaaS dashboards.`,
  writing: `Write concise performance-management language: benchmarks, KPI design, governance, data/reporting, operating model, insights, implications, and Ministry of Sport actions.`,
  css: `Use Sakkal Majalla throughout. Prefer white pages, dark-green bands, green headers, light-gray or pale-green panels, thin green borders, and compact tables. Avoid gold except for minor callouts. Icons should be simple black or green line icons.`,
  pptx: `Export on a 13.333 x 7.5 in canvas using Sakkal Majalla, MoS green/gold palette, bundled MoS master, real MoS logo asset, editable footer/page chrome, and no Strategy& branding.`,
};

const MOS_COMPONENT_PATTERNS = [
  {
    name: 'benchmark_flow',
    structure: 'Three-stage arrow or card flow with dark-green active stage and pale-green inactive stages.',
    useWhen: 'Benchmark methodology, foundation/assessment/insight narratives, and section openers.',
    avoid: ['unbranded blue arrows', 'maroon Strategy& bars', 'unbounded text blocks'],
  },
  {
    name: 'performance_pillar_cards',
    structure: 'Four compact cards with green header strips, line icons, and crisp implications.',
    useWhen: 'Assessment pillars, capability needs, key themes, and operating-model dimensions.',
    avoid: ['oversized cards', 'low-density decorative illustrations', 'consumer sport colors'],
  },
  {
    name: 'kpi_matrix',
    structure: 'Dense table or value-chain matrix with green row/column headers, gray cells, and check/status markers.',
    useWhen: 'KPI architecture, governance comparison, ministry benchmarking, and maturity assessment.',
    avoid: ['large font tables that overflow', 'icons detached from cells', 'content below footer band'],
  },
];

const MOS_PPTX_CONTRACT = {
  slideSize: { w: 13.333, h: 7.5 },
  defaultFontFace: 'Sakkal Majalla',
  allowedFontFaces: ['Sakkal Majalla'],
  logoPolicy: 'MoS logo bottom-left on standard slides; larger logo only on cover/photo layouts.',
  sourcePolicy: 'Footer/source text is compact and optional; never collide with bottom-left logo.',
  pageNumberPolicy: 'Small bottom-right page number in Sakkal Majalla.',
  titlePolicy: 'Standard title at x=35 y=28 w=890 on the 960x540 canvas, Sakkal Majalla bold 28pt, black.',
  subtitlePolicy: 'Dark-green subtitle at x=35 y=104, Sakkal Majalla bold 18pt, when a section/lens label is useful.',
  hiddenPlaceholderPolicy: 'Do not surface hidden think-cell data, scratch placeholders, or unrelated benchmark report artifacts unless explicitly requested.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const MOS_PROMPT_CONTRACT = `# MoS Client Design Contract

## Master
- Use one Ministry of Sport performance-management master shell. Do not invent Strategy&, STC, PIF, DGE, or FYA variants.
- Use the body frame at x=35 y=132 w=890 h=349 on the 960x540 canvas.
- Keep the bottom dark-green footer/logo/page band clear.
- Do not render Strategy& footer branding.

## Theme
- Use MoS dark green (#073B16), primary green (#0B5921), bright green (#0E762C), light green (#80C7A7), white, light gray, and charcoal. Gold (#BD9608) is minor accent only.
- Avoid maroon-led, purple-led, blue-led, or cream-led slide systems.

## Typography
- Sakkal Majalla is the official font. Use it for titles, labels, body, and footer.
- Keep dense tables legible and compact.

## Components
- Prefer benchmark flows, pillar cards, KPI matrices, value-chain maps, comparison tables, and implication panels inside the body frame.
- Use green bands, pale-green panels, thin borders, and avoid gold-led layouts.`;

const MOS_PPTX_FONTS = {
  title: { fontFace: 'Sakkal Majalla', fontSize: 28, bold: true, color: '000000' },
  subtitle: { fontFace: 'Sakkal Majalla', fontSize: 18, bold: true, color: '073B16' },
  body: { fontFace: 'Sakkal Majalla', fontSize: 10, bold: false, color: '2C2C2C' },
  footer: { fontFace: 'Sakkal Majalla', fontSize: 8, italic: false, bold: false, color: 'FFFFFF' },
  slideNum: { fontFace: 'Sakkal Majalla', fontSize: 13, bold: false, color: 'FFFFFF' },
};

const mosStandardInches = {
  logo: pxRectToInches(MOS_LAYOUT_CONTRACT.standardContent.logo, MOS_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(MOS_LAYOUT_CONTRACT.standardContent.title, MOS_LAYOUT_CONTRACT.canvas), font: MOS_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(MOS_LAYOUT_CONTRACT.standardContent.subtitle, MOS_LAYOUT_CONTRACT.canvas), font: MOS_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(MOS_LAYOUT_CONTRACT.standardContent.body, MOS_LAYOUT_CONTRACT.canvas), font: MOS_PPTX_FONTS.body },
  footer: { ...pxRectToInches(MOS_LAYOUT_CONTRACT.standardContent.source, MOS_LAYOUT_CONTRACT.canvas), font: MOS_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(MOS_LAYOUT_CONTRACT.standardContent.slideNumber, MOS_LAYOUT_CONTRACT.canvas), font: MOS_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(MOS_LAYOUT_CONTRACT.standardContent.sectionTracker, MOS_LAYOUT_CONTRACT.canvas),
    colors: { fill: '0B5921', subFill: '073B16', text: 'FFFFFF', subText: 'FFFFFF' },
    font: { fontFace: 'Sakkal Majalla', fontSize: 8, bold: true },
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
      '--title-font-weight': '600',
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

const SE_THEME = {
  name: 'SE',
  defaultVariant: 'se_blue_energy',
  // Native master theme slots (theme1.xml): accent1 #001F5E, accent2/dk2 #0080FF,
  // accent3 #00FF86 (subtitle), accent4 #008BB9, accent6 #BFBFBF.
  colors: {
    accent: '#001F5E',
    accentHover: '#008BB9',
    accentSoft: '#DCE4F0',
    onAccent: '#FFFFFF',
    heading: '#0080FF',
    body: '#1D252D',
    muted: '#5A6B7A',
    page: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F2F2F2',
    border: '#A6CAEC',
    success: '#00FF86',
    successSoft: '#E5FFF3',
    warning: '#32C2FF',
    warningSoft: '#E8F7FF',
    danger: '#1F4A8E',
    dangerSoft: '#DCE4F0',
    info: '#008BB9',
    neutral: '#BFBFBF',
    coverDark: '#001F5E',
    kicker: '#00FF86',
    seDarkBlue: '#001F5E',
    seMidBlue: '#0080FF',
    seLightBlue: '#32C2FF',
    seDeepBlue: '#0027B9',
    seTeal: '#008BB9',
    seGreen: '#00FF86',
    sePanel: '#DCE4F0',
    sePhaseGrey: '#BFBFBF',
    sePhaseBlue: '#1F4A8E',
  },
  fonts: {
    title: '"SE Medium", "SE", Arial, sans-serif',
    heading: '"SE Medium", "SE", Arial, sans-serif',
    body: '"SE", Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '35px',
      '--title-y': '30px',
      '--title-w': '890px',
      '--title-font-size': '32px',
      '--title-font-weight': '500',
      '--title-line-height': '1.15',
      '--subtitle-y': '101px',
      '--subtitle-w': '890px',
      '--subtitle-color': '#00FF86',
      '--accent': '#001F5E',
      '--neutral-fill': '#BFBFBF',
      '--rose-fill': '#008BB9',
      '--subtitle-font-size': '18px',
      '--subtitle-font-weight': '700',
      '--frame-y': '137px',
      '--frame-w': '890px',
      '--frame-h': '353px',
      '--footer-x': '35px',
      '--footer-y': '500px',
      '--footer-bottom': 'auto',
      '--footer-w': '890px',
      '--footer-font-size': '8px',
      '--footer-padding-bottom': '0',
      '--source-x': '192px',
      '--source-y': '500px',
      '--source-w': '576px',
      '--source-h': '22px',
      '--slide-num-x': '786px',
      '--slide-num-y': '511px',
      '--slide-num-w': '139px',
      '--slide-num-h': '11px',
    },
  },
};

const SE_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  },
  // Audited from bundled master slideLayout13/14/16 (standard content layouts).
  standardContent: {
    logo: { x: 35, y: 511, w: 139, h: 11 },
    title: { x: 35, y: 30, w: 890, h: 66 },
    subtitle: { x: 35, y: 101, w: 890, h: 25 },
    body: { x: 35, y: 137, w: 890, h: 353 },
    source: { x: 192, y: 500, w: 576, h: 22 },
    slideNumber: { x: 786, y: 511, w: 139, h: 11 },
    sectionTracker: { x: 0, y: 16, w: 153, h: 19 },
    topAccentBar: { x: 315, y: 21, w: 594, h: 10 },
  },
  cover: {
    logo: { x: 35, y: 500, w: 139, h: 26 },
    title: { x: 35, y: 120, w: 760, h: 120 },
    subtitle: { x: 35, y: 250, w: 700, h: 40 },
  },
};

const SE_FREESTYLE_OVERRIDES = {
  shell: `Use the SE (Saudi Electricity) master shell on a 960x540 canvas. These audited positions match Brand Guidelines / native master (13.333x7.5in mapped to 960x540):
- h1.title: left 35px (0.484in), top 30px (0.420in), width 890px (12.365in), height up to 66px (0.920in), SE Medium 32px, color #0080FF (secondary Mid Blue).
- h2.subtitle: left 35px, top 101px (1.396in), width 890px, height 25px (0.350in), SE bold 18px, color #00FF86 when needed.
- div.frame: left 35px, top 137px, width 890px, height 353px — all body content must stay inside this band (ends ~y=490).
- Footer/source/page chrome: source band y≈500, page number y≈511; do not place frame content below y=490.
- Top section tracker y≈16px (height 19px); optional top accent bar y≈21px — keep clear of title/subtitle.
- Do not add an extra SE logo in HTML; the bundled master footer already includes branding.
Use the SE standard content slide as the default. Cover/divider variants are allowed only when explicitly requested.`,
  theme: `SE Brand Guidelines palette — use PRIMARY and SECONDARY inside slides. PRIMARY: Dark blue #001F5E, White #FFFFFF. SECONDARY: Mid Blue #0080FF, Light Blue #32C2FF, Green #00FF86 (subtitle chrome only), Teal #008BB9, Deep blue #0027B9, greys #BFBFBF / #9BA2AF / #E6E8EB. TERTIARY colors (orange #EF9B00, red #E10054, purple #8035BB, tertiary green #00B476, pink/coral #d4687a, Strategy& maroon) are FORBIDDEN as frame fills, roadmap phases, or chart series. Slide chrome: title #0080FF, subtitle #00FF86 (bold). Structural bars/column caps: #001F5E with white text. Multi-column exhibits: rotate #001F5E, #0080FF, #008BB9, #32C2FF, #BFBFBF, #1F4A8E — never pink/purple/orange.`,
  vibe: `Modern Saudi energy utility style: confident, clean, institutional, and forward-looking. Use crisp blue geometry, thin rules, structured grids, and restrained iconography. Avoid generic Office chart palettes, maroon consulting styling, dusty-rose Strategy& tokens, and playful consumer UI.`,
  writing: `Write in concise executive energy-sector language: grids, sustainability, reliability, investment, digital, and national energy themes. Keep labels short and outcome-led.`,
  css: `SE Medium 32px for h1.title in #0080FF. Subtitle SE bold 18px in #00FF86. Body in SE regular #1D252D. In every .slide .frame { } block set: --accent: #001F5E; --neutral-fill: #BFBFBF; --rose-fill: #008BB9; never #d4687a or #4b5563 Strategy& defaults. Column header bars: #001F5E fill, white label text. Pillar/phase accents only from primary/secondary blues and greys (#001F5E, #0080FF, #008BB9, #32C2FF, #0027B9, #BFBFBF, #1F4A8E).`,
  pptx: `Export on a 13.333 x 7.5 in canvas using SE Medium / SE fonts and the bundled SE master. Do not inject a duplicate footer logo — the master already includes SE branding. Title 0080FF, subtitle 00FF86, structural fills 001F5E.`,
};

const SE_COMPONENT_PATTERNS = [
  {
    name: 'energy_pillar_cards',
    structure: 'White or pale-blue cards with dark-blue headers, mid-blue labels, and compact body copy.',
    useWhen: 'Strategic pillars, initiatives, programs, and operating priorities.',
    avoid: ['maroon Strategy& bars', 'purple STC styling', 'warm FYA cream cards'],
  },
  {
    name: 'timeline_roadmap',
    structure: 'Roadmap/phases: navy #001F5E headers, timeframe labels #0080FF, phase accents rotate #0080FF / #008BB9 / #32C2FF / #BFBFBF only; panels #DCE4F0. No pink, green, orange, or purple phase colors.',
    useWhen: 'Roadmaps, transformation phases, and delivery horizons.',
    avoid: ['pink/coral pillar accents', 'dense unbounded lists', 'footer-band content', 'dominant full-slide green fills'],
  },
  {
    name: 'insight_panel',
    structure: 'Right-side insight column on pale-blue fill with white interior callout and dark-blue headline.',
    useWhen: 'Key insights, executive takeaways, and synthesis slides.',
    avoid: ['full-bleed photo without text contrast', 'oversized decorative icons'],
  },
];

const SE_PPTX_CONTRACT = {
  slideSize: { w: 13.333, h: 7.5 },
  defaultFontFace: 'SE Medium',
  allowedFontFaces: ['SE Medium', 'SE', 'SE Regular', 'SE Bold', 'SE SemiBold'],
  logoPolicy: 'Do not add a duplicate SE logo — the bundled master footer already includes branding.',
  sourcePolicy: 'Use footer/source text only when real source text exists; keep it compact in the bottom band.',
  pageNumberPolicy: 'Bottom-right page number in SE regular, muted neutral text.',
  titlePolicy: 'Content title at x=35 y=30 w=890 h=66 (0.484/0.420/12.365/0.920 in), SE Medium 32pt, color 0080FF.',
  subtitlePolicy: 'Subtitle at x=35 y=101 w=890 h=25 (1.396/0.350 in), SE bold 18pt, color 00FF86, when the slide has a meaningful lens label.',
  bodyPolicy: 'Body/content frame at x=35 y=137 w=890 h=353; do not extend content into the footer band below y=490.',
  hiddenPlaceholderPolicy: 'Do not surface hidden template scratch content or unrelated stakeholder logos unless explicitly requested.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const SE_PROMPT_CONTRACT = `# SE Client Design Contract

## Master
- Use one Saudi Electricity (SE) master shell. Do not invent Strategy&, STC, PIF, DGE, FYA, or MoS variants.
- Use the body frame at x=35 y=137 w=890 h=353 on the 960x540 canvas (native body placeholder).
- Keep the bottom footer/logo/page band and top tracker band clear.
- Do not render Strategy& footer branding.

## Theme (Brand Guidelines — primary + secondary only)
- PRIMARY: #001F5E, #FFFFFF. SECONDARY: #0080FF, #32C2FF, #008BB9, #0027B9, greys #BFBFBF/#E6E8EB.
- Slide chrome: title #0080FF, subtitle #00FF86 (bold). Structural bars: #001F5E, white text.
- Frame content: rotate blues/greys above; panels #DCE4F0; body #1D252D. FORBIDDEN in frame: tertiary orange/red/purple (#EF9B00, #E10054, #8035BB, #00B476), pink/coral #d4687a, Strategy& maroon. Subtitle green #00FF86 is for h2.subtitle only.

## Typography
- Use SE Medium 32px/32pt for slide titles and SE bold 18px/18pt for subtitles. Body in SE regular 12pt. Keep titles compact and institutional.

## Components
- Prefer pillar cards, roadmaps, KPI bands, comparison matrices, and insight panels inside the body frame.`;

const SE_PPTX_FONTS = {
  title: { fontFace: 'SE Medium', fontSize: 32, bold: false, color: '0080FF' },
  subtitle: { fontFace: 'SE', fontSize: 18, bold: true, color: '00FF86' },
  body: { fontFace: 'SE', fontSize: 12, bold: false, color: '1D252D' },
  footer: { fontFace: 'SE', fontSize: 8, italic: false, bold: false, color: '5A6B7A' },
  slideNum: { fontFace: 'SE', fontSize: 8, bold: false, color: '5A6B7A' },
};

const seStandardInches = {
  logo: pxRectToInches(SE_LAYOUT_CONTRACT.standardContent.logo, SE_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(SE_LAYOUT_CONTRACT.standardContent.title, SE_LAYOUT_CONTRACT.canvas), font: SE_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(SE_LAYOUT_CONTRACT.standardContent.subtitle, SE_LAYOUT_CONTRACT.canvas), font: SE_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(SE_LAYOUT_CONTRACT.standardContent.body, SE_LAYOUT_CONTRACT.canvas), font: SE_PPTX_FONTS.body },
  footer: { ...pxRectToInches(SE_LAYOUT_CONTRACT.standardContent.source, SE_LAYOUT_CONTRACT.canvas), font: SE_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(SE_LAYOUT_CONTRACT.standardContent.slideNumber, SE_LAYOUT_CONTRACT.canvas), font: SE_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(SE_LAYOUT_CONTRACT.standardContent.sectionTracker, SE_LAYOUT_CONTRACT.canvas),
    colors: { fill: '001F5E', subFill: '0080FF', text: 'FFFFFF', subText: 'FFFFFF' },
    font: { fontFace: 'SE Medium', fontSize: 8, bold: false },
    paddingX: 0.18,
    textInset: 0.05,
  },
};

const NEOM_THEME = {
  name: 'NEOM Authority',
  defaultVariant: 'neom_authority_activation',
  colors: {
    accent: '#EBC03F',
    accentHover: '#F5DFA2',
    accentSoft: '#FBF8E9',
    onAccent: '#13100D',
    heading: '#13100D',
    body: '#13100D',
    muted: '#4E4C4A',
    page: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#FBF8E9',
    border: '#E6E8EB',
    success: '#006B44',
    successSoft: '#C2DBD0',
    warning: '#EF9B00',
    warningSoft: '#FBE2CB',
    danger: '#E10054',
    dangerSoft: '#F7D0D0',
    info: '#007BB5',
    neutral: '#9BA2AF',
    coverDark: '#13100D',
    kicker: '#13100D',
    neomDark: '#13100D',
    neomYellow: '#EBC03F',
    neomCream: '#FBF8E9',
  },
  fonts: {
    title: 'Arial, Helvetica, sans-serif',
    heading: 'Arial, Helvetica, sans-serif',
    body: 'Arial, Helvetica, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '29px',
      '--title-y': '29px',
      '--title-w': '902px',
      '--title-font-size': '20px',
      '--title-font-weight': '700',
      '--title-line-height': '1.1',
      '--subtitle-y': '77px',
      '--subtitle-w': '902px',
      '--subtitle-color': '#13100D',
      '--subtitle-font-size': '18px',
      '--subtitle-font-weight': '400',
      '--frame-y': '110px',
      '--frame-w': '902px',
      '--frame-h': '390px',
      '--footer-x': '29px',
      '--footer-y': '508px',
      '--footer-bottom': 'auto',
      '--footer-w': '902px',
      '--footer-font-size': '7px',
      '--footer-padding-bottom': '0',
      '--neom-line-x': '80px',
      '--neom-line-y': '517px',
      '--neom-line-w': '818px',
      '--neom-line-h': '2px',
      '--source-x': '336px',
      '--source-y': '527px',
      '--source-w': '288px',
      '--source-h': '12px',
      '--slide-num-x': '905px',
      '--slide-num-y': '518px',
      '--slide-num-w': '26px',
      '--slide-num-h': '9px',
      '--accent': '#EBC03F',
      '--neutral-fill': '#13100D',
      '--on-neutral-fill': '#FFFFFF',
      '--rose-fill': '#898786',
    },
  },
};

const NEOM_LAYOUT_CONTRACT = {
  canvas: {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  },
  standardContent: {
    logoIcon: { x: 5, y: 509, w: 27, h: 26 },
    logo: { x: 35, y: 517, w: 45, h: 12 },
    title: { x: 29, y: 29, w: 902, h: 44 },
    subtitle: { x: 29, y: 77, w: 902, h: 25 },
    body: { x: 29, y: 110, w: 902, h: 390 },
    source: { x: 336, y: 527, w: 288, h: 12 },
    slideNumber: { x: 905, y: 518, w: 26, h: 9 },
    activationLine: { x: 80, y: 517, w: 813, h: 2 },
    sectionTracker: { x: 0, y: 0, w: 280, h: 16 },
  },
  cover: {
    logo: { x: 35, y: 500, w: 45, h: 12 },
    title: { x: 29, y: 120, w: 760, h: 80 },
    subtitle: { x: 29, y: 210, w: 700, h: 40 },
  },
};

const NEOM_FREESTYLE_OVERRIDES = {
  shell: `Use the NEOM Authority master shell on 960x540 (13.333x7.5in native, 72px/in).
- h1.title: left 29px, top 29px, width 902px, height up to 44px (max 2 lines), Arial bold 20px, ALL CAPS, color #13100D.
- h2.subtitle: left 29px, top 77px, width 902px, height 25px, Arial regular 18px, ALL CAPS, color #13100D when used (optional on many body slides).
- div.frame: left 29px, top 110px, width 902px, height 390px — all exhibit content stays inside.
- Do not place logos in the title, subtitle, or top-left corner; the bottom-left logo is injected by preview chrome.
- Footer: optional gold rule (#EBC03F) from x≈80 y≈517 toward the right content edge; page number right-aligned at x≈905. Do not add footer branding, program labels, or "NEOM AUTHORITY ACTIVATION" text — leave the first footer span empty.
- Bottom-left chrome matches master: colored icon (~5,509 27x26) + NEOM wordmark (~35,517 45x12). Do not place logos in HTML.
Reference slide 46 (NAFB5) for yellow column headers (#EBC03F fill, #13100D text) and three-column layouts.`,
  theme: `NEOM Authority palette from NAFB5 / master theme. Primary dark #13100D, white #FFFFFF, accent yellow #EBC03F for column headers and highlights. Body text #13100D on white; muted labels #4E4C4A for captions only (not badge fills). Inside .frame set --accent: #EBC03F; --neutral-fill: #13100D; --on-neutral-fill: #FFFFFF; --on-accent: #13100D (yellow fills only). On #13100D / var(--neutral-fill) use var(--on-neutral-fill) or #FFFFFF — never var(--on-accent). On #EBC03F / var(--accent) use var(--on-accent). --rose-fill: #898786 for borders/dividers only. Never Strategy& pink #d4687a or grey badge fills (#4b5563, #4E4C4A) behind dark text.`,
  vibe: `Institutional Saudi giga-project style: clean white field, bold ALL CAPS title, regular-weight subtitle, yellow structural bars, compact Arial typography, icon-supported rows. Avoid Strategy& maroon, STC purple, or generic Office chart colors.`,
  writing: `Match the user's requested topic and industry — do not assume NEOM Authority, mandates, activation, or regulatory themes unless the user asks for them. Keep labels short and executive. Titles/subtitles render ALL CAPS via CSS only.`,
  css: `h1.title { text-transform: uppercase; letter-spacing: 0.02em; font-weight: 700; } h2.subtitle { text-transform: uppercase; letter-spacing: 0.02em; font-weight: 400; }. Column/section headers: background #EBC03F, text #13100D, Arial bold 11-12px, square corners. Hub/cap badges on dark #13100D fills: color #FFFFFF or var(--on-neutral-fill), never var(--on-accent). Step/index squares: background #13100D, color #FFFFFF. Body 11-12px Arial regular #13100D. Yellow header only: .neomHead { background: var(--accent); color: var(--on-accent); padding: 8px 10px; font-weight: 700; text-transform: uppercase; }`,
  pptx: `Export on 13.333x7.5in canvas with bundled NEOM master. Title Arial bold ALL CAPS; subtitle Arial regular 18pt ALL CAPS. No footer program label — bottom-left logo from master/chrome only; page number bottom-right.`,
};

const NEOM_COMPONENT_PATTERNS = [
  {
    name: 'yellow_column_headers',
    structure: 'Three- or four-column grid with #EBC03F header bars, dark #13100D labels, white body cells (see slide 46 mandate layout).',
    useWhen: 'Mandate maps, RA/RI columns, business priorities, service catalogues.',
    avoid: ['maroon Strategy& bars', 'rounded consumer cards', 'purple STC styling'],
  },
  {
    name: 'icon_text_rows',
    structure: 'Compact rows with small icons and 11pt Arial labels on white or cream panels.',
    useWhen: 'Entity lists, deliverables, activation workstreams.',
    avoid: ['oversized icons', 'footer-band content'],
  },
  {
    name: 'mandate_center_panel',
    structure: 'Center narrative panel with bordered columns on left/right (slide 46 Authority Mandate pattern).',
    useWhen: 'Authority aim, regulatory objective, strategic objective slides.',
    avoid: ['dense 8+ column grids', 'text below footer band'],
  },
];

const NEOM_PPTX_CONTRACT = {
  slideSize: { w: 13.333, h: 7.5 },
  defaultFontFace: 'Arial',
  allowedFontFaces: ['Arial', 'Helvetica'],
  logoPolicy: 'Master footer includes NEOM logo — do not inject a duplicate logo in export.',
  sourcePolicy: 'Keep footer center/source blank unless the user provides real source text. Do not add NEOM AUTHORITY ACTIVATION or other program labels.',
  pageNumberPolicy: 'Bottom-right page number, Arial 7-8pt, #13100D.',
  titlePolicy: 'Title at x=29 y=29 w=902 h=44 (max 2 lines), Arial bold 20pt ALL CAPS, #13100D.',
  subtitlePolicy: 'Subtitle at x=29 y=77 w=902 h=25, Arial regular 18pt ALL CAPS, #13100D, optional.',
  bodyPolicy: 'Body frame x=29 y=110 w=902 h=390; keep content above footer band.',
  hiddenPlaceholderPolicy: 'Do not surface master placeholder instructional text.',
  borderWeightPt: { min: 0.5, max: 1 },
};

const NEOM_PROMPT_CONTRACT = `# NEOM Authority Client Design Contract

## Master
- NEOM Authority (NAFB5) shell only. Canvas 960x540 mapped from 13.333x7.5in.
- Body frame: x=29 y=110 w=902 h=390.
- Footer: page number bottom-right only; bottom-left logo from master/chrome. No program label in footer.

## Theme
- Dark #13100D text, white page, yellow #EBC03F column headers, cream panels #FBF8E9 optional.
- Title ALL CAPS Arial bold 20px; subtitle ALL CAPS Arial regular 18px.

## Components
- Yellow header grids, icon rows, mandate three-column layouts inside frame.`;

const NEOM_PPTX_FONTS = {
  title: { fontFace: 'Arial', fontSize: 20, bold: true, color: '13100D', uppercase: true },
  subtitle: { fontFace: 'Arial', fontSize: 18, bold: false, color: '13100D', uppercase: true },
  body: { fontFace: 'Arial', fontSize: 11, bold: false, color: '13100D' },
  footer: { fontFace: 'Arial', fontSize: 7, bold: true, color: '13100D' },
  slideNum: { fontFace: 'Arial', fontSize: 8, bold: false, color: '13100D' },
};

const neomStandardInches = {
  logoIcon: pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.logoIcon, NEOM_LAYOUT_CONTRACT.canvas),
  logo: pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.logo, NEOM_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.title, NEOM_LAYOUT_CONTRACT.canvas), font: NEOM_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.subtitle, NEOM_LAYOUT_CONTRACT.canvas), font: NEOM_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.body, NEOM_LAYOUT_CONTRACT.canvas), font: NEOM_PPTX_FONTS.body },
  footer: { ...pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.source, NEOM_LAYOUT_CONTRACT.canvas), font: NEOM_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.slideNumber, NEOM_LAYOUT_CONTRACT.canvas), font: NEOM_PPTX_FONTS.slideNum },
  activationLine: pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.activationLine, NEOM_LAYOUT_CONTRACT.canvas),
  sectionTracker: {
    ...pxRectToInches(NEOM_LAYOUT_CONTRACT.standardContent.sectionTracker, NEOM_LAYOUT_CONTRACT.canvas),
    colors: { fill: '13100D', text: 'FFFFFF', subFill: 'EBC03F', subText: '13100D' },
    font: { fontFace: 'Arial', fontSize: 8, bold: true },
    placement: 'left',
  },
};

const ADSC_THEME = {
  name: 'ADSC',
  defaultVariant: 'adsc_sports',
  // Abu Dhabi Sports Council deck (Strategy& Digital template base): coral accent,
  // navy/slate structure, grey muted, light surfaces, cyan/bronze pops.
  colors: {
    accent: '#DB536A',
    accentHover: '#C2445A',
    accentSoft: '#FBE7EA',
    onAccent: '#FFFFFF',
    heading: '#FFFFFF',
    body: '#29333F',
    muted: '#7F7F7F',
    page: '#FFFFFF',
    surface: '#F4F8FF',
    surfaceAlt: '#EEF5F9',
    border: '#D9D9D9',
    success: '#1E9E77',
    successSoft: '#E4F5EE',
    warning: '#C98A1E',
    warningSoft: '#FBF1DE',
    danger: '#C0392B',
    dangerSoft: '#F8E4E1',
    info: '#0FB5C4',
    infoSoft: '#E2F7FA',
    neutral: '#7F7F7F',
    coverDark: '#0C182B',
    kicker: '#DB536A',
    neutralFill: '#0C182B',
    onNeutralFill: '#FFFFFF',
    roseFill: '#DB536A',
    adscCoral: '#DB536A',
    adscNavy: '#0C182B',
    adscSlate: '#414E5F',
    adscCyan: '#12B5C9',
    adscBronze: '#BD825A',
  },
  fonts: {
    title: 'Georgia, "Times New Roman", serif',
    heading: 'Arial, Helvetica, sans-serif',
    body: 'Arial, Helvetica, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '35px',
      '--title-y': '30px',
      '--title-w': '890px',
      '--title-font-size': '28px',
      '--title-font-weight': '400',
      '--title-line-height': '1.05',
      '--subtitle-y': '100px',
      '--subtitle-w': '890px',
      '--subtitle-color': '#DB536A',
      '--accent': '#DB536A',
      '--neutral-fill': '#0C182B',
      '--rose-fill': '#DB536A',
      '--subtitle-font-size': '18px',
      '--subtitle-font-weight': '700',
      '--frame-y': '134px',
      '--frame-w': '890px',
      '--frame-h': '350px',
      '--footer-x': '35px',
      '--footer-y': '500px',
      '--footer-bottom': 'auto',
      '--footer-w': '139px',
      '--footer-font-size': '8px',
      '--footer-padding-bottom': '0',
      '--source-x': '192px',
      '--source-y': '500px',
      '--source-w': '576px',
      '--source-h': '22px',
      '--slide-num-x': '786px',
      '--slide-num-y': '511px',
      '--slide-num-w': '139px',
      '--slide-num-h': '11px',
    },
  },
};

const ADSC_LAYOUT_CONTRACT = {
  canvas: { widthPx: 960, heightPx: 540, widthIn: 13.333, heightIn: 7.5 },
  // Audited from the bundled master "2_One Column" content layout (slideLayout1).
  standardContent: {
    logo: { x: 16, y: 415, w: 204, h: 102 },
    title: { x: 35, y: 30, w: 890, h: 66 },
    subtitle: { x: 35, y: 100, w: 890, h: 25 },
    body: { x: 35, y: 134, w: 890, h: 350 },
    source: { x: 192, y: 500, w: 576, h: 22 },
    slideNumber: { x: 786, y: 511, w: 139, h: 11 },
    sectionTracker: { x: 0, y: 0, w: 280, h: 16 },
  },
  cover: {
    logo: { x: 16, y: 415, w: 204, h: 102 },
    title: { x: 37, y: 120, w: 431, h: 170 },
    subtitle: { x: 37, y: 328, w: 431, h: 22 },
  },
};

const ADSC_FREESTYLE_OVERRIDES = {
  shell: `Use the ADSC master shell on a 960x540 canvas. The slide background is a FULL-BLEED dark stadium photo provided by the shell — do NOT add your own background color or image, and do not hide it with an opaque full-slide fill. Positions match the bundled master "One Column" content layout (13.333x7.5in):
- h1.title: left 35px, top 30px, width 890px, height 66px (text bottom-aligned), Georgia 28px, color WHITE #FFFFFF (sits on the dark sky).
- h2.subtitle: left 35px, top 100px, width 890px, height 25px, Arial bold 18px, color coral #DB536A.
- div.frame: left 35px, top 134px, width 890px, height 350px — body content lives here over the photo.
- Put exhibits/charts/dense content inside DARK TRANSLUCENT navy panels (frosted, white text) so the stadium still shows through and content stays legible — do NOT use opaque white card blocks. Short labels placed directly on the photo are white. Keep frame content above the footer band (y<490).
- Footer/source/page chrome sits in the bottom band; the master provides it. Do not add a client logo on content slides; the cover carries the logo.`,
  theme: `Dark stadium-photo background. Title WHITE Georgia 28; subtitle CORAL #DB536A Arial 18 bold. Content panels: DARK TRANSLUCENT navy (rgba(12,24,43,0.6-0.85)) with WHITE text and coral accents — never opaque white blocks (they hide the photo). ACCENT coral #DB536A. STRUCTURE navy #0C182B / slate #414E5F. SUPPORTING grey #7F7F7F, cyan #12B5C9 (sparingly), bronze #BD825A (sparingly). Structural bars/column caps: coral #DB536A or navy with white text. FORBIDDEN: opaque white content cards, Strategy& maroon #A32020/#8E1E1E, STC purple #4F008C, PIF green, SE/NEOM colors, and any opaque full-slide background that hides the stadium photo.`,
  vibe: `Cinematic, premium look on a dark stadium-photo field: energetic yet executive, white serif headlines, coral accents, dark translucent (frosted) content panels with white text, restrained iconography. Avoid opaque white card blocks (they hide the photo), maroon consulting styling, dusty-rose Strategy& tokens, and generic Office chart palettes.`,
  writing: `Match the user's requested topic and industry — do not assume ADSC, sports, fan-engagement, super-app, or activation themes unless the user asks for them. Write conclusion-led titles and short, executive labels.`,
  css: `h1.title { font: 400 28px/1.05 Georgia, serif; color: #FFFFFF; } (white serif on the dark photo). Subtitle Arial bold 18px in coral #DB536A. Put content in DARK TRANSLUCENT panels, NOT white: .card/.panel { background: rgba(12,24,43,0.72); color: #FFFFFF; border-top: 2px solid #DB536A } with white text and coral accents. In every .slide .frame { } block set: --accent: #DB536A; --neutral-fill: #0C182B; --rose-fill: #DB536A; never Strategy& #d4687a / #4b5563 / #A32020. Do NOT set a solid full-frame background or opaque white cards that hide the stadium photo.`,
  pptx: `Export on a 13.333 x 7.5 in canvas using Georgia for the title and Arial for body, on the bundled ADSC stadium master. Title WHITE Georgia 28pt; subtitle coral DB536A Arial 18pt bold. Content panels: dark navy #0C182B (optionally ~20% transparency) with WHITE text and coral accents — never opaque white blocks. The master provides the background photo and footer/page chrome; do not inject a duplicate logo or an opaque slide background.`,
};

const ADSC_COMPONENT_PATTERNS = [
  {
    name: 'frosted_cards',
    structure: 'Dark translucent navy cards (rgba navy ~0.72) with white headers/body, a coral top-border or coral label accents; compact Arial copy. Never opaque white.',
    useWhen: 'Grouped points, capabilities, options, or summary tiles.',
    avoid: ['opaque white card blocks', 'maroon Strategy& bars', 'purple STC styling'],
  },
  {
    name: 'ecosystem_map',
    structure: 'Hub-and-spoke or layered diagram with a navy/coral core, coral connectors, and dark translucent supporting nodes with white labels.',
    useWhen: 'Ecosystems, module maps, stakeholder or relationship diagrams.',
    avoid: ['rainbow Office palettes', 'oversized decorative icons', 'footer-band content', 'opaque white panels'],
  },
  {
    name: 'phased_roadmap',
    structure: 'Roadmap/phases on dark translucent panels: white headers, coral #DB536A phase accents, slate supporting text; timeframe labels coral.',
    useWhen: 'Roadmaps, horizons, delivery phases.',
    avoid: ['pink/maroon phase accents', 'opaque white panels', 'dense unbounded lists'],
  },
];

const ADSC_PPTX_CONTRACT = {
  slideSize: { w: 13.333, h: 7.5 },
  defaultFontFace: 'Arial',
  allowedFontFaces: ['Arial', 'Helvetica'],
  backgroundPolicy: 'The bundled master carries a full-bleed dark stadium photo background; do not inject an opaque slide background or opaque white cards that hide it. Place content in dark translucent/solid navy panels with white text for legibility.',
  logoPolicy: 'Do not add a per-slide client logo; the bundled master provides the background, footer/page chrome, and the cover carries the ADSC logo.',
  sourcePolicy: 'Use footer/source text only when real source text exists; keep it compact in the bottom band.',
  pageNumberPolicy: 'Bottom-right page number from the master placeholder, Arial, muted grey.',
  titlePolicy: 'Content title at x=35 y=30 w=890 h=66 (text bottom-aligned), Georgia 28pt, white FFFFFF (sits on the dark photo).',
  subtitlePolicy: 'Subtitle at x=35 y=100 w=890 h=25, Arial bold 18pt, coral DB536A, when the slide has a lens label.',
  bodyPolicy: 'Body/content frame at x=35 y=134 w=890 h=350; keep content above the footer band (y<490).',
  hiddenPlaceholderPolicy: 'Do not surface hidden template scratch content or PRELIMINARY/DRAFT stamps unless requested.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const ADSC_PROMPT_CONTRACT = `# ADSC Client Design Contract

## Master
- Use one ADSC master shell on the 960x540 canvas. Do not invent Strategy&, STC, PIF, DGE, FYA, MoS, SE, or NEOM variants.
- The master carries a FULL-BLEED dark stadium photo background — do not add an opaque slide background or opaque white cards that hide it.
- Body frame x=35 y=134 w=890 h=350. Keep the bottom footer/page band clear.

## Theme (dark photo)
- Title WHITE #FFFFFF; subtitle CORAL #DB536A (Arial bold). Content panels: dark translucent navy with WHITE text and coral accents — never opaque white.
- ACCENT coral #DB536A. STRUCTURE navy #0C182B / slate #414E5F/#29333F. SUPPORTING grey #7F7F7F, cyan #12B5C9 (sparingly).
- Structural bars/column caps: coral or navy with white text.
- FORBIDDEN: opaque white content cards, Strategy& maroon, STC purple, PIF/SE/NEOM brand colors, and any opaque full-slide background that hides the stadium photo.

## Typography
- Georgia 28px/28pt for titles (white); Arial bold 18px/18pt for subtitles (coral); Arial ~11pt body (white on panels).

## Content
- Match the user's requested topic and industry. Do NOT assume ADSC, sports, fan-engagement, super-app, or activation themes unless the user asks for them.
- Prefer ecosystem maps, capability cards, KPI bands, and phased roadmaps rendered as dark translucent panels in the body frame.`;

const ADSC_PPTX_FONTS = {
  title: { fontFace: 'Georgia', fontSize: 28, bold: false, color: 'FFFFFF' },
  subtitle: { fontFace: 'Arial', fontSize: 18, bold: true, color: 'DB536A' },
  body: { fontFace: 'Arial', fontSize: 11, bold: false, color: '29333F' },
  footer: { fontFace: 'Arial', fontSize: 8, bold: false, color: '7F7F7F' },
  slideNum: { fontFace: 'Arial', fontSize: 8, bold: false, color: '7F7F7F' },
};

const adscStandardInches = {
  logo: pxRectToInches(ADSC_LAYOUT_CONTRACT.standardContent.logo, ADSC_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(ADSC_LAYOUT_CONTRACT.standardContent.title, ADSC_LAYOUT_CONTRACT.canvas), font: ADSC_PPTX_FONTS.title },
  subtitle: { ...pxRectToInches(ADSC_LAYOUT_CONTRACT.standardContent.subtitle, ADSC_LAYOUT_CONTRACT.canvas), font: ADSC_PPTX_FONTS.subtitle },
  body: { ...pxRectToInches(ADSC_LAYOUT_CONTRACT.standardContent.body, ADSC_LAYOUT_CONTRACT.canvas), font: ADSC_PPTX_FONTS.body },
  footer: { ...pxRectToInches(ADSC_LAYOUT_CONTRACT.standardContent.source, ADSC_LAYOUT_CONTRACT.canvas), font: ADSC_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(ADSC_LAYOUT_CONTRACT.standardContent.slideNumber, ADSC_LAYOUT_CONTRACT.canvas), font: ADSC_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(ADSC_LAYOUT_CONTRACT.standardContent.sectionTracker, ADSC_LAYOUT_CONTRACT.canvas),
    colors: { fill: '0C182B', subFill: 'DB536A', text: 'FFFFFF', subText: 'FFFFFF' },
    font: { fontFace: 'Arial', fontSize: 8, bold: true },
    paddingX: 0.18,
    textInset: 0.05,
  },
};

const REMAT_THEME = {
  name: 'Remat',
  defaultVariant: 'remat_brand',
  // Remat deck: green #00785C primary (Pantone 3288 C), bronze #B6833A secondary,
  // navy #1F3864 structure, dark grey #3A3838 body, on a clean white background.
  colors: {
    accent: '#00785C',
    accentHover: '#00604A',
    accentSoft: '#EDF1EE',
    onAccent: '#FFFFFF',
    heading: '#00785C',
    body: '#3A3838',
    muted: '#759F8D',
    page: '#FFFFFF',
    surface: '#F8F3ED',
    surfaceAlt: '#EDF1EE',
    border: '#E7E6E6',
    success: '#00785C',
    successSoft: '#EDF1EE',
    warning: '#B6833A',
    warningSoft: '#F8F3ED',
    danger: '#B6833A',
    dangerSoft: '#F8F3ED',
    info: '#007EA6',
    infoSoft: '#E2F2F7',
    neutral: '#759F8D',
    coverDark: '#1F3864',
    kicker: '#B6833A',
    neutralFill: '#00785C',
    onNeutralFill: '#FFFFFF',
    roseFill: '#B6833A',
    rematGreen: '#00785C',
    rematBronze: '#B6833A',
    rematNavy: '#1F3864',
    rematCyan: '#44C1C3',
    rematBlue: '#007EA6',
    rematPurple: '#A397C0',
  },
  fonts: {
    title: '"SST Arabic Roman", "SST Arabic", Arial, sans-serif',
    heading: '"SST Arabic Roman", "SST Arabic", Arial, sans-serif',
    body: '"SST Arabic Roman", "SST Arabic", Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '52px',
      '--title-y': '16px',
      '--title-w': '842px',
      '--title-font-size': '28px',
      '--title-font-weight': '400',
      '--title-line-height': '1.15',
      '--subtitle-y': '64px',
      '--subtitle-w': '842px',
      '--subtitle-color': '#B6833A',
      '--subtitle-font-size': '14px',
      '--subtitle-font-weight': '400',
      '--accent': '#00785C',
      '--neutral-fill': '#00785C',
      '--rose-fill': '#B6833A',
      '--frame-y': '87px',
      '--frame-w': '842px',
      '--frame-h': '396px',
      '--footer-x': '52px',
      '--footer-y': '503px',
      '--footer-bottom': 'auto',
      '--footer-w': '139px',
      '--footer-font-size': '8px',
      '--footer-padding-bottom': '0',
      '--source-x': '300px',
      '--source-y': '505px',
      '--source-w': '480px',
      '--source-h': '20px',
      '--slide-num-x': '838px',
      '--slide-num-y': '503px',
      '--slide-num-w': '56px',
      '--slide-num-h': '24px',
    },
  },
};

const REMAT_LAYOUT_CONTRACT = {
  canvas: { widthPx: 960, heightPx: 540, widthIn: 13.333, heightIn: 7.5 },
  // Audited from slide 5 / slideLayout3 (content layout).
  standardContent: {
    logo: { x: 0, y: 486, w: 265, h: 54 },
    title: { x: 52, y: 16, w: 842, h: 58 },
    subtitle: { x: 52, y: 64, w: 842, h: 20 },
    body: { x: 52, y: 87, w: 842, h: 396 },
    source: { x: 300, y: 505, w: 480, h: 20 },
    slideNumber: { x: 838, y: 501, w: 56, h: 29 },
    sectionTracker: { x: 0, y: 0, w: 280, h: 16 },
  },
  cover: {
    logo: { x: 0, y: 486, w: 265, h: 54 },
    title: { x: 52, y: 200, w: 842, h: 120 },
    subtitle: { x: 52, y: 330, w: 842, h: 30 },
  },
};

const REMAT_FREESTYLE_OVERRIDES = {
  shell: `Use the Remat master shell on a 960x540 canvas. The bundled master provides a clean WHITE background with subtle green line-art decorations and two logos in the footer band (green wordmark band bottom-left, Remat mark bottom-right) — do NOT add your own full-slide background or logos. Positions match the bundled content layout (13.333x7.5in):
- h1.title: left 52px, top 16px, width 842px, height 58px, SST Arabic Roman 28px, color GREEN #00785C.
- div.frame: left 52px, top 87px, width 842px, height 396px — all body content lives here. There is NO subtitle in this template; do not emit an h2.subtitle.
- Footer/page chrome sits in the bottom band; the master provides the logos and the page number. Keep frame content above the footer band (y<486) and clear of the bottom logos.`,
  theme: `Remat brand identity on a WHITE background. ALWAYS use the brand colours as the dominant accents in every exhibit: PRIMARY green #00785C (titles, headers, key accents, ~main series) and SECONDARY bronze/gold #B6833A (secondary accents, second series). STRUCTURE navy #1F3864, body dark grey #3A3838. SUPPORTING cyan #44C1C3, blue #007EA6, light-blue #00ADCE, purple #A397C0 ONLY for additional categorical series. SURFACES: white #FFFFFF, pale green #EDF1EE, cream #F8F3ED, grey #E7E6E6. Headings/titles GREEN #00785C; body dark grey #3A3838. Structural bars/cards: green #00785C or navy #1F3864 with white text; bronze #B6833A for secondary accents. FORBIDDEN: Strategy& maroon #A32020/#8E1E1E, STC purple #4F008C, NEOM yellow #EBC03F, ADSC coral #DB536A, and default blue/grey Office palettes.`,
  vibe: `Clean, modern Saudi corporate look on white: green #00785C primary with bronze #B6833A and navy accents, generous whitespace, crisp green line-art motifs, restrained iconography. Avoid maroon consulting styling, dark heavy backgrounds, and generic Office chart palettes.`,
  writing: `Match the user's requested topic and industry — do not assume Remat, recycling, environment, or any specific sector unless the user asks for them. Write conclusion-led titles and short, executive labels. Do not add a subtitle line.`,
  css: `h1.title { font: 400 28px/1.15 "SST Arabic Roman", Arial, sans-serif; color: #00785C; } (green on white). No subtitle. Body "SST Arabic Roman" #3A3838 on white. In every .slide .frame { } block set: --accent: #00785C; --neutral-fill: #00785C; --rose-fill: #B6833A; never Strategy& #d4687a / #4b5563 / #A32020. Use green #00785C and bronze #B6833A as the dominant exhibit colours: cards white #FFFFFF or pale green #EDF1EE with green #00785C headers/top-borders and bronze #B6833A secondary accents; chart series rotate green -> bronze -> navy -> cyan. Keep a clean white slide background.`,
  pptx: `Export on a 13.333 x 7.5 in canvas using SST Arabic Roman on the bundled Remat master. Title GREEN 00785C 28pt; body dark grey 3A3838; bronze B6833A and navy 1F3864 as secondary accents. The master provides the white background, green decorations, footer logo, and page number; do not inject a duplicate logo or a full-slide background.`,
};

const REMAT_COMPONENT_PATTERNS = [
  {
    name: 'green_accent_cards',
    structure: 'White or pale-green #EDF1EE cards with green #00785C headers/top-borders, dark grey #3A3838 body, bronze #B6833A label accents; compact SST Arabic copy.',
    useWhen: 'Grouped points, capabilities, options, or summary tiles.',
    avoid: ['maroon Strategy& bars', 'purple STC styling', 'dark full-card fills'],
  },
  {
    name: 'ecosystem_map',
    structure: 'Hub-and-spoke or layered diagram with a green core, bronze/navy connectors, and pale supporting nodes with dark labels.',
    useWhen: 'Ecosystems, module maps, stakeholder or relationship diagrams.',
    avoid: ['rainbow Office palettes', 'oversized decorative icons', 'footer-band content'],
  },
  {
    name: 'phased_roadmap',
    structure: 'Roadmap/phases: green #00785C headers, bronze #B6833A phase accents, navy/slate supporting text; timeframe labels green.',
    useWhen: 'Roadmaps, horizons, delivery phases.',
    avoid: ['pink/maroon phase accents', 'dense unbounded lists'],
  },
];

const REMAT_PPTX_CONTRACT = {
  slideSize: { w: 13.333, h: 7.5 },
  defaultFontFace: 'SST Arabic Roman',
  allowedFontFaces: ['SST Arabic Roman', 'SST Arabic', 'SST Arabic Light', 'Arial'],
  colorFidelityPolicy: 'Preserve the EXACT colours from the slide CSS. Remat is a multi-colour brand: primary green #00785C AND secondary/supporting colours bronze #B6833A, navy #1F3864, blue #007EA6, cyan #44C1C3, light-blue #00ADCE, purple #A397C0 must all survive the export. NEVER recolour a blue/bronze/navy/cyan element to the primary green — keep each element the colour the CSS gives it.',
  backgroundPolicy: 'The bundled master provides a white background with green line-art decorations and a green footer logo band; do not inject an opaque full-slide background or a duplicate logo.',
  logoPolicy: 'Do not add a per-slide logo; the bundled master carries both footer logos (green wordmark band bottom-left, Remat mark bottom-right) and the page number.',
  sourcePolicy: 'Use footer/source text only when real source text exists; keep it compact in the bottom band.',
  pageNumberPolicy: 'Bottom-right page number, SST Arabic 12pt, muted (matches the native template slide number).',
  titlePolicy: 'Content title at x=52 y=16 w=842 h=58, SST Arabic Roman 28pt, green 00785C.',
  subtitlePolicy: 'No subtitle: the Remat content layout has title + body only.',
  bodyPolicy: 'Body/content frame at x=52 y=87 w=842 h=396; keep content above the footer band (y<486).',
  hiddenPlaceholderPolicy: 'Do not surface hidden template scratch content or DRAFT stamps unless requested.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const REMAT_PROMPT_CONTRACT = `# Remat Client Design Contract

## Master
- Use one Remat master shell on the 960x540 canvas. Do not invent Strategy&, STC, PIF, DGE, FYA, MoS, SE, NEOM, or ADSC variants.
- The master carries a WHITE background with subtle green line-art decorations and a green footer logo band — do not add an opaque slide background or a duplicate logo.
- Body frame x=52 y=87 w=842 h=396. Keep the bottom footer/page band clear.

## Theme (white background)
- Title GREEN #00785C. Body dark grey #3A3838. No subtitle (this template has none).
- Always use the brand colours as dominant accents: PRIMARY green #00785C, SECONDARY bronze #B6833A, then navy #1F3864. SUPPORTING cyan #44C1C3, blue #007EA6, purple #A397C0 only for extra categorical series.
- Cards: white or pale-green #EDF1EE with green headers; bronze secondary accents.
- FORBIDDEN: Strategy& maroon, STC purple, NEOM yellow, ADSC coral, default Office blue/grey, and any opaque full-slide background.

## Typography
- SST Arabic Roman throughout. Title 28px/28pt green; body ~11pt dark grey; slide number 12pt. No subtitle.

## Content
- Match the user's requested topic and industry. Do NOT assume Remat, recycling, environment, or any specific sector unless the user asks for them.
- Prefer ecosystem maps, capability cards, KPI bands, and phased roadmaps inside the body frame.`;

const REMAT_PPTX_FONTS = {
  title: { fontFace: 'SST Arabic Roman', fontSize: 28, bold: false, color: '00785C' },
  body: { fontFace: 'SST Arabic Roman', fontSize: 11, bold: false, color: '3A3838' },
  footer: { fontFace: 'SST Arabic Roman', fontSize: 8, bold: false, color: '759F8D' },
  // Native template slide number is 12pt (sz=1200 in slideLayout3).
  slideNum: { fontFace: 'SST Arabic Roman', fontSize: 12, bold: false, color: '759F8D' },
};

const rematStandardInches = {
  logo: pxRectToInches(REMAT_LAYOUT_CONTRACT.standardContent.logo, REMAT_LAYOUT_CONTRACT.canvas),
  title: { ...pxRectToInches(REMAT_LAYOUT_CONTRACT.standardContent.title, REMAT_LAYOUT_CONTRACT.canvas), font: REMAT_PPTX_FONTS.title },
  // No subtitle: the Remat content layout (slide 5 / slideLayout3) has title + body only.
  body: { ...pxRectToInches(REMAT_LAYOUT_CONTRACT.standardContent.body, REMAT_LAYOUT_CONTRACT.canvas), font: REMAT_PPTX_FONTS.body },
  footer: { ...pxRectToInches(REMAT_LAYOUT_CONTRACT.standardContent.source, REMAT_LAYOUT_CONTRACT.canvas), font: REMAT_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(REMAT_LAYOUT_CONTRACT.standardContent.slideNumber, REMAT_LAYOUT_CONTRACT.canvas), font: REMAT_PPTX_FONTS.slideNum },
  sectionTracker: {
    ...pxRectToInches(REMAT_LAYOUT_CONTRACT.standardContent.sectionTracker, REMAT_LAYOUT_CONTRACT.canvas),
    colors: { fill: '00785C', subFill: 'B6833A', text: 'FFFFFF', subText: 'FFFFFF' },
    font: { fontFace: 'SST Arabic Roman', fontSize: 8, bold: true },
    paddingX: 0.18,
    textInset: 0.05,
  },
};

const ECA_THEME = {
  name: 'ECA CP',
  defaultVariant: 'eca_cp_brand',
  // ECA CP deck (audited Template 2, 48 slides): teal #41A4A5 titles, Tahoma on white,
  // chart palette orange #D95022 / green #7FBC80 / purple #5E417B / cyan #53B0C5.
  colors: {
    accent: '#41A4A5',
    accentHover: '#378F90',
    accentSoft: '#E8F4F4',
    onAccent: '#FFFFFF',
    heading: '#41A4A5',
    body: '#000000',
    muted: '#5F5F5F',
    page: '#FFFFFF',
    surface: '#EBE9E5',
    surfaceAlt: '#F2F2F2',
    border: '#D9D9D9',
    success: '#7FBC80',
    successSoft: '#E8F5E9',
    warning: '#F28808',
    warningSoft: '#FFF4E5',
    danger: '#D95022',
    dangerSoft: '#FBEAE5',
    info: '#53B0C5',
    infoSoft: '#E5F5F8',
    neutral: '#808080',
    coverDark: '#1D4666',
    kicker: '#D95022',
    neutralFill: '#1D4666',
    onNeutralFill: '#FFFFFF',
    roseFill: '#D95022',
    ecaTeal: '#41A4A5',
    ecaOrange: '#D95022',
    ecaCyan: '#53B0C5',
    ecaGreen: '#7FBC80',
    ecaLightGreen: '#B2D7B3',
    ecaPurple: '#5E417B',
    ecaGold: '#FFB700',
    ecaBrown: '#A33C19',
    ecaNavy: '#1D4666',
    ecaGrey: '#97989A',
  },
  fonts: {
    title: 'Tahoma, Arial, sans-serif',
    heading: 'Tahoma, Arial, sans-serif',
    body: 'Tahoma, Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '35px',
      '--title-y': '19px',
      '--title-w': '917px',
      '--title-font-size': '32px',
      '--title-font-weight': '400',
      '--title-line-height': '1.15',
      '--title-color': '#41A4A5',
      '--accent': '#41A4A5',
      '--neutral-fill': '#1D4666',
      '--rose-fill': '#D95022',
      '--frame-y': '87px',
      '--frame-w': '917px',
      '--frame-h': '413px',
      '--section-tracker-y': '4px',
      '--footer-x': '22px',
      '--footer-y': '516px',
      '--footer-bottom': 'auto',
      '--footer-w': '500px',
      '--footer-font-size': '8px',
      '--source-x': '22px',
      '--source-y': '516px',
      '--source-w': '500px',
      '--source-h': '20px',
      '--slide-num-x': '727px',
      '--slide-num-y': '516px',
      '--slide-num-w': '80px',
      '--slide-num-h': '20px',
    },
  },
};

const ECA_LAYOUT_CONTRACT = {
  canvas: { widthPx: 960, heightPx: 540, widthIn: 13.333, heightIn: 7.5 },
  // Audited from Template 2 slideLayout2 (1_Title Only - White), scaled to 960x540.
  standardContent: {
    title: { x: 35, y: 19, w: 917, h: 40 },
    body: { x: 35, y: 87, w: 917, h: 413 },
    source: { x: 22, y: 516, w: 500, h: 20 },
    slideNumber: { x: 727, y: 516, w: 80, h: 20 },
    sectionTracker: {
      number: { x: 35, y: 4, w: 16, h: 16 },
      label: { x: 51, y: 4, w: 500, h: 16 },
    },
  },
  cover: {
    logo: { x: 51, y: 70, w: 345, h: 183 },
    title: { x: 35, y: 200, w: 600, h: 120 },
  },
};

const ECA_FREESTYLE_OVERRIDES = {
  shell: `Use the ECA CP master shell on a 960x540 canvas. The bundled master provides a clean WHITE background on the canonical "1_Title Only - White" layout — do NOT add your own full-slide background. Positions match the bundled content layout (13.333x7.5in):
- Section tracker (per slide): section number at left 35px top 4px (Tahoma ~14pt) plus section label at left 51px top 4px (Tahoma ~12pt). This is NOT a master placeholder; render it on body slides when section context exists.
- h1.title: left 35px, top 19px, width 917px, Tahoma 32px, color TEAL #41A4A5. There is NO subtitle on this template — do not emit h2.subtitle.
- div.frame: left 35px, top 87px, width 917px, height 413px — all body content lives here.
- Footer/page chrome sits in the bottom band; the master provides footer and page number placeholders. Keep frame content above y<500.`,
  theme: `ECA CP brand on WHITE. Title TEAL #41A4A5; body black #000000; muted greys #5F5F5F/#808080/#97989A. Chart/exhibit series (rotate in this order): teal #41A4A5, orange #D95022, green #7FBC80, purple #5E417B, cyan #53B0C5, light-green #B2D7B3, gold #FFB700, brown #A33C19. Section tracker: black Tahoma 12-14pt at y=4. Cards: white or pale #EBE9E5 with teal headers/top accents; navy #1D4666 structure bars with white text. FORBIDDEN: Strategy& maroon #A32020/#8E1E1E, STC purple #4F008C, NEOM yellow #EBC03F, ADSC coral #DB536A, subtitles, and opaque full-slide backgrounds.`,
  vibe: `Clean institutional look on white: teal headlines, compact Tahoma body copy, restrained section tracker strip, orange/cyan/green chart accents only where needed. Avoid maroon consulting styling, dark heavy backgrounds, and generic Office blue/grey palettes.`,
  writing: `Match the user's requested topic and industry — do not assume ECA, child protection, or any specific sector unless the user asks for them. Write conclusion-led titles and short executive labels. Do not add a subtitle line.`,
  css: `h1.title { font: 400 32px/1.15 Tahoma, Arial, sans-serif; color: #41A4A5; } No subtitle. .section-tracker { font: 400 12px/1.2 Tahoma, Arial, sans-serif; color: #000000; } .section-tracker .num { font-size: 14px; } Body Tahoma #000000 on white; muted #5F5F5F. In every .slide .frame { } block set: --accent: #41A4A5; --neutral-fill: #1D4666; --rose-fill: #D95022; chart/card series rotate #41A4A5, #D95022, #7FBC80, #5E417B, #53B0C5, #B2D7B3, #FFB700; never Strategy& #d4687a / #A32020.`,
  pptx: `Export on a 13.333 x 7.5 in canvas using Tahoma on the bundled ECA CP master. Title TEAL 41A4A5 32pt; body black 000000 ~11-12pt; orange D95022 and cyan 53B0C5 as secondary accents. No subtitle. Section tracker number+label at y=4 when section context exists. The master provides white background, footer, and page number; do not inject a duplicate logo on standard content slides.`,
};

const ECA_COMPONENT_PATTERNS = [
  {
    name: 'teal_header_cards',
    structure: 'White or pale #EBE9E5 cards with teal #41A4A5 headers/top-borders, black #000000 body, orange #D95022 label accents; compact Tahoma copy.',
    useWhen: 'Grouped points, capabilities, options, or summary tiles.',
    avoid: ['maroon Strategy& bars', 'purple STC styling', 'subtitles'],
  },
  {
    name: 'section_strip',
    structure: 'Top strip: section number (14pt) + section label (12pt) in black Tahoma at y=4, then teal title at y=19.',
    useWhen: 'Multi-section decks with chapter context on body slides.',
    avoid: ['subtitle lines', 'master Slide Tags placeholder text'],
  },
  {
    name: 'phased_roadmap',
    structure: 'Roadmap/phases: teal #41A4A5 headers, orange #D95022 phase accents, navy #1D4666 supporting bars; timeframe labels teal or orange.',
    useWhen: 'Roadmaps, horizons, delivery phases.',
    avoid: ['pink/maroon phase accents', 'dense unbounded lists'],
  },
];

const ECA_PPTX_CONTRACT = {
  slideSize: { w: 13.333, h: 7.5 },
  defaultFontFace: 'Tahoma',
  allowedFontFaces: ['Tahoma', 'Arial', 'Calibri'],
  colorFidelityPolicy: 'Preserve exact ECA CP colors from slide CSS. Titles/headers #41A4A5; body #000000; chart/card series rotate #41A4A5, #D95022, #7FBC80, #5E417B, #53B0C5, #B2D7B3, #FFB700, #A33C19; navy structure #1D4666 with white text.',
  backgroundPolicy: 'The bundled master provides a white background on the canonical content layout; do not inject an opaque full-slide background.',
  logoPolicy: 'Do not add a per-slide client logo on standard content slides; the cover layout carries the ECA lockup.',
  sourcePolicy: 'Use footer/source text only when real source text exists; keep it compact in the bottom band.',
  pageNumberPolicy: 'Bottom-right page number from the master placeholder, Tahoma/Calibri ~12pt, black.',
  titlePolicy: 'Content title at x=35 y=19 w=917 h=40, Tahoma 32pt, teal 41A4A5.',
  subtitlePolicy: 'No subtitle: the ECA CP content layout has title + body only.',
  bodyPolicy: 'Body/content frame at x=35 y=87 w=917 h=413; keep content above the footer band (y<500).',
  sectionTrackerPolicy: 'When section context exists, render section number at x=35 y=4 and section label at x=51 y=4 (Tahoma 14pt/12pt, black) above the title.',
  hiddenPlaceholderPolicy: 'Do not surface hidden template scratch content, Slide Tags placeholders, or DRAFT stamps unless requested.',
  borderWeightPt: { min: 0.5, max: 1.25 },
};

const ECA_PROMPT_CONTRACT = `# ECA CP Client Design Contract

## Master
- Use one ECA CP master shell on the 960x540 canvas. Do not invent Strategy&, STC, PIF, DGE, FYA, MoS, SE, NEOM, ADSC, or Remat variants.
- Canonical layout is white "1_Title Only - White" — do not add an opaque slide background.
- Body frame x=35 y=87 w=917 h=413. Keep the bottom footer/page band clear.

## Theme (white background)
- Title TEAL #41A4A5. Body black #000000. No subtitle (this template has none).
- Section tracker: number + label at y=4 in black Tahoma 12-14pt when section context exists.
- SECONDARY orange #D95022, cyan #53B0C5, green #7FBC80, navy #1D4666 for charts/structure.
- FORBIDDEN: Strategy& maroon, STC purple, NEOM yellow, ADSC coral, subtitles, and opaque full-slide backgrounds.

## Typography
- Tahoma throughout. Title 32px/32pt teal; body ~11-12pt black; section tracker 12-14pt black. No subtitle.

## Content
- Match the user's requested topic and industry. Do NOT assume ECA, child protection, or any specific sector unless the user asks for them.
- Prefer capability cards, KPI bands, phased roadmaps, and comparison tables inside the body frame.`;

const ECA_PPTX_FONTS = {
  title: { fontFace: 'Tahoma', fontSize: 32, bold: false, color: '41A4A5' },
  body: { fontFace: 'Tahoma', fontSize: 11, bold: false, color: '000000' },
  footer: { fontFace: 'Tahoma', fontSize: 8, bold: false, color: '5F5F5F' },
  slideNum: { fontFace: 'Tahoma', fontSize: 12, bold: false, color: '000000' },
};

const ecaStandardInches = {
  title: { ...pxRectToInches(ECA_LAYOUT_CONTRACT.standardContent.title, ECA_LAYOUT_CONTRACT.canvas), font: ECA_PPTX_FONTS.title },
  body: { ...pxRectToInches(ECA_LAYOUT_CONTRACT.standardContent.body, ECA_LAYOUT_CONTRACT.canvas), font: ECA_PPTX_FONTS.body },
  footer: { ...pxRectToInches(ECA_LAYOUT_CONTRACT.standardContent.source, ECA_LAYOUT_CONTRACT.canvas), font: ECA_PPTX_FONTS.footer },
  slideNum: { ...pxRectToInches(ECA_LAYOUT_CONTRACT.standardContent.slideNumber, ECA_LAYOUT_CONTRACT.canvas), font: ECA_PPTX_FONTS.slideNum },
  sectionTracker: {
    variant: 'ecaSectionStrip',
    number: {
      ...pxRectToInches(ECA_LAYOUT_CONTRACT.standardContent.sectionTracker.number, ECA_LAYOUT_CONTRACT.canvas),
      font: { fontFace: 'Tahoma', fontSize: 14, bold: false, color: '000000' },
    },
    label: {
      ...pxRectToInches(ECA_LAYOUT_CONTRACT.standardContent.sectionTracker.label, ECA_LAYOUT_CONTRACT.canvas),
      font: { fontFace: 'Tahoma', fontSize: 12, bold: false, color: '000000' },
    },
    colors: { text: '000000', subText: '000000' },
  },
  logo: pxRectToInches(ECA_LAYOUT_CONTRACT.cover.logo, ECA_LAYOUT_CONTRACT.canvas),
};

export const CLIENT_DESIGN_PROFILES = {
  remat: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'remat',
    navLabel: 'Remat',
    name: 'Remat',
    description: 'Remat template: white background with green line-art decorations, SST Arabic Roman, green #00785C titles, bronze + navy accents.',
    status: 'brand-0.1',
    footerBranding: '',
    theme: REMAT_THEME,
    layoutContract: REMAT_LAYOUT_CONTRACT,
    freestyleOverrides: REMAT_FREESTYLE_OVERRIDES,
    componentPatterns: REMAT_COMPONENT_PATTERNS,
    pptxContract: REMAT_PPTX_CONTRACT,
    promptContract: REMAT_PROMPT_CONTRACT,
    designContract: REMAT_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:remat:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'remat',
      forceBundledDefault: true,
      useProfileChrome: false,
      assetVersion: 'remat-master-v1',
      notes: 'Bundled Remat master (slimmed to slideMaster1 + slideLayout3 from the Remat deck); keeps the green decorations + footer logo. Uploads stay profile-bound in local storage.',
    },
    chrome: {
      footerText: '',
      positions: rematStandardInches,
      injectPreviewLogo: true,
      injectExportLogo: false,
    },
    evidence: {
      sourceDecks: [
        { label: 'Remat PowerPoint EN', fileName: 'Remat PowerPoint EN.pptx', slides: 17, role: 'bundled master and canonical Remat visual system' },
      ],
      rawThemeSlots: { dk1: '#3A3838', lt1: '#FFFFFF', dk2: '#1F3864', accent1: '#00785C', accent2: '#B6833A' },
      notes: [
        'Native deck is 13.333 x 7.5in widescreen mapped to 960 x 540px. Geometry from slide 5 / slideLayout3: title 52,16,842x58 (SST Arabic Medium 28 green); body 52,87,842x414; slideNum 838,501; footer logo 0,486,265x54.',
        'Primary green #00785C (Pantone 3288 C) and secondary bronze #B6833A confirmed from slides 9-10 (Primary/Secondary Colors).',
        'Master slimmed from 16.9MB/15-layouts to slideMaster1 + slideLayout3 + theme1 + logo (image4.png) + footer svg (image1.svg); decorative green freeform shapes preserved; export uses preserveTemplateChrome.',
        'Brand fonts: SST Arabic Roman (standard/body+title) and SST Arabic Light, bundled under backend/assets/fonts/sst-arabic/. Title size 28.',
      ],
    },
    validationRules: {
      requiredColors: ['#00785C', '#B6833A', '#1F3864', '#3A3838', '#FFFFFF'],
      preferredSurfaceColors: ['#EDF1EE', '#F8F3ED', '#E7E6E6', '#F2F2F2'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#EBC03F', '#13100D', '#DB536A', '#d4687a', '#D4687A'],
      disallowedFonts: ['Georgia', 'STC Forward', 'Fund Light'],
      disallowedFooterText: ['Strategy&'],
    },
  },
  adsc: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'adsc',
    navLabel: 'ADSC',
    name: 'Abu Dhabi Sports Council',
    description: 'ADSC template: full-bleed dark stadium-photo master, white Georgia 28 title, coral Arial 18 subtitle, dark translucent content panels, coral + navy palette.',
    status: 'brand-0.1',
    footerBranding: '',
    theme: ADSC_THEME,
    layoutContract: ADSC_LAYOUT_CONTRACT,
    freestyleOverrides: ADSC_FREESTYLE_OVERRIDES,
    componentPatterns: ADSC_COMPONENT_PATTERNS,
    pptxContract: ADSC_PPTX_CONTRACT,
    promptContract: ADSC_PROMPT_CONTRACT,
    designContract: ADSC_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:adsc:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'adsc',
      forceBundledDefault: true,
      useProfileChrome: false,
      assetVersion: 'adsc-master-v1',
      notes: 'Bundled ADSC master (slimmed from the ADSC Sports super-app deck); uploads stay profile-bound in local storage.',
    },
    chrome: {
      footerText: '',
      positions: adscStandardInches,
      injectPreviewLogo: false,
      injectExportLogo: false,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'ADSC Sports - Super App Blueprint Discussion v4',
          fileName: '260120_ADSC Sports_Super App Blueprint Discussion_v4.pptx',
          slides: 52,
          role: 'bundled master and canonical ADSC visual system',
        },
      ],
      rawThemeSlots: {
        dk1: '#000000',
        lt1: '#FFFFFF',
        dk2: '#A32020',
        accent1: '#A32020',
        accent2: '#DB536A',
      },
      notes: [
        'Source deck uses the Strategy&_Digital template theme; ADSC identity is the coral #DB536A accent + navy structure used in content, plus the ADSC cover logo.',
        'Native deck is 13.333 x 7.5in widescreen mapped to 960 x 540px. Geometry from the "2_One Column" content layout: title 35,30,890x66 (Georgia 28 white); subtitle 35,100 (Arial 18 coral); body 35,134,890x350; source 192,500; page# 786,511.',
        'Master slimmed from 194MB/9-masters: kept slideMaster1 + slideLayout1 + theme1, stripped think-cell OLE + webextension taskpanes. The full-bleed dark stadium photo (Picture 8 -> ppt/media/image3.jpeg, 1.2MB) is preserved in slideLayout1 and shows on content slides; export uses preserveTemplateChrome so the layout (and its photo) survive the merge.',
        'Logo raster extracted from ppt/media/image26.png (greyed ADSC wordmark) in the source deck; not injected on content slides (master provides chrome).',
      ],
    },
    validationRules: {
      requiredColors: ['#DB536A', '#0C182B', '#FFFFFF', '#29333F', '#7F7F7F'],
      preferredSurfaceColors: ['#F4F8FF', '#EEF5F9', '#F8F8F8', '#D9D9D9', '#DEDEDE'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#C3984D', '#073B16', '#00FF86', '#EBC03F', '#13100D'],
      disallowedFonts: [],
      disallowedFooterText: [],
    },
  },
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
  tdredc: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'tdredc',
    navLabel: 'TDREDC',
    name: 'TDREDC',
    description: 'Tower District Real Estate Development Company: PIF-adjacent Fund typography, green/gold ExCom template.',
    status: 'excom-0.1',
    footerBranding: '',
    theme: TDREDC_THEME,
    layoutContract: TDREDC_LAYOUT_CONTRACT,
    pptxContract: TDREDC_PPTX_CONTRACT,
    promptContract: TDREDC_PROMPT_CONTRACT,
    designContract: TDREDC_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:tdredc:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'tdredc',
      forceBundledDefault: true,
      useProfileChrome: true,
      assetVersion: 'tdredc-logo-cover-only-v4',
      notes: 'Default TDREDC master is served from backend assets; user-uploaded TDREDC templates remain profile-bound local overrides.',
    },
    chrome: {
      footerText: '',
      logoPlacement: 'top-left',
      logoScope: 'cover-only',
      positions: tdredcStandardInches,
      coverPositions: tdredcCoverInches,
      injectPreviewLogo: true,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'TDREDC Template',
          fileName: '20260628_TDREDC Template.pptx',
          slides: 5,
          layouts: 47,
          masters: 3,
          role: 'bundled master and canonical ExCom content shell',
        },
        {
          label: 'TDREDC ExCom 13 Draft',
          fileName: '20260623_TDREDC_ExCom 13 Draft Document_v19.pptx',
          slides: 370,
          layouts: 174,
          masters: 9,
          role: 'production reference; confirms Graphic 1 logo lockup on Title Only / Custom Layout via slide master',
        },
      ],
      rawThemeSlots: {
        dk1: '#595959',
        dk2: '#C4995B',
        lt2: '#F2F2F2',
        accent1: '#654B25',
        accent2: '#9D7539',
        accent6: '#005C4D',
        pillarRise: '#46121D',
        pillarNora: '#9D7539',
        pillarCorporate: '#2C2C2C',
        legendMint: '#29BA74',
        panelDark: '#00342B',
      },
      notes: [
        'The TDREDC template is a 13.333 x 7.5 in widescreen deck mapped to 960 x 540 px for canvas preview.',
        'Fund Light/Regular typography and green/gold palette closely follow the PIF family.',
        'Bundled logo.png is rasterized from template media image2.svg (green TDREDC on white), sized 234x82 px to match the native OOXML lockup — injected on cover slides only.',
        'Standard content layouts (Custom Layout / Title Only) carry no header logo; the lockup appears only on Title-Slide / Section-End covers. Confirmed 0 of 370 slides in the ExCom v19 deck have a header logo. Body slides use a full-width content title band at x=112.',
        'Executive Summary pillar headers (template slide 3): Rise #46121D, NoRA #9D7539 (accent2), Corporate Matters #2C2C2C; detail panels #00342B; agenda legend #29BA74.',
        'Footer/source text is intentionally blank by default in generated TDREDC slides.',
      ],
    },
    validationRules: {
      requiredColors: ['#00332A', '#005C4D', '#46121D', '#2C2C2C', '#9D7539', '#29BA74', '#C4995B', '#654B25', '#FFFFFF'],
      preferredSurfaceColors: ['#FFFCF2', '#F2F2F2', '#EFE4D2', '#D4F3EC'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#FFC000', '#FF0000'],
      forbiddenDominantColors: ['#8E1E1E', '#A32020', '#4F008C', '#FFC000', '#FF0000'],
      disallowedFonts: ['Aptos', 'Calibri', 'Georgia', 'STC Forward'],
      disallowedFooterText: ['Strategy&'],
      minFontPx: 8,
      targetBodyFontPx: 10,
      fontSizesPt: {
        titleStandard: { min: 14, max: 18 },
        titleCover: { min: 30, max: 36 },
        subtitle: { min: 7, max: 9 },
        body: { min: 8, max: 12 },
        bodyDense: { min: 8, max: 10 },
        footer: { min: 7, max: 8 },
      },
      layoutBands: {
        logoSafeBottomPct: 20,
        titleMaxBottomPct: 14,
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
  npc: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'npc',
    navLabel: 'NPC',
    name: 'National Planning Council',
    description: 'National Planning Council (State of Qatar): Qatar maroon + gold government template, Calibri typography, cover-only emblem lockup, gold-diamond page marker.',
    status: 'excom-0.1',
    footerBranding: '',
    theme: NPC_THEME,
    layoutContract: NPC_LAYOUT_CONTRACT,
    pptxContract: NPC_PPTX_CONTRACT,
    promptContract: NPC_PROMPT_CONTRACT,
    designContract: NPC_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:npc:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'npc',
      forceBundledDefault: true,
      useProfileChrome: true,
      assetVersion: 'npc-logo-cover-only-v1',
      notes: 'Default NPC master is served from backend assets; user-uploaded NPC templates remain profile-bound local overrides.',
    },
    chrome: {
      footerText: '',
      logoPlacement: 'top-left',
      logoScope: 'cover-only',
      positions: npcStandardInches,
      coverPositions: npcCoverInches,
      injectPreviewLogo: true,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'NPC Template',
          fileName: 'NPC template.pptx',
          slides: 11,
          role: 'bundled master and canonical content shell (Qatar Gov Colour Palette theme)',
        },
      ],
      rawThemeSlots: {
        accent1: '#89143C',
        accent2: '#0F4260',
        accent3: '#129B82',
        accent4: '#4194B3',
        accent5: '#A29160',
        accent6: '#FDF49C',
        lt2: '#ECE8DF',
        coverPanel: '#8A1538',
      },
      notes: [
        'The NPC template is a 13.333 x 7.5 in widescreen deck mapped to 960 x 540 px for canvas preview.',
        'Client is the National Planning Council (al-Majlis al-Watani lil-Takhtit), State of Qatar; brand identity is Qatar maroon (#8A1538 cover panel / #89143C accent1) on white with Calibri typography.',
        'Bundled logo.png is rasterized from template media image3.emf (the bilingual NPC + Qatar-emblem lockup) and appears top-right on cover slides only; standard content layouts are title-only.',
        'Signature chrome: gold-outlined diamond page-number marker bottom-right; back cover is a full-bleed maroon panel with the reversed white lockup centered.',
        'Footer/source text is intentionally blank by default in generated NPC slides; suppress embedded think-cell OLE objects.',
      ],
    },
    validationRules: {
      requiredColors: ['#89143C', '#8A1538', '#0F4260', '#129B82', '#4194B3', '#A29160', '#000000', '#FFFFFF'],
      preferredSurfaceColors: ['#FFFFFF', '#ECE8DF', '#F3E1E7'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#FF0000'],
      forbiddenDominantColors: ['#8E1E1E', '#A32020', '#4F008C', '#FF0000'],
      disallowedFonts: ['Aptos', 'STC Forward', 'Georgia'],
      disallowedFooterText: ['Strategy&'],
      minFontPx: 8,
      targetBodyFontPx: 11,
      fontSizesPt: {
        titleStandard: { min: 18, max: 28 },
        titleCover: { min: 36, max: 46 },
        subtitle: { min: 12, max: 20 },
        body: { min: 10, max: 15 },
        bodyDense: { min: 9, max: 12 },
        footer: { min: 7, max: 8 },
      },
      layoutBands: {
        logoSafeBottomPct: 18,
        titleMaxBottomPct: 18,
        contentStartPct: 25,
        footerStartPct: 92,
      },
      density: {
        maxBulletsStandard: 6,
        maxModulesStandard: 5,
        minBodyPt: 10,
      },
      chrome: {
        requireLogo: false,
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
        accent2: '#6E4527',
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
      requiredColors: ['#F9F7ED', '#CE9C3E', '#6E4527', '#D83731', '#000000'],
      preferredSurfaceColors: ['#F9F7ED', '#F0E8D8', '#EFE4C8', '#E8E0C8'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#005393', '#00332A', '#005C4D'],
      forbiddenDominantColors: ['#8E1E1E', '#A32020', '#4F008C', '#005393', '#00332A', '#3F8E50', '#E5F0E2'],
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
  mos: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'mos',
    navLabel: 'MoS',
    name: 'Ministry of Sport',
    description: 'Ministry of Sport template: Sakkal Majalla, green performance-management system, benchmark layouts.',
    status: 'brand-0.1',
    footerBranding: '',
    theme: MOS_THEME,
    layoutContract: MOS_LAYOUT_CONTRACT,
    freestyleOverrides: MOS_FREESTYLE_OVERRIDES,
    componentPatterns: MOS_COMPONENT_PATTERNS,
    pptxContract: MOS_PPTX_CONTRACT,
    promptContract: MOS_PROMPT_CONTRACT,
    designContract: MOS_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:mos:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'mos',
      forceBundledDefault: true,
      useProfileChrome: true,
      assetVersion: 'mos-logo-cropped-v2',
      notes: 'Default MoS master is served from backend assets; uploads stay profile-bound in local storage.',
    },
    chrome: {
      footerText: '',
      positions: mosStandardInches,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'MoS Template',
          fileName: 'MoS Template.pptx',
          slides: 5,
          layouts: 42,
          masters: 2,
          role: 'bundled master and canonical MoS template shell',
        },
        {
          label: 'MoS Performance Management Benchmark Report',
          fileName: '20251123_MoS_Performance Management Benchmark Report.pptx',
          slides: 47,
          layouts: 102,
          masters: 8,
          role: 'content-pattern and benchmark-layout reference',
        },
      ],
      rawThemeSlots: {
        dk1: '#2C2C2C',
        dk2: '#073B16',
        lt1: '#F2F2F2',
        accent1: '#0B5921',
        accent2: '#0E762C',
        accent3: '#BD9608',
        accent4: '#14AA3F',
        accent5: '#7F7F7F',
      },
      notes: [
        'Sakkal Majalla is the official font used in the MoS theme.',
        'Standard report pages use white backgrounds, green benchmark bands, compact tables, and small bottom chrome.',
        'Logo asset is extracted from MoS Template media image7.png.',
      ],
    },
    validationRules: {
      requiredColors: ['#073B16', '#0B5921', '#0E762C', '#BD9608', '#80C7A7', '#FFFFFF', '#2C2C2C'],
      preferredSurfaceColors: ['#F2F2F2', '#E7F3EA', '#DFF3E6', '#FFFFFF'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#005393', '#F9F7ED', '#C3984D'],
      forbiddenDominantColors: ['#8E1E1E', '#A32020', '#4F008C', '#005393', '#F9F7ED'],
      disallowedFonts: ['Georgia', 'STC Forward', 'Fund Light', 'Noto Sans', 'Poppins', 'Aptos', 'Calibri'],
      disallowedFooterText: ['Strategy&', 'Federal Youth Authority', 'Department of Government Enablement'],
      minFontPx: 8,
      targetBodyFontPx: 10,
      fontSizesPt: {
        titleStandard: { min: 22, max: 26 },
        titleCover: { min: 28, max: 38 },
        subtitle: { min: 12, max: 16 },
        body: { min: 8, max: 12 },
        bodyDense: { min: 7, max: 10 },
        footer: { min: 6, max: 8 },
      },
      layoutBands: {
        logoSafeBottomPct: 8,
        titleMaxBottomPct: 18,
        subtitleMaxBottomPct: 24,
        contentStartPct: 23,
        footerStartPct: 92,
      },
      density: {
        maxBulletsStandard: 6,
        maxModulesStandard: 6,
        minBodyPt: 7,
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
  se: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'se',
    navLabel: 'SE',
    name: 'Saudi Electricity',
    description: 'SE template: SE custom fonts, blue energy palette, bottom-left logo, institutional content shell.',
    status: 'brand-0.1',
    footerBranding: '',
    theme: SE_THEME,
    layoutContract: SE_LAYOUT_CONTRACT,
    freestyleOverrides: SE_FREESTYLE_OVERRIDES,
    componentPatterns: SE_COMPONENT_PATTERNS,
    pptxContract: SE_PPTX_CONTRACT,
    promptContract: SE_PROMPT_CONTRACT,
    designContract: SE_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:se:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'se',
      forceBundledDefault: true,
      useProfileChrome: true,
      assetVersion: 'se-logo-wordmark-v1',
      notes: 'Bundled SE master from backend assets; uploads stay profile-bound in local storage.',
    },
    chrome: {
      footerText: '',
      positions: seStandardInches,
      injectPreviewLogo: false,
      injectExportLogo: false,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'SE Slide Repository - New Style',
          fileName: 'SE Slide Repository - New Style.pptx',
          slides: 96,
          role: 'bundled master and canonical SE visual system',
        },
        {
          label: 'Brand Guidelines (EN)',
          fileName: 'Brand-Guidelines-en.pdf',
          role: 'color, logo, and typography authority',
        },
      ],
      rawThemeSlots: {
        dk1: '#000000',
        dk2: '#001F5E',
        lt1: '#F2F2F2',
        accent1: '#1F4A8E',
        accent2: '#0080FF',
        accent3: '#32C2FF',
        accent4: '#00FF86',
        accent5: '#D6E2F6',
      },
      notes: [
        'Native deck is 13.333 x 7.5in widescreen mapped to 960 x 540px for canvas preview.',
        'Canonical geometry (Brand Guidelines / master): title 35,30,890x66 (0.484/0.420/12.365/0.920 in); subtitle 35,101,890x25 (1.396/0.350 in); body 35,137,890x353.',
        'Visible typography uses SE Medium for headlines; bundled SE TTF weights ship under backend/assets/fonts/se/.',
        'Logo raster extracted from ppt/media/image22.png in the bundled master.',
      ],
    },
    validationRules: {
      requiredColors: ['#001F5E', '#0080FF', '#00FF86', '#008BB9', '#32C2FF', '#FFFFFF', '#1D252D'],
      preferredSurfaceColors: ['#F2F2F2', '#D6E2F6', '#DCE4F0', '#CCE6FF', '#BFBFBF', '#E6E8EB'],
      disallowedColors: [
        '#8E1E1E', '#A32020', '#4F008C', '#C3984D', '#F9F7ED', '#073B16', '#F26B43', '#FF375E',
        '#d4687a', '#D4687A', '#E10054', '#EF9B00', '#8035BB', '#00B476', '#ED7D31',
      ],
      forbiddenDominantColors: [
        '#8E1E1E', '#A32020', '#4F008C', '#C3984D', '#F9F7ED', '#F26B43', '#ED7D31',
        '#d4687a', '#E10054', '#EF9B00', '#8035BB', '#00B476',
      ],
      disallowedFonts: ['Georgia', 'STC Forward', 'Fund Light', 'Noto Sans', 'Poppins', 'Aptos', 'Calibri'],
      disallowedFooterText: ['Strategy&'],
      minFontPx: 8,
      targetBodyFontPx: 12,
      fontSizesPt: {
        titleStandard: { min: 28, max: 32 },
        titleCover: { min: 32, max: 40 },
        subtitle: { min: 16, max: 18 },
        body: { min: 10, max: 12 },
        bodyDense: { min: 8, max: 10 },
        footer: { min: 7, max: 8 },
      },
      layoutBands: {
        logoSafeBottomPct: 8,
        titleMaxBottomPct: 18,
        subtitleMaxBottomPct: 24,
        contentStartPct: 25,
        footerStartPct: 93,
      },
      density: {
        maxBulletsStandard: 6,
        maxModulesStandard: 6,
        minBodyPt: 8,
      },
      chrome: {
        requireLogo: false,
        requirePageNumberNonCover: true,
        requireSourceNonCover: false,
        forbidHeavyFooterBar: true,
        forbidAccidentalAppendixNavigation: true,
      },
    },
  },
  neom: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'neom',
    navLabel: 'NEOM',
    name: 'NEOM Authority',
    description: 'NEOM Authority deck shell: ALL CAPS Arial titles, regular subtitles, yellow column headers, bottom-left logo only.',
    status: 'sandbox-0.1',
    footerBranding: '',
    theme: NEOM_THEME,
    layoutContract: NEOM_LAYOUT_CONTRACT,
    freestyleOverrides: NEOM_FREESTYLE_OVERRIDES,
    componentPatterns: NEOM_COMPONENT_PATTERNS,
    pptxContract: NEOM_PPTX_CONTRACT,
    promptContract: NEOM_PROMPT_CONTRACT,
    designContract: NEOM_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:neom:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'neom',
      forceBundledDefault: true,
      assetVersion: 'neom-nafb5-v1',
      notes: 'Bundled from 22042026 NEOM Authority NAFB5_vF.pptx; slide 46 + master geometry.',
    },
    chrome: {
      footerText: '',
      logoPlacement: 'bottom-left',
      positions: neomStandardInches,
      injectPreviewLogo: true,
      injectExportLogo: false,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'NEOM Authority NAFB5 vF',
          fileName: '22042026- NEOM Authority_NAFB5_vF.pptx',
          slides: 215,
          role: 'bundled master; slide 46 mandate / column layout reference',
        },
      ],
      rawThemeSlots: {
        dk1: '#13100D',
        dk2: '#2B2725',
        lt1: '#FFFFFF',
        accent1: '#EBC03F',
        accent2: '#FBF8E9',
        accent3: '#F5DFA2',
        accent4: '#4E4C4A',
        accent5: '#898786',
        accent6: '#E6E8EB',
      },
      notes: [
        'Native 13.333x7.5in mapped to 960x540 at 72px/in.',
        'Master geometry: title 29,29,902x22; subtitle 29,60,902x25; body 29,90,902x410.',
        'Footer activation line y≈520; logo bottom-left 35,517,45x12 from master.',
        'Title 20pt bold / subtitle 18pt regular, ALL CAPS.',
      ],
    },
    validationRules: {
      requiredColors: ['#13100D', '#EBC03F', '#FFFFFF', '#FBF8E9'],
      preferredSurfaceColors: ['#FFFFFF', '#FBF8E9', '#FCF0D1', '#F2F3F5'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#C3984D', '#d4687a', '#D4687A', '#4b5563'],
      contrastRules: [
        'Yellow (#EBC03F) headers: label text #13100D on yellow only.',
        'Index/step squares inside headers: background #13100D, text #FFFFFF — never grey (#898786, #4E4C4A, #4b5563) with dark or blue text.',
        'Do not use var(--info) blue on dark or grey fills.',
      ],
      forbiddenDominantColors: ['#8E1E1E', '#4F008C', '#C3984D'],
      disallowedFonts: ['Georgia', 'STC Forward', 'Fund Light', 'SE Medium', 'Noto Sans', 'Poppins'],
      disallowedFooterText: ['Strategy&'],
      minFontPx: 8,
      targetBodyFontPx: 11,
      fontSizesPt: {
        titleStandard: { min: 18, max: 20 },
        titleCover: { min: 24, max: 32 },
        subtitle: { min: 16, max: 18 },
        body: { min: 10, max: 12 },
        bodyDense: { min: 8, max: 10 },
        footer: { min: 7, max: 8 },
      },
      layoutBands: {
        logoSafeBottomPct: 8,
        titleMaxBottomPct: 16,
        subtitleMaxBottomPct: 20,
        contentStartPct: 17,
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
        forbidHeavyFooterBar: false,
        forbidAccidentalAppendixNavigation: true,
      },
    },
  },
  eca: {
    schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
    id: 'eca',
    navLabel: 'ECA CP',
    name: 'ECA CP',
    description: 'ECA CP template: white background, Tahoma typography, teal #41A4A5 titles, per-slide section tracker strip, orange + cyan accents. No subtitle.',
    status: 'brand-0.1',
    footerBranding: '',
    theme: ECA_THEME,
    layoutContract: ECA_LAYOUT_CONTRACT,
    freestyleOverrides: ECA_FREESTYLE_OVERRIDES,
    componentPatterns: ECA_COMPONENT_PATTERNS,
    pptxContract: ECA_PPTX_CONTRACT,
    promptContract: ECA_PROMPT_CONTRACT,
    designContract: ECA_PROMPT_CONTRACT,
    pptxMaster: {
      mode: 'profile-bound',
      templateId: PROFILE_TEMPLATE_SLOT.DEFAULT,
      bundled: true,
      storageKey: 'client-template:eca:default',
      serverSync: 'backend-profile-default',
      serverProfileId: 'eca',
      forceBundledDefault: true,
      useProfileChrome: false,
      assetVersion: 'eca-cp-master-v3',
      notes: 'Bundled ECA CP master rebuilt via backend/scripts/build-eca-cp-master-pptx.py (clean Content_Types, rels, no think-cell/tags); slideMaster1 + slideLayout2 white content + slideLayout3 cover; 13.333x7.5in.',
    },
    chrome: {
      footerText: '',
      positions: ecaStandardInches,
      injectPreviewLogo: false,
      injectExportLogo: false,
    },
    evidence: {
      sourceDecks: [
        {
          label: 'ECA CP Template 2 for Edwin AI',
          fileName: '20260614_ECA CP_template 2_for Edwin AI.pptx',
          slides: 48,
          role: 'bundled master and canonical ECA CP visual system',
        },
      ],
      rawThemeSlots: {
        dk1: '#000000',
        lt1: '#FFFFFF',
        dk2: '#F28808',
        lt2: '#53B0C5',
        accent1: '#D95022',
        accent2: '#7FBC80',
        accent6: '#40A5A5',
      },
      notes: [
        'Native source deck was 21.99x12.37in; bundled master resized to 13.333x7.5in mapped to 960x540px.',
        'Canonical content layout slideLayout2 (1_Title Only - White): title 35,19,917x40 (Tahoma 32 teal); body 35,87,917x413; slideNum 727,516; no subtitle.',
        'Section tracker is per-slide: number 35,4 + label 51,4 (Tahoma 12-14pt black), not the master Slide Tags stub.',
        'Primary slide title color #41A4A5 (109 uses) dominates; chart scheme colors accent1 #D95022, accent2 #7FBC80, accent5 #5E417B, accent6 #40A5A5.',
        'Bundled master rebuilt with valid Content_Types and cleaned rels (no think-cell OLE/tags).',
        'Logo lockup image4.png on cover at 51,70; bundled at backend/assets/client-templates/eca/logo.png.',
      ],
    },
    validationRules: {
      requiredColors: ['#41A4A5', '#D95022', '#7FBC80', '#5E417B', '#53B0C5', '#000000', '#FFFFFF', '#1D4666', '#B2D7B3'],
      preferredSurfaceColors: ['#EBE9E5', '#F2F2F2', '#FFFFFF', '#E8F4F4'],
      disallowedColors: ['#8E1E1E', '#A32020', '#4F008C', '#EBC03F', '#13100D', '#DB536A', '#d4687a', '#D4687A', '#00785C'],
      disallowedFonts: ['Georgia', 'STC Forward', 'Fund Light', 'SST Arabic Roman', 'Noto Sans'],
      disallowedFooterText: ['Strategy&'],
      minFontPx: 8,
      targetBodyFontPx: 12,
      fontSizesPt: {
        titleStandard: { min: 28, max: 32 },
        titleCover: { min: 32, max: 40 },
        body: { min: 10, max: 12 },
        bodyDense: { min: 8, max: 10 },
        footer: { min: 7, max: 8 },
        sectionTracker: { min: 12, max: 14 },
      },
      layoutBands: {
        titleMaxBottomPct: 12,
        sectionTrackerMaxBottomPct: 6,
        contentStartPct: 16,
        footerStartPct: 93,
      },
      density: {
        maxBulletsStandard: 6,
        maxModulesStandard: 6,
        minBodyPt: 8,
      },
      chrome: {
        requireLogo: false,
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
  swatch: {
    accent: profile.theme?.colors?.accent || '#8E1E1E',
    heading: profile.theme?.colors?.heading || '#111111',
    page: profile.theme?.colors?.page || '#FFFFFF',
  },
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
  if (profile?.id === 'neom') {
    const userLabel = String(settings.footerBranding ?? '').trim();
    if (userLabel && !/NEOM\s+AUTHORITY\s+ACTIVATION/i.test(userLabel)) return userLabel;
    return '';
  }
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
- Standard subtitle band: ${standard.subtitle ? formatRect(standard.subtitle) : 'none (title-only profile)'}
- Standard body/content band: ${formatRect(standard.body)}
- Standard source/footer band: ${formatRect(standard.source)}
- Standard slide number band: ${formatRect(standard.slideNumber)}
${standard.sectionTracker?.number ? `- Section tracker number: ${formatRect(standard.sectionTracker.number)}\n` : ''}${standard.sectionTracker?.label ? `- Section tracker label: ${formatRect(standard.sectionTracker.label)}\n` : ''}${cover.title ? `- Cover title band: ${formatRect(cover.title)}\n` : ''}${layout.denseTableMatrix?.contentBand ? `- Dense table/matrix content band: ${formatRect(layout.denseTableMatrix.contentBand)}\n` : ''}${layout.orgChartProcess?.contentBand ? `- Org/process content band: ${formatRect(layout.orgChartProcess.contentBand)}\n` : ''}`;
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
  if (rules.contrastRules?.length) parts.push(...rules.contrastRules);
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

  let next = shell
    .replace(
      /\| `h1\.title` \|[^\n]+/,
      `| \`h1.title\` | top: ${title.y}px, left: ${title.x}px, width: ${title.w}px, height: ${title.h}px -- ${titleFont} regular ${titleFontSize}, ${titleColor} |`,
    );
  if (subtitle) {
    next = next.replace(
      /\| `h2\.subtitle` \|[^\n]+/,
      `| \`h2.subtitle\` | top: ${subtitle.y}px, left: ${subtitle.x}px, width: ${subtitle.w}px, height: ${subtitle.h}px -- ${subtitleFont} regular ${subtitleFontSize}, ${subtitleColor} |`,
    );
  } else {
    next = next.replace(
      /\| `h2\.subtitle` \|[^\n]+/,
      '| `h2.subtitle` | **Not used on this profile — title only; do not emit h2.subtitle** |',
    );
  }
  return next
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

  let next = rewriteFreestyleShellForProfile(prompt, profile)
    .replace(
      /- `h1\.title`: top 24px, left 28px, width 904px, Georgia 28px/g,
      `- \`h1.title\`: top ${title.y}px, left ${title.x}px, width ${title.w}px, ${fontTitle} ${titleFontSize} regular, ${headingColor}`
    );
  if (subtitle) {
    next = next.replace(
      /- `h2\.subtitle`: top 95px, left 28px, width 904px, Arial bold 18px/g,
      `- \`h2.subtitle\`: top ${subtitle.y}px, left ${subtitle.x}px, width ${subtitle.w}px, ${fontHeading} ${subtitleFontSize} regular, ${subtitleColor}`
    );
  }
  return next
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
