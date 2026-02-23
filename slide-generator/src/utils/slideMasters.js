// Slide Masters - Define base layouts that templates inherit from
// Masters control: background, title/subtitle positioning, footer, margins

export const SLIDE_MASTERS = {
  // Standard master with title and subtitle areas
  standard: {
    id: 'standard',
    name: 'Title & Subtitle',
    description: 'Standard layout with title, subtitle, and content frame',
    hasTitle: true,
    hasSubtitle: true,
    hasFooter: true,
    // Layout positions (in CSS units)
    layout: {
      titleTop: '30px',
      titleLeft: '35px',
      titleWidth: '890px',
      subtitleTop: '101px',
      subtitleLeft: '35px',
      subtitleWidth: '890px',
      frameTop: '137px',
      frameLeft: '35px',
      frameWidth: '890px',
      frameHeight: '353px',
      footerBottom: '14px',
      footerLeft: '35px',
      footerWidth: '890px',
    },
    // Default styling
    styles: {
      background: '#ffffff',
      titleFont: 'Georgia, serif',
      titleSize: '28px',
      titleColor: '#111111',
      subtitleFont: 'Arial, sans-serif',
      subtitleSize: '18px',
      subtitleColor: '#A32020',
      footerFont: 'Arial, sans-serif',
      footerSize: '10px',
      footerColor: '#4A4F57',
    },
  },

  // Blank master - full canvas without title/subtitle
  blank: {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Full slide area for custom content - no title or subtitle',
    hasTitle: false,
    hasSubtitle: false,
    hasFooter: true,
    layout: {
      frameTop: '35px',
      frameLeft: '35px',
      frameWidth: '890px',
      frameHeight: '455px', // Larger frame since no title/subtitle
      footerBottom: '14px',
      footerLeft: '35px',
      footerWidth: '890px',
    },
    styles: {
      background: '#ffffff',
      footerFont: 'Arial, sans-serif',
      footerSize: '10px',
      footerColor: '#4A4F57',
    },
  },

  // Title-only master - just a title, no subtitle
  titleOnly: {
    id: 'titleOnly',
    name: 'Title Only',
    description: 'Large title area with expanded content frame',
    hasTitle: true,
    hasSubtitle: false,
    hasFooter: true,
    layout: {
      titleTop: '30px',
      titleLeft: '35px',
      titleWidth: '890px',
      frameTop: '90px',
      frameLeft: '35px',
      frameWidth: '890px',
      frameHeight: '400px',
      footerBottom: '14px',
      footerLeft: '35px',
      footerWidth: '890px',
    },
    styles: {
      background: '#ffffff',
      titleFont: 'Georgia, serif',
      titleSize: '32px',
      titleColor: '#111111',
      footerFont: 'Arial, sans-serif',
      footerSize: '10px',
      footerColor: '#4A4F57',
    },
  },

  // Cover master - centered content, branded
  cover: {
    id: 'cover',
    name: 'Cover/Title Slide',
    description: 'Centered layout for presentation covers and section dividers',
    hasTitle: false, // Uses custom cover elements instead
    hasSubtitle: false,
    hasFooter: false, // Covers typically don't have page numbers
    layout: {
      frameTop: '140px',
      frameLeft: '35px',
      frameWidth: '890px',
      frameHeight: 'auto',
    },
    styles: {
      background: '#ffffff',
      brandingColor: '#8E1E1E',
    },
  },

  // Empty page master - full page with no margins, no frame, no footer
  emptyPage: {
    id: 'emptyPage',
    name: 'Empty Page',
    description: 'Full page with no margins or borders - 100% canvas',
    hasTitle: false,
    hasSubtitle: false,
    hasFooter: false,
    layout: {
      frameTop: '0',
      frameLeft: '0',
      frameWidth: '960px',
      frameHeight: '540px',
    },
    styles: {
      background: '#ffffff',
    },
  },
};

// Get a slide master by ID
export function getSlideMaster(masterId) {
  return SLIDE_MASTERS[masterId] || SLIDE_MASTERS.standard;
}

// Get all slide masters
export function getAllSlideMasters() {
  return Object.values(SLIDE_MASTERS);
}

