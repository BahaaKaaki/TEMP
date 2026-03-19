// Pre-built PptxGenJS render functions for each template
// These are tested to produce high-fidelity PPTX output matching the HTML preview

// Color constants matching slide CSS
export const COLORS = {
  main: '111111',
  secondary: '222222',
  red: 'A32020',
  maroon: '8E1E1E',
  meta: '4A4F57',
  zone1: 'F7F9FB',
  zone2: 'EEF2F6',
  rose: 'F8E3E3',
  coal: '4B4F55',
  border: 'E6E9EE',
  white: 'FFFFFF',
  lightGray: 'E0E0E0',
  success: '059669',
  successSoft: 'DCFCE7',
  danger: 'DC2626',
  dangerSoft: 'FEE2E2',
};

// Layout constants (in inches, matching 960x540 -> 13.333x7.5)
export const LAYOUT = {
  // Standard master positions
  titleX: 0.48,
  titleY: 0.42,
  titleW: 12.36,
  subtitleX: 0.48,
  subtitleY: 1.40,
  subtitleW: 12.36,
  frameX: 0.48,
  frameY: 1.90,
  frameW: 12.36,
  frameH: 4.9,
  footerY: 7.05,

  // Card dimensions
  cardGap: 0.22,
  cardRadius: 0.05,
};

// Module-level footer branding (set once per export via setFooterBranding)
let _footerBranding = 'Strategy&';

export function setFooterBranding(branding) {
  _footerBranding = branding || 'Strategy&';
}

// Helper: Add standard footer
export function addFooter(slide, slideNum, totalSlides, branding) {
  branding = branding || _footerBranding;
  slide.addText(branding, {
    x: 0.48, y: 7.05, w: 2, h: 0.25,
    fontFace: 'Arial', fontSize: 10, color: COLORS.meta
  });
  slide.addText(`${slideNum} / ${totalSlides}`, {
    x: 11.5, y: 7.05, w: 1.3, h: 0.25,
    fontFace: 'Arial', fontSize: 10, color: COLORS.meta, align: 'right'
  });
}

// Helper: Add section tracker tabs (maroon section tab + grey sub-section tab)
export function addSectionTracker(slide, sectionLabel, subSectionLabel) {
  if (!sectionLabel && !subSectionLabel) return;

  // Main section tracker — maroon tab at top-left
  if (sectionLabel) {
    // Estimate width based on text length (approx 0.07 inches per character + padding)
    const sectionW = Math.max(1.0, sectionLabel.length * 0.065 + 0.35);
    // Background shape
    slide.addShape('rect', {
      x: 0, y: 0, w: sectionW, h: 0.28,
      fill: { color: COLORS.maroon },
      rectRadius: 0,
    });
    // Text
    slide.addText(sectionLabel, {
      x: 0.05, y: 0, w: sectionW - 0.1, h: 0.28,
      fontFace: 'Arial', fontSize: 8, bold: true, color: COLORS.white,
      valign: 'middle',
    });

    // Sub-section tracker — grey tab next to main tracker
    if (subSectionLabel) {
      const subW = Math.max(0.8, subSectionLabel.length * 0.06 + 0.3);
      const subX = sectionW + 0.04;
      // Background shape
      slide.addShape('rect', {
        x: subX, y: 0, w: subW, h: 0.25,
        fill: { color: COLORS.coal },
        rectRadius: 0,
      });
      // Text
      slide.addText(subSectionLabel, {
        x: subX + 0.05, y: 0, w: subW - 0.1, h: 0.25,
        fontFace: 'Arial', fontSize: 7, bold: true, color: COLORS.white,
        valign: 'middle',
      });
    }
  } else if (subSectionLabel) {
    // Sub-section only (no main section) — place at top-left
    const subW = Math.max(0.8, subSectionLabel.length * 0.06 + 0.3);
    slide.addShape('rect', {
      x: 0, y: 0, w: subW, h: 0.25,
      fill: { color: COLORS.coal },
      rectRadius: 0,
    });
    slide.addText(subSectionLabel, {
      x: 0.05, y: 0, w: subW - 0.1, h: 0.25,
      fontFace: 'Arial', fontSize: 7, bold: true, color: COLORS.white,
      valign: 'middle',
    });
  }
}

// Helper: Add standard title
export function addTitle(slide, text) {
  slide.addText(text, {
    x: LAYOUT.titleX, y: LAYOUT.titleY, w: LAYOUT.titleW, h: 0.8,
    fontFace: 'Georgia', fontSize: 28, color: COLORS.main
  });
}

// Helper: Add standard subtitle
export function addSubtitle(slide, text) {
  slide.addText(text, {
    x: LAYOUT.subtitleX, y: LAYOUT.subtitleY, w: LAYOUT.subtitleW, h: 0.4,
    fontFace: 'Arial', fontSize: 18, color: COLORS.red, bold: true
  });
}

// Helper: Extract and render source/footnote text from slide HTML
// Looks for common source/footnote classes and renders at the bottom of content area
export function addSourceNote(slide, html) {
  if (!html) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Look for source/footnote elements by class name (order: most specific first)
  const selectors = [
    '.graph-source',
    '.exhibit-source',
    '.chart-source',
    '.chart-commentary-source',
    '.benefit-sources',
    '.source-note',
    '.exec-takeaway-source',
    '.stat-source',
  ];

  const texts = [];
  for (const sel of selectors) {
    const els = doc.querySelectorAll(sel);
    els.forEach(el => {
      const t = el.textContent?.trim();
      if (t && t.length > 0 && !texts.includes(t)) {
        texts.push(t);
      }
    });
  }

  if (texts.length === 0) return;

  // Render all footnotes/sources just above the footer (y: 6.7)
  const combined = texts.join(' | ');
  slide.addText(combined, {
    x: 0.48, y: 6.7, w: 12.36, h: 0.25,
    fontFace: 'Arial', fontSize: 8, color: COLORS.meta
  });
}

// Helper: Parse HTML and extract content
function parseSlideHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const getText = (selector) => {
    const el = doc.querySelector(selector);
    return el ? el.textContent.trim() : '';
  };

  const getAll = (selector) => {
    return Array.from(doc.querySelectorAll(selector)).map(el => el.textContent.trim());
  };

  const getAllElements = (selector) => {
    return Array.from(doc.querySelectorAll(selector));
  };

  return { doc, getText, getAll, getAllElements };
}

// ============================================================================
// TEMPLATE RENDERERS
// Each function takes (pptx, slideData, slideNum, totalSlides) and creates a slide
// ============================================================================

// IMAGE-FULL SLIDE — full-bleed AI-generated image covering entire slide
export function renderImageFull(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { doc } = parseSlideHTML(slideData.html);

  // Extract base64 data URI from the img tag
  const img = doc.querySelector('img');
  const rawSrc = img?.getAttribute('src') || '';

  // PptxGenJS expects data in format 'image/png;base64,xxxx' (without 'data:' prefix)
  const dataSrc = rawSrc.startsWith('data:') ? rawSrc.slice(5) : rawSrc;

  if (dataSrc.includes('base64,')) {
    slide.addImage({
      data: dataSrc,
      x: 0, y: 0, w: 13.333, h: 7.5,
    });
  } else {
    // Fallback — white slide with title text
    slide.addText(slideData.title || 'Image slide', {
      x: 0.48, y: 3.0, w: 12.36, h: 1.0,
      fontFace: 'Arial', fontSize: 24, color: COLORS.main,
      align: 'center', valign: 'middle',
    });
  }

  // Source/footnote (rendered on semi-transparent bar so it's visible over image)
  addSourceNote(slide, slideData.html);

  addFooter(slide, slideNum, totalSlides);
}

// IMAGE-CONTENT SLIDE — AI-generated image in content frame with title/subtitle/footer
export function renderImageContent(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, doc } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title || '';
  const subtitle = getText('.subtitle') || '';

  // Title — 28pt Georgia, non-bold, black (matches HTML slide .title)
  if (title) {
    slide.addText(title, {
      x: LAYOUT.titleX, y: LAYOUT.titleY, w: LAYOUT.titleW, h: 0.7,
      fontFace: 'Georgia', fontSize: 28, color: COLORS.main,
      bold: false, valign: 'top',
    });
  }

  // Subtitle — 18pt Arial Bold, maroon/burgundy (matches HTML slide .subtitle)
  if (subtitle) {
    slide.addText(subtitle, {
      x: LAYOUT.subtitleX, y: LAYOUT.subtitleY, w: LAYOUT.subtitleW, h: 0.35,
      fontFace: 'Arial', fontSize: 18, color: COLORS.maroon,
      bold: true, valign: 'top',
    });
  }

  // Image in content frame
  const img = doc.querySelector('img');
  const rawSrc = img?.getAttribute('src') || '';

  // PptxGenJS expects data in format 'image/png;base64,xxxx' (without 'data:' prefix)
  const dataSrc = rawSrc.startsWith('data:') ? rawSrc.slice(5) : rawSrc;

  if (dataSrc.includes('base64,')) {
    slide.addImage({
      data: dataSrc,
      x: LAYOUT.frameX, y: LAYOUT.frameY,
      w: LAYOUT.frameW, h: LAYOUT.frameH,
    });
  }

  // Source/footnote
  addSourceNote(slide, slideData.html);

  // Footer
  addFooter(slide, slideNum, totalSlides);

  // Section tracker
  addSectionTracker(slide, slideData.sectionLabel, slideData.subSectionLabel);
}

// COVER SLIDE — plain black page (divider style, no text elements)
export function renderCover(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();

  // Solid black background — cover sits on a purely black page like a divider
  slide.addShape('rect', {
    x: 0, y: 0, w: 13.333, h: 7.5,
    fill: { color: '000000' }
  });
}

// THANK YOU / CLOSING SLIDE
export function renderThankYou(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAll } = parseSlideHTML(slideData.html);

  const icon = getText('.thank-you-icon') || '🙏';
  const title = getText('.thank-you-title') || getText('.cover-title') || 'Thank You';
  const subtitle = getText('.thank-you-subtitle') || '';
  const branding = getText('.cover-branding') || 'Strategy&';
  const date = getText('.cover-date') || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Icon (centered, large)
  slide.addText(icon, {
    x: 0.48, y: 1.6, w: 12.36, h: 0.8,
    fontSize: 40, align: 'center', valign: 'middle'
  });

  // Main thank you title (large, centered)
  slide.addText(title, {
    x: 0.48, y: 2.5, w: 12.36, h: 1.0,
    fontFace: 'Georgia', fontSize: 36, color: COLORS.main,
    align: 'center', valign: 'middle'
  });

  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.48, y: 3.5, w: 12.36, h: 0.5,
      fontFace: 'Arial', fontSize: 16, color: COLORS.meta,
      align: 'center'
    });
  }

  // Contact items
  const contactItems = getAll('.contact-item');
  if (contactItems.length > 0) {
    const contactText = contactItems.join('  |  ');
    slide.addText(contactText, {
      x: 1.5, y: 4.4, w: 10.33, h: 0.8,
      fontFace: 'Arial', fontSize: 12, color: COLORS.secondary,
      align: 'center', valign: 'middle'
    });
  }

  // Branding (bottom left)
  slide.addText(branding, {
    x: 0.48, y: 6.3, w: 3, h: 0.3,
    fontFace: 'Arial', fontSize: 16, color: COLORS.meta, bold: true
  });

  // Date (bottom right) — positioned above where footer would be to avoid overlap
  slide.addText(date, {
    x: 10.5, y: 6.3, w: 2.4, h: 0.3,
    fontFace: 'Arial', fontSize: 12, color: COLORS.meta, align: 'right'
  });

  // No title/subtitle header, no footer on closing slides
}

// BLANK CANVAS
export function renderBlank(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, doc } = parseSlideHTML(slideData.html);

  // Extract any content from blank-content div
  const content = doc.querySelector('.blank-content');
  if (content && content.textContent.trim()) {
    slide.addText(content.textContent.trim(), {
      x: 0.48, y: 0.48, w: 12.36, h: 6.3,
      fontFace: 'Arial', fontSize: 14, color: COLORS.secondary,
      valign: 'top'
    });
  }

  addFooter(slide, slideNum, totalSlides);
}

