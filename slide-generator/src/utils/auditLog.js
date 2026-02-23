// Centralized audit log for all LLM calls
// Each entry records: who called, which model, for what, with what params

const MAX_ENTRIES = 500;
const entries = [];
let _idCounter = 0;

export function audit(role, action, details = {}) {
  const entry = {
    id: ++_idCounter,
    ts: new Date().toISOString(),
    role,        // e.g. 'manager:scoping', 'consultant:analyzing', 'router', 'report'
    action,      // short verb: 'called GPT', 'called Gemini', etc.
    model: details.model || '?',
    query: (details.query || '').slice(0, 300),
    context: details.context || '',
    tokens: details.maxTokens || null,
    reasoning: details.reasoningEffort || null,
    search: !!details.searchEnabled,
    temperature: details.temperature ?? null,
    duration: details.duration || null,
    status: details.status || 'ok', // 'ok' | 'error' | 'retry'
    error: details.error || null,
    inputLen: details.inputLen || null,
    outputLen: details.outputLen || null,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

  // Compact console log
  const time = entry.ts.split('T')[1].split('.')[0];
  const style = entry.status === 'error'
    ? 'color:#F44336;font-weight:bold'
    : entry.status === 'retry'
      ? 'color:#FF9800'
      : 'color:#4CAF50';
  console.log(
    `%c[${time}] ${role} | ${action} | ${entry.model} | ${entry.context} | tokens:${entry.tokens} | ${entry.status}`,
    style
  );

  return entry;
}

export function getAuditLog() {
  return [...entries];
}

export function clearAuditLog() {
  entries.length = 0;
  _idCounter = 0;
}

export function exportAuditLog() {
  return JSON.stringify(entries, null, 2);
}

// Derive model provider name from "provider:model" string
export function describeModel(modelRef) {
  if (!modelRef) return 'unknown';
  const parts = modelRef.split(':');
  if (parts.length < 2) return modelRef;
  const provider = parts[0];
  const model = parts.slice(1).join(':');
  const providerNames = { openai: 'GPT', gemini: 'Gemini', anthropic: 'Claude', pwc: 'PwC' };
  return `${providerNames[provider] || provider}/${model}`;
}

// Expose globally for console access
if (typeof window !== 'undefined') {
  window.auditLog = { get: getAuditLog, clear: clearAuditLog, export: exportAuditLog };
}
