# Plan: Add Image Slide Category

## Overview

Add a new **image slide category** alongside the existing freestyle category. The router can select it when appropriate, and it uses AI image generation models (via the existing `imageModel` setting) to produce visual slides. Two selectors — mirroring how freestyle works:

1. **`image-full`** — Full-bleed AI-generated image covering the entire slide (no textual components)
2. **`image-content`** — AI-generated image fills only the `.frame` content area; `h1.title`, `h2.subtitle`, and `footer` remain textual HTML components

**Key principles:**
- Image prompt always incorporates theme colors (maroon #8E1E1E palette, CSS tokens), vibe style, and a **Strategy& consulting persona** ("think like a senior strategy consultant — clean, data-oriented, executive-quality visuals")
- Router provides `layoutGuidance` for image slides **just like it does for freestyle** — this becomes the visual description for the image model
- Graceful degradation: if `imageModel` is not configured, falls back to freestyle

---

## Step 1: Image Generation Service

**File:** `src/services/aiService.js`

Add a `generateImage(prompt, settings)` function near the existing API call functions (~line 2883, near `callGeminiAPI`):

- Reads `settings.imageModel` (format: `"providerId:modelName"`, e.g. `"openai:gpt-image-1"`)
- Uses `getCredentials(settings)` with the imageModel's provider to get the API key and URL
- Routes to the correct image API based on provider:
  - **OpenAI** (`gpt-image-1`, `dall-e-3`): `POST {apiUrl}/images/generations` with `model`, `prompt`, `size: "1536x1024"` (landscape, close to slide 16:9 ratio), `quality: "high"`, `output_format: "b64_json"` (for gpt-image-1) or `response_format: "b64_json"` (for dall-e-3)
  - **Gemini** (Imagen): `POST /v1beta/models/{model}:predict` with prompt and image config
  - **PwC / Bedrock / Vertex**: Route through their base provider pattern with the configured `apiUrl` + appropriate auth
- Returns a `data:image/png;base64,...` data URI string
- Throws a clear error if `imageModel` is not configured or API call fails

**Why a separate function instead of reusing `callGeminiAPI`:** Image generation APIs have fundamentally different request/response formats from chat completions — different endpoints, different payload structures, different output parsing (base64 image vs text).

---

## Step 2: Image Slide Builder

**File:** `src/services/aiService.js`

Add `generateImageSlide(instruction, settings, mode, contextInfo)` function:

### 2a. Build the image prompt (common to both modes)

Compose a rich prompt for the image model that includes:

```
[CONTENT]: {instruction from router}

[VISUAL DIRECTION]: {layoutGuidance from router — e.g., "circular diagram showing 3 interconnected pillars"}

[COLOR PALETTE]:
- Primary: deep maroon (#8E1E1E) — use as accent color, borders, key elements
- Secondary: dark charcoal (#111111) — text, headers
- Tertiary: cool grey (#4A4F57) — supporting text, labels
- Background: clean white (#FFFFFF) or light grey (#F7F9FB)
- Accent soft: rose (#F8E3E3) — subtle highlights
- Borders: light grey (#E6E9EE)

[STYLE]: Professional strategy consulting visual. Think McKinsey / BCG / Strategy& presentation.
Clean, structured, executive-quality. Minimal decoration, maximum clarity.
Use geometric shapes, clean lines, and icons over photographs.
Flat design aesthetic with the color palette above.
{vibeContext — from getVibePromptContext(): bold = high contrast/larger elements, minimal = more whitespace, corporate = structured/formal, creative = asymmetric}

[FORMAT]: {mode === 'full' ? '960x540 slide, landscape 16:9' : '890x353 content illustration, landscape'}
Do NOT include any text in the image that duplicates the slide title or subtitle — the text components are handled separately.
```

### 2b. `image-full` mode

1. Call `generateImage()` with the composed prompt
2. Construct HTML:
```html
<div class="slide slide-image-full">
  <img src="data:image/png;base64,..." alt="[description from instruction]" class="slide-image-cover" />
</div>
```
3. Return `{ id, title: extractedTitle, html, type: 'image-full', templateId: 'image-full' }`

### 2c. `image-content` mode

1. **In parallel** (`Promise.all`):
   - Call `generateImage()` for the content illustration (890×353 frame area)
   - Call `callGeminiAPI()` with the text model to generate title/subtitle/footer:
     ```
     Based on this content instruction, generate:
     1. title: An insight-driven "so what" sentence (max 12 words) — like a Strategy& slide title
     2. subtitle: A short section label (2-3 words)
     3. footer: Source attribution if relevant, or empty

     Instruction: {instruction}

     Return as JSON: {"title": "...", "subtitle": "...", "footer": "..."}
     ```
2. Construct HTML:
```html
<div class="slide">
  <h1 class="title">{generated title}</h1>
  <h2 class="subtitle">{generated subtitle}</h2>
  <div class="frame">
    <img src="data:image/png;base64,..." alt="{description}" class="frame-image" />
  </div>
  <footer class="footer">
    <span>{footerBranding || 'Strategy&'}</span>
    <span>{slideNumber}</span>
  </footer>
</div>
```
3. Return `{ id, title, html, type: 'image-content', templateId: 'image-content' }`

---

## Step 3: Router Integration

**File:** `src/services/aiService.js`

### 3a. Add image category to `buildTemplateList()` (~line 948)

After the existing FREESTYLE section, append:

```
IMAGE (AI-generated visual slides — requires imageModel in settings):
- image-full: Full-bleed AI-generated image covering entire slide. No text components. USE WHEN the content is best conveyed as a pure visual — conceptual diagram, strategic framework illustration, transformation journey visual, or infographic. REQUIRES "layoutGuidance" describing the visual.
- image-content: AI-generated image in the content frame with textual title/subtitle/footer. USE WHEN you need a professional illustration to support a textual insight message. REQUIRES "layoutGuidance" describing what the image should depict.
  layoutGuidance for image slides: Describe WHAT the image should depict visually — e.g., "circular diagram showing 3 interconnected pillars with icons", "ascending staircase with 5 labeled maturity levels", "hub-and-spoke model with central platform and 4 satellite services", "funnel visualization narrowing from 1000 leads to 50 deals"
```

### 3b. Add image selection rules to router system prompt (`getRouterSystemPrompt()`, ~line 1107+)

Add after the "FREESTYLE WITH LAYOUT GUIDANCE" section:

```
IMAGE SLIDES (AI-generated visuals):
When using templateId "image-full" or "image-content", provide "layoutGuidance" describing the VISUAL to generate.
- "image-full": Pure visual slide — the entire slide is one AI-generated image. Best for conceptual diagrams, strategic framework illustrations, transformation visuals, abstract concepts that are hard to express with HTML components alone.
- "image-content": Image in the content area + textual title/subtitle/footer. Best when you need a professional illustration alongside a clear textual insight.
- layoutGuidance for images should describe the VISUAL CONTENT specifically: "3 concentric circles showing strategy layers", "bridge diagram connecting current state to future state", "4 ascending pillars with growth metrics"
- ONLY suggest image templates when the content genuinely benefits from a visual that can't be achieved with CSS components (cards, grids, charts, etc.)
- Do NOT use image slides for: data tables, specific numerical charts, bullet-heavy content, org charts — regular templates handle these better
- Image slides are ideal for: conceptual frameworks, strategic visions, transformation journeys, abstract process flows, metaphorical illustrations
- The system will silently fall back to freestyle if imageModel is not configured — so image selection is always safe
```

### 3c. Add to TEMPLATE_KEYWORDS (~line 273)

```javascript
'image-full': ['image slide', 'visual slide', 'illustration', 'infographic', 'generate image', 'ai image', 'picture slide', 'diagram image', 'visual diagram'],
'image-content': ['image with text', 'illustrated slide', 'visual with title', 'image and text'],
```

### 3d. Add image template IDs to the router output format example (~line 1312)

Add examples showing image usage in the plan array.

---

## Step 4: Execution Integration — AIChatbot.jsx

**File:** `src/components/AIChatbot.jsx`

### 4a. Smart Action plan execution (~line 2220)

In the plan step execution loop, before the existing template/freestyle branching:

```javascript
// Image slide handling
const isImageSlide = templateId === 'image-full' || templateId === 'image-content';
if (isImageSlide) {
  if (!settings.imageModel) {
    // Fall back to freestyle — same layoutGuidance, just no image
    console.warn(`[SmartAction] Image template "${templateId}" requested but no imageModel configured, falling back to freestyle`);
    templateId = 'freestyle'; // Let it fall through to freestyle branch
  } else {
    const mode = templateId === 'image-full' ? 'full' : 'content';
    const imageSlideResult = await generateImageSlide(enrichedStepPrompt, settings, mode, {
      layoutGuidance: step.layoutGuidance,
      vibe: state.vibe,
      footerBranding: settings.footerBranding || 'Strategy&',
      slideNumber: freshState.slides.length + 1,
      totalSlides: freshState.slides.length + totalSteps,
    });
    if (imageSlideResult?.html) {
      const newSlide = {
        ...imageSlideResult,
        ...(step.sectionTracker ? { sectionLabel: step.sectionTracker } : {}),
        ...(step.subSectionTracker ? { subSectionLabel: step.subSectionTracker } : {}),
      };
      // Insert at correct position...
      slideInserted = true;
    }
  }
}
// If not image slide (or fallback), continue to existing template/freestyle logic
```

### 4b. Batched generation path (~line 2460)

Same pattern — check for image template IDs before the template/freestyle branch.

### 4c. Single-slide creation path (~line 3470)

Same pattern in the individual slide creation flow.

---

## Step 5: Execution Integration — agentToolRegistry.js

**File:** `src/services/agentToolRegistry.js`

### 5a. `create_slide` tool (~line 509)

Before the existing `if (templateId && templateId !== 'freestyle')` check, add:

```javascript
// Handle image slide templates
if ((templateId === 'image-full' || templateId === 'image-content') && settings.imageModel) {
  try {
    const mode = templateId === 'image-full' ? 'full' : 'content';
    const imageResult = await generateImageSlide(generationInstruction, settings, mode, {
      layoutGuidance: step?.layoutGuidance || null,
      vibe: state.vibe,
      footerBranding: settings.footerBranding || 'Strategy&',
      slideNumber: state.slides.length + 1,
    });
    if (imageResult?.html) {
      newSlide = {
        ...imageResult,
        ...(sectionLabel ? { sectionLabel } : {}),
        ...(subSectionLabel ? { subSectionLabel } : {}),
      };
    }
  } catch (imgErr) {
    console.warn(`[create_slide] Image generation failed, falling back to freestyle:`, imgErr.message);
    // newSlide remains null → falls through to freestyle
  }
}
```

### 5b. `create_slides_batch` tool (~line 755)

Same pattern before the template check in the batch loop.

---

## Step 6: CSS Styling

**File:** `src/styles/slides.css`

Add near the end of the component section (before the vibes/dark mode section):

```css
/* ── Image Slides ────────────────────────── */

/* Full-bleed image slide — no padding, image covers everything */
.slide.slide-image-full {
  padding: 0;
  overflow: hidden;
}

.slide-image-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Image in the content frame — fits within .frame boundaries */
.frame-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  border-radius: 4px;
}
```

---

## Graceful Degradation

- **`imageModel` not configured** → Router can still suggest `image-full`/`image-content`, but execution layer detects missing config and falls back to freestyle with the same `layoutGuidance`. No crash, no error shown to user.
- **Image generation API fails** → Caught in try/catch, logged as warning, falls through to freestyle generation.
- **Router never forced to pick image** → Image is just another option alongside templates and freestyle. Router picks it when it makes sense (conceptual visuals, illustrations), not for data-heavy or text-heavy content.

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `src/services/aiService.js` | `generateImage()` function, `generateImageSlide()` function, `buildTemplateList()` image section, `getRouterSystemPrompt()` image rules, `TEMPLATE_KEYWORDS` entries |
| `src/components/AIChatbot.jsx` | Handle `image-full`/`image-content` in plan execution (smart action, batch, single-slide) |
| `src/services/agentToolRegistry.js` | Handle image templates in `create_slide` and `create_slides_batch` |
| `src/styles/slides.css` | `.slide-image-full`, `.slide-image-cover`, `.frame-image` classes |

---

## Not in Scope (Follow-up)

- PPTX export for image slides (HTML/PDF export works out of the box via html2canvas)
- Image editing/regeneration UI (re-roll image button)
- Custom image size/quality/style settings in SettingsModal
- Image caching/storage optimization (base64 in HTML is fine for MVP)
