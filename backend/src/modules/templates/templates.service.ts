import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/database';
import { ApiError } from '../../common/middleware/error.middleware';

export interface Template {
  id: string;
  themeId: string | null;
  name: string;
  description: string | null;
  type: string;
  master: string;
  category: string;
  html: string;
  pptxRendererCode: string | null;
  note: string | null;
  thumbnail: string | null;
  organizationId: string | null;
  createdBy: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateTemplateInput {
  themeId?: string;
  name: string;
  description?: string;
  type: string;
  master: string;
  category: string;
  html: string;
  pptxRendererCode?: string;
  note?: string;
  thumbnail?: string;
  organizationId?: string;
  createdBy: string;
  isPublic?: boolean;
}

interface UpdateTemplateInput {
  themeId?: string | null;
  name?: string;
  description?: string;
  type?: string;
  master?: string;
  category?: string;
  html?: string;
  pptxRendererCode?: string;
  note?: string;
  thumbnail?: string;
  isPublic?: boolean;
}

// Create a new template
export async function createTemplate(input: CreateTemplateInput): Promise<Template> {
  const {
    themeId,
    name,
    description,
    type,
    master,
    category,
    html,
    pptxRendererCode,
    note,
    thumbnail,
    organizationId,
    createdBy,
    isPublic,
  } = input;

  const id = uuidv4();
  const now = new Date();

  const template: Template = {
    id,
    themeId: themeId || null,
    name,
    description: description || null,
    type,
    master,
    category,
    html,
    pptxRendererCode: pptxRendererCode || null,
    note: note || null,
    thumbnail: thumbnail || null,
    organizationId: organizationId || null,
    createdBy,
    isPublic: isPublic ?? false,
    createdAt: now,
    updatedAt: now,
  };

  await query(
    `INSERT INTO templates (id, theme_id, name, description, type, master, category, html, pptx_renderer_code, note, thumbnail, organization_id, created_by, is_public, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [id, themeId || null, name, description, type, master, category, html, pptxRendererCode || null, note, thumbnail, organizationId, createdBy, isPublic ?? false, now, now]
  );

  return template;
}

// Create multiple templates at once (for bulk import)
export async function createTemplates(templates: CreateTemplateInput[]): Promise<Template[]> {
  const results: Template[] = [];
  for (const input of templates) {
    const template = await createTemplate(input);
    results.push(template);
  }
  return results;
}

// Get all organization IDs a user belongs to
async function getUserOrganizationIds(userId: string): Promise<string[]> {
  const result = await query<{ organization_id: string }>(
    `SELECT organization_id FROM organization_members WHERE user_id = $1`,
    [userId]
  );
  return result.rows.map(r => r.organization_id);
}

// Get all templates for a user (their own + org templates + public templates)
export async function getTemplates(userId: string, organizationId?: string): Promise<Template[]> {
  // Get all organizations the user belongs to
  const userOrgIds = await getUserOrganizationIds(userId);

  const result = await query<any>(
    `SELECT * FROM templates WHERE
     is_public = true
     OR created_by = $1
     OR organization_id = ANY($2::text[])
     ORDER BY category, name`,
    [userId, userOrgIds]
  );

  return result.rows.map(mapRowToTemplate);
}

// Check if user has access to a template
export async function canAccessTemplate(userId: string, templateId: string): Promise<boolean> {
  const template = await getTemplate(templateId);
  if (!template) return false;

  // Public templates are accessible to all
  if (template.isPublic) return true;

  // User's own templates are accessible
  if (template.createdBy === userId) return true;

  // Templates from user's organizations are accessible
  if (template.organizationId) {
    const userOrgIds = await getUserOrganizationIds(userId);
    if (userOrgIds.includes(template.organizationId)) return true;
  }

  return false;
}

// Get templates by theme ID
export async function getTemplatesByTheme(themeId: string): Promise<Template[]> {
  const result = await query<any>(
    `SELECT * FROM templates WHERE theme_id = $1 ORDER BY category, name`,
    [themeId]
  );

  return result.rows.map(mapRowToTemplate);
}

// Get a specific template by ID
export async function getTemplate(id: string): Promise<Template | null> {
  const result = await query<any>(
    `SELECT * FROM templates WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;
  return mapRowToTemplate(result.rows[0]);
}

// Update a template
export async function updateTemplate(id: string, updates: UpdateTemplateInput): Promise<Template> {
  const existing = await getTemplate(id);
  if (!existing) {
    throw ApiError.notFound('Template');
  }

  const now = new Date();

  await query(
    `UPDATE templates SET
       theme_id = COALESCE($1, theme_id),
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       type = COALESCE($4, type),
       master = COALESCE($5, master),
       category = COALESCE($6, category),
       html = COALESCE($7, html),
       pptx_renderer_code = COALESCE($8, pptx_renderer_code),
       note = COALESCE($9, note),
       thumbnail = COALESCE($10, thumbnail),
       updated_at = $11
     WHERE id = $12`,
    [
      updates.themeId !== undefined ? updates.themeId : null,
      updates.name || null,
      updates.description !== undefined ? updates.description : null,
      updates.type || null,
      updates.master || null,
      updates.category || null,
      updates.html || null,
      updates.pptxRendererCode !== undefined ? updates.pptxRendererCode : null,
      updates.note !== undefined ? updates.note : null,
      updates.thumbnail !== undefined ? updates.thumbnail : null,
      now,
      id,
    ]
  );

  return {
    ...existing,
    ...updates,
    updatedAt: now,
  } as Template;
}

// Delete a template
export async function deleteTemplate(id: string): Promise<void> {
  await query(`DELETE FROM templates WHERE id = $1`, [id]);
}

// Delete all templates for a theme
export async function deleteTemplatesByTheme(themeId: string): Promise<void> {
  await query(`DELETE FROM templates WHERE theme_id = $1`, [themeId]);
}

// Helper to map database row to Template object
function mapRowToTemplate(row: any): Template {
  return {
    id: row.id,
    themeId: row.theme_id,
    name: row.name,
    description: row.description,
    type: row.type,
    master: row.master,
    category: row.category,
    html: row.html,
    pptxRendererCode: row.pptx_renderer_code || null,
    note: row.note,
    thumbnail: row.thumbnail,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
