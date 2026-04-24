/**
 * Document Parser Service
 * Parses various document formats (PPTX, Excel, PDF, Word, Images) on the client side.
 * No data is sent to the server - all parsing happens in the browser.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { authFetch } from './authFetch.js';

// Configure PDF.js worker using bundled asset (CDN does not host v5.x worker files)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Parse a file and extract its content
 * @param {File} file - The file to parse
 * @param {Object} options - Parsing options
 * @param {Object} options.settings - App settings containing AI provider config for image analysis
 * @returns {Promise<{content: string, metadata: Object, type: string}>}
 */
export async function parseDocument(file, options = {}) {
  const ext = file.name.split('.').pop().toLowerCase();
  const type = getDocumentType(ext);

  try {
    switch (type) {
      case 'pdf':
        return await parsePDF(file);
      case 'word':
        return await parseWord(file);
      case 'excel':
        return await parseExcel(file);
      case 'pptx':
        return await parsePPTX(file);
      case 'image':
        return await parseImage(file, options.settings);
      case 'text':
        return await parseText(file);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    console.error(`[DocumentParser] Error parsing ${file.name}:`, error);
    throw error;
  }
}

/**
 * Parse multiple files concurrently
 * @param {File[]} files - Array of files to parse (max 10)
 * @param {Object} options - Parsing options
 * @returns {Promise<Array<{file: File, result: Object, error?: Error}>>}
 */
export async function parseMultipleDocuments(files, options = {}) {
  if (files.length > 10) {
    throw new Error('Maximum 10 files can be uploaded at once');
  }

  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const result = await parseDocument(file, options);
        return { file, result, success: true };
      } catch (error) {
        return { file, error, success: false };
      }
    })
  );

  return results;
}

/**
 * Determine document type from extension
 */
function getDocumentType(ext) {
  const types = {
    pdf: 'pdf',
    doc: 'word',
    docx: 'word',
    xls: 'excel',
    xlsx: 'excel',
    csv: 'excel',
    ppt: 'pptx',
    pptx: 'pptx',
    txt: 'text',
    md: 'text',
    rtf: 'text',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    webp: 'image',
    bmp: 'image',
    svg: 'image',
  };
  return types[ext] || 'unknown';
}

/**
 * Parse PDF files using pdf.js
 */
async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const metadata = {
    pageCount: pdf.numPages,
    fileName: file.name,
    fileSize: file.size,
  };

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ pageNumber: i, content: pageText });
  }

  return {
    type: 'pdf',
    content: pages.map(p => `[Page ${p.pageNumber}]\n${p.content}`).join('\n\n'),
    pages,
    metadata,
  };
}

/**
 * Parse Word documents using mammoth
 */
async function parseWord(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  return {
    type: 'word',
    content: result.value,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      messages: result.messages,
    },
  };
}

/**
 * Parse Excel files using SheetJS
 */
async function parseExcel(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheets = {};
  const allContent = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    sheets[sheetName] = json;

    // Convert to readable text format
    const sheetText = json
      .map(row => row.join(' | '))
      .filter(row => row.trim())
      .join('\n');

    if (sheetText) {
      allContent.push(`[Sheet: ${sheetName}]\n${sheetText}`);
    }
  }

  return {
    type: 'excel',
    content: allContent.join('\n\n'),
    sheets,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
    },
  };
}

/**
 * Parse PowerPoint files comprehensively - extracts all content structure
 * Output is formatted for AI comprehension with document header and page-by-page content
 */
