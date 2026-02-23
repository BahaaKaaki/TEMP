import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { buildContextString, EDIT_SYSTEM_PROMPT, getAgentPlanningGuidelines, DEFAULT_SYSTEM_PROMPT, FREESTYLE_COMPONENT_GUIDE } from '../services/aiService';

// Helper to build full prompt preview for transparency
function buildFullPromptPreview(userPrompt, plan, contextString) {
  const sections = [];

  sections.push('=== USER PROMPT ===');
  sections.push(userPrompt || '(No prompt)');
  sections.push('');

  if (plan?.understanding) {
    sections.push('=== AI UNDERSTANDING ===');
    sections.push(plan.understanding);
    sections.push('');
  }

  if (plan?.steps?.length > 0) {
    sections.push('=== PLANNED ACTIONS ===');
    plan.steps.forEach((step, i) => {
      sections.push(`${i + 1}. ${step.action}`);
      if (step.params) {
        sections.push(`   Params: ${JSON.stringify(step.params)}`);
      }
    });
    sections.push('');
  }

  sections.push('=== SLIDE CONTEXT ===');
  sections.push(contextString || '(No context)');

  return sections.join('\n');
}

// Helper to get context strategy description
function getContextStrategyDescription(strategy, slideCount) {
  if (!strategy) return { label: 'No Context', desc: 'No slides needed' };

  const indices = strategy.slideIndices || [];
  const slideCountLabel = indices.length === 0
    ? 'No slides'
    : indices.length === 1
      ? '1 slide'
      : `${indices.length} slides`;

  const descriptions = {
    'slide_html': {
      label: `Slide HTML (${slideCountLabel})`,
      desc: indices.length === 0
        ? 'Slides fetched one-by-one during execution'
        : `Full HTML for slides ${indices.map(i => i + 1).join(', ')} only`
    },
    'text_extract': {
      label: `Text Extract (${slideCountLabel})`,
      desc: `Extracted text from slides ${indices.map(i => i + 1).join(', ')} + template`
    },
    'template_only': {
      label: 'Template Only',
      desc: 'Only template HTML - no existing slides needed'
    },
  };
  return descriptions[strategy.type] || { label: strategy.type, desc: strategy.reason || '' };
}