// THREE CARDS
export function renderThreeCards(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const cards = getAllElements('.card');
  const cardW = 3.95;
  const cardH = 4.5;
  const cardY = 1.90;
  const startX = 0.48;
  const gap = 0.22;

  cards.forEach((card, i) => {
    if (i >= 3) return;

    const x = startX + i * (cardW + gap);
    const hasBlockHeader = !!card.querySelector('.block-header');
    const icon = card.querySelector('.card-icon-circle')?.textContent?.trim() || '';
    const num = card.querySelector('.block-num')?.textContent?.trim()
      || card.querySelector('.card-num')?.textContent?.trim()
      || `0${i + 1}`;
    const cardTitle = (hasBlockHeader
      ? card.querySelector('.block-header h3')
      : card.querySelector('h3'))?.textContent?.trim() || '';
    let listItems = Array.from(card.querySelectorAll(hasBlockHeader ? '.block-body li' : 'li'))
      .map(li => li.textContent?.trim()).filter(Boolean);
    if (listItems.length === 0 && hasBlockHeader) {
      listItems = Array.from(card.querySelectorAll('.block-body p'))
        .map(p => p.textContent?.trim()).filter(Boolean);
    }
    const cardBody = card.querySelector('p')?.textContent?.trim() || '';
    const impact = card.querySelector('.impact-box')?.textContent?.trim() || '';

    // Card background
    slide.addShape('roundRect', {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: COLORS.zone1 },
      line: { color: COLORS.border, width: 0.5 },
      rectRadius: 0.05
    });

    if (hasBlockHeader) {
      // Maroon header banner with number + title as a single textbox
      const headerH = 0.45;
      slide.addText(num + '   ' + cardTitle, {
        x, y: cardY, w: cardW, h: headerH,
        fontFace: 'Arial', fontSize: 11, bold: true, color: COLORS.white,
        valign: 'middle', margin: 0, wrap: false, isTextBox: true,
        fill: { color: COLORS.maroon }
      });

      const bulletY = cardY + headerH + 0.12;
      const bulletH = cardH - headerH - 0.2;
      if (listItems.length > 0) {
        slide.addText(listItems.join('\n'), {
          x: x + 0.15, y: bulletY, w: cardW - 0.3, h: bulletH,
          fontFace: 'Arial', fontSize: 10, color: COLORS.secondary, valign: 'top',
          bullet: true, paraSpaceAfter: 6
        });
      } else {
        const bodyText = card.querySelector('.block-body')?.textContent?.trim() || '';
        if (bodyText) {
          slide.addText(bodyText, {
            x: x + 0.15, y: bulletY, w: cardW - 0.3, h: bulletH,
            fontFace: 'Arial', fontSize: 10, color: COLORS.secondary, valign: 'top'
          });
        }
      }
    } else {
      // Top border accent
      slide.addShape('rect', {
        x, y: cardY, w: cardW, h: 0.07,
        fill: { color: COLORS.maroon },
        line: { width: 0 }
      });

      // Icon circle
      if (icon) {
        slide.addShape('ellipse', {
          x: x + 0.15, y: cardY + 0.2, w: 0.5, h: 0.5,
          fill: { color: COLORS.maroon }
        });
        slide.addText(icon, {
          x: x + 0.15, y: cardY + 0.2, w: 0.5, h: 0.5,
          fontFace: 'Arial', fontSize: 16, color: COLORS.white, align: 'center', valign: 'middle'
        });
      }

      // Number
      slide.addText(num, {
        x: x + cardW - 0.7, y: cardY + 0.2, w: 0.6, h: 0.4,
        fontFace: 'Georgia', fontSize: 14, color: COLORS.meta, align: 'right'
      });

      // Card title
      if (cardTitle) {
        slide.addText(cardTitle, {
          x: x + 0.15, y: cardY + 0.85, w: cardW - 0.3, h: 0.5,
          fontFace: 'Arial', fontSize: 14, color: COLORS.main, bold: true
        });
      }

      // Card body: prefer list items, fall back to paragraph
      const bodyY = cardY + 1.4;
      const bodyH = impact ? 1.6 : 2.5;
      if (listItems.length > 0) {
        slide.addText(listItems.join('\n'), {
          x: x + 0.15, y: bodyY, w: cardW - 0.3, h: bodyH,
          fontFace: 'Arial', fontSize: 10, color: COLORS.secondary, valign: 'top',
          bullet: true, paraSpaceAfter: 6
        });
      } else if (cardBody) {
        slide.addText(cardBody, {
          x: x + 0.15, y: bodyY, w: cardW - 0.3, h: bodyH,
          fontFace: 'Arial', fontSize: 11, color: COLORS.secondary, valign: 'top'
        });
      }

      // Impact box at bottom
      if (impact) {
        slide.addShape('roundRect', {
          x: x + 0.1, y: cardY + cardH - 0.8, w: cardW - 0.2, h: 0.6,
          fill: { color: COLORS.rose },
          line: { width: 0 },
          rectRadius: 0.03
        });
        slide.addText(impact, {
          x: x + 0.15, y: cardY + cardH - 0.75, w: cardW - 0.3, h: 0.5,
          fontFace: 'Arial', fontSize: 10, color: COLORS.maroon, align: 'center', valign: 'middle'
        });
      }
    }
  });

  addFooter(slide, slideNum, totalSlides);
}

// KPI METRICS
export function renderKpiMetrics(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const kpiBlocks = getAllElements('.kpi-block');
  const detailItems = getAllElements('.detail-item');

  // Left column - KPI blocks
  let kpiY = 2.0;
  kpiBlocks.forEach((kpi, i) => {
    if (i >= 2) return;
    const value = kpi.querySelector('.kpi-value')?.textContent?.trim() || '';
    const label = kpi.querySelector('.kpi-label')?.textContent?.trim() || '';

    // KPI value (large)
    slide.addText(value, {
      x: 0.48, y: kpiY, w: 5.5, h: 0.8,
      fontFace: 'Georgia', fontSize: 42, color: COLORS.maroon, bold: true
    });

    // KPI label
    slide.addText(label, {
      x: 0.48, y: kpiY + 0.75, w: 5.5, h: 0.5,
      fontFace: 'Arial', fontSize: 13, color: COLORS.secondary
    });

    kpiY += 1.6;
  });

  // Right column - Detail items
  let detailY = 2.0;
  detailItems.forEach((item, i) => {
    if (i >= 4) return;
    const text = item.textContent?.trim() || '';

    // Bullet point
    slide.addShape('ellipse', {
      x: 6.5, y: detailY + 0.15, w: 0.12, h: 0.12,
      fill: { color: COLORS.maroon }
    });

    // Text
    slide.addText(text, {
      x: 6.75, y: detailY, w: 5.5, h: 0.6,
      fontFace: 'Arial', fontSize: 12, color: COLORS.secondary, valign: 'top'
    });

    detailY += 0.8;
  });

  addFooter(slide, slideNum, totalSlides);
}

// TIMELINE
export function renderTimeline(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const rows = getAllElements('.timeline-row');
  let rowY = 2.0;

  rows.forEach((row, i) => {
    if (i >= 4) return;

    const marker = row.querySelector('.timeline-marker')?.textContent?.trim() || '';
    const rowTitle = row.querySelector('h4')?.textContent?.trim() || '';
    const rowBody = row.querySelector('p')?.textContent?.trim() || '';

    // Marker circle
    slide.addShape('ellipse', {
      x: 0.48, y: rowY + 0.1, w: 0.9, h: 0.5,
      fill: { color: COLORS.maroon }
    });
    slide.addText(marker, {
      x: 0.48, y: rowY + 0.1, w: 0.9, h: 0.5,
      fontFace: 'Arial', fontSize: 10, color: COLORS.white, align: 'center', valign: 'middle', bold: true
    });

    // Vertical line (except last)
    if (i < rows.length - 1) {
      slide.addShape('line', {
        x: 0.93, y: rowY + 0.6, w: 0, h: 0.9,
        line: { color: COLORS.border, width: 2 }
      });
    }

    // Title
    slide.addText(rowTitle, {
      x: 1.6, y: rowY, w: 10.5, h: 0.4,
      fontFace: 'Arial', fontSize: 14, color: COLORS.main, bold: true
    });

    // Body
    slide.addText(rowBody, {
      x: 1.6, y: rowY + 0.4, w: 10.5, h: 0.7,
      fontFace: 'Arial', fontSize: 11, color: COLORS.secondary, valign: 'top'
    });

    rowY += 1.3;
  });

  addFooter(slide, slideNum, totalSlides);
}

// QUOTE
export function renderQuote(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');
  const quoteText = getText('.quote-text');
  const quoteAuthor = getText('.quote-author');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Quote box background
  slide.addShape('rect', {
    x: 0.48, y: 2.0, w: 12.36, h: 3.5,
    fill: { color: COLORS.zone1 },
    line: { width: 0 }
  });

  // Left border accent
  slide.addShape('rect', {
    x: 0.48, y: 2.0, w: 0.08, h: 3.5,
    fill: { color: COLORS.maroon },
    line: { width: 0 }
  });

  // Quote text
  if (quoteText) {
    slide.addText(`"${quoteText}"`, {
      x: 0.9, y: 2.3, w: 11.5, h: 2.2,
      fontFace: 'Georgia', fontSize: 18, color: COLORS.main, italic: true, valign: 'top'
    });
  }

  // Author
  if (quoteAuthor) {
    slide.addText(quoteAuthor, {
      x: 0.9, y: 4.8, w: 11.5, h: 0.4,
      fontFace: 'Arial', fontSize: 13, color: COLORS.meta
    });
  }

  addFooter(slide, slideNum, totalSlides);
}

// BULLET POINTS
export function renderBulletPoints(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAll } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');
  const bullets = getAll('.content-list li');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  let bulletY = 2.0;
  bullets.forEach((text, i) => {
    if (i >= 6) return;

    // Bullet point
    slide.addShape('ellipse', {
      x: 0.48, y: bulletY + 0.15, w: 0.15, h: 0.15,
      fill: { color: COLORS.maroon }
    });

    // Text
    slide.addText(text, {
      x: 0.8, y: bulletY, w: 11.8, h: 0.6,
      fontFace: 'Arial', fontSize: 13, color: COLORS.secondary, valign: 'top'
    });

    bulletY += 0.75;
  });

  addFooter(slide, slideNum, totalSlides);
}

// 2x2 GRID
export function renderGrid2x2(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');
  const cells = getAllElements('.grid-cell');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const cellW = 6.0;
  const cellH = 2.2;
  const startY = 1.95;
  const gap = 0.2;

  const positions = [
    { x: 0.48, y: startY },
    { x: 0.48 + cellW + gap, y: startY },
    { x: 0.48, y: startY + cellH + gap },
    { x: 0.48 + cellW + gap, y: startY + cellH + gap },
  ];

  cells.forEach((cell, i) => {
    if (i >= 4) return;
    const pos = positions[i];
    const cellTitle = cell.querySelector('h4')?.textContent?.trim() || '';
    const cellBody = cell.querySelector('p')?.textContent?.trim() || '';

    // Cell background
    slide.addShape('roundRect', {
      x: pos.x, y: pos.y, w: cellW, h: cellH,
      fill: { color: COLORS.zone1 },
      line: { color: COLORS.border, width: 0.5 },
      rectRadius: 0.05
    });

    // Cell title
    slide.addText(cellTitle, {
      x: pos.x + 0.15, y: pos.y + 0.15, w: cellW - 0.3, h: 0.4,
      fontFace: 'Arial', fontSize: 13, color: COLORS.maroon, bold: true
    });

    // Cell body
    slide.addText(cellBody, {
      x: pos.x + 0.15, y: pos.y + 0.55, w: cellW - 0.3, h: 1.5,
      fontFace: 'Arial', fontSize: 11, color: COLORS.secondary, valign: 'top'
    });
  });

  addFooter(slide, slideNum, totalSlides);
}

// COMPARISON TABLE
export function renderComparisonTable(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements, doc } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Extract table data
  const table = doc.querySelector('table');
  if (!table) {
    addFooter(slide, slideNum, totalSlides);
    return;
  }

  const rows = [];
  const headerRow = table.querySelector('thead tr');
  if (headerRow) {
    rows.push(Array.from(headerRow.querySelectorAll('th')).map(th => ({
      text: th.textContent.trim(),
      options: { bold: true, fill: { color: COLORS.maroon }, color: COLORS.white, fontFace: 'Arial', fontSize: 11 }
    })));
  }

  const bodyRows = table.querySelectorAll('tbody tr');
  bodyRows.forEach(tr => {
    rows.push(Array.from(tr.querySelectorAll('td')).map(td => ({
      text: td.textContent.trim(),
      options: { fontFace: 'Arial', fontSize: 10, color: COLORS.secondary }
    })));
  });

  if (rows.length > 0) {
    slide.addTable(rows, {
      x: 0.48, y: 2.0, w: 12.36,
      border: { color: COLORS.border, pt: 0.5 },
      colW: [2.5, 3.3, 3.3, 3.3],
      rowH: 0.5,
      align: 'left',
      valign: 'middle'
    });
  }

  addFooter(slide, slideNum, totalSlides);
}

// PROCESS FLOW
export function renderProcessFlow(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');
  const steps = getAllElements('.process-step');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const stepW = 2.2;
  const stepH = 3.8;
  const startX = 0.48;
  const startY = 2.0;
  const gap = 0.35;

  steps.forEach((step, i) => {
    if (i >= 5) return;
    const x = startX + i * (stepW + gap);
    const num = step.querySelector('.step-number')?.textContent?.trim() || `${i + 1}`;
    const stepTitle = step.querySelector('h4')?.textContent?.trim() || '';
    const stepBody = step.querySelector('p')?.textContent?.trim() || '';

    // Step number circle
    slide.addShape('ellipse', {
      x: x + (stepW - 0.6) / 2, y: startY, w: 0.6, h: 0.6,
      fill: { color: COLORS.maroon }
    });
    slide.addText(num, {
      x: x + (stepW - 0.6) / 2, y: startY, w: 0.6, h: 0.6,
      fontFace: 'Arial', fontSize: 16, color: COLORS.white, align: 'center', valign: 'middle', bold: true
    });

    // Arrow (except last)
    if (i < steps.length - 1 && i < 4) {
      slide.addText('>', {
        x: x + stepW + 0.05, y: startY + 0.1, w: 0.25, h: 0.5,
        fontFace: 'Arial', fontSize: 18, color: COLORS.meta, align: 'center'
      });
    }

    // Step title
    slide.addText(stepTitle, {
      x: x, y: startY + 0.75, w: stepW, h: 0.4,
      fontFace: 'Arial', fontSize: 12, color: COLORS.main, bold: true, align: 'center'
    });

    // Step body
    slide.addText(stepBody, {
      x: x, y: startY + 1.2, w: stepW, h: 2.5,
      fontFace: 'Arial', fontSize: 10, color: COLORS.secondary, valign: 'top', align: 'center'
    });
  });

  addFooter(slide, slideNum, totalSlides);
}

