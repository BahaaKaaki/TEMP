import { useState } from 'react';
import { useSlides } from '../context/SlideContext';

// Storyline Panel - shows story points with editing capability
export default function StorylinePanel({ onGenerateSkeletons = null, compact = false, defaultExpanded = false }) {
  const { state, actions } = useSlides();
  const [editingPoint, setEditingPoint] = useState(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  const handleSync = (direction) => {
    if (direction === 'from-slides') {
      if (window.confirm('Rebuild storyline from current slides? This will update storyline to match slide titles and order.')) {
        actions.syncStorylineFromSlides();
      }
    } else if (direction === 'from-storyline') {
      if (window.confirm('Reorder slides to match storyline? Slide titles will be updated from storyline.')) {
        actions.syncSlidesFromStoryline();
      }
    }
    setShowSyncMenu(false);
  };

  const storyline = state.storyline || [];

  if (storyline.length === 0) {
    return null;
  }

  const handleEditPoint = (point) => {
    setEditingPoint({ ...point });
  };

  const handleSavePoint = () => {
    if (editingPoint) {
      actions.updateStorylinePoint(editingPoint.id, {
        title: editingPoint.title,
        description: editingPoint.description,
        keyMessage: editingPoint.keyMessage,
        suggestedLayout: editingPoint.suggestedLayout,
      });
      setEditingPoint(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingPoint(null);
  };

  // Layout options
  const layoutOptions = [
    { value: 'cover', label: 'Cover' },
    { value: 'three-card', label: 'Three Cards' },
    { value: 'two-column', label: 'Two Column' },
    { value: 'timeline', label: 'Timeline' },
    { value: 'quote', label: 'Quote' },
    { value: 'content-list', label: 'Content List' },
    { value: '2x2-grid', label: '2x2 Grid' },
  ];

  // Get slides mapped to story points
  const getSlideForPoint = (pointId) => {
    return state.slides.find(s => s.storyPointId === pointId);
  };

  if (compact) {
    return (
      <div className="storyline-compact">
        <div className="storyline-flow">
          {storyline.map((point, idx) => {
            const slide = getSlideForPoint(point.id);
            return (
              <div key={point.id} className="storyline-item">
                <div className={`storyline-dot ${slide ? (slide.isSkeleton ? 'skeleton' : 'filled') : 'pending'}`}>
                  {idx + 1}
                </div>
                <div className="storyline-label">{point.title}</div>
                {idx < storyline.length - 1 && <div className="storyline-connector" />}
              </div>
            );
          })}
        </div>
        <style>{`
          .storyline-compact {
            padding: 8px 0;
          }
          .storyline-flow {
            display: flex;
            align-items: flex-start;
            gap: 4px;
            overflow-x: auto;
            padding: 4px 0;
          }
          .storyline-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            min-width: 60px;
          }
          .storyline-dot {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
            color: white;
          }
          .storyline-dot.pending {
            background: #94a3b8;
          }
          .storyline-dot.skeleton {
            background: #f59e0b;
          }
          .storyline-dot.filled {
            background: #10b981;
          }
          .storyline-label {
            font-size: 9px;
            color: var(--text-muted, #666);
            text-align: center;
            margin-top: 4px;
            max-width: 80px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .storyline-connector {
            position: absolute;
            top: 12px;
            left: 100%;
            width: 20px;
            height: 2px;
            background: var(--border-color, #e0e0e0);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="storyline-panel">
      {/* Header */}
      <div
        className="storyline-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="storyline-header-left">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>Storyline</span>
          <span className="storyline-count">{storyline.length} points</span>
        </div>
        <div className="storyline-header-right">
          {onGenerateSkeletons && (
            <button
              className="btn btn-sm btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateSkeletons();
              }}
            >
              Generate Skeletons
            </button>
          )}

          {/* Sync Button with Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-sm btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                setShowSyncMenu(!showSyncMenu);
              }}
              title="Sync slides & storyline"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Sync
            </button>
            {showSyncMenu && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSyncMenu(false);
                  }}
                />
                <div className="sync-menu">
                  <div className="sync-menu-title">Choose Source of Truth</div>
                  <button
                    className="sync-menu-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSync('from-slides');
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8" />
                      <path d="M12 17v4" />
                    </svg>
                    <div className="sync-menu-option-text">
                      <span className="sync-menu-option-label">Slides → Storyline</span>
                      <span className="sync-menu-option-desc">Update storyline from current slides</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    className="sync-menu-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSync('from-storyline');
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <div className="sync-menu-option-text">
                      <span className="sync-menu-option-label">Storyline → Slides</span>
                      <span className="sync-menu-option-desc">Reorder slides to match storyline</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            className="btn btn-sm btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Clear the storyline?')) {
                actions.clearStoryline();
              }
            }}
            title="Clear storyline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Story Points */}
      {isExpanded && (
        <div className="storyline-content">
          {storyline.map((point, idx) => {
            const slide = getSlideForPoint(point.id);
            const isEditing = editingPoint?.id === point.id;

            return (
              <div key={point.id} className={`story-point ${slide ? 'has-slide' : ''}`}>
                <div className="story-point-number">{idx + 1}</div>
                <div className="story-point-content">
                  {isEditing ? (
                    // Edit mode
                    <div className="story-point-edit">
                      <input
                        type="text"
                        value={editingPoint.title}
                        onChange={(e) => setEditingPoint({ ...editingPoint, title: e.target.value })}
                        placeholder="Title"
                        className="story-point-input"
                      />
                      <textarea
                        value={editingPoint.description}
                        onChange={(e) => setEditingPoint({ ...editingPoint, description: e.target.value })}
                        placeholder="Description"
                        className="story-point-textarea"
                        rows={2}
                      />
                      <input
                        type="text"
                        value={editingPoint.keyMessage}
                        onChange={(e) => setEditingPoint({ ...editingPoint, keyMessage: e.target.value })}
                        placeholder="Key message"
                        className="story-point-input"
                      />
                      <select
                        value={editingPoint.suggestedLayout}
                        onChange={(e) => setEditingPoint({ ...editingPoint, suggestedLayout: e.target.value })}
                        className="story-point-select"
                      >
                        {layoutOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="story-point-edit-actions">
                        <button className="btn btn-sm btn-primary" onClick={handleSavePoint}>Save</button>
                        <button className="btn btn-sm btn-ghost" onClick={handleCancelEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="story-point-header">
                        <h4 className="story-point-title">{point.title}</h4>
                        <span className="story-point-layout">{point.suggestedLayout}</span>
                      </div>
                      {point.keyMessage && (
                        <p className="story-point-message">{point.keyMessage}</p>
                      )}
                      {point.description && (
                        <p className="story-point-description">{point.description}</p>
                      )}
                      {slide && (
                        <div className={`story-point-slide-status ${slide.isSkeleton ? 'skeleton' : 'filled'}`}>
                          {slide.isSkeleton ? 'Skeleton created' : 'Slide complete'}
                          {slide.skeletonApproved && ' (approved)'}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="story-point-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleEditPoint(point)}
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .storyline-panel {
          background: var(--bg-secondary, #f8f9fa);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          margin: 12px 0;
        }

        .storyline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          cursor: pointer;
          user-select: none;
        }

        .storyline-header:hover {
          background: rgba(0, 0, 0, 0.02);
        }

        .storyline-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 13px;
        }

        .storyline-count {
          font-weight: normal;
          font-size: 11px;
          color: var(--text-muted, #666);
          background: var(--border-color, #e0e0e0);
          padding: 2px 8px;
          border-radius: 10px;
        }

        .storyline-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .storyline-content {
          padding: 0 14px 14px;
          max-height: 300px;
          overflow-y: auto;
        }

        .story-point {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: white;
          border-radius: 6px;
          margin-top: 8px;
          border-left: 3px solid var(--border-color, #e0e0e0);
        }

        .story-point.has-slide {
          border-left-color: #10b981;
        }

        .story-point-number {
          width: 24px;
          height: 24px;
          background: var(--primary-color, #3b82f6);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .story-point-content {
          flex: 1;
          min-width: 0;
        }

        .story-point-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .story-point-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #333);
        }

        .story-point-layout {
          font-size: 10px;
          padding: 2px 6px;
          background: var(--border-color, #e0e0e0);
          border-radius: 4px;
          color: var(--text-muted, #666);
          text-transform: capitalize;
        }

        .story-point-message {
          margin: 4px 0;
          font-size: 12px;
          color: var(--primary-color, #3b82f6);
          font-style: italic;
        }

        .story-point-description {
          margin: 4px 0 0 0;
          font-size: 11px;
          color: var(--text-muted, #666);
          line-height: 1.4;
        }

        .story-point-slide-status {
          margin-top: 8px;
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-block;
        }

        .story-point-slide-status.skeleton {
          background: #fef3c7;
          color: #92400e;
        }

        .story-point-slide-status.filled {
          background: #d1fae5;
          color: #065f46;
        }

        .story-point-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .btn-icon {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
          color: var(--text-muted, #666);
        }

        .btn-icon:hover {
          opacity: 1;
        }

        .story-point-edit {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .story-point-input,
        .story-point-textarea,
        .story-point-select {
          padding: 6px 10px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 4px;
          font-size: 12px;
          background: white;
        }

        .story-point-input:focus,
        .story-point-textarea:focus,
        .story-point-select:focus {
          outline: none;
          border-color: var(--primary-color, #3b82f6);
        }

        .story-point-textarea {
          resize: vertical;
        }

        .story-point-edit-actions {
          display: flex;
          gap: 8px;
        }

        /* Sync Menu */
        .sync-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          padding: 8px 0;
          min-width: 260px;
          z-index: 100;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .sync-menu-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #666);
          padding: 4px 12px 8px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sync-menu-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
        }

        .sync-menu-option:hover {
          background: var(--bg-secondary, #f8f9fa);
        }

        .sync-menu-option svg:first-child {
          color: var(--primary-color, #3b82f6);
          flex-shrink: 0;
        }

        .sync-menu-option svg:last-child {
          color: var(--text-muted, #999);
          flex-shrink: 0;
          margin-left: auto;
        }

        .sync-menu-option-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sync-menu-option-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #333);
        }

        .sync-menu-option-desc {
          font-size: 11px;
          color: var(--text-muted, #666);
        }
      `}</style>
    </div>
  );
}
