/**
 * Agent Workspace — Shared Memory for the Generic Agent Loop
 *
 * Persists across iterations:
 *   - Original task + context
 *   - All created artifacts (plans, content, slides)
 *   - Reasoning history (auto-compressed: recent detail, older summaries)
 *   - Active subtasks
 *   - User feedback from interactions
 *   - Accumulated knowledge from research/analysis
 *
 * The workspace stays compact to fit context windows. It auto-compresses
 * older entries while keeping recent ones detailed.
 */

// ─── Team roles (for persona-based delegation) ──────────────────────────────
// All team members are "consultants" with different personas/focus areas.
// The manager is the only distinct role (the orchestrator).
export const TeamRole = {
  MANAGER: 'manager',
  CONSULTANT: 'consultant',
};

// ─── Artifact types ──────────────────────────────────────────────────────────
export const ArtifactType = {
  PLAN: 'plan',
  CONTENT: 'content',
  INSIGHT: 'insight',
  SLIDE: 'slide',
  RESEARCH: 'research',
  ANALYSIS: 'analysis',
};

// ─── Workspace ───────────────────────────────────────────────────────────────
export class AgentWorkspace {
  constructor(task, context = {}) {
    this.task = task;                   // Original user request (string)
    this.context = context;             // App context (slides, storyline, etc.)

    this.artifacts = [];                // Produced artifacts [{type, data, description, timestamp}]
    this.reasoningHistory = [];         // [{iteration, action, tool, reasoning, summary, timestamp}]
    this.subtasks = [];                 // Active spawned subtasks
    this.feedback = [];                 // User feedback [{type, content, timestamp}]
    this.knowledge = [];                // Accumulated knowledge [{source, data, forSlides}]
    this.plan = null;                   // Current presentation plan (storyline format)
    this.understanding = null;          // Parsed understanding of the task
    this.slidesCreated = 0;             // Count of slides created through tools

    // ─── Dynamic team simulation ──────────────────────────────────────────
    this.scopeAssessment = null;        // {complexity, estimatedSlides, keyRisks, approach}
    this.team = [];                     // [{role, name, specialty, assignedAt}]
    this.teamLog = [];                  // [{role, name, action, output, timestamp}]
  }

  // ─── Record an action and its result ─────────────────────────────────────
  recordAction(decision, result) {
    const entry = {
      iteration: this.reasoningHistory.length + 1,
      action: decision.action,
      tool: decision.tool || null,
      reasoning: decision.reasoning || '',
      summary: this._summarizeResult(result),
      timestamp: Date.now(),
    };
    this.reasoningHistory.push(entry);

    // Store artifacts from decision or result
    if (decision.artifacts) {
      for (const a of decision.artifacts) {
        this.addArtifact(a.type || ArtifactType.CONTENT, a.data, a.description);
      }
    }

    // Extract knowledge from tool results
    this._extractKnowledge(decision, result);

    // Track slides created
    this._trackSlides(decision, result);

    // Store plan if produced
    if (decision.action === 'present_plan' && decision.plan) {
      this.plan = decision.plan;
    }

    // Store scope assessment
    if (decision.action === 'scope' && decision.scope) {
      this.setScope(decision.scope);
    }

    // Staff team members
    if (decision.action === 'staff_team' && decision.members) {
      for (const m of decision.members) {
        this.staffMember(m.role, m.name, m.specialty);
      }
    }

    // Record delegated work
    if (decision.action === 'delegate' && result?.delegateOutput) {
      this.recordPersonaWork(
        decision.assignTo?.role || 'consultant',
        decision.assignTo?.name || 'Team member',
        decision.delegateTask || 'task',
        result.delegateOutput,
      );
    }

    // Auto-compress to stay within bounds
    this._compress();
  }