// CHEVRON FLOW - Consulting Style with Phases and Sub-steps
export function renderChevronFlow(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements, doc } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');
  const chevronItems = getAllElements('.chevron-item');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const numChevrons = Math.min(chevronItems.length, 5);
  if (numChevrons === 0) {
    addFooter(slide, slideNum, totalSlides);
    return;
  }

  // Calculate chevron dimensions
  const totalWidth = 12.36;
  const chevronH = 0.65;
  const chevronW = totalWidth / numChevrons;
  const startX = 0.48;
  const startY = 1.9;
  const arrowDepth = 0.25; // How much the arrow point extends

  // Color variations (maroon gradient)
  const chevronColors = [
    COLORS.maroon,
    'B84545', // 85% maroon
    'C96A6A', // 70% maroon
    'DA8F8F', // 55% maroon
    'EBB4B4', // 40% maroon
  ];

  chevronItems.forEach((item, i) => {
    if (i >= 5) return;

    const x = startX + i * chevronW;
    const chevronText = item.querySelector('.chevron-shape')?.textContent?.trim() || `Phase ${i + 1}`;
    const substeps = item.querySelectorAll('.chevron-substep');

    const isFirst = i === 0;
    const isLast = i === numChevrons - 1;
    const color = chevronColors[i] || COLORS.maroon;
    const textColor = COLORS.white;

    // Use built-in chevron shape for proper arrow rendering
    slide.addShape('chevron', {
      x: x,
      y: startY,
      w: chevronW,
      h: chevronH,
      fill: { color: color },
      line: { width: 0 }
    });

    // Chevron text - adjust position for arrow shape
    slide.addText(chevronText, {
      x: x + arrowDepth,
      y: startY,
      w: chevronW - arrowDepth * 2,
      h: chevronH,
      fontFace: 'Arial',
      fontSize: 10,
      color: textColor,
      bold: true,
      align: 'center',
      valign: 'middle'
    });

    // Sub-steps below chevron - numbered boxes
    const substepY = startY + chevronH + 0.15;
    const substepX = x + 0.08;
    const substepW = chevronW - 0.16;
    const substepH = 0.55;
    const substepGap = 0.08;

    if (substeps.length > 0) {
      substeps.forEach((substep, si) => {
        if (si >= 4) return;
        // Get text from substep-text span or fallback to full content
        const textEl = substep.querySelector('.substep-text');
        const text = textEl?.textContent?.trim() || substep.textContent?.trim() || '';
        const yPos = substepY + si * (substepH + substepGap);

        // Box background with left border accent
        slide.addShape('rect', {
          x: substepX,
          y: yPos,
          w: substepW,
          h: substepH,
          fill: { color: 'F8F9FA' },
          line: { color: 'DEE2E6', width: 0.5 }
        });

        // Left border accent
        slide.addShape('rect', {
          x: substepX,
          y: yPos,
          w: 0.04,
          h: substepH,
          fill: { color: color },
          line: { width: 0 }
        });

        // Numbered circle
        slide.addShape('ellipse', {
          x: substepX + 0.12,
          y: yPos + (substepH - 0.25) / 2,
          w: 0.25,
          h: 0.25,
          fill: { color: color }
        });

        // Number text
        slide.addText(`${si + 1}`, {
          x: substepX + 0.12,
          y: yPos + (substepH - 0.25) / 2,
          w: 0.25,
          h: 0.25,
          fontFace: 'Arial',
          fontSize: 8,
          color: COLORS.white,
          bold: true,
          align: 'center',
          valign: 'middle'
        });

        // Substep text
        slide.addText(text, {
          x: substepX + 0.45,
          y: yPos + 0.08,
          w: substepW - 0.55,
          h: substepH - 0.16,
          fontFace: 'Arial',
          fontSize: 9,
          color: COLORS.secondary,
          valign: 'middle'
        });
      });
    }
  });

  addFooter(slide, slideNum, totalSlides);
}

// OUTCOME APPROACH - Horizontal steps with sub-outcomes
export function renderOutcomeApproach(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');
  const rows = getAllElements('.outcome-row');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const startY = 1.85;
  const totalH = 4.3;
  const rowH = rows.length > 0 ? totalH / Math.min(rows.length, 4) : 1.0;
  const mainW = 2.5;
  const gap = 0.15;

  // Color variations
  const rowColors = [
    COLORS.maroon,
    'B84545',
    'C96A6A',
    'DA8F8F',
  ];

  rows.forEach((row, ri) => {
    if (ri >= 4) return;
    const yPos = startY + ri * rowH;
    const color = rowColors[ri] || COLORS.maroon;

    // Main outcome box
    const mainEl = row.querySelector('.outcome-main');
    const mainNum = mainEl?.querySelector('.outcome-num')?.textContent?.trim() || `${ri + 1}`;
    const mainText = mainEl?.querySelector('.outcome-text')?.textContent?.trim() || '';

    slide.addShape('rect', {
      x: 0.48,
      y: yPos,
      w: mainW,
      h: rowH - 0.1,
      fill: { color: color },
      line: { width: 0 }
    });

    // Number circle - white background with transparency
    slide.addShape('ellipse', {
      x: 0.6,
      y: yPos + (rowH - 0.1) / 2 - 0.2,
      w: 0.4,
      h: 0.4,
      fill: { color: 'FFFFFF', transparency: 75 }
    });

    // Number text - always white on burgundy
    slide.addText(mainNum, {
      x: 0.6,
      y: yPos + (rowH - 0.1) / 2 - 0.2,
      w: 0.4,
      h: 0.4,
      fontFace: 'Arial',
      fontSize: 12,
      color: COLORS.white,
      bold: true,
      align: 'center',
      valign: 'middle'
    });

    // Main text - always white on burgundy, 12pt
    slide.addText(mainText, {
      x: 1.1,
      y: yPos + 0.1,
      w: mainW - 0.7,
      h: rowH - 0.3,
      fontFace: 'Arial',
      fontSize: 12,
      color: COLORS.white,
      bold: true,
      valign: 'middle'
    });

    // Sub-outcomes
    const subs = row.querySelectorAll('.outcome-sub');
    const subStartX = 0.48 + mainW + gap;
    const subTotalW = 12.36 - mainW - gap;
    const subW = subs.length > 0 ? (subTotalW - (subs.length - 1) * 0.1) / subs.length : subTotalW;

    subs.forEach((sub, si) => {
      if (si >= 4) return;
      const subNum = sub.querySelector('.sub-num')?.textContent?.trim() || `${ri + 1}.${si + 1}`;
      const subText = sub.querySelector('.sub-text')?.textContent?.trim() || '';
      const subX = subStartX + si * (subW + 0.1);

      // Sub box
      slide.addShape('rect', {
        x: subX,
        y: yPos,
        w: subW,
        h: rowH - 0.1,
        fill: { color: 'F8F9FA' },
        line: { color: 'DEE2E6', width: 0.5 }
      });

      // Left accent
      slide.addShape('rect', {
        x: subX,
        y: yPos,
        w: 0.04,
        h: rowH - 0.1,
        fill: { color: color },
        line: { width: 0 }
      });

      // Sub number badge
      slide.addShape('rect', {
        x: subX + 0.15,
        y: yPos + 0.15,
        w: 0.4,
        h: 0.28,
        fill: { color: color },
        line: { width: 0 }
      });

      // Sub number - always white on burgundy
      slide.addText(subNum, {
        x: subX + 0.15,
        y: yPos + 0.15,
        w: 0.4,
        h: 0.28,
        fontFace: 'Arial',
        fontSize: 11,
        color: COLORS.white,
        bold: true,
        align: 'center',
        valign: 'middle'
      });

      // Sub text - 11pt
      slide.addText(subText, {
        x: subX + 0.15,
        y: yPos + 0.5,
        w: subW - 0.3,
        h: rowH - 0.7,
        fontFace: 'Arial',
        fontSize: 11,
        color: COLORS.secondary,
        valign: 'top'
      });
    });
  });

  addFooter(slide, slideNum, totalSlides);
}

// PROJECT STEP DETAIL - Clean design with burgundy activities & green outcomes
export function renderProjectStepDetail(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');
  const outcomes = getAllElements('.step-outcome-item');
  const activities = getAllElements('.step-activity');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const startY = 1.90;
  const contentH = 4.85;
  const gap = 0.25;
  const totalW = 12.36;

  // Left column wider (3:2 ratio)
  const leftW = (totalW - gap) * 3 / 5;
  const rightW = (totalW - gap) * 2 / 5;
  const activitiesX = 0.48;
  const outcomesX = activitiesX + leftW + gap;

  // ===== LEFT COLUMN - ACTIVITIES (wider, burgundy/maroon theme) =====
  slide.addShape('rect', {
    x: activitiesX, y: startY, w: leftW, h: contentH,
    fill: { color: 'FFFFFF' },
    line: { color: COLORS.rose, width: 1 }
  });

  // Burgundy header
  slide.addShape('rect', {
    x: activitiesX, y: startY, w: leftW, h: 0.4,
    fill: { color: COLORS.rose },
    line: { width: 0 }
  });
  slide.addText('KEY ACTIVITIES', {
    x: activitiesX + 0.15, y: startY + 0.05, w: leftW - 0.3, h: 0.3,
    fontFace: 'Arial', fontSize: 10, color: COLORS.maroon, bold: true
  });

  // Activity items with burgundy numbered boxes
  const actContentY = startY + 0.5;
  const actContentH = contentH - 0.6;
  const actCount = Math.min(activities.length || 5, 6);
  const actItemH = (actContentH - (actCount - 1) * 0.08) / actCount;

  activities.forEach((activity, i) => {
    if (i >= 6) return;
    const actTextEl = activity.querySelector('.step-activity-text');
    const actText = actTextEl?.textContent?.trim() || activity.textContent?.replace(/^[✓\d]/, '').trim() || '';
    const yPos = actContentY + i * (actItemH + 0.08);

    slide.addShape('rect', {
      x: activitiesX + 0.12, y: yPos, w: leftW - 0.24, h: actItemH,
      fill: { color: COLORS.zone1 }, line: { color: 'E9ECEF', width: 0.5 }
    });

    // Burgundy numbered box
    slide.addShape('rect', {
      x: activitiesX + 0.12, y: yPos, w: 0.4, h: actItemH,
      fill: { color: COLORS.maroon }, line: { width: 0 }
    });
    slide.addText(`${i + 1}`, {
      x: activitiesX + 0.12, y: yPos, w: 0.4, h: actItemH,
      fontFace: 'Arial', fontSize: 12, color: COLORS.white, bold: true,
      align: 'center', valign: 'middle'
    });

    slide.addText(actText, {
      x: activitiesX + 0.62, y: yPos + 0.08, w: leftW - 0.86, h: actItemH - 0.16,
      fontFace: 'Arial', fontSize: 10, color: COLORS.main, valign: 'middle'
    });
  });

  // ===== RIGHT COLUMN - DELIVERABLES (narrower, red/maroon theme) =====
  slide.addShape('rect', {
    x: outcomesX, y: startY, w: rightW, h: contentH,
    fill: { color: 'FFFFFF' },
    line: { color: COLORS.dangerSoft, width: 1 }
  });

  // Red-soft header
  slide.addShape('rect', {
    x: outcomesX, y: startY, w: rightW, h: 0.4,
    fill: { color: COLORS.dangerSoft },
    line: { width: 0 }
  });
  slide.addText('DELIVERABLES', {
    x: outcomesX + 0.15, y: startY + 0.05, w: rightW - 0.3, h: 0.3,
    fontFace: 'Arial', fontSize: 10, color: COLORS.maroon, bold: true
  });

  // Outcome items with maroon numbers
  const outContentY = startY + 0.5;
  const outContentH = contentH - 0.6;
  const outCount = Math.min(outcomes.length || 4, 6);
  const outItemH = (outContentH - (outCount - 1) * 0.08) / outCount;

  outcomes.forEach((outcome, i) => {
    if (i >= 6) return;
    const outTextEl = outcome.querySelector('.outcome-text');
    const outText = outTextEl?.textContent?.trim() || outcome.textContent?.replace(/^[\d✓→]/, '').trim() || '';
    const yPos = outContentY + i * (outItemH + 0.08);

    slide.addShape('rect', {
      x: outcomesX + 0.12, y: yPos, w: rightW - 0.24, h: outItemH,
      fill: { color: COLORS.zone1 }, line: { color: 'E9ECEF', width: 0.5 }
    });

    // Maroon number box
    slide.addShape('rect', {
      x: outcomesX + 0.12, y: yPos, w: 0.4, h: outItemH,
      fill: { color: COLORS.maroon }, line: { width: 0 }
    });
    slide.addText(`${i + 1}`, {
      x: outcomesX + 0.12, y: yPos, w: 0.4, h: outItemH,
      fontFace: 'Arial', fontSize: 11, color: COLORS.white, bold: true,
      align: 'center', valign: 'middle'
    });

    slide.addText(outText, {
      x: outcomesX + 0.62, y: yPos + 0.08, w: rightW - 0.86, h: outItemH - 0.16,
      fontFace: 'Arial', fontSize: 10, color: COLORS.main, valign: 'middle'
    });
  });

  addFooter(slide, slideNum, totalSlides);
}

