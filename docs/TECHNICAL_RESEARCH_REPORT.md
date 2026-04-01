# Technical Research Report -- AI Agent Architectures & Consultancy Slide Tools

> Research date: 2026-03-31
> Scope: Modular AI agent design patterns, React agentic architectures, and the current landscape of consultancy-grade AI slide generation tools.

---

## Part 1: Modular AI Agent Design Patterns

### 1.1 Core Orchestration Patterns

Three primary patterns dominate production AI agent systems in 2026:

**Sequential Chain (Linear Pipeline)**
- Agents execute in order; each step's output becomes the next step's input
- Simplest pattern. Good for validation workflows, content generation pipelines
- Limitation: inflexible for branching, no parallelism
- Edwin's current "This Slide" path roughly follows this: classify -> search -> generate/edit

**Router Agent (Conditional Branching)**
- A coordinator examines input, classifies intent, routes to specialized sub-agents
- The router itself does no work -- it only dispatches
- Best for multiple specialized agents handling different task categories
- Edwin's current "Deck" path uses this: `aiRouteRequest()` classifies and routes to `generateSlides()`, `fillTemplateWithAI()`, `improveSlide()`, etc.

**Supervisor / Hierarchical Delegation**
- A supervisor breaks complex tasks into sub-tasks, delegates to workers, aggregates results
- Workers can be different agents with different models/capabilities
- Best for decomposable tasks requiring parallel execution
- Edwin's (inactive) agent mode attempts this: triage -> agent prepareContent -> router -> execution

### 1.2 The Prompt Chaining Foundation

Prompt chaining remains the foundational agentic pattern: sequential LLM calls where each step's output feeds the next. Benefits:
- Structured, focused outputs per step
- Better accuracy vs. one massive prompt
- Easier debugging (inspect each step)
- Natural validation checkpoints

Modern evolution: **Agentic loops** where the LLM runs cyclically (reason -> select tool -> execute -> observe -> reason again) until reaching a goal. Allows revisiting steps, self-critique, and dynamic adaptation.

### 1.3 Production Quality Patterns

**Reflexion Loops**: Force the system to critique its own output before delivery. Reduces hallucination. Example: generate slide HTML, then validate against design constraints, regenerate if violations found.

**Pattern Layering** (from the "20 AI Agent Design Patterns as a Stack" framework):
1. Foundation patterns (Tool Use, ReAct) set the performance ceiling
2. Orchestration patterns (Router, Chain) optimize within that ceiling
3. Topology patterns (DAG, Supervisor) distribute work
4. Quality patterns (Reflexion, Verification) prevent confident hallucination

**Centralized Tool Registry**: Instead of agents directly calling tools, route all tool calls through a registry that provides:
- Centralized observability and logging
- Per-tool error tracking
- Rate limiting and schema validation
- Easy tool addition/removal without changing agent code

### 1.4 Key Framework Comparison (2026)

| Framework | Model | Best For | How It Works |
|---|---|---|---|
| **LangGraph** | Graph-based state machines | Complex stateful workflows | Define nodes (functions) + edges (transitions) with explicit state |
| **CrewAI** | Role-based agents | Business automation, clear hierarchies | Define agent roles/goals + tasks; framework handles coordination |
| **AutoGen** | Conversation-based | Agents that need to "discuss" | Agents pass messages in conversation loops; coordination emerges |

Market context: 86% of copilot spending ($7.2B) goes to agent-based systems. Token costs dropped 10x since 2023 -- running a 5-agent pipeline costs <$0.10.

### 1.5 Production Failure Patterns to Avoid

- **State management failures**: Stale or inconsistent data across agents
- **Error propagation cascades**: Confident wrong outputs spreading downstream
- **Infinite loops / runaway execution**: No budget or iteration caps
- **Semantic mismatches**: Agents misunderstanding each other's output format
- **Overengineering**: Using multi-agent when a single well-prompted model suffices

---

## Part 2: React Agentic Frontend Architectures

### 2.1 The Three-Layer Pattern

Modern React AI apps (2026) never have components call LLM APIs directly. The standard architecture:

```
UI Components (React)
    |
API / Orchestration Layer (proxy, auth, rate limiting, caching, cost tracking)
    |
LLM Provider(s) (OpenAI, Anthropic, Google, etc.)
```

