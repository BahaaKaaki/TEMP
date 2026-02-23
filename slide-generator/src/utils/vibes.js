// Vibes - Design variations (orthogonal dimension to templates)
// ARCHITECTURE: CSS-based design system with data-vibe attribute
// All visual styling handled by CSS in slides.css using [data-vibe="..."] selectors.
// Vibes change aesthetics (colors, borders, shadows) without affecting layout.

/**
 * COLOR PALETTE (Strategy& brand):
 * - Burgundy/Maroon: #8E1E1E (primary accent)
 * - Dark Red: #A32020 (secondary accent)
 * - Black: #111111 (text)
 * - Dark Grey: #4A4F57 (meta text)
 * - Light Grey: #E6E9EE (borders)
 * - Zone backgrounds: #F7F9FB, #FAFAFA
 * - Rose/Pink: #F8E3E3, #FDF6F6 (light accents)
 */

export const VIBES = {
  // ===== DEFAULT (BASE) =====
  // The solid base - clean Strategy& styling from slides.css
  // No modifications, perfect as-is
  default: {
    id: 'default',
    name: 'Base',
    description: 'Clean Strategy& styling - the solid foundation.',
    gptDescription: `BASE VIBE - The solid foundation.
Use standard Strategy& styling:
- Clean left accent bars (4px maroon #8E1E1E)
- White card backgrounds with subtle shadows
- Clear visual hierarchy: title > subtitle > content
- Consistent spacing and typography
- Professional, clean, no embellishments
This is the default, well-tested layout that works reliably.`,
    aiHint: 'Base: clean accent bars, standard cards, professional, reliable',
    isBase: true, // Flag indicating this uses base CSS only
  },

  // ===== BOLD =====
  // Reimagined: Impact-focused, larger elements, stronger visual weight
  bold: {
    id: 'bold',
    name: 'Bold',
    description: 'Impact-focused with stronger visual weight.',
    gptDescription: `BOLD VIBE - Maximum Impact.
Reimagine the slide for maximum visual impact:
- LARGER numbers and statistics (make KPIs 2x size)
- THICKER accent elements (6px+ borders, heavy dividers)
- MORE contrast (dark backgrounds for headers, white text)
- BOLDER typography (consider all-caps for headers)
- BIGGER icons in filled circles
- Create visual punch - this is for persuasion and sales pitches
Use the same Strategy& colors but make everything MORE impactful.`,
    aiHint: 'Bold: maximum impact, larger stats, thicker accents, more contrast, for sales/pitches',
  },

  // ===== CORPORATE =====
  // Reimagined: Formal structure, numbered sections, traditional business
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    description: 'Formal structure with traditional business elements.',
    gptDescription: `CORPORATE VIBE - Formal Business Structure.
Reimagine the slide with traditional business formality:
- ADD section numbers (1.0, 1.1, 2.0) for hierarchical structure
- USE tables instead of cards where appropriate
- INCLUDE formal headers/labels (uppercase, letter-spaced)
- ORGANIZE content in clear rows/columns with borders
- CONSIDER footnotes, sources, disclaimers styling
- THINK annual reports, board presentations, regulatory filings
Keep it clean but structured - information should feel organized and official.`,
    aiHint: 'Corporate: numbered sections, tables, uppercase headers, formal structure, for board/regulatory',
  },

  // ===== CREATIVE =====
  // Reimagined: Dynamic layouts, asymmetry, visual storytelling
  creative: {
    id: 'creative',
    name: 'Creative',
    description: 'Dynamic layouts with visual storytelling.',
    gptDescription: `CREATIVE VIBE - Visual Storytelling.
Reimagine the slide with creative visual approaches:
- BREAK the grid - consider asymmetric layouts
- USE visual metaphors (timelines as journeys, data as stories)
- ADD visual interest through varied element sizes
- CONSIDER card overlapping, offset positioning
- USE more rounded corners (16px+) for friendly feel
- THINK startup pitches, brand presentations, creative agencies
Make it visually interesting while keeping content clear.`,
    aiHint: 'Creative: break the grid, visual storytelling, rounded corners, for pitches/brand',
  },

  // ===== MINIMAL =====
  // Reimagined: Maximum whitespace, essential content only
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Maximum whitespace, essential content only.',
    gptDescription: `MINIMAL VIBE - Essence Only.
Reimagine the slide with radical simplicity:
- REMOVE all decorative elements (no borders, minimal shadows)
- MAXIMIZE whitespace - let content breathe
- USE typography as the primary visual element
- ONE focal point per slide - what's the key message?
- CONSIDER large text statements vs. many small items
- THINK TED talks, keynotes, executive presentations
Less is more. What can you remove while keeping the message?`,
    aiHint: 'Minimal: maximum whitespace, no decoration, typography-focused, for keynotes',
  },
};

