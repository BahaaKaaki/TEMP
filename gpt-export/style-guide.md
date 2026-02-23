# Slide HTML Style Guide

Reference for writing slide HTML using the styles.css stylesheet.
**Do not invent CSS classes** — only use the ones documented here.

---

## Slide Dimensions & Typography

- Slide: **960px × 540px** (16:9 aspect ratio)
- Title font: **Georgia, serif** — `28px`, `#111111`
- Subtitle font: **Arial, sans-serif** — `18px`, `#A32020`
- Body font: **Arial, sans-serif** — `12-14px`, `#222222`
- Meta/footer: **Arial** — `10px`, `#4A4F57`

## Colour Palette

| Token     | Hex       | Usage                          |
|-----------|-----------|--------------------------------|
| Text      | `#111111` | Headings, primary text         |
| Body      | `#222222` | Body paragraphs                |
| Accent    | `#A32020` | Subtitles, highlighted labels  |
| Maroon    | `#8E1E1E` | Accent bars, icon circles      |
| Card BG   | `#F7F9FB` | Card/cell backgrounds          |
| Rose      | `#F8E3E3` | Impact boxes, soft highlights  |
| Meta      | `#4A4F57` | Footer text, dates, labels     |
| Green     | `#2E7D32` | score-high, strengths, pros    |
| Red       | `#C62828` | score-low, weaknesses, cons    |
| Amber     | `#F57F17` | score-med, warnings            |
| Blue      | `#1565C0` | opportunities, info badges     |
| Orange    | `#E65100` | threats                        |

---

## Master Wrappers

Every slide uses one of these outer structures:

### Standard (most slides)
```html
<div class="slide master-standard">
  <h1 class="title">[Title]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <!-- content goes here -->
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>[Page] / [Total]</span>
  </footer>
</div>
```

### Cover (opening/closing slides)
```html
<div class="slide cover-slide master-cover">
  <div class="frame">
    <div class="cover-category">[CATEGORY]</div>
    <div class="cover-title">[Presentation Title]</div>
  </div>
  <div class="cover-branding">[Company]</div>
  <div class="cover-date">[Date]</div>
</div>
```

### Blank (section dividers, full-bleed)
```html
<div class="slide master-blank section-divider-slide">
  <div class="section-divider-content">
    <div class="section-divider-accent"></div>
    <div class="section-divider-main">
      <div class="section-divider-number">[01]</div>
      <div class="section-divider-title">[Section Title]</div>
      <div class="section-divider-subtitle">[Description]</div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>[Page] / [Total]</span>
  </footer>
</div>
```

### Deck wrapper (for multi-slide files)
```html
<div class="deck">
  <!-- all slides go here -->
</div>
```

---

## Template Patterns

Below are the HTML patterns for every layout type. Use these exactly — the CSS handles all styling, spacing, and responsive layout.

### 1. Cards (2, 3, or 4 columns)

Use for: frameworks, pillars, phases, option comparisons.
Item count: 2–4 cards (adjust by adding/removing `.card` divs).

```html
<div class="card-row">
  <div class="card">
    <div class="card-header-row">
      <div class="card-icon-circle">[Icon]</div>
      <div class="card-num">01</div>
    </div>
    <h3>[Card Title]</h3>
    <p>[Description]</p>
    <p style="margin-top:10pt">[Supporting detail]</p>
    <div class="impact-box">[Metric or highlight]</div>
  </div>
  <!-- repeat for each card -->
</div>
```

### 2. Bullet Points (numbered key points)

Use for: recommendations, findings, action items.
Item count: 4–7 points.

```html
<div class="key-points">
  <div class="key-point">
    <div class="key-point-number">1</div>
    <div class="key-point-content">
      <h4>[Point title]</h4>
      <p>[Description]</p>
    </div>
  </div>
  <!-- repeat for each point -->
</div>
```

### 3. Executive Summary (grid of themed cells)

Use for: deck overview, key findings summary.
Item count: 2–6 cells (auto-arranges in 2- or 3-column grid).

