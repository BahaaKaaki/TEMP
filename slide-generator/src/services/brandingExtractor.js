import JSZip from 'jszip';

import { DEFAULT_THEME } from '../utils/themeUtils';

/**
 * Extract brand colors and fonts from a PPTX file's theme XML.
 *
 * PPTX files contain an Office Theme at `ppt/theme/theme1.xml` with:
 *   - <a:clrScheme>: dk1, dk2, lt1, lt2, accent1-accent6, hlink, folHlink
 *   - <a:fontScheme>: majorFont (headings) and minorFont (body)
 *
 * This function parses those elements and maps them to the app's theme shape.
 *
 * @param {ArrayBuffer} pptxBuffer - The raw PPTX file bytes
 * @returns {Promise<{theme: object, raw: object}|null>} Extracted theme or null
 */
export async function extractBranding(pptxBuffer) {
  const zip = await JSZip.loadAsync(pptxBuffer);

  const themeFile = zip.file('ppt/theme/theme1.xml');
  if (!themeFile) return null;

  const xml = await themeFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const colors = extractColors(doc);
  const fonts = extractFonts(doc);

  if (!colors && !fonts) return null;

  const theme = mapToAppTheme(colors, fonts);
  return { theme, raw: { colors, fonts } };
}

function extractColors(doc) {
  const scheme = doc.querySelector('clrScheme');
  if (!scheme) return null;

  const result = {};
  const colorElements = [
    'dk1', 'dk2', 'lt1', 'lt2',
    'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
    'hlink', 'folHlink',
  ];

  for (const name of colorElements) {
    const el = scheme.querySelector(name);
    if (!el) continue;

    const srgb = el.querySelector('srgbClr');
    if (srgb) {
      result[name] = '#' + srgb.getAttribute('val');
      continue;
    }

    const sys = el.querySelector('sysClr');
    if (sys) {
      result[name] = '#' + (sys.getAttribute('lastClr') || sys.getAttribute('val') || '000000');
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function extractFonts(doc) {
  const scheme = doc.querySelector('fontScheme');
  if (!scheme) return null;

  const result = {};

  const majorLatin = scheme.querySelector('majorFont latin');
  if (majorLatin) {
    result.major = majorLatin.getAttribute('typeface');
  }

  const minorLatin = scheme.querySelector('minorFont latin');
  if (minorLatin) {
    result.minor = minorLatin.getAttribute('typeface');
  }

  return (result.major || result.minor) ? result : null;
}

/**
 * Map raw OOXML theme colors/fonts to the app's DEFAULT_THEME shape.
 */
function mapToAppTheme(rawColors, rawFonts) {
  const theme = structuredClone(DEFAULT_THEME);
  theme.name = 'Extracted Brand';

  if (rawColors) {
    if (rawColors.accent1) theme.colors.accent = rawColors.accent1;
    if (rawColors.accent2) theme.colors.accentHover = rawColors.accent2;
    // Soft accent: lighten accent1 or use a pale variant
    if (rawColors.accent1) theme.colors.accentSoft = lightenHex(rawColors.accent1, 0.85);
    if (rawColors.dk1) theme.colors.heading = rawColors.dk1;
    if (rawColors.dk2) theme.colors.body = rawColors.dk2;
    if (rawColors.lt1) theme.colors.page = rawColors.lt1;
    if (rawColors.lt2) theme.colors.surface = rawColors.lt2;
    // Derive surfaceAlt from lt2 if available
    if (rawColors.lt2) theme.colors.surfaceAlt = darkenHex(rawColors.lt2, 0.05);
    // Border from a midpoint between lt1 and dk1
    if (rawColors.lt1 && rawColors.dk1) {
      theme.colors.border = mixHex(rawColors.lt1, rawColors.dk1, 0.15);
    }
    if (rawColors.accent3) theme.colors.success = rawColors.accent3;
    if (rawColors.accent4) theme.colors.warning = rawColors.accent4;
    if (rawColors.accent5) theme.colors.danger = rawColors.accent5;
    theme.colors.onAccent = isLightColor(rawColors.accent1 || '#8E1E1E') ? '#111111' : '#FFFFFF';
    // Muted: midpoint between body and border
    if (rawColors.dk2 && rawColors.lt2) {
      theme.colors.muted = mixHex(rawColors.dk2, rawColors.lt2, 0.4);
    }
  }

  if (rawFonts) {
    if (rawFonts.major) theme.fonts.title = `"${rawFonts.major}", serif`;
    if (rawFonts.major) theme.fonts.heading = `"${rawFonts.major}", sans-serif`;
    if (rawFonts.minor) theme.fonts.body = `"${rawFonts.minor}", sans-serif`;
  }

  return theme;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function lightenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

function darkenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function mixHex(hex1, hex2, ratio) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * ratio,
    c1.g + (c2.g - c1.g) * ratio,
    c1.b + (c2.b - c1.b) * ratio,
  );
}

function isLightColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
