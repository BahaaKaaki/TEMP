# PPTX Export Hints -- Absolute Position Comments

Slides are exported to PowerPoint downstream. To preserve geometry, typography, and colors in the native PPTX, embed short **HTML comment hints** immediately before every styled element. These comments are invisible in the browser preview; the exporter reads them as ground truth and drops them straight into PptxGenJS calls without having to re-derive anything from CSS.

Think of a hint as the element's row in a spreadsheet: absolute pixel coordinates in the 960 x 540 canvas, exact font, exact hex color. No tokens, no relative offsets, no values that depend on the parent's layout. If the number is correct in your head when you write the hint, it will be correct in PowerPoint.

## When to emit a hint

Emit a hint for **every** visible element that has its own CSS rule -- titles, subtitles, cards, chips, badges, KPI values, labels, numbers, dividers. Skip these:

- `.slide`, `.frame`, `.footer` skeleton containers (their positions are fixed by the shell).
- Elements that simply inherit a parent's styling and have no CSS rule of their own.
- Non-visible elements (hidden, `display:none`).

If you wrote a CSS rule for a class, that class needs a hint. A card without hints on its inner chip means the exporter has to guess the chip's geometry and color, and the guess is usually wrong.

## Format

One comment per element, directly before its opening tag. Keys are space-separated `key=value` pairs. `bold` and `italic` are flags with no value.

```html
<!-- pptx x=28 y=140 w=430 h=220 font=Arial:14:700 color=#111111 bg=#F7F9FB align=left radius=8 -->
<div class="card-left">...</div>
```

| Key      | Value                       | Notes                                                                         |
| -------- | --------------------------- | ----------------------------------------------------------------------------- |
| `x`, `y` | integer px                  | Absolute top-left of the element in the 960 x 540 canvas. Not relative.       |
| `w`, `h` | integer px                  | Element width and height as rendered.                                         |
| `font`   | `Family:Size[:Weight]`      | Size is in px matching the CSS. Examples: `Georgia:28`, `Arial:14:700`.       |
| `color`  | `#RRGGBB` hex               | Text color. Resolved from CSS (follow `var(--token)` to its value).           |
| `bg`     | `#RRGGBB` hex               | Background color. Resolved from CSS.                                          |
| `align`  | `left` / `center` / `right` | Horizontal text alignment.                                                    |
| `valign` | `top` / `middle` / `bottom` | Vertical text alignment within the box.                                       |
| `radius` | integer px                  | Border radius.                                                                |
| `bold`   | flag                        | Present means bold.                                                           |
| `italic` | flag                        | Present means italic.                                                         |

All keys are optional. If you omit a key, the exporter falls back to inferring that attribute from the CSS for that element.

## Rules

1. **Absolute coordinates only.** `x` and `y` are measured from the top-left of the 960 x 540 slide. For a card inside a grid with a 28px parent `padding` and a row with `gap:16`, you compute the absolute position -- the exporter will not do it for you.
2. **Hex, always with `#`.** `color=#A32020`, not `color=A32020` and not `color=accent`. Follow `var(--token)` to its resolved hex value from the theme above.
3. **Pixel values match CSS.** Font size `font-size:14px` in CSS means `font=...:14` in the hint. Size in pt is NOT used here; the exporter maps 1 px -> 1 pt during export.
4. **One hint per element.** The comment MUST be the immediate previous sibling of the element it describes.
5. **No other HTML comments.** Do not add `<!-- ... -->` notes or explanations anywhere in the slide markup -- only `<!-- pptx ... -->` hints.
6. **Widths must fit the text.** If a chip says "ORANGE" at 14px bold, pick a `w` wide enough that "ORANGE" fits on one line in PowerPoint. PowerPoint reserves a small text inset; a chip rendered at `w=70` in the browser should typically get `w=80-90` in the hint.

## Editing an existing slide

When modifying a slide that already contains hints:

- **Preserve** the hint for any element you leave unchanged.
- **Update** the hint when you change that element's geometry, font, color, background, alignment, or radius.
- **Add** a new hint for every new element with custom styling.
- **Remove** the hint for any element you delete.

Every `<!-- pptx ... -->` in your output must still sit directly above a real element with the styling it claims.

## Example

```html
<style>
  .slide .frame .kpi-card {
    position:absolute; left:0; top:0;
    width:430px; height:220px;
    background:var(--surface); border-radius:8px; padding:32px;
  }
  .slide .frame .kpi-card .kpi-value {
    font-family:Georgia; font-size:42px; color:var(--accent);
    font-weight:700; text-align:center;
  }
  .slide .frame .kpi-card .kpi-label {
    font-family:Arial; font-size:13px; color:var(--muted);
    text-align:center; margin-top:8px;
  }
</style>
<div class="slide">
  <!-- pptx x=28 y=24 w=904 h=50 font=Georgia:28 color=#111111 align=left -->
  <h1 class="title">AI adoption grew 3.2x in year one</h1>

  <!-- pptx x=28 y=95 w=904 h=22 font=Arial:18:700 color=#A32020 -->
  <h2 class="subtitle">Performance metrics</h2>

  <div class="frame">
    <!-- pptx x=28 y=140 w=430 h=220 bg=#F7F9FB radius=8 -->
    <div class="kpi-card">
      <!-- pptx x=60 y=180 w=366 h=56 font=Georgia:42:700 color=#8E1E1E align=center -->
      <div class="kpi-value">3.2x</div>

      <!-- pptx x=60 y=244 w=366 h=20 font=Arial:13 color=#4A4F57 align=center -->
      <div class="kpi-label">Return on AI investment</div>
    </div>
  </div>

  <footer class="footer"><span>Strategy&amp;</span><span>2</span></footer>
</div>
```

Note how the KPI value's hint has an absolute `x=60` (`28` slide padding + `32` card padding) and `y=180` (`140` card top + `40` top padding). Every number in every hint is an absolute pixel coordinate in the final rendered slide.
