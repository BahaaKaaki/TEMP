# PPTX Template Transform — Implementation Plan

## Feature Summary

Upload an existing `.pptx` presentation and transform its colors, fonts, and master template to match a target template (also a `.pptx` file you upload). This is a **separate feature** from AI slide creation — it operates on pre-existing presentations.

---

## Design Decision: Target Template Format

**Recommendation: Structured template with layouts + placeholders (not blank)**

The target `.pptx` must contain:

| Slide Layout | PowerPoint Type Index | Purpose | Required Placeholders |
|---|---|---|---|
| Title Slide | 1 | Cover / first slide | Centered title, subtitle |
| Title + Content | 2 | Standard content slides | Title, body, footer |
| Section Header | 3 | Separators / chapter dividers | Large title, subtitle |
| Two Content | 4 | Side-by-side layouts | Title, left body, right body |
| Blank | 7 | Freeform / custom slides | (none, or footer only) |
| Title Only | 6 | Minimal content slides | Title, footer |

### Why not blank?

1. **Theme colors** (the 12 semantic slots: dk1, dk2, lt1, lt2, accent1-6, hlink, folHlink) remap automatically when you swap the theme XML. A blank slide with hardcoded hex colors gives you nothing.
2. **Placeholders** are how PowerPoint knows where title/body/footer content goes. Without them, content from the source slides would need manual coordinate recalculation.
3. **Slide masters** carry persistent elements (logo, footer bar, decorative shapes) that appear on every slide. A blank template has none of this.
4. **Different source slide types** (cover, content, separator) need different target layouts. A single blank layout can't handle this variation.

### What the user needs to prepare

Create a `.pptx` in PowerPoint (View → Slide Master) with:
- 4-6 slide layouts, each with properly positioned placeholders
- The desired color theme (Design → Colors → Customize)
- The desired fonts (Design → Fonts → Customize)
- Master-level branding: logo, footer bar, decorative elements

---

## Architecture

### New files

```
slide-generator/src/services/pptxTransformService.js   — Core transform engine
slide-generator/src/components/PptxTransformer.jsx      — Upload UI + progress
```

### Modified files

```
slide-generator/src/components/Header.jsx               — Add "Transform PPTX" nav entry
slide-generator/src/components/MainContent.jsx          — Route to PptxTransformer view
slide-generator/src/services/pptxTemplateService.js     — Reuse IndexedDB helpers (second store)
```

---

## Implementation Steps

### Step 1: PPTX Parser — Extract source structure

Build `parseSourcePptx(arrayBuffer)` that uses JSZip to extract:

```js
{
  theme: {                        // from ppt/theme/theme1.xml
    colorScheme: {                // <a:clrScheme>
      dk1: '000000', dk2: '1F497D', lt1: 'FFFFFF', lt2: 'EEECE1',
      accent1: '4F81BD', accent2: 'C0504D', ...
    },
    fontScheme: {                 // <a:fontScheme>
      major: 'Calibri Light',
      minor: 'Calibri'
    }
  },
  masters: [{                     // from ppt/slideMasters/
    index: 1,
    layouts: [                    // from ppt/slideLayouts/
      { index: 1, name: 'Title Slide', type: 'title' },
      { index: 2, name: 'Title and Content', type: 'obj' },
      { index: 3, name: 'Section Header', type: 'secHead' },
      ...
    ]
  }],
  slides: [{
    index: 1,
    layoutIndex: 1,              // which layout this slide uses
    layoutName: 'Title Slide',
    layoutType: 'title',
    hasTitle: true,
    hasBody: true,
    hardcodedColors: ['A32020', '8E1E1E', ...],  // RGB values found in the XML
    xml: '<p:sld>...</p:sld>'
  }, ...]
}
```

**Key detail**: Scan every slide's XML for hardcoded `srgbClr val="XXXXXX"` attributes. These are colors that won't change when you swap the theme and need explicit remapping.

### Step 2: Target template parser

Build `parseTargetTemplate(arrayBuffer)` — same structure as above but focused on extracting the available layouts and theme. This tells us what we can map *to*.

### Step 3: Layout classifier + mapper

Build `mapLayouts(sourceSlides, sourceLayouts, targetLayouts)`:

```
Source Layout Type    →  Target Layout Type
─────────────────────────────────────────────
title / cust (slide 1) → Title Slide
obj / tx               → Title + Content
secHead / blank-big    → Section Header
twoObj                 → Two Content
blank                  → Blank
other / unknown        → Title + Content (fallback)
```

