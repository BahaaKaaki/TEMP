# PwC GenAI Shared Services API Reference

> Tested and verified on 2026-03-31.
> This file is a development reference for Edwin Slides Creator.
> API key is stored in `backend/.env` as `PWC_API_KEY`.

---

## 1. Connection Details

| Property | Value |
|---|---|
| Base URL | `https://genai-sharedservice-emea.pwcinternal.com` |
| Auth header | `Authorization: Bearer <API_KEY>` |
| Protocol | OpenAI-compatible (LiteLLM proxy) |
| Total models | 168 across 5 providers |
| Providers | Azure, OpenAI Direct, Vertex AI (Google), Amazon Bedrock, (Realtime) |

---

## 2. API Endpoints

### 2.1 Chat Completions (primary)

| Endpoint | Method | Works with |
|---|---|---|
| `/chat/completions` | POST | All providers (Azure, OpenAI, Vertex, Bedrock) |
| `/v1/chat/completions` | POST | Same (aliased) |
| `/openai/deployments/{model}/chat/completions` | POST | Azure-style path routing |

**Request format**: Standard OpenAI chat completions (model, messages, temperature, max_tokens, tools, etc.)

**Response format**: Standard `choices[0].message.content` with usage stats.

**Notes**:
- Gemini models via Vertex AI use thinking tokens from `max_tokens` budget. Set `max_tokens` high enough (e.g., 100+) or output will be empty.
- Gemini response may include `thinking_blocks` and `images` empty arrays.
- Bedrock Claude responses are standard.

### 2.2 Responses API (OpenAI only)

| Endpoint | Method | Works with |
|---|---|---|
| `/v1/responses` | POST | **OpenAI Direct models only** (`openai.*`) |
| `/responses` | POST | Same (aliased) |

**CRITICAL**: Azure models (`azure.*`) return 404 -- "Azure OpenAI Responses API is not enabled in this region." Only `openai.*` prefixed models work.

**Request format**:
```json
{
  "model": "openai.gpt-5.4-mini",
  "input": "string or array of messages",
  "instructions": "system prompt (optional)",
  "tools": [{"type": "web_search_preview", "search_context_size": "medium"}],
  "reasoning": {"effort": "low"},
  "max_output_tokens": 2000,
  "temperature": 0.1
}
```

**Response format**:
```json
{
  "output": [
    {"type": "web_search_call", "action": {"query": "...", "queries": ["...", "..."], "type": "search"}, "status": "completed"},
    {"type": "message", "content": [{"type": "output_text", "text": "...", "annotations": [...]}], "phase": "final_answer"}
  ],
  "usage": {"input_tokens": N, "output_tokens": N, "total_tokens": N}
}
```

### 2.3 Embeddings

| Endpoint | Method |
|---|---|
| `/embeddings` | POST |
| `/v1/embeddings` | POST |

Models: `azure.text-embedding-3-small`, `azure.text-embedding-3-large`, `azure.text-embedding-ada-002`, `vertex_ai.gemini-embedding`, `vertex_ai.text-embedding-005`, `bedrock.amazon.titan-embed-*`

### 2.4 Image Generation

| Endpoint | Method |
|---|---|
| `/images/generations` | POST |
| `/v1/images/generations` | POST |

Models: `openai.gpt-image-1`, `openai.gpt-image-1-mini`, `openai.gpt-image-1.5`, `vertex_ai.imagen-*`, `vertex_ai.gemini-*-image*`, `bedrock.amazon.nova-canvas-v1`

### 2.5 Other Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /models` | List all available models |
| `POST /audio/speech` | Text-to-speech |
| `POST /audio/transcriptions` | Speech-to-text |
| `POST /rerank` | Document reranking |
| `POST /completions` | Legacy text completion |

---

## 3. Web Search (Detailed)

Web search is available through TWO independent paths:
1. **OpenAI Responses API** (`openai.*` models) -- `web_search_preview` tool
2. **Gemini Google Search grounding** (`vertex_ai.gemini-*` models) -- `google_search` tool via Chat Completions

Claude models have **no search capability** through this proxy.

### 3.1 How It Works