// RECOMMENDATION SUMMARY
export function renderRecommendationSummary(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');
  const cards = getAllElements('.recommendation-card');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const startY = 1.85;
  const startX = 0.48;
  const totalW = 12.4;
  const gap = 0.2;
  const cardCount = Math.min(cards.length || 3, 3);
  const cardW = (totalW - (cardCount - 1) * gap) / cardCount;
  const cardH = 4.2;

  cards.forEach((card, i) => {
    if (i >= 3) return;
    const xPos = startX + i * (cardW + gap);
    const num = card.querySelector('.rec-num')?.textContent?.trim() || `${i + 1}`;
    const cardTitle = card.querySelector('h4')?.textContent?.trim() || '';
    const rationale = card.querySelector('.rec-rationale')?.textContent?.trim() || '';
    const impact = card.querySelector('.rec-impact')?.textContent?.trim() || '';

    // Top accent
    slide.addShape('rect', {
      x: xPos,
      y: startY,
      w: cardW,
      h: 0.04,
      fill: { color: COLORS.maroon },
      line: { width: 0 }
    });

    // Card background
    slide.addShape('rect', {
      x: xPos,
      y: startY + 0.04,
      w: cardW,
      h: cardH,
      fill: { color: 'F5F5F5' },
      line: { width: 0 }
    });

    // Number strip
    slide.addShape('rect', {
      x: xPos,
      y: startY + 0.04,
      w: 0.4,
      h: cardH,
      fill: { color: COLORS.maroon },
      line: { width: 0 }
    });

    slide.addText(num, {
      x: xPos,
      y: startY + 0.04,
      w: 0.4,
      h: 0.5,
      fontFace: 'Arial',
      fontSize: 14,
      color: COLORS.white,
      bold: true,
      align: 'center',
      valign: 'middle'
    });

    // Title
    slide.addText(cardTitle, {
      x: xPos + 0.5,
      y: startY + 0.15,
      w: cardW - 0.65,
      h: 0.4,
      fontFace: 'Arial',
      fontSize: 11,
      color: COLORS.main,
      bold: true
    });

    // Rationale
    slide.addText(rationale, {
      x: xPos + 0.5,
      y: startY + 0.6,
      w: cardW - 0.65,
      h: cardH - 1.4,
      fontFace: 'Arial',
      fontSize: 9,
      color: COLORS.secondary,
      valign: 'top'
    });

    // Impact
    slide.addText(impact, {
      x: xPos + 0.5,
      y: startY + cardH - 0.6,
      w: cardW - 0.65,
      h: 0.5,
      fontFace: 'Arial',
      fontSize: 9,
      color: COLORS.secondary,
      valign: 'bottom'
    });
  });

  addFooter(slide, slideNum, totalSlides);
}

// CURRENT VS FUTURE STATE
// Reuses pros-cons layout with an arrow between columns
export function renderCurrentFutureState(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements, doc } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  // Support both old (.current-state .state-item) and new (.current-item) selectors
  let currentItems = getAllElements('.current-state-col .pc-item');
  let futureItems = getAllElements('.future-state-col .pc-item');
  if (!currentItems.length) currentItems = getAllElements('.current-state .state-item');
  if (!futureItems.length) futureItems = getAllElements('.future-state .state-item');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const startY = 1.85;
  const startX = 0.48;
  const colW = 5.3;
  const arrowW = 1.3;
  const contentH = 4.2;
  const headerH = 0.45;
  const neutral = '4A4F57';
  const neutralSoft = 'EEF2F6';
  const success = '27AE60';
  const successSoft = 'EAFAF1';

  // --- Current State column ---
  slide.addShape('rect', {
    x: startX, y: startY, w: colW, h: headerH,
    fill: { color: neutralSoft },
    line: { width: 0 }
  });
  slide.addText('●  Current State', {
    x: startX, y: startY, w: colW, h: headerH,
    fontFace: 'Arial', fontSize: 11, color: neutral,
    bold: true, align: 'center', valign: 'middle'
  });

  const itemsY = startY + headerH + 0.1;
  const itemsH = contentH - headerH - 0.1;
  const currentH = itemsH / Math.max(currentItems.length || 4, 1);
  currentItems.forEach((item, i) => {
    if (i >= 5) return;
    const strong = item.querySelector('strong');
    const p = item.querySelector('p');
    const boldText = strong?.textContent?.trim() || '';
    const descText = p?.textContent?.trim() || '';
    const fallback = item.textContent?.trim().replace(/^[✗✓●]\s*/, '') || '';
    const yPos = itemsY + i * currentH;

    slide.addShape('circle', {
      x: startX + 0.15, y: yPos + (currentH - 0.22) / 2, w: 0.22, h: 0.22,
      fill: { color: neutralSoft }, line: { width: 0 }
    });
    slide.addText('●', {
      x: startX + 0.15, y: yPos + (currentH - 0.22) / 2, w: 0.22, h: 0.22,
      fontFace: 'Arial', fontSize: 8, color: neutral,
      bold: true, align: 'center', valign: 'middle'
    });

    if (boldText) {
      slide.addText([
        { text: boldText, options: { bold: true, fontSize: 10, color: COLORS.main } },
        ...(descText ? [{ text: '\n' + descText, options: { fontSize: 9, color: COLORS.secondary } }] : [])
      ], {
        x: startX + 0.5, y: yPos, w: colW - 0.65, h: currentH,
        fontFace: 'Arial', valign: 'middle', lineSpacing: 14
      });
    } else {
      slide.addText(fallback, {
        x: startX + 0.5, y: yPos, w: colW - 0.65, h: currentH,
        fontFace: 'Arial', fontSize: 10, color: COLORS.secondary, valign: 'middle'
      });
    }
  });

  // --- Arrow ---
  slide.addText('→', {
    x: startX + colW, y: startY + contentH / 2 - 0.25,
    w: arrowW, h: 0.5,
    fontFace: 'Arial', fontSize: 32, color: COLORS.maroon,
    bold: true, align: 'center', valign: 'middle'
  });

  // --- Future State column ---
  const futureX = startX + colW + arrowW;

  slide.addShape('rect', {
    x: futureX, y: startY, w: colW, h: headerH,
    fill: { color: successSoft },
    line: { width: 0 }
  });
  slide.addText('✓  Future State', {
    x: futureX, y: startY, w: colW, h: headerH,
    fontFace: 'Arial', fontSize: 11, color: success,
    bold: true, align: 'center', valign: 'middle'
  });

  const futureH = itemsH / Math.max(futureItems.length || 4, 1);
  futureItems.forEach((item, i) => {
    if (i >= 5) return;
    const strong = item.querySelector('strong');
    const p = item.querySelector('p');
    const boldText = strong?.textContent?.trim() || '';
    const descText = p?.textContent?.trim() || '';
    const fallback = item.textContent?.trim().replace(/^[✗✓]\s*/, '') || '';
    const yPos = itemsY + i * futureH;

    slide.addShape('circle', {
      x: futureX + 0.15, y: yPos + (futureH - 0.22) / 2, w: 0.22, h: 0.22,
      fill: { color: successSoft }, line: { width: 0 }
    });
    slide.addText('✓', {
      x: futureX + 0.15, y: yPos + (futureH - 0.22) / 2, w: 0.22, h: 0.22,
      fontFace: 'Arial', fontSize: 8, color: success,
      bold: true, align: 'center', valign: 'middle'
    });

    if (boldText) {
      slide.addText([
        { text: boldText, options: { bold: true, fontSize: 10, color: COLORS.main } },
        ...(descText ? [{ text: '\n' + descText, options: { fontSize: 9, color: COLORS.secondary } }] : [])
      ], {
        x: futureX + 0.5, y: yPos, w: colW - 0.65, h: futureH,
        fontFace: 'Arial', valign: 'middle', lineSpacing: 14
      });
    } else {
      slide.addText(fallback, {
        x: futureX + 0.5, y: yPos, w: colW - 0.65, h: futureH,
        fontFace: 'Arial', fontSize: 10, color: COLORS.secondary, valign: 'middle'
      });
    }
  });

  addFooter(slide, slideNum, totalSlides);
}

// STAT HIGHLIGHT
export function renderStatHighlight(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, doc } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;

  addTitle(slide, title);

  // Extract stat components
  const dollar = getText('.stat-dollar');
  const number = getText('.stat-number');
  const unit = getText('.stat-unit');
  const label = getText('.stat-label');
  const context = getText('.stat-context');

  // Build stat string
  let statText = '';
  if (dollar) statText += dollar;
  if (number) statText += number;
  if (unit) statText += unit;

  // Large stat
  slide.addText(statText || '0', {
    x: 0.48, y: 2.0, w: 12.36, h: 1.5,
    fontFace: 'Georgia', fontSize: 72, color: COLORS.maroon, bold: true, align: 'center'
  });

  // Label
  if (label) {
    slide.addText(label, {
      x: 0.48, y: 3.6, w: 12.36, h: 0.5,
      fontFace: 'Arial', fontSize: 18, color: COLORS.main, align: 'center'
    });
  }

  // Context
  if (context) {
    slide.addText(context, {
      x: 1.5, y: 4.3, w: 10.36, h: 1.0,
      fontFace: 'Arial', fontSize: 13, color: COLORS.secondary, align: 'center', valign: 'top'
    });
  }

  // Source if present
  const source = getText('.stat-source');
  if (source) {
    slide.addText(source, {
      x: 0.48, y: 5.8, w: 12.36, h: 0.3,
      fontFace: 'Arial', fontSize: 10, color: COLORS.meta, italic: true, align: 'center'
    });
  }

  addFooter(slide, slideNum, totalSlides);
}

// EMPTY PAGE (no standard elements)
export function renderEmptyPage(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, doc } = parseSlideHTML(slideData.html);

  // Extract any text content and position it
  const content = doc.body.textContent?.trim();
  if (content && content.length > 0) {
    slide.addText(content, {
      x: 0, y: 0, w: 13.333, h: 7.5,
      fontFace: 'Arial', fontSize: 14, color: COLORS.secondary,
      valign: 'middle', align: 'center'
    });
  }

  // No footer on empty page
}

// NUMBERED LIST (numbered items with title and description)
export function renderNumberedList(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Try to find numbered items - various selectors
  const items = getAllElements('.list-item, .numbered-item, .item, ol li, .point');
  const itemW = 12.36;
  let yPos = 2.0;

  items.forEach((item, i) => {
    if (i >= 6 || yPos > 6) return; // Max 6 items

    const itemTitle = item.querySelector('.item-title, .point-title, h3, h4, strong')?.textContent?.trim();
    const itemDesc = item.querySelector('.item-description, .point-desc, p')?.textContent?.trim()
      || item.textContent?.trim();

    // Number circle
    slide.addShape('ellipse', {
      x: 0.48, y: yPos + 0.05, w: 0.4, h: 0.4,
      fill: { color: COLORS.maroon },
      line: { width: 0 }
    });

    // Number text
    slide.addText(String(i + 1), {
      x: 0.48, y: yPos + 0.05, w: 0.4, h: 0.4,
      fontFace: 'Arial', fontSize: 14, color: 'FFFFFF', bold: true,
      align: 'center', valign: 'middle'
    });

    // Item title
    if (itemTitle && itemTitle !== itemDesc) {
      slide.addText(itemTitle, {
        x: 1.1, y: yPos, w: itemW - 0.7, h: 0.35,
        fontFace: 'Arial', fontSize: 14, color: COLORS.main, bold: true
      });

      // Item description
      if (itemDesc && itemDesc.length > 3) {
        slide.addText(itemDesc.substring(0, 300), {
          x: 1.1, y: yPos + 0.35, w: itemW - 0.7, h: 0.45,
          fontFace: 'Arial', fontSize: 11, color: COLORS.secondary
        });
      }
      yPos += 0.9;
    } else {
      // Just the text
      slide.addText((itemDesc || itemTitle || '').substring(0, 300), {
        x: 1.1, y: yPos, w: itemW - 0.7, h: 0.5,
        fontFace: 'Arial', fontSize: 13, color: COLORS.main
      });
      yPos += 0.65;
    }
  });

  addFooter(slide, slideNum, totalSlides);
}

// HORIZONTAL BARS (items with bars/progress)
export function renderHorizontalBars(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Try to find bar items
  const bars = getAllElements('.bar-item, .progress-item, .metric-bar, .horizontal-bar');
  let yPos = 2.0;
  const barW = 10;
  const barH = 0.35;

  bars.forEach((bar, i) => {
    if (i >= 6 || yPos > 6) return;

    const label = bar.querySelector('.bar-label, .label, span:first-child')?.textContent?.trim()
      || bar.textContent?.trim()?.split('\n')[0];
    const value = bar.querySelector('.bar-value, .value, span:last-child')?.textContent?.trim();

    // Label
    slide.addText((label || `Item ${i + 1}`).substring(0, 50), {
      x: 0.48, y: yPos, w: 4, h: 0.4,
      fontFace: 'Arial', fontSize: 13, color: COLORS.main, bold: true
    });

    // Bar background
    slide.addShape('rect', {
      x: 0.48, y: yPos + 0.45, w: barW, h: barH,
      fill: { color: COLORS.zone2 },
      line: { width: 0 }
    });

    // Bar fill (estimate percentage or use sequential)
    const fillPercent = Math.max(0.3, 1 - (i * 0.15));
    slide.addShape('rect', {
      x: 0.48, y: yPos + 0.45, w: barW * fillPercent, h: barH,
      fill: { color: COLORS.maroon },
      line: { width: 0 }
    });

    // Value text
    if (value) {
      slide.addText(value, {
        x: 10.8, y: yPos + 0.45, w: 2, h: barH,
        fontFace: 'Arial', fontSize: 12, color: COLORS.main, bold: true, valign: 'middle'
      });
    }

    yPos += 1.0;
  });

  addFooter(slide, slideNum, totalSlides);
}

// EXECUTIVE SUMMARY / SPLIT CONTENT (left panel + right content)
export function renderSplitContent(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements, doc } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Try to find left/right panels or key message + content
  const leftPanel = doc.querySelector('.left-panel, .key-message, .summary-box, .highlight-box');
  const rightPanel = doc.querySelector('.right-panel, .details, .content-area');
  const keyMessage = getText('.key-message, .summary, .takeaway');

  // Key message box on left if available
  if (keyMessage || leftPanel) {
    // Background box
    slide.addShape('rect', {
      x: 0.48, y: 2.0, w: 4.0, h: 4.0,
      fill: { color: COLORS.rose },
      line: { width: 0 }
    });

    // Key message text
    slide.addText(keyMessage || leftPanel?.textContent?.trim()?.substring(0, 400) || '', {
      x: 0.68, y: 2.2, w: 3.6, h: 3.6,
      fontFace: 'Georgia', fontSize: 14, color: COLORS.maroon, italic: true, valign: 'top'
    });
  }

  // Right content (bullets or paragraphs)
  const rightX = keyMessage || leftPanel ? 4.8 : 0.48;
  const rightW = keyMessage || leftPanel ? 8.0 : 12.36;
  let yPos = 2.0;

  // Try bullets first
  const bullets = rightPanel?.querySelectorAll('li') || doc.querySelectorAll('.content li, .body li, ul li');
  if (bullets.length > 0) {
    bullets.forEach((bullet, i) => {
      if (i >= 6 || yPos > 6) return;

      slide.addShape('ellipse', {
        x: rightX, y: yPos + 0.15, w: 0.1, h: 0.1,
        fill: { color: COLORS.maroon }
      });

      slide.addText(bullet.textContent?.trim()?.substring(0, 200) || '', {
        x: rightX + 0.25, y: yPos, w: rightW - 0.3, h: 0.5,
        fontFace: 'Arial', fontSize: 12, color: COLORS.secondary
      });
      yPos += 0.6;
    });
  } else {
    // Fall back to paragraphs
    const paragraphs = rightPanel?.querySelectorAll('p') || doc.querySelectorAll('.content p, .body p');
    paragraphs.forEach((p, i) => {
      if (i >= 4 || yPos > 5.5) return;
      const text = p.textContent?.trim();
      if (text && text.length > 5) {
        slide.addText(text.substring(0, 400), {
          x: rightX, y: yPos, w: rightW, h: 1.0,
          fontFace: 'Arial', fontSize: 12, color: COLORS.secondary, valign: 'top'
        });
        yPos += 1.1;
      }
    });
  }

  addFooter(slide, slideNum, totalSlides);
}

