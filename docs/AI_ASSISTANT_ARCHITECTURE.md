# AI Assistant Architecture -- Edwin Slides Creator

Reference doc for the AI chat assistant flow. Covers what is actively used in production. Agent mode and vibe mode are disabled/inactive and excluded from this doc.

## Overview

The AI assistant is a **client-side, prompt-driven orchestration system**. All AI logic runs in the browser (React). The Express backend is just an API proxy that injects the PwC API key -- no AI logic lives server-side.

Entry point: `AIChatbot.jsx` -> `handleSubmit()`

## Unified Chat Architecture

The assistant uses a **single unified flow** (no manual mode toggle). A Tier 1 Quick Classifier auto-detects the scope of each request.

### Speed Modes (user-selectable toggle)

| Mode | Generation Model | Use Case |
|---|---|---|
| **Fast** (default) | `fastModel` (gpt-5.4) | Balanced quality, ~14s/slide |
| **Thinking** | `model` (opus-4-6) | Higher quality, ~20s/slide |

### Auto-Detected Scopes

| Scope | Trigger | Path |
|---|---|---|
| **Q&A** | Classifier returns `scope: 'qa'` | Direct `chatWithContext` response, no slide changes |
| **Direct** | Classifier returns `scope: 'single_slide'` + `needsPlanner: false` | Single-slide create/edit (no router) |
| **Planner** (default) | All other requests, or classifier failure | Full router + plan + multi-step execution |

---

## Path 1: "This Slide" (Single-Slide, No Router)

Fast path for working on one slide at a time. Uses the **fast model** for classification and the **main model** for generation.

### Step 1: Parallel Classify + Search

Two operations fire simultaneously:

**Classification** (fast model, `callWithModelFallback`):
- System: `"You classify slide editing requests. Return ONLY valid JSON."`
- Input: user prompt, current slide title/template, all slide titles
- Output JSON: `{ needsSearch, referenceSlides, isTemplateSwitch, templateId }`
- Skipped if slide is empty (no context to classify against)

**Web Search** (if `searchEnabled` + `searchEndpoint` configured):
- Short queries (<120 chars) go directly as search terms
- Longer queries get refined by the fast model first
- Appends `" latest " + currentDate` to the query
- Uses `webSearch()` -> Responses API with `web_search_preview` tool
- Runs speculatively; result is discarded if classifier says `needsSearch: false`

### Step 2: Execution Branch

Based on classification result and slide state:

| Condition | Action | Function |
|---|---|---|
| `isTemplateSwitch` detected | Switch layout | `transformSlideToTemplate()` |
| Slide is empty + has a real template | Fill template with content | `fillTemplateWithAI()` |
| Slide is empty + no template (freestyle) | Generate new slide | `generateSlides(count=1)` |
| Slide has content | Edit existing HTML | `improveSlide()` |

Search results, when used, are injected as `=== KEY FACTS FROM WEB SEARCH ===` blocks in the prompt. Deck context (position, neighbors, storyline) is also appended.

---

## Path 2: "Deck" (Full Router Pipeline)

Multi-step pipeline for creating or editing entire presentations.

### Step A: Router

Two router options with automatic fallback:

**AI Router** (`aiRouteRequest()` in `router.js`):
- Uses `routerModel` or `chatRouterModel` (configurable in settings)
- Massive system prompt (~460 lines in `getRouterSystemPrompt()`) covering:
  - Intent classification (create, edit, delete, Q&A)
  - Template selection per step
  - Plan generation as JSON array of steps
  - Web search integration (tool injected into the router call itself)
  - Cross-slide coherence via `contextFromStep`
  - Parallel execution groups
  - Clarification logic (can ask user for more info instead of generating)
- Falls back to rule-based if it fails

**Rule-based Router** (`routeRequest()` in `router.js`):
- `TEMPLATE_KEYWORDS`: keyword-to-template mapping (lines 13-103)
- `INTENT_PATTERNS`: regex-based action classification (lines 106-134)
- Fast, no API call needed. Used as fallback.

### Step B: SmartAction Card

After routing:
- **Deck mode**: Shows a `SmartActionCard` for user review/modification before execution
- **This Slide mode**: Auto-executes (no review card)
- **Answer-only plans**: If all steps are `answer_question`, responds with text directly

### Step C: Plan Execution (`executeFromSmartAction`)

Iterates through plan steps in **groups** (parallel within group, sequential across groups):

