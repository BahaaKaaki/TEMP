import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSlides } from '../context/SlideContext';
import { chatWithContext, AI_ROUTER_TEMPLATES } from '../services/aiService';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';

// Template hints dynamically from SLIDE_TEMPLATES (always in sync)
const TEMPLATE_HINTS = Object.keys(SLIDE_TEMPLATES);

export default function FlowStudio({ isOpen, onClose, onSelectFlow }) {
  const { state, actions } = useSlides();
  const flows = state.flows || [];
  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const [editingFlow, setEditingFlow] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  if (!isOpen) return null;

  const startNew = () => {
    setEditingFlow({
      id: null,
      name: '',
      description: '',
      overallGuidance: '',
      sections: [{ id: `fs-${Date.now()}`, order: 0, templateHint: '', instruction: '', isRepeatable: false, repeatSource: '' }],
    });
    setSelectedFlowId(null);
  };

  const editExisting = (flow) => {
    setEditingFlow({ ...flow, sections: flow.sections.map(s => ({ ...s })) });
    setSelectedFlowId(flow.id);
  };

  const updateField = (field, value) => {
    setEditingFlow(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const updateSection = (idx, field, value) => {
    setEditingFlow(prev => prev ? {
      ...prev,
      sections: prev.sections.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    } : prev);
  };

  const addSection = () => {
    setEditingFlow(prev => prev ? {
      ...prev,
      sections: [...prev.sections, {
        id: `fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        order: prev.sections.length,
        templateHint: '',
        instruction: '',
        isRepeatable: false,
        repeatSource: '',
      }],
    } : prev);
  };

  const removeSection = (idx) => {
    setEditingFlow(prev => prev ? {
      ...prev,
      sections: prev.sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })),
    } : prev);
  };

  const duplicateSection = (idx) => {
    setEditingFlow(prev => {
      if (!prev) return prev;
      const src = prev.sections[idx];
      const copy = { ...src, id: `fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      const arr = [...prev.sections];
      arr.splice(idx + 1, 0, copy);
      return { ...prev, sections: arr.map((s, i) => ({ ...s, order: i })) };
    });
  };

  // Drag-and-drop handlers
  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setEditingFlow(prev => {
      if (!prev) return prev;
      const arr = [...prev.sections];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      return { ...prev, sections: arr.map((s, i) => ({ ...s, order: i })) };
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const saveFlow = () => {
    if (!editingFlow || !editingFlow.name.trim()) return;
    if (editingFlow.id) {
      const { id, ...updates } = editingFlow;
      actions.updateFlow(id, updates);
    } else {
      actions.addFlow(editingFlow);
    }
    setEditingFlow(null);
    setSelectedFlowId(null);
  };

  const deleteFlow = (id) => {
    actions.deleteFlow(id);
    if (selectedFlowId === id) {
      setSelectedFlowId(null);
      setEditingFlow(null);
    }
  };

  const handleUseFlow = (flow) => {
    if (onSelectFlow) onSelectFlow(flow);
    onClose();
  };

  // AI chat — uses chatWithContext with the same calling convention as StorylineWorkspace
  const handleAIChat = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    const userMessage = aiPrompt.trim();
    setAiPrompt('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setAiLoading(true);

    try {
      const currentFlowDesc = editingFlow
        ? `\n\nCURRENT FLOW BEING EDITED: "${editingFlow.name}" (${editingFlow.sections.length} sections):\n${editingFlow.sections.map((s, i) => `  ${i + 1}. template="${s.templateHint}" instruction="${s.instruction}"${s.isRepeatable ? ` (repeatable: ${s.repeatSource})` : ''}`).join('\n')}\nOverall guidance: ${editingFlow.overallGuidance || 'none'}`
        : '';

      const existingFlows = flows.length > 0
        ? `\nExisting flows: ${flows.map(f => `"${f.name}" (${f.sections?.length || 0} sections)`).join(', ')}`
        : '';

      // Build the question with all context embedded (same pattern as StorylineWorkspace)
      const question = `[FLOW STUDIO CONTEXT]
You are helping the user create/edit reusable presentation flow templates in Flow Studio. Flows are abstract slide structure templates — each flow has a name, description, overall guidance, and ordered sections. Each section has: templateHint (template ID from list below), instruction (what the AI should create for this page), isRepeatable (boolean), repeatSource (e.g., "one per approach step").

AVAILABLE TEMPLATES (use these exact IDs for templateHint):
${AI_ROUTER_TEMPLATES}

${currentFlowDesc}
${existingFlows}

When suggesting a flow structure, output it as JSON in a code block. Use DIVERSE templates from the list above:
\`\`\`flow
{
  "name": "Flow Name",
  "description": "When to use this flow",
  "overallGuidance": "Tone and style guidance for the AI",
  "sections": [
    {"templateHint": "cover", "instruction": "Create a professional cover slide", "isRepeatable": false},
    {"templateHint": "executiveSummary", "instruction": "Summarize the key points and recommendations", "isRepeatable": false},
    {"templateHint": "chevronFlow", "instruction": "Show the approach phases", "isRepeatable": false},
    {"templateHint": "projectStepDetail", "instruction": "Detail each approach phase with key activities and deliverables", "isRepeatable": true, "repeatSource": "one per approach phase"},
    {"templateHint": "nextSteps", "instruction": "List action items and next steps", "isRepeatable": false}
  ]
}
\`\`\`

USER REQUEST: ${userMessage}

CRITICAL: Choose the BEST template for each section's content. DO NOT default to the same template repeatedly.
- For metrics/KPIs → kpiMetrics, bigNumber, metricDashboard
- For comparisons → comparisonTable, prosAndCons, beforeAfter
- For processes → processFlow, chevronFlow, timeline
- For lists/points → bulletPoints, threeCards, fourCards
- For data → barChartExhibit, waterfallChart
- For recommendations → recommendationSummary, nextSteps, insightToAction
- For frameworks → swotAnalysis, priorityMatrix, issueTree

Be concise and practical. If the user asks for a flow, provide the JSON block so it can be applied directly.`;

      // Use chatWithContext with the correct signature: (question, context, settings)
      const response = await chatWithContext(
        question,
        { allSlides: state.slides, totalSlides: state.slides.length },
        state.settings
      );

      setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);

      // Try to extract flow JSON from response
      const flowMatch = response.match(/```flow\s*([\s\S]*?)```/);
      if (flowMatch) {
        try {
          const flowData = JSON.parse(flowMatch[1]);
          if (flowData.sections && Array.isArray(flowData.sections)) {
            const newFlow = {
              id: editingFlow?.id || null,
              name: flowData.name || editingFlow?.name || 'AI-Generated Flow',
              description: flowData.description || editingFlow?.description || '',
              overallGuidance: flowData.overallGuidance || editingFlow?.overallGuidance || '',
              sections: flowData.sections.map((s, i) => ({
                id: `fs-${Date.now()}-${i}`,
                order: i,
                templateHint: s.templateHint || '',
                instruction: s.instruction || '',
                isRepeatable: s.isRepeatable || false,
                repeatSource: s.repeatSource || '',
              })),
            };
            setEditingFlow(newFlow);
          }
        } catch (e) {
          console.warn('[FlowStudio] Could not parse flow JSON from AI response:', e);
        }
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: `Error: ${error.message}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIChat();
    }
  };

  const modalContent = (
    <div className="fs-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fs-modal">
        {/* Header - gradient like StorylineWorkspace */}
        <div className="fs-header">
          <div className="fs-header-title">
            <h2>Flow Studio</h2>
            <span className="fs-header-count">{flows.length} flow{flows.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="fs-header-actions">
            <button className="fs-header-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="fs-body">
          {/* Left panel — AI Chat (like StorylineWorkspace AI panel) */}
          <div className="fs-ai-panel">
            <h3>AI Flow Builder</h3>
            <p className="fs-ai-desc">Describe a presentation flow and the AI will create the template structure for you.</p>

            <div className="fs-chat-messages">
              {chatHistory.length === 0 && (
                <div className="fs-chat-empty">
                  <div className="fs-chat-empty-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <p>Try something like:</p>
                  <div className="fs-chat-suggestions">
                    <button onClick={() => setAiPrompt('Create a market landscape flow with cover, exec summary, industry overview, competitive dynamics, key trends, and strategic implications')}>Market landscape</button>
                    <button onClick={() => setAiPrompt('Create a project update flow with cover, status dashboard, milestones, risks, and key takeaways')}>Project update</button>
                    <button onClick={() => setAiPrompt('Create a deep-dive analysis flow with cover, exec summary, context, detailed analysis sections, and synthesis')}>Deep-dive analysis</button>
                  </div>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`fs-chat-msg fs-chat-${msg.role}`}>
                  <div className="fs-chat-bubble">{msg.text}</div>
                </div>
              ))}
              {aiLoading && (
                <div className="fs-chat-msg fs-chat-assistant">
                  <div className="fs-chat-bubble fs-chat-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="fs-chat-input">
              <textarea
                ref={chatInputRef}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Describe a flow template..."
                rows={3}
                disabled={aiLoading}
              />
              <button
                className="fs-chat-send-btn"
                onClick={handleAIChat}
                disabled={!aiPrompt.trim() || aiLoading}
              >
                Generate
              </button>
            </div>
          </div>

          {/* Middle panel — Flow list */}
          <div className="fs-flow-list-panel">
            <div className="fs-flow-list-header">
              <h4>Saved Flows</h4>
              <button className="fs-new-btn" onClick={startNew}>+ New</button>
            </div>
            <div className="fs-flow-list">
              {flows.length === 0 && (
                <div className="fs-flow-list-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                    <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l4.58-4.58c.94-.94.94-2.48 0-3.42L9 5z" />
                    <circle cx="6" cy="9" r="1" />
                  </svg>
                  <p>No flows yet</p>
                  <span>Create one manually or use the AI chat</span>
                </div>
              )}
              {flows.map(flow => (
                <div
                  key={flow.id}
                  className={`fs-flow-card ${selectedFlowId === flow.id ? 'active' : ''}`}
                  onClick={() => editExisting(flow)}
                >
                  <div className="fs-flow-card-main">
                    <div className="fs-flow-card-name">{flow.name}</div>
                    <div className="fs-flow-card-meta">
                      <span className="fs-flow-card-count">{flow.sections?.length || 0} sections</span>
                      {flow.description && <span className="fs-flow-card-desc">{flow.description}</span>}
                    </div>
                  </div>
                  <div className="fs-flow-card-actions">
                    <button
                      className="fs-flow-use-btn"
                      onClick={(e) => { e.stopPropagation(); handleUseFlow(flow); }}
                      title="Use this flow in chat"
                    >Use</button>
                    <button
                      className="fs-flow-del-btn"
                      onClick={(e) => { e.stopPropagation(); deleteFlow(flow.id); }}
                      title="Delete flow"
                    >&times;</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel — Flow editor */}
          <div className="fs-editor-panel">
            {!editingFlow ? (
              <div className="fs-editor-empty">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                  <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l4.58-4.58c.94-.94.94-2.48 0-3.42L9 5z" />
                  <circle cx="6" cy="9" r="1" />
                </svg>
                <h3>No flow selected</h3>
                <p>Select a flow from the list or create a new one to start editing.</p>
                <button className="fs-editor-empty-btn" onClick={startNew}>Create New Flow</button>
              </div>
            ) : (
              <div className="fs-editor-content">
                {/* Top fields */}
                <div className="fs-editor-fields-row">
                  <div className="fs-editor-field" style={{ flex: 1 }}>
                    <label>Flow Name</label>
                    <input
                      type="text"
                      value={editingFlow.name}
                      onChange={e => updateField('name', e.target.value)}
                      placeholder="e.g., Market Analysis, Board Update, Deep Dive"
                    />
                  </div>
                  <div className="fs-editor-field" style={{ flex: 2 }}>
                    <label>Description</label>
                    <input
                      type="text"
                      value={editingFlow.description}
                      onChange={e => updateField('description', e.target.value)}
                      placeholder="When to use this flow"
                    />
                  </div>
                </div>

                <div className="fs-editor-field">
                  <label>Overall AI Guidance</label>
                  <textarea
                    value={editingFlow.overallGuidance}
                    onChange={e => updateField('overallGuidance', e.target.value)}
                    placeholder="High-level instructions: tone, style, themes, audience..."
                    rows={2}
                  />
                </div>

                {/* Sections header */}
                <div className="fs-sections-header">
                  <h3>Sections <span className="fs-sections-count">{editingFlow.sections.length}</span></h3>
                  <button className="fs-add-section" onClick={addSection}>+ Add Section</button>
                </div>

                {/* Sections list with drag-and-drop */}
                <div className="fs-sections-list">
                  {editingFlow.sections.map((section, idx) => (
                    <div
                      key={section.id || idx}
                      className={`fs-section${dragIdx === idx ? ' fs-section-dragging' : ''}${dragOverIdx === idx ? ' fs-section-dragover' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="fs-section-handle" title="Drag to reorder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="5" r="1.5" fill="currentColor" /><circle cx="15" cy="5" r="1.5" fill="currentColor" />
                          <circle cx="9" cy="12" r="1.5" fill="currentColor" /><circle cx="15" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="9" cy="19" r="1.5" fill="currentColor" /><circle cx="15" cy="19" r="1.5" fill="currentColor" />
                        </svg>
                      </div>

                      <div className="fs-section-number">{idx + 1}</div>

                      <div className="fs-section-body">
                        <div className="fs-section-top-row">
                          <input
                            type="text"
                            value={section.templateHint}
                            onChange={e => updateSection(idx, 'templateHint', e.target.value)}
                            placeholder="Template hint"
                            className="fs-section-hint-input"
                            list={`fs-hints-${idx}`}
                          />
                          <datalist id={`fs-hints-${idx}`}>
                            {TEMPLATE_HINTS.map(h => <option key={h} value={h} />)}
                          </datalist>
                          <label className="fs-section-repeat-toggle">
                            <input
                              type="checkbox"
                              checked={section.isRepeatable}
                              onChange={e => updateSection(idx, 'isRepeatable', e.target.checked)}
                            />
                            <span>Repeatable</span>
                          </label>
                        </div>
                        <textarea
                          value={section.instruction}
                          onChange={e => updateSection(idx, 'instruction', e.target.value)}
                          placeholder="What should the AI create for this slide?"
                          rows={2}
                          className="fs-section-instruction"
                        />
                        {section.isRepeatable && (
                          <input
                            type="text"
                            value={section.repeatSource}
                            onChange={e => updateSection(idx, 'repeatSource', e.target.value)}
                            placeholder="Repeat source (e.g., one per approach step)"
                            className="fs-section-repeat-input"
                          />
                        )}
                      </div>

                      <div className="fs-section-actions">
                        <button onClick={() => duplicateSection(idx)} title="Duplicate section" className="fs-section-action-btn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </button>
                        <button onClick={() => removeSection(idx)} title="Remove section" className="fs-section-action-btn fs-section-action-danger">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="fs-editor-footer">
                  <button className="fs-cancel-btn" onClick={() => { setEditingFlow(null); setSelectedFlowId(null); }}>Cancel</button>
                  <button className="fs-save-btn" onClick={saveFlow} disabled={!editingFlow.name.trim()}>
                    {editingFlow.id ? 'Update Flow' : 'Save Flow'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
