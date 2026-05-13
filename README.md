# Edwin Slides Creator

AI-powered presentation generator that creates professional slide decks using PwC Shared Services GenAI API.

## Project Structure

```
.
├── slide-generator/    # React + Vite frontend (port 5173)
├── backend/            # Express API server + AI proxy (port 3001)
├── gpt-export/         # ChatGPT custom GPT knowledge files
├── examples/           # Sample HTML decks and templates
└── docs/               # Architecture, runbooks, and feature planning docs
```

## Features

- AI slide generation via PwC Shared Services (premium model: `bedrock.anthropic.claude-opus-4-7`)
- Backend AI proxy -- API key stays server-side, never exposed to browser
- Basic HTTP authentication (credentials set via environment variables)
- Agentic workflow (consulting team agent with manager/worker roles)
- Monaco-based slide editor (HTML/CSS)
- PowerPoint (.pptx) export via PptxGenJS with template-aware merging (logo injection, master shape isolation, smart layout selection, template position awareness, native table export guidance, table-cell marker safeguards, single-line tracker chrome, Strategy& 7.5pt footer/source/page chrome, PowerPoint XML sanitation, export prompts that steer `fit: 'resize'` where body text should track content height plus even bullet spacing, and a post-pass that rasterizes small inline SVG icon hosts to transparent PNG overlays so glyphs match the slide preview)
- Knowledge base / RAG for contextual generation
- Theme and template system with CSS variables
- Client template profiles can switch generation away from the default Strategy& look; STC, PIF LDC, and DGE ship as full profiles with semantic theme tokens, layout CSS variables, prompt-section overrides, bundled masters/assets, PPTX export hints, evidence metadata, and validation rules
- Client profile prompt overrides now inherit non-negotiable slide-generator guardrails (inline sentence flow, shared row/column headers instead of repeated tags, one dominant structure, and strict no-overlap/no-overflow fit) so theme/profile switches keep the same core quality constraints
- Client-profile geometry and theme state are applied at slide creation and PPTX export: active profiles rewrite generic frame/chart guidance, keep new/cleared decks on the selected profile theme, preserve Strategy& master chrome during template merge, carry client master theme palettes into controlled exports, use profile-shaped PPTX examples, normalize exported body objects into the declared content band, keep STC section trackers clear of the logo with 9px text-only reference coloring, render PIF's 10 x 5.625 in LDC shell with Fund typography and gold page-number block, sanitize invalid negative shape dimensions, de-duplicate PowerPoint shape IDs, clamp zero-size extents, and load bundled masters/assets through profile-driven routes with token-refresh retry
- Web search via PwC Responses API
- Expired Microsoft sessions surface a visible re-auth prompt when MSAL silent token refresh or backend 401 recovery fails; active-use failures show as a top-center banner
- User Settings include generation defaults for slide approach (Auto/Freestyle) and model tier (Fast/Premium); Freestyle mode tells the router to use cover only for cover slides and freestyle for body slides unless the user explicitly requests a named template or layout
- Voice dictation in the AI chat input uses browser speech recognition to place editable transcript text into the prompt before sending
- AI plan review cards keep long section trackers, template names, and instructions constrained within the chat panel
- Router search policy uses GPT 5.5 reasoning by default, but only attaches web search for requests that need current or external evidence; Responses API router failures fall back to Chat Completions planning, router evidence is packaged as structured metadata. After planning, redundant per-step `searchQuery` values are dropped when the router already ran web search and the step has `facts[]` (unless the step depends on a prior step via `contextFromStep`). Remaining per-step `webSearch()` calls use `openai.gpt-5.4-mini` by default (loaded from shipped defaults, not stale localStorage) with caching/budgeting, while still overriding older router facts when fresher results conflict
- Slide preview includes a source inspector for evidence-backed slides: router/per-step search URLs, raw URLs, and in-slide links are shown as clickable verification cards; generic footer source labels are ignored unless no URL-backed source exists
- Slide rendering runs a post-mount normalization (`slideDomNormalize.js`) and frame-level CSS so `display:flex` on prose cannot split loose text and `<strong>` / `<em>` into separate flex columns; emphasis stays inline inside wrapped prose blocks
- Router planning prompt lives in `slide-generator/src/guides/router-system-prompt.md` and now enforces a strict allowed-template set (`cover`, `sectionDivider`, `outcomeApproach`, `chevronFlow`, `projectStepDetail`, `freestyle`) with stronger tracker hierarchy, layout-density, storyline sequencing rules, and subtitle discipline (short noun phrases up to six words; no em dashes, colons, or clauses)
- Slide HTML generation prompt lives in `slide-generator/src/guides/slide-html-generator-prompt.md` (Strategy& executive consulting contract: subtitle discipline, mandatory content normalization before layout choice, sentence-level HTML integrity including explicit inline display on prose divs and `<strong>` / `<em>`, clarity, hierarchy, whitespace, bullet box sizing, non-overlapping/non-overflowing fit, shared-label / shared-grid rules, explicit geometry for complex visuals, strict token-only scoped CSS on `.frame`)
- The slide HTML generator guide is now a single canonical prompt block (legacy duplicate prompt sections removed) so deployed behavior matches one authoritative prompt contract
- Freestyle slide generation with full creative freedom (AI generates custom HTML + scoped CSS per slide)
- Complex chart generation uses fixed-coordinate geometry guidance for waterfall/bridge/bar-style exhibits, with inline numeric positioning allowed only for chart marks
- Template auto-match now attaches the selected template's extracted CSS consistently across create, insert, fill, and switch paths
- Reused template CSS is normalized through per-slide `data-slide-id` scoping on add/update, including CSS blocks with comments before selectors
- Template switching strips model-returned `<style>` blocks when template CSS is applied, reducing conflicts between generated CSS and extracted template CSS
- Cross-slide format matching keeps the displayed target and executed slide aligned while passing referenced slide HTML plus unscoped `customCSS`, so "make this like slide N" has the actual visual rules, not just markup; router planning repairs invalid self/future `contextFromStep` dependencies before display, and execution still validates dependencies before dependent slides reuse generated structure and ordering
- Independent multi-slide edits that share the same reference slide now run in parallel when they target different concrete pages, with execution progress showing the parallel edit batch
- Explicit slide reorder prompts such as `3-4-2-5-6` or `reorder slides 4 and 5` are handled deterministically without an AI planning call, preserving omitted slides in their existing relative order; the create/delete guard is scoped to pure reorder requests so broader deck restructuring can still change content
- Slide typography is normalized on generation/import/update and PPTX export: compact tags, chips, badges, and tracker labels may use 8px/8pt; Strategy& footer/source/page chrome follows the master at 7.5pt; normal text stays at least 10px/10pt, body copy targets 12px/12pt, and section/pillar/card titles target 14px/14pt
- Deck-aware routing uses active-page text, layout mix, section maps, and enriched storyline context for follow-on deck requests
- Triage now selects context depth (`active_slide`, `reference_slides`, `deck_digest`, or `full_text_deck`) and separates target slides from reference slides for cross-slide edits
- Section and subsection trackers can be updated as slide metadata without regenerating slide HTML
- Executive summary trackers are derived from recognizable parent-page wording, including freestyle HTML with arbitrary div/span classes, and apply to body slides rather than the executive summary slide
- Prompt Debug settings expose router, triage, generation, edit, validation, and PPTX prompt overrides plus recent prompt payloads for troubleshooting look and feel
- Multi-round clarification cards submit answers from the active question card, so follow-up question sets preserve first, second, and later-round user preferences
- Router context includes the active page's full HTML structure without CSS, so planning can see card/pillar/table hierarchy instead of relying only on text digests
- Rich storyline sync from existing slides also analyzes each slide's full HTML structure without CSS and stores a `contentInventory` for pillars, cards, bullets, metrics, table rows, and labels
- New slides use compact stable IDs while older UUID-based decks continue to load unchanged
- Auto-fetch available models from PwC Shared Services `/models` endpoint with grouped vendor display
- Deck-aware template switching with pillar preservation and optional user guidance
- Consulting Skills -- single-select playbook dropdown in the AI Assistant panel that steers the planner with a specific deliverable template (proposal, strategic plan, business case, etc.). Spans eight categories: Strategy; Commercial & Customer; Operating Model & Governance; Strategic and Financial Decision Support; Value Creation and Performance; Transformation & Execution; Stakeholder & Workshop; Proposal and Executive Communication.

