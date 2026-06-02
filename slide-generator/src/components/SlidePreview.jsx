import { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useSlides } from '../context/SlideContext';
import { transformElementToWidget, hasAnyApiKey } from '../services/aiService';
import { exportSingleSlideToPPTX, testPPTXCodeGeneration } from '../services/pptxService';
import { exportSingleSlideToPDF, generateFileName } from '../services/exportService';
import { WIDGET_CATEGORIES, getWidgetsByCategory } from '../utils/slideWidgets';
import { themeToCSS } from '../utils/themeUtils';
import { authFetch } from '../services/authFetch';
import CommentPanel from './CommentPanel';
import { normalizeFlexProseInSlideMount } from '../utils/slideDomNormalize';
import {
  getSlideMeasureContainerCss as getBaseCSS,
  getSlideMeasureClientChromeCss as getClientChromeCSS,
} from '../services/slidePreviewMeasureCss.js';
import {
  fetchClientChromeObjectUrls,
  injectClientProfileChrome,
  injectFooterBranding,
  injectPageNumber,
} from '../utils/slideChromeUtils.js';
import { getClientProfileFooterBranding } from '../utils/clientDesignProfiles.js';
import {
  filterRenderableSlideSources,
  isSearchEngineResultsUrl,
  isResearchCandidateSource,
} from '../utils/sourceRendering.js';

export { getBaseCSS };

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_ZOOM = 1;
const DEBUG_MODE = typeof window !== 'undefined' && localStorage.getItem('DEBUG_MODE') === 'true';

function decodeHtmlEntities(value = '') {
  if (typeof document === 'undefined') return String(value || '');
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value || '');
  return textarea.value;
}