  // ─── Add user feedback ───────────────────────────────────────────────────
  addFeedback(input, type) {
    this.feedback.push({
      type,
      content: input,
      timestamp: Date.now(),
    });

    // If approval with edits, update plan
    if (type === 'approval' && typeof input === 'object') {
      if (input.editedPlan) {
        this.plan = input.editedPlan;
      }
      if (input.editedStoryline) {
        this.plan = input.editedStoryline;
      }
    }

    // If revision feedback, record as knowledge
    if (type === 'revision' && typeof input === 'object' && input.feedback) {
      this.knowledge.push({
        source: 'User revision feedback',
        data: input.feedback,
        priority: 'high',
      });
    }
  }

  // ─── Add an artifact ─────────────────────────────────────────────────────
  addArtifact(type, data, description = '') {
    this.artifacts.push({
      type,
      data,
      description: description || `${type} artifact`,
      timestamp: Date.now(),
    });
  }

  // ─── Set understanding ───────────────────────────────────────────────────
  setUnderstanding(understanding) {
    this.understanding = understanding;
  }

  // ─── Scope assessment ────────────────────────────────────────────────
  setScope(assessment) {
    this.scopeAssessment = {
      ...assessment,
      timestamp: Date.now(),
    };
  }

  // ─── Staff a team member ────────────────────────────────────────────
  staffMember(role, name, specialty) {
    // Avoid duplicates by name
    const existing = this.team.find(m => m.name === name);
    if (existing) {
      existing.role = role;
      existing.specialty = specialty;
      return existing;
    }
    const member = { role, name, specialty, assignedAt: Date.now() };
    this.team.push(member);
    return member;
  }

  // ─── Record work done by a team persona ─────────────────────────────
  recordPersonaWork(role, name, action, output) {
    this.teamLog.push({
      role,
      name,
      action,
      output: typeof output === 'string' ? output : JSON.stringify(output).slice(0, 500),
      timestamp: Date.now(),
    });
    // Auto-compress team log
    if (this.teamLog.length > 20) {
      this.teamLog = this.teamLog.slice(-15);
    }
  }

  // ─── Get team context for prompts ───────────────────────────────────
  getTeamContext() {
    if (this.team.length === 0) return '';
    const parts = [];
    parts.push(`TEAM (${this.team.length} members):`);
    for (const m of this.team) {
      parts.push(`  - ${m.name} [${m.role}]: ${m.specialty}`);
    }
    if (this.teamLog.length > 0) {
      const recentWork = this.teamLog.slice(-5);
      parts.push(`RECENT TEAM ACTIVITY:`);
      for (const w of recentWork) {
        parts.push(`  - ${w.name} [${w.role}]: ${w.action} → ${w.output.slice(0, 150)}`);
      }
    }
    return parts.join('\n');
  }

