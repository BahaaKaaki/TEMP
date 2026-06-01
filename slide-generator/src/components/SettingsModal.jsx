import { useState, useEffect, useRef, useCallback } from 'react';
import { useSlides } from '../context/SlideContext';
import {
  DEFAULT_SYSTEM_PROMPT,
  EDIT_SYSTEM_PROMPT,
  PROMPT_OVERRIDE_DEFS,
  VISUAL_UPLIFT_PROMPT,
  DEFAULT_LAYOUT_POLISH_SYSTEM,
  DEFAULT_LAYOUT_POLISH_USER_TEMPLATE,
  getLastPromptPayloads,
  setApiMaxConcurrent,
} from '../services/aiService';
import { DEFAULT_SHELL, DEFAULT_THEME, DEFAULT_VIBE, DEFAULT_WRITING, DEFAULT_SLIDE_HTML_GENERATOR_PROMPT, FREESTYLE_PRESETS } from '../services/ai/freestylePromptBuilder.js';
import { getRouterSystemPrompt, TRIAGE_SYSTEM_PROMPT } from '../services/ai/router.js';
import { DEFAULT_PPTX_SYSTEM_PROMPT, DEFAULT_PPTX_CODE_EXAMPLE } from '../services/pptxService';
import { saveTemplateToStorage, loadTemplateFromStorage, clearTemplateFromStorage, downloadArrayBuffer } from '../services/pptxTemplateService';
import { extractBranding } from '../services/brandingExtractor';
import { authFetch } from '../services/authFetch.js';
import {
  getClientDesignProfile,
} from '../utils/clientDesignProfiles.js';

// ─── Utility helpers ────────────────────────────────────────────────────────
function stripProviderPrefix(model) {
  if (!model) return model;
  const idx = model.indexOf(':');
  return idx === -1 ? model : model.slice(idx + 1);
}
function isReasoningModel(model) { return /\b(gpt-5|o1|o3)\b/i.test(stripProviderPrefix(model)); }
function isGPT5Model(model) { return /\bgpt-5/i.test(stripProviderPrefix(model)); }
function buildTestBody(model, actualModel, providerUrl) {
  if (isGPT5Model(model)) {
    const isDirectOpenAI = providerUrl?.includes('api.openai.com');
    return isDirectOpenAI
      ? { model: actualModel, input: 'Say OK', max_output_tokens: 16 }
      : { model: actualModel, messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 16 };
  }
  return { model: actualModel, messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 10 };
}
function getTestEndpoint(providerUrl, model) {
  if (isGPT5Model(model) && providerUrl?.includes('api.openai.com')) return 'https://api.openai.com/v1/responses';
  return providerUrl;
}
function buildTestHeaders(provider) {
  const headers = { 'Content-Type': 'application/json' };
  const authType = provider.authType || 'auto';
  const url = provider.apiUrl || '';
  if (authType === 'server') {
    // Server-managed auth: backend proxy adds the key; don't override browser Basic Auth
  } else if (authType === 'api-key' || (authType === 'auto' && (url.includes('openai.azure.com') || provider.azurePrefix))) {
    headers['api-key'] = provider.apiKey;
  } else if (authType === 'auto' && url.includes('anthropic.com')) {
    headers['x-api-key'] = provider.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  } else {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }
  return headers;
}
function parseModelRef(ref) {
  if (!ref) return { providerId: '', modelName: '' };
  const idx = ref.indexOf(':');
  if (idx === -1) return { providerId: '', modelName: ref };
  return { providerId: ref.slice(0, idx), modelName: ref.slice(idx + 1) };
}

// ─── Role definitions ───────────────────────────────────────────────────────
const ROLE_DEFS = [
  { key: 'managerScope',          label: 'Manager — Scoping',            desc: 'Understands requests, determines complexity',         group: 'Agent Team', color: '#1565C0' },
  { key: 'managerPlanning',       label: 'Manager — Planning',           desc: 'Creates storyline, plans sections',                   group: 'Agent Team', color: '#0277BD' },
  { key: 'consultantAnalyzing',   label: 'Consultant — Analyzing',       desc: 'Synthesizes data, builds insights',                   group: 'Agent Team', color: '#2E7D32' },
  { key: 'consultantResearching', label: 'Consultant — Researching',     desc: 'Web search, knowledge gathering',                     group: 'Agent Team', color: '#388E3C' },
  { key: 'managerCompiling',      label: 'Manager — Compiling',          desc: 'Merges findings into final slide content',             group: 'Agent Team', color: '#6A1B9A' },
  { key: 'managerReviewing',      label: 'Manager — Reviewing',          desc: 'Quality review, consistency check',                   group: 'Agent Team', color: '#4A148C' },
  { key: 'routerAgent',           label: 'Router — Agent Mode',          desc: 'Fast routing per instruction',                        group: 'Routing',    color: '#E65100' },
  { key: 'routerChatbot',         label: 'Router — Chatbot Mode',        desc: 'Free-form chatbot routing',                           group: 'Routing',    color: '#F57C00' },
  { key: 'slideCreatorAgent',     label: 'Slide Creator — Agent',        desc: 'HTML slides from agent output',                       group: 'Creation',   color: '#00695C' },
  { key: 'slideCreatorChatbot',   label: 'Slide Creator — Chatbot',      desc: 'HTML slides from chatbot instructions',               group: 'Creation',   color: '#00897B' },
  { key: 'reportGenerator',       label: 'Report Generator',             desc: 'HTML/JSON interactive report generation',              group: 'Creation',   color: '#2E7D32' },
  { key: 'templateSwitcher',      label: 'Template Switcher',            desc: 'Re-layouts content into different template',           group: 'Tools',      color: '#455A64' },
  { key: 'pptxGenerator',         label: 'PPTX Generator',               desc: 'PptxGenJS code for PowerPoint export',                group: 'Tools',      color: '#37474F' },
  { key: 'quickEdit',             label: 'Quick Edit (Textbox)',          desc: 'Per-slide edit instructions',                         group: 'Tools',      color: '#546E7A' },
];

const ROLE_TIER_MAP = {
  managerScope: 'Thinking', managerPlanning: 'Thinking', consultantAnalyzing: 'Thinking',
  consultantResearching: 'Fast', managerCompiling: 'Thinking', managerReviewing: 'Default',
  routerAgent: 'Agent Router', routerChatbot: 'Chatbot Router',
  slideCreatorAgent: 'Default', slideCreatorChatbot: 'Default',
  reportGenerator: 'Report', templateSwitcher: 'Default', pptxGenerator: 'Default', quickEdit: 'Fast',
};

// Pre-filled defaults per role — shown as placeholders when user hasn't overridden
const ROLE_DEFAULTS = {
  managerScope:          { reasoningEffort: 'medium', maxTokens: 8192, temperature: 0.3 },
  managerPlanning:       { reasoningEffort: 'medium', maxTokens: 16384, temperature: 0.5 },
  consultantAnalyzing:   { reasoningEffort: 'medium', maxTokens: 8192, temperature: 0.4 },
  consultantResearching: { reasoningEffort: 'low',    maxTokens: 4096, temperature: 0.3 },
  managerCompiling:      { reasoningEffort: 'medium', maxTokens: 16384, temperature: 0.5 },
  managerReviewing:      { reasoningEffort: 'low',    maxTokens: 8192, temperature: 0.3 },
  routerAgent:           { reasoningEffort: 'none',   maxTokens: 16384, temperature: 0.2 },
  routerChatbot:         { reasoningEffort: 'medium', maxTokens: 16384, temperature: 0.5 },
  slideCreatorAgent:     { reasoningEffort: 'low',    maxTokens: 8192, temperature: 0.7 },
  slideCreatorChatbot:   { reasoningEffort: 'low',    maxTokens: 8192, temperature: 0.7 },
  reportGenerator:       { reasoningEffort: 'medium', maxTokens: 32768, temperature: 0.4 },
  templateSwitcher:      { reasoningEffort: 'low',    maxTokens: 8192, temperature: 0.5 },
  pptxGenerator:         { reasoningEffort: 'low',    maxTokens: 16384, temperature: 0.3 },
  quickEdit:             { reasoningEffort: 'none',   maxTokens: 4096, temperature: 0.5 },
};

// Roles that map to dedicated top-level settings (not roleSettings)
const SPECIAL_ROLE_MAPPING = {
  routerAgent: {
    model: 'routerModel', reasoningEffort: 'routerReasoningEffort',
    maxTokens: 'routerMaxTokens', searchEnabled: 'routerSearchEnabled',
  },
  routerChatbot: {
    model: 'chatRouterModel', reasoningEffort: 'chatRouterReasoningEffort',
    maxTokens: 'chatRouterMaxTokens', searchEnabled: 'chatRouterSearchEnabled',
  },
  reportGenerator: {
    model: 'reportModel', reasoningEffort: 'reportReasoningEffort',
    maxTokens: 'reportMaxTokens',
  },
};

const LIMIT_DEFS = [
  { key: 'limitSearchCharsBeforeSynthesis', label: 'Search → Synthesis (chars)', desc: 'Raw search chars sent to synthesis LLM', default: 12000, group: 'Search & Synthesis' },
  { key: 'limitSearchCharsFallback', label: 'Search Fallback (chars)', desc: 'Chars kept when no synthesis budget remains', default: 4000, group: 'Search & Synthesis' },
  { key: 'limitSynthesisTokens', label: 'Synthesis Output (tokens)', desc: 'Max output tokens for synthesis calls', default: 4096, group: 'Search & Synthesis' },
  { key: 'limitKnowledgeSummaryChars', label: 'Think-Loop Summary (chars)', desc: 'Per-item summary length in think-loop', default: 800, group: 'Think Loop' },
  { key: 'limitKnowledgeSummaryInsights', label: 'Think-Loop Insights (count)', desc: 'Insights per knowledge item', default: 5, group: 'Think Loop' },
  { key: 'limitKnowledgeCompileChars', label: 'Compiler — Rich (chars)', desc: 'Knowledge chars in rich research mode', default: 120000, group: 'Compilation' },
  { key: 'limitKnowledgeCompileCharsStd', label: 'Compiler — Standard (chars)', desc: 'Knowledge chars in standard mode', default: 80000, group: 'Compilation' },
  { key: 'limitCompilerTokensPerSlide', label: 'Compiler Budget (tokens/slide)', desc: 'Output token budget per slide', default: 2000, group: 'Compilation' },
  { key: 'limitCompilerTokensMin', label: 'Compiler Budget Min (tokens)', desc: 'Minimum total compiler budget', default: 6000, group: 'Compilation' },
  { key: 'limitResearchContextChars', label: 'Worker Context (chars)', desc: 'Research chars per worker consultant', default: 20000, group: 'Workers' },
  { key: 'limitKnowledgeStorageChars', label: 'Knowledge Storage (chars)', desc: 'Chars stored per knowledge item', default: 2000, group: 'Workers' },
  { key: 'limitSlideInstructionItems', label: 'Slide Instructions (count)', desc: 'Knowledge items per slide instruction', default: 5, group: 'Workers' },
  { key: 'limitFallbackKnowledgeItems', label: 'Fallback Knowledge (count)', desc: 'Knowledge items in no-plan mode', default: 12, group: 'Workers' },
];

// ─── Model classification helpers ───────────────────────────────────────────
//
// Platform = hosting platform (Gemini, Claude, OpenAI, Azure, Bedrock, etc.)
// Capability = what the model does (chat, image, embedding, audio, code, reasoning)

const PLATFORM_RULES = [
  { prefix: 'vertex_ai.gemini',    platform: 'Gemini' },
  { prefix: 'vertex_ai.imagen',    platform: 'Gemini' },
  { prefix: 'vertex_ai.text-',     platform: 'Gemini' },
  { prefix: 'vertex_ai.anthropic', platform: 'Claude' },
  { prefix: 'vertex_ai.meta',      platform: 'Meta' },
  { prefix: 'bedrock.anthropic',   platform: 'Claude' },
  { prefix: 'bedrock.amazon',      platform: 'Bedrock' },
  { prefix: 'bedrock.openai',      platform: 'Bedrock' },
  { prefix: 'bedrock.cohere',      platform: 'Bedrock' },
  { prefix: 'bedrock.mistral',     platform: 'Bedrock' },
  { prefix: 'openai.',             platform: 'OpenAI' },
  { prefix: 'azure.',              platform: 'Azure' },
  { prefix: 'anthropic.',          platform: 'Claude' },
  { prefix: 'gemini',              platform: 'Gemini' },
  { prefix: 'claude',              platform: 'Claude' },
  { prefix: 'gpt-',                platform: 'OpenAI' },
];

