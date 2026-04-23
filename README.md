# Edwin Slides Creator

AI-powered presentation generator that creates professional slide decks using PwC Shared Services GenAI API.

## Project Structure

```
.
├── slide-generator/    # React + Vite frontend (port 5173)
├── backend/            # Express API server + AI proxy (port 3001)
├── gpt-export/         # ChatGPT custom GPT knowledge files
├── examples/           # Sample HTML decks and templates
└── docs/plans/         # Architecture and feature planning docs
```

## Features

- AI slide generation via PwC Shared Services (model: `vertex_ai.gemini-3.1-pro-preview`)
- Backend AI proxy -- API key stays server-side, never exposed to browser
- Basic HTTP authentication (credentials set via environment variables)
- Agentic workflow (consulting team agent with manager/worker roles)
- Monaco-based slide editor (HTML/CSS)
- PowerPoint (.pptx) export via PptxGenJS with template-aware merging (logo injection, master shape isolation, smart layout selection, template position awareness)
- Knowledge base / RAG for contextual generation
- Theme and template system with CSS variables
- Web search via PwC Responses API
- Freestyle slide generation with full creative freedom (AI generates custom HTML + scoped CSS per slide)
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
| Thinking (main generation) | `bedrock.anthropic.claude-opus-4-6` |
| Fast generation | `vertex_ai.gemini-3.1-flash-lite-preview` |
| Classifier | `openai.gpt-5.4-mini` |
| Router | `openai.gpt-5.4` |
| Image | `vertex_ai.gemini-3-pro-image-preview` |
| Report | `vertex_ai.gemini-3.1-pro-preview` |
| PPTX (export) | `vertex_ai.gemini-3.1-pro-preview` |

Model assignments are server-controlled. The Settings modal shows which model is assigned to each role.

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

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Monaco Editor |
| Backend | Express, TypeScript |
| Export | PptxGenJS, html2canvas, jsPDF |
| AI | PwC Shared Services (OpenAI, Anthropic, Google via proxy) |
