import { useMemo, useState } from 'react';
import { getAllVibes, getVibeCSS, VIBE_AWARE_CSS, generateVibeExampleSlide, isBaseVibe } from '../utils/vibes';
import { useSlides } from '../context/SlideContext';
import { regenerateWithVibe, canRegenerateVibes } from '../services/vibeRegenerator';

// Comprehensive CSS for slide preview to render 3-card example properly
const PREVIEW_BASE_CSS = `
.vibe-preview-slide-inner {
  background: #fff;
}
.vibe-preview-slide-inner .slide {
  position: relative;
  width: 960px !important;
  height: 540px !important;
  min-width: 960px;
  min-height: 540px;
  background: #fff !important;
  box-sizing: border-box;
  overflow: hidden;
  font-family: Arial, sans-serif;
  color: #111111;
  padding: 40px 50px;
  display: block;
}
.vibe-preview-slide-inner .slide * {
  box-sizing: border-box;
}
.vibe-preview-slide-inner .slide .title,
.vibe-preview-slide-inner .slide h1.title {
  font-size: 28px !important;
  font-weight: 600;
  margin: 0 0 6px;
  color: #111;
  display: block;
}
.vibe-preview-slide-inner .slide .subtitle,
.vibe-preview-slide-inner .slide h2.subtitle {
  font-size: 16px !important;
  color: #666;
  margin: 0 0 20px;
  display: block;
}
.vibe-preview-slide-inner .slide .frame {
  display: block;
}
.vibe-preview-slide-inner .slide .card-row {
  display: flex !important;
  gap: 16px;
}
.vibe-preview-slide-inner .slide .card-row.three-cards .card {
  flex: 1;
  min-width: 0;
}
.vibe-preview-slide-inner .slide .card {
  background: #F7F9FB;
  border-left: 4px solid #8E1E1E;
  padding: 18px;
  border-radius: 4px;
  display: block;
}
.vibe-preview-slide-inner .slide .card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.vibe-preview-slide-inner .slide .card-icon-circle {
  width: 40px;
  height: 40px;
  background: #F8E3E3;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.vibe-preview-slide-inner .slide .card-num {
  font-size: 24px;
  font-weight: 700;
  color: #888888;
}
.vibe-preview-slide-inner .slide .card h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #111;
}
.vibe-preview-slide-inner .slide .card p {
  font-size: 13px;
  line-height: 1.5;
  color: #444;
  margin: 0 0 12px;
}
.vibe-preview-slide-inner .slide .impact-box {
  background: #F8E3E3;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #8E1E1E;
  border-left: 3px solid #8E1E1E;
}
.vibe-preview-slide-inner .slide .footer,
.vibe-preview-slide-inner .slide footer.footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #888;
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid #E6E9EE;
}
`;

/**
 * VibePreview - Shows an example 3-card slide in all vibes side-by-side
 * Helps users compare and choose the right vibe for their presentation
 *
 * NEW: Vibes can now be "applied" via GPT regeneration for true visual reimagination
 */