function getModelPlatform(id) {
  const lower = id.toLowerCase();
  for (const { prefix, platform } of PLATFORM_RULES) {
    if (lower.startsWith(prefix)) return platform;
  }
  return 'Other';
}

function getModelCapability(id) {
  const lower = id.toLowerCase();
  // Embedding models
  if (/embed|text-embedding/.test(lower)) return 'embedding';
  // Image generation models
  if (/dall-e|imagen|gpt-image|nova-canvas|flash-image/.test(lower)) return 'image';
  if (/image-preview/.test(lower)) return 'image';
  // Audio / realtime / TTS / transcription models
  if (/whisper|gpt-audio|realtime|transcribe|-tts/.test(lower)) return 'audio';
  // Codex (code-specialized) models
  if (/codex/.test(lower)) return 'code';
  // Reranking models
  if (/rerank/.test(lower)) return 'rerank';
  // Deep research
  if (/deep-research/.test(lower)) return 'reasoning';
  // Reasoning models (o-series: o1, o3, o4)
  if (/\bo[134]-/.test(lower) || /^(openai|azure)\.(o[134])$/.test(lower)) return 'reasoning';
  // Everything else is a chat/LLM model
  return 'chat';
}

function getModelTier(id) {
  const lower = id.toLowerCase();
  if (/opus/.test(lower)) return 'pro';
  if (/pro/.test(lower)) return 'pro';
  if (/sonnet/.test(lower)) return 'standard';
  if (/nano/.test(lower)) return 'fast';
  if (/mini/.test(lower)) return 'fast';
  if (/flash-lite|flash_lite/.test(lower)) return 'fast';
  if (/flash/.test(lower)) return 'fast';
  if (/lite/.test(lower)) return 'fast';
  if (/haiku/.test(lower)) return 'fast';
  return null;
}

function getModelTag(id) {
  const cap = getModelCapability(id);
  if (cap !== 'chat') return cap;
  return getModelTier(id);
}

function extractSortVersion(name) {
  const nums = [];
  const re = /(\d+)(?:\.(\d+))?/g;
  let m;
  while ((m = re.exec(name)) !== null) {
    nums.push(parseFloat(m[0]));
  }
  return nums.length > 0 ? Math.max(...nums) : 0;
}

function groupAndSortModels(models) {
  const groups = {};
  for (const id of models) {
    const platform = getModelPlatform(id);
    if (!groups[platform]) groups[platform] = [];
    groups[platform].push(id);
  }
  const tierOrder = { pro: 0, standard: 1, fast: 2 };
  const capOrder = { chat: 0, reasoning: 1, code: 2, image: 3, audio: 4, embedding: 5, rerank: 6 };
  for (const platform of Object.keys(groups)) {
    groups[platform].sort((a, b) => {
      const capA = capOrder[getModelCapability(a)] ?? 9;
      const capB = capOrder[getModelCapability(b)] ?? 9;
      if (capA !== capB) return capA - capB;
      const tierA = tierOrder[getModelTier(a)] ?? 1.5;
      const tierB = tierOrder[getModelTier(b)] ?? 1.5;
      if (tierA !== tierB) return tierA - tierB;
      return extractSortVersion(b) - extractSortVersion(a);
    });
  }
  return groups;
}

function filterModelsForRole(models, role) {
  const filtered = models.filter(id => {
    if (id === 'all-proxy-models') return false;
    // The app auto-detects the /responses endpoint; hide duplicate *-responses variants
    if (/-responses$/.test(id)) return false;
    return true;
  });
  if (!role) return filtered;
  return filtered.filter(id => {
    const cap = getModelCapability(id);
    switch (role) {
      case 'image':
        return cap === 'image';
      case 'chat':
      case 'fast':
      case 'thinking':
        return cap === 'chat' || cap === 'reasoning' || cap === 'code';
      default:
        return true;
    }
  });
}

const TAG_COLORS = {
  pro: { bg: '#FFF3E0', color: '#E65100' },
  standard: { bg: '#E8EAF6', color: '#283593' },
  fast: { bg: '#E3F2FD', color: '#1565C0' },
  image: { bg: '#F3E5F5', color: '#6A1B9A' },
  audio: { bg: '#FFF8E1', color: '#F57F17' },
  code: { bg: '#E8F5E9', color: '#2E7D32' },
  embedding: { bg: '#EFEBE9', color: '#4E342E' },
  reasoning: { bg: '#FCE4EC', color: '#C62828' },
  rerank: { bg: '#E0F7FA', color: '#00695C' },
};

// ─── Shared sub-components ──────────────────────────────────────────────────

