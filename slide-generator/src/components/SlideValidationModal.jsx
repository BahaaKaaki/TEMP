import { useState } from 'react';
import { validateSlide } from '../services/templateValidation';

export default function SlideValidationModal({ slide, slideIndex, settings, onClose, onUpdateSlide }) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResults(null);
    setError('');

    try {
      const results = await validateSlide(slide, slideIndex, settings, {
        maxIterations: 3,
        generatePptx: !!settings?.apiKey,
        onProgress: (progress) => {
          setValidationProgress(progress);
        },
      });

      setValidationResults(results);
    } catch (err) {
      setError(`Validation error: ${err.message}`);
    } finally {
      setIsValidating(false);
      setValidationProgress(null);
    }
  };

  const handleApplyPptxCode = () => {
    if (validationResults?.finalPptxCode) {
      onUpdateSlide({ pptxRendererCode: validationResults.finalPptxCode });
      onClose();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'passed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'warning': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'passed': return '#d4edda';
      case 'failed': return '#f8d7da';
      case 'warning': return '#fff3cd';
      default: return '#e9ecef';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="validation-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          width: 500,
          maxWidth: '95vw',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #e9ecef',
          background: '#f8f9fa',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Validate Slide #{slideIndex + 1}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#666' }}>
              {slide.title || 'Untitled'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 4,
              color: '#666',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16 }}>
          {/* Slide Preview */}
          <div style={{
            marginBottom: 16,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: 160,
              height: 90,
              background: 'white',
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              border: '1px solid #dee2e6',
              flexShrink: 0,
            }}>
              <div style={{
                transform: 'scale(0.167)',
                transformOrigin: 'top left',
                width: 960,
                height: 540,
              }}>
                <div dangerouslySetInnerHTML={{ __html: slide.html }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                <div><strong>Type:</strong> {slide.type}</div>
                <div><strong>PPTX Code:</strong> {slide.pptxRendererCode ? 'Yes' : 'No'}</div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleValidate}
                disabled={isValidating}
              >
                {isValidating ? 'Validating...' : validationResults ? 'Re-validate' : 'Run Validation'}
              </button>
            </div>
          </div>

          {/* Progress */}
          {validationProgress && !validationResults && (
            <div style={{
              padding: '10px 14px',
              background: '#e3f2fd',
              borderRadius: 6,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
            }}>
              <span className="spinner" style={{ width: 14, height: 14 }} />
              <span style={{ color: '#1565c0' }}>{validationProgress.message}</span>
            </div>
          )}

          {/* Results */}
          {validationResults && (
            <>
              {/* Score Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
                padding: '10px 14px',
                background: getStatusBg(validationResults.status),
                borderRadius: 6,
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'white',
                  border: `3px solid ${validationResults.qualityGrade?.color || '#666'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: validationResults.qualityGrade?.color || '#333',
                  }}>
                    {validationResults.qualityGrade?.grade || '?'}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {validationResults.qualityGrade?.label} ({validationResults.qualityScore}%)
                  </div>
                </div>
                {validationResults.finalPptxCode && (
                  <span style={{
                    background: '#28a745',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                  }}>
                    PPTX
                  </span>
                )}
              </div>

              {/* Step Results */}
              {validationResults.stepResults?.map((step, idx) => (
                <div
                  key={step.step || idx}
                  style={{
                    padding: '8px 12px',
                    marginBottom: 6,
                    background: getStatusBg(step.status),
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{step.icon || '•'}</span>
                    <strong>{step.name}</strong>
                    <span style={{
                      marginLeft: 'auto',
                      color: getStatusColor(step.status),
                      fontWeight: 600,
                    }}>
                      {step.score !== undefined ? `${step.score}%` : step.status}
                    </span>
                  </div>
                  {step.summary && (
                    <div style={{ marginTop: 4, color: '#555', fontStyle: 'italic' }}>
                      {step.summary}
                    </div>
                  )}
                  {step.issues && step.issues.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                      {step.issues.slice(0, 3).map((issue, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: '#dc3545' }}>⚠</span>
                          <span>{typeof issue === 'string' ? issue : issue.issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#f8d7da',
              color: '#721c24',
              borderRadius: 6,
              fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid #e9ecef',
          background: '#f8f9fa',
        }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
          {validationResults?.finalPptxCode && (
            <button className="btn btn-primary btn-sm" onClick={handleApplyPptxCode}>
              Apply PPTX Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