async function parsePPTX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Extract presentation metadata
  const metadata = await extractPPTXMetadata(zip, file);

  // Extract slides with full structure (in reading order: left-right, top-down per slide)
  const slides = await extractPPTXSlides(zip);

  // Extract speaker notes
  const notes = await extractPPTXNotes(zip);

  // Extract slide masters and layouts for context
  const masters = await extractPPTXMasters(zip);

  // Update metadata with actual slide count
  metadata.slideCount = slides.length;

  // Build comprehensive content summary - structured for AI comprehension
  const contentParts = [];

  // Document header - always include for context
  const docDate = metadata.modified || metadata.created || new Date().toISOString().split('T')[0];
  contentParts.push(`=== DOCUMENT SUMMARY ===
Document Name: ${metadata.fileName}
Title: ${metadata.title || 'Untitled Presentation'}
Subject: ${metadata.subject || 'N/A'}
Author: ${metadata.creator || 'Unknown'}
Company: ${metadata.company || 'N/A'}
Date: ${docDate}
Total Pages: ${slides.length}
Format: PowerPoint Presentation (.pptx)

This document contains ${slides.length} slides/pages. Content is extracted in reading order (left to right, top to bottom) for each page.
===========================`);

  // Add each slide/page with clear structure
  for (const slide of slides) {
    let slideContent = `\n=== PAGE ${slide.slideNumber} of ${slides.length} ===`;

    // Title is the primary heading
    if (slide.title) {
      slideContent += `\nPage Title: ${slide.title}`;
    }

    if (slide.subtitle) {
      slideContent += `\nSubtitle: ${slide.subtitle}`;
    }

    // Main content section (in reading order)
    const hasContent = (slide.bodyText?.length > 0) ||
                       (slide.bulletPoints?.length > 0) ||
                       (slide.tables?.length > 0) ||
                       (slide.shapes?.length > 0);

    if (hasContent) {
      slideContent += `\n\n--- Page Content (reading order: left→right, top→down) ---`;
    }

    // Body text first (typically main content area)
    if (slide.bodyText && slide.bodyText.length > 0) {
      slideContent += `\n\nMain Text:\n${slide.bodyText.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`;
    }

    // Bullet points (common in presentations)
    if (slide.bulletPoints && slide.bulletPoints.length > 0) {
      slideContent += `\n\nKey Points:\n${slide.bulletPoints.map(bp => `  • ${bp}`).join('\n')}`;
    }

    // Tables with structure
    if (slide.tables && slide.tables.length > 0) {
      for (let ti = 0; ti < slide.tables.length; ti++) {
        const table = slide.tables[ti];
        slideContent += `\n\nTable ${ti + 1}:`;
        table.rows.forEach((row, ri) => {
          if (ri === 0) {
            slideContent += `\n  Header: ${row.join(' | ')}`;
          } else {
            slideContent += `\n  Row ${ri}: ${row.join(' | ')}`;
          }
        });
      }
    }

    // Shape text (callouts, text boxes, etc.)
    if (slide.shapes && slide.shapes.length > 0) {
      const shapeTexts = slide.shapes.filter(s => s.text);
      if (shapeTexts.length > 0) {
        slideContent += `\n\nAdditional Elements:`;
        shapeTexts.forEach((s, i) => {
          slideContent += `\n  [${s.name || 'Text Box ' + (i + 1)}]: ${s.text}`;
        });
      }
    }

    // Charts (note their presence)
    if (slide.charts && slide.charts.length > 0) {
      slideContent += `\n\nVisual Elements: ${slide.charts.length} chart(s) - ${slide.charts.map(c => c.title || 'Data Chart').join(', ')}`;
    }

    // Images (note their presence)
    if (slide.images && slide.images.length > 0) {
      slideContent += `\n[Contains ${slide.images.length} image(s)]`;
    }

    // Speaker notes - important context
    const slideNotes = notes.find(n => n.slideNumber === slide.slideNumber);
    if (slideNotes && slideNotes.content) {
      slideContent += `\n\n--- Speaker Notes ---\n${slideNotes.content}`;
    }

    slideContent += `\n=== END PAGE ${slide.slideNumber} ===`;
    contentParts.push(slideContent);
  }

  // Add summary footer
  contentParts.push(`\n=== END OF DOCUMENT: ${metadata.fileName} (${slides.length} pages) ===`);

  return {
    type: 'pptx',
    content: contentParts.join('\n'),
    slides,
    notes,
    masters,
    metadata,
  };
}

/**
 * Extract metadata from PPTX core.xml and app.xml
 */
