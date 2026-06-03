// PPTX Template Service
// Applies an uploaded .pptx template's slide masters, layouts, and theme
// to a PptxGenJS-generated presentation via JSZip XML manipulation.

import JSZip from 'jszip';
import { extractBranding } from './brandingExtractor.js';
import { authFetch } from './authFetch.js';
import { getClientDesignProfile, getClientProfileTemplateStorageKey } from '../utils/clientDesignProfiles.js';
import { ensureMediaContentType, ensureZipMediaContentTypes } from './pptxMediaContentTypes.js';

export { getPptxMediaContentTypeDiagnostics } from './pptxMediaContentTypes.js';

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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer || []);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadProfileLogo(profile) {
  const logoPos = profile?.chrome?.positions?.logo;
  if (!profile?.id || !logoPos) return null;
  try {
    const version = profile?.pptxMaster?.assetVersion || profile?.status || '1';
    const res = await authFetch(`/api/assets/client-templates/${profile.id}/logo.png?v=${encodeURIComponent(version)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    return {
      ...logoPos,
      mediaPath: `ppt/media/${profile.id}_logo.png`,
      image: `data:image/png;base64,${arrayBufferToBase64(buffer)}`,
    };
  } catch (error) {
    console.warn('[PPTX Template] Profile logo unavailable for %s: %s', profile.id, error.message);
    return null;
  }
}

async function buildProfileChrome(profile) {
  if (!profile?.chrome) return null;
  const logo = profile.chrome.injectExportLogo === false
    ? null
    : await loadProfileLogo(profile);
  return {
    footerText: profile.chrome.footerText || '',
    positions: profile.chrome.positions || null,
    ...(logo ? { logo } : {}),
  };
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
  const profile = getClientDesignProfile(normalized.profileId);
  const canUseServerDefault = canUseServerDefaultTemplate(normalized.profileId, normalized.templateId);
  const canUseLegacyLocal = normalized.profileId === 'strategy' && normalized.templateId === 'default';
  const forceBundledDefault = normalized.templateId === 'default' && profile?.pptxMaster?.forceBundledDefault === true;
  const useProfileChrome = profile?.pptxMaster?.useProfileChrome === true;
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

  const record = forceBundledDefault
    ? (serverData || localRecord)
    : canUseLegacyLocal
      ? (serverData || localRecord)
      : (localRecord || serverData);
  if (!record) {
    console.log('[PPTX Template] No template found for profile slot:', key);
    return null;
  }

  if (useProfileChrome) {
    const profileChrome = await buildProfileChrome(profile);
    if (profileChrome) {
      record.chrome = profileChrome;
      console.log('[PPTX Template] Applied verified profile chrome:', normalized.profileId);
    }
  } else if (serverData && localRecord?.chrome) {
    record.chrome = localRecord.chrome;
    console.log('[PPTX Template] Merged chrome metadata from IndexedDB');
  }

  const needsReExtract = !useProfileChrome && record.data && (
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

function normalizePptxHexColor(color, fallback = 'FFFFFF') {
  const raw = String(color || '').trim().replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(raw) ? raw : fallback;
}

function getProfileSlideBackground(profile) {
  return normalizePptxHexColor(profile?.theme?.colors?.page, 'FFFFFF');
}

function buildSlideBackgroundXml(color) {
  const safeColor = normalizePptxHexColor(color, 'FFFFFF');
  return `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${safeColor}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;
}

/**
 * Inject a profile slide background so master/layout backgrounds do not bleed
 * through generated content. Non-white profile decks (FYA) must keep their
 * page color across every exported slide.
 */
function injectSlideBackground(slideXml, profile = null) {
  const backgroundXml = buildSlideBackgroundXml(getProfileSlideBackground(profile));
  if (/<p:bg\b/.test(slideXml)) {
    return slideXml.replace(/<p:bg\b[\s\S]*?<\/p:bg>/, backgroundXml);
  }
  return slideXml.replace(/(<p:cSld[^>]*>)/, `$1${backgroundXml}`);
}

/**
 * Historical exports used showMasterSp="0" to suppress template decoration.
 * We now strip layout/master chrome directly, so avoid writing optional slide
 * state that has caused PowerPoint repair prompts with some generated decks.
 */
function hideMasterShapes(slideXml) {
  return String(slideXml || '').replace(/\s+showMasterSp="[^"]*"/g, '');
}

/** NEOM: keep master hidden so layout/footer activation text and header logos do not bleed through. */
function suppressMasterShapes(slideXml) {
  const xml = String(slideXml || '');
  if (/\sshowMasterSp="0"/.test(xml)) return xml;
  if (/<p:sld\b/.test(xml)) {
    return xml.replace(/<p:sld\b/, '<p:sld showMasterSp="0"');
  }
  return xml;
}

function applyMasterShapeVisibility(slideXml, profile = null) {
  if (profile?.id === 'neom') return suppressMasterShapes(slideXml);
  return hideMasterShapes(slideXml);
}

/** Remove NAFB5 section navigator tree so exported decks are flat slide lists. */
function stripPresentationSections(presXml, profile = null) {
  if (profile?.id !== 'neom') return presXml;
  let xml = String(presXml || '');
  xml = xml.replace(/<p14:sectionLst[\s\S]*?<\/p14:sectionLst>/g, '');
  xml = xml.replace(
    /<p:ext uri="\{521415D9-36F7-43E2-AB2F-B90AF26B5E84\}">[\s\S]*?<\/p:ext>/g,
    '',
  );
  xml = xml.replace(/\s+p14:sectionId="[^"]*"/g, '');
  return xml;
}

/**
 * Remove small header-band pictures LLMs sometimes add to slide XML (NEOM title-only
 * layouts ship Picture 22/23 near 1in,0.35in). Master/footer logos stay below ~7in.
 */
/** Remove master/LLM footer program label from NEOM exports (logo + page number only). */
function stripNeomFooterActivationText(slideXml, profile = null, options = {}) {
  if (profile?.id !== 'neom') return slideXml;
  const stripAll = options.stripAllActivation === true;
  return String(slideXml || '').replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (spXml) => {
    if (!/(?:NEOM\s+AUTHORITY(?:\s+ACTIVATION)?|AUTHORITY\s+ACTIVATION)/i.test(spXml)) return spXml;
    if (stripAll) return '';
    const off = spXml.match(/<a:off x="(\d+)" y="(\d+)"/);
    if (!off) return '';
    const y = parseInt(off[2], 10) / EMU_PER_INCH;
    if (y >= 5.5) return '';
    return spXml;
  });
}

/** Remove LLM-exported footer page numbers before merge injects a single canonical number. */
function stripNeomFooterPageNumbers(slideXml, profile = null) {
  if (profile?.id !== 'neom') return slideXml;
  return String(slideXml || '').replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (spXml) => {
    const text = [...spXml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1]).join('').trim();
    if (!/^\d{1,3}$/.test(text)) return spXml;
    const off = spXml.match(/<a:off x="(\d+)" y="(\d+)"/);
    if (!off) return spXml;
    const y = parseInt(off[2], 10) / EMU_PER_INCH;
    if (y >= 6.5) return '';
    return spXml;
  });
}

