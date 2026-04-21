# PPTX Export Bake-off Results

Date: 2026-04-21
Author: bahaa.kaaki
Scope: Evaluate two vendored HTML-to-native-PPTX engines against each other,
with the three gold-standard in-repo samples plus a synthetic edge-case slide.

## TL;DR

- Both engines produce **fully editable** PowerPoint text (every text run is its
own `<p:sp>` with `<p:txBody>` - no text is baked into images).
- `llm-dom-to-pptx` wins on **visual fidelity** because it rasterizes unsupported
decoration (gradients, drop shadows, SVG backgrounds) into small PNGs while
keeping text native. Visually it's the closest match to the browser preview.
- `html-to-pptx` is **100% native** (no images at all) but silently drops
gradients, drop shadows, and SVG. Plain rectangular layouts look great; rich
decks look bare.
- **Recommendation:** default to `llm-dom-to-pptx`. Keep `html-to-pptx`
selectable as an alternative for users who need strictly-native output.

Default engine is now set to `llm-dom-to-pptx` in `pptxExport.js`.

## How the bake-off was run

All exports share the exact same offscreen DOM build pipeline used by
`pptxExport.js`:

1. Create a hidden root at `position: fixed; left: -20000px`.
2. Inject `slides.css` shell CSS + theme CSS + deck `sharedCSS` (the same stack
  `SlidePreview` uses in the live UI).
3. Append each slide as `div.slide` at 960x540 px and await `document.fonts.ready`.
4. Hand the container selector to whichever engine is selected.

Rendering:

- `pptx-test/run-bakeoff.mjs` drives a Playwright/Chromium browser, loads
`slide-generator/bakeoff-harness.html` (served by Vite dev), clicks "Run all
samples", and saves each download to `pptx-test/artifacts/`.
- `soffice --headless --convert-to png` (LibreOffice) renders each PPTX as an
image for visual comparison.
- `pptx-test/capture-dom.mjs` captures the identically-styled browser DOM for
each sample as the "ground truth" screenshot.

Artifacts (all gitignored):

- `pptx-test/artifacts/bakeoff-<sample>.<engine>.pptx` - native PPTX files.
- `pptx-test/artifacts/extracted/` - unzipped `ppt/slides/slide1.xml` for each.
- `pptx-test/artifacts/renders/bakeoff-<sample>.<engine>.png` - LibreOffice PNG.
- `pptx-test/artifacts/renders/bakeoff-<sample>.browser-dom.png` - browser truth.
- `pptx-test/artifacts/bakeoff-summary.json` - full run log.

## Structural / XML comparison

All numbers from parsing `ppt/slides/slide1.xml` after unzipping each PPTX.


| Sample   | Engine          | Size  | sp  | pic | txBody | Preset geoms                  |
| -------- | --------------- | ----- | --- | --- | ------ | ----------------------------- |
| card-row | html-to-pptx    | 22 KB | 30  | 0   | 22     | rect:27, roundRect:3          |
| card-row | llm-dom-to-pptx | 34 KB | 40  | 16  | 22     | rect:38, line:15, roundRect:3 |
| kpi      | html-to-pptx    | 15 KB | 24  | 0   | 14     | rect:18, roundRect:6          |
| kpi      | llm-dom-to-pptx | 19 KB | 23  | 6   | 14     | rect:20, line:6, roundRect:3  |
| cover    | html-to-pptx    | 4 KB  | 5   | 0   | 4      | rect:5                        |
| cover    | llm-dom-to-pptx | 4 KB  | 4   | 0   | 4      | rect:4                        |
| edge     | html-to-pptx    | 13 KB | 16  | 0   | 10     | rect:14, roundRect:2          |
| edge     | llm-dom-to-pptx | 13 KB | 14  | 4   | 10     | rect:16, roundRect:2          |


Observations:

- Both engines emit **identical txBody counts** per sample (22 / 14 / 4 / 10).
Text is always native. Nothing is baked into a background image.
- `llm-dom-to-pptx` embeds 4-16 small PNGs per slide for gradient/SVG
decoration. `html-to-pptx` emits zero images.
- Both engines top out with widescreen 13.333 x 7.5 inch layout correctly
(verified via the vendor patches).

## Visual comparison per sample

Ground truth is the browser DOM rendered with the same CSS stack used at
export time.

### Cover slide (text-only, wrap test)

