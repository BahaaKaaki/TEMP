import React from 'react';

export default function FeaturesLanding({ onClose }) {
  const categories = [
    {
      title: 'Slide Creation',
      color: '#8E1E1E',
      items: [
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 10h8" />
              <path d="M8 14h4" />
            </svg>
          ),
          title: 'Conversational',
          description: 'Natural dialogue interface. Reads PPTX, PDF, images. Iterate until right.'
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          ),
          title: 'Multi-Slide Generation',
          description: 'Full decks from a single prompt. Structured, coherent storylines.'
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="M9 15l3 3 3-3" />
            </svg>
          ),
          title: 'Export to PPTX',
          description: 'One-click PowerPoint export. AI translates layouts intelligently.'
        }
      ]
    },
    {
      title: 'Knowledge',
      color: '#2563eb',
      items: [
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          ),
          title: 'Internal Data',
          description: 'IC materials, proposals, resumes, case studies, credentials.',
          planned: true
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          ),
          title: 'External & Trusted Sources',
          description: 'Web search, curated databases. Outputs cite real sources.'
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          ),
          title: 'Skills Library',
          description: 'Codified methodologies: org assessments, growth playbooks, DD checklists.',
          planned: true
        }
      ]
    },
    {
      title: 'Infrastructure',
      color: '#059669',
      items: [
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
          title: 'Client Deployable',
          description: 'Self-hosted, white-label ready. Full data control and security.'
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4" />
              <path d="M12 18v4" />
              <path d="M4.93 4.93l2.83 2.83" />
              <path d="M16.24 16.24l2.83 2.83" />
              <path d="M2 12h4" />
              <path d="M18 12h4" />
            </svg>
          ),
          title: 'Model Agnostic',
          description: 'OpenAI, Anthropic, Google, or custom endpoints. No vendor lock-in.'
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M9 9h6v6H9z" />
              <path d="M9 1v3" />
              <path d="M15 1v3" />
              <path d="M9 20v3" />
              <path d="M15 20v3" />
              <path d="M20 9h3" />
              <path d="M20 15h3" />
              <path d="M1 9h3" />
              <path d="M1 15h3" />
            </svg>
          ),
          title: 'Plugins',
          description: 'Import/export PPTX, Excel. Extensible integrations.',
          planned: true
        }
      ]
    },
    {
      title: 'Configurable',
      color: '#7c3aed',
      items: [
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
          title: 'Client Themes',
          description: 'Adapt branding, colors, fonts to match any client.'
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          ),
          title: 'Templates',
          description: 'Slide layouts, widgets, visual components. Fully customizable.'
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          ),
          title: 'Presentation Flows',
          description: 'Full multi-slide templates: proposals, business cases, strategy decks.'
        }
      ]
    }
  ];

  const useCases = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      ),
      title: 'Reasoning & Case Cracking',
      description: 'Break down complex problems with structured analysis'
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
        </svg>
      ),
      title: 'Slide Creation',
      description: 'Generate consulting-grade presentations'
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      ),
      title: 'Interactive Reports',
      description: 'HTML reports with charts, navigation, interactivity'
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      ),
      title: 'Repeatable Structures',
      description: 'Automate proposals, business cases, recurring reports'
    }
  ];

  return (
    <div className="features-overlay" onClick={onClose}>
      <div className="features-panel" onClick={(e) => e.stopPropagation()}>
        <div className="features-header">
          <div className="features-header-content">
            <h2>Platform Capabilities</h2>
            <p className="features-subtitle">An internal overview of what this system does</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#10005;</button>
        </div>

        <div className="features-body">
          {/* Hero Section - Agent Mode */}
          <div className="features-hero">
            <div className="features-hero-left">
              <div className="features-hero-badge">How It Works</div>
              <h3>Agentic Team Simulation</h3>
              <p className="features-hero-tagline">
                Works like a real team: a manager scopes, delegates to specialists, reviews outputs, and iterates until the deliverable meets the bar.
              </p>

              {/* Org Visual */}
              <div className="features-org-visual">
                <div className="features-org-manager">
                  <div className="features-org-node features-org-node-manager">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Manager</span>
                  </div>
                </div>
                <div className="features-org-connectors">
                  <div className="features-org-line"></div>
                  <div className="features-org-line"></div>
                  <div className="features-org-line"></div>
                </div>
                <div className="features-org-team">
                  <div className="features-org-node">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <span>Research</span>
                  </div>
                  <div className="features-org-node">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                    </svg>
                    <span>Slides</span>
                  </div>
                  <div className="features-org-node">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>Analysis</span>
                  </div>
                </div>
                <div className="features-org-resources">
                  <div className="features-org-resource">KB</div>
                  <div className="features-org-resource">Web</div>
                  <div className="features-org-resource">Skills</div>
                  <div className="features-org-resource">Docs</div>
                </div>
              </div>
            </div>
            <div className="features-hero-right">
              <div className="features-hero-flow">
                <div className="features-flow-step">
                  <div className="features-flow-num">1</div>
                  <div className="features-flow-content">
                    <strong>Scope & Clarify</strong>
                    <span>Reviews your request. Asks questions if requirements are unclear.</span>
                  </div>
                </div>
                <div className="features-flow-step">
                  <div className="features-flow-num">2</div>
                  <div className="features-flow-content">
                    <strong>Plan & Staff</strong>
                    <span>Creates work plan, validates with you. Assigns agents with relevant skills.</span>
                  </div>
                </div>
                <div className="features-flow-step">
                  <div className="features-flow-num">3</div>
                  <div className="features-flow-content">
                    <strong>Execute</strong>
                    <span>Parallel execution: research, slide creation, web search, KB lookup.</span>
                  </div>
                </div>
                <div className="features-flow-step">
                  <div className="features-flow-num">4</div>
                  <div className="features-flow-content">
                    <strong>Review & Iterate</strong>
                    <span>Cross-review, gap analysis. Loops back if needed.</span>
                  </div>
                </div>
                <div className="features-flow-step">
                  <div className="features-flow-num">5</div>
                  <div className="features-flow-content">
                    <strong>Compile & Deliver</strong>
                    <span>Assembles final deck or report. Quality checked before output.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Categorized Features - 4 Columns */}
          <div className="features-categories">
            {categories.map((category, catIndex) => (
              <div key={catIndex} className="features-category">
                <div className="features-category-header" style={{ borderColor: category.color }}>
                  <h4 style={{ color: category.color }}>{category.title}</h4>
                </div>
                <div className="features-category-items">
                  {category.items.map((item, itemIndex) => (
                    <div key={itemIndex} className={`features-category-item ${item.planned ? 'features-item-planned' : ''}`}>
                      <div className="features-item-icon" style={{ color: item.planned ? '#999' : category.color }}>
                        {item.icon}
                      </div>
                      <div className="features-item-content">
                        <h5>
                          {item.title}
                          {item.planned && <span className="features-planned-badge">Planned</span>}
                        </h5>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Use Cases Section */}
          <div className="features-use-cases">
            <div className="features-use-cases-header">
              <h4>What You Can Do</h4>
            </div>
            <div className="features-use-cases-grid">
              {useCases.map((useCase, index) => (
                <div key={index} className="features-use-case">
                  <div className="features-use-case-icon">{useCase.icon}</div>
                  <div className="features-use-case-content">
                    <strong>{useCase.title}</strong>
                    <span>{useCase.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
