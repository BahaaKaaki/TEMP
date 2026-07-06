import { env, isDev } from './env';
import { logger } from './logger';

// In-memory database for development when PostgreSQL is not available
const inMemoryDB: {
  users: Map<string, any>;
  organizations: Map<string, any>;
  organization_members: Map<string, any>;
  organization_invitations: Map<string, any>;
  teams: Map<string, any>;
  team_members: Map<string, any>;
  password_reset_tokens: Map<string, any>;
  themes: Map<string, any>;
  templates: Map<string, any>;
} = {
  users: new Map(),
  organizations: new Map(),
  organization_members: new Map(),
  organization_invitations: new Map(),
  teams: new Map(),
  team_members: new Map(),
  password_reset_tokens: new Map(),
  themes: new Map(),
  templates: new Map(),
};

let useInMemory = false;
let pgPool: any = null;

// Try to connect to PostgreSQL, fall back to in-memory
async function initDatabase() {
  try {
    const { Pool } = await import('pg');
    pgPool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_SIZE,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    await pgPool.query('SELECT 1');
    logger.info('Connected to PostgreSQL database');

    pgPool.on('error', (err: Error) => {
      logger.error('Database pool error:', err);
    });
  } catch (error) {
    logger.warn('PostgreSQL not available, using in-memory database');
    useInMemory = true;

    // Seed admin user for development
    if (isDev) {
      seedInMemoryData();
    }
  }
}

