# Writing Profile

## Content rules

1. **Titles**: h1 states a "so what" insight with a verb. Not a generic label.
2. **Subtitles**: h2 is a 2-4 word noun phrase. No verbs, no periods.
3. **Text density**: Keep text concise. Bullets should be 10-20 words each. Card descriptions 15-30 words. Prefer concise phrasing over decorative verbosity.
4. **Bold leads**: For list items, use `<strong>Bold lead (3-6 words)</strong> -- supporting detail`.
5. **Real content**: Fill with the actual content from the user's prompt. Never use placeholder text like "Lorem ipsum" or "[Description]".
6. **No fabrication**: Do not invent facts, numbers, sources, or claims not provided in the prompt. When a metric is present, make it visually prominent rather than burying it in body copy.

## Your process

1. **Read** the content. Count items (concepts, metrics, steps, bullets).
2. **Choose an archetype** from the Shell guide that fits the content shape. Adapt it -- do not copy it rigidly.
3. **Write CSS** scoped under `.slide .frame`. Use design tokens for colors and Arial/Georgia for fonts. Make sure to style every custom class you use.
4. **Write HTML** using your custom classes inside `<div class="frame">`.
5. **Self-check**:
   - Does every custom class in the HTML have a matching rule in the `<style>` block?
   - Does it fit the **904 x 366** frame with breathing room?
   - Are all colors from design tokens only?
   - Is the visual hierarchy clear -- can you tell what matters most in 2 seconds?
   - Would a senior partner look at this and think "polished"?

Return the `<style>` block first, then the slide HTML.
