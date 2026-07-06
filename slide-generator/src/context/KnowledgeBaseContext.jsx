/**
 * Knowledge Base Context
 * Manages structured knowledge for slide creation with categories like:
 * - Qualifications/Credentials
 * - CVs/Team Profiles
 * - Products/Services
 * - Company Info
 * - Uploaded Documents
 *
 * All data is stored client-side in localStorage.
 */

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ragRetrieve, formatRAGContext } from '../services/knowledgeBaseRAG';
import { ALL_SEED_EXAMPLES, getSeedExampleCount } from '../data/knowledgeBaseExamples';
import { DEFAULT_SKILLS } from '../services/skillRegistry';

const KnowledgeBaseContext = createContext(null);

// Knowledge categories with their structure
export const KNOWLEDGE_CATEGORIES = {
  QUALIFICATIONS: {
    id: 'qualifications',
    name: 'Qualifications & Credentials',
    icon: '🎓',
    description: 'Certifications, awards, accreditations, and professional qualifications',
    fields: ['name', 'issuer', 'date', 'description', 'validUntil'],
  },
  CVS: {
    id: 'cvs',
    name: 'Team CVs & Profiles',
    icon: '👤',
    description: 'Team member profiles, experience, and expertise',
    fields: ['name', 'title', 'experience', 'skills', 'education', 'summary'],
  },
  PRODUCTS: {
    id: 'products',
    name: 'Products & Services',
    icon: '📦',
    description: 'Product descriptions, features, pricing, and service offerings',
    fields: ['name', 'category', 'description', 'features', 'benefits', 'pricing'],
  },
  COMPANY: {
    id: 'company',
    name: 'Company Information',
    icon: '🏢',
    description: 'Company overview, history, values, and key facts',
    fields: ['topic', 'content', 'category'],
  },
  CASE_STUDIES: {
    id: 'case_studies',
    name: 'Case Studies',
    icon: '📊',
    description: 'Project examples, success stories, and client testimonials',
    fields: ['title', 'client', 'challenge', 'solution', 'results', 'industry'],
  },
  DOCUMENTS: {
    id: 'documents',
    name: 'Uploaded Documents',
    icon: '📄',
    description: 'Parsed content from uploaded files (PDF, Word, Excel, PPTX, images)',
    fields: ['fileName', 'content', 'type', 'parsedAt'],
  },
  SKILLS: {
    id: 'skills',
    name: 'Agent Skills',
    icon: '⚡',
    description: 'Pluggable knowledge that shapes how the consulting team reasons and works',
    fields: ['name', 'appliesWhen', 'methodology'],
  },
  ENGAGEMENTS: {
    id: 'engagements',
    name: 'Past Engagements',
    icon: '🧠',
    description: 'Consulting team engagement history — past research, findings, and outcomes',
    fields: ['topic', 'request', 'date', 'slideCount'],
    readOnly: true,
  },
};

// Initial state
const initialState = {
  // Structured entries by category
  entries: {
    qualifications: [],
    cvs: [],
    products: [],
    company: [],
    case_studies: [],
    documents: [],
    skills: [],
    engagements: [],
  },
  // Quick search index (built from entries)
  searchIndex: [],
  // Tags for organization
  tags: [],
  // Last updated timestamp
  lastUpdated: null,
};

// Action types
const ACTIONS = {
  ADD_ENTRY: 'ADD_ENTRY',
  UPDATE_ENTRY: 'UPDATE_ENTRY',
  DELETE_ENTRY: 'DELETE_ENTRY',
  ADD_DOCUMENT: 'ADD_DOCUMENT',
  BULK_ADD_DOCUMENTS: 'BULK_ADD_DOCUMENTS',
  CLEAR_CATEGORY: 'CLEAR_CATEGORY',
  CLEAR_ALL: 'CLEAR_ALL',
  ADD_TAG: 'ADD_TAG',
  REMOVE_TAG: 'REMOVE_TAG',
  LOAD_STATE: 'LOAD_STATE',
  REBUILD_INDEX: 'REBUILD_INDEX',
  SEED_EXAMPLES: 'SEED_EXAMPLES',
};

/**
 * Build search index from all entries
 */
function buildSearchIndex(entries) {
  const index = [];

  for (const [categoryId, items] of Object.entries(entries)) {
    for (const item of items) {
      // Create searchable text from all string fields
      const searchableText = Object.values(item)
        .filter(v => typeof v === 'string')
        .join(' ')
        .toLowerCase();

      index.push({
        id: item.id,
        categoryId,
        searchableText,
        title: item.name || item.title || item.fileName || item.topic || 'Untitled',
        preview: (item.description || item.content || item.summary || '').slice(0, 200),
      });
    }
  }

  return index;
}

