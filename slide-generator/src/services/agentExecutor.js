/**
 * Agent Executor (Efficient Version with Dependencies)
 *
 * Smart execution engine that:
 * - Creates plans with dependency tracking (what depends on what)
 * - Runs independent tasks in parallel
 * - Dynamically replans on errors or when outputs suggest changes
 * - Minimizes API calls through batching
 */

import { AgentTaskManager, TaskStatus } from './agentTaskSystem';
import { createToolRegistry, getCompactToolList } from './agentToolRegistry';
import { agentChat, AI_ROUTER_TEMPLATES } from './aiService';
import { debugLog, LogLevel } from '../utils/debugLog';
import { retrieveAndFormat } from './knowledgeBaseRAG';

// Agent execution states
export const AgentState = {
  IDLE: 'idle',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  REPLANNING: 'replanning',
  COMPLETE: 'complete',
  ERROR: 'error',
  STOPPED: 'stopped',
  NEEDS_INPUT: 'needs_input', // Agent needs user clarification
};

/**
 * Agent Executor - Efficient version with dependency tracking
 */
export class AgentExecutor {
  constructor(options = {}) {
    const {
      state,
      actions,
      settings,
      knowledgeBase,
      addMessage,
      onStateChange,
      onProgress,
      onAiIO,
    } = options;

    this.appState = state;
    this.actions = actions;
    this.settings = settings;
    this.knowledgeBase = knowledgeBase;
    this.addMessage = addMessage;
    this.onStateChange = onStateChange;
    this.onProgress = onProgress;
    this.onAiIO = onAiIO;

    // Execution state
    this.agentState = AgentState.IDLE;
    this.taskManager = new AgentTaskManager(this._handleTaskUpdate.bind(this));
    this.toolRegistry = null;
    this.executionPlan = null;
    this.aiIOLog = [];
    this.isAborted = false;
    this.startTime = null;

    // Conversation history for plan refinement
    this.conversationHistory = [];
    this.originalRequest = null;
    this.clarificationCount = 0;
    this.maxClarifications = 1; // Only allow one clarification question

    // Efficiency settings
    this.maxExecutionTime = 3 * 60 * 1000; // 3 minutes max
    this.apiCallCount = 0;
    this.maxApiCalls = 15; // Hard limit on API calls

    // Execution results storage (for dependency resolution)
    this.stepResults = {}; // Map of stepId -> result
    this.replanCount = 0;
    this.maxReplans = 2; // Limit replanning to avoid loops
  }

  /**
   * Initialize tool registry
   */
  _initToolRegistry() {
    this.toolRegistry = createToolRegistry({
      state: this.appState,
      actions: this.actions,
      settings: this.settings,
      knowledgeBase: this.knowledgeBase,
      addMessage: this.addMessage,
      recordAiIO: this._recordAiIO.bind(this),
      onProgress: this.onProgress,
    });
  }

  _handleTaskUpdate(taskState) {
    this._notifyStateChange();
  }

  _recordAiIO(io) {
    const record = {
      timestamp: Date.now(),
      ...io,
    };
    this.aiIOLog.push(record);
    this.onAiIO?.(record);
  }

  _notifyStateChange() {
    this.onStateChange?.({
      agentState: this.agentState,
      taskState: this.taskManager.getState(),
      aiIOLog: this.aiIOLog,
    });
  }

  _setAgentState(newState) {
    this.agentState = newState;
    this._notifyStateChange();
  }

  /**
   * Check if we should stop
   */
  _shouldStop() {
    if (this.isAborted) return { stop: true, reason: 'Aborted by user' };
    if (this.apiCallCount >= this.maxApiCalls) {
      return { stop: true, reason: `API call limit reached (${this.maxApiCalls})` };
    }
    if (this.startTime && (Date.now() - this.startTime) > this.maxExecutionTime) {
      return { stop: true, reason: 'Time limit reached' };
    }
    return { stop: false };
  }

