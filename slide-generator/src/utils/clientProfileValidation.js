import { getClientDesignProfile } from './clientDesignProfiles';

function collectSlideText(slides = [], sharedCSS = '') {
  return [
    sharedCSS,
    ...slides.flatMap(slide => [
      slide?.html || '',
      slide?.customCSS || '',
      slide?.title || '',
      slide?.subtitle || '',
    ]),
  ].join('\n');
}

function containsAny(text, values = []) {
  const lower = text.toLowerCase();
  return values.filter(value => lower.includes(String(value).toLowerCase()));
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getClientProfileValidationChecklist(profileId = 'strategy') {
  const profile = getClientDesignProfile(profileId);
  const rules = profile.validationRules || {};
  return {
    profileId: profile.id,
    profileName: profile.name,
    evidenceArtifacts: profile.evidence?.artifacts || [],
    checks: [
      'Generate 3-5 representative consulting slides with the active client profile selected.',
      'Verify the preview uses the active semantic theme tokens and footer branding.',
      'Verify generated HTML/PPTX output avoids disallowed colors, fonts, and footer text.',
      'Verify title, subtitle, body, source/footer, and slide-number bands match the profile layout contract.',
      'Export PPTX and inspect generated metadata/chrome against the active profile.',
    ],
    requiredColors: rules.requiredColors || [],
    requiredSurfaceFamily: rules.preferredSurfaceColors || [],
    disallowedColors: rules.disallowedColors || [],
    forbiddenDominantColors: rules.forbiddenDominantColors || [],
    disallowedFonts: rules.disallowedFonts || [],
    disallowedFooterText: rules.disallowedFooterText || [],
    layoutBands: rules.layoutBands || {},
    density: rules.density || {},
  };
}

export function validateClientProfileDemo({
  slides = [],
  sharedCSS = '',
  settings = {},
  theme = null,
  profileId = settings.clientDesignProfileId || 'strategy',
} = {}) {
  const profile = getClientDesignProfile(profileId);
  const rules = profile.validationRules || {};
  const deckText = collectSlideText(slides, sharedCSS);
  const themeText = JSON.stringify(theme || profile.theme || {});
  const footerText = settings.footerBranding || profile.footerBranding || '';

  const requiredColorHits = unique(rules.requiredColors)
    .map(color => ({ color, present: `${deckText}\n${themeText}`.toLowerCase().includes(color.toLowerCase()) }));
  const surfaceHits = unique(rules.preferredSurfaceColors)
    .map(color => ({ color, present: `${deckText}\n${themeText}`.toLowerCase().includes(color.toLowerCase()) }));
  const disallowedColorHits = containsAny(deckText, rules.disallowedColors);
  const forbiddenDominantColorHits = containsAny(deckText, rules.forbiddenDominantColors);
  const disallowedFontHits = containsAny(deckText, rules.disallowedFonts);
  const disallowedFooterHits = containsAny(footerText, rules.disallowedFooterText);
  const hasLayoutContract = Boolean(profile.layoutContract?.standardContent);
  const hasLayoutCssVars = Boolean((theme || profile.theme)?.layout?.cssVars);
  const hasPromptSections = Boolean(profile.freestyleOverrides?.shell && profile.freestyleOverrides?.theme && profile.freestyleOverrides?.writing);
  const hasPptxContract = Boolean(profile.pptxContract);

  const checks = [
    {
      id: 'required-colors',
      label: 'Required semantic colors are available',
      status: requiredColorHits.every(hit => hit.present) ? 'pass' : 'fail',
      details: requiredColorHits,
    },
    {
      id: 'disallowed-colors',
      label: 'Disallowed brand colors are absent from generated slides',
      status: disallowedColorHits.length === 0 ? 'pass' : 'fail',
      details: disallowedColorHits,
    },
    {
      id: 'surface-colors',
      label: 'Preferred client surface colors are available',
      status: surfaceHits.some(hit => hit.present) ? 'pass' : 'warn',
      details: surfaceHits,
    },
    {
      id: 'forbidden-dominant-colors',
      label: 'Forbidden dominant palette colors are absent from generated slides',
      status: forbiddenDominantColorHits.length === 0 ? 'pass' : 'fail',
      details: forbiddenDominantColorHits,
    },
    {
      id: 'disallowed-fonts',
      label: 'Disallowed fonts are absent from generated slides',
      status: disallowedFontHits.length === 0 ? 'pass' : 'fail',
      details: disallowedFontHits,
    },
    {
      id: 'footer-branding',
      label: 'Footer branding matches the active client profile',
      status: disallowedFooterHits.length === 0 ? 'pass' : 'fail',
      details: { footerText, disallowedFooterHits },
    },
    {
      id: 'layout-contract',
      label: 'Profile defines title/body/footer layout bands',
      status: hasLayoutContract ? 'pass' : 'warn',
      details: profile.layoutContract?.standardContent || null,
    },
    {
      id: 'layout-css-vars',
      label: 'Profile layout bands are reflected as preview CSS variables',
      status: hasLayoutCssVars ? 'pass' : 'warn',
      details: (theme || profile.theme)?.layout?.cssVars || null,
    },
    {
      id: 'prompt-sections',
      label: 'Profile defines shell/theme/vibe/writing prompt sections',
      status: hasPromptSections ? 'pass' : 'warn',
      details: profile.freestyleOverrides || null,
    },
    {
      id: 'pptx-contract',
      label: 'Profile defines PPTX export contract',
      status: hasPptxContract ? 'pass' : 'warn',
      details: profile.pptxContract || null,
    },
  ];

  const failed = checks.filter(check => check.status === 'fail');
  const warned = checks.filter(check => check.status === 'warn');
  return {
    profileId: profile.id,
    profileName: profile.name,
    ok: failed.length === 0,
    summary: {
      total: checks.length,
      passed: checks.filter(check => check.status === 'pass').length,
      failed: failed.length,
      warned: warned.length,
    },
    checks,
    evidenceArtifacts: profile.evidence?.artifacts || [],
  };
}
