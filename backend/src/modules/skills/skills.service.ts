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
const CATEGORY_MAP: Record<string, { category: string; order: number }> = {
  proposal_development: { category: 'Skills Showcase', order: 10 },
  stakeholder_engagement_plan: { category: 'Skills Showcase', order: 11 },

  corporate_strategy_full_strategic_plan: { category: 'Skills Showcase', order: 20 },
  organization_design_end_to_end: { category: 'Skills Showcase', order: 21 },
  target_operating_model_design_and_activation_blueprint: { category: 'Skills Showcase', order: 22 },
  change_management_and_communication_plan: { category: 'Skills Showcase', order: 23 },
  cost_transformation_diagnostic_and_value_capture_plan: { category: 'Skills Showcase', order: 25 },
  business_case_narrative: { category: 'Skills Showcase', order: 26 },

  sector_development_strategy_and_implementation_playbook: { category: 'Skills Showcase', order: 30 },
  destination_development_strategy_and_business_plan: { category: 'Skills Showcase', order: 31 },
  biotech_life_sciences_cluster_strategy_and_feasibility: { category: 'Skills Showcase', order: 32 },
  telco_b2b_partnership_and_joint_go_to_market_strategy: { category: 'Skills Showcase', order: 33 },
  local_content_industrial_localization_strategy: { category: 'Skills Showcase', order: 34 },

  holding_company_subsidiary_governance_and_incorporation_plan: { category: 'Skills Showcase', order: 40 },
  regulatory_legislative_reform_strategy_and_implementation_plan: { category: 'Skills Showcase', order: 41 },

  kick_off_workplan_and_data_request_pack: { category: 'Skills Showcase', order: 50 },
  weekly_steerco_pmo_status_deck: { category: 'Skills Showcase', order: 51 },

  // Business Case & Value (from Edwin_Business_Case_Value_Risk_Pack)
  business_case_development: { category: 'Business Case & Value', order: 100 },
  cost_optimization_efficiency: { category: 'Business Case & Value', order: 101 },
  financial_case_scenario_and_sensitivity_framing: { category: 'Business Case & Value', order: 102 },
  options_evaluation_and_recommendation: { category: 'Business Case & Value', order: 103 },
  procurement_supply_chain_strategy: { category: 'Business Case & Value', order: 104 },
  risk_strategy_enterprise_risk: { category: 'Business Case & Value', order: 105 },
  value_creation_initiative_portfolio_design: { category: 'Business Case & Value', order: 106 },

  // Operating Model & Governance (from Edwin_Operating_Model_Organization_Governance_Pack)
  functional_statements_and_org_detailing: { category: 'Operating Model & Governance', order: 200 },
  governance_and_decision_rights: { category: 'Operating Model & Governance', order: 201 },
  operating_model: { category: 'Operating Model & Governance', order: 202 },
  organization_design: { category: 'Operating Model & Governance', order: 203 },
  performance_management: { category: 'Operating Model & Governance', order: 204 },
  process_and_service_delivery_design: { category: 'Operating Model & Governance', order: 205 },
  shared_services_centralization_model: { category: 'Operating Model & Governance', order: 206 },
  workforce_people_strategy: { category: 'Operating Model & Governance', order: 207 },

  // Transformation & Execution (from Edwin_Transformation_and_Execution_Pack)
  benefits_tracking_and_realization: { category: 'Transformation & Execution', order: 300 },
  board_final_readout_pack: { category: 'Transformation & Execution', order: 301 },
  change_management_and_adoption: { category: 'Transformation & Execution', order: 302 },
  governance_cadence_decision_forums: { category: 'Transformation & Execution', order: 303 },
  implementation_activation_pmo: { category: 'Transformation & Execution', order: 304 },
  kick_off_mobilization_pack: { category: 'Transformation & Execution', order: 305 },
  transformation_strategy: { category: 'Transformation & Execution', order: 306 },

  // Stakeholder & Workshop (from Edwin_Stakeholder_Workshop_Engagement_Pack)
  investor_partner_engagement: { category: 'Stakeholder & Workshop', order: 400 },
  policy_public_consultation_model: { category: 'Stakeholder & Workshop', order: 401 },
  stakeholder_communication_planning: { category: 'Stakeholder & Workshop', order: 402 },
  teaming_and_client_counterpart_model: { category: 'Stakeholder & Workshop', order: 403 },
  workshop_design_and_facilitation: { category: 'Stakeholder & Workshop', order: 404 },

  // Commercial & Customer (from Edwin_Commercial_Market_Customer_Pack)
  commercial_due_diligence_market_attractiveness: { category: 'Commercial & Customer', order: 500 },
  customer_commercial_strategy: { category: 'Commercial & Customer', order: 501 },
  go_to_market_channel_strategy: { category: 'Commercial & Customer', order: 502 },
  market_assessment: { category: 'Commercial & Customer', order: 503 },
  opportunity_sizing_revenue_pool_analysis: { category: 'Commercial & Customer', order: 504 },
  pricing_and_monetization_strategy: { category: 'Commercial & Customer', order: 505 },
  value_proposition_and_offering_design: { category: 'Commercial & Customer', order: 506 },

  // Proposals & Craft (from Edwin_Proposals_Communication_Consulting_Craft_Pack)
  baseline_as_is_diagnostic: { category: 'Proposals & Craft', order: 600 },
  benchmarking_peer_comparison_gap_analysis: { category: 'Proposals & Craft', order: 601 },
  executive_communication_top_down_storyline: { category: 'Proposals & Craft', order: 602 },
  executive_summary_and_synthesis: { category: 'Proposals & Craft', order: 603 },
  proposal_approach_and_workplan: { category: 'Proposals & Craft', order: 604 },
  team_structure_and_qa_governance: { category: 'Proposals & Craft', order: 605 },
  why_strategy_and: { category: 'Proposals & Craft', order: 606 },

  // Strategy & Thematic (from Edwin_Strategy_Thematic_End_to_End_Pack)
  corporate_strategy: { category: 'Strategy & Thematic', order: 700 },
  digital_technology_strategy: { category: 'Strategy & Thematic', order: 701 },
  growth_strategy: { category: 'Strategy & Thematic', order: 702 },
  investment_portfolio_strategy: { category: 'Strategy & Thematic', order: 703 },
  localization_local_content_strategy: { category: 'Strategy & Thematic', order: 704 },
  policy_and_regulatory_strategy: { category: 'Strategy & Thematic', order: 705 },
  sector_strategy: { category: 'Strategy & Thematic', order: 706 },
  sustainability_esg_strategy: { category: 'Strategy & Thematic', order: 707 },
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