// Generate CSS variables from a slide master
export function getMasterCSSVariables(master, customOverrides = {}) {
  const styles = { ...master.styles, ...customOverrides };
  const layout = { ...master.layout };

  return `
    --master-bg: ${styles.background || '#ffffff'};
    --master-title-font: ${styles.titleFont || 'Georgia, serif'};
    --master-title-size: ${styles.titleSize || '28px'};
    --master-title-color: ${styles.titleColor || '#111111'};
    --master-subtitle-font: ${styles.subtitleFont || 'Arial, sans-serif'};
    --master-subtitle-size: ${styles.subtitleSize || '18px'};
    --master-subtitle-color: ${styles.subtitleColor || '#A32020'};
    --master-footer-font: ${styles.footerFont || 'Arial, sans-serif'};
    --master-footer-size: ${styles.footerSize || '10px'};
    --master-footer-color: ${styles.footerColor || '#4A4F57'};
    --master-frame-top: ${layout.frameTop || '137px'};
    --master-frame-left: ${layout.frameLeft || '35px'};
    --master-frame-width: ${layout.frameWidth || '890px'};
    --master-frame-height: ${layout.frameHeight || '353px'};
  `.trim();
}

// Generate HTML wrapper for a slide based on its master
export function wrapSlideWithMaster(contentHtml, masterId, slideNum, totalSlides, branding = 'Strategy&') {
  const master = getSlideMaster(masterId);
  const masterClass = `master-${masterId}`;

  let html = `<div class="slide ${masterClass}" style="background: ${master.styles.background}">`;

  // Content area
  html += contentHtml;

  // Footer (if master has it)
  if (master.hasFooter) {
    html += `
  <footer class="footer">
    <span>${branding}</span>
    <span>${slideNum} / ${totalSlides}</span>
  </footer>`;
  }

  html += '\n</div>';

  return html;
}

// Default master mapping for template types
export const TEMPLATE_MASTER_MAP = {
  // Opening templates
  cover: 'cover',
  blank: 'blank',

  // Content templates - use standard master
  threeCards: 'standard',
  bulletPoints: 'standard',
  grid2x2: 'standard',
  comparisonTable: 'standard',

  // Data templates
  kpiMetrics: 'standard',
  statHighlight: 'titleOnly',

  // Process templates
  timeline: 'standard',
  processFlow: 'standard',

  // Emphasis
  quote: 'standard',
};

// Get the master for a template
export function getMasterForTemplate(templateId) {
  return TEMPLATE_MASTER_MAP[templateId] || 'standard';
}

// Generate empty slide HTML for a master layout
export function generateEmptySlideHTML(masterId, options = {}) {
  const master = getSlideMaster(masterId);
  const { title = '', subtitle = '', branding = '[Company]', slideNum = 1, totalSlides = 1 } = options;

  let html = `<div class="slide master-${masterId}">`;

  if (master.hasTitle) {
    html += `\n  <h1 class="title">${title || '[Your title here]'}</h1>`;
  }

  if (master.hasSubtitle) {
    html += `\n  <h2 class="subtitle">${subtitle || '[Subtitle]'}</h2>`;
  }

  html += `\n  <div class="frame">`;

  // Add placeholder content based on master type
  if (masterId === 'cover') {
    html += `
    <div class="cover-category">[CATEGORY]</div>
    <div class="cover-title">[Presentation Title]</div>
  </div>
  <div class="cover-branding">${branding}</div>
  <div class="cover-date">[Date]</div>`;
  } else if (masterId === 'blank' || masterId === 'emptyPage') {
    html += `
    <div class="empty-canvas-placeholder" style="
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--meta);
      font-size: 14px;
      opacity: 0.5;
    ">
      <span>Add your content here</span>
    </div>
  </div>`;
  } else {
    html += `
    <p style="color: var(--meta); font-size: 14px;">Add your content here...</p>
  </div>`;
  }

  if (master.hasFooter) {
    html += `
  <footer class="footer">
    <span>${branding}</span>
    <span>${slideNum} / ${totalSlides}</span>
  </footer>`;
  }

  html += '\n</div>';

  return html;
}

// Get empty slide templates for all masters (for TemplatePicker)
export function getEmptySlideTemplates() {
  return Object.values(SLIDE_MASTERS).map(master => ({
    id: `empty-${master.id}`,
    title: `Empty: ${master.name}`,
    type: 'empty',
    master: master.id,
    category: 'Empty Slides',
    description: master.description,
    note: `Empty ${master.name} layout - start from scratch with ${master.hasTitle ? 'title' : 'no title'}${master.hasSubtitle ? ', subtitle' : ''}${master.hasFooter ? ', and footer' : ''}`,
    thumbnail: 'blank',
    html: generateEmptySlideHTML(master.id),
    isEmptyMaster: true,
  }));
}
