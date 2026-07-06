import { Router } from 'express';
import { create, get } from './handoffs.controller';

const router = Router();

router.post('/', create);
router.get('/:id', get);

export default router;