1. The model receives the input and decides to search
2. One or more `web_search_call` items appear in `output[]`
3. Each search call has an `action` with:
   - `query`: The primary search query the model crafted
   - `queries`: Array of 2-4 query variations the model searched
   - `type`: Usually `"search"`, sometimes `"open_page"` (model navigates to a specific URL)
4. After searching, the model synthesizes results into a `message` with `output_text`
5. The text includes **inline URL citations** via `annotations[]`

### 3.2 Citation Format (annotations)

Each citation in the response text is an annotation object:
```json
{
  "start_index": 189,
  "end_index": 387,
  "title": "IMF / Regional Economic Outlook...",
  "type": "url_citation",
  "url": "https://mediacenter.imf.org/...?utm_source=openai"
}
```
- `start_index` / `end_index`: Character positions in the `text` field marking the cited passage
- `title`: Page title of the source
- `url`: Full URL (always has `?utm_source=openai` appended)
- The model does NOT return raw search snippets -- it synthesizes all search content into its response text

### 3.3 search_context_size Parameter

Controls how much search context is fed to the model:

| Value | Input tokens (observed) | Behavior |
|---|---|---|
| `low` | ~12K | Fewer results ingested, but model may make additional `open_page` calls to compensate |
| `medium` | ~8K | Good balance, standard search depth (recommended default) |
| `high` | ~8.5K | Deeper search context, more sources, slightly more expensive |

**Recommendation**: Use `medium` for router/search. Use `high` only for data-heavy research queries.

### 3.4 Model Comparison for Search

| Model | Speed | Search calls | Quality | Cost |
|---|---|---|---|---|
| `openai.gpt-5.4-nano` | Fast (~10s) | 1-2 + may `open_page` | Good, concise | Lowest |
| `openai.gpt-5.4-mini` | Medium (~10s) | 1-2 | Good, balanced citations | Low |
| `openai.gpt-5.4` | Slower (~12s) | 1 | Best, detailed table formatting, more sources | Higher |

### 3.5 Gemini Google Search Grounding (NEWLY DISCOVERED)

Gemini models support web search via the **Chat Completions API** using `{"google_search": {}}` as a tool. This is a separate path from the OpenAI Responses API and works with standard `/chat/completions`.

**Request format** (Chat Completions):
```json
{
  "model": "vertex_ai.gemini-2.5-flash",
  "messages": [{"role": "user", "content": "..."}],
  "max_tokens": 500,
  "tools": [{"google_search": {}}]
}
```

**Response includes** (in addition to standard message content):

1. **`annotations[]`** in message content -- URL citations with `start_index`, `end_index`, `title`, `url` (URLs go through `vertexaisearch.cloud.google.com/grounding-api-redirect/...`)

2. **`vertex_ai_grounding_metadata[]`** -- Rich grounding data:
   - `webSearchQueries`: Array of 3-4 search queries the model crafted
   - `groundingChunks[]`: Array of source objects with `uri`, `title`, `domain`
   - `groundingSupports[]`: Maps text segments to supporting chunks (segment-level provenance)
   - `searchEntryPoint.renderedContent`: Google Search branded HTML widget

3. **Gemini via Responses API** also works -- the proxy translates the call. Takes ~15s.

**Gemini search is richer than OpenAI search**: It provides segment-level grounding (which source supports which sentence), domain-level metadata, and the original search queries. OpenAI only provides URL citations without segment-provenance mapping.

**Tested**: `vertex_ai.gemini-2.5-flash` with `{"google_search": {}}` returned Saudi Arabia GDP forecasts from IMF, World Bank, Fitch, Standard Chartered, and Riyad Capital -- with 13 grounding chunks across 7+ domains, all in ~6s.

**Important**: The tool format is `{"google_search": {}}`, NOT `{"googleSearchRetrieval": {}}` (deprecated) or `{"type": "google_search_retrieval"}`.

### 3.6 Claude Models -- No Search

Claude models (Bedrock and Vertex AI) have **no web search capability** through this proxy. When `web_search_preview` is passed via the Responses API, it is silently stripped (`tools: []` in response) and the model responds from training data only.

### 3.7 Search Path Summary