async function sanitizeNeomTemplatePackage(tplZip, profile = null) {
  if (profile?.id !== 'neom') return;
  const partPaths = Object.keys(tplZip.files).filter((path) =>
    /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path)
    || /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path),
  );
  for (const path of partPaths) {
    let xml = await tplZip.files[path].async('string');
    xml = stripNeomFooterActivationText(xml, profile, { stripAllActivation: true });
    xml = stripTopBandPicturesFromSlideXml(xml, profile);
    tplZip.file(path, xml);
  }
  const presPath = 'ppt/presentation.xml';
  if (tplZip.files[presPath]) {
    let presXml = await tplZip.files[presPath].async('string');
    presXml = stripPresentationSections(presXml, profile);
    tplZip.file(presPath, presXml);
  }
  console.log('[PPTX Template] NEOM: sanitized %d master/layout parts and presentation sections', partPaths.length);
}

function stripTopBandPicturesFromSlideXml(slideXml, profile = null) {
  if (profile?.id !== 'neom') return slideXml;
  return String(slideXml || '').replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (picXml) => {
    const off = picXml.match(/<a:off x="(\d+)" y="(\d+)"/);
    const ext = picXml.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!off || !ext) return picXml;
    const x = parseInt(off[1], 10) / EMU_PER_INCH;
    const y = parseInt(off[2], 10) / EMU_PER_INCH;
    const h = parseInt(ext[2], 10) / EMU_PER_INCH;
    const w = parseInt(ext[1], 10) / EMU_PER_INCH;
    if (y < 1.35 && x < 2.0 && h < 1.2 && w < 2.5) return '';
    return picXml;
  });
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

function normalizeHexColor(value) {
  const raw = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return raw.split('').map(ch => ch + ch).join('').toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  return null;
}

function replaceThemeColorSlot(themeXml, slot, color) {
  const hex = normalizeHexColor(color);
  if (!hex) return themeXml;
  const replacement = `<a:${slot}><a:srgbClr val="${hex}"/></a:${slot}>`;
  const pattern = new RegExp(`<a:${slot}>[\\s\\S]*?</a:${slot}>`);
  return pattern.test(themeXml)
    ? themeXml.replace(pattern, replacement)
    : themeXml;
}

