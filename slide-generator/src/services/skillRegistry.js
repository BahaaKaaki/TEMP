/**
 * Skill Registry — Pluggable Knowledge for the Generic Agent
 *
 * Skills are natural-language knowledge that inform agent reasoning
 * without dictating behavior. Adding a new skill requires zero changes
 * to the core loop — just add an entry here.
 *
 * Each skill has:
 *   - id: unique identifier
 *   - name: human-readable label
 *   - methodology: natural language describing HOW to apply this skill
 *   - appliesWhen: hints for when this skill is relevant
 */

const DEFAULT_SKILLS = [
  {
    id: 'consulting-team',
    name: 'Consulting Team Context',
    appliesWhen: 'Always — provides context about the working environment',
    methodology: `\
- You LEAD a consulting engagement team producing deliverables for clients
- You can dynamically scope work, staff a team, and delegate tasks to consultants
- Everyone on the team is a CONSULTANT — each with a unique persona and focus area (e.g. research-focused, data-focused, industry expert, content strategist). The manager coordinates.
- Staff based on complexity: simple tasks → work solo, complex tasks → assemble a team of consultants with distinct personas
- Delegate specialized work to the right consultant persona — they will produce deliverables in character
- Deliverables should be professional, data-driven, and tailored to the audience
- Let the user's request drive the structure and content — do not impose a fixed flow of activities`,
  },
  {
    id: 'team-dynamics',
    name: 'Team Dynamics & Delegation',
    appliesWhen: 'Deciding whether to scope, staff, or delegate work',
    methodology: `\
- SCOPE FIRST: On complex or ambiguous tasks, assess complexity before diving in. This is free (cost 0).
- STAFF BASED ON NEED: Match team size to task complexity. A 3-slide deck needs no team. A 15-slide strategy deck benefits from 2-3 consultants with different focus areas.
- DELEGATE FOR DEPTH: When you need specialized analysis, industry expertise, or a fresh perspective, delegate to a consultant persona rather than doing everything yourself.
- PERSONAS ADD VALUE: Each consultant brings a distinct lens — one focuses on data & research, another on industry context, another on actionable content.
- BUDGET AWARENESS: Delegation costs 1 credit per task. On tight budgets, work solo. On comfortable budgets, leverage the team.
- NATURAL FLOW: The team's work order should emerge from the task, not from a template. Research before content. Scope before staffing. Review before finalizing.`,
  },
  {
    id: 'consulting-communication',
    name: 'Consulting Communication Standards',
    appliesWhen: 'Building slides, structuring content, writing headlines',
    methodology: `\
- PYRAMID PRINCIPLE: Lead with the answer/insight, then support with evidence. Each slide answers "so what?"
- MECE: Content should be Mutually Exclusive, Collectively Exhaustive — no overlaps, no gaps
- One key message per slide — the headline IS the insight, not a label
- Executive-friendly: every slide earns its place, data over vague statements
- Calibrate depth to audience and configured work level`,
  },
  {
    id: 'content-engine',
    name: 'Content-Focused Agent Role',
    appliesWhen: 'Always — defines the separation between agent and visual engine',
    methodology: `\
- YOUR JOB: Content — research, analyze, structure, write. NOT YOUR JOB: templates, layout, design, batching.
- Full flow: clarify → scope → plan → present_plan → staff → delegate → compile → review → build
- Adapt: simple tasks skip most steps; complex tasks use the full flow
- THE USER SEES EVERY STEP — no hidden work. Every action is visible.
- Ask clarifying questions early for vague requests (purpose, audience, key message)
- Present the plan for approval before expensive work
- Each slide instruction must be SELF-CONTAINED with all data baked in
- Research depth should match the configured work level`,
  },
  {
    id: 'research-synthesis',
    name: 'Research & Data Synthesis',
    appliesWhen: 'Gathering information, analyzing data, finding evidence',
    methodology: `\
- Search for specific data, not general topics
- Use exact numbers and cite sources — never invent statistics
- Distinguish between facts, estimates, and opinions
- When data is unavailable, state it explicitly rather than guessing
- Synthesize findings into clear takeaways with supporting evidence`,
  },
  {
    id: 'quality-review',
    name: 'Quality Review',
    appliesWhen: 'Assessing work quality, checking for issues, validating output',
    methodology: `\
- Check alignment with original task requirements
- Verify data accuracy and consistency across slides
- Ensure narrative coherence — does the story flow logically?
- Check for redundancy or missing content
- Validate completeness and audience-appropriateness
- Verify no placeholder values or fabricated data remain`,
  },
  {
    id: 'budget-efficiency',
    name: 'Budget-Aware Decision Making',
    appliesWhen: 'Always — governs how to allocate limited resources',
    methodology: `\
- Low budget: work solo, go direct, accept "good enough"
- High budget: scope, staff team, research in depth, review, iterate
- Always reserve enough budget for the final build_presentation call (5 credits)
- Scoping and staffing are FREE — use them to make smarter budget decisions
- The goal is the best possible outcome without exploding the budget`,
  },
];

// ─── Registry API ────────────────────────────────────────────────────────────

/**
 * Get formatted skills context for LLM prompts
 * @param {Array} skills - Array of skill objects (defaults to DEFAULT_SKILLS)
 * @returns {string} Formatted skills text
 */
export function getSkillsContext(skills = DEFAULT_SKILLS) {
  return skills.map(s =>
    `[${s.name}] (applies when: ${s.appliesWhen})\n${s.methodology}`
  ).join('\n\n');
}

/**
 * Get a specific skill by ID
 */
export function getSkillById(id, skills = DEFAULT_SKILLS) {
  return skills.find(s => s.id === id) || null;
}

/**
 * Register a new skill (returns a new array — does not mutate)
 */
export function registerSkill(skill, skills = DEFAULT_SKILLS) {
  if (!skill.id || !skill.name || !skill.methodology) {
    throw new Error('Skill must have id, name, and methodology');
  }
  // Replace if exists, append if new
  const existing = skills.findIndex(s => s.id === skill.id);
  const newSkills = [...skills];
  if (existing >= 0) {
    newSkills[existing] = skill;
  } else {
    newSkills.push(skill);
  }
  return newSkills;
}

/**
 * Get all skill IDs
 */
export function getSkillIds(skills = DEFAULT_SKILLS) {
  return skills.map(s => s.id);
}

export { DEFAULT_SKILLS };
