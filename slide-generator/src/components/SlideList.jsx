import { useState, useRef, useEffect, useCallback } from 'react';
import { useSlides } from '../context/SlideContext';
import { SLIDE_TEMPLATES, getTemplatesByCategory, getEmptySlideTemplates } from '../utils/slideTemplates';
import { generateEmptySlideHTML } from '../utils/slideMasters';
import { extractRelevantCSS } from '../services/aiService';
import { VIBE_AWARE_CSS } from '../utils/vibes';
import SlideValidationModal from './SlideValidationModal';
import TemplatePicker from './TemplatePicker';

export default function SlideList() {
  const { state, actions, activeSlide } = useSlides();
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredSlide, setHoveredSlide] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [validatingSlide, setValidatingSlide] = useState(null);
  const [dragTarget, setDragTarget] = useState(null); // { id, position: 'before'|'after'|'child' }
  const selectedSlides = new Set(state.selectedSlideIds || []);
  const setSelectedSlides = (setOrFn) => {
    const newSet = typeof setOrFn === 'function' ? setOrFn(selectedSlides) : setOrFn;
    actions.setSelectedSlides([...newSet]);
  };
  const lastClickedIndexRef = useRef(null);
  const slideListRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const scrollAnimRef = useRef(null);

  // Build tree structure from flat slides based on parentId
  const buildSlideTree = (slides) => {
    const rootSlides = slides.filter(s => !s.parentId);
    const getChildren = (parentId) => slides.filter(s => s.parentId === parentId);
    const buildNode = (slide, depth = 0) => ({
      ...slide,
      depth,
      children: getChildren(slide.id).map(s => buildNode(s, depth + 1)),
    });
    return rootSlides.map(s => buildNode(s, 0));
  };

  // Flatten tree back to display order
  const flattenTree = (nodes, result = []) => {
    nodes.forEach(node => {
      const { children, ...slide } = node;
      result.push({ ...slide, hasChildren: children.length > 0 });
      if (children.length > 0) {
        flattenTree(children, result);
      }
    });
    return result;
  };

  const slideTree = buildSlideTree(state.slides);
  const flatSlides = flattenTree(slideTree);

  // Multi-select click handler
  const handleSlideClick = (e, slide, index) => {
    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    if (isMeta) {
      // Toggle individual selection
      setSelectedSlides(prev => {
        const next = new Set(prev);
        if (next.has(slide.id)) next.delete(slide.id);
        else next.add(slide.id);
        return next;
      });
      lastClickedIndexRef.current = index;
    } else if (isShift && lastClickedIndexRef.current != null) {
      // Range select
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const ids = flatSlides.slice(start, end + 1).map(s => s.id);
      setSelectedSlides(new Set(ids));
    } else {
      // Plain click - single select
      setSelectedSlides(new Set([slide.id]));
      lastClickedIndexRef.current = index;
    }
    actions.setActiveSlide(slide.id);
  };

  // Clear selection on Escape or clicking empty area
  const handleListClick = (e) => {
    if (e.target === slideListRef.current) {
      setSelectedSlides(new Set());
    }
  };

  // Get depth for any slide
  const getSlideDepth = (slideId) => {
    const slide = flatSlides.find(s => s.id === slideId);
    return slide?.depth || 0;
  };

  // Handle validation button click
  const handleValidate = (e, slide, index) => {
    e.stopPropagation();
    setValidatingSlide({ slide, index });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle when not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      const currentIndex = state.slides.findIndex(s => s.id === activeSlide?.id);

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          actions.setActiveSlide(state.slides[currentIndex - 1].id);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex < state.slides.length - 1) {
          actions.setActiveSlide(state.slides[currentIndex + 1].id);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (state.slides.length > 0) {
          actions.setActiveSlide(state.slides[0].id);
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        if (state.slides.length > 0) {
          actions.setActiveSlide(state.slides[state.slides.length - 1].id);
        }
      } else if (e.key === 'Delete' && activeSlide && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (window.confirm('Delete this slide?')) {
          actions.deleteSlide(activeSlide.id);
        }
      } else if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && activeSlide) {
        e.preventDefault();
        handleDuplicate(null, activeSlide);
      } else if (e.key === 'Escape') {
        setSelectedSlides(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.slides, activeSlide, actions]);

  const handleDragStart = (e, slide) => {
    // If dragging a non-selected slide, reset selection to just this one
    const effectiveSelection = selectedSlides.has(slide.id) && selectedSlides.size > 1
      ? selectedSlides
      : new Set([slide.id]);
    if (!selectedSlides.has(slide.id)) {
      setSelectedSlides(effectiveSelection);
    }

    e.dataTransfer.setData('slideId', slide.id);
    e.dataTransfer.setData('selectedIds', JSON.stringify([...effectiveSelection]));
    e.dataTransfer.effectAllowed = 'move';

    // Show drag preview count for multi-select
    if (effectiveSelection.size > 1) {
      const badge = document.createElement('div');
      badge.textContent = `${effectiveSelection.size} slides`;
      badge.style.cssText = 'padding:4px 10px;background:var(--accent,#3b82f6);color:#fff;border-radius:12px;font-size:12px;font-weight:600;position:absolute;top:-9999px';
      document.body.appendChild(badge);
      e.dataTransfer.setDragImage(badge, 30, 14);
      requestAnimationFrame(() => document.body.removeChild(badge));
    }
  };

  // Drag-scroll: auto-scroll when dragging near edges
  const dragScrollSpeedRef = useRef(0);
  const startDragScroll = useCallback((clientY) => {
    const container = slideListRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const EDGE_ZONE = 40;
    const topDist = clientY - rect.top;
    const bottomDist = rect.bottom - clientY;

    let speed = 0;
    if (topDist < EDGE_ZONE && topDist >= 0) {
      speed = -((EDGE_ZONE - topDist) / EDGE_ZONE) * 12;
    } else if (bottomDist < EDGE_ZONE && bottomDist >= 0) {
      speed = ((EDGE_ZONE - bottomDist) / EDGE_ZONE) * 12;
    }

    dragScrollSpeedRef.current = speed;

    if (speed !== 0) {
      if (!scrollAnimRef.current) {
        const tick = () => {
          container.scrollTop += dragScrollSpeedRef.current;
          scrollAnimRef.current = requestAnimationFrame(tick);
        };
        scrollAnimRef.current = requestAnimationFrame(tick);
      }
    } else {
      if (scrollAnimRef.current) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
    }
  }, []);

  const stopDragScroll = useCallback(() => {
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  }, []);

  const handleDragOver = (e, targetSlide) => {
    e.preventDefault();
    startDragScroll(e.clientY);
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Determine drop position: top third = before, middle third = child, bottom third = after
    let position = 'after';
    if (y < height * 0.3) {
      position = 'before';
    } else if (y < height * 0.7) {
      position = 'child';
    }

    setDragTarget({ id: targetSlide.id, position });
  };

  const handleDragLeave = () => {
    setDragTarget(null);
  };

  const handleDrop = (e, targetSlide) => {
    e.preventDefault();
    stopDragScroll();
    const draggedId = e.dataTransfer.getData('slideId');
    let selectedIdsRaw = e.dataTransfer.getData('selectedIds');
    let draggedIds = [];
    try { draggedIds = JSON.parse(selectedIdsRaw); } catch { draggedIds = [draggedId]; }
    if (!draggedIds.length) draggedIds = [draggedId];

    if (!draggedId || draggedIds.includes(targetSlide.id)) {
      setDragTarget(null);
      return;
    }

    const position = dragTarget?.position || 'after';

    if (draggedIds.length === 1) {
      // Single drag - original behavior
      if (position === 'child') {
        actions.setSlideParent(draggedId, targetSlide.id);
      } else {
        const fromIndex = state.slides.findIndex(s => s.id === draggedId);
        let toIndex = state.slides.findIndex(s => s.id === targetSlide.id);
        if (fromIndex === -1 || toIndex === -1) { setDragTarget(null); return; }
        if (position === 'after') toIndex = toIndex + 1;
        const newParentId = position === 'before' || position === 'after'
          ? targetSlide.parentId : null;
        actions.moveSlide(draggedId, newParentId, toIndex);
      }
    } else {
      // Multi-drag: move all selected slides maintaining relative order
      // Get them in their current order
      const orderedIds = state.slides.filter(s => draggedIds.includes(s.id)).map(s => s.id);
      let targetIndex = state.slides.findIndex(s => s.id === targetSlide.id);
      if (position === 'after') targetIndex += 1;

      if (position === 'child') {
        // Parent all of them under target
        orderedIds.forEach(id => actions.setSlideParent(id, targetSlide.id));
      } else {
        // Atomic batch move — avoids stale closure from forEach + individual dispatches
        const newParentId = targetSlide.parentId || null;
        actions.moveSlidesBatch(orderedIds, newParentId, targetIndex);
      }
    }

    setDragTarget(null);
  };

  const handleDragEnd = () => {
    setDragTarget(null);
    stopDragScroll();
  };

  // Indent: make slide a child of the previous sibling
  const handleIndent = (slide) => {
    const slideIndex = flatSlides.findIndex(s => s.id === slide.id);
    if (slideIndex > 0) {
      // Find previous sibling at same level
      const prevSibling = flatSlides.slice(0, slideIndex).reverse().find(s => s.parentId === slide.parentId);
      if (prevSibling) {
        actions.setSlideParent(slide.id, prevSibling.id);
      }
    }
  };

  // Outdent: move slide up one level
  const handleOutdent = (slide) => {
    if (slide.parentId) {
      const parent = state.slides.find(s => s.id === slide.parentId);
      actions.setSlideParent(slide.id, parent?.parentId || null);
    }
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (window.confirm('Delete this slide?')) {
      actions.deleteSlide(id);
    }
  };

  const handleDuplicate = (e, slide) => {
    if (e) e.stopPropagation();
    actions.addSlide({
      title: `${slide.title} (copy)`,
      type: slide.type,
      html: slide.html,
      customCSS: slide.customCSS,
    });
  };

  const handleAddFromTemplate = (templateKey) => {
    // Handle empty master templates (e.g., "empty-standard", "empty-cover")
    if (templateKey && templateKey.startsWith('empty-')) {
      const masterId = templateKey.replace('empty-', '');
      const emptyTemplates = getEmptySlideTemplates();
      const emptyTemplate = emptyTemplates.find(t => t.id === templateKey);

      if (emptyTemplate) {
        const relevantCSS = extractRelevantCSS(emptyTemplate.html);
        actions.addSlide({
          title: emptyTemplate.title.replace('Empty: ', ''),
          type: 'empty',
          html: emptyTemplate.html,
          customCSS: relevantCSS,
          templateId: templateKey,
          master: masterId,
        });
        setShowTemplateMenu(false);
        return;
      }
    }

    // Handle both built-in and custom templates
    let template = SLIDE_TEMPLATES[templateKey];

    // If not in built-in, check custom templates
    if (!template && state.customTemplates) {
      template = state.customTemplates.find(t => t.id === templateKey);
    }

    if (template) {
      // Extract relevant CSS for this template's HTML
      const relevantCSS = extractRelevantCSS(template.html);

      actions.addSlide({
        title: template.title,
        type: templateKey,
        html: template.html,
        customCSS: relevantCSS,
        templateId: templateKey,
      });
    } else if (templateKey === null) {
      // Freestyle - use standard empty master
      const standardHtml = generateEmptySlideHTML('standard');
      const relevantCSS = extractRelevantCSS(standardHtml);

      actions.addSlide({
        title: 'New Slide',
        type: 'custom',
        html: standardHtml,
        customCSS: relevantCSS,
        master: 'standard',
      });
    }
    setShowTemplateMenu(false);
  };

  // Hover preview handling
  const handleMouseEnter = useCallback((slide, e) => {
    clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredSlide(slide);
      setHoverPosition({
        x: rect.right + 16,
        y: Math.min(rect.top, window.innerHeight - 320),
      });
    }, 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeoutRef.current);
    setHoveredSlide(null);
  }, []);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {!isCollapsed && (
        <>
          <div className="sidebar-header">
            <h2>Slides ({state.slides.length})
              {selectedSlides.size > 1 && (
                <span style={{
                  marginLeft: 8, fontSize: 11, padding: '2px 8px',
                  background: 'var(--accent, #3b82f6)', color: '#fff',
                  borderRadius: 10, fontWeight: 600, verticalAlign: 'middle',
                }}>{selectedSlides.size} selected</span>
              )}
            </h2>
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                title="Add new slide"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              {showTemplateMenu && (
                <div className="sidebar-template-picker">
                  <TemplatePicker
                    selectedTemplate={null}
                    onSelect={(templateId) => {
                      handleAddFromTemplate(templateId);
                      setShowTemplateMenu(false);
                    }}
                    showFreestyle={true}
                    compact={true}
                    initiallyOpen={true}
                    title="Add Slide"
                    onClose={() => setShowTemplateMenu(false)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="keyboard-hints">
            <span title="Navigate slides">↑↓</span>
            <span title="Duplicate (Ctrl+D)">⌘D</span>
            <span title="Delete">Del</span>
          </div>

          <div className="slide-list" ref={slideListRef} onClick={handleListClick}>
            {state.slides.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 20px' }}>
                <div className="empty-state-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                  </svg>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Click the AI button to generate slides
                </p>
              </div>
            ) : (
              flatSlides.map((slide, index) => {
                const isDragTarget = dragTarget?.id === slide.id;
                const dragPosition = isDragTarget ? dragTarget.position : null;
                const isHighlighted = state.highlightedSlideIndices?.includes(index);

                return (
                  <div
                    key={slide.id}
                    className={`slide-item ${activeSlide?.id === slide.id ? 'active' : ''} ${selectedSlides.has(slide.id) ? 'selected' : ''} ${isDragTarget ? `drag-target-${dragPosition}` : ''} ${isHighlighted ? 'context-highlighted' : ''}`}
                    style={{
                      paddingLeft: `${12 + (slide.depth || 0) * 16}px`,
                      ...(selectedSlides.has(slide.id) ? {
                        borderLeft: '2px solid var(--accent, #3b82f6)',
                        background: 'rgba(59, 130, 246, 0.06)',
                      } : {}),
                    }}
                    onClick={(e) => handleSlideClick(e, slide, index)}
                    onMouseEnter={(e) => handleMouseEnter(slide, e)}
                    onMouseLeave={handleMouseLeave}
                    draggable
                    onDragStart={(e) => handleDragStart(e, slide)}
                    onDragOver={(e) => handleDragOver(e, slide)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, slide)}
                    onDragEnd={handleDragEnd}
                  >
                    {/* Hierarchy indicator */}
                    {(slide.depth || 0) > 0 && (
                      <div className="slide-hierarchy-indicator">
                        <span className="hierarchy-line" />
                      </div>
                    )}

                    {/* Slide thumbnail - key forces re-render on content change */}
                    <div className="slide-item-thumbnail">
                      <SlideThumbnail html={slide.html} vibe={state.vibe} darkMode={state.darkMode} sectionLabel={slide.sectionLabel} key={`thumb-${slide.id}-${slide.updatedAt || ''}`} />
                      {/* Child indicator */}
                      {slide.hasChildren && (
                        <div className="slide-children-badge" title="Has sub-slides">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 10l5 5 5-5z"/>
                          </svg>
                        </div>
                      )}
                      {/* Comment indicator badge */}
                      {(slide.comments || []).filter(c => !c.addressed).length > 0 && (
                        <div className="slide-comment-badge" title={`${(slide.comments || []).filter(c => !c.addressed).length} pending comment(s)`}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <span>{(slide.comments || []).filter(c => !c.addressed).length}</span>
                        </div>
                      )}
                      {/* Skeleton indicator badge */}
                      {slide.isSkeleton && (
                        <div
                          className={`slide-skeleton-badge ${slide.skeletonApproved ? 'approved' : ''}`}
                          title={slide.skeletonApproved ? 'Skeleton approved' : 'Click to approve skeleton'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!slide.skeletonApproved) {
                              actions.approveSkeleton(slide.id);
                            }
                          }}
                          style={{ cursor: slide.skeletonApproved ? 'default' : 'pointer' }}
                        >
                          {slide.skeletonApproved ? '✓' : '🦴'}
                        </div>
                      )}
                    </div>

                    <div className="slide-item-content">
                      <div className="slide-item-header">
                        <span className="slide-item-number">#{index + 1}</span>
                        <div className="slide-item-actions">
                          {/* Indent/Outdent buttons */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleIndent(slide); }}
                            title="Indent (make child)"
                            disabled={index === 0}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOutdent(slide); }}
                            title="Outdent (move up level)"
                            disabled={!slide.parentId}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M15 18l-6-6 6-6" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleValidate(e, slide, index)}
                            title="Validate PPTX quality"
                            className="validate-btn"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 12l2 2 4-4" />
                              <circle cx="12" cy="12" r="10" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDuplicate(e, slide)}
                            title="Duplicate (Ctrl+D)"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, slide.id)}
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="slide-item-title">{slide.title || 'Untitled'}</div>
                      <div className="slide-item-type">{getTypeLabel(slide.type)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {isCollapsed && (
        <div className="sidebar-collapsed-content">
          <div className="collapsed-slide-count">{state.slides.length}</div>
          <div className="collapsed-label">slides</div>
        </div>
      )}

      {/* Hover preview popover */}
      {hoveredSlide && !isCollapsed && (
        <div
          className="slide-hover-preview"
          style={{
            position: 'fixed',
            left: hoverPosition.x,
            top: hoverPosition.y,
          }}
        >
          <div className="hover-preview-content">
            <SlideHoverPreview html={hoveredSlide.html} vibe={state.vibe} darkMode={state.darkMode} sectionLabel={hoveredSlide.sectionLabel} />
          </div>
          <div className="hover-preview-title">{hoveredSlide.title}</div>
        </div>
      )}

      {/* Slide Validation Modal */}
      {validatingSlide && (
        <SlideValidationModal
          slide={validatingSlide.slide}
          slideIndex={validatingSlide.index}
          settings={state.settings}
          onClose={() => setValidatingSlide(null)}
          onUpdateSlide={(updates) => {
            actions.updateSlide(validatingSlide.slide.id, updates);
          }}
        />
      )}
    </aside>
  );
}

