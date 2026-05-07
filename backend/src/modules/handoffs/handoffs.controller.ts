import { Request, Response } from 'express';
import { createHandoff, consumeHandoff } from './handoffs.service';
import { env } from '../../config/env';

export function create(req: Request, res: Response) {
  const { question, answer, citations, tables, conversation, brief, suggestedPrompt, source } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer are required' });
  }

  const { id } = createHandoff({ question, answer, citations, tables, conversation, brief, suggestedPrompt, source });
  const url = `${env.FRONTEND_URL}/?handoff=${id}`;

  res.status(201).json({ id, url });
}

export function get(req: Request, res: Response) {
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'invalid handoff id' });
  }

  const payload = consumeHandoff(id);
  if (!payload) {
    return res.status(404).json({ error: 'handoff not found or expired' });
  }

  res.json(payload);
}
