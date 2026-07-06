/**
 * Knowledge Base Seed Examples
 *
 * Curated examples for each KB category. These serve as:
 * 1. Demo data so users can immediately test "build a CV for X" or "show AI credentials"
 * 2. RAG retrieval targets — the bot searches these and pulls relevant ones into context
 * 3. Reference patterns for users to understand what good KB entries look like
 *
 * Categories: cvs, qualifications, case_studies, products, company
 */

// ─── Team CVs & Profiles ────────────────────────────────────────────────────

export const CV_EXAMPLES = [
  {
    name: 'Sarah Mitchell',
    title: 'Partner, Digital Transformation',
    experience: '18 years in management consulting. Led 40+ digital transformation programs across financial services, healthcare, and retail. Former CTO at a Series C fintech. Board advisor to three AI startups.',
    skills: 'Digital Strategy, AI/ML Implementation, Cloud Migration, Operating Model Design, Change Management, Agile at Scale, Enterprise Architecture',
    education: 'MBA, Harvard Business School | BSc Computer Science, MIT',
    summary: 'Sarah leads our Digital Transformation practice, specializing in helping Fortune 500 companies modernize their technology stacks and operating models. She has driven over $2B in measurable client value through technology-enabled business transformations. Known for bridging the gap between business strategy and technical execution.',
    tags: ['digital', 'AI', 'transformation', 'partner', 'technology', 'fintech', 'healthcare'],
  },
  {
    name: 'James Chen',
    title: 'Director, Data & Analytics',
    experience: '14 years spanning data science, analytics strategy, and AI implementation. Previously VP of Data at a Fortune 100 retailer. Published researcher in applied machine learning. Speaker at NeurIPS and Strata.',
    skills: 'Advanced Analytics, Machine Learning, Data Strategy, Data Governance, GenAI, MLOps, Python, Cloud Data Platforms (Snowflake, Databricks, BigQuery)',
    education: 'PhD Machine Learning, Stanford University | MSc Statistics, UC Berkeley',
    summary: 'James leads data and analytics engagements, helping organizations build world-class data capabilities. He has designed and deployed ML systems serving 100M+ users and built analytics teams from 5 to 200+ people. His approach combines deep technical expertise with pragmatic business thinking.',
    tags: ['data', 'analytics', 'AI', 'machine learning', 'director', 'GenAI', 'MLOps'],
  },
  {
    name: 'Maria Rodriguez',
    title: 'Senior Manager, Strategy & Operations',
    experience: '10 years in strategy consulting with focus on operational excellence and cost transformation. Led programs delivering $500M+ in savings for clients in energy, manufacturing, and logistics.',
    skills: 'Cost Transformation, Supply Chain Optimization, Process Improvement, Lean Six Sigma, Procurement Strategy, M&A Integration, Business Case Development',
    education: 'MBA, INSEAD | BEng Industrial Engineering, Georgia Tech',
    summary: 'Maria specializes in helping organizations achieve step-change improvements in operational performance. She brings a data-driven approach to identifying and capturing value across the enterprise, with particular expertise in post-merger integration and supply chain transformation.',
    tags: ['strategy', 'operations', 'cost', 'supply chain', 'M&A', 'transformation'],
  },
  {
    name: 'David Park',
    title: 'Manager, Cybersecurity & Risk',
    experience: '8 years in cybersecurity consulting and risk management. Former security architect at a major cloud provider. CISSP, CISM, and CRISC certified. Led incident response for three Fortune 500 breaches.',
    skills: 'Cybersecurity Strategy, Risk Assessment, Cloud Security, Zero Trust Architecture, Incident Response, Regulatory Compliance (SOX, GDPR, HIPAA), Security Operations',
    education: 'MSc Information Security, Carnegie Mellon | BSc Computer Engineering, University of Michigan',
    summary: 'David helps organizations build resilient security programs that enable business growth. He specializes in designing security architectures for cloud-native environments and building security operating models that balance risk with agility.',
    tags: ['cybersecurity', 'risk', 'cloud', 'security', 'compliance', 'zero trust'],
  },
  {
    name: 'Elena Vasquez',
    title: 'Senior Consultant, People & Organization',
    experience: '6 years in organizational design, talent strategy, and change management. Background in I/O psychology. Certified executive coach. Led workforce transformation programs for 10,000+ employee organizations.',
    skills: 'Organizational Design, Change Management, Talent Strategy, Workforce Planning, Culture Transformation, Executive Coaching, HR Technology, People Analytics',
    education: 'MSc Organizational Psychology, Columbia University | BA Psychology, Yale University',
    summary: 'Elena focuses on the human side of transformation, helping organizations redesign their structures, develop their talent, and manage complex change programs. She brings a research-backed approach to organizational effectiveness.',
    tags: ['people', 'organization', 'change management', 'talent', 'culture', 'HR'],
  },
  {
    name: 'Robert Nakamura',
    title: 'Partner, Financial Services',
    experience: '20 years in financial services consulting. Former Managing Director at a top-3 investment bank. Advises C-suite leaders on regulatory strategy, digital banking, and business model innovation. Led the largest core banking transformation in APAC.',
    skills: 'Financial Services Strategy, Regulatory Advisory, Digital Banking, Payments, Capital Markets, Core Banking Transformation, FinTech Partnership Strategy',
    education: 'MBA, Wharton School | CFA Charterholder | BA Economics, University of Tokyo',
    summary: 'Robert is a recognized leader in financial services, advising banks, insurers, and asset managers on their most critical strategic challenges. He has deep expertise in the intersection of regulation, technology, and business model transformation.',
    tags: ['finance', 'banking', 'partner', 'regulatory', 'fintech', 'payments', 'capital markets'],
  },
];

