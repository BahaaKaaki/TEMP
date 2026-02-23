import { Router } from 'express';
import * as themesController from './themes.controller';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Parse HTML style guide (preview without saving)
router.post('/parse', themesController.parseStyleGuide);

// Import theme with templates
router.post('/import', themesController.importTheme);

// Theme CRUD
router.get('/', themesController.listThemes);
router.post('/', themesController.createTheme);
router.get('/:id', themesController.getTheme);
router.patch('/:id', themesController.updateTheme);
router.delete('/:id', themesController.deleteTheme);

// Export theme with templates
router.get('/:id/export', themesController.exportTheme);

// Get templates for a theme
router.get('/:id/templates', themesController.getThemeTemplates);

export default router;
