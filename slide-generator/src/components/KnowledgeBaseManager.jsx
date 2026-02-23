/**
 * Knowledge Base Manager Component
 * UI for managing structured knowledge and uploaded documents.
 * Renders as a full-screen overlay via portal (like StorylineWorkspace).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useKnowledgeBase, KNOWLEDGE_CATEGORIES, getSeedExampleCount } from '../context/KnowledgeBaseContext';
import { parseMultipleDocuments, getAcceptString, isFileSupported } from '../services/documentParser';
import { listEngagements, deleteEngagement, clearKnowledgeBase as clearEngagements } from '../services/knowledgeBase';
import { useSlides } from '../context/SlideContext';

export default function KnowledgeBaseManager({ isOpen, onClose }) {
  const { state, entries, actions, search, getCategory, getCounts, categories } = useKnowledgeBase();
  const { state: slideState } = useSlides();

  const [activeCategory, setActiveCategory] = useState('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [engagementList, setEngagementList] = useState([]);
  const [expandedEngagement, setExpandedEngagement] = useState(null);

  const fileInputRef = useRef(null);
  const counts = getCounts();

  // Check if seed data is currently loaded
  const hasSeedData = Object.values(entries).some(
    categoryEntries => Array.isArray(categoryEntries) && categoryEntries.some(e => e._seeded)
  );

  // Load engagements from localStorage when showing engagements tab
  useEffect(() => {
    if (isOpen && activeCategory === 'engagements') {
      try {
        setEngagementList(listEngagements());
      } catch { setEngagementList([]); }
    }
  }, [isOpen, activeCategory]);

  // Handle file upload
  const handleFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate files
    const validFiles = files.filter(isFileSupported);
    if (validFiles.length === 0) {
      alert('No supported files selected. Supported formats: PDF, Word, Excel, PowerPoint, Images, Text');
      return;
    }

    if (validFiles.length > 10) {
      alert('Maximum 10 files can be uploaded at once');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length, files: [] });

    try {
      const results = await parseMultipleDocuments(validFiles, {
        settings: slideState.settings,
      });

      // Process results
      const successDocs = [];
      const failures = [];

      results.forEach((result, idx) => {
        setUploadProgress(prev => ({
          ...prev,
          current: idx + 1,
          files: [...prev.files, { name: result.file.name, success: result.success }],
        }));

        if (result.success) {
          successDocs.push(result.result);
        } else {
          failures.push({ file: result.file.name, error: result.error?.message || 'Unknown error' });
        }
      });

      // Add successful documents to knowledge base
      if (successDocs.length > 0) {
        actions.bulkAddDocuments(successDocs);
      }

      if (failures.length > 0) {
        console.warn('[KnowledgeBase] Some files failed to parse:', failures);
        alert(`${successDocs.length} files uploaded successfully. ${failures.length} failed.`);
      }
    } catch (error) {
      console.error('[KnowledgeBase] Upload error:', error);
      alert('Error uploading files: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [actions, slideState.settings]);

  // Get entries for current view
  const displayEntries = searchQuery
    ? search(searchQuery, { categoryId: activeCategory })
        .map(result => entries[result.categoryId]?.find(e => e.id === result.id))
        .filter(Boolean)
    : getCategory(activeCategory);

  // Handle entry deletion
  const handleDelete = useCallback((entryId) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      actions.deleteEntry(activeCategory, entryId);
    }
  }, [actions, activeCategory]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(() => {
    if (selectedEntries.size === 0) return;
    if (window.confirm(`Delete ${selectedEntries.size} selected entries?`)) {
      selectedEntries.forEach(id => actions.deleteEntry(activeCategory, id));
      setSelectedEntries(new Set());
    }
  }, [actions, activeCategory, selectedEntries]);

  // Handle entry selection
  const toggleSelection = (entryId) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Category list
  const categoryList = Object.values(KNOWLEDGE_CATEGORIES);

  // Don't render if not open
  if (!isOpen) return null;

  const modalContent = (
    <div className="kb-overlay" onClick={onClose}>
      <div className="knowledge-base-manager" onClick={e => e.stopPropagation()}>
        <div className="kb-header">
          <h2>Knowledge Base</h2>
          <div className="kb-header-actions">
            <span className="kb-total-count">{counts.total + engagementList.length} entries</span>
            {counts.total > 0 && (
              <button
                className="kb-clear-all-btn"
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear the entire knowledge base? This cannot be undone.')) {
                    actions.clearAll();
                  }
                }}
              >
                Clear All
              </button>
            )}
            <button className="kb-close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="kb-layout">
          {/* Sidebar - Categories */}
          <div className="kb-sidebar">
            <div className="kb-search">
              <input
                type="text"
                placeholder="Search knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="kb-categories">
              {categoryList.map(cat => (
                <button
                  key={cat.id}
                  className={`kb-category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedEntries(new Set());
                  }}
                >
                  <span className="kb-cat-icon">{cat.icon}</span>
                  <span className="kb-cat-name">{cat.name}</span>
                  <span className="kb-cat-count">{cat.id === 'engagements' ? engagementList.length : (counts[cat.id] || 0)}</span>
                </button>
              ))}
            </div>

            <div className="kb-sidebar-actions">
              <button
                className="kb-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload Documents'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={getAcceptString()}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              {activeCategory !== 'documents' && activeCategory !== 'engagements' && (
                <button
                  className="kb-add-btn"
                  onClick={() => setShowAddForm(true)}
                >
                  + Add Entry
                </button>
              )}

              {/* Seed examples — load demo data for CVs, credentials, etc. */}
              {hasSeedData ? (
                <button
                  className="kb-seed-btn kb-seed-loaded"
                  onClick={() => {
                    if (window.confirm('Remove all demo data? Your manually added entries will be kept.')) {
                      actions.clearSeedExamples();
                    }
                  }}
                  title="Remove demo CVs, credentials, case studies, etc."
                >
                  Clear Demo Data
                </button>
              ) : (
                <button
                  className="kb-seed-btn"
                  onClick={() => {
                    actions.loadSeedExamples();
                  }}
                  title={`Load ${getSeedExampleCount()} example entries (CVs, credentials, case studies, services, company info)`}
                >
                  Load Demo Data ({getSeedExampleCount()})
                </button>
              )}
            </div>
          </div>

          {/* Main Content - Entries */}
          <div className="kb-content">
            {/* Category Header */}
            <div className="kb-content-header">
              <div className="kb-content-title">
                <span className="kb-cat-icon-lg">
                  {categoryList.find(c => c.id === activeCategory)?.icon}
                </span>
                <div>
                  <h3>{categoryList.find(c => c.id === activeCategory)?.name}</h3>
                  <p>{categoryList.find(c => c.id === activeCategory)?.description}</p>
                </div>
              </div>

              {selectedEntries.size > 0 && (
                <div className="kb-bulk-actions">
                  <span>{selectedEntries.size} selected</span>
                  <button onClick={handleBulkDelete} className="kb-delete-btn">
                    Delete Selected
                  </button>
                  <button onClick={() => setSelectedEntries(new Set())}>
                    Clear Selection
                  </button>
                </div>
              )}
            </div>

            {/* Upload Progress */}
            {uploadProgress && (
              <div className="kb-upload-progress">
                <div className="kb-progress-bar">
                  <div
                    className="kb-progress-fill"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
                <span>Parsing {uploadProgress.current} / {uploadProgress.total} files...</span>
              </div>
            )}

            {/* Entries List */}
            <div className="kb-entries-list">
              {activeCategory === 'engagements' ? (
                /* ─── Engagements view (from consulting team history) ─── */
                engagementList.length === 0 ? (
                  <div className="kb-empty">
                    <p>No past engagements yet. Use the consulting team agent to create presentations and they will be saved here.</p>
                  </div>
                ) : (
                  <>
                    <div className="engagement-list-header">
                      <span className="engagement-count">{engagementList.length} engagement{engagementList.length !== 1 ? 's' : ''}</span>
                      <button
                        className="kb-delete-all-btn"
                        onClick={() => {
                          if (window.confirm(`Delete all ${engagementList.length} past engagements? This cannot be undone.`)) {
                            clearEngagements();
                            setEngagementList([]);
                            setExpandedEngagement(null);
                          }
                        }}
                      >
                        Delete All
                      </button>
                    </div>
                    {engagementList.map(eng => {
                    const isExpanded = expandedEngagement === eng.id;
                    return (
                      <div key={eng.id} className={`kb-entry engagement-entry ${isExpanded ? 'expanded' : ''}`}>
                        <div className="kb-entry-content" onClick={() => setExpandedEngagement(isExpanded ? null : eng.id)}>
                          <div className="kb-entry-header">
                            <h4>{eng.topic || 'Untitled'}</h4>
                            <span className="kb-entry-type">{eng.slideCount} slides</span>
                          </div>
                          <p className="kb-entry-preview">
                            {eng.scoping?.audience && `Audience: ${eng.scoping.audience}`}
                            {eng.scoping?.purpose && ` | Purpose: ${eng.scoping.purpose}`}
                            {eng.storyline?.governingThought && ` | ${eng.storyline.governingThought}`}
                          </p>
                          <div className="kb-entry-meta">
                            <span>{eng.date}</span>
                            <span>Budget: {eng.budget?.used || 0}/{eng.budget?.total || 0} credits</span>
                            <span style={{ marginLeft: 'auto', fontSize: 11 }}>{isExpanded ? '▾ Collapse' : '▸ Expand'}</span>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="engagement-details">
                            {/* Storyline */}
                            {eng.storyline && (
                              <div className="eng-section">
                                <h5>Storyline: {eng.storyline.archetype}</h5>
                                <p className="eng-governing">{eng.storyline.governingThought}</p>
                                {eng.storyline.bullets?.length > 0 && (
                                  <ul className="eng-bullets">
                                    {eng.storyline.bullets.map((b, i) => (
                                      <li key={i}><strong>{b.title}</strong> — {b.intent}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}

                            {/* Plan */}
                            {eng.plan && (
                              <div className="eng-section">
                                <h5>Plan ({eng.plan.totalSlides} slides, {eng.plan.workPackages?.length || 0} work packages)</h5>
                                {eng.plan.workPackages?.map((wp, i) => (
                                  <div key={i} className="eng-wp">
                                    <span className="eng-wp-title">{wp.title}</span>
                                    <span className="eng-wp-slides">Slides: {(wp.forSlides || []).join(', ')}</span>
                                    {wp.needsSearch && <span className="eng-wp-badge">search</span>}
                                  </div>
                                ))}
                                {eng.plan.selfHandled?.length > 0 && (
                                  <div className="eng-self-handled">
                                    <small>Manager handled: {eng.plan.selfHandled.join('; ')}</small>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Findings */}
                            {eng.findings?.length > 0 && (
                              <div className="eng-section">
                                <h5>Findings ({eng.findings.length} packages)</h5>
                                {eng.findings.map((f, i) => (
                                  <div key={i} className="eng-finding">
                                    <strong>{f.title}</strong>
                                    <span className="eng-confidence">{f.confidence} confidence</span>
                                    {f.source && <span className="eng-source">[{f.source}]</span>}
                                    {f.findings && <p>{f.findings}</p>}
                                    {f.insights?.length > 0 && (
                                      <ul className="eng-insights">
                                        {f.insights.map((ins, j) => <li key={j}>{ins}</li>)}
                                      </ul>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Output */}
                            {eng.output && (
                              <div className="eng-section">
                                <h5>Final Output: {eng.output.title}</h5>
                                <p><em>{eng.output.mainMessage}</em></p>
                                <div className="eng-slides-flow">
                                  {eng.output.slides?.map((s, i) => (
                                    <span key={i} className="eng-slide-chip">
                                      {i + 1}. {s.title}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Router Prompt — exact input to the router */}
                            {eng.routerPrompt && (
                              <details className="eng-section eng-log-section">
                                <summary>Router Prompt</summary>
                                <pre className="eng-router-prompt">{eng.routerPrompt}</pre>
                              </details>
                            )}

                            {/* Router Plan — template selections */}
                            {eng.routerPlan?.length > 0 && (
                              <details className="eng-section eng-log-section">
                                <summary>Router Plan ({eng.routerPlan.length} slides)</summary>
                                <div className="eng-router-plan">
                                  {eng.routerPlan.map((p, i) => (
                                    <div key={i} className="eng-plan-card">
                                      <span className="eng-plan-num">{i + 1}</span>
                                      <div className="eng-plan-info">
                                        <span className="eng-plan-template">{p.templateId}</span>
                                        {p.sectionTracker && <span className="eng-plan-tracker">{p.sectionTracker}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            {/* Manager Queries — research work plan + phase execution */}
                            {eng.managerQueries?.length > 0 && (
                              <details className="eng-section eng-log-section">
                                <summary>Manager Research Plan ({eng.managerQueries.length} entries)</summary>
                                <div className="eng-team-log">
                                  {eng.managerQueries.map((q, i) => (
                                    <div key={i} style={{ marginBottom: q.phases ? 8 : 2 }}>
                                      <div className="eng-log-line">
                                        <span className="eng-log-role manager">{q.action === 'plan' ? 'PLAN' : `Phase ${q.iteration}`}</span>
                                        <span className="eng-plan-template">{q.action}</span>
                                        <span className="eng-log-action">{q.description || q.query}</span>
                                        {q.reasoning && q.action !== 'plan' && <span className="eng-source" style={{ marginLeft: 8, opacity: 0.7 }}>— {q.reasoning}</span>}
                                      </div>
                                      {q.phases && (
                                        <div style={{ marginLeft: 24, marginTop: 4, fontSize: '0.85em', opacity: 0.85 }}>
                                          {q.phases.map((p, pi) => (
                                            <div key={pi} style={{ marginBottom: 4 }}>
                                              <strong>Phase {pi + 1}{p.parallel ? ' (parallel)' : ''}: {p.name}</strong>
                                              <div style={{ marginLeft: 12 }}>
                                                {(p.tasks || []).map((t, ti) => (
                                                  <div key={ti}>→ [{t.action}] {t.query}</div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            {/* AI Exchanges — all LLM input/output */}
                            {eng.aiIOLog?.length > 0 && (
                              <details className="eng-section eng-log-section">
                                <summary>AI Exchanges ({eng.aiIOLog.length} calls)</summary>
                                <div className="eng-ai-exchanges">
                                  {eng.aiIOLog.map((io, i) => (
                                    <details key={i} className="eng-io-card">
                                      <summary>
                                        <span className="eng-io-num">{i + 1}</span>
                                        <span className="eng-io-step">{io.step}</span>
                                        <span className="eng-io-badges">
                                          {io.duration > 0 && <span className="eng-io-badge eng-io-time">{(io.duration / 1000).toFixed(1)}s</span>}
                                          {io.model && <span className="eng-io-badge eng-io-model">{io.model}</span>}
                                          {io.error && <span className="eng-io-badge eng-io-err">error</span>}
                                        </span>
                                      </summary>
                                      <div className="eng-io-detail">
                                        <div className="eng-io-block">
                                          <label>Input</label>
                                          <pre>{io.input}</pre>
                                        </div>
                                        <div className="eng-io-block">
                                          <label>Output</label>
                                          <pre>{io.output}</pre>
                                        </div>
                                      </div>
                                    </details>
                                  ))}
                                </div>
                              </details>
                            )}

                            {/* Team Log (compact) */}
                            {eng.teamLog?.length > 0 && (
                              <details className="eng-section eng-log-section">
                                <summary>Team Activity ({eng.teamLog.length} entries)</summary>
                                <div className="eng-team-log">
                                  {eng.teamLog.map((t, i) => (
                                    <div key={i} className="eng-log-line">
                                      <span className={`eng-log-role ${t.role}`}>{t.role}</span>
                                      <span className="eng-log-action">{t.action}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            <div className="eng-actions">
                              <button
                                className="kb-delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Delete this engagement?')) {
                                    deleteEngagement(eng.id);
                                    setEngagementList(prev => prev.filter(e => e.id !== eng.id));
                                    setExpandedEngagement(null);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </>
                )
              ) : (
                /* ─── Standard entries view ─── */
                displayEntries.length === 0 ? (
                  <div className="kb-empty">
                    <p>No entries in this category.</p>
                    {activeCategory === 'documents' ? (
                      <button onClick={() => fileInputRef.current?.click()}>
                        Upload your first document
                      </button>
                    ) : (
                      <button onClick={() => setShowAddForm(true)}>
                        Add your first entry
                      </button>
                    )}
                  </div>
                ) : (
                  displayEntries.map(entry => (
                    <div
                      key={entry.id}
                      className={`kb-entry ${selectedEntries.has(entry.id) ? 'selected' : ''}`}
                    >
                      <div className="kb-entry-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(entry.id)}
                          onChange={() => toggleSelection(entry.id)}
                        />
                      </div>
                      <div className="kb-entry-content" onClick={() => setEditingEntry(entry)}>
                        <div className="kb-entry-header">
                          <h4>
                            {entry.name || entry.title || entry.fileName || entry.topic || 'Untitled'}
                            {entry._seeded && <span className="kb-seeded-badge">demo</span>}
                          </h4>
                          {entry.type && <span className="kb-entry-type">{entry.type}</span>}
                        </div>
                        <p className="kb-entry-preview">
                          {(entry.description || entry.content || entry.summary || '').slice(0, 200)}
                          {(entry.description || entry.content || entry.summary || '').length > 200 ? '...' : ''}
                        </p>
                        <div className="kb-entry-meta">
                          <span>Added: {new Date(entry.createdAt).toLocaleDateString()}</span>
                          {entry.tags?.length > 0 && (
                            <span className="kb-entry-tags">
                              {entry.tags.map(tag => (
                                <span key={tag} className="kb-tag">{tag}</span>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="kb-entry-actions">
                        <button
                          className="kb-edit-btn"
                          onClick={(e) => { e.stopPropagation(); setEditingEntry(entry); }}
                        >
                          Edit
                        </button>
                        <button
                          className="kb-delete-btn"
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>

        {/* Add/Edit Form Modal */}
        {(showAddForm || editingEntry) && (
          <EntryFormModal
            category={categories[activeCategory.toUpperCase()] || KNOWLEDGE_CATEGORIES.COMPANY}
            entry={editingEntry}
            onSave={(data) => {
              if (editingEntry) {
                actions.updateEntry(activeCategory, editingEntry.id, data);
              } else {
                actions.addEntry(activeCategory, data);
              }
              setShowAddForm(false);
              setEditingEntry(null);
            }}
            onClose={() => {
              setShowAddForm(false);
              setEditingEntry(null);
            }}
          />
        )}
      </div>
    </div>
  );

  // Use createPortal to render at document.body (outside chatbot)
  return createPortal(modalContent, document.body);
}

/**
 * Entry Form Modal
 */
function EntryFormModal({ category, entry, onSave, onClose }) {
  const [formData, setFormData] = useState(entry || {});

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const fields = category.fields || ['name', 'content'];

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal" onClick={e => e.stopPropagation()}>
        <div className="kb-modal-header">
          <h3>{entry ? 'Edit Entry' : 'Add Entry'}</h3>
          <button onClick={onClose}>Close</button>
        </div>
        <form onSubmit={handleSubmit} className="kb-form">
          {fields.map(field => (
            <div key={field} className="kb-form-field">
              <label htmlFor={field}>
                {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
              </label>
              {field === 'content' || field === 'description' || field === 'summary' || field === 'experience' || field === 'methodology' ? (
                <textarea
                  id={field}
                  value={formData[field] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                  rows={5}
                  placeholder={`Enter ${field}...`}
                />
              ) : (
                <input
                  type={field === 'date' || field === 'validUntil' ? 'date' : 'text'}
                  id={field}
                  value={formData[field] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={`Enter ${field}...`}
                />
              )}
            </div>
          ))}
          <div className="kb-form-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">{entry ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
