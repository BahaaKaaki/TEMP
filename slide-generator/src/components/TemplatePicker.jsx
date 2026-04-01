import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAllTemplates, getTemplatesByCategory, getTemplate } from '../utils/slideTemplates';
import { useSlides } from '../context/SlideContext';
import { VIBE_AWARE_CSS } from '../utils/vibes';
import { suggestTemplatesForContent } from '../services/templateEmbeddings';

// Mini preview renderer for templates with actual slide HTML
function TemplatePreview({ template, isSelected, onClick, vibe = 'bold' }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.15);

  // Calculate scale based on container width
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Slide is 960px wide, scale to fit container
        const newScale = containerWidth / 960;
        setScale(newScale);
      }
    };

    updateScale();
    // Update on resize
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <button
      className={`template-preview-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      title={template.description}
    >
      {/* Visual slide preview */}
      <div className="template-preview-visual" ref={containerRef} data-vibe={vibe}>
        <style>{getSlidePreviewStyles() + '\n' + VIBE_AWARE_CSS}</style>
        <div
          className="template-mini-slide slide-preview-styled"
          style={{ transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: template.html }}
        />
      </div>
      <div className="template-preview-info">
        <span className="template-preview-title">{template.title}</span>
        {template.isCustom && <span className="template-custom-badge">Custom</span>}
      </div>
      {isSelected && (
        <div className="template-check">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
    </button>
  );
}

function getTemplateIcon(templateId, isCustom = false) {
  // Custom templates get a star icon
  if (isCustom || (templateId && templateId.startsWith('custom-'))) {
    return (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <polygon points="20,8 22,14 28,14 23,18 25,24 20,20 15,24 17,18 12,14 18,14" fill="currentColor" />
      </svg>
    );
  }

  const icons = {
    cover: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="8" y1="10" x2="24" y2="10" />
        <line x1="8" y1="16" x2="32" y2="16" />
        <line x1="8" y1="22" x2="16" y2="22" />
      </svg>
    ),
    threeCards: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="8" width="10" height="18" rx="1" />
        <rect x="15" y="8" width="10" height="18" rx="1" />
        <rect x="26" y="8" width="10" height="18" rx="1" />
      </svg>
    ),
    kpiMetrics: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="8" width="14" height="6" rx="1" />
        <rect x="4" y="16" width="14" height="6" rx="1" />
        <line x1="22" y1="10" x2="34" y2="10" />
        <line x1="22" y1="16" x2="34" y2="16" />
        <line x1="22" y1="22" x2="34" y2="22" />
      </svg>
    ),
    timeline: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <circle cx="8" cy="10" r="3" />
        <line x1="12" y1="10" x2="34" y2="10" />
        <circle cx="8" cy="18" r="3" />
        <line x1="12" y1="18" x2="34" y2="18" />
        <circle cx="8" cy="26" r="3" />
      </svg>
    ),
    quote: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <path d="M10 10 L8 14 L12 14 L12 20 L8 20 L8 14" />
        <path d="M18 10 L16 14 L20 14 L20 20 L16 20 L16 14" />
        <line x1="24" y1="16" x2="34" y2="16" />
      </svg>
    ),
    bulletPoints: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <circle cx="8" cy="10" r="2" fill="currentColor" />
        <line x1="14" y1="10" x2="34" y2="10" />
        <circle cx="8" cy="16" r="2" fill="currentColor" />
        <line x1="14" y1="16" x2="34" y2="16" />
        <circle cx="8" cy="22" r="2" fill="currentColor" />
        <line x1="14" y1="22" x2="34" y2="22" />
      </svg>
    ),
    grid2x2: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="8" width="15" height="9" rx="1" />
        <rect x="21" y="8" width="15" height="9" rx="1" />
        <rect x="4" y="19" width="15" height="9" rx="1" />
        <rect x="21" y="19" width="15" height="9" rx="1" />
      </svg>
    ),
    comparisonTable: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="4" y1="10" x2="36" y2="10" />
        <line x1="4" y1="16" x2="36" y2="16" />
        <line x1="4" y1="22" x2="36" y2="22" />
        <line x1="14" y1="6" x2="14" y2="26" />
        <line x1="26" y1="6" x2="26" y2="26" />
      </svg>
    ),
    processFlow: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <circle cx="8" cy="15" r="4" />
        <line x1="13" y1="15" x2="16" y2="15" />
        <circle cx="20" cy="15" r="4" />
        <line x1="25" y1="15" x2="28" y2="15" />
        <circle cx="32" cy="15" r="4" />
      </svg>
    ),
    statHighlight: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <text x="20" y="18" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">42%</text>
        <line x1="10" y1="24" x2="30" y2="24" />
      </svg>
    ),
    blank: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="6" y="6" width="28" height="18" rx="1" strokeDasharray="2 2" />
      </svg>
    ),
    // Empty master slide icons
    'empty-standard': (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="6" y1="7" x2="24" y2="7" strokeWidth="2" />
        <line x1="6" y1="11" x2="18" y2="11" opacity="0.6" />
        <rect x="6" y="14" width="28" height="11" rx="1" strokeDasharray="2 2" />
      </svg>
    ),
    'empty-blank': (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="6" y="6" width="28" height="18" rx="1" strokeDasharray="2 2" />
        <text x="20" y="17" textAnchor="middle" fontSize="6" fill="currentColor" opacity="0.5">blank</text>
      </svg>
    ),
    'empty-titleOnly': (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="6" y1="7" x2="28" y2="7" strokeWidth="2" />
        <rect x="6" y="11" width="28" height="14" rx="1" strokeDasharray="2 2" />
      </svg>
    ),
    'empty-cover': (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="10" y1="10" x2="22" y2="10" opacity="0.6" />
        <line x1="8" y1="15" x2="32" y2="15" strokeWidth="2" />
        <line x1="6" y1="23" x2="14" y2="23" opacity="0.5" />
        <line x1="28" y1="23" x2="34" y2="23" opacity="0.5" />
      </svg>
    ),
    'empty-emptyPage': (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="4" width="32" height="22" rx="1" strokeDasharray="3 3" />
        <text x="20" y="17" textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.4">100%</text>
      </svg>
    ),
    strategicInsight: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="5" width="32" height="6" rx="1" />
        <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6" />
        <line x1="12" y1="7" x2="32" y2="7" strokeWidth="2" />
        <line x1="12" y1="10" x2="28" y2="10" opacity="0.5" />
        <rect x="4" y="13" width="10" height="7" rx="1" />
        <rect x="15" y="13" width="10" height="7" rx="1" />
        <rect x="26" y="13" width="10" height="7" rx="1" />
        <rect x="4" y="22" width="32" height="4" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    insight: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="5" width="32" height="6" rx="1" />
        <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6" />
        <line x1="12" y1="7" x2="32" y2="7" strokeWidth="2" />
        <line x1="12" y1="10" x2="28" y2="10" opacity="0.5" />
        <rect x="4" y="13" width="10" height="7" rx="1" />
        <rect x="15" y="13" width="10" height="7" rx="1" />
        <rect x="26" y="13" width="10" height="7" rx="1" />
        <rect x="4" y="22" width="32" height="4" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    roadmapTimeline: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="6" y1="15" x2="34" y2="15" />
        <circle cx="10" cy="15" r="2" fill="currentColor" />
        <circle cx="18" cy="15" r="2" fill="currentColor" />
        <circle cx="26" cy="15" r="2" fill="currentColor" />
        <circle cx="34" cy="15" r="2.5" fill="currentColor" />
        <rect x="6" y="18" width="8" height="6" rx="1" />
        <rect x="14" y="18" width="8" height="6" rx="1" />
        <rect x="22" y="18" width="8" height="6" rx="1" />
      </svg>
    ),
    executiveSummary: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="6" width="15" height="10" rx="1" />
        <rect x="21" y="6" width="15" height="10" rx="1" />
        <rect x="4" y="18" width="15" height="8" rx="1" />
        <rect x="21" y="18" width="15" height="8" rx="1" />
      </svg>
    ),
    competitiveLandscape: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="20" y1="6" x2="20" y2="26" strokeDasharray="2 2" />
        <line x1="6" y1="16" x2="34" y2="16" strokeDasharray="2 2" />
        <circle cx="28" cy="10" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="24" cy="13" r="2.5" fill="currentColor" opacity="0.6" />
        <circle cx="14" cy="20" r="2" fill="currentColor" opacity="0.4" />
        <circle cx="26" cy="14" r="2" fill="currentColor" />
      </svg>
    ),
    riskAssessment: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="6" width="32" height="5" rx="1" />
        <rect x="4" y="13" width="32" height="5" rx="1" />
        <rect x="4" y="20" width="32" height="5" rx="1" />
        <circle cx="8" cy="8.5" r="1.5" fill="currentColor" />
        <circle cx="8" cy="15.5" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="8" cy="22.5" r="1.5" fill="currentColor" opacity="0.3" />
      </svg>
    ),
    nextSteps: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="6" width="4" height="4" rx="1" />
        <line x1="10" y1="8" x2="34" y2="8" />
        <rect x="4" y="13" width="4" height="4" rx="1" />
        <line x1="10" y1="15" x2="34" y2="15" />
        <rect x="4" y="20" width="4" height="4" rx="1" />
        <line x1="10" y1="22" x2="34" y2="22" />
      </svg>
    ),
    prosAndCons: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="6" width="15" height="20" rx="1" />
        <rect x="21" y="6" width="15" height="20" rx="1" />
        <text x="11.5" y="15" textAnchor="middle" fontSize="10" fill="currentColor">+</text>
        <text x="28.5" y="15" textAnchor="middle" fontSize="10" fill="currentColor">−</text>
      </svg>
    ),
    problemSolution: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="6" width="13" height="18" rx="1" />
        <rect x="23" y="6" width="13" height="18" rx="1" />
        <path d="M18 15 L21 15" />
        <polygon points="21,12 25,15 21,18" fill="currentColor" />
      </svg>
    ),
    customerJourney: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="6" y1="15" x2="34" y2="15" />
        <circle cx="8" cy="15" r="2" fill="currentColor" />
        <circle cx="15" cy="15" r="2" fill="currentColor" />
        <circle cx="22" cy="15" r="2" fill="currentColor" />
        <circle cx="29" cy="15" r="2" fill="currentColor" />
        <rect x="5" y="18" width="6" height="5" rx="1" />
        <rect x="12" y="18" width="6" height="5" rx="1" />
        <rect x="19" y="18" width="6" height="5" rx="1" />
        <rect x="26" y="18" width="6" height="5" rx="1" />
      </svg>
    ),
    milestoneTracker: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="6" width="32" height="5" rx="1" />
        <rect x="4" y="13" width="32" height="5" rx="1" />
        <rect x="4" y="20" width="32" height="5" rx="1" />
        <circle cx="8" cy="8.5" r="2" fill="currentColor" />
        <circle cx="8" cy="15.5" r="2" fill="currentColor" />
        <circle cx="8" cy="22.5" r="2" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
    marketSizing: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <path d="M4 8 L36 8 L30 14 L10 14 Z" fill="currentColor" opacity="0.3" />
        <path d="M8 15 L32 15 L28 21 L12 21 Z" fill="currentColor" opacity="0.5" />
        <path d="M12 22 L28 22 L26 26 L14 26 Z" fill="currentColor" opacity="0.8" />
      </svg>
    ),
    featureComparison: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <line x1="4" y1="10" x2="36" y2="10" />
        <line x1="4" y1="16" x2="36" y2="16" />
        <line x1="4" y1="22" x2="36" y2="22" />
        <line x1="12" y1="6" x2="12" y2="26" />
        <line x1="20" y1="6" x2="20" y2="26" />
        <line x1="28" y1="6" x2="28" y2="26" />
        <text x="24" y="14" fontSize="6" fill="currentColor">✓</text>
        <text x="32" y="14" fontSize="6" fill="currentColor">✓</text>
        <text x="32" y="20" fontSize="6" fill="currentColor">✓</text>
      </svg>
    ),
    metricsDashboard: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="6" width="10" height="9" rx="1" />
        <rect x="15" y="6" width="10" height="9" rx="1" />
        <rect x="26" y="6" width="10" height="9" rx="1" />
        <rect x="4" y="17" width="10" height="9" rx="1" />
        <rect x="15" y="17" width="10" height="9" rx="1" />
        <rect x="26" y="17" width="10" height="9" rx="1" />
      </svg>
    ),
    caseStudy: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <rect x="4" y="6" width="32" height="6" rx="1" />
        <rect x="4" y="14" width="10" height="10" rx="1" />
        <rect x="16" y="14" width="10" height="10" rx="1" />
        <rect x="28" y="14" width="8" height="10" rx="1" />
      </svg>
    ),
    custom: (
      <svg viewBox="0 0 40 30" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="36" height="26" rx="2" />
        <path d="M20 8 L20 22 M14 15 L26 15" />
      </svg>
    ),
  };
  return icons[templateId] || icons.custom;
}

export default function TemplatePicker({
  selectedTemplate,
  onSelect,
  showFreestyle = true,
  compact = false,
  title = 'Select Template',
  initiallyOpen = false,
  onClose = null, // Optional callback when picker is closed
  slideHtml = null, // HTML of the active slide (for smart suggestions in full mode)
  currentTemplateId = null, // Current slide's template ID (excluded from suggestions)
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [hoveredTemplate, setHoveredTemplate] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 60, right: 40 });
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const fullSearchRef = useRef(null);
  const { state } = useSlides();

  // Calculate dropdown position based on trigger button location
  useEffect(() => {
    if (isOpen && triggerRef.current && compact) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const dropdownHeight = Math.min(400, viewportHeight - 80);
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top, bottom, maxHeight;
      if (spaceBelow >= dropdownHeight + 20) {
        top = rect.bottom + 8;
        bottom = 'auto';
        maxHeight = Math.min(dropdownHeight, viewportHeight - top - 20);
      } else if (spaceAbove >= dropdownHeight + 20) {
        bottom = viewportHeight - rect.top + 8;
        top = 'auto';
        maxHeight = Math.min(dropdownHeight, spaceAbove - 20);
      } else {
        // Neither side has enough room -- center vertically and cap height
        top = Math.max(20, (viewportHeight - dropdownHeight) / 2);
        bottom = 'auto';
        maxHeight = viewportHeight - 40;
      }

      const rightEdge = viewportWidth - rect.right;
      const right = Math.max(20, Math.min(rightEdge - 10, viewportWidth - 680));

      setDropdownPosition({ top, bottom, right, maxHeight });
    }
  }, [isOpen, compact]);

  const handleClose = () => {
    setIsOpen(false);
    setHoveredTemplate(null);
    setSearchQuery('');
    if (onClose) onClose();
  };

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Merge built-in templates with custom templates
  const templatesByCategory = useMemo(() => {
    const builtIn = getTemplatesByCategory();

    // Add custom templates category if there are any
    if (state.customTemplates && state.customTemplates.length > 0) {
      builtIn['Custom'] = state.customTemplates.map((t) => ({
        ...t,
        isCustom: true,
      }));
    }

    return builtIn;
  }, [state.customTemplates]);

  // Filter templates by search query (must be outside conditional for hooks rules)
  const filteredByCategory = useMemo(() => {
    if (!searchQuery.trim()) return templatesByCategory;

    const query = searchQuery.toLowerCase();
    const filtered = {};

    Object.entries(templatesByCategory).forEach(([category, templates]) => {
      const matchingTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );
      if (matchingTemplates.length > 0) {
        filtered[category] = matchingTemplates;
      }
    });

    return filtered;
  }, [templatesByCategory, searchQuery]);

  // Smart suggestions based on slide content (full mode only, no API call)
  const suggestedTemplates = useMemo(() => {
    if (!slideHtml) return [];
    const suggestions = suggestTemplatesForContent(slideHtml, currentTemplateId, 6);
    // Resolve to full template objects
    return suggestions
      .map(s => {
        const t = getTemplate(s.id);
        return t ? { ...t, score: s.score, reason: s.reason } : null;
      })
      .filter(Boolean);
  }, [slideHtml, currentTemplateId]);

  // Filter for full mode search (separate from compact search which uses filteredByCategory)
  const fullModeFiltered = useMemo(() => {
    if (!searchQuery.trim()) return templatesByCategory;
    const query = searchQuery.toLowerCase();
    const filtered = {};
    Object.entries(templatesByCategory).forEach(([category, templates]) => {
      const matching = templates.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.note?.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );
      if (matching.length > 0) filtered[category] = matching;
    });
    return filtered;
  }, [templatesByCategory, searchQuery]);

  // Focus full-mode search on mount
  useEffect(() => {
    if (!compact && fullSearchRef.current) {
      setTimeout(() => fullSearchRef.current?.focus(), 100);
    }
  }, [compact]);

  const handleSelect = (templateId) => {
    onSelect(templateId);
    if (compact) {
      setIsOpen(false);
    }
  };

  // Compact mode - dropdown style
  if (compact) {
    // Merge built-in and custom templates for lookup
    const allTemplates = [
      ...getAllTemplates().map(t => ({ ...t, isCustom: false })),
      ...(state.customTemplates || []).map(t => ({ ...t, isCustom: true })),
    ];
    const selected = selectedTemplate
      ? allTemplates.find((t) => t.id === selectedTemplate)
      : null;

    return (
      <div className="template-picker-compact">
        <button
          ref={triggerRef}
          className="template-picker-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="trigger-icon">
            {selectedTemplate ? getTemplateIcon(selectedTemplate, selected?.isCustom) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            )}
          </span>
          <span className="trigger-label">
            {selected ? (
              <>
                {selected.title}
                {selected.isCustom && <span style={{ marginLeft: 4, fontSize: 10 }}>★</span>}
              </>
            ) : selectedTemplate === 'freestyle' ? 'Freestyle' : 'Choose template...'}
          </span>
          <svg className="trigger-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {isOpen && createPortal(
          <>
            <div className="template-picker-backdrop" onClick={handleClose} />
            <div
              className="template-picker-dropdown-container template-picker-portal"
              style={{
                position: 'fixed',
                top: dropdownPosition.top === 'auto' ? 'auto' : dropdownPosition.top,
                bottom: dropdownPosition.bottom === 'auto' ? 'auto' : dropdownPosition.bottom,
                right: dropdownPosition.right,
                maxHeight: dropdownPosition.maxHeight || 400,
                overflow: 'auto',
              }}
            >
              <div className="template-picker-dropdown">
                {/* Search input */}
                <div className="template-search-wrapper">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="template-search-input"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {searchQuery && (
                    <button
                      className="template-search-clear"
                      onClick={() => setSearchQuery('')}
                    >
                      ×
                    </button>
                  )}
                </div>
                {showFreestyle && !searchQuery && (
                  <>
                    <button
                      className={`template-dropdown-item ${!selectedTemplate ? 'selected' : ''}`}
                      onClick={() => handleSelect(null)}
                      onMouseEnter={() => setHoveredTemplate(null)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                      <span>Freestyle (AI chooses)</span>
                      {!selectedTemplate && <span className="item-check">✓</span>}
                    </button>
                    <button
                      className="template-dropdown-item"
                      disabled
                      style={{ opacity: 0.4, pointerEvents: 'none' }}
                      title="Image mode is currently disabled"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <span>Image Full (AI visual)</span>
                    </button>
                    <button
                      className="template-dropdown-item"
                      disabled
                      style={{ opacity: 0.4, pointerEvents: 'none' }}
                      title="Image mode is currently disabled"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <circle cx="10" cy="15" r="2" />
                        <path d="M18 18l-3-3-2 2" />
                      </svg>
                      <span>Image + Text (illustrated)</span>
                    </button>
                  </>
                )}
                {(!searchQuery || Object.keys(filteredByCategory).length > 0) && <div className="template-dropdown-divider" />}
                {suggestedTemplates.length > 0 && !searchQuery && (
                  <div className="template-dropdown-category">
                    <div className="category-label">Suggested for This Slide</div>
                    {suggestedTemplates.slice(0, 4).map((template) => (
                      <button
                        key={`suggested-${template.id}`}
                        className={`template-dropdown-item ${selectedTemplate === template.id ? 'selected' : ''} ${hoveredTemplate?.id === template.id ? 'hovered' : ''}`}
                        onClick={() => handleSelect(template.id)}
                        onMouseEnter={() => setHoveredTemplate(template)}
                      >
                        <span className="item-icon">{getTemplateIcon(template.id, template.isCustom)}</span>
                        <span>{template.title}</span>
                        {selectedTemplate === template.id && <span className="item-check">✓</span>}
                      </button>
                    ))}
                    <div className="template-dropdown-divider" />
                  </div>
                )}
                {Object.keys(filteredByCategory).length === 0 && searchQuery ? (
                  <div className="template-no-results">
                    <span>No templates match "{searchQuery}"</span>
                  </div>
                ) : (
                  Object.entries(filteredByCategory).map(([category, templates]) => (
                    <div key={category} className="template-dropdown-category">
                      <div className="category-label">{category}</div>
                      {templates.map((template, tIdx) => (
                        <button
                          key={template.id || `tmpl-${tIdx}`}
                          className={`template-dropdown-item ${selectedTemplate === template.id ? 'selected' : ''} ${hoveredTemplate?.id === template.id ? 'hovered' : ''}`}
                          onClick={() => handleSelect(template.id)}
                          onMouseEnter={() => setHoveredTemplate(template)}
                        >
                          <span className="item-icon">{getTemplateIcon(template.id, template.isCustom)}</span>
                          <span>{template.title}{template.isCustom && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>★</span>}</span>
                          {selectedTemplate === template.id && <span className="item-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
              {/* Template Preview Panel */}
              <div className="template-preview-panel">
                {hoveredTemplate ? (
                  <>
                    <div className="preview-header">
                      <h4>{hoveredTemplate.title}</h4>
                      <p>{hoveredTemplate.description}</p>
                    </div>
                    <div className="preview-slide-container" data-vibe={state.vibe}>
                      <style>{getSlidePreviewStyles() + '\n' + VIBE_AWARE_CSS}</style>
                      <div
                        className="preview-slide-mini slide-preview-styled"
                        dangerouslySetInnerHTML={{ __html: hoveredTemplate.html }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="preview-placeholder">
                    <div className="preview-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <p>Freestyle Mode</p>
                    <span>AI will choose the best layout for your content</span>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  }

  // Full mode - grid of previews
  const categoriesToRender = searchQuery.trim() ? fullModeFiltered : templatesByCategory;
  const hasSearchResults = Object.keys(categoriesToRender).length > 0;

  return (
    <div className="template-picker">
      <h4 className="template-picker-title">{title}</h4>

      {/* Search input */}
      <div className="template-picker-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={fullSearchRef}
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="template-picker-search-clear" onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>

      {/* Smart suggestions */}
      {suggestedTemplates.length > 0 && !searchQuery && (
        <div className="template-picker-section">
          <h5 className="template-category-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: -1 }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
            </svg>
            Suggested for Your Content
          </h5>
          <div className="template-grid">
            {suggestedTemplates.map((template) => (
              <TemplatePreview
                key={`suggested-${template.id}`}
                template={template}
                isSelected={selectedTemplate === template.id}
                onClick={() => onSelect(template.id)}
                vibe={state.vibe}
              />
            ))}
          </div>
        </div>
      )}

      {showFreestyle && !searchQuery && (
        <div className="template-picker-section">
          <button
            className={`template-freestyle-option ${!selectedTemplate ? 'selected' : ''}`}
            onClick={() => onSelect(null)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <div>
              <span className="freestyle-title">Freestyle</span>
              <span className="freestyle-desc">AI chooses the best layout</span>
            </div>
            {!selectedTemplate && (
              <span className="template-check">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            )}
          </button>
          <button
            className="template-freestyle-option"
            disabled
            style={{ marginTop: 6, opacity: 0.4, pointerEvents: 'none' }}
            title="Image mode is currently disabled"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <div>
              <span className="freestyle-title">Image Full</span>
              <span className="freestyle-desc">Full-bleed AI-generated visual</span>
            </div>
          </button>
          <button
            className="template-freestyle-option"
            disabled
            style={{ marginTop: 6, opacity: 0.4, pointerEvents: 'none' }}
            title="Image mode is currently disabled"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <circle cx="10" cy="15" r="2" />
              <path d="M18 18l-3-3-2 2" />
            </svg>
            <div>
              <span className="freestyle-title">Image + Text</span>
              <span className="freestyle-desc">AI visual with title &amp; subtitle</span>
            </div>
          </button>
        </div>
      )}

      {!hasSearchResults && searchQuery && (
        <div className="template-picker-no-results">
          No templates match "{searchQuery}"
        </div>
      )}

      {Object.entries(categoriesToRender).map(([category, templates]) => (
        <div key={category} className="template-picker-section">
          <h5 className="template-category-title">{category}</h5>
          <div className="template-grid">
            {templates.map((template, tIdx) => (
              <TemplatePreview
                key={template.id || `tmpl-${tIdx}`}
                template={template}
                isSelected={selectedTemplate === template.id}
                onClick={() => onSelect(template.id)}
                vibe={state.vibe}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// CSS styles for rendering slide previews correctly
function getSlidePreviewStyles() {
  return `
.slide-preview-styled {
  background: #fff;
  font-family: Arial, sans-serif;
}
.slide-preview-styled .slide {
  position: relative;
  width: 960px;
  height: 540px;
  background: #fff;
  box-sizing: border-box;
  overflow: hidden;
  padding: 35px;
  font-family: Arial, sans-serif;
  color: #111111;
  --maroon: #8E1E1E;
  --rose: #F8E3E3;
  --coal: #111111;
  --main: #111111;
  --secondary: #222222;
  --meta: #4A4F57;
  --zone1: #F7F9FB;
  --zone2: #EDF0F4;
  --border: #E6E9EE;
  --radius: 4px;
}
.slide-preview-styled .slide .title {
  position: absolute;
  left: 35px;
  top: 30px;
  width: 890px;
  font: 400 28px/1.2 Georgia, serif;
  color: #111111;
  margin: 0;
}
.slide-preview-styled .slide .subtitle {
  position: absolute;
  left: 35px;
  top: 101px;
  width: 890px;
  font: 700 18px/1.2 Arial, sans-serif;
  color: #A32020;
  margin: 0;
}
.slide-preview-styled .slide .frame {
  position: absolute;
  left: 35px;
  top: 137px;
  width: 890px;
  height: 353px;
  display: flex;
  flex-direction: column;
}
.slide-preview-styled .slide footer.footer {
  position: absolute;
  bottom: 0;
  left: 35px;
  width: 890px;
  padding-bottom: 14px;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #4A4F57;
}
.slide-preview-styled .slide .card-row {
  display: flex;
  gap: 16px;
  height: 100%;
}
.slide-preview-styled .slide .card {
  flex: 1;
  background: #F7F9FB;
  border-radius: 4px;
  padding: 18px;
  border-top: 5px solid #8E1E1E;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid #E6E9EE;
}
.slide-preview-styled .slide .card h3 {
  margin: 0;
  font: 700 16px/1.3 Arial, sans-serif;
  color: #111111;
}
.slide-preview-styled .slide .card p {
  margin: 0;
  font: 400 12px/1.55 Arial, sans-serif;
  color: #222222;
}
.slide-preview-styled .slide .kpi-block {
  background: #F7F9FB;
  padding: 14px 18px;
  border-radius: 4px;
  border-left: 4px solid #8E1E1E;
}
.slide-preview-styled .slide .kpi-value {
  font: 700 42px/1 Georgia, serif;
  color: #8E1E1E;
}
.slide-preview-styled .slide .kpi-label {
  margin-top: 6px;
  font: 400 13px/1.4 Arial, sans-serif;
  color: #4A4F57;
}
.slide-preview-styled .slide .two-col {
  display: flex;
  gap: 24px;
  height: 100%;
}
.slide-preview-styled .slide .col-left {
  flex: 0 0 380px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.slide-preview-styled .slide .col-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.slide-preview-styled .slide .grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 16px;
  height: 100%;
}
.slide-preview-styled .slide .grid-cell {
  background: #F7F9FB;
  border-radius: 4px;
  padding: 20px;
  border: 1px solid #E6E9EE;
}
.slide-preview-styled .slide .content-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.slide-preview-styled .slide .content-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
  font: 400 14px/1.5 Arial, sans-serif;
  color: #222222;
}
.slide-preview-styled .slide .quote-box {
  background: #F7F9FB;
  padding: 30px;
  border-radius: 4px;
  border-left: 6px solid #8E1E1E;
  margin: 20px 0;
}
.slide-preview-styled .slide .horizontal-roadmap {
  position: relative;
  height: 100%;
  padding-top: 30px;
}
.slide-preview-styled .slide .roadmap-items {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  height: 100%;
}
.slide-preview-styled .slide .roadmap-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.slide-preview-styled .slide .roadmap-card {
  background: #F7F9FB;
  border-radius: 4px;
  padding: 16px;
  border: 1px solid #E6E9EE;
  text-align: center;
  flex: 1;
}
.slide-preview-styled .slide .value-pillars {
  display: flex;
  gap: 16px;
  flex: 1;
}
.slide-preview-styled .slide .value-pillar {
  flex: 1;
  background: #F7F9FB;
  border-radius: 4px;
  padding: 16px;
  border: 1px solid #E6E9EE;
  border-top: 4px solid #8E1E1E;
}
.slide-preview-styled .slide .before-after-container {
  display: flex;
  gap: 16px;
  height: 100%;
}
.slide-preview-styled .slide .ba-column {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.slide-preview-styled .slide .pros-cons-container {
  display: flex;
  gap: 20px;
  height: 100%;
}
.slide-preview-styled .slide .pros-column,
.slide-preview-styled .slide .cons-column {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.slide-preview-styled .slide .executive-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 16px;
  height: 100%;
}
.slide-preview-styled .slide .exec-section {
  background: #F7F9FB;
  border-radius: 4px;
  padding: 16px;
  border: 1px solid #E6E9EE;
}
`;
}
