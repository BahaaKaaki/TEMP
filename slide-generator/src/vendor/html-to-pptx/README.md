# html-to-pptx (vendored)

Vendored from [joker-duzhong/html-to-pptx](https://github.com/joker-duzhong/html-to-pptx)
at `main` branch (npm v1.1.0, Dec 2025). MIT licensed (see `LICENSE`).

## Why vendored

1. We need to patch the hardcoded `LAYOUT_16x9` layout to widescreen
   `LAYOUT_WIDE` (13.333 x 7.5 in) to match `slide-generator` conventions.
2. We need to accept an externally-created `PptxGenJS` instance so the caller
   can pre-configure slide masters / default footers / themes.
3. Local visibility into the renderer logic while we iterate on fidelity.

## Files

- `analyze.js` - DOM walker and per-element PPTX emitter. Main entry: `html2pptx(pageClass, options)`.
- `styleTransform.js` - CSS computed style -> PPTX shape/text descriptor mapper.
- `animationTransform.js` - CSS animation name / `data-pptx-animation` -> PPTX animation mapper.
- `index.js` - Convenience wrappers: `exportHtmlToPpt(class, outputType, options)` and `downloadHtmlToPpt(class, fileName, options)`.

## Local patches vs upstream

- Converted TypeScript to JavaScript (types stripped; behavior unchanged).
- `html2pptx(pageClass, options)` - new `options` arg accepts:
  - `pptx` - existing PptxGenJS instance (layout/master preserved).
  - `layout` - layout name, default `"LAYOUT_WIDE"`.
  - `width`, `height` - in inches, default `13.333 x 7.5`.
- Default `headFontFace: "黑体"` (Chinese heading font) is no longer set.

## Supported

Native text boxes (per text node via `Range.getBoundingClientRect()`), solid
fills, borders, border-radius (auto rect/roundRect/ellipse), rotation (from
matrix), opacity / transparency, native tables with rowspan/colspan, native
charts via `data-pptx-chart-config`, images, canvas rasterization, CSS animation
mapping.

## Not supported (known gaps)

- CSS linear/radial gradients (solid background-color only).
- Box shadows.
- Inline `<svg>` (skipped).
- Pseudo-elements (`::before`, `::after`).
- CSS transform scale / translate (rotation only).
- `clip-path`, filters, masks.
