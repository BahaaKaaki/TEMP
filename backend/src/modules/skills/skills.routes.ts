import { Router } from 'express';
import { listSkills } from './skills.controller';

const router = Router();

router.get('/', listSkills);

export default router;
