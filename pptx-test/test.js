#!/usr/bin/env node
// ============================================================================
// Standalone PPTX generation test harness
//
// Usage:
//   node test.js              — run all 3 sample slides
//   node test.js cover        — run only cover slide
//   node test.js cards        — run only three-cards slide
//   node test.js kpi          — run only KPI slide
//   node test.js all          — run all + combined deck
//   node test.js custom path  — use custom HTML file as input
//
// Output: .pptx files in ./output/
// Logs: full prompt, raw AI response, validation results, retry attempts
// ============================================================================

import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const LOG_DIR = path.join(__dirname, 'logs');

// ── Config ───────────────────────────────────────────────────────────────────

const BACKEND_URL = 'http://localhost:3001/api/ai/chat';
const MODEL = 'vertex_ai.anthropic.claude-opus-4-6';
const MAX_RETRIES = 3;
const MAX_TOKENS = 8192;
const TEMPERATURE = 0.2;

// Basic auth for the backend
const BASIC_AUTH = Buffer.from('team:edwin2026').toString('base64');

// ── PPTX Constants ───────────────────────────────────────────────────────────

const COLORS = {
  main: '111111', secondary: '222222', red: 'A32020', maroon: '8E1E1E',
  meta: '4A4F57', zone1: 'F7F9FB', zone2: 'EEF2F6', rose: 'F8E3E3',
  coal: '4B4F55', border: 'E6E9EE', white: 'FFFFFF',
};

function addFooter(slide, slideNum, totalSlides) {
  if (!slide || !slideNum) return;
  slide.addText(`${slideNum} / ${totalSlides}`, {
    x: 11.5, y: 7.05, w: 1.3, h: 0.25,
    fontFace: 'Arial', fontSize: 10, color: COLORS.meta, align: 'right',
  });
}

// ── Sample CSS (resolved for "bold" vibe — mimics extractRelevantCSS output)

const SAMPLE_CSS = {
  cover: `.cover-slide { background: #FFFFFF; }
.cover-category { color: #A32020; font-family: Arial; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; }
.cover-title { color: #111111; font-family: Georgia; font-size: 42px; line-height: 1.15; }
.cover-branding { color: #4A4F57; font-family: Arial; font-size: 16px; font-weight: bold; }
.cover-date { color: #4A4F57; font-family: Arial; font-size: 14px; }`,

  cards: `.slide { background: #FFFFFF; }
.title { color: #111111; font-family: Georgia; font-size: 28px; }
.subtitle { color: #A32020; font-family: Arial; font-size: 18px; font-weight: bold; }
.card { background-color: #F7F9FB; border: 1px solid #E6E9EE; border-radius: 5px; }
.card::before { background-color: #8E1E1E; height: 4px; }
.card-icon-circle { background-color: #F8E3E3; color: #8E1E1E; border-radius: 50%; }
.card-num { color: #8E1E1E; font-family: Georgia; font-size: 32px; font-weight: bold; }
.card h3 { color: #111111; font-family: Arial; font-size: 16px; font-weight: bold; }
.card p { color: #222222; font-family: Arial; font-size: 12px; }
.impact-box { color: #4B4F55; font-family: Arial; font-size: 11px; font-weight: bold; border-top: 1px solid #E6E9EE; }
.frame { padding: 0; }`,

  kpi: `.slide { background: #FFFFFF; }
.title { color: #111111; font-family: Georgia; font-size: 28px; }
.subtitle { color: #A32020; font-family: Arial; font-size: 18px; font-weight: bold; }
.kpi-block { background-color: #F7F9FB; border-radius: 5px; border-left: 4px solid #8E1E1E; }
.kpi-value { color: #8E1E1E; font-family: Georgia; font-size: 42px; font-weight: bold; }
.kpi-label { color: #4A4F57; font-family: Arial; font-size: 13px; }
.detail-item h4 { color: #111111; font-family: Arial; font-size: 14px; font-weight: bold; }
.detail-item p { color: #222222; font-family: Arial; font-size: 12px; }`,
};

// ── Sample Slides ────────────────────────────────────────────────────────────