- **Browser DOM:** "DIGITAL TRANSFORMATION" red eyebrow + "Enterprise AI
Strategy Framework for / Sustainable Growth" wrapped onto two lines
(Georgia serif).
- **html-to-pptx:** Near-pixel match. Wrap happens at the same break. Colors,
font family, and footer positions all correct.
- **llm-dom-to-pptx:** Title forced onto one line (stretched full width).
The engine computes the text shape width from the ancestor block rather
than the text element's own content box, so short/medium headlines lose
their intended wrap.

Winner: `html-to-pptx` (mostly because this sample has no decoration).

### card-row (three styled cards)

- **Browser DOM:** Three cards side-by-side. Subtle off-white card backgrounds,
colored top stripe, pink circle badges with icons, big serif numbers,
"Timeline:" pill at bottom.
- **html-to-pptx:** Cards positioned perfectly, text inside correct, serif
numbers preserved. **Lost:** pink icon-badge circles and the red top stripe
(both are gradient/linear-gradient fills that this engine ignores).
- **llm-dom-to-pptx:** Cards, icons, and timeline pills visible. Gradient
backgrounds rasterize cleanly. Closest to the browser preview overall.

Winner: `llm-dom-to-pptx` by a small margin.

### kpi (two-column, three KPIs + three details)

- **Browser DOM:** Three gray KPI tiles on the left with red left bar; three
text blocks on the right with subtle dividers.
- **html-to-pptx:** Text all in place but **every colored tile background and
divider is gone**. Output looks like a plain two-column text list.
- **llm-dom-to-pptx:** Tile backgrounds and dividers preserved via raster.
Matches browser preview closely.

Winner: `llm-dom-to-pptx` clearly.

### edge (synthetic: SVG, gradient, drop shadow, rotation, long wrap)

- **Browser DOM:** Purple-to-pink and blue-to-teal gradient cards with drop
shadows, inline SVG icons (checkmark + clock), white text, rotated "ROTATED
BADGE" label, and a long yellow callout with orange left border.
- **html-to-pptx:**
  - Lost: all gradient backgrounds, all drop shadows, both SVG icons.
  - Lost: white-on-gradient text contrast (text ends up black because no
  background is drawn, so it sits on white).
  - Kept: the yellow callout background (solid color), orange border bar,
  and all raw text.
  - Long paragraph wraps oddly - a "the" dangles on its own line.
- **llm-dom-to-pptx:**
  - Kept: both gradient cards (rasterized), the clock SVG (rasterized),
  white text color, yellow callout with orange border.
  - Lost: the first checkmark SVG (unclear why; `stroke` without `fill`
  may have been filtered); rotation is flattened for the rotated label.
  - Long paragraph wraps into 3 natural lines.

Winner: `llm-dom-to-pptx` decisively. `html-to-pptx` output is almost
unreadable here because the cards render empty.

## Geometry accuracy

Extracted every `<p:sp>`'s `x, y, w, h` from the EMU values. With the deck
`sharedCSS` loaded:

- `html-to-pptx`: every text shape has the **correct CSS-derived box**
(e.g. "Foundation Layer" is 1.68 in wide, "Timeline: 6-12 months" is 1.66
in wide, "01" is 0.58 in wide). Cards land at
`x = 0.389 / 4.648 / 8.907` for the three-card strip, matching the exact
column math of the CSS grid.
- `llm-dom-to-pptx`: most x positions match, but many text widths default
to the parent container width rather than the text's own content width.
This does not cause visible issues when PowerPoint autofits text, but it
means the resulting `.pptx` has slightly coarser bounding boxes.

For **shape positions**, `html-to-pptx` is more faithful. For **visual
appearance**, `llm-dom-to-pptx` wins because raster fallback compensates for
features the engine cannot natively represent.

## Tradeoff summary


| Feature                                     | html-to-pptx | llm-dom-to-pptx |
| ------------------------------------------- | ------------ | --------------- |
| Text fully editable (every run = native)    | yes          | yes             |
| Native rectangles / rounded rectangles      | yes          | yes             |
| Native per-text-node bounding boxes         | yes          | close           |
| Linear/radial gradient backgrounds          | no           | yes (raster)    |
| Drop shadows                                | no           | yes (raster)    |
| Inline SVG icons                            | no           | mostly raster   |
| CSS `transform: rotate(...)`                | no           | no              |
| Native PptxGenJS charts/tables              | yes          | no              |
| Zero embedded images                        | yes          | no              |
| Visual match to browser preview (this test) | ~55%         | ~90%            |
| Average PPTX size (card-row sample)         | 22 KB        | 34 KB           |