```html
<div class="exec-summary-grid">
  <div class="exec-summary-cell">
    <h4>[Theme title]</h4>
    <p>[Key insight]</p>
    <p>[Supporting detail]</p>
  </div>
  <!-- repeat for each cell -->
</div>
```

### 4. Grid (2×2 quadrants)

Use for: capability matrices, frameworks, categorizations.
Item count: 4 cells (always 2×2).

```html
<div class="grid-2x2">
  <div class="grid-cell">
    <h4>[Quadrant Title]</h4>
    <p>[Description]</p>
  </div>
  <!-- 4 cells total -->
</div>
```

**Variation — numbered rows:**
```html
<div class="grid-rows">
  <div class="grid-row-item">
    <div class="grid-row-num">01</div>
    <div class="grid-row-body">
      <h4>[Title]</h4>
      <p>[Description]</p>
    </div>
  </div>
  <!-- repeat -->
</div>
```

### 5. Comparison Table

Use for: vendor comparisons, feature matrices, scoring.
Score classes: `score-high` (green), `score-med` (amber), `score-low` (red).

```html
<table class="comparison-table">
  <thead>
    <tr>
      <th>[Criteria]</th>
      <th>[Option A]</th>
      <th>[Option B]</th>
      <th>[Option C]</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>[Criterion name]</td>
      <td class="score-high">[Score]</td>
      <td class="score-med">[Score]</td>
      <td class="score-low">[Score]</td>
    </tr>
    <!-- repeat rows -->
  </tbody>
</table>
```

### 6. Pros & Cons (two-column)

Use for: trade-off analysis, option evaluation.
Also works for: current/future state (swap classes), before/after.

```html
<div class="pros-cons-container">
  <div class="pros-column">
    <div class="pc-header pros-header">
      <span class="pc-icon">[Icon]</span>
      <h3>[Pros Title]</h3>
    </div>
    <div class="pc-list">
      <div class="pc-item pro-item">
        <span class="pc-bullet">+</span>
        <div>
          <strong>[Pro Title]</strong>
          <p>[Description]</p>
        </div>
      </div>
      <!-- repeat items -->
    </div>
  </div>
  <div class="cons-column">
    <div class="pc-header cons-header">
      <span class="pc-icon">[Icon]</span>
      <h3>[Cons Title]</h3>
    </div>
    <div class="pc-list">
      <div class="pc-item con-item">
        <span class="pc-bullet">−</span>
        <div>
          <strong>[Con Title]</strong>
          <p>[Description]</p>
        </div>
      </div>
      <!-- repeat items -->
    </div>
  </div>
</div>
```

**Current → Future variation** (adds arrow between columns):
```html
<div class="pros-cons-container">
  <div class="current-state-col">
    <div class="pc-header"><h3>Current State</h3></div>
    <div class="pc-list">
      <div class="pc-item"><span class="pc-bullet">•</span><div><strong>[Title]</strong><p>[Detail]</p></div></div>
    </div>
  </div>
  <div class="state-arrow">→</div>
  <div class="future-state-col">
    <div class="pc-header"><h3>Future State</h3></div>
    <div class="pc-list">
      <div class="pc-item"><span class="pc-bullet">•</span><div><strong>[Title]</strong><p>[Detail]</p></div></div>
    </div>
  </div>
</div>
```

### 7. SWOT Analysis

Use for: strategic assessments, competitive analysis.
Fixed 2×2 grid with colour-coded quadrants.

```html
<div class="swot-grid">
  <div class="swot-cell swot-strength">
    <div class="swot-header">
      <span class="swot-icon">[S Icon]</span>
      <h4>Strengths</h4>
    </div>
    <ul>
      <li>[Strength 1]</li>
      <li>[Strength 2]</li>
      <li>[Strength 3]</li>
    </ul>
  </div>
  <div class="swot-cell swot-weakness">
    <div class="swot-header"><span class="swot-icon">[W Icon]</span><h4>Weaknesses</h4></div>
    <ul><li>[Weakness 1]</li><li>[Weakness 2]</li><li>[Weakness 3]</li></ul>
  </div>
  <div class="swot-cell swot-opportunity">
    <div class="swot-header"><span class="swot-icon">[O Icon]</span><h4>Opportunities</h4></div>
    <ul><li>[Opportunity 1]</li><li>[Opportunity 2]</li><li>[Opportunity 3]</li></ul>
  </div>
  <div class="swot-cell swot-threat">
    <div class="swot-header"><span class="swot-icon">[T Icon]</span><h4>Threats</h4></div>
    <ul><li>[Threat 1]</li><li>[Threat 2]</li><li>[Threat 3]</li></ul>
  </div>
</div>
```