// Default vibe - the solid base
export const DEFAULT_VIBE = 'default';

// Get vibe by ID
export function getVibe(vibeId) {
  return VIBES[vibeId] || VIBES[DEFAULT_VIBE];
}

// Get all vibes for UI
export function getAllVibes() {
  return Object.values(VIBES);
}

// Get vibe context for AI regeneration
export function getVibePromptContext(vibeId) {
  const vibe = getVibe(vibeId);
  return vibe.gptDescription;
}

// Get short hint for vibe
export function getVibeShortHint(vibeId) {
  const vibe = getVibe(vibeId);
  return `[Vibe: ${vibe.name}] ${vibe.aiHint}`;
}

// Check if vibe is the base (no regeneration needed)
export function isBaseVibe(vibeId) {
  const vibe = getVibe(vibeId);
  return vibe.isBase === true;
}

// Get all vibes for GPT selection
export function getAllVibesForGPT() {
  return Object.values(VIBES).map(vibe => ({
    id: vibe.id,
    name: vibe.name,
    description: vibe.description,
    aiHint: vibe.aiHint,
  }));
}

// Generate CSS variables for a vibe
// NOTE: Vibes are now fully CSS-based in slides.css using [data-vibe="..."] selectors.
// This function returns empty since slides.css handles all styling.
export function getVibeCSS(vibeId) {
  return '';
}

// ============================================
// VIBE-AWARE CSS
// ============================================
// NOTE: All vibe CSS has moved to slides.css for the design system.
// This export is kept for backwards compatibility with preview components.
// The actual styling is in slides.css (lines 10361+) using [data-vibe="..."] selectors.
// ============================================
export const VIBE_AWARE_CSS = `
/* Vibe system: All styles now in slides.css */
/* This placeholder ensures components that import VIBE_AWARE_CSS still work */
`;

// ============================================
// PPTX VIBE STYLING - For PowerPoint export
// ============================================
export const PPTX_VIBE_STYLES = {
  default: {
    name: 'Base',
    colors: {
      main: '111111',
      secondary: '222222',
      accent: '8E1E1E',
      accentLight: 'F8E3E3',
      cardBg: 'FFFFFF',
      border: 'E6E9EE',
      meta: '4A4F57',
    },
    hint: 'Standard Strategy& styling - clean accent bars, professional layout',
  },
  bold: {
    name: 'Bold',
    colors: {
      main: '111111',
      secondary: '222222',
      accent: '8E1E1E',
      accentLight: 'F8E3E3',
      cardBg: 'F7F9FB',
      border: 'E6E9EE',
      meta: '4A4F57',
    },
    hint: 'Maximum impact - larger KPIs (2x), thicker accents (6px+), more contrast, filled icons',
  },
  corporate: {
    name: 'Corporate',
    colors: {
      main: '111111',
      secondary: '222222',
      accent: '8E1E1E',
      accentLight: 'F5F5F5',
      cardBg: 'FFFFFF',
      border: 'E6E9EE',
      meta: '4A4F57',
    },
    hint: 'Formal structure - numbered sections, tables, uppercase headers, clean borders',
  },
  creative: {
    name: 'Creative',
    colors: {
      main: '111111',
      secondary: '333333',
      accent: 'A32020',
      accentLight: 'FDF6F6',
      cardBg: 'FFFFFF',
      border: 'F0F0F0',
      meta: '666666',
    },
    hint: 'Visual storytelling - asymmetric layouts, rounded corners (16px), varied element sizes',
  },
  // Dark is not a selectable vibe - it's an independent toggle applied to the full deck
  // This entry is kept for PPTX export when dark mode is enabled
  dark: {
    name: 'Dark',
    colors: {
      main: 'e2e8f0',
      secondary: '94a3b8',
      accent: '8E1E1E',
      accentLight: '334155',
      cardBg: '1E293B',
      border: '334155',
      meta: '64748b',
      pageBg: '0F172A',
    },
    hint: 'Dark mode - dark background, high contrast text, monospace numbers, bordered icons',
  },
  minimal: {
    name: 'Minimal',
    colors: {
      main: '111111',
      secondary: '444444',
      accent: '8E1E1E',
      accentLight: 'FFFFFF',
      cardBg: 'FFFFFF',
      border: 'F5F5F5',
      meta: '888888',
    },
    hint: 'Radical simplicity - maximum whitespace, no decoration, typography-focused',
  },
};

