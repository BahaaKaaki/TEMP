// PPTX Export Service using PptxGenJS
// Always uses AI for full-fidelity export, with template examples when available

import PptxGenJS from 'pptxgenjs';
import {
  COLORS,
  addFooter,
  addSourceNote,
  addSectionTracker,
  setFooterBranding,
  renderWithStoredCode,
  getRendererForSlide,
} from './pptxRenderers';
// Import template service for applying uploaded .pptx base templates
import { applyTemplateToGenerated, loadTemplateFromStorage, downloadArrayBuffer } from './pptxTemplateService';
// Import extractRelevantCSS to get only CSS rules that apply to each slide
import { extractRelevantCSS } from './aiService';
// Import the COMPLETE CSS directly from slides.css - single source of truth (kept for reference)
import FULL_SLIDE_CSS from '../styles/slides.css?raw';
// Import built-in templates to access their pptxRendererCode
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
// Import smart template matching
import { decideTemplateUsage, findBestTemplateMatch } from './templateMatcher';
// Import vibe system for PPTX styling
import { getPptxVibeStyle, getPptxVibeHint, getPptxVibeColors, getVibe } from '../utils/vibes';

// GOLD STANDARD PPTX RENDERING CODE - EXACT from top3_slides.html
// These functions produce pixel-perfect PPTX output
// The AI must use this EXACT code structure, colors, and positioning

// Standard colors - MUST use these exact hex values
const PPTX_COLORS = {
  bg: 'FFFFFF',
  main: '111111',
  secondary: '222222',
  red: 'A32020',
  maroon: '8E1E1E',
  zone1: 'F7F9FB',
  zone2: 'EEF2F6',
  meta: '4A4F57',
  rose: 'F8E3E3',
  coal: '4B4F55',
  border: 'E6E9EE'
};

// COMPLETE TRANSLATION EXAMPLE - Shows exactly how to convert HTML to PptxGenJS
// This demonstrates the full process with real content

const COMPLETE_TRANSLATION_EXAMPLE = {
  // === INPUT HTML ===
  html: `<div class="slide">
  <h1 class="title">Three strategic pillars drive enterprise AI adoption at scale</h1>
  <h2 class="subtitle">Strategic Framework</h2>
  <div class="frame">
    <div class="card-row">
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">🎯</div>
          <div class="card-num">01</div>
        </div>
        <h3>Foundation Layer</h3>
        <p>Establish robust data infrastructure with unified governance protocols across business units.</p>
        <p>Modern cloud architecture enables seamless integration and real-time analytics.</p>
        <div class="impact-box">Timeline: 6-12 months</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">⚙️</div>
          <div class="card-num">02</div>
        </div>
        <h3>Capability Building</h3>
        <p>Deploy AI-powered tools across customer service, operations, and strategic planning functions.</p>
        <p>Center of Excellence model accelerates knowledge transfer and best practices.</p>
        <div class="impact-box">Timeline: 12-18 months</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">🚀</div>
          <div class="card-num">03</div>
        </div>
        <h3>Scale & Optimize</h3>
        <p>Enterprise-wide rollout with continuous improvement loops and performance benchmarking.</p>
        <p>Measure ROI through productivity gains, cost savings, and revenue impact.</p>
        <div class="impact-box">Timeline: 18-24 months</div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>2</span></footer>
</div>`,

  // === OUTPUT PPTXGENJS CODE ===
  code: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',rose:'F8E3E3',meta:'4A4F57',coal:'4B4F55',border:'E6E9EE'};

  // From h1.title
  slide.addText("Three strategic pillars drive enterprise AI adoption at scale", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});

  // From h2.subtitle
  slide.addText("Strategic Framework", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});

  // Extracted from each .card in the HTML
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
    slide.addText(d.num, {x:xPos + cardW - 1.25, y:cardY + 0.25, w:1, h:0.5, fontFace:'Georgia', fontSize:32, color:'E0E0E0', bold:true, align:'right'});
    slide.addText(d.title, {x:xPos + 0.25, y:cardY + 1.0, w:cardW - 0.5, h:0.4, fontFace:'Arial', fontSize:16, color:c.main, bold:true});
    slide.addText(d.body, {x:xPos + 0.25, y:cardY + 1.5, w:cardW - 0.5, h:2.5, fontFace:'Arial', fontSize:12, color:c.secondary, valign:'top', lineSpacing:18});
    slide.addShape('line', {x:xPos + 0.25, y:cardY + 4.3, w:cardW - 0.5, h:0, line:{color:'DCDCDC', width:1}});
    slide.addText(d.impact, {x:xPos + 0.25, y:cardY + 4.4, w:cardW - 0.5, h:0.4, fontFace:'Arial', fontSize:11, color:c.coal, bold:true});
  });

  slide.addText('Strategy&', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`
};

// Block-header three-cards variant (maroon banner with number + title, bullet list body)
const BLOCK_HEADER_CARDS_EXAMPLE = {
  html: `<div class="slide master-standard">
  <h1 class="title">AI adoption delivers measurable yield and sustainability improvements</h1>
  <h2 class="subtitle">Impact &amp; ROI</h2>
  <div class="frame">
    <div class="card-row three-cards-d">
      <div class="card">
        <div class="block-header"><span class="block-num">01</span><h3>Increased Crop Yields</h3></div>
        <div class="block-body">
          <ul>
            <li><strong>Peak Potential:</strong> AI-driven precision farming and continuous monitoring push plants to their maximum output.</li>
            <li><strong>Optimized Cycles:</strong> Predictive analytics and automated irrigation align perfectly with crop demand.</li>
            <li><strong>Impact:</strong> Up to 25% yield increase</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <div class="block-header"><span class="block-num">02</span><h3>Resource Efficiency</h3></div>
        <div class="block-body">
          <ul>
            <li><strong>Dynamic Control:</strong> Sensor-driven control loops replace rigid schedules, drastically cutting chemical usage.</li>
            <li><strong>Targeted Application:</strong> Smart systems trigger irrigation only when needed and enable micro-dosing of fertilizers.</li>
            <li><strong>Impact:</strong> 40-70% water savings</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <div class="block-header"><span class="block-num">03</span><h3>Operational Cost Savings</h3></div>
        <div class="block-body">
          <ul>
            <li><strong>Lower Expenses:</strong> Precision application of inputs and automated scouting directly reduce operational costs.</li>
            <li><strong>Labor Reduction:</strong> Early pest detection and optimized resource allocation minimize manual labor requirements.</li>
            <li><strong>Impact:</strong> 15-25% lower input costs</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>`,

  code: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',rose:'F8E3E3',meta:'4A4F57',coal:'4B4F55',border:'E6E9EE'};

  slide.addText("AI adoption delivers measurable yield and sustainability improvements", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("Impact & ROI", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});

  const items = [
    {num:'01', title:'Increased Crop Yields', bullets:['Peak Potential: AI-driven precision farming and continuous monitoring push plants to their maximum output.','Optimized Cycles: Predictive analytics and automated irrigation align perfectly with crop demand.','Impact: Up to 25% yield increase']},
    {num:'02', title:'Resource Efficiency', bullets:['Dynamic Control: Sensor-driven control loops replace rigid schedules, drastically cutting chemical usage.','Targeted Application: Smart systems trigger irrigation only when needed and enable micro-dosing of fertilizers.','Impact: 40-70% water savings']},
    {num:'03', title:'Operational Cost Savings', bullets:['Lower Expenses: Precision application of inputs and automated scouting directly reduce operational costs.','Labor Reduction: Early pest detection and optimized resource allocation minimize manual labor requirements.','Impact: 15-25% lower input costs']}
  ];

  const startX = 0.48, cardW = 3.95, cardH = 4.90, gap = 0.25, cardY = 1.90, headerH = 0.45;

  items.forEach((d, i) => {
    const xPos = startX + (i * (cardW + gap));
    // Card background
    slide.addShape('roundRect', {x:xPos, y:cardY, w:cardW, h:cardH, fill:{color:c.zone1}, line:{color:c.border, width:0.5}, rectRadius:0.05});
    // Maroon header banner — number and title as ONE text box, wrap:false prevents "01" splitting
    slide.addText(d.num + '   ' + d.title, {
      x:xPos, y:cardY, w:cardW, h:headerH,
      fontFace:'Arial', fontSize:11, bold:true, color:'FFFFFF',
      valign:'middle', margin:0, wrap:false, isTextBox:true,
      fill:{color:c.maroon}
    });
    // Bullet list — join items with newline, bullet:true gives native PowerPoint bullets
    slide.addText(d.bullets.join('\\n'), {
      x:xPos + 0.15, y:cardY + headerH + 0.1, w:cardW - 0.3, h:cardH - headerH - 0.2,
      fontFace:'Arial', fontSize:10, color:c.secondary, valign:'top',
      bullet:true, paraSpaceAfter:6
    });
  });

  slide.addText('Strategy&', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`
};

