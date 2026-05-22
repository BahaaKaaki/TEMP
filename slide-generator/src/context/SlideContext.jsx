import { createContext, useContext, useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateSlideSummary, extractTitleFromHTML, setApiMaxConcurrent } from '../services/aiService';
import {
  hydrateSlidesFromLocalStorage,
  prepareSlidesForLocalStorage,
  slideHtmlHasFrameImagePlaceholder,
} from '../services/slideFrameImageStorage.js';
import { DEFAULT_THEME } from '../utils/themeUtils';
import { getClientDesignProfile, getClientProfileTheme } from '../utils/clientDesignProfiles';
import { normalizeSlideTypographyHTML, scopeCSS, unscopeCSS } from '../utils/cssScoping';
import { generateSlideId } from '../utils/slideIds';
// Import full CSS as raw string so it's available in state for AI and exports
import SLIDES_CSS from '../styles/slides.css?raw';
const SlideContext = createContext(null);

// Default shared CSS - contains the full slide theme CSS
// This is the single source of truth for all slide styling
const DEFAULT_SHARED_CSS = SLIDES_CSS;

// Model assignments are code-managed (always sourced from initialState, never
// from localStorage) so model changes no longer require a version bump.
// Reserve SETTINGS_VERSION for structural migrations only (new fields, format changes).
const SETTINGS_VERSION = 14;

// Initial state
const initialState = {
  slides: [],
  sharedCSS: DEFAULT_SHARED_CSS,
  activeSlideId: null,
  selectedSlideIds: [],
  deckName: 'Untitled Deck',
  deckGeneration: 0,
  theme: DEFAULT_THEME, // Theme config: colors, fonts -- resolved to CSS vars at render time
  imageVibe: 'default', // Vibe for image-based slides (persisted across reloads)
  darkMode: false, // Independent dark mode toggle (applies to all slides)
  deckVersions: [], // Array of { id, name, timestamp, slides, sharedCSS }
  customTemplates: [], // Array of { id, title, type, description, category, html, thumbnail, createdAt }
  deletedSystemTemplates: [], // Array of system template IDs that have been "deleted"
  flows: [], // Array of { id, name, description, overallGuidance, sections: [...] }
  modifiedSystemTemplates: {}, // Map of systemTemplateId -> modified template data
  // Storyline and agent workflow
  storyline: [], // Array of { id, title, description, keyMessage, contentInventory?, slideId?, order }
  storylineStatus: 'none', // 'none' | 'generated' | 'approved' | 'populated'
  skeletonMode: false, // Whether deck is in skeleton review mode
  // UI state for AI router context highlighting
  highlightedSlideIndices: [], // Array of slide indices to highlight as context
  // Consulting skills catalogue fetched from /api/skills at boot.
  // Metadata only (id, name, description, category, order); bodies stay server-side.
  availableSkills: [],
  settings: {
    // Provider registry: PwC Shared Services routed through backend proxy
    providers: [
      {
        id: 'pwc',
        name: 'PwC Shared Services',
        apiUrl: '/api/ai/chat',
        apiKey: 'server-managed',
        models: [
          'bedrock.anthropic.claude-opus-4-7',
          'bedrock.anthropic.claude-sonnet-4-6',
          'openai.gpt-5.5',
          'openai.gpt-5.4',
          'openai.gpt-5.4-mini',
          'openai.gpt-5.4-nano',
          'openai.gpt-5.4-pro',
          'vertex_ai.gemini-3.1-pro-preview',
          'vertex_ai.gemini-3.5-flash',
          'vertex_ai.gemini-3-pro-image-preview',
          'vertex_ai.gemini-3.1-flash-image-preview',
          'openai.gpt-image-1.5',
          'openai.eu.gpt-image-1.5',
          'openai.global.gpt-image-2',
          'openai.global.gpt-image-1.5',
          'vertex_ai.anthropic.claude-opus-4-7',
          'azure.gpt-5.5',
          'azure.gpt-5.5-2026-04-24',
          'azure.gpt-4.1',
        ],
        azurePrefix: false,
        authType: 'server',
        alternativeEndpoints: [
          { label: 'responses', url: '/api/ai/responses' },
        ],
      },
    ],
    // ── Unified chat: speed mode ──
    speedMode: 'premium',        // 'fast' | 'premium' — user-selectable generation tier
    // Model selections — format: "providerId:modelName"
    model: 'pwc:bedrock.anthropic.claude-opus-4-7',          // Premium slide generation (Claude Opus 4.7 on Bedrock)
    fastModel: 'pwc:vertex_ai.gemini-3.5-flash', // "Fast" generation (Fast speed mode)
    classifierModel: 'pwc:openai.gpt-5.4-mini',             // Tier 1 quick classifier (always fast)
    // Router / planner
    routerModel: 'pwc:openai.gpt-5.5',                      // Tier 2 full planner
    routerReasoningEffort: 'low',
    routerMaxTokens: 65536,
    routerSearchMode: 'auto', // 'auto' | 'always' | 'off' -- auto gates search on evidence need
    routerSearchEnabled: false,
    // Legacy chatbot-router fields (kept for backward compat, mirrors routerModel)
    chatRouterModel: 'pwc:openai.gpt-5.5',
    chatRouterReasoningEffort: 'low',
    chatRouterMaxTokens: 65536,
    chatRouterSearchMode: 'auto',
    chatRouterSearchEnabled: true,
    deepAnalysisModel: '',
    deepAnalysisReasoningEffort: 'medium',
    temperature: 0.1,
    maxTokens: 65536,
    reasoningEffort: 'low',
    verbosity: '',
    // PPTX Export settings
    pptxModel: 'pwc:bedrock.anthropic.claude-opus-4-7',
    pptxSystemPrompt: '',
    pptxCodeExample: '',
    pptxBatchSize: 10, // Number of slides to process per API call
    pptxParallelBatches: 5, // Number of batches to process in parallel (concurrent API calls)
    pptxGenerateOnCreate: false, // Disabled: PPTX code is generated only on explicit export.
    // AI Chatbot settings
    editAllBatchSize: 3, // Number of slides to process per batch in Edit All mode
    // Agent workflow settings
    agentBatchSize: 3,
    showAgentSteps: true,
    showApprovalDebugInfo: true,
    agentManagerName: 'Edwin',
    agentMinBudget: 4,
    agentMaxBudget: 5,
    agentRichResearch: true,
    // Consulting skill selected from the AI Assistant dropdown. `null` means
    // no skill is active. When set, the router call (and only the router call)
    // injects the corresponding markdown as its system prompt.
    selectedSkillId: null,
    slideStylePreference: 'freestyle', // 'auto' | 'templates' | 'freestyle'
    // ── Work level (prompt-driven output scaling) ──
    // low = concise/minimal, medium = balanced, high = detailed, very_high = maximum depth
    workLevelSlide: 'medium',
    workLevelAgent: 'medium',
    workLevelReport: 'medium',
    reportModel: 'pwc:bedrock.anthropic.claude-opus-4-7',
    reportReasoningEffort: 'low',
    reportMaxTokens: 128000,
    reportSearchEnabled: false,
    reportFormat: 'json',
    reportSingleCall: false,
    reportSkipCompilation: false,
    imageModel: 'pwc:openai.gpt-image-1.5',
    visualUpliftEnabled: false,
    visualUpliftIncludeTheme: true,
    visualUpliftIncludeVibe: true,
    enableAgenticMode: false,
    freestyleSelfCorrection: false,
    // Web Search via backend proxy
    searchEnabled: true,
    searchEndpoint: '/api/ai/responses',
    searchApiKey: 'server-managed',
    searchModel: 'openai.gpt-5.4-mini',
    evidenceSearchModel: 'openai.gpt-5.4-mini',
    searchContextSize: 'high',
    searchMaxTokens: 32000,
    searchAuthHeader: 'api-key',
    searchIncludeSources: false,
    // ── Naming conventions ──
    reportNomenclaturePattern: 'yyyymmdd_S&_{name}_Report_V{version}', // Report file naming pattern
    // ── Truncation / richness limits ──
    // These control how much data flows through each pipeline stage
    limitSearchCharsBeforeSynthesis: 120000,
    limitSearchCharsFallback: 400000,
    limitSynthesisTokens: 40960,
    limitKnowledgeSummaryChars: 80000,
    limitKnowledgeSummaryInsights: 5,
    limitKnowledgeCompileChars: 1200000,
    limitKnowledgeCompileCharsStd: 800000,
    limitCompilerTokensPerSlide: 200000,
    limitCompilerTokensMin: 60000,
    limitResearchContextChars: 200000,
    limitKnowledgeStorageChars: 200000,
    limitSlideInstructionItems: 5,
    limitFallbackKnowledgeItems: 12,
    // ── Per-role model overrides ──
    // Each role can override: model, maxTokens, reasoningEffort, temperature, searchEnabled
    // Empty string = inherit from parent (agent/report defaults)
    roleSettings: {
      managerScope:          { model: '', maxTokens: '65536', reasoningEffort: '', temperature: '', searchEnabled: 'true' },
      managerPlanning:       { model: '', maxTokens: '65536', reasoningEffort: '', temperature: '', searchEnabled: 'true' },
      consultantAnalyzing:   { model: '', maxTokens: '65536', reasoningEffort: '', temperature: '', searchEnabled: 'true' },
      consultantResearching: { model: '', maxTokens: '65536', reasoningEffort: '', temperature: '', searchEnabled: 'true' },
      managerCompiling:      { model: '', maxTokens: '128000', reasoningEffort: '', temperature: '', searchEnabled: 'true' },
      managerReviewing:      { model: '', maxTokens: '65536', reasoningEffort: '', temperature: '', searchEnabled: 'true' },
      routerAgent:           { model: '', maxTokens: '', reasoningEffort: '', temperature: '', searchEnabled: '' },
      routerChatbot:         { model: '', maxTokens: '', reasoningEffort: '', temperature: '', searchEnabled: '' },
      slideCreatorAgent:     { model: '', maxTokens: '', reasoningEffort: 'low', temperature: '', searchEnabled: '' },
      slideCreatorChatbot:   { model: '', maxTokens: '', reasoningEffort: 'none', temperature: '', searchEnabled: true },
      templateSwitcher:      { model: '', maxTokens: '', reasoningEffort: '', temperature: '' },
      pptxGenerator:         { model: '', maxTokens: '65536', reasoningEffort: '', temperature: '' },
      quickEdit:             { model: '', maxTokens: '8192', reasoningEffort: '', temperature: '' },
      reportGenerator:       { model: '', maxTokens: '', reasoningEffort: '', temperature: '' },
    },
    // Router/Smart Action settings
    routerMaxSlidesPerPlan: 30, // Max slides router can output in one plan
    parallelSlideGeneration: 3, // Legacy — kept for backward compat
    slideCreationBatchSize: 3, // Number of slides created per API call (1 = one-by-one, 3 = batch of 3)
    apiMaxConcurrent: 5, // Max simultaneous API calls (caps all paths: router, slides, agent, etc.)
    // Freestyle prompt section overrides (empty = use code defaults from md files)
    freestylePreset: 'default',
    freestyleShell: '',
    freestyleTheme: '',
    freestyleVibe: '',
    freestyleWriting: '',
    promptOverrides: {},
    // User preferences -- persistent free-text guidance injected into all LLM prompts
    userPreferences: '',
    clientDesignProfileId: 'strategy',
    clientProfileVersion: 'default',
    // Branding
    footerBranding: 'Strategy&', // Footer left text (firm name | topic). E.g., "Strategy&", "PwC | Digital Transformation"
    _settingsVersion: SETTINGS_VERSION,
  },
};

