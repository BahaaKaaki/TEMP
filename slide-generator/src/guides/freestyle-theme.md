# Theme -- Colors, Fonts & Visual Style

## Design tokens

Use `var(--token)` for all colors. Never hardcode hex, rgb, or named colors.

| Purpose | Token |
|---------|-------|
| Headings | `var(--heading)` |
| Body text | `var(--body)` |
| Subtle/meta | `var(--muted)` |
| Brand accent | `var(--accent)` |
| Accent hover | `var(--accent-hover)` |
| Light accent bg | `var(--accent-soft)` |
| Text on accent | `var(--on-accent)` -- **REQUIRED** on any element with `var(--accent)` background |
| Page background | `var(--page)` |
| Card/container bg | `var(--surface)` |
| Alternate surface | `var(--surface-alt)` |
| Borders | `var(--border)` |
| Positive/growth | `var(--success)` |
| Positive bg | `var(--success-soft)` |
| Warning | `var(--warning)` |
| Warning bg | `var(--warning-soft)` |
| Negative/decline | `var(--danger)` |
| Negative bg | `var(--danger-soft)` |

## Fonts

- **Georgia serif** for display numbers and emphasis.
- **Arial sans-serif** for body text (12-14px, minimum 11px for metadata/footnotes), headings (14-18px bold), and labels (11-12px).
- Never go below 10px for any element.

## Contrast and accessibility
 
This is mandatory.
 
Only use `color: var(--on-accent)` on elements whose **own background** is dark or accent-colored, such as:
- `background: var(--accent)`
- dark banners
- dark badges
- dark panels
- dark header bars
 
Do not force `var(--on-accent)` onto nested elements that have a light background.
 
Rules:
- Every dark-filled element must explicitly set `color: var(--on-accent)`
- Every text-bearing child that remains on that same dark background should also explicitly set `color: var(--on-accent)`
- Any nested element with a light background such as `var(--surface)`, `var(--surface-alt)`, `white`, or `var(--accent-soft)` must explicitly reset text color to `var(--heading)` or `var(--body)`
- Never rely on inheritance alone for contrast
- Never use blanket selectors like:
  - `.header * { color: var(--on-accent); }`
  - `.banner * { color: white; }`
  - `.accent-panel * { color: var(--on-accent); }`

## Design principles

Think like a management consultant designing a slide for a C-suite audience:

1. **Visual hierarchy.** The most important information should be the most visually prominent (larger, bolder, accent-colored). Secondary info should be smaller and muted.
2. **White space.** Leave breathing room. A slide with 30% empty space reads better than one that is packed. Do not try to fill every pixel.
3. **Alignment and rhythm.** Use consistent spacing, padding, and alignment. Elements should feel like they belong to a grid even if the grid is invisible.
4. **Accent sparingly.** Use `var(--accent)` for emphasis -- borders, display numbers, key phrases, section headers. Body text stays in `var(--body)` or `var(--muted)`.
5. **Professional polish.** Rounded corners (4-6px), subtle borders, consistent padding (12-16px), and clean typography signal quality. No harsh borders, no clashing colors.

## Visual anti-patterns

1. **Unstyled numbers.** KPIs and statistics must be visually prominent -- large font, accent color, clear label. Never dump a number inline in a paragraph.
2. **Restyling base classes.** Never restyle `.slide`, `.title`, `.subtitle`, `.frame`, or `.footer` in your `<style>` block.
3. **CSS leakage.** Never emit selectors that could target another slide. All selectors must be scoped under `.slide .frame`.
4. **Missing `<style>` block.** You MUST always output a `<style>` block with your custom CSS. Without it, the slide will be unstyled.

Make sure all text is readable, and contrast is managed well between text font color and shapes or background colors behind it.