### 8. KPI Metrics (two-column)

Use for: results, dashboards, ROI.
Left: large numbers. Right: detail text.

```html
<div class="two-col">
  <div class="col-left">
    <div class="kpi-block">
      <div class="kpi-value">[Value]</div>
      <div class="kpi-label">[Label]</div>
    </div>
    <!-- repeat kpi-blocks -->
  </div>
  <div class="col-right">
    <div class="detail-item">
      <h4>[Detail heading]</h4>
      <p>[Explanation]</p>
    </div>
    <!-- repeat detail-items -->
  </div>
</div>
```

### 9. Timeline (vertical)

Use for: project phases, milestones, history.
Item count: 2–4 events.

```html
<div class="timeline-container">
  <div class="timeline-row">
    <div class="timeline-marker">[Date/Phase]</div>
    <div class="timeline-content">
      <h4>[Event Title]</h4>
      <p>[Description]</p>
    </div>
  </div>
  <!-- repeat rows -->
</div>
```

### 10. Process Flow (horizontal steps)

Use for: methodologies, workflows, journeys.
Item count: 3–5 steps.

```html
<div class="process-flow">
  <div class="process-step">
    <div class="step-number">1</div>
    <div class="step-content">
      <h4>[Step Title]</h4>
      <p>[Description]</p>
    </div>
  </div>
  <div class="process-arrow">→</div>
  <!-- repeat step + arrow pairs -->
</div>
```

### 11. Big Number

Use for: hero stats, key metrics, impact numbers.

```html
<div class="big-number-container">
  <div class="big-number-prefix">[Prefix]</div>
  <div class="big-number-value">[42]</div>
  <div class="big-number-suffix">[%]</div>
  <div class="big-number-label">[What the number means]</div>
  <div class="big-number-context">[Additional context]</div>
</div>
```

### 12. Quote

Use for: executive quotes, testimonials, key statements.

```html
<div class="quote-box">
  <p class="quote-text">"[Quote text]"</p>
  <p class="quote-author">— [Author], [Title]</p>
</div>
```

### 13. Thank You (closing)

Uses the cover master, not the standard master.

```html
<div class="slide cover-slide thank-you-slide master-cover">
  <div class="frame">
    <div class="thank-you-icon">[Icon]</div>
    <div class="thank-you-title">[Thank You Message]</div>
    <div class="thank-you-subtitle">[Subtitle]</div>
    <div class="contact-info">
      <div class="contact-item">
        <span class="contact-icon">[Email Icon]</span>
        <span>[email@company.com]</span>
      </div>
      <div class="contact-item">
        <span class="contact-icon">[Web Icon]</span>
        <span>[www.company.com]</span>
      </div>
      <div class="contact-item">
        <span class="contact-icon">[Phone Icon]</span>
        <span>[+1 (555) 000-0000]</span>
      </div>
    </div>
  </div>
  <div class="cover-branding">[Company]</div>
  <div class="cover-date">[Date]</div>
</div>
```

### 14. Strategy Quadrant (2×2 matrix with center)

Use for: BCG matrix, balanced scorecards, positioning maps.

```html
<div class="quadrant-container">
  <div class="quadrant q1">
    <h4>[Quadrant 1]</h4>
    <p>[Description]</p>
  </div>
  <div class="quadrant q2">
    <h4>[Quadrant 2]</h4>
    <p>[Description]</p>
  </div>
  <div class="quadrant q3">
    <h4>[Quadrant 3]</h4>
    <p>[Description]</p>
  </div>
  <div class="quadrant q4">
    <h4>[Quadrant 4]</h4>
    <p>[Description]</p>
  </div>
  <div class="quadrant-center"><span>[Core Focus]</span></div>
  <span class="quadrant-axis top">[Y-Axis High]</span>
  <span class="quadrant-axis bottom">[Y-Axis Low]</span>
</div>
```