Edwin follows this: `AIChatbot.jsx` -> `aiService` functions -> `apiClient.js` -> `fetch()` to backend proxy -> PwC GenAI API.

### 2.2 State Management for AI Chat

**useReducer over useState** for long conversations: reduces rendering time 40-60% vs. `useState` with spread operators on large message arrays.

Edwin currently uses `useState` for messages in `AIChatbot.jsx`. For a production agentic system, the recommended pattern is:
- **Conversation state**: `useReducer` with immutable message history
- **Streaming state**: Separate `isStreaming` flag, optimistic updates
- **Agent state**: State machine tracking agent phase (idle -> thinking -> tool-calling -> generating -> done)

### 2.3 Streaming LLM Responses

**Server-Sent Events (SSE)** is the preferred protocol over WebSockets for LLM streaming because:
- LLM streaming is unidirectional (server -> client)
- SSE works with CDNs and load balancers natively
- Auto-reconnects on failure
- Simpler implementation

Key pattern: Normalize raw LLM tokens into typed events with a `sequence` field to detect dropped events and enable replay. This abstraction protects against provider API format changes.

**Tool calls during streaming**: Use a state machine with JSON accumulation that buffers incomplete tool input, repairs malformed JSON, executes the tool while pausing the stream, then resumes.

Edwin currently does NOT stream -- it waits for full responses. This is an area for potential enhancement.

### 2.4 Vercel AI SDK Patterns (Reference Architecture)

The Vercel AI SDK (`ai` package) is the de facto standard for React + AI integration:

- **`useChat` hook**: Manages messages, input, streaming state, and tool results in one hook
- **`streamText`**: Server-side streaming with tool call/result stream parts
- **Tool definition**: Type-safe with Zod schemas; model decides which tools to use
- **Generative UI**: React components rendered from AI tool calls (e.g., weather card from weather tool)
- **23+ composable patterns**: Streaming chat, tool calling, multi-step agents, RAG, human-in-the-loop

This is the gold standard for React AI apps. Edwin's current architecture is custom-built and does not use the AI SDK, but many of its patterns (tool injection, model fallback, parallel execution) align with SDK concepts.

### 2.5 Typed Contracts and Task Graphs

A practical multi-agent pattern from production Next.js apps:
1. Define each agent as a typed function: `Agent<Input, Output>`
2. Build a DAG (directed acyclic graph) of task dependencies
3. Topological sort determines execution order
4. Independent tasks run in parallel automatically
5. Validation checkpoints between stages
6. Graceful degradation for non-critical task failures

Edwin's router plan + `executeFromSmartAction` loosely follows this (plan steps with groups for parallel execution), but without formal typed contracts.

---

## Part 3: Consultancy AI Slide Generation Tools

### 3.1 How AI Presentation Makers Work

The universal pipeline across all tools:

```
User Prompt
    |
Content Generation (LLM: headlines, bullets, summaries, data)
    |
Design Synthesis (layout engine: apply templates, themes, brand rules)
    |
Asset Integration (icons, images, charts from libraries)
    |
Output (native format or PPTX export)
```

### 3.2 MBB Internal Tools

**McKinsey -- Lilli Platform**
- Proprietary GenAI platform for drafting proposals and PowerPoint slides
- Aggregates McKinsey's internal knowledge base
- Consultants can input confidential client data (unlike public tools)
- AI agents create slides and ensure reports match McKinsey tone
- Focus: knowledge synthesis + brand-consistent output

**BCG -- Deckster**
- In-house GenAI PowerPoint plugin (built 2023, still active 2026)
- 9,000+ monthly users; 40% of associates use it weekly
- Won 2025 CIO 100 award for innovative AI
- 70% of employees reinvest saved time into higher-value work
- Part of BCG's broader strategy: tens of thousands of custom AI agents for client projects
- Three-layer architecture: data layer, tools/agents layer, integration with proprietary data

**Bain**
- No publicly documented internal slide tool found. Likely uses a combination of custom AI integrations and third-party tools.

### 3.3 Commercial Consulting-Grade Tools

**Templafy** (Enterprise, launched March 2026)
- Free prompt-to-PowerPoint generator
- "Document agent framework" -- combines AI content generation with rules-based automation
- Centrally governed: compliance, accuracy, brand consistency enforced
- Patented document generation technology
- Target: enterprise teams needing brand-compliant output at scale