const SAMPLE_SLIDES = {
  cover: {
    name: 'Cover Slide',
    type: 'cover',
    html: `<div class="slide cover-slide master-cover">
  <div class="frame">
    <div class="cover-category">DIGITAL TRANSFORMATION</div>
    <div class="cover-title">Enterprise AI Strategy Framework for Sustainable Growth</div>
  </div>
  <div class="cover-branding">Strategy&</div>
  <div class="cover-date">April 2026</div>
</div>`,
    css: SAMPLE_CSS.cover,
  },

  cards: {
    name: 'Three Cards',
    type: 'three-cards',
    html: `<div class="slide master-standard">
  <h1 class="title">AI integration accelerates consulting delivery while maintaining essential human oversight</h1>
  <h2 class="subtitle">Consulting lifecycle optimization</h2>
  <div class="frame">
    <div class="card-row">
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">📋</div>
          <div class="card-num">01</div>
        </div>
        <h3>Business Development</h3>
        <p>Automated proposal drafting and rapid synthesis of client requirements.</p>
        <div class="impact-box">40% faster proposals</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">🔍</div>
          <div class="card-num">02</div>
        </div>
        <h3>Discovery & Research</h3>
        <p>Instant extraction of insights from vast document repositories and datasets.</p>
        <div class="impact-box">3x faster analysis</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">📊</div>
          <div class="card-num">03</div>
        </div>
        <h3>Analysis & Modeling</h3>
        <p>Accelerated quantitative modeling and scenario testing for complex problems.</p>
        <div class="impact-box">60% time savings</div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>3 / 6</span></footer>
</div>`,
    css: SAMPLE_CSS.cards,
  },

  kpi: {
    name: 'KPI Metrics',
    type: 'kpi',
    html: `<div class="slide master-standard">
  <h1 class="title">AI implementation delivers measurable returns within first year</h1>
  <h2 class="subtitle">Performance Metrics</h2>
  <div class="frame">
    <div class="two-col">
      <div class="col-left">
        <div class="kpi-block">
          <div class="kpi-value">47%</div>
          <div class="kpi-label">Reduction in manual processing time</div>
        </div>
        <div class="kpi-block">
          <div class="kpi-value">3.2x</div>
          <div class="kpi-label">Return on AI investment (Year 1)</div>
        </div>
        <div class="kpi-block">
          <div class="kpi-value">$12M</div>
          <div class="kpi-label">Annual operational cost savings</div>
        </div>
      </div>
      <div class="col-right">
        <div class="detail-item">
          <h4>Process Automation</h4>
          <p>Intelligent document processing reduced manual data entry by 65%.</p>
        </div>
        <div class="detail-item">
          <h4>Customer Experience</h4>
          <p>AI-powered chatbots handle 40% of customer inquiries with 92% satisfaction.</p>
        </div>
        <div class="detail-item">
          <h4>Predictive Analytics</h4>
          <p>Machine learning models improved demand forecasting accuracy by 35%.</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>4 / 6</span></footer>
</div>`,
    css: SAMPLE_CSS.kpi,
  },
};

// ── Gold-standard examples (structural reference for the AI) ─────────────────

