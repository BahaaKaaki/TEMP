import JSZip from 'jszip';

import { getClientDesignProfile } from '../utils/clientDesignProfiles';
import { DEFAULT_THEME } from '../utils/themeUtils';

const EMU_PER_INCH = 914400;

/**
 * Extract brand colors, fonts, logo, footer text, and layout positions
 * from a PPTX file.
 *
 * @param {ArrayBuffer} pptxBuffer - The raw PPTX file bytes
 * @returns {Promise<{theme: object, raw: object, chrome: object, evidence: object}|null>}
 */
export async function extractBranding(pptxBuffer, options = {}) {
  const zip = await JSZip.loadAsync(pptxBuffer);
  const profile = getClientDesignProfile(options.profileId || 'strategy');

  const themeFile = zip.file('ppt/theme/theme1.xml');
  if (!themeFile) return null;

  const xml = await themeFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const colors = extractColors(doc);
  const fonts = extractFonts(doc);

  if (!colors && !fonts) return null;

  const theme = profile.id === 'strategy'
    ? mapToAppTheme(colors, fonts)
    : structuredClone(profile.theme || mapToAppTheme(colors, fonts));
  const chrome = await extractChrome(zip);
  const evidence = await extractTemplateEvidence(zip, { rawColors: colors, rawFonts: fonts, profile });
  return {
    theme,
    raw: {
      colors,
      fonts,
      semanticMapping: profile.id === 'strategy' ? 'raw-theme-slots' : `profile:${profile.id}`,
    },
    chrome,
    evidence,
    profileId: profile.id,
    extractionVersion: 'client-profile-v1',
  };
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

async function extractTemplateEvidence(zip, { rawColors, rawFonts, profile } = {}) {
  const paths = Object.keys(zip.files);
  const slidePaths = paths.filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  const masterPaths = paths.filter(f => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(f));
  const layoutPaths = paths
    .filter(f => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/(\d+)/g).pop(), 10) - parseInt(b.match(/(\d+)/g).pop(), 10));

  const fontUsage = {};
  const footerLabels = new Set();
  const layoutSummaries = [];

  for (const path of layoutPaths) {
    const xml = await zip.files[path].async('string');
    collectFontUsage(xml, fontUsage);
    collectFooterLikeText(xml, footerLabels);
    layoutSummaries.push({
      path,
      name: xml.match(/<p:cSld\s+name="([^"]+)"/)?.[1] || null,
      type: xml.match(/<p:sldLayout[^>]*type="([^"]+)"/)?.[1] || null,
      placeholders: summarizePlaceholders(xml),
      shapeCount: (xml.match(/<p:sp\b/g) || []).length,
      pictureCount: (xml.match(/<p:pic\b/g) || []).length,
    });
  }

  const masterSummaries = [];
  for (const path of masterPaths) {
    const xml = await zip.files[path].async('string');
    collectFontUsage(xml, fontUsage);
    collectFooterLikeText(xml, footerLabels);
    masterSummaries.push({
      path,
      shapeCount: (xml.match(/<p:sp\b/g) || []).length,
      pictureCount: (xml.match(/<p:pic\b/g) || []).length,
    });
  }

  return {
    profileId: profile?.id || 'strategy',
    slideCount: slidePaths.length,
    masterCount: masterPaths.length,
    layoutCount: layoutPaths.length,
    rawThemeColors: rawColors || {},
    rawThemeFonts: rawFonts || {},
    semanticTheme: profile?.id && profile.id !== 'strategy'
      ? 'Profile semantic theme overrides raw OOXML theme slots.'
      : 'Raw OOXML theme slots mapped to Edwin theme tokens.',
    fontUsage,
    footerLabels: Array.from(footerLabels).slice(0, 20),
    layouts: layoutSummaries,
    masters: masterSummaries,
  };
}

function collectFontUsage(xml, fontUsage) {
  const matches = xml.matchAll(/<a:latin[^>]*typeface="([^"]+)"/g);
  for (const match of matches) {
    const font = match[1];
    if (!font) continue;
    fontUsage[font] = (fontUsage[font] || 0) + 1;
  }
}

