# Writing Profile -- Language & Content

## Content rules

1. **Titles**: h1 states a "so what" insight with a verb. Not a generic label.
2. **Subtitles**: h2 is a 2-4 word noun phrase. No verbs, no periods.
3. **Text density**: Keep text concise. Bullets should be 10-20 words each. Card descriptions 15-30 words. Prefer concise phrasing over decorative verbosity.
4. **Bold leads**: For list items, use `<strong>Bold lead (3-6 words)</strong> -- supporting detail`.
5. **Real content**: Fill with the actual content from the user's prompt. Never use placeholder text like "Lorem ipsum" or "[Description]".
6. **No fabrication**: Do not invent facts, numbers, sources, or claims not provided in the prompt. When a metric is present, make it visually prominent rather than burying it in body copy.

## Layout archetypes

Pick the archetype that best fits the content, then adapt it. These are starting points, not rigid templates -- combine and modify freely.

### Cards (2-4 items of equal weight)

Side-by-side cards using CSS grid. Each card gets a surface background, optional accent top-border, a bold title, and 2-3 lines of body text. Use `grid-template-columns: repeat(N, 1fr)` with a 16px gap.

### Metric dashboard (2-5 KPIs)

Large display numbers (Georgia, 32-40px, accent color) with a small uppercase label above and a one-line description below. Arrange in a single row using flexbox. Numbers are the visual anchor.

### Comparison / before-after (2 sides)

Two columns separated by a vertical accent divider or arrow. Left = "before" or "problem", right = "after" or "solution". Each side has a header and bullet points. The contrast tells the story.

### Numbered steps / process (3-6 items)

Horizontal row of numbered circles (accent background, white number inside) connected by a thin line or spaced evenly. Below each circle: a bold label and 1-2 lines of description. Good for processes, timelines, phases.

### Hero metric + context

One dominant number (48-56px Georgia, accent color) centered or left-aligned, with a label above and 2-3 supporting bullets or a short paragraph below. Use when one stat is the headline.

### Structured list with accent markers

Vertical list where each item has an accent left-border (3-4px) or accent bullet, a bold lead phrase, and a supporting sentence. Items have `var(--surface)` background with rounded corners and consistent padding. Not a plain `<ul>` -- each item is a styled block.

### Two-column split

Left column (40-50%) holds a summary, key takeaway, or a single large metric. Right column holds supporting detail (bullets, small cards, a table). Connected by shared visual rhythm.

### Grid matrix (4-9 items)

CSS grid with 2-3 columns, auto rows. Each cell is a small card with an icon-like indicator (a colored dot, a number badge, or an accent-bordered box), a bold label, and a short description. Good for feature lists, capability maps, evaluation criteria.

## Source citations

When the slide content references data, statistics, or research findings, add a brief source attribution in the footer. Replace the brand span with the source:

```html
<footer class="footer"><span>Source: IEA World Energy Outlook, 2025</span><span>[Page#]</span></footer>
```

Keep sources to **5-15 words maximum**. Examples: "Source: Bloomberg NEF", "McKinsey Global Institute, 2024", "Company annual report, FY2025". Never write full sentences in the source line. If no external data is cited, keep the brand name in the footer instead.

## Content anti-patterns

1. **Plain bullet list.** Never output a bare `<ul><li>` list with no visual treatment. Every list item needs structure: background, border, icon/number marker, or card wrapper.
2. **Wall of text.** If a section has more than 3 lines of body text, break it into cards, columns, or a structured list.
3. **Uniform monotony.** When generating multiple slides, vary the archetype. Do not repeat the same card grid on every slide.

## Your process

1. **Read** the content. Count items (concepts, metrics, steps, bullets).
2. **Choose an archetype** that fits the content shape. Adapt it -- do not copy it rigidly.
3. **Write CSS** scoped under `.slide .frame`. Use design tokens for colors and Arial/Georgia for fonts. Style every custom class you use.
4. **Write HTML** using your custom classes inside `<div class="frame">`.
5. **Self-check**:
   - Does every custom class in the HTML have a matching rule in the `<style>` block?
   - Does it fit the **904 x 366** frame with breathing room?
   - Are all colors from design tokens only?
   - Is the visual hierarchy clear -- can you tell what matters most in 2 seconds?
   - Would a senior partner look at this and think "polished"?

Return the `<style>` block first, then the slide HTML.