/**
 * Reducer for knowledge base state
 */
function knowledgeReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_ENTRY: {
      const { categoryId, entry } = action.payload;
      const newEntry = {
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        ...entry,
      };

      const newEntries = {
        ...state.entries,
        [categoryId]: [...(state.entries[categoryId] || []), newEntry],
      };

      return {
        ...state,
        entries: newEntries,
        searchIndex: buildSearchIndex(newEntries),
        lastUpdated: new Date().toISOString(),
      };
    }

    case ACTIONS.UPDATE_ENTRY: {
      const { categoryId, entryId, updates } = action.payload;
      const newEntries = {
        ...state.entries,
        [categoryId]: state.entries[categoryId].map(entry =>
          entry.id === entryId
            ? { ...entry, ...updates, updatedAt: new Date().toISOString() }
            : entry
        ),
      };

      return {
        ...state,
        entries: newEntries,
        searchIndex: buildSearchIndex(newEntries),
        lastUpdated: new Date().toISOString(),
      };
    }

    case ACTIONS.DELETE_ENTRY: {
      const { categoryId, entryId } = action.payload;
      const newEntries = {
        ...state.entries,
        [categoryId]: state.entries[categoryId].filter(entry => entry.id !== entryId),
      };

      return {
        ...state,
        entries: newEntries,
        searchIndex: buildSearchIndex(newEntries),
        lastUpdated: new Date().toISOString(),
      };
    }

    case ACTIONS.ADD_DOCUMENT: {
      const { document } = action.payload;
      const docEntry = {
        id: uuidv4(),
        fileName: document.metadata?.fileName || 'Unknown',
        content: document.content,
        type: document.type,
        metadata: document.metadata,
        parsedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      };

      const newEntries = {
        ...state.entries,
        documents: [...state.entries.documents, docEntry],
      };

      return {
        ...state,
        entries: newEntries,
        searchIndex: buildSearchIndex(newEntries),
        lastUpdated: new Date().toISOString(),
      };
    }

    case ACTIONS.BULK_ADD_DOCUMENTS: {
      const { documents } = action.payload;
      const docEntries = documents.map(doc => ({
        id: uuidv4(),
        fileName: doc.metadata?.fileName || 'Unknown',
        content: doc.content,
        type: doc.type,
        metadata: doc.metadata,
        parsedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      }));

      const newEntries = {
        ...state.entries,
        documents: [...state.entries.documents, ...docEntries],
      };

      return {
        ...state,
        entries: newEntries,
        searchIndex: buildSearchIndex(newEntries),
        lastUpdated: new Date().toISOString(),
      };
    }

    case ACTIONS.CLEAR_CATEGORY: {
      const { categoryId } = action.payload;
      const newEntries = {
        ...state.entries,
        [categoryId]: [],
      };

      return {
        ...state,
        entries: newEntries,
        searchIndex: buildSearchIndex(newEntries),
        lastUpdated: new Date().toISOString(),
      };
    }

    case ACTIONS.CLEAR_ALL: {
      return {
        ...initialState,
        lastUpdated: new Date().toISOString(),
      };
    }

    case ACTIONS.ADD_TAG: {
      const { tag } = action.payload;
      if (state.tags.includes(tag)) return state;
      return {
        ...state,
        tags: [...state.tags, tag],
      };
    }

    case ACTIONS.REMOVE_TAG: {
      const { tag } = action.payload;
      return {
        ...state,
        tags: state.tags.filter(t => t !== tag),
      };
    }

    case ACTIONS.LOAD_STATE: {
      const { state: loadedState } = action.payload;
      return {
        ...loadedState,
        searchIndex: buildSearchIndex(loadedState.entries || initialState.entries),
      };
    }

    case ACTIONS.REBUILD_INDEX: {
      return {
        ...state,
        searchIndex: buildSearchIndex(state.entries),
      };
    }

    case ACTIONS.SEED_EXAMPLES: {
      const { examples } = action.payload; // { cvs: [...], case_studies: [...], ... }
      const newEntries = { ...state.entries };

      for (const [categoryId, items] of Object.entries(examples)) {
        if (!Array.isArray(items) || !newEntries[categoryId]) continue;
        const seeded = items.map(item => ({
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: item.tags || [],
          _seeded: true, // Mark as seed data for easy identification
          ...item,
        }));
        newEntries[categoryId] = [...newEntries[categoryId], ...seeded];
      }

      return {
        ...state,
        entries: newEntries,
        searchIndex: buildSearchIndex(newEntries),
        lastUpdated: new Date().toISOString(),
      };
    }

    default:
      return state;
  }
}