// Helper to extract text from HTML
function extractTextFromHtml(html) {
  if (!html) return '';
  // Simple text extraction - strip tags
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper to build slide metadata
function buildSlideMetadata(slide) {
  const hasCards = /<div[^>]*class="[^"]*card[^"]*"/.test(slide.html || '');
  const hasBullets = /<li[^>]*>/.test(slide.html || '');
  const hasTable = /<table[^>]*>/.test(slide.html || '');
  return {
    title: slide.title,
    type: slide.type,
    templateId: slide.templateId,
    hasCards,
    hasBullets,
    hasTable,
  };
}

// Build context based on strategy
function buildContextFromStrategy(strategy, slides, templates) {
  if (!strategy) return { context: 'No context needed', tokenEstimate: 0 };

  let context = '';
  let tokenEstimate = 0;
  const indices = strategy.slideIndices || [];

  switch (strategy.type) {
    case 'slide_html':
      // Full HTML for specific slides ONLY
      if (indices.length === 0) {
        context = 'No slides upfront - each slide fetched during execution';
        tokenEstimate = 0;
      } else {
        indices.forEach(idx => {
          if (slides[idx]) {
            context += `--- SLIDE ${idx + 1}: "${slides[idx].title}" [${slides[idx].type}] ---\n${slides[idx].html}\n\n`;
            tokenEstimate += Math.ceil(slides[idx].html.length / 4);
          }
        });
      }
      break;

    case 'text_extract':
      // Extracted text + template
      indices.forEach(idx => {
        if (slides[idx]) {
          const text = extractTextFromHtml(slides[idx].html);
          const preview = text.slice(0, 300) + (text.length > 300 ? '...' : '');
          context += `--- SLIDE ${idx + 1}: "${slides[idx].title}" (text only) ---\n${preview}\n\n`;
          tokenEstimate += Math.ceil(text.length / 4);
        }
      });
      if (strategy.templateId && templates) {
        const template = templates.find(t => t.id === strategy.templateId);
        if (template) {
          context += `=== TARGET TEMPLATE: ${template.title} ===\n${template.html}`;
          tokenEstimate += Math.ceil(template.html.length / 4);
        }
      }
      break;

    case 'template_only':
      // Just template HTML - no existing slides
      if (strategy.templateId && templates) {
        const template = templates.find(t => t.id === strategy.templateId);
        if (template) {
          context = `=== TEMPLATE: ${template.title} ===\n${template.html}`;
          tokenEstimate = Math.ceil(template.html.length / 4);
        } else {
          context = `Template "${strategy.templateId}" not found`;
          tokenEstimate = 10;
        }
      } else {
        context = 'No template specified - will generate freestyle';
        tokenEstimate = 0;
      }
      break;

    default:
      context = `Strategy: ${strategy.type}`;
      tokenEstimate = 10;
  }

  return { context: context || 'No context specified', tokenEstimate };
}

// Context approval dialog before agent execution
export default function AgentApprovalDialog({
  isOpen,
  onApprove,
  onCancel,
  plan,
  slides,
  storyline,
  templates = [],
  defaultContextLevel = 'outline',
  userPrompt = '',
  settings = {},
  templateSelection = null, // Template selection result with closestTemplate info
  routerContext = null, // Lean context sent to router API
}) {
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [showPlanningGuidelines, setShowPlanningGuidelines] = useState(false);
  const [showExecutionGuidelines, setShowExecutionGuidelines] = useState(false);
  const [showFreestyleGuide, setShowFreestyleGuide] = useState(false);
  const [showEditGuidelines, setShowEditGuidelines] = useState(false);
  // User's template choice override
  const [templateChoice, setTemplateChoice] = useState(null); // null = use default, 'freestyle' or templateId

  // Reset template choice when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTemplateChoice(null);
    }
  }, [isOpen]);

  // Setting to show/hide debug info
  const showDebugInfo = settings?.showApprovalDebugInfo ?? false;

  // Get the actual guidelines being used (custom from settings or defaults)
  const customSystemPrompt = settings?.systemPrompt;
  const customFreestyleGuide = settings?.freestyleGuide;
  const planningGuidelines = getAgentPlanningGuidelines();
  const executionGuidelines = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  const freestyleGuide = customFreestyleGuide || FREESTYLE_COMPONENT_GUIDE;

  // Use context strategy from plan if available
  const contextStrategy = plan?.contextStrategy;
  const strategyInfo = getContextStrategyDescription(contextStrategy, slides?.length || 0);

  // Build context preview based on strategy
  const contextPreview = contextStrategy
    ? buildContextFromStrategy(contextStrategy, slides, templates)
    : buildContextString(slides, defaultContextLevel, storyline);

  if (!isOpen) return null;

  // Analyze plan to determine what will be affected and which templates are involved
  const affectedSlides = new Set();
  const operations = [];
  const involvedTemplateIds = new Set(); // Track templates being used/switched to

  // plan is an object with { understanding, steps } - iterate over steps
  const steps = plan?.steps || [];
  if (steps.length > 0) {
    steps.forEach(step => {
      // Extract templateId from various step types
      if (step.params?.templateId) {
        involvedTemplateIds.add(step.params.templateId);
      }

      switch (step.action) {
        case 'edit_slide':
          // Single slide edit
          const slideIdx = step.params?.slideIndex ?? 0;
          affectedSlides.add(slideIdx);
          operations.push(`Edit slide ${slideIdx + 1}`);
          break;
        case 'edit_slides':
          if (step.params?.slideIndices) {
            step.params.slideIndices.forEach(i => affectedSlides.add(i));
          }
          operations.push(`Edit ${step.params?.slideIndices?.length || 'selected'} slides`);
          break;
        case 'edit_all':
          slides.forEach((_, i) => affectedSlides.add(i));
          operations.push(`Edit all ${slides.length} slides`);
          break;
        case 'switch_template':
          const switchIdx = step.params?.slideIndex ?? 0;
          affectedSlides.add(switchIdx);
          operations.push(`Switch template on slide ${switchIdx + 1}${step.params?.templateId ? ` → ${step.params.templateId}` : ''}`);
          break;
        case 'create_from_template':
          operations.push(`Create slide from template: ${step.params?.templateId || 'auto-select'}`);
          break;
        case 'create_slides':
        case 'create_slide':
          operations.push(`Create ${step.params?.count || 1} new slide(s)${step.params?.templateId ? ` using ${step.params.templateId}` : ''}`);
          break;
        case 'generate_storyline':
          operations.push('Generate storyline');
          break;
        case 'generate_skeletons':
          operations.push('Generate skeleton slides');
          break;
        case 'populate_slides':
        case 'fill_skeletons':
          operations.push(`Populate ${storyline?.length || 0} slides with content`);
          break;
        default:
          operations.push(step.action.replace(/_/g, ' '));
      }
    });
  }

  // Also check context strategy for template
  if (contextStrategy?.templateId) {
    involvedTemplateIds.add(contextStrategy.templateId);
  }

  // Get template objects for preview
  const involvedTemplates = [...involvedTemplateIds]
    .map(id => templates.find(t => t.id === id))
    .filter(Boolean);

  // Build HTML preview of affected slides
  const affectedSlidesHtml = [...affectedSlides]
    .filter(idx => idx >= 0 && idx < slides.length)
    .map(idx => {
      const slide = slides[idx];
      return `--- SLIDE ${idx + 1}: "${slide.title}" [${slide.type || 'custom'}] ---\n${slide.html}`;
    })
    .join('\n\n');

  const modalContent = (
    <div className="agent-approval-overlay" onClick={onCancel}>
      <div className="agent-approval-modal" onClick={e => e.stopPropagation()}>
        <div className="approval-header">
          <h3>Review Agent Actions</h3>
          <button className="approval-close" onClick={onCancel}>×</button>
        </div>

        <div className="approval-body">
          {/* Router Context - ALWAYS VISIBLE */}
          {routerContext && (
            <div className="approval-section router-context-section">
              <h4>🔍 Router Context <span className="context-badge">Sent to AI</span></h4>
              <div className="router-context-box">
                <div className="context-row">
                  <span className="context-label">Slides:</span>
                  <span className="context-value">{routerContext.slideCount || 0}</span>
                </div>
                <div className="context-row">
                  <span className="context-label">Current:</span>
                  <span className="context-value">
                    {routerContext.currentSlideIndex >= 0
                      ? `#${routerContext.currentSlideIndex + 1}${routerContext.currentSlideTitle ? ` "${routerContext.currentSlideTitle}"` : ''}`
                      : 'none'}
                  </span>
                </div>
                {routerContext.layoutSummary && (
                  <div className="context-row">
                    <span className="context-label">Layouts:</span>
                    <span className="context-value layout-chips">
                      {routerContext.layoutSummary.split(', ').map((item, i) => (
                        <span key={i} className="layout-chip">{item}</span>
                      ))}
                    </span>
                  </div>
                )}
                {routerContext.storylineSummary && (
                  <div className="context-row storyline-row">
                    <span className="context-label">Storyline:</span>
                    <span className="context-value storyline-value">{routerContext.storylineSummary}</span>
                  </div>
                )}
                <div className="context-row">
                  <span className="context-label">Skeletons:</span>
                  <span className={`context-value ${routerContext.hasSkeletons ? 'has-skeletons' : ''}`}>
                    {routerContext.hasSkeletons ? 'pending' : 'none'}
                  </span>
                </div>
                {routerContext.vibe && (
                  <div className="context-row">
                    <span className="context-label">Vibe:</span>
                    <span className="context-value vibe-value">
                      <span className="vibe-chip">{routerContext.vibe}</span>
                      {routerContext.vibeHint && (
                        <span className="vibe-hint-preview" title={routerContext.vibeHint}>
                          {routerContext.vibeHint.slice(0, 50)}...
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plan understanding */}
          {plan?.understanding && (
            <div className="approval-section">
              <h4>Understanding</h4>
              <p className="approval-understanding">{plan.understanding}</p>
            </div>
          )}

          {/* Plan summary */}
          <div className="approval-section">
            <h4>Planned Operations</h4>
            <div className="approval-operations">
              {operations.map((op, i) => (
                <div key={i} className="approval-operation">
                  <span className="approval-op-number">{i + 1}</span>
                  <span>{op}</span>
                </div>
              ))}
            </div>
            {affectedSlides.size > 0 && (
              <p className="approval-affected">
                Will modify slides: {[...affectedSlides].map(i => i + 1).join(', ')}
              </p>
            )}
          </div>

          {/* Template Selection - Show options when creating new slides */}
          {templateSelection && (
            <div className="approval-section template-selection-section">
              <h4>Template Selection</h4>
              <div className="template-selection-options">
                {/* Option 1: Selected template (or freestyle) */}
                <div
                  className={`template-option ${templateChoice === null ? (templateSelection.template ? 'selected' : (templateSelection.isFreestyle ? 'selected' : '')) : (templateChoice === (templateSelection.template?.id || 'freestyle') ? 'selected' : '')}`}
                  onClick={() => setTemplateChoice(null)}
                >
                  <div className="template-option-header">
                    <input
                      type="radio"
                      name="template-choice"
                      checked={templateChoice === null || templateChoice === (templateSelection.template?.id || 'freestyle')}
                      onChange={() => setTemplateChoice(null)}
                    />
                    <span className="template-option-label">
                      {templateSelection.template ? (
                        <>
                          <strong>{templateSelection.template.title}</strong>
                          <span className="confidence-badge">{templateSelection.confidence}% match</span>
                        </>
                      ) : (
                        <>
                          <strong>Freestyle</strong>
                          <span className="freestyle-badge">Custom Layout</span>
                        </>
                      )}
                    </span>
                  </div>
                  {templateSelection.reasoning && (
                    <p className="template-option-reason">{templateSelection.reasoning}</p>
                  )}
                  {templateSelection.template && (
                    <div className="template-preview-frame">
                      <div
                        className="template-preview-content"
                        dangerouslySetInnerHTML={{ __html: templateSelection.template.html }}
                      />
                    </div>
                  )}
                </div>

                {/* Option 2: Closest template (if freestyle selected) or freestyle option */}
                {templateSelection.isFreestyle && templateSelection.closestTemplate && (
                  <div
                    className={`template-option alternative ${templateChoice === templateSelection.closestTemplate.id ? 'selected' : ''}`}
                    onClick={() => setTemplateChoice(templateSelection.closestTemplate.id)}
                  >
                    <div className="template-option-header">
                      <input
                        type="radio"
                        name="template-choice"
                        checked={templateChoice === templateSelection.closestTemplate.id}
                        onChange={() => setTemplateChoice(templateSelection.closestTemplate.id)}
                      />
                      <span className="template-option-label">
                        <strong>{templateSelection.closestTemplate.title}</strong>
                        <span className="confidence-badge alt">{templateSelection.closestTemplateConfidence}% match</span>
                      </span>
                    </div>
                    {templateSelection.closestTemplateReasoning && (
                      <p className="template-option-reason">{templateSelection.closestTemplateReasoning}</p>
                    )}
                    <div className="template-preview-frame">
                      <div
                        className="template-preview-content"
                        dangerouslySetInnerHTML={{ __html: templateSelection.closestTemplate.html }}
                      />
                    </div>
                  </div>
                )}

                {/* Freestyle option when template is selected */}
                {templateSelection.template && (
                  <div
                    className={`template-option alternative ${templateChoice === 'freestyle' ? 'selected' : ''}`}
                    onClick={() => setTemplateChoice('freestyle')}
                  >
                    <div className="template-option-header">
                      <input
                        type="radio"
                        name="template-choice"
                        checked={templateChoice === 'freestyle'}
                        onChange={() => setTemplateChoice('freestyle')}
                      />
                      <span className="template-option-label">
                        <strong>Freestyle</strong>
                        <span className="freestyle-badge">Custom Layout</span>
                      </span>
                    </div>
                    <p className="template-option-reason">Generate a custom layout tailored to your content instead of using a template.</p>
                  </div>
                )}

                {/* Image slide options */}
                <div
                  className={`template-option alternative ${templateChoice === 'image-full' ? 'selected' : ''}`}
                  onClick={() => setTemplateChoice('image-full')}
                >
                  <div className="template-option-header">
                    <input
                      type="radio"
                      name="template-choice"
                      checked={templateChoice === 'image-full'}
                      onChange={() => setTemplateChoice('image-full')}
                    />
                    <span className="template-option-label">
                      <strong>Image Full</strong>
                      <span className="freestyle-badge" style={{ background: '#D97706', color: 'white' }}>AI Visual</span>
                    </span>
                  </div>
                  <p className="template-option-reason">Full-bleed AI-generated image covering the entire slide.</p>
                </div>
                <div
                  className={`template-option alternative ${templateChoice === 'image-content' ? 'selected' : ''}`}
                  onClick={() => setTemplateChoice('image-content')}
                >
                  <div className="template-option-header">
                    <input
                      type="radio"
                      name="template-choice"
                      checked={templateChoice === 'image-content'}
                      onChange={() => setTemplateChoice('image-content')}
                    />
                    <span className="template-option-label">
                      <strong>Image + Text</strong>
                      <span className="freestyle-badge" style={{ background: '#D97706', color: 'white' }}>AI Visual</span>
                    </span>
                  </div>
                  <p className="template-option-reason">AI-generated illustration with textual title, subtitle, and footer.</p>
                </div>
              </div>
            </div>
          )}

          {/* Template Preview - Show visual preview when templates are involved but no templateSelection */}
          {!templateSelection && involvedTemplates.length > 0 && (
            <div className="approval-section template-preview-section">
              <h4>Template Preview</h4>
              <p className="approval-hint">
                {involvedTemplates.length === 1
                  ? 'This template will be used:'
                  : `These ${involvedTemplates.length} templates will be used:`}
              </p>
              <div className="template-preview-grid">
                {involvedTemplates.map(template => (
                  <div key={template.id} className="template-preview-card">
                    <div className="template-preview-header">
                      <span className="template-preview-title">{template.title}</span>
                      <span className="template-preview-id">{template.id}</span>
                    </div>
                    <div className="template-preview-frame">
                      <div
                        className="template-preview-content"
                        dangerouslySetInnerHTML={{ __html: template.html }}
                      />
                    </div>
                    {template.description && (
                      <p className="template-preview-desc">{template.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected slides HTML - show actual content being passed (debug only) */}
          {showDebugInfo && affectedSlidesHtml && (
            <div className="approval-section">
              <h4>Slide HTML Being Passed to AI</h4>
              <p className="approval-hint">
                This is the actual HTML content the AI will see and edit.
              </p>
              <div className="approval-html-preview">
                <pre>{affectedSlidesHtml}</pre>
              </div>
            </div>
          )}

          {/* Context Strategy - AI determined (debug only) */}
          {showDebugInfo && (
            <div className="approval-section">
              <h4>Context Strategy <span className="ai-suggested-badge">AI Optimized</span></h4>
              <p className="approval-hint">
                The AI analyzed your request and determined the optimal context to pass.
              </p>
              <div className="approval-context-strategy">
                <div className="context-strategy-card">
                  <div className="strategy-header">
                    <span className="strategy-type">{strategyInfo.label}</span>
                    <span className="strategy-tokens">~{contextPreview.tokenEstimate?.toLocaleString() || 0} tokens</span>
                  </div>
                  <p className="strategy-desc">{strategyInfo.desc}</p>
                  {contextStrategy?.reason && (
                    <p className="strategy-reason">{contextStrategy.reason}</p>
                  )}
                  {contextStrategy?.templateId && (
                    <div className="strategy-detail">
                      <span className="detail-label">Template:</span>
                      <span className="detail-value">{contextStrategy.templateId}</span>
                    </div>
                  )}
                  {contextStrategy?.slideIndices && contextStrategy.slideIndices !== 'all' && (
                    <div className="strategy-detail">
                      <span className="detail-label">Slides:</span>
                      <span className="detail-value">{contextStrategy.slideIndices.map(i => i + 1).join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* What's being passed (debug only) */}
          {showDebugInfo && (
            <div className="approval-section">
              <h4>Data Being Passed to AI</h4>
              <div className="approval-data-summary">
                <div className="data-item">
                  <span className="data-icon">💬</span>
                  <span>Your prompt: "{userPrompt?.slice(0, 50)}{userPrompt?.length > 50 ? '...' : ''}"</span>
                </div>
                <div className="data-item">
                  <span className="data-icon">📊</span>
                  <span>{slides?.length || 0} slides ({strategyInfo.label})</span>
                </div>
                {contextStrategy?.type === 'slide_html' && contextStrategy?.slideIndices === 'all' && (
                  <div className="data-item data-warning">
                    <span className="data-icon">⚠️</span>
                    <span>Complete HTML content of all slides will be sent</span>
                  </div>
                )}
                {storyline?.length > 0 && (
                  <div className="data-item">
                    <span className="data-icon">📝</span>
                    <span>{storyline.length} storyline points</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Guidelines - Transparent view of what instructions guide the AI (debug only) */}
          {showDebugInfo && (
            <div className="approval-section guidelines-section">
              <h4>AI Guidelines <span className="transparency-badge">Full Transparency</span></h4>
              <p className="approval-hint">
                These are the actual instructions that guide the AI's behavior. Click to expand and review.
              </p>

              {/* Planning Guidelines */}
              <div className="guideline-block">
                <button
                  className={`guideline-toggle ${showPlanningGuidelines ? 'expanded' : ''}`}
                  onClick={() => setShowPlanningGuidelines(!showPlanningGuidelines)}
                >
                  <span className="guideline-icon">🧠</span>
                  <span className="guideline-title">Planning Guidelines</span>
                  <span className="guideline-desc">How the AI understands your request and creates execution plans</span>
                  <span className="toggle-arrow">{showPlanningGuidelines ? '▼' : '▶'}</span>
                </button>
                {showPlanningGuidelines && (
                  <div className="guideline-content">
                    <pre>{planningGuidelines}</pre>
                  </div>
                )}
              </div>

              {/* Execution Guidelines */}
              <div className="guideline-block">
                <button
                  className={`guideline-toggle ${showExecutionGuidelines ? 'expanded' : ''}`}
                  onClick={() => setShowExecutionGuidelines(!showExecutionGuidelines)}
                >
                  <span className="guideline-icon">⚙️</span>
                  <span className="guideline-title">Slide Generation Guidelines {customSystemPrompt ? '(Custom)' : '(Default)'}</span>
                  <span className="guideline-desc">Design principles and layout rules for creating/editing slides</span>
                  <span className="toggle-arrow">{showExecutionGuidelines ? '▼' : '▶'}</span>
                </button>
                {showExecutionGuidelines && (
                  <div className="guideline-content">
                    <pre>{executionGuidelines}</pre>
                  </div>
                )}
              </div>

              {/* Freestyle Component Guide */}
              <div className="guideline-block">
                <button
                  className={`guideline-toggle ${showFreestyleGuide ? 'expanded' : ''}`}
                  onClick={() => setShowFreestyleGuide(!showFreestyleGuide)}
                >
                  <span className="guideline-icon">🎨</span>
                  <span className="guideline-title">Freestyle Component Guide {customFreestyleGuide ? '(Custom)' : '(Default)'}</span>
                  <span className="guideline-desc">Available components and style tokens for custom layouts</span>
                  <span className="toggle-arrow">{showFreestyleGuide ? '▼' : '▶'}</span>
                </button>
                {showFreestyleGuide && (
                  <div className="guideline-content">
                    <pre>{freestyleGuide}</pre>
                  </div>
                )}
              </div>

              {/* Edit-specific guidelines */}
              <div className="guideline-block">
                <button
                  className={`guideline-toggle ${showEditGuidelines ? 'expanded' : ''}`}
                  onClick={() => setShowEditGuidelines(!showEditGuidelines)}
                >
                  <span className="guideline-icon">✏️</span>
                  <span className="guideline-title">Edit Mode Guidelines</span>
                  <span className="guideline-desc">How the AI preserves templates while editing content</span>
                  <span className="toggle-arrow">{showEditGuidelines ? '▼' : '▶'}</span>
                </button>
                {showEditGuidelines && (
                  <div className="guideline-content">
                    <pre>{EDIT_SYSTEM_PROMPT}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Context preview (debug only) */}
          {showDebugInfo && (
            <div className="approval-section">
              <div className="approval-section-header">
                <h4>{showContextPreview ? 'Full Context Being Sent' : 'Context Preview'}</h4>
                <button
                  className="btn-toggle-prompt"
                  onClick={() => setShowContextPreview(!showContextPreview)}
                >
                  {showContextPreview ? 'Show Preview' : 'Show Full Context'}
                </button>
              </div>
              <div className="approval-context-preview">
                <pre>{showContextPreview ? buildFullPromptPreview(userPrompt, plan, contextPreview.context) : contextPreview.context}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="approval-footer">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => {
            // Determine final template choice
            let finalTemplateId = null;
            if (templateSelection) {
              if (templateChoice === 'freestyle') {
                finalTemplateId = null; // Explicit freestyle
              } else if (templateChoice) {
                finalTemplateId = templateChoice; // User selected specific template
              } else if (templateSelection.template) {
                finalTemplateId = templateSelection.template.id; // Default selected template
              }
              // If freestyle was default and no override, finalTemplateId stays null
            }

            // Pass context strategy with template choice
            onApprove({
              ...contextStrategy,
              templateChoice: finalTemplateId,
              isFreestyleChoice: templateChoice === 'freestyle' || (!templateChoice && templateSelection?.isFreestyle),
            });
          }}>
            Approve & Execute
          </button>
        </div>
      </div>

      <style>{`
        .agent-approval-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .agent-approval-modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 900px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .approval-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .approval-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .approval-close {
          background: none;
          border: none;
          font-size: 24px;
          color: #64748b;
          cursor: pointer;
          line-height: 1;
        }

        .approval-close:hover {
          color: #1e293b;
        }

        .approval-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .approval-section h4 {
          margin: 0 0 10px 0;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .approval-understanding {
          margin: 0;
          padding: 12px;
          background: #f0f9ff;
          border-left: 3px solid #6366f1;
          border-radius: 4px;
          font-size: 13px;
          color: #334155;
          line-height: 1.5;
        }

        /* Router Context Styles */
        .router-context-section {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #f59e0b;
          border-radius: 10px;
          padding: 16px;
        }

        .router-context-section h4 {
          color: #92400e;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .context-badge {
          font-size: 10px;
          font-weight: 500;
          color: white;
          background: #f59e0b;
          padding: 2px 8px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .router-context-box {
          background: white;
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .context-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .context-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          min-width: 80px;
          flex-shrink: 0;
        }

        .context-value {
          font-size: 13px;
          color: #1e293b;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .layout-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .layout-chip {
          background: #e0f2fe;
          color: #0369a1;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .storyline-row {
          padding-top: 8px;
          border-top: 1px dashed #e2e8f0;
          margin-top: 4px;
        }

        .storyline-value {
          font-size: 12px;
          color: #6366f1;
          font-style: italic;
          font-family: inherit;
        }

        .has-skeletons {
          color: #f59e0b;
          font-weight: 600;
        }

        .vibe-value {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .vibe-chip {
          background: linear-gradient(135deg, #8E1E1E 0%, #A32020 100%);
          color: white;
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .vibe-hint-preview {
          font-size: 11px;
          color: #64748b;
          font-style: italic;
        }

        .approval-operations {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .approval-operation {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: #f1f5f9;
          border-radius: 6px;
          font-size: 13px;
        }

        .approval-op-number {
          width: 20px;
          height: 20px;
          background: #6366f1;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
        }

        .approval-affected {
          margin: 10px 0 0 0;
          font-size: 12px;
          color: #f59e0b;
        }

        .approval-hint {
          margin: 0 0 12px 0;
          font-size: 12px;
          color: #64748b;
        }

        .approval-context-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .approval-context-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .approval-context-option:hover {
          border-color: #cbd5e1;
        }

        .approval-context-option.selected {
          border-color: #6366f1;
          background: #f5f3ff;
        }

        .approval-context-option input {
          display: none;
        }

        .approval-context-option div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .approval-context-option strong {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
        }

        .approval-context-option span {
          font-size: 11px;
          color: #64748b;
        }

        .approval-token-estimate {
          margin-top: 10px;
          font-size: 12px;
          color: #6366f1;
          font-weight: 500;
        }

        .approval-context-preview {
          background: #1e293b;
          border-radius: 8px;
          padding: 12px;
          max-height: 200px;
          overflow-y: auto;
        }

        .approval-context-preview pre {
          margin: 0;
          font-size: 11px;
          font-family: 'Monaco', 'Menlo', monospace;
          color: #e2e8f0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .approval-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        .approval-footer .btn-ghost {
          padding: 10px 16px;
          background: transparent;
          border: none;
          color: #64748b;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
        }

        .approval-footer .btn-ghost:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .approval-footer .btn-primary {
          padding: 10px 20px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .approval-footer .btn-primary:hover {
          background: #4f46e5;
        }

        .approval-data-summary {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .data-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13px;
          color: #334155;
        }

        .data-icon {
          flex-shrink: 0;
          font-size: 14px;
        }

        .data-item.data-warning {
          color: #d97706;
          font-weight: 500;
        }

        .approval-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .approval-section-header h4 {
          margin: 0;
        }

        .btn-toggle-prompt {
          padding: 4px 10px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 11px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-toggle-prompt:hover {
          background: #e2e8f0;
          color: #334155;
        }

        .approval-html-preview {
          background: #1e293b;
          border-radius: 8px;
          padding: 12px;
          max-height: 250px;
          overflow-y: auto;
          border: 1px solid #334155;
        }

        .approval-html-preview pre {
          margin: 0;
          font-size: 11px;
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          color: #e2e8f0;
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.4;
        }

        .ai-suggested-badge {
          font-size: 10px;
          font-weight: 500;
          color: #6366f1;
          background: #eef2ff;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: 8px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .approval-context-option.ai-suggested {
          border-color: #a5b4fc;
          background: #f5f3ff;
        }

        .suggested-marker {
          font-size: 10px;
          color: #6366f1;
          font-weight: 600;
          margin-left: auto;
        }

        .approval-context-strategy {
          margin-top: 8px;
        }

        .context-strategy-card {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #7dd3fc;
          border-radius: 8px;
          padding: 12px 16px;
        }

        .strategy-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .strategy-type {
          font-weight: 600;
          font-size: 14px;
          color: #0369a1;
        }

        .strategy-tokens {
          font-size: 11px;
          color: #0284c7;
          background: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 500;
        }

        .strategy-desc {
          margin: 0;
          font-size: 12px;
          color: #334155;
        }

        .strategy-reason {
          margin: 8px 0 0 0;
          font-size: 11px;
          color: #64748b;
          font-style: italic;
          padding-top: 8px;
          border-top: 1px dashed #cbd5e1;
        }

        .strategy-detail {
          display: flex;
          gap: 6px;
          margin-top: 8px;
          font-size: 11px;
        }

        .detail-label {
          color: #64748b;
        }

        .detail-value {
          color: #0369a1;
          font-weight: 500;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        /* Guidelines Section Styles */
        .guidelines-section {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          background: #fafbfc;
        }

        .transparency-badge {
          font-size: 10px;
          font-weight: 500;
          color: #059669;
          background: #d1fae5;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: 8px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .guideline-block {
          margin-top: 10px;
        }

        .guideline-block:first-of-type {
          margin-top: 12px;
        }

        .guideline-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }

        .guideline-toggle:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .guideline-toggle.expanded {
          border-color: #6366f1;
          background: #f5f3ff;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .guideline-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .guideline-title {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          flex-shrink: 0;
        }

        .guideline-desc {
          font-size: 11px;
          color: #64748b;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .toggle-arrow {
          font-size: 10px;
          color: #94a3b8;
          flex-shrink: 0;
          margin-left: auto;
        }

        .guideline-content {
          background: #1e293b;
          border: 1px solid #6366f1;
          border-top: none;
          border-radius: 0 0 6px 6px;
          padding: 12px;
          max-height: 300px;
          overflow-y: auto;
        }

        .guideline-content pre {
          margin: 0;
          font-size: 11px;
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          color: #e2e8f0;
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.5;
        }

        /* Template Preview Styles */
        .template-preview-section {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          background: #fafbfc;
        }

        .template-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 16px;
        }

        .template-preview-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .template-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }

        .template-preview-title {
          font-size: 13px;
          font-weight: 600;
        }

        .template-preview-id {
          font-size: 10px;
          opacity: 0.8;
          font-family: 'Monaco', 'Menlo', monospace;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .template-preview-frame {
          background: #f1f5f9;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          overflow: hidden;
          position: relative;
          /* Fixed height for preview - 720 * 0.28 = ~200px + padding */
          height: 220px;
          padding: 10px;
        }

        .template-preview-content {
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          bottom: 10px;
          overflow: hidden;
          pointer-events: none;
        }

        .template-preview-content .slide,
        .template-preview-content > div:first-child {
          width: 1280px !important;
          height: 720px !important;
          min-width: 1280px;
          min-height: 720px;
          font-size: 16px;
          position: absolute;
          top: 0;
          left: 0;
          transform: scale(0.28);
          transform-origin: top left;
          box-sizing: border-box;
          background: white;
        }

        /* When the template content has multiple children, wrap them in the frame */
        .template-preview-content > *:not(.slide) {
          transform: scale(0.28);
          transform-origin: top left;
        }

        .template-preview-desc {
          margin: 0;
          padding: 10px 14px;
          font-size: 12px;
          color: #64748b;
          background: white;
        }

        /* Template Selection Styles */
        .template-selection-section {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          background: #fafbfc;
        }

        .template-selection-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .template-option {
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .template-option:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        .template-option.selected {
          border-color: #6366f1;
          background: #f5f3ff;
        }

        .template-option.alternative {
          opacity: 0.85;
        }

        .template-option.alternative.selected {
          opacity: 1;
        }

        .template-option-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .template-option-header input[type="radio"] {
          width: 18px;
          height: 18px;
          accent-color: #6366f1;
          cursor: pointer;
        }

        .template-option-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .template-option-label strong {
          color: #1e293b;
        }

        .confidence-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-weight: 500;
        }

        .confidence-badge.alt {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .freestyle-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          font-weight: 500;
        }

        .template-option-reason {
          font-size: 12px;
          color: #64748b;
          margin: 0 0 10px 28px;
          line-height: 1.4;
        }

        .template-option .template-preview-frame {
          margin-left: 28px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}
