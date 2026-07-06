/**
 * Knowledge Base RAG (Retrieval-Augmented Generation) Service
 *
 * Provides smart retrieval of knowledge base entries for AI context injection.
 * Uses TF-IDF-inspired scoring with category boosting and field weighting.
 *
 * How it works:
 * 1. User asks "build a CV for Sarah Mitchell" or "show AI credentials"
 * 2. The query is tokenized and matched against all KB entries
 * 3. Results are scored by term frequency, field importance, and category relevance
 * 4. Top-K results are formatted as context for the LLM prompt
 *
 * The LLM sees the retrieved entries and uses them as source material to build slides.
 */

import { debugLog, LogLevel } from '../utils/debugLog';

// ─── Field weights — some fields matter more for matching ────────────────────
const FIELD_WEIGHTS = {
  name: 10,
  title: 8,
  topic: 8,
  client: 6,
  industry: 6,
  category: 5,
  skills: 4,
  summary: 3,
  description: 3,
  challenge: 3,
  solution: 2,
  results: 2,
  features: 2,
  experience: 2,
  content: 1,
  // Tags get special handling
};

// ─── Category boost — when query mentions a category, boost those results ────
const CATEGORY_KEYWORDS = {
  cvs: ['cv', 'resume', 'bio', 'profile', 'team', 'person', 'partner', 'manager', 'consultant', 'director', 'experience', 'background', 'who is', 'about'],
  case_studies: ['credential', 'case study', 'project', 'engagement', 'client work', 'reference', 'success story', 'example project', 'past work', 'track record', 'we did', 'we delivered'],
  qualifications: ['qualification', 'certification', 'certified', 'accreditation', 'award', 'recognition', 'partnership', 'iso', 'compliance'],
  products: ['product', 'service', 'offering', 'solution', 'platform', 'tool', 'assessment', 'program', 'methodology'],
  company: ['company', 'firm', 'about us', 'who we are', 'overview', 'approach', 'capability', 'practice', 'differentiator', 'industry'],
};

/**
 * Tokenize a string into searchable terms
 * Handles multi-word proper nouns by also keeping bigrams
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  // Split on non-alphanumeric (keep hyphens within words)
  const words = lower.split(/[^a-z0-9-]+/).filter(w => w.length > 1);
  // Also create bigrams for multi-word matching (e.g., "sarah mitchell", "supply chain")
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

/**
 * Compute inverse document frequency for terms across all entries
 * Terms that appear in fewer documents are more discriminative
 */
function computeIDF(allEntries) {
  const docCount = allEntries.length;
  const termDocCounts = {};

  for (const entry of allEntries) {
    const entryText = Object.values(entry)
      .filter(v => typeof v === 'string')
      .join(' ');
    const uniqueTerms = new Set(tokenize(entryText));
    for (const term of uniqueTerms) {
      termDocCounts[term] = (termDocCounts[term] || 0) + 1;
    }
  }

  const idf = {};
  for (const [term, count] of Object.entries(termDocCounts)) {
    // Standard IDF formula with smoothing
    idf[term] = Math.log((docCount + 1) / (count + 1)) + 1;
  }
  return idf;
}

/**
 * Score a single entry against query tokens
 * Returns a relevance score based on weighted field matching + IDF
 */
function scoreEntry(entry, queryTokens, idf, categoryBoost) {
  let score = 0;
  const matchDetails = [];

  for (const [field, value] of Object.entries(entry)) {
    if (typeof value !== 'string' && !Array.isArray(value)) continue;

    const fieldWeight = FIELD_WEIGHTS[field] || 1;
    const fieldText = Array.isArray(value) ? value.join(' ') : value;
    const fieldLower = fieldText.toLowerCase();
    const fieldTokens = tokenize(fieldText);

    for (const queryToken of queryTokens) {
      // Exact substring match in field
      if (fieldLower.includes(queryToken)) {
        const idfScore = idf[queryToken] || 1;
        const termScore = fieldWeight * idfScore;
        score += termScore;
        matchDetails.push({ field, token: queryToken, weight: termScore });
      }
    }

    // Bonus: tag matching (tags are high-signal)
    if (field === 'tags' && Array.isArray(value)) {
      for (const tag of value) {
        const tagLower = tag.toLowerCase();
        for (const queryToken of queryTokens) {
          if (tagLower === queryToken || tagLower.includes(queryToken)) {
            score += 8; // Strong tag match bonus
          }
        }
      }
    }
  }

  // Apply category boost
  score *= categoryBoost;

  return { score, matchDetails };
}

/**
 * Detect which KB categories the query is most likely targeting
 * Returns a map of categoryId → boost multiplier
 */
function detectCategoryIntent(queryTokens) {
  const boosts = {};

  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      const kwTokens = tokenize(keyword);
      for (const kwToken of kwTokens) {
        if (queryTokens.some(qt => qt.includes(kwToken) || kwToken.includes(qt))) {
          matchCount++;
        }
      }
    }
    // Boost categories that match query intent
    boosts[categoryId] = matchCount > 0 ? 1 + (matchCount * 0.5) : 1;
  }

  return boosts;
}

