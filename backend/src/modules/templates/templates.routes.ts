import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import * as templatesController from './templates.controller';
import { authenticate } from '../../common/middleware/auth.middleware';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PPTX_MASTER_FILENAME = 'pptx-master.pptx';

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

const pptxMasterStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, PPTX_MASTER_FILENAME);
  },
});

const pptxMasterUpload = multer({
  storage: pptxMasterStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const ok =
      lower.endsWith('.pptx') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      file.mimetype === 'application/octet-stream';
    if (ok) cb(null, true);
    else cb(new Error('Only .pptx files are allowed'));
  },
});

/** Mounted at `/api/templates` — no JWT (same gate as Basic Auth when configured). */
export const pptxMasterTemplatesRouter = Router();

pptxMasterTemplatesRouter.post(
  '/pptx-master',
  (req, res, next) => {
    pptxMasterUpload.single('template')(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  templatesController.uploadPptxMaster
);

pptxMasterTemplatesRouter.get('/pptx-master', templatesController.downloadPptxMaster);

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