## Consulting Skills

Consulting Skills are markdown playbooks that steer the planner toward a specific deliverable shape (proposal, strategic plan, business case, org design, etc.). They are injected only into the **router** system prompt -- not into slide rendering, edits, transforms, or validation.

### How it works

1. Skill markdown files live in `backend/skills/*.md`. Each file has YAML front matter (`name`, `description`) plus body sections including "Inputs the skill needs".
2. `backend/src/modules/skills/skills.service.ts` loads the catalogue lazily on first `/api/skills` request and exposes only the skills listed in its `CATEGORY_MAP`. Bodies stay server-side -- the API returns metadata only (`id`, `name`, `description`, `category`, `order`).
3. The frontend fetches the catalogue once via `slide-generator/src/services/skillsService.js` and stores it as `state.availableSkills` in `SlideContext`.
4. The user picks **one** skill from the dropdown in the AI Assistant panel (top action bar). Selection is stored as `settings.selectedSkillId: string | null` and persists across sessions.
5. On each router call (`aiRouteRequest` in `slide-generator/src/services/ai/router.js`), the selected skill id is attached to the request body as `_skillId`. The backend AI proxy (`backend/src/modules/ai-proxy/ai-proxy.controller.ts`) reads `_skillId`, prepends the skill's markdown plus a short preamble (with a "clarify if inputs are missing" rule) to the system prompt, strips the `_skillId` field, and forwards to the upstream model.
6. When a skill is active and the user's prompt does not cover the skill's "Inputs the skill needs" section, the router returns `intent=clarify` with the missing inputs as questions -- using the existing clarify flow, no new code paths.
7. Selection is **one-shot**. After a successful generation (agent plan execution, storyline populate, or direct create) the selection resets automatically so the next request does not silently reuse the prior skill. Clicking the active skill in the dropdown clears it manually. Errors do **not** clear the selection, so a retry keeps the same skill.

