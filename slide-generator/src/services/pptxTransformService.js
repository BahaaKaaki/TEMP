// PPTX Template Transform Service
//
// Transforms an existing .pptx by mapping its content onto a target template.
//
// Architecture: TARGET-AS-SHELL + FULL COLOR REMAPPING
//   1. Clone the target template (keeps correct masters, layouts, theme, fonts)
//   2. Remove the target's content slides
//   3. Scan ALL srgbClr values in source & target
//   4. Build a comprehensive color map (OKLab perceptually uniform):
//      - Collect ALL colors: srgbClr + schemeClr with tint/shade/lumMod modifiers
//      - Expand target palette with lightness variants (OKLab L±steps)
//      - Many-to-one nearest-neighbor: multiple sources may share a target
//      - Never maps to FFFFFF (fills would disappear)
//      - Skip colors already present in target
//   5. For each source slide:
//      a. Keep slide XML intact (all shapes, placeholders, namespaces)
//      b. Remap every hardcoded srgbClr value
//      c. Enforce WCAG text contrast
//      d. Copy all referenced media/charts/embeddings from source
//   6. Update presentation.xml, presentation.xml.rels, [Content_Types].xml

import JSZip from 'jszip';

// ═══════════════════════════════════════════════════════════════════════════
// THEME & COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const THEME_COLOR_SLOTS = [
  'dk1', 'dk2', 'lt1', 'lt2',
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
  'hlink', 'folHlink',
];

/**
 * Resolve OOXML schemeClr alias slots to their canonical theme slot names.
 * PowerPoint's <a:clrMap> defines: bg1→lt1, tx1→dk1, bg2→lt2, tx2→dk2.
 * Without this, schemeClr val="bg1" fails to resolve against theme colors.
 */
const SCHEME_ALIASES = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
function resolveSchemeSlot(slot) {
  return SCHEME_ALIASES[slot] || slot;
}

export function parseThemeColors(themeXml) {
  const colors = {};
  for (const slot of THEME_COLOR_SLOTS) {
    const re = new RegExp(`<a:${slot}>([\\s\\S]*?)<\\/a:${slot}>`, 'i');
    const m = themeXml.match(re);
    if (!m) continue;
    const inner = m[1];
    const srgb = inner.match(/srgbClr\s+val="([A-Fa-f0-9]{6})"/);
    if (srgb) { colors[slot] = srgb[1].toUpperCase(); continue; }
    const sys = inner.match(/sysClr[^>]*lastClr="([A-Fa-f0-9]{6})"/);
    if (sys) colors[slot] = sys[1].toUpperCase();
  }
  return colors;
}

export function parseThemeFonts(themeXml) {
  const fonts = { major: null, minor: null };
  const maj = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/);
  if (maj) fonts.major = maj[1];
  const min = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/);
  if (min) fonts.minor = min[1];
  return fonts;
}

/**
 * Generate the standard PowerPoint theme color grid (10 cols × 5 rows).
 * Row 1: Base theme colors
 * Row 2: Tint 80% (lightest)
 * Row 3: Tint 60%
 * Row 4: Tint 40%
 * Row 5: Shade 75% (darkest)
 * Returns { grid: string[][], flat: Set<string> }
 */
export function generateThemeGrid(themeColors) {
  const slots = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const tintPcts = [100, 80, 60, 40]; // row 1-4 (100 = base)
  const shadePct = 75; // row 5

  const grid = []; // 5 rows of 10 cols
  for (let row = 0; row < 5; row++) grid.push([]);

  for (const slot of slots) {
    const base = themeColors[slot];
    if (!base) {
      for (let row = 0; row < 5; row++) grid[row].push(null);
      continue;
    }
    const hex = base.toUpperCase();
    const [r, g, b] = hexToRgb(hex);

    // Row 1: base color
    grid[0].push(hex);

    // Rows 2-4: tints (lighten towards white)
    for (let i = 1; i < 4; i++) {
      const f = tintPcts[i] / 100;
      grid[i].push(rgbToHex(
        Math.round(r * f + 255 * (1 - f)),
        Math.round(g * f + 255 * (1 - f)),
        Math.round(b * f + 255 * (1 - f))
      ));
    }

    // Row 5: shade (darken towards black)
    const sf = shadePct / 100;
    grid[4].push(rgbToHex(Math.round(r * sf), Math.round(g * sf), Math.round(b * sf)));
  }

  // Flatten to a unique set
  const flat = new Set();
  for (const row of grid) for (const hex of row) if (hex) flat.add(hex);

  return { grid, flat, slots };
}

/**
 * Classify a hex color as chromatic (has hue) or achromatic (grey/black/white).
 * Uses OKLCH chroma — C > threshold means chromatic.
 */
function isChromatic(hex) {
  const [, C] = hexToOklch(hex);
  return C > 0.04;
}