// Get PPTX vibe style by ID
export function getPptxVibeStyle(vibeId) {
  return PPTX_VIBE_STYLES[vibeId] || PPTX_VIBE_STYLES.default;
}

// Generate PPTX color constant string for a vibe
export function getPptxVibeColors(vibeId) {
  const style = getPptxVibeStyle(vibeId);
  const c = style.colors;
  return `const c = {main:'${c.main}',secondary:'${c.secondary}',accent:'${c.accent}',accentLight:'${c.accentLight}',cardBg:'${c.cardBg}',border:'${c.border}',meta:'${c.meta}'};`;
}

// Generate PPTX styling hint for AI prompt
export function getPptxVibeHint(vibeId) {
  const style = getPptxVibeStyle(vibeId);
  return `VIBE: ${style.name.toUpperCase()} - ${style.hint}`;
}

// Quick reference for all vibes
// Note: Dark mode is a separate toggle, not a vibe
export const VIBE_QUICK_REFERENCE = `
VIBES (select based on presentation context):
- default (Base): Clean Strategy& styling, reliable foundation
- bold: Maximum impact, for sales and persuasion
- corporate: Formal structure, for board and regulatory
- creative: Visual storytelling, for pitches and brand
- minimal: Radical simplicity, for keynotes and TED-style

Note: Dark mode is an independent toggle that can be applied to any vibe.
`;

// ============================================
// VIBE EXAMPLE SLIDES - Unique HTML for each vibe
// ============================================

// Same content, completely different visual presentation for each vibe
const CARD_CONTENT = [
  { num: '1', title: 'Market expansion', desc: 'Enter three new geographic markets while strengthening existing positions through targeted investments.' },
  { num: '2', title: 'Digital transformation', desc: 'Modernize core systems and adopt cloud-first architecture to improve operational efficiency by 40%.' },
  { num: '3', title: 'Talent development', desc: 'Build internal capabilities through upskilling programs and strategic hiring in key growth areas.' },
];

export function generateVibeExampleSlide(vibeId) {
  switch (vibeId) {
    case 'bold': return generateBoldExample();
    case 'corporate': return generateCorporateExample();
    case 'creative': return generateCreativeExample();
    case 'data': return generateDataExample();
    case 'minimal': return generateMinimalExample();
    default: return generateDefaultExample();
  }
}

// ===== DEFAULT (BASE) =====
// Clean Strategy& styling - simple cards, clean and professional
function generateDefaultExample() {
  return `<div class="slide master-standard">
  <h1 class="title">Three strategic priorities for growth</h1>
  <h2 class="subtitle">Base vibe - clean professional foundation</h2>
  <div class="frame">
    <div style="display:flex;gap:16px;">
      ${CARD_CONTENT.map(c => `
      <div style="flex:1;background:#F7F9FB;border-left:4px solid #8E1E1E;padding:18px;border-radius:4px;">
        <div style="width:36px;height:36px;background:#F8E3E3;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;color:#8E1E1E;font-weight:600;margin-bottom:12px;">${c.num}</div>
        <h3 style="font-size:15px;font-weight:600;margin:0 0 8px;color:#111;">${c.title}</h3>
        <p style="font-size:12px;line-height:1.5;color:#444;margin:0;">${c.desc}</p>
      </div>`).join('')}
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>1</span></footer>
</div>`;
}