async function extractPPTXMetadata(zip, file) {
  const metadata = {
    fileName: file.name,
    fileSize: file.size,
    slideCount: 0,
    title: '',
    subject: '',
    creator: '',
    description: '',
    keywords: '',
    lastModifiedBy: '',
    created: '',
    modified: '',
    company: '',
    presentationFormat: '',
  };

  try {
    // Core properties (title, author, etc.)
    const coreFile = zip.file('docProps/core.xml');
    if (coreFile) {
      const coreXml = await coreFile.async('text');

      metadata.title = extractXmlValue(coreXml, 'dc:title') || extractXmlValue(coreXml, 'title');
      metadata.subject = extractXmlValue(coreXml, 'dc:subject') || extractXmlValue(coreXml, 'subject');
      metadata.creator = extractXmlValue(coreXml, 'dc:creator') || extractXmlValue(coreXml, 'creator');
      metadata.description = extractXmlValue(coreXml, 'dc:description');
      metadata.keywords = extractXmlValue(coreXml, 'cp:keywords');
      metadata.lastModifiedBy = extractXmlValue(coreXml, 'cp:lastModifiedBy');
      metadata.created = extractXmlValue(coreXml, 'dcterms:created');
      metadata.modified = extractXmlValue(coreXml, 'dcterms:modified');
    }

    // App properties (company, slide count, etc.)
    const appFile = zip.file('docProps/app.xml');
    if (appFile) {
      const appXml = await appFile.async('text');

      metadata.company = extractXmlValue(appXml, 'Company');
      metadata.presentationFormat = extractXmlValue(appXml, 'PresentationFormat');
      const slides = extractXmlValue(appXml, 'Slides');
      if (slides) metadata.slideCount = parseInt(slides, 10);
    }
  } catch (error) {
    console.warn('[PPTX Parser] Error extracting metadata:', error);
  }

  return metadata;
}

/**
 * Extract all slides with comprehensive content parsing
 */
async function extractPPTXSlides(zip) {
  const slides = [];
  const slidePattern = /^ppt\/slides\/slide(\d+)\.xml$/;

  // Get all slide files and sort by number
  const slideFiles = Object.keys(zip.files)
    .filter(name => slidePattern.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(slidePattern)[1]);
      const numB = parseInt(b.match(slidePattern)[1]);
      return numA - numB;
    });

  for (const slidePath of slideFiles) {
    const slideNumber = parseInt(slidePath.match(slidePattern)[1]);
    const xml = await zip.file(slidePath).async('text');
    const slideData = parseSlideXml(xml, slideNumber);
    slides.push(slideData);
  }

  return slides;
}

/**
 * Parse individual slide XML with full structure extraction
 */
function parseSlideXml(xml, slideNumber) {
  const slide = {
    slideNumber,
    title: '',
    subtitle: '',
    bodyText: [],
    bulletPoints: [],
    shapes: [],
    tables: [],
    charts: [],
    images: [],
    allText: '',
  };

  // Extract title (from title placeholder or first large text)
  slide.title = extractPlaceholderText(xml, 'title') ||
                extractPlaceholderText(xml, 'ctrTitle') ||
                '';

  // Extract subtitle
  slide.subtitle = extractPlaceholderText(xml, 'subTitle') || '';

  // Extract body text (from body placeholder)
  const bodyText = extractPlaceholderText(xml, 'body');
  if (bodyText) {
    slide.bodyText = bodyText.split('\n').filter(t => t.trim());
  }

  // Extract all paragraphs with bullet detection
  slide.bulletPoints = extractBulletPoints(xml);

  // Extract tables
  slide.tables = extractTables(xml);

  // Extract shapes with text
  slide.shapes = extractShapes(xml);

  // Detect charts (just presence, chart data is in separate files)
  slide.charts = detectCharts(xml);

  // Detect images
  slide.images = detectImages(xml);

  // Build complete text for search/RAG
  const allTextParts = [
    slide.title,
    slide.subtitle,
    ...slide.bodyText,
    ...slide.bulletPoints,
    ...slide.shapes.map(s => s.text).filter(Boolean),
    ...slide.tables.flatMap(t => t.rows.flatMap(r => r)),
  ].filter(Boolean);

  slide.allText = allTextParts.join(' ').replace(/\s+/g, ' ').trim();

  return slide;
}

