import { Router } from 'express';
import * as templatesController from './templates.controller';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Template CRUD
router.get('/', templatesController.listTemplates);
router.post('/', templatesController.createTemplate);
router.post('/bulk', templatesController.createTemplatesBulk);
router.get('/:id', templatesController.getTemplate);
router.patch('/:id', templatesController.updateTemplate);
router.delete('/:id', templatesController.deleteTemplate);

export default router;
