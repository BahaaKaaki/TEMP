import { Request, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const PWC_BASE = env.PWC_API_BASE_URL;

function getPwcHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'API-Key': env.PWC_API_KEY,
  };
}

/**
 * POST /api/ai/chat
 * Proxies to PwC Shared Services /chat/completions
 */
export async function proxyChat(req: Request, res: Response): Promise<void> {
  if (!env.PWC_API_KEY) {
    res.status(500).json({ error: 'PWC_API_KEY is not configured on the server' });
    return;
  }

  const targetUrl = `${PWC_BASE}/chat/completions`;

  try {
    logger.debug('AI proxy: POST /chat/completions model=%s', req.body?.model);

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: getPwcHeaders(),
      body: JSON.stringify(req.body),
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).set('Content-Type', contentType);

    if (!upstream.ok) {
      const errText = await upstream.text();
      logger.error('AI proxy error: %d %s', upstream.status, errText.slice(0, 500));
      res.send(errText);
      return;
    }

    const data = await upstream.text();
    res.send(data);
  } catch (err: any) {
    logger.error('AI proxy network error: %s', err.message);
    res.status(502).json({ error: 'Failed to reach PwC AI service', detail: err.message });
  }
}

/**
 * POST /api/ai/responses
 * Proxies to PwC Shared Services /v1/responses (for search / Responses API)
 */
export async function proxyResponses(req: Request, res: Response): Promise<void> {
  if (!env.PWC_API_KEY) {
    res.status(500).json({ error: 'PWC_API_KEY is not configured on the server' });
    return;
  }

  const targetUrl = `${PWC_BASE}/v1/responses`;

  try {
    logger.debug('AI proxy: POST /v1/responses model=%s', req.body?.model);

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: getPwcHeaders(),
      body: JSON.stringify(req.body),
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).set('Content-Type', contentType);

    if (!upstream.ok) {
      const errText = await upstream.text();
      logger.error('AI proxy responses error: %d %s', upstream.status, errText.slice(0, 500));
      res.send(errText);
      return;
    }

    const data = await upstream.text();
    res.send(data);
  } catch (err: any) {
    logger.error('AI proxy responses network error: %s', err.message);
    res.status(502).json({ error: 'Failed to reach PwC AI service', detail: err.message });
  }
}

/**
 * GET /api/ai/models
 * Proxies to PwC Shared Services /models
 */
export async function proxyModels(_req: Request, res: Response): Promise<void> {
  if (!env.PWC_API_KEY) {
    res.status(500).json({ error: 'PWC_API_KEY is not configured on the server' });
    return;
  }

  const targetUrl = `${PWC_BASE}/models`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'API-Key': env.PWC_API_KEY,
      },
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).set('Content-Type', contentType);

    const data = await upstream.text();
    res.send(data);
  } catch (err: any) {
    logger.error('AI proxy models error: %s', err.message);
    res.status(502).json({ error: 'Failed to reach PwC AI service', detail: err.message });
  }
}