const EXAMPLES = {
  cards: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',rose:'F8E3E3',meta:'4A4F57',coal:'4B4F55',border:'E6E9EE'};
  slide.addText("Three strategic pillars drive enterprise AI adoption at scale", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("Strategic Framework", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const items = [
    {icon:'🎯', num:'01', title:'Foundation Layer', body:'Establish robust data infrastructure.\\n\\nModern cloud architecture enables seamless integration.', impact:'Timeline: 6-12 months'},
    {icon:'⚙️', num:'02', title:'Capability Building', body:'Deploy AI-powered tools across functions.\\n\\nCoE model accelerates knowledge transfer.', impact:'Timeline: 12-18 months'},
    {icon:'🚀', num:'03', title:'Scale & Optimize', body:'Enterprise-wide rollout with continuous improvement loops.\\n\\nMeasure ROI through productivity gains.', impact:'Timeline: 18-24 months'}
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
}`,
  kpi: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE'};
  slide.addText("AI implementation delivers measurable returns within first year", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("Performance Metrics", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const kpis = [{value:'47%', label:'Reduction in manual processing time'},{value:'3.2x', label:'Return on AI investment'},{value:'$12M', label:'Annual cost savings'}];
  kpis.forEach((kpi, i) => {
    const yPos = 1.90 + (i * 1.55);
    slide.addShape('roundRect', {x:0.48, y:yPos, w:5.5, h:1.4, fill:{color:c.zone1}, rectRadius:0.05});
    slide.addShape('rect', {x:0.48, y:yPos, w:0.06, h:1.4, fill:{color:c.maroon}});
    slide.addText(kpi.value, {x:0.78, y:yPos + 0.15, w:2.5, h:0.7, fontFace:'Georgia', fontSize:42, color:c.maroon, bold:true, valign:'middle'});
    slide.addText(kpi.label, {x:0.78, y:yPos + 0.85, w:5, h:0.4, fontFace:'Arial', fontSize:13, color:c.meta});
  });
  addFooter(slide, slideNum, totalSlides);
}`,
  cover: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide({ masterName: 'BLANK_SLIDE' });
  slide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});
  slide.addText('DIGITAL TRANSFORMATION', {x:0.48, y:1.94, w:12.36, h:0.5, fontFace:'Arial', fontSize:18, color:'A32020', bold:true, charSpacing:1.5});
  slide.addText('Enterprise AI Strategy Framework for Sustainable Growth', {x:0.48, y:2.64, w:9.7, h:2.0, fontFace:'Georgia', fontSize:42, color:'111111', valign:'top', lineSpacingMultiple:1.15});
}`,
};

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You convert HTML slides to PptxGenJS code by learning from input/output examples.

STANDARD COLORS (use these EXACT hex values):
const c = {main:'111111', secondary:'222222', red:'A32020', maroon:'8E1E1E', zone1:'F7F9FB', rose:'F8E3E3', meta:'4A4F57', coal:'4B4F55', border:'E6E9EE'};

STANDARD FONTS:
- Titles: Georgia 28pt, color main
- Subtitles: Arial 18pt bold, color red
- Body text: Arial 12-14pt, color secondary
- Card titles: Arial 16pt bold, color main

STANDARD POSITIONS:
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

FOOTNOTES & SOURCES: If HTML contains source/footnote text, render as small text near slide bottom.

FOOTER: Do NOT render any <footer> HTML content. DO call addFooter(slide, slideNum, totalSlides) once per slide.

OUTPUT: Return ONLY a JavaScript array of functions, no markdown.`;

// ── AI Call ──────────────────────────────────────────────────────────────────

async function callAI(systemPrompt, userPrompt) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  };

  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${BASIC_AUTH}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Code extraction ──────────────────────────────────────────────────────────

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

// ── Prompt building ──────────────────────────────────────────────────────────