### 15. Funnel

Use for: sales funnels, conversion pipelines, filtering processes.
Item count: 4–6 stages, widest at top.

```html
<div class="funnel-container">
  <div class="funnel-stage">
    <div class="funnel-bar" style="width: 100%">
      <span class="funnel-label">[Stage 1]</span>
      <span class="funnel-value">[Value]</span>
    </div>
    <div class="funnel-detail">[Detail]</div>
  </div>
  <div class="funnel-stage">
    <div class="funnel-bar" style="width: 80%">
      <span class="funnel-label">[Stage 2]</span>
      <span class="funnel-value">[Value]</span>
    </div>
    <div class="funnel-detail">[Detail]</div>
  </div>
  <!-- repeat with decreasing widths: 60%, 40%, 25% -->
</div>
```

### 16. Chevron Flow

Use for: phased approaches, programme stages.
Item count: 3–5 phases.

```html
<div class="chevron-flow">
  <div class="chevron-phase">
    <div class="chevron-header">[Phase Name]</div>
    <div class="chevron-body">
      <ul>
        <li>[Activity 1]</li>
        <li>[Activity 2]</li>
      </ul>
    </div>
  </div>
  <!-- repeat phases -->
</div>
```

### 17. Qualification / Case Study (3-column)

Use for: credentials, case studies, engagement summaries.

```html
<div class="qual-container">
  <div class="qual-column">
    <div class="qual-header situation">Situation</div>
    <div class="qual-body"><p>[Context]</p></div>
  </div>
  <div class="qual-column">
    <div class="qual-header approach">How We Helped</div>
    <div class="qual-body"><p>[Approach]</p></div>
  </div>
  <div class="qual-column">
    <div class="qual-header impact">Impact</div>
    <div class="qual-body"><p>[Results]</p></div>
  </div>
</div>
```

---

## Content Density Guidelines

| Template          | Item Count | Per Item                                      |
|-------------------|-----------|-----------------------------------------------|
| Cards (3-col)     | 2–4       | Title (4 words), body (2 lines), 1 metric     |
| Bullet Points     | 4–7       | Title (4-5 words) + desc (8-10 words)         |
| Exec Summary      | 2–6       | Title (3-4 words) + 1-2 short paragraphs      |
| Grid 2×2          | 4         | Heading (3-4 words) + desc (15-20 words)      |
| Comparison Table   | 3-4 cols  | 4-6 rows, cell text 1-3 words                 |
| Pros & Cons       | 2 cols    | 4-6 bullets per column, 8 words per bullet    |
| SWOT              | 4 quads   | 3-5 bullets per quadrant, 6 words each        |
| KPI Metrics       | 3 KPIs    | Value + label + 3 detail items                |
| Timeline          | 2–4       | Date + title (3-4 words) + desc (12 words)    |
| Process Flow      | 3–5       | Number + title (3 words) + desc (8 words)     |
| Big Number        | 1         | Number + label + 1-line context               |
| Quote             | 1         | Quote (2-3 sentences) + author                |
| Funnel            | 4–6       | Stage name + metric + 1 detail line           |
| Chevron Flow      | 3–5       | Phase title (3 words) + 2-3 bullet items      |

---

## PptxGenJS Rendering Patterns

For EVERY slide you create, you must also write a matching PptxGenJS rendering function. This goes inside the `downloadPPTX()` function in the final HTML. Use these patterns — they match the HTML templates above.

### PPTX Constants

```javascript
// Slide: 13.333" × 7.5" (widescreen)
// Colours
var c = {main:'111111', secondary:'222222', red:'A32020', maroon:'8E1E1E',
         zone1:'F7F9FB', rose:'F8E3E3', meta:'4A4F57', coal:'4B4F55',
         border:'E6E9EE', green:'2E7D32', redNeg:'C62828', amber:'F57F17',
         blue:'1565C0', orange:'E65100'};
// Layout positions
var startX = 0.48;                         // left margin
var titleY = 0.42, subtitleY = 1.40;       // title/subtitle
var frameY = 1.90, frameW = 12.36, frameH = 4.90; // content area
var footerY = 7.05;                        // footer
```