// Load from localStorage
function loadState() {
  try {
    const saved = localStorage.getItem('slideGeneratorState');
    console.log('[SlideContext] Loading state from localStorage', {
      hasData: !!saved,
      dataSize: saved?.length || 0,
    });
    if (saved) {
      const parsed = JSON.parse(saved);
      const prevSettingsVersion = parsed.settings?._settingsVersion ?? 0;
      console.log('[SlideContext] Parsed state:', {
        deckName: parsed.deckName,
        slideCount: parsed.slides?.length || 0,
        versionsCount: parsed.deckVersions?.length || 0,
      });

      // Migrate providers from old object format to new array format
      let mergedProviders = parsed.settings?.providers;
      if (mergedProviders && !Array.isArray(mergedProviders)) {
        // Old format: { openai: {apiKey, apiEndpoint}, gemini: {...}, ... }
        const oldP = mergedProviders;
        mergedProviders = initialState.settings.providers.map(p => {
          const oldKey = p.id === 'anthropic' ? 'claude' : p.id;
          const old = oldP[oldKey];
          if (old) {
            return { ...p, apiKey: old.apiKey || p.apiKey, apiUrl: old.apiEndpoint || old.apiUrl || p.apiUrl };
          }
          return p;
        });
      } else if (!mergedProviders) {
        mergedProviders = initialState.settings.providers;
      }

      // Ensure saved providers include all models from initialState (new models added in code updates)
      if (Array.isArray(mergedProviders)) {
        const initialProviders = initialState.settings.providers;
        mergedProviders = mergedProviders.map(savedP => {
          const initP = initialProviders.find(ip => ip.id === savedP.id);
          if (initP) {
            const mergedModels = [...new Set([...(savedP.models || []), ...(initP.models || [])])];
            return { ...savedP, models: mergedModels };
          }
          return savedP;
        });
        // Add any entirely new providers from initialState
        for (const initP of initialProviders) {
          if (!mergedProviders.find(p => p.id === initP.id)) {
            mergedProviders.push(initP);
          }
        }
      }

      const legacyKey = parsed.settings?.apiKey;
      if (legacyKey) {
        const currentModel = parsed.settings?.model || 'gpt-4o';
        const targetId = currentModel.includes('gemini') ? 'gemini' : currentModel.includes('claude') ? 'anthropic' : 'openai';
        const target = mergedProviders.find(p => p.id === targetId);
        if (target && !target.apiKey) {
          target.apiKey = legacyKey;
        }
      }

      // MIGRATION: If sharedCSS is the old placeholder or empty, replace with full CSS
      // The old placeholder started with "/* Custom CSS" and was ~200 chars
      // The new full CSS is 2700+ lines from slides.css
      let migratedSharedCSS = parsed.sharedCSS;
      const isOldPlaceholder = !parsed.sharedCSS ||
        parsed.sharedCSS.length < 1000 ||
        parsed.sharedCSS.startsWith('/* Custom CSS');

      if (isOldPlaceholder) {
        console.log('[SlideContext] Migrating sharedCSS to full slides.css');
        migratedSharedCSS = DEFAULT_SHARED_CSS;
      }

      // MIGRATION: Fix slides with instruction-based titles (e.g., "Create a...")
      // This is a ONE-TIME migration - only runs when bad titles are detected
      const existingSlideIds = new Set((parsed.slides || []).map(s => s.id).filter(Boolean));
      let migratedSlides = (parsed.slides || []).map(s => {
        if (s.id) return s;
        const id = generateSlideId(existingSlideIds);
        existingSlideIds.add(id);
        return { ...s, id };
      });
      let migratedStoryline = parsed.storyline || [];

      const hasBadTitles = migratedSlides.some(s =>
        s.title?.toLowerCase().startsWith('create ') ||
        s.title?.toLowerCase().startsWith('add ') ||
        s.title?.includes('...')
      );

      if (hasBadTitles) {
        console.log('[SlideContext] One-time migration: fixing instruction-based slide titles');
        const titleUpdates = {}; // Map slideId -> newTitle

        migratedSlides = migratedSlides.map((slide) => {
          const titleLooksLikeInstruction =
            slide.title?.toLowerCase().startsWith('create ') ||
            slide.title?.toLowerCase().startsWith('add ') ||
            slide.title?.includes('...');

          if (titleLooksLikeInstruction && slide.html) {
            const extractedTitle = extractTitleFromHTML(slide.html);
            if (extractedTitle) {
              titleUpdates[slide.id] = extractedTitle;
              return { ...slide, title: extractedTitle };
            }
          }
          return slide;
        });

        // Also update storyline to match (part of migration, not ongoing sync)
        if (Object.keys(titleUpdates).length > 0) {
          migratedStoryline = migratedStoryline.map(point => {
            const slide = migratedSlides.find(s => s.storyPointId === point.id || s.id === point.slideId);
            if (slide && titleUpdates[slide.id]) {
              return { ...point, title: titleUpdates[slide.id] };
            }
            return point;
          });
        }
      }

      // MIGRATION v10 -> v11: freestyleGuide -> 3 section fields
      if (parsed.settings?.freestyleGuide && parsed.settings.freestyleGuide.trim()) {
        const legacy = parsed.settings.freestyleGuide;
        if (!parsed.settings.freestyleShell) parsed.settings.freestyleShell = legacy;
        if (!parsed.settings.freestyleTheme) parsed.settings.freestyleTheme = '';
        if (!parsed.settings.freestyleWriting) parsed.settings.freestyleWriting = '';
        delete parsed.settings.freestyleGuide;
        console.log('[SlideContext] Migrated freestyleGuide to freestyleShell (v10 -> v11)');
      }

      // MIGRATION v11 -> v12: add freestyleVibe field
      if (parsed.settings && !('freestyleVibe' in parsed.settings)) {
        parsed.settings.freestyleVibe = '';
        console.log('[SlideContext] Added freestyleVibe field (v11 -> v12)');
      }

      // MIGRATION v12 -> v13: skills simplified to single-select.
      //   - Legacy `selectedSkillIds: string[]` collapses to `selectedSkillId: string | null`.
      //   - Legacy `agentUseSkills` toggle is removed (router always respects the selection).
      if (parsed.settings) {
        if (!('selectedSkillId' in parsed.settings)) {
          const legacy = parsed.settings.selectedSkillIds;
          if (Array.isArray(legacy) && legacy.length > 0 && typeof legacy[0] === 'string') {
            parsed.settings.selectedSkillId = legacy[0];
            console.log('[SlideContext] Migrated selectedSkillIds[0] -> selectedSkillId (v12 -> v13):', legacy[0]);
          } else {
            parsed.settings.selectedSkillId = null;
          }
        }
        if ('selectedSkillIds' in parsed.settings) {
          delete parsed.settings.selectedSkillIds;
        }
        if ('agentUseSkills' in parsed.settings) {
          delete parsed.settings.agentUseSkills;
        }
      }

      // Model assignments are CODE-MANAGED: always sourced from initialState,
      // never read back from localStorage. Change a default in initialState ->
      // all users pick it up on next page load. No version bump needed.
      // Includes evidenceSearchModel so per-step webSearch() uses the shipped
      // default (e.g. gpt-5.4-mini) even if an older build stored gpt-5.5 in localStorage.
      // User-controlled preferences (speedMode, batch sizes, etc.)
      // still persist normally via the ...parsed.settings spread.
      const loadedState = {
        ...initialState,
        ...parsed,
        theme: parsed.theme || DEFAULT_THEME,
        slides: migratedSlides,
        storyline: migratedStoryline,
        flows: parsed.flows || [],
        sharedCSS: migratedSharedCSS,
        settings: {
          ...initialState.settings,
          ...parsed.settings,
          providers: mergedProviders,
          _settingsVersion: SETTINGS_VERSION,
          // Code-managed model assignments — these always come from code,
          // so deploying new defaults is instant for all users.
          model: initialState.settings.model,
          fastModel: initialState.settings.fastModel,
          classifierModel: initialState.settings.classifierModel,
          routerModel: initialState.settings.routerModel,
          chatRouterModel: initialState.settings.chatRouterModel,
          deepAnalysisModel: initialState.settings.deepAnalysisModel,
          pptxModel: initialState.settings.pptxModel,
          reportModel: initialState.settings.reportModel,
          evidenceSearchModel: initialState.settings.evidenceSearchModel,
          imageModel: initialState.settings.imageModel,
          // Skill selection is one-shot: it clears after a successful
          // generation and also on every app load, so a refresh never
          // silently reuses a previously picked playbook.
          selectedSkillId: null,
        },
      };
      console.log('[SlideContext] Loaded (models are code-managed):', {
        model: loadedState.settings.model,
        fastModel: loadedState.settings.fastModel,
        classifierModel: loadedState.settings.classifierModel,
        routerModel: loadedState.settings.routerModel,
        pptxModel: loadedState.settings.pptxModel,
        reportModel: loadedState.settings.reportModel,
        evidenceSearchModel: loadedState.settings.evidenceSearchModel,
        imageModel: loadedState.settings.imageModel,
        speedMode: loadedState.settings.speedMode,
      });
      // Legacy labels from older builds
      if (loadedState.settings.speedMode === 'thinking' || loadedState.settings.speedMode === 'quality') {
        loadedState.settings.speedMode = 'premium';
      }
      // One-time rollout: v10 sets default tier to Premium for everyone who still had v9 or older (typically Fast)
      if (prevSettingsVersion < 10) {
        loadedState.settings.speedMode = 'premium';
      }
      if (loadedState.settings.clientDesignProfileId && loadedState.settings.clientDesignProfileId !== 'strategy') {
        const activeProfile = getClientDesignProfile(loadedState.settings.clientDesignProfileId);
        loadedState.theme = activeProfile.theme;
        loadedState.settings.clientProfileVersion = activeProfile.status || String(activeProfile.schemaVersion || '');
        if (activeProfile.id === 'stc' && loadedState.settings.footerBranding === 'stc') {
          loadedState.settings.footerBranding = '';
        }
      }
      return loadedState;
    }
  } catch (e) {
    console.error('[SlideContext] Failed to load state:', e);
  }
  console.log('[SlideContext] Using initial state (no saved data or load failed)');
  return initialState;
}

