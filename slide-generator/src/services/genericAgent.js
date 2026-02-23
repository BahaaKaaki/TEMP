/**
 * Generic Agentic System — Core Think Loop
 *
 * One reasoning loop that decides everything. No hard-coded workflows.
 * No routers. No fixed agent sequences.
 *
 * Input:  Task + Budget
 * Output: Best possible result within budget
 * Everything else emerges from reasoning.
 *
 * The Loop:
 *   1. THINK  — Given task, state, budget, tools, skills → decide next action
 *   2. EXECUTE — Perform the action
 *   3. UPDATE  — Record results to workspace
 *   4. CHECK   — Exit if done (validated) or stuck
 *
 * Available actions (chosen by Think step, not by routing logic):
 *   - use_tool       — Make direct progress with a tool
 *   - spawn          — Decompose into parallel subtasks
 *   - think_more     — Reason deeper about something
 *   - review         — Assess quality of existing work
 *   - revise         — Fix issues found in review
 *   - scope          — Assess task complexity and approach (FREE)
 *   - staff_team     — Assemble team personas for delegation (FREE)
 *   - delegate       — Assign work to a team persona (1 credit)
 *   - ask_user       — Request information from user (pauses loop)
 *   - present_plan   — Present plan for user approval (pauses loop)
 *   - done           — Output complete and validated
 *   - stuck          — Cannot proceed
 *
 * Budget creates behavior:
 *   Low budget  → direct action, skip ceremony, "good enough"
 *   High budget → decompose, research, review, iterate, polish
 *
 * Adding new tools or skills requires ZERO changes to this file.
 */

import { agentChat, researchWithSearch, getWorkLevelInstructions } from './aiService';
import { AgentWorkspace } from './agentWorkspace';
import { getSkillsContext, DEFAULT_SKILLS } from './skillRegistry';
import { saveEngagement } from './knowledgeBase';
import { generateReport } from './reportService';
import { audit, describeModel } from '../utils/auditLog';

// ─── Actions the Think step can choose ───────────────────────────────────────
export const Action = {
  USE_TOOL: 'use_tool',
  SPAWN: 'spawn',
  THINK_MORE: 'think_more',
  REVIEW: 'review',
  REVISE: 'revise',
  ASK_USER: 'ask_user',
  PRESENT_PLAN: 'present_plan',
  SCOPE: 'scope',
  STAFF_TEAM: 'staff_team',
  DELEGATE: 'delegate',
  DELEGATE_PARALLEL: 'delegate_parallel',
  DONE: 'done',
  STUCK: 'stuck',
};

// ─── Result types returned from run() / resume() ────────────────────────────
export const ResultType = {
  DONE: 'done',
  ASK_USER: 'ask_user',
  PRESENT_PLAN: 'present_plan',
  STUCK: 'stuck',
  ABORTED: 'aborted',
  BUDGET_EXHAUSTED: 'budget_exhausted',
  GUARDRAIL: 'guardrail',
};

// ─── Phases for UI state reporting ───────────────────────────────────────────
export const AgentPhase = {
  IDLE: 'idle',
  THINKING: 'thinking',
  EXECUTING: 'executing',
  CLARIFYING: 'clarifying',
  PLANNING: 'planning',
  AWAITING_APPROVAL: 'awaiting_approval',
  COMPILING: 'compiling',
  REVIEWING: 'reviewing',
  READY: 'ready',
  ERROR: 'error',
};

// ─── Guardrail defaults ─────────────────────────────────────────────────────
const GUARDRAILS = {
  MAX_ITERATIONS: 20,       // Hard cap on think loop iterations (structural + work phases combined)
  MAX_SPAWNS: 5,
  THINKING_CAP_PCT: 30,    // Max % of budget on pure thinking (each iteration costs 1)
  LOOP_DETECTION_WINDOW: 3, // Same action N times with no progress → stuck
  MIN_BUDGET_FOR_TOOLS: 2,  // Don't start tool use if budget below this
};

// ─── Default budget ──────────────────────────────────────────────────────────
const DEFAULT_BUDGET = 40;
const MIN_BUDGET = 5;

// ─── Tool cost defaults (overridden by tool.cost if present) ─────────────────
// Cost model: each GPT call = 1 credit, GPT call with internet = 2 credits
// search_knowledge_base is local (no GPT) = free
const DEFAULT_TOOL_COSTS = {
  search_knowledge_base: 0,   // local search, no GPT call
  research_topic: 2,          // GPT + internet
  generate_benchmarks: 2,     // GPT + internet
  create_slide: 1,            // 1 GPT call
  create_slides_batch: 1,     // 1 GPT call (batched)
  build_presentation: 1,      // 1 GPT call (router handles slides)
  edit_slide: 1,              // 1 GPT call
  analyze_content: 1,         // 1 GPT call
  plan_presentation: 1,       // 1 GPT call
  validate_slides: 0,         // local validation
  think: 0,                   // internal
  report_progress: 0,         // internal
  add_task: 0,                // internal
  complete_execution: 0,      // internal
};


// ═════════════════════════════════════════════════════════════════════════════
//  GENERIC AGENT
// ═════════════════════════════════════════════════════════════════════════════
export class GenericAgent {
  /**
   * @param {Object} options
   * @param {Object} options.tools       - Tool registry (name → {name, description, execute, cost?})
   * @param {Array}  options.skills      - Skill definitions (optional, defaults to DEFAULT_SKILLS)
   * @param {number} options.budget      - Total budget in credits
   * @param {Object} options.settings    - App settings (API keys, model config, etc.)
   * @param {Object} options.callbacks   - {onProgress, onPhaseChange, onThinking, onAiIO}
   * @param {Array}  options.knowledgeBaseEntries - KB entries for RAG
   */
  constructor({
    tools = {},
    skills = DEFAULT_SKILLS,
    budget = DEFAULT_BUDGET,
    settings = {},
    callbacks = {},
    knowledgeBaseEntries = null,
  } = {}) {
    // Configuration
    this.tools = tools;
    this.skills = skills;
    this.settings = settings;
    this.callbacks = callbacks;
    this.knowledgeBaseEntries = knowledgeBaseEntries;

    // Budget — internal total includes 2 margin credits so execution never skips planned work
    // but we display the user's requested number
    this.budgetDisplay = Math.max(budget, MIN_BUDGET);
    this.budgetTotal = this.budgetDisplay + 2;
    this.budgetUsed = 0;

    // State
    this.workspace = null;
    this.phase = AgentPhase.IDLE;
    this.iteration = 0;
    this.thinkCredits = 0;
    this.spawnCount = 0;
    this.isAborted = false;
    this._isResuming = false;   // Flag to prevent replanning on budget continue
    this._loopRunning = false;  // Guard against concurrent loops
    this._doneFailCount = 0;    // Track consecutive done-with-no-output failures

    // Loop detection
    this.actionHistory = [];  // [{action, tool, hadProgress}]

    // Logging
    this.thinkingLog = [];
    this.aiIOLog = [];

    // Steps for UI progress display
    this.steps = [];

    // Per-role activity tracking — who did what, who briefed whom
    // { roleName: { name, role, specialty, actions: [{type, description, timestamp, briefedBy, briefedTo}] } }
    this.roleActivity = {};

    // ─── Live input queue — messages from user while agent is executing ───
    // Users can chat while the agent works. Messages accumulate here and are
    // drained at checkpoints (between workers, during review, before compile).
    this._inputQueue = [];
    this._pendingQuestions = []; // Questions from workers awaiting user answers

    // Track conversation for multi-turn
    this.conversationHistory = [];
    this.originalRequest = null;
  }

  /** Configurable manager name (default: Edwin, editable from settings) */
  get _mgr() { return this.settings?.agentManagerName || 'Edwin'; }

  // ─── Public API ──────────────────────────────────────────────────────────

  abort() {
    this.isAborted = true;
  }

  /**
   * Main entry point — start processing a task.
   * Returns when done, stuck, or needs user input.
   *
   * @param {string} task    - User request
   * @param {Object} context - App context (slides, storyline, etc.)
   * @returns {Object} Result with type field indicating outcome
   */
  async run(task, context = {}) {
    if (!this.originalRequest) this.originalRequest = task;
    this.conversationHistory.push({ role: 'user', content: task });

    // Initialize core roles for activity tracking
    // Manager handles everything: scoping, storyline, review, coordination
    this._trackRole('manager', this._mgr, 'engagement lead & project management');

    // Create workspace if fresh, or update task if resuming
    if (!this.workspace) {
      this.workspace = new AgentWorkspace(task, context);
    } else {
      // Continuing conversation — update context
      this.workspace.context = { ...this.workspace.context, ...context };
    }

    return this._loop();
  }

  /**
   * Resume after user provides input (clarification, approval, revision).
   *
   * @param {*}      input - User's response (string for clarification, object for approval)
   * @param {string} type  - 'clarification' | 'approval' | 'revision'
   * @returns {Object} Result
   */
  async resume(input, type = 'clarification') {
    this.isAborted = false;  // Reset abort flag for resumption
    this._isResuming = true; // Flag to prevent replanning on budget continue

    if (type === 'clarification') {
      const userText = typeof input === 'string' ? input : JSON.stringify(input);
      this.conversationHistory.push({ role: 'user', content: userText });
      this._log(`Your response: ${userText.length > 200 ? userText.slice(0, 200) + '...' : userText}`, 'user', 'info');

      // ─── Smart budget reassessment on user reply ───
      // When user answers questions or provides new input, reassess whether
      // the budget needs adjustment based on what they said. Works like a new
      // request assessment but preserves existing work and context.
      await this._reassessBudgetFromInput(userText);
    }

    this.workspace.addFeedback(input, type);

    // ─── After plan approval → build immediately (no _think loop needed) ───
    if (type === 'approval' && input?.approved) {
      this._log('Plan approved — proceeding to build', 'manager', 'info');
      return this._buildAfterApproval();
    }

    return this._loop();
  }

