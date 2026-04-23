import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger';

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  order: number;
}

interface SkillRecord extends SkillMetadata {
  body: string;
}

const SKILLS_DIR = path.join(process.cwd(), 'skills');

// Category and ordering driven by skill id. Only ids present here are exposed
// via the HTTP API and can be injected by the AI proxy. Markdown files that
// exist on disk but are not in this map stay on disk but are not surfaced to
// users -- re-expose by adding an entry.
//
// Eight flat categories rendered in the order defined by their order ranges.
// "Strategic and Financial Decision Support" and "Value Creation and
// Performance" are standalone categories (formerly two halves of a single
// Business Case & Value group).
const STRATEGIC_DECISION = 'Strategic and Financial Decision Support';
const VALUE_PERFORMANCE = 'Value Creation and Performance';

const CATEGORY_MAP: Record<string, { category: string; order: number }> = {
  // 1. Strategy -- corporate/sector/digital/sustainability/policy strategy playbooks.
  biotech_life_sciences_cluster_strategy_and_feasibility: { category: 'Strategy', order: 100 },
  corporate_strategy: { category: 'Strategy', order: 101 },
  corporate_strategy_full_strategic_plan: { category: 'Strategy', order: 102 },
  destination_development_strategy_and_business_plan: { category: 'Strategy', order: 103 },
  digital_technology_strategy: { category: 'Strategy', order: 104 },
  growth_strategy: { category: 'Strategy', order: 105 },
  investment_portfolio_strategy: { category: 'Strategy', order: 106 },
  local_content_industrial_localization_strategy: { category: 'Strategy', order: 107 },
  localization_local_content_strategy: { category: 'Strategy', order: 108 },
  policy_and_regulatory_strategy: { category: 'Strategy', order: 109 },
  regulatory_legislative_reform_strategy_and_implementation_plan: { category: 'Strategy', order: 110 },
  sector_development_strategy_and_implementation_playbook: { category: 'Strategy', order: 111 },
  sector_strategy: { category: 'Strategy', order: 112 },
  sustainability_esg_strategy: { category: 'Strategy', order: 113 },

  // 2. Commercial & Customer -- market, customer, pricing, go-to-market.
  commercial_due_diligence_market_attractiveness: { category: 'Commercial & Customer', order: 200 },
  customer_commercial_strategy: { category: 'Commercial & Customer', order: 201 },
  go_to_market_channel_strategy: { category: 'Commercial & Customer', order: 202 },
  market_assessment: { category: 'Commercial & Customer', order: 203 },
  opportunity_sizing_revenue_pool_analysis: { category: 'Commercial & Customer', order: 204 },
  pricing_and_monetization_strategy: { category: 'Commercial & Customer', order: 205 },
  telco_b2b_partnership_and_joint_go_to_market_strategy: { category: 'Commercial & Customer', order: 206 },
  value_proposition_and_offering_design: { category: 'Commercial & Customer', order: 207 },

  // 3. Operating Model & Governance -- org design, TOM, governance, process, people.
  functional_statements_and_org_detailing: { category: 'Operating Model & Governance', order: 300 },
  governance_and_decision_rights: { category: 'Operating Model & Governance', order: 301 },
  holding_company_subsidiary_governance_and_incorporation_plan: { category: 'Operating Model & Governance', order: 302 },
  operating_model: { category: 'Operating Model & Governance', order: 303 },
  organization_design: { category: 'Operating Model & Governance', order: 304 },
  organization_design_end_to_end: { category: 'Operating Model & Governance', order: 305 },
  performance_management: { category: 'Operating Model & Governance', order: 306 },
  process_and_service_delivery_design: { category: 'Operating Model & Governance', order: 307 },
  shared_services_centralization_model: { category: 'Operating Model & Governance', order: 308 },
  target_operating_model_design_and_activation_blueprint: { category: 'Operating Model & Governance', order: 309 },
  workforce_people_strategy: { category: 'Operating Model & Governance', order: 310 },

  // 4. Strategic and Financial Decision Support -- business case, feasibility, options.
  business_case_development: { category: STRATEGIC_DECISION, order: 400 },
  business_case_narrative: { category: STRATEGIC_DECISION, order: 401 },
  financial_case_scenario_and_sensitivity_framing: { category: STRATEGIC_DECISION, order: 402 },
  options_evaluation_and_recommendation: { category: STRATEGIC_DECISION, order: 403 },

  // 5. Value Creation and Performance -- cost, value capture, procurement, risk.
  cost_optimization_efficiency: { category: VALUE_PERFORMANCE, order: 500 },
  cost_transformation_diagnostic_and_value_capture_plan: { category: VALUE_PERFORMANCE, order: 501 },
  procurement_supply_chain_strategy: { category: VALUE_PERFORMANCE, order: 502 },
  risk_strategy_enterprise_risk: { category: VALUE_PERFORMANCE, order: 503 },
  value_creation_initiative_portfolio_design: { category: VALUE_PERFORMANCE, order: 504 },

  // 6. Transformation & Execution -- mobilization, PMO, change, benefits, readouts.
  benefits_tracking_and_realization: { category: 'Transformation & Execution', order: 600 },
  board_final_readout_pack: { category: 'Transformation & Execution', order: 601 },
  change_management_and_adoption: { category: 'Transformation & Execution', order: 602 },
  change_management_and_communication_plan: { category: 'Transformation & Execution', order: 603 },
  governance_cadence_decision_forums: { category: 'Transformation & Execution', order: 604 },
  implementation_activation_pmo: { category: 'Transformation & Execution', order: 605 },
  kick_off_mobilization_pack: { category: 'Transformation & Execution', order: 606 },
  kick_off_workplan_and_data_request_pack: { category: 'Transformation & Execution', order: 607 },
  transformation_strategy: { category: 'Transformation & Execution', order: 608 },
  weekly_steerco_pmo_status_deck: { category: 'Transformation & Execution', order: 609 },

  // 7. Stakeholder & Workshop -- stakeholder, investor, consultation, workshop.
  investor_partner_engagement: { category: 'Stakeholder & Workshop', order: 700 },
  policy_public_consultation_model: { category: 'Stakeholder & Workshop', order: 701 },
  stakeholder_communication_planning: { category: 'Stakeholder & Workshop', order: 702 },
  stakeholder_engagement_plan: { category: 'Stakeholder & Workshop', order: 703 },
  teaming_and_client_counterpart_model: { category: 'Stakeholder & Workshop', order: 704 },
  workshop_design_and_facilitation: { category: 'Stakeholder & Workshop', order: 705 },

  // 8. Proposal and Executive Communication -- proposals, diagnostic, exec storyline.
  baseline_as_is_diagnostic: { category: 'Proposal and Executive Communication', order: 800 },
  benchmarking_peer_comparison_gap_analysis: { category: 'Proposal and Executive Communication', order: 801 },
  executive_communication_top_down_storyline: { category: 'Proposal and Executive Communication', order: 802 },
  executive_summary_and_synthesis: { category: 'Proposal and Executive Communication', order: 803 },
  proposal_approach_and_workplan: { category: 'Proposal and Executive Communication', order: 804 },
  proposal_development: { category: 'Proposal and Executive Communication', order: 805 },
  team_structure_and_qa_governance: { category: 'Proposal and Executive Communication', order: 806 },
  why_strategy_and: { category: 'Proposal and Executive Communication', order: 807 },
};

