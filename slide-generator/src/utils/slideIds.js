const SLIDE_ID_PREFIX = 's_';
let slideIdCounter = 0;

function randomBase36(length = 8) {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, b => (b % 36).toString(36)).join('');
  }
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, '0');
}

export function generateSlideId(existingIds = []) {
  const existing = existingIds instanceof Set ? existingIds : new Set(existingIds.filter(Boolean));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    slideIdCounter = (slideIdCounter + 1) % 1296;
    const counter = slideIdCounter.toString(36).padStart(2, '0');
    const id = `${SLIDE_ID_PREFIX}${Date.now().toString(36)}${counter}${randomBase36(5)}`;
    if (!existing.has(id)) return id;
  }
  return `${SLIDE_ID_PREFIX}${Date.now().toString(36)}${randomBase36(10)}`;
}

export function formatSlideDebugId(id) {
  if (!id) return '';
  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}
