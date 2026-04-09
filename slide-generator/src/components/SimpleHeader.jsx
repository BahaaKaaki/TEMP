import { useState, useRef, useEffect } from 'react';
import { useSlides } from '../context/SlideContext';
import { downloadAsHTML, downloadAsJSON } from '../services/exportService';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import SettingsModal from './SettingsModal';
import TemplatePicker from './TemplatePicker';

export default function SimpleHeader() {
  const { state, actions } = useSlides();
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(state.deckName);
  const nameInputRef = useRef(null);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    setEditedName(state.deckName);
  }, [state.deckName]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNameSubmit = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== state.deckName) {
      actions.setDeckName(trimmedName);
    } else {
      setEditedName(state.deckName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') handleNameSubmit();
    else if (e.key === 'Escape') {
      setEditedName(state.deckName);
      setIsEditingName(false);
    }
  };

  const handleDownloadHTML = () => {
    if (state.slides.length === 0) {
      alert('No slides to export');
      return;
    }
    downloadAsHTML(state.slides, state.sharedCSS, 'presentation.html', state.theme);
    setShowExportMenu(false);
  };

  const handleDownloadJSON = () => {
    if (state.slides.length === 0) {
      alert('No slides to export');
      return;
    }
    downloadAsJSON(state.slides, state.sharedCSS, 'slides.json');
    setShowExportMenu(false);
  };

  const handleTemplateSelect = (templateId) => {
    if (!templateId) {
      // Freestyle - add blank slide
      actions.addSlide({ title: 'New Slide', type: 'custom', html: '', customCSS: '' });
      setShowTemplatePicker(false);
      return;
    }
    // Look up template by ID from built-in or custom templates
    const template = SLIDE_TEMPLATES[templateId]
      || state.customTemplates?.find(t => t.id === templateId);
    if (template) {
      actions.addSlide({
        title: template.title || 'New Slide',
        type: template.type || 'custom',
        html: template.html,
        customCSS: '',
        templateId: template.id
      });
    }
    setShowTemplatePicker(false);
  };

  return (
    <>
      <header className="simple-header">
        <div className="header-left">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              className="deck-name-input"
            />
          ) : (
            <button
              className="deck-name-btn"
              onClick={() => setIsEditingName(true)}
            >
              {state.deckName}
            </button>
          )}
        </div>

        <div className="header-right">
          <button
            className="header-btn icon-only"
            onClick={() => setShowTemplatePicker(true)}
            title="Templates"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>

          <div className="export-dropdown" ref={exportMenuRef}>
            <button
              className="header-btn icon-only"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Download"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

            {showExportMenu && (
              <div className="dropdown-menu">
                <button onClick={handleDownloadHTML}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Export as HTML
                </button>
                <button onClick={handleDownloadJSON}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Export as JSON
                </button>
              </div>
            )}
          </div>

          <button
            className="header-btn icon-only"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showTemplatePicker && (
        <TemplatePicker
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplatePicker(false)}
          mode="add"
        />
      )}
    </>
  );
}