**DeckAI** (Consulting-focused)
- MBB-style templates (McKinsey, BCG, Bain frameworks)
- Contextual intelligence: upload documents, generates slides from them
- Adaptive design system for brand consistency
- SOC2 compliant, enterprise security
- Generates presentations in <2 minutes, exports as PPTX
- Pricing: Free (5 slides/month) to $60/month (250 slides/month)

**Deckary** (PowerPoint add-in)
- Works natively inside Microsoft PowerPoint (not a separate platform)
- AI slide builder + consulting-grade charts (Waterfall, Mekko, Gantt)
- Web research integration with source citations
- 2,000+ icons library
- Targets consulting and industry firms
- Key differentiator: stays inside PowerPoint, preserving the user's existing workflow

**Gamma** (Content-first)
- Card-based format (not traditional slides)
- Uses Claude (Anthropic) for content, Flux for images
- Has a developer API: create generation -> poll status -> retrieve results
- Real-time collaboration, strong design system
- Limitation: card format unfamiliar to PowerPoint-heavy consulting workflows

**Beautiful.ai** (Design automation)
- Design-first approach: intelligent layout rules auto-adapt content
- Enterprise brand controls, auto-formatting
- Visual consistency enforced by the design engine
- No free plan

**Tome** (Narrative-focused, pivoted)
- Pivoted in 2025 from pure presentations to AI content creation platform
- Sales enablement focus: data-grounded narratives from Salesforce/CRM data
- Private vector store for account-specific generation
- Building proprietary models (not just GPT wrapper)
- Training models on "fundamentals of compelling communication"

### 3.4 Key Architectural Insights from Competitors

| Pattern | Who Uses It | Relevance to Edwin |
|---|---|---|
| Rules-based + AI hybrid | Templafy | Combining prompt-driven content with deterministic brand rules. Edwin does this with `validateFreestyleHTML()` but could go further. |
| Document ingestion -> slides | DeckAI, Tome, BCG Deckster | Upload a document, AI extracts and structures content for slides. Edwin has knowledge base attachment but no deep document-to-slide pipeline. |
| Native PowerPoint plugin | Deckary, BCG Deckster | Users stay in their familiar tool. Edwin is web-based, generates HTML, exports PPTX separately. |
| MBB template library | DeckAI, Deckary | Pre-built consulting framework templates. Edwin has templates but they're general-purpose, not framework-specific. |
| Web research integration | Deckary, Edwin | Live data enrichment for slides. Edwin already does this well via search. |
| Proprietary model training | Tome, McKinsey | Training on what makes presentations "good." Most tools still use GPT/Claude as-is. |
| Card-based (not slides) | Gamma | Rethinks the format entirely. Interesting but poor fit for consulting (PPTX is king). |

### 3.5 PPTX Generation Approaches

**PptxGenJS** (what Edwin uses):
- JavaScript library, works in browser and Node.js
- Programmatic slide creation: `addSlide()`, `addText()`, `addShape()`, etc.
- HTML table to slides via `tableToSlides()` (limited to tables)
- No general HTML-to-PPTX -- requires manual mapping of HTML elements to PptxGenJS API calls
- Edwin generates PptxGenJS renderer code per template via AI (`generatePptxRendererCode()`)

**python-pptx** (Python alternative):
- Server-side PPTX generation
- More mature template support (slide layouts, placeholders)
- Used by many backend-driven tools (Templafy, DeckAI likely use server-side approaches)

**The HTML-to-PPTX gap**:
This remains the hardest problem in AI slide generation. AI models are excellent at generating HTML/CSS but PowerPoint is a completely different format (Office Open XML). Every tool handles this differently:
- **Edwin**: AI generates PptxGenJS code per template; custom renderer functions
- **Gamma/Tome**: Proprietary renderers, native format is web-based (PPTX is an export)
- **Deckary/Deckster**: Work inside PowerPoint natively, so no conversion needed
- **DeckAI**: Server-side generation, likely programmatic PPTX construction

---

## Part 4: Implications for Edwin

### 4.1 Where Edwin Aligns with Industry Patterns

- **Router agent pattern**: Edwin's AI router is a solid implementation of the conditional branching pattern
- **Prompt chaining**: The classify -> search -> generate pipeline in "This Slide" mode follows best practices
- **Parallel execution**: Plan step groups with batched parallelism match production patterns
- **Web search integration**: Ahead of most competitors (only Deckary offers comparable research integration)

