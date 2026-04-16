// Export Service - Download all slides as a single HTML file

import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { themeToCSS } from '../utils/themeUtils';

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

import SHELL_CSS from '../styles/slides.css?raw';

// Base slide shell CSS -- imported from the single source of truth (slides.css).
// Export-specific wrapper styles (deck layout, controls, print) are appended below.
const BASE_SLIDE_CSS = `
${SHELL_CSS}

html, body {
  margin: 0;
  background: #e0e0e0;
  color: var(--heading);
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
  color: var(--muted);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding-left: 5px;
}

.slide {
  margin: 0 auto;
  border: 1px solid var(--border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.12);
  border-radius: 4px;
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
  color: var(--muted);
  background: white;
  padding: 6px 12px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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

export function generateExportHTML(slides, sharedCSS, title = 'Presentation', theme = null) {
  const totalSlides = slides.length;

  // Generate slide sections with labels
  const slideSections = slides
    .map((slide, index) => {
      const slideNumber = index + 1;
      const typeLabel = getTypeLabel(slide.type);

      // Inject data-slide-id so scoped CSS selectors match
      let slideHtml = slide.html || '';
      if (slide.id && !slideHtml.includes('data-slide-id')) {
        slideHtml = slideHtml.replace(/class="slide([^"]*)"/, `class="slide$1" data-slide-id="${slide.id}"`);
      }

      return `
  <!-- Slide ${slideNumber}: ${slide.title || 'Untitled'} -->
  <div class="slide-section">
    <div class="slide-label">${typeLabel} - Slide ${slideNumber}</div>
    ${slideHtml}
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
/* Shell CSS (base structure + export wrappers) */
${BASE_SLIDE_CSS}

/* Theme CSS (design token overrides) */
${theme ? themeToCSS(theme) : ''}

/* Shared CSS from state */
${sharedCSS || ''}

/* Per-Slide Custom CSS */
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

export function downloadAsHTML(slides, sharedCSS, filename = 'presentation.html', theme = null) {
  const html = generateExportHTML(slides, sharedCSS, filename.replace('.html', ''), theme);
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
export async function exportToPDF(slides, sharedCSS, filename = 'presentation.pdf', onProgress = null, theme = null) {
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

    // Layer CSS: shell -> theme vars -> shared -> per-slide custom
    const styleEl = document.createElement('style');
    const themeCSSBlock = theme ? themeToCSS(theme) : '';
    styleEl.textContent = BASE_SLIDE_CSS + '\n' + themeCSSBlock + '\n' + (sharedCSS || '') + '\n' + (slide.customCSS || '');
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
export async function exportSingleSlideToPDF(slide, sharedCSS, filename = 'slide.pdf', onProgress = null, theme = null) {
  return exportToPDF([slide], sharedCSS, filename, onProgress, theme);
}
