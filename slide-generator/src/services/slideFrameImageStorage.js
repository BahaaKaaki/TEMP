/**
 * Persist slide frame data-URIs in IndexedDB so localStorage stays under quota.
 * Placeholders in saved HTML: [edwin-frame-image:{slideId}]
 */

const DB_NAME = 'edwin-slide-frame-images';
const DB_STORE = 'frames';
const PLACEHOLDER_PREFIX = '[edwin-frame-image:';

export function frameImagePlaceholder(slideId) {
  return `${PLACEHOLDER_PREFIX}${slideId}]`;
}

export function slideHtmlHasFrameImagePlaceholder(html) {
  return typeof html === 'string' && html.includes(PLACEHOLDER_PREFIX);
}

function extractDataUriFromHtml(html) {
  if (!html) return null;
  const m = html.match(/src=["'](data:image\/[^"']+)["']/);
  return m ? m[1] : null;
}

function stripDataUrisFromHtml(html, slideId) {
  if (!html || !slideId) return html;
  const ph = frameImagePlaceholder(slideId);
  return html
    .replace(/src=["']data:image\/[^"']+["']/gi, (match) => {
      const q = match.includes('"') ? '"' : "'";
      return `src=${q}${ph}${q}`;
    })
    .replace(/url\(\s*data:image\/[^)]+\)/gi, `url(${ph})`);
}

function restoreDataUrisInHtml(html, slideId, dataUri) {
  if (!html || !slideId || !dataUri) return html;
  const ph = frameImagePlaceholder(slideId);
  return html
    .split(`src="${ph}"`).join(`src="${dataUri}"`)
    .split(`src='${ph}'`).join(`src='${dataUri}'`)
    .split(`url(${ph})`).join(`url(${dataUri})`);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putFrameImage(slideId, dataUri) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put({ dataUri, savedAt: Date.now() }, slideId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getFrameImage(slideId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(slideId);
    req.onsuccess = () => resolve(req.result?.dataUri || null);
    req.onerror = () => reject(req.error);
  });
}

/** Strip base64 from slides for localStorage; store blobs in IndexedDB. */
export async function prepareSlidesForLocalStorage(slides = []) {
  if (typeof indexedDB === 'undefined') return slides;
  const out = [];
  for (const slide of slides) {
    const dataUri = extractDataUriFromHtml(slide?.html);
    if (dataUri && slide?.id) {
      try {
        await putFrameImage(slide.id, dataUri);
      } catch (e) {
        console.warn('[FrameImageStorage] Failed to persist frame for slide %s: %s', slide.id, e.message);
      }
      out.push({ ...slide, html: stripDataUrisFromHtml(slide.html, slide.id) });
    } else {
      out.push(slide);
    }
  }
  return out;
}

/** Restore frame images after loading from localStorage. */
export async function hydrateSlidesFromLocalStorage(slides = []) {
  if (typeof indexedDB === 'undefined') return slides;
  const out = [];
  for (const slide of slides) {
    if (!slideHtmlHasFrameImagePlaceholder(slide?.html) || !slide?.id) {
      out.push(slide);
      continue;
    }
    try {
      const dataUri = await getFrameImage(slide.id);
      if (dataUri) {
        out.push({ ...slide, html: restoreDataUrisInHtml(slide.html, slide.id, dataUri) });
      } else {
        console.warn('[FrameImageStorage] Missing IndexedDB frame for slide %s', slide.id);
        out.push(slide);
      }
    } catch (e) {
      console.warn('[FrameImageStorage] Hydrate failed for slide %s: %s', slide.id, e.message);
      out.push(slide);
    }
  }
  return out;
}

export async function deleteFrameImage(slideId) {
  if (!slideId || typeof indexedDB === 'undefined') return;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(slideId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