**Classification strategy** (in order of reliability):
1. **Layout `type` attribute** in the XML (`<p:cSld>` → parent layout's `type="obj"`, `type="secHead"`, etc.)
2. **Layout name** matching (case-insensitive: "Title Slide", "Section Header", etc.)
3. **Heuristic fallback**:
   - Slide 1 → Title Slide
   - Slide with only centered large text, no body → Section Header
   - Everything else → Title + Content

Returns a mapping: `{ sourceLayoutIndex: targetLayoutIndex }` for each slide.

### Step 4: Color remapping engine

Build `buildColorMap(sourceTheme, targetTheme)` and `remapColors(slideXml, colorMap)`:

**Phase A — Theme swap (automatic)**
Replace `ppt/theme/theme1.xml` entirely with the target's theme. All `<a:schemeClr val="accent1"/>` references instantly resolve to the new colors. This handles ~60-80% of color changes.

**Phase B — Hardcoded RGB remapping**
For `<a:srgbClr val="A32020"/>` (hardcoded), build a lookup table:

```js
colorMap = {
  'A32020': targetTheme.accent1,    // source accent1 → target accent1
  '8E1E1E': targetTheme.accent2,    // source accent2 → target accent2
  '111111': targetTheme.dk1,        // source dark1 → target dark1
  'F7F9FB': targetTheme.lt2,        // source light bg → target light bg
  ...
}
```

**How to build this map:**
1. Parse source theme's 12 color slots
2. Parse target theme's 12 color slots
3. Map source slot values → target slot values
4. Also detect "near matches" (colors within a small distance of a theme color are likely derived from it)

Then do a string replace across all slide XMLs:
```js
slideXml = slideXml.replace(/srgbClr val="A32020"/g, `srgbClr val="${targetAccent1}"`);
```

**Phase C — Font remapping**
Replace source major/minor font families with target fonts throughout slide XMLs.

### Step 5: PPTX reassembly

Build `transformPptx(sourceBuf, targetBuf)` — the main orchestrator:

```
1. parseSourcePptx(sourceBuf)
2. parseTargetTemplate(targetBuf)
3. layoutMap = mapLayouts(source, target)
4. colorMap = buildColorMap(source.theme, target.theme)
5. Start from TARGET zip (keeps masters, layouts, theme, branding)
6. Remove target's placeholder slides
7. For each source slide:
   a. Remap layout reference: slideN.xml.rels → point to target layout per layoutMap
   b. Remap hardcoded colors in slide XML via colorMap
   c. Remap fonts
   d. Copy slide + rels + media into target zip
8. Update presentation.xml (slide list)
9. Update [Content_Types].xml
10. Return merged arraybuffer
```

### Step 6: UI — PptxTransformer component

```
┌──────────────────────────────────────────────────┐
│  Transform Presentation                          │
│                                                  │
│  ┌─────────────────┐  ┌──────────────────────┐   │
│  │ SOURCE PPTX     │  │ TARGET TEMPLATE      │   │
│  │                 │  │                      │   │
│  │ [Drop .pptx]    │  │ [Drop .pptx/.potx]   │   │
│  │                 │  │                      │   │
│  │ 12 slides       │  │ "Acme Corp Template" │   │
│  │ 3 layouts used  │  │ 6 layouts available  │   │
│  └─────────────────┘  └──────────────────────┘   │
│                                                  │
│  Layout Mapping Preview:                         │
│  ┌───────────────────────────────────────────┐   │
│  │ Slide 1  [Title Slide]    → [Title Slide] │   │
│  │ Slide 2  [Content]        → [Title+Body]  │   │
│  │ Slide 5  [Section Header] → [Sec Header]  │   │
│  │ Slide 12 [Blank]          → [Blank]       │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  Color Mapping Preview:                          │
│  ┌───────────────────────────────────────────┐   │
│  │ ■ #A32020 (accent1) → ■ #0066CC          │   │
│  │ ■ #8E1E1E (accent2) → ■ #004499          │   │
│  │ ■ #111111 (dk1)     → ■ #1A1A2E          │   │
│  │ ■ #F7F9FB (lt2)     → ■ #F0F4FF          │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  [ Transform & Download ]                        │
└──────────────────────────────────────────────────┘
```

Key UI features:
- Drag-and-drop for both source and target files
- Auto-detection of layouts and colors after upload
- Editable layout mapping (user can override automatic mapping)
- Color mapping preview with swatches
- Progress indicator during transform
- Download transformed `.pptx`

### Step 7: Edge cases + robustness

| Edge Case | Handling |
|---|---|
| Source has layouts not in target | Fall back to "Title + Content" (most generic) |
| Source uses multiple slide masters | Map each master's layouts independently |
| Hardcoded colors not in source theme | Skip (leave as-is) or offer manual mapping in UI |
| Source has embedded media (images, charts) | Copy as-is — media doesn't need color remapping |
| Source has SmartArt / grouped shapes | Copy XML as-is; colors inside groups get remapped too |
| `.potx` (template) vs `.pptx` | Both are ZIP with same structure; handle identically |
| Source slide size ≠ target slide size | Warn user; optionally scale coordinates proportionally |

---

## What this does NOT cover (out of scope)

- **Content editing** — this feature transforms visual identity, not content
- **AI-powered slide creation** — that's the existing feature
- **Slide reordering or deletion** — transform is 1:1 source slides in, transformed slides out
- **Animation / transition transfer** — animations stay with source slides as-is
- **Chart data re-theming** — embedded Excel chart colors may not remap (PowerPoint limitation)

---

## Dependencies

Already in `package.json`:
- `jszip` — ZIP manipulation (PPTX is a ZIP)
- `file-saver` — Download result

No new dependencies needed.

---

## Suggested build order

1. **Step 1-2**: Parsers (source + target) — testable independently
2. **Step 4**: Color remapping engine — testable with unit tests
3. **Step 3**: Layout mapper — needs parsers
4. **Step 5**: Reassembly — integration of all above
5. **Step 6**: UI component
6. **Step 7**: Edge case hardening after first end-to-end test
