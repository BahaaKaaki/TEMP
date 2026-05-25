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

export function extractFrameImageDataUriFromHtml(html) {
  if (!html) return null;
  const m = html.match(/src=["'](data:image\/[^"']+)["']/);
  return m ? m[1] : null;
}

function extractDataUriFromHtml(html) {
  return extractFrameImageDataUriFromHtml(html);
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

/** Write frame blob to IndexedDB as soon as an image is generated (before debounced localStorage save). */
export async function persistFrameImageForSlide(slideId, dataUri) {
  if (!slideId || !dataUri?.startsWith('data:image/') || typeof indexedDB === 'undefined') return;
  try {
    await putFrameImage(slideId, dataUri);
  } catch (e) {
    console.warn('[FrameImageStorage] Failed to persist frame for slide %s: %s', slideId, e.message);
  }
}

/** Inline data URI in HTML, or load from IndexedDB when HTML uses a placeholder. */
export async function resolveFrameImageDataUri(slide) {
  const html = slide?.html || '';
  const inline = extractDataUriFromHtml(html);
  if (inline) return inline;
  if (!slide?.id || !slideHtmlHasFrameImagePlaceholder(html)) return null;
  try {
    return await getFrameImage(slide.id);
  } catch (e) {
    console.warn('[FrameImageStorage] resolve failed for slide %s: %s', slide.id, e.message);
    return null;
  }
}

/** Restore slide HTML with frame images for export/preview when only placeholders are stored. */
export async function resolveSlideHtmlFrameImages(slide) {
  if (!slide?.html || !slide?.id) return slide;
  const dataUri = await resolveFrameImageDataUri(slide);
  if (!dataUri || extractDataUriFromHtml(slide.html)) return slide;
  return { ...slide, html: restoreDataUrisInHtml(slide.html, slide.id, dataUri) };
}

export async function resolveSlidesHtmlFrameImages(slides = []) {
  return Promise.all(slides.map((s) => resolveSlideHtmlFrameImages(s)));
}

/** Synchronous strip for beforeunload (IndexedDB should already be populated). */
export function stripSlidesFrameImagesForUnload(slides = []) {
  return slides.map((slide) => {
    const dataUri = extractDataUriFromHtml(slide?.html);
    if (dataUri && slide?.id) {
      void persistFrameImageForSlide(slide.id, dataUri);
      return { ...slide, html: stripDataUrisFromHtml(slide.html, slide.id) };
    }
    return slide;
  });
}

/** Strip base64 from slides for localStorage; store blobs in IndexedDB. */
export async function prepareSlidesForLocalStorage(slides = []) {
  if (typeof indexedDB === 'undefined') return slides;
  const out = [];
  for (const slide of slides) {
    const dataUri = extractDataUriFromHtml(slide?.html);
    if (dataUri && slide?.id) {
      await persistFrameImageForSlide(slide.id, dataUri);
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