### Importing skill packs

`backend/scripts/import-skill-packs.mjs` copies offline-produced `Edwin_*_Pack` directories from `~/Downloads` into `backend/skills/` with normalized slugs and the canonical `## When to use this skill` heading, then prints a `CATEGORY_MAP` snippet for paste-in to `skills.service.ts`. The importer skips slugs that already exist so hand-tuned skills are never overwritten; re-run it safely after dropping new packs into `~/Downloads`.

### Where the boundary lives

| Layer | Sees skill markdown? |
|---|---|
| Router (planning) | Yes |
| Slide rendering, edits, transforms, validation | No |
| Frontend | No -- only metadata (id, name, description, category, order) |

The metadata-only contract keeps skill text off the wire for non-planning calls, out of localStorage, and out of browser DevTools.

## Prerequisites

- **Node.js** 18+
- **PwC Shared Services API key** (for AI features)

No Docker, database, or Redis required for local development. The backend uses in-memory storage.

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env -- set PWC_API_KEY to your PwC Shared Services key
npm install
npm run dev             # Runs on http://localhost:3001
```

### 2. Frontend

```bash
cd slide-generator
npm install
npm run dev             # Runs on http://localhost:5173
npm run test:sources    # Node unit tests for slide source / SERP filtering (optional)
```

Open `http://localhost:5173` in your browser. The app is ready to use -- no settings configuration needed.

## Architecture

```
Browser (localhost:5173)
  └── Frontend (React/Vite)
        └── fetch('/api/ai/chat', { body })
              └── Vite proxy -> localhost:3001
                    └── Backend (Express)
                          └── POST https://genai-sharedservice-emea.pwcinternal.com/chat/completions
                                (API-Key header added server-side)
```