// STRATEGIC INSIGHT (premium insight layout with hero, evidence, and impact strip)
// KEY FINDING - Main finding with supporting evidence
export function renderKeyFinding(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Main finding box
  const findingY = 1.9;
  const findingH = 1.0;
  const mainFinding = getText('.finding-main h2') || 'Key finding statement';
  const findingContext = getText('.finding-main p') || '';

  slide.addShape('roundRect', {
    x: 0.48, y: findingY, w: 12.36, h: findingH,
    fill: { color: COLORS.maroon },
    rectRadius: 0.06
  });

  slide.addText(mainFinding, {
    x: 0.68, y: findingY + 0.15, w: 11.96, h: 0.5,
    fontFace: 'Georgia', fontSize: 16, color: COLORS.white, bold: true, align: 'center'
  });

  if (findingContext) {
    slide.addText(findingContext, {
      x: 0.68, y: findingY + 0.6, w: 11.96, h: 0.3,
      fontFace: 'Arial', fontSize: 10, color: COLORS.white, align: 'center'
    });
  }

  // Evidence items
  const evY = 3.1;
  const evH = 1.8;
  const evW = 4.0;
  const evGap = 0.18;

  const evidenceItems = getAllElements('.evidence-item');
  const evidenceData = evidenceItems.length > 0 ? evidenceItems.map((e, i) => ({
    num: e.querySelector('.evidence-num')?.textContent?.trim() || `${i + 1}`,
    title: e.querySelector('h4')?.textContent?.trim() || `Evidence ${i + 1}`,
    text: e.querySelector('p')?.textContent?.trim() || 'Supporting detail'
  })) : [
    { num: '1', title: 'Evidence Point 1', text: 'Supporting detail' },
    { num: '2', title: 'Evidence Point 2', text: 'Supporting detail' },
    { num: '3', title: 'Evidence Point 3', text: 'Supporting detail' }
  ];

  evidenceData.slice(0, 3).forEach((e, i) => {
    const x = 0.48 + i * (evW + evGap);

    // Card background
    slide.addShape('roundRect', {
      x: x, y: evY, w: evW, h: evH,
      fill: { color: 'F8F9FA' },
      line: { color: COLORS.border, width: 0.5 },
      rectRadius: 0.05
    });

    // Number circle
    slide.addShape('ellipse', {
      x: x + 0.15, y: evY + 0.15, w: 0.35, h: 0.35,
      fill: { color: COLORS.maroon }
    });
    slide.addText(e.num, {
      x: x + 0.15, y: evY + 0.15, w: 0.35, h: 0.35,
      fontFace: 'Arial', fontSize: 11, color: COLORS.white, bold: true,
      align: 'center', valign: 'middle'
    });

    // Title
    slide.addText(e.title, {
      x: x + 0.15, y: evY + 0.6, w: evW - 0.3, h: 0.35,
      fontFace: 'Arial', fontSize: 12, color: COLORS.main, bold: true
    });

    // Text
    slide.addText(e.text, {
      x: x + 0.15, y: evY + 1.0, w: evW - 0.3, h: 0.7,
      fontFace: 'Arial', fontSize: 10, color: COLORS.secondary, valign: 'top'
    });
  });

  // Metrics row
  const metricY = 5.1;
  const metricH = 0.8;
  const metricW = 4.0;

  const metricItems = getAllElements('.finding-metric');
  const metrics = metricItems.length > 0 ? metricItems.map(m => ({
    val: m.querySelector('.metric-value')?.textContent?.trim() || 'Value',
    lbl: m.querySelector('.metric-label')?.textContent?.trim() || 'Label'
  })) : [
    { val: 'Value 1', lbl: 'Label 1' },
    { val: 'Value 2', lbl: 'Label 2' },
    { val: 'Value 3', lbl: 'Label 3' }
  ];

  metrics.slice(0, 3).forEach((m, i) => {
    const x = 0.48 + i * (metricW + evGap);

    slide.addShape('roundRect', {
      x: x, y: metricY, w: metricW, h: metricH,
      fill: { color: COLORS.zone1 },
      line: { color: COLORS.border, width: 0.5 },
      rectRadius: 0.05
    });

    slide.addText(m.val, {
      x: x, y: metricY + 0.1, w: metricW, h: 0.4,
      fontFace: 'Georgia', fontSize: 18, color: COLORS.maroon, bold: true, align: 'center'
    });

    slide.addText(m.lbl, {
      x: x, y: metricY + 0.5, w: metricW, h: 0.25,
      fontFace: 'Arial', fontSize: 9, color: COLORS.meta, align: 'center'
    });
  });

  addFooter(slide, slideNum, totalSlides);
}

// STRATEGY QUADRANT - 4 quadrants with center focus
export function renderStrategyQuadrant(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Get quadrant data from HTML
  const quadrants = getAllElements('.quadrant');
  const quadrantData = quadrants.length > 0 ? quadrants.map((q, i) => ({
    title: q.querySelector('h4')?.textContent?.trim() || `Quadrant ${i + 1}`,
    desc: q.querySelector('p')?.textContent?.trim() || ''
  })) : [
    { title: 'Stars', desc: 'High growth, high share' },
    { title: 'Question Marks', desc: 'High growth, low share' },
    { title: 'Cash Cows', desc: 'Low growth, high share' },
    { title: 'Dogs', desc: 'Low growth, low share' }
  ];

  // Get center content
  const center = getAllElements('.quadrant-center')[0];
  const centerTitle = center?.querySelector('h5')?.textContent?.trim() || 'Strategy';
  const centerDesc = center?.querySelector('span')?.textContent?.trim() || '';

  // Get axis labels
  const axisTop = getText('.quadrant-axis.top') || 'High';
  const axisBottom = getText('.quadrant-axis.bottom') || 'Low';
  const axisLeft = getText('.quadrant-axis.left') || 'Low';
  const axisRight = getText('.quadrant-axis.right') || 'High';

  // Squared quadrant layout
  const startX = 1.5;
  const startY = 2.0;
  const quadW = 5.0;
  const quadH = 2.2;
  const gap = 0.1;

  // Light pastel colors for quadrants
  const colors = ['E8F4FD', 'FDF2E8', 'E8FDF2', 'F8E8FD'];

  // Quadrant positions: [Q1 top-left, Q2 top-right, Q3 bottom-left, Q4 bottom-right]
  const positions = [
    { x: startX, y: startY },
    { x: startX + quadW + gap, y: startY },
    { x: startX, y: startY + quadH + gap },
    { x: startX + quadW + gap, y: startY + quadH + gap }
  ];

  // Draw quadrants as rounded rectangles
  quadrantData.slice(0, 4).forEach((q, i) => {
    const pos = positions[i];

    slide.addShape('roundRect', {
      x: pos.x, y: pos.y, w: quadW, h: quadH,
      fill: { color: colors[i] },
      line: { color: COLORS.border, width: 0.5 },
      rectRadius: 0.06
    });

    // Quadrant title
    slide.addText(q.title.toUpperCase(), {
      x: pos.x + 0.2, y: pos.y + 0.3, w: quadW - 0.4, h: 0.4,
      fontFace: 'Arial', fontSize: 11, color: COLORS.main, bold: true, align: 'center'
    });

    // Quadrant description
    if (q.desc) {
      slide.addText(q.desc, {
        x: pos.x + 0.2, y: pos.y + 0.7, w: quadW - 0.4, h: 1.2,
        fontFace: 'Arial', fontSize: 9, color: COLORS.secondary, align: 'center', valign: 'top'
      });
    }
  });

  // Center circle with maroon background
  const centerX = startX + quadW + gap / 2;
  const centerY = startY + quadH + gap / 2;
  const centerSize = 1.3;

  slide.addShape('ellipse', {
    x: centerX - centerSize / 2,
    y: centerY - centerSize / 2,
    w: centerSize,
    h: centerSize,
    fill: { color: COLORS.maroon },
    line: { color: 'FFFFFF', width: 2 },
    shadow: { type: 'outer', blur: 3, offset: 1, angle: 45, color: '000000', opacity: 0.15 }
  });

  slide.addText(centerTitle.toUpperCase(), {
    x: centerX - centerSize / 2,
    y: centerY - 0.2,
    w: centerSize,
    h: 0.35,
    fontFace: 'Arial', fontSize: 10, color: COLORS.white, bold: true,
    align: 'center', valign: 'middle'
  });

  if (centerDesc) {
    slide.addText(centerDesc, {
      x: centerX - centerSize / 2,
      y: centerY + 0.1,
      w: centerSize,
      h: 0.25,
      fontFace: 'Arial', fontSize: 7, color: 'FFFFFF',
      align: 'center'
    });
  }

  // Axis labels
  slide.addText(axisTop, {
    x: centerX - 0.5, y: startY - 0.3, w: 1, h: 0.25,
    fontFace: 'Arial', fontSize: 9, color: COLORS.meta, align: 'center', bold: true
  });

  slide.addText(axisBottom, {
    x: centerX - 0.5, y: startY + quadH * 2 + gap + 0.1, w: 1, h: 0.25,
    fontFace: 'Arial', fontSize: 9, color: COLORS.meta, align: 'center', bold: true
  });

  slide.addText(axisLeft, {
    x: startX - 0.5, y: centerY - 0.15, w: 0.4, h: 0.3,
    fontFace: 'Arial', fontSize: 9, color: COLORS.meta, align: 'center', bold: true
  });

  slide.addText(axisRight, {
    x: startX + quadW * 2 + gap + 0.1, y: centerY - 0.15, w: 0.5, h: 0.3,
    fontFace: 'Arial', fontSize: 9, color: COLORS.meta, align: 'center', bold: true
  });

  addFooter(slide, slideNum, totalSlides);
}

// ============================================================================
// CHART-BASED RENDERERS (using actual PowerPoint charts)
// ============================================================================

// BAR CHART EXHIBIT - Horizontal bar chart with callouts
export function renderBarChart(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title, h1') || slideData.title || 'Bar Chart';
  const subtitle = getText('.subtitle, h2');

  if (title) addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Extract bar data from HTML
  const barRows = getAllElements('.bar-row');
  const labels = [];
  const values = [];

  barRows.forEach(row => {
    const label = row.querySelector('.bar-label')?.textContent?.trim() || '';
    const valueText = row.querySelector('.bar-value')?.textContent?.trim() || '0';
    // Extract numeric value (remove %, $, etc.)
    const numValue = parseFloat(valueText.replace(/[^0-9.-]/g, '')) || 0;
    labels.push(label);
    values.push(numValue);
  });

  // Create chart data - if no data found, use placeholder
  const chartData = labels.length > 0 ? [
    {
      name: 'Values',
      labels: labels,
      values: values
    }
  ] : [
    {
      name: 'Values',
      labels: ['Category A', 'Category B', 'Category C', 'Category D', 'Category E'],
      values: [85, 72, 68, 54, 41]
    }
  ];

  // Add the bar chart
  slide.addChart('bar', chartData, {
    x: 0.48,
    y: 1.9,
    w: 8.5,
    h: 3.8,
    barDir: 'bar', // horizontal bars
    barGrouping: 'clustered',
    chartColors: [COLORS.maroon],
    showValue: true,
    dataLabelPosition: 'outEnd',
    dataLabelFontSize: 10,
    dataLabelColor: COLORS.coal,
    catAxisTitle: '',
    valAxisTitle: '',
    catAxisLabelFontSize: 10,
    catAxisLabelColor: COLORS.coal,
    valAxisLabelFontSize: 9,
    valAxisLabelColor: COLORS.meta,
    valAxisMaxVal: 100,
    showLegend: false,
    barGapWidthPct: 50
  });

  // Extract and add callouts
  const callouts = getAllElements('.chart-callout, .exhibit-callout');
  const calloutY = 5.9;

  callouts.forEach((callout, i) => {
    if (i >= 3) return;
    const num = callout.querySelector('.callout-num')?.textContent?.trim() || (i + 1).toString();
    const text = callout.querySelector('.callout-text')?.textContent?.trim() || '';

    const calloutX = 0.48 + (i * 4.1);
    const calloutW = 3.9;

    // Callout box
    slide.addShape('rect', {
      x: calloutX, y: calloutY, w: calloutW, h: 0.7,
      fill: { color: COLORS.zone1 },
      line: { color: COLORS.maroon, width: 1, dashType: 'solid' }
    });

    // Left border accent
    slide.addShape('rect', {
      x: calloutX, y: calloutY, w: 0.05, h: 0.7,
      fill: { color: COLORS.maroon },
      line: { color: COLORS.maroon }
    });

    // Number circle
    slide.addShape('ellipse', {
      x: calloutX + 0.15, y: calloutY + 0.2, w: 0.3, h: 0.3,
      fill: { color: COLORS.maroon }
    });
    slide.addText(num, {
      x: calloutX + 0.15, y: calloutY + 0.2, w: 0.3, h: 0.3,
      fontFace: 'Arial', fontSize: 9, color: COLORS.white, bold: true, align: 'center', valign: 'middle'
    });

    // Callout text
    slide.addText(text, {
      x: calloutX + 0.55, y: calloutY + 0.1, w: calloutW - 0.7, h: 0.5,
      fontFace: 'Arial', fontSize: 10, color: COLORS.coal, valign: 'middle'
    });
  });

  // Source footnote
  const source = getText('.chart-source, .exhibit-source');
  if (source) {
    slide.addText(source, {
      x: 0.48, y: 6.7, w: 12.36, h: 0.25,
      fontFace: 'Arial', fontSize: 8, color: COLORS.meta
    });
  }

  addFooter(slide, slideNum, totalSlides);
}

