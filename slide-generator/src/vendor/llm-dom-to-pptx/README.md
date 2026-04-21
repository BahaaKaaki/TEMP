# llm-dom-to-pptx (vendored)

Vendored from npm package `llm-dom-to-pptx@1.2.7` (Jan 2026, MIT, see `LICENSE`).
Upstream ships only a minified dist (no GitHub source repo is published).

## Why vendored

1. The upstream dist is an IIFE that expects `window.PptxGenJS` provided by a
   `<script>` tag. We consume via Vite/ESM, so we inject PptxGenJS from the
   module we already depend on.
2. The upstream dist hardcodes `LAYOUT_16x9` (10 x 5.625 in). We need widescreen
   (13.333 x 7.5 in) to match `slide-generator` conventions.
3. We want an ESM wrapper function rather than relying on a global.

## Files

- `llm-dom-to-pptx.js` - the upstream dist verbatim, with the three patches listed below. Exports `exportLlmDomToPptx(selectorOrEl, options)`.
- `System_Prompt.md` - upstream system prompt (reference only; we do not use it).
- `LICENSE` - upstream MIT license.

## Local patches vs upstream dist

1. Prepended `import PptxGenJSModule from "pptxgenjs"` and assigned it to
   `window.PptxGenJS` so the IIFE's lookup succeeds without a CDN tag.
2. Changed `CONFIG.PPT_WIDTH_IN` / `PPT_HEIGHT_IN` from `10 / 5.625` to
   `13.333 / 7.5`.
3. Changed `pres.layout = 'LAYOUT_16x9'` to explicit `defineLayout` +
   `pres.layout = 'CUSTOM_WIDE'`.
4. Appended an ESM `exportLlmDomToPptx` named export.

Running `git diff` against the upstream file will show exactly these edits.

## Supported (vs html-to-pptx)

- CSS linear gradients -> rasterized PNG background.
- Box shadows -> mapped to PPTX shadow objects.
- Inline `<svg>` -> rasterized via XMLSerializer + canvas.
- Speaker notes via `data-speaker-notes` attribute (`\n` for newlines).
- Font simulation (swaps Inter/Roboto/etc. to PPTX-safe Arial/Calibri before
  measuring to reduce line-wrap drift).

## Not supported / known gaps (vs html-to-pptx)

- No `<table>` rowspan/colspan native mapping (treated as regular shapes).
- No native `addChart` support.
- Root container must be 960px wide (or a multiple) for coordinate math.
