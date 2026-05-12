// PPTX Export Service — Single AI Path + Self-Healing Retry Loop
//
// Architecture:
//   1. For each slide, ask the AI to translate HTML+CSS to PptxGenJS code
//   2. Parse & execute the code against a sandboxed PptxGenJS instance
//   3. Validate: did it produce a slide with content?
//   4. If not, feed the error back to the AI and retry (up to MAX_RETRIES)
//   5. If all retries fail, fall back to basic DOM text extraction

import PptxGenJS from 'pptxgenjs';
import {
  COLORS,
  addFooter,
  addSourceNote,
  addSectionTracker,
  setFooterBranding,
  setPptxFontFace,
  setTemplatePositions,
} from './pptxRenderers';
import {
  applyProfileChromeToGenerated,
  applyTemplateToGenerated,
  loadTemplateFromStorage,
  downloadArrayBuffer,
  sanitizePptxBufferForPowerPoint,
} from './pptxTemplateService';
import { extractRelevantCSS } from './aiService';
import { resolveCustomProperties } from './ai/cssExtraction';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { decideTemplateUsage } from './templateMatcher';
import { DEFAULT_THEME } from '../utils/themeUtils';
import { buildClientProfileContext, getActiveClientProfile, getClientProfileFooterBranding } from '../utils/clientDesignProfiles.js';
import { parsePptxHints, stripPptxHintComments, formatHintsForPrompt } from './pptxHints';
import { authFetch } from './authFetch.js';
import { applyPromptOverride, recordPromptPayload } from './ai/promptOverrides.js';
import { omitChatCompletionsTemperature } from './ai/models.js';
import { injectRasterizedSvgIcons } from './pptxSvgIconInjector.js';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3; // 4 total attempts per slide
const DEFAULT_PPTX_MODEL = 'pwc:bedrock.anthropic.claude-opus-4-7';
const PROFILE_PPTX_FONT_FACE = {
  stc: 'STC Forward',
  pif: 'Fund Light',
};

async function writeSanitizedPptxFile(pptx, filename, label = 'direct export') {
  const buf = await pptx.write({ outputType: 'arraybuffer' });
  try {
    const sanitized = await sanitizePptxBufferForPowerPoint(buf, label);
    downloadArrayBuffer(sanitized, filename);
  } catch (error) {
    console.error('[PPTX] PowerPoint sanitation failed; downloading original buffer:', error);
    downloadArrayBuffer(buf, filename);
  }
}

function getProfilePptxFontFace(profile) {
  return PROFILE_PPTX_FONT_FACE[profile?.id] || null;
}

function getPptxLayoutForProfile(profile) {
  const canvas = profile?.layoutContract?.canvas;
  if (profile?.id && profile.id !== 'strategy' && canvas?.widthIn && canvas?.heightIn) {
    return { width: canvas.widthIn, height: canvas.heightIn };
  }
  return { width: 13.333, height: 7.5 };
}

function applyPptxLayout(pptx, profile) {
  const layout = getPptxLayoutForProfile(profile);
  pptx.defineLayout({ name: 'CUSTOM', width: layout.width, height: layout.height });
  pptx.layout = 'CUSTOM';
}

function getProfileTextColor(profile, token, fallback) {
  const value = profile?.theme?.colors?.[token];
  return value ? value.replace('#', '').toUpperCase() : fallback;
}

function resolvePptxPositionsForProfile(profile = null, extractedPositions = null) {
  const profilePositions = profile?.chrome?.positions || null;
  let resolved = null;
  if (profile?.id && profile.id !== 'strategy' && profilePositions) {
    resolved = {
      ...(extractedPositions || {}),
      ...(profilePositions || {}),
    };
  } else {
    resolved = extractedPositions || profilePositions || null;
  }
  if (profile?.id && profile.id !== 'strategy' && resolved) {
    console.log('[PPTX] Resolved %s profile positions: %s', profile.name || profile.id, JSON.stringify({
      title: resolved.title,
      subtitle: resolved.subtitle,
      body: resolved.body,
      footer: resolved.footer,
      slideNum: resolved.slideNum,
      sectionTracker: resolved.sectionTracker,
    }));
  }
  return resolved;
}

function normalizePptxSettingsForProfile(settings = {}, profile = null, templatePositions = null) {
  const next = {
    ...(settings || {}),
  };
  if (profile?.id && profile.id !== 'strategy') {
    next.theme = profile.theme || next.theme;
    next.footerBranding = getClientProfileFooterBranding(next, '');
  } else if (!next.theme && profile?.theme) {
    next.theme = profile.theme;
  }
  if (templatePositions) next.templatePositions = templatePositions;
  return next;
}

function getProfilePptxTypographyGuidance(profile) {
  if (profile?.id === 'pif') {
    return '- PIF typography: use Fund Light for titles/body and Fund Regular only for page numbers or limited emphasis. Content title is 11pt in PPTX, dense matrix/detail text may be 8-10pt, and footer/source/page chrome may be 7-8pt. There is no broad subtitle band on standard PIF body slides.\n';
  }
  if (profile?.id !== 'stc') return '';
  return '- STC typography: use title 24pt regular, subtitle 18pt regular, body 12pt regular, local labels/card titles 500-equivalent only when bold is needed, and footer/source/page numbers 8pt regular.\n- For STC Forward, avoid bold:true on normal body leads, subtitles, card titles, stage titles, and labels unless the CSS explicitly requires strong emphasis.\n';
}

function getProfilePptxSystemGuidance(profile) {
  if (profile?.id === 'pif') {
    return `

ACTIVE CLIENT PROFILE OVERRIDE -- PIF:
- Use the verified PIF master shell, not generic Strategy& geometry.
- PIF PPTX canvas is 10 x 5.625 inches. HTML 960 x 540 px maps with px * 10 / 960.
- PIF colors: title/rules/page block C3984D/C4995B, dark green 00332A, PIF green 005C4D, mint 02CC99, white/light-neutral surfaces, gray 7F7F7F.
- If you define a c palette, use: main:'C3984D', secondary:'00332A', accent:'005C4D', gold:'C3984D', mint:'02CC99', surface:'FFFCF2', surfaceAlt:'F4EBDD', border:'D9C6A3', meta:'7F7F7F'.
- Use Fund Light for every normal text box; use Fund Regular only for page numbers or limited emphasis. Do not use Arial, Georgia, Calibri, Aptos, STC Forward, or emoji.
- Follow the LDC master geometry: title x=1.375 y=0.281 w=6.219 h=0.260, body x=0.365 y=0.844 w=9.281 h=4.135, footer/source x=0.365 y=5.271, page block x=9.271 y=5.271.
- Do not add a broad subtitle under the title. If a lens is needed, use a compact top-right label or in-exhibit label.
- Keep footer/source text blank unless the user explicitly provides it. Do not surface National Development Division labels, Arabic labels, review notes, scratch pages, or hidden think-cell artifacts.
`;
  }
  if (profile?.id !== 'stc') return '';
  return `

ACTIVE CLIENT PROFILE OVERRIDE -- STC:
- Ignore the Strategy& example colors as visual colors. Use them only as structural examples.
- STC colors: title/main #4F008C, body #1D252D, subtitle/kicker #FF375E, tracker text #9E21FF, tracker marker #EDD5FF, pale surface #FBF8FE, alternate surface #EDD5FF, border #DBB8F3, muted #515360.
- If you define a c palette, use: main:'4F008C', secondary:'1D252D', red:'FF375E', maroon:'4F008C', zone1:'FBF8FE', zone2:'EDD5FF', rose:'EDD5FF', tracker:'9E21FF', trackerSoft:'EDD5FF', meta:'515360', coal:'1D252D', border:'DBB8F3'.
- Do not emit Strategy& maroon/red values such as 8E1E1E or A32020 for STC slides.
- Use STC Forward for every text box. Titles are 24pt regular, subtitles are 18pt regular, source/page chrome is 8pt regular.
- Do not add section tracker chrome in generated code. Export adds the active slide's text-only tracker once after rendering, using STC reference geometry that stays clear of the logo and omits arrow/chevron markers.
- Avoid bold:true for STC body leads, labels, stage titles, and card titles unless the CSS explicitly calls for strong emphasis.
- Do not use emoji or decorative pictographic symbols in STC PPTX output; replace them with plain text labels.
`;
}

function shouldUseTemplateRendererForProfile(profile, decision) {
  if (!decision?.pptxRendererCode) return false;
  if (!profile || profile.id === 'strategy') return true;
  return decision.compatibleProfiles?.includes?.(profile.id) || decision.profileId === profile.id;
}

