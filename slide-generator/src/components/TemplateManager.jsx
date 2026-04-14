import { useState, useMemo } from 'react';
import { useSlides } from '../context/SlideContext';
import { SLIDE_TEMPLATES, TEMPLATE_CATEGORIES, getTemplatesByCategory, findMatchingTemplates, getTemplateById } from '../utils/slideTemplates';
import { SLIDE_MASTERS, getAllSlideMasters } from '../utils/slideMasters';
import { generateTemplate, generatePptxRendererCode, fillTemplateWithAI, extractRelevantCSS, hasAnyApiKey } from '../services/aiService';
import { validateTemplate, quickValidate, VALIDATION_STATUS, VALIDATION_STEPS } from '../services/templateValidation';
import ValidationModal from './ValidationModal';

export default function TemplateManager({ onClose }) {
  const { state, actions, activeSlide } = useSlides();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'builtin', 'custom', 'masters'
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Combine built-in and custom templates with modifications applied
  const allTemplates = useMemo(() => {
    const deletedIds = state.deletedSystemTemplates || [];
    const modifications = state.modifiedSystemTemplates || {};

    // Built-in templates with modifications applied, filtering out deleted ones
    const builtIn = Object.values(SLIDE_TEMPLATES)
      .filter((t) => !deletedIds.includes(t.id))
      .map((t) => {
        const mod = modifications[t.id];
        return {
          ...t,
          ...(mod || {}),
          isBuiltIn: true,
          isModified: !!mod,
          originalId: t.id,
        };
      });

    const custom = state.customTemplates.map((t) => ({
      ...t,
      isBuiltIn: false,
    }));
    return [...builtIn, ...custom];
  }, [state.customTemplates, state.deletedSystemTemplates, state.modifiedSystemTemplates]);

  // Filter templates by tab
  const filteredTemplates = useMemo(() => {
    if (activeTab === 'builtin') return allTemplates.filter((t) => t.isBuiltIn);
    if (activeTab === 'custom') return allTemplates.filter((t) => !t.isBuiltIn);
    return allTemplates;
  }, [allTemplates, activeTab]);

  // Group by category
  const templatesByCategory = useMemo(() => {
    const groups = {};
    filteredTemplates.forEach((template) => {
      const category = template.category || 'Other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(template);
    });
    return groups;
  }, [filteredTemplates]);

  const handleDeleteTemplate = (template) => {
    if (template.isBuiltIn) {
      // Soft delete system template
      if (window.confirm(`Hide "${template.title}" from the template library? You can restore it from settings.`)) {
        actions.deleteSystemTemplate(template.originalId || template.id);
      }
    } else {
      if (window.confirm(`Delete "${template.title}"?`)) {
        actions.deleteTemplate(template.id);
      }
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate({
      ...template,
      isBuiltIn: template.isBuiltIn,
      originalId: template.originalId || template.id,
    });
  };

  const handleResetTemplate = (template) => {
    if (window.confirm(`Reset "${template.title}" to its original content?`)) {
      actions.resetSystemTemplate(template.originalId || template.id);
    }
  };

  const handleUseTemplate = (template) => {
    actions.addSlide({
      title: template.title,
      type: template.type || template.id,
      html: template.html,
      customCSS: template.css || extractRelevantCSS(template.html),
      templateId: template.id,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="template-manager-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="template-manager-header">
          <h2>Template Manager</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs and Actions */}
        <div className="template-manager-toolbar">
          <div className="template-manager-tabs">
            <button
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({allTemplates.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'builtin' ? 'active' : ''}`}
              onClick={() => setActiveTab('builtin')}
            >
              Built-in ({allTemplates.filter((t) => t.isBuiltIn).length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
              onClick={() => setActiveTab('custom')}
            >
              Custom ({state.customTemplates.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'masters' ? 'active' : ''}`}
              onClick={() => setActiveTab('masters')}
            >
              Masters ({Object.keys(SLIDE_MASTERS).length})
            </button>
          </div>
          {activeTab !== 'masters' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateForm(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Template
          </button>
          )}
        </div>

        {/* Content */}
        <div className="template-manager-content">
          {activeTab === 'masters' ? (
            <SlideMastersView />
          ) : showCreateForm ? (
            <CreateTemplateForm
              activeSlide={activeSlide}
              onSave={(template) => {
                actions.addTemplate(template);
                setShowCreateForm(false);
              }}
              onSaveAndEdit={(template) => {
                // Generate an ID that we'll use
                const templateId = `custom-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                const templateWithId = { ...template, id: templateId };
                actions.addTemplate(templateWithId);
                setShowCreateForm(false);
                // Go straight to edit mode with the template
                setEditingTemplate({ ...templateWithId, isBuiltIn: false });
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          ) : editingTemplate ? (
            <EditTemplateForm
              template={editingTemplate}
              onSave={(updates) => {
                if (editingTemplate.isBuiltIn) {
                  // Save as a modification to the system template
                  actions.modifySystemTemplate(editingTemplate.originalId || editingTemplate.id, updates);
                } else {
                  // Update custom template
                  actions.updateTemplate(editingTemplate.id, updates);
                }
                setEditingTemplate(null);
              }}
              onCancel={() => setEditingTemplate(null)}
            />
          ) : previewTemplate ? (
            <TemplatePreview
              template={previewTemplate}
              onClose={() => setPreviewTemplate(null)}
              onUse={() => handleUseTemplate(previewTemplate)}
            />
          ) : (
            <div className="template-grid-container">
              {Object.entries(templatesByCategory).map(([category, templates]) => (
                <div key={category} className="template-category-section">
                  <h3 className="template-category-title">{category}</h3>
                  <div className="template-grid">
                    {templates.map((template, tIdx) => (
                      <TemplateCard
                        key={`${template.id || `tmpl-${tIdx}`}-${template.updatedAt || ''}`}
                        template={template}
                        onPreview={() => setPreviewTemplate(template)}
                        onEdit={() => handleEditTemplate(template)}
                        onDelete={() => handleDeleteTemplate(template)}
                        onUse={() => handleUseTemplate(template)}
                        onReset={template.isModified ? () => handleResetTemplate(template) : null}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="template-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <p>No templates found</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowCreateForm(true)}>
                    Create your first template
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Template Card Component
function TemplateCard({ template, onPreview, onEdit, onDelete, onUse, onReset }) {
  return (
    <div className="template-card">
      <div className="template-card-preview" onClick={onPreview}>
        <div className="template-thumbnail">
          <TemplateThumbnail html={template.html} />
        </div>
        {!template.isBuiltIn && (
          <span className="template-badge">Custom</span>
        )}
        {template.isBuiltIn && template.isModified && (
          <span className="template-badge template-badge-modified">Modified</span>
        )}
      </div>
      <div className="template-card-info">
        <h4>{template.title}</h4>
        <p>{template.description || 'No description'}</p>
      </div>
      <div className="template-card-actions">
        <button className="btn btn-primary btn-sm" onClick={onUse} title="Use this template">
          Use
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onPreview} title="Preview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </button>
        {onReset && (
          <button className="btn btn-ghost btn-sm" onClick={onReset} title="Reset to original">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onDelete} title={template.isBuiltIn ? "Hide template" : "Delete"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {template.isBuiltIn ? (
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
            ) : (
              <>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}

// Template Thumbnail
function TemplateThumbnail({ html }) {
  return (
    <div className="template-thumb-wrapper">
      <div
        className="template-thumb-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// Template Preview
function TemplatePreview({ template, onClose, onUse }) {
  return (
    <div className="template-preview-panel">
      <div className="template-preview-header">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h3>{template.title}</h3>
        <button className="btn btn-primary btn-sm" onClick={onUse}>
          Use Template
        </button>
      </div>
      <div className="template-preview-content">
        <style>{getPreviewStyles()}{template.css ? '\n' + template.css : ''}</style>
        <div className="template-preview-slide">
          <div dangerouslySetInnerHTML={{ __html: template.html }} />
        </div>
      </div>
      <div className="template-preview-info">
        <div className="info-row">
          <span className="info-label">Type:</span>
          <span>{template.type}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Category:</span>
          <span>{template.category}</span>
        </div>
        {template.description && (
          <div className="info-row">
            <span className="info-label">Description:</span>
            <span>{template.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Create Template Form with AI Generation and Preview
function CreateTemplateForm({ activeSlide, onSave, onSaveAndEdit, onCancel }) {
  const { state } = useSlides();
  const [mode, setMode] = useState('ai'); // 'ai', 'current', 'manual'
  const [aiMode, setAiMode] = useState('freestyle'); // 'freestyle' or 'template-match'
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(''); // 'html', 'pptx', 'matching'
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    type: 'custom',
    master: 'standard', // Default to standard master
    category: 'Custom',
    description: '',
    html: '',
    pptxRendererCode: null,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingHtml, setIsEditingHtml] = useState(false);

  // Template matching state
  const [matchingTemplates, setMatchingTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateSelection, setShowTemplateSelection] = useState(false);

  // Find matching templates when prompt changes (in template-match mode)
  const updateMatchingTemplates = (promptText) => {
    if (promptText.trim().length > 5) {
      const matches = findMatchingTemplates(promptText, 6);
      setMatchingTemplates(matches);
      if (matches.length > 0 && !selectedTemplate) {
        setSelectedTemplate(matches[0].template);
      }
    } else {
      setMatchingTemplates([]);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe the template you want to create');
      return;
    }

    if (!hasAnyApiKey(state.settings)) {
      setError('Please configure your API key in Settings first');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      let html;

      if (aiMode === 'template-match' && selectedTemplate) {
        // Template matching mode - fill existing template with AI
        setGenerationStep('filling');
        html = await fillTemplateWithAI(selectedTemplate, prompt, state.settings);
      } else {
        // Freestyle mode - generate from scratch
        setGenerationStep('html');
        html = await generateTemplate(prompt, state.settings, formData.master);
      }

      // Step 2: Generate PPTX export code immediately
      setGenerationStep('pptx');
      let pptxRendererCode = null;
      try {
        pptxRendererCode = await generatePptxRendererCode(html, prompt.substring(0, 50), state.settings);
      } catch (pptxErr) {
        console.warn('Failed to generate PPTX code:', pptxErr);
        // Continue without PPTX code - can be generated later
      }

      setFormData({
        ...formData,
        html,
        description: prompt,
        pptxRendererCode,
        type: selectedTemplate?.type || 'custom',
        category: selectedTemplate?.category || 'Custom',
      });
      setShowPreview(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleUseCurrentSlide = async () => {
    if (activeSlide) {
      setIsGenerating(true);
      setGenerationStep('pptx');

      let pptxRendererCode = null;
      if (hasAnyApiKey(state.settings)) {
        try {
          pptxRendererCode = await generatePptxRendererCode(activeSlide.html, activeSlide.title || 'Template', state.settings);
        } catch (err) {
          console.warn('Failed to generate PPTX code:', err);
        }
      }

      setFormData({ ...formData, html: activeSlide.html, pptxRendererCode });
      setIsGenerating(false);
      setGenerationStep('');
      setShowPreview(true);
    }
  };

  const [generatePptx, setGeneratePptx] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [validationProgress, setValidationProgress] = useState(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Open the validation modal
  const handleValidate = () => {
    setShowValidationModal(true);
  };

  // Handle validation completion from the modal
  const handleValidationComplete = (results) => {
    setValidationResults(results);
    if (results.finalPptxCode) {
      setFormData(prev => ({ ...prev, pptxRendererCode: results.finalPptxCode }));
    }
  };

  // Legacy validation (kept for backwards compatibility but not used)
  const runLegacyValidation = async () => {
    setIsValidating(true);
    setValidationResults(null);
    setError('');

    const template = {
      html: formData.html,
      title: formData.title.trim() || 'Untitled',
      type: formData.type,
      master: formData.master,
    };

    try {
      const results = await validateTemplate(template, state.settings, {
        maxIterations: 3,
        generatePptx: generatePptx && !!hasAnyApiKey(state.settings),
        originalPrompt: formData.description || prompt,
        onProgress: (progress) => {
          setValidationProgress(progress);
        },
      });

      setValidationResults(results);

      // Update formData with generated PPTX code if successful
      if (results.finalPptxCode) {
        setFormData(prev => ({ ...prev, pptxRendererCode: results.finalPptxCode }));
      }
    } catch (err) {
      setError(`Validation error: ${err.message}`);
    } finally {
      setIsValidating(false);
      setValidationProgress(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Please enter a template title');
      return;
    }
    if (!formData.html.trim()) {
      setError('Please generate or enter template HTML');
      return;
    }

    // Use validation results if available, otherwise do quick validation
    let pptxRendererCode = formData.pptxRendererCode || validationResults?.finalPptxCode || null;

    // If no PPTX code and generation is enabled, generate now
    if (!pptxRendererCode && generatePptx && hasAnyApiKey(state.settings)) {
      setIsValidating(true);
      setError('');
      try {
        pptxRendererCode = await generatePptxRendererCode(
          formData.html,
          formData.title.trim(),
          state.settings
        );
      } catch (err) {
        console.warn('Failed to generate PPTX code:', err);
      }
      setIsValidating(false);
    }

    onSave({
      title: formData.title.trim(),
      type: formData.type || 'custom',
      master: formData.master || 'standard',
      category: formData.category || 'Custom',
      description: formData.description.trim(),
      html: formData.html,
      pptxRendererCode,
    });
  };

  // If we have HTML and showing preview, show the validation screen
  if (showPreview && formData.html) {
    return (
      <div className="template-create-preview">
        <div className="template-create-preview-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h3>Preview & Save Template</h3>
        </div>

        <div className="template-create-preview-content">
          <div className="template-create-preview-left">
            <style>{getPreviewStyles()}</style>
            <div className="template-preview-slide">
              <div dangerouslySetInnerHTML={{ __html: formData.html }} />
            </div>
          </div>

          <div className="template-create-preview-right">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Template Name *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., My Custom Card Layout"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Type Identifier</label>
                <input
                  type="text"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="e.g., custom-cards"
                />
                <span className="form-hint">Used for AI generation. Use lowercase with hyphens.</span>
              </div>

              <div className="form-group">
                <label>Slide Master</label>
                <select
                  value={formData.master}
                  onChange={(e) => setFormData({ ...formData, master: e.target.value })}
                >
                  {getAllSlideMasters().map((master) => (
                    <option key={master.id} value={master.id}>
                      {master.name} - {master.description}
                    </option>
                  ))}
                </select>
                <span className="form-hint">Base layout this template inherits from.</span>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Custom">Custom</option>
                  <option value="Opening">Opening</option>
                  <option value="Content">Content</option>
                  <option value="Data & Metrics">Data & Metrics</option>
                  <option value="Process & Time">Process & Time</option>
                  <option value="Emphasis">Emphasis</option>
                </select>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe when to use this template..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>
                  HTML
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setIsEditingHtml(!isEditingHtml)}
                    style={{ marginLeft: 8 }}
                  >
                    {isEditingHtml ? 'Hide Editor' : 'Edit HTML'}
                  </button>
                </label>
                {isEditingHtml ? (
                  <textarea
                    value={formData.html}
                    onChange={(e) => setFormData({ ...formData, html: e.target.value })}
                    rows={12}
                    className="code-input"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                ) : (
                  <div className="html-preview-mini">
                    {formData.html.substring(0, 200)}...
                  </div>
                )}
              </div>

              {/* PPTX Code Status */}
              <div className="form-group">
                <label>PPTX Export Code</label>
                <div style={{
                  padding: '8px 12px',
                  background: formData.pptxRendererCode ? 'rgba(40, 167, 69, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                  borderRadius: 6,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span>{formData.pptxRendererCode ? '✓' : '⚠'}</span>
                  <span>
                    {formData.pptxRendererCode
                      ? 'PPTX export code ready'
                      : 'No PPTX code generated yet'}
                  </span>
                </div>
              </div>

              {/* Quality Validation Section */}
              {hasAnyApiKey(state.settings) && (
                <div className="validation-section" style={{ marginTop: 16, padding: 16, background: 'var(--zone1)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 20 }}>🔍</span>
                      <div>
                        <strong style={{ display: 'block' }}>Quality Inspection</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Validates HTML and generates PPTX code
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleValidate}
                      disabled={!formData.html}
                      style={{ minWidth: 140 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      {validationResults ? 'Re-check Quality' : 'Check Quality'}
                    </button>
                  </div>

                  {/* Show validation result badge if available */}
                  {validationResults && (
                    <div style={{
                      marginTop: 12,
                      padding: '8px 12px',
                      background: validationResults.status === 'passed' ? 'rgba(40, 167, 69, 0.1)' :
                                  validationResults.status === 'failed' ? 'rgba(220, 53, 69, 0.1)' :
                                  'rgba(255, 193, 7, 0.1)',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      <span style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'white',
                        border: `2px solid ${validationResults.grade?.color || '#666'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                        color: validationResults.grade?.color,
                      }}>
                        {validationResults.grade?.grade || '?'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {validationResults.grade?.label || 'Unknown'} ({validationResults.score || 0}%)
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {validationResults.stepResults?.length || 0} checks completed
                          {validationResults.finalPptxCode && ' • PPTX Ready'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Validation Modal */}
              <ValidationModal
                isOpen={showValidationModal}
                onClose={() => setShowValidationModal(false)}
                template={{
                  html: formData.html,
                  title: formData.title.trim() || 'Untitled',
                  type: formData.type,
                  master: formData.master,
                }}
                settings={state.settings}
                originalPrompt={formData.description || prompt}
                onComplete={handleValidationComplete}
              />

              {error && (
                <div className="form-error">{error}</div>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={isValidating}>
                  Cancel
                </button>
                {onSaveAndEdit && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isValidating}
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!formData.title.trim()) {
                        setError('Please enter a template title');
                        return;
                      }
                      if (!formData.html.trim()) {
                        setError('Please generate or enter template HTML');
                        return;
                      }
                      let pptxRendererCode = formData.pptxRendererCode || validationResults?.finalPptxCode || null;
                      if (!pptxRendererCode && generatePptx && hasAnyApiKey(state.settings)) {
                        setIsValidating(true);
                        try {
                          pptxRendererCode = await generatePptxRendererCode(formData.html, formData.title.trim(), state.settings);
                        } catch (err) {
                          console.warn('Failed to generate PPTX code:', err);
                        }
                        setIsValidating(false);
                      }
                      onSaveAndEdit({
                        title: formData.title.trim(),
                        type: formData.type || 'custom',
                        master: formData.master || 'standard',
                        category: formData.category || 'Custom',
                        description: formData.description.trim(),
                        html: formData.html,
                        pptxRendererCode,
                      });
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                    Save & Edit
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={isValidating}>
                  {isValidating ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14 }} />
                      Processing...
                    </>
                  ) : (
                    'Save Template'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Initial creation screen
  return (
    <div className="template-form template-form-wide">
      <h3>Create New Template</h3>

      {/* Mode Selection */}
      <div className="template-create-modes">
        <button
          className={`template-create-mode ${mode === 'ai' ? 'active' : ''}`}
          onClick={() => setMode('ai')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="mode-title">Generate with AI</span>
          <span className="mode-desc">Describe your template layout</span>
        </button>

        {activeSlide && (
          <button
            className={`template-create-mode ${mode === 'current' ? 'active' : ''}`}
            onClick={() => setMode('current')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
            <span className="mode-title">From Current Slide</span>
            <span className="mode-desc">Use active slide as template</span>
          </button>
        )}

        <button
          className={`template-create-mode ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => setMode('manual')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="mode-title">Write HTML</span>
          <span className="mode-desc">Create template manually</span>
        </button>
      </div>

      {/* AI Generation Mode */}
      {mode === 'ai' && (
        <div className="template-create-section">
          {/* AI Mode Toggle */}
          <div className="ai-mode-toggle" style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            padding: 4,
            background: 'var(--zone2)',
            borderRadius: 8,
          }}>
            <button
              type="button"
              className={`mode-toggle-btn ${aiMode === 'freestyle' ? 'active' : ''}`}
              onClick={() => {
                setAiMode('freestyle');
                setSelectedTemplate(null);
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: aiMode === 'freestyle' ? 'white' : 'transparent',
                border: aiMode === 'freestyle' ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.2s',
                boxShadow: aiMode === 'freestyle' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Freestyle</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Generate from scratch</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${aiMode === 'template-match' ? 'active' : ''}`}
              onClick={() => {
                setAiMode('template-match');
                updateMatchingTemplates(prompt);
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: aiMode === 'template-match' ? 'white' : 'transparent',
                border: aiMode === 'template-match' ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.2s',
                boxShadow: aiMode === 'template-match' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <span style={{ fontSize: 18 }}>📋</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Template Match</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fill existing template</span>
            </button>
          </div>

          {aiMode === 'freestyle' && (
            <div className="form-group">
              <label>Base Slide Master</label>
              <select
                value={formData.master}
                onChange={(e) => setFormData({ ...formData, master: e.target.value })}
              >
                {getAllSlideMasters().map((master) => (
                  <option key={master.id} value={master.id}>
                    {master.name} - {master.description}
                  </option>
                ))}
              </select>
              <span className="form-hint">Choose the base layout for your template.</span>
            </div>
          )}

          <div className="form-group">
            <label>{aiMode === 'template-match' ? 'Describe your content' : 'Describe your template layout'}</label>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (aiMode === 'template-match') {
                  updateMatchingTemplates(e.target.value);
                }
              }}
              placeholder={aiMode === 'template-match'
                ? "e.g., Our Q4 revenue grew 35% with key drivers being AI automation and new market expansion. Show financial metrics."
                : "e.g., A slide with 4 equal-sized cards in a 2x2 grid, each card has an icon, title, and short description."
              }
              rows={4}
              autoFocus
            />
            <span className="form-hint">
              {aiMode === 'template-match'
                ? 'Describe the content - we\'ll find the best template and fill it with your data.'
                : 'Be specific about the layout structure, number of elements, and visual organization.'
              }
            </span>
          </div>

          {/* Template Selection (for template-match mode) */}
          {aiMode === 'template-match' && (
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Selected Template</span>
                {matchingTemplates.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                    {matchingTemplates.length} matches found
                  </span>
                )}
              </label>

              {/* Matching templates grid with visual previews */}
              {matchingTemplates.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginTop: 8,
                }}>
                  {matchingTemplates.map(({ templateId, template, score }) => (
                    <button
                      key={templateId}
                      type="button"
                      onClick={() => setSelectedTemplate(template)}
                      style={{
                        padding: 0,
                        background: selectedTemplate?.id === templateId ? 'rgba(142, 30, 30, 0.1)' : 'var(--zone1)',
                        border: selectedTemplate?.id === templateId ? '2px solid var(--maroon)' : '1px solid var(--border)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Mini template preview */}
                      <div style={{
                        width: '100%',
                        height: 80,
                        background: '#fff',
                        position: 'relative',
                        overflow: 'hidden',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <div style={{
                          transform: 'scale(0.085)',
                          transformOrigin: 'top left',
                          width: 960,
                          height: 540,
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          pointerEvents: 'none',
                        }}>
                          <div dangerouslySetInnerHTML={{ __html: template.html }} />
                        </div>
                      </div>
                      <div style={{ padding: 8 }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: 11,
                          marginBottom: 2,
                          color: selectedTemplate?.id === templateId ? 'var(--maroon)' : 'var(--main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {template.title}
                        </div>
                        <div style={{
                          fontSize: 9,
                          color: 'var(--text-muted)',
                          lineHeight: 1.3,
                          height: 24,
                          overflow: 'hidden',
                        }}>
                          {template.description?.substring(0, 60)}...
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : prompt.trim().length > 5 ? (
                <div style={{
                  padding: 20,
                  background: 'var(--zone1)',
                  borderRadius: 8,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}>
                  No matching templates found. Try different keywords or use Freestyle mode.
                </div>
              ) : (
                <div style={{
                  padding: 20,
                  background: 'var(--zone1)',
                  borderRadius: 8,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}>
                  Start typing to see matching templates...
                </div>
              )}

              {/* Selected template preview with visual exhibit */}
              {selectedTemplate && (
                <div style={{
                  marginTop: 12,
                  background: 'var(--zone1)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}>
                  {/* Large preview exhibit */}
                  <div style={{
                    width: '100%',
                    height: 180,
                    background: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <style>{getPreviewStyles()}{selectedTemplate.css ? '\n' + selectedTemplate.css : ''}</style>
                    <div style={{
                      transform: 'scale(0.19)',
                      transformOrigin: 'top left',
                      width: 960,
                      height: 540,
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      marginLeft: -91, // (960 * 0.19) / 2 = 91
                      pointerEvents: 'none',
                    }}>
                      <div className="template-preview-slide">
                        <div dangerouslySetInnerHTML={{ __html: selectedTemplate.html }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>📋</span>
                      <strong style={{ fontSize: 13 }}>{selectedTemplate.title}</strong>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        background: 'var(--maroon)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 10,
                      }}>
                        {selectedTemplate.category}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                      {selectedTemplate.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || (aiMode === 'template-match' && !selectedTemplate)}
            >
              {isGenerating ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  {generationStep === 'html' ? 'Generating HTML...' :
                   generationStep === 'filling' ? 'Filling template...' :
                   generationStep === 'pptx' ? 'Generating PPTX export code...' :
                   'Generating...'}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  {aiMode === 'template-match' ? 'Fill Template' : 'Generate Template'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Current Slide Mode */}
      {mode === 'current' && activeSlide && (
        <div className="template-create-section">
          <div className="form-group">
            <label>Base Slide Master</label>
            <select
              value={formData.master}
              onChange={(e) => setFormData({ ...formData, master: e.target.value })}
            >
              {getAllSlideMasters().map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name} - {master.description}
                </option>
              ))}
            </select>
            <span className="form-hint">Choose the base layout for your template.</span>
          </div>

          <div className="current-slide-preview">
            <style>{getPreviewStyles()}</style>
            <div className="current-slide-preview-mini">
              <div dangerouslySetInnerHTML={{ __html: activeSlide.html }} />
            </div>
          </div>
          <p className="form-hint" style={{ textAlign: 'center', marginTop: 16 }}>
            This will use your current slide's HTML as the template structure.
          </p>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUseCurrentSlide}
            >
              Use This Slide
            </button>
          </div>
        </div>
      )}

      {/* Manual Mode */}
      {mode === 'manual' && (
        <div className="template-create-section">
          <div className="form-group">
            <label>Base Slide Master</label>
            <select
              value={formData.master}
              onChange={(e) => setFormData({ ...formData, master: e.target.value })}
            >
              {getAllSlideMasters().map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name} - {master.description}
                </option>
              ))}
            </select>
            <span className="form-hint">Choose the base layout for your template.</span>
          </div>

          <div className="form-group">
            <label>Template HTML</label>
            <textarea
              value={formData.html}
              onChange={(e) => setFormData({ ...formData, html: e.target.value })}
              placeholder={`<div class="slide">
  <h1 class="title">[Your title here]</h1>
  <h2 class="subtitle">[Subtitle]</h2>
  <div class="frame">
    <!-- Your content structure -->
  </div>
  <footer class="footer">
    <span>Brand</span>
    <span>1 / 1</span>
  </footer>
</div>`}
              rows={12}
              className="code-input"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!formData.html.trim()) {
                  setError('Please enter template HTML');
                  return;
                }
                setShowPreview(true);
              }}
              disabled={!formData.html.trim()}
            >
              Preview Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Edit Template Form with AI Regeneration and Live Preview
function EditTemplateForm({ template, onSave, onCancel }) {
  const { state } = useSlides();
  const [formData, setFormData] = useState({
    title: template.title,
    type: template.type,
    master: template.master || 'standard',
    category: template.category || 'Custom',
    description: template.description || '',
    html: template.html,
    pptxRendererCode: template.pptxRendererCode || '',
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Please enter a template title');
      return;
    }
    onSave({
      title: formData.title.trim(),
      type: formData.type,
      master: formData.master,
      category: formData.category,
      description: formData.description.trim(),
      html: formData.html,
      pptxRendererCode: formData.pptxRendererCode || null,
    });
  };

  const handleRegenerate = async () => {
    if (!aiPrompt.trim()) {
      setError('Please enter a prompt describing the changes');
      return;
    }

    if (!hasAnyApiKey(state.settings)) {
      setError('Please configure an API key in settings');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const fullPrompt = `Modify this existing template based on the following instruction: "${aiPrompt}"\n\nCurrent template HTML:\n${formData.html}\n\nApply the requested changes while maintaining the overall structure and styling.`;
      const newHtml = await generateTemplate(fullPrompt, state.settings);
      setFormData({ ...formData, html: newHtml });
      setAiPrompt('');
    } catch (err) {
      setError(err.message || 'Failed to regenerate template');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="template-edit-layout">
      <div className="template-edit-preview">
        <h4>Preview</h4>
        <div className="template-edit-preview-container">
          <style>{getPreviewStyles()}</style>
          <div className="template-preview-slide template-preview-scaled">
            <div dangerouslySetInnerHTML={{ __html: formData.html }} />
          </div>
        </div>
      </div>

      <div className="template-edit-form">
        <h3>Edit Template: {template.title}</h3>
        {template.isBuiltIn && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(142, 30, 30, 0.08)',
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 12,
            color: 'var(--maroon)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Editing a built-in template. Changes will be saved as your custom modification.</span>
          </div>
        )}

        {/* AI Regeneration Section */}
        <div className="template-ai-section">
          <label>Regenerate with AI</label>
          <div className="ai-prompt-row">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., Add a third column, change to blue theme..."
              disabled={isGenerating}
              onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleRegenerate()}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRegenerate}
              disabled={isGenerating || !aiPrompt.trim()}
            >
              {isGenerating ? (
                <span className="btn-loading">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
                      <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                  Generating...
                </span>
              ) : (
                'Regenerate'
              )}
            </button>
          </div>
          <span className="form-hint">Describe changes to apply to the template</span>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Template Name *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Type Identifier</label>
            <input
              type="text"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Slide Master</label>
            <select
              value={formData.master}
              onChange={(e) => setFormData({ ...formData, master: e.target.value })}
            >
              {getAllSlideMasters().map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="Custom">Custom</option>
              <option value="Opening">Opening</option>
              <option value="Content">Content</option>
              <option value="Data & Metrics">Data & Metrics</option>
              <option value="Process & Time">Process & Time</option>
              <option value="Emphasis">Emphasis</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>HTML Content</label>
            <textarea
              value={formData.html}
              onChange={(e) => setFormData({ ...formData, html: e.target.value })}
              rows={8}
              className="code-input"
            />
          </div>

          <div className="form-group">
            <label>
              PPTX Renderer Code (JavaScript)
              <span style={{ fontSize: 11, color: 'var(--meta)', marginLeft: 8 }}>
                Used as example when exporting to PPTX
              </span>
            </label>
            <textarea
              value={formData.pptxRendererCode}
              onChange={(e) => setFormData({ ...formData, pptxRendererCode: e.target.value })}
              rows={10}
              className="code-input"
              placeholder={`function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  const c = {main:'111111', red:'A32020', meta:'4A4F57'};

  // Add title
  slide.addText("Your Title", {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main});

  // Add content...
}`}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            <span className="form-hint">
              This JavaScript code shows how to render this template in PowerPoint. It will be used as reference when exporting slides.
            </span>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getDefaultTemplateHTML() {
  return `<div class="slide">
  <h1 class="title">Template Title</h1>
  <h2 class="subtitle">Subtitle</h2>
  <div class="frame">
    <p>Your content here...</p>
  </div>
  <footer class="footer">
    <span>Brand</span>
    <span>1 / 1</span>
  </footer>
</div>`;
}

function getPreviewStyles() {
  return `
.template-preview-slide {
  width: 960px;
  height: 540px;
  background: white;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border-radius: 4px;
  overflow: hidden;
}

.template-preview-slide .slide {
  position: relative;
  width: 960px;
  height: 540px;
  background: #fff;
  font-family: Arial, sans-serif;
  color: #111;
  overflow: hidden;
}

.template-preview-slide .slide .title {
  position: absolute;
  left: 35px;
  top: 30px;
  width: 890px;
  font: 400 28px/1.2 Georgia, serif;
  margin: 0;
}

.template-preview-slide .slide .subtitle {
  position: absolute;
  left: 35px;
  top: 101px;
  font: 700 18px/1.2 Arial, sans-serif;
  color: #A32020;
  margin: 0;
}

.template-preview-slide .slide .frame {
  position: absolute;
  left: 35px;
  top: 137px;
  width: 890px;
  height: 353px;
  display: flex;
  flex-direction: column;
}

.template-preview-slide .slide footer.footer {
  position: absolute;
  bottom: 14px;
  left: 35px;
  width: 890px;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #4A4F57;
}

.template-preview-slide .slide .card-row {
  display: flex;
  gap: 16px;
  height: 100%;
}

.template-preview-slide .slide .card {
  flex: 1;
  background: #F7F9FB;
  border-radius: 4px;
  padding: 18px;
  border-top: 5px solid #8E1E1E;
  border: 1px solid #E6E9EE;
}

.template-preview-slide .slide .kpi-value {
  font: 700 42px/1 Georgia, serif;
  color: #8E1E1E;
}

.template-preview-slide .slide .quote-box {
  background: #F7F9FB;
  padding: 30px;
  border-left: 6px solid #8E1E1E;
}
`;
}

// Validation Status Badge Component
function ValidationStatusBadge({ label, status }) {
  const getStatusStyle = () => {
    switch (status) {
      case 'passed':
        return { background: '#D4EDDA', color: '#155724', border: '1px solid #C3E6CB' };
      case 'failed':
        return { background: '#F8D7DA', color: '#721C24', border: '1px solid #F5C6CB' };
      case 'warning':
        return { background: '#FFF3CD', color: '#856404', border: '1px solid #FFEEBA' };
      case 'running':
        return { background: '#CCE5FF', color: '#004085', border: '1px solid #B8DAFF' };
      default:
        return { background: '#E2E3E5', color: '#383D41', border: '1px solid #D6D8DB' };
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'passed': return '✓';
      case 'failed': return '✗';
      case 'warning': return '⚠';
      case 'running': return '◐';
      default: return '○';
    }
  };

  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      ...getStatusStyle(),
    }}>
      <span>{getStatusIcon()}</span>
      {label}
    </span>
  );
}

// Visual Validation Process UI Component - Simplified
function ValidationProcessUI({ validationProgress, validationResults }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'passed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'running': return '#007bff';
      default: return '#6c757d';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'passed': return '#d4edda';
      case 'failed': return '#f8d7da';
      case 'warning': return '#fff3cd';
      case 'running': return '#cce5ff';
      default: return '#e9ecef';
    }
  };

  return (
    <div className="validation-process-ui">
      {/* Progress Message */}
      {validationProgress && !validationResults && (
        <div style={{
          padding: '10px 14px',
          background: '#e3f2fd',
          borderRadius: 6,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
        }}>
          <span className="spinner" style={{ width: 14, height: 14 }} />
          <span style={{ color: '#1565c0' }}>{validationProgress.message}</span>
          {validationProgress.iteration && (
            <span style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: '#1976d2',
              background: '#bbdefb',
              padding: '2px 6px',
              borderRadius: 10,
            }}>
              #{validationProgress.iteration}
            </span>
          )}
        </div>
      )}

      {/* Results Display */}
      {validationResults && (
        <>
          {/* Score and Grade */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
            padding: '10px 14px',
            background: getStatusBg(validationResults.status),
            borderRadius: 6,
            border: `1px solid ${getStatusColor(validationResults.status)}30`,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'white',
              border: `3px solid ${validationResults.grade?.color || '#666'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 20,
                fontWeight: 700,
                color: validationResults.grade?.color || '#333',
              }}>
                {validationResults.grade?.grade || '?'}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {validationResults.grade?.label || 'Unknown'} ({validationResults.score || 0}%)
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {validationResults.stepResults?.length || 0} checks completed
                {validationResults.iterations > 1 && ` • ${validationResults.iterations} attempts`}
              </div>
            </div>
            {validationResults.finalPptxCode && (
              <span style={{
                background: '#28a745',
                color: 'white',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}>
                PPTX Ready
              </span>
            )}
          </div>

          {/* Step Results */}
          {validationResults.stepResults?.map((step, idx) => (
            <div
              key={step.step || idx}
              style={{
                padding: '8px 12px',
                marginBottom: 6,
                background: getStatusBg(step.status),
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{step.icon || '•'}</span>
                <strong>{step.name}</strong>
                <span style={{
                  marginLeft: 'auto',
                  color: getStatusColor(step.status),
                  fontWeight: 600,
                }}>
                  {step.score !== undefined ? `${step.score}%` : step.status}
                </span>
              </div>

              {/* Show summary if available */}
              {step.summary && (
                <div style={{ marginTop: 4, color: '#555', fontStyle: 'italic' }}>
                  {step.summary}
                </div>
              )}

              {/* Show issues */}
              {step.issues && step.issues.length > 0 && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                  {step.issues.slice(0, 3).map((issue, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        color: issue.severity === 'critical' ? '#dc3545' :
                               issue.severity === 'major' ? '#fd7e14' : '#ffc107',
                      }}>
                        {issue.severity === 'critical' ? '✗' : '⚠'}
                      </span>
                      <span>{typeof issue === 'string' ? issue : issue.issue}</span>
                    </div>
                  ))}
                  {step.issues.length > 3 && (
                    <div style={{ color: '#888', fontSize: 11 }}>
                      +{step.issues.length - 3} more...
                    </div>
                  )}
                </div>
              )}

              {/* Show suggestions */}
              {step.suggestions && step.suggestions.length > 0 && (
                <div style={{ marginTop: 4, color: '#0d6efd', fontSize: 11 }}>
                  💡 {step.suggestions[0]}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// Slide Masters View Component
function SlideMastersView() {
  const masters = getAllSlideMasters();
  const [selectedMaster, setSelectedMaster] = useState(null);

  return (
    <div className="slide-masters-view">
      <div className="masters-info">
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Slide Masters define the base layout and styling that templates inherit from.
          Each template is built on top of a master which controls title, subtitle, and content positioning.
        </p>
      </div>

      <div className="masters-grid">
        {masters.map((master) => (
          <div
            key={master.id}
            className={`master-card ${selectedMaster?.id === master.id ? 'selected' : ''}`}
            onClick={() => setSelectedMaster(master)}
          >
            <div className="master-preview">
              <div className={`master-preview-slide master-${master.id}`}>
                {master.hasTitle && <div className="master-title-area">Title</div>}
                {master.hasSubtitle && <div className="master-subtitle-area">Subtitle</div>}
                <div className="master-frame-area">Content Frame</div>
                {master.hasFooter && <div className="master-footer-area">Footer</div>}
              </div>
            </div>
            <div className="master-info">
              <h4>{master.name}</h4>
              <p>{master.description}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedMaster && (
        <div className="master-details">
          <h4>Master: {selectedMaster.name}</h4>
          <div className="master-properties">
            <div className="property-group">
              <h5>Layout Properties</h5>
              <table className="property-table">
                <tbody>
                  <tr>
                    <td>Has Title</td>
                    <td>{selectedMaster.hasTitle ? 'Yes' : 'No'}</td>
                  </tr>
                  <tr>
                    <td>Has Subtitle</td>
                    <td>{selectedMaster.hasSubtitle ? 'Yes' : 'No'}</td>
                  </tr>
                  <tr>
                    <td>Has Footer</td>
                    <td>{selectedMaster.hasFooter ? 'Yes' : 'No'}</td>
                  </tr>
                  {selectedMaster.layout.frameTop && (
                    <tr>
                      <td>Content Frame Top</td>
                      <td>{selectedMaster.layout.frameTop}</td>
                    </tr>
                  )}
                  {selectedMaster.layout.frameHeight && (
                    <tr>
                      <td>Content Frame Height</td>
                      <td>{selectedMaster.layout.frameHeight}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="property-group">
              <h5>Style Properties</h5>
              <table className="property-table">
                <tbody>
                  <tr>
                    <td>Background</td>
                    <td>
                      <span className="color-swatch" style={{ background: selectedMaster.styles.background }}></span>
                      {selectedMaster.styles.background}
                    </td>
                  </tr>
                  {selectedMaster.styles.titleFont && (
                    <tr>
                      <td>Title Font</td>
                      <td>{selectedMaster.styles.titleFont}</td>
                    </tr>
                  )}
                  {selectedMaster.styles.titleSize && (
                    <tr>
                      <td>Title Size</td>
                      <td>{selectedMaster.styles.titleSize}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="master-used-by">
            <h5>Used by Templates:</h5>
            <div className="used-by-list">
              {Object.values(SLIDE_TEMPLATES)
                .filter(t => t.master === selectedMaster.id)
                .map(t => (
                  <span key={t.id} className="template-tag">{t.title}</span>
                ))
              }
              {Object.values(SLIDE_TEMPLATES).filter(t => t.master === selectedMaster.id).length === 0 && (
                <span className="no-templates">No templates use this master</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