export function buildColorMap(srcColors, tgtColors, srcHexValues, tgtHexValues, { includeExtraColors = false, pinnedMap = {} } = {}) {
  // Start with GPT-pinned entries (if any) — these are never overwritten
  const map = { ...pinnedMap };
  const pinnedSrcs = new Set(Object.keys(pinnedMap));
  const pinnedTgts = new Set(Object.values(pinnedMap));

  // ── Collect ALL unique source colors ───────────────────────────────────────
  const srcAll = new Set();
  for (const slot of THEME_COLOR_SLOTS) {
    if (srcColors[slot]) srcAll.add(srcColors[slot].toUpperCase());
  }
  if (srcHexValues) for (const hex of srcHexValues) srcAll.add(hex);

  // ── Build target palette from OOXML tint/shade grid ────────────────────────
  const tgtGrid = generateThemeGrid(tgtColors);
  const tgtPalette = new Set(tgtGrid.flat);
  if (includeExtraColors && tgtHexValues) {
    for (const hex of tgtHexValues) tgtPalette.add(hex);
  }

  console.log('[ColorMap] Source palette:', srcAll.size, 'colors | Pinned (from AI):', pinnedSrcs.size);
  console.log('[ColorMap] Target palette (' + (includeExtraColors ? 'grid+extra' : 'grid only') + '):', tgtPalette.size, 'colors');

  // Source colors that still need proximity mapping:
  // - not already in target palette (identity match)
  // - not already pinned by GPT
  const srcToMap = [...srcAll].filter(hex => !tgtPalette.has(hex) && !pinnedSrcs.has(hex));
  if (srcToMap.length === 0) {
    console.log('[ColorMap] All colors covered by pinned + identity. No proximity needed.');
    return map;
  }

  // ── Separate chromatic from achromatic ────────────────────────────────────
  // Exclude targets already used by pinned entries
  const tgtMappable = [...tgtPalette].filter(hex => hex !== 'FFFFFF' && !pinnedTgts.has(hex));
  const tgtChromatic = tgtMappable.filter(isChromatic).map(hex => ({ hex, lab: hexToOklab(hex) }));
  const tgtAchromatic = tgtMappable.filter(hex => !isChromatic(hex)).map(hex => ({ hex, lab: hexToOklab(hex) }));
  const srcChromatic = srcToMap.filter(isChromatic);
  const srcAchromatic = srcToMap.filter(hex => !isChromatic(hex));

  console.log('[ColorMap] Proximity needed:', srcToMap.length, '(chromatic:', srcChromatic.length, ', achromatic:', srcAchromatic.length, ')');

  // ── 1-to-1 greedy assignment for remaining colors ──────────────────────────
  function greedyAssign(srcList, tgtPool) {
    const pairs = [];
    for (const srcHex of srcList) {
      const [sL, sA, sB] = hexToOklab(srcHex);
      for (const { hex: tHex, lab: [tL, tA, tB] } of tgtPool) {
        const dist = Math.sqrt((sL - tL) ** 2 + (sA - tA) ** 2 + (sB - tB) ** 2);
        pairs.push({ srcHex, tgtHex: tHex, dist });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);
    const usedSrc = new Set();
    const usedTgt = new Set();
    for (const { srcHex, tgtHex } of pairs) {
      if (usedSrc.has(srcHex) || usedTgt.has(tgtHex)) continue;
      map[srcHex] = tgtHex;
      usedSrc.add(srcHex);
      usedTgt.add(tgtHex);
    }
    return usedSrc;
  }

  function nearestNeighbor(srcHex, pool) {
    const [sL, sA, sB] = hexToOklab(srcHex);
    let best = null, bestDist = Infinity;
    for (const { hex, lab: [tL, tA, tB] } of pool) {
      const dist = Math.sqrt((sL - tL) ** 2 + (sA - tA) ** 2 + (sB - tB) ** 2);
      if (dist < bestDist) { best = hex; bestDist = dist; }
    }
    return best;
  }

  // Phase 1: 1-to-1 greedy within same pool
  const mappedChrom = greedyAssign(srcChromatic, tgtChromatic);
  const mappedAchr = greedyAssign(srcAchromatic, tgtAchromatic);

  // Phase 2: overflow — nearest-neighbor but enforce 1-to-1 distinctness.
  // Track used targets so two different source colors never map to the same target.
  // This preserves visual distinctions (e.g. heatmap color-coding, legends).
  const usedTgts = new Set(Object.values(map));
  const allTgt = [...tgtChromatic, ...tgtAchromatic];

  function nearestUnused(srcHex, pool) {
    const [sL, sA, sB] = hexToOklab(srcHex);
    let best = null, bestDist = Infinity;
    for (const { hex, lab: [tL, tA, tB] } of pool) {
      if (usedTgts.has(hex)) continue; // skip already-used targets
      const dist = Math.sqrt((sL - tL) ** 2 + (sA - tA) ** 2 + (sB - tB) ** 2);
      if (dist < bestDist) { best = hex; bestDist = dist; }
    }
    // If all targets are used, fall back to nearest regardless (best-effort)
    if (!best) return nearestNeighbor(srcHex, pool);
    return best;
  }

  for (const srcHex of srcChromatic) {
    if (!mappedChrom.has(srcHex)) {
      const tgt = nearestUnused(srcHex, allTgt.length > 0 ? allTgt : tgtAchromatic);
      if (tgt) { map[srcHex] = tgt; usedTgts.add(tgt); }
    }
  }
  for (const srcHex of srcAchromatic) {
    if (!mappedAchr.has(srcHex)) {
      const tgt = nearestUnused(srcHex, allTgt.length > 0 ? allTgt : tgtChromatic);
      if (tgt) { map[srcHex] = tgt; usedTgts.add(tgt); }
    }
  }

  console.log('[ColorMap] Final mappings (' + Object.keys(map).length + ', pinned:' + pinnedSrcs.size + ', proximity:' + (Object.keys(map).length - pinnedSrcs.size) + '):',
    Object.entries(map).map(([s, t]) => `${s}→${t}`).join(', '));

  return map;
}

/**
 * Remap every hardcoded srgbClr and schemeClr using the color map.
 * schemeClr references are resolved via srcColors, mapped, and converted
 * to srgbClr so the output consistently uses the mapped target color
 * rather than relying on the target theme's slot (which may differ from
 * the GPT-chosen mapping).
 */
export function remapColorsInXml(xml, colorMap, srcColors = null) {
  if (!xml || Object.keys(colorMap).length === 0) return xml;

  // Pass 1: Remap srgbClr values
  let result = xml.replace(
    /(<a:srgbClr\s+val=")([A-Fa-f0-9]{6})(")/gi,
    (m, pre, hex, suf) => {
      const mapped = colorMap[hex.toUpperCase()];
      return mapped ? pre + mapped + suf : m;
    }
  );

  // Pass 2: Convert schemeClr → srgbClr when the resolved source color has a mapping.
  // This prevents the same visual color from appearing as two different target colors
  // (one from colorMap, one from the target theme slot).
  // Pass 2: Convert schemeClr → srgbClr ONLY inside <a:solidFill> elements.
  // This is the safe scope — solidFill is where colors cause visual mismatches.
  // We do NOT touch schemeClr in style refs (fontRef, fillRef, effectRef, lnRef)
  // or other contexts where the conversion could corrupt the file.
  if (srcColors) {
    // Content forms inside solidFill: <a:solidFill><a:schemeClr val="X">...mods...</a:schemeClr></a:solidFill>
    result = result.replace(
      /<a:solidFill>([\s\S]*?)<\/a:solidFill>/gi,
      (fillBlock, inner) => {
        // Content form: <a:schemeClr val="X">...modifiers...</a:schemeClr>
        // Resolve full color (base + modifiers) for colorMap lookup.
        // If resolved color has a mapping → use it directly (strip modifiers).
        // If only base color has a mapping → use mapped base + KEEP modifiers
        // to preserve tint/shade variation in the target color space.
        let replaced = inner.replace(
          /<a:schemeClr\s+val="([^"]+)"([^>]*?)>([\s\S]*?)<\/a:schemeClr>/gi,
          (m, slot, attrs, children) => {
            const baseHex = srcColors[resolveSchemeSlot(slot)];
            if (!baseHex) return m;
            // Try resolved color (base + modifiers) first for exact match
            const resolvedHex = children.trim()
              ? applyColorModifiers(baseHex.toUpperCase(), children)
              : baseHex.toUpperCase();
            const mapped = colorMap[resolvedHex];
            if (mapped) return `<a:srgbClr val="${mapped}"/>`;
            // Fallback: map base color, keep modifiers for visual variation
            const mappedBase = colorMap[baseHex.toUpperCase()];
            if (mappedBase) {
              if (children.trim()) return `<a:srgbClr val="${mappedBase}">${children}</a:srgbClr>`;
              return `<a:srgbClr val="${mappedBase}"/>`;
            }
            return m;
          }
        );
        // Self-closing form: <a:schemeClr val="X"/> (no modifiers)
        replaced = replaced.replace(
          /<a:schemeClr\s+val="([^"]+)"(\s*\/>)/gi,
          (m, slot, closing) => {
            const srcHex = srcColors[resolveSchemeSlot(slot)];
            if (!srcHex) return m;
            const mapped = colorMap[srcHex.toUpperCase()];
            if (!mapped) return m;
            return `<a:srgbClr val="${mapped}"${closing}`;
          }
        );
        return `<a:solidFill>${replaced}</a:solidFill>`;
      }
    );
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// WCAG CONTRAST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function hexToRgb(hex) {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map(c => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return rgbToHex(v, v, v);
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex(
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OKLab / OKLCH — perceptually uniform color space (CSS Color Level 4)
// ═══════════════════════════════════════════════════════════════════════════

function srgbToLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.0031308 ? c * 12.92 * 255 : (1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
}

function hexToOklab(hex) {
  const [r, g, b] = hexToRgb(hex);
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

function oklabToHex(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return rgbToHex(Math.round(linearToSrgb(lr)), Math.round(linearToSrgb(lg)), Math.round(linearToSrgb(lb)));
}

function hexToOklch(hex) {
  const [L, a, b] = hexToOklab(hex);
  const C = Math.sqrt(a * a + b * b);
  const H = C < 0.001 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return [L, C, H];
}

function oklchToHex(L, C, H) {
  const hRad = H * Math.PI / 180;
  return oklabToHex(L, C * Math.cos(hRad), C * Math.sin(hRad));
}

function oklabDistance(hex1, hex2) {
  const [L1, a1, b1] = hexToOklab(hex1);
  const [L2, a2, b2] = hexToOklab(hex2);
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function isLightColor(hex) {
  return relativeLuminance(hex) > 0.4;
}

/**
 * Detect the effective fill color of a shape from its spPr and style.
 * Carefully excludes line/outline fills (<a:ln>).
 * Returns uppercase hex string, or null if shape is transparent/no-fill.
 */
function detectShapeFill(spXml, tgtColors) {
  // 1. Check <p:spPr> for direct fill (excluding <a:ln> content)
  const spPrMatch = spXml.match(/<p:spPr\b[^>]*>([\s\S]*?)<\/p:spPr>/);
  if (spPrMatch) {
    // Strip out <a:ln>...</a:ln> so we don't match line/outline fills
    const spPrClean = spPrMatch[1].replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, '');

    // Explicit noFill → shape is transparent
    if (/<a:noFill\s*\/>/.test(spPrClean)) return null;

    // solidFill with srgbClr
    const srgb = spPrClean.match(/<a:solidFill>\s*<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
    if (srgb) return srgb[1].toUpperCase();

    // solidFill with schemeClr (resolve aliases: bg1→lt1, tx1→dk1, etc.)
    const scheme = spPrClean.match(/<a:solidFill>\s*<a:schemeClr\s+val="([^"]+)"/);
    if (scheme) return tgtColors[resolveSchemeSlot(scheme[1])] || null;

    // gradFill — use first color stop as approximation
    const gradSrgb = spPrClean.match(/<a:gradFill[\s\S]*?<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
    if (gradSrgb) return gradSrgb[1].toUpperCase();
    const gradScheme = spPrClean.match(/<a:gradFill[\s\S]*?<a:schemeClr\s+val="([^"]+)"/);
    if (gradScheme) return tgtColors[resolveSchemeSlot(gradScheme[1])] || null;
  }

  // 2. Check <p:style> fillRef — only idx > 0 means actual fill (idx=0 = no fill)
  const fillRefMatch = spXml.match(/<a:fillRef\s+idx="(\d+)"[^>]*>([\s\S]*?)<\/a:fillRef>/);
  if (fillRefMatch && parseInt(fillRefMatch[1]) > 0) {
    const inner = fillRefMatch[2];
    const srgb = inner.match(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
    if (srgb) return srgb[1].toUpperCase();
    const scheme = inner.match(/<a:schemeClr\s+val="([^"]+)"/);
    if (scheme) return tgtColors[resolveSchemeSlot(scheme[1])] || null;
  }

  return null;
}

/**
 * Inject a solidFill color into a text run's rPr element.
 * Handles: self-closing rPr, rPr with children (no fill), no rPr at all.
 */
function injectTextColor(runXml, hex) {
  const fill = `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;

  // Has <a:rPr ... /> (self-closing)
  if (/<a:rPr\b[^>]*\/>/.test(runXml)) {
    return runXml.replace(
      /<a:rPr\b([^>]*)\/>/,
      `<a:rPr$1>${fill}</a:rPr>`
    );
  }

  // Has <a:rPr ...>...</a:rPr> with existing solidFill → replace it
  if (/<a:rPr\b[^>]*>[\s\S]*?<a:solidFill>/.test(runXml)) {
    return runXml.replace(
      /(<a:rPr\b[^>]*>[\s\S]*?)<a:solidFill>[\s\S]*?<\/a:solidFill>/,
      `$1${fill}`
    );
  }

  // Has <a:rPr ...>...</a:rPr> without solidFill → inject after opening tag
  if (/<a:rPr\b[^>]*>/.test(runXml)) {
    return runXml.replace(
      /(<a:rPr\b[^>]*>)/,
      `$1${fill}`
    );
  }

  // No <a:rPr> at all → inject one before <a:t>
  return runXml.replace(
    /<a:t>/,
    `<a:rPr lang="en-US" dirty="0">${fill}</a:rPr><a:t>`
  );
}

/**
 * For all shapes with text, check text-on-fill contrast.
 * When a shape has no explicit fill, we fall back to the slide background
 * color (from <p:bg>). If neither is available, we assume a light background
 * (common default in most templates).
 *
 * Two-pass approach:
 *  Pass 1: Match every <a:solidFill>...</a:solidFill> block inside <p:txBody>.
 *          Extract the srgbClr or schemeClr, check contrast against shape fill.
 *          Replaces entire block if contrast is poor.
 *  Pass 2: Fix text runs with NO explicit color (inherited from layout/master).
 */
function enforceTextContrast(slideXml, tgtColors, layoutBgHex = null) {
  if (!tgtColors.dk1 || !tgtColors.lt1) return slideXml;

  const darkColor = tgtColors.dk1;
  const lightColor = tgtColors.lt1;

  // Detect slide background color for fallback
  let slideBgHex = null;
  const bgMatch = slideXml.match(/<p:bg\b[\s\S]*?<\/p:bg>/);
  if (bgMatch) {
    slideBgHex = detectShapeFill(bgMatch[0].replace(/<p:bg\b/, '<p:spPr').replace(/<\/p:bg>/, '</p:spPr>'), tgtColors);
    if (!slideBgHex) {
      // Try direct extraction from bg element
      const bgSrgb = bgMatch[0].match(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
      if (bgSrgb) slideBgHex = bgSrgb[1].toUpperCase();
      else {
        const bgScheme = bgMatch[0].match(/<a:schemeClr\s+val="([^"]+)"/);
        if (bgScheme) slideBgHex = tgtColors[resolveSchemeSlot(bgScheme[1])] || null;
      }
    }
  }

  return slideXml.replace(
    /<p:sp\b[\s\S]*?<\/p:sp>/g,
    (spXml) => {
      const rawFill = detectShapeFill(spXml, tgtColors);
      const isTransparent = rawFill === null;
      let fillHex = rawFill;
      // No explicit fill → walk up: slide background → layout background → assume light
      let fillSource = 'shape';
      if (!fillHex) {
        if (slideBgHex) { fillHex = slideBgHex; fillSource = 'slide-bg'; }
        else if (layoutBgHex) { fillHex = layoutBgHex; fillSource = 'layout-bg'; }
        else { fillHex = lightColor; fillSource = 'default-lt1'; }
      }

      const crDark = contrastRatio(fillHex, darkColor);
      const crLight = contrastRatio(fillHex, lightColor);
      const goodColor = crDark >= crLight ? darkColor : lightColor;

      // Shape name for logging
      const nameMatch = spXml.match(/<p:cNvPr[^>]*name="([^"]+)"/);
      const shapeName = nameMatch ? nameMatch[1] : '(unnamed)';

      // Find txBody boundaries — only fix colors inside the text body
      const txStart = spXml.indexOf('<p:txBody');
      if (txStart === -1) return spXml;
      const before = spXml.slice(0, txStart);
      let txBody = spXml.slice(txStart);

      // Pass 1: Match every <a:solidFill>...</a:solidFill> in the text body.
      //         Simple regex that matches the whole block regardless of children.
      txBody = txBody.replace(
        /<a:solidFill>[\s\S]*?<\/a:solidFill>/g,
        (fillBlock) => {
          // Check srgbClr
          const srgbMatch = fillBlock.match(/<a:srgbClr[^>]*\bval="([A-Fa-f0-9]{6})"/);
          if (srgbMatch) {
            const hex = srgbMatch[1].toUpperCase();
            const cr = contrastRatio(fillHex, hex);
            if (cr < 3.5) {
              console.log(`[Contrast] Pass1 fix: "${shapeName}" text #${hex} on ${isTransparent ? 'TRANSPARENT' : ''} bg #${fillHex} (${fillSource}) ratio=${cr.toFixed(1)} → #${goodColor}`);
              return `<a:solidFill><a:srgbClr val="${goodColor}"/></a:solidFill>`;
            }
            return fillBlock;
          }
          // Check schemeClr (resolve aliases: bg1→lt1, tx1→dk1, etc.)
          const schemeMatch = fillBlock.match(/<a:schemeClr\b[^>]*\bval="([^"]+)"/);
          if (schemeMatch) {
            const textHex = tgtColors[resolveSchemeSlot(schemeMatch[1])];
            if (textHex) {
              const cr = contrastRatio(fillHex, textHex);
              if (cr < 3.5) {
                console.log(`[Contrast] Pass1 fix: "${shapeName}" scheme:${schemeMatch[1]}(#${textHex}) on ${isTransparent ? 'TRANSPARENT' : ''} bg #${fillHex} (${fillSource}) ratio=${cr.toFixed(1)} → #${goodColor}`);
                return `<a:solidFill><a:srgbClr val="${goodColor}"/></a:solidFill>`;
              }
            }
          }
          return fillBlock;
        }
      );

      // Pass 2: Fix runs with NO explicit text color (inherited from layout/master).
      // After template swap, inherited text color may not match the effective
      // background. Inject explicit color on light or very dark fills
      // where a mismatch would make text invisible.
      const fillLum = relativeLuminance(fillHex);
      txBody = txBody.replace(/<a:r\b[^>]*>[\s\S]*?<\/a:r>/g, (runXml) => {
        if (/<a:solidFill>/.test(runXml)) return runXml;
        // On light fills: inherited text might be light → force dark
        // On dark fills: inherited text might be dark → force light
        if (fillLum > 0.65 || fillLum < 0.15) {
          console.log(`[Contrast] Pass2 fix: "${shapeName}" inherited text on ${isTransparent ? 'TRANSPARENT' : ''} bg #${fillHex} (${fillSource}, lum=${fillLum.toFixed(2)}) → #${goodColor}`);
          return injectTextColor(runXml, goodColor);
        }
        return runXml;
      });

      return before + txBody;
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT SCANNING
// ═══════════════════════════════════════════════════════════════════════════

const LAYOUT_TYPE_MAP = {
  'title': 'title', 'ctrTitle': 'title',
  'obj': 'content', 'tx': 'content',
  'twoObj': 'twoContent', 'secHead': 'sectionHeader',
  'blank': 'blank', 'titleOnly': 'titleOnly',
};

function parsePlaceholders(xml) {
  const placeholders = [];
  const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  let m;
  while ((m = spRegex.exec(xml)) !== null) {
    if (!/<p:ph\b/.test(m[0])) continue;
    const phTypeMatch = m[0].match(/<p:ph[^>]*type="([^"]+)"/);
    const phIdxMatch = m[0].match(/<p:ph[^>]*idx="(\d+)"/);
    placeholders.push({
      phType: phTypeMatch ? phTypeMatch[1] : 'body',
      phIdx: phIdxMatch ? parseInt(phIdxMatch[1]) : null,
      shapeXml: m[0],
    });
  }
  return placeholders;
}

async function scanLayouts(zip) {
  const byIndex = {};
  const byType = {};

  const files = Object.keys(zip.files)
    .filter(f => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/(\d+)/g).pop()) - parseInt(b.match(/(\d+)/g).pop()));

  for (const path of files) {
    const idx = parseInt(path.match(/slideLayout(\d+)/)[1]);
    const xml = await zip.files[path].async('string');

    let type = null;
    const typeMatch = xml.match(/<p:sldLayout[^>]*type="([^"]+)"/);
    if (typeMatch) type = LAYOUT_TYPE_MAP[typeMatch[1]] || null;

    if (!type) {
      const nameMatch = xml.match(/<p:cSld\s+name="([^"]+)"/);
      if (nameMatch) {
        const n = nameMatch[1].toLowerCase();
        if (n.includes('title slide') || n.includes('cover')) type = 'title';
        else if (n.includes('section')) type = 'sectionHeader';
        else if (n.includes('blank')) type = 'blank';
        else if (n.includes('two')) type = 'twoContent';
        else if (n.includes('title only')) type = 'titleOnly';
        else if (n.includes('content') || n.includes('title and')) type = 'content';
      }
    }
    type = type || 'content';

    const placeholders = parsePlaceholders(xml);
    // Store layout background XML for contrast enforcement
    const bgMatch = xml.match(/<p:bg\b[\s\S]*?<\/p:bg>/);
    const entry = { index: idx, type, placeholders, bgXml: bgMatch ? bgMatch[0] : null };
    byIndex[idx] = entry;
    if (!byType[type]) byType[type] = entry;
  }

  if (!byType.content) {
    const fallbackIdx = files.length >= 2 ? 2 : 1;
    if (byIndex[fallbackIdx]) byType.content = byIndex[fallbackIdx];
  }

  return { byIndex, byType };
}

function getLayoutIndexFromRels(relsXml) {
  const m = relsXml.match(/Target="[^"]*?slideLayout(\d+)\.xml"/);
  return m ? parseInt(m[1]) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// GPT UNIFIED INSPECTION — STRUCTURE + COLOR ANALYSIS (SINGLE PASS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified extraction: scans source slides for BOTH structure (shape roles,
 * positions, text) AND color usage (fills, text colors, borders, contrast
 * pairs). Also scans target layouts including their placeholder colors.
 *
 * Returns a single human-readable report for GPT plus structured data.
 *
 * @param {JSZip} srcZip - source PPTX zip
 * @param {JSZip} tgtZip - target PPTX zip (unused here, layouts passed separately)
 * @param {object} srcColors - parsed source theme slot→hex
 * @param {object} tgtColors - parsed target theme slot→hex
 * @param {object} tgtLayouts - from scanLayouts(tgtZip)
 * @param {number} maxSlides - how many slides to inspect
 * @returns {{ text: string, contrastPairs: Array, shapePatterns: Map }}
 */
