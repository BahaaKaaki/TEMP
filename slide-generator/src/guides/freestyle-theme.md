# Theme -- Colors, Fonts & Visual Style

Use theme tokens for every color. Never hardcode hex, rgb, hsl, or named colors.

## Tokens

- Text: `var(--heading)`, `var(--body)`, `var(--muted)`.
- Accent: `var(--accent)`, `var(--accent-hover)`, `var(--accent-soft)`, `var(--on-accent)`.
- Surfaces: `var(--page)`, `var(--surface)`, `var(--surface-alt)`, `var(--border)`.
- Status: `var(--success)`, `var(--success-soft)`, `var(--warning)`, `var(--warning-soft)`, `var(--danger)`, `var(--danger-soft)`.

## Fonts

- `h1.title` only: `var(--font-title)` / Georgia, 28px, weight 400.
- All other text: `var(--font-body)` / Arial, including h3/h4, KPIs, labels, badges, captions.
- Suggested sizes: h3/h4 14px bold; body 12px; KPI 28-36px bold; labels 10px; footer 10px.
- Do not use fonts below 11px in slide content unless the Data preset explicitly needs dense labels.

## Contrast

- Any dark fill (`var(--accent)`, `var(--accent-hover)`, `var(--success)`, `var(--warning)`, `var(--danger)`) requires `color: var(--on-accent)` on the filled element and all text descendants.
- Never place `var(--heading)`, `var(--body)`, or other dark text on a dark fill.
- `var(--accent-soft)` and status-soft backgrounds may use dark text if contrast is clear.

## Surfaces

- Use `var(--surface)` for primary panels, `var(--surface-alt)` for nested/alternate rows, `var(--accent-soft)` for soft brand emphasis.
- Avoid stacking identical surfaces; create depth through spacing, alternates, or subtle borders.
- Use status colors only for actual growth, risk, warning, decline, completion, or blocker semantics.