function normalizeWhitespace(value = '') {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function getSourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function cleanSourceLabel(value = '') {
  return normalizeWhitespace(value)
    .replace(/^\s*(sources?|references?|citation)\s*[:\-\u2013]\s*/i, '')
    .replace(/\s*\(?https?:\/\/\S+\)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSlideSources(html = '', metadataSources = []) {
  if (typeof DOMParser === 'undefined' && (!metadataSources || metadataSources.length === 0)) return [];
  const doc = typeof DOMParser !== 'undefined'
    ? new DOMParser().parseFromString(html || '', 'text/html')
    : null;
  const sources = [];
  const seen = new Set();

  const addSource = ({
    label,
    url,
    context,
    type = 'link',
    fileId,
    documentId,
    generatedFrom,
    sourceKind,
  } = {}) => {
    const cleanLabel = cleanSourceLabel(label) || getSourceHost(url) || 'Source';
    const cleanUrl = typeof url === 'string' && /^https?:\/\//i.test(url.trim())
      ? url.trim()
      : '';
    const hasAttachment = !!(fileId || documentId);
    if (!cleanUrl && !hasAttachment) {
      if (DEBUG_MODE && (label || url)) {
        // eslint-disable-next-line no-console
        console.warn('[sources] skipping non-renderable citation (no http(s) URL or document id)', { label, url, type });
      }
      return;
    }
    if (cleanUrl && isSearchEngineResultsUrl(cleanUrl)) {
      if (DEBUG_MODE) {
        // eslint-disable-next-line no-console
        console.warn('[sources] rejecting search-engine results URL', cleanUrl);
      }
      return;
    }
    const key = cleanUrl || String(fileId || documentId || '').toLowerCase() || cleanLabel.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    sources.push({
      id: `source-${sources.length + 1}`,
      label: cleanLabel,
      url: cleanUrl,
      host: cleanUrl ? getSourceHost(cleanUrl) : '',
      context: normalizeWhitespace(context || ''),
      type: cleanUrl || hasAttachment ? type : 'metadata',
      fileId,
      documentId,
      generatedFrom,
      sourceKind,
    });
  };

  metadataSources.forEach(source => {
    if (!source) return;
    if (typeof source === 'string') {
      const t = source.trim();
      if (/^https?:\/\//i.test(t)) {
        addSource({ label: t, url: t, context: t, type: 'metadata' });
      }
      return;
    }
    if (isResearchCandidateSource(source)) {
      if (DEBUG_MODE) {
        // eslint-disable-next-line no-console
        console.warn('[sources] skipping research-candidate metadata', source);
      }
      return;
    }
    const u = String(source.url || '').trim();
    if (u && isSearchEngineResultsUrl(u)) {
      if (DEBUG_MODE) {
        // eslint-disable-next-line no-console
        console.warn('[sources] rejecting SERP in slide metadata', u);
      }
      return;
    }
    if (!u && !source.fileId && !source.documentId) return;
    addSource({
      label: source.label || source.title || u || 'Source',
      url: u,
      context: source.note || source.snippet || source.label || '',
      type: 'metadata',
      fileId: source.fileId,
      documentId: source.documentId,
      generatedFrom: source.generatedFrom,
      sourceKind: source.sourceKind,
    });
  });

  if (!doc) return sources.slice(0, 20);

  doc.querySelectorAll('a[href]').forEach(anchor => {
    const href = anchor.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    addSource({
      label: anchor.textContent || href,
      url: href,
      context: anchor.closest('tr, li, p, div, footer')?.textContent || anchor.textContent || href,
      type: 'link',
    });
  });

  const bodyText = doc.body?.textContent || '';
  for (const match of bodyText.matchAll(/https?:\/\/[^\s<>)"]+/gi)) {
    const url = match[0].replace(/[.,;:]+$/, '');
    addSource({ label: getSourceHost(url) || url, url, context: url, type: 'url' });
  }

  return sources.slice(0, 20);
}

// Category icon helper for context menu
function getCategoryIcon(category) {
  const iconMap = {
    [WIDGET_CATEGORIES.CHARTS]: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
    [WIDGET_CATEGORIES.CARDS]: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></svg>,
    [WIDGET_CATEGORIES.STATISTICS]: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
    [WIDGET_CATEGORIES.LISTS]: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>,
    [WIDGET_CATEGORIES.INFOGRAPHICS]: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2v10l8.5 5" /></svg>,
    [WIDGET_CATEGORIES.TEXT]: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 10H3M21 6H3M21 14H3M17 18H3" /></svg>,
    [WIDGET_CATEGORIES.LAYOUTS]: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    [WIDGET_CATEGORIES.TABLES]: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>,
  };
  return iconMap[category] || <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>;
}

export default function SlidePreview({ onSwitchToCode }) {
  const { activeSlide, state, actions, activeClientProfile } = useSlides();
  const [isEditMode, setIsEditMode] = useState(true); // Always on
  const [isVisualEditMode, setIsVisualEditMode] = useState(true); // Always on
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0 });
  const slideRef = useRef(null);
  const previewWrapperRef = useRef(null);
  // Ref that always tracks the current active slide ID — used inside setTimeout
  // callbacks to detect stale closures when the user clicks another slide
  // before a delayed save fires.
  const activeSlideIdRef = useRef(activeSlide?.id);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showPPTXTest, setShowPPTXTest] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pptxTestResult, setPptxTestResult] = useState(null);
  const [isTestingPPTX, setIsTestingPPTX] = useState(false);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [clientLogoUrl, setClientLogoUrl] = useState(null);
  const [clientLogoIconUrl, setClientLogoIconUrl] = useState(null);
  const downloadMenuRef = useRef(null);
  const commentPanelRef = useRef(null);

  // Widget context menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetElement: null });
  const [contextMenuCategory, setContextMenuCategory] = useState(null);
  const [isReplacingWidget, setIsReplacingWidget] = useState(false);
  const contextMenuRef = useRef(null);

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target)) {
        setShowDownloadMenu(false);
      }
    };
    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDownloadMenu]);

  // Keep activeSlideIdRef in sync — used by setTimeout guards
  useEffect(() => {
    activeSlideIdRef.current = activeSlide?.id;
  }, [activeSlide?.id]);

  useEffect(() => {
    if (!activeClientProfile?.chrome?.positions?.logo) {
      setClientLogoUrl(null);
      setClientLogoIconUrl(null);
      return undefined;
    }

    let cancelled = false;
    const objectUrls = { wordmark: null, icon: null };

    fetchClientChromeObjectUrls(activeClientProfile, authFetch)
      .then(({ wordmark, icon }) => {
        if (cancelled) {
          if (wordmark) URL.revokeObjectURL(wordmark);
          if (icon) URL.revokeObjectURL(icon);
          return;
        }
        objectUrls.wordmark = wordmark;
        objectUrls.icon = icon;
        setClientLogoUrl(wordmark);
        setClientLogoIconUrl(icon);
      })
      .catch(err => {
        if (cancelled) return;
        console.warn('[SlidePreview] Client chrome unavailable:', err.message);
        setClientLogoUrl(null);
        setClientLogoIconUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrls.wordmark) URL.revokeObjectURL(objectUrls.wordmark);
      if (objectUrls.icon) URL.revokeObjectURL(objectUrls.icon);
    };
  }, [activeClientProfile?.id, activeClientProfile?.pptxMaster?.assetVersion, activeClientProfile?.status]);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Get pending comments count for the floating button
  const pendingCommentsCount = useMemo(() => {
    if (!activeSlide?.comments) return 0;
    return activeSlide.comments.filter(c => !c.addressed).length;
  }, [activeSlide?.comments]);

  // Get deck-wide comment stats
  const deckCommentStats = useMemo(() => {
    let totalPending = 0;
    let totalAddressed = 0;
    let slidesWithPending = 0;

    state.slides.forEach(slide => {
      const comments = slide.comments || [];
      const pending = comments.filter(c => !c.addressed).length;
      const addressed = comments.filter(c => c.addressed).length;
      totalPending += pending;
      totalAddressed += addressed;
      if (pending > 0) slidesWithPending++;
    });

    return { totalPending, totalAddressed, slidesWithPending };
  }, [state.slides]);

  // Handle address all deck comments
  const handleAddressAllDeckComments = () => {
    state.slides.forEach(slide => {
      if (slide.comments?.some(c => !c.addressed)) {
        actions.addressAllSlideComments(slide.id, 'Manual');
      }
    });
  };

  // Single slide download handlers
  const handleDownloadSlidePPTX = async () => {
    if (!activeSlide) return;
    setIsDownloading(true);
    setShowDownloadMenu(false);
    try {
      const slideIndex = state.slides.findIndex(s => s.id === activeSlide.id);
      const filename = generateFileName(`${state.deckName}_Slide${slideIndex + 1}`, 'pptx', {
        useNomenclature: state.settings.useNomenclature ?? true,
        nomenclaturePattern: state.settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}',
        version: 1,
      });
      const allTemplates = state.customTemplates || [];
      const pptxSettings = { ...state.settings, theme: state.theme, customTemplates: allTemplates };
      await exportSingleSlideToPPTX(activeSlide, slideIndex + 1, state.slides.length, filename, pptxSettings);
    } catch (err) {
      console.error('Failed to download PPTX:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSlidePDF = async () => {
    if (!activeSlide) return;
    setIsDownloading(true);
    setShowDownloadMenu(false);
    try {
      const slideIndex = state.slides.findIndex(s => s.id === activeSlide.id);
      const filename = generateFileName(`${state.deckName}_Slide${slideIndex + 1}`, 'pdf', {
        useNomenclature: state.settings.useNomenclature ?? true,
        nomenclaturePattern: state.settings.nomenclaturePattern || 'yyyymmdd_S&_{name}_V{version}',
        version: 1,
      });
      await exportSingleSlideToPDF(activeSlide, state.sharedCSS, filename, null, state.theme, state.settings);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTestPPTXCode = async () => {
    if (!activeSlide) return;
    setIsTestingPPTX(true);
    setPptxTestResult(null);
    try {
      const slideIndex = state.slides.findIndex(s => s.id === activeSlide.id);
      const pptxTestSettings = { ...state.settings, theme: state.theme };
      const result = await testPPTXCodeGeneration(activeSlide, slideIndex + 1, state.slides.length, pptxTestSettings);
      setPptxTestResult(result);
      setShowPPTXTest(true);
    } catch (err) {
      setPptxTestResult({ error: err.message, code: null, validation: { valid: false, error: err.message } });
      setShowPPTXTest(true);
    } finally {
      setIsTestingPPTX(false);
    }
  };

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    if (currentIndex === -1) {
      // Find nearest level and go up
      const nextLevel = ZOOM_LEVELS.find(l => l > zoom) || ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      setZoom(nextLevel);
    } else if (currentIndex < ZOOM_LEVELS.length - 1) {
      setZoom(ZOOM_LEVELS[currentIndex + 1]);
    }
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    if (currentIndex === -1) {
      // Find nearest level and go down
      const prevLevel = [...ZOOM_LEVELS].reverse().find(l => l < zoom) || ZOOM_LEVELS[0];
      setZoom(prevLevel);
    } else if (currentIndex > 0) {
      setZoom(ZOOM_LEVELS[currentIndex - 1]);
    }
  }, [zoom]);

  const handleZoomFit = useCallback(() => {
    if (previewWrapperRef.current) {
      const container = previewWrapperRef.current;
      const style = getComputedStyle(container);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const containerWidth = container.clientWidth - padX;
      const containerHeight = container.clientHeight - padY;
      const slideWidth = 960;
      const slideHeight = 540;
      const fitZoom = Math.min(containerWidth / slideWidth, containerHeight / slideHeight);
      setZoom(Math.max(0.1, Math.round(fitZoom * 100) / 100));
    }
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  // Auto-fit zoom when the preview container appears, resizes, or the active slide changes
  useEffect(() => {
    const wrapper = previewWrapperRef.current;
    if (!wrapper) return;

    const timer = setTimeout(() => handleZoomFit(), 50);

    const ro = new ResizeObserver(() => handleZoomFit());
    ro.observe(wrapper);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [handleZoomFit, activeSlide?.id]);

  // Context menu handlers for widget insertion (disabled -- widgets not needed for now)
  const handleContextMenu = useCallback((e) => {
    return;

    // Remove previous highlight
    if (contextMenu.targetElement) {
      contextMenu.targetElement.classList.remove('widget-target');
    }

    // Find the target element (closest editable/container element)
    const target = e.target.closest('.card, .kpi-block, .frame, .section-box, .content-box, .metric-box, .quote-box, [class*="exec-"], .pillar, .timeline-content, .grid-cell, p, h1, h2, h3, h4, li, .content-list, ul');

    if (!target) {
      // If no specific element found, allow insertion at the slide level
      const slideEl = slideRef.current?.querySelector('.slide');
      if (slideEl) {
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          targetElement: slideEl,
          insertMode: 'append' // Append to slide
        });
        setContextMenuCategory(null);
      }
      return;
    }

    // Highlight the target element
    target.classList.add('widget-target');

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetElement: target,
      insertMode: 'replace' // Replace content
    });
    setContextMenuCategory(null);
  }, [isEditMode, isVisualEditMode, contextMenu.targetElement]);

  const handleCloseContextMenu = useCallback(() => {
    // Remove highlight from target element
    if (contextMenu.targetElement) {
      contextMenu.targetElement.classList.remove('widget-target');
    }
    setContextMenu({ visible: false, x: 0, y: 0, targetElement: null });
    setContextMenuCategory(null);
  }, [contextMenu.targetElement]);

  const handleInsertWidget = useCallback(async (widget) => {
    if (!contextMenu.targetElement || !activeSlide) return;

    const target = contextMenu.targetElement;
    const widgetHtml = widget.html;

    if (contextMenu.insertMode === 'append') {
      // Append widget to the slide (no GPT transformation for append)
      target.insertAdjacentHTML('beforeend', widgetHtml);
    } else {
      // Replace mode - use GPT to transform the element content into widget format
      if (target.classList.contains('slide')) {
        target.insertAdjacentHTML('beforeend', widgetHtml);
      } else {
        // Check if we have API key for GPT transformation
        if (hasAnyApiKey(state.settings)) {
          setIsReplacingWidget(true);
          try {
            const originalContent = target.outerHTML;
            const transformedHtml = await transformElementToWidget(
              originalContent,
              widgetHtml,
              state.settings,
              ''
            );
            target.outerHTML = transformedHtml;
          } catch (err) {
            console.error('GPT transformation failed, using template directly:', err);
            target.outerHTML = widgetHtml;
          } finally {
            setIsReplacingWidget(false);
          }
        } else {
          // No API key - just insert the template directly
          target.outerHTML = widgetHtml;
        }
      }
    }

    // Save changes to the slide — use ref to detect if user switched slides before timeout fires
    const slideIdToSave = activeSlide.id;
    setTimeout(() => {
      if (slideRef.current && activeSlideIdRef.current === slideIdToSave) {
        let newHtml = slideRef.current.innerHTML;
        newHtml = cleanupEditableHtml(newHtml, false);
        if (newHtml !== activeSlide.html) {
          actions.updateSlide(slideIdToSave, { html: newHtml });
        }
      }
    }, 50);

    handleCloseContextMenu();
  }, [contextMenu.targetElement, contextMenu.insertMode, activeSlide, actions, handleCloseContextMenu, state.settings]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        handleCloseContextMenu();
      }
    };
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu.visible, handleCloseContextMenu]);

  // Handle mouse wheel zoom
  useEffect(() => {
    const wrapper = previewWrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [handleZoomIn, handleZoomOut]);

  // Slide-specific CSS — already scoped with [data-slide-id] at storage time
  const combinedCSS = useMemo(() => {
    return activeSlide?.customCSS || '';
  }, [activeSlide?.customCSS]);

  const slideSources = useMemo(() => {
    const raw = extractSlideSources(activeSlide?.html || '', activeSlide?.sources || []);
    return filterRenderableSlideSources(raw);
  }, [activeSlide?.html, activeSlide?.sources]);

  useEffect(() => {
    setShowSourcesPanel(false);
  }, [activeSlide?.id]);

  // Set up the slide HTML when activeSlide changes
  useEffect(() => {
    if (slideRef.current && activeSlide) {
      // Ensure HTML is wrapped in a .slide div
      let html = activeSlide.html || '';
      if (!/class=["']slide[\s"']/i.test(html)) {
        html = `<div class="slide">${html}</div>`;
      }
      // Ensure section-divider and separator slides have the blank master class
      if ((html.includes('section-divider-slide') || html.includes('separator-slide')) && !html.includes('master-blank')) {
        html = html.replace(/class="slide([^"]*)"/, 'class="slide master-blank$1"');
      }
      // Strip footer from cover/thank-you slides to avoid duplicate branding
      if (html.includes('cover-slide') || html.includes('cover-branding')) {
        html = html.replace(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/gi, '');
      }
      // Inject section tracker attribute if slide has a sectionLabel (NEOM: flat deck, no section pills)
      if (activeSlide.sectionLabel && activeClientProfile?.id !== 'neom') {
        const escaped = activeSlide.sectionLabel.replace(/"/g, '&quot;');
        html = html.replace(
          /class="slide([^"]*)"/,
          `class="slide$1" data-section="${escaped}"`
        );
      }
      // Inject sub-section tracker attribute if slide has a subSectionLabel
      if (activeSlide.subSectionLabel && activeClientProfile?.id !== 'neom') {
        const escaped = activeSlide.subSectionLabel.replace(/"/g, '&quot;');
        const trackerOffset = estimateTrackerOffset(activeSlide.sectionLabel, activeClientProfile);
        html = html.replace(
          /class="slide([^"]*)"/,
          `class="slide$1" data-subsection="${escaped}" style="--tracker-offset: ${trackerOffset}px"`
        );
      }
      // Inject slide ID for CSS scoping (prevents flicker on slide switch)
      html = html.replace(
        /class="slide([^"]*)"/,
        `class="slide$1" data-slide-id="${activeSlide.id}"`
      );
      html = injectFooterBranding(
        html,
        getClientProfileFooterBranding(state.settings, ''),
      );
      // Inject dynamic page number based on position in deck
      const slideIndex = state.slides.findIndex(s => s.id === activeSlide.id);
      if (slideIndex >= 0) {
        html = injectPageNumber(html, slideIndex + 1, state.slides.length, activeClientProfile);
      }
      html = injectClientProfileChrome(html, activeClientProfile, clientLogoUrl, clientLogoIconUrl);
      slideRef.current.innerHTML = html;
      requestAnimationFrame(() => {
        if (!slideRef.current) return;
        normalizeFlexProseInSlideMount(slideRef.current);
        slideRef.current.querySelectorAll('a[href]').forEach(anchor => {
          const href = anchor.getAttribute('href') || '';
          if (!/^https?:\/\//i.test(href)) return;
          anchor.classList.add('slide-source-link');
          anchor.setAttribute('data-source-preview-enhanced', 'true');
          anchor.setAttribute('target', '_blank');
          anchor.setAttribute('rel', 'noopener noreferrer');
          anchor.setAttribute('data-no-edit', 'true');
          anchor.setAttribute('title', `Open source: ${anchor.textContent?.trim() || href}`);
        });
        if (isEditMode) {
          makeEditable(slideRef.current);
        }
      });
    }
  }, [activeSlide?.id, activeSlide?.html, isEditMode, state.darkMode, state.slides, activeClientProfile, clientLogoUrl, clientLogoIconUrl]);

  // Update dark-mode and section-tracker attributes on the slide DOM element
  useEffect(() => {
    if (slideRef.current) {
      requestAnimationFrame(() => {
        const slideEl = slideRef.current?.querySelector('.slide');
        if (slideEl) {
          if (state.darkMode) {
            slideEl.setAttribute('data-dark-mode', 'true');
          } else {
            slideEl.removeAttribute('data-dark-mode');
          }
          if (activeSlide?.sectionLabel && activeClientProfile?.id !== 'neom') {
            slideEl.setAttribute('data-section', activeSlide.sectionLabel);
          } else {
            slideEl.removeAttribute('data-section');
          }
          if (activeSlide?.subSectionLabel && activeClientProfile?.id !== 'neom') {
            slideEl.setAttribute('data-subsection', activeSlide.subSectionLabel);
            if (activeSlide.sectionLabel) {
              const offset = estimateTrackerOffset(activeSlide.sectionLabel, activeClientProfile);
              slideEl.style.setProperty('--tracker-offset', `${offset}px`);
            }
          } else {
            slideEl.removeAttribute('data-subsection');
            slideEl.style.removeProperty('--tracker-offset');
          }
        }
      });
    }
  }, [state.darkMode, activeSlide?.sectionLabel, activeSlide?.subSectionLabel, activeClientProfile]);

  // Make all text-bearing leaf elements editable.
  //
  // Previous behavior used a whitelist of selectors (h1..h4, p, .title, li,
  // span, etc.) which meant custom layouts or nested cells produced by the
  // AI quietly dropped out of edit mode. The walker below flips the default:
  // every text leaf is editable unless it is a non-text embed (img/svg/
  // canvas/video/audio/iframe), a form control (button/input/...), or the
  // auto-managed page footer (rendered content is owned by injectPageNumber).
  //
  // A "text leaf" is an element that has visible text content and whose
  // element children are only inline formatting or non-text embeds, so the
  // block that a user sees as a single editable cell maps to exactly one
  // contenteditable container.
  const makeEditable = (container) => {
    if (!container) return;

    const EXCLUDED_TAGS = new Set([
      'IMG', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME',
      'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
      'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'HR', 'BR',
    ]);

    const INLINE_TAGS = new Set([
      'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DATA',
      'DFN', 'EM', 'I', 'KBD', 'MARK', 'Q', 'S', 'SAMP', 'SMALL',
      'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR',
    ]);

    // Anything matching these selectors (or any ancestor matching them)
    // is owned by the renderer / auto-managers and should not accept edits.
    const EXCLUDED_SELECTOR = 'footer, .footer, .slide-footer, .page-number, [data-no-edit]';

    const isExcludedTag = (el) => EXCLUDED_TAGS.has(el.tagName);
    const isOwnedRegion = (el) => !!el.closest(EXCLUDED_SELECTOR);

    // Walk the subtree depth-first, marking the outermost text-leaf block
    // per branch so we don't create nested contenteditable regions.
    const walk = (el) => {
      if (!el || el.nodeType !== 1) return;
      if (isExcludedTag(el)) return;
      if (isOwnedRegion(el)) return;

      const children = Array.from(el.children);
      const allChildrenInlineOrEmbed = children.every((c) =>
        INLINE_TAGS.has(c.tagName) || EXCLUDED_TAGS.has(c.tagName)
      );

      const hasVisibleText = (el.textContent || '').trim().length > 0;

      if (hasVisibleText && allChildrenInlineOrEmbed) {
        el.contentEditable = 'true';
        el.classList.add('editable-element');
        return; // Children are inline; parent covers them.
      }

      // Block container: descend into each child.
      for (const child of children) walk(child);
    };

    // Start one level below the mount so we don't mark the entire slide
    // container as editable when it happens to be the only text-bearing node.
    for (const child of Array.from(container.children)) walk(child);
  };

  // Draggable element selectors for visual edit mode
  const DRAGGABLE_SELECTORS = [
    '.card', '.kpi-block', '.timeline-content', '.grid-cell', '.quote-box',
    '.ba-column', '.ps-section', '.exec-section', '.risk-item', '.step-item',
    '.value-pillar', '.pillar', '.roadmap-card', '.insight-item', '.driver-item',
    '.milestone-item', '.dashboard-card', '.case-section', '.feature-row',
    '.funnel-level', '.journey-stage', '.pc-item', '.ba-item', '.matrix-cell',
    '.comp-dot', '.competitor', '.title', '.subtitle', '.frame'
  ];

  // Make elements draggable in visual edit mode
  const makeDraggable = useCallback((container) => {
    if (!container) return;

    DRAGGABLE_SELECTORS.forEach(selector => {
      container.querySelectorAll(selector).forEach((el, index) => {
        // Add a unique identifier for tracking
        if (!el.dataset.dragId) {
          el.dataset.dragId = `${selector.replace('.', '')}-${index}`;
        }
        el.classList.add('draggable-element');
      });
    });
  }, []);

  // Remove draggable markers
  const removeDraggable = useCallback((container) => {
    if (!container) return;
    container.querySelectorAll('.draggable-element').forEach(el => {
      el.classList.remove('draggable-element');
      el.classList.remove('dragging');
      el.classList.remove('selected-element');
    });
  }, []);

  // Check if element is absolutely positioned
  const isAbsolutelyPositioned = useCallback((el) => {
    const style = window.getComputedStyle(el);
    return style.position === 'absolute' || style.position === 'fixed';
  }, []);

  // Get current position values from an element
  const getPositionValues = useCallback((el) => {
    const style = window.getComputedStyle(el);
    const isAbsolute = style.position === 'absolute' || style.position === 'fixed';

    if (isAbsolute) {
      // For absolute elements, get left/top
      return {
        x: parseFloat(style.left) || 0,
        y: parseFloat(style.top) || 0,
        isAbsolute: true
      };
    }

    // For relative/static elements, get transform
    const transform = style.transform;
    if (transform === 'none') return { x: 0, y: 0, isAbsolute: false };

    const matrix = transform.match(/matrix.*\((.+)\)/);
    if (matrix) {
      const values = matrix[1].split(', ');
      return {
        x: parseFloat(values[4]) || 0,
        y: parseFloat(values[5]) || 0,
        isAbsolute: false
      };
    }
    return { x: 0, y: 0, isAbsolute: false };
  }, []);

  // Handle mouse down for dragging
  const handleDragStart = useCallback((e) => {
    if (!isVisualEditMode) return;

    if (e.target.closest('a[href], .slide-source-link')) {
      return;
    }

    // Find the closest draggable element
    const draggableEl = e.target.closest('.draggable-element');
    if (!draggableEl) {
      setSelectedElement(null);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Remove selection from previous element
    if (selectedElement) {
      selectedElement.classList.remove('selected-element');
    }

    // Select the new element
    draggableEl.classList.add('selected-element');
    draggableEl.classList.add('dragging');
    setSelectedElement(draggableEl);
    setIsDragging(true);

    // Get current position
    const currentPosition = getPositionValues(draggableEl);

    // Store drag start position (accounting for zoom)
    setDragStart({
      x: e.clientX / zoom,
      y: e.clientY / zoom
    });
    setElementStart({
      x: currentPosition.x,
      y: currentPosition.y,
      isAbsolute: currentPosition.isAbsolute
    });
  }, [isVisualEditMode, selectedElement, zoom, getPositionValues]);

  // Handle mouse move for dragging
  const handleDragMove = useCallback((e) => {
    if (!isDragging || !selectedElement) return;

    e.preventDefault();

    const deltaX = (e.clientX / zoom) - dragStart.x;
    const deltaY = (e.clientY / zoom) - dragStart.y;

    const newX = elementStart.x + deltaX;
    const newY = elementStart.y + deltaY;

    // Apply positioning based on element type
    if (elementStart.isAbsolute) {
      // For absolute elements, modify left/top
      selectedElement.style.left = `${newX}px`;
      selectedElement.style.top = `${newY}px`;
    } else {
      // For relative/static elements, use transform
      selectedElement.style.transform = `translate(${newX}px, ${newY}px)`;
      selectedElement.style.position = 'relative';
    }
    selectedElement.style.zIndex = '10';
  }, [isDragging, selectedElement, dragStart, elementStart, zoom]);

  // Handle mouse up to end dragging
  const handleDragEnd = useCallback(() => {
    if (!isDragging || !selectedElement) return;

    selectedElement.classList.remove('dragging');
    selectedElement.style.zIndex = '';
    setIsDragging(false);

    // Save the changes to HTML — use ref to detect slide switch before timeout fires
    if (slideRef.current && activeSlide) {
      const slideIdToSave = activeSlide.id;
      setTimeout(() => {
        if (slideRef.current && activeSlideIdRef.current === slideIdToSave) {
          let newHtml = slideRef.current.innerHTML;
          newHtml = cleanupEditableHtml(newHtml, true); // Keep position styles

          if (newHtml !== activeSlide.html) {
            actions.updateSlide(slideIdToSave, { html: newHtml });
          }
        }
      }, 50);
    }
  }, [isDragging, selectedElement, activeSlide, actions]);

  // Add event listeners for dragging
  useEffect(() => {
    if (!isVisualEditMode) return;

    const handleMouseMove = (e) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isVisualEditMode, handleDragMove, handleDragEnd]);

  // Update draggable elements when visual mode changes
  useEffect(() => {
    if (slideRef.current) {
      if (isVisualEditMode) {
        makeDraggable(slideRef.current);
      } else {
        removeDraggable(slideRef.current);
        setSelectedElement(null);
      }
    }
  }, [isVisualEditMode, makeDraggable, removeDraggable]);

  // Clean up HTML from contenteditable artifacts
  const cleanupEditableHtml = (html, keepPositionStyles = false) => {
    // Create a temporary div to parse and clean the HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    temp.querySelectorAll('.client-chrome').forEach(el => el.remove());
    temp.querySelectorAll('[data-client-profile]').forEach(el => {
      el.removeAttribute('data-client-profile');
    });

    // Remove contenteditable attributes
    temp.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
    });

    // Remove editable-element class added during editing
    temp.querySelectorAll('.editable-element').forEach(el => {
      el.classList.remove('editable-element');
    });

    // Remove draggable classes added during visual editing
    temp.querySelectorAll('.draggable-element').forEach(el => {
      el.classList.remove('draggable-element');
    });
    temp.querySelectorAll('.selected-element').forEach(el => {
      el.classList.remove('selected-element');
    });
    temp.querySelectorAll('.dragging').forEach(el => {
      el.classList.remove('dragging');
    });
    temp.querySelectorAll('.slide-source-link').forEach(el => {
      const wasPreviewEnhanced = el.getAttribute('data-source-preview-enhanced') === 'true';
      el.classList.remove('slide-source-link');
      if (!wasPreviewEnhanced) return;
      el.removeAttribute('data-source-preview-enhanced');
      if (el.getAttribute('data-no-edit') === 'true') el.removeAttribute('data-no-edit');
      if (el.getAttribute('target') === '_blank') el.removeAttribute('target');
      if (el.getAttribute('rel') === 'noopener noreferrer') el.removeAttribute('rel');
      if ((el.getAttribute('title') || '').startsWith('Open source:')) el.removeAttribute('title');
    });

    // Remove data-drag-id attributes
    temp.querySelectorAll('[data-drag-id]').forEach(el => {
      el.removeAttribute('data-drag-id');
    });

    // Remove inline styles added during editing (outline, cursor, z-index from focus)
    temp.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style');
      if (!style) return;

      // Styles to always remove
      let cleanedStyle = style
        .replace(/outline[^;]*;?/gi, '')
        .replace(/outline-offset[^;]*;?/gi, '')
        .replace(/cursor:\s*text[^;]*;?/gi, '')
        .replace(/cursor:\s*move[^;]*;?/gi, '')
        .replace(/z-index:\s*10[^;]*;?/gi, '');

      // If not keeping position styles, remove transform and position too
      // But keep left/top for absolutely positioned elements
      if (!keepPositionStyles) {
        cleanedStyle = cleanedStyle
          .replace(/transform:\s*translate\([^)]+\)[^;]*;?/gi, '')
          .replace(/position:\s*relative[^;]*;?/gi, '');
      }

      cleanedStyle = cleanedStyle.trim();

      if (cleanedStyle && cleanedStyle !== ';') {
        // Clean up multiple semicolons and trailing semicolon
        cleanedStyle = cleanedStyle.replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
        if (cleanedStyle) {
          el.setAttribute('style', cleanedStyle);
        } else {
          el.removeAttribute('style');
        }
      } else {
        el.removeAttribute('style');
      }
    });

    // Clean up empty class attributes
    temp.querySelectorAll('[class=""]').forEach(el => {
      el.removeAttribute('class');
    });

    return temp.innerHTML;
  };

  // Save changes when user finishes editing — use ref to prevent cross-slide writes on rapid clicks
  const handleBlur = useCallback(() => {
    if (slideRef.current && activeSlide && isEditMode) {
      const slideIdToSave = activeSlide.id;
      // Small delay to ensure the DOM has updated
      setTimeout(() => {
        // Bail if user already switched to a different slide
        if (activeSlideIdRef.current !== slideIdToSave) return;

        let newHtml = slideRef.current.innerHTML;

        // Validate and fix HTML structure if needed
        if (!newHtml || newHtml.trim() === '') {
          // Don't save empty HTML
          return;
        }

        // Clean up contenteditable artifacts
        newHtml = cleanupEditableHtml(newHtml);

        // Strip render-time attributes that shouldn't be persisted
        newHtml = newHtml.replace(/\s*data-slide-id="[^"]*"/g, '');
        newHtml = newHtml.replace(/\s*data-section="[^"]*"/g, '');
        newHtml = newHtml.replace(/\s*data-subsection="[^"]*"/g, '');
        newHtml = newHtml.replace(/\s*data-client-profile="[^"]*"/g, '');
        newHtml = newHtml.replace(/\s*style="--tracker-offset:\s*\d+px"/g, '');

        // Ensure the slide wrapper is preserved
        if (!/class=["']slide[\s"']/i.test(newHtml)) {
          newHtml = `<div class="slide">${newHtml}</div>`;
        }

        if (newHtml !== activeSlide.html) {
          actions.updateSlide(slideIdToSave, { html: newHtml });
        }
      }, 100);
    }
  }, [activeSlide, actions, isEditMode]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // Save on Ctrl/Cmd + S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleBlur();
    }
    // Exit edit on Escape
    if (e.key === 'Escape') {
      e.target.blur();
    }
  }, [handleBlur]);

  const handleSlideClick = useCallback((e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;

    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
  }, []);

  if (!activeSlide) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="empty-state-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
        </div>
        <h3>No slide to preview</h3>
        <p>Select a slide from the sidebar to see the preview.</p>
      </div>
    );
  }

  return (
    <div className="preview-container">
      {/* Toolbar only shown in debug mode (Preview/Code switcher) */}
      {DEBUG_MODE && (
        <div className="preview-toolbar">
          <div className="toolbar-group view-switcher">
            <button className="btn btn-sm btn-primary" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Preview
            </button>
            <button className="btn btn-sm btn-ghost" onClick={onSwitchToCode} title="Edit HTML/CSS code">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Code
            </button>
          </div>
        </div>
      )}

      <div className="slide-main-area">
      <div className="slide-content-column">
      <div className="slide-preview-wrapper" ref={previewWrapperRef}>
        {/* Floating fullscreen button (moved from toolbar) */}
        <button
          className="slide-fullscreen-float"
          onClick={() => setIsFullscreen(true)}
          title="View slide fullscreen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>

        {slideSources.length > 0 && (
          <button
            className={`slide-sources-float ${showSourcesPanel ? 'active' : ''}`}
            onClick={() => setShowSourcesPanel(value => !value)}
            title={`Review ${slideSources.length} source${slideSources.length === 1 ? '' : 's'} for this slide`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
              <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
            </svg>
            Sources
            <span>{slideSources.length}</span>
          </button>
        )}

        {/* Inject CSS */}
        <style>{getBaseCSS() + '\n' + getClientChromeCSS() + '\n' + themeToCSS(state.theme) + '\n' + combinedCSS + '\n' + getEditModeCSS(isEditMode) + '\n' + getVisualEditModeCSS(isVisualEditMode)}</style>

        {/* Zoomable slide container */}
        <div
          className="slide-zoom-container"
          style={{ transform: `scale(${zoom})` }}
        >
          <div
            ref={slideRef}
            className={`slide-render-container ${isEditMode ? 'edit-mode' : ''} ${isVisualEditMode ? 'visual-edit-mode' : ''}`}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={handleSlideClick}
            onMouseDown={handleDragStart}
            onContextMenu={handleContextMenu}
          />
        </div>

        {/* Comments UI hidden -- functionality preserved in code */}
        {false && (
        <>
        {/* Floating Comment Button */}
        <button
          className={`floating-comment-btn ${pendingCommentsCount > 0 ? 'has-comments' : ''} ${showCommentPanel ? 'active' : ''}`}
          onClick={() => setShowCommentPanel(!showCommentPanel)}
          title={pendingCommentsCount > 0 ? `${pendingCommentsCount} pending instruction${pendingCommentsCount > 1 ? 's' : ''}` : 'Add instructions'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {pendingCommentsCount > 0 && <span className="comment-count-badge">{pendingCommentsCount}</span>}
        </button>

        {/* Slide-out Comment Panel - uses existing CommentPanel logic */}
        <div className={`comment-slideout ${showCommentPanel ? 'open' : ''}`} ref={commentPanelRef}>
          <button
            className="comment-slideout-close"
            onClick={() => setShowCommentPanel(false)}
            title="Close panel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Deck-wide comment stats */}
          {(deckCommentStats.totalPending > 0 || deckCommentStats.totalAddressed > 0) && (
            <div className="deck-comment-stats">
              <div className="deck-stats-row">
                <span className="deck-stats-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  Deck Total:
                </span>
                <span className="deck-stats-value">
                  {deckCommentStats.totalPending > 0 && (
                    <span className="pending-stat">{deckCommentStats.totalPending} pending</span>
                  )}
                  {deckCommentStats.totalPending > 0 && deckCommentStats.totalAddressed > 0 && ' / '}
                  {deckCommentStats.totalAddressed > 0 && (
                    <span className="addressed-stat">{deckCommentStats.totalAddressed} addressed</span>
                  )}
                </span>
              </div>
              {deckCommentStats.totalPending > 0 && deckCommentStats.slidesWithPending > 1 && (
                <button
                  className="address-all-deck-btn"
                  onClick={handleAddressAllDeckComments}
                  title={`Mark all ${deckCommentStats.totalPending} comments across ${deckCommentStats.slidesWithPending} slides as addressed`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Address All ({deckCommentStats.slidesWithPending} slides)
                </button>
              )}
            </div>
          )}

          <CommentPanel slideId={activeSlide.id} />
        </div>
        </>
        )}

      </div>
      </div>
      {slideSources.length > 0 && showSourcesPanel && (
        <aside className="slide-sources-panel" aria-label="Slide sources">
          <div className="slide-sources-header">
            <div>
              <h3>Slide Sources</h3>
              <p>Verify the evidence used on this slide.</p>
            </div>
            <button
              className="slide-sources-close"
              onClick={() => setShowSourcesPanel(false)}
              title="Close sources"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="slide-sources-list">
            {slideSources.map((source, index) => {
              const href = source.url;
              return (
                <article className="slide-source-card" key={source.id}>
                  <div className="slide-source-index">{index + 1}</div>
                  <div className="slide-source-body">
                    <div className="slide-source-title">{source.label}</div>
                    <div className="slide-source-meta">
                      {source.host || (source.fileId || source.documentId ? 'Attached document' : '')}
                    </div>
                    {source.context && source.context !== source.label && (
                      <p className="slide-source-context">{source.context}</p>
                    )}
                    {href ? (
                      <a
                        className="slide-source-open"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open original source
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7 17L17 7" />
                          <path d="M7 7h10v10" />
                        </svg>
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      )}
      </div>

      {/* Bottom bar removed for vertical space -- info available in slide list sidebar */}

      {/* Widget Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="widget-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            background: '#FFFFFF',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
            minWidth: 260,
            maxHeight: '70vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #F1F5F9',
            background: isReplacingWidget ? '#FEF3C7' : '#F8FAFC'
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: isReplacingWidget ? '#92400E' : '#1E293B',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              {isReplacingWidget ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  AI Transforming...
                </>
              ) : (
                contextMenuCategory ? 'Select Widget' : 'Insert Widget'
              )}
            </div>
            <div style={{
              fontSize: 11,
              color: isReplacingWidget ? '#B45309' : '#64748B'
            }}>
              {isReplacingWidget
                ? 'Preserving content in new widget format...'
                : (contextMenu.insertMode === 'replace' ? 'Replace selected element' : 'Add to slide')
              }
            </div>
          </div>

          {/* Back button when viewing category */}
          {contextMenuCategory && (
            <button
              onClick={() => setContextMenuCategory(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                fontSize: 12,
                color: '#8E1E1E',
                cursor: 'pointer',
                borderBottom: '1px solid #F1F5F9'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Categories
            </button>
          )}

          {/* Scrollable content area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 'calc(70vh - 100px)'
          }}>
            {!contextMenuCategory ? (
              // Show categories
              <div style={{ padding: '8px 0' }}>
                {Object.values(WIDGET_CATEGORIES).map(category => {
                  const widgets = getWidgetsByCategory(category);
                  return (
                    <button
                      key={category}
                      onClick={() => setContextMenuCategory(category)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        fontSize: 13,
                        color: '#1E293B',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.target.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.target.style.background = 'none'}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 28,
                          height: 28,
                          background: 'rgba(142, 30, 30, 0.1)',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#8E1E1E'
                        }}>
                          {getCategoryIcon(category)}
                        </span>
                        {category}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: '#94A3B8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {widgets.length}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              // Show widgets in selected category
              <div style={{ padding: '8px 0', opacity: isReplacingWidget ? 0.5 : 1, pointerEvents: isReplacingWidget ? 'none' : 'auto' }}>
                {getWidgetsByCategory(contextMenuCategory).map((widget, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleInsertWidget(widget)}
                    disabled={isReplacingWidget}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: 'none',
                      textAlign: 'left',
                      cursor: isReplacingWidget ? 'wait' : 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => !isReplacingWidget && (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{
                      width: 32,
                      height: 32,
                      background: 'rgba(142, 30, 30, 0.08)',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#8E1E1E',
                      fontSize: 14,
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#1E293B',
                        marginBottom: 2
                      }}>
                        {widget.name}
                      </span>
                      <span style={{
                        display: 'block',
                        fontSize: 11,
                        color: '#64748B',
                        lineHeight: 1.4
                      }}>
                        {widget.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid #F1F5F9',
            background: '#FAFBFC',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>
              Right-click to insert widgets
            </span>
            <button
              onClick={handleCloseContextMenu}
              style={{
                fontSize: 11,
                color: '#64748B',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PPTX Test Modal */}
      {showPPTXTest && pptxTestResult && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowPPTXTest(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              maxWidth: '80%',
              maxHeight: '80%',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>PPTX Code Test Result</h3>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowPPTXTest(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Validation Status */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 16,
                background: pptxTestResult.validation?.valid ? '#d4edda' : '#f8d7da',
                color: pptxTestResult.validation?.valid ? '#155724' : '#721c24',
              }}
            >
              {pptxTestResult.validation?.valid ? (
                <span>✓ Code is valid and can be executed</span>
              ) : (
                <span>✗ Validation failed: {pptxTestResult.validation?.error || pptxTestResult.error}</span>
              )}
            </div>

            {/* Generated Code */}
            {pptxTestResult.code && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0 }}>Generated PptxGenJS Code:</h4>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(pptxTestResult.code);
                      alert('Code copied to clipboard!');
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </button>
                </div>
                <pre
                  style={{
                    background: '#1e1e1e',
                    color: '#d4d4d4',
                    padding: 16,
                    borderRadius: 8,
                    overflow: 'auto',
                    maxHeight: 400,
                    fontSize: 12,
                    fontFamily: 'Monaco, Consolas, monospace',
                  }}
                >
                  {pptxTestResult.code}
                </pre>
              </>
            )}

            {/* Test Download Button */}
            {pptxTestResult.validation?.valid && (
              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    setShowPPTXTest(false);
                    await handleDownloadSlidePPTX();
                  }}
                >
                  Download this slide as PPTX
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Slide Modal */}
      {isFullscreen && (
        <FullscreenModal
          slides={state.slides}
          currentSlideId={activeSlide?.id}
          theme={state.theme}
          combinedCSS={combinedCSS}
          activeClientProfile={activeClientProfile}
          clientLogoUrl={clientLogoUrl}
          clientLogoIconUrl={clientLogoIconUrl}
          footerBranding={getClientProfileFooterBranding(state.settings, '')}
          onClose={() => setIsFullscreen(false)}
          onNavigate={(slideId) => actions.setActiveSlide(slideId)}
        />
      )}
    </div>
  );
}

function getEditModeCSS(isEditMode) {
  if (!isEditMode) return '';

  return `
.slide-render-container.edit-mode .editable-element {
  outline: none;
  cursor: text;
}

.slide-render-container.edit-mode .editable-element:hover {
  outline: 1px dashed #6366f1 !important;
  outline-offset: 2px;
}

.slide-render-container.edit-mode .editable-element:focus {
  outline: 2px solid #6366f1 !important;
  outline-offset: 2px;
  border-radius: 2px;
}

.slide-render-container.edit-mode {
  cursor: default;
}

/* Widget target highlight */
.slide-render-container .widget-target {
  outline: 3px solid #8E1E1E !important;
  outline-offset: 2px;
  border-radius: 4px;
  background: rgba(142, 30, 30, 0.05) !important;
  transition: all 0.15s ease;
}
`;
}

function getVisualEditModeCSS(isVisualEditMode) {
  if (!isVisualEditMode) return '';

  return `
.slide-render-container.visual-edit-mode {
  cursor: default;
}

.slide-render-container.visual-edit-mode .draggable-element {
  cursor: move;
  transition: box-shadow 0.15s ease, outline 0.15s ease;
}

.slide-render-container.visual-edit-mode .draggable-element:hover {
  outline: 2px dashed #8b5cf6 !important;
  outline-offset: 2px;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
}

.slide-render-container.visual-edit-mode .draggable-element.selected-element {
  outline: 2px solid #8b5cf6 !important;
  outline-offset: 2px;
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
}

.slide-render-container.visual-edit-mode .draggable-element.dragging {
  opacity: 0.9;
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
  outline: 2px solid #8b5cf6 !important;
}

/* Add resize handles visually (non-functional for now) */
.slide-render-container.visual-edit-mode .selected-element::after {
  content: '';
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  background: #8b5cf6;
  border-radius: 2px;
  cursor: se-resize;
}

/* Visual indicators for movable elements */
.slide-render-container.visual-edit-mode .draggable-element::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 12px;
  height: 12px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b5cf6' stroke-width='2'%3E%3Cpath d='M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l3 3 3-3M19 9l3 3-3 3'/%3E%3C/svg%3E") no-repeat center;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 100;
  pointer-events: none;
}

.slide-render-container.visual-edit-mode .draggable-element:hover::before,
.slide-render-container.visual-edit-mode .draggable-element.selected-element::before {
  opacity: 0.7;
}
`;
}

function escapeHtmlAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function estimateTrackerOffset(sectionLabel, activeProfile = null) {
  if (!sectionLabel) return 0;
  const labelLength = String(sectionLabel).length;
  const isStc = activeProfile?.id === 'stc';
  const base = isStc ? 38 : 22;
  const charWidth = isStc ? 6.1 : 4.8;
  const min = isStc ? 190 : 0;
  const max = isStc ? 360 : 360;
  return Math.min(max, Math.max(min, Math.round(labelLength * charWidth + base)));
}

// Inject data-section attribute for section tracker tab
function injectSectionToHtml(html, sectionLabel) {
  if (!sectionLabel || !html) return html;
  const escaped = sectionLabel.replace(/"/g, '&quot;');
  const cleanHtml = html.replace(/\s*data-section="[^"]*"/g, '');
  return cleanHtml.replace(
    /class="slide([^"]*)"/,
    `class="slide$1" data-section="${escaped}"`
  );
}

// Inject data-subsection attribute for sub-section tracker tab
function injectSubSectionToHtml(html, subSectionLabel, sectionLabel, activeProfile = null) {
  if (!subSectionLabel || !html) return html;
  const escaped = subSectionLabel.replace(/"/g, '&quot;');
  const cleanHtml = html.replace(/\s*data-subsection="[^"]*"/g, '');
  const offset = estimateTrackerOffset(sectionLabel, activeProfile);
  return cleanHtml.replace(
    /class="slide([^"]*)"/,
    `class="slide$1" data-subsection="${escaped}" style="--tracker-offset: ${offset}px"`
  );
}

// Fullscreen Modal Component with proper scaling and navigation
function FullscreenModal({
  slides,
  currentSlideId,
  theme,
  combinedCSS,
  activeClientProfile,
  clientLogoUrl,
  clientLogoIconUrl = null,
  footerBranding = '',
  onClose,
  onNavigate,
}) {
  const [scale, setScale] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(() =>
    slides.findIndex(s => s.id === currentSlideId)
  );

  const currentSlide = slides[currentIndex];
  let slideHtml = currentSlide?.html || '';
  // Inject data-slide-id so scoped CSS selectors match
  if (currentSlide?.id && slideHtml && !slideHtml.includes('data-slide-id')) {
    slideHtml = slideHtml.replace(/class="slide([^"]*)"/, `class="slide$1" data-slide-id="${currentSlide.id}"`);
  }
  // Strip footer from cover slides to avoid duplicate branding
  if (slideHtml && (slideHtml.includes('cover-slide') || slideHtml.includes('cover-branding'))) {
    slideHtml = slideHtml.replace(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/gi, '');
  }
  // Inject section tracker (NEOM: no section pills in canvas)
  if (currentSlide?.sectionLabel && slideHtml && activeClientProfile?.id !== 'neom') {
    slideHtml = injectSectionToHtml(slideHtml, currentSlide.sectionLabel);
  }
  // Inject sub-section tracker
  if (currentSlide?.subSectionLabel && slideHtml && activeClientProfile?.id !== 'neom') {
    slideHtml = injectSubSectionToHtml(slideHtml, currentSlide.subSectionLabel, currentSlide.sectionLabel, activeClientProfile);
  }
  slideHtml = injectFooterBranding(slideHtml, footerBranding);
  slideHtml = injectPageNumber(slideHtml, currentIndex + 1, slides.length, activeClientProfile);
  slideHtml = injectClientProfileChrome(slideHtml, activeClientProfile, clientLogoUrl, clientLogoIconUrl);
  const fullscreenSlideRef = useRef(null);

  useLayoutEffect(() => {
    if (!fullscreenSlideRef.current || !slideHtml) return;
    requestAnimationFrame(() => {
      if (fullscreenSlideRef.current) normalizeFlexProseInSlideMount(fullscreenSlideRef.current);
    });
  }, [slideHtml, currentIndex, currentSlide?.id]);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < slides.length - 1;

  const goToPrev = useCallback(() => {
    if (canGoPrev) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onNavigate(slides[newIndex].id);
    }
  }, [canGoPrev, currentIndex, slides, onNavigate]);

  const goToNext = useCallback(() => {
    if (canGoNext) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onNavigate(slides[newIndex].id);
    }
  }, [canGoNext, currentIndex, slides, onNavigate]);

  // Calculate optimal scale to fit viewport - minimal padding for maximum size
  useEffect(() => {
    const calculateScale = () => {
      const slideWidth = 960;
      const slideHeight = 540;
      const padding = 40; // Minimal padding for near-fullscreen

      const availableWidth = window.innerWidth - padding * 2;
      const availableHeight = window.innerHeight - padding * 2;

      const scaleX = availableWidth / slideWidth;
      const scaleY = availableHeight / slideHeight;

      // Use the smaller scale to ensure slide fits
      const newScale = Math.min(scaleX, scaleY, 3); // Cap at 3x
      setScale(Math.max(newScale, 0.3)); // Min 0.3x
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        goToNext();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  // Prevent body scroll when fullscreen is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const navButtonStyle = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    transition: 'background 0.2s, opacity 0.2s',
  };

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        overflow: 'hidden',
      }}
    >
      {/* Inject CSS */}
      <style>{getBaseCSS() + '\n' + getClientChromeCSS() + '\n' + themeToCSS(theme) + '\n' + (currentSlide?.customCSS || '')}</style>

      {/* Scaled slide wrapper */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          ref={fullscreenSlideRef}
          style={{
            width: 960,
            height: 540,
            background: 'white',
            borderRadius: 2,
            boxShadow: '0 4px 40px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: slideHtml || '' }}
        />
      </div>

      {/* Previous button */}
      <button
        onClick={(e) => { e.stopPropagation(); goToPrev(); }}
        disabled={!canGoPrev}
        title="Previous slide (←)"
        style={{
          ...navButtonStyle,
          left: 20,
          opacity: canGoPrev ? 1 : 0.3,
          cursor: canGoPrev ? 'pointer' : 'default',
        }}
        onMouseEnter={e => canGoPrev && (e.target.style.background = 'rgba(255,255,255,0.2)')}
        onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Next button */}
      <button
        onClick={(e) => { e.stopPropagation(); goToNext(); }}
        disabled={!canGoNext}
        title="Next slide (→)"
        style={{
          ...navButtonStyle,
          right: 20,
          opacity: canGoNext ? 1 : 0.3,
          cursor: canGoNext ? 'pointer' : 'default',
        }}
        onMouseEnter={e => canGoNext && (e.target.style.background = 'rgba(255,255,255,0.2)')}
        onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Close button */}
      <button
        onClick={onClose}
        title="Exit fullscreen (Esc)"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Slide info */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '6px 16px',
        borderRadius: 16,
        fontSize: 12,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>{currentIndex + 1} / {slides.length}</span>
        {currentSlide?.title && (
          <>
            <span style={{ opacity: 0.5 }}>|</span>
            <span style={{ opacity: 0.8, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentSlide.title}
            </span>
          </>
        )}
      </div>
    </div>
  );

  // Render as portal to document.body to escape any container constraints
  return ReactDOM.createPortal(modalContent, document.body);
}