/**
 * Main RAG retrieval function
 *
 * @param {string} query - User's natural language query
 * @param {Object} entries - Knowledge base entries by category { cvs: [...], case_studies: [...], ... }
 * @param {Object} options - Configuration
 * @param {number} options.topK - Max results to return (default: 5)
 * @param {string[]} options.categories - Restrict to specific categories
 * @param {number} options.minScore - Minimum relevance score threshold (default: 2)
 * @returns {Array<{entry, categoryId, score, matchDetails}>}
 */
export function ragRetrieve(query, entries, options = {}) {
  const { topK = 5, categories = null, minScore = 2 } = options;

  if (!query || !entries) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Flatten all entries with their category
  const allEntries = [];
  for (const [categoryId, items] of Object.entries(entries)) {
    if (categories && !categories.includes(categoryId)) continue;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      allEntries.push({ entry: item, categoryId });
    }
  }

  if (allEntries.length === 0) return [];

  // Compute IDF across all entries
  const idf = computeIDF(allEntries.map(e => e.entry));

  // Detect category intent from query
  const categoryBoosts = detectCategoryIntent(queryTokens);

  // Score all entries
  const scored = allEntries.map(({ entry, categoryId }) => {
    const boost = categoryBoosts[categoryId] || 1;
    const { score, matchDetails } = scoreEntry(entry, queryTokens, idf, boost);
    return { entry, categoryId, score, matchDetails };
  });

  // Sort by score and return top-K
  const results = scored
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  debugLog(LogLevel.DEBUG, '[RAG]', `Query: "${query}" → ${results.length} results (from ${allEntries.length} entries)`);
  if (results.length > 0) {
    debugLog(LogLevel.DEBUG, '[RAG]', `Top result: ${results[0].entry.name || results[0].entry.title || results[0].entry.topic} (score: ${results[0].score.toFixed(1)})`);
  }

  return results;
}

/**
 * Format RAG results as context for LLM injection
 *
 * Produces a structured text block that the LLM can use as source material.
 * Includes category labels and key fields so the LLM knows what type of content it is.
 *
 * @param {Array} results - Output from ragRetrieve()
 * @param {Object} options
 * @param {boolean} options.includeAllFields - Include all fields (vs. summary only)
 * @returns {string} Formatted context block
 */
export function formatRAGContext(results, options = {}) {
  const { includeAllFields = true } = options;

  if (!results || results.length === 0) return '';

  const CATEGORY_LABELS = {
    cvs: 'TEAM CV / PROFILE',
    case_studies: 'CASE STUDY / CREDENTIAL',
    qualifications: 'QUALIFICATION / CREDENTIAL',
    products: 'PRODUCT / SERVICE',
    company: 'COMPANY INFO',
    documents: 'UPLOADED DOCUMENT',
    engagements: 'PAST ENGAGEMENT',
  };

  const blocks = results.map(({ entry, categoryId, score }) => {
    const label = CATEGORY_LABELS[categoryId] || categoryId.toUpperCase();
    const lines = [`[${label}]`];

    // Format fields based on category
    if (categoryId === 'cvs') {
      lines.push(`Name: ${entry.name}`);
      lines.push(`Title: ${entry.title}`);
      if (entry.education) lines.push(`Education: ${entry.education}`);
      if (entry.skills) lines.push(`Skills: ${entry.skills}`);
      if (entry.experience) lines.push(`Experience: ${entry.experience}`);
      if (entry.summary) lines.push(`Summary: ${entry.summary}`);
    } else if (categoryId === 'case_studies') {
      lines.push(`Title: ${entry.title}`);
      if (entry.client) lines.push(`Client: ${entry.client}`);
      if (entry.industry) lines.push(`Industry: ${entry.industry}`);
      if (entry.challenge) lines.push(`Challenge: ${entry.challenge}`);
      if (entry.solution) lines.push(`Solution: ${entry.solution}`);
      if (entry.results) lines.push(`Results: ${entry.results}`);
    } else if (categoryId === 'qualifications') {
      lines.push(`Name: ${entry.name}`);
      if (entry.issuer) lines.push(`Issuer: ${entry.issuer}`);
      if (entry.description) lines.push(`Description: ${entry.description}`);
    } else if (categoryId === 'products') {
      lines.push(`Name: ${entry.name}`);
      if (entry.category) lines.push(`Category: ${entry.category}`);
      if (entry.description) lines.push(`Description: ${entry.description}`);
      if (entry.features) lines.push(`Features: ${entry.features}`);
      if (entry.benefits) lines.push(`Benefits: ${entry.benefits}`);
    } else if (categoryId === 'company') {
      lines.push(`Topic: ${entry.topic}`);
      if (entry.content) lines.push(entry.content);
    } else {
      // Generic: include all string fields
      for (const [key, val] of Object.entries(entry)) {
        if (typeof val === 'string' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
          lines.push(`${key}: ${includeAllFields ? val : val.slice(0, 300)}`);
        }
      }
    }

    return lines.join('\n');
  });

  return blocks.join('\n\n---\n\n');
}

/**
 * High-level RAG function: retrieve + format in one call
 *
 * @param {string} query - User query
 * @param {Object} entries - KB entries by category
 * @param {Object} options - { topK, categories, minScore, includeAllFields }
 * @returns {{ context: string, results: Array, count: number } | null}
 */
export function retrieveAndFormat(query, entries, options = {}) {
  const results = ragRetrieve(query, entries, options);
  if (results.length === 0) return null;

  const context = formatRAGContext(results, options);
  return {
    context,
    results,
    count: results.length,
  };
}
