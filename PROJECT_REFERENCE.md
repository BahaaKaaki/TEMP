# Edwin Slides Creator -- Full Project Reference

> Auto-generated project reference for AI assistant context.
> Last updated: 2026-04-09

---

## 1. Overview

**Edwin Slides Creator** is an AI-powered presentation generator that creates professional slide decks in a Strategy& / PwC consulting style. It uses PwC Shared Services GenAI API for AI capabilities.

- **Repository:** `https://github.com/pwc-me-adv-strategyand/edwin-slides-creator.git`
- **Branch:** `feature/bugfixes-and-enhancements`
- **Stack:** React 19 + Vite 7 (frontend), Express + TypeScript (backend)
- **AI Provider:** PwC Shared Services GenAI API (`genai-sharedservice-emea.pwcinternal.com`)
- **Deployment:** Azure App Service via `deploy.ps1`

---

## 2. Directory Structure

```
slide-themes-main/
├── backend/                          # Express API server (port 3001)
│   ├── src/
│   │   ├── index.ts                  # Entry point: DB/Redis init, server start, graceful shutdown
│   │   ├── app.ts                    # Express app: middleware, Basic Auth, routes, static serving
│   │   ├── config/
│   │   │   ├── env.ts                # Zod-validated environment variable schema
│   │   │   ├── database.ts           # PostgreSQL pool + in-memory fallback
│   │   │   ├── redis.ts              # Redis client + in-memory fallback
│   │   │   └── logger.ts             # Winston logger setup
│   │   ├── common/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts # JWT auth middleware
│   │   │   │   ├── error.middleware.ts# Global error handler
│   │   │   │   └── rate-limit.middleware.ts # Rate limiter
│   │   │   └── types/index.ts        # Shared TypeScript types
│   │   ├── modules/
│   │   │   ├── ai-proxy/             # Core: proxies AI calls to PwC Shared Services
│   │   │   │   ├── ai-proxy.controller.ts  # proxyChat, proxyResponses, proxyModels
│   │   │   │   └── ai-proxy.routes.ts      # /api/ai/chat, /api/ai/responses, /api/ai/models
│   │   │   ├── auth/                 # User auth (JWT-based, not currently primary)
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── jwt.service.ts
│   │   │   ├── config/                # Server-managed configuration
│   │   │   │   ├── config.controller.ts  # buildConfig(), getConfig() -- model defaults + feature flags
│   │   │   │   └── config.routes.ts      # GET /api/config (no auth required)
│   │   │   ├── organizations/        # Multi-org support (scaffolded)
│   │   │   ├── themes/               # Theme CRUD (scaffolded)
│   │   │   └── templates/            # Template CRUD (scaffolded)
│   │   └── db/
│   │       └── migrate.ts            # Database migration runner
│   ├── package.json
│   ├── docker-compose.yml            # Postgres 16, Redis 7, MinIO (optional)
│   └── .env.example
│
├── slide-generator/                  # React frontend (port 5173)
│   ├── src/
│   │   ├── main.jsx                  # Root: StrictMode > MsalProvider > AuthProvider > App
│   │   ├── App.jsx                   # SlideProvider > KnowledgeBaseProvider > AppContent
│   │   ├── SimpleApp.jsx             # Simplified variant (unused in main flow)
│   │   ├── components/               # 40+ React components
│   │   │   ├── AIChatbot.jsx         # **CORE**: chatbot UI, routing, execution engine
│   │   │   ├── Header.jsx            # Deck name, export (PPTX/PDF/HTML), settings
│   │   │   ├── MainContent.jsx       # Preview vs editor toggle
│   │   │   ├── SlidePreview.jsx      # Slide preview, comments, zoom, fullscreen, widget menu
│   │   │   ├── SlideEditor.jsx       # Monaco HTML/CSS editor
│   │   │   ├── SlideList.jsx         # Slide thumbnails, drag-reorder, multi-select
│   │   │   ├── SmartActionCard.jsx   # Execution plan review/edit UI, storyline editing
│   │   │   ├── ExecutionPlan.jsx     # Agent execution plan display
│   │   │   ├── StorylinePanel.jsx    # Storyline display
│   │   │   ├── StorylineWorkspace.jsx# Storyline editing workspace
│   │   │   ├── TemplatePicker.jsx    # Template selection grid
│   │   │   ├── TemplateManager.jsx   # Custom template management
│   │   │   ├── ThemeCreator.tsx      # Theme creation tool
│   │   │   ├── VibePreview.jsx       # Vibe preview panel
│   │   │   ├── WidgetBrowser.jsx     # Widget browser
│   │   │   ├── KnowledgeBaseManager.jsx # Knowledge base UI
│   │   │   ├── SettingsModal.jsx     # Settings (models, work levels, etc.)
│   │   │   ├── LoginPage.jsx         # Azure AD login (Strategy& branding, Microsoft sign-in)
│   │   │   ├── AuthLoadingScreen.jsx # Post-login transition animation
│   │   │   ├── CommentPanel.jsx      # Per-slide comments
│   │   │   ├── DebugPanel.jsx        # Debug tools
│   │   │   ├── FlowStudio.jsx        # Flow studio (workflow builder)
│   │   │   ├── PptxTransformer.jsx   # PPTX import/transform
│   │   │   ├── AgentApprovalDialog.jsx # Agent approval flow
│   │   │   ├── AgentTaskList.jsx     # Agent task list
│   │   │   ├── AgentAiIOViewer.jsx   # Agent LLM I/O viewer
│   │   │   └── ...
│   │   ├── constants/
│   │   │   └── slideActions.js       # PRIMARY_ACTIONS, MORE_ACTIONS (chatbot quick improve)
│   │   ├── context/
│   │   │   ├── SlideContext.jsx       # **CORE**: global state, settings, model defaults, actions
│   │   │   ├── KnowledgeBaseContext.jsx # Knowledge base state
│   │   │   └── AuthContext.tsx        # Auth state, backend availability
│   │   ├── constants/
│   │   │   └── slideActions.js          # PRIMARY_ACTIONS + MORE_ACTIONS quick action definitions
│   │   ├── hooks/
│   │   │   ├── useKeyboardShortcuts.js # Global Ctrl+Z, Ctrl+Shift+Z
│   │   │   └── useAgenticExecution.js  # Agent lifecycle: create > run > pause > resume > done
│   │   ├── services/                  # 25+ service modules
│   │   │   ├── aiService.js           # **CORE**: barrel re-export of all ai/*.js sub-modules
│   │   │   ├── consultingTeamAgent.js # Agentic workflow: manager/worker research/compile
│   │   │   ├── genericAgent.js        # Generic agent with phase machine
│   │   │   ├── agentExecutor.js       # Plan execution with dependencies
│   │   │   ├── agentTaskSystem.js     # Task state and lifecycle
│   │   │   ├── agentToolRegistry.js   # Tool definitions for agent
│   │   │   ├── agentWorkspace.js      # Agent workspace state
│   │   │   ├── templateEmbeddings.js  # Embedding-based template matching
│   │   │   ├── templateMatcher.js     # Template selection for PPTX
│   │   │   ├── templateValidation.js  # Template validation
│   │   │   ├── pptxService.js         # PPTX export via PptxGenJS
│   │   │   ├── pptxRenderers.js       # PPTX rendering helpers
│   │   │   ├── pptxTemplateService.js # Apply uploaded .pptx templates
│   │   │   ├── pptxTransformService.js# PPTX transformations
│   │   │   ├── exportService.js       # HTML, JSON, PDF export
│   │   │   ├── reportService.js       # HTML report generation (Chart.js)
│   │   │   ├── documentParser.js      # Browser-side PDF/Word/Excel/PPTX/image parsing
│   │   │   ├── knowledgeBase.js       # Knowledge base CRUD
│   │   │   ├── knowledgeBaseRAG.js    # RAG retrieval (TF-IDF scoring)
│   │   │   ├── ai/improveSlideOrchestrator.js # Shared slide-improve orchestrator (context + search)
│   │   │   ├── layoutValidation.js    # Slide layout validation
│   │   │   ├── layoutFitter.js        # Content fitting to layout
│   │   │   ├── layoutCorrectionService.js # AI-based layout corrections
│   │   │   ├── vibeRegenerator.js     # Regenerate slides with different vibes
│   │   │   ├── skillRegistry.js       # Agent skill registry
│   │   │   └── apiClient.ts           # Backend API client, auth, token refresh
│   │   ├── utils/
│   │   │   ├── slideTemplates.js      # **CORE**: 70+ HTML template definitions with PPTX renderers
│   │   │   ├── slideMasters.js        # Base layouts (default, blank, cover, etc.)
│   │   │   ├── slideWidgets.js        # Widget definitions
│   │   │   ├── themeUtils.js          # Theme config schema, DEFAULT_THEME, themeToCSS() converter
│   │   │   ├── vibes.js              # Legacy design variants (retained for backward compat)
│   │   │   ├── debugLog.js            # Debug logging utility
│   │   │   └── auditLog.js            # Audit logging utility
│   │   ├── styles/
│   │   │   ├── slides.css             # **CORE**: minimal shell CSS (~134 lines), base tokens and structure
│   │   │   ├── app.css                # Application shell styles
│   │   │   └── simple.css             # Simple variant styles
│   │   ├── guides/
│   │   │   ├── freestyle-slide-guide.md    # Monolithic freestyle guide (legacy, kept for reference)
│   │   │   ├── freestyle-shell.md          # Shell: canvas dimensions, HTML skeleton, CSS scoping rules
│   │   │   ├── freestyle-theme.md          # Theme: design tokens, fonts, surface usage, status colors
│   │   │   ├── freestyle-vibe.md           # Vibe: visual design principles, layout variety, color usage
│   │   │   └── freestyle-writing.md        # Writing: content rules, layout archetypes, citations, process
│   │   └── data/
│   │       └── knowledgeBaseExamples.js # Knowledge base example entries
│   ├── index.html
│   ├── vite.config.js                 # React plugin, proxy /api and /health to port 3001
│   └── package.json
│
├── examples/                          # Sample HTML slide decks
├── gpt-export/                        # ChatGPT custom GPT knowledge files
├── deploy.ps1                         # Azure deployment script
├── docs/
│   ├── AI_ASSISTANT_ARCHITECTURE.md   # Full AI chat/generation flow reference
│   ├── PWC_GENAI_API_REFERENCE.md     # API endpoints, models, search, benchmarks
│   ├── TECHNICAL_RESEARCH_REPORT.md   # Agent patterns, React architectures, competitor analysis
│   └── plans/                         # Feature implementation plans
├── _bmad/                            # BMAD Method v6.2.2 (gitignored, local tooling)
│   ├── core/                         # Core skills (help, brainstorming, party mode, reviews)
│   ├── bmm/                          # BMad Method Module (PM, architecture, dev workflows)
│   └── _config/                      # Manifests, IDE config (cursor.yaml)
├── _bmad-output/                     # BMAD planning/implementation artifacts (gitignored)
├── README.md                          # Main documentation
├── CHAT_CONTEXT.md                    # AI session context
└── .gitignore
```