// ─── Case Studies / Credentials ─────────────────────────────────────────────

export const CASE_STUDY_EXAMPLES = [
  {
    title: 'AI-Powered Customer Service Transformation',
    client: 'Global Telecommunications Provider',
    industry: 'Telecommunications',
    challenge: 'The client handled 45M customer interactions annually with 12,000 agents across 8 call centers. Average handle time was 14 minutes, CSAT scores were declining, and agent attrition exceeded 40% annually. The client needed to radically improve service quality while reducing costs.',
    solution: 'Designed and implemented an AI-first customer service operating model. Deployed conversational AI handling 60% of routine inquiries autonomously. Built an agent-assist platform providing real-time recommendations, knowledge retrieval, and automated post-call work. Redesigned the workforce model with new roles, skills, and career paths for the AI-augmented environment.',
    results: 'Achieved 35% reduction in cost-to-serve within 18 months. CSAT improved from 3.2 to 4.1 (out of 5). Average handle time reduced by 40%. Agent attrition dropped to 22%. The AI system now handles 27M interactions annually with 92% resolution rate.',
    tags: ['AI', 'customer service', 'transformation', 'telecommunications', 'cost reduction', 'GenAI'],
  },
  {
    title: 'Enterprise Data Platform Modernization',
    client: 'Top-5 US Health Insurer',
    industry: 'Healthcare / Insurance',
    challenge: 'Legacy data infrastructure with 200+ data sources, 15 data warehouses, and 3,000+ reports created over 20 years. Data quality issues caused $50M+ annually in claim processing errors. Analytics teams spent 70% of their time on data preparation rather than insight generation.',
    solution: 'Designed a cloud-native data mesh architecture on Snowflake and Databricks. Migrated critical data products in 6-month sprints. Implemented data quality framework with automated monitoring. Built a self-service analytics platform enabling business users to access trusted data without IT involvement. Established a data governance operating model with federated domain ownership.',
    results: 'Reduced data preparation time by 80%. Claim processing errors reduced by 65%, saving $32M annually. Time-to-insight for new analytics requests decreased from 6 weeks to 2 days. Retired 12 of 15 legacy warehouses, reducing infrastructure costs by $18M annually.',
    tags: ['data', 'analytics', 'cloud', 'healthcare', 'insurance', 'modernization', 'data mesh'],
  },
  {
    title: 'Post-Merger Integration for Industrial Conglomerate',
    client: 'European Industrial Manufacturing Group',
    industry: 'Manufacturing',
    challenge: 'Following a $4.2B acquisition, the client needed to integrate two organizations with 35,000 employees across 22 countries. Cultures were very different — one was a 150-year-old family business, the other a PE-backed high-growth company. Synergy targets of $380M required rapid execution while maintaining business continuity.',
    solution: 'Led the Integration Management Office (IMO) with 12 workstreams spanning IT, operations, commercial, people, and finance. Designed the combined operating model and org structure. Executed procurement synergies through category-level negotiations. Drove cultural integration through a structured program with 500+ change champions.',
    results: 'Captured $420M in synergies (110% of target) within 24 months. Zero unplanned executive departures during integration. Revenue grew 8% in Year 1 vs. 3% industry average. Named "Integration of the Year" by M&A industry association.',
    tags: ['M&A', 'integration', 'manufacturing', 'operations', 'cost', 'synergies', 'change management'],
  },
  {
    title: 'Digital Banking Platform Launch',
    client: 'Mid-Tier Regional Bank (US)',
    industry: 'Financial Services',
    challenge: 'The bank was losing market share to neobanks and large national competitors. Its mobile app had a 2.1-star rating, digital account opening took 22 minutes with a 68% abandonment rate, and only 15% of customers were digitally active.',
    solution: 'Defined a 3-year digital strategy and roadmap. Designed and launched a new mobile-first banking platform built on a modern API architecture. Implemented real-time payments, instant account opening (under 3 minutes), and personalized financial insights powered by AI. Ran a comprehensive digital adoption campaign targeting existing customers.',
    results: 'Digital account opening time reduced to 2.5 minutes with 12% abandonment rate. Mobile app rating improved to 4.6 stars. Digitally active customers grew from 15% to 58% in 18 months. Acquired 120,000 new digital-only customers. Cost-to-serve decreased 28%.',
    tags: ['digital', 'banking', 'fintech', 'mobile', 'financial services', 'customer experience'],
  },
  {
    title: 'Supply Chain Resilience Program',
    client: 'Global Consumer Goods Company',
    industry: 'Consumer Goods / Retail',
    challenge: 'COVID-19 exposed critical supply chain vulnerabilities. The client experienced $200M in lost revenue from stockouts, had single-source dependencies for 40% of key materials, and lacked end-to-end visibility across its supply network of 2,000+ suppliers.',
    solution: 'Built a supply chain control tower with real-time visibility across all tiers. Implemented a dual-sourcing strategy for critical materials. Designed a supply chain risk scoring model using AI/ML to predict disruptions 4-6 weeks in advance. Restructured the supply network with nearshoring for 30% of production.',
    results: 'Service levels improved from 87% to 96%. Stockout-related revenue losses reduced by 75% ($150M saved). Supply chain disruption response time decreased from 3 weeks to 3 days. Achieved 95% visibility across Tier 1 and Tier 2 suppliers.',
    tags: ['supply chain', 'resilience', 'operations', 'AI', 'consumer goods', 'risk', 'logistics'],
  },
  {
    title: 'Zero Trust Security Transformation',
    client: 'Federal Government Agency (US)',
    industry: 'Government / Public Sector',
    challenge: 'Following a major security breach that exposed 4M records, the agency was mandated to implement a Zero Trust architecture. The existing environment included 150+ legacy applications, 50,000 endpoints, and 30,000 users across 200 locations. Compliance with Executive Order 14028 was required within 24 months.',
    solution: 'Designed a comprehensive Zero Trust architecture aligned with NIST and CISA frameworks. Implemented identity-centric access controls with continuous verification. Deployed micro-segmentation across the network. Built a security operations center with AI-powered threat detection. Migrated 80% of applications to FedRAMP-authorized cloud environments.',
    results: 'Achieved full compliance with EO 14028 requirements 3 months ahead of deadline. Security incidents reduced by 70%. Mean time to detect threats decreased from 72 hours to 15 minutes. Unauthorized access attempts blocked increased by 300%. Received "Outstanding" rating from GAO security audit.',
    tags: ['cybersecurity', 'zero trust', 'government', 'compliance', 'cloud', 'security', 'public sector'],
  },
];

