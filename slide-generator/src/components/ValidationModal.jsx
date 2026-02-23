import { useState, useEffect, useRef } from 'react';
import { validateTemplate, captureSlideAsImage, VALIDATION_STEPS } from '../services/templateValidation';

const STEP_CONFIG = {
  [VALIDATION_STEPS.PROMPT_CONFORMANCE]: {
    icon: '🤖',
    title: 'AI Code Inspection',
    description: 'GPT analyzing HTML structure and JavaScript export code',
    activeMessage: 'GPT is inspecting your HTML and JS export code...',
  },
  [VALIDATION_STEPS.PPTX_EXECUTION]: {
    icon: '📄',
    title: 'PPTX File Generation',
    description: 'Actually generating a PPTX file to verify export works',
    activeMessage: 'Generating actual PPTX file to validate export...',
  },
  [VALIDATION_STEPS.VISUAL_INSPECTION]: {
    icon: '👁️',
    title: 'AI Visual Inspection',
    description: 'GPT analyzing screenshot to verify layout and quality',
    activeMessage: 'GPT is inspecting the slide image for quality and conformity...',
  },
};

export default function ValidationModal({ isOpen, onClose, template, settings, originalPrompt, onComplete }) {
  const [currentStep, setCurrentStep] = useState(null);
  const [stepResults, setStepResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [finalResults, setFinalResults] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  // Start validation when modal opens
  useEffect(() => {
    if (isOpen && template && settings && originalPrompt) {
      runValidation();
    }
    return () => {
      abortRef.current = true;
    };
  }, [isOpen]);

  const runValidation = async () => {
    setIsRunning(true);
    setStepResults([]);
    setFinalResults(null);
    setError(null);
    setScreenshot(null);
    abortRef.current = false;

    try {
      // First, capture screenshot for visual display
      setCurrentStep('capturing');
      const imageBase64 = await captureSlideAsImage(template.html);
      if (imageBase64) {
        setScreenshot(`data:image/png;base64,${imageBase64}`);
      }

      if (abortRef.current) return;

      // Run validation with progress callback
      const results = await validateTemplate(template, settings, {
        maxIterations: 3,
        generatePptx: true,
        originalPrompt,
        onProgress: (progress) => {
          if (abortRef.current) return;

          setCurrentStep(progress.step);

          if (progress.step === 'complete') {
            setStepResults(progress.results || []);
          } else if (progress.step !== 'generating' && progress.step !== 'capturing') {
            // Update step status
            const stepConfig = STEP_CONFIG[progress.step];
            if (stepConfig) {
              setStepResults(prev => {
                const existing = prev.find(s => s.step === progress.step);
                if (!existing) {
                  return [...prev, {
                    step: progress.step,
                    ...stepConfig,
                    status: 'running',
                    message: progress.message,
                  }];
                }
                return prev.map(s =>
                  s.step === progress.step
                    ? { ...s, status: 'running', message: progress.message }
                    : s
                );
              });
            }
          }
        },
      });

      if (abortRef.current) return;

      setFinalResults(results);
      setStepResults(results.stepResults || []);
      if (onComplete) {
        onComplete(results);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
      setCurrentStep(null);
    }
  };

  const handleClose = () => {
    abortRef.current = true;
    onClose();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed': return '✓';
      case 'failed': return '✗';
      case 'warning': return '⚠';
      case 'running': return '⟳';
      default: return '○';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'passed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'running': return '#6366f1';
      default: return '#666';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="validation-modal-overlay" onClick={handleClose}>
      <div className="validation-modal" onClick={e => e.stopPropagation()}>
        <div className="validation-modal-header">
          <h2>
            <span style={{ marginRight: 8 }}>🔍</span>
            Quality Inspection
          </h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <div className="validation-modal-body">
          {/* Left side - Screenshot */}
          <div className="validation-preview">
            <h3>Slide Preview</h3>
            <div className="validation-screenshot">
              {screenshot ? (
                <img src={screenshot} alt="Slide screenshot" />
              ) : (
                <div className="screenshot-placeholder">
                  {currentStep === 'capturing' ? (
                    <>
                      <span className="spinner" />
                      <span>Capturing screenshot...</span>
                    </>
                  ) : (
                    <span>No preview available</span>
                  )}
                </div>
              )}
            </div>
            {originalPrompt && (
              <div className="validation-prompt">
                <strong>Original Request:</strong>
                <p>"{originalPrompt}"</p>
              </div>
            )}
          </div>

          {/* Right side - Validation Steps */}
          <div className="validation-steps">
            <h3>Validation Steps</h3>

            {/* Active Progress Indicator */}
            {currentStep && currentStep !== 'complete' && currentStep !== 'capturing' && STEP_CONFIG[currentStep] && (
              <div className="active-progress-bar">
                <div className="progress-indicator">
                  <span className="spinner" />
                  <span className="progress-icon">{STEP_CONFIG[currentStep].icon}</span>
                </div>
                <div className="progress-text">
                  <strong>{STEP_CONFIG[currentStep].title}</strong>
                  <span>{STEP_CONFIG[currentStep].activeMessage}</span>
                </div>
              </div>
            )}

            {currentStep === 'generating' && (
              <div className="active-progress-bar">
                <div className="progress-indicator">
                  <span className="spinner" />
                  <span className="progress-icon">⚙️</span>
                </div>
                <div className="progress-text">
                  <strong>Generating PPTX Code</strong>
                  <span>Creating JavaScript export code for PowerPoint...</span>
                </div>
              </div>
            )}

            {/* Step 1: Prompt Conformance */}
            <div className={`validation-step ${stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE)?.status || ''}`}>
              <div className="step-header">
                <span className="step-number">1</span>
                <span className="step-icon">{STEP_CONFIG[VALIDATION_STEPS.PROMPT_CONFORMANCE].icon}</span>
                <span className="step-title">{STEP_CONFIG[VALIDATION_STEPS.PROMPT_CONFORMANCE].title}</span>
                {currentStep === VALIDATION_STEPS.PROMPT_CONFORMANCE && (
                  <span className="spinner" style={{ marginLeft: 'auto' }} />
                )}
                {stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE) && (
                  <span
                    className="step-status-icon"
                    style={{ color: getStatusColor(stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE)?.status) }}
                  >
                    {getStatusIcon(stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE)?.status)}
                  </span>
                )}
              </div>
              <p className="step-description">{STEP_CONFIG[VALIDATION_STEPS.PROMPT_CONFORMANCE].description}</p>
              {stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE) && (
                <div className="step-result">
                  <div className="step-score">
                    Score: <strong>{stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE)?.score || 0}%</strong>
                  </div>
                  {stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE)?.summary && (
                    <p className="step-summary">{stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE)?.summary}</p>
                  )}
                  {stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE)?.issues?.length > 0 && (
                    <ul className="step-issues">
                      {stepResults.find(s => s.step === VALIDATION_STEPS.PROMPT_CONFORMANCE)?.issues.map((issue, i) => (
                        <li key={i} className={issue.severity}>{issue.issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: PPTX Execution */}
            <div className={`validation-step ${stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION)?.status || ''}`}>
              <div className="step-header">
                <span className="step-number">2</span>
                <span className="step-icon">{STEP_CONFIG[VALIDATION_STEPS.PPTX_EXECUTION].icon}</span>
                <span className="step-title">{STEP_CONFIG[VALIDATION_STEPS.PPTX_EXECUTION].title}</span>
                {currentStep === VALIDATION_STEPS.PPTX_EXECUTION && (
                  <span className="spinner" style={{ marginLeft: 'auto' }} />
                )}
                {stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION) && (
                  <span
                    className="step-status-icon"
                    style={{ color: getStatusColor(stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION)?.status) }}
                  >
                    {getStatusIcon(stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION)?.status)}
                  </span>
                )}
              </div>
              <p className="step-description">{STEP_CONFIG[VALIDATION_STEPS.PPTX_EXECUTION].description}</p>
              {stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION) && (
                <div className="step-result">
                  <div className="step-score">
                    Score: <strong>{stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION)?.score || 0}%</strong>
                  </div>
                  {stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION)?.summary && (
                    <p className="step-summary">{stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION)?.summary}</p>
                  )}
                  {stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION)?.issues?.length > 0 && (
                    <ul className="step-issues">
                      {stepResults.find(s => s.step === VALIDATION_STEPS.PPTX_EXECUTION)?.issues.map((issue, i) => (
                        <li key={i} className={issue.severity}>{issue.issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Visual Inspection */}
            <div className={`validation-step ${stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.status || ''}`}>
              <div className="step-header">
                <span className="step-number">3</span>
                <span className="step-icon">{STEP_CONFIG[VALIDATION_STEPS.VISUAL_INSPECTION].icon}</span>
                <span className="step-title">{STEP_CONFIG[VALIDATION_STEPS.VISUAL_INSPECTION].title}</span>
                {currentStep === VALIDATION_STEPS.VISUAL_INSPECTION && (
                  <span className="spinner" style={{ marginLeft: 'auto' }} />
                )}
                {stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION) && (
                  <span
                    className="step-status-icon"
                    style={{ color: getStatusColor(stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.status) }}
                  >
                    {getStatusIcon(stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.status)}
                  </span>
                )}
              </div>
              <p className="step-description">{STEP_CONFIG[VALIDATION_STEPS.VISUAL_INSPECTION].description}</p>
              {stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION) && (
                <div className="step-result">
                  <div className="step-score">
                    Score: <strong>{stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.score || 0}%</strong>
                  </div>
                  {stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.summary && (
                    <p className="step-summary">{stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.summary}</p>
                  )}
                  {stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.note && (
                    <p className="step-note">{stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.note}</p>
                  )}
                  {stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.issues?.length > 0 && (
                    <ul className="step-issues">
                      {stepResults.find(s => s.step === VALIDATION_STEPS.VISUAL_INSPECTION)?.issues.map((issue, i) => (
                        <li key={i} className={issue.severity}>{issue.issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Error display */}
            {error && (
              <div className="validation-error">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Final Results */}
            {finalResults && (
              <div className="validation-final">
                <div
                  className="final-grade"
                  style={{ borderColor: finalResults.grade?.color || '#666' }}
                >
                  <span className="grade-letter" style={{ color: finalResults.grade?.color }}>
                    {finalResults.grade?.grade || '?'}
                  </span>
                  <span className="grade-label">{finalResults.grade?.label || 'Unknown'}</span>
                  <span className="grade-score">{finalResults.score || 0}%</span>
                </div>
                <div className="final-status">
                  {finalResults.status === 'passed' && <span className="status-badge passed">✓ All checks passed</span>}
                  {finalResults.status === 'failed' && <span className="status-badge failed">✗ Validation failed</span>}
                  {finalResults.status === 'warning' && <span className="status-badge warning">⚠ Passed with warnings</span>}
                </div>
                {finalResults.finalPptxCode && (
                  <div className="pptx-ready">
                    <span className="pptx-badge">✓ PPTX Code Ready</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="validation-modal-footer">
          {isRunning ? (
            <button className="btn btn-ghost" onClick={handleClose}>Cancel</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={runValidation}>Re-run Validation</button>
              <button className="btn btn-primary" onClick={handleClose}>Close</button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .validation-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .validation-modal {
          background: var(--bg, #1a1a2e);
          border-radius: 12px;
          width: 100%;
          max-width: 1000px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .validation-modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border, #333);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .validation-modal-header h2 {
          margin: 0;
          font-size: 20px;
          display: flex;
          align-items: center;
        }

        .validation-modal-body {
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .validation-preview h3,
        .validation-steps h3 {
          margin: 0 0 16px 0;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted, #888);
        }

        .active-progress-bar {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1));
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 10px;
          margin-bottom: 16px;
          animation: pulse-border 2s ease-in-out infinite;
        }

        @keyframes pulse-border {
          0%, 100% { border-color: rgba(99, 102, 241, 0.3); }
          50% { border-color: rgba(99, 102, 241, 0.6); }
        }

        .progress-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .progress-indicator .spinner {
          width: 20px;
          height: 20px;
          border-width: 2px;
        }

        .progress-icon {
          font-size: 24px;
        }

        .progress-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .progress-text strong {
          font-size: 14px;
          color: var(--text, #eee);
        }

        .progress-text span {
          font-size: 12px;
          color: var(--accent, #6366f1);
        }

        .validation-screenshot {
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 16/9;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .validation-screenshot img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .screenshot-placeholder {
          color: var(--text-muted, #888);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .validation-prompt {
          margin-top: 16px;
          padding: 12px;
          background: var(--zone2, #252540);
          border-radius: 6px;
          font-size: 13px;
        }

        .validation-prompt strong {
          color: var(--accent, #6366f1);
        }

        .validation-prompt p {
          margin: 8px 0 0 0;
          font-style: italic;
          color: var(--text-muted, #888);
        }

        .validation-step {
          padding: 16px;
          background: var(--zone2, #252540);
          border-radius: 8px;
          margin-bottom: 12px;
          border-left: 4px solid var(--border, #333);
          transition: border-color 0.3s;
        }

        .validation-step.passed { border-left-color: #28a745; }
        .validation-step.failed { border-left-color: #dc3545; }
        .validation-step.warning { border-left-color: #ffc107; }
        .validation-step.running { border-left-color: #6366f1; }

        .step-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .step-number {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--accent, #6366f1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .step-icon {
          font-size: 18px;
        }

        .step-title {
          font-weight: 600;
          font-size: 14px;
        }

        .step-status-icon {
          margin-left: auto;
          font-size: 18px;
          font-weight: 700;
        }

        .step-description {
          margin: 8px 0 0 34px;
          font-size: 12px;
          color: var(--text-muted, #888);
        }

        .step-result {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border, #333);
          margin-left: 34px;
        }

        .step-score {
          font-size: 13px;
          margin-bottom: 8px;
        }

        .step-summary {
          font-size: 12px;
          color: var(--text, #eee);
          margin: 8px 0;
        }

        .step-note {
          font-size: 11px;
          color: var(--text-muted, #888);
          font-style: italic;
          margin: 4px 0;
          padding: 4px 8px;
          background: rgba(99, 102, 241, 0.1);
          border-radius: 4px;
        }

        .step-issues {
          margin: 8px 0 0 0;
          padding-left: 16px;
          font-size: 11px;
        }

        .step-issues li {
          margin-bottom: 4px;
          color: var(--text-muted, #888);
        }

        .step-issues li.major { color: #dc3545; }
        .step-issues li.minor { color: #ffc107; }

        .validation-error {
          padding: 12px;
          background: rgba(220, 53, 69, 0.1);
          border: 1px solid #dc3545;
          border-radius: 6px;
          color: #dc3545;
          font-size: 13px;
        }

        .validation-final {
          margin-top: 20px;
          padding: 20px;
          background: var(--zone1, #1f1f35);
          border-radius: 8px;
          text-align: center;
        }

        .final-grade {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 32px;
          border: 3px solid;
          border-radius: 12px;
          margin-bottom: 12px;
        }

        .grade-letter {
          font-size: 48px;
          font-weight: 700;
          line-height: 1;
        }

        .grade-label {
          font-size: 14px;
          margin-top: 4px;
          color: var(--text-muted, #888);
        }

        .grade-score {
          font-size: 18px;
          font-weight: 600;
          margin-top: 8px;
        }

        .final-status {
          margin-top: 12px;
        }

        .status-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .status-badge.passed { background: rgba(40, 167, 69, 0.2); color: #28a745; }
        .status-badge.failed { background: rgba(220, 53, 69, 0.2); color: #dc3545; }
        .status-badge.warning { background: rgba(255, 193, 7, 0.2); color: #ffc107; }

        .pptx-ready {
          margin-top: 12px;
        }

        .pptx-badge {
          display: inline-block;
          padding: 4px 12px;
          background: rgba(40, 167, 69, 0.2);
          color: #28a745;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .validation-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border, #333);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .validation-modal-body {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