function cleanFontFace(fontFace) {
  return String(fontFace || '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim();
}

function escapeXmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function patchThemeFonts(themeXml, fontFace) {
  const clean = cleanFontFace(fontFace);
  if (!clean) return themeXml;
  const escaped = escapeXmlAttr(clean);
  return themeXml
    .replace(/(<a:majorFont>[\s\S]*?<a:latin\b[^>]*typeface=")[^"]*(")/, `$1${escaped}$2`)
    .replace(/(<a:minorFont>[\s\S]*?<a:latin\b[^>]*typeface=")[^"]*(")/, `$1${escaped}$2`);
}

async function copyTemplateThemeToGenerated(zip, templateBuf) {
  if (!templateBuf) return false;
  try {
    const tplZip = await JSZip.loadAsync(templateBuf);
    const themePath = 'ppt/theme/theme1.xml';
    if (!tplZip.files[themePath]) return false;
    const themeXml = await tplZip.files[themePath].async('string');
    zip.file(themePath, themeXml);
    console.log('[PPTX Template] Copied theme palette from template master');
    return true;
  } catch (e) {
    console.warn('[PPTX Template] Template theme copy failed:', e.message);
    return false;
  }
}

async function applyProfileThemeToGenerated(zip, profile) {
  const theme = profile?.theme;
  const colors = theme?.colors;
  const themePath = 'ppt/theme/theme1.xml';
  if (!colors || !zip.files[themePath]) return;

  let themeXml = await zip.files[themePath].async('string');
  const schemeName = escapeXmlAttr(theme?.name || profile.name || profile.id || 'Client Profile');
  themeXml = themeXml.replace(/(<a:clrScheme\b[^>]*name=")[^"]*(")/, `$1${schemeName}$2`);
  themeXml = replaceThemeColorSlot(themeXml, 'dk1', colors.body || colors.heading || '#1D252D');
  themeXml = replaceThemeColorSlot(themeXml, 'lt1', colors.page || '#FFFFFF');
  themeXml = replaceThemeColorSlot(themeXml, 'dk2', colors.muted || colors.body || '#515360');
  themeXml = replaceThemeColorSlot(themeXml, 'lt2', colors.surface || colors.accentSoft || '#FBF8FE');
  themeXml = replaceThemeColorSlot(themeXml, 'accent1', colors.accent || colors.heading);
  themeXml = replaceThemeColorSlot(themeXml, 'accent2', colors.accentHover || colors.kicker || colors.danger);
  themeXml = replaceThemeColorSlot(themeXml, 'accent3', colors.success);
  themeXml = replaceThemeColorSlot(themeXml, 'accent4', colors.warning);
  themeXml = replaceThemeColorSlot(themeXml, 'accent5', colors.danger || colors.kicker);
  themeXml = replaceThemeColorSlot(themeXml, 'accent6', colors.neutral || colors.info || colors.border);
  themeXml = replaceThemeColorSlot(themeXml, 'hlink', colors.info || colors.accentHover || colors.accent);
  themeXml = replaceThemeColorSlot(themeXml, 'folHlink', colors.kicker || colors.danger || colors.accentHover);
  themeXml = patchThemeFonts(themeXml, theme.fonts?.body || theme.fonts?.heading || theme.fonts?.title);
  zip.file(themePath, themeXml);
  console.log('[PPTX Template] Applied profile theme palette:', profile.id || theme.name);
}

/**
 * Inject a `<p:pic>` shape for the logo into slide XML before `</p:spTree>`.
 */
function insertIntoSlideShapeTree(slideXml, markup) {
  const spTreeEnd = slideXml.lastIndexOf('</p:spTree>');
  if (spTreeEnd === -1) return slideXml;
  const spTreeStart = slideXml.lastIndexOf('<p:spTree', spTreeEnd);
  const extLstStart = slideXml.lastIndexOf('<p:extLst', spTreeEnd);
  const insertAt = extLstStart > spTreeStart ? extLstStart : spTreeEnd;
  return `${slideXml.slice(0, insertAt)}${markup}${slideXml.slice(insertAt)}`;
}

function allocateShapeIds(slideXml, count) {
  const existing = new Set((String(slideXml || '').match(/<p:cNvPr\b[^>]*\bid="\d+"/g) || [])
    .map(match => Number(match.match(/\bid="(\d+)"/)?.[1]))
    .filter(Number.isFinite));
  const ids = [];
  let next = Math.max(1, ...existing) + 1;
  while (ids.length < count) {
    if (!existing.has(next)) {
      ids.push(next);
      existing.add(next);
    }
    next += 1;
  }
  return ids;
}

function injectLogoPic(slideXml, logo, rId, name = 'TemplateLogo') {
  if (!logo || !/<\/p:spTree>/.test(slideXml)) return slideXml;
  const [shapeId] = allocateShapeIds(slideXml, 1);
  const x = Math.round(logo.x * EMU_PER_INCH);
  const y = Math.round(logo.y * EMU_PER_INCH);
  const cx = Math.round(logo.w * EMU_PER_INCH);
  const cy = Math.round(logo.h * EMU_PER_INCH);

  const pic = `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;

  return insertIntoSlideShapeTree(slideXml, pic);
}

function injectNeomFooterChrome(slideXml, logo, iconLogo, rIdLogo, rIdIcon, positions, isCover = false) {
  if (profileMissingNeomPositions(positions)) return slideXml;
  if (!/<\/p:spTree>/.test(slideXml)) return slideXml;
  // The page number is provided by the master/layout slide-number placeholder
  // (NAFB5 native chrome) -- do NOT inject a duplicate here.
  let next = slideXml;
  if (iconLogo?.image && rIdIcon) {
    next = injectLogoPic(next, iconLogo, rIdIcon, 'NeomFooterIcon');
  }
  if (logo?.image && rIdLogo) {
    next = injectLogoPic(next, logo, rIdLogo, 'NeomFooterLogo');
  }
  // Yellow activation line: body slides only. Covers carry their own accent line
  // in the generated content, so injecting it there would double the line.
  const line = positions.activationLine;
  if (!isCover && line && Number.isFinite(line.w) && line.w > 0) {
    const [lineId] = allocateShapeIds(next, 1);
    const lineShape = `<p:sp><p:nvSpPr><p:cNvPr id="${lineId}" name="NeomActivationLine"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(line.x)}" y="${emu(line.y)}"/><a:ext cx="${emu(line.w)}" cy="${emu(line.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="EBC03F"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
    next = insertIntoSlideShapeTree(next, lineShape);
  }
  return next;
}

function profileMissingNeomPositions(positions) {
  return !positions?.slideNum;
}

function emu(valueInches) {
  return Math.round(Number(valueInches || 0) * EMU_PER_INCH);
}

function injectMoSFooterChrome(slideXml, logo, rId, slideNumber) {
  if (!/<\/p:spTree>/.test(slideXml)) return slideXml;
  const [bandId, sourceId, pageId, logoId] = allocateShapeIds(slideXml, 4);
  const footerY = emu(6.99);
  const footerH = emu(0.51);
  const band = `<p:sp><p:nvSpPr><p:cNvPr id="${bandId}" name="MoSFooterBand"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="${footerY}"/><a:ext cx="${emu(13.333)}" cy="${footerH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="073B16"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;

  const source = `<p:sp><p:nvSpPr><p:cNvPr id="${sourceId}" name="MoSSourceText"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(1.84)}" y="${emu(7.10)}"/><a:ext cx="${emu(7.65)}" cy="${emu(0.18)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="mid"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="800"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Sakkal Majalla"/><a:ea typeface="Sakkal Majalla"/><a:cs typeface="Sakkal Majalla"/></a:rPr><a:t>Sources:</a:t></a:r></a:p></p:txBody></p:sp>`;

  const pageText = escapeXmlAttr(String(slideNumber || ''));
  const page = `<p:sp><p:nvSpPr><p:cNvPr id="${pageId}" name="MoSPageNumber"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(12.69)}" y="${emu(7.10)}"/><a:ext cx="${emu(0.28)}" cy="${emu(0.18)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="mid"/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="en-US" sz="1300"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Sakkal Majalla"/><a:ea typeface="Sakkal Majalla"/><a:cs typeface="Sakkal Majalla"/></a:rPr><a:t>${pageText}</a:t></a:r></a:p></p:txBody></p:sp>`;

  let chrome = band + source + page;
  if (logo) {
    chrome += `<p:pic><p:nvPicPr><p:cNvPr id="${logoId}" name="MoSFooterLogo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(0.25)}" y="${emu(7.08)}"/><a:ext cx="${emu(1.32)}" cy="${emu(0.35)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  }
  return insertIntoSlideShapeTree(slideXml, chrome);
}

function sanitizeSlideXmlForPowerPoint(slideXml, slidePath = '') {
  let fixed = String(slideXml || '');
  const seenIds = new Set();
  let maxId = 0;
  let duplicateIds = 0;
  let nonPositiveExtents = 0;
  let volatileAttributes = 0;
  let unsafeTypefaces = 0;

  fixed = fixed.replace(/\s+(?:dirty|smtClean|err|showMasterSp)="[^"]*"/g, () => {
    volatileAttributes++;
    return '';
  });

  fixed = fixed.replace(/\btypeface="([^"]*)"/g, (match, rawTypeface) => {
    const typeface = String(rawTypeface || '')
      .split(',')[0]
      .trim()
      .replace(/^['"]+|['"]+$/g, '')
      .replace(/\s+/g, ' ');
    if (!typeface || /^(sans-serif|serif|monospace|system-ui)$/i.test(typeface)) {
      unsafeTypefaces++;
      return 'typeface="Arial"';
    }
    if (typeface !== rawTypeface) {
      unsafeTypefaces++;
      return `typeface="${typeface.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
    }
    return match;
  });

  fixed = fixed.replace(/(<[A-Za-z0-9]+:cNvPr\b[^>]*\bid=")(\d+)(")/g, (match, prefix, idValue, suffix) => {
    const id = Number(idValue);
    if (Number.isFinite(id)) maxId = Math.max(maxId, id);
    if (!seenIds.has(idValue)) {
      seenIds.add(idValue);
      return match;
    }
    duplicateIds++;
    let nextId = maxId + 1;
    while (seenIds.has(String(nextId))) nextId++;
    maxId = nextId;
    seenIds.add(String(nextId));
    return `${prefix}${nextId}${suffix}`;
  });

  fixed = fixed.replace(/\b(c[xy])="(-?\d+)"/g, (match, attr, value) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric <= 0) {
      nonPositiveExtents++;
      return `${attr}="1"`;
    }
    return match;
  });

  fixed = fixed.replace(/<a:p\b[^>]*>[\s\S]*?<\/a:p>/g, paragraphXml => {
    let seenParagraphProps = false;
    return paragraphXml.replace(/<a:pPr\b[\s\S]*?<\/a:pPr>/g, match => {
      if (!seenParagraphProps) {
        seenParagraphProps = true;
        return match;
      }
      return '';
    });
  });

  if (duplicateIds > 0 || nonPositiveExtents > 0 || volatileAttributes > 0 || unsafeTypefaces > 0) {
    console.warn('[PPTX Template] Sanitized %s: duplicateShapeIds=%d nonPositiveExtents=%d volatileAttributes=%d unsafeTypefaces=%d',
      slidePath || 'slide XML', duplicateIds, nonPositiveExtents, volatileAttributes, unsafeTypefaces);
  }

  return fixed;
}

/**
 * Strip add-in (e.g. think-cell) embedded OLE objects from master/layout XML.
 * A hidden <p:graphicFrame> OLE data container is a known PowerPoint "repair"
 * trigger once a deck is rebuilt by non-PowerPoint tooling, and serves no
 * purpose in an export shell. We remove only the graphicFrame element; the
 * now-unreferenced oleObject/tag parts are harmless orphans PowerPoint ignores.
 */
function stripAddInOleGraphicFrames(xml) {
  return String(xml || '').replace(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g, (frame) => (
    /think-cell|oleObj|TCLayout|progId=/i.test(frame) ? '' : frame
  ));
}

async function sanitizeContentTypesForExistingParts(zip, label = 'presentation') {
  const contentTypesPath = '[Content_Types].xml';
  if (!zip.files[contentTypesPath]) return;

  const contentTypesXml = await zip.files[contentTypesPath].async('string');
  let removedOverrides = 0;
  const cleanedContentTypesXml = contentTypesXml.replace(/<Override\b[^>]*PartName="([^"]+)"[^>]*\/>/g, (match, partName) => {
    const zipPath = String(partName || '').replace(/^\//, '');
    if (!zipPath || zip.files[zipPath]) return match;
    removedOverrides++;
    return '';
  });

  if (cleanedContentTypesXml !== contentTypesXml) {
    zip.file(contentTypesPath, cleanedContentTypesXml);
    console.warn('[PPTX Template] Removed %d stale content-type override(s) for %s', removedOverrides, label);
  }
}

async function removeOptionalPowerPointSidecars(zip) {
  [
    'ppt/viewProps.xml',
    'ppt/presProps.xml',
    'ppt/tableStyles.xml',
  ].forEach(path => {
    if (zip.files[path]) zip.remove(path);
  });

  const relsPath = 'ppt/_rels/presentation.xml.rels';
  if (zip.files[relsPath]) {
    const relsXml = await zip.files[relsPath].async('string');
    zip.file(relsPath, relsXml
      .replace(/<Relationship[^>]*Type="[^"]*\/(?:viewProps|presProps|tableStyles)"[^>]*\/>/g, ''));
  }
}

async function sanitizeAppProperties(zip) {
  const appPath = 'docProps/app.xml';
  if (!zip.files[appPath]) return;
  const slideCount = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).length;
  const appXml = await zip.files[appPath].async('string');
  const cleanedAppXml = appXml
    .replace(/<Notes>\d+<\/Notes>/g, '<Notes>0</Notes>')
    .replace(/<Slides>\d+<\/Slides>/g, `<Slides>${slideCount}</Slides>`);
  if (cleanedAppXml !== appXml) zip.file(appPath, cleanedAppXml);
}

async function ensurePresentationNotesSize(zip) {
  const presentationPath = 'ppt/presentation.xml';
  if (!zip.files[presentationPath]) return;

  const presentationXml = await zip.files[presentationPath].async('string');
  if (/<p:notesSz\b/.test(presentationXml)) return;

  const notesSizeXml = '<p:notesSz cx="6858000" cy="9144000"/>';
  let fixedPresentationXml = presentationXml;
  if (/<p:defaultTextStyle\b/.test(fixedPresentationXml)) {
    fixedPresentationXml = fixedPresentationXml.replace(/<p:defaultTextStyle\b/, `${notesSizeXml}<p:defaultTextStyle`);
  } else {
    fixedPresentationXml = fixedPresentationXml.replace(/<\/p:presentation>\s*$/, `${notesSizeXml}</p:presentation>`);
  }

  if (fixedPresentationXml !== presentationXml) {
    zip.file(presentationPath, fixedPresentationXml);
    console.warn('[PPTX Template] Restored required presentation notes size');
  }
}

async function sanitizePptxZipForPowerPoint(zip, label = 'presentation') {
  await removeOptionalPowerPointSidecars(zip);
  await sanitizeAppProperties(zip);
  await ensureZipMediaContentTypes(zip, label);

  Object.keys(zip.files)
    .filter(path => /^ppt\/notes(?:Masters|Slides)\//.test(path))
    .forEach(path => zip.remove(path));

  const presentationRelsPath = 'ppt/_rels/presentation.xml.rels';
  if (zip.files[presentationRelsPath]) {
    const relsXml = await zip.files[presentationRelsPath].async('string');
    const cleanedRelsXml = relsXml.replace(/<Relationship[^>]*Type="[^"]*\/notesMaster"[^>]*\/>/g, '');
    if (cleanedRelsXml !== relsXml) zip.file(presentationRelsPath, cleanedRelsXml);
  }

  const presentationPath = 'ppt/presentation.xml';
  if (zip.files[presentationPath]) {
    const presentationXml = await zip.files[presentationPath].async('string');
    const cleanedPresentationXml = presentationXml
      .replace(/<p:notesMasterIdLst\b[\s\S]*?<\/p:notesMasterIdLst>/g, '');
    if (cleanedPresentationXml !== presentationXml) zip.file(presentationPath, cleanedPresentationXml);
  }

  await ensurePresentationNotesSize(zip);

  const contentTypesPath = '[Content_Types].xml';
  if (zip.files[contentTypesPath]) {
    const ctXml = await zip.files[contentTypesPath].async('string');
    const cleanedCtXml = ctXml
      .replace(/<Override[^>]*PartName="\/ppt\/notesMasters\/notesMaster\d+\.xml"[^>]*\/>/g, '')
      .replace(/<Override[^>]*PartName="\/ppt\/notesSlides\/notesSlide\d+\.xml"[^>]*\/>/g, '');
    if (cleanedCtXml !== ctXml) zip.file(contentTypesPath, cleanedCtXml);
  }
  await sanitizeContentTypesForExistingParts(zip, label);

  const pptXmlFiles = Object.keys(zip.files)
    .filter(f => /^ppt\/.+\.xml$/.test(f))
    .sort((a, b) => {
      const rank = path => /^ppt\/slides\/slide\d+\.xml$/.test(path) ? 0 : 1;
      return rank(a) - rank(b) || a.localeCompare(b);
    });

  for (const xmlPath of pptXmlFiles) {
    const xml = await zip.files[xmlPath].async('string');
    let fixed = sanitizeSlideXmlForPowerPoint(xml, xmlPath);
    // Master/layout add-in OLE objects (e.g. think-cell) trigger PowerPoint
    // "repair" once the deck is rebuilt by tooling -- strip them defensively.
    if (/^ppt\/slide(?:Masters|Layouts)\//.test(xmlPath)) {
      fixed = stripAddInOleGraphicFrames(fixed);
    }
    if (fixed !== xml) zip.file(xmlPath, fixed);

    const slideNum = xmlPath.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1];
    const relsPath = slideNum ? `ppt/slides/_rels/slide${slideNum}.xml.rels` : null;
    if (relsPath && zip.files[relsPath]) {
      const relsXml = await zip.files[relsPath].async('string');
      let cleanedRelsXml = relsXml.replace(/<Relationship[^>]*Type="[^"]*\/notesSlide"[^>]*\/>/g, '');
      const usedRelationshipIds = new Set((fixed.match(/r:embed="([^"]+)"|r:link="([^"]+)"/g) || [])
        .map(match => match.match(/="([^"]+)"/)?.[1])
        .filter(Boolean));
      cleanedRelsXml = cleanedRelsXml.replace(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Type="[^"]*\/image"[^>]*\/>/g, (match, id) => (
        usedRelationshipIds.has(id) ? match : ''
      ));
      if (cleanedRelsXml !== relsXml) zip.file(relsPath, cleanedRelsXml);
    }
  }

  console.log('[PPTX Template] PowerPoint sanitation complete for %s (%d ppt XML part(s))', label, pptXmlFiles.length);
  return zip;
}