  // ─── Get compressed workspace state for LLM context ──────────────────────
  getCompressed() {
    const parts = [];

    // Task — summarize large requests to avoid flooding context
    const taskText = this.task.length > 2000
      ? (this.scopeAssessment?.requirementsBrief || this.task.slice(0, 2000) + '...(truncated)')
      : this.task;
    parts.push(`TASK: ${taskText}`);

    // Understanding
    if (this.understanding) {
      const u = this.understanding;
      const details = [
        u.topic && `Topic: ${u.topic}`,
        u.audience && `Audience: ${u.audience}`,
        u.purpose && `Purpose: ${u.purpose}`,
        u.slideCount && `Slides: ${u.slideCount}`,
        u.complexity && `Complexity: ${u.complexity}`,
        u.toneGuidance && `Tone: ${u.toneGuidance}`,
      ].filter(Boolean).join(' | ');
      if (details) parts.push(`UNDERSTANDING: ${details}`);
    }

    // Scope assessment
    if (this.scopeAssessment) {
      const sc = this.scopeAssessment;
      const details = [
        sc.complexity && `Complexity: ${sc.complexity}`,
        sc.estimatedSlides && `Est. slides: ${sc.estimatedSlides}`,
        sc.approach && `Approach: ${sc.approach}`,
      ].filter(Boolean).join(' | ');
      parts.push(`SCOPE: ${details}${sc.keyRisks?.length ? `\n  Risks: ${sc.keyRisks.join(', ')}` : ''}`);
    }

    // Team
    const teamCtx = this.getTeamContext();
    if (teamCtx) parts.push(teamCtx);

    // Context (existing deck)
    if (this.context.slideSummaries?.length > 0) {
      parts.push(`EXISTING DECK (${this.context.slideCount || this.context.slideSummaries.length} slides): ${this.context.slideSummaries.map(s => `${s.index + 1}. "${s.title}" (${s.type})`).join(', ')}`);
    }

    // Active flow
    if (this.context.activeFlow) {
      const flow = this.context.activeFlow;
      parts.push(`ACTIVE FLOW: "${flow.name}"\n${flow.sections?.map((s, i) => `  ${i + 1}. "${s.templateHint}" | "${s.instruction}"`).join('\n') || ''}`);
    }

    // Current plan
    if (this.plan) {
      const planText = this._compressPlan(this.plan);
      parts.push(`CURRENT PLAN:\n${planText}`);
    }

    // Knowledge
    if (this.knowledge.length > 0) {
      const knowledgeText = this.knowledge.map(k => {
        const data = typeof k.data === 'string' ? k.data : JSON.stringify(k.data);
        return `- ${k.source}: ${data.slice(0, 400)}`;
      }).join('\n');
      parts.push(`KNOWLEDGE (${this.knowledge.length} items):\n${knowledgeText}`);
    }

    // User feedback
    if (this.feedback.length > 0) {
      const feedbackText = this.feedback.map(f => {
        const content = typeof f.content === 'string' ? f.content : JSON.stringify(f.content).slice(0, 200);
        return `[${f.type.toUpperCase()}] ${content}`;
      }).join('\n');
      parts.push(`USER FEEDBACK (treat as binding):\n${feedbackText}`);
    }

    // Reasoning history — recent detail, older summary
    const recent = this.reasoningHistory.slice(-5);
    const older = this.reasoningHistory.slice(0, -5);

    if (older.length > 0) {
      const olderSummary = older.map(r =>
        `${r.action}${r.tool ? `(${r.tool})` : ''}`
      ).join(' → ');
      parts.push(`EARLIER ACTIONS (${older.length}): ${olderSummary}`);
    }

    if (recent.length > 0) {
      const recentText = recent.map(r =>
        `  ${r.iteration}. [${r.action}]${r.tool ? ` ${r.tool}` : ''}: ${r.summary}`
      ).join('\n');
      parts.push(`RECENT ACTIONS:\n${recentText}`);
    }

    // Slides created count
    if (this.slidesCreated > 0) {
      parts.push(`SLIDES CREATED SO FAR: ${this.slidesCreated}`);
    }

    // Artifacts summary (non-plan, non-slide)
    const otherArtifacts = this.artifacts.filter(a =>
      a.type !== ArtifactType.PLAN && a.type !== ArtifactType.SLIDE
    );
    if (otherArtifacts.length > 0) {
      parts.push(`ARTIFACTS: ${otherArtifacts.map(a => `${a.type}: ${a.description}`).join(', ')}`);
    }

    return parts.join('\n\n');
  }

  // ─── Get full knowledge for content building ─────────────────────────────
  getKnowledgeFull() {
    if (this.knowledge.length === 0) return '(no research — use general knowledge)';
    return this.knowledge.map(k => {
      const data = typeof k.data === 'string' ? k.data : JSON.stringify(k.data, null, 2);
      return `## ${k.source}\n${data}`;
    }).join('\n\n');
  }

  // ─── Get best available output ───────────────────────────────────────────
  getBestOutput() {
    return {
      task: this.task,
      plan: this.plan,
      knowledge: this.knowledge,
      artifacts: this.artifacts,
      slidesCreated: this.slidesCreated,
      reasoningHistory: this.reasoningHistory,
      feedback: this.feedback,
      team: this.team,
      scopeAssessment: this.scopeAssessment,
    };
  }

