# Theme -- Colors, Fonts & Visual Style

## Design tokens

Use `var(--token)` for ALL colors. Never hardcode hex, rgb, or named colors.
Token values are set by the active theme and adapt automatically to any brand.

### Color tokens

| Purpose | Token | Usage |
|---------|-------|-------|
| Headings | `var(--heading)` | h1-h6, strong emphasis |
| Body text | `var(--body)` | Paragraphs, list items |
| Subtle/meta | `var(--muted)` | Captions, footnotes, secondary labels |
| Brand accent | `var(--accent)` | Primary brand color -- borders, icons, emphasis |
| Accent hover | `var(--accent-hover)` | Interactive hover states |
| Light accent bg | `var(--accent-soft)` | Tinted backgrounds, icon containers |
| Text on accent | `var(--on-accent)` | **REQUIRED** on any element with `var(--accent)` background |
| Page background | `var(--page)` | Slide background |
| Container bg | `var(--surface)` | Panels, boxes, containers |
| Alternate surface | `var(--surface-alt)` | Secondary containers, zebra-stripe rows |
| Borders | `var(--border)` | Dividers, outlines, table borders |
| Positive/growth | `var(--success)` | Up arrows, growth indicators |
| Positive bg | `var(--success-soft)` | Success highlight background |
| Warning | `var(--warning)` | Caution indicators |
| Warning bg | `var(--warning-soft)` | Warning highlight background |
| Negative/decline | `var(--danger)` | Down arrows, risk indicators |
| Negative bg | `var(--danger-soft)` | Danger highlight background |
| Neutral chart fill | `var(--neutral-fill)` | Bars, areas, icons needing a cool gray fill (not body text) |
| Rose chart fill | `var(--rose-fill)` | Secondary series, highlights, warm rose fills (not legacy `--rose`, which maps to accent-soft) |

### Font tokens

| Purpose | Token | Default |
|---------|-------|---------|
| Titles (h1 only) | `var(--font-title)` | Georgia, serif |
| Everything else | `var(--font-body)` | Arial, sans-serif |

**Font rule**: Use Arial (`var(--font-body)`) for ALL text — headings, labels, body, captions, badges.
Georgia (`var(--font-title)`) is ONLY for `h1.title`. Do not use Georgia for h3, h4, cards, KPIs, labels, or any other element. When in doubt, use Arial.

### Font sizing guide

- h1.title: 28px, `var(--font-title)` (Georgia — ONLY place Georgia is used), weight 400
- h2.subtitle: 18px bold, `var(--font-body)` (Arial), `var(--accent)`
- h3/h4 section heads, pillar titles, card titles: 14px bold, `var(--font-body)` (Arial)
- Body text, bullets, descriptions, and table cells: 12px, `var(--font-body)` (Arial)
- KPI numbers/stats: 28-36px bold, `var(--font-body)` (Arial), `var(--accent)`
- Compact tags, badges, chips, tracker labels, and short in-box labels: 8px minimum, `var(--font-body)` (Arial), `var(--muted)`
- Captions, chart axis ticks, legends, sources, and footer text: 10px minimum, `var(--font-body)` (Arial), `var(--muted)`
- Footer: 10px, `var(--font-body)` (Arial), `var(--muted)`

Never set normal visible text below 10px, or compact tag/tracker text below 8px. If content will not fit with 12px body text and 14px section/pillar titles, cut copy, reduce item count, tighten spacing, or split into another slide.

## Contrast (CRITICAL)

**MANDATORY**: Any element with `var(--accent)`, `var(--accent-hover)`, `var(--neutral-fill)`, `var(--rose-fill)`, `var(--success)`, `var(--warning)`, or `var(--danger)` as background MUST use `var(--on-accent)` (white) or another light color for ALL text inside it — including ALL child elements (spans, strongs, headings, labels). Never place `var(--heading)`, `var(--body)`, or any dark color on a dark background. This is the #1 most common visual defect.

**SELF-CHECK**: After writing each CSS rule that sets `background` or `background-color` to a dark token, verify that the `color` of EVERY text element inside that container (including nested children) is set to `var(--on-accent)` or white. If you write `background: var(--accent)` on a div, every `h3`, `h4`, `p`, `span`, `strong` inside it needs `color: var(--on-accent)`.

The current palette: `var(--heading)` = near-black, `var(--body)` = dark gray, `var(--muted)` = medium gray, `var(--accent)` = dark maroon, `var(--accent-hover)` = dark red, `var(--accent-soft)` = light pink tint, `var(--on-accent)` = white, `var(--page)` = white, `var(--surface)` = light gray, `var(--surface-alt)` = slightly darker light gray, `var(--border)` = light divider, `var(--neutral-fill)` = cool gray for chart fills, `var(--rose-fill)` = rose for secondary fills.

## Surface usage patterns

- **Page background** (`var(--page)`): the slide itself -- usually white.
- **Surface** (`var(--surface)`): primary containers, panels, boxes that sit on the page. Creates depth.
- **Surface-alt** (`var(--surface-alt)`): secondary containers or alternating rows. Slightly darker than surface.
- **Accent-soft** (`var(--accent-soft)`): call-out boxes, icon circles, highlights that need brand tint.
- Never stack surface on surface -- use surface-alt or accent-soft for nested depth.

## Status color patterns

Use status tokens for data-driven content:
- `var(--success)` / `var(--success-soft)`: growth, positive trends, completed items
- `var(--warning)` / `var(--warning-soft)`: at-risk items, moderate concerns
- `var(--danger)` / `var(--danger-soft)`: declines, blockers, critical issues
- Pair with directional indicators: arrows, badges, or border-left accents
