import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as themeService from './themes.service';
import * as templateService from '../templates/templates.service';
import { AuthRequest } from '../../common/types/index';
import { ApiError } from '../../common/middleware/error.middleware';

// Validation schemas
const createThemeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  htmlContent: z.string().min(1),
  organizationId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
});

const updateThemeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  htmlContent: z.string().min(1).optional(),
  isPublic: z.boolean().optional(),
});

// POST /api/v1/themes
export async function createTheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const input = createThemeSchema.parse(req.body);
    const theme = await themeService.createTheme({
      name: input.name,
      description: input.description,
      htmlContent: input.htmlContent,
      organizationId: input.organizationId,
      isPublic: input.isPublic,
      createdBy: req.user.id,
    });

    // Generate CSS from the theme
    const generatedCSS = themeService.generateCSSFromTheme(theme);

    res.status(201).json({
      data: {
        ...theme,
        generatedCSS,
      },
      message: 'Theme created from style guide',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/themes
export async function listThemes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const organizationId = req.headers['x-organization-id'] as string | undefined;
    const themes = await themeService.getThemes(req.user.id, organizationId);

    // Include generated CSS for each theme
    const themesWithCSS = themes.map(theme => ({
      ...theme,
      generatedCSS: themeService.generateCSSFromTheme(theme),
    }));

    res.json({
      data: themesWithCSS,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/themes/:id
export async function getTheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const theme = await themeService.getTheme(id!);

    if (!theme) {
      throw ApiError.notFound('Theme');
    }

    res.json({
      data: {
        ...theme,
        generatedCSS: themeService.generateCSSFromTheme(theme),
      },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/v1/themes/:id
export async function updateTheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { id } = req.params;
    const input = updateThemeSchema.parse(req.body);

    // Check ownership
    const existing = await themeService.getTheme(id!);
    if (!existing) {
      throw ApiError.notFound('Theme');
    }

    if (existing.createdBy !== req.user.id) {
      throw ApiError.forbidden('You can only edit your own themes');
    }

    const theme = await themeService.updateTheme(id!, input);

    res.json({
      data: {
        ...theme,
        generatedCSS: themeService.generateCSSFromTheme(theme),
      },
      message: 'Theme updated',
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/v1/themes/:id
export async function deleteTheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { id } = req.params;

    // Check ownership
    const existing = await themeService.getTheme(id!);
    if (!existing) {
      throw ApiError.notFound('Theme');
    }

    if (existing.createdBy !== req.user.id) {
      throw ApiError.forbidden('You can only delete your own themes');
    }

    await themeService.deleteTheme(id!);

    res.json({
      message: 'Theme deleted',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/themes/parse - Parse HTML without saving (preview)
export async function parseStyleGuide(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { htmlContent } = req.body;

    if (!htmlContent || typeof htmlContent !== 'string') {
      throw ApiError.badRequest('htmlContent is required');
    }

    const { cssVariables, extractedStyles } = themeService.parseStyleGuideHTML(htmlContent);

    // Create a temporary theme object for CSS generation
    const tempTheme = {
      id: 'temp',
      name: 'Preview',
      description: null,
      organizationId: null,
      createdBy: '',
      htmlContent,
      cssVariables,
      extractedStyles,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    res.json({
      data: {
        cssVariables,
        extractedStyles,
        generatedCSS: themeService.generateCSSFromTheme(tempTheme),
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/themes/:id/export - Export theme with templates
export async function exportTheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const theme = await themeService.getTheme(id!);

    if (!theme) {
      throw ApiError.notFound('Theme');
    }

    // Get all templates for this theme
    const templates = await templateService.getTemplatesByTheme(id!);

    // Create export object
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      theme: {
        name: theme.name,
        description: theme.description,
        htmlContent: theme.htmlContent,
        cssVariables: theme.cssVariables,
        extractedStyles: theme.extractedStyles,
        isPublic: theme.isPublic,
      },
      templates: templates.map(t => ({
        name: t.name,
        description: t.description,
        type: t.type,
        master: t.master,
        category: t.category,
        html: t.html,
        note: t.note,
        thumbnail: t.thumbnail,
      })),
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${theme.name.replace(/[^a-z0-9]/gi, '-')}-theme.json"`
    );

    res.json(exportData);
  } catch (error) {
    next(error);
  }
}

// Validation schema for import
const importThemeSchema = z.object({
  version: z.string(),
  theme: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    htmlContent: z.string().min(1),
    cssVariables: z.record(z.string()).optional(),
    extractedStyles: z.any().optional(),
    isPublic: z.boolean().optional(),
  }),
  templates: z.array(z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    type: z.string().min(1).max(100),
    master: z.string().min(1).max(100),
    category: z.string().min(1).max(100),
    html: z.string().min(1),
    note: z.string().max(2000).optional().nullable(),
    thumbnail: z.string().max(255).optional().nullable(),
  })).optional(),
});

// POST /api/v1/themes/import - Import theme with templates
export async function importTheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const importData = importThemeSchema.parse(req.body);
    const organizationId = req.headers['x-organization-id'] as string | undefined;

    // Create the theme
    const theme = await themeService.createTheme({
      name: importData.theme.name,
      description: importData.theme.description || undefined,
      htmlContent: importData.theme.htmlContent,
      organizationId,
      createdBy: req.user.id,
      isPublic: importData.theme.isPublic,
    });

    // Create templates if provided
    let createdTemplates: any[] = [];
    if (importData.templates && importData.templates.length > 0) {
      createdTemplates = await templateService.createTemplates(
        importData.templates.map(t => ({
          themeId: theme.id,
          name: t.name,
          description: t.description || undefined,
          type: t.type,
          master: t.master,
          category: t.category,
          html: t.html,
          note: t.note || undefined,
          thumbnail: t.thumbnail || undefined,
          organizationId,
          createdBy: req.user!.id,
          isPublic: theme.isPublic,
        }))
      );
    }

    res.status(201).json({
      data: {
        theme: {
          ...theme,
          generatedCSS: themeService.generateCSSFromTheme(theme),
        },
        templates: createdTemplates,
      },
      message: `Imported theme with ${createdTemplates.length} templates`,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/themes/:id/templates - Get templates for a theme
export async function getThemeTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Verify theme exists
    const theme = await themeService.getTheme(id!);
    if (!theme) {
      throw ApiError.notFound('Theme');
    }

    const templates = await templateService.getTemplatesByTheme(id!);

    // Group by category
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