function buildUserPrompt(slide, slideNum, totalSlides, errorFeedback) {
  const vibeColorCode = `const c = {main:'111111',secondary:'222222',accent:'8E1E1E',accentLight:'F8E3E3',cardBg:'F7F9FB',border:'E6E9EE',meta:'4A4F57'};`;

  const slideType = slide.type || 'freestyle';
  let exampleCode = EXAMPLES.cards;
  if (slideType === 'cover') exampleCode = EXAMPLES.cover;
  else if (slideType === 'kpi') exampleCode = EXAMPLES.kpi;

  const html = slide.html.replace(/<footer[\s\S]*?<\/footer>/gi, '').replace(/src="data:image\/[^"]*"/gi, 'src="[embedded-image]"');

  let prompt = `TASK: Convert this HTML slide to a PptxGenJS function.

========== COLOR PALETTE ==========
${vibeColorCode}
VIBE: BOLD - Maximum impact - larger KPIs (2x), thicker accents (6px+), more contrast, filled icons
- Primary text: 111111
- Secondary text: 222222
- Accent: 8E1E1E
- Card backgrounds: F7F9FB
- Borders: E6E9EE

========== REFERENCE EXAMPLE ==========
${exampleCode}

========== SLIDE ${slideNum} OF ${totalSlides} ==========

>>> HTML (extract ALL text EXACTLY) <<<
${html}
>>> END HTML <<<

>>> CSS RULES <<<
${slide.css || '/* No specific CSS */'}
>>> END CSS <<<

MANDATORY — EXACT COLOR FIDELITY:
You MUST reproduce the EXACT colors from BOTH the CSS rules AND inline styles.
The CSS RULES section above is the RESOLVED stylesheet for this slide — treat it as ground truth.
1. Check the CSS RULES for each class (e.g. .card-num { color: #8E1E1E }) → use that exact hex
2. If an element also has an inline style="color: #ABC123", the inline style overrides CSS
3. Remove the # prefix for PptxGenJS: #8E1E1E → color:'8E1E1E'
4. For background-color in CSS or inline → fill:{color:'HEX'}
5. Do NOT invent your own colors. Do NOT use gray/light colors for elements that are red/maroon in the CSS.
6. The reference example is just a STRUCTURAL guide. Always use the ACTUAL colors from THIS slide's CSS/HTML.

OUTPUT FORMAT (return ONLY this, no markdown):
[
  function(pptx, slideNum, totalSlides) {
    const slide = pptx.addSlide();
    ${vibeColorCode}
    // ... your code ...
    addFooter(slide, slideNum, totalSlides);
  }
]

CRITICAL:
- Use ACTUAL text from the HTML. Never use placeholder text.
- Use ACTUAL colors from the CSS RULES. Never substitute your own colors.
- The CSS RULES are the TRUTH. If CSS says .card-num { color: #8E1E1E }, use color:'8E1E1E' — not gray, not light, not anything else.`;

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

// ── Validation ───────────────────────────────────────────────────────────────

function validateCode(codeString, slideHtml) {
  const results = { checks: [], valid: true, slideFunctions: null };

  // 1. Parse
  let slideFunctions;
  try {
    const execContext = { addFooter, COLORS };
    const wrapped = `const { addFooter, COLORS } = context; return ${codeString};`;
    slideFunctions = new Function('context', wrapped)(execContext);
    results.checks.push({ name: 'Parse', pass: true });
  } catch (e) {
    results.checks.push({ name: 'Parse', pass: false, error: e.message });
    results.valid = false;
    results.errors = [{ type: 'SyntaxError', message: e.message, details: 'Code could not be parsed.' }];
    return results;
  }

  // 2. Format
  if (!Array.isArray(slideFunctions) || typeof slideFunctions[0] !== 'function') {
    results.checks.push({ name: 'Format', pass: false, error: 'Not [function(...){...}]' });
    results.valid = false;
    results.errors = [{ type: 'FormatError', message: 'Not an array with a function' }];
    return results;
  }
  results.checks.push({ name: 'Format', pass: true });

  // 3. Execute
  const testPptx = new PptxGenJS();
  testPptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
  testPptx.layout = 'CUSTOM';
  testPptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

  try {
    slideFunctions[0](testPptx, 1, 1);
    results.checks.push({ name: 'Execute', pass: true });
  } catch (e) {
    results.checks.push({ name: 'Execute', pass: false, error: e.message });
    results.valid = false;
    results.errors = [{ type: 'RuntimeError', message: e.message, details: e.stack?.split('\n').slice(0, 3).join(' | ') }];
    return results;
  }

  // 4. Slide created
  if (!testPptx.slides || testPptx.slides.length === 0) {
    results.checks.push({ name: 'SlideCreated', pass: false, error: 'No slide' });
    results.valid = false;
    results.errors = [{ type: 'NoSlideError', message: 'No slide was created' }];
    return results;
  }
  results.checks.push({ name: 'SlideCreated', pass: true });

  // 5. Content
  const lastSlide = testPptx.slides[testPptx.slides.length - 1];
  const objCount = lastSlide._slideObjects?.length || lastSlide.data?.length || 0;
  if (objCount === 0) {
    results.checks.push({ name: 'HasContent', pass: false, error: '0 objects' });
    results.valid = false;
    results.errors = [{ type: 'EmptySlideError', message: 'Slide has no content' }];
    return results;
  }
  results.checks.push({ name: 'HasContent', pass: true, detail: `${objCount} objects` });

  results.slideFunctions = slideFunctions;
  return results;
}

// ── Core: generate one slide with retry ──────────────────────────────────────

async function generateSlide(slide, slideNum, totalSlides, logPrefix) {
  let lastCode = null;
  let lastErrors = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const errorFeedback = attempt > 0 && lastErrors.length > 0
      ? { ...lastErrors[0], previousCode: lastCode }
      : null;

    const tag = `[${logPrefix}] Attempt ${attempt + 1}/${MAX_RETRIES + 1}`;
    console.log(`\n${tag} — calling AI...`);

    const userPrompt = buildUserPrompt(slide, slideNum, totalSlides, errorFeedback);

    // Save prompt to log
    const promptFile = path.join(LOG_DIR, `${logPrefix}_attempt${attempt + 1}_prompt.txt`);
    fs.writeFileSync(promptFile, `=== SYSTEM PROMPT ===\n${SYSTEM_PROMPT}\n\n=== USER PROMPT ===\n${userPrompt}`);

    const startTime = Date.now();
    try {
      const raw = await callAI(SYSTEM_PROMPT, userPrompt);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`${tag} — AI responded in ${elapsed}s (${raw.length} chars)`);

      // Save raw response
      fs.writeFileSync(path.join(LOG_DIR, `${logPrefix}_attempt${attempt + 1}_response.txt`), raw);

      const codeString = extractJSArray(raw);
      lastCode = codeString;

      // Save extracted code
      fs.writeFileSync(path.join(LOG_DIR, `${logPrefix}_attempt${attempt + 1}_code.js`), codeString);

      const validation = validateCode(codeString, slide.html);

      // Save validation
      fs.writeFileSync(path.join(LOG_DIR, `${logPrefix}_attempt${attempt + 1}_validation.json`),
        JSON.stringify(validation.checks, null, 2));

      console.log(`${tag} — Validation:`);
      for (const c of validation.checks) {
        console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}${c.error ? ` — ${c.error}` : ''}${c.detail ? ` (${c.detail})` : ''}`);
      }

      if (validation.valid) {
        console.log(`${tag} — SUCCESS${attempt > 0 ? ` (fixed on retry ${attempt})` : ''}`);
        return { success: true, slideFunctions: validation.slideFunctions, code: codeString, attempts: attempt + 1 };
      }

      const hardErrors = (validation.errors || []).filter(e => !e.type.includes('Warning'));
      lastErrors = hardErrors.length > 0 ? hardErrors : (validation.errors || []);
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`${tag} — ERROR after ${elapsed}s: ${err.message}`);
      lastErrors = [{ type: 'APIError', message: err.message, details: '' }];
      lastCode = lastCode || '(no code generated)';

      fs.writeFileSync(path.join(LOG_DIR, `${logPrefix}_attempt${attempt + 1}_error.txt`), err.stack || err.message);
    }
  }

  console.error(`[${logPrefix}] ALL ATTEMPTS FAILED`);
  return { success: false, errors: lastErrors, attempts: MAX_RETRIES + 1 };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const arg = process.argv[2] || 'all';
  let slideKeys;

  if (arg === 'all') {
    slideKeys = ['cover', 'cards', 'kpi'];
  } else if (SAMPLE_SLIDES[arg]) {
    slideKeys = [arg];
  } else if (arg === 'custom' && process.argv[3]) {
    const customHtml = fs.readFileSync(process.argv[3], 'utf-8');
    SAMPLE_SLIDES.custom = { name: 'Custom Slide', type: 'freestyle', html: customHtml, css: '' };
    slideKeys = ['custom'];
  } else {
    console.log('Usage: node test.js [cover|cards|kpi|all|custom <path>]');
    process.exit(1);
  }

  const totalSlides = slideKeys.length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PPTX Test Harness — ${totalSlides} slide(s): ${slideKeys.join(', ')}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Max retries: ${MAX_RETRIES}`);
  console.log(`${'='.repeat(60)}`);

  const results = {};

  for (let i = 0; i < slideKeys.length; i++) {
    const key = slideKeys[i];
    const slide = SAMPLE_SLIDES[key];
    const slideNum = i + 1;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Slide ${slideNum}/${totalSlides}: ${slide.name} (${key})`);
    console.log(`${'─'.repeat(60)}`);

    // Generate individual .pptx
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
    pptx.layout = 'CUSTOM';
    pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

    const result = await generateSlide(slide, slideNum, totalSlides, key);
    results[key] = result;

    if (result.success && result.slideFunctions) {
      result.slideFunctions[0](pptx, slideNum, totalSlides);
      const outFile = path.join(OUTPUT_DIR, `${key}.pptx`);
      await pptx.writeFile({ fileName: outFile });
      console.log(`\n  → Saved: ${outFile}`);
    } else {
      console.log(`\n  → FAILED — no file generated`);
    }
  }

  // Combined deck if more than 1 slide
  if (slideKeys.length > 1) {
    const allSucceeded = slideKeys.every(k => results[k].success);
    if (allSucceeded) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log('Creating combined deck...');
      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
      pptx.layout = 'CUSTOM';
      pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

      slideKeys.forEach((key, i) => {
        results[key].slideFunctions[0](pptx, i + 1, totalSlides);
      });
      const outFile = path.join(OUTPUT_DIR, 'combined.pptx');
      await pptx.writeFile({ fileName: outFile });
      console.log(`  → Saved: ${outFile}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  for (const key of slideKeys) {
    const r = results[key];
    const status = r.success ? `OK (${r.attempts} attempt${r.attempts > 1 ? 's' : ''})` : `FAILED after ${r.attempts} attempts`;
    console.log(`  ${r.success ? '✓' : '✗'} ${key.padEnd(10)} — ${status}`);
  }
  console.log(`\nOutput: ${OUTPUT_DIR}`);
  console.log(`Logs:   ${LOG_DIR}\n`);
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
