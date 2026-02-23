// PPTX Template Service
// Applies an uploaded .pptx template's slide masters, layouts, and theme
// to a PptxGenJS-generated presentation via JSZip XML manipulation.

import JSZip from 'jszip';

/**
 * Store for the loaded template data.
 * Kept in memory (and persisted to IndexedDB) so it survives page reloads.
 */
const DB_NAME = 'pptxTemplateDB';
const DB_STORE = 'templates';
const DB_KEY = 'baseTemplate';

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTemplateToStorage(arrayBuffer, fileName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put({ data: arrayBuffer, fileName, savedAt: Date.now() }, DB_KEY);
    tx.oncomplete = () => {
      console.log('[PPTX Template] Saved template to IndexedDB:', fileName, arrayBuffer.byteLength, 'bytes');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadTemplateFromStorage() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DB_KEY);
    req.onsuccess = () => {
      const result = req.result || null;
      if (result) {
        console.log('[PPTX Template] Loaded template from IndexedDB:', result.fileName, result.data?.byteLength, 'bytes');
      } else {
        console.log('[PPTX Template] No template found in IndexedDB');
      }
      resolve(result);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearTemplateFromStorage() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(DB_KEY);
    tx.oncomplete = () => {
      console.log('[PPTX Template] Cleared template from IndexedDB');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ── Core: apply template to generated PPTX ─────────────────────────────────

/**
 * Takes a PptxGenJS-generated arraybuffer and an uploaded template arraybuffer,
 * and produces a new arraybuffer where the generated slides sit inside the
 * template's shell (theme, masters, layouts, fonts, core props).
 *
 * Strategy:
 *   1. Open both ZIPs
 *   2. Start from the TEMPLATE zip (it has the right masters/layouts/theme)
 *   3. Remove template's placeholder slides (ppt/slides/slide*.xml + rels)
 *   4. Copy generated slides (ppt/slides/slide*.xml + rels) + media into template
 *   5. Update ppt/presentation.xml to reference only our slides
 *   6. Update [Content_Types].xml to list our slides
 *   7. Return merged ZIP
 */
export async function applyTemplateToGenerated(generatedBuf, templateBuf) {
  console.log('[PPTX Template] Starting merge. Generated:', generatedBuf.byteLength, 'bytes, Template:', templateBuf.byteLength, 'bytes');

  const tplZip = await JSZip.loadAsync(templateBuf);
  const genZip = await JSZip.loadAsync(generatedBuf);

  // ── Step 1: Remove template's existing slides + notesSlides ────────────
  const tplSlideFiles = Object.keys(tplZip.files).filter(
    f => f.match(/^ppt\/slides\/slide\d+\.xml$/) || f.match(/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/)
  );
  tplSlideFiles.forEach(f => tplZip.remove(f));
  Object.keys(tplZip.files).filter(f => f.match(/^ppt\/notesSlides\//)).forEach(f => tplZip.remove(f));
  console.log('[PPTX Template] Removed', tplSlideFiles.length, 'template slide files');

  // ── Step 2: Discover generated slides ───────────────────────────────────
  const genSlideFiles = Object.keys(genZip.files)
    .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)[1]);
      const nb = parseInt(b.match(/slide(\d+)/)[1]);
      return na - nb;
    });

  const slideCount = genSlideFiles.length;
  console.log('[PPTX Template] Generated slide count:', slideCount);

  // ── Step 3: Determine target slide layout from template ─────────────────
  // Look at the template's slide master rels to find available layouts.
  // Prefer layout #2 ("Title and Content") if it exists, otherwise use the first.
  const tplMasterRelsPath = 'ppt/slideMasters/_rels/slideMaster1.xml.rels';
  let targetLayoutNum = 1; // safe fallback
  if (tplZip.files[tplMasterRelsPath]) {
    const masterRelsXml = await tplZip.files[tplMasterRelsPath].async('string');
    const layoutMatches = [...masterRelsXml.matchAll(/Id="(rId\d+)"[^>]*Target="[^"]*slideLayout(\d+)\.xml"/g)];
    if (layoutMatches.length > 0) {
      const layoutNums = layoutMatches.map(m => parseInt(m[2]));
      console.log('[PPTX Template] Available layouts:', layoutNums.join(', '));
      // Prefer layout 2 ("Title and Content"), else first available
      targetLayoutNum = layoutNums.includes(2) ? 2 : layoutNums[0];
    }
  }
  console.log('[PPTX Template] Using slideLayout' + targetLayoutNum);

  // ── Step 4: Copy generated slides into template ─────────────────────────
  for (let i = 0; i < slideCount; i++) {
    const slideNum = i + 1;
    const genSlidePath = `ppt/slides/slide${slideNum}.xml`;
    const genSlideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    // Copy slide XML
    if (genZip.files[genSlidePath]) {
      const slideXml = await genZip.files[genSlidePath].async('string');
      tplZip.file(genSlidePath, slideXml);
    }

    // Build slide rels: point layout to template's layout,
    // strip notesSlide refs (they'd be dangling), keep other rels (images, charts)
    if (genZip.files[genSlideRelsPath]) {
      let genRelsXml = await genZip.files[genSlideRelsPath].async('string');
      // Replace layout reference
      genRelsXml = genRelsXml.replace(
        /Target="[^"]*slideLayout\d+\.xml"/,
        `Target="../slideLayouts/slideLayout${targetLayoutNum}.xml"`
      );
      // Remove notesSlide references to avoid dangling rels
      genRelsXml = genRelsXml.replace(
        /<Relationship[^>]*Type="[^"]*notesSlide"[^>]*\/>/g,
        ''
      );
      tplZip.file(genSlideRelsPath, genRelsXml);
    } else {
      // Create minimal rels pointing to template layout
      const slideRel = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${targetLayoutNum}.xml"/>
</Relationships>`;
      tplZip.file(genSlideRelsPath, slideRel);
    }
  }

  // ── Step 5: Copy generated media files ──────────────────────────────────
  const genMediaFiles = Object.keys(genZip.files).filter(f => f.startsWith('ppt/media/'));
  for (const mediaPath of genMediaFiles) {
    const data = await genZip.files[mediaPath].async('arraybuffer');
    tplZip.file(mediaPath, data);
  }
  if (genMediaFiles.length > 0) {
    console.log('[PPTX Template] Copied', genMediaFiles.length, 'media files');
  }

  // ── Step 6: Update presentation.xml ─────────────────────────────────────
  // Replace sldIdLst with our slides, keep everything else (masters, notesMaster, etc.)
  const presPath = 'ppt/presentation.xml';
  if (tplZip.files[presPath]) {
    let presXml = await tplZip.files[presPath].async('string');

    // Build new sldIdLst
    let newSldIdLst = '<p:sldIdLst>';
    for (let i = 0; i < slideCount; i++) {
      newSldIdLst += `<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`;
    }
    newSldIdLst += '</p:sldIdLst>';

    // Replace existing sldIdLst (may be populated or self-closing)
    if (presXml.match(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/)) {
      presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, newSldIdLst);
    } else if (presXml.match(/<p:sldIdLst\/>/)) {
      presXml = presXml.replace(/<p:sldIdLst\/>/, newSldIdLst);
    }

    // Update slide size to match our generated slides (13.333" x 7.5" = 12192000 x 6858000 EMU)
    presXml = presXml.replace(/<p:sldSz[^>]*\/>/, '<p:sldSz cx="12192000" cy="6858000"/>');

    tplZip.file(presPath, presXml);
    console.log('[PPTX Template] Updated presentation.xml with', slideCount, 'slides');
  }

  // ── Step 7: Update presentation.xml.rels ────────────────────────────────
  // Remove old slide relationships, add new ones with rId100+ to avoid conflicts
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  if (tplZip.files[presRelsPath]) {
    let presRelsXml = await tplZip.files[presRelsPath].async('string');

    // Remove old slide relationships
    presRelsXml = presRelsXml.replace(
      /<Relationship[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/slide"[^>]*\/>/g,
      ''
    );

    // Add new slide relationships before closing tag
    let newRels = '';
    for (let i = 0; i < slideCount; i++) {
      newRels += `<Relationship Id="rId${100 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
    }
    presRelsXml = presRelsXml.replace('</Relationships>', newRels + '</Relationships>');

    tplZip.file(presRelsPath, presRelsXml);
  }

  // ── Step 8: Update [Content_Types].xml ──────────────────────────────────
  const ctPath = '[Content_Types].xml';
  if (tplZip.files[ctPath]) {
    let ctXml = await tplZip.files[ctPath].async('string');

    // Remove old slide overrides
    ctXml = ctXml.replace(
      /<Override[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g,
      ''
    );
    // Remove old notesSlide overrides (we removed notesSlides)
    ctXml = ctXml.replace(
      /<Override[^>]*PartName="\/ppt\/notesSlides\/notesSlide\d+\.xml"[^>]*\/>/g,
      ''
    );

    // Add new slide overrides
    let overrides = '';
    for (let i = 0; i < slideCount; i++) {
      overrides += `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
    ctXml = ctXml.replace('</Types>', overrides + '</Types>');

    tplZip.file(ctPath, ctXml);
  }

  // ── Done: produce final arraybuffer ─────────────────────────────────────
  const result = await tplZip.generateAsync({ type: 'arraybuffer' });
  console.log('[PPTX Template] Merge complete. Output:', result.byteLength, 'bytes');
  return result;
}

/**
 * Download an ArrayBuffer as a file.
 */
export function downloadArrayBuffer(buf, filename) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