/**
 * Extract text from a specific placeholder type
 */
function extractPlaceholderText(xml, placeholderType) {
  // Look for placeholder with specific type
  const phPattern = new RegExp(
    `<p:ph[^>]*type="${placeholderType}"[^>]*>.*?</p:sp>|<p:ph[^>]*type="${placeholderType}"[^>]*/>[\\s\\S]*?</p:sp>`,
    'gi'
  );

  // Alternative: find shape with placeholder type
  const spPattern = new RegExp(
    `<p:sp[^>]*>[\\s\\S]*?<p:ph[^>]*type="${placeholderType}"[^>]*/?>[\\s\\S]*?</p:sp>`,
    'gi'
  );

  let matches = xml.match(spPattern);
  if (!matches || matches.length === 0) {
    // Try simpler approach - find the placeholder and get surrounding shape
    const simplePattern = new RegExp(
      `<p:nvSpPr>[\\s\\S]*?<p:ph[^>]*type="${placeholderType}"[^>]*/>[\\s\\S]*?</p:nvSpPr>[\\s\\S]*?<p:txBody>([\\s\\S]*?)</p:txBody>`,
      'gi'
    );
    matches = xml.match(simplePattern);
  }

  if (matches && matches.length > 0) {
    return extractAllText(matches[0]);
  }

  return '';
}

/**
 * Extract bullet points from paragraphs
 */
function extractBulletPoints(xml) {
  const bullets = [];

  // Find paragraphs with bullet properties
  const paraPattern = /<a:p>[\s\S]*?<\/a:p>/gi;
  const paragraphs = xml.match(paraPattern) || [];

  for (const para of paragraphs) {
    // Check if it has bullet/list properties
    const hasBullet = /<a:buChar/.test(para) ||
                      /<a:buAutoNum/.test(para) ||
                      /<a:buBlip/.test(para) ||
                      /<a:pPr[^>]*lvl=/.test(para);

    if (hasBullet) {
      const text = extractAllText(para);
      if (text.trim()) {
        bullets.push(text.trim());
      }
    }
  }

  return bullets;
}

/**
 * Extract tables from slide XML
 */
function extractTables(xml) {
  const tables = [];

  // Find table elements
  const tablePattern = /<a:tbl>[\s\S]*?<\/a:tbl>/gi;
  const tableMatches = xml.match(tablePattern) || [];

  for (const tableXml of tableMatches) {
    const table = { rows: [] };

    // Find rows
    const rowPattern = /<a:tr[^>]*>[\s\S]*?<\/a:tr>/gi;
    const rowMatches = tableXml.match(rowPattern) || [];

    for (const rowXml of rowMatches) {
      const row = [];

      // Find cells
      const cellPattern = /<a:tc>[\s\S]*?<\/a:tc>/gi;
      const cellMatches = rowXml.match(cellPattern) || [];

      for (const cellXml of cellMatches) {
        const cellText = extractAllText(cellXml);
        row.push(cellText.trim());
      }

      if (row.length > 0) {
        table.rows.push(row);
      }
    }

    if (table.rows.length > 0) {
      tables.push(table);
    }
  }

  return tables;
}

/**
 * Extract shapes with their text content
 */
function extractShapes(xml) {
  const shapes = [];

  // Find shape elements
  const shapePattern = /<p:sp>[\s\S]*?<\/p:sp>/gi;
  const shapeMatches = xml.match(shapePattern) || [];

  for (const shapeXml of shapeMatches) {
    // Skip if it's a placeholder (already handled)
    if (/<p:ph/.test(shapeXml)) continue;

    const text = extractAllText(shapeXml);
    if (text.trim()) {
      // Try to get shape name
      const nameMatch = shapeXml.match(/<p:cNvPr[^>]*name="([^"]*)"[^>]*>/i);
      shapes.push({
        name: nameMatch ? nameMatch[1] : 'Shape',
        text: text.trim(),
      });
    }
  }

  return shapes;
}

/**
 * Detect charts in slide (chart data is in separate files)
 */