// ─── Qualifications & Credentials ───────────────────────────────────────────

export const QUALIFICATION_EXAMPLES = [
  {
    name: 'ISO 27001 Lead Implementer Certification',
    issuer: 'PECB / ISO',
    date: '2024-01-15',
    description: 'Firm-wide certification for information security management system (ISMS) implementation. Demonstrates our capability to help clients design, implement, and manage ISO 27001-compliant security programs. 15 certified practitioners on staff.',
    validUntil: '2027-01-15',
    tags: ['security', 'ISO', 'certification', 'compliance'],
  },
  {
    name: 'AWS Advanced Consulting Partner',
    issuer: 'Amazon Web Services',
    date: '2023-06-01',
    description: 'Top-tier AWS partnership with 50+ certified architects and 200+ completed cloud migrations. Specializations in Data & Analytics, Machine Learning, and Financial Services. Access to AWS funding programs for client projects.',
    validUntil: '2025-06-01',
    tags: ['AWS', 'cloud', 'partnership', 'technology'],
  },
  {
    name: 'Microsoft Gold Partner — AI & Data',
    issuer: 'Microsoft',
    date: '2023-09-01',
    description: 'Gold-level partnership in AI and Data competency. 40+ Azure-certified professionals. Joint go-to-market programs with Microsoft for Copilot, Azure OpenAI, and Fabric deployments. Proven track record of 100+ Azure data platform implementations.',
    validUntil: '2025-09-01',
    tags: ['Microsoft', 'Azure', 'AI', 'cloud', 'data', 'partnership'],
  },
  {
    name: 'Great Place to Work — Best Workplaces in Consulting 2024',
    issuer: 'Great Place to Work Institute',
    date: '2024-03-15',
    description: 'Ranked #7 among consulting firms globally. 92% of employees say it is a great place to work (vs. 57% industry average). Recognized for culture of innovation, professional development, and work-life balance.',
    tags: ['culture', 'award', 'workplace', 'talent'],
  },
  {
    name: 'SAP Recognized Expertise in S/4HANA',
    issuer: 'SAP',
    date: '2024-02-01',
    description: 'Recognized expertise in SAP S/4HANA implementation across manufacturing, retail, and utilities. 30+ successful S/4HANA migrations. Proprietary accelerator reduces implementation time by 30%. 60+ SAP-certified consultants.',
    validUntil: '2026-02-01',
    tags: ['SAP', 'ERP', 'S/4HANA', 'technology', 'implementation'],
  },
];