// ===== BOLD =====
// Maximum impact - dark headers, thick accents, filled icons, dramatic contrast
function generateBoldExample() {
  return `<div class="slide master-standard">
  <h1 class="title" style="font-size:32px;font-weight:800;letter-spacing:-0.5px;">THREE STRATEGIC PRIORITIES</h1>
  <h2 class="subtitle" style="text-transform:uppercase;letter-spacing:2px;font-size:14px;color:#8E1E1E;">Bold vibe • Maximum impact</h2>
  <div class="frame">
    <div style="display:flex;gap:16px;">
      ${CARD_CONTENT.map((c, i) => `
      <div style="flex:1;background:#1A1A1A;border-radius:8px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
        <div style="background:#8E1E1E;padding:16px 20px;display:flex;align-items:center;gap:14px;">
          <div style="width:48px;height:48px;background:white;color:#8E1E1E;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;">${c.num}</div>
          <h3 style="font-size:16px;font-weight:800;margin:0;color:white;text-transform:uppercase;letter-spacing:1px;">${c.title}</h3>
        </div>
        <div style="padding:20px;">
          <p style="font-size:12px;line-height:1.6;color:#ccc;margin:0 0 16px;">${c.desc}</p>
          <div style="background:#8E1E1E;padding:10px 14px;border-radius:4px;text-align:center;">
            <span style="font-size:12px;font-weight:800;color:white;text-transform:uppercase;letter-spacing:1px;">${['🎯 Priority', '⚡ Critical', '🚀 Key'][i]}</span>
          </div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>1</span></footer>
</div>`;
}

// ===== CORPORATE =====
// Formal structure - numbered sections, clear table grid, professional borders
function generateCorporateExample() {
  const statuses = [
    { label: 'APPROVED', bg: '#dcfce7', color: '#166534' },
    { label: 'IN REVIEW', bg: '#fef3c7', color: '#92400e' },
    { label: 'PENDING', bg: '#dbeafe', color: '#1e40af' },
  ];
  return `<div class="slide master-standard">
  <h1 class="title">Strategic Priorities for Growth</h1>
  <h2 class="subtitle">Corporate vibe - formal business structure</h2>
  <div class="frame">
    <div style="border:2px solid #4A4F57;border-radius:4px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:70px 140px 1fr 100px;background:#4A4F57;">
        <div style="padding:14px 12px;font-size:12px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:1px;border-right:1px solid #5a5f67;">Ref.</div>
        <div style="padding:14px 12px;font-size:12px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:1px;border-right:1px solid #5a5f67;">Initiative</div>
        <div style="padding:14px 12px;font-size:12px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:1px;border-right:1px solid #5a5f67;">Description</div>
        <div style="padding:14px 12px;font-size:12px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:1px;">Status</div>
      </div>
      ${CARD_CONTENT.map((c, i) => `
      <div style="display:grid;grid-template-columns:70px 140px 1fr 100px;border-bottom:1px solid #E6E9EE;background:${i % 2 ? '#F5F6F8' : 'white'};">
        <div style="padding:16px 12px;font-size:16px;font-weight:800;color:#8E1E1E;border-right:1px solid #E6E9EE;">${i + 1}.0</div>
        <div style="padding:16px 12px;font-size:13px;font-weight:700;color:#111;border-right:1px solid #E6E9EE;text-transform:uppercase;">${c.title}</div>
        <div style="padding:16px 12px;font-size:11px;color:#444;line-height:1.5;border-right:1px solid #E6E9EE;">${c.desc}</div>
        <div style="padding:16px 12px;text-align:center;"><span style="background:${statuses[i].bg};color:${statuses[i].color};padding:4px 10px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${statuses[i].label}</span></div>
      </div>`).join('')}
    </div>
    <div style="margin-top:12px;font-size:10px;color:#666;text-align:right;">Source: Strategic Planning Committee | FY2025 Review</div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>1</span></footer>
</div>`;
}

// ===== CREATIVE =====
// Visual storytelling - very rounded, soft gradients, floating cards, friendly feel
function generateCreativeExample() {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  ];
  const emojis = ['🚀', '💡', '🎯'];
  return `<div class="slide master-standard" style="background:linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);">
  <h1 class="title" style="text-align:center;">Our Journey to Growth ✨</h1>
  <h2 class="subtitle" style="text-align:center;color:#8E1E1E;">Creative vibe - visual storytelling</h2>
  <div class="frame">
    <div style="display:flex;gap:24px;padding:10px;">
      ${CARD_CONTENT.map((c, i) => `
      <div style="flex:1;background:white;border-radius:24px;padding:0;box-shadow:0 10px 40px rgba(0,0,0,0.12);overflow:hidden;transform:rotate(${i === 1 ? '0' : i === 0 ? '-1' : '1'}deg);">
        <div style="height:8px;background:${gradients[i]};"></div>
        <div style="padding:24px;">
          <div style="width:56px;height:56px;background:${gradients[i]};border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">${emojis[i]}</div>
          <h3 style="font-size:16px;font-weight:700;margin:0 0 10px;color:#333;">${c.title}</h3>
          <p style="font-size:12px;line-height:1.6;color:#666;margin:0;">${c.desc}</p>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <footer class="footer"><span>Strategy&</span><span>1</span></footer>
</div>`;
}

// ===== DATA =====
// Dashboard metrics - prominent KPIs, gauges, trends, dark metric headers
function generateDataExample() {
  const metrics = [
    { value: '87%', delta: '+12%', deltaUp: true, target: 'Target: 90%', progress: 87 },
    { value: '$4.2M', delta: '+23%', deltaUp: true, target: 'Target: $5M', progress: 84 },
    { value: '156', delta: '-3%', deltaUp: false, target: 'Target: 200', progress: 78 },
  ];
  return `<div class="slide master-standard" style="background:#0F172A;">
  <h1 class="title" style="color:white;">Strategic Performance Dashboard</h1>
  <h2 class="subtitle" style="color:#64748b;">Data vibe - analytics focus • Updated: Jan 2025</h2>
  <div class="frame">
    <div style="display:flex;gap:16px;">
      ${CARD_CONTENT.map((c, i) => `
      <div style="flex:1;background:#1E293B;border-radius:12px;padding:20px;border:1px solid #334155;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">KPI ${c.num}</span>
          <span style="font-size:11px;color:${metrics[i].deltaUp ? '#22c55e' : '#ef4444'};font-weight:700;">${metrics[i].deltaUp ? '▲' : '▼'} ${metrics[i].delta}</span>
        </div>
        <div style="font-size:42px;font-weight:800;color:white;font-family:'SF Mono',Consolas,monospace;margin-bottom:4px;letter-spacing:-1px;">${metrics[i].value}</div>
        <div style="font-size:10px;color:#64748b;margin-bottom:12px;">${metrics[i].target}</div>
        <h3 style="font-size:13px;font-weight:600;margin:0 0 8px;color:#e2e8f0;">${c.title}</h3>
        <p style="font-size:11px;line-height:1.5;color:#94a3b8;margin:0 0 16px;">${c.desc.substring(0, 80)}...</p>
        <div style="height:8px;background:#334155;border-radius:4px;overflow:hidden;">
          <div style="width:${metrics[i].progress}%;height:100%;background:linear-gradient(90deg,#8E1E1E,#ef4444);border-radius:4px;"></div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <footer class="footer" style="color:#64748b;border-top-color:#334155;"><span>Strategy& Analytics</span><span>Live Dashboard</span></footer>
</div>`;
}

// ===== MINIMAL =====
// Radical simplicity - extreme whitespace, elegant typography, no decoration
function generateMinimalExample() {
  return `<div class="slide master-standard" style="background:white;">
  <h1 class="title" style="font-size:36px;font-weight:300;letter-spacing:-1px;margin-bottom:4px;">Three priorities</h1>
  <h2 class="subtitle" style="font-weight:400;color:#999;font-size:14px;">Minimal vibe — essential content only</h2>
  <div class="frame">
    <div style="display:flex;gap:80px;padding:40px 20px;">
      ${CARD_CONTENT.map(c => `
      <div style="flex:1;">
        <div style="font-size:72px;font-weight:100;color:#8E1E1E;line-height:0.9;margin-bottom:20px;opacity:0.9;">${c.num}</div>
        <h3 style="font-size:18px;font-weight:500;margin:0 0 16px;color:#222;letter-spacing:-0.5px;">${c.title}</h3>
        <p style="font-size:13px;line-height:1.7;color:#888;margin:0;font-weight:300;">${c.desc}</p>
      </div>`).join('')}
    </div>
  </div>
  <footer class="footer" style="border:none;color:#ccc;"><span></span><span>01</span></footer>
</div>`;
}

// Get available example template types
export function getVibeExampleTemplates() {
  return ['three-cards'];
}