const skillCache = new Map<string, SkillRecord>();
let loaded = false;

function slugToTitle(slug: string): string {
  return slug
    .split('_')
    .map(word => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function extractTitle(markdown: string, fallback: string): string {
  const firstLine = markdown.split('\n').find(line => line.trim().startsWith('# '));
  if (firstLine) {
    return firstLine.replace(/^#\s+/, '').trim();
  }
  return fallback;
}

function extractDescription(markdown: string): string {
  const lines = markdown.split('\n');
  const headingIdx = lines.findIndex(line => /^##\s+When to use this skill/i.test(line.trim()));
  if (headingIdx === -1) {
    const firstPara = markdown.split(/\n\s*\n/).find(block => block.trim() && !block.trim().startsWith('#'));
    return firstPara ? collapseWhitespace(firstPara).slice(0, 260) : '';
  }
  const bodyLines: string[] = [];
  for (let i = headingIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line.trim())) break;
    bodyLines.push(line);
  }
  const paragraph = bodyLines.join('\n').split(/\n\s*\n/).find(block => block.trim()) || '';
  return collapseWhitespace(paragraph).slice(0, 260);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildRecord(filename: string): SkillRecord | null {
  const id = filename.replace(/\.md$/i, '');
  const meta = CATEGORY_MAP[id];
  // Skills not in the map stay on disk but are not exposed.
  if (!meta) return null;

  const fullPath = path.join(SKILLS_DIR, filename);
  let body: string;
  try {
    body = fs.readFileSync(fullPath, 'utf8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Skills: failed to read ${filename}: ${msg}`);
    return null;
  }

  const name = extractTitle(body, slugToTitle(id));
  const description = extractDescription(body);

  return {
    id,
    name,
    description,
    category: meta.category,
    order: meta.order,
    body,
  };
}

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  if (!fs.existsSync(SKILLS_DIR)) {
    logger.warn(`Skills: directory not found at ${SKILLS_DIR}, skipping load`);
    return;
  }
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.toLowerCase().endsWith('.md'));
  for (const file of files) {
    const record = buildRecord(file);
    if (record) {
      skillCache.set(record.id, record);
    }
  }
  const exposed = skillCache.size;
  const onDisk = files.length;
  logger.info(`Skills: loaded ${exposed} of ${onDisk} file(s) from ${SKILLS_DIR} (others not in CATEGORY_MAP)`);
}

export function listSkillMetadata(): SkillMetadata[] {
  ensureLoaded();
  return Array.from(skillCache.values())
    .map(({ body: _body, ...meta }) => meta)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function getSkillBody(id: string): string | null {
  ensureLoaded();
  const record = skillCache.get(id);
  return record ? record.body : null;
}

export function getSkillMetadata(id: string): SkillMetadata | null {
  ensureLoaded();
  const record = skillCache.get(id);
  if (!record) return null;
  const { body: _body, ...meta } = record;
  return meta;
}
