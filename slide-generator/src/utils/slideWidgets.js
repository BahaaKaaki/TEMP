/**
 * Slide Widget Library - Strategy& Design System
 *
 * A collection of 40+ reusable UI components for building slides.
 * All widgets follow the Strategy& consulting slide standards:
 * - CSS variables: --main, --maroon, --zone1, --rose, --secondary, --meta, --coal
 * - Typography: Georgia for display, Arial for body
 * - Auto-layout: .auto-row, .auto-col, .auto-grid
 * - Components: .content-box, .metric-box, .section-box, .highlight-box
 *
 * Widgets are meant to be placed inside the .frame container.
 */

export const WIDGET_CATEGORIES = {
  CHARTS: 'charts',
  CARDS: 'cards',
  STATISTICS: 'statistics',
  LISTS: 'lists',
  INFOGRAPHICS: 'infographics',
  TEXT: 'text',
  LAYOUTS: 'layouts',
  TABLES: 'tables',
  MEDIA: 'media'
};

export const slideWidgets = [
  // ============================================
  // CHARTS (1-7) - Executive Design
  // ============================================
  {
    id: 'chart-bar-horizontal',
    name: 'Executive Bar Chart',
    category: WIDGET_CATEGORIES.CHARTS,
    description: 'Premium horizontal bar chart with gradient fills and refined typography',
    html: `<div class="exec-widget">
  <div class="exec-widget-header">
    <h3 class="exec-widget-title">Performance by Business Unit</h3>
    <span class="exec-widget-subtitle">FY2024 Results vs Target</span>
  </div>
  <div class="exec-bar-chart">
    <div class="exec-bar-item">
      <div class="exec-bar-meta">
        <span class="exec-bar-label">Digital Services</span>
        <span class="exec-bar-value">92%</span>
      </div>
      <div class="exec-bar-track">
        <div class="exec-bar-fill" style="width: 92%; background: linear-gradient(90deg, #6B1515 0%, #8E1E1E 100%);"></div>
        <div class="exec-bar-target" style="left: 85%;"></div>
      </div>
    </div>
    <div class="exec-bar-item">
      <div class="exec-bar-meta">
        <span class="exec-bar-label">Advisory</span>
        <span class="exec-bar-value">78%</span>
      </div>
      <div class="exec-bar-track">
        <div class="exec-bar-fill" style="width: 78%; background: linear-gradient(90deg, #8E1E1E 0%, #A82828 100%);"></div>
        <div class="exec-bar-target" style="left: 80%;"></div>
      </div>
    </div>
    <div class="exec-bar-item">
      <div class="exec-bar-meta">
        <span class="exec-bar-label">Operations</span>
        <span class="exec-bar-value">65%</span>
      </div>
      <div class="exec-bar-track">
        <div class="exec-bar-fill" style="width: 65%; background: linear-gradient(90deg, #A82828 0%, #C53030 100%);"></div>
        <div class="exec-bar-target" style="left: 75%;"></div>
      </div>
    </div>
    <div class="exec-bar-item">
      <div class="exec-bar-meta">
        <span class="exec-bar-label">Infrastructure</span>
        <span class="exec-bar-value">58%</span>
      </div>
      <div class="exec-bar-track">
        <div class="exec-bar-fill caution" style="width: 58%; background: linear-gradient(90deg, #D97706 0%, #F59E0B 100%);"></div>
        <div class="exec-bar-target" style="left: 70%;"></div>
      </div>
    </div>
  </div>
  <div class="exec-legend">
    <span class="exec-legend-item"><i class="exec-dot filled"></i>Actual</span>
    <span class="exec-legend-item"><i class="exec-dot target"></i>Target</span>
  </div>
</div>`
  },
  {
    id: 'chart-bar-vertical',
    name: 'Executive Column Chart',
    category: WIDGET_CATEGORIES.CHARTS,
    description: 'Sophisticated vertical column chart with value labels and trend line',
    html: `<div class="exec-widget">
  <div class="exec-widget-header">
    <h3 class="exec-widget-title">Quarterly Revenue</h3>
    <div class="exec-kpi-badge positive">+18% YoY</div>
  </div>
  <div class="exec-col-chart">
    <div class="exec-col-container">
      <div class="exec-col-wrapper">
        <div class="exec-col" style="height: 65%;">
          <span class="exec-col-value">$2.1M</span>
        </div>
        <span class="exec-col-label">Q1</span>
      </div>
      <div class="exec-col-wrapper">
        <div class="exec-col" style="height: 72%;">
          <span class="exec-col-value">$2.3M</span>
        </div>
        <span class="exec-col-label">Q2</span>
      </div>
      <div class="exec-col-wrapper">
        <div class="exec-col" style="height: 85%;">
          <span class="exec-col-value">$2.7M</span>
        </div>
        <span class="exec-col-label">Q3</span>
      </div>
      <div class="exec-col-wrapper highlight">
        <div class="exec-col" style="height: 100%;">
          <span class="exec-col-value">$3.2M</span>
        </div>
        <span class="exec-col-label">Q4</span>
      </div>
    </div>
    <svg class="exec-trend-line" viewBox="0 0 100 50" preserveAspectRatio="none">
      <path d="M5,40 Q25,35 35,32 T55,25 T80,15 T95,8" fill="none" stroke="#8E1E1E" stroke-width="2" stroke-dasharray="4,2"/>
    </svg>
  </div>
</div>`
  },
  {
    id: 'chart-donut',
    name: 'Executive Donut Chart',
    category: WIDGET_CATEGORIES.CHARTS,
    description: 'Elegant donut chart with centered KPI and refined legend',
    html: `<div class="exec-widget">
  <div class="exec-widget-header">
    <h3 class="exec-widget-title">Market Position</h3>
    <span class="exec-widget-subtitle">Global Market Share Analysis</span>
  </div>
  <div class="exec-donut-container">
    <div class="exec-donut">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#F1F5F9" stroke-width="16"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="#8E1E1E" stroke-width="16"
                stroke-dasharray="188 314" stroke-dashoffset="0" transform="rotate(-90 60 60)"
                style="filter: drop-shadow(0 2px 4px rgba(142,30,30,0.3));"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="#1E293B" stroke-width="16"
                stroke-dasharray="78 314" stroke-dashoffset="-188" transform="rotate(-90 60 60)"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="#CBD5E1" stroke-width="16"
                stroke-dasharray="48 314" stroke-dashoffset="-266" transform="rotate(-90 60 60)"/>
      </svg>
      <div class="exec-donut-center">
        <span class="exec-donut-value">60%</span>
        <span class="exec-donut-label">Share</span>
      </div>
    </div>
    <div class="exec-donut-legend">
      <div class="exec-legend-row">
        <span class="exec-legend-dot" style="background: #8E1E1E;"></span>
        <span class="exec-legend-text">Our Company</span>
        <span class="exec-legend-val">60%</span>
      </div>
      <div class="exec-legend-row">
        <span class="exec-legend-dot" style="background: #1E293B;"></span>
        <span class="exec-legend-text">Competitor A</span>
        <span class="exec-legend-val">25%</span>
      </div>
      <div class="exec-legend-row">
        <span class="exec-legend-dot" style="background: #CBD5E1;"></span>
        <span class="exec-legend-text">Others</span>
        <span class="exec-legend-val">15%</span>
      </div>
    </div>
  </div>
</div>`
  },
  {
    id: 'chart-line',
    name: 'Executive Trend Chart',
    category: WIDGET_CATEGORIES.CHARTS,
    description: 'Premium area chart with gradient fill and data points',
    html: `<div class="exec-widget">
  <div class="exec-widget-header">
    <h3 class="exec-widget-title">Revenue Growth Trajectory</h3>
    <div class="exec-kpi-row">
      <div class="exec-kpi-mini">
        <span class="exec-kpi-val">$12.4M</span>
        <span class="exec-kpi-lbl">Current</span>
      </div>
      <div class="exec-kpi-mini positive">
        <span class="exec-kpi-val">+24%</span>
        <span class="exec-kpi-lbl">Growth</span>
      </div>
    </div>
  </div>
  <div class="exec-line-chart">
    <svg viewBox="0 0 320 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="execAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#8E1E1E;stop-opacity:0.25"/>
          <stop offset="100%" style="stop-color:#8E1E1E;stop-opacity:0.02"/>
        </linearGradient>
      </defs>
      <path d="M0,85 C30,75 50,70 80,55 S130,45 160,40 S210,30 240,25 S290,18 320,12 L320,100 L0,100 Z"
            fill="url(#execAreaGrad)"/>
      <path d="M0,85 C30,75 50,70 80,55 S130,45 160,40 S210,30 240,25 S290,18 320,12"
            fill="none" stroke="#8E1E1E" stroke-width="3" stroke-linecap="round"/>
      <circle cx="80" cy="55" r="4" fill="#fff" stroke="#8E1E1E" stroke-width="2"/>
      <circle cx="160" cy="40" r="4" fill="#fff" stroke="#8E1E1E" stroke-width="2"/>
      <circle cx="240" cy="25" r="4" fill="#fff" stroke="#8E1E1E" stroke-width="2"/>
      <circle cx="320" cy="12" r="6" fill="#8E1E1E" stroke="#fff" stroke-width="2"/>
    </svg>
    <div class="exec-chart-labels">
      <span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'chart-gauge',
    name: 'Executive Gauge',
    category: WIDGET_CATEGORIES.CHARTS,
    description: 'Premium radial gauge with target indicator and status',
    html: `<div class="exec-widget">
  <div class="exec-widget-header">
    <h3 class="exec-widget-title">Operational Excellence Score</h3>
  </div>
  <div class="exec-gauge-container">
    <svg viewBox="0 0 200 120" class="exec-gauge">
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#DC2626"/>
          <stop offset="50%" style="stop-color:#F59E0B"/>
          <stop offset="100%" style="stop-color:#10B981"/>
        </linearGradient>
      </defs>
      <path d="M25,105 A75,75 0 0,1 175,105" fill="none" stroke="#F1F5F9" stroke-width="18" stroke-linecap="round"/>
      <path d="M25,105 A75,75 0 0,1 175,105" fill="none" stroke="url(#gaugeGrad)" stroke-width="18" stroke-linecap="round" stroke-dasharray="200 235"/>
      <path d="M25,105 A75,75 0 0,1 155,45" fill="none" stroke="#8E1E1E" stroke-width="20" stroke-linecap="round"
            style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"/>
      <circle cx="155" cy="45" r="8" fill="#8E1E1E" stroke="#fff" stroke-width="3"/>
    </svg>
    <div class="exec-gauge-center">
      <span class="exec-gauge-value">84</span>
      <span class="exec-gauge-label">out of 100</span>
    </div>
    <div class="exec-gauge-meta">
      <div class="exec-gauge-status on-track">On Track</div>
      <span class="exec-gauge-target">Target: 80</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'chart-stacked-bar',
    name: 'Executive Stacked Chart',
    category: WIDGET_CATEGORIES.CHARTS,
    description: 'Premium stacked bar with segment labels and detailed legend',
    html: `<div class="exec-widget">
  <div class="exec-widget-header">
    <h3 class="exec-widget-title">Revenue Composition</h3>
    <span class="exec-widget-subtitle">By Business Segment (in $M)</span>
  </div>
  <div class="exec-stacked-chart">
    <div class="exec-stack-row">
      <div class="exec-stack-label">
        <span class="exec-stack-year">2024</span>
        <span class="exec-stack-total">$48.2M</span>
      </div>
      <div class="exec-stack-bar">
        <div class="exec-stack-seg" style="width: 45%; background: linear-gradient(90deg, #6B1515, #8E1E1E);">
          <span>$21.7M</span>
        </div>
        <div class="exec-stack-seg" style="width: 32%; background: linear-gradient(90deg, #1E293B, #334155);">
          <span>$15.4M</span>
        </div>
        <div class="exec-stack-seg" style="width: 23%; background: linear-gradient(90deg, #64748B, #94A3B8);">
          <span>$11.1M</span>
        </div>
      </div>
    </div>
    <div class="exec-stack-row">
      <div class="exec-stack-label">
        <span class="exec-stack-year">2023</span>
        <span class="exec-stack-total">$41.5M</span>
      </div>
      <div class="exec-stack-bar">
        <div class="exec-stack-seg" style="width: 42%; background: linear-gradient(90deg, #6B1515, #8E1E1E); opacity: 0.7;">
          <span>$17.4M</span>
        </div>
        <div class="exec-stack-seg" style="width: 35%; background: linear-gradient(90deg, #1E293B, #334155); opacity: 0.7;">
          <span>$14.5M</span>
        </div>
        <div class="exec-stack-seg" style="width: 23%; background: linear-gradient(90deg, #64748B, #94A3B8); opacity: 0.7;">
          <span>$9.6M</span>
        </div>
      </div>
    </div>
  </div>
  <div class="exec-legend-bar">
    <div class="exec-leg-item"><span class="exec-leg-box" style="background: #8E1E1E;"></span>Enterprise<span class="exec-leg-delta positive">+25%</span></div>
    <div class="exec-leg-item"><span class="exec-leg-box" style="background: #1E293B;"></span>Mid-Market<span class="exec-leg-delta positive">+6%</span></div>
    <div class="exec-leg-item"><span class="exec-leg-box" style="background: #94A3B8;"></span>SMB<span class="exec-leg-delta positive">+16%</span></div>
  </div>
</div>`
  },
  {
    id: 'chart-comparison',
    name: 'Executive Comparison',
    category: WIDGET_CATEGORIES.CHARTS,
    description: 'Premium year-over-year comparison with variance indicators',
    html: `<div class="exec-widget">
  <div class="exec-widget-header">
    <h3 class="exec-widget-title">Year-over-Year Performance</h3>
    <div class="exec-period-toggle">
      <span class="exec-period inactive">2023</span>
      <span class="exec-period active">2024</span>
    </div>
  </div>
  <div class="exec-compare-chart">
    <div class="exec-compare-row">
      <div class="exec-compare-meta">
        <span class="exec-compare-label">Revenue</span>
        <div class="exec-compare-delta positive">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
          +33%
        </div>
      </div>
      <div class="exec-compare-bars">
        <div class="exec-cbar prev" style="width: 65%;">
          <span class="exec-cbar-val">$2.1M</span>
        </div>
        <div class="exec-cbar curr" style="width: 87%;">
          <span class="exec-cbar-val">$2.8M</span>
        </div>
      </div>
    </div>
    <div class="exec-compare-row">
      <div class="exec-compare-meta">
        <span class="exec-compare-label">Customers</span>
        <div class="exec-compare-delta positive">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
          +28%
        </div>
      </div>
      <div class="exec-compare-bars">
        <div class="exec-cbar prev" style="width: 70%;">
          <span class="exec-cbar-val">1,240</span>
        </div>
        <div class="exec-cbar curr" style="width: 90%;">
          <span class="exec-cbar-val">1,590</span>
        </div>
      </div>
    </div>
    <div class="exec-compare-row">
      <div class="exec-compare-meta">
        <span class="exec-compare-label">NPS Score</span>
        <div class="exec-compare-delta positive">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
          +12pts
        </div>
      </div>
      <div class="exec-compare-bars">
        <div class="exec-cbar prev" style="width: 62%;">
          <span class="exec-cbar-val">62</span>
        </div>
        <div class="exec-cbar curr" style="width: 74%;">
          <span class="exec-cbar-val">74</span>
        </div>
      </div>
    </div>
  </div>
  <div class="exec-legend-inline">
    <span><i class="exec-leg-line prev"></i>2023</span>
    <span><i class="exec-leg-line curr"></i>2024</span>
  </div>
</div>`
  },

  // ============================================
  // CARDS (8-15) - Executive Design
  // ============================================
  {
    id: 'card-basic',
    name: 'Executive Content Card',
    category: WIDGET_CATEGORIES.CARDS,
    description: 'Premium card with refined typography and accent border',
    html: `<div class="exec-card">
  <div class="exec-card-accent"></div>
  <div class="exec-card-content">
    <h3 class="exec-card-title">Strategic Initiative</h3>
    <p class="exec-card-text">Transform digital capabilities through targeted investments in cloud infrastructure and AI-enabled analytics, driving operational efficiency and enhanced customer experience.</p>
    <div class="exec-card-footer">
      <span class="exec-card-tag">Priority: High</span>
      <span class="exec-card-link">Learn more →</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'card-icon',
    name: 'Executive Feature Card',
    category: WIDGET_CATEGORIES.CARDS,
    description: 'Premium card with icon badge and numbered sequence',
    html: `<div class="exec-feature-card">
  <div class="exec-feature-header">
    <div class="exec-feature-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    </div>
    <div class="exec-feature-num">01</div>
  </div>
  <h3 class="exec-feature-title">Accelerate Growth</h3>
  <p class="exec-feature-desc">Leverage advanced analytics and market intelligence to identify high-value opportunities and accelerate revenue growth across all segments.</p>
  <div class="exec-feature-metrics">
    <div class="exec-fm">
      <span class="exec-fm-val">+32%</span>
      <span class="exec-fm-lbl">Growth</span>
    </div>
    <div class="exec-fm">
      <span class="exec-fm-val">$4.2M</span>
      <span class="exec-fm-lbl">Impact</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'card-stat',
    name: 'Executive KPI Card',
    category: WIDGET_CATEGORIES.CARDS,
    description: 'Premium KPI card with sparkline and trend indicator',
    html: `<div class="exec-kpi-card">
  <div class="exec-kpi-header">
    <span class="exec-kpi-category">Financial Performance</span>
    <div class="exec-kpi-status on-track">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
      On Track
    </div>
  </div>
  <div class="exec-kpi-main">
    <div class="exec-kpi-value">$4.2M</div>
    <div class="exec-kpi-trend positive">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M7 17l5-5 5 5M7 7l5 5 5-5"/>
      </svg>
      +18.7%
    </div>
  </div>
  <div class="exec-kpi-label">Quarterly Revenue</div>
  <div class="exec-kpi-sparkline">
    <svg viewBox="0 0 100 30" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#8E1E1E;stop-opacity:0.3"/>
          <stop offset="100%" style="stop-color:#8E1E1E;stop-opacity:0"/>
        </linearGradient>
      </defs>
      <path d="M0,25 Q10,22 20,20 T40,15 T60,12 T80,8 T100,5 L100,30 L0,30 Z" fill="url(#sparkGrad)"/>
      <path d="M0,25 Q10,22 20,20 T40,15 T60,12 T80,8 T100,5" fill="none" stroke="#8E1E1E" stroke-width="2"/>
      <circle cx="100" cy="5" r="3" fill="#8E1E1E"/>
    </svg>
  </div>
  <div class="exec-kpi-footer">
    <div class="exec-kpi-compare">
      <span class="exec-kpi-prev">vs $3.5M last quarter</span>
    </div>
    <span class="exec-kpi-target">Target: $4.0M</span>
  </div>
</div>`
  },
  {
    id: 'card-profile',
    name: 'Executive Profile Card',
    category: WIDGET_CATEGORIES.CARDS,
    description: 'Premium leadership profile with photo placeholder and credentials',
    html: `<div class="exec-profile-card">
  <div class="exec-profile-header">
    <div class="exec-profile-avatar">
      <span class="exec-avatar-initials">JD</span>
      <div class="exec-avatar-ring"></div>
    </div>
    <div class="exec-profile-badge">Executive Team</div>
  </div>
  <div class="exec-profile-info">
    <h3 class="exec-profile-name">John Davidson</h3>
    <div class="exec-profile-title">Chief Executive Officer</div>
    <div class="exec-profile-org">Strategy& Global Practice</div>
  </div>
  <p class="exec-profile-bio">25+ years of experience leading transformational initiatives across Fortune 500 companies. Specialized in digital strategy and organizational change.</p>
  <div class="exec-profile-footer">
    <div class="exec-profile-stat">
      <span class="exec-pstat-val">25+</span>
      <span class="exec-pstat-lbl">Years</span>
    </div>
    <div class="exec-profile-stat">
      <span class="exec-pstat-val">50+</span>
      <span class="exec-pstat-lbl">Projects</span>
    </div>
    <div class="exec-profile-stat">
      <span class="exec-pstat-val">$2B+</span>
      <span class="exec-pstat-lbl">Impact</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'card-testimonial',
    name: 'Executive Testimonial',
    category: WIDGET_CATEGORIES.CARDS,
    description: 'Premium quote card with refined styling',
    html: `<div class="exec-testimonial">
  <div class="exec-quote-accent"></div>
  <svg class="exec-quote-mark" width="32" height="32" viewBox="0 0 24 24" fill="#8E1E1E" opacity="0.15">
    <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
  </svg>
  <blockquote class="exec-quote-text">"The transformation delivered by the team exceeded our expectations. We achieved 40% operational efficiency gains and positioned ourselves as industry leaders in digital innovation."</blockquote>
  <div class="exec-quote-author">
    <div class="exec-author-avatar">
      <span>MK</span>
    </div>
    <div class="exec-author-info">
      <span class="exec-author-name">Michael Kingsley</span>
      <span class="exec-author-role">CEO, TechCorp Industries</span>
    </div>
    <div class="exec-author-logo">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#94A3B8"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
    </div>
  </div>
</div>`
  },
  {
    id: 'card-feature',
    name: 'Executive Capability Card',
    category: WIDGET_CATEGORIES.CARDS,
    description: 'Premium feature card with numbered steps',
    html: `<div class="exec-capability-card">
  <div class="exec-cap-header">
    <div class="exec-cap-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    </div>
    <span class="exec-cap-num">01</span>
  </div>
  <h3 class="exec-cap-title">Digital Transformation</h3>
  <p class="exec-cap-desc">End-to-end digital capability building with measurable business outcomes.</p>
  <ul class="exec-cap-list">
    <li>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      Cloud infrastructure modernization
    </li>
    <li>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      AI/ML integration strategy
    </li>
    <li>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      Data-driven decision making
    </li>
  </ul>
</div>`
  },
  {
    id: 'card-pricing',
    name: 'Executive Service Tier',
    category: WIDGET_CATEGORIES.CARDS,
    description: 'Premium pricing/service tier card',
    html: `<div class="exec-tier-card">
  <div class="exec-tier-badge">Most Popular</div>
  <div class="exec-tier-header">
    <span class="exec-tier-name">Enterprise</span>
    <div class="exec-tier-price">
      <span class="exec-price-currency">$</span>
      <span class="exec-price-value">250K</span>
      <span class="exec-price-period">/engagement</span>
    </div>
  </div>
  <p class="exec-tier-desc">Comprehensive transformation program for mid-size enterprises</p>
  <div class="exec-tier-features">
    <div class="exec-tier-feat included">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      Full diagnostic assessment
    </div>
    <div class="exec-tier-feat included">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      Strategy roadmap development
    </div>
    <div class="exec-tier-feat included">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      Implementation support (12 weeks)
    </div>
    <div class="exec-tier-feat included">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      Executive coaching sessions
    </div>
  </div>
  <div class="exec-tier-cta">Request Proposal</div>
</div>`
  },
  {
    id: 'card-cta',
    name: 'Executive CTA Card',
    category: WIDGET_CATEGORIES.CARDS,
    description: 'Premium call-to-action with gradient accent',
    html: `<div class="exec-cta-card">
  <div class="exec-cta-content">
    <span class="exec-cta-eyebrow">Next Steps</span>
    <h3 class="exec-cta-title">Ready to Transform Your Organization?</h3>
    <p class="exec-cta-text">Schedule a strategic consultation with our leadership team to explore how we can accelerate your digital journey.</p>
    <div class="exec-cta-actions">
      <span class="exec-cta-primary">
        Schedule Consultation
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </span>
      <span class="exec-cta-secondary">Download Overview</span>
    </div>
  </div>
  <div class="exec-cta-visual">
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#8E1E1E" stroke-width="1" opacity="0.15">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  </div>
</div>`
  },

  // ============================================
  // STATISTICS (16-23) - Executive Design
  // ============================================
  {
    id: 'stat-big-number',
    name: 'Executive Hero Metric',
    category: WIDGET_CATEGORIES.STATISTICS,
    description: 'Large prominent statistic with context',
    html: `<div class="exec-hero-metric">
  <div class="exec-hero-glow"></div>
  <div class="exec-hero-content">
    <span class="exec-hero-prefix">$</span>
    <span class="exec-hero-value">4.2B</span>
    <span class="exec-hero-suffix">+</span>
  </div>
  <div class="exec-hero-label">Total Value Delivered</div>
  <div class="exec-hero-context">
    <span class="exec-hero-trend positive">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
      +23% vs prior year
    </span>
  </div>
</div>`
  },
  {
    id: 'stat-comparison',
    name: 'Executive Before/After',
    category: WIDGET_CATEGORIES.STATISTICS,
    description: 'Premium transformation comparison',
    html: `<div class="exec-transform-compare">
  <div class="exec-transform-title">Transformation Impact</div>
  <div class="exec-transform-grid">
    <div class="exec-transform-before">
      <span class="exec-tf-tag">Before</span>
      <span class="exec-tf-value">$2.1M</span>
      <span class="exec-tf-label">Annual Revenue</span>
    </div>
    <div class="exec-transform-arrow">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14M12 5l7 7-7 7" stroke="#8E1E1E" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="exec-tf-delta">+90%</span>
    </div>
    <div class="exec-transform-after">
      <span class="exec-tf-tag">After</span>
      <span class="exec-tf-value">$4.0M</span>
      <span class="exec-tf-label">Annual Revenue</span>
    </div>
  </div>
  <div class="exec-transform-footer">
    <span class="exec-tf-note">Achieved within 18 months of implementation</span>
  </div>
</div>`
  },
  {
    id: 'stat-grid-4',
    name: 'Executive KPI Dashboard',
    category: WIDGET_CATEGORIES.STATISTICS,
    description: 'Grid of 4 premium KPIs',
    html: `<div class="exec-kpi-grid four">
  <div class="exec-kpi-tile">
    <div class="exec-tile-icon revenue">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    </div>
    <div class="exec-tile-value">$12.4M</div>
    <div class="exec-tile-label">Revenue</div>
    <div class="exec-tile-trend positive">+18%</div>
  </div>
  <div class="exec-kpi-tile">
    <div class="exec-tile-icon growth">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>
    </div>
    <div class="exec-tile-value">847</div>
    <div class="exec-tile-label">New Clients</div>
    <div class="exec-tile-trend positive">+24%</div>
  </div>
  <div class="exec-kpi-tile">
    <div class="exec-tile-icon efficiency">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    </div>
    <div class="exec-tile-value">94%</div>
    <div class="exec-tile-label">Efficiency</div>
    <div class="exec-tile-trend positive">+8%</div>
  </div>
  <div class="exec-kpi-tile">
    <div class="exec-tile-icon satisfaction">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
    </div>
    <div class="exec-tile-value">4.8</div>
    <div class="exec-tile-label">NPS Score</div>
    <div class="exec-tile-trend positive">+0.3</div>
  </div>
</div>`
  },
  {
    id: 'stat-grid-3',
    name: 'Executive Impact Metrics',
    category: WIDGET_CATEGORIES.STATISTICS,
    description: 'Grid of 3 premium impact metrics',
    html: `<div class="exec-impact-grid">
  <div class="exec-impact-tile">
    <div class="exec-impact-ring">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" stroke-width="3"/>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#8E1E1E" stroke-width="3"
                stroke-dasharray="75 100" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <span class="exec-impact-pct">75%</span>
    </div>
    <div class="exec-impact-value">$3.2M</div>
    <div class="exec-impact-label">Cost Savings</div>
  </div>
  <div class="exec-impact-tile featured">
    <div class="exec-impact-ring">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" stroke-width="3"/>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#8E1E1E" stroke-width="3"
                stroke-dasharray="92 100" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <span class="exec-impact-pct">92%</span>
    </div>
    <div class="exec-impact-value">+42%</div>
    <div class="exec-impact-label">Productivity Gain</div>
  </div>
  <div class="exec-impact-tile">
    <div class="exec-impact-ring">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" stroke-width="3"/>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#8E1E1E" stroke-width="3"
                stroke-dasharray="88 100" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <span class="exec-impact-pct">88%</span>
    </div>
    <div class="exec-impact-value">6 mo</div>
    <div class="exec-impact-label">Time to Value</div>
  </div>
</div>`
  },
  {
    id: 'stat-progress',
    name: 'Executive Progress Tracker',
    category: WIDGET_CATEGORIES.STATISTICS,
    description: 'Premium progress metric with milestones',
    html: `<div class="exec-progress-card">
  <div class="exec-prog-header">
    <div class="exec-prog-info">
      <span class="exec-prog-title">Digital Transformation Roadmap</span>
      <span class="exec-prog-phase">Phase 2 of 4</span>
    </div>
    <div class="exec-prog-value">68%</div>
  </div>
  <div class="exec-prog-track">
    <div class="exec-prog-fill" style="width: 68%;"></div>
    <div class="exec-prog-milestone" style="left: 25%;">
      <div class="exec-mile-dot completed"></div>
      <span class="exec-mile-label">Discovery</span>
    </div>
    <div class="exec-prog-milestone" style="left: 50%;">
      <div class="exec-mile-dot completed"></div>
      <span class="exec-mile-label">Design</span>
    </div>
    <div class="exec-prog-milestone" style="left: 75%;">
      <div class="exec-mile-dot active"></div>
      <span class="exec-mile-label">Build</span>
    </div>
    <div class="exec-prog-milestone" style="left: 100%;">
      <div class="exec-mile-dot"></div>
      <span class="exec-mile-label">Deploy</span>
    </div>
  </div>
  <div class="exec-prog-footer">
    <span class="exec-prog-status on-track">On Track</span>
    <span class="exec-prog-eta">Expected completion: Q4 2024</span>
  </div>
</div>`
  },
  {
    id: 'stat-kpi-row',
    name: 'Executive KPI Strip',
    category: WIDGET_CATEGORIES.STATISTICS,
    description: 'Premium horizontal row of KPIs with visual trends',
    html: `<div class="exec-kpi-strip">
  <div class="exec-kpi-item">
    <div class="exec-kpi-icon revenue">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    </div>
    <div class="exec-kpi-data">
      <span class="exec-kpi-val">$8.4M</span>
      <span class="exec-kpi-lbl">Revenue</span>
    </div>
    <div class="exec-kpi-change positive">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
      +12%
    </div>
  </div>
  <div class="exec-kpi-divider"></div>
  <div class="exec-kpi-item">
    <div class="exec-kpi-icon growth">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg>
    </div>
    <div class="exec-kpi-data">
      <span class="exec-kpi-val">2,847</span>
      <span class="exec-kpi-lbl">Customers</span>
    </div>
    <div class="exec-kpi-change positive">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
      +28%
    </div>
  </div>
  <div class="exec-kpi-divider"></div>
  <div class="exec-kpi-item">
    <div class="exec-kpi-icon efficiency">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    </div>
    <div class="exec-kpi-data">
      <span class="exec-kpi-val">94.2%</span>
      <span class="exec-kpi-lbl">Efficiency</span>
    </div>
    <div class="exec-kpi-change positive">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
      +5.4%
    </div>
  </div>
</div>`
  },
  {
    id: 'stat-scorecard',
    name: 'Executive Scorecard',
    category: WIDGET_CATEGORIES.STATISTICS,
    description: 'Premium performance scorecard with status indicators',
    html: `<div class="exec-scorecard">
  <div class="exec-scorecard-header">
    <h3 class="exec-scorecard-title">Performance Scorecard</h3>
    <span class="exec-scorecard-period">Q4 2024</span>
  </div>
  <div class="exec-score-grid">
    <div class="exec-score-row">
      <div class="exec-score-info">
        <span class="exec-score-name">Revenue Growth</span>
        <span class="exec-score-target">Target: 15%</span>
      </div>
      <div class="exec-score-result">
        <span class="exec-score-value">18.2%</span>
        <div class="exec-score-status on-track">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        </div>
      </div>
    </div>
    <div class="exec-score-row">
      <div class="exec-score-info">
        <span class="exec-score-name">Customer Satisfaction</span>
        <span class="exec-score-target">Target: 90%</span>
      </div>
      <div class="exec-score-result">
        <span class="exec-score-value">87%</span>
        <div class="exec-score-status at-risk">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 15a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-1-2V9h2v6h-2z"/></svg>
        </div>
      </div>
    </div>
    <div class="exec-score-row">
      <div class="exec-score-info">
        <span class="exec-score-name">Market Share</span>
        <span class="exec-score-target">Target: 25%</span>
      </div>
      <div class="exec-score-result">
        <span class="exec-score-value">27.5%</span>
        <div class="exec-score-status on-track">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        </div>
      </div>
    </div>
    <div class="exec-score-row">
      <div class="exec-score-info">
        <span class="exec-score-name">Operating Margin</span>
        <span class="exec-score-target">Target: 20%</span>
      </div>
      <div class="exec-score-result">
        <span class="exec-score-value">14.8%</span>
        <div class="exec-score-status off-track">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        </div>
      </div>
    </div>
  </div>
</div>`
  },
  {
    id: 'stat-delta',
    name: 'Executive Delta Card',
    category: WIDGET_CATEGORIES.STATISTICS,
    description: 'Premium change visualization with context',
    html: `<div class="exec-delta-card">
  <div class="exec-delta-header">
    <span class="exec-delta-label">Revenue Impact</span>
    <div class="exec-delta-badge positive">Exceeding Target</div>
  </div>
  <div class="exec-delta-visual">
    <div class="exec-delta-from">
      <span class="exec-delta-val">$2.4M</span>
      <span class="exec-delta-period">FY 2023</span>
    </div>
    <div class="exec-delta-arrow">
      <svg width="40" height="24" viewBox="0 0 40 24">
        <defs>
          <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#94A3B8"/>
            <stop offset="100%" style="stop-color:#8E1E1E"/>
          </linearGradient>
        </defs>
        <path d="M2 12h30M28 6l6 6-6 6" stroke="url(#arrowGrad)" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
      <span class="exec-delta-pct">+38%</span>
    </div>
    <div class="exec-delta-to">
      <span class="exec-delta-val">$3.3M</span>
      <span class="exec-delta-period">FY 2024</span>
    </div>
  </div>
  <div class="exec-delta-context">
    <span>Driven by digital channel expansion and enterprise client acquisition</span>
  </div>
</div>`
  },

  // ============================================
  // LISTS (24-28) - Executive Design
  // ============================================
  {
    id: 'list-bullets',
    name: 'Executive Bullet List',
    category: WIDGET_CATEGORIES.LISTS,
    description: 'Premium bullet list with refined styling',
    html: `<ul class="exec-bullet-list">
  <li><strong>Strategic Alignment:</strong> Ensure all initiatives support the core business objectives and long-term vision</li>
  <li><strong>Resource Optimization:</strong> Maximize efficiency through targeted investment in high-impact areas</li>
  <li><strong>Risk Mitigation:</strong> Implement robust governance frameworks to protect against market volatility</li>
  <li><strong>Innovation Focus:</strong> Prioritize emerging technologies that drive competitive advantage</li>
</ul>`
  },
  {
    id: 'list-numbered',
    name: 'Executive Steps',
    category: WIDGET_CATEGORIES.LISTS,
    description: 'Premium numbered process with visual hierarchy',
    html: `<div class="exec-steps">
  <div class="exec-step">
    <div class="exec-step-num">01</div>
    <div class="exec-step-content">
      <h4 class="exec-step-title">Discovery & Assessment</h4>
      <p class="exec-step-desc">Comprehensive analysis of current state capabilities and market positioning</p>
    </div>
  </div>
  <div class="exec-step">
    <div class="exec-step-num">02</div>
    <div class="exec-step-content">
      <h4 class="exec-step-title">Strategy Development</h4>
      <p class="exec-step-desc">Define target state vision and create actionable transformation roadmap</p>
    </div>
  </div>
  <div class="exec-step">
    <div class="exec-step-num">03</div>
    <div class="exec-step-content">
      <h4 class="exec-step-title">Implementation & Execution</h4>
      <p class="exec-step-desc">Deploy solutions with agile methodology and continuous stakeholder engagement</p>
    </div>
  </div>
</div>`
  },
  {
    id: 'list-icons',
    name: 'Executive Feature List',
    category: WIDGET_CATEGORIES.LISTS,
    description: 'Premium list with status indicators',
    html: `<div class="exec-feature-list">
  <div class="exec-feat-item included">
    <div class="exec-feat-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
    </div>
    <div class="exec-feat-content">
      <span class="exec-feat-name">End-to-end digital transformation</span>
      <span class="exec-feat-detail">Full-stack capability building across technology, process, and people</span>
    </div>
  </div>
  <div class="exec-feat-item included">
    <div class="exec-feat-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
    </div>
    <div class="exec-feat-content">
      <span class="exec-feat-name">Executive coaching & change management</span>
      <span class="exec-feat-detail">Leadership alignment and organizational readiness programs</span>
    </div>
  </div>
  <div class="exec-feat-item included">
    <div class="exec-feat-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
    </div>
    <div class="exec-feat-content">
      <span class="exec-feat-name">24/7 operational support</span>
      <span class="exec-feat-detail">Dedicated team with guaranteed response SLAs</span>
    </div>
  </div>
  <div class="exec-feat-item excluded">
    <div class="exec-feat-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
    </div>
    <div class="exec-feat-content">
      <span class="exec-feat-name">Hardware procurement</span>
      <span class="exec-feat-detail">Client-managed infrastructure acquisition</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'list-checklist',
    name: 'Executive Checklist',
    category: WIDGET_CATEGORIES.LISTS,
    description: 'Premium task tracker with progress states',
    html: `<div class="exec-checklist">
  <div class="exec-checklist-header">
    <span class="exec-checklist-title">Implementation Checklist</span>
    <span class="exec-checklist-progress">3 of 5 complete</span>
  </div>
  <div class="exec-check-item completed">
    <div class="exec-check-box">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
    </div>
    <div class="exec-check-content">
      <span class="exec-check-task">Stakeholder alignment workshop</span>
      <span class="exec-check-meta">Completed Jan 15</span>
    </div>
  </div>
  <div class="exec-check-item completed">
    <div class="exec-check-box">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
    </div>
    <div class="exec-check-content">
      <span class="exec-check-task">Technical architecture review</span>
      <span class="exec-check-meta">Completed Jan 22</span>
    </div>
  </div>
  <div class="exec-check-item completed">
    <div class="exec-check-box">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
    </div>
    <div class="exec-check-content">
      <span class="exec-check-task">Resource planning finalized</span>
      <span class="exec-check-meta">Completed Jan 28</span>
    </div>
  </div>
  <div class="exec-check-item in-progress">
    <div class="exec-check-box"></div>
    <div class="exec-check-content">
      <span class="exec-check-task">Pilot program launch</span>
      <span class="exec-check-meta">In Progress • Due Feb 15</span>
    </div>
  </div>
  <div class="exec-check-item pending">
    <div class="exec-check-box"></div>
    <div class="exec-check-content">
      <span class="exec-check-task">Full rollout execution</span>
      <span class="exec-check-meta">Scheduled Mar 1</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'list-definition',
    name: 'Executive Glossary',
    category: WIDGET_CATEGORIES.LISTS,
    description: 'Premium term definitions with visual hierarchy',
    html: `<div class="exec-glossary">
  <div class="exec-def-item">
    <div class="exec-def-term">
      <span class="exec-term-text">Digital Transformation</span>
      <span class="exec-term-tag">Strategy</span>
    </div>
    <p class="exec-def-desc">The process of integrating digital technology into all areas of a business, fundamentally changing how you operate and deliver value to customers.</p>
  </div>
  <div class="exec-def-item">
    <div class="exec-def-term">
      <span class="exec-term-text">Operating Model</span>
      <span class="exec-term-tag">Operations</span>
    </div>
    <p class="exec-def-desc">The organizational design that enables strategy execution, encompassing people, process, technology, and governance dimensions.</p>
  </div>
  <div class="exec-def-item">
    <div class="exec-def-term">
      <span class="exec-term-text">Value Realization</span>
      <span class="exec-term-tag">Finance</span>
    </div>
    <p class="exec-def-desc">The measurable capture of benefits from strategic initiatives, tracked through defined KPIs and tied to business outcomes.</p>
  </div>
</div>`
  },

  // ============================================
  // INFOGRAPHICS (29-36) - Executive Design
  // ============================================
  {
    id: 'info-timeline',
    name: 'Executive Timeline',
    category: WIDGET_CATEGORIES.INFOGRAPHICS,
    description: 'Premium horizontal timeline with milestone details',
    html: `<div class="exec-timeline">
  <div class="exec-timeline-track"></div>
  <div class="exec-timeline-items">
    <div class="exec-timeline-item completed">
      <div class="exec-timeline-marker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      </div>
      <div class="exec-timeline-content">
        <span class="exec-timeline-date">Q1 2024</span>
        <span class="exec-timeline-title">Discovery</span>
        <span class="exec-timeline-desc">Assessment complete</span>
      </div>
    </div>
    <div class="exec-timeline-item completed">
      <div class="exec-timeline-marker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      </div>
      <div class="exec-timeline-content">
        <span class="exec-timeline-date">Q2 2024</span>
        <span class="exec-timeline-title">Design</span>
        <span class="exec-timeline-desc">Blueprint approved</span>
      </div>
    </div>
    <div class="exec-timeline-item current">
      <div class="exec-timeline-marker"></div>
      <div class="exec-timeline-content">
        <span class="exec-timeline-date">Q3 2024</span>
        <span class="exec-timeline-title">Build</span>
        <span class="exec-timeline-desc">Implementation active</span>
      </div>
    </div>
    <div class="exec-timeline-item upcoming">
      <div class="exec-timeline-marker"></div>
      <div class="exec-timeline-content">
        <span class="exec-timeline-date">Q4 2024</span>
        <span class="exec-timeline-title">Launch</span>
        <span class="exec-timeline-desc">Go-live planned</span>
      </div>
    </div>
  </div>
</div>`
  },
  {
    id: 'info-process',
    name: 'Executive Process Flow',
    category: WIDGET_CATEGORIES.INFOGRAPHICS,
    description: 'Premium horizontal process with connectors',
    html: `<div class="exec-process-flow">
  <div class="exec-process-step">
    <div class="exec-process-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
    </div>
    <div class="exec-process-label">Discover</div>
    <div class="exec-process-num">01</div>
  </div>
  <div class="exec-process-connector">
    <svg width="40" height="12" viewBox="0 0 40 12"><path d="M0 6h36M32 1l5 5-5 5" stroke="#8E1E1E" stroke-width="2" fill="none"/></svg>
  </div>
  <div class="exec-process-step">
    <div class="exec-process-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    </div>
    <div class="exec-process-label">Design</div>
    <div class="exec-process-num">02</div>
  </div>
  <div class="exec-process-connector">
    <svg width="40" height="12" viewBox="0 0 40 12"><path d="M0 6h36M32 1l5 5-5 5" stroke="#8E1E1E" stroke-width="2" fill="none"/></svg>
  </div>
  <div class="exec-process-step">
    <div class="exec-process-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
    </div>
    <div class="exec-process-label">Build</div>
    <div class="exec-process-num">03</div>
  </div>
  <div class="exec-process-connector">
    <svg width="40" height="12" viewBox="0 0 40 12"><path d="M0 6h36M32 1l5 5-5 5" stroke="#8E1E1E" stroke-width="2" fill="none"/></svg>
  </div>
  <div class="exec-process-step">
    <div class="exec-process-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
    </div>
    <div class="exec-process-label">Deliver</div>
    <div class="exec-process-num">04</div>
  </div>
</div>`
  },
  {
    id: 'info-funnel',
    name: 'Executive Funnel',
    category: WIDGET_CATEGORIES.INFOGRAPHICS,
    description: 'Premium conversion funnel with metrics',
    html: `<div class="exec-funnel">
  <div class="exec-funnel-header">
    <span class="exec-funnel-title">Sales Pipeline</span>
    <span class="exec-funnel-total">$4.2M Total Value</span>
  </div>
  <div class="exec-funnel-stages">
    <div class="exec-funnel-stage" style="--stage-width: 100%;">
      <div class="exec-funnel-bar">
        <span class="exec-funnel-label">Leads</span>
        <span class="exec-funnel-value">2,847</span>
      </div>
      <span class="exec-funnel-rate">100%</span>
    </div>
    <div class="exec-funnel-stage" style="--stage-width: 68%;">
      <div class="exec-funnel-bar">
        <span class="exec-funnel-label">Qualified</span>
        <span class="exec-funnel-value">1,936</span>
      </div>
      <span class="exec-funnel-rate">68%</span>
    </div>
    <div class="exec-funnel-stage" style="--stage-width: 42%;">
      <div class="exec-funnel-bar">
        <span class="exec-funnel-label">Proposals</span>
        <span class="exec-funnel-value">1,196</span>
      </div>
      <span class="exec-funnel-rate">42%</span>
    </div>
    <div class="exec-funnel-stage" style="--stage-width: 18%;">
      <div class="exec-funnel-bar">
        <span class="exec-funnel-label">Won</span>
        <span class="exec-funnel-value">512</span>
      </div>
      <span class="exec-funnel-rate">18%</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'info-pyramid',
    name: 'Executive Pyramid',
    category: WIDGET_CATEGORIES.INFOGRAPHICS,
    description: 'Premium hierarchy pyramid with details',
    html: `<div class="exec-pyramid">
  <div class="exec-pyramid-level level-1">
    <div class="exec-pyr-content">
      <span class="exec-pyr-title">Vision</span>
      <span class="exec-pyr-desc">Strategic direction</span>
    </div>
  </div>
  <div class="exec-pyramid-level level-2">
    <div class="exec-pyr-content">
      <span class="exec-pyr-title">Strategy</span>
      <span class="exec-pyr-desc">Competitive positioning & market approach</span>
    </div>
  </div>
  <div class="exec-pyramid-level level-3">
    <div class="exec-pyr-content">
      <span class="exec-pyr-title">Capabilities</span>
      <span class="exec-pyr-desc">People, processes, technology & data enablers</span>
    </div>
  </div>
  <div class="exec-pyramid-level level-4">
    <div class="exec-pyr-content">
      <span class="exec-pyr-title">Operations</span>
      <span class="exec-pyr-desc">Day-to-day execution, governance & performance management</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'info-matrix-2x2',
    name: 'Executive 2x2 Matrix',
    category: WIDGET_CATEGORIES.INFOGRAPHICS,
    description: 'Premium strategic quadrant matrix',
    html: `<div class="exec-matrix">
  <div class="exec-matrix-ylabel">
    <span>High Impact</span>
    <div class="exec-matrix-yline"></div>
    <span>Low Impact</span>
  </div>
  <div class="exec-matrix-grid">
    <div class="exec-matrix-quad q1">
      <span class="exec-quad-title">Quick Wins</span>
      <span class="exec-quad-desc">High impact, low effort</span>
      <span class="exec-quad-action">Prioritize</span>
    </div>
    <div class="exec-matrix-quad q2">
      <span class="exec-quad-title">Major Projects</span>
      <span class="exec-quad-desc">High impact, high effort</span>
      <span class="exec-quad-action">Plan carefully</span>
    </div>
    <div class="exec-matrix-quad q3">
      <span class="exec-quad-title">Fill-Ins</span>
      <span class="exec-quad-desc">Low impact, low effort</span>
      <span class="exec-quad-action">If time permits</span>
    </div>
    <div class="exec-matrix-quad q4">
      <span class="exec-quad-title">Reconsider</span>
      <span class="exec-quad-desc">Low impact, high effort</span>
      <span class="exec-quad-action">Deprioritize</span>
    </div>
  </div>
  <div class="exec-matrix-xlabel">
    <span>Low Effort</span>
    <div class="exec-matrix-xline"></div>
    <span>High Effort</span>
  </div>
</div>`
  },
  {
    id: 'info-cycle',
    name: 'Executive Cycle',
    category: WIDGET_CATEGORIES.INFOGRAPHICS,
    description: 'Premium circular process diagram',
    html: `<div class="exec-cycle">
  <div class="exec-cycle-center">
    <span class="exec-cycle-hub">Continuous Improvement</span>
  </div>
  <div class="exec-cycle-items">
    <div class="exec-cycle-item" style="--item-angle: 0deg;">
      <div class="exec-cycle-node">
        <span class="exec-cycle-num">1</span>
      </div>
      <div class="exec-cycle-label">
        <span class="exec-cycle-name">Plan</span>
        <span class="exec-cycle-desc">Define objectives</span>
      </div>
    </div>
    <div class="exec-cycle-item" style="--item-angle: 90deg;">
      <div class="exec-cycle-node">
        <span class="exec-cycle-num">2</span>
      </div>
      <div class="exec-cycle-label">
        <span class="exec-cycle-name">Execute</span>
        <span class="exec-cycle-desc">Implement changes</span>
      </div>
    </div>
    <div class="exec-cycle-item" style="--item-angle: 180deg;">
      <div class="exec-cycle-node">
        <span class="exec-cycle-num">3</span>
      </div>
      <div class="exec-cycle-label">
        <span class="exec-cycle-name">Measure</span>
        <span class="exec-cycle-desc">Track results</span>
      </div>
    </div>
    <div class="exec-cycle-item" style="--item-angle: 270deg;">
      <div class="exec-cycle-node">
        <span class="exec-cycle-num">4</span>
      </div>
      <div class="exec-cycle-label">
        <span class="exec-cycle-name">Optimize</span>
        <span class="exec-cycle-desc">Refine approach</span>
      </div>
    </div>
  </div>
</div>`
  },
  {
    id: 'info-comparison',
    name: 'Executive Comparison',
    category: WIDGET_CATEGORIES.INFOGRAPHICS,
    description: 'Premium side-by-side comparison',
    html: `<div class="exec-comparison">
  <div class="exec-compare-col standard">
    <div class="exec-compare-header">
      <span class="exec-compare-name">Current State</span>
    </div>
    <div class="exec-compare-items">
      <div class="exec-compare-row negative">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        <span>Manual processes</span>
      </div>
      <div class="exec-compare-row negative">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        <span>Siloed data</span>
      </div>
      <div class="exec-compare-row negative">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        <span>Slow time-to-market</span>
      </div>
      <div class="exec-compare-row negative">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        <span>Limited scalability</span>
      </div>
    </div>
  </div>
  <div class="exec-compare-col recommended">
    <div class="exec-compare-header">
      <span class="exec-compare-name">Future State</span>
      <span class="exec-compare-badge">Recommended</span>
    </div>
    <div class="exec-compare-items">
      <div class="exec-compare-row positive">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        <span>Automated workflows</span>
      </div>
      <div class="exec-compare-row positive">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        <span>Unified data platform</span>
      </div>
      <div class="exec-compare-row positive">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        <span>Agile delivery</span>
      </div>
      <div class="exec-compare-row positive">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        <span>Cloud-native architecture</span>
      </div>
    </div>
  </div>
</div>`
  },
  {
    id: 'info-venn',
    name: 'Executive Venn',
    category: WIDGET_CATEGORIES.INFOGRAPHICS,
    description: 'Premium overlapping concepts diagram',
    html: `<div class="exec-venn">
  <div class="exec-venn-circle left">
    <span class="exec-venn-title">Technology</span>
    <span class="exec-venn-items">Cloud, AI, Data</span>
  </div>
  <div class="exec-venn-circle right">
    <span class="exec-venn-title">Business</span>
    <span class="exec-venn-items">Strategy, Operations</span>
  </div>
  <div class="exec-venn-overlap">
    <span class="exec-venn-center-title">Digital Transformation</span>
    <span class="exec-venn-center-desc">Value Creation</span>
  </div>
</div>`
  },

  // ============================================
  // TEXT & CALLOUTS (37-42) - Executive Design
  // ============================================
  {
    id: 'text-blockquote',
    name: 'Executive Quote',
    category: WIDGET_CATEGORIES.TEXT,
    description: 'Premium styled quote block',
    html: `<div class="exec-quote-block">
  <div class="exec-quote-icon">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="#8E1E1E" opacity="0.2"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
  </div>
  <blockquote class="exec-quote-content">
    "Digital transformation is not about technology—it's about reimagining how your organization creates value in an increasingly connected world."
  </blockquote>
  <div class="exec-quote-attribution">
    <span class="exec-quote-author">Sarah Chen</span>
    <span class="exec-quote-role">Chief Digital Officer, Fortune 100</span>
  </div>
</div>`
  },
  {
    id: 'text-callout-tip',
    name: 'Executive Insight',
    category: WIDGET_CATEGORIES.TEXT,
    description: 'Premium insight callout',
    html: `<div class="exec-callout insight">
  <div class="exec-callout-icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
  </div>
  <div class="exec-callout-content">
    <span class="exec-callout-title">Key Insight</span>
    <p class="exec-callout-text">Organizations that invest in digital capabilities early achieve 2.5x higher revenue growth than industry peers who delay transformation initiatives.</p>
  </div>
</div>`
  },
  {
    id: 'text-callout-warning',
    name: 'Executive Warning',
    category: WIDGET_CATEGORIES.TEXT,
    description: 'Premium warning callout',
    html: `<div class="exec-callout warning">
  <div class="exec-callout-icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 15a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-1-2V9h2v6h-2z"/></svg>
  </div>
  <div class="exec-callout-content">
    <span class="exec-callout-title">Risk Alert</span>
    <p class="exec-callout-text">Delayed action on legacy system modernization increases technical debt by an estimated 15% annually and heightens security vulnerability exposure.</p>
  </div>
</div>`
  },
  {
    id: 'text-callout-success',
    name: 'Executive Success',
    category: WIDGET_CATEGORIES.TEXT,
    description: 'Premium success callout',
    html: `<div class="exec-callout success">
  <div class="exec-callout-icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
  </div>
  <div class="exec-callout-content">
    <span class="exec-callout-title">Achievement Unlocked</span>
    <p class="exec-callout-text">Phase 1 implementation completed ahead of schedule, delivering $2.3M in operational savings and 40% reduction in processing time.</p>
  </div>
</div>`
  },
  {
    id: 'text-key-takeaway',
    name: 'Executive Takeaway',
    category: WIDGET_CATEGORIES.TEXT,
    description: 'Premium key takeaway box',
    html: `<div class="exec-takeaway">
  <div class="exec-takeaway-header">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    <span>Key Takeaway</span>
  </div>
  <p class="exec-takeaway-content">Successful digital transformation requires a balanced approach across technology, people, and process dimensions—organizations that focus solely on technology achieve only 30% of potential value.</p>
  <div class="exec-takeaway-footer">
    <span class="exec-takeaway-source">Source: Strategy& Digital Transformation Study, 2024</span>
  </div>
</div>`
  },
  {
    id: 'text-divider',
    name: 'Executive Divider',
    category: WIDGET_CATEGORIES.TEXT,
    description: 'Premium section divider',
    html: `<div class="exec-divider">
  <div class="exec-divider-line"></div>
  <div class="exec-divider-content">
    <span class="exec-divider-label">Strategic Recommendations</span>
  </div>
  <div class="exec-divider-line"></div>
</div>`
  },

  // ============================================
  // TABLES (43-45) - Executive Design
  // ============================================
  {
    id: 'table-basic',
    name: 'Executive Data Table',
    category: WIDGET_CATEGORIES.TABLES,
    description: 'Premium data table with refined styling',
    html: `<div class="exec-table-container">
  <table class="exec-table">
    <thead>
      <tr>
        <th>Business Unit</th>
        <th>Revenue</th>
        <th>Growth</th>
        <th>Margin</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="exec-cell-label">Digital Services</td>
        <td class="exec-cell-value">$12.4M</td>
        <td class="exec-cell-trend positive">+18%</td>
        <td class="exec-cell-value">32%</td>
      </tr>
      <tr>
        <td class="exec-cell-label">Advisory</td>
        <td class="exec-cell-value">$8.7M</td>
        <td class="exec-cell-trend positive">+12%</td>
        <td class="exec-cell-value">45%</td>
      </tr>
      <tr>
        <td class="exec-cell-label">Operations</td>
        <td class="exec-cell-value">$6.2M</td>
        <td class="exec-cell-trend negative">-3%</td>
        <td class="exec-cell-value">28%</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td class="exec-cell-label">Total</td>
        <td class="exec-cell-value exec-total">$27.3M</td>
        <td class="exec-cell-trend positive">+11%</td>
        <td class="exec-cell-value exec-total">35%</td>
      </tr>
    </tfoot>
  </table>
</div>`
  },
  {
    id: 'table-comparison',
    name: 'Executive Comparison Table',
    category: WIDGET_CATEGORIES.TABLES,
    description: 'Premium feature comparison matrix',
    html: `<div class="exec-compare-table">
  <table class="exec-table comparison">
    <thead>
      <tr>
        <th class="exec-feature-col">Capability</th>
        <th>Basic</th>
        <th class="exec-recommended">Enterprise</th>
        <th>Premium</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="exec-cell-label">Cloud Infrastructure</td>
        <td class="exec-cell-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></td>
        <td class="exec-cell-check exec-recommended"><svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></td>
        <td class="exec-cell-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></td>
      </tr>
      <tr>
        <td class="exec-cell-label">AI/ML Capabilities</td>
        <td class="exec-cell-x"><svg width="16" height="16" viewBox="0 0 24 24" fill="#DC2626"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg></td>
        <td class="exec-cell-check exec-recommended"><svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></td>
        <td class="exec-cell-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></td>
      </tr>
      <tr>
        <td class="exec-cell-label">24/7 Support</td>
        <td class="exec-cell-x"><svg width="16" height="16" viewBox="0 0 24 24" fill="#DC2626"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg></td>
        <td class="exec-cell-check exec-recommended"><svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></td>
        <td class="exec-cell-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></td>
      </tr>
      <tr>
        <td class="exec-cell-label">Custom Integrations</td>
        <td class="exec-cell-x"><svg width="16" height="16" viewBox="0 0 24 24" fill="#DC2626"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg></td>
        <td class="exec-cell-x exec-recommended"><svg width="16" height="16" viewBox="0 0 24 24" fill="#DC2626"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg></td>
        <td class="exec-cell-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></td>
      </tr>
    </tbody>
  </table>
</div>`
  },
  {
    id: 'table-striped',
    name: 'Executive Team Table',
    category: WIDGET_CATEGORIES.TABLES,
    description: 'Premium team/status table',
    html: `<div class="exec-table-container">
  <table class="exec-table striped">
    <thead>
      <tr>
        <th>Workstream</th>
        <th>Lead</th>
        <th>Timeline</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="exec-cell-label">Digital Platform</td>
        <td class="exec-cell-person">
          <span class="exec-avatar">JD</span>
          <span>John Davidson</span>
        </td>
        <td class="exec-cell-value">Q1-Q2 2024</td>
        <td><span class="exec-status on-track">On Track</span></td>
      </tr>
      <tr>
        <td class="exec-cell-label">Data Migration</td>
        <td class="exec-cell-person">
          <span class="exec-avatar">SC</span>
          <span>Sarah Chen</span>
        </td>
        <td class="exec-cell-value">Q2 2024</td>
        <td><span class="exec-status at-risk">At Risk</span></td>
      </tr>
      <tr>
        <td class="exec-cell-label">Change Management</td>
        <td class="exec-cell-person">
          <span class="exec-avatar">MK</span>
          <span>Michael Kim</span>
        </td>
        <td class="exec-cell-value">Q1-Q3 2024</td>
        <td><span class="exec-status on-track">On Track</span></td>
      </tr>
      <tr>
        <td class="exec-cell-label">Security Hardening</td>
        <td class="exec-cell-person">
          <span class="exec-avatar">AR</span>
          <span>Anna Rodriguez</span>
        </td>
        <td class="exec-cell-value">Q2-Q3 2024</td>
        <td><span class="exec-status complete">Complete</span></td>
      </tr>
    </tbody>
  </table>
</div>`
  },

  // ============================================
  // LAYOUTS (46-50) - Executive Design
  // ============================================
  {
    id: 'layout-two-col',
    name: 'Executive Two Column',
    category: WIDGET_CATEGORIES.LAYOUTS,
    description: 'Premium two-column layout',
    html: `<div class="exec-two-col">
  <div class="exec-col-card">
    <div class="exec-col-header">
      <div class="exec-col-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      <h3 class="exec-col-title">Current Capabilities</h3>
    </div>
    <p class="exec-col-text">Assessment of existing technology stack, organizational competencies, and operational processes that form the foundation for transformation.</p>
    <ul class="exec-col-list">
      <li>Legacy system inventory</li>
      <li>Skill gap analysis</li>
      <li>Process maturity assessment</li>
    </ul>
  </div>
  <div class="exec-col-card">
    <div class="exec-col-header">
      <div class="exec-col-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <h3 class="exec-col-title">Future State Vision</h3>
    </div>
    <p class="exec-col-text">Target operating model that leverages modern technologies and optimized processes to achieve strategic business objectives.</p>
    <ul class="exec-col-list">
      <li>Cloud-native architecture</li>
      <li>AI-enabled operations</li>
      <li>Agile delivery model</li>
    </ul>
  </div>
</div>`
  },
  {
    id: 'layout-three-col',
    name: 'Executive Three Pillars',
    category: WIDGET_CATEGORIES.LAYOUTS,
    description: 'Premium three-pillar layout',
    html: `<div class="exec-three-pillars">
  <div class="exec-pillar">
    <div class="exec-pillar-num">01</div>
    <div class="exec-pillar-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
    </div>
    <h3 class="exec-pillar-title">People</h3>
    <p class="exec-pillar-desc">Build digital fluency across the organization through targeted upskilling and change management programs.</p>
    <div class="exec-pillar-metric">
      <span class="exec-pillar-val">2,500+</span>
      <span class="exec-pillar-lbl">Employees trained</span>
    </div>
  </div>
  <div class="exec-pillar featured">
    <div class="exec-pillar-num">02</div>
    <div class="exec-pillar-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    </div>
    <h3 class="exec-pillar-title">Process</h3>
    <p class="exec-pillar-desc">Redesign core business processes to eliminate waste and enable automation at scale.</p>
    <div class="exec-pillar-metric">
      <span class="exec-pillar-val">40%</span>
      <span class="exec-pillar-lbl">Efficiency gain</span>
    </div>
  </div>
  <div class="exec-pillar">
    <div class="exec-pillar-num">03</div>
    <div class="exec-pillar-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    </div>
    <h3 class="exec-pillar-title">Technology</h3>
    <p class="exec-pillar-desc">Modernize infrastructure with cloud-first approach and API-driven architecture.</p>
    <div class="exec-pillar-metric">
      <span class="exec-pillar-val">85%</span>
      <span class="exec-pillar-lbl">Cloud adoption</span>
    </div>
  </div>
</div>`
  },
  {
    id: 'layout-sidebar',
    name: 'Executive Sidebar Layout',
    category: WIDGET_CATEGORIES.LAYOUTS,
    description: 'Premium content with key facts sidebar',
    html: `<div class="exec-sidebar-layout">
  <div class="exec-sidebar">
    <div class="exec-sidebar-header">Quick Facts</div>
    <div class="exec-sidebar-items">
      <div class="exec-sidebar-item">
        <span class="exec-sidebar-val">$4.2B</span>
        <span class="exec-sidebar-lbl">Market Size</span>
      </div>
      <div class="exec-sidebar-item">
        <span class="exec-sidebar-val">18%</span>
        <span class="exec-sidebar-lbl">CAGR Growth</span>
      </div>
      <div class="exec-sidebar-item">
        <span class="exec-sidebar-val">2026</span>
        <span class="exec-sidebar-lbl">Target Year</span>
      </div>
    </div>
  </div>
  <div class="exec-main-content">
    <h3 class="exec-main-title">Market Opportunity Analysis</h3>
    <p class="exec-main-text">The digital transformation market continues to expand rapidly as organizations accelerate their modernization initiatives. Key drivers include increasing customer expectations, competitive pressure, and the need for operational resilience.</p>
    <ul class="exec-main-list">
      <li><strong>Cloud Services:</strong> Fastest growing segment at 24% CAGR</li>
      <li><strong>AI/ML:</strong> Enterprise adoption expected to triple by 2026</li>
      <li><strong>Data Analytics:</strong> Critical enabler for decision intelligence</li>
    </ul>
  </div>
</div>`
  },
  {
    id: 'layout-card-grid',
    name: 'Executive Card Grid',
    category: WIDGET_CATEGORIES.LAYOUTS,
    description: 'Premium 4-card capability grid',
    html: `<div class="exec-card-grid">
  <div class="exec-grid-card">
    <div class="exec-grid-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
    </div>
    <h4 class="exec-grid-title">Cloud Platform</h4>
    <p class="exec-grid-desc">Scalable infrastructure for enterprise workloads</p>
    <span class="exec-grid-tag">Infrastructure</span>
  </div>
  <div class="exec-grid-card">
    <div class="exec-grid-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1010 10H12V2zM21.18 8.02A10 10 0 0012 2v10h10a10 10 0 00-.82-3.98z"/></svg>
    </div>
    <h4 class="exec-grid-title">Analytics</h4>
    <p class="exec-grid-desc">Data-driven insights for decision making</p>
    <span class="exec-grid-tag">Intelligence</span>
  </div>
  <div class="exec-grid-card">
    <div class="exec-grid-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    </div>
    <h4 class="exec-grid-title">Security</h4>
    <p class="exec-grid-desc">Enterprise-grade protection and compliance</p>
    <span class="exec-grid-tag">Trust</span>
  </div>
  <div class="exec-grid-card">
    <div class="exec-grid-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    </div>
    <h4 class="exec-grid-title">Automation</h4>
    <p class="exec-grid-desc">Intelligent workflows and process optimization</p>
    <span class="exec-grid-tag">Efficiency</span>
  </div>
</div>`
  },
  {
    id: 'layout-hero',
    name: 'Executive Hero',
    category: WIDGET_CATEGORIES.LAYOUTS,
    description: 'Premium hero/banner section',
    html: `<div class="exec-hero">
  <div class="exec-hero-content">
    <span class="exec-hero-eyebrow">Strategic Initiative</span>
    <h2 class="exec-hero-headline">Accelerating Digital Transformation</h2>
    <p class="exec-hero-subtext">Enabling sustainable competitive advantage through technology-driven innovation and operational excellence.</p>
    <div class="exec-hero-stats">
      <div class="exec-hero-stat">
        <span class="exec-hero-stat-val">$12M</span>
        <span class="exec-hero-stat-lbl">Expected Value</span>
      </div>
      <div class="exec-hero-stat">
        <span class="exec-hero-stat-val">18 mo</span>
        <span class="exec-hero-stat-lbl">Timeline</span>
      </div>
      <div class="exec-hero-stat">
        <span class="exec-hero-stat-val">3.2x</span>
        <span class="exec-hero-stat-lbl">ROI Target</span>
      </div>
    </div>
  </div>
</div>`
  }
];

/**
 * Get widgets by category
 */
export function getWidgetsByCategory(category) {
  return slideWidgets.filter(w => w.category === category);
}

/**
 * Get widget by ID
 */
export function getWidgetById(id) {
  return slideWidgets.find(w => w.id === id);
}

/**
 * Get all widget names for AI reference
 */
export function getWidgetSummary() {
  return slideWidgets.map(w => ({
    id: w.id,
    name: w.name,
    category: w.category,
    description: w.description
  }));
}

/**
 * Format widgets for AI prompt inclusion - compact summary
 */
export function formatWidgetsForPrompt() {
  const byCategory = {};
  slideWidgets.forEach(w => {
    if (!byCategory[w.category]) byCategory[w.category] = [];
    byCategory[w.category].push(`${w.id}: ${w.description}`);
  });

  return `AVAILABLE WIDGETS (use inside .frame):
${Object.entries(byCategory).map(([cat, widgets]) =>
  `\n${cat.toUpperCase()}:\n${widgets.map(w => `  - ${w}`).join('\n')}`
).join('')}`;
}

/**
 * Get full HTML for specific widgets
 */
export function getWidgetHtml(widgetIds) {
  return widgetIds.map(id => {
    const widget = getWidgetById(id);
    if (!widget) return null;
    return `<!-- Widget: ${widget.name} (${widget.id}) -->\n${widget.html}`;
  }).filter(Boolean).join('\n\n');
}

export default slideWidgets;