// WATERFALL CHART - Bridge chart showing incremental changes
export function renderWaterfallChart(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title, h1') || slideData.title || 'Waterfall Analysis';
  const subtitle = getText('.subtitle, h2');

  if (title) addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Extract waterfall data from HTML
  const bars = getAllElements('.wf-bar');
  const waterfallData = [];

  bars.forEach(bar => {
    const label = bar.querySelector('.wf-label')?.textContent?.trim() || '';
    const valueText = bar.querySelector('.wf-value')?.textContent?.trim() || '0';
    const numValue = parseFloat(valueText.replace(/[^0-9.-]/g, '')) || 0;

    let type = 'positive';
    if (bar.classList.contains('wf-start') || bar.classList.contains('wf-end')) {
      type = 'total';
    } else if (bar.classList.contains('wf-negative') || valueText.includes('−') || valueText.includes('-')) {
      type = 'negative';
    }

    waterfallData.push({ label, value: Math.abs(numValue), type, originalValue: numValue });
  });

  // Default data if none found
  if (waterfallData.length === 0) {
    waterfallData.push(
      { label: 'Start', value: 100, type: 'total' },
      { label: 'Growth', value: 20, type: 'positive' },
      { label: 'Expansion', value: 15, type: 'positive' },
      { label: 'Costs', value: 10, type: 'negative' },
      { label: 'Other', value: 5, type: 'negative' },
      { label: 'End', value: 120, type: 'total' }
    );
  }

  // Build waterfall as stacked bar chart
  // We need: invisible base + colored bar for each category
  const labels = waterfallData.map(d => d.label);
  const positiveVals = [];
  const negativeVals = [];
  const baseVals = [];

  let runningTotal = 0;
  waterfallData.forEach((d, i) => {
    if (d.type === 'total') {
      if (i === 0) {
        // Start - show full bar from 0
        baseVals.push(0);
        positiveVals.push(d.value);
        negativeVals.push(0);
        runningTotal = d.value;
      } else {
        // End - show full bar from 0
        baseVals.push(0);
        positiveVals.push(runningTotal);
        negativeVals.push(0);
      }
    } else if (d.type === 'positive') {
      baseVals.push(runningTotal);
      positiveVals.push(d.value);
      negativeVals.push(0);
      runningTotal += d.value;
    } else {
      // negative
      runningTotal -= d.value;
      baseVals.push(runningTotal);
      positiveVals.push(0);
      negativeVals.push(d.value);
    }
  });

  // Create stacked bar chart data
  const chartData = [
    { name: 'Base', labels: labels, values: baseVals },
    { name: 'Increase', labels: labels, values: positiveVals },
    { name: 'Decrease', labels: labels, values: negativeVals }
  ];

  // Add the stacked column chart (simulating waterfall)
  slide.addChart('bar', chartData, {
    x: 0.48,
    y: 1.9,
    w: 12.36,
    h: 3.5,
    barDir: 'col', // vertical columns
    barGrouping: 'stacked',
    chartColors: ['FFFFFF', '28A745', 'DC3545'], // invisible, green, red
    showValue: false,
    catAxisTitle: '',
    valAxisTitle: '',
    catAxisLabelFontSize: 10,
    catAxisLabelColor: COLORS.coal,
    valAxisLabelFontSize: 9,
    valAxisLabelColor: COLORS.meta,
    showLegend: false,
    barGapWidthPct: 75,
    // Make the base series invisible
    chartColorsOpacity: 0
  });

  // Add value labels manually on top of bars
  const chartX = 0.48;
  const chartW = 12.36;
  const barCount = waterfallData.length;
  const barWidth = chartW / barCount;

  waterfallData.forEach((d, i) => {
    const x = chartX + (i * barWidth) + (barWidth * 0.1);
    const w = barWidth * 0.8;

    let displayValue = d.type === 'negative' ? `−${d.value}` : (d.type === 'positive' ? `+${d.value}` : d.value.toString());
    let color = d.type === 'total' ? COLORS.maroon : (d.type === 'positive' ? '28A745' : 'DC3545');

    slide.addText(displayValue, {
      x: x, y: 1.7, w: w, h: 0.25,
      fontFace: 'Arial', fontSize: 10, color: color, bold: true, align: 'center'
    });
  });

  // Add summary row
  const summaryY = 5.6;
  const summaryItems = getAllElements('.wf-summary-item');

  if (summaryItems.length > 0) {
    summaryItems.forEach((item, i) => {
      const icon = item.querySelector('.wf-icon')?.textContent?.trim() || '';
      const text = item.textContent?.trim().replace(icon, '').trim() || '';

      let bgColor = COLORS.coal;
      if (item.querySelector('.wf-plus')) bgColor = '28A745';
      else if (item.querySelector('.wf-minus')) bgColor = 'DC3545';
      else if (item.querySelector('.wf-net')) bgColor = COLORS.maroon;

      const itemX = 2 + (i * 4);

      slide.addShape('ellipse', {
        x: itemX, y: summaryY, w: 0.35, h: 0.35,
        fill: { color: bgColor }
      });
      slide.addText(icon, {
        x: itemX, y: summaryY, w: 0.35, h: 0.35,
        fontFace: 'Arial', fontSize: 12, color: COLORS.white, bold: true, align: 'center', valign: 'middle'
      });
      slide.addText(text, {
        x: itemX + 0.45, y: summaryY, w: 3.3, h: 0.4,
        fontFace: 'Arial', fontSize: 10, color: COLORS.coal, valign: 'middle'
      });
    });
  }

  // Source footnote
  const source = getText('.chart-source');
  if (source) {
    slide.addText(source, {
      x: 0.48, y: 6.7, w: 12.36, h: 0.25,
      fontFace: 'Arial', fontSize: 8, color: COLORS.meta
    });
  }

  addFooter(slide, slideNum, totalSlides);
}

// GENERIC CONTENT (fallback renderer with smart detection)
export function renderGenericContent(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements, doc } = parseSlideHTML(slideData.html);

  const title = getText('.title, h1') || slideData.title;
  const subtitle = getText('.subtitle, h2');

  if (title) addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Start content area
  let yPos = subtitle ? 2.0 : 1.5;

  // Detect and render content by type
  const cards = getAllElements('.card');
  const bullets = getAllElements('li, .bullet-item');
  const paragraphs = getAllElements('.content p, .body p, .frame p');

  if (cards.length > 0) {
    // Render as cards
    const cardW = Math.min(4, 12.36 / cards.length - 0.15);
    cards.forEach((card, i) => {
      if (i >= 4) return;
      const x = 0.48 + i * (cardW + 0.15);

      slide.addShape('rect', {
        x, y: yPos, w: cardW, h: 4.2,
        fill: { color: 'FFFFFF' },
        line: { color: COLORS.border, width: 0.5 }
      });

      const cardTitle = card.querySelector('h3, h4, .card-title')?.textContent?.trim();
      const cardBody = card.querySelector('p, .card-body')?.textContent?.trim();

      if (cardTitle) {
        slide.addText(cardTitle.substring(0, 50), {
          x: x + 0.1, y: yPos + 0.2, w: cardW - 0.2, h: 0.5,
          fontFace: 'Arial', fontSize: 12, color: COLORS.main, bold: true
        });
      }

      if (cardBody) {
        slide.addText(cardBody.substring(0, 250), {
          x: x + 0.1, y: yPos + 0.8, w: cardW - 0.2, h: 3.2,
          fontFace: 'Arial', fontSize: 10, color: COLORS.secondary, valign: 'top'
        });
      }
    });
  } else if (bullets.length > 0) {
    // Render as bullets
    bullets.forEach((bullet, i) => {
      if (i >= 8 || yPos > 6.5) return;

      slide.addShape('ellipse', {
        x: 0.48, y: yPos + 0.15, w: 0.12, h: 0.12,
        fill: { color: COLORS.maroon }
      });

      slide.addText(bullet.textContent?.trim()?.substring(0, 200) || '', {
        x: 0.75, y: yPos, w: 11.8, h: 0.5,
        fontFace: 'Arial', fontSize: 13, color: COLORS.main
      });
      yPos += 0.55;
    });
  } else if (paragraphs.length > 0) {
    // Render as paragraphs
    paragraphs.forEach((p, i) => {
      if (i >= 5 || yPos > 6) return;
      const text = p.textContent?.trim();
      if (text && text.length > 5) {
        slide.addText(text.substring(0, 500), {
          x: 0.48, y: yPos, w: 12.36, h: 1.0,
          fontFace: 'Arial', fontSize: 13, color: COLORS.secondary, valign: 'top'
        });
        yPos += 1.1;
      }
    });
  } else {
    // Last resort: get all visible text from frame
    const frame = doc.querySelector('.frame, .content, .body');
    if (frame) {
      slide.addText(frame.textContent?.trim()?.substring(0, 800) || '', {
        x: 0.48, y: yPos, w: 12.36, h: 4.5,
        fontFace: 'Arial', fontSize: 12, color: COLORS.secondary, valign: 'top'
      });
    }
  }

  // Source/footnote
  addSourceNote(slide, slideData.html);

  addFooter(slide, slideNum, totalSlides);
}

// CUSTOMER JOURNEY
export function renderCustomerJourney(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const stages = getAllElements('.journey-stage');
  const stageCount = Math.max(stages.length || 5, 1);
  const startX = 0.48;
  const startY = 1.85;
  const totalW = 12.36;
  const connW = 0.3;
  const stageW = (totalW - connW * (stageCount - 1)) / stageCount;
  const headerH = 0.4;
  const touchH = 2.8;
  const sentH = 0.45;

  stages.forEach((stage, i) => {
    const x = startX + i * (stageW + connW);
    const header = stage.querySelector('.journey-header')?.textContent?.trim() || '';
    const touches = Array.from(stage.querySelectorAll('.journey-touch')).map(t => t.textContent.trim());
    const sentiment = stage.querySelector('.journey-sentiment');
    const sentLabel = stage.querySelector('.sentiment-label')?.textContent?.trim() || '';
    const isPositive = sentiment?.classList?.contains('positive');
    const isNegative = sentiment?.classList?.contains('negative');

    // Header
    slide.addShape('rect', {
      x, y: startY, w: stageW, h: headerH,
      fill: { color: COLORS.maroon }, line: { width: 0 }
    });
    slide.addText(header.toUpperCase(), {
      x, y: startY, w: stageW, h: headerH,
      fontFace: 'Arial', fontSize: 9, color: COLORS.white,
      bold: true, align: 'center', valign: 'middle'
    });

    // Touchpoints area
    slide.addShape('rect', {
      x, y: startY + headerH, w: stageW, h: touchH,
      fill: { color: 'F7F9FB' }, line: { color: COLORS.border, pt: 0.5 }
    });
    touches.forEach((t, j) => {
      const ty = startY + headerH + 0.15 + j * 0.55;
      slide.addShape('rect', {
        x: x + 0.08, y: ty, w: stageW - 0.16, h: 0.4,
        fill: { color: 'FFFFFF' }, line: { color: COLORS.border, pt: 0.5 },
        rectRadius: 0.03
      });
      slide.addText(t, {
        x: x + 0.15, y: ty, w: stageW - 0.3, h: 0.4,
        fontFace: 'Arial', fontSize: 8, color: COLORS.secondary, valign: 'middle'
      });
    });

    // Sentiment bar
    const sentColor = isPositive ? 'EAFAF1' : isNegative ? 'FDEDEC' : 'EEF2F6';
    const sentTextColor = isPositive ? '27AE60' : isNegative ? 'C0392B' : '4A4F57';
    const sentIcon = isPositive ? '▲' : isNegative ? '▼' : '●';
    slide.addShape('rect', {
      x, y: startY + headerH + touchH, w: stageW, h: sentH,
      fill: { color: sentColor }, line: { width: 0 }
    });
    slide.addText(sentIcon + '  ' + sentLabel, {
      x, y: startY + headerH + touchH, w: stageW, h: sentH,
      fontFace: 'Arial', fontSize: 8, color: sentTextColor,
      bold: true, align: 'center', valign: 'middle'
    });

    // Connector arrow
    if (i < stageCount - 1) {
      slide.addText('›', {
        x: x + stageW, y: startY + 1.2, w: connW, h: 0.5,
        fontFace: 'Arial', fontSize: 22, color: COLORS.maroon,
        bold: true, align: 'center', valign: 'middle'
      });
    }
  });

  addFooter(slide, slideNum, totalSlides);
}