| Provider | Chat Completions search | Responses API search | Tool format |
|---|---|---|---|
| OpenAI (`openai.*`) | No | **Yes** | `{"type": "web_search_preview"}` |
| Azure (`azure.*`) | No | **No** (404 error) | N/A |
| Gemini (`vertex_ai.gemini-*`) | **Yes** | **Yes** (proxy translates) | `{"google_search": {}}` |
| Claude (`bedrock.*`, `vertex_ai.anthropic.*`) | No | No (silently stripped) | N/A |

### 3.8 What Search Does NOT Provide

- **No raw search snippets**: Both OpenAI and Gemini synthesize content into prose with citations
- **No control over sources**: You cannot restrict or prefer specific domains
- **Gemini redirect URLs**: Gemini citations go through `vertexaisearch.cloud.google.com/grounding-api-redirect/...` (not direct URLs)
- **OpenAI `open_page`**: Nano model sometimes navigates to specific URLs, but content is consumed internally

### 3.9 Integration with Edwin

The app uses web search in two paths:

**Path A (GPT router -- Responses API)**: Router calls `/v1/responses` with `web_search_preview` + system prompt + context. The model searches AND plans in a single call. Search data is embedded directly in the plan instructions.

**Path B (Legacy pre-search)**: For non-GPT routers (Gemini, Claude), a separate search call runs first, and results are prepended to the router context as `=== WEB SEARCH RESULTS ===`.

**Per-step search**: Individual slide generation steps can have a `searchQuery` field. The executor runs a separate Responses API call for that query and injects results into the step's prompt.

---

## 4. Available Models by Category

### 4.1 Chat / Generation Models

#### GPT Family (Azure + OpenAI Direct)

| Model | Provider | Tier | Notes |
|---|---|---|---|
| `azure.gpt-5.1` / `openai.gpt-5.1` | Azure / OpenAI | Flagship | Latest GPT. Azure for Chat Completions, OpenAI for Responses API. |
| `azure.gpt-5` / `openai.gpt-5` | Azure / OpenAI | Flagship | Stable. Both providers available. |
| `openai.gpt-5.4` | OpenAI | Flagship (latest) | March 2026. Supports Responses API + search. |
| `openai.gpt-5.4-mini` | OpenAI | Strong | Fast, good quality, supports search. |
| `openai.gpt-5.4-nano` | OpenAI | Fast | Ultra-fast, cheapest. Good for classification. |
| `azure.gpt-4.1` / `openai.gpt-4.1` | Azure / OpenAI | Strong (prev gen) | Reliable, well-tested. |
| `azure.gpt-4.1-mini` / `openai.gpt-4.1-mini` | Azure / OpenAI | Fast (prev gen) | Good balance. |
| `azure.gpt-4.1-nano` / `openai.gpt-4.1-nano` | Azure / OpenAI | Cheapest (prev gen) | Tested: 658ms response time. |
| `azure.gpt-4o` / `openai.gpt-4o` | Azure / OpenAI | Legacy | Still available but superseded. |
| `azure.gpt-4o-mini` / `openai.gpt-4o-mini` | Azure / OpenAI | Legacy fast | Still available. |

#### Reasoning Models

| Model | Provider | Notes |
|---|---|---|
| `azure.o3` / `openai.o3` | Azure / OpenAI | Strong reasoning |
| `azure.o3-mini` / `openai.o3-mini` | Azure / OpenAI | Fast reasoning |
| `azure.o4-mini` / `openai.o4-mini` | Azure / OpenAI | Latest mini reasoning |
| `azure.o1` / `openai.o1` | Azure / OpenAI | Original reasoning model |

#### Gemini Family (Vertex AI)

| Model | Tier | Notes |
|---|---|---|
| `vertex_ai.gemini-2.5-pro` | Flagship | Strong reasoning, long context |
| `vertex_ai.gemini-2.5-flash` | Strong | Tested: 1224ms. Good quality, fast. Uses thinking tokens. |
| `vertex_ai.gemini-2.5-flash-lite` | Fast | Lightweight |
| `vertex_ai.gemini-2.0-flash` | Fast (prev gen) | Stable, well-tested |
| `vertex_ai.gemini-2.0-flash-lite` | Cheapest | Minimal |
| `vertex_ai.gemini-3-pro-preview` | Preview | Next-gen pro. Heavy thinking tokens (92/100 budget). Needs high max_tokens. ~5s. |
| `vertex_ai.gemini-3-flash-preview` | Preview | Next-gen flash. Also heavy thinking tokens (94/100). ~2s. |
| `vertex_ai.gemini-3.1-pro-preview` | Preview | Latest. Same thinking token behavior as 3 Pro. ~5s. |
| `vertex_ai.gemini-3.1-flash-lite-preview` | Preview (fast) | **Tested 1.7s**. No heavy thinking overhead. Very fast. Potential fast model candidate. |