// Action types
const ACTIONS = {
  ADD_SLIDE: 'ADD_SLIDE',
  INSERT_SLIDE_AT: 'INSERT_SLIDE_AT',
  UPDATE_SLIDE: 'UPDATE_SLIDE',
  HYDRATE_SLIDES: 'HYDRATE_SLIDES',
  DELETE_SLIDE: 'DELETE_SLIDE',
  REORDER_SLIDES: 'REORDER_SLIDES',
  REORDER_SLIDES_BY_ID: 'REORDER_SLIDES_BY_ID',
  MOVE_SLIDE: 'MOVE_SLIDE', // Combined reorder + parent change
  MOVE_SLIDES_BATCH: 'MOVE_SLIDES_BATCH', // Atomic multi-slide move (avoids stale closure in forEach)
  SET_ACTIVE_SLIDE: 'SET_ACTIVE_SLIDE',
  SET_SELECTED_SLIDES: 'SET_SELECTED_SLIDES',
  UPDATE_SHARED_CSS: 'UPDATE_SHARED_CSS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  IMPORT_SLIDES: 'IMPORT_SLIDES',
  CLEAR_ALL: 'CLEAR_ALL',
  // Deck versioning
  SET_DECK_NAME: 'SET_DECK_NAME',
  SAVE_VERSION: 'SAVE_VERSION',
  RESTORE_VERSION: 'RESTORE_VERSION',
  DELETE_VERSION: 'DELETE_VERSION',
  START_NEW_DECK: 'START_NEW_DECK',
  // Custom templates
  ADD_TEMPLATE: 'ADD_TEMPLATE',
  UPDATE_TEMPLATE: 'UPDATE_TEMPLATE',
  DELETE_TEMPLATE: 'DELETE_TEMPLATE',
  // System template modifications
  DELETE_SYSTEM_TEMPLATE: 'DELETE_SYSTEM_TEMPLATE',
  RESTORE_SYSTEM_TEMPLATE: 'RESTORE_SYSTEM_TEMPLATE',
  MODIFY_SYSTEM_TEMPLATE: 'MODIFY_SYSTEM_TEMPLATE',
  RESET_SYSTEM_TEMPLATE: 'RESET_SYSTEM_TEMPLATE',
  // Flows (reusable storyline templates)
  ADD_FLOW: 'ADD_FLOW',
  UPDATE_FLOW: 'UPDATE_FLOW',
  DELETE_FLOW: 'DELETE_FLOW',
  // Slide hierarchy
  SET_SLIDE_PARENT: 'SET_SLIDE_PARENT',
  // Slide comments
  ADD_COMMENT: 'ADD_COMMENT',
  ADDRESS_COMMENT: 'ADDRESS_COMMENT',
  UNADDRESS_COMMENT: 'UNADDRESS_COMMENT',
  ADDRESS_ALL_SLIDE_COMMENTS: 'ADDRESS_ALL_SLIDE_COMMENTS',
  DELETE_COMMENT: 'DELETE_COMMENT',
  // Storyline and skeleton
  SET_STORYLINE: 'SET_STORYLINE',
  SET_STORYLINE_STATUS: 'SET_STORYLINE_STATUS',
  UPDATE_STORYLINE_POINT: 'UPDATE_STORYLINE_POINT',
  CLEAR_STORYLINE: 'CLEAR_STORYLINE',
  SYNC_STORYLINE_FROM_SLIDES: 'SYNC_STORYLINE_FROM_SLIDES',
  SYNC_SLIDES_FROM_STORYLINE: 'SYNC_SLIDES_FROM_STORYLINE',
  SET_SKELETON_MODE: 'SET_SKELETON_MODE',
  APPROVE_SKELETON: 'APPROVE_SKELETON',
  APPROVE_ALL_SKELETONS: 'APPROVE_ALL_SKELETONS',
  // Theme system
  UPDATE_THEME: 'UPDATE_THEME',
  SET_IMAGE_VIBE: 'SET_IMAGE_VIBE',
  // Dark mode (independent toggle)
  SET_DARK_MODE: 'SET_DARK_MODE',
  TOGGLE_DARK_MODE: 'TOGGLE_DARK_MODE',
  // UI state
  SET_HIGHLIGHTED_SLIDES: 'SET_HIGHLIGHTED_SLIDES',
  // Consulting skills catalogue
  SET_AVAILABLE_SKILLS: 'SET_AVAILABLE_SKILLS',
  // Title management
  REGENERATE_SLIDE_TITLES: 'REGENERATE_SLIDE_TITLES',
  // Undo/Redo
  UNDO: 'UNDO',
  REDO: 'REDO',
  RESTORE_SNAPSHOT: 'RESTORE_SNAPSHOT',
  // Storage cleanup
  CLEAR_HISTORY: 'CLEAR_HISTORY',
};

// Actions that should NOT trigger history (UI-only state changes)
const NON_UNDOABLE_ACTIONS = new Set([
  ACTIONS.SET_ACTIVE_SLIDE,
  ACTIONS.SET_SELECTED_SLIDES,
  ACTIONS.SET_HIGHLIGHTED_SLIDES,
  ACTIONS.SET_AVAILABLE_SKILLS,
  ACTIONS.UPDATE_SETTINGS,
  ACTIONS.UNDO,
  ACTIONS.REDO,
  ACTIONS.RESTORE_SNAPSHOT,
  ACTIONS.CLEAR_HISTORY,
]);

// Maximum history size to prevent memory issues
const MAX_HISTORY_SIZE = 50;

// Extract only the undoable parts of state (exclude settings and UI state)
function getUndoableSnapshot(state) {
  return {
    slides: state.slides,
    sharedCSS: state.sharedCSS,
    theme: state.theme,
    deckName: state.deckName,
    darkMode: state.darkMode,
    customTemplates: state.customTemplates,
    deletedSystemTemplates: state.deletedSystemTemplates,
    modifiedSystemTemplates: state.modifiedSystemTemplates,
    storyline: state.storyline,
    storylineStatus: state.storylineStatus,
    skeletonMode: state.skeletonMode,
    activeSlideId: state.activeSlideId,
  };
}

// Check if two snapshots are different (for debouncing rapid changes)
function snapshotsAreDifferent(a, b) {
  if (!a || !b) return true;
  // Quick check on slides length and deck name
  if (a.slides?.length !== b.slides?.length) return true;
  if (a.deckName !== b.deckName) return true;
  if (a.sharedCSS !== b.sharedCSS) return true;
  // Deep check on slides content
  return JSON.stringify(a.slides) !== JSON.stringify(b.slides);
}

// Pull the section-tracker labels out of a raw HTML string. Imported slides
// carry the tracker via <a data-section="..." data-subsection="..."> anchors;
// we honor the active tab first and fall back to the first anchor that has
// either attribute so decks without the .active class still round-trip.
// Returns { sectionLabel, subSectionLabel } with null where the attribute
// is absent. Safe on SSR/non-browser environments: returns {nulls}.
function extractSectionLabelsFromHTML(html) {
  const empty = { sectionLabel: null, subSectionLabel: null };
  if (!html || typeof html !== 'string') return empty;
  if (typeof DOMParser === 'undefined') return empty;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) return empty;
    const scope = doc.querySelector('[class*="section-tracker"], [data-section-tracker]') || doc;
    const active = scope.querySelector('[data-section].active, [data-subsection].active');
    const anchor = active || scope.querySelector('[data-section], [data-subsection]');
    if (!anchor) return empty;
    const section = anchor.getAttribute('data-section');
    const subsection = anchor.getAttribute('data-subsection');
    return {
      sectionLabel: section ? section.trim() || null : null,
      subSectionLabel: subsection ? subsection.trim() || null : null,
    };
  } catch {
    return empty;
  }
}