/**
 * Load state from localStorage
 */
function loadState() {
  try {
    const saved = localStorage.getItem('knowledgeBaseState');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure all category arrays exist
      const entries = { ...initialState.entries };
      if (parsed.entries) {
        for (const key of Object.keys(entries)) {
          if (parsed.entries[key]) {
            entries[key] = parsed.entries[key];
          }
        }
      }
      return {
        ...initialState,
        ...parsed,
        entries,
        searchIndex: buildSearchIndex(entries),
      };
    }
  } catch (error) {
    console.error('[KnowledgeBase] Failed to load state:', error);
  }
  return { ...initialState, searchIndex: [] };
}

/**
 * Knowledge Base Provider Component
 */
export function KnowledgeBaseProvider({ children }) {
  const [state, dispatch] = useReducer(knowledgeReducer, null, loadState);

  // Seed default skills on first load (when skills array is empty)
  useEffect(() => {
    if (!state.entries.skills || state.entries.skills.length === 0) {
      const skillEntries = DEFAULT_SKILLS.map(skill => ({
        id: uuidv4(),
        name: skill.name,
        appliesWhen: skill.appliesWhen,
        methodology: skill.methodology,
        _skillId: skill.id, // preserve original skill ID for reference
        _seeded: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      }));
      dispatch({
        type: ACTIONS.LOAD_STATE,
        payload: {
          state: {
            ...state,
            entries: { ...state.entries, skills: skillEntries },
          },
        },
      });
    }
  }, []); // Run once on mount

  // Persist to localStorage on changes
  useEffect(() => {
    try {
      // Don't save the searchIndex (it's rebuilt on load)
      const { searchIndex, ...stateToSave } = state;
      localStorage.setItem('knowledgeBaseState', JSON.stringify(stateToSave));
    } catch (error) {
      console.error('[KnowledgeBase] Failed to save state:', error);
    }
  }, [state]);

  // Actions
  const actions = {
    addEntry: useCallback((categoryId, entry) => {
      dispatch({ type: ACTIONS.ADD_ENTRY, payload: { categoryId, entry } });
    }, []),

    updateEntry: useCallback((categoryId, entryId, updates) => {
      dispatch({ type: ACTIONS.UPDATE_ENTRY, payload: { categoryId, entryId, updates } });
    }, []),

    deleteEntry: useCallback((categoryId, entryId) => {
      dispatch({ type: ACTIONS.DELETE_ENTRY, payload: { categoryId, entryId } });
    }, []),

    addDocument: useCallback((document) => {
      dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: { document } });
    }, []),

    bulkAddDocuments: useCallback((documents) => {
      dispatch({ type: ACTIONS.BULK_ADD_DOCUMENTS, payload: { documents } });
    }, []),

    clearCategory: useCallback((categoryId) => {
      dispatch({ type: ACTIONS.CLEAR_CATEGORY, payload: { categoryId } });
    }, []),

    clearAll: useCallback(() => {
      dispatch({ type: ACTIONS.CLEAR_ALL });
    }, []),

    addTag: useCallback((tag) => {
      dispatch({ type: ACTIONS.ADD_TAG, payload: { tag } });
    }, []),

    removeTag: useCallback((tag) => {
      dispatch({ type: ACTIONS.REMOVE_TAG, payload: { tag } });
    }, []),

    loadSeedExamples: useCallback(() => {
      dispatch({ type: ACTIONS.SEED_EXAMPLES, payload: { examples: ALL_SEED_EXAMPLES } });
    }, []),

    clearSeedExamples: useCallback(() => {
      // Remove only entries marked with _seeded flag
      const cleaned = { ...state.entries };
      for (const categoryId of Object.keys(cleaned)) {
        if (Array.isArray(cleaned[categoryId])) {
          cleaned[categoryId] = cleaned[categoryId].filter(e => !e._seeded);
        }
      }
      dispatch({ type: ACTIONS.LOAD_STATE, payload: { state: { ...state, entries: cleaned } } });
    }, [state]),
  };

  // Search functions
  const search = useCallback((query, options = {}) => {
    const { categoryId, tags, limit = 20 } = options;
    const queryLower = query.toLowerCase().trim();

    if (!queryLower) {
      // Return recent entries if no query
      let results = state.searchIndex;
      if (categoryId) {
        results = results.filter(r => r.categoryId === categoryId);
      }
      return results.slice(0, limit);
    }

    // Score-based search
    const scored = state.searchIndex
      .filter(item => {
        if (categoryId && item.categoryId !== categoryId) return false;
        return item.searchableText.includes(queryLower);
      })
      .map(item => {
        // Simple scoring: exact matches score higher
        let score = 0;
        if (item.title.toLowerCase().includes(queryLower)) score += 10;
        if (item.preview.toLowerCase().includes(queryLower)) score += 5;
        const occurrences = (item.searchableText.match(new RegExp(queryLower, 'g')) || []).length;
        score += occurrences;
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }, [state.searchIndex]);

  // Get full entry by ID
  const getEntry = useCallback((categoryId, entryId) => {
    return state.entries[categoryId]?.find(e => e.id === entryId) || null;
  }, [state.entries]);

  // Get all entries in a category
  const getCategory = useCallback((categoryId) => {
    return state.entries[categoryId] || [];
  }, [state.entries]);

  // Get entry counts by category
  const getCounts = useCallback(() => {
    const counts = {};
    for (const [categoryId, items] of Object.entries(state.entries)) {
      counts[categoryId] = items.length;
    }
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
    return counts;
  }, [state.entries]);

  // Build context for AI (RAG-style) — uses TF-IDF scoring for smart retrieval
  const buildKnowledgeContext = useCallback((query, options = {}) => {
    const { maxTokens = 4000, categories = null, fullContent = false } = options;

    // Use RAG retrieval with TF-IDF scoring
    const ragResults = ragRetrieve(query, state.entries, {
      topK: fullContent ? 20 : 8,
      categories: categories || undefined,
      minScore: 1.5,
    });

    if (ragResults.length === 0) {
      // Fallback: simple substring search for when RAG finds nothing
      const fallbackEntries = search(query, { limit: fullContent ? 20 : 8 });
      if (fallbackEntries.length === 0) return null;

      const contextParts = [];
      let estimatedTokens = 0;

      for (const result of fallbackEntries) {
        const entry = getEntry(result.categoryId, result.id);
        if (!entry) continue;

        const categoryInfo = Object.values(KNOWLEDGE_CATEGORIES).find(c => c.id === result.categoryId);
        const categoryName = categoryInfo?.name || result.categoryId;
        let entryText = `[${categoryName}] ${result.title}\n`;

        if (entry.content) {
          entryText += (fullContent ? entry.content : entry.content.slice(0, 1000)) + '\n';
        }
        if (entry.description) entryText += entry.description + '\n';
        if (entry.summary) entryText += entry.summary + '\n';

        const entryTokens = Math.ceil(entryText.length / 4);
        if (estimatedTokens + entryTokens > maxTokens) break;
        contextParts.push(entryText);
        estimatedTokens += entryTokens;
      }

      return contextParts.length > 0
        ? { context: contextParts.join('\n---\n'), entriesUsed: contextParts.length, estimatedTokens }
        : null;
    }

    // Format RAG results into context
    const context = formatRAGContext(ragResults, { includeAllFields: fullContent });

    // Token budget enforcement
    let trimmedContext = context;
    let estimatedTokens = Math.ceil(context.length / 4);
    if (estimatedTokens > maxTokens) {
      // Reduce to fit by taking fewer results
      for (let k = ragResults.length - 1; k >= 1; k--) {
        const reduced = formatRAGContext(ragResults.slice(0, k), { includeAllFields: fullContent });
        const reducedTokens = Math.ceil(reduced.length / 4);
        if (reducedTokens <= maxTokens) {
          trimmedContext = reduced;
          estimatedTokens = reducedTokens;
          break;
        }
      }
    }

    return {
      context: trimmedContext,
      entriesUsed: ragResults.length,
      estimatedTokens,
      ragScores: ragResults.map(r => ({
        title: r.entry.name || r.entry.title || r.entry.topic,
        category: r.categoryId,
        score: r.score,
      })),
    };
  }, [state.entries, search, getEntry]);

  const value = {
    state,
    entries: state.entries,
    searchIndex: state.searchIndex,
    tags: state.tags,
    actions,
    search,
    getEntry,
    getCategory,
    getCounts,
    buildKnowledgeContext,
    categories: KNOWLEDGE_CATEGORIES,
  };

  return (
    <KnowledgeBaseContext.Provider value={value}>
      {children}
    </KnowledgeBaseContext.Provider>
  );
}

/**
 * Hook to access knowledge base
 */
export function useKnowledgeBase() {
  const context = useContext(KnowledgeBaseContext);
  if (!context) {
    throw new Error('useKnowledgeBase must be used within a KnowledgeBaseProvider');
  }
  return context;
}

// Re-export seed utilities for external use
export { ALL_SEED_EXAMPLES, getSeedExampleCount };

export default KnowledgeBaseContext;
