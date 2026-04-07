# Design Tokens

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

Fonts: Georgia serif for display numbers and emphasis. Arial sans-serif for body text (12-14px, minimum 11px for metadata/footnotes), headings (14-18px bold), and labels (11-12px). Never go below 10px for any element.