// OPTIONS & RECOMMENDATION
export function renderOptionsRecommendation(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements, doc } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const criteriaEls = getAllElements('.criteria-row');
  const optionCols = getAllElements('.option-col');
  const criteria = criteriaEls.map(el => el.textContent.trim());
  const startX = 0.48;
  const startY = 1.85;
  const criteriaW = 2.0;
  const optW = (12.36 - criteriaW) / Math.max(optionCols.length, 1);
  const headerH = 0.5;
  const rowH = (4.2 - headerH) / Math.max(criteria.length, 1);

  // Criteria column header
  slide.addShape('rect', {
    x: startX, y: startY, w: criteriaW, h: headerH,
    fill: { color: 'F7F9FB' }, line: { color: COLORS.border, pt: 0.5 }
  });

  // Criteria rows
  criteria.forEach((c, i) => {
    const y = startY + headerH + i * rowH;
    slide.addText(c, {
      x: startX, y, w: criteriaW, h: rowH,
      fontFace: 'Arial', fontSize: 9, color: COLORS.secondary, bold: true,
      valign: 'middle', border: [null, null, { color: COLORS.border, pt: 0.5 }, null]
    });
  });

  // Option columns
  optionCols.forEach((col, ci) => {
    const x = startX + criteriaW + ci * optW;
    const isRec = col.classList?.contains('recommended');
    const headerText = col.querySelector('.option-header')?.textContent?.trim().replace(/Recommended/i, '').trim() || '';
    const cells = Array.from(col.querySelectorAll('.option-cell')).map(c => c.textContent.trim());

    // Header
    slide.addShape('rect', {
      x, y: startY, w: optW, h: headerH,
      fill: { color: isRec ? COLORS.maroon : 'F7F9FB' },
      line: { color: isRec ? COLORS.maroon : COLORS.border, pt: isRec ? 1.5 : 0.5 }
    });
    const headerParts = [{ text: headerText, options: { bold: true, fontSize: 10, color: isRec ? COLORS.white : COLORS.main } }];
    if (isRec) {
      headerParts.push({ text: '  RECOMMENDED', options: { bold: true, fontSize: 7, color: 'F8E3E3' } });
    }
    slide.addText(headerParts, {
      x, y: startY, w: optW, h: headerH,
      fontFace: 'Arial', align: 'center', valign: 'middle'
    });

    // Cells
    cells.forEach((cell, ri) => {
      const y = startY + headerH + ri * rowH;
      slide.addText(cell, {
        x, y, w: optW, h: rowH,
        fontFace: 'Arial', fontSize: 9, color: COLORS.secondary,
        align: 'center', valign: 'middle',
        fill: isRec ? { color: 'F7F9FB' } : undefined,
        border: [null, { color: isRec ? COLORS.maroon : COLORS.border, pt: isRec ? 1.5 : 0.5 }, { color: COLORS.border, pt: 0.5 }, { color: isRec ? COLORS.maroon : COLORS.border, pt: isRec ? 1.5 : 0.5 }]
      });
    });
  });

  addFooter(slide, slideNum, totalSlides);
}

// DUAL CHARTS WITH COMMENTARY
export function renderDualCharts(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title') || slideData.title;
  const subtitle = getText('.subtitle');

  addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const cols = getAllElements('.dual-chart-col');
  const startX = 0.48;
  const startY = 1.85;
  const colW = 6.0;
  const gap = 0.36;
  const chartH = 3.0;
  const commentH = 0.8;

  cols.forEach((col, ci) => {
    const x = startX + ci * (colW + gap);
    const chartTitle = col.querySelector('.graph-title')?.textContent?.trim() || '';
    const comment = col.querySelector('.chart-comment');
    const commentStrong = comment?.querySelector('strong')?.textContent?.trim() || '';
    const commentP = comment?.querySelector('p')?.textContent?.trim() || '';

    // Chart title
    slide.addText(chartTitle, {
      x, y: startY, w: colW, h: 0.35,
      fontFace: 'Arial', fontSize: 10, color: COLORS.main, bold: true
    });

    // Chart placeholder box
    slide.addShape('rect', {
      x, y: startY + 0.4, w: colW, h: chartH - 0.4,
      fill: { color: 'F7F9FB' },
      line: { color: COLORS.border, pt: 0.5 },
      rectRadius: 0.03
    });
    slide.addText('[Chart]', {
      x, y: startY + 0.4, w: colW, h: chartH - 0.4,
      fontFace: 'Arial', fontSize: 14, color: COLORS.meta,
      align: 'center', valign: 'middle'
    });

    // Comment box with left accent
    const commentY = startY + chartH + 0.15;
    slide.addShape('rect', {
      x, y: commentY, w: 0.04, h: commentH,
      fill: { color: COLORS.maroon }, line: { width: 0 }
    });
    slide.addShape('rect', {
      x: x + 0.04, y: commentY, w: colW - 0.04, h: commentH,
      fill: { color: 'F7F9FB' }, line: { width: 0 }
    });

    const commentParts = [];
    if (commentStrong) commentParts.push({ text: commentStrong, options: { bold: true, fontSize: 10, color: COLORS.main } });
    if (commentP) commentParts.push({ text: (commentStrong ? '\n' : '') + commentP, options: { fontSize: 9, color: COLORS.secondary } });
    if (commentParts.length) {
      slide.addText(commentParts, {
        x: x + 0.2, y: commentY, w: colW - 0.35, h: commentH,
        fontFace: 'Arial', valign: 'middle', lineSpacing: 13
      });
    }
  });

  addFooter(slide, slideNum, totalSlides);
}

// MULTI-LINE CHART - Multiple series line chart
export function renderMultiLineChart(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title, h1') || slideData.title || 'Multi-Line Chart';
  const subtitle = getText('.subtitle, h2');

  if (title) addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  // Extract series data from HTML
  const seriesElements = getAllElements('.ml-line');
  const xLabels = getAllElements('.ml-x-axis span').map(el => el.textContent?.trim() || '');
  const legendItems = getAllElements('.ml-legend-item');

  const seriesColors = [COLORS.maroon, COLORS.success, '6366F1'];
  const chartData = [];

  seriesElements.forEach((seriesEl, si) => {
    const points = Array.from(seriesEl.querySelectorAll('.ml-point'));
    const seriesName = legendItems[si]?.textContent?.trim() || `Series ${si + 1}`;
    const values = points.map(p => {
      const label = p.querySelector('.ml-point-label')?.textContent?.trim() || '';
      return parseFloat(label.replace(/[^0-9.-]/g, '')) || 0;
    });
    chartData.push({
      name: seriesName,
      labels: xLabels.length >= values.length ? xLabels.slice(0, values.length) : xLabels,
      values: values.length >= 3 ? values : [20, 35, 50, 65, 80],
    });
  });

  // Fallback if no series found
  if (chartData.length === 0) {
    const defaultLabels = xLabels.length >= 3 ? xLabels : ['2020', '2021', '2022', '2023', '2024'];
    chartData.push(
      { name: 'Series A', labels: defaultLabels, values: [20, 35, 50, 65, 80] },
      { name: 'Series B', labels: defaultLabels, values: [40, 45, 55, 50, 60] },
      { name: 'Series C', labels: defaultLabels, values: [60, 55, 45, 40, 35] }
    );
  }

  slide.addChart('line', chartData, {
    x: 0.48, y: 1.9, w: 12.36, h: 4.2,
    chartColors: seriesColors.slice(0, chartData.length),
    lineSize: 2.5,
    lineSmooth: false,
    showValue: true,
    dataLabelPosition: 't',
    dataLabelFontSize: 8,
    dataLabelColor: COLORS.coal,
    catAxisLabelFontSize: 10,
    catAxisLabelColor: COLORS.coal,
    valAxisLabelFontSize: 9,
    valAxisLabelColor: COLORS.meta,
    showLegend: true,
    legendPos: 't',
    legendFontSize: 9,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 7,
  });

  const source = getText('.footer span:first-child');
  if (source) {
    slide.addText(source, {
      x: 0.48, y: 6.7, w: 12.36, h: 0.25,
      fontFace: 'Arial', fontSize: 8, color: COLORS.meta
    });
  }
  addFooter(slide, slideNum, totalSlides);
}

// GROUPED COLUMN CHART - Vertical clustered bars
export function renderGroupedColumnChart(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title, h1') || slideData.title || 'Grouped Column Chart';
  const subtitle = getText('.subtitle, h2');

  if (title) addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const groups = getAllElements('.gc-group');
  const legendItems = getAllElements('.gc-legend-item');
  const seriesColors = [COLORS.maroon, COLORS.success, '6366F1'];

  // Determine number of series from first group
  const firstGroupBars = groups.length > 0
    ? Array.from(groups[0].querySelectorAll('.gc-bar'))
    : [];
  const numSeries = firstGroupBars.length || 3;

  // Build chart data: one entry per series
  const chartData = [];
  for (let s = 0; s < numSeries; s++) {
    const seriesName = legendItems[s]?.textContent?.trim() || `Group ${s + 1}`;
    const labels = [];
    const values = [];
    groups.forEach(group => {
      const label = group.querySelector('.gc-group-label')?.textContent?.trim()
        || group.getAttribute('data-label') || '';
      labels.push(label);
      const bars = Array.from(group.querySelectorAll('.gc-bar'));
      const bar = bars[s];
      const valText = bar?.querySelector('.gc-bar-value')?.textContent?.trim() || '0';
      values.push(parseFloat(valText.replace(/[^0-9.-]/g, '')) || 0);
    });
    chartData.push({ name: seriesName, labels, values });
  }

  if (chartData.length === 0) {
    const defaultLabels = ['Cat 1', 'Cat 2', 'Cat 3', 'Cat 4'];
    chartData.push(
      { name: 'Group A', labels: defaultLabels, values: [65, 80, 50, 70] },
      { name: 'Group B', labels: defaultLabels, values: [45, 60, 75, 55] },
      { name: 'Group C', labels: defaultLabels, values: [55, 70, 40, 85] }
    );
  }

  slide.addChart('bar', chartData, {
    x: 0.48, y: 1.9, w: 12.36, h: 4.2,
    barDir: 'col',
    barGrouping: 'clustered',
    chartColors: seriesColors.slice(0, chartData.length),
    showValue: true,
    dataLabelPosition: 'outEnd',
    dataLabelFontSize: 8,
    dataLabelColor: COLORS.coal,
    catAxisLabelFontSize: 10,
    catAxisLabelColor: COLORS.coal,
    valAxisLabelFontSize: 9,
    valAxisLabelColor: COLORS.meta,
    showLegend: true,
    legendPos: 't',
    legendFontSize: 9,
  });

  const source = getText('.footer span:first-child');
  if (source) {
    slide.addText(source, {
      x: 0.48, y: 6.7, w: 12.36, h: 0.25,
      fontFace: 'Arial', fontSize: 8, color: COLORS.meta
    });
  }
  addFooter(slide, slideNum, totalSlides);
}

// STACKED BAR CHART - Horizontal stacked bars
export function renderStackedBarChart(pptx, slideData, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const { getText, getAllElements } = parseSlideHTML(slideData.html);

  const title = getText('.title, h1') || slideData.title || 'Stacked Bar Chart';
  const subtitle = getText('.subtitle, h2');

  if (title) addTitle(slide, title);
  if (subtitle) addSubtitle(slide, subtitle);

  const rows = getAllElements('.sb-row');
  const legendItems = getAllElements('.sb-legend-item');
  const seriesColors = [COLORS.maroon, COLORS.success, '6366F1', 'F59E0B'];

  // Determine number of segments from first row
  const firstRowSegments = rows.length > 0
    ? Array.from(rows[0].querySelectorAll('.sb-segment'))
    : [];
  const numSegments = firstRowSegments.length || 4;

  // Build chart data: one entry per segment
  const chartData = [];
  for (let s = 0; s < numSegments; s++) {
    const segName = legendItems[s]?.textContent?.trim() || `Segment ${s + 1}`;
    const labels = [];
    const values = [];
    rows.forEach(row => {
      const label = row.querySelector('.sb-label')?.textContent?.trim() || '';
      labels.push(label);
      const segments = Array.from(row.querySelectorAll('.sb-segment'));
      const seg = segments[s];
      const valText = seg?.textContent?.trim() || '0';
      values.push(parseFloat(valText.replace(/[^0-9.-]/g, '')) || 0);
    });
    chartData.push({ name: segName, labels, values });
  }

  if (chartData.length === 0) {
    const defaultLabels = ['Cat 1', 'Cat 2', 'Cat 3', 'Cat 4', 'Cat 5'];
    chartData.push(
      { name: 'Segment A', labels: defaultLabels, values: [35, 20, 45, 25, 15] },
      { name: 'Segment B', labels: defaultLabels, values: [25, 30, 20, 25, 35] },
      { name: 'Segment C', labels: defaultLabels, values: [20, 30, 15, 25, 30] },
      { name: 'Segment D', labels: defaultLabels, values: [20, 20, 20, 25, 20] }
    );
  }

  slide.addChart('bar', chartData, {
    x: 0.48, y: 1.9, w: 12.36, h: 4.2,
    barDir: 'bar',
    barGrouping: 'stacked',
    chartColors: seriesColors.slice(0, chartData.length),
    showValue: true,
    dataLabelPosition: 'ctr',
    dataLabelFontSize: 8,
    dataLabelColor: COLORS.white,
    catAxisLabelFontSize: 10,
    catAxisLabelColor: COLORS.coal,
    valAxisLabelFontSize: 9,
    valAxisLabelColor: COLORS.meta,
    valAxisMaxVal: 100,
    showLegend: true,
    legendPos: 't',
    legendFontSize: 9,
  });

  const source = getText('.footer span:first-child');
  if (source) {
    slide.addText(source, {
      x: 0.48, y: 6.7, w: 12.36, h: 0.25,
      fontFace: 'Arial', fontSize: 8, color: COLORS.meta
    });
  }
  addFooter(slide, slideNum, totalSlides);
}