function collectFooterLikeText(xml, footerLabels) {
  const matches = xml.matchAll(/<a:t>([^<]{1,120})<\/a:t>/g);
  for (const match of matches) {
    const text = match[1].trim();
    if (!text) continue;
    if (/\b(source|confidential|strategy&|stc|page|copyright|footer)\b/i.test(text)) {
      footerLabels.add(text);
    }
  }
}

function summarizePlaceholders(xml) {
  const summaries = [];
  const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  let match;
  while ((match = spRegex.exec(xml)) !== null) {
    const shapeXml = match[0];
    if (!/<p:ph\b/.test(shapeXml)) continue;
    const phMatch = shapeXml.match(/<p:ph\b([^>]*)\/?>/);
    const attrs = phMatch?.[1] || '';
    summaries.push({
      type: attrs.match(/\btype="([^"]+)"/)?.[1] || 'body',
      idx: attrs.match(/\bidx="([^"]+)"/)?.[1] || null,
      position: extractShapePosition(shapeXml),
    });
  }
  return summaries;
}

// ── Template Chrome Extraction ──────────────────────────────────────────────

function emuToInch(emu) {
  return parseFloat((parseInt(emu, 10) / EMU_PER_INCH).toFixed(3));
}

function extractShapePosition(shapeXml) {
  const offMatch = shapeXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
  const extMatch = shapeXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
  if (!offMatch || !extMatch) return null;
  const pos = {
    x: emuToInch(offMatch[1]),
    y: emuToInch(offMatch[2]),
    w: emuToInch(extMatch[1]),
    h: emuToInch(extMatch[2]),
  };
  const font = extractShapeFont(shapeXml);
  if (font) pos.font = font;
  return pos;
}

function extractShapeFont(shapeXml) {
  const rPrMatch = shapeXml.match(/<a:rPr\b[^>]*\/?>|<a:defRPr\b[^>]*\/?>/);
  if (!rPrMatch) return null;
  const tag = rPrMatch[0];
  const font = {};
  const szMatch = tag.match(/\bsz="(\d+)"/);
  if (szMatch) font.fontSize = parseInt(szMatch[1], 10) / 100;
  if (/\bb="1"/.test(tag)) font.bold = true;
  if (/\bi="1"/.test(tag)) font.italic = true;
  const typefaceMatch = shapeXml.match(/<a:latin[^>]*typeface="([^"]+)"/);
  if (typefaceMatch) font.fontFace = typefaceMatch[1];
  return Object.keys(font).length > 0 ? font : null;
}

/**
 * Extract chrome (logo, footer text, layout positions) from a PPTX zip.
 */
async function extractChrome(zip) {
  const chrome = { logo: null, footerText: null, positions: null };

  try {
    chrome.logo = await extractLogo(zip);
  } catch (e) {
    console.warn('[Chrome] Logo extraction failed:', e.message);
  }

  try {
    const layoutResult = await extractLayoutInfo(zip);
    chrome.footerText = layoutResult.footerText;
    chrome.positions = layoutResult.positions;
  } catch (e) {
    console.warn('[Chrome] Layout extraction failed:', e.message);
  }

  return chrome;
}

/**
 * Find the logo image from the slide master.
 * Looks for small image shapes in the header zone (top 1.5" of slide, area < 15% of slide).
 */