---

## 3. Application Flow -- End to End

### 3.1 Startup Sequence

```
[Backend]
  index.ts
    └── initRedis() (optional, falls back to in-memory)
    └── checkDatabaseHealth() (PostgreSQL or in-memory fallback)
    └── app.listen(PORT=3001)

[Frontend]
  index.html
    └── main.jsx
        └── <MsalProvider>        // Azure AD SSO via @azure/msal-browser
            └── <AuthProvider>    // Auth context (frontend-comps)
                └── <App>
                    └── <SlideProvider>         // Global state: slides, settings, CSS, vibes
                        └── <KnowledgeBaseProvider>  // Knowledge base state
                            └── <AppContent>
                                ├── <Header />         // Deck name, export, settings
                                ├── <SlideList />      // Slide thumbnails sidebar
                                ├── <MainContent />    // Slide preview or Monaco editor
                                └── <AIChatbot />      // Chat interface + execution engine
```

### 3.2 Request Flow (Browser to AI)

```
Browser (localhost:5173)
  └── Frontend React app
        └── fetch('/api/ai/chat', { model, messages, ... })
              └── Vite dev proxy → localhost:3001
                    └── Backend Express
                          ├── Basic Auth check (if BASIC_AUTH_USER/PASS configured)
                          ├── Rate limiting
                          └── /api/ai/chat → ai-proxy.controller.ts
                                └── fetch('https://genai-sharedservice-emea.pwcinternal.com/chat/completions')
                                      (API-Key header injected server-side from PWC_API_KEY env var)
```

### 3.3 User Message Processing Pipeline

When a user types a message in the chatbot:

```
1. handleSubmit(prompt)
   ├── If agent is running → push to live input queue (real-time interaction)
   ├── If budget command → add budget credits
   ├── If "Edit All" mode toggled → switch to batch editing
   ├── Auto-name deck (fire-and-forget, fast model) if deckName is default
   └── Proceed to classification

2. UNIFIED TRIAGE (triageRequest)
   ├── Model: classifierModel (gpt-5.4-mini), ~1-2s
   ├── Input: user prompt, slide context, deck overview
   ├── Output: { scope, needsSearch, searchQuery, isTemplateSwitch, templateId, targetSlides, instruction, questions }
   ├── scope=qa → direct chatWithContext, no slide changes (return)
   ├── scope=direct → DIRECT path (step 3a)
   ├── needsStoryline=true → rich storyline summary included in router context
   └── scope=plan / failure → PLANNER path (step 3b)

3a. DIRECT EXECUTION (single-slide, no router)
   ├── Speed mode selects model: Fast → fastModel, Premium → model
   ├── Search if triage.needsSearch (no separate classifier)
   └── Execution: transformSlideToTemplate / fillTemplateWithAI / generateSlides / improveSlide

3b. FULL ROUTER (multi-step planner)
   ├── AI Router (aiRouteRequest) — GPT 5.4 with structured step fields
   │   ├── Step fields: action, templateId, title, subtitle, instruction,
   │   │   facts, sources, layoutGuidance, contextSlides, contextFromStep,
   │   │   sectionTracker, subSectionTracker, searchQuery, searchGoal
   │   ├── Returns: plan[], contextStrategy, understanding
   │   └── May return: needsClarification + questions
   │
   └── Rule-based fallback (routeRequest) — pattern matching, no API call

4. PLAN REVIEW
   ├── If < 5 non-destructive steps → auto-execute
   ├── If answer_question only → auto-execute (just respond)
   └── Otherwise → show SmartActionCard for user to review/modify/execute

5. EXECUTION (executeFromSmartAction)
   ├── Speed mode determines generation model for all steps
   ├── Structured fields (title, subtitle, facts, sources) prepended to step prompt
   ├── Build groups from router plan
   ├── For each group → executeGroupParallel
   │   ├── Accumulate create_slide steps into batch
   │   ├── flushCreateBatch when batch is full or non-create step encountered
   │   │   ├── Separate into: image slides, fixed-layout, templated, freestyle
   │   │   ├── Templated → fillTemplatesBulkWithAI (one API call for batch)
   │   │   ├── Freestyle → generateSlides (individual AI calls)
   │   │   ├── Fixed → direct placeholder replacement (cover, sectionDivider)
   │   │   ├── Image → generateImageSlide (image model)
   │   │   └── flushInsertsInOrder (deterministic slide order)
   │   └── Non-create steps (edit, delete, switch) → executeStep individually
   └── Post-execution: sync storyline, update progress
```

