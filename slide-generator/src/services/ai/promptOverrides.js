export const PROMPT_OVERRIDE_DEFS = [
  { key: 'router.system', label: 'Router System', description: 'Deck planner and research router.' },
  { key: 'triage.system', label: 'Triage System', description: 'Fast scope classifier before the router.' },
  { key: 'slideGen.freestyleSystem', label: 'Freestyle System', description: 'Full freestyle slide system prompt.' },
  { key: 'slideGen.freestyleUser', label: 'Freestyle User Postamble', description: 'Extra guidance appended to freestyle generation requests.', mode: 'append' },
  { key: 'slideGen.templateSystem', label: 'Template System', description: 'System prompt for template-filled slides.' },
  { key: 'slideGen.templateUser', label: 'Template User Postamble', description: 'Extra guidance appended to template fill requests.', mode: 'append' },
  { key: 'edit.system', label: 'Edit System', description: 'Slide edit and improve prompt.' },
  { key: 'validation.system', label: 'Validation System', description: 'AI slide quality validation prompt.' },
  { key: 'layoutPolish.system', label: 'Layout Polish System', description: 'Post-generation layout QA pass (fast model, frame-only fixes).' },
  { key: 'layoutPolish.user', label: 'Layout Polish User', description: 'User message template for layout polish. Placeholders: {instructionBlock}, {slideHtml}.' },
  { key: 'pptx.system', label: 'PPTX System', description: 'HTML/CSS to PptxGenJS export prompt.' },
  { key: 'visualUplift.system', label: 'Visual Uplift', description: 'Frame image enhancement prompt. Placeholders: {layoutGuidance}, {clientProfileName}.' },
];

const PROMPT_PAYLOAD_STORAGE_KEY = 'edwin:lastPromptPayloads';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getPromptOverride(settings, key) {
  const value = settings?.promptOverrides?.[key];
  return typeof value === 'string' && value.trim() ? value : '';
}

export function applyPromptOverride(settings, key, defaultPrompt) {
  return getPromptOverride(settings, key) || defaultPrompt;
}

export function appendPromptOverride(settings, key, prompt) {
  const extra = getPromptOverride(settings, key);
  return extra ? `${prompt}\n\n---\n\n${extra}` : prompt;
}

export function recordPromptPayload(surface, payload = {}) {
  if (!canUseStorage() || !surface) return;
  try {
    const existing = JSON.parse(window.localStorage.getItem(PROMPT_PAYLOAD_STORAGE_KEY) || '[]');
    const next = [
      {
        surface,
        timestamp: new Date().toISOString(),
        payload,
      },
      ...(Array.isArray(existing) ? existing : []),
    ].slice(0, 20);
    window.localStorage.setItem(PROMPT_PAYLOAD_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[promptOverrides] Failed to record prompt payload:', error.message);
  }
}

export function getLastPromptPayloads() {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROMPT_PAYLOAD_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
