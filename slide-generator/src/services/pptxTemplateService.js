// PPTX Template Service
// Applies an uploaded .pptx template's slide masters, layouts, and theme
// to a PptxGenJS-generated presentation via JSZip XML manipulation.

import JSZip from 'jszip';
import { extractBranding } from './brandingExtractor';
import { authFetch } from './authFetch.js';
import { getClientDesignProfile, getClientProfileTemplateStorageKey } from '../utils/clientDesignProfiles.js';

/**
 * Store for the loaded template data.
 * Kept in memory (and persisted to IndexedDB) so it survives page reloads.
 */
const DB_NAME = 'pptxTemplateDB';
const DB_STORE = 'templates';
const LEGACY_DB_KEY = 'baseTemplate';

function normalizeTemplateOptions(options = {}) {
  if (typeof options === 'string') {
    return { profileId: options, templateId: 'default' };
  }
  return {
    profileId: options.profileId || 'strategy',
    templateId: options.templateId || 'default',
  };
}

function templateStorageKey(options = {}) {
  const normalized = normalizeTemplateOptions(options);
  return getClientProfileTemplateStorageKey(normalized.profileId, normalized.templateId);
}

function canUseServerDefaultTemplate(profileId, templateId) {
  if (templateId !== 'default') return false;
  if (profileId === 'strategy') return true;
  const profile = getClientDesignProfile(profileId);
  const master = profile?.pptxMaster;
  return master?.serverSync === 'backend-profile-default' || master?.bundled === true;
}

// ── Server sync (persists across browsers when backend is available) ─────────

/**
 * POST multipart field "template" to store the PPTX master on the server.
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} fileName
 * @returns {Promise<{ success: boolean, fileName: string, size: number }>}
 */
