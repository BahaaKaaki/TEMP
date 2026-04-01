#!/usr/bin/env node
/**
 * simulate-deck.mjs
 *
 * Simulates the full AI assistant flow: classifier -> router (with search) -> slide generation.
 * Calls the PwC GenAI Shared Services API directly, no running server needed.
 *
 * Usage:
 *   node scripts/simulate-deck.mjs "6 slides on the current war in Lebanon"
 *   node scripts/simulate-deck.mjs --fast "8 slides about AI in agriculture 2026"
 *   node scripts/simulate-deck.mjs --thinking "3 slides on climate change economics"
 *
 * Output:  scripts/sim-output/<timestamp>/  (one file per call + summary)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────
const API_BASE = 'https://genai-sharedservice-emea.pwcinternal.com';
const API_KEY  = 'sk-P6LFrWr99JOOFh0biZ9MRg';

const MODELS = {
  classifier: 'openai.gpt-5.4-mini',
  router:     'openai.gpt-5.4',
  fast:       'vertex_ai.gemini-3.1-flash-lite-preview',
  thinking:   'bedrock.anthropic.claude-opus-4-6',
};

const args = process.argv.slice(2);
const speedFlag = args.includes('--thinking') ? 'thinking' : 'fast';
const userPrompt = args.filter(a => !a.startsWith('--')).join(' ')
  || '6 slides on the current war in Lebanon';

const genModel = MODELS[speedFlag];
const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ── Output directory ────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(__dirname, 'sim-output', ts);
fs.mkdirSync(outDir, { recursive: true });

let callIndex = 0;
const summary = [];

function log(msg) {
  process.stdout.write(msg + '\n');
}

function writeCall(label, request, response, elapsed) {
  callIndex++;
  const fname = `${String(callIndex).padStart(2, '0')}-${label}.json`;
  const data = { label, elapsed_ms: elapsed, request, response };
  fs.writeFileSync(path.join(outDir, fname), JSON.stringify(data, null, 2));
  summary.push({ call: callIndex, label, model: request.model, elapsed_ms: elapsed,
    input_chars: JSON.stringify(request).length,
    output_chars: JSON.stringify(response).length });
  log(`  [${callIndex}] ${label}  model=${request.model}  ${elapsed}ms  → ${fname}`);
}

// ── API helpers ─────────────────────────────────────────────────────
async function chatCompletions(model, systemPrompt, userMessage, opts = {}) {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: opts.max_tokens ?? 65536,
    temperature: opts.temperature ?? 0.1,
  };
  if (opts.reasoning_effort) body.reasoning_effort = opts.reasoning_effort;

  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const elapsed = Date.now() - t0;

  writeCall(opts.label || 'chat', { model, system_chars: systemPrompt.length, user_chars: userMessage.length, ...body }, json, elapsed);
  return { json, elapsed, content: json.choices?.[0]?.message?.content || '' };
}

async function responsesAPI(model, systemPrompt, userMessage, opts = {}) {
  const body = {
    model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    tools: [{ type: 'web_search_preview' }],
    max_output_tokens: opts.max_tokens ?? 65536,
    temperature: opts.temperature ?? 0.1,
  };

  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/v1/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const elapsed = Date.now() - t0;

  writeCall(opts.label || 'responses', { model, system_chars: systemPrompt.length, user_chars: userMessage.length, ...body }, json, elapsed);

  const outputItems = json.output || [];
  const textItem = outputItems.find(i => i.type === 'message');
  const content = textItem?.content?.[0]?.text || '';
  const searchCalls = outputItems.filter(i => i.type === 'web_search_call').length;
  return { json, elapsed, content, searchCalls };
}

// ── Load prompts from source ────────────────────────────────────────
const freestyleGuide = fs.readFileSync(
  path.join(ROOT, 'slide-generator/src/guides/freestyle-slide-guide.md'), 'utf-8'
);

const CLASSIFIER_SYSTEM = `You are a slide-editing request classifier. Given a user prompt, the currently active slide info, and a deck overview, classify the request.

Return ONLY valid JSON with these fields:
- scope: "single_slide" | "multi_slide" | "full_deck" | "qa"
- action: "create" | "edit" | "improve" | "delete" | "switch_template" | "answer"
- targetSlides: array of 0-indexed slide indices the action applies to
- needsPlanner: boolean - true if this needs multi-step planning
- needsSearch: boolean - true if the request needs current web data/facts/statistics
- searchQuery: string or null
- templateId: string or null
- instruction: string - the core instruction for execution

Rules:
- Creating a new deck from scratch: scope "full_deck", action "create", needsPlanner true
- Adding multiple slides: scope "multi_slide", action "create", needsPlanner true
- Questions about slides: scope "qa", action "answer", needsPlanner false
- Requests mentioning current data, latest, recent: needsSearch true
- Use 0-based indices: Slide 1 = index 0`;

// Simplified router prompt -- captures the core behavior
const ROUTER_SYSTEM = `You are an experienced consulting partner, work router, and research planner for slide presentations.

Your role: understand the user's request, decide the right deck structure, perform or coordinate research, and produce a consultant-grade execution plan.
Think like a senior strategy partner: precise, hypothesis-led, MECE, pyramid-structured, evidence-based, narrative-driven.

Output JSON only.

TODAY: ${today}

PRIORITY ORDER:
1. Return valid JSON matching the required schema
2. Preserve explicit user instructions exactly
3. Build a clear consultant-style storyline: answer first, then support
4. Maintain cross-slide coherence in terminology, numbers, and sources
5. Perform router-level research when external facts are needed

ACTIONS: create_slide, edit_slide, delete_slide, switch_template, answer_question

TEMPLATES AVAILABLE:
- "cover" — title slide with headline and subtitle
- "freestyle" — fully custom HTML+CSS layout (default for content slides)

For content slides, ALWAYS use templateId: "freestyle".

STEP FIELDS — STRUCTURED OUTPUT:
Each step may include these separate fields:
- action: the operation
- slideIndex: (REQUIRED for edit_slide) 0-based index of slide to modify
- templateId: which template to use
- position: where to place ("start", "end", "after_previous")
- title: main headline — 8-12 word business insight with a verb
- subtitle: 2-4 word noun phrase, no verbs
- instruction: the slide body content or core directive
- facts: array of supporting evidence/data points
- sources: array of backing references [{label, url, note}]
- layoutGuidance: describes the logical content shape for freestyle
- contextSlides: array of 0-based slide indices to reference
- contextFromStep: step index whose output this step depends on
- searchQuery: precise search query (RARE — only if router search didn't cover it)
- searchGoal: what the search must find (REQUIRED with searchQuery)
- sectionTracker: section label
- subSectionTracker: sub-section label

SEARCH — ROUTER-LEVEL IS DEFAULT:
You have web search available. Use it during planning to gather facts.
Do NOT add per-step "searchQuery" unless the step needs data you didn't cover.

contextSlides:
- Do NOT set contextSlides for new deck creation (slideCount=0)
- Only use when a step must reference existing slide content

SLIDE POSITIONING:
- Cover slides: position "start"
- Content slides: "end" or "after_previous"
- First content slide after cover: "after_previous", rest: "after_previous"

RESPONSE FORMAT (JSON only):
{
  "plan": [
    {"action":"create_slide","templateId":"cover","position":"start","title":"...","subtitle":"...","instruction":"..."},
    {"action":"create_slide","templateId":"freestyle","position":"after_previous","title":"...","subtitle":"...","instruction":"...","facts":[...],"sources":[...],"layoutGuidance":"..."}
  ],
  "groups": [[0],[1,2,3],[4,5]],
  "sourceSlides": [],
  "needsStoryline": false,
  "needsReplanning": false
}

groups: arrays of step indices that can execute in parallel. Cover slide MUST be alone in its group.
First content slide that uses contextFromStep:0 must be alone. Remaining independent slides can be batched.`;

const VIBE_HINT = `[Design Style: BASE VIBE - The solid foundation.
Use standard Strategy& styling:
- Clean left accent bars (4px maroon #8E1E1E)
- White card backgrounds with subtle shadows
- Clear visual hierarchy: title > subtitle > content
- Consistent spacing and typography
- Professional, clean, no embellishments
This is the default, well-tested layout that works reliably.]`;

// ── Main flow ───────────────────────────────────────────────────────
async function run() {
  log('');
  log('='.repeat(80));
  log(`SIMULATE DECK GENERATION`);
  log(`  Prompt:     "${userPrompt}"`);
  log(`  Speed:      ${speedFlag} → gen model: ${genModel}`);
  log(`  Classifier: ${MODELS.classifier}`);
  log(`  Router:     ${MODELS.router}`);
  log(`  Output:     ${outDir}`);
  log('='.repeat(80));

  // ────────────────────────────────────────────────────────────────
  // STEP 1: Tier 1 Classifier
  // ────────────────────────────────────────────────────────────────
  log('\n--- STEP 1: CLASSIFIER ---');
  const classifierUser = `NO ACTIVE SLIDE (0 slides in deck)\nDECK: Empty (no slides yet)\n\nUSER: ${userPrompt}`;

  const classResult = await chatCompletions(MODELS.classifier, CLASSIFIER_SYSTEM, classifierUser, {
    max_tokens: 300, temperature: 0, reasoning_effort: 'low', label: 'classifier',
  });
  log(`  Classifier response: ${classResult.content}`);

  let classification;
  try {
    const m = classResult.content.match(/\{[\s\S]*\}/);
    classification = JSON.parse(m[0]);
  } catch {
    classification = { scope: 'full_deck', needsPlanner: true, needsSearch: true };
  }
  log(`  → scope=${classification.scope}  needsPlanner=${classification.needsPlanner}  needsSearch=${classification.needsSearch}`);

  // ────────────────────────────────────────────────────────────────
  // STEP 2: Router (Tier 2 Planner) with web search
  // ────────────────────────────────────────────────────────────────
  log('\n--- STEP 2: ROUTER (with web search) ---');
  const routerContext = JSON.stringify({
    slideCount: 0, currentSlideIndex: -1, storylineSummary: '', slideSummaries: [],
    parallelBatchSize: 3, hasDocumentsAttached: false, agentMode: false,
    preferImageSlides: false, contextMode: 'deck',
  }, null, 2);

  const routerUser = `USER REQUEST: ${userPrompt}\n\nCURRENT STATE:\n${routerContext}\n\nWeb search available: YES\nSlide style preference: FREESTYLE`;

  const routerResult = await responsesAPI(MODELS.router, ROUTER_SYSTEM, routerUser, {
    max_tokens: 65536, temperature: 0.1, label: 'router',
  });
  log(`  Router: ${routerResult.searchCalls} search call(s), ${routerResult.content.length} chars response`);

  let plan = [];
  try {
    const m = routerResult.content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m[0]);
    plan = parsed.plan || [];
    log(`  → ${plan.length} steps planned`);
    for (let i = 0; i < plan.length; i++) {
      const s = plan[i];
      log(`     [${i}] ${s.action} ${s.templateId || 'freestyle'} — "${(s.title || s.instruction || '').slice(0, 70)}"`);
    }
  } catch (e) {
    log(`  ERROR parsing router plan: ${e.message}`);
    log(`  Raw content (first 500): ${routerResult.content.slice(0, 500)}`);
    process.exit(1);
  }

  // ────────────────────────────────────────────────────────────────
  // STEP 3: Generate each slide
  // ────────────────────────────────────────────────────────────────
  log('\n--- STEP 3: SLIDE GENERATION ---');
  log(`  Model: ${genModel}  (${speedFlag} mode)`);

  const generatedSlides = [];
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    log(`\n  --- Slide ${i + 1}/${plan.length}: ${step.action} (${step.templateId || 'freestyle'}) ---`);

    if (step.action === 'create_slide' && step.templateId === 'cover') {
      // Cover slide: just extract title for naming
      const coverPrompt = `Create a cover slide.\nTitle: ${step.title || step.instruction}\nSubtitle: ${step.subtitle || 'Strategy&'}\n\nReturn ONLY JSON: {"title": "...", "subtitle": "..."}`;
      const coverResult = await chatCompletions(genModel, 'You generate cover slide metadata. Return ONLY valid JSON with title and subtitle.', coverPrompt, {
        max_tokens: 250, temperature: 0.2, label: `slide-${i + 1}-cover`,
      });
      generatedSlides.push({ index: i, type: 'cover', title: step.title, content: coverResult.content });
      log(`  Cover: "${step.title}"`);
      continue;
    }

    // Build the generation prompt (matches what AIChatbot sends)
    let genPrompt = step.instruction || userPrompt;

    // Prepend structured fields if available
    if (step.title) genPrompt = `TITLE: ${step.title}\nSUBTITLE: ${step.subtitle || ''}\n${genPrompt}`;
    if (step.facts?.length) genPrompt += '\n\nKey facts:\n' + step.facts.map(f => `- ${f}`).join('\n');
    if (step.sources?.length) {
      genPrompt += '\n\nSources:\n' + step.sources.map(s =>
        typeof s === 'string' ? `- ${s}` : `- ${s.label}: ${s.url}${s.note ? ` (${s.note})` : ''}`
      ).join('\n');
    }

    // Append vibe hint and layout guidance
    genPrompt += `\n\n${VIBE_HINT}`;
    if (step.layoutGuidance) genPrompt += `\n\nLayout: ${step.layoutGuidance}`;

    const slideResult = await chatCompletions(genModel, freestyleGuide, genPrompt, {
      max_tokens: 65536, temperature: 0.1, label: `slide-${i + 1}-freestyle`,
    });

    generatedSlides.push({
      index: i, type: 'freestyle',
      title: step.title || '(from HTML)',
      html_length: slideResult.content.length,
      content: slideResult.content,
    });
    log(`  Generated: ${slideResult.content.length} chars, ${slideResult.elapsed}ms`);
  }

  // ────────────────────────────────────────────────────────────────
  // Write summary
  // ────────────────────────────────────────────────────────────────
  log('\n' + '='.repeat(80));
  log('SUMMARY');
  log('='.repeat(80));

  let totalTime = 0;
  for (const s of summary) {
    totalTime += s.elapsed_ms;
    log(`  ${String(s.call).padStart(2)}) ${s.label.padEnd(25)} ${s.model.padEnd(45)} ${String(s.elapsed_ms).padStart(6)}ms  in=${s.input_chars}  out=${s.output_chars}`);
  }
  log(`${''.padStart(80, '-')}`);
  log(`  Total API calls: ${summary.length}`);
  log(`  Total time:      ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s) — sequential, not parallel`);
  log(`  Note: In the app, groups execute in parallel, so wall time is lower.`);

  // Write summary file
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({
    prompt: userPrompt, speedMode: speedFlag, genModel,
    classification, planSteps: plan.length, totalCalls: summary.length,
    totalTime_ms: totalTime, calls: summary,
  }, null, 2));

  // Write all generated HTML to one file for easy viewing
  const allHtml = generatedSlides.map((s, i) =>
    `\n${'='.repeat(80)}\nSLIDE ${i + 1}: ${s.title}\nType: ${s.type}  |  Chars: ${s.content.length}\n${'='.repeat(80)}\n${s.content}`
  ).join('\n');
  fs.writeFileSync(path.join(outDir, 'all-slides.txt'), allHtml);

  log(`\nFull output in: ${outDir}`);
  log(`  - One JSON file per API call (full request + response)`);
  log(`  - summary.json — overview of all calls`);
  log(`  - all-slides.txt — generated HTML for all slides`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