#### Claude Family (Bedrock)

| Model | Tier | Notes |
|---|---|---|
| `bedrock.anthropic.claude-opus-4-6` | Flagship | Most capable Claude |
| `bedrock.anthropic.claude-opus-4-5` | Flagship | Previous opus |
| `bedrock.anthropic.claude-sonnet-4-6` | Strong | Tested: 1230ms. Good quality, fast. |
| `bedrock.anthropic.claude-sonnet-4-5` | Strong | Previous sonnet |
| `bedrock.anthropic.claude-sonnet-4` | Strong | Stable |
| `bedrock.anthropic.claude-haiku-4-5` | Fast | Cheapest Claude |
| `bedrock.anthropic.claude-3-haiku` | Legacy fast | Still available |

#### Claude via Vertex AI

| Model | Tier | Notes |
|---|---|---|
| `vertex_ai.anthropic.claude-opus-4-6` | Flagship | Same model, Vertex routing |
| `vertex_ai.anthropic.claude-sonnet-4-6` | Strong | Same model, Vertex routing |
| `vertex_ai.anthropic.claude-haiku-4-5` | Fast | Same model, Vertex routing |

### 4.2 Image Generation Models

| Model | Provider | Type |
|---|---|---|
| `openai.gpt-image-1` | OpenAI | DALL-E successor |
| `openai.gpt-image-1-mini` | OpenAI | Lighter/faster |
| `openai.gpt-image-1.5` | OpenAI | Latest |
| `vertex_ai.imagen-4.0-generate-001` | Vertex AI | Latest Imagen |
| `vertex_ai.imagen-4.0-fast-generate-001` | Vertex AI | Faster Imagen |
| `vertex_ai.imagen-3.0-generate-001` | Vertex AI | Previous Imagen |
| `vertex_ai.gemini-2.5-flash-image` | Vertex AI | Gemini image gen |
| `vertex_ai.gemini-3-pro-image-preview` | Vertex AI | Preview |
| `bedrock.amazon.nova-canvas-v1` | Bedrock | Amazon image gen |

### 4.3 Embedding Models

| Model | Provider | Dimensions |
|---|---|---|
| `azure.text-embedding-3-small` | Azure | 1536 (default) |
| `azure.text-embedding-3-large` | Azure | 3072 (default) |
| `azure.text-embedding-ada-002` | Azure | 1536 |
| `vertex_ai.gemini-embedding` | Vertex AI | Variable |
| `vertex_ai.text-embedding-005` | Vertex AI | 768 |
| `bedrock.amazon.titan-embed-text-v2` | Bedrock | Variable |

### 4.4 Other Models

| Model | Type | Provider |
|---|---|---|
| `openai.gpt-4o-mini-tts` | Speech | OpenAI |
| `openai.whisper` / `openai.gpt-4o-transcribe` | Transcription | OpenAI |
| `bedrock.cohere.rerank-3-5` | Rerank | Bedrock |
| `openai.gpt-5-codex` / `openai.gpt-5.4-pro` | Responses-only | OpenAI |
| `openai.o3-deep-research` | Deep research | OpenAI |

---

## 5. Provider Prefix Mapping

The PwC shared service uses prefixed model names to route to the correct provider:

| Prefix | Provider | API path |
|---|---|---|
| `azure.*` | Azure OpenAI | Chat Completions only (no Responses API) |
| `openai.*` | OpenAI Direct | Chat Completions + Responses API + Search |
| `vertex_ai.*` | Google Vertex AI | Chat Completions only |
| `bedrock.*` | Amazon Bedrock | Chat Completions only |
| (no prefix) | OpenAI (realtime) | Realtime API |

### Edwin's Internal Provider Mapping