export async function uploadTemplateToServer(arrayBuffer, fileName) {
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  const form = new FormData();
  form.append('template', blob, fileName || 'template.pptx');
  const res = await authFetch('/api/templates/pptx-master', { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = typeof j.error === 'string' ? j.error : j.error?.message || text;
    } catch {
      // keep text
    }
    throw new Error(typeof msg === 'string' ? msg : text || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * GET stored PPTX master from the server.
 * @returns {Promise<{ data: ArrayBuffer, fileName: string } | null>}
 */
export async function loadTemplateFromServer(profileId = 'strategy') {
  const params = profileId && profileId !== 'strategy'
    ? `?profileId=${encodeURIComponent(profileId)}`
    : '';
  const res = await authFetch(`/api/templates/pptx-master${params}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = await res.arrayBuffer();
  const enc = res.headers.get('X-Pptx-Template-Name');
  const fileName = enc ? decodeURIComponent(enc) : 'pptx-master.pptx';
  return { data, fileName };
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTemplateToStorage(arrayBuffer, fileName, chrome = null, options = {}) {
  const normalized = normalizeTemplateOptions(options);
  const key = templateStorageKey(normalized);
  const db = await openDB();
  const record = {
    data: arrayBuffer,
    fileName,
    savedAt: Date.now(),
    profileId: normalized.profileId,
    templateId: normalized.templateId,
    storageKey: key,
  };
  if (chrome) record.chrome = chrome;
  if (options.extraction) {
    record.extraction = {
      profileId: options.extraction.profileId,
      extractionVersion: options.extraction.extractionVersion,
      raw: options.extraction.raw,
      evidence: options.extraction.evidence,
    };
  }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.put(record, key);
    if (normalized.profileId === 'strategy' && normalized.templateId === 'default') {
      store.put(record, LEGACY_DB_KEY);
    }
    tx.oncomplete = () => {
      console.log('[PPTX Template] Saved template to IndexedDB:', fileName, arrayBuffer.byteLength, 'bytes', `(${key})`,
        chrome ? '(with chrome)' : '');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
  if (normalized.profileId === 'strategy' && normalized.templateId === 'default') {
    try {
      await uploadTemplateToServer(arrayBuffer, fileName);
    } catch (e) {
      console.warn('[PPTX Template] Server upload failed:', e.message);
    }
  } else {
    console.info('[PPTX Template] Stored template locally for profile:', normalized.profileId);
  }
}

export async function loadTemplateFromStorage(options = {}) {
  const normalized = normalizeTemplateOptions(options);
  const key = templateStorageKey(normalized);
  const canUseServerDefault = canUseServerDefaultTemplate(normalized.profileId, normalized.templateId);
  const canUseLegacyLocal = normalized.profileId === 'strategy' && normalized.templateId === 'default';
  let serverData = null;
  if (canUseServerDefault) {
    try {
      const serverTemplate = await loadTemplateFromServer(normalized.profileId);
      if (serverTemplate) {
        serverData = {
          data: serverTemplate.data,
          fileName: serverTemplate.fileName,
          savedAt: Date.now(),
          profileId: normalized.profileId,
          templateId: normalized.templateId,
          storageKey: key,
        };
        console.log('[PPTX Template] Loaded from server:', serverData.fileName, serverData.data?.byteLength, 'bytes');
      }
    } catch (e) {
      console.warn('[PPTX Template] Server template unavailable, trying local:', e.message);
    }
  }

  let localRecord = null;
  try {
    const db = await openDB();
    localRecord = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result || !canUseLegacyLocal) {
          resolve(req.result || null);
          return;
        }
        const legacyReq = store.get(LEGACY_DB_KEY);
        legacyReq.onsuccess = () => resolve(legacyReq.result || null);
        legacyReq.onerror = () => reject(legacyReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[PPTX Template] IndexedDB read failed:', e.message);
  }

  const record = canUseLegacyLocal ? (serverData || localRecord) : (localRecord || serverData);
  if (!record) {
    console.log('[PPTX Template] No template found for profile slot:', key);
    return null;
  }

  if (serverData && localRecord?.chrome) {
    record.chrome = localRecord.chrome;
    console.log('[PPTX Template] Merged chrome metadata from IndexedDB');
  }

  const needsReExtract = record.data && (
    !record.chrome?.logo?.image ||
    !record.chrome?.positions ||
    !record.chrome.positions.slideNum?.font ||
    !record.chrome.positions.footer?.font
  );
  if (needsReExtract) {
    try {
      console.log('[PPTX Template] Re-extracting branding for font metadata...');
      const result = await extractBranding(record.data, { profileId: normalized.profileId });
      if (result?.chrome) {
        record.chrome = result.chrome;
        const db = await openDB();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(DB_STORE, 'readwrite');
          tx.objectStore(DB_STORE).put({
            ...record,
            chrome: result.chrome,
            extraction: {
              profileId: result.profileId,
              extractionVersion: result.extractionVersion,
              raw: result.raw,
              evidence: result.evidence,
            },
            storageKey: key,
          }, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        console.log('[PPTX Template] Updated chrome with font metadata');
      }
    } catch (e) {
      console.warn('[PPTX Template] Re-extraction failed:', e.message);
    }
  }

  if (serverData) {
    console.log('[PPTX Template] Loaded from server:', record.fileName, record.data?.byteLength, 'bytes');
  } else {
    console.log('[PPTX Template] Loaded from IndexedDB:', record.fileName, record.data?.byteLength, 'bytes', `(${key})`);
  }
  return record;
}

export async function clearTemplateFromStorage(options = {}) {
  const normalized = normalizeTemplateOptions(options);
  const key = templateStorageKey(normalized);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.delete(key);
    if (normalized.profileId === 'strategy' && normalized.templateId === 'default') {
      store.delete(LEGACY_DB_KEY);
    }
    tx.oncomplete = () => {
      console.log('[PPTX Template] Cleared template from IndexedDB:', key);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const WHITE_BG = '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>';

/**
 * Inject a solid white background into slide XML so master/layout backgrounds
 * do not bleed through generated content.
 */
function injectSlideBackground(slideXml) {
  if (/<p:bg\b/.test(slideXml)) return slideXml;
  return slideXml.replace(/(<p:cSld[^>]*>)/, `$1${WHITE_BG}`);
}

/**
 * Add showMasterSp="0" to the <p:sld> root element so decorative shapes
 * from the slide master (diamonds, text boxes, invisible EMFs) are hidden.
 * The logo and footer are injected directly into the slide's spTree,
 * so they are unaffected by this attribute.
 */
function hideMasterShapes(slideXml) {
  if (/showMasterSp/.test(slideXml)) return slideXml;
  return slideXml.replace(/<p:sld(\s)/, '<p:sld showMasterSp="0"$1');
}

function stripLayoutChrome(layoutXml) {
  if (!layoutXml || !/<p:spTree>/.test(layoutXml)) return layoutXml;
  return layoutXml.replace(/<p:spTree>([\s\S]*?)<\/p:spTree>/, (match, inner) => {
    const nvGrp = inner.match(/<p:nvGrpSpPr\b[\s\S]*?<\/p:nvGrpSpPr>/)?.[0] || '';
    const grpSpPr = inner.match(/<p:grpSpPr\b[\s\S]*?<\/p:grpSpPr>/)?.[0] || '';
    return `<p:spTree>${nvGrp}${grpSpPr}</p:spTree>`;
  });
}

function stripUnusedLayoutChromeRelationships(relsXml) {
  if (!relsXml) return relsXml;
  return relsXml
    .replace(/<Relationship[^>]*Type="[^"]*\/image"[^>]*\/>/g, '')
    .replace(/<Relationship[^>]*Type="[^"]*\/oleObject"[^>]*\/>/g, '');
}

const EMU_PER_INCH = 914400;

function logoMediaConfig(logo) {
  const logoMediaExt = String(logo?.mediaPath || '').split('.').pop()?.toLowerCase() || 'png';
  const safeLogoExt = ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(logoMediaExt) ? logoMediaExt : 'png';
  return {
    mediaPath: `ppt/media/logo_chrome.${safeLogoExt}`,
    relTarget: `../media/logo_chrome.${safeLogoExt}`,
    ext: safeLogoExt,
  };
}

function writeLogoMedia(zip, logo, mediaPath) {
  if (!logo?.image) return false;
  try {
    const base64 = String(logo.image).split(',')[1];
    if (!base64) return false;
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    zip.file(mediaPath, binary);
    console.log('[PPTX Template] Wrote logo media file (%d bytes)', binary.length);
    return true;
  } catch (e) {
    console.warn('[PPTX Template] Logo media write failed:', e.message);
    return false;
  }
}

function addLogoRelationship(relsXml, rId, relTarget) {
  const withoutExisting = relsXml.replace(
    new RegExp(`<Relationship[^>]*Id="${rId}"[^>]*/>`, 'g'),
    ''
  );
  return withoutExisting.replace(
    '</Relationships>',
    `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${relTarget}"/></Relationships>`
  );
}

function ensureMediaContentType(contentTypesXml, ext) {
  if (!contentTypesXml || !ext) return contentTypesXml;
  if (new RegExp(`<Default[^>]*Extension="${ext}"`).test(contentTypesXml)) return contentTypesXml;
  const contentType = ext === 'svg'
    ? 'image/svg+xml'
    : ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'gif'
        ? 'image/gif'
        : 'image/png';
  return contentTypesXml.replace('</Types>', `<Default Extension="${ext}" ContentType="${contentType}"/></Types>`);
}

/**
 * Inject a `<p:pic>` shape for the logo into slide XML before `</p:spTree>`.
 */
function injectLogoPic(slideXml, logo, rId) {
  if (!logo || !/<\/p:spTree>/.test(slideXml)) return slideXml;
  const x = Math.round(logo.x * EMU_PER_INCH);
  const y = Math.round(logo.y * EMU_PER_INCH);
  const cx = Math.round(logo.w * EMU_PER_INCH);
  const cy = Math.round(logo.h * EMU_PER_INCH);

  const pic = `<p:pic><p:nvPicPr><p:cNvPr id="9990" name="TemplateLogo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;

  return slideXml.replace('</p:spTree>', pic + '</p:spTree>');
}

export async function applyProfileChromeToGenerated(generatedBuf, chrome = null) {
  console.log('[PPTX Template] Applying controlled profile chrome. Generated:', generatedBuf.byteLength, 'bytes');
  const genZip = await JSZip.loadAsync(generatedBuf);
  const LOGO_RID = 'rId900';
  const logoConfig = logoMediaConfig(chrome?.logo);
  const hasLogo = writeLogoMedia(genZip, chrome?.logo, logoConfig.mediaPath);

  const genSlideFiles = Object.keys(genZip.files)
    .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)/)[1], 10);
      return na - nb;
    });

  for (const genSlidePath of genSlideFiles) {
    const slideNum = parseInt(genSlidePath.match(/slide(\d+)/)[1], 10);
    const genSlideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    let slideXml = await genZip.files[genSlidePath].async('string');
    slideXml = hideMasterShapes(injectSlideBackground(slideXml));
    if (hasLogo) slideXml = injectLogoPic(slideXml, chrome.logo, LOGO_RID);
    genZip.file(genSlidePath, slideXml);

    if (!hasLogo) continue;
    if (genZip.files[genSlideRelsPath]) {
      const relsXml = await genZip.files[genSlideRelsPath].async('string');
      genZip.file(genSlideRelsPath, addLogoRelationship(relsXml, LOGO_RID, logoConfig.relTarget));
    } else {
      genZip.file(genSlideRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${LOGO_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${logoConfig.relTarget}"/>
</Relationships>`);
    }
  }

  const ctPath = '[Content_Types].xml';
  if (hasLogo && genZip.files[ctPath]) {
    const contentTypesXml = await genZip.files[ctPath].async('string');
    genZip.file(ctPath, ensureMediaContentType(contentTypesXml, logoConfig.ext));
  }

  const result = await genZip.generateAsync({ type: 'arraybuffer' });
  console.log('[PPTX Template] Controlled profile chrome complete. Output:', result.byteLength, 'bytes');
  return result;
}

