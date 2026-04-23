#!/usr/bin/env node
// One-off importer for the Edwin_* skill packs produced offline.
//
// For each Edwin_*_Pack directory under ~/Downloads we:
//   1. Find every *_SKILL.md (including one level of nesting used by a few
//      packs) and derive its id: lowercase filename without the _SKILL.md
//      suffix.
//   2. Write backend/skills/<id>.md with the body copied verbatim, except
//      the "## When to use" heading is renamed to "## When to use this skill"
//      (our canonical heading the service matches on for description text).
//   3. Skip when backend/skills/<id>.md already exists so we never overwrite
//      hand-tuned skills already in the repo.
//   4. After all packs are processed, print a CATEGORY_MAP snippet with
//      one `category` string per pack and monotonically increasing order
//      numbers for paste-in to skills.service.ts.
//
// Run with:
//   node backend/scripts/import-skill-packs.mjs
//
// Safe to re-run; it never clobbers and always prints a fresh snippet.

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const BACKEND_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(BACKEND_ROOT, 'skills');

// Eight flat categories that match backend/src/modules/skills/
// skills.service.ts. CATEGORY_BASE_ORDER controls both the display order of
// categories and the starting `order` value inside the printed CATEGORY_MAP
// snippet. The Business Case pack's slugs split across two categories --
// SLUG_CATEGORY_OVERRIDES maps the Value-Creation half away from the pack's
// default.
const CATEGORY_BASE_ORDER = {
  'Strategy': 100,
  'Commercial & Customer': 200,
  'Operating Model & Governance': 300,
  'Strategic and Financial Decision Support': 400,
  'Value Creation and Performance': 500,
  'Transformation & Execution': 600,
  'Stakeholder & Workshop': 700,
  'Proposal and Executive Communication': 800,
};

const SLUG_CATEGORY_OVERRIDES = {
  cost_optimization_efficiency: 'Value Creation and Performance',
  cost_transformation_diagnostic_and_value_capture_plan: 'Value Creation and Performance',
  procurement_supply_chain_strategy: 'Value Creation and Performance',
  risk_strategy_enterprise_risk: 'Value Creation and Performance',
  value_creation_initiative_portfolio_design: 'Value Creation and Performance',
};

const PACKS = [
  { dirPrefix: 'Edwin_Strategy_Thematic_End_to_End_Pack', category: 'Strategy' },
  { dirPrefix: 'Edwin_Commercial_Market_Customer_Pack', category: 'Commercial & Customer' },
  { dirPrefix: 'Edwin_Operating_Model_Organization_Governance_Pack', category: 'Operating Model & Governance' },
  { dirPrefix: 'Edwin_Business_Case_Value_Risk_Pack', category: 'Strategic and Financial Decision Support' },
  { dirPrefix: 'Edwin_Transformation_and_Execution_Pack', category: 'Transformation & Execution' },
  { dirPrefix: 'Edwin_Stakeholder_Workshop_Engagement_Pack', category: 'Stakeholder & Workshop' },
  { dirPrefix: 'Edwin_Proposals_Communication_Consulting_Craft_Pack', category: 'Proposal and Executive Communication' },
];

function slugFromFilename(filename) {
  return filename.replace(/_SKILL\.md$/i, '').toLowerCase();
}

async function findSkillFiles(packDir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(packDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(packDir, entry.name);
    if (entry.isFile() && entry.name.endsWith('_SKILL.md')) {
      out.push(full);
    } else if (entry.isDirectory()) {
      // A couple of packs nest their skill files one directory deep.
      const inner = await readdir(full, { withFileTypes: true }).catch(() => []);
      for (const innerEntry of inner) {
        if (innerEntry.isFile() && innerEntry.name.endsWith('_SKILL.md')) {
          out.push(path.join(full, innerEntry.name));
        }
      }
    }
  }
  return out;
}

function normalizeHeading(body) {
  // Rename "## When to use" (end of line or followed by whitespace) to
  // "## When to use this skill" unless the skill already uses the canonical
  // phrasing. Only the first occurrence is touched.
  if (/^##\s+When to use this skill\b/im.test(body)) return body;
  return body.replace(/^##\s+When to use\s*$/m, '## When to use this skill');
}

async function importPack(pack) {
  const packDir = path.join(DOWNLOADS_DIR, pack.dirPrefix);
  if (!existsSync(packDir)) {
    console.warn(`[skip] Pack dir not found: ${packDir}`);
    return { pack, imported: [], skipped: [] };
  }
  const skillFiles = await findSkillFiles(packDir);
  skillFiles.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  const imported = [];
  const skipped = [];

  for (const src of skillFiles) {
    const slug = slugFromFilename(path.basename(src));
    const dest = path.join(SKILLS_DIR, `${slug}.md`);
    if (existsSync(dest)) {
      skipped.push({ slug, reason: 'already exists' });
      continue;
    }
    const raw = await readFile(src, 'utf8');
    const normalized = normalizeHeading(raw);
    await writeFile(dest, normalized, 'utf8');
    imported.push(slug);
  }

  return { pack, imported, skipped };
}

function resolveCategory(slug, pack) {
  return SLUG_CATEGORY_OVERRIDES[slug] || pack.category;
}

function fmtCategoryBlock(category, slugs) {
  const base = CATEGORY_BASE_ORDER[category];
  if (base === undefined) {
    console.warn(`[warn] Unknown category '${category}' has no base order`);
  }
  const lines = [`  // ${category}`];
  slugs.forEach((slug, idx) => {
    const order = (base ?? 0) + idx;
    lines.push(`  ${slug}: { category: '${category}', order: ${order} },`);
  });
  return lines.join('\n');
}

async function main() {
  const statRes = await stat(SKILLS_DIR).catch(() => null);
  if (!statRes || !statRes.isDirectory()) {
    console.error(`[fail] Skills directory does not exist: ${SKILLS_DIR}`);
    process.exit(1);
  }
  console.log(`Importing skill packs from ${DOWNLOADS_DIR}`);
  console.log(`Target skills directory: ${SKILLS_DIR}`);
  console.log('');

  const results = [];
  for (const pack of PACKS) {
    const result = await importPack(pack);
    const summary = `${pack.dirPrefix}: imported ${result.imported.length}, skipped ${result.skipped.length}`;
    console.log(summary);
    if (result.skipped.length > 0) {
      for (const s of result.skipped) console.log(`  - skip ${s.slug} (${s.reason})`);
    }
    results.push(result);
  }

  // Aggregate across packs so the printed snippet is grouped by category
  // (pack -> category is not 1:1 anymore after the 2026 remap).
  const byCategory = new Map();
  for (const result of results) {
    for (const slug of result.imported) {
      const category = resolveCategory(slug, result.pack);
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(slug);
    }
  }

  console.log('\n' + '='.repeat(72));
  console.log('CATEGORY_MAP snippet (paste into backend/src/modules/skills/skills.service.ts):');
  console.log('='.repeat(72));
  const categoryOrder = Object.keys(CATEGORY_BASE_ORDER);
  for (const category of categoryOrder) {
    const slugs = byCategory.get(category);
    if (!slugs || slugs.length === 0) continue;
    slugs.sort();
    console.log('');
    console.log(fmtCategoryBlock(category, slugs));
  }
  console.log('');
}

main().catch((err) => {
  console.error('[fail]', err);
  process.exit(1);
});