export async function sanitizePptxBufferForPowerPoint(buffer, label = 'presentation') {
  const zip = await JSZip.loadAsync(buffer);
  await sanitizePptxZipForPowerPoint(zip, label);
  return zip.generateAsync({ type: 'arraybuffer' });
}

export async function applyProfileChromeToGenerated(generatedBuf, chrome = null, options = {}) {
  console.log('[PPTX Template] Applying controlled profile chrome. Generated:', generatedBuf.byteLength, 'bytes');
  const genZip = await JSZip.loadAsync(generatedBuf);
  const profile = options.profile || (options.profileId ? getClientDesignProfile(options.profileId) : null);
  await copyTemplateThemeToGenerated(genZip, options.templateData);
  await applyProfileThemeToGenerated(genZip, profile);
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
    slideXml = applyMasterShapeVisibility(injectSlideBackground(slideXml, profile), profile);
    slideXml = stripNeomFooterActivationText(slideXml, profile);
    slideXml = stripTopBandPicturesFromSlideXml(slideXml, profile);
    if (profile?.id === 'mos') {
      slideXml = injectMoSFooterChrome(slideXml, hasLogo ? chrome.logo : null, LOGO_RID, slideNum);
    } else if (hasLogo) {
      slideXml = injectLogoPic(slideXml, chrome.logo, LOGO_RID);
    }
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

  await sanitizePptxZipForPowerPoint(genZip, 'profile chrome export');
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
async function pickBestLayout(tplZip, profile = null) {
  const layoutFiles = Object.keys(tplZip.files)
    .filter(f => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/(\d+)/g).pop()) - parseInt(b.match(/(\d+)/g).pop()));

  if (profile?.id === 'neom') {
    for (const path of layoutFiles) {
      const xml = await tplZip.files[path].async('string');
      const name = xml.match(/<p:cSld\s+name="([^"]+)"/)?.[1] || '';
      if (/content\s+1\s+col,\s*white/i.test(name)) {
        const idx = parseInt(path.match(/slideLayout(\d+)/)[1], 10);
        console.log('[PPTX Template] NEOM: using layout "%s" (%d) to avoid title-only header logos', name, idx);
        return idx;
      }
    }
  }

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
export async function applyTemplateToGenerated(generatedBuf, templateBuf, chrome = null, options = {}) {
  console.log('[PPTX Template] Starting merge. Generated:', generatedBuf.byteLength, 'bytes, Template:', templateBuf.byteLength, 'bytes');

  const tplZip = await JSZip.loadAsync(templateBuf);
  const genZip = await JSZip.loadAsync(generatedBuf);
  const preserveTemplateChrome = options.preserveTemplateChrome === true;
  const coverSlideNumbers = options.coverSlideNumbers || [];
  const profile = options.profile || (options.profileId ? getClientDesignProfile(options.profileId) : null);

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

  await sanitizeNeomTemplatePackage(tplZip, profile);

  // ── Step 3: Determine target slide layout from template ─────────────────
  const targetLayoutNum = await pickBestLayout(tplZip, profile);
  console.log('[PPTX Template] Using slideLayout' + targetLayoutNum);

  const targetLayoutPath = `ppt/slideLayouts/slideLayout${targetLayoutNum}.xml`;
  const targetLayoutRelsPath = `ppt/slideLayouts/_rels/slideLayout${targetLayoutNum}.xml.rels`;
  if (!preserveTemplateChrome && tplZip.files[targetLayoutPath]) {
    const layoutXml = await tplZip.files[targetLayoutPath].async('string');
    tplZip.file(targetLayoutPath, stripLayoutChrome(layoutXml));
    console.log('[PPTX Template] Stripped visible chrome from slideLayout' + targetLayoutNum);
  }
  if (!preserveTemplateChrome && tplZip.files[targetLayoutRelsPath]) {
    const layoutRelsXml = await tplZip.files[targetLayoutRelsPath].async('string');
    tplZip.file(targetLayoutRelsPath, stripUnusedLayoutChromeRelationships(layoutRelsXml));
  }

  // ── Step 4a: Write logo media file if chrome provides one ───────────────
  const LOGO_RID = 'rId900';
  const ICON_RID = 'rId901';
  const logoMediaExt = String(chrome?.logo?.mediaPath || '').split('.').pop()?.toLowerCase() || 'png';
  const safeLogoExt = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'emf', 'wmf'].includes(logoMediaExt) ? logoMediaExt : 'png';
  const LOGO_MEDIA = `ppt/media/logo_chrome.${safeLogoExt}`;
  const LOGO_TARGET = `../media/logo_chrome.${safeLogoExt}`;
  const ICON_MEDIA = 'ppt/media/logo_icon_chrome.jpeg';
  const ICON_TARGET = '../media/logo_icon_chrome.jpeg';
  let hasLogo = false;
  let hasIcon = false;
  const neomPositions = chrome?.positions || profile?.chrome?.positions || null;
  const neomLogoRect = neomPositions?.logo && chrome?.logo
    ? { ...neomPositions.logo, image: chrome.logo.image }
    : null;
  const neomIconRect = neomPositions?.logoIcon && chrome?.iconLogo?.image
    ? { ...neomPositions.logoIcon, image: chrome.iconLogo.image }
    : null;

  if (!preserveTemplateChrome && chrome?.logo?.image) {
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

  if (!preserveTemplateChrome && profile?.id === 'neom' && chrome?.iconLogo?.image) {
    try {
      const base64 = String(chrome.iconLogo.image).split(',')[1];
      if (base64) {
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        tplZip.file(ICON_MEDIA, binary);
        hasIcon = true;
        console.log('[PPTX Template] Wrote NEOM icon media file (%d bytes)', binary.length);
      }
    } catch (e) {
      console.warn('[PPTX Template] NEOM icon media write failed:', e.message);
    }
  }

  // ── Step 4b: Copy generated slides into template ───────────────────────
  for (let i = 0; i < slideCount; i++) {
    const slideNum = i + 1;
    const genSlidePath = `ppt/slides/slide${slideNum}.xml`;
    const genSlideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    if (genZip.files[genSlidePath]) {
      let slideXml = await genZip.files[genSlidePath].async('string');
      if (!preserveTemplateChrome) slideXml = applyMasterShapeVisibility(slideXml, profile);
      slideXml = injectSlideBackground(slideXml, profile);
      slideXml = stripNeomFooterActivationText(slideXml, profile);
      slideXml = stripNeomFooterPageNumbers(slideXml, profile);
      slideXml = stripTopBandPicturesFromSlideXml(slideXml, profile);
      if (profile?.id === 'mos') {
        slideXml = injectMoSFooterChrome(slideXml, hasLogo ? chrome.logo : null, LOGO_RID, slideNum);
      } else if (profile?.id === 'neom') {
        slideXml = injectNeomFooterChrome(
          slideXml,
          hasLogo ? neomLogoRect : null,
          hasIcon ? neomIconRect : null,
          LOGO_RID,
          hasIcon ? ICON_RID : null,
          neomPositions,
          coverSlideNumbers.includes(slideNum),
        );
      } else if (hasLogo) {
        slideXml = injectLogoPic(slideXml, chrome.logo, LOGO_RID);
      }
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
        genRelsXml = addLogoRelationship(genRelsXml, LOGO_RID, LOGO_TARGET);
      }
      if (hasIcon) {
        genRelsXml = addLogoRelationship(genRelsXml, ICON_RID, ICON_TARGET);
      }
      tplZip.file(genSlideRelsPath, genRelsXml);
    } else {
      let slideRel = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${targetLayoutNum}.xml"/>`;
      if (hasLogo) {
        slideRel += `\n  <Relationship Id="${LOGO_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${LOGO_TARGET}"/>`;
      }
      if (hasIcon) {
        slideRel += `\n  <Relationship Id="${ICON_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${ICON_TARGET}"/>`;
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
    presXml = stripPresentationSections(presXml, profile);

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
  await ensureZipMediaContentTypes(tplZip, 'template merge media');

  // ── Done: produce final arraybuffer ─────────────────────────────────────
  await sanitizePptxZipForPowerPoint(tplZip, 'template merge export');
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