The frontend never touches the PwC API directly. All AI calls go through the backend proxy at `/api/ai/chat` (chat completions) and `/api/ai/responses` (search/Responses API). The backend injects the `API-Key` header from the `PWC_API_KEY` environment variable.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PWC_API_KEY` | Yes | PwC Shared Services API key |
| `PWC_API_BASE_URL` | No | PwC API base URL (defaults to EMEA endpoint) |
| `BASIC_AUTH_USER` | Yes | Login username |
| `BASIC_AUTH_PASS` | Yes | Login password |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment (default: development) |
| `AZURE_CLIENT_ID` | No | Entra ID app registration client id. Required only when `ALLOWLIST_MODE` is `log` or `enforce` so the backend can verify ID tokens from MSAL. |
| `AZURE_TENANT_ID` | No | Entra ID tenant id (or `common` / `organizations`). Required when `ALLOWLIST_MODE` is `log` or `enforce`. |
| `ALLOWLIST_MODE` | No | `off` (default), `log` (verify JWT + log violations, never block), or `enforce` (verify JWT + 403 unlisted users). See "Staff Allowlist" below. |
| `ALLOWLIST_PATH` | No | Path to the newline-delimited allowlist file, relative to the backend cwd. Defaults to `config/allowlist.txt`. |
| `FRONTEND_URL` | No | Public origin for CORS and absolute links (default: `http://localhost:5173`). For `POST /api/handoffs`, if this still points at localhost in production, the returned `url` is derived from the incoming request host instead so handoff links match the deployed site. |

### Frontend

No environment variables needed. The frontend talks to the backend proxy.

## API Proxy Endpoints

| Endpoint | Proxies To | Purpose |
|---|---|---|
| `POST /api/ai/chat` | PwC `/chat/completions` | Main AI completions (injects consulting-skill markdown if `_skillId` is present) |
| `POST /api/ai/responses` | PwC `/v1/responses` | Search / Responses API (same `_skillId` injection) |
| `GET /api/ai/models` | PwC `/models` | List available models |
| `GET /api/skills` | (local) | Consulting-skill catalogue metadata -- id, name, description, category, order (bodies stay server-side) |
| `GET /api/whoami` | (local) | Returns the caller's identity + allowlist verdict. Bypasses `allowlistMiddleware` so the frontend can render a branded "Access Denied" screen instead of a blank 403. |
| `POST /api/handoffs` | (local) | FDI Tracker handoff: store payload in memory (24h TTL). Response includes `url` with `?handoff=`; production uses request host when `FRONTEND_URL` is still localhost. |
| `GET /api/handoffs/:id` | (local) | Fetch and consume handoff by id (one-time read). Frontend loads `?handoff=` after clearing persisted deck state; id survives MSAL redirect via `sessionStorage`. |

## Staff Allowlist (off by default)

The backend ships with an optional staff-allowlist gate that verifies Entra ID ID tokens issued by the existing frontend MSAL flow, then checks the caller's email against a newline-delimited list on disk. It is shipped **disabled** (`ALLOWLIST_MODE=off`) and is activated entirely via App Service configuration -- no code change is needed to flip it on.

### Modes

| Mode | Behavior |
|---|---|
| `off` | No JWT verification, no list check. `/api/*` is open (back to the behavior from before this feature existed). |
| `log` | Every `/api/*` call must carry a valid Entra ID Bearer token. Unlisted users are logged (`[allowlist] LOG-ONLY: <email>`) but are **never blocked**. Use this to preview who would be impacted before enforcing. |
| `enforce` | Same as `log`, but unlisted users receive `403 { error: 'access_denied', reason: 'not_on_allowlist' }`. |

### How it fits together

1. The frontend already signs users in via MSAL (`@azure/msal-react`). `slide-generator/src/services/authFetch.js` is a thin `fetch` wrapper that attaches the MSAL ID token as a Bearer header on same-origin `/api/*` calls only -- never on outbound AI provider calls.
2. `backend/src/common/middleware/entra-allowlist.middleware.ts` exposes two middlewares:
   - `entraAuthMiddleware` verifies the JWT against the tenant's JWKS (`https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys`) and attaches `req.user`.
   - `allowlistMiddleware` compares `req.user.email` / `preferred_username` / `upn` against the in-memory set loaded from `ALLOWLIST_PATH`. Both are wired in `backend/src/app.ts` in front of every `/api/*` route except `/api/health` and `/api/whoami`.
