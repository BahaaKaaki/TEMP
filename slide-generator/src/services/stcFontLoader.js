import { authFetch } from './authFetch';

const STC_FONT_FACES = [
  { file: 'STCForward-Regular.ttf', weight: '400' },
  { file: 'STCForward-Medium.ttf', weight: '500' },
  { file: 'STCForward-Bold.ttf', weight: '700' },
];

let loadPromise = null;

export function loadStcForwardFonts() {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) {
    return Promise.resolve(false);
  }
  if (loadPromise) return loadPromise;

  loadPromise = Promise.all(
    STC_FONT_FACES.map(async ({ file, weight }) => {
      const res = await authFetch(`/api/assets/fonts/stc-forward/${file}`);
      if (!res.ok) throw new Error(`Failed to load ${file}: HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const face = new FontFace('STC Forward', buffer, {
        weight,
        style: 'normal',
        display: 'swap',
      });
      const loaded = await face.load();
      document.fonts.add(loaded);
      return loaded;
    })
  )
    .then(() => {
      console.log('[Fonts] STC Forward loaded from backend assets');
      return true;
    })
    .catch((err) => {
      console.warn('[Fonts] STC Forward could not be loaded:', err.message);
      loadPromise = null;
      return false;
    });

  return loadPromise;
}