  /**
   * SINGLE planning call - creates the entire execution plan
   */
  async _createExecutionPlan(userRequest) {
    this._setAgentState(AgentState.PLANNING);
    this.onProgress?.({ phase: 'planning', message: 'Creating execution plan...' });

    const toolList = getCompactToolList(this.toolRegistry);

    // Build context about current state including slide titles
    let deckContext = 'No slides yet - starting fresh.';
    if (this.appState.slides.length > 0) {
      const slideList = this.appState.slides
        .map((s, i) => `  ${i}: "${s.title || 'Untitled'}"`)
        .join('\n');
      deckContext = `Current deck has ${this.appState.slides.length} slides (0-based indices):\n${slideList}\nUse contextSlides param to reference these by index.`;
    }

    // RAG-enhanced KB context — retrieve entries relevant to this request
    let kbContext = '';
    const kbEntries = this.knowledgeBase?.entries;
    if (kbEntries) {
      const ragResult = retrieveAndFormat(userRequest, kbEntries, { topK: 5, minScore: 1.5 });
      if (ragResult) {
        kbContext = `Knowledge base has ${ragResult.count} relevant entries:\n${ragResult.context}`;
      } else {
        const populated = Object.keys(kbEntries).filter(k => kbEntries[k]?.length > 0);
        kbContext = populated.length > 0
          ? `Knowledge base has content in: ${populated.join(', ')} (no direct matches for this query)`
          : 'Knowledge base is empty';
      }
    }

    const planPrompt = `You are a smart assistant that creates efficient execution plans with dependency awareness.

USER REQUEST: "${userRequest}"

CURRENT STATE:
- ${deckContext}
- ${kbContext}

AVAILABLE TOOLS:
${toolList}

${AI_ROUTER_TEMPLATES}

SLIDE CREATION RULES:
- ALWAYS include "templateId" in params for create_slide/create_slides_batch
- Choose the best template based on content type (see TEMPLATES above)
- Include "contextSlides" array (0-based indices) if referencing existing slides
- CRITICAL: Each slide "instruction" must be SELF-CONTAINED with ALL the actual content, data, names, and specifics. The execution step ONLY sees the instruction — it cannot read the user request or any other context. Write RICH instructions with real content, not vague labels.
  WRONG: "Executive summary of AI trends"
  RIGHT: "3 AI trends reshaping enterprise: 1) Generative AI adoption at 67% (+22pp YoY), 2) AI spending projected $200B by 2025, 3) 78% of CIOs plan AI-first strategies — key insight: speed of adoption outpacing governance frameworks"
- For IMAGE slides: instruction feeds BOTH the text model (title) AND image model (diagram labels). Vague instructions produce generic placeholder diagrams. Include actual entities, numbers, and relationships.
- Preserve the user's original content (questions stay as questions, specific phrasing stays as-is).

EXECUTION RULES:
1. Each step gets a unique "id" (e.g., "step1", "step2")
2. Use "dependsOn" to list step IDs that must complete first
3. Steps without dependencies (or only completed deps) run IN PARALLEL
4. Use "usesOutput" to reference data from previous steps

DEPENDENCY EXAMPLES:
- Research then create slides: create_slides depends on research_topic, usesOutput passes data
- Multiple independent slides: they can run in parallel (no dependencies)
- Edit after create: edit depends on create

If the request is unclear, return:
{
  "needsClarification": true,
  "question": "Your specific question",
  "missingInfo": ["what's missing"]
}

If clear, return a plan. IMPORTANT: When a step depends on research, use "usesOutput" to pass the data:

EXAMPLE - Research then create slides:
{
  "needsClarification": false,
  "understanding": "Research AI trends then create presentation",
  "steps": [
    {
      "id": "research1",
      "tool": "research_topic",
      "params": { "topic": "AI trends 2024", "focus": "statistics", "depth": "comprehensive" },
      "description": "Research AI trends",
      "dependsOn": []
    },
    {
      "id": "slides1",
      "tool": "create_slides_batch",
      "params": {
        "slides": [
          { "instruction": "3 key AI trends: 1) Enterprise adoption at 67% (+22pp YoY), 2) Global AI spending projected $200B by 2025, 3) 78% of CIOs prioritizing AI-first — insight: adoption speed outpacing governance", "templateId": "kpiMetrics" },
          { "instruction": "AI adoption rate hit 67% in 2024 — up 22 percentage points year-over-year. Fastest growth in financial services (82%) and healthcare (71%). Key driver: generative AI tools reducing implementation cost by 40%", "templateId": "bigNumber" }
        ]
      },
      "description": "Create AI trend slides",
      "dependsOn": ["research1"],
      "usesOutput": { "content": "research1.research" }
    }
  ]
}

EXAMPLE - Simple slide creation (no research):
{
  "needsClarification": false,
  "understanding": "What user wants",
  "steps": [
    {
      "id": "step1",
      "tool": "create_slide",
      "params": {
        "instruction": "Create slide showing 3 pillars: Innovation, Growth, Efficiency with descriptions...",
        "templateId": "threeCards"
      },
      "description": "Create pillars slide",
      "dependsOn": []
    }
  ]
}

EFFICIENCY:
- Use create_slides_batch for multiple slides (NOT separate create_slide calls)
- Independent tasks should have empty dependsOn: [] so they run in parallel
- Only add dependencies when output from one step is ACTUALLY needed by another`;

    try {
      this.apiCallCount++;
      const startTime = Date.now();

      const plan = await agentChat(planPrompt, this.settings, {
        systemPrompt: 'You create efficient, minimal execution plans. Always prefer batch operations. Return only valid JSON.',
        returnJSON: true,
        temperature: 0.3, // Low temperature for consistent planning
      });

      this._recordAiIO({
        type: 'planning',
        input: { request: userRequest.slice(0, 200) },
        output: plan?.needsClarification
          ? { needsClarification: true, question: plan.question }
          : { steps: plan?.steps?.length || 0, estimated: plan?.estimatedApiCalls },
        duration: Date.now() - startTime,
      });

      // Check if clarification is needed - STOP and ask user
      if (plan?.needsClarification) {
        this._setAgentState(AgentState.NEEDS_INPUT);
        const question = plan.question || 'Could you please provide more details?';
        const missingInfo = plan.missingInfo?.length > 0
          ? `\n\nSpecifically, I need: ${plan.missingInfo.join(', ')}`
          : '';

        // Track assistant's question in conversation history
        const fullQuestion = `${question}${missingInfo}`;
        this.conversationHistory.push({ role: 'assistant', content: fullQuestion });

        this.addMessage?.({
          type: 'assistant',
          content: `❓ **Clarification needed:**\n\n${fullQuestion}`,
        });
        // Return a special result indicating we need input
        return { needsClarification: true, question: fullQuestion };
      }

      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error('No execution plan generated');
      }

      // Validate and optimize the plan
      this.executionPlan = this._optimizePlan(plan);

      // Create tasks from the plan with step IDs for dependency tracking
      const tasks = this.executionPlan.steps.map((step, i) => ({
        content: step.description || `Step ${i + 1}: ${step.tool}`,
        activeForm: step.description || `Executing ${step.tool}`,
        metadata: {
          tool: step.tool,
          params: step.params,
          stepIndex: i,
          stepId: step.id || `step${i + 1}`,
          dependsOn: step.dependsOn || [],
        },
      }));

      this.taskManager.addTasks(tasks);

      // Show plan to user with dependency info
      const planDisplay = tasks.map((t, i) => {
        const step = this.executionPlan.steps[i];
        const deps = step.dependsOn?.length > 0 ? ` (after: ${step.dependsOn.join(', ')})` : ' (parallel)';
        return `${i + 1}. ${t.content}${deps}`;
      }).join('\n');

      this.addMessage?.({
        type: 'assistant',
        content: `📋 **Plan:** ${this.executionPlan.understanding}\n\n${planDisplay}`,
      });

      return this.executionPlan;
    } catch (error) {
      debugLog(LogLevel.ERROR, 'Planning failed:', error);
      throw error;
    }
  }

  /**
   * Optimize the plan to reduce redundant steps
   */
  _optimizePlan(plan) {
    const optimizedSteps = [];
    const slideCreations = [];

    for (const step of plan.steps) {
      // Normalize: AI might return "action" instead of "tool"
      const tool = step.tool || step.action;
      if (!tool) {
        console.warn('[AgentExecutor] Step missing tool/action:', step);
        continue;
      }

      // Collect individual slide creations to batch them
      if (tool === 'create_slide') {
        slideCreations.push(step.params || { instruction: step.instruction, templateId: step.templateId, contextSlides: step.contextSlides });
      } else if (tool === 'think' || tool === 'report_progress') {
        // Skip unnecessary thinking/progress steps
        continue;
      } else {
        // If we have pending slide creations, batch them first
        if (slideCreations.length > 0) {
          if (slideCreations.length === 1) {
            optimizedSteps.push({
              tool: 'create_slide',
              params: slideCreations[0],
              description: `Create slide: ${slideCreations[0].instruction?.slice(0, 50) || 'content'}`,
            });
          } else {
            optimizedSteps.push({
              tool: 'create_slides_batch',
              params: { slides: slideCreations },
              description: `Create ${slideCreations.length} slides`,
            });
          }
          slideCreations.length = 0;
        }
        // Normalize step to always have 'tool' property
        optimizedSteps.push({
          ...step,
          tool,
          params: step.params || { instruction: step.instruction, templateId: step.templateId, contextSlides: step.contextSlides },
        });
      }
    }

    // Handle remaining slide creations
    if (slideCreations.length > 0) {
      if (slideCreations.length === 1) {
        optimizedSteps.push({
          tool: 'create_slide',
          params: slideCreations[0],
          description: `Create slide: ${slideCreations[0].instruction?.slice(0, 50) || 'content'}`,
        });
      } else {
        optimizedSteps.push({
          tool: 'create_slides_batch',
          params: { slides: slideCreations },
          description: `Create ${slideCreations.length} slides`,
        });
      }
    }

    return {
      ...plan,
      steps: optimizedSteps,
    };
  }

  /**
   * Execute a single step directly (no AI call needed)
   */
  async _executeStep(step, taskId) {
    const { tool, params } = step;

    const toolDef = this.toolRegistry[tool];
    if (!toolDef) {
      return { success: false, error: `Unknown tool: ${tool}` };
    }

    this.onProgress?.({
      phase: 'executing',
      message: toolDef.activeForm || `Running ${tool}...`,
      tool,
    });

    const startTime = Date.now();

    try {
      // Count API calls for tools that make them
      if (['research_topic', 'generate_benchmarks', 'analyze_content',
           'create_slide', 'create_slides_batch', 'edit_slide',
           'plan_presentation'].includes(tool)) {
        this.apiCallCount++;
      }

      const result = await toolDef.execute(params || {});

      this._recordAiIO({
        type: 'tool_execution',
        tool,
        input: params,
        output: { success: result?.success, summary: result?.message || (result?.success ? 'Done' : result?.error) },
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this._recordAiIO({
        type: 'tool_error',
        tool,
        error: error.message,
        duration: Date.now() - startTime,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Resolve output references in params (e.g., "step1.research" -> actual data)
   */
  _resolveOutputRefs(params, usesOutput) {
    if (!usesOutput || !params) return params;

    const resolved = { ...params };
    for (const [paramKey, outputRef] of Object.entries(usesOutput)) {
      // outputRef format: "stepId.outputKey" or just "stepId"
      const parts = outputRef.split('.');
      const stepId = parts[0];
      const outputKey = parts[1];

      const stepResult = this.stepResults[stepId];
      if (stepResult) {
        resolved[paramKey] = outputKey ? stepResult[outputKey] : stepResult;
      }
    }
    return resolved;
  }

  /**
   * Get steps that are ready to run (dependencies satisfied)
   */
  _getReadySteps(steps, completedStepIds, failedStepIds) {
    return steps.filter(step => {
      // Already completed or failed
      if (completedStepIds.has(step.id) || failedStepIds.has(step.id)) {
        return false;
      }
      // Check all dependencies are satisfied
      const deps = step.dependsOn || [];
      return deps.every(depId => completedStepIds.has(depId));
    });
  }

  /**
   * Main execution - runs plan with dependency tracking and parallel execution
   */
  async execute(userMessage) {
    // Reset state for new execution
    this.taskManager.reset();
    this.aiIOLog = [];
    this.isAborted = false;
    this.apiCallCount = 0;
    this.startTime = Date.now();
    this.executionPlan = null;
    this.stepResults = {};
    this.replanCount = 0;

    // Track original request and reset clarification count for new conversations
    this.originalRequest = userMessage;
    this.conversationHistory = [{ role: 'user', content: userMessage }];
    this.clarificationCount = 0;

    this._initToolRegistry();

    try {
      // STEP 1: Create execution plan (ONE AI call)
      const planResult = await this._createExecutionPlan(userMessage);

      // If clarification is needed, stop here and wait for user input
      if (planResult?.needsClarification) {
        return {
          success: false,
          needsClarification: true,
          question: planResult.question,
          apiCalls: this.apiCallCount,
        };
      }

      // STEP 2: Execute with dependency-aware parallel processing
      return await this._executeWithDependencies();

    } catch (error) {
      this._setAgentState(AgentState.ERROR);
      this.addMessage?.({
        type: 'assistant',
        content: `❌ Error: ${error.message}`,
      });
      return { success: false, error: error.message, apiCalls: this.apiCallCount };
    }
  }

  /**
   * Execute steps respecting dependencies, running parallel when possible
   */
  async _executeWithDependencies() {
    this._setAgentState(AgentState.EXECUTING);

    const steps = this.executionPlan.steps || [];
    const completedStepIds = new Set();
    const failedStepIds = new Set();
    const failedSteps = []; // Track for potential replanning

    while (true) {
      const stopCheck = this._shouldStop();
      if (stopCheck.stop) {
        this.addMessage?.({ type: 'assistant', content: `⚠️ Stopped: ${stopCheck.reason}` });
        break;
      }

      // Get steps ready to run (dependencies satisfied)
      const readySteps = this._getReadySteps(steps, completedStepIds, failedStepIds);

      // If no steps ready but not all complete, we might have a dependency issue
      if (readySteps.length === 0) {
        const remaining = steps.filter(s => !completedStepIds.has(s.id) && !failedStepIds.has(s.id));
        if (remaining.length > 0) {
          // Steps blocked by failed dependencies
          this.addMessage?.({
            type: 'assistant',
            content: `⚠️ ${remaining.length} step(s) blocked by failed dependencies.`,
          });
        }
        break;
      }

      // Show what's running in parallel
      if (readySteps.length > 1) {
        this.onProgress?.({
          phase: 'executing',
          message: `Running ${readySteps.length} tasks in parallel...`,
        });
      }

      // Execute ready steps in parallel
      const execPromises = readySteps.map(async (step) => {
        const task = this.taskManager.tasks.find(t => t.metadata?.stepId === step.id);
        if (task) {
          this.taskManager.startTask(task.id);
        }

        this.onProgress?.({
          phase: 'executing',
          message: step.description || `Executing ${step.tool}`,
          parallel: readySteps.length > 1,
        });

        // Resolve any output references from previous steps
        const resolvedParams = this._resolveOutputRefs(step.params, step.usesOutput);

        const result = await this._executeStep({ ...step, params: resolvedParams }, task?.id);

        return { step, result, task };
      });

      const results = await Promise.all(execPromises);

      // Process results
      for (const { step, result, task } of results) {
        if (result.success) {
          completedStepIds.add(step.id);
          // Store result for dependent steps
          if (step.outputKey) {
            this.stepResults[step.id] = { [step.outputKey]: result };
          } else {
            this.stepResults[step.id] = result;
          }
          if (task) {
            this.taskManager.completeTask(task.id, result);
          }
        } else {
          failedStepIds.add(step.id);
          failedSteps.push({ step, error: result.error });
          if (task) {
            this.taskManager.failTask(task.id, result.error);
          }
        }
      }

      // Small delay for UI updates
      await new Promise(r => setTimeout(r, 50));
    }

    // Check if we should try replanning for failed steps
    if (failedSteps.length > 0 && this.replanCount < this.maxReplans) {
      const shouldReplan = await this._considerReplanning(failedSteps, completedStepIds);
      if (shouldReplan) {
        return await this._executeWithDependencies();
      }
    }

    // STEP 3: Complete
    const progress = this.taskManager.getProgress();
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    if (this.isAborted) {
      this._setAgentState(AgentState.STOPPED);
      this.addMessage?.({ type: 'assistant', content: '⏹️ Stopped.' });
    } else if (progress.failed > 0) {
      this._setAgentState(AgentState.ERROR);
      this.addMessage?.({
        type: 'assistant',
        content: `⚠️ Completed with ${progress.failed} error(s). ${progress.completed}/${progress.total} tasks succeeded.`,
      });
    } else {
      this._setAgentState(AgentState.COMPLETE);
      this.addMessage?.({
        type: 'assistant',
        content: `✅ Done! Completed ${progress.completed} task(s) in ${duration}s using ${this.apiCallCount} API call(s).`,
      });
    }

    return {
      success: progress.failed === 0,
      completed: progress.completed,
      failed: progress.failed,
      apiCalls: this.apiCallCount,
      duration: parseFloat(duration),
    };
  }

  /**
   * Consider replanning when steps fail - ask AI for recovery plan
   */
  async _considerReplanning(failedSteps, completedStepIds) {
    // Don't replan if we've hit the limit
    if (this.replanCount >= this.maxReplans) {
      return false;
    }

    this._setAgentState(AgentState.REPLANNING);
    this.replanCount++;

    this.addMessage?.({
      type: 'assistant',
      content: `🔄 Some steps failed. Attempting to replan (${this.replanCount}/${this.maxReplans})...`,
    });

    // Build context about what succeeded and failed
    const completedSummary = Array.from(completedStepIds).map(id => {
      const result = this.stepResults[id];
      return `- ${id}: completed ${result?.message || 'successfully'}`;
    }).join('\n');

    const failedSummary = failedSteps.map(f =>
      `- ${f.step.id} (${f.step.tool}): ${f.error}`
    ).join('\n');

    const replanPrompt = `Some steps in the execution plan failed. Help me recover.

ORIGINAL REQUEST: "${this.originalRequest}"

COMPLETED STEPS:
${completedSummary || '(none)'}

FAILED STEPS:
${failedSummary}

Based on the errors, should I:
1. RETRY the failed steps with different parameters
2. SKIP the failed steps and continue
3. Try an ALTERNATIVE approach

Return JSON:
{
  "action": "retry" | "skip" | "alternative",
  "reason": "Why this action",
  "newSteps": [...] // Only if action is "retry" or "alternative"
}

Keep newSteps minimal - only what's needed to recover.`;

    try {
      this.apiCallCount++;
      const result = await agentChat(replanPrompt, this.settings, {
        systemPrompt: 'You help recover from execution failures. Be concise.',
        returnJSON: true,
        temperature: 0.3,
      });

      this._recordAiIO({
        type: 'replanning',
        input: { failedCount: failedSteps.length, completedCount: completedStepIds.size },
        output: { action: result?.action, newStepsCount: result?.newSteps?.length || 0 },
      });

      if (result?.action === 'skip') {
        this.addMessage?.({
          type: 'assistant',
          content: `⏩ Skipping failed steps: ${result.reason}`,
        });
        return false; // Don't re-execute, just continue
      }

      if ((result?.action === 'retry' || result?.action === 'alternative') && result?.newSteps?.length > 0) {
        // Add new steps to the plan
        this.executionPlan.steps = result.newSteps.map((step, i) => ({
          ...step,
          id: step.id || `recovery${i + 1}`,
          dependsOn: step.dependsOn || [],
        }));

        // Reset task manager for new steps
        this.taskManager.reset();
        const tasks = this.executionPlan.steps.map((step, i) => ({
          content: step.description || `Recovery ${i + 1}: ${step.tool}`,
          activeForm: step.description || `Executing ${step.tool}`,
          metadata: {
            tool: step.tool,
            params: step.params,
            stepIndex: i,
            stepId: step.id,
            dependsOn: step.dependsOn || [],
          },
        }));
        this.taskManager.addTasks(tasks);

        this.addMessage?.({
          type: 'assistant',
          content: `🔧 Recovery plan: ${result.reason}\n\n${tasks.map((t, i) => `${i + 1}. ${t.content}`).join('\n')}`,
        });

        return true; // Re-execute with new plan
      }

      return false;
    } catch (error) {
      debugLog(LogLevel.ERROR, 'Replanning failed:', error);
      return false;
    }
  }

  /**
   * Abort execution
   */
  abort() {
    this.isAborted = true;
    this._setAgentState(AgentState.STOPPED);
  }

  /**
   * Continue execution after user provides clarification
   * @param {string} userResponse - User's clarifying response
   */
  async continueWithClarification(userResponse) {
    // Check clarification limit to prevent infinite loops
    this.clarificationCount++;
    if (this.clarificationCount > this.maxClarifications) {
      this._setAgentState(AgentState.ERROR);
      this.addMessage?.({
        type: 'assistant',
        content: `❌ Maximum clarification rounds (${this.maxClarifications}) reached. Please try rephrasing your original request more specifically.`,
      });
      return {
        success: false,
        error: 'Maximum clarification rounds reached',
        apiCalls: this.apiCallCount,
      };
    }

    // Add user's response to conversation history
    this.conversationHistory.push({ role: 'user', content: userResponse });

    // Reset for new planning attempt
    this.taskManager.reset();
    this.executionPlan = null;

    if (!this.toolRegistry) {
      this._initToolRegistry();
    }

    this.onProgress?.({ phase: 'planning', message: 'Refining plan with your input...' });

    try {
      // Create plan with full conversation context
      const planResult = await this._createExecutionPlanWithHistory();

      // If still needs clarification
      if (planResult?.needsClarification) {
        return {
          success: false,
          needsClarification: true,
          question: planResult.question,
          clarificationRound: this.clarificationCount,
          apiCalls: this.apiCallCount,
        };
      }

      // Execute the plan
      this._setAgentState(AgentState.EXECUTING);
      return await this._executePlan();
    } catch (error) {
      this._setAgentState(AgentState.ERROR);
      this.addMessage?.({
        type: 'assistant',
        content: `❌ Error: ${error.message}`,
      });
      return { success: false, error: error.message, apiCalls: this.apiCallCount };
    }
  }

  /**
   * Create execution plan using conversation history for context
   */
  async _createExecutionPlanWithHistory() {
    this._setAgentState(AgentState.PLANNING);
    this.onProgress?.({ phase: 'planning', message: 'Creating execution plan...' });

    const toolList = getCompactToolList(this.toolRegistry);

    // Build context about current state including slide titles
    let deckContext = 'No slides yet - starting fresh.';
    if (this.appState.slides.length > 0) {
      const slideList = this.appState.slides
        .map((s, i) => `  ${i}: "${s.title || 'Untitled'}"`)
        .join('\n');
      deckContext = `Current deck has ${this.appState.slides.length} slides (0-based indices):\n${slideList}\nUse contextSlides param to reference these by index.`;
    }

    // RAG-enhanced KB context for replanning
    let kbContext = '';
    const kbEntries2 = this.knowledgeBase?.entries;
    if (kbEntries2) {
      const ragResult = retrieveAndFormat(this.userRequest || '', kbEntries2, { topK: 4, minScore: 1.5 });
      if (ragResult) {
        kbContext = `Knowledge base (${ragResult.count} relevant entries available via search_knowledge_base tool)`;
      } else {
        const populated = Object.keys(kbEntries2).filter(k => kbEntries2[k]?.length > 0);
        kbContext = populated.length > 0 ? `Knowledge base has content in: ${populated.join(', ')}` : '';
      }
    }

    // Format conversation history
    const conversationText = this.conversationHistory
      .map(msg => `${msg.role === 'user' ? 'USER' : 'ASSISTANT'}: ${msg.content}`)
      .join('\n\n');

    const planPrompt = `You are a smart assistant that creates efficient execution plans.

CONVERSATION HISTORY:
${conversationText}

CURRENT STATE:
- ${deckContext}
- ${kbContext}
- Clarification round: ${this.clarificationCount} of ${this.maxClarifications} max

AVAILABLE TOOLS:
${toolList}

${AI_ROUTER_TEMPLATES}

SLIDE CREATION RULES:
- ALWAYS include "templateId" in params for create_slide/create_slides_batch
- Choose the best template based on content type (see TEMPLATES above)
- Include "contextSlides" array (0-based indices) if referencing existing slides
- CRITICAL: Each slide "instruction" must be SELF-CONTAINED with ALL the actual content, data, names, and specifics. The execution step ONLY sees the instruction — it cannot read the user request or any other context. Write RICH instructions with real content, not vague labels.
  WRONG: "Executive summary of AI trends"
  RIGHT: "3 AI trends reshaping enterprise: 1) Generative AI adoption at 67% (+22pp YoY), 2) AI spending projected $200B by 2025, 3) 78% of CIOs plan AI-first strategies — key insight: speed of adoption outpacing governance frameworks"
- For IMAGE slides: instruction feeds BOTH the text model (title) AND image model (diagram labels). Vague instructions produce generic placeholder diagrams. Include actual entities, numbers, and relationships.
- Preserve the user's original content (questions stay as questions, specific phrasing stays as-is).

Based on the conversation above, the user has provided additional clarification.
Now create a MINIMAL execution plan. Return JSON:
{
  "needsClarification": false,
  "understanding": "Brief summary of what user wants (incorporating their clarification)",
  "approach": "1-sentence approach",
  "steps": [
    {
      "tool": "create_slide",
      "params": {
        "instruction": "Detailed content...",
        "templateId": "threeCards"
      },
      "description": "What this step does"
    }
  ],
  "estimatedApiCalls": number
}

If you STILL need more information, return:
{
  "needsClarification": true,
  "question": "Your specific question",
  "missingInfo": ["what's still missing"]
}

IMPORTANT: The user has already provided clarification. Only ask for more if absolutely necessary.`;

    try {
      this.apiCallCount++;
      const startTime = Date.now();

      const plan = await agentChat(planPrompt, this.settings, {
        systemPrompt: 'You create efficient, minimal execution plans. Use conversation context to understand user intent. Return only valid JSON.',
        returnJSON: true,
        temperature: 0.3,
      });

      this._recordAiIO({
        type: 'planning_with_history',
        input: { conversationLength: this.conversationHistory.length, clarificationRound: this.clarificationCount },
        output: plan?.needsClarification
          ? { needsClarification: true, question: plan.question }
          : { steps: plan?.steps?.length || 0, estimated: plan?.estimatedApiCalls },
        duration: Date.now() - startTime,
      });

      // Check if clarification is still needed
      if (plan?.needsClarification) {
        this._setAgentState(AgentState.NEEDS_INPUT);
        const question = plan.question || 'Could you please provide more details?';
        const missingInfo = plan.missingInfo?.length > 0
          ? `\n\nSpecifically, I need: ${plan.missingInfo.join(', ')}`
          : '';

        const fullQuestion = `${question}${missingInfo}`;
        this.conversationHistory.push({ role: 'assistant', content: fullQuestion });

        this.addMessage?.({
          type: 'assistant',
          content: `❓ **Still need clarification (${this.clarificationCount}/${this.maxClarifications}):**\n\n${fullQuestion}`,
        });
        return { needsClarification: true, question: fullQuestion };
      }

      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error('No execution plan generated');
      }

      // Validate and optimize the plan
      this.executionPlan = this._optimizePlan(plan);

      // Create tasks from the plan with step IDs for dependency tracking
      const tasks = this.executionPlan.steps.map((step, i) => ({
        content: step.description || `Step ${i + 1}: ${step.tool}`,
        activeForm: step.description || `Executing ${step.tool}`,
        metadata: {
          tool: step.tool,
          params: step.params,
          stepIndex: i,
          stepId: step.id || `step${i + 1}`,
          dependsOn: step.dependsOn || [],
        },
      }));

      this.taskManager.addTasks(tasks);

      // Show plan to user with dependency info
      const planDisplay = tasks.map((t, i) => {
        const step = this.executionPlan.steps[i];
        const deps = step.dependsOn?.length > 0 ? ` (after: ${step.dependsOn.join(', ')})` : ' (parallel)';
        return `${i + 1}. ${t.content}${deps}`;
      }).join('\n');

      this.addMessage?.({
        type: 'assistant',
        content: `📋 **Plan:** ${this.executionPlan.understanding}\n\n${planDisplay}`,
      });

      return this.executionPlan;
    } catch (error) {
      debugLog(LogLevel.ERROR, 'Planning with history failed:', error);
      throw error;
    }
  }

  /**
   * Execute the current plan (used after planning is complete)
   */
  async _executePlan() {
    const tasks = this.taskManager.tasks;

    for (let i = 0; i < tasks.length; i++) {
      const stopCheck = this._shouldStop();
      if (stopCheck.stop) {
        this.addMessage?.({
          type: 'assistant',
          content: `⚠️ Stopped: ${stopCheck.reason}`,
        });
        break;
      }

      const task = tasks[i];
      const step = this.executionPlan.steps[i];

      this.taskManager.startTask(task.id);
      this.onProgress?.({
        phase: 'executing',
        message: task.activeForm,
        current: i + 1,
        total: tasks.length,
      });

      const result = await this._executeStep(step, task.id);

      if (result.success) {
        this.taskManager.completeTask(task.id, result);
      } else {
        this.taskManager.failTask(task.id, result.error);
      }

      await new Promise(r => setTimeout(r, 50));
    }

    // Complete
    const progress = this.taskManager.getProgress();
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    if (this.isAborted) {
      this._setAgentState(AgentState.STOPPED);
      this.addMessage?.({ type: 'assistant', content: '⏹️ Stopped.' });
    } else if (progress.failed > 0) {
      this._setAgentState(AgentState.ERROR);
      this.addMessage?.({
        type: 'assistant',
        content: `⚠️ Completed with ${progress.failed} error(s). ${progress.completed}/${progress.total} tasks succeeded.`,
      });
    } else {
      this._setAgentState(AgentState.COMPLETE);
      this.addMessage?.({
        type: 'assistant',
        content: `✅ Done! Completed ${progress.completed} task(s) in ${duration}s using ${this.apiCallCount} API call(s).`,
      });
    }

    return {
      success: progress.failed === 0,
      completed: progress.completed,
      failed: progress.failed,
      apiCalls: this.apiCallCount,
      duration: parseFloat(duration),
    };
  }

  /**
   * Get current state
   */
  getState() {
    return {
      agentState: this.agentState,
      taskState: this.taskManager.getState(),
      aiIOLog: this.aiIOLog,
      apiCallCount: this.apiCallCount,
      isRunning: this.agentState === AgentState.PLANNING || this.agentState === AgentState.EXECUTING,
    };
  }
}

/**
 * Create an agent executor instance
 */
export function createAgentExecutor(options) {
  return new AgentExecutor(options);
}