// ============================================================================
// RENDERER MAP - Maps template types to render functions
// ============================================================================
export const TEMPLATE_RENDERERS = {
  cover: renderCover,
  closing: renderThankYou,
  thankYou: renderThankYou,
  blank: renderBlank,
  'three-cards': renderThreeCards,
  threeCards: renderThreeCards,
  kpi: renderKpiMetrics,
  kpiMetrics: renderKpiMetrics,
  timeline: renderTimeline,
  quote: renderQuote,
  bullets: renderBulletPoints,
  bulletPoints: renderBulletPoints,
  grid: renderGrid2x2,
  grid2x2: renderGrid2x2,
  table: renderComparisonTable,
  comparisonTable: renderComparisonTable,
  flow: renderProcessFlow,
  processFlow: renderProcessFlow,
  chevron: renderChevronFlow,
  chevronFlow: renderChevronFlow,
  'outcome-approach': renderOutcomeApproach,
  outcomeApproach: renderOutcomeApproach,
  'step-detail': renderProjectStepDetail,
  stepDetail: renderProjectStepDetail,
  projectStepDetail: renderProjectStepDetail,
  recommendations: renderRecommendationSummary,
  recommendationSummary: renderRecommendationSummary,
  comparison: renderCurrentFutureState,
  currentFutureState: renderCurrentFutureState,
  'current-future': renderCurrentFutureState,
  stat: renderStatHighlight,
  statHighlight: renderStatHighlight,
  emptyPage: renderEmptyPage,
  // Empty master slide types (dynamic from slideMasters)
  'empty-standard': renderGenericContent,
  'empty-blank': renderBlank,
  'empty-titleOnly': renderGenericContent,
  'empty-cover': renderCover,
  'empty-emptyPage': renderEmptyPage,
  empty: renderGenericContent,
  // New template types
  'numbered-list': renderNumberedList,
  numberedList: renderNumberedList,
  list: renderNumberedList,
  'horizontal-bars': renderHorizontalBars,
  horizontalBars: renderHorizontalBars,
  bars: renderHorizontalBars,
  progress: renderHorizontalBars,
  'executive-summary': renderSplitContent,
  executiveSummary: renderSplitContent,
  split: renderSplitContent,
  splitContent: renderSplitContent,
  summary: renderSplitContent,
  // Key Finding template
  keyFinding: renderKeyFinding,
  'key-finding': renderKeyFinding,
  finding: renderKeyFinding,
  insight: renderKeyFinding,
  // Strategy Quadrant template
  strategyQuadrant: renderStrategyQuadrant,
  'strategy-quadrant': renderStrategyQuadrant,
  quadrant: renderStrategyQuadrant,
  // MBB Consulting Templates
  exhibit: renderGenericContent,
  'insight-action': renderGenericContent,
  insightToAction: renderGenericContent,
  tree: renderGenericContent,
  issueTree: renderGenericContent,
  'issue-tree': renderGenericContent,
  gantt: renderGenericContent,
  workplan: renderGenericContent,
  matrix: renderGenericContent,
  priorityMatrix: renderGenericContent,
  'priority-matrix': renderGenericContent,
  nineBoxMatrix: renderGenericContent,
  'nine-box': renderGenericContent,
  scorecard: renderGenericContent,
  heatmap: renderGenericContent,
  // Chart-based templates (use actual PowerPoint charts)
  chart: renderBarChart,
  barChartExhibit: renderBarChart,
  'bar-chart': renderBarChart,
  waterfallChart: renderWaterfallChart,
  waterfall: renderWaterfallChart,
  bridge: renderWaterfallChart,
  // Multi-series charts
  multiLineChart: renderMultiLineChart,
  'multi-line': renderMultiLineChart,
  'multi-line-chart': renderMultiLineChart,
  groupedColumnChart: renderGroupedColumnChart,
  'grouped-column': renderGroupedColumnChart,
  'grouped-bar': renderGroupedColumnChart,
  stackedBarChart: renderStackedBarChart,
  'stacked-bar': renderStackedBarChart,
  'stacked-bar-chart': renderStackedBarChart,
  // Customer Journey
  journey: renderCustomerJourney,
  customerJourney: renderCustomerJourney,
  'customer-journey': renderCustomerJourney,
  // Options & Recommendation
  'options-rec': renderOptionsRecommendation,
  optionsRecommendation: renderOptionsRecommendation,
  'options-recommendation': renderOptionsRecommendation,
  // Dual Charts
  'dual-chart': renderDualCharts,
  dualCharts: renderDualCharts,
  'dual-charts': renderDualCharts,
  // Image slides (AI-generated visuals)
  'image-full': renderImageFull,
  'image-content': renderImageContent,
  // Generic fallback
  content: renderGenericContent,
  generic: renderGenericContent,
  custom: renderGenericContent,
};

// Get the appropriate renderer for a slide
export function getRendererForSlide(slide) {
  // Check by type first
  if (slide.type && TEMPLATE_RENDERERS[slide.type]) {
    return TEMPLATE_RENDERERS[slide.type];
  }

  // Check by template ID
  if (slide.templateId && TEMPLATE_RENDERERS[slide.templateId]) {
    return TEMPLATE_RENDERERS[slide.templateId];
  }

  // Try to detect from HTML structure
  const html = slide.html || '';

  // Image slides — detect from class names or embedded base64 images
  if (html.includes('slide-image-full') || html.includes('slide-image-cover')) {
    return renderImageFull;
  }
  if (html.includes('frame-image') && html.includes('data:image')) {
    return renderImageContent;
  }

  // Thank You / Closing slides (check before cover since they also have 'cover-slide')
  if (html.includes('thank-you-slide') || html.includes('thank-you-title')) {
    return renderThankYou;
  }

  // Cover slides
  if (html.includes('cover-slide') || html.includes('cover-title')) {
    return renderCover;
  }

  // Card-based layouts
  if (html.includes('card-row') || html.includes('three-cards') || html.includes('class="card"')) {
    return renderThreeCards;
  }

  // KPI/metrics
  if (html.includes('kpi-block') || html.includes('kpi-value')) {
    return renderKpiMetrics;
  }

  // Timeline
  if (html.includes('timeline-row') || html.includes('timeline-marker')) {
    return renderTimeline;
  }

  // Quote
  if (html.includes('quote-box') || html.includes('quote-text')) {
    return renderQuote;
  }

  // Numbered list (check before bullets)
  if (html.includes('numbered-list') || html.includes('list-item') || html.includes('<ol')) {
    return renderNumberedList;
  }

  // Horizontal bars
  if (html.includes('horizontal-bar') || html.includes('bar-item') || html.includes('progress-bar')) {
    return renderHorizontalBars;
  }

  // Strategic Insight
  if (html.includes('strategic-insight') || html.includes('insight-hero') || html.includes('evidence-pillar') || html.includes('insight-impact-strip')) {
    return renderStrategicInsight;
  }

  // Split content / executive summary
  if (html.includes('split-content') || html.includes('left-panel') || html.includes('key-message') || html.includes('summary-box')) {
    return renderSplitContent;
  }

  // Bullet points
  if (html.includes('content-list') || (html.includes('<ul') && html.includes('<li'))) {
    return renderBulletPoints;
  }

  // Grid layouts
  if (html.includes('grid-2x2') || html.includes('grid-cell')) {
    return renderGrid2x2;
  }

  // Tables
  if (html.includes('comparison-table') || html.includes('<table')) {
    return renderComparisonTable;
  }

  // Outcome approach (horizontal steps with sub-outcomes)
  if (html.includes('outcome-approach') || html.includes('outcome-row') || html.includes('outcome-main')) {
    return renderOutcomeApproach;
  }

  // Project step detail (activities & outcomes)
  if (html.includes('step-detail') || html.includes('step-activities') || html.includes('step-outcomes')) {
    return renderProjectStepDetail;
  }

  // Recommendation summary
  if (html.includes('recommendations-grid') || html.includes('recommendation-card') || html.includes('rec-num')) {
    return renderRecommendationSummary;
  }

  // Current vs Future state comparison
  if (html.includes('state-comparison') || html.includes('current-state') || html.includes('future-state') || html.includes('current-state-col') || html.includes('future-state-col') || html.includes('current-header') || html.includes('future-header')) {
    return renderCurrentFutureState;
  }

  // Chevron flow (check before process-flow)
  if (html.includes('chevron-flow') || html.includes('chevron-item') || html.includes('chevron-shape')) {
    return renderChevronFlow;
  }

  // Process flow
  if (html.includes('process-flow') || html.includes('process-step')) {
    return renderProcessFlow;
  }

  // Stats
  if (html.includes('stat-highlight') || html.includes('stat-number')) {
    return renderStatHighlight;
  }

  // Empty/blank pages
  if (html.includes('master-emptyPage')) {
    return renderEmptyPage;
  }
  if (html.includes('blank-slide') || html.includes('blank-content')) {
    return renderBlank;
  }

  // MBB Consulting Templates
  // Action-Title + Exhibit
  if (html.includes('action-exhibit') || html.includes('exhibit-placeholder') || html.includes('exhibit-callouts')) {
    return renderGenericContent;
  }

  // Insights to Recommendations
  if (html.includes('insight-action-layout') || html.includes('ia-columns') || html.includes('ia-insights')) {
    return renderGenericContent;
  }

  // Issue Tree / Hypothesis Tree
  if (html.includes('issue-tree') || html.includes('tree-root') || html.includes('tree-branches')) {
    return renderGenericContent;
  }

  // Workplan / Gantt
  if (html.includes('workplan-gantt') || html.includes('gantt-header') || html.includes('gantt-bar-container')) {
    return renderGenericContent;
  }

  // Priority Matrix (2x2)
  if (html.includes('priority-matrix') || html.includes('matrix-quadrant')) {
    return renderGenericContent;
  }

  // Nine-Box Matrix
  if (html.includes('nine-box-matrix') || html.includes('nb-grid') || html.includes('nb-cells')) {
    return renderGenericContent;
  }

  // Scorecard / Heatmap
  if (html.includes('scorecard-table') || html.includes('rag rag-') || html.includes('harvey harvey-')) {
    return renderGenericContent;
  }

  // Bar Chart Exhibit (uses actual PowerPoint chart)
  if (html.includes('bar-chart-exhibit') || html.includes('bar-track') || html.includes('bar-fill')) {
    return renderBarChart;
  }

  // Multi-Line Chart
  if (html.includes('ml-chart-exhibit') || html.includes('ml-line') || html.includes('ml-point')) {
    return renderMultiLineChart;
  }

  // Grouped Column Chart
  if (html.includes('gc-chart-exhibit') || html.includes('gc-group') || html.includes('gc-bar')) {
    return renderGroupedColumnChart;
  }

  // Stacked Bar Chart
  if (html.includes('sb-chart-exhibit') || html.includes('sb-segment') || html.includes('sb-track')) {
    return renderStackedBarChart;
  }

  // Waterfall Chart (uses actual PowerPoint chart)
  if (html.includes('waterfall-exhibit') || html.includes('waterfall-chart') || html.includes('wf-bar')) {
    return renderWaterfallChart;
  }

  // Customer Journey
  if (html.includes('journey-map') || html.includes('journey-stage') || html.includes('journey-touchpoints')) {
    return renderCustomerJourney;
  }

  // Options & Recommendation
  if (html.includes('options-rec') || html.includes('option-col') || html.includes('rec-badge')) {
    return renderOptionsRecommendation;
  }

  // Dual Charts
  if (html.includes('dual-charts') || html.includes('dual-chart-col') || html.includes('chart-comment')) {
    return renderDualCharts;
  }

  // If there's any content, use generic renderer as fallback
  if (html && html.trim().length > 50) {
    return renderGenericContent;
  }

  return null; // Truly empty - no renderer needed
}

// Check if a slide has a pre-built renderer
export function hasPrebuiltRenderer(slide) {
  return getRendererForSlide(slide) !== null || slide.pptxRendererCode;
}

// Helper to parse HTML and extract content (for use in stored renderer code)
function parseHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const getText = (selector) => {
    const el = doc.querySelector(selector);
    return el ? el.textContent.trim() : '';
  };

  const getAll = (selector) => {
    return Array.from(doc.querySelectorAll(selector)).map(el => el.textContent.trim());
  };

  const getAllElements = (selector) => {
    return Array.from(doc.querySelectorAll(selector));
  };

  return { doc, getText, getAll, getAllElements };
}

// Helper object for stored renderer code
const rendererHelpers = {
  addFooter,
  addTitle,
  addSubtitle,
  addSourceNote,
  COLORS,
  LAYOUT,
  parseHTML,
};

// Create a renderer function from stored code string
// Supports two formats:
// 1. New format: "function render(pptx, slideData, slideNum, totalSlides, helpers) { ... }"
// 2. Legacy format: inline code that uses helpers from scope
export function createRendererFromCode(codeString) {
  try {
    // Check if the code is a function definition (new format)
    if (codeString.trim().startsWith('function render(') || codeString.trim().startsWith('function(')) {
      // New format: code is a complete function definition
      // Extract the function body and create a callable function
      const createRenderer = new Function('helpers', `
        const { addFooter, addTitle, addSubtitle, addSourceNote, COLORS, LAYOUT, parseHTML } = helpers;
        const rendererFn = ${codeString};
        return function(pptx, slideData, slideNum, totalSlides) {
          return rendererFn(pptx, slideData, slideNum, totalSlides, helpers);
        };
      `);
      return createRenderer(rendererHelpers);
    } else {
      // Legacy format: inline code
      const wrappedCode = `
        return function(pptx, slideData, slideNum, totalSlides) {
          const { addFooter, addTitle, addSubtitle, addSourceNote, COLORS, LAYOUT, parseHTML } = helpers;
          ${codeString}
        };
      `;
      return new Function('helpers', wrappedCode)(rendererHelpers);
    }
  } catch (error) {
    console.error('Error creating renderer from code:', error);
    return null;
  }
}

// Render a slide with custom stored code
export function renderWithStoredCode(pptx, slideData, slideNum, totalSlides) {
  if (!slideData.pptxRendererCode) return false;

  try {
    const renderer = createRendererFromCode(slideData.pptxRendererCode);
    if (renderer) {
      renderer(pptx, slideData, slideNum, totalSlides);
      return true;
    }
  } catch (error) {
    console.warn('Error rendering with stored code:', error);
  }
  return false;
}

// Export helpers for external use
export { rendererHelpers, parseHTML };
