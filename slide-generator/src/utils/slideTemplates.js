// Predefined slide templates for quick creation - Strategy& consulting style
// Templates inherit from slide masters which define base layout and styling
// NOTE: All content uses neutral placeholders to avoid biasing the LLM

// Import empty slide templates from masters
import { getEmptySlideTemplates, generateEmptySlideHTML } from './slideMasters';

export const SLIDE_TEMPLATES = {
  blank: {
    id: 'blank',
    title: 'Blank Canvas',
    type: 'blank',
    master: 'blank',
    description: 'Empty slide for custom layouts - no title or subtitle, full space for shapes and content',
    note: 'Full-page canvas with no title/subtitle. Use for section dividers, large images, custom diagrams, or when you need complete creative freedom.',
    thumbnail: 'blank',
    category: 'Opening',
    html: `<div class="slide blank-slide master-blank">
  <div class="frame blank-content">
    <!-- Full slide canvas for custom shapes and content -->
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  instructionSlide: {
    id: 'instructionSlide',
    title: 'Working Slide',
    type: 'instruction',
    master: 'default',
    description: 'Empty slide with title and instruction box for adding notes and directions',
    note: 'Working slide with a prominent instruction area. Use to add partner notes, content directions, or placeholder for slides that need to be developed.',
    thumbnail: 'instruction',
    category: 'Opening',
    html: `<div class="slide instruction-slide master-default">
  <h1 class="title">[Slide Title]</h1>
  <h2 class="subtitle">[Section or Context]</h2>
  <div class="frame">
    <div class="instruction-box" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px;
      background: linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%);
      border: 2px dashed var(--border);
      border-radius: 12px;
      text-align: center;
    ">
      <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.6;">📝</div>
      <div style="font-size: 20px; font-weight: 600; color: var(--muted); margin-bottom: 16px;">Instructions & Notes</div>
      <div style="font-size: 15px; color: var(--muted); line-height: 1.6; max-width: 600px;">
        Add your content directions here. Describe what should appear on this slide,
        key messages to convey, data sources to include, or any specific requirements.
      </div>
      <div style="margin-top: 24px; padding: 12px 20px; background: var(--page); border-radius: 8px; border: 1px solid var(--border);">
        <span style="font-size: 13px; color: var(--muted);">Use the chatbot or edit directly to replace this with actual content</span>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  cover: {
    id: 'cover',
    title: 'Cover Slide',
    type: 'cover',
    master: 'cover',
    description: 'Title slide with category, main title, branding, and date',
    note: 'Opening slide with category tag, large title, branding, and date. Use as the first slide of any presentation or major section opener.',
    thumbnail: 'cover',
    category: 'Opening',
    html: `<div class="slide cover-slide master-cover">
  <div class="frame">
    <div class="cover-category">[CATEGORY]</div>
    <div class="cover-title">[Presentation Title]</div>
  </div>
  <div class="cover-branding">[Company]</div>
  <div class="cover-date">[Date]</div>
</div>`,
    pptxRendererCode: `function render(pptx, slideData, slideNum, totalSlides, helpers) {
  const { COLORS, parseHTML } = helpers;
  const slide = pptx.addSlide({ masterName: 'BLANK_SLIDE' });

  // White background (clean cover — matches HTML)
  slide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});

  // Extract content from HTML
  let category = '';
  let title = 'Presentation Title';
  let branding = 'Strategy&';
  let date = '';

  if (slideData && slideData.html) {
    const { getText } = parseHTML(slideData.html);
    category = getText('.cover-category') || '';
    title = getText('.cover-title') || getText('.title') || 'Presentation Title';
    branding = getText('.cover-branding') || 'Strategy&';
    date = getText('.cover-date') || '';
  }

  // Category label (burgundy, uppercase, spaced) -- only if non-empty
  if (category) {
    slide.addText(category.toUpperCase(), {
      x: 0.48, y: 1.94, w: 12.36, h: 0.5,
      fontFace: 'Arial', fontSize: 18, color: COLORS.red,
      bold: true, charSpacing: 1.5
    });
  }

  // Main title (large Georgia, dark)
  slide.addText(title, {
    x: 0.48, y: 2.64, w: 9.7, h: 2.0,
    fontFace: 'Georgia', fontSize: 42, color: COLORS.main,
    valign: 'top', lineSpacingMultiple: 1.15
  });

  // Branding (bottom-left)
  slide.addText(branding, {
    x: 0.48, y: 6.6, w: 3, h: 0.4,
    fontFace: 'Arial', fontSize: 16, color: COLORS.meta, bold: true
  });

  // Date (bottom-right)
  if (date) {
    slide.addText(date, {
      x: 10.0, y: 6.6, w: 2.83, h: 0.4,
      fontFace: 'Arial', fontSize: 13, color: COLORS.meta, align: 'right'
    });
  }
}`,
  },

  threeCards: {
    id: 'threeCards',
    title: 'Three Cards',
    type: 'three-cards',
    master: 'standard',
    description: 'Three column cards with icons, ideal for frameworks, pillars, or phases',
    note: 'Three vertical cards with icon, number, heading, and text. Use for 3-part frameworks, strategic pillars, phases, options comparison, or any triple structure.',
    thumbnail: 'cards',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the three items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row">
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">01</div>
        </div>
        <h3>[Card 1 Title]</h3>
        <p>[Card 1 description - main point]</p>
        <p style="margin-top:10pt">[Card 1 supporting detail]</p>
        <div class="impact-box">[Card 1 metric or highlight]</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">02</div>
        </div>
        <h3>[Card 2 Title]</h3>
        <p>[Card 2 description - main point]</p>
        <p style="margin-top:10pt">[Card 2 supporting detail]</p>
        <div class="impact-box">[Card 2 metric or highlight]</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">03</div>
        </div>
        <h3>[Card 3 Title]</h3>
        <p>[Card 3 description - main point]</p>
        <p style="margin-top:10pt">[Card 3 supporting detail]</p>
        <div class="impact-box">[Card 3 metric or highlight]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',rose:'F8E3E3',meta:'4A4F57',coal:'4B4F55',border:'E6E9EE'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const items = [
    {icon:'[Icon]', num:'01', title:'[Card 1 Title]', body:'[Card 1 description]', impact:'[Card 1 metric]'},
    {icon:'[Icon]', num:'02', title:'[Card 2 Title]', body:'[Card 2 description]', impact:'[Card 2 metric]'},
    {icon:'[Icon]', num:'03', title:'[Card 3 Title]', body:'[Card 3 description]', impact:'[Card 3 metric]'}
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
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  kpiMetrics: {
    id: 'kpiMetrics',
    title: 'KPI Metrics',
    type: 'kpi',
    master: 'standard',
    description: 'Two-column layout with large KPI numbers and detail items',
    note: 'Two columns: left has 3 large KPI values with labels, right has 3 detail items with explanations. Use for results slides, performance dashboards, ROI showcases.',
    thumbnail: 'kpi',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the metrics]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="two-col">
      <div class="col-left">
        <div class="kpi-block">
          <div class="kpi-value">[Value 1]</div>
          <div class="kpi-label">[Label 1]</div>
        </div>
        <div class="kpi-block">
          <div class="kpi-value">[Value 2]</div>
          <div class="kpi-label">[Label 2]</div>
        </div>
        <div class="kpi-block">
          <div class="kpi-value">[Value 3]</div>
          <div class="kpi-label">[Label 3]</div>
        </div>
      </div>
      <div class="col-right">
        <div class="detail-item">
          <h4>[Detail 1 Title]</h4>
          <p>[Detail 1 description]</p>
        </div>
        <div class="detail-item">
          <h4>[Detail 2 Title]</h4>
          <p>[Detail 2 description]</p>
        </div>
        <div class="detail-item">
          <h4>[Detail 3 Title]</h4>
          <p>[Detail 3 description]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const startY = 1.90, kpiX = 0.48, kpiW = 5.5, detailX = 6.3, detailW = 6.5;
  const kpis = [
    {value:'[Value 1]', label:'[Label 1]'},
    {value:'[Value 2]', label:'[Label 2]'},
    {value:'[Value 3]', label:'[Label 3]'}
  ];
  kpis.forEach((kpi, i) => {
    const yPos = startY + (i * 1.55);
    slide.addShape('roundRect', {x:kpiX, y:yPos, w:kpiW, h:1.4, fill:{color:c.zone1}, rectRadius:0.05});
    slide.addShape('rect', {x:kpiX, y:yPos, w:0.06, h:1.4, fill:{color:c.maroon}});
    slide.addText(kpi.value, {x:kpiX + 0.3, y:yPos + 0.15, w:2.5, h:0.7, fontFace:'Georgia', fontSize:42, color:c.maroon, bold:true, valign:'middle'});
    slide.addText(kpi.label, {x:kpiX + 0.3, y:yPos + 0.85, w:kpiW - 0.5, h:0.4, fontFace:'Arial', fontSize:13, color:c.meta});
  });
  const details = [
    {title:'[Detail 1 Title]', text:'[Detail 1 description]'},
    {title:'[Detail 2 Title]', text:'[Detail 2 description]'},
    {title:'[Detail 3 Title]', text:'[Detail 3 description]'}
  ];
  details.forEach((detail, i) => {
    const yPos = startY + (i * 1.55);
    slide.addText(detail.title, {x:detailX, y:yPos, w:detailW, h:0.35, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
    slide.addText(detail.text, {x:detailX, y:yPos + 0.4, w:detailW, h:0.95, fontFace:'Arial', fontSize:12, color:c.secondary, valign:'top', lineSpacing:17});
    if (i < details.length - 1) {
      slide.addShape('line', {x:detailX, y:yPos + 1.45, w:detailW, h:0, line:{color:c.border, width:1}});
    }
  });
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  timeline: {
    id: 'timeline',
    title: 'Timeline',
    type: 'timeline',
    master: 'standard',
    description: 'Vertical timeline with markers and content blocks',
    note: 'Vertical timeline with period markers and content blocks. Use for project phases, historical progression, implementation milestones, or any sequential events.',
    thumbnail: 'timeline',
    category: 'Process & Time',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the timeline]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="timeline-container">
      <div class="timeline-row">
        <div class="timeline-marker">[Period 1]</div>
        <div class="timeline-content">
          <h4>[Phase 1 Title]</h4>
          <p>[Phase 1 description]</p>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-marker">[Period 2]</div>
        <div class="timeline-content">
          <h4>[Phase 2 Title]</h4>
          <p>[Phase 2 description]</p>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-marker">[Period 3]</div>
        <div class="timeline-content">
          <h4>[Phase 3 Title]</h4>
          <p>[Phase 3 description]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  quote: {
    id: 'quote',
    title: 'Quote',
    type: 'quote',
    master: 'standard',
    description: 'Large quote box with attribution',
    note: 'Centered quote box with large quote text and author attribution. Use for executive quotes, testimonials, key statements, or impactful messages that need emphasis.',
    thumbnail: 'quote',
    category: 'Emphasis',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="quote-box">
      <p class="quote-text">"[Quote text]"</p>
      <p class="quote-author">— [Author Name], [Title]</p>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const quoteY = 2.3, quoteH = 3.5;
  slide.addShape('roundRect', {x:0.48, y:quoteY, w:12.36, h:quoteH, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.1});
  slide.addShape('rect', {x:0.48, y:quoteY, w:0.08, h:quoteH, fill:{color:c.maroon}});
  slide.addText('"[Quote text]"', {x:1.0, y:quoteY + 0.5, w:11.3, h:2.2, fontFace:'Georgia', fontSize:22, color:c.main, italic:true, valign:'top', lineSpacing:28});
  slide.addText("— [Author Name], [Title]", {x:1.0, y:quoteY + 2.8, w:11.3, h:0.4, fontFace:'Arial', fontSize:14, color:c.meta});
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  bulletPoints: {
    id: 'bulletPoints',
    title: 'Key Points',
    type: 'bullets',
    master: 'standard',
    description: 'Executive-style numbered key points with titles and descriptions',
    note: 'Numbered horizontal boxes with title and description. Use for recommendations, key findings, action items, strategic priorities, or any list requiring emphasis and structure.',
    thumbnail: 'bullets',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the key points]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="key-points">
      <div class="key-point">
        <div class="key-point-number">1</div>
        <div class="key-point-content">
          <h4>[First key point title]</h4>
          <p>[Brief description or supporting detail for the first point]</p>
        </div>
      </div>
      <div class="key-point">
        <div class="key-point-number">2</div>
        <div class="key-point-content">
          <h4>[Second key point title]</h4>
          <p>[Brief description or supporting detail for the second point]</p>
        </div>
      </div>
      <div class="key-point">
        <div class="key-point-number">3</div>
        <div class="key-point-content">
          <h4>[Third key point title]</h4>
          <p>[Brief description or supporting detail for the third point]</p>
        </div>
      </div>
      <div class="key-point">
        <div class="key-point-number">4</div>
        <div class="key-point-content">
          <h4>[Fourth key point title]</h4>
          <p>[Brief description or supporting detail for the fourth point]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const startY = 2.1, boxH = 1.0, gap = 0.15;
  const points = [
    {num: '1', title: '[First key point title]', desc: '[Brief description for the first point]'},
    {num: '2', title: '[Second key point title]', desc: '[Brief description for the second point]'},
    {num: '3', title: '[Third key point title]', desc: '[Brief description for the third point]'},
    {num: '4', title: '[Fourth key point title]', desc: '[Brief description for the fourth point]'}
  ];
  points.forEach((pt, i) => {
    const y = startY + i * (boxH + gap);
    slide.addShape('roundRect', {x:0.48, y:y, w:12.36, h:boxH, fill:{type:'solid', color:'FAFAFA'}, line:{color:c.border, width:0.5}, rectRadius:0.05});
    slide.addShape('rect', {x:0.48, y:y, w:0.06, h:boxH, fill:{color:c.maroon}});
    slide.addShape('ellipse', {x:0.7, y:y + 0.25, w:0.5, h:0.5, fill:{color:c.maroon}});
    slide.addText(pt.num, {x:0.7, y:y + 0.25, w:0.5, h:0.5, fontFace:'Arial', fontSize:14, color:'FFFFFF', bold:true, align:'center', valign:'middle'});
    slide.addText(pt.title, {x:1.4, y:y + 0.15, w:11.2, h:0.4, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
    slide.addText(pt.desc, {x:1.4, y:y + 0.5, w:11.2, h:0.4, fontFace:'Arial', fontSize:11, color:c.secondary});
  });
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  // Bullet Points — Two-Column variation
  bulletPointsTwoCol: {
    id: 'bulletPointsTwoCol',
    title: 'Key Points (Two-Column)',
    type: 'bullets',
    master: 'standard',
    description: 'Numbered key points arranged in two columns for a wider, more visual layout',
    note: 'Two columns of numbered points, each with a title and description. Use when you want a wider layout that fills the slide more evenly.',
    thumbnail: 'bullets',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the key points]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="kp-two-col">
      <div class="kp-col">
        <div class="kp-item">
          <div class="kp-num">01</div>
          <div class="kp-text">
            <h4>[First key point title]</h4>
            <p>[Brief description or supporting detail for the first point]</p>
          </div>
        </div>
        <div class="kp-item">
          <div class="kp-num">02</div>
          <div class="kp-text">
            <h4>[Second key point title]</h4>
            <p>[Brief description or supporting detail for the second point]</p>
          </div>
        </div>
        <div class="kp-item">
          <div class="kp-num">03</div>
          <div class="kp-text">
            <h4>[Third key point title]</h4>
            <p>[Brief description or supporting detail for the third point]</p>
          </div>
        </div>
      </div>
      <div class="kp-col">
        <div class="kp-item">
          <div class="kp-num">04</div>
          <div class="kp-text">
            <h4>[Fourth key point title]</h4>
            <p>[Brief description or supporting detail for the fourth point]</p>
          </div>
        </div>
        <div class="kp-item">
          <div class="kp-num">05</div>
          <div class="kp-text">
            <h4>[Fifth key point title]</h4>
            <p>[Brief description or supporting detail for the fifth point]</p>
          </div>
        </div>
        <div class="kp-item">
          <div class="kp-num">06</div>
          <div class="kp-text">
            <h4>[Sixth key point title]</h4>
            <p>[Brief description or supporting detail for the sixth point]</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Bullet Points — Vertical Cards variation
  bulletPointsVertical: {
    id: 'bulletPointsVertical',
    title: 'Key Points (Vertical)',
    type: 'bullets',
    master: 'standard',
    description: 'Numbered key points as vertical cards side by side',
    note: 'Four tall vertical cards in a row, each numbered with a title and description. Use for pillars, priorities, or principles that benefit from equal visual weight.',
    thumbnail: 'bullets',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the key points]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="kp-vertical">
      <div class="kp-vcard">
        <div class="kp-vnum">01</div>
        <div class="kp-vdivider"></div>
        <h4>[First key point title]</h4>
        <p>[Brief description or supporting detail for the first point]</p>
      </div>
      <div class="kp-vcard">
        <div class="kp-vnum">02</div>
        <div class="kp-vdivider"></div>
        <h4>[Second key point title]</h4>
        <p>[Brief description or supporting detail for the second point]</p>
      </div>
      <div class="kp-vcard">
        <div class="kp-vnum">03</div>
        <div class="kp-vdivider"></div>
        <h4>[Third key point title]</h4>
        <p>[Brief description or supporting detail for the third point]</p>
      </div>
      <div class="kp-vcard">
        <div class="kp-vnum">04</div>
        <div class="kp-vdivider"></div>
        <h4>[Fourth key point title]</h4>
        <p>[Brief description or supporting detail for the fourth point]</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Bullet Points — Letter Icons (A, B, C, D)
  bulletPointsLetters: {
    id: 'bulletPointsLetters',
    title: 'Key Points (Letter Icons)',
    type: 'bullets',
    master: 'standard',
    description: 'Key points with bold letter icons (A, B, C, D) in square badges',
    note: 'Four key points with square letter badges. Use for categorized items, options, or prioritized recommendations where letters convey grouping.',
    thumbnail: 'bullets',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the key points]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="kp-letters">
      <div class="kp-letter-item">
        <div class="kp-letter-icon">A</div>
        <div class="kp-letter-body">
          <h4>[First key point title]</h4>
          <p>[Brief description or supporting detail for the first point]</p>
        </div>
      </div>
      <div class="kp-letter-item">
        <div class="kp-letter-icon">B</div>
        <div class="kp-letter-body">
          <h4>[Second key point title]</h4>
          <p>[Brief description or supporting detail for the second point]</p>
        </div>
      </div>
      <div class="kp-letter-item">
        <div class="kp-letter-icon">C</div>
        <div class="kp-letter-body">
          <h4>[Third key point title]</h4>
          <p>[Brief description or supporting detail for the third point]</p>
        </div>
      </div>
      <div class="kp-letter-item">
        <div class="kp-letter-icon">D</div>
        <div class="kp-letter-body">
          <h4>[Fourth key point title]</h4>
          <p>[Brief description or supporting detail for the fourth point]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Bullet Points — Checkmark Icons
  bulletPointsChecks: {
    id: 'bulletPointsChecks',
    title: 'Key Points (Checkmarks)',
    type: 'bullets',
    master: 'standard',
    description: 'Key points with green checkmark icons for completed or confirmed items',
    note: 'Stacked bullet points with green check circles. Use for confirmed deliverables, completed milestones, validated requirements, or approved action items.',
    thumbnail: 'bullets',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the key points]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="kp-checks">
      <div class="kp-check-item">
        <div class="kp-check-icon">✓</div>
        <div class="kp-check-body">
          <h4>[First key point title]</h4>
          <p>[Brief description or supporting detail for the first point]</p>
        </div>
      </div>
      <div class="kp-check-item">
        <div class="kp-check-icon">✓</div>
        <div class="kp-check-body">
          <h4>[Second key point title]</h4>
          <p>[Brief description or supporting detail for the second point]</p>
        </div>
      </div>
      <div class="kp-check-item">
        <div class="kp-check-icon">✓</div>
        <div class="kp-check-body">
          <h4>[Third key point title]</h4>
          <p>[Brief description or supporting detail for the third point]</p>
        </div>
      </div>
      <div class="kp-check-item">
        <div class="kp-check-icon">✓</div>
        <div class="kp-check-body">
          <h4>[Fourth key point title]</h4>
          <p>[Brief description or supporting detail for the fourth point]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Bullet Points — Icon Grid (2x2 cards with letter badges)
  bulletPointsIconGrid: {
    id: 'bulletPointsIconGrid',
    title: 'Key Points (Icon Grid)',
    type: 'bullets',
    master: 'standard',
    description: 'Exactly four key points in a strict 2x2 grid with circular numbered badges',
    note: 'Strict 2x2 card grid (4 items only — never more). Circular number badges. Use for pillars, capabilities, or principles that benefit from equal visual weight.',
    thumbnail: 'bullets',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the key points]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="kp-icon-grid">
      <div class="kp-icon-card">
        <div class="kp-icon-badge">1</div>
        <h4>[First key point title]</h4>
        <p>[Brief description or supporting detail for the first point]</p>
      </div>
      <div class="kp-icon-card">
        <div class="kp-icon-badge">2</div>
        <h4>[Second key point title]</h4>
        <p>[Brief description or supporting detail for the second point]</p>
      </div>
      <div class="kp-icon-card">
        <div class="kp-icon-badge">3</div>
        <h4>[Third key point title]</h4>
        <p>[Brief description or supporting detail for the third point]</p>
      </div>
      <div class="kp-icon-card">
        <div class="kp-icon-badge">4</div>
        <h4>[Fourth key point title]</h4>
        <p>[Brief description or supporting detail for the fourth point]</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  iconGrid2x3: {
    id: 'iconGrid2x3',
    title: 'Icon Grid (2x3)',
    type: 'grid',
    master: 'standard',
    description: 'Six key points in a 2-column by 3-row grid with circular numbered badges',
    note: 'Strict 2x3 card grid (6 items only). Circular number badges. Use for six pillars, capabilities, or principles that need equal visual weight across 2 columns and 3 rows.',
    thumbnail: 'grid',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the six key points]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="kp-icon-grid kp-icon-grid--2x3">
      <div class="kp-icon-card">
        <div class="kp-icon-badge">1</div>
        <h4>[First key point title]</h4>
        <p>[Brief description for the first point]</p>
      </div>
      <div class="kp-icon-card">
        <div class="kp-icon-badge">2</div>
        <h4>[Second key point title]</h4>
        <p>[Brief description for the second point]</p>
      </div>
      <div class="kp-icon-card">
        <div class="kp-icon-badge">3</div>
        <h4>[Third key point title]</h4>
        <p>[Brief description for the third point]</p>
      </div>
      <div class="kp-icon-card">
        <div class="kp-icon-badge">4</div>
        <h4>[Fourth key point title]</h4>
        <p>[Brief description for the fourth point]</p>
      </div>
      <div class="kp-icon-card">
        <div class="kp-icon-badge">5</div>
        <h4>[Fifth key point title]</h4>
        <p>[Brief description for the fifth point]</p>
      </div>
      <div class="kp-icon-card">
        <div class="kp-icon-badge">6</div>
        <h4>[Sixth key point title]</h4>
        <p>[Brief description for the sixth point]</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  grid2x2: {
    id: 'grid2x2',
    title: '2x2 Grid',
    type: 'grid',
    master: 'standard',
    description: 'Four-quadrant grid for frameworks or capability areas',
    note: '2x2 grid with 4 equal quadrants, each with heading and text. Use for capability matrices, quadrant frameworks, 4-part categorizations, or balanced comparisons.',
    thumbnail: 'grid',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the four areas]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="grid-2x2">
      <div class="grid-cell">
        <h4>[Quadrant 1 Title]</h4>
        <p>[Quadrant 1 description]</p>
      </div>
      <div class="grid-cell">
        <h4>[Quadrant 2 Title]</h4>
        <p>[Quadrant 2 description]</p>
      </div>
      <div class="grid-cell">
        <h4>[Quadrant 3 Title]</h4>
        <p>[Quadrant 3 description]</p>
      </div>
      <div class="grid-cell">
        <h4>[Quadrant 4 Title]</h4>
        <p>[Quadrant 4 description]</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 2x2 Grid — Numbered Rows variation
  grid2x2Rows: {
    id: 'grid2x2Rows',
    title: '2x2 Grid (Rows)',
    type: 'grid',
    master: 'standard',
    description: 'Four numbered horizontal rows instead of quadrant grid',
    note: 'Four full-width numbered rows with title and description. Use as an alternative to the 2x2 quadrant when a sequential or prioritized reading order is preferred.',
    thumbnail: 'grid',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the four areas]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="grid-rows">
      <div class="grid-row-item">
        <div class="grid-row-num">01</div>
        <div class="grid-row-body">
          <h4>[Area 1 Title]</h4>
          <p>[Area 1 description — key details and context]</p>
        </div>
      </div>
      <div class="grid-row-item">
        <div class="grid-row-num">02</div>
        <div class="grid-row-body">
          <h4>[Area 2 Title]</h4>
          <p>[Area 2 description — key details and context]</p>
        </div>
      </div>
      <div class="grid-row-item">
        <div class="grid-row-num">03</div>
        <div class="grid-row-body">
          <h4>[Area 3 Title]</h4>
          <p>[Area 3 description — key details and context]</p>
        </div>
      </div>
      <div class="grid-row-item">
        <div class="grid-row-num">04</div>
        <div class="grid-row-body">
          <h4>[Area 4 Title]</h4>
          <p>[Area 4 description — key details and context]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  comparisonTable: {
    id: 'comparisonTable',
    title: 'Comparison Table',
    type: 'table',
    master: 'standard',
    description: 'Side-by-side comparison table for options or before/after',
    note: 'Data table with headers and rows, color-coded scores. Use for vendor comparisons, feature matrices, option analysis, or before/after assessments.',
    thumbnail: 'table',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the comparison]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
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
          <td>[Criterion 1]</td>
          <td class="score-high">[Score A1]</td>
          <td class="score-med">[Score B1]</td>
          <td class="score-high">[Score C1]</td>
        </tr>
        <tr>
          <td>[Criterion 2]</td>
          <td class="score-high">[Score A2]</td>
          <td class="score-low">[Score B2]</td>
          <td class="score-med">[Score C2]</td>
        </tr>
        <tr>
          <td>[Criterion 3]</td>
          <td class="score-med">[Score A3]</td>
          <td class="score-high">[Score B3]</td>
          <td class="score-med">[Score C3]</td>
        </tr>
        <tr>
          <td>[Criterion 4]</td>
          <td class="score-high">[Score A4]</td>
          <td class="score-med">[Score B4]</td>
          <td class="score-low">[Score C4]</td>
        </tr>
      </tbody>
    </table>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  processFlow: {
    id: 'processFlow',
    title: 'Process Flow',
    type: 'flow',
    master: 'standard',
    description: 'Horizontal process flow with connected steps',
    note: 'Horizontal process with numbered steps and arrows. Use for methodologies, workflows, customer journeys, or any sequential process with 4-6 steps.',
    thumbnail: 'flow',
    category: 'Process & Time',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the process]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="process-flow">
      <div class="process-step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h4>[Step 1]</h4>
          <p>[Step 1 description]</p>
        </div>
      </div>
      <div class="process-arrow">→</div>
      <div class="process-step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h4>[Step 2]</h4>
          <p>[Step 2 description]</p>
        </div>
      </div>
      <div class="process-arrow">→</div>
      <div class="process-step">
        <div class="step-number">3</div>
        <div class="step-content">
          <h4>[Step 3]</h4>
          <p>[Step 3 description]</p>
        </div>
      </div>
      <div class="process-arrow">→</div>
      <div class="process-step">
        <div class="step-number">4</div>
        <div class="step-content">
          <h4>[Step 4]</h4>
          <p>[Step 4 description]</p>
        </div>
      </div>
      <div class="process-arrow">→</div>
      <div class="process-step">
        <div class="step-number">5</div>
        <div class="step-content">
          <h4>[Step 5]</h4>
          <p>[Step 5 description]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  chevronFlow: {
    id: 'chevronFlow',
    title: 'Chevron Process with Sub-Steps',
    type: 'chevron',
    master: 'standard',
    description: 'Multi-phase process with chevron arrows AND detailed sub-activities under each phase. Best for: project phases with specific tasks, implementation roadmaps with action items, transformation journeys with milestones.',
    note: 'STRUCTURAL: Two-level hierarchy (phases + sub-activities). FLEXIBLE: Number of phases (3-5). REQUIRED: Each phase MUST have sub-activities - if user content only has phase names without details, use processFlow instead. In CREATIVE mode (no source data), generate meaningful sub-activities. In FACTUAL mode (document/data provided), only use if source has hierarchical detail.',
    thumbnail: 'chevron',
    category: 'Process & Time',
    html: `<div class="slide master-standard">
  <h1 class="title">[Process or Approach Title]</h1>
  <h2 class="subtitle">[Context or timeframe]</h2>
  <div class="frame">
    <div class="chevron-flow">
      <div class="chevron-row">
        <div class="chevron-item">
          <div class="chevron-shape"><span class="phase-num">01</span><span class="phase-title">[Phase]</span></div>
          <div class="chevron-substeps">
            <div class="chevron-substep"><span class="substep-num">1</span><span class="substep-text">[Activity]</span></div>
            <div class="chevron-substep"><span class="substep-num">2</span><span class="substep-text">[Activity]</span></div>
          </div>
        </div>
        <div class="chevron-item">
          <div class="chevron-shape"><span class="phase-num">02</span><span class="phase-title">[Phase]</span></div>
          <div class="chevron-substeps">
            <div class="chevron-substep"><span class="substep-num">1</span><span class="substep-text">[Activity]</span></div>
            <div class="chevron-substep"><span class="substep-num">2</span><span class="substep-text">[Activity]</span></div>
          </div>
        </div>
        <div class="chevron-item">
          <div class="chevron-shape"><span class="phase-num">03</span><span class="phase-title">[Phase]</span></div>
          <div class="chevron-substeps">
            <div class="chevron-substep"><span class="substep-num">1</span><span class="substep-text">[Activity]</span></div>
            <div class="chevron-substep"><span class="substep-num">2</span><span class="substep-text">[Activity]</span></div>
          </div>
        </div>
        <div class="chevron-item">
          <div class="chevron-shape"><span class="phase-num">04</span><span class="phase-title">[Phase]</span></div>
          <div class="chevron-substeps">
            <div class="chevron-substep"><span class="substep-num">1</span><span class="substep-text">[Activity]</span></div>
            <div class="chevron-substep"><span class="substep-num">2</span><span class="substep-text">[Activity]</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1</span>
  </footer>
</div>`,
  },

  outcomeApproach: {
    id: 'outcomeApproach',
    title: 'Outcome Approach',
    type: 'outcome-approach',
    master: 'standard',
    description: 'Horizontal steps with main outcomes and numbered sub-outcomes',
    note: 'Outcome-driven approach with main step boxes on the left and sub-outcome boxes on the right. Numbered hierarchically (1, 1.1, 1.2). Use for project approaches, workstreams, or outcome-based planning.',
    thumbnail: 'outcome-approach',
    category: 'Process & Time',
    html: `<div class="slide master-standard">
  <h1 class="title">[Approach or Methodology Title]</h1>
  <h2 class="subtitle">[Context or description]</h2>
  <div class="frame">
    <div class="outcome-approach">
      <div class="outcome-row">
        <div class="outcome-main">
          <span class="outcome-num">1</span>
          <span class="outcome-text">[Main Outcome 1]</span>
        </div>
        <div class="outcome-subs">
          <div class="outcome-sub"><span class="sub-num">1.1</span><span class="sub-text">[Sub-outcome description]</span></div>
          <div class="outcome-sub"><span class="sub-num">1.2</span><span class="sub-text">[Sub-outcome description]</span></div>
          <div class="outcome-sub"><span class="sub-num">1.3</span><span class="sub-text">[Sub-outcome description]</span></div>
        </div>
      </div>
      <div class="outcome-row">
        <div class="outcome-main">
          <span class="outcome-num">2</span>
          <span class="outcome-text">[Main Outcome 2]</span>
        </div>
        <div class="outcome-subs">
          <div class="outcome-sub"><span class="sub-num">2.1</span><span class="sub-text">[Sub-outcome description]</span></div>
          <div class="outcome-sub"><span class="sub-num">2.2</span><span class="sub-text">[Sub-outcome description]</span></div>
          <div class="outcome-sub"><span class="sub-num">2.3</span><span class="sub-text">[Sub-outcome description]</span></div>
        </div>
      </div>
      <div class="outcome-row">
        <div class="outcome-main">
          <span class="outcome-num">3</span>
          <span class="outcome-text">[Main Outcome 3]</span>
        </div>
        <div class="outcome-subs">
          <div class="outcome-sub"><span class="sub-num">3.1</span><span class="sub-text">[Sub-outcome description]</span></div>
          <div class="outcome-sub"><span class="sub-num">3.2</span><span class="sub-text">[Sub-outcome description]</span></div>
          <div class="outcome-sub"><span class="sub-num">3.3</span><span class="sub-text">[Sub-outcome description]</span></div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  projectStepDetail: {
    id: 'projectStepDetail',
    title: 'Project Step Detail',
    type: 'step-detail',
    master: 'standard',
    description: 'Detailed project phase with activities and deliverables',
    note: 'Clean professional layout with numbered activities (pink) on wider left column and checkmarked deliverables (green) on narrower right column. Use for detailed phase breakdowns, workstream details, or deep-dive slides.',
    thumbnail: 'step-detail',
    category: 'Process & Time',
    html: `<div class="slide master-standard">
  <h1 class="title">[Phase or Step Title]</h1>
  <h2 class="subtitle">[Phase description or context]</h2>
  <div class="frame">
    <div class="step-detail">
      <div class="step-activities">
        <div class="step-activities-header">Key Activities</div>
        <div class="step-activities-content">
          <div class="step-activity"><span class="activity-num">1</span><span class="step-activity-text">[Activity in one sentence]</span></div>
          <div class="step-activity"><span class="activity-num">2</span><span class="step-activity-text">[Activity in one sentence]</span></div>
          <div class="step-activity"><span class="activity-num">3</span><span class="step-activity-text">[Activity in one sentence]</span></div>
          <div class="step-activity"><span class="activity-num">4</span><span class="step-activity-text">[Activity in one sentence]</span></div>
          <div class="step-activity"><span class="activity-num">5</span><span class="step-activity-text">[Activity in one sentence]</span></div>
        </div>
      </div>
      <div class="step-outcomes">
        <div class="step-outcomes-header">Deliverables</div>
        <div class="step-outcomes-list">
          <div class="step-outcome-item"><span class="outcome-check">✓</span><span class="outcome-text">[Key deliverable]</span></div>
          <div class="step-outcome-item"><span class="outcome-check">✓</span><span class="outcome-text">[Key deliverable]</span></div>
          <div class="step-outcome-item"><span class="outcome-check">✓</span><span class="outcome-text">[Key deliverable]</span></div>
          <div class="step-outcome-item"><span class="outcome-check">✓</span><span class="outcome-text">[Key deliverable]</span></div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1</span>
  </footer>
</div>`,
  },

  // Recommendation Summary - 3 key recommendations
  recommendationSummary: {
    id: 'recommendationSummary',
    title: 'Numbered Card Grid',
    type: 'recommendations',
    master: 'standard',
    description: 'Three numbered horizontal cards with title, body, and highlight',
    note: 'Three horizontal cards each with a number badge, title, description, and highlighted outcome. Layout supports 2-4 cards. Use when content has distinct named items that each need a title + detail + impact metric.',
    thumbnail: 'recommendations',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key Recommendations]</h1>
  <h2 class="subtitle">[Context or summary]</h2>
  <div class="frame">
    <div class="recommendations-grid">
      <div class="recommendation-card">
        <div class="rec-num">1</div>
        <div class="rec-content">
          <h4>[Recommendation title]</h4>
          <p class="rec-rationale">[Brief rationale or context]</p>
          <div class="rec-impact"><span>Impact:</span> [Expected outcome]</div>
        </div>
      </div>
      <div class="recommendation-card">
        <div class="rec-num">2</div>
        <div class="rec-content">
          <h4>[Recommendation title]</h4>
          <p class="rec-rationale">[Brief rationale or context]</p>
          <div class="rec-impact"><span>Impact:</span> [Expected outcome]</div>
        </div>
      </div>
      <div class="recommendation-card">
        <div class="rec-num">3</div>
        <div class="rec-content">
          <h4>[Recommendation title]</h4>
          <p class="rec-rationale">[Brief rationale or context]</p>
          <div class="rec-impact"><span>Impact:</span> [Expected outcome]</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Current vs Future State comparison
  currentFutureState: {
    id: 'currentFutureState',
    title: 'Split Columns (State)',
    type: 'comparison',
    master: 'standard',
    description: 'Two columns with contrasting items — left vs right with visual indicators',
    note: 'Two columns side-by-side with distinct visual indicators per side. Left column has items with one icon style, right column with another. Use when content naturally divides into two contrasting groups of 3-4 items each.',
    thumbnail: 'comparison',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Transformation Overview]</h1>
  <h2 class="subtitle">[Initiative or context]</h2>
  <div class="frame">
    <div class="pros-cons-container">
      <div class="current-state-col">
        <div class="pc-header current-header">
          <span class="pc-icon">●</span>
          <h3>Current State</h3>
        </div>
        <div class="pc-list">
          <div class="pc-item current-item">
            <span class="pc-bullet">●</span>
            <div>
              <strong>[Current reality 1]</strong>
              <p>[Description of how things work today]</p>
            </div>
          </div>
          <div class="pc-item current-item">
            <span class="pc-bullet">●</span>
            <div>
              <strong>[Current reality 2]</strong>
              <p>[Description of how things work today]</p>
            </div>
          </div>
          <div class="pc-item current-item">
            <span class="pc-bullet">●</span>
            <div>
              <strong>[Current reality 3]</strong>
              <p>[Description of how things work today]</p>
            </div>
          </div>
          <div class="pc-item current-item">
            <span class="pc-bullet">●</span>
            <div>
              <strong>[Current reality 4]</strong>
              <p>[Description of how things work today]</p>
            </div>
          </div>
        </div>
      </div>
      <div class="state-arrow">→</div>
      <div class="future-state-col">
        <div class="pc-header future-header">
          <span class="pc-icon">✓</span>
          <h3>Future State</h3>
        </div>
        <div class="pc-list">
          <div class="pc-item future-item">
            <span class="pc-bullet">✓</span>
            <div>
              <strong>[Target outcome 1]</strong>
              <p>[Description of future benefit]</p>
            </div>
          </div>
          <div class="pc-item future-item">
            <span class="pc-bullet">✓</span>
            <div>
              <strong>[Target outcome 2]</strong>
              <p>[Description of future benefit]</p>
            </div>
          </div>
          <div class="pc-item future-item">
            <span class="pc-bullet">✓</span>
            <div>
              <strong>[Target outcome 3]</strong>
              <p>[Description of future benefit]</p>
            </div>
          </div>
          <div class="pc-item future-item">
            <span class="pc-bullet">✓</span>
            <div>
              <strong>[Target outcome 4]</strong>
              <p>[Description of future benefit]</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  statHighlight: {
    id: 'statHighlight',
    title: 'Stat Highlight',
    type: 'stat',
    master: 'titleOnly',
    description: 'Large centered statistic with supporting context',
    note: 'Giant centered number with supporting metrics below. Use for market size, headline KPI, dramatic statistics, or any single number that needs maximum impact.',
    thumbnail: 'stat',
    category: 'Data & Metrics',
    html: `<div class="slide master-titleOnly">
  <h1 class="title">[Main heading]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="stat-highlight">
      <div class="stat-main">
        <span class="stat-dollar">[Prefix]</span>
        <span class="stat-number">[Number]</span>
        <span class="stat-unit">[Unit]</span>
      </div>
      <div class="stat-label">[Main stat label]</div>
      <div class="stat-context">
        <div class="context-item">
          <span class="context-value">[Value 1]</span>
          <span class="context-label">[Label 1]</span>
        </div>
        <div class="context-item">
          <span class="context-value">[Value 2]</span>
          <span class="context-label">[Label 2]</span>
        </div>
        <div class="context-item">
          <span class="context-value">[Value 3]</span>
          <span class="context-label">[Label 3]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  grid3x2: {
    id: 'grid3x2',
    title: '3×2 Grid',
    type: 'grid-3x2',
    master: 'standard',
    description: 'Six-cell grid (3 columns × 2 rows) for capabilities, services, or any 6-item showcase',
    note: '3×2 grid with headings and short descriptions per cell. Use for service offerings, capability overview, feature highlights, or any 6-item showcase.',
    thumbnail: 'icons',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the six items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="grid-3x2">
      <div class="grid-3x2-item">
        <h4>[Item 1 Title]</h4>
        <p>[Item 1 description]</p>
      </div>
      <div class="grid-3x2-item">
        <h4>[Item 2 Title]</h4>
        <p>[Item 2 description]</p>
      </div>
      <div class="grid-3x2-item">
        <h4>[Item 3 Title]</h4>
        <p>[Item 3 description]</p>
      </div>
      <div class="grid-3x2-item">
        <h4>[Item 4 Title]</h4>
        <p>[Item 4 description]</p>
      </div>
      <div class="grid-3x2-item">
        <h4>[Item 5 Title]</h4>
        <p>[Item 5 description]</p>
      </div>
      <div class="grid-3x2-item">
        <h4>[Item 6 Title]</h4>
        <p>[Item 6 description]</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  teamShowcase: {
    id: 'teamShowcase',
    title: 'Team Showcase',
    type: 'team',
    master: 'standard',
    description: 'Four team members with roles and expertise areas',
    note: '4-person team grid with avatar, name, role, and bio. Use for project team intros, leadership profiles, speaker bios, or any people showcase.',
    thumbnail: 'team',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the team]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="team-grid">
      <div class="team-member">
        <div class="member-avatar">[Avatar]</div>
        <h4>[Name 1]</h4>
        <div class="member-role">[Role 1]</div>
        <p>[Bio 1]</p>
      </div>
      <div class="team-member">
        <div class="member-avatar">[Avatar]</div>
        <h4>[Name 2]</h4>
        <div class="member-role">[Role 2]</div>
        <p>[Bio 2]</p>
      </div>
      <div class="team-member">
        <div class="member-avatar">[Avatar]</div>
        <h4>[Name 3]</h4>
        <div class="member-role">[Role 3]</div>
        <p>[Bio 3]</p>
      </div>
      <div class="team-member">
        <div class="member-avatar">[Avatar]</div>
        <h4>[Name 4]</h4>
        <div class="member-role">[Role 4]</div>
        <p>[Bio 4]</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  swotAnalysis: {
    id: 'swotAnalysis',
    title: 'Quad Grid (Color-Coded)',
    type: 'swot',
    master: 'standard',
    description: 'Four color-coded quadrants with headers and bullet lists',
    note: '2x2 grid with 4 distinctly colored quadrants. Each quadrant has a header and 3-4 bullet items. Use when content divides into exactly 4 categories or groups that benefit from color differentiation.',
    thumbnail: 'swot',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the analysis]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="swot-grid">
      <div class="swot-cell swot-strength">
        <div class="swot-header">
          <span class="swot-icon">[S Icon]</span>
          <h4>Strengths</h4>
        </div>
        <ul class="swot-list">
          <li>[Strength 1]</li>
          <li>[Strength 2]</li>
          <li>[Strength 3]</li>
          <li>[Strength 4]</li>
        </ul>
      </div>
      <div class="swot-cell swot-weakness">
        <div class="swot-header">
          <span class="swot-icon">[W Icon]</span>
          <h4>Weaknesses</h4>
        </div>
        <ul class="swot-list">
          <li>[Weakness 1]</li>
          <li>[Weakness 2]</li>
          <li>[Weakness 3]</li>
          <li>[Weakness 4]</li>
        </ul>
      </div>
      <div class="swot-cell swot-opportunity">
        <div class="swot-header">
          <span class="swot-icon">[O Icon]</span>
          <h4>Opportunities</h4>
        </div>
        <ul class="swot-list">
          <li>[Opportunity 1]</li>
          <li>[Opportunity 2]</li>
          <li>[Opportunity 3]</li>
          <li>[Opportunity 4]</li>
        </ul>
      </div>
      <div class="swot-cell swot-threat">
        <div class="swot-header">
          <span class="swot-icon">[T Icon]</span>
          <h4>Threats</h4>
        </div>
        <ul class="swot-list">
          <li>[Threat 1]</li>
          <li>[Threat 2]</li>
          <li>[Threat 3]</li>
          <li>[Threat 4]</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  thankYou: {
    id: 'thankYou',
    title: 'Thank You',
    type: 'closing',
    master: 'cover',
    description: 'Closing slide with contact information and call to action',
    note: 'Closing slide with thank you message and contact details. Use as the final slide for any presentation, includes email, website, and phone.',
    thumbnail: 'thanks',
    category: 'Opening',
    html: `<div class="slide cover-slide thank-you-slide master-cover">
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
</div>`,
    pptxRendererCode: `function render(pptx, slideData, slideNum, totalSlides, helpers) {
  const { COLORS, parseHTML } = helpers;
  const slide = pptx.addSlide({ masterName: 'BLANK_SLIDE' });

  // White background (clean closing slide)
  slide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});

  // Extract content from HTML
  let icon = '';
  let title = 'Thank You';
  let subtitle = '';
  let branding = 'Strategy&';
  let date = '';
  let contacts = [];

  if (slideData && slideData.html) {
    const { getText, getAllElements } = parseHTML(slideData.html);
    icon = getText('.thank-you-icon') || '';
    title = getText('.thank-you-title') || 'Thank You';
    subtitle = getText('.thank-you-subtitle') || '';
    branding = getText('.cover-branding') || 'Strategy&';
    date = getText('.cover-date') || '';
    const contactEls = getAllElements('.contact-item');
    contacts = contactEls.map(el => el.textContent.trim()).filter(Boolean);
  }

  // Icon (emoji, centered)
  if (icon) {
    slide.addText(icon, {
      x: 0, y: 1.2, w: 13.333, h: 1.0,
      fontSize: 40, align: 'center', valign: 'middle'
    });
  }

  // Thank You title (large, centered)
  slide.addText(title, {
    x: 1.5, y: icon ? 2.2 : 2.0, w: 10.333, h: 1.2,
    fontFace: 'Georgia', fontSize: 42, color: COLORS.main,
    align: 'center', valign: 'middle'
  });

  // Subtitle (centered, muted)
  if (subtitle) {
    slide.addText(subtitle, {
      x: 2.5, y: icon ? 3.4 : 3.2, w: 8.333, h: 0.5,
      fontFace: 'Arial', fontSize: 16, color: COLORS.meta,
      align: 'center'
    });
  }

  // Contact items (centered, stacked)
  if (contacts.length > 0) {
    const contactY = icon ? 4.2 : 4.0;
    contacts.forEach((contact, i) => {
      slide.addText(contact, {
        x: 3.5, y: contactY + (i * 0.45), w: 6.333, h: 0.35,
        fontFace: 'Arial', fontSize: 13, color: COLORS.meta,
        align: 'center'
      });
    });
  }

  // Branding (bottom-left)
  slide.addText(branding, {
    x: 0.48, y: 6.6, w: 3, h: 0.4,
    fontFace: 'Arial', fontSize: 16, color: COLORS.meta, bold: true
  });

  // Date (bottom-right)
  if (date) {
    slide.addText(date, {
      x: 10.0, y: 6.6, w: 2.83, h: 0.4,
      fontFace: 'Arial', fontSize: 13, color: COLORS.meta, align: 'right'
    });
  }
}`,
  },

  qualSlide: {
    id: 'qualSlide',
    title: 'Qualification / Case Study',
    type: 'qual',
    master: 'standard',
    description: 'Three-column case study: Situation, How We Helped, Impact',
    note: 'Qualification slide with three columns: Situation (client context), How We Helped (approach), Impact (results). IMPORTANT: All content must be sanitized — use anonymized client names (e.g., "A leading European bank"), disguised figures, and no confidential details. This is a public-facing credential slide.',
    thumbnail: 'qual',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Insight-driven headline about the engagement outcome]</h1>
  <h2 class="subtitle">[Client Industry / Engagement Type]</h2>
  <div class="frame">
    <div class="qual-container">
      <div class="qual-column">
        <div class="qual-header situation">Situation</div>
        <div class="qual-body">
          <p>[Describe the client context and challenge — anonymized. E.g., "A leading European bank faced declining margins in its retail division amid rising digital competition"]</p>
        </div>
      </div>
      <div class="qual-column">
        <div class="qual-header approach">How we helped</div>
        <div class="qual-body">
          <p>[Describe the approach and methodology — sanitized. E.g., "We conducted a 12-week diagnostic across 5 business units, benchmarked against 20+ peers, and co-designed a target operating model"]</p>
        </div>
      </div>
      <div class="qual-column">
        <div class="qual-header impact">Impact</div>
        <div class="qual-body">
          <p>[Describe results with disguised but directionally accurate figures. E.g., "15-20% cost reduction identified, €200M+ revenue opportunity pipeline, new digital platform launched in 6 months"]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Strategy&</span>
    <span>1</span>
  </footer>
</div>`,
  },

  roadmapTimeline: {
    id: 'roadmapTimeline',
    title: 'Roadmap Timeline',
    type: 'roadmap',
    master: 'standard',
    description: 'Clean horizontal timeline with phases and milestones',
    note: 'Horizontal roadmap with connected cards showing phases and dates. Use for project roadmaps, strategic plans, implementation timelines, or multi-phase initiatives.',
    thumbnail: 'roadmap',
    category: 'Process & Time',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the roadmap]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="horizontal-roadmap">
      <div class="roadmap-line"></div>
      <div class="roadmap-items">
        <div class="roadmap-item">
          <div class="roadmap-dot"></div>
          <div class="roadmap-card">
            <div class="roadmap-period">[Period 1]</div>
            <h4>[Phase 1]</h4>
            <p>[Phase 1 description]</p>
            <div class="roadmap-badge">[Badge 1]</div>
          </div>
        </div>
        <div class="roadmap-item">
          <div class="roadmap-dot"></div>
          <div class="roadmap-card">
            <div class="roadmap-period">[Period 2]</div>
            <h4>[Phase 2]</h4>
            <p>[Phase 2 description]</p>
            <div class="roadmap-badge">[Badge 2]</div>
          </div>
        </div>
        <div class="roadmap-item">
          <div class="roadmap-dot"></div>
          <div class="roadmap-card">
            <div class="roadmap-period">[Period 3]</div>
            <h4>[Phase 3]</h4>
            <p>[Phase 3 description]</p>
            <div class="roadmap-badge">[Badge 3]</div>
          </div>
        </div>
        <div class="roadmap-item">
          <div class="roadmap-dot"></div>
          <div class="roadmap-card">
            <div class="roadmap-period">[Period 4]</div>
            <h4>[Phase 4]</h4>
            <p>[Phase 4 description]</p>
            <div class="roadmap-badge">[Badge 4]</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  executiveSummary: {
    id: 'executiveSummary',
    title: 'Executive Summary',
    type: 'executive',
    master: 'standard',
    description: 'High-impact overview with key findings, recommendations, and outcomes',
    note: 'Situation-Complication-Resolution layout with colored sections. Use for executive summaries, project overviews, investment thesis, or high-level strategic briefs.',
    thumbnail: 'executive',
    category: 'Opening',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="executive-layout">
      <div class="exec-section">
        <div class="exec-number">1</div>
        <div class="exec-content">
          <h4>[Insight phrase, e.g. "Revenue up 23% despite headwinds"]</h4>
          <p>[Section content]</p>
        </div>
      </div>
      <div class="exec-section">
        <div class="exec-number">2</div>
        <div class="exec-content">
          <h4>[Insight phrase, e.g. "Three markets drive 80% of growth"]</h4>
          <p>[Section content]</p>
        </div>
      </div>
      <div class="exec-section">
        <div class="exec-number">3</div>
        <div class="exec-content">
          <h4>[Insight phrase, e.g. "Automation cuts cost 35%"]</h4>
          <p>[Section content]</p>
        </div>
      </div>
      <div class="exec-section">
        <div class="exec-number">4</div>
        <div class="exec-content">
          <h4>[Insight phrase, e.g. "Scale ops before Q3 launch"]</h4>
          <p>[Section content]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1</span>
  </footer>
</div>`,
  },

  executiveSummaryVertical: {
    id: 'executiveSummaryVertical',
    title: 'Executive Summary (Vertical)',
    type: 'executive',
    master: 'standard',
    description: 'Three vertical columns with numbered sections for situation, analysis, and recommendation',
    note: 'Three tall numbered columns side by side. Each column has a bold number, section title, and bullet content. Clean and authoritative — ideal as the opening slide of a deck.',
    thumbnail: 'executive',
    category: 'Opening',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading - the key takeaway]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="exec-v-columns">
      <div class="exec-v-col">
        <div class="exec-v-num">01</div>
        <div class="exec-v-label">[Insight phrase, e.g. "Market shifting to digital-first"]</div>
        <div class="exec-v-divider"></div>
        <div class="exec-v-body">
          <p>[Key context or situation statement that frames the challenge]</p>
          <ul>
            <li>[Supporting point 1]</li>
            <li>[Supporting point 2]</li>
          </ul>
        </div>
      </div>
      <div class="exec-v-col">
        <div class="exec-v-num">02</div>
        <div class="exec-v-label">[Insight phrase, e.g. "Three gaps eroding margins"]</div>
        <div class="exec-v-divider"></div>
        <div class="exec-v-body">
          <ul>
            <li>[Finding or analysis point 1]</li>
            <li>[Finding or analysis point 2]</li>
            <li>[Finding or analysis point 3]</li>
          </ul>
        </div>
      </div>
      <div class="exec-v-col">
        <div class="exec-v-num">03</div>
        <div class="exec-v-label">[Insight phrase, e.g. "Invest in ops to capture 2x upside"]</div>
        <div class="exec-v-divider"></div>
        <div class="exec-v-body">
          <ul>
            <li>[Recommendation or next step 1]</li>
            <li>[Recommendation or next step 2]</li>
            <li>[Recommendation or next step 3]</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  executiveSummaryHorizontal: {
    id: 'executiveSummaryHorizontal',
    title: 'Executive Summary (Horizontal)',
    type: 'executive',
    master: 'standard',
    description: 'Three horizontal rows with numbered sections for situation, analysis, and recommendation',
    note: 'Three full-width numbered rows stacked vertically. Each row has a bold number, section title on the left, and content on the right. Structured and easy to scan — ideal as the opening slide.',
    thumbnail: 'executive',
    category: 'Opening',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading - the key takeaway]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="exec-h-rows">
      <div class="exec-h-row">
        <div class="exec-h-left">
          <div class="exec-h-num">01</div>
          <div class="exec-h-label">[Insight phrase, e.g. "Revenue grew 23% YoY"]</div>
        </div>
        <div class="exec-h-right">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
        </div>
      </div>
      <div class="exec-h-row">
        <div class="exec-h-left">
          <div class="exec-h-num">02</div>
          <div class="exec-h-label">[Insight phrase, e.g. "Cost pressure from three drivers"]</div>
        </div>
        <div class="exec-h-right">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
        </div>
      </div>
      <div class="exec-h-row">
        <div class="exec-h-left">
          <div class="exec-h-num">03</div>
          <div class="exec-h-label">[Insight phrase, e.g. "Double down on digital channel"]</div>
        </div>
        <div class="exec-h-right">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  prosAndCons: {
    id: 'prosAndCons',
    title: 'Split Columns (Dual List)',
    type: 'pros-cons',
    master: 'standard',
    description: 'Two balanced columns with icon-marked items — left group vs right group',
    note: 'Two side-by-side columns with 3-4 items each. Each item has an icon marker, title, and description. Use when content divides into two balanced groups that need equal visual weight. Requires matching depth on both sides.',
    thumbnail: 'proscons',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the analysis]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="pros-cons-container">
      <div class="pros-column">
        <div class="pc-header pros-header">
          <span class="pc-icon">[Pro Icon]</span>
          <h3>[Pros Title]</h3>
        </div>
        <div class="pc-list">
          <div class="pc-item pro-item">
            <span class="pc-bullet">+</span>
            <div>
              <strong>[Pro 1 Title]</strong>
              <p>[Pro 1 description]</p>
            </div>
          </div>
          <div class="pc-item pro-item">
            <span class="pc-bullet">+</span>
            <div>
              <strong>[Pro 2 Title]</strong>
              <p>[Pro 2 description]</p>
            </div>
          </div>
          <div class="pc-item pro-item">
            <span class="pc-bullet">+</span>
            <div>
              <strong>[Pro 3 Title]</strong>
              <p>[Pro 3 description]</p>
            </div>
          </div>
          <div class="pc-item pro-item">
            <span class="pc-bullet">+</span>
            <div>
              <strong>[Pro 4 Title]</strong>
              <p>[Pro 4 description]</p>
            </div>
          </div>
        </div>
      </div>
      <div class="cons-column">
        <div class="pc-header cons-header">
          <span class="pc-icon">[Con Icon]</span>
          <h3>[Cons Title]</h3>
        </div>
        <div class="pc-list">
          <div class="pc-item con-item">
            <span class="pc-bullet">−</span>
            <div>
              <strong>[Con 1 Title]</strong>
              <p>[Con 1 description]</p>
            </div>
          </div>
          <div class="pc-item con-item">
            <span class="pc-bullet">−</span>
            <div>
              <strong>[Con 2 Title]</strong>
              <p>[Con 2 description]</p>
            </div>
          </div>
          <div class="pc-item con-item">
            <span class="pc-bullet">−</span>
            <div>
              <strong>[Con 3 Title]</strong>
              <p>[Con 3 description]</p>
            </div>
          </div>
          <div class="pc-item con-item">
            <span class="pc-bullet">−</span>
            <div>
              <strong>[Con 4 Title]</strong>
              <p>[Con 4 description]</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  problemSolution: {
    id: 'problemSolution',
    title: 'Split Panels (Numbered)',
    type: 'problem-solution',
    master: 'standard',
    description: 'Two panels side-by-side — each with numbered items and a metric highlight',
    note: 'Two-section layout: left panel with 3 numbered items + bottom metric, right panel with 3 numbered items + bottom metric. Use when content has two groups of 3 items each, and each group has a quantified summary.',
    thumbnail: 'solution',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the solution]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="problem-solution-container">
      <div class="ps-section problem-section">
        <div class="ps-badge problem-badge">[Problem Label]</div>
        <h3>[Problem Statement]</h3>
        <div class="ps-points">
          <div class="ps-point">
            <span class="ps-num">01</span>
            <p>[Problem Point 1]</p>
          </div>
          <div class="ps-point">
            <span class="ps-num">02</span>
            <p>[Problem Point 2]</p>
          </div>
          <div class="ps-point">
            <span class="ps-num">03</span>
            <p>[Problem Point 3]</p>
          </div>
        </div>
        <div class="ps-impact">
          <span class="impact-label">[Impact Label]:</span>
          <span class="impact-value">[Impact Value]</span>
        </div>
      </div>
      <div class="ps-arrow">→</div>
      <div class="ps-section solution-section">
        <div class="ps-badge solution-badge">[Solution Label]</div>
        <h3>[Solution Statement]</h3>
        <div class="ps-points">
          <div class="ps-point">
            <span class="ps-num">01</span>
            <p>[Solution Point 1]</p>
          </div>
          <div class="ps-point">
            <span class="ps-num">02</span>
            <p>[Solution Point 2]</p>
          </div>
          <div class="ps-point">
            <span class="ps-num">03</span>
            <p>[Solution Point 3]</p>
          </div>
        </div>
        <div class="ps-impact">
          <span class="impact-label">[Outcome Label]:</span>
          <span class="impact-value">[Outcome Value]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  beforeAfter: {
    id: 'beforeAfter',
    title: 'Split Columns (Contrast)',
    type: 'comparison',
    master: 'standard',
    description: 'Two columns with arrow divider — left items (✗) vs right items (✓)',
    note: 'Two columns with a directional arrow between them. Left column has items marked ✗, right column marked ✓. Each item has title + description. Use when content contrasts 3-4 items on each side with clear negative/positive or old/new distinction.',
    thumbnail: 'beforeafter',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the transformation]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="before-after-container">
      <div class="ba-column ba-before">
        <div class="ba-header">
          <span class="ba-icon">[Before Icon]</span>
          <h3>[Before State]</h3>
        </div>
        <div class="ba-items">
          <div class="ba-item negative">
            <span class="ba-bullet">✗</span>
            <div>
              <strong>[Before Item 1 Title]</strong>
              <p>[Before Item 1 description]</p>
            </div>
          </div>
          <div class="ba-item negative">
            <span class="ba-bullet">✗</span>
            <div>
              <strong>[Before Item 2 Title]</strong>
              <p>[Before Item 2 description]</p>
            </div>
          </div>
          <div class="ba-item negative">
            <span class="ba-bullet">✗</span>
            <div>
              <strong>[Before Item 3 Title]</strong>
              <p>[Before Item 3 description]</p>
            </div>
          </div>
          <div class="ba-item negative">
            <span class="ba-bullet">✗</span>
            <div>
              <strong>[Before Item 4 Title]</strong>
              <p>[Before Item 4 description]</p>
            </div>
          </div>
        </div>
      </div>
      <div class="ba-arrow">
        <div class="arrow-line"></div>
        <div class="arrow-text">[Transition]</div>
      </div>
      <div class="ba-column ba-after">
        <div class="ba-header">
          <span class="ba-icon">[After Icon]</span>
          <h3>[After State]</h3>
        </div>
        <div class="ba-items">
          <div class="ba-item positive">
            <span class="ba-bullet">✓</span>
            <div>
              <strong>[After Item 1 Title]</strong>
              <p>[After Item 1 description]</p>
            </div>
          </div>
          <div class="ba-item positive">
            <span class="ba-bullet">✓</span>
            <div>
              <strong>[After Item 2 Title]</strong>
              <p>[After Item 2 description]</p>
            </div>
          </div>
          <div class="ba-item positive">
            <span class="ba-bullet">✓</span>
            <div>
              <strong>[After Item 3 Title]</strong>
              <p>[After Item 3 description]</p>
            </div>
          </div>
          <div class="ba-item positive">
            <span class="ba-bullet">✓</span>
            <div>
              <strong>[After Item 4 Title]</strong>
              <p>[After Item 4 description]</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  valueProposition: {
    id: 'valueProposition',
    title: 'Hero Statement + Pillars',
    type: 'value-prop',
    master: 'titleOnly',
    description: 'Large hero statement at top with three numbered pillars below',
    note: 'Hero section at top with icon + bold statement + subtext, then 3 numbered pillars below. Each pillar needs: title, description, AND a stat with label. Use when content has one main claim supported by 3 quantified pillars.',
    thumbnail: 'value',
    category: 'Emphasis',
    html: `<div class="slide master-titleOnly">
  <h1 class="title">[Main heading about the value]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="value-prop-container">
      <div class="value-hero">
        <div class="hero-icon">[Icon]</div>
        <h2>[Hero Statement]</h2>
        <p class="hero-subtext">[Supporting statement]</p>
      </div>
      <div class="value-pillars">
        <div class="value-pillar">
          <div class="pillar-number">01</div>
          <h4>[Pillar 1 Title]</h4>
          <p>[Pillar 1 description]</p>
          <div class="pillar-stat">
            <span class="stat-num">[Stat 1]</span>
            <span class="stat-label">[Label 1]</span>
          </div>
        </div>
        <div class="value-pillar">
          <div class="pillar-number">02</div>
          <h4>[Pillar 2 Title]</h4>
          <p>[Pillar 2 description]</p>
          <div class="pillar-stat">
            <span class="stat-num">[Stat 2]</span>
            <span class="stat-label">[Label 2]</span>
          </div>
        </div>
        <div class="value-pillar">
          <div class="pillar-number">03</div>
          <h4>[Pillar 3 Title]</h4>
          <p>[Pillar 3 description]</p>
          <div class="pillar-stat">
            <span class="stat-num">[Stat 3]</span>
            <span class="stat-label">[Label 3]</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  nextSteps: {
    id: 'nextSteps',
    title: 'Next Steps',
    type: 'action',
    master: 'standard',
    description: 'Action items with owners, deadlines, and status tracking',
    note: 'Table-style layout with 4-5 action items. Each row needs: action description, owner name, deadline date, AND status (To Do/In Progress/Done). Use for project wrap-ups, meeting conclusions, or accountability tracking. Requires specific owners and dates - do NOT use if you only have generic action items.',
    thumbnail: 'nextsteps',
    category: 'Opening',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about actions]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="next-steps-container">
      <div class="steps-section immediate">
        <h4>[Priority 1 Label]</h4>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 1]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 1]</span>
              <span class="step-date">[Date 1]</span>
            </div>
          </div>
        </div>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 2]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 2]</span>
              <span class="step-date">[Date 2]</span>
            </div>
          </div>
        </div>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 3]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 3]</span>
              <span class="step-date">[Date 3]</span>
            </div>
          </div>
        </div>
      </div>
      <div class="steps-section short-term">
        <h4>[Priority 2 Label]</h4>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 4]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 4]</span>
              <span class="step-date">[Date 4]</span>
            </div>
          </div>
        </div>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 5]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 5]</span>
              <span class="step-date">[Date 5]</span>
            </div>
          </div>
        </div>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 6]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 6]</span>
              <span class="step-date">[Date 6]</span>
            </div>
          </div>
        </div>
      </div>
      <div class="steps-section medium-term">
        <h4>[Priority 3 Label]</h4>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 7]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 7]</span>
              <span class="step-date">[Date 7]</span>
            </div>
          </div>
        </div>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 8]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 8]</span>
              <span class="step-date">[Date 8]</span>
            </div>
          </div>
        </div>
        <div class="step-item">
          <div class="step-check"></div>
          <div class="step-content">
            <p>[Action 9]</p>
            <div class="step-meta">
              <span class="step-owner">[Owner 9]</span>
              <span class="step-date">[Date 9]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // === NEW HIGH-QUALITY PROFESSIONAL TEMPLATES ===

  twoCards: {
    id: 'twoCards',
    title: 'Two Cards',
    type: 'two-cards',
    master: 'standard',
    description: 'Two column cards for binary comparisons or dual concepts',
    note: 'Two side-by-side cards with icon, title, and details. Use for A/B comparisons, two options, dual strategies, or contrasting concepts.',
    thumbnail: 'cards',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the two items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row two-cards">
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">A</div>
        </div>
        <h3>[Card 1 Title]</h3>
        <p>[Card 1 description - main point and supporting details]</p>
        <ul class="card-list">
          <li>[Key point 1]</li>
          <li>[Key point 2]</li>
          <li>[Key point 3]</li>
        </ul>
        <div class="impact-box">[Card 1 metric or highlight]</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">B</div>
        </div>
        <h3>[Card 2 Title]</h3>
        <p>[Card 2 description - main point and supporting details]</p>
        <ul class="card-list">
          <li>[Key point 1]</li>
          <li>[Key point 2]</li>
          <li>[Key point 3]</li>
        </ul>
        <div class="impact-box">[Card 2 metric or highlight]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',rose:'F8E3E3',meta:'4A4F57',coal:'4B4F55',border:'E6E9EE'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const items = [
    {icon:'[Icon]', num:'A', title:'[Card 1 Title]', body:'[Card 1 description]', bullets:['[Point 1]','[Point 2]','[Point 3]'], impact:'[Metric 1]'},
    {icon:'[Icon]', num:'B', title:'[Card 2 Title]', body:'[Card 2 description]', bullets:['[Point 1]','[Point 2]','[Point 3]'], impact:'[Metric 2]'}
  ];
  const startX = 0.48, cardW = 6.06, cardH = 4.90, gap = 0.25, cardY = 1.90;
  items.forEach((d, i) => {
    const xPos = startX + (i * (cardW + gap));
    slide.addShape('roundRect', {x:xPos, y:cardY, w:cardW, h:cardH, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.05});
    slide.addShape('rect', {x:xPos, y:cardY, w:cardW, h:0.08, fill:{color:c.maroon}});
    slide.addShape('ellipse', {x:xPos + 0.25, y:cardY + 0.25, w:0.5, h:0.5, fill:{color:c.rose}});
    slide.addText(d.icon, {x:xPos + 0.25, y:cardY + 0.25, w:0.5, h:0.5, fontSize:16, color:c.maroon, align:'center', bold:true});
    slide.addText(d.num, {x:xPos + cardW - 1.25, y:cardY + 0.25, w:1, h:0.5, fontFace:'Georgia', fontSize:32, color:'E0E0E0', bold:true, align:'right'});
    slide.addText(d.title, {x:xPos + 0.25, y:cardY + 1.0, w:cardW - 0.5, h:0.4, fontFace:'Arial', fontSize:16, color:c.main, bold:true});
    slide.addText(d.body, {x:xPos + 0.25, y:cardY + 1.45, w:cardW - 0.5, h:0.6, fontFace:'Arial', fontSize:12, color:c.secondary, valign:'top', lineSpacing:17});
    d.bullets.forEach((b, bi) => {
      slide.addText('• ' + b, {x:xPos + 0.25, y:cardY + 2.1 + (bi * 0.45), w:cardW - 0.5, h:0.4, fontFace:'Arial', fontSize:11, color:c.secondary});
    });
    slide.addShape('line', {x:xPos + 0.25, y:cardY + 4.3, w:cardW - 0.5, h:0, line:{color:'DCDCDC', width:1}});
    slide.addText(d.impact, {x:xPos + 0.25, y:cardY + 4.4, w:cardW - 0.5, h:0.4, fontFace:'Arial', fontSize:11, color:c.coal, bold:true});
  });
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  fourCards: {
    id: 'fourCards',
    title: 'Four Cards',
    type: 'four-cards',
    master: 'standard',
    description: 'Four column cards for comprehensive frameworks or capability areas',
    note: 'Four compact cards with icon, title, and description. Use for 4-pillar frameworks, comprehensive offerings, capability areas, or quadrant alternatives.',
    thumbnail: 'cards',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the four items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row four-cards">
      <div class="card compact">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">01</div>
        </div>
        <h3>[Card 1 Title]</h3>
        <p>[Card 1 description]</p>
        <div class="impact-box">[Card 1 metric]</div>
      </div>
      <div class="card compact">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">02</div>
        </div>
        <h3>[Card 2 Title]</h3>
        <p>[Card 2 description]</p>
        <div class="impact-box">[Card 2 metric]</div>
      </div>
      <div class="card compact">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">03</div>
        </div>
        <h3>[Card 3 Title]</h3>
        <p>[Card 3 description]</p>
        <div class="impact-box">[Card 3 metric]</div>
      </div>
      <div class="card compact">
        <div class="card-header-row">
          <div class="card-icon-circle">[Icon]</div>
          <div class="card-num">04</div>
        </div>
        <h3>[Card 4 Title]</h3>
        <p>[Card 4 description]</p>
        <div class="impact-box">[Card 4 metric]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',rose:'F8E3E3',meta:'4A4F57',coal:'4B4F55',border:'E6E9EE'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const items = [
    {icon:'[Icon]', num:'01', title:'[Card 1 Title]', body:'[Card 1 description]', impact:'[Metric 1]'},
    {icon:'[Icon]', num:'02', title:'[Card 2 Title]', body:'[Card 2 description]', impact:'[Metric 2]'},
    {icon:'[Icon]', num:'03', title:'[Card 3 Title]', body:'[Card 3 description]', impact:'[Metric 3]'},
    {icon:'[Icon]', num:'04', title:'[Card 4 Title]', body:'[Card 4 description]', impact:'[Metric 4]'}
  ];
  const startX = 0.48, cardW = 2.91, cardH = 4.90, gap = 0.18, cardY = 1.90;
  items.forEach((d, i) => {
    const xPos = startX + (i * (cardW + gap));
    slide.addShape('roundRect', {x:xPos, y:cardY, w:cardW, h:cardH, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.05});
    slide.addShape('rect', {x:xPos, y:cardY, w:cardW, h:0.06, fill:{color:c.maroon}});
    slide.addShape('ellipse', {x:xPos + 0.2, y:cardY + 0.2, w:0.45, h:0.45, fill:{color:c.rose}});
    slide.addText(d.icon, {x:xPos + 0.2, y:cardY + 0.2, w:0.45, h:0.45, fontSize:14, color:c.maroon, align:'center', bold:true});
    slide.addText(d.num, {x:xPos + cardW - 1.0, y:cardY + 0.2, w:0.8, h:0.45, fontFace:'Georgia', fontSize:26, color:'E0E0E0', bold:true, align:'right'});
    slide.addText(d.title, {x:xPos + 0.2, y:cardY + 0.85, w:cardW - 0.4, h:0.4, fontFace:'Arial', fontSize:13, color:c.main, bold:true});
    slide.addText(d.body, {x:xPos + 0.2, y:cardY + 1.3, w:cardW - 0.4, h:2.8, fontFace:'Arial', fontSize:10, color:c.secondary, valign:'top', lineSpacing:15});
    slide.addShape('line', {x:xPos + 0.2, y:cardY + 4.3, w:cardW - 0.4, h:0, line:{color:'DCDCDC', width:1}});
    slide.addText(d.impact, {x:xPos + 0.2, y:cardY + 4.4, w:cardW - 0.4, h:0.4, fontFace:'Arial', fontSize:10, color:c.coal, bold:true});
  });
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  // ===== CARD VARIANT: Two Cards B — Gradient Banner =====
  twoCardsB: {
    id: 'twoCardsB',
    title: 'Two Cards (Banner)',
    type: 'two-cards-b',
    category: 'Content',
    description: 'Two cards with colored gradient banner headers and pill metrics',
    note: 'Two side-by-side cards with gradient banner header (icon + title), body text, bullet list, and pill-shaped metric at bottom. Use for any dual-category content.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the two items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row two-cards-b">
      <div class="card">
        <div class="card-banner">
          <span class="banner-icon">[Icon]</span>
          <h3>[Card 1 Title]</h3>
        </div>
        <div class="card-body">
          <p>[Card 1 description - main point and supporting details]</p>
          <ul class="card-list">
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
          <div class="metric-pill">[Card 1 metric or highlight]</div>
        </div>
      </div>
      <div class="card">
        <div class="card-banner">
          <span class="banner-icon">[Icon]</span>
          <h3>[Card 2 Title]</h3>
        </div>
        <div class="card-body">
          <p>[Card 2 description - main point and supporting details]</p>
          <ul class="card-list">
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
          <div class="metric-pill">[Card 2 metric or highlight]</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Two Cards C — Left Stripe =====
  twoCardsC: {
    id: 'twoCardsC',
    title: 'Two Cards (Stripe)',
    type: 'two-cards-c',
    category: 'Content',
    description: 'Two cards with thick left border stripe and square icon badge',
    note: 'Two side-by-side cards with vertical left stripe accent, square icon badge, roman numeral labels, bullet list, and dark pill metric. Use for any dual-category content.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the two items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row two-cards-c">
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-square">[Icon]</div>
          <div class="card-num">I</div>
        </div>
        <h3>[Card 1 Title]</h3>
        <p>[Card 1 description - main point and supporting details]</p>
        <ul class="card-list">
          <li>[Key point 1]</li>
          <li>[Key point 2]</li>
          <li>[Key point 3]</li>
        </ul>
        <div class="metric-pill">[Card 1 metric or highlight]</div>
      </div>
      <div class="card">
        <div class="card-header-row">
          <div class="card-icon-square">[Icon]</div>
          <div class="card-num">II</div>
        </div>
        <h3>[Card 2 Title]</h3>
        <p>[Card 2 description - main point and supporting details]</p>
        <ul class="card-list">
          <li>[Key point 1]</li>
          <li>[Key point 2]</li>
          <li>[Key point 3]</li>
        </ul>
        <div class="metric-pill">[Card 2 metric or highlight]</div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Three Cards B — Minimal Flat =====
  threeCardsB: {
    id: 'threeCardsB',
    title: 'Three Cards (Minimal)',
    type: 'three-cards-b',
    category: 'Content',
    description: 'Three flat sections separated by divider lines with burgundy numbered indicators',
    note: 'Three borderless sections separated by thin divider lines. Each has a burgundy number badge, title, body text, and bottom metric. Clean and spacious.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the three items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row three-cards-b">
      <div class="card">
        <div class="card-num">01</div>
        <h3>[Card 1 Title]</h3>
        <p>[Card 1 description - main point]</p>
        <p>[Card 1 supporting detail]</p>
        <div class="impact-box">[Card 1 metric or highlight]</div>
      </div>
      <div class="card">
        <div class="card-num">02</div>
        <h3>[Card 2 Title]</h3>
        <p>[Card 2 description - main point]</p>
        <p>[Card 2 supporting detail]</p>
        <div class="impact-box">[Card 2 metric or highlight]</div>
      </div>
      <div class="card">
        <div class="card-num">03</div>
        <h3>[Card 3 Title]</h3>
        <p>[Card 3 description - main point]</p>
        <p>[Card 3 supporting detail]</p>
        <div class="impact-box">[Card 3 metric or highlight]</div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Three Cards C — Dark Header =====
  threeCardsC: {
    id: 'threeCardsC',
    title: 'Three Cards (Dark Header)',
    type: 'three-cards-c',
    category: 'Content',
    description: 'Three cards with dark colored header blocks and per-card accent colors',
    note: 'Three cards each with a dark colored header (icon + title + watermark number), light body section, and accent-colored metric box. Each card has a distinct color theme.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the three items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row three-cards-c">
      <div class="card">
        <div class="card-dark-header">
          <span class="header-icon">[Icon]</span>
          <h3>[Card 1 Title]</h3>
          <span class="header-num">01</span>
        </div>
        <div class="card-body">
          <p>[Card 1 description - main point]</p>
          <p>[Card 1 supporting detail]</p>
          <div class="impact-box">[Card 1 metric or highlight]</div>
        </div>
      </div>
      <div class="card">
        <div class="card-dark-header">
          <span class="header-icon">[Icon]</span>
          <h3>[Card 2 Title]</h3>
          <span class="header-num">02</span>
        </div>
        <div class="card-body">
          <p>[Card 2 description - main point]</p>
          <p>[Card 2 supporting detail]</p>
          <div class="impact-box">[Card 2 metric or highlight]</div>
        </div>
      </div>
      <div class="card">
        <div class="card-dark-header">
          <span class="header-icon">[Icon]</span>
          <h3>[Card 3 Title]</h3>
          <span class="header-num">03</span>
        </div>
        <div class="card-body">
          <p>[Card 3 description - main point]</p>
          <p>[Card 3 supporting detail]</p>
          <div class="impact-box">[Card 3 metric or highlight]</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Four Cards B — Icon Top =====
  fourCardsB: {
    id: 'fourCardsB',
    title: 'Four Cards (Icon Top)',
    type: 'four-cards-b',
    category: 'Content',
    description: 'Four cards with centered icon badge on pastel backgrounds',
    note: 'Four compact cards each with a unique pastel background, centered icon badge, title, description, and tag-style label at bottom. Clean and colorful.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the four items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row four-cards-b">
      <div class="card">
        <div class="icon-badge">[Icon]</div>
        <h3>[Card 1 Title]</h3>
        <p>[Card 1 description]</p>
        <div class="tag-label">[Card 1 tag]</div>
      </div>
      <div class="card">
        <div class="icon-badge">[Icon]</div>
        <h3>[Card 2 Title]</h3>
        <p>[Card 2 description]</p>
        <div class="tag-label">[Card 2 tag]</div>
      </div>
      <div class="card">
        <div class="icon-badge">[Icon]</div>
        <h3>[Card 3 Title]</h3>
        <p>[Card 3 description]</p>
        <div class="tag-label">[Card 3 tag]</div>
      </div>
      <div class="card">
        <div class="icon-badge">[Icon]</div>
        <h3>[Card 4 Title]</h3>
        <p>[Card 4 description]</p>
        <div class="tag-label">[Card 4 tag]</div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Four Cards C — Horizontal Rows =====
  fourCardsC: {
    id: 'fourCardsC',
    title: 'Four Cards (Rows)',
    type: 'four-cards-c',
    category: 'Content',
    description: 'Four horizontal bar-style cards stacked vertically with colored pip accents',
    note: 'Four horizontal rows stacked vertically, each with a colored pip, icon, title + description, and metric badge on the right. Compact data-dense layout.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the four items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row four-cards-c">
      <div class="card-bar">
        <div class="bar-pip"></div>
        <span class="bar-icon">[Icon]</span>
        <div class="bar-content">
          <h3>[Card 1 Title]</h3>
          <p>[Card 1 description]</p>
        </div>
        <div class="bar-metric">[Metric 1]</div>
      </div>
      <div class="card-bar">
        <div class="bar-pip"></div>
        <span class="bar-icon">[Icon]</span>
        <div class="bar-content">
          <h3>[Card 2 Title]</h3>
          <p>[Card 2 description]</p>
        </div>
        <div class="bar-metric">[Metric 2]</div>
      </div>
      <div class="card-bar">
        <div class="bar-pip"></div>
        <span class="bar-icon">[Icon]</span>
        <div class="bar-content">
          <h3>[Card 3 Title]</h3>
          <p>[Card 3 description]</p>
        </div>
        <div class="bar-metric">[Metric 3]</div>
      </div>
      <div class="card-bar">
        <div class="bar-pip"></div>
        <span class="bar-icon">[Icon]</span>
        <div class="bar-content">
          <h3>[Card 4 Title]</h3>
          <p>[Card 4 description]</p>
        </div>
        <div class="bar-metric">[Metric 4]</div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Two Cards D — Numbered Block =====
  twoCardsD: {
    id: 'twoCardsD',
    title: 'Two Cards (Block)',
    type: 'two-cards-d',
    category: 'Content',
    description: 'Two cards with burgundy numbered block header and bulleted content',
    note: 'Two side-by-side cards. Each has a solid burgundy header bar with number + title, then bulleted content below. Clean and structured — no icons needed.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the two items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row two-cards-d">
      <div class="card">
        <div class="block-header"><span class="block-num">01</span><h3>[Card 1 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <div class="block-header"><span class="block-num">02</span><h3>[Card 2 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Two Cards E — Horizontal Rows =====
  twoCardsE: {
    id: 'twoCardsE',
    title: 'Two Cards (Rows)',
    type: 'two-cards-e',
    category: 'Content',
    description: 'Two full-width horizontal rows stacked vertically with large number and content',
    note: 'Two stacked full-width rows. Each has a large burgundy number on the left, title + description on the right. Horizontal reading flow — ideal for sequential or prioritized items.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the two items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row two-cards-e">
      <div class="card-stripe">
        <div class="stripe-num">01</div>
        <div class="stripe-content">
          <h3>[Item 1 Title]</h3>
          <p>[Item 1 description — key details and supporting context]</p>
        </div>
      </div>
      <div class="card-stripe">
        <div class="stripe-num">02</div>
        <div class="stripe-content">
          <h3>[Item 2 Title]</h3>
          <p>[Item 2 description — key details and supporting context]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Three Cards D — Numbered Block =====
  threeCardsD: {
    id: 'threeCardsD',
    title: 'Three Cards (Block)',
    type: 'three-cards-d',
    category: 'Content',
    description: 'Three cards with burgundy numbered block header and bulleted content',
    note: 'Three side-by-side cards. Each has a solid burgundy header bar with number + title, then bulleted content below. Clean and structured — no icons needed.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the three items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row three-cards-d">
      <div class="card">
        <div class="block-header"><span class="block-num">01</span><h3>[Card 1 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <div class="block-header"><span class="block-num">02</span><h3>[Card 2 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <div class="block-header"><span class="block-num">03</span><h3>[Card 3 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
            <li>[Key point 3]</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Three Cards E — Horizontal Rows =====
  threeCardsE: {
    id: 'threeCardsE',
    title: 'Three Cards (Rows)',
    type: 'three-cards-e',
    category: 'Content',
    description: 'Three full-width horizontal rows stacked vertically with large number and content',
    note: 'Three stacked full-width rows. Each has a large burgundy number on the left, title + description on the right. Horizontal reading flow — ideal for sequential or prioritized items.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the three items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row three-cards-e">
      <div class="card-stripe">
        <div class="stripe-num">01</div>
        <div class="stripe-content">
          <h3>[Item 1 Title]</h3>
          <p>[Item 1 description — key details and supporting context]</p>
        </div>
      </div>
      <div class="card-stripe">
        <div class="stripe-num">02</div>
        <div class="stripe-content">
          <h3>[Item 2 Title]</h3>
          <p>[Item 2 description — key details and supporting context]</p>
        </div>
      </div>
      <div class="card-stripe">
        <div class="stripe-num">03</div>
        <div class="stripe-content">
          <h3>[Item 3 Title]</h3>
          <p>[Item 3 description — key details and supporting context]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Four Cards D — Numbered Block =====
  fourCardsD: {
    id: 'fourCardsD',
    title: 'Four Cards (Block)',
    type: 'four-cards-d',
    category: 'Content',
    description: 'Four cards with burgundy numbered block header and bulleted content',
    note: 'Four side-by-side cards. Each has a solid burgundy header bar with number + title, then bulleted content below. Clean and structured — no icons needed.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the four items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row four-cards-d">
      <div class="card compact">
        <div class="block-header"><span class="block-num">01</span><h3>[Card 1 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
          </ul>
        </div>
      </div>
      <div class="card compact">
        <div class="block-header"><span class="block-num">02</span><h3>[Card 2 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
          </ul>
        </div>
      </div>
      <div class="card compact">
        <div class="block-header"><span class="block-num">03</span><h3>[Card 3 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
          </ul>
        </div>
      </div>
      <div class="card compact">
        <div class="block-header"><span class="block-num">04</span><h3>[Card 4 Title]</h3></div>
        <div class="block-body">
          <ul>
            <li>[Key point 1]</li>
            <li>[Key point 2]</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== CARD VARIANT: Four Cards E — Horizontal Rows =====
  fourCardsE: {
    id: 'fourCardsE',
    title: 'Four Cards (Rows)',
    type: 'four-cards-e',
    category: 'Content',
    description: 'Four full-width horizontal rows stacked vertically with large number and content',
    note: 'Four stacked full-width rows. Each has a large burgundy number on the left, title + description on the right. Compact horizontal reading flow.',
    master: 'standard',
    thumbnail: 'cards',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading that summarizes the four items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="card-row four-cards-e">
      <div class="card-stripe">
        <div class="stripe-num">01</div>
        <div class="stripe-content">
          <h3>[Item 1 Title]</h3>
          <p>[Item 1 description]</p>
        </div>
      </div>
      <div class="card-stripe">
        <div class="stripe-num">02</div>
        <div class="stripe-content">
          <h3>[Item 2 Title]</h3>
          <p>[Item 2 description]</p>
        </div>
      </div>
      <div class="card-stripe">
        <div class="stripe-num">03</div>
        <div class="stripe-content">
          <h3>[Item 3 Title]</h3>
          <p>[Item 3 description]</p>
        </div>
      </div>
      <div class="card-stripe">
        <div class="stripe-num">04</div>
        <div class="stripe-content">
          <h3>[Item 4 Title]</h3>
          <p>[Item 4 description]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== HORIZONTAL ROW VARIANTS =====

  // ===== Numbered Rows A — Circle numbers with ruled lines =====
  numberedRows: {
    id: 'numberedRows',
    title: 'Numbered Rows',
    type: 'numbered-rows',
    category: 'Content',
    description: 'Numbered rows with circle markers and ruled separators',
    note: 'Stacked horizontal rows separated by ruled lines. Each row has a burgundy circle number, bold title inline, and description. Clean and scannable — ideal for ordered lists, steps, or ranked items.',
    master: 'standard',
    thumbnail: 'list',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the listed items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="num-rows">
      <div class="num-row-item">
        <div class="num-circle">1</div>
        <div class="num-row-content">
          <h4>[Item 1 Title]</h4>
          <p>[Item 1 description — key details and context]</p>
        </div>
      </div>
      <div class="num-row-item">
        <div class="num-circle">2</div>
        <div class="num-row-content">
          <h4>[Item 2 Title]</h4>
          <p>[Item 2 description — key details and context]</p>
        </div>
      </div>
      <div class="num-row-item">
        <div class="num-circle">3</div>
        <div class="num-row-content">
          <h4>[Item 3 Title]</h4>
          <p>[Item 3 description — key details and context]</p>
        </div>
      </div>
      <div class="num-row-item">
        <div class="num-circle">4</div>
        <div class="num-row-content">
          <h4>[Item 4 Title]</h4>
          <p>[Item 4 description — key details and context]</p>
        </div>
      </div>
      <div class="num-row-item">
        <div class="num-circle">5</div>
        <div class="num-row-content">
          <h4>[Item 5 Title]</h4>
          <p>[Item 5 description — key details and context]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== Numbered Rows B — Alternating bands =====
  numberedRowsB: {
    id: 'numberedRowsB',
    title: 'Numbered Rows (Bands)',
    type: 'numbered-rows-b',
    category: 'Content',
    description: 'Numbered rows with alternating shaded backgrounds',
    note: 'Stacked rows with alternating grey/white backgrounds. Each row has a large bold number, title, and description. Easy to scan — ideal for prioritized lists, action items, or findings.',
    master: 'standard',
    thumbnail: 'list',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the listed items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="num-rows-b">
      <div class="num-band">
        <div class="band-num">01</div>
        <div class="band-content">
          <h4>[Item 1 Title]</h4>
          <p>[Item 1 description — brief supporting detail]</p>
        </div>
      </div>
      <div class="num-band">
        <div class="band-num">02</div>
        <div class="band-content">
          <h4>[Item 2 Title]</h4>
          <p>[Item 2 description — brief supporting detail]</p>
        </div>
      </div>
      <div class="num-band">
        <div class="band-num">03</div>
        <div class="band-content">
          <h4>[Item 3 Title]</h4>
          <p>[Item 3 description — brief supporting detail]</p>
        </div>
      </div>
      <div class="num-band">
        <div class="band-num">04</div>
        <div class="band-content">
          <h4>[Item 4 Title]</h4>
          <p>[Item 4 description — brief supporting detail]</p>
        </div>
      </div>
      <div class="num-band">
        <div class="band-num">05</div>
        <div class="band-content">
          <h4>[Item 5 Title]</h4>
          <p>[Item 5 description — brief supporting detail]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  // ===== Numbered Rows C — Compact with left accent =====
  numberedRowsC: {
    id: 'numberedRowsC',
    title: 'Numbered Rows (Accent)',
    type: 'numbered-rows-c',
    category: 'Content',
    description: 'Compact numbered rows with left burgundy accent bar',
    note: 'Compact rows with a small burgundy left accent, large serif number, and right-aligned content. Elegant and dense — ideal for findings, recommendations, or key takeaways.',
    master: 'standard',
    thumbnail: 'list',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the listed items]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="num-rows-c">
      <div class="num-accent-row">
        <div class="accent-num">01</div>
        <div class="accent-content">
          <h4>[Item 1 Title]</h4>
          <p>[Item 1 description]</p>
        </div>
      </div>
      <div class="num-accent-row">
        <div class="accent-num">02</div>
        <div class="accent-content">
          <h4>[Item 2 Title]</h4>
          <p>[Item 2 description]</p>
        </div>
      </div>
      <div class="num-accent-row">
        <div class="accent-num">03</div>
        <div class="accent-content">
          <h4>[Item 3 Title]</h4>
          <p>[Item 3 description]</p>
        </div>
      </div>
      <div class="num-accent-row">
        <div class="accent-num">04</div>
        <div class="accent-content">
          <h4>[Item 4 Title]</h4>
          <p>[Item 4 description]</p>
        </div>
      </div>
      <div class="num-accent-row">
        <div class="accent-num">05</div>
        <div class="accent-content">
          <h4>[Item 5 Title]</h4>
          <p>[Item 5 description]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer"><span>[Company]</span><span>1 / 1</span></footer>
</div>`,
  },

  keyFinding: {
    id: 'keyFinding',
    title: 'Key Finding',
    type: 'keyFinding',
    master: 'standard',
    description: 'Key finding with supporting evidence and metrics',
    note: 'Clean layout for presenting a main finding or recommendation with 3 supporting evidence points and optional metrics. Use for key insights, recommendations, or conclusions.',
    thumbnail: 'keyFinding',
    category: 'Emphasis',
    html: `<div class="slide master-standard">
  <h1 class="title">[Context for the key finding]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="key-finding-layout">
      <div class="finding-main">
        <h2>[The main finding or recommendation statement]</h2>
        <p>[Brief supporting context]</p>
      </div>
      <div class="finding-evidence">
        <div class="evidence-item">
          <span class="evidence-num">1</span>
          <h4>[Evidence Point 1]</h4>
          <p>[Supporting detail or data]</p>
        </div>
        <div class="evidence-item">
          <span class="evidence-num">2</span>
          <h4>[Evidence Point 2]</h4>
          <p>[Supporting detail or data]</p>
        </div>
        <div class="evidence-item">
          <span class="evidence-num">3</span>
          <h4>[Evidence Point 3]</h4>
          <p>[Supporting detail or data]</p>
        </div>
      </div>
      <div class="finding-metrics">
        <div class="finding-metric">
          <span class="metric-value">[Value 1]</span>
          <span class="metric-label">[Label 1]</span>
        </div>
        <div class="finding-metric">
          <span class="metric-value">[Value 2]</span>
          <span class="metric-label">[Label 2]</span>
        </div>
        <div class="finding-metric">
          <span class="metric-value">[Value 3]</span>
          <span class="metric-label">[Label 3]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  metricDashboard: {
    id: 'metricDashboard',
    title: 'Metric Dashboard',
    type: 'dashboard',
    master: 'standard',
    description: 'Six KPI blocks in a dashboard layout for comprehensive metrics view',
    note: 'Dashboard-style layout with 6 metric blocks (2x3 grid). Use for performance dashboards, quarterly results, operational metrics, or multi-KPI summaries.',
    thumbnail: 'dashboard',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the metrics]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="dashboard-grid">
      <div class="dashboard-metric">
        <div class="metric-icon">[Icon 1]</div>
        <div class="metric-value">[Value 1]</div>
        <div class="metric-label">[Label 1]</div>
        <div class="metric-trend positive">[Trend 1]</div>
      </div>
      <div class="dashboard-metric">
        <div class="metric-icon">[Icon 2]</div>
        <div class="metric-value">[Value 2]</div>
        <div class="metric-label">[Label 2]</div>
        <div class="metric-trend positive">[Trend 2]</div>
      </div>
      <div class="dashboard-metric">
        <div class="metric-icon">[Icon 3]</div>
        <div class="metric-value">[Value 3]</div>
        <div class="metric-label">[Label 3]</div>
        <div class="metric-trend negative">[Trend 3]</div>
      </div>
      <div class="dashboard-metric">
        <div class="metric-icon">[Icon 4]</div>
        <div class="metric-value">[Value 4]</div>
        <div class="metric-label">[Label 4]</div>
        <div class="metric-trend positive">[Trend 4]</div>
      </div>
      <div class="dashboard-metric">
        <div class="metric-icon">[Icon 5]</div>
        <div class="metric-value">[Value 5]</div>
        <div class="metric-label">[Label 5]</div>
        <div class="metric-trend neutral">[Trend 5]</div>
      </div>
      <div class="dashboard-metric">
        <div class="metric-icon">[Icon 6]</div>
        <div class="metric-value">[Value 6]</div>
        <div class="metric-label">[Label 6]</div>
        <div class="metric-trend positive">[Trend 6]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE',green:'2E7D32',redNeg:'C62828'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const metrics = [
    {icon:'[Icon]', value:'[Value 1]', label:'[Label 1]', trend:'+12%', trendColor:c.green},
    {icon:'[Icon]', value:'[Value 2]', label:'[Label 2]', trend:'+8%', trendColor:c.green},
    {icon:'[Icon]', value:'[Value 3]', label:'[Label 3]', trend:'-3%', trendColor:c.redNeg},
    {icon:'[Icon]', value:'[Value 4]', label:'[Label 4]', trend:'+15%', trendColor:c.green},
    {icon:'[Icon]', value:'[Value 5]', label:'[Label 5]', trend:'0%', trendColor:c.meta},
    {icon:'[Icon]', value:'[Value 6]', label:'[Label 6]', trend:'+5%', trendColor:c.green}
  ];
  const startX = 0.48, startY = 1.9, cellW = 4.0, cellH = 2.35, gapX = 0.18, gapY = 0.18;
  metrics.forEach((m, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = startX + col * (cellW + gapX), y = startY + row * (cellH + gapY);
    slide.addShape('roundRect', {x:x, y:y, w:cellW, h:cellH, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.05});
    slide.addShape('rect', {x:x, y:y, w:cellW, h:0.06, fill:{color:c.maroon}});
    slide.addText(m.icon, {x:x + 0.2, y:y + 0.2, w:0.5, h:0.5, fontSize:18, color:c.maroon, align:'center'});
    slide.addText(m.value, {x:x + 0.2, y:y + 0.7, w:cellW - 0.4, h:0.7, fontFace:'Georgia', fontSize:32, color:c.maroon, bold:true});
    slide.addText(m.label, {x:x + 0.2, y:y + 1.4, w:cellW - 0.4, h:0.4, fontFace:'Arial', fontSize:12, color:c.meta});
    slide.addText(m.trend, {x:x + 0.2, y:y + 1.85, w:cellW - 0.4, h:0.35, fontFace:'Arial', fontSize:11, color:m.trendColor, bold:true});
  });
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  caseStudy: {
    id: 'caseStudy',
    title: 'Sidebar + Grid Panel',
    type: 'case-study',
    master: 'standard',
    description: 'Left sidebar with overview context, right side 2x2 grid with four sections',
    note: 'Left sidebar panel with summary context (icon, title, description, metadata), and a 2x2 grid on the right for four related sections. Use when content has one overview item + 4 detail categories.',
    thumbnail: 'case',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Client or project name]</h1>
  <h2 class="subtitle">[Industry or context]</h2>
  <div class="frame">
    <div class="case-study-layout">
      <div class="case-overview">
        <h4>[Overview]</h4>
        <p>[Brief background on the client, their industry, and the engagement scope. Provide enough context so the reader understands why this project mattered.]</p>
        <div class="case-meta">
          <div class="case-meta-item">
            <span class="case-meta-label">[Industry]</span>
            <span class="case-meta-value">[Financial Services]</span>
          </div>
          <div class="case-meta-item">
            <span class="case-meta-label">[Timeline]</span>
            <span class="case-meta-value">[Q1 – Q3 2024]</span>
          </div>
          <div class="case-meta-item">
            <span class="case-meta-label">[Scope]</span>
            <span class="case-meta-value">[Enterprise-wide]</span>
          </div>
        </div>
      </div>
      <div class="case-grid">
        <div class="case-card challenge">
          <h4>[Challenge]</h4>
          <p>[Description of the problem or pain point the client faced]</p>
          <ul>
            <li>[Challenge point 1]</li>
            <li>[Challenge point 2]</li>
          </ul>
        </div>
        <div class="case-card solution">
          <h4>[Solution]</h4>
          <p>[Description of the approach and methodology applied]</p>
          <ul>
            <li>[Solution point 1]</li>
            <li>[Solution point 2]</li>
          </ul>
        </div>
        <div class="case-card results">
          <h4>[Results]</h4>
          <div class="case-results-row">
            <div class="case-result">
              <span class="case-result-value">[+45%]</span>
              <span class="case-result-label">[Metric 1]</span>
            </div>
            <div class="case-result">
              <span class="case-result-value">[–30%]</span>
              <span class="case-result-label">[Metric 2]</span>
            </div>
          </div>
        </div>
        <div class="case-card impact">
          <h4>[Impact]</h4>
          <p>[Longer-term business impact, strategic value, or client testimonial summarizing the outcome]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE',accent:'A32020'};
  slide.addText("[Client or project name]", {x:0.48, y:0.42, w:12.36, h:0.6, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Industry or context]", {x:0.48, y:1.10, w:12.36, h:0.35, fontFace:'Arial', fontSize:16, color:c.red, bold:true});
  // Overview panel (left)
  const oy = 1.60, ow = 4.2, oh = 5.1;
  slide.addShape('roundRect', {x:0.48, y:oy, w:ow, h:oh, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.04});
  slide.addText("Overview", {x:0.72, y:oy+0.15, w:ow-0.5, h:0.3, fontFace:'Arial', fontSize:12, color:c.main, bold:true});
  slide.addText("[Brief background on the client, their industry, and the engagement scope.]", {x:0.72, y:oy+0.55, w:ow-0.5, h:1.2, fontFace:'Arial', fontSize:10, color:c.secondary, valign:'top'});
  const metaItems = [{lbl:'Industry',val:'[Financial Services]'},{lbl:'Timeline',val:'[Q1 – Q3 2024]'},{lbl:'Scope',val:'[Enterprise-wide]'}];
  metaItems.forEach((m, i) => {
    const my = oy + 2.0 + i * 0.7;
    slide.addText(m.lbl, {x:0.72, y:my, w:ow-0.5, h:0.22, fontFace:'Arial', fontSize:8, color:c.meta, bold:true});
    slide.addText(m.val, {x:0.72, y:my+0.22, w:ow-0.5, h:0.28, fontFace:'Arial', fontSize:11, color:c.main});
  });
  // 2x2 grid (right)
  const gx = 4.88, gw = 3.93, gh = 2.45, gg = 0.20;
  const cards = [
    {label:'Challenge', y:oy, x:gx},
    {label:'Solution', y:oy, x:gx+gw+gg},
    {label:'Results', y:oy+gh+gg, x:gx},
    {label:'Impact', y:oy+gh+gg, x:gx+gw+gg}
  ];
  cards.forEach(cd => {
    slide.addShape('roundRect', {x:cd.x, y:cd.y, w:gw, h:gh, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.04});
    slide.addText(cd.label, {x:cd.x+0.2, y:cd.y+0.15, w:gw-0.4, h:0.3, fontFace:'Arial', fontSize:11, color:c.accent, bold:true});
    slide.addText("[Content]", {x:cd.x+0.2, y:cd.y+0.55, w:gw-0.4, h:gh-0.75, fontFace:'Arial', fontSize:10, color:c.secondary, valign:'top'});
  });
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  checklist: {
    id: 'checklist',
    title: 'Checklist',
    type: 'checklist',
    master: 'standard',
    description: 'Organized checklist with checkboxes and status indicators',
    note: 'Checklist with checkboxes organized in sections. Use for requirements, deliverables, action items, audit criteria, or completion tracking.',
    thumbnail: 'checklist',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the checklist]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="checklist-layout">
      <div class="checklist-column">
        <h4>[Section 1 Title]</h4>
        <div class="check-item complete">
          <span class="check-box">✓</span>
          <span class="check-text">[Item 1]</span>
        </div>
        <div class="check-item complete">
          <span class="check-box">✓</span>
          <span class="check-text">[Item 2]</span>
        </div>
        <div class="check-item pending">
          <span class="check-box">○</span>
          <span class="check-text">[Item 3]</span>
        </div>
        <div class="check-item pending">
          <span class="check-box">○</span>
          <span class="check-text">[Item 4]</span>
        </div>
      </div>
      <div class="checklist-column">
        <h4>[Section 2 Title]</h4>
        <div class="check-item complete">
          <span class="check-box">✓</span>
          <span class="check-text">[Item 5]</span>
        </div>
        <div class="check-item pending">
          <span class="check-box">○</span>
          <span class="check-text">[Item 6]</span>
        </div>
        <div class="check-item pending">
          <span class="check-box">○</span>
          <span class="check-text">[Item 7]</span>
        </div>
        <div class="check-item blocked">
          <span class="check-box">✗</span>
          <span class="check-text">[Item 8 - blocked]</span>
        </div>
      </div>
      <div class="checklist-summary">
        <div class="summary-stat">
          <span class="stat-num">[X]</span>
          <span class="stat-label">Completed</span>
        </div>
        <div class="summary-stat">
          <span class="stat-num">[Y]</span>
          <span class="stat-label">Pending</span>
        </div>
        <div class="summary-stat">
          <span class="stat-num">[Z]</span>
          <span class="stat-label">Blocked</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57',border:'E6E9EE',green:'2E7D32',orange:'F57C00'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const cols = [
    {title:'[Section 1]', items:[{text:'[Item 1]',done:true},{text:'[Item 2]',done:true},{text:'[Item 3]',done:false},{text:'[Item 4]',done:false}]},
    {title:'[Section 2]', items:[{text:'[Item 5]',done:true},{text:'[Item 6]',done:false},{text:'[Item 7]',done:false},{text:'[Item 8]',blocked:true}]}
  ];
  const colW = 5.9, startY = 1.9, startX = 0.48, gap = 0.35;
  cols.forEach((col, ci) => {
    const x = startX + ci * (colW + gap);
    slide.addText(col.title, {x:x, y:startY, w:colW, h:0.4, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
    col.items.forEach((item, ii) => {
      const y = startY + 0.5 + ii * 0.55;
      const checkColor = item.done ? c.green : (item.blocked ? c.red : c.meta);
      const checkChar = item.done ? '✓' : (item.blocked ? '✗' : '○');
      slide.addShape('roundRect', {x:x, y:y, w:colW, h:0.5, fill:{color:'FAFAFA'}, line:{color:c.border, width:0.5}, rectRadius:0.03});
      slide.addText(checkChar, {x:x + 0.1, y:y + 0.05, w:0.4, h:0.4, fontFace:'Arial', fontSize:14, color:checkColor, bold:true});
      slide.addText(item.text, {x:x + 0.55, y:y + 0.1, w:colW - 0.7, h:0.35, fontFace:'Arial', fontSize:11, color:item.blocked ? c.meta : c.secondary});
    });
  });
  const summaryY = startY + 3.0;
  slide.addShape('roundRect', {x:0.48, y:summaryY, w:12.36, h:0.8, fill:{color:c.zone1}, line:{color:c.border, width:1}, rectRadius:0.05});
  const stats = [{num:'3', label:'Completed', color:c.green},{num:'4', label:'Pending', color:c.orange},{num:'1', label:'Blocked', color:c.red}];
  stats.forEach((s, i) => {
    slide.addText(s.num, {x:1.5 + i * 4, y:summaryY + 0.1, w:1, h:0.4, fontFace:'Georgia', fontSize:24, color:s.color, bold:true});
    slide.addText(s.label, {x:2.5 + i * 4, y:summaryY + 0.2, w:2, h:0.4, fontFace:'Arial', fontSize:12, color:c.meta});
  });
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  sectionDivider: {
    id: 'sectionDivider',
    title: 'Section Divider',
    type: 'divider',
    master: 'blank',
    description: 'Bold section break with accent bar and large title',
    note: 'Impactful section divider with left accent bar, large number, and prominent title. Use between major sections to create clear visual breaks and signal topic transitions. This is a full-bleed slide — do NOT add a title or subtitle element.',
    thumbnail: 'divider',
    category: 'Opening',
    html: `<div class="slide master-blank section-divider-slide">
  <div class="section-divider-content">
    <div class="section-divider-accent"></div>
    <div class="section-divider-main">
      <div class="section-divider-number">[01]</div>
      <div class="section-divider-title">[Section Title]</div>
      <div class="section-divider-subtitle">[What this section covers]</div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function render(pptx, slideData, slideNum, totalSlides, helpers) {
  const { addFooter, COLORS, parseHTML } = helpers;
  const slide = pptx.addSlide({ masterName: 'BLANK_SLIDE' });

  // White background (matches HTML section divider)
  slide.addShape('rect', {x:0, y:0, w:13.333, h:7.5, fill:{color:'FFFFFF'}});

  // Left accent bar (24px → ~0.33 inches, maroon gradient)
  slide.addShape('rect', {x:0, y:0, w:0.33, h:7.5, fill:{color: COLORS.maroon}});

  // Extract content from HTML
  let sectionNum = '01';
  let sectionTitle = 'Section Title';
  let sectionSubtitle = '';

  if (slideData && slideData.html) {
    const { getText } = parseHTML(slideData.html);
    sectionNum = getText('.section-divider-number') || getText('.divider-number') || '01';
    sectionTitle = getText('.section-divider-title') || getText('.divider-title') || getText('.cover-title') || 'Section Title';
    sectionSubtitle = getText('.section-divider-subtitle') || getText('.divider-subtitle') || '';
  }

  // Large watermark number (120px → ~60pt, faded)
  slide.addText(sectionNum, {
    x: 0.83, y: 0.69, w: 8, h: 2,
    fontFace: 'Georgia', fontSize: 80, color: COLORS.zone2,
    bold: true, valign: 'top'
  });

  // Section title (48px → ~36pt, bold)
  slide.addText(sectionTitle, {
    x: 1.1, y: 2.5, w: 10, h: 1.5,
    fontFace: 'Georgia', fontSize: 36, color: COLORS.main,
    bold: true, valign: 'top'
  });

  // Section subtitle (20px → ~16pt)
  if (sectionSubtitle) {
    slide.addText(sectionSubtitle, {
      x: 1.1, y: 4.0, w: 9.5, h: 0.8,
      fontFace: 'Arial', fontSize: 16, color: COLORS.meta,
      valign: 'top'
    });
  }

  addFooter(slide, slideNum, totalSlides);
}`,
  },

  strategyQuadrant: {
    id: 'strategyQuadrant',
    title: 'Quad Grid (Center Focus)',
    type: 'strategyQuadrant',
    master: 'standard',
    description: 'Four quadrants arranged around a central circle element',
    note: 'Four sections arranged in a 2x2 grid with a central circle overlay. Center circle text must be 4 words max. Use when content has exactly 4 categories that relate to a central concept or theme.',
    thumbnail: 'quadrant',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Strategic Framework Title]</h1>
  <h2 class="subtitle">[Framework context or description]</h2>
  <div class="frame">
    <div class="quadrant-container">
      <div class="quadrant q1">
        <h4>[Quadrant 1]</h4>
        <p>[Top-left strategy or category]</p>
      </div>
      <div class="quadrant q2">
        <h4>[Quadrant 2]</h4>
        <p>[Top-right strategy or category]</p>
      </div>
      <div class="quadrant q3">
        <h4>[Quadrant 3]</h4>
        <p>[Bottom-left strategy or category]</p>
      </div>
      <div class="quadrant q4">
        <h4>[Quadrant 4]</h4>
        <p>[Bottom-right strategy or category]</p>
      </div>
      <div class="quadrant-center">
        <span>[Core Focus]</span>
      </div>
      <span class="quadrant-axis top">[Y-Axis High]</span>
      <span class="quadrant-axis bottom">[Y-Axis Low]</span>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  funnel: {
    id: 'funnel',
    title: 'Funnel',
    type: 'funnel',
    master: 'standard',
    description: 'Sales or conversion funnel visualization with stages',
    note: 'Five-stage funnel showing conversion flow. Use for sales funnels, customer journeys, conversion analysis, or any narrowing process.',
    thumbnail: 'funnel',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the funnel]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="funnel-container">
      <div class="funnel-stage stage-1">
        <div class="stage-bar"></div>
        <div class="stage-content">
          <span class="stage-value">[Value 1]</span>
          <span class="stage-label">[Stage 1 Label]</span>
        </div>
        <div class="stage-conversion">[Conv %]</div>
      </div>
      <div class="funnel-stage stage-2">
        <div class="stage-bar"></div>
        <div class="stage-content">
          <span class="stage-value">[Value 2]</span>
          <span class="stage-label">[Stage 2 Label]</span>
        </div>
        <div class="stage-conversion">[Conv %]</div>
      </div>
      <div class="funnel-stage stage-3">
        <div class="stage-bar"></div>
        <div class="stage-content">
          <span class="stage-value">[Value 3]</span>
          <span class="stage-label">[Stage 3 Label]</span>
        </div>
        <div class="stage-conversion">[Conv %]</div>
      </div>
      <div class="funnel-stage stage-4">
        <div class="stage-bar"></div>
        <div class="stage-content">
          <span class="stage-value">[Value 4]</span>
          <span class="stage-label">[Stage 4 Label]</span>
        </div>
        <div class="stage-conversion">[Conv %]</div>
      </div>
      <div class="funnel-stage stage-5">
        <div class="stage-bar"></div>
        <div class="stage-content">
          <span class="stage-value">[Value 5]</span>
          <span class="stage-label">[Stage 5 Label]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',maroon:'8E1E1E',zone1:'F7F9FB',meta:'4A4F57'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const stages = [
    {value:'[100K]', label:'[Awareness]', width:10.0, conv:'→ 40%'},
    {value:'[40K]', label:'[Interest]', width:8.0, conv:'→ 50%'},
    {value:'[20K]', label:'[Consideration]', width:6.0, conv:'→ 60%'},
    {value:'[12K]', label:'[Intent]', width:4.5, conv:'→ 75%'},
    {value:'[9K]', label:'[Purchase]', width:3.0, conv:''}
  ];
  const centerX = 5.5, startY = 1.9, stageH = 0.9, gap = 0.08;
  stages.forEach((s, i) => {
    const y = startY + i * (stageH + gap);
    const x = centerX - s.width / 2;
    const color = ['8E1E1E','A32020','B83030','C84040','D85050'][i];
    slide.addShape('roundRect', {x:x, y:y, w:s.width, h:stageH, fill:{color:color}, rectRadius:0.03});
    slide.addText(s.value, {x:x + 0.3, y:y + 0.15, w:2, h:0.6, fontFace:'Georgia', fontSize:22, color:'FFFFFF', bold:true});
    slide.addText(s.label, {x:x + 2.5, y:y + 0.25, w:s.width - 3, h:0.5, fontFace:'Arial', fontSize:13, color:'FFFFFF'});
    if (s.conv) {
      slide.addText(s.conv, {x:centerX + s.width/2 + 0.3, y:y + 0.25, w:1.5, h:0.5, fontFace:'Arial', fontSize:11, color:c.meta});
    }
  });
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  riskMatrix: {
    id: 'riskMatrix',
    title: '3x3 Matrix Grid',
    type: 'risk-matrix',
    master: 'standard',
    description: '3x3 color-coded matrix with labeled axes and 9 cells',
    note: '3x3 grid with 9 cells color-coded by intensity (green/yellow/red). Has labeled row and column axes. Use for any two-axis categorization where items fall into 9 priority/severity/intensity buckets.',
    thumbnail: 'matrix',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Main heading about the assessment]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="risk-matrix-container">
      <div class="matrix-y-label">[Y-Axis Label]</div>
      <div class="risk-matrix">
        <div class="matrix-row">
          <div class="matrix-cell high-risk">[High-High Risk]</div>
          <div class="matrix-cell high-risk">[Med-High Risk]</div>
          <div class="matrix-cell medium-risk">[Low-High Risk]</div>
        </div>
        <div class="matrix-row">
          <div class="matrix-cell high-risk">[High-Med Risk]</div>
          <div class="matrix-cell medium-risk">[Med-Med Risk]</div>
          <div class="matrix-cell low-risk">[Low-Med Risk]</div>
        </div>
        <div class="matrix-row">
          <div class="matrix-cell medium-risk">[High-Low Risk]</div>
          <div class="matrix-cell low-risk">[Med-Low Risk]</div>
          <div class="matrix-cell low-risk">[Low-Low Risk]</div>
        </div>
      </div>
      <div class="matrix-x-label">[X-Axis Label]</div>
      <div class="matrix-legend">
        <span class="legend-item high">High Risk</span>
        <span class="legend-item medium">Medium Risk</span>
        <span class="legend-item low">Low Risk</span>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',secondary:'222222',red:'A32020',meta:'4A4F57',highRisk:'FFCDD2',medRisk:'FFF9C4',lowRisk:'C8E6C9'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  const cells = [
    [{text:'[Risk 1]',c:c.highRisk},{text:'[Risk 2]',c:c.highRisk},{text:'[Risk 3]',c:c.medRisk}],
    [{text:'[Risk 4]',c:c.highRisk},{text:'[Risk 5]',c:c.medRisk},{text:'[Risk 6]',c:c.lowRisk}],
    [{text:'[Risk 7]',c:c.medRisk},{text:'[Risk 8]',c:c.lowRisk},{text:'[Risk 9]',c:c.lowRisk}]
  ];
  const startX = 1.8, startY = 2.0, cellW = 3.2, cellH = 1.4, gap = 0.08;
  cells.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const x = startX + ci * (cellW + gap), y = startY + ri * (cellH + gap);
      slide.addShape('roundRect', {x:x, y:y, w:cellW, h:cellH, fill:{color:cell.c}, line:{color:'E0E0E0', width:1}, rectRadius:0.05});
      slide.addText(cell.text, {x:x, y:y, w:cellW, h:cellH, fontFace:'Arial', fontSize:11, color:c.main, align:'center', valign:'middle'});
    });
  });
  slide.addText('[Y-Axis]', {x:0.5, y:3.2, w:1, h:2, fontFace:'Arial', fontSize:12, color:c.meta, rotate:270, align:'center'});
  slide.addText('[X-Axis]', {x:startX, y:startY + 3 * (cellH + gap) + 0.2, w:3 * (cellW + gap), h:0.4, fontFace:'Arial', fontSize:12, color:c.meta, align:'center'});
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  bigNumber: {
    id: 'bigNumber',
    title: 'Big Number',
    type: 'big-number',
    master: 'titleOnly',
    description: 'Single dramatic statistic with maximum visual impact',
    note: 'Full-slide focus on one massive number. Use for headline statistics, shocking data points, or key metrics that need maximum emphasis.',
    thumbnail: 'bignum',
    category: 'Data & Metrics',
    html: `<div class="slide master-titleOnly big-number-slide">
  <h1 class="title">[Main heading - context]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <div class="big-number-container">
      <div class="big-number-prefix">[Prefix like $ or +]</div>
      <div class="big-number-value">[Number]</div>
      <div class="big-number-suffix">[Suffix like M, B, %]</div>
      <div class="big-number-label">[What this number represents]</div>
      <div class="big-number-context">[Additional context or comparison]</div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
    pptxRendererCode: `function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111',red:'A32020',maroon:'8E1E1E',meta:'4A4F57'};
  slide.addText("[Main heading]", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main, valign:'top'});
  slide.addText("[Subtitle]", {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.red, bold:true});
  slide.addText("$", {x:2.5, y:2.5, w:1.5, h:1.5, fontFace:'Georgia', fontSize:60, color:c.maroon, align:'right'});
  slide.addText("[47]", {x:4.0, y:2.0, w:5.5, h:2.0, fontFace:'Georgia', fontSize:120, color:c.maroon, bold:true, align:'center'});
  slide.addText("B", {x:9.3, y:2.5, w:1.5, h:1.5, fontFace:'Georgia', fontSize:60, color:c.maroon});
  slide.addText("[What this number represents]", {x:0.48, y:4.3, w:12.36, h:0.6, fontFace:'Arial', fontSize:24, color:c.main, align:'center'});
  slide.addText("[Additional context or comparison]", {x:0.48, y:5.0, w:12.36, h:0.5, fontFace:'Arial', fontSize:16, color:c.meta, align:'center'});
  slide.addText('[Company]', {x:0.48, y:7.05, w:2, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta});
  slide.addText(slideNum + ' / ' + totalSlides, {x:11.5, y:7.05, w:1.3, h:0.25, fontFace:'Arial', fontSize:10, color:c.meta, align:'right'});
}`,
  },

  // ============================================
  // ORGANIZATIONAL STRUCTURE TEMPLATES
  // ============================================

  orgExecutive: {
    id: 'orgExecutive',
    title: 'Executive Org Chart',
    type: 'org',
    master: 'standard',
    description: 'Clean executive leadership chart with CEO and C-suite',
    note: 'Simple 2-layer executive org chart. CEO at top with direct reports (C-suite). Use for leadership introductions, board presentations, or investor decks.',
    thumbnail: 'org',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Executive Leadership Team]</h1>
  <h2 class="subtitle">[Organization Structure]</h2>
  <div class="frame">
    <div class="org-chart org-executive">
      <!-- CEO -->
      <div class="org-level org-level-1">
        <div class="org-card org-ceo">
          <div class="org-avatar">👤</div>
          <div class="org-info">
            <div class="org-name">[CEO Name]</div>
            <div class="org-title">Chief Executive Officer</div>
          </div>
        </div>
      </div>
      <!-- Connector line -->
      <div class="org-connector org-connector-down"></div>
      <div class="org-connector org-connector-horizontal"></div>
      <!-- C-Suite -->
      <div class="org-level org-level-2">
        <div class="org-card">
          <div class="org-avatar">👤</div>
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">CFO</div>
          </div>
        </div>
        <div class="org-card">
          <div class="org-avatar">👤</div>
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">COO</div>
          </div>
        </div>
        <div class="org-card">
          <div class="org-avatar">👤</div>
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">CTO</div>
          </div>
        </div>
        <div class="org-card">
          <div class="org-avatar">👤</div>
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">CMO</div>
          </div>
        </div>
        <div class="org-card">
          <div class="org-avatar">👤</div>
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">CHRO</div>
          </div>
        </div>
      </div>
      <!-- Key Direct Reports -->
      <div class="org-connector org-connector-down"></div>
      <div class="org-connector org-connector-horizontal"></div>
      <div class="org-level org-level-3">
        <div class="org-card org-card-sm">
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">VP Finance</div>
          </div>
        </div>
        <div class="org-card org-card-sm">
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">VP Operations</div>
          </div>
        </div>
        <div class="org-card org-card-sm">
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">VP Engineering</div>
          </div>
        </div>
        <div class="org-card org-card-sm">
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">VP Product</div>
          </div>
        </div>
        <div class="org-card org-card-sm">
          <div class="org-info">
            <div class="org-name">[Name]</div>
            <div class="org-title">VP Sales</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  orgCorporate: {
    id: 'orgCorporate',
    title: 'Corporate Org Chart',
    type: 'org',
    master: 'standard',
    description: 'Full 3-layer corporate hierarchy with departments',
    note: 'Comprehensive 3-layer org chart showing CEO, VPs, and Directors/Managers. Use for company overviews, restructuring presentations, or onboarding materials.',
    thumbnail: 'org',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Corporate Structure]</h1>
  <h2 class="subtitle">[Organizational Hierarchy]</h2>
  <div class="frame">
    <div class="org-chart org-corporate">
    <!-- Level 1: CEO -->
    <div class="org-level org-level-1">
      <div class="org-card org-card-sm org-ceo">
        <div class="org-name">[CEO Name]</div>
        <div class="org-title">CEO</div>
      </div>
    </div>

    <div class="org-connector org-connector-tree"></div>

    <!-- Level 2: VPs -->
    <div class="org-level org-level-2">
      <div class="org-branch">
        <div class="org-card org-card-sm org-vp">
          <div class="org-name">[VP Name]</div>
          <div class="org-title">VP Engineering</div>
        </div>
        <div class="org-reports">
          <div class="org-card org-card-xs">[Director 1]</div>
          <div class="org-card org-card-xs">[Director 2]</div>
          <div class="org-card org-card-xs">[Director 3]</div>
        </div>
      </div>

      <div class="org-branch">
        <div class="org-card org-card-sm org-vp">
          <div class="org-name">[VP Name]</div>
          <div class="org-title">VP Sales</div>
        </div>
        <div class="org-reports">
          <div class="org-card org-card-xs">[Director 1]</div>
          <div class="org-card org-card-xs">[Director 2]</div>
        </div>
      </div>

      <div class="org-branch">
        <div class="org-card org-card-sm org-vp">
          <div class="org-name">[VP Name]</div>
          <div class="org-title">VP Product</div>
        </div>
        <div class="org-reports">
          <div class="org-card org-card-xs">[Director 1]</div>
          <div class="org-card org-card-xs">[Director 2]</div>
        </div>
      </div>

      <div class="org-branch">
        <div class="org-card org-card-sm org-vp">
          <div class="org-name">[VP Name]</div>
          <div class="org-title">VP Operations</div>
        </div>
        <div class="org-reports">
          <div class="org-card org-card-xs">[Director 1]</div>
          <div class="org-card org-card-xs">[Director 2]</div>
          <div class="org-card org-card-xs">[Director 3]</div>
        </div>
      </div>
    </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  orgDepartment: {
    id: 'orgDepartment',
    title: 'Department Structure',
    type: 'org',
    master: 'standard',
    description: 'Single department deep-dive with roles and responsibilities',
    note: 'Detailed view of one department/function showing team structure with role descriptions. Use for team introductions, hiring plans, or departmental overviews.',
    thumbnail: 'org',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Engineering Department]</h1>
  <h2 class="subtitle">[Team Structure & Responsibilities]</h2>
  <div class="frame">
    <div class="org-department">
    <!-- Department Head -->
    <div class="dept-head">
      <div class="dept-head-card">
        <div class="dept-avatar">👤</div>
        <div class="dept-info">
          <div class="dept-name">[Department Head Name]</div>
          <div class="dept-title">VP of Engineering</div>
          <div class="dept-desc">[Strategic direction, team growth, technical vision]</div>
        </div>
        <div class="dept-metrics">
          <div class="metric"><span class="metric-num">[45]</span> Team Size</div>
          <div class="metric"><span class="metric-num">[6]</span> Teams</div>
        </div>
      </div>
    </div>

    <!-- Teams Grid -->
    <div class="dept-teams">
      <div class="dept-team">
        <div class="team-header">[Frontend Team]</div>
        <div class="team-lead">
          <span class="lead-icon">◆</span>
          <span>[Lead Name] - Tech Lead</span>
        </div>
        <div class="team-desc">[UI/UX implementation, React, performance optimization]</div>
        <div class="team-size">[8 engineers]</div>
      </div>

      <div class="dept-team">
        <div class="team-header">[Backend Team]</div>
        <div class="team-lead">
          <span class="lead-icon">◆</span>
          <span>[Lead Name] - Tech Lead</span>
        </div>
        <div class="team-desc">[APIs, microservices, database architecture, scalability]</div>
        <div class="team-size">[12 engineers]</div>
      </div>

      <div class="dept-team">
        <div class="team-header">[Platform Team]</div>
        <div class="team-lead">
          <span class="lead-icon">◆</span>
          <span>[Lead Name] - Tech Lead</span>
        </div>
        <div class="team-desc">[Infrastructure, DevOps, CI/CD, cloud architecture]</div>
        <div class="team-size">[6 engineers]</div>
      </div>

      <div class="dept-team">
        <div class="team-header">[Data Team]</div>
        <div class="team-lead">
          <span class="lead-icon">◆</span>
          <span>[Lead Name] - Tech Lead</span>
        </div>
        <div class="team-desc">[Data pipelines, analytics, ML infrastructure]</div>
        <div class="team-size">[5 engineers]</div>
      </div>
    </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  orgMatrix: {
    id: 'orgMatrix',
    title: 'Matrix Organization',
    type: 'org',
    master: 'standard',
    description: 'Matrix structure showing dual reporting lines',
    note: 'Matrix org showing functional and project/product reporting. Use for cross-functional teams, consulting organizations, or hybrid structures.',
    thumbnail: 'org',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Matrix Organization]</h1>
  <h2 class="subtitle">[Functional & Project Reporting Structure]</h2>
  <div class="frame">
    <div class="org-matrix">
    <!-- Functional Leaders (horizontal) -->
    <div class="matrix-header">
      <div class="matrix-corner"></div>
      <div class="matrix-func-head">[Engineering]</div>
      <div class="matrix-func-head">[Design]</div>
      <div class="matrix-func-head">[Marketing]</div>
      <div class="matrix-func-head">[Sales]</div>
    </div>

    <!-- Project rows -->
    <div class="matrix-row">
      <div class="matrix-proj-head">
        <div class="proj-name">[Project Alpha]</div>
        <div class="proj-lead">PM: [Name]</div>
      </div>
      <div class="matrix-cell matrix-cell-filled">
        <span class="cell-count">[3]</span>
        <span class="cell-role">engineers</span>
      </div>
      <div class="matrix-cell matrix-cell-filled">
        <span class="cell-count">[1]</span>
        <span class="cell-role">designer</span>
      </div>
      <div class="matrix-cell matrix-cell-light">
        <span class="cell-count">[1]</span>
        <span class="cell-role">marketer</span>
      </div>
      <div class="matrix-cell"></div>
    </div>

    <div class="matrix-row">
      <div class="matrix-proj-head">
        <div class="proj-name">[Project Beta]</div>
        <div class="proj-lead">PM: [Name]</div>
      </div>
      <div class="matrix-cell matrix-cell-filled">
        <span class="cell-count">[5]</span>
        <span class="cell-role">engineers</span>
      </div>
      <div class="matrix-cell matrix-cell-filled">
        <span class="cell-count">[2]</span>
        <span class="cell-role">designers</span>
      </div>
      <div class="matrix-cell matrix-cell-filled">
        <span class="cell-count">[2]</span>
        <span class="cell-role">marketers</span>
      </div>
      <div class="matrix-cell matrix-cell-light">
        <span class="cell-count">[1]</span>
        <span class="cell-role">sales</span>
      </div>
    </div>

    <div class="matrix-row">
      <div class="matrix-proj-head">
        <div class="proj-name">[Project Gamma]</div>
        <div class="proj-lead">PM: [Name]</div>
      </div>
      <div class="matrix-cell matrix-cell-light">
        <span class="cell-count">[2]</span>
        <span class="cell-role">engineers</span>
      </div>
      <div class="matrix-cell matrix-cell-filled">
        <span class="cell-count">[1]</span>
        <span class="cell-role">designer</span>
      </div>
      <div class="matrix-cell matrix-cell-filled">
        <span class="cell-count">[3]</span>
        <span class="cell-role">marketers</span>
      </div>
      <div class="matrix-cell matrix-cell-filled">
        <span class="cell-count">[2]</span>
        <span class="cell-role">sales</span>
      </div>
    </div>

    <!-- Legend -->
    <div class="matrix-legend">
      <div class="legend-item"><span class="legend-box legend-filled"></span> Primary allocation</div>
      <div class="legend-item"><span class="legend-box legend-light"></span> Supporting role</div>
    </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  orgFlat: {
    id: 'orgFlat',
    title: 'Flat Team Structure',
    type: 'org',
    master: 'standard',
    description: 'Horizontal team layout for agile/flat organizations',
    note: 'Flat org structure with team lead and equal-level members. Use for startup teams, agile squads, or collaborative structures.',
    thumbnail: 'org',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Product Team]</h1>
  <h2 class="subtitle">[Flat Structure - Collaborative Team]</h2>
  <div class="frame">
    <div class="org-flat">
    <!-- Team Lead (center focus, but not hierarchical) -->
    <div class="flat-lead">
      <div class="flat-lead-card">
        <div class="flat-avatar flat-avatar-lg">👤</div>
        <div class="flat-name">[Team Lead Name]</div>
        <div class="flat-role">Team Lead</div>
        <div class="flat-focus">[Coordination, strategy, stakeholder management]</div>
      </div>
    </div>

    <!-- Team Members (horizontal) -->
    <div class="flat-members">
      <div class="flat-member">
        <div class="flat-avatar">👤</div>
        <div class="flat-name">[Name]</div>
        <div class="flat-role">Senior Engineer</div>
        <div class="flat-focus">[Backend, APIs]</div>
      </div>

      <div class="flat-member">
        <div class="flat-avatar">👤</div>
        <div class="flat-name">[Name]</div>
        <div class="flat-role">Engineer</div>
        <div class="flat-focus">[Frontend, React]</div>
      </div>

      <div class="flat-member">
        <div class="flat-avatar">👤</div>
        <div class="flat-name">[Name]</div>
        <div class="flat-role">Designer</div>
        <div class="flat-focus">[UX, Prototypes]</div>
      </div>

      <div class="flat-member">
        <div class="flat-avatar">👤</div>
        <div class="flat-name">[Name]</div>
        <div class="flat-role">Product Manager</div>
        <div class="flat-focus">[Roadmap, Users]</div>
      </div>

      <div class="flat-member">
        <div class="flat-avatar">👤</div>
        <div class="flat-name">[Name]</div>
        <div class="flat-role">QA Engineer</div>
        <div class="flat-focus">[Testing, Quality]</div>
      </div>

      <div class="flat-member">
        <div class="flat-avatar">👤</div>
        <div class="flat-name">[Name]</div>
        <div class="flat-role">Data Analyst</div>
        <div class="flat-focus">[Metrics, Insights]</div>
      </div>
    </div>

    <div class="flat-tagline">[Collaborative • Autonomous • Cross-functional]</div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  orgHierarchyLarge: {
    id: 'orgHierarchyLarge',
    title: 'Large Hierarchy Chart',
    type: 'org',
    master: 'standard',
    description: 'Complex 3-layer org with many positions and dotted lines',
    note: 'Dense org chart with 15+ boxes showing full reporting structure. Use for comprehensive company overviews, HR documentation, or detailed restructuring plans.',
    thumbnail: 'org',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Company Organization]</h1>
  <h2 class="subtitle">[Full Reporting Structure]</h2>
  <div class="frame">
    <div class="org-hierarchy-large">
    <!-- Level 1 -->
    <div class="hier-level hier-level-1">
      <div class="hier-box hier-box-exec">
        <div class="hier-name">[CEO Name]</div>
        <div class="hier-title">Chief Executive Officer</div>
      </div>
    </div>

    <!-- Level 2 -->
    <div class="hier-level hier-level-2">
      <div class="hier-box hier-box-csuite">
        <div class="hier-name">[Name]</div>
        <div class="hier-title">CFO</div>
      </div>
      <div class="hier-box hier-box-csuite">
        <div class="hier-name">[Name]</div>
        <div class="hier-title">COO</div>
      </div>
      <div class="hier-box hier-box-csuite">
        <div class="hier-name">[Name]</div>
        <div class="hier-title">CTO</div>
      </div>
      <div class="hier-box hier-box-csuite">
        <div class="hier-name">[Name]</div>
        <div class="hier-title">CMO</div>
      </div>
      <div class="hier-box hier-box-csuite">
        <div class="hier-name">[Name]</div>
        <div class="hier-title">CHRO</div>
      </div>
    </div>

    <!-- Level 3 -->
    <div class="hier-level hier-level-3">
      <div class="hier-group">
        <div class="hier-group-label">Finance</div>
        <div class="hier-box hier-box-director">[Controller]</div>
        <div class="hier-box hier-box-director">[FP&A Dir]</div>
      </div>
      <div class="hier-group">
        <div class="hier-group-label">Operations</div>
        <div class="hier-box hier-box-director">[Ops Dir]</div>
        <div class="hier-box hier-box-director">[Supply Dir]</div>
        <div class="hier-box hier-box-director">[Quality Dir]</div>
      </div>
      <div class="hier-group">
        <div class="hier-group-label">Technology</div>
        <div class="hier-box hier-box-director">[Eng Dir]</div>
        <div class="hier-box hier-box-director">[Product Dir]</div>
        <div class="hier-box hier-box-director">[Data Dir]</div>
      </div>
      <div class="hier-group">
        <div class="hier-group-label">Marketing</div>
        <div class="hier-box hier-box-director">[Brand Dir]</div>
        <div class="hier-box hier-box-director">[Growth Dir]</div>
      </div>
      <div class="hier-group">
        <div class="hier-group-label">People</div>
        <div class="hier-box hier-box-director">[Talent Dir]</div>
        <div class="hier-box hier-box-director">[HR Ops Dir]</div>
      </div>
    </div>

    <!-- Headcount summary -->
    <div class="hier-summary">
      <div class="hier-stat"><span class="stat-num">[250]</span> Total Employees</div>
      <div class="hier-stat"><span class="stat-num">[5]</span> C-Suite</div>
      <div class="hier-stat"><span class="stat-num">[14]</span> Directors</div>
      <div class="hier-stat"><span class="stat-num">[45]</span> Managers</div>
    </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  orgFunctional: {
    id: 'orgFunctional',
    title: 'Functional Breakdown',
    type: 'org',
    master: 'standard',
    description: 'One function with detailed role descriptions and KPIs',
    note: 'Single function deep-dive with role descriptions, responsibilities, and metrics. Use for department presentations, hiring justifications, or capability assessments.',
    thumbnail: 'org',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Sales Organization]</h1>
  <h2 class="subtitle">[Roles, Responsibilities & Metrics]</h2>
  <div class="frame">
    <div class="org-functional">
    <!-- Function Header -->
    <div class="func-header">
      <div class="func-leader">
        <div class="func-leader-title">VP of Sales</div>
        <div class="func-leader-name">[Leader Name]</div>
      </div>
      <div class="func-kpis">
        <div class="func-kpi">
          <div class="kpi-value">$[12M]</div>
          <div class="kpi-label">ARR Target</div>
        </div>
        <div class="func-kpi">
          <div class="kpi-value">[32]</div>
          <div class="kpi-label">Team Size</div>
        </div>
        <div class="func-kpi">
          <div class="kpi-value">[85%]</div>
          <div class="kpi-label">Quota Attain</div>
        </div>
      </div>
    </div>

    <!-- Roles Grid -->
    <div class="func-roles">
      <div class="func-role">
        <div class="role-header">
          <span class="role-icon">◆</span>
          <span class="role-title">Enterprise AEs</span>
          <span class="role-count">[8]</span>
        </div>
        <div class="role-desc">[Close $100K+ deals with Fortune 500 accounts]</div>
        <div class="role-metrics">
          <span>Quota: $[1.5M]</span>
          <span>Avg Deal: $[180K]</span>
        </div>
      </div>

      <div class="func-role">
        <div class="role-header">
          <span class="role-icon">◆</span>
          <span class="role-title">Mid-Market AEs</span>
          <span class="role-count">[12]</span>
        </div>
        <div class="role-desc">[Own the full sales cycle for $25K-$100K deals]</div>
        <div class="role-metrics">
          <span>Quota: $[800K]</span>
          <span>Avg Deal: $[45K]</span>
        </div>
      </div>

      <div class="func-role">
        <div class="role-header">
          <span class="role-icon">◆</span>
          <span class="role-title">SDRs/BDRs</span>
          <span class="role-count">[8]</span>
        </div>
        <div class="role-desc">[Prospect, qualify leads, book meetings for AEs]</div>
        <div class="role-metrics">
          <span>Meetings/mo: [40]</span>
          <span>SQL Rate: [25%]</span>
        </div>
      </div>

      <div class="func-role">
        <div class="role-header">
          <span class="role-icon">◆</span>
          <span class="role-title">Sales Engineers</span>
          <span class="role-count">[4]</span>
        </div>
        <div class="role-desc">[Technical demos, POCs, solution architecture]</div>
        <div class="role-metrics">
          <span>Demos/mo: [25]</span>
          <span>POC Win: [70%]</span>
        </div>
      </div>
    </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // ===== RACI & GOVERNANCE TEMPLATES =====

  raciMatrix: {
    id: 'raciMatrix',
    title: 'RACI Matrix',
    type: 'raci',
    master: 'standard',
    description: 'Responsibility assignment matrix showing roles and accountability',
    note: 'RACI chart mapping activities to roles. R=Responsible, A=Accountable, C=Consulted, I=Informed. Use for process ownership, project governance, or role clarity.',
    thumbnail: 'raci',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[RACI Matrix - Process/Project Name]</h1>
  <h2 class="subtitle">[Roles & Responsibilities]</h2>
  <div class="frame">
    <div class="raci-matrix">
      <table class="raci-table">
        <thead>
          <tr>
            <th class="raci-activity-header">Activity / Task</th>
            <th class="raci-role-header">[Role 1]</th>
            <th class="raci-role-header">[Role 2]</th>
            <th class="raci-role-header">[Role 3]</th>
            <th class="raci-role-header">[Role 4]</th>
            <th class="raci-role-header">[Role 5]</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="raci-activity">[Activity 1]</td>
            <td class="raci-cell raci-r">R</td>
            <td class="raci-cell raci-a">A</td>
            <td class="raci-cell raci-c">C</td>
            <td class="raci-cell raci-i">I</td>
            <td class="raci-cell"></td>
          </tr>
          <tr>
            <td class="raci-activity">[Activity 2]</td>
            <td class="raci-cell raci-c">C</td>
            <td class="raci-cell raci-r">R</td>
            <td class="raci-cell raci-a">A</td>
            <td class="raci-cell"></td>
            <td class="raci-cell raci-i">I</td>
          </tr>
          <tr>
            <td class="raci-activity">[Activity 3]</td>
            <td class="raci-cell raci-a">A</td>
            <td class="raci-cell raci-c">C</td>
            <td class="raci-cell raci-r">R</td>
            <td class="raci-cell raci-c">C</td>
            <td class="raci-cell"></td>
          </tr>
          <tr>
            <td class="raci-activity">[Activity 4]</td>
            <td class="raci-cell raci-i">I</td>
            <td class="raci-cell raci-a">A</td>
            <td class="raci-cell raci-c">C</td>
            <td class="raci-cell raci-r">R</td>
            <td class="raci-cell raci-c">C</td>
          </tr>
          <tr>
            <td class="raci-activity">[Activity 5]</td>
            <td class="raci-cell raci-r">R</td>
            <td class="raci-cell raci-i">I</td>
            <td class="raci-cell raci-a">A</td>
            <td class="raci-cell raci-c">C</td>
            <td class="raci-cell raci-r">R</td>
          </tr>
          <tr>
            <td class="raci-activity">[Activity 6]</td>
            <td class="raci-cell raci-c">C</td>
            <td class="raci-cell raci-r">R</td>
            <td class="raci-cell raci-i">I</td>
            <td class="raci-cell raci-a">A</td>
            <td class="raci-cell"></td>
          </tr>
        </tbody>
      </table>
      <div class="raci-legend">
        <div class="legend-item"><span class="legend-box raci-r-bg">R</span>Responsible</div>
        <div class="legend-item"><span class="legend-box raci-a-bg">A</span>Accountable</div>
        <div class="legend-item"><span class="legend-box raci-c-bg">C</span>Consulted</div>
        <div class="legend-item"><span class="legend-box raci-i-bg">I</span>Informed</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  governanceStructure: {
    id: 'governanceStructure',
    title: 'Governance Structure',
    type: 'governance',
    master: 'standard',
    description: 'Multi-tier governance framework with committees and decision rights',
    note: 'Layered governance showing steering committee, working groups, and reporting. Use for program governance, IT governance, or corporate oversight frameworks.',
    thumbnail: 'governance',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Governance Structure]</h1>
  <h2 class="subtitle">[Decision-Making Framework]</h2>
  <div class="frame">
    <div class="governance-structure">
      <!-- Top Level: Steering Committee -->
      <div class="gov-level gov-level-1">
        <div class="gov-box gov-steering">
          <div class="gov-icon">⚙️</div>
          <div class="gov-info">
            <div class="gov-name">[Steering Committee]</div>
            <div class="gov-desc">Strategic direction, major decisions, resource allocation</div>
            <div class="gov-meta">Meets: [Monthly] | Chair: [Executive Sponsor]</div>
          </div>
        </div>
      </div>

      <!-- Connector -->
      <div class="gov-connector">
        <div class="gov-line-v"></div>
      </div>

      <!-- Level 2: Working Groups -->
      <div class="gov-level gov-level-2">
        <div class="gov-box gov-workgroup">
          <div class="gov-icon">👥</div>
          <div class="gov-info">
            <div class="gov-name">[Business WG]</div>
            <div class="gov-desc">Requirements, change requests</div>
          </div>
        </div>
        <div class="gov-box gov-workgroup">
          <div class="gov-icon">💻</div>
          <div class="gov-info">
            <div class="gov-name">[Technical WG]</div>
            <div class="gov-desc">Architecture, integration</div>
          </div>
        </div>
        <div class="gov-box gov-workgroup">
          <div class="gov-icon">🔒</div>
          <div class="gov-info">
            <div class="gov-name">[Risk & Compliance]</div>
            <div class="gov-desc">Security, audit, controls</div>
          </div>
        </div>
      </div>

      <!-- Level 3: Project Teams -->
      <div class="gov-connector">
        <div class="gov-line-v"></div>
      </div>
      <div class="gov-level gov-level-3">
        <div class="gov-box gov-team">[Project Team 1]</div>
        <div class="gov-box gov-team">[Project Team 2]</div>
        <div class="gov-box gov-team">[Project Team 3]</div>
        <div class="gov-box gov-team">[Project Team 4]</div>
        <div class="gov-box gov-team">[Project Team 5]</div>
      </div>
      <!-- Reporting Cadence -->
      <div class="gov-cadence">
        <div class="gov-cadence-item"><span class="cadence-freq">[Weekly]</span> Status Reports</div>
        <div class="gov-cadence-item"><span class="cadence-freq">[Bi-weekly]</span> Working Group Reviews</div>
        <div class="gov-cadence-item"><span class="cadence-freq">[Monthly]</span> Steering Committee</div>
        <div class="gov-cadence-item"><span class="cadence-freq">[Quarterly]</span> Board Update</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  decisionRights: {
    id: 'decisionRights',
    title: 'Decision Rights Matrix',
    type: 'governance',
    master: 'standard',
    description: 'Matrix showing who decides, approves, and implements key decisions',
    note: 'Decision authority matrix mapping decision types to stakeholders. Use for governance clarity, empowerment frameworks, or delegation of authority.',
    thumbnail: 'governance',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Decision Rights Matrix]</h1>
  <h2 class="subtitle">[Authority & Escalation Framework]</h2>
  <div class="frame">
    <div class="decision-rights">
      <table class="decision-table">
        <thead>
          <tr>
            <th class="decision-type-header">Decision Type</th>
            <th class="decision-role-header">[Decider]</th>
            <th class="decision-role-header">[Approver]</th>
            <th class="decision-role-header">[Input From]</th>
            <th class="decision-threshold">Threshold</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="decision-type">[Strategic Initiatives]</td>
            <td class="decision-cell decision-decide">CEO</td>
            <td class="decision-cell decision-approve">Board</td>
            <td class="decision-cell decision-input">C-Suite</td>
            <td class="decision-cell">&gt;$1M</td>
          </tr>
          <tr>
            <td class="decision-type">[Budget Allocation]</td>
            <td class="decision-cell decision-decide">CFO</td>
            <td class="decision-cell decision-approve">CEO</td>
            <td class="decision-cell decision-input">Dept Heads</td>
            <td class="decision-cell">&gt;$500K</td>
          </tr>
          <tr>
            <td class="decision-type">[Hiring - Sr. Level]</td>
            <td class="decision-cell decision-decide">VP</td>
            <td class="decision-cell decision-approve">CHRO</td>
            <td class="decision-cell decision-input">Team</td>
            <td class="decision-cell">Director+</td>
          </tr>
          <tr>
            <td class="decision-type">[Process Changes]</td>
            <td class="decision-cell decision-decide">Process Owner</td>
            <td class="decision-cell decision-approve">VP</td>
            <td class="decision-cell decision-input">Stakeholders</td>
            <td class="decision-cell">Any</td>
          </tr>
          <tr>
            <td class="decision-type">[Vendor Selection]</td>
            <td class="decision-cell decision-decide">Procurement</td>
            <td class="decision-cell decision-approve">CFO</td>
            <td class="decision-cell decision-input">Dept Heads</td>
            <td class="decision-cell">&gt;$100K</td>
          </tr>
          <tr>
            <td class="decision-type">[Policy Updates]</td>
            <td class="decision-cell decision-decide">Legal</td>
            <td class="decision-cell decision-approve">CEO</td>
            <td class="decision-cell decision-input">Compliance</td>
            <td class="decision-cell">Material</td>
          </tr>
        </tbody>
      </table>
      <div class="decision-legend">
        <div class="legend-item"><span class="legend-dot decision-decide-bg"></span>Decision Authority</div>
        <div class="legend-item"><span class="legend-dot decision-approve-bg"></span>Approval Required</div>
        <div class="legend-item"><span class="legend-dot decision-input-bg"></span>Input/Consulted</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  operatingModel: {
    id: 'operatingModel',
    title: 'Operating Model Overview',
    type: 'operating-model',
    master: 'standard',
    description: 'High-level view of how the organization operates',
    note: 'Operating model canvas showing people, process, technology, and governance dimensions. Use for transformation planning, target state design, or organizational assessments.',
    thumbnail: 'operating',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Target Operating Model]</h1>
  <h2 class="subtitle">[How We Deliver Value]</h2>
  <div class="frame">
    <div class="operating-model">
      <div class="om-row om-row-top">
        <div class="om-pillar om-people">
          <div class="om-header"><span class="om-icon">👥</span><h3>People</h3></div>
          <ul class="om-list">
            <li>[Organizational structure]</li>
            <li>[Skills & capabilities]</li>
            <li>[Culture & behaviors]</li>
          </ul>
        </div>
        <div class="om-pillar om-process">
          <div class="om-header"><span class="om-icon">⚙️</span><h3>Process</h3></div>
          <ul class="om-list">
            <li>[Core processes]</li>
            <li>[Ways of working]</li>
            <li>[Performance metrics]</li>
          </ul>
        </div>
        <div class="om-pillar om-technology">
          <div class="om-header"><span class="om-icon">💻</span><h3>Technology</h3></div>
          <ul class="om-list">
            <li>[Systems & platforms]</li>
            <li>[Data & analytics]</li>
            <li>[Automation & AI]</li>
          </ul>
        </div>
      </div>
      <div class="om-row om-row-bottom">
        <div class="om-foundation om-governance">
          <div class="om-header"><span class="om-icon">🏛️</span><h3>Governance</h3></div>
          <div class="om-desc">[Decision rights, policies, compliance, risk management]</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  operatingModelDetailed: {
    id: 'operatingModelDetailed',
    title: 'Detailed Operating Model',
    type: 'operating-model',
    master: 'standard',
    description: 'Comprehensive operating model with all dimensions and layers',
    note: 'Detailed operating model showing strategy, capabilities, processes, and enablers. Use for deep-dive operating model design or transformation roadmaps.',
    thumbnail: 'operating',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Operating Model Blueprint]</h1>
  <h2 class="subtitle">[Comprehensive Framework]</h2>
  <div class="frame">
    <div class="om-detailed">
      <!-- Strategy Layer -->
      <div class="om-layer om-strategy">
        <div class="om-layer-label">Strategy</div>
        <div class="om-layer-content">
          <div class="om-item">[Mission & Vision]</div>
          <div class="om-item">[Strategic Priorities]</div>
          <div class="om-item">[Value Proposition]</div>
        </div>
      </div>

      <!-- Capabilities Layer -->
      <div class="om-layer om-capabilities">
        <div class="om-layer-label">Capabilities</div>
        <div class="om-layer-content">
          <div class="om-capability">
            <span class="cap-name">[Core Capability 1]</span>
            <span class="cap-level cap-strong">Strong</span>
          </div>
          <div class="om-capability">
            <span class="cap-name">[Core Capability 2]</span>
            <span class="cap-level cap-moderate">Build</span>
          </div>
          <div class="om-capability">
            <span class="cap-name">[Core Capability 3]</span>
            <span class="cap-level cap-strong">Strong</span>
          </div>
          <div class="om-capability">
            <span class="cap-name">[Core Capability 4]</span>
            <span class="cap-level cap-weak">Gap</span>
          </div>
        </div>
      </div>

      <!-- Process Layer -->
      <div class="om-layer om-processes">
        <div class="om-layer-label">Processes</div>
        <div class="om-layer-content">
          <div class="om-process-flow">
            <span class="process-box">[Input]</span>
            <span class="process-arrow">→</span>
            <span class="process-box">[Process 1]</span>
            <span class="process-arrow">→</span>
            <span class="process-box">[Process 2]</span>
            <span class="process-arrow">→</span>
            <span class="process-box">[Output]</span>
          </div>
        </div>
      </div>

      <!-- Enablers Layer -->
      <div class="om-layer om-enablers">
        <div class="om-layer-label">Enablers</div>
        <div class="om-layer-content">
          <div class="om-enabler"><span class="enabler-icon">👥</span>People & Org</div>
          <div class="om-enabler"><span class="enabler-icon">💻</span>Technology</div>
          <div class="om-enabler"><span class="enabler-icon">📊</span>Data</div>
          <div class="om-enabler"><span class="enabler-icon">🏛️</span>Governance</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  processMap: {
    id: 'processMap',
    title: 'Process Map',
    type: 'process',
    master: 'standard',
    description: 'End-to-end process flow with swim lanes',
    note: 'Swim lane process diagram showing activities by role/department. Use for process documentation, optimization analysis, or training materials.',
    thumbnail: 'process',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Process Name - End-to-End Flow]</h1>
  <h2 class="subtitle">[Process Documentation]</h2>
  <div class="frame">
    <div class="process-map">
      <!-- Swim Lane 1 -->
      <div class="swim-lane">
        <div class="lane-header">[Role/Dept 1]</div>
        <div class="lane-content">
          <div class="process-step-box step-start">[Start]</div>
          <div class="step-arrow">→</div>
          <div class="process-step-box">[Step 1]</div>
          <div class="step-arrow">→</div>
          <div class="process-step-box">[Step 2]</div>
        </div>
      </div>

      <!-- Swim Lane 2 -->
      <div class="swim-lane">
        <div class="lane-header">[Role/Dept 2]</div>
        <div class="lane-content">
          <div class="step-spacer"></div>
          <div class="step-spacer"></div>
          <div class="step-connector-down">↓</div>
          <div class="process-step-box step-decision">[Decision?]</div>
          <div class="step-arrow">→</div>
          <div class="process-step-box">[Step 3]</div>
        </div>
      </div>

      <!-- Swim Lane 3 -->
      <div class="swim-lane">
        <div class="lane-header">[Role/Dept 3]</div>
        <div class="lane-content">
          <div class="step-spacer"></div>
          <div class="step-spacer"></div>
          <div class="step-spacer"></div>
          <div class="step-spacer"></div>
          <div class="step-connector-down">↓</div>
          <div class="process-step-box">[Step 4]</div>
          <div class="step-arrow">→</div>
          <div class="process-step-box step-end">[End]</div>
        </div>
      </div>

      <!-- Legend -->
      <div class="process-legend">
        <div class="legend-item"><span class="legend-box step-start-bg"></span>Start/End</div>
        <div class="legend-item"><span class="legend-box step-process-bg"></span>Process Step</div>
        <div class="legend-item"><span class="legend-box step-decision-bg"></span>Decision</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  sipocDiagram: {
    id: 'sipocDiagram',
    title: 'SIPOC Diagram',
    type: 'process',
    master: 'standard',
    description: 'Supplier-Input-Process-Output-Customer process overview',
    note: 'SIPOC diagram for high-level process understanding. Use for process improvement initiatives, stakeholder alignment, or scope definition.',
    thumbnail: 'process',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[SIPOC - Process Name]</h1>
  <h2 class="subtitle">[High-Level Process Overview]</h2>
  <div class="frame">
    <div class="sipoc-diagram">
      <div class="sipoc-col sipoc-suppliers">
        <div class="sipoc-header">Suppliers</div>
        <ul class="sipoc-list">
          <li>[Supplier 1]</li>
          <li>[Supplier 2]</li>
          <li>[Supplier 3]</li>
        </ul>
      </div>
      <div class="sipoc-arrow">→</div>
      <div class="sipoc-col sipoc-inputs">
        <div class="sipoc-header">Inputs</div>
        <ul class="sipoc-list">
          <li>[Input 1]</li>
          <li>[Input 2]</li>
          <li>[Input 3]</li>
        </ul>
      </div>
      <div class="sipoc-arrow">→</div>
      <div class="sipoc-col sipoc-process">
        <div class="sipoc-header">Process</div>
        <div class="sipoc-process-flow">
          <div class="sipoc-step">[Step 1]</div>
          <div class="sipoc-step">[Step 2]</div>
          <div class="sipoc-step">[Step 3]</div>
          <div class="sipoc-step">[Step 4]</div>
        </div>
      </div>
      <div class="sipoc-arrow">→</div>
      <div class="sipoc-col sipoc-outputs">
        <div class="sipoc-header">Outputs</div>
        <ul class="sipoc-list">
          <li>[Output 1]</li>
          <li>[Output 2]</li>
          <li>[Output 3]</li>
        </ul>
      </div>
      <div class="sipoc-arrow">→</div>
      <div class="sipoc-col sipoc-customers">
        <div class="sipoc-header">Customers</div>
        <ul class="sipoc-list">
          <li>[Customer 1]</li>
          <li>[Customer 2]</li>
          <li>[Customer 3]</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  serviceCatalog: {
    id: 'serviceCatalog',
    title: 'Service Catalog',
    type: 'operating-model',
    master: 'standard',
    description: 'Catalog of services with descriptions and SLAs',
    note: 'Service catalog showing offerings, descriptions, and service levels. Use for shared services, IT service management, or internal service agreements.',
    thumbnail: 'service',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Service Catalog]</h1>
  <h2 class="subtitle">[Available Services & Service Levels]</h2>
  <div class="frame">
    <div class="service-catalog">
      <div class="service-card">
        <div class="service-header">
          <div class="service-icon">📋</div>
          <div class="service-title">[Service Name 1]</div>
          <div class="service-tier tier-gold">Gold</div>
        </div>
        <div class="service-desc">[Brief description of what this service provides]</div>
        <div class="service-sla">
          <span class="sla-item"><strong>SLA:</strong> [99.9%]</span>
          <span class="sla-item"><strong>Response:</strong> [4 hrs]</span>
        </div>
      </div>

      <div class="service-card">
        <div class="service-header">
          <div class="service-icon">⚙️</div>
          <div class="service-title">[Service Name 2]</div>
          <div class="service-tier tier-silver">Silver</div>
        </div>
        <div class="service-desc">[Brief description of what this service provides]</div>
        <div class="service-sla">
          <span class="sla-item"><strong>SLA:</strong> [99.5%]</span>
          <span class="sla-item"><strong>Response:</strong> [8 hrs]</span>
        </div>
      </div>

      <div class="service-card">
        <div class="service-header">
          <div class="service-icon">📊</div>
          <div class="service-title">[Service Name 3]</div>
          <div class="service-tier tier-gold">Gold</div>
        </div>
        <div class="service-desc">[Brief description of what this service provides]</div>
        <div class="service-sla">
          <span class="sla-item"><strong>SLA:</strong> [99.9%]</span>
          <span class="sla-item"><strong>Response:</strong> [2 hrs]</span>
        </div>
      </div>

      <div class="service-card">
        <div class="service-header">
          <div class="service-icon">🔧</div>
          <div class="service-title">[Service Name 4]</div>
          <div class="service-tier tier-bronze">Bronze</div>
        </div>
        <div class="service-desc">[Brief description of what this service provides]</div>
        <div class="service-sla">
          <span class="sla-item"><strong>SLA:</strong> [99%]</span>
          <span class="sla-item"><strong>Response:</strong> [24 hrs]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  capabilityMap: {
    id: 'capabilityMap',
    title: 'Capability Map',
    type: 'operating-model',
    master: 'standard',
    description: 'Business capability map with maturity assessment',
    note: 'Capability model showing business capabilities grouped by domain with maturity levels. Use for capability assessments, investment prioritization, or transformation planning.',
    thumbnail: 'capability',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Business Capability Map]</h1>
  <h2 class="subtitle">[Current State Assessment]</h2>
  <div class="frame">
    <div class="capability-map">
      <div class="cap-domain">
        <div class="domain-header">[Domain 1 - e.g., Customer Management]</div>
        <div class="domain-capabilities">
          <div class="cap-item cap-high"><span class="cap-name">[Customer Onboarding]</span></div>
          <div class="cap-item cap-high"><span class="cap-name">[Account Management]</span></div>
          <div class="cap-item cap-medium"><span class="cap-name">[Customer Analytics]</span></div>
          <div class="cap-item cap-medium"><span class="cap-name">[Loyalty & Retention]</span></div>
          <div class="cap-item cap-low"><span class="cap-name">[Omnichannel Experience]</span></div>
        </div>
      </div>
      <div class="cap-domain">
        <div class="domain-header">[Domain 2 - e.g., Operations]</div>
        <div class="domain-capabilities">
          <div class="cap-item cap-medium"><span class="cap-name">[Supply Chain Mgmt]</span></div>
          <div class="cap-item cap-high"><span class="cap-name">[Order Fulfillment]</span></div>
          <div class="cap-item cap-low"><span class="cap-name">[Inventory Optimization]</span></div>
          <div class="cap-item cap-medium"><span class="cap-name">[Quality Assurance]</span></div>
          <div class="cap-item cap-high"><span class="cap-name">[Vendor Management]</span></div>
        </div>
      </div>
      <div class="cap-domain">
        <div class="domain-header">[Domain 3 - e.g., Technology & Data]</div>
        <div class="domain-capabilities">
          <div class="cap-item cap-low"><span class="cap-name">[Cloud Infrastructure]</span></div>
          <div class="cap-item cap-low"><span class="cap-name">[Data & Analytics]</span></div>
          <div class="cap-item cap-medium"><span class="cap-name">[Cybersecurity]</span></div>
          <div class="cap-item cap-medium"><span class="cap-name">[Enterprise Architecture]</span></div>
          <div class="cap-item cap-low"><span class="cap-name">[AI / ML Capabilities]</span></div>
        </div>
      </div>
      <div class="cap-domain">
        <div class="domain-header">[Domain 4 - e.g., People & Organization]</div>
        <div class="domain-capabilities">
          <div class="cap-item cap-high"><span class="cap-name">[Talent Acquisition]</span></div>
          <div class="cap-item cap-medium"><span class="cap-name">[Learning & Development]</span></div>
          <div class="cap-item cap-high"><span class="cap-name">[Performance Mgmt]</span></div>
          <div class="cap-item cap-low"><span class="cap-name">[Change Management]</span></div>
          <div class="cap-item cap-medium"><span class="cap-name">[Workforce Planning]</span></div>
        </div>
      </div>
      <div class="cap-legend">
        <div class="legend-item"><span class="legend-box cap-high-bg"></span>Mature</div>
        <div class="legend-item"><span class="legend-box cap-medium-bg"></span>Developing</div>
        <div class="legend-item"><span class="legend-box cap-low-bg"></span>Emerging / Gap</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // ===== MBB CONSULTING TEMPLATES =====

  // Key Takeaways → Recommendations (Insight → Action bridge)
  insightToAction: {
    id: 'insightToAction',
    title: 'Insights to Recommendations',
    type: 'insight-action',
    master: 'standard',
    description: 'Key takeaways on left, recommendations on right, impact summary below',
    note: 'Bridge slide connecting analysis to action: insights column, recommendations column, and impact/effort/timing row. Use after analysis sections to drive decisions.',
    thumbnail: 'insight-action',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[From Insights to Action]</h1>
  <h2 class="subtitle">[Summary of analysis and next steps]</h2>
  <div class="frame">
    <div class="insight-action-layout">
      <div class="ia-columns">
        <div class="ia-column ia-insights">
          <div class="ia-header">Key Takeaways</div>
          <div class="ia-items">
            <div class="ia-item"><span class="ia-bullet">→</span>[Key insight from the analysis]</div>
            <div class="ia-item"><span class="ia-bullet">→</span>[Key insight from the analysis]</div>
            <div class="ia-item"><span class="ia-bullet">→</span>[Key insight from the analysis]</div>
            <div class="ia-item"><span class="ia-bullet">→</span>[Key insight from the analysis]</div>
          </div>
        </div>
        <div class="ia-arrow">⟹</div>
        <div class="ia-column ia-recommendations">
          <div class="ia-header">Recommendations</div>
          <div class="ia-items">
            <div class="ia-item"><span class="ia-num">1</span>[Recommended action]</div>
            <div class="ia-item"><span class="ia-num">2</span>[Recommended action]</div>
            <div class="ia-item"><span class="ia-num">3</span>[Recommended action]</div>
            <div class="ia-item"><span class="ia-num">4</span>[Recommended action]</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 4) Issue Tree / Hypothesis Tree (MECE decomposition)
  issueTree: {
    id: 'issueTree',
    title: 'Issue Tree',
    type: 'tree',
    master: 'standard',
    description: 'MECE problem decomposition with branches and sub-branches',
    note: 'Structured thinking artifact: problem statement branches into drivers/hypotheses with sub-analyses. Use for problem framing, root cause analysis, or hypothesis development. IMPORTANT: Root node = 2-4 words. Branch nodes = 2-4 words. Leaf nodes = 4-5 words MAX (very short labels, not sentences).',
    thumbnail: 'tree',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Problem Statement or Key Question]</h1>
  <h2 class="subtitle">[MECE Decomposition]</h2>
  <div class="frame">
    <div class="issue-tree">
      <div class="tree-root">
        <div class="tree-node root-node">[Key Question]</div>
      </div>
      <div class="tree-branches">
        <div class="tree-branch">
          <div class="branch-connector"></div>
          <div class="tree-node branch-node">[Driver 1]</div>
          <div class="sub-branches">
            <div class="sub-branch">
              <div class="tree-node leaf-node">[4-5 word label]</div>
            </div>
            <div class="sub-branch">
              <div class="tree-node leaf-node">[4-5 word label]</div>
            </div>
          </div>
        </div>
        <div class="tree-branch">
          <div class="branch-connector"></div>
          <div class="tree-node branch-node">[Driver 2]</div>
          <div class="sub-branches">
            <div class="sub-branch">
              <div class="tree-node leaf-node">[4-5 word label]</div>
            </div>
            <div class="sub-branch">
              <div class="tree-node leaf-node">[4-5 word label]</div>
            </div>
          </div>
        </div>
        <div class="tree-branch">
          <div class="branch-connector"></div>
          <div class="tree-node branch-node">[Driver 3]</div>
          <div class="sub-branches">
            <div class="sub-branch">
              <div class="tree-node leaf-node">[4-5 word label]</div>
            </div>
            <div class="sub-branch">
              <div class="tree-node leaf-node">[4-5 word label]</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 5) Workplan / Analysis Plan (Workstreams × timeline)
  workplan: {
    id: 'workplan',
    title: 'Workplan',
    type: 'gantt',
    master: 'standard',
    description: 'Gantt-style workstreams with weeks, milestones, and owners',
    note: 'Project timeline showing workstreams as rows, weeks as columns, with milestones and owners. Use for project kickoffs, status updates, or planning slides.',
    thumbnail: 'workplan',
    category: 'Process & Time',
    html: `<div class="slide master-standard">
  <h1 class="title">[Project Workplan]</h1>
  <h2 class="subtitle">[Timeline and Key Milestones]</h2>
  <div class="frame">
    <div class="workplan-gantt">
      <div class="gantt-header">
        <div class="gantt-label">Workstream</div>
        <div class="gantt-weeks">
          <div class="gantt-week">Wk 1</div>
          <div class="gantt-week">Wk 2</div>
          <div class="gantt-week">Wk 3</div>
          <div class="gantt-week">Wk 4</div>
          <div class="gantt-week">Wk 5</div>
          <div class="gantt-week">Wk 6</div>
        </div>
        <div class="gantt-owner-col">Owner</div>
      </div>
      <div class="gantt-row">
        <div class="gantt-label">[Workstream 1]</div>
        <div class="gantt-bar-container">
          <div class="gantt-bar" style="grid-column: 1 / 4;"></div>
          <div class="gantt-milestone" style="grid-column: 3;">◆</div>
        </div>
        <div class="gantt-owner">[Owner 1]</div>
      </div>
      <div class="gantt-row">
        <div class="gantt-label">[Workstream 2]</div>
        <div class="gantt-bar-container">
          <div class="gantt-bar" style="grid-column: 2 / 5;"></div>
          <div class="gantt-milestone" style="grid-column: 4;">◆</div>
        </div>
        <div class="gantt-owner">[Owner 2]</div>
      </div>
      <div class="gantt-row">
        <div class="gantt-label">[Workstream 3]</div>
        <div class="gantt-bar-container">
          <div class="gantt-bar" style="grid-column: 3 / 6;"></div>
        </div>
        <div class="gantt-owner">[Owner 3]</div>
      </div>
      <div class="gantt-row">
        <div class="gantt-label">[Workstream 4]</div>
        <div class="gantt-bar-container">
          <div class="gantt-bar" style="grid-column: 4 / 7;"></div>
          <div class="gantt-milestone" style="grid-column: 6;">◆</div>
        </div>
        <div class="gantt-owner">[Owner 4]</div>
      </div>
      <div class="gantt-legend">
        <span class="legend-item"><span class="legend-bar"></span>Duration</span>
        <span class="legend-item"><span class="legend-milestone">◆</span>Milestone</span>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 6) 2×2 Priority Matrix (with labeled axes)
  priorityMatrix: {
    id: 'priorityMatrix',
    title: '2x2 Priority Matrix',
    type: 'matrix',
    master: 'standard',
    description: 'Prioritization matrix with labeled axes and positioned items',
    note: 'Classic 2x2 prioritization framework with axis labels and quadrant names. Use for initiative prioritization, portfolio decisions, or strategic trade-offs.',
    thumbnail: 'matrix',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Prioritization Framework]</h1>
  <h2 class="subtitle">[Strategic initiative assessment]</h2>
  <div class="frame">
    <div class="priority-matrix">
      <div class="matrix-grid">
        <div class="matrix-quadrant q-top-left">
          <div class="quadrant-label">[Quick Wins]</div>
          <div class="matrix-item">[Initiative A]</div>
          <div class="matrix-item">[Initiative B]</div>
        </div>
        <div class="matrix-quadrant q-top-right">
          <div class="quadrant-label">[Strategic Bets]</div>
          <div class="matrix-item">[Initiative C]</div>
        </div>
        <div class="matrix-quadrant q-bottom-left">
          <div class="quadrant-label">[Fill-ins]</div>
          <div class="matrix-item">[Initiative D]</div>
        </div>
        <div class="matrix-quadrant q-bottom-right">
          <div class="quadrant-label">[Deprioritize]</div>
          <div class="matrix-item">[Initiative E]</div>
          <div class="matrix-item">[Initiative F]</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 7) 3×3 / Nine-Box Portfolio Matrix
  nineBoxMatrix: {
    id: 'nineBoxMatrix',
    title: 'Nine-Box Matrix',
    type: 'matrix',
    master: 'standard',
    description: 'GE-McKinsey style 9-box portfolio matrix',
    note: 'Portfolio assessment with 9 cells for business units or initiatives. Use for portfolio strategy, talent assessment, or multi-criteria prioritization.',
    thumbnail: 'nine-box',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Portfolio Assessment Matrix]</h1>
  <h2 class="subtitle">[Business Unit / Initiative Positioning]</h2>
  <div class="frame">
    <div class="nine-box-matrix">
      <div class="nb-y-label">[Y-Axis (e.g., Market Attractiveness)]</div>
      <div class="nb-grid">
        <div class="nb-y-markers">
          <span>High</span>
          <span>Medium</span>
          <span>Low</span>
        </div>
        <div class="nb-cells">
          <div class="nb-cell nb-invest">[Invest]</div>
          <div class="nb-cell nb-invest">[Invest]</div>
          <div class="nb-cell nb-hold">[Hold]</div>
          <div class="nb-cell nb-invest">[Invest]</div>
          <div class="nb-cell nb-hold">[Hold]</div>
          <div class="nb-cell nb-divest">[Divest]</div>
          <div class="nb-cell nb-hold">[Hold]</div>
          <div class="nb-cell nb-divest">[Divest]</div>
          <div class="nb-cell nb-divest">[Divest]</div>
        </div>
        <div class="nb-x-markers">
          <span>Strong</span>
          <span>Medium</span>
          <span>Weak</span>
        </div>
      </div>
      <div class="nb-x-label">[X-Axis (e.g., Competitive Strength)]</div>
      <div class="nb-legend">
        <span class="nb-legend-item"><span class="nb-dot nb-invest-dot"></span>Invest/Grow</span>
        <span class="nb-legend-item"><span class="nb-dot nb-hold-dot"></span>Hold/Maintain</span>
        <span class="nb-legend-item"><span class="nb-dot nb-divest-dot"></span>Harvest/Divest</span>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 9) Scorecard / Heatmap (RAG + Harvey balls)
  scorecard: {
    id: 'scorecard',
    title: 'Scorecard / Heatmap',
    type: 'scorecard',
    master: 'standard',
    description: 'Assessment scorecard with RAG status and scoring',
    note: 'Evaluation matrix with entities as rows, criteria as columns. Use color-coded RAG badges (Strong/Moderate/Weak) instead of dots. Overall column should show a numeric score. Use for vendor assessments, capability ratings, or progress tracking.',
    thumbnail: 'scorecard',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Assessment Scorecard]</h1>
  <h2 class="subtitle">[Evaluation criteria and ratings]</h2>
  <div class="frame">
    <div class="scorecard-table">
      <table>
        <thead>
          <tr>
            <th class="sc-entity-col">[Entity]</th>
            <th>[Criterion 1]</th>
            <th>[Criterion 2]</th>
            <th>[Criterion 3]</th>
            <th>[Criterion 4]</th>
            <th class="sc-total-col">Overall</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="sc-entity">[Entity A]</td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-amber">Moderate</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td class="sc-total">[8.5]</td>
          </tr>
          <tr>
            <td class="sc-entity">[Entity B]</td>
            <td><span class="rag-badge rag-amber">Moderate</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-amber">Moderate</span></td>
            <td class="sc-total">[7.2]</td>
          </tr>
          <tr>
            <td class="sc-entity">[Entity C]</td>
            <td><span class="rag-badge rag-red">Weak</span></td>
            <td><span class="rag-badge rag-amber">Moderate</span></td>
            <td><span class="rag-badge rag-amber">Moderate</span></td>
            <td><span class="rag-badge rag-red">Weak</span></td>
            <td class="sc-total">[4.1]</td>
          </tr>
          <tr>
            <td class="sc-entity">[Entity D]</td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-amber">Moderate</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td class="sc-total">[9.0]</td>
          </tr>
          <tr>
            <td class="sc-entity">[Entity E]</td>
            <td><span class="rag-badge rag-amber">Moderate</span></td>
            <td><span class="rag-badge rag-red">Weak</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-amber">Moderate</span></td>
            <td class="sc-total">[5.8]</td>
          </tr>
          <tr>
            <td class="sc-entity">[Entity F]</td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td><span class="rag-badge rag-red">Weak</span></td>
            <td><span class="rag-badge rag-green">Strong</span></td>
            <td class="sc-total">[7.8]</td>
          </tr>
        </tbody>
      </table>
      <div class="scorecard-legend">
        <span class="legend-item"><span class="rag-badge rag-green">Strong</span>= High / On Track</span>
        <span class="legend-item"><span class="rag-badge rag-amber">Moderate</span>= Medium / At Risk</span>
        <span class="legend-item"><span class="rag-badge rag-red">Weak</span>= Low / Off Track</span>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 13) Bar Chart Exhibit
  barChartExhibit: {
    id: 'barChartExhibit',
    title: 'Bar Chart Exhibit',
    type: 'chart',
    master: 'standard',
    description: 'Horizontal bar chart with left insight panel and value labels',
    note: 'Data visualization slide with horizontal bars, a dark insight panel on the left, and value labels. Use for category comparisons, rankings, or benchmark data.',
    thumbnail: 'bar-chart',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight from the bar chart data]</h1>
  <h2 class="subtitle">[Metric description and context]</h2>
  <div class="frame">
    <div class="bar-chart-exhibit">
      <div class="chart-left-panels">
        <div class="chart-panel">
          <div class="chart-panel-title">[Context & Key Takeaways]</div>
          <ul class="chart-panel-list">
            <li>[Key context point about the data or methodology]</li>
            <li>[Relevant background information]</li>
            <li>[Scope or timeframe of the analysis]</li>
            <li>[Insight about the top-ranked item]</li>
            <li>[Notable gap or pattern between categories]</li>
            <li>[Actionable implication from the data]</li>
          </ul>
        </div>
      </div>
      <div class="chart-area">
        <div class="bar-row">
          <div class="bar-label">[Category 1]</div>
          <div class="bar-track"><div class="bar-fill bar-fill-1" style="width: 85%;"></div></div>
          <div class="bar-value">[85%]</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">[Category 2]</div>
          <div class="bar-track"><div class="bar-fill bar-fill-2" style="width: 72%;"></div></div>
          <div class="bar-value">[72%]</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">[Category 3]</div>
          <div class="bar-track"><div class="bar-fill bar-fill-3" style="width: 68%;"></div></div>
          <div class="bar-value">[68%]</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">[Category 4]</div>
          <div class="bar-track"><div class="bar-fill bar-fill-4" style="width: 54%;"></div></div>
          <div class="bar-value">[54%]</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">[Category 5]</div>
          <div class="bar-track"><div class="bar-fill bar-fill-5" style="width: 41%;"></div></div>
          <div class="bar-value">[41%]</div>
        </div>
        <div class="chart-source">Source: [Data source, date]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 14) Vertical Bar Chart Exhibit
  verticalBarChartExhibit: {
    id: 'verticalBarChartExhibit',
    title: 'Vertical Bar Chart Exhibit',
    type: 'chart',
    master: 'standard',
    description: 'Vertical bar chart with left insight panel and value labels',
    note: 'Data visualization slide with vertical bars (columns), a dark insight panel on the left, and value labels. Use for time series comparisons, category rankings, or trend data.',
    thumbnail: 'column-chart',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight from the chart data]</h1>
  <h2 class="subtitle">[Metric description and context]</h2>
  <div class="frame">
    <div class="vertical-bar-chart-exhibit">
      <div class="chart-left-panels">
        <div class="chart-panel">
          <div class="chart-panel-title">[Context & Key Takeaways]</div>
          <ul class="chart-panel-list">
            <li>[Key context point about the data or methodology]</li>
            <li>[Relevant background information]</li>
            <li>[Scope or timeframe of the analysis]</li>
            <li>[Insight about the highest value]</li>
            <li>[Notable trend or pattern across categories]</li>
            <li>[Actionable implication from the data]</li>
          </ul>
        </div>
      </div>
      <div class="vbar-chart-area">
        <div class="vbar-container">
          <div class="vbar-column">
            <div class="vbar-value">[85%]</div>
            <div class="vbar-track"><div class="vbar-fill vbar-fill-1" style="height: 85%;"></div></div>
            <div class="vbar-label">[Cat 1]</div>
          </div>
          <div class="vbar-column">
            <div class="vbar-value">[72%]</div>
            <div class="vbar-track"><div class="vbar-fill vbar-fill-2" style="height: 72%;"></div></div>
            <div class="vbar-label">[Cat 2]</div>
          </div>
          <div class="vbar-column">
            <div class="vbar-value">[68%]</div>
            <div class="vbar-track"><div class="vbar-fill vbar-fill-3" style="height: 68%;"></div></div>
            <div class="vbar-label">[Cat 3]</div>
          </div>
          <div class="vbar-column">
            <div class="vbar-value">[54%]</div>
            <div class="vbar-track"><div class="vbar-fill vbar-fill-4" style="height: 54%;"></div></div>
            <div class="vbar-label">[Cat 4]</div>
          </div>
          <div class="vbar-column">
            <div class="vbar-value">[41%]</div>
            <div class="vbar-track"><div class="vbar-fill vbar-fill-5" style="height: 41%;"></div></div>
            <div class="vbar-label">[Cat 5]</div>
          </div>
        </div>
        <div class="chart-source">Source: [Data source, date]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 15) Waterfall (Bridge) Chart
  waterfallChart: {
    id: 'waterfallChart',
    title: 'Waterfall Chart',
    type: 'chart',
    master: 'standard',
    description: 'Bridge chart showing incremental changes from start to end',
    note: 'Waterfall visualization for variance analysis, showing how individual factors contribute to change from start to end value. Use for P&L bridges, cost breakdowns, or impact decomposition.',
    thumbnail: 'waterfall',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight from the waterfall analysis]</h1>
  <h2 class="subtitle">[Value bridge from X to Y]</h2>
  <div class="frame">
    <div class="waterfall-exhibit">
      <div class="waterfall-chart">
        <div class="wf-bar wf-start">
          <div class="wf-label">[Start Value]</div>
          <div class="wf-column" style="height: 60%;"></div>
          <div class="wf-value">[100]</div>
        </div>
        <div class="wf-bar wf-positive">
          <div class="wf-label">[Driver +]</div>
          <div class="wf-column" style="height: 20%; bottom: 60%;"></div>
          <div class="wf-value">+[20]</div>
        </div>
        <div class="wf-bar wf-positive">
          <div class="wf-label">[Driver +]</div>
          <div class="wf-column" style="height: 15%; bottom: 80%;"></div>
          <div class="wf-value">+[15]</div>
        </div>
        <div class="wf-bar wf-negative">
          <div class="wf-label">[Driver −]</div>
          <div class="wf-column" style="height: 10%; bottom: 85%;"></div>
          <div class="wf-value">−[10]</div>
        </div>
        <div class="wf-bar wf-negative">
          <div class="wf-label">[Driver −]</div>
          <div class="wf-column" style="height: 5%; bottom: 80%;"></div>
          <div class="wf-value">−[5]</div>
        </div>
        <div class="wf-bar wf-end">
          <div class="wf-label">[End Value]</div>
          <div class="wf-column" style="height: 80%;"></div>
          <div class="wf-value">[120]</div>
        </div>
      </div>
      <div class="wf-summary">
        <div class="wf-summary-item">
          <span class="wf-icon wf-plus">+</span>
          <span>[Total positive drivers: +35]</span>
        </div>
        <div class="wf-summary-item">
          <span class="wf-icon wf-minus">−</span>
          <span>[Total negative drivers: −15]</span>
        </div>
        <div class="wf-summary-item">
          <span class="wf-icon wf-net">=</span>
          <span>[Net change: +20 (+20%)]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source, period]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Graph + Insights — Real SVG chart on left, insights on right
  graphInsights: {
    id: 'graphInsights',
    title: 'Graph + Insights',
    type: 'chart',
    master: 'standard',
    description: 'SVG bar chart on the left with numbered insight callouts on the right',
    note: 'Real rendered SVG bar chart on the left 60% of the slide, with 3-4 numbered insights on the right. The chart renders as an actual graph, not placeholder shapes. Use for data-driven storytelling where you want the chart and takeaways side by side.',
    thumbnail: 'bar-chart',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight from the data]</h1>
  <h2 class="subtitle">[Metric and context]</h2>
  <div class="frame">
    <div class="graph-insights">
      <div class="graph-panel">
        <div class="graph-title">[Chart Title]</div>
        <svg class="gi-chart" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet">
          <!-- Y-axis labels -->
          <text x="30" y="18" text-anchor="end" class="gi-axis-label">[100]</text>
          <text x="30" y="74" text-anchor="end" class="gi-axis-label">[75]</text>
          <text x="30" y="130" text-anchor="end" class="gi-axis-label">[50]</text>
          <text x="30" y="186" text-anchor="end" class="gi-axis-label">[25]</text>
          <!-- Grid lines -->
          <line x1="40" y1="14" x2="390" y2="14" class="gi-gridline"/>
          <line x1="40" y1="70" x2="390" y2="70" class="gi-gridline"/>
          <line x1="40" y1="126" x2="390" y2="126" class="gi-gridline"/>
          <line x1="40" y1="182" x2="390" y2="182" class="gi-gridline"/>
          <!-- Baseline -->
          <line x1="40" y1="210" x2="390" y2="210" class="gi-baseline"/>
          <!-- Bars -->
          <rect x="55" y="42" width="46" height="168" class="gi-bar gi-bar-1" rx="2"/>
          <rect x="120" y="70" width="46" height="140" class="gi-bar gi-bar-2" rx="2"/>
          <rect x="185" y="98" width="46" height="112" class="gi-bar gi-bar-3" rx="2"/>
          <rect x="250" y="126" width="46" height="84" class="gi-bar gi-bar-4" rx="2"/>
          <rect x="315" y="154" width="46" height="56" class="gi-bar gi-bar-5" rx="2"/>
          <!-- Bar value labels -->
          <text x="78" y="36" text-anchor="middle" class="gi-bar-label">[85]</text>
          <text x="143" y="64" text-anchor="middle" class="gi-bar-label">[72]</text>
          <text x="208" y="92" text-anchor="middle" class="gi-bar-label">[58]</text>
          <text x="273" y="120" text-anchor="middle" class="gi-bar-label">[43]</text>
          <text x="338" y="148" text-anchor="middle" class="gi-bar-label">[29]</text>
          <!-- X-axis labels -->
          <text x="78" y="228" text-anchor="middle" class="gi-axis-label">[Cat A]</text>
          <text x="143" y="228" text-anchor="middle" class="gi-axis-label">[Cat B]</text>
          <text x="208" y="228" text-anchor="middle" class="gi-axis-label">[Cat C]</text>
          <text x="273" y="228" text-anchor="middle" class="gi-axis-label">[Cat D]</text>
          <text x="338" y="228" text-anchor="middle" class="gi-axis-label">[Cat E]</text>
        </svg>
        <div class="graph-source">Source: [Data source, sample, date]</div>
      </div>
      <div class="insights-panel">
        <div class="insights-header">Key Insights</div>
        <div class="insight-item">
          <div class="insight-num">1</div>
          <div class="insight-body">
            <h4>[First insight title]</h4>
            <p>[Supporting detail or implication]</p>
          </div>
        </div>
        <div class="insight-item">
          <div class="insight-num">2</div>
          <div class="insight-body">
            <h4>[Second insight title]</h4>
            <p>[Supporting detail or implication]</p>
          </div>
        </div>
        <div class="insight-item">
          <div class="insight-num">3</div>
          <div class="insight-body">
            <h4>[Third insight title]</h4>
            <p>[Supporting detail or implication]</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Customer Journey Map
  customerJourney: {
    id: 'customerJourney',
    title: 'Customer Journey',
    type: 'journey',
    master: 'standard',
    description: 'Horizontal journey stages with touchpoints and sentiment indicators',
    note: 'Horizontal stages representing a customer journey. Each stage has a header, touchpoints, and a sentiment indicator (positive/neutral/negative). Use for customer experience mapping, user flows, or service design.',
    thumbnail: 'flow',
    category: 'Process & Time',
    html: `<div class="slide master-standard">
  <h1 class="title">[Customer Journey Overview]</h1>
  <h2 class="subtitle">[Context or segment]</h2>
  <div class="frame">
    <div class="journey-map">
      <div class="journey-stage">
        <div class="journey-header">[Awareness]</div>
        <div class="journey-touchpoints">
          <div class="journey-touch">[Touchpoint 1]</div>
          <div class="journey-touch">[Touchpoint 2]</div>
        </div>
        <div class="journey-sentiment positive">
          <span class="sentiment-icon">▲</span>
          <span class="sentiment-label">[Positive experience]</span>
        </div>
      </div>
      <div class="journey-connector">›</div>
      <div class="journey-stage">
        <div class="journey-header">[Consideration]</div>
        <div class="journey-touchpoints">
          <div class="journey-touch">[Touchpoint 1]</div>
          <div class="journey-touch">[Touchpoint 2]</div>
        </div>
        <div class="journey-sentiment neutral">
          <span class="sentiment-icon">●</span>
          <span class="sentiment-label">[Neutral experience]</span>
        </div>
      </div>
      <div class="journey-connector">›</div>
      <div class="journey-stage">
        <div class="journey-header">[Purchase]</div>
        <div class="journey-touchpoints">
          <div class="journey-touch">[Touchpoint 1]</div>
          <div class="journey-touch">[Touchpoint 2]</div>
        </div>
        <div class="journey-sentiment negative">
          <span class="sentiment-icon">▼</span>
          <span class="sentiment-label">[Pain point here]</span>
        </div>
      </div>
      <div class="journey-connector">›</div>
      <div class="journey-stage">
        <div class="journey-header">[Onboarding]</div>
        <div class="journey-touchpoints">
          <div class="journey-touch">[Touchpoint 1]</div>
          <div class="journey-touch">[Touchpoint 2]</div>
        </div>
        <div class="journey-sentiment positive">
          <span class="sentiment-icon">▲</span>
          <span class="sentiment-label">[Positive experience]</span>
        </div>
      </div>
      <div class="journey-connector">›</div>
      <div class="journey-stage">
        <div class="journey-header">[Retention]</div>
        <div class="journey-touchpoints">
          <div class="journey-touch">[Touchpoint 1]</div>
          <div class="journey-touch">[Touchpoint 2]</div>
        </div>
        <div class="journey-sentiment positive">
          <span class="sentiment-icon">▲</span>
          <span class="sentiment-label">[Positive experience]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Options & Recommendations
  optionsRecommendation: {
    id: 'optionsRecommendation',
    title: 'Options & Recommendation',
    type: 'options-rec',
    master: 'standard',
    description: 'Side-by-side options with a highlighted recommended option',
    note: 'Three option columns compared across criteria rows, with the recommended option visually highlighted. Use for decision slides, vendor selection, or strategy options.',
    thumbnail: 'comparison',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Decision or evaluation heading]</h1>
  <h2 class="subtitle">[Context]</h2>
  <div class="frame">
    <div class="options-rec">
      <div class="options-criteria">
        <div class="criteria-header">&nbsp;</div>
        <div class="criteria-row">[Criterion 1]</div>
        <div class="criteria-row">[Criterion 2]</div>
        <div class="criteria-row">[Criterion 3]</div>
        <div class="criteria-row">[Criterion 4]</div>
        <div class="criteria-row criteria-verdict">Verdict</div>
      </div>
      <div class="option-col">
        <div class="option-header">Option A</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell option-verdict">Not recommended</div>
      </div>
      <div class="option-col recommended">
        <div class="option-header">Option B <span class="rec-badge">Recommended</span></div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell option-verdict">Best fit</div>
      </div>
      <div class="option-col">
        <div class="option-header">Option C</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell">[Detail]</div>
        <div class="option-cell option-verdict">Viable alternative</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // Dual Charts with Commentary
  dualCharts: {
    id: 'dualCharts',
    title: 'Dual Charts',
    type: 'dual-chart',
    master: 'standard',
    description: 'Two bar charts side by side with commentary boxes below each',
    note: 'Two SVG bar charts displayed side by side, each with a commentary box below explaining the key takeaway. Use for comparing two datasets, before/after metrics, or regional breakdowns.',
    thumbnail: 'bar-chart',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Comparison heading]</h1>
  <h2 class="subtitle">[Context or time period]</h2>
  <div class="frame">
    <div class="dual-charts">
      <div class="dual-chart-col">
        <div class="chart-box">
          <div class="graph-title">[Chart A Title]</div>
          <svg class="gi-chart" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
            <line x1="40" y1="10" x2="390" y2="10" class="gi-gridline"/>
            <line x1="40" y1="60" x2="390" y2="60" class="gi-gridline"/>
            <line x1="40" y1="110" x2="390" y2="110" class="gi-gridline"/>
            <line x1="40" y1="170" x2="390" y2="170" class="gi-baseline"/>
            <text x="30" y="14" text-anchor="end" class="gi-axis-label">[80]</text>
            <text x="30" y="64" text-anchor="end" class="gi-axis-label">[60]</text>
            <text x="30" y="114" text-anchor="end" class="gi-axis-label">[40]</text>
            <rect x="65" y="30" width="55" height="140" class="gi-bar gi-bar-1" rx="2"/>
            <rect x="150" y="60" width="55" height="110" class="gi-bar gi-bar-2" rx="2"/>
            <rect x="235" y="90" width="55" height="80" class="gi-bar gi-bar-3" rx="2"/>
            <rect x="320" y="50" width="55" height="120" class="gi-bar gi-bar-4" rx="2"/>
            <text x="92" y="25" text-anchor="middle" class="gi-bar-label">[75]</text>
            <text x="177" y="55" text-anchor="middle" class="gi-bar-label">[58]</text>
            <text x="262" y="85" text-anchor="middle" class="gi-bar-label">[42]</text>
            <text x="347" y="45" text-anchor="middle" class="gi-bar-label">[63]</text>
            <text x="92" y="188" text-anchor="middle" class="gi-axis-label">[A]</text>
            <text x="177" y="188" text-anchor="middle" class="gi-axis-label">[B]</text>
            <text x="262" y="188" text-anchor="middle" class="gi-axis-label">[C]</text>
            <text x="347" y="188" text-anchor="middle" class="gi-axis-label">[D]</text>
          </svg>
        </div>
        <div class="chart-comment">
          <strong>[Key takeaway from Chart A]</strong>
          <p>[Supporting detail or implication]</p>
        </div>
      </div>
      <div class="dual-chart-col">
        <div class="chart-box">
          <div class="graph-title">[Chart B Title]</div>
          <svg class="gi-chart" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
            <line x1="40" y1="10" x2="390" y2="10" class="gi-gridline"/>
            <line x1="40" y1="60" x2="390" y2="60" class="gi-gridline"/>
            <line x1="40" y1="110" x2="390" y2="110" class="gi-gridline"/>
            <line x1="40" y1="170" x2="390" y2="170" class="gi-baseline"/>
            <text x="30" y="14" text-anchor="end" class="gi-axis-label">[80]</text>
            <text x="30" y="64" text-anchor="end" class="gi-axis-label">[60]</text>
            <text x="30" y="114" text-anchor="end" class="gi-axis-label">[40]</text>
            <rect x="65" y="50" width="55" height="120" class="gi-bar gi-bar-1" rx="2"/>
            <rect x="150" y="40" width="55" height="130" class="gi-bar gi-bar-2" rx="2"/>
            <rect x="235" y="70" width="55" height="100" class="gi-bar gi-bar-3" rx="2"/>
            <rect x="320" y="80" width="55" height="90" class="gi-bar gi-bar-4" rx="2"/>
            <text x="92" y="45" text-anchor="middle" class="gi-bar-label">[63]</text>
            <text x="177" y="35" text-anchor="middle" class="gi-bar-label">[68]</text>
            <text x="262" y="65" text-anchor="middle" class="gi-bar-label">[52]</text>
            <text x="347" y="75" text-anchor="middle" class="gi-bar-label">[47]</text>
            <text x="92" y="188" text-anchor="middle" class="gi-axis-label">[A]</text>
            <text x="177" y="188" text-anchor="middle" class="gi-axis-label">[B]</text>
            <text x="262" y="188" text-anchor="middle" class="gi-axis-label">[C]</text>
            <text x="347" y="188" text-anchor="middle" class="gi-axis-label">[D]</text>
          </svg>
        </div>
        <div class="chart-comment">
          <strong>[Key takeaway from Chart B]</strong>
          <p>[Supporting detail or implication]</p>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // ═══════════════════════════════════════════════════════════════
  // BENCHMARKING TEMPLATES
  // ═══════════════════════════════════════════════════════════════

  // 1) Peer Comparison Benchmark — side-by-side metrics vs peers
  peerBenchmark: {
    id: 'peerBenchmark',
    title: 'Peer Comparison Benchmark',
    type: 'benchmark',
    master: 'standard',
    description: 'Side-by-side metrics comparison against peer companies or benchmarks',
    note: 'Shows your entity vs multiple peers across key metrics with visual performance indicators. Use for competitive benchmarking, peer analysis, or industry comparison.',
    thumbnail: 'peer-benchmark',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key benchmarking insight — e.g. "Company X outperforms peers on 4 of 6 metrics"]</h1>
  <h2 class="subtitle">[Benchmark context — e.g. "Performance vs. S&P 500 peers, FY 2024"]</h2>
  <div class="frame">
    <div class="peer-benchmark">
      <table class="bench-table">
        <thead>
          <tr>
            <th class="bench-metric-col">[Metric]</th>
            <th class="bench-subject-col">[Your Entity]</th>
            <th>[Peer 1]</th>
            <th>[Peer 2]</th>
            <th>[Peer 3]</th>
            <th class="bench-avg-col">[Avg / Median]</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bench-metric">[Revenue Growth]</td>
            <td class="bench-subject"><span class="bench-val bench-best">[12.4%]</span></td>
            <td><span class="bench-val">[8.1%]</span></td>
            <td><span class="bench-val">[10.2%]</span></td>
            <td><span class="bench-val">[6.7%]</span></td>
            <td class="bench-avg">[9.4%]</td>
          </tr>
          <tr>
            <td class="bench-metric">[Operating Margin]</td>
            <td class="bench-subject"><span class="bench-val bench-best">[22.1%]</span></td>
            <td><span class="bench-val">[18.4%]</span></td>
            <td><span class="bench-val">[20.7%]</span></td>
            <td><span class="bench-val">[15.3%]</span></td>
            <td class="bench-avg">[18.1%]</td>
          </tr>
          <tr>
            <td class="bench-metric">[ROE]</td>
            <td class="bench-subject"><span class="bench-val">[14.2%]</span></td>
            <td><span class="bench-val bench-best">[18.9%]</span></td>
            <td><span class="bench-val">[12.5%]</span></td>
            <td><span class="bench-val">[16.1%]</span></td>
            <td class="bench-avg">[15.8%]</td>
          </tr>
          <tr>
            <td class="bench-metric">[Debt/Equity]</td>
            <td class="bench-subject"><span class="bench-val bench-best">[0.45x]</span></td>
            <td><span class="bench-val">[0.82x]</span></td>
            <td><span class="bench-val">[0.61x]</span></td>
            <td><span class="bench-val">[0.93x]</span></td>
            <td class="bench-avg">[0.79x]</td>
          </tr>
          <tr>
            <td class="bench-metric">[Customer NPS]</td>
            <td class="bench-subject"><span class="bench-val">[62]</span></td>
            <td><span class="bench-val">[58]</span></td>
            <td><span class="bench-val bench-best">[71]</span></td>
            <td><span class="bench-val">[49]</span></td>
            <td class="bench-avg">[59]</td>
          </tr>
        </tbody>
      </table>
      <div class="bench-legend">
        <span class="bench-legend-item"><span class="bench-dot bench-dot-best"></span> Best in class</span>
        <span class="bench-legend-item"><span class="bench-dot bench-dot-subject"></span> Subject entity</span>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source, period, methodology]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 2) Index Performance Benchmark — returns vs index/benchmark over time
  indexBenchmark: {
    id: 'indexBenchmark',
    title: 'Index Performance Benchmark',
    type: 'benchmark',
    master: 'standard',
    description: 'Performance comparison against an index or benchmark over multiple periods',
    note: 'Horizontal grouped bars showing returns/performance vs a benchmark across time periods. Use for portfolio vs benchmark, fund performance, or year-over-year comparisons.',
    thumbnail: 'index-benchmark',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key performance insight — e.g. "Portfolio outperformed S&P 500 in 4 of 5 years"]</h1>
  <h2 class="subtitle">[Context — e.g. "Annual total returns (%), 2020–2024"]</h2>
  <div class="frame">
    <div class="index-benchmark">
      <div class="idx-chart">
        <div class="idx-period">
          <div class="idx-period-label">[2020]</div>
          <div class="idx-bars">
            <div class="idx-bar-group">
              <div class="idx-bar idx-bar-subject" style="width: 72%;"><span class="idx-bar-val">[18.4%]</span></div>
              <div class="idx-bar idx-bar-bench" style="width: 65%;"><span class="idx-bar-val">[16.3%]</span></div>
            </div>
          </div>
        </div>
        <div class="idx-period">
          <div class="idx-period-label">[2021]</div>
          <div class="idx-bars">
            <div class="idx-bar-group">
              <div class="idx-bar idx-bar-subject" style="width: 100%;"><span class="idx-bar-val">[28.7%]</span></div>
              <div class="idx-bar idx-bar-bench" style="width: 96%;"><span class="idx-bar-val">[26.9%]</span></div>
            </div>
          </div>
        </div>
        <div class="idx-period">
          <div class="idx-period-label">[2022]</div>
          <div class="idx-bars">
            <div class="idx-bar-group">
              <div class="idx-bar idx-bar-subject idx-bar-negative" style="width: 50%;"><span class="idx-bar-val">[−12.8%]</span></div>
              <div class="idx-bar idx-bar-bench idx-bar-negative" style="width: 65%;"><span class="idx-bar-val">[−18.1%]</span></div>
            </div>
          </div>
        </div>
        <div class="idx-period">
          <div class="idx-period-label">[2023]</div>
          <div class="idx-bars">
            <div class="idx-bar-group">
              <div class="idx-bar idx-bar-subject" style="width: 85%;"><span class="idx-bar-val">[22.1%]</span></div>
              <div class="idx-bar idx-bar-bench" style="width: 92%;"><span class="idx-bar-val">[26.3%]</span></div>
            </div>
          </div>
        </div>
        <div class="idx-period">
          <div class="idx-period-label">[2024]</div>
          <div class="idx-bars">
            <div class="idx-bar-group">
              <div class="idx-bar idx-bar-subject" style="width: 90%;"><span class="idx-bar-val">[25.6%]</span></div>
              <div class="idx-bar idx-bar-bench" style="width: 84%;"><span class="idx-bar-val">[24.2%]</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="idx-summary">
        <div class="idx-summary-card">
          <div class="idx-summary-label">[Cumulative Return]</div>
          <div class="idx-summary-row">
            <span class="idx-dot idx-dot-subject"></span>
            <span class="idx-summary-entity">[Portfolio]</span>
            <span class="idx-summary-val">[+112.4%]</span>
          </div>
          <div class="idx-summary-row">
            <span class="idx-dot idx-dot-bench"></span>
            <span class="idx-summary-entity">[S&P 500]</span>
            <span class="idx-summary-val">[+95.8%]</span>
          </div>
        </div>
        <div class="idx-summary-card">
          <div class="idx-summary-label">[Alpha Generated]</div>
          <div class="idx-summary-highlight">[+16.6pp]</div>
          <div class="idx-summary-note">[over 5-year period]</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source, total return basis, net of fees]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 3) Percentile Ranking Benchmark — where you stand in the distribution
  percentileBenchmark: {
    id: 'percentileBenchmark',
    title: 'Percentile Ranking Benchmark',
    type: 'benchmark',
    master: 'standard',
    description: 'Shows where an entity ranks within a peer distribution across metrics',
    note: 'Visual percentile bars showing position within peer group distribution. Use for quartile analysis, league tables, or relative performance ranking.',
    thumbnail: 'percentile-benchmark',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Ranking insight — e.g. "Top quartile on profitability, lagging on growth"]</h1>
  <h2 class="subtitle">[Context — e.g. "Percentile rank among Fortune 500 industrials, 2024"]</h2>
  <div class="frame">
    <div class="pctl-benchmark">
      <div class="pctl-rows">
        <div class="pctl-row">
          <div class="pctl-metric">[Revenue Growth]</div>
          <div class="pctl-track">
            <div class="pctl-zone pctl-q1"></div>
            <div class="pctl-zone pctl-q2"></div>
            <div class="pctl-zone pctl-q3"></div>
            <div class="pctl-zone pctl-q4"></div>
            <div class="pctl-marker" style="left: 72%;"><span class="pctl-marker-val">[P72]</span></div>
          </div>
          <div class="pctl-value">[12.4%]</div>
        </div>
        <div class="pctl-row">
          <div class="pctl-metric">[EBITDA Margin]</div>
          <div class="pctl-track">
            <div class="pctl-zone pctl-q1"></div>
            <div class="pctl-zone pctl-q2"></div>
            <div class="pctl-zone pctl-q3"></div>
            <div class="pctl-zone pctl-q4"></div>
            <div class="pctl-marker" style="left: 88%;"><span class="pctl-marker-val">[P88]</span></div>
          </div>
          <div class="pctl-value">[28.3%]</div>
        </div>
        <div class="pctl-row">
          <div class="pctl-metric">[ROIC]</div>
          <div class="pctl-track">
            <div class="pctl-zone pctl-q1"></div>
            <div class="pctl-zone pctl-q2"></div>
            <div class="pctl-zone pctl-q3"></div>
            <div class="pctl-zone pctl-q4"></div>
            <div class="pctl-marker" style="left: 61%;"><span class="pctl-marker-val">[P61]</span></div>
          </div>
          <div class="pctl-value">[15.7%]</div>
        </div>
        <div class="pctl-row">
          <div class="pctl-metric">[Asset Turnover]</div>
          <div class="pctl-track">
            <div class="pctl-zone pctl-q1"></div>
            <div class="pctl-zone pctl-q2"></div>
            <div class="pctl-zone pctl-q3"></div>
            <div class="pctl-zone pctl-q4"></div>
            <div class="pctl-marker" style="left: 34%;"><span class="pctl-marker-val">[P34]</span></div>
          </div>
          <div class="pctl-value">[0.82x]</div>
        </div>
        <div class="pctl-row">
          <div class="pctl-metric">[Net Debt / EBITDA]</div>
          <div class="pctl-track">
            <div class="pctl-zone pctl-q1"></div>
            <div class="pctl-zone pctl-q2"></div>
            <div class="pctl-zone pctl-q3"></div>
            <div class="pctl-zone pctl-q4"></div>
            <div class="pctl-marker" style="left: 81%;"><span class="pctl-marker-val">[P81]</span></div>
          </div>
          <div class="pctl-value">[1.2x]</div>
        </div>
      </div>
      <div class="pctl-legend">
        <div class="pctl-legend-item"><span class="pctl-legend-box pctl-q4"></span> Top quartile</div>
        <div class="pctl-legend-item"><span class="pctl-legend-box pctl-q3"></span> 2nd quartile</div>
        <div class="pctl-legend-item"><span class="pctl-legend-box pctl-q2"></span> 3rd quartile</div>
        <div class="pctl-legend-item"><span class="pctl-legend-box pctl-q1"></span> Bottom quartile</div>
        <div class="pctl-legend-item"><span class="pctl-legend-marker"></span> Your position</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source, peer group definition (N=xx), period]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 4) Competitive Landscape Benchmark — spider/radar-style scorecard
  competitiveBenchmark: {
    id: 'competitiveBenchmark',
    title: 'Competitive Scorecard',
    type: 'benchmark',
    master: 'standard',
    description: 'Multi-dimensional competitive scorecard with ratings across capabilities',
    note: 'Scorecard grid comparing entities across multiple dimensions with dot ratings. Use for competitive analysis, vendor evaluation, or capability assessment.',
    thumbnail: 'competitive-benchmark',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Competitive insight — e.g. "Leader in product and brand, behind on digital"]</h1>
  <h2 class="subtitle">[Context — e.g. "Competitive scorecard vs. top 3 rivals, Q4 2024"]</h2>
  <div class="frame">
    <div class="comp-benchmark">
      <table class="comp-table">
        <thead>
          <tr>
            <th class="comp-dim-col">[Dimension]</th>
            <th class="comp-wt-col">[Wt]</th>
            <th class="comp-entity-col comp-subject">[Your Co.]</th>
            <th class="comp-entity-col">[Rival A]</th>
            <th class="comp-entity-col">[Rival B]</th>
            <th class="comp-entity-col">[Rival C]</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="comp-dim">[Product Quality]</td>
            <td class="comp-wt">[25%]</td>
            <td class="comp-subject"><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
          </tr>
          <tr>
            <td class="comp-dim">[Market Reach]</td>
            <td class="comp-wt">[20%]</td>
            <td class="comp-subject"><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
          </tr>
          <tr>
            <td class="comp-dim">[Digital Capability]</td>
            <td class="comp-wt">[20%]</td>
            <td class="comp-subject"><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span></div></td>
          </tr>
          <tr>
            <td class="comp-dim">[Brand Strength]</td>
            <td class="comp-wt">[20%]</td>
            <td class="comp-subject"><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
          </tr>
          <tr>
            <td class="comp-dim">[Cost Position]</td>
            <td class="comp-wt">[15%]</td>
            <td class="comp-subject"><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span><span class="comp-dot"></span><span class="comp-dot"></span></div></td>
            <td><div class="comp-dots"><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot filled"></span><span class="comp-dot"></span></div></td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="comp-total-row">
            <td class="comp-dim"><strong>[Weighted Score]</strong></td>
            <td class="comp-wt">[100%]</td>
            <td class="comp-subject"><strong>[3.7]</strong></td>
            <td><strong>[3.5]</strong></td>
            <td><strong>[3.4]</strong></td>
            <td><strong>[3.2]</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Assessment methodology, date]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 5) Gap Analysis Benchmark — current vs target with gap sizing
  gapAnalysis: {
    id: 'gapAnalysis',
    title: 'Gap Analysis',
    type: 'benchmark',
    master: 'standard',
    description: 'Current state vs target/benchmark with quantified gaps and priorities',
    note: 'Visual gap bars showing current performance vs target for each metric with gap quantification. Use for transformation planning, improvement roadmaps, or target-setting.',
    thumbnail: 'gap-analysis',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Gap insight — e.g. "Largest gaps in digital and talent; on track for cost"]</h1>
  <h2 class="subtitle">[Context — e.g. "Current vs. 2026 target operating model"]</h2>
  <div class="frame">
    <div class="gap-analysis">
      <div class="gap-header-row">
        <div class="gap-metric-hdr">[Dimension]</div>
        <div class="gap-visual-hdr">[Current → Target]</div>
        <div class="gap-size-hdr">[Gap]</div>
        <div class="gap-priority-hdr">[Priority]</div>
      </div>
      <div class="gap-rows">
        <div class="gap-row">
          <div class="gap-metric">[Digital Maturity]</div>
          <div class="gap-visual">
            <div class="gap-track">
              <div class="gap-current" style="width: 35%;"></div>
              <div class="gap-target-marker" style="left: 80%;"></div>
            </div>
            <div class="gap-labels">
              <span class="gap-current-label">[2.1]</span>
              <span class="gap-target-label" style="left: 80%;">[4.5]</span>
            </div>
          </div>
          <div class="gap-size gap-size-large">[−2.4]</div>
          <div class="gap-priority gap-priority-critical">[Critical]</div>
        </div>
        <div class="gap-row">
          <div class="gap-metric">[Talent Readiness]</div>
          <div class="gap-visual">
            <div class="gap-track">
              <div class="gap-current" style="width: 42%;"></div>
              <div class="gap-target-marker" style="left: 85%;"></div>
            </div>
            <div class="gap-labels">
              <span class="gap-current-label">[48%]</span>
              <span class="gap-target-label" style="left: 85%;">[90%]</span>
            </div>
          </div>
          <div class="gap-size gap-size-large">[−42pp]</div>
          <div class="gap-priority gap-priority-critical">[Critical]</div>
        </div>
        <div class="gap-row">
          <div class="gap-metric">[Process Efficiency]</div>
          <div class="gap-visual">
            <div class="gap-track">
              <div class="gap-current" style="width: 55%;"></div>
              <div class="gap-target-marker" style="left: 75%;"></div>
            </div>
            <div class="gap-labels">
              <span class="gap-current-label">[62%]</span>
              <span class="gap-target-label" style="left: 75%;">[82%]</span>
            </div>
          </div>
          <div class="gap-size gap-size-medium">[−20pp]</div>
          <div class="gap-priority gap-priority-high">[High]</div>
        </div>
        <div class="gap-row">
          <div class="gap-metric">[Customer Satisfaction]</div>
          <div class="gap-visual">
            <div class="gap-track">
              <div class="gap-current" style="width: 68%;"></div>
              <div class="gap-target-marker" style="left: 85%;"></div>
            </div>
            <div class="gap-labels">
              <span class="gap-current-label">[NPS 54]</span>
              <span class="gap-target-label" style="left: 85%;">[NPS 70]</span>
            </div>
          </div>
          <div class="gap-size gap-size-medium">[−16]</div>
          <div class="gap-priority gap-priority-high">[High]</div>
        </div>
        <div class="gap-row">
          <div class="gap-metric">[Cost Position]</div>
          <div class="gap-visual">
            <div class="gap-track">
              <div class="gap-current" style="width: 72%;"></div>
              <div class="gap-target-marker" style="left: 80%;"></div>
            </div>
            <div class="gap-labels">
              <span class="gap-current-label">[1.08x]</span>
              <span class="gap-target-label" style="left: 80%;">[0.95x]</span>
            </div>
          </div>
          <div class="gap-size gap-size-small">[−0.13x]</div>
          <div class="gap-priority gap-priority-medium">[Medium]</div>
        </div>
      </div>
      <div class="gap-legend">
        <span class="gap-legend-item"><span class="gap-legend-bar"></span> Current state</span>
        <span class="gap-legend-item"><span class="gap-legend-target"></span> Target</span>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Assessment methodology, baseline date, target date]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // ── BENCHMARK 6: Maturity Model ──────────────────────────────────
  maturityBenchmark: {
    title: 'Maturity Model Benchmark',
    description: 'Capability maturity assessment across dimensions with level indicators',
    category: 'Data & Metrics',
    type: 'benchmark',
    master: 'standard',
    html: `<div class="slide master-standard">
  <h1 class="title">[Capability Maturity Assessment]</h1>
  <h2 class="subtitle">[Current state vs target across key dimensions]</h2>
  <div class="frame">
    <div class="maturity-grid">
      <div class="maturity-header">
        <div class="maturity-dim-label">Dimension</div>
        <div class="maturity-levels">
          <span class="maturity-level-label">1 — Initial</span>
          <span class="maturity-level-label">2 — Developing</span>
          <span class="maturity-level-label">3 — Defined</span>
          <span class="maturity-level-label">4 — Managed</span>
          <span class="maturity-level-label">5 — Optimized</span>
        </div>
      </div>
      <div class="maturity-row">
        <div class="maturity-dim-name">[Data Governance]</div>
        <div class="maturity-track">
          <div class="maturity-track-bg">
            <span class="maturity-segment seg-1"></span>
            <span class="maturity-segment seg-2"></span>
            <span class="maturity-segment seg-3"></span>
            <span class="maturity-segment seg-4"></span>
            <span class="maturity-segment seg-5"></span>
          </div>
          <div class="maturity-marker maturity-current" style="left: 35%;" title="Current: 2.1">
            <span class="maturity-marker-dot current-dot"></span>
          </div>
          <div class="maturity-marker maturity-target" style="left: 75%;" title="Target: 4.0">
            <span class="maturity-marker-dot target-dot"></span>
          </div>
        </div>
        <div class="maturity-scores">
          <span class="maturity-score-current">[2.1]</span>
          <span class="maturity-arrow">→</span>
          <span class="maturity-score-target">[4.0]</span>
        </div>
      </div>
      <div class="maturity-row">
        <div class="maturity-dim-name">[Analytics Capability]</div>
        <div class="maturity-track">
          <div class="maturity-track-bg">
            <span class="maturity-segment seg-1"></span>
            <span class="maturity-segment seg-2"></span>
            <span class="maturity-segment seg-3"></span>
            <span class="maturity-segment seg-4"></span>
            <span class="maturity-segment seg-5"></span>
          </div>
          <div class="maturity-marker maturity-current" style="left: 55%;" title="Current: 3.0">
            <span class="maturity-marker-dot current-dot"></span>
          </div>
          <div class="maturity-marker maturity-target" style="left: 85%;" title="Target: 4.5">
            <span class="maturity-marker-dot target-dot"></span>
          </div>
        </div>
        <div class="maturity-scores">
          <span class="maturity-score-current">[3.0]</span>
          <span class="maturity-arrow">→</span>
          <span class="maturity-score-target">[4.5]</span>
        </div>
      </div>
      <div class="maturity-row">
        <div class="maturity-dim-name">[Process Automation]</div>
        <div class="maturity-track">
          <div class="maturity-track-bg">
            <span class="maturity-segment seg-1"></span>
            <span class="maturity-segment seg-2"></span>
            <span class="maturity-segment seg-3"></span>
            <span class="maturity-segment seg-4"></span>
            <span class="maturity-segment seg-5"></span>
          </div>
          <div class="maturity-marker maturity-current" style="left: 15%;" title="Current: 1.3">
            <span class="maturity-marker-dot current-dot"></span>
          </div>
          <div class="maturity-marker maturity-target" style="left: 65%;" title="Target: 3.5">
            <span class="maturity-marker-dot target-dot"></span>
          </div>
        </div>
        <div class="maturity-scores">
          <span class="maturity-score-current">[1.3]</span>
          <span class="maturity-arrow">→</span>
          <span class="maturity-score-target">[3.5]</span>
        </div>
      </div>
      <div class="maturity-row">
        <div class="maturity-dim-name">[Talent & Skills]</div>
        <div class="maturity-track">
          <div class="maturity-track-bg">
            <span class="maturity-segment seg-1"></span>
            <span class="maturity-segment seg-2"></span>
            <span class="maturity-segment seg-3"></span>
            <span class="maturity-segment seg-4"></span>
            <span class="maturity-segment seg-5"></span>
          </div>
          <div class="maturity-marker maturity-current" style="left: 45%;" title="Current: 2.6">
            <span class="maturity-marker-dot current-dot"></span>
          </div>
          <div class="maturity-marker maturity-target" style="left: 75%;" title="Target: 4.0">
            <span class="maturity-marker-dot target-dot"></span>
          </div>
        </div>
        <div class="maturity-scores">
          <span class="maturity-score-current">[2.6]</span>
          <span class="maturity-arrow">→</span>
          <span class="maturity-score-target">[4.0]</span>
        </div>
      </div>
    </div>
    <div class="maturity-legend">
      <span class="maturity-legend-item"><span class="maturity-legend-dot current-dot"></span> Current state</span>
      <span class="maturity-legend-item"><span class="maturity-legend-dot target-dot"></span> Target state</span>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Assessment framework, evaluation date]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // ── CHART: Multi-Line Chart ──────────────────────────────────────
  multiLineChart: {
    id: 'multiLineChart',
    title: 'Multi-Line Chart',
    description: 'Multiple trend lines with legend for comparing series over time',
    category: 'Data & Metrics',
    type: 'chart',
    master: 'standard',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight from multi-series comparison]</h1>
  <h2 class="subtitle">[Metric comparison over time period]</h2>
  <div class="frame">
    <div class="ml-chart-exhibit">
      <div class="ml-chart-legend">
        <span class="ml-legend-item"><span class="ml-legend-swatch ml-series-1"></span>[Series A]</span>
        <span class="ml-legend-item"><span class="ml-legend-swatch ml-series-2"></span>[Series B]</span>
        <span class="ml-legend-item"><span class="ml-legend-swatch ml-series-3"></span>[Series C]</span>
      </div>
      <div class="ml-chart-area">
        <div class="ml-y-axis">
          <span>[100]</span>
          <span>[75]</span>
          <span>[50]</span>
          <span>[25]</span>
          <span>[0]</span>
        </div>
        <div class="ml-plot">
          <div class="ml-grid-line" style="bottom: 25%;"></div>
          <div class="ml-grid-line" style="bottom: 50%;"></div>
          <div class="ml-grid-line" style="bottom: 75%;"></div>
          <div class="ml-line ml-series-1" style="clip-path: polygon(0% 81%, 25% 66%, 50% 51%, 75% 36%, 100% 21%, 100% 19%, 75% 34%, 50% 49%, 25% 64%, 0% 79%);">
            <div class="ml-point" style="left: 0%; bottom: 20%;"><span class="ml-point-label">[20]</span></div>
            <div class="ml-point" style="left: 25%; bottom: 35%;"><span class="ml-point-label">[35]</span></div>
            <div class="ml-point" style="left: 50%; bottom: 50%;"><span class="ml-point-label">[50]</span></div>
            <div class="ml-point" style="left: 75%; bottom: 65%;"><span class="ml-point-label">[65]</span></div>
            <div class="ml-point" style="left: 100%; bottom: 80%;"><span class="ml-point-label">[80]</span></div>
          </div>
          <div class="ml-line ml-series-2" style="clip-path: polygon(0% 61%, 25% 56%, 50% 46%, 75% 51%, 100% 41%, 100% 39%, 75% 49%, 50% 44%, 25% 54%, 0% 59%);">
            <div class="ml-point" style="left: 0%; bottom: 40%;"><span class="ml-point-label">[40]</span></div>
            <div class="ml-point" style="left: 25%; bottom: 45%;"><span class="ml-point-label">[45]</span></div>
            <div class="ml-point" style="left: 50%; bottom: 55%;"><span class="ml-point-label">[55]</span></div>
            <div class="ml-point" style="left: 75%; bottom: 50%;"><span class="ml-point-label">[50]</span></div>
            <div class="ml-point" style="left: 100%; bottom: 60%;"><span class="ml-point-label">[60]</span></div>
          </div>
          <div class="ml-line ml-series-3" style="clip-path: polygon(0% 41%, 25% 46%, 50% 56%, 75% 61%, 100% 66%, 100% 64%, 75% 59%, 50% 54%, 25% 44%, 0% 39%);">
            <div class="ml-point" style="left: 0%; bottom: 60%;"><span class="ml-point-label">[60]</span></div>
            <div class="ml-point" style="left: 25%; bottom: 55%;"><span class="ml-point-label">[55]</span></div>
            <div class="ml-point" style="left: 50%; bottom: 45%;"><span class="ml-point-label">[45]</span></div>
            <div class="ml-point" style="left: 75%; bottom: 40%;"><span class="ml-point-label">[40]</span></div>
            <div class="ml-point" style="left: 100%; bottom: 35%;"><span class="ml-point-label">[35]</span></div>
          </div>
        </div>
        <div class="ml-x-axis">
          <span>[2020]</span>
          <span>[2021]</span>
          <span>[2022]</span>
          <span>[2023]</span>
          <span>[2024]</span>
        </div>
      </div>
      <div class="chart-takeaway">
        <strong>[Series A]</strong> [outpaced all other series with 4x growth, while <strong>[Series C]</strong> declined steadily over the period.]
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source, methodology]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // ── CHART: Grouped Column Chart ──────────────────────────────────
  groupedColumnChart: {
    title: 'Grouped Column Chart',
    description: 'Vertical grouped bars comparing multiple categories across periods',
    category: 'Data & Metrics',
    type: 'chart',
    master: 'standard',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key comparison insight across groups]</h1>
  <h2 class="subtitle">[Categories compared by period or segment]</h2>
  <div class="frame">
    <div class="gc-chart-exhibit">
      <div class="gc-legend">
        <span class="gc-legend-item"><span class="gc-legend-swatch gc-series-1"></span>[Group A]</span>
        <span class="gc-legend-item"><span class="gc-legend-swatch gc-series-2"></span>[Group B]</span>
        <span class="gc-legend-item"><span class="gc-legend-swatch gc-series-3"></span>[Group C]</span>
      </div>
      <div class="gc-chart-area">
        <div class="gc-y-axis">
          <span>[100]</span>
          <span>[75]</span>
          <span>[50]</span>
          <span>[25]</span>
          <span>[0]</span>
        </div>
        <div class="gc-plot">
          <div class="gc-group" data-label="[Category 1]">
            <div class="gc-bar gc-series-1" style="height: 65%;"><span class="gc-bar-value">[65]</span></div>
            <div class="gc-bar gc-series-2" style="height: 45%;"><span class="gc-bar-value">[45]</span></div>
            <div class="gc-bar gc-series-3" style="height: 55%;"><span class="gc-bar-value">[55]</span></div>
            <span class="gc-group-label">[Cat 1]</span>
          </div>
          <div class="gc-group" data-label="[Category 2]">
            <div class="gc-bar gc-series-1" style="height: 80%;"><span class="gc-bar-value">[80]</span></div>
            <div class="gc-bar gc-series-2" style="height: 60%;"><span class="gc-bar-value">[60]</span></div>
            <div class="gc-bar gc-series-3" style="height: 70%;"><span class="gc-bar-value">[70]</span></div>
            <span class="gc-group-label">[Cat 2]</span>
          </div>
          <div class="gc-group" data-label="[Category 3]">
            <div class="gc-bar gc-series-1" style="height: 50%;"><span class="gc-bar-value">[50]</span></div>
            <div class="gc-bar gc-series-2" style="height: 75%;"><span class="gc-bar-value">[75]</span></div>
            <div class="gc-bar gc-series-3" style="height: 40%;"><span class="gc-bar-value">[40]</span></div>
            <span class="gc-group-label">[Cat 3]</span>
          </div>
          <div class="gc-group" data-label="[Category 4]">
            <div class="gc-bar gc-series-1" style="height: 70%;"><span class="gc-bar-value">[70]</span></div>
            <div class="gc-bar gc-series-2" style="height: 55%;"><span class="gc-bar-value">[55]</span></div>
            <div class="gc-bar gc-series-3" style="height: 85%;"><span class="gc-bar-value">[85]</span></div>
            <span class="gc-group-label">[Cat 4]</span>
          </div>
        </div>
      </div>
      <div class="chart-takeaway">
        <strong>[Group C]</strong> [leads in Category 4 at 85, while <strong>[Group A]</strong> dominates Category 2 at 80 — the widest gap between groups.]
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source, methodology]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // ── CHART: Stacked Bar Chart ─────────────────────────────────────
  stackedBarChart: {
    title: 'Stacked Bar Chart',
    description: 'Horizontal stacked bars showing composition across categories',
    category: 'Data & Metrics',
    type: 'chart',
    master: 'standard',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight from composition analysis]</h1>
  <h2 class="subtitle">[Breakdown by segment across categories]</h2>
  <div class="frame">
    <div class="sb-chart-exhibit">
      <div class="sb-legend">
        <span class="sb-legend-item"><span class="sb-legend-swatch sb-seg-1"></span>[Segment A]</span>
        <span class="sb-legend-item"><span class="sb-legend-swatch sb-seg-2"></span>[Segment B]</span>
        <span class="sb-legend-item"><span class="sb-legend-swatch sb-seg-3"></span>[Segment C]</span>
        <span class="sb-legend-item"><span class="sb-legend-swatch sb-seg-4"></span>[Segment D]</span>
      </div>
      <div class="sb-chart-area">
        <div class="sb-row">
          <div class="sb-label">[Category 1]</div>
          <div class="sb-track">
            <div class="sb-segment sb-seg-1" style="width: 35%;"><span>[35%]</span></div>
            <div class="sb-segment sb-seg-2" style="width: 25%;"><span>[25%]</span></div>
            <div class="sb-segment sb-seg-3" style="width: 20%;"><span>[20%]</span></div>
            <div class="sb-segment sb-seg-4" style="width: 20%;"><span>[20%]</span></div>
          </div>
          <div class="sb-total">[100]</div>
        </div>
        <div class="sb-row">
          <div class="sb-label">[Category 2]</div>
          <div class="sb-track">
            <div class="sb-segment sb-seg-1" style="width: 20%;"><span>[20%]</span></div>
            <div class="sb-segment sb-seg-2" style="width: 30%;"><span>[30%]</span></div>
            <div class="sb-segment sb-seg-3" style="width: 30%;"><span>[30%]</span></div>
            <div class="sb-segment sb-seg-4" style="width: 20%;"><span>[20%]</span></div>
          </div>
          <div class="sb-total">[100]</div>
        </div>
        <div class="sb-row">
          <div class="sb-label">[Category 3]</div>
          <div class="sb-track">
            <div class="sb-segment sb-seg-1" style="width: 45%;"><span>[45%]</span></div>
            <div class="sb-segment sb-seg-2" style="width: 20%;"><span>[20%]</span></div>
            <div class="sb-segment sb-seg-3" style="width: 15%;"><span>[15%]</span></div>
            <div class="sb-segment sb-seg-4" style="width: 20%;"><span>[20%]</span></div>
          </div>
          <div class="sb-total">[100]</div>
        </div>
        <div class="sb-row">
          <div class="sb-label">[Category 4]</div>
          <div class="sb-track">
            <div class="sb-segment sb-seg-1" style="width: 25%;"><span>[25%]</span></div>
            <div class="sb-segment sb-seg-2" style="width: 25%;"><span>[25%]</span></div>
            <div class="sb-segment sb-seg-3" style="width: 25%;"><span>[25%]</span></div>
            <div class="sb-segment sb-seg-4" style="width: 25%;"><span>[25%]</span></div>
          </div>
          <div class="sb-total">[100]</div>
        </div>
        <div class="sb-row">
          <div class="sb-label">[Category 5]</div>
          <div class="sb-track">
            <div class="sb-segment sb-seg-1" style="width: 15%;"><span>[15%]</span></div>
            <div class="sb-segment sb-seg-2" style="width: 35%;"><span>[35%]</span></div>
            <div class="sb-segment sb-seg-3" style="width: 30%;"><span>[30%]</span></div>
            <div class="sb-segment sb-seg-4" style="width: 20%;"><span>[20%]</span></div>
          </div>
          <div class="sb-total">[100]</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data source, methodology]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  consultantResume: {
    id: 'consultantResume',
    title: 'Consultant Resume',
    type: 'consultant-resume',
    master: 'blank',
    description: 'Individual consultant profile with photo, bio, experience, and case studies',
    note: 'Full-bleed two-panel layout. Left dark sidebar (25%) has photo, overview, experience, and education. Right panel (75%) shows relevant case studies. No standard margins — content runs edge to edge.',
    thumbnail: 'resume',
    category: 'Content',
    html: `<div class="slide blank-slide master-blank resume-slide">
  <div class="resume-layout">
    <div class="resume-sidebar">
      <div class="resume-photo">[Photo]</div>
      <h3 class="resume-name">[Full Name]</h3>
      <span class="resume-role">[Title / Role]</span>

      <div class="resume-section">
        <h4>Overview</h4>
        <p>[Brief professional summary highlighting core expertise, years of experience, and areas of specialization relevant to this engagement.]</p>
      </div>

      <div class="resume-section">
        <h4>Experience</h4>
        <div class="resume-exp-item">
          <span class="resume-exp-title">[Senior Consultant]</span>
          <span class="resume-exp-org">[Firm Name] · [2020 – Present]</span>
        </div>
        <div class="resume-exp-item">
          <span class="resume-exp-title">[Consultant]</span>
          <span class="resume-exp-org">[Previous Firm] · [2016 – 2020]</span>
        </div>
        <div class="resume-exp-item">
          <span class="resume-exp-title">[Analyst]</span>
          <span class="resume-exp-org">[Earlier Firm] · [2013 – 2016]</span>
        </div>
      </div>

      <div class="resume-section">
        <h4>Education</h4>
        <div class="resume-exp-item">
          <span class="resume-exp-title">[MBA, Finance]</span>
          <span class="resume-exp-org">[University Name] · [Year]</span>
        </div>
        <div class="resume-exp-item">
          <span class="resume-exp-title">[B.Sc. Economics]</span>
          <span class="resume-exp-org">[University Name] · [Year]</span>
        </div>
      </div>
    </div>

    <div class="resume-main">
      <h2 class="resume-main-heading">[Relevant Case Studies]</h2>

      <div class="resume-case">
        <h4>[Project or client name]</h4>
        <span class="resume-case-meta">[Industry] · [Year] · [Role on engagement]</span>
        <p>[Description of the engagement, the consultant's specific contribution, key deliverables, and measurable outcomes achieved.]</p>
      </div>

      <div class="resume-case">
        <h4>[Project or client name]</h4>
        <span class="resume-case-meta">[Industry] · [Year] · [Role on engagement]</span>
        <p>[Description of the engagement, the consultant's specific contribution, key deliverables, and measurable outcomes achieved.]</p>
      </div>

      <div class="resume-case">
        <h4>[Project or client name]</h4>
        <span class="resume-case-meta">[Industry] · [Year] · [Role on engagement]</span>
        <p>[Description of the engagement, the consultant's specific contribution, key deliverables, and measurable outcomes achieved.]</p>
      </div>
    </div>
  </div>
</div>`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  HIGH-DENSITY TEMPLATES — for data-heavy content that needs to fit
  // ═══════════════════════════════════════════════════════════════════════

  grid2x3: {
    id: 'grid2x3',
    title: '2×3 Grid',
    type: 'grid-2x3',
    master: 'standard',
    description: 'Six-cell grid (2 columns × 3 rows) for detailed item lists or categorized content',
    note: '2 columns × 3 rows grid. Each cell has heading + short text. Use when you have 6 items that need more vertical space per item than 3×2. Cells are taller, so each can hold 2-3 short lines.',
    thumbnail: 'grid',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight heading about the six items]</h1>
  <h2 class="subtitle">[Topic label]</h2>
  <div class="frame">
    <div class="grid-2x3" style="display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr 1fr; gap:8px; height:100%;">
      <div class="grid-2x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 12px;">
        <h4 style="font-size:12px; margin:0 0 4px 0; color:var(--heading);">[Item 1 Title]</h4>
        <p style="font-size:10px; margin:0; line-height:1.3; color:var(--muted);">[Item 1 description — 2-3 short lines]</p>
      </div>
      <div class="grid-2x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 12px;">
        <h4 style="font-size:12px; margin:0 0 4px 0; color:var(--heading);">[Item 2 Title]</h4>
        <p style="font-size:10px; margin:0; line-height:1.3; color:var(--muted);">[Item 2 description]</p>
      </div>
      <div class="grid-2x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 12px;">
        <h4 style="font-size:12px; margin:0 0 4px 0; color:var(--heading);">[Item 3 Title]</h4>
        <p style="font-size:10px; margin:0; line-height:1.3; color:var(--muted);">[Item 3 description]</p>
      </div>
      <div class="grid-2x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 12px;">
        <h4 style="font-size:12px; margin:0 0 4px 0; color:var(--heading);">[Item 4 Title]</h4>
        <p style="font-size:10px; margin:0; line-height:1.3; color:var(--muted);">[Item 4 description]</p>
      </div>
      <div class="grid-2x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 12px;">
        <h4 style="font-size:12px; margin:0 0 4px 0; color:var(--heading);">[Item 5 Title]</h4>
        <p style="font-size:10px; margin:0; line-height:1.3; color:var(--muted);">[Item 5 description]</p>
      </div>
      <div class="grid-2x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 12px;">
        <h4 style="font-size:12px; margin:0 0 4px 0; color:var(--heading);">[Item 6 Title]</h4>
        <p style="font-size:10px; margin:0; line-height:1.3; color:var(--muted);">[Item 6 description]</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  grid3x3: {
    id: 'grid3x3',
    title: '3×3 Grid',
    type: 'grid-3x3',
    master: 'standard',
    description: 'Nine-cell grid for comprehensive frameworks or large categorizations',
    note: '3×3 grid — very compact cells. Title + 1-line description max per cell. Use for 9-item frameworks, capability maps, or feature matrices. Keep text very short.',
    thumbnail: 'grid',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight heading about the nine areas]</h1>
  <h2 class="subtitle">[Topic label]</h2>
  <div class="frame">
    <div class="grid-3x3" style="display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:1fr 1fr 1fr; gap:6px; height:100%;">
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 1]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 2]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 3]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 4]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 5]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 6]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 7]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 8]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
      <div class="grid-3x3-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:8px;">
        <h4 style="font-size:11px; margin:0 0 2px 0; color:var(--heading);">[Item 9]</h4>
        <p style="font-size:9px; margin:0; line-height:1.2; color:var(--muted);">[Brief description]</p>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  bulletsDense: {
    id: 'bulletsDense',
    title: 'Dense Card Grid',
    type: 'bullets-dense',
    master: 'standard',
    description: 'Grid of 12 numbered cards — light grey boxes with burgundy numbering, title, and description',
    note: 'A 3-column × 4-row grid of compact cards. Each card: white-numbered burgundy square + small burgundy title (2-3 words) + brief description (max 8 words). Light grey background. 12 items default (8-15 range). Use for action items, requirements, findings, recommendations.',
    thumbnail: 'grid',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight heading about the list]</h1>
  <h2 class="subtitle">[Topic label]</h2>
  <div class="frame">
    <div class="dense-grid">
      <div class="dense-card"><span class="dense-num">1</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description — max 8 words]</span></div></div>
      <div class="dense-card"><span class="dense-num">2</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">3</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">4</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">5</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">6</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">7</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">8</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">9</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">10</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">11</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
      <div class="dense-card"><span class="dense-num">12</span><div class="dense-body"><span class="dense-title">[Title]</span><span class="dense-desc">[Brief description]</span></div></div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  twoColumnBoxes: {
    id: 'twoColumnBoxes',
    title: 'Two Column Boxes',
    type: 'two-col-boxes',
    master: 'standard',
    description: 'Two columns of compact labeled boxes, up to 10 per column',
    note: 'Two side-by-side columns with stacked label boxes. 5-10 items per column. Use for categorized lists, grouped findings, A/B comparisons with many points. Keep labels short (6-8 words per box).',
    thumbnail: 'grid',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight heading]</h1>
  <h2 class="subtitle">[Topic label]</h2>
  <div class="frame">
    <div class="two-col-boxes" style="display:flex; gap:12px; height:100%;">
      <div class="col-box-list" style="flex:1; display:flex; flex-direction:column; gap:3px;">
        <div class="col-box-header" style="font-size:12px; font-weight:bold; color:var(--accent); margin-bottom:4px;">[Column A Title]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item A1]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item A2]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item A3]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item A4]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item A5]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item A6]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item A7]</div>
      </div>
      <div class="col-box-list" style="flex:1; display:flex; flex-direction:column; gap:3px;">
        <div class="col-box-header" style="font-size:12px; font-weight:bold; color:var(--accent); margin-bottom:4px;">[Column B Title]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item B1]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item B2]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item B3]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item B4]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item B5]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item B6]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 8px; font-size:10px; line-height:1.3;">[Item B7]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  threeColumnBoxes: {
    id: 'threeColumnBoxes',
    title: 'Three Column Boxes',
    type: 'three-col-boxes',
    master: 'standard',
    description: 'Three columns of compact labeled boxes, up to 10 per column',
    note: 'Three side-by-side columns with stacked label boxes. 5-10 items per column. Use for three-way categorization, multi-stream work plans, or grouped deliverables. Keep labels very short (5-6 words per box).',
    thumbnail: 'grid',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight heading]</h1>
  <h2 class="subtitle">[Topic label]</h2>
  <div class="frame">
    <div class="three-col-boxes" style="display:flex; gap:10px; height:100%;">
      <div class="col-box-list" style="flex:1; display:flex; flex-direction:column; gap:3px;">
        <div class="col-box-header" style="font-size:11px; font-weight:bold; color:var(--accent); margin-bottom:3px;">[Column A]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item A1]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item A2]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item A3]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item A4]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item A5]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item A6]</div>
      </div>
      <div class="col-box-list" style="flex:1; display:flex; flex-direction:column; gap:3px;">
        <div class="col-box-header" style="font-size:11px; font-weight:bold; color:var(--accent); margin-bottom:3px;">[Column B]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item B1]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item B2]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item B3]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item B4]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item B5]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item B6]</div>
      </div>
      <div class="col-box-list" style="flex:1; display:flex; flex-direction:column; gap:3px;">
        <div class="col-box-header" style="font-size:11px; font-weight:bold; color:var(--accent); margin-bottom:3px;">[Column C]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item C1]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item C2]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item C3]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item C4]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item C5]</div>
        <div class="col-box-item" style="background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:3px 6px; font-size:9px; line-height:1.3;">[Item C6]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  denseTable: {
    id: 'denseTable',
    title: 'Dense Data Table',
    type: 'table-dense',
    master: 'standard',
    description: 'Compact data table with 10-15 rows and 5-6 columns for heavy tabular data',
    note: 'High-density data table. Font 9-10px, minimal padding. Use for financial tables, detailed comparisons, audit logs, feature matrices, or any dense tabular data. Keep cell text to 2-4 words.',
    thumbnail: 'table',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key insight from the data]</h1>
  <h2 class="subtitle">[Data context]</h2>
  <div class="frame" style="display:flex; flex-direction:column;">
    <table class="dense-table" style="width:100%; border-collapse:collapse; font-size:9px; flex:1;">
      <thead>
        <tr>
          <th style="background:var(--accent); color:var(--on-accent); padding:6px 8px; font-size:9px; text-align:left; font-weight:600;">[Column 1]</th>
          <th style="background:var(--accent); color:var(--on-accent); padding:6px 8px; font-size:9px; text-align:left; font-weight:600;">[Column 2]</th>
          <th style="background:var(--accent); color:var(--on-accent); padding:6px 8px; font-size:9px; text-align:left; font-weight:600;">[Column 3]</th>
          <th style="background:var(--accent); color:var(--on-accent); padding:6px 8px; font-size:9px; text-align:left; font-weight:600;">[Column 4]</th>
          <th style="background:var(--accent); color:var(--on-accent); padding:6px 8px; font-size:9px; text-align:left; font-weight:600;">[Column 5]</th>
          <th style="background:var(--accent); color:var(--on-accent); padding:6px 8px; font-size:9px; text-align:left; font-weight:600;">[Column 6]</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 1]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr style="background:var(--surface);"><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 2]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 3]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr style="background:var(--surface);"><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 4]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 5]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr style="background:var(--surface);"><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 6]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 7]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr style="background:var(--surface);"><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 8]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 9]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
        <tr style="background:var(--surface);"><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px; font-weight:600;">[Row 10]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td><td style="padding:5px 8px; border-bottom:1px solid var(--border); font-size:9px;">[Val]</td></tr>
      </tbody>
    </table>
  </div>
  <footer class="footer">
    <span>Source: [Data source]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // ============================================
  // STRATEGY PROJECT TEMPLATES
  // ============================================

  // 1) Vision & Mission — Aspirational statement with supporting elements
  visionMission: {
    id: 'visionMission',
    title: 'Vision & Mission',
    type: 'strategy',
    master: 'standard',
    description: 'Vision and mission statement with supporting values or pillars',
    note: 'Aspirational slide with centered vision statement and supporting mission/values. Use for strategy kickoffs, organizational purpose, or transformation north star.',
    thumbnail: 'vision',
    category: 'Opening',
    html: `<div class="slide master-standard">
  <h1 class="title">[Organization or Strategy Name]</h1>
  <h2 class="subtitle">[Context — e.g., "Our Strategic Direction 2025-2030"]</h2>
  <div class="frame">
    <div class="vision-mission-container">
      <div class="vision-block">
        <div class="vision-label">Vision</div>
        <div class="vision-statement">[Aspirational future state — what we want to become]</div>
      </div>
      <div class="mission-block">
        <div class="mission-label">Mission</div>
        <div class="mission-statement">[How we will achieve our vision — our purpose and approach]</div>
      </div>
      <div class="values-row">
        <div class="value-item">
          <div class="value-icon">[Icon]</div>
          <div class="value-name">[Value 1]</div>
          <div class="value-desc">[Brief description]</div>
        </div>
        <div class="value-item">
          <div class="value-icon">[Icon]</div>
          <div class="value-name">[Value 2]</div>
          <div class="value-desc">[Brief description]</div>
        </div>
        <div class="value-item">
          <div class="value-icon">[Icon]</div>
          <div class="value-name">[Value 3]</div>
          <div class="value-desc">[Brief description]</div>
        </div>
        <div class="value-item">
          <div class="value-icon">[Icon]</div>
          <div class="value-name">[Value 4]</div>
          <div class="value-desc">[Brief description]</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 2) Baseline Assessment — Current state across key dimensions
  baselineAssessment: {
    id: 'baselineAssessment',
    title: 'Baseline Assessment',
    type: 'strategy',
    master: 'standard',
    description: 'Current state assessment across multiple strategic dimensions with scores',
    note: 'Shows current performance baseline across 5-6 dimensions with visual scores and key findings. Use at start of strategy work to establish "where we are today".',
    thumbnail: 'baseline',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key baseline insight — e.g., "Strong commercial foundation, but digital and talent require investment"]</h1>
  <h2 class="subtitle">[Context — e.g., "Current State Assessment | Q4 2024"]</h2>
  <div class="frame">
    <div class="baseline-container">
      <div class="baseline-dimensions">
        <div class="baseline-dim">
          <div class="baseline-dim-header">
            <span class="baseline-dim-name">[Financial Health]</span>
            <span class="baseline-dim-score baseline-score-high">[4.2/5]</span>
          </div>
          <div class="baseline-score-bar">
            <div class="baseline-score-fill" style="width: 84%;"></div>
          </div>
          <div class="baseline-dim-findings">
            <span class="baseline-finding">[Strong revenue growth +12% YoY]</span>
            <span class="baseline-finding">[Healthy margins at 18%]</span>
          </div>
        </div>
        <div class="baseline-dim">
          <div class="baseline-dim-header">
            <span class="baseline-dim-name">[Market Position]</span>
            <span class="baseline-dim-score baseline-score-high">[3.8/5]</span>
          </div>
          <div class="baseline-score-bar">
            <div class="baseline-score-fill" style="width: 76%;"></div>
          </div>
          <div class="baseline-dim-findings">
            <span class="baseline-finding">[#2 market share in core segment]</span>
            <span class="baseline-finding">[Brand recognition declining in key demo]</span>
          </div>
        </div>
        <div class="baseline-dim">
          <div class="baseline-dim-header">
            <span class="baseline-dim-name">[Operational Excellence]</span>
            <span class="baseline-dim-score baseline-score-medium">[3.1/5]</span>
          </div>
          <div class="baseline-score-bar">
            <div class="baseline-score-fill" style="width: 62%;"></div>
          </div>
          <div class="baseline-dim-findings">
            <span class="baseline-finding">[Process efficiency 15% below benchmark]</span>
            <span class="baseline-finding">[Quality metrics improving]</span>
          </div>
        </div>
        <div class="baseline-dim">
          <div class="baseline-dim-header">
            <span class="baseline-dim-name">[Digital Capability]</span>
            <span class="baseline-dim-score baseline-score-low">[2.3/5]</span>
          </div>
          <div class="baseline-score-bar">
            <div class="baseline-score-fill" style="width: 46%;"></div>
          </div>
          <div class="baseline-dim-findings">
            <span class="baseline-finding">[Legacy systems limit agility]</span>
            <span class="baseline-finding">[Data infrastructure fragmented]</span>
          </div>
        </div>
        <div class="baseline-dim">
          <div class="baseline-dim-header">
            <span class="baseline-dim-name">[Talent & Culture]</span>
            <span class="baseline-dim-score baseline-score-low">[2.5/5]</span>
          </div>
          <div class="baseline-score-bar">
            <div class="baseline-score-fill" style="width: 50%;"></div>
          </div>
          <div class="baseline-dim-findings">
            <span class="baseline-finding">[Key skill gaps in analytics, digital]</span>
            <span class="baseline-finding">[Engagement scores trending down]</span>
          </div>
        </div>
      </div>
      <div class="baseline-summary">
        <div class="baseline-summary-title">Assessment Summary</div>
        <div class="baseline-summary-item baseline-strength">
          <span class="baseline-summary-icon">+</span>
          <span class="baseline-summary-text">[Strengths: Financial position enables investment]</span>
        </div>
        <div class="baseline-summary-item baseline-weakness">
          <span class="baseline-summary-icon">−</span>
          <span class="baseline-summary-text">[Gaps: Digital and talent require urgent attention]</span>
        </div>
        <div class="baseline-summary-item baseline-opportunity">
          <span class="baseline-summary-icon">→</span>
          <span class="baseline-summary-text">[Opportunity: Modernization could unlock 25% efficiency]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Assessment methodology, date]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 3) Strategic Benchmark — Company vs competitors/peers
  strategicBenchmark: {
    id: 'strategicBenchmark',
    title: 'Strategic Benchmark',
    type: 'strategy',
    master: 'standard',
    description: 'Visual comparison of company against key competitors across strategic dimensions',
    note: 'Radar-style or bar comparison showing competitive positioning. Use for competitive analysis, market positioning, or identifying strategic gaps.',
    thumbnail: 'benchmark',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Key competitive insight — e.g., "Leading on service, trailing on digital and cost"]</h1>
  <h2 class="subtitle">[Context — e.g., "Competitive Benchmark vs. Top 3 Peers"]</h2>
  <div class="frame">
    <div class="strategic-benchmark">
      <div class="benchmark-chart">
        <div class="benchmark-dimension">
          <div class="benchmark-dim-label">[Revenue Growth]</div>
          <div class="benchmark-bars">
            <div class="benchmark-bar-row">
              <span class="benchmark-entity benchmark-entity-self">[Company]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-self" style="width: 75%;"></div>
              </div>
              <span class="benchmark-bar-value">[+8%]</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-entity">[Competitor A]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-peer" style="width: 90%;"></div>
              </div>
              <span class="benchmark-bar-value">[+12%]</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-entity">[Competitor B]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-peer" style="width: 60%;"></div>
              </div>
              <span class="benchmark-bar-value">[+5%]</span>
            </div>
          </div>
        </div>
        <div class="benchmark-dimension">
          <div class="benchmark-dim-label">[Operating Margin]</div>
          <div class="benchmark-bars">
            <div class="benchmark-bar-row">
              <span class="benchmark-entity benchmark-entity-self">[Company]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-self" style="width: 85%;"></div>
              </div>
              <span class="benchmark-bar-value">[18%]</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-entity">[Competitor A]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-peer" style="width: 70%;"></div>
              </div>
              <span class="benchmark-bar-value">[15%]</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-entity">[Competitor B]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-peer" style="width: 95%;"></div>
              </div>
              <span class="benchmark-bar-value">[22%]</span>
            </div>
          </div>
        </div>
        <div class="benchmark-dimension">
          <div class="benchmark-dim-label">[Customer NPS]</div>
          <div class="benchmark-bars">
            <div class="benchmark-bar-row">
              <span class="benchmark-entity benchmark-entity-self">[Company]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-self" style="width: 92%;"></div>
              </div>
              <span class="benchmark-bar-value">[+62]</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-entity">[Competitor A]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-peer" style="width: 68%;"></div>
              </div>
              <span class="benchmark-bar-value">[+45]</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-entity">[Competitor B]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-peer" style="width: 75%;"></div>
              </div>
              <span class="benchmark-bar-value">[+51]</span>
            </div>
          </div>
        </div>
        <div class="benchmark-dimension">
          <div class="benchmark-dim-label">[Digital Maturity]</div>
          <div class="benchmark-bars">
            <div class="benchmark-bar-row">
              <span class="benchmark-entity benchmark-entity-self">[Company]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-self" style="width: 45%;"></div>
              </div>
              <span class="benchmark-bar-value">[2.3]</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-entity">[Competitor A]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-peer" style="width: 85%;"></div>
              </div>
              <span class="benchmark-bar-value">[4.2]</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-entity">[Competitor B]</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar benchmark-bar-peer" style="width: 72%;"></div>
              </div>
              <span class="benchmark-bar-value">[3.6]</span>
            </div>
          </div>
        </div>
      </div>
      <div class="benchmark-insights">
        <div class="benchmark-insight-title">Key Insights</div>
        <div class="benchmark-insight benchmark-insight-lead">
          <span class="benchmark-insight-marker">▲</span>
          <span>[Leading in customer experience and loyalty]</span>
        </div>
        <div class="benchmark-insight benchmark-insight-lag">
          <span class="benchmark-insight-marker">▼</span>
          <span>[Trailing peers significantly on digital transformation]</span>
        </div>
        <div class="benchmark-insight benchmark-insight-lag">
          <span class="benchmark-insight-marker">▼</span>
          <span>[Growth rate below market leader]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Data sources, analysis date]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 4) Strategic Themes — Key strategic pillars/themes
  strategicThemes: {
    id: 'strategicThemes',
    title: 'Strategic Themes',
    type: 'strategy',
    master: 'standard',
    description: 'Three to four major strategic themes or pillars with descriptions and objectives',
    note: 'High-level strategic themes that organize the strategy. Each theme has a name, description, and key objectives. Use to present the strategic framework.',
    thumbnail: 'themes',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Strategic framework title — e.g., "Four Pillars of Our 2025 Strategy"]</h1>
  <h2 class="subtitle">[Context — e.g., "Transforming for sustainable growth"]</h2>
  <div class="frame">
    <div class="strategic-themes">
      <div class="theme-card theme-1">
        <div class="theme-number">01</div>
        <div class="theme-content">
          <div class="theme-name">[Growth & Expansion]</div>
          <div class="theme-desc">[Drive organic growth through new markets and products while strengthening core business]</div>
          <div class="theme-objectives">
            <div class="theme-objective">[Enter 3 new markets by 2026]</div>
            <div class="theme-objective">[Launch 2 adjacent products]</div>
            <div class="theme-objective">[Grow core revenue 15% CAGR]</div>
          </div>
        </div>
        <div class="theme-icon">[Icon]</div>
      </div>
      <div class="theme-card theme-2">
        <div class="theme-number">02</div>
        <div class="theme-content">
          <div class="theme-name">[Digital Transformation]</div>
          <div class="theme-desc">[Modernize technology foundation and build digital capabilities across the enterprise]</div>
          <div class="theme-objectives">
            <div class="theme-objective">[Complete cloud migration]</div>
            <div class="theme-objective">[Deploy AI/ML in 5 use cases]</div>
            <div class="theme-objective">[Achieve 80% process automation]</div>
          </div>
        </div>
        <div class="theme-icon">[Icon]</div>
      </div>
      <div class="theme-card theme-3">
        <div class="theme-number">03</div>
        <div class="theme-content">
          <div class="theme-name">[Operational Excellence]</div>
          <div class="theme-desc">[Streamline operations, reduce costs, and improve quality to fund growth investments]</div>
          <div class="theme-objectives">
            <div class="theme-objective">[Reduce cost base by $50M]</div>
            <div class="theme-objective">[Improve NPS by 15 points]</div>
            <div class="theme-objective">[Cut cycle time 30%]</div>
          </div>
        </div>
        <div class="theme-icon">[Icon]</div>
      </div>
      <div class="theme-card theme-4">
        <div class="theme-number">04</div>
        <div class="theme-content">
          <div class="theme-name">[People & Culture]</div>
          <div class="theme-desc">[Build capabilities, attract talent, and foster a high-performance culture]</div>
          <div class="theme-objectives">
            <div class="theme-objective">[Close critical skill gaps]</div>
            <div class="theme-objective">[Increase engagement to 75%]</div>
            <div class="theme-objective">[Reduce attrition to 12%]</div>
          </div>
        </div>
        <div class="theme-icon">[Icon]</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 5) Strategic Themes Visual — Alternative pyramid/interconnected view
  strategicThemesVisual: {
    id: 'strategicThemesVisual',
    title: 'Strategic Themes Visual',
    type: 'strategy',
    master: 'standard',
    description: 'Visual representation of strategic themes showing interconnection and foundation',
    note: 'Pyramid or layered view showing how strategic themes connect and build on each other. Use for executive presentations to show strategic architecture.',
    thumbnail: 'themes-visual',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Strategic architecture — e.g., "Building Blocks of Our Strategy"]</h1>
  <h2 class="subtitle">[Context — e.g., "An integrated approach to transformation"]</h2>
  <div class="frame">
    <div class="themes-pyramid">
      <div class="pyramid-level pyramid-top">
        <div class="pyramid-block pyramid-block-top">
          <div class="pyramid-block-title">[Vision]</div>
          <div class="pyramid-block-text">[Become the market leader in sustainable solutions]</div>
        </div>
      </div>
      <div class="pyramid-level pyramid-mid">
        <div class="pyramid-block pyramid-block-mid">
          <div class="pyramid-block-title">[Strategic Priority 1]</div>
          <div class="pyramid-block-text">[Customer-centric growth]</div>
        </div>
        <div class="pyramid-block pyramid-block-mid">
          <div class="pyramid-block-title">[Strategic Priority 2]</div>
          <div class="pyramid-block-text">[Operational excellence]</div>
        </div>
        <div class="pyramid-block pyramid-block-mid">
          <div class="pyramid-block-title">[Strategic Priority 3]</div>
          <div class="pyramid-block-text">[Innovation leadership]</div>
        </div>
      </div>
      <div class="pyramid-level pyramid-base">
        <div class="pyramid-block pyramid-block-base">
          <div class="pyramid-enabler">
            <span class="enabler-icon">[Icon]</span>
            <span class="enabler-text">[Digital & Data]</span>
          </div>
          <div class="pyramid-enabler">
            <span class="enabler-icon">[Icon]</span>
            <span class="enabler-text">[Talent & Culture]</span>
          </div>
          <div class="pyramid-enabler">
            <span class="enabler-icon">[Icon]</span>
            <span class="enabler-text">[Governance]</span>
          </div>
          <div class="pyramid-enabler">
            <span class="enabler-icon">[Icon]</span>
            <span class="enabler-text">[Partnerships]</span>
          </div>
        </div>
        <div class="pyramid-base-label">Enabling Foundations</div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 6) Initiatives Long List — All initiatives in structured table
  initiativesLongList: {
    id: 'initiativesLongList',
    title: 'Initiatives Long List',
    type: 'strategy',
    master: 'standard',
    description: 'Comprehensive list of strategic initiatives with theme, owner, timeline, and sizing',
    note: 'Master list of all initiatives organized by strategic theme. Shows initiative name, owner, timeline, and high-level sizing. MAX 10 initiatives per slide — if more than 10, duplicate this template across multiple slides (e.g., slide 1: initiatives 1-10, slide 2: initiatives 11-20).',
    thumbnail: 'initiatives-list',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Initiatives overview — e.g., "15 initiatives across 4 strategic themes"]</h1>
  <h2 class="subtitle">[Context — e.g., "Strategic Initiative Portfolio 2025-2027"]</h2>
  <div class="frame">
    <div class="initiatives-list">
      <div class="initiatives-header">
        <span class="init-col init-col-id">#</span>
        <span class="init-col init-col-name">Initiative</span>
        <span class="init-col init-col-theme">Theme</span>
        <span class="init-col init-col-owner">Owner</span>
        <span class="init-col init-col-timeline">Timeline</span>
        <span class="init-col init-col-investment">Investment</span>
        <span class="init-col init-col-impact">Impact</span>
      </div>
      <div class="initiatives-body">
        <div class="initiative-row">
          <span class="init-col init-col-id">1</span>
          <span class="init-col init-col-name">[Cloud infrastructure modernization]</span>
          <span class="init-col init-col-theme init-theme-digital">[Digital]</span>
          <span class="init-col init-col-owner">[CTO]</span>
          <span class="init-col init-col-timeline">[Q1-Q4 2025]</span>
          <span class="init-col init-col-investment">[$15M]</span>
          <span class="init-col init-col-impact init-impact-high">[High]</span>
        </div>
        <div class="initiative-row">
          <span class="init-col init-col-id">2</span>
          <span class="init-col init-col-name">[Customer analytics platform]</span>
          <span class="init-col init-col-theme init-theme-digital">[Digital]</span>
          <span class="init-col init-col-owner">[CDO]</span>
          <span class="init-col init-col-timeline">[Q2-Q4 2025]</span>
          <span class="init-col init-col-investment">[$8M]</span>
          <span class="init-col init-col-impact init-impact-high">[High]</span>
        </div>
        <div class="initiative-row">
          <span class="init-col init-col-id">3</span>
          <span class="init-col init-col-name">[APAC market entry]</span>
          <span class="init-col init-col-theme init-theme-growth">[Growth]</span>
          <span class="init-col init-col-owner">[CSO]</span>
          <span class="init-col init-col-timeline">[Q1 2025-Q2 2026]</span>
          <span class="init-col init-col-investment">[$25M]</span>
          <span class="init-col init-col-impact init-impact-high">[High]</span>
        </div>
        <div class="initiative-row">
          <span class="init-col init-col-id">4</span>
          <span class="init-col init-col-name">[Process automation wave 1]</span>
          <span class="init-col init-col-theme init-theme-ops">[Operations]</span>
          <span class="init-col init-col-owner">[COO]</span>
          <span class="init-col init-col-timeline">[Q1-Q3 2025]</span>
          <span class="init-col init-col-investment">[$5M]</span>
          <span class="init-col init-col-impact init-impact-medium">[Med]</span>
        </div>
        <div class="initiative-row">
          <span class="init-col init-col-id">5</span>
          <span class="init-col init-col-name">[Leadership development program]</span>
          <span class="init-col init-col-theme init-theme-people">[People]</span>
          <span class="init-col init-col-owner">[CHRO]</span>
          <span class="init-col init-col-timeline">[Q1 2025-Q4 2026]</span>
          <span class="init-col init-col-investment">[$3M]</span>
          <span class="init-col init-col-impact init-impact-medium">[Med]</span>
        </div>
        <div class="initiative-row">
          <span class="init-col init-col-id">6</span>
          <span class="init-col init-col-name">[Product line extension — Premium tier]</span>
          <span class="init-col init-col-theme init-theme-growth">[Growth]</span>
          <span class="init-col init-col-owner">[CPO]</span>
          <span class="init-col init-col-timeline">[Q2-Q4 2025]</span>
          <span class="init-col init-col-investment">[$12M]</span>
          <span class="init-col init-col-impact init-impact-high">[High]</span>
        </div>
        <div class="initiative-row">
          <span class="init-col init-col-id">7</span>
          <span class="init-col init-col-name">[Supply chain optimization]</span>
          <span class="init-col init-col-theme init-theme-ops">[Operations]</span>
          <span class="init-col init-col-owner">[COO]</span>
          <span class="init-col init-col-timeline">[Q3 2025-Q1 2026]</span>
          <span class="init-col init-col-investment">[$7M]</span>
          <span class="init-col init-col-impact init-impact-medium">[Med]</span>
        </div>
        <div class="initiative-row">
          <span class="init-col init-col-id">8</span>
          <span class="init-col init-col-name">[Digital talent acquisition]</span>
          <span class="init-col init-col-theme init-theme-people">[People]</span>
          <span class="init-col init-col-owner">[CHRO]</span>
          <span class="init-col init-col-timeline">[Q1-Q4 2025]</span>
          <span class="init-col init-col-investment">[$4M]</span>
          <span class="init-col init-col-impact init-impact-high">[High]</span>
        </div>
      </div>
      <div class="initiatives-totals">
        <span class="init-col init-col-id"></span>
        <span class="init-col init-col-name init-total-label">Total Portfolio</span>
        <span class="init-col init-col-theme"></span>
        <span class="init-col init-col-owner"></span>
        <span class="init-col init-col-timeline">[2025-2027]</span>
        <span class="init-col init-col-investment init-total-value">[$79M]</span>
        <span class="init-col init-col-impact"></span>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Initiative planning, date]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 7) Initiative Prioritization — Impact vs Effort matrix
  initiativePrioritization: {
    id: 'initiativePrioritization',
    title: 'Initiative Prioritization',
    type: 'strategy',
    master: 'standard',
    description: 'Impact vs effort prioritization matrix with initiatives listed and color-coded by wave',
    note: 'Classic 2x2 prioritization matrix showing initiatives by impact and effort. Clean list layout with color-coded wave tags. Use for portfolio prioritization discussions.',
    thumbnail: 'prioritization',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Prioritization insight — e.g., "Focus on high-impact digital initiatives in wave 1"]</h1>
  <h2 class="subtitle">[Context — e.g., "Initiative Prioritization Matrix"]</h2>
  <div class="frame">
    <div class="prioritization-container">
      <div class="priority-matrix">
        <div class="priority-grid">
          <div class="priority-quadrant priority-q1">
            <div class="priority-quadrant-header">
              <span class="priority-quadrant-label">[Quick Wins]</span>
              <span class="priority-quadrant-hint">High impact · Low effort</span>
            </div>
            <ul class="priority-items">
              <li class="priority-item wave-1"><span class="priority-id">3</span> <strong>[Process automation]</strong></li>
              <li class="priority-item wave-1"><span class="priority-id">7</span> <strong>[Quick pilot]</strong></li>
            </ul>
          </div>
          <div class="priority-quadrant priority-q2">
            <div class="priority-quadrant-header">
              <span class="priority-quadrant-label">[Strategic Bets]</span>
              <span class="priority-quadrant-hint">High impact · High effort</span>
            </div>
            <ul class="priority-items">
              <li class="priority-item wave-1"><span class="priority-id">1</span> <strong>[Cloud migration]</strong></li>
              <li class="priority-item wave-2"><span class="priority-id">2</span> <strong>[APAC expansion]</strong></li>
              <li class="priority-item wave-2"><span class="priority-id">5</span> <strong>[Platform rebuild]</strong></li>
            </ul>
          </div>
          <div class="priority-quadrant priority-q3">
            <div class="priority-quadrant-header">
              <span class="priority-quadrant-label">[Fill-ins]</span>
              <span class="priority-quadrant-hint">Low impact · Low effort</span>
            </div>
            <ul class="priority-items">
              <li class="priority-item wave-defer"><span class="priority-id">8</span> <strong>[Minor update]</strong></li>
            </ul>
          </div>
          <div class="priority-quadrant priority-q4">
            <div class="priority-quadrant-header">
              <span class="priority-quadrant-label">[Deprioritize]</span>
              <span class="priority-quadrant-hint">Low impact · High effort</span>
            </div>
            <ul class="priority-items">
              <li class="priority-item wave-defer"><span class="priority-id">6</span> <strong>[Legacy rebuild]</strong></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="priority-legend">
        <div class="priority-legend-title">Wave Summary</div>
        <div class="priority-legend-item">
          <span class="priority-wave-tag wave-1">W1</span>
          <span class="priority-legend-text">[2025: #1, 3, 7]</span>
        </div>
        <div class="priority-legend-item">
          <span class="priority-wave-tag wave-2">W2</span>
          <span class="priority-legend-text">[2026: #2, 5]</span>
        </div>
        <div class="priority-legend-item">
          <span class="priority-wave-tag wave-defer">—</span>
          <span class="priority-legend-text">[Deferred: #6, 8]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 8) Initiative Charter — Detailed single initiative page
  initiativeCharter: {
    id: 'initiativeCharter',
    title: 'Initiative Charter',
    type: 'strategy',
    master: 'standard',
    description: 'Comprehensive single-initiative detail page with scope, sizing, timeline, risks, and success metrics',
    note: 'Full charter for one initiative including description, objectives, sizing (cost/benefit), timeline, key risks, dependencies, and success metrics. Use for initiative deep-dives.',
    thumbnail: 'charter',
    category: 'Content',
    html: `<div class="slide master-standard">
  <h1 class="title">[Initiative Name — e.g., "Cloud Infrastructure Modernization"]</h1>
  <h2 class="subtitle">[Theme: Digital Transformation | Owner: CTO | Priority: High]</h2>
  <div class="frame">
    <div class="charter-container">
      <div class="charter-main">
        <div class="charter-section charter-overview">
          <div class="charter-section-title">Overview</div>
          <div class="charter-section-content">
            <p class="charter-description">[Migrate core infrastructure to cloud-native architecture, enabling scalability, reducing costs, and accelerating development velocity]</p>
            <div class="charter-objectives">
              <div class="charter-objective">[Achieve 99.9% uptime SLA]</div>
              <div class="charter-objective">[Reduce infrastructure costs by 30%]</div>
              <div class="charter-objective">[Enable 2x faster deployment cycles]</div>
            </div>
          </div>
        </div>
        <div class="charter-section charter-timeline">
          <div class="charter-section-title">Timeline & Milestones</div>
          <div class="charter-timeline-track">
            <div class="charter-milestone">
              <div class="charter-milestone-marker"></div>
              <div class="charter-milestone-date">[Q1 2025]</div>
              <div class="charter-milestone-name">[Assessment complete]</div>
            </div>
            <div class="charter-milestone">
              <div class="charter-milestone-marker"></div>
              <div class="charter-milestone-date">[Q2 2025]</div>
              <div class="charter-milestone-name">[Pilot migration]</div>
            </div>
            <div class="charter-milestone">
              <div class="charter-milestone-marker"></div>
              <div class="charter-milestone-date">[Q3 2025]</div>
              <div class="charter-milestone-name">[Wave 1 production]</div>
            </div>
            <div class="charter-milestone charter-milestone-end">
              <div class="charter-milestone-marker"></div>
              <div class="charter-milestone-date">[Q4 2025]</div>
              <div class="charter-milestone-name">[Full migration]</div>
            </div>
          </div>
        </div>
        <div class="charter-section charter-risks">
          <div class="charter-section-title">Key Risks & Mitigations</div>
          <div class="charter-risk-list">
            <div class="charter-risk">
              <span class="charter-risk-level charter-risk-high">[H]</span>
              <span class="charter-risk-name">[Data migration complexity]</span>
              <span class="charter-risk-mitigation">[Phased approach with rollback capability]</span>
            </div>
            <div class="charter-risk">
              <span class="charter-risk-level charter-risk-medium">[M]</span>
              <span class="charter-risk-name">[Skill gaps in cloud tech]</span>
              <span class="charter-risk-mitigation">[Training program + contractor support]</span>
            </div>
            <div class="charter-risk">
              <span class="charter-risk-level charter-risk-low">[L]</span>
              <span class="charter-risk-name">[Vendor lock-in]</span>
              <span class="charter-risk-mitigation">[Multi-cloud architecture design]</span>
            </div>
          </div>
        </div>
      </div>
      <div class="charter-sidebar">
        <div class="charter-sidebar-section charter-sizing">
          <div class="charter-sidebar-title">Investment & Returns</div>
          <div class="charter-metric">
            <span class="charter-metric-label">Total Investment</span>
            <span class="charter-metric-value">[$15M]</span>
          </div>
          <div class="charter-metric">
            <span class="charter-metric-label">Annual Run-Rate Savings</span>
            <span class="charter-metric-value">[$6M]</span>
          </div>
          <div class="charter-metric">
            <span class="charter-metric-label">Payback Period</span>
            <span class="charter-metric-value">[2.5 years]</span>
          </div>
          <div class="charter-metric">
            <span class="charter-metric-label">NPV (5-year)</span>
            <span class="charter-metric-value">[$12M]</span>
          </div>
        </div>
        <div class="charter-sidebar-section charter-team">
          <div class="charter-sidebar-title">Team & Dependencies</div>
          <div class="charter-team-item">
            <span class="charter-team-role">Sponsor:</span>
            <span class="charter-team-name">[CTO]</span>
          </div>
          <div class="charter-team-item">
            <span class="charter-team-role">Lead:</span>
            <span class="charter-team-name">[VP Engineering]</span>
          </div>
          <div class="charter-team-item">
            <span class="charter-team-role">Team size:</span>
            <span class="charter-team-name">[12 FTE]</span>
          </div>
          <div class="charter-dependencies">
            <span class="charter-dep-label">Dependencies:</span>
            <span class="charter-dep-item">[Security review]</span>
            <span class="charter-dep-item">[Data governance]</span>
          </div>
        </div>
        <div class="charter-sidebar-section charter-kpis">
          <div class="charter-sidebar-title">Success Metrics</div>
          <div class="charter-kpi">
            <span class="charter-kpi-name">[Migration %]</span>
            <span class="charter-kpi-target">Target: [100%]</span>
          </div>
          <div class="charter-kpi">
            <span class="charter-kpi-name">[Uptime]</span>
            <span class="charter-kpi-target">Target: [99.9%]</span>
          </div>
          <div class="charter-kpi">
            <span class="charter-kpi-name">[Cost reduction]</span>
            <span class="charter-kpi-target">Target: [30%]</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>[Company]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 9) Financial Summary — Total investment, costs, and revenue upside
  financialSummary: {
    id: 'financialSummary',
    title: 'Financial Summary',
    type: 'strategy',
    master: 'standard',
    description: 'Strategy financial summary with investment, cost savings, and optional revenue upside',
    note: 'Financial overview showing total investment, expected returns (cost savings and/or revenue), and key metrics. Flexible for entities with or without revenue upside.',
    thumbnail: 'financials',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Financial headline — e.g., "$95M investment expected to deliver $180M in value over 5 years"]</h1>
  <h2 class="subtitle">[Context — e.g., "Strategy Financial Summary | 2025-2029"]</h2>
  <div class="frame">
    <div class="financial-summary">
      <div class="financial-overview">
        <div class="financial-block financial-investment">
          <div class="financial-block-header">
            <span class="financial-block-icon">↓</span>
            <span class="financial-block-title">Total Investment</span>
          </div>
          <div class="financial-block-value">[$95M]</div>
          <div class="financial-block-detail">[Over 3 years (2025-2027)]</div>
          <div class="financial-breakdown">
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[Capital expenditure]</span>
              <span class="breakdown-value">[$45M]</span>
            </div>
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[Operating investment]</span>
              <span class="breakdown-value">[$35M]</span>
            </div>
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[Change management]</span>
              <span class="breakdown-value">[$15M]</span>
            </div>
          </div>
        </div>
        <div class="financial-block financial-savings">
          <div class="financial-block-header">
            <span class="financial-block-icon">↑</span>
            <span class="financial-block-title">Cost Savings</span>
          </div>
          <div class="financial-block-value">[$85M]</div>
          <div class="financial-block-detail">[Cumulative by 2029]</div>
          <div class="financial-breakdown">
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[Operational efficiency]</span>
              <span class="breakdown-value">[$50M]</span>
            </div>
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[Technology consolidation]</span>
              <span class="breakdown-value">[$25M]</span>
            </div>
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[Process automation]</span>
              <span class="breakdown-value">[$10M]</span>
            </div>
          </div>
        </div>
        <div class="financial-block financial-revenue">
          <div class="financial-block-header">
            <span class="financial-block-icon">↗</span>
            <span class="financial-block-title">Revenue Upside</span>
          </div>
          <div class="financial-block-value">[$95M]</div>
          <div class="financial-block-detail">[Incremental by 2029]</div>
          <div class="financial-breakdown">
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[New market entry]</span>
              <span class="breakdown-value">[$55M]</span>
            </div>
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[Product expansion]</span>
              <span class="breakdown-value">[$30M]</span>
            </div>
            <div class="financial-breakdown-item">
              <span class="breakdown-label">[Pricing optimization]</span>
              <span class="breakdown-value">[$10M]</span>
            </div>
          </div>
        </div>
      </div>
      <div class="financial-metrics">
        <div class="financial-metric-card">
          <div class="financial-metric-value">[1.9x]</div>
          <div class="financial-metric-label">Return Multiple</div>
        </div>
        <div class="financial-metric-card">
          <div class="financial-metric-value">[2.8 yrs]</div>
          <div class="financial-metric-label">Payback Period</div>
        </div>
        <div class="financial-metric-card">
          <div class="financial-metric-value">[$62M]</div>
          <div class="financial-metric-label">NPV (8% discount)</div>
        </div>
        <div class="financial-metric-card">
          <div class="financial-metric-value">[24%]</div>
          <div class="financial-metric-label">IRR</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Financial modeling assumptions, date]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },

  // 10) Financial Waterfall — Bridge from current to target state
  financialWaterfall: {
    id: 'financialWaterfall',
    title: 'Financial Waterfall',
    type: 'strategy',
    master: 'standard',
    description: 'Waterfall chart showing financial bridge from baseline to target with initiative contributions',
    note: 'Visual waterfall showing how initiatives contribute to financial improvement. Shows starting point, additions, subtractions, and end state. Use for value creation stories.',
    thumbnail: 'waterfall',
    category: 'Data & Metrics',
    html: `<div class="slide master-standard">
  <h1 class="title">[Value creation story — e.g., "Path from $120M to $195M EBITDA by 2027"]</h1>
  <h2 class="subtitle">[Context — e.g., "Value Creation Bridge"]</h2>
  <div class="frame">
    <div class="waterfall-container">
      <div class="waterfall-chart">
        <div class="waterfall-bar waterfall-start">
          <div class="waterfall-bar-fill" style="height: 60%;"></div>
          <div class="waterfall-bar-value">[$120M]</div>
          <div class="waterfall-bar-label">[2024 Baseline]</div>
        </div>
        <div class="waterfall-bar waterfall-add">
          <div class="waterfall-bar-connector" style="bottom: 60%;"></div>
          <div class="waterfall-bar-fill waterfall-positive" style="height: 15%; bottom: 60%;"></div>
          <div class="waterfall-bar-value">+[$25M]</div>
          <div class="waterfall-bar-label">[Revenue growth]</div>
        </div>
        <div class="waterfall-bar waterfall-add">
          <div class="waterfall-bar-connector" style="bottom: 75%;"></div>
          <div class="waterfall-bar-fill waterfall-positive" style="height: 12%; bottom: 75%;"></div>
          <div class="waterfall-bar-value">+[$20M]</div>
          <div class="waterfall-bar-label">[New markets]</div>
        </div>
        <div class="waterfall-bar waterfall-add">
          <div class="waterfall-bar-connector" style="bottom: 87%;"></div>
          <div class="waterfall-bar-fill waterfall-positive" style="height: 10%; bottom: 87%;"></div>
          <div class="waterfall-bar-value">+[$18M]</div>
          <div class="waterfall-bar-label">[Cost savings]</div>
        </div>
        <div class="waterfall-bar waterfall-subtract">
          <div class="waterfall-bar-connector" style="bottom: 97%;"></div>
          <div class="waterfall-bar-fill waterfall-negative" style="height: 5%; bottom: 92%;"></div>
          <div class="waterfall-bar-value">−[$8M]</div>
          <div class="waterfall-bar-label">[Investments]</div>
        </div>
        <div class="waterfall-bar waterfall-add">
          <div class="waterfall-bar-connector" style="bottom: 92%;"></div>
          <div class="waterfall-bar-fill waterfall-positive" style="height: 10%; bottom: 92%;"></div>
          <div class="waterfall-bar-value">+[$20M]</div>
          <div class="waterfall-bar-label">[Pricing/mix]</div>
        </div>
        <div class="waterfall-bar waterfall-end">
          <div class="waterfall-bar-fill waterfall-total" style="height: 97%;"></div>
          <div class="waterfall-bar-value">[$195M]</div>
          <div class="waterfall-bar-label">[2027 Target]</div>
        </div>
      </div>
      <div class="waterfall-summary">
        <div class="waterfall-summary-row">
          <span class="waterfall-summary-label">Total Value Creation</span>
          <span class="waterfall-summary-value">[$75M]</span>
        </div>
        <div class="waterfall-summary-row">
          <span class="waterfall-summary-label">Growth Rate (CAGR)</span>
          <span class="waterfall-summary-value">[17.5%]</span>
        </div>
        <div class="waterfall-summary-row waterfall-summary-highlight">
          <span class="waterfall-summary-label">Margin Improvement</span>
          <span class="waterfall-summary-value">[+4.2pp]</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="footer">
    <span>Source: [Financial projections, assumptions]</span>
    <span>1 / 1</span>
  </footer>
</div>`,
  },
};

/**
 * TEMPLATE FLEX RULES
 *
 * Defines how each template's item count can adapt to content.
 * The AI uses these rules when filling templates to decide whether to add/remove items.
 *
 * Fields:
 *   element  — what repeats (for prompt clarity)
 *   default  — item count in the base template HTML
 *   min/max  — allowed range (visual coherence limits)
 *   layout   — 'linear' (row/col), 'grid' (NxM), 'fixed' (no flex)
 *   gridBase — for grid layouts, the base dimensions [rows, cols]
 *   gridAlts — for grid layouts, allowed alternative dimensions
 *   scaling  — guidance for when items are added:
 *              'shrink-rows'   → shrink all content proportionally to stay in slide bounds
 *              'lighten-cols'  → reduce text per item so extra columns aren't crowded
 *              'none'          → fixed structure, no scaling needed
 */
export const TEMPLATE_FLEX_RULES = {
  // ── Cards (±1 from default) ──
  twoCards:       { element: 'card', default: 2, min: 2, max: 3, layout: 'linear', scaling: 'lighten-cols' },
  twoCardsB:     { element: 'card', default: 2, min: 2, max: 3, layout: 'linear', scaling: 'lighten-cols' },
  twoCardsC:     { element: 'card', default: 2, min: 2, max: 3, layout: 'linear', scaling: 'lighten-cols' },
  threeCards:     { element: 'card', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'lighten-cols' },
  threeCardsB:   { element: 'card', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'lighten-cols' },
  threeCardsC:   { element: 'card', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'lighten-cols' },
  fourCards:      { element: 'card', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols' },
  fourCardsB:    { element: 'card', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols' },
  fourCardsC:    { element: 'card', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols' },
  twoCardsD:     { element: 'card', default: 2, min: 2, max: 3, layout: 'linear', scaling: 'lighten-cols' },
  twoCardsE:     { element: 'card', default: 2, min: 2, max: 3, layout: 'linear', scaling: 'shrink-rows' },
  threeCardsD:   { element: 'card', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'lighten-cols' },
  threeCardsE:   { element: 'card', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'shrink-rows' },
  fourCardsD:    { element: 'card', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols' },
  fourCardsE:    { element: 'card', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'shrink-rows' },

  // ── Numbered Rows ──
  numberedRows:   { element: 'row', default: 5, min: 3, max: 7, layout: 'linear', scaling: 'shrink-rows' },
  numberedRowsB:  { element: 'row', default: 5, min: 3, max: 7, layout: 'linear', scaling: 'shrink-rows' },
  numberedRowsC:  { element: 'row', default: 5, min: 3, max: 7, layout: 'linear', scaling: 'shrink-rows' },

  // ── Process / Flow (±1 from default) ──
  chevronFlow:    { element: 'chevron phase', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols' },
  processFlow:    { element: 'process step', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols' },

  // ── Timeline / Sequential ──
  timeline:         { element: 'timeline row', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'shrink-rows' },
  roadmapTimeline:  { element: 'timeline phase', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols' },
  customerJourney:  { element: 'journey stage', default: 5, min: 4, max: 6, layout: 'linear', scaling: 'lighten-cols' },
  workplan:         { element: 'workplan row', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'shrink-rows' },

  // ── KPI / Metrics ──
  kpiMetrics:       { element: 'KPI block + detail item', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'shrink-rows' },
  statHighlight:    { element: 'stat item', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'lighten-cols' },
  metricDashboard:  { element: 'metric card', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'shrink-rows' },
  scorecard:        { element: 'scorecard row', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'shrink-rows' },
  bigNumber:        { element: 'number block', default: 1, min: 1, max: 2, layout: 'linear', scaling: 'lighten-cols' },

  // ── Grids (strict NxM — only one step away from base) ──
  grid2x2:      { element: 'grid cell', default: 4, min: 4, max: 6, layout: 'grid', gridBase: [2,2], gridAlts: [[2,3],[3,2]], scaling: 'shrink-rows' },
  grid2x2Rows:  { element: 'grid cell', default: 4, min: 4, max: 6, layout: 'grid', gridBase: [2,2], gridAlts: [[2,3],[3,2]], scaling: 'shrink-rows' },
  grid3x2:      { element: 'grid cell', default: 6, min: 4, max: 6, layout: 'grid', gridBase: [3,2], gridAlts: [[2,2],[2,3]], scaling: 'shrink-rows' },
  grid2x3:      { element: 'grid cell', default: 6, min: 4, max: 6, layout: 'grid', gridBase: [2,3], gridAlts: [[2,2],[3,3]], scaling: 'shrink-rows' },
  grid3x3:      { element: 'grid cell', default: 9, min: 6, max: 9, layout: 'grid', gridBase: [3,3], gridAlts: [[3,2],[2,3]], scaling: 'shrink-rows' },

  // ── High-density ──
  bulletsDense:      { element: 'bullet', default: 12, min: 8, max: 15, layout: 'linear', scaling: 'shrink-rows' },
  twoColumnBoxes:    { element: 'box per column', default: 7, min: 5, max: 10, layout: 'linear', scaling: 'shrink-rows' },
  threeColumnBoxes:  { element: 'box per column', default: 6, min: 5, max: 10, layout: 'linear', scaling: 'shrink-rows' },
  denseTable:        { element: 'table row', default: 10, min: 8, max: 15, layout: 'linear', scaling: 'shrink-rows', note: 'Columns flex 4-6. Rows flex 8-15. Cell text must stay 2-4 words.' },

  // ── Fixed quadrants (semantic structure — cells are fixed, bullets inside flex) ──
  swotAnalysis:       { element: 'quadrant', default: 4, min: 4, max: 4, layout: 'fixed', scaling: 'none', note: 'Quadrant count fixed (SWOT=4), but bullet count per quadrant can flex 3-5' },
  riskMatrix:         { element: 'quadrant', default: 4, min: 4, max: 4, layout: 'fixed', scaling: 'none', note: 'Matrix structure is fixed' },
  prosAndCons:        { element: 'column', default: 2, min: 2, max: 2, layout: 'fixed', scaling: 'none', note: 'Always 2 columns (pros vs cons), bullet count can flex' },
  comparisonTable:    { element: 'table column', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'lighten-cols' },

  // ── Bullets ──
  bulletPoints:           { element: 'bullet point', default: 5, min: 4, max: 7, layout: 'linear', scaling: 'shrink-rows' },
  bulletPointsTwoCol:     { element: 'bullet point per col', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'shrink-rows' },
  bulletPointsVertical:   { element: 'bullet point', default: 5, min: 4, max: 7, layout: 'linear', scaling: 'shrink-rows' },
  bulletPointsLetters:    { element: 'lettered point', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'shrink-rows' },
  bulletPointsChecks:     { element: 'check point', default: 5, min: 4, max: 7, layout: 'linear', scaling: 'shrink-rows' },
  bulletPointsIconGrid:   { element: 'icon point', default: 4, min: 4, max: 4, layout: 'grid', gridBase: [2,2], scaling: 'none' },
  iconGrid2x3:            { element: 'icon point', default: 6, min: 6, max: 6, layout: 'grid', gridBase: [2,3], scaling: 'none' },

  // ── Executive summaries ──
  executiveSummary:              { element: 'summary cell', default: 4, min: 2, max: 6, layout: 'grid', gridBase: [2,2], gridAlts: [[2,1],[2,3],[3,2]], scaling: 'none' },
  executiveSummaryVertical:      { element: 'summary column', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'lighten-cols' },
  executiveSummaryHorizontal:    { element: 'summary row', default: 3, min: 2, max: 4, layout: 'linear', scaling: 'lighten-cols' },

  // ── Funnel ──
  funnel: { element: 'funnel stage', default: 5, min: 4, max: 6, layout: 'linear', scaling: 'shrink-rows' },

  // ── Chart + insight (SVG structure is rigid — only text content changes) ──
  graphInsights:   { element: 'insight item', default: 3, min: 3, max: 4, layout: 'fixed', scaling: 'none', note: 'SVG chart structure is FIXED: exactly 5 bars, 4 Y-axis labels, 5 X-axis labels. Only replace placeholder text — never add/remove SVG elements.' },
  dualCharts:      { element: 'chart', default: 2, min: 2, max: 2, layout: 'fixed', scaling: 'none', note: 'Two charts side-by-side. SVG structure is FIXED — only replace placeholder text.' },
  barChartExhibit: { element: 'bar row', default: 5, min: 4, max: 8, layout: 'linear', scaling: 'shrink-rows', note: 'Two dark grey panels on left + horizontal bars on right. Panels have 3 bullets each.' },
  verticalBarChartExhibit: { element: 'bar column', default: 5, min: 4, max: 8, layout: 'linear', scaling: 'lighten-cols', note: 'Two dark grey panels on left + vertical bars on right. Panels have 3 bullets each.' },
  multiLineChart:  { element: 'data series', default: 3, min: 2, max: 4, layout: 'fixed', scaling: 'none', note: 'Line chart with series points. Each series has 5 data points.' },
  groupedColumnChart: { element: 'column group', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols', note: 'Grouped vertical bars with 3 series per group.' },

  // ── Fixed / no-flex ──
  cover:           { element: 'slide', default: 1, min: 1, max: 1, layout: 'fixed', scaling: 'none' },
  thankYou:        { element: 'slide', default: 1, min: 1, max: 1, layout: 'fixed', scaling: 'none' },
  sectionDivider:  { element: 'slide', default: 1, min: 1, max: 1, layout: 'fixed', scaling: 'none' },
  quote:           { element: 'slide', default: 1, min: 1, max: 1, layout: 'fixed', scaling: 'none' },
  blank:           { element: 'slide', default: 1, min: 1, max: 1, layout: 'fixed', scaling: 'none' },

  // ── Strategy Project Templates ──
  visionMission:           { element: 'value item', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'lighten-cols' },
  baselineAssessment:      { element: 'dimension', default: 5, min: 4, max: 6, layout: 'linear', scaling: 'shrink-rows' },
  strategicBenchmark:      { element: 'dimension', default: 4, min: 3, max: 5, layout: 'linear', scaling: 'shrink-rows' },
  strategicThemes:         { element: 'theme card', default: 4, min: 3, max: 4, layout: 'linear', scaling: 'lighten-cols' },
  strategicThemesVisual:   { element: 'priority block', default: 3, min: 2, max: 4, layout: 'fixed', scaling: 'none', note: 'Pyramid structure is fixed, enablers can flex 3-5' },
  initiativesLongList:     { element: 'initiative row', default: 8, min: 5, max: 10, layout: 'linear', scaling: 'shrink-rows', note: 'Max 10 rows per slide. If more than 10 initiatives, split across multiple slides (duplicate this template).' },
  initiativePrioritization: { element: 'initiative item', default: 7, min: 5, max: 10, layout: 'fixed', scaling: 'none', note: 'Quadrant structure fixed, initiatives listed with wave color coding' },
  initiativeCharter:       { element: 'slide', default: 1, min: 1, max: 1, layout: 'fixed', scaling: 'none' },
  financialSummary:        { element: 'financial block', default: 3, min: 2, max: 3, layout: 'linear', scaling: 'lighten-cols', note: 'Can be 2 blocks (investment + savings) or 3 (+ revenue)' },
  financialWaterfall:      { element: 'waterfall bar', default: 7, min: 5, max: 9, layout: 'linear', scaling: 'lighten-cols' },
};

/**
 * TEMPLATE_GUIDANCE — short one-liner hints injected into the fillTemplateWithAI prompt.
 * They guide the step execution on recommended content density per template. Keep compact.
 *
 * GLOBAL RULES (apply to ALL templates):
 * - Footnotes & Sources: Keep extremely brief — max 5-15 words. Examples: "Source: Bloomberg Business"
 *   or "McKinsey Global Institute, 2024". Never write full sentences in footnotes.
 * - Footer text: Company name only, no taglines. Page numbers are auto-generated.
 */
export const TEMPLATE_GUIDANCE = {
  // ── Freestyle (default for any unrecognized template) ──
  _freestyle: 'Max 6 content blocks. Each block max 3 short lines. Total ~100 words. No paragraphs. Use whitespace generously — less text = better slide. Footnotes/sources: max 5-15 words (e.g., "Source: Bloomberg Business").',

  // ── Cards ──
  twoCards: 'Exactly 2 cards. Per card: title (4 words), body (2-3 lines, ~20 words), 1 metric box. Do not add extra cards.',
  twoCardsB: 'Exactly 2 cards with banner headers. Per card: title in banner (4 words), body (2-3 lines), bullet list (3 items), pill metric.',
  twoCardsC: 'Exactly 2 cards with left stripe. Per card: title (4 words), body (2-3 lines), bullet list (3 items), dark pill metric.',
  threeCards: 'Exactly 3 cards. Per card: title (4 words), body (2 lines, ~15 words), 1 metric box. Do not add extra cards.',
  threeCardsB: 'Exactly 3 flat sections. Per section: letter label, title with underline (4 words), body (2 lines), bottom metric.',
  threeCardsC: 'Exactly 3 cards with dark headers. Per card: icon + title in dark header, body (2 lines), accent metric box.',
  fourCards: 'Exactly 4 cards. Per card: title (3 words), body (1-2 lines, ~12 words). Keep very tight — 4 columns is narrow.',
  fourCardsB: 'Exactly 4 cards with icon badges. Per card: icon, centered title (3 words), short body (1-2 lines), tag label.',
  fourCardsC: 'Exactly 4 horizontal rows. Per row: icon, title (3 words), short description (1 line), metric badge on right.',
  twoCardsD: 'Exactly 2 cards with burgundy block header. Per card: number + title in header, then 3 bullet points below. No icons.',
  twoCardsE: 'Exactly 2 horizontal rows. Per row: large number on left, title + description on right. Simple and clean.',
  threeCardsD: 'Exactly 3 cards with burgundy block header. Per card: number + title in header, then 3 bullet points below. No icons.',
  threeCardsE: 'Exactly 3 horizontal rows. Per row: large number on left, title + description on right. Simple and clean.',
  fourCardsD: 'Exactly 4 cards with burgundy block header. Per card: number + title in header, then 2 bullet points below. Keep tight — 4 columns.',
  fourCardsE: 'Exactly 4 horizontal rows. Per row: large number on left, title + short description on right. Compact.',

  // ── Numbered Rows ──
  numberedRows: '3-7 numbered rows. Each: burgundy circle number + title (4 words) + description (10 words). Ruled lines between rows.',
  numberedRowsB: '3-7 numbered rows with alternating band backgrounds. Each: bold number + title (4 words) + brief description (10 words).',
  numberedRowsC: '3-7 numbered rows with left burgundy accent. Each: serif number + title (4 words) + description (8 words). Compact.',

  // ── Bullets / Key Points ──
  bulletPoints: '4-7 numbered points. Each: title (4-5 words) + description (8-10 words). No long sentences.',
  bulletPointsTwoCol: '3-5 points per column, 2 columns. Each point: title (3-4 words) + 1 line. Very compact.',
  bulletPointsVertical: '4-7 bullet items. Each: short label + brief supporting text (10 words max total).',
  bulletPointsLetters: '3-5 lettered items. Each: title (4 words) + description (8-10 words).',
  bulletPointsChecks: '4-7 check items. Each line max 10 words. No descriptions — just the check item text.',
  bulletPointsIconGrid: 'Exactly 4 icon points in a strict 2x2 grid. Each: numbered badge + title (3 words) + description (6-8 words). Do NOT add more than 4.',
  iconGrid2x3: 'Exactly 6 icon points in a strict 2x3 grid (2 columns, 3 rows). Each: numbered badge + title (3 words) + description (6-8 words). Do NOT add more than 6.',
  bulletsDense: '8-15 numbered cards in <div class="dense-grid">. Each card: <div class="dense-card"><span class="dense-num">N</span><div class="dense-body"><span class="dense-title">Title</span><span class="dense-desc">Brief description max 8 words</span></div></div>. Title is 2-3 words, description max 8 words.',

  // ── Executive Summaries ──
  executiveSummary: '2-6 cells in a 2-column grid (3-col if 5+). Each cell: burgundy h4 INSIGHT-DRIVEN title (4-7 words — a "so what" phrase with a conclusion, not a generic label; e.g. "Digital up 40% despite headwinds" NOT "Market Overview") + 1-2 short paragraphs with key insight and supporting detail. No icons, no numbers.',
  executiveSummaryVertical: '2-4 columns. Each: INSIGHT-DRIVEN title (a phrase that tells the reader something, e.g. "Margins squeezed by input costs" NOT "Cost Analysis") + 2-3 bullet points (6 words each).',
  executiveSummaryHorizontal: '2-4 horizontal rows. Each: INSIGHT-DRIVEN title (a conclusion or question, e.g. "Three levers to unlock growth" NOT "Growth Strategy") + brief text (15 words). Clean spacing.',

  // ── Grids ──
  grid2x2: '4 quadrants. Each: heading (3-4 words) + description (15-20 words). Equal space per quadrant.',
  grid2x2Rows: '4 numbered rows. Each: title (4 words) + description (1 line, 12 words).',
  grid3x2: '6 cells (3 cols × 2 rows). Each: heading (3 words) + description (10-12 words). Keep short — cells are compact.',
  grid2x3: '6 cells (2 cols × 3 rows). Each: heading (3-4 words) + description (12-15 words). Taller cells allow slightly more text.',
  grid3x3: '9 cells. Each: heading (2-3 words) + 1 line (8 words max). Extremely compact — less is more.',

  // ── Multi-column boxes ──
  twoColumnBoxes: '2 columns, 5-10 boxes each. Column header (2-3 words). Each box: single line, 6-8 words max. Pure labels, no descriptions.',
  threeColumnBoxes: '3 columns, 5-10 boxes each. Column header (2-3 words). Each box: single line, 5-6 words max. Ultra-compact.',

  // ── Tables ──
  comparisonTable: '3-4 columns, 4-6 rows. Cell text: 1-3 words (scores, ratings, short labels). Header row required.',
  denseTable: '5-6 columns, 10-15 rows. Cell text max 4 words. Font is 9px — keep everything ultra-short. Header row required.',

  // ── KPI / Metrics ──
  kpiMetrics: '3 KPI blocks (left) + 3 detail items (right). KPI: value (number+unit) + label (2-3 words). Detail: title (3 words) + 1 line.',
  statHighlight: '2-4 stat items. Each: large number + label (2-3 words) + context line (8 words).',
  metricDashboard: '3-5 metric cards. Each: value + label + trend indicator. No long text.',
  scorecard: '3-5 rows. Each: metric name + value + status indicator. Tabular, no prose.',
  bigNumber: '1-2 giant numbers with context. Big number + label + 1-line insight.',

  // ── Process / Flow ──
  processFlow: '3-5 steps with arrows. Each step: title (3 words) + description (8-10 words).',
  chevronFlow: '3-5 chevron phases. Each: title (3 words) + 1-line description (8 words).',

  // ── Timeline ──
  timeline: '2-4 timeline entries. Each: date/phase + title (3-4 words) + description (12 words).',
  roadmapTimeline: '3-5 phases. Each: phase label + title (3 words) + description (8 words).',
  workplan: '3-5 workstream rows. Each: title + timeline bar. Keep text minimal.',

  // ── Charts / Data ──
  barChartExhibit: 'Two dark panels (left) + 5-8 horizontal bars (right). Panel 1: context/background (3 bullets). Panel 2: key takeaways (3 bullets). Bar labels: 2-3 words. Source at bottom.',
  verticalBarChartExhibit: 'Two dark panels (left) + 5-8 vertical bars (right). Panel 1: context/background (3 bullets). Panel 2: key takeaways (3 bullets). Bar labels: 2-3 words. Source at bottom.',
  waterfallChart: '5-8 bridge steps. Each: label (2-3 words) + value. Start and end totals required.',
  graphInsights: 'Left: SVG chart (60%) — FIXED structure: 5 bars, 4 Y-axis labels, 5 X-axis labels. Only replace text inside existing <text> elements. NEVER add extra <text> or axis labels. Right: 3 numbered insights (8-10 words each).',
  dualCharts: 'Two charts side-by-side. Each: title + chart area. Minimal annotation text.',
  multiLineChart: '2-4 data series on a line chart. Legend (series names 2-3 words). Y-axis values (numbers only). X-axis labels (years or periods). Point labels optional. Takeaway: 1 sentence max.',
  groupedColumnChart: '3-5 category groups with 2-3 bars each. Legend (group names 2-3 words). Y-axis values (numbers only). Bar values shown above. Category labels below. Takeaway: 1 sentence max.',
  peerBenchmark: 'Table: 4-6 metrics × 3-5 entities. Cell values only (numbers). Best-in-class highlighted.',
  indexBenchmark: '3-5 time periods. Each: 2 grouped bars (subject vs benchmark) + values. Summary card.',
  percentileBenchmark: '3-5 metric rows. Each: percentile bar (0-100) + value + quartile marker.',
  competitiveBenchmark: 'Scoring grid: 4-6 dimensions × 3-5 entities. Dot indicators + weights. Very compact.',

  // ── Other ──
  twoColumn: 'Left + right columns. Each: heading + 3-5 bullet points (8 words each). Balanced content.',
  quote: 'Quote text (max 30 words) + attribution (name + title). Nothing else.',
  teamShowcase: '4 team members. Each: name + role (3 words) + bio (15 words). No overflow.',
  customerJourney: '4-6 journey stages. Each: stage label + emotion + 1-line description.',
  funnel: '4-6 funnel stages. Each: stage name + metric + 1 detail line.',
  swotAnalysis: '4 fixed quadrants (S/W/O/T). Each: 3-5 bullet points, 6 words each.',
  prosAndCons: '2 columns (Pros/Cons). Each: 4-6 bullets, 8 words per bullet.',

  // ── Strategy Project Templates ──
  visionMission: 'Vision statement (15-25 words, aspirational). Mission statement (15-25 words, action-oriented). 3-5 values, each: icon + name (2 words) + description (6-8 words).',
  baselineAssessment: '5-6 dimensions. Each: name (2-3 words) + score (X/5) + 2 findings (8 words each). Summary: 3 items (strength, gap, opportunity), 10 words each.',
  strategicBenchmark: '3-5 dimensions. Each: label + 3 entity bars with values. 3 insights (leading/lagging), 10 words each.',
  strategicThemes: '3-4 theme cards. Each: number + name (3 words) + description (15-20 words) + 3 objectives (6 words each). Keep text tight.',
  strategicThemesVisual: 'Pyramid: top (vision, 12 words), mid (3 priorities, 4 words each), base (4 enablers, 2 words each). Labels only, minimal text.',
  initiativesLongList: 'Max 10 initiative rows per slide. Each: ID + name (5-6 words) + theme tag + owner (role) + timeline (Q dates) + investment ($) + impact (High/Med/Low). Keep concise. If more than 10 initiatives, use multiple slides.',
  initiativePrioritization: '4 quadrants (Quick Wins, Strategic Bets, Fill-ins, Deprioritize). 5-10 initiative items with ID + bold name (2-3 words). Use wave-1/wave-2/wave-defer classes for color coding. Legend: 2-3 wave groupings with W1/W2 tags.',
  initiativeCharter: 'Single initiative detail. Overview: description (25 words) + 3 objectives (8 words each). Timeline: 4 milestones. Risks: 3 items with mitigation. Sidebar: 4 metrics + team + 3 KPIs.',
  financialSummary: '2-3 financial blocks (investment, savings, revenue). Each: value + timeframe + 3 breakdown items. 4 metric cards: multiple, payback, NPV, IRR.',
  financialWaterfall: '5-9 waterfall bars: start total, 3-5 additions/subtractions, end total. Each: value + label (2-3 words). Summary: 3 metrics.',
};

/**
 * Get content guidance for a template ID.
 * Falls back to _freestyle for unrecognized templates.
 */
export function getTemplateGuidance(templateId) {
  return TEMPLATE_GUIDANCE[templateId] || TEMPLATE_GUIDANCE._freestyle;
}

/**
 * Get flex rules for a template ID.
 * Returns null if no rules defined (treat as no-flex).
 */
export function getTemplateFlex(templateId) {
  return TEMPLATE_FLEX_RULES[templateId] || null;
}

// Helper to get all templates as an array
export const getAllTemplates = () => Object.values(SLIDE_TEMPLATES);

// Helper to get template by ID
export const getTemplateById = (id) => SLIDE_TEMPLATES[id];

// Alias for getTemplateById
export const getTemplate = getTemplateById;

// Re-export empty slide functions for convenience
export { getEmptySlideTemplates, generateEmptySlideHTML };

// Helper to get templates by category
// If category is provided, filter templates by that category (returns array)
// If no category, return object grouped by category (for TemplatePicker)
// includeEmpty: if true, adds "Empty Slides" category with master-based empty templates
export const getTemplatesByCategory = (category, { includeEmpty = true } = {}) => {
  const templates = Object.values(SLIDE_TEMPLATES);

  // Filter out the old hardcoded empty templates (blank, instructionSlide)
  const filteredTemplates = templates.filter(t =>
    t.id !== 'blank' && t.id !== 'instructionSlide'
  );

  if (category) {
    if (category === 'Empty Slides' && includeEmpty) {
      return getEmptySlideTemplates();
    }
    return filteredTemplates.filter((t) => t.category === category);
  }

  // Return object grouped by category
  const grouped = {};

  // Add empty slides category first if requested
  if (includeEmpty) {
    grouped['Empty Slides'] = getEmptySlideTemplates();
  }

  for (const template of filteredTemplates) {
    const cat = template.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(template);
  }
  return grouped;
};

// Get unique categories
export const getCategories = () => {
  return [...new Set(Object.values(SLIDE_TEMPLATES).map((t) => t.category))];
};

// Template categories for organization
export const TEMPLATE_CATEGORIES = [
  { id: 'Opening', label: 'Opening', description: 'Cover, executive summary' },
  { id: 'Content', label: 'Content', description: 'Cards, grids, bullets, tables' },
  { id: 'Data & Metrics', label: 'Data & Metrics', description: 'KPIs, stats, charts' },
  { id: 'Process & Time', label: 'Process & Time', description: 'Timelines, roadmaps, flows' },
  { id: 'Emphasis', label: 'Emphasis', description: 'Quotes, value props, highlights' },
];

// Find matching templates based on keywords
export const findMatchingTemplates = (keywords, limit = 5) => {
  if (!keywords || keywords.length === 0) return [];

  const allTemplates = Object.values(SLIDE_TEMPLATES);
  const scored = allTemplates.map((template) => {
    const searchText = `${template.title} ${template.description} ${template.note || ''} ${template.type}`.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (searchText.includes(lowerKeyword)) {
        score += 1;
        // Bonus for title match
        if (template.title.toLowerCase().includes(lowerKeyword)) {
          score += 2;
        }
      }
    }

    return { template, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.template);
};