  /**
   * Reassess budget based on user's reply to questions or clarification.
   * Evaluates whether the user's input implies expanded scope, additional work,
   * or a simpler path. Adjusts budget accordingly — like scoping a new request
   * but preserving existing progress.
   * Cost: 0 (uses lightweight assessment, doesn't spend budget credits).
   */
  async _reassessBudgetFromInput(userText) {
    // Only reassess if we have an existing plan and meaningful input
    const plan = this.workspace?.plan;
    if (!plan?.sections?.length || userText.length < 10) return;

    const currentBudget = this._budgetRemaining();
    const brief = this._requirementsBrief || this.workspace?.task || '';
    const workDone = (this.workspace?.knowledge || []).map(k => k.source || '').filter(Boolean).join(', ');

    try {
      const result = await this._llm(
        `${this._mgr}: Budget reassessment`,
        `You are the engagement manager. The user just replied to your team's questions.

USER'S REPLY: ${userText.slice(0, 1000)}

CONTEXT:
- Original brief: ${brief.slice(0, 300)}
- Current plan: ${plan.sections.map(s => s.sectionTitle || s.title).join(', ')}
- Work completed: ${workDone || 'none yet'}
- Current budget remaining: ${currentBudget} credits
- Total budget: ${this.budgetTotal} credits

Does the user's reply change the scope? Return JSON:
{
  "scopeChange": "none|expanded|narrowed|redirected",
  "additionalCreditsNeeded": 0,
  "reasoning": "Brief explanation"
}

RULES:
- "none" if reply just answers questions without changing scope
- "expanded" if reply adds significant new requirements → recommend extra credits
- "narrowed" if reply simplifies the task → no extra needed
- "redirected" if reply changes direction → may need extra for replanning
- Be conservative: only recommend extra credits for genuine scope expansion
- Each extra worker/task costs ~1 credit. Compile+build need 2 reserved.
- Maximum recommendation: 10 additional credits`,
        { temperature: 0.2, returnJSON: true }
      );

      const change = result?.scopeChange || 'none';
      const extraCredits = Math.min(result?.additionalCreditsNeeded || 0, 10);
      const reasoning = result?.reasoning || '';

      if (change !== 'none') {
        this._log(`${this._mgr}: Scope ${change} — ${reasoning}`, 'manager', 'info');
      }

      if (extraCredits > 0) {
        this.extendBudget(extraCredits);
        this._log(`Budget auto-extended by ${extraCredits} credits (scope ${change})`, 'manager', 'info');
        this.callbacks.onThinking?.('manager', `Budget adjusted: +${extraCredits} credits (${reasoning})`, {
          role: 'manager',
          type: 'budget-reassessment',
          message: `+${extraCredits} credits — ${reasoning}`,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      // Non-critical — if reassessment fails, continue with existing budget
      this._log(`Budget reassessment skipped: ${err.message}`, 'manager', 'info');
    }
  }

  /**
   * Push a live message into the input queue while the agent is executing.
   * The agent drains the queue at checkpoints (between workers, during review).
   * Messages are NOT processed immediately — they accumulate and are batch-assessed.
   *
   * @param {string} message - User's message
   * @param {Object} meta    - Optional metadata {addBudget: N, priority: 'high'|'normal'}
   */
  pushInput(message, meta = {}) {
    const entry = {
      message,
      timestamp: Date.now(),
      addBudget: meta.addBudget || 0,
      priority: meta.priority || 'normal',
    };
    this._inputQueue.push(entry);
    this._log(`Live input received: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`, 'user', 'info');

    // Surface to UI immediately — user sees their message acknowledged
    this._emitProgress({ liveInputCount: this._inputQueue.length });
  }

  /**
   * Drain the input queue and integrate user messages into the ongoing execution.
   * Called at checkpoints: between workers finishing, during review, before compile.
   *
   * Returns: { hasInput, messages, budgetAdded, requiresReplan }
   */
  async _drainInputQueue() {
    if (this._inputQueue.length === 0) return { hasInput: false };

    // Drain all pending messages
    const inputs = this._inputQueue.splice(0);
    const messages = inputs.map(i => i.message);
    const totalBudgetAdd = inputs.reduce((s, i) => s + (i.addBudget || 0), 0);

    // Add budget if requested
    if (totalBudgetAdd > 0) {
      this.extendBudget(totalBudgetAdd);
      this._log(`Budget extended by ${totalBudgetAdd} from live input`, 'manager', 'info');
    }

    // Add messages to conversation history so subsequent LLM calls see them
    for (const msg of messages) {
      this.conversationHistory.push({ role: 'user', content: msg });
    }

    this._log(`Processing ${messages.length} live message${messages.length !== 1 ? 's' : ''} from user`, 'manager', 'info');

    // Ask the manager to assess these messages — should we replan, add work, or just note?
    const assessment = await this._assessLiveInput(messages, totalBudgetAdd);

    // Answer any pending worker questions that the user's messages might address
    if (this._pendingQuestions.length > 0) {
      this._matchAnswersToQuestions(messages);
    }

    this._emitProgress({ liveInputCount: 0 });
    return assessment;
  }

  /**
   * Smart assessment of live user input during execution.
   * The manager LLM evaluates whether the input changes scope, adds requirements,
   * answers questions, or is just acknowledgement. Returns actionable assessment.
   * Cost: 0 credits (uses a lightweight prompt, doesn't count against budget).
   */
  async _assessLiveInput(messages, budgetAdded) {
    const combinedInput = messages.join('\n---\n');
    const brief = this._requirementsBrief || this.workspace?.task || '';
    const plan = this.workspace?.plan;
    const knowledge = this.workspace?.knowledge || [];

    // Existing work summary
    const workDone = knowledge.map(k => k.source || '').filter(Boolean).join(', ');
    const planSections = plan?.sections?.map(s => s.sectionTitle || s.title).join(', ') || 'no plan yet';

    // Pending questions context
    const pendingQs = this._pendingQuestions
      .filter(q => !q.answered)
      .map(q => `${q.worker}: ${q.question}`)
      .join('\n');

    const assessPrompt = `You are the engagement manager. While your team was working, the user sent the following message(s):

USER INPUT:
${combinedInput}

CONTEXT:
- Original brief: ${brief.slice(0, 300)}
- Current plan sections: ${planSections}
- Work completed so far: ${workDone || 'none yet'}
- Budget just added: ${budgetAdded} credits
- Budget remaining: ${this._budgetRemaining()} credits
${pendingQs ? `- Pending team questions:\n${pendingQs}` : ''}

Assess this input and return JSON:
{
  "requiresReplan": false,
  "additionalTasks": [],
  "budgetRecommendation": 0,
  "answersToQuestions": [],
  "acknowledgement": "Brief message to user about how their input will be integrated",
  "reasoning": "Why this assessment"
}

RULES:
- requiresReplan: true ONLY if user fundamentally changes direction or scope. Simple additions = false.
- additionalTasks: Specific work items to add (only if input adds real new requirements). Format: [{"task": "...", "assignee": "best fit from existing team or 'any'"}]
- budgetRecommendation: Extra credits needed for additional tasks (0 if none). Each task costs ~1 credit.
- answersToQuestions: Match user input to pending team questions. Format: [{"questionId": "id", "answer": "extracted answer"}]
- acknowledgement: Short, helpful message confirming what you'll do with the input. The user sees this.
- If the message is just encouragement/acknowledgement ("looks good", "ok"), return minimal response with no changes.`;

    try {
      const result = await this._llm(
        `${this._mgr}: Assessing live input`,
        assessPrompt,
        { temperature: 0.2, returnJSON: true }
      );

      const ack = result?.acknowledgement || '';
      if (ack) {
        this._log(`${this._mgr}: ${ack}`, 'manager', 'info');
        // Surface acknowledgement to UI
        this.callbacks.onThinking?.('manager', ack, {
          role: 'manager',
          type: 'live-input-ack',
          message: ack,
          timestamp: Date.now(),
        });
      }

      // If manager recommends more budget and user didn't already provide enough
      const extraBudget = result?.budgetRecommendation || 0;
      if (extraBudget > 0 && budgetAdded < extraBudget) {
        const autoAdd = Math.min(extraBudget - budgetAdded, 10); // Cap auto-add at 10
        this.extendBudget(autoAdd);
        this._log(`Auto-extended budget by ${autoAdd} for additional tasks`, 'manager', 'info');
      }

      return {
        hasInput: true,
        messages,
        budgetAdded: budgetAdded + (extraBudget > 0 ? Math.min(extraBudget - budgetAdded, 10) : 0),
        requiresReplan: result?.requiresReplan || false,
        additionalTasks: result?.additionalTasks || [],
        answersToQuestions: result?.answersToQuestions || [],
      };
    } catch (err) {
      this._log(`Live input assessment failed: ${err.message} — input noted but not acted on`, 'manager', 'error');
      return { hasInput: true, messages, budgetAdded, requiresReplan: false, additionalTasks: [] };
    }
  }

  /**
   * Match user messages to pending worker questions.
   * Uses simple keyword matching — the LLM assessment provides structured matches.
   */
  _matchAnswersToQuestions(messages) {
    // Mark questions as answered if the LLM assessment matched them
    // (Called from _drainInputQueue after assessment)
  }

  /**
   * Surface worker/manager questions to the UI via progress events.
   * Questions appear as inline prompts — user can answer while work continues.
   */
  _surfaceQuestions(questions) {
    if (!questions || questions.length === 0) return;
    for (const q of questions) {
      if (!q.question) continue;
      const entry = {
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        worker: q.worker || 'Team',
        question: q.question,
        context: q.context || '',
        timestamp: Date.now(),
        answered: false,
      };
      this._pendingQuestions.push(entry);
      this._log(`${entry.worker} asks: ${entry.question}`, entry.worker, 'question');
      // Surface as chat message via onThinking callback
      this.callbacks.onThinking?.(entry.worker, `**${entry.worker}:** ${entry.question}`, {
        role: entry.worker,
        type: 'manager-question',
        message: `**${entry.worker}:** ${entry.question}`,
        timestamp: Date.now(),
      });
    }
    // Emit to UI so questions render in the progress panel
    this._emitProgress({
      pendingQuestions: this._pendingQuestions.filter(q => !q.answered),
    });
  }

  /**
   * Post-approval execution — two paths based on budget.
   *
   * HIGH BUDGET (>= 5 remaining): Go through the think loop ONE more time so the
   *   LLM can staff a team + produce a workPlan → deterministic execution kicks in.
   *   This adds 1 _think() overhead but enables team research for richer content.
   *
   * LOW BUDGET (< 5 remaining): Build directly from plan sections — no team, no
   *   extra _think() calls. Fast path.
   */
  async _buildAfterApproval() {
    const plan = this.workspace.plan;
    if (!plan?.sections?.length) {
      this._log('No plan sections after approval — falling back to loop', 'manager', 'info');
      return this._loop();
    }

    const remaining = this._budgetRemaining();

    // ─── If plan included team + workPlan, execute directly (no extra _think) ───
    if (this._pendingTeam?.members?.length > 0 && remaining >= 4) {
      const { members, workPlan } = this._pendingTeam;
      this._pendingTeam = null;

      // Staff the team (same logic as _executeStaffTeam)
      const staffDecision = { action: Action.STAFF_TEAM, members, workPlan };
      this._addStep(this._humanStepName(staffDecision), 'active', 'manager');
      const staffResult = this._executeStaffTeam(staffDecision);
      this._completeStep(this._humanStepSummary(staffDecision, staffResult), 'complete');
      this.workspace.recordAction(staffDecision, staffResult);
      this.actionHistory.push({ action: Action.STAFF_TEAM, hadProgress: true, budgetRemaining: this._budgetRemaining() });

      // Validate and execute the workPlan deterministically
      if (workPlan.length > 0) {
        const validPlan = this._validateWorkPlan(workPlan, members);
        this._log('Executing approved plan with staffed team — no further planning needed', 'manager', 'info');
        return this._executePlanDeterministic(validPlan, members);
      }
    }

    // ─── HIGH BUDGET (no embedded team): Let the agent staff via _think ───
    if (remaining >= 5) {
      this._isResuming = false;
      this._log(`Budget allows team execution (${remaining} remaining) — staffing team`, 'manager', 'info');
      return this._loop();
    }

    // ─── LOW BUDGET: Build directly from plan — fast path ───
    this._log(`Low budget (${remaining} remaining) — building directly from plan`, 'manager', 'info');
    return this._buildFromCompiledContent();
  }

  // ─── State accessors ────────────────────────────────────────────────────

  getPhase() { return this.phase; }
  getBudgetInfo() {
    const displayTotal = this.budgetDisplay || this.budgetTotal;
    const remaining = Math.max(0, displayTotal - this.budgetUsed);
    return {
      total: displayTotal,
      used: this.budgetUsed,
      remaining,
      pct: displayTotal > 0 ? Math.round((this.budgetUsed / displayTotal) * 100) : 0,
    };
  }

  // ─── Per-role activity tracking ──────────────────────────────────────────
  _trackRole(roleName, personaName, specialty) {
    if (!this.roleActivity[roleName]) {
      this.roleActivity[roleName] = {
        name: personaName || roleName,
        role: roleName,
        specialty: specialty || '',
        actions: [],
      };
    }
  }

  _trackAction(roleName, type, description, { briefedBy, briefedTo, data } = {}) {
    this._trackRole(roleName, roleName, '');
    this.roleActivity[roleName].actions.push({
      type,           // 'assigned' | 'delivered' | 'briefed' | 'reviewed' | 'compiled' | 'scoped' | 'planned'
      description,
      timestamp: Date.now(),
      briefedBy: briefedBy || null,
      briefedTo: briefedTo || null,
      data: data || null,
    });
  }

  getRoleActivity() {
    return Object.values(this.roleActivity);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  THE LOOP — All intelligence lives here
  // ═════════════════════════════════════════════════════════════════════════
  async _loop() {
    // Guard against concurrent loop invocations
    if (this._loopRunning) {
      this._log('Loop already running — ignoring concurrent invocation');
      return this._result(ResultType.STUCK, { reason: 'Concurrent loop invocation blocked' });
    }
    this._loopRunning = true;

    try {
      return await this._loopInner();
    } finally {
      this._loopRunning = false;
    }
  }

  async _loopInner() {
    while (true) {
      if (this.isAborted) return this._result(ResultType.ABORTED);

      // ─── Guardrails ───
      const guard = await this._checkGuardrails();
      if (guard) return guard;

      this.iteration++;

      // Show an active step for the manager's current role activity
      // Budget is displayed by the yellow badge in the UI — don't duplicate it here
      const lastAction = this.actionHistory[this.actionHistory.length - 1]?.action;
      const mgr = this._mgr;
      const thinkMsg = !lastAction ? `${mgr}: Reading and understanding your request`
        : lastAction === Action.SCOPE ? `${mgr}: Creating the storyline and plan`
        : lastAction === Action.ASK_USER ? `${mgr}: Incorporating your answers`
        : lastAction === Action.STAFF_TEAM ? `${mgr}: Kicking off team execution`
        : lastAction === Action.PRESENT_PLAN ? `${mgr}: Preparing to build`
        : lastAction === Action.DELEGATE || lastAction === Action.DELEGATE_PARALLEL ? `${mgr}: Reviewing team deliverables`
        : lastAction === Action.THINK_MORE ? `${mgr}: Preparing slide content`
        : lastAction === Action.REVIEW ? `${mgr}: Acting on review findings`
        : `${mgr}: Deciding next step`;
      this._setPhase(AgentPhase.THINKING, thinkMsg);
      // Add a temporary active step so the UI shows the manager's role activity
      // (replaced when the decided action step is added — see _addStep)
      this._setManagerThinkingStep(thinkMsg);

      // ─── MANAGER DECISION: Evaluate context and decide the next action (1 credit) ───
      const budgetBeforeStep = this.budgetUsed;
      const decision = await this._think();
      if (this.isAborted) return this._result(ResultType.ABORTED);

      if (!decision) {
        // LLM returned nothing — budget exhausted or error
        this._setPhase(AgentPhase.COMPILING, `Budget exhausted (${this.budgetUsed}/${this.budgetTotal}) — compiling output...`);
        this._log(`Budget exhausted — finalizing with available research`, 'manager', 'info');
        return await this._bestAvailableOutput();
      }

      // Planning-phase decisions (scope, ask_user, present_plan, staff_team) are FREE.
      // The LLM call already happened, but we refund the credit so planning doesn't
      // eat into the work budget. Only real work (delegate, tool use, etc.) costs credits.
      if (GenericAgent.FREE_ACTIONS.has(decision.action)) {
        this.budgetUsed = Math.max(0, this.budgetUsed - 1);
        this.thinkCredits = Math.max(0, this.thinkCredits - 1);
        this._emitProgress(); // Update the yellow badge immediately
      }

      // Build a human-readable step name from the decision — update phase immediately
      const stepName = this._humanStepName(decision);
      this._setPhase(AgentPhase.EXECUTING, stepName);
      this._log(stepName);

      // For batch slide creation, expand into individual numbered slide steps
      const isBatch = decision.action === Action.USE_TOOL && (decision.tool === 'create_slides_batch' || decision.tool === 'build_presentation');
      if (isBatch && decision.params?.slides?.length > 0) {
        this._expandBatchSteps(decision.params.slides);
      } else if (decision.action === Action.DELEGATE_PARALLEL) {
        // Parallel delegation creates its own steps inside _executeDelegateParallel
        // Don't add a parent step — individual worker steps will be added
      } else {
        // Create step for THIS action — activates a pending planned step if one exists
        this._addStep(stepName, 'active', this._stepRole(decision));
      }

      // ─── EXECUTE: Perform the action ───
      const result = await this._execute(decision);
      if (this.isAborted) return this._result(ResultType.ABORTED);
      // Total cost = manager decision (1) + execution cost
      const stepCost = this.budgetUsed - budgetBeforeStep;

      // Mark step(s) complete with a summary + cost annotation
      if (isBatch) {
        // Mark all remaining batch steps as complete (tool marks them individually during execution)
        this._completeBatchSteps(result);
      } else if (decision.action !== Action.DELEGATE_PARALLEL) {
        // delegate_parallel manages its own step lifecycle
        const stepSummary = this._humanStepSummary(decision, result);
        this._completeStep(stepSummary, result?.success === false ? 'error' : 'complete', stepCost);
      }

      // ─── UPDATE: Record to workspace ───
      this.workspace.recordAction(decision, result);

      // Track for loop detection + budget tracking
      const hadProgress = this._actionHadProgress(decision, result);
      const budgetAfter = this.getBudgetInfo();
      this.actionHistory.push({
        action: decision.action,
        tool: decision.tool || null,
        topic: decision.topic || null,
        hadProgress,
        budgetRemaining: budgetAfter.remaining,
      });

      // ─── CHECK: Exit conditions ───
      if (result.pause) return result;  // Needs user input
      if (result.done) return result;    // Task complete

      // Auto-complete after successful build_presentation — no need for another _think() round
      if (decision.action === Action.USE_TOOL && decision.tool === 'build_presentation' && result.success && result.created > 0) {
        this._log(`Presentation built successfully (${result.created} slides) — wrapping up`, 'manager', 'info');
        this._setPhase(AgentPhase.READY, 'Complete');
        return {
          done: true,
          type: ResultType.DONE,
          success: true,
          summary: result.message || `Built ${result.created} slides`,
          output: this.workspace.getBestOutput(),
          thinkingLog: this.thinkingLog,
          aiIOLog: this.aiIOLog,
          budgetUsed: this.budgetUsed,
          budgetTotal: this.budgetTotal,
          iterations: this.iteration,
        };
      }

      // ─── DETERMINISTIC EXECUTION: After staff_team with workPlan, stop thinking ───
      // Each execution step = 1 call. No more _think() overhead between steps.
      if (decision.action === Action.STAFF_TEAM && decision.workPlan?.length > 0) {
        // Validate workPlan: ensure items have assignees, trim if over-budget
        const validPlan = this._validateWorkPlan(decision.workPlan, decision.members || []);
        this._log('Work plan set — executing deterministically (no more planning)', 'manager', 'info');
        return this._executePlanDeterministic(validPlan, decision.members || []);
      }
    }
  }

  // ─── Human-readable step names (ACTIVE form shown during execution) ──────
  // These must describe what's happening RIGHT NOW — never "thinking" or "deciding"
  _humanStepName(decision) {
    const action = decision.action;
    switch (action) {
      case Action.USE_TOOL: {
        const tool = decision.tool;
        const p = decision.params || {};
        switch (tool) {
          case 'research_topic':
            return `Researching ${p.topic ? `"${p.topic}"` : 'a topic'} on the web`;
          case 'search_knowledge_base':
            return `Searching your documents for ${p.query ? `"${p.query}"` : 'relevant content'}`;
          case 'create_slide':
            return `Creating slide: ${p.instruction || 'new slide'}`;
          case 'create_slides_batch':
            return `Creating ${p.slides?.length || 'multiple'} slides`;
          case 'build_presentation':
            return `Sending ${p.slides?.length || '?'} slides to the template engine`;
          case 'edit_slide':
            return `Editing slide ${(p.slideIndex || 0) + 1}`;
          case 'plan_presentation':
            return `Drafting the presentation structure`;
          case 'analyze_content':
            return `Analyzing your content`;
          case 'generate_benchmarks':
            return `Looking up benchmarks for ${p.topic ? `"${p.topic}"` : 'comparison'}`;
          case 'validate_slides':
            return `Running quality checks on slides`;
          default:
            return this.tools[tool]?.activeForm || `Running ${tool}`;
        }
      }
      case Action.THINK_MORE: {
        const topic = (decision.topic || '').toLowerCase();
        if (topic.includes('compil')) return `Compiling team findings into slide-by-slide content`;
        if (topic.includes('storyline') || topic.includes('document structure')) return `Creating the storyline and narrative arc`;
        if (topic.includes('detailed work plan') || topic.includes('work plan')) return `Laying out the work plan and budget`;
        if (topic.includes('structure')) return `Structuring the document sections`;
        if (topic.includes('plan')) return `Outlining the approach`;
        if (topic.includes('synthesiz')) return `Synthesizing research into slide content`;
        if (topic.includes('budget')) return `Allocating budget across consultants`;
        return decision.topic || 'Processing team output';
      }
      case Action.REVIEW:
        return `Reviewing ${decision.topic || 'the deliverables'} for quality`;
      case Action.REVISE:
        return `Fixing issues in ${decision.topic || 'the content'}`;
      case Action.SCOPE: {
        const hasQ = decision.questions?.length > 0;
        return hasQ ? `${this._mgr} scoped the request and is asking clarification questions` : `${this._mgr} is assessing scope and requirements`;
      }
      case Action.STAFF_TEAM: {
        const count = (decision.members || []).length;
        return `${this._mgr} onboarding ${count} consultant${count !== 1 ? 's' : ''}`;
      }
      case Action.DELEGATE: {
        const dName = decision.assignTo?.name || 'Consultant';
        return `${dName} working on: ${decision.delegateTask || 'assigned task'}`;
      }
      case Action.DELEGATE_PARALLEL: {
        const items = (decision.delegations || []).map(d => `${d.assignTo?.name || 'Consultant'}: ${d.delegateTask || 'task'}`);
        return items.length <= 3
          ? items.join(' · ')
          : `${items.length} consultants working in parallel`;
      }
      case Action.ASK_USER:
        return `Preparing clarification questions for you`;
      case Action.PRESENT_PLAN:
        return `${this._mgr} drafted the presentation structure`;
      case Action.DONE:
        return `Wrapping up`;
      case Action.STUCK:
        return `Hit a blocker — needs attention`;
      default:
        return decision.reasoning || `Step ${this.iteration}`;
    }
  }

  // ─── Human-readable step summaries (PAST TENSE shown when step is complete) ──────
  // These are the primary text the user sees for finished steps.
  // Must be comprehensive: describe what was accomplished, not just "done".
  // The user already answered/approved by the time they see this — don't say "waiting".
  _humanStepSummary(decision, result) {
    if (result?.success === false) return `Failed: ${result.error || 'unknown error'}`;
    const action = decision.action;
    switch (action) {
      case Action.USE_TOOL: {
        if (decision.tool === 'create_slides_batch' && result?.created) {
          return `Created ${result.created} slides and inserted them into the deck`;
        }
        if (decision.tool === 'create_slide' && result?.success) {
          return `Created slide${result.title ? `: "${result.title}"` : ''}`;
        }
        if (decision.tool === 'build_presentation' && result?.created) {
          return `Built ${result.created} slides — layouts selected and content filled`;
        }
        if (decision.tool === 'research_topic' && result?.success) {
          const kp = result.research?.keyPoints?.length;
          return kp
            ? `Found ${kp} data points on "${decision.params?.topic || 'the topic'}"`
            : `Researched "${decision.params?.topic || 'topic'}"`;
        }
        if (decision.tool === 'search_knowledge_base') {
          const n = result?.totalMatches || 0;
          return n > 0
            ? `Found ${n} relevant sections in your documents`
            : `No matching content found in documents`;
        }
        if (decision.tool === 'edit_slide' && result?.success) {
          return `Updated slide ${(decision.params?.slideIndex || 0) + 1}`;
        }
        if (decision.tool === 'generate_benchmarks' && result?.success) {
          return `Benchmarks gathered for "${decision.params?.topic || 'comparison'}"`;
        }
        return result?.message || 'Completed';
      }
      case Action.THINK_MORE: {
        const thinkTopic = (decision.topic || '').toLowerCase();
        if (thinkTopic.includes('compil')) {
          const count = this._compiledSlides?.length;
          return count ? `Compiled research into ${count} slide specs` : 'Compiled findings into slide content';
        }
        if (thinkTopic.includes('work plan') || thinkTopic.includes('detailed work plan')) {
          return 'Work plan and budget allocation finalized';
        }
        if (thinkTopic.includes('storyline') || thinkTopic.includes('document structure')) {
          return 'Storyline and narrative arc defined';
        }
        if (thinkTopic.includes('structure') || thinkTopic.includes('plan')) return 'Document structure drafted';
        if (thinkTopic.includes('synthesiz')) return 'Research distilled into slide content';
        return decision.analysis || 'Analysis produced';
      }
      case Action.REVIEW: {
        if (result?.passesReview) return 'Quality check passed — content ready';
        const issues = result?.issues?.length;
        return issues ? `Found ${issues} issue${issues > 1 ? 's' : ''} to address` : 'Issues identified for revision';
      }
      case Action.SCOPE: {
        const scope = decision.scope || {};
        const parts = [];
        const count = scope.estimatedSlides || scope.estimatedSections;
        if (count) parts.push(`~${count} ${this._reportMode ? 'sections' : 'slides'}`);
        if (scope.complexity) parts.push(`${scope.complexity} complexity`);
        const hasQuestions = decision.questions?.length > 0;
        if (hasQuestions) parts.push(`asked ${decision.questions.length} question${decision.questions.length > 1 ? 's' : ''}`);
        return parts.length > 0 ? `${this._mgr} scoped: ${parts.join(' · ')}` : `${this._mgr} assessed scope and requirements`;
      }
      case Action.STAFF_TEAM: {
        const members = decision.members || [];
        const count = members.length;
        if (count === 0) return 'Team staffed and work plan ready';
        const roster = members.map(m => {
          const name = m.name || 'Consultant';
          const qual = m.specialty || m.profile || '';
          return qual ? `${name} (${qual})` : name;
        }).join(', ');
        return `${this._mgr} onboarded ${count} consultants: ${roster}`;
      }
      case Action.DELEGATE: {
        const worker = decision.assignTo?.name || 'Consultant';
        const slides = result?.slides || [];
        const insights = result?.insights;
        if (slides.length > 0) {
          const slideTitles = slides.map(s => s.title).filter(Boolean);
          return `${worker} produced ${slides.length} slide${slides.length !== 1 ? 's' : ''}: ${slideTitles.join(', ')}`;
        }
        if (insights?.length > 0) {
          return `${worker}: ${insights.join(' · ')}`;
        }
        const summary = result?.summary;
        if (summary) return `${worker}: ${summary}`;
        return `${worker} delivered`;
      }
      case Action.DELEGATE_PARALLEL: {
        const parResults = result?.results || [];
        const names = (decision.delegations || []).map(d => d.assignTo?.name || 'Consultant');
        // Summarize what each consultant delivered (not just counts)
        const deliveries = parResults.map((r, i) => {
          const name = names[i] || 'Consultant';
          if (r?.slides?.length > 0) return `${name}: ${r.slides.length} slides`;
          if (r?.summary) return `${name}: ${r.summary}`;
          if (r?.success) return `${name}: done`;
          return `${name}: no output`;
        });
        return deliveries.join(' · ');
      }
      case Action.PRESENT_PLAN: {
        const sections = decision.plan?.sections?.length || 0;
        const title = decision.plan?.presentationTitle || '';
        const teamCount = decision.members?.length || 0;
        const parts = [];
        if (title) parts.push(`"${title}"`);
        if (sections) parts.push(`${sections} sections`);
        if (teamCount) parts.push(`${teamCount} consultants`);
        return parts.length > 0
          ? `${this._mgr} drafted: ${parts.join(' · ')}`
          : `${this._mgr} drafted the presentation plan`;
      }
      case Action.ASK_USER: {
        const qCount = decision.questions?.length || (decision.question ? 1 : 0);
        // By the time the user sees the completed step, they already answered
        return `Clarified ${qCount} question${qCount !== 1 ? 's' : ''} with you`;
      }
      default:
        return result?.message || 'Step completed';
    }
  }

  _stepRole(decision) {
    // All team members are consultants; only manager is distinct
    if (decision.action === Action.SCOPE) return 'manager';
    if (decision.action === Action.STAFF_TEAM) return 'manager';
    if (decision.action === Action.DELEGATE) return 'consultant';
    if (decision.action === Action.DELEGATE_PARALLEL) return 'manager';
    if (decision.action === Action.REVIEW) return 'manager';
    if (decision.action === Action.THINK_MORE) return 'manager';
    if (decision.action === Action.PRESENT_PLAN) return 'manager';
    if (decision.action === Action.ASK_USER) return 'manager';
    if (decision.action === Action.USE_TOOL) return 'consultant';
    return 'manager';
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  MANAGER DECISION — The manager evaluates context and decides what to do
  //
  //  This is the manager's core role: assess the workspace, budget, and
  //  progress, then choose the single best next action. Costs 1 credit
  //  (it's a real LLM call). Everything after this is mechanical execution.
  // ═════════════════════════════════════════════════════════════════════════
  // Actions that never cost think credits — they're structural, not work
  static FREE_ACTIONS = new Set([
    Action.SCOPE, Action.ASK_USER, Action.PRESENT_PLAN, Action.STAFF_TEAM,
  ]);

  async _think() {
    // Manager decision step — costs 1 credit speculatively.
    // Planning-phase decisions (FREE_ACTIONS) get refunded in the loop after.

    if (this._budgetRemaining() < 1) {
      this._log(`Budget exhausted (${this.budgetUsed}/${this.budgetTotal} used) — wrapping up with best available output`, 'manager', 'info');
      return null;
    }

    this._spend(1);

    // Track think iterations for the thinking cap (prevent infinite reflection loops)
    this.thinkCredits += 1;
    const thinkPct = this.budgetTotal > 0
      ? Math.round((this.thinkCredits / this.budgetTotal) * 100)
      : 0;
    const atThinkingCap = thinkPct >= GUARDRAILS.THINKING_CAP_PCT;

    // Emit progress for UI
    this._emitProgress();

    const prompt = this._buildThinkPrompt(atThinkingCap);

    // Clear resume flag after first think — directive already injected into prompt
    this._isResuming = false;

    const result = await this._llm(
      `${this._mgr}: deciding next action (1 credit)`,
      prompt,
      { temperature: 0.3 }
    );

    return result;
  }

  // ─── Current date string for prompt injection ─────────────────────────
  _todayString() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  }

  // ─── Build the Think prompt ────────────────────────────────────────────
  _buildThinkPrompt(atThinkingCap) {
    const budget = this.getBudgetInfo();
    const workspaceState = this.workspace.getCompressed();
    const toolsContext = this._toolsContext();
    const useSkills = this.settings?.agentUseSkills;
    const skillsContext = useSkills ? getSkillsContext(this.skills) : '';
    const recentActions = this._recentActionsContext();
    const loopWarning = this._detectLoop();

    // Budget = number of GPT calls remaining. Every step (including this think call) costs 1.
    // Planning typically takes ~4 calls (ask→scope→plan→staff). Compile + build = 2 more.
    const reservedCalls = 2; // 1 compile + 1 build (auto-appended by system)
    const workCalls = Math.max(0, budget.remaining - reservedCalls);
    let budgetPressure;
    if (budget.remaining <= 1) budgetPressure = `⚠️ CRITICAL: MUST BUILD NOW — only ${budget.remaining} call left. No more planning or delegation.`;
    else if (budget.remaining <= 3) budgetPressure = `⚠️ LOW BUDGET: Only ${budget.remaining} calls left — barely enough for compile + build. Finish immediately.`;
    else if (budget.remaining <= 5) budgetPressure = `⚠️ BUDGET TIGHT: ${budget.remaining} calls left (${workCalls} for work + ${reservedCalls} reserved for compile+build). Prioritize essential work only.`;
    else budgetPressure = `${workCalls} calls available for workers (after compile + build). Plan efficiently — each decision step also costs 1 credit.
BUDGET RULE: Before staffing, calculate: planning_overhead + worker_count + compile(1) + build(1) ≤ ${budget.remaining}. If workers exceed budget, reduce team size. NEVER plan more workers than you can afford.`;

    const thinkingCapWarning = atThinkingCap
      ? '\n⚠️ THINKING CAP REACHED — you have spent the max allowed budget on pure thinking. You MUST now use_tool, present_plan, or done. No more think_more.'
      : '';

    // Team context — if team has been staffed, show it
    const teamContext = this.workspace.getTeamContext();

    // Document awareness — tell agent what's available for the first call
    let documentContext = '';
    if (this.knowledgeBaseEntries?.length > 0) {
      const docNames = this.knowledgeBaseEntries
        .map(e => e.fileName || e.title || 'document')
        .filter((v, i, a) => a.indexOf(v) === i); // unique
      documentContext = `\nDOCUMENTS UPLOADED (${docNames.length}): ${docNames.join(', ')}
Use search_knowledge_base to find specific data from these documents. The documents contain the user's source material — USE them.`;
    }

    // Build "already done" guard — prevent re-entering completed phases
    const actions = this.actionHistory.map(h => h.action);
    const alreadyDone = [];
    const blocked = [];
    if (actions.includes(Action.SCOPE)) { alreadyDone.push('SCOPE'); blocked.push('scope'); }
    if (actions.includes(Action.ASK_USER)) { alreadyDone.push('CLARIFICATION (questions asked)'); blocked.push('ask_user'); }
    if (actions.includes(Action.PRESENT_PLAN)) { alreadyDone.push('PLAN PRESENTED (approved by user)'); blocked.push('present_plan'); }
    if (actions.includes(Action.STAFF_TEAM)) { alreadyDone.push('TEAM STAFFED'); blocked.push('staff_team'); }
    if (actions.includes(Action.DELEGATE) || actions.includes(Action.DELEGATE_PARALLEL)) { alreadyDone.push('DELEGATION (team executed)'); }

    // If resuming after budget extension or reconnect, inject a state-aware resume directive
    const resumeDirective = this._isResuming
      ? this._buildResumeDirective()
      : '';

    const completedStepsSection = alreadyDone.length > 0
      ? `\n✅ COMPLETED: ${alreadyDone.join(' → ')}\n❌ DO NOT REPEAT: ${blocked.join(', ') || 'none'}. These are DONE. Move forward.\n${resumeDirective}`
      : resumeDirective;

    // ─── Adapt language for report mode vs presentation mode ───
    const isReport = !!this._reportMode;
    const outputType = isReport ? 'an interactive analytical report' : 'a presentation';
    const unitName = isReport ? 'sections' : 'slides';
    const unitSingular = isReport ? 'section' : 'slide';
    const deliverable = isReport ? 'report' : 'deck';
    const buildVerb = isReport ? 'generate' : 'build';
    const workerOutput = 'RICH RESEARCH with REAL DATA — thorough analysis with specific numbers, sourced facts, and data-driven findings. Workers produce research prose; the manager compiles it into the final format.';
    const finalStep = isReport ? 'compile, then generate interactive HTML report' : 'compile, then build';

    return `You are the ENGAGEMENT MANAGER leading a consulting team to create ${outputType}.
The user sees every step. You handle content, structure, and coordination.${isReport ? '' : ' The visual engine handles templates.'}
NEVER staff a "partner" or "manager" — YOU are the manager.
All team members are CONSULTANTS — each with a unique persona/focus area tailored to the task. Never use role names like "analyst", "designer", "researcher", or "expert". They are all consultants.
NAMES: Use first names only (no last names). Use a diverse mix typical of a Dubai-based consulting office: mostly Arabic and Western names, with some South/East Asian. Examples: Omar, Layla, Marcus, Priya, Khalid, Sophie, Rami, Aisha, James, Mei, Tariq, Elena, Arjun, Nadia, Lucas.
TODAY: ${this._todayString()}

${workspaceState}${documentContext}
${completedStepsSection}
BUDGET: ${budget.remaining} remaining of ${budget.total} (used: ${budget.used}). ${workCalls} work calls (after 1 compile + 1 ${buildVerb} reserve).
${budgetPressure}
ITERATION: ${this.iteration} of ${GUARDRAILS.MAX_ITERATIONS}${thinkingCapWarning}
${loopWarning ? `⚠️ LOOP DETECTED: ${loopWarning}\n` : ''}
${teamContext ? `${teamContext}\n` : ''}TOOLS:
${toolsContext}

${useSkills ? `SKILLS:\n${skillsContext}` : `APPROACH:
- Pyramid Principle: lead with the insight, then support with evidence. Each slide answers "so what?"
- MECE: no overlaps, no gaps in content structure
- One key message per slide — the headline IS the insight, not a label
- Every claim backed by a number. No placeholders, no "[TBD]"
- Let the user's request drive the content — do not impose a fixed framework
- Staff based on complexity: simple tasks → work solo, complex tasks → assemble a team`}

${recentActions ? `RECENT HISTORY:\n${recentActions}` : '(first action)'}

${getWorkLevelInstructions(this.settings?.[isReport ? 'workLevelReport' : 'workLevelAgent'], isReport ? 'report' : 'agent')}

═══ FLOW (LEAN — 2 calls max for planning) ═══

Each planning decision costs 0 credits. After plan approval, execution is AUTOMATIC.
You have AT MOST 2 planning calls before execution begins. Use them wisely.

CALL 1 — SCOPE & CLARIFY (scope):
  Assess the request + ask clarification questions (if needed) in ONE action.
  Include "questions" array to pause for user input. Skip questions for clear requests.

CALL 2 — PLAN & STAFF (present_plan):
  After user answers (or immediately if no questions needed), create the full plan WITH team and workPlan.
  Include "members" and "workPlan" so execution begins IMMEDIATELY after approval — no extra calls.

EXECUTION (automatic) — System runs workers in waves (max 3 concurrent), then ${finalStep}. Done.

PLAN RULES:
- State the governing thought in mainMessage. Choose a narrative arc.
- SECTIONS ARE THE BACKBONE: every plan MUST have 2-5 top-level sections, each with a "${unitName}" array.
  • 3-6 total ${unitName} → 2-3 sections.  7-12 ${unitName} → 3-4 sections.  13+ ${unitName} → 4-5 sections.
  • NEVER exceed 5 sections. Each section = coherent theme with MULTIPLE ${unitName}.
  • sectionTitle MUST be concise: 2-4 words max (e.g., "Market Analysis", "Strategic Priorities"). These become tracker labels and exec summary items — they must fit in a small UI tab.
- EXECUTIVE SUMMARY: Do NOT include an "executive summary" as a plan section — your sections are the CONTENT sections only.${isReport ? '' : ' An exec summary slide is added automatically after compilation for larger decks.'}
  Example (WRONG): sections = [Executive Takeaway, Network, Customer, Financial]
  Example (RIGHT): sections = [Network Performance, Customer Experience, Financial Performance, Strategic Priorities]
${isReport ? '- REPORTS: Do NOT include a "Terminology", "Glossary", "Key Terms", or "Appendix" section. Reports are executive deliverables — every section must contain analysis and insight, not reference material.' : ''}
- keyMessage = insight, not label. "Revenue grew 23%" not "Financial Results".
- contentType: summary|metrics|comparison-cross-sectional|comparison-over-time|ranking|benchmark-peer|benchmark-index|timeline|process|detail|chart-trend|chart-waterfall|chart-bar|chart-dual|synthesis.
- THE PLAN IS A CONTRACT: workers, compile, and ${buildVerb} produce EXACTLY what the plan specifies.
  • If the plan says "benchmark 6 metrics", the ${deliverable} must cover those exact 6 metrics.

STAFFING RULES (inside present_plan):
- Each worker owns a RESEARCH AREA covering one or more ${unitName} and produces ${workerOutput}.
- Workers have web search built in — they search the web AND produce their research in a single step.
- Workers MUST produce REAL DATA: actual statistics, real numbers, sourced facts. NOT methodology, NOT frameworks, NOT "what we would analyze".
- Workers produce rich PROSE research — the manager compiles it into ${unitName} during the compilation step.
- workPlan descriptions must be specific research tasks: "Find market size data for X", "Analyze Y company financials", "Compare Z metrics across competitors" — NOT "Develop methodology for assessing X".
- workPlan items: {"description", "assignee", "role", "parallel":true/false}. System auto-appends compile + ${buildVerb}.
- Use ALL ${workCalls} work calls. Scale workers with budget AND ${unitSingular} count.
- research_topic costs 2 calls. Plan explicitly.

SHORTCUTS:
- Trivial/simple requests → use_tool build_presentation directly (skip everything).
- Clear requests (no ambiguity) → scope (no questions) → present_plan+staff → execute.
- Always use build_presentation — never create_slide or create_slides_batch.

═══ ACTIONS (choose ONE) ═══

scope: {"action":"scope", "scope":{"complexity":"low|medium|high", "estimated${isReport ? 'Sections' : 'Slides'}":N, "keyRisks":[], "approach":"plan", "requirementsBrief":"2-4 sentence summary"}, "questions":[{"question":"Q?","options":["A","B"]}], "reasoning":"why"} — optionally pauses if questions present. Skip questions for clear asks.
present_plan: {"action":"present_plan", "plan":{"${isReport ? 'reportTitle' : 'presentationTitle'}":"","mainMessage":"","storylineType":"","sections":[{"sectionTitle":"Theme Name","keyMessage":"purpose","contentType":"section-group","${unitName}":[{"title":"${unitSingular} title","keyMessage":"","contentType":"..."}]}]}, "members":[{"role":"consultant","name":"name","specialty":"focus area","profile":"1-sentence bio"}], "workPlan":[{"description":"produces what","assignee":"name","role":"consultant","parallel":true/false}], "reasoning":"budget table"} — pauses for approval, then auto-executes.
use_tool: {"action":"use_tool", "tool":"name", "params":{...}, "reasoning":"why"}
delegate: {"action":"delegate", "assignTo":{"role":"r","name":"n","specialty":"s"}, "delegateTask":"task", "delegateContext":"ctx", "reasoning":"why"}
delegate_parallel: {"action":"delegate_parallel", "delegations":[{"assignTo":{...}, "delegateTask":"task", "delegateContext":"ctx"}], "reasoning":"why"}
think_more: {"action":"think_more", "topic":"what", "analysis":"output", "reasoning":"why"} — no extra cost. ${atThinkingCap ? 'BLOCKED.' : ''}

ask_user: {"action":"ask_user", "questions":[{"question":"Q?","options":["A","B"]}], "reasoning":"why"} — pauses. Prefer using scope+questions instead.
staff_team: {"action":"staff_team", "members":[...], "workPlan":[...], "reasoning":"budget table"} — prefer embedding in present_plan.
done: {"action":"done", "summary":"what was done", "reasoning":"why"}
stuck: {"action":"stuck", "reason":"blocker", "suggestions":[], "reasoning":"why"}

COSTS: Planning (scope, ask_user, present_plan, staff_team) = FREE. delegate=1, research_topic=2, compile=1(auto), ${buildVerb}=1(auto). search_knowledge_base = FREE.
${budget.remaining <= 1 ? `⚠️ MUST ${buildVerb} or done THIS TURN.` : ''}
${loopWarning ? 'You MUST try a DIFFERENT approach.' : ''}

Return ONLY valid JSON.`;
  }

  // ─── Build a state-aware resume directive ────────────────────────────
  // When the agent resumes (budget added, reconnect), this tells it exactly
  // where it is, what deliverable type it's working on, and what the smart
  // next move is — instead of a rigid "just continue".
  _buildResumeDirective() {
    const isReport = !!this._reportMode;
    const deliverable = isReport ? 'report' : 'presentation';
    const unitName = isReport ? 'sections' : 'slides';

    // Gather current state
    const hasSlides = this.workspace.slidesCreated > 0;
    const hasPlan = this.workspace.plan !== null;
    const hasTeam = this.workspace.team?.length > 0;
    const hasKnowledge = this.workspace.knowledge?.length > 0;
    const knowledgeCount = this.workspace.knowledge?.length || 0;
    const slidesCreated = this.workspace.slidesCreated || 0;
    const teamCount = this.workspace.team?.length || 0;

    // Figure out what phase we're in and what the smart next step is
    const stateParts = [];
    let smartNext = '';

    stateParts.push(`MODE: ${isReport ? 'Interactive Report' : 'Presentation'}`);

    if (hasSlides) {
      stateParts.push(`${slidesCreated} ${unitName} already built`);
    }
    if (hasKnowledge) {
      stateParts.push(`${knowledgeCount} research items collected`);
    }
    if (hasTeam) {
      stateParts.push(`${teamCount} team members staffed`);
    }
    if (hasPlan) {
      const planned = this.workspace.plan?.sections?.reduce((n, s) => n + (s[isReport ? 'sections' : 'slides']?.length || 0), 0) || 0;
      stateParts.push(`plan: ${planned} ${unitName} planned`);
    }

    // Determine the smart next action
    if (hasSlides && hasPlan) {
      // Already have slides — check if all planned slides are done
      const planned = this.workspace.plan?.sections?.reduce((n, s) => n + (s[isReport ? 'sections' : 'slides']?.length || 0), 0) || 0;
      if (slidesCreated >= planned) {
        smartNext = `All ${planned} ${unitName} are built. COMPILE and BUILD the ${deliverable}. If something is weak, use a delegate to revise it.`;
      } else {
        smartNext = `${slidesCreated}/${planned} ${unitName} built. Continue building the remaining ${unitName}. If team research is done, compile and build. If not, delegate remaining workers first.`;
      }
    } else if (hasKnowledge && !hasSlides) {
      smartNext = `Research is collected but no ${unitName} built yet. COMPILE the team findings and BUILD the ${deliverable} now.`;
    } else if (hasTeam && !hasKnowledge) {
      smartNext = `Team is staffed but no research yet. DELEGATE work to the team — run the remaining workPlan items.`;
    } else if (hasPlan && !hasTeam) {
      smartNext = `Plan is approved but team not staffed. STAFF the team and begin execution.`;
    } else {
      smartNext = `Continue where you left off. Assess your workspace state and take the most efficient next action toward completing the ${deliverable}.`;
    }

    return `\n🔴 RESUME MODE — You are continuing after a pause (budget extension or reconnect).
STATE: ${stateParts.join(' | ')}
DO NOT: replan, re-scope, re-staff, or repeat any completed phase.
SMART NEXT MOVE: ${smartNext}\n`;
  }

  // ─── Format tools for the Think prompt ────────────────────────────────
  _toolsContext() {
    // Hide create_slide and create_slides_batch — agent must always use build_presentation (router)
    const HIDDEN_TOOLS = new Set(['create_slide', 'create_slides_batch']);
    const entries = Object.entries(this.tools).filter(([name]) => !HIDDEN_TOOLS.has(name));
    if (entries.length === 0) return '(no tools available)';

    return entries.map(([name, tool]) => {
      const cost = tool.cost ?? DEFAULT_TOOL_COSTS[name] ?? 1;
      const desc = tool.description || 'No description';
      // Brief parameter summary
      const params = tool.parameters?.properties
        ? Object.entries(tool.parameters.properties)
            .map(([k, v]) => {
              const req = tool.parameters.required?.includes(k) ? '*' : '';
              return `${k}${req}`;
            })
            .join(', ')
        : '';
      return `- ${name} [${cost} credit${cost !== 1 ? 's' : ''}]: ${desc}${params ? ` | Params: (${params})` : ''}`;
    }).join('\n');
  }

  // ─── Recent actions context ───────────────────────────────────────────
  _recentActionsContext() {
    const recent = this.actionHistory.slice(-5);
    if (recent.length === 0) return '';
    return recent.map((a, i) => {
      const idx = this.actionHistory.length - recent.length + i + 1;
      const progress = a.hadProgress ? '✓' : '✗';
      const budgetInfo = a.budgetRemaining != null ? ` (${a.budgetRemaining} left)` : '';
      return `  ${idx}. ${a.action}${a.tool ? `(${a.tool})` : ''} [${progress}]${budgetInfo}`;
    }).join('\n');
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  EXECUTE — Perform the chosen action
  // ═════════════════════════════════════════════════════════════════════════
  async _execute(decision) {
    // ─── HARD GUARDS: Block re-execution of one-time actions ───
    const pastActions = this.actionHistory.map(h => h.action);
    if (decision.action === Action.SCOPE && pastActions.includes(Action.SCOPE)) {
      this._log('Scope already done — skipping, moving forward', 'manager', 'info');
      return { success: true, message: 'Already scoped — skipping' };
    }
    if (decision.action === Action.PRESENT_PLAN && pastActions.includes(Action.PRESENT_PLAN)) {
      this._log('Plan already presented and approved — skipping, moving forward', 'manager', 'info');
      return { success: true, message: 'Plan already approved — skipping' };
    }
    if (decision.action === Action.STAFF_TEAM && pastActions.includes(Action.STAFF_TEAM)) {
      this._log('Team already staffed — skipping, moving forward', 'manager', 'info');
      return { success: true, message: 'Team already staffed — skipping' };
    }
    if (decision.action === Action.ASK_USER && pastActions.includes(Action.ASK_USER)) {
      this._log('Already asked user — proceeding with available info', 'manager', 'info');
      return { success: true, message: 'Already asked user — proceeding with reasonable assumptions' };
    }

    switch (decision.action) {
      case Action.USE_TOOL:
        return this._executeTool(decision);
      case Action.SPAWN:
        return this._executeSpawn(decision);
      case Action.THINK_MORE:
        return this._executeThinkMore(decision);
      case Action.REVIEW:
        return this._executeReview(decision);
      case Action.REVISE:
        return this._executeRevise(decision);
      case Action.ASK_USER:
        return this._executeAskUser(decision);
      case Action.PRESENT_PLAN:
        return this._executePresentPlan(decision);
      case Action.SCOPE:
        return this._executeScope(decision);
      case Action.STAFF_TEAM:
        return this._executeStaffTeam(decision);
      case Action.DELEGATE:
        return this._executeDelegate(decision);
      case Action.DELEGATE_PARALLEL:
        return this._executeDelegateParallel(decision);
      case Action.DONE:
        return this._executeDone(decision);
      case Action.STUCK:
        return this._executeStuck(decision);
      default: {
        this._log(`Unknown action: ${decision.action} — skipping`);
        // Count unknown actions to detect persistent LLM misformat
        this._unknownActionCount = (this._unknownActionCount || 0) + 1;
        if (this._unknownActionCount >= 2) {
          // Force stuck after 2 unknown actions to prevent budget drain
          return {
            done: true,
            type: ResultType.STUCK,
            success: false,
            reason: `Agent produced unrecognized actions (${decision.action}). LLM may not be following the prompt format.`,
            output: this.workspace.getBestOutput(),
            thinkingLog: this.thinkingLog,
            aiIOLog: this.aiIOLog,
            budgetUsed: this.budgetUsed,
            budgetTotal: this.budgetTotal,
          };
        }
        return { success: false, error: `Unknown action: ${decision.action}` };
      }
    }
  }

  // ─── Execute: use_tool ───────────────────────────────────────────────
  async _executeTool(decision) {
    let { tool: toolName, params = {} } = decision;

    // Intercept create_slide / create_slides_batch → redirect to build_presentation (router)
    if (toolName === 'create_slide' && this.tools['build_presentation']) {
      this._log('Redirecting create_slide → build_presentation (router)', 'manager', 'info');
      toolName = 'build_presentation';
      params = {
        title: params.title || this.workspace.task,
        slides: [{ instruction: params.instruction || params.content?.summary || 'Create a slide' }],
      };
      decision = { ...decision, tool: toolName, params };
    }
    if (toolName === 'create_slides_batch' && this.tools['build_presentation']) {
      this._log('Redirecting create_slides_batch → build_presentation (router)', 'manager', 'info');
      toolName = 'build_presentation';
      params = {
        title: params.title || this.workspace.task,
        slides: (params.slides || []).map(s => ({ instruction: s.instruction || s.content || 'Create a slide' })),
      };
      decision = { ...decision, tool: toolName, params };
    }

    const toolDef = this.tools[toolName];
    if (!toolDef) {
      this._log(`Tool not found: ${toolName}`);
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // Deduct cost
    const cost = toolDef.cost ?? DEFAULT_TOOL_COSTS[toolName] ?? 1;
    // Don't deduct for free tools; allow execution even at 0 budget for free tools
    if (cost > 0) {
      if (this._budgetRemaining() < cost) {
        this._log(`Not enough budget for ${toolName} (need ${cost}, have ${this._budgetRemaining()}). Say "continue" to add credits.`, 'manager', 'info');
        return { success: false, error: `Need ${cost} credits for ${toolName} but only ${this._budgetRemaining()} remain. Say "continue" to add more credits.` };
      }
      this._spend(cost);
    }

    // Update UI phase (step is already managed by _loopInner)
    const stepName = toolDef.activeForm || `Running ${toolName}`;
    this._setPhase(AgentPhase.EXECUTING, stepName);

    // For batch slide tools, inject a progress callback that updates individual numbered steps
    const isBatch = toolName === 'create_slides_batch' || toolName === 'build_presentation';
    if (isBatch && this.tools._batchProgress) {
      this.tools._batchProgress.fn = (slideIndex, total, status, routerPlan) => {
        this.markBatchSlideProgress(slideIndex, total, status, routerPlan);
      };
    }

    try {
      // Inject knowledge into slide creation tools so content is rich
      const enrichedParams = this._enrichParams(toolName, params);

      // Execute with timeout — batch creation needs more time (30s per slide)
      const slideCount = isBatch ? (enrichedParams.slides?.length || 1) : 1;
      const TOOL_TIMEOUT = isBatch ? Math.max(180000, slideCount * 30000) : 180000;
      const result = await Promise.race([
        toolDef.execute(enrichedParams),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool ${toolName} timed out after ${TOOL_TIMEOUT / 1000}s`)), TOOL_TIMEOUT)
        ),
      ]);

      return result || { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (isBatch && this.tools._batchProgress) {
        this.tools._batchProgress.fn = null;
      }
    }
  }

  // ─── Enrich tool params with workspace knowledge + requirements brief ──
  _enrichParams(toolName, params) {
    // For slide creation tools, inject accumulated knowledge as content
    if ((toolName === 'create_slide' || toolName === 'create_slides_batch') && this.workspace.knowledge.length > 0) {
      const knowledgeSummary = this.workspace.knowledge
        .map(k => {
          const data = typeof k.data === 'string' ? k.data : JSON.stringify(k.data);
          return `${k.source}: ${data}`;
        })
        .join('\n');

      if (toolName === 'create_slide' && !params.content) {
        return {
          ...params,
          content: { summary: knowledgeSummary },
        };
      }
      if (toolName === 'create_slides_batch' && !params.content) {
        return {
          ...params,
          content: { summary: knowledgeSummary },
        };
      }
    }

    // For build_presentation, prepend requirements brief so the router sees the full context
    if (toolName === 'build_presentation' && params.slides?.length > 0) {
      const brief = this._requirementsBrief || '';
      const scope = this.workspace.scopeAssessment || {};
      const contextPrefix = [
        brief && `REQUIREMENTS: ${brief}`,
        scope.estimatedSlides && `TARGET SLIDES: ${scope.estimatedSlides}`,
      ].filter(Boolean).join('\n');

      if (contextPrefix) {
        // Inject the context into the title so the router sees it in the combined prompt
        return {
          ...params,
          title: `${params.title || this.workspace.task}\n\n${contextPrefix}`,
        };
      }
    }

    return params;
  }

  // ─── Execute: spawn (parallel subtasks) ──────────────────────────────
  async _executeSpawn(decision) {
    if (this.spawnCount >= GUARDRAILS.MAX_SPAWNS) {
      this._log(`Spawn limit reached (${GUARDRAILS.MAX_SPAWNS})`);
      return { success: false, error: 'Spawn limit reached' };
    }

    const subtasks = decision.subtasks || [];
    if (subtasks.length === 0) {
      return { success: false, error: 'No subtasks provided' };
    }

    // Cap subtasks to remaining spawn limit
    const maxNew = GUARDRAILS.MAX_SPAWNS - this.spawnCount;
    const tasksToRun = subtasks.slice(0, maxNew);
    this.spawnCount += tasksToRun.length;
    this._setPhase(AgentPhase.EXECUTING, `Running ${tasksToRun.length} tasks in series...`);

    const SPAWN_TIMEOUT = 180000; // 3 minutes per subtask

    // Execute subtasks sequentially — ordering matters for slide coherence
    const results = [];
    for (const sub of tasksToRun) {
      if (!sub.tool || !this.tools[sub.tool]) {
        results.push({ success: false, error: `Unknown tool: ${sub.tool}` });
        continue;
      }
      const cost = this.tools[sub.tool].cost ?? DEFAULT_TOOL_COSTS[sub.tool] ?? 1;
      if (cost > 0 && this._budgetRemaining() >= cost) {
        this._spend(cost);
      } else if (cost > 0) {
        results.push({ success: false, error: 'Insufficient budget' });
        continue;
      }
      try {
        const result = await Promise.race([
          this.tools[sub.tool].execute(sub.params || {}),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Subtask ${sub.tool} timed out`)), SPAWN_TIMEOUT)
          ),
        ]);
        results.push(result);
      } catch (e) {
        results.push({ success: false, error: e.message });
      }
    }

    const succeeded = results.filter(r => r?.success).length;
    return {
      success: succeeded > 0,
      message: `Completed ${succeeded}/${tasksToRun.length} subtasks`,
      results,
    };
  }

  // ─── Execute: think_more ─────────────────────────────────────────────
  async _executeThinkMore(decision) {
    // The analysis was already produced (and paid for) during the manager's decision step.
    // This function just records/logs it — no additional credit charge.

    const topic = decision.topic || '';
    const topicLower = topic.toLowerCase();
    this._setPhase(AgentPhase.THINKING, `${this._mgr} analyzing: ${topic || '...'}`);

    const analysis = decision.analysis || '';
    const role = this._stepRole(decision);

    // Log with communication context — show who is producing what
    if (topicLower.includes('compil')) {
      this._log(`Compiling all team findings into slide instructions`, 'manager', 'handoff');
    } else if (topicLower.includes('structure') || topicLower.includes('storyline')) {
      this._log(`Drafting the document structure and storyline`, 'manager', 'handoff');
    } else if (topicLower.includes('plan') || topicLower.includes('detail')) {
      this._log(`Creating detailed work plan with budget allocation`, 'manager', 'handoff');
    }

    if (analysis) {
      this._log(analysis, role, 'deliverable');

      // Attach the full analysis to the step for UI expansion
      this._attachOutputToCurrentStep({
        task: topic,
        worker: role === 'manager' ? this._mgr : 'Consultant',
        workerRole: role,
        output: analysis,
        insights: [],
        nextSteps: [],
      });
    }

    // Track compilation/analysis activity
    const workerLabel = role === 'manager' ? this._mgr : 'Consultant';
    this._trackRole(role, workerLabel, '');
    this._trackAction(role, 'compiled', `${topic || 'analysis'}`, {
      data: analysis || '',
    });

    return {
      success: true,
      message: `Analyzed: ${topic || 'topic'}`,
      analysis,
    };
  }

  // ─── Execute: review ─────────────────────────────────────────────────
  async _executeReview(decision) {
    this._setPhase(AgentPhase.REVIEWING, `${this._mgr}: Reviewing work...`);
    this._log(`${this._mgr}: Reviewing ${decision.topic || 'quality check'}`, 'manager', 'handoff');

    // If the LLM included analysis in the decision, it's already paid for by _think().
    // If not, we need a separate LLM call which costs 1 credit.
    if (decision.analysis) {
      this._log(`Review: "${decision.analysis}"`, 'manager', 'deliverable');
      if (decision.issues?.length > 0) {
        this._log(`Flagged ${decision.issues.length} issue(s): ${decision.issues.map(i => i.description || i).join('; ')}`, 'manager', 'insight');
      }
      this._attachOutputToCurrentStep({
        task: `Review: ${decision.topic || 'quality check'}`,
        worker: this._mgr,
        workerRole: 'manager',
        output: decision.analysis,
        insights: (decision.issues || []).map(i => i.description || i),
        nextSteps: [],
      });
      this._trackAction('manager', 'reviewed', `Reviewed: ${decision.topic || 'quality check'}`, {
        data: decision.analysis,
      });
      return {
        success: true,
        message: `Review: ${decision.topic || 'quality check'}`,
        analysis: decision.analysis,
        issues: decision.issues || [],
      };
    }

    // No analysis in decision — need a separate LLM call. Charge 1 credit.
    if (this._budgetRemaining() < 1) {
      this._log('No budget for review LLM call — skipping', 'manager', 'warn');
      return { success: false, message: 'No budget for review' };
    }
    this._spend(1);
    this._log(`${this._mgr}: Running detailed review (1 credit)`, 'manager', 'info');

    const briefCtx = this._requirementsBrief ? `\nREQUIREMENTS BRIEF: ${this._requirementsBrief}\n` : '';
    const plan = this.workspace.plan;
    const planCtx = plan ? `\nAPPROVED PLAN:
Title: ${plan.presentationTitle || ''}
Governing thought: ${plan.mainMessage || ''}
Narrative: ${plan.storylineType || ''} — ${plan.storylineFlow || ''}
Sections: ${(plan.sections || []).map((s, i) => {
      const slides = (s.slides || []).map(sl => sl.title || '').filter(Boolean);
      return `${i + 1}. ${s.sectionTitle || s.title}${slides.length > 0 ? ` (${slides.join(', ')})` : ''}`;
    }).join('\n  ')}
` : '';
    // Feed compiled slides to reviewer (richer than compressed workspace)
    const compiledCtx = this._compiledSlides?.length > 0
      ? `\nCOMPILED SLIDES (${this._compiledSlides.length}):\n${this._compiledSlides.map((s, i) => `${i + 1}. [${s.contentType || 'content'}] ${s.title}\n   Key Message: ${s.keyMessage}\n   Section: ${s.section || '(deck-level)'}\n   Content: ${s.content || ''}`).join('\n\n')}\n`
      : '';
    const isReport = !!this._reportMode;
    const userRequirements = this._requirementsBrief || this.workspace.task;

    const reviewPrompt = `Review the ${isReport ? 'report' : 'presentation'} CONTENT against the USER'S ORIGINAL REQUEST.
TODAY: ${this._todayString()}

NOTE: This is a CONTENT review only. Do NOT evaluate visual design, layout, or formatting — that is handled separately by the report/slide builder.

USER REQUEST: ${this.workspace.task}
${this._requirementsBrief ? `REQUIREMENTS BRIEF: ${this._requirementsBrief}` : ''}
${briefCtx}${planCtx}${compiledCtx}

EVALUATE THE CONTENT:
1. Does the content actually answer what the user asked for? Are all their specific requirements addressed?
2. Is the data REAL and SPECIFIC (actual numbers, percentages, company names) — or are there placeholders, generic statements, or methodology instead of facts?
3. Are there any sections that are empty, vague, or missing the substance the user needs?
4. Is the research thorough and the analysis sound?

GENERAL QUALITY GUIDELINES (remember these unless the user's request suggests otherwise):
- Pyramid principle: lead with the insight/answer, then support with evidence
- MECE structure: no overlaps, no gaps in how content is organized
- Each ${isReport ? 'section' : 'slide'} should answer "so what?" — headlines are insights, not labels
- Claims should be backed by data where possible

SEVERITY GUIDE:
- HIGH: Content doesn't answer user's question, missing required topics, no real data (methodology/frameworks instead of actual figures)
- MEDIUM: Partial coverage, some placeholders, weak data in places
- LOW: Minor gaps, could use more detail, or quality guidelines not fully followed

If you find HIGH severity issues, the user should be informed and asked how to proceed.

Return JSON:
{
  "assessment": "2-3 sentence summary focused on whether user's request is fulfilled",
  "issues": [{"severity": "high|medium|low", "description": "what's wrong", "section": "which part"}],
  "suggestions": ["specific fix that would address user's needs"],
  "passesReview": true/false,
  "needsUserInput": true/false,
  "userQuestion": "If needsUserInput=true, what to ask the user"
}`;

    const reviewResult = await this._llm(`${this._mgr}: quality review (1 credit)`, reviewPrompt, { temperature: 0.2 });

    // Log review findings as communication
    if (reviewResult?.assessment) {
      this._log(`Review: "${reviewResult.assessment}"`, 'manager', 'deliverable');
    }

    // Count high severity issues
    const highSeverityIssues = (reviewResult?.issues || []).filter(i => i.severity === 'high');
    const hasHighSeverity = highSeverityIssues.length > 0;

    if (reviewResult?.issues?.length > 0) {
      this._log(`Flagged ${reviewResult.issues.length} issue(s)${hasHighSeverity ? ` (${highSeverityIssues.length} high severity)` : ''}`, 'manager', hasHighSeverity ? 'warn' : 'insight');
    }

    // If high severity issues found, communicate to user
    if (hasHighSeverity) {
      const issuesSummary = highSeverityIssues.map(i => `• ${i.description}`).join('\n');
      this._log(`HIGH SEVERITY ISSUES FOUND:\n${issuesSummary}`, 'manager', 'warn');

      // Check if we have budget for replanning
      const remainingBudget = this.budget?.remaining || 0;
      if (remainingBudget >= 2) {
        this._log(`Budget available (${remainingBudget} remaining) — can re-delegate to fix issues if needed`, 'manager', 'info');
      }
    }

    this._attachOutputToCurrentStep({
      task: `Review: ${decision.topic || 'quality check'}`,
      worker: this._mgr,
      workerRole: 'manager',
      output: reviewResult?.assessment || 'Review complete',
      insights: (reviewResult?.issues || []).map(i => i.description || i),
      nextSteps: reviewResult?.suggestions || [],
    });

    return {
      success: true,
      message: `Review: ${reviewResult?.assessment || 'complete'}`,
      analysis: reviewResult?.assessment,
      issues: reviewResult?.issues || [],
      passesReview: reviewResult?.passesReview ?? true,
      needsUserInput: reviewResult?.needsUserInput || false,
      userQuestion: reviewResult?.userQuestion || null,
      canReplan: (this.budget?.remaining || 0) >= 2 && hasHighSeverity,
    };
  }

  // ─── Execute: revise ─────────────────────────────────────────────────
  async _executeRevise(decision) {
    this._setPhase(AgentPhase.EXECUTING, 'Revising...');
    // Revisions are captured in the decision's analysis and artifacts
    return {
      success: true,
      message: `Revised: ${decision.topic || 'content'}`,
      analysis: decision.analysis,
      artifacts: decision.artifacts,
    };
  }

  // ─── Execute: scope — Assess task complexity (FREE, cost 0) ─────────
  _executeScope(decision) {
    this._setPhase(AgentPhase.THINKING, 'Scoping the engagement...');
    const scope = decision.scope || {};
    // Normalize: report mode uses estimatedSections, map to estimatedSlides for downstream compat
    if (scope.estimatedSections && !scope.estimatedSlides) {
      scope.estimatedSlides = scope.estimatedSections;
    }
    const isReport = !!this._reportMode;
    const unitLabel = isReport ? 'sections' : 'slides';
    this._log(`Scoping: ${scope.complexity || 'unknown'} complexity — ${scope.approach || ''}`, 'manager');
    if (scope.estimatedSlides) {
      this._log(`Estimated ${scope.estimatedSlides} ${unitLabel}`, 'manager');
    }
    if (scope.keyRisks?.length > 0) {
      this._log(`Risks: ${scope.keyRisks.join(', ')}`, 'manager');
    }
    // Store the requirements brief for downstream context preservation
    if (scope.requirementsBrief) {
      this._requirementsBrief = scope.requirementsBrief;
      this._log(`Requirements: ${scope.requirementsBrief}`, 'manager');
    }
    this._trackAction('manager', 'scoped', `${scope.complexity || 'unknown'} complexity, ~${scope.estimatedSlides || '?'} ${unitLabel}`, {});

    // Combined scope + ask: if questions are included, pause for user input
    const questions = decision.questions || [];
    if (questions.length > 0) {
      this._setPhase(AgentPhase.CLARIFYING, 'Waiting for your input...');
      const displayText = questions.map(q => q.question).join('\n');
      for (const q of questions) {
        this._log(`Asked: ${q.question}`, 'manager', 'info');
      }
      this.conversationHistory.push({ role: 'assistant', content: displayText });
      // Mark ask_user as done so the agent doesn't repeat it
      this.actionHistory.push({ action: Action.ASK_USER, hadProgress: true, budgetRemaining: this._budgetRemaining() });
      return {
        pause: true,
        type: ResultType.ASK_USER,
        question: questions.length === 1 ? questions[0].question : displayText,
        options: questions.length === 1 ? questions[0].options : [],
        questions,
        scope,
        thinkingLog: this.thinkingLog,
        aiIOLog: this.aiIOLog,
        budgetUsed: this.budgetUsed,
        budgetTotal: this.budgetTotal,
        iterations: this.iteration,
      };
    }

    return {
      success: true,
      message: `Scoped: ${scope.complexity || 'assessed'} complexity, ~${scope.estimatedSlides || '?'} ${unitLabel}`,
      scope,
    };
  }

  // ─── Execute: staff_team — Assemble team personas (FREE, cost 0) ───
  _executeStaffTeam(decision) {
    this._setPhase(AgentPhase.THINKING, 'Assembling the team...');
    const members = decision.members || [];
    // Log each team member with profile, register in role activity tracker
    for (const m of members) {
      const profileLine = m.profile ? ` — ${m.profile}` : '';
      const label = `${m.name || 'Consultant'}${m.specialty ? ` (${m.specialty})` : ''}${profileLine}`;
      this._log(label, 'manager', 'info');
      const key = m.name || 'consultant';
      this._trackRole(key, m.name || 'Consultant', m.specialty || '');
      if (m.profile) this.roleActivity[key].profile = m.profile;
      this._trackAction(key, 'staffed', `Joined as consultant${m.specialty ? ` — ${m.specialty}` : ''}`, { briefedBy: 'manager' });
    }
    this._trackAction('manager', 'planned', `Assembled team of ${members.length}`, {});
    // Store team on progress for UI to render as a visual roster
    this.staffedTeam = members;

    // If the manager provided a workPlan, lay them out as pending steps
    // so the user sees the execution sequence BEFORE work begins
    let workPlan = decision.workPlan || [];

    // ─── Budget pre-check: validate work plan against remaining budget ────
    if (workPlan.length > 0) {
      const remaining = this._budgetRemaining();
      // Each work item = 1 delegate credit.
      // Reserve 2 for compile + build.
      const reserveForFinish = 2;
      const maxWorkItems = Math.max(0, remaining - reserveForFinish);
      const workerSteps = workPlan.filter(s => !s._system); // Only count non-system steps

      if (workerSteps.length > maxWorkItems) {
        const trimCount = workerSteps.length - maxWorkItems;
        this._log(`Budget check: ${workerSteps.length} work items but only ${remaining} credits left (need ${reserveForFinish} for compile+build). Trimming ${trimCount} items.`, 'manager', 'warn');

        // Keep the most important items (first N)
        workPlan = workPlan.slice(0, maxWorkItems);
        this._log(`Adjusted work plan: ${workPlan.length} items (${maxWorkItems} delegate + ${reserveForFinish} reserved)`, 'manager', 'info');
      } else {
        this._log(`Budget check: ${workerSteps.length} work items, ${remaining} credits remaining (${remaining - workerSteps.length} reserve after work)`, 'manager', 'info');
      }
    }

    if (workPlan.length > 0) {
      for (const step of workPlan) {
        const assignee = step.assignee || step.role || 'consultant';
        this.steps.push({
          name: step.description || step.task || step,
          status: 'pending',
          role: step.role || 'consultant',
          assignee,                 // Who is doing this step
          parallel: true,           // Always group under "Team Activities"
          logStartIdx: this.thinkingLog.length,
          planned: true,
        });
      }
    }

    this._emitProgress();
    // Workspace recordAction handles persisting to workspace.team
    return {
      success: true,
      message: `Staffed ${members.length} consultant${members.length !== 1 ? 's' : ''}: ${members.map(m => m.name || 'Consultant').join(', ')}`,
    };
  }

  // ─── Execute: delegate — Assign work to a team persona ─────────────
  async _executeDelegate(decision) {
    const assignTo = decision.assignTo || {};
    const task = decision.delegateTask || decision.task || '';
    const context = decision.delegateContext || '';

    if (!assignTo.role || !task) {
      return { success: false, error: 'Delegate requires assignTo.role and delegateTask' };
    }

    // Cost 1 credit for the persona LLM call.
    // Budget reservation is handled by the pool/caller — don't double-count here.
    // Only refuse if truly at zero.
    if (this._budgetRemaining() < 1) {
      return { success: false, error: 'Insufficient budget for delegation' };
    }
    this._spend(1);

    const workerName = assignTo.name || assignTo.role;
    const workerRole = assignTo.role || 'consultant';
    const stepId = decision._stepId || null; // For parallel workers, tags logs to their step

    // Don't overwrite global phase in concurrent mode — it clobbers other active workers.
    // Instead, update the specific step's sub-status for granular progress.
    const myStep = stepId ? this.steps.find(s => s._stepId === stepId) : null;
    const _updateStepStatus = (msg) => {
      if (myStep) { myStep.subStatus = msg; this._emitProgress(); }
    };
    if (!stepId) {
      // Solo delegate (non-pool): safe to set global phase
      this._setPhase(AgentPhase.EXECUTING, `${workerName} working on: ${task.slice(0, 60)}${task.length > 60 ? '...' : ''}`);
    }

    // Log the handoff: manager assigns work to consultant
    this._log(`→ ${workerName}: "${task}"`, 'manager', 'handoff', stepId);

    // Track role activity: manager briefs worker
    this._trackAction('manager', 'briefed', `Assigned: ${task}`, { briefedTo: workerName });
    this._trackAction(workerName, 'assigned', task, { briefedBy: 'manager' });

    // Build concise worker prompt — 5 elements: persona, date, deck context, task, output format
    // Plus skills and relevant research only.

    // 1. PERSONA
    const persona = `You are ${assignTo.name || 'a consultant'}${assignTo.specialty ? `, specializing in ${assignTo.specialty}` : ''}.`;

    // 2. DECK CONTEXT — one brief block (not two)
    const plan = this.workspace.plan;
    let deckBrief = '';
    if (plan?.sections?.length > 0) {
      const sectionList = plan.sections.map((s, i) => {
        const title = s.sectionTitle || s.title || '';
        return `  ${i + 1}. ${title}`;
      }).join('\n');
      deckBrief = `DECK: "${plan.presentationTitle || ''}" — ${plan.mainMessage || ''}
Sections:\n${sectionList}`;
    }

    // 3. RELEVANT RESEARCH — filter to this worker's topic, not full dump
    let relevantResearch = '';
    if (this.workspace.knowledge.length > 0) {
      const taskLower = task.toLowerCase();
      const relevant = this.workspace.knowledge.filter(k => {
        const src = (k.source || '').toLowerCase();
        const data = (k.data || '').toLowerCase();
        return src.includes(taskLower.slice(0, 30)) || data.includes(taskLower.slice(0, 30));
      });
      const research = relevant.length > 0 ? relevant : this.workspace.knowledge.slice(-3);
      const researchText = research.map(k => k.data || k.summary || '').filter(Boolean).join('\n---\n');
      if (researchText) {
        const researchLimit = this.settings.limitResearchContextChars || 20000;
        relevantResearch = `RESEARCH:\n${researchText.slice(0, researchLimit)}`;
      }
    }

    // Whether the search endpoint is available for one-call research
    const searchEndpointAvailable = !!(this.settings.searchEndpoint && this.settings.searchApiKey && this.settings.searchModel);

    // ─── Unified worker prompt: all workers produce rich research prose ───
    // Workers focus on RESEARCH QUALITY — finding real data, specific numbers,
    // sourced facts. They do NOT format into slides or JSON. The manager's
    // compilation step handles structuring research into the final output
    // (slide JSON for decks, narrative for reports).
    const personaPrompt = `${persona}
TODAY: ${this._todayString()}

TOPIC: ${this.workspace.plan?.presentationTitle || this.workspace.task || ''}
${deckBrief ? `${deckBrief}\n` : ''}${context ? `CONTEXT: ${context}` : ''}
${this._requirementsBrief ? `REQUIREMENTS: ${this._requirementsBrief}` : ''}
${relevantResearch}

YOUR RESEARCH TASK: ${task}

IMPORTANT: You have web search capabilities. USE THEM. Search for real, current data to support your analysis.
Write a thorough, data-driven analysis. Include specific numbers, statistics, and dates.
Do NOT write a methodology or describe what you "would" research — actually do the research and present findings.
Every number must be real. Every claim must be specific. No placeholders, no "[TBD]", no "typically ranges from X to Y".
${this.settings.searchIncludeSources ? 'If you find source URLs, collect them at the very END of your response under a "SOURCES:" heading — deduplicated, no repetition. Do NOT embed URLs inline in the text.' : 'Do NOT include any URLs or links in your response.'}

At the END of your response, add these clearly labeled sections:
GAPS: What data or analysis is still missing, incomplete, or couldn't be verified. Be specific about what's missing.
RECOMMENDATION: State whether your deliverable is "sufficient" or "needs_more_work", with a brief rationale.
QUESTIONS: (Optional) If during your research you hit genuine ambiguity or discovered something that changes the picture, ask the client. Only ask if genuinely important — like a real consultant would.
${this.settings.searchIncludeSources ? 'SOURCES: List all source URLs here — deduplicated.' : ''}`;

    try {
      audit('worker', `${workerName} starting`, {
        role: workerRole,
        task: task.slice(0, 150),
        searchEndpointAvailable,
      });

      // ── ONE CALL: search + analysis via the search endpoint ──
      // The search endpoint has web_search_preview built in. We send the full
      // worker prompt as `input`, the model searches the web AND produces
      // the analysis in a single API call. Same endpoint used by slide creation.
      // Falls back to standard _llm() only if no search endpoint is configured.
      _updateStepStatus('Researching...');
      let result;

      if (searchEndpointAvailable) {
        // Single call to search endpoint — searches web AND reasons in one shot
        result = await researchWithSearch(personaPrompt, this.settings);
        if (result) {
          audit('worker-research', `${workerName} researched via search endpoint`, {
            task: task.slice(0, 150), resultChars: result.length, status: 'ok',
          });
        } else {
          // Search endpoint returned null — fall back to standard LLM
          audit('worker-research', `${workerName} search endpoint returned null, falling back to LLM`, { status: 'fallback' });
          result = await this._llm(
            `${workerName}: ${task}`,
            personaPrompt,
            { temperature: 0.4, returnJSON: false }
          );
        }
      } else {
        // No search endpoint configured — use standard LLM
        result = await this._llm(
          `${workerName}: ${task}`,
          personaPrompt,
          { temperature: 0.4, returnJSON: false }
        );
      }

      // ─── Parse worker output ───
      // All workers now produce rich prose research. Parse GAPS, RECOMMENDATION,
      // QUESTIONS from the end of the text. The compilation step converts this
      // into the right format (slide JSON for decks, narrative for reports).

      // ─── Parse prose research output ───
      const proseResult = typeof result === 'string' ? result : (result?.output || result?.findings || result?.summary || '');
      const prosePreview = proseResult.slice(0, 100).replace(/\n/g, ' ');
      this._log(`${workerName} delivered research: ${prosePreview}...`, workerRole, 'deliverable', stepId);

      // Extract GAPS, RECOMMENDATION, and QUESTIONS from prose
      const gapsMatch = proseResult.match(/\bGAPS?:\s*([\s\S]*?)(?=\bRECOMMENDATION:|QUESTIONS?:|$)/i);
      const recoMatch = proseResult.match(/\bRECOMMENDATION:\s*([\s\S]*?)(?=\bQUESTIONS?:|$)/i);
      const questionsMatch = proseResult.match(/\bQUESTIONS?:\s*([\s\S]*?)$/i);
      const workerGaps = gapsMatch ? gapsMatch[1].trim() : '';
      const workerRecommendation = recoMatch ? recoMatch[1].trim() : '';

      // Parse questions — each line starting with - or a number is a separate question
      const workerQuestions = [];
      if (questionsMatch) {
        const qText = questionsMatch[1].trim();
        const qLines = qText.split(/\n/).map(l => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
        for (const q of qLines) {
          if (q.length > 10) workerQuestions.push({ worker: workerName, question: q, context: task });
        }
      }
      // Also check for JSON questions array (if model returned JSON despite prose prompt)
      if (workerQuestions.length === 0 && result?.questions?.length > 0) {
        for (const q of result.questions) {
          if (typeof q === 'string' && q.length > 10) {
            workerQuestions.push({ worker: workerName, question: q, context: task });
          }
        }
      }

      if (workerGaps) this._log(`${workerName} gaps: ${workerGaps.slice(0, 120)}`, workerRole, 'info', stepId);
      if (workerQuestions.length > 0) this._surfaceQuestions(workerQuestions);

      this.workspace.knowledge.push({
        source: `${workerName}: ${task}`,
        data: proseResult,
        summary: prosePreview,
        gaps: workerGaps,
        recommendation: workerRecommendation,
      });
      this._trackAction(workerName, 'delivered', `Research: ${task}`, {
        briefedTo: 'manager',
        data: proseResult.slice(0, this.settings.limitKnowledgeStorageChars || 4000),
      });

      // Store on the current step for expanded UI view
      const displayOutput = proseResult.slice(0, 300);
      const insights = [proseResult.slice(0, 200)];
      const summaryText = prosePreview;

      this._attachOutputToCurrentStep({
        task,
        worker: workerName,
        workerRole,
        output: displayOutput,
        insights,
        summary: summaryText,
        nextSteps: [],
      }, stepId);

      // Build a short but complete summary (no ugly truncation)
      const firstSentence = proseResult.match(/^[^.!?\n]{20,}[.!?]/)?.[0] || '';
      const shortSummary = firstSentence
        ? (firstSentence.length > 120 ? firstSentence.slice(0, 117) + '...' : firstSentence)
        : proseResult.slice(0, 120).replace(/\s+\S*$/, '') + '...';

      return {
        success: true,
        message: shortSummary || `${workerName} completed research`,
        delegateOutput: displayOutput,
        findings: proseResult,
        insights,
        summary: shortSummary,
      };
    } catch (err) {
      this._log(`${workerName}: Failed — ${err.message}`, workerRole, 'error', stepId);
      return { success: false, error: `Delegation failed: ${err.message}` };
    }
  }

  // ─── Execute: delegate_parallel — Run multiple delegations concurrently ───
  async _executeDelegateParallel(decision) {
    const delegations = decision.delegations || [];
    if (delegations.length === 0) {
      return { success: false, error: 'No delegations provided' };
    }

    // Cap concurrent API calls to prevent 503 server overload.
    // Waves are already batched by _executePlanDeterministic, but ad-hoc
    // delegate_parallel calls should also be capped.
    const MAX_CONCURRENT_DELEGATIONS = 3;
    if (delegations.length > MAX_CONCURRENT_DELEGATIONS) {
      this._log(`Capping parallel delegations to ${MAX_CONCURRENT_DELEGATIONS} (concurrency limit)`, 'manager', 'info');
      delegations.splice(MAX_CONCURRENT_DELEGATIONS);
    }

    // Budget check — approved delegations always execute (plan is a contract)
    if (this._budgetRemaining() < 1) {
      return { success: false, error: 'Insufficient budget for parallel delegation' };
    }

    this._setPhase(AgentPhase.EXECUTING, `${delegations.length} consultants working in parallel...`);
    this._log(`Dispatching ${delegations.length} consultants in parallel`, 'manager');

    // Remove manager-thinking placeholders and mark previous active steps as complete
    this.steps = this.steps.filter(s => !s.managerThinking);
    for (const s of this.steps) {
      if (s.status === 'active') {
        s.status = 'complete';
        if (s.logEndIdx == null) s.logEndIdx = this.thinkingLog.length;
      }
    }

    // Activate planned pending steps that match this batch's delegations.
    // Unmatched planned steps stay pending (visible as upcoming work).
    const stepOffsets = [];
    const stepIds = [];
    for (let di = 0; di < delegations.length; di++) {
      const d = delegations[di];
      const workerName = d.assignTo?.name || d.assignTo?.role || 'Worker';
      const task = d.delegateTask || d.task || 'working';
      const stepId = `par_${Date.now()}_${di}`;
      stepIds.push(stepId);

      // Try to activate a matching pending planned step — match by assignee first, then by task
      const nameLow = workerName.toLowerCase();
      const taskLow = task.toLowerCase();
      const pendingMatch =
        this.steps.find(s => s.status === 'pending' && s.planned && (s.assignee || '').toLowerCase() === nameLow) ||
        this.steps.find(s => s.status === 'pending' && s.planned && taskLow && (s.name || '').toLowerCase().includes(taskLow.slice(0, 30))) ||
        this.steps.find(s => s.status === 'pending' && s.planned);
      if (pendingMatch) {
        pendingMatch.status = 'active';
        pendingMatch.name = `${workerName} → ${task}`;
        pendingMatch.role = 'consultant';
        pendingMatch.assignee = workerName;
        pendingMatch.parallel = true;
        pendingMatch._stepId = stepId;
        pendingMatch.logStartIdx = this.thinkingLog.length;
        stepOffsets.push(this.steps.indexOf(pendingMatch));
      } else {
        this.steps.push({
          name: `${workerName} → ${task}`,
          status: 'active',
          role: 'consultant',
          assignee: workerName,
          parallel: true,
          _stepId: stepId,
          logStartIdx: this.thinkingLog.length,
        });
        stepOffsets.push(this.steps.length - 1);
      }
    }
    this._emitProgress();

    // Execute delegations concurrently — JS is single-threaded so budget
    // checks (synchronous before first await) are safe without locks.
    const promises = delegations.map((d, di) => {
      const delegateDecision = {
        action: Action.DELEGATE,
        assignTo: d.assignTo,
        delegateTask: d.delegateTask || d.task,
        delegateContext: d.delegateContext || d.context || '',
        _stepId: stepIds[di],
      };
      return this._executeDelegate(delegateDecision).then(result => {
        // Mark step complete immediately as each finishes
        const step = this.steps[stepOffsets[di]];
        if (step) {
          step.status = result?.success ? 'complete' : 'error';
          step.summary = result?.message || '';
          step.subStatus = null;
          step.logEndIdx = this.thinkingLog.length;
          step.cost = 1;
        }
        this._emitProgress();
        return result;
      });
    });

    const results = await Promise.all(promises);

    const succeeded = results.filter(r => r?.success).length;
    const totalSlides = results.reduce((sum, r) => sum + (r?.slides?.length || 0), 0);
    const summaryMsg = totalSlides > 0
      ? `${succeeded} consultants delivered ${totalSlides} slides`
      : `${succeeded} of ${delegations.length} consultants completed their tasks`;
    return {
      success: succeeded > 0,
      message: summaryMsg,
      results,
    };
  }

  // ─── Execute: ask_user ───────────────────────────────────────────────
  _executeAskUser(decision) {
    this._setPhase(AgentPhase.CLARIFYING, 'Waiting for your input...');

    // Support multi-question format: decision.questions = [{question, options}, ...]
    const questions = decision.questions || (decision.question ? [{ question: decision.question, options: decision.options || [] }] : []);
    const displayText = questions.map(q => q.question).join('\n');

    // Log each question so the expand view shows what was asked
    for (const q of questions) {
      this._log(`Asked: ${q.question}`, 'manager', 'info');
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: displayText,
    });

    return {
      pause: true,
      type: ResultType.ASK_USER,
      question: questions.length === 1 ? questions[0].question : displayText,
      options: questions.length === 1 ? questions[0].options : [],
      questions,  // Structured multi-question array for the UI
      // Include state for the UI
      thinkingLog: this.thinkingLog,
      aiIOLog: this.aiIOLog,
      budgetUsed: this.budgetUsed,
      budgetTotal: this.budgetTotal,
      iterations: this.iteration,
    };
  }

  // ─── Execute: present_plan ───────────────────────────────────────────
  _executePresentPlan(decision) {
    const plan = decision.plan || {};
    // Normalize report mode fields → presentation fields for downstream compat
    if (plan.reportTitle && !plan.presentationTitle) {
      plan.presentationTitle = plan.reportTitle;
    }
    // In report mode the LLM may use "sections" array inside each section instead of "slides"
    // Normalize so downstream code always finds "slides"
    for (const s of (plan.sections || [])) {
      if (s.sections && !s.slides) {
        s.slides = s.sections;
        delete s.sections;
      }
    }
    const isReport = !!this._reportMode;
    // Log plan details so the expand view shows what was planned
    this._log(`Plan: "${plan.presentationTitle || (isReport ? 'report' : 'presentation')}" — ${(plan.sections || []).length} sections`, 'manager', 'info');
    if (plan.storylineType || plan.narrativeArc) {
      this._log(`Narrative: ${plan.storylineType || plan.narrativeArc}`, 'manager', 'info');
    }
    if (plan.mainMessage || plan.governingThought) {
      this._log(`Main message: ${plan.mainMessage || plan.governingThought}`, 'manager', 'info');
    }
    const sectionTitles = (plan.sections || []).map(s => (s.sectionTitle || s.title || '').replace(/^\d+[\.\)\-]\s*/, '').trim()).filter(Boolean);
    if (sectionTitles.length > 0) {
      this._log(`Flow: ${sectionTitles.join(' → ')}`, 'manager', 'info');
    }

    // Normalize to storyline format the UI expects
    // Strip leading numbers from section titles — the UI adds its own numbering (①, ②, etc.)
    const stripNum = (t) => (t || '').replace(/^\d+[\.\)\-]\s*/, '').trim();

