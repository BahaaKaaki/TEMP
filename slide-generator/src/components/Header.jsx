import { useState, useRef, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useSlides } from '../context/SlideContext';
import {
  downloadAsHTML,
  downloadAsJSON,
  exportRenderedSlideElementsToPDF,
  exportToPDF,
  exportSingleSlideToPDF,
  generateFileName,
} from '../services/exportService';
import { themeToCSS } from '../utils/themeUtils';
import SHELL_CSS from '../styles/slides.css?raw';
import {
  getSlideMeasureClientChromeCss,
  getSlideMeasureContainerCss,
} from '../services/slidePreviewMeasureCss.js';
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
import ClientDesignProfileSwitch from './ClientDesignProfileSwitch';
import AuditLogViewer from './AuditLogViewer';
import FeaturesLanding from './FeaturesLanding';
import PptxTransformer from './PptxTransformer';
import { friendlyChatError, FRIENDLY_ERROR_MESSAGE } from '../utils/errorNotify';

// Lightweight chat bridge. AIChatbot exposes window.__edwinPostChatMessage
// on mount; we call through it so export failures surface in the chat UI
// instead of the old alert() dialogs.
const postAssistantMessage = (content) => {
  const post = window.__edwinPostChatMessage;
  if (typeof post === 'function') post(content);
};

function estimateTrackerOffset(sectionLabel = '', profile = null) {
  const activeProfile = profile || {};
  const labelLength = String(sectionLabel || '').length;
  const isStc = activeProfile?.id === 'stc';
  const base = isStc ? 38 : 22;
  const charWidth = isStc ? 6.1 : 4.8;
  const min = isStc ? 190 : 0;
  const max = isStc ? 360 : 360;
  return Math.min(max, Math.max(min, Math.round(labelLength * charWidth + base)));
}

function escapeHtmlAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripClientProfileChrome(html = '') {
  return html
    .replace(/<img\b[^>]*class="[^"]*\bclient-chrome-[a-z0-9_-]+-logo\b[^"]*"[^>]*>/gi, '')
    .replace(/<div\b[^>]*class="[^"]*\bclient-chrome-[a-z0-9_-]+-wordmark\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/\s*data-client-profile="[^"]*"/gi, '');
}

function injectClientProfileChrome(html, profile, logoUrl) {
  const cleanedHtml = stripClientProfileChrome(html || '');
  if (!profile?.id || profile.id === 'strategy' || !cleanedHtml) return cleanedHtml;

  const isSpecialMaster = /\b(master-cover|master-blank|master-emptyPage)\b/i.test(cleanedHtml)
    || /cover-slide|cover-branding|section-divider-slide|separator-slide/i.test(cleanedHtml);
  const withProfile = cleanedHtml.replace(
    /class="slide([^"]*)"/,
    `class="slide$1" data-client-profile="${escapeHtmlAttr(profile.id)}"`
  );
  if (isSpecialMaster) return withProfile;

  const wordmarkLabel = profile.id === 'pif' ? 'PIF' : profile.id === 'stc' ? 'stc' : (profile.navLabel || profile.name || profile.id);
  const logoVersion = profile?.pptxMaster?.assetVersion || profile?.status || '1';
  const logoSrc = logoUrl || (['stc', 'pif', 'dge'].includes(profile.id)
    ? `/api/assets/client-templates/${profile.id}/logo.png?v=${encodeURIComponent(logoVersion)}`
    : '');
  const logoMarkup = logoSrc
    ? `<img class="client-chrome client-chrome-${escapeHtmlAttr(profile.id)}-logo" data-no-edit src="${escapeHtmlAttr(logoSrc)}" alt="${escapeHtmlAttr(profile.name || profile.id)}" />`
    : `<div class="client-chrome client-chrome-${escapeHtmlAttr(profile.id)}-wordmark" data-no-edit>${escapeHtmlAttr(wordmarkLabel)}</div>`;
  return withProfile.replace(/(<div\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>)/i, `$1${logoMarkup}`);
}

function injectPageNumber(html = '', pageNumber, totalSlides) {
  if (!html) return html;
  const replacement = `<footer class="footer"><span>Strategy&</span><span class="source"></span><span>${pageNumber}</span></footer>`;
  if (/<footer\b[^>]*class="[^"]*\bfooter\b[^"]*"[^>]*>[\s\S]*?<\/footer>/i.test(html)) {
    return html.replace(/<footer\b[^>]*class="[^"]*\bfooter\b[^"]*"[^>]*>[\s\S]*?<\/footer>/i, replacement);
  }
  return html.replace(/<\/div>\s*$/i, `${replacement}</div>`);
}

