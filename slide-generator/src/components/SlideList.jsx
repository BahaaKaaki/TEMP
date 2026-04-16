import { useState, useRef, useEffect, useCallback } from 'react';
import { useSlides } from '../context/SlideContext';
import { SLIDE_TEMPLATES, getTemplatesByCategory, getEmptySlideTemplates } from '../utils/slideTemplates';
import { generateEmptySlideHTML } from '../utils/slideMasters';
import { extractRelevantCSS } from '../services/aiService';
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
          const id = state.slides[currentIndex - 1].id;
          actions.setActiveSlide(id);
          setSelectedSlides(new Set([id]));
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex < state.slides.length - 1) {
          const id = state.slides[currentIndex + 1].id;
          actions.setActiveSlide(id);
          setSelectedSlides(new Set([id]));
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (state.slides.length > 0) {
          const id = state.slides[0].id;
          actions.setActiveSlide(id);
          setSelectedSlides(new Set([id]));
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        if (state.slides.length > 0) {
          const id = state.slides[state.slides.length - 1].id;
          actions.setActiveSlide(id);
          setSelectedSlides(new Set([id]));
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (selectedSlides.size > 1) {
          if (window.confirm(`Delete ${selectedSlides.size} selected slides?`)) {
            [...selectedSlides].forEach(id => actions.deleteSlide(id));
            setSelectedSlides(new Set());
          }
        } else if (activeSlide) {
          if (window.confirm('Delete this slide?')) {
            actions.deleteSlide(activeSlide.id);
          }
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
  }, [state.slides, state.selectedSlideIds, activeSlide, actions]);

  // Scroll active slide thumbnail into view when it changes
  useEffect(() => {
    if (!activeSlide || !slideListRef.current) return;
    const activeEl = slideListRef.current.querySelector('.slide-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeSlide?.id]);

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
      const relevantCSS = extractRelevantCSS(template.html, template.css || '');

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
            <span title="Arrow keys to navigate slides">Arrows</span>
            <span title="Hold Shift and click to select multiple slides">Shift + Click</span>
            <span title="Delete selected slides">Del</span>
          </div>

          {/* Multi-select action bar */}
          {selectedSlides.size >= 2 && (
            <div className="multi-select-bar">
              <span className="multi-select-label">{selectedSlides.size} slides selected</span>
              <button
                className="multi-select-delete-btn"
                onClick={() => {
                  if (window.confirm(`Delete ${selectedSlides.size} selected slides?`)) {
                    [...selectedSlides].forEach(id => actions.deleteSlide(id));
                    setSelectedSlides(new Set());
                  }
                }}
                title={`Delete ${selectedSlides.size} selected slides`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete
              </button>
              <button
                className="multi-select-clear-btn"
                onClick={() => setSelectedSlides(new Set())}
                title="Clear selection"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

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
                    key={slide.id || `slide-${index}`}
                    className={`slide-item ${activeSlide?.id === slide.id ? 'active' : ''} ${selectedSlides.has(slide.id) ? 'selected' : ''} ${isDragTarget ? `drag-target-${dragPosition}` : ''} ${isHighlighted ? 'context-highlighted' : ''}`}
                    style={{
                      paddingLeft: `${12 + (slide.depth || 0) * 16}px`,
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

                    {/* Slide thumbnail with number overlay */}
                    <div className="slide-item-thumbnail">
                      <SlideThumbnail html={slide.html} customCSS={slide.customCSS} slideId={slide.id} darkMode={state.darkMode} sectionLabel={slide.sectionLabel} key={`thumb-${slide.id || index}-${slide.updatedAt || ''}`} />
                      <span className="slide-number-badge">{index + 1}</span>
                      {/* Comment indicator badge -- hidden, functionality preserved */}
                      {false && (slide.comments || []).filter(c => !c.addressed).length > 0 && (
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

                    {/* Hover-reveal action buttons */}
                    <div className="slide-item-actions">
                      <button onClick={(e) => handleDuplicate(e, slide)} title="Duplicate slide">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button onClick={(e) => handleDelete(e, slide.id)} title="Delete slide">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
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
            <SlideHoverPreview html={hoveredSlide.html} customCSS={hoveredSlide.customCSS} slideId={hoveredSlide.id} darkMode={state.darkMode} sectionLabel={hoveredSlide.sectionLabel} />
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

// Inject data-dark-mode into slide HTML for CSS styling (strip stale data-vibe)
function injectDarkModeAttribute(html, darkMode) {
  let cleanHtml = html.replace(/\s*data-vibe="[^"]*"/g, '');
  cleanHtml = cleanHtml.replace(/\s*data-dark-mode="[^"]*"/g, '');
  if (!darkMode) return cleanHtml;
  return cleanHtml.replace(
    /class="slide([^"]*)"/,
    `class="slide$1" data-dark-mode="true"`
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

// Mini thumbnail component -- dynamically scales 960x540 slide to fit container
function SlideThumbnail({ html, customCSS, slideId, darkMode = false, sectionLabel }) {
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(0.13);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setScale(w / 960);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let safeHtml = html;
  if (safeHtml && safeHtml.includes('section-divider-slide') && !safeHtml.includes('master-blank')) {
    safeHtml = safeHtml.replace(/class="slide([^"]*)"/, 'class="slide master-blank$1"');
  }
  let previewHtml = injectDarkModeAttribute(safeHtml, darkMode);
  previewHtml = injectSectionAttribute(previewHtml, sectionLabel);
  // Inject data-slide-id so scoped CSS selectors match
  if (slideId && previewHtml && !previewHtml.includes('data-slide-id')) {
    previewHtml = previewHtml.replace(/class="slide([^"]*)"/, `class="slide$1" data-slide-id="${slideId}"`);
  }
  const cssTag = customCSS ? `<style>${customCSS}</style>` : '';
  return (
    <div className="thumbnail-wrapper" ref={wrapperRef}>
      <div
        className="thumbnail-slide"
        style={{ transform: `scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: cssTag + previewHtml }}
      />
    </div>
  );
}

// Larger hover preview component
function SlideHoverPreview({ html, customCSS, slideId, darkMode = false, sectionLabel }) {
  let previewHtml = injectDarkModeAttribute(html, darkMode);
  previewHtml = injectSectionAttribute(previewHtml, sectionLabel);
  if (slideId && previewHtml && !previewHtml.includes('data-slide-id')) {
    previewHtml = previewHtml.replace(/class="slide([^"]*)"/, `class="slide$1" data-slide-id="${slideId}"`);
  }
  const cssTag = customCSS ? `<style>${customCSS}</style>` : '';
  return (
    <div className="hover-slide-wrapper">
      <style>{getPreviewCSS()}</style>
      <div
        className="hover-slide-content"
        dangerouslySetInnerHTML={{ __html: cssTag + previewHtml }}
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