### 3.4 Per-Slide Improve & Quick Actions (chatbot + `slideActions.js`)

Improve, web-search toggle, template switch, and quick-action prompts live in the **chatbot panel** (not on `SlidePreview`). Action definitions are in `slide-generator/src/constants/slideActions.js` (`PRIMARY_ACTIONS`, `MORE_ACTIONS`).

The improve flow still uses `improveSlideWithSearch` from `ai/improveSlideOrchestrator.js` — **lightweight**: only the current slide's HTML + CSS is sent (no neighbors, no deck structure, no position context) unless a different caller opts into richer context.

```
User instruction + Improve
  └── improveSlideWithSearch(slide, instruction, settings, { skipSearch })
      ├── builds simple slideInfo: html, customCSS, templateId, title
      ├── enrichInstructionWithSearch: opt-in web search via /api/ai/responses (8K budget, head+tail trim)
      └── improveSlide: sends slideInfo + instruction to LLM (no deckContext)
```

`buildEnrichedSlideInfo` (full deck context, neighbors, storyline, template ref) is exported for AIChatbot batch-edit paths.

### 3.5 Agent Mode (Consulting Team Agent)

When enabled (`enableAgenticMode: true`), a higher-level workflow runs:

```
User prompt
  └── ConsultingTeamAgent
      ├── Manager: Scope and plan
      ├── Consultants: Research (parallel workers)
      │   └── Each worker: web search + knowledge base + analysis
      ├── Manager: Compile all research into structured content
      ├── Manager: Review and refine
      └── Output: "PRESENTATION CONTENT" → fed to router for slide creation
```

The agent uses a budget system, supports live user input during execution, and can pause for clarification/approval at checkpoints.

### 3.6 Export Pipeline

```
Slides in state (HTML + CSS)
  ├── PPTX: pptxService.js
  │   ├── AI generates PptxGenJS code from HTML
  │   ├── PptxGenJS renders .pptx file
  │   └── Batch processing with parallel API calls
  ├── PDF: jsPDF + html2canvas
  │   └── Renders each slide to canvas, then to PDF pages
  └── HTML: exportService.js
      └── Full HTML document with embedded CSS
```

---

## 4. Design System

### 4.1 CSS Architecture: Shell + Theme + Content

Slide CSS is organized into three layers:

1. **Shell** (`slides.css`) -- structural CSS for `.slide`, `.title`, `.subtitle`, `.frame`, `.footer` with canvas dimensions (960x540), absolute positions, and overflow rules. Includes master-specific overrides (`master-blank`, `master-titleOnly`, `master-cover`, `master-emptyPage`). Never modified by LLM or user.
2. **Theme** (`state.theme` -> CSS custom properties via `themeToCSS()`) -- JSON config mapping semantic tokens to concrete values (colors, fonts). Injected at render and export time. Changing the theme recolors all slides instantly. Populated from `DEFAULT_THEME` or extracted from uploaded PPTX templates via `brandingExtractor.js`.
3. **Content CSS** (per-slide `customCSS`) -- LLM-generated `<style>` blocks with scoped layout classes. Uses `var(--token)` for all colors so themes propagate automatically. Built-in templates carry pre-extracted component CSS (from `templateStyles.js`, sourced from `slides-legacy.css`).

### 4.2 Design Tokens

| Token | Purpose |
|-------|---------|
| `--heading` | Headings, titles |
| `--body` | Body text |
| `--muted` | Subtle text, captions |
| `--accent` | Primary accent (brand color) |
| `--accent-hover` | Accent hover state |
| `--accent-soft` | Light accent background |
| `--on-accent` | Text on accent backgrounds |
| `--page` | Page/slide background |
| `--surface` | Container background |
| `--surface-alt` | Alternate surface |
| `--border` | Borders and dividers |
| `--success`, `--success-soft` | Positive/growth indicators |
| `--warning`, `--warning-soft` | Caution indicators |
| `--danger`, `--danger-soft` | Negative/decline indicators |
| `--font-title` | Title font family |
| `--font-heading` | Heading font family |
| `--font-body` | Body font family |

