import { Router } from 'express';
import { proxyChat, proxyResponses, proxyModels } from './ai-proxy.controller';

const router = Router();

router.post('/chat', proxyChat);
router.post('/responses', proxyResponses);
router.get('/models', proxyModels);

export default router;
