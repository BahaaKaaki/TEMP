// Export Service - Download all slides as a single HTML file

import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// File naming nomenclature utility
export function generateFileName(baseName, format, settings = {}) {
  const {
    useNomenclature = true,
    nomenclaturePattern = 'yyyy-mm-dd_{name}',
    version = 1,
  } = settings;

  if (!useNomenclature) {
    return `${baseName}.${format}`;
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  // Clean the base name (remove special chars)
  const cleanName = baseName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-').toLowerCase();

  // Apply pattern
  const fileName = nomenclaturePattern
    .replace('yyyy', yyyy)
    .replace('mm', mm)
    .replace('dd', dd)
    .replace('{name}', cleanName)
    .replace('{version}', version);

  return `${fileName}.${format}`;
}

// Base CSS that's always included (from slides.css)
const BASE_SLIDE_CSS = `
:root {
  --slide-w: 960px;
  --slide-min-h: 540px;
  --left-x: 35px;
  --title-w: 890px;
  --subtitle-w: 890px;
  --title-y: 30px;
  --subtitle-y: 101px;
  --frame-y: 137px;
  --frame-w: 890px;
  --right-bound: 925px;
  --bg: #fff;
  --main: #111111;
  --secondary: #222222;
  --meta: #4A4F57;
  --red: #A32020;
  --zone1: #F7F9FB;
  --zone2: #EEF2F6;
  --maroon: #8E1E1E;
  --rose: #F8E3E3;
  --coal: #4B4F55;
  --gH: 16px;
  --gV: 12px;
  --radius: 4px;
  --border: #E6E9EE;
}

html, body {
  margin: 0;
  background: #e0e0e0;
  color: var(--main);
  font-family: Arial, sans-serif;
}

.deck {
  display: flex;
  flex-direction: column;
  gap: 30px;
  padding: 30px;
  padding-bottom: 100px;
  max-width: 1020px;
  margin: 0 auto;
}

.slide-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slide-label {
  font-size: 11px;
  color: var(--meta);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding-left: 5px;
}

.slide {
  position: relative;
  width: var(--slide-w);
  height: var(--slide-min-h);
  margin: 0 auto;
  border: 1px solid var(--border);
  background: var(--bg);
  box-sizing: border-box;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.12);
  border-radius: 4px;
  font-family: Arial, sans-serif;
}

.slide .title {
  position: absolute;
  left: var(--left-x);
  top: var(--title-y);
  width: var(--title-w);
  font: 400 28px/1.2 Georgia, serif;
  color: var(--main);
  margin: 0;
}

.slide .subtitle {
  position: absolute;
  left: var(--left-x);
  top: var(--subtitle-y);
  width: var(--subtitle-w);
  font: 700 18px/1.2 Arial, sans-serif;
  color: var(--red);
  margin: 0;
}

.slide .frame {
  position: absolute;
  left: var(--left-x);
  top: var(--frame-y);
  width: var(--frame-w);
  height: 353px;
  display: flex;
  flex-direction: column;
}

.slide footer.footer {
  position: absolute;
  bottom: 0;
  left: var(--left-x);
  width: 890px;
  padding-bottom: 14px;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--meta);
}

/* Cover Slide */
.slide.cover-slide .frame {
  top: 140px;
  height: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 16px;
}

.slide .cover-category {
  font: 700 18px/1.2 Arial, sans-serif;
  color: var(--red);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.slide .cover-title {
  font: 400 42px/1.15 Georgia, serif;
  color: var(--main);
  max-width: 700px;
}

.slide .cover-branding {
  position: absolute;
  left: var(--left-x);
  bottom: 50px;
  font: 700 16px/1 Arial, sans-serif;
  color: var(--meta);
}

.slide .cover-date {
  position: absolute;
  right: var(--left-x);
  bottom: 14px;
  font: 400 13px/1 Arial, sans-serif;
  color: var(--meta);
}

/* Three Cards Layout */
.slide .card-row {
  display: flex;
  gap: var(--gH);
  height: 100%;
}

.slide .card {
  flex: 1;
  background: var(--zone1);
  border-radius: var(--radius);
  padding: 18px;
  border-top: 5px solid var(--maroon);
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  border: 1px solid var(--border);
}

.slide .card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.slide .card-icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--rose);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.slide .card-num {
  font: 700 32px/1 Georgia, serif;
  color: #E0E0E0;
}

.slide .card h3 {
  margin: 0;
  font: 700 16px/1.3 Arial, sans-serif;
  color: var(--main);
}

.slide .card p {
  margin: 0;
  font: 400 12px/1.55 Arial, sans-serif;
  color: var(--secondary);
}

.slide .impact-box {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid #DCDCDC;
  font: 700 11px/1.3 Arial, sans-serif;
  color: var(--coal);
}

/* Two Column KPI */
.slide .two-col {
  display: flex;
  gap: 24px;
  height: 100%;
}

.slide .col-left {
  flex: 0 0 380px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.slide .kpi-block {
  background: var(--zone1);
  padding: 14px 18px;
  border-radius: var(--radius);
  border-left: 4px solid var(--maroon);
}

.slide .kpi-value {
  font: 700 42px/1 Georgia, serif;
  color: var(--maroon);
}

.slide .kpi-label {
  margin-top: 6px;
  font: 400 13px/1.4 Arial, sans-serif;
  color: var(--meta);
}

.slide .col-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.slide .detail-item {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.slide .detail-item:last-child {
  border-bottom: none;
}

.slide .detail-item h4 {
  margin: 0 0 6px 0;
  font: 700 14px/1.3 Arial, sans-serif;
  color: var(--main);
}

.slide .detail-item p {
  margin: 0;
  font: 400 12px/1.55 Arial, sans-serif;
  color: var(--secondary);
}

/* Timeline Layout */
.slide .timeline-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.slide .timeline-row {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.slide .timeline-marker {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--maroon);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 700 16px/1 Arial, sans-serif;
  flex-shrink: 0;
}

.slide .timeline-content {
  flex: 1;
  padding: 15px;
  background: var(--zone1);
  border-radius: var(--radius);
  border-left: 3px solid var(--maroon);
}

.slide .timeline-content h4 {
  margin: 0 0 8px 0;
  font: 700 14px/1.3 Arial, sans-serif;
  color: var(--main);
}

.slide .timeline-content p {
  margin: 0;
  font: 400 12px/1.5 Arial, sans-serif;
  color: var(--secondary);
}

/* Quote/Callout Layout */
.slide .quote-box {
  background: var(--zone1);
  padding: 30px;
  border-radius: var(--radius);
  border-left: 6px solid var(--maroon);
  margin: 20px 0;
}

.slide .quote-text {
  font: italic 400 24px/1.4 Georgia, serif;
  color: var(--main);
  margin: 0 0 15px 0;
}

.slide .quote-author {
  font: 700 14px/1 Arial, sans-serif;
  color: var(--meta);
}

/* Bullet List Layout */
.slide .content-list,
.slide [class*="content-list"] {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 100%;
}

.slide .content-list li,
.slide [class*="content-list"] li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font: 400 14px/1.5 Arial, sans-serif;
  color: var(--secondary);
  width: 100%;
}

.slide .content-list li::before,
.slide [class*="content-list"] li::before {
  content: '';
  width: 8px;
  height: 8px;
  background: var(--maroon);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

/* Dense Card Grid */
.slide .dense-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  width: 100%;
  height: 100%;
  align-content: stretch;
}
.slide .dense-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #ECEDEF;
  border-radius: 3px;
  padding: 8px 10px;
}
.slide .dense-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  min-width: 22px;
  background: var(--maroon, #8E1E1E);
  color: #fff;
  font: 700 11px/1 Arial, sans-serif;
  border-radius: 2px;
  flex-shrink: 0;
}
.slide .dense-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}
.slide .dense-title {
  font: 700 9px/1.2 Arial, sans-serif;
  color: var(--maroon, #8E1E1E);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slide .dense-desc {
  font: 400 8px/1.3 Arial, sans-serif;
  color: var(--secondary, #555);
  overflow: hidden;
}
.slide .dense-text {
  font: 400 10px/1.4 Arial, sans-serif;
  color: var(--secondary, #333);
  padding-top: 3px;
}

/* Grid Layout */
.slide .grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: var(--gH);
  height: 100%;
}

.slide .grid-cell {
  background: var(--zone1);
  border-radius: var(--radius);
  padding: 20px;
  border: 1px solid var(--border);
}

.slide .grid-cell h4 {
  margin: 0 0 10px 0;
  font: 700 14px/1.3 Arial, sans-serif;
  color: var(--main);
}

.slide .grid-cell p {
  margin: 0;
  font: 400 12px/1.5 Arial, sans-serif;
  color: var(--secondary);
}

/* Controls */
.controls {
  position: fixed;
  bottom: 20px;
  right: 30px;
  display: flex;
  gap: 12px;
  align-items: center;
  z-index: 1000;
}

.controls button {
  background: #8E1E1E;
  color: white;
  border: none;
  padding: 14px 28px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 5px;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  transition: all 0.2s;
}

.controls button:hover {
  background-color: #6d1515;
  transform: translateY(-2px);
}

.slide-count {
  font-size: 11px;
  color: var(--meta);
  background: white;
  padding: 6px 12px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* SWOT Analysis Layout */
.slide .swot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
  height: 100%;
}

.slide .swot-cell {
  border-radius: var(--radius);
  padding: 16px;
  border: 1px solid var(--border);
}

.slide .swot-strength {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  border-color: #28a745;
}

.slide .swot-weakness {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
  border-color: #ffc107;
}

.slide .swot-opportunity {
  background: linear-gradient(135deg, #cce5ff 0%, #b8daff 100%);
  border-color: #007bff;
}

.slide .swot-threat {
  background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
  border-color: #dc3545;
}

.slide .swot-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.slide .swot-icon {
  font-size: 20px;
}

.slide .swot-header h4 {
  margin: 0;
  font: 700 14px/1.3 Arial, sans-serif;
  color: var(--main);
}

.slide .swot-cell ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.slide .swot-cell li {
  font: 400 11px/1.5 Arial, sans-serif;
  color: var(--secondary);
  padding: 3px 0;
  padding-left: 16px;
  position: relative;
}

.slide .swot-cell li::before {
  content: '•';
  position: absolute;
  left: 4px;
  color: var(--main);
  font-weight: bold;
}

/* Executive Overview — horizontal grid boxes */
.slide .agenda-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  align-content: start;
}

.slide .agenda-item {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  background: var(--zone1);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  border-top: 3px solid var(--maroon);
  overflow: hidden;
}

.slide .agenda-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--maroon);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 700 11px/1 Arial, sans-serif;
  flex-shrink: 0;
  margin-bottom: 6px;
}

.slide .agenda-content {
  flex: 1;
  overflow: hidden;
}

.slide .agenda-content h4 {
  margin: 0 0 3px 0;
  font: 700 12px/1.3 Arial, sans-serif;
  color: var(--main);
}

.slide .agenda-content p {
  margin: 0;
  font: 400 10px/1.35 Arial, sans-serif;
  color: var(--meta);
}

/* Comparison Table */
.slide .comparison-table {
  width: 100%;
  border-collapse: collapse;
}

.slide .comparison-table th,
.slide .comparison-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.slide .comparison-table th {
  background: var(--zone1);
  font: 700 12px/1.3 Arial, sans-serif;
  color: var(--main);
}

.slide .comparison-table td {
  font: 400 12px/1.5 Arial, sans-serif;
  color: var(--secondary);
}

.slide .comparison-table tr:last-child td {
  border-bottom: none;
}

/* Process Flow */
.slide .process-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 100%;
}

.slide .process-step {
  flex: 1;
  text-align: center;
  padding: 20px 12px;
  background: var(--zone1);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.slide .process-step .step-num {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--maroon);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  font: 700 16px/1 Arial, sans-serif;
}

.slide .process-step h4 {
  margin: 0 0 8px 0;
  font: 700 13px/1.3 Arial, sans-serif;
  color: var(--main);
}

.slide .process-step p {
  margin: 0;
  font: 400 11px/1.5 Arial, sans-serif;
  color: var(--secondary);
}

.slide .process-arrow {
  font-size: 24px;
  color: var(--maroon);
  flex-shrink: 0;
}

/* Stat Cards */
.slide .stat-row {
  display: flex;
  gap: 16px;
  height: 100%;
}

.slide .stat-card {
  flex: 1;
  background: var(--zone1);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.slide .stat-value {
  font: 700 48px/1 Georgia, serif;
  color: var(--maroon);
  margin-bottom: 8px;
}

.slide .stat-label {
  font: 400 13px/1.4 Arial, sans-serif;
  color: var(--meta);
}

.slide .stat-change {
  font: 700 12px/1 Arial, sans-serif;
  margin-top: 8px;
}

.slide .stat-change.positive { color: #28a745; }
.slide .stat-change.negative { color: #dc3545; }

/* Hero Layout */
.slide .hero-layout {
  display: flex;
  gap: 24px;
  height: 100%;
}

.slide .hero-main {
  flex: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.slide .hero-sidebar {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slide .hero-stat {
  background: var(--zone1);
  border-radius: var(--radius);
  padding: 16px;
  border-left: 4px solid var(--maroon);
}

@media print {
  .controls { display: none; }
  .deck { padding: 0; gap: 0; }
  .slide-section { page-break-after: always; }
  .slide-label { display: none; }
  .slide {
    box-shadow: none;
    border: none;
    margin: 0;
  }
}
`;

// Export BASE_SLIDE_CSS for use in AI prompts
export { BASE_SLIDE_CSS };

export function generateExportHTML(slides, sharedCSS, title = 'Presentation') {
  const totalSlides = slides.length;

  // Generate slide sections with labels
  const slideSections = slides
    .map((slide, index) => {
      const slideNumber = index + 1;
      const typeLabel = getTypeLabel(slide.type);

      return `
  <!-- Slide ${slideNumber}: ${slide.title || 'Untitled'} -->
  <div class="slide-section">
    <div class="slide-label">${typeLabel} - Slide ${slideNumber}</div>
    ${slide.html}
  </div>`;
    })
    .join('\n');

  // Combine all custom CSS from slides
  const customCSS = slides
    .filter((s) => s.customCSS && s.customCSS.trim())
    .map((s) => `/* Slide: ${s.title} */\n${s.customCSS}`)
    .join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
/* Base slide CSS (fallback for older decks) */
${BASE_SLIDE_CSS}

/* Theme CSS from state (includes full slides.css for new decks) */
${sharedCSS || ''}

/* Slide-Specific Custom CSS */
${customCSS}
  </style>
</head>
<body>

<div class="controls">
  <span class="slide-count">${totalSlides} slide${totalSlides !== 1 ? 's' : ''}</span>
  <button onclick="window.print()">Print / Save PDF</button>
</div>

<main class="deck">
${slideSections}
</main>

</body>
</html>`;
}

function getTypeLabel(type) {
  const labels = {
    cover: 'Cover',
    'three-cards': 'Three Cards',
    kpi: 'KPI Metrics',
    timeline: 'Timeline',
    quote: 'Quote',
    bullets: 'Bullet Points',
    grid: '2x2 Grid',
    custom: 'Custom',
  };
  return labels[type] || 'Slide';
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadAsHTML(slides, sharedCSS, filename = 'presentation.html') {
  const html = generateExportHTML(slides, sharedCSS, filename.replace('.html', ''));
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  saveAs(blob, filename);
}

export function downloadAsJSON(slides, sharedCSS, filename = 'slides.json') {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sharedCSS,
    slides: slides.map((s) => ({
      title: s.title,
      type: s.type,
      html: s.html,
      customCSS: s.customCSS || '',
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  saveAs(blob, filename);
}

export function parseImportedJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    if (!data.slides || !Array.isArray(data.slides)) {
      throw new Error('Invalid format: missing slides array');
    }

    return {
      sharedCSS: data.sharedCSS || '',
      slides: data.slides.map((s) => ({
        title: s.title || 'Imported Slide',
        type: s.type || 'custom',
        html: s.html || '',
        customCSS: s.customCSS || '',
      })),
    };
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}`);
  }
}

