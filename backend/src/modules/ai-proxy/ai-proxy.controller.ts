import { Request, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getSkillBody, getSkillMetadata } from '../skills/skills.service';

const PWC_BASE = env.PWC_API_BASE_URL;

function getPwcHeaders(apiKey: string = env.PWC_API_KEY): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'API-Key': apiKey,
  };
}

/** Global GPT Image models use a dedicated key when PWC_IMAGE_API_KEY is set. */
function resolveImageApiKey(model: string): string {
  if (isGlobalImageModel(model) && env.PWC_IMAGE_API_KEY) {
    return env.PWC_IMAGE_API_KEY;
  }
  return env.PWC_API_KEY;
}

/**
 * If the request body carries `_skillId`, resolve it to server-side skill
 * markdown and prepend a short preamble + the full skill body to whichever
 * system-prompt field the request shape uses:
 *   - Chat Completions (OpenAI): messages[] entry with role="system"
 *   - Anthropic Messages:        body.system (top-level string)
 *   - Responses API:             body.instructions (top-level string)
 * The `_skillId` field is always stripped before forwarding upstream, so the
 * model never sees our private marker.
 *
 * Unknown ids or disk read failures are logged and skipped (no crash, no
 * response change). Mutates `body` in place for simplicity.
 */
function applySkillInjection(body: any, path: 'chat' | 'responses'): void {
  if (!body || typeof body !== 'object') return;

  const skillId = typeof body._skillId === 'string' ? body._skillId.trim() : '';
  // Always strip the private marker before forwarding, even if unresolved.
  delete body._skillId;
  if (!skillId) return;

  const meta = getSkillMetadata(skillId);
  const markdown = getSkillBody(skillId);
  if (!meta || !markdown) {
    logger.warn('[skills] requested skillId=%s not found; forwarding without injection', skillId);
    return;
  }

  const cleanedMarkdown = markdown.replace(
    /## Inputs the skill needs[\s\S]*?(?=\n## |\n---|\n$|$)/,
    '',
  );

  const preamble = [
    `[ACTIVE CONSULTING SKILL: ${meta.name}]`,
    'Apply the playbook below literally when planning the deck. Use its section names, vocabulary, page patterns, and structural conventions verbatim. Do not substitute a generic strategy narrative, POV deck, or advocacy deck for the playbook\'s shape.',
    'If you are structuring an executive summary, use guidance from the playbook — typically 3-5 pillars, max 6 — unless the user explicitly asks otherwise.',
    '',
    '--- BEGIN PLAYBOOK ---',
    cleanedMarkdown,
    '--- END PLAYBOOK ---',
    '',
  ].join('\n');

  let target: string | null = null;

  if (typeof body.system === 'string') {
    body.system = preamble + body.system;
    target = 'system';
  } else if (typeof body.instructions === 'string') {
    body.instructions = preamble + body.instructions;
    target = 'instructions';
  } else if (Array.isArray(body.messages)) {
    const sysIdx = body.messages.findIndex((m: any) => m && m.role === 'system');
    if (sysIdx >= 0) {
      const msg = body.messages[sysIdx];
      if (typeof msg.content === 'string') {
        msg.content = preamble + msg.content;
      } else if (Array.isArray(msg.content)) {
        msg.content = [{ type: 'text', text: preamble }, ...msg.content];
      } else {
        msg.content = preamble;
      }
      target = 'messages[system]';
    } else {
      body.messages = [{ role: 'system', content: preamble }, ...body.messages];
      target = 'messages[synthesized]';
    }
  }

  if (target) {
    logger.info(
      '[skills] injected skill=%s path=%s target=%s bytes=%d',
      skillId,
      path,
      target,
      preamble.length,
    );
  } else {
    logger.warn(
      '[skills] could not find a system-prompt field to inject skill=%s path=%s (shape unknown)',
      skillId,
      path,
    );
  }
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

  applySkillInjection(req.body, 'chat');

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

  applySkillInjection(req.body, 'responses');

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

/** Regional models on the same /v1/images/generations endpoint (no geography gate). */
const PWC_IMAGE_FALLBACK_MODELS = ['openai.gpt-image-1.5', 'openai.eu.gpt-image-1.5'];

function isGeographyAuthError(status: number, bodyText: string): boolean {
  return status === 401 && /geography restrictions/i.test(bodyText);
}

function isGlobalImageModel(model: string): boolean {
  return model.startsWith('openai.global.');
}

function sendImageProxyResponse(
  res: Response,
  status: number,
  bodyText: string,
  contentType: string,
  meta: { requested: string; used: string; route: string },
): void {
  res
    .status(status)
    .set('Content-Type', contentType)
    .set('X-Edwin-Image-Model-Requested', meta.requested)
    .set('X-Edwin-Image-Model-Used', meta.used)
    .set('X-Edwin-Image-Route', meta.route);
  res.send(bodyText);
}

async function fetchPwCImages(body: Record<string, unknown>, model: string): Promise<Response> {
  const apiKey = resolveImageApiKey(model);
  return fetch(`${PWC_BASE}/v1/images/generations`, {
    method: 'POST',
    headers: getPwcHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
}

/**
 * POST /api/ai/images/generations
 * Proxies to PwC Shared Services /v1/images/generations (GPT Image, etc.)
 */
export async function proxyImages(req: Request, res: Response): Promise<void> {
  if (!env.PWC_API_KEY) {
    res.status(500).json({ error: 'PWC_API_KEY is not configured on the server' });
    return;
  }

  const requested = String(req.body?.model || '');

  if (isGlobalImageModel(requested) && !env.PWC_IMAGE_API_KEY) {
    res.status(500).json({
      error: 'PWC_IMAGE_API_KEY is not configured on the server (required for global image models)',
    });
    return;
  }

  try {
    logger.debug('AI proxy: POST /v1/images/generations model=%s', requested);
    let upstream = await fetchPwCImages({ ...req.body, model: requested }, requested);
    let contentType = upstream.headers.get('content-type') || 'application/json';
    let bodyText = await upstream.text();
    let used = requested;

    if (!upstream.ok && isGeographyAuthError(upstream.status, bodyText) && isGlobalImageModel(requested)) {
      for (const fallbackModel of PWC_IMAGE_FALLBACK_MODELS) {
        logger.warn('Image proxy: geography block for %s, trying %s', requested, fallbackModel);
        upstream = await fetchPwCImages({ ...req.body, model: fallbackModel }, fallbackModel);
        contentType = upstream.headers.get('content-type') || 'application/json';
        bodyText = await upstream.text();
        used = fallbackModel;
        if (upstream.ok) break;
      }
    }

    if (upstream.ok) {
      sendImageProxyResponse(res, upstream.status, bodyText, contentType, {
        requested,
        used,
        route: used === requested ? 'pwc' : 'pwc-fallback',
      });
      if (used !== requested) {
        logger.info('Image proxy: %s unavailable, served with %s', requested, used);
      }
      return;
    }

    logger.error('AI proxy images error: %d %s', upstream.status, bodyText.slice(0, 500));
    sendImageProxyResponse(res, upstream.status, bodyText, contentType, {
      requested,
      used,
      route: 'pwc-error',
    });
  } catch (err: any) {
    logger.error('AI proxy images network error: %s', err.message);
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