### Standard header + footer (use on every standard slide)

```javascript
slide.addText("Title", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
slide.addText("Subtitle", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
// ... content ...
slide.addText('Company', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
```

### Cover

```javascript
var slide = pptx.addSlide();
slide.addText("CATEGORY", {x:0.48, y:1.94, w:10, h:0.35, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
slide.addText("Presentation Title", {x:0.48, y:2.5, w:9.7, h:1.2, fontFace:'Georgia', fontSize:42, color:c.main, valign:'top'});
slide.addText("Company", {x:0.48, y:6.3, w:3, h:0.3, fontFace:'Arial', fontSize:16, color:c.meta, bold:true});
slide.addText("Date", {x:10.5, y:6.3, w:2.4, h:0.3, fontFace:'Arial', fontSize:13, color:c.meta, align:'right'});
```

### Section Divider

```javascript
var slide = pptx.addSlide();
slide.addShape('rect', {x:0, y:0, w:0.4, h:7.5, fill:{color:c.maroon}});
slide.addText("01", {x:0.8, y:1.8, w:3, h:1.5, fontFace:'Georgia', fontSize:96, color:'E8E8E8', bold:true});
slide.addText("Section Title", {x:0.8, y:3.0, w:11, h:1.0, fontFace:'Georgia', fontSize:44, color:c.main, bold:true});
slide.addText("Description", {x:0.8, y:4.1, w:10, h:0.6, fontFace:'Arial', fontSize:18, color:c.meta});
```

### Cards (N columns)

```javascript
var items = [
  {icon:'🎯', num:'01', title:'Card Title', body:'Description text', impact:'Key metric'}
  // ... repeat
];
var cardW = (12.36 - 0.25 * (items.length - 1)) / items.length, cardH = 4.90, cardY = 1.90;
items.forEach(function(d, i) {
  var xPos = 0.48 + i * (cardW + 0.25);
  slide.addShape('roundRect', {x:xPos, y:cardY, w:cardW, h:cardH, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.05});
  slide.addShape('rect', {x:xPos, y:cardY, w:cardW, h:0.08, fill:{color:c.maroon}});
  slide.addShape('ellipse', {x:xPos+0.25, y:cardY+0.25, w:0.5, h:0.5, fill:{color:c.rose}});
  slide.addText(d.icon, {x:xPos+0.25, y:cardY+0.25, w:0.5, h:0.5, fontSize:16, color:c.maroon, align:'center', bold:true});
  slide.addText(d.num, {x:xPos+cardW-1.25, y:cardY+0.25, w:1, h:0.5, fontFace:'Georgia', fontSize:32, color:'E0E0E0', bold:true, align:'right'});
  slide.addText(d.title, {x:xPos+0.25, y:cardY+1.0, w:cardW-0.5, h:0.4, fontFace:'Arial', fontSize:16, color:c.main, bold:true});
  slide.addText(d.body, {x:xPos+0.25, y:cardY+1.5, w:cardW-0.5, h:2.5, fontFace:'Arial', fontSize:12, color:c.secondary, valign:'top', lineSpacing:18});
  slide.addShape('line', {x:xPos+0.25, y:cardY+4.3, w:cardW-0.5, h:0, line:{color:'DCDCDC', width:1}});
  slide.addText(d.impact, {x:xPos+0.25, y:cardY+4.4, w:cardW-0.5, h:0.4, fontFace:'Arial', fontSize:11, color:c.coal, bold:true});
});
```

### Bullet Points

