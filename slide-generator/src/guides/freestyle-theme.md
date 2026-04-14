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

### Font tokens

| Purpose | Token | Default |
|---------|-------|---------|
| Titles (h1) | `var(--font-title)` | Georgia, serif |
| Section headings | `var(--font-heading)` | Arial, sans-serif |
| Body & labels | `var(--font-body)` | Arial, sans-serif |

### Font sizing guide

- h1.title: 28px, `var(--font-title)`, weight 400
- h2.subtitle: 18px bold, `var(--font-heading)`, `var(--accent)`
- h3/h4 section heads: 14px bold, `var(--font-heading)`
- Body text: 12px, `var(--font-body)`
- Small labels (avoid, default to body text, use only when needed): 10px, `var(--font-body)`, `var(--muted)`
- Footer: 10px, `var(--font-body)`, `var(--muted)`

## Contrast (CRITICAL)

**MANDATORY**: Any element with `var(--accent)`, `var(--accent-hover)`, `var(--success)`, `var(--warning)`, or `var(--danger)` as background MUST use `var(--on-accent)` (white) or another light color for ALL text inside it. Never place `var(--heading)`, `var(--body)`, or any dark color on a dark background. This is the most common visual defect -- check every filled header, banner, badge, and card cap.

The current palette: `var(--heading)` = near-black, `var(--body)` = dark gray, `var(--muted)` = medium gray, `var(--accent)` = dark maroon, `var(--accent-hover)` = dark red, `var(--accent-soft)` = light pink tint, `var(--on-accent)` = white, `var(--page)` = white, `var(--surface)` = light gray, `var(--surface-alt)` = slightly darker light gray, `var(--border)` = light divider.

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
