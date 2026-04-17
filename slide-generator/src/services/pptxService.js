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
  setTemplatePositions,
} from './pptxRenderers';
import { applyTemplateToGenerated, loadTemplateFromStorage, downloadArrayBuffer } from './pptxTemplateService';
import { extractRelevantCSS } from './aiService';
import { resolveCustomProperties } from './ai/cssExtraction';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { decideTemplateUsage } from './templateMatcher';
import { DEFAULT_THEME } from '../utils/themeUtils';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3; // 4 total attempts per slide
const FORCED_PPTX_MODEL = 'pwc:vertex_ai.anthropic.claude-opus-4-6';
const DEFAULT_PPTX_MODEL = 'gpt-4o';

/**
 * Convert a theme object into the PPTX color palette snippet and hint.
 * Strips '#' from hex values since PptxGenJS uses bare hex strings.
 */
function themeToPptxPalette(theme) {
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
export { hasAnyCredentials };

export const DEFAULT_PPTX_SYSTEM_PROMPT = `You convert HTML slides to PptxGenJS code by learning from input/output examples.

STANDARD COLORS (use these EXACT hex values):
const c = {main:'111111', secondary:'222222', red:'A32020', maroon:'8E1E1E', zone1:'F7F9FB', rose:'F8E3E3', meta:'4A4F57', coal:'4B4F55', border:'E6E9EE'};

STANDARD FONTS:
- Titles: Georgia 28pt, color main
- Subtitles: Arial 18pt bold, color red
- Body text: Arial 12-14pt, color secondary
- Card titles: Arial 16pt bold, color main

DEFAULT POSITIONS (may be overridden by template positions in the user prompt):
- Title: x:0.48, y:0.42, w:12.36
- Subtitle: x:0.48, y:1.40, w:12.36
- Content area starts at y:1.90
- Footer: y:7.05

YOUR TASK:
1. Study the INPUT→OUTPUT examples provided
2. Extract ALL text from the NEW HTML given to you
3. Create PptxGenJS code following the exact pattern from examples
4. Use the same colors, fonts, and positions

CRITICAL: Never use placeholder text. Extract the ACTUAL text from the HTML.

EXACT COLOR FIDELITY: The CSS RULES provided with each slide are the RESOLVED colors.
You MUST use the exact hex colors from the CSS rules for each element. If .card-num says color:#8E1E1E,
use color:'8E1E1E'. NEVER substitute your own colors. The examples are structural guides only —
always override example colors with the ACTUAL colors from the CSS/HTML of each slide.

FOOTNOTES & SOURCES: If HTML contains source/footnote text, render as small text near slide bottom:
  slide.addText("Source: ...", {x:0.48, y:6.7, w:12.36, h:0.25, fontFace:'Arial', fontSize:8, color:'4A4F57'});

BAR CHARTS: Render bar-chart-exhibit as native PptxGenJS shapes (filled rectangles proportional to %).

AUTO-CHARTS: If you see <div class="auto-chart" data-chart='JSON'>, extract chart data and use slide.addChart().
If unsure how to use addChart, render bars as rectangles instead — that always works.

FOOTER: Do NOT render any <footer> HTML content. DO call addFooter(slide, slideNum, totalSlides) once per slide — EXCEPT on cover slides (skip addFooter for covers; render cover branding and date as direct addText calls instead).

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

function getCredentialsForModel(settings, modelRef) {
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

function hasAnyCredentials(settings) {
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
  const body = { model: credentials.model || credentials.rawModel, max_tokens: settings.maxTokens || 8192, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] };
  if (settings.temperature !== undefined) body.temperature = settings.temperature;
  const response = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': credentials.apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
  if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error?.message || `Claude API error: ${response.status}`); }
  const data = await response.json();
  return data.content?.find(c => c.type === 'text')?.text || '';
}

function buildPptxRequestBody(credentials, settings, messages) {
  const model = credentials.model;
  const { temperature, maxTokens, reasoningEffort } = settings;
  const verbosity = settings.verbosity || null;
  if (credentials.useResponsesAPI) {
    let instructions = '';
    const inputItems = [];
    for (const msg of messages) { if (msg.role === 'system') instructions += (instructions ? '\n\n' : '') + msg.content; else inputItems.push({ role: msg.role, content: msg.content }); }
    const input = inputItems.length === 1 && inputItems[0].role === 'user' ? inputItems[0].content : inputItems;
    const body = { model, input };
    if (instructions) body.instructions = instructions;
    if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') body.reasoning = { effort: reasoningEffort }; else body.temperature = temperature || 0.2;
    body.max_output_tokens = maxTokens || 8000;
    if (verbosity) body.text = { verbosity };
    return body;
  }
  const body = { model, messages };
  if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') body.reasoning_effort = reasoningEffort;
  else { body.temperature = temperature || 0.2; body.max_tokens = maxTokens || 8000; }
  return body;
}

function parsePptxResponseContent(data, credentials) {
  if (credentials?.useResponsesAPI) {
    for (const item of (data.output || [])) { if (item.type === 'message' && item.content) { for (const part of item.content) { if ((part.type === 'output_text' || part.type === 'text') && part.text) return part.text; } } }
    return data.output_text || '';
  }
  return data.choices?.[0]?.message?.content || '';
}

async function callAI(settings, credentials, systemPrompt, userPrompt) {
  if (credentials.type === 'gemini') return callGeminiAPI(settings, credentials, systemPrompt, userPrompt);
  if (credentials.type === 'claude') return callClaudeAPI(settings, credentials, systemPrompt, userPrompt);

  const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
  const headers = { 'Content-Type': 'application/json' };
  if (credentials.authType === 'server') { /* proxy adds key */ }
  else if (credentials.azurePrefix) headers['api-key'] = credentials.apiKey;
  else headers['Authorization'] = `Bearer ${credentials.apiKey}`;

  const response = await fetch(credentials.apiEndpoint, { method: 'POST', headers, body: JSON.stringify(buildPptxRequestBody(credentials, settings, messages)) });
  if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error?.message || `API error: ${response.status}`); }
  const data = await response.json();
  return parsePptxResponseContent(data, credentials);
}

// ── Code parsing ─────────────────────────────────────────────────────────────

function extractJSArray(raw) {
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

function buildSlidePrompt(slide, slideNum, totalSlides, settings, errorFeedback) {
  const palette = themeToPptxPalette(settings?.theme);

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
  if (decision.useTemplate && decision.pptxRendererCode) exampleCode = decision.pptxRendererCode;

  const cleanHtml = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/src="data:image\/[^"]*"/gi, 'src="[embedded-image]"');

  const tplPos = buildPositionBlock(settings?.templatePositions);

  let prompt = `TASK: Convert this HTML slide to a PptxGenJS function.

========== RESOLVED CSS VARIABLE VALUES ==========
${palette.resolvedVars}

========== DIMENSION MAPPING (HTML px -> PptxGenJS inches) ==========
HTML slide: 960px x 540px  |  PPTX slide: 13.333in x 7.5in
Conversion: inches = px * 13.333 / 960  (approx 0.01389 in/px)

Key positions ${tplPos || `(px -> inches):
  Title:    left:28px top:24px  w:904px        -> x:0.39  y:0.33  w:12.56
  Subtitle: left:28px top:95px  w:904px        -> x:0.39  y:1.32  w:12.56
  Frame:    left:28px top:127px w:904px h:366px -> x:0.39  y:1.76  w:12.56 h:5.08
  Footer:   bottom of slide                    -> y:7.05`}

When CSS specifies pixel values for position or size, convert them:
  px=28  -> 0.39in    px=127 -> 1.76in    px=904 -> 12.56in
  px=366 -> 5.08in    px=960 -> 13.333in  px=540 -> 7.5in

All content inside .frame maps to the PPTX region starting at the Frame position above.
Position elements WITHIN that region relatively.

========== COLOR PALETTE ==========
${palette.colorCode}
${palette.hint}
- Primary text: ${palette.colors.main}
- Secondary text: ${palette.colors.secondary}
- Accent: ${palette.colors.accent}
- Card backgrounds: ${palette.colors.cardBg}
- Borders: ${palette.colors.border}

========== REFERENCE EXAMPLE ==========
${exampleCode}

========== SLIDE ${slideNum} OF ${totalSlides} ==========

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
- The CSS RULES are the TRUTH. If CSS says .card-num { color: #8E1E1E }, use color:'8E1E1E' -- not gray, not light, not anything else.`;

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

function validateGeneratedCode(codeString, slideHtml) {
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

  // 2. Execution check on a sandboxed PptxGenJS instance
  const testPptx = new PptxGenJS();
  testPptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
  testPptx.layout = 'CUSTOM';
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
  const systemPrompt = settings?.pptxSystemPrompt?.trim() || DEFAULT_PPTX_SYSTEM_PROMPT;
  let lastCode = null;
  let lastErrors = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const errorFeedback = attempt > 0 && lastErrors.length > 0
      ? { ...lastErrors[0], previousCode: lastCode }
      : null;

    const isRetry = attempt > 0;
    if (isRetry) console.log(`[PPTX] Retry ${attempt}/${MAX_RETRIES} for slide ${slideNum}. Error: ${lastErrors[0]?.message}`);

    try {
      const userPrompt = buildSlidePrompt(slide, slideNum, totalSlides, settings, errorFeedback);
      const raw = await callAI(settings, credentials, systemPrompt, userPrompt);
      const codeString = extractJSArray(raw);
      lastCode = codeString;

      const validation = validateGeneratedCode(codeString, slide.html);

      if (validation.valid) {
        if (isRetry) console.log(`[PPTX] Slide ${slideNum} fixed on attempt ${attempt + 1}`);
        return { success: true, slideFunctions: validation.slideFunctions, code: codeString, attempts: attempt + 1 };
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

function generateFallbackSlide(pptx, slide, slideNum, totalSlides) {
  const pptxSlide = pptx.addSlide();
  const doc = parseHTML(slide.html || '<div></div>');

  const isCover = (slide.html || '').includes('cover-slide') || (slide.html || '').includes('master-cover');
  const isDivider = (slide.html || '').includes('section-divider');

  if (isCover) {
    pptxSlide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: 'FFFFFF' } });
    const cat = getText(doc, '.cover-category');
    const title = getText(doc, '.cover-title') || getText(doc, '.title') || 'Presentation';
    if (cat) pptxSlide.addText(cat.toUpperCase(), { x: 0.48, y: 1.94, w: 12.36, h: 0.5, fontFace: 'Arial', fontSize: 18, color: COLORS.red, bold: true });
    pptxSlide.addText(title, { x: 0.48, y: 2.64, w: 9.7, h: 2.0, fontFace: 'Georgia', fontSize: 42, color: COLORS.main, valign: 'top' });
    // Cover branding and date — no footer row
    const branding = getText(doc, '.cover-branding');
    const date = getText(doc, '.cover-date');
    if (branding) pptxSlide.addText(branding, { x: 0.48, y: 6.50, w: 4.0, h: 0.3, fontFace: 'Arial', fontSize: 16, bold: true, color: COLORS.meta });
    if (date) pptxSlide.addText(date, { x: 9.5, y: 6.50, w: 3.3, h: 0.3, fontFace: 'Arial', fontSize: 13, color: COLORS.meta, align: 'right' });
    return;
  }
  if (isDivider) {
    pptxSlide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: 'FFFFFF' } });
    pptxSlide.addShape('rect', { x: 0, y: 0, w: 0.33, h: 7.5, fill: { color: COLORS.maroon } });
    const title = getText(doc, '.section-divider-title, .divider-title') || getText(doc, '.title') || 'Section';
    pptxSlide.addText(title, { x: 1.1, y: 2.5, w: 10, h: 1.5, fontFace: 'Georgia', fontSize: 36, color: COLORS.main, bold: true });
    addFooter(pptxSlide, slideNum, totalSlides);
    return;
  }

  const title = getText(doc, '.title, h1, .cover-title');
  const subtitle = getText(doc, '.subtitle, h2');
  if (title) pptxSlide.addText(title, { x: 0.48, y: 0.42, w: 12.36, h: 0.8, fontFace: 'Georgia', fontSize: 28, color: COLORS.main });
  if (subtitle) pptxSlide.addText(subtitle, { x: 0.48, y: 1.40, w: 12.36, h: 0.4, fontFace: 'Arial', fontSize: 18, color: COLORS.red, bold: true });

  const contentY = 2.0;
  const cards = doc.querySelectorAll('.card, .grid-cell, .kpi-block, .stat-box');
  if (cards.length > 0) {
    const cardW = 12.36 / Math.min(cards.length, 4) - 0.2;
    cards.forEach((card, i) => {
      if (i >= 4) return;
      const x = 0.48 + i * (cardW + 0.2);
      pptxSlide.addShape('rect', { x, y: contentY, w: cardW, h: 4.0, fill: { color: COLORS.zone1 }, line: { color: COLORS.border, width: 0.5 } });
      pptxSlide.addShape('rect', { x, y: contentY, w: cardW, h: 0.06, fill: { color: COLORS.maroon } });
      const cardTitle = card.querySelector('h3, h4, strong, .card-title');
      if (cardTitle) pptxSlide.addText(cardTitle.textContent.trim(), { x: x + 0.15, y: contentY + 0.85, w: cardW - 0.3, h: 0.4, fontFace: 'Arial', fontSize: 14, color: COLORS.main, bold: true });
      let body = '';
      card.querySelectorAll('p').forEach(p => { const t = p.textContent.trim(); if (t) body += (body ? '\n\n' : '') + t; });
      if (body) pptxSlide.addText(body.substring(0, 400), { x: x + 0.15, y: contentY + 1.35, w: cardW - 0.3, h: 2.2, fontFace: 'Arial', fontSize: 11, color: COLORS.secondary, valign: 'top' });
    });
  } else {
    const bullets = doc.querySelectorAll('li');
    if (bullets.length > 0) {
      bullets.forEach((b, i) => { if (i >= 8) return; pptxSlide.addText(b.textContent.trim().substring(0, 200), { x: 0.75, y: contentY + i * 0.6, w: 11.5, h: 0.5, fontFace: 'Arial', fontSize: 14, color: COLORS.main, bullet: true }); });
    } else {
        let yPos = contentY;
      doc.querySelectorAll('p').forEach((p, i) => { if (i >= 6 || yPos > 6.5) return; const t = p.textContent.trim(); if (t && t.length > 5) { pptxSlide.addText(t.substring(0, 400), { x: 0.48, y: yPos, w: 12.36, h: 0.8, fontFace: 'Arial', fontSize: 13, color: COLORS.secondary, valign: 'top' }); yPos += 0.85; } });
    }
  }
  addSourceNote(pptxSlide, slide.html);
  addFooter(pptxSlide, slideNum, totalSlides);
}

