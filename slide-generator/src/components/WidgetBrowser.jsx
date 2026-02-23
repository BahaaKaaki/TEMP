import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { slideWidgets, WIDGET_CATEGORIES, getWidgetsByCategory } from '../utils/slideWidgets';
import { useSlides } from '../context/SlideContext';

// Widget preview with scaled slide rendering
function WidgetPreview({ widget, onInsert, onCopy }) {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(widget.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopy) onCopy(widget);
  };

  return (
    <div
      className={`widget-card ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Visual Preview */}
      <div className="widget-card-preview">
        <div className="widget-preview-inner">
          <div
            className="widget-html-render"
            dangerouslySetInnerHTML={{ __html: widget.html }}
          />
        </div>
        <div className="widget-card-overlay">
          <button className="widget-overlay-btn primary" onClick={() => onInsert(widget)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Insert
          </button>
          <button className="widget-overlay-btn secondary" onClick={handleCopy}>
            {copied ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Card Info */}
      <div className="widget-card-info">
        <h4>{widget.name}</h4>
        <p>{widget.description}</p>
      </div>
    </div>
  );
}

// Category icon mapping
function getCategoryIcon(category) {
  const icons = {
    [WIDGET_CATEGORIES.CHARTS]: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
    [WIDGET_CATEGORIES.CARDS]: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
      </svg>
    ),
    [WIDGET_CATEGORIES.STATISTICS]: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    [WIDGET_CATEGORIES.LISTS]: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <circle cx="4" cy="6" r="1" fill="currentColor" />
        <circle cx="4" cy="12" r="1" fill="currentColor" />
        <circle cx="4" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
    [WIDGET_CATEGORIES.INFOGRAPHICS]: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 0 20" />
        <path d="M12 12l6-3" />
      </svg>
    ),
    [WIDGET_CATEGORIES.TEXT]: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    ),
    [WIDGET_CATEGORIES.LAYOUTS]: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    [WIDGET_CATEGORIES.TABLES]: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
    ),
  };
  return icons[category] || icons[WIDGET_CATEGORIES.LAYOUTS];
}

export default function WidgetBrowser({ isOpen, onClose }) {
  const { state, actions, activeSlide } = useSlides();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);

  // Filter widgets by category and search
  const filteredWidgets = useMemo(() => {
    let widgets = slideWidgets;

    if (selectedCategory !== 'all') {
      widgets = widgets.filter(w => w.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      widgets = widgets.filter(w =>
        w.name.toLowerCase().includes(query) ||
        w.description.toLowerCase().includes(query) ||
        w.id.toLowerCase().includes(query)
      );
    }

    return widgets;
  }, [selectedCategory, searchQuery]);

  // Group widgets by category for display
  const widgetsByCategory = useMemo(() => {
    const groups = {};
    filteredWidgets.forEach(widget => {
      const category = widget.category || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(widget);
    });
    return groups;
  }, [filteredWidgets]);

  // Insert widget into current slide
  const handleInsert = (widget) => {
    if (!activeSlide) {
      setNotification({ type: 'error', message: 'No slide selected. Please select a slide first.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const currentHtml = activeSlide.html || '';
    let newHtml;
    const frameCloseMatch = currentHtml.match(/(<\/div>\s*<footer class="footer">)/);
    if (frameCloseMatch) {
      newHtml = currentHtml.replace(frameCloseMatch[0], `\n  ${widget.html}\n${frameCloseMatch[0]}`);
    } else {
      newHtml = currentHtml + '\n' + widget.html;
    }

    actions.updateSlide(activeSlide.id, { html: newHtml });
    setNotification({ type: 'success', message: `Added "${widget.name}"` });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCopy = (widget) => {
    setNotification({ type: 'success', message: `Copied "${widget.name}"` });
    setTimeout(() => setNotification(null), 2000);
  };

  if (!isOpen) return null;

  const categoryLabels = {
    [WIDGET_CATEGORIES.CHARTS]: 'Charts',
    [WIDGET_CATEGORIES.CARDS]: 'Cards',
    [WIDGET_CATEGORIES.STATISTICS]: 'Statistics',
    [WIDGET_CATEGORIES.LISTS]: 'Lists',
    [WIDGET_CATEGORIES.INFOGRAPHICS]: 'Infographics',
    [WIDGET_CATEGORIES.TEXT]: 'Text',
    [WIDGET_CATEGORIES.LAYOUTS]: 'Layouts',
    [WIDGET_CATEGORIES.TABLES]: 'Tables',
    [WIDGET_CATEGORIES.MEDIA]: 'Media',
  };

  return createPortal(
    <div className="wb-overlay" onClick={onClose}>
      <div className="wb-modal" onClick={e => e.stopPropagation()}>
        {/* Premium Header */}
        <div className="wb-header">
          <div className="wb-header-content">
            <div className="wb-logo">
              <div className="wb-logo-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="2" />
                  <rect x="14" y="3" width="7" height="7" rx="2" />
                  <rect x="3" y="14" width="7" height="7" rx="2" />
                  <path d="M17 14v7M14 17.5h7" />
                </svg>
              </div>
              <div className="wb-logo-text">
                <h1>Widget Library</h1>
                <span>{slideWidgets.length} Premium Components</span>
              </div>
            </div>
            <button className="wb-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="wb-search-container">
            <div className="wb-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search widgets by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="wb-search-clear" onClick={() => setSearchQuery('')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="wb-categories">
          <button
            className={`wb-cat-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            All Widgets
            <span className="wb-cat-count">{slideWidgets.length}</span>
          </button>
          {Object.entries(categoryLabels).filter(([key]) =>
            slideWidgets.some(w => w.category === key)
          ).map(([key, label]) => {
            const count = slideWidgets.filter(w => w.category === key).length;
            return (
              <button
                key={key}
                className={`wb-cat-pill ${selectedCategory === key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(key)}
              >
                {getCategoryIcon(key)}
                {label}
                <span className="wb-cat-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Widget Grid */}
        <div className="wb-content">
          {selectedCategory === 'all' ? (
            // Show by category when "All" is selected
            Object.entries(widgetsByCategory).map(([category, widgets]) => (
              <div key={category} className="wb-section">
                <div className="wb-section-header">
                  <div className="wb-section-icon">{getCategoryIcon(category)}</div>
                  <h2>{categoryLabels[category] || category}</h2>
                  <span className="wb-section-count">{widgets.length} widgets</span>
                </div>
                <div className="wb-grid">
                  {widgets.map(widget => (
                    <WidgetPreview
                      key={widget.id}
                      widget={widget}
                      onInsert={handleInsert}
                      onCopy={handleCopy}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            // Show flat grid for specific category
            <div className="wb-grid">
              {filteredWidgets.map(widget => (
                <WidgetPreview
                  key={widget.id}
                  widget={widget}
                  onInsert={handleInsert}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          )}

          {filteredWidgets.length === 0 && (
            <div className="wb-empty">
              <div className="wb-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                  <path d="M8 8l6 6M14 8l-6 6" opacity="0.5" />
                </svg>
              </div>
              <h3>No widgets found</h3>
              <p>Try adjusting your search or browse a different category</p>
              <button className="wb-empty-btn" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className={`wb-toast ${notification.type}`}>
            <div className="wb-toast-icon">
              {notification.type === 'success' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              )}
            </div>
            <span>{notification.message}</span>
          </div>
        )}
      </div>

      <style>{`
        /* ========== OVERLAY ========== */
        .wb-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: wbFadeIn 0.25s ease-out;
        }

        @keyframes wbFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ========== MODAL ========== */
        .wb-modal {
          width: 92vw;
          max-width: 1400px;
          height: 90vh;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.05),
            0 25px 100px rgba(0, 0, 0, 0.25),
            0 10px 40px rgba(0, 0, 0, 0.1);
          animation: wbSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        @keyframes wbSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ========== HEADER ========== */
        .wb-header {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          padding: 24px 32px 20px;
          position: relative;
          overflow: hidden;
        }

        .wb-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          opacity: 0.5;
        }

        .wb-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 1;
          margin-bottom: 20px;
        }

        .wb-logo {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .wb-logo-icon {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #8E1E1E 0%, #B52828 100%);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(142, 30, 30, 0.4);
        }

        .wb-logo-text h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.5px;
        }

        .wb-logo-text span {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }

        .wb-close {
          width: 44px;
          height: 44px;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.7);
          transition: all 0.2s;
        }

        .wb-close:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          transform: rotate(90deg);
        }

        /* ========== SEARCH ========== */
        .wb-search-container {
          position: relative;
          z-index: 1;
        }

        .wb-search {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 14px 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .wb-search svg {
          color: #64748b;
          flex-shrink: 0;
        }

        .wb-search input {
          flex: 1;
          border: none;
          background: none;
          font-size: 15px;
          color: #1e293b;
          outline: none;
          font-weight: 500;
        }

        .wb-search input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .wb-search-clear {
          width: 28px;
          height: 28px;
          border: none;
          background: #f1f5f9;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          transition: all 0.15s;
        }

        .wb-search-clear:hover {
          background: #e2e8f0;
          color: #334155;
        }

        /* ========== CATEGORIES ========== */
        .wb-categories {
          display: flex;
          gap: 10px;
          padding: 20px 32px;
          overflow-x: auto;
          background: white;
          border-bottom: 1px solid #e2e8f0;
        }

        .wb-categories::-webkit-scrollbar {
          height: 0;
        }

        .wb-cat-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .wb-cat-pill:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #334155;
        }

        .wb-cat-pill.active {
          background: linear-gradient(135deg, #8E1E1E 0%, #A82828 100%);
          border-color: #8E1E1E;
          color: white;
          box-shadow: 0 4px 12px rgba(142, 30, 30, 0.3);
        }

        .wb-cat-pill.active svg {
          color: white;
        }

        .wb-cat-count {
          padding: 2px 8px;
          background: rgba(0, 0, 0, 0.08);
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }

        .wb-cat-pill.active .wb-cat-count {
          background: rgba(255, 255, 255, 0.25);
        }

        /* ========== CONTENT ========== */
        .wb-content {
          flex: 1;
          overflow-y: auto;
          padding: 28px 32px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        }

        .wb-content::-webkit-scrollbar {
          width: 8px;
        }

        .wb-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .wb-content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        .wb-content::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* ========== SECTION ========== */
        .wb-section {
          margin-bottom: 40px;
        }

        .wb-section:last-child {
          margin-bottom: 0;
        }

        .wb-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid #e2e8f0;
        }

        .wb-section-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #8E1E1E 0%, #A82828 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .wb-section-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          flex: 1;
        }

        .wb-section-count {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        /* ========== GRID ========== */
        .wb-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        /* ========== WIDGET CARD ========== */
        .widget-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.05),
            0 4px 12px rgba(0, 0, 0, 0.04);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid #e2e8f0;
        }

        .widget-card:hover {
          transform: translateY(-4px);
          box-shadow:
            0 0 0 1px rgba(142, 30, 30, 0.1),
            0 8px 30px rgba(142, 30, 30, 0.12),
            0 4px 12px rgba(0, 0, 0, 0.06);
          border-color: rgba(142, 30, 30, 0.3);
        }

        .widget-card-preview {
          position: relative;
          height: 160px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .widget-preview-inner {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .widget-html-render {
          transform: scale(0.55);
          transform-origin: center center;
          pointer-events: none;
          max-width: 400px;
        }

        .widget-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          opacity: 0;
          transition: all 0.25s ease;
        }

        .widget-card:hover .widget-card-overlay {
          opacity: 1;
        }

        .widget-overlay-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 28px;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 140px;
        }

        .widget-overlay-btn.primary {
          background: linear-gradient(135deg, #8E1E1E 0%, #B52828 100%);
          color: white;
          box-shadow: 0 4px 16px rgba(142, 30, 30, 0.4);
        }

        .widget-overlay-btn.primary:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(142, 30, 30, 0.5);
        }

        .widget-overlay-btn.secondary {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          backdrop-filter: blur(4px);
        }

        .widget-overlay-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .widget-card-info {
          padding: 16px 18px;
        }

        .widget-card-info h4 {
          margin: 0 0 6px 0;
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
        }

        .widget-card-info p {
          margin: 0;
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
        }

        /* ========== EMPTY STATE ========== */
        .wb-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          text-align: center;
        }

        .wb-empty-icon {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: #94a3b8;
        }

        .wb-empty h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 700;
          color: #334155;
        }

        .wb-empty p {
          margin: 0 0 24px 0;
          font-size: 15px;
          color: #64748b;
        }

        .wb-empty-btn {
          padding: 12px 28px;
          background: linear-gradient(135deg, #8E1E1E 0%, #A82828 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .wb-empty-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 16px rgba(142, 30, 30, 0.3);
        }

        /* ========== TOAST ========== */
        .wb-toast {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 600;
          animation: wbToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        @keyframes wbToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .wb-toast.success {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: white;
        }

        .wb-toast.error {
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
          color: white;
        }

        .wb-toast-icon {
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ========== WIDGET HTML PREVIEW STYLES ========== */
        .widget-html-render .content-box {
          background: #f7f9fb;
          border: 1px solid #e6e9ee;
          border-radius: 6px;
          padding: 16px;
          font-family: Arial, sans-serif;
        }

        .widget-html-render .content-box.accent {
          border-top: 4px solid #8e1e1e;
        }

        .widget-html-render .content-box h3 {
          margin: 0 0 12px 0;
          font: 700 15px/1.3 Arial, sans-serif;
          color: #111;
        }

        .widget-html-render .metric-box {
          background: #f7f9fb;
          padding: 16px;
          border-radius: 6px;
          border-left: 4px solid #8e1e1e;
        }

        .widget-html-render .metric-value {
          font: 700 32px/1 Georgia, serif;
          color: #8e1e1e;
        }

        .widget-html-render .metric-label {
          font: 400 12px/1.4 Arial, sans-serif;
          color: #4a4f57;
          margin-top: 6px;
        }

        .widget-html-render .bar-chart-h {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .widget-html-render .bar-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
        }

        .widget-html-render .bar-label {
          width: 70px;
          color: #4a4f57;
          font-weight: 500;
        }

        .widget-html-render .bar-track {
          flex: 1;
          height: 10px;
          background: #e6e9ee;
          border-radius: 5px;
          overflow: hidden;
        }

        .widget-html-render .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #8e1e1e 0%, #b52828 100%);
          border-radius: 5px;
        }

        .widget-html-render .bar-value {
          width: 35px;
          text-align: right;
          color: #111;
          font-weight: 700;
        }

        .widget-html-render .highlight-box {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-left: 4px solid #f59e0b;
          padding: 14px 18px;
          border-radius: 6px;
        }

        .widget-html-render .section-box {
          background: #f7f9fb;
          border: 1px solid #e6e9ee;
          border-radius: 6px;
          padding: 16px;
          border-top: 4px solid #8e1e1e;
        }

        .widget-html-render .section-box h4 {
          margin: 0 0 10px 0;
          font: 700 14px/1.3 Arial, sans-serif;
          color: #8e1e1e;
        }

        .widget-html-render .bullet-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 0;
        }

        .widget-html-render .bullet-box .bullet {
          width: 8px;
          height: 8px;
          background: #8e1e1e;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .widget-html-render table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .widget-html-render th {
          background: #1e293b;
          color: white;
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
        }

        .widget-html-render td {
          padding: 10px 12px;
          border-bottom: 1px solid #e6e9ee;
          color: #334155;
        }

        .widget-html-render tr:nth-child(even) td {
          background: #f8fafc;
        }

        .widget-html-render .auto-row {
          display: flex;
          gap: 16px;
        }

        .widget-html-render .auto-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .widget-html-render .auto-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .widget-html-render .icon-stat {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .widget-html-render .icon-stat .icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #8e1e1e 0%, #a82828 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 18px;
        }

        .widget-html-render .stat-group .stat-value {
          font: 700 24px/1 Georgia, serif;
          color: #8e1e1e;
        }

        .widget-html-render .stat-group .stat-label {
          font: 400 11px/1.4 Arial, sans-serif;
          color: #64748b;
        }

        /* ========== EXECUTIVE WIDGET PREVIEW STYLES ========== */
        .widget-html-render .exec-widget {
          background: #fff;
          border-radius: 6px;
          padding: 14px 16px;
          border: 1px solid #e6e9ee;
          font-family: Arial, sans-serif;
        }

        .widget-html-render .exec-widget-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          gap: 10px;
        }

        .widget-html-render .exec-widget-title {
          font: 600 13px/1.3 Arial, sans-serif;
          color: #111;
          margin: 0;
        }

        .widget-html-render .exec-widget-subtitle {
          font: 400 10px/1.3 Arial, sans-serif;
          color: #64748b;
        }

        .widget-html-render .exec-kpi-badge {
          font: 700 9px/1 Arial, sans-serif;
          padding: 4px 8px;
          border-radius: 12px;
        }

        .widget-html-render .exec-kpi-badge.positive {
          background: #dcfce7;
          color: #166534;
        }

        .widget-html-render .exec-bar-chart {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .widget-html-render .exec-bar-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .widget-html-render .exec-bar-meta {
          display: flex;
          justify-content: space-between;
        }

        .widget-html-render .exec-bar-label {
          font: 500 10px/1 Arial, sans-serif;
          color: #334155;
        }

        .widget-html-render .exec-bar-value {
          font: 700 10px/1 Georgia, serif;
          color: #111;
        }

        .widget-html-render .exec-bar-track {
          height: 8px;
          background: #f1f5f9;
          border-radius: 4px;
          position: relative;
        }

        .widget-html-render .exec-bar-fill {
          height: 100%;
          border-radius: 4px;
        }

        .widget-html-render .exec-bar-target {
          position: absolute;
          top: -2px;
          bottom: -2px;
          width: 2px;
          background: #111;
          border-radius: 1px;
        }

        .widget-html-render .exec-legend {
          display: flex;
          gap: 12px;
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid #e6e9ee;
        }

        .widget-html-render .exec-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font: 500 9px/1 Arial, sans-serif;
          color: #64748b;
        }

        .widget-html-render .exec-dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }

        .widget-html-render .exec-dot.filled {
          background: linear-gradient(135deg, #8e1e1e 0%, #a82828 100%);
        }

        .widget-html-render .exec-dot.target {
          background: #111;
        }

        .widget-html-render .exec-col-chart {
          position: relative;
        }

        .widget-html-render .exec-col-container {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 80px;
          gap: 8px;
        }

        .widget-html-render .exec-col-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }

        .widget-html-render .exec-col {
          width: 100%;
          max-width: 35px;
          background: linear-gradient(180deg, #8e1e1e 0%, #6b1515 100%);
          border-radius: 4px 4px 0 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 4px;
        }

        .widget-html-render .exec-col-value {
          font: 700 8px/1 Arial, sans-serif;
          color: #fff;
        }

        .widget-html-render .exec-col-label {
          font: 600 9px/1 Arial, sans-serif;
          color: #64748b;
          margin-top: 6px;
        }

        .widget-html-render .exec-donut-container {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .widget-html-render .exec-donut {
          position: relative;
          width: 80px;
          height: 80px;
          flex-shrink: 0;
        }

        .widget-html-render .exec-donut svg {
          width: 100%;
          height: 100%;
        }

        .widget-html-render .exec-donut-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .widget-html-render .exec-donut-value {
          font: 700 18px/1 Georgia, serif;
          color: #8e1e1e;
        }

        .widget-html-render .exec-donut-label {
          font: 500 8px/1 Arial, sans-serif;
          color: #64748b;
        }

        .widget-html-render .exec-donut-legend {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .widget-html-render .exec-legend-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .widget-html-render .exec-legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 3px;
        }

        .widget-html-render .exec-legend-text {
          font: 500 9px/1 Arial, sans-serif;
          color: #334155;
          flex: 1;
        }

        .widget-html-render .exec-legend-val {
          font: 700 9px/1 Georgia, serif;
          color: #111;
        }

        .widget-html-render .exec-card {
          background: #fff;
          border-radius: 8px;
          border: 1px solid #e6e9ee;
          overflow: hidden;
          display: flex;
        }

        .widget-html-render .exec-card-accent {
          width: 4px;
          background: linear-gradient(180deg, #8e1e1e 0%, #6b1515 100%);
        }

        .widget-html-render .exec-card-content {
          padding: 12px 14px;
          flex: 1;
        }

        .widget-html-render .exec-card-title {
          font: 700 12px/1.3 Georgia, serif;
          color: #111;
          margin: 0 0 8px 0;
        }

        .widget-html-render .exec-card-text {
          font: 400 10px/1.5 Arial, sans-serif;
          color: #475569;
          margin: 0 0 10px 0;
        }

        .widget-html-render .exec-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .widget-html-render .exec-card-tag {
          font: 600 8px/1 Arial, sans-serif;
          color: #8e1e1e;
          background: #fef2f2;
          padding: 4px 8px;
          border-radius: 12px;
        }

        .widget-html-render .exec-card-link {
          font: 600 9px/1 Arial, sans-serif;
          color: #8e1e1e;
        }

        .widget-html-render .exec-feature-card {
          background: #fff;
          border-radius: 8px;
          border: 1px solid #e6e9ee;
          padding: 14px 16px;
        }

        .widget-html-render .exec-feature-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .widget-html-render .exec-feature-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #8e1e1e 0%, #a82828 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .widget-html-render .exec-feature-icon svg {
          width: 16px;
          height: 16px;
        }

        .widget-html-render .exec-feature-num {
          font: 700 18px/1 Georgia, serif;
          color: #e2e8f0;
        }

        .widget-html-render .exec-feature-title {
          font: 700 12px/1.3 Georgia, serif;
          color: #111;
          margin: 0 0 6px 0;
        }

        .widget-html-render .exec-feature-desc {
          font: 400 9px/1.5 Arial, sans-serif;
          color: #64748b;
          margin: 0 0 12px 0;
        }

        .widget-html-render .exec-feature-metrics {
          display: flex;
          gap: 16px;
          padding-top: 10px;
          border-top: 1px solid #e6e9ee;
        }

        .widget-html-render .exec-fm {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .widget-html-render .exec-fm-val {
          font: 700 14px/1 Georgia, serif;
          color: #8e1e1e;
        }

        .widget-html-render .exec-fm-lbl {
          font: 500 8px/1 Arial, sans-serif;
          color: #94a3b8;
          text-transform: uppercase;
        }

        /* Executive KPI Card Preview */
        .widget-html-render .exec-kpi-card {
          background: #fff;
          border-radius: 8px;
          padding: 12px 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border: 1px solid rgba(0,0,0,0.04);
          position: relative;
          overflow: hidden;
        }

        .widget-html-render .exec-kpi-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #6B1515 0%, #8E1E1E 50%, #A82828 100%);
        }

        .widget-html-render .exec-kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .widget-html-render .exec-kpi-category {
          font: 600 8px/1 Arial, sans-serif;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .widget-html-render .exec-kpi-status {
          display: flex;
          align-items: center;
          gap: 3px;
          font: 600 7px/1 Arial, sans-serif;
          padding: 2px 6px;
          border-radius: 10px;
        }

        .widget-html-render .exec-kpi-status.on-track {
          background: rgba(16, 185, 129, 0.1);
          color: #059669;
        }

        .widget-html-render .exec-kpi-status svg {
          width: 6px;
          height: 6px;
        }

        .widget-html-render .exec-kpi-main {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 4px;
        }

        .widget-html-render .exec-kpi-value {
          font: 700 24px/1 Georgia, serif;
          color: #1E293B;
          letter-spacing: -0.5px;
        }

        .widget-html-render .exec-kpi-trend {
          display: flex;
          align-items: center;
          gap: 2px;
          font: 700 10px/1 Arial, sans-serif;
          padding: 2px 5px;
          border-radius: 4px;
        }

        .widget-html-render .exec-kpi-trend.positive {
          background: rgba(16, 185, 129, 0.1);
          color: #059669;
        }

        .widget-html-render .exec-kpi-trend svg {
          width: 10px;
          height: 10px;
        }

        .widget-html-render .exec-kpi-label {
          font: 500 9px/1.3 Arial, sans-serif;
          color: #64748B;
          margin-bottom: 10px;
        }

        .widget-html-render .exec-kpi-sparkline {
          height: 24px;
          margin-bottom: 8px;
        }

        .widget-html-render .exec-kpi-sparkline svg {
          width: 100%;
          height: 100%;
        }

        .widget-html-render .exec-kpi-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid #F1F5F9;
        }

        .widget-html-render .exec-kpi-prev {
          font: 400 8px/1 Arial, sans-serif;
          color: #94A3B8;
        }

        .widget-html-render .exec-kpi-target {
          font: 600 8px/1 Arial, sans-serif;
          color: #8E1E1E;
        }

        /* Executive Profile Card Preview */
        .widget-html-render .exec-profile-card {
          background: #fff;
          border-radius: 8px;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          text-align: center;
        }
        .widget-html-render .exec-profile-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #6B1515, #8E1E1E);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 8px;
        }
        .widget-html-render .exec-avatar-initials {
          font: 700 14px/1 Georgia, serif;
          color: #fff;
        }
        .widget-html-render .exec-profile-badge {
          font: 600 7px/1 Arial, sans-serif;
          color: #8E1E1E;
          background: rgba(142,30,30,0.08);
          padding: 2px 6px;
          border-radius: 10px;
          display: inline-block;
          margin-bottom: 8px;
        }
        .widget-html-render .exec-profile-name {
          font: 700 11px/1.2 Georgia, serif;
          color: #1E293B;
          margin: 0 0 3px 0;
        }
        .widget-html-render .exec-profile-title {
          font: 500 8px/1.2 Arial, sans-serif;
          color: #64748B;
        }
        .widget-html-render .exec-profile-bio {
          font: 400 7px/1.4 Arial, sans-serif;
          color: #64748B;
          margin: 6px 0;
          display: none;
        }
        .widget-html-render .exec-profile-footer {
          display: flex;
          justify-content: center;
          gap: 12px;
          padding-top: 8px;
          border-top: 1px solid #f1f5f9;
        }
        .widget-html-render .exec-pstat-val {
          font: 700 10px/1 Georgia, serif;
          color: #8E1E1E;
        }
        .widget-html-render .exec-pstat-lbl {
          font: 500 6px/1 Arial, sans-serif;
          color: #94a3b8;
        }

        /* Executive Testimonial Preview */
        .widget-html-render .exec-testimonial {
          background: #fff;
          border-radius: 8px;
          padding: 12px 12px 12px 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          position: relative;
        }
        .widget-html-render .exec-quote-accent {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #8E1E1E, #6B1515);
          border-radius: 3px 0 0 3px;
        }
        .widget-html-render .exec-quote-mark { display: none; }
        .widget-html-render .exec-quote-text {
          font: 400 8px/1.5 Georgia, serif;
          color: #334155;
          margin: 0 0 10px 0;
          font-style: italic;
        }
        .widget-html-render .exec-quote-author {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .widget-html-render .exec-author-avatar {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #1E293B, #334155);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font: 600 8px/1 Arial, sans-serif;
          color: #fff;
        }
        .widget-html-render .exec-author-name {
          font: 600 8px/1.2 Arial, sans-serif;
          color: #1E293B;
        }
        .widget-html-render .exec-author-role {
          font: 400 7px/1.2 Arial, sans-serif;
          color: #64748B;
        }
        .widget-html-render .exec-author-logo { display: none; }

        /* Executive Capability Card Preview */
        .widget-html-render .exec-capability-card {
          background: #fff;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .widget-html-render .exec-cap-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .widget-html-render .exec-cap-icon {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #8E1E1E, #A82828);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .widget-html-render .exec-cap-icon svg { width: 14px; height: 14px; }
        .widget-html-render .exec-cap-num {
          font: 700 14px/1 Georgia, serif;
          color: #e2e8f0;
        }
        .widget-html-render .exec-cap-title {
          font: 700 10px/1.2 Georgia, serif;
          color: #1E293B;
          margin: 0 0 4px 0;
        }
        .widget-html-render .exec-cap-desc {
          font: 400 7px/1.4 Arial, sans-serif;
          color: #64748B;
          margin: 0 0 8px 0;
        }
        .widget-html-render .exec-cap-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .widget-html-render .exec-cap-list li {
          display: flex;
          align-items: center;
          gap: 4px;
          font: 400 7px/1.3 Arial, sans-serif;
          color: #475569;
        }
        .widget-html-render .exec-cap-list li svg { width: 8px; height: 8px; }

        /* Executive Tier Card Preview */
        .widget-html-render .exec-tier-card {
          background: #fff;
          border-radius: 8px;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          border: 1px solid #8E1E1E;
          text-align: center;
          position: relative;
        }
        .widget-html-render .exec-tier-badge {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(90deg, #8E1E1E, #A82828);
          color: #fff;
          font: 600 6px/1 Arial, sans-serif;
          padding: 3px 8px;
          border-radius: 10px;
        }
        .widget-html-render .exec-tier-name {
          font: 700 8px/1 Arial, sans-serif;
          color: #64748B;
          text-transform: uppercase;
        }
        .widget-html-render .exec-price-value {
          font: 700 22px/1 Georgia, serif;
          color: #1E293B;
        }
        .widget-html-render .exec-price-currency {
          font: 600 12px/1 Georgia, serif;
          color: #1E293B;
        }
        .widget-html-render .exec-price-period {
          font: 400 8px/1 Arial, sans-serif;
          color: #94a3b8;
        }
        .widget-html-render .exec-tier-desc {
          font: 400 7px/1.4 Arial, sans-serif;
          color: #64748B;
          margin: 6px 0;
        }
        .widget-html-render .exec-tier-features {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 10px;
          text-align: left;
        }
        .widget-html-render .exec-tier-feat {
          display: flex;
          align-items: center;
          gap: 4px;
          font: 400 7px/1.3 Arial, sans-serif;
          color: #475569;
        }
        .widget-html-render .exec-tier-feat svg { width: 10px; height: 10px; }
        .widget-html-render .exec-tier-cta {
          background: linear-gradient(90deg, #8E1E1E, #A82828);
          color: #fff;
          font: 600 8px/1 Arial, sans-serif;
          padding: 6px 12px;
          border-radius: 4px;
          display: inline-block;
        }

        /* Executive CTA Card Preview */
        .widget-html-render .exec-cta-card {
          background: linear-gradient(135deg, #FAFAFA, #F1F5F9);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .widget-html-render .exec-cta-eyebrow {
          font: 600 6px/1 Arial, sans-serif;
          color: #8E1E1E;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .widget-html-render .exec-cta-title {
          font: 700 10px/1.2 Georgia, serif;
          color: #1E293B;
          margin: 0 0 4px 0;
        }
        .widget-html-render .exec-cta-text {
          font: 400 7px/1.4 Arial, sans-serif;
          color: #64748B;
          margin: 0 0 8px 0;
        }
        .widget-html-render .exec-cta-actions { display: flex; gap: 6px; }
        .widget-html-render .exec-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: linear-gradient(90deg, #8E1E1E, #A82828);
          color: #fff;
          font: 600 7px/1 Arial, sans-serif;
          padding: 5px 8px;
          border-radius: 4px;
        }
        .widget-html-render .exec-cta-primary svg { width: 8px; height: 8px; }
        .widget-html-render .exec-cta-secondary {
          font: 600 7px/1 Arial, sans-serif;
          color: #8E1E1E;
        }
        .widget-html-render .exec-cta-visual { display: none; }

        /* Executive Hero Metric Preview */
        .widget-html-render .exec-hero-metric {
          background: #fff;
          border-radius: 10px;
          padding: 16px;
          text-align: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }
        .widget-html-render .exec-hero-glow { display: none; }
        .widget-html-render .exec-hero-content {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 2px;
        }
        .widget-html-render .exec-hero-prefix {
          font: 700 16px/1 Georgia, serif;
          color: #8E1E1E;
        }
        .widget-html-render .exec-hero-value {
          font: 700 36px/1 Georgia, serif;
          color: #1E293B;
        }
        .widget-html-render .exec-hero-suffix {
          font: 700 16px/1 Georgia, serif;
          color: #8E1E1E;
        }
        .widget-html-render .exec-hero-label {
          font: 500 8px/1 Arial, sans-serif;
          color: #64748B;
          margin-top: 6px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .widget-html-render .exec-hero-trend {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font: 600 8px/1 Arial, sans-serif;
          padding: 3px 8px;
          border-radius: 10px;
          margin-top: 8px;
        }
        .widget-html-render .exec-hero-trend.positive {
          background: rgba(16,185,129,0.1);
          color: #059669;
        }
        .widget-html-render .exec-hero-trend svg { width: 8px; height: 8px; }

        /* Executive Transform Compare Preview */
        .widget-html-render .exec-transform-compare {
          background: #fff;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .widget-html-render .exec-transform-title {
          font: 700 9px/1 Georgia, serif;
          color: #1E293B;
          text-align: center;
          margin-bottom: 12px;
        }
        .widget-html-render .exec-transform-grid {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .widget-html-render .exec-transform-before,
        .widget-html-render .exec-transform-after {
          background: #F8FAFC;
          border-radius: 6px;
          padding: 10px 14px;
          text-align: center;
        }
        .widget-html-render .exec-transform-after {
          background: rgba(142,30,30,0.05);
          border: 1px solid rgba(142,30,30,0.15);
        }
        .widget-html-render .exec-tf-tag {
          font: 600 6px/1 Arial, sans-serif;
          color: #94A3B8;
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }
        .widget-html-render .exec-transform-after .exec-tf-tag { color: #8E1E1E; }
        .widget-html-render .exec-tf-value {
          font: 700 14px/1 Georgia, serif;
          color: #1E293B;
          display: block;
          margin-bottom: 2px;
        }
        .widget-html-render .exec-transform-after .exec-tf-value { color: #8E1E1E; }
        .widget-html-render .exec-tf-label {
          font: 400 7px/1 Arial, sans-serif;
          color: #64748B;
        }
        .widget-html-render .exec-transform-arrow {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .widget-html-render .exec-transform-arrow svg { width: 16px; height: 16px; }
        .widget-html-render .exec-tf-delta {
          font: 700 8px/1 Arial, sans-serif;
          color: #059669;
          background: rgba(16,185,129,0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .widget-html-render .exec-transform-footer { display: none; }

        /* Executive KPI Grid Preview */
        .widget-html-render .exec-kpi-grid {
          display: grid;
          gap: 8px;
        }
        .widget-html-render .exec-kpi-grid.four {
          grid-template-columns: repeat(2, 1fr);
        }
        .widget-html-render .exec-kpi-tile {
          background: #fff;
          border-radius: 6px;
          padding: 10px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .widget-html-render .exec-tile-icon {
          width: 22px;
          height: 22px;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
        }
        .widget-html-render .exec-tile-icon svg { width: 12px; height: 12px; }
        .widget-html-render .exec-tile-icon.revenue { background: rgba(142,30,30,0.1); color: #8E1E1E; }
        .widget-html-render .exec-tile-icon.growth { background: rgba(16,185,129,0.1); color: #059669; }
        .widget-html-render .exec-tile-icon.efficiency { background: rgba(59,130,246,0.1); color: #3B82F6; }
        .widget-html-render .exec-tile-icon.satisfaction { background: rgba(245,158,11,0.1); color: #F59E0B; }
        .widget-html-render .exec-tile-value {
          font: 700 12px/1 Georgia, serif;
          color: #1E293B;
          margin-bottom: 2px;
        }
        .widget-html-render .exec-tile-label {
          font: 500 7px/1 Arial, sans-serif;
          color: #64748B;
          margin-bottom: 4px;
        }
        .widget-html-render .exec-tile-trend {
          font: 700 7px/1 Arial, sans-serif;
          padding: 2px 4px;
          border-radius: 3px;
        }
        .widget-html-render .exec-tile-trend.positive {
          background: rgba(16,185,129,0.1);
          color: #059669;
        }

        /* Executive Impact Grid Preview */
        .widget-html-render .exec-impact-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .widget-html-render .exec-impact-tile {
          background: #fff;
          border-radius: 6px;
          padding: 10px;
          text-align: center;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .widget-html-render .exec-impact-tile.featured {
          background: rgba(142,30,30,0.03);
          border: 1px solid rgba(142,30,30,0.1);
        }
        .widget-html-render .exec-impact-ring {
          width: 40px;
          height: 40px;
          margin: 0 auto 8px;
          position: relative;
        }
        .widget-html-render .exec-impact-pct {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font: 700 9px/1 Georgia, serif;
          color: #8E1E1E;
        }
        .widget-html-render .exec-impact-value {
          font: 700 11px/1 Georgia, serif;
          color: #1E293B;
          margin-bottom: 2px;
        }
        .widget-html-render .exec-impact-label {
          font: 500 7px/1 Arial, sans-serif;
          color: #64748B;
        }

        /* Executive Progress Card Preview */
        .widget-html-render .exec-progress-card {
          background: #fff;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .widget-html-render .exec-prog-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .widget-html-render .exec-prog-title {
          font: 700 9px/1.2 Georgia, serif;
          color: #1E293B;
        }
        .widget-html-render .exec-prog-phase {
          font: 500 7px/1 Arial, sans-serif;
          color: #64748B;
        }
        .widget-html-render .exec-prog-value {
          font: 700 14px/1 Georgia, serif;
          color: #8E1E1E;
        }
        .widget-html-render .exec-prog-track {
          height: 5px;
          background: #F1F5F9;
          border-radius: 3px;
          position: relative;
          margin-bottom: 20px;
        }
        .widget-html-render .exec-prog-fill {
          height: 100%;
          background: linear-gradient(90deg, #6B1515, #8E1E1E);
          border-radius: 3px;
        }
        .widget-html-render .exec-prog-milestone {
          position: absolute;
          top: 10px;
          transform: translateX(-50%);
          text-align: center;
        }
        .widget-html-render .exec-mile-dot {
          width: 8px;
          height: 8px;
          background: #E2E8F0;
          border: 1px solid #fff;
          border-radius: 50%;
          margin: 0 auto 3px;
        }
        .widget-html-render .exec-mile-dot.completed { background: #8E1E1E; }
        .widget-html-render .exec-mile-dot.active { background: #8E1E1E; box-shadow: 0 0 0 2px rgba(142,30,30,0.2); }
        .widget-html-render .exec-mile-label {
          font: 500 6px/1 Arial, sans-serif;
          color: #64748B;
        }
        .widget-html-render .exec-prog-footer {
          display: flex;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px solid #F1F5F9;
        }
        .widget-html-render .exec-prog-status {
          font: 600 7px/1 Arial, sans-serif;
          padding: 2px 6px;
          border-radius: 10px;
        }
        .widget-html-render .exec-prog-status.on-track {
          background: rgba(16,185,129,0.1);
          color: #059669;
        }
        .widget-html-render .exec-prog-eta {
          font: 400 7px/1 Arial, sans-serif;
          color: #94A3B8;
        }
      `}</style>
    </div>,
    document.body
  );
}