function seedInMemoryData() {
  // Create admin user (hakmegeorges@gmail.com)
  const adminId = 'admin-user-001';
  const orgId = 'org-strategy';
  const themeId = 'theme-strategy-white';

  inMemoryDB.users.set(adminId, {
    id: adminId,
    email: 'hakmegeorges@gmail.com',
    // Password: 'admin123' (bcrypt hash)
    password_hash: '$2a$12$VUglprxjyv/OJrl2REedheuopoM.JGh2pSvVNgc9mzcZhAYlFoIX6',
    first_name: 'Georges',
    last_name: 'Hakme',
    avatar_url: null,
    is_active: true,
    email_verified: true,
    sso_provider: null,
    sso_subject_id: null,
    preferences: {},
    last_login_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Create Strategy& organization
  inMemoryDB.organizations.set(orgId, {
    id: orgId,
    name: 'Strategy&',
    slug: 'strategy-and',
    logo_url: null,
    settings: {},
    tier: 'enterprise',
    created_at: new Date(),
    updated_at: new Date(),
  });

  inMemoryDB.organization_members.set(`${orgId}-${adminId}`, {
    organization_id: orgId,
    user_id: adminId,
    role: 'owner',
    joined_at: new Date(),
  });

  // Create Strategy& White Theme - shared with organization by default
  const cssVariables = {
    '--color-primary': '#E4002B',
    '--color-secondary': '#1A1A1A',
    '--color-accent': '#FFD100',
    '--color-background': '#FFFFFF',
    '--color-surface': '#F5F5F5',
    '--color-text': '#1A1A1A',
    '--color-text-muted': '#666666',
    '--font-heading': 'Georgia, serif',
    '--font-body': 'Arial, sans-serif',
    '--spacing-xs': '4px',
    '--spacing-sm': '8px',
    '--spacing-md': '16px',
    '--spacing-lg': '24px',
    '--spacing-xl': '32px',
    '--border-radius': '0px',
    '--border-width': '1px',
  };

  const extractedStyles = {
    colors: {
      primary: '#E4002B',
      secondary: '#1A1A1A',
      accent: '#FFD100',
      background: '#FFFFFF',
      surface: '#F5F5F5',
      text: '#1A1A1A',
      textMuted: '#666666',
    },
    fonts: {
      heading: 'Georgia, serif',
      body: 'Arial, sans-serif',
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    borders: {
      radius: '0px',
      width: '1px',
    },
    customVariables: {},
  };

  // Full theme configuration
  const themeConfig = {
    slideSize: {
      width: 1920,
      height: 1080,
      unit: 'px',
      name: 'Widescreen 16:9',
    },
    colors: {
      primary: '#E4002B',
      secondary: '#1A1A1A',
      accent: '#FFD100',
      background: '#FFFFFF',
      surface: '#F5F5F5',
      text: '#1A1A1A',
      textMuted: '#666666',
    },
    typography: {
      headingFont: 'Georgia, serif',
      bodyFont: 'Arial, sans-serif',
      headingSizes: {
        h1: '48px',
        h2: '36px',
        h3: '28px',
        h4: '24px',
      },
      bodySizes: {
        large: '20px',
        normal: '16px',
        small: '14px',
      },
      fontWeights: {
        normal: 400,
        medium: 500,
        bold: 700,
      },
      lineHeights: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.8,
      },
    },
    layout: {
      columnGap: '24px',
      rowGap: '16px',
      padding: {
        slide: '48px',
        content: '24px',
      },
      margins: {
        header: '24px',
        footer: '16px',
      },
    },
    writingStyle: {
      tone: 'professional',
      formality: 'high',
      bulletStyle: 'dash',
      sentenceCase: 'sentence',
      maxBulletsPerSlide: 5,
      maxWordsPerBullet: 15,
      preferredVoice: 'active',
    },
    defaultTemplate: {
      titleSlide: {
        titlePosition: 'center',
        subtitlePosition: 'below',
        showLogo: true,
        logoPosition: 'bottom-right',
      },
      contentSlide: {
        headerPosition: 'top-left',
        headerHeight: '80px',
        contentArea: 'full',
      },
      sectionSlide: {
        titlePosition: 'center',
        showNumber: true,
        backgroundStyle: 'solid',
      },
    },
  };

  inMemoryDB.themes.set(themeId, {
    id: themeId,
    name: 'Strategy& White Theme',
    description: 'Clean white theme with Strategy& brand colors - shared with all organization members',
    organization_id: orgId,
    created_by: adminId,
    html_content: `<!DOCTYPE html>
<html>
<head>
  <title>Strategy& Style Guide</title>
  <style>
    :root {
      --color-primary: #E4002B;
      --color-secondary: #1A1A1A;
      --color-accent: #FFD100;
      --color-background: #FFFFFF;
      --color-surface: #F5F5F5;
      --color-text: #1A1A1A;
      --color-text-muted: #666666;
      --font-heading: Georgia, serif;
      --font-body: Arial, sans-serif;
    }
    body {
      font-family: var(--font-body);
      background: var(--color-background);
      color: var(--color-text);
    }
    h1, h2, h3 {
      font-family: var(--font-heading);
      color: var(--color-secondary);
    }
    .accent {
      color: var(--color-primary);
    }
  </style>
</head>
<body>
  <h1>Strategy& Style Guide</h1>
  <p class="accent">Professional consulting presentation theme</p>
</body>
</html>`,
    css_variables: JSON.stringify(cssVariables),
    extracted_styles: JSON.stringify(extractedStyles),
    config: JSON.stringify(themeConfig),
    default_template_id: null,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Create default elevated templates for the theme
  const templateBaseStyles = `
    .slide { font-family: Arial, sans-serif; padding: 48px; box-sizing: border-box; }
    .header { font-family: Georgia, serif; font-size: 36px; color: #1A1A1A; margin-bottom: 24px; }
  `;

  // Template 1: Numbered List with Accent Bars
  const numberedListTemplate = {
    id: 'template-numbered-list',
    theme_id: themeId,
    name: 'Numbered List with Accent Bars',
    description: 'Professional numbered list with colored accent bars',
    type: 'content',
    master: 'content',
    category: 'Lists',
    html: `<div class="slide numbered-list">
  <h1 class="header">{{title}}</h1>
  <div class="list-container">
    {{#each items}}
    <div class="list-item">
      <div class="number-badge">{{@index + 1}}</div>
      <div class="accent-bar"></div>
      <div class="content">
        <h3 class="item-title">{{this.title}}</h3>
        <p class="item-description">{{this.description}}</p>
      </div>
    </div>
    {{/each}}
  </div>
</div>
<style>
${templateBaseStyles}
.numbered-list .list-container { display: flex; flex-direction: column; gap: 20px; }
.numbered-list .list-item { display: flex; align-items: flex-start; gap: 16px; }
.numbered-list .number-badge {
  width: 48px; height: 48px; border-radius: 50%;
  background: #E4002B; color: white; font-weight: bold; font-size: 24px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.numbered-list .accent-bar { width: 4px; height: 100%; background: #FFD100; border-radius: 2px; }
.numbered-list .content { flex: 1; }
.numbered-list .item-title { font-size: 20px; font-weight: 600; margin: 0 0 8px 0; color: #1A1A1A; }
.numbered-list .item-description { font-size: 16px; color: #666666; margin: 0; line-height: 1.5; }
</style>`,
    pptx_renderer_code: `function render(pptx, slideData, slideNum, totalSlides, helpers) {
  const slide = pptx.addSlide();
  const { parseHTML, COLORS, addFooter } = helpers;
  const { getText, getAll, getAllElements } = parseHTML(slideData.html);

  // Title
  const title = getText('.header') || slideData.title || 'Numbered List';
  slide.addText(title, {
    x: 0.48, y: 0.42, w: 12.36, h: 0.8,
    fontFace: 'Georgia', fontSize: 28, color: '1A1A1A'
  });

  // Get list items
  const items = getAllElements('.list-item');
  const startY = 1.5;
  const itemHeight = 1.2;

  items.forEach((item, i) => {
    const y = startY + i * itemHeight;
    const num = (i + 1).toString();
    const itemTitle = item.querySelector('.item-title')?.textContent?.trim() || '';
    const itemDesc = item.querySelector('.item-description')?.textContent?.trim() || '';

    // Number badge (circle)
    slide.addShape('ellipse', {
      x: 0.48, y: y, w: 0.5, h: 0.5,
      fill: { color: 'E4002B' }
    });
    slide.addText(num, {
      x: 0.48, y: y, w: 0.5, h: 0.5,
      fontFace: 'Arial', fontSize: 18, color: 'FFFFFF',
      align: 'center', valign: 'middle', bold: true
    });

    // Accent bar (yellow)
    slide.addShape('rect', {
      x: 1.1, y: y + 0.05, w: 0.06, h: 0.4,
      fill: { color: 'FFD100' }, line: { width: 0 }
    });

    // Title text
    slide.addText(itemTitle, {
      x: 1.3, y: y, w: 10.5, h: 0.35,
      fontFace: 'Arial', fontSize: 16, color: '1A1A1A', bold: true
    });

    // Description text
    if (itemDesc) {
      slide.addText(itemDesc, {
        x: 1.3, y: y + 0.4, w: 10.5, h: 0.6,
        fontFace: 'Arial', fontSize: 12, color: '666666'
      });
    }
  });

  addFooter(slide, slideNum, totalSlides);
}`,
    note: 'Use for step-by-step processes or prioritized lists',
    thumbnail: null,
    organization_id: orgId,
    created_by: adminId,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Template 2: Horizontal Bar Highlights
  const horizontalBarsTemplate = {
    id: 'template-horizontal-bars',
    theme_id: themeId,
    name: 'Key Points with Horizontal Bars',
    description: 'Clean horizontal bar separators between key points',
    type: 'content',
    master: 'content',
    category: 'Lists',
    html: `<div class="slide horizontal-bars">
  <h1 class="header">{{title}}</h1>
  <div class="points-container">
    {{#each points}}
    <div class="point-row">
      <div class="bar-left"></div>
      <div class="point-content">
        <span class="point-label">{{this.label}}</span>
        <span class="point-value">{{this.value}}</span>
      </div>
      <div class="bar-right"></div>
    </div>
    {{/each}}
  </div>
</div>
<style>
${templateBaseStyles}
.horizontal-bars .points-container { display: flex; flex-direction: column; gap: 24px; margin-top: 32px; }
.horizontal-bars .point-row { display: flex; align-items: center; gap: 24px; }
.horizontal-bars .bar-left { flex: 0 0 80px; height: 3px; background: linear-gradient(90deg, transparent, #E4002B); }
.horizontal-bars .bar-right { flex: 1; height: 3px; background: linear-gradient(90deg, #E4002B, transparent); }
.horizontal-bars .point-content { display: flex; flex-direction: column; min-width: 300px; }
.horizontal-bars .point-label { font-size: 14px; color: #666666; text-transform: uppercase; letter-spacing: 1px; }
.horizontal-bars .point-value { font-size: 24px; font-weight: 600; color: #1A1A1A; }
</style>`,
    pptx_renderer_code: `function render(pptx, slideData, slideNum, totalSlides, helpers) {
  const slide = pptx.addSlide();
  const { parseHTML, COLORS, addFooter } = helpers;
  const { getText, getAllElements } = parseHTML(slideData.html);

  // Title
  const title = getText('.header') || slideData.title || 'Key Points';
  slide.addText(title, {
    x: 0.48, y: 0.42, w: 12.36, h: 0.8,
    fontFace: 'Georgia', fontSize: 28, color: '1A1A1A'
  });

  // Get point rows
  const points = getAllElements('.point-row');
  const startY = 1.8;
  const rowHeight = 1.3;

  points.forEach((point, i) => {
    const y = startY + i * rowHeight;
    const label = point.querySelector('.point-label')?.textContent?.trim() || '';
    const value = point.querySelector('.point-value')?.textContent?.trim() || '';

    // Left bar (gradient effect - just use solid for PPTX)
    slide.addShape('rect', {
      x: 0.48, y: y + 0.35, w: 1.2, h: 0.05,
      fill: { color: 'E4002B' }, line: { width: 0 }
    });

    // Label (uppercase, small)
    slide.addText(label.toUpperCase(), {
      x: 1.9, y: y, w: 4, h: 0.35,
      fontFace: 'Arial', fontSize: 11, color: '666666'
    });

    // Value (large, bold)
    slide.addText(value, {
      x: 1.9, y: y + 0.35, w: 4, h: 0.45,
      fontFace: 'Arial', fontSize: 20, color: '1A1A1A', bold: true
    });

    // Right bar (gradient effect)
    slide.addShape('rect', {
      x: 6.2, y: y + 0.35, w: 6.5, h: 0.05,
      fill: { color: 'E4002B' }, line: { width: 0 }
    });
  });

  addFooter(slide, slideNum, totalSlides);
}`,
    note: 'Use for KPIs, metrics, or key takeaways',
    thumbnail: null,
    organization_id: orgId,
    created_by: adminId,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Template 3: Boxed Numbers
  const boxedNumbersTemplate = {
    id: 'template-boxed-numbers',
    theme_id: themeId,
    name: 'Boxed Number Cards',
    description: 'Large numbered boxes with content cards',
    type: 'content',
    master: 'content',
    category: 'Lists',
    html: `<div class="slide boxed-numbers">
  <h1 class="header">{{title}}</h1>
  <div class="cards-grid">
    {{#each cards}}
    <div class="number-card">
      <div class="card-number">{{@index + 1}}</div>
      <div class="card-body">
        <h3 class="card-title">{{this.title}}</h3>
        <p class="card-text">{{this.text}}</p>
      </div>
      <div class="card-accent"></div>
    </div>
    {{/each}}
  </div>
</div>
<style>
${templateBaseStyles}
.boxed-numbers .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 32px; }
.boxed-numbers .number-card {
  background: #F5F5F5; border-radius: 8px; padding: 24px; position: relative; overflow: hidden;
}
.boxed-numbers .card-number {
  font-size: 64px; font-weight: bold; color: rgba(228, 0, 43, 0.15);
  position: absolute; top: -10px; right: 16px; line-height: 1;
}
.boxed-numbers .card-body { position: relative; z-index: 1; }
.boxed-numbers .card-title { font-size: 18px; font-weight: 600; margin: 0 0 12px 0; color: #1A1A1A; }
.boxed-numbers .card-text { font-size: 14px; color: #666666; margin: 0; line-height: 1.6; }
.boxed-numbers .card-accent { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: #E4002B; }
</style>`,
    pptx_renderer_code: `function render(pptx, slideData, slideNum, totalSlides, helpers) {
  const slide = pptx.addSlide();
  const { parseHTML, COLORS, addFooter } = helpers;
  const { getText, getAllElements } = parseHTML(slideData.html);

  // Title
  const title = getText('.header') || slideData.title || 'Key Points';
  slide.addText(title, {
    x: 0.48, y: 0.42, w: 12.36, h: 0.8,
    fontFace: 'Georgia', fontSize: 28, color: '1A1A1A'
  });

  // Get cards
  const cards = getAllElements('.number-card');
  const cardCount = cards.length;
  const cardW = cardCount <= 3 ? 3.8 : 2.9;
  const gap = 0.25;
  const startX = 0.48;
  const startY = 1.6;
  const cardH = 4.8;

  cards.forEach((card, i) => {
    const x = startX + i * (cardW + gap);
    const num = (i + 1).toString();
    const cardTitle = card.querySelector('.card-title')?.textContent?.trim() || '';
    const cardText = card.querySelector('.card-text')?.textContent?.trim() || '';

    // Card background
    slide.addShape('roundRect', {
      x: x, y: startY, w: cardW, h: cardH,
      fill: { color: 'F5F5F5' },
      line: { width: 0 },
      rectRadius: 0.1
    });

    // Large watermark number
    slide.addText(num, {
      x: x + cardW - 1.2, y: startY - 0.2, w: 1, h: 1.2,
      fontFace: 'Arial', fontSize: 48, color: 'FADCDC',
      bold: true, align: 'right'
    });

    // Card title
    slide.addText(cardTitle, {
      x: x + 0.2, y: startY + 0.3, w: cardW - 0.4, h: 0.5,
      fontFace: 'Arial', fontSize: 14, color: '1A1A1A', bold: true
    });

    // Card text
    slide.addText(cardText, {
      x: x + 0.2, y: startY + 0.9, w: cardW - 0.4, h: 3.4,
      fontFace: 'Arial', fontSize: 11, color: '666666', valign: 'top'
    });

    // Bottom accent bar
    slide.addShape('rect', {
      x: x, y: startY + cardH - 0.08, w: cardW, h: 0.08,
      fill: { color: 'E4002B' }, line: { width: 0 }
    });
  });

  addFooter(slide, slideNum, totalSlides);
}`,
    note: 'Use for 3-4 main points or process steps',
    thumbnail: null,
    organization_id: orgId,
    created_by: adminId,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Template 4: Timeline Steps
  const timelineTemplate = {
    id: 'template-timeline',
    theme_id: themeId,
    name: 'Timeline with Steps',
    description: 'Horizontal timeline with numbered milestones',
    type: 'content',
    master: 'content',
    category: 'Process',
    html: `<div class="slide timeline">
  <h1 class="header">{{title}}</h1>
  <div class="timeline-container">
    <div class="timeline-line"></div>
    <div class="timeline-steps">
      {{#each steps}}
      <div class="timeline-step">
        <div class="step-marker">
          <div class="step-number">{{@index + 1}}</div>
        </div>
        <div class="step-content">
          <h4 class="step-title">{{this.title}}</h4>
          <p class="step-desc">{{this.description}}</p>
        </div>
      </div>
      {{/each}}
    </div>
  </div>
</div>
<style>
${templateBaseStyles}
.timeline .timeline-container { position: relative; margin-top: 48px; padding: 0 24px; }
.timeline .timeline-line {
  position: absolute; top: 24px; left: 60px; right: 60px; height: 4px;
  background: linear-gradient(90deg, #E4002B, #FFD100);
}
.timeline .timeline-steps { display: flex; justify-content: space-between; position: relative; }
.timeline .timeline-step { display: flex; flex-direction: column; align-items: center; flex: 1; }
.timeline .step-marker {
  width: 48px; height: 48px; border-radius: 50%; background: white;
  border: 4px solid #E4002B; display: flex; align-items: center; justify-content: center;
  position: relative; z-index: 1;
}
.timeline .step-number { font-size: 20px; font-weight: bold; color: #E4002B; }
.timeline .step-content { text-align: center; margin-top: 16px; max-width: 180px; }
.timeline .step-title { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #1A1A1A; }
.timeline .step-desc { font-size: 13px; color: #666666; margin: 0; line-height: 1.4; }
</style>`,
    pptx_renderer_code: `function render(pptx, slideData, slideNum, totalSlides, helpers) {
  const slide = pptx.addSlide();
  const { parseHTML, COLORS, addFooter } = helpers;
  const { getText, getAllElements } = parseHTML(slideData.html);

  // Title
  const title = getText('.header') || slideData.title || 'Timeline';
  slide.addText(title, {
    x: 0.48, y: 0.42, w: 12.36, h: 0.8,
    fontFace: 'Georgia', fontSize: 28, color: '1A1A1A'
  });

  // Get steps
  const steps = getAllElements('.timeline-step');
  const stepCount = steps.length;
  const lineY = 2.5;
  const lineStartX = 1.5;
  const lineEndX = 11.8;
  const lineLength = lineEndX - lineStartX;

  // Timeline line (gradient effect - using solid red)
  slide.addShape('rect', {
    x: lineStartX, y: lineY, w: lineLength, h: 0.08,
    fill: { color: 'E4002B' }, line: { width: 0 }
  });

  steps.forEach((step, i) => {
    const stepX = lineStartX + (lineLength / (stepCount - 1 || 1)) * i;
    const num = (i + 1).toString();
    const stepTitle = step.querySelector('.step-title')?.textContent?.trim() || '';
    const stepDesc = step.querySelector('.step-desc')?.textContent?.trim() || '';

    // Step marker circle (white with red border)
    slide.addShape('ellipse', {
      x: stepX - 0.3, y: lineY - 0.26, w: 0.6, h: 0.6,
      fill: { color: 'FFFFFF' },
      line: { color: 'E4002B', width: 2 }
    });

    // Step number
    slide.addText(num, {
      x: stepX - 0.3, y: lineY - 0.26, w: 0.6, h: 0.6,
      fontFace: 'Arial', fontSize: 16, color: 'E4002B',
      bold: true, align: 'center', valign: 'middle'
    });

    // Step title
    slide.addText(stepTitle, {
      x: stepX - 1.2, y: lineY + 0.5, w: 2.4, h: 0.5,
      fontFace: 'Arial', fontSize: 12, color: '1A1A1A',
      bold: true, align: 'center'
    });

    // Step description
    slide.addText(stepDesc, {
      x: stepX - 1.2, y: lineY + 1.0, w: 2.4, h: 2.5,
      fontFace: 'Arial', fontSize: 10, color: '666666',
      align: 'center', valign: 'top'
    });
  });

  addFooter(slide, slideNum, totalSlides);
}`,
    note: 'Use for project phases, roadmaps, or processes',
    thumbnail: null,
    organization_id: orgId,
    created_by: adminId,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Template 5: Bullet List with Icons
  const iconBulletsTemplate = {
    id: 'template-icon-bullets',
    theme_id: themeId,
    name: 'Icon Bullet Points',
    description: 'Clean bullet points with customizable icons',
    type: 'content',
    master: 'content',
    category: 'Lists',
    html: `<div class="slide icon-bullets">
  <h1 class="header">{{title}}</h1>
  <div class="bullets-list">
    {{#each bullets}}
    <div class="bullet-item">
      <div class="bullet-icon">
        <span class="icon-dash">—</span>
      </div>
      <div class="bullet-text">{{this}}</div>
    </div>
    {{/each}}
  </div>
</div>
<style>
${templateBaseStyles}
.icon-bullets .bullets-list { display: flex; flex-direction: column; gap: 20px; margin-top: 32px; max-width: 800px; }
.icon-bullets .bullet-item { display: flex; align-items: flex-start; gap: 20px; }
.icon-bullets .bullet-icon {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  color: #E4002B; font-weight: bold; font-size: 24px; flex-shrink: 0;
}
.icon-bullets .bullet-text { font-size: 18px; color: #1A1A1A; line-height: 1.6; padding-top: 4px; }
</style>`,
    pptx_renderer_code: `function render(pptx, slideData, slideNum, totalSlides, helpers) {
  const slide = pptx.addSlide();
  const { parseHTML, COLORS, addFooter } = helpers;
  const { getText, getAllElements } = parseHTML(slideData.html);

  // Title
  const title = getText('.header') || slideData.title || 'Key Points';
  slide.addText(title, {
    x: 0.48, y: 0.42, w: 12.36, h: 0.8,
    fontFace: 'Georgia', fontSize: 28, color: '1A1A1A'
  });

  // Get bullet items
  const bullets = getAllElements('.bullet-item');
  const startY = 1.6;
  const bulletHeight = 0.8;

  bullets.forEach((bullet, i) => {
    const y = startY + i * bulletHeight;
    const text = bullet.querySelector('.bullet-text')?.textContent?.trim() || '';

    // Dash bullet
    slide.addText('—', {
      x: 0.48, y: y, w: 0.5, h: 0.5,
      fontFace: 'Arial', fontSize: 20, color: 'E4002B', bold: true
    });

    // Bullet text
    slide.addText(text, {
      x: 1.1, y: y, w: 11.5, h: 0.7,
      fontFace: 'Arial', fontSize: 14, color: '1A1A1A',
      valign: 'top'
    });
  });

  addFooter(slide, slideNum, totalSlides);
}`,
    note: 'Classic professional bullet points',
    thumbnail: null,
    organization_id: orgId,
    created_by: adminId,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Add all templates to the database
  inMemoryDB.templates.set(numberedListTemplate.id, numberedListTemplate);
  inMemoryDB.templates.set(horizontalBarsTemplate.id, horizontalBarsTemplate);
  inMemoryDB.templates.set(boxedNumbersTemplate.id, boxedNumbersTemplate);
  inMemoryDB.templates.set(timelineTemplate.id, timelineTemplate);
  inMemoryDB.templates.set(iconBulletsTemplate.id, iconBulletsTemplate);

  // Update theme with default template
  const theme = inMemoryDB.themes.get(themeId);
  if (theme) {
    theme.default_template_id = numberedListTemplate.id;
  }

  logger.info('Seeded in-memory database with:');
  logger.info('  - Admin user: hakmegeorges@gmail.com (password: admin123)');
  logger.info('  - Organization: Strategy&');
  logger.info('  - Theme: Strategy& White Theme (shared with org)');
  logger.info('  - Templates: 5 elevated bullet templates');
}

// Initialize on module load
initDatabase();

// Query result types
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// Main query function - routes to PG or in-memory
export async function query<T = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (!useInMemory && pgPool) {
    const start = Date.now();
    try {
      const result = await pgPool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Query error', { text: text.substring(0, 100), error });
      throw error;
    }
  }

  // In-memory query handling
  return executeInMemoryQuery(text, params);
}

// Transaction helper
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  if (!useInMemory && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // In-memory - just execute (no real transaction needed)
  return callback({
    query: async <T>(text: string, params?: unknown[]) => executeInMemoryQuery<T>(text, params),
  });
}

// Parse simple SQL and execute against in-memory store
function executeInMemoryQuery<T>(text: string, params?: unknown[]): QueryResult<T> {
  const normalizedText = text.toLowerCase().trim();

  // SELECT 1 - health check
  if (normalizedText === 'select 1') {
    return { rows: [{ '?column?': 1 }] as T[], rowCount: 1 };
  }

  // SELECT from users
  if (normalizedText.includes('from users where email =')) {
    const email = (params?.[0] as string)?.toLowerCase();
    const user = Array.from(inMemoryDB.users.values()).find(u => u.email === email);
    return { rows: user ? [user as T] : [], rowCount: user ? 1 : 0 };
  }

  if (normalizedText.includes('from users where id =')) {
    const id = params?.[0] as string;
    const user = inMemoryDB.users.get(id);
    return { rows: user ? [user as T] : [], rowCount: user ? 1 : 0 };
  }

  // INSERT into users
  if (normalizedText.includes('insert into users')) {
    const id = generateId();
    const email = (params?.[0] as string)?.toLowerCase();
    const password_hash = params?.[1] as string;
    const first_name = params?.[2] as string | null;
    const last_name = params?.[3] as string | null;

    const user = {
      id,
      email,
      password_hash,
      first_name,
      last_name,
      avatar_url: null,
      is_active: true,
      email_verified: false,
      sso_provider: null,
      sso_subject_id: null,
      preferences: {},
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    inMemoryDB.users.set(id, user);
    return { rows: [user as T], rowCount: 1 };
  }

  // UPDATE users
  if (normalizedText.includes('update users set')) {
    const userId = params?.[params.length - 1] as string;
    const user = inMemoryDB.users.get(userId);
    if (user) {
      user.updated_at = new Date();
      if (normalizedText.includes('last_login_at')) {
        user.last_login_at = new Date();
      }
      if (normalizedText.includes('password_hash')) {
        user.password_hash = params?.[0] as string;
      }
    }
    return { rows: [], rowCount: user ? 1 : 0 };
  }

  // INSERT into organizations
  if (normalizedText.includes('insert into organizations')) {
    const id = generateId();
    const name = params?.[0] as string;
    const slug = params?.[1] as string;
    const tier = params?.[2] as string || 'free';

    const org = {
      id,
      name,
      slug,
      logo_url: null,
      settings: {},
      tier,
      created_at: new Date(),
      updated_at: new Date(),
    };

    inMemoryDB.organizations.set(id, org);
    return { rows: [org as T], rowCount: 1 };
  }

  // INSERT into organization_members
  if (normalizedText.includes('insert into organization_members')) {
    const org_id = params?.[0] as string;
    const user_id = params?.[1] as string;
    const role = params?.[2] as string || 'viewer';

    const key = `${org_id}-${user_id}`;
    const member = {
      organization_id: org_id,
      user_id,
      role,
      joined_at: new Date(),
    };

    inMemoryDB.organization_members.set(key, member);
    return { rows: [member as T], rowCount: 1 };
  }

  // SELECT organizations for user
  if (normalizedText.includes('from organizations') && normalizedText.includes('organization_members')) {
    const userId = params?.[0] as string;
    const results: any[] = [];

    inMemoryDB.organization_members.forEach((member, key) => {
      if (member.user_id === userId) {
        const org = inMemoryDB.organizations.get(member.organization_id);
        if (org) {
          results.push({
            ...org,
            role: member.role,
          });
        }
      }
    });

    return { rows: results as T[], rowCount: results.length };
  }

  // SELECT organization by id
  if (normalizedText.includes('from organizations where id =') && !normalizedText.includes('organization_members')) {
    const id = params?.[0] as string;
    const org = inMemoryDB.organizations.get(id);
    return { rows: org ? [org as T] : [], rowCount: org ? 1 : 0 };
  }

  // SELECT organization members with user details
  if (normalizedText.includes('from organization_members') && normalizedText.includes('users')) {
    const orgId = params?.[0] as string;
    const results: any[] = [];

    inMemoryDB.organization_members.forEach((member) => {
      if (member.organization_id === orgId) {
        const user = inMemoryDB.users.get(member.user_id);
        if (user) {
          results.push({
            user_id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url,
            role: member.role,
            joined_at: member.joined_at,
          });
        }
      }
    });

    return { rows: results as T[], rowCount: results.length };
  }

  // SELECT organization_id FROM organization_members WHERE user_id = $1 (for access control)
  if (normalizedText.includes('select organization_id from organization_members where user_id')) {
    const userId = params?.[0] as string;
    const results: any[] = [];

    inMemoryDB.organization_members.forEach((member) => {
      if (member.user_id === userId) {
        results.push({ organization_id: member.organization_id });
      }
    });

    return { rows: results as T[], rowCount: results.length };
  }

  // SELECT teams
  if (normalizedText.includes('from teams where organization_id =')) {
    const orgId = params?.[0] as string;
    const results = Array.from(inMemoryDB.teams.values()).filter(t => t.organization_id === orgId);
    return { rows: results as T[], rowCount: results.length };
  }

  // INSERT into teams
  if (normalizedText.includes('insert into teams')) {
    const id = generateId();
    const org_id = params?.[0] as string;
    const name = params?.[1] as string;
    const description = params?.[2] as string | null;

    const team = {
      id,
      organization_id: org_id,
      name,
      description,
      created_at: new Date(),
      updated_at: new Date(),
    };

    inMemoryDB.teams.set(id, team);
    return { rows: [team as T], rowCount: 1 };
  }

  // DELETE organization
  if (normalizedText.includes('delete from organizations where id =')) {
    const id = params?.[0] as string;
    const deleted = inMemoryDB.organizations.delete(id);
    // Clean up members
    inMemoryDB.organization_members.forEach((member, key) => {
      if (member.organization_id === id) {
        inMemoryDB.organization_members.delete(key);
      }
    });
    return { rows: [], rowCount: deleted ? 1 : 0 };
  }

  // UPDATE organization
  if (normalizedText.includes('update organizations set')) {
    const id = params?.[params.length - 1] as string;
    const org = inMemoryDB.organizations.get(id);
    if (org) {
      // Parse what's being updated
      if (params?.[0]) org.name = params[0] as string;
      if (params?.[1] !== undefined) org.logo_url = params[1] as string | null;
      if (params?.[2]) org.settings = params[2] as any;
      org.updated_at = new Date();
    }
    return { rows: org ? [org as T] : [], rowCount: org ? 1 : 0 };
  }

  // UPDATE member role
  if (normalizedText.includes('update organization_members set role')) {
    const role = params?.[0] as string;
    const orgId = params?.[1] as string;
    const userId = params?.[2] as string;
    const key = `${orgId}-${userId}`;
    const member = inMemoryDB.organization_members.get(key);
    if (member) {
      member.role = role;
    }
    return { rows: [], rowCount: member ? 1 : 0 };
  }

  // DELETE member
  if (normalizedText.includes('delete from organization_members')) {
    const orgId = params?.[0] as string;
    const userId = params?.[1] as string;
    const key = `${orgId}-${userId}`;
    const deleted = inMemoryDB.organization_members.delete(key);
    return { rows: [], rowCount: deleted ? 1 : 0 };
  }

  // Password reset tokens
  if (normalizedText.includes('insert into password_reset_tokens') || normalizedText.includes('on conflict')) {
    const userId = params?.[0] as string;
    const token = params?.[1] as string;
    const expiresAt = params?.[2] as Date;

    inMemoryDB.password_reset_tokens.set(userId, { user_id: userId, token, expires_at: expiresAt });
    return { rows: [], rowCount: 1 };
  }

  if (normalizedText.includes('from password_reset_tokens where token =')) {
    const token = params?.[0] as string;
    const found = Array.from(inMemoryDB.password_reset_tokens.values()).find(
      t => t.token === token && new Date(t.expires_at) > new Date()
    );
    return { rows: found ? [found as T] : [], rowCount: found ? 1 : 0 };
  }

  if (normalizedText.includes('delete from password_reset_tokens')) {
    const userId = params?.[0] as string;
    inMemoryDB.password_reset_tokens.delete(userId);
    return { rows: [], rowCount: 1 };
  }

  // Themes
  if (normalizedText.includes('from themes where id =')) {
    const id = params?.[0] as string;
    const theme = inMemoryDB.themes.get(id);
    return { rows: theme ? [theme as T] : [], rowCount: theme ? 1 : 0 };
  }

  // Themes with access control: public OR owned OR in user's organizations (using ANY clause)
  if (normalizedText.includes('from themes where') && normalizedText.includes('any(')) {
    const userId = params?.[0] as string;
    const userOrgIds = params?.[1] as string[] || [];
    const results = Array.from(inMemoryDB.themes.values()).filter(t =>
      t.is_public || t.created_by === userId || (t.organization_id && userOrgIds.includes(t.organization_id))
    );
    return { rows: results as T[], rowCount: results.length };
  }

  if (normalizedText.includes('from themes where')) {
    const userId = params?.[0] as string;
    const orgId = params?.[1] as string;
    const results = Array.from(inMemoryDB.themes.values()).filter(t =>
      t.is_public || t.created_by === userId || t.organization_id === orgId
    );
    return { rows: results as T[], rowCount: results.length };
  }

  if (normalizedText.includes('from themes')) {
    const results = Array.from(inMemoryDB.themes.values());
    return { rows: results as T[], rowCount: results.length };
  }

  if (normalizedText.includes('insert into themes')) {
    // Params: id, name, description, organization_id, created_by, html_content, css_variables, extracted_styles, config, default_template_id, is_public, created_at, updated_at
    const theme = {
      id: params?.[0] as string,
      name: params?.[1] as string,
      description: params?.[2] as string | null,
      organization_id: params?.[3] as string | null,
      created_by: params?.[4] as string,
      html_content: params?.[5] as string,
      css_variables: params?.[6] as string,
      extracted_styles: params?.[7] as string,
      config: params?.[8] as string,
      default_template_id: params?.[9] as string | null,
      is_public: params?.[10] as boolean,
      created_at: params?.[11] as Date,
      updated_at: params?.[12] as Date,
    };
    inMemoryDB.themes.set(theme.id, theme);
    return { rows: [theme as T], rowCount: 1 };
  }

  if (normalizedText.includes('update themes set')) {
    const id = params?.[params.length - 1] as string;
    const theme = inMemoryDB.themes.get(id);
    if (theme) {
      if (params?.[0]) theme.name = params[0] as string;
      if (params?.[1] !== undefined) theme.description = params[1] as string | null;
      if (params?.[2]) theme.html_content = params[2] as string;
      if (params?.[3]) theme.css_variables = params[3] as string;
      if (params?.[4]) theme.extracted_styles = params[4] as string;
      theme.updated_at = params?.[5] as Date || new Date();
    }
    return { rows: theme ? [theme as T] : [], rowCount: theme ? 1 : 0 };
  }

  if (normalizedText.includes('delete from themes')) {
    const id = params?.[0] as string;
    const deleted = inMemoryDB.themes.delete(id);
    // Also delete associated templates
    inMemoryDB.templates.forEach((template, key) => {
      if (template.theme_id === id) {
        inMemoryDB.templates.delete(key);
      }
    });
    return { rows: [], rowCount: deleted ? 1 : 0 };
  }

  // Templates
  if (normalizedText.includes('from templates where id =')) {
    const id = params?.[0] as string;
    const template = inMemoryDB.templates.get(id);
    return { rows: template ? [template as T] : [], rowCount: template ? 1 : 0 };
  }

  if (normalizedText.includes('from templates where theme_id =')) {
    const themeId = params?.[0] as string;
    const results = Array.from(inMemoryDB.templates.values()).filter(t => t.theme_id === themeId);
    return { rows: results as T[], rowCount: results.length };
  }

  // Templates with access control: public OR owned OR in user's organizations (using ANY clause)
  if (normalizedText.includes('from templates where') && normalizedText.includes('any(')) {
    const userId = params?.[0] as string;
    const userOrgIds = params?.[1] as string[] || [];
    const results = Array.from(inMemoryDB.templates.values()).filter(t =>
      t.is_public || t.created_by === userId || (t.organization_id && userOrgIds.includes(t.organization_id))
    );
    return { rows: results as T[], rowCount: results.length };
  }

  if (normalizedText.includes('from templates where') && normalizedText.includes('organization_id')) {
    const userId = params?.[0] as string;
    const orgId = params?.[1] as string;
    const results = Array.from(inMemoryDB.templates.values()).filter(t =>
      t.is_public || t.created_by === userId || t.organization_id === orgId
    );
    return { rows: results as T[], rowCount: results.length };
  }

  if (normalizedText.includes('from templates')) {
    const results = Array.from(inMemoryDB.templates.values());
    return { rows: results as T[], rowCount: results.length };
  }

  if (normalizedText.includes('insert into templates')) {
    // Params: id, theme_id, name, description, type, master, category, html, pptx_renderer_code, note, thumbnail, organization_id, created_by, is_public, created_at, updated_at
    const template = {
      id: params?.[0] as string,
      theme_id: params?.[1] as string | null,
      name: params?.[2] as string,
      description: params?.[3] as string | null,
      type: params?.[4] as string,
      master: params?.[5] as string,
      category: params?.[6] as string,
      html: params?.[7] as string,
      pptx_renderer_code: params?.[8] as string | null,
      note: params?.[9] as string | null,
      thumbnail: params?.[10] as string | null,
      organization_id: params?.[11] as string | null,
      created_by: params?.[12] as string,
      is_public: params?.[13] as boolean,
      created_at: params?.[14] as Date,
      updated_at: params?.[15] as Date,
    };
    inMemoryDB.templates.set(template.id, template);
    return { rows: [template as T], rowCount: 1 };
  }

  if (normalizedText.includes('update templates set')) {
    const id = params?.[params.length - 1] as string;
    const template = inMemoryDB.templates.get(id);
    if (template) {
      if (params?.[0] !== undefined) template.theme_id = params[0] as string | null;
      if (params?.[1]) template.name = params[1] as string;
      if (params?.[2] !== undefined) template.description = params[2] as string | null;
      if (params?.[3]) template.type = params[3] as string;
      if (params?.[4]) template.master = params[4] as string;
      if (params?.[5]) template.category = params[5] as string;
      if (params?.[6]) template.html = params[6] as string;
      if (params?.[7] !== undefined) template.pptx_renderer_code = params[7] as string | null;
      if (params?.[8] !== undefined) template.note = params[8] as string | null;
      if (params?.[9] !== undefined) template.thumbnail = params[9] as string | null;
      template.updated_at = params?.[10] as Date || new Date();
    }
    return { rows: template ? [template as T] : [], rowCount: template ? 1 : 0 };
  }

  if (normalizedText.includes('delete from templates where theme_id')) {
    const themeId = params?.[0] as string;
    let deleted = 0;
    inMemoryDB.templates.forEach((template, key) => {
      if (template.theme_id === themeId) {
        inMemoryDB.templates.delete(key);
        deleted++;
      }
    });
    return { rows: [], rowCount: deleted };
  }

  if (normalizedText.includes('delete from templates')) {
    const id = params?.[0] as string;
    const deleted = inMemoryDB.templates.delete(id);
    return { rows: [], rowCount: deleted ? 1 : 0 };
  }

  // Organization Invitations
  if (normalizedText.includes('insert into organization_invitations')) {
    const invitation = {
      id: params?.[0] as string,
      organization_id: params?.[1] as string,
      email: (params?.[2] as string)?.toLowerCase(),
      role: params?.[3] as string,
      invited_by: params?.[4] as string,
      status: params?.[5] as string || 'pending',
      expires_at: params?.[6] as Date,
      created_at: params?.[7] as Date || new Date(),
    };
    inMemoryDB.organization_invitations.set(invitation.id, invitation);
    return { rows: [invitation as T], rowCount: 1 };
  }

  if (normalizedText.includes('from organization_invitations where id =')) {
    const id = params?.[0] as string;
    const invitation = inMemoryDB.organization_invitations.get(id);
    return { rows: invitation ? [invitation as T] : [], rowCount: invitation ? 1 : 0 };
  }

  if (normalizedText.includes('from organization_invitations where organization_id =') && normalizedText.includes('email =')) {
    const orgId = params?.[0] as string;
    const email = (params?.[1] as string)?.toLowerCase();
    const invitation = Array.from(inMemoryDB.organization_invitations.values()).find(
      i => i.organization_id === orgId && i.email === email && i.status === 'pending'
    );
    return { rows: invitation ? [invitation as T] : [], rowCount: invitation ? 1 : 0 };
  }

  if (normalizedText.includes('from organization_invitations where organization_id =')) {
    const orgId = params?.[0] as string;
    const results = Array.from(inMemoryDB.organization_invitations.values()).filter(
      i => i.organization_id === orgId
    );
    return { rows: results as T[], rowCount: results.length };
  }

  if (normalizedText.includes('from organization_invitations where email =')) {
    const email = (params?.[0] as string)?.toLowerCase();
    const results = Array.from(inMemoryDB.organization_invitations.values()).filter(
      i => i.email === email && i.status === 'pending'
    );
    return { rows: results as T[], rowCount: results.length };
  }

  if (normalizedText.includes('update organization_invitations set status')) {
    const status = params?.[0] as string;
    const id = params?.[1] as string;
    const invitation = inMemoryDB.organization_invitations.get(id);
    if (invitation) {
      invitation.status = status;
    }
    return { rows: invitation ? [invitation as T] : [], rowCount: invitation ? 1 : 0 };
  }

  if (normalizedText.includes('delete from organization_invitations')) {
    const id = params?.[0] as string;
    const deleted = inMemoryDB.organization_invitations.delete(id);
    return { rows: [], rowCount: deleted ? 1 : 0 };
  }

  // Default fallback
  logger.warn('Unhandled in-memory query:', { text: text.substring(0, 200) });
  return { rows: [], rowCount: 0 };
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  if (useInMemory) return true;
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// Graceful shutdown
export async function closeDatabasePool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    logger.info('Database pool closed');
  }
}

// Export pool for direct access if needed
export { pgPool as pool };