export default function VibePreview({ onClose, onSelectVibe, onApplyVibe }) {
  const { state, actions } = useSlides();
  const vibes = useMemo(() => getAllVibes(), []);
  const [applyingVibe, setApplyingVibe] = useState(null);
  const [applyError, setApplyError] = useState(null);

  const combinedCSS = state.sharedCSS || '';
  const canApply = canRegenerateVibes(state.settings);
  const activeSlide = state.slides.find(s => s.id === state.activeSlideId);

  const handleSelectVibe = (vibeId) => {
    // Just select the vibe (for export hints, previews)
    if (onSelectVibe) {
      onSelectVibe(vibeId);
    }
    actions.setVibe(vibeId);
    onClose();
  };

  const handleApplyVibe = async (vibeId) => {
    if (!activeSlide) {
      setApplyError('No slide selected to apply vibe');
      return;
    }

    // Base vibe doesn't need regeneration
    if (isBaseVibe(vibeId)) {
      actions.setVibe(vibeId);
      onClose();
      return;
    }

    setApplyingVibe(vibeId);
    setApplyError(null);

    try {
      const result = await regenerateWithVibe(activeSlide.html, vibeId, state.settings);

      if (result.success) {
        // Update the slide with the regenerated HTML
        actions.updateSlide(state.activeSlideId, {
          html: result.html,
          vibeApplied: vibeId,
        });
        actions.setVibe(vibeId);
        onClose();
      } else {
        setApplyError(result.error || 'Failed to regenerate slide');
      }
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplyingVibe(null);
    }
  };

  return (
    <div className="vibe-preview-overlay" onClick={onClose}>
      <div className="vibe-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="vibe-preview-header">
          <h2>Choose a Vibe</h2>
          <p>
            <strong>Base</strong> uses clean default styling.
            Other vibes use AI to reimagine your slide's visual design.
          </p>
          {applyError && (
            <div className="vibe-apply-error">{applyError}</div>
          )}
          <button className="btn btn-ghost vibe-preview-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="vibe-preview-grid">
          {vibes.map(vibe => (
            <div
              key={vibe.id}
              className={`vibe-preview-card ${state.vibe === vibe.id ? 'active' : ''} ${applyingVibe === vibe.id ? 'applying' : ''}`}
            >
              <div className="vibe-preview-label">
                <span className="vibe-name">{vibe.name}</span>
                {vibe.isBase && <span className="vibe-base-badge">Solid Base</span>}
                {state.vibe === vibe.id && <span className="vibe-current">Current</span>}
              </div>
              <span className="vibe-desc">{vibe.description}</span>

              <div className="vibe-preview-slide-wrapper">
                <div
                  className={`vibe-preview-slide-container vibe-scope-${vibe.id}`}
                  data-vibe={vibe.id}
                >
                  <style>
                    {PREVIEW_BASE_CSS}
                    {combinedCSS}
                    {VIBE_AWARE_CSS}
                    {`.vibe-scope-${vibe.id} { ${getVibeCSS(vibe.id)} }`}
                    {`.vibe-scope-${vibe.id} .slide { ${getVibeCSS(vibe.id)} }`}
                  </style>
                  <div
                    className="vibe-preview-slide-inner"
                    dangerouslySetInnerHTML={{ __html: generateVibeExampleSlide(vibe.id) }}
                  />
                </div>
              </div>

              <div className="vibe-preview-actions">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleSelectVibe(vibe.id)}
                  title="Set as deck vibe (for export)"
                >
                  Select
                </button>
                {!vibe.isBase && canApply && activeSlide && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleApplyVibe(vibe.id)}
                    disabled={applyingVibe !== null}
                    title="Reimagine current slide with this vibe using AI"
                  >
                    {applyingVibe === vibe.id ? (
                      <>
                        <span className="vibe-loading-spinner"></span>
                        Applying...
                      </>
                    ) : (
                      'Apply to Slide'
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!canApply && (
          <div className="vibe-preview-footer">
            <p>
              <strong>Note:</strong> Configure API settings to enable AI-powered vibe application.
              Without API access, vibes affect export styling only.
            </p>
          </div>
        )}

        <style>{`
          .vibe-preview-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          .vibe-preview-modal {
            background: var(--bg-primary, #fff);
            border-radius: 12px;
            max-width: 1400px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }

          .vibe-preview-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border-color, #e5e7eb);
            position: relative;
          }

          .vibe-preview-header h2 {
            margin: 0 0 4px;
            font-size: 20px;
            font-weight: 600;
            color: var(--text-primary, #111);
          }

          .vibe-preview-header p {
            margin: 0;
            font-size: 14px;
            color: var(--text-secondary, #666);
          }

          .vibe-apply-error {
            margin-top: 12px;
            padding: 8px 12px;
            background: #fee2e2;
            border: 1px solid #fca5a5;
            border-radius: 6px;
            color: #dc2626;
            font-size: 13px;
          }

          .vibe-preview-close {
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 8px;
            border-radius: 8px;
          }

          .vibe-preview-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            padding: 20px;
          }

          @media (max-width: 1200px) {
            .vibe-preview-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 700px) {
            .vibe-preview-grid {
              grid-template-columns: 1fr;
            }
          }

          .vibe-preview-card {
            background: var(--bg-secondary, #f9fafb);
            border: 2px solid transparent;
            border-radius: 12px;
            padding: 16px;
            transition: all 0.2s ease;
          }

          .vibe-preview-card:hover {
            border-color: var(--color-accent, #8E1E1E);
          }

          .vibe-preview-card.active {
            border-color: var(--color-accent, #8E1E1E);
            background: linear-gradient(135deg, rgba(142, 30, 30, 0.05) 0%, rgba(142, 30, 30, 0.02) 100%);
          }

          .vibe-preview-card.applying {
            opacity: 0.7;
          }

          .vibe-preview-label {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            flex-wrap: wrap;
          }

          .vibe-name {
            font-weight: 600;
            font-size: 16px;
            color: var(--text-primary, #111);
          }

          .vibe-desc {
            font-size: 13px;
            color: var(--text-secondary, #666);
            margin-bottom: 12px;
            display: block;
          }

          .vibe-base-badge {
            background: #10b981;
            color: white;
            font-size: 10px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
          }

          .vibe-current {
            margin-left: auto;
            background: var(--color-accent, #8E1E1E);
            color: white;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .vibe-preview-slide-wrapper {
            border-radius: 8px;
            overflow: hidden;
            background: #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            aspect-ratio: 16 / 9;
          }

          .vibe-preview-slide-container {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }

          .vibe-preview-slide-inner {
            position: absolute;
            top: 0;
            left: 0;
            width: 960px;
            height: 540px;
            transform-origin: top left;
            transform: scale(0.35);
          }

          @media (min-width: 1200px) {
            .vibe-preview-slide-inner {
              transform: scale(0.38);
            }
          }

          @media (max-width: 700px) {
            .vibe-preview-slide-inner {
              transform: scale(0.32);
            }
          }

          .vibe-preview-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            justify-content: flex-end;
          }

          .vibe-preview-actions .btn-sm {
            padding: 6px 12px;
            font-size: 12px;
          }

          .vibe-preview-actions .btn-primary {
            background: var(--color-accent, #8E1E1E);
            color: white;
            border: none;
          }

          .vibe-preview-actions .btn-primary:hover:not(:disabled) {
            background: #a32020;
          }

          .vibe-preview-actions .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .vibe-loading-spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: vibe-spin 0.8s linear infinite;
            margin-right: 6px;
          }

          @keyframes vibe-spin {
            to { transform: rotate(360deg); }
          }

          .vibe-preview-footer {
            padding: 16px 24px;
            background: var(--bg-tertiary, #f3f4f6);
            border-top: 1px solid var(--border-color, #e5e7eb);
            font-size: 13px;
            color: var(--text-secondary, #666);
          }

          .vibe-preview-footer p {
            margin: 0;
          }
        `}</style>
      </div>
    </div>
  );
}