    // Preserve hierarchical sections — each section groups multiple slides
    const storyline = {
      presentationTitle: plan.presentationTitle || plan.title || this.workspace.task,
      mainMessage: plan.mainMessage || plan.governingThought || '',
      storylineType: plan.storylineType || plan.narrativeArc || '',
      storylineFlow: plan.storylineFlow || (plan.sections || []).map(s => stripNum(s.sectionTitle || s.title)).join(' → '),
      sections: (plan.sections || []).map((s, i) => ({
        sectionTitle: stripNum(s.sectionTitle || s.title) || `Section ${i + 1}`,
        keyMessage: s.keyMessage || '',
        contentType: s.contentType || '',
        slideRole: s.slideRole || '',
        // Preserve child slides for hierarchical display and downstream sectionTracker
        ...(s.slides?.length > 0 ? { slides: s.slides.map(sl => ({
          title: stripNum(sl.title || sl.sectionTitle || ''),
          keyMessage: sl.keyMessage || '',
          contentType: sl.contentType || '',
          slideRole: sl.slideRole || 'body',
        })) } : {}),
      })),
      // Preserve _planSections from consulting team agent if present
      ...(plan._planSections ? { _planSections: plan._planSections } : {}),
      closing: plan.closing || null,
    };

    // ── Auto-group into 3-5 theme groups when sections are effectively flat ──
    // Fires when: (a) no .slides arrays at all, OR (b) degenerate hierarchy where
    // most sections have only 1 child slide (which is just a flat list in disguise).
    const hasHierarchy = storyline.sections.some(s => s.slides?.length > 0);
    const totalChildSlides = storyline.sections.reduce((sum, s) => sum + (s.slides?.length || 0), 0);
    const avgSlidesPerSection = storyline.sections.length > 0 ? totalChildSlides / storyline.sections.length : 0;
    const isDegenerate = hasHierarchy && avgSlidesPerSection <= 1 && storyline.sections.length >= 6;
    if ((!hasHierarchy || isDegenerate) && storyline.sections.length >= 6) {
      const groupCount = Math.min(Math.max(2, Math.ceil(storyline.sections.length / 3)), 5);
      const groupSize = Math.ceil(storyline.sections.length / groupCount);
      const grouped = [];
      for (let g = 0; g < groupCount; g++) {
        const start = g * groupSize;
        const chunk = storyline.sections.slice(start, start + groupSize);
        if (chunk.length === 0) continue;
        // Flatten degenerate hierarchy: if sections already have .slides arrays
        // with 1 child each, extract those children; otherwise use the section itself.
        const childSlides = [];
        for (const s of chunk) {
          if (s.slides?.length > 0) {
            for (const sl of s.slides) {
              childSlides.push({
                title: sl.title || s.sectionTitle || '',
                keyMessage: sl.keyMessage || s.keyMessage || '',
                contentType: sl.contentType || s.contentType || '',
                slideRole: 'body',
              });
            }
          } else {
            childSlides.push({
              title: s.sectionTitle || '',
              keyMessage: s.keyMessage || '',
              contentType: s.contentType || '',
              slideRole: 'body',
            });
          }
        }
        grouped.push({
          sectionTitle: chunk[0].sectionTitle || `Section ${g + 1}`,
          keyMessage: chunk[0].keyMessage || '',
          contentType: 'section-group',
          slideRole: 'body',
          slides: childSlides,
        });
      }
      storyline.sections = grouped;
      storyline.storylineFlow = grouped.map(g => g.sectionTitle).join(' → ');
      this._log(`Auto-grouped ${grouped.reduce((sum, g) => sum + g.slides.length, 0)} flat slides into ${grouped.length} theme sections`, 'manager', 'info');
    }

