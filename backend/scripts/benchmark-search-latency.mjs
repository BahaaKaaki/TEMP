#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const raw = fs.readFileSync(envPath, 'utf8');
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const k = m[1].trim();
  let v = m[2].trim().replace(/^["']|["']$/g, '');
  if (process.env[k] === undefined) process.env[k] = v;
}

const BASE = (process.env.PWC_API_BASE_URL || 'https://genai-sharedservice-emea.pwcinternal.com').replace(/\/$/, '');
const KEY = process.env.PWC_API_KEY;
if (!KEY) {
  console.error('Missing PWC_API_KEY');
  process.exit(1);
}

const PROMPT =
  'Brief answer only (under 120 words): What is the latest IMF World Economic Outlook ' +
  'projection for global GDP growth in 2025? Name the source and date.';

function countSearchCalls(data) {
  let n = 0;
  const out = data?.output;
  if (!Array.isArray(out)) return 0;
  for (const item of out) {
    if (item?.type === 'web_search_call') n += 1;
  }
  return n;
}

async function responsesSearch({ model, reasoningEffort, searchContextSize, maxOutputTokens = 2500 }) {
  const body = {
    model,
    input: PROMPT,
    max_output_tokens: maxOutputTokens,
    tools: [{ type: 'web_search_preview', search_context_size: searchContextSize }],
  };
  if (reasoningEffort && reasoningEffort !== 'none') {
    body.reasoning = { effort: reasoningEffort };
  }

  const t0 = performance.now();
  const res = await fetch(`${BASE}/v1/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const ms = Math.round(performance.now() - t0);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: res.ok, ms, status: res.status, searchCalls: 0, err: text.slice(0, 200) };
  }
  const errMsg = json?.error?.message || json?.message || '';
  return {
    ok: res.ok,
    ms,
    status: res.status,
    searchCalls: countSearchCalls(json),
    usage: json?.usage || null,
    err: res.ok ? '' : errMsg || text.slice(0, 300),
  };
}

async function chatGeminiSearch({ model }) {
  const body = {
    model,
    messages: [{ role: 'user', content: PROMPT }],
    tools: [{ google_search: {} }],
    max_tokens: 2500,
  };
  const t0 = performance.now();
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const ms = Math.round(performance.now() - t0);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: res.ok, ms, status: res.status, err: text.slice(0, 200) };
  }
  return {
    ok: res.ok,
    ms,
    status: res.status,
    usage: json?.usage || null,
    err: res.ok ? '' : (json?.error?.message || text.slice(0, 300)),
  };
}

async function chatClaudeNoSearch({ model }) {
  const body = {
    model,
    messages: [{ role: 'user', content: PROMPT }],
    max_tokens: 800,
  };
  const t0 = performance.now();
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const ms = Math.round(performance.now() - t0);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: res.ok, ms, status: res.status, err: text.slice(0, 200) };
  }
  return {
    ok: res.ok,
    ms,
    status: res.status,
    usage: json?.usage || null,
    err: res.ok ? '' : (json?.error?.message || text.slice(0, 300)),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const OPENAI_MODELS = ['openai.gpt-5.5', 'openai.gpt-5.4-mini', 'openai.gpt-5.4-nano'];
const REASONING = ['none', 'low', 'medium', 'high'];
const SEARCH_CTX = ['low', 'medium', 'high'];

console.log('PWC benchmark: Responses API + web_search_preview');
console.log('Base:', BASE);
console.log('');

const rows = [];

for (const model of OPENAI_MODELS) {
  for (const r of REASONING) {
    for (const s of SEARCH_CTX) {
      process.stdout.write(`${model} reasoning=${r} search_ctx=${s} ... `);
      const result = await responsesSearch({ model, reasoningEffort: r, searchContextSize: s });
      rows.push({ kind: 'responses+search', model, reasoning: r, searchCtx: s, ...result });
      if (result.ok) {
        console.log(`${result.ms}ms searchCalls=${result.searchCalls}`);
      } else {
        console.log(`FAIL ${result.status} ${(result.err || '').slice(0, 100)}`);
      }
      await sleep(1500);
    }
  }
}

console.log('');
console.log('--- Gemini Chat Completions + google_search ---');
for (const model of ['vertex_ai.gemini-2.5-flash', 'vertex_ai.gemini-3.1-flash-lite-preview']) {
  process.stdout.write(`${model} ... `);
  const result = await chatGeminiSearch({ model });
  rows.push({ kind: 'gemini+google_search', model, ...result });
  console.log(result.ok ? `${result.ms}ms` : `FAIL ${result.status} ${(result.err || '').slice(0, 100)}`);
  await sleep(1500);
}

console.log('');
console.log('--- Claude Chat Completions (no web search tool) ---');
for (const model of ['bedrock.anthropic.claude-sonnet-4-6', 'bedrock.anthropic.claude-haiku-4-5']) {
  process.stdout.write(`${model} ... `);
  const result = await chatClaudeNoSearch({ model });
  rows.push({ kind: 'claude_chat', model, ...result });
  console.log(result.ok ? `${result.ms}ms` : `FAIL ${result.status} ${(result.err || '').slice(0, 100)}`);
  await sleep(1500);
}

console.log('');
console.log('=== Fastest 15 (Responses+search OK) ===');
const okRows = rows.filter((x) => x.kind === 'responses+search' && x.ok).sort((a, b) => a.ms - b.ms);
for (const x of okRows.slice(0, 15)) {
  console.log(`${x.ms}ms\t${x.model}\tr=${x.reasoning}\ts=${x.searchCtx}\tcalls=${x.searchCalls}`);
}
console.log('');
console.log('=== Slowest 5 (Responses+search OK) ===');
const slow = okRows.slice(-5);
for (const x of slow) {
  console.log(`${x.ms}ms\t${x.model}\tr=${x.reasoning}\ts=${x.searchCtx}\tcalls=${x.searchCalls}`);
}
