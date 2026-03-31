import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { VIBES } from '../utils/vibes';
import TemplatePicker from './TemplatePicker';

// Debug Panel Component - shows AI router query details
function RouterDebugPanel({ debug, isOpen, onToggle, slides = [] }) {
  if (!debug) return null;

  const ctx = debug.contextSent || {};

  // Get the actual HTML content for context slides
  const getSlideHtmlPreview = (idx) => {
    const slide = slides[idx];
    if (!slide?.html) return '(no content)';
    // Show first 300 chars of HTML
    const preview = slide.html.substring(0, 300);
    return preview + (slide.html.length > 300 ? '...' : '');
  };

  return (
    <div className="router-debug-panel">
      <button className="router-debug-toggle" onClick={onToggle}>
        <span>{isOpen ? '▼' : '▶'}</span>
        <span>🔍 Router Debug</span>
        <span className="router-debug-model">{debug.model || 'rule-based'}</span>
      </button>
      {isOpen && (
        <div className="router-debug-content">
          {/* Context Summary - Friendly View */}
          <div className="router-debug-section">
            <div className="router-debug-label">📊 Context Sent to Router</div>
            <div className="router-context-grid">
              <div className="router-context-item">
                <span className="ctx-label">Model</span>
                <span className="ctx-value">{debug.model}</span>
              </div>
              <div className="router-context-item">
                <span className="ctx-label">Slides</span>
                <span className="ctx-value">{ctx.slideCount || 0}</span>
              </div>
              <div className="router-context-item">
                <span className="ctx-label">Current</span>
                <span className="ctx-value">{ctx.currentSlideIndex >= 0 ? `#${ctx.currentSlideIndex + 1}` : 'none'}</span>
              </div>
              <div className="router-context-item">
                <span className="ctx-label">Layouts</span>
                <span className="ctx-value">{ctx.layoutSummary || 'none'}</span>
              </div>
            </div>
          </div>

          {/* Slide List */}
          {ctx.slideSummaries?.length > 0 && (
            <div className="router-debug-section">
              <div className="router-debug-label">📑 Slides Visible to Router</div>
              <div className="router-slide-list">
                {ctx.slideSummaries.map((s, i) => (
                  <div key={i} className={`router-slide-item ${i === ctx.currentSlideIndex ? 'current' : ''}`}>
                    <span className="slide-num">{s.index + 1}</span>
                    <span className="slide-title">{s.title}</span>
                    <span className="slide-template">{s.template}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storyline */}
          {ctx.storylineSummary && (
            <div className="router-debug-section">
              <div className="router-debug-label">📖 Storyline</div>
              <div className="router-debug-value">{ctx.storylineSummary}</div>
            </div>
          )}

          {/* Selected Context - What slides will be read for context */}
          {(debug.parsedResponse?.sourceSlides?.length > 0 || debug.detectedContextIndices?.length > 0) && (
            <div className="router-debug-section">
              <div className="router-debug-label">📥 Context Slides (full HTML will be passed to AI)</div>
              <div className="router-context-selected">
                {[...new Set([...(debug.parsedResponse?.sourceSlides || []), ...(debug.detectedContextIndices || [])])].map(idx => {
                  const slide = ctx.slideSummaries?.find(s => s.index === idx);
                  return (
                    <div key={idx} className="context-slide-selected">
                      <div className="context-slide-header">
                        <span className="ctx-slide-num">Page {idx + 1}</span>
                        <span className="ctx-slide-title">{slide?.title || 'Unknown'}</span>
                        <span className="ctx-slide-template">{slide?.template || '?'}</span>
                      </div>
                      <pre className="context-slide-html-preview">{getSlideHtmlPreview(idx)}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Plan */}
          {debug.parsedResponse?.plan && (
            <div className="router-debug-section">
              <div className="router-debug-label">📋 Execution Plan ({debug.parsedResponse.plan.length} step{debug.parsedResponse.plan.length > 1 ? 's' : ''})</div>
              <div className="router-plan-list">
                {debug.parsedResponse.plan.map((step, i) => (
                  <div key={i} className="router-plan-step">
                    <span className="plan-step-num">{i + 1}</span>
                    <span className="plan-step-action">{step.action}</span>
                    {step.templateId && <span className="plan-step-template">{step.templateId}</span>}
                    {step.slideIndex !== null && step.slideIndex !== undefined && (
                      <span className="plan-step-target">→ page {step.slideIndex + 1}</span>
                    )}
                    {step.contextSlides?.length > 0 && (
                      <span className="plan-step-context">reads: {step.contextSlides.map(s => `p${s + 1}`).join(', ')}</span>
                    )}
                    {step.instruction && <span className="plan-step-instruction">{step.instruction}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Response (raw) */}
          {debug.parsedResponse && !debug.parsedResponse.plan && (
            <div className="router-debug-section">
              <div className="router-debug-label">🤖 AI Decision</div>
              <pre className="router-debug-code">{JSON.stringify(debug.parsedResponse, null, 2)}</pre>
            </div>
          )}

          {/* Raw Response (collapsed) */}
          {debug.rawResponse && (
            <details className="router-debug-details">
              <summary>Raw API Response</summary>
              <pre className="router-debug-code">{debug.rawResponse}</pre>
            </details>
          )}

          {/* System Prompt (collapsed) */}
          {debug.systemPrompt && (
            <details className="router-debug-details">
              <summary>System Prompt</summary>
              <pre className="router-debug-code">{debug.systemPrompt}</pre>
            </details>
          )}

          {/* Full Context (collapsed) */}
          {debug.userPrompt && (
            <details className="router-debug-details">
              <summary>Full Context Prompt</summary>
              <pre className="router-debug-code">{debug.userPrompt}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// Layout Guidance text input for freestyle steps
function LayoutGuidanceInput({ value, onChange }) {
  return (
    <input
      className="sac-layout-guidance-input"
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder="layout guidance (e.g. 3 cards, 2x2 grid, timeline...)"
      title="Describe the layout you want — free text"
    />
  );
}

// Action type icons and labels
const ACTION_CONFIG = {
  analyze_content: { icon: '🧠', label: 'Analyzing', color: '#8E1E1E' },
  create_slide: { icon: '✨', label: 'Create', color: '#8E1E1E' },
  edit_slide: { icon: '✏️', label: 'Edit', color: '#8E1E1E' },
  delete_slide: { icon: '🗑️', label: 'Delete', color: '#ef4444' },
  switch_template: { icon: '🔄', label: 'Switch', color: '#8E1E1E' },
  create_slides_batch: { icon: '📑', label: 'Batch', color: '#8E1E1E' },
  create_from_template: { icon: '✨', label: 'Create', color: '#8E1E1E' },
  generate_storyline: { icon: '📖', label: 'Storyline', color: '#8E1E1E' },
  populate_slides: { icon: '📝', label: 'Populate', color: '#8E1E1E' },
  answer_question: { icon: '💬', label: 'Answer', color: '#64748b' },
};

// Helper: describe position for a create step
function describePosition(step) {
  const pos = step.position;
  if (!pos && pos !== 0) return null;
  if (pos === 'end') return 'at end';
  if (pos === 'start') return 'at start';
  if (pos === 'after_previous') return 'after previous';
  if (typeof pos === 'number') return `after step ${pos + 1}`;
  return String(pos);
}

export default function SmartActionCard({
  routeResult,
  userPrompt,
  slides = [],
  onExecute,
  onCancel,
  onModify,
  isExecuting = false,
  executionStatus = null,
  progress = null,
  currentSlide = null,
  currentSlideIdx = -1,
  imageVibe = 'default',
  onImageVibeChange = null,
  debugMode = false,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(routeResult?.templateMatch?.templateId || null);
  const [showDebug, setShowDebug] = useState(false);
  const [includeStoryline, setIncludeStoryline] = useState(routeResult?.contextNeeded?.includeStoryline || false);

  // Editable plan - initialized from routeResult.plan
  const [editedPlan, setEditedPlan] = useState(() => {
    if (!routeResult?.plan || routeResult.plan.length === 0) return null;
    return routeResult.plan.map(step => ({ ...step }));
  });

  // Reference slides for additional context
  const [referenceSlides, setReferenceSlides] = useState(() => {
    const fromRouter = routeResult?.contextNeeded?.slideIndices || [];
    const autoDetected = routeResult?.detectedContextIndices || [];
    const combined = [...new Set([...fromRouter, ...autoDetected])];
    const action = routeResult?.action || 'create_slide';
    if (action === 'edit_slide') {
      return combined.filter(idx => idx !== currentSlideIdx);
    }
    return combined;
  });

  const action = routeResult?.action || 'create_slide';
  const actionConfig = ACTION_CONFIG[action] || ACTION_CONFIG.create_slide;

  // Build final slide indices
  const buildFinalSlideIndices = () => {
    const indices = new Set(referenceSlides);
    if (action === 'edit_slide' && currentSlideIdx >= 0) {
      indices.add(currentSlideIdx);
    }
    return [...indices].sort((a, b) => a - b);
  };

  // Update a step in the plan
  const updatePlanStep = (stepIdx, updates) => {
    setEditedPlan(prev => {
      if (!prev) return prev;
      const newPlan = [...prev];
      newPlan[stepIdx] = { ...newPlan[stepIdx], ...updates };
      return newPlan;
    });
  };

  const moveStepUp = (stepIdx) => {
    if (stepIdx <= 0) return;
    setEditedPlan(prev => {
      if (!prev) return prev;
      const newPlan = [...prev];
      [newPlan[stepIdx - 1], newPlan[stepIdx]] = [newPlan[stepIdx], newPlan[stepIdx - 1]];
      return newPlan;
    });
    setEditedGroups(null);
  };

  const moveStepDown = (stepIdx) => {
    setEditedPlan(prev => {
      if (!prev || stepIdx >= prev.length - 1) return prev;
      const newPlan = [...prev];
      [newPlan[stepIdx], newPlan[stepIdx + 1]] = [newPlan[stepIdx + 1], newPlan[stepIdx]];
      return newPlan;
    });
    setEditedGroups(null);
  };

  const deleteStep = (stepIdx) => {
    setEditedPlan(prev => {
      if (!prev || prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== stepIdx);
    });
    setEditedGroups(null);
  };

  // Toggle context slide for a specific step
  const toggleStepContext = (stepIdx, slideIdx) => {
    setEditedPlan(prev => {
      if (!prev) return prev;
      const newPlan = [...prev];
      const step = newPlan[stepIdx];
      const contextSlides = step.contextSlides || [];
      if (contextSlides.includes(slideIdx)) {
        newPlan[stepIdx] = { ...step, contextSlides: contextSlides.filter(i => i !== slideIdx) };
      } else {
        newPlan[stepIdx] = { ...step, contextSlides: [...contextSlides, slideIdx] };
      }
      return newPlan;
    });
  };

  // Build modified route result
  const buildModifiedResult = () => ({
    ...routeResult,
    action,
    templateMatch: selectedTemplate ? { templateId: selectedTemplate, keyword: 'user selected' } : null,
    plan: editedPlan || routeResult?.plan,
    contextNeeded: {
      ...routeResult?.contextNeeded,
      slideIndices: buildFinalSlideIndices(),
      includeStoryline,
    },
  });

  const handleExecute = () => {
    onExecute(buildModifiedResult());
  };

  // Compute summary badge
  const plan = editedPlan || [];
  const groups = routeResult?.groups || null;
  const stepCount = plan.length;
  const groupCount = groups ? groups.length : 0;

  // Build a map: stepIndex -> groupIndex for rendering
  const stepToGroup = {};
  if (groups) {
    groups.forEach((groupStepIndices, gi) => {
      groupStepIndices.forEach(si => { stepToGroup[si] = gi; });
    });
  }

  // Render a single step row
  const renderStep = (step, i) => {
    const stepAction = step.action || action;
    const cfg = ACTION_CONFIG[stepAction] || ACTION_CONFIG.create_slide;
    const stepTemplate = step.templateId ? SLIDE_TEMPLATES[step.templateId] : null;
    const isCreateAction = stepAction === 'create_slide' || stepAction === 'create_from_template';
    const positionLabel = describePosition(step);
    const depStep = step.contextFromStep;

    return (
      <div key={i} className="sac-plan-step">
        <span className="sac-step-num">{i + 1}</span>
        <span className="sac-step-action-badge" style={{ background: cfg.color }}>
          {cfg.icon} {cfg.label}
        </span>
        {debugMode && (
          <div className="sac-step-controls">
            <button className="sac-step-ctrl" onClick={() => moveStepUp(i)} disabled={i === 0} title="Move up">&#9650;</button>
            <button className="sac-step-ctrl" onClick={() => moveStepDown(i)} disabled={i === plan.length - 1} title="Move down">&#9660;</button>
            <button className="sac-step-ctrl sac-step-ctrl-del" onClick={() => deleteStep(i)} disabled={plan.length <= 1} title="Remove step">&times;</button>
          </div>
        )}
        <div className="sac-step-content">
          <div className="sac-step-main">
            {isCreateAction ? (
              <>
                <TemplatePicker
                  selectedTemplate={step.templateId || null}
                  onSelect={(templateId) => {
                    updatePlanStep(i, { templateId: templateId || 'freestyle' });
                  }}
                  showFreestyle={true}
                  compact={true}
                />
                {/* Layout guidance badge for freestyle steps */}
                {!stepTemplate && (
                  <LayoutGuidanceInput
                    value={step.layoutGuidance || null}
                    onChange={(val) => updatePlanStep(i, { layoutGuidance: val })}
                  />
                )}
                {positionLabel && (
                  <span className="sac-step-position">{positionLabel}</span>
                )}
              </>
            ) : stepAction === 'edit_slide' ? (
              <span className="sac-step-target-label">
                Page {(step.slideIndex ?? currentSlideIdx) + 1}
              </span>
            ) : stepAction === 'delete_slide' ? (
              <span className="sac-step-target-label sac-step-target-delete">
                Page {(step.slideIndex ?? currentSlideIdx) + 1}
              </span>
            ) : stepAction === 'switch_template' ? (
              <>
                <span className="sac-step-target-label">
                  Page {(step.slideIndex ?? currentSlideIdx) + 1}
                </span>
                {step.templateId && (
                  <span className="sac-step-template-name">→ {SLIDE_TEMPLATES[step.templateId]?.title || step.templateId}</span>
                )}
              </>
            ) : (
              <span>{stepAction}</span>
            )}
          </div>

          {/* Instruction text - always visible in debug, collapsed in normal mode */}
          {debugMode ? (
            <div className="sac-step-instruction-row">
              <textarea
                className="sac-step-instruction-input"
                value={step.instruction || ''}
                onChange={(e) => updatePlanStep(i, { instruction: e.target.value })}
                placeholder="Enter instructions for this step..."
                rows={2}
              />
            </div>
          ) : (
            <details className="sac-step-instruction-details">
              <summary className="sac-step-instruction-summary">Edit instructions</summary>
              <div className="sac-step-instruction-row">
                <textarea
                  className="sac-step-instruction-input"
                  value={step.instruction || ''}
                  onChange={(e) => updatePlanStep(i, { instruction: e.target.value })}
                  placeholder="Enter instructions for this step..."
                  rows={2}
                />
              </div>
            </details>
          )}

          {/* Source content from router (factual mode) - collapsible */}
          {step.content && (
            <details className="sac-step-content-details">
              <summary className="sac-step-content-summary">
                <span className="sac-content-icon">📄</span>
                <span>Source Content</span>
                <span className="sac-content-preview">
                  {step.content.length > 50 ? step.content.slice(0, 50) + '...' : step.content}
                </span>
              </summary>
              <textarea
                className="sac-step-content-input"
                value={step.content}
                onChange={(e) => updatePlanStep(i, { content: e.target.value })}
                rows={4}
              />
            </details>
          )}

          {/* Dependency indicator */}
          {depStep !== undefined && depStep !== null && (
            <div className="sac-step-dep">
              ← uses output of step {depStep + 1}
            </div>
          )}

          {/* Context slides — debug mode only */}
          {debugMode && (
            <div className="sac-step-context-row">
              <span className="sac-ctx-label">Context:</span>
              {slides.length > 0 ? (
                <div className="sac-ctx-chips">
                  {slides.map((slide, sIdx) => (
                    <button
                      key={sIdx}
                      className={`sac-ctx-chip ${(step.contextSlides || []).includes(sIdx) ? 'selected' : ''}`}
                      onClick={() => toggleStepContext(i, sIdx)}
                      title={slide.title}
                    >
                      {sIdx + 1}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="sac-ctx-none">no slides</span>
              )}
            </div>
          )}

          {/* Per-step web search toggle — always visible */}
          <div className="sac-step-search-row">
            <button
              type="button"
              className={`sac-search-pill ${step.searchQuery ? 'active' : ''}`}
              title={step.searchQuery ? `Search: ${step.searchQuery}` : 'Enable web search for this step'}
              onClick={() => {
                if (step.searchQuery) {
                  updatePlanStep(i, { searchQuery: null });
                } else {
                  updatePlanStep(i, { searchQuery: step.instruction?.slice(0, 80) || 'search query' });
                }
              }}
            >
              <span className="sac-search-icon">&#x2315;</span>
              Web search
            </button>
            {step.searchQuery && (
              <input
                type="text"
                className="sac-search-query-input"
                value={step.searchQuery}
                onChange={(e) => updatePlanStep(i, { searchQuery: e.target.value })}
                placeholder="Search query for this step..."
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render plan with group phases
  const renderPlan = () => {
    if (!plan.length) return null;

    // If we have groups with more than one group, render with phase headers
    if (groups && groups.length > 1) {
      return groups.map((groupStepIndices, gi) => {
        // Determine if this group depends on a previous one
        const groupSteps = groupStepIndices.map(si => plan[si]).filter(Boolean);
        const depOnPrevious = groupSteps.some(s => s.contextFromStep !== undefined && s.contextFromStep !== null);

        return (
          <div key={gi} className="sac-phase">
            <div className="sac-phase-header">
              <span className="sac-phase-label">Phase {gi + 1}</span>
              <span className="sac-phase-count">{groupStepIndices.length} step{groupStepIndices.length > 1 ? 's' : ''}</span>
              {depOnPrevious && (
                <span className="sac-phase-dep">depends on Phase {gi} output</span>
              )}
            </div>
            <div className="sac-plan-steps">
              {groupStepIndices.map(si => plan[si] ? renderStep(plan[si], si) : null)}
            </div>
          </div>
        );
      });
    }

    // Single group or no groups: render flat
    return (
      <div className="sac-plan-steps">
        {plan.map((step, i) => renderStep(step, i))}
      </div>
    );
  };

  // Summary badge text
  const summaryParts = [];
  if (stepCount > 0) summaryParts.push(`${stepCount} step${stepCount > 1 ? 's' : ''}`);
  if (groupCount > 1) summaryParts.push(`${groupCount} phases`);
  const summaryText = summaryParts.join(' · ');

  const cardContent = (
    <div className="smart-action-card" style={{ '--action-color': actionConfig.color }}>
      {/* Header: user prompt + summary badge */}
      <div className="sac-header">
        <div className="sac-prompt">{userPrompt}</div>
        {summaryText && (
          <span className="sac-summary-badge">{summaryText}</span>
        )}
        {isExecuting && <span className="sac-spinner-inline" />}
      </div>

      {/* Router Debug Panel (disabled -- uncomment to re-enable) */}
      {/* <RouterDebugPanel
        debug={{
          ...routeResult?.routerDebug,
          detectedContextIndices: referenceSlides,
        }}
        slides={slides}
        isOpen={showDebug}
        onToggle={() => setShowDebug(!showDebug)}
      /> */}

      {/* Target Slide - for edit/delete actions */}
      {(action === 'edit_slide' || action === 'delete_slide') && currentSlide && (
        <div className="sac-target-slide">
          <div className="sac-target-icon">📍</div>
          <div className="sac-target-info">
            <span className="sac-target-label">Target:</span>
            <span className="sac-target-num">Slide {currentSlideIdx + 1}</span>
            <span className="sac-target-title">"{currentSlide.title}"</span>
          </div>
          <div className="sac-target-badge">{currentSlide.type || 'custom'}</div>
        </div>
      )}

      {/* Execution status */}
      {executionStatus && (
        <div className={`sac-status sac-status-${executionStatus.type}`}>
          <span className="sac-status-icon">
            {executionStatus.type === 'fetching' && '🔍'}
            {executionStatus.type === 'generating' && '⚙️'}
            {executionStatus.type === 'success' && '✅'}
            {executionStatus.type === 'error' && '❌'}
          </span>
          <span className="sac-status-text">{executionStatus.message}</span>
        </div>
      )}

      {/* Plan display */}
      {plan.length > 0 && (
        <div className="sac-plan-summary">
          <div className="sac-plan-header">
            <span className="sac-plan-title">Execution Plan</span>
            {routeResult.remainingCount > 0 && (
              <span className="sac-plan-more">+{routeResult.remainingCount} more</span>
            )}
            <button
              className={`sac-storyline-toggle ${includeStoryline ? 'active' : ''}`}
              onClick={() => setIncludeStoryline(!includeStoryline)}
              title={includeStoryline ? 'Storyline context enabled' : 'Click to include storyline context'}
            >
              <span>📖</span>
              <span>Storyline</span>
            </button>
          </div>
          {renderPlan()}
        </div>
      )}

      {/* Single-action fallback (no plan) - Template & Context */}
      {(!plan || plan.length === 0) && (
        <div className="sac-body">
          <div className="sac-section">
            <div className="sac-section-label">Template</div>
            <TemplatePicker
              selectedTemplate={selectedTemplate}
              onSelect={(templateId) => setSelectedTemplate(templateId)}
              showFreestyle={true}
              compact={true}
            />
          </div>

          {slides.length > 1 && (
            <div className="sac-section">
              <div className="sac-section-label">
                Reference Slides
                <span className="sac-section-count">({slides.length} slides)</span>
              </div>
              <div className="sac-slide-picker-scroll">
                {slides.map((slide, idx) => {
                  const isTargetSlide = action === 'edit_slide' && idx === currentSlideIdx;
                  const isSelected = referenceSlides.includes(idx);
                  return (
                    <div
                      key={slide.id || idx}
                      className={`sac-slide-chip ${isSelected ? 'selected' : ''} ${isTargetSlide ? 'target-locked' : ''}`}
                      onClick={() => {
                        if (isTargetSlide) return;
                        setReferenceSlides(prev =>
                          prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                        );
                      }}
                      title={isTargetSlide ? 'Target slide (already included)' : slide.title}
                    >
                      <span className="sac-slide-num">{idx + 1}</span>
                      <span className="sac-slide-title">
                        {isTargetSlide ? '(target)' : slide.title?.substring(0, 12) || 'Untitled'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vibe picker — shown when plan has image steps */}
      {onImageVibeChange && plan.some(s => s.templateId === 'image-full' || s.templateId === 'image-content') && (
        <div className="sac-vibe-picker">
          <span className="sac-vibe-label">Style:</span>
          {Object.values(VIBES).map(v => (
            <button
              key={v.id}
              type="button"
              className={`sac-vibe-btn ${imageVibe === v.id ? 'active' : ''}`}
              onClick={() => onImageVibeChange(v.id)}
              title={v.description}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar during execution */}
      {isExecuting && progress && progress.total > 1 && (
        <div className="sac-progress">
          <div className="sac-progress-bar">
            <div className="sac-progress-fill" style={{ width: `${Math.min(100, ((progress.current + 1) / progress.total) * 100)}%` }} />
          </div>
          <span className="sac-progress-label">Step {Math.min(progress.current + 1, progress.total)} of {progress.total}</span>
        </div>
      )}

      {/* Footer */}
      {!isExecuting ? (
        <div className="sac-footer">
          <button className="sac-btn sac-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="sac-btn sac-btn-execute" onClick={handleExecute}>
            {actionConfig.icon} Execute
          </button>
        </div>
      ) : (
        <div className="sac-footer sac-footer-executing">
          <div className="sac-executing-status">
            <span className="sac-spinner" />
            <span>{executionStatus?.message || 'Executing...'}</span>
          </div>
          <button className="sac-btn sac-btn-stop" onClick={onCancel}>
            ⏹ Stop
          </button>
        </div>
      )}

      <style>{`
        .smart-action-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06);
          margin: 12px 0;
          overflow: visible;
          animation: sacSlideIn 0.3s ease-out;
          position: relative;
        }

        @keyframes sacSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ---- Router Debug Panel ---- */
        .router-debug-panel {
          border-bottom: 1px solid #e2e8f0;
        }

        .router-debug-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 20px;
          background: #f8fafc;
          border: none;
          cursor: pointer;
          font-size: 12px;
          color: #64748b;
          text-align: left;
        }

        .router-debug-toggle:hover {
          background: #f1f5f9;
        }

        .router-debug-model {
          margin-left: auto;
          padding: 2px 8px;
          background: #6366f1;
          color: white;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .router-debug-content {
          padding: 12px 20px;
          background: #1e293b;
          max-height: 400px;
          overflow-y: auto;
        }

        .router-debug-section {
          margin-bottom: 12px;
        }

        .router-debug-section:last-child {
          margin-bottom: 0;
        }

        .router-debug-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 4px;
          letter-spacing: 0.5px;
        }

        .router-debug-value {
          font-size: 13px;
          color: #e2e8f0;
          font-family: monospace;
        }

        .router-debug-code {
          font-size: 11px;
          color: #a5f3fc;
          background: #0f172a;
          padding: 8px 12px;
          border-radius: 6px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 200px;
          margin: 0;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        }

        .router-context-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .router-context-item {
          display: flex;
          flex-direction: column;
          background: #0f172a;
          padding: 8px 10px;
          border-radius: 6px;
        }

        .ctx-label {
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ctx-value {
          font-size: 12px;
          color: #e2e8f0;
          font-weight: 500;
        }

        .router-slide-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 150px;
          overflow-y: auto;
        }

        .router-slide-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: #0f172a;
          border-radius: 4px;
          font-size: 11px;
        }

        .router-slide-item.current {
          background: #1e3a5f;
          border-left: 3px solid #3b82f6;
        }

        .slide-num {
          color: #64748b;
          font-weight: 600;
          min-width: 20px;
        }

        .slide-title {
          color: #e2e8f0;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .slide-template {
          color: #a5f3fc;
          font-size: 10px;
          padding: 2px 6px;
          background: #164e63;
          border-radius: 3px;
        }

        .router-plan-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .router-plan-step {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: #0f172a;
          border-radius: 6px;
          border-left: 3px solid #22c55e;
          font-size: 11px;
          flex-wrap: wrap;
        }

        .plan-step-num {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #22c55e;
          color: white;
          border-radius: 50%;
          font-weight: 700;
          font-size: 10px;
        }

        .plan-step-action {
          color: #fbbf24;
          font-weight: 600;
        }

        .plan-step-template {
          color: #a5f3fc;
          padding: 2px 6px;
          background: #164e63;
          border-radius: 3px;
        }

        .plan-step-target {
          color: #f472b6;
        }

        .plan-step-context {
          color: #94a3b8;
          font-size: 10px;
        }

        .plan-step-instruction {
          width: 100%;
          margin-top: 4px;
          color: #cbd5e1;
          font-style: italic;
          padding-left: 28px;
        }

        .router-context-selected {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .context-slide-selected {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 12px;
          background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
          border-radius: 6px;
          border-left: 4px solid #3b82f6;
        }

        .context-slide-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ctx-slide-num {
          color: #3b82f6;
          font-weight: 700;
          font-size: 12px;
        }

        .ctx-slide-title {
          color: #e2e8f0;
          flex: 1;
          font-size: 12px;
        }

        .ctx-slide-template {
          color: #a5f3fc;
          font-size: 10px;
          padding: 2px 8px;
          background: #164e63;
          border-radius: 4px;
        }

        .context-slide-html-preview {
          margin: 0;
          padding: 8px;
          background: #0f172a;
          border-radius: 4px;
          font-size: 10px;
          color: #94a3b8;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 120px;
          overflow-y: auto;
          border: 1px solid #1e293b;
        }

        .router-debug-details {
          margin-top: 8px;
        }

        .router-debug-details summary {
          cursor: pointer;
          font-size: 11px;
          color: #64748b;
          padding: 4px 0;
        }

        .router-debug-details summary:hover {
          color: #94a3b8;
        }

        /* ---- Header ---- */
        .sac-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          border-radius: 16px 16px 0 0;
        }

        .sac-prompt {
          flex: 1;
          font-size: 14px;
          color: #1e293b;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sac-summary-badge {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          background: #e2e8f0;
          padding: 4px 12px;
          border-radius: 12px;
          white-space: nowrap;
        }

        .sac-spinner-inline {
          width: 14px;
          height: 14px;
          border: 2px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: sacSpin 0.8s linear infinite;
          flex-shrink: 0;
        }

        /* ---- Target slide ---- */
        .sac-target-slide {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          border-bottom: 2px solid #8b5cf6;
        }

        .sac-target-icon {
          font-size: 20px;
        }

        .sac-target-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .sac-target-label {
          font-size: 12px;
          font-weight: 600;
          color: #6d28d9;
          text-transform: uppercase;
        }

        .sac-target-num {
          font-size: 16px;
          font-weight: 700;
          color: #4c1d95;
        }

        .sac-target-title {
          font-size: 14px;
          color: #6d28d9;
          font-style: italic;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sac-target-badge {
          font-size: 11px;
          font-weight: 500;
          color: white;
          background: #7c3aed;
          padding: 4px 10px;
          border-radius: 12px;
          text-transform: lowercase;
        }

        /* ---- Execution status ---- */
        .sac-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          font-size: 13px;
          animation: sacFadeIn 0.2s ease-out;
        }

        @keyframes sacFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .sac-status-fetching { background: #fef3c7; color: #92400e; }
        .sac-status-generating { background: #dbeafe; color: #1e40af; }
        .sac-status-success { background: #dcfce7; color: #166534; }
        .sac-status-error { background: #fee2e2; color: #991b1b; }

        /* ---- Plan ---- */
        .sac-plan-summary {
          padding: 16px 20px;
          background: #fafbfc;
          border-bottom: 1px solid #e2e8f0;
        }

        .sac-plan-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .sac-plan-title {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .sac-plan-more {
          font-size: 11px;
          color: #64748b;
          background: #e2e8f0;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .sac-storyline-toggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
          padding: 4px 10px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          font-size: 11px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sac-storyline-toggle:hover {
          border-color: #8b5cf6;
          color: #7c3aed;
        }

        .sac-storyline-toggle.active {
          background: #ede9fe;
          border-color: #8b5cf6;
          color: #7c3aed;
          font-weight: 500;
        }

        /* ---- Phase groups ---- */
        .sac-phase {
          margin-bottom: 16px;
        }

        .sac-phase:last-child {
          margin-bottom: 0;
        }

        .sac-phase-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px dashed #cbd5e1;
        }

        .sac-phase-label {
          font-size: 12px;
          font-weight: 700;
          color: #6366f1;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sac-phase-count {
          font-size: 11px;
          color: #94a3b8;
        }

        .sac-phase-dep {
          font-size: 11px;
          color: #f59e0b;
          background: #fffbeb;
          padding: 2px 8px;
          border-radius: 8px;
          border: 1px solid #fde68a;
          margin-left: auto;
        }

        /* ---- Plan steps ---- */
        .sac-plan-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sac-plan-step {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 12px;
          background: white;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: border-color 0.15s;
        }

        .sac-plan-step:hover {
          border-color: #cbd5e1;
        }

        .sac-plan-step.editing {
          border-color: #6366f1;
          background: #fafbff;
        }

        .sac-step-controls {
          display: flex;
          gap: 2px;
          margin-left: auto;
          flex-shrink: 0;
        }
        .sac-step-ctrl {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          background: white;
          color: #94a3b8;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .sac-step-ctrl:hover:not(:disabled) { background: #f1f5f9; color: #475569; }
        .sac-step-ctrl:disabled { opacity: 0.3; cursor: default; }
        .sac-step-ctrl-del:hover:not(:disabled) { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

        .sac-step-num {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #8E1E1E;
          color: white;
          border-radius: 50%;
          font-weight: 700;
          font-size: 11px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .sac-step-action-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          color: white;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .sac-step-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .sac-step-main {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #334155;
          flex-wrap: wrap;
        }

        .sac-step-target-label {
          font-weight: 600;
          color: #475569;
        }

        .sac-step-target-delete {
          color: #dc2626;
        }

        .sac-step-template-name {
          color: #6366f1;
          font-weight: 500;
        }

        .sac-step-template-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          border-radius: 12px;
          font-size: 12px;
          color: #4f46e5;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sac-step-template-btn:hover {
          background: #e0e7ff;
          border-color: #a5b4fc;
        }

        .sac-step-template-btn.freestyle {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #64748b;
        }

        .sac-edit-icon {
          font-size: 10px;
          opacity: 0.6;
        }

        .sac-step-position {
          font-size: 11px;
          color: #64748b;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 6px;
        }

        /* Layout Guidance text input for freestyle steps */
        .sac-layout-guidance-input {
          padding: 3px 10px;
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          color: #7c3aed;
          background: rgba(139, 92, 246, 0.05);
          min-width: 180px;
          max-width: 260px;
          outline: none;
          transition: all 0.15s;
        }

        .sac-layout-guidance-input:hover {
          border-color: rgba(139, 92, 246, 0.4);
          background: rgba(139, 92, 246, 0.08);
        }

        .sac-layout-guidance-input:focus {
          border-color: #7c3aed;
          background: white;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
        }

        .sac-layout-guidance-input::placeholder {
          color: #a78bfa;
          font-weight: 400;
          font-style: italic;
        }

        .sac-step-instruction-row {
          width: 100%;
        }

        .sac-step-instruction-input {
          width: 100%;
          font-size: 13px;
          color: #475569;
          line-height: 1.4;
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          resize: vertical;
          min-height: 40px;
          font-family: inherit;
          transition: all 0.15s;
        }

        .sac-step-instruction-input:hover {
          border-color: #cbd5e1;
        }

        .sac-step-instruction-input:focus {
          outline: none;
          border-color: #6366f1;
          background: white;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .sac-step-instruction-input::placeholder {
          color: #94a3b8;
          font-style: italic;
        }

        .sac-step-instruction-details {
          width: 100%;
        }

        .sac-step-instruction-summary {
          font-size: 11px;
          color: #94a3b8;
          cursor: pointer;
          user-select: none;
          padding: 2px 0;
          list-style: none;
        }

        .sac-step-instruction-summary::-webkit-details-marker { display: none; }
        .sac-step-instruction-summary::marker { content: ''; }

        .sac-step-instruction-summary:hover {
          color: #64748b;
        }

        /* Source content from router (factual mode) */
        .sac-step-content-details {
          width: 100%;
          margin-top: 4px;
        }

        .sac-step-content-summary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 6px;
          font-size: 11px;
          color: #047857;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sac-step-content-summary:hover {
          background: #d1fae5;
        }

        .sac-content-icon {
          font-size: 12px;
        }

        .sac-content-preview {
          color: #6b7280;
          font-style: italic;
          margin-left: auto;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sac-step-content-input {
          width: 100%;
          font-size: 12px;
          color: #374151;
          line-height: 1.4;
          padding: 8px 10px;
          border: 1px solid #a7f3d0;
          border-top: none;
          border-radius: 0 0 6px 6px;
          background: #f0fdf4;
          resize: vertical;
          min-height: 60px;
          font-family: monospace;
        }

        .sac-step-content-input:focus {
          outline: none;
          border-color: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
        }

        .sac-step-dep {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #d97706;
          background: #fffbeb;
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid #fde68a;
          width: fit-content;
        }

        .sac-step-context-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .sac-ctx-label {
          font-size: 11px;
          color: #94a3b8;
        }

        .sac-ctx-chips {
          display: flex;
          gap: 3px;
          flex-wrap: wrap;
        }

        .sac-ctx-chip {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sac-ctx-chip:hover {
          border-color: #a5b4fc;
          color: #4f46e5;
        }

        .sac-ctx-chip.selected {
          background: #4f46e5;
          border-color: #4f46e5;
          color: white;
        }

        .sac-ctx-none {
          font-size: 11px;
          color: #94a3b8;
          font-style: italic;
        }

        .sac-step-search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
          padding: 0 4px;
        }

        .sac-search-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .sac-search-pill:hover {
          border-color: #cbd5e1;
          color: #64748b;
        }

        .sac-search-pill.active {
          background: rgba(142, 30, 30, 0.08);
          border-color: #8E1E1E;
          color: #8E1E1E;
        }

        .sac-search-pill.active:hover {
          background: rgba(142, 30, 30, 0.14);
        }

        .sac-search-icon {
          font-size: 12px;
        }

        .sac-search-query-input {
          flex: 1;
          font-size: 11px;
          padding: 3px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          color: #334155;
          background: #f8fafc;
          outline: none;
        }

        .sac-search-query-input:focus {
          border-color: #8E1E1E;
          background: white;
        }

        .sac-step-template-picker {
          margin-top: 8px;
          padding: 10px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        /* ---- Body (single-action fallback) ---- */
        .sac-body {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: white;
        }

        .sac-section {
          position: relative;
        }

        .sac-section-label {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sac-section-count {
          font-weight: 400;
          color: #cbd5e1;
          text-transform: none;
        }

        .sac-slide-picker-scroll {
          display: flex;
          flex-wrap: nowrap;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 8px;
          margin-bottom: -8px;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }

        .sac-slide-picker-scroll::-webkit-scrollbar {
          height: 6px;
        }

        .sac-slide-picker-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }

        .sac-slide-picker-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .sac-slide-chip {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          gap: 6px;
          padding: 6px 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 12px;
        }

        .sac-slide-chip:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .sac-slide-chip.selected {
          background: #dbeafe;
          border-color: #3b82f6;
          color: #1e40af;
        }

        .sac-slide-num {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e2e8f0;
          border-radius: 50%;
          font-size: 11px;
          font-weight: 600;
        }

        .sac-slide-chip.selected .sac-slide-num {
          background: #3b82f6;
          color: white;
        }

        .sac-slide-chip.target-locked {
          background: #f5f3ff;
          border-color: #8b5cf6;
          cursor: default;
          opacity: 0.8;
        }

        .sac-slide-chip.target-locked .sac-slide-num {
          background: #7c3aed;
          color: white;
        }

        .sac-slide-chip.target-locked .sac-slide-title {
          color: #6d28d9;
          font-style: italic;
        }

        .sac-slide-title {
          color: #475569;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ---- Vibe Picker ---- */
        .sac-vibe-picker {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 20px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          flex-wrap: wrap;
        }
        .sac-vibe-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          margin-right: 4px;
        }
        .sac-vibe-btn {
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid #e2e8f0;
          background: white;
          color: #475569;
          transition: all 0.15s;
        }
        .sac-vibe-btn:hover {
          border-color: #8E1E1E;
          color: #8E1E1E;
        }
        .sac-vibe-btn.active {
          background: #8E1E1E;
          color: white;
          border-color: #8E1E1E;
        }

        /* ---- Footer ---- */
        .sac-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          border-radius: 0 0 16px 16px;
        }

        .sac-btn {
          padding: 12px 24px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
        }

        .sac-btn-cancel {
          background: white;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .sac-btn-cancel:hover {
          background: #f1f5f9;
          color: #334155;
          border-color: #cbd5e1;
        }

        .sac-btn-execute {
          background: linear-gradient(135deg, var(--action-color) 0%, color-mix(in srgb, var(--action-color) 80%, black) 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          min-width: 120px;
        }

        .sac-btn-execute:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        }

        .sac-btn-execute:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .sac-footer-executing {
          justify-content: space-between;
        }

        .sac-executing-status {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #6366f1;
          font-size: 13px;
          font-weight: 500;
        }

        .sac-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e0e7ff;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: sacSpin 0.8s linear infinite;
        }

        @keyframes sacSpin {
          to { transform: rotate(360deg); }
        }

        .sac-btn-stop {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
          min-width: 100px;
        }

        .sac-btn-stop:hover {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          transform: translateY(-1px);
        }

        .sac-progress {
          padding: 8px 16px 4px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sac-progress-bar {
          flex: 1;
          height: 4px;
          background: #f1f5f9;
          border-radius: 2px;
          overflow: hidden;
        }

        .sac-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #8E1E1E, #c41230);
          border-radius: 2px;
          transition: width 0.4s ease;
        }

        .sac-progress-label {
          font-size: 11px;
          color: #64748b;
          white-space: nowrap;
          font-weight: 500;
        }
      `}</style>
    </div>
  );

  return cardContent;
}