// Inject data-vibe and data-dark-mode attributes into slide HTML for CSS styling
function injectVibeAttribute(html, vibe, darkMode) {
  // Remove existing attributes first
  let cleanHtml = html.replace(/\s*data-vibe="[^"]*"/g, '');
  cleanHtml = cleanHtml.replace(/\s*data-dark-mode="[^"]*"/g, '');

  // Build attributes string
  let attrs = '';
  if (vibe && vibe !== 'default') {
    attrs += ` data-vibe="${vibe}"`;
  }
  if (darkMode) {
    attrs += ` data-dark-mode="true"`;
  }

  if (!attrs) return cleanHtml;

  return cleanHtml.replace(
    /class="slide([^"]*)"/,
    `class="slide$1"${attrs}`
  );
}

// Inject data-section attribute for section tracker
function injectSectionAttribute(html, sectionLabel) {
  if (!sectionLabel || !html) return html;
  const escaped = sectionLabel.replace(/"/g, '&quot;');
  const cleanHtml = html.replace(/\s*data-section="[^"]*"/g, '');
  return cleanHtml.replace(
    /class="slide([^"]*)"/,
    `class="slide$1" data-section="${escaped}"`
  );
}

// Mini thumbnail component (scaled down)
function SlideThumbnail({ html, vibe = 'default', darkMode = false, sectionLabel }) {
  // Ensure section-divider slides have the blank master class
  let safeHtml = html;
  if (safeHtml && safeHtml.includes('section-divider-slide') && !safeHtml.includes('master-blank')) {
    safeHtml = safeHtml.replace(/class="slide([^"]*)"/, 'class="slide master-blank$1"');
  }
  let vibeHtml = injectVibeAttribute(safeHtml, vibe, darkMode);
  vibeHtml = injectSectionAttribute(vibeHtml, sectionLabel);
  return (
    <div className="thumbnail-wrapper">
      <div
        className="thumbnail-slide"
        dangerouslySetInnerHTML={{ __html: vibeHtml }}
      />
    </div>
  );
}