    // ── Slide count enforcement ──
    // Count total slides including child slides within sections
    const totalSlides = storyline.sections.reduce((sum, s) =>
      sum + (s.slides?.length > 0 ? s.slides.length : 1), 0);
    const targetSlides = this.workspace.scopeAssessment?.estimatedSlides;
    if (targetSlides && totalSlides !== targetSlides) {
      this._log(`Plan has ${totalSlides} slides (in ${storyline.sections.length} sections) but target is ${targetSlides} — count mismatch`, 'manager', 'warn');
      // Store the target so compilation can enforce it
      storyline._targetSlideCount = targetSlides;
    }

    this.workspace.plan = storyline;
    this._setPhase(AgentPhase.AWAITING_APPROVAL, 'Plan ready for review');

    // Store embedded team + workPlan (from combined plan_and_staff)
    // These are used after approval to skip the extra _think call for staffing
    if (decision.members?.length > 0) {
      this._pendingTeam = { members: decision.members, workPlan: decision.workPlan || [] };
    }

    return {
      pause: true,
      type: ResultType.PRESENT_PLAN,
      plan: storyline,
      storyline,
      // Include state for the UI
      steps: this.steps,
      thinkingLog: this.thinkingLog,
      aiIOLog: this.aiIOLog,
      budgetUsed: this.budgetUsed,
      budgetTotal: this.budgetTotal,
      iterations: this.iteration,
    };
  }

  // ─── Execute: done ───────────────────────────────────────────────────
  _executeDone(decision) {
    // Done validation: verify output actually exists
    if (!this.workspace.hasOutput()) {
      this._doneFailCount++;
      if (this._doneFailCount >= 2) {
        // Repeated done claims with no output — force stuck to prevent budget drain
        this._log('Done claimed twice with no output — forcing stuck');
        return {
          done: true,
          type: ResultType.STUCK,
          success: false,
          reason: 'Agent claims done but no output was produced',
          output: this.workspace.getBestOutput(),
          thinkingLog: this.thinkingLog,
          aiIOLog: this.aiIOLog,
          budgetUsed: this.budgetUsed,
          budgetTotal: this.budgetTotal,
        };
      }
      this._log('Done claimed but no output exists — continuing');
      return { success: false, error: 'No output produced yet — cannot mark done' };
    }

    this._setPhase(AgentPhase.READY, 'Complete');

    return {
      done: true,
      type: ResultType.DONE,
      success: true,
      summary: decision.summary || 'Task complete',
      output: this.workspace.getBestOutput(),
      // Include all logs for the UI
      thinkingLog: this.thinkingLog,
      aiIOLog: this.aiIOLog,
      budgetUsed: this.budgetUsed,
      budgetTotal: this.budgetTotal,
      iterations: this.iteration,
    };
  }

  // ─── Execute: stuck ──────────────────────────────────────────────────
  _executeStuck(decision) {
    this._setPhase(AgentPhase.ERROR, decision.reason || 'Stuck');

    return {
      done: true,
      type: ResultType.STUCK,
      success: false,
      reason: decision.reason || 'Agent is stuck',
      suggestions: decision.suggestions || [],
      output: this.workspace.getBestOutput(),
      thinkingLog: this.thinkingLog,
      aiIOLog: this.aiIOLog,
      budgetUsed: this.budgetUsed,
      budgetTotal: this.budgetTotal,
      iterations: this.iteration,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  DETERMINISTIC PLAN EXECUTION
  //
  //  After staff_team provides a workPlan, execute it mechanically.
  //  No more _think() calls — each step is exactly 1 GPT call.
  //  Flow: delegates → compile → build → done
  // ═════════════════════════════════════════════════════════════════════════

  _findMember(members, workItem) {
    return members.find(m => m.name === workItem.assignee) ||
           members.find(m => m.role === workItem.role) ||
           null;
  }

  /**
   * Validate workPlan before deterministic execution:
   * - Filter out meta-steps the LLM shouldn't have planned (compile, build)
   * - Ensure each item has a description and assignee
   * - Trim if total work items exceed available budget (remaining - 2 reserve)
   */
  _validateWorkPlan(workPlan, members) {
    // Remove meta-steps — system handles compile and build automatically
    let items = workPlan.filter(step => {
      const desc = (step.description || '').toLowerCase();
      return desc && !desc.includes('compil') && !desc.includes('build presentation');
    });

    // Ensure every item has at least a description and assignee fallback
    items = items.map(item => ({
      ...item,
      description: item.description || 'Execute assigned task',
      assignee: item.assignee || (members[0]?.name) || 'Worker',
      role: item.role || 'consultant',
      parallel: item.parallel ?? true,
    }));

    // Log if work exceeds budget but do NOT trim — approved plan is a contract
    const maxWorkItems = Math.max(0, this._budgetRemaining() - 2);
    if (items.length > maxWorkItems) {
      this._log(`Note: WorkPlan has ${items.length} items, budget has ${maxWorkItems} work credits (${this._budgetRemaining()} remaining - 2 reserved). All planned work will execute.`, 'manager', 'info');
    }

    return items;
  }

  async _executePlanDeterministic(workPlan, members) {
    // ─── Separate work items from meta-steps (compile, build, review) ───
    const workItems = workPlan.filter(step => {
      const desc = (step.description || '').toLowerCase();
      return !desc.includes('compil') && !desc.includes('build presentation');
    });

    // ─── Concurrent pool execution ───
    // Instead of wave-based batches (wait for all N to finish before starting next N),
    // use a pool with capacity: when any worker finishes, the next one starts immediately.
    // This keeps all slots filled and eliminates idle gaps between waves.
    const MAX_CONCURRENT = Math.min(this.settings?.parallelBatches || 3, 3);
    const remaining = this._budgetRemaining();
    // Budget trimming is handled upstream in _validateWorkPlan (reserves 2 for compile+build).
    // The pool only needs to check there's at least 1 credit per worker — no additional reserve.
    // This prevents reserve stacking (upstream 2 + pool 2 + delegate 1 = 5 wasted credits).
    const POOL_MIN_FOR_LAUNCH = 1;

    this._log(`Executing: ${workItems.length} consultants with ${MAX_CONCURRENT} concurrent slots (budget: ${remaining} credits)`, 'manager', 'info');

    // Remove manager-thinking placeholders and mark previous active steps as complete
    this.steps = this.steps.filter(s => !s.managerThinking);
    for (const s of this.steps) {
      if (s.status === 'active') {
        s.status = 'complete';
        if (s.logEndIdx == null) s.logEndIdx = this.thinkingLog.length;
      }
    }

    // Build the work queue
    const queue = workItems.map(item => {
      const member = this._findMember(members, item) || {
        role: item.role || 'consultant',
        name: item.assignee || 'Worker',
        specialty: '',
      };
      return { item, member };
    });

    let poolIdCounter = 0;
    let completedCount = 0;
    const REVIEW_INTERVAL = 3; // Manager checks in every N completions
    const activeSlots = new Map(); // stepId → { promise, stepIdx }

    // Activate the next queue item into a pool slot, returns true if launched
    // All approved plan items execute — budget does not gate planned work.
    const launchNext = () => {
      if (queue.length === 0) return false;

      const { item, member } = queue.shift();
      const stepId = `pool_${Date.now()}_${poolIdCounter++}`;
      const stepName = `${member.name} → ${item.description}`;

      // Find a pending planned step to activate (match by assignee → task → any)
      const nameLow = (member.name || '').toLowerCase();
      const taskLow = (item.description || '').toLowerCase();
      const pendingMatch =
        this.steps.find(s => s.status === 'pending' && s.planned && (s.assignee || '').toLowerCase() === nameLow) ||
        this.steps.find(s => s.status === 'pending' && s.planned && taskLow && (s.name || '').toLowerCase().includes(taskLow.slice(0, 30))) ||
        this.steps.find(s => s.status === 'pending' && s.planned);

      let stepIdx;
      if (pendingMatch) {
        pendingMatch.status = 'active';
        pendingMatch.name = stepName;
        pendingMatch.role = 'consultant';
        pendingMatch.assignee = member.name;
        pendingMatch.parallel = true;
        pendingMatch._stepId = stepId;
        pendingMatch.logStartIdx = this.thinkingLog.length;
        stepIdx = this.steps.indexOf(pendingMatch);
      } else {
        this.steps.push({
          name: stepName,
          status: 'active',
          role: 'consultant',
          assignee: member.name,
          parallel: true,
          _stepId: stepId,
          logStartIdx: this.thinkingLog.length,
        });
        stepIdx = this.steps.length - 1;
      }

      // Launch the delegate — _executeDelegate handles its own _spend(1)
      const decision = {
        action: Action.DELEGATE,
        assignTo: member,
        delegateTask: item.description,
        delegateContext: this._requirementsBrief || '',
        _stepId: stepId,
      };

      const promise = this._executeDelegate(decision).then(result => {
        // Mark step complete immediately — UI updates in real time
        const step = this.steps[stepIdx];
        if (step) {
          step.status = result?.success ? 'complete' : 'error';
          step.summary = result?.message || '';
          step.subStatus = null; // Clear live sub-status
          step.logEndIdx = this.thinkingLog.length;
          step.cost = 1;
        }
        this._emitProgress();
        this.workspace.recordAction(decision, result);
        this.actionHistory.push({
          action: Action.DELEGATE,
          hadProgress: result?.success,
          budgetRemaining: this._budgetRemaining(),
        });
        return { stepId, result };
      });

      activeSlots.set(stepId, promise);
      this._emitProgress();
      return true;
    };

    // ─── Fill initial pool slots ───
    const initialCount = Math.min(queue.length, MAX_CONCURRENT);
    this._setPhase(AgentPhase.EXECUTING, `${initialCount} consultants working...`);
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      if (!launchNext()) break;
    }

    // ─── Pool loop: when any worker finishes, immediately start the next ───
    while (activeSlots.size > 0) {
      if (this.isAborted) return this._result(ResultType.ABORTED);

      // Wait for any one slot to complete
      const completed = await Promise.race(activeSlots.values());
      activeSlots.delete(completed.stepId);

      // ─── CHECKPOINT: Drain live input queue between worker completions ───
      // This is where user messages get integrated — between workers, not during.
      if (this._inputQueue.length > 0) {
        const inputResult = await this._drainInputQueue();
        if (inputResult?.additionalTasks?.length > 0) {
          // User added new requirements — inject as extra queue items
          for (const extra of inputResult.additionalTasks) {
            const member = members.find(m => (m.name || '').toLowerCase() === (extra.assignee || '').toLowerCase())
              || members[0] || { role: 'consultant', name: extra.assignee || 'Consultant', specialty: '' };
            queue.push({ item: { description: extra.task, role: 'consultant', parallel: true }, member });
            this._log(`Added follow-up task from live input: ${extra.task}`, 'manager', 'info');
          }
        }
      }

      // ─── Manager periodic check-in: assess progress every N completions ───
      completedCount++;
      if (completedCount % REVIEW_INTERVAL === 0 && queue.length > 0 && !this.isAborted) {
        await this._midExecutionReview(completedCount, queue, members);
      }

      // Fill the freed slot with the next queued item
      if (launchNext()) {
        const activeCount = activeSlots.size;
        const pendingCount = queue.length;
        this._setPhase(AgentPhase.EXECUTING, `${activeCount} consultant${activeCount !== 1 ? 's' : ''} working${pendingCount > 0 ? ` (${pendingCount} queued)` : ''}...`);
      }
    }

    // Mark any remaining pending planned steps as complete (all planned work has been covered)
    for (const s of this.steps) {
      if (s.status === 'pending' && s.planned) {
        s.status = 'complete';
        // Use the step name (which includes the task description) rather than generic "Executed"
        const taskPart = (s.name || '').includes('→') ? s.name.split('→').slice(1).join('→').trim() : s.name;
        s.summary = taskPart ? `Completed: ${taskPart}` : 'Completed';
        s.logEndIdx = this.thinkingLog.length;
      }
    }
    this._emitProgress();

    // ─── CHECKPOINT: Drain any remaining live input before review ───
    if (this._inputQueue.length > 0) {
      await this._drainInputQueue();
    }

    // ─── Manager review: assess completeness, dispatch follow-up work if needed ───
    if (this.workspace.knowledge?.length > 0 && !this.isAborted) {
      await this._reviewTeamDeliverables(members);
    }

    // ─── CHECKPOINT: Final drain before compile ───
    if (this._inputQueue.length > 0) {
      await this._drainInputQueue();
    }

    // ─── Compile team findings ───
    // Skip compilation if the user toggled "reportSkipCompilation" for reports
    const skipCompile = this._reportMode && !!this.settings?.reportSkipCompilation;
    if (skipCompile) {
      this._log('Skipping manager compilation — sending raw consultant research to report generation', 'manager', 'info');
    } else if (this._budgetRemaining() >= 2 && this.workspace.knowledge?.length > 0) {
      await this._compileTeamFindings();
    }

    // ─── Report Mode: generate interactive HTML report instead of slides ───
    if (this._reportMode) {
      return this._generateReportOutput();
    }

    // ─── Build presentation (the finish line) ───
    return this._buildFromCompiledContent();
  }

  /**
   * Manager review of team deliverables after all workers complete.
   * Assesses completeness vs original brief, identifies gaps, and can
   * commission additional work if budget allows and gaps are significant.
   * Cost: 1 credit for the review call, plus 1 per additional worker dispatched.
   */

  /**
   * Mid-execution review — manager checks in every N worker completions.
   * Looks for patterns (failures, repeated issues) and decides whether to
   * change strategy, drop failing tasks, or ask the user for guidance.
   * Cost: FREE (uses fast model / low tokens). Does NOT count against budget.
   */
  async _midExecutionReview(completedSoFar, remainingQueue, members) {
    if (this.isAborted) return;

    // Gather recent results for the manager to assess
    const recentKnowledge = (this.workspace.knowledge || []).slice(-completedSoFar);
    const recentSummaries = recentKnowledge.map((k, i) => {
      const gapNote = k.gaps ? ` [GAPS: ${k.gaps.slice(0, 80)}]` : '';
      const recoNote = k.recommendation || '';
      return `${i + 1}. ${k.source}: ${(k.summary || '').slice(0, 100)}${gapNote}${recoNote ? ` — ${recoNote}` : ''}`;
    }).join('\n');

    // Check for error patterns
    const recentErrors = this.steps
      .filter(s => s.status === 'error')
      .slice(-5)
      .map(s => `- ${s.name}: ${s.summary || 'failed'}`)
      .join('\n');

    const remainingTasks = remainingQueue.slice(0, 8).map((q, i) =>
      `${i + 1}. ${q.item.description}`
    ).join('\n');

    const reviewPrompt = `You are the engagement manager. ${completedSoFar} workers have completed so far. Review progress and decide next action.

ORIGINAL BRIEF: ${(this.workspace.task || '').slice(0, 300)}

RECENT RESULTS (last ${recentKnowledge.length}):
${recentSummaries || '(none)'}

${recentErrors ? `ERRORS/FAILURES:\n${recentErrors}\n` : ''}REMAINING QUEUE (${remainingQueue.length} tasks):
${remainingTasks || '(none)'}

Based on the pattern of results so far, respond in JSON:
{
  "assessment": "on_track" | "issues_detected" | "strategy_change_needed",
  "reasoning": "Brief explanation of what you see",
  "action": "continue" | "reorder_queue" | "drop_failing" | "ask_user",
  "dropTasks": [],
  "askUserMessage": "",
  "note": "Optional note to log"
}

Rules:
- "continue" if things look good
- "drop_failing" if a pattern of identical failures suggests tasks can't succeed (e.g., blocked sites)
- "reorder_queue" if you want to prioritize certain remaining tasks
- "ask_user" if strategy needs to change and you need human input — provide a clear question
- Be pragmatic. Don't interrupt for minor issues. Only escalate when it matters.`;

    try {
      this._log('Manager reviewing progress...', 'manager', 'info');
      const review = await this._llm(
        `${this._mgr}: mid-execution review`,
        reviewPrompt,
        { temperature: 0.2, returnJSON: true, maxTokens: 512 }
      );

      if (!review || review.action === 'continue') {
        if (review?.note) this._log(`Review: ${review.note}`, 'manager', 'info');
        return;
      }

      if (review.action === 'drop_failing' && review.dropTasks?.length > 0) {
        // Remove failing tasks from queue
        const dropSet = new Set(review.dropTasks.map(t => t.toLowerCase()));
        const before = remainingQueue.length;
        for (let i = remainingQueue.length - 1; i >= 0; i--) {
          const desc = (remainingQueue[i].item.description || '').toLowerCase();
          if (review.dropTasks.some(d => desc.includes(d.toLowerCase()))) {
            remainingQueue.splice(i, 1);
          }
        }
        const dropped = before - remainingQueue.length;
        if (dropped > 0) {
          this._log(`Dropped ${dropped} tasks that were failing repeatedly`, 'manager', 'info');
          this._trackAction('manager', 'reviewed', `Dropped ${dropped} failing tasks: ${review.reasoning}`, {});
        }
      }

      if (review.action === 'ask_user' && review.askUserMessage) {
        // Surface as a pending question for the user
        this._surfaceQuestions([{
          worker: this._mgr,
          question: review.askUserMessage,
          context: `Mid-execution review after ${completedSoFar} completions`,
        }]);
        this._log(`Manager asking: ${review.askUserMessage}`, 'manager', 'info');
        this._trackAction('manager', 'reviewed', `Asked user: ${review.askUserMessage.slice(0, 100)}`, {});
      }

      if (review.note) {
        this._log(`Review: ${review.note}`, 'manager', 'info');
      }

    } catch (err) {
      // Non-critical — log and continue
      this._log(`Mid-execution review failed: ${err.message}`, 'manager', 'info');
    }
  }

  async _reviewTeamDeliverables(members) {
    const knowledge = this.workspace.knowledge || [];
    if (knowledge.length === 0) return; // Nothing to review

    // Need at least 1 credit for the review + 2 reserved for compile+build
    // Plus at least 1 more credit to make dispatching additional work worthwhile
    const budgetForReview = this._budgetRemaining() - 2; // Reserve compile+build
    if (budgetForReview < 2) {
      // Not enough budget for review + at least one follow-up — skip review
      this._log(`${this._mgr}: Skipping review — insufficient budget for review + follow-up (${budgetForReview} available after compile+build reserve)`, 'manager', 'info');
      return;
    }

    this._spend(1);
    this._addStep(`${this._mgr}: Reviewing team deliverables`, 'active', 'manager');
    this._setPhase(AgentPhase.EXECUTING, `${this._mgr}: Reviewing team deliverables for completeness...`);

    // Build review prompt with all worker outputs and their gaps
    const brief = this._requirementsBrief || this.workspace.task || '';
    const plan = this.workspace.plan;
    const planSummary = plan?.sections?.map(s => {
      const title = s.sectionTitle || s.title || '';
      const slides = s.slides?.map(sl => sl.title || sl.keyMessage || '').filter(Boolean).join(', ');
      return `  - ${title}${slides ? `: ${slides}` : ''}`;
    }).join('\n') || '';

    const workerSummaries = knowledge.map((k, i) => {
      const preview = (k.data || '').slice(0, 500);
      const gaps = k.gaps ? `\n  GAPS: ${k.gaps}` : '';
      const reco = k.recommendation ? `\n  RECOMMENDATION: ${k.recommendation}` : '';
      return `WORKER ${i + 1} (${k.source}):\n  ${preview}${gaps}${reco}`;
    }).join('\n\n');

    const availableWorkerCredits = budgetForReview - 1; // Already spent 1 for this review

    const reviewPrompt = `You are the ENGAGEMENT MANAGER reviewing your team's deliverables before compilation.

ORIGINAL BRIEF: ${brief}

PLANNED SECTIONS:
${planSummary}

TEAM DELIVERABLES:
${workerSummaries}

AVAILABLE BUDGET FOR ADDITIONAL WORK: ${availableWorkerCredits} worker credit${availableWorkerCredits !== 1 ? 's' : ''}

YOUR TASK: Assess whether the team's output is COMPLETE and SUFFICIENT for the original brief.
- Compare deliverables against the plan: are all planned sections covered with real data?
- Review worker-reported gaps: are any critical?
- Judge quality: is the data specific enough? Are there placeholder-like statements?

OUTPUT — return JSON:
{
  "assessment": "complete|has_gaps",
  "qualitySummary": "1-2 sentence overall quality assessment",
  "additionalWork": [
    {
      "task": "Specific research task to fill the gap",
      "assignee": "Name of team member best suited",
      "role": "consultant",
      "reason": "Why this additional work is needed"
    }
  ]
}

RULES:
- Only request additional work if gaps are SIGNIFICANT and would materially hurt the final output.
- Do NOT request additional work for minor polish — compilation will handle that.
- additionalWork array should be EMPTY if deliverables are sufficient.
- Never exceed ${availableWorkerCredits} additional tasks (budget constraint).
- Each additional task must be a specific, actionable research task — not a vague instruction.`;

    try {
      const reviewResult = await this._llm(
        `${this._mgr}: Reviewing deliverables`,
        reviewPrompt,
        { temperature: 0.3, returnJSON: true }
      );

      const assessment = reviewResult?.assessment || 'complete';
      const qualitySummary = reviewResult?.qualitySummary || '';
      const additionalWork = reviewResult?.additionalWork || [];

      this._log(`${this._mgr} review: ${assessment} — ${qualitySummary}`, 'manager', 'info');

      // Mark review step complete
      const reviewStep = this.steps.find(s => s.status === 'active' && s.role === 'manager');
      if (reviewStep) {
        reviewStep.status = 'complete';
        reviewStep.summary = `${assessment}: ${qualitySummary}`;
        reviewStep.logEndIdx = this.thinkingLog.length;
      }
      this._emitProgress();

      // If gaps identified and additional work requested, dispatch follow-up workers
      if (assessment === 'has_gaps' && additionalWork.length > 0 && availableWorkerCredits > 0) {
        const tasksToDispatch = additionalWork.slice(0, availableWorkerCredits);
        this._log(`${this._mgr}: Dispatching ${tasksToDispatch.length} follow-up task${tasksToDispatch.length !== 1 ? 's' : ''} to address gaps`, 'manager', 'info');
        this._setPhase(AgentPhase.EXECUTING, `${this._mgr}: Dispatching ${tasksToDispatch.length} follow-up task${tasksToDispatch.length !== 1 ? 's' : ''}...`);

        // Execute follow-up work (concurrently, capped at 3)
        const MAX_FOLLOWUP_CONCURRENT = Math.min(tasksToDispatch.length, 3);
        const followupPromises = [];

        for (let i = 0; i < tasksToDispatch.length; i++) {
          const work = tasksToDispatch[i];
          const member = members.find(m => (m.name || '').toLowerCase() === (work.assignee || '').toLowerCase())
            || members[i % members.length]
            || { role: 'consultant', name: work.assignee || 'Consultant', specialty: '' };

          const stepId = `followup_${Date.now()}_${i}`;
          const stepName = `${member.name} → ${work.task} (follow-up)`;

          this.steps.push({
            name: stepName,
            status: 'active',
            role: 'consultant',
            assignee: member.name,
            parallel: true,
            _stepId: stepId,
            logStartIdx: this.thinkingLog.length,
          });

          const decision = {
            action: Action.DELEGATE,
            assignTo: member,
            delegateTask: work.task,
            delegateContext: `FOLLOW-UP: ${work.reason}\n${this._requirementsBrief || ''}`,
            _stepId: stepId,
          };

          const promise = this._executeDelegate(decision).then(result => {
            const step = this.steps.find(s => s._stepId === stepId);
            if (step) {
              step.status = result?.success ? 'complete' : 'error';
              step.summary = result?.message || '';
              step.subStatus = null;
              step.logEndIdx = this.thinkingLog.length;
              step.cost = 1;
            }
            this._emitProgress();
            return { stepId, result };
          });

          followupPromises.push(promise);

          // Respect concurrency limit — wait for a slot to free up
          if (followupPromises.length >= MAX_FOLLOWUP_CONCURRENT) {
            await Promise.race(followupPromises);
            // Remove completed promises
            for (let j = followupPromises.length - 1; j >= 0; j--) {
              const status = await Promise.race([followupPromises[j].then(() => 'done'), Promise.resolve('pending')]);
              if (status === 'done') followupPromises.splice(j, 1);
            }
          }
        }

        // Wait for all remaining follow-up workers
        if (followupPromises.length > 0) {
          await Promise.all(followupPromises);
        }

        this._log(`${this._mgr}: Follow-up work complete`, 'manager', 'info');
      }
    } catch (err) {
      this._log(`${this._mgr}: Review failed — ${err.message}. Proceeding to compile.`, 'manager', 'error');
      // Mark review step as error but continue — don't block compilation
      const reviewStep = this.steps.find(s => s.status === 'active' && s.role === 'manager');
      if (reviewStep) {
        reviewStep.status = 'error';
        reviewStep.summary = `Review failed: ${err.message}`;
        reviewStep.logEndIdx = this.thinkingLog.length;
      }
    }

    this._emitProgress();
  }

  /**
   * Group work items into batches for wave-based execution.
   * Respects parallel/sequential flags: parallel items can share a wave,
   * sequential items get their own wave or attach to the next wave.
   */
  _groupIntoBatches(workItems, maxPerBatch) {
    const batches = [];
    let currentBatch = [];

    for (const item of workItems) {
      if (item.parallel === false && currentBatch.length > 0) {
        // Sequential item — flush current batch first, then add as own batch
        batches.push(currentBatch);
        currentBatch = [];
        batches.push([item]);
      } else {
        currentBatch.push(item);
        if (currentBatch.length >= maxPerBatch) {
          batches.push(currentBatch);
          currentBatch = [];
        }
      }
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    return batches;
  }

  /**
   * Compile team research into concise, structured slide specs for the router.
   * Cost: 1 credit. Produces a focused deck — structure + content, no bloat.
   */
  async _compileTeamFindings() {
    if (this._budgetRemaining() < 2) return null; // Need 1 compile + 1 build
    this._spend(1);

    this._addStep(`${this._mgr}: Merging team findings`, 'active', 'manager');
    this._setPhase(AgentPhase.COMPILING, `${this._mgr}: Merging findings into final ${this._reportMode ? 'report' : 'deck'}...`);

    const plan = this.workspace.plan;
    const knowledge = this.workspace.knowledge || [];
    const brief = this._requirementsBrief || '';

    // Target slide count — from scope or plan
    // Expand hierarchical sections (with child .slides) into flat slide list for compilation
    const sectionsJSON = [];
    for (const s of (plan?.sections || [])) {
      if (s.slides?.length > 0) {
        // Hierarchical: expand child slides, annotate with parent section name
        for (const sl of s.slides) {
          sectionsJSON.push({
            i: sectionsJSON.length + 1,
            title: sl.title || sl.sectionTitle || s.sectionTitle || s.title,
            msg: sl.keyMessage || s.keyMessage || '',
            type: sl.contentType || s.contentType || '',
            section: s.sectionTitle || s.title || '',
          });
        }
      } else {
        sectionsJSON.push({
          i: sectionsJSON.length + 1,
          title: s.sectionTitle || s.title,
          msg: s.keyMessage || '',
          type: s.contentType || '',
        });
      }
    }
    const targetCount = plan?._targetSlideCount || this.workspace.scopeAssessment?.estimatedSlides || sectionsJSON.length;

    // Build section grouping summary for the compile LLM
    // so it knows which slides belong to the same theme (for the exec summary)
    const hasGroups = (plan?.sections || []).some(s => s.slides?.length > 0);
    let sectionGrouping = '';
    if (hasGroups) {
      sectionGrouping = (plan.sections || []).map((s, i) => {
        const name = s.sectionTitle || s.title || `Section ${i + 1}`;
        const children = (s.slides || []).map(sl => sl.title || '').filter(Boolean);
        return `  ${i + 1}. ${name}${children.length > 0 ? ': ' + children.join(', ') : ''}`;
      }).join('\n');
    }

    // Collect worker-produced slides directly
    const workerSlides = [];
    for (const k of knowledge) {
      if (k.slides?.length > 0) {
        for (const s of k.slides) workerSlides.push(s);
      }
    }

    // If workers produced slide-ready content, the compile step is a MERGE + QUALITY PASS
    // (not a from-scratch compilation). This is lighter and faster.
    const hasWorkerSlides = workerSlides.length > 0;

    const mainMessage = plan?.mainMessage || '';
    const narrativeType = plan?.storylineType || '';
    const narrativeFlow = plan?.storylineFlow || '';

    // ─── Collect all research knowledge (shared by both modes) ───
    const allKnowledgeText = knowledge.map(k => {
      const data = typeof k.data === 'string' ? k.data : JSON.stringify(k.data);
      let entry = `[${k.source}]: ${data}`;
      if (k.dataPoints?.length > 0) entry += `\nData: ${k.dataPoints.join(' | ')}`;
      if (k.themes?.length > 0) entry += `\nThemes: ${k.themes.join(', ')}`;
      return entry;
    }).join('\n\n');

    // Worker slide text (if available)
    const workerSlideText = hasWorkerSlides
      ? workerSlides.map((s, i) =>
          `[${i + 1}] TITLE: ${s.title}\nKEY MESSAGE: ${s.keyMessage}\nTYPE: ${s.contentType || 'content'}\nCONTENT:\n${s.content}`
        ).join('\n\n---\n\n')
      : '';
    const legacyKnowledge = hasWorkerSlides
      ? knowledge.filter(k => !k.slides?.length).map(k => `[${k.source}]: ${typeof k.data === 'string' ? k.data : JSON.stringify(k.data)}`).join('\n\n')
      : '';

    let prompt;
    const isReport = !!this._reportMode;

    if (isReport) {
      // ─── REPORT MODE: compile into rich narrative text, not JSON ───
      // The compilation reviews quality and produces a full story following the agreed storyline.
      const researchBlock = hasWorkerSlides
        ? `WORKER FINDINGS (${workerSlides.length}):\n${workerSlideText}${legacyKnowledge ? `\n\nADDITIONAL RESEARCH:\n${legacyKnowledge}` : ''}`
        : `RESEARCH:\n${allKnowledgeText}`;

      prompt = `You are the engagement manager. Your team has completed their research. Your job is to REWRITE their findings into a single, comprehensive, publication-ready report narrative.

This is NOT a summary. This is a FULL REWRITE — restructuring all the research into a cohesive long-form report. Every data point, every statistic, every finding from the team MUST appear in your output. The output should be LONGER than the combined input research, not shorter.

TODAY: ${this._todayString()}
REQUIREMENTS: ${brief}
${mainMessage ? `GOVERNING THOUGHT: ${mainMessage}` : ''}
${narrativeType ? `NARRATIVE ARC: ${narrativeType}${narrativeFlow ? ` — ${narrativeFlow}` : ''}` : ''}

AGREED STRUCTURE (follow this exactly):
${JSON.stringify(sectionsJSON)}
${sectionGrouping ? `SECTION GROUPING:\n${sectionGrouping}\n` : ''}
${researchBlock}

WRITING INSTRUCTIONS:
1. Start with an EXECUTIVE SUMMARY (500-800 words):
   - Open with the governing thought as a bold statement
   - Summarize the 3-5 most important findings with their key numbers
   - Preview the report structure and what each section reveals
   - End with the strategic implication — the "so what"

2. For EACH SECTION (1000-2000+ words each):
   - Follow the EXACT section structure from the plan. Use the same section names as headers.
   - Open with the key insight for that section — the headline finding
   - Present ALL data from the research: every number, every percentage, every comparison, every trend
   - Organize data into clear sub-sections with bold sub-headers
   - Include bullet lists with specific data points where appropriate (e.g., "• Revenue: $4.2B (+23% YoY)")
   - Add tables in markdown format for comparative data
   - Provide "so what" analysis after each major data cluster — implications, not just facts
   - Weave in cross-references between sections where findings reinforce each other
   - Close each section with a mini-conclusion

3. End with a SYNTHESIS section:
   - Tie all findings back to the governing thought
   - Present the strategic implications as an ordered priority list
   - Include specific action items or recommendations grounded in the data

FORMAT:
Use markdown: # for main sections, ## for sub-sections, **bold** for emphasis, bullet lists for data, tables for comparisons.
This must be LONG — a full executive report with exhaustive data coverage.

CRITICAL RULES:
- Do NOT omit ANY data from the research. If the team found it, it goes in.
- Do NOT write vague statements like "significant growth" — use the exact numbers: "23% growth to $4.2B"
- Do NOT add placeholder text, [TBD], or [see analysis]
- Do NOT add meta-commentary about the report itself (no "this section examines..." — just examine it)
- Do NOT add terminology/glossary/appendix sections
- The output must be AT LEAST 3000 words. Longer is better. This is a premium consulting deliverable.

OUTPUT: Return ONLY the narrative text. No JSON wrapping. No code blocks. Just the report content.`;
    } else if (hasWorkerSlides) {
      // ─── SLIDE MERGE MODE: workers already produced slides, just order + fill gaps ───
      prompt = `You are the manager compiling the deck. Match the agreed plan and storyline.

TODAY: ${this._todayString()}
REQUIREMENTS: ${brief}
TARGET: ~${targetCount} body slides (the client asked for this — stay close, a few more or fewer is fine)
${mainMessage ? `MAIN MESSAGE: ${mainMessage}` : ''}

PLAN (your agreed structure — follow it):
${JSON.stringify(sectionsJSON)}
${sectionGrouping ? `GROUPING:\n${sectionGrouping}\n` : ''}
WORKER SLIDES (${workerSlides.length}):
${workerSlideText}
${legacyKnowledge ? `\nRESEARCH:\n${legacyKnowledge}` : ''}

YOUR JOB:
- Compile worker output into the agreed storyline.
- The plan sections are LOCKED. Use the EXACT section names from the plan — do NOT rename, merge, split, or invent new sections. Every slide's "section" field must be one of the plan section names verbatim.
- The executive summary slide is created AUTOMATICALLY from these section names + tracker labels. If you change section names, the exec summary and trackers will be wrong. This is the #1 rule.
- Stay close to ~${targetCount} body slides. Don't pad weak sections or cut rich ones to hit an exact number.
- You may move slides between sections or adjust emphasis, but the section names themselves are immutable.
- Fix contradictions between worker outputs. Remove redundant slides. Each slide builds on the previous.
- Every plan section must have at least one slide. Drop off-plan content.
- Do NOT add an executive summary slide — that is handled separately after compilation.
- Do NOT add section cover slides — those are added automatically for large sections.

SLIDE CONTENT FORMAT:
- "title" = short insight headline (not a label). "Cloud revenue tripled to $1.2B" not "Revenue Overview".
- "content" = the actual slide text as it will appear. Structure for slide format:
  - Key points → bullet lines with data. Comparisons → items with values. Metrics → numbers with labels.
  - No prose paragraphs or filler. Content density should match the configured work level.
- "section" = the plan section name this slide belongs to.

RULES:
- NO layout/design instructions ("use bar chart", "2-column", "[SHOW AS:]"). A separate system handles visuals.
- NO placeholders ("[insert data]", "[TBD]", "[see analysis]").
- Keep worker data intact — reorder to match plan, fill gaps from research.

Return JSON:
{"slides":[{"title":"...","keyMessage":"one sentence","content":"slide text with data","contentType":"summary|metrics|comparison|detail","section":"plan section name"}]}`;
    } else {
      // ─── SLIDE FULL COMPILE MODE: raw research, not pre-formed slides ───
      prompt = `You are the manager compiling the deck from research. Match the agreed plan and storyline.

TODAY: ${this._todayString()}
REQUIREMENTS: ${brief}
TARGET: ~${targetCount} body slides (the client asked for this — stay close, a few more or fewer is fine)
${mainMessage ? `MAIN MESSAGE: ${mainMessage}` : ''}

PLAN (your agreed structure — follow it):
${JSON.stringify(sectionsJSON)}
${sectionGrouping ? `GROUPING:\n${sectionGrouping}\n` : ''}
RESEARCH:
${allKnowledgeText}

YOUR JOB:
- Synthesize the research into the agreed storyline.
- The plan sections are LOCKED. Use the EXACT section names from the plan — do NOT rename, merge, split, or invent new sections. Every slide's "section" field must be one of the plan section names verbatim.
- The executive summary slide is created AUTOMATICALLY from these section names + tracker labels. If you change section names, the exec summary and trackers will be wrong. This is the #1 rule.
- Stay close to ~${targetCount} body slides. Don't pad weak sections or cut rich ones to hit an exact number.
- You may move slides between sections or adjust emphasis, but the section names themselves are immutable.
- Fix contradictions between research sources. Remove redundant content. Each slide builds on the previous.
- Every plan section must have at least one slide. Drop off-plan content.
- Do NOT add an executive summary slide — that is handled separately after compilation.
- Do NOT add section cover slides — those are added automatically for large sections.

SLIDE CONTENT FORMAT:
- "title" = short insight headline (not a label). "Cloud revenue tripled to $1.2B" not "Revenue Overview".
- "content" = the actual slide text as it will appear. Structure for slide format:
  - Key points → bullet lines with data. Comparisons → items with values. Metrics → numbers with labels.
  - No prose paragraphs or filler. Content density should match the configured work level.
- "section" = the plan section name this slide belongs to.

RULES:
- NO layout/design instructions ("use bar chart", "2-column", "[SHOW AS:]"). A separate system handles visuals.
- NO placeholders ("[insert data]", "[TBD]", "[see analysis]").
- Keep research data intact — reorder to match plan, fill gaps.

Return JSON:
{"slides":[{"title":"...","keyMessage":"one sentence","content":"slide text with data","contentType":"summary|metrics|comparison|detail","section":"plan section name"}]}`;
    }

    try {
      // Compilation is the MOST CRITICAL step — it produces the exact content the router/report receives.
      // Use the main/deep model (not fast) and allow enough tokens for full output.
      const settingsMax = this.settings?.maxTokens || 4096;
      const compileMaxTokens = isReport
        ? Math.max(settingsMax, 128000) // Reports need many tokens — full rewrite of all research
        : Math.max(settingsMax, (targetCount + 1) * 800); // ~800 tokens/slide

      if (isReport) {
        // Report mode: expect raw text, not JSON
        const result = await this._llm(`${this._mgr}: compiling team findings (1 credit)`, prompt, { useDeep: true, temperature: 0.3, maxTokens: compileMaxTokens, timeout: 180000, returnJSON: false });

        if (typeof result === 'string' && result.trim().length > 0) {
          this._compiledNarrative = result.trim();
          this._log(`Compiled narrative: ${this._compiledNarrative.length} characters`, 'manager', 'info');

          // Show preview in step UI
          const preview = this._compiledNarrative.slice(0, 500).replace(/\n/g, ' ') + '...';
          this._attachOutputToCurrentStep({
            task: 'Compile team findings into report narrative',
            worker: this._mgr,
            workerRole: 'manager',
            output: preview,
            insights: [],
            nextSteps: [],
          });

          this._trackAction('manager', 'compiled', `Compiled report narrative (${this._compiledNarrative.length} chars)`, {
            data: this._compiledNarrative.slice(0, 1000),
          });
        }
      } else {
        // Slide mode: expect JSON
        const result = await this._llm(`${this._mgr}: compiling team findings (1 credit)`, prompt, { useDeep: true, temperature: 0.2, maxTokens: compileMaxTokens, timeout: 180000 });

        if (result?.slides?.length > 0) {
          this._compiledSlides = result.slides;
          this._log(`Compiled ${result.slides.length} slide specs`, 'manager', 'info');

          const compiledOutput = result.slides.map((s, i) => {
            const cleanT = (s.title || '').replace(/^\d+[\.\)\-]\s*/, '').trim();
            return `${i + 1}. ${cleanT}\n   ↳ ${s.keyMessage}\n   [${s.contentType || 'content'}]`;
          }).join('\n\n');
          this._attachOutputToCurrentStep({
            task: 'Compile team findings',
            worker: this._mgr,
            workerRole: 'manager',
            output: compiledOutput,
            insights: [],
            nextSteps: [],
          });

          this._trackAction('manager', 'compiled', `Compiled ${result.slides.length} slide specs from team research`, {
            data: JSON.stringify(result.slides),
          });
        }
      }

      this._completeStep(`${this._mgr}: Findings compiled`, 'complete');
      return isReport ? this._compiledNarrative : { slides: this._compiledSlides };
    } catch (err) {
      this._log(`Compile failed: ${err.message}`, 'manager', 'error');
      this._completeStep('Compile failed — using fallback', 'error');
      return null;
    }
  }

  /**
   * Report Mode: generate an interactive HTML report instead of slides.
   * Uses the same research + plan but calls the report creator instead of the router.
   */
  async _generateReportOutput() {
    this._addStep(`${this._mgr}: Generating interactive report`, 'active', 'manager');
    this._setPhase(AgentPhase.READY, `${this._mgr}: Generating report...`);

    try {
      // Build per-worker structured research entries (full data, no truncation)
      const knowledgeEntries = (this.workspace.knowledge || []).map(k => {
        const data = typeof k.data === 'string' ? k.data : JSON.stringify(k.data);
        return {
          source: k.source || 'Research',
          data,
          summary: k.summary || '',
          gaps: k.gaps || '',
          recommendation: k.recommendation || '',
          dataPoints: k.dataPoints || [],
          themes: k.themes || [],
        };
      });

      // Legacy flat knowledge string (for HTML mode and backwards compat)
      const knowledge = knowledgeEntries.map(k => {
        let entry = `## ${k.source}\n${k.data}`;
        if (k.dataPoints?.length > 0) entry += `\nData points: ${k.dataPoints.join(' | ')}`;
        if (k.themes?.length > 0) entry += `\nThemes: ${k.themes.join(', ')}`;
        return entry;
      }).join('\n\n---\n\n');

      // Compiled narrative = manager's synthesis → becomes executive summary
      const plan = this.workspace.plan || {};
      const compiledNarrative = this._compiledNarrative || '';
      const compiledSlides = this._compiledSlides || [];

      // Build team activities from rich role activity log
      const teamActivities = Object.values(this.roleActivity).map(role => ({
        name: role.name,
        role: role.role,
        specialty: role.specialty || '',
        isManager: role.role === 'manager' || role.role === this._mgr,
        actions: (role.actions || []).map(a => ({
          type: a.type,
          description: a.description,
          briefedBy: a.briefedBy || null,
          briefedTo: a.briefedTo || null,
          timestamp: a.timestamp,
        })),
      }));

      const reportResult = await generateReport({
        plan: {
          ...plan,
          compiledNarrative,
          compiledSlides: compiledSlides.map(s => ({
            title: s.title || s.sectionTitle,
            keyMessage: s.keyMessage,
            section: s.section,
            contentType: s.contentType,
            instruction: s.instruction || s.content,
            dataPoints: s.dataPoints,
          })),
        },
        knowledge,
        knowledgeEntries,
        understanding: {
          topic: this.workspace.task,
          slideCount: this.workspace.scopeAssessment?.estimatedSlides,
          audience: plan.audience || this.workspace.plan?.audience,
          fullClientAsk: this.workspace.task,
          requirementsBrief: this._requirementsBrief,
          toneGuidance: plan.toneDirection || plan.tone,
          narrativeArc: plan.storylineType,
          narrativeFlow: plan.storylineFlow,
          governingThought: plan.mainMessage || plan.governingThought,
        },
        teamActivities,
        settings: this.settings,
        onProgress: (msg) => this._log(msg, 'manager', 'info'),
        onAiIO: (entry) => {
          this.aiIOLog.push(entry);
          this.callbacks.onAiIO?.(entry);
        },
      });

      if (reportResult.success) {
        this._completeStep(`Report generated: ${reportResult.title}`, 'complete');
        this._log(`Report generated: ${reportResult.title}`, 'manager', 'deliverable');
        this._setPhase(AgentPhase.READY, 'Complete');

        // Save to knowledge base — including the report HTML for visibility
        this._lastReportHTML = reportResult.html;
        this._saveEngagementToKB(compiledNarrative ? plan?.sections?.length || 0 : compiledSlides.length || plan?.sections?.length || 0);

        return {
          done: true,
          type: ResultType.DONE,
          success: true,
          summary: `Interactive report generated: ${reportResult.title}`,
          reportHTML: reportResult.html,
          output: this.workspace.getBestOutput(),
          thinkingLog: this.thinkingLog,
          aiIOLog: this.aiIOLog,
          budgetUsed: this.budgetUsed,
          budgetTotal: this.budgetTotal,
          iterations: this.iteration,
        };
      } else {
        this._completeStep('Report generation failed', 'error');
        this._log(`Report generation failed: ${reportResult.error}`, 'manager', 'error');
        return {
          done: true,
          type: ResultType.STUCK,
          success: false,
          reason: `Report generation failed: ${reportResult.error}`,
          output: this.workspace.getBestOutput(),
          thinkingLog: this.thinkingLog,
          aiIOLog: this.aiIOLog,
          budgetUsed: this.budgetUsed,
          budgetTotal: this.budgetTotal,
        };
      }
    } catch (error) {
      this._completeStep('Report generation error', 'error');
      this._log(`Report generation error: ${error.message}`, 'manager', 'error');
      return {
        done: true,
        type: ResultType.STUCK,
        success: false,
        reason: `Report generation error: ${error.message}`,
        output: this.workspace.getBestOutput(),
        thinkingLog: this.thinkingLog,
        aiIOLog: this.aiIOLog,
        budgetUsed: this.budgetUsed,
        budgetTotal: this.budgetTotal,
      };
    }
  }

  /**
   * Build presentation from compiled slide specs or fallback.
   * This is the FINISH LINE — after this, the agent is done.
   */
  async _buildFromCompiledContent() {
    const plan = this.workspace.plan;
    const compiled = this._compiledSlides;

    // Build slide instructions — prefer compiled specs, fallback to emergency compile
    let slideInstructions;
    if (compiled?.length > 0) {
      // ── The agent builds the FULL deck structure: exec summary, section covers, body slides ──
      const planSections = (plan?.sections || []).filter(s => s.sectionTitle);
      const hasTrackerSections = planSections.length >= 2;

      let outputIdx = 0;
      slideInstructions = [];

      // ── 1. Executive summary (created when plan has tracker sections) ──
      // ALWAYS built from plan sections — these are the source of truth for trackers.
      // If the compiler produced an exec summary, we still ignore its structure and
      // rebuild from plan sections (enriched with key messages from compiled slides).
      if (hasTrackerSections) {
        // Drop any compile-produced exec summary (we rebuild from plan)
        const compileOverviewIdx = compiled.findIndex((s) => {
          const ct = (s.contentType || '').toLowerCase();
          const tl = (s.title || '').toLowerCase();
          return ct === 'summary' || ct === 'executive-summary' || ct === 'executive_summary'
            || tl.includes('executive overview') || tl.includes('executive summary')
            || tl.includes('deck overview') || tl.includes('exec summary');
        });
        if (compileOverviewIdx >= 0) {
          this._log(`Dropping compile exec summary "${compiled[compileOverviewIdx].title}" — rebuilding from plan sections`, 'manager', 'info');
          compiled.splice(compileOverviewIdx, 1);
        }

        // Build exec summary items from plan sections (same names as trackers)
        // Enrich with key messages from the first compiled slide in each section
        const overviewItems = planSections.map((s, i) => {
          const title = s.sectionTitle || `Section ${i + 1}`;
          // Try to get a richer key message from the compiled body slides
          const matchedSlide = compiled.find(sl => (sl.section || '').trim() === title);
          const fullMsg = matchedSlide?.keyMessage || s.keyMessage || s.slides?.[0]?.keyMessage || '';
          const words = fullMsg.split(/\s+/);
          const msg = words.length > 12 ? words.slice(0, 12).join(' ') + '...' : fullMsg;
          return `${i + 1}. ${title}${msg ? ' — ' + msg : ''}`;
        }).join('\n');

        slideInstructions.push({
          instruction: `--- SLIDE 1: Executive Summary ---\nKey Message: ${plan?.mainMessage || 'Presentation overview'}\nInstruction: Show numbered boxes that preview the deck sections:\n${overviewItems}\nEach box = section number + title + one-line insight.`,
          sectionTracker: null,
          _sectionIndex: 0,
          _isExecOverview: true,
        });
        outputIdx = 1;
        this._log(`Exec summary from plan sections: ${planSections.length} items (matches trackers)`, 'manager', 'info');
      }

      // ── 2. Build body slides, dropping any remaining exec summary duplicates ──
      // (the primary compile exec summary was already spliced out above if it existed)
      const bodyCompiled = [...compiled].filter(s => {
          const ct = (s.contentType || '').toLowerCase();
          const tl = (s.title || '').toLowerCase();
          const isDupe = ct === 'executive-summary' || ct === 'executive_summary' || ct === 'executivesummary'
            || tl.includes('executive summary') || tl.includes('exec summary')
            || tl.includes('executive overview') || tl.includes('executive takeaway')
            || tl.includes('deck overview') || tl.includes('ceo summary');
          if (isDupe) this._log(`Dropping duplicate exec slide: "${s.title}"`, 'manager', 'info');
          return !isDupe;
        });

      // Build tracker labels from plan sections (source of truth) — compile section names
      // must match the plan exactly. If the LLM diverged, remap to plan sections.
      const sectionToTracker = new Map(); // section name → "N. Name"

      if (hasTrackerSections) {
        // Plan sections are the authority — build trackers from plan, then validate compiled slides
        const planSectionNames = planSections.map(s => (s.sectionTitle || '').trim()).filter(Boolean);
        planSectionNames.forEach((name, i) => {
          sectionToTracker.set(name, `${i + 1}. ${name}`);
        });

        // Remap compiled slide sections to plan sections (fix LLM divergence)
        const planNamesLower = planSectionNames.map(n => n.toLowerCase());
        for (const slide of bodyCompiled) {
          const sec = (slide.section || '').trim();
          if (!sec) continue;
          if (sectionToTracker.has(sec)) continue; // already matches plan — good
          // Try case-insensitive match
          const lowerSec = sec.toLowerCase();
          const exactIdx = planNamesLower.indexOf(lowerSec);
          if (exactIdx >= 0) {
            slide.section = planSectionNames[exactIdx];
            continue;
          }
          // Try substring match (plan name contained in compiled, or vice versa)
          const subIdx = planNamesLower.findIndex(pn => pn.includes(lowerSec) || lowerSec.includes(pn));
          if (subIdx >= 0) {
            this._log(`Section remap: "${sec}" → "${planSectionNames[subIdx]}" (substring match)`, 'manager', 'info');
            slide.section = planSectionNames[subIdx];
            continue;
          }
          // No match — assign to nearest plan section by slide position
          const slideIdx = bodyCompiled.indexOf(slide);
          const ratio = slideIdx / Math.max(bodyCompiled.length - 1, 1);
          const nearestIdx = Math.min(Math.round(ratio * (planSectionNames.length - 1)), planSectionNames.length - 1);
          this._log(`Section remap: "${sec}" → "${planSectionNames[nearestIdx]}" (positional fallback)`, 'manager', 'info');
          slide.section = planSectionNames[nearestIdx];
        }
      } else {
        // No plan sections — build trackers from whatever the compiler produced
        let trackerNum = 0;
        for (const slide of bodyCompiled) {
          const sec = (slide.section || '').trim();
          if (sec && !sectionToTracker.has(sec)) {
            trackerNum++;
            sectionToTracker.set(sec, `${trackerNum}. ${sec}`);
          }
        }
      }

      // Fallback: use positional tracker map if no sections at all
      const hasCompileSections = sectionToTracker.size >= 2;
      const positionalTrackerMap = hasCompileSections ? null : this._buildSectionTrackerMap(plan, bodyCompiled.length);

      const getTracker = (slide, idx) => {
        if (hasCompileSections) {
          const sec = (slide.section || '').trim();
          return sec ? sectionToTracker.get(sec) : null;
        }
        return positionalTrackerMap?.get(idx) || null;
      };

      // Track which sections have multiple slides (for section cover insertion)
      const sectionSlideCount = new Map();
      for (let ci = 0; ci < bodyCompiled.length; ci++) {
        const tracker = getTracker(bodyCompiled[ci], ci) || '';
        if (tracker) sectionSlideCount.set(tracker, (sectionSlideCount.get(tracker) || 0) + 1);
      }
      const sectionsNeedingCovers = new Set();
      for (const [tracker, count] of sectionSlideCount) {
        if (count >= 2) sectionsNeedingCovers.add(tracker);
      }
      const emittedSectionCovers = new Set();

      for (let bodyIdx = 0; bodyIdx < bodyCompiled.length; bodyIdx++) {
        const slide = bodyCompiled[bodyIdx];
        const cleanTitle = (slide.title || '').replace(/^\d+[\.\)\-]\s*/, '').trim();
        const slideType = slide.contentType || 'detail';

        const tracker = getTracker(slide, bodyIdx);
        const trackerTag = tracker ? `\n[TRACKER: ${tracker}]` : '';

        // ── 3. Section cover slide: when a section has 2+ slides, add a section intro ──
        if (tracker && sectionsNeedingCovers.has(tracker) && !emittedSectionCovers.has(tracker)) {
          emittedSectionCovers.add(tracker);
          const sectionNum = tracker.match(/^(\d+)\./)?.[1] || '';
          const planSection = planSections.find((s, i) => String(i + 1) === sectionNum) || planSections.find(s => tracker.includes(s.sectionTitle));
          const sectionMsg = planSection?.keyMessage || '';
          const sectionTitle = planSection?.sectionTitle || tracker.replace(/^\d+\.\s*/, '');
          const childTitles = [];
          for (let ci2 = bodyIdx; ci2 < bodyCompiled.length; ci2++) {
            if (getTracker(bodyCompiled[ci2], ci2) === tracker) {
              childTitles.push(bodyCompiled[ci2].title?.replace(/^\d+[\.\)\-]\s*/, '').trim() || '');
            }
          }
          const childList = childTitles.filter(Boolean).map((t, i) => `${i + 1}. ${t}`).join('\n');
          const coverContent = `${sectionTitle}${sectionMsg ? ': ' + sectionMsg : ''}\n\nIn this section:\n${childList}`;

          slideInstructions.push({
            instruction: `--- SLIDE ${outputIdx + 1}: ${sectionTitle} ---${trackerTag}\n[SUB_TRACKER: Overview]\nKey Message: ${sectionMsg || sectionTitle}\nInstruction: ${coverContent}`,
            sectionTracker: tracker || null,
            _sectionIndex: outputIdx,
          });
          outputIdx++;
        }

        // ── 4. Body slide: content IS the slide text ──
        // Markers (Key Message / Instruction) are required for router condensation parser
        // Sub-tracker must be concise (1-3 words) — truncate slide title to first few words
        const conciseSubLabel = cleanTitle.split(/\s+/).slice(0, 3).join(' ');
        const subTracker = (tracker && sectionsNeedingCovers.has(tracker)) ? `\n[SUB_TRACKER: ${conciseSubLabel}]` : '';
        slideInstructions.push({
          instruction: `--- SLIDE ${outputIdx + 1}: ${cleanTitle} ---${trackerTag}${subTracker}\nKey Message: ${slide.keyMessage || cleanTitle}\nInstruction: ${slide.content}`,
          sectionTracker: tracker || null,
          _sectionIndex: outputIdx,
        });
        outputIdx++;
      }
    } else {
      slideInstructions = this._emergencyCompileSlides();
    }

    // Log tracker assignment summary
    const trackerCounts = {};
    let untrackedCount = 0;
    for (const si of slideInstructions) {
      if (si._isExecOverview) continue;
      if (si.sectionTracker) {
        trackerCounts[si.sectionTracker] = (trackerCounts[si.sectionTracker] || 0) + 1;
      } else {
        untrackedCount++;
      }
    }
    if (Object.keys(trackerCounts).length > 0) {
      this._log(`Tracker assignment: ${Object.entries(trackerCounts).map(([t, c]) => `${t} (${c} slides)`).join(', ')}${untrackedCount ? ` + ${untrackedCount} untracked` : ''}`, 'manager', 'info');
    }

    // Sort by section number to ensure correct order (LLM may return out of order)
    slideInstructions = this._sortSlidesBySection(slideInstructions);

    if (slideInstructions.length === 0) {
      this._log('No slide content to build', 'manager', 'error');
      return {
        done: true,
        type: ResultType.STUCK,
        success: false,
        reason: 'No slide content compiled — nothing to build',
        output: this.workspace.getBestOutput(),
        thinkingLog: this.thinkingLog,
        aiIOLog: this.aiIOLog,
        budgetUsed: this.budgetUsed,
        budgetTotal: this.budgetTotal,
      };
    }

    // Spend 1 credit for the build call
    if (this._budgetRemaining() >= 1) {
      this._spend(1);
    }

    this._addStep(`Building presentation (${slideInstructions.length} slides)`, 'active', 'consultant');
    this._expandBatchSteps(slideInstructions);
    this._setPhase(AgentPhase.EXECUTING, `Building ${slideInstructions.length} slides...`);

    // Inject batch progress callback
    if (this.tools._batchProgress) {
      this.tools._batchProgress.fn = (slideIndex, total, status, routerPlan) => {
        this.markBatchSlideProgress(slideIndex, total, status, routerPlan);
      };
    }

    const buildTool = this.tools['build_presentation'];
    if (!buildTool) {
      return {
        done: true,
        type: ResultType.STUCK,
        success: false,
        reason: 'No build_presentation tool available',
        output: this.workspace.getBestOutput(),
        thinkingLog: this.thinkingLog,
        aiIOLog: this.aiIOLog,
        budgetUsed: this.budgetUsed,
        budgetTotal: this.budgetTotal,
      };
    }

    try {
      // Enrich title with requirements only — storyline/narrative context lives in
      // the executive summary (slide 1), not duplicated as abstract preamble metadata.
      const brief = this._requirementsBrief || '';
      const scope = this.workspace.scopeAssessment || {};
      const contextParts = [
        brief && `REQUIREMENTS: ${brief}`,
        scope.estimatedSlides && `TARGET SLIDES: ${scope.estimatedSlides}`,
      ].filter(Boolean).join('\n');
      const enrichedTitle = contextParts
        ? `${plan?.presentationTitle || this.workspace.task}\n\n${contextParts}`
        : plan?.presentationTitle || this.workspace.task;

      // Log what we're sending to the router
      const trackers = slideInstructions.map(s => s.sectionTracker).filter(Boolean);
      const uniqueTrackers = [...new Set(trackers)];
      const overviewCount = slideInstructions.filter(s => s._isExecOverview).length;
      const coverCount = slideInstructions.filter(s => !s._isExecOverview && s.instruction?.includes('[SUB_TRACKER: Overview]')).length;
      const bodyCount = slideInstructions.length - overviewCount - coverCount;
      this._log(`Sending to router: ${slideInstructions.length} slides (${overviewCount ? overviewCount + ' overview + ' : ''}${coverCount ? coverCount + ' section covers + ' : ''}${bodyCount} body), ${uniqueTrackers.length} sections`, 'manager', 'info');
      if (uniqueTrackers.length > 0) {
        this._log(`Sections: ${uniqueTrackers.join(', ')}`, 'manager', 'info');
      }

      const buildResult = await buildTool.execute({
        title: enrichedTitle,
        slides: slideInstructions,
      });

      if (this.tools._batchProgress) this.tools._batchProgress.fn = null;
      this._completeBatchSteps(buildResult);

      if (buildResult?.created > 0) {
        this.workspace.slidesCreated = buildResult.created;
        this._log(`Router built ${buildResult.created} slides`, 'manager', 'info');
        if (buildResult.routerPlanSummary) {
          this._log(`Router plan: ${buildResult.routerPlanSummary}`, 'manager', 'info');
        }
        // Capture router prompt and plan for engagement audit
        this._lastRouterPrompt = buildResult.routerPrompt || null;
        this._lastRouterPlan = buildResult.routerPlan || null;
        this._setPhase(AgentPhase.READY, 'Complete');

        // Save audit trail to KB
        this._saveEngagementToKB(buildResult.created);

        return {
          done: true,
          type: ResultType.DONE,
          success: true,
          summary: `Built ${buildResult.created} slides`,
          output: this.workspace.getBestOutput(),
          thinkingLog: this.thinkingLog,
          aiIOLog: this.aiIOLog,
          budgetUsed: this.budgetUsed,
          budgetTotal: this.budgetTotal,
          iterations: this.iteration,
        };
      }

      this._log('Build returned no slides', 'manager', 'error');
      return {
        done: true,
        type: ResultType.STUCK,
        success: false,
        reason: 'Build completed but created no slides',
        output: this.workspace.getBestOutput(),
        thinkingLog: this.thinkingLog,
        aiIOLog: this.aiIOLog,
        budgetUsed: this.budgetUsed,
        budgetTotal: this.budgetTotal,
      };
    } catch (error) {
      if (this.tools._batchProgress) this.tools._batchProgress.fn = null;
      this._log(`Build failed: ${error.message}`, 'manager', 'error');
      return {
        done: true,
        type: ResultType.STUCK,
        success: false,
        reason: `Build failed: ${error.message}`,
        output: this.workspace.getBestOutput(),
        thinkingLog: this.thinkingLog,
        aiIOLog: this.aiIOLog,
        budgetUsed: this.budgetUsed,
        budgetTotal: this.budgetTotal,
      };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  GUARDRAILS — Hard constraints, not reasoning
  // ═════════════════════════════════════════════════════════════════════════

  async _checkGuardrails() {
    // Budget hard stop
    if (this._budgetRemaining() <= 0) {
      this._log(`Budget exhausted (${this.budgetUsed}/${this.budgetTotal} credits used) — compiling best available output`, 'manager', 'info');
      return await this._bestAvailableOutput();
    }

    // Iteration limit
    if (this.iteration >= GUARDRAILS.MAX_ITERATIONS) {
      this._log(`Iteration limit reached (${GUARDRAILS.MAX_ITERATIONS})`);
      return await this._bestAvailableOutput();
    }

    // Loop detection
    const loopAction = this._detectStrictLoop();
    if (loopAction) {
      this._log(`Strict loop detected: ${loopAction} — forcing stuck`);
      return {
        done: true,
        type: ResultType.STUCK,
        success: false,
        reason: `Detected repeating loop (${loopAction}) with no progress`,
        output: this.workspace.getBestOutput(),
        thinkingLog: this.thinkingLog,
        aiIOLog: this.aiIOLog,
        budgetUsed: this.budgetUsed,
        budgetTotal: this.budgetTotal,
      };
    }

    return null; // No guardrail triggered
  }

  // ─── Detect if the same action repeats with no progress ──────────────
  _detectLoop() {
    const window = this.actionHistory.slice(-GUARDRAILS.LOOP_DETECTION_WINDOW);
    if (window.length < GUARDRAILS.LOOP_DETECTION_WINDOW) return null;

    // Check if all actions in the window are the same and none had progress
    const firstAction = `${window[0].action}:${window[0].tool || ''}`;
    const allSame = window.every(a => `${a.action}:${a.tool || ''}` === firstAction);
    const noneHadProgress = window.every(a => !a.hadProgress);

    if (allSame && noneHadProgress) {
      return `Same action "${firstAction}" repeated ${GUARDRAILS.LOOP_DETECTION_WINDOW} times with no progress. Try a different approach.`;
    }
    return null;
  }

  // Strict: same action 4+ times with no progress → force stop
  _detectStrictLoop() {
    const strictWindow = 4;
    const window = this.actionHistory.slice(-strictWindow);
    if (window.length < strictWindow) return null;

    const firstAction = `${window[0].action}:${window[0].tool || ''}`;
    const allSame = window.every(a => `${a.action}:${a.tool || ''}` === firstAction);
    const noneHadProgress = window.every(a => !a.hadProgress);

    if (allSame && noneHadProgress) return firstAction;
    return null;
  }

  // ─── Did this action produce meaningful progress? ────────────────────
  _actionHadProgress(decision, result) {
    if (!result) return false;
    if (result.pause || result.done) return true;
    if (result.success === false) return false;
    if (decision.action === Action.USE_TOOL) {
      // Slide creation is always progress
      if (['create_slide', 'create_slides_batch', 'edit_slide', 'build_presentation'].includes(decision.tool)) {
        return result.success !== false;
      }
      // Research/KB search is progress if it returned data
      if (['research_topic', 'search_knowledge_base', 'generate_benchmarks'].includes(decision.tool)) {
        return result.success !== false;
      }
    }
    if (decision.action === Action.THINK_MORE && decision.analysis) return true;
    if (decision.action === Action.REVIEW && decision.analysis) return true;
    if (decision.action === Action.REVISE && decision.analysis) return true;
    if (decision.action === Action.SCOPE) return true;   // Scoping always counts as progress
    if (decision.action === Action.STAFF_TEAM) return true; // Staffing always counts
    if (decision.action === Action.DELEGATE) return result.success !== false;
    return result.success !== false;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  BEST AVAILABLE OUTPUT — when we must stop (budget/guardrail)
  //  If knowledge exists but no slides, auto-compile and build FOR FREE.
  // ═════════════════════════════════════════════════════════════════════════
  async _bestAvailableOutput() {
    const output = this.workspace.getBestOutput();
    const hasSlides = this.workspace.slidesCreated > 0;
    const hasPlan = this.workspace.plan !== null;
    const hasTeam = this.workspace.team?.length > 0;
    const hasKnowledge = this.workspace.knowledge?.length > 0;

    // ── Emergency auto-build: compile knowledge → structured deck → router ──
    // If we have knowledge/research but no slides yet, compile and build for FREE
    if (!hasSlides && hasKnowledge) {
      try {
        this._log(`Budget exhausted (${this.budgetUsed}/${this.budgetTotal}) — auto-compiling team findings into slides`, 'manager', 'info');
        this._addStep('Auto-compiling findings into presentation', 'active', 'manager');
        this._setPhase(AgentPhase.EXECUTING, 'Compiling findings into slides...');

        // Build slide instructions from plan + knowledge, sorted by section order
        const slideInstructions = this._sortSlidesBySection(this._emergencyCompileSlides());

        if (slideInstructions.length > 0) {
          this._completeStep('Compiled findings', 'complete');
          this._addStep(`Building presentation (${slideInstructions.length} slides)`, 'active', 'consultant');
          this._setPhase(AgentPhase.EXECUTING, `Building ${slideInstructions.length} slides...`);

          // Call build_presentation directly — FREE (no budget charge)
          const buildTool = this.tools['build_presentation'];
          if (buildTool) {
            // Include narrative context even in emergency path
            const plan = this.workspace.plan;
            const emergencyContextParts = [
              plan?.mainMessage && `GOVERNING THOUGHT: ${plan.mainMessage}`,
              plan?.storylineType && `NARRATIVE APPROACH: ${plan.storylineType}`,
              plan?.storylineFlow && `STORYLINE FLOW: ${plan.storylineFlow}`,
            ].filter(Boolean).join('\n');
            const emergencyTitle = emergencyContextParts
              ? `${plan?.presentationTitle || this.workspace.task}\n\n${emergencyContextParts}`
              : plan?.presentationTitle || this.workspace.task;

            const buildResult = await buildTool.execute({
              title: emergencyTitle,
              slides: slideInstructions,
            });

            if (buildResult?.created > 0) {
              this.workspace.slidesCreated = buildResult.created;
              this._completeStep(`${buildResult.created} slides built`, 'complete');
              this._log(`Emergency build complete: ${buildResult.created} slides created`, 'manager', 'info');

              // Capture router prompt and plan for engagement audit
              this._lastRouterPrompt = buildResult.routerPrompt || null;
              this._lastRouterPlan = buildResult.routerPlan || null;

              // Save audit trail to KB (emergency build)
              this._saveEngagementToKB(buildResult.created);

              return {
                done: true,
                type: ResultType.DONE,
                success: true,
                summary: `Created ${buildResult.created} slides (auto-built from team research)`,
                output: this.workspace.getBestOutput(),
                canResume: true,
                thinkingLog: this.thinkingLog,
                aiIOLog: this.aiIOLog,
                budgetUsed: this.budgetUsed,
                budgetTotal: this.budgetTotal,
                iterations: this.iteration,
              };
            } else {
              this._completeStep('Build failed — no slides created', 'error');
            }
          }
        }
      } catch (err) {
        this._log(`Auto-build failed: ${err.message}`, 'manager', 'error');
        // Clean up any dangling active steps from the failed auto-build
        for (const s of this.steps) {
          if (s.status === 'active') {
            s.status = 'error';
            s.summary = 'Auto-build failed';
            if (s.logEndIdx == null) s.logEndIdx = this.thinkingLog.length;
          }
        }
        this._emitProgress();
      }
    }

    // Build a clear status of where we stopped
    const progressParts = [];
    if (hasPlan) progressParts.push('plan approved');
    if (hasTeam) progressParts.push(`${this.workspace.team.length} team members staffed`);
    if (hasKnowledge) progressParts.push(`${this.workspace.knowledge.length} research items collected`);
    if (hasSlides) progressParts.push(`${this.workspace.slidesCreated} slides created`);
    const progressSummary = progressParts.length > 0 ? progressParts.join(', ') : 'scoping phase';

    this._setPhase(AgentPhase.READY, 'Budget reached — say "continue" to add more credits');

    // Log where we stopped so it's visible in the UI steps
    this._log(`Budget reached (${this.budgetUsed}/${this.budgetTotal} used). Progress: ${progressSummary}. Say "continue" to add credits and keep going.`, 'manager', 'info');

    return {
      done: true,
      type: hasSlides ? ResultType.DONE : ResultType.BUDGET_EXHAUSTED,
      success: hasSlides,
      summary: hasSlides
        ? `Created ${this.workspace.slidesCreated} slides (budget reached)`
        : `Budget reached during ${progressSummary}. Say "continue" to add credits and keep going.`,
      output,
      canResume: true,
      thinkingLog: this.thinkingLog,
      aiIOLog: this.aiIOLog,
      budgetUsed: this.budgetUsed,
      budgetTotal: this.budgetTotal,
      iterations: this.iteration,
    };
  }

  // ── Build deck context for workers — storyline, section structure, narrative arc ──
  // Workers need to know the overall deck to produce research that fits the narrative.
  _buildWorkerDeckContext() {
    const plan = this.workspace.plan;
    if (!plan) {
      // No plan yet — just provide scope info
      const scope = this.workspace.scopeAssessment;
      if (!scope) return '';
      return `DECK CONTEXT:\n~${scope.estimatedSlides || '?'} slides, ${scope.complexity || 'unknown'} complexity\n`;
    }

    const sections = plan.sections || [];
    // Build section list — show hierarchical structure if available
    const sectionLines = [];
    let slideCount = 0;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const title = s.sectionTitle || s.title || '';
      if (s.slides?.length > 0) {
        sectionLines.push(`  ${i + 1}. "${title}" — ${s.keyMessage || '(no key message yet)'}`);
        for (const sl of s.slides) {
          slideCount++;
          sectionLines.push(`     - "${sl.title || ''}" — ${sl.keyMessage || ''}`);
        }
      } else {
        slideCount++;
        sectionLines.push(`  ${i + 1}. "${title}" — ${s.keyMessage || '(no key message yet)'}`);
      }
    }

    return `DECK CONTEXT:
Title: "${plan.presentationTitle || ''}"
Main message: ${plan.mainMessage || '(none)'}
Narrative approach: ${plan.storylineType || '(not set)'}
${plan.storylineFlow ? `Flow: ${plan.storylineFlow}` : ''}
Sections (${sections.length} themes, ${slideCount || sections.length} slides):
${sectionLines.join('\n')}

Your research should support one or more of these sections. Focus on data and insights that advance the deck's main message.`;
  }

  // ── Build section tracker map from plan's grouped sections ──
  // Returns a Map where key = slide index (0-based), value = "N. Section Name".
  // Multiple slides share the same tracker label when they belong to the same section group.
  _buildSectionTrackerMap(plan, totalSlides) {
    const trackerMap = new Map();
    if (!plan) return trackerMap;

    // Helper: fill unmapped slide indices by extending the nearest tracker
    const fillGaps = (map, count) => {
      if (!count || count <= 0 || map.size === 0) return map;
      let lastLabel = null;
      for (let i = 0; i < count; i++) {
        if (map.has(i)) { lastLabel = map.get(i); }
        else if (lastLabel) { map.set(i, lastLabel); }
      }
      return map;
    };

    // Source 1: _planSections from consulting team agent (has slideNums)
    const planSections = plan._planSections || [];
    if (planSections.length >= 2) {
      planSections.forEach((ps, sIdx) => {
        const label = `${sIdx + 1}. ${(ps.name || '').replace(/^\d+[\.\)\-]\s*/, '').trim()}`;
        for (const slideNum of (ps.slideNums || [])) {
          // slideNum is 1-based, map to 0-based index
          trackerMap.set(slideNum - 1, label);
        }
      });
      return fillGaps(trackerMap, totalSlides);
    }

    // Source 2: hierarchical sections with .slides arrays (from genericAgent present_plan)
    const sections = plan.sections || [];
    const hasChildSlides = sections.some(s => s.slides?.length > 0);
    // Accept if: at least 2 sections, has child slides, and average slides/section > 1
    // (avoids treating degenerate 1-slide-per-section as hierarchical)
    const totalChildSlides = sections.reduce((sum, s) => sum + (s.slides?.length || 0), 0);
    const avgSlidesPerSection = sections.length > 0 ? totalChildSlides / sections.length : 0;
    if (hasChildSlides && sections.length >= 2 && avgSlidesPerSection > 1) {
      let slideIdx = 0;
      sections.forEach((sec, sIdx) => {
        const sectionName = (sec.sectionTitle || sec.title || '').replace(/^\d+[\.\)\-]\s*/, '').trim();
        const label = `${sIdx + 1}. ${sectionName}`;
        if (sec.slides?.length > 0) {
          for (const sl of sec.slides) {
            trackerMap.set(slideIdx, label);
            slideIdx++;
          }
        } else {
          trackerMap.set(slideIdx, label);
          slideIdx++;
        }
      });
      return fillGaps(trackerMap, totalSlides);
    }

    // Source 3: flat sections with .section field (from content builder)
    // Group by section name to create shared trackers
    const sectionNames = new Map(); // section name → tracker label
    let sectionIdx = 0;
    sections.forEach((sec, i) => {
      const sName = (sec.section || '').trim();
      if (sName && sec.slideRole !== 'opening' && sec.slideRole !== 'closing') {
        if (!sectionNames.has(sName)) {
          sectionIdx++;
          sectionNames.set(sName, `${sectionIdx}. ${sName}`);
        }
        trackerMap.set(i, sectionNames.get(sName));
      }
    });

    if (trackerMap.size > 0) return fillGaps(trackerMap, totalSlides);

    // Source 4 (fallback): flat sections with no .section field
    // Distribute sections across the total slide count (from compiled output or plan).
    // When totalSlides > sections.length, multiple slides share each section's tracker.
    const bodySlides = sections.filter(s => s.slideRole !== 'opening' && s.slideRole !== 'closing');
    if (bodySlides.length < 3 && sections.length < 3) return trackerMap; // tiny deck — no trackers

    const slideCount = totalSlides || sections.length;

    if (sections.length <= 5) {
      // ≤5 sections: each section is its own tracker (exec summary can handle 2-5 items)
      // Distribute slides evenly across sections
      const slidesPerSection = slideCount / sections.length;
      for (let si = 0; si < slideCount; si++) {
        const sectionIdx = Math.min(Math.floor(si / slidesPerSection), sections.length - 1);
        const sec = sections[sectionIdx];
        const name = (sec.sectionTitle || sec.title || `Section ${sectionIdx + 1}`).replace(/^\d+[\.\)\-]\s*/, '').trim();
        trackerMap.set(si, `${sectionIdx + 1}. ${name}`);
      }
    } else {
      // 6+ sections: group into 2-5 theme groups, then distribute slides across groups
      const groupCount = Math.min(Math.max(2, Math.ceil(sections.length / 3)), 5);
      const sectionsPerGroup = Math.ceil(sections.length / groupCount);

      // Build group labels from section names
      const groupLabels = [];
      for (let g = 0; g < groupCount; g++) {
        const firstInGroup = sections[g * sectionsPerGroup];
        const groupName = (firstInGroup?.sectionTitle || firstInGroup?.title || `Section ${g + 1}`).replace(/^\d+[\.\)\-]\s*/, '').trim();
        groupLabels.push(`${g + 1}. ${groupName}`);
      }

      // Distribute slides across groups proportionally
      const slidesPerSection = slideCount / sections.length;
      for (let si = 0; si < slideCount; si++) {
        const sectionIdx = Math.min(Math.floor(si / slidesPerSection), sections.length - 1);
        const groupIdx = Math.min(Math.floor(sectionIdx / sectionsPerGroup), groupCount - 1);
        trackerMap.set(si, groupLabels[groupIdx]);
      }
    }

    return trackerMap;
  }

  // ── Sort slides by section number extracted from sectionTracker ──
  // Handles formats like "1. Title", "Section 3: Title", or falls back to _sectionIndex/order.
  _sortSlidesBySection(slideInstructions) {
    if (!slideInstructions || slideInstructions.length <= 1) return slideInstructions;

    // Also match against plan section order for authoritative ordering
    const planSections = (this.workspace.plan?.sections || []).map(s =>
      (s.sectionTitle || s.title || '').toLowerCase().trim()
    );

    return [...slideInstructions].sort((a, b) => {
      // Executive summary always stays at position 0
      if (a._isExecOverview) return -1;
      if (b._isExecOverview) return 1;
      const numA = this._extractSectionNumber(a.sectionTracker, planSections);
      const numB = this._extractSectionNumber(b.sectionTracker, planSections);
      if (numA !== numB) return numA - numB;
      // Fallback to original index
      return (a._sectionIndex || 0) - (b._sectionIndex || 0);
    });
  }

  _extractSectionNumber(tracker, planSections) {
    if (!tracker) return 999;
    // Try to extract leading number: "1. Title", "3: Title", "Section 2 —"
    const numMatch = tracker.match(/^(\d+)[.\s:—\-–]/);
    if (numMatch) return parseInt(numMatch[1], 10);
    // Try to match against plan section order (exact first, then substring)
    const lowerTracker = tracker.toLowerCase().trim();
    let planIdx = planSections.findIndex(s => s === lowerTracker);
    if (planIdx >= 0) return planIdx + 1;
    planIdx = planSections.findIndex(s => lowerTracker.includes(s) || s.includes(lowerTracker));
    if (planIdx >= 0) return planIdx + 1;
    return 999;
  }

  // ── Save full audit trail to knowledge base after successful build ──
  _saveEngagementToKB(slideCount) {
    try {
      const plan = this.workspace.plan;
      const scope = this.workspace.scopeAssessment;
      const knowledge = this.workspace.knowledge || [];
      const team = this.workspace.team || [];

      // Build consultant outputs from knowledge entries
      const consultantOutputs = knowledge.map(k => ({
        title: k.source || 'Research',
        findings: typeof k.data === 'string' ? k.data : JSON.stringify(k.data),
        insights: k.insights || [],
        confidence: k.confidence || 'medium',
        source: k.source || 'agent',
      }));

      // Build final structure from plan + compiled slides
      const finalStructure = plan ? {
        presentationTitle: plan.presentationTitle,
        mainMessage: plan.mainMessage,
        storylineType: plan.storylineType,
        sections: (this._compiledSlides || plan.sections || []).map(s => ({
          sectionTitle: s.title || s.sectionTitle,
          keyMessage: s.keyMessage || '',
          contentType: s.contentType || '',
        })),
      } : null;

      // Build work packages from team execution
      const workPackages = team.map(m => ({
        title: `${m.name} (${m.role})`,
        tasks: m.specialty || '',
        forSlides: [],
        needsSearch: false,
      }));

      // Extract audience/purpose from requirementsBrief if available
      const brief = this._requirementsBrief || '';

      // Capture the exact router input (slide instructions sent to build_presentation)
      const routerInput = (this._compiledSlides || []).map((s, i) => ({
        index: i + 1,
        title: (s.title || '').replace(/^\d+[\.\)\-]\s*/, '').trim(),
        keyMessage: s.keyMessage || '',
        contentType: s.contentType || '',
        content: s.content || '',
      }));

      // Capture the EXACT prompt sent to the router (the full combinedPrompt)
      // and the router's template selection plan
      const routerPrompt = this._lastRouterPrompt || null;
      const routerPlan = this._lastRouterPlan || null;

      saveEngagement({
        topic: plan?.presentationTitle || this.workspace.task,
        request: brief || this.workspace.task,
        scoping: scope ? {
          topic: scope.topic || this.workspace.task,
          complexity: scope.complexity,
          audience: scope.audience || '',
          purpose: scope.purpose || brief,
          needsSearch: !!scope.needsSearch,
          keyQuestions: scope.keyQuestions || [],
          toneGuidance: scope.toneGuidance || '',
        } : null,
        storylineDirection: plan ? {
          archetypeName: plan.storylineType || '',
          governingThought: plan.mainMessage || '',
          bullets: (plan.sections || []).map(s => ({
            title: s.sectionTitle || s.title || '',
            intent: s.keyMessage || '',
          })),
          toneDirection: plan.toneDirection || '',
        } : null,
        detailedPlan: plan ? {
          totalSlides: slideCount,
          workPackages,
          selfHandled: [],
        } : null,
        consultantOutputs,
        finalStructure,
        routerInput, // Exact slide instructions sent to the router/build_presentation
        routerPrompt, // The FULL prompt string sent to aiRouteRequest (combinedPrompt)
        routerPlan, // Router's template selection for each slide [{templateId, instruction, sectionTracker}]
        thinkingLog: this.thinkingLog, // Full audit trail — no truncation
        aiIOLog: this.aiIOLog, // All LLM input/output exchanges
        budget: { total: this.budgetTotal, used: this.budgetUsed },
        reportHTML: this._lastReportHTML || null, // Report HTML if report mode
      });

      this._log(`Engagement saved to knowledge base (${slideCount} slides)`, 'manager', 'info');
    } catch (err) {
      this._log(`Failed to save engagement to KB: ${err.message}`, 'manager', 'error');
    }
  }

  // ── Emergency slide compilation: turn plan + knowledge into concise build instructions ──
  // Requirements/target context is already in enrichedTitle — do NOT repeat per slide.
  // May produce an executiveSummary as slide 1 when sections exist.
  _emergencyCompileSlides() {
    const plan = this.workspace.plan;
    const knowledge = this.workspace.knowledge || [];

    // ── Prefer worker-produced slides if available (richer than truncated knowledge text) ──
    const workerSlides = [];
    for (const k of knowledge) {
      if (k.slides?.length > 0) {
        for (const s of k.slides) workerSlides.push(s);
      }
    }

    // Build per-knowledge-item text blocks — preserve full content (no truncation)
    const knowledgeItems = knowledge.map(k => {
      const data = typeof k.data === 'string' ? k.data : JSON.stringify(k.data);
      return { source: k.source || '', data, text: `[${k.source}]: ${data}` };
    });

    // If we have a plan with sections, create slide instructions
    if (plan?.sections?.length > 0) {
      // Expand hierarchical sections (with child .slides) into individual slide instructions
      const hasChildSlides = plan.sections.some(s => s.slides?.length > 0);
      const flatSlides = [];
      if (hasChildSlides) {
        for (const section of plan.sections) {
          if (section.slides?.length > 0) {
            for (const sl of section.slides) {
              flatSlides.push({
                title: sl.title || sl.sectionTitle || section.sectionTitle || '',
                keyMessage: sl.keyMessage || section.keyMessage || '',
                contentType: sl.contentType || section.contentType || '',
                section: section.sectionTitle || section.title || '',
              });
            }
          } else {
            flatSlides.push({
              title: section.sectionTitle || section.title || '',
              keyMessage: section.keyMessage || '',
              contentType: section.contentType || '',
              section: '',
            });
          }
        }
      } else {
        for (const section of plan.sections) {
          flatSlides.push({
            title: section.sectionTitle || section.title || '',
            keyMessage: section.keyMessage || '',
            contentType: section.contentType || '',
            section: '',
          });
        }
      }

      // Use the tracker map for consistent section grouping
      const sectionTrackerMap = this._buildSectionTrackerMap(plan, flatSlides.length);

      // ── Slide 1: Executive Summary (when sections exist) ──
      const planSections = (plan.sections || []).filter(s => s.sectionTitle);
      const overviewItems = planSections.map((s, i) => {
        const title = s.sectionTitle || `Section ${i + 1}`;
        const msg = s.keyMessage || s.slides?.[0]?.keyMessage || '';
        const shortMsg = msg.split(/\s+/).slice(0, 12).join(' ');
        return `${i + 1}. ${title}${shortMsg ? ' — ' + shortMsg : ''}`;
      }).join('\n');

      const slideInstructions = [];
      slideInstructions.push({
        instruction: `--- SLIDE 1: Executive Summary ---\nKey Message: ${plan.mainMessage || 'Presentation overview'}\nInstruction: Executive summary of this deck. Show numbered boxes:\n${overviewItems}\nEach box = section number + title + one-line insight.`,
        sectionTracker: null,
        _isExecOverview: true,
      });

      // ── Body slides: use worker-produced content when available, fall back to knowledge matching ──
      for (let i = 0; i < flatSlides.length; i++) {
        const slide = flatSlides[i];
        const sectionTitle = slide.title || `Slide ${i + 1}`;
        const keyMessage = slide.keyMessage || '';
        const contentType = slide.contentType || '';
        const cleanTitle = sectionTitle.replace(/^\d+[\.\)\-]\s*/, '').trim();
        const ct = contentType || 'detail';
        const tracker = sectionTrackerMap.get(i);
        const trackerTag = tracker ? `\n[TRACKER: ${tracker}]` : '';
        const outputIdx = slideInstructions.length; // +1 for exec summary

        // Try to find a matching worker slide (by title similarity)
        const titleLower = cleanTitle.toLowerCase();
        const matchingWorkerSlide = workerSlides.find(ws => {
          const wsTitle = (ws.title || '').toLowerCase();
          return wsTitle && (titleLower.includes(wsTitle) || wsTitle.includes(titleLower)
            || titleLower.split(/\s+/).filter(w => w.length > 3).some(w => wsTitle.includes(w)));
        });

        let instructionContent;
        if (matchingWorkerSlide?.content) {
          // Use worker's actual slide content — it has real data
          instructionContent = matchingWorkerSlide.content;
        } else {
          // Fall back to knowledge matching
          const sectionWords = `${sectionTitle} ${keyMessage} ${contentType}`.toLowerCase().split(/\W+/).filter(w => w.length > 3);
          const relevant = knowledgeItems.filter(k => {
            const kLower = `${k.source} ${k.data}`.toLowerCase();
            return sectionWords.some(w => kLower.includes(w));
          });
          const MAX_ITEMS = this.settings?.limitSlideInstructionItems || 5;
          instructionContent = relevant.length > 0
            ? relevant.slice(0, MAX_ITEMS).map(k => k.text).join('\n')
            : knowledgeItems.slice(0, MAX_ITEMS).map(k => k.text).join('\n');
        }

        const instruction = [
          `--- SLIDE ${outputIdx + 1}: ${cleanTitle} ---${trackerTag}`,
          keyMessage && `Key Message: ${keyMessage}`,
          instructionContent && `Instruction: ${instructionContent}`,
        ].filter(Boolean).join('\n');

        slideInstructions.push({
          instruction,
          sectionTracker: tracker || null,
        });
      }

      return slideInstructions;
    }

    // No plan sections — create a single comprehensive slide instruction
    const fallbackItems = this.settings?.limitFallbackKnowledgeItems || 12;
    const allKnowledge = knowledgeItems.slice(0, fallbackItems).map(k => k.text).join('\n');
    if (allKnowledge.length > 0) {
      return [{
        instruction: `--- SLIDE 1: Overview ---\nKey Message: Presentation overview\nInstruction: Create a presentation about "${this.workspace.task}".\n\nData:\n${allKnowledge}`,
      }];
    }

    return [];
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  LLM CALL WRAPPER
  // ═════════════════════════════════════════════════════════════════════════
  // Map purpose string → roleSettings key for per-role overrides
  _resolveRoleKey(purpose) {
    const p = purpose.toLowerCase();
    if (p.includes('deciding') || p.includes('scope') || p.includes('scop'))   return 'managerScope';
    if (p.includes('plan'))                                                     return 'managerPlanning';
    if (p.includes('compil') || p.includes('merg'))                            return 'managerCompiling';
    if (p.includes('review') || p.includes('quality'))                         return 'managerReviewing';
    if (p.includes('research') || p.includes('search'))                        return 'consultantResearching';
    if (p.includes('analyz') || p.includes('synthe'))                          return 'consultantAnalyzing';
    // Worker tasks → consultantResearching
    if (p.includes(':'))                                                        return 'consultantResearching';
    return 'managerScope';
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

  async _llm(purpose, prompt, opts = {}) {
    if (this.isAborted) throw new Error('Aborted');

    const callStartTime = Date.now();
    const roleKey = this._resolveRoleKey(purpose);

    const modelSettings = opts.useDeep
      ? (this.settings.deepAnalysisModel ? { ...this.settings, model: this.settings.deepAnalysisModel } : { ...this.settings })
      : (this.settings.fastModel ? { ...this.settings, model: this.settings.fastModel } : { ...this.settings });

    const callOpts = {
      systemPrompt: opts.returnJSON === false
        ? 'You are an autonomous agent.'
        : 'You are an autonomous agent. Return valid JSON only. No markdown wrapping.',
      returnJSON: opts.returnJSON !== false,
      temperature: opts.temperature ?? 0.3,
      maxTokens: opts.maxTokens || this.settings?.maxTokens || 4096,
      reasoningEffort: opts.reasoningEffort || this.settings?.reasoningEffort || undefined,
    };

    // Apply per-role overrides
    this._applyRoleOverrides(modelSettings, callOpts, roleKey);

    const modelName = modelSettings.model || 'default';
    const auditRole = `agent:${roleKey}`;
    this._log(purpose);

    const inputLen = typeof prompt === 'string' ? prompt.length : JSON.stringify(prompt).length;

    // Heartbeat for long calls
    let heartbeatCount = 0;
    const heartbeat = setInterval(() => {
      if (this.isAborted) { clearInterval(heartbeat); return; }
      heartbeatCount++;
      const msgs = [
        `Processing ${purpose}...`,
        `Still working on ${purpose}...`,
        `Generating content...`,
        `Finishing up...`,
      ];
      this._log(msgs[(heartbeatCount - 1) % msgs.length]);
    }, 8000);

    // Retry with backoff: immediate → 1s → 3s
    const delays = [0, 1000, 3000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (attempt > 0) {
        this._log(`Retry ${attempt}/2...`);
        audit(auditRole, `retry #${attempt}`, { model: modelName, context: purpose, status: 'retry' });
        await new Promise(r => setTimeout(r, delays[attempt]));
        if (this.isAborted) { clearInterval(heartbeat); throw new Error('Aborted'); }
      }

      try {
        const timeoutMs = opts.timeout || 360000;
        let result;
        try {
          result = await Promise.race([
            agentChat(prompt, modelSettings, callOpts),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`LLM timeout after ${timeoutMs / 1000}s`)), timeoutMs)
            ),
          ]);
        } finally {
          clearInterval(heartbeat);
        }

        if (this.isAborted) throw new Error('Aborted');

        // Record I/O
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
          temperature: callOpts.temperature,
          searchEnabled: !!modelSettings.searchEnabled,
          useDeep: !!opts.useDeep,
          timeout: opts.timeout || 360000,
          skillsInjected: this.skills?.length || 0,
          skillNames: this.skills?.map(s => s.name) || [],
        };
        this.aiIOLog.push(ioEntry);
        this.callbacks.onAiIO?.(ioEntry);

        // Audit log — include actual API request params
        const actualParams = agentChat._lastRequestParams || {};
        audit(auditRole, `called ${describeModel(modelName)}`, {
          model: modelName,
          query: purpose,
          context: `genericAgent._llm | ${roleKey} | ${purpose}`,
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

        if (result !== null && result !== undefined) {
          // Flag effectively-empty responses (parsed JSON with no useful content)
          const isEmpty = typeof result === 'object'
            && (!result.slides || result.slides.length === 0)
            && !result.output && !result.summary && !result.action
            && !result.assessment && !result.analysis;
          if (isEmpty && attempt < delays.length - 1) {
            this._log(`${purpose}: LLM returned empty/unusable JSON — retrying (attempt ${attempt + 1})`, 'manager', 'warn');
            continue;
          }
          if (isEmpty) {
            this._log(`${purpose}: LLM returned empty/unusable JSON after ${attempt + 1} attempts`, 'manager', 'error');
          }
          return result;
        }

        // Null/undefined response
        if (attempt < delays.length - 1) {
          this._log(`${purpose}: null response — retrying (attempt ${attempt + 1})`, 'manager', 'warn');
          continue;
        }
        this._log(`${purpose}: null response after ${delays.length} attempts`, 'manager', 'error');
        return null;

      } catch (err) {
        clearInterval(heartbeat);
        if (this.isAborted) throw new Error('Aborted');

        const duration = Date.now() - callStartTime;

        // Record failed I/O
        this.aiIOLog.push({
          step: `${purpose} (FAILED)`,
          output: `ERROR: ${err.message}`,
          timestamp: new Date().toISOString(),
          duration,
          attempt: attempt + 1,
          error: true,
        });

        // Audit error
        audit(auditRole, `FAILED ${describeModel(modelName)}`, {
          model: modelName,
          query: purpose,
          context: `genericAgent._llm | ${roleKey} | ${purpose}`,
          maxTokens: callOpts.maxTokens,
          duration,
          status: 'error',
          error: err.message,
        });

        // Context too large — trim and retry
        if (err.message?.includes('too large') || err.message?.includes('context length') || err.message?.includes('token')) {
          this._log('Context too large — trimming');
          prompt = typeof prompt === 'string' ? prompt.slice(0, Math.floor(prompt.length * 0.7)) : prompt;
          if (attempt < delays.length - 1) continue;
        }

        if (attempt < delays.length - 1) {
          this._log(`Error: ${err.message} — retrying`);
          continue;
        }

        this._log(`Failed after ${delays.length} attempts: ${err.message}`);
        throw err;
      }
    }
    return null;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  BUDGET
  // ═════════════════════════════════════════════════════════════════════════
  _budgetRemaining() { return this.budgetTotal - this.budgetUsed; }

  _spend(credits = 1) {
    this.budgetUsed += credits;
    this._emitProgress();
  }

  // ─── Extend budget (e.g., on revision) ───────────────────────────────
  extendBudget(credits) {
    this.budgetTotal += credits;
    this._log(`Budget extended by ${credits} → ${this.budgetTotal}`);
  }

  // (Ghost phase-guessing methods removed — steps now only created for real actions)

  // ═════════════════════════════════════════════════════════════════════════
  //  UI HELPERS — Phase, Steps, Logging
  // ═════════════════════════════════════════════════════════════════════════

  // Central progress emission — always includes roleActivity
  _emitProgress(overrides = {}) {
    const unansweredQuestions = this._pendingQuestions?.filter(q => !q.answered) || [];
    this.callbacks.onProgress?.({
      phase: this.phase,
      steps: this.steps,
      budget: this.getBudgetInfo(),
      team: this.staffedTeam || null,
      roleActivity: this.getRoleActivity(),
      pendingQuestions: unansweredQuestions.length > 0 ? unansweredQuestions : undefined,
      liveInputCount: this._inputQueue?.length || 0,
      ...overrides,
    });
  }

  _setPhase(phase, message) {
    this.phase = phase;
    this.phaseMessage = message;
    this.callbacks.onPhaseChange?.(phase, message);
    this._emitProgress({ phase, message });
  }

  _setManagerThinkingStep(name) {
    // Remove any existing manager decision step
    this.steps = this.steps.filter(s => !s.managerThinking);
    // Mark previous active steps as complete
    for (const s of this.steps) {
      if (s.status === 'active') {
        s.status = 'complete';
        if (s.logEndIdx == null) s.logEndIdx = this.thinkingLog.length;
      }
    }
    // Add the manager's decision step — replaced by the action step once decided
    this.steps.push({ name, status: 'active', role: 'manager', managerThinking: true, logStartIdx: this.thinkingLog.length });
    this._emitProgress();
  }

  _addStep(name, status = 'active', role = 'agent') {
    // Remove temporary manager decision steps (they served as placeholders)
    this.steps = this.steps.filter(s => !s.managerThinking);
    // Mark previous active steps as complete and snapshot their log range
    for (const s of this.steps) {
      if (s.status === 'active') {
        s.status = 'complete';
        if (s.logEndIdx == null) s.logEndIdx = this.thinkingLog.length;
      }
    }
    // Check for a pending planned step to activate (from workPlan)
    // Skip parallel steps — those are reserved for _executeDelegateParallel
    const nextPending = this.steps.find(s => s.status === 'pending' && s.planned && !s.parallel);
    if (nextPending) {
      nextPending.status = status;
      nextPending.name = name;
      nextPending.role = role;
      nextPending.logStartIdx = this.thinkingLog.length;
    } else {
      this.steps.push({ name, status, role, logStartIdx: this.thinkingLog.length });
    }
    this._emitProgress();
  }

  _updateSteps(steps) {
    this.steps = steps;
    this._emitProgress();
  }

  _completeStep(summary, status = 'complete', cost = 0) {
    // Find the last active step (may not be at the end if planned steps exist after it)
    let activeStep = null;
    for (let i = this.steps.length - 1; i >= 0; i--) {
      if (this.steps[i].status === 'active') {
        activeStep = this.steps[i];
        break;
      }
    }
    if (activeStep) {
      activeStep.status = status;
      activeStep.summary = summary;
      activeStep.logEndIdx = this.thinkingLog.length;
      if (cost > 0) activeStep.cost = cost;
      this._emitProgress();
    }
  }

  // ─── Batch step expansion for create_slides_batch ────────────────────
  // Pre-populate individual numbered slide steps so the UI shows "Slide 1", "Slide 2", etc.
  _expandBatchSteps(slideSpecs) {
    // Remove manager-thinking placeholders and mark previous active steps as complete
    this.steps = this.steps.filter(s => !s.managerThinking);
    for (const s of this.steps) {
      if (s.status === 'active') s.status = 'complete';
    }

    const batchSize = this.settings?.parallelSlideGeneration || 3;
    const totalBatches = Math.ceil(slideSpecs.length / batchSize);

    // Add a "Routing" step that shows as active while the router plans
    this.steps.push({
      name: `Routing ${slideSpecs.length} slides through template engine`,
      status: 'active',
      role: 'consultant',
    });
    this._emitProgress({ phase: `Routing ${slideSpecs.length} slides...` });

    // Record where batch steps start so we can update them during execution
    this._batchStepOffset = this.steps.length;

    // Group slides into batches — each batch is a step with child slide info
    for (let b = 0; b < totalBatches; b++) {
      const start = b * batchSize;
      const end = Math.min(start + batchSize, slideSpecs.length);
      const batchSlides = [];
      for (let i = start; i < end; i++) {
        const spec = slideSpecs[i];
        // Extract a short label: prefer tracker, then title from instruction, fallback to slide number
        let label = spec.sectionTracker || '';
        if (!label) {
          const titleMatch = (spec.instruction || '').match(/--- SLIDE \d+: (.+?) ---/);
          label = titleMatch?.[1] || `Slide ${i + 1}`;
        }
        batchSlides.push({
          index: i,
          label: label.slice(0, 60),
          template: '',  // Will be filled when router plan arrives
          status: 'pending',
        });
      }
      this.steps.push({
        name: `Batch ${b + 1} of ${totalBatches} (slides ${start + 1}–${end})`,
        status: 'pending',
        role: 'consultant',
        isBatchGroup: true,
        batchSlides,
        batchIndex: b,
      });
    }

    this._emitProgress({ phase: `Creating ${slideSpecs.length} slides in ${totalBatches} batches` });
  }

  // Called by create_slides_batch / build_presentation tool progress to mark individual slides
  markBatchSlideProgress(slideIndex, total, status = 'active', routerPlan = null) {
    if (this._batchStepOffset == null) return;
    const offset = this._batchStepOffset;
    const batchSize = this.settings?.parallelSlideGeneration || 3;

    // Special: router plan received — complete routing step, update batch step child info
    if (slideIndex === -1 && status === 'plan' && routerPlan) {
      // Complete the "Routing" step with the plan summary
      const routingStep = this.steps[offset - 1];
      if (routingStep && routingStep.status === 'active') {
        routingStep.status = 'complete';
        routingStep.summary = `${routerPlan.length} slides planned`;
      }

      // Log a compact plan summary
      this._log(`Router planned ${routerPlan.length} slides`, 'consultant', 'info');

      // Update batch step children with template IDs from the router plan
      for (let i = 0; i < routerPlan.length; i++) {
        const p = routerPlan[i];
        const batchIdx = Math.floor(i / batchSize);
        const batchStep = this.steps[offset + batchIdx];
        if (!batchStep?.batchSlides) continue;
        const childIdx = batchStep.batchSlides.findIndex(c => c.index === i);
        if (childIdx >= 0) {
          batchStep.batchSlides[childIdx].template = p.templateId || '';
          // Extract short title for the label, not the full instruction
          const titleMatch = (p.instruction || '').match(/--- SLIDE \d+: (.+?) ---/);
          const shortLabel = titleMatch?.[1] || (p.instruction || '').slice(0, 50);
          if (shortLabel) batchStep.batchSlides[childIdx].label = shortLabel;
        }
      }

      // Activate the first batch
      const firstBatch = this.steps[offset];
      if (firstBatch) firstBatch.status = 'active';

      this._emitProgress({ phase: `Router planned ${routerPlan.length} slides — building...` });
      return;
    }

    // Find which batch this slide belongs to and update it
    const batchIdx = Math.floor(slideIndex / batchSize);
    const batchStep = this.steps[offset + batchIdx];
    if (batchStep?.batchSlides) {
      const child = batchStep.batchSlides.find(c => c.index === slideIndex);
      if (child) child.status = status === 'active' ? 'active' : 'complete';

      // If any child in this batch is active/complete, batch is active
      const anyActive = batchStep.batchSlides.some(c => c.status === 'active');
      const allComplete = batchStep.batchSlides.every(c => c.status === 'complete');
      if (allComplete) {
        batchStep.status = 'complete';
        // Activate next batch
        const nextBatch = this.steps[offset + batchIdx + 1];
        if (nextBatch && nextBatch.status === 'pending') nextBatch.status = 'active';
      } else if (anyActive) {
        batchStep.status = 'active';
      }
    }

    // Show batch-level progress, not individual slide progress
    const batchNum = batchIdx + 1;
    const totalBatches = Math.ceil(total / batchSize);
    const completedSlides = this.steps.slice(offset).reduce((sum, s) => {
      if (!s.batchSlides) return sum;
      return sum + s.batchSlides.filter(c => c.status === 'complete').length;
    }, 0);
    this._emitProgress({ phase: `Building slides: ${completedSlides}/${total} done (batch ${batchNum}/${totalBatches})` });
  }

  // Mark all batch steps complete/error when batch finishes
  _completeBatchSteps(result) {
    if (this._batchStepOffset == null) return;
    const offset = this._batchStepOffset;
    const results = result?.results || [];
    const batchSize = this.settings?.parallelSlideGeneration || 3;

    // Update child slide statuses from results
    for (let i = 0; i < results.length; i++) {
      const batchIdx = Math.floor(i / batchSize);
      const batchStep = this.steps[offset + batchIdx];
      if (batchStep?.batchSlides) {
        const child = batchStep.batchSlides.find(c => c.index === i);
        if (child) {
          child.status = results[i]?.success ? 'complete' : 'error';
          if (results[i]?.title) child.resultTitle = results[i].title;
        }
      }
    }

    // Mark batch steps complete/error based on children
    for (let b = 0; this.steps[offset + b]; b++) {
      const batchStep = this.steps[offset + b];
      if (batchStep.batchSlides) {
        const allOk = batchStep.batchSlides.every(c => c.status === 'complete');
        const anyError = batchStep.batchSlides.some(c => c.status === 'error');
        batchStep.status = anyError ? 'error' : allOk ? 'complete' : 'complete';
        const completed = batchStep.batchSlides.filter(c => c.status === 'complete').length;
        const total = batchStep.batchSlides.length;
        if (completed === total) {
          batchStep.summary = `${completed} slides built`;
        } else if (completed > 0) {
          batchStep.summary = `${completed} of ${total} slides built`;
        } else {
          batchStep.summary = `Building ${total} slides...`;
        }
      } else if (batchStep.status === 'pending' || batchStep.status === 'active') {
        batchStep.status = 'complete';
      }
    }

    this._batchStepOffset = null;
    this._emitProgress();
  }

  _log(message, role = 'agent', type = 'info', stepId = null) {
    const entry = {
      role,
      message,
      action: message,
      type,         // 'info' | 'handoff' | 'deliverable' | 'insight' | 'recommendation' | 'error'
      detail: '',
      timestamp: Date.now(),
      budget: this.getBudgetInfo(),
    };
    if (stepId) entry._stepId = stepId;
    this.thinkingLog.push(entry);
    this.callbacks.onThinking?.(role, message, entry);
  }

  // Attach worker output to the current active step so the UI can show it when expanded
  _attachOutputToCurrentStep(outputData, targetStepId) {
    // When a stepId is provided (concurrent pool), attach to that specific step
    let step;
    if (targetStepId) {
      step = this.steps.find(s => s._stepId === targetStepId);
    }
    if (!step) {
      step = this.steps.find(s => s.status === 'active');
    }
    // Fallback: last step if no active one (parallel delegation marks steps complete)
    if (!step) {
      step = this.steps[this.steps.length - 1];
    }
    if (step) {
      if (!step.workerOutputs) step.workerOutputs = [];
      step.workerOutputs.push(outputData);
    }
    // Push update to UI
    this._emitProgress();
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  RESULT BUILDER
  // ═════════════════════════════════════════════════════════════════════════
  _result(type, extra = {}) {
    return {
      type,
      success: type === ResultType.DONE,
      thinkingLog: this.thinkingLog,
      aiIOLog: this.aiIOLog,
      budgetUsed: this.budgetUsed,
      budgetTotal: this.budgetTotal,
      iterations: this.iteration,
      output: this.workspace?.getBestOutput(),
      ...extra,
    };
  }
}