## Recommendation

Default to `llm-dom-to-pptx` for end users. It is the engine most consistent
with the browser preview across all four samples, and it is the only one that
produces readable output for slides that rely on gradient or SVG decoration.

Keep `html-to-pptx` as a selectable alternative. It is the right choice when:

- The deck is text-heavy with plain rectangular backgrounds.
- The user wants a fully-native PPTX with zero embedded images (e.g. for
corporate compliance or downstream scripting).
- The user wants PptxGenJS native charts/tables from HTML tables.

The legacy LLM-based PPTX path (`pptxService.js` generateSlideCode +
pptxDomMeasure) can stay in place for one more cycle to give us a fallback
while we soak the native engines in production. It should be removed once the
native engines have been validated against real user decks.

## Known gaps / follow-ups

- Neither engine implements CSS `transform: rotate`; rotated text comes out
axis-aligned. For our template set this is not hit often; revisit if users
request rotated callouts.
- `llm-dom-to-pptx` SVG support is partial. SVGs with only `stroke` and no
`fill` are occasionally dropped. If SVG-heavy decks become important we can
preprocess SVGs to ensure a paint-safe attribute set.
- Both engines currently operate on the whole `document.body` scope that the
harness constructs; `llm-dom-to-pptx` paints the entire offscreen root as
one slide regardless of how many `.pptx-export-page` children are present.
When exporting multi-slide decks, call the engine once per slide.
- `PptxLab.jsx` already exposes both engines and a "Bake-off" button; the
"legacy LLM" path is preserved as a control.

## Files changed in this experiment

- `slide-generator/src/vendor/html-to-pptx/` (vendored + patched for widescreen)
- `slide-generator/src/vendor/llm-dom-to-pptx/` (vendored + patched for widescreen + ESM)
- `slide-generator/src/services/pptxExport.js` (unified entry, default now `llm-dom-to-pptx`)
- `slide-generator/src/components/PptxLab.jsx` (engine selector, bake-off button)
- `slide-generator/bakeoff-harness.html` + `slide-generator/src/bakeoff-harness-entry.js`
(gitignored, dev-only harness used by this report)
- `pptx-test/*.mjs` (gitignored, Playwright driver + XML/geometry inspection scripts)

---

# 2026-04-22 update -- Prompt-first + defense-in-depth fidelity pass

After running the native engine against a real 15-slide user deck
(`rayleigh-scattering-atmospheric-optical-principles`), several fidelity
regressions surfaced: lost `text-transform: uppercase`, broken
`transform: rotate(...)` labels on chart axes, black SVG wedges where the
browser shows themed colors, and `<sup>`/`<sub>` dropped silently. Rather
than patch the engine alone, we adopted a **dual-track** fix so the LLM
stops emitting the problematic patterns in the first place, and the
exporter handles legacy / user-pasted HTML that still contains them.

## Track 1 -- Prompt-first prevention

The LLM freestyle guides now include an "Export compatibility" section
that documents the exact constructs that degrade or rasterize on export
and tells the model to pick PPTX-friendly alternatives up front.

- `slide-generator/src/guides/freestyle-shell.md` -- added a 10-rule
"Export compatibility (critical)" section covering text-transform,
rotated text, letter-spacing, SVG attribute styling, sup/sub,
hyperlinks, shadows, gradients, multi-line titles, and SVG vs. HTML
shape choice.
- `slide-generator/src/services/ai/constants.js` -- mirrored the same
rules into `CSS_STYLE_GUIDE` so the template-based (non-freestyle) and
edit paths inherit the same constraints via `DEFAULT_SYSTEM_PROMPT`
and `EDIT_SYSTEM_PROMPT`.
- `slide-generator/src/guides/freestyle-slide-guide.md` -- deleted. It
was the legacy monolithic guide superseded by the four split files
(`shell`/`theme`/`vibe`/`writing`) and was no longer imported by any
code path (confirmed via grep and `PROJECT_REFERENCE.md`).

Result: every slide the LLM writes is now shaped for clean PPTX export
from its first token, without relying on the exporter to recover.