// ── Main export: full deck ───────────────────────────────────────────────────

export async function exportToPPTX(slides, filename = 'presentation.pptx', settings = null, onProgress = null) {
  if (!slides || slides.length === 0) throw new Error('No slides to export');

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
  pptx.layout = 'CUSTOM';
  pptx.title = filename.replace('.pptx', '');
  pptx.author = 'Edwin AI';
  pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

  let templateData = null;
  try { templateData = await loadTemplateFromStorage(); } catch (e) { /* ignore */ }
  if (templateData?.chrome?.positions && settings) {
    settings = { ...settings, templatePositions: templateData.chrome.positions };
  }

  const totalSlides = slides.length;
  setFooterBranding(settings?.footerBranding || 'Strategy&');
  setTemplatePositions(templateData?.chrome?.positions || null);

  const useAI = settings && hasAnyCredentials(settings);
  const modelRef = FORCED_PPTX_MODEL;
  const credentials = useAI ? getCredentialsForModel(settings, modelRef) : null;

  if (!useAI) console.warn('[PPTX] No API credentials — using fallback for all slides.');
  else console.log(`[PPTX] Using forced model: ${FORCED_PPTX_MODEL}`);

  const concurrency = Math.max(1, Math.min(10, settings?.pptxParallelBatches || 5));
  const useParallel = useAI && concurrency > 1 && totalSlides > 1;

  if (useParallel) {
    console.log(`[PPTX] Parallel export: ${concurrency} concurrent LLM calls for ${totalSlides} slides`);

    // Phase 1: Generate PptxGenJS code for all slides in parallel (LLM calls are independent)
    const aiResults = new Array(totalSlides).fill(null);
    let completed = 0;

    const generateOne = async (i) => {
      const slide = slides[i];
      const slideNum = i + 1;
      try {
        const result = await generateSlideWithRetry(slide, slideNum, totalSlides, settings, credentials);
        aiResults[i] = result;
      } catch (err) {
        console.error(`[PPTX] AI failed for slide ${slideNum}:`, err.message);
        aiResults[i] = { success: false, error: err.message };
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
          const lastSlide = pptx.slides?.[pptx.slides.length - 1];
          if (lastSlide) addSourceNote(lastSlide, slide.html);
          if (result.attempts > 1) console.log(`[PPTX] Slide ${slideNum} succeeded after ${result.attempts} attempts`);
        } catch (execErr) {
          console.error(`[PPTX] Execution failed for slide ${slideNum}:`, execErr.message);
        }
      }

      if (!rendered) {
        generateFallbackSlide(pptx, slide, slideNum, totalSlides);
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
            if (lastSlide) addSourceNote(lastSlide, slide.html);
            if (result.attempts > 1) console.log(`[PPTX] Slide ${slideNum} succeeded after ${result.attempts} attempts`);
        }
      } catch (err) {
          console.error(`[PPTX] AI failed for slide ${slideNum}:`, err.message);
      }
    }

    if (!rendered) {
        generateFallbackSlide(pptx, slide, slideNum, totalSlides);
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
      const merged = await applyTemplateToGenerated(buf, templateData.data, templateData.chrome || null);
      downloadArrayBuffer(merged, filename);
    } catch (e) {
      console.error('[PPTX] Template merge failed:', e);
      await pptx.writeFile({ fileName: filename });
    }
  } else {
    await pptx.writeFile({ fileName: filename });
  }

  if (onProgress) onProgress({ phase: 'complete', processed: totalSlides, total: totalSlides, message: 'Download complete!' });
}

