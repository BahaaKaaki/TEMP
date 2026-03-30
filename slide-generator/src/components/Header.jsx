import { useState, useRef, useEffect } from 'react';
import { useSlides } from '../context/SlideContext';
import { downloadAsHTML, downloadAsJSON, exportToPDF, exportSingleSlideToPDF, generateFileName } from '../services/exportService';
import { extractRelevantCSS } from '../services/aiService';
import {
  exportToPPTX,
  exportSingleSlideToPPTX,
  detectSlideLayoutType,
  hasAnyCredentials,
  COMPLETE_TRANSLATION_EXAMPLE,
  KPI_TRANSLATION_EXAMPLE,
  COVER_TRANSLATION_EXAMPLE
} from '../services/pptxService';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { decideTemplateUsage } from '../services/templateMatcher';
import SettingsModal from './SettingsModal';
import TemplateManager from './TemplateManager';
// import WidgetBrowser from './WidgetBrowser'; // UI declutter: widgets hidden
import AuditLogViewer from './AuditLogViewer';
import FeaturesLanding from './FeaturesLanding';
import PptxTransformer from './PptxTransformer';

export default function Header() {
  const { state, actions, historyState } = useSlides();
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  // const [showWidgetBrowser, setShowWidgetBrowser] = useState(false); // UI declutter: widgets hidden
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isDownloadingSlide, setIsDownloadingSlide] = useState(false);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(state.deckName);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [htmlPreviewContent, setHtmlPreviewContent] = useState('');
  const [showDocs, setShowDocs] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showTransformer, setShowTransformer] = useState(false);
  const nameInputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Sync editedName with state.deckName
  useEffect(() => {
    setEditedName(state.deckName);
  }, [state.deckName]);

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
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditedName(state.deckName);
      setIsEditingName(false);
    }
  };

  const handleSaveVersion = () => {
    const versionName = prompt('Enter a name for this version:', `Version ${state.deckVersions.length + 1}`);
    if (versionName !== null) {
      actions.saveVersion(versionName);
    }
  };

  const handleNewDeck = () => {
    if (state.slides.length > 0) {
      const confirmNew = window.confirm('Start a new deck? Your current deck will be auto-saved.');
      if (!confirmNew) return;
    }
    const deckName = prompt('Enter name for the new deck:', 'Untitled Deck');
    if (deckName !== null) {
      actions.startNewDeck(deckName);
    }
  };

  const handleRestoreVersion = (version) => {
    const confirm = window.confirm(`Restore "${version.name}"? Your current slides will be replaced.`);
    if (confirm) {
      actions.restoreVersion(version.id);
    }
    setShowVersionMenu(false);
  };

  const handleDeleteVersion = (e, version) => {
    e.stopPropagation();
    const confirm = window.confirm(`Delete version "${version.name}"?`);
    if (confirm) {
      actions.deleteVersion(version.id);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownloadHTML = () => {
    if (state.slides.length === 0) {
      alert('No slides to download. Create some slides first!');
      return;
    }
    downloadAsHTML(state.slides, state.sharedCSS, 'presentation.html');
    setShowExportMenu(false);
  };

  const handleDownloadJSON = () => {
    if (state.slides.length === 0) {
      alert('No slides to download. Create some slides first!');
      return;
    }
    downloadAsJSON(state.slides, state.sharedCSS, 'slides.json');
    setShowExportMenu(false);
  };

  // Helper to get generic JS example based on layout type
  const getGenericJSExample = (layoutType) => {
    switch (layoutType) {
      case 'three-cards':
        return { name: 'Generic: Three Cards Layout', code: COMPLETE_TRANSLATION_EXAMPLE.code };
      case 'two-column-kpi':
        return { name: 'Generic: Two Column KPI Layout', code: KPI_TRANSLATION_EXAMPLE.code };
      case 'cover':
        return { name: 'Generic: Cover Slide Layout', code: COVER_TRANSLATION_EXAMPLE.code };
      default:
        // For freestyle/unknown, show the three-cards example as default
        return { name: 'Generic: Freestyle (using Three Cards as reference)', code: COMPLETE_TRANSLATION_EXAMPLE.code };
    }
  };

  // Preview HTML that will be sent to AI for PPTX conversion
  const handlePreviewPPTXHtml = () => {
    if (state.slides.length === 0) {
      alert('No slides to preview. Create some slides first!');
      return;
    }

    // FIRST PASS: Collect all distinct JS examples needed
    const jsExamples = new Map(); // key -> { name, code, source }
    const slideDecisions = []; // Store decisions for each slide

    state.slides.forEach((slide) => {
      const layoutType = detectSlideLayoutType(slide.html);
      const decision = decideTemplateUsage(slide, state.customTemplates || []);
      slideDecisions.push({ layoutType, decision });

      if (decision.useTemplate && decision.pptxRendererCode) {
        const key = `template_${decision.templateId}`;
        if (!jsExamples.has(key)) {
          jsExamples.set(key, {
            key,
            name: decision.templateTitle,
            code: decision.pptxRendererCode,
            source: 'template',
            confidence: decision.confidence
          });
        }
      } else {
        // Generic example based on layout
        let key, name, code;
        if (layoutType === 'three-cards') {
          key = 'generic_three_cards';
          name = 'Three Cards Layout';
          code = COMPLETE_TRANSLATION_EXAMPLE.code;
        } else if (layoutType === 'two-column-kpi') {
          key = 'generic_kpi';
          name = 'Two Column KPI Layout';
          code = KPI_TRANSLATION_EXAMPLE.code;
        } else if (layoutType === 'cover') {
          key = 'generic_cover';
          name = 'Cover Slide Layout';
          code = COVER_TRANSLATION_EXAMPLE.code;
        } else {
          key = 'generic_freestyle';
          name = 'Freestyle (default reference)';
          code = COMPLETE_TRANSLATION_EXAMPLE.code;
        }
        if (!jsExamples.has(key)) {
          jsExamples.set(key, { key, name, code, source: 'generic' });
        }
      }
    });

    // Build JS Examples section (shown once at top)
    const jsExamplesSection = Array.from(jsExamples.values()).map((example, idx) => {
      const sourceLabel = example.source === 'template'
        ? `TEMPLATE: "${example.name}"`
        : `GENERIC: ${example.name}`;
      return `
/* ========================================
   EXAMPLE ${idx + 1}: ${sourceLabel}
   Reference ID: ${example.key}
======================================== */
${example.code}`;
    }).join('\n\n');

    // SECOND PASS: Build slide sections (HTML + CSS only, reference JS)
    const previewParts = state.slides.map((slide, index) => {
      const relevantCSS = extractRelevantCSS(slide.html);
      const { layoutType, decision } = slideDecisions[index];

      // Determine which JS example to reference
      let jsRef;
      if (decision.useTemplate && decision.pptxRendererCode) {
        jsRef = `template_${decision.templateId}`;
      } else if (layoutType === 'three-cards') {
        jsRef = 'generic_three_cards';
      } else if (layoutType === 'two-column-kpi') {
        jsRef = 'generic_kpi';
      } else if (layoutType === 'cover') {
        jsRef = 'generic_cover';
      } else {
        jsRef = 'generic_freestyle';
      }

      const matchInfo = decision.useTemplate
        ? `Template: "${decision.templateTitle}" (${decision.confidence}% match)`
        : `Freestyle (${decision.reason || 'no strong template match'})`;

      return `<!-- ========================================
SLIDE ${index + 1}: ${slide.title || 'Untitled'}
Layout: ${layoutType} | Match: ${matchInfo}
USE JS EXAMPLE: ${jsRef}
======================================== -->

<!-- HTML -->
${slide.html}

<!-- CSS (only rules for this slide) -->
<style>
${relevantCSS || '/* No CSS rules found */'}
</style>`;
    });

    const fullPreview = `<!-- ========================================
   PPTX EXPORT PREVIEW
   Distinct JS examples shown once, then referenced per slide
======================================== -->

<!-- ========================================
   JAVASCRIPT EXAMPLES (${jsExamples.size} distinct)
======================================== -->
${jsExamplesSection}

<!-- ========================================
   SLIDES TO TRANSLATE
======================================== -->

${previewParts.join('\n\n')}`;

    setHtmlPreviewContent(fullPreview);
    setShowHtmlPreview(true);
    setShowExportMenu(false);
  };

  const selectedSlideIds = state.selectedSlideIds || [];
  const selectedCount = selectedSlideIds.length;
  const getSelectedSlides = () => state.slides.filter(s => selectedSlideIds.includes(s.id));

  const handleDownloadPPTX = async (useSelected = false) => {
    const slides = useSelected ? getSelectedSlides() : state.slides;
    if (slides.length === 0) {
      alert('No slides to download. Create some slides first!');
      return;
    }

    // Check if AI credentials are available
    const hasCredentials = hasAnyCredentials(state.settings);
    console.log('[PPTX Export] Credentials check:', {
      hasCredentials,
      settings: state.settings ? 'present' : 'missing',
      apiKey: state.settings?.apiKey ? 'set' : 'not set',
      providers: state.settings?.providers ? Object.keys(state.settings.providers) : 'none',
    });

    if (!hasCredentials) {
      const proceed = window.confirm(
        'No API key configured.\n\n' +
        'Without an API key, exports will use basic text extraction instead of full-fidelity AI generation.\n\n' +
        'To enable AI-powered PPTX export:\n' +
        '1. Go to Settings (gear icon)\n' +
        '2. Add an OpenAI, Claude, or Gemini API key\n\n' +
        'Continue with basic export?'
      );
      if (!proceed) {
        return;
      }
    }

    setIsExporting(true);
    setShowExportMenu(false);
    setExportProgress({ phase: 'starting', title: 'Exporting to PowerPoint', message: 'Preparing export...' });

    try {
      // Pass settings for AI-powered generation if any API key is configured
      // Include custom templates so their pptxRendererCode can be used as examples
      // Include sharedCSS so AI can match exact styling
      // Include vibe for vibe-specific PPTX styling
      const exportSettings = hasCredentials ? {
        ...state.settings,
        customTemplates: state.customTemplates || [],
        sharedCSS: state.sharedCSS || '',
        vibe: state.vibe || 'bold',
      } : null;

      console.log('[PPTX Export] Export settings:', exportSettings ? 'AI-enabled' : 'basic fallback');

      // Use file naming nomenclature if enabled
      const filename = generateFileName(state.deckName, 'pptx', {
        useNomenclature: state.settings.useNomenclature ?? true,
        nomenclaturePattern: state.settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}',
        version: state.deckVersions.length + 1,
      });

      // Combine custom templates for PPTX export (they may have pptxRendererCode)
      const allTemplates = state.customTemplates || [];

      await exportToPPTX(
        slides,
        filename,
        exportSettings,
        (progress) => setExportProgress(progress),
        allTemplates
      );

      setExportProgress({ phase: 'complete', message: 'Download complete!' });
      setTimeout(() => {
        setExportProgress(null);
      }, 2000);
    } catch (err) {
      setExportProgress(null);
      alert('Failed to export PPTX: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = async (useSelected = false) => {
    const slides = useSelected ? getSelectedSlides() : state.slides;
    if (slides.length === 0) {
      alert('No slides to download. Create some slides first!');
      return;
    }
    setIsExporting(true);
    setShowExportMenu(false);
    setExportProgress({ phase: 'starting', title: 'Exporting to PDF', message: 'Preparing PDF export...' });

    try {
      // Use file naming nomenclature if enabled
      const filename = generateFileName(state.deckName, 'pdf', {
        useNomenclature: state.settings.useNomenclature ?? true,
        nomenclaturePattern: state.settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}',
        version: state.deckVersions.length + 1,
      });

      await exportToPDF(
        slides,
        state.sharedCSS,
        filename,
        (progress) => setExportProgress(progress)
      );

      setTimeout(() => {
        setExportProgress(null);
      }, 2000);
    } catch (err) {
      setExportProgress(null);
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.slides && Array.isArray(data.slides)) {
          actions.importSlides(data.slides);
          if (data.sharedCSS) {
            actions.updateSharedCSS(data.sharedCSS);
          }
          alert(`Imported ${data.slides.length} slide(s) successfully!`);
        } else {
          throw new Error('Invalid file format');
        }
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    input.click();
    setShowExportMenu(false);
  };

  const activeSlide = state.slides.find(s => s.id === state.activeSlideId);

  const anyExportBusy = isExporting || isDownloadingSlide;

  const handleDownloadCurrentSlidePPTX = async () => {
    if (!activeSlide) return;
    setIsDownloadingSlide(true);
    setShowExportMenu(false);
    setExportProgress({ phase: 'starting', title: 'Exporting Slide to PPTX', message: 'Generating PowerPoint for current slide...' });
    try {
      const slideIndex = state.slides.findIndex(s => s.id === activeSlide.id);
      const filename = generateFileName(`${state.deckName}_Slide${slideIndex + 1}`, 'pptx', {
        useNomenclature: state.settings.useNomenclature ?? true,
        nomenclaturePattern: state.settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}',
        version: 1,
      });
      const settingsWithVibe = { ...state.settings, vibe: state.vibe };
      const allTemplates = state.customTemplates || [];
      await exportSingleSlideToPPTX(activeSlide, slideIndex + 1, state.slides.length, filename, settingsWithVibe, null, allTemplates);
      setExportProgress({ phase: 'complete', message: 'Download complete!' });
      setTimeout(() => setExportProgress(null), 2000);
    } catch (err) {
      setExportProgress(null);
      alert('Failed to download PPTX: ' + err.message);
    } finally {
      setIsDownloadingSlide(false);
    }
  };

  const handleDownloadCurrentSlidePDF = async () => {
    if (!activeSlide) return;
    setIsDownloadingSlide(true);
    setShowExportMenu(false);
    setExportProgress({ phase: 'starting', title: 'Exporting Slide to PDF', message: 'Generating PDF for current slide...' });
    try {
      const slideIndex = state.slides.findIndex(s => s.id === activeSlide.id);
      const filename = generateFileName(`${state.deckName}_Slide${slideIndex + 1}`, 'pdf', {
        useNomenclature: state.settings.useNomenclature ?? true,
        nomenclaturePattern: state.settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}',
        version: 1,
      });
      await exportSingleSlideToPDF(activeSlide, state.sharedCSS, filename);
      setExportProgress({ phase: 'complete', message: 'Download complete!' });
      setTimeout(() => setExportProgress(null), 2000);
    } catch (err) {
      setExportProgress(null);
      alert('Failed to download PDF: ' + err.message);
    } finally {
      setIsDownloadingSlide(false);
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <div className="header-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              {/* Stylized E with spark */}
              <path d="M6 4h10a2 2 0 0 1 2 2v1H8v4h8v2H8v4h10v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#8E1E1E"/>
              {/* Intelligence spark */}
              <circle cx="19" cy="5" r="2" fill="#8E1E1E"/>
              <path d="M19 2v1M19 7v1M16.5 5h1M21 5h1M17 3l.7.7M20.3 6.3l.7.7M17 7l.7-.7M20.3 3.7l.7-.7" stroke="#8E1E1E" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span style={{ color: '#8E1E1E', fontWeight: 700 }}>Edwin AI</span>
          </div>

          <div className="header-deck-name">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                className="deck-name-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
              />
            ) : (
              <button
                className="deck-name-button"
                onClick={() => setIsEditingName(true)}
                title="Click to edit deck name"
              >
                {state.deckName}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="header-actions">
          {/* FILE ACTIONS */}
          <div className="header-action-group">
            <button
              className="header-action-btn"
              onClick={handleNewDeck}
              title="New deck"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span className="header-btn-label">New</span>
            </button>

            {/* UI declutter: Import hidden
            <button className="header-action-btn" onClick={handleImport} title="Import JSON">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="header-btn-label">Import</span>
            </button>
            */}

            <div style={{ position: 'relative' }}>
              <button
                className="header-action-btn header-action-btn-primary"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export deck"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span className="header-btn-label">Export</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showExportMenu && (
                <div className="header-dropdown">
                  <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    All Slides
                  </div>
                  <button
                    className="header-dropdown-item header-dropdown-item-accent"
                    onClick={handlePreviewPPTXHtml}
                    disabled={anyExportBusy}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Preview HTML
                  </button>
                  <button
                    className="header-dropdown-item"
                    onClick={() => handleDownloadPPTX(false)}
                    disabled={anyExportBusy}
                  >
                    {isExporting ? (
                      <>
                        <span className="spinner" style={{ width: 14, height: 14 }} />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                        PowerPoint (.pptx)
                      </>
                    )}
                  </button>
                  <button
                    className="header-dropdown-item"
                    onClick={() => handleDownloadPDF(false)}
                    disabled={anyExportBusy}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    PDF (.pdf)
                  </button>
                  <button
                    className="header-dropdown-item"
                    onClick={handleDownloadHTML}
                    disabled={anyExportBusy}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    HTML (.html)
                  </button>
                  {selectedCount > 1 && (
                    <>
                      <div className="header-dropdown-divider" />
                      <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {selectedCount} Selected Slides
                      </div>
                      <button
                        className="header-dropdown-item"
                        onClick={() => handleDownloadPPTX(true)}
                        disabled={anyExportBusy}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                        Selected as PPTX
                      </button>
                      <button
                        className="header-dropdown-item"
                        onClick={() => handleDownloadPDF(true)}
                        disabled={anyExportBusy}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Selected as PDF
                      </button>
                    </>
                  )}
                  {activeSlide && (
                    <>
                      <div className="header-dropdown-divider" />
                      <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Current Slide
                      </div>
                      <button
                        className="header-dropdown-item"
                        onClick={handleDownloadCurrentSlidePPTX}
                        disabled={anyExportBusy}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                        This Slide as PPTX
                      </button>
                      <button
                        className="header-dropdown-item"
                        onClick={handleDownloadCurrentSlidePDF}
                        disabled={anyExportBusy}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        This Slide as PDF
                      </button>
                    </>
                  )}
                  <div className="header-dropdown-divider" />
                  <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Data
                  </div>
                  <button
                    className="header-dropdown-item"
                    disabled
                    title="JSON export — Coming soon"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                    JSON (.json)
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="header-action-group">
            {/* UI declutter: Save hidden
            <button
              className="header-action-btn"
              onClick={handleSaveVersion}
              title="Save version"
              disabled={state.slides.length === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span className="header-btn-label">Save</span>
            </button>
            */}

            <div style={{ position: 'relative' }}>
              <button
                className="header-action-btn"
                onClick={() => setShowVersionMenu(!showVersionMenu)}
                title="Version history"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="header-btn-label">History</span>
                {state.deckVersions.length > 0 && (
                  <span className="header-badge">{state.deckVersions.length}</span>
                )}
              </button>

              {showVersionMenu && (
                  <div className="version-menu">
                    <div className="version-menu-title">Saved Versions</div>
                    {state.deckVersions.length === 0 ? (
                      <div className="version-menu-empty">
                        No saved versions yet.
                        <br />
                        <span>Click save to create a version.</span>
                      </div>
                    ) : (
                      <div className="version-menu-list">
                        {[...state.deckVersions].reverse().map((version) => (
                          <div
                            key={version.id}
                            className="version-menu-item"
                            onClick={() => handleRestoreVersion(version)}
                          >
                            <div className="version-menu-item-info">
                              <div className="version-menu-item-name">{version.name}</div>
                              <div className="version-menu-item-meta">
                                {version.slides?.length || 0} slides · {formatDate(version.timestamp)}
                              </div>
                            </div>
                            <button
                              className="version-menu-item-delete"
                              onClick={(e) => handleDeleteVersion(e, version)}
                              title="Delete version"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* EDIT ACTIONS */}
          <div className="header-action-group">
            <button
              className="header-action-btn"
              onClick={() => actions.undo()}
              disabled={!historyState?.canUndo}
              title={`Undo (Ctrl+Z)${historyState?.historyLength ? ` - ${historyState.historyLength} steps` : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13" />
              </svg>
              <span className="header-btn-label">Undo</span>
            </button>
            <button
              className="header-action-btn"
              onClick={() => actions.redo()}
              disabled={!historyState?.canRedo}
              title={`Redo (Ctrl+Shift+Z)${historyState?.futureLength ? ` - ${historyState.futureLength} steps` : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 13" />
              </svg>
              <span className="header-btn-label">Redo</span>
            </button>
          </div>

          {/* DESIGN ACTIONS */}
          <div className="header-action-group">
            <button
              className="header-action-btn"
              onClick={() => setShowTemplateManager(true)}
              title="Templates"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span className="header-btn-label">Templates</span>
            </button>

            {/* UI declutter: Widgets button hidden
            <button
              className="header-action-btn"
              onClick={() => setShowWidgetBrowser(true)}
              title="Widgets"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M17 14v7M14 17.5h7" />
              </svg>
            </button>
            */}
          </div>

          {/* TOOLS */}
          <div className="header-action-group header-action-group-tools">
            {/* UI declutter: Transform, Info, Docs hidden
            <button
              className="header-action-btn"
              disabled
              title="Transform PPTX — Coming soon"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span className="header-btn-label">Transform</span>
            </button>

            <button
              className="header-action-btn"
              disabled
              title="Platform Overview — Coming soon"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span className="header-btn-label">Info</span>
            </button>

            <button
              className="header-action-btn"
              disabled
              title="Documentation — Coming soon"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <span className="header-btn-label">Docs</span>
            </button>
            */}

            <button
              className="header-action-btn header-action-btn-settings"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="header-btn-label">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {showAuditLog && <AuditLogViewer isOpen={showAuditLog} onClose={() => setShowAuditLog(false)} />}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showTemplateManager && <TemplateManager onClose={() => setShowTemplateManager(false)} />}

      {/* UI declutter: WidgetBrowser hidden
      <WidgetBrowser isOpen={showWidgetBrowser} onClose={() => setShowWidgetBrowser(false)} />
      */}

      {showFeatures && <FeaturesLanding onClose={() => setShowFeatures(false)} />}

      {showTransformer && <PptxTransformer onClose={() => setShowTransformer(false)} />}

      {/* Documentation Panel */}
      {showDocs && (
        <div className="docs-overlay" onClick={() => setShowDocs(false)}>
          <div className="docs-panel" onClick={(e) => e.stopPropagation()}>
            <div className="docs-header">
              <h2>Edwin AI Documentation</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDocs(false)}>&#10005;</button>
            </div>
            <div className="docs-body">

              <section className="docs-section">
                <h3>Overview</h3>
                <p>Edwin AI is an AI-powered presentation and report generation platform. It combines a visual slide editor with a consulting-grade agentic AI system to produce professional decks and interactive HTML reports.</p>
              </section>

              <section className="docs-section">
                <h3>Two Modes</h3>
                <div className="docs-cards">
                  <div className="docs-card">
                    <div className="docs-card-badge">Standard</div>
                    <p>Type a prompt in the chat. Edwin generates slides directly. Best for simple, focused requests like "Create a cover slide for Q3 results" or "Add a timeline of project phases".</p>
                    <p className="docs-hint">Edwin will ask clarifying questions if your request is ambiguous.</p>
                  </div>
                  <div className="docs-card">
                    <div className="docs-card-badge agent">Agent</div>
                    <p>Toggle <strong>Agent Mode</strong> in the chat. Edwin assembles a virtual consulting team that researches, plans, and builds a full deck or interactive report collaboratively.</p>
                    <p className="docs-hint">Best for complex, multi-section deliverables: market analyses, benchmarks, strategy decks, executive reports.</p>
                  </div>
                </div>
              </section>

              <section className="docs-section">
                <h3>Agent Mode Workflow</h3>
                <ol>
                  <li><strong>Scoping</strong> — Edwin reads your request and determines scope, audience, and structure.</li>
                  <li><strong>Planning</strong> — A research plan is created with sections and assigned team members.</li>
                  <li><strong>Research</strong> — Each team member works in parallel, gathering data and building section content.</li>
                  <li><strong>Review &amp; Merge</strong> — The manager reviews all findings and merges them into a cohesive deliverable.</li>
                  <li><strong>Output</strong> — Final slides or an interactive HTML report are generated.</li>
                </ol>
                <p className="docs-hint">You can watch the plan execute in real-time and expand each step to see detailed activity.</p>
              </section>

              <section className="docs-section">
                <h3>Interactive Reports</h3>
                <p>When Agent Mode is set to <strong>Report</strong> output, Edwin produces a self-contained HTML report with:</p>
                <ul>
                  <li>Interactive Chart.js charts (bar, line, area, donut, radar, scatter, waterfall, and more)</li>
                  <li>Sidebar navigation between sections</li>
                  <li>Metric cards, heatmaps, timelines, process flows</li>
                  <li>Visual primitives: numbered circles, letter badges, icon circles, pills, accent bars</li>
                  <li>Hover interactivity on all elements</li>
                  <li>Print and download built in</li>
                </ul>
              </section>

              <section className="docs-section">
                <h3>Slide Editor</h3>
                <ul>
                  <li><strong>Preview</strong> — View the rendered slide</li>
                  <li><strong>Edit Code</strong> — Edit HTML directly with the Monaco editor</li>
                  <li><strong>Split View</strong> — See both preview and code side-by-side</li>
                  <li><strong>Custom CSS</strong> — Add slide-specific styles</li>
                  <li><strong>Shared CSS</strong> — Modify styles that apply to all slides</li>
                  <li><strong>Drag &amp; Drop</strong> — Reorder slides in the sidebar</li>
                </ul>
              </section>

              <section className="docs-section">
                <h3>Export Options</h3>
                <ul>
                  <li><strong>PowerPoint (.pptx)</strong> — AI-translated to native PowerPoint format</li>
                  <li><strong>PDF (.pdf)</strong> — High-quality print-ready export</li>
                  <li><strong>HTML (.html)</strong> — Self-contained file with all styles embedded</li>
                  <li><strong>JSON (.json)</strong> — Full deck data for backup or import</li>
                </ul>
              </section>

              <section className="docs-section">
                <h3>Settings</h3>
                <p>Click the gear icon to configure:</p>
                <ul>
                  <li><strong>API Provider &amp; Model</strong> — Choose between OpenAI, Anthropic, Google, or any compatible API</li>
                  <li><strong>Agent Settings</strong> — Team size, budget cap, research depth, manager persona name</li>
                  <li><strong>Report Settings</strong> — Model, max tokens, reasoning effort for HTML reports</li>
                  <li><strong>Templates &amp; Vibes</strong> — Default slide styles and design bundles</li>
                </ul>
              </section>

              <section className="docs-section">
                <h3>Keyboard Shortcuts</h3>
                <div className="docs-shortcuts">
                  <div><kbd>Ctrl+Z</kbd> Undo</div>
                  <div><kbd>Ctrl+Shift+Z</kbd> Redo</div>
                  <div><kbd>Ctrl+S</kbd> Save version</div>
                  <div><kbd>Enter</kbd> Send message (in chat)</div>
                  <div><kbd>Shift+Enter</kbd> New line (in chat)</div>
                </div>
              </section>

              <section className="docs-section">
                <h3>AI Activity Log</h3>
                <p>After each agent run, click <strong>View AI I/O</strong> to inspect every AI call made — including the model used, token limits, duration, and full input/output. Useful for debugging and understanding how Edwin built your deliverable.</p>
              </section>

              <section className="docs-section">
                <h3>Skills (Knowledge Base)</h3>
                <p>Edwin's agent is guided by a set of consulting skills that shape how it reasons, delegates, and produces content. These are injected into the AI context automatically.</p>
                <div className="docs-skills">
                  <div className="docs-skill">
                    <div className="docs-skill-name">Consulting Team Context</div>
                    <p>Frames Edwin as a consulting engagement lead who scopes work, staffs teams of consultant personas, and delegates specialized tasks based on complexity.</p>
                  </div>
                  <div className="docs-skill">
                    <div className="docs-skill-name">Team Dynamics &amp; Delegation</div>
                    <p>Scope first, staff based on need, delegate for depth. Personas add distinct lenses — data, industry, strategy. Budget-aware: solo for simple, team for complex.</p>
                  </div>
                  <div className="docs-skill">
                    <div className="docs-skill-name">Consulting Communication</div>
                    <p>Pyramid Principle (answer first, then evidence), MECE structure, one key message per slide, executive-friendly language, data over vague statements.</p>
                  </div>
                  <div className="docs-skill">
                    <div className="docs-skill-name">Content Engine</div>
                    <p>Edwin handles content (research, analyze, structure, write). The visual engine handles layout and templates. Each slide instruction is self-contained with all data baked in.</p>
                  </div>
                  <div className="docs-skill">
                    <div className="docs-skill-name">Research &amp; Synthesis</div>
                    <p>Search for specific data, use exact numbers, cite sources, distinguish facts from estimates, synthesize into clear takeaways with supporting evidence.</p>
                  </div>
                  <div className="docs-skill">
                    <div className="docs-skill-name">Quality Review</div>
                    <p>Check alignment with requirements, verify data accuracy, ensure narrative coherence, validate completeness, flag placeholder values or fabricated data.</p>
                  </div>
                  <div className="docs-skill">
                    <div className="docs-skill-name">Budget Efficiency</div>
                    <p>Low budget: work solo, go direct. High budget: scope, staff, research in depth, review, iterate. Always reserve enough for the final build call.</p>
                  </div>
                </div>
              </section>

              <section className="docs-section docs-section-last">
                <h3>Tips</h3>
                <ul>
                  <li>Be specific about your audience and desired outcome for best results</li>
                  <li>In Agent Mode, more context = better output. Attach documents or paste data</li>
                  <li>Use "continue" if the agent runs out of budget mid-task</li>
                  <li>Reports work best with GPT 5.2 / Claude / Gemini at 32K+ tokens</li>
                  <li>Save versions before making big edits — you can always restore</li>
                </ul>
              </section>

            </div>
          </div>
        </div>
      )}

      {/* HTML Preview Modal - Shows HTML before PPTX conversion */}
      {showHtmlPreview && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowHtmlPreview(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              width: '90%',
              maxWidth: 1000,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>HTML Preview (Before PPTX Conversion)</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                  This is the HTML that will be sent to AI for PPTX conversion
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowHtmlPreview(false)}
                style={{ padding: '6px 12px' }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 16,
              }}
            >
              <pre
                style={{
                  margin: 0,
                  padding: 16,
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.5,
                  overflow: 'auto',
                  maxHeight: 'calc(90vh - 180px)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {htmlPreviewContent}
              </pre>
            </div>
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(htmlPreviewContent);
                  alert('HTML copied to clipboard!');
                }}
              >
                Copy HTML
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowHtmlPreview(false);
                  handleDownloadPPTX();
                }}
              >
                Continue to PPTX Export
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
          }}
          onClick={() => setShowExportMenu(false)}
        />
      )}

      {showVersionMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
          }}
          onClick={() => setShowVersionMenu(false)}
        />
      )}


      {/* Export Progress Overlay */}
      {exportProgress && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: '32px 48px',
              textAlign: 'center',
              maxWidth: 400,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            {exportProgress.phase !== 'complete' ? (
              <>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    border: '3px solid #e6e9ee',
                    borderTopColor: '#8E1E1E',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px',
                  }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            ) : (
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                style={{ margin: '0 auto 16px', display: 'block' }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            )}
            <h3 style={{ margin: '0 0 8px', color: '#111', fontSize: 18 }}>
              {exportProgress.phase === 'complete' ? 'Export Complete!' : (exportProgress.title || 'Exporting...')}
            </h3>
            <p style={{ margin: 0, color: '#4A4F57', fontSize: 14 }}>
              {exportProgress.message}
            </p>
            {exportProgress.total && exportProgress.phase !== 'complete' && (
              <div style={{ marginTop: 16, minWidth: 240 }}>
                <div
                  style={{
                    height: 8,
                    background: '#e6e9ee',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: '#8E1E1E',
                      borderRadius: 4,
                      width: `${((exportProgress.processed || 0) / exportProgress.total) * 100}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8
                }}>
                  <span style={{ color: '#4A4F57', fontSize: 13, fontWeight: 500 }}>
                    {exportProgress.processed || 0} / {exportProgress.total} slides
                  </span>
                  {exportProgress.batch && exportProgress.totalBatches && (
                    <span style={{ color: '#888', fontSize: 12 }}>
                      Batch {exportProgress.batch}/{exportProgress.totalBatches}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