function detectCharts(xml) {
  const charts = [];

  // Charts are referenced via relationships
  const chartPattern = /<c:chart|<p:oleObj[^>]*progId="[^"]*Chart[^"]*"/gi;
  const chartMatches = xml.match(chartPattern) || [];

  for (let i = 0; i < chartMatches.length; i++) {
    charts.push({ title: `Chart ${i + 1}` });
  }

  return charts;
}

/**
 * Detect images in slide
 */
function detectImages(xml) {
  const images = [];

  // Images are in blip elements
  const imgPattern = /<a:blip[^>]*r:embed="([^"]*)"[^>]*>/gi;
  let match;
  while ((match = imgPattern.exec(xml)) !== null) {
    images.push({ rId: match[1] });
  }

  return images;
}

/**
 * Extract all text content from an XML fragment
 */
function extractAllText(xml) {
  const texts = [];

  // Get text from <a:t> tags
  const textPattern = /<a:t>([^<]*)<\/a:t>/gi;
  let match;
  while ((match = textPattern.exec(xml)) !== null) {
    if (match[1]) {
      texts.push(decodeXmlEntities(match[1]));
    }
  }

  // Join with appropriate spacing (paragraphs get newlines)
  const result = [];
  let currentPara = [];

  const paraPattern = /<a:p>/gi;
  const parts = xml.split(paraPattern);

  for (const part of parts) {
    const partTexts = [];
    const partTextPattern = /<a:t>([^<]*)<\/a:t>/gi;
    let partMatch;
    while ((partMatch = partTextPattern.exec(part)) !== null) {
      if (partMatch[1]) {
        partTexts.push(decodeXmlEntities(partMatch[1]));
      }
    }
    if (partTexts.length > 0) {
      result.push(partTexts.join(''));
    }
  }

  return result.join('\n');
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extract XML tag value
 */
function extractXmlValue(xml, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(pattern);
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

/**
 * Extract speaker notes from PPTX
 */
async function extractPPTXNotes(zip) {
  const notes = [];
  const notesPattern = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/;

  const noteFiles = Object.keys(zip.files)
    .filter(name => notesPattern.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(notesPattern)[1]);
      const numB = parseInt(b.match(notesPattern)[1]);
      return numA - numB;
    });

  for (const notePath of noteFiles) {
    const noteNumber = parseInt(notePath.match(notesPattern)[1]);
    const xml = await zip.file(notePath).async('text');
    const text = extractAllText(xml);

    if (text.trim()) {
      notes.push({
        slideNumber: noteNumber,
        content: text.trim(),
      });
    }
  }

  return notes;
}

/**
 * Extract slide masters for design context
 */
async function extractPPTXMasters(zip) {
  const masters = [];

  try {
    const masterPattern = /^ppt\/slideMasters\/slideMaster(\d+)\.xml$/;
    const masterFiles = Object.keys(zip.files).filter(name => masterPattern.test(name));

    for (const masterPath of masterFiles) {
      const xml = await zip.file(masterPath).async('text');
      const text = extractAllText(xml);

      if (text.trim()) {
        masters.push({
          type: 'master',
          content: text.trim().slice(0, 500), // Just a sample
        });
      }
    }
  } catch (error) {
    console.warn('[PPTX Parser] Error extracting masters:', error);
  }

  return masters;
}

/**
 * Parse images using AI vision capabilities
 */
async function parseImage(file, settings) {
  // Convert image to base64
  const base64 = await fileToBase64(file);

  // If no settings provided, just return the image data without AI analysis
  if (!settings || !settings.providers) {
    return {
      type: 'image',
      content: '[Image uploaded - AI analysis not available without API configuration]',
      imageData: base64,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    };
  }

  // Use vision-capable model to analyze the image
  try {
    const analysis = await analyzeImageWithAI(base64, file.type, settings);
    return {
      type: 'image',
      content: analysis,
      imageData: base64,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    };
  } catch (error) {
    console.error('[DocumentParser] Image analysis failed:', error);
    return {
      type: 'image',
      content: '[Image uploaded - AI analysis failed]',
      imageData: base64,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        analysisError: error.message,
      },
    };
  }
}