function ModelPicker({ value, onChange, providers, label, allowEmpty, emptyLabel, role }) {
  const { providerId, modelName } = parseModelRef(value);
  const selectedProvider = providers.find(p => p.id === providerId);
  const allModels = selectedProvider?.models || [];
  const models = filterModelsForRole(allModels, role);
  const grouped = groupAndSortModels(models);
  const platformOrder = ['Gemini', 'Claude', 'OpenAI', 'Azure', 'Bedrock', 'Meta', 'Other'];
  const sortedPlatforms = platformOrder.filter(v => grouped[v]?.length > 0);

  return (
    <div style={{ marginBottom: 6 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>{label}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={providerId || ''}
          onChange={(e) => {
            if (!e.target.value) { onChange(''); return; }
            const prov = providers.find(p => p.id === e.target.value);
            const provModels = filterModelsForRole(prov?.models || [], role);
            onChange(`${e.target.value}:${provModels?.[0] || ''}`);
          }}
          style={{ flex: 1, fontSize: 12 }}
        >
          {allowEmpty && <option value="">{emptyLabel || 'Inherit from Default'}</option>}
          {!allowEmpty && <option value="">Select provider...</option>}
          {providers.filter(p => p.apiKey).map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          {providers.filter(p => !p.apiKey).map(p => (
            <option key={p.id} value={p.id} disabled>{p.name} (no key)</option>
          ))}
        </select>
        <select
          value={modelName}
          onChange={(e) => onChange(providerId ? `${providerId}:${e.target.value}` : '')}
          style={{ flex: 1, fontSize: 12 }}
          disabled={!providerId}
        >
          <option value="">Select model...</option>
          {sortedPlatforms.length > 1
            ? sortedPlatforms.map(platform => (
                <optgroup key={platform} label={platform}>
                  {grouped[platform].map(m => {
                    const tag = getModelTag(m);
                    return <option key={m} value={m}>{m}{tag ? ` [${tag}]` : ''}</option>;
                  })}
                </optgroup>
              ))
            : models.map(m => {
                const tag = getModelTag(m);
                return <option key={m} value={m}>{m}{tag ? ` [${tag}]` : ''}</option>;
              })
          }
        </select>
      </div>
    </div>
  );
}

// ─── Styling constants ──────────────────────────────────────────────────────

const sidebarItemStyle = (active) => ({
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: active ? 700 : 400,
  color: active ? '#8E1E1E' : 'var(--text-secondary, #555)',
  background: active ? 'rgba(142, 30, 30, 0.06)' : 'transparent',
  border: 'none',
  borderRight: active ? '3px solid #8E1E1E' : '3px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'all 0.12s',
  whiteSpace: 'nowrap',
});

const boxStyle = {
  background: 'var(--zone2, #f8f8f8)',
  border: '1px solid var(--border, #e0e0e0)',
  borderRadius: 8,
  padding: '14px 16px',
  marginBottom: 12,
};

const sectionTitle = {
  fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--text-primary, #222)',
};

const hint = { fontSize: 11, color: 'var(--text-muted, #999)', marginTop: 4 };

const labelSmall = { fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3, color: 'var(--text-secondary, #666)' };

const accentBadge = { fontSize: 9, background: '#8E1E1E', color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 600, marginLeft: 6 };

// Token dropdown options
const TOKEN_OPTIONS = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 128000];
const TOKEN_OPTIONS_SMALL = [256, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000];

const LAYOUT_POLISH_PROMPT_KEYS = new Set(['layoutPolish.system', 'layoutPolish.user']);

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SettingsModal({ onClose }) {
  const { state, actions } = useSlides();
  const [settings, setSettings] = useState({ ...state.settings });
  const [activeSection, setActiveSection] = useState('essential');
  const [testStatus, setTestStatus] = useState(null);
  const [modelTestStatus, setModelTestStatus] = useState({}); // keyed by model type: fast, thinking, image
  const [searchTestStatus, setSearchTestStatus] = useState(null);
  const [editingProvider, setEditingProvider] = useState(null);
  const [newModelInput, setNewModelInput] = useState('');
  const [providerTestStatus, setProviderTestStatus] = useState({});
  const [providerTestModel, setProviderTestModel] = useState({});
  const [pptxTemplateName, setPptxTemplateName] = useState(null);
  const [pptxTemplateLoading, setPptxTemplateLoading] = useState(false);
  const [extractedBranding, setExtractedBranding] = useState(null);
  const [expandedAdvanced, setExpandedAdvanced] = useState({});
  const [newEndpointInput, setNewEndpointInput] = useState({});
  const [promptPayloadRefresh, setPromptPayloadRefresh] = useState(0);
  const [fetchedModels, setFetchedModels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pwc_fetched_models') || 'null'); } catch { return null; }
  });
  const [modelFetchStatus, setModelFetchStatus] = useState(null);
  const DEBUG_MODE = (() => { try { return localStorage.getItem('DEBUG_MODE') === 'true'; } catch { return false; } })();

  const fetchModelsFromAPI = useCallback(async () => {
    setModelFetchStatus({ type: 'loading', message: 'Fetching models...' });
    try {
      const res = await authFetch('/api/ai/models');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const modelIds = (data.data || data || [])
        .map(m => m.id || m.model || m)
        .filter(id => typeof id === 'string' && id.length > 0);
      if (modelIds.length === 0) throw new Error('No models returned');
      localStorage.setItem('pwc_fetched_models', JSON.stringify(modelIds));
      localStorage.setItem('pwc_fetched_models_ts', Date.now().toString());
      setFetchedModels(modelIds);
      setModelFetchStatus({ type: 'success', message: `Loaded ${modelIds.length} models` });
      const pwcProvider = settings.providers?.find(p => p.id === 'pwc');
      if (pwcProvider) {
        const existingSet = new Set(pwcProvider.models);
        const merged = [...pwcProvider.models];
        for (const id of modelIds) {
          if (!existingSet.has(id)) merged.push(id);
        }
        if (merged.length > pwcProvider.models.length) {
          setSettings(s => ({
            ...s,
            providers: s.providers.map(p => p.id === 'pwc' ? { ...p, models: merged } : p),
          }));
        }
      }
      setTimeout(() => setModelFetchStatus(null), 3000);
    } catch (err) {
      setModelFetchStatus({ type: 'error', message: err.message });
    }
  }, [settings.providers]);

  // Auto-fetch on mount if cache is older than 24h
  useEffect(() => {
    const ts = parseInt(localStorage.getItem('pwc_fetched_models_ts') || '0', 10);
    const staleAfterMs = 24 * 60 * 60 * 1000;
    if (!ts || Date.now() - ts > staleAfterMs) fetchModelsFromAPI();
  }, []);

  // Ensure roleSettings exists with all keys
  useEffect(() => {
    if (!settings.roleSettings || !settings.roleSettings.routerAgent || !settings.roleSettings.reportGenerator) {
      const defaultRole = { model: '', maxTokens: '', reasoningEffort: '', temperature: '', searchEnabled: '' };
      const defaultRoleNoSearch = { model: '', maxTokens: '', reasoningEffort: '', temperature: '' };
      setSettings(s => ({
        ...s,
        roleSettings: {
          managerScope:          { ...defaultRole, ...s.roleSettings?.managerScope },
          managerPlanning:       { ...defaultRole, ...s.roleSettings?.managerPlanning },
          consultantAnalyzing:   { ...defaultRole, ...s.roleSettings?.consultantAnalyzing },
          consultantResearching: { ...defaultRole, ...s.roleSettings?.consultantResearching },
          managerCompiling:      { ...defaultRole, ...s.roleSettings?.managerCompiling },
          managerReviewing:      { ...defaultRole, ...s.roleSettings?.managerReviewing },
          routerAgent:           { ...defaultRole, ...s.roleSettings?.routerAgent },
          routerChatbot:         { ...defaultRole, ...s.roleSettings?.routerChatbot },
          slideCreatorAgent:     { ...defaultRole, ...s.roleSettings?.slideCreatorAgent },
          slideCreatorChatbot:   { ...defaultRole, ...s.roleSettings?.slideCreatorChatbot },
          templateSwitcher:      { ...defaultRoleNoSearch, ...s.roleSettings?.templateSwitcher },
          pptxGenerator:         { ...defaultRoleNoSearch, ...s.roleSettings?.pptxGenerator },
          quickEdit:             { ...defaultRoleNoSearch, ...s.roleSettings?.quickEdit },
          reportGenerator:       { ...defaultRoleNoSearch, ...s.roleSettings?.reportGenerator },
        },
      }));
    }
  }, []);

  useEffect(() => {
    loadTemplateFromStorage({ profileId: settings.clientDesignProfileId || 'strategy' }).then(data => {
      if (data?.fileName) setPptxTemplateName(data.fileName);
      else setPptxTemplateName(null);
    }).catch(() => {});
  }, [settings.clientDesignProfileId]);

  const providers = settings.providers || [];
  const roleSettings = settings.roleSettings || {};
  const activeClientProfile = getClientDesignProfile(settings.clientDesignProfileId || 'strategy');

  // ─── Provider helpers ───────────────────────────────────────────────────────
  const updateProvider = (id, updates) => {
    setSettings({ ...settings, providers: providers.map(p => p.id === id ? { ...p, ...updates } : p) });
  };
  const addProvider = () => {
    const id = 'custom-' + Date.now();
    setSettings({ ...settings, providers: [...providers, { id, name: 'New Provider', apiUrl: '', apiKey: '', models: [], azurePrefix: false, authType: 'auto', alternativeEndpoints: [] }] });
    setEditingProvider(id);
  };
  const removeProvider = (id) => {
    if (!window.confirm('Remove this provider?')) return;
    setSettings({ ...settings, providers: providers.filter(p => p.id !== id) });
    if (editingProvider === id) setEditingProvider(null);
  };
  const addModelToProvider = (providerId) => {
    const val = newModelInput.trim();
    if (!val) return;
    const provider = providers.find(p => p.id === providerId);
    if (provider && !provider.models.includes(val)) updateProvider(providerId, { models: [...provider.models, val] });
    setNewModelInput('');
  };
  const removeModelFromProvider = (providerId, model) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) updateProvider(providerId, { models: provider.models.filter(m => m !== model) });
  };
  const addEndpointToProvider = (providerId) => {
    const val = (newEndpointInput[providerId] || '').trim();
    if (!val) return;
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      const endpoints = provider.alternativeEndpoints || [];
      updateProvider(providerId, { alternativeEndpoints: [...endpoints, { label: '', url: val }] });
    }
    setNewEndpointInput(s => ({ ...s, [providerId]: '' }));
  };
  const removeEndpointFromProvider = (providerId, idx) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      const endpoints = [...(provider.alternativeEndpoints || [])];
      endpoints.splice(idx, 1);
      updateProvider(providerId, { alternativeEndpoints: endpoints });
    }
  };

  const testProvider = async (provider, specificModel) => {
    if (!provider.apiKey) { setProviderTestStatus(s => ({ ...s, [provider.id]: { type: 'error', message: 'No API key' } })); return; }
    if (!provider.models.length) { setProviderTestStatus(s => ({ ...s, [provider.id]: { type: 'error', message: 'No models' } })); return; }
    const testModel = specificModel || providerTestModel[provider.id] || provider.models[0];
    setProviderTestStatus(s => ({ ...s, [provider.id]: { type: 'loading', message: `Testing ${testModel}...` } }));
    try {
      const isDirectAzure = (provider.apiUrl || '').includes('openai.azure.com');
      const actualModel = (provider.azurePrefix && !isDirectAzure) ? `azure.${testModel}` : testModel;
      const useGeminiFormat = provider.geminiNativeFormat || provider.apiUrl.includes('generativelanguage.googleapis.com') || (provider.apiUrl.includes('aiplatform.googleapis.com') && !provider.apiUrl.includes('/chat/completions'));
      if (useGeminiFormat) {
        const isStandardGemini = provider.apiUrl.includes('generativelanguage.googleapis.com');
        const endpoint = isStandardGemini ? `${provider.apiUrl}/models/${testModel}:generateContent?key=${provider.apiKey}` : provider.apiUrl;
        const headers = { 'Content-Type': 'application/json' };
        if (!isStandardGemini && provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;
        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }], generationConfig: { maxOutputTokens: 10 } }) });
        const errMsg = response.ok ? null : (await response.json().catch(() => ({}))).error?.message || `Error ${response.status}`;
        setProviderTestStatus(s => ({ ...s, [provider.id]: response.ok ? { type: 'success', message: `Connected! (${testModel})` } : { type: 'error', message: errMsg } }));
      } else {
        const testEndpoint = getTestEndpoint(provider.apiUrl, testModel);
        const headers = buildTestHeaders(provider);
        const response = await fetch(testEndpoint, { method: 'POST', headers, body: JSON.stringify(buildTestBody(testModel, actualModel, provider.apiUrl)) });
        const errMsg = response.ok ? null : (await response.json().catch(() => ({}))).error?.message || `Error ${response.status}`;
        setProviderTestStatus(s => ({ ...s, [provider.id]: response.ok ? { type: 'success', message: `Connected! (${actualModel})` } : { type: 'error', message: errMsg } }));
      }
    } catch (err) { setProviderTestStatus(s => ({ ...s, [provider.id]: { type: 'error', message: err.message } })); }
  };

  // ─── Test any model ref (generic) ────────────────────────────────────────────
  const testModelRef = async (modelRef, statusKey) => {
    const setStatus = (val) => {
      if (statusKey === 'default') setTestStatus(val);
      else setModelTestStatus(s => ({ ...s, [statusKey]: val }));
    };
    if (!modelRef) { setStatus({ type: 'error', message: 'No model selected' }); return; }
    const { providerId, modelName } = parseModelRef(modelRef);
    const provider = providers.find(p => p.id === providerId);
    if (!provider) { setStatus({ type: 'error', message: 'No provider found' }); return; }
    if (!provider.apiKey) { setStatus({ type: 'error', message: `No API key for ${provider.name}` }); return; }
    setStatus({ type: 'loading', message: `Testing ${modelName}...` });
    try {
      const isDirectAzure = (provider.apiUrl || '').includes('openai.azure.com');
      const actualModel = (provider.azurePrefix && !isDirectAzure) ? `azure.${modelName}` : modelName;
      const useGeminiFormat = provider.geminiNativeFormat || provider.apiUrl.includes('generativelanguage.googleapis.com') || (provider.apiUrl.includes('aiplatform.googleapis.com') && !provider.apiUrl.includes('/chat/completions'));
      if (useGeminiFormat) {
        const isStandardGemini = provider.apiUrl.includes('generativelanguage.googleapis.com');
        const endpoint = isStandardGemini ? `${provider.apiUrl}/models/${modelName}:generateContent?key=${provider.apiKey}` : provider.apiUrl;
        const headers = { 'Content-Type': 'application/json' };
        if (!isStandardGemini && provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;
        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }], generationConfig: { maxOutputTokens: 10 } }) });
        setStatus(response.ok ? { type: 'success', message: `Connected! (${modelName})` } : { type: 'error', message: (await response.json().catch(() => ({}))).error?.message || `Error ${response.status}` });
      } else {
        const body = buildTestBody(modelName, actualModel, provider.apiUrl);
        const headers = buildTestHeaders(provider);
        const response = await fetch(getTestEndpoint(provider.apiUrl, modelName), { method: 'POST', headers, body: JSON.stringify(body) });
        setStatus(response.ok ? { type: 'success', message: `Connected! (${actualModel})` } : { type: 'error', message: (await response.json().catch(() => ({}))).error?.message || `Error ${response.status}` });
      }
    } catch (err) {
      const msg = err.message || String(err);
      setStatus({ type: 'error', message: msg.includes('Failed to fetch') ? `Cannot reach ${provider.apiUrl}` : msg });
    }
  };
  const handleTestConnection = () => testModelRef(settings.model, 'default');

  // ─── Test search ────────────────────────────────────────────────────────────
  const handleTestSearch = async () => {
    if (!settings.searchEndpoint || !settings.searchApiKey || !settings.searchModel) { setSearchTestStatus({ type: 'error', message: 'Fill in endpoint, model, and API key' }); return; }
    setSearchTestStatus({ type: 'loading', message: 'Testing...' });
    try {
      const requestBody = { model: settings.searchModel, input: 'What is the current date?', tools: [{ type: 'web_search_preview', search_context_size: settings.searchContextSize || 'medium' }], max_output_tokens: settings.searchMaxTokens || 128000 };
      const headers = { 'Content-Type': 'application/json' };
      if (settings.searchAuthHeader === 'bearer') headers['Authorization'] = `Bearer ${settings.searchApiKey}`;
      else headers['api-key'] = settings.searchApiKey;
      const response = await fetch(settings.searchEndpoint, { method: 'POST', headers, body: JSON.stringify(requestBody) });
      if (response.ok) {
        const data = await response.json();
        let text = '';
        if (data.output && Array.isArray(data.output)) { for (const item of data.output) { if (item.type === 'message' && item.content) { for (const c of item.content) { if (c.text) { text += c.text.substring(0, 100); break; } } } } }
        setSearchTestStatus({ type: 'success', message: text ? `Connected! "${text}..."` : 'Connected!' });
      } else { const error = await response.json().catch(() => ({})); setSearchTestStatus({ type: 'error', message: error.error?.message || `Error ${response.status}` }); }
    } catch (err) { setSearchTestStatus({ type: 'error', message: err.message?.includes('Failed to fetch') ? `Cannot reach ${settings.searchEndpoint}` : err.message }); }
  };

  // ─── PPTX template ─────────────────────────────────────────────────────────
  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pptx')) { alert('Please upload a .pptx file'); return; }
    setPptxTemplateLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await extractBranding(buffer, { profileId: settings.clientDesignProfileId || 'strategy' });
      const chrome = result?.chrome || null;
      await saveTemplateToStorage(buffer, file.name, chrome, {
        profileId: settings.clientDesignProfileId || 'strategy',
        extraction: result,
      });
      setPptxTemplateName(file.name);

      if (result) {
        setExtractedBranding(result);
      }
    } catch (err) { alert('Failed to save: ' + err.message); }
    finally { setPptxTemplateLoading(false); }
  };
  const handleTemplateClear = async () => {
    await clearTemplateFromStorage({ profileId: settings.clientDesignProfileId || 'strategy' });
    setPptxTemplateName(null);
    setExtractedBranding(null);
  };
  const applyExtractedTheme = () => {
    if (!extractedBranding) return;
    if (extractedBranding.theme) {
      actions.updateTheme(extractedBranding.theme);
    }
    if (extractedBranding.chrome?.footerText) {
      setSettings(s => ({ ...s, footerBranding: extractedBranding.chrome.footerText }));
    }
    setExtractedBranding(null);
  };
  const updateRole = (roleKey, field, value) => {
    setSettings(s => ({ ...s, roleSettings: { ...s.roleSettings, [roleKey]: { ...(s.roleSettings?.[roleKey] || {}), [field]: value } } }));
  };

  // Unified getter/setter for roles — special roles map to top-level settings
  const getRoleValue = (roleKey, field) => {
    const mapping = SPECIAL_ROLE_MAPPING[roleKey];
    if (mapping && mapping[field]) return settings[mapping[field]] ?? '';
    return roleSettings[roleKey]?.[field] ?? '';
  };
  const setRoleValue = (roleKey, field, value) => {
    const mapping = SPECIAL_ROLE_MAPPING[roleKey];
    if (mapping && mapping[field]) {
      setSettings(s => ({ ...s, [mapping[field]]: value }));
      return;
    }
    updateRole(roleKey, field, value);
  };

  // ─── Save / Data actions ────────────────────────────────────────────────────
  const handleSave = () => { actions.updateSettings(settings); onClose(); };
  const handleClearData = () => { if (window.confirm('Delete ALL slides? This cannot be undone.')) { actions.clearAll(); onClose(); } };
  const handleClearHistory = () => {
    const n = state.deckVersions?.length || 0;
    if (n === 0) { alert('No saved versions.'); return; }
    if (window.confirm(`Delete ${n} saved version(s)? Current slides are NOT affected.`)) { actions.clearHistory(); alert('History cleared.'); }
  };
  const handleClearEverything = async () => {
    if (!window.confirm('This will delete ALL data: slides, history, settings, templates, and knowledge base.\n\nThis cannot be undone. Continue?')) return;
    if (!window.confirm('Are you absolutely sure? Everything will be reset to factory defaults.')) return;
    try { await clearTemplateFromStorage(); } catch (e) { /* ignore */ }
    localStorage.clear();
    try {
      const databases = await window.indexedDB.databases();
      for (const db of databases) { window.indexedDB.deleteDatabase(db.name); }
    } catch (e) { /* indexedDB.databases() not supported in all browsers */ }
    window.location.reload();
  };

  // ─── Toggle helper for collapsible sections ───────────────────────────────
  const toggle = (key) => setExpandedAdvanced(s => ({ ...s, [key]: !s[key] }));

  const renderPreferenceSegment = ({ label, description, value, options, onChange }) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--meta, #888)', lineHeight: 1.35, marginTop: 2 }}>{description}</div>
        </div>
      </div>
      <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 8 }}>
        {options.map(option => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              style={{
                padding: '11px 12px',
                borderRadius: 8,
                border: selected ? '2px solid var(--accent, #8E1E1E)' : '1px solid var(--border, #e2e8f0)',
                background: selected ? 'var(--accent-soft, #fdf6f6)' : 'var(--page, #fff)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: selected ? '0 6px 18px rgba(142, 30, 30, 0.08)' : 'none',
                transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{option.label}</span>
                {option.badge && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                    color: selected ? 'var(--accent, #8E1E1E)' : 'var(--text-muted, #94a3b8)',
                  }}>
                    {option.badge}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--meta, #888)', lineHeight: 1.35, marginTop: 4 }}>{option.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderGenerationDefaults = () => (
    <div style={{ padding: '20px', background: 'var(--zone1, #f8fafc)', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Generation Defaults</div>
      <div style={{ fontSize: 12, color: 'var(--meta, #888)', marginBottom: 16 }}>
        These defaults apply to new chat requests.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {renderPreferenceSegment({
          label: 'Slide approach',
          description: 'Choose how Edwin decides between template-led and freeform consulting layouts.',
          value: settings.slideStylePreference || 'freestyle',
          options: [
            { value: 'auto', label: 'Auto', badge: 'Balanced', description: 'Let the planner choose the best layout for each request.' },
            { value: 'freestyle', label: 'Freestyle', badge: 'Default', description: 'Favor custom HTML slides with sharper visual storytelling.' },
          ],
          onChange: (slideStylePreference) => setSettings({ ...settings, slideStylePreference }),
        })}
        {renderPreferenceSegment({
          label: 'Generation quality',
          description: 'Pick the default model tier used for creating or editing slides.',
          value: settings.speedMode || 'premium',
          options: [
            { value: 'fast', label: 'Fast', description: 'Quicker drafts when speed matters more than polish.' },
            { value: 'premium', label: 'Premium', badge: 'Recommended', description: 'Higher-quality slide writing, layout, and reasoning.' },
          ],
          onChange: (speedMode) => setSettings({ ...settings, speedMode }),
        })}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SECTION 1: Providers ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const renderProviders = () => (
    <>
      {/* ── Provider List (DEBUG_MODE only) ── */}
      {DEBUG_MODE && (<>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={sectionTitle}>API Providers</div>
        <button className="btn btn-ghost btn-sm" onClick={addProvider} style={{ fontSize: 11 }}>+ Add Provider</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {providers.map(p => (
          <div key={p.id} style={{ ...boxStyle, padding: editingProvider === p.id ? '12px 14px' : '8px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setEditingProvider(editingProvider === p.id ? null : p.id)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.apiKey ? '#28a745' : '#6c757d', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.models.length} model{p.models.length !== 1 ? 's' : ''}{p.azurePrefix ? ' · azure.' : ''}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{editingProvider === p.id ? '▼' : '▶'}</span>
            </div>
            {editingProvider === p.id && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Provider Name</label>
                  <input type="text" value={p.name} onChange={(e) => updateProvider(p.id, { name: e.target.value })} style={{ fontSize: 12 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Primary API URL</label>
                  <input type="url" value={p.apiUrl} onChange={(e) => updateProvider(p.id, { apiUrl: e.target.value })} placeholder="https://api.example.com/v1/chat/completions" style={{ fontSize: 12 }} />
                </div>
                {/* Alternative Endpoints */}
                {(p.alternativeEndpoints || []).length > 0 && (
                  <div style={{ marginTop: 2 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Alternative Endpoints</label>
                    {(p.alternativeEndpoints || []).map((ep, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                        <input type="text" value={ep.label} onChange={(e) => {
                          const eps = [...(p.alternativeEndpoints || [])];
                          eps[idx] = { ...eps[idx], label: e.target.value };
                          updateProvider(p.id, { alternativeEndpoints: eps });
                        }} placeholder="Label..." style={{ width: 90, fontSize: 11 }} />
                        <input type="url" value={ep.url} onChange={(e) => {
                          const eps = [...(p.alternativeEndpoints || [])];
                          eps[idx] = { ...eps[idx], url: e.target.value };
                          updateProvider(p.id, { alternativeEndpoints: eps });
                        }} placeholder="URL..." style={{ flex: 1, fontSize: 11 }} />
                        <span style={{ cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13 }} onClick={() => removeEndpointFromProvider(p.id, idx)}>×</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="url" value={newEndpointInput[p.id] || ''} onChange={(e) => setNewEndpointInput(s => ({ ...s, [p.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEndpointToProvider(p.id); } }} placeholder="Add alternative endpoint URL..." style={{ flex: 1, fontSize: 11 }} />
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => addEndpointToProvider(p.id)}>+ Endpoint</button>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>API Key</label>
                  <input type="password" value={p.apiKey} onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })} placeholder="Enter API key..." style={{ fontSize: 12 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Auth Header</label>
                  <select value={p.authType || 'auto'} onChange={(e) => updateProvider(p.id, { authType: e.target.value })} style={{ fontSize: 12, width: '100%' }}>
                    <option value="auto">Auto-detect (Bearer / api-key based on URL)</option>
                    <option value="bearer">Authorization: Bearer KEY</option>
                    <option value="api-key">api-key: KEY (Azure OpenAI)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={p.azurePrefix || false} onChange={(e) => updateProvider(p.id, { azurePrefix: e.target.checked })} style={{ width: 'auto' }} />
                    Prefix model names with <code>azure.</code> <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(LiteLLM proxies only)</span>
                  </label>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={p.geminiNativeFormat || false} onChange={(e) => updateProvider(p.id, { geminiNativeFormat: e.target.checked })} style={{ width: 'auto' }} />
                    Use native Gemini API format <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(Gemini/Vertex endpoints)</span>
                  </label>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Models
                    {p.authType === 'server' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 10, padding: '1px 6px', lineHeight: 1.4 }}
                        onClick={fetchModelsFromAPI}
                        disabled={modelFetchStatus?.type === 'loading'}
                      >
                        {modelFetchStatus?.type === 'loading' ? 'Fetching...' : 'Refresh from API'}
                      </button>
                    )}
                    {modelFetchStatus && (
                      <span style={{ fontSize: 10, color: modelFetchStatus.type === 'success' ? '#28a745' : modelFetchStatus.type === 'error' ? '#dc3545' : '#17a2b8' }}>
                        {modelFetchStatus.message}
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {Object.entries(groupAndSortModels(p.models)).map(([vendor, vendorModels]) => (
                      vendorModels.map(m => {
                        const tag = getModelTag(m);
                        const tagStyle = tag && TAG_COLORS[tag] ? { background: TAG_COLORS[tag].bg, color: TAG_COLORS[tag].color, fontSize: 9, padding: '0 4px', borderRadius: 2, marginLeft: 4 } : null;
                        return (
                          <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--zone3)', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                            {m}
                            {tagStyle && <span style={tagStyle}>{tag}</span>}
                            <span style={{ cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 700 }} onClick={() => removeModelFromProvider(p.id, m)}>×</span>
                          </span>
                        );
                      })
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="text" value={newModelInput} onChange={(e) => setNewModelInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModelToProvider(p.id); } }} placeholder="Add model name..." style={{ flex: 1, fontSize: 11 }} />
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => addModelToProvider(p.id)}>Add</button>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Custom Headers <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(JSON, merged into every request)</span></label>
                  <textarea value={p.customHeaders || ''} onChange={(e) => updateProvider(p.id, { customHeaders: e.target.value })} placeholder='{"x-custom-header": "value"}' style={{ fontSize: 11, fontFamily: 'monospace', minHeight: 36, resize: 'vertical' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Custom Params <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(JSON, merged into request body)</span></label>
                  <textarea value={p.customParams || ''} onChange={(e) => updateProvider(p.id, { customParams: e.target.value })} placeholder='{"budget_tokens": 10000}' style={{ fontSize: 11, fontFamily: 'monospace', minHeight: 36, resize: 'vertical' }} />
                </div>
                {providerTestStatus[p.id] && (
                  <div style={{ padding: '6px 10px', borderRadius: 4, fontSize: 11, background: providerTestStatus[p.id].type === 'success' ? 'rgba(40,167,69,0.15)' : providerTestStatus[p.id].type === 'error' ? 'rgba(220,53,69,0.15)' : 'rgba(23,162,184,0.15)', color: providerTestStatus[p.id].type === 'success' ? '#28a745' : providerTestStatus[p.id].type === 'error' ? '#dc3545' : '#17a2b8' }}>
                    {providerTestStatus[p.id].message}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#dc3545' }} onClick={() => removeProvider(p.id)}>Remove</button>
                  <div style={{ flex: 1 }} />
                  {p.models.length > 1 && (
                    <select value={providerTestModel[p.id] || p.models[0]} onChange={(e) => setProviderTestModel(s => ({ ...s, [p.id]: e.target.value }))} style={{ fontSize: 11, padding: '2px 6px', maxWidth: 140 }}>
                      {p.models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => testProvider(p)}>Test</button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setEditingProvider(null)}>Done</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      </>)}

      {/* ── Default Model Selection (DEBUG_MODE only) ── */}
      {DEBUG_MODE && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
          <div style={sectionTitle}>Default Model Selection</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
            Select the standard model for each purpose. All roles inherit from these unless overridden.
          </div>

          {/* Default LLM */}
          <div style={{ ...boxStyle, borderLeft: '3px solid #1565C0', background: 'rgba(21,101,192,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Default LLM</span>
              <span style={{ fontSize: 10, color: '#888' }}>primary model for all tasks</span>
            </div>
            <ModelPicker value={settings.model || ''} onChange={v => setSettings({ ...settings, model: v })} providers={providers} role="chat" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <div style={{ flex: 1, minWidth: 100 }}>
                <label style={labelSmall}>Reasoning</label>
                <select value={settings.reasoningEffort || 'low'} onChange={(e) => setSettings({ ...settings, reasoningEffort: e.target.value })} style={{ width: '100%', fontSize: 11 }}>
                  <option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <label style={labelSmall}>Max Tokens</label>
                <select value={String(settings.maxTokens || 4096)} onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })} style={{ width: '100%', fontSize: 11 }}>
                  {TOKEN_OPTIONS.map(n => <option key={n} value={String(n)}>{n.toLocaleString()}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={labelSmall}>Temperature</label>
                <input type="number" min="0" max="2" step="0.1" value={settings.temperature ?? 0.7} onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })} style={{ width: '100%', fontSize: 11 }} />
              </div>
            </div>
            {isGPT5Model(settings.model) && (
              <div style={{ marginTop: 6 }}>
                <label style={labelSmall}>Verbosity (GPT-5.x)</label>
                <select value={settings.verbosity || ''} onChange={(e) => setSettings({ ...settings, verbosity: e.target.value })} style={{ width: 120, fontSize: 11 }}>
                  <option value="">Default</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={handleTestConnection}>Test Connection</button>
              {testStatus && <span style={{ fontSize: 11, color: testStatus.type === 'success' ? '#28a745' : testStatus.type === 'error' ? '#dc3545' : '#17a2b8' }}>{testStatus.message}</span>}
            </div>
          </div>

          {/* Fast Model */}
          <div style={{ ...boxStyle, borderLeft: '3px solid #0277BD' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Fast Model</span>
              <span style={{ fontSize: 10, color: '#999' }}>template selection, quick assessments</span>
            </div>
            <ModelPicker value={settings.fastModel || ''} onChange={v => setSettings({ ...settings, fastModel: v })} providers={providers} allowEmpty emptyLabel="Use Default model" role="fast" />
            {settings.fastModel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => testModelRef(settings.fastModel, 'fast')}>Test</button>
                {modelTestStatus.fast && <span style={{ fontSize: 10, color: modelTestStatus.fast.type === 'success' ? '#28a745' : modelTestStatus.fast.type === 'error' ? '#dc3545' : '#17a2b8' }}>{modelTestStatus.fast.message}</span>}
              </div>
            )}
          </div>

          {/* Thinking (Deep) Model */}
          <div style={{ ...boxStyle, borderLeft: '3px solid #6A1B9A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Thinking Model</span>
              <span style={{ fontSize: 10, color: '#999' }}>deep analysis, document understanding, compilation</span>
            </div>
            <ModelPicker value={settings.deepAnalysisModel || ''} onChange={v => setSettings({ ...settings, deepAnalysisModel: v })} providers={providers} allowEmpty emptyLabel="Use Default model" role="thinking" />
            {settings.deepAnalysisModel && (
              <>
                <div style={{ marginTop: 4 }}>
                  <label style={labelSmall}>Reasoning</label>
                  <select value={settings.deepAnalysisReasoningEffort || 'medium'} onChange={(e) => setSettings({ ...settings, deepAnalysisReasoningEffort: e.target.value })} style={{ width: 120, fontSize: 11 }}>
                    <option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => testModelRef(settings.deepAnalysisModel, 'thinking')}>Test</button>
                  {modelTestStatus.thinking && <span style={{ fontSize: 10, color: modelTestStatus.thinking.type === 'success' ? '#28a745' : modelTestStatus.thinking.type === 'error' ? '#dc3545' : '#17a2b8' }}>{modelTestStatus.thinking.message}</span>}
                </div>
              </>
            )}
          </div>

          {/* Image Model */}
          <div style={{ ...boxStyle, borderLeft: '3px solid #D97706' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Image Model</span>
              <span style={{ fontSize: 10, color: '#999' }}>image generation (if supported)</span>
            </div>
            <ModelPicker value={settings.imageModel || ''} onChange={v => setSettings({ ...settings, imageModel: v })} providers={providers} allowEmpty emptyLabel="None configured" role="image" />
            {settings.imageModel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => testModelRef(settings.imageModel, 'image')}>Test</button>
                {modelTestStatus.image && <span style={{ fontSize: 10, color: modelTestStatus.image.type === 'success' ? '#28a745' : modelTestStatus.image.type === 'error' ? '#dc3545' : '#17a2b8' }}>{modelTestStatus.image.message}</span>}
              </div>
            )}
          </div>
        </>
      )}

      {/* Feature toggles -- always visible */}
      <div style={{ ...boxStyle, borderLeft: '3px solid #6b7280' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!settings.enableAgenticMode}
            onChange={e => setSettings({ ...settings, enableAgenticMode: e.target.checked })}
            style={{ width: 14, height: 14 }}
          />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Enable Deep Modes</span>
          <span style={{ fontSize: 10, color: '#999' }}>Show Deep Deck &amp; Deep Report in chatbot</span>
        </label>
      </div>

      <div style={{ ...boxStyle, borderLeft: '3px solid #6b7280' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!settings.freestyleSelfCorrection}
            onChange={e => setSettings({ ...settings, freestyleSelfCorrection: e.target.checked })}
            style={{ width: 14, height: 14 }}
          />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Freestyle Self-Correction</span>
          <span style={{ fontSize: 10, color: '#999' }}>Extra LLM call to fix brand compliance issues in freestyle slides (slower)</span>
        </label>
      </div>

      <div style={{ ...boxStyle, borderLeft: '3px solid #2563eb' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.slideLayoutPolish !== false}
            onChange={e => setSettings({ ...settings, slideLayoutPolish: e.target.checked })}
            style={{ width: 14, height: 14 }}
          />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Post-Generation Layout Polish</span>
          <span style={{ fontSize: 10, color: '#999' }}>Fast model pass per slide before display (grids, alignment, overflow; chrome locked). Edit prompts under Settings → Prompts → Layout Polish.</span>
        </label>
      </div>

      {/* ── Web Search / Custom Search Endpoint (DEBUG_MODE only) ── */}
      {DEBUG_MODE && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <div style={sectionTitle}>Web Search</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
            Search lets the AI access the internet for real-time data. Two systems: <b>built-in</b> (Gemini googleSearch, GPT web_search tool) and <b>custom endpoint</b> below.
          </div>

          <div style={boxStyle}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }}>Web Search Endpoint (Agent Research)</div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>Workers use this endpoint to search the web during research. Configure below to enable.</div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11 }}>Endpoint URL</label>
                <input type="url" value={settings.searchEndpoint || ''} onChange={(e) => setSettings({ ...settings, searchEndpoint: e.target.value })} placeholder="https://api.openai.com/v1/responses" style={{ fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Model</label>
                  <input type="text" value={settings.searchModel || ''} onChange={(e) => setSettings({ ...settings, searchModel: e.target.value })} placeholder="openai.gpt-5.4" style={{ fontSize: 12 }} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Evidence Model</label>
                  <input type="text" value={settings.evidenceSearchModel || settings.stepSearchModel || ''} onChange={(e) => setSettings({ ...settings, evidenceSearchModel: e.target.value })} placeholder="openai.gpt-5.4-mini" style={{ fontSize: 12 }} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>API Key</label>
                  <input type="password" value={settings.searchApiKey || ''} onChange={(e) => setSettings({ ...settings, searchApiKey: e.target.value })} placeholder="Enter key..." style={{ fontSize: 12 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelSmall}>Auth Header</label>
                  <select value={settings.searchAuthHeader || 'api-key'} onChange={(e) => setSettings({ ...settings, searchAuthHeader: e.target.value })} style={{ width: '100%', fontSize: 11 }}>
                    <option value="api-key">api-key: KEY</option><option value="bearer">Bearer KEY</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelSmall}>Context Size</label>
                  <select value={settings.searchContextSize || 'medium'} onChange={(e) => setSettings({ ...settings, searchContextSize: e.target.value })} style={{ width: '100%', fontSize: 11 }}>
                    <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelSmall}>Max Tokens</label>
                  <select value={String(settings.searchMaxTokens || 2000)} onChange={(e) => setSettings({ ...settings, searchMaxTokens: parseInt(e.target.value) })} style={{ width: '100%', fontSize: 11 }}>
                    {TOKEN_OPTIONS_SMALL.map(n => <option key={n} value={String(n)}>{n.toLocaleString()}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ ...labelSmall, display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!settings.searchIncludeSources} onChange={(e) => setSettings({ ...settings, searchIncludeSources: e.target.checked })} style={{ width: 'auto' }} />
                  Include source links in research output
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={handleTestSearch} disabled={searchTestStatus?.type === 'loading'}>{searchTestStatus?.type === 'loading' ? 'Testing...' : 'Test Search'}</button>
                {searchTestStatus && <span style={{ fontSize: 11, color: searchTestStatus.type === 'success' ? '#28a745' : searchTestStatus.type === 'error' ? '#dc3545' : '#17a2b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{searchTestStatus.message}</span>}
              </div>
          </div>
        </>
      )}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SECTION 2: Roles ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const renderRoles = () => {
    const roleGroups = [...new Set(ROLE_DEFS.map(d => d.group))];

    return (
      <>
        <div style={sectionTitle}>Per-Role Configuration</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 14 }}>
          Each role inherits from a model tier (shown in gray). Override any parameter — blank = inherit from default. Placeholders show recommended defaults.
        </div>

        {roleGroups.map(group => (
          <div key={group}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{group}</div>
            {ROLE_DEFS.filter(r => r.group === group).map(role => {
              const isSpecial = !!SPECIAL_ROLE_MAPPING[role.key];
              const curModel = getRoleValue(role.key, 'model');
              const curTokens = getRoleValue(role.key, 'maxTokens');
              const curReasoning = getRoleValue(role.key, 'reasoningEffort');
              const curTemp = getRoleValue(role.key, 'temperature');
              const defaults = ROLE_DEFAULTS[role.key] || {};
              const hasOverride = curModel || curTokens || curReasoning || (curTemp !== '' && curTemp != null);
              const hasSearch = role.key !== 'templateSwitcher' && role.key !== 'pptxGenerator' && role.key !== 'quickEdit' && role.key !== 'reportGenerator';

              // Special: routerAgent supports rule-based
              const isRuleBased = role.key === 'routerAgent' && settings.routerModel === 'rule-based';

              return (
                <div key={role.key} style={{ ...boxStyle, borderLeft: `3px solid ${role.color}`, padding: '10px 14px', marginBottom: 6, background: hasOverride ? 'rgba(142,30,30,0.03)' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{role.label}</span>
                    <span style={{ fontSize: 10, color: '#999', fontStyle: 'italic' }}>inherits {ROLE_TIER_MAP[role.key] || 'Default'}</span>
                    {hasOverride && <span style={accentBadge}>CUSTOM</span>}
                    {isRuleBased && <span style={{ ...accentBadge, background: '#E65100' }}>RULE-BASED</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>{role.desc}</div>

                  {/* Model picker — special handling for routerAgent */}
                  {role.key === 'routerAgent' ? (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          value={isRuleBased ? 'rule-based' : (parseModelRef(settings.routerModel).providerId || '')}
                          onChange={(e) => {
                            if (e.target.value === 'rule-based') { setSettings({ ...settings, routerModel: 'rule-based' }); return; }
                            if (!e.target.value) { setSettings({ ...settings, routerModel: '' }); return; }
                            const prov = providers.find(p => p.id === e.target.value);
                            setSettings({ ...settings, routerModel: `${e.target.value}:${prov?.models?.[0] || ''}` });
                          }}
                          style={{ flex: 1, fontSize: 12 }}
                        >
                          <option value="">Use Default model</option>
                          <option value="rule-based">Rule-based (no AI)</option>
                          {providers.filter(p => p.apiKey).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select
                          value={parseModelRef(settings.routerModel).modelName}
                          onChange={(e) => { const pid = parseModelRef(settings.routerModel).providerId; setSettings({ ...settings, routerModel: `${pid}:${e.target.value}` }); }}
                          style={{ flex: 1, fontSize: 12 }}
                          disabled={isRuleBased || !parseModelRef(settings.routerModel).providerId}
                        >
                          <option value="">Select model...</option>
                          {(providers.find(p => p.id === parseModelRef(settings.routerModel).providerId)?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : isSpecial ? (
                    <ModelPicker value={curModel || ''} onChange={v => setRoleValue(role.key, 'model', v)} providers={providers} allowEmpty emptyLabel="Use Default model" role="chat" />
                  ) : (
                    <ModelPicker value={curModel || ''} onChange={v => setRoleValue(role.key, 'model', v)} providers={providers} allowEmpty emptyLabel="Inherit" role="chat" />
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 80 }}>
                      <label style={{ ...labelSmall, fontSize: 10 }}>Reasoning</label>
                      <select
                        value={curReasoning || ''}
                        onChange={(e) => setRoleValue(role.key, 'reasoningEffort', e.target.value)}
                        style={{ width: '100%', fontSize: 10 }}
                        disabled={isRuleBased}
                      >
                        <option value="">{defaults.reasoningEffort ? `Inherit (${defaults.reasoningEffort})` : 'Inherit'}</option>
                        <option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 80 }}>
                      <label style={{ ...labelSmall, fontSize: 10 }}>Max Tokens</label>
                      <select
                        value={curTokens || ''}
                        onChange={(e) => setRoleValue(role.key, 'maxTokens', e.target.value)}
                        style={{ width: '100%', fontSize: 10 }}
                        disabled={isRuleBased}
                      >
                        <option value="">{defaults.maxTokens ? `Inherit (${defaults.maxTokens.toLocaleString()})` : 'Inherit'}</option>
                        {TOKEN_OPTIONS.map(n => <option key={n} value={String(n)}>{n.toLocaleString()}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 70 }}>
                      <label style={{ ...labelSmall, fontSize: 10 }}>Temp</label>
                      <input
                        type="number" min="0" max="2" step="0.1"
                        value={curTemp !== '' && curTemp != null ? curTemp : ''}
                        onChange={(e) => setRoleValue(role.key, 'temperature', e.target.value)}
                        placeholder={defaults.temperature != null ? String(defaults.temperature) : 'inherit'}
                        style={{ width: '100%', fontSize: 10 }}
                        disabled={isRuleBased}
                      />
                    </div>
                    {hasSearch && (
                      <div style={{ flex: 1, minWidth: 70 }}>
                        <label style={{ ...labelSmall, fontSize: 10 }}>Search</label>
                        <select
                          value={getRoleValue(role.key, 'searchEnabled') !== '' && getRoleValue(role.key, 'searchEnabled') != null ? String(getRoleValue(role.key, 'searchEnabled')) : ''}
                          onChange={(e) => setRoleValue(role.key, 'searchEnabled', e.target.value)}
                          style={{ width: '100%', fontSize: 10 }}
                          disabled={isRuleBased}
                        >
                          <option value="">Inherit</option><option value="true">On</option><option value="false">Off</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {hasOverride && !isSpecial && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, marginTop: 4, color: '#dc3545', padding: '2px 6px' }} onClick={() => setSettings(s => ({ ...s, roleSettings: { ...s.roleSettings, [role.key]: { model: '', maxTokens: '', reasoningEffort: '', temperature: '', searchEnabled: '' } } }))}>
                      Clear Overrides
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SECTION 3: Generation Parameters ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const renderGeneration = () => (
    <>
      {/* ── Agent Workflow ── */}
      <div style={sectionTitle}>Agent Workflow</div>

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12 }}>Slide Creation Batch</label>
        <select value={String(settings.slideCreationBatchSize || 3)} onChange={(e) => setSettings({ ...settings, slideCreationBatchSize: parseInt(e.target.value) })} style={{ width: '100%', fontSize: 12 }}>
          <option value="1">1 (one-by-one)</option><option value="2">2 per call</option><option value="3">3 per call</option><option value="5">5 per call</option>
        </select>
        <div style={hint}>Slides per API call. Higher = faster but less reliable.</div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Min Budget (credits)</label>
          <input type="number" min={3} max={50} value={settings.agentMinBudget || 8} onChange={(e) => setSettings({ ...settings, agentMinBudget: Math.max(3, parseInt(e.target.value) || 8) })} style={{ fontSize: 12 }} />
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Max Budget (credits)</label>
          <input type="number" min={5} max={100} value={settings.agentMaxBudget || 30} onChange={(e) => setSettings({ ...settings, agentMaxBudget: Math.max(5, parseInt(e.target.value) || 30) })} style={{ fontSize: 12 }} />
        </div>
      </div>

      {/* Work Level */}
      <div style={boxStyle}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>Work Level</div>
        <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>How much detail the AI puts into output. Higher = more tokens, richer content.</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { key: 'workLevelSlide', label: 'Chatbot', defaultVal: 'medium' },
            { key: 'workLevelAgent', label: 'Agent (Slides)', defaultVal: 'high' },
            { key: 'workLevelReport', label: 'Agent (Report)', defaultVal: 'high' },
          ].map(wl => (
            <div key={wl.key} style={{ flex: 1 }}>
              <label style={labelSmall}>{wl.label}</label>
              <select value={settings[wl.key] || wl.defaultVal} onChange={(e) => setSettings({ ...settings, [wl.key]: e.target.value })} style={{ width: '100%', fontSize: 11 }}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="very_high">Very High</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Behavior toggles */}
      <div style={boxStyle}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>Behavior</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'agentRichResearch', label: 'Rich Research Mode', desc: 'Full thematic research text to compiler (richer but more tokens)', defaultVal: false },
            { key: 'showAgentSteps', label: 'Show Agent Steps', desc: 'Step-by-step progress during agent runs', defaultVal: true },
            { key: 'showApprovalDebugInfo', label: 'Debug Info in Approval', desc: 'Context and raw data in plan approval screen', defaultVal: false },
          ].map(opt => (
            <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={settings[opt.key] ?? opt.defaultVal} onChange={(e) => setSettings({ ...settings, [opt.key]: e.target.checked })} style={{ width: 'auto', marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {/* ── Chatbot ── */}
      <div style={sectionTitle}>Chatbot</div>
      <div className="form-group">
        <label style={{ fontSize: 12 }}>Edit All Batch Size</label>
        <select value={String(settings.editAllBatchSize || 3)} onChange={(e) => setSettings({ ...settings, editAllBatchSize: parseInt(e.target.value) })}>
          <option value="1">1</option><option value="2">2</option><option value="3">3 (default)</option><option value="5">5</option><option value="10">10</option>
        </select>
        <div style={hint}>Slides per batch in "Edit All" mode.</div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {/* ── Interactive Report ── */}
      <div style={sectionTitle}>Interactive Report</div>

      {/* Generation Mode */}
      <div style={{ ...boxStyle, borderLeft: '3px solid #2E7D32', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>Generation Mode</div>
        {(() => {
          const fmt = settings.reportFormat || 'html';
          const single = settings.reportSingleCall || false;
          // Derive a combined mode key
          const mode = fmt === 'json' ? 'json' : single ? 'html-single' : 'html-multi';
          const setMode = (m) => {
            if (m === 'json') setSettings({ ...settings, reportFormat: 'json', reportSingleCall: false });
            else if (m === 'html-single') setSettings({ ...settings, reportFormat: 'html', reportSingleCall: true });
            else setSettings({ ...settings, reportFormat: 'html', reportSingleCall: false });
          };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { key: 'html-multi', label: 'Multi-Agent HTML', desc: 'Parallel API calls per section, merged into one report. Best for long, detailed reports.' },
                { key: 'json', label: 'JSON → Rendered HTML', desc: 'AI outputs structured JSON blocks, app renders polished HTML. Most consistent and clean output.' },
                { key: 'html-single', label: 'One-Shot Full HTML', desc: 'Single API call generates entire report as raw HTML. Fast but limited by token budget.' },
              ].map(opt => (
                <label key={opt.key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                  padding: '8px 12px', borderRadius: 6,
                  border: mode === opt.key ? '2px solid #2E7D32' : '2px solid var(--border, #e0e0e0)',
                  background: mode === opt.key ? 'rgba(46,125,50,0.06)' : 'transparent',
                }}>
                  <input type="radio" name="reportMode" checked={mode === opt.key} onChange={() => setMode(opt.key)} style={{ width: 'auto', marginTop: 3 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Report Options */}
      <div style={{ ...boxStyle, borderLeft: '3px solid #2E7D32' }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>Options</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11 }}>
          <input type="checkbox" checked={!!settings.reportSearchEnabled} onChange={(e) => setSettings({ ...settings, reportSearchEnabled: e.target.checked })} style={{ width: 'auto' }} />
          Enable web search during report generation <span style={{ color: '#888', fontSize: 10 }}>(usually not needed — agent already has research)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, marginTop: 6 }}>
          <input type="checkbox" checked={!!settings.reportSkipCompilation} onChange={(e) => setSettings({ ...settings, reportSkipCompilation: e.target.checked })} style={{ width: 'auto' }} />
          Skip manager compilation <span style={{ color: '#888', fontSize: 10 }}>(send raw consultant research directly to report — faster, saves 1 credit)</span>
        </label>
        <div style={{ fontSize: 10, color: '#888', marginTop: 8 }}>Model, reasoning, and token limits for the report generator are configured in the <b>Roles</b> tab under "Report Generator".</div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {/* ── API Concurrency ── */}
      <div style={sectionTitle}>Parallelism</div>
      <div className="form-group">
        <label style={{ fontSize: 12 }}>Max Concurrent API Calls</label>
        <select value={String(settings.apiMaxConcurrent || 5)} onChange={(e) => { const v = parseInt(e.target.value); setApiMaxConcurrent(v); setSettings({ ...settings, apiMaxConcurrent: v }); }}>
          <option value="1">1 (safest)</option><option value="2">2</option><option value="3">3</option><option value="5">5 (default)</option><option value="8">8</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="30">30</option>
        </select>
        <div style={hint}>All paths (router, slides, agent, edits) share this cap. Lower if you see connection errors.</div>
      </div>
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SECTION 4: Advanced ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const renderAdvanced = () => {
    const limitGroups = [...new Set(LIMIT_DEFS.map(d => d.group))];

    return (
      <>
        {/* ── Naming Conventions ── */}
        <div style={sectionTitle}>Naming Conventions</div>

        <div className="form-group">
          <label>Footer / Branding</label>
          <input type="text" value={settings.footerBranding ?? 'Strategy&'} onChange={(e) => setSettings({ ...settings, footerBranding: e.target.value })} placeholder="Source (optional)" />
          <div style={hint}>Shown in the footer of every slide.</div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={settings.useNomenclature ?? true} onChange={(e) => setSettings({ ...settings, useNomenclature: e.target.checked })} style={{ width: 'auto' }} />
          Use standard naming convention
        </label>
        {(settings.useNomenclature ?? true) && (
          <>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>PPTX Pattern</label>
              <input type="text" value={settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}'} onChange={(e) => setSettings({ ...settings, nomenclaturePattern: e.target.value })} />
              <div style={hint}>Variables: <code>yyyy</code>, <code>mm</code>, <code>dd</code>, <code>{'{name}'}</code>, <code>{'{version}'}</code></div>
            </div>
            <div className="form-group">
              <label>Report Pattern</label>
              <input type="text" value={settings.reportNomenclaturePattern || 'yyyymmdd_S&_{name}_Report_V{version}'} onChange={(e) => setSettings({ ...settings, reportNomenclaturePattern: e.target.value })} />
              <div style={hint}>Same variables as PPTX. Applies to downloaded HTML reports.</div>
            </div>
          </>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* ── PPTX Generation ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={sectionTitle}>PPTX Generation</div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => toggle('pptx')}>{expandedAdvanced.pptx ? 'Collapse' : 'Expand'}</button>
        </div>

        {expandedAdvanced.pptx ? (
          <div style={{ marginBottom: 16 }}>
            {/* PPTX Base Template (read-only) */}
            {pptxTemplateName && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelSmall}>Base Template</label>
              <div style={{ ...hint, marginBottom: 8 }}>PowerPoint template used for slide masters, theme, and fonts for the active {activeClientProfile.navLabel || activeClientProfile.name} profile.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--zone1)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{pptxTemplateName}</div>
                  <div style={{ fontSize: 11, color: 'var(--meta)' }}>Active for {activeClientProfile.navLabel || activeClientProfile.name}</div>
                </div>
                <button
                  onClick={async () => {
                    const data = await loadTemplateFromStorage({ profileId: settings.clientDesignProfileId || 'strategy' });
                    if (data?.data) downloadArrayBuffer(data.data, data.fileName || 'template.pptx');
                  }}
                  title="Download template"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--meta)', display: 'flex' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              </div>

              {/* Branding preview after extraction */}
              {extractedBranding && (
                <div style={{ marginTop: 12, padding: 14, background: 'var(--zone1)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Detected Brand Theme</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {Object.entries(extractedBranding.theme.colors).slice(0, 12).map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 3, background: val, border: '1px solid var(--border)' }} />
                        <span style={{ color: 'var(--meta)' }}>{key}</span>
                      </div>
                    ))}
                  </div>
                  {extractedBranding.theme.fonts && (
                    <div style={{ fontSize: 11, color: 'var(--meta)', marginBottom: 8 }}>
                      Fonts: {extractedBranding.theme.fonts.title} / {extractedBranding.theme.fonts.body}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={applyExtractedTheme}>Apply Theme</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setExtractedBranding(null)}>Dismiss</button>
                  </div>
                </div>
              )}
            </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('Reset PPTX settings?')) setSettings({ ...settings, pptxModel: '', pptxSystemPrompt: '', pptxCodeExample: '', pptxBatchSize: 10, pptxParallelBatches: 3, pptxGenerateOnCreate: false }); }}>Reset to Defaults</button>
            </div>
            <div className="form-group">
              <label>PPTX Model</label>
              <input type="text" value={settings.pptxModel || ''} onChange={(e) => setSettings({ ...settings, pptxModel: e.target.value })} placeholder="Uses Default model" style={{ width: 200 }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Slides per Batch</label>
                <select value={String(settings.pptxBatchSize || 10)} onChange={(e) => setSettings({ ...settings, pptxBatchSize: parseInt(e.target.value) || 10 })} style={{ width: '100%', fontSize: 12 }}>
                  {[1, 2, 3, 5, 10, 15, 20, 30, 50].map(n => <option key={n} value={String(n)}>{n}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Parallel Batches</label>
                <select value={String(settings.pptxParallelBatches || 3)} onChange={(e) => setSettings({ ...settings, pptxParallelBatches: parseInt(e.target.value) || 3 })} style={{ width: '100%', fontSize: 12 }}>
                  {[1, 2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={String(n)}>{n} concurrent</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#64748B' }}>
              PPTX renderer code is generated only when exporting; background pre-generation is disabled.
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label>System Prompt</label>
              <textarea value={settings.pptxSystemPrompt || DEFAULT_PPTX_SYSTEM_PROMPT} onChange={(e) => setSettings({ ...settings, pptxSystemPrompt: e.target.value })} style={{ width: '100%', minHeight: 120, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4 }} />
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Code Example</label>
              <textarea value={settings.pptxCodeExample || DEFAULT_PPTX_CODE_EXAMPLE} onChange={(e) => setSettings({ ...settings, pptxCodeExample: e.target.value })} style={{ width: '100%', minHeight: 80, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4 }} />
            </div>
          </div>
        ) : (
          <div style={{ ...hint, marginBottom: 16 }}>How slides are converted to PowerPoint. Click Expand to configure.</div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* ── Pipeline Data Limits ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={sectionTitle}>Pipeline Data Limits</div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => toggle('limits')}>{expandedAdvanced.limits ? 'Collapse' : 'Expand'}</button>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
          How much data flows through each pipeline stage. Higher = richer but more tokens.
        </div>

        {expandedAdvanced.limits && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => {
                const r = {}; LIMIT_DEFS.forEach(d => { r[d.key] = d.default; }); setSettings({ ...settings, ...r });
              }}>Reset All</button>
            </div>
            {limitGroups.map(group => (
              <div key={group} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent, #8E1E1E)', margin: '0 0 8px', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  {LIMIT_DEFS.filter(d => d.group === group).map(def => {
                    const val = settings[def.key];
                    const isDefault = val === undefined || val === null || val === '' || Number(val) === def.default;
                    return (
                      <div key={def.key}>
                        <label style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          {def.label} {!isDefault && <span style={accentBadge}>CUSTOM</span>}
                        </label>
                        <input type="number" value={val !== undefined && val !== null && val !== '' ? val : def.default} onChange={(e) => setSettings({ ...settings, [def.key]: e.target.value === '' ? def.default : Number(e.target.value) })} style={{ width: '100%', fontSize: 11, padding: '3px 6px' }} min={0} />
                        <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{def.desc} (default: {def.default.toLocaleString()})</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* ── Data Management ── */}
        <div style={sectionTitle}>Data Management</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <button className="btn btn-danger btn-sm" onClick={handleClearData}>Clear All Slides</button>
          <button className="btn btn-ghost btn-sm" onClick={handleClearHistory} style={{ color: 'var(--warning, #f59e0b)' }}>Clear History ({state.deckVersions?.length || 0} versions)</button>
        </div>
        <div style={hint}>Clear History removes saved deck versions to free storage. Current slides are not affected.</div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-danger btn-sm" onClick={handleClearEverything} style={{ background: '#7f1d1d', borderColor: '#7f1d1d' }}>
            Clear Everything (Factory Reset)
          </button>
          <div style={{ ...hint, color: '#dc3545', marginTop: 4 }}>
            Deletes ALL data: slides, history, settings, templates, knowledge base. Page will reload.
          </div>
        </div>
      </>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SECTION 5: Prompts ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const renderPrompts = () => {
    const promptSections = [
      { key: 'freestyleShell',   label: 'Shell (Layout & Structure)',      defaultVal: DEFAULT_SHELL,   desc: 'Canvas dimensions, HTML skeleton, output format, CSS scoping rules, class naming.' },
      { key: 'freestyleTheme',   label: 'Theme (Colors, Fonts & Style)',   defaultVal: DEFAULT_THEME,   desc: 'Design tokens, font families, contrast rules, design principles, visual anti-patterns.' },
      { key: 'freestyleVibe',    label: 'Vibe (Style Variation)',          defaultVal: DEFAULT_VIBE,    desc: 'Active style variation applied on top of the theme. Currently locked to default.' },
      { key: 'freestyleWriting', label: 'Writing Profile',                 defaultVal: DEFAULT_WRITING, desc: 'Title/subtitle style, text density, layout archetypes, source citations, content anti-patterns.' },
    ];
    const promptOverrideDefaults = {
      'router.system': getRouterSystemPrompt(),
      'triage.system': TRIAGE_SYSTEM_PROMPT,
      'slideGen.freestyleSystem': DEFAULT_SLIDE_HTML_GENERATOR_PROMPT,
      'slideGen.freestyleUser': '',
      'slideGen.templateSystem': DEFAULT_SYSTEM_PROMPT,
      'slideGen.templateUser': '',
      'edit.system': EDIT_SYSTEM_PROMPT,
      'validation.system': 'You are a strict quality assurance expert for Strategy& consulting slide design.',
      'layoutPolish.system': DEFAULT_LAYOUT_POLISH_SYSTEM,
      'layoutPolish.user': DEFAULT_LAYOUT_POLISH_USER_TEMPLATE,
      'pptx.system': DEFAULT_PPTX_SYSTEM_PROMPT,
      'visualUplift.system': VISUAL_UPLIFT_PROMPT,
    };
    const promptOverrides = settings.promptOverrides || {};
    const lastPromptPayloads = getLastPromptPayloads();
    void promptPayloadRefresh;
    const updatePromptOverride = (key, value) => {
      setSettings({
        ...settings,
        promptOverrides: {
          ...promptOverrides,
          [key]: value,
        },
      });
    };
    const resetPromptOverride = (key) => {
      const next = { ...promptOverrides };
      delete next[key];
      setSettings({ ...settings, promptOverrides: next });
    };

    const renderPromptOverrideField = (def) => {
      const value = promptOverrides[def.key] || '';
      const isCustom = value.trim() !== '';
      const defaultText = promptOverrideDefaults[def.key] || '';
      return (
        <div key={def.key} style={{ ...boxStyle, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{def.label} <span style={{ color: '#888', fontWeight: 400 }}>({def.key})</span></div>
              <div style={{ fontSize: 10, color: '#888' }}>{def.description}{def.mode === 'append' ? ' Appended to the user prompt.' : ''}</div>
            </div>
            {isCustom && <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => resetPromptOverride(def.key)}>Reset</button>}
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: '#666' }}>Default prompt</summary>
            <pre style={{ maxHeight: 140, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 10, background: '#f7f7f7', padding: 8, borderRadius: 6 }}>{defaultText || '(no default postamble)'}</pre>
          </details>
          <textarea
            value={value}
            onChange={(e) => updatePromptOverride(def.key, e.target.value)}
            placeholder={def.mode === 'append' ? 'Optional postamble appended to this prompt surface.' : 'Leave empty to use the default prompt.'}
            style={{ width: '100%', minHeight: def.key === 'layoutPolish.system' ? 160 : 72, marginTop: 8, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4, borderRadius: 6, border: '1px solid var(--border)', padding: 8 }}
          />
        </div>
      );
    };

    const layoutPolishPromptDefs = PROMPT_OVERRIDE_DEFS.filter((def) => LAYOUT_POLISH_PROMPT_KEYS.has(def.key));

    return (
      <>
        <div style={sectionTitle}>Freestyle Prompt Sections</div>
        <div style={{ ...hint, marginBottom: 12 }}>
          These three sections compose the system prompt for freestyle slide generation. Edit a section to override the default, or leave empty to use the built-in version.
        </div>

        {promptSections.map(({ key, label, defaultVal, desc }) => {
          const isCustom = settings[key] && settings[key].trim() !== '';
          return (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 0', fontWeight: 600 }}
                    onClick={() => toggle(key)}
                  >
                    {expandedAdvanced[key] ? '\u25BE' : '\u25B8'} {label}
                  </button>
                  {isCustom && <span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 8 }}>customized</span>}
                </div>
                {isCustom && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => { if (window.confirm('Reset to default?')) setSettings({ ...settings, [key]: '' }); }}>Reset</button>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 4, paddingLeft: 12 }}>{desc}</div>
              {expandedAdvanced[key] && (
                <textarea
                  value={isCustom ? settings[key] : defaultVal}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  placeholder="Leave empty to use the built-in default."
                  style={{ width: '100%', minHeight: 180, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4, borderRadius: 6, border: '1px solid var(--border)', padding: 8 }}
                />
              )}
            </div>
          );
        })}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <div style={sectionTitle}>System Prompt Override</div>
        <div style={{ ...hint, marginBottom: 8 }}>
          When set, this replaces all freestyle prompt sections above for slide generation. Leave empty to use the modular sections.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={labelSmall}>Override Prompt</label>
          {settings.systemPrompt && settings.systemPrompt.trim() !== '' && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => { if (window.confirm('Clear override?')) setSettings({ ...settings, systemPrompt: '' }); }}>Clear</button>
          )}
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <textarea
            value={settings.systemPrompt || ''}
            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
            placeholder="Leave empty to use the freestyle prompt sections above."
            style={{ width: '100%', minHeight: 100, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4, borderRadius: 6, border: '1px solid var(--border)', padding: 8 }}
          />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <div style={sectionTitle}>Report System Prompt</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={labelSmall}>Report Prompt</label>
          {settings.reportSystemPrompt && settings.reportSystemPrompt.trim() !== '' && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setSettings({ ...settings, reportSystemPrompt: '' })}>Reset</button>
          )}
        </div>
        <div className="form-group">
          <textarea
            value={settings.reportSystemPrompt || ''}
            onChange={(e) => setSettings({ ...settings, reportSystemPrompt: e.target.value })}
            placeholder="Leave empty for default."
            style={{ width: '100%', minHeight: 80, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4, borderRadius: 6, border: '1px solid var(--border)', padding: 8 }}
          />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <div style={sectionTitle}>Layout Polish (post-generation)</div>
        <div style={{ ...hint, marginBottom: 8 }}>
          Fast-model pass after slide generation (see Generation → Post-Generation Layout Polish). Overrides apply when polish is enabled.
          User template placeholders: <code style={{ fontSize: 10 }}>{'{instructionBlock}'}</code>, <code style={{ fontSize: 10 }}>{'{slideHtml}'}</code>.
        </div>
        {layoutPolishPromptDefs.map(renderPromptOverrideField)}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <div style={sectionTitle}>Visual Uplift</div>
        <div style={{ ...boxStyle, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
            Uses the Image role model: <code style={{ fontSize: 10 }}>{(settings.imageModel || 'not configured').replace(/^pwc:/, '')}</code>.
            Prompt is editable below under <strong>Visual Uplift</strong> in Prompt Debug Overrides.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={settings.visualUpliftEnabled === true}
              onChange={(e) => setSettings({ ...settings, visualUpliftEnabled: e.target.checked })}
            />
            Enable Visual Uplift button in the AI panel
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={settings.visualUpliftIncludeTheme !== false}
              onChange={(e) => setSettings({ ...settings, visualUpliftIncludeTheme: e.target.checked })}
            />
            Include client profile theme tokens (accent colors, fonts)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={settings.visualUpliftIncludeVibe !== false}
              onChange={(e) => setSettings({ ...settings, visualUpliftIncludeVibe: e.target.checked })}
            />
            Include image vibe (when not default)
          </label>
        </div>

        <div style={sectionTitle}>Prompt Debug Overrides</div>
        <div style={{ ...hint, marginBottom: 8 }}>
          Debug-only prompt registry. Overrides replace defaults unless labeled as a postamble, where they are appended to the user prompt.
        </div>
        {PROMPT_OVERRIDE_DEFS.filter((def) => !LAYOUT_POLISH_PROMPT_KEYS.has(def.key)).map(renderPromptOverrideField)}

        <div style={{ ...boxStyle, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>Recent Prompt Payloads</div>
              <div style={{ fontSize: 10, color: '#888' }}>Last 20 router, generation, edit, validation, and PPTX payloads recorded locally in this browser.</div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setPromptPayloadRefresh(Date.now())}>Refresh</button>
          </div>
          {lastPromptPayloads.length === 0 ? (
            <div style={{ ...hint, marginTop: 8 }}>No prompt payloads recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {lastPromptPayloads.slice(0, 6).map((entry, index) => {
                const payloadText = JSON.stringify(entry.payload || {}, null, 2);
                return (
                  <details key={`${entry.surface}-${entry.timestamp}-${index}`}>
                    <summary style={{ cursor: 'pointer', fontSize: 11 }}>
                      {entry.surface} at {entry.timestamp}
                    </summary>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 10 }}
                        onClick={() => navigator.clipboard?.writeText(JSON.stringify(entry, null, 2))}
                      >
                        Copy payload
                      </button>
                    </div>
                    <pre style={{ maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 10, background: '#f7f7f7', padding: 8, borderRadius: 6 }}>{payloadText}</pre>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SIDEBAR SECTIONS ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const renderEssential = () => (
    <>
      {renderGenerationDefaults()}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {renderProviders()}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <div style={sectionTitle}>Model Roles</div>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 10 }}>Server-managed model assignments for each pipeline stage.{DEBUG_MODE ? ' You can override any role below.' : ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { key: 'model',           label: 'Premium',         desc: 'High-quality slide generation (Premium speed mode)',   role: 'chat' },
          { key: 'fastModel',       label: 'Fast',            desc: 'Balanced slide generation (Fast speed mode)',          role: 'chat' },
          { key: 'classifierModel', label: 'Classifier',      desc: 'Tier 1 quick intent classification',                  role: 'fast' },
          { key: 'routerModel',     label: 'Router',          desc: 'Tier 2 full planner for multi-slide requests',        role: 'chat' },
          { key: 'searchModel',     label: 'Search',          desc: 'Web search queries and result synthesis',              role: 'chat' },
          { key: 'evidenceSearchModel', label: 'Evidence',    desc: 'Per-slide factual search enrichment',                  role: 'chat' },
          { key: 'pptxModel',       label: 'PPTX Export',     desc: 'Converts slides to PowerPoint code',                   role: 'chat' },
          { key: 'reportModel',     label: 'Report',          desc: 'Generates interactive HTML/JSON reports',              role: 'chat' },
          { key: 'imageModel',      label: 'Image',           desc: 'AI image generation',                                 role: 'image' },
        ].map(mr => (
          <div key={mr.key} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 6,
            background: 'var(--zone1, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
          }}>
            <div style={{ width: 100, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{mr.label}</div>
              <div style={{ fontSize: 9, color: '#999', lineHeight: 1.2, marginTop: 1 }}>{mr.desc}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {DEBUG_MODE ? (
                <ModelPicker
                  value={settings[mr.key] || ''}
                  onChange={v => setSettings({ ...settings, [mr.key]: v })}
                  providers={providers}
                  allowEmpty
                  emptyLabel="Use Default"
                  role={mr.role}
                />
              ) : (
                <div style={{
                  fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary, #64748b)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {stripProviderPrefix(settings[mr.key]) || '(default)'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <div style={sectionTitle}>Search</div>
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.searchEnabled ?? false} onChange={(e) => setSettings({ ...settings, searchEnabled: e.target.checked })} style={{ width: 'auto' }} />
          Enable web search
        </label>
      </div>
      {settings.searchEnabled && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12 }}>Search Endpoint</label>
          <input type="text" value={settings.searchEndpoint || ''} onChange={(e) => setSettings({ ...settings, searchEndpoint: e.target.value })} placeholder="https://..." style={{ fontSize: 12 }} />
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <div style={sectionTitle}>Branding</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Footer Branding</label>
          <input type="text" value={settings.footerBranding ?? 'Strategy&'} onChange={(e) => setSettings({ ...settings, footerBranding: e.target.value })} placeholder="Source (optional)" style={{ fontSize: 12 }} />
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Manager Name</label>
          <input type="text" value={settings.agentManagerName || 'Edwin'} onChange={(e) => setSettings({ ...settings, agentManagerName: e.target.value.trim() || 'Edwin' })} placeholder="Edwin" style={{ fontSize: 12 }} />
        </div>
      </div>

    </>
  );

  // ─── Simplified settings for non-debug users ──────────────────────────────
  const renderLayoutPolishPromptSettings = () => {
    const promptOverrides = settings.promptOverrides || {};
    const updatePromptOverride = (key, value) => {
      setSettings({
        ...settings,
        promptOverrides: { ...promptOverrides, [key]: value },
      });
    };
    const resetPromptOverride = (key) => {
      const next = { ...promptOverrides };
      delete next[key];
      setSettings({ ...settings, promptOverrides: next });
    };
    const fields = [
      {
        key: 'layoutPolish.system',
        label: 'System prompt',
        defaultText: DEFAULT_LAYOUT_POLISH_SYSTEM,
        minHeight: 140,
        hint: 'Replaces the layout QA system instructions.',
      },
      {
        key: 'layoutPolish.user',
        label: 'User message template',
        defaultText: DEFAULT_LAYOUT_POLISH_USER_TEMPLATE,
        minHeight: 72,
        hint: 'Placeholders: {instructionBlock}, {slideHtml}',
      },
    ];
    return (
      <div style={{ padding: '16px 20px', background: 'var(--zone1, #f8fafc)', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Layout polish prompts</div>
        <div style={{ fontSize: 12, color: 'var(--meta, #888)', marginBottom: 12 }}>
          Optional overrides for the fast post-generation layout pass. Leave empty to use built-in defaults.
        </div>
        {fields.map(({ key, label, defaultText, minHeight, hint }) => {
          const value = promptOverrides[key] || '';
          const isCustom = value.trim() !== '';
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>{label}</label>
                {isCustom && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => resetPromptOverride(key)}>Reset</button>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{hint}</div>
              <details style={{ marginBottom: 6 }}>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: '#666' }}>View default</summary>
                <pre style={{ maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 10, background: '#f7f7f7', padding: 8, borderRadius: 6, marginTop: 4 }}>{defaultText}</pre>
              </details>
              <textarea
                value={value}
                onChange={(e) => updatePromptOverride(key, e.target.value)}
                placeholder="Leave empty to use the default."
                style={{
                  width: '100%',
                  minHeight,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  lineHeight: 1.4,
                  borderRadius: 6,
                  border: '1px solid var(--border, #e2e8f0)',
                  padding: 8,
                }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderSimplifiedSettings = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {renderGenerationDefaults()}
      {renderLayoutPolishPromptSettings()}

      {/* User Preferences */}
      <div style={{ padding: '20px', background: 'var(--zone1, #f8fafc)', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>Preferences</div>
        <div style={{ fontSize: 12, color: 'var(--meta, #888)', marginBottom: 12 }}>General instructions applied to every deck. The AI uses these as persistent context for planning and slide generation.</div>
        <textarea
          value={settings.userPreferences || ''}
          onChange={(e) => setSettings({ ...settings, userPreferences: e.target.value })}
          placeholder={'Examples:\n- Write in Arabic\n- Focus on Saudi Arabia and UAE markets\n- Use data-driven, chart-heavy slides\n- Keep language simple and direct'}
          style={{
            width: '100%', minHeight: 100, maxHeight: 200, resize: 'vertical',
            fontSize: 12, fontFamily: 'inherit', lineHeight: 1.5,
            padding: '10px 12px', borderRadius: 6,
            border: '1px solid var(--border, #e2e8f0)',
            background: 'var(--page, #fff)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Branding */}
      <div style={{ padding: '20px', background: 'var(--zone1, #f8fafc)', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>Branding</div>
        <div style={{ fontSize: 12, color: 'var(--meta, #888)', marginBottom: 12 }}>Footer text and agent name that appear on every slide.</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Footer Text</label>
            <input type="text" value={settings.footerBranding ?? 'Strategy&'} onChange={(e) => setSettings({ ...settings, footerBranding: e.target.value })} placeholder="Source (optional)" style={{ fontSize: 12 }} />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Agent Name</label>
            <input type="text" value={settings.agentManagerName || 'Edwin'} onChange={(e) => setSettings({ ...settings, agentManagerName: e.target.value.trim() || 'Edwin' })} placeholder="Edwin" style={{ fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* Design Style */}
      <div style={{ padding: '20px', background: 'var(--zone1, #f8fafc)', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>Design Style</div>
        <div style={{ fontSize: 12, color: 'var(--meta, #888)', marginBottom: 12 }}>Controls the visual approach for generated slides. Each style adjusts layout density, typography, and emphasis.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {Object.values(FREESTYLE_PRESETS).map(preset => (
            <button
              key={preset.id}
              onClick={() => setSettings({ ...settings, freestylePreset: preset.id })}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: (settings.freestylePreset || 'default') === preset.id
                  ? '2px solid var(--accent, #8E1E1E)'
                  : '1px solid var(--border, #e2e8f0)',
                background: (settings.freestylePreset || 'default') === preset.id
                  ? 'var(--accent-soft, #fdf6f6)'
                  : 'var(--page, #fff)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{preset.name}</div>
              <div style={{ fontSize: 11, color: 'var(--meta, #888)', lineHeight: 1.3 }}>{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Template (read-only) */}
      {pptxTemplateName && (
        <div style={{ padding: '20px', background: 'var(--zone1, #f8fafc)', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>Template</div>
          <div style={{ fontSize: 12, color: 'var(--meta, #888)', marginBottom: 12 }}>PowerPoint template used for slide masters, theme colors, and fonts for the active {activeClientProfile.navLabel || activeClientProfile.name} profile.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--page, #fff)', borderRadius: 6, border: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{pptxTemplateName}</div>
              <div style={{ fontSize: 11, color: 'var(--meta)' }}>Active for {activeClientProfile.navLabel || activeClientProfile.name}</div>
            </div>
            <button
              onClick={async () => {
                const data = await loadTemplateFromStorage({ profileId: settings.clientDesignProfileId || 'strategy' });
                if (data?.data) downloadArrayBuffer(data.data, data.fileName || 'template.pptx');
              }}
              title="Download template"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--meta)', display: 'flex' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const SECTIONS = (() => {
    const sections = [
      { id: 'essential',   label: 'Essential',   icon: '\u25C8' },
      { id: 'generation',  label: 'Generation',  icon: '\u25C9' },
      { id: 'prompts',     label: 'Prompts',     icon: '\u25A3' },
    ];
    if (DEBUG_MODE) {
      sections.push({ id: 'roles', label: 'Roles', icon: '\u25C6' });
      sections.push({ id: 'advanced', label: 'Advanced', icon: '\u25EB' });
    }
    return sections;
  })();

  // ─── Simplified modal for normal users ──────────────────────────────────────
  if (!DEBUG_MODE) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 520, width: '94%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        >
          <div className="modal-header" style={{ flexShrink: 0 }}>
            <h2>Settings</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
            {renderSimplifiedSettings()}
          </div>
          <div className="modal-footer" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Full debug modal with sidebar ────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 800, width: '94%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Body: Sidebar + Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Sidebar */}
          <div style={{
            width: 140, flexShrink: 0,
            borderRight: '1px solid var(--border, #e0e0e0)',
            display: 'flex', flexDirection: 'column',
            paddingTop: 8, paddingBottom: 8,
            background: 'var(--zone1, #fff)',
          }}>
            {SECTIONS.map(sec => (
              <button
                key={sec.id}
                style={sidebarItemStyle(activeSection === sec.id)}
                onClick={() => setActiveSection(sec.id)}
              >
                <span style={{ marginRight: 6, opacity: 0.5 }}>{sec.icon}</span>
                {sec.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
            {activeSection === 'essential' && renderEssential()}
            {activeSection === 'generation' && renderGeneration()}
            {activeSection === 'prompts' && renderPrompts()}
            {activeSection === 'roles' && renderRoles()}
            {activeSection === 'advanced' && renderAdvanced()}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => {
            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `slide-settings-${new Date().toISOString().slice(0,10)}.json`; a.click();
            URL.revokeObjectURL(url);
          }}>Export JSON</button>
          <label className="btn btn-ghost btn-sm" style={{ fontSize: 11, cursor: 'pointer', margin: 0 }}>
            Import JSON
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  const imported = JSON.parse(ev.target.result);
                  if (typeof imported === 'object' && imported !== null) {
                    setSettings({ ...settings, ...imported });
                    alert('Settings imported. Review and click Save.');
                  } else { alert('Invalid file.'); }
                } catch { alert('Failed to parse JSON.'); }
              };
              reader.readAsText(file);
              e.target.value = '';
            }} />
          </label>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