// ─── Products & Services ────────────────────────────────────────────────────

export const PRODUCT_EXAMPLES = [
  {
    name: 'StrategyAccelerator Platform',
    category: 'Digital Tools',
    description: 'Our proprietary AI-powered strategy development platform. Combines market intelligence, competitive analysis, and scenario modeling into a single interface. Used by 200+ clients to accelerate strategic planning from months to weeks.',
    features: 'AI-driven market scanning, Competitive intelligence dashboard, Scenario planning with Monte Carlo simulation, Executive-ready report generation, Real-time collaboration, Integration with internal data sources',
    benefits: 'Reduces strategy development cycle by 60%. Provides data-backed decision support. Enables continuous strategy refresh rather than annual planning cycles.',
    pricing: 'Enterprise license: $150K/year. Includes platform access for up to 50 users, quarterly model updates, and dedicated support.',
    tags: ['AI', 'strategy', 'platform', 'digital', 'product'],
  },
  {
    name: 'Digital Maturity Assessment',
    category: 'Advisory Services',
    description: 'A structured 4-week assessment that evaluates an organization\'s digital maturity across 8 dimensions: Strategy, Customer, Operations, Technology, Data, People, Innovation, and Governance. Benchmarks against 500+ organizations.',
    features: '8-dimension maturity framework, Executive interviews and workshops, Quantitative benchmarking against industry peers, Prioritized roadmap with quick wins and strategic bets, Investment business case',
    benefits: 'Clear picture of digital maturity vs. peers. Actionable roadmap with prioritized initiatives. Executive alignment on digital priorities. Business case for investment decisions.',
    pricing: 'Fixed fee: $180K-$350K depending on organization size. 4-week engagement with 2-3 consultants.',
    tags: ['digital', 'assessment', 'advisory', 'maturity', 'benchmark'],
  },
  {
    name: 'Workforce Transformation Program',
    category: 'Transformation Services',
    description: 'End-to-end workforce transformation service covering strategic workforce planning, organizational redesign, skills mapping, and change management. Designed for organizations undergoing major technology or business model shifts.',
    features: 'AI-powered skills gap analysis, Future-state organizational design, Reskilling and upskilling program design, Change management and communications, Talent marketplace implementation, People analytics dashboard',
    benefits: 'Reduces time-to-productivity for transformed roles by 40%. Improves employee retention during transformation by 25%. Ensures organizational readiness for new operating models.',
    pricing: 'Typically $500K-$2M depending on scope. 3-12 month engagement.',
    tags: ['workforce', 'transformation', 'people', 'organization', 'change', 'skills'],
  },
  {
    name: 'Cloud Cost Optimization Service',
    category: 'Technology Services',
    description: 'Specialized service to identify and capture cloud cost savings without impacting performance. Combines FinOps best practices with proprietary analysis tooling. Average client sees 30-40% reduction in cloud spend.',
    features: 'Automated cloud spend analysis, Right-sizing recommendations, Reserved instance optimization, Architectural recommendations for cost efficiency, FinOps operating model design, Ongoing monitoring and alerting',
    benefits: 'Average 35% reduction in cloud spend. Improved cost visibility and accountability. Sustainable cost management through FinOps practices.',
    pricing: 'Engagement fee: $80K-$150K. Typical ROI of 10x within first year.',
    tags: ['cloud', 'cost', 'optimization', 'FinOps', 'technology', 'AWS', 'Azure'],
  },
];

