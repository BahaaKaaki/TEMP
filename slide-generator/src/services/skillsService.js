/**
 * Tiny client for the backend's skills catalogue.
 *
 * `GET /api/skills` returns metadata only (id, name, description, category,
 * order). Skill markdown bodies are server-only and are injected by the AI
 * proxy when a router request includes `_skillId`.
 *
 * The shape returned here matches `state.availableSkills` in SlideContext.
 */

/**
 * @typedef {Object} SkillMetadata
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} category
 * @property {number} order
 */

/**
 * Fetch the skills catalogue. Always resolves to an array; logs and returns []
 * on failure so callers don't need to catch.
 * @returns {Promise<SkillMetadata[]>}
 */
export async function loadSkills() {
  try {
    const res = await fetch('/api/skills', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn('[skillsService] GET /api/skills failed status=%d', res.status);
      return [];
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.skills)) {
      console.warn('[skillsService] unexpected payload shape:', data);
      return [];
    }
    return data.skills
      .filter(s => s && typeof s.id === 'string')
      .map(s => ({
        id: s.id,
        name: typeof s.name === 'string' ? s.name : s.id,
        description: typeof s.description === 'string' ? s.description : '',
        category: typeof s.category === 'string' ? s.category : 'Other',
        order: typeof s.order === 'number' ? s.order : 999,
      }));
  } catch (err) {
    console.warn('[skillsService] GET /api/skills threw:', err?.message || err);
    return [];
  }
}

/**
 * Group skills by category, keeping each group sorted by `order` then `name`,
 * and the groups themselves sorted by the smallest `order` they contain.
 * Useful when the dropdown grows beyond a single category.
 * @param {SkillMetadata[]} skills
 */
export function groupSkillsByCategory(skills) {
  const buckets = new Map();
  for (const skill of skills) {
    const key = skill.category || 'Other';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(skill);
  }
  const result = [];
  for (const [category, list] of buckets.entries()) {
    list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name));
    result.push({ category, skills: list, minOrder: list[0]?.order ?? 999 });
  }
  result.sort((a, b) => a.minOrder - b.minOrder || a.category.localeCompare(b.category));
  return result.map(({ category, skills }) => ({ category, skills }));
}