```javascript
var points = [
  {num:'1', title:'Point title', desc:'Description text'}
  // ... repeat
];
var boxH = 1.0, gap = 0.15;
points.forEach(function(pt, i) {
  var y = 2.1 + i * (boxH + gap);
  slide.addShape('roundRect', {x:0.48, y:y, w:12.36, h:boxH, fill:{type:'solid', color:'FAFAFA'}, line:{color:c.border, width:0.5}, rectRadius:0.05});
  slide.addShape('rect', {x:0.48, y:y, w:0.06, h:boxH, fill:{color:c.maroon}});
  slide.addShape('ellipse', {x:0.7, y:y+0.25, w:0.5, h:0.5, fill:{color:c.maroon}});
  slide.addText(pt.num, {x:0.7, y:y+0.25, w:0.5, h:0.5, fontFace:'Arial', fontSize:14, color:'FFFFFF', bold:true, align:'center', valign:'middle'});
  slide.addText(pt.title, {x:1.4, y:y+0.15, w:11.2, h:0.4, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
  slide.addText(pt.desc, {x:1.4, y:y+0.5, w:11.2, h:0.4, fontFace:'Arial', fontSize:11, color:c.secondary});
});
```

### KPI Metrics

```javascript
var kpis = [{value:'$4.2M', label:'Revenue'}, {value:'+27%', label:'Growth'}, {value:'92%', label:'Retention'}];
var details = [{title:'Detail 1', text:'Explanation'}, {title:'Detail 2', text:'Explanation'}, {title:'Detail 3', text:'Explanation'}];
var kpiX = 0.48, kpiW = 5.5, detailX = 6.3, detailW = 6.5;
kpis.forEach(function(kpi, i) {
  var y = 1.90 + i * 1.55;
  slide.addShape('roundRect', {x:kpiX, y:y, w:kpiW, h:1.4, fill:{color:c.zone1}, rectRadius:0.05});
  slide.addShape('rect', {x:kpiX, y:y, w:0.06, h:1.4, fill:{color:c.maroon}});
  slide.addText(kpi.value, {x:kpiX+0.3, y:y+0.15, w:2.5, h:0.7, fontFace:'Georgia', fontSize:42, color:c.maroon, bold:true, valign:'middle'});
  slide.addText(kpi.label, {x:kpiX+0.3, y:y+0.85, w:kpiW-0.5, h:0.4, fontFace:'Arial', fontSize:13, color:c.meta});
});
details.forEach(function(d, i) {
  var y = 1.90 + i * 1.55;
  slide.addText(d.title, {x:detailX, y:y, w:detailW, h:0.35, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
  slide.addText(d.text, {x:detailX, y:y+0.4, w:detailW, h:0.95, fontFace:'Arial', fontSize:12, color:c.secondary, valign:'top', lineSpacing:17});
  if (i < details.length - 1) slide.addShape('line', {x:detailX, y:y+1.45, w:detailW, h:0, line:{color:c.border, width:1}});
});
```

### Funnel

```javascript
var stages = [
  {value:'100K', label:'Awareness', width:10.0, conv:'→ 40%'},
  {value:'40K', label:'Interest', width:8.0, conv:'→ 50%'},
  {value:'20K', label:'Consideration', width:6.0, conv:'→ 60%'},
  {value:'12K', label:'Intent', width:4.5, conv:'→ 75%'},
  {value:'9K', label:'Purchase', width:3.0, conv:''}
];
var centerX = 5.5, stageH = 0.9;
stages.forEach(function(s, i) {
  var y = 1.9 + i * (stageH + 0.08);
  var x = centerX - s.width / 2;
  var color = ['8E1E1E','A32020','B83030','C84040','D85050'][i];
  slide.addShape('roundRect', {x:x, y:y, w:s.width, h:stageH, fill:{color:color}, rectRadius:0.03});
  slide.addText(s.value, {x:x+0.3, y:y+0.15, w:2, h:0.6, fontFace:'Georgia', fontSize:22, color:'FFFFFF', bold:true});
  slide.addText(s.label, {x:x+2.5, y:y+0.25, w:s.width-3, h:0.5, fontFace:'Arial', fontSize:13, color:'FFFFFF'});
  if (s.conv) slide.addText(s.conv, {x:centerX+s.width/2+0.3, y:y+0.25, w:1.5, h:0.5, fontFace:'Arial', fontSize:11, color:c.meta});
});
```

### Big Number