Edwin uses `providerId:modelName` format (e.g., `openai:gpt-5.4`). The `providerId` maps to a provider config with `apiKey`, `baseUrl`, etc. The `modelName` is sent as the `model` field in API calls.

**Important**: When sending to the PwC proxy, the model name must include the provider prefix (e.g., `azure.gpt-4.1-nano`, NOT just `gpt-4.1-nano`). The proxy strips internal routing but needs the prefix to identify the upstream provider.

---

## 6. Model Role Recommendations for Edwin

Based on testing (latency, quality, cost, API compatibility):

| Role | Primary Recommendation | Fallback | Rationale |
|---|---|---|---|
| **Main (slide generation)** | `bedrock.anthropic.claude-opus-4-6` | `openai.gpt-5.4` | **Current default**. Premium HTML/CSS quality. ~20s/slide. No search (Claude limitation). |
| **Router (deck mode)** | `openai.gpt-5.4` | `openai.gpt-5.4-mini` | Needs Responses API for inline web search during planning. |
| **Router (chat/this-slide)** | `openai.gpt-5.4` | `openai.gpt-5.4-mini` | Same search requirement. |
| **Classifier** | `openai.gpt-5.4-mini` | `azure.gpt-4.1-nano` | Tier 1 quick classifier, auto-naming. |
| **Fast generation** | `vertex_ai.gemini-3.1-flash-lite-preview` | `openai.gpt-5.4` | **5.3s/slide** vs 14s for GPT 5.4. Good layout quality. |
| **Search model** | `openai.gpt-5.4-mini` | `vertex_ai.gemini-2.5-flash` (via google_search) | Responses API or Gemini grounding. |
| **PPTX generation** | `azure.gpt-5` | `azure.gpt-4.1` | Needs strong code generation for PptxGenJS. No search needed. |
| **Report generation** | `azure.gpt-4.1-mini` | `azure.gpt-4.1` | Chart.js HTML reports. Mid-tier sufficient. |
| **Image generation** | `openai.gpt-image-1` | `vertex_ai.imagen-4.0-generate-001` | Best quality for consulting-style visuals. |
| **Embeddings** | `azure.text-embedding-3-small` | `vertex_ai.text-embedding-005` | Fast, cheap, good for template matching. |

---

## 7. Tested API Calls (Verified Working)

| Test | Model | Endpoint | Result | Latency |
|---|---|---|---|---|
| Chat Completions | `azure.gpt-4.1-nano` | `/chat/completions` | OK | 658ms |
| Chat Completions | `vertex_ai.gemini-2.5-flash` | `/chat/completions` | OK | 1224ms |
| Chat Completions | `bedrock.anthropic.claude-sonnet-4-6` | `/chat/completions` | OK | 1230ms |
| Responses API | `openai.gpt-5.4-nano` | `/v1/responses` | OK | 967ms |
| Responses API | `openai.gpt-5.4-mini` | `/v1/responses` | OK | ~10s (with search) |
| Responses API | `openai.gpt-5.4` | `/v1/responses` | OK | ~12s (with search) |
| Responses API | `azure.gpt-4.1-nano` | `/v1/responses` | **FAIL** (404) | N/A |
| Web search (low) | `openai.gpt-5.4-nano` | `/v1/responses` | OK, 2 search calls + open_page | ~10s |
| Web search (medium) | `openai.gpt-5.4-mini` | `/v1/responses` | OK, 1 search call, 4 citations | ~10s |
| Web search (high) | `openai.gpt-5.4` | `/v1/responses` | OK, 1 search call, 4 citations, table formatting | ~12s |
| Gemini google_search | `vertex_ai.gemini-2.5-flash` | `/chat/completions` | **OK**, 13 grounding chunks, 7+ domains, rich metadata | ~6s |
| Gemini via Responses API | `vertex_ai.gemini-2.5-flash` | `/v1/responses` | OK, proxy translates to Gemini format | ~15s |
| Claude Responses API | `bedrock.anthropic.claude-sonnet-4-6` | `/v1/responses` | web_search silently stripped, no search | 3s |
| Gemini 3.1 flash lite | `vertex_ai.gemini-3.1-flash-lite-preview` | `/chat/completions` | OK, fast, no thinking overhead | **1.7s** |
| Gemini 3.1 Pro | `vertex_ai.gemini-3.1-pro-preview` | `/chat/completions` | OK, heavy thinking tokens | 4.6s |
| Gemini 3 Flash | `vertex_ai.gemini-3-flash-preview` | `/chat/completions` | OK, heavy thinking tokens | 2.1s |

