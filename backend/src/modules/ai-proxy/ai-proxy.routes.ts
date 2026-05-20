import { Router } from 'express';
import { proxyChat, proxyImages, proxyResponses, proxyModels } from './ai-proxy.controller';

const router = Router();

router.post('/chat', proxyChat);
router.post('/images/generations', proxyImages);
router.post('/responses', proxyResponses);
router.get('/models', proxyModels);

export default router;
