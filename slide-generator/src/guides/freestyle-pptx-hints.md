# PPTX Export Hints -- Semantic Guidance Comments

HTML/CSS is the source of truth. `<!-- pptx ... -->` comments are sparse export guidance for elements PowerPoint often distorts.

## Use Only For Risky `.frame` Descendants

- chips, swatches, filled pills
- badges, tags, status labels
- tight one-line labels
- compact step numbers or numeric markers

Do not hint shell elements, titles, subtitles, frame, footer, large text blocks, cards, containers, or invisible elements.

## Format

Place one comment immediately before the exact element:

```html
<!-- pptx chip nowrap exact-text center tight-box -->
<div class="d-swatch">TURQUOISE</div>
```

Flags:

- `chip`, `badge`, `step-number`
- `nowrap`, `exact-text`, `tight-box`
- horizontal: `left`, `center`, `right`
- vertical: `top`, `middle`, `bottom`

## Rules

- Hints are rare; most elements need none.
- No geometry, colors, fonts, `x/y/w/h`, or layout values in comments.
- Use `nowrap exact-text` for labels or numbers that must not wrap, split, abbreviate, or change.
- Preserve/update hints when editing the same risky element; remove hints when the element is deleted or no longer risky.
- Do not add any HTML comments except `<!-- pptx ... -->`.