/**
 * Convert file to base64 string
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Analyze image using AI vision model
 */
export async function analyzeImageWithAI(base64, mimeType, settings) {
  // Find a vision-capable model
  const modelRef = settings.model || 'openai:gpt-4o';
  const [providerId, modelName] = modelRef.includes(':') ? modelRef.split(':') : ['openai', modelRef];

  const provider = settings.providers.find(p => p.id === providerId);
  if (!provider || !provider.apiKey) {
    throw new Error('No API key configured for image analysis');
  }

  // Build the API request based on provider
  if (providerId === 'openai' || providerId === 'pwc') {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (provider.authType === 'server') {
      // Server-managed auth: backend proxy adds the key
    } else if (provider.azurePrefix) {
      headers['api-key'] = provider.apiKey;
    } else {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const response = await authFetch(provider.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image in detail.

FIRST: Determine if this image appears to be a PRESENTATION SLIDE (has title, bullet points, structured layout, branded design, charts/diagrams in slide format, etc.)

If it IS a slide image:
- Start your response with: "[SLIDE IMAGE]"
- Describe the slide layout (title position, content areas, any graphics/charts)
- Extract ALL visible text exactly as shown
- Note colors, styling, and design elements
- Describe any charts, diagrams, or images on the slide

If it is NOT a slide (regular photo, document, screenshot, etc.):
- Extract all visible text
- Describe charts/diagrams if present
- Summarize the key information

Format your response as structured text that could be used as reference material.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '[No analysis available]';
  }

  if (providerId === 'anthropic') {
    const response = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `Analyze this image in detail.

FIRST: Determine if this image appears to be a PRESENTATION SLIDE (has title, bullet points, structured layout, branded design, charts/diagrams in slide format, etc.)

If it IS a slide image:
- Start your response with: "[SLIDE IMAGE]"
- Describe the slide layout (title position, content areas, any graphics/charts)
- Extract ALL visible text exactly as shown
- Note colors, styling, and design elements
- Describe any charts, diagrams, or images on the slide

If it is NOT a slide (regular photo, document, screenshot, etc.):
- Extract all visible text
- Describe charts/diagrams if present
- Summarize the key information

Format your response as structured text that could be used as reference material.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '[No analysis available]';
  }

  if (providerId === 'gemini') {
    const apiUrl = `${provider.apiUrl}/models/${modelName}:generateContent?key=${provider.apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze this image in detail.

FIRST: Determine if this image appears to be a PRESENTATION SLIDE (has title, bullet points, structured layout, branded design, charts/diagrams in slide format, etc.)

If it IS a slide image:
- Start your response with: "[SLIDE IMAGE]"
- Describe the slide layout (title position, content areas, any graphics/charts)
- Extract ALL visible text exactly as shown
- Note colors, styling, and design elements
- Describe any charts, diagrams, or images on the slide

If it is NOT a slide (regular photo, document, screenshot, etc.):
- Extract all visible text
- Describe charts/diagrams if present
- Summarize the key information

Format your response as structured text that could be used as reference material.`,
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '[No analysis available]';
  }

  throw new Error(`Unsupported provider for image analysis: ${providerId}`);
}

/**
 * Parse plain text files
 */
async function parseText(file) {
  const text = await file.text();

  return {
    type: 'text',
    content: text,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
    },
  };
}

/**
 * Get supported file extensions
 */
export function getSupportedExtensions() {
  return {
    documents: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'],
    spreadsheets: ['xls', 'xlsx', 'csv'],
    presentations: ['ppt', 'pptx'],
    images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
  };
}

/**
 * Check if a file is supported
 */
export function isFileSupported(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const all = Object.values(getSupportedExtensions()).flat();
  return all.includes(ext);
}

/**
 * Get accept string for file input
 */
export function getAcceptString() {
  const exts = Object.values(getSupportedExtensions()).flat();
  return exts.map(e => `.${e}`).join(',');
}

export default {
  parseDocument,
  parseMultipleDocuments,
  getSupportedExtensions,
  isFileSupported,
  getAcceptString,
};
