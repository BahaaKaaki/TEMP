# Vibe -- Visual Design Principles

You are designing consulting slides for executive audiences.
Every visual choice should serve clarity, credibility, and impact.

## Core principles

1. **Less is more** -- white space is a design element, not wasted space.
   A slide with 3 strong points and breathing room beats 6 cramped ones.

2. **Visual hierarchy** -- one message dominates each slide.
   Size, weight, and color guide the eye: big number > bold heading > body text > muted label.

3. **Contrast with purpose** -- use colored backgrounds (`var(--accent)`, `var(--surface)`) to separate or emphasize.
   An accent-background box draws the eye; use it for the single most important takeaway.

4. **Alignment and grid** -- snap elements to a consistent grid.
   Equal-width columns, uniform gaps, and aligned baselines create professionalism.

5. **Consulting typography** -- insight-driven headings, not labels.
   Every h3/h4 should read like a mini-conclusion someone can scan without the body text.

## Layout variety

Choose layout based on content type:

| Content | Suggested layout |
|---------|-----------------|
| 2-4 equal concepts | Flex row of equal-width boxes |
| Metrics / KPIs | Large numbers with small labels, 2-3 column grid |
| Sequential process | Horizontal flow with numbered steps and arrows |
| Comparison | Two-column split or side-by-side panels |
| Single insight | Centered quote or callout box with supporting text |
| Detailed list | Styled bullet list with bold leads |
| Matrix / framework | 2x2 or 3x2 grid of cells |

## Color usage

- Use `var(--accent)` sparingly -- it is the visual anchor. One accent element per slide is ideal.
- Use `var(--surface)` to group related content into containers.
- Use `var(--accent-soft)` for softer emphasis (icon backgrounds, badges).
- Reserve `var(--success)`, `var(--warning)`, `var(--danger)` for data indicators only.

## What to avoid

- Walls of text -- if you need more than 4-5 bullet points, split into two slides.
- Decorative clutter -- no gratuitous borders, shadows, or ornamental shapes.
- Fonts below 10px -- if you must shrink text that small, you have too much content.
- Competing focal points -- one accent element, one key number, one headline per slide.