// Reducer
function slideReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_SLIDE: {
      const html = normalizeSlideTypographyHTML(action.payload.html || getDefaultSlideHTML());
      const type = action.payload.type || 'custom';
      const title = action.payload.title || 'Untitled Slide';
      const slideId = generateSlideId(state.slides.map(s => s.id));
      const storyPointId = action.payload.storyPointId || `sp-${slideId}`;

      // Detect layout type from HTML for agent awareness
      const layoutType = action.payload.layoutType || detectLayoutType(html);

      const newSlide = {
        id: slideId,
        title,
        type,
        html,
        layoutType, // Layout type for agent context (cards, bullets, timeline, kpi, grid, etc.)
        customCSS: scopeCSS(action.payload.customCSS || '', slideId),
        pptxExportCode: action.payload.pptxExportCode || '',
        pptxRendererCode: action.payload.pptxRendererCode || null, // JavaScript code for PPTX export
        summary: action.payload.summary || generateSlideSummary(html, type, title),
        sources: Array.isArray(action.payload.sources) ? action.payload.sources : [],
        comments: [], // Array of { id, text, createdAt, addressed, addressedAt, addressedBy }
        // Hierarchy and storyline
        parentId: action.payload.parentId || null, // For slide hierarchy
        storyPointId: storyPointId, // Link to storyline point
        isSkeleton: action.payload.isSkeleton || false, // Is this a skeleton slide (header/title only)
        skeletonApproved: action.payload.skeletonApproved || false, // Has skeleton layout been approved
        templateId: action.payload.templateId || null, // Template used for this slide
        sectionLabel: action.payload.sectionLabel || null, // Section tracker label (e.g. "1. Strategy")
        subSectionLabel: action.payload.subSectionLabel || null, // Sub-section tracker (e.g. "Phase 1: Discovery")
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Determine insert position: after specified slide, after active slide, or at end
      const afterSlideId = action.payload.afterSlideId || state.activeSlideId;
      const afterIndex = afterSlideId ? state.slides.findIndex(s => s.id === afterSlideId) : -1;
      const insertIndex = afterIndex >= 0 ? afterIndex + 1 : state.slides.length;

      // Create new slides array with slide inserted at correct position
      const newSlides = [
        ...state.slides.slice(0, insertIndex),
        newSlide,
        ...state.slides.slice(insertIndex),
      ];

      // Auto-create storyline point if not linking to existing one
      let newStoryline = state.storyline;
      if (!action.payload.skipStorylineSync) {
        const existingPoint = state.storyline.find(p => p.id === storyPointId);
        if (!existingPoint) {
          const newPoint = {
            id: storyPointId,
            title: title,
            description: action.payload.summary || '',
            keyMessage: '',
            slideId: slideId,
            parentId: action.payload.parentId ?
              state.slides.find(s => s.id === action.payload.parentId)?.storyPointId || null : null,
            templateId: action.payload.templateId || null,
            order: insertIndex,
          };
          // Insert storyline point at the same position
          const storylineArr = [...state.storyline];
          storylineArr.splice(insertIndex, 0, newPoint);
          newStoryline = storylineArr.map((p, i) => ({ ...p, order: i }));
        } else {
          // Update existing point to link to this slide
          newStoryline = state.storyline.map(p =>
            p.id === storyPointId ? { ...p, slideId: slideId } : p
          );
        }
      }

      return {
        ...state,
        slides: newSlides,
        storyline: newStoryline,
        activeSlideId: newSlide.id,
        selectedSlideIds: [newSlide.id],
      };
    }

    case ACTIONS.INSERT_SLIDE_AT: {
      // Insert a slide at a specific position (0 = first, -1 = last)
      const { position, skipActiveChange, ...slideData } = action.payload;
      const html = normalizeSlideTypographyHTML(slideData.html || getDefaultSlideHTML());
      const type = slideData.type || 'custom';
      const title = slideData.title || 'Untitled Slide';
      const slideId = generateSlideId(state.slides.map(s => s.id));
      const storyPointId = slideData.storyPointId || `sp-${slideId}`;

      const newSlide = {
        id: slideId,
        title,
        type,
        html,
        customCSS: scopeCSS(slideData.customCSS || '', slideId),
        pptxExportCode: slideData.pptxExportCode || '',
        pptxRendererCode: slideData.pptxRendererCode || null, // JavaScript code for PPTX export
        summary: slideData.summary || generateSlideSummary(html, type, title),
        sources: Array.isArray(slideData.sources) ? slideData.sources : [],
        comments: [],
        parentId: slideData.parentId || null,
        storyPointId: storyPointId,
        isSkeleton: slideData.isSkeleton || false,
        skeletonApproved: slideData.skeletonApproved || false,
        templateId: slideData.templateId || null,
        sectionLabel: slideData.sectionLabel || null,
        subSectionLabel: slideData.subSectionLabel || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let insertIndex;
      if (position === -1 || position >= state.slides.length) {
        insertIndex = state.slides.length;
      } else if (position <= 0) {
        insertIndex = 0;
      } else {
        insertIndex = position;
      }

      const newSlides = [
        ...state.slides.slice(0, insertIndex),
        newSlide,
        ...state.slides.slice(insertIndex),
      ];

      // Auto-create storyline point
      let newStoryline = state.storyline;
      if (!slideData.skipStorylineSync) {
        const existingPoint = state.storyline.find(p => p.id === storyPointId);
        if (!existingPoint) {
          const newPoint = {
            id: storyPointId,
            title: title,
            description: slideData.summary || '',
            keyMessage: '',
            slideId: slideId,
            parentId: slideData.parentId ?
              state.slides.find(s => s.id === slideData.parentId)?.storyPointId || null : null,
            templateId: slideData.templateId || null,
            order: insertIndex,
          };
          // Insert at the right position in storyline too
          const storylineArr = [...state.storyline];
          storylineArr.splice(insertIndex, 0, newPoint);
          newStoryline = storylineArr.map((p, i) => ({ ...p, order: i }));
        }
      }

      return {
        ...state,
        slides: newSlides,
        storyline: newStoryline,
        activeSlideId: skipActiveChange ? state.activeSlideId : newSlide.id,
        ...(skipActiveChange ? {} : { selectedSlideIds: [newSlide.id] }),
      };
    }

    case ACTIONS.UPDATE_SLIDE: {
      const slideToUpdate = state.slides.find(s => s.id === action.payload.id);
      const updates = action.payload.updates;
      const normalizedUpdates = updates.html !== undefined
        ? { ...updates, html: normalizeSlideTypographyHTML(updates.html) }
        : updates;
      const newTitle = updates.title || slideToUpdate?.title;

      // Sync title to storyline if title changed
      let newStoryline = state.storyline;
      if (updates.title && slideToUpdate?.storyPointId) {
        newStoryline = state.storyline.map(p =>
          p.id === slideToUpdate.storyPointId ? { ...p, title: updates.title } : p
        );
      }

      return {
        ...state,
        slides: state.slides.map((slide) => {
          if (slide.id !== action.payload.id) return slide;

          const newHtml = normalizedUpdates.html || slide.html;
          const newType = normalizedUpdates.type || slide.type;

          // Regenerate summary if HTML, type, or title changed
          const needsSummaryUpdate = normalizedUpdates.html || normalizedUpdates.type || normalizedUpdates.title;

          // Re-detect layoutType if HTML changed
          const newLayoutType = normalizedUpdates.html ? detectLayoutType(newHtml) : slide.layoutType;

          // Clear stale PPTX export code when HTML changes (unless explicitly provided in updates)
          // This ensures the next export regenerates from the new HTML instead of using stale cached code
          const pptxRendererCode = normalizedUpdates.html && !('pptxRendererCode' in normalizedUpdates)
            ? null
            : (normalizedUpdates.pptxRendererCode !== undefined ? normalizedUpdates.pptxRendererCode : slide.pptxRendererCode);
          const pptxCode = normalizedUpdates.html && !('pptxCode' in normalizedUpdates)
            ? null
            : (normalizedUpdates.pptxCode !== undefined ? normalizedUpdates.pptxCode : slide.pptxCode);

          // Always normalize updated CSS through unscope -> scope. This handles
          // template CSS and partially scoped model CSS consistently.
          const scopedUpdates = normalizedUpdates.customCSS !== undefined && normalizedUpdates.customCSS
            ? { ...normalizedUpdates, customCSS: scopeCSS(unscopeCSS(normalizedUpdates.customCSS), slide.id) }
            : normalizedUpdates;

          return {
            ...slide,
            ...scopedUpdates,
            pptxRendererCode,
            pptxCode,
            layoutType: newLayoutType,
            summary: needsSummaryUpdate
              ? generateSlideSummary(newHtml, newType, newTitle)
              : slide.summary,
            updatedAt: new Date().toISOString(),
          };
        }),
        storyline: newStoryline,
      };
    }

    case ACTIONS.HYDRATE_SLIDES: {
      const hydrated = action.payload?.slides;
      if (!Array.isArray(hydrated) || hydrated.length === 0) return state;
      return { ...state, slides: hydrated };
    }

    case ACTIONS.DELETE_SLIDE: {
      const slideToDelete = state.slides.find(s => s.id === action.payload.id);
      const newSlides = state.slides.filter((s) => s.id !== action.payload.id);
      let newActiveId = state.activeSlideId;

      if (state.activeSlideId === action.payload.id) {
        const deletedIndex = state.slides.findIndex((s) => s.id === action.payload.id);
        newActiveId = newSlides[deletedIndex]?.id || newSlides[deletedIndex - 1]?.id || null;
      }

      // Also remove storyline point if linked (unless skipStorylineSync)
      let newStoryline = state.storyline;
      if (!action.payload.skipStorylineSync && slideToDelete?.storyPointId) {
        newStoryline = state.storyline.filter(p => p.id !== slideToDelete.storyPointId);
        // Re-assign orphaned children to parent's parent
        const deletedPointParentId = state.storyline.find(p => p.id === slideToDelete.storyPointId)?.parentId;
        newStoryline = newStoryline.map(p =>
          p.parentId === slideToDelete.storyPointId ? { ...p, parentId: deletedPointParentId || null } : p
        );
      }

      // Update children slides to have no parent
      const updatedSlides = newSlides.map(s =>
        s.parentId === action.payload.id ? { ...s, parentId: slideToDelete?.parentId || null } : s
      );

      return {
        ...state,
        slides: updatedSlides,
        storyline: newStoryline,
        activeSlideId: newActiveId,
        selectedSlideIds: newActiveId ? [newActiveId] : [],
      };
    }

    case ACTIONS.SET_SLIDE_PARENT: {
      const { slideId, parentId } = action.payload;
      const slide = state.slides.find(s => s.id === slideId);
      if (!slide) return state;

      // Update slide's parent
      const newSlides = state.slides.map(s =>
        s.id === slideId ? { ...s, parentId, updatedAt: new Date().toISOString() } : s
      );

      // Also update storyline point's parent
      let newStoryline = state.storyline;
      if (slide.storyPointId) {
        const parentStoryPointId = parentId ?
          state.slides.find(s => s.id === parentId)?.storyPointId || null : null;
        newStoryline = state.storyline.map(p =>
          p.id === slide.storyPointId ? { ...p, parentId: parentStoryPointId } : p
        );
      }

      return {
        ...state,
        slides: newSlides,
        storyline: newStoryline,
      };
    }

    case ACTIONS.REORDER_SLIDES: {
      const { fromIndex, toIndex } = action.payload;
      const newSlides = [...state.slides];
      const [removedSlide] = newSlides.splice(fromIndex, 1);
      newSlides.splice(toIndex, 0, removedSlide);

      // Also reorder storyline to match slide order
      let newStoryline = state.storyline;
      if (removedSlide.storyPointId) {
        // Find the storyline point for the moved slide
        const storyPointIdx = state.storyline.findIndex(p => p.id === removedSlide.storyPointId);
        if (storyPointIdx !== -1) {
          newStoryline = [...state.storyline];
          const [removedPoint] = newStoryline.splice(storyPointIdx, 1);
          // Calculate new position based on slide position
          const newPointIdx = Math.min(toIndex, newStoryline.length);
          newStoryline.splice(newPointIdx, 0, removedPoint);
          // Update order values
          newStoryline = newStoryline.map((p, idx) => ({ ...p, order: idx }));
        }
      }

      return {
        ...state,
        slides: newSlides,
        storyline: newStoryline,
      };
    }

    case ACTIONS.REORDER_SLIDES_BY_ID: {
      const { orderedIds } = action.payload;
      if (!Array.isArray(orderedIds) || orderedIds.length !== state.slides.length) return state;

      const currentIds = new Set(state.slides.map(s => s.id));
      const orderedIdSet = new Set(orderedIds);
      if (orderedIdSet.size !== state.slides.length) return state;
      if (!orderedIds.every(id => currentIds.has(id))) return state;

      const slideById = new Map(state.slides.map(slide => [slide.id, slide]));
      const newSlides = orderedIds.map(id => slideById.get(id));

      const storylineById = new Map(state.storyline.map(point => [point.id, point]));
      const orderedStoryline = [];
      const usedStoryPointIds = new Set();

      for (const slide of newSlides) {
        if (slide.storyPointId && storylineById.has(slide.storyPointId)) {
          const point = storylineById.get(slide.storyPointId);
          orderedStoryline.push(point);
          usedStoryPointIds.add(point.id);
        }
      }

      const remainingStoryline = state.storyline.filter(point => !usedStoryPointIds.has(point.id));
      const newStoryline = [...orderedStoryline, ...remainingStoryline].map((point, index) => ({
        ...point,
        order: index,
      }));

      return {
        ...state,
        slides: newSlides,
        storyline: newStoryline,
      };
    }

    case ACTIONS.MOVE_SLIDE: {
      // Combined operation: reorder + change parent atomically
      // This prevents race conditions from separate dispatches
      const { slideId, newParentId, targetIndex } = action.payload;

      // Find the slide to move
      const slideIndex = state.slides.findIndex(s => s.id === slideId);
      if (slideIndex === -1) return state;

      // Create new slides array with updated parentId
      let newSlides = state.slides.map(s =>
        s.id === slideId
          ? { ...s, parentId: newParentId, updatedAt: new Date().toISOString() }
          : s
      );

      // Now reorder
      const [movedSlide] = newSlides.splice(slideIndex, 1);

      // Calculate final index accounting for removal
      const finalIndex = slideIndex < targetIndex ? targetIndex - 1 : targetIndex;
      newSlides.splice(finalIndex, 0, movedSlide);

      // Update storyline if applicable
      let newStoryline = state.storyline;
      const slide = state.slides.find(s => s.id === slideId);
      if (slide?.storyPointId) {
        const parentStoryPointId = newParentId
          ? state.slides.find(s => s.id === newParentId)?.storyPointId || null
          : null;
        newStoryline = state.storyline.map(p =>
          p.id === slide.storyPointId ? { ...p, parentId: parentStoryPointId } : p
        );
      }

      return {
        ...state,
        slides: newSlides,
        storyline: newStoryline,
      };
    }

    case ACTIONS.MOVE_SLIDES_BATCH: {
      // Atomic multi-slide move: removes all slides in orderedIds from their current
      // positions, then inserts them at targetIndex (maintaining relative order).
      // This avoids the stale-closure bug where forEach + individual moveSlide dispatches
      // read outdated indices after each intermediate state update.
      const { orderedIds, newParentId, targetIndex } = action.payload;
      if (!orderedIds || orderedIds.length === 0) return state;

      const movingSet = new Set(orderedIds);
      const now = new Date().toISOString();

      // Separate: slides being moved vs. the rest (preserving order of the rest)
      const remaining = [];
      const moving = [];
      for (const s of state.slides) {
        if (movingSet.has(s.id)) {
          moving.push({ ...s, parentId: newParentId, updatedAt: now });
        } else {
          remaining.push(s);
        }
      }

      // Sort moving slides to match the requested order
      moving.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));

      // Calculate insertion point in the remaining array.
      // targetIndex was calculated against the original array, so adjust for
      // how many moving slides were before it.
      const movingIndicesInOriginal = orderedIds.map(id => state.slides.findIndex(s => s.id === id));
      const countBefore = movingIndicesInOriginal.filter(i => i < targetIndex).length;
      const adjustedTarget = Math.min(targetIndex - countBefore, remaining.length);

      // Insert all moving slides at the adjusted target
      const newSlides = [...remaining];
      newSlides.splice(adjustedTarget, 0, ...moving);

      return {
        ...state,
        slides: newSlides,
      };
    }

    case ACTIONS.SET_ACTIVE_SLIDE: {
      return {
        ...state,
        activeSlideId: action.payload.id,
      };
    }

    case ACTIONS.SET_SELECTED_SLIDES: {
      return {
        ...state,
        selectedSlideIds: action.payload.ids || [],
      };
    }

    case ACTIONS.UPDATE_SHARED_CSS: {
      return {
        ...state,
        sharedCSS: action.payload.css,
      };
    }

    case ACTIONS.UPDATE_SETTINGS: {
      const incoming = action.payload.settings || {};
      const prevProfileId = state.settings.clientDesignProfileId || 'strategy';
      const merged = { ...state.settings, ...incoming };
      const profileChanged = merged.clientDesignProfileId !== prevProfileId;
      const nextSettings = { ...merged };
      const activeProfile = profileChanged ? getClientDesignProfile(nextSettings.clientDesignProfileId) : null;
      if (activeProfile) {
        nextSettings.clientProfileVersion = activeProfile.status || String(activeProfile.schemaVersion || '');
        if (Object.prototype.hasOwnProperty.call(activeProfile, 'footerBranding')) {
          nextSettings.footerBranding = activeProfile.footerBranding ?? '';
        }
      }
      return {
        ...state,
        slides: profileChanged
          ? state.slides.map(slide => ({
            ...slide,
            pptxCode: null,
          }))
          : state.slides,
        settings: nextSettings,
        theme: profileChanged ? getClientProfileTheme(nextSettings.clientDesignProfileId) : state.theme,
      };
    }

    case ACTIONS.IMPORT_SLIDES: {
      const existingIds = new Set(state.slides.map(s => s.id).filter(Boolean));
      const importedSlides = action.payload.slides.map((slide) => {
        const html = normalizeSlideTypographyHTML(slide.html || '');
        const type = slide.type || 'custom';
        const title = slide.title || 'Imported Slide';
        const newId = generateSlideId(existingIds);
        existingIds.add(newId);
        // Prefer explicit JSON fields when the importer provides them; fall
        // back to parsing data-section / data-subsection from the HTML so
        // imports from raw HTML still populate the tracker.
        let sectionLabel = slide.sectionLabel ?? null;
        let subSectionLabel = slide.subSectionLabel ?? null;
        if (sectionLabel == null && subSectionLabel == null) {
          const parsed = extractSectionLabelsFromHTML(html);
          sectionLabel = parsed.sectionLabel;
          subSectionLabel = parsed.subSectionLabel;
        }
        return {
          id: newId,
          title,
          type,
          html,
          customCSS: scopeCSS(unscopeCSS(slide.customCSS || ''), newId),
          pptxExportCode: slide.pptxExportCode || '',
          summary: slide.summary || generateSlideSummary(html, type, title),
          sectionLabel,
          subSectionLabel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
      const firstImportedId = importedSlides[0]?.id;
      return {
        ...state,
        slides: [...state.slides, ...importedSlides],
        activeSlideId: firstImportedId || state.activeSlideId,
        selectedSlideIds: firstImportedId ? [firstImportedId] : state.selectedSlideIds,
      };
    }

    case ACTIONS.CLEAR_ALL: {
      return {
        ...initialState,
        settings: state.settings, // Keep settings
        theme: getClientProfileTheme(state.settings.clientDesignProfileId || 'strategy'),
        deckVersions: state.deckVersions, // Keep versions
        customTemplates: state.customTemplates, // Keep custom templates
        flows: state.flows || [], // Keep flows
      };
    }

    case ACTIONS.SET_DECK_NAME: {
      return {
        ...state,
        deckName: action.payload.name,
      };
    }

    case ACTIONS.SAVE_VERSION: {
      const newVersion = {
        id: uuidv4(),
        name: action.payload.name || `Version ${state.deckVersions.length + 1}`,
        timestamp: new Date().toISOString(),
        slides: JSON.parse(JSON.stringify(state.slides)), // Deep copy
        sharedCSS: state.sharedCSS,
        theme: state.theme,
        deckName: state.deckName,
      };
      return {
        ...state,
        deckVersions: [...state.deckVersions, newVersion],
      };
    }

    case ACTIONS.RESTORE_VERSION: {
      const version = state.deckVersions.find(v => v.id === action.payload.id);
      if (!version) return state;
      const firstId = version.slides[0]?.id || null;
      return {
        ...state,
        slides: JSON.parse(JSON.stringify(version.slides)),
        sharedCSS: version.sharedCSS,
        theme: version.theme || state.theme,
        deckName: version.deckName || state.deckName,
        activeSlideId: firstId,
        selectedSlideIds: firstId ? [firstId] : [],
      };
    }

    case ACTIONS.DELETE_VERSION: {
      return {
        ...state,
        deckVersions: state.deckVersions.filter(v => v.id !== action.payload.id),
      };
    }

    case ACTIONS.START_NEW_DECK: {
      // Optionally auto-save current deck as a version before clearing
      const autoSaveVersion = state.slides.length > 0 ? {
        id: uuidv4(),
        name: `${state.deckName} (auto-saved)`,
        timestamp: new Date().toISOString(),
        slides: JSON.parse(JSON.stringify(state.slides)),
        sharedCSS: state.sharedCSS,
        theme: state.theme,
        deckName: state.deckName,
      } : null;

      return {
        ...initialState,
        settings: state.settings,
        theme: getClientProfileTheme(state.settings.clientDesignProfileId || 'strategy'),
        deckVersions: autoSaveVersion
          ? [...state.deckVersions, autoSaveVersion]
          : state.deckVersions,
        customTemplates: state.customTemplates,
        flows: state.flows || [],
        deckName: action.payload?.name || 'Untitled Deck',
        deckGeneration: (state.deckGeneration || 0) + 1,
      };
    }

    case ACTIONS.ADD_TEMPLATE: {
      const newTemplate = {
        id: action.payload.id || `custom-${uuidv4()}`, // Use provided ID if exists
        title: action.payload.title || 'Custom Template',
        type: action.payload.type || 'custom',
        master: action.payload.master || 'standard',
        description: action.payload.description || '',
        category: action.payload.category || 'Custom',
        html: action.payload.html,
        pptxRendererCode: action.payload.pptxRendererCode || null,
        thumbnail: action.payload.thumbnail || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        ...state,
        customTemplates: [...state.customTemplates, newTemplate],
      };
    }

    case ACTIONS.UPDATE_TEMPLATE: {
      return {
        ...state,
        customTemplates: state.customTemplates.map((template) =>
          template.id === action.payload.id
            ? { ...template, ...action.payload.updates, updatedAt: new Date().toISOString() }
            : template
        ),
      };
    }

    case ACTIONS.DELETE_TEMPLATE: {
      return {
        ...state,
        customTemplates: state.customTemplates.filter((t) => t.id !== action.payload.id),
      };
    }

    case ACTIONS.DELETE_SYSTEM_TEMPLATE: {
      // Mark a system template as "deleted" (soft delete)
      const templateId = action.payload.id;
      if (state.deletedSystemTemplates.includes(templateId)) {
        return state; // Already deleted
      }
      return {
        ...state,
        deletedSystemTemplates: [...state.deletedSystemTemplates, templateId],
      };
    }

    case ACTIONS.RESTORE_SYSTEM_TEMPLATE: {
      // Restore a "deleted" system template
      const templateId = action.payload.id;
      return {
        ...state,
        deletedSystemTemplates: state.deletedSystemTemplates.filter((id) => id !== templateId),
        // Also remove any modifications if restoring to original
        modifiedSystemTemplates: Object.fromEntries(
          Object.entries(state.modifiedSystemTemplates || {}).filter(([id]) => id !== templateId)
        ),
      };
    }

    case ACTIONS.MODIFY_SYSTEM_TEMPLATE: {
      // Store a modified version of a system template
      const { id, updates } = action.payload;
      return {
        ...state,
        modifiedSystemTemplates: {
          ...state.modifiedSystemTemplates,
          [id]: {
            ...state.modifiedSystemTemplates?.[id],
            ...updates,
            originalId: id,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }

    case ACTIONS.RESET_SYSTEM_TEMPLATE: {
      // Reset a system template to its original state
      const templateId = action.payload.id;
      const newModified = { ...state.modifiedSystemTemplates };
      delete newModified[templateId];
      return {
        ...state,
        modifiedSystemTemplates: newModified,
      };
    }

    case ACTIONS.ADD_COMMENT: {
      const { slideId, text } = action.payload;
      return {
        ...state,
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          const newComment = {
            id: uuidv4(),
            text,
            createdAt: new Date().toISOString(),
            addressed: false,
            addressedAt: null,
            addressedBy: null,
          };
          return {
            ...slide,
            comments: [...(slide.comments || []), newComment],
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case ACTIONS.ADDRESS_COMMENT: {
      const { slideId, commentId, addressedBy } = action.payload;
      return {
        ...state,
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          return {
            ...slide,
            comments: (slide.comments || []).map((comment) => {
              if (comment.id !== commentId) return comment;
              return {
                ...comment,
                addressed: true,
                addressedAt: new Date().toISOString(),
                addressedBy: addressedBy || 'AI Agent',
              };
            }),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case ACTIONS.UNADDRESS_COMMENT: {
      const { slideId, commentId } = action.payload;
      return {
        ...state,
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          return {
            ...slide,
            comments: (slide.comments || []).map((comment) => {
              if (comment.id !== commentId) return comment;
              return {
                ...comment,
                addressed: false,
                addressedAt: null,
                addressedBy: null,
              };
            }),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case ACTIONS.ADDRESS_ALL_SLIDE_COMMENTS: {
      const { slideId, addressedBy } = action.payload;
      return {
        ...state,
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          return {
            ...slide,
            comments: (slide.comments || []).map((comment) => {
              if (comment.addressed) return comment;
              return {
                ...comment,
                addressed: true,
                addressedAt: new Date().toISOString(),
                addressedBy: addressedBy || 'Manual',
              };
            }),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case ACTIONS.DELETE_COMMENT: {
      const { slideId, commentId } = action.payload;
      return {
        ...state,
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          return {
            ...slide,
            comments: (slide.comments || []).filter((c) => c.id !== commentId),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case ACTIONS.SET_STORYLINE: {
      const storyline = action.payload.storyline.map((point, index) => ({
        id: point.id || uuidv4(),
        title: point.title || '',
        description: point.description || '',
        keyMessage: point.keyMessage || '',
        contentInventory: Array.isArray(point.contentInventory) ? point.contentInventory : [],
        templateId: point.templateId || null,
        parentId: point.parentId || null,
        slideId: point.slideId || null,
        pointType: point.pointType || 'insight',
        suggestedLayout: point.suggestedLayout || null,
        order: point.order ?? index,
      }));
      return {
        ...state,
        storyline,
        // Auto-set status to 'generated' if we're setting a non-empty storyline
        storylineStatus: storyline.length > 0 ? 'generated' : 'none',
      };
    }

    case ACTIONS.SET_STORYLINE_STATUS: {
      return {
        ...state,
        storylineStatus: action.payload.status,
      };
    }

    case ACTIONS.UPDATE_STORYLINE_POINT: {
      const { pointId, updates } = action.payload;
      return {
        ...state,
        storyline: state.storyline.map((point) =>
          point.id === pointId ? { ...point, ...updates } : point
        ),
      };
    }

    case ACTIONS.CLEAR_STORYLINE: {
      return {
        ...state,
        storyline: [],
        storylineStatus: 'none',
        skeletonMode: false,
      };
    }

    case ACTIONS.SYNC_STORYLINE_FROM_SLIDES: {
      // Rebuild storyline from current slides (slides = source of truth)
      const newStoryline = state.slides.map((slide, index) => {
        // Try to find existing storyline point for this slide
        const existingPoint = state.storyline.find(p =>
          p.id === slide.storyPointId || p.slideId === slide.id
        );

        return {
          id: slide.storyPointId || existingPoint?.id || `sp-${slide.id}`,
          title: slide.title || `Slide ${index + 1}`,
          description: existingPoint?.description || slide.summary || '',
          keyMessage: existingPoint?.keyMessage || '',
          suggestedLayout: existingPoint?.suggestedLayout || slide.type || 'content',
          slideId: slide.id,
          order: index,
          parentId: slide.parentId
            ? state.slides.find(s => s.id === slide.parentId)?.storyPointId || null
            : null,
        };
      });

      // Also update slides to have correct storyPointId
      const updatedSlides = state.slides.map((slide, index) => ({
        ...slide,
        storyPointId: newStoryline[index].id,
      }));

      return {
        ...state,
        slides: updatedSlides,
        storyline: newStoryline,
      };
    }

    case ACTIONS.SYNC_SLIDES_FROM_STORYLINE: {
      // Reorder slides to match storyline order (storyline = source of truth)
      // Also update slide titles from storyline
      if (state.storyline.length === 0) return state;

      // Map storyline points to slides
      const storylineWithSlides = state.storyline.map(point => ({
        point,
        slide: state.slides.find(s =>
          s.storyPointId === point.id || s.id === point.slideId
        ),
      }));

      // Get slides that are in storyline (in storyline order)
      const orderedSlides = storylineWithSlides
        .filter(({ slide }) => slide)
        .map(({ point, slide }) => ({
          ...slide,
          title: point.title || slide.title,
          storyPointId: point.id,
        }));

      // Get slides NOT in storyline (orphans) - keep at end
      const orphanSlides = state.slides.filter(slide =>
        !storylineWithSlides.some(({ slide: s }) => s?.id === slide.id)
      );

      return {
        ...state,
        slides: [...orderedSlides, ...orphanSlides],
      };
    }

    case ACTIONS.SET_SKELETON_MODE: {
      return {
        ...state,
        skeletonMode: action.payload.enabled,
      };
    }

    case ACTIONS.APPROVE_SKELETON: {
      const { slideId, approved } = action.payload;
      return {
        ...state,
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          return {
            ...slide,
            skeletonApproved: approved !== false, // defaults to true
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case ACTIONS.APPROVE_ALL_SKELETONS: {
      return {
        ...state,
        slides: state.slides.map((slide) => {
          if (!slide.isSkeleton) return slide;
          return {
            ...slide,
            skeletonApproved: true,
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case ACTIONS.UPDATE_THEME: {
      return {
        ...state,
        theme: { ...state.theme, ...action.payload.theme },
      };
    }

    case ACTIONS.SET_IMAGE_VIBE: {
      return {
        ...state,
        imageVibe: action.payload.vibe,
      };
    }

    case ACTIONS.SET_DARK_MODE: {
      return {
        ...state,
        darkMode: action.payload.enabled,
      };
    }

    case ACTIONS.TOGGLE_DARK_MODE: {
      return {
        ...state,
        darkMode: !state.darkMode,
      };
    }

    case ACTIONS.SET_HIGHLIGHTED_SLIDES: {
      return {
        ...state,
        highlightedSlideIndices: action.payload.indices || [],
      };
    }

    case ACTIONS.SET_AVAILABLE_SKILLS: {
      const list = Array.isArray(action.payload?.skills) ? action.payload.skills : [];
      return {
        ...state,
        availableSkills: list,
      };
    }

    case ACTIONS.REGENERATE_SLIDE_TITLES: {
      // Regenerate titles for all slides from their HTML content
      // Useful for fixing slides with instruction-based titles
      const updatedSlides = state.slides.map((slide, index) => {
        const extractedTitle = extractTitleFromHTML(slide.html);
        // Only update if we found a better title and current looks like an instruction
        const currentLooksLikeInstruction = slide.title?.toLowerCase().startsWith('create ') ||
                                            slide.title?.toLowerCase().startsWith('add ') ||
                                            slide.title?.toLowerCase().startsWith('make ') ||
                                            slide.title?.includes('...');

        const newTitle = extractedTitle && currentLooksLikeInstruction
          ? extractedTitle
          : (extractedTitle || slide.title || `Slide ${index + 1}`);

        return {
          ...slide,
          title: newTitle,
          summary: generateSlideSummary(slide.html, slide.type, newTitle),
        };
      });

      // Also update storyline to match
      const updatedStoryline = state.storyline.map(point => {
        const slide = updatedSlides.find(s => s.storyPointId === point.id || s.id === point.slideId);
        return slide ? { ...point, title: slide.title } : point;
      });

      return {
        ...state,
        slides: updatedSlides,
        storyline: updatedStoryline,
      };
    }

    case ACTIONS.RESTORE_SNAPSHOT: {
      // Restore state from a history snapshot
      const snapshot = action.payload.snapshot;
      return {
        ...state,
        slides: snapshot.slides,
        sharedCSS: snapshot.sharedCSS,
        theme: snapshot.theme || state.theme,
        deckName: snapshot.deckName,
        darkMode: snapshot.darkMode ?? false,
        customTemplates: snapshot.customTemplates,
        deletedSystemTemplates: snapshot.deletedSystemTemplates,
        modifiedSystemTemplates: snapshot.modifiedSystemTemplates,
        storyline: snapshot.storyline,
        storylineStatus: snapshot.storylineStatus,
        skeletonMode: snapshot.skeletonMode,
        activeSlideId: snapshot.activeSlideId,
        selectedSlideIds: snapshot.activeSlideId ? [snapshot.activeSlideId] : [],
      };
    }

    case ACTIONS.CLEAR_HISTORY: {
      // Clear deck versions and other accumulated data to free up localStorage space
      // This is a destructive action - versions cannot be recovered
      console.log('[SlideContext] Clearing history/versions to free space');
      return {
        ...state,
        deckVersions: [], // Clear all saved versions
        // Keep current slides, settings, templates intact
      };
    }

    case ACTIONS.ADD_FLOW: {
      const newFlow = {
        id: action.payload.id || `flow-${uuidv4()}`,
        name: action.payload.name || 'Untitled Flow',
        description: action.payload.description || '',
        overallGuidance: action.payload.overallGuidance || '',
        sections: (action.payload.sections || []).map((s, i) => ({
          id: s.id || `fs-${uuidv4()}`,
          order: s.order ?? i,
          templateHint: s.templateHint || '',
          instruction: s.instruction || '',
          isRepeatable: s.isRepeatable || false,
          repeatSource: s.repeatSource || '',
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { ...state, flows: [...(state.flows || []), newFlow] };
    }

    case ACTIONS.UPDATE_FLOW: {
      return {
        ...state,
        flows: (state.flows || []).map(f =>
          f.id === action.payload.id
            ? { ...f, ...action.payload.updates, updatedAt: new Date().toISOString() }
            : f
        ),
      };
    }

    case ACTIONS.DELETE_FLOW: {
      return {
        ...state,
        flows: (state.flows || []).filter(f => f.id !== action.payload.id),
      };
    }

    default:
      return state;
  }
}

// Detect layout type from HTML for agent awareness
// Returns: 'cover', 'cards', 'kpi', 'timeline', 'quote', 'process', 'comparison', 'grid', 'bullets', 'split', 'generic'
function detectLayoutType(html) {
  if (!html) return 'generic';

  // Cover slide
  if (html.includes('cover-slide') || html.includes('cover-title') || html.includes('master-cover')) {
    return 'cover';
  }
  // Cards layout (3 cards, card-row)
  if (html.includes('card-row') || (html.includes('class="card"') && html.match(/class="card"/g)?.length >= 2)) {
    const cardCount = html.match(/class="card"/g)?.length || 0;
    return cardCount > 3 ? 'cards-4+' : `cards-${cardCount}`;
  }
  // KPI/Metrics
  if (html.includes('kpi-block') || html.includes('kpi-value') || html.includes('kpi-row')) {
    return 'kpi';
  }
  // Timeline
  if (html.includes('timeline-row') || html.includes('timeline-item') || html.includes('roadmap')) {
    return 'timeline';
  }
  // Quote
  if (html.includes('quote-box') || html.includes('quote-text') || html.includes('testimonial')) {
    return 'quote';
  }
  // Process flow
  if (html.includes('process-step') || html.includes('process-flow') || html.includes('step-number')) {
    return 'process';
  }
  // Comparison table
  if (html.includes('comparison-table') || html.includes('compare-row') || html.includes('vs-')) {
    return 'comparison';
  }
  // Grid layouts
  if (html.includes('grid-2x2') || html.includes('grid-cell') || html.includes('grid-3x3')) {
    return 'grid';
  }
  // Split/Two-column
  if (html.includes('two-col') || html.includes('split-') || html.includes('col-left') || html.includes('col-right')) {
    return 'split';
  }
  // 3x2 grid
  if (html.includes('grid-3x2') || html.includes('icon-grid') || html.includes('icon-card')) {
    return 'grid-3x2';
  }
  // Bullets
  if (html.includes('content-list') || (html.includes('<ul') && html.includes('<li'))) {
    return 'bullets';
  }
  // Stat highlight
  if (html.includes('stat-highlight') || html.includes('big-number') || html.includes('stat-value')) {
    return 'stat';
  }

  return 'generic';
}

// Default slide HTML template
function getDefaultSlideHTML() {
  return `<div class="slide">
  <h1 class="title">Your Slide Title Here</h1>
  <h2 class="subtitle">Subtitle</h2>
  <div class="frame">
    <p>Add your content here...</p>
  </div>
  <footer class="footer">
    <span>Your Brand</span>
    <span>1 / 1</span>
  </footer>
</div>`;
}

// Provider component
export function SlideProvider({ children }) {
  const [state, dispatch] = useReducer(slideReducer, null, loadState);
  const frameHydrateStartedRef = useRef(false);

  // Restore frame images from IndexedDB when localStorage holds placeholders
  useEffect(() => {
    if (frameHydrateStartedRef.current) return;
    const slides = state.slides || [];
    if (!slides.some((s) => slideHtmlHasFrameImagePlaceholder(s?.html))) return;
    frameHydrateStartedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const hydrated = await hydrateSlidesFromLocalStorage(slides);
        if (!cancelled) {
          dispatch({ type: ACTIONS.HYDRATE_SLIDES, slides: hydrated });
          console.log('[SlideContext] Hydrated frame images from IndexedDB');
        }
      } catch (e) {
        console.warn('[SlideContext] Frame image hydrate failed:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [state.slides]);

  const [isPanelOpen, setIsPanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('aiPanelOpen');
      return saved == null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => {
      const next = !prev;
      try { localStorage.setItem('aiPanelOpen', String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  // History management (kept in refs to avoid triggering re-renders)
  const historyRef = useRef([]); // Past snapshots
  const futureRef = useRef([]); // Future snapshots (for redo)
  const lastSnapshotRef = useRef(null); // Last captured snapshot (for debouncing)
  const debounceTimerRef = useRef(null); // Timer for debouncing rapid changes

  // Wrapped dispatch that captures history for undoable actions
  const dispatchWithHistory = useCallback((action) => {
    // Check if this action should be tracked in history
    const isUndoable = !NON_UNDOABLE_ACTIONS.has(action.type);

    if (isUndoable) {
      // Clear debounce timer if exists
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Capture current state before the change
      const currentSnapshot = getUndoableSnapshot(state);

      // Debounce: only add to history if sufficiently different from last snapshot
      // This prevents filling history with every keystroke
      if (snapshotsAreDifferent(currentSnapshot, lastSnapshotRef.current)) {
        historyRef.current = [...historyRef.current, currentSnapshot].slice(-MAX_HISTORY_SIZE);
        lastSnapshotRef.current = currentSnapshot;
      }

      // Clear future on new action (can't redo after new changes)
      futureRef.current = [];

      // Set a debounce timer to capture the final state after rapid changes
      debounceTimerRef.current = setTimeout(() => {
        lastSnapshotRef.current = getUndoableSnapshot(state);
      }, 500);
    }

    dispatch(action);
  }, [state]);

  // Save to localStorage on state change (debounced to avoid rapid writes during batch operations)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const saveState = async (stateToSave) => {
        // Strip transient/server-owned fields:
        //   - selectedSlideIds: UI selection, not meaningful after reload
        //   - availableSkills:  server catalogue, always refetched at boot
        //                       from /api/skills; persisting it would shadow
        //                       catalogue updates until a full reload.
        const { selectedSlideIds, availableSkills, ...persistState } = stateToSave;
        const slidesForStorage = await prepareSlidesForLocalStorage(persistState.slides || []);
        let versionsForStorage = persistState.deckVersions || [];
        if (versionsForStorage.length > 0) {
          versionsForStorage = await Promise.all(
            versionsForStorage.map(async (v) => ({
              ...v,
              slides: await prepareSlidesForLocalStorage(v.slides || []),
            }))
          );
        }
        const stateJson = JSON.stringify({
          ...persistState,
          slides: slidesForStorage,
          deckVersions: versionsForStorage,
        });
        localStorage.setItem('slideGeneratorState', stateJson);
        return stateJson.length;
      };

      (async () => {
      try {
        const stateSize = await saveState(state);
        console.log('[SlideContext] State saved to localStorage', {
          deckName: state.deckName,
          slideCount: state.slides?.length || 0,
          versionsCount: state.deckVersions?.length || 0,
          stateSize,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error('[SlideContext] Failed to save state:', e);
        if (e.name === 'QuotaExceededError' || e.message?.includes('quota') || e.message?.includes('exceeded')) {
          console.warn('[SlideContext] localStorage quota exceeded! Auto-clearing history...');
          const slimState = { ...state, deckVersions: [] };
          try {
            const slimSize = await saveState(slimState);
            console.log('[SlideContext] Saved after clearing versions, new size:', slimSize);
            dispatch({ type: ACTIONS.CLEAR_HISTORY });
          } catch (e2) {
            console.error('[SlideContext] Still failed after clearing history:', e2);
          }
        }
      }
      })();
    }, 2000);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state]);

  // Sync API concurrency cap from settings
  useEffect(() => {
    if (state.settings?.apiMaxConcurrent) {
      setApiMaxConcurrent(state.settings.apiMaxConcurrent);
    }
  }, [state.settings?.apiMaxConcurrent]);

  // PPTX code pre-generation is intentionally disabled. AI rendering code is
  // generated only when the user explicitly exports to PPTX.

  // Also save on page unload to ensure no data loss. Mirrors the debounced
  // saver above: strip selectedSlideIds (UI selection) and availableSkills
  // (server catalogue, always refetched at boot) so stale empty values from
  // an unresolved initial fetch don't shadow the fresh catalogue on reload.
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const { selectedSlideIds, availableSkills, ...persistState } = state;
        localStorage.setItem('slideGeneratorState', JSON.stringify(persistState));
      } catch (e) {
        console.error('[SlideContext] Failed to save on unload:', e);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state]);

  // Undo function - restore previous state
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return false;

    // Save current state to future for redo
    const currentSnapshot = getUndoableSnapshot(state);
    futureRef.current = [currentSnapshot, ...futureRef.current].slice(0, MAX_HISTORY_SIZE);

    // Pop and restore the previous state
    const previousSnapshot = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    lastSnapshotRef.current = previousSnapshot;

    dispatch({ type: ACTIONS.RESTORE_SNAPSHOT, payload: { snapshot: previousSnapshot } });
    return true;
  }, [state]);

  // Redo function - restore future state
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return false;

    // Save current state to history
    const currentSnapshot = getUndoableSnapshot(state);
    historyRef.current = [...historyRef.current, currentSnapshot].slice(-MAX_HISTORY_SIZE);

    // Pop and restore the future state
    const futureSnapshot = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    lastSnapshotRef.current = futureSnapshot;

    dispatch({ type: ACTIONS.RESTORE_SNAPSHOT, payload: { snapshot: futureSnapshot } });
    return true;
  }, [state]);

  // Check if undo/redo are available
  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // Actions - use dispatchWithHistory for undoable actions
  const actions = {
    addSlide: (data = {}) => dispatchWithHistory({ type: ACTIONS.ADD_SLIDE, payload: data }),

    // Insert slide at specific position (0 = first, 1 = second, etc., -1 = last)
    insertSlideAt: (position, data = {}) =>
      dispatchWithHistory({ type: ACTIONS.INSERT_SLIDE_AT, payload: { position, ...data } }),

    updateSlide: (id, updates) =>
      dispatchWithHistory({ type: ACTIONS.UPDATE_SLIDE, payload: { id, updates } }),

    deleteSlide: (id) => dispatchWithHistory({ type: ACTIONS.DELETE_SLIDE, payload: { id } }),

    reorderSlides: (fromIndex, toIndex) =>
      dispatchWithHistory({ type: ACTIONS.REORDER_SLIDES, payload: { fromIndex, toIndex } }),

    reorderSlidesById: (orderedIds) =>
      dispatchWithHistory({ type: ACTIONS.REORDER_SLIDES_BY_ID, payload: { orderedIds } }),

    // Combined move operation - reorder + change parent atomically
    moveSlide: (slideId, newParentId, targetIndex) =>
      dispatchWithHistory({ type: ACTIONS.MOVE_SLIDE, payload: { slideId, newParentId, targetIndex } }),

    // Atomic multi-slide move — avoids stale closure when moving multiple slides
    moveSlidesBatch: (orderedIds, newParentId, targetIndex) =>
      dispatchWithHistory({ type: ACTIONS.MOVE_SLIDES_BATCH, payload: { orderedIds, newParentId, targetIndex } }),

    // Slide hierarchy - set/change parent (null = root level)
    setSlideParent: (slideId, parentId) =>
      dispatchWithHistory({ type: ACTIONS.SET_SLIDE_PARENT, payload: { slideId, parentId } }),

    setActiveSlide: (id) =>
      dispatch({ type: ACTIONS.SET_ACTIVE_SLIDE, payload: { id } }),

    setSelectedSlides: (ids) =>
      dispatch({ type: ACTIONS.SET_SELECTED_SLIDES, payload: { ids } }),

    updateSharedCSS: (css) =>
      dispatchWithHistory({ type: ACTIONS.UPDATE_SHARED_CSS, payload: { css } }),

    updateSettings: (settings) =>
      dispatch({ type: ACTIONS.UPDATE_SETTINGS, payload: { settings } }),

    importSlides: (slides) =>
      dispatchWithHistory({ type: ACTIONS.IMPORT_SLIDES, payload: { slides } }),

    clearAll: () => dispatchWithHistory({ type: ACTIONS.CLEAR_ALL }),

    // Deck versioning
    setDeckName: (name) =>
      dispatchWithHistory({ type: ACTIONS.SET_DECK_NAME, payload: { name } }),

    saveVersion: (name) =>
      dispatchWithHistory({ type: ACTIONS.SAVE_VERSION, payload: { name } }),

    restoreVersion: (id) =>
      dispatchWithHistory({ type: ACTIONS.RESTORE_VERSION, payload: { id } }),

    deleteVersion: (id) =>
      dispatchWithHistory({ type: ACTIONS.DELETE_VERSION, payload: { id } }),

    startNewDeck: (name) =>
      dispatchWithHistory({ type: ACTIONS.START_NEW_DECK, payload: { name } }),

    // Custom templates
    addTemplate: (template) =>
      dispatchWithHistory({ type: ACTIONS.ADD_TEMPLATE, payload: template }),

    updateTemplate: (id, updates) =>
      dispatchWithHistory({ type: ACTIONS.UPDATE_TEMPLATE, payload: { id, updates } }),

    deleteTemplate: (id) =>
      dispatchWithHistory({ type: ACTIONS.DELETE_TEMPLATE, payload: { id } }),

    // System template modifications
    deleteSystemTemplate: (id) =>
      dispatchWithHistory({ type: ACTIONS.DELETE_SYSTEM_TEMPLATE, payload: { id } }),

    restoreSystemTemplate: (id) =>
      dispatchWithHistory({ type: ACTIONS.RESTORE_SYSTEM_TEMPLATE, payload: { id } }),

    modifySystemTemplate: (id, updates) =>
      dispatchWithHistory({ type: ACTIONS.MODIFY_SYSTEM_TEMPLATE, payload: { id, updates } }),

    resetSystemTemplate: (id) =>
      dispatchWithHistory({ type: ACTIONS.RESET_SYSTEM_TEMPLATE, payload: { id } }),

    // Flows (reusable storyline templates)
    addFlow: (flow) =>
      dispatchWithHistory({ type: ACTIONS.ADD_FLOW, payload: flow }),
    updateFlow: (id, updates) =>
      dispatchWithHistory({ type: ACTIONS.UPDATE_FLOW, payload: { id, updates } }),
    deleteFlow: (id) =>
      dispatchWithHistory({ type: ACTIONS.DELETE_FLOW, payload: { id } }),

    // Slide comments
    addComment: (slideId, text) =>
      dispatchWithHistory({ type: ACTIONS.ADD_COMMENT, payload: { slideId, text } }),

    addressComment: (slideId, commentId, addressedBy) =>
      dispatchWithHistory({ type: ACTIONS.ADDRESS_COMMENT, payload: { slideId, commentId, addressedBy } }),

    unaddressComment: (slideId, commentId) =>
      dispatchWithHistory({ type: ACTIONS.UNADDRESS_COMMENT, payload: { slideId, commentId } }),

    deleteComment: (slideId, commentId) =>
      dispatchWithHistory({ type: ACTIONS.DELETE_COMMENT, payload: { slideId, commentId } }),

    // Bulk address all pending comments for a slide
    addressAllSlideComments: (slideId, addressedBy) =>
      dispatchWithHistory({ type: ACTIONS.ADDRESS_ALL_SLIDE_COMMENTS, payload: { slideId, addressedBy } }),

    // Bulk address all comments for multiple slides
    addressCommentsForSlides: (slideIds, addressedBy) => {
      slideIds.forEach(slideId => {
        dispatchWithHistory({ type: ACTIONS.ADDRESS_ALL_SLIDE_COMMENTS, payload: { slideId, addressedBy } });
      });
    },

    // Legacy alias for backwards compatibility
    addressAllComments: (slideId, addressedBy) =>
      dispatchWithHistory({ type: ACTIONS.ADDRESS_ALL_SLIDE_COMMENTS, payload: { slideId, addressedBy } }),

    // Storyline management
    setStoryline: (storyline) =>
      dispatchWithHistory({ type: ACTIONS.SET_STORYLINE, payload: { storyline } }),

    setStorylineStatus: (status) =>
      dispatchWithHistory({ type: ACTIONS.SET_STORYLINE_STATUS, payload: { status } }),

    updateStorylinePoint: (pointId, updates) =>
      dispatchWithHistory({ type: ACTIONS.UPDATE_STORYLINE_POINT, payload: { pointId, updates } }),

    clearStoryline: () =>
      dispatchWithHistory({ type: ACTIONS.CLEAR_STORYLINE }),

    // Sync storyline with slides
    syncStorylineFromSlides: () =>
      dispatchWithHistory({ type: ACTIONS.SYNC_STORYLINE_FROM_SLIDES }),

    syncSlidesFromStoryline: () =>
      dispatchWithHistory({ type: ACTIONS.SYNC_SLIDES_FROM_STORYLINE }),

    // Skeleton management
    setSkeletonMode: (enabled) =>
      dispatchWithHistory({ type: ACTIONS.SET_SKELETON_MODE, payload: { enabled } }),

    approveSkeleton: (slideId, approved = true) =>
      dispatchWithHistory({ type: ACTIONS.APPROVE_SKELETON, payload: { slideId, approved } }),

    approveAllSkeletons: () =>
      dispatchWithHistory({ type: ACTIONS.APPROVE_ALL_SKELETONS }),

    // Theme system
    updateTheme: (theme) =>
      dispatchWithHistory({ type: ACTIONS.UPDATE_THEME, payload: { theme } }),

    // Image vibe (persisted -- used for image-based slides)
    setImageVibe: (vibe) =>
      dispatch({ type: ACTIONS.SET_IMAGE_VIBE, payload: { vibe } }),

    // Dark mode toggle (independent of vibe)
    setDarkMode: (enabled) =>
      dispatchWithHistory({ type: ACTIONS.SET_DARK_MODE, payload: { enabled } }),

    toggleDarkMode: () =>
      dispatchWithHistory({ type: ACTIONS.TOGGLE_DARK_MODE }),

    // Helper to mark a slide as filled (no longer skeleton)
    markSlideAsFilled: (slideId) =>
      dispatchWithHistory({ type: ACTIONS.UPDATE_SLIDE, payload: { id: slideId, updates: { isSkeleton: false } } }),

    // UI state - highlight slides as context for AI router
    setHighlightedSlides: (indices) =>
      dispatch({ type: ACTIONS.SET_HIGHLIGHTED_SLIDES, payload: { indices } }),

    // Consulting skills catalogue (metadata only). Populated once at boot
    // from /api/skills and consumed by the skill dropdown in AIChatbot.
    setAvailableSkills: (skills) =>
      dispatch({ type: ACTIONS.SET_AVAILABLE_SKILLS, payload: { skills } }),

    // Regenerate all slide titles from HTML content (fixes instruction-based titles)
    regenerateSlideTitles: () =>
      dispatchWithHistory({ type: ACTIONS.REGENERATE_SLIDE_TITLES }),

    // Undo/Redo actions
    undo,
    redo,

    // Storage management
    clearHistory: () =>
      dispatch({ type: ACTIONS.CLEAR_HISTORY }),
  };

  // Computed values
  const activeSlide = state.slides.find((s) => s.id === state.activeSlideId) || null;

  // History state for UI
  const historyState = {
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    historyLength: historyRef.current.length,
    futureLength: futureRef.current.length,
  };

  const activeClientProfile = getClientDesignProfile(state.settings.clientDesignProfileId || 'strategy');

  return (
    <SlideContext.Provider value={{ state, actions, activeSlide, activeClientProfile, historyState, isPanelOpen, togglePanel }}>
      {children}
    </SlideContext.Provider>
  );
}

// Hook
export function useSlides() {
  const context = useContext(SlideContext);
  if (!context) {
    throw new Error('useSlides must be used within a SlideProvider');
  }
  return context;
}

export default SlideContext;