// Larger hover preview component
function SlideHoverPreview({ html, vibe = 'default', darkMode = false, sectionLabel }) {
  let vibeHtml = injectVibeAttribute(html, vibe, darkMode);
  vibeHtml = injectSectionAttribute(vibeHtml, sectionLabel);
  return (
    <div className="hover-slide-wrapper">
      <style>{getPreviewCSS()}</style>
      <div
        className="hover-slide-content"
        dangerouslySetInnerHTML={{ __html: vibeHtml }}
      />
    </div>
  );
}

function getTypeLabel(type) {
  const labels = {
    cover: 'Cover Slide',
    'three-cards': 'Three Cards',
    kpi: 'KPI Metrics',
    timeline: 'Timeline',
    quote: 'Quote',
    bullets: 'Bullet Points',
    grid: '2x2 Grid',
    table: 'Comparison Table',
    flow: 'Process Flow',
    stat: 'Stat Highlight',
    custom: 'Custom Layout',
  };
  return labels[type] || 'Custom';
}

// Minimal CSS for hover preview - only container styles
// Slide content styles come from globally imported slides.css
function getPreviewCSS() {
  return `
.hover-slide-wrapper {
  width: 320px;
  height: 180px;
  overflow: hidden;
  background: white;
  border-radius: 4px;
}

.hover-slide-content {
  transform: scale(0.333);
  transform-origin: top left;
  width: 960px;
  height: 540px;
}
`;
}