3. `GET /api/whoami` runs the JWT check but **not** the list check, so the frontend `ProtectedRoute` can bootstrap and render `AccessDenied` instead of letting the user hit the editor and see mystery 403s mid-chat.
4. The list itself is produced by `backend/scripts/build-allowlist.py` from the confidential `Active staff list.xlsx`. The xlsx and the generated `backend/config/allowlist.txt` are both gitignored; `deploy.sh` bundles `backend/config/` into the deployment zip so the list ships with the app without going through source control.

### Activation runbook

Step-by-step Azure CLI commands for flipping the feature on (merge the PR -> build the list -> set app settings -> deploy -> observe in `log` -> flip to `enforce` -> rollback plan) live in [`docs/runbooks/allowlist-path-b-runbook.md`](docs/runbooks/allowlist-path-b-runbook.md). The runbook is the single source of truth for operating this feature in production -- update it, not the README, when the procedure changes.

## Model Configuration

Models are auto-fetched from the PwC Shared Services `/models` endpoint on first load and cached locally for 24 hours. The Settings UI groups models by vendor (Gemini, Claude, OpenAI, Azure) with capability tags (fast, pro, image, code, preview). A "Refresh from API" button allows manual re-fetch.

**Default assignments:**

| Role | Model |
|---|---|
| Thinking (main generation) | `bedrock.anthropic.claude-opus-4-7` |
| Fast generation | `vertex_ai.gemini-3.1-flash-lite-preview` |
| Classifier | `openai.gpt-5.4-mini` |
| Router | `openai.gpt-5.5` |
| Step evidence search | `openai.gpt-5.4-mini` |
| Image | `vertex_ai.gemini-3-pro-image-preview` |
| Report | `bedrock.anthropic.claude-opus-4-7` |
| PPTX (export) | `bedrock.anthropic.claude-opus-4-7` |

Model assignments are server-controlled. The Settings modal shows which model is assigned to each role. The router uses GPT 5.5 with reasoning effort defaulting to low (including code fallback when router reasoning settings are missing); per-step evidence search defaults to GPT 5.4 mini, while premium slide generation, report compilation, and PPTX export default to **Claude Opus 4.7 on Bedrock** (`bedrock.anthropic.claude-opus-4-7`). The shared gateway rejects custom `temperature` values for `openai.gpt-5.5`; the client omits `temperature` for that model so LiteLLM uses the provider default. In debug mode, the Prompts section also exposes `promptOverrides` for individual prompt surfaces; empty overrides fall back to the code defaults.

## Linting

The frontend ESLint config keeps undefined symbols and parse-level issues as blocking errors, while legacy cleanup categories such as unused helpers, React Compiler migration warnings, and Fast Refresh export warnings are reported as warnings so `npm run lint` remains usable during active development.

## Client Design Profiles

The main header includes a **Template** control styled like the other header action buttons (icon + active profile name + chevron). Opening it reveals a compact dropdown listing the available client profiles. Switching applies the new theme/footer immediately and clears cached PPTX export code on existing slides so the next export uses the new profile; HTML content is preserved. PPTX master upload remains in Settings.

The default profile is Strategy&, while STC, PIF, and DGE apply audited client-deck behavior. Uploaded PPTX masters are stored by profile/template slot in IndexedDB, so a client upload does not overwrite the default Strategy& template. The backend `/api/templates/pptx-master` endpoint serves the legacy Strategy& default, built-in masters through `?profileId=stc`, `?profileId=pif`, and `?profileId=dge`; user-uploaded client templates remain local profile-bound overrides. Client demo checks are available through `clientProfileValidation.js` for color/font/footer/layout readiness.

**STC generation (testing):** The STC `STC_PROMPT_CONTRACT` block in `slide-generator/src/utils/clientDesignProfiles.js` is intentionally minimal so the base Slide HTML Generator (`slide-html-generator-prompt.md`) drives whitespace and consulting judgment; STC theme tokens, layout appendix, freestyle override sections, and PPTX behavior are unchanged.

