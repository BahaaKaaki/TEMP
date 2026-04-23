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
 * @property {string} [subCategory]
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
        subCategory: typeof s.subCategory === 'string' ? s.subCategory : undefined,
        order: typeof s.order === 'number' ? s.order : 999,
      }));
  } catch (err) {
    console.warn('[skillsService] GET /api/skills threw:', err?.message || err);
    return [];
  }
}

/**
 * Group skills by category, then by optional sub-category within each
 * category. Each category exposes a flat `skills` array (sorted by `order`
 * then `name`) and a nested `subGroups` array whose entries are keyed by
 * `subCategory`. Categories without sub-categories produce a single
 * sub-group with `subCategory: null`, letting the picker render a flat list.
 *
 * Ordering:
 *   - Skills inside a sub-group sort by `order` then `name`.
 *   - Sub-groups sort by the smallest `order` they contain.
 *   - Categories sort by the smallest `order` they contain.
 *
 * @param {SkillMetadata[]} skills
 * @returns {Array<{category: string, skills: SkillMetadata[], subGroups: Array<{subCategory: string|null, skills: SkillMetadata[]}>}>}
 */
export function groupSkillsByCategory(skills) {
  const byCategory = new Map();
  for (const skill of skills) {
    const key = skill.category || 'Other';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(skill);
  }

  const groups = [];
  for (const [category, list] of byCategory.entries()) {
    list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name));

    const bySub = new Map();
    for (const skill of list) {
      const subKey = skill.subCategory || null;
      if (!bySub.has(subKey)) bySub.set(subKey, []);
      bySub.get(subKey).push(skill);
    }
    const subGroups = [];
    for (const [subCategory, subList] of bySub.entries()) {
      subGroups.push({
        subCategory,
        skills: subList,
        minOrder: subList[0]?.order ?? 999,
      });
    }
    subGroups.sort((a, b) => a.minOrder - b.minOrder);

    groups.push({
      category,
      skills: list,
      subGroups: subGroups.map(({ subCategory, skills: s }) => ({ subCategory, skills: s })),
      minOrder: list[0]?.order ?? 999,
    });
  }
  groups.sort((a, b) => a.minOrder - b.minOrder || a.category.localeCompare(b.category));
  return groups.map(({ category, skills, subGroups }) => ({ category, skills, subGroups }));
}