// ─── Company Information ────────────────────────────────────────────────────

export const COMPANY_EXAMPLES = [
  {
    topic: 'Firm Overview',
    content: 'We are a global strategy and management consulting firm with 5,000+ professionals across 30 offices in 18 countries. Founded in 2001, we serve clients across all major industries with a focus on creating lasting, measurable impact. Our revenue exceeds $2B annually, with consistent double-digit growth over the past decade. We are known for combining deep industry expertise with cutting-edge analytical capabilities.',
    category: 'overview',
    tags: ['overview', 'firm', 'about us'],
  },
  {
    topic: 'Our Approach',
    content: 'We believe in a "co-creation" model where we work alongside client teams rather than delivering pre-packaged solutions. Every engagement starts with understanding the client\'s unique context, builds on their existing capabilities, and leaves behind lasting organizational muscle. Our approach combines: (1) Deep industry expertise — our consultants average 12+ years of industry experience; (2) Data-driven insights — every recommendation is backed by rigorous analysis; (3) Practical execution — we stay through implementation, not just strategy; (4) Knowledge transfer — we build client capability, not dependency.',
    category: 'methodology',
    tags: ['approach', 'methodology', 'co-creation', 'values'],
  },
  {
    topic: 'Industry Practices',
    content: 'Our industry practices include: Financial Services (banking, insurance, capital markets, payments), Healthcare & Life Sciences (providers, payers, pharma, medtech), Technology, Media & Telecommunications, Energy & Utilities, Consumer & Retail, Industrial Manufacturing, Government & Public Sector. Each practice is led by partners with 15+ years of industry-specific experience.',
    category: 'practices',
    tags: ['industries', 'practices', 'sectors'],
  },
  {
    topic: 'Capabilities',
    content: 'Our capability areas span: Strategy & Growth — market entry, M&A, corporate strategy, business model innovation; Digital & Technology — digital transformation, cloud, AI/ML, cybersecurity, enterprise platforms; Operations — supply chain, procurement, lean operations, shared services; People & Organization — org design, talent, change management, culture transformation; Data & Analytics — data strategy, advanced analytics, data governance, MLOps.',
    category: 'capabilities',
    tags: ['capabilities', 'services', 'offerings'],
  },
  {
    topic: 'Key Differentiators',
    content: 'What sets us apart: (1) Results guarantee — we tie 20% of our fees to measurable outcomes; (2) Alumni network — 15,000+ alumni in senior roles across industries; (3) Proprietary tools — 25+ digital accelerators that reduce time-to-value; (4) Research institute — $50M annual investment in original research; (5) Diverse teams — 45% of our senior leaders are women, 35% are from underrepresented groups.',
    category: 'differentiators',
    tags: ['differentiators', 'competitive advantage', 'why us'],
  },
  {
    topic: 'Awards & Recognition 2024',
    content: 'Recent recognitions: Vault #5 in Best Consulting Firms (overall), #2 in Technology Consulting; Forbes — Best Management Consulting Firms; Forrester Wave Leader in AI Services; Kennedy Vanguard Leader in Digital Transformation; Gartner Magic Quadrant for Data & Analytics Services. Named to Fast Company\'s Most Innovative Companies list for our StrategyAccelerator platform.',
    category: 'awards',
    tags: ['awards', 'recognition', 'rankings'],
  },
];

// ─── All examples combined with metadata ────────────────────────────────────

export const ALL_SEED_EXAMPLES = {
  cvs: CV_EXAMPLES,
  case_studies: CASE_STUDY_EXAMPLES,
  qualifications: QUALIFICATION_EXAMPLES,
  products: PRODUCT_EXAMPLES,
  company: COMPANY_EXAMPLES,
};

/**
 * Get total count of seed examples across all categories
 */
export function getSeedExampleCount() {
  return Object.values(ALL_SEED_EXAMPLES).reduce((sum, arr) => sum + arr.length, 0);
}

/**
 * Get seed examples for a specific category
 */
export function getSeedExamplesForCategory(categoryId) {
  return ALL_SEED_EXAMPLES[categoryId] || [];
}