```javascript
slide.addText("$", {x:2.5, y:2.5, w:1.5, h:1.5, fontFace:'Georgia', fontSize:60, color:c.maroon, align:'right'});
slide.addText("47", {x:4.0, y:2.0, w:5.5, h:2.0, fontFace:'Georgia', fontSize:120, color:c.maroon, bold:true, align:'center'});
slide.addText("B", {x:9.3, y:2.5, w:1.5, h:1.5, fontFace:'Georgia', fontSize:60, color:c.maroon});
slide.addText("Total market size", {x:0.48, y:4.3, w:12.36, h:0.6, fontFace:'Arial', fontSize:24, color:c.main, align:'center'});
slide.addText("Up from $38B in 2023", {x:0.48, y:5.0, w:12.36, h:0.5, fontFace:'Arial', fontSize:16, color:c.meta, align:'center'});
```

### Quote

```javascript
slide.addShape('roundRect', {x:0.48, y:2.3, w:12.36, h:3.5, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.1});
slide.addShape('rect', {x:0.48, y:2.3, w:0.08, h:3.5, fill:{color:c.maroon}});
slide.addText('"Quote text here"', {x:1.0, y:2.8, w:11.3, h:2.2, fontFace:'Georgia', fontSize:22, color:c.main, italic:true, valign:'top', lineSpacing:28});
slide.addText("— Author Name, Title", {x:1.0, y:5.1, w:11.3, h:0.4, fontFace:'Arial', fontSize:14, color:c.meta});
```

---

## Final HTML Template

Every output file MUST use this exact wrapper. The presenter UI and PptxGenJS download are **mandatory**.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DECK_TITLE</title>
<style>
/* ── Presenter shell (dark, techy, PowerPoint-like) ── */
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#0d1117;min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.deck{display:flex;flex-direction:column;align-items:center;
  gap:48px;padding:60px 20px 120px}
.deck>.slide{
  box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.06);
  border-radius:6px;transition:transform .2s,box-shadow .2s}
.deck>.slide:hover{transform:scale(1.008);
  box-shadow:0 25px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.1)}
/* auto-scale slides to fill screen */
@media(min-width:1100px){.deck{zoom:1.15}}
@media(min-width:1400px){.deck{zoom:1.35}}
@media(min-width:1800px){.deck{zoom:1.5}}
/* ── Bottom control bar ── */
.ctrl-bar{position:fixed;bottom:0;left:0;right:0;height:64px;z-index:9999;
  background:rgba(13,17,23,0.92);backdrop-filter:blur(16px);
  border-top:1px solid rgba(255,255,255,0.08);
  display:flex;align-items:center;justify-content:center;gap:20px}
.ctrl-bar .slide-count{color:rgba(255,255,255,0.45);font-size:13px;
  font-family:'SF Mono',Monaco,'Courier New',monospace;letter-spacing:.5px}
.ctrl-bar .dl-btn{padding:10px 28px;border:none;border-radius:6px;
  background:#8E1E1E;color:#fff;font-size:14px;font-weight:600;
  cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;
  font-family:-apple-system,sans-serif}
.ctrl-bar .dl-btn:hover{background:#A32020;transform:translateY(-1px);
  box-shadow:0 4px 20px rgba(142,30,30,0.45)}
