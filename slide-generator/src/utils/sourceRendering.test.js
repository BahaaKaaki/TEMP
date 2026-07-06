import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSearchEngineResultsUrl,
  isResearchCandidateSource,
  isRenderableSlideSource,
  filterRenderableSlideSources,
} from './sourceRendering.js';

test('isSearchEngineResultsUrl detects common SERPs', () => {
  assert.equal(isSearchEngineResultsUrl('https://www.google.com/search?q=foo'), true);
  assert.equal(isSearchEngineResultsUrl('https://google.com/search?q=foo'), true);
  assert.equal(isSearchEngineResultsUrl('https://www.bing.com/search?q=foo'), true);
  assert.equal(isSearchEngineResultsUrl('https://duckduckgo.com/?q=foo'), true);
  assert.equal(isSearchEngineResultsUrl('https://search.yahoo.com/search?p=foo'), true);
  assert.equal(isSearchEngineResultsUrl('https://example.com/report'), false);
  assert.equal(isSearchEngineResultsUrl('https://google.com/about'), false);
});

test('isResearchCandidateSource flags planner noise', () => {
  assert.equal(isResearchCandidateSource({ type: 'web_search', url: 'https://x.com' }), true);
  assert.equal(isResearchCandidateSource({ generatedFrom: 'slide_text', url: 'https://x.com' }), true);
  assert.equal(isResearchCandidateSource({ label: 'User-provided readiness', url: 'https://x.com' }), true);
  assert.equal(isResearchCandidateSource({ label: 'McKinsey', url: 'https://mckinsey.com/x' }), false);
});

test('isRenderableSlideSource rejects SERP and label-only shapes', () => {
  assert.equal(isRenderableSlideSource({ type: 'link', url: 'https://example.com/a', label: 'A' }), true);
  assert.equal(isRenderableSlideSource({ type: 'link', url: 'https://www.google.com/search?q=x', label: 'X' }), false);
  assert.equal(isRenderableSlideSource({ type: 'search', url: 'https://example.com/a', label: 'A' }), false);
  assert.equal(isRenderableSlideSource({ type: 'metadata', label: 'Only label' }), false);
  assert.equal(isRenderableSlideSource({ type: 'metadata', fileId: 'f1', label: 'Doc' }), true);
});

test('filterRenderableSlideSources keeps only renderable', () => {
  const out = filterRenderableSlideSources([
    { type: 'link', url: 'https://a.com', label: 'a' },
    { type: 'search', url: 'https://b.com', label: 'b' },
    { type: 'link', url: 'https://google.com/search?q=z', label: 'z' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].url, 'https://a.com');
});
