import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as templateService from './templates.service';
import { AuthRequest } from '../../common/types/index';
import { ApiError } from '../../common/middleware/error.middleware';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PPTX_MASTER_PATH = path.join(UPLOADS_DIR, 'pptx-master.pptx');
const PPTX_META_PATH = path.join(UPLOADS_DIR, 'pptx-master.meta.json');
const DEFAULT_PPTX_PATH = path.join(process.cwd(), 'assets', 'S&_Template 1.pptx');
const PROFILE_DEFAULT_DISPLAY_NAMES: Record<string, string> = {
  stc: 'STC Board Affairs Playbook master.pptx',
  pif: 'PIF LDC Implementation Guide master.pptx',
  dge: 'DGE Presentation Template master.pptx',
};

function getProfileDefaultPptx(profileId: string): { path: string; displayName: string } | null {
  if (profileId === 'strategy' || !/^[a-z0-9_-]+$/i.test(profileId)) return null;
  const profilePath = path.join(process.cwd(), 'assets', 'client-templates', profileId, 'default-master.pptx');
  if (!fs.existsSync(profilePath)) return null;
  return {
    path: profilePath,
    displayName: PROFILE_DEFAULT_DISPLAY_NAMES[profileId] || `${profileId.toUpperCase()} master.pptx`,
  };
}

type MulterRequest = Request & { file?: Express.Multer.File };

/** POST /api/templates/pptx-master — after multer saves pptx-master.pptx */
export function uploadPptxMaster(req: Request, res: Response, next: NextFunction): void {
  try {
    const file = (req as MulterRequest).file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const meta = { fileName: file.originalname, size: file.size };
    fs.writeFileSync(PPTX_META_PATH, JSON.stringify(meta), 'utf8');
    res.json({ success: true, fileName: file.originalname, size: file.size });
  } catch (error) {
    next(error);
  }
}

/** GET /api/templates/pptx-master?profileId=strategy|stc|pif|dge */
export function downloadPptxMaster(req: Request, res: Response, next: NextFunction): void {
  try {
    const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : 'strategy';
    const profileDefault = getProfileDefaultPptx(profileId);
    const hasUploaded = fs.existsSync(PPTX_MASTER_PATH);
    const resolvedPath = profileDefault?.path || (hasUploaded ? PPTX_MASTER_PATH : DEFAULT_PPTX_PATH);

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'No PPTX master template available' });
      return;
    }

    let displayName = profileDefault?.displayName || (hasUploaded ? 'pptx-master.pptx' : path.basename(DEFAULT_PPTX_PATH));
    try {
      if (!profileDefault && hasUploaded && fs.existsSync(PPTX_META_PATH)) {
        const raw = fs.readFileSync(PPTX_META_PATH, 'utf8');
        const meta = JSON.parse(raw) as { fileName?: string };
        if (meta.fileName && typeof meta.fileName === 'string') {
          displayName = meta.fileName;
        }
      }
    } catch {
      // ignore invalid meta
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('X-Pptx-Template-Name', encodeURIComponent(displayName));
    res.sendFile(path.resolve(resolvedPath), (err) => {
      if (err) next(err);
    });
  } catch (error) {
    next(error);
  }
}

// Validation schemas
const createTemplateSchema = z.object({
  themeId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.string().min(1).max(100),
  master: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  html: z.string().min(1),
  note: z.string().max(2000).optional(),
  thumbnail: z.string().max(255).optional(),
  organizationId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  themeId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  type: z.string().min(1).max(100).optional(),
  master: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(100).optional(),
  html: z.string().min(1).optional(),
  note: z.string().max(2000).optional(),
  thumbnail: z.string().max(255).optional(),
  isPublic: z.boolean().optional(),
});

const bulkCreateSchema = z.array(createTemplateSchema);

// POST /api/v1/templates
export async function createTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const input = createTemplateSchema.parse(req.body);
    const template = await templateService.createTemplate({
      name: input.name,
      type: input.type,
      master: input.master,
      category: input.category,
      html: input.html,
      themeId: input.themeId,
      description: input.description,
      note: input.note,
      thumbnail: input.thumbnail,
      organizationId: input.organizationId,
      isPublic: input.isPublic,
      createdBy: req.user.id,
    });

    res.status(201).json({
      data: template,
      message: 'Template created',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/templates/bulk
export async function createTemplatesBulk(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const inputs = bulkCreateSchema.parse(req.body);
    const templates = await templateService.createTemplates(
      inputs.map(input => ({
        name: input.name,
        type: input.type,
        master: input.master,
        category: input.category,
        html: input.html,
        themeId: input.themeId,
        description: input.description,
        note: input.note,
        thumbnail: input.thumbnail,
        organizationId: input.organizationId,
        isPublic: input.isPublic,
        createdBy: req.user!.id,
      }))
    );

    res.status(201).json({
      data: templates,
      message: `Created ${templates.length} templates`,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/templates
export async function listTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const organizationId = req.headers['x-organization-id'] as string | undefined;
    const themeId = req.query.themeId as string | undefined;

    let templates;
    if (themeId) {
      templates = await templateService.getTemplatesByTheme(themeId);
    } else {
      templates = await templateService.getTemplates(req.user.id, organizationId);
    }

    // Group by category for easier frontend use
    const byCategory: Record<string, typeof templates> = {};
    for (const template of templates) {
      if (!byCategory[template.category]) {
        byCategory[template.category] = [];
      }
      byCategory[template.category].push(template);
    }

    res.json({
      data: templates,
      byCategory,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/templates/:id
export async function getTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const template = await templateService.getTemplate(id!);

    if (!template) {
      throw ApiError.notFound('Template');
    }

    res.json({
      data: template,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/v1/templates/:id
export async function updateTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { id } = req.params;
    const input = updateTemplateSchema.parse(req.body);

    // Check ownership
    const existing = await templateService.getTemplate(id!);
    if (!existing) {
      throw ApiError.notFound('Template');
    }

    if (existing.createdBy !== req.user.id) {
      throw ApiError.forbidden('You can only edit your own templates');
    }

    const template = await templateService.updateTemplate(id!, input);

    res.json({
      data: template,
      message: 'Template updated',
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/v1/templates/:id
export async function deleteTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { id } = req.params;

    // Check ownership
    const existing = await templateService.getTemplate(id!);
    if (!existing) {
      throw ApiError.notFound('Template');
    }

    if (existing.createdBy !== req.user.id) {
      throw ApiError.forbidden('You can only delete your own templates');
    }

    await templateService.deleteTemplate(id!);

    res.json({
      message: 'Template deleted',
    });
  } catch (error) {
    next(error);
  }
}