.ctrl-bar .dl-btn:disabled{background:#333;color:#666;cursor:wait;transform:none;box-shadow:none}

/* ── Slide stylesheet (from styles.css) ── */
STYLES_CSS_CONTENTS
</style>
</head>
<body>

<div class="deck">
  <!-- all slide divs here -->
</div>

<!-- Control bar -->
<div class="ctrl-bar">
  <span class="slide-count">NUMBER_OF_SLIDES slides</span>
  <button class="dl-btn" id="dl-btn" onclick="downloadPPTX()">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Download PPTX
  </button>
</div>

<!-- PptxGenJS CDN -->
<script src="https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>

<script>
async function downloadPPTX() {
  var btn = document.getElementById('dl-btn');
  btn.disabled = true; btn.textContent = 'Generating...';
  try {
    var pptx = new PptxGenJS();
    pptx.defineLayout({name:'DECK',width:13.333,height:7.5});
    pptx.layout = 'DECK';
    var totalSlides = NUMBER_OF_SLIDES;

    // one IIFE per slide — NEVER skip any
    // (function(){ var slide = pptx.addSlide(); ... })();

    await pptx.writeFile({fileName:'FILENAME.pptx'});
  } catch(e) { alert('Export failed: ' + e.message); }
  btn.disabled = false; btn.innerHTML = '...restore original button HTML...';
}
</script>
</body>
</html>
```

**NEVER** omit the control bar, download button, or PptxGenJS script.

---

## PptxGenJS General Rendering Pattern

If a template's `pptxRendererCode` is missing or doesn't match your content, use this general pattern to create a slide from scratch:

```javascript
(function(){
  var slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  /* ── Layout constants ── */
  var startX = 0.48, frameY = 1.90, frameW = 12.36, frameH = 4.90;
  var titleY = 0.42, subtitleY = 1.05, footerY = 7.05;

  /* ── Title & Subtitle ── */
  slide.addText('Slide Title', {
    x: startX, y: titleY, w: 11.5, h: 0.55,
    fontSize: 24, fontFace: 'Georgia', color: '111111', bold: true
  });
  slide.addText('Subtitle or context', {
    x: startX, y: subtitleY, w: 11.5, h: 0.35,
    fontSize: 13, fontFace: 'Arial', color: '4A4F57'
  });

  /* ── Content area (adapt to your layout) ── */
  // Cards: use ROUNDED_RECTANGLE shapes + addText for each card
  var items = [/* your data */];
  var cols = Math.min(items.length, 4);
  var cardW = (frameW - (cols - 1) * 0.15) / cols;
  items.forEach(function(item, i) {
    var cx = startX + i * (cardW + 0.15);
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: cx, y: frameY, w: cardW, h: frameH,
      fill: { color: 'F7F9FB' }, rectRadius: 0.08,
      line: { color: 'E6E9EE', width: 0.5 }
    });
    slide.addText(item.title, {
      x: cx + 0.15, y: frameY + 0.15, w: cardW - 0.3, h: 0.35,
      fontSize: 12, fontFace: 'Arial', color: '111111', bold: true
    });
    slide.addText(item.body, {
      x: cx + 0.15, y: frameY + 0.55, w: cardW - 0.3, h: 2.0,
      fontSize: 9, fontFace: 'Arial', color: '222222', valign: 'top'
    });
  });

  // Tables: use slide.addTable(rows, options)
  // Charts: use slide.addChart(pptx.charts.BAR, data, options)

  /* ── Footer (always include) ── */
  slide.addText('Company Name', {
    x: startX, y: footerY, w: 5, h: 0.3,
    fontSize: 8, fontFace: 'Arial', color: '4A4F57'
  });
  slide.addText(slideNum + ' / ' + totalSlides, {
    x: 11.5, y: footerY, w: 1.5, h: 0.3,
    fontSize: 8, fontFace: 'Arial', color: '4A4F57', align: 'right'
  });
})();
```

**Key colour hex codes** (no `#` prefix in PptxGenJS):
`111111` (text), `222222` (body), `A32020` (accent), `8E1E1E` (maroon), `F7F9FB` (card bg), `F8E3E3` (rose), `4A4F57` (meta), `E6E9EE` (border), `C5E1A5` (green), `FFCDD2` (red), `FFF9C4` (amber)

---

## Rules

1. **Always wrap slides** in a master (`master-standard`, `master-cover`, or `master-blank`)
2. **Always include footer** with company name and page numbers
3. **Never invent CSS classes** not listed here — the stylesheet won't know about them
4. **Never use inline styles** for layout — the CSS handles all spacing and sizing
5. **Icons** — use emoji or Unicode symbols (e.g. 📊 🎯 ⚡ 🛡️ ✓ ✕ → ■)
6. **Titles** under 60 characters, **subtitles** under 80 characters
7. **Let content determine count** — if user gives 6 points, use 6 (within template limits)
8. **Replace all placeholders** — never leave `[brackets]` in final output
9. **Write PptxGenJS code for EVERY slide** — never skip any slide in the PPTX renderer
