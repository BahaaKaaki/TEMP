/**
 * General-Purpose Agentic System
 *
 * True think loop — the agent decides what to do at every step.
 * No hardcoded pipeline. The agent reasons about:
 *   - What it knows so far
 *   - What it still needs
 *   - What tool to use next (search, analyze, check KB, draft)
 *   - When it has enough to compile slides
 *
 * Budget model — weighted credits:
 *   Think + decide  = 1 credit (fast model)
 *   Deep analysis    = 3 credits
 *   Web search       = 2 credits
 *   KB search        = 0 credits (local)
 *   Compile slides   = free (critical — always runs)
 *
 * Self-correcting: if a call fails, the agent diagnoses and adapts.
 */

import { agentChat, getWorkLevelInstructions, currentDateString } from './aiService';
import { saveEngagement } from './knowledgeBase';
import { retrieveAndFormat } from './knowledgeBaseRAG';
import { audit, describeModel } from '../utils/auditLog';


// ─── Phases (for UI state) ──────────────────────────────────────────────────
export const AgentPhase = {
  IDLE: 'idle',
  THINKING: 'thinking',
  CLARIFYING: 'clarifying',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  AWAITING_APPROVAL: 'awaiting_approval',
  COMPILING: 'compiling',
  READY: 'ready',
  ERROR: 'error',
};

// ─── Cost model ─────────────────────────────────────────────────────────────
const CREDIT = {
  THINK: 1,     // fast-model decision call
  DEEP: 3,      // deep analysis
  SEARCH: 2,    // web search API + synthesis
  KB: 0,        // local
  COMPILE: 0,   // critical — always runs
};
const DEFAULT_MAX_BUDGET = 40;
const MIN_BUDGET = 8; // Enough for ~3 research + compile

// ─── Team structure ────────────────────────────────────────────────────────
// Manager:          Creates the plan, compiles final content, reviews quality
// Senior Associate: Handles complex research, deep analysis, can review
// Associate:        Intake, routine research, search synthesis, slide building
//
const AGENT_SKILLS = `TEAM:
All team members are research consultants with different personas/focus areas. The manager coordinates.
Use first names only (no last names). Use a diverse mix typical of Dubai: mostly Arabic and Western, some South/East Asian. E.g. Omar, Layla, Marcus, Priya, Khalid, Sophie, Rami, Aisha, James, Mei, Tariq, Elena.
- Manager: owns the research plan, assigns research queries, compiles findings
- Consultants: each has a unique focus — data gathering, analysis, benchmarking, or synthesis — depending on their assigned persona

SKILLS:
- Pyramid Principle: lead with the answer, support with structured logic
- MECE analysis: mutually exclusive, collectively exhaustive breakdowns
- Data synthesis: extract insights from research, flag confidence levels
- Benchmarking: compare metrics across companies, industries, time periods
- Quantitative analysis: financial metrics, growth rates, market sizing, ratios
PRINCIPLES:
- Output ONLY research data — facts, numbers, analysis, comparisons
- Do NOT give advice on formatting, slide design, or presentation structure
- Use real data and specifics — never "TBD" or placeholders
- When uncertain, flag it honestly rather than fabricating
- Adjust depth and detail to the configured work level`;


