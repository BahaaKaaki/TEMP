# Plan: Consolidate freestyle into one markdown guide

## Problem

Freestyle slides keep producing the same layouts (card-row, content-list) because:

1. **~34K chars of scattered context** across 6+ JS constants — the AI can't prioritize
2. **Overlapping rules** — CSS_STYLE_GUIDE, FREESTYLE_COMPONENT_GUIDE, LAYOUT_GUIDANCE_MAP, TITLE_HEADER_RULES, preamble, simplicityGuidance all say slightly different things
3. **10 full HTML examples** baked into FREESTYLE_COMPONENT_GUIDE — AI copies the nearest match instead of thinking creatively
4. **Deterministic routing hints** in the user prompt ("3 items → card-row") override any diversity attempts

## Solution

Create **one markdown file** (`slide-generator/src/guides/freestyle-slide-guide.md`) that replaces ALL freestyle context. `generateSlides()` imports it and uses it as the sole system prompt for freestyle — nothing else injected.

## What goes IN the markdown file

1. **Role + process** — "You are a slide designer. Count items → pick layout → check budget → fill."
2. **Slide skeleton** — `div.slide > h1.title + h2.subtitle + div.frame + footer` (5 lines)
3. **CSS tokens** — color/font variables as a compact table (not prose)
4. **Approved class whitelist** — flat list of every valid class, grouped by type
5. **Content budgets** — one table: layout | max items | words/item | approx height
6. **Title rules** — "so what" insight 8-12 words, subtitle noun phrase 2-4 words
7. **Quality rules** — lists need classes, li needs `<strong>Bold</strong> — detail`, no emojis in text, no inline layout styles
8. **ONE skeleton per layout** — HTML structure only, placeholder text like `[Title]`, `[Description]`. ~8 layouts × ~10 lines each
9. **Layout selection** — multiple alternatives per item count, explicit "vary your choices" instruction
10. **Hard constraints** — 890×353px frame, one layout per frame, no invented classes, no hardcoded colors

## What gets REMOVED (vs current)

- All 10 fully-written example slides with fake business data (these are the #1 cause of copying)
- Redundant rule repetition (currently same rule appears in 3+ places)
- LAYOUT_GUIDANCE_MAP as separate constant (folded into the file)
- The "HARD RULES" preamble constructed inline in generateSlides()
- The "simplicityGuidance" design checklist constructed inline
- The "HEIGHT BUDGET" section (merged into content budgets table)
- The "FILL THE FRAME" section (one line in quality rules)

## Code changes

### 1. New file: `slide-generator/src/guides/freestyle-slide-guide.md`
- Single source of truth for freestyle generation
- Target: ~150-200 lines, ~6-8K chars (down from 34K)
- Imported as raw string via vite `?raw`

### 2. Modify: `aiService.js` — `generateSlides()` function
- For freestyle path: `activeSystemPrompt = freestyleGuideMarkdown` (the imported .md)
- Remove the inline preamble ("You are a slide template designer... YOUR PROCESS... HARD RULES...")
- Remove `simplicityGuidance` block construction for freestyle
- Keep TITLE_HEADER_RULES in user prompt (slide-specific context, not guide-level)
- Keep deck context / layout diversity injection in user prompt (dynamic per-call)
- Keep `settings.freestyleGuide` override (user custom guide still takes priority)

### 3. Simplify: `aiService.js` constants
- FREESTYLE_COMPONENT_GUIDE → no longer used in freestyle path (can keep for backward compat or remove)
- CSS_STYLE_GUIDE → still used by DEFAULT_SYSTEM_PROMPT (template mode), untouched
- LAYOUT_GUIDANCE_MAP → keep for router path, but freestyle no longer references it

### 4. Keep unchanged
- DEFAULT_SYSTEM_PROMPT (template mode, separate concern)
- Router system prompt / AI_ROUTER_TEMPLATES (separate decision layer)
- `detectSlideLayout()` and batch diversity tracking
- `buildDeckContext()` with layout tags
- agentToolRegistry.js (no changes needed)

## File structure after

```
slide-generator/src/
  guides/
    freestyle-slide-guide.md    ← NEW: single source of truth (~7K)
  services/
    aiService.js                ← MODIFIED: freestyle loads .md, removes inline constants
    agentToolRegistry.js        ← UNCHANGED
```

## Risks

- Template mode unaffected (DEFAULT_SYSTEM_PROMPT untouched)
- Router unaffected (AI_ROUTER_TEMPLATES untouched)
- `settings.freestyleGuide` override preserved
- Backward compatible — FREESTYLE_COMPONENT_GUIDE const still exists, just not used in hot path
