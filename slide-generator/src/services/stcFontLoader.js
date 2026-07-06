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

const DGE_FONT_FACES = [
  { file: 'NotoSans-Light.ttf', family: 'Noto Sans', weight: '300', route: 'dge-noto' },
  { file: 'NotoSans-Regular.ttf', family: 'Noto Sans', weight: '400', route: 'dge-noto' },
  { file: 'NotoSans-Medium.ttf', family: 'Noto Sans', weight: '500', route: 'dge-noto' },
  { file: 'NotoSans-SemiBold.ttf', family: 'Noto Sans', weight: '600', route: 'dge-noto' },
  { file: 'NotoSans-Bold.ttf', family: 'Noto Sans', weight: '700', route: 'dge-noto' },
];

const SE_FONT_FACES = [
  { file: 'SE-Regular.ttf', family: 'SE', weight: '400', route: 'se' },
  { file: 'SE-Medium.ttf', family: 'SE Medium', weight: '500', route: 'se' },
  { file: 'SE-SemiBold.ttf', family: 'SE', weight: '600', route: 'se' },
  { file: 'SE-Bold.ttf', family: 'SE', weight: '700', route: 'se' },
];

// Remat: SST Arabic Roman is the standard face; Light for lighter weights.
// Alias the bare "SST Arabic" family (used by the bundled master) to Roman.
const SST_ARABIC_FONT_FACES = [
  { file: 'SST-Arabic-Light.ttf', family: 'SST Arabic Light', weight: '300', route: 'sst-arabic' },
  { file: 'SST-Arabic-Roman.ttf', family: 'SST Arabic Roman', weight: '400', route: 'sst-arabic' },
  { file: 'SST-Arabic-Roman.ttf', family: 'SST Arabic', weight: '400', route: 'sst-arabic' },
  { file: 'SST-Arabic-Roman.ttf', family: 'SST Arabic Roman', weight: '700', route: 'sst-arabic' },
];

let stcLoadPromise = null;
let pifLoadPromise = null;
let dgeLoadPromise = null;
let seLoadPromise = null;
let sstArabicLoadPromise = null;

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

export function loadDgeNotoFonts() {
  if (dgeLoadPromise) return dgeLoadPromise;

  dgeLoadPromise = loadFontFaces(DGE_FONT_FACES, 'DGE Noto Sans')
    .catch((err) => {
      console.warn('[Fonts] DGE Noto Sans could not be loaded:', err.message);
      dgeLoadPromise = null;
      return false;
    });

  return dgeLoadPromise;
}

export function loadSeFonts() {
  if (seLoadPromise) return seLoadPromise;

  seLoadPromise = loadFontFaces(SE_FONT_FACES, 'SE')
    .catch((err) => {
      console.warn('[Fonts] SE fonts could not be loaded:', err.message);
      seLoadPromise = null;
      return false;
    });

  return seLoadPromise;
}

export function loadSstArabicFonts() {
  if (sstArabicLoadPromise) return sstArabicLoadPromise;

  sstArabicLoadPromise = loadFontFaces(SST_ARABIC_FONT_FACES, 'SST Arabic')
    .catch((err) => {
      console.warn('[Fonts] SST Arabic fonts could not be loaded:', err.message);
      sstArabicLoadPromise = null;
      return false;
    });

  return sstArabicLoadPromise;
}

export function loadClientProfileFonts(profileId) {
  if (profileId === 'stc') return loadStcForwardFonts();
  if (profileId === 'pif' || profileId === 'tdredc') return loadPifFundFonts();
  if (profileId === 'dge') return loadDgeNotoFonts();
  if (profileId === 'se') return loadSeFonts();
  if (profileId === 'remat') return loadSstArabicFonts();
  return Promise.resolve(false);
}
