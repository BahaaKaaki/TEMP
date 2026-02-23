import { useState, useEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useSlides } from '../context/SlideContext';
import { extractRelevantCSS } from '../services/aiService';
import {
  detectSlideLayoutType,
  COMPLETE_TRANSLATION_EXAMPLE,
  KPI_TRANSLATION_EXAMPLE,
  COVER_TRANSLATION_EXAMPLE
} from '../services/pptxService';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { decideTemplateUsage } from '../services/templateMatcher';

export default function SlideEditor({ onSwitchToPreview }) {
  const { activeSlide, actions, state } = useSlides();
  const [activeTab, setActiveTab] = useState('rendered'); // Default to rendered view
  const [localHTML, setLocalHTML] = useState('');
  const [localCSS, setLocalCSS] = useState('');
  const [localTitle, setLocalTitle] = useState('');

  // Track slide switches and external updates to prevent cross-slide saves
  const prevSlideIdRef = useRef(null);
  const isSlideSwitchingRef = useRef(false);
  // Tracks whether local state was just synced from an external update (e.g., chatbot edit).
  // When true, the save effect skips — the change didn't originate from user editing.
  const isExternalSyncRef = useRef(false);

  // Sync with active slide - also sync when slide content changes externally (e.g., from chatbot edit)
  useEffect(() => {
    if (activeSlide) {
      // Detect slide switch to prevent race condition with debounced save
      const slideChanged = prevSlideIdRef.current !== null && prevSlideIdRef.current !== activeSlide.id;
      if (slideChanged) {
        isSlideSwitchingRef.current = true;
        // Reset the flag after a tick to allow the save effect to see it
        setTimeout(() => {
          isSlideSwitchingRef.current = false;
        }, 0);
      }
      prevSlideIdRef.current = activeSlide.id;

      // Mark this as an external sync so the save effect doesn't try to save it back.
      // This prevents: chatbot edits slide → sync updates localHTML → save effect detects
      // hasChanges → saves OLD localHTML back, overwriting the chatbot's edit.
      isExternalSyncRef.current = true;

      setLocalHTML(activeSlide.html || '');
      setLocalCSS(activeSlide.customCSS || '');
      setLocalTitle(activeSlide.title || '');
    }
  }, [activeSlide?.id, activeSlide?.html, activeSlide?.customCSS, activeSlide?.title]);

  // Compute rendered content (HTML + only relevant CSS from theme)
  // Note: We only show extracted CSS here, not customCSS (which is shown in Custom CSS tab)
  // This prevents duplication since customCSS often already contains extracted CSS
  const renderedContent = useMemo(() => {
    if (!activeSlide?.html) return '';

    // Extract only the CSS rules that apply to this slide's classes from the theme
    const relevantCSS = extractRelevantCSS(activeSlide.html);

    return `<!-- ===== RENDERED SLIDE ===== -->
<!-- This shows exactly what CSS applies to this slide from the theme -->

<!-- HTML -->
${activeSlide.html}

<!-- ===== CSS (only rules used by this slide) ===== -->
<style>
${relevantCSS || '/* No CSS rules found for this slide */'}
</style>`;
  }, [activeSlide?.html]);

  // Compute JS code for PPTX rendering using SMART MATCHING
  // Analyzes HTML structure to find the best template match
  const jsContent = useMemo(() => {
    if (!activeSlide?.html) return { source: '', code: '', confidence: 0, reason: '' };

    // Use smart template matching
    const decision = decideTemplateUsage(activeSlide, state.customTemplates || []);

    if (decision.useTemplate && decision.pptxRendererCode) {
      return {
        source: `FROM TEMPLATE: "${decision.templateTitle}" (${decision.confidence}% match)`,
        code: decision.pptxRendererCode,
        confidence: decision.confidence,
        reason: decision.reason
      };
    }

    // Fall back to generic example based on layout type
    const layoutType = detectSlideLayoutType(activeSlide.html);
    let code = '';
    let source = '';

    switch (layoutType) {
      case 'three-cards':
        code = COMPLETE_TRANSLATION_EXAMPLE.code;
        source = 'FROM GENERIC: Three Cards Layout';
        break;
      case 'two-column-kpi':
        code = KPI_TRANSLATION_EXAMPLE.code;
        source = 'FROM GENERIC: Two Column KPI Layout';
        break;
      case 'cover':
        code = COVER_TRANSLATION_EXAMPLE.code;
        source = 'FROM GENERIC: Cover Slide Layout';
        break;
      default:
        code = COMPLETE_TRANSLATION_EXAMPLE.code;
        source = 'FROM GENERIC: Freestyle (using Three Cards as reference)';
    }

    return {
      source,
      code,
      confidence: decision.confidence,
      reason: decision.reason || 'No strong template match'
    };
  }, [activeSlide?.html, activeSlide?.templateId, state.customTemplates]);

  // Debounced save - only fires for USER edits (not external syncs from chatbot/agent).
  // The isExternalSyncRef flag prevents: external update → sync sets localHTML → save effect
  // detects "changes" → saves old content back, overwriting the external edit.
  useEffect(() => {
    if (!activeSlide) return;

    // Skip save if we just switched slides
    if (isSlideSwitchingRef.current) return;

    // Skip save if this local state change came from external sync (chatbot edit, etc.)
    // The sync effect sets this flag before updating local state.
    if (isExternalSyncRef.current) {
      isExternalSyncRef.current = false;
      return;
    }

    // Skip save if content matches the active slide (no actual changes)
    const hasChanges =
      localHTML !== activeSlide.html ||
      localCSS !== activeSlide.customCSS ||
      localTitle !== activeSlide.title;

    if (!hasChanges) return;

    // Capture the current slide ID and content to ensure consistency
    const slideId = activeSlide.id;
    const contentToSave = {
      html: localHTML,
      customCSS: localCSS,
      title: localTitle,
    };

    const timeout = setTimeout(() => {
      // Double-check the slide ID hasn't changed before saving
      if (prevSlideIdRef.current === slideId) {
        actions.updateSlide(slideId, contentToSave);
      }
    }, 500);

    return () => clearTimeout(timeout);
    // Note: activeSlide?.html/css/title intentionally excluded from deps.
    // The save effect should only fire on local edits, not external state changes.
    // External changes are handled by the sync effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localHTML, localCSS, localTitle, activeSlide?.id, actions]);

  if (!activeSlide) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <h3>No slide selected</h3>
        <p>Select a slide from the sidebar or create a new one to start editing.</p>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-toolbar">
        {/* View Switcher */}
        <div className="toolbar-group view-switcher">
          <button className="btn btn-sm btn-ghost" onClick={onSwitchToPreview} title="Visual preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            Preview
          </button>
          <button className="btn btn-sm btn-primary" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Code
          </button>
        </div>

        <div className="toolbar-separator" />

        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          placeholder="Slide title..."
          className="title-input"
        />

        <select
          value={activeSlide.type}
          onChange={(e) => actions.updateSlide(activeSlide.id, { type: e.target.value, templateId: e.target.value, pptxRendererCode: null })}
          className="type-select"
        >
          <option value="custom">Custom</option>
          <option value="cover">Cover</option>
          <option value="three-cards">Three Cards</option>
          <option value="kpi">KPI Metrics</option>
          <option value="timeline">Timeline</option>
          <option value="quote">Quote</option>
          <option value="bullets">Bullet Points</option>
          <option value="grid">2x2 Grid</option>
        </select>
      </div>

      <div className="content-tabs">
        <button
          className={`tab-btn ${activeTab === 'rendered' ? 'active' : ''}`}
          onClick={() => setActiveTab('rendered')}
          title="Shows only the CSS that applies to this slide"
        >
          Rendered
        </button>
        <button
          className={`tab-btn ${activeTab === 'html' ? 'active' : ''}`}
          onClick={() => setActiveTab('html')}
        >
          HTML
        </button>
        <button
          className={`tab-btn ${activeTab === 'css' ? 'active' : ''}`}
          onClick={() => setActiveTab('css')}
        >
          Custom CSS
        </button>
        <button
          className={`tab-btn ${activeTab === 'shared' ? 'active' : ''}`}
          onClick={() => setActiveTab('shared')}
        >
          Shared CSS
        </button>
        <button
          className={`tab-btn ${activeTab === 'js' ? 'active' : ''}`}
          onClick={() => setActiveTab('js')}
          title={jsContent.source || 'PPTX JavaScript renderer code'}
        >
          JS (PPTX)
        </button>
      </div>

      <div className="editor-wrapper">
        {activeTab === 'rendered' && (
          <Editor
            height="100%"
            language="html"
            theme="vs-dark"
            value={renderedContent}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              readOnly: true, // Read-only view
            }}
          />
        )}

        {activeTab === 'html' && (
          <Editor
            height="100%"
            language="html"
            theme="vs-dark"
            value={localHTML}
            onChange={(value) => setLocalHTML(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              formatOnPaste: true,
            }}
          />
        )}

        {activeTab === 'css' && (
          <Editor
            height="100%"
            language="css"
            theme="vs-dark"
            value={localCSS}
            onChange={(value) => setLocalCSS(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        )}

        {activeTab === 'shared' && (
          <Editor
            height="100%"
            language="css"
            theme="vs-dark"
            value={state.sharedCSS}
            onChange={(value) => actions.updateSharedCSS(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        )}

        {activeTab === 'js' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '8px 12px',
              background: '#2d2d2d',
              borderBottom: '1px solid #404040',
              fontSize: '12px',
              color: '#9cdcfe'
            }}>
              <div><strong>Source:</strong> {jsContent.source || 'No JS renderer available'}</div>
              {jsContent.reason && (
                <div style={{ marginTop: 4, color: '#808080', fontSize: 11 }}>
                  {jsContent.reason}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <Editor
                height="100%"
                language="javascript"
                theme="vs-dark"
                value={jsContent.code ? `// PPTX Renderer Code - ${jsContent.source}\n// ${jsContent.reason || ''}\n// The AI uses HTML+CSS for content/styling, this JS shows PptxGenJS API structure\n\n${jsContent.code}` : '// No PPTX renderer code available for this slide\n// Try using a template or the slide structure will be handled generically'}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  readOnly: true, // Read-only - this is reference code
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