### 4.2 Where Edwin Could Evolve

**Architecture-level:**
- **Streaming responses**: Current wait-for-full-response is outdated. SSE streaming would improve perceived performance significantly.
- **Formal state machine**: Replace ad-hoc loading/phase state with explicit agent state machine (idle -> classifying -> searching -> generating -> validating -> done)
- **Typed contracts**: Define explicit input/output schemas for each pipeline stage instead of ad-hoc object shapes
- **Reflexion loop**: After generation, have a fast model validate the output against constraints before returning to user. Edwin has `validateFreestyleHTML()` which is code-based -- an LLM validation step could catch semantic issues too.

**Feature-level:**
- **Document ingestion pipeline**: Deep document-to-slides (DeckAI/Deckster pattern). Edwin has knowledge base attachment but no structured extraction.
- **Consulting framework templates**: MBB-specific frameworks (MECE, 2x2 matrix, value chain, 5 forces). Edwin has generic templates.
- **Real-time PPTX preview**: Currently HTML preview -> PPTX export. Could add live PPTX-accurate preview using a renderer like pptx-renderer.

**Model-level:**
- **Specialized model routing**: Use different models for different tasks (already supported via `roleSettings` but not fully exploited)
- **Cost-aware model selection**: Route simple edits to cheap/fast models, complex generation to expensive/powerful ones

---

## Sources

- [Agent Orchestration Patterns for Production AI Systems](https://dev.to/hezeclark/agent-orchestration-patterns-for-production-ai-systems-devkits-41dc)
- [Multi-Agent Orchestration: Three Patterns](https://dev.to/arslan_mecom/multi-agent-orchestration-three-patterns-for-complex-ai-workflows-355l)
- [Prompt Chaining -- Agentic Design Patterns](https://ederign.me/blog/2026-01-10-agentic-design-patterns-prompt-chaining)
- [Prompt Routers and Flow Engineering](https://blog.promptlayer.com/prompt-routers-and-flow-engineering-building-modular-self-correcting-agent-systems/)
- [20 AI Agent Design Patterns as a Stack](https://medium.com/@kumaran.isk/20-ai-agent-design-patterns-organized-as-a-stack-not-a-menu-8e0df0ee99c3)
- [Multi-Agent AI in 2026: CrewAI, LangGraph, AutoGen](https://dev.to/ottoaria/multi-agent-ai-in-2026-build-production-systems-with-crewai-langgraph-autogen-5e40)
- [Agentic AI Frameworks 2026](https://myengineeringpath.dev/tools/agentic-frameworks/)
- [React + AI: Building Intelligent Web Apps in 2026](https://dev.to/p_rg_16c44961af05b38369f/react-ai-building-intelligent-web-applications-in-2026-2gae)
- [Streaming LLM Responses in React with SSE](https://kkit.dev/blog/streaming-llm-responses-react)
- [Vercel AI SDK Patterns](https://github.com/akashp1712/ai-sdk-patterns)
- [AI Agent Routing: Intent Classification Guide](https://docs.bswen.com/blog/2026-03-06-agent-routing)
- [Agentic AI 2026: Autonomous Frontend Architectures](https://bryancode.dev/en/blog/the-rise-of-agentic-ai-building-autonomous-frontend-workflows-in-2026)
- [The 2026 Guide to AI Presentation Makers](https://nerdleveltech.com/the-2026-guide-to-ai-presentation-makers-gamma-tome-beautifulai-canva)
- [Best AI Presentation Tools 2026 Compared](https://www.comparegen.ai/blog/best-ai-presentation-tools-2026)
- [Templafy AI PowerPoint Creation](https://finance.yahoo.com/sectors/technology/articles/templafy-gives-everyone-instant-access-121600288.html)
- [BCG AI Product Assembly Line](http://www.businessinsider.com/bcg-boston-consulting-group-ai-products-development-agents-2025-12)
- [McKinsey Leans on AI for PowerPoints](https://news.bgov.com/artificial-intelligence/mckinsey-leans-on-ai-to-make-powerpoints-faster-draft-proposals?context=search&index=2)
- [BCG Deckster](https://baileyherb.com/deckster)
- [Training Models at Tome](https://tome.app/blog/training-models-at-tome-how-engineering-leaders-push-the-limits-of-machine-learning-ai)
- [PptxGenJS GitHub](https://github.com/gitbrent/PptxGenJS)