function prepareSlideHtmlForBrowserExport(slide, slideIndex, totalSlides, activeClientProfile) {
  let html = slide?.html || '';
  if (!/class=["']slide[\s"']/i.test(html)) {
    html = `<div class="slide">${html}</div>`;
  }
  if ((html.includes('section-divider-slide') || html.includes('separator-slide')) && !html.includes('master-blank')) {
    html = html.replace(/class="slide([^"]*)"/, 'class="slide master-blank$1"');
  }
  if (html.includes('cover-slide') || html.includes('cover-branding')) {
    html = html.replace(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/gi, '');
  }
  if (slide?.sectionLabel) {
    html = html.replace(/class="slide([^"]*)"/, `class="slide$1" data-section="${escapeHtmlAttr(slide.sectionLabel)}"`);
  }
  if (slide?.subSectionLabel) {
    const trackerOffset = estimateTrackerOffset(slide.sectionLabel, activeClientProfile);
    html = html.replace(
      /class="slide([^"]*)"/,
      `class="slide$1" data-subsection="${escapeHtmlAttr(slide.subSectionLabel)}" style="--tracker-offset: ${trackerOffset}px"`
    );
  }
  html = html.replace(/class="slide([^"]*)"/, `class="slide$1" data-slide-id="${escapeHtmlAttr(slide?.id || `slide-${slideIndex + 1}`)}"`);
  html = injectPageNumber(html, slideIndex + 1, totalSlides);
  return injectClientProfileChrome(html, activeClientProfile);
}

