# PPTX Export Hints -- Semantic Guidance Comments

The HTML and CSS you generate will later be exported to native PowerPoint using
PptxGenJS. The browser preview is still the source of truth for layout and
styling. `<!-- pptx ... -->` comments are only lightweight guidance for
elements that PowerPoint often renders poorly, especially short filled labels,
badges, and tight one-line numbers.

Use these comments to tell the exporter what **must not break**. Do not turn
them into a second layout system.

## When to emit a hint

Emit a hint only for **risky `.frame` descendants** whose browser styling often
drifts in PowerPoint:

- chips / swatches / filled pills
- badges / tags / status labels
- tight one-line labels
- prominent step numbers or compact numeric markers

Do **not** emit hints for:

- `.slide`, `.frame`, `.footer`
- `h1.title` or `h2.subtitle`
- large text blocks, cards, or containers that export fine from CSS alone
- invisible elements

Most slides should have **few** PPTX hints. If everything has a hint, you are
overusing them.

## Format

One comment per risky element, directly before its opening tag. Use short
space-separated flags.

```html
<!-- pptx chip nowrap exact-text center tight-box -->
<div class="d-swatch">TURQUOISE</div>
```

Supported flags:

| Flag | Meaning |
| ---- | ------- |
| `chip` | Short filled pill / swatch / compact label. |
| `badge` | Small tag or status label. |
| `nowrap` | Keep this text on one line in PowerPoint. Do not split words or stack letters. |
| `exact-text` | Preserve the visible text exactly. Do not abbreviate, trim, or rewrite it for export. |
| `step-number` | Compact numeric marker such as `1`, `2`, `01`, `001`. Keep it as a single prominent number. |
| `tight-box` | The visual box is intentionally tight. Avoid extra text inset or padding in export. |
| `center` | Center the text horizontally. |
| `left` | Keep left alignment explicit when the label is small and alignment matters. |
| `right` | Keep right alignment explicit when the label is small and alignment matters. |
| `middle` | Vertically center the text in the exported box. |

If a flag is not present, the exporter falls back to the HTML and CSS.

## Rules

1. **Hints are sparse.** Only annotate elements that are likely to wrap,
   clip, or visually drift in PowerPoint.
2. **Comments are guidance, not geometry.** Do not put `x`, `y`, `w`, `h`,
   fonts, or colors into the hint comment.
3. **Keep comments attached to the exact element they describe.** The comment
   must be the immediate previous sibling of that element.
4. **Do not add other HTML comments.** Only `<!-- pptx ... -->` comments should
   appear in generated slide markup.
5. **Use `nowrap` aggressively for risky labels.** If a word like `TURQUOISE`
   must stay on one line, mark it.
6. **Use `exact-text` whenever line breaks or shortening would harm fidelity.**
7. **Do not hint shell elements.** Title, subtitle, frame, and footer are
   intentionally excluded because slide structure cleanup may move them.

## Editing an existing slide

When editing a slide that already has PPTX hints:

- preserve the hint if the risky element still serves the same role
- update the flags if the export risk changes
- add hints for newly introduced chips / badges / tight labels
- remove the hint if the element is deleted or no longer needs special export care

## Example

```html
<div class="slide">
  <h1 class="title">Particles, depth, and sunlight can shift the ocean beyond blue</h1>
  <h2 class="subtitle">Color variations</h2>

  <div class="frame">
    <div class="driver">
      <!-- pptx chip nowrap exact-text center tight-box -->
      <div class="d-swatch">TURQUOISE</div>

      <div class="d-title">Shallow + sandy bottom</div>
      <div class="d-desc">Blue water combines with bright light reflected off a shallow sandy floor.</div>
    </div>

    <div class="step">
      <!-- pptx step-number nowrap exact-text -->
      <div class="s-num">1</div>

      <div class="s-title">Water depth</div>
      <div class="s-desc">Deep water deepens blue; shallow water lightens the tone.</div>
    </div>
  </div>

  <footer class="footer"><span>Strategy&amp;</span><span>1 / 1</span></footer>
</div>
```

In this example, only the risky export elements get hints:

- `d-swatch` is a compact filled chip, so it gets `chip nowrap exact-text center tight-box`
- `s-num` is a prominent one-line number, so it gets `step-number nowrap exact-text`

The title, subtitle, cards, and body copy do not need comments.