async function extractUnifiedContext(srcZip, srcColors, tgtColors, tgtLayouts, maxSlides = 30) {
  const slideFiles = Object.keys(srcZip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1]) - parseInt(b.match(/slide(\d+)/)[1]))
    .slice(0, maxSlides);

  const slideCount = slideFiles.length;

  // ── Aggregation structures ──
  const shapePatterns = new Map();        // patternKey → { phType, zone, colors, ... }
  const contrastPairs = new Map();        // "textHex|bgHex" → { textHex, bgHex, contexts }
  const slideBgCounts = new Map();        // hex → count
  const borderColorCounts = new Map();    // hex → count
  const decorFillCounts = new Map();      // hex → count
  const colorUsage = new Map();           // hex → { roles: Set, count }

  function trackColor(hex, role) {
    if (!colorUsage.has(hex)) colorUsage.set(hex, { roles: new Set(), count: 0 });
    const entry = colorUsage.get(hex);
    entry.roles.add(role);
    entry.count++;
  }

  for (const path of slideFiles) {
    const xml = await srcZip.files[path].async('string');

    // ── Slide background color ──
    let slideBgHex = null;
    const bgMatch = xml.match(/<p:bg\b[\s\S]*?<\/p:bg>/);
    if (bgMatch) {
      const bgHexes = extractFillHex(bgMatch[0], srcColors);
      if (bgHexes.length > 0) {
        slideBgHex = bgHexes[0];
        slideBgCounts.set(slideBgHex, (slideBgCounts.get(slideBgHex) || 0) + 1);
        trackColor(slideBgHex, 'slide background');
      }
    }

    // ── Scan each shape ──
    const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
    let m;
    while ((m = spRegex.exec(xml)) !== null) {
      const shapeXml = m[0];

      // Position and size
      const offMatch = shapeXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
      const extMatch = shapeXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
      if (!offMatch || !extMatch) continue;

      const x = parseInt(offMatch[1]);
      const y = parseInt(offMatch[2]);
      const w = parseInt(extMatch[1]);
      const h = parseInt(extMatch[2]);
      const xIn = (x / 914400).toFixed(1);
      const yIn = (y / 914400).toFixed(1);
      const wIn = (w / 914400).toFixed(1);
      const hIn = (h / 914400).toFixed(1);

      // Placeholder type
      const phMatch = shapeXml.match(/<p:ph[^>]*type="([^"]+)"/);
      const phType = phMatch ? phMatch[1] : null;
      const normType = phType ? normalizePlaceholderType(phType) : null;

      // Shape name
      const nameMatch = shapeXml.match(/<p:cNvPr[^>]*name="([^"]+)"/);
      const shapeName = nameMatch ? nameMatch[1] : 'unnamed';

      // Extract text
      const allText = [];
      const textRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
      let tm;
      while ((tm = textRegex.exec(shapeXml)) !== null) {
        allText.push(tm[1]);
      }
      const textSnippet = allText.join(' ').trim().slice(0, 80);
      if (!textSnippet && !phType) continue;

      // Font size, alignment, bold
      const szMatch = shapeXml.match(/<a:rPr[^>]*\bsz="(\d+)"/);
      const fontSizePt = szMatch ? (parseInt(szMatch[1]) / 100).toFixed(0) : null;
      const algnMatch = shapeXml.match(/<a:pPr[^>]*\balgn="([^"]+)"/);
      const alignment = algnMatch ? algnMatch[1] : null;
      const isBold = /\bb="1"/.test(shapeXml);

      // Zone classification
      const hZone = x < 1500000 ? 'left' : x > 6000000 ? 'right' : 'center';
      const vZone = y < 2000000 ? 'top' : y > 5000000 ? 'bottom' : 'middle';
      const zone = `${vZone}-${hZone}`;
      const patternKey = phType ? `ph:${phType}` : `${zone}|${fontSizePt || '?'}pt|${shapeName.replace(/\d+/g, 'N')}`;

      // ── Shape fill colors ──
      let shapeFillHex = null;
      const spPrMatch = shapeXml.match(/<p:spPr\b[\s\S]*?<\/p:spPr>/);
      const shapeFillHexes = [];
      const shapeLineHexes = [];
      if (spPrMatch) {
        const spPr = spPrMatch[0];
        const spPrNoLine = spPr.replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, '');
        const fillHexes = extractFillHex(spPrNoLine, srcColors);
        for (const fHex of fillHexes) {
          shapeFillHexes.push(fHex);
          shapeFillHex = fHex;
          decorFillCounts.set(fHex, (decorFillCounts.get(fHex) || 0) + 1);
          trackColor(fHex, normType ? `${normType} fill` : 'shape fill');
        }
        // Line / border colors
        const lnMatch = spPr.match(/<a:ln\b[\s\S]*?<\/a:ln>/);
        if (lnMatch) {
          for (const cm of lnMatch[0].matchAll(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/gi)) {
            const lHex = cm[1].toUpperCase();
            shapeLineHexes.push(lHex);
            borderColorCounts.set(lHex, (borderColorCounts.get(lHex) || 0) + 1);
            trackColor(lHex, 'border');
          }
        }
      }

      // ── Text colors ──
      const shapeTextHexes = [];
      const txBodyMatch = shapeXml.match(/<p:txBody\b[\s\S]*?<\/p:txBody>/);
      if (txBodyMatch) {
        const txBody = txBodyMatch[0];
        for (const rm of txBody.matchAll(/<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/gi)) {
          const textHexes = extractFillHex(rm[0], srcColors);
          for (const tHex of textHexes) {
            shapeTextHexes.push(tHex);
            const bgHex = shapeFillHex || slideBgHex;
            trackColor(tHex, normType ? `${normType} text` : 'text');
            if (bgHex) {
              const cpKey = `${tHex}|${bgHex}`;
              if (!contrastPairs.has(cpKey)) {
                contrastPairs.set(cpKey, { textHex: tHex, bgHex, contexts: new Set() });
              }
              contrastPairs.get(cpKey).contexts.add(normType || 'shape');
            }
          }
        }
      }

      // ── Aggregate into shape pattern ──
      if (!shapePatterns.has(patternKey)) {
        shapePatterns.set(patternKey, {
          phType,
          normType,
          shapeName: shapeName.replace(/\d+/g, 'N'),
          count: 0,
          positions: [],
          textSamples: [],
          fontSizePt,
          alignment,
          isBold,
          zone,
          fillColors: new Set(),
          textColors: new Set(),
          lineColors: new Set(),
        });
      }
      const pattern = shapePatterns.get(patternKey);
      pattern.count++;
      if (pattern.positions.length < 3) {
        pattern.positions.push(`(${xIn}", ${yIn}") ${wIn}"×${hIn}"`);
      }
      if (textSnippet && pattern.textSamples.length < 3) {
        pattern.textSamples.push(textSnippet);
      }
      for (const c of shapeFillHexes) pattern.fillColors.add(c);
      for (const c of shapeTextHexes) pattern.textColors.add(c);
      for (const c of shapeLineHexes) pattern.lineColors.add(c);
    }
  }

  // ═══ Build human-readable report ═══
  const lines = [];
  lines.push(`SOURCE DECK (${slideCount} slides analyzed):`);
  lines.push('');

  // Shape patterns sorted by frequency
  const sorted = [...shapePatterns.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [key, p] of sorted) {
    const roleLabel = p.normType || 'non-placeholder';
    const phNote = p.phType ? `placeholder: ${p.phType}` : 'non-placeholder';
    const freq = `${p.count}/${slideCount} slides`;
    lines.push(`  Role: ${roleLabel} (${phNote}, ${freq})`);
    lines.push(`    Pattern key: ${key}`);
    lines.push(`    Zone: ${p.zone}, positions: ${p.positions.join(' | ')}`);
    const fmtParts = [
      p.fontSizePt ? `${p.fontSizePt}pt` : null,
      p.isBold ? 'bold' : null,
      p.alignment ? `align:${p.alignment}` : null,
    ].filter(Boolean).join(', ');
    if (fmtParts) lines.push(`    Format: ${fmtParts}`);
    if (p.fillColors.size > 0) lines.push(`    Fill colors: ${[...p.fillColors].map(c => `#${c}`).join(', ')}`);
    if (p.textColors.size > 0) lines.push(`    Text colors: ${[...p.textColors].map(c => `#${c}`).join(', ')}`);
    if (p.lineColors.size > 0) lines.push(`    Border colors: ${[...p.lineColors].map(c => `#${c}`).join(', ')}`);
    if (p.textSamples.length > 0) {
      lines.push(`    Samples: ${p.textSamples.map(t => `"${t}"`).join(', ')}`);
    }
    lines.push('');
  }

  // Slide backgrounds
  if (slideBgCounts.size > 0) {
    lines.push(`  Slide backgrounds: ${[...slideBgCounts.entries()].map(([h, c]) => `#${h} (${c} slides)`).join(', ')}`);
  }
  // Border colors
  if (borderColorCounts.size > 0) {
    lines.push(`  Shape borders: ${[...borderColorCounts.entries()].map(([h, c]) => `#${h} (${c} occurrences)`).join(', ')}`);
  }
  // Decorative fills
  if (decorFillCounts.size > 0) {
    lines.push(`  Shape fills: ${[...decorFillCounts.entries()].map(([h, c]) => `#${h} (${c} shapes)`).join(', ')}`);
  }

  // All source colors summary
  lines.push('');
  lines.push('ALL SOURCE COLORS (deduplicated):');
  for (const [hex, info] of [...colorUsage.entries()].sort((a, b) => b[1].count - a[1].count)) {
    lines.push(`  #${hex} - ${[...info.roles].join(', ')} (${info.count} occurrences)`);
  }

  // Contrast pairs
  if (contrastPairs.size > 0) {
    lines.push('');
    lines.push('CONTRAST PAIRS (text on background):');
    for (const [, pair] of contrastPairs) {
      const ratio = contrastRatio(pair.textHex, pair.bgHex);
      const status = ratio >= 4.5 ? 'OK' : ratio >= 3.0 ? 'marginal' : 'POOR';
      lines.push(`  #${pair.textHex} on #${pair.bgHex} → ratio ${ratio.toFixed(1)}:1 (${status}) [${[...pair.contexts].join(', ')}]`);
    }
  }

  // ═══ Target template section ═══
  lines.push('');
  lines.push('TARGET TEMPLATE:');

  for (const [idx, layout] of Object.entries(tgtLayouts.byIndex)) {
    lines.push(`\n  Layout ${idx} (type: ${layout.type}):`);
    for (const ph of layout.placeholders) {
      const normPh = normalizePlaceholderType(ph.phType);
      const offMatch = ph.shapeXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
      const extMatch = ph.shapeXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
      const pos = offMatch
        ? `(${(parseInt(offMatch[1]) / 914400).toFixed(1)}", ${(parseInt(offMatch[2]) / 914400).toFixed(1)}")`
        : '(?)';
      const size = extMatch
        ? `${(parseInt(extMatch[1]) / 914400).toFixed(1)}"×${(parseInt(extMatch[2]) / 914400).toFixed(1)}"`
        : '?';
      const algnPh = ph.shapeXml.match(/<a:pPr[^>]*\balgn="([^"]+)"/);
      const algn = algnPh ? ` align:${algnPh[1]}` : '';

      // Extract colors from target placeholder
      const phFills = extractFillHex(ph.shapeXml.replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, '').replace(/<p:txBody\b[\s\S]*?<\/p:txBody>/g, ''), tgtColors);
      const phTextColors = [];
      const phTxBody = ph.shapeXml.match(/<p:txBody\b[\s\S]*?<\/p:txBody>/);
      if (phTxBody) {
        for (const rm of phTxBody[0].matchAll(/<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/gi)) {
          phTextColors.push(...extractFillHex(rm[0], tgtColors));
        }
        // Also check defRPr for default text color
        for (const rm of phTxBody[0].matchAll(/<a:defRPr\b[^>]*>[\s\S]*?<\/a:defRPr>/gi)) {
          phTextColors.push(...extractFillHex(rm[0], tgtColors));
        }
      }
      const fillNote = phFills.length > 0 ? `Fill: #${[...new Set(phFills)].join(', #')}` : 'Fill: none';
      const textNote = phTextColors.length > 0 ? `Text: #${[...new Set(phTextColors)].join(', #')}` : 'Text: inherited';

      lines.push(`    - ${normPh} (raw: ${ph.phType}, idx: ${ph.phIdx}) at ${pos} ${size}${algn}`);
      lines.push(`      ${fillNote}, ${textNote}`);
    }
  }

  // Source theme slots
  lines.push('');
  lines.push('SOURCE THEME SLOTS:');
  for (const [slot, hex] of Object.entries(srcColors)) {
    if (hex) lines.push(`  ${slot}: #${hex}`);
  }
  lines.push('');
  lines.push('TARGET THEME SLOTS:');
  for (const [slot, hex] of Object.entries(tgtColors)) {
    if (hex) lines.push(`  ${slot}: #${hex}`);
  }

  const pairsArray = [...contrastPairs.values()].map(p => ({ textHex: p.textHex, bgHex: p.bgHex }));
  return { text: lines.join('\n'), contrastPairs: pairsArray, shapePatterns };
}

/**
 * Single GPT call that produces BOTH the color map AND structure role map.
 * Replaces the old analyzeColorUsageWithAI + analyzeSlideStructureWithAI.
 *
 * @returns {{ colorMap: object, shapeRoles: object, roleMap: object, reasoning: string }} or null
 */
async function analyzeAndMapWithAI(unifiedContext, srcColors, tgtColors, callAI) {
  if (!unifiedContext || !callAI) return null;

  const systemPrompt = `You are a PowerPoint template transform expert. You will see a detailed analysis of a source presentation's structure and colors, plus the target template's structure and colors.

Your job:
1. UNDERSTAND the source deck's color language: which colors serve which roles (backgrounds, title text, body text, accent fills, borders, footer text, etc.)
2. UNDERSTAND the target template's color language the same way.
3. BUILD a color mapping that preserves each color's SEMANTIC ROLE:
   - Source title color → Target title color
   - Source background → Target background
   - Source accent → Target accent
   - Source body text → Target body text
   - etc.
4. IDENTIFY shape roles for non-placeholder shapes (page numbers, source citations, etc.) and map them to the correct target placeholders.

COLOR MAPPING RULES:
- EVERY source color MUST map to EXACTLY ONE target color. 1-to-1 strict.
- NO two source colors may share the same target.
- CONTRAST: If source has light text on dark bg, mapped text must stay light on dark bg. Maintain ≥4.5:1 contrast ratio for text on backgrounds.
- Dark slots (dk1/dk2) → dark targets (luminance < 0.2). Light slots (lt1/lt2) → light targets (luminance > 0.8).
- Map by ROLE first, proximity second. If source title is blue and target title is green, map blue→green even though they're far in color space.
- Be EXHAUSTIVE: map every source color you see in the analysis. Don't skip any.

POSITION RULES:
- Title and subtitle placeholders are generally in the SAME position across templates. Do NOT try to find a replacement or "closest" placeholder for them. They should be matched by type, and they will be in roughly the same place with some error margin.

STRUCTURE RULES:
- roleMap: ONLY include overrides when a source placeholder's XML type genuinely mismatches its semantic role. Leave roleMap EMPTY ({}) in most cases. NEVER remap "body" → "subtitle" or "subtitle" → "ftr".
- shapeRoles: For NON-PLACEHOLDER shapes only. Map them to footer-tier targets (ftr, sldNum, dt) or body. NEVER map a non-placeholder to "title" or "subTitle" — those are reserved for real placeholders.
- HOW TO TELL SUBTITLE FROM SOURCE CITATION:
  * SUBTITLE: positioned directly below the title (Y ≈ 1.2"–2.0"), font ≥ 12pt, bold, short descriptive phrase, no "Source:" prefix
  * SOURCE CITATION: positioned at the very bottom (Y > 6"), font ≤ 10pt, often starts with "Source:", "Note:", "Quelle:"
  * If in doubt, leave it unmapped — the code has heuristics to detect these.
- Page numbers: small digits or "‹#›" in bottom-right → map to "sldNum".
- Do NOT remap existing placeholder types. A "subTitle" placeholder stays "subtitle". A "body" stays "body".
- Keep shapeRoles minimal. Only include shapes with a clear, unambiguous role. Skip decorative shapes and anything ambiguous.

Return ONLY valid JSON:
{
  "colorMap": { "SRCHEX": "TGTHEX", ... },
  "shapeRoles": { "patternKey": "targetPhType", ... },
  "roleMap": { "sourceNormalizedType": "targetPhType", ... },
  "reasoning": "brief explanation of mapping logic"
}
Hex values are 6-digit uppercase WITHOUT # prefix.`;

  const userPrompt = `${unifiedContext}

Analyze both the colors and structure above. Return the unified mapping JSON.
Remember: EVERY target hex must be unique (1-to-1). Map by ROLE first, proximity second.`;

  try {
    const response = await callAI(systemPrompt, userPrompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[UnifiedAI] Could not parse JSON:', response.slice(0, 200));
      return null;
    }
    const result = JSON.parse(jsonMatch[0]);
    // Normalize hex values in colorMap
    if (result.colorMap) {
      const normalized = {};
      for (const [src, tgt] of Object.entries(result.colorMap)) {
        const srcHex = src.replace('#', '').toUpperCase();
        const tgtHex = tgt.replace('#', '').toUpperCase();
        if (/^[A-F0-9]{6}$/.test(srcHex) && /^[A-F0-9]{6}$/.test(tgtHex)) {
          normalized[srcHex] = tgtHex;
        }
      }
      result.colorMap = normalized;
    }
    console.log('[UnifiedAI] Color mappings:', Object.keys(result.colorMap || {}).length);
    console.log('[UnifiedAI] Role map:', JSON.stringify(result.roleMap || {}));
    console.log('[UnifiedAI] Shape roles:', Object.keys(result.shapeRoles || {}).length, 'patterns identified');
    if (result.reasoning) console.log('[UnifiedAI] Reasoning:', result.reasoning.slice(0, 200));
    return result;
  } catch (err) {
    console.error('[UnifiedAI] Failed:', err);
    return null;
  }
}

/**
 * Pick the target layout that best matches a source slide's placeholders.
 * Scores each target layout by:
 *   +10  layout type match (title→title, content→content, etc.)
 *   +3   per placeholder type that exists in both source slide and target layout
 *   -1   per extra target placeholder not in source (avoids empty placeholders)
 */
function findBestTargetLayout(srcSlideXml, srcLayoutType, tgtLayouts) {
  const srcPhs = parsePlaceholders(srcSlideXml);
  const srcPhTypes = new Set(srcPhs.map(p => normalizePlaceholderType(p.phType)));

  let bestLayout = null;
  let bestScore = -Infinity;

  for (const layout of Object.values(tgtLayouts.byIndex)) {
    let score = 0;
    if (layout.type === srcLayoutType) score += 10;

    const tgtPhTypes = new Set(layout.placeholders.map(p => normalizePlaceholderType(p.phType)));
    for (const t of srcPhTypes) {
      if (tgtPhTypes.has(t)) score += 3;
    }
    for (const t of tgtPhTypes) {
      if (!srcPhTypes.has(t)) score -= 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestLayout = layout;
    }
  }

  return bestLayout || tgtLayouts.byType['content'] || Object.values(tgtLayouts.byIndex)[0];
}

// ═══════════════════════════════════════════════════════════════════════════
// RELS PARSER (attribute-order-independent)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a .rels XML into a map: rId → { type, target, targetMode }.
 * Handles ANY attribute order (Id, Type, Target can appear in any sequence).
 */
function parseRels(relsXml) {
  const map = {};
  const relRegex = /<Relationship\s+([^>]+)\/>/g;
  let m;
  while ((m = relRegex.exec(relsXml)) !== null) {
    const attrs = m[1];
    const id = attrs.match(/Id="([^"]+)"/);
    const type = attrs.match(/Type="([^"]+)"/);
    const target = attrs.match(/Target="([^"]+)"/);
    const targetMode = attrs.match(/TargetMode="([^"]+)"/);
    if (id && type && target) {
      map[id[1]] = {
        type: type[1],
        target: target[1],
        targetMode: targetMode ? targetMode[1] : null,
      };
    }
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Helper: extract hex from a solidFill element (srgbClr or schemeClr) */
function extractFillHex(xmlFragment, themeColors) {
  const results = [];
  for (const cm of xmlFragment.matchAll(/<a:solidFill>[\s\S]*?<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/gi)) {
    results.push(cm[1].toUpperCase());
  }
  if (themeColors) {
    for (const cm of xmlFragment.matchAll(/<a:solidFill>[\s\S]*?<a:schemeClr\s+val="([^"]+)"/gi)) {
      const resolved = themeColors[resolveSchemeSlot(cm[1])];
      if (resolved) results.push(resolved.toUpperCase());
    }
  }
  return results;
}

