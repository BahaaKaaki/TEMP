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

### Frontend

No environment variables needed. The frontend talks to the backend proxy.

## API Proxy Endpoints

| Endpoint | Proxies To | Purpose |
|---|---|---|
| `POST /api/ai/chat` | PwC `/chat/completions` | Main AI completions |
| `POST /api/ai/responses` | PwC `/v1/responses` | Search / Responses API |
| `GET /api/ai/models` | PwC `/models` | List available models |

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