async function extractLogo(zip) {
  const masterPath = 'ppt/slideMasters/slideMaster1.xml';
  const masterRelsPath = 'ppt/slideMasters/_rels/slideMaster1.xml.rels';

  const masterFile = zip.file(masterPath);
  const relsFile = zip.file(masterRelsPath);
  if (!masterFile || !relsFile) return null;

  const masterXml = await masterFile.async('string');
  const relsXml = await relsFile.async('string');

  const rIdToTarget = {};
  const relMatches = relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g);
  for (const m of relMatches) {
    rIdToTarget[m[1]] = m[2];
  }

  const SLIDE_AREA = 13.333 * 7.5;
  const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>|<p:pic\b[\s\S]*?<\/p:pic>/g;
  let match;
  const candidates = [];

  while ((match = spRegex.exec(masterXml)) !== null) {
    const shapeXml = match[0];
    const blipMatch = shapeXml.match(/<a:blip[^>]*r:embed="(rId\d+)"/);
    if (!blipMatch) continue;

    const pos = extractShapePosition(shapeXml);
    if (!pos) continue;

    const area = pos.w * pos.h;
    const areaRatio = area / SLIDE_AREA;
    if (areaRatio > 0.15) continue;
    if (pos.y + pos.h > 2.0) continue;

    const rId = blipMatch[1];
    let mediaPath = rIdToTarget[rId];
    if (!mediaPath) continue;
    if (!mediaPath.startsWith('ppt/')) {
      mediaPath = 'ppt/slideMasters/' + mediaPath.replace(/^\.\.\//, '');
      mediaPath = mediaPath.replace('ppt/slideMasters/../', 'ppt/');
    }

    const mediaFile = zip.file(mediaPath);
    if (!mediaFile) continue;

    const imageData = await mediaFile.async('base64');
    const ext = mediaPath.split('.').pop().toLowerCase();
    const mimeMap = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      emf: 'image/x-emf',
      wmf: 'image/wmf',
    };

    candidates.push({
      image: `data:${mimeMap[ext] || 'image/png'};base64,${imageData}`,
      mediaPath,
      ...pos,
      areaRatio,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.areaRatio - a.areaRatio);
  const best = candidates[0];
  console.log('[Chrome] Found logo: %s at (%.2f, %.2f) %.2f x %.2f in', best.mediaPath, best.x, best.y, best.w, best.h);
  return best;
}

/**
 * Extract footer text and placeholder positions from the "content" layout.
 */
async function extractLayoutInfo(zip) {
  const result = { footerText: null, positions: {} };

  const layoutFiles = Object.keys(zip.files)
    .filter(f => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/(\d+)/g).pop()) - parseInt(b.match(/(\d+)/g).pop()));

  let contentLayoutXml = null;
  for (const path of layoutFiles) {
    const xml = await zip.files[path].async('string');

    let isContent = false;
    const typeMatch = xml.match(/<p:sldLayout[^>]*type="([^"]+)"/);
    if (typeMatch && (typeMatch[1] === 'obj' || typeMatch[1] === 'tx')) {
      isContent = true;
    }
    if (!isContent) {
      const nameMatch = xml.match(/<p:cSld\s+name="([^"]+)"/);
      if (nameMatch) {
        const n = nameMatch[1].toLowerCase();
        if (n.includes('content') || n.includes('title and')) isContent = true;
      }
    }

    if (isContent) { contentLayoutXml = xml; break; }
  }

  if (!contentLayoutXml && layoutFiles.length >= 2) {
    contentLayoutXml = await zip.files[layoutFiles[1]].async('string');
  }
  if (!contentLayoutXml) return result;

  const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  let match;
  while ((match = spRegex.exec(contentLayoutXml)) !== null) {
    const shapeXml = match[0];
    if (!/<p:ph\b/.test(shapeXml)) continue;

    const phTypeMatch = shapeXml.match(/<p:ph[^>]*type="([^"]+)"/);
    const phType = phTypeMatch ? phTypeMatch[1] : 'body';
    const pos = extractShapePosition(shapeXml);
    if (!pos) continue;

    if (phType === 'title' || phType === 'ctrTitle') {
      result.positions.title = pos;
    } else if (phType === 'subTitle') {
      result.positions.subtitle = pos;
    } else if (phType === 'body' || (!phTypeMatch && !result.positions.body)) {
      result.positions.body = pos;
    } else if (phType === 'ftr') {
      result.positions.footer = pos;
      const textMatch = shapeXml.match(/<a:t>([^<]+)<\/a:t>/);
      if (textMatch) result.footerText = textMatch[1].trim();
    } else if (phType === 'sldNum') {
      result.positions.slideNum = pos;
    } else if (phType === 'dt') {
      result.positions.date = pos;
    }
  }

  if (Object.keys(result.positions).length > 0) {
    console.log('[Chrome] Layout positions:', JSON.stringify(result.positions));
  }
  if (result.footerText) {
    console.log('[Chrome] Footer text:', result.footerText);
  }

  return result;
}
