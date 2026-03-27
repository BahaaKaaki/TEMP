import { useState, useMemo, useRef } from 'react';
import { useSlides } from '../context/SlideContext';
import { generateSlides, generatePptxRendererCode, fillTemplateWithAI, selectTemplateWithAI, hasAnyApiKey, improveSlideWithSearch } from '../services/aiService';
import { SLIDE_TEMPLATES } from '../utils/slideTemplates';
import { getVibePromptContext } from '../utils/vibes';
import TemplatePicker from './TemplatePicker';

export default function AIPrompt() {
  const { state, actions, activeSlide } = useSlides();

  // Keep a ref to current state that's updated synchronously on every render
  // This prevents stale closure issues in async handlers
  const stateRef = useRef(state);
  stateRef.current = state;
  const [prompt, setPrompt] = useState('');
  const [slideCount, setSlideCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('generate'); // 'generate' or 'improve'
  const [selectedTemplate, setSelectedTemplate] = useState(null); // null = freestyle
  const [autoMatchTemplate, setAutoMatchTemplate] = useState(false);
  const [matchedTemplate, setMatchedTemplate] = useState(null);

  // Get all available templates including custom and modified system templates
  const allTemplates = useMemo(() => {
    const deletedIds = state.deletedSystemTemplates || [];
    const modifications = state.modifiedSystemTemplates || {};
    const builtIn = Object.values(SLIDE_TEMPLATES)
      .filter((t) => !deletedIds.includes(t.id))
      .map((t) => {
        const mod = modifications[t.id];
        return { ...t, ...(mod || {}), isBuiltIn: true };
      });
    const custom = (state.customTemplates || []).map((t) => ({ ...t, isBuiltIn: false }));
    return [...builtIn, ...custom];
  }, [state.customTemplates, state.deletedSystemTemplates, state.modifiedSystemTemplates]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    // CRITICAL: Get current state from ref to avoid stale closure issues
    const currentState = stateRef.current;
    const settings = currentState.settings;

    if (!hasAnyApiKey(settings)) {
      setError('Please configure your API key in Settings first');
      return;
    }

    setIsLoading(true);
    setError('');
    setMatchedTemplate(null);

    try {
      let slides = [];
      let matchedTemplateInfo = null;

      // Get vibe context for AI
      const vibeHint = getVibePromptContext(currentState.vibe);
      const promptWithVibe = vibeHint ? `${prompt}\n\n[Design Style: ${vibeHint}]` : prompt;

      // Check if auto-match is enabled and no manual selection
      if (autoMatchTemplate && !selectedTemplate) {
        // Use AI to select the best template
        const selectedAITemplate = await selectTemplateWithAI(prompt, allTemplates, settings);

        if (selectedAITemplate) {
          // Check for modifications to this template
          const modifications = currentState.modifiedSystemTemplates || {};
          const modifiedTemplate = modifications[selectedAITemplate.id];
          const templateToUse = modifiedTemplate ? { ...selectedAITemplate, ...modifiedTemplate } : selectedAITemplate;

          matchedTemplateInfo = templateToUse;
          setMatchedTemplate(templateToUse);

          // Generate slides using the AI-selected template
          for (let i = 0; i < slideCount; i++) {
            const contentDesc = slideCount > 1
              ? `${promptWithVibe} (Slide ${i + 1} of ${slideCount})`
              : promptWithVibe;

            const filledHtml = await fillTemplateWithAI(templateToUse, contentDesc, settings);
            slides.push({
              title: `${templateToUse.title} - ${i + 1}`,
              type: templateToUse.id,
              html: filledHtml,
              summary: `Generated using ${templateToUse.title} template (AI selected)`,
              templateId: templateToUse.id,
            });
          }
        } else {
          // AI chose freestyle, generate without template
          slides = await generateSlides(promptWithVibe, settings, slideCount, currentState.slides);
        }
      } else {
        // Manual template selection or freestyle (consistent with chatbot)
        const customTemplate = currentState.customTemplates?.find(t => t.id === selectedTemplate);
        slides = await generateSlides(promptWithVibe, settings, slideCount, currentState.slides, selectedTemplate, customTemplate);
      }

      // Generate PPTX code for each slide if setting is enabled
      const shouldGeneratePptx = settings.pptxGenerateOnCreate && hasAnyApiKey(settings);

      for (const slide of slides) {
        let pptxRendererCode = null;

        if (shouldGeneratePptx) {
          try {
            pptxRendererCode = await generatePptxRendererCode(
              slide.html,
              slide.title || 'Slide',
              settings
            );
          } catch (err) {
            console.warn('Failed to generate PPTX code for slide:', err);
          }
        }

        actions.addSlide({
          title: slide.title,
          type: slide.type,
          html: slide.html,
          summary: slide.summary,
          pptxRendererCode,
          templateId: slide.templateId,
        });
      }

      setPrompt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImprove = async () => {
    if (!prompt.trim()) {
      setError('Please enter improvement instructions');
      return;
    }

    // CRITICAL: Get current state from ref to avoid stale closure issues
    const currentState = stateRef.current;

    // Get the current active slide from current state
    const currentActiveSlide = currentState.slides.find(s => s.id === currentState.activeSlideId);
    if (!currentActiveSlide) {
      setError('Please select a slide to improve');
      return;
    }

    if (!hasAnyApiKey(currentState.settings)) {
      setError('Please configure your API key in Settings first');
      return;
    }

    setIsLoading(true);
    setError('');

    const slideId = currentActiveSlide.id;
    const settings = currentState.settings;

    try {
      const result = await improveSlideWithSearch(
        currentActiveSlide, prompt, settings,
      );

      const improvedHtml = result?.html || result;
      const newCustomCSS = result?.customCSS;

      const updateData = { html: improvedHtml };
      if (newCustomCSS) updateData.customCSS = newCustomCSS;
      actions.updateSlide(slideId, updateData);

      setPrompt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'generate') {
      handleGenerate();
    } else {
      handleImprove();
    }
  };

  return (
    <div className="prompt-section">
      <form onSubmit={handleSubmit} className="prompt-form">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'generate' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('generate')}
          >
            Generate New
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'improve' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('improve')}
            disabled={!activeSlide}
          >
            Improve Selected
          </button>
        </div>

        <div className="prompt-input-wrapper">
          <textarea
            className="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === 'generate'
                ? 'Describe your presentation topic... (e.g., "A quarterly business review for a SaaS company showing growth metrics")'
                : 'Describe how to improve this slide... (e.g., "Add more specific data points" or "Make the design more modern")'
            }
            rows={2}
            disabled={isLoading}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Generating...
              </>
            ) : mode === 'generate' ? (
              'Generate'
            ) : (
              'Improve'
            )}
          </button>
        </div>

        {mode === 'generate' && (
          <div className="prompt-options">
            <div className="prompt-option">
              <label>Number of slides:</label>
              <select
                value={slideCount}
                onChange={(e) => setSlideCount(parseInt(e.target.value))}
                disabled={isLoading}
              >
                <option value={1}>1 slide</option>
                <option value={2}>2 slides</option>
                <option value={3}>3 slides</option>
                <option value={5}>5 slides</option>
                <option value={7}>7 slides</option>
                <option value={10}>10 slides</option>
              </select>
            </div>

            <div className="prompt-option">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoMatchTemplate}
                  onChange={(e) => {
                    setAutoMatchTemplate(e.target.checked);
                    if (e.target.checked) setSelectedTemplate(null);
                  }}
                  disabled={isLoading}
                  style={{ cursor: 'pointer' }}
                />
                <span title="Automatically find and use a matching template based on your prompt">
                  Auto Match
                </span>
              </label>
            </div>

            {!autoMatchTemplate && (
              <div className="prompt-option" style={{ flex: '1 1 200px' }}>
                <label>Template:</label>
                <TemplatePicker
                  selectedTemplate={selectedTemplate}
                  onSelect={setSelectedTemplate}
                  showFreestyle={true}
                  compact={true}
                />
              </div>
            )}
          </div>
        )}

        {matchedTemplate && (
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(16, 185, 129, 0.15)',
              borderRadius: 6,
              color: '#10b981',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Matched template: <strong>{matchedTemplate.title}</strong>
          </div>
        )}

        {mode === 'improve' && activeSlide && (
          <div style={{ fontSize: 12, color: '#888' }}>
            Improving: {activeSlide.title || 'Untitled slide'}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(220, 53, 69, 0.2)',
              borderRadius: 6,
              color: '#dc3545',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