STC leaves the footer/source text blank by default; sources should appear only when a real citation exists. The backend stores `STC Forward` regular, medium, and bold fonts under `backend/assets/fonts/stc-forward/` and the extracted STC logo under `backend/assets/client-templates/stc/logo.png`; the frontend loads them through authenticated `/api/assets/...` routes. When STC is the active profile, the app warms the bundled STC PPTX master/chrome on editor startup so users do not need to open Settings to restore stale or deleted local template metadata. STC canvas typography follows the master notes: content titles are 24px regular, subtitles are 18px regular, and footer/source/page numbers are 8px. STC section trackers render as logo-safe, text-only chrome using the reference deck's placement and `#9E21FF` tracker color in both canvas preview and PPTX export. PPTX export forces the active STC profile theme, clears/skips stale cached PPTX code, enforces `fontFace: 'STC Forward'`, normalizes generated title/subtitle/body/source/page geometry to the STC contract, strips emoji artifacts, and applies controlled logo chrome without copying the fragile full STC template shell into generated decks.

The PIF profile uses the audited `11192024_LDC_Implementation Guide_vSend.pptx` as its bundled master and the DC Opportunity pitch deck only as component/style evidence. The backend stores Fund font files under `backend/assets/fonts/pif-fund/` and the PIF logo under `backend/assets/client-templates/pif/logo.png`; the frontend loads them through authenticated `/api/assets/...` routes. PIF standard slides map the 960 x 540 preview canvas to a 10 x 5.625 in PPTX deck, use a top-left logo, the master-derived compact Fund Light gold title at `x=132 y=27 w=597 h=25`, an 891 x 397px body frame, blank footer/source text unless real source text exists, and a bottom-right gold page-number block. PIF PPTX export adds the title rule as controlled profile chrome, preserves rich-text run spacing, and tightens compact label boxes so formatted leads, stage headers, and page numbers do not merge or wrap unexpectedly.

## Azure Deployment

The application is deployed as a single Azure App Service (Linux, Node 20 LTS) that serves both the compiled backend and the built React frontend as static files.

### Azure Resources

| Resource | Name | Details |
|---|---|---|
| Resource Group | `rg-edwin-slides` | West Europe |
| App Service Plan | `asp-edwin-slides` | PremiumV3 P1v3, Linux |
| Web App | `app-edwin-slides` | Node 20 LTS, public access disabled |
| Private Endpoint | `pe-app-edwin-slides` | Subnet: `snt-004`, IP: `10.247.184.84` |
| VNet Integration | Outbound via VNet | Subnet: `snt-003` (serverFarms delegation) |

### Private DNS Records

DNS A records required in the centrally managed Private DNS Zone `privatelink.azurewebsites.net` (subscription `PZI-GXUS-P-SUB013`):

| Record | IP Address | Type |
|---|---|---|
| `app-edwin-slides` | `10.247.184.84` | A |
| `app-edwin-slides.scm` | `10.247.184.84` | A |

### Deployment

```powershell
.\deploy.ps1                # Build and deploy
.\deploy.ps1 -SkipBuild     # Deploy only (reuse existing build)
.\deploy.ps1 -SkipDeploy    # Build only (no Azure deploy)
```

### App Service Environment Variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `PWC_API_KEY` | (set in App Service settings) |
| `PWC_API_BASE_URL` | `https://genai-sharedservice-emea.pwcinternal.com` |
| `BASIC_AUTH_USER` | (set in App Service settings) |
| `BASIC_AUTH_PASS` | (set in App Service settings) |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |
| `FRONTEND_URL` | Optional | Set to the public site URL (e.g. `https://app-edwin-slides.azurewebsites.net`) for CORS when the SPA origin must differ from the API; handoff URLs still resolve correctly without it when API and UI share the same host. |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Monaco Editor |
| Backend | Express, TypeScript |
| Export | PptxGenJS, html2canvas, jsPDF |
| AI | PwC Shared Services (OpenAI, Anthropic, Google via proxy) |