// PDF Export - renders HTML slides to PDF using html2canvas
export async function exportToPDF(slides, sharedCSS, filename = 'presentation.pdf', onProgress = null) {
  if (!slides || slides.length === 0) {
    throw new Error('No slides to export');
  }

  // Create PDF with landscape 16:9 dimensions
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [960, 540], // Match slide dimensions
  });

  const totalSlides = slides.length;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];

    if (onProgress) {
      onProgress({
        phase: 'rendering',
        processed: i,
        total: totalSlides,
        message: `Rendering slide ${i + 1} of ${totalSlides}...`,
      });
    }

    // Create a temporary container for the slide
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.top = '-10000px';
    container.style.width = '960px';
    container.style.height = '540px';
    container.style.background = '#fff';
    container.style.overflow = 'hidden';

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = BASE_SLIDE_CSS + '\n' + (sharedCSS || '') + '\n' + (slide.customCSS || '');
    container.appendChild(styleEl);

    // Add slide content
    const slideEl = document.createElement('div');
    slideEl.className = 'slide';
    slideEl.innerHTML = slide.html.includes('class="slide"')
      ? slide.html.replace(/<div class="slide"[^>]*>/, '').replace(/<\/div>\s*$/, '')
      : slide.html;
    container.appendChild(slideEl);

    document.body.appendChild(container);

    try {
      // Render to canvas
      const canvas = await html2canvas(container, {
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 960,
        height: 540,
      });

      // Add page (except for first slide)
      if (i > 0) {
        pdf.addPage([960, 540], 'landscape');
      }

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 960, 540);
    } finally {
      // Clean up
      document.body.removeChild(container);
    }
  }

  if (onProgress) {
    onProgress({
      phase: 'complete',
      processed: totalSlides,
      total: totalSlides,
      message: 'Download complete!',
    });
  }

  // Save the PDF
  pdf.save(filename);
}

// Export a single slide to PDF
export async function exportSingleSlideToPDF(slide, sharedCSS, filename = 'slide.pdf', onProgress = null) {
  return exportToPDF([slide], sharedCSS, filename, onProgress);
}