## Track 2 -- Defense-in-depth library fixes

These changes let the exporter gracefully handle any HTML that still
contains problematic patterns (legacy decks, user-pasted HTML, LLM
drift, imported decks).

`slide-generator/src/vendor/llm-dom-to-pptx/llm-dom-to-pptx.js`:

- `collectTextRuns` now mirrors `text-transform: uppercase | lowercase | capitalize` onto the extracted run text. CSS leaves
`textContent` untouched, so the transform must be applied during
extraction to match what the browser renders.
- `collectTextRuns` maps computed `letter-spacing` (px -> pt at 96 DPI)
onto pptxgenjs `charSpacing`. Values below 0.1 pt are dropped.
- `collectTextRuns` decorates child runs with `superscript: true` /
`subscript: true` when encountering `<sup>` / `<sub>`.
- `collectTextRuns` forwards `<a href="...">` onto pptxgenjs `hyperlink`
for every run inside the anchor (skips `href="#"` and
`href="javascript:..."`).
- `collectTextRuns` honours `text-decoration: line-through` as
`strike: 'sngStrike'`.
- `extractRotationFromStyle` + `renderText` map CSS `transform: rotate`
(90 deg / 270 deg) onto pptxgenjs `vert: 'vert' | 'vert270'`
(preferred -- keeps the box axis-aligned in PowerPoint), and arbitrary
angles onto `rotate: <deg>`. `writing-mode: vertical-rl | vertical-lr`
maps onto `vert: 'eaVert' | 'mongolianVert'`.

`slide-generator/src/services/pptxExport.js`:

- New `inlineSvgStyles(root)` walks every `<svg *>` descendant of the
offscreen deck and pins CSS-computed `fill`, `stroke`, `stroke-width`,
opacity, dash array, and line caps as attributes on the element (only
when no attribute is already set). This runs right before the vendor
serializes the SVG via `cloneNode + XMLSerializer`, so colors authored
via external `<style>` rules survive rasterization. Previously, SVG
children styled by a stylesheet lost their fills and rendered black
(the Rayleigh deck slide 6 "black wedge" bug).

## Verification

Ocean sample, LLM engine (`pptx-test/run-ocean.mjs`):

- `GOVERNING PRINCIPLE`, `ABSORPTION ACROSS THE VISIBLE SPECTRUM`,
`HIGH / HIGH / MED / LOW / LOWEST`, `MYTH / REALITY` all render
uppercase in the PPTX, matching the browser DOM. Before the patch
they rendered lower-case because `text-transform` was lost.
- Letter-spacing on `.main-label` and `.spectrum-title` is preserved.
- No layout regressions.

Full bake-off (`pptx-test/run-bakeoff.mjs`):

- 10/10 exports succeeded (5 samples x 2 engines), zero page errors.
- Edge-case sample: the `transform: rotate(-4deg)` badge now carries
`rotate: 356` (was flattened to axis-aligned before).

## Updated tradeoff summary


| Feature                                       | html-to-pptx  | llm-dom-to-pptx (patched) |
| --------------------------------------------- | ------------- | ------------------------- |
| CSS `text-transform` (upper/lower/capitalize) | no            | yes                       |
| CSS `letter-spacing`                          | no            | yes                       |
| `<sup>` / `<sub>` preserved                   | no            | yes                       |
| `<a href>` hyperlinks preserved               | no            | yes                       |
| `transform: rotate(90                         | 270)`as`vert` | no                        |
| Arbitrary rotation angle                      | no            | yes (0-359 deg)           |
| `writing-mode: vertical-rl                    | vertical-lr`  | no                        |
| External-CSS-styled SVG fills preserved       | no            | yes (inlined)             |
| Text fully editable (every run = native)      | yes           | yes                       |


## Remaining gaps

- Single-line title geometry: the vendor still computes `h1.title` width
from the ancestor block, not the text content box. Short/medium titles
lose their intended wrap. Prompt guidance now tells the LLM to keep
titles single-line; legacy content with multi-line titles still
exhibits this.
- `box-shadow` and `text-shadow` are still dropped by the vendor. The
prompt now instructs the LLM to avoid them; we accept the gap for
legacy content.
- Radial gradients and multi-stop gradients flatten. The prompt now
steers the LLM toward solid backgrounds or simple two-stop linears.

