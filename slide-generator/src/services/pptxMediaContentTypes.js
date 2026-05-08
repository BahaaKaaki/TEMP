import JSZip from 'jszip';

const MEDIA_CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

export function ensureMediaContentType(contentTypesXml, ext) {
  const safeExt = String(ext || '').trim().replace(/^\./, '').toLowerCase();
  if (!contentTypesXml || !safeExt) return contentTypesXml;
  if (new RegExp(`<Default\\b[^>]*Extension="${safeExt}"`, 'i').test(contentTypesXml)) return contentTypesXml;
  const contentType = MEDIA_CONTENT_TYPES[safeExt] || `image/${safeExt}`;
  return contentTypesXml.replace('</Types>', `<Default Extension="${safeExt}" ContentType="${contentType}"/></Types>`);
}

export function getMediaExtensionsFromZip(zip) {
  return [...new Set(Object.keys(zip.files)
    .filter(path => path.startsWith('ppt/media/') && !zip.files[path]?.dir)
    .map(path => path.split('/').pop()?.split('.').pop()?.toLowerCase())
    .filter(Boolean))].sort();
}

export function getContentTypeDefaults(contentTypesXml) {
  const defaults = new Set();
  const re = /<Default\b[^>]*Extension="([^"]+)"/gi;
  let match;
  while ((match = re.exec(contentTypesXml || '')) !== null) {
    defaults.add(match[1].toLowerCase());
  }
  return defaults;
}

export function findMissingMediaContentTypes(zip, contentTypesXml) {
  const defaults = getContentTypeDefaults(contentTypesXml);
  return getMediaExtensionsFromZip(zip).filter(ext => !defaults.has(ext));
}

export async function ensureZipMediaContentTypes(zip, label = 'presentation') {
  const ctPath = '[Content_Types].xml';
  if (!zip.files[ctPath]) return [];

  let contentTypesXml = await zip.files[ctPath].async('string');
  const missing = findMissingMediaContentTypes(zip, contentTypesXml);
  if (missing.length === 0) return [];

  for (const ext of missing) {
    contentTypesXml = ensureMediaContentType(contentTypesXml, ext);
  }
  zip.file(ctPath, contentTypesXml);
  console.warn('[PPTX Template] Added missing media content type(s) for %s: %s', label, missing.join(', '));
  return missing;
}

export async function getPptxMediaContentTypeDiagnostics(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const ctPath = '[Content_Types].xml';
  const contentTypesXml = zip.files[ctPath] ? await zip.files[ctPath].async('string') : '';
  const mediaExtensions = getMediaExtensionsFromZip(zip);
  const missingMediaContentTypes = findMissingMediaContentTypes(zip, contentTypesXml);
  return {
    ok: missingMediaContentTypes.length === 0,
    mediaExtensions,
    missingMediaContentTypes,
  };
}