export default function Header() {
  const { instance } = useMsal();
  const { state, actions, activeClientProfile } = useSlides();
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showGptMenu, setShowGptMenu] = useState(false);
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

  const handleLogout = async () => {
    const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
    const appUrl = (window.__ENV && window.__ENV.VITE_APP_URL) || import.meta.env.VITE_APP_URL || window.location.origin;
    if (account) {
      await instance.logoutRedirect({ account, postLogoutRedirectUri: appUrl });
    } else {
      window.location.href = appUrl;
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
    downloadAsHTML(state.slides, state.sharedCSS, 'presentation.html', state.theme);
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
      // Always pass settings so profile-specific template/font/export behavior
      // still applies when the user chooses the basic non-AI fallback export.
      // Include custom templates so their pptxRendererCode can be used as examples
      // Include sharedCSS so AI can match exact styling
      // Include vibe for vibe-specific PPTX styling
      const exportSettings = {
        ...state.settings,
        customTemplates: state.customTemplates || [],
        sharedCSS: state.sharedCSS || '',
        theme: state.theme,
      };

      console.log('[PPTX Export] Export settings:', hasCredentials ? 'AI-enabled' : 'basic fallback with profile settings');

      // Use file naming nomenclature if enabled
      const filename = generateFileName(state.deckName, 'pptx', {
        useNomenclature: state.settings.useNomenclature ?? true,
        nomenclaturePattern: state.settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}',
        version: state.deckVersions.length + 1,
      });

      // Combine custom templates for PPTX export (they may have pptxRendererCode)
      const allTemplates = state.customTemplates || [];

      const result = await exportToPPTX(
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

      // exportToPPTX always produces a .pptx (failed slides get a plain
      // fallback layout) but we still need to tell the user if anything
      // went sideways. One friendly message per export, not per slide.
      if (result && result.ok === false && Array.isArray(result.failed) && result.failed.length > 0) {
        console.warn('[PPTX Export] Completed with failures:', result.failed);
        postAssistantMessage(FRIENDLY_ERROR_MESSAGE);
      }
    } catch (err) {
      setExportProgress(null);
      postAssistantMessage(friendlyChatError(err, { tag: 'pptx-export-all' }));
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
        (progress) => setExportProgress(progress),
        state.theme
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
      const allTemplates = state.customTemplates || [];
      const singleSlideSettings = { ...state.settings, theme: state.theme, customTemplates: allTemplates };
      const result = await exportSingleSlideToPPTX(activeSlide, slideIndex + 1, state.slides.length, filename, singleSlideSettings);
      setExportProgress({ phase: 'complete', message: 'Download complete!' });
      setTimeout(() => setExportProgress(null), 2000);

      if (result && result.ok === false && Array.isArray(result.failed) && result.failed.length > 0) {
        console.warn('[PPTX Export] Single-slide completed with failures:', result.failed);
        postAssistantMessage(FRIENDLY_ERROR_MESSAGE);
      }
    } catch (err) {
      setExportProgress(null);
      postAssistantMessage(friendlyChatError(err, { tag: 'pptx-export-slide' }));
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
      await exportSingleSlideToPDF(activeSlide, state.sharedCSS, filename, null, state.theme);
      setExportProgress({ phase: 'complete', message: 'Download complete!' });
      setTimeout(() => setExportProgress(null), 2000);
    } catch (err) {
      setExportProgress(null);
      alert('Failed to download PDF: ' + err.message);
    } finally {
      setIsDownloadingSlide(false);
    }
  };

  const handleDownloadBrowserPDF = async () => {
    if (!state.slides.length) {
      alert('No slides to download. Create some slides first!');
      return;
    }
    setIsExporting(true);
    setShowExportMenu(false);
    setExportProgress({ phase: 'starting', title: 'Exporting Browser PDF', message: 'Rendering slides exactly as browser images...' });

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '960px';
    container.style.background = '#ffffff';
    container.style.pointerEvents = 'none';
    container.setAttribute('aria-hidden', 'true');

    const styleEl = document.createElement('style');
    styleEl.textContent = [
      SHELL_CSS,
      getSlideMeasureContainerCss(),
      getSlideMeasureClientChromeCss(),
      themeToCSS(state.theme),
      state.sharedCSS || '',
      ...state.slides.map(slide => slide.customCSS || ''),
    ].join('\n');
    container.appendChild(styleEl);

    try {
      state.slides.forEach((slide, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'slide-render-container';
        wrapper.style.margin = '0';
        wrapper.innerHTML = prepareSlideHtmlForBrowserExport(slide, index, state.slides.length, activeClientProfile);
        container.appendChild(wrapper);
      });

      document.body.appendChild(container);

      const filename = generateFileName(`${state.deckName}_browser`, 'pdf', {
        useNomenclature: state.settings.useNomenclature ?? true,
        nomenclaturePattern: state.settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}',
        version: state.deckVersions.length + 1,
      });

      await exportRenderedSlideElementsToPDF(container.querySelectorAll('.slide'), filename);

      setExportProgress({ phase: 'complete', message: 'Download complete!' });
      setTimeout(() => setExportProgress(null), 2000);
    } catch (err) {
      setExportProgress(null);
      alert('Failed to export browser PDF: ' + err.message);
    } finally {
      document.body.removeChild(container);
      setIsExporting(false);
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <div className="header-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 4h10a2 2 0 0 1 2 2v1H8v4h8v2H8v4h10v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#8E1E1E"/>
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

          {/* NEW DECK — sits next to the deck name as a deck-level setup control */}
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
          </div>
        </div>

        <div className="header-actions">
          {/* CLIENT TEMPLATE */}
          <ClientDesignProfileSwitch />

          {/* EXPORT */}
          <div className="header-action-group">
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

              {showExportMenu && (() => {
                const debugMode = (() => { try { return localStorage.getItem('DEBUG_MODE') === 'true'; } catch { return false; } })();
                return (
                <div className="header-dropdown export-dropdown">
                  <button
                    className="export-dropdown-card"
                    onClick={() => handleDownloadPPTX(false)}
                    disabled={anyExportBusy}
                  >
                    <span className="export-dropdown-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                        <polyline points="13 2 13 9 20 9" />
                      </svg>
                    </span>
                    <span className="export-dropdown-text">
                      <span className="export-dropdown-label">Export All Slides PPTX</span>
                      <span className="export-dropdown-hint">Editable PowerPoint</span>
                    </span>
                  </button>
                  {activeSlide && (
                    <button
                      className="export-dropdown-card"
                      onClick={handleDownloadCurrentSlidePPTX}
                      disabled={anyExportBusy}
                    >
                      <span className="export-dropdown-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="3" width="18" height="14" rx="2" />
                          <path d="M12 17v4M8 21h8" />
                        </svg>
                      </span>
                      <span className="export-dropdown-text">
                        <span className="export-dropdown-label">Export This Slide</span>
                        <span className="export-dropdown-hint">Current slide only</span>
                      </span>
                    </button>
                  )}
                  <button
                    className="export-dropdown-card"
                    onClick={handleDownloadBrowserPDF}
                    disabled={anyExportBusy}
                  >
                    {isExporting ? (
                      <>
                        <span className="export-dropdown-icon exporting">
                          <span className="spinner" style={{ width: 18, height: 18 }} />
                        </span>
                        <span className="export-dropdown-text">
                          <span className="export-dropdown-label">Exporting...</span>
                          <span className="export-dropdown-hint">Please wait</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="export-dropdown-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                          </svg>
                        </span>
                        <span className="export-dropdown-text">
                          <span className="export-dropdown-label">Export Browser PDF</span>
                          <span className="export-dropdown-hint">All slides, exact visual capture</span>
                        </span>
                      </>
                    )}
                  </button>
                  {selectedCount > 1 && (
                    <button
                      className="export-dropdown-card"
                      onClick={() => handleDownloadPPTX(true)}
                      disabled={anyExportBusy}
                    >
                      <span className="export-dropdown-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </span>
                      <span className="export-dropdown-text">
                        <span className="export-dropdown-label">Export Selected ({selectedCount})</span>
                        <span className="export-dropdown-hint">Selected slides only</span>
                      </span>
                    </button>
                  )}
                  {debugMode && (
                    <>
                      <div className="header-dropdown-divider" />
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
                        onClick={handleDownloadHTML}
                        disabled={anyExportBusy}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        HTML (.html)
                      </button>
                    </>
                  )}
                </div>
                );
              })()}
            </div>
          </div>

          {/* EDWIN ON CHATGPT */}
          <div className="header-action-group" style={{ background: 'transparent', border: '1px solid #e0e0e0' }}>
            <div style={{ position: 'relative' }}>
              <button
                className="header-action-btn"
                onClick={() => setShowGptMenu(!showGptMenu)}
                title="Edwin on ChatGPT"
                style={{ gap: 5 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a7.5 7.5 0 0 0-3 14.4V20l3-2 3 2v-3.6A7.5 7.5 0 0 0 12 2z" fill="none" />
                  <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
                </svg>
                <span className="header-btn-label">Edwin GPTs</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showGptMenu && (
                <div className="header-dropdown" style={{ minWidth: 290, padding: 6, right: 0 }}>
                  {[
                    { name: 'Edwin Assistant', desc: 'Knowledge-base reasoning & guidance', url: 'https://chatgpt.com/g/g-6996dddb1c508191bb78286dda737adc-edwin-assistant',
                      svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E1E1E" strokeWidth="1.8"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg> },
                    { name: 'Edwin Why Strategy', desc: 'Crafting Why Strategy& narratives', url: 'https://chatgpt.com/g/g-68cd507ec9cc81918cfaa9de7f52e4bf-edwin-why-strategy',
                      svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E1E1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="#8E1E1E" opacity="0.15" stroke="#8E1E1E"/></svg> },
                    { name: 'Edwin Qual Creator', desc: 'Fast qualification creation', url: 'https://chatgpt.com/g/g-68cc41d407d48191970c5cfb3c41d02d-edwin-qual-creator',
                      svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E1E1E" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
                    { name: 'Edwin Slide Builder', desc: 'Strategy& branded slides', url: 'https://chatgpt.com/g/g-6936882b659c8191aaf8ead55132f4ca-edwin-slide-builder',
                      svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E1E1E" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
                    { name: 'Edwin CV Creator', desc: 'Tailored CVs and team pages', url: 'https://chatgpt.com/g/g-6973437234b08191bda4f456c7804573-edwin-cv-creator',
                      svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E1E1E" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                    { name: 'Edwin Icon Creator', desc: 'Custom presentation icons', url: 'https://chatgpt.com/g/g-6973445942b48191ad0fc8a37839638b-edwin-icon-creator',
                      svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E1E1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.21 1.21 0 0 0 1.72 0L21.64 5.36a1.21 1.21 0 0 0 0-1.72z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg> },
                  ].map(gpt => (
                    <a
                      key={gpt.name}
                      href={gpt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="export-dropdown-card"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                      onClick={() => setShowGptMenu(false)}
                    >
                      <span className="export-dropdown-icon" style={{ background: '#FDF2F2' }}>
                        {gpt.svg}
                      </span>
                      <span className="export-dropdown-text">
                        <span className="export-dropdown-label">{gpt.name}</span>
                        <span className="export-dropdown-hint">{gpt.desc}</span>
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" style={{ flexShrink: 0, marginLeft: 'auto' }}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  ))}
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
              className="header-action-btn header-action-btn-icon"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            <button
              className="header-action-btn header-action-btn-icon"
              onClick={handleLogout}
              title="Log out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {showAuditLog && <AuditLogViewer isOpen={showAuditLog} onClose={() => setShowAuditLog(false)} />}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

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
                  <li><strong>PowerPoint</strong> -- AI-translated to native PowerPoint format</li>
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

      {showGptMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
          }}
          onClick={() => setShowGptMenu(false)}
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
