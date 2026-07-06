import { Request, Response } from 'express';
import { listSkillMetadata } from './skills.service';

/**
 * GET /api/skills
 * Returns metadata for all available skills (id, name, description, category, order).
 * Intentionally does NOT return the markdown body -- skill bodies stay server-side
 * and are injected by the AI proxy when a router request includes `_skillId`.
 */
export function listSkills(_req: Request, res: Response): void {
  const skills = listSkillMetadata();
  res.json({ skills });
}