| Step Action | What Happens | Function Called |
|---|---|---|
| `create_slide` + template | Fill template with content | `fillTemplateWithAI()` |
| `create_slide` + freestyle | Generate custom HTML/CSS | `generateSlides()` |
| `edit_slide` | Modify existing slide HTML | `improveSlide()` |
| `delete_slide` | Remove slide from deck | Direct state action |
| `answer_question` | Text response, no slide changes | `chatWithContext()` |
| `analyze_content` | Content analysis, triggers replan | AI analysis + `aiRouteRequest()` |

Each step's prompt is enriched with:
- Step instruction (from router plan)
- `contextFromStep` data (cross-slide coherence)
- `searchRawContext` (router's search results, threaded to all steps)
- Knowledge base content (if attached)
- Cross-slide summaries (what prior steps produced)

**Parallel execution**: Steps within the same group run concurrently (batched by `parallelBatchSize`, default 3). The concurrency semaphore caps at 5 simultaneous API calls across the entire app.

---

## Generation Functions

### `generateSlides()` (slideGeneration.js)

Creates slides from scratch (freestyle or template-based).

- **Freestyle mode** (`!templateId` or `templateId === 'freestyle'`):
  - System prompt = `freestyle-slide-guide.md` (imported as raw text)
  - Minimal user prompt: content + context only (the guide has all the rules)
- **Template mode** (specific template selected):
  - System prompt = `DEFAULT_SYSTEM_PROMPT` with full examples
  - Template HTML injected as "STYLE GUIDE" with flexible adaptation rules

Output: Array of slide objects `{ title, html, customCSS, type, templateId, summary }`.

Post-generation validation: `validateFreestyleHTML()` checks for:
- Missing `h1.title` or `div.frame`
- Hardcoded colors (must use `var(--token)`)
- Layout properties in inline styles
- Custom classes without matching CSS rules
- Bare unstyled lists

### `fillTemplateWithAI()` (templateSelection.js)

Fills an existing template structure with content while preserving layout.

- Applies **role overrides** from `settings.roleSettings` (different models/params for agent vs chatbot mode)
- Has two content modes:
  - **Factual mode** (source content provided): preserves user data verbatim
  - **Creative mode** (topic only): generates realistic consulting content
- Template flex rules control item count adaptation (e.g., 3-card template can expand to 4)
- Extensive prompt section on content fidelity, executive writing style, overflow prevention

### `improveSlide()` (slideEditing.js)

Edits an existing slide's HTML based on user instructions. Uses `buildMinimalEditContext()` for deck awareness.

### `chatWithContext()` (agentServices.js)

Q&A function for questions about slides/deck. Builds context from:
- Current slide (full HTML)
- Referenced slides (if user says "slide 5")
- Full deck overview (all titles/types)

---

## API Layer

### Call Stack

```
UI function (generateSlides, fillTemplateWithAI, etc.)
  -> callWithModelFallback()     [apiClient.js]
       -> callGeminiAPI()        [handles ALL providers despite the name]
            -> fetch()           [actual HTTP call]
```

### `callWithModelFallback()` (apiClient.js)

1. Calls `callGeminiAPI()` with the primary model
2. On failure (non-429): looks up fallback models from `getFallbackModels()`
3. Tries each fallback in sequence from the same provider

### `callGeminiAPI()` (apiClient.js)

Despite the name, handles all providers. Branches internally:

**Non-Gemini path**: Uses `buildRequestBody()` which adapts to 3 API formats:
- **Responses API** -- GPT-5.x on OpenAI direct: `{ model, input, instructions, max_output_tokens }`
- **Anthropic Messages** -- Claude via Anthropic direct: `{ model, system, messages, max_tokens }`
- **Chat Completions** -- Everything else (Azure, LiteLLM proxy, PwC): `{ model, messages, max_tokens }`

**Gemini path**: Native format with `system_instruction`, `contents`, `generationConfig`:
- Gemini 2.5: `thinkingBudget` (integer token count)
- Gemini 3: `thinkingLevel` (LOW/MEDIUM/HIGH)
- Search: `web_search_preview` mapped to `{ googleSearch: {} }`

### Resilience

- **Concurrency semaphore**: Max 5 simultaneous API calls (configurable via `setApiMaxConcurrent`)
- **Retry**: 3 retries with jittered exponential backoff (2s, 4s, 8s base) for 5xx errors
- **429 handling**: Immediate fail, no retry (avoids worsening congestion)
- **Model fallback**: On non-rate-limit failure, tries other models from the same provider

### Response Parsing (`parseAPIResponseContent`)

Normalizes three response formats:
- Responses API: `data.output[].content[].text`
- Anthropic: `data.content[].text`
- Chat Completions: `data.choices[0].message.content`

---

## Model Resolution (`models.js`)

### `getCredentials(settings)`

Resolves `"providerId:modelName"` (e.g., `pwc:bedrock.anthropic.claude-opus-4-6`) to:

```
{
  apiKey, apiEndpoint, model, rawModel, provider,
  isGeminiProvider, isAnthropicProvider,
  azurePrefix, authType, useResponsesAPI,
  customHeaders, customParams
}
```

Key behaviors:
- `server-managed` auth: backend proxy adds the API key (no client-side auth headers)
- Azure prefix: prepends `azure.` to model name when `azurePrefix` is set
- GPT-5.x detection: switches endpoint to Responses API for OpenAI direct
- Gemini detection: checks URL patterns for `generativelanguage.googleapis.com` or `aiplatform.googleapis.com`

### Model Detection Helpers

- `isReasoningModel()`: matches `gpt-5`, `o1`, `o3`
- `isGeminiModel()`: matches `gemini-`
- `isGemini3Model()`: matches `gemini-3`
- `isGemini25Model()`: matches `gemini-2.5`
- `isClaudeModel()`: checks for `claude` in name

### Model Roles

| Role | Setting Key | Current Default | Used For |
|---|---|---|---|
| Main model | `settings.model` | `pwc:bedrock.anthropic.claude-opus-4-6` | Slide generation |
| Fast model | `settings.fastModel` | `pwc:openai.gpt-5.4-mini` | Classification, triage, auto-naming |
| Router model | `settings.routerModel` | (configurable) | Deck mode routing |
| Chat router model | `settings.chatRouterModel` | (configurable) | This Slide mode routing |
| Search model | `settings.searchModel` | (configurable) | Web search via Responses API |
| Slide creator | `roleSettings.slideCreator` | (inherits main) | Override model for template filling |
| PPTX generator | `roleSettings.pptxGenerator` | (inherits main) | PowerPoint code generation |

---

## Web Search

Two search integration points:

### 1. Router-Level Search (Deck path)

Search tool injected into the AI router call itself:
- OpenAI models: `web_search_preview` tool via Responses API
- Gemini models: `googleSearch` grounding via Chat Completions
- Results are "baked" into step instructions as `contextFromStep` data
- `searchRawContext` threaded to all execution steps

### 2. This Slide Search

Separate `webSearch()` call:
- Uses dedicated `settings.searchEndpoint` / `settings.searchModel`
- Responses API format with `web_search_preview` tool
- Results injected as `=== KEY FACTS FROM WEB SEARCH ===` block in the prompt

### Search Limitations

- **Claude models**: No search capability through the PwC proxy (tools silently stripped)
- **Azure models**: Cannot use Responses API (`/v1/responses` returns 404 for Azure-prefixed models)
- **Search must be explicitly configured**: `searchEnabled`, `searchEndpoint`, `searchApiKey`, `searchModel` all required

---

## Key Files

| File | Purpose |
|---|---|
| `components/AIChatbot.jsx` | Entry point, orchestration, UI, all execution logic |
| `services/ai/router.js` | Rule-based router + AI router (system prompt, plan generation) |
| `services/ai/slideGeneration.js` | `generateSlides()` + `validateFreestyleHTML()` |
| `services/ai/templateSelection.js` | `fillTemplateWithAI()` + template evaluation |
| `services/ai/apiClient.js` | `callWithModelFallback()`, `callGeminiAPI()`, `buildRequestBody()` |
| `services/ai/agentServices.js` | `chatWithContext()`, `webSearch()`, `triageRequest()`, `agentChat()` |
| `services/ai/models.js` | Model detection, credential resolution, provider headers |
| `services/ai/slideEditing.js` | `improveSlide()` for editing existing slides |
| `services/ai/improveSlideOrchestrator.js` | Search enrichment, slide context building |
| `services/ai/constants.js` | Shared prompts, CSS guide, system prompt defaults |
| `guides/freestyle-slide-guide.md` | System prompt for freestyle slide generation |
| `context/SlideContext.jsx` | Deck state, settings, model defaults |

---

## Inactive Features (excluded from this doc)

- **Agent mode** (`useAgenticMode`): Defaults to `false`, gated behind `settings.enableAgenticMode`. When active, adds a triage + content preparation layer before the router. Uses `agenticExecution.prepareContent()` with worker tools.
- **Report mode** (`useReportMode`): Defaults to `false`, forces agent mode for interactive report generation.
- **Vibe system** (`state.vibe`): Defaults to `'default'` (Base). Vibes are CSS-only design variations (`data-vibe` attribute) that change aesthetics without affecting layout. The default vibe applies no modifications -- just standard Strategy& CSS.
- **Image mode** (`useImageMode`): Toggle for image-based slide generation when an image model is configured.