export async function exportToPPTXStatic(slides, filename = 'presentation.pptx') {
  return exportToPPTX(slides, filename, null, null);
}

// ── Single slide export ──────────────────────────────────────────────────────

export async function exportSingleSlideToPPTX(slide, slideNumber, totalSlides, filename, settings = null, onProgress = null) {
  if (!slide) throw new Error('No slide to export');

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
  pptx.layout = 'CUSTOM';
  pptx.title = filename.replace('.pptx', '');
  pptx.author = 'Edwin AI';
  pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

  let templateData = null;
  try { templateData = await loadTemplateFromStorage(); } catch (e) { /* ignore */ }
  if (templateData?.chrome?.positions && settings) {
    settings = { ...settings, templatePositions: templateData.chrome.positions };
  }

  setFooterBranding(settings?.footerBranding || 'Strategy&');
  setTemplatePositions(templateData?.chrome?.positions || null);

  const useAI = settings && hasAnyCredentials(settings);
  const modelRef = FORCED_PPTX_MODEL;
  const credentials = useAI ? getCredentialsForModel(settings, modelRef) : null;

  if (onProgress) onProgress({ phase: 'rendering', message: 'Generating slide...' });

    let rendered = false;
  if (useAI) {
    try {
      const result = await generateSlideWithRetry(slide, slideNumber, totalSlides, settings, credentials);
      if (result.success && result.slideFunctions) {
        result.slideFunctions[0](pptx, slideNumber, totalSlides);
          rendered = true;
        const lastSlide = pptx.slides?.[pptx.slides.length - 1];
        if (lastSlide) addSourceNote(lastSlide, slide.html);
      }
        } catch (err) {
      console.error('[PPTX Single] AI failed:', err.message);
      }
    }

  if (!rendered) generateFallbackSlide(pptx, slide, slideNumber, totalSlides);

    if (slide.sectionLabel || slide.subSectionLabel) {
    const s = pptx.slides;
    if (s?.length > 0) addSectionTracker(s[s.length - 1], slide.sectionLabel, slide.subSectionLabel);
  }

  if (onProgress) onProgress({ phase: 'finalizing', message: 'Creating PowerPoint file...' });

  if (templateData?.data) {
    try {
      const buf = await pptx.write({ outputType: 'arraybuffer' });
      const merged = await applyTemplateToGenerated(buf, templateData.data, templateData.chrome || null);
      downloadArrayBuffer(merged, filename);
    } catch (e) { await pptx.writeFile({ fileName: filename }); }
    } else {
      await pptx.writeFile({ fileName: filename });
    }

  if (onProgress) onProgress({ phase: 'complete', message: 'Download complete!' });
}

// ── Test function (SlidePreview compatibility) ───────────────────────────────

export async function testPPTXCodeGeneration(slide, slideNumber, totalSlides, settings) {
  if (!settings || !hasAnyCredentials(settings)) throw new Error('API key required.');
  const modelRef = FORCED_PPTX_MODEL;
  const credentials = getCredentialsForModel(settings, modelRef);
  const result = await generateSlideWithRetry(slide, slideNumber, totalSlides, settings, credentials);
  return { code: result.code || '(fallback used)', validation: { valid: result.success, error: result.errors?.[0]?.message || null } };
}
