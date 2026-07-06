/**
 * useAgenticExecution Hook
 *
 * Manages the Generic Agent lifecycle:
 * - Creates agent with tools, skills, budget
 * - Handles run → [pause → resume]* → done flow
 * - Supports: clarification, approval, revision checkpoints
 * - Exposes thinking log for real-time activity visualization
 *
 * Flow:
 *   prepareContent() → [ask_user?] → [present_plan?] → [approval/revision?] → done
 *
 * The agent instance stays alive across checkpoints to preserve context.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { GenericAgent, AgentPhase, ResultType } from '../services/genericAgent';
import { createToolRegistry } from '../services/agentToolRegistry';
import { DEFAULT_SKILLS } from '../services/skillRegistry';

/**
 * Hook for managing agentic content preparation
 */
export function useAgenticExecution({
  state,
  actions,
  addMessage,
  activeFlow,
  knowledgeBaseEntries,
}) {
  // Agent state
  const [phase, setPhase] = useState(AgentPhase.IDLE);
  const [currentProgress, setCurrentProgress] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [pendingStoryline, setPendingStoryline] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);

  // Thinking log — real-time activity feed
  const [thinkingLog, setThinkingLog] = useState([]);

  // AI I/O log — records every LLM prompt + response
  const [aiIOLog, setAiIOLog] = useState([]);

  // Refs
  const agentRef = useRef(null);
  const stateRef = useRef(state);

  // Keep state ref updated
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Create a fresh tool registry bound to current app state
   */
  const createTools = useCallback(() => {
    return createToolRegistry({
      state: stateRef.current,
      actions,
      settings: stateRef.current.settings,
      knowledgeBase: { entries: knowledgeBaseEntries },
      addMessage,
      activeFlow,
      recordAiIO: (io) => {
        setAiIOLog(prev => [...prev, { timestamp: Date.now(), ...io }]);
      },
      onProgress: (progress) => {
        // Merge tool progress into existing progress — don't overwrite steps/budget
        setCurrentProgress(prev => prev ? { ...prev, ...progress } : progress);
      },
    });
  }, [actions, addMessage, knowledgeBaseEntries, activeFlow]);

  /**
   * Get or create agent instance.
   * Reuses existing agent for multi-turn conversations (clarification, approval).
   * Creates new agent on first request or after explicit clear().
   */
  const getOrCreateAgent = useCallback((forceNew = false) => {
    if (!forceNew && agentRef.current) {
      // Only reuse if not currently running a loop — prevents concurrent loops
      if (!agentRef.current._loopRunning) {
        agentRef.current.isAborted = false;
        // Refresh settings so changes (e.g. reportFormat) take effect between runs
        agentRef.current.settings = stateRef.current.settings;
        return agentRef.current;
      }
      // Loop is running — abort old agent and create fresh one
      agentRef.current.abort();
    }

    const tools = createTools();
    const maxBudget = stateRef.current.settings?.agentMaxBudget || 40;

    // Extract skills from KB entries (skills category) — convert to agent skill format
    const kbSkills = knowledgeBaseEntries?.skills;
    const skills = (Array.isArray(kbSkills) && kbSkills.length > 0)
      ? kbSkills.map(s => ({
          id: s._skillId || s.id,
          name: s.name,
          appliesWhen: s.appliesWhen || '',
          methodology: s.methodology || '',
        }))
      : undefined; // undefined → agent uses DEFAULT_SKILLS

    // Only show skill count if agentUseSkills is enabled
    const useSkills = stateRef.current.settings?.agentUseSkills;
    const activeSkillCount = useSkills ? (skills ? skills.length : (DEFAULT_SKILLS?.length || 0)) : 0;

    const agent = new GenericAgent({
      tools,
      skills,
      budget: maxBudget,
      settings: stateRef.current.settings,
      knowledgeBaseEntries: knowledgeBaseEntries || null,
      callbacks: {
        onProgress: (progress) => {
          setCurrentProgress(prev => prev ? { ...prev, ...progress, skillCount: activeSkillCount } : { ...progress, skillCount: activeSkillCount });
        },
        onPhaseChange: (newPhase, message) => {
          setPhase(newPhase);
          if (message) {
            setCurrentProgress(prev => prev ? { ...prev, message } : { phase: newPhase, message });
          }
        },
        onThinking: (role, message, entry) => {
          setThinkingLog(prev => [...prev, entry]);
          setAgentLogs(prev => [...prev, entry]);
          // Surface live-input acknowledgements and manager questions as chat messages
          if (entry?.type === 'live-input-ack' || entry?.type === 'manager-question') {
            addMessage?.({ type: 'assistant', content: message });
          }
        },
        onAiIO: (ioEntry) => {
          setAiIOLog(prev => [...prev, ioEntry]);
        },
      },
    });

    agentRef.current = agent;
    return agent;
  }, [createTools, knowledgeBaseEntries]);

  /**
   * Handle an agent result — route to appropriate UI state
   */
  const handleResult = useCallback((result, agent) => {
    if (!result) {
      setIsRunning(false);
      return { success: false, error: 'No result from agent' };
    }

    const type = result.type;

    // ─── Ask user (clarification) ───
    if (type === ResultType.ASK_USER) {
      const rawQuestion = result.question || 'Could you provide more details?';
      const rawOptions = result.options || [];

      // HTML-escape helper to prevent XSS from LLM output
      const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      // Parse: if the LLM sent multiple questions (numbered lines) with shared options,
      // split them into separate question blocks each with their own option chips.
      // Also support result.questions array (e.g. [{question, options}])
      let questionBlocks = [];
      if (result.questions?.length > 0) {
        // Structured multi-question format
        questionBlocks = result.questions.map(q => ({
          question: q.question || q,
          options: q.options || [],
        }));
      } else {
        // Try to split numbered questions: "1. Purpose?\n2. Audience?\n3. Depth?"
        const numbered = rawQuestion.split(/\n(?=\d+[\.\)]\s)/);
        if (numbered.length > 1) {
          // Multiple numbered questions — divide options evenly or use them per question
          questionBlocks = numbered.map((q, idx) => ({
            question: q.replace(/^\d+[\.\)]\s*/, '').trim(),
            options: rawOptions.length > 0 && numbered.length <= rawOptions.length
              ? [] // options will be shown with the text
              : [],
          }));
          // If options exist, try to assign them — they often map 1:1 or are shared
          if (rawOptions.length > 0) {
            if (rawOptions.length >= questionBlocks.length * 2) {
              // Enough options to split evenly
              const perQ = Math.ceil(rawOptions.length / questionBlocks.length);
              questionBlocks.forEach((qb, idx) => {
                qb.options = rawOptions.slice(idx * perQ, (idx + 1) * perQ);
              });
            } else {
              // Share all options with each question
              questionBlocks.forEach(qb => { qb.options = rawOptions; });
            }
          }
        } else {
          // Single question with options
          questionBlocks = [{ question: rawQuestion, options: rawOptions }];
        }
      }

      // Build question blocks HTML — each question is a separate section.
      // Each option is its own clickable card/box (not inline chips).
      // Below the option cards, a free-text input lets the user type a custom answer.
      const questionBlocksHtml = questionBlocks.map((qb, qi) => {
        const optionCards = (qb.options || []).map(opt => {
          const escaped = escHtml(opt);
          return `<button class="clarification-option-card" data-qi="${qi}" onclick="window.__toggleClarificationChip && window.__toggleClarificationChip(this)">${escaped}</button>`;
        }).join('');

        return `<div class="clarification-question-block" data-qi="${qi}">
      <p class="clarification-question">${escHtml(qb.question)}</p>
      ${optionCards ? `<div class="clarification-options-grid">${optionCards}</div>` : ''}
      <textarea class="clarification-freetext" data-qi="${qi}" rows="1" placeholder="Or type your own answer..."></textarea>
    </div>`;
      }).join('\n');

      const formattedQuestion = `
<div class="clarification-card">
  <div class="clarification-header">
    <span class="clarification-icon">&#x1f4ac;</span>
    <span class="clarification-title">${questionBlocks.length > 1 ? 'A few quick questions' : 'Quick Question'}</span>
  </div>
  <div class="clarification-body">
    ${questionBlocksHtml}
    <div class="clarification-submit-row">
      <button class="clarification-submit-btn" onclick="window.__submitClarificationAnswers && window.__submitClarificationAnswers(this)">Submit Answers</button>
    </div>
  </div>
</div>`;

      addMessage?.({ type: 'assistant', content: formattedQuestion, isHTML: true });

      setAwaitingClarification(true);
      setAwaitingApproval(false);
      setIsRunning(false);

      return {
        success: true,
        needsClarification: true,
        questions: questionBlocks,
        question: rawQuestion,
        suggestedOptions: rawOptions,
      };
    }

    // ─── Present plan (approval) ───
    if (type === ResultType.PRESENT_PLAN) {
      setAwaitingApproval(true);
      setAwaitingClarification(false);
      setPendingStoryline(result.storyline || result.plan);
      setIsRunning(false);
      setAgentLogs(result.thinkingLog || agent.thinkingLog || []);

      return {
        success: true,
        needsApproval: true,
        storyline: result.storyline || result.plan,
        steps: result.steps || agent.steps || [],
        logs: result.thinkingLog || agent.thinkingLog || [],
      };
    }

    // ─── Done ───
    if (type === ResultType.DONE) {
      setIsRunning(false);
      setAwaitingClarification(false);
      setAwaitingApproval(false);
      setPhase(AgentPhase.READY);
      setCurrentProgress(null);
      setAgentLogs(result.thinkingLog || agent.thinkingLog || []);

      return {
        success: true,
        directCreation: true,  // Slides were created directly by agent tools
        summary: result.summary,
        structure: result.output,
        reportHTML: result.reportHTML || null,
        thinkingLog: result.thinkingLog || agent.thinkingLog || [],
        budgetUsed: result.budgetUsed,
        budgetTotal: result.budgetTotal,
        logs: result.thinkingLog || agent.thinkingLog || [],
      };
    }

    // ─── Stuck / Error / Aborted ───
    if (type === ResultType.STUCK || type === ResultType.ABORTED || type === ResultType.GUARDRAIL) {
      setIsRunning(false);
      setAwaitingClarification(false);
      setAwaitingApproval(false);
      setPhase(AgentPhase.ERROR);
      setCurrentProgress(null);

      return {
        success: false,
        error: result.reason || result.summary || 'Agent could not complete the task',
        suggestions: result.suggestions,
      };
    }

    // ─── Budget exhausted ───
    if (type === ResultType.BUDGET_EXHAUSTED) {
      setIsRunning(false);
      setPhase(AgentPhase.READY);
      setAgentLogs(result.thinkingLog || agent.thinkingLog || []);

      const hasSlides = result.output?.slidesCreated > 0;

      // Keep progress visible so user sees WHERE we stopped + budget info
      setCurrentProgress(prev => ({
        ...(prev || {}),
        phase: 'Budget reached — say "continue" to keep going',
        message: result.summary || 'Budget reached',
        steps: agent.steps || prev?.steps || [],
        budget: agent.getBudgetInfo(),
        budgetExhausted: true,
      }));

      return {
        success: hasSlides,
        directCreation: hasSlides,
        canResume: true,
        summary: result.summary,
        structure: result.output,
        budgetUsed: result.budgetUsed,
        budgetTotal: result.budgetTotal,
        logs: result.thinkingLog || agent.thinkingLog || [],
        error: hasSlides ? null : result.summary || 'Budget reached — say "continue" to add credits and keep going',
      };
    }

    // Fallback
    setIsRunning(false);
    return { success: false, error: 'Unexpected result type' };
  }, [addMessage]);

  /**
   * Process user request through the generic agent
   * Returns: { needsClarification } | { needsApproval, storyline } | { directCreation } | { error }
   */
  const prepareContent = useCallback(async (userRequest, options = {}) => {
    const { reportMode = false } = options;
    const isClarificationResponse = awaitingClarification && agentRef.current;

    setIsRunning(true);
    setAwaitingClarification(false);

    if (!isClarificationResponse) {
      // Fresh request — reset logs
      setThinkingLog([]);
      setAgentLogs([]);
      setAiIOLog([]);
      setPhase(AgentPhase.THINKING);
      setCurrentProgress({
        phase: 'thinking',
        message: 'Reading and understanding your request',
        steps: [],
      });
    } else {
      setPhase(AgentPhase.THINKING);
      setCurrentProgress({
        phase: 'thinking',
        message: 'Incorporating your answers',
        steps: [],
      });
    }

    // Build context
    const slides = stateRef.current.slides || [];
    const storyline = stateRef.current.storyline || [];
    const context = {
      slideCount: slides.length,
      hasStoryline: storyline.length > 0,
      storylineSummary: storyline.map(s => s.title).join(' -> '),
      slideSummaries: slides.map((s, idx) => ({
        index: idx,
        title: s.title || 'Untitled',
        type: s.type || 'custom',
      })),
      activeFlow,
    };

    try {
      let result;
      const agent = getOrCreateAgent();

      // Pass reportMode to agent so it skips slide creation and generates HTML report
      if (reportMode) {
        agent._reportMode = true;
      }

      if (isClarificationResponse) {
        // Resume agent after clarification
        result = await agent.resume(userRequest, 'clarification');
      } else if (agent.workspace) {
        // Existing agent with workspace — new request in same session
        result = await agent.run(userRequest, context);
      } else {
        // Fresh start
        result = await agent.run(userRequest, context);
      }

      return handleResult(result, agent);

    } catch (error) {
      console.error('[useAgenticExecution] Error:', error);
      setIsRunning(false);
      setAwaitingClarification(false);
      setAwaitingApproval(false);
      setPhase(AgentPhase.ERROR);
      setCurrentProgress(null);
      return { success: false, error: error.message };
    }
  }, [addMessage, getOrCreateAgent, handleResult, activeFlow, awaitingClarification]);

  /**
   * Approve storyline and resume agent
   */
  const approveStoryline = useCallback(async (editedStoryline = null) => {
    const agent = agentRef.current;
    if (!agent) return { success: false, error: 'No agent instance' };

    setIsRunning(true);
    setAwaitingApproval(false);
    setPendingStoryline(null);

    try {
      const input = {
        approved: true,
        editedStoryline: editedStoryline || null,
        editedPlan: editedStoryline || null,
      };

      const result = await agent.resume(input, 'approval');
      return handleResult(result, agent);

    } catch (error) {
      console.error('[useAgenticExecution] Approval error:', error);
      setIsRunning(false);
      setPhase(AgentPhase.ERROR);
      return { success: false, error: error.message };
    }
  }, [handleResult]);

  /**
   * Reject storyline — reset agent so user can give new instructions
   */
  const rejectStoryline = useCallback(() => {
    setAwaitingApproval(false);
    setPendingStoryline(null);
    setPhase(AgentPhase.IDLE);
    setCurrentProgress(null);
    setIsRunning(false);
    // Keep agent alive for context but clear plan
    if (agentRef.current?.workspace) {
      agentRef.current.workspace.plan = null;
    }
  }, []);

  /**
   * Revise storyline — user gives feedback instead of approving
   */
  const reviseStoryline = useCallback(async (userFeedback, editedStoryline = null) => {
    const agent = agentRef.current;
    if (!agent) return { success: false, error: 'No agent instance' };

    setIsRunning(true);
    setAwaitingApproval(false);
    setPendingStoryline(null);

    // Give agent more budget for revision
    agent.extendBudget(3);

    try {
      const input = {
        approved: false,
        feedback: userFeedback,
        editedStoryline: editedStoryline || null,
        editedPlan: editedStoryline || null,
      };

      const result = await agent.resume(input, 'revision');
      return handleResult(result, agent);

    } catch (error) {
      console.error('[useAgenticExecution] Revision error:', error);
      setIsRunning(false);
      return { success: false, error: error.message };
    }
  }, [handleResult]);

  /**
   * Check if agent is awaiting any user response
   */
  const isAwaitingResponse = useCallback(() => {
    return awaitingClarification || awaitingApproval;
  }, [awaitingClarification, awaitingApproval]);

  const stop = useCallback(() => {
    if (agentRef.current) {
      agentRef.current.abort();
    }
    setIsRunning(false);
    setAwaitingClarification(false);
    setAwaitingApproval(false);
    setPendingStoryline(null);
    setPhase(AgentPhase.IDLE);
    setCurrentProgress(null);
  }, []);

  /**
   * Extend agent budget by a given amount
   */
  const extendBudget = useCallback((credits = 10) => {
    if (agentRef.current) {
      agentRef.current.extendBudget(credits);
      // Update progress to reflect new budget
      setCurrentProgress(prev => prev ? {
        ...prev,
        budget: agentRef.current.getBudgetInfo(),
      } : prev);
    }
  }, []);

  /**
   * Continue execution — extend budget and resume from where the agent stopped.
   * Used when user says "continue", "keep going", "go on" after budget exhaustion.
   * Returns the same result shape as prepareContent.
   */
  const continueExecution = useCallback(async (extraCredits = 15) => {
    const agent = agentRef.current;
    if (!agent) return { success: false, error: 'No agent to continue — start a new request' };

    // Extend budget
    agent.extendBudget(extraCredits);

    setIsRunning(true);
    setPhase(AgentPhase.THINKING);
    setCurrentProgress({
      phase: 'thinking',
      message: `Continuing with ${extraCredits} more credits`,
      steps: agent.steps || [],
      budget: agent.getBudgetInfo(),
    });

    try {
      // Resume with a "continue" instruction
      const result = await agent.resume('CONTINUE — budget extended. Assess where you are and decide the smartest next step. Do NOT redo completed phases.', 'clarification');
      return handleResult(result, agent);
    } catch (error) {
      console.error('[useAgenticExecution] Continue error:', error);
      setIsRunning(false);
      setPhase(AgentPhase.ERROR);
      return { success: false, error: error.message };
    }
  }, [handleResult]);

  /**
   * Push a live message to the running agent's input queue.
   * Used when user sends a message while the agent is executing.
   * The agent drains the queue at checkpoints between workers.
   *
   * @param {string} message - User's message
   * @param {Object} meta    - Optional {addBudget: N}
   * @returns {boolean} true if message was pushed, false if no running agent
   */
  const pushLiveInput = useCallback((message, meta = {}) => {
    const agent = agentRef.current;
    if (!agent || !agent._loopRunning) return false;

    agent.pushInput(message, meta);

    // Show user their message was received
    addMessage?.({ type: 'user', content: message });

    // Acknowledge in progress
    setCurrentProgress(prev => prev ? {
      ...prev,
      liveInputCount: (prev.liveInputCount || 0) + 1,
      lastLiveInput: message.slice(0, 60),
    } : prev);

    return true;
  }, [addMessage]);

  const clear = useCallback(() => {
    if (agentRef.current) {
      agentRef.current.abort();
    }
    setPhase(AgentPhase.IDLE);
    setCurrentProgress(null);
    setIsRunning(false);
    setAwaitingClarification(false);
    setAwaitingApproval(false);
    setPendingStoryline(null);
    setAgentLogs([]);
    setThinkingLog([]);
    setAiIOLog([]);
    agentRef.current = null;
  }, []);

  return {
    // State
    phase,
    currentProgress,
    isRunning,
    awaitingClarification,
    awaitingApproval,
    pendingStoryline,
    agentLogs,
    thinkingLog,
    aiIOLog,

    // Actions
    prepareContent,
    approveStoryline,
    rejectStoryline,
    reviseStoryline,
    isAwaitingResponse,
    extendBudget,
    continueExecution,
    pushLiveInput,
    stop,
    clear,
  };
}

export { AgentPhase };
export default useAgenticExecution;