// KPI Translation Example - complete input/output
const KPI_TRANSLATION_EXAMPLE = {
  html: `<div class="slide">
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
          <p>Intelligent document processing and workflow automation reduced manual data entry by 65%.</p>
        </div>
        <div class="detail-item">
          <h4>Customer Experience</h4>
          <p>AI-powered chatbots handle 40% of customer inquiries with 92% satisfaction rate.</p>
        </div>
        <div class="detail-item">
          <h4>Predictive Analytics</h4>
          <p>Machine learning models improved demand forecasting accuracy by 35%.</p>
        </div>
      </div>
    </div>
  </div>
</div>`,

  code: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE'};

  slide.addText("AI implementation delivers measurable returns within first year", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("Performance Metrics", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});

  const startY = 1.90, kpiX = 0.48, kpiW = 5.5, detailX = 6.3, detailW = 6.5;

  const kpis = [
    {value:'47%', label:'Reduction in manual processing time'},
    {value:'3.2x', label:'Return on AI investment (Year 1)'},
    {value:'$12M', label:'Annual operational cost savings'}
  ];

  kpis.forEach((kpi, i) => {
    const yPos = startY + (i * 1.55);
    slide.addShape('roundRect', {x:kpiX, y:yPos, w:kpiW, h:1.4, fill:{color:c.zone1}, rectRadius:0.05});
    slide.addShape('rect', {x:kpiX, y:yPos, w:0.06, h:1.4, fill:{color:c.maroon}});
    slide.addText(kpi.value, {x:kpiX + 0.3, y:yPos + 0.15, w:2.5, h:0.7, fontFace:'Georgia', fontSize:42, color:c.maroon, bold:true, valign:'middle'});
    slide.addText(kpi.label, {x:kpiX + 0.3, y:yPos + 0.85, w:kpiW - 0.5, h:0.4, fontFace:'Arial', fontSize:13, color:c.meta});
  });

  const details = [
    {title:'Process Automation', text:'Intelligent document processing and workflow automation reduced manual data entry by 65%.'},
    {title:'Customer Experience', text:'AI-powered chatbots handle 40% of customer inquiries with 92% satisfaction rate.'},
    {title:'Predictive Analytics', text:'Machine learning models improved demand forecasting accuracy by 35%.'}
  ];

  details.forEach((detail, i) => {
    const yPos = startY + (i * 1.55);
    slide.addText(detail.title, {x:detailX, y:yPos, w:detailW, h:0.35, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
    slide.addText(detail.text, {x:detailX, y:yPos + 0.4, w:detailW, h:0.95, fontFace:'Arial', fontSize:12, color:c.secondary, valign:'top', lineSpacing:17});
    if (i < details.length - 1) {
      slide.addShape('line', {x:detailX, y:yPos + 1.45, w:detailW, h:0, line:{color:c.border, width:1}});
    }
  });

  slide.addText('Strategy&', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`
};

// Cover Translation Example — plain black page (divider style, no text)
const COVER_TRANSLATION_EXAMPLE = {
  html: `<div class="slide cover-slide">
  <div class="frame">
    <div class="cover-category">DIGITAL TRANSFORMATION</div>
    <div class="cover-title">Enterprise AI Strategy Framework for Sustainable Growth</div>
  </div>
  <div class="cover-branding">Strategy&</div>
  <div class="cover-date">December 2025</div>
</div>`,

  code: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide({ masterName: 'BLANK_SLIDE' });
  // Cover — white background, no standard title/subtitle, full-bleed layout
  slide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});
  // Category label (burgundy, uppercase)
  slide.addText('DIGITAL TRANSFORMATION', {
    x: 0.48, y: 1.94, w: 12.36, h: 0.5,
    fontFace: 'Arial', fontSize: 18, color: 'A32020', bold: true, charSpacing: 1.5
  });
  // Main title (large Georgia)
  slide.addText('Enterprise AI Strategy Framework for Sustainable Growth', {
    x: 0.48, y: 2.64, w: 9.7, h: 2.0,
    fontFace: 'Georgia', fontSize: 42, color: '111111', valign: 'top', lineSpacingMultiple: 1.15
  });
  // Branding (bottom-left)
  slide.addText('Strategy&', {
    x: 0.48, y: 6.6, w: 3, h: 0.4,
    fontFace: 'Arial', fontSize: 16, color: '4A4F57', bold: true
  });
  // Date (bottom-right)
  slide.addText('December 2025', {
    x: 10.0, y: 6.6, w: 2.83, h: 0.4,
    fontFace: 'Arial', fontSize: 13, color: '4A4F57', align: 'right'
  });
}`
};


// General comprehensive example for non-template slides
const GENERAL_PPTX_EXAMPLE = `// COMPREHENSIVE EXAMPLE - Adapt this structure to your slide content:
function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();

  // ========== TITLE ==========
  slide.addText("Your Title Here", {
    x: 0.48, y: 0.42, w: 12.36, h: 0.8,
    fontFace: 'Georgia', fontSize: 28, color: '111111'
  });

  // ========== SUBTITLE (optional) ==========
  slide.addText("Subtitle or category", {
    x: 0.48, y: 1.40, w: 12.36, h: 0.4,
    fontFace: 'Arial', fontSize: 18, color: 'A32020', bold: true
  });

  // ========== CONTENT AREA (starts at y=1.90) ==========
  // Option 1: Cards in a row
  const cardW = 3.95, cardH = 4.5, cardY = 1.90;
  [0, 1, 2].forEach(i => {
    const x = 0.48 + i * (cardW + 0.22);
    slide.addShape('roundRect', {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: 'F7F9FB' },
      line: { color: 'E6E9EE', width: 0.5 },
      rectRadius: 0.05
    });
    // Add card content...
  });

  // Option 2: Two columns
  // Left column at x=0.48, w=5.5
  // Right column at x=6.5, w=6.3

  // Option 3: Full width content
  slide.addText("Full width content here", {
    x: 0.48, y: 1.90, w: 12.36, h: 4.5,
    fontFace: 'Arial', fontSize: 14, color: '222222', valign: 'top'
  });

  // ========== SHAPES ==========
  // Rectangle: slide.addShape('rect', { x, y, w, h, fill: { color: 'HEX' } });
  // Rounded rect: slide.addShape('roundRect', { x, y, w, h, fill: { color: 'HEX' }, rectRadius: 0.05 });
  // Circle: slide.addShape('ellipse', { x, y, w, h, fill: { color: 'HEX' } });
  // Line: slide.addShape('line', { x, y, w, h, line: { color: 'HEX', width: 1 } });

  // ========== FOOTER ==========
  addFooter(slide, slideNum, totalSlides);
}`;

// Export translation examples for preview UI
export { COMPLETE_TRANSLATION_EXAMPLE, KPI_TRANSLATION_EXAMPLE, COVER_TRANSLATION_EXAMPLE };

// Export credential helpers for external use
export { hasAnyCredentials };

// Export layout detection for preview UI
export function detectSlideLayoutType(html) {
  if (!html) return 'freestyle';
  if (html.includes('cover-slide') || html.includes('cover-title')) return 'cover';
  if (html.includes('card-row') || html.includes('three-cards')) return 'three-cards';
  if (html.includes('two-col') || html.includes('kpi-block')) return 'two-column-kpi';
  if (html.includes('timeline-row') || html.includes('timeline-marker')) return 'timeline';
  if (html.includes('quote-box')) return 'quote';
  if (html.includes('content-list')) return 'bullets';
  if (html.includes('grid-2x2')) return 'grid';
  if (html.includes('swot-grid')) return 'swot';
  if (html.includes('agenda-list') || html.includes('exec-summary-grid')) return 'executiveSummary';
  if (html.includes('comparison-table')) return 'comparison';
  if (html.includes('process-flow')) return 'process';
  if (html.includes('stat-row') || html.includes('stat-card')) return 'stats';
  return 'freestyle';
}

// Default system prompt for PPTX code generation (exported for settings UI)
export const DEFAULT_PPTX_SYSTEM_PROMPT = `You convert HTML slides to PptxGenJS code by learning from input/output examples.

HOW TO USE THE EXAMPLES:
You will be shown complete translation examples: INPUT HTML → OUTPUT JavaScript code.
Study each example carefully to understand how text elements map to addText calls.
Then apply the same pattern to translate NEW HTML slides.

STANDARD COLORS (use these EXACT hex values in every slide):
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

FOOTNOTES & SOURCES: If the HTML contains source/footnote text (e.g. classes like .graph-source,
.exhibit-source, .chart-source, .source-note, or small text at the bottom starting with "Source:"),
render it as small text near the bottom of the slide:
  slide.addText("Source: Company Report 2024", {x:0.48, y:6.7, w:12.36, h:0.25, fontFace:'Arial', fontSize:8, color:'4A4F57'});

BAR CHARTS: When HTML contains bar-chart-exhibit with bar-rows, render them as native PptxGenJS shapes:
- Each bar = a filled rectangle (addShape) whose width is proportional to the percentage in the style attribute
- Bar label text on the left, value text on the right
- Use graduated colors: first bar #8E1E1E (maroon), then progressively lighter: #A54545, #BC6B6B, #D49292, #EBB8B8
- Commentary panel on the right: render as a light background rect with text
- Example for a single bar at y=2.5:
  slide.addText("Category", {x:0.5, y:2.5, w:1.5, h:0.28, fontFace:'Arial', fontSize:11, color:'333333', align:'right'});
  slide.addShape('rect', {x:2.1, y:2.5, w:6.0*0.85, h:0.28, fill:{color:'8E1E1E'}, rectRadius:0.03});
  slide.addText("85%", {x:2.1+6.0*0.85+0.1, y:2.5, w:0.6, h:0.28, fontFace:'Arial', fontSize:11, color:'8E1E1E', bold:true});

WATERFALL/BRIDGE CHARTS: Render waterfall-exhibit blocks as stacked rectangles with connector lines.

AUTO-CHARTS: If you see <div class="auto-chart" data-chart='JSON'>, extract the chart data from the JSON attribute and render using slide.addChart():
  const data = JSON.parse(el.getAttribute('data-chart'));
  // For bar-v: slide.addChart(pptx.charts.BAR, chartData, {barDir:'col', ...})
  // For bar-h: slide.addChart(pptx.charts.BAR, chartData, {barDir:'bar', ...})
  // For line:  slide.addChart(pptx.charts.LINE, chartData, {...})
  // For donut: slide.addChart(pptx.charts.DOUGHNUT, chartData, {...})
  If unsure how to use addChart, render bars as rectangles (shapes) instead — that always works.

FOOTER: The footer is handled separately by addFooter(). Do NOT render any <footer> HTML element content.
Skip any text like "Strategy&" or page numbers that come from the footer — they are injected automatically.

OUTPUT: Return ONLY a JavaScript array of functions, no markdown.`;

// Default code example for AI guidance (exported for settings UI)
export const DEFAULT_PPTX_CODE_EXAMPLE = `[
  function(pptx, slideNum, totalSlides) {
    const slide = pptx.addSlide();

    // Standard title (Georgia 28pt)
    slide.addText("Your slide title here - make it insight-driven", {
      x: 0.48, y: 0.42, w: 12.36, h: 0.8,
      fontFace: 'Georgia', fontSize: 28, color: '2d2d2d'
    });

    // Standard subtitle (Arial 18pt bold, brand red)
    slide.addText("Descriptive subtitle or category label", {
      x: 0.48, y: 1.40, w: 12.36, h: 0.35,
      fontFace: 'Arial', fontSize: 18, color: 'A32020', bold: true
    });

    // Content area starts at y=1.95
    // Example: Data-driven cards in a row
    const cards = [
      { title: 'Card 1', body: 'Description text', footer: 'Impact metric' },
      { title: 'Card 2', body: 'Description text', footer: 'Impact metric' },
      { title: 'Card 3', body: 'Description text', footer: 'Impact metric' }
    ];
    const cardW = 4.0, cardH = 4.2, cardY = 1.95, gap = 0.18;

    cards.forEach((card, i) => {
      const x = 0.48 + i * (cardW + gap);

      // Card background with border
      slide.addShape('rect', {
        x, y: cardY, w: cardW, h: cardH,
        fill: { color: 'FFFFFF' },
        line: { color: 'e0e0e0', width: 0.5 }
      });

      // Top accent bar (brand red)
      slide.addShape('rect', {
        x, y: cardY, w: cardW, h: 0.055,
        fill: { color: 'A32020' }, line: { width: 0 }
      });

      // Card title
      slide.addText(card.title, {
        x: x + 0.15, y: cardY + 0.2, w: cardW - 0.3, h: 0.3,
        fontFace: 'Arial', fontSize: 13, color: '2d2d2d', bold: true
      });

      // Card body
      slide.addText(card.body, {
        x: x + 0.15, y: cardY + 0.6, w: cardW - 0.3, h: 2.8,
        fontFace: 'Arial', fontSize: 12, color: '5e5e5e', valign: 'top'
      });

      // Card footer (light red background)
      const fY = cardY + cardH - 0.35;
      slide.addShape('rect', {
        x, y: fY, w: cardW, h: 0.35,
        fill: { color: 'FDF2F4' }, line: { width: 0 }
      });
      slide.addText(card.footer.toUpperCase(), {
        x: x + 0.15, y: fY + 0.08, w: cardW - 0.3, h: 0.2,
        fontFace: 'Arial', fontSize: 11, color: '7a1818', bold: true
      });
    });

    // Footer (always add)
    addFooter(slide, slideNum, totalSlides);
  }
]`;

// Pattern-based model detection -- covers current and future versions
function isReasoningModel(model) { return /\b(gpt-5|o1|o3)\b/i.test(model || ''); }
function isGPT5Model(model) { return /\bgpt-5/i.test(model || ''); }
function isGeminiModel(model) { return /\bgemini-/i.test(model || ''); }

// Extract the actual response text from Gemini parts, skipping thinking/thought parts
function extractGeminiResponseText(parts) {
  if (!parts || parts.length === 0) return '';
  const responseParts = parts.filter(p => !p.thought);
  const targetParts = responseParts.length > 0 ? responseParts : parts;
  return targetParts.map(p => p.text).filter(Boolean).join('');
}

function isClaudeModel(model) {
  if (!model) return false;
  const lowerModel = model.toLowerCase();
  return lowerModel.includes('claude') || lowerModel.includes('anthropic');
}

// Default model for PPTX generation (GPT-4o is reliable for code generation)
const DEFAULT_PPTX_MODEL = 'gpt-4o';

// GPT 5.x models that use the OpenAI Responses API
const PPTX_GPT5_MODELS = ['gpt-5', 'gpt-5.1', 'gpt-5.2', 'gpt-5-mini'];

function isPptxGPT5Model(model) {
  if (!model) return false;
  const m = model.toLowerCase();
  return PPTX_GPT5_MODELS.some(g => m.includes(g.toLowerCase()));
}

// Parse "providerId:modelName" format
function parsePptxModelRef(ref) {
  if (!ref) return { providerId: '', modelName: '' };
  const idx = ref.indexOf(':');
  if (idx === -1) return { providerId: '', modelName: ref };
  return { providerId: ref.slice(0, idx), modelName: ref.slice(idx + 1) };
}

// Get the correct credentials based on settings (array-based provider registry)
function getCredentialsForModel(settings, modelRef) {
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  const { providerId, modelName } = parsePptxModelRef(modelRef);

  // Find provider by ID
  const provider = providers.find(p => p.id === providerId);

  if (provider) {
    const isGemini = (provider.apiUrl || '').includes('generativelanguage.googleapis.com');
    const isClaude = (provider.apiUrl || '').includes('anthropic.com');
    const isOpenAI = (provider.apiUrl || '').includes('api.openai.com');
    const actualModel = provider.azurePrefix ? `azure.${modelName}` : modelName;

    // GPT-5.x on OpenAI uses the Responses API
    const useResponsesAPI = isPptxGPT5Model(modelName) && isOpenAI && !provider.azurePrefix;

    return {
      type: isGemini ? 'gemini' : isClaude ? 'claude' : 'openai',
      apiKey: provider.apiKey || settings.apiKey || '',
      apiEndpoint: useResponsesAPI
        ? 'https://api.openai.com/v1/responses'
        : provider.apiUrl || '',
      model: actualModel,
      rawModel: modelName,
      azurePrefix: provider.azurePrefix || false,
      authType: provider.authType || 'auto',
      useResponsesAPI,
    };
  }

  // Fallback: try to detect from model name
  if (isGeminiModel(modelRef) || isGeminiModel(modelName)) {
    const geminiProvider = providers.find(p => (p.apiUrl || '').includes('generativelanguage.googleapis.com'));
    return {
      type: 'gemini',
      apiKey: geminiProvider?.apiKey || settings.apiKey || '',
      apiEndpoint: geminiProvider?.apiUrl || 'https://generativelanguage.googleapis.com/v1beta',
      model: modelName || modelRef,
      rawModel: modelName || modelRef,
      azurePrefix: false,
      useResponsesAPI: false,
    };
  }

  if (isClaudeModel(modelRef) || isClaudeModel(modelName)) {
    const claudeProvider = providers.find(p => (p.apiUrl || '').includes('anthropic.com'));
    return {
      type: 'claude',
      apiKey: claudeProvider?.apiKey || settings.apiKey || '',
      apiEndpoint: claudeProvider?.apiUrl || 'https://api.anthropic.com/v1/messages',
      model: modelName || modelRef,
      rawModel: modelName || modelRef,
      azurePrefix: false,
      useResponsesAPI: false,
    };
  }

  // Default: OpenAI-compatible
  const openaiProvider = providers.find(p => p.id === 'openai') || providers.find(p => p.apiKey);
  const fallbackModel = modelName || modelRef || DEFAULT_PPTX_MODEL;
  const isOpenAI = (openaiProvider?.apiUrl || '').includes('api.openai.com');
  const useResponsesAPI = isPptxGPT5Model(fallbackModel) && isOpenAI;
  return {
    type: 'openai',
    apiKey: openaiProvider?.apiKey || settings.apiKey || '',
    apiEndpoint: useResponsesAPI
      ? 'https://api.openai.com/v1/responses'
      : openaiProvider?.apiUrl || settings.apiEndpoint || 'https://api.openai.com/v1/chat/completions',
    model: fallbackModel,
    rawModel: fallbackModel,
    azurePrefix: false,
    useResponsesAPI,
  };
}

// Check if any credentials are configured
function hasAnyCredentials(settings) {
  if (!settings) {
    console.log('[PPTX] hasAnyCredentials: settings is null/undefined');
    return false;
  }
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  const hasKey = !!(
    settings.apiKey ||
    providers.some(p => !!p.apiKey)
  );
  console.log('[PPTX] hasAnyCredentials check:', {
    hasKey,
    legacyApiKey: !!settings.apiKey,
    providersWithKeys: providers.filter(p => p.apiKey).map(p => p.id),
  });
  return hasKey;
}

// Call Gemini API with proper format
async function callGeminiAPI(settings, credentials, systemPrompt, userPrompt) {
  const model = credentials.rawModel || credentials.model;
  const apiKey = credentials.apiKey;
  const { maxTokens, temperature } = settings;

  const baseUrl = credentials.apiEndpoint || 'https://generativelanguage.googleapis.com/v1beta';
  const endpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${systemPrompt}\n\n---\n\n${userPrompt}` }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: maxTokens || 8192,
      temperature: temperature || 0.3,
    }
  };

  console.log('[PPTX Export] Calling Gemini API...');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return extractGeminiResponseText(data.candidates?.[0]?.content?.parts);
}

// Call Claude (Anthropic) API with proper format
async function callClaudeAPI(settings, credentials, systemPrompt, userPrompt) {
  const model = credentials.model || credentials.rawModel;
  const apiKey = credentials.apiKey;
  const apiEndpoint = credentials.apiEndpoint || 'https://api.anthropic.com/v1/messages';
  const { maxTokens, temperature } = settings;

  // Claude uses a different format
  const body = {
    model: model,
    max_tokens: maxTokens || 8192,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ],
  };

  // Only add temperature if not using extended thinking
  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  console.log('[PPTX Export] Calling Claude API at:', apiEndpoint);
  console.log('[PPTX Export] Using model:', model);

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[PPTX Export] Claude API error:', error);
    throw new Error(error.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  // Claude returns content as an array of content blocks
  const textContent = data.content?.find(c => c.type === 'text');
  return textContent?.text || '';
}

function buildPptxRequestBody(credentials, settings, messages) {
  const model = credentials.model;
  const { temperature, maxTokens, reasoningEffort } = settings;
  const verbosity = settings.verbosity || null;

  // GPT-5.x on OpenAI: use Responses API format
  if (credentials.useResponsesAPI) {
    let instructions = '';
    const inputItems = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        instructions += (instructions ? '\n\n' : '') + msg.content;
      } else {
        inputItems.push({ role: msg.role, content: msg.content });
      }
    }
    const input = inputItems.length === 1 && inputItems[0].role === 'user'
      ? inputItems[0].content
      : inputItems;

    const body = { model, input };
    if (instructions) body.instructions = instructions;
    if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') {
      body.reasoning = { effort: reasoningEffort };
    } else {
      body.temperature = temperature || 0.3;
    }
    body.max_output_tokens = maxTokens || 8000;
    if (verbosity) body.text = { verbosity };
    return body;
  }

  // Chat Completions format
  const body = { model, messages };

  if (isReasoningModel(model) && reasoningEffort && reasoningEffort !== 'none') {
    body.reasoning_effort = reasoningEffort;
  } else {
    body.temperature = temperature || 0.3;
    body.max_tokens = maxTokens || 8000;
  }

  return body;
}

// Parse response content from either Responses API or Chat Completions
function parsePptxResponseContent(data, credentials) {
  if (credentials?.useResponsesAPI) {
    const output = data.output || [];
    for (const item of output) {
      if (item.type === 'message' && item.content) {
        for (const part of item.content) {
          if (part.type === 'output_text' && part.text) return part.text;
          if (part.type === 'text' && part.text) return part.text;
        }
      }
    }
    if (data.output_text) return data.output_text;
    return '';
  }
  return data.choices?.[0]?.message?.content || '';
}

// Parse HTML to extract text content
function parseHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc;
}

function getText(doc, selector) {
  const el = doc.querySelector(selector);
  return el ? el.textContent.trim() : '';
}

// Generate a simplified representation of a slide for the AI
function simplifySlideForAI(slide, index, totalSlides) {
  const doc = parseHTML(slide.html);

  // Extract key content - include FULL HTML for full fidelity
  const simplified = {
    index: index + 1,
    total: totalSlides,
    type: slide.type,
    templateId: slide.templateId || null,  // Track which template this slide uses (for debugging)
    title: getText(doc, '.title, h1, .cover-title') || slide.title,
    subtitle: getText(doc, '.subtitle, h2, .cover-category'),
    html: slide.html, // Full HTML for accurate PPTX generation
  };

  return simplified;
}

// Get relevant patterns based on HTML content using SMART MATCHING
// Uses structural analysis to find the best template match, not just templateId
function getPatternsForSlide(slide, customTemplates) {
  const html = slide.html || '';

  // Use smart template matching - analyzes HTML structure to find best match
  const decision = decideTemplateUsage(slide, customTemplates);

  if (decision.useTemplate && decision.pptxRendererCode) {
    return {
      type: 'template',
      templateId: decision.templateId,
      templateTitle: decision.templateTitle,
      confidence: decision.confidence,
      reason: decision.reason,
      source: decision.source,
      rendererCode: decision.pptxRendererCode
    };
  }

  // For freestyle/no-match slides, return type and reason
  return {
    type: 'freestyle',
    confidence: decision.confidence,
    reason: decision.reason,
    patterns: detectBasicPatterns(html)
  };
}

// Detect basic patterns for freestyle slides (for generic examples)
function detectBasicPatterns(html) {
  const patterns = ['title-subtitle', 'footer'];

  if (html.includes('cover-slide') || html.includes('cover-title')) {
    patterns.push('cover');
  }
  if (html.includes('card') || html.includes('card-row')) {
    patterns.push('card');
  }
  if (html.includes('kpi-block') || html.includes('kpi-value')) {
    patterns.push('kpi');
  }
  if (html.includes('detail-item')) {
    patterns.push('detail');
  }

  return patterns;
}

// Retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[PPTX Export] Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Generate PPTX export code for a batch of slides
async function generateBatchPPTXCode(slides, startIndex, totalSlides, settings) {
  console.log('[PPTX Export] generateBatchPPTXCode called with', slides.length, 'slides');
  console.log('[PPTX Export] Settings received:', {
    hasSettings: !!settings,
    model: settings?.model,
    pptxModel: settings?.pptxModel,
    hasProviders: !!settings?.providers,
  });

  const { pptxSystemPrompt, pptxCodeExample, customTemplates, sharedCSS } = settings;

  // Determine which model to use for PPTX generation
  const modelRef = settings.pptxModel || settings.model || DEFAULT_PPTX_MODEL;

  // Get the correct credentials for this model
  const credentials = getCredentialsForModel(settings, modelRef);

  console.log('[PPTX Export] Credentials resolved:', {
    type: credentials.type,
    model: credentials.model,
    rawModel: credentials.rawModel,
    hasApiKey: !!credentials.apiKey,
    endpoint: credentials.apiEndpoint,
    useResponsesAPI: credentials.useResponsesAPI,
  });

  if (!credentials.apiKey) {
    throw new Error('API key is required. Please configure it in Settings.');
  }

  console.log(`[PPTX Export] Using model: ${credentials.model}, provider: ${credentials.type}`);

  // Use custom prompts if provided, otherwise use defaults
  const systemPrompt = pptxSystemPrompt?.trim() || DEFAULT_PPTX_SYSTEM_PROMPT;

  // Detect layout type for each slide and determine which gold standard to use
  function detectLayoutType(html) {
    if (html.includes('cover-slide') || html.includes('cover-title') || html.includes('cover-category')) {
      return 'cover';
    }
    if (html.includes('block-header') && html.includes('block-body')) {
      return 'block-header-cards';
    }
    if (html.includes('card-row') || html.includes('three-cards') || (html.includes('card') && html.includes('card-num'))) {
      return 'three-cards';
    }
    if (html.includes('kpi-block') || html.includes('kpi-value') || html.includes('two-col')) {
      return 'two-column-kpi';
    }
    return 'freestyle';
  }

  // FIRST PASS: Collect all distinct JS examples needed across all slides
  const jsExamples = new Map(); // key -> { name, code, source }
  const slidePatterns = []; // Store pattern info for each slide

  slides.forEach((slide, i) => {
    const layoutType = detectLayoutType(slide.html);
    const patternInfo = getPatternsForSlide(slide, customTemplates);
    slidePatterns.push({ layoutType, patternInfo });

    if (patternInfo.type === 'template' && patternInfo.rendererCode) {
      // Template-based: add if not already present
      const key = `template_${patternInfo.templateId}`;
      if (!jsExamples.has(key)) {
        jsExamples.set(key, {
          key,
          name: patternInfo.templateTitle,
          code: patternInfo.rendererCode,
          source: 'template',
          confidence: patternInfo.confidence
        });
      }
    } else {
      // Generic: add the appropriate generic example
      let key, name, code;
      if (layoutType === 'block-header-cards') {
        key = 'generic_block_header_cards';
        name = 'Block Header Cards Layout';
        code = BLOCK_HEADER_CARDS_EXAMPLE.code;
      } else if (layoutType === 'three-cards') {
        key = 'generic_three_cards';
        name = 'Three Cards Layout';
        code = COMPLETE_TRANSLATION_EXAMPLE.code;
      } else if (layoutType === 'two-column-kpi') {
        key = 'generic_kpi';
        name = 'Two Column KPI Layout';
        code = KPI_TRANSLATION_EXAMPLE.code;
      } else if (layoutType === 'cover') {
        key = 'generic_cover';
        name = 'Cover Slide Layout';
        code = COVER_TRANSLATION_EXAMPLE.code;
      } else {
        // Freestyle - use three cards as default
        key = 'generic_freestyle';
        name = 'Freestyle (default reference)';
        code = COMPLETE_TRANSLATION_EXAMPLE.code;
      }
      if (!jsExamples.has(key)) {
        jsExamples.set(key, { key, name, code, source: 'generic' });
      }
    }
  });

  // Build JS EXAMPLES section (shown only once at top)
  const jsExamplesSection = Array.from(jsExamples.values()).map((example, idx) => {
    const sourceLabel = example.source === 'template'
      ? `TEMPLATE: "${example.name}"`
      : `GENERIC: ${example.name}`;
    return `
--- EXAMPLE ${idx + 1}: ${sourceLabel} ---
Reference ID: ${example.key}
${example.code}
--- END EXAMPLE ${idx + 1} ---`;
  }).join('\n');

  // SECOND PASS: Build slide sections (HTML + CSS only, reference JS example)
  const slidePrompts = slides.map((slide, i) => {
    const slideNum = startIndex + i + 1;
    const { layoutType, patternInfo } = slidePatterns[i];

    // Extract only CSS rules relevant to this specific slide
    const relevantCSS = extractRelevantCSS(slide.html);

    // Determine which JS example to reference
    let jsRef;
    if (patternInfo.type === 'template' && patternInfo.rendererCode) {
      jsRef = `template_${patternInfo.templateId}`;
    } else if (layoutType === 'three-cards') {
      jsRef = 'generic_three_cards';
    } else if (layoutType === 'two-column-kpi') {
      jsRef = 'generic_kpi';
    } else if (layoutType === 'cover') {
      jsRef = 'generic_cover';
    } else {
      jsRef = 'generic_freestyle';
    }

    const matchInfo = patternInfo.type === 'template'
      ? `Template: "${patternInfo.templateTitle}" (${patternInfo.confidence}% match)`
      : `Freestyle (${patternInfo.reason || 'no strong template match'})`;

    return `
========================================
SLIDE ${slideNum} OF ${totalSlides} — Layout: ${layoutType}
Match: ${matchInfo}
USE JS EXAMPLE: ${jsRef}
========================================

>>> HTML (extract ALL text EXACTLY) <<<
${slide.html.replace(/<footer[\s\S]*?<\/footer>/gi, '<!-- footer handled separately -->').replace(/src="data:image\/[^"]*"/gi, 'src="[embedded-image]"')}
>>> END HTML <<<

>>> CSS RULES <<<
${relevantCSS || '/* No specific CSS rules */'}
>>> END CSS <<<`;
  });

  // Get vibe styling information (from settings or default to 'bold')
  const vibeId = settings.vibe || 'bold';
  const vibeStyle = getPptxVibeStyle(vibeId);
  const vibeHint = getPptxVibeHint(vibeId);
  const vibeColorCode = getPptxVibeColors(vibeId);

  // CSS reference with vibe-specific styling
  const cssReference = `
========================================
CSS STYLING GUIDE + VIBE
========================================
${vibeHint}

COLOR PALETTE (use these exact hex values):
${vibeColorCode}
- Primary text: ${vibeStyle.colors.main}
- Secondary text: ${vibeStyle.colors.secondary}
- Accent (brand): ${vibeStyle.colors.accent}
- Card backgrounds: ${vibeStyle.colors.cardBg}
- Borders: ${vibeStyle.colors.border}
- Meta/labels: ${vibeStyle.colors.meta}

STYLING HINT for ${vibeStyle.name.toUpperCase()} vibe:
${vibeStyle.hint}
========================================
`;

  const userPrompt = `TASK: Convert HTML slides to PptxGenJS code.

${cssReference}

========================================
JAVASCRIPT EXAMPLES (reference these for each slide)
========================================
${jsExamplesSection}

========================================
HOW TO USE HTML, CSS, AND JS:
========================================
For EACH slide below, you will see:
1. HTML - Contains the CONTENT (text, structure, layout)
2. CSS - Contains the STYLING (colors, fonts, spacing)
3. "USE JS EXAMPLE: xxx" - Reference the example above for PptxGenJS API pattern

YOUR JOB for each slide:
1. READ THE HTML to understand WHAT content to render
2. EXTRACT COLORS from inline styles (style="color: #xxx" or style="background: #xxx")
3. Use extracted colors in PptxGenJS - if an element has style="color: #FF5500", use color:'FF5500'
4. LOOK UP the referenced JS example above for PptxGenJS API structure
5. Combine: HTML content + extracted colors + JS structure

IMPORTANT - COLOR EXTRACTION:
- If HTML has style="color: #ABC123" → use color:'ABC123' (remove the #)
- If HTML has style="background-color: #DEF456" → use fill:{color:'DEF456'}
- If no inline color specified, use the default theme colors from the color palette
- Always preserve the EXACT colors from the HTML inline styles

========================================
SLIDES TO TRANSLATE:
========================================
${slidePrompts.join('\n')}

========================================
OUTPUT FORMAT (return ONLY this JavaScript array, no markdown):
========================================
[
  function(pptx, slideNum, totalSlides) {
    const slide = pptx.addSlide();
    // VIBE: ${vibeStyle.name.toUpperCase()} - use these colors
    ${vibeColorCode}

    // Extract text from YOUR HTML above and create addText calls
    // USE COLORS FROM INLINE STYLES when present, otherwise use c.xxx defaults
    // Example: if HTML has <span style="color: #FF0000">text</span> → use color:'FF0000'

    // Footer (always add) - use addFooter helper
    addFooter(slide, slideNum, totalSlides);
  }
]

CRITICAL: Your output must contain the ACTUAL text AND ACTUAL COLORS from the HTML slides above.`;

  try {
    let content;

    // Route to the correct API based on credentials type
    if (credentials.type === 'gemini') {
      console.log(`[PPTX Export] Using Gemini API for model: ${credentials.model}`);
      content = await callGeminiAPI(settings, credentials, systemPrompt, userPrompt);
    } else if (credentials.type === 'claude') {
      console.log(`[PPTX Export] Using Claude API for model: ${credentials.model}`);
      content = await callClaudeAPI(settings, credentials, systemPrompt, userPrompt);
    } else {
      // OpenAI / OpenAI-compatible API
      console.log(`[PPTX Export] Using API at ${credentials.apiEndpoint} (model: ${credentials.model})`);
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Build auth headers based on provider type (Azure-style vs Bearer)
      const headers = { 'Content-Type': 'application/json' };
      if (credentials.authType === 'server') {
        // Server-managed auth: backend proxy adds the key
      } else if (credentials.azurePrefix) {
        headers['api-key'] = credentials.apiKey;
      } else {
        headers['Authorization'] = `Bearer ${credentials.apiKey}`;
      }

      const response = await fetch(credentials.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildPptxRequestBody(credentials, settings, messages)),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('[PPTX Export] API error:', error);
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      content = parsePptxResponseContent(data, credentials);
    }

    // Clean up the response - extract just the JavaScript array
    content = content
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Find the array start
    const arrayStart = content.indexOf('[');
    if (arrayStart === -1) {
      console.error('[PPTX] AI response does not contain an array');
      return '[]';
    }

    // Find matching closing bracket by counting depth (handles nested brackets in strings)
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let arrayEnd = -1;

    for (let i = arrayStart; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      // Handle string boundaries (but not escaped quotes)
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      // Only count brackets outside of strings
      if (!inString) {
        if (char === '[') depth++;
        else if (char === ']') {
          depth--;
          if (depth === 0) {
            arrayEnd = i;
            break;
          }
        }
      }
    }

    if (arrayEnd > arrayStart) {
      content = content.substring(arrayStart, arrayEnd + 1);
    }

    // Remove any trailing semicolons that would cause syntax errors in `return ${code}`
    content = content.replace(/;\s*$/, '').trim();

    console.log('[PPTX] Cleaned code length:', content.length, 'chars');
    return content;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

// Fallback: generate structured slide when AI generation fails
function generateFallbackSlide(pptx, slide, slideNum, totalSlides, masterName) {
  const pptxSlide = masterName ? pptx.addSlide({ masterName }) : pptx.addSlide();
  const doc = parseHTML(slide.html);
  console.log('[PPTX Fallback] Generating fallback for slide', slideNum);

  // Detect special slide types that use full-bleed layouts (no standard title/subtitle)
  const isCover = slide.type === 'cover' || slide.templateId === 'cover' ||
    (slide.html && (slide.html.includes('cover-slide') || slide.html.includes('master-cover')));
  const isDivider = slide.type === 'divider' || slide.templateId === 'sectionDivider' ||
    (slide.html && slide.html.includes('section-divider'));
  const isThankYou = slide.type === 'closing' || slide.templateId === 'thankYou' ||
    (slide.html && slide.html.includes('thank-you'));

  // Cover slide fallback — white background, centered text
  if (isCover) {
    pptxSlide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});
    const category = getText(doc, '.cover-category') || '';
    const coverTitle = getText(doc, '.cover-title') || getText(doc, '.title') || 'Presentation';
    const branding = getText(doc, '.cover-branding') || '';
    if (category) {
      pptxSlide.addText(category.toUpperCase(), {
        x: 0.48, y: 1.94, w: 12.36, h: 0.5,
        fontFace: 'Arial', fontSize: 18, color: COLORS.red, bold: true
      });
    }
    pptxSlide.addText(coverTitle, {
      x: 0.48, y: 2.64, w: 9.7, h: 2.0,
      fontFace: 'Georgia', fontSize: 42, color: COLORS.main, valign: 'top'
    });
    if (branding) {
      pptxSlide.addText(branding, {
        x: 0.48, y: 6.6, w: 3, h: 0.4,
        fontFace: 'Arial', fontSize: 16, color: COLORS.meta, bold: true
      });
    }
    addFooter(pptxSlide, slideNum, totalSlides);
    return;
  }

  // Section divider fallback — accent bar + centered title
  if (isDivider) {
    pptxSlide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});
    pptxSlide.addShape('rect', {x:0, y:0, w:0.33, h:7.5, fill:{color: COLORS.maroon}});
    const sectionNum = getText(doc, '.section-divider-number, .divider-number') || '';
    const sectionTitle = getText(doc, '.section-divider-title, .divider-title') || getText(doc, '.title') || 'Section';
    const sectionSub = getText(doc, '.section-divider-subtitle, .divider-subtitle') || '';
    if (sectionNum) {
      pptxSlide.addText(sectionNum, {
        x: 0.83, y: 0.69, w: 8, h: 2,
        fontFace: 'Georgia', fontSize: 80, color: COLORS.zone2, bold: true
      });
    }
    pptxSlide.addText(sectionTitle, {
      x: 1.1, y: 2.5, w: 10, h: 1.5,
      fontFace: 'Georgia', fontSize: 36, color: COLORS.main, bold: true
    });
    if (sectionSub) {
      pptxSlide.addText(sectionSub, {
        x: 1.1, y: 4.0, w: 9.5, h: 0.8,
        fontFace: 'Arial', fontSize: 16, color: COLORS.meta
      });
    }
    addFooter(pptxSlide, slideNum, totalSlides);
    return;
  }

  // Thank You slide fallback — centered layout
  if (isThankYou) {
    pptxSlide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});
    const thankTitle = getText(doc, '.thank-you-title') || 'Thank You';
    const thankSub = getText(doc, '.thank-you-subtitle') || '';
    pptxSlide.addText(thankTitle, {
      x: 1.5, y: 2.5, w: 10.333, h: 1.2,
      fontFace: 'Georgia', fontSize: 42, color: COLORS.main, align: 'center', valign: 'middle'
    });
    if (thankSub) {
      pptxSlide.addText(thankSub, {
        x: 2.5, y: 3.7, w: 8.333, h: 0.5,
        fontFace: 'Arial', fontSize: 16, color: COLORS.meta, align: 'center'
      });
    }
    const branding = getText(doc, '.cover-branding') || '';
    if (branding) {
      pptxSlide.addText(branding, {
        x: 0.48, y: 6.6, w: 3, h: 0.4,
        fontFace: 'Arial', fontSize: 16, color: COLORS.meta, bold: true
      });
    }
    return;
  }

  // Standard slide fallback (title + subtitle + content)
  const title = getText(doc, '.title, h1, .cover-title');
  const subtitle = getText(doc, '.subtitle, h2, .cover-category');

  // Add title
  if (title) {
    pptxSlide.addText(title, {
      x: 0.48, y: 0.42, w: 12.36, h: 0.8,
      fontFace: 'Georgia', fontSize: 28, color: COLORS.main
    });
  }

  // Add subtitle
  if (subtitle) {
    pptxSlide.addText(subtitle, {
      x: 0.48, y: 1.40, w: 12.36, h: 0.4,
      fontFace: 'Arial', fontSize: 18, color: COLORS.red, bold: true
    });
  }

  // Try to extract structured content
  const contentY = 2.0;

  // Try to find cards (multiple selectors for various card structures)
  const cards = doc.querySelectorAll('.card, .grid-cell, .kpi-block, .stat-box, .feature-card, .info-card');
  if (cards.length > 0) {
    const cardW = 12.36 / Math.min(cards.length, 4) - 0.2;
    const cardH = 4.0;

    cards.forEach((card, i) => {
      if (i >= 4) return; // Max 4 cards
      const x = 0.48 + i * (cardW + 0.2);

      // Card background
      pptxSlide.addShape('rect', {
        x, y: contentY, w: cardW, h: cardH,
        fill: { color: COLORS.zone1 },
        line: { color: COLORS.border, width: 0.5 }
      });

      // Top accent bar
      pptxSlide.addShape('rect', {
        x, y: contentY, w: cardW, h: 0.06,
        fill: { color: COLORS.maroon }, line: { width: 0 }
      });

      // Try to find icon/emoji
      const iconEl = card.querySelector('.card-icon-circle, .icon, .emoji');
      if (iconEl) {
        const icon = iconEl.textContent.trim();
        // Icon circle background
        pptxSlide.addShape('ellipse', {
          x: x + 0.2, y: contentY + 0.2, w: 0.5, h: 0.5,
          fill: { color: COLORS.rose }
        });
        pptxSlide.addText(icon, {
          x: x + 0.2, y: contentY + 0.2, w: 0.5, h: 0.5,
          fontSize: 14, align: 'center', valign: 'middle'
        });
      }

      // Card number if present
      const numEl = card.querySelector('.card-num, .number');
      if (numEl) {
        pptxSlide.addText(numEl.textContent.trim(), {
          x: x + cardW - 1, y: contentY + 0.2, w: 0.8, h: 0.5,
          fontFace: 'Georgia', fontSize: 28, color: 'E0E0E0', align: 'right'
        });
      }

      // Card title
      const cardTitle = card.querySelector('.card-title, .card-header, h3, h4, strong');
      if (cardTitle) {
        pptxSlide.addText(cardTitle.textContent.trim(), {
          x: x + 0.15, y: contentY + 0.85, w: cardW - 0.3, h: 0.4,
          fontFace: 'Arial', fontSize: 14, color: COLORS.main, bold: true
        });
      }

      // Card body - collect all paragraphs
      const paragraphs = card.querySelectorAll('p');
      let bodyText = '';
      paragraphs.forEach(p => {
        const text = p.textContent.trim();
        if (text && !text.includes(cardTitle?.textContent || '___')) {
          bodyText += (bodyText ? '\n\n' : '') + text;
        }
      });
      if (bodyText) {
        pptxSlide.addText(bodyText.substring(0, 400), {
          x: x + 0.15, y: contentY + 1.35, w: cardW - 0.3, h: 2.2,
          fontFace: 'Arial', fontSize: 11, color: COLORS.secondary, valign: 'top'
        });
      }

      // Impact box if present
      const impactEl = card.querySelector('.impact-box, .footer, .meta');
      if (impactEl) {
        pptxSlide.addShape('line', {
          x: x + 0.15, y: contentY + 3.6, w: cardW - 0.3, h: 0,
          line: { color: COLORS.border, width: 1 }
        });
        pptxSlide.addText(impactEl.textContent.trim(), {
          x: x + 0.15, y: contentY + 3.7, w: cardW - 0.3, h: 0.3,
          fontFace: 'Arial', fontSize: 10, color: COLORS.coal, bold: true
        });
      }
    });
  } else {
    // Try bullet points
    const bullets = doc.querySelectorAll('li, .bullet-item, .list-item');
    if (bullets.length > 0) {
      bullets.forEach((bullet, i) => {
        if (i >= 8) return; // Max 8 bullets
        const y = contentY + i * 0.6;

        // Bullet marker
        pptxSlide.addShape('ellipse', {
          x: 0.48, y: y + 0.15, w: 0.12, h: 0.12,
          fill: { color: COLORS.maroon }
        });

        // Bullet text
        pptxSlide.addText(bullet.textContent.trim().substring(0, 200), {
          x: 0.75, y: y, w: 11.5, h: 0.5,
          fontFace: 'Arial', fontSize: 14, color: COLORS.main, valign: 'middle'
        });
      });
    } else {
      // Try to extract all paragraphs
      const paragraphs = doc.querySelectorAll('p, .content, .body, .text');
      if (paragraphs.length > 0) {
        let yPos = contentY;
        paragraphs.forEach((p, i) => {
          if (i >= 6 || yPos > 6.5) return;
          const text = p.textContent.trim();
          if (text && text.length > 5 && text !== title && text !== subtitle) {
            pptxSlide.addText(text.substring(0, 400), {
              x: 0.48, y: yPos, w: 12.36, h: 0.8,
              fontFace: 'Arial', fontSize: 13, color: COLORS.secondary, valign: 'top'
            });
            yPos += 0.85;
          }
        });
      } else {
        // Final fallback: clean body text in structured blocks
        const bodyText = doc.body.textContent.replace(/\s+/g, ' ').trim()
          .replace(title || '', '').replace(subtitle || '', '').trim();

        if (bodyText && bodyText.length > 10) {
          // Split into chunks for readability
          const chunks = bodyText.match(/.{1,200}(?:\s|$)/g) || [bodyText];
          chunks.slice(0, 5).forEach((chunk, i) => {
            pptxSlide.addText(chunk.trim(), {
              x: 0.48, y: contentY + i * 0.9, w: 12.36, h: 0.8,
              fontFace: 'Arial', fontSize: 14, color: COLORS.secondary, valign: 'top'
            });
          });
        }
      }
    }
  }

  // Source/footnote
  addSourceNote(pptxSlide, slide.html);

  addFooter(pptxSlide, slideNum, totalSlides);
}

// Main export function - ALWAYS uses AI for full-fidelity export
export async function exportToPPTX(slides, filename = 'presentation.pptx', settings = null, onProgress = null, templates = null) {
  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
  pptx.layout = 'CUSTOM';
  pptx.title = filename.replace('.pptx', '');
  pptx.author = 'Edwin AI';

  // Define a blank slide master for separator/divider slides (no title/subtitle placeholders)
  pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

  const totalSlides = slides.length;
  // Set footer branding from settings (used by all addFooter calls)
  const footerBranding = settings?.footerBranding || 'Strategy&';
  setFooterBranding(footerBranding);
  // Check if AI generation is available (any provider has credentials)
  const useAIGeneration = settings && hasAnyCredentials(settings);
  // Use batch size from settings, default to 1 for reliability (single slide at a time works best)
  const BATCH_SIZE = settings?.pptxBatchSize || 1;
  const PARALLEL_BATCHES = Math.max(1, Math.min(10, settings?.pptxParallelBatches || 3));

  // Log export configuration
  const modelRef = settings?.pptxModel || settings?.model || DEFAULT_PPTX_MODEL;
  const credentials = settings ? getCredentialsForModel(settings, modelRef) : null;
  const activeVibe = settings?.vibe || 'bold';
  console.log('[PPTX Export] Starting export...');
  console.log('[PPTX Export] Total slides:', totalSlides);
  console.log('[PPTX Export] Batch size:', BATCH_SIZE);
  console.log('[PPTX Export] Parallel batches:', PARALLEL_BATCHES);
  console.log('[PPTX Export] AI generation enabled:', useAIGeneration);
  console.log('[PPTX Export] Model:', credentials?.model || modelRef);
  console.log('[PPTX Export] Provider:', credentials?.type || 'none');
  console.log('[PPTX Export] API key present:', !!credentials?.apiKey);
  console.log('[PPTX Export] Vibe:', activeVibe);

  // Helper to get pptxRendererCode for a slide (from slide or template)
  const getRendererCode = (slide) => {
    if (slide.pptxRendererCode) {
      return slide.pptxRendererCode;
    }
    // Skip template fallback: when a slide's pptxRendererCode was cleared
    // (because HTML changed), fall through to AI generation which reads
    // the current slide.html instead of using static template renderers.
    return null;
  };

  // Categorize slides: stored code > built-in renderer > AI generation
  const slideRenderInfo = slides.map((slide, index) => {
    // Priority 1: Check for stored pptxRendererCode (from slide or template)
    const rendererCode = getRendererCode(slide);
    if (rendererCode) {
      return { slide: { ...slide, pptxRendererCode: rendererCode }, index, method: 'stored' };
    }

    // Priority 2: Image slides MUST use built-in renderer — never send base64 data to AI
    // (base64 payloads are 30-500KB and cause empty responses / timeouts)
    const isImageSlide = slide.templateId === 'image-full' || slide.templateId === 'image-content'
      || (slide.html && (slide.html.includes('slide-image-full') || slide.html.includes('frame-image')));
    if (isImageSlide) {
      const imageRenderer = getRendererForSlide(slide);
      if (imageRenderer) {
        return { slide, index, method: 'builtin', renderer: imageRenderer };
      }
    }

    // Priority 3: AI generation for custom/freestyle content
    return { slide, index, method: 'ai' };
  });

  const slidesNeedingAI = slideRenderInfo.filter(s => s.method === 'ai');
  let processedSlides = 0;

  console.log('[PPTX Export] Slides with stored code:', slideRenderInfo.filter(s => s.method === 'stored').length);
  console.log('[PPTX Export] Slides with built-in renderer:', slideRenderInfo.filter(s => s.method === 'builtin').length);
  console.log('[PPTX Export] Slides needing AI generation:', slidesNeedingAI.length);

  // Warn if AI is not available but slides need it
  if (slidesNeedingAI.length > 0 && !useAIGeneration) {
    console.warn('[PPTX Export] WARNING: AI generation not available. Using basic fallback.');
    console.warn('[PPTX Export] To enable AI generation, configure API key and endpoint in Settings.');
    if (onProgress) {
      onProgress({
        phase: 'warning',
        processed: 0,
        total: totalSlides,
        message: 'AI generation not available. Using basic text export. Configure API key in Settings for full fidelity.',
      });
    }
    // Wait a moment to show the warning
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Phase 1: Generate AI code for ALL slides without stored code
  // This ensures full-fidelity export with proper template examples
  if (slidesNeedingAI.length > 0 && useAIGeneration) {
    if (onProgress) {
      onProgress({
        phase: 'generating',
        processed: 0,
        total: totalSlides,
        message: `Generating full-fidelity PPTX code for ${slidesNeedingAI.length} slides...`
      });
    }

    // Process in batches
    const batches = [];
    for (let i = 0; i < slidesNeedingAI.length; i += BATCH_SIZE) {
      batches.push(slidesNeedingAI.slice(i, i + BATCH_SIZE));
    }

    // Process a single batch — generate AI code and parse it
    const processBatch = async (batch, batchIndex) => {
      const batchSlides = batch.map(b => b.slide);

      // Use retry logic for AI generation
      let codeString = null;
      try {
        console.log(`[PPTX Export] Generating AI code for batch ${batchIndex + 1}/${batches.length}...`);
        codeString = await retryWithBackoff(
          () => generateBatchPPTXCode(batchSlides, batch[0].index, totalSlides, settings),
          3, // max retries
          1000 // base delay 1 second
        );
        console.log(`[PPTX Export] AI returned ${codeString.length} characters of code`);
      } catch (err) {
        console.error(`[PPTX Export] AI generation failed for batch ${batchIndex + 1} after retries:`, err);
        return; // Will fall back to structured generation during render phase
      }

      if (codeString) {
        // Parse and store the generated code
        const execContext = { pptx: null, addFooter, COLORS };

        // Clean up the code string - remove any text before/after the array
        let cleanCode = codeString.trim();
        const arrayStart = cleanCode.indexOf('[');
        const arrayEnd = cleanCode.lastIndexOf(']');
        if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
          cleanCode = cleanCode.substring(arrayStart, arrayEnd + 1);
        }

        const wrappedCode = `
          const { addFooter, COLORS } = context;
          return ${cleanCode};
        `;

        let slideFunctions;
        try {
          slideFunctions = new Function('context', wrappedCode)(execContext);
        } catch (parseErr) {
          console.error(`[PPTX Export] Failed to parse AI code for batch ${batchIndex + 1}:`, parseErr);
          console.error(`[PPTX Export] Code snippet:`, cleanCode.substring(0, 500));
          return; // Skip — will use fallback
        }

        if (Array.isArray(slideFunctions)) {
          console.log(`[PPTX Export] Successfully parsed ${slideFunctions.length} slide functions`);
          slideFunctions.forEach((fn, i) => {
            if (typeof fn === 'function' && batch[i]) {
              // Store the generated function for later rendering
              batch[i].generatedFunction = fn;
            }
          });
        } else {
          console.warn(`[PPTX Export] AI did not return an array of functions`);
        }
      }
    };

    // Process batches in parallel waves (up to PARALLEL_BATCHES concurrent)
    for (let waveStart = 0; waveStart < batches.length; waveStart += PARALLEL_BATCHES) {
      const waveEnd = Math.min(waveStart + PARALLEL_BATCHES, batches.length);
      const waveBatches = batches.slice(waveStart, waveEnd);

      if (onProgress) {
        onProgress({
          phase: 'generating',
          batch: waveStart + 1,
          totalBatches: batches.length,
          processed: processedSlides,
          total: totalSlides,
          message: `Generating PPTX code (batches ${waveStart + 1}–${waveEnd} of ${batches.length}, ${PARALLEL_BATCHES} parallel)...`
        });
      }

      // Fire all batches in this wave concurrently
      await Promise.all(
        waveBatches.map((batch, i) => processBatch(batch, waveStart + i))
      );

      processedSlides += waveBatches.reduce((sum, b) => sum + b.length, 0);

      // Small delay between waves to avoid rate limiting
      if (waveEnd < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  // Phase 2: Render all slides in order
  if (onProgress) {
    onProgress({
      phase: 'rendering',
      processed: 0,
      total: totalSlides,
      message: 'Rendering slides to PowerPoint...'
    });
  }

  for (let i = 0; i < slides.length; i++) {
    const renderInfo = slideRenderInfo[i];
    const slide = renderInfo.slide; // Use the slide from renderInfo (may have pptxRendererCode attached)
    let rendered = false;

    // Method 1: Use stored renderer code (if explicitly provided)
    if (renderInfo.method === 'stored') {
      if (renderWithStoredCode(pptx, slide, i + 1, totalSlides)) {
        rendered = true;
      }
    }

    // Method 2: Use built-in renderer (image slides, known templates)
    if (!rendered && renderInfo.method === 'builtin' && renderInfo.renderer) {
      try {
        renderInfo.renderer(pptx, slide, i + 1, totalSlides);
        rendered = true;
      } catch (err) {
        console.warn(`Built-in renderer error for slide ${i + 1}:`, err);
      }
    }

    // Method 3: Use AI-generated function (from Phase 1)
    if (!rendered && renderInfo.method === 'ai' && renderInfo.generatedFunction) {
      try {
        renderInfo.generatedFunction(pptx, i + 1, totalSlides);
        rendered = true;
      } catch (err) {
        console.warn(`AI-generated code error for slide ${i + 1}:`, err);
      }
    }

    // Method 4: Try built-in renderer as final fallback
    if (!rendered) {
      const fallbackRenderer = getRendererForSlide(slide);
      if (fallbackRenderer) {
        try {
          fallbackRenderer(pptx, slide, i + 1, totalSlides);
          rendered = true;
        } catch (err) {
          console.warn(`Fallback renderer error for slide ${i + 1}:`, err);
        }
      }
    }

    // Method 4: Final fallback - basic text extraction
    // Divider/cover/closing slides use the blank master (no title/subtitle placeholders)
    if (!rendered) {
      const isDivider = slide.type === 'divider' || slide.templateId === 'sectionDivider' ||
        (slide.html && slide.html.includes('section-divider'));
      const isCover = slide.type === 'cover' || slide.templateId === 'cover' ||
        (slide.html && (slide.html.includes('cover-slide') || slide.html.includes('master-cover')));
      const isClosing = slide.type === 'closing' || slide.templateId === 'thankYou' ||
        (slide.html && slide.html.includes('thank-you'));
      const useBlankMaster = isDivider || isCover || isClosing;
      generateFallbackSlide(pptx, slide, i + 1, totalSlides, useBlankMaster ? 'BLANK_SLIDE' : null);
    }

    // Add section tracker to the rendered slide (works for all methods)
    if (slide.sectionLabel || slide.subSectionLabel) {
      try {
        const pptxSlides = pptx.slides;
        if (pptxSlides?.length > 0) {
          addSectionTracker(pptxSlides[pptxSlides.length - 1], slide.sectionLabel, slide.subSectionLabel);
        }
      } catch (e) {
        console.warn(`[PPTX] Tracker render error for slide ${i + 1}:`, e.message);
      }
    }

    processedSlides++;

    if (onProgress && processedSlides % 5 === 0) {
      onProgress({
        phase: 'rendering',
        processed: processedSlides,
        total: totalSlides,
        message: `Rendered ${processedSlides} of ${totalSlides} slides`
      });
    }
  }

  if (onProgress) {
    onProgress({
      phase: 'finalizing',
      processed: processedSlides,
      total: totalSlides,
      message: 'Creating PowerPoint file...'
    });
  }

  // Check if a base template is available
  let templateData = null;
  try {
    templateData = await loadTemplateFromStorage();
    console.log('[PPTX Export] Template loaded:', templateData ? templateData.fileName : 'none');
  } catch (e) {
    console.warn('[PPTX Export] Could not load base template from storage:', e);
  }

  if (templateData && templateData.data) {
    // Template-based export: generate arraybuffer, merge with template, download
    console.log('[PPTX Export] Applying base template:', templateData.fileName, '(' + templateData.data.byteLength + ' bytes)');
    if (onProgress) {
      onProgress({
        phase: 'finalizing',
        processed: processedSlides,
        total: totalSlides,
        message: `Applying template "${templateData.fileName}"...`
      });
    }
    try {
      const generatedBuf = await pptx.write({ outputType: 'arraybuffer' });
      console.log('[PPTX Export] Generated buffer:', generatedBuf.byteLength, 'bytes');
      const mergedBuf = await applyTemplateToGenerated(generatedBuf, templateData.data);
      console.log('[PPTX Export] Merged buffer:', mergedBuf.byteLength, 'bytes');
      downloadArrayBuffer(mergedBuf, filename);
    } catch (mergeErr) {
      console.error('[PPTX Export] Template merge failed, falling back to standard export:', mergeErr);
      await pptx.writeFile({ fileName: filename });
    }
  } else {
    // Standard export: direct download
    console.log('[PPTX Export] No base template found, using standard export');
    await pptx.writeFile({ fileName: filename });
  }

  if (onProgress) {
    onProgress({
      phase: 'complete',
      processed: totalSlides,
      total: totalSlides,
      message: 'Download complete!'
    });
  }
}

// Quick export without AI (uses fallback for all slides)
export async function exportToPPTXStatic(slides, filename = 'presentation.pptx') {
  return exportToPPTX(slides, filename, null, null);
}

// Export a single slide to PPTX
export async function exportSingleSlideToPPTX(slide, slideNumber, totalSlides, filename, settings = null, onProgress = null, templates = null) {
  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
  pptx.layout = 'CUSTOM';
  pptx.title = filename.replace('.pptx', '');
  pptx.author = 'Edwin AI';

  // Define a blank slide master for separator/divider slides (no title/subtitle placeholders)
  pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

  // Set footer branding from settings
  setFooterBranding(settings?.footerBranding || 'Strategy&');
  const useAIGeneration = settings && hasAnyCredentials(settings);

  // Debug logging for vibe
  console.log('[PPTX Single] Exporting slide', slideNumber, 'of', totalSlides);
  console.log('[PPTX Single] Vibe:', settings?.vibe || 'not set (using default: bold)');
  console.log('[PPTX Single] AI generation:', useAIGeneration ? 'enabled' : 'disabled (no API credentials)');

  if (onProgress) {
    onProgress({ phase: 'generating', message: 'Generating PPTX code...' });
  }

  try {
    // Check for pptxRendererCode on slide itself OR from template definition
    let rendererCode = slide.pptxRendererCode || null;
    if (!rendererCode && slide.templateId && templates && templates.length > 0) {
      const template = templates.find(t => t.id === slide.templateId);
      if (template && template.pptxRendererCode) {
        rendererCode = template.pptxRendererCode;
        console.log(`[PPTX Single] Found renderer code from template: ${slide.templateId}`);
      }
    }

    // Image slides MUST use built-in renderer — base64 data is too large for AI
    const isImageSlide = slide.templateId === 'image-full' || slide.templateId === 'image-content'
      || (slide.html && (slide.html.includes('slide-image-full') || slide.html.includes('frame-image')));
    const imageRenderer = isImageSlide ? getRendererForSlide(slide) : null;

    let rendered = false;

    // Priority 1: stored renderer code (from slide or template)
    if (rendererCode) {
      renderWithStoredCode(pptx, { ...slide, pptxRendererCode: rendererCode }, slideNumber, totalSlides);
      rendered = true;
    }

    // Priority 2: image slides — built-in renderer (base64 too large for AI)
    if (!rendered && imageRenderer) {
      imageRenderer(pptx, slide, slideNumber, totalSlides);
      rendered = true;
    }

    // Priority 3: AI generation — produces full-fidelity PptxGenJS code
    // (matches the full deck export path which also prefers AI over built-in)
    if (!rendered && useAIGeneration) {
      try {
        const codeString = await generateBatchPPTXCode([slide], slideNumber - 1, totalSlides, settings);
        const execContext = { pptx: null, addFooter, COLORS };
        const wrappedCode = `
          const { addFooter, COLORS } = context;
          return ${codeString};
        `;
        const slideFunctions = new Function('context', wrappedCode)(execContext);
        if (Array.isArray(slideFunctions) && typeof slideFunctions[0] === 'function') {
          slideFunctions[0](pptx, slideNumber, totalSlides);
          rendered = true;
        } else {
          console.warn('[PPTX Single] AI did not return valid function array, using fallback');
        }
      } catch (codeErr) {
        console.warn('[PPTX Single] AI code execution failed, using fallback:', codeErr.message);
      }
    }

    // Priority 4: built-in renderer as fallback (generic content extraction)
    if (!rendered) {
      const fallbackRenderer = getRendererForSlide(slide);
      if (fallbackRenderer) {
        try {
          fallbackRenderer(pptx, slide, slideNumber, totalSlides);
          rendered = true;
        } catch (err) {
          console.warn('[PPTX Single] Built-in renderer failed:', err.message);
        }
      }
    }

    // Priority 5: basic text extraction fallback
    if (!rendered) {
      generateFallbackSlide(pptx, slide, slideNumber, totalSlides);
    }

    // Add section tracker to the rendered slide
    if (slide.sectionLabel || slide.subSectionLabel) {
      try {
        const pptxSlides = pptx.slides;
        if (pptxSlides?.length > 0) {
          addSectionTracker(pptxSlides[pptxSlides.length - 1], slide.sectionLabel, slide.subSectionLabel);
        }
      } catch (e) {
        console.warn('[PPTX Single] Tracker render error:', e.message);
      }
    }

    if (onProgress) {
      onProgress({ phase: 'rendering', message: 'Rendering PPTX...' });
    }

    // Check if a base template is available
    let templateData = null;
    try {
      templateData = await loadTemplateFromStorage();
    } catch (e) {
      console.warn('[PPTX Single] Could not load base template:', e);
    }

    if (templateData && templateData.data) {
      try {
        const generatedBuf = await pptx.write({ outputType: 'arraybuffer' });
        const mergedBuf = await applyTemplateToGenerated(generatedBuf, templateData.data);
        downloadArrayBuffer(mergedBuf, filename);
      } catch (mergeErr) {
        console.error('[PPTX Single] Template merge failed, falling back:', mergeErr);
        await pptx.writeFile({ fileName: filename });
      }
    } else {
      await pptx.writeFile({ fileName: filename });
    }

    if (onProgress) {
      onProgress({ phase: 'complete', message: 'Download complete!' });
    }
  } catch (err) {
    console.error('[PPTX Single Export] Error:', err);
    throw err;
  }
}

// Test PPTX code generation for a single slide (returns code without downloading)
export async function testPPTXCodeGeneration(slide, slideNumber, totalSlides, settings) {
  if (!settings || !hasAnyCredentials(settings)) {
    throw new Error('API key required for PPTX code generation. Please configure it in Settings.');
  }

  console.log('[PPTX Test] Generating code for slide', slideNumber);
  const codeString = await generateBatchPPTXCode([slide], slideNumber - 1, totalSlides, settings);

  // Validate the code
  let validationResult = { valid: false, error: null };
  try {
    const execContext = { pptx: null, addFooter, COLORS };
    const wrappedCode = `
      const { addFooter, COLORS } = context;
      return ${codeString};
    `;
    const slideFunctions = new Function('context', wrappedCode)(execContext);
    if (Array.isArray(slideFunctions) && typeof slideFunctions[0] === 'function') {
      validationResult.valid = true;
    } else {
      validationResult.error = 'AI did not return a valid function array';
    }
  } catch (parseErr) {
    validationResult.error = parseErr.message;
  }

  return {
    code: codeString,
    validation: validationResult,
  };
}
