import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger';

export interface HandoffPayload {
  question: string;
  answer: string;
  citations?: string[];
  tables?: string[];
  conversation?: { role: string; content: string }[];
  brief?: string;
  suggestedPrompt?: string;
  source?: string;
}

interface StoredHandoff extends HandoffPayload {
  id: string;
  createdAt: number;
  expiresAt: number;
}

const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;  // sweep every hour

const store = new Map<string, StoredHandoff>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let purged = 0;
    for (const [id, entry] of store) {
      if (now >= entry.expiresAt) {
        store.delete(id);
        purged++;
      }
    }
    if (purged > 0) {
      logger.debug(`[handoffs] purged ${purged} expired handoff(s), ${store.size} remaining`);
    }
  }, CLEANUP_INTERVAL_MS);
}

export function createHandoff(payload: HandoffPayload): { id: string } {
  startCleanup();
  const id = uuidv4();
  const now = Date.now();
  store.set(id, {
    ...payload,
    id,
    createdAt: now,
    expiresAt: now + HANDOFF_TTL_MS,
  });
  logger.info(`[handoffs] created ${id} (source=${payload.source || 'unknown'}, store size=${store.size})`);
  return { id };
}

export function consumeHandoff(id: string): HandoffPayload | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(id);
    return null;
  }
  store.delete(id);
  const { id: _id, createdAt: _c, expiresAt: _e, ...payload } = entry;
  logger.info(`[handoffs] consumed ${id}, ${store.size} remaining`);
  return payload;
}
