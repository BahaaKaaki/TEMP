# Writing Profile -- Language & Content

## Executive writing style

Write in a message-led executive style: use larger paragraph titles to state the slide's key messages, apply bold within body text to emphasize the real substance, use color strategically and sparingly to guide attention, use contrast deliberately through size, weight, fill, and tone to create clear hierarchy and make important ideas stand out instantly, and keep supporting copy concise, factual, and easy for a senior reader to grasp in seconds.

## Content rules

1. **Titles**: h1 states a "so what" insight with a verb. Not a generic label.
2. **Subtitles**: h2 is a 2-4 word noun phrase. No verbs, no periods.
3. **Text density**: Keep text concise. Bullets should be 10-20 words each. Card descriptions 15-30 words. Prefer concise phrasing over decorative verbosity.
4. **Bold leads**: For list items, use `<strong>Bold lead (3-6 words)</strong> -- supporting detail`.
5. **Real content**: Fill with the actual content from the user's prompt. Never use placeholder text like "Lorem ipsum" or "[Description]".
6. **No fabrication**: Do not invent facts, numbers, sources, or claims not provided in the prompt. When a metric is present, make it visually prominent rather than burying it in body copy.

## Source citations

When the slide content references data, statistics, or research findings, add a brief source attribution in the footer. Replace the brand span with the source:

```html
<footer class="footer"><span>Source: IEA World Energy Outlook, 2025</span><span>[Page#]</span></footer>
```

Keep sources to **5-15 words maximum**. Examples: "Source: Bloomberg NEF", "McKinsey Global Institute, 2024", "Company annual report, FY2025". Never write full sentences in the source line. If no external data is cited, keep the brand name in the footer instead.