---

## 8. Slide Generation Benchmark

Tested with identical prompt: "Create a slide showing 3 strategic pillars" with system prompt for consulting-style HTML/CSS output.

| Model | Latency | Tokens (prompt/completion) | Output chars | Finished? | Quality notes |
|---|---|---|---|---|---|
| `bedrock.anthropic.claude-opus-4-5` | **22s** | 121 / 2000 | 4433 | Truncated (hit limit) | Polished cards, accent borders, metric sections. Verbose CSS. |
| `bedrock.anthropic.claude-opus-4-6` | **23s** | 122 / 2000 | 4660 | Truncated (hit limit) | SVG icons, `color-mix()`, layered headers. Most visually sophisticated. |
| `openai.gpt-5.4` | **14s** | 114 / 1252 | 4170 | Complete | Grid layout, `color-mix()`. Most token-efficient. |
| `bedrock.anthropic.claude-sonnet-4-6` | **~5s** | ~120 / ~1200 | ~3800 | Complete | Good quality, fast. Best speed/quality ratio for bulk. |
| `vertex_ai.gemini-2.5-flash` | **~3s** | ~120 / ~800 | ~2800 | Complete | Fast but simpler output. Good for drafts. |

**Full comparison (4K token budget, identical prompt)**:

| Model | Latency | Tokens used | Output | Style |
|---|---|---|---|---|
| `bedrock.anthropic.claude-opus-4-5` | 20.3s | 2036 | 4675 chars | SVG icons, explicit 904x366 sizing, large pillar numbers |
| `bedrock.anthropic.claude-opus-4-6` | 20.9s | 1647 | 4409 chars | Emoji icons, translucent numbering, subtitle+divider, 20% more token-efficient |

**Recommendation for slide generation (main model)**:
- **Current default**: `bedrock.anthropic.claude-opus-4-6` -- the project's configured main model
- **Quality-first (alternative)**: `bedrock.anthropic.claude-opus-4-5` -- SVG icons, heavier CSS, more explicit
- **Balanced**: `openai.gpt-5.4` -- strong quality, ~14s (30% faster than Opus), most token-efficient
- **Speed-first**: `bedrock.anthropic.claude-sonnet-4-6` -- good quality at ~5s per slide
- **Bulk/draft**: `vertex_ai.gemini-2.5-flash` -- fastest, acceptable for iteration

The project uses `bedrock.anthropic.claude-opus-4-6` as the main/heavy model (set in SlideContext.jsx defaults). It produces polished consulting-style slides but needs generous token budgets (4000+) and is ~45% slower than GPT 5.4.

---

## 9. Key Constraints and Gotchas

1. **Responses API is OpenAI-only**: Azure, Gemini, and Claude models cannot use `/v1/responses`. Web search requires this endpoint.
2. **Gemini thinking tokens**: Gemini 2.5+ models consume `max_tokens` for thinking. Set `max_tokens` generously or output will be truncated/empty.
3. **Model prefix required**: Always include the provider prefix (`azure.`, `openai.`, `vertex_ai.`, `bedrock.`) in the model name.
4. **No raw search results**: The Responses API synthesizes search content into prose with URL citations. There is no way to get raw search snippets, rankings, or page content separately.
5. **Nano model searches differently**: `gpt-5.4-nano` sometimes uses `open_page` actions to navigate to specific URLs for more context, while larger models rely on search snippets alone.
6. **Codex and Pro models**: `openai.gpt-5.4-pro`, `openai.gpt-5-codex`, etc. are Responses-only models (no Chat Completions). They may offer enhanced capabilities but require the Responses API path.
7. **Rate limits**: Not explicitly tested. The PwC proxy likely has team-level rate limits. Monitor 429 responses.
8. **All models show `owned_by: "openai"`**: This is a LiteLLM proxy artifact -- it does not mean they are all OpenAI models.