function buildProfileReferenceExampleCode(profile, fallbackCode) {
  const positions = profile?.chrome?.positions;
  if (!profile || profile.id === 'strategy' || !positions?.title || !positions?.body) return fallbackCode;

  const fontFace = getProfilePptxFontFace(profile) || profile.theme?.fonts?.body?.replace(/["']/g, '') || 'Arial';
  const colors = {
    main: getProfileTextColor(profile, 'heading', '111111'),
    secondary: getProfileTextColor(profile, 'body', '222222'),
    accent: getProfileTextColor(profile, 'accent', '8E1E1E'),
    subtitle: getProfileTextColor(profile, 'kicker', getProfileTextColor(profile, 'danger', 'A32020')),
    surface: getProfileTextColor(profile, 'surface', 'F7F9FB'),
    surfaceAlt: getProfileTextColor(profile, 'surfaceAlt', 'F8E3E3'),
    border: getProfileTextColor(profile, 'border', 'E6E9EE'),
  };
  const title = positions.title;
  const subtitle = positions.subtitle || title;
  const body = positions.body;
  const cardGap = 0.18;
  const cardW = Number(((body.w - (cardGap * 2)) / 3).toFixed(3));
  const cardH = Number((body.h - 0.08).toFixed(3));
  const cardY = Number((body.y + 0.04).toFixed(3));

  return `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = ${JSON.stringify(colors)};
  slide.addText("Client-profile title uses the exact master band", {x:${title.x}, y:${title.y}, w:${title.w}, h:${title.h}, fontFace:'${fontFace}', fontSize:${title.font?.fontSize ?? 24}, bold:${title.font?.bold ? 'true' : 'false'}, color:c.main, valign:'top'});
  slide.addText("Client profile subtitle", {x:${subtitle.x}, y:${subtitle.y}, w:${subtitle.w}, h:${subtitle.h}, fontFace:'${fontFace}', fontSize:${subtitle.font?.fontSize ?? 18}, bold:${subtitle.font?.bold ? 'true' : 'false'}, color:c.subtitle, valign:'top'});
  const body = {x:${body.x}, y:${body.y}, w:${body.w}, h:${body.h}};
  const items = [
    {num:'01', title:'First module', body:'Keep every body object inside the profile body rectangle.'},
    {num:'02', title:'Second module', body:'Use compact spacing and profile colors instead of generic example geometry.'},
    {num:'03', title:'Third module', body:'If content does not fit, reduce the number of modules or split slides.'}
  ];
  items.forEach((d, i) => {
    const x = Number((body.x + i * (${cardW} + ${cardGap})).toFixed(3));
    slide.addShape('rect', {x, y:${cardY}, w:${cardW}, h:${cardH}, fill:{color:c.surface}, line:{color:c.border, width:0.75}});
    slide.addShape('rect', {x, y:${cardY}, w:${cardW}, h:0.18, fill:{color:c.accent}, line:{color:c.accent, transparency:100}});
    slide.addText(d.num, {x:x+0.16, y:${cardY}+0.35, w:0.65, h:0.35, fontFace:'${fontFace}', fontSize:18, bold:true, color:c.accent});
    slide.addText(d.title, {x:x+0.9, y:${cardY}+0.36, w:${Number((cardW - 1.06).toFixed(3))}, h:0.32, fontFace:'${fontFace}', fontSize:14, bold:false, color:c.main});
    slide.addText(d.body, {x:x+0.16, y:${cardY}+0.86, w:${Number((cardW - 0.32).toFixed(3))}, h:${Number((cardH - 1.05).toFixed(3))}, fontFace:'${fontFace}', fontSize:12, color:c.secondary, valign:'top', breakLine:false});
  });
  addFooter(slide, slideNum, totalSlides);
}`;
}

function enforcePptxFontFaceForProfile(codeString, profile) {
  const fontFace = getProfilePptxFontFace(profile);
  if (!fontFace || !codeString) return codeString;
  return String(codeString).replace(
    /fontFace\s*:\s*(['"`])[^'"`]+?\1/g,
    `fontFace:'${fontFace}'`
  );
}

function enforcePptxColorsForProfile(codeString, profile) {
  if (!codeString) return codeString;
  let replacements = null;
  if (profile?.id === 'pif') {
    replacements = new Map([
      ['111111', '00332A'],
      ['222222', '00332A'],
      ['A32020', 'C3984D'],
      ['8E1E1E', '005C4D'],
      ['4F008C', '005C4D'],
      ['FF375E', 'C3984D'],
      ['F7F9FB', 'FFFCF2'],
      ['EEF2F6', 'F4EBDD'],
      ['F8E3E3', 'F4EBDD'],
      ['4A4F57', '7F7F7F'],
      ['4B4F55', '00332A'],
      ['E6E9EE', 'D9C6A3'],
      ['DBB8F3', 'D9C6A3'],
    ]);
  } else if (profile?.id === 'stc') {
    replacements = new Map([
      ['111111', '4F008C'],
      ['222222', '1D252D'],
      ['A32020', 'FF375E'],
      ['8E1E1E', '4F008C'],
      ['F7F9FB', 'FBF8FE'],
      ['EEF2F6', 'EDD5FF'],
      ['F8E3E3', 'EDD5FF'],
      ['4A4F57', '515360'],
      ['4B4F55', '1D252D'],
      ['E6E9EE', 'DBB8F3'],
    ]);
  }
  if (!replacements) return codeString;
  let next = String(codeString);
  for (const [from, to] of replacements) {
    next = next.replace(new RegExp(from, 'gi'), to);
  }
  return next;
}

function sanitizePptxTextForProfile(codeString, profile) {
  if (!profile || profile.id === 'strategy' || !codeString) return codeString;
  let next = String(codeString)
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/([`'"])\s+(\1)/g, '$1$2');
  if (profile.id === 'pif') {
    next = next
      .replace(/\bNational Development Division\b/gi, '')
      .replace(/\bNATIONAL DEVELOPMENT DIVISION\b/g, '');
  }
  return next;
}

function enforcePptxProfileCode(codeString, profile) {
  return sanitizePptxTextForProfile(
    enforcePptxColorsForProfile(
      enforcePptxFontFaceForProfile(codeString, profile),
      profile
    ),
    profile
  );
}

function canUseCachedPptxCodeForProfile(profile) {
  return !profile || profile.id === 'strategy';
}

/**
 * Convert a theme object into the PPTX color palette snippet and hint.
 * Strips '#' from hex values since PptxGenJS uses bare hex strings.
 */
export function themeToPptxPalette(theme) {
  const t = theme || DEFAULT_THEME;
  const c = t.colors || DEFAULT_THEME.colors;
  const strip = (hex) => (hex || '').replace('#', '');

  const colorCode = `const c = {main:'${strip(c.heading)}',secondary:'${strip(c.body)}',accent:'${strip(c.accent)}',accentHover:'${strip(c.accentHover)}',accentSoft:'${strip(c.accentSoft)}',onAccent:'${strip(c.onAccent)}',muted:'${strip(c.muted)}',page:'${strip(c.page)}',surface:'${strip(c.surface)}',surfaceAlt:'${strip(c.surfaceAlt)}',border:'${strip(c.border)}',success:'${strip(c.success)}',danger:'${strip(c.danger)}',warning:'${strip(c.warning)}'};`;

  const hint = `THEME: ${t.name || 'Custom'} - Use accent (${c.accent}) for emphasis, heading (${c.heading}) for titles, body (${c.body}) for text.`;

  const resolvedVars = `--heading = ${c.heading}, --body = ${c.body}, --muted = ${c.muted}
--accent = ${c.accent}, --accent-hover = ${c.accentHover}, --accent-soft = ${c.accentSoft}, --on-accent = ${c.onAccent}
--page = ${c.page}, --surface = ${c.surface}, --surface-alt = ${c.surfaceAlt}, --border = ${c.border}
--success = ${c.success}, --danger = ${c.danger}, --warning = ${c.warning}`;

  return { colorCode, hint, resolvedVars, colors: {
    main: c.heading, secondary: c.body, accent: c.accent,
    cardBg: c.surface, border: c.border,
  }};
}

// ── Gold-standard translation examples (kept from old code) ─────────────────

const COMPLETE_TRANSLATION_EXAMPLE = {
  html: `<div class="slide master-standard">
  <h1 class="title">Three strategic pillars drive enterprise AI adoption at scale</h1>
  <h2 class="subtitle">Strategic Framework</h2>
  <div class="frame"><div class="card-row"><div class="card"><div class="card-header-row"><div class="card-icon-circle">🎯</div><div class="card-num">01</div></div><h3>Foundation Layer</h3><p>Establish robust data infrastructure with unified governance protocols across business units.</p><p>Modern cloud architecture enables seamless integration and real-time analytics.</p><div class="impact-box">Timeline: 6-12 months</div></div><div class="card"><div class="card-header-row"><div class="card-icon-circle">⚙️</div><div class="card-num">02</div></div><h3>Capability Building</h3><p>Deploy AI-powered tools across customer service, operations, and strategic planning functions.</p><p>Center of Excellence model accelerates knowledge transfer and best practices.</p><div class="impact-box">Timeline: 12-18 months</div></div><div class="card"><div class="card-header-row"><div class="card-icon-circle">🚀</div><div class="card-num">03</div></div><h3>Scale & Optimize</h3><p>Enterprise-wide rollout with continuous improvement loops and performance benchmarking.</p><p>Measure ROI through productivity gains, cost savings, and revenue impact.</p><div class="impact-box">Timeline: 18-24 months</div></div></div></div>
  <footer class="footer"><span>Strategy&</span><span>2</span></footer>
</div>`,
  code: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',rose:'F8E3E3',meta:'4A4F57',coal:'4B4F55',border:'E6E9EE'};
  slide.addText("Three strategic pillars drive enterprise AI adoption at scale", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("Strategic Framework", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const items = [
    {icon:'🎯', num:'01', title:'Foundation Layer', body:'Establish robust data infrastructure with unified governance protocols across business units.\\n\\nModern cloud architecture enables seamless integration and real-time analytics.', impact:'Timeline: 6-12 months'},
    {icon:'⚙️', num:'02', title:'Capability Building', body:'Deploy AI-powered tools across customer service, operations, and strategic planning functions.\\n\\nCenter of Excellence model accelerates knowledge transfer and best practices.', impact:'Timeline: 12-18 months'},
    {icon:'🚀', num:'03', title:'Scale & Optimize', body:'Enterprise-wide rollout with continuous improvement loops and performance benchmarking.\\n\\nMeasure ROI through productivity gains, cost savings, and revenue impact.', impact:'Timeline: 18-24 months'}
  ];
  const startX = 0.48, cardW = 3.95, cardH = 4.90, gap = 0.25, cardY = 1.90;
  items.forEach((d, i) => {
    const xPos = startX + (i * (cardW + gap));
    slide.addShape('roundRect', {x:xPos, y:cardY, w:cardW, h:cardH, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.05});
    slide.addShape('rect', {x:xPos, y:cardY, w:cardW, h:0.08, fill:{color:c.maroon}});
    slide.addShape('ellipse', {x:xPos + 0.25, y:cardY + 0.25, w:0.5, h:0.5, fill:{color:c.rose}});
    slide.addText(d.icon, {x:xPos + 0.25, y:cardY + 0.25, w:0.5, h:0.5, fontSize:16, color:c.maroon, align:'center', bold:true});
    slide.addText(d.num, {x:xPos + cardW - 1.25, y:cardY + 0.25, w:1, h:0.5, fontFace:'Georgia', fontSize:32, color:c.maroon, bold:true, align:'right'});
    slide.addText(d.title, {x:xPos + 0.25, y:cardY + 1.0, w:cardW - 0.5, h:0.4, fontFace:'Arial', fontSize:16, color:c.main, bold:true});
    slide.addText(d.body, {x:xPos + 0.25, y:cardY + 1.5, w:cardW - 0.5, h:2.5, fontFace:'Arial', fontSize:12, color:c.secondary, valign:'top', lineSpacing:18});
    slide.addShape('line', {x:xPos + 0.25, y:cardY + 4.3, w:cardW - 0.5, h:0, line:{color:'DCDCDC', width:1}});
    slide.addText(d.impact, {x:xPos + 0.25, y:cardY + 4.4, w:cardW - 0.5, h:0.4, fontFace:'Arial', fontSize:11, color:c.coal, bold:true});
  });
  addFooter(slide, slideNum, totalSlides);
}`
};

const KPI_TRANSLATION_EXAMPLE = {
  html: `<div class="slide"><h1 class="title">AI implementation delivers measurable returns within first year</h1><h2 class="subtitle">Performance Metrics</h2><div class="frame"><div class="two-col"><div class="col-left"><div class="kpi-block"><div class="kpi-value">47%</div><div class="kpi-label">Reduction in manual processing time</div></div><div class="kpi-block"><div class="kpi-value">3.2x</div><div class="kpi-label">Return on AI investment (Year 1)</div></div><div class="kpi-block"><div class="kpi-value">$12M</div><div class="kpi-label">Annual operational cost savings</div></div></div><div class="col-right"><div class="detail-item"><h4>Process Automation</h4><p>Intelligent document processing and workflow automation reduced manual data entry by 65%.</p></div><div class="detail-item"><h4>Customer Experience</h4><p>AI-powered chatbots handle 40% of customer inquiries with 92% satisfaction rate.</p></div><div class="detail-item"><h4>Predictive Analytics</h4><p>Machine learning models improved demand forecasting accuracy by 35%.</p></div></div></div></div></div>`,
  code: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE'};
  slide.addText("AI implementation delivers measurable returns within first year", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("Performance Metrics", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const startY = 1.90, kpiX = 0.48, kpiW = 5.5, detailX = 6.3, detailW = 6.5;
  const kpis = [{value:'47%', label:'Reduction in manual processing time'},{value:'3.2x', label:'Return on AI investment (Year 1)'},{value:'$12M', label:'Annual operational cost savings'}];
  kpis.forEach((kpi, i) => {
    const yPos = startY + (i * 1.55);
    slide.addShape('roundRect', {x:kpiX, y:yPos, w:kpiW, h:1.4, fill:{color:c.zone1}, rectRadius:0.05});
    slide.addShape('rect', {x:kpiX, y:yPos, w:0.06, h:1.4, fill:{color:c.maroon}});
    slide.addText(kpi.value, {x:kpiX + 0.3, y:yPos + 0.15, w:2.5, h:0.7, fontFace:'Georgia', fontSize:42, color:c.maroon, bold:true, valign:'middle'});
    slide.addText(kpi.label, {x:kpiX + 0.3, y:yPos + 0.85, w:kpiW - 0.5, h:0.4, fontFace:'Arial', fontSize:13, color:c.meta});
  });
  const details = [{title:'Process Automation', text:'Intelligent document processing and workflow automation reduced manual data entry by 65%.'},{title:'Customer Experience', text:'AI-powered chatbots handle 40% of customer inquiries with 92% satisfaction rate.'},{title:'Predictive Analytics', text:'Machine learning models improved demand forecasting accuracy by 35%.'}];
  details.forEach((detail, i) => {
    const yPos = startY + (i * 1.55);
    slide.addText(detail.title, {x:detailX, y:yPos, w:detailW, h:0.35, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
    slide.addText(detail.text, {x:detailX, y:yPos + 0.4, w:detailW, h:0.95, fontFace:'Arial', fontSize:12, color:c.secondary, valign:'top', lineSpacing:17});
    if (i < details.length - 1) slide.addShape('line', {x:detailX, y:yPos + 1.45, w:detailW, h:0, line:{color:c.border, width:1}});
  });
  addFooter(slide, slideNum, totalSlides);
}`
};

const COVER_TRANSLATION_EXAMPLE = {
  html: `<div class="slide cover-slide"><div class="frame"><div class="cover-category">DIGITAL TRANSFORMATION</div><div class="cover-title">Enterprise AI Strategy Framework for Sustainable Growth</div></div><div class="cover-branding">Strategy&</div><div class="cover-date">December 2025</div></div>`,
  code: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide({ masterName: 'BLANK_SLIDE' });
  slide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});
  slide.addText('DIGITAL TRANSFORMATION', {x: 0.48, y: 1.94, w: 12.36, h: 0.5, fontFace: 'Arial', fontSize: 18, color: 'A32020', bold: true, charSpacing: 1.5});
  slide.addText('Enterprise AI Strategy Framework for Sustainable Growth', {x: 0.48, y: 2.64, w: 9.7, h: 2.0, fontFace: 'Georgia', fontSize: 42, color: '111111', valign: 'top', lineSpacingMultiple: 1.15});
  // Cover: render branding + date directly, no addFooter
  slide.addText('Strategy&', {x: 0.48, y: 6.50, w: 4.0, h: 0.3, fontFace: 'Arial', fontSize: 16, bold: true, color: '4A4F57'});
  slide.addText('December 2025', {x: 9.5, y: 6.50, w: 3.3, h: 0.3, fontFace: 'Arial', fontSize: 13, color: '4A4F57', align: 'right'});
}`
};

// Re-exports for consumer modules
export { COMPLETE_TRANSLATION_EXAMPLE, KPI_TRANSLATION_EXAMPLE, COVER_TRANSLATION_EXAMPLE };


export const DEFAULT_PPTX_SYSTEM_PROMPT = `You convert HTML slides to PptxGenJS code by learning from input/output examples.

STANDARD COLORS (use these EXACT hex values):
const c = {main:'111111', secondary:'222222', red:'A32020', maroon:'8E1E1E', zone1:'F7F9FB', rose:'F8E3E3', meta:'4A4F57', coal:'4B4F55', border:'E6E9EE'};

STANDARD FONTS:
- Titles: Georgia 28pt, color main
- Subtitles: Arial 18pt bold, color red
- Body text, bullets, descriptions, and table cells: Arial 12-14pt, color secondary
- Section titles, pillar titles, and card titles: Arial 14-16pt bold, color main
- Compact tags, chips, badges, tracker labels, and short in-box labels: Arial 8pt minimum
- Chart axes, legends, and captions: Arial 10pt minimum
- Strategy& footer/source/page-number chrome follows the master template at 7.5pt; use addFooter/addSourceNote helpers rather than manually drawing footer chrome.
- Never output fontSize below 10 for normal text, below 8 for compact tags/trackers, or below 7.5 for Strategy& footer/source/page chrome. If text does not fit, reduce copy or split boxes; do not use tiny text.

DEFAULT POSITIONS (may be overridden by template positions in the user prompt):
- Title: x:0.48, y:0.42, w:12.36
- Subtitle: x:0.48, y:1.40, w:12.36
- Content area starts at y:1.90
- Footer: y:7.05

YOUR TASK:
1. Extract ALL text from the HTML — never use placeholder text
2. Compute positions from the CSS (position/left/top/width/height, grid/flex layout, padding, gaps)
3. Convert px to PptxGenJS inches: px * 13.333 / 960 (e.g., x=28 → 0.39in, w=904 → 12.56in)
4. Use the REFERENCE EXAMPLE as a structural guide only — override its colors/sizes with the ones from THIS slide's CSS
5. Pull fonts and colors from the CSS rules and resolved palette — never guess

EXACT COLOR FIDELITY: The CSS RULES provided with each slide are the RESOLVED colors.
You MUST use the exact hex colors from the CSS rules for each element. If .card-num says color:#8E1E1E,
use color:'8E1E1E'. NEVER substitute your own colors. The examples are structural guides only —
always override example colors with the ACTUAL colors from the CSS/HTML of each slide.

FOOTNOTES & SOURCES: If HTML contains source/footnote text, render as small text near slide bottom:
  Strategy& source/footer/page chrome is 7.5pt and is handled by addSourceNote/addFooter. Do not use 7.5pt for body content, chart axes, captions, or legends.

BAR CHARTS: Render bar-chart-exhibit as native PptxGenJS shapes (filled rectangles proportional to %).

AUTO-CHARTS: If you see <div class="auto-chart" data-chart='JSON'>, extract chart data and use slide.addChart().
If unsure how to use addChart, render bars as rectangles instead — that always works.

NATIVE TABLES: If the HTML contains a real <table>, or a hinted/native table element, prefer slide.addTable(rows, options) instead of drawing every cell as rectangles and text boxes. Use one table object with column widths, row height, borders, fills, and per-cell text styles. Use shapes only when the visual is a non-tabular matrix, chart, heatmap, or process layout. For scorecard/status tables, render dots, checks, RAG markers, and other cell indicators as table cell text glyphs (for example ●, ◐, ○, ✓) with per-cell text color and alignment. Do NOT draw those markers as separate ellipse/circle shapes over the table.

INLINE SVG ICONS: Small decorative inline <svg> pictograms are rasterized from the rendered HTML and placed automatically after your code runs. The post-pass captures the icon AND its immediate badge/chip wrapper (.card-icon-circle, .icon-circle, .icon-chip, .icon-badge, .bullet-icon, .kpi-icon, .card-icon, [data-ppt-rasterize]) as ONE atomic image. Therefore:
- Do NOT redraw those small SVG path icons as emoji, placeholder text, or embedded base64 images.
- Do NOT draw an addShape('ellipse'/'rect'/etc.) for the chip/circle BACKGROUND of any container that already contains an inline <svg> icon. Your shape would land underneath the rasterized image and produce a visible halo / off-center fringe (#FIFA-export-2026-05).
- DO render the OUTER card frame, dividers, numbering, body text, titles, and every other non-icon element from the HTML/CSS.
- For containers WITHOUT an inline <svg> (e.g. emoji-as-icon or text-glyph chips) the rasterizer does not fire, so draw both the chip ellipse AND the glyph addText as the reference example shows.

FOOTER: Do NOT render any <footer> HTML content. DO call addFooter(slide, slideNum, totalSlides) once per slide — EXCEPT on cover slides (skip addFooter for covers; render cover branding and date as direct addText calls instead).

TEXT BOX AUTOFIT (PowerPoint: Format Shape > Text Box — maps to PptxGenJS option \`fit\`):
- \`fit: 'none'\` — fixed box ("Do not Autofit"). Use for equal-height card shells, chart regions, bands, or anywhere the HTML/CSS locks height so peers align.
- \`fit: 'shrink'\` — shrink font to fit ("Shrink text on overflow"). Last resort for tight single-line chips; do not use this as the primary fix when multi-line body copy sits in a box that is simply too short or too tall relative to the text.
- \`fit: 'resize'\` — **resize shape to fit text** ("Resize shape to fit text"). **Prefer this** for narrative body paragraphs and bullet stacks in columns/cells when the slide HTML sizes content naturally (not fixed equal-height shells). Place using x, w, y from layout; set valign:'top'; give h a reasonable estimate from line count so you are not leaving a huge empty box or a visibly undersized box — this addresses feedback where the issue is **wrong box size vs text**, not ordinary overflow clipping.

BULLET SPACING IN PPTX: Keep vertical rhythm uniform within each list — same lineSpacing / paragraph spacing for every item, or one \`addText\` with bullet styling so PowerPoint applies even gaps. If you emit separate \`addText\` calls per bullet, use a **constant** y increment between items (no ad-hoc shorter gaps in the middle of a column).

HOW TO CONSUME ELEMENT HINTS:
If the user prompt contains an ELEMENT HINTS block, each entry is semantic export guidance attached to a risky element in the HTML. Use the HTML and CSS for layout, but obey the hint when rendering that specific element in PptxGenJS.

Interpret hints as follows:
- chip / badge: compact label or pill. Keep the visual treatment tight and single-line.
- nowrap: never wrap the text, stack letters, or split words across lines.
- exact-text: preserve the visible text exactly. Do not abbreviate, trim, or rewrite it.
- step-number: keep the number as one prominent line, not multiple lines.
- tight-box: minimise text margin / inset. Prefer margin:0, wrap:false, and valign:'middle' when that matches the CSS. For one-line compact labels use fit:'shrink' only as a last resort; for multi-line bodies prefer fit:'resize' so the shape matches the text block.
- table / native-table: render the element as a native PowerPoint table via slide.addTable when it is row/column data. Cell markers belong inside table cells as text glyphs, not as overlay shapes.
- align=... / valign=...: prefer that alignment for the hinted element.
- typography-floor: even when using fit:'shrink', never set fontSize below 8 for compact tags/trackers or below 10 for normal text; use 12 for normal body copy and 14 for section/pillar/card titles.

If an element has no hint, render it normally from the CSS and HTML.

OUTPUT: Return ONLY a JavaScript array of functions, no markdown.`;

export const DEFAULT_PPTX_CODE_EXAMPLE = `[
  function(pptx, slideNum, totalSlides) {
    const slide = pptx.addSlide();
    slide.addText("Title", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:'111111'});
    slide.addText("Subtitle", {x:0.48, y:1.40, w:12.36, h:0.35, fontFace:'Arial', fontSize:18, color:'A32020', bold:true});
    addFooter(slide, slideNum, totalSlides);
  }
]`;

export function detectSlideLayoutType(html) {
  if (!html) return 'freestyle';
  if (html.includes('cover-slide') || html.includes('cover-title')) return 'cover';
  if (html.includes('card-row') || html.includes('three-cards')) return 'three-cards';
  if (html.includes('two-col') || html.includes('kpi-block')) return 'two-column-kpi';
  return 'freestyle';
}

// ── Model detection & credential routing (unchanged from old code) ───────────

function isReasoningModel(model) { return /\b(gpt-5|o1|o3)\b/i.test(model || ''); }
function isGPT5Model(model) { return /\bgpt-5/i.test(model || ''); }
function isGeminiModel(model) { return /\bgemini-/i.test(model || ''); }

function extractGeminiResponseText(parts) {
  if (!parts || parts.length === 0) return '';
  const responseParts = parts.filter(p => !p.thought);
  const targetParts = responseParts.length > 0 ? responseParts : parts;
  return targetParts.map(p => p.text).filter(Boolean).join('');
}

function isClaudeModel(model) {
  if (!model) return false;
  const m = model.toLowerCase();
  return m.includes('claude') || m.includes('anthropic');
}

const PPTX_GPT5_MODELS = ['gpt-5', 'gpt-5.1', 'gpt-5.2', 'gpt-5-mini'];

function isPptxGPT5Model(model) {
  if (!model) return false;
  const m = model.toLowerCase();
  return PPTX_GPT5_MODELS.some(g => m.includes(g.toLowerCase()));
}

function parsePptxModelRef(ref) {
  if (!ref) return { providerId: '', modelName: '' };
  const idx = ref.indexOf(':');
  if (idx === -1) return { providerId: '', modelName: ref };
  return { providerId: ref.slice(0, idx), modelName: ref.slice(idx + 1) };
}

export function getCredentialsForModel(settings, modelRef) {
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  const { providerId, modelName } = parsePptxModelRef(modelRef);
  const provider = providers.find(p => p.id === providerId);

  if (provider) {
    const isGemini = (provider.apiUrl || '').includes('generativelanguage.googleapis.com');
    const isClaude = (provider.apiUrl || '').includes('anthropic.com');
    const isOpenAI = (provider.apiUrl || '').includes('api.openai.com');
    const actualModel = provider.azurePrefix ? `azure.${modelName}` : modelName;
    const useResponsesAPI = isPptxGPT5Model(modelName) && isOpenAI && !provider.azurePrefix;
    return {
      type: isGemini ? 'gemini' : isClaude ? 'claude' : 'openai',
      apiKey: provider.apiKey || settings.apiKey || '',
      apiEndpoint: useResponsesAPI ? 'https://api.openai.com/v1/responses' : provider.apiUrl || '',
      model: actualModel, rawModel: modelName,
      azurePrefix: provider.azurePrefix || false,
      authType: provider.authType || 'auto', useResponsesAPI,
    };
  }

  if (isGeminiModel(modelRef) || isGeminiModel(modelName)) {
    const gp = providers.find(p => (p.apiUrl || '').includes('generativelanguage.googleapis.com'));
    return { type: 'gemini', apiKey: gp?.apiKey || settings.apiKey || '', apiEndpoint: gp?.apiUrl || 'https://generativelanguage.googleapis.com/v1beta', model: modelName || modelRef, rawModel: modelName || modelRef, azurePrefix: false, useResponsesAPI: false };
  }
  if (isClaudeModel(modelRef) || isClaudeModel(modelName)) {
    const cp = providers.find(p => (p.apiUrl || '').includes('anthropic.com'));
    return { type: 'claude', apiKey: cp?.apiKey || settings.apiKey || '', apiEndpoint: cp?.apiUrl || 'https://api.anthropic.com/v1/messages', model: modelName || modelRef, rawModel: modelName || modelRef, azurePrefix: false, useResponsesAPI: false };
  }

  const op = providers.find(p => p.id === 'openai') || providers.find(p => p.apiKey);
  const fm = modelName || modelRef || DEFAULT_PPTX_MODEL;
  const isOpenAI = (op?.apiUrl || '').includes('api.openai.com');
  const useResponsesAPI = isPptxGPT5Model(fm) && isOpenAI;
  return {
    type: 'openai', apiKey: op?.apiKey || settings.apiKey || '',
    apiEndpoint: useResponsesAPI ? 'https://api.openai.com/v1/responses' : op?.apiUrl || settings.apiEndpoint || 'https://api.openai.com/v1/chat/completions',
    model: fm, rawModel: fm, azurePrefix: false, useResponsesAPI,
  };
}

export function hasAnyCredentials(settings) {
  if (!settings) return false;
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  return !!(settings.apiKey || providers.some(p => !!p.apiKey));
}

// ── API calling functions (unchanged) ────────────────────────────────────────

async function callGeminiAPI(settings, credentials, systemPrompt, userPrompt) {
  const model = credentials.rawModel || credentials.model;
  const baseUrl = credentials.apiEndpoint || 'https://generativelanguage.googleapis.com/v1beta';
  const endpoint = `${baseUrl}/models/${model}:generateContent?key=${credentials.apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
    generationConfig: { maxOutputTokens: settings.maxTokens || 8192, temperature: settings.temperature || 0.2 },
  };
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error?.message || `Gemini API error: ${response.status}`); }
  const data = await response.json();
  return extractGeminiResponseText(data.candidates?.[0]?.content?.parts);
}

async function callClaudeAPI(settings, credentials, systemPrompt, userPrompt) {
  const apiEndpoint = credentials.apiEndpoint || 'https://api.anthropic.com/v1/messages';
  const mdl = credentials.model || credentials.rawModel;
  const body = { model: mdl, max_tokens: settings.maxTokens || 8192, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] };
  const noTemp = /claude-opus-4-7|claude-sonnet-4-6/i.test(mdl);
  if (!noTemp && settings.temperature !== undefined) body.temperature = settings.temperature;
  const response = await authFetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': credentials.apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
  if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error?.message || `Claude API error: ${response.status}`); }
  const data = await response.json();
  return data.content?.find(c => c.type === 'text')?.text || '';
}

function buildPptxRequestBody(credentials, settings, messages) {
  const model = credentials.model;
  const { temperature, maxTokens, reasoningEffort } = settings;
  const verbosity = settings.verbosity || null;
  const noTemp = /claude-opus-4-7|claude-sonnet-4-6/i.test(model);
  if (credentials.useResponsesAPI) {
    let instructions = '';
    const inputItems = [];
    for (const msg of messages) { if (msg.role === 'system') instructions += (instructions ? '\n\n' : '') + msg.content; else inputItems.push({ role: msg.role, content: msg.content }); }
    const input = inputItems.length === 1 && inputItems[0].role === 'user' ? inputItems[0].content : inputItems;
    const body = { model, input };
    if (instructions) body.instructions = instructions;
    if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') body.reasoning = { effort: reasoningEffort };
    else if (!noTemp && !omitChatCompletionsTemperature(model)) body.temperature = temperature || 0.2;
    body.max_output_tokens = maxTokens || 8000;
    if (verbosity) body.text = { verbosity };
    return body;
  }
  const body = { model, messages };
  if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') body.reasoning_effort = reasoningEffort;
  else if (!noTemp && !omitChatCompletionsTemperature(model)) { body.temperature = temperature || 0.2; }
  body.max_tokens = maxTokens || 8000;
  return body;
}

function parsePptxResponseContent(data, credentials) {
  if (credentials?.useResponsesAPI) {
    for (const item of (data.output || [])) { if (item.type === 'message' && item.content) { for (const part of item.content) { if ((part.type === 'output_text' || part.type === 'text') && part.text) return part.text; } } }
    return data.output_text || '';
  }
  return data.choices?.[0]?.message?.content || '';
}

export async function callAI(settings, credentials, systemPrompt, userPrompt) {
  if (credentials.type === 'gemini') return callGeminiAPI(settings, credentials, systemPrompt, userPrompt);
  if (credentials.type === 'claude') return callClaudeAPI(settings, credentials, systemPrompt, userPrompt);

  const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
  const headers = { 'Content-Type': 'application/json' };
  if (credentials.authType === 'server') { /* proxy adds key */ }
  else if (credentials.azurePrefix) headers['api-key'] = credentials.apiKey;
  else headers['Authorization'] = `Bearer ${credentials.apiKey}`;

  const response = await authFetch(credentials.apiEndpoint, { method: 'POST', headers, body: JSON.stringify(buildPptxRequestBody(credentials, settings, messages)) });
  if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error?.message || `API error: ${response.status}`); }
  const data = await response.json();
  return parsePptxResponseContent(data, credentials);
}

// ── Code parsing ─────────────────────────────────────────────────────────────

export function extractJSArray(raw) {
  let content = raw.replace(/```javascript\n?/g, '').replace(/```js\n?/g, '').replace(/```\n?/g, '').trim();
  const arrayStart = content.indexOf('[');
  if (arrayStart === -1) throw new Error('Response does not contain a JavaScript array');

  let depth = 0, inString = false, stringChar = '', arrayEnd = -1;
  for (let i = arrayStart; i < content.length; i++) {
    const ch = content[i], prev = i > 0 ? content[i - 1] : '';
    if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
      if (!inString) { inString = true; stringChar = ch; } else if (ch === stringChar) inString = false;
    }
    if (!inString) {
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) { arrayEnd = i; break; } }
    }
  }
  if (arrayEnd <= arrayStart) throw new Error('Could not find matching ] for the array');
  return content.substring(arrayStart, arrayEnd + 1).replace(/;\s*$/, '').trim();
}

// ── Prompt building (single slide) ───────────────────────────────────────────

function extractInlineStyle(html) {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match ? match[1].trim() : '';
}

function hasNativeTableIntent(html, hints = null) {
  const sourceHtml = String(html || '');
  const parsedHints = hints || parsePptxHints(sourceHtml);
  return /<table\b/i.test(sourceHtml) ||
    /\b(table|dense-table|comparison-table|comparisonTable|matrix-table)\b/i.test(sourceHtml) ||
    parsedHints.some(entry => entry?.hints?.flags?.some(flag => flag === 'table' || flag === 'native-table'));
}

function hasTableMarkerOverlayShapes(codeString) {
  const source = String(codeString || '');
  return /\baddShape\s*\(\s*(?:[^,\n]*\.)?ShapeType\.(?:ellipse|oval)\b/i.test(source) ||
    /\baddShape\s*\(\s*['"`](?:ellipse|oval)['"`]/i.test(source);
}

function buildPositionBlock(tplPositions) {
  if (!tplPositions || Object.keys(tplPositions).length === 0) return null;
  const t = tplPositions.title;
  const b = tplPositions.body;
  const f = tplPositions.footer || tplPositions.slideNum;
  const lines = ['(from uploaded client template)'];
  if (t) lines.push(`  Title:    x:${t.x}  y:${t.y}  w:${t.w}  h:${t.h}`);
  if (tplPositions.subtitle) {
    const s = tplPositions.subtitle;
    lines.push(`  Subtitle: x:${s.x}  y:${s.y}  w:${s.w}  h:${s.h}`);
  }
  if (b) lines.push(`  Frame:    x:${b.x}  y:${b.y}  w:${b.w}  h:${b.h}`);
  if (f) lines.push(`  Footer:   y:${f.y}`);
  return lines.join('\n');
}

function pxRectToInches(rect, canvas) {
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

function buildProfilePositionBlock(profile) {
  const layout = profile?.layoutContract;
  const standard = layout?.standardContent;
  if (!standard) return null;
  const positions = {
    title: pxRectToInches(standard.title, layout.canvas),
    subtitle: pxRectToInches(standard.subtitle, layout.canvas),
    body: pxRectToInches(standard.body, layout.canvas),
    footer: pxRectToInches(standard.source, layout.canvas),
    slideNum: pxRectToInches(standard.slideNumber, layout.canvas),
  };
  const block = buildPositionBlock(positions);
  return block ? block.replace('(from uploaded client template)', `(from active ${profile.name} profile layout contract)`) : null;
}

export async function buildSlidePrompt(slide, slideNum, totalSlides, settings, errorFeedback) {
  const palette = themeToPptxPalette(settings?.theme);
  const activeProfile = getActiveClientProfile(settings || {});
  const canvas = activeProfile?.layoutContract?.canvas || {
    widthPx: 960,
    heightPx: 540,
    widthIn: 13.333,
    heightIn: 7.5,
  };
  const pxToIn = Number((canvas.widthIn / canvas.widthPx).toFixed(5));
  const sampleX = Number((28 * canvas.widthIn / canvas.widthPx).toFixed(2));
  const sampleTitleY = Number((24 * canvas.heightIn / canvas.heightPx).toFixed(2));
  const sampleSubtitleY = Number((95 * canvas.heightIn / canvas.heightPx).toFixed(2));
  const sampleFrameY = Number((127 * canvas.heightIn / canvas.heightPx).toFixed(2));
  const sampleFrameW = Number((904 * canvas.widthIn / canvas.widthPx).toFixed(2));
  const sampleFrameH = Number((366 * canvas.heightIn / canvas.heightPx).toFixed(2));
  const sampleFooterY = Number((canvas.heightIn - 0.45).toFixed(2));

  const rawBaseCSS = extractRelevantCSS(slide.html, slide.customCSS || '');
  const resolvedBaseCSS = resolveCustomProperties(rawBaseCSS, settings?.theme);

  const inlineCSS = extractInlineStyle(slide.html || '');
  const resolvedInlineCSS = inlineCSS ? resolveCustomProperties(inlineCSS, settings?.theme) : '';

  const allCSS = [resolvedBaseCSS, resolvedInlineCSS].filter(Boolean).join('\n\n');

  console.log(`[PPTX Prompt] Slide %d CSS: base=%d inline=%d total=%d`, slideNum, resolvedBaseCSS.length, inlineCSS.length, allCSS.length);

  const decision = decideTemplateUsage(slide, settings?.customTemplates || []);
  let exampleCode = COMPLETE_TRANSLATION_EXAMPLE.code;
  const html = slide.html || '';
  if (html.includes('cover-slide') || html.includes('cover-title')) exampleCode = COVER_TRANSLATION_EXAMPLE.code;
  else if (html.includes('kpi-block') || html.includes('two-col')) exampleCode = KPI_TRANSLATION_EXAMPLE.code;
  if (decision.useTemplate && shouldUseTemplateRendererForProfile(activeProfile, decision)) {
    exampleCode = decision.pptxRendererCode;
  } else if (decision.useTemplate && activeProfile?.id !== 'strategy') {
    console.info('[PPTX] Skipping template renderer for client profile %s; using profile-safe reference geometry instead.', activeProfile.id);
  }
  exampleCode = enforcePptxFontFaceForProfile(
    buildProfileReferenceExampleCode(activeProfile, exampleCode),
    activeProfile
  );

  const hints = parsePptxHints(html);
  const hintsBlock = formatHintsForPrompt(hints);
  console.log('[PPTX Prompt] Slide %d hints: %d', slideNum, hints.length);
  const nativeTableIntent = hasNativeTableIntent(html, hints);

  const cleanHtml = stripPptxHintComments(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/src="data:image\/[^"]*"/gi, 'src="[embedded-image]"')
  );

  const tplPos = buildPositionBlock(settings?.templatePositions) || buildProfilePositionBlock(activeProfile);
  const profileFontFace = getProfilePptxFontFace(activeProfile);
  const profileTypographyGuidance = getProfilePptxTypographyGuidance(activeProfile);
  const clientProfileBlock = buildClientProfileContext(settings || {}, {
    includeTheme: true,
    includeLayout: true,
    includeValidation: true,
    includeEvidence: false,
    includePromptSections: false,
    includeComponents: true,
    includePptx: true,
  });

  let prompt = `TASK: Convert this HTML slide to a PptxGenJS function.

========== RESOLVED CSS VARIABLE VALUES ==========
${palette.resolvedVars}

========== DIMENSION MAPPING (HTML px -> PptxGenJS inches) ==========
HTML slide: ${canvas.widthPx}px x ${canvas.heightPx}px  |  PPTX slide: ${canvas.widthIn}in x ${canvas.heightIn}in
Conversion: inches = px * ${canvas.widthIn} / ${canvas.widthPx}  (approx ${pxToIn} in/px)

Key positions ${tplPos || `(px -> inches):
  Title:    left:28px top:24px  w:904px        -> x:${sampleX}  y:${sampleTitleY}  w:${sampleFrameW}
  Subtitle: left:28px top:95px  w:904px        -> x:${sampleX}  y:${sampleSubtitleY}  w:${sampleFrameW}
  Frame:    left:28px top:127px w:904px h:366px -> x:${sampleX}  y:${sampleFrameY}  w:${sampleFrameW} h:${sampleFrameH}
  Footer:   bottom of slide                    -> y:${sampleFooterY}`}

When CSS specifies pixel values for position or size, convert them:
  px=28  -> ${sampleX}in    px=127 -> ${sampleFrameY}in    px=904 -> ${sampleFrameW}in
  px=366 -> ${sampleFrameH}in    px=${canvas.widthPx} -> ${canvas.widthIn}in  px=${canvas.heightPx} -> ${canvas.heightIn}in

All content inside .frame maps to the PPTX region starting at the Frame position above.
Position elements WITHIN that region relatively.
${activeProfile?.id !== 'strategy' ? 'For the active client profile, never use generic Strategy& positions from old examples when profile positions are listed above. Keep all non-chrome content inside the profile Body/Frame rectangle.' : ''}

========== COLOR PALETTE ==========
${palette.colorCode}
${palette.hint}
- Primary text: ${palette.colors.main}
- Secondary text: ${palette.colors.secondary}
- Accent: ${palette.colors.accent}
- Card backgrounds: ${palette.colors.cardBg}
- Borders: ${palette.colors.border}
${clientProfileBlock ? `\n========== ACTIVE CLIENT PROFILE ==========\n${clientProfileBlock}\n` : ''}

========== REFERENCE EXAMPLE ==========
${exampleCode}

========== SLIDE ${slideNum} OF ${totalSlides} ==========
${hintsBlock ? `\n${hintsBlock}\n` : ''}
${nativeTableIntent ? `\n========== NATIVE TABLE EXPORT ==========\nThis slide contains row/column table intent. If the visible content is tabular, render it with PptxGenJS slide.addTable(rows, options), not a pile of independent rectangles and text boxes. Preserve header fills, body fills, borders, column widths, row heights, alignment, and per-cell text colors. Scorecard dots, hollow circles, checks, RAG markers, and similar status indicators MUST be table cell text glyphs inside the relevant rows/columns. Do not use slide.addShape('ellipse'), circle shapes, or positioned overlays for table cell markers; they detach when the table is resized. Use shape grids only for non-tabular matrices, charts, heatmaps, or diagrams.\n` : ''}
>>> HTML (extract ALL text EXACTLY) <<<
${cleanHtml}
>>> END HTML <<<

>>> CSS RULES (base + slide-specific, with var() tokens already resolved) <<<
${allCSS || '/* No specific CSS */'}
>>> END CSS <<<

MANDATORY -- EXACT COLOR FIDELITY:
You MUST reproduce the EXACT colors from BOTH the CSS rules AND inline styles.
The CSS RULES section above is the RESOLVED stylesheet for this slide -- treat it as ground truth.
1. Check the CSS RULES for each class (e.g. .card-num { color: #8E1E1E }) -> use that exact hex
2. If an element also has an inline style="color: #ABC123", the inline style overrides CSS
3. Remove the # prefix for PptxGenJS: #8E1E1E -> color:'8E1E1E'
4. For background-color in CSS or inline -> fill:{color:'HEX'}
5. Do NOT invent your own colors. Do NOT use gray/light colors for elements that are red/maroon in the CSS.
6. The reference example is just a STRUCTURAL guide. Always use the ACTUAL colors from THIS slide's CSS/HTML.

MANDATORY -- TYPOGRAPHY FIDELITY AND READABILITY:
${profileFontFace ? `- For this client profile, every text box MUST set fontFace:'${profileFontFace}'. Do not use Arial, Georgia, Calibri, Aptos, or generic font fallbacks.\n` : ''}
${profileTypographyGuidance}
- Never emit fontSize below 10 for normal text, or below 8 for compact tags, chips, badges, tracker labels, and short in-box labels.
- Use fontSize 12 or larger for body copy, bullets, descriptions, and table cells.
- Use fontSize 14 or larger for section titles, pillar titles, card titles, grid-cell titles, and h3/h4 equivalents.
- Use fontSize 8 only for compact tags, chips, badges, tracker labels, and short in-box labels.
- Use fontSize 10 only for chart axes, legends, and captions. Strategy& footer/source/page chrome is 7.5pt through addFooter/addSourceNote; client-profile footer/source/page chrome may use its active profile size when specified.
- Do not use fit:'shrink' to push text below those floors. If needed, shorten copied text only when the HTML/CSS already indicates it is a compact label.

OUTPUT FORMAT (return ONLY this, no markdown):
[
  function(pptx, slideNum, totalSlides) {
    const slide = pptx.addSlide();
    ${palette.colorCode}
    // ... your code ...
    addFooter(slide, slideNum, totalSlides);
  }
]

CRITICAL:
- Use ACTUAL text from the HTML. Never use placeholder text.
- Use ACTUAL colors from the CSS RULES. Never substitute your own colors.
- The CSS RULES are the TRUTH. If CSS says .card-num { color: #8E1E1E }, use color:'8E1E1E' -- not gray, not light, not anything else.
- Font sizes must respect the typography floor even if CSS or examples contain smaller legacy values.`;

  if (errorFeedback) {
    prompt += `

========== FIX REQUIRED ==========
Your previous code FAILED. Here is what went wrong:

ERROR TYPE: ${errorFeedback.type}
ERROR MESSAGE: ${errorFeedback.message}
${errorFeedback.details ? `DETAILS: ${errorFeedback.details}` : ''}

YOUR PREVIOUS CODE:
${errorFeedback.previousCode}

FIX the error and return the corrected JavaScript array. Return ONLY the fixed code, no explanation.`;
  }

  return prompt;
}

// ── Sandboxed validation ─────────────────────────────────────────────────────

export function validateGeneratedCode(codeString, slideHtml, settings = null) {
  const errors = [];

  // 1. Parse check
  let slideFunctions;
  try {
    const execContext = { addFooter, COLORS };
    const wrapped = `const { addFooter, COLORS } = context; return ${codeString};`;
    slideFunctions = new Function('context', wrapped)(execContext);
  } catch (e) {
    return { valid: false, errors: [{ type: 'SyntaxError', message: e.message, details: 'The code could not be parsed as JavaScript.' }] };
  }

  if (!Array.isArray(slideFunctions) || typeof slideFunctions[0] !== 'function') {
    return { valid: false, errors: [{ type: 'FormatError', message: 'Response is not an array containing a function', details: 'Expected [function(pptx, slideNum, totalSlides) { ... }]' }] };
  }

  const nativeTableIntent = hasNativeTableIntent(slideHtml);
  const usesNativeTable = /\baddTable\s*\(/.test(String(codeString));
  if (nativeTableIntent && !usesNativeTable) {
    errors.push({
      type: 'NativeTableWarning',
      message: 'Table-intent slide did not use slide.addTable',
      details: 'For real HTML tables or native-table hints, retry with a native PowerPoint table before falling back to shape grids.',
    });
  }
  if (nativeTableIntent && usesNativeTable && hasTableMarkerOverlayShapes(codeString)) {
    errors.push({
      type: 'NativeTableWarning',
      message: 'Table-intent slide used overlay circle shapes for table markers',
      details: 'Retry with scorecard/status dots, checks, and hollow markers encoded as centered table cell text glyphs inside slide.addTable rows, not separate ellipse/circle shapes.',
    });
  }

  const tinyFontMatches = [...String(codeString).matchAll(/fontSize\s*:\s*([0-9]*\.?[0-9]+)/g)]
    .map(match => ({
      size: Number(match[1]),
      context: String(codeString).slice(Math.max(0, match.index - 140), match.index + 140),
    }))
    .filter(({ size, context }) => {
      if (!Number.isFinite(size)) return false;
      if (size < 7) return true;
      if (size < 7.5) return !/\b(source|footer|slideNum|slide number|page number)\b/i.test(context);
      if (size >= 8) return false;
      return !/\b(source|footer|slideNum|slide number|page number)\b/i.test(context);
    });
  if (tinyFontMatches.length > 0) {
    const tinyFontSizes = tinyFontMatches.map(match => match.size);
    return {
      valid: false,
      errors: [{
        type: 'TypographyFloorError',
        message: `PPTX code uses fontSize below the allowed floor (${[...new Set(tinyFontSizes)].join(', ')})`,
        details: 'Regenerate with fontSize >= 8 for compact tags/trackers, >= 7.5 only for Strategy& footer/source/page chrome, >= 10 for captions/axes/legends, and >= 12 for normal body text.',
      }],
    };
  }

  // 2. Execution check on a sandboxed PptxGenJS instance
  const testPptx = new PptxGenJS();
  applyPptxLayout(testPptx, getActiveClientProfile(settings || {}));
  testPptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

  try {
    slideFunctions[0](testPptx, 1, 1);
  } catch (e) {
    return { valid: false, errors: [{ type: 'RuntimeError', message: e.message, details: `The code threw an error when executed: ${e.stack?.split('\n').slice(0, 3).join(' | ')}` }] };
  }

  // 3. Slide check
  if (!testPptx.slides || testPptx.slides.length === 0) {
    errors.push({ type: 'NoSlideError', message: 'No slide was created', details: 'The function must call pptx.addSlide().' });
  }

  // 4. Content check
  if (testPptx.slides?.length > 0) {
    const slide = testPptx.slides[testPptx.slides.length - 1];
    const objectCount = slide._slideObjects?.length || slide.data?.length || 0;
    if (objectCount === 0) {
      errors.push({ type: 'EmptySlideError', message: 'Slide has no content', details: 'The slide was created but contains zero text boxes or shapes.' });
    }
  }

  // 5. Title check
  if (slideHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(slideHtml, 'text/html');
    const titleEl = doc.querySelector('.title, h1, .cover-title');
    if (titleEl?.textContent.trim()) {
      const expectedTitle = titleEl.textContent.trim().substring(0, 30);
      const slideData = JSON.stringify(testPptx.slides?.[testPptx.slides.length - 1] || {});
      if (!slideData.includes(expectedTitle.substring(0, 15))) {
        errors.push({ type: 'MissingTitleWarning', message: `Title "${expectedTitle}..." not found in generated slide`, details: 'The HTML has a title but the PPTX slide does not contain matching text.' });
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors, slideFunctions };
  return { valid: true, errors: [], slideFunctions };
}

// ── Core: generate code for one slide with retry loop ────────────────────────

async function generateSlideWithRetry(slide, slideNum, totalSlides, settings, credentials) {
  const activeProfile = getActiveClientProfile(settings || {});
  const baseSystemPrompt = `${settings?.pptxSystemPrompt?.trim() || DEFAULT_PPTX_SYSTEM_PROMPT}${getProfilePptxSystemGuidance(activeProfile)}`;
  const systemPrompt = applyPromptOverride(settings, 'pptx.system', baseSystemPrompt);
  let lastCode = null;
  let lastErrors = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const errorFeedback = attempt > 0 && lastErrors.length > 0
      ? { ...lastErrors[0], previousCode: lastCode }
      : null;

    const isRetry = attempt > 0;
    if (isRetry) console.log(`[PPTX] Retry ${attempt}/${MAX_RETRIES} for slide ${slideNum}. Error: ${lastErrors[0]?.message}`);

    try {
      const userPrompt = await buildSlidePrompt(slide, slideNum, totalSlides, settings, errorFeedback);
      recordPromptPayload('pptx.system', {
        model: settings?.pptxModel || DEFAULT_PPTX_MODEL,
        systemPrompt,
        userPrompt,
        slideNum,
        totalSlides,
        attempt: attempt + 1,
      });
      const raw = await callAI(settings, credentials, systemPrompt, userPrompt);
      const codeString = enforcePptxProfileCode(extractJSArray(raw), activeProfile);
      lastCode = codeString;

      const validation = validateGeneratedCode(codeString, slide.html, settings);

      if (validation.valid) {
        if (isRetry) console.log(`[PPTX] Slide ${slideNum} fixed on attempt ${attempt + 1}`);
        return { success: true, slideFunctions: validation.slideFunctions, code: codeString, attempts: attempt + 1 };
      }

      const nativeTableWarnings = validation.errors.filter(e => e.type === 'NativeTableWarning');
      if (nativeTableWarnings.length > 0 && attempt < MAX_RETRIES) {
        console.log(`[PPTX] Slide ${slideNum} table export used shapes; retrying for native addTable.`);
        lastErrors = nativeTableWarnings;
        continue;
      }

      // Soft failures (warnings only) — use the code anyway
      const hardErrors = validation.errors.filter(e => !e.type.includes('Warning'));
      if (hardErrors.length === 0 && validation.slideFunctions) {
        console.log(`[PPTX] Slide ${slideNum} has warnings but is usable:`, validation.errors.map(e => e.message).join('; '));
        return { success: true, slideFunctions: validation.slideFunctions, code: codeString, attempts: attempt + 1 };
      }

      lastErrors = hardErrors.length > 0 ? hardErrors : validation.errors;
    } catch (err) {
      lastErrors = [{ type: 'APIError', message: err.message, details: '' }];
      lastCode = lastCode || '(no code generated)';
      if (err.message.includes('Failed to fetch')) throw err;
    }
  }

  console.warn(`[PPTX] All ${MAX_RETRIES + 1} attempts failed for slide ${slideNum}. Using fallback.`);
  return { success: false, errors: lastErrors, attempts: MAX_RETRIES + 1 };
}

// ── Fallback: basic DOM text extraction ──────────────────────────────────────

function parseHTML(html) { return new DOMParser().parseFromString(html, 'text/html'); }
function getText(doc, sel) { const el = doc.querySelector(sel); return el ? el.textContent.trim() : ''; }

function generateFallbackSlide(pptx, slide, slideNum, totalSlides, activeProfile = null) {
  const pptxSlide = pptx.addSlide();
  const doc = parseHTML(slide.html || '<div></div>');
  const isStc = activeProfile?.id === 'stc';
  const profilePositions = activeProfile?.chrome?.positions || {};
  const fontFace = getProfilePptxFontFace(activeProfile);
  const titleFont = fontFace || 'Georgia';
  const bodyFont = fontFace || 'Arial';
  const titlePos = profilePositions.title || { x: 0.48, y: 0.42, w: 12.36, h: 0.8 };
  const subtitlePos = profilePositions.subtitle || { x: 0.48, y: 1.40, w: 12.36, h: 0.4 };
  const bodyPos = profilePositions.body || { x: 0.48, y: 2.0, w: 12.36, h: 4.9 };
  const colors = isStc
    ? { main: '4F008C', secondary: '1D252D', accent: '4F008C', subtitle: 'FF375E', surface: 'FBF8FE', border: 'DBB8F3', meta: '515360' }
    : { main: COLORS.main, secondary: COLORS.secondary, accent: COLORS.maroon, subtitle: COLORS.red, surface: COLORS.zone1, border: COLORS.border, meta: COLORS.meta };

  const isCover = (slide.html || '').includes('cover-slide') || (slide.html || '').includes('master-cover');
  const isDivider = (slide.html || '').includes('section-divider');

  if (isCover) {
    pptxSlide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: 'FFFFFF' } });
    const cat = getText(doc, '.cover-category');
    const title = getText(doc, '.cover-title') || getText(doc, '.title') || 'Presentation';
    if (cat) pptxSlide.addText(cat.toUpperCase(), { x: 0.48, y: 1.94, w: 12.36, h: 0.5, fontFace: bodyFont, fontSize: 18, color: colors.subtitle, bold: true });
    pptxSlide.addText(title, { x: 0.48, y: 2.64, w: 9.7, h: 2.0, fontFace: titleFont, fontSize: 42, color: colors.main, valign: 'top' });
    // Cover branding and date — no footer row
    const branding = getText(doc, '.cover-branding');
    const date = getText(doc, '.cover-date');
    if (branding) pptxSlide.addText(branding, { x: 0.48, y: 6.50, w: 4.0, h: 0.3, fontFace: bodyFont, fontSize: 16, bold: true, color: colors.meta });
    if (date) pptxSlide.addText(date, { x: 9.5, y: 6.50, w: 3.3, h: 0.3, fontFace: bodyFont, fontSize: 13, color: colors.meta, align: 'right' });
    return;
  }
  if (isDivider) {
    pptxSlide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: 'FFFFFF' } });
    pptxSlide.addShape('rect', { x: 0, y: 0, w: 0.33, h: 7.5, fill: { color: colors.accent } });
    const title = getText(doc, '.section-divider-title, .divider-title') || getText(doc, '.title') || 'Section';
    pptxSlide.addText(title, { x: 1.1, y: 2.5, w: 10, h: 1.5, fontFace: titleFont, fontSize: 36, color: colors.main, bold: true });
    addFooter(pptxSlide, slideNum, totalSlides);
    return;
  }

  const title = getText(doc, '.title, h1, .cover-title');
  const subtitle = getText(doc, '.subtitle, h2');
  if (title) pptxSlide.addText(title, { x: titlePos.x, y: titlePos.y, w: titlePos.w, h: titlePos.h, fontFace: titleFont, fontSize: titlePos.font?.fontSize || 28, color: colors.main });
  if (subtitle) pptxSlide.addText(subtitle, { x: subtitlePos.x, y: subtitlePos.y, w: subtitlePos.w, h: subtitlePos.h, fontFace: bodyFont, fontSize: subtitlePos.font?.fontSize || 18, color: colors.subtitle, bold: subtitlePos.font?.bold ?? true });

  const contentY = bodyPos.y;
  const cards = doc.querySelectorAll('.card, .grid-cell, .kpi-block, .stat-box');
  if (cards.length > 0) {
    const cardW = bodyPos.w / Math.min(cards.length, 4) - 0.2;
    cards.forEach((card, i) => {
      if (i >= 4) return;
      const x = bodyPos.x + i * (cardW + 0.2);
      pptxSlide.addShape('rect', { x, y: contentY, w: cardW, h: Math.min(4.0, bodyPos.h), fill: { color: colors.surface }, line: { color: colors.border, width: 0.5 } });
      pptxSlide.addShape('rect', { x, y: contentY, w: cardW, h: 0.06, fill: { color: colors.accent } });
      const cardTitle = card.querySelector('h3, h4, strong, .card-title');
      if (cardTitle) pptxSlide.addText(cardTitle.textContent.trim(), { x: x + 0.15, y: contentY + 0.85, w: cardW - 0.3, h: 0.4, fontFace: bodyFont, fontSize: 14, color: colors.main, bold: true });
      let body = '';
      card.querySelectorAll('p').forEach(p => { const t = p.textContent.trim(); if (t) body += (body ? '\n\n' : '') + t; });
      if (body) pptxSlide.addText(body.substring(0, 400), { x: x + 0.15, y: contentY + 1.35, w: cardW - 0.3, h: 2.2, fontFace: bodyFont, fontSize: 12, color: colors.secondary, valign: 'top' });
    });
  } else {
    const bullets = doc.querySelectorAll('li');
    if (bullets.length > 0) {
      bullets.forEach((b, i) => { if (i >= 8) return; pptxSlide.addText(b.textContent.trim().substring(0, 200), { x: bodyPos.x + 0.25, y: contentY + i * 0.6, w: bodyPos.w - 0.5, h: 0.5, fontFace: bodyFont, fontSize: 14, color: colors.main, bullet: true }); });
    } else {
        let yPos = contentY;
      doc.querySelectorAll('p').forEach((p, i) => { if (i >= 6 || yPos > 6.5) return; const t = p.textContent.trim(); if (t && t.length > 5) { pptxSlide.addText(t.substring(0, 400), { x: bodyPos.x, y: yPos, w: bodyPos.w, h: 0.8, fontFace: bodyFont, fontSize: 13, color: colors.secondary, valign: 'top' }); yPos += 0.85; } });
    }
  }
  addSourceNote(pptxSlide, slide.html);
  addFooter(pptxSlide, slideNum, totalSlides);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getSlideObjectText(obj) {
  if (!obj) return '';
  if (typeof obj.text === 'string') return normalizeText(obj.text);
  if (Array.isArray(obj.text)) {
    return normalizeText(obj.text.map(run => {
      if (typeof run === 'string') return run;
      return run?.text || '';
    }).join(' '));
  }
  return '';
}

function getSourceTextsFromHtml(html) {
  if (!html) return [];
  const doc = parseHTML(html);
  const selectors = [
    'footer .source', '.graph-source', '.exhibit-source', '.chart-source',
    '.chart-commentary-source', '.benefit-sources', '.source-note',
    '.exec-takeaway-source', '.stat-source',
  ];
  const texts = [];
  for (const sel of selectors) {
    doc.querySelectorAll(sel).forEach(el => {
      const text = normalizeText(el.textContent);
      if (text && !texts.includes(text)) texts.push(text);
    });
  }
  return texts;
}

function applyObjectOptions(obj, nextOptions) {
  if (!obj || !nextOptions) return;
  obj.options = {
    ...(obj.options || {}),
    ...nextOptions,
  };
  normalizeObjectGeometryOptions(obj.options);
  if (Array.isArray(obj.text)) {
    obj.text = obj.text.map(run => {
      if (!run || typeof run === 'string') return run;
      const runOptions = {
        ...(run.options || {}),
        ...nextOptions,
      };
      normalizeObjectGeometryOptions(runOptions);
      return {
        ...run,
        options: runOptions,
      };
    });
  }
}

function normalizeObjectGeometryOptions(options) {
  if (!options) return;
  if (Number.isFinite(options.w) && options.w < 0) {
    if (Number.isFinite(options.x)) options.x += options.w;
    options.w = Math.abs(options.w);
  }
  if (Number.isFinite(options.h) && options.h < 0) {
    if (Number.isFinite(options.y)) options.y += options.h;
    options.h = Math.abs(options.h);
  }
}

function sanitizeSlideObjectGeometry(pptxSlide) {
  if (!pptxSlide?._slideObjects) return;
  for (const obj of pptxSlide._slideObjects) {
    normalizeObjectGeometryOptions(obj.options);
    if (!Array.isArray(obj.text)) continue;
    for (const run of obj.text) {
      if (run && typeof run !== 'string') normalizeObjectGeometryOptions(run.options);
    }
  }
}

function sanitizeSlideObjectTextForProfile(pptxSlide, profile) {
  if (!profile || profile.id === 'strategy' || !pptxSlide?._slideObjects) return;
  const sanitize = (value, { trim = true } = {}) => {
    let next = String(value || '')
      .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
      .replace(/\s+/g, ' ');
    if (trim) next = next.trim();
    if (profile.id === 'pif') {
      next = next
        .replace(/\bNational Development Division\b/gi, '')
        .replace(/\bNATIONAL DEVELOPMENT DIVISION\b/g, '');
      if (trim) next = next.trim();
    }
    return next;
  };
  const needsBoundarySpace = (prev, current) => {
    const prevText = String(prev || '');
    const currentText = String(current || '');
    if (!prevText || !currentText) return false;
    if (/\s$/.test(prevText) || /^\s/.test(currentText)) return false;
    const prevChar = prevText.match(/\S(?=\s*$)/)?.[0] || '';
    const nextChar = currentText.match(/^\s*(\S)/)?.[1] || '';
    return /[A-Za-z0-9%)]/.test(prevChar) && /[A-Za-z0-9(]/.test(nextChar);
  };
  for (const obj of pptxSlide._slideObjects) {
    if (typeof obj.text === 'string') {
      obj.text = sanitize(obj.text);
      continue;
    }
    if (!Array.isArray(obj.text)) continue;
    let previousText = '';
    obj.text = obj.text.map(run => {
      const rawText = typeof run === 'string' ? run : run?.text;
      if (rawText === undefined || rawText === null) return run;
      let text = sanitize(rawText, { trim: false });
      if (needsBoundarySpace(previousText, text)) text = ` ${text}`;
      previousText = `${previousText}${text}`;
      if (typeof run === 'string') return text;
      return { ...run, text };
    });
  }
}

function objectBounds(obj) {
  const opts = obj?.options || {};
  if (!Number.isFinite(opts.x) || !Number.isFinite(opts.y)) return null;
  const w = Number.isFinite(opts.w) ? opts.w : 0;
  const h = Number.isFinite(opts.h) ? opts.h : 0;
  return {
    x1: Math.min(opts.x, opts.x + w),
    y1: Math.min(opts.y, opts.y + h),
    x2: Math.max(opts.x, opts.x + w),
    y2: Math.max(opts.y, opts.y + h),
  };
}

function collectBounds(objects) {
  const bounds = objects.map(objectBounds).filter(Boolean);
  if (!bounds.length) return null;
  const x1 = Math.min(...bounds.map(b => b.x1));
  const y1 = Math.min(...bounds.map(b => b.y1));
  const x2 = Math.max(...bounds.map(b => b.x2));
  const y2 = Math.max(...bounds.map(b => b.y2));
  return {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    right: x2,
    bottom: y2,
  };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function bodyCandidateObjects(objects, chromeObjects, bodyPos, footerPos) {
  const topGuard = Math.max(0, bodyPos.y - 0.45);
  const bottomGuard = footerPos?.y ? Math.min(footerPos.y - 0.08, bodyPos.y + bodyPos.h + 0.65) : bodyPos.y + bodyPos.h + 0.65;
  return objects.filter(obj => {
    if (chromeObjects.has(obj)) return false;
    const bounds = objectBounds(obj);
    if (!bounds) return false;
    if (bounds.y1 < bodyPos.y - 0.14) return false;
    if (bounds.y2 < topGuard || bounds.y1 > bottomGuard) return false;
    if (bounds.x2 < bodyPos.x - 0.8 || bounds.x1 > bodyPos.x + bodyPos.w + 0.8) return false;
    return true;
  });
}

function normalizeProfileTextBoxOptions(objects, profile) {
  if (profile?.id !== 'pif' || !Array.isArray(objects)) return;
  for (const obj of objects) {
    const text = getSlideObjectText(obj);
    if (!text || !obj.options) continue;
    const isCompact = text.length <= 28 || /^[0-9]{1,2}$/.test(text) || /^[A-Z0-9 &/.-]{3,}$/.test(text);
    applyObjectOptions(obj, {
      margin: isCompact ? 0 : 0.03,
      ...(isCompact ? { fit: 'shrink', breakLine: false, wrap: false } : {}),
    });
  }
}

function addProfileTitleRule(pptxSlide, profile, positions) {
  const rule = positions?.titleRule;
  if (profile?.id !== 'pif' || !rule || typeof pptxSlide?.addShape !== 'function') return;
  const color = rule.color || positions?.title?.font?.color || getProfileTextColor(profile, 'kicker', 'C3984D');
  pptxSlide.addShape('rect', {
    x: rule.x,
    y: rule.y,
    w: rule.w,
    h: Math.max(rule.h || 0.01, 0.005),
    fill: { color },
    line: { color, transparency: 100 },
  });
}

function fitObjectsIntoRect(objects, target, padding = 0.02) {
  const bounds = collectBounds(objects);
  if (!bounds || !target?.w || !target?.h) return false;

  const targetRect = {
    x: target.x + padding,
    y: target.y + padding,
    w: Math.max(0.01, target.w - padding * 2),
    h: Math.max(0.01, target.h - padding * 2),
  };
  const overflows =
    bounds.x < targetRect.x
    || bounds.y < targetRect.y
    || bounds.right > targetRect.x + targetRect.w
    || bounds.bottom > targetRect.y + targetRect.h;
  if (!overflows) return false;

  const scaleX = bounds.w > targetRect.w ? targetRect.w / bounds.w : 1;
  const scaleY = bounds.h > targetRect.h ? targetRect.h / bounds.h : 1;
  const mappedW = bounds.w * scaleX;
  const mappedH = bounds.h * scaleY;
  const targetX = bounds.w > targetRect.w
    ? targetRect.x
    : clamp(bounds.x, targetRect.x, targetRect.x + targetRect.w - mappedW);
  const targetY = bounds.h > targetRect.h
    ? targetRect.y
    : clamp(bounds.y, targetRect.y, targetRect.y + targetRect.h - mappedH);

  for (const obj of objects) {
    const opts = obj.options || {};
    const next = {
      x: targetX + ((opts.x - bounds.x) * scaleX),
      y: targetY + ((opts.y - bounds.y) * scaleY),
    };
    if (Number.isFinite(opts.w)) next.w = opts.w * scaleX;
    if (Number.isFinite(opts.h)) next.h = opts.h * scaleY;
    applyObjectOptions(obj, next);
  }
  return true;
}

function normalizeGeneratedSlideForProfile(pptxSlide, sourceSlide, slideNum, profile, positions) {
  sanitizeSlideObjectGeometry(pptxSlide);
  if (!profile || profile.id === 'strategy' || !pptxSlide?._slideObjects || !positions) return;

  sanitizeSlideObjectTextForProfile(pptxSlide, profile);

  const isCover = /\b(cover-slide|master-cover)\b/.test(sourceSlide?.html || '');
  if (isCover) return;

  const doc = parseHTML(sourceSlide?.html || '<div></div>');
  const title = normalizeText(getText(doc, '.title, h1, .cover-title'));
  const subtitle = normalizeText(getText(doc, '.subtitle, h2'));
  const sourceTexts = getSourceTextsFromHtml(sourceSlide?.html || '');
  const sourceNeedles = new Set(sourceTexts.map(normalizeText));
  const bodyPos = positions.body;
  const titlePos = positions.title;
  const subtitlePos = positions.subtitle;
  const footerPos = positions.footer;
  const slideNumPos = positions.slideNum;
  const fontFace = getProfilePptxFontFace(profile) || titlePos?.font?.fontFace || bodyPos?.font?.fontFace || 'Arial';
  const titleColor = titlePos?.font?.color || getProfileTextColor(profile, 'heading', '111111');
  const subtitleColor = subtitlePos?.font?.color || getProfileTextColor(profile, 'kicker', getProfileTextColor(profile, 'danger', titleColor));
  const footerColor = footerPos?.font?.color || getProfileTextColor(profile, 'muted', '515360');
  const slideNumColor = slideNumPos?.font?.color || footerColor;
  const slideNumFill = slideNumPos?.font?.fill || null;
  const slideEdgeY = profile?.layoutContract?.canvas?.heightIn ? profile.layoutContract.canvas.heightIn - 0.7 : 6.8;
  const slideEdgeX = profile?.layoutContract?.canvas?.widthIn ? profile.layoutContract.canvas.widthIn - 1.0 : 11.5;

  const objects = pptxSlide._slideObjects;
  const findTextObjects = predicate => objects.filter(obj => predicate(getSlideObjectText(obj), obj));
  const titleObjects = title ? findTextObjects(text => text === title) : [];
  const subtitleObjects = subtitle ? findTextObjects(text => text === subtitle) : [];
  const sourceObjects = findTextObjects(text => text.startsWith('Source:') || sourceNeedles.has(text));
  const slideNumObjects = findTextObjects((text, obj) =>
    text === String(slideNum)
    && ((obj.options?.y ?? 0) > slideEdgeY || (obj.options?.x ?? 0) > slideEdgeX)
  );
  const chromeObjects = new Set([...titleObjects, ...subtitleObjects, ...sourceObjects, ...slideNumObjects]);

  for (const obj of titleObjects) {
    if (!titlePos) continue;
    applyObjectOptions(obj, {
      x: titlePos.x,
      y: titlePos.y,
      w: titlePos.w,
      h: titlePos.h,
      fontFace,
      fontSize: titlePos.font?.fontSize ?? 24,
      bold: false,
      color: titleColor,
      valign: 'top',
    });
  }
  for (const obj of subtitleObjects) {
    if (!subtitlePos) continue;
    applyObjectOptions(obj, {
      x: subtitlePos.x,
      y: subtitlePos.y,
      w: subtitlePos.w,
      h: subtitlePos.h,
      fontFace,
      fontSize: subtitlePos.font?.fontSize ?? 18,
      bold: false,
      color: subtitleColor,
      valign: 'top',
    });
  }
  for (const obj of sourceObjects) {
    if (!footerPos) continue;
    applyObjectOptions(obj, {
      x: footerPos.x,
      y: footerPos.y,
      w: footerPos.w,
      h: footerPos.h,
      fontFace,
      fontSize: footerPos.font?.fontSize ?? 8,
      bold: false,
      italic: footerPos.font?.italic ?? false,
      color: footerColor,
      align: 'left',
      valign: 'top',
    });
  }
  for (const obj of slideNumObjects) {
    if (!slideNumPos) continue;
    applyObjectOptions(obj, {
      x: slideNumPos.x,
      y: slideNumPos.y,
      w: slideNumPos.w,
      h: slideNumPos.h,
      fontFace,
      fontSize: slideNumPos.font?.fontSize ?? 8,
      bold: false,
      color: slideNumColor,
      align: slideNumPos.font?.align || 'right',
      ...(slideNumFill ? { fill: { color: slideNumFill }, line: { color: slideNumFill, transparency: 100 } } : {}),
    });
  }
  addProfileTitleRule(pptxSlide, profile, positions);

  if (!bodyPos) return;

  const candidates = bodyCandidateObjects(objects, chromeObjects, bodyPos, footerPos);
  if (fitObjectsIntoRect(candidates, bodyPos)) {
    console.info('[PPTX] Normalized %d body object(s) into %s body band on slide %d.', candidates.length, profile.id, slideNum);
  }
  normalizeProfileTextBoxOptions([...chromeObjects, ...candidates], profile);
  sanitizeSlideObjectGeometry(pptxSlide);
}

// ── Main export: full deck ───────────────────────────────────────────────────

export async function exportToPPTX(slides, filename = 'presentation.pptx', settings = null, onProgress = null) {
  if (!slides || slides.length === 0) throw new Error('No slides to export');

  const activeProfile = getActiveClientProfile(settings || {});
  const pptx = new PptxGenJS();
  applyPptxLayout(pptx, activeProfile);
  pptx.title = filename.replace('.pptx', '');
  pptx.author = 'Edwin AI';
  pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

  let templateData = null;
  try { templateData = await loadTemplateFromStorage({ profileId: activeProfile.id }); } catch (e) { /* ignore */ }
  const activeProfilePositions = resolvePptxPositionsForProfile(activeProfile, templateData?.chrome?.positions || null);
  settings = normalizePptxSettingsForProfile(settings || {}, activeProfile, activeProfilePositions);

  const totalSlides = slides.length;
  setFooterBranding(getClientProfileFooterBranding(settings || {}, 'Strategy&'));
  setTemplatePositions(activeProfilePositions);
  setPptxFontFace(getProfilePptxFontFace(activeProfile));

  const useAI = settings && hasAnyCredentials(settings);
  const modelRef = settings?.pptxModel || DEFAULT_PPTX_MODEL;
  const credentials = useAI ? getCredentialsForModel(settings, modelRef) : null;

  if (!useAI) console.warn('[PPTX] No API credentials — using fallback for all slides.');
  else console.log(`[PPTX] Using model: ${modelRef}`);

  const concurrency = Math.max(1, Math.min(10, settings?.pptxParallelBatches || 5));
  const useParallel = useAI && concurrency > 1 && totalSlides > 1;

  const failedExports = [];
  const recordFailure = (slide, slideNum, message) => {
    failedExports.push({
      slideNumber: slideNum,
      slideId: slide?.id || null,
      title: slide?.title || `Slide ${slideNum}`,
      message: message || 'Unknown error',
    });
  };

  if (useParallel) {
    console.log(`[PPTX] Parallel export: ${concurrency} concurrent LLM calls for ${totalSlides} slides`);

    // Phase 1: Generate PptxGenJS code for all slides in parallel (LLM calls are independent)
    const aiResults = new Array(totalSlides).fill(null);
    let completed = 0;

    const generateOne = async (i) => {
      const slide = slides[i];
      const slideNum = i + 1;

      // Use pre-generated PPTX code if available and valid
      if (slide.pptxCode && canUseCachedPptxCodeForProfile(activeProfile)) {
        try {
          const codeString = enforcePptxProfileCode(slide.pptxCode, activeProfile);
          const validation = validateGeneratedCode(codeString, slide.html, settings);
          if (validation.valid && validation.slideFunctions) {
            console.log(`[PPTX] Slide ${slideNum}: using pre-generated code`);
            aiResults[i] = { success: true, slideFunctions: validation.slideFunctions, code: codeString, cached: true };
            completed++;
            if (onProgress) onProgress({ phase: 'rendering', processed: completed, total: totalSlides, message: `Slide ${completed}/${totalSlides} (pre-generated)` });
            return;
          }
          console.log(`[PPTX] Slide ${slideNum}: pre-generated code invalid, regenerating`);
        } catch (e) {
          console.log(`[PPTX] Slide ${slideNum}: pre-generated code error, regenerating`);
        }
      }

      try {
        const result = await generateSlideWithRetry(slide, slideNum, totalSlides, settings, credentials);
        aiResults[i] = result;
        if (!result?.success) {
          recordFailure(slide, slideNum, result?.error || 'AI generation failed');
        }
      } catch (err) {
        console.error(`[PPTX] AI failed for slide ${slideNum}:`, err.message);
        aiResults[i] = { success: false, error: err.message };
        recordFailure(slide, slideNum, err.message);
      }
      completed++;
      if (onProgress) onProgress({
        phase: 'rendering',
        processed: completed,
        total: totalSlides,
        message: `Generated ${completed} of ${totalSlides} slides (${concurrency}x parallel)...`,
      });
    };

    // Concurrency-limited execution: run up to `concurrency` LLM calls at once
    const queue = slides.map((_, i) => i);
    const workers = [];
    for (let w = 0; w < concurrency; w++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const idx = queue.shift();
          if (idx !== undefined) await generateOne(idx);
        }
      })());
    }
    await Promise.all(workers);

    // Phase 2: Apply results to the pptx object sequentially (must be in order)
    for (let i = 0; i < totalSlides; i++) {
      const slide = slides[i];
      const slideNum = i + 1;
      const result = aiResults[i];
      let rendered = false;

      if (result?.success && result.slideFunctions) {
        try {
          result.slideFunctions[0](pptx, slideNum, totalSlides);
          rendered = true;
          if (!result.cached && result.code) slide.pptxCode = result.code;
          const lastSlide = pptx.slides?.[pptx.slides.length - 1];
          if (lastSlide) {
            addSourceNote(lastSlide, slide.html);
            normalizeGeneratedSlideForProfile(lastSlide, slide, slideNum, activeProfile, activeProfilePositions);
            await injectRasterizedSvgIcons(lastSlide, slide, settings);
          }
          if (result.cached) console.log(`[PPTX] Slide ${slideNum}: rendered from cache`);
          else if (result.attempts > 1) console.log(`[PPTX] Slide ${slideNum} succeeded after ${result.attempts} attempts`);
        } catch (execErr) {
          console.error(`[PPTX] Execution failed for slide ${slideNum}:`, execErr.message);
          slide.pptxCode = null;
          recordFailure(slide, slideNum, execErr.message);
        }
      }

      if (!rendered) {
        generateFallbackSlide(pptx, slide, slideNum, totalSlides, activeProfile);
        const lastSlide = pptx.slides?.[pptx.slides.length - 1];
        if (lastSlide) {
          normalizeGeneratedSlideForProfile(lastSlide, slide, slideNum, activeProfile, activeProfilePositions);
          await injectRasterizedSvgIcons(lastSlide, slide, settings);
        }
      }

      if (slide.sectionLabel || slide.subSectionLabel) {
        const s = pptx.slides;
        if (s?.length > 0) addSectionTracker(s[s.length - 1], slide.sectionLabel, slide.subSectionLabel);
      }
    }
  } else {
    // Sequential fallback (no AI credentials, single concurrency, or single slide)
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideNum = i + 1;

      if (onProgress) onProgress({ phase: 'rendering', processed: i, total: totalSlides, message: `Slide ${slideNum} of ${totalSlides}...` });

    let rendered = false;

      if (useAI) {
        try {
          const result = await generateSlideWithRetry(slide, slideNum, totalSlides, settings, credentials);
          if (result.success && result.slideFunctions) {
            result.slideFunctions[0](pptx, slideNum, totalSlides);
        rendered = true;
            const lastSlide = pptx.slides?.[pptx.slides.length - 1];
            if (lastSlide) {
              addSourceNote(lastSlide, slide.html);
              normalizeGeneratedSlideForProfile(lastSlide, slide, slideNum, activeProfile, activeProfilePositions);
              await injectRasterizedSvgIcons(lastSlide, slide, settings);
            }
            if (result.attempts > 1) console.log(`[PPTX] Slide ${slideNum} succeeded after ${result.attempts} attempts`);
          } else {
            recordFailure(slide, slideNum, result?.error || 'AI generation failed');
        }
      } catch (err) {
          console.error(`[PPTX] AI failed for slide ${slideNum}:`, err.message);
          recordFailure(slide, slideNum, err.message);
      }
    }

    if (!rendered) {
        generateFallbackSlide(pptx, slide, slideNum, totalSlides, activeProfile);
        const lastSlide = pptx.slides?.[pptx.slides.length - 1];
        if (lastSlide) {
          normalizeGeneratedSlideForProfile(lastSlide, slide, slideNum, activeProfile, activeProfilePositions);
          await injectRasterizedSvgIcons(lastSlide, slide, settings);
        }
      }

    if (slide.sectionLabel || slide.subSectionLabel) {
        const s = pptx.slides;
        if (s?.length > 0) addSectionTracker(s[s.length - 1], slide.sectionLabel, slide.subSectionLabel);
      }
    }
  }

  if (onProgress) onProgress({ phase: 'finalizing', processed: totalSlides, total: totalSlides, message: 'Creating PowerPoint file...' });

  if (templateData?.data) {
    try {
      const buf = await pptx.write({ outputType: 'arraybuffer' });
      const chrome = {
        ...(templateData.chrome || {}),
        positions: activeProfilePositions || templateData.chrome?.positions || null,
      };
      const useControlledProfileChrome = activeProfile.pptxMaster?.useProfileChrome === true || activeProfile.id === 'stc';
      const merged = useControlledProfileChrome
        ? await applyProfileChromeToGenerated(buf, chrome, { profile: activeProfile, templateData: templateData.data })
        : await applyTemplateToGenerated(buf, templateData.data, chrome, {
          preserveTemplateChrome: activeProfile.id === 'strategy',
        });
      downloadArrayBuffer(merged, filename);
    } catch (e) {
      console.error('[PPTX] Template merge failed:', e);
      await writeSanitizedPptxFile(pptx, filename, 'template merge fallback');
    }
  } else {
    await writeSanitizedPptxFile(pptx, filename, 'direct export');
  }

  if (onProgress) onProgress({ phase: 'complete', processed: totalSlides, total: totalSlides, message: 'Download complete!' });

  return { ok: failedExports.length === 0, failed: failedExports };
}

export async function exportToPPTXStatic(slides, filename = 'presentation.pptx') {
  return exportToPPTX(slides, filename, null, null);
}

// ── Single slide export ──────────────────────────────────────────────────────

export async function exportSingleSlideToPPTX(slide, slideNumber, totalSlides, filename, settings = null, onProgress = null) {
  if (!slide) throw new Error('No slide to export');

  const activeProfile = getActiveClientProfile(settings || {});
  const pptx = new PptxGenJS();
  applyPptxLayout(pptx, activeProfile);
  pptx.title = filename.replace('.pptx', '');
  pptx.author = 'Edwin AI';
  pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

  let templateData = null;
  try { templateData = await loadTemplateFromStorage({ profileId: activeProfile.id }); } catch (e) { /* ignore */ }
  const activeProfilePositions = resolvePptxPositionsForProfile(activeProfile, templateData?.chrome?.positions || null);
  settings = normalizePptxSettingsForProfile(settings || {}, activeProfile, activeProfilePositions);

  setFooterBranding(getClientProfileFooterBranding(settings || {}, 'Strategy&'));
  setTemplatePositions(activeProfilePositions);
  setPptxFontFace(getProfilePptxFontFace(activeProfile));

  const useAI = settings && hasAnyCredentials(settings);
  const modelRef = settings?.pptxModel || DEFAULT_PPTX_MODEL;
  const credentials = useAI ? getCredentialsForModel(settings, modelRef) : null;

  if (onProgress) onProgress({ phase: 'rendering', message: 'Generating slide...' });

    let rendered = false;
    const failedExports = [];
    const recordFailure = (message) => {
      failedExports.push({
        slideNumber,
        slideId: slide?.id || null,
        title: slide?.title || `Slide ${slideNumber}`,
        message: message || 'Unknown error',
      });
    };
  if (useAI) {
    try {
      const result = await generateSlideWithRetry(slide, slideNumber, totalSlides, settings, credentials);
      if (result.success && result.slideFunctions) {
        result.slideFunctions[0](pptx, slideNumber, totalSlides);
          rendered = true;
        const lastSlide = pptx.slides?.[pptx.slides.length - 1];
        if (lastSlide) {
          addSourceNote(lastSlide, slide.html);
          normalizeGeneratedSlideForProfile(lastSlide, slide, slideNumber, activeProfile, activeProfilePositions);
          await injectRasterizedSvgIcons(lastSlide, slide, settings);
        }
      } else {
        recordFailure(result?.error || 'AI generation failed');
      }
        } catch (err) {
      console.error('[PPTX Single] AI failed:', err.message);
      recordFailure(err.message);
      }
    }

  if (!rendered) {
    generateFallbackSlide(pptx, slide, slideNumber, totalSlides, activeProfile);
    const lastSlide = pptx.slides?.[pptx.slides.length - 1];
    if (lastSlide) {
      normalizeGeneratedSlideForProfile(lastSlide, slide, slideNumber, activeProfile, activeProfilePositions);
      await injectRasterizedSvgIcons(lastSlide, slide, settings);
    }
  }

    if (slide.sectionLabel || slide.subSectionLabel) {
    const s = pptx.slides;
    if (s?.length > 0) addSectionTracker(s[s.length - 1], slide.sectionLabel, slide.subSectionLabel);
  }

  if (onProgress) onProgress({ phase: 'finalizing', message: 'Creating PowerPoint file...' });

  if (templateData?.data) {
    try {
      const buf = await pptx.write({ outputType: 'arraybuffer' });
      const chrome = {
        ...(templateData.chrome || {}),
        positions: activeProfilePositions || templateData.chrome?.positions || null,
      };
      const useControlledProfileChrome = activeProfile.pptxMaster?.useProfileChrome === true || activeProfile.id === 'stc';
      const merged = useControlledProfileChrome
        ? await applyProfileChromeToGenerated(buf, chrome, { profile: activeProfile, templateData: templateData.data })
        : await applyTemplateToGenerated(buf, templateData.data, chrome, {
          preserveTemplateChrome: activeProfile.id === 'strategy',
        });
      downloadArrayBuffer(merged, filename);
    } catch (e) { await writeSanitizedPptxFile(pptx, filename, 'single-slide template fallback'); }
    } else {
      await writeSanitizedPptxFile(pptx, filename, 'single-slide direct export');
    }

  if (onProgress) onProgress({ phase: 'complete', message: 'Download complete!' });

  return { ok: failedExports.length === 0, failed: failedExports };
}

// ── Test function (SlidePreview compatibility) ───────────────────────────────

/**
 * Pre-generate PPTX code for a slide in the background.
 * Call after slide creation — the result is stored on the slide object
 * and used by exportToPPTX to skip the LLM call.
 *
 * @returns {string|null} The generated PptxGenJS code, or null on failure
 */
export async function preGeneratePptxCode(slide, slideNum, totalSlides, settings) {
  if (!settings || !hasAnyCredentials(settings)) return null;
  const activeProfile = getActiveClientProfile(settings || {});
  settings = normalizePptxSettingsForProfile(settings, activeProfile, activeProfile.chrome?.positions || null);
  const modelRef = settings?.pptxModel || DEFAULT_PPTX_MODEL;
  const credentials = getCredentialsForModel(settings, modelRef);
  try {
    const result = await generateSlideWithRetry(slide, slideNum, totalSlides, settings, credentials);
    if (result.success && result.code) {
      console.log(`[PPTX Pre-gen] Slide ${slideNum}: code generated (${result.code.length} chars, ${result.attempts} attempt(s))`);
      return result.code;
    }
  } catch (err) {
    console.warn(`[PPTX Pre-gen] Slide ${slideNum} failed:`, err.message);
  }
  return null;
}

export async function testPPTXCodeGeneration(slide, slideNumber, totalSlides, settings) {
  if (!settings || !hasAnyCredentials(settings)) throw new Error('API key required.');
  const activeProfile = getActiveClientProfile(settings || {});
  settings = normalizePptxSettingsForProfile(settings, activeProfile, activeProfile.chrome?.positions || null);
  const modelRef = settings?.pptxModel || DEFAULT_PPTX_MODEL;
  const credentials = getCredentialsForModel(settings, modelRef);
  const result = await generateSlideWithRetry(slide, slideNumber, totalSlides, settings, credentials);
  return { code: result.code || '(fallback used)', validation: { valid: result.success, error: result.errors?.[0]?.message || null } };
}