/**
 * Validate and fix a color map to enforce 1-to-1 mapping (no two source
 * colors mapping to the same target) and minimum contrast ratios.
 *
 * @param {object} colorMap - { srcHex: tgtHex }
 * @param {object} tgtColors - target theme slot→hex (available target palette)
 * @param {Array|null} contrastPairs - [{ textHex, bgHex }] from source (text-on-bg pairs)
 * @returns {object} validated { srcHex: tgtHex }
 */
function validateColorMap(colorMap, tgtColors, contrastPairs = null) {
  const result = { ...colorMap };

  // ── 1. Enforce 1-to-1: detect duplicate target values ──
  const tgtToSources = new Map(); // tgtHex → [srcHex, ...]
  for (const [src, tgt] of Object.entries(result)) {
    if (!tgtToSources.has(tgt)) tgtToSources.set(tgt, []);
    tgtToSources.get(tgt).push(src);
  }

  const usedTargets = new Set(Object.values(result));
  // Build a pool of available target colors (from theme) not yet used
  const allTgtHexes = Object.values(tgtColors).filter(Boolean).map(h => h.toUpperCase());

  for (const [tgt, sources] of tgtToSources) {
    if (sources.length <= 1) continue;
    // Multiple sources map to same target — keep the first, reassign the rest
    console.warn(`[ColorMap Validate] Duplicate: ${sources.length} sources → #${tgt}. Reassigning extras.`);
    for (let i = 1; i < sources.length; i++) {
      const srcHex = sources[i];
      // Find the best unused target color (closest in OKLab to the source)
      let bestTgt = null;
      let bestDist = Infinity;
      for (const candidate of allTgtHexes) {
        if (usedTargets.has(candidate)) continue;
        const dist = oklabDistance(srcHex, candidate);
        if (dist < bestDist) {
          bestDist = dist;
          bestTgt = candidate;
        }
      }
      if (bestTgt) {
        result[srcHex] = bestTgt;
        usedTargets.add(bestTgt);
        console.log(`[ColorMap Validate] Reassigned #${srcHex}: #${tgt} → #${bestTgt}`);
      }
    }
  }

  // ── 2. Contrast check: ensure text colors contrast against their backgrounds ──
  if (contrastPairs && contrastPairs.length > 0) {
    for (const { textHex, bgHex } of contrastPairs) {
      const mappedText = result[textHex];
      const mappedBg = result[bgHex];
      if (!mappedText || !mappedBg) continue;
      const ratio = contrastRatio(mappedText, mappedBg);
      if (ratio < 3.0) {
        // Flip: if the mapped text is too similar to mapped bg, try swapping
        // text to a high-contrast alternative (lightest or darkest in target palette)
        const textLum = relativeLuminance(mappedText);
        const bgLum = relativeLuminance(mappedBg);
        // If bg is dark, text should be light; if bg is light, text should be dark
        const needLight = bgLum < 0.2;
        let bestAlt = null;
        let bestRatio = ratio;
        for (const candidate of allTgtHexes) {
          if (usedTargets.has(candidate) && candidate !== mappedText) continue;
          const candLum = relativeLuminance(candidate);
          if (needLight && candLum < 0.5) continue;
          if (!needLight && candLum > 0.5) continue;
          const cr = contrastRatio(candidate, mappedBg);
          if (cr > bestRatio) {
            bestRatio = cr;
            bestAlt = candidate;
          }
        }
        if (bestAlt && bestRatio >= 3.5) {
          console.warn(`[ColorMap Validate] Contrast fix: text #${textHex} mapped #${mappedText} on #${mappedBg} (ratio ${ratio.toFixed(1)}) → #${bestAlt} (ratio ${bestRatio.toFixed(1)})`);
          result[textHex] = bestAlt;
          usedTargets.add(bestAlt);
        }
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// GPT-ASSISTED COLOR MAPPING REFINEMENT (user guidance only)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Refine a color map using an LLM when the user provides explicit guidance.
 * Only called when colorGuidance is non-empty. The primary AI-driven mapping
 * is handled by analyzeAndMapWithAI; this function applies user overrides on top.
 *
 * @param {object} currentMap     - { srcHex: tgtHex } current map (AI + proximity)
 * @param {object} srcColors      - theme slot → hex
 * @param {object} tgtColors      - theme slot → hex
 * @param {string} guidance       - free-text user instructions
 * @param {function} callAI       - async (systemPrompt, userPrompt) => string
 * @param {string|null} unifiedContext - the unified context report (for richer AI context)
 * @param {Array|null} contrastPairs - [{ textHex, bgHex }]
 * @returns {object} refined { srcHex: tgtHex } map
 */
export async function refineColorMapWithAI(currentMap, srcColors, tgtColors, guidance, callAI, unifiedContext = null, contrastPairs = null) {
  if (!guidance || !guidance.trim() || !callAI) return currentMap;

  const srcSlots = Object.entries(srcColors)
    .filter(([, v]) => v)
    .map(([slot, hex]) => `  ${slot}: #${hex}`)
    .join('\n');
  const tgtSlots = Object.entries(tgtColors)
    .filter(([, v]) => v)
    .map(([slot, hex]) => `  ${slot}: #${hex}`)
    .join('\n');
  const mapEntries = Object.entries(currentMap)
    .map(([s, t]) => `  #${s} → #${t}`)
    .join('\n');

  const systemPrompt = `You are a color mapping assistant for PowerPoint template transforms.
You will receive source and target color palettes plus a current color mapping (AI-driven + proximity fallback).
The user provides guidance to adjust the mapping (e.g., "keep blues warm", "subtitle should be burgundy").

CRITICAL RULES — STRICTLY ENFORCED:
1. UNIQUE TARGETS: Each source color MUST map to a DIFFERENT target color. NO two source colors may share the same target hex. This is a STRICT 1-to-1 constraint. Before returning, verify every value in your map is unique.
2. CONTRAST: Text colors must remain readable against their backgrounds. If a source has light text on a dark fill, the mapped text MUST also be light on a dark fill. Maintain at least 4.5:1 contrast ratio. Dark slots (dk1/dk2) stay dark, light slots (lt1/lt2) stay light.
3. Honor the user's guidance about contrast, warmth, tone, or specific color assignments.
4. Check your answer: scan all values — if any target hex appears more than once, reassign one of them to a different available target color.

Return ONLY a valid JSON object mapping source hex to target hex, like: {"4472C4":"8B1A1A","FFFFFF":"F5F5F5"}
Keys and values are 6-digit uppercase hex WITHOUT the # prefix. Do not include explanations.
You may add, remove, or change entries. Omitted source colors will keep the current mapping.`;

  const contextSection = unifiedContext
    ? `\nCOLOR & STRUCTURE ANALYSIS:\n${unifiedContext}\n`
    : '';

  const userPrompt = `SOURCE THEME COLORS:
${srcSlots}

TARGET THEME COLORS:
${tgtSlots}

CURRENT COLOR MAPPING:
${mapEntries}
${contextSection}
USER GUIDANCE:
${guidance}

Return the adjusted color mapping as a JSON object. Only include entries you want to change or confirm.`;

  try {
    const response = await callAI(systemPrompt, userPrompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[ColorMap Guidance] Could not parse JSON from response:', response);
      return currentMap;
    }
    const overrides = JSON.parse(jsonMatch[0]);
    const refined = { ...currentMap };
    for (const [src, tgt] of Object.entries(overrides)) {
      const srcHex = src.replace('#', '').toUpperCase();
      const tgtHex = tgt.replace('#', '').toUpperCase();
      if (/^[A-F0-9]{6}$/.test(srcHex) && /^[A-F0-9]{6}$/.test(tgtHex)) {
        refined[srcHex] = tgtHex;
      }
    }
    console.log('[ColorMap Guidance] Overrides applied:', Object.keys(overrides).length);
    return validateColorMap(refined, tgtColors, contrastPairs);
  } catch (err) {
    console.error('[ColorMap Guidance] Failed, keeping current map:', err);
    return currentMap;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE SLIDE PROCESSING (surgical approach)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract text paragraphs from a shape XML.
 * Returns array of [{ text, bold, italic, fontSize, color }] per paragraph.
 * fontSize is in OOXML hundredths-of-a-point (e.g. 2800 = 28pt), or null.
 * color is a hex string (e.g. '8B1A1A') from solidFill srgbClr, or null.
 */
function extractText(shapeXml) {
  const paragraphs = [];
  const paraRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let pm;
  while ((pm = paraRegex.exec(shapeXml)) !== null) {
    const runs = [];
    const runRegex = /<a:r>([\s\S]*?)<\/a:r>/g;
    let rm;
    while ((rm = runRegex.exec(pm[1])) !== null) {
      const textMatch = rm[1].match(/<a:t>([\s\S]*?)<\/a:t>/);
      if (textMatch) {
        // Extract font size from rPr sz attribute (hundredths of a point)
        const szMatch = rm[1].match(/<a:rPr[^>]*\bsz="(\d+)"/);
        // Extract explicit text color from solidFill > srgbClr
        const colorMatch = rm[1].match(/<a:solidFill>\s*<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
        runs.push({
          text: textMatch[1],
          bold: /\bb="1"/.test(rm[1]),
          italic: /\bi="1"/.test(rm[1]),
          fontSize: szMatch ? parseInt(szMatch[1]) : null,
          color: colorMatch ? colorMatch[1].toUpperCase() : null,
        });
      }
    }
    if (runs.length === 0) {
      const bareText = pm[1].match(/<a:t>([\s\S]*?)<\/a:t>/);
      if (bareText) runs.push({ text: bareText[1], bold: false, italic: false, fontSize: null, color: null });
    }
    if (runs.length > 0) paragraphs.push(runs);
  }
  return paragraphs;
}

function normalizePlaceholderType(phType) {
  if (phType === 'title' || phType === 'ctrTitle') return 'title';
  if (phType === 'subTitle') return 'subtitle';
  if (phType === 'ftr') return 'footer';
  if (phType === 'sldNum') return 'slideNumber';
  if (phType === 'dt') return 'date';
  if (phType === 'body' || phType === 'obj') return 'body';
  return phType;
}

/**
 * Extract the intended text style from a target placeholder's XML.
 * Reads lvl1pPr > defRPr inside lstStyle for font size, color, bold, and font face.
 * These represent what the template author intended for that placeholder.
 *
 * @param {string} shapeXml - full <p:sp> XML of the target placeholder
 * @param {object} tgtColors - theme slot→hex for resolving schemeClr references
 * @returns {{ fontSize: number|null, color: string|null, bold: boolean|null, font: string|null }}
 */
function extractPlaceholderStyle(shapeXml, tgtColors) {
  const style = { fontSize: null, color: null, bold: null, font: null };

  // Look for defRPr in lstStyle (the authoritative source for placeholder defaults)
  const lstStyleMatch = shapeXml.match(/<a:lstStyle\b[\s\S]*?<\/a:lstStyle>/);
  if (lstStyleMatch) {
    const lstStyle = lstStyleMatch[0];
    // Get lvl1pPr's defRPr (first level is most relevant)
    const defRPrMatch = lstStyle.match(/<a:lvl1pPr\b[\s\S]*?<a:defRPr\b([^>]*)(?:\/>|>([\s\S]*?)<\/a:defRPr>)/);
    if (defRPrMatch) {
      const attrs = defRPrMatch[1];
      const inner = defRPrMatch[2] || '';

      // Font size (hundredths-of-a-point, e.g. 1800 = 18pt)
      const szMatch = attrs.match(/\bsz="(\d+)"/);
      if (szMatch) style.fontSize = parseInt(szMatch[1]);

      // Bold
      const bMatch = attrs.match(/\bb="(\d)"/);
      if (bMatch) style.bold = bMatch[1] === '1';

      // Color from solidFill inside defRPr
      const srgbMatch = inner.match(/<a:solidFill>\s*<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
      if (srgbMatch) {
        style.color = srgbMatch[1].toUpperCase();
      } else {
        const schemeMatch = inner.match(/<a:solidFill>\s*<a:schemeClr\s+val="([^"]+)"/);
        if (schemeMatch && tgtColors[resolveSchemeSlot(schemeMatch[1])]) {
          style.color = tgtColors[resolveSchemeSlot(schemeMatch[1])].toUpperCase();
        }
      }

      // Font face
      const latinMatch = inner.match(/<a:latin\s+typeface="([^"]+)"/);
      if (latinMatch) style.font = latinMatch[1];
    }
  }

  // Fallback: also check pPr > defRPr directly in txBody (some templates use this)
  if (!style.fontSize) {
    const txBodyDefRPr = shapeXml.match(/<p:txBody\b[\s\S]*?<a:pPr\b[\s\S]*?<a:defRPr\b([^>]*)(?:\/>|>([\s\S]*?)<\/a:defRPr>)/);
    if (txBodyDefRPr) {
      const attrs = txBodyDefRPr[1];
      const inner = txBodyDefRPr[2] || '';
      if (!style.fontSize) {
        const szMatch = attrs.match(/\bsz="(\d+)"/);
        if (szMatch) style.fontSize = parseInt(szMatch[1]);
      }
      if (style.bold === null) {
        const bMatch = attrs.match(/\bb="(\d)"/);
        if (bMatch) style.bold = bMatch[1] === '1';
      }
      if (!style.color) {
        const srgbMatch = inner.match(/<a:solidFill>\s*<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
        if (srgbMatch) {
          style.color = srgbMatch[1].toUpperCase();
        } else {
          const schemeMatch = inner.match(/<a:solidFill>\s*<a:schemeClr\s+val="([^"]+)"/);
          if (schemeMatch && tgtColors[resolveSchemeSlot(schemeMatch[1])]) {
            style.color = tgtColors[resolveSchemeSlot(schemeMatch[1])].toUpperCase();
          }
        }
      }
      if (!style.font) {
        const latinMatch = inner.match(/<a:latin\s+typeface="([^"]+)"/);
        if (latinMatch) style.font = latinMatch[1];
      }
    }
  }

  return style;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Build a <p:txBody> from extracted paragraphs.
 * @param {Array} paragraphs - from extractText()
 * @param {object} [opts]
 * @param {number} [opts.fontSizeOverride] - Force font size in hundredths-of-a-point (e.g. 2800 = 28pt). Applied to all runs.
 * @param {number} [opts.fontSizeScale] - Multiply all font sizes by this factor (e.g. 0.85). Applied only when no override.
 * @param {string} [opts.bodyPr] - Target's <a:bodyPr> XML (preserves vertical anchor, margins, autofit).
 * @param {string} [opts.lstStyle] - Target's <a:lstStyle> XML (preserves list/bullet formatting).
 * @param {string} [opts.paraPr] - Full <a:pPr> XML from the target placeholder (alignment, spacing, indent, defRPr, bullets, etc.).
 * @param {{ fontSize: number|null, color: string|null, bold: boolean|null, font: string|null }} [opts.targetStyle]
 *   - Extracted from the target placeholder's defRPr. When present, overrides
 *     source run formatting so the output matches the template's intended look.
 */
function buildTextBody(paragraphs, opts = {}) {
  if (!paragraphs || paragraphs.length === 0) return '';
  const { fontSizeOverride, fontSizeScale, bodyPr, lstStyle, paraPr, targetStyle } = opts;
  let body = `<p:txBody>${bodyPr || '<a:bodyPr/>'}${lstStyle || '<a:lstStyle/>'}`;
  for (const para of paragraphs) {
    body += '<a:p>';
    // Paragraph properties — preserve target's full formatting
    // (alignment, spacing, indent, defRPr, bullets, etc.)
    if (paraPr) {
      body += paraPr;
    }
    for (const run of para) {
      body += '<a:r>';
      const attrs = ['lang="en-US"', 'dirty="0"'];

      // Bold: target template wins if it defines a value, else source
      const bold = targetStyle?.bold !== null && targetStyle?.bold !== undefined
        ? targetStyle.bold
        : run.bold;
      if (bold) attrs.push('b="1"');
      if (run.italic) attrs.push('i="1"');

      // Font size priority: explicit override > targetStyle > scaled original > original
      let sz = fontSizeOverride || null;
      if (!sz && targetStyle?.fontSize) {
        sz = targetStyle.fontSize;
        // Still apply scaling if text overflows
        if (fontSizeScale && fontSizeScale < 1) {
          sz = Math.round(sz * fontSizeScale);
        }
      }
      if (!sz) {
        const baseSz = run.fontSize || (fontSizeScale ? 1800 : null);
        if (baseSz) {
          sz = fontSizeScale ? Math.round(baseSz * fontSizeScale) : baseSz;
        }
      }
      if (sz) attrs.push(`sz="${sz}"`);

      // Color priority: targetStyle color > source run color (will be remapped later)
      const color = targetStyle?.color || run.color;

      // Font face from target template
      let fontChildren = '';
      if (targetStyle?.font) {
        fontChildren += `<a:latin typeface="${targetStyle.font}"/>`;
      }

      // Build rPr
      if (color || fontChildren) {
        const fillXml = color ? `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` : '';
        body += `<a:rPr ${attrs.join(' ')}>${fillXml}${fontChildren}</a:rPr>`;
      } else {
        body += `<a:rPr ${attrs.join(' ')}/>`;
      }
      body += `<a:t>${escapeXml(run.text)}</a:t>`;
      body += '</a:r>';
    }
    body += '</a:p>';
  }
  body += '</p:txBody>';
  return body;
}

/**
 * Estimate a scale factor (0..1) to shrink text so it fits within the
 * placeholder height. Uses a rough heuristic: count total text lines
 * (including wrapping estimates) × average font size × line-height,
 * then compare to the placeholder cy (height in EMU).
 *
 * Returns 1.0 if text fits, or a fraction like 0.85 if it needs shrinking.
 * Caps at a minimum of 0.6 (never shrink below 60% of original size).
 */
function estimateScaleFactor(paragraphs, spPr) {
  if (!paragraphs || paragraphs.length === 0) return 1;

  // Extract placeholder width/height from spPr (EMU)
  const cxMatch = spPr.match(/\bcx="(\d+)"/);
  const cyMatch = spPr.match(/\bcy="(\d+)"/);
  if (!cyMatch) return 1; // No height info → can't estimate
  const heightEmu = parseInt(cyMatch[1]);
  const widthEmu = cxMatch ? parseInt(cxMatch[1]) : 8229600; // default ~8.5in

  // EMU → points: 1pt = 12700 EMU
  const heightPt = heightEmu / 12700;
  const widthPt = widthEmu / 12700;

  // Estimate total text height
  let totalHeightPt = 0;
  const LINE_SPACING = 1.25; // typical PowerPoint line spacing
  const AVG_CHAR_WIDTH_RATIO = 0.55; // avg char width ≈ 55% of font size

  for (const para of paragraphs) {
    // Get the dominant font size for this paragraph
    const sizes = para.map(r => r.fontSize).filter(Boolean);
    const fontSizePt = sizes.length > 0
      ? Math.max(...sizes) / 100  // hundredths-of-a-point → points
      : 18; // default assumption if no size info

    // Estimate paragraph text length for wrap calculation
    const paraText = para.map(r => r.text).join('');
    const charsPerLine = Math.max(1, Math.floor(widthPt / (fontSizePt * AVG_CHAR_WIDTH_RATIO)));
    const wrappedLines = Math.max(1, Math.ceil(paraText.length / charsPerLine));

    totalHeightPt += wrappedLines * fontSizePt * LINE_SPACING;
  }

  // Add some paragraph spacing
  totalHeightPt += (paragraphs.length - 1) * 4; // ~4pt between paragraphs

  if (totalHeightPt <= heightPt) return 1; // fits fine

  const scale = heightPt / totalHeightPt;
  return Math.max(0.6, Math.min(1, scale)); // clamp to [0.6, 1.0]
}

/** Get Y offset from a shape's spPr for positional sorting. */
function extractYPos(shapeXml) {
  const m = shapeXml.match(/<a:off[^>]*y="(\d+)"/);
  return m ? parseInt(m[1]) : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE ZONE CLASSIFICATION (for resize logic)
// ═══════════════════════════════════════════════════════════════════════════

// Standard 13.33" × 7.5" slide = 12192000 × 6858000 EMU
const SLIDE_W_EMU = 12192000;
const SLIDE_H_EMU = 6858000;

/**
 * Classify a remaining (non-role-assigned) shape into a zone:
 *   - 'content'   : in or near the content area (safe to resize)
 *   - 'tracker'   : small element at corners/edges (logo, page number, branding)
 *   - 'footer'    : bottom strip element
 *   - 'decorator'  : decorative/background element (very large or very small)
 *
 * Only 'content' zone shapes should be resized.
 */
function classifyShapeZone(shape, contentArea) {
  const { x, y, cx, cy } = shape;
  const right = x + cx;
  const bottom = y + cy;
  const centerX = x + cx / 2;
  const centerY = y + cy / 2;

  // Convert content area (inches) to EMU for comparison
  const caLeft = contentArea ? Math.round(contentArea.x * 914400) : Math.round(0.48 * 914400);
  const caTop = contentArea ? Math.round(contentArea.y * 914400) : Math.round(1.90 * 914400);
  const caRight = contentArea ? Math.round((contentArea.x + contentArea.w) * 914400) : Math.round(12.84 * 914400);
  const caBottom = contentArea ? Math.round((contentArea.y + contentArea.h) * 914400) : Math.round(6.40 * 914400);

  // Thresholds (EMU)
  const margin = 457200; // 0.5 inch tolerance around content area
  const smallThreshold = 914400; // 1 inch — shapes smaller than this in both dims are likely trackers
  const footerY = SLIDE_H_EMU * 0.85; // bottom 15% of slide
  const headerY = SLIDE_H_EMU * 0.20; // top 20% of slide

  // --- Very small shapes at edges → tracker ---
  if (cx < smallThreshold && cy < smallThreshold) {
    const atTop = y < headerY;
    const atBottom = y > footerY;
    const atLeft = x < caLeft;
    const atRight = right > caRight;
    if (atTop || atBottom || atLeft || atRight) {
      return 'tracker';
    }
  }

  // --- Bottom strip → footer ---
  if (y > footerY && cy < SLIDE_H_EMU * 0.15) {
    return 'footer';
  }

  // --- Very large shape covering most of slide → decorator (background shape) ---
  const areaRatio = (cx * cy) / (SLIDE_W_EMU * SLIDE_H_EMU);
  if (areaRatio > 0.7) {
    return 'decorator';
  }

  // --- Shape overlaps significantly with content area → content ---
  const inContentX = centerX >= (caLeft - margin) && centerX <= (caRight + margin);
  const inContentY = centerY >= (caTop - margin) && centerY <= (caBottom + margin);
  if (inContentX && inContentY) {
    return 'content';
  }

  // --- Shape entirely above content area (title zone) → tracker ---
  if (bottom < caTop && cy < SLIDE_H_EMU * 0.25) {
    return 'tracker';
  }

  // --- Default: if not clearly in content area, leave alone ---
  return 'tracker';
}

/**
 * Extract placeholder text from source, remove source placeholders,
 * inject target layout placeholders with source text, remap colors.
 *
 * Two-pass matching:
 *   Pass 1 — exact normalized type match (title→title, subtitle→subtitle, etc.)
 *   Pass 2 — positional fallback: remaining source text goes to remaining
 *            target placeholders sorted by Y position (top→bottom)
 */
function transformSlideXml(srcSlideXml, targetLayout, colorMap, tgtColors, srcColors, keepSourcePositions, { headerSizePt = 28, contentArea = null, structureAnalysis = null, enableResize = false } = {}) {
  const headerSizeHpt = headerSizePt * 100; // OOXML hundredths-of-a-point

  // Build reverse lookup from GPT structure analysis:
  // shapeRoles maps pattern keys to target placeholder types
  const shapeRoles = structureAnalysis?.shapeRoles || {};
  const rawRoleMap = structureAnalysis?.roleMap || {};

  // ── Validate roleMap: reject dangerous remaps ─────────────────────
  // GPT sometimes swaps roles (e.g. subtitle↔ftr, body→subtitle).
  // Only allow roleMap overrides between same-tier types.
  const roleMap = {};
  const protectedTypes = new Set(['title', 'subtitle']);
  const footerTypes = new Set(['footer', 'slideNumber', 'date']);
  for (const [src, tgt] of Object.entries(rawRoleMap)) {
    const normSrc = normalizePlaceholderType(src);
    const normTgt = normalizePlaceholderType(tgt);
    // Block: promoting footer-tier to subtitle, or demoting subtitle to footer
    if (protectedTypes.has(normSrc) && footerTypes.has(normTgt)) {
      console.warn(`[RoleMap] Rejected: ${normSrc} → ${normTgt} (would demote subtitle/title)`);
      continue;
    }
    if (footerTypes.has(normSrc) && protectedTypes.has(normTgt)) {
      console.warn(`[RoleMap] Rejected: ${normSrc} → ${normTgt} (would promote footer to title/subtitle)`);
      continue;
    }
    if (normSrc === 'body' && normTgt === 'subtitle') {
      console.warn(`[RoleMap] Rejected: body → subtitle (body content should not become subtitle)`);
      continue;
    }
    roleMap[src] = tgt;
  }

  // ── Step 1: Extract text from source shapes ────────────────────────
  const srcPlaceholders = {}; // normalizedType → { text, spPr }
  const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  const shapesToRemove = [];

  let match;
  while ((match = spRegex.exec(srcSlideXml)) !== null) {
    const shapeXml = match[0];
    const isPlaceholder = /<p:ph\b/.test(shapeXml);

    let key = null;

    if (isPlaceholder) {
      // Standard placeholder — use normalized type
      const phTypeMatch = shapeXml.match(/<p:ph[^>]*type="([^"]+)"/);
      const phType = phTypeMatch ? phTypeMatch[1] : 'body';
      key = normalizePlaceholderType(phType);
      // Apply validated roleMap overrides
      if (roleMap[key]) {
        const remapped = normalizePlaceholderType(roleMap[key]);
        console.log(`[Shape] Placeholder "${phType}" (${key}) remapped → ${remapped} by roleMap`);
        key = remapped;
      } else {
        console.log(`[Shape] Placeholder "${phType}" → ${key}`);
      }
    } else {
      // Non-placeholder shape — use HEURISTICS first, GPT shapeRoles as fallback.
      // Heuristics are more reliable for common patterns (source citations, page numbers).
      const offMatch = shapeXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
      const extMatch = shapeXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
      const szMatch = shapeXml.match(/<a:rPr[^>]*\bsz="(\d+)"/);
      const nameMatch = shapeXml.match(/<p:cNvPr[^>]*name="([^"]+)"/);
      if (offMatch) {
        const x = parseInt(offMatch[1]);
        const y = parseInt(offMatch[2]);
        const h = extMatch ? parseInt(extMatch[2]) : 0;
        const fontSizePt = szMatch ? Math.round(parseInt(szMatch[1]) / 100) : null;
        const shapeName = nameMatch ? nameMatch[1] : 'unnamed';
        const normalizedName = shapeName.replace(/\d+/g, 'N');
        const yIn = y / 914400;

        // Extract text for content-based heuristics
        const allText = [];
        const textRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
        let tm;
        while ((tm = textRegex.exec(shapeXml)) !== null) allText.push(tm[1]);
        const textContent = allText.join(' ').trim();
        const textLower = textContent.toLowerCase();

        // ── Heuristic 1: Source/footnote citation ──
        // Bottom of slide (Y > 6"), small font (≤10pt), or contains "Source:", "Note:" etc.
        const isBottomArea = yIn > 6.0;
        const isSmallFont = fontSizePt !== null && fontSizePt <= 10;
        const hasSourcePattern = /^(source|note|quelle|fuente)\s*:/i.test(textContent);
        if (isBottomArea && (isSmallFont || hasSourcePattern)) {
          key = 'footer';
          console.log(`[Shape] Heuristic: "${textContent.slice(0, 40)}" → footer (bottom=${yIn.toFixed(1)}", font=${fontSizePt}pt)`);
        }

        // ── Heuristic 2: Slide number ──
        // Bottom-right, small, contains only digits/symbols like "1", "‹#›", "| 5"
        if (!key && isBottomArea && x > 6000000 && isSmallFont) {
          const isPageNum = /^[\s|#‹›\d\-–—.]+$/.test(textContent) || textContent.length <= 3;
          if (isPageNum) {
            key = 'slideNumber';
            console.log(`[Shape] Heuristic: "${textContent}" → slideNumber (bottom-right, small)`);
          }
        }

        // ── Heuristic 3: GPT shapeRoles fallback (for non-obvious shapes) ──
        if (!key && Object.keys(shapeRoles).length > 0) {
          const hZone = x < 1500000 ? 'left' : x > 6000000 ? 'right' : 'center';
          const vZone = y < 2000000 ? 'top' : y > 5000000 ? 'bottom' : 'middle';
          const zone = `${vZone}-${hZone}`;
          const patternKey = `${zone}|${fontSizePt || '?'}pt|${normalizedName}`;

          let matchedRole = shapeRoles[patternKey];
          if (!matchedRole) {
            for (const [roleKey, roleType] of Object.entries(shapeRoles)) {
              if (roleKey.startsWith(zone) && roleKey.includes(`${fontSizePt || '?'}pt`)) {
                matchedRole = roleType;
                break;
              }
            }
          }
          if (matchedRole) {
            const normRole = normalizePlaceholderType(matchedRole);
            // Non-placeholders can NEVER be title or subtitle
            if (normRole === 'title' || normRole === 'subtitle') {
              console.warn(`[Shape] GPT wanted "${normalizedName}" → "${normRole}" — blocked (non-placeholder)`);
            } else {
              key = normRole;
              console.log(`[Shape] GPT fallback: "${normalizedName}" at ${zone} → ${key}`);
            }
          }
        }
      }
    }

    if (!key) {
      // No role identified — if it's a placeholder, still track for removal
      if (isPlaceholder) {
        shapesToRemove.push({ start: match.index, end: match.index + match[0].length });
      }
      continue;
    }

    const text = extractText(shapeXml);
    if (text.length > 0 && !srcPlaceholders[key]) {
      const srcSpPrMatch = shapeXml.match(/<p:spPr\b[\s\S]*?<\/p:spPr>/) || shapeXml.match(/<p:spPr\/>/);
      srcPlaceholders[key] = {
        text,
        spPr: srcSpPrMatch ? srcSpPrMatch[0] : '<p:spPr/>',
      };
    }
    shapesToRemove.push({ start: match.index, end: match.index + match[0].length });
  }

  // ── Step 2: Remove extracted shapes (back to front) ─────────────────
  // Removes both placeholders and non-placeholder shapes that got roles.
  let xml = srcSlideXml;
  shapesToRemove.sort((a, b) => b.start - a.start);
  for (const pos of shapesToRemove) {
    xml = xml.slice(0, pos.start) + xml.slice(pos.end);
  }

  // ── Step 3: Match source text → target placeholders ─────────────────
  const tgtPHs = targetLayout ? targetLayout.placeholders : [];
  const pairs = []; // { tgtPh, text }
  const matchedTgt = new Set();
  const usedSrcKeys = new Set();

  // Pass 1: exact normalized type match
  for (const tgtPh of tgtPHs) {
    const key = normalizePlaceholderType(tgtPh.phType);
    if (srcPlaceholders[key] && !usedSrcKeys.has(key)) {
      pairs.push({ tgtPh, src: srcPlaceholders[key] });
      matchedTgt.add(tgtPh);
      usedSrcKeys.add(key);
    }
  }

  // Pass 2: positional fallback for remaining source text
  const unmatchedSrcKeys = Object.keys(srcPlaceholders).filter(k => !usedSrcKeys.has(k));
  if (unmatchedSrcKeys.length > 0) {
    // Skip title/subtitle/footer/date/slideNumber targets — only match to body/content areas
    // Title and subtitle must only come from exact type match (Pass 1), never from leftovers.
    const skipTypes = new Set(['title', 'subtitle', 'footer', 'slideNumber', 'date']);
    const unmatchedTgt = tgtPHs
      .filter(p => !matchedTgt.has(p) && !skipTypes.has(normalizePlaceholderType(p.phType)));
    // Sort remaining targets by Y position (topmost first)
    unmatchedTgt.sort((a, b) => extractYPos(a.shapeXml) - extractYPos(b.shapeXml));
    // Sort remaining source by importance
    const priority = { title: 0, subtitle: 1, body: 2, footer: 3, date: 4, slideNumber: 5 };
    unmatchedSrcKeys.sort((a, b) => (priority[a] ?? 99) - (priority[b] ?? 99));

    for (let i = 0; i < Math.min(unmatchedSrcKeys.length, unmatchedTgt.length); i++) {
      console.log(`[Shape] Positional fallback: "${unmatchedSrcKeys[i]}" → target ph "${unmatchedTgt[i].phType}" (idx ${unmatchedTgt[i].phIdx})`);
      pairs.push({ tgtPh: unmatchedTgt[i], src: srcPlaceholders[unmatchedSrcKeys[i]] });
    }
  }

  console.log(`[Shape] Final pairs (${pairs.length}):`, pairs.map(p => `${normalizePlaceholderType(p.tgtPh.phType)}(idx:${p.tgtPh.phIdx})`).join(', '));

  // ── Step 4: Build new placeholder shapes ────────────────────────────
  const newShapes = [];
  let shapeId = 9000;

  for (const { tgtPh, src } of pairs) {
    const key = normalizePlaceholderType(tgtPh.phType);
    const typeAttr = tgtPh.phType ? ` type="${tgtPh.phType}"` : '';
    const idxAttr = tgtPh.phIdx !== null ? ` idx="${tgtPh.phIdx}"` : '';
    const phTag = `<p:ph${typeAttr}${idxAttr}/>`;

    // Position: use source position if requested, otherwise target layout's
    let spPr;
    if (keepSourcePositions && src.spPr) {
      spPr = src.spPr;
    } else {
      const spPrMatch = tgtPh.shapeXml.match(/<p:spPr\b[\s\S]*?<\/p:spPr>/);
      spPr = spPrMatch ? spPrMatch[0] : '<p:spPr/>';
    }

    // ── Extract target placeholder's intended style ─────────────────
    const targetStyle = extractPlaceholderStyle(tgtPh.shapeXml, tgtColors);

    // ── Inherit text formatting from target placeholder ──────────────
    // bodyPr: vertical anchor (ctr/t/b), autofit, margins, wrap
    const tgtBodyPrMatch = tgtPh.shapeXml.match(/<a:bodyPr\b[^>]*\/>/s)
      || tgtPh.shapeXml.match(/<a:bodyPr\b[\s\S]*?<\/a:bodyPr>/s);
    // lstStyle: list/bullet formatting from the target
    const tgtLstStyleMatch = tgtPh.shapeXml.match(/<a:lstStyle\b[\s\S]*?<\/a:lstStyle>/s)
      || tgtPh.shapeXml.match(/<a:lstStyle\/>/s);
    // Full paragraph properties from the target (alignment, spacing, indent,
    // defRPr, bullets, etc.). Preserves the complete <a:pPr> element.
    const tgtPPrMatch = tgtPh.shapeXml.match(/<a:pPr\b[\s\S]*?<\/a:pPr>/s)
      || tgtPh.shapeXml.match(/<a:pPr\b[^>]*\/>/s);

    let textBodyOpts = {
      bodyPr: tgtBodyPrMatch ? tgtBodyPrMatch[0] : null,
      lstStyle: tgtLstStyleMatch ? tgtLstStyleMatch[0] : null,
      paraPr: tgtPPrMatch ? tgtPPrMatch[0] : null,
      targetStyle, // pass extracted style to buildTextBody
    };

    // slideNumber/date: build auto-increment field with target alignment/style.
    // Uses <a:fld type="slidenum"> so PowerPoint auto-numbers instead of static text.
    // Preserves target layout's alignment (e.g. left-aligned) and font style.
    if (key === 'slideNumber' || key === 'date') {
      const fieldType = key === 'slideNumber' ? 'slidenum' : 'datetime1';
      const fieldId = `{D7B2F802-3591-4E12-${String(shapeId).padStart(4, '0')}-A1B2C3D4E5F6}`;
      const bPr = tgtBodyPrMatch ? tgtBodyPrMatch[0] : '<a:bodyPr/>';
      const lSt = tgtLstStyleMatch ? tgtLstStyleMatch[0] : '<a:lstStyle/>';
      const pPr = tgtPPrMatch ? tgtPPrMatch[0] : '';
      // Build rPr from target style (font, size, color)
      let rPrAttrs = 'lang="en-US" smtClean="0"';
      if (targetStyle?.fontSize) rPrAttrs += ` sz="${targetStyle.fontSize}"`;
      let rPrKids = '';
      if (targetStyle?.color) rPrKids += `<a:solidFill><a:srgbClr val="${targetStyle.color}"/></a:solidFill>`;
      if (targetStyle?.font) rPrKids += `<a:latin typeface="${targetStyle.font}"/>`;
      const rPr = rPrKids ? `<a:rPr ${rPrAttrs}>${rPrKids}</a:rPr>` : `<a:rPr ${rPrAttrs}/>`;
      const placeholder = key === 'slideNumber' ? '\u2039#\u203a' : '';
      const textBody = `<p:txBody>${bPr}${lSt}<a:p>${pPr}<a:fld id="${fieldId}" type="${fieldType}">${rPr}<a:t>${placeholder}</a:t></a:fld><a:endParaRPr lang="en-US"/></a:p></p:txBody>`;

      newShapes.push(
        `<p:sp><p:nvSpPr>` +
        `<p:cNvPr id="${shapeId++}" name="${key} ${shapeId}"/>` +
        `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
        `<p:nvPr>${phTag}</p:nvPr>` +
        `</p:nvSpPr>${spPr}${textBody}</p:sp>`
      );
      continue;
    }

    if (key === 'title') {
      // Only the main title gets the explicit header size override (e.g. 28pt)
      textBodyOpts.fontSizeOverride = headerSizeHpt;
    } else if (key === 'body' && enableResize) {
      // Body/content: resize-to-fit using the defined content area bounds
      // (1 inch = 914400 EMU). Only when enableResize is on.
      let sizeRef = spPr;
      if (contentArea) {
        const cxEmu = Math.round(contentArea.w * 914400);
        const cyEmu = Math.round(contentArea.h * 914400);
        sizeRef = `<p:spPr><a:xfrm><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm></p:spPr>`;
      }
      const scale = estimateScaleFactor(src.text, sizeRef);
      if (scale < 1) {
        textBodyOpts.fontSizeScale = scale;
      }
    }
    // All other placeholders (subtitle, footer, sldNum, date) use targetStyle
    // from extractPlaceholderStyle — no hardcoded overrides.

    const textBody = buildTextBody(src.text, textBodyOpts);
    if (!textBody) continue;

    newShapes.push(
      `<p:sp><p:nvSpPr>` +
      `<p:cNvPr id="${shapeId++}" name="${key} ${shapeId}"/>` +
      `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
      `<p:nvPr>${phTag}</p:nvPr>` +
      `</p:nvSpPr>${spPr}${textBody}</p:sp>`
    );
  }

  if (newShapes.length > 0) {
    const insertPoint = xml.match(/<\/p:grpSpPr>/);
    if (insertPoint) {
      const idx = insertPoint.index + insertPoint[0].length;
      xml = xml.slice(0, idx) + newShapes.join('') + xml.slice(idx);
    }
  }

  // ── Step 5: Proportionally resize remaining content shapes ──────────
  // Only when enableResize is ON. Uses zone-aware classification to only
  // resize shapes in the content zone — never touches trackers (logos,
  // page numbers at corners), footers, or decorative background shapes.
  if (enableResize && contentArea) {
    const tgtX = Math.round(contentArea.x * 914400);
    const tgtY = Math.round(contentArea.y * 914400);
    const tgtW = Math.round(contentArea.w * 914400);
    const tgtH = Math.round(contentArea.h * 914400);

    // Find all remaining shapes (not our injected ones which start with id 9000+)
    const remainingShapes = [];
    const remainRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
    let rm;
    while ((rm = remainRegex.exec(xml)) !== null) {
      const sp = rm[0];
      // Skip our injected shapes (they already have target positions)
      if (/id="9\d{3}"/.test(sp)) continue;
      // Skip shapes without position info
      const offM = sp.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
      const extM = sp.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
      if (!offM || !extM) continue;
      const shape = {
        start: rm.index,
        end: rm.index + rm[0].length,
        x: parseInt(offM[1]),
        y: parseInt(offM[2]),
        cx: parseInt(extM[1]),
        cy: parseInt(extM[2]),
      };
      shape.zone = classifyShapeZone(shape, contentArea);
      remainingShapes.push(shape);
    }

    const contentShapes = remainingShapes.filter(s => s.zone === 'content');
    const skippedShapes = remainingShapes.filter(s => s.zone !== 'content');

    if (skippedShapes.length > 0) {
      console.log(`[Resize] Skipping ${skippedShapes.length} non-content shapes: ${skippedShapes.map(s => s.zone).join(', ')}`);
    }

    if (contentShapes.length > 0) {
      // Compute bounding box of content-zone shapes only
      let minX = Infinity, minY = Infinity, maxR = 0, maxB = 0;
      for (const s of contentShapes) {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxR = Math.max(maxR, s.x + s.cx);
        maxB = Math.max(maxB, s.y + s.cy);
      }
      const srcW = maxR - minX;
      const srcH = maxB - minY;

      if (srcW > 0 && srcH > 0) {
        // Uniform scale to fit target content area (preserve aspect ratio)
        const scale = Math.min(tgtW / srcW, tgtH / srcH, 1.0); // never scale up
        const scaledW = srcW * scale;
        const scaledH = srcH * scale;
        // Center in target content area
        const offsetX = tgtX + Math.round((tgtW - scaledW) / 2) - Math.round(minX * scale);
        const offsetY = tgtY + Math.round((tgtH - scaledH) / 2) - Math.round(minY * scale);

        if (scale < 0.99) { // only if actually needs scaling
          console.log(`[Resize] ${contentShapes.length} content-zone shapes: scale=${scale.toFixed(2)}, src bbox=${(srcW/914400).toFixed(1)}"×${(srcH/914400).toFixed(1)}", tgt area=${contentArea.w}"×${contentArea.h}"`);

          // Apply transform back-to-front
          const sorted = [...contentShapes].sort((a, b) => b.start - a.start);
          for (const s of sorted) {
            const newX = Math.round(s.x * scale + offsetX);
            const newY = Math.round(s.y * scale + offsetY);
            const newCx = Math.round(s.cx * scale);
            const newCy = Math.round(s.cy * scale);
            let shapeXml = xml.slice(s.start, s.end);
            shapeXml = shapeXml.replace(
              /<a:off\s+x="\d+"\s+y="\d+"/,
              `<a:off x="${newX}" y="${newY}"`
            );
            shapeXml = shapeXml.replace(
              /<a:ext\s+cx="\d+"\s+cy="\d+"/,
              `<a:ext cx="${newCx}" cy="${newCy}"`
            );
            xml = xml.slice(0, s.start) + shapeXml + xml.slice(s.end);
          }
        }
      }
    }
  }

  // ── Step 6: Remap colors + enforce contrast ─────────────────────────
  xml = remapColorsInXml(xml, colorMap, srcColors);

  // Detect target layout background for contrast fallback
  let layoutBgHex = null;
  if (targetLayout?.bgXml) {
    const bgSrgb = targetLayout.bgXml.match(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
    if (bgSrgb) layoutBgHex = bgSrgb[1].toUpperCase();
    else {
      const bgScheme = targetLayout.bgXml.match(/<a:schemeClr\s+val="([^"]+)"/);
      if (bgScheme) layoutBgHex = tgtColors[resolveSchemeSlot(bgScheme[1])] || null;
    }
  }
  xml = enforceTextContrast(xml, tgtColors, layoutBgHex);
  return xml;
}

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONSHIP & MEDIA TRANSPLANT
// ═══════════════════════════════════════════════════════════════════════════

function resolveRelPath(basePath, relTarget) {
  if (relTarget.startsWith('/')) return relTarget.substring(1);
  const baseDir = basePath.substring(0, basePath.lastIndexOf('/'));
  const parts = baseDir.split('/');
  for (const seg of relTarget.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

/**
 * Process a source slide's .rels:
 * - Replace the layout reference to point to the target layout
 * - Remove notesSlide references
 * - Copy all referenced media, charts, embeddings from source to output
 */
async function processSlideRels({
  sourceRelsXml,
  sourceZip,
  outputZip,
  srcSlideIdx,
  outSlideNum,
  targetLayoutIdx,
  existingMediaNames,
  mediaCounter,
}) {
  if (!sourceRelsXml) {
    // No rels file — create minimal one with just the layout reference
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${targetLayoutIdx}.xml"/>
</Relationships>`;
  }

  const srcRels = parseRels(sourceRelsXml);

  // Copy all referenced files from source to output
  for (const [rId, rel] of Object.entries(srcRels)) {
    if (rel.targetMode === 'External') continue; // hyperlinks — nothing to copy
    if (rel.type.includes('/slideLayout')) continue; // will be replaced
    if (rel.type.includes('/notesSlide')) continue; // will be removed

    const srcFilePath = resolveRelPath(`ppt/slides/slide${srcSlideIdx}.xml`, rel.target);
    const srcFile = sourceZip.files[srcFilePath];
    if (!srcFile || srcFile.dir) continue;

    // For media files, handle collision avoidance
    if (srcFilePath.startsWith('ppt/media/')) {
      let outPath = srcFilePath;
      if (existingMediaNames.has(srcFilePath)) {
        const ext = srcFilePath.match(/\.[^.]+$/) || [''];
        outPath = `ppt/media/src_s${outSlideNum}_${mediaCounter.value++}${ext[0]}`;
        // Also update the rels XML to point to the new path
        sourceRelsXml = sourceRelsXml.replace(
          new RegExp(`Target="([^"]*?)${escapeRegex(srcFilePath.replace('ppt/', ''))}"`, 'g'),
          `Target="../${outPath.replace('ppt/', '')}"`
        );
      }
      outputZip.file(outPath, await srcFile.async('arraybuffer'));
      existingMediaNames.add(outPath);
    } else if (srcFilePath.startsWith('ppt/charts/')) {
      await copyChartDeep(sourceZip, outputZip, srcFilePath);
    } else if (srcFilePath.startsWith('ppt/diagrams/')) {
      await copyDiagramFiles(sourceZip, outputZip, srcFilePath);
    } else {
      // Embeddings, or anything else — copy as-is
      if (!outputZip.files[srcFilePath]) {
        outputZip.file(srcFilePath, await srcFile.async('arraybuffer'));
      }
    }
  }

  // Modify the rels XML:
  // 1. Replace layout reference
  let outRelsXml = sourceRelsXml.replace(
    /Target="[^"]*?slideLayout\d+\.xml"/,
    `Target="../slideLayouts/slideLayout${targetLayoutIdx}.xml"`
  );

  // 2. Remove notesSlide references
  outRelsXml = outRelsXml.replace(
    /<Relationship[^>]*notesSlide[^>]*\/>/g,
    ''
  );

  return outRelsXml;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function copyChartDeep(srcZip, outZip, chartPath) {
  if (srcZip.files[chartPath] && !outZip.files[chartPath]) {
    outZip.file(chartPath, await srcZip.files[chartPath].async('arraybuffer'));
  }
  const chartName = chartPath.match(/[^/]+$/)[0];
  const chartRelsPath = chartPath.replace(chartName, `_rels/${chartName}.rels`);
  if (srcZip.files[chartRelsPath]) {
    if (!outZip.files[chartRelsPath]) {
      outZip.file(chartRelsPath, await srcZip.files[chartRelsPath].async('arraybuffer'));
    }
    const chartRelsXml = await srcZip.files[chartRelsPath].async('string');
    const chartRels = parseRels(chartRelsXml);
    for (const rel of Object.values(chartRels)) {
      if (rel.targetMode === 'External') continue;
      const depPath = resolveRelPath(chartPath, rel.target);
      if (srcZip.files[depPath] && !outZip.files[depPath]) {
        outZip.file(depPath, await srcZip.files[depPath].async('arraybuffer'));
      }
    }
  }
  const chartDir = chartPath.substring(0, chartPath.lastIndexOf('/') + 1);
  const idx = chartPath.match(/chart(\d+)/)?.[1] || '1';
  for (const suffix of [`style${idx}.xml`, `colors${idx}.xml`]) {
    const p = chartDir + suffix;
    if (srcZip.files[p] && !outZip.files[p]) {
      outZip.file(p, await srcZip.files[p].async('arraybuffer'));
    }
  }
}

async function copyDiagramFiles(srcZip, outZip, diagPath) {
  if (srcZip.files[diagPath] && !outZip.files[diagPath]) {
    outZip.file(diagPath, await srcZip.files[diagPath].async('arraybuffer'));
  }
  const diagDir = 'ppt/diagrams/';
  for (const f of Object.keys(srcZip.files).filter(f => f.startsWith(diagDir))) {
    if (!outZip.files[f] && !srcZip.files[f].dir) {
      outZip.file(f, await srcZip.files[f].async('arraybuffer'));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSEMBLY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function removeTargetSlides(zip) {
  Object.keys(zip.files).filter(
    f => /^ppt\/slides\/slide\d+\.xml$/.test(f) ||
         /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(f) ||
         f.startsWith('ppt/notesSlides/')
  ).forEach(f => zip.remove(f));
}

async function updatePresentationXml(outZip, slideCount, srcZip) {
  const presPath = 'ppt/presentation.xml';
  if (!outZip.files[presPath]) return;

  let presXml = await outZip.files[presPath].async('string');

  let newSldIdLst = '<p:sldIdLst>';
  for (let i = 0; i < slideCount; i++) {
    newSldIdLst += `<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`;
  }
  newSldIdLst += '</p:sldIdLst>';

  if (/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/.test(presXml)) {
    presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, newSldIdLst);
  } else if (/<p:sldIdLst\/>/.test(presXml)) {
    presXml = presXml.replace(/<p:sldIdLst\/>/, newSldIdLst);
  }

  // Match source slide size
  if (srcZip?.files[presPath]) {
    const srcPresXml = await srcZip.files[presPath].async('string');
    const sizeMatch = srcPresXml.match(/<p:sldSz[^>]*(?:\/>|>[^<]*<\/p:sldSz>)/);
    if (sizeMatch) {
      presXml = presXml.replace(/<p:sldSz[^>]*(?:\/>|>[^<]*<\/p:sldSz>)/, sizeMatch[0]);
    }
  }

  outZip.file(presPath, presXml);
}

async function updatePresentationRels(outZip, slideCount) {
  const relsPath = 'ppt/_rels/presentation.xml.rels';
  if (!outZip.files[relsPath]) return;

  let relsXml = await outZip.files[relsPath].async('string');

  relsXml = relsXml.replace(
    /<Relationship[^>]*?Target="slides\/slide\d+\.xml"[^>]*\/>/g,
    ''
  );

  let newRels = '';
  for (let i = 0; i < slideCount; i++) {
    newRels += `<Relationship Id="rId${100 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
  }
  relsXml = relsXml.replace('</Relationships>', newRels + '</Relationships>');

  outZip.file(relsPath, relsXml);
}

async function updateContentTypes(outZip, slideCount, srcZip) {
  const ctPath = '[Content_Types].xml';
  if (!outZip.files[ctPath]) return;

  let ctXml = await outZip.files[ctPath].async('string');

  ctXml = ctXml.replace(/<Override[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, '');
  ctXml = ctXml.replace(/<Override[^>]*PartName="\/ppt\/notesSlides\/[^"]*"[^>]*\/>/g, '');

  let overrides = '';
  for (let i = 0; i < slideCount; i++) {
    overrides += `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }

  // Chart overrides
  for (const f of Object.keys(outZip.files).filter(f => /^ppt\/charts\/chart\d+\.xml$/.test(f))) {
    const pn = '/' + f;
    if (!ctXml.includes(`PartName="${pn}"`)) {
      overrides += `<Override PartName="${pn}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
    }
  }

  // Diagram overrides
  for (const f of Object.keys(outZip.files).filter(f => /^ppt\/diagrams\/data\d+\.xml$/.test(f))) {
    const pn = '/' + f;
    if (!ctXml.includes(`PartName="${pn}"`)) {
      overrides += `<Override PartName="${pn}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml"/>`;
    }
  }

  ctXml = ctXml.replace('</Types>', overrides + '</Types>');

  // Merge Default extension entries from source
  if (srcZip?.files[ctPath]) {
    const srcCtXml = await srcZip.files[ctPath].async('string');
    const defRe = /<Default\s+Extension="([^"]+)"[^>]*\/>/g;
    let dm;
    while ((dm = defRe.exec(srcCtXml)) !== null) {
      if (!ctXml.includes(`Extension="${dm[1]}"`)) {
        ctXml = ctXml.replace('</Types>', dm[0] + '</Types>');
      }
    }
  }

  outZip.file(ctPath, ctXml);
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR SCANNING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply OOXML color modifiers (tint, shade, lumMod, lumOff, satMod) to a base hex.
 * Handles the full modifier chain as used in PowerPoint's color palette rows.
 */
function applyColorModifiers(hex, modXml) {
  if (!modXml) return hex;
  let [r, g, b] = hexToRgb(hex);

  // 1. Tint — lighten towards white: new = base + (255 - base) * (1 - val/100000)
  const tintMatch = modXml.match(/<a:tint\s+val="(\d+)"/);
  if (tintMatch) {
    const f = parseInt(tintMatch[1]) / 100000;
    r = Math.round(r * f + 255 * (1 - f));
    g = Math.round(g * f + 255 * (1 - f));
    b = Math.round(b * f + 255 * (1 - f));
  }

  // 2. Shade — darken towards black: new = base * val/100000
  const shadeMatch = modXml.match(/<a:shade\s+val="(\d+)"/);
  if (shadeMatch) {
    const f = parseInt(shadeMatch[1]) / 100000;
    r = Math.round(r * f);
    g = Math.round(g * f);
    b = Math.round(b * f);
  }

  // 3. LumMod + LumOff — HSL luminance: new_L = L * lumMod + lumOff
  const lumModMatch = modXml.match(/<a:lumMod\s+val="(\d+)"/);
  const lumOffMatch = modXml.match(/<a:lumOff\s+val="(\d+)"/);
  if (lumModMatch || lumOffMatch) {
    let [h, s, l] = hexToHsl(rgbToHex(
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b))
    ));
    if (lumModMatch) l = l * parseInt(lumModMatch[1]) / 100000;
    if (lumOffMatch) l = l + parseInt(lumOffMatch[1]) / 100000;
    l = Math.max(0, Math.min(1, l));
    const modded = hslToHex(h, s, l);
    [r, g, b] = hexToRgb(modded);
  }

  // 4. SatMod — saturation: new_S = S * val/100000
  const satModMatch = modXml.match(/<a:satMod\s+val="(\d+)"/);
  if (satModMatch) {
    let [h, s, l] = hexToHsl(rgbToHex(
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b))
    ));
    s = Math.max(0, Math.min(1, s * parseInt(satModMatch[1]) / 100000));
    const modded = hslToHex(h, s, l);
    [r, g, b] = hexToRgb(modded);
  }

  return rgbToHex(
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b))
  );
}

/** Collect every unique color hex from the entire presentation.
 *  Scans srgbClr (with modifiers) AND resolves schemeClr (with modifiers) to actual hex.
 *  Only scans theme1.xml (the slide theme) — excludes theme2+ which are notes/handout themes. */
async function collectAllColors(zip, themeColors) {
  const colors = new Set();
  const xmlPaths = Object.keys(zip.files).filter(f =>
    f.endsWith('.xml') && (
      f.startsWith('ppt/slides/') ||
      f.startsWith('ppt/slideMasters/') ||
      f.startsWith('ppt/slideLayouts/') ||
      f === 'ppt/theme/theme1.xml' ||
      f.startsWith('ppt/diagrams/') ||
      f.startsWith('ppt/charts/')
    )
  );
  // Regex matches both self-closing and content forms:
  //   <a:srgbClr val="XXXXXX"/>  or  <a:srgbClr val="XXXXXX">...</a:srgbClr>
  const srgbRe = /<a:srgbClr\s+val="([A-Fa-f0-9]{6})"([^>]*?)(?:\/>|>([\s\S]*?)<\/a:srgbClr>)/gi;
  const schemeRe = /<a:schemeClr\s+val="([^"]+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/a:schemeClr>)/gi;
  const sysRe = /<a:sysClr[^>]*lastClr="([A-Fa-f0-9]{6})"/gi;

  for (const path of xmlPaths) {
    const xml = await zip.files[path].async('string');

    // Direct srgbClr values (with optional modifiers)
    for (const m of xml.matchAll(srgbRe)) {
      let hex = m[1].toUpperCase();
      if (m[3]) hex = applyColorModifiers(hex, m[3]);
      colors.add(hex);
    }

    // Resolve schemeClr references (with optional modifiers)
    if (themeColors) {
      for (const m of xml.matchAll(schemeRe)) {
        const baseHex = themeColors[resolveSchemeSlot(m[1])];
        if (!baseHex) continue;
        let hex = baseHex.toUpperCase();
        if (m[3]) hex = applyColorModifiers(hex, m[3]);
        colors.add(hex);
      }
    }

    // System colors (e.g. windowText, window) — use lastClr as resolved value
    for (const m of xml.matchAll(sysRe)) {
      colors.add(m[1].toUpperCase());
    }
  }
  return colors;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TRANSFORM
// ═══════════════════════════════════════════════════════════════════════════

export async function transformPptx(sourceBuf, targetBuf, onProgress = () => {}, { keepSourcePositions = false, includeExtraColors = false, headerSizePt = 28, contentArea = null, colorGuidance = '', callAI = null, aiStructure = true, aiColors = true, enableResize = false } = {}) {
  onProgress({ phase: 'parsing', message: 'Parsing presentations...' });

  const srcZip = await JSZip.loadAsync(sourceBuf);
  const tgtZip = await JSZip.loadAsync(targetBuf);

  // ── 1. Parse themes ─────────────────────────────────────────────────────────
  const srcThemeXml = await readFileStr(srcZip, 'ppt/theme/theme1.xml');
  const tgtThemeXml = await readFileStr(tgtZip, 'ppt/theme/theme1.xml');
  const srcColors = parseThemeColors(srcThemeXml);
  const tgtColors = parseThemeColors(tgtThemeXml);

  // Collect ALL colors from source & target (srgbClr + resolved schemeClr)
  const srcHexValues = await collectAllColors(srcZip, srcColors);
  const tgtHexValues = await collectAllColors(tgtZip, tgtColors);

  // ── 2. Scan layouts (needed for unified context) ──────────────────────────
  onProgress({ phase: 'parsing', message: 'Analyzing layouts...' });
  const srcLayouts = await scanLayouts(srcZip);
  const tgtLayouts = await scanLayouts(tgtZip);

  // ── 3. Unified AI analysis — single GPT call for colors + structure ───────
  // Controlled by aiStructure / aiColors checkboxes. When at least one is on
  // and callAI is available, we make the unified call and selectively use output.
  let structureAnalysis = null;
  let aiColorMap = {};
  let contrastPairsData = null;
  let unifiedContextText = null;
  const wantAI = callAI && (aiStructure || aiColors);
  if (wantAI) {
    const label = aiStructure && aiColors ? 'colors + structure'
      : aiStructure ? 'structure only' : 'colors only';
    onProgress({ phase: 'parsing', message: `Analyzing slides (${label})...` });
    const extracted = await extractUnifiedContext(srcZip, srcColors, tgtColors, tgtLayouts, 30);
    if (extracted?.text) {
      contrastPairsData = extracted.contrastPairs;
      unifiedContextText = extracted.text;
      const aiResult = await analyzeAndMapWithAI(extracted.text, srcColors, tgtColors, callAI);
      if (aiResult) {
        // Only use the parts the user opted into
        if (aiColors) {
          aiColorMap = aiResult.colorMap || {};
          console.log('[Transform] AI color map:', Object.keys(aiColorMap).length, 'entries');
        }
        if (aiStructure) {
          structureAnalysis = {
            roleMap: aiResult.roleMap || {},
            shapeRoles: aiResult.shapeRoles || {},
          };
          console.log('[Transform] AI structure: roleMap=' + Object.keys(structureAnalysis.roleMap).length +
            ', shapeRoles=' + Object.keys(structureAnalysis.shapeRoles).length);
        }
        if (!aiColors) console.log('[Transform] AI colors OFF — using proximity only');
        if (!aiStructure) console.log('[Transform] AI structure OFF — using placeholder types only');
      }
    }
  } else {
    console.log('[Transform] AI OFF — fully mechanical mode');
  }

  // ── 4. Build color map: AI-pinned + proximity for gaps ────────────────────
  let colorMap = buildColorMap(srcColors, tgtColors, srcHexValues, tgtHexValues, { includeExtraColors, pinnedMap: aiColorMap });
  console.log('[Transform] Color map:', Object.keys(colorMap).length, 'entries (AI:', Object.keys(aiColorMap).length, '+ proximity:', Object.keys(colorMap).length - Object.keys(aiColorMap).length, ')');

  // ── 5. Refine with user guidance (optional, 2nd GPT call) ─────────────────
  if (callAI && aiColors && colorGuidance && colorGuidance.trim()) {
    onProgress({ phase: 'parsing', message: 'Applying color guidance...' });
    colorMap = await refineColorMapWithAI(colorMap, srcColors, tgtColors, colorGuidance, callAI, unifiedContextText, contrastPairsData);
    console.log('[Transform] User-guided color map:', Object.keys(colorMap).length, 'entries');
  }

  // ── 3. Clone target template as output shell ───────────────────────────────
  const outZip = await JSZip.loadAsync(targetBuf);
  removeTargetSlides(outZip);

  const existingMediaNames = new Set(
    Object.keys(outZip.files).filter(f => f.startsWith('ppt/media/'))
  );
  const mediaCounter = { value: 1 };

  // ── 4. Discover source slides ──────────────────────────────────────────────
  const srcSlideFiles = Object.keys(srcZip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1]) - parseInt(b.match(/slide(\d+)/)[1]));

  const slideCount = srcSlideFiles.length;
  console.log('[Transform] Source slides:', slideCount);

  // ── 5. Process each source slide ───────────────────────────────────────────
  for (let i = 0; i < slideCount; i++) {
    const outSlideNum = i + 1;
    const srcSlideIdx = parseInt(srcSlideFiles[i].match(/slide(\d+)/)[1]);

    onProgress({
      phase: 'transforming',
      message: `Processing slide ${outSlideNum} of ${slideCount}...`,
      current: outSlideNum,
      total: slideCount,
    });

    // Read source slide XML (preserving ALL namespaces, structure, body shapes)
    const srcSlideXml = await srcZip.files[srcSlideFiles[i]].async('string');

    // Read source rels
    const srcRelsPath = `ppt/slides/_rels/slide${srcSlideIdx}.xml.rels`;
    const srcRelsXml = srcZip.files[srcRelsPath]
      ? await srcZip.files[srcRelsPath].async('string')
      : '';

    // Pick best target layout by scoring placeholder overlap
    const srcLayoutIdx = getLayoutIndexFromRels(srcRelsXml);
    const srcLayoutEntry = srcLayoutIdx ? srcLayouts.byIndex[srcLayoutIdx] : null;
    const srcLayoutType = srcLayoutEntry ? srcLayoutEntry.type : 'content';
    const tgtLayoutEntry = findBestTargetLayout(srcSlideXml, srcLayoutType, tgtLayouts);
    const tgtLayoutIdx = tgtLayoutEntry ? tgtLayoutEntry.index : 2;

    // Extract placeholder text → inject into target layout placeholders → remap colors
    const outSlideXml = transformSlideXml(srcSlideXml, tgtLayoutEntry, colorMap, tgtColors, srcColors, keepSourcePositions, { headerSizePt, contentArea, structureAnalysis, enableResize });

    // Process rels: copy media, remap layout reference
    const outRelsXml = await processSlideRels({
      sourceRelsXml: srcRelsXml,
      sourceZip: srcZip,
      outputZip: outZip,
      srcSlideIdx,
      outSlideNum,
      targetLayoutIdx: tgtLayoutIdx,
      existingMediaNames,
      mediaCounter,
    });

    // Write to output
    outZip.file(`ppt/slides/slide${outSlideNum}.xml`, outSlideXml);
    outZip.file(`ppt/slides/_rels/slide${outSlideNum}.xml.rels`, outRelsXml);

    console.log(`[Transform] Slide ${outSlideNum}: ${srcLayoutType} → layout${tgtLayoutIdx}`);
  }

  // ── 6. Update presentation structure ───────────────────────────────────────
  onProgress({ phase: 'assembling', message: 'Updating presentation structure...' });
  await updatePresentationXml(outZip, slideCount, srcZip);
  await updatePresentationRels(outZip, slideCount);
  await updateContentTypes(outZip, slideCount, srcZip);

  // ── 7. Generate output ─────────────────────────────────────────────────────
  onProgress({ phase: 'generating', message: 'Generating PPTX...' });
  const result = await outZip.generateAsync({ type: 'arraybuffer' });
  console.log('[Transform] Done.', result.byteLength, 'bytes,', slideCount, 'slides');

  onProgress({ phase: 'complete', message: 'Transform complete!' });

  return {
    buffer: result,
    metadata: { slideCount, sourceColors: srcColors, targetColors: tgtColors, colorMap },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS (for UI preview)
// ═══════════════════════════════════════════════════════════════════════════

export async function analyzePptx(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const themeXml = await readFileStr(zip, 'ppt/theme/theme1.xml');
  const colors = parseThemeColors(themeXml);
  const fonts = parseThemeFonts(themeXml);

  const slideFiles = Object.keys(zip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f));

  const layoutFiles = Object.keys(zip.files)
    .filter(f => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(f));

  const layouts = [];
  for (const path of layoutFiles) {
    const idx = parseInt(path.match(/slideLayout(\d+)/)[1]);
    const xml = await zip.files[path].async('string');
    const nameMatch = xml.match(/<p:cSld\s+name="([^"]+)"/);
    const typeMatch = xml.match(/<p:sldLayout[^>]*type="([^"]+)"/);
    const phs = parsePlaceholders(xml);
    layouts.push({
      index: idx,
      name: nameMatch ? nameMatch[1] : `Layout ${idx}`,
      type: typeMatch ? typeMatch[1] : 'unknown',
      placeholderTypes: phs.map(p => p.phType),
    });
  }

  // Collect ALL colors (srgbClr + resolved schemeClr with modifiers) for preview
  const hexValues = await collectAllColors(zip, colors);

  // Generate the PowerPoint-style theme color grid (10 cols × 5 rows)
  const themeGrid = generateThemeGrid(colors);

  return { slideCount: slideFiles.length, layoutCount: layouts.length, layouts, colors, fonts, hexValues: [...hexValues], themeGrid };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function readFileStr(zip, path) {
  return zip.files[path] ? await zip.files[path].async('string') : '';
}