  // ─── Check if task has meaningful output ─────────────────────────────────
  hasOutput() {
    return this.slidesCreated > 0 || this.plan !== null || this.artifacts.length > 0;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  _extractKnowledge(decision, result) {
    if (decision.action !== 'use_tool') {
      // Extract from think_more analysis
      if (decision.action === 'think_more' && decision.analysis) {
        this.knowledge.push({
          source: `Analysis: ${decision.topic || 'general'}`,
          data: decision.analysis,
        });
      }
      // Extract from review
      if (decision.action === 'review' && decision.analysis) {
        this.knowledge.push({
          source: `Review: ${decision.topic || 'quality check'}`,
          data: decision.analysis,
        });
      }
      return;
    }

    // Tool-specific knowledge extraction
    if (!result || result.success === false) return;

    switch (decision.tool) {
      case 'research_topic': {
        this.knowledge.push({
          source: `Research: ${decision.params?.topic || 'topic'}`,
          data: result.research || result,
          forSlides: decision.forSlides,
        });
        break;
      }
      case 'search_knowledge_base': {
        if (result.formattedContext) {
          this.knowledge.push({
            source: `KB search: ${decision.params?.query || 'query'}`,
            data: result.formattedContext,
          });
        }
        break;
      }
      case 'analyze_content': {
        this.knowledge.push({
          source: `Content analysis: ${decision.params?.focus || 'all'}`,
          data: result.analysis || result,
        });
        break;
      }
      case 'generate_benchmarks': {
        this.knowledge.push({
          source: `Benchmarks: ${decision.params?.topic || 'topic'}`,
          data: result.benchmarks || result,
        });
        break;
      }
      case 'plan_presentation': {
        if (result.storyline) {
          this.plan = result.storyline;
        }
        break;
      }
    }
  }

  _trackSlides(decision, result) {
    if (decision.action !== 'use_tool') return;
    if (decision.tool === 'create_slide' && result?.success) {
      this.slidesCreated++;
    }
    if (decision.tool === 'create_slides_batch' && result?.created) {
      this.slidesCreated += result.created;
    }
  }

  _compressPlan(plan) {
    if (!plan) return '(none)';
    const parts = [];
    if (plan.mainMessage || plan.governingThought) {
      parts.push(`Main message: ${plan.mainMessage || plan.governingThought}`);
    }
    if (plan.presentationTitle) {
      parts.push(`Title: ${plan.presentationTitle}`);
    }
    const sections = plan.sections || plan.slidesPlan || [];
    if (sections.length > 0) {
      parts.push(`Slides (${sections.length}):`);
      for (const s of sections) {
        const title = s.sectionTitle || s.title || 'Untitled';
        const msg = s.keyMessage || '';
        const type = s.contentType || '';
        parts.push(`  - "${title}" [${type}] ${msg ? '— ' + msg : ''}`);
      }
    }
    return parts.join('\n');
  }

  _summarizeResult(result) {
    if (!result) return '(no result)';
    if (result.pause) return `Paused: ${result.type}`;
    if (result.done) return `Done: ${result.summary || 'completed'}`;
    if (result.success === false) return `Failed: ${result.error || 'unknown'}`;
    if (result.message) return result.message;
    if (result.success) return result.message || 'OK';
    // Fallback
    const str = JSON.stringify(result);
    return str.length > 120 ? str.slice(0, 117) + '...' : str;
  }

  _compress() {
    // Knowledge: NO truncation — all worker findings must reach compilation
    // The manager needs every piece of research to produce a comprehensive report

    // Cap artifacts — keep last 20 (slide assets, not research data)
    const MAX_ARTIFACTS = 20;
    if (this.artifacts.length > MAX_ARTIFACTS) {
      this.artifacts = this.artifacts.slice(-MAX_ARTIFACTS);
    }
  }
}
