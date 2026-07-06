/**
 * Knowledge Base Service
 *
 * Persists consulting team engagement history so past work can be:
 * - Reviewed by the user (topic, plan, findings, outcomes)
 * - Referenced by future agent runs (cached research, patterns)
 *
 * Storage: localStorage (key: 'consulting_knowledge_base')
 * Each entry is a compact summary of one engagement.
 */

const STORAGE_KEY = 'consulting_knowledge_base';
const MAX_ENTRIES = 50; // Keep last 50 engagements

// ─── Read/Write ──────────────────────────────────────────────────────────────

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _save(entries) {
  try {
    // Keep only the most recent MAX_ENTRIES
    const trimmed = entries.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[KnowledgeBase] Save failed:', e.message);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Save a completed engagement to the knowledge base.
 *
 * @param {object} engagement - The engagement data to save
 * @param {string} engagement.topic - Topic/title of the presentation
 * @param {string} engagement.request - Original user request
 * @param {object} engagement.scoping - Partner scoping result
 * @param {object} engagement.storylineDirection - Partner's storyline direction
 * @param {object} engagement.detailedPlan - Manager's detailed plan (slides + work packages)
 * @param {Array}  engagement.consultantOutputs - Results from consultant work packages
 * @param {object} engagement.finalStructure - Final slide structure (after partner review)
 * @param {Array}  engagement.thinkingLog - Full thinking log from the team
 * @param {object} engagement.budget - Budget info { total, used }
 */
export function saveEngagement(engagement) {
  const entries = _load();

  const entry = {
    id: `eng_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),

    // Core info
    topic: engagement.topic || 'Untitled',
    request: engagement.request || '',
    slideCount: engagement.finalStructure?.sections?.length || engagement.scoping?.slideCount || 0,

    // Scoping
    scoping: engagement.scoping ? {
      topic: engagement.scoping.topic,
      complexity: engagement.scoping.complexity,
      audience: engagement.scoping.audience,
      purpose: engagement.scoping.purpose,
      needsSearch: engagement.scoping.needsSearch,
      keyQuestions: engagement.scoping.keyQuestions,
      toneGuidance: engagement.scoping.toneGuidance,
    } : null,

    // Storyline
    storyline: engagement.storylineDirection ? {
      archetype: engagement.storylineDirection.archetypeName,
      governingThought: engagement.storylineDirection.governingThought,
      bullets: (engagement.storylineDirection.bullets || []).map(b => ({
        title: b.title,
        intent: b.intent,
      })),
      toneDirection: engagement.storylineDirection.toneDirection,
    } : null,

    // Plan summary
    plan: engagement.detailedPlan ? {
      totalSlides: engagement.detailedPlan.totalSlides,
      workPackages: (engagement.detailedPlan.workPackages || []).map(wp => ({
        title: wp.title,
        tasks: wp.tasks,
        forSlides: wp.forSlides,
        needsSearch: wp.needsSearch,
      })),
      selfHandled: engagement.detailedPlan.selfHandled,
    } : null,

    // Consultant findings (compact)
    findings: (engagement.consultantOutputs || []).filter(Boolean).map(r => ({
      title: r.title,
      findings: typeof r.findings === 'string' ? r.findings : '',
      insights: r.insights || [],
      dataPoints: r.dataPoints || [],
      themes: r.themes || [],
      confidence: r.confidence,
      source: r.source,
    })),

    // Final output (slide titles + key messages)
    output: engagement.finalStructure ? {
      title: engagement.finalStructure.presentationTitle,
      mainMessage: engagement.finalStructure.mainMessage,
      storylineType: engagement.finalStructure.storylineType,
      slides: (engagement.finalStructure.sections || []).map(s => ({
        title: s.sectionTitle,
        keyMessage: s.keyMessage,
        contentType: s.contentType,
      })),
    } : null,

    // Router input — exact slide instructions sent to build_presentation
    routerInput: (engagement.routerInput || []).map(s => ({
      index: s.index,
      title: s.title,
      keyMessage: s.keyMessage,
      contentType: s.contentType,
      content: s.content,
    })),

    // Router prompt — the FULL prompt string sent to the router (combinedPrompt or richPrompt)
    // This is what the user asked to see: the exact input the router receives
    routerPrompt: engagement.routerPrompt || null,

    // Router plan — template selection decisions [{templateId, instruction, sectionTracker}]
    routerPlan: engagement.routerPlan || null,

    // Manager queries — structured research work plan + phase execution
    managerQueries: (engagement.managerQueries || []).map(q => ({
      iteration: q.iteration,
      action: q.action,
      query: q.query || '',
      reasoning: q.reasoning || '',
      description: q.description || '',
      phases: q.phases || undefined,
    })),

    // Team activity summary (compact log)
    teamLog: (engagement.thinkingLog || []).map(t => ({
      role: t.role,
      action: t.message || t.action,
    })),

    // All LLM exchanges — input/output for every call
    aiIOLog: (engagement.aiIOLog || []).map(io => ({
      step: io.step || '',
      input: io.input || '',
      output: io.output || '',
      timestamp: io.timestamp || '',
      duration: io.duration || 0,
      model: io.model || '',
      error: io.error || false,
    })),

    // Budget
    budget: engagement.budget || { total: 0, used: 0 },

    // Report HTML (if report mode) — stored for visibility/re-download
    // Truncated to 200K to keep localStorage manageable
    reportHTML: engagement.reportHTML
      ? engagement.reportHTML.slice(0, 200000)
      : null,
  };

  entries.push(entry);
  _save(entries);

  return entry.id;
}

/**
 * Get all saved engagements (most recent first).
 */
export function listEngagements() {
  return _load().reverse();
}

/**
 * Get a single engagement by ID.
 */
export function getEngagement(id) {
  return _load().find(e => e.id === id) || null;
}

/**
 * Delete an engagement by ID.
 */
export function deleteEngagement(id) {
  const entries = _load().filter(e => e.id !== id);
  _save(entries);
}

/**
 * Clear all engagements.
 */
export function clearKnowledgeBase() {
  _save([]);
}

/**
 * Get a compact summary of recent engagements for agent context.
 * Used to give the partner awareness of past work.
 *
 * @param {number} limit - Max entries to include (default 5)
 * @returns {string} - Text summary of recent engagements
 */
export function getRecentContext(limit = 5) {
  const entries = _load().slice(-limit).reverse();
  if (entries.length === 0) return '';

  return entries.map((e, i) => {
    const slides = e.output?.slides?.map(s => s.title).join(' → ') || '(none)';
    return `${i + 1}. "${e.topic}" (${e.date}) — ${e.slideCount} slides
   Audience: ${e.scoping?.audience || '?'} | Purpose: ${e.scoping?.purpose || '?'}
   Flow: ${slides}
   Key findings: ${e.findings?.map(f => f.title).join(', ') || 'none'}`;
  }).join('\n\n');
}

export default {
  saveEngagement,
  listEngagements,
  getEngagement,
  deleteEngagement,
  clearKnowledgeBase,
  getRecentContext,
};