Theme config lives in `state.theme` (see `themeUtils.js` for schema and `themeToCSS()` conversion). Default theme: Strategy& brand (#8E1E1E accent, Georgia/Arial fonts).

### 4.3 Legacy Vibes

Vibes (`vibes.js`, `VibePreview.jsx`, `vibeRegenerator.js`) exist as dead code retained for potential future reuse. `state.vibe` has been removed from the context -- no component reads, injects, or passes deck-level vibe. The `imageVibe` system (for AI image slides) remains active and separate. PPTX export no longer uses vibe helpers -- it derives colors from `state.theme` via `themeToPptxPalette()`.

### 4.3 Templates (115+)

Templates are HTML structures with placeholder content. Categories include:

- **Opening:** cover, blank, instructionSlide
- **Content:** threeCards, kpiMetrics, timeline, comparison, executiveSummary, barChartExhibit, peerBenchmark, waterfallChart, initiativesLongList, etc.
- **Closing:** nextSteps, thankYou, etc.

Each template has: `id`, `title`, `type`, `master`, `description`, `note`, `category`, `html`, `css` (pre-extracted component CSS from legacy stylesheet), and optional `pptxRendererCode`. The `css` field is populated at import time from `templateStyles.js` and becomes the slide's `customCSS` when the template is applied.

### 4.4 Slide Masters

Base layouts defined in `slideMasters.js`, with matching CSS overrides in `slides.css`:
- `standard` / `default` -- title + subtitle + 904x366 frame + footer
- `blank` -- no title/subtitle; frame expands to 904x468
- `titleOnly` -- title only, no subtitle; frame at 72px, 904x424
- `cover` -- no standard chrome; frame at 140px, auto height
- `emptyPage` -- no chrome; frame fills entire 960x540

Layout values in `slideMasters.js` are reconciled with `slides.css`. `getMasterCSSVariables()` generates CSS custom properties for a given master. LLM prompts (`freestyle-shell.md`, `getMasterInstructions()`) document available masters and their dimensions.

---

## 5. State Management

### SlideContext (slide-generator/src/context/SlideContext.jsx)

Core state shape:

```javascript
{
  slides: [],                    // Array of { id, title, html, customCSS, type, summary, pptxRendererCode }
  sharedCSS: SLIDES_CSS,         // Shell CSS (single source of truth)
  theme: DEFAULT_THEME,          // Theme config: { name, colors: {...}, fonts: {...} }
  activeSlideId: null,           // Currently selected slide
  selectedSlideIds: [],          // Multi-selected slides (for export)
  deckName: 'Untitled Deck',
  imageVibe: 'default',         // Vibe for image-based slides (separate from removed deck vibe)
  darkMode: false,
  storyline: [],                // Array of { id, title, description, slideId, order }
  storylineStatus: 'none',      // none | generated | approved | populated
  settings: {
    // User-controlled (persisted to localStorage)
    speedMode: 'premium',        // 'fast' | 'premium'
    freestyleShell: '',           // Override for Shell prompt section (empty = code default)
    freestyleTheme: '',           // Override for Theme prompt section (empty = code default)
    freestyleVibe: '',            // Override for Vibe prompt section (empty = code default)
    freestyleWriting: '',         // Override for Writing Profile section (empty = code default)
    // Code-managed model assignments (always from initialState, never localStorage)
    model: 'pwc:bedrock.anthropic.claude-opus-4-6',  // Premium generation
    fastModel: 'pwc:vertex_ai.gemini-3.1-flash-lite-preview', // Fast generation (~5s/slide)
    classifierModel: 'pwc:openai.gpt-5.4-mini',      // Unified triage classifier
    routerModel: 'pwc:openai.gpt-5.4',               // Tier 2 full planner
    providers: [...],            // Provider registry (PwC Shared Services)
    // ... many more settings (batch sizes, work levels, search, etc.)
  }
}
```


---

## 6. Backend Architecture

### API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/config` | Server-managed defaults from `EDWIN_*` env vars: models, search, generation, agent/batching (no auth) |
| `POST /api/ai/chat` | Proxy to PwC `/chat/completions` |
| `POST /api/ai/responses` | Proxy to PwC `/v1/responses` (search) |
| `GET /api/ai/models` | Proxy to PwC `/models` |
| `/api/v1/auth` | User auth (register, login, JWT) |
| `/api/v1/organizations` | Organization CRUD |
| `/api/v1/themes` | Theme CRUD |
| `/api/v1/templates` | Template CRUD |
| `POST /api/templates/pptx-master` | Upload PPTX master (multipart field `template`); saved as `uploads/pptx-master.pptx` |
| `GET /api/templates/pptx-master` | Download stored PPTX master (404 if none) |
| `GET /health` | Health check (no auth) |

### Middleware Chain

1. Helmet (security headers)
2. CORS
3. Compression
4. Body parsing (50MB limit)
5. Morgan HTTP logging
6. Rate limiting
7. Basic Auth (conditional: only when BASIC_AUTH_USER/PASS set)
8. Routes
9. Static file serving (production: built frontend from `backend/public`)
10. Error handler

### Key Design Decisions

- **In-memory fallback:** Both database and Redis fall back to in-memory storage, so the app runs without Docker/infrastructure
- **API key server-side:** `PWC_API_KEY` never reaches the browser; backend injects it on proxy calls
- **Basic Auth:** Simple password gate for deployment; separate from JWT auth system

---

## 7. Deployment

### Azure App Service

- **Resource group:** `rg-edwin-slides`
- **App Service:** `app-edwin-slides` (Linux, Node 20 LTS)
- **Private endpoint:** IP `10.247.184.84`, subnet `snt-004`

### deploy.ps1 Script

```
1. Build frontend (npm run build in slide-generator/)
2. Build backend (npm run build in backend/)
3. Copy frontend build → backend/public/
4. Create deployment zip
5. az webapp deploy → Azure App Service
```

Options: `-SkipBuild` (deploy only), `-SkipDeploy` (build only)

---

## 8. Key Patterns and Conventions

### Router Architecture

Two routers operate in tandem:
2. **Rule-based Router** (`routeRequest`): pattern-matching fallback using regex and keyword mappings

The AI router can ask clarifying questions (returned as `needsClarification` with `questions` array). It produces a `plan` array of steps, each with: `action`, `templateId`, `instruction`, `contextSlides`, `position`, `sectionTracker`, `subSectionTracker`, `layoutGuidance`, `searchQuery`.

### Batch Processing

Slides are created in batches for efficiency:
- `fillTemplatesBulkWithAI`: one API call fills multiple template-based slides
- `flushCreateBatch`: groups create steps, separates by type (templated/freestyle/image/fixed), processes each category optimally
- `flushInsertsInOrder`: ensures slides appear in plan order regardless of parallel completion order

### Section Trackers

For structured decks (7+ slides):
- `sectionTracker`: "1. Strategy", "2. Financials" (maroon tab on slide)
- `subSectionTracker`: "Phase 1", "Phase 2" (grey tab, for multi-slide sections)
- Executive summary items correspond 1:1 to section tracker groups

---

## 9. Testing

No test files exist currently. `backend/package.json` has `"test": "vitest"` but no Vitest config or test files.

---

## 10. Completed Work (from CHAT_CONTEXT.md)

1. Section divider rendering (bypass AI for cover/sectionDivider)
2. Default model switched to Gemini 3.1
3. Image-based chatbot logic
4. Multi-slide download (selectedSlideIds + Export Selected)
5. Template switching content fitting
6. Switch template UI relocation
7. Simplify buttons ("Express" -> "Regular", hide "Library")
8. Storyline editing (reorder/delete in SmartActionCard)
9. Conversational UX (greetings bypass, single-select clarification)
10. Basic Auth (conditional middleware, 401 fixes)
11. GitHub secret scanning (removed hardcoded creds)
12. No bracket placeholders in router prompt
13. Executive summary templates: removed duplicate `executiveSummary` in `slideTemplates.js`; merged `executiveSummary` into `summary-recap` family in `templateEmbeddings.js`; equal-weight variant randomization; router `searchAvailable` honors `chatRouterSearchEnabled`; clearer API connection errors (model in message) and router fallback `console.warn`
14. Improve bar orchestrator: extracted `improveSlideOrchestrator.js` (facade pattern) with `buildEnrichedSlideInfo` and `improveSlideWithSearch` to consolidate duplicated `improveSlide` call sites; Improve bar is lightweight (slide HTML/CSS only, no deck context) with opt-in web search checkbox; AIChatbot batch-edit paths retain full deck context via `buildEnrichedSlideInfo`
15. Search truncation fix: replaced 4K hard `substring` with `trimSearchResult` (8K budget, 60/40 head+tail split) in both `enrichInstructionWithSearch` and AIChatbot `buildSearchFactsBlock` so closing summary tables from search results are preserved
16. UI declutter: added text labels to all Header icon buttons; commented out Widgets button/browser; consolidated per-slide download (PPTX/PDF) into Header Export dropdown ("Current Slide" section); hid Code tab behind `DEBUG_MODE` localStorage flag; removed zoom buttons from preview toolbar (Ctrl+scroll still works); moved fullscreen to floating hover button on slide wrapper; removed bottom status bar to reclaim vertical space
17. Unified AI Panel: transformed floating chatbot overlay into docked right-side panel (flex child of `app-main`); absorbed quick action buttons and improve bar from SlidePreview into the panel; added "This Slide | Deck" context mode toggle; extracted `PRIMARY_ACTIONS`/`MORE_ACTIONS` to `src/constants/slideActions.js`; replaced all purple/indigo chatbot colors (98 occurrences) with maroon accent palette; commented out Image mode button; replaced style preference `<select>` with segmented control (Auto | Templates | Freestyle); panel open state persisted to localStorage via `isPanelOpen`/`togglePanel` in SlideContext; FAB button renders in App.jsx when panel is closed
18. AI Chat UX overhaul: fixed edit_slide search gap (router pre-search context and per-step web search now injected into edit path); empty-slide edits promoted to create_slide so TemplatePicker appears in SmartActionCard; AI I/O viewer gated behind `DEBUG_MODE` localStorage flag with compact execution summary for non-debug users; completion messages rendered as styled HTML cards instead of raw markdown text; defensive fallback keys added to SlideList and TemplatePicker; localStorage slide loading ensures all slides have IDs
19. Panel UX polish: SmartActionCard shows maroon progress bar + step counter during execution; FAB badge restyled from green to maroon tint; Auto/Templates/Freestyle toggle hidden in "This Slide" mode (Deck only); empty-slide promotion prefers slide's stored templateId; `contextMode` passed to AI router; context label shows truncated slide title; fixed chat scroll not updating when SmartActionCard appears (`scrollToBottom` now fires on `pendingSmartAction` and `isLoading` changes); "This Slide" mode on empty slides replaces quick actions with inline compact TemplatePicker and hint text
20. "This Slide" auto-execute + quick action progress + image template cleanup: "This Slide" mode now auto-executes without SmartActionCard review (sets `autoExecute: true` when `contextMode === 'slide'`); quick action pills show inline spinner with action name during execution and post styled completion/error cards to chat history; image template buttons (Image Full, Image + Text) grayed out (`disabled` + `opacity: 0.4`) in both compact dropdown and full TemplatePicker grid; deck title in header constrained to single line with `text-overflow: ellipsis` and `max-width: 320px` to prevent two-line overflow; zero-slides guard in "This Slide" mode shows inline TemplatePicker with hint "Pick a layout to create your first slide" and disables chat input until a template is selected (selection auto-creates a slide via `actions.addSlide`)
21. "This Slide" direct improve + panel UX overhaul: "This Slide" mode now bypasses the router entirely and calls `improveSlideWithSearch` directly (same as quick actions) for non-empty slides, or `fillTemplateWithAI` for empty slides with a template; no multi-slide plans, no SmartActionCard, single-slide-only. Quick actions redesigned: horizontal scrollable row (no wrap) for primary pills, "More" opens a floating dropdown overlay instead of inline expansion. Chat messages use `::before` flex spacer to push toward bottom (eliminates whitespace above footer). Unified input box (textarea + attach + send inside one bordered container). Header flex fix: `.header-left` gets `min-width: 0; flex-shrink: 1` and `.header-actions` gets `flex-shrink: 0` so long deck names shrink instead of pushing buttons off-screen.
22. Three-tier chat feedback system for consultants: (a) **Tier 1 (default)**: result card shows "Done! Edited N slide(s)" with "Slide N -- Title" format, no AI I/O or execution-summary shown; (b) **Tier 2 (power user)**: optional "Show details" expandable under results reveals human-friendly tags (web search used, duration); (c) **Tier 3 (DEBUG_MODE)**: full raw AI I/O panel unchanged. Progress messages humanized throughout (`humanizeStepText` and `humanizePhase` helpers): "edit_slide (comparisonTable)" becomes "Edit Slide 1", "Step 1/3" becomes "Improving your slide...". Execution status messages use friendly phrasing. SmartActionCard simplified in non-debug mode: instruction textareas collapsed behind "Edit instructions" toggle, context chips and search toggles hidden, step reorder controls hidden; `debugMode` prop controls visibility. `createdSlides`/`editedSlides`/`deletedSlides` now track `{ index, title }` objects for result card formatting. Defensive key fixes in SlideList (`SlideThumbnail`) and TemplateManager to prevent `undefined-` duplicate key warnings.
23. UI declutter batch (feat/ui-declutter): (a) **Sidebar shrunk** to 160px thumbnail-only with slide number badge overlay; removed title, type label, and action buttons from slide rows. (b) **Header cleanup**: commented out Import, Save, Transform, Info, Docs buttons; kept New, Export, Undo, Redo, Templates, History, Settings. (c) **Black-on-burgundy fix**: added CSS safety-net rules in `slides.css` for `[class*="accent-fill"]`, `[class*="highlight-badge"]` etc. that force `color: var(--on-accent)` on accent-background elements; updated freestyle-slide-guide.md with explicit contrast rule. (d) **Web search pill toggle** in This Slide input toolbar (default ON); `slideSearchEnabled` state in AIChatbot. (e) **Per-step search toggle** moved out of debugMode guard in SmartActionCard; context chips remain debug-only. (f) **Template switch per slide**: "Template" pill in quick actions opens TemplatePicker popover; calls `transformSlideToTemplate`. (g) **Storyline + neighbor context** injected into `edit_slide` prompt (deck position, prev/next slide titles, storyline with `[CURRENT]` marker). (h) **Reference slide HTML** from `step.contextSlides` injected into `edit_slide` prompt for match-design requests. (i) **Flash mini-router** in This Slide mode: fast model classifies request (`needsSearch`, `referenceSlides`, `isTemplateSwitch`); routes template switches directly, injects reference slide HTML, controls search. (j) **SettingsModal simplified**: two-tier layout (Essential + Generation visible to all; Roles and Advanced behind DEBUG_MODE); Essential tab surfaces providers, router/search/fast model pickers, search toggle, branding, concurrency. (k) **Parallel edit execution**: consecutive independent `edit_slide` steps targeting different slides now run via `Promise.all` with concurrency limit. (l) **PPTX CSS resolution**: `resolveCustomProperties()` in `cssExtraction.js` resolves `var(--token)` to hex before sending to PPTX AI prompt; wired into `pptxService.js`.

24. Model routing and settings redesign: (a) **Router model changed** from `opus-4-6` to `gpt-5.4` for both `routerModel` and `chatRouterModel` -- GPT 5.4 has native web search support and produces fast structured JSON (~5s vs ~22s). (b) **Per-step search tightened**: `deriveSearchQuery` no longer auto-derives queries from titles/instructions; only router-set or user-toggled `searchQuery` triggers per-step search. Global `searchRawContext` from the router call still grounds every step via `buildSearchFactsBlock()`. (c) **This Slide storyline context**: "This Slide" mode now injects deck context (slide position, neighbor titles, storyline with `[CURRENT]` marker) into all paths (template fill, generate, improve), matching the deck-mode `edit_slide` behavior. (d) **Settings Essential redesign**: replaced three `ModelPicker` dropdowns with a comprehensive read-only "Model Roles" card showing all 8 model assignments (Main, Router Deck, Router Chat, Fast, Search, PPTX, Report, Image) with role descriptions; editable via `ModelPicker` in `DEBUG_MODE` only. Removed duplicate "Manager Name" from Generation section and duplicate "Max Concurrent API Calls" from Essential (kept in Generation/Parallelism).

25. **This Slide mode optimization**: (a) Fixed model override -- generation now uses the main model (Opus) instead of the router model (GPT 5.4), matching Deck-mode quality. (b) Fixed `generateSlides` call passing `sharedCSS` as `slideCount` -- now correctly requests 1 slide instead of generating 3 and discarding 2. (c) Parallelized classification and web search via `Promise.all` instead of serial execution. (d) Eliminated unnecessary search query refinement LLM call for short queries (< 120 chars) -- appends date directly, saving 2-5s per request. (e) Removed `web_search_preview` inline tool from router API call since LiteLLM proxy rejects it; pre-search via dedicated endpoint provides context instead. (f) Fixed chat message disappearing race condition: `isAutoNamingRef` is now cleared inside the `useEffect` instead of via `setTimeout(0)`.

26. **Flow audit and optimization**: (a) **Router migrated to Responses API** -- GPT router calls now use `/api/ai/responses` with inline `web_search_preview`, eliminating the separate pre-search step. Search and planning happen in a single call, saving ~15-20s per deck generation. Non-GPT routers (Gemini, Claude) and agent mode fall back to the legacy two-step pre-search + Chat Completions path. (b) **Fast model upgraded** from `gpt-5.4-nano` to `gpt-5.4-mini` for classification, auto-naming, and cover title correction -- better structured JSON output with minimal latency increase. (c) **Per-step search guidance strengthened** in the router system prompt, directing the router to aggressively add `searchQuery` to any slide presenting data, statistics, or current events. (d) **localStorage save debounced** with a 2s trailing timeout, reducing 15+ rapid writes during batch generation to a single write. (e) **Provider model list updated** to include `gpt-5.4`, `gpt-5.4-pro`, and `claude-sonnet-4-6`. Settings version bumped to v6 with migration from nano to mini.

27. **Unified chat architecture**: (a) **Removed "This Slide / Deck" toggle** -- replaced manual scope selection with automatic Tier 1 Quick Classifier (`classifyRequest()` in `router.js`) that auto-detects scope (single_slide, multi_slide, full_deck, qa) using `classifierModel` (gpt-5.4-mini, ~1-2s). (b) **Speed mode toggle**: new "Fast / Thinking" UI toggle in the context bar; Fast uses `fastModel` (gpt-5.4, ~14s/slide), Thinking uses `model` (opus-4-6, ~20s/slide). Model selection wired into both direct execution and `executeFromSmartAction`. (c) **Search toggle**: checkbox in context bar replaces per-mode search pills; wired to `searchToggle` setting. (d) **Auto-execute threshold**: plans with < 5 non-destructive steps auto-execute without SmartActionCard review (replaces contextMode-based logic). (e) **Router prompt rewrite**: structured step fields (`title`, `subtitle`, `instruction`, `facts`, `sources` as separate fields); freestyle-first defaulting; centralized router-level research as default (per-slide `searchQuery` + `searchGoal` as exception); consultant storyline rules (pyramid principle, MECE, titles-as-storyline); content fidelity rules. (f) **Settings v7 migration**: `SETTINGS_VERSION` 6->7; `fastModel` changed from gpt-5.4-mini (classifier) to gpt-5.4 (generation); added `classifierModel`, `speedMode`, `searchToggle` fields; SettingsModal shows unified model roles (Thinking, Fast, Classifier, Router, Search, PPTX, Report, Image). (g) **Freestyle guide hardened**: fixed stale 890x353 frame size refs to 904x366 across 5 files; added no-fabrication rule; expanded anti-patterns (10 items); bare selector and global definition rules; output contract hardened.

28. **Execution fixes and Fast model upgrade**: (a) **Structured field passthrough**: router.js plan mapping now passes `title`, `subtitle`, `facts`, `sources`, `searchGoal` through to execution (previously silently dropped). `content` field coerced to string. (b) **Router prompt tightened**: removed aggressive "MUST add searchQuery" rule; per-step `searchQuery` now requires paired `searchGoal` (exception-only). Added negative `contextSlides` rule for new decks (slideCount=0). (c) **SmartActionCard search UI**: per-step search toggle hidden when router already searched and step lacks `searchGoal`. (d) **Fast model changed**: `fastModel` default from `openai.gpt-5.4` (~14s) to `vertex_ai.gemini-3.1-flash-lite-preview` (~5s). Benchmarked: Flash Lite 5.3s/1K tokens, GPT 5.4 ~14s, Gemini 3 Flash 15.3s, Gemini 2.5 Flash 33.5s (too slow). (e) **Settings v9 migration**: `SETTINGS_VERSION` 8->9 with inline fastModel migration. (f) **Cross-slide edit routing**: classifier prompt + code guard to route "make slide X like slide Y" to planner when target differs from active slide; `slideIndex` now documented in router schema and inferred from instruction via `parseSlideReferences` when LLM omits it. (g) **Speculative search gated**: Tier 1 classifier `needsSearch: false` now prevents the direct path's speculative search from firing (saves API call + removes misleading "Searching..." UX).

29. **Code-managed model assignments**: Model assignment settings (`model`, `fastModel`, `classifierModel`, `routerModel`, `chatRouterModel`, `deepAnalysisModel`, `pptxModel`, `reportModel`) are now always sourced from `initialState.settings` in SlideContext.jsx, never read back from localStorage. Changing a default model in code instantly propagates to all users on next page load -- no `SETTINGS_VERSION` bump or migration logic needed. Removed `OLD_DEFAULTS`, `migrateDefault()`, `migrateModelRef()`, and all version-specific model migration code. User-controlled preferences (`speedMode`, batch sizes, work levels, etc.) still persist to localStorage normally.

30. **Template switch, parallel editing, and UX fixes**: (a) **Template CSS isolation**: `customCSS` cleared on template switch in both chat-triggered and picker-triggered paths, preventing old per-slide CSS from bleeding into new templates. (b) **Quick fix stale ref**: `handleQuickAction` now reads fresh slide from `stateRef.current` instead of closure-captured `activeSlide`; `templateId` cleared after quick fix edits so user can re-apply same template. (c) **Template re-selection**: removed early return for same `templateId` in picker `onSelect`, allowing re-application of current template after edits drift from structure. (d) **Image options removed**: disabled "Image Full" and "Image + Text" buttons removed from TemplatePicker (compact + full), TemplateManager AI mode toggle, StorylineWorkspace Default Template Mode, and AgentApprovalDialog. Backend `generateImageSlide` and PPTX renderers kept intact. (e) **Parallel slide editing**: replaced global `quickActionBusy` boolean with `busySlideIds` Set for per-slide busy tracking; quick action buttons disabled only for the slide being processed; user can switch slides and run quick actions / reimagine in parallel. (f) **Reimagine variation**: temperature overridden to 0.85 for reimagine calls; current slide HTML included as negative reference ("DO NOT reuse this layout"); random style hint from 8-item pool injected into prompt to force layout diversity.

31. **Unified triage and search grounding fix**: (a) **Unified triage** (`triageRequest()` in `router.js`): replaces both Tier 1 `classifyRequest` and Tier 2 mini-classifier with a single LLM call; scopes: `clarify` (ambiguous queries), `qa`, `direct`, `plan`; includes `isTemplateSwitch` detection and `needsSearch` in one call. (b) **CLARIFY scope**: new scope for genuinely ambiguous queries; shows clarification card with questions/options; reuses existing `routerClarificationRef` pattern. (c) **Router prompt fix**: removed false auto-injection claim ("results are automatically injected into every slide"); replaced "RARE EXCEPTION" framing of per-step search with intelligent criteria (data-heavy slides get `searchQuery + searchGoal`, structural slides use `facts[]`); changed expected per-step search from "0-1 steps" to "2-4 steps" for data-heavy decks. (d) **Path A search synthesis**: after plan parsing, collects all facts/sources from plan steps to build synthetic `searchRawContext`; enables `buildSearchFactsBlock()` for every step on Path A (previously only Path B). (e) **Removed `routerAlreadySearched`**: per-step search now runs whenever `searchQuery` is set and `searchEnabled` is true; no conditional gating. (f) **Strengthened facts framing**: per-step facts wrapped in `=== VERIFIED FACTS FROM WEB SEARCH ===` with strong grounding instruction. (g) **SmartActionCard search toggle**: always visible (no `routerAlreadySearched` gate); toggle now sets both `searchQuery` and `searchGoal`. (h) **Removed `searchToggle` UI**: search availability controlled by `settings.searchEnabled` system flag; triage/router decide when to use it. (i) **Search model default**: changed from `openai.gpt-5.4` to `openai.gpt-5.4-mini` (half latency, comparable quality). (j) **Renamed `triageRequest` in agentServices.js** to `agentTriageRequest` to avoid naming conflict with new unified triage. (k) **Inline search behavior guidance**: added `INLINE SEARCH BEHAVIOR` section to router system prompt instructing the model to make multiple separate search calls for different entities rather than one broad query; tested 14 Responses API configurations -- system prompt guidance increases inline searches from ~1-2 to ~3-4 with only ~1-3s extra latency; `max_tool_calls` and `tool_choice` had no meaningful effect; `search_context_size: "high"` is optimal. (l) **Fixed batch path dropping structured fields**: the parallel batch execution path (`executeGroupParallel`) was only using `step.instruction` -- it dropped `title`, `subtitle`, `facts[]`, and `sources[]`; since ALL `create_slide` steps go through this batch path, no generated slide ever received the router's curated facts with strong grounding framing; fixed by replicating structured field injection from the sequential path. (m) **Fixed per-step search overwriting global context**: when per-step search succeeded, the prompt was reassigned dropping `buildSearchFactsBlock()` (global `searchRawContext`); also strengthened grounding instruction from "Use the search results" to "Use ONLY... Do NOT substitute information from training data"; applied to sequential, batch, and edit paths.

32. **UI/UX improvements and routing fix**: (a) **Auto-cover suppressed for small requests**: router prompt AUTO COVER rule now only adds a cover slide when 3+ slides are requested; 1-2 slide creation goes straight to content. (b) **Page number format**: changed from `N / total` to just `N` in both HTML preview (`injectPageNumber` in SlidePreview.jsx) and PPTX export (`addFooter` in pptxRenderers.js), matching the master PPTX template. (c) **Comments UI hidden**: floating comment button, slide-out comment panel, and slide list comment badges all hidden via `{false && (...)}` guards; `CommentPanel.jsx` and all comment logic preserved in code. (d) **Speed mode renamed**: `'quality'` -> `'premium'` throughout codebase (SlideContext, AIChatbot, SettingsModal); migration handles both old `'thinking'` and `'quality'` values. (e) **Bottom toolbar redesign**: speed mode toggle moved from top context bar to bottom input area as compact pill-slider; style preference simplified from 3-option (Auto/Templates/Freestyle) to 2-option (Auto/Freestyle) pill-slider; both use consistent `pill-toggle` CSS component. (f) **Search toggle restored**: magnifying glass icon button added to input toolbar between attach and send buttons; toggles `settings.searchEnabled`; blue when active, muted when off. (g) **Edit during plan execution**: chat input stays functional while SmartActionCard is executing; user can type slide edits that run in parallel via `improveSlideWithSearch`; plan is unaffected. (h) **Multi-select delete**: Delete/Backspace key and visible "Delete N slides" bar when 2+ slides selected in the slide list; includes confirmation prompt.

33. **Router logging, reimagine, clarification, storyline, parallel edit, execution UX, and freestyle prompt architecture**: (a) **Structured router I/O logging**: added `console.groupCollapsed` input/output logs to all three router functions (`triageRequest`, `aiRouteRequest`, `routeRequest`) in `router.js`; triage logs model + user prompt + full input message + output; AI router logs model + context + parsed JSON + raw response; rule router logs prompt + intent + action. (b) **Reimagine title/subtitle preservation**: `handleReimagineSlide` in `AIChatbot.jsx` now extracts title and subtitle from slide HTML via `DOMParser`, counts main content sections in `.frame`, and uses `TITLE:` / `SUBTITLE:` markers with strong preservation instructions; title is always kept from the original slide instead of overwritten. (c) **Triage clarification removed**: `scope: "clarify"` always coerced to `scope: "plan"` so the router (with web search) handles all clarification; triage prompt schema simplified to `qa | direct | plan` only; clarification card rendering removed. (d) **Classifier-driven storyline**: triage now returns `needsStoryline: boolean`; when true, a rich multi-line storyline summary (title + description + key message per point) is passed to the router; `buildStorylineSummary()` helper replaces all flat `.map(s => s.title).join()` calls. (e) **Storyline bug fixes**: fixed `freshState.storyline?.summary` bug (storyline is an array, not an object with `.summary`); removed manual Storyline toggle button from `SmartActionCard.jsx` (inclusion is now automatic from classifier); storyline context injected into `buildContextForStep` for `create_slide` steps with position marker. (f) **Parallel edit fix**: removed `|| isLoading` from all 6 quick action button `disabled` props; buttons now only check `busySlideIds.has(activeSlide.id)`, allowing parallel quick actions on different slides while chat is processing. (g) **Execution progress UX**: replaced per-step technical rows during execution with consolidated progress card in `SmartActionCard.jsx` showing header ("Creating N slides..."), visual progress bar, and slide titles with checkmark/active/pending states; `buildStepDescription` updated to prefer `step.title` over "freestyle" label. (h) **Freestyle prompt split**: monolithic `freestyle-slide-guide.md` split into `freestyle-shell.md` (layout contract, CSS rules, archetypes, design principles), `freestyle-theme.md` (color tokens, fonts), `freestyle-writing.md` (content voice, process); `freestylePromptBuilder.js` composer assembles the three sections with per-section override support from settings. (i) **Freestyle wiring**: `generateSlides` in `slideGeneration.js` now uses `buildFreestyleSystemPrompt(settings)` instead of monolithic `FREESTYLE_SLIDE_GUIDE` import; `templateSelection.js` and `AgentApprovalDialog.jsx` also updated. (j) **Settings Prompts tab**: new "Prompts" tab in `SettingsModal.jsx` visible to all users (not behind DEBUG_MODE); shows 3 collapsible freestyle sections (Shell, Theme, Writing Profile) with actual code defaults from markdown files; each section shows "customized" badge when overridden with Reset button; "System Prompt Override" textarea relabeled and moved below sections; Report System Prompt included; old System Prompts block removed from Advanced tab. (k) **State migration**: `SlideContext.jsx` `SETTINGS_VERSION` bumped 10->11; `freestyleGuide` replaced with `freestyleShell`, `freestyleTheme`, `freestyleWriting`; migration copies legacy `freestyleGuide` to `freestyleShell`.

34. **Freestyle prompt section reorganization**: (a) **Shell** rewritten to contain only layout concerns: canvas dimensions (960x540 slide, 904x366 frame), HTML skeleton, element positions, output format, CSS scoping rules, class naming conventions. Removed design tokens, layout archetypes, design principles, contrast rules, and anti-patterns that belonged elsewhere. (b) **Theme** expanded: design tokens table, font rules (Georgia/Arial with size ranges), critical contrast rule (on-accent for dark backgrounds), design principles (visual hierarchy, white space, alignment, accent usage, professional polish), visual anti-patterns (unstyled numbers, restyling base classes, CSS leakage, missing style block), and new closing readability/contrast line. (c) **Vibe** added as new fourth section (`freestyle-vibe.md`): contains base vibe description from `VIBES.default.gptDescription`; `freestyleVibe` state field added to SlideContext with v12 migration; visible in Settings Prompts tab as collapsible section. (d) **Writing Profile** expanded: content rules (titles, subtitles, density, bold leads, real content, no fabrication), all layout archetypes moved from Shell, source citations moved from Shell, content anti-patterns (plain bullet list, wall of text, uniform monotony), process checklist updated to reference archetypes locally. (e) **Builder updated**: `freestylePromptBuilder.js` now imports and composes 4 sections (shell + theme + vibe + writing) with per-section override support.

35. **CSS Architecture Follow-ups**: (a) **Template CSS restoration**: renamed `slides copy.css` to `slides-legacy.css` (reference archive, not imported at runtime); built `scripts/extract-template-css.mjs` to parse template HTML, extract matching CSS rules from the legacy stylesheet, and generate `templateStyles.js` mapping template ID -> component CSS; `slideTemplates.js` attaches pre-extracted CSS via `attachTemplateCSS()` at import time; `handleUseTemplate` in TemplateManager.jsx uses `template.css` as `customCSS`; TemplatePicker and TemplateManager previews inject per-template CSS alongside preview styles. (b) **PPTX export pipeline alignment**: fixed runtime bug (undefined `customCSS` and `resolvedSlideCSS` vars in console.log); replaced `getPptxVibeStyle/Hint/Colors(vibe)` with `themeToPptxPalette(settings.theme)` deriving colors from `state.theme`; removed `settings.vibe` fallback; wired `state.theme` through export call chain in Header.jsx and SlidePreview.jsx; updated `resolveCustomProperties` to merge shell CSS defaults with theme overrides. (c) **Custom masters**: reconciled layout values in `slideMasters.js` with `slides.css` (28px left, 24px title, 904px width, etc.); added master-specific CSS overrides to `slides.css` for `master-blank`, `master-titleOnly`, `master-cover`, `master-emptyPage`; updated `freestyle-shell.md` with master documentation table; added `master-emptyPage` and `master-default` to freestyle validation whitelist; updated `getMasterInstructions()` in both `slideEditing.js` and `templateSelection.js` with corrected dimensions. (d) **Client branding extraction**: created `brandingExtractor.js` service that parses `ppt/theme/theme1.xml` from PPTX files via JSZip to extract `<a:clrScheme>` (dk1/dk2/lt1/lt2/accent1-6) and `<a:fontScheme>` (major/minor fonts), maps to `DEFAULT_THEME` shape; integrated into `handleTemplateUpload` in SettingsModal.jsx -- after upload, shows color/font preview with Apply/Dismiss actions; Apply calls `actions.updateTheme()`.

36. **PPTX Template-Aware Export**: (a) **Background bleed fix**: `applyTemplateToGenerated` now injects a solid white `<p:bg>` into each generated slide XML, preventing template master/layout backgrounds and decorative shapes from bleeding through. (b) **Smart layout selection**: replaced blind `slideLayout2` preference with `pickBestLayout()` that scans template layouts by OOXML type/name attributes, preferring blank > titleOnly > content. (c) **Footer branding**: `addFooter()` in `pptxRenderers.js` now renders `_footerBranding` text at bottom-left alongside the slide number. (d) **Template chrome extraction**: expanded `brandingExtractor.js` to extract logo images (small image shapes in header zone of slide master), footer placeholder text, and content area positions (title/subtitle/body/footer) from template layouts at upload time. (e) **Chrome storage**: `saveTemplateToStorage` accepts and persists chrome metadata alongside the template binary in IndexedDB. (f) **Logo injection**: `applyTemplateToGenerated` accepts chrome, writes the logo media file, adds `<p:pic>` shape into each merged slide at the original template position, and wires the image relationship in slide rels. (g) **Auto footer branding**: when user applies extracted theme from a template, `footerBranding` setting is auto-set from the template's footer placeholder text. (h) **Template-aware positions**: `buildSlidePrompt` reads `settings.templatePositions` (loaded from stored chrome) and overrides the hardcoded Standard Positions block in the LLM prompt with the template's actual placeholder positions.

37. **PPTX Export Fix -- Chrome Recovery and Master Shape Isolation**: (a) **Chrome recovery at export time**: `loadTemplateFromStorage()` now always checks IndexedDB for chrome metadata when loading from the server (server stores binary only, not chrome). If chrome is still missing (cross-browser, cleared storage), `exportToPPTX`/`exportSingleSlideToPPTX` re-extract chrome from the template binary via new `extractChromeFromBuffer()` export. (b) **Master shape hiding**: generated slides now include `showMasterSp="0"` on the `<p:sld>` root, hiding decorative shapes (colored diamonds, "Confidential" text boxes, invisible think-cell EMFs) from the template's slide master while preserving the theme/colors. Logo and footer are injected directly into the slide's `<p:spTree>` so they remain visible. (c) **Logo extraction hardened**: EMF/WMF files filtered from logo candidates (non-renderable placeholders). Minimum area threshold (0.01 sq in) rejects sub-pixel invisible shapes. Scans multiple slide masters instead of just master 1. (d) **Layout position scoring**: replaced first-match layout selection with ranked scoring system. Layouts with explicit title+body+subtitle positions score highest. Correctly handles layouts with inherited (no explicit coordinates) positions by ranking them lower. Multiple body placeholders in custom layouts (e.g., "Content slide _ VCS") are disambiguated: largest area = main body, small placeholder between title and body = subtitle. (e) **Color mapping fix**: accent6 (typically red) now maps to `danger` instead of accent5 (which was mapping blue to danger in NEOM's theme). (f) **Footer text fallback**: if no footer text found in layout placeholders, also checks master footer placeholders. Export uses `templateData.chrome.footerText` as fallback when `settings.footerBranding` is unset.

---

## 11. Pending / In Discussion

- **Icon/image insertion in templates** -- `[Icon X]` placeholders filled with emoji by AI, CSS renders in colored boxes
- **CSS glitch (curved brackets)** -- `border-radius` + `border-left` issue, deferred to Kamen
- **Better save presentations** -- localStorage vs backend vs JSON export
- **Database migration** -- PostgreSQL schemas exist but app runs on localStorage
- **PPTX rendering fidelity** -- AI-driven HTML-to-PptxGenJS has interpretation differences
- **Storyline generation in Regular mode** -- whether to auto-generate during plan phase
