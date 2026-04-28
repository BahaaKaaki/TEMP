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
    surfaceAlt: '#EDDCF9',
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
    title: '"STC Forward", Arial, sans-serif',
    heading: '"STC Forward", Arial, sans-serif',
    body: '"STC Forward", Arial, sans-serif',
  },
  layout: {
    cssVars: {
      '--left-x': '15px',
      '--title-y': '28px',
      '--title-w': '931px',
      '--title-font-size': '28px',
      '--title-font-weight': '500',
      '--title-line-height': '1.15',
      '--subtitle-y': '105px',
      '--subtitle-w': '931px',
      '--subtitle-color': '#FF375E',
      '--subtitle-font-size': '16px',
      '--subtitle-font-weight': '500',
      '--frame-y': '134px',
      '--frame-w': '931px',
      '--frame-h': '340px',
      '--footer-x': '15px',
      '--footer-y': '494px',
      '--footer-bottom': 'auto',
      '--footer-w': '931px',
      '--footer-font-size': '9px',
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
    body: { x: 15, y: 134, w: 933, h: 340 },
    source: { x: 15, y: 494, w: 465, h: 19 },
    slideNumber: { x: 935, y: 519, w: 14, h: 10 },
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
- h1.title: left 15px, top 28px, width 931px, height about 71px, STC Forward/Arial medium 28px, color #4F008C.
- h2.subtitle: left 15px, top 105px, width 931px, height about 19px, STC Forward/Arial medium 16px, color #FF375E.
- div.frame: left 15px, top 134px, width 933px, height 340px. Design all custom content inside this STC frame, not the generic 904x366 frame.
- footer: source at bottom-left around x=15 y=494; slide number bottom-right around x=935 y=519.
Use structured content in the middle band and keep the bottom footer band clear. Use the standard content bands exactly unless the user explicitly asks for a cover, divider, appendix, or editorial variant.`,
  theme: `Use STC purple (#4F008C) for titles, structural headers, major bars, and primary emphasis. Use coral (#FF375E) as the subtitle/kicker accent, vivid lavender (#A54EE1 family) only for small markers, pale lilac surfaces (#F2E6FA to #FBF8FE), charcoal body text (#1D252D), and white backgrounds. Do not let the content topic override the brand palette; even ocean/science topics should remain STC purple/coral/lilac rather than blue-led. Do not use Office blue/orange or raw theme yellow/green/cyan as dominant colors. Treat the serif black/red outlook style as an explicit alternate editorial variant, not the default.`,
  vibe: `Board-ready, strategy-consulting, precise, modular, high-clarity, low-decoration. Use strong hierarchy, tight alignment, restrained accents, generous white space in the header, denser structured content in the middle, and tiny unobtrusive footer chrome. Avoid playful UI, consumer-product styling, heavy shadows, and decorative gradients except on approved photo covers.`,
  writing: `Write conclusion-led titles. Use short analytical subtitles that name the lens, not the takeaway. Keep copy executive, factual, and directive. Use full-clause bullets with selective bold emphasis only for the highest-value words. Avoid slogans, fluff, generic headings, and marketing language.`,
  css: `Use square-cornered boxes by default, thin 0.75-1.25pt borders, purple header bars, lilac body panels, dark body text, and reversed white text on dark fills. Use chevrons, tabs, trackers, and thin connector lines for structure. Avoid default chart palettes, rounded consumer cards, strong shadows, and gradient fills except on photo covers.`,
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
- Use white backgrounds for content slides, with pale violet surfaces (#FBF8FE / #EDDCF9) and thin violet borders (#DBB8F3) for grouping.
- Use dark navy (#1D252D) for titles and body text.
- Use red/pink (#FF375E) for subtitles, warning emphasis, and selected labels.
- Use green (#00C48C) for recommendations, positive options, or approved status.
- Use yellow (#FFDD40), orange (#FF6A39), cyan (#1BCED8), and gray (#8E9AA0) as secondary accents only.

## Typography
- Use STC Forward with Arial fallback for titles, headings, labels, tables, and body copy.
- Do not use Georgia for STC slides.
- Keep visible text at 10px or larger; body/table text should target 12px and section/card titles 14px+.

## Layout and chrome
- STC slides use a 960x540 canvas mapped from 13.33x7.5 in.
- Content-slide title band: title around x=15, y=29, w=931, h=71.
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

const stcStandardInches = {
  title: pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.title),
  subtitle: pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.subtitle),
  body: pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.body),
  footer: pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.source),
  slideNum: pxRectToInches(STC_LAYOUT_CONTRACT.standardContent.slideNumber),
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
      bundled: false,
      storageKey: 'client-template:stc:default',
      serverSync: 'planned-template-catalog',
      notes: 'Reference PPTX files stay outside the repo; derived profile contract is stored in code.',
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
      preferredSurfaceColors: ['#F2E6FA', '#F5EDFB', '#EDDCF9', '#FBF8FE', '#DBB8F3'],
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

  return shell
    .replace(
      /\| `h1\.title` \|[^\n]+/,
      `| \`h1.title\` | top: ${title.y}px, left: ${title.x}px, width: ${title.w}px, height: ${title.h}px -- ${titleFont} semibold 28px, ${titleColor} |`,
    )
    .replace(
      /\| `h2\.subtitle` \|[^\n]+/,
      `| \`h2.subtitle\` | top: ${subtitle.y}px, left: ${subtitle.x}px, width: ${subtitle.w}px, height: ${subtitle.h}px -- ${subtitleFont} semibold 16px, ${subtitleColor} |`,
    )
    .replace(
      /\| `div\.frame` \|[^\n]+/,
      `| \`div.frame\` | top: ${body.y}px, left: ${body.x}px, **${body.w} x ${body.h} px** -- STC content canvas |`,
    )
    .replace(
      /\| `footer` \|[^\n]+/,
      `| \`footer\` | source bottom-left around x=${source.x}, y=${source.y}; slide number bottom-right around x=${slideNumber.x}, y=${slideNumber.y} |`,
    )
    .replace(/904 x 366/g, `${body.w} x ${body.h}`)
    .replace(/904 x 366 px/g, `${body.w} x ${body.h} px`)
    .replace(/366 px height or 904 px width/g, `${body.h} px height or ${body.w} px width`)
    .replace(/Size in pixels relative to the \*\*904 x 366\*\* frame/g, `Size in pixels relative to the **${body.w} x ${body.h}** frame`);
}

export function applyClientProfilePromptSections(sections = {}, settings = {}) {
  const profile = getActiveClientProfile(settings);
  if (!profile || profile.id === 'strategy' || !profile.freestyleOverrides) return sections;

  const next = { ...sections };
  next.shell = rewriteFreestyleShellForProfile(next.shell, profile);
  for (const sectionName of ['shell', 'theme', 'vibe', 'writing', 'hints']) {
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