/**
 * OOXML layout type attribute -> internal type.
 */
const LAYOUT_TYPE_MAP = {
  title: 'title', ctrTitle: 'title',
  obj: 'content', tx: 'content',
  twoObj: 'twoContent', secHead: 'sectionHeader',
  blank: 'blank', titleOnly: 'titleOnly',
};

/**
 * Scan template layouts and pick the best one for AI-generated content.
 * Preference: blank > titleOnly > content (layout 2) > first available.
 */
async function pickBestLayout(tplZip) {
  const layoutFiles = Object.keys(tplZip.files)
    .filter(f => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/(\d+)/g).pop()) - parseInt(b.match(/(\d+)/g).pop()));

  const candidates = { blank: null, titleOnly: null, content: null };

  for (const path of layoutFiles) {
    const idx = parseInt(path.match(/slideLayout(\d+)/)[1]);
    const xml = await tplZip.files[path].async('string');

    let type = null;
    const typeMatch = xml.match(/<p:sldLayout[^>]*type="([^"]+)"/);
    if (typeMatch) type = LAYOUT_TYPE_MAP[typeMatch[1]] || null;

    if (!type) {
      const nameMatch = xml.match(/<p:cSld\s+name="([^"]+)"/);
      if (nameMatch) {
        const n = nameMatch[1].toLowerCase();
        if (n.includes('blank')) type = 'blank';
        else if (n.includes('title only')) type = 'titleOnly';
        else if (n.includes('content') || n.includes('title and')) type = 'content';
      }
    }

    if (type === 'blank' && !candidates.blank) candidates.blank = idx;
    else if (type === 'titleOnly' && !candidates.titleOnly) candidates.titleOnly = idx;
    else if (type === 'content' && !candidates.content) candidates.content = idx;
  }

  const pick = candidates.blank || candidates.titleOnly || candidates.content || 1;
  console.log('[PPTX Template] Layout candidates: blank=%s titleOnly=%s content=%s -> using %d',
    candidates.blank, candidates.titleOnly, candidates.content, pick);
  return pick;
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
export async function applyTemplateToGenerated(generatedBuf, templateBuf, chrome = null) {
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
  const targetLayoutNum = await pickBestLayout(tplZip);
  console.log('[PPTX Template] Using slideLayout' + targetLayoutNum);

  const targetLayoutPath = `ppt/slideLayouts/slideLayout${targetLayoutNum}.xml`;
  const targetLayoutRelsPath = `ppt/slideLayouts/_rels/slideLayout${targetLayoutNum}.xml.rels`;
  if (tplZip.files[targetLayoutPath]) {
    const layoutXml = await tplZip.files[targetLayoutPath].async('string');
    tplZip.file(targetLayoutPath, stripLayoutChrome(layoutXml));
    console.log('[PPTX Template] Stripped visible chrome from slideLayout' + targetLayoutNum);
  }
  if (tplZip.files[targetLayoutRelsPath]) {
    const layoutRelsXml = await tplZip.files[targetLayoutRelsPath].async('string');
    tplZip.file(targetLayoutRelsPath, stripUnusedLayoutChromeRelationships(layoutRelsXml));
  }

  // ── Step 4a: Write logo media file if chrome provides one ───────────────
  const LOGO_RID = 'rId900';
  const logoMediaExt = String(chrome?.logo?.mediaPath || '').split('.').pop()?.toLowerCase() || 'png';
  const safeLogoExt = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'emf', 'wmf'].includes(logoMediaExt) ? logoMediaExt : 'png';
  const LOGO_MEDIA = `ppt/media/logo_chrome.${safeLogoExt}`;
  const LOGO_TARGET = `../media/logo_chrome.${safeLogoExt}`;
  let hasLogo = false;

  if (chrome?.logo?.image) {
    try {
      const dataUri = chrome.logo.image;
      const base64 = dataUri.split(',')[1];
      if (base64) {
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        tplZip.file(LOGO_MEDIA, binary);
        hasLogo = true;
        console.log('[PPTX Template] Wrote logo media file (%d bytes)', binary.length);
      }
    } catch (e) {
      console.warn('[PPTX Template] Logo media write failed:', e.message);
    }
  }

  // ── Step 4b: Copy generated slides into template ───────────────────────
  for (let i = 0; i < slideCount; i++) {
    const slideNum = i + 1;
    const genSlidePath = `ppt/slides/slide${slideNum}.xml`;
    const genSlideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    if (genZip.files[genSlidePath]) {
      let slideXml = await genZip.files[genSlidePath].async('string');
      slideXml = hideMasterShapes(slideXml);
      slideXml = injectSlideBackground(slideXml);
      if (hasLogo) slideXml = injectLogoPic(slideXml, chrome.logo, LOGO_RID);
      tplZip.file(genSlidePath, slideXml);
    }

    // Build slide rels: point layout to template's layout,
    // strip notesSlide refs (they'd be dangling), keep other rels (images, charts)
    if (genZip.files[genSlideRelsPath]) {
      let genRelsXml = await genZip.files[genSlideRelsPath].async('string');
      genRelsXml = genRelsXml.replace(
        /Target="[^"]*slideLayout\d+\.xml"/,
        `Target="../slideLayouts/slideLayout${targetLayoutNum}.xml"`
      );
      genRelsXml = genRelsXml.replace(
        /<Relationship[^>]*Type="[^"]*notesSlide"[^>]*\/>/g,
        ''
      );
      if (hasLogo) {
        genRelsXml = genRelsXml.replace(
          '</Relationships>',
          `<Relationship Id="${LOGO_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${LOGO_TARGET}"/></Relationships>`
        );
      }
      tplZip.file(genSlideRelsPath, genRelsXml);
    } else {
      let slideRel = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${targetLayoutNum}.xml"/>`;
      if (hasLogo) {
        slideRel += `\n  <Relationship Id="${LOGO_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${LOGO_TARGET}"/>`;
      }
      slideRel += '\n</Relationships>';
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
