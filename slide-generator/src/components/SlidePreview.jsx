import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useSlides } from '../context/SlideContext';
import { improveSlide, transformSlideToTemplate, transformElementToWidget, hasAnyApiKey, generateImageSlide, extractImageDataUri, buildDeckContextForSwitch } from '../services/aiService';
import { exportSingleSlideToPPTX, testPPTXCodeGeneration } from '../services/pptxService';
import { exportSingleSlideToPDF, generateFileName } from '../services/exportService';
import { WIDGET_CATEGORIES, getWidgetsByCategory } from '../utils/slideWidgets';
import { getVibeCSS, getVibePromptContext, VIBE_AWARE_CSS } from '../utils/vibes';
import TemplatePicker from './TemplatePicker';
import CommentPanel from './CommentPanel';

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_ZOOM = 1;

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
  const { activeSlide, state, actions } = useSlides();
  const [slidePrompt, setSlidePrompt] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(true); // Always on
  const [isVisualEditMode, setIsVisualEditMode] = useState(true); // Always on
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0 });
  const slideRef = useRef(null);
  const templatePickerRef = useRef(null);
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
      // Include vibe in settings for PPTX export styling
      const settingsWithVibe = { ...state.settings, vibe: state.vibe };
      // Pass custom templates so single slide export can find pptxRendererCode
      const allTemplates = state.customTemplates || [];
      await exportSingleSlideToPPTX(activeSlide, slideIndex + 1, state.slides.length, filename, settingsWithVibe, null, allTemplates);
    } catch (err) {
      setError('Failed to download PPTX: ' + err.message);
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
      await exportSingleSlideToPDF(activeSlide, state.sharedCSS, filename);
    } catch (err) {
      setError('Failed to download PDF: ' + err.message);
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
      // Include vibe in settings for PPTX code generation
      const settingsWithVibe = { ...state.settings, vibe: state.vibe };
      const result = await testPPTXCodeGeneration(activeSlide, slideIndex + 1, state.slides.length, settingsWithVibe);
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

  // Context menu handlers for widget insertion
  const handleContextMenu = useCallback((e) => {
    // Only show context menu in edit mode
    if (!isEditMode && !isVisualEditMode) return;

    e.preventDefault();

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

    // Get the vibe hint for GPT
    const vibeHint = getVibePromptContext(state.vibe);

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
              vibeHint
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
  }, [contextMenu.targetElement, contextMenu.insertMode, activeSlide, actions, handleCloseContextMenu, state.settings, state.vibe]);

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

  // Only include slide-specific CSS - slides.css is imported globally
  // Don't include state.sharedCSS as it duplicates the global import
  const combinedCSS = useMemo(() => {
    if (activeSlide?.customCSS) {
      return '/* Slide-specific CSS */\n' + activeSlide.customCSS;
    }
    return '';
  }, [activeSlide?.customCSS]);

  // Inject data-vibe and data-dark-mode attributes into slide HTML for CSS styling
  const injectVibeAttribute = useCallback((html, vibe, darkMode) => {
    // Remove existing data-vibe and data-dark-mode first (handle both quote types)
    let cleanHtml = html.replace(/\s*data-vibe=["'][^"']*["']/g, '');
    cleanHtml = cleanHtml.replace(/\s*data-dark-mode=["'][^"']*["']/g, '');

    // Build attributes string
    let attrs = '';
    if (vibe && vibe !== 'default') {
      attrs += ` data-vibe="${vibe}"`;
    }
    if (darkMode) {
      attrs += ` data-dark-mode="true"`;
    }

    if (!attrs) return cleanHtml;

    // Handle both double and single quotes in class attribute
    let result = cleanHtml.replace(
      /class="slide([^"]*)"/,
      `class="slide$1"${attrs}`
    );
    // If no replacement was made (single quotes), try single quotes
    if (result === cleanHtml) {
      result = cleanHtml.replace(
        /class='slide([^']*)'/,
        `class='slide$1'${attrs}`
      );
    }
    return result;
  }, []);

  // Set up the slide HTML when activeSlide changes
  useEffect(() => {
    if (slideRef.current && activeSlide) {
      // Ensure HTML is wrapped in a .slide div
      let html = activeSlide.html || '';
      if (!html.includes('class="slide"') && !html.includes("class='slide'")) {
        html = `<div class="slide">${html}</div>`;
      }
      // Ensure section-divider and separator slides have the blank master class
      if ((html.includes('section-divider-slide') || html.includes('separator-slide')) && !html.includes('master-blank')) {
        html = html.replace(/class="slide([^"]*)"/, 'class="slide master-blank$1"');
      }
      // Inject vibe attribute for CSS styling
      html = injectVibeAttribute(html, state.vibe, state.darkMode);
      // Strip footer from cover/thank-you slides to avoid duplicate branding
      if (html.includes('cover-slide') || html.includes('cover-branding')) {
        html = html.replace(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/gi, '');
      }
      // Inject section tracker attribute if slide has a sectionLabel
      if (activeSlide.sectionLabel) {
        const escaped = activeSlide.sectionLabel.replace(/"/g, '&quot;');
        html = html.replace(
          /class="slide([^"]*)"/,
          `class="slide$1" data-section="${escaped}"`
        );
      }
      // Inject sub-section tracker attribute if slide has a subSectionLabel
      if (activeSlide.subSectionLabel) {
        const escaped = activeSlide.subSectionLabel.replace(/"/g, '&quot;');
        // Calculate offset for sub-tracker based on main tracker text length
        const trackerOffset = activeSlide.sectionLabel
          ? Math.round(activeSlide.sectionLabel.length * 5.7 + 28)
          : 0;
        html = html.replace(
          /class="slide([^"]*)"/,
          `class="slide$1" data-subsection="${escaped}" style="--tracker-offset: ${trackerOffset}px"`
        );
      }
      // Inject dynamic page number based on position in deck
      const slideIndex = state.slides.findIndex(s => s.id === activeSlide.id);
      if (slideIndex >= 0) {
        html = injectPageNumber(html, slideIndex + 1);
      }
      slideRef.current.innerHTML = html;
      if (isEditMode) {
        makeEditable(slideRef.current);
      }
    }
  }, [activeSlide?.id, activeSlide?.html, isEditMode, state.vibe, state.darkMode, state.slides, injectVibeAttribute]);

  // Update data-vibe and data-dark-mode attributes when vibe/darkMode changes
  // This runs as a safety measure after innerHTML injection to ensure attributes are set
  useEffect(() => {
    if (slideRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated after innerHTML change
      requestAnimationFrame(() => {
        const slideEl = slideRef.current?.querySelector('.slide');
        if (slideEl) {
          // Handle vibe attribute
          if (state.vibe === 'default' || !state.vibe) {
            slideEl.removeAttribute('data-vibe');
          } else {
            slideEl.setAttribute('data-vibe', state.vibe);
          }
          // Handle dark mode attribute
          if (state.darkMode) {
            slideEl.setAttribute('data-dark-mode', 'true');
          } else {
            slideEl.removeAttribute('data-dark-mode');
          }
          // Handle section tracker attribute
          if (activeSlide?.sectionLabel) {
            slideEl.setAttribute('data-section', activeSlide.sectionLabel);
          } else {
            slideEl.removeAttribute('data-section');
          }
          // Handle sub-section tracker attribute
          if (activeSlide?.subSectionLabel) {
            slideEl.setAttribute('data-subsection', activeSlide.subSectionLabel);
            // Set tracker offset CSS variable so sub-tracker sits next to main tracker
            if (activeSlide.sectionLabel) {
              const offset = Math.round(activeSlide.sectionLabel.length * 5.7 + 28);
              slideEl.style.setProperty('--tracker-offset', `${offset}px`);
            }
          } else {
            slideEl.removeAttribute('data-subsection');
            slideEl.style.removeProperty('--tracker-offset');
          }
        }
      });
    }
  }, [state.vibe, state.darkMode, activeSlide?.sectionLabel, activeSlide?.subSectionLabel]);

  // Make all text elements editable
  const makeEditable = (container) => {
    if (!container) return;

    // Elements that should be directly editable
    const editableSelectors = [
      '.title', '.subtitle', '.cover-title', '.cover-category',
      '.cover-branding', '.cover-date', 'h1', 'h2', 'h3', 'h4', 'p',
      '.kpi-value', '.kpi-label', '.impact-box', '.quote-text',
      '.quote-author', '.card-num', '.card-icon-circle', '.timeline-marker',
      'li', 'span'
    ];

    editableSelectors.forEach(selector => {
      container.querySelectorAll(selector).forEach(el => {
        // Don't make containers editable, only leaf text nodes
        if (el.children.length === 0 || el.matches('.card-icon-circle, .timeline-marker, .kpi-value')) {
          el.contentEditable = 'true';
          // Use CSS class instead of inline styles to avoid saving them
          el.classList.add('editable-element');
        }
      });
    });
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

        // Strip data-vibe attribute before saving (vibe is applied at render time)
        newHtml = newHtml.replace(/\s*data-vibe="[^"]*"/g, '');

        // Ensure the slide wrapper is preserved
        if (!newHtml.includes('class="slide"') && !newHtml.includes("class='slide'")) {
          // Content lost its wrapper, re-wrap it
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

  const handleImproveSlide = async (e) => {
    e.preventDefault();
    if (!slidePrompt.trim() || !activeSlide) return;

    // Check provider key for the model that will be used (same logic as router)
    const improveModelRef = state.settings.fastModel || state.settings.model || '';
    const improveProviderId = improveModelRef.includes(':') ? improveModelRef.split(':')[0] : '';
    const improveProvider = (state.settings.providers || []).find(p => p.id === improveProviderId);
    if (!improveProvider?.apiKey) {
      setError(`No API key for ${improveProvider?.name || improveProviderId || 'provider'}. Check Settings.`);
      return;
    }

    setIsImproving(true);
    setError('');

    try {
      // Detect image slide — regenerate image instead of text editing
      const isImageSlide = activeSlide.templateId === 'image-full' || activeSlide.templateId === 'image-content'
        || (activeSlide.html && (activeSlide.html.includes('slide-image-full') || activeSlide.html.includes('frame-image')));

      if (isImageSlide && state.settings.imageModel) {
        const imageMode = activeSlide.templateId === 'image-full' ? 'full' : 'content';
        const slideIdx = state.slides.findIndex(s => s.id === activeSlide.id);
        const existingImage = extractImageDataUri(activeSlide.html);
        const imageResult = await generateImageSlide(slidePrompt, state.settings, imageMode, {
          layoutGuidance: slidePrompt,
          vibe: state.imageVibe || state.vibe,
          footerBranding: state.settings.footerBranding || 'Strategy&',
          slideNumber: slideIdx + 1,
          totalSlides: state.slides.length,
          existingImageDataUri: existingImage,
        });
        actions.updateSlide(activeSlide.id, {
          html: imageResult.html,
          title: imageResult.title || activeSlide.title,
          templateId: activeSlide.templateId,
          type: activeSlide.type,
        });
      } else {
        const slideInfo = {
          html: activeSlide.html,
        };
        // Use fast model for quick slide improvements
        const fastSettings = {
          ...state.settings,
          model: state.settings.fastModel || state.settings.model,
        };
        const result = await improveSlide(slideInfo, slidePrompt, fastSettings);

        // Handle new return type { html, customCSS }
        const improvedHtml = result?.html || result;
        const newCustomCSS = result?.customCSS;

        const updateData = { html: improvedHtml };
        if (newCustomCSS) updateData.customCSS = newCustomCSS;
        actions.updateSlide(activeSlide.id, updateData);
      }
      setSlidePrompt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsImproving(false);
    }
  };

  const handleTemplateSwitch = async (templateId) => {
    if (!templateId || !activeSlide) return;

    const switchModelRef = state.settings.fastModel || state.settings.model || '';
    const switchProviderId = switchModelRef.includes(':') ? switchModelRef.split(':')[0] : '';
    const switchProvider = (state.settings.providers || []).find(p => p.id === switchProviderId);
    if (!switchProvider?.apiKey) {
      setError(`No API key for ${switchProvider?.name || switchProviderId || 'provider'}. Check Settings.`);
      setShowTemplatePicker(false);
      return;
    }

    setIsTransforming(true);
    setShowTemplatePicker(false);
    setError('');

    try {
      const customTemplate = state.customTemplates?.find(t => t.id === templateId);
      const fastSettings = {
        ...state.settings,
        model: state.settings.fastModel || state.settings.model,
      };

      const currentIndex = state.slides.findIndex(s => s.id === activeSlide.id);
      const deckContext = buildDeckContextForSwitch(state.slides, currentIndex);
      const slidePosition = {
        slideNumber: currentIndex + 1,
        totalSlides: state.slides.length,
      };
      const userGuidance = slidePrompt.trim() || null;

      const transformedHtml = await transformSlideToTemplate(
        activeSlide.html, templateId, fastSettings, customTemplate,
        slidePosition, deckContext, userGuidance,
      );
      actions.updateSlide(activeSlide.id, { html: transformedHtml, type: templateId, templateId: templateId });
      if (userGuidance) setSlidePrompt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTransforming(false);
    }
  };

  // Close template picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (templatePickerRef.current && !templatePickerRef.current.contains(e.target)) {
        setShowTemplatePicker(false);
      }
    };
    if (showTemplatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTemplatePicker]);

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
      {/* Toolbar */}
      <div className="preview-toolbar">
        {/* View Switcher */}
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

        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={handleZoomOut}
            disabled={zoom <= ZOOM_LEVELS[0]}
            title="Zoom out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          <button
            className="zoom-level-btn"
            onClick={handleZoomReset}
            title="Reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={handleZoomIn}
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            title="Zoom in"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={handleZoomFit}
            title="Fit to screen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>

        {/* Single Slide Download */}
        <div style={{ position: 'relative' }} ref={downloadMenuRef}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            disabled={isDownloading}
            title="Download this slide"
          >
            {isDownloading ? (
              <span className="spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            Download
          </button>

          {showDownloadMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                background: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: 8,
                minWidth: 160,
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }}
                onClick={handleDownloadSlidePPTX}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                Download PPTX
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={handleDownloadSlidePDF}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 15v-2h2.5a1.5 1.5 0 0 0 0-3H9v5" />
                </svg>
                Download PDF
              </button>
            </div>
          )}
        </div>

        {/* Fullscreen Button */}
        <button
          className="btn btn-ghost btn-sm"
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
      </div>

      <div className="slide-main-area">
      <div className="slide-content-column">
      <div className="slide-preview-wrapper" ref={previewWrapperRef}>
        {/* Inject CSS */}
        <style>{getBaseCSS() + '\n' + combinedCSS + '\n' + getEditModeCSS(isEditMode) + '\n' + getVisualEditModeCSS(isVisualEditMode) + '\n' + VIBE_AWARE_CSS + '\n:root { ' + getVibeCSS(state.vibe) + ' }'}</style>

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
            onMouseDown={handleDragStart}
            onContextMenu={handleContextMenu}
          />
        </div>

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

      </div>

      {/* Per-Slide AI Prompt + Switch Template */}
      <div className="slide-ai-prompt">
        <form className="slide-ai-prompt-form" onSubmit={handleImproveSlide}>
          <input
            type="text"
            value={slidePrompt}
            onChange={(e) => setSlidePrompt(e.target.value)}
            placeholder={
              (activeSlide?.templateId === 'image-full' || activeSlide?.templateId === 'image-content'
                || (activeSlide?.html && (activeSlide.html.includes('slide-image-full') || activeSlide.html.includes('frame-image'))))
                ? `Regenerate image...${state.imageVibe && state.imageVibe !== 'default' ? ` [vibe: ${state.imageVibe}]` : ''} (e.g., 'Make it a 2x2 matrix', 'Add more detail')`
                : "Improve or guide template switch... (e.g., 'Keep 3 columns', 'Make it more visual')"
            }
            disabled={isImproving || isTransforming}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={isImproving || isTransforming || !slidePrompt.trim()}
          >
            {isImproving ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                Improving...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Improve
              </>
            )}
          </button>
          <div style={{ position: 'relative' }} ref={templatePickerRef}>
            <button
              type="button"
              className="template-switch-btn"
              onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              disabled={isTransforming || isImproving}
              title={slidePrompt.trim() ? 'Switch template with your guidance' : 'Switch to a different template layout'}
            >
              {isTransforming ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  Switching...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  Switch
                </>
              )}
            </button>
            {showTemplatePicker && (
              <div className="template-switch-popover" style={{ bottom: '100%', top: 'auto', marginBottom: 8 }}>
                <h4>Switch to Template{slidePrompt.trim() ? ' (with guidance)' : ''}</h4>
                {slidePrompt.trim() && (
                  <div style={{ fontSize: 11, color: '#666', padding: '4px 8px', background: 'rgba(142, 30, 30, 0.05)', borderRadius: 4, marginBottom: 8 }}>
                    Guidance: "{slidePrompt.trim()}"
                  </div>
                )}
                <TemplatePicker
                  selectedTemplate={null}
                  onSelect={handleTemplateSwitch}
                  showFreestyle={false}
                  compact={false}
                  title=""
                  slideHtml={activeSlide?.html}
                  currentTemplateId={activeSlide?.templateId}
                />
              </div>
            )}
          </div>
        </form>
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>
            {error}
          </div>
        )}
      </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="slide-quick-actions">
        {[
          { label: 'Auto-Fix', icon: '🔍', prompt: 'Inspect this slide for visual issues: overlapping elements, text overflow, clipped content, misaligned items. Fix ALL layout issues found. DO NOT change any text content — preserve every word exactly as-is. Keep h1, h2, h3, h4 text identical.' },
          { label: 'Fix Overlaps', icon: '📐', prompt: 'Fix overlapping or overflowing elements. Adjust spacing, reduce font sizes, or simplify the visual layout so everything fits within the frame. DO NOT change, remove, or reword any text content. Keep h1, h2, h3, h4 text identical.' },
          { label: 'Expand', icon: '↕️', prompt: 'The slide has too much empty space. Expand card heights, increase spacing, add visual breathing room, use the full frame area. DO NOT add new text content or change existing text — only adjust the visual sizing and spacing. Keep h1, h2, h3, h4 text identical.' },
          { label: 'Simplify', icon: '✨', prompt: 'Make the visual design lighter and more minimal. Reduce decorative elements, increase white space, simplify borders/shadows. DO NOT change, remove, or reword any text content. Keep h1, h2, h3, h4 text identical.' },
          { label: 'Compact', icon: '📏', prompt: 'Make the layout more compact and space-efficient. Tighten spacing between elements, reduce padding, use the available frame space more efficiently. DO NOT change, add, or remove any text content — only adjust visual density and spacing. Keep h1, h2, h3, h4 text identical.' },
          { label: 'Emphasize', icon: '💪', prompt: 'Make the visual design more impactful. Use stronger contrast, bigger numbers, bolder visual weight. DO NOT change any text content — only adjust visual styling and emphasis. Keep h1, h2, h3, h4 text identical.' },
        ].map(({ label, icon, prompt }) => (
          <button
            key={label}
            className="slide-quick-action-btn"
            disabled={isImproving}
            onClick={async () => {
              setSlidePrompt(prompt);
              setIsImproving(true);
              setError('');
              try {
                const isImg = activeSlide.templateId === 'image-full' || activeSlide.templateId === 'image-content'
                  || (activeSlide.html && (activeSlide.html.includes('slide-image-full') || activeSlide.html.includes('frame-image')));
                if (isImg && state.settings.imageModel) {
                  const imageMode = activeSlide.templateId === 'image-full' ? 'full' : 'content';
                  const slideIdx = state.slides.findIndex(s => s.id === activeSlide.id);
                  const existingImage = extractImageDataUri(activeSlide.html);
                  const imageResult = await generateImageSlide(prompt, state.settings, imageMode, {
                    layoutGuidance: prompt,
                    vibe: state.imageVibe || state.vibe,
                    footerBranding: state.settings.footerBranding || 'Strategy&',
                    slideNumber: slideIdx + 1,
                    totalSlides: state.slides.length,
                    existingImageDataUri: existingImage,
                  });
                  actions.updateSlide(activeSlide.id, {
                    html: imageResult.html,
                    title: imageResult.title || activeSlide.title,
                    templateId: activeSlide.templateId,
                    type: activeSlide.type,
                  });
                } else {
                  const slideInfo = { html: activeSlide.html };
                  const fastSettings = { ...state.settings, model: state.settings.fastModel || state.settings.model };
                  const result = await improveSlide(slideInfo, prompt, fastSettings);
                  const improvedHtml = result?.html || result;
                  const newCustomCSS = result?.customCSS;
                  const updateData = { html: improvedHtml };
                  if (newCustomCSS) updateData.customCSS = newCustomCSS;
                  actions.updateSlide(activeSlide.id, updateData);
                }
                setSlidePrompt('');
              } catch (err) {
                setError(err.message);
              } finally {
                setIsImproving(false);
              }
            }}
          >
            <span className="quick-action-icon">{icon}</span>
            {label}
          </button>
        ))}
      </div>
      </div>

      {/* Bottom bar: Slide Info */}
      <div className="preview-bottom-bar">
        <div className="preview-info">
          <span>Slide {state.slides.findIndex(s => s.id === activeSlide.id) + 1} of {state.slides.length}</span>
          <span>|</span>
          <span>Type: {activeSlide.type}</span>
          <span>|</span>
          <span>Updated: {new Date(activeSlide.updatedAt).toLocaleTimeString()}</span>
          {pendingCommentsCount > 0 && (
            <span className="pending-instructions-badge" onClick={() => setShowCommentPanel(true)}>
              {pendingCommentsCount} instruction{pendingCommentsCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

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
          vibe={state.vibe}
          combinedCSS={combinedCSS}
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

// SIMPLIFIED: Only container CSS - all slide styling from globally imported slides.css
// This prevents CSS duplication and ensures vibes work correctly in both
// main preview and thumbnails
export function getBaseCSS() {
  return `
/* Container sizing only - slides.css handles all .slide content styling */
.slide-render-container {
  width: 960px;
  height: 540px;
  position: relative;
  overflow: hidden;
}

/* Fallback for content without .slide wrapper */
.slide-render-container:not(:has(.slide)) {
  background: #fff;
  padding: 35px;
  font-family: Arial, sans-serif;
  color: #111111;
}
`;
}

// Inject data-vibe attribute into slide HTML
function injectVibeToHtml(html, vibe) {
  if (!vibe || vibe === 'default' || !html) return html;
  const cleanHtml = html.replace(/\s*data-vibe="[^"]*"/g, '');
  return cleanHtml.replace(
    /class="slide([^"]*)"(?!\s*data-vibe)/,
    `class="slide$1" data-vibe="${vibe}"`
  );
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
function injectSubSectionToHtml(html, subSectionLabel, sectionLabel) {
  if (!subSectionLabel || !html) return html;
  const escaped = subSectionLabel.replace(/"/g, '&quot;');
  const cleanHtml = html.replace(/\s*data-subsection="[^"]*"/g, '');
  // Calculate offset based on main tracker label width
  const offset = sectionLabel ? Math.round(sectionLabel.length * 5.5 + 29) : 0;
  return cleanHtml.replace(
    /class="slide([^"]*)"/,
    `class="slide$1" data-subsection="${escaped}" style="--tracker-offset: ${offset}px"`
  );
}

// Dynamically inject the correct page number into the footer
function injectPageNumber(html, pageNumber) {
  if (!html || !pageNumber) return html;
  // Match footer with two spans: <footer class="footer"><span>Brand</span><span>N</span></footer>
  // Replace the second span's content with the actual page number
  return html.replace(
    /(<footer[^>]*class="[^"]*footer[^"]*"[^>]*>\s*<span>[^<]*<\/span>\s*<span>)[^<]*(<\/span>)/i,
    `$1${pageNumber}$2`
  );
}

// Fullscreen Modal Component with proper scaling and navigation
function FullscreenModal({ slides, currentSlideId, vibe, combinedCSS, onClose, onNavigate }) {
  const [scale, setScale] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(() =>
    slides.findIndex(s => s.id === currentSlideId)
  );

  const currentSlide = slides[currentIndex];
  let slideHtml = injectVibeToHtml(currentSlide?.html, vibe);
  // Strip footer from cover slides to avoid duplicate branding
  if (slideHtml && (slideHtml.includes('cover-slide') || slideHtml.includes('cover-branding'))) {
    slideHtml = slideHtml.replace(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/gi, '');
  }
  // Inject section tracker
  if (currentSlide?.sectionLabel && slideHtml) {
    slideHtml = injectSectionToHtml(slideHtml, currentSlide.sectionLabel);
  }
  // Inject sub-section tracker
  if (currentSlide?.subSectionLabel && slideHtml) {
    slideHtml = injectSubSectionToHtml(slideHtml, currentSlide.subSectionLabel, currentSlide.sectionLabel);
  }
  slideHtml = injectPageNumber(slideHtml, currentIndex + 1);
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
      <style>{getBaseCSS() + '\n' + combinedCSS + '\n' + VIBE_AWARE_CSS + '\n:root { ' + getVibeCSS(vibe) + ' }'}</style>

      {/* Scaled slide wrapper */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <div
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
