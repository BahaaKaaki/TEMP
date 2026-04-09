import { useState, useRef, useEffect } from 'react';
import { SlideProvider, useSlides } from './context/SlideContext';
import TemplatePicker from './components/TemplatePicker';
import SettingsModal from './components/SettingsModal';
import { generateSlides, improveSlide, chatWithContext } from './services/aiService';
import { downloadAsHTML, downloadAsJSON } from './services/exportService';
import './styles/app.css';
import './styles/slides.css';

function SimpleHeader({ onOpenSettings, onOpenTemplates }) {
  const { state, actions } = useSlides();
  const [showExport, setShowExport] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(state.deckName);
  const exportRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setEditedName(state.deckName);
  }, [state.deckName]);

  const handleNameSubmit = () => {
    if (editedName.trim()) {
      actions.setDeckName(editedName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18M3 9h18" />
          </svg>
          Slides
        </h1>
        <span className="deck-name-separator">/</span>
        <div className="deck-name-section">
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              autoFocus
              className="deck-name-input"
            />
          ) : (
            <button className="deck-name-button" onClick={() => setIsEditingName(true)}>
              {state.deckName}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="header-actions">
        <button className="btn btn-secondary" onClick={onOpenTemplates}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Templates
        </button>

        <div style={{ position: 'relative' }} ref={exportRef}>
          <button className="btn btn-secondary" onClick={() => setShowExport(!showExport)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          {showExport && (
            <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', minWidth: '160px', zIndex: 100 }}>
              <button className="dropdown-item" onClick={() => { downloadAsHTML(state.slides, state.sharedCSS, 'presentation.html', state.theme); setShowExport(false); }}>
                Export as HTML
              </button>
              <button className="dropdown-item" onClick={() => { downloadAsJSON(state.slides, state.sharedCSS, 'slides.json'); setShowExport(false); }}>
                Export as JSON
              </button>
            </div>
          )}
        </div>

        <button className="btn btn-icon" onClick={onOpenSettings} title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function SimpleSlideList({ onAddSlide }) {
  const { state, actions } = useSlides();

  return (
    <div className="sidebar" style={{ width: '240px' }}>
      <div className="sidebar-header">
        <h2>Slides</h2>
        <button className="btn btn-primary btn-sm" onClick={onAddSlide} title="Add slide">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </div>

      <div className="slide-list">
        {state.slides.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '12px' }}>No slides yet</p>
            <button className="btn btn-primary" onClick={onAddSlide}>
              Create First Slide
            </button>
          </div>
        ) : (
          state.slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`slide-item ${state.activeSlideId === slide.id ? 'active' : ''}`}
              onClick={() => actions.setActiveSlide(slide.id)}
            >
              <div className="slide-item-thumbnail">
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: 'var(--accent)'
                }}>
                  {index + 1}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {slide.title || 'Untitled Slide'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {slide.type || 'custom'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SimpleCenterPanel() {
  const { state, actions } = useSlides();
  const [activeTab, setActiveTab] = useState('preview');
  const iframeRef = useRef(null);
  const activeSlide = state.slides.find(s => s.id === state.activeSlideId);

  useEffect(() => {
    if (iframeRef.current && activeSlide) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                width: 960px;
                height: 540px;
                overflow: hidden;
              }
              .slide {
                width: 100%;
                height: 100%;
                padding: 48px;
                display: flex;
                flex-direction: column;
                background: white;
              }
              h1 { font-size: 42px; font-weight: 700; margin-bottom: 16px; }
              h2 { font-size: 32px; font-weight: 600; margin-bottom: 12px; }
              h3 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
              p { font-size: 18px; line-height: 1.6; color: #475569; }
              ${state.sharedCSS || ''}
              ${activeSlide?.customCSS || ''}
            </style>
          </head>
          <body>${activeSlide?.html || '<div class="slide"><h1>Empty Slide</h1><p>Add content to get started</p></div>'}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [activeSlide, state.sharedCSS]);

  const handleCodeChange = (e) => {
    if (activeSlide) {
      actions.updateSlide(state.activeSlideId, { html: e.target.value });
    }
  };

  return (
    <div className="main-content">
      <div className="content-tabs">
        <button
          className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Preview
        </button>
        <button
          className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Edit Code
        </button>
      </div>

      <div className="content-area">
        {!activeSlide ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)'
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.5 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18M3 9h18" />
            </svg>
            <h3 style={{ fontSize: '18px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>No slide selected</h3>
            <p style={{ fontSize: '14px' }}>Select a slide from the list or create a new one</p>
          </div>
        ) : activeTab === 'preview' ? (
          <div className="preview-container">
            <div className="slide-preview-wrapper">
              <iframe
                ref={iframeRef}
                title="Slide Preview"
                style={{
                  width: '960px',
                  height: '540px',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ height: '100%', padding: '0' }}>
            <textarea
              value={activeSlide?.html || ''}
              onChange={handleCodeChange}
              placeholder="Enter HTML code for your slide..."
              spellCheck={false}
              style={{
                width: '100%',
                height: '100%',
                padding: '20px',
                border: 'none',
                borderRadius: '0',
                fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                fontSize: '13px',
                lineHeight: '1.6',
                resize: 'none',
                outline: 'none',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleChatPanel() {
  const { state, actions } = useSlides();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I can help you create and edit slides.\n\nTry saying:\n• "Create a slide about our Q4 results"\n• "Make this slide more visual"\n• "Add bullet points"'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const activeSlide = state.slides.find(s => s.id === state.activeSlideId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const lowerMsg = userMessage.toLowerCase();
      const isCreate = lowerMsg.includes('create') || lowerMsg.includes('new slide') || lowerMsg.includes('add slide') || lowerMsg.includes('generate');
      const isEdit = lowerMsg.includes('edit') || lowerMsg.includes('change') || lowerMsg.includes('update') ||
                     lowerMsg.includes('make') || lowerMsg.includes('improve') || lowerMsg.includes('add') || lowerMsg.includes('remove');

      if (isCreate) {
        const result = await generateSlides(userMessage, state.sharedCSS, state.settings, [], state.customTemplates);
        if (result.slides && result.slides.length > 0) {
          const newSlide = result.slides[0];
          actions.addSlide({
            title: newSlide.title || 'New Slide',
            type: newSlide.type || 'custom',
            html: newSlide.html,
            customCSS: newSlide.customCSS || ''
          });
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `✓ Created: "${newSlide.title || 'New Slide'}"\n\nCheck the preview to see your new slide!`
          }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'I couldn\'t generate a slide. Please try with more details.' }]);
        }
      } else if (isEdit && activeSlide) {
        const result = await improveSlide(activeSlide.html, userMessage, state.settings);
        if (result.html) {
          actions.updateSlide(state.activeSlideId, { html: result.html, customCSS: result.customCSS || activeSlide.customCSS });
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: result.explanation || '✓ Updated! Check the preview to see the changes.'
          }]);
        }
      } else if (isEdit && !activeSlide) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Please select a slide first, then I can help you edit it.' }]);
      } else {
        const chatContext = {
          allSlides: state.slides,
          totalSlides: state.slides.length,
          currentSlide: activeSlide ? { slide: activeSlide, index: state.slides.findIndex(s => s.id === state.activeSlideId) } : null,
        };
        const response = await chatWithContext(userMessage, chatContext, state.settings);
        setMessages(prev => [...prev, { role: 'assistant', content: response || 'I\'m here to help! Try asking me to create or edit a slide.' }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}\n\nCheck your API settings (gear icon).` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const chatPanelStyle = {
    width: '360px',
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0
  };

  const chatHeaderStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white'
  };

  const chatMessagesStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
  };

  const messageStyle = (role) => ({
    display: 'flex',
    flexDirection: role === 'user' ? 'row-reverse' : 'row',
    gap: '8px',
    maxWidth: '90%',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start'
  });

  const bubbleStyle = (role) => ({
    padding: '10px 14px',
    borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
    fontSize: '13px',
    lineHeight: '1.5',
    background: role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'white',
    color: role === 'user' ? 'white' : 'var(--text-primary)',
    boxShadow: role === 'user' ? '0 2px 8px rgba(99, 102, 241, 0.3)' : '0 1px 4px rgba(0,0,0,0.08)',
    whiteSpace: 'pre-wrap'
  });

  const inputAreaStyle = {
    padding: '16px',
    borderTop: '1px solid var(--border)',
    background: 'white'
  };

  return (
    <div style={chatPanelStyle}>
      <div style={chatHeaderStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          AI Assistant
        </h3>
        <p style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>Create and edit slides with AI</p>
      </div>

      <div style={chatMessagesStyle}>
        {messages.map((msg, i) => (
          <div key={i} style={messageStyle(msg.role)}>
            <div style={bubbleStyle(msg.role)}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={messageStyle('assistant')}>
            <div style={{ ...bubbleStyle('assistant'), display: 'flex', gap: '4px', padding: '12px 16px' }}>
              <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
              <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%', animation: 'pulse 1s infinite 0.2s' }}></span>
              <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%', animation: 'pulse 1s infinite 0.4s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={inputAreaStyle}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={activeSlide ? "Edit this slide or create new..." : "Create a slide..."}
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              width: '40px',
              height: '40px',
              background: input.trim() && !isLoading ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'var(--border)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { actions } = useSlides();
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleTemplateSelect = (template) => {
    actions.addSlide({
      title: template.title || 'New Slide',
      type: template.type || 'custom',
      html: template.html,
      customCSS: '',
      templateId: template.id
    });
    setShowTemplates(false);
  };

  return (
    <div className="app-container">
      <SimpleHeader
        onOpenSettings={() => setShowSettings(true)}
        onOpenTemplates={() => setShowTemplates(true)}
      />
      <div className="app-main">
        <SimpleSlideList onAddSlide={() => setShowTemplates(true)} />
        <SimpleCenterPanel />
        <SimpleChatPanel />
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showTemplates && (
        <TemplatePicker
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
          mode="add"
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function SimpleApp() {
  return (
    <SlideProvider>
      <AppContent />
    </SlideProvider>
  );
}
