import { authFetch } from './authFetch';

const STC_FONT_FACES = [
  { file: 'STCForward-Regular.ttf', family: 'STC Forward', weight: '400', route: 'stc-forward' },
  { file: 'STCForward-Medium.ttf', family: 'STC Forward', weight: '500', route: 'stc-forward' },
  { file: 'STCForward-Bold.ttf', family: 'STC Forward', weight: '700', route: 'stc-forward' },
];

const PIF_FONT_FACES = [
  { file: 'Fund-Light.ttf', family: 'Fund Light', weight: '400', route: 'pif-fund' },
  { file: 'Fund-Regular.ttf', family: 'Fund Regular', weight: '400', route: 'pif-fund' },
  { file: 'Fund-Medium.ttf', family: 'Fund Med', weight: '500', route: 'pif-fund' },
  { file: 'Fund-SemiBold.ttf', family: 'Fund SemBd', weight: '600', route: 'pif-fund' },
];

let stcLoadPromise = null;
let pifLoadPromise = null;

function loadFontFaces(fontFaces, label) {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) {
    return Promise.resolve(false);
  }

  return Promise.all(
    fontFaces.map(async ({ file, family, weight, route }) => {
      const res = await authFetch(`/api/assets/fonts/${route}/${file}`);
      if (!res.ok) throw new Error(`Failed to load ${file}: HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const face = new FontFace(family, buffer, {
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
      console.log('[Fonts] %s loaded from backend assets', label);
      return true;
    });
}

export function loadStcForwardFonts() {
  if (stcLoadPromise) return stcLoadPromise;

  stcLoadPromise = loadFontFaces(STC_FONT_FACES, 'STC Forward')
    .catch((err) => {
      console.warn('[Fonts] STC Forward could not be loaded:', err.message);
      stcLoadPromise = null;
      return false;
    });

  return stcLoadPromise;
}

export function loadPifFundFonts() {
  if (pifLoadPromise) return pifLoadPromise;

  pifLoadPromise = loadFontFaces(PIF_FONT_FACES, 'PIF Fund fonts')
    .catch((err) => {
      console.warn('[Fonts] PIF Fund fonts could not be loaded:', err.message);
      pifLoadPromise = null;
      return false;
    });

  return pifLoadPromise;
}

export function loadClientProfileFonts(profileId) {
  if (profileId === 'stc') return loadStcForwardFonts();
  if (profileId === 'pif') return loadPifFundFonts();
  return Promise.resolve(false);
}