// ═════════════════════════════════════════════════════════════════════════════
//  AGENT
// ═════════════════════════════════════════════════════════════════════════════
export class ConsultingTeamAgent {
  constructor({ settings, onProgress, onPhaseChange, onThinking, knowledgeBaseEntries, onAiIO }) {
    this.settings = settings;
    this.onProgress = onProgress;
    this.onPhaseChange = onPhaseChange;
    this.onThinking = onThinking;
    this.onAiIO = onAiIO;
    this.knowledgeBaseEntries = knowledgeBaseEntries || null;

    // State
    this.phase = AgentPhase.IDLE;
    this.isAborted = false;

    // Budget
    this.budgetTotal = 0;
    this.budgetUsed = 0;
    this._budgetSet = false;

    // Knowledge — accumulated learnings from all agent actions
    this.knowledge = [];

    // Manager queries — each research brief sent to the team
    this.managerQueries = [];

    // Plan — slide plan (from planning phase, can be revised by agent)
    this._planContext = null;

    // Conversation
    this.conversationHistory = [];
    this.originalRequest = null;
    this.userInputs = [];

    // Understanding (Phase 1 output)
    this.understanding = null;

    // Approval flow
    this.storyline = null;
    this.approvedStoryline = null;
    this._pendingRevision = null;

    // Final output
    this.structure = null;

    // UI
    this.steps = [];
    this.thinkingLog = [];
    this.aiIOLog = [];
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  abort() { this.isAborted = true; }

  approveStoryline(editedStoryline = null) {
    this.approvedStoryline = editedStoryline || this.storyline;
    const edits = editedStoryline?.sections?.map(s => s.sectionTitle).join(', ') || '';
    this._logUserInput('approval', edits
      ? `Approved with edits: ${editedStoryline.mainMessage || ''}. Sections: ${edits}`
      : 'Approved as-is');
  }

  reviseStoryline(userFeedback, editedStoryline = null) {
    this.budgetTotal += 3;
    this._log('Revision requested — budget extended by 3');
    this._pendingRevision = { userFeedback, editedStoryline: editedStoryline || this.storyline };
    this._logUserInput('revision', userFeedback);
  }

  addToHistory(role, content) {
    this.conversationHistory.push({ role, content, timestamp: Date.now() });
  }

  // ─── User input tracking ─────────────────────────────────────────────────
  _logUserInput(type, content) {
    this.userInputs.push({ type, content, timestamp: Date.now() });
  }

  _userInputsContext() {
    if (this.userInputs.length === 0) return '';
    const lines = this.userInputs.map(inp => `[${inp.type.toUpperCase()}] ${inp.content}`).join('\n');
    return `\nUSER DECISIONS & FEEDBACK (treat as binding requirements):\n${lines}\n`;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  MAIN ENTRY POINT
  // ═════════════════════════════════════════════════════════════════════════
  async process(userRequest, context = {}) {
    if (this.isAborted) return { success: false, error: 'Aborted' };
    this.presentationContext = context;
    this.addToHistory('user', userRequest);
    if (!this.originalRequest) this.originalRequest = userRequest;

    // Track clarification answers
    const isClarification = this.conversationHistory.filter(m => m.role === 'user').length > 1
      && !this._pendingRevision && !this.approvedStoryline;
    if (isClarification) this._logUserInput('clarification', userRequest);

    try {
      // ─── RESUME: revision ───
      if (this._pendingRevision) return await this._resumeWithRevision();

      // ─── RESUME: after approval ───
      if (this.approvedStoryline) {
        const result = await this._resumeAfterApproval();
        this.approvedStoryline = null;
        return result;
      }

      // ─── FRESH: reset if needed ───
      if (this.understanding) {
        this._log('New request — starting fresh');
        this.understanding = null;
        this.knowledge = [];
        this._planContext = null;
        this.structure = null;
        this.budgetTotal = 0;
        this.budgetUsed = 0;
        this._budgetSet = false;
      }

      // ════ PHASE 1: UNDERSTAND ════════════════════════════════════════════
      this._setPhase(AgentPhase.THINKING, 'Understanding your request...');
      this._updateSteps([{ name: 'Understanding request', status: 'active' }]);

      const understanding = await this._understand(userRequest, context);
      if (this.isAborted) return { success: false, error: 'Aborted' };

      // Clarification needed?
      if (understanding.needsClarification) {
        this._setPhase(AgentPhase.CLARIFYING);
        const q = understanding.questions?.[0]?.question || 'Could you provide more details?';
        this.addToHistory('assistant', q);
        return {
          success: true,
          needsClarification: true,
          questions: understanding.questions || [],
          question: q,
          missingInfo: [],
          suggestedOptions: understanding.questions?.[0]?.options || [],
        };
      }

      this.understanding = understanding;

      // Set budget — enforce minimum so agent has room to work
      const estimated = understanding.estimatedBudget || 15;
      const maxBudget = this.settings?.agentMaxBudget || DEFAULT_MAX_BUDGET;
      this.budgetTotal = Math.min(Math.max(estimated, MIN_BUDGET), maxBudget);
      this._budgetSet = true;

      const scopeSummary = `${understanding.topic || 'Presentation'} — ${understanding.slideCount || '?'} slides`;
      this._updateSteps([
        { name: 'Understanding request', status: 'complete', summary: scopeSummary },
      ]);

      // ════ PHASE 2: PLAN ══════════════════════════════════════════════════
      // Simple tasks (1-3 slides, no research) → skip planning + approval
      if (understanding.complexity === 'simple' && (understanding.slideCount || 5) <= 3) {
        return await this._agentLoop(understanding);
      }

      // Everything else → plan and present for approval
      this._setPhase(AgentPhase.PLANNING, 'Creating a plan...');
      this._updateSteps([
        { name: 'Understanding request', status: 'complete', summary: scopeSummary },
        { name: 'Planning approach', status: 'active' },
      ]);

      const plan = await this._createPlan(understanding, context);
      if (this.isAborted) return { success: false, error: 'Aborted' };

      this._planContext = plan;

      // Convert plan → storyline format for approval UI
      const storyline = this._planToStoryline(understanding, plan);
      this.storyline = storyline;

      const slideCount = plan.slidesPlan?.length || understanding.slideCount || '?';
      this._setPhase(AgentPhase.AWAITING_APPROVAL, 'Plan ready for review');
      this._updateSteps([
        { name: 'Understanding request', status: 'complete', summary: scopeSummary },
        { name: 'Planning approach', status: 'complete', summary: `${slideCount} slides planned` },
        { name: 'Awaiting your approval', status: 'active' },
      ]);

      return {
        success: true,
        needsApproval: true,
        storyline,
        brief: understanding,
        steps: this.steps,
        logs: this.thinkingLog,
      };
    } catch (error) {
      console.error('[Agent] Error:', error);
      this._setPhase(AgentPhase.ERROR, error.message);
      return {
        success: false,
        error: error.message,
        thinkingLog: this.thinkingLog,
        logs: this.thinkingLog,
      };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PHASE 1: UNDERSTAND
  // ═════════════════════════════════════════════════════════════════════════
  async _understand(userRequest, context) {
    const existingSlides = context.slideSummaries?.length > 0
      ? context.slideSummaries.map(s => `  ${s.index + 1}. "${s.title}" (${s.type})`).join('\n')
      : '(empty deck)';

    let flowContext = '';
    if (context.activeFlow) {
      flowContext = `\nACTIVE PRESENTATION FLOW:\n"${context.activeFlow.name}"\n${context.activeFlow.sections?.map((s, i) =>
        `  ${i + 1}. "${s.templateHint}" | "${s.instruction}"${s.isRepeatable ? ' (repeatable)' : ''}`
      ).join('\n') || ''}`;
    }

    let kbContext = '';
    if (this.knowledgeBaseEntries?.length > 0) {
      const relevant = retrieveAndFormat(userRequest, this.knowledgeBaseEntries, { topK: 3 });
      if (relevant) kbContext = `\nINTERNAL KNOWLEDGE BASE MATCHES:\n${relevant}`;
    }

    const alreadyAsked = this.conversationHistory.filter(m => m.role === 'user').length > 1;

    const prompt = `Analyze this request and figure out how to approach it.
TODAY: ${currentDateString()}

USER REQUEST:
${userRequest}

EXISTING DECK:
${existingSlides}${flowContext}${kbContext}${this._userInputsContext()}

YOUR TASKS:
1. UNDERSTAND what the user needs — be specific, capture everything
2. DECIDE if you need to ask the user for anything:
   - Only ask if the information is truly missing AND the user would realistically know it
   - Don't ask what you can figure out or research yourself
   - Don't ask generic questions — be specific, provide suggested answers
   - Maximum 4 focused questions if truly needed
   ${alreadyAsked ? '   - You already asked a clarification. DO NOT ask again. Proceed with reasonable assumptions.' : ''}
3. ASSESS complexity: "simple" (1-3 factual slides) | "moderate" (4-8 slides) | "complex" (9-15 slides) | "critical" (16+ slides, deep work)
4. DETERMINE what expertise areas are relevant (e.g., "market analysis", "strategy", "financial modeling")
5. DETERMINE what tools would help: web_search (current data), kb_search (internal docs)
6. SET slide count — if user gives a range like "15-18", use the higher end
7. ESTIMATE budget in credits: think_step=1, deep_analysis=3, web_search=2. Be efficient but thorough.

Return JSON:
{
  "needsClarification": boolean,
  "questions": [{"question": "text", "options": ["A", "B", "C"]}],
  "topic": "specific description of what to build",
  "audience": "who will see this",
  "audienceExpertise": "novice|intermediate|expert",
  "purpose": "inform|persuade|pitch|report|propose|educate",
  "complexity": "simple|moderate|complex|critical",
  "slideCount": number,
  "needsSearch": boolean,
  "expertiseNeeded": ["area 1", "area 2"],
  "toolsNeeded": ["web_search"],
  "estimatedBudget": number,
  "toneGuidance": "professional|executive|casual|technical",
  "keyQuestions": ["question the presentation must answer"],
  "fullClientAsk": "comprehensive capture — nothing lost",
  "contextDigest": "3-5 sentence summary"
}`;

    const result = await this._llm('consultant', 'Understanding your request', prompt, { useDeep: true });

    // Safety: never ask twice
    if (alreadyAsked && result?.needsClarification) result.needsClarification = false;

    return result || {
      topic: userRequest,
      complexity: 'moderate',
      slideCount: 5,
      estimatedBudget: 15,
      needsSearch: false,
      fullClientAsk: userRequest,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PHASE 2: PLAN
  //  Creates initial slide plan for approval. After approval, the agent
  //  loop decides HOW to gather content — this just sets the target.
  // ═════════════════════════════════════════════════════════════════════════
  async _createPlan(understanding, context) {
    const flowHint = context.activeFlow
      ? `\nACTIVE FLOW to follow: "${context.activeFlow.name}"\n${context.activeFlow.sections?.map((s, i) =>
        `  ${i + 1}. "${s.templateHint}" | "${s.instruction}"`
      ).join('\n') || ''}`
      : '';

    const prompt = `Create a detailed plan for this presentation.
TODAY: ${currentDateString()}

TASK: ${understanding.fullClientAsk || understanding.topic}
AUDIENCE: ${understanding.audience || 'business professionals'} (${understanding.audienceExpertise || 'intermediate'})
PURPOSE: ${understanding.purpose || 'inform'}
SLIDE COUNT: exactly ${understanding.slideCount} slides — no fewer
TONE: ${understanding.toneGuidance || 'professional'}
TOOLS AVAILABLE: ${this.settings.searchEnabled ? 'web_search, ' : ''}kb_search, analyze
BUDGET: ${this.budgetTotal} credits (think=1, deep=3, search=2)
${flowHint}${this._userInputsContext()}

CREATE:

1. NARRATIVE ARC — choose the best storytelling structure FOR THIS REQUEST:
   A) SITUATION → COMPLICATION → RESOLUTION (when there's a clear problem to solve)
   B) CONTEXT → ANALYSIS → INSIGHTS (when exploring a topic in depth)
   C) WHAT → SO WHAT → NOW WHAT (when audience needs to understand implications)
   D) LANDSCAPE → DEEP DIVES → SYNTHESIS (when surveying a broad area)
   E) THESIS → EVIDENCE → REINFORCEMENT (when building a case)
   F) HOOK → EXPLORATION → TAKEAWAYS (when educating or informing)
   G) CUSTOM (describe)
   Choose based on the actual request — do NOT default to proposals or action plans.

2. SECTIONS — decide whether the deck needs formal sections:
   - For LARGE decks (${understanding.slideCount >= 7 ? 'THIS DECK — YES, use sections' : 'typically 7+ slides'}): group slides into 3-5 logical sections (NEVER more than 5)
     - Each section = a coherent topic area (2-4 words, concise) that groups MULTIPLE slides — these become tracker tabs and exec summary items, so keep them short
     - Sections flow logically: overview → deep dives → synthesis
     - If the deck has section trackers, the router may create an executiveSummary slide from these sections — do NOT include an exec summary in the slide plan
     - Sections become navigation trackers (top-left labels on slides)
     - Multiple slides MUST share the same section — a section with only 1 slide is wasteful
   - For SMALL decks (${understanding.slideCount < 7 ? 'THIS DECK — sections are OPTIONAL' : 'typically ≤6 slides'}): sections are optional
     - Skip sections if the narrative flows naturally without them (e.g. Cover → 3 content slides → Closing)
     - Skip the executive summary slide — go straight from cover to content
     - If you DO use sections, still follow the 3-5 rule
   - USE YOUR JUDGMENT: even a 5-slide deck might benefit from sections if the content has clear themes; a 7-slide deck might not need them if it's a simple linear narrative

3. SLIDE-BY-SLIDE PLAN — exactly ${understanding.slideCount} slides:
   - If using sections: each slide belongs to exactly one section
   - If NOT using sections: set "section" to null for each slide, and return "sections": []
   - Start with the big picture (governing thought)
   - Pyramid: overview → prioritized areas → deep dives → synthesis
   - Each slide: ONE key message + what content it needs

CRITICAL: The sum of slides must equal exactly ${understanding.slideCount}.

Return JSON:
{
  "narrativeArc": "A-G",
  "narrativeArcName": "human-readable name",
  "governingThought": "the one sentence the audience must remember",
  "openingStrategy": "how to open (specific)",
  "closingStrategy": "how to close — match the content (e.g. synthesis, key takeaways, implications). Only use 'next steps' or 'action plan' if the request is explicitly a proposal or plan.",
  "toneDirection": "tone for the whole deck",
  "sections": [
    {
      "name": "Section Name (3-6 words)",
      "purpose": "what this section accomplishes in the narrative",
      "slideNums": [2, 3, 4]
    }
  ],
  "slidesPlan": [
    {
      "slideNum": 1,
      "title": "slide title (3-5 words)",
      "section": "which section this belongs to",
      "keyMessage": "the so-what (1 sentence)",
      "contentType": "summary|metrics|comparison-cross-sectional|comparison-over-time|ranking|benchmark-peer|benchmark-index|timeline|process|detail|chart-trend|chart-waterfall|chart-bar|chart-dual|synthesis",
      "slideRole": "opening|body|wrap-up",
      "contentNotes": "brief notes on what content goes here — for data slides specify: how many entities, how many time periods, how many metrics",
      "needsResearch": false
    }
  ],
  "researchNeeded": ["topic 1 to research", "topic 2"],
  "totalEstimatedCost": number,
  "guidance": "2-3 sentences on focus areas"
}`;

    const result = await this._llm('manager', 'Creating the plan', prompt, {
      useDeep: true,
      temperature: 0.4,
    });

    // Validate slide count
    if (result?.slidesPlan) {
      const planned = result.slidesPlan.length;
      const target = understanding.slideCount || 5;
      if (planned < target) {
        this._log(`Plan has ${planned} slides but target is ${target} — will enforce during content building`);
      }
    }

    return result || { slidesPlan: [], sections: [], narrativeArcName: 'standard' };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  RESUME AFTER APPROVAL → Enter the agent loop
  // ═════════════════════════════════════════════════════════════════════════
  async _resumeAfterApproval() {
    const understanding = this.understanding;
    const plan = this._planContext || {};
    const approved = this.approvedStoryline;

    if (!understanding) {
      return { success: false, error: 'Missing understanding — cannot resume' };
    }

    // Merge user edits back into plan
    if (approved?.sections?.length > 0) {
      const oldSlides = plan.slidesPlan || [];

      // Expand hierarchical sections (with child .slides) into flat body slides
      const hasChildSlides = approved.sections.some(s => s.slides?.length > 0);
      let bodySlides;
      if (hasChildSlides) {
        bodySlides = [];
        for (const sec of approved.sections) {
          if (sec.slides?.length > 0) {
            for (const sl of sec.slides) {
              bodySlides.push({
                title: sl.title || sl.sectionTitle || sec.sectionTitle || 'Slide',
                keyMessage: sl.keyMessage || sec.keyMessage || '',
                contentType: sl.contentType || sec.contentType || 'detail',
                section: sec.sectionTitle || '', // preserve section grouping
                slideRole: sl.slideRole || 'body',
              });
            }
          } else {
            bodySlides.push({
              title: sec.sectionTitle || 'Slide',
              keyMessage: sec.keyMessage || '',
              contentType: sec.contentType || 'detail',
              slideRole: sec.slideRole || 'body',
            });
          }
        }
      } else {
        // Flat sections — each section = one slide (old format or small deck)
        bodySlides = approved.sections.map(s => ({
          title: s.sectionTitle || 'Slide',
          keyMessage: s.keyMessage || '',
          contentType: s.contentType || 'detail',
          slideRole: s.slideRole || 'body',
        }));
      }

      // Reconstruct full slidesPlan: preserve opening/closing from original plan,
      // replace body slides with the user-approved (possibly edited) body slides.
      // This avoids losing cover/closing that aren't shown in the hierarchical UI.
      if (hasChildSlides) {
        const opening = oldSlides.filter(s => s.slideRole === 'opening');
        const closing = oldSlides.filter(s => s.slideRole === 'wrap-up' || s.slideRole === 'closing');
        const newSlides = [
          ...opening,
          ...bodySlides,
          ...closing,
        ];
        plan.slidesPlan = newSlides.map((s, i) => ({
          ...s,
          slideNum: i + 1,
        }));
      } else {
        // Flat format — 1:1 mapping like the old code
        plan.slidesPlan = bodySlides.map((s, i) => {
          const existing = oldSlides[i] || {};
          return {
            ...existing,
            slideNum: i + 1,
            title: s.title || existing.title || 'Slide',
            keyMessage: s.keyMessage || existing.keyMessage || '',
            contentType: s.contentType || existing.contentType || 'detail',
            section: s.section || existing.section || '',
          };
        });
      }

      plan.governingThought = approved.mainMessage || plan.governingThought;

      // Also update plan.sections from approved _planSections if available
      if (approved._planSections) {
        plan.sections = approved._planSections;
      }

      understanding.slideCount = plan.slidesPlan.length;
      this._log(`Approved: ${plan.slidesPlan.length} slides${hasChildSlides ? ` in ${approved.sections.length} sections` : ''} (user may have edited)`);
    }

    this._planContext = plan;
    return await this._agentLoop(understanding);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  RESUME WITH REVISION → Replan → Re-present for approval
  // ═════════════════════════════════════════════════════════════════════════
  async _resumeWithRevision() {
    const { userFeedback, editedStoryline } = this._pendingRevision;
    this._pendingRevision = null;
    const understanding = this.understanding;
    const plan = this._planContext || {};

    if (!understanding) {
      return { success: false, error: 'Missing understanding for revision' };
    }

    this._setPhase(AgentPhase.PLANNING, 'Revising the plan...');
    this._updateSteps([
      { name: 'Understanding request', status: 'complete' },
      { name: 'Your feedback received', status: 'complete' },
      { name: 'Revising plan', status: 'active' },
    ]);

    const currentSections = (editedStoryline?.sections || []).map((s, i) => {
      let line = `  ${i + 1}. "${s.sectionTitle}" — ${s.keyMessage || '(no message)'} [${s.contentType || 'detail'}]`;
      if (s.slides?.length > 0) {
        line += '\n' + s.slides.map(sl => `     - "${sl.title}" [${sl.contentType || 'detail'}]`).join('\n');
      }
      return line;
    }).join('\n');

    const knowledgeSummary = this._summarizeKnowledge();

    const prompt = `The user reviewed the plan and wants changes. Revise it.

ORIGINAL TASK: ${understanding.fullClientAsk || understanding.topic}
${this._userInputsContext()}
CURRENT PLAN (what user saw):
Main message: ${editedStoryline?.mainMessage || plan.governingThought || ''}
${currentSections}

EXISTING KNOWLEDGE:
${knowledgeSummary || '(none yet)'}

USER FEEDBACK:
"${userFeedback}"

Revise the slide plan based on the feedback. Keep what works, change what the user asked.
Maintain coherent sections for navigation trackers.

Return JSON:
{
  "governingThought": "revised main message",
  "narrativeArcName": "arc name",
  "sections": [
    {"name": "Section Name", "purpose": "what it does", "slideNums": [1,2]}
  ],
  "slidesPlan": [
    {"slideNum": N, "title": "title", "section": "Section Name", "keyMessage": "so-what", "contentType": "type", "slideRole": "opening|body|closing", "contentNotes": "notes", "needsResearch": false}
  ],
  "guidance": "focus areas"
}`;

    const revised = await this._llm('manager', 'Revising plan', prompt, {
      temperature: 0.3,
      maxTokens: 4096,
    });

    if (!revised || this.isAborted) {
      return { success: false, error: this.isAborted ? 'Aborted' : 'Revision failed' };
    }

    // Update plan
    if (revised.slidesPlan) plan.slidesPlan = revised.slidesPlan;
    if (revised.governingThought) plan.governingThought = revised.governingThought;
    if (revised.narrativeArcName) plan.narrativeArcName = revised.narrativeArcName;
    if (revised.sections) plan.sections = revised.sections;
    if (revised.guidance) plan.guidance = revised.guidance;
    this._planContext = plan;

    // Rebuild approval storyline
    const storyline = this._planToStoryline(understanding, plan);
    this.storyline = storyline;

    this._setPhase(AgentPhase.AWAITING_APPROVAL, 'Revised plan ready');
    this._updateSteps([
      { name: 'Understanding request', status: 'complete' },
      { name: 'Your feedback applied', status: 'complete' },
      { name: 'Plan revised', status: 'complete', summary: `${plan.slidesPlan?.length || '?'} slides` },
      { name: 'Awaiting your approval', status: 'active' },
    ]);

    return {
      success: true,
      needsClarification: false,
      needsApproval: true,
      storyline,
      steps: this.steps,
      thinkingLog: this.thinkingLog,
      logs: this.thinkingLog,
      budgetUsed: this.budgetUsed,
      budgetTotal: this.budgetTotal,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  THE AGENT LOOP
  //
  //  Structured protocol:
  //    1. PLAN: Manager creates a research work plan with phases
  //    2. EXECUTE: Phases run in order; tasks within a phase run in parallel
  //    3. COMPILE: Assemble all research data into final content
  //
  //  Example work plan for a benchmarking request:
  //    Phase 1 (sequential): "Select peer companies and KPIs"
  //    Phase 2 (parallel):   "Fetch EBITDA for Company A", "Fetch EBITDA for Company B", ...
  //    Phase 3 (sequential): "Synthesize benchmarking findings"
  //
  //  Budget gates every action. The manager sees remaining credits and
  //  must allocate them wisely across phases.
  // ═════════════════════════════════════════════════════════════════════════
  async _agentLoop(understanding) {
    this._setPhase(AgentPhase.EXECUTING, 'Planning research...');
    const plan = this._planContext || {};

    // Carry forward completed steps from planning phase
    const baseSteps = this.steps.filter(s => s.status === 'complete').map(s => ({ ...s }));
    const liveSteps = [];

    // ─── STEP 1: Manager creates structured research work plan ───
    liveSteps.push({ name: 'Creating research work plan', status: 'active' });
    this._updateSteps([...baseSteps, ...liveSteps, { name: 'Executing research', status: 'pending' }, { name: 'Building slides', status: 'pending' }, { name: 'Designing slides', status: 'pending', role: 'consultant' }]);

    const researchPlan = await this._createResearchPlan(understanding, plan);
    if (this.isAborted) return { success: false, error: 'Aborted' };

    const phases = researchPlan?.phases || [];
    liveSteps[0].status = 'complete';
    liveSteps[0].summary = `${phases.length} phases, ${phases.reduce((n, p) => n + (p.tasks?.length || 0), 0)} tasks`;

    // Track the full research plan as the first manager query
    this.managerQueries.push({
      iteration: 0,
      action: 'plan',
      query: '',
      reasoning: researchPlan?.reasoning || 'Research work plan',
      description: 'Research Work Plan',
      phases: phases.map(p => ({
        name: p.name,
        parallel: !!p.parallel,
        tasks: (p.tasks || []).map(t => ({ action: t.action, query: t.query })),
      })),
    });

    this._log(`Research plan: ${phases.length} phases`);

    // ─── STEP 2: Execute phases ───
    this._setPhase(AgentPhase.EXECUTING, 'Executing research plan...');

    for (let pi = 0; pi < phases.length; pi++) {
      if (this.isAborted) return { success: false, error: 'Aborted' };
      if (this._budgetExhausted()) {
        this._log(`Budget exhausted — skipping remaining phases`);
        break;
      }

      const phase = phases[pi];
      const tasks = phase.tasks || [];
      if (tasks.length === 0) continue;

      // Show phase as active step
      const phaseLabel = `Phase ${pi + 1}: ${phase.name}`;
      liveSteps.push({ name: phaseLabel, status: 'active' });
      this._updateSteps([...baseSteps, ...liveSteps, { name: 'Building slides', status: 'pending' }, { name: 'Designing slides', status: 'pending', role: 'consultant' }]);

      if (phase.parallel && tasks.length > 1) {
        // ─── PARALLEL: Execute all tasks in this phase concurrently ───
        this._log(`${phaseLabel}: ${tasks.length} tasks in parallel`);

        const taskPromises = tasks.map(async (task) => {
          if (this.isAborted || this._budgetExhausted()) return;
          try {
            await this._executeTask(task, understanding);
          } catch (err) {
            this._log(`Task failed: ${task.query || task.description} — ${err.message}`);
          }
        });

        await Promise.all(taskPromises);
      } else {
        // ─── SEQUENTIAL: Execute tasks one by one ───
        for (const task of tasks) {
          if (this.isAborted || this._budgetExhausted()) break;
          this._log(`${phaseLabel}: ${task.description || task.query}`);
          try {
            await this._executeTask(task, understanding);
          } catch (err) {
            this._log(`Task failed: ${task.query || task.description} — ${err.message}`);
          }
        }
      }

      // Track each phase as a manager query
      this.managerQueries.push({
        iteration: pi + 1,
        action: phase.parallel ? 'parallel' : 'sequential',
        query: tasks.map(t => t.query).join(' | '),
        reasoning: phase.name,
        description: phaseLabel,
        topics: tasks.flatMap(t => t.topics || []),
      });

      // Mark phase complete
      liveSteps[liveSteps.length - 1].status = 'complete';
      liveSteps[liveSteps.length - 1].summary = `${tasks.length} task${tasks.length > 1 ? 's' : ''}${phase.parallel ? ' (parallel)' : ''}`;
      this._updateSteps([...baseSteps, ...liveSteps, { name: 'Building slides', status: 'pending' }, { name: 'Designing slides', status: 'pending', role: 'consultant' }]);
    }

    // ─── COMPILE: Build final slide content ───
    this._setPhase(AgentPhase.COMPILING, 'Assembling slide content...');
    this._updateSteps([
      ...baseSteps,
      ...liveSteps,
      { name: 'Building slides', status: 'active' },
      { name: 'Designing slides', status: 'pending', role: 'consultant' },
    ]);

    const structure = await this._buildContent(understanding, plan);
    if (this.isAborted) return { success: false, error: 'Aborted' };

    // Guard: empty content → recovery
    if (!structure?.sections || structure.sections.length === 0) {
      this._log('No content produced — attempting recovery');
      const recovery = await this._recoverContent(understanding, plan);
      if (!recovery?.sections?.length) {
        return {
          success: false,
          error: 'No slide content generated after recovery attempt.',
          steps: this.steps,
          thinkingLog: this.thinkingLog,
          logs: this.thinkingLog,
        };
      }
      this.structure = recovery;
    } else {
      this.structure = structure;
    }

    const finalStructure = this.structure;
    const sectionCount = finalStructure.sections.length;

    this._updateSteps([
      ...baseSteps,
      ...liveSteps,
      { name: 'Building slides', status: 'complete', summary: `${sectionCount} slides ready` },
      { name: 'Designing slides', status: 'active', role: 'consultant' },
    ]);

    // Build the rich prompt for the router FIRST so we can save it to KB
    const routerPrompt = this._buildRichPrompt(finalStructure);

    // Save engagement to KB — include router input (exact slide instructions)
    try {
      const routerInput = (finalStructure.sections || []).map((s, i) => ({
        index: i + 1,
        title: s.sectionTitle || '',
        keyMessage: s.keyMessage || '',
        contentType: s.contentType || '',
        content: s.instruction || '',
      }));

      saveEngagement({
        topic: understanding.topic || this.originalRequest,
        request: this.originalRequest,
        userInputs: this.userInputs,
        understanding,
        plan: this._planContext,
        knowledge: this.knowledge,
        finalStructure,
        routerInput,
        routerPrompt, // The FULL prompt string sent to the router
        managerQueries: this.managerQueries, // Each research brief sent to team
        thinkingLog: this.thinkingLog,
        aiIOLog: this.aiIOLog, // All LLM input/output exchanges
        budget: { total: this.budgetTotal, used: this.budgetUsed },
      });
    } catch (e) {
      console.warn('[Agent] Failed to save to KB:', e.message);
    }

    this._setPhase(AgentPhase.READY, 'Handing off to slide design...');

    return {
      success: true,
      needsClarification: false,
      needsApproval: false,
      refinedPrompt: routerPrompt,
      structure: finalStructure,
      steps: this.steps,
      thinkingLog: this.thinkingLog,
      logs: this.thinkingLog,
      aiIOLog: this.aiIOLog,
      budgetUsed: this.budgetUsed,
      budgetTotal: this.budgetTotal,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  CREATE RESEARCH PLAN
  //
  //  Manager creates a structured work plan with sequential phases.
  //  Tasks within a phase marked "parallel" execute concurrently.
  //  This replaces the old improvise-each-step approach.
  // ═════════════════════════════════════════════════════════════════════════
  async _createResearchPlan(understanding, plan) {
    const budget = this._budgetInfo();

    // Search availability
    const hasBuiltInSearch = this.settings.model &&
      (this.settings.model.includes('gemini') || this.settings.model.includes('gpt-5') || this.settings.model.includes('gpt-4o'));
    const hasSearchEndpoint = !!(this.settings.searchEndpoint && this.settings.searchApiKey);
    const searchAvailable = !!(this.settings.searchEnabled && (hasBuiltInSearch || hasSearchEndpoint));
    const kbAvailable = this.knowledgeBaseEntries?.length > 0;

    // Research agenda from slide plan
    const researchTopics = (plan.slidesPlan || []).map(s =>
      `- "${s.title}": ${s.keyMessage || s.contentNotes || ''}${s.needsResearch ? ' [needs data]' : ''}`
    ).join('\n');

    const prompt = `You are a research manager. Create a STRUCTURED RESEARCH WORK PLAN for your team.
TODAY: ${currentDateString()}

TASK: ${understanding.fullClientAsk || understanding.topic}
AUDIENCE: ${understanding.audience || 'business professionals'}

TOPICS TO COVER:
${researchTopics || '(general research needed)'}

BUDGET: ${budget.remaining} credits (search costs 2, analyze costs 1, kb_search costs 0)
AVAILABLE TOOLS:
- search: Web search for current data/stats. ${searchAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}
- analyze: Deep analysis using existing knowledge. Always available.
- kb_search: Search internal knowledge base. ${kbAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}

Create a plan with PHASES that execute in order. Tasks within a phase marked "parallel": true run concurrently.

PLANNING RULES:
- Break complex research into logical phases with dependencies
- Use parallel phases when tasks are independent (e.g., fetching data for different companies)
- Use sequential phases when later work depends on earlier results (e.g., first select KPIs, then fetch data for each)
- Be specific — each task should have a concrete, focused query
- Stay within budget — total cost of all search+analyze tasks must fit budget
- Don't research what you already know from general knowledge — use analyze for that
- Be practical — 2-5 phases is typical, each with 1-4 tasks
- search queries must be specific: "NVIDIA revenue ${new Date().getFullYear()}" not "company data"

EXAMPLES of good work plans:
- Benchmarking: Phase 1 (sequential): analyze to select peer companies + KPIs → Phase 2 (parallel): search data for each peer → Phase 3 (sequential): analyze to synthesize comparison
- Market analysis: Phase 1 (parallel): search market size + search key players + search trends → Phase 2 (sequential): analyze implications
- Strategy: Phase 1 (sequential): analyze to identify key dimensions → Phase 2 (parallel): search evidence for each dimension → Phase 3 (sequential): analyze recommendations

Return JSON:
{
  "reasoning": "brief explanation of the work plan approach",
  "phases": [
    {
      "name": "Phase description (e.g., 'Select peer companies and KPIs')",
      "parallel": false,
      "tasks": [
        {
          "action": "search|analyze|kb_search",
          "query": "specific search query or analysis topic",
          "description": "human-readable task name",
          "topics": ["topic this covers"]
        }
      ]
    }
  ]
}`;

    return await this._llm('manager', 'Creating research work plan', prompt, {
      useDeep: false,
      temperature: 0.3,
      maxTokens: 3000,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  EXECUTE A SINGLE TASK from the research plan
  //
  //  Maps a task {action, query, description, topics} to the appropriate
  //  execution method and stores results in this.knowledge.
  // ═════════════════════════════════════════════════════════════════════════
  async _executeTask(task, understanding) {
    const action = task.action || 'analyze';
    const query = task.query || task.description || '';

    switch (action) {
      case 'search': {
        if (!query) break;
        const searchResult = await this._search(query);
        if (searchResult) {
          const synthesis = await this._synthesizeSearch({ query, reasoning: task.description }, searchResult);
          this.knowledge.push({
            source: `Search: ${query}`,
            summary: synthesis?.findings || searchResult.substring(0, 500),
            dataPoints: synthesis?.dataPoints || [],
            themes: synthesis?.themes || [],
            sources: synthesis?.sources || [],
            topics: task.topics || [],
            type: 'search',
          });
        } else {
          this._log(`No results for: "${query.substring(0, 60)}"`);
        }
        break;
      }

      case 'analyze': {
        // Run an analysis call — the model produces the analysis directly
        const analysisPrompt = `Analyze the following topic as a research consultant. Output ONLY factual data, numbers, comparisons, and analysis. No formatting advice.
TODAY: ${currentDateString()}
CONTEXT: ${understanding?.fullClientAsk || understanding?.topic || ''}

TOPIC TO ANALYZE: ${query}

EXISTING KNOWLEDGE:
${this._summarizeKnowledge() || '(none yet)'}

Return JSON:
{
  "analysis": "your full analysis with all data points, comparisons, and reasoning",
  "dataPoints": ["specific data point 1", "specific data point 2", "..."],
  "themes": ["theme 1", "theme 2"]
}`;

        const result = await this._llm('consultant', `Analyzing: ${query.substring(0, 40)}`, analysisPrompt, {
          useDeep: false,
          temperature: 0.3,
          maxTokens: 2500,
        });

        this.knowledge.push({
          source: query || task.description || 'Analysis',
          summary: result?.analysis || result?.reasoning || '',
          dataPoints: result?.dataPoints || [],
          themes: result?.themes || [],
          topics: task.topics || [],
          type: 'analysis',
        });
        break;
      }

      case 'kb_search': {
        if (!query || !this.knowledgeBaseEntries?.length) break;
        const kbResult = retrieveAndFormat(
          query, this.knowledgeBaseEntries, { topK: 5 }
        );
        if (kbResult) {
          this.knowledge.push({
            source: `Internal docs: ${query}`,
            summary: kbResult.substring(0, 2000),
            dataPoints: [],
            themes: [],
            topics: task.topics || [],
            type: 'kb',
          });
        }
        break;
      }

      default:
        break;
    }
  }

  // ─── Synthesize search results into structured research data ───
  async _synthesizeSearch(decision, searchResult) {
    if (this._budgetExhausted()) {
      const fallbackLimit = this.settings.limitSearchCharsFallback || 4000;
      return { findings: searchResult.substring(0, fallbackLimit), dataPoints: [], themes: [] };
    }

    const wantSources = this.settings.searchIncludeSources;

    const prompt = `Synthesize these search results into structured research data.

SEARCH QUERY: ${decision.query}
PURPOSE: ${decision.reasoning || 'research'}

SEARCH RESULTS:
${searchResult.substring(0, this.settings.limitSearchCharsBeforeSynthesis || 12000)}

Extract ALL useful data — numbers, comparisons, trends, company specifics, market sizes, growth rates, rankings.
Organize by theme. Output ONLY factual research data. No advice on formatting or presentation.
${wantSources ? 'If source URLs are available, collect them in a "sources" array — deduplicated, no repetition.' : 'Do NOT include any URLs or links.'}

Return JSON:
{
  "findings": "comprehensive thematic summary with ALL specific data points and comparisons",
  "dataPoints": ["$X billion", "Y% growth", "Company A leads with Z%", "..."],
  "themes": ["theme 1", "theme 2"]${wantSources ? ',\n  "sources": ["https://source1.com", "https://source2.com"]' : ''}
}`;

    return await this._llm('consultant', `Synthesizing: ${decision.query}`, prompt, {
      useDeep: false,
      temperature: 0.2,
      maxTokens: this.settings.limitSynthesisTokens || 4096,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  BUILD FINAL CONTENT
  //  Assembles all knowledge into slide structure with coherent sections
  //  and tracker labels that flow from the executive summary.
  // ═════════════════════════════════════════════════════════════════════════
  async _buildContent(understanding, plan) {
    const slidesPlan = plan.slidesPlan || [];
    const ctx = this.presentationContext || {};
    const sections = plan.sections || [];

    let existingContext = '';
    if (ctx.slideSummaries?.length > 0) {
      existingContext = `\nEXISTING DECK (${ctx.slideCount} slides):\n${ctx.slideSummaries.map(s => `  ${s.index + 1}. "${s.title}" (${s.type})`).join('\n')}\nNew slides will be ADDED. Don't duplicate.\n`;
    }

    let flowContext = '';
    if (ctx.activeFlow) {
      flowContext = `\nACTIVE FLOW: "${ctx.activeFlow.name}"\n${ctx.activeFlow.sections?.map((s, i) =>
        `  ${i + 1}. "${s.templateHint}" | "${s.instruction}"${s.isRepeatable ? ' | REPEATABLE' : ''}`
      ).join('\n') || ''}\nFollow this flow precisely.\n`;
    }

    // Slide plan with section assignments
    const slidesText = slidesPlan.map(s =>
      `Slide ${s.slideNum}: "${s.title}" [${s.contentType || 'detail'}] — Section: "${s.section || 'General'}"\n  Message: ${s.keyMessage}\n  Notes: ${s.contentNotes || ''}`
    ).join('\n');

    // Section structure for tracker consistency
    const sectionStructure = sections.length > 0
      ? sections.map((s, i) => `  ${i + 1}. "${s.name}" (slides: ${(s.slideNums || []).join(', ')})`).join('\n')
      : '(no explicit sections — infer from slide plan)';

    // Compact knowledge — generous limit to preserve worker data for compilation
    // Rich mode gets a higher cap since findings are unstructured and richer
    const knowledgeText = this._summarizeKnowledgeFull();
    const richMode = this.settings.agentRichResearch;
    const MAX_KNOWLEDGE = richMode
      ? (this.settings.limitKnowledgeCompileChars || 120000)
      : (this.settings.limitKnowledgeCompileCharsStd || 80000);
    const trimmedKnowledge = knowledgeText.length > MAX_KNOWLEDGE
      ? knowledgeText.slice(0, MAX_KNOWLEDGE) + '\n... [truncated]'
      : knowledgeText;

    const fullAsk = understanding.fullClientAsk || this.originalRequest || understanding.topic || '';
    const slideCount = understanding.slideCount || slidesPlan.length || 5;
    const perSlide = this.settings.limitCompilerTokensPerSlide || 2000;
    const minBudget = this.settings.limitCompilerTokensMin || 6000;
    const tokenBudget = Math.max(minBudget, slideCount * perSlide);

    const prompt = `You are the manager compiling the deck. Match the agreed plan and storyline.

USER REQUEST: ${fullAsk}
${this._userInputsContext()}
TARGET: ~${slideCount} body slides (the client asked for this — stay close, a few more or fewer is fine). No cover, no closing — those are handled separately.
AUDIENCE: ${understanding.audience || 'business professionals'}
TONE: ${plan.toneDirection || understanding.toneGuidance || 'professional'}
GOVERNING THOUGHT: ${plan.governingThought || understanding.topic}
${existingContext}${flowContext}

AGREED STRUCTURE:
${sectionStructure !== '(no explicit sections — infer from slide plan)' ? `Sections:\n${sectionStructure}` : 'No sections (small deck — flat narrative)'}

SLIDE PLAN:
${slidesText}

TEAM FINDINGS:
${trimmedKnowledge}

${getWorkLevelInstructions(this.settings?.workLevelAgent, 'agent')}

YOUR JOB: ${richMode
  ? `The findings are raw thematic research — NOT pre-structured into slides. Synthesize them into the agreed structure. Read all findings, identify the story, decide what data goes on which slide, and write slide content from scratch using the full richness of the research.`
  : `Structure the team's findings into the plan above.`}
- The plan sections are LOCKED. Use the EXACT section names from AGREED STRUCTURE — do NOT rename, merge, split, or invent new sections. Every slide's "section" field must be one of the agreed names verbatim. If no sections: set to null.
- Section names become navigation trackers on slides. If you change section names, the trackers will be wrong. This is the #1 rule.
- Stay close to ~${slideCount} body slides. Don't pad weak sections or cut rich ones to hit an exact number.
- You may move slides between sections or adjust emphasis within the locked structure, but the section names themselves are immutable.
- If a section has 5+ slides, make its FIRST slide a section-level summary (the "so what" of that section, 2-5 key bullets max), then supporting detail slides.
- Every claim must have inline data. No placeholders, no "[TBD]", no visual/layout instructions.
- Each slide's "instruction" is the FINAL text content — not a brief for a designer. It feeds BOTH text and image models. If the instruction is vague, the image model will produce a generic diagram with placeholder labels instead of real data. Include ALL specific entities, numbers, and relationships.
- Do NOT add an executive summary, deck overview, section preview, or any similar overview/summary slide — that is handled separately after compilation. Jump straight into the body content.
- Do NOT add section cover slides — those are added automatically for large sections.

Return JSON:
{
  "mainMessage": "single most important takeaway",
  "presentationTitle": "short title (3-5 words)",
  "storylineType": "${plan.narrativeArcName || 'standard'}",
  "storylineFlow": "Slide 1 → Slide 2 → ...",
  "sections": [
    {
      "sectionTitle": "title (3-5 words)",
      "section": "Section Name from agreed structure",
      "keyMessage": "the so-what (1 sentence with a verb and data)",
      "contentType": "summary|metrics|comparison-cross-sectional|comparison-over-time|ranking|benchmark-peer|benchmark-index|timeline|process|detail|chart-trend|chart-waterfall|chart-bar|chart-dual|synthesis",
      "slideRole": "body",
      "dataPoints": ["specific data point 1", "..."],
      "instruction": "Complete slide text with ALL data inline"
    }
  ],
  "closing": {
    "keyMessage": "the single most important takeaway",
    "points": ["key insight 1", "..."]
  }
}`;

    // Content building is the MOST CRITICAL step — it produces the exact instructions the router sees.
    // Use the main/deep model for highest quality output.
    const result = await this._llm('manager', 'Compiling and reviewing slide content', prompt, {
      useDeep: true,
      temperature: 0.4,
      maxTokens: tokenBudget,
      critical: true,
      timeout: 180000,
    });

    return result || { sections: [] };
  }

  // Recovery: simpler prompt as fallback
  async _recoverContent(understanding, plan) {
    this._log('Recovery: trying simpler content prompt');
    const slidesPlan = plan.slidesPlan || [];
    const slideCount = understanding.slideCount || slidesPlan.length || 5;
    const slidesText = slidesPlan.map(s =>
      `Slide ${s.slideNum}: "${s.title}" [${s.contentType || 'detail'}] — ${s.keyMessage || ''}`
    ).join('\n');

    const prompt = `Build slide content as JSON. ${slideCount} slides about: ${understanding.fullClientAsk || understanding.topic}

SLIDES:
${slidesText}

Return JSON:
{
  "mainMessage": "takeaway",
  "presentationTitle": "title",
  "storylineType": "${plan.narrativeArcName || 'standard'}",
  "storylineFlow": "Slide 1 → Slide 2 → ...",
  "sections": [
    {
      "sectionTitle": "title",
      "section": "Section Name",
      "keyMessage": "so what",
      "contentType": "detail",
      "dataPoints": ["point 1"],
      "instruction": "Complete brief for slide creator"
    }
  ],
  "closing": { "keyMessage": "key takeaway", "points": ["main insight"] }
}`;

    return await this._llm('consultant', 'Recovery: building content', prompt, {
      useDeep: false,
      temperature: 0.3,
      maxTokens: Math.max(4096, slideCount * 800),
      critical: true,
      timeout: 180000,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  BUILD RICH PROMPT — handoff to the slide router
  //  The router knows nothing about context — everything goes here.
  //  Section trackers flow from the coherent section structure.
  // ═════════════════════════════════════════════════════════════════════════
  _buildRichPrompt(structure) {
    const sections = structure?.sections || [];
    const mainMessage = structure?.mainMessage || '';
    const title = structure?.presentationTitle || this.understanding?.topic || '';
    const storylineType = structure?.storylineType || '';
    const storylineFlow = structure?.storylineFlow || '';
    const closing = structure?.closing || {};

    if (sections.length === 0 && !mainMessage) {
      return `========================================
ORIGINAL USER REQUEST
========================================
${this.originalRequest}

========================================
CONTEXT
========================================
Topic: ${this.understanding?.topic || this.originalRequest}
Audience: ${this.understanding?.audience || 'business professionals'}
Purpose: ${this.understanding?.purpose || 'inform'}

Create a presentation based on the above.`;
    }

    // ── BUILD SECTION TRACKERS ──
    // Only use `sec.section` (the group name), NEVER fall through to `sec.sectionTitle` (unique per slide).
    // If `section` is null/empty, the slide has no section — that's intentional for small decks.
    const sectionMap = new Map(); // section name → tracker label "N. Name"
    let sectionIdx = 0;
    for (const sec of sections) {
      const sName = (sec.section || '').trim();
      if (sName && !sectionMap.has(sName) && sec.slideRole !== 'opening' && sec.slideRole !== 'closing') {
        sectionIdx++;
        sectionMap.set(sName, `${sectionIdx}. ${sName}`);
      }
    }

    // ── ENFORCE SECTION GROUPING FROM PLAN ──
    // The plan always has properly grouped sections (3-5). The content builder often fails to reuse them.
    // Strategy: ALWAYS use the plan's section structure as the authoritative source.
    // Only skip if the plan has no sections (small deck) or the content builder already matches.
    const planSections = this._planContext?.sections || [];
    const bodySlideCount = sections.filter(s => s.slideRole !== 'opening' && s.slideRole !== 'closing').length;
    const hasPlanSections = planSections.length >= 2 && planSections.length <= 5;

    if (hasPlanSections) {
      // Check if content builder's sections match the plan
      const contentSectionNames = new Set();
      for (const sec of sections) {
        const sName = (sec.section || '').trim();
        if (sName && sec.slideRole !== 'opening' && sec.slideRole !== 'closing') {
          contentSectionNames.add(sName);
        }
      }
      const planSectionNames = new Set(planSections.map(ps => ps.name));
      const sectionsMatch = contentSectionNames.size === planSectionNames.size &&
        [...contentSectionNames].every(n => planSectionNames.has(n));

      if (!sectionsMatch) {
        // Content builder diverged from plan — rebuild from plan
        this._log(`Section grouping diverged: content has [${[...contentSectionNames].join(', ')}] but plan has [${planSections.map(ps => ps.name).join(', ')}] — using plan`);

        sectionMap.clear();
        sectionIdx = 0;

        // Build slide-number → section mapping from the plan
        const slideToSection = new Map();
        for (const ps of planSections) {
          for (const sn of (ps.slideNums || [])) {
            slideToSection.set(sn, ps.name);
          }
        }

        // Reassign each section entry to its plan section
        // Plan slideNums include cover (slideNum 1), but content builder output is body-only.
        // Offset by the first body slideNum so indices align correctly.
        const allPlanSlideNums = planSections.flatMap(ps => ps.slideNums || []);
        const firstBodySlideNum = allPlanSlideNums.length > 0 ? Math.min(...allPlanSlideNums) : 1;
        sections.forEach((sec, i) => {
          const slideNum = i + firstBodySlideNum;
          const planSection = slideToSection.get(slideNum);
          if (planSection) {
            sec.section = planSection;
            if (!sectionMap.has(planSection)) {
              sectionIdx++;
              sectionMap.set(planSection, `${sectionIdx}. ${planSection}`);
            }
          } else if (sec.slideRole !== 'opening' && sec.slideRole !== 'closing') {
            // Body slide not in any plan section — assign to nearest section
            // Find the plan section whose slideNums are closest
            let bestSection = planSections[0]?.name;
            for (const ps of planSections) {
              if ((ps.slideNums || []).some(sn => Math.abs(sn - slideNum) <= 1)) {
                bestSection = ps.name;
                break;
              }
            }
            if (bestSection) {
              sec.section = bestSection;
              if (!sectionMap.has(bestSection)) {
                sectionIdx++;
                sectionMap.set(bestSection, `${sectionIdx}. ${bestSection}`);
              }
            }
          }
        });

        this._log(`Rebuilt sections from plan: ${sectionMap.size} → ${[...sectionMap.values()].join(', ')}`);
      } else {
        this._log(`Section structure matches plan: ${sectionMap.size} sections`);
      }
      // Safety: remove any exec summary / overview slides — the router handles the exec summary
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        const titleLow = (sec.sectionTitle || '').toLowerCase();
        const isExec = sec.contentType === 'summary'
          || sec.contentType === 'executive-summary'
          || (sec.slideRole === 'opening' && sec.contentType === 'synthesis')
          || titleLow.includes('executive summary')
          || titleLow.includes('exec summary')
          || titleLow.includes('executive overview')
          || titleLow.includes('executive takeaway')
          || titleLow.includes('deck overview')
          || titleLow.includes('deck section')
          || titleLow.includes('section preview')
          || titleLow.includes('deck preview')
          || titleLow.includes('deck at a glance')
          || titleLow.includes('at a glance')
          || titleLow.includes('ceo summary')
          || titleLow.includes('key themes')
          || (titleLow.includes('overview') && i === 0);
        if (isExec) {
          sections.splice(i, 1);
          this._log(`Removed overview slide "${sec.sectionTitle}" — router creates exec summary from trackers`);
        }
      }
    } else if (sectionMap.size > 0) {
      // Plan has no sections but content builder created some — strip them for small decks
      if (bodySlideCount <= 6) {
        this._log(`Small deck (${bodySlideCount} body slides) but content builder created ${sectionMap.size} sections — stripping`);
        sectionMap.clear();
        sections.forEach(sec => { sec.section = null; });
      } else {
        this._log(`No plan sections but content builder created ${sectionMap.size} — keeping (large deck)`);
      }
    }

    const sectionContent = sections.map((section, i) => {
      let content = `\n--- SLIDE ${i + 1}: ${section.sectionTitle || 'Content'} ---`;
      if (section.contentType) content += ` [TYPE: ${section.contentType}]`;
      // Inject tracker tag so the router can set sectionTracker on this slide
      const sName = (section.section || '').trim();
      const trackerLabel = sName ? sectionMap.get(sName) : null;
      if (trackerLabel) content += `\n[TRACKER: ${trackerLabel}]`;
      if (section.keyMessage) content += `\nKey Message: ${section.keyMessage}`;
      if (section.instruction) content += `\nInstruction: ${section.instruction}`;
      if (section.dataPoints?.length > 0) content += `\nData Points: ${section.dataPoints.join(' | ')}`;
      return content;
    }).join('\n');

    // Build tracker summary for router context
    let trackerSummary = '';
    if (sectionMap.size > 0) {
      const trackerLines = [...sectionMap.entries()].map(([name, label]) => {
        const slidesInSection = sections.filter(s => (s.section || '').trim() === name);
        const keyMsg = slidesInSection[0]?.keyMessage || '';
        return `  ${label}: ${keyMsg}`;
      });
      trackerSummary = `\nSECTION TRACKERS (${sectionMap.size} sections — copy these VERBATIM as sectionTracker on each slide):\n${trackerLines.join('\n')}\n`;
    }

    let closingContent = '';
    if (closing.keyMessage || closing.points?.length > 0) {
      closingContent = `\n--- CLOSING ---`;
      if (closing.keyMessage) closingContent += `\nKey Message: ${closing.keyMessage}`;
      if (closing.points?.length > 0) {
        closingContent += `\nPoints:`;
        closing.points.forEach(p => { closingContent += `\n  • ${p}`; });
      }
    }

    // Log what we're sending to the router for debugging
    console.log('[Agent→Router] Slide sections:', sections.map((s, i) => `${i + 1}. "${s.sectionTitle}" → section="${s.section}"`));

    const hasSearch = this.understanding?.needsSearch || false;
    const userInputsBlock = this._userInputsContext();

    // For large requests, pass a summary instead of the raw text to avoid flooding downstream prompts
    const requestText = this.originalRequest.length > 2000
      ? (this.understanding?.contextDigest || this.understanding?.fullClientAsk || this.originalRequest).slice(0, 3000)
      : this.originalRequest;

    return `========================================
ORIGINAL USER REQUEST
========================================
${requestText}
${userInputsBlock ? `\n${userInputsBlock}` : ''}
========================================
PRESENTATION CONTENT (from agent research)
========================================
Title: ${title}
Main Message: ${mainMessage}
${storylineType ? `Storyline: ${storylineType}` : ''}
${storylineFlow ? `Flow: ${storylineFlow}` : ''}
Audience: ${this.understanding?.audience || 'business professionals'}
Purpose: ${this.understanding?.purpose || 'inform'}
Tone: ${this.understanding?.toneGuidance || 'professional'}
Total slides: ${sections.length}
${sectionContent}
${closingContent}

========================================
INSTRUCTIONS FOR ROUTER
========================================
Data source: ${hasSearch ? 'WEB SEARCH was performed — sections contain researched data. Pass all figures through.' : 'NO web search — general knowledge only. Do NOT invent specific statistics.'}
${trackerSummary}
The detailed Instruction for each slide is stored separately and will be injected automatically after routing.
Your job is to choose the right template and set up the flow — you do NOT need to copy instructions.
- Choose the best template for each slide based on [TYPE], Key Message, and Data Points
- Create ONE slide per section — do not split or merge
- Copy Data Points VERBATIM into the step instruction (they supplement the stored instruction)
- NEVER use TBD or placeholder values
- Do NOT overcrowd slides: each slide should have ONE key message + 3-5 supporting points max
- The executive summary slide is already included in the slide list above — do NOT create an additional one. The router should NOT add any slides except the cover page.
- For each slide with a [TRACKER: ...] tag, set sectionTracker to that EXACT value. Only set subSectionTracker when a [SUB_TRACKER: ...] tag is present; never derive it from the slide title.
- TEMPLATE VARIETY: Slides in the same section MUST use DIFFERENT templates. Do NOT repeat the same template for consecutive slides. Pick the template that best matches each slide's content type and data shape.`;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PLAN → STORYLINE (for approval UI)
  // ═════════════════════════════════════════════════════════════════════════
  _planToStoryline(understanding, plan) {
    const slides = plan.slidesPlan || [];
    const planSections = plan.sections || [];
    const stripNum = (t) => (t || '').replace(/^\d+[\.\)\-]\s*/, '').trim();

    // ── If plan has grouped sections (3-5), produce hierarchical storyline ──
    // Each section groups multiple slides — this is the executive summary structure.
    if (planSections.length >= 2 && planSections.length <= 5) {
      const sections = planSections.map((ps, i) => {
        // Find the slides that belong to this section
        const sectionSlides = (ps.slideNums || [])
          .map(num => slides.find(s => s.slideNum === num))
          .filter(Boolean);

        return {
          sectionTitle: stripNum(ps.name) || `Section ${i + 1}`,
          keyMessage: ps.purpose || '',
          contentType: 'section-group',
          slideRole: 'body',
          // Hierarchical: include the child slides so the UI and downstream can see them
          slides: sectionSlides.map(s => ({
            title: stripNum(s.title),
            keyMessage: s.keyMessage || '',
            contentType: s.contentType || 'detail',
            slideRole: s.slideRole || 'body',
          })),
        };
      });

      return {
        presentationTitle: understanding.topic || this.originalRequest,
        mainMessage: plan.governingThought || '',
        storylineType: plan.narrativeArcName || 'Custom',
        storylineFlow: sections.map(s => s.sectionTitle).join(' → '),
        sections,
        // Preserve the raw plan sections for downstream sectionTracker assignment
        _planSections: planSections,
        closing: {
          keyMessage: plan.closingStrategy || '',
          points: [],
        },
      };
    }

    // ── Small deck / no sections: flat list (no exec summary needed) ──
    const sections = slides.map((s, i) => ({
      sectionTitle: stripNum(s.title) || `Slide ${i + 1}`,
      keyMessage: s.keyMessage || '',
      contentType: s.contentType || 'detail',
      slideRole: s.slideRole || (i === 0 ? 'opening' : i === slides.length - 1 ? 'closing' : 'body'),
    }));

    return {
      presentationTitle: understanding.topic || this.originalRequest,
      mainMessage: plan.governingThought || '',
      storylineType: plan.narrativeArcName || 'Custom',
      storylineFlow: sections.map(s => s.sectionTitle).join(' → '),
      sections,
      closing: {
        keyMessage: plan.closingStrategy || '',
        points: [],
      },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  KNOWLEDGE HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  // Concise summary for the think loop context
  _summarizeKnowledge() {
    if (this.knowledge.length === 0) return '';
    return this.knowledge.map((k, i) => {
      let text = `[${i + 1}] ${k.source}`;
      const summaryLimit = this.settings.limitKnowledgeSummaryChars || 800;
      if (k.summary) text += `: ${k.summary.substring(0, summaryLimit)}`;
      if (k.dataPoints?.length > 0) text += ` | Data: ${k.dataPoints.slice(0, 5).join('; ')}`;
      if (k.themes?.length > 0) text += ` | Themes: ${k.themes.join(', ')}`;
      return text;
    }).join('\n');
  }

  // Full knowledge for compile phase
  _summarizeKnowledgeFull() {
    if (this.knowledge.length === 0) return '(no research — use general knowledge)';
    return this.knowledge.map(k => {
      let text = `## ${k.source}\n${k.summary || ''}`;
      if (k.dataPoints?.length > 0) text += `\nData: ${k.dataPoints.join(' | ')}`;
      if (k.themes?.length > 0) text += `\nThemes: ${k.themes.join(', ')}`;
      return text;
    }).join('\n\n');
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  LLM CALL WRAPPER
  //  Retry with backoff, timeout, AI I/O logging, self-correction.
  // ═════════════════════════════════════════════════════════════════════════
  // Map (persona, purpose) → roleSettings key
  _resolveRoleKey(persona, purpose) {
    const p = purpose.toLowerCase();
    if (p.includes('understand') || p.includes('scop'))  return 'managerScope';
    if (p.includes('plan') || p.includes('revis'))       return 'managerPlanning';
    if (p.includes('compil') || p.includes('build'))     return 'managerCompiling';
    if (p.includes('review') || p.includes('quality'))   return 'managerReviewing';
    if (p.includes('synthe') || p.includes('analyz'))    return 'consultantAnalyzing';
    if (p.includes('decid') || p.includes('research') || p.includes('recover'))
      return 'consultantResearching';
    // Fallback by persona
    return persona === 'manager' ? 'managerScope' : 'consultantAnalyzing';
  }

  // Apply per-role overrides from settings.roleSettings
  _applyRoleOverrides(modelSettings, callOpts, roleKey) {
    const roleOverrides = this.settings?.roleSettings?.[roleKey];
    if (!roleOverrides) return;
    if (roleOverrides.model)            modelSettings.model = roleOverrides.model;
    if (roleOverrides.maxTokens) {
      const parsed = parseInt(roleOverrides.maxTokens, 10);
      if (!isNaN(parsed) && parsed > 0) callOpts.maxTokens = parsed;
    }
    if (roleOverrides.reasoningEffort)  callOpts.reasoningEffort = roleOverrides.reasoningEffort;
    if (roleOverrides.temperature !== '' && roleOverrides.temperature != null)
      callOpts.temperature = Number(roleOverrides.temperature);
    if (roleOverrides.searchEnabled !== '' && roleOverrides.searchEnabled != null)
      modelSettings.searchEnabled = roleOverrides.searchEnabled === true || roleOverrides.searchEnabled === 'true';
  }

  async _llm(persona, purpose, prompt, opts = {}) {
    if (this.isAborted) throw new Error('Aborted');
    if (this._budgetExhausted() && !opts.critical) {
      this._log('Budget exhausted — skipping');
      return null;
    }

    const cost = opts.useDeep ? CREDIT.DEEP : CREDIT.THINK;
    if (!opts.critical) this._spend(cost);

    const roleKey = this._resolveRoleKey(persona, purpose);

    const modelSettings = opts.useDeep
      ? (this.settings.deepAnalysisModel ? { ...this.settings, model: this.settings.deepAnalysisModel } : { ...this.settings })
      : (this.settings.fastModel ? { ...this.settings, model: this.settings.fastModel } : { ...this.settings });

    const callOpts = {
      systemPrompt: `TODAY: ${currentDateString()}\n\n${AGENT_SKILLS}\n\n${getWorkLevelInstructions(this.settings?.workLevelAgent, 'agent')}\n\nYou are a research consultant acting as: ${persona}.\nOutput ONLY research data — facts, numbers, analysis, comparisons. No formatting or presentation advice.\nReturn valid JSON only.`,
      returnJSON: opts.returnJSON !== false,
      temperature: opts.temperature ?? 0.4,
      maxTokens: opts.maxTokens || this.settings?.maxTokens || 4096,
    };

    // Apply per-role overrides
    this._applyRoleOverrides(modelSettings, callOpts, roleKey);

    const modelName = modelSettings.model || 'default';
    const auditRole = `${persona}:${roleKey}`;
    this._log(`${purpose} [model: ${modelName}, maxTokens: ${callOpts.maxTokens}]`);

    const callStartTime = Date.now();
    const inputLen = typeof prompt === 'string' ? prompt.length : JSON.stringify(prompt).length;

    // Retry with backoff: immediate → 1s → 3s
    const delays = [0, 1000, 3000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (attempt > 0) {
        this._log(`Retry ${attempt}/2...`);
        audit(auditRole, `retry #${attempt}`, { model: modelName, context: purpose, status: 'retry' });
        await new Promise(r => setTimeout(r, delays[attempt]));
        if (this.isAborted) throw new Error('Aborted');
      }

      try {
        // Heartbeat: emit thinking events every 6s
        let heartbeatCount = 0;

        const heartbeat = setInterval(() => {
          if (this.isAborted) { clearInterval(heartbeat); return; }
          heartbeatCount++;
          const msgs = [
            `${purpose}...`,
            `Still working on ${purpose.toLowerCase()}...`,
            `Generating content...`,
            `Finishing up...`,
          ];
          this._log(msgs[(heartbeatCount - 1) % msgs.length]);
        }, 6000);

        const timeoutMs = opts.timeout || 360000;
        let result;
        try {
          result = await Promise.race([
            agentChat(prompt, modelSettings, callOpts),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`LLM call timed out after ${timeoutMs / 1000}s`)), timeoutMs)
            ),
          ]);
        } finally {
          clearInterval(heartbeat);
        }

        if (this.isAborted) throw new Error('Aborted');

        // Record AI I/O
        const duration = Date.now() - callStartTime;
        const outputStr = result != null ? (typeof result === 'string' ? result : JSON.stringify(result)) : '(empty)';
        const ioEntry = {
          step: purpose,
          input: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
          output: outputStr,
          timestamp: new Date().toISOString(),
          duration,
          model: modelSettings.model || 'default',
          maxTokens: callOpts.maxTokens,
          attempt: attempt + 1,
        };
        this.aiIOLog.push(ioEntry);
        this.onAiIO?.(ioEntry);

        // Audit log — include actual API request params
        const actualParams = agentChat._lastRequestParams || {};
        audit(auditRole, `called ${describeModel(modelName)}`, {
          model: modelName,
          query: purpose,
          context: `consultingTeam._llm | ${persona} | ${purpose}`,
          maxTokens: callOpts.maxTokens,
          reasoningEffort: callOpts.reasoningEffort,
          searchEnabled: modelSettings.searchEnabled,
          temperature: callOpts.temperature,
          duration,
          inputLen,
          outputLen: outputStr.length,
          status: 'ok',
          apiRequest: actualParams,
        });

        if (result !== null && result !== undefined) return result;

        // Self-correction: empty response
        if (attempt < delays.length - 1) {
          const promptLen = typeof prompt === 'string' ? prompt.length : JSON.stringify(prompt).length;
          if (promptLen > 30000) {
            this._log(`Empty response — prompt is ${Math.round(promptLen / 1000)}K chars, trimming...`);
            prompt = this._trimPrompt(prompt);
          } else {
            this._log('Empty response — will retry');
          }
          continue;
        }
        this._log('Empty response after retries — proceeding without');
        return null;
      } catch (err) {
        if (this.isAborted) throw new Error('Aborted');

        // Record failed I/O
        const duration = Date.now() - callStartTime;
        const failEntry = {
          step: `[${persona}] ${purpose} (FAILED)`,
          input: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
          output: `ERROR: ${err.message}`,
          timestamp: new Date().toISOString(),
          duration,
          model: modelSettings.model || 'default',
          maxTokens: callOpts.maxTokens,
          attempt: attempt + 1,
          error: true,
        };
        this.aiIOLog.push(failEntry);
        this.onAiIO?.(failEntry);

        // Audit error
        audit(auditRole, `FAILED ${describeModel(modelName)}`, {
          model: modelName,
          query: purpose,
          context: `consultingTeam._llm | ${persona} | ${purpose}`,
          maxTokens: callOpts.maxTokens,
          duration,
          status: 'error',
          error: err.message,
        });

        // Self-correction: diagnose
        if (err.message?.includes('too large') || err.message?.includes('context length') || err.message?.includes('token')) {
          this._log(`Context too large — trimming and retrying`);
          prompt = this._trimPrompt(prompt);
          if (attempt < delays.length - 1) continue;
        }

        if (attempt < delays.length - 1) {
          this._log(`Error: ${err.message} — will retry`);
          continue;
        }

        this._log(`Failed after ${delays.length} attempts: ${err.message}`);
        throw err;
      }
    }
    return null;
  }

  // Trim prompt by reducing large sections
  _trimPrompt(prompt) {
    if (typeof prompt !== 'string') return prompt;
    return prompt
      .replace(/RESEARCH & KNOWLEDGE:\n[\s\S]{4000,}?(?=\n\nYOUR JOB|\n\n═══|\nBUILD RULES)/,
        'RESEARCH & KNOWLEDGE:\n(trimmed for brevity — key findings summarized above)\n')
      .replace(/WEB RESEARCH:\n[\s\S]{3000,}?(?=\nDELIVER:|Return JSON)/,
        'WEB RESEARCH:\n(trimmed — use available context)\n')
      .replace(/SEARCH RESULTS:\n[\s\S]{3000,}?(?=\nExtract:)/,
        'SEARCH RESULTS:\n(trimmed — extract key points from above)\n')
      .replace(/PRIOR KNOWLEDGE:\n[\s\S]{2000,}?(?=\nDELIVER:|Return JSON)/,
        'PRIOR KNOWLEDGE:\n(summarized — focus on the task)\n');
  }

  // ─── Web search wrapper ───────────────────────────────────────────────
  // Uses built-in model search: Gemini googleSearch grounding / GPT web_search_preview.
  // The search tool is added to the same API call — no separate endpoint needed.
  async _search(query) {
    if (this.isAborted) throw new Error('Aborted');
    if (this._budgetExhausted()) return null;
    this._log(`Searching: "${query.substring(0, 60)}"`);
    this._spend(CREDIT.SEARCH);

    try {
      const wantSources = this.settings.searchIncludeSources;
      const searchPrompt = `Search the web for current, factual information about: ${query}\n\nReturn comprehensive search findings — include specific data points, statistics, names, and dates. Be thorough and detailed.${wantSources ? '\nAt the END of your response, list all source URLs under a "Sources:" heading. Do not embed URLs inline in the text.' : '\nDo NOT include any URLs or links in your response.'}`;
      const searchTool = { type: 'web_search_preview', search_context_size: this.settings.searchContextSize || 'medium' };
      const result = await agentChat(searchPrompt, { ...this.settings, _extraTools: [searchTool], searchEnabled: false }, {
        returnJSON: false,
        temperature: 0.3,
        maxTokens: this.settings.searchMaxTokens || 16384,
        timeout: 120000,
      });
      if (result && typeof result === 'string' && result.trim().length > 50) {
        this._log(`Search complete: ${result.length} chars`);
        return result.trim();
      }
      this._log(`No results for: "${query.substring(0, 60)}"`);
      return null;
    } catch (e) {
      console.warn('[Agent] Search failed:', e.message);
      this._log(`Search failed: ${e.message}`);
      return null;
    }
  }

  // ─── Budget ───────────────────────────────────────────────────────────
  _budgetInfo() {
    return {
      total: this.budgetTotal,
      used: this.budgetUsed,
      remaining: this.budgetTotal - this.budgetUsed,
      pct: this.budgetTotal > 0 ? Math.round((this.budgetUsed / this.budgetTotal) * 100) : 0,
    };
  }

  _spend(units = 1) {
    this.budgetUsed += units;
    this.onProgress?.({ phase: this.phase, steps: this.steps, message: null, budget: this._budgetInfo() });
  }

  _budgetRemaining() { return this.budgetTotal - this.budgetUsed; }

  _budgetExhausted() {
    if (!this._budgetSet) return false;
    return this._budgetRemaining() <= 0;
  }

  // ─── Phase / Steps / Thinking ─────────────────────────────────────────
  _setPhase(phase, message) {
    this.phase = phase;
    this.onPhaseChange?.(phase);
    this.onProgress?.({ phase, message, steps: this.steps, budget: this._budgetInfo() });
  }

  _updateSteps(steps) {
    this.steps = steps;
    this.onProgress?.({ phase: this.phase, steps: this.steps, message: null, budget: this._budgetInfo() });
  }

  _log(message) {
    const entry = {
      role: 'manager',
      message,
      action: message,
      detail: '',
      timestamp: Date.now(),
      budget: this._budgetInfo(),
    };
    this.thinkingLog.push(entry);
    this.onThinking?.('manager', message, entry);
  }
}
