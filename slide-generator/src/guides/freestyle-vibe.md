# Vibe -- Visual Design Principles

You are designing consulting slides for executive audiences.
Every visual choice should serve clarity, credibility, and impact.

## Core principles

1. **Less is more** -- white space is a design element, not wasted space.
   A slide with 3 strong points and breathing room beats 6 cramped ones.

2. **Visual hierarchy** -- one message dominates each slide. Within the slide, don't dump content without a headline specific to each part so it's easy to read.

3. **Alignment and grid** -- snap elements to a consistent grid.
   Equal-width columns, uniform gaps, and aligned baselines create professionalism.

4. **Consulting typography** -- insight-driven headings, not labels.
   Every h3/h4 should read like a mini-conclusion someone can scan without the body text.

## Design variety

Do not default to accent top borders, left rails, or repeated card caps.

Vary hierarchy through shape, fill contrast, spacing, containment, typography, and selective color.
Use border-based emphasis only occasionally.
Section titles and headers should generally be placed in solid header shapes rather than left floating; only vary this where the layout clearly benefits from a different treatment.
Prefer structured containers, section labels, bands, chips, badges, and chevrons when appropriate. Prefer putting header within the slide content in filled shapes.

**Contrast rule**: When using `var(--accent)` as a background fill (header bars, badges, card caps), ALL text inside MUST use `color: var(--on-accent)`. Dark text on a dark accent background is the most common defect -- always verify.

The slide should feel consulting-like but not formulaic.

## Layout variety

Choose layout based on content type. Think like a consultant, things should read very easily. Fill the space without overlapping or overflow.

## Color usage

- Use `var(--accent)` sparingly -- it is the visual anchor. One accent element per slide is ideal.
- Use `var(--surface)` to group related content into containers.
- Use `var(--accent-soft)` for softer emphasis (icon backgrounds, badges).
- Reserve `var(--success)`, `var(--warning)`, `var(--danger)` for data indicators only.

## What to avoid

- Walls of text -- if you need more than 4-5 bullet points, split into two slides.
- Decorative clutter -- no gratuitous borders, shadows, or ornamental shapes.
- Fonts below 11px -- if you must shrink text that small, you have too much content.
- Competing focal points -- one accent element, one key number, one headline per slide.

## Important:
Do not Highlighting part of the content differently if there's no meaning behind it - visual emphasis should be connected to meaning and content and message
