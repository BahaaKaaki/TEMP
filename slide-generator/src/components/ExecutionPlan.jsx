import { useState } from 'react';

// Execution Plan component - shows agent workflow progress
export default function ExecutionPlan({
  plan,
  currentStep = -1,
  onCancel = null,
  onApprove = null,
  compact = false
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!plan || !plan.steps || plan.steps.length === 0) {
    return null;
  }

  const { understanding, steps, estimatedSlides, requiresApproval } = plan;
  const isComplete = currentStep >= steps.length;
  const isRunning = currentStep >= 0 && !isComplete;

  // Action icons
  const getActionIcon = (action) => {
    switch (action) {
      case 'generate_storyline':
      case 'refine_storyline':
        return '📖';
      case 'generate_skeletons':
        return '🦴';
      case 'fill_skeletons':
        return '✏️';
      case 'edit_slides':
      case 'edit_all':
        return '🔧';
      case 'create_slides':
        return '➕';
      case 'answer_question':
        return '💬';
      default:
        return '▶️';
    }
  };

  // Step status
  const getStepStatus = (index) => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'running';
    return 'pending';
  };

  if (compact) {
    // Compact inline progress
    return (
      <div className="execution-plan-compact">
        <div className="plan-progress-bar">
          <div
            className="plan-progress-fill"
            style={{ width: `${Math.max(0, (currentStep / steps.length) * 100)}%` }}
          />
        </div>
        <span className="plan-status">
          {isComplete ? 'Complete' : isRunning ? `Step ${currentStep + 1}/${steps.length}` : 'Ready'}
        </span>
        <style>{`
          .execution-plan-compact {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 0;
          }
          .plan-progress-bar {
            flex: 1;
            height: 4px;
            background: var(--border-color, #e0e0e0);
            border-radius: 2px;
            overflow: hidden;
          }
          .plan-progress-fill {
            height: 100%;
            background: var(--primary-color, #3b82f6);
            transition: width 0.3s ease;
          }
          .plan-status {
            font-size: 11px;
            color: var(--text-muted, #666);
            white-space: nowrap;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="execution-plan">
      {/* Header */}
      <div
        className="plan-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="plan-header-left">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="plan-title">
            {isRunning ? 'Executing Plan' : isComplete ? 'Plan Complete' : 'Execution Plan'}
          </span>
          {estimatedSlides > 0 && (
            <span className="plan-slides-badge">
              {estimatedSlides} slide{estimatedSlides > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="plan-header-right">
          {isRunning && (
            <span className="plan-running-indicator">
              <span className="spinner" style={{ width: 12, height: 12 }} />
              Step {currentStep + 1}/{steps.length}
            </span>
          )}
          {isComplete && (
            <span className="plan-complete-indicator">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Done
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="plan-content">
          {/* Understanding */}
          {understanding && (
            <div className="plan-understanding">
              <strong>Understanding:</strong> {understanding}
            </div>
          )}

          {/* Steps */}
          <div className="plan-steps">
            {steps.map((step, index) => {
              const status = getStepStatus(index);
              return (
                <div key={index} className={`plan-step ${status}`}>
                  <div className="step-indicator">
                    {status === 'completed' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : status === 'running' ? (
                      <span className="spinner" style={{ width: 14, height: 14 }} />
                    ) : (
                      <span className="step-number">{index + 1}</span>
                    )}
                  </div>
                  <div className="step-content">
                    <div className="step-action">
                      <span className="step-icon">{getActionIcon(step.action)}</span>
                      <span className="step-action-name">{step.action.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="step-description">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Approval needed */}
          {requiresApproval && !isRunning && !isComplete && (
            <div className="plan-approval">
              <p>This plan requires approval before filling skeleton slides.</p>
              <div className="plan-approval-actions">
                {onApprove && (
                  <button className="btn btn-sm btn-primary" onClick={onApprove}>
                    Approve & Continue
                  </button>
                )}
                {onCancel && (
                  <button className="btn btn-sm btn-ghost" onClick={onCancel}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cancel button when running */}
          {isRunning && onCancel && (
            <div className="plan-actions">
              <button className="btn btn-sm btn-ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .execution-plan {
          background: var(--bg-secondary, #f8f9fa);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          margin: 12px 0;
          overflow: hidden;
        }

        .plan-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          cursor: pointer;
          user-select: none;
        }

        .plan-header:hover {
          background: rgba(0, 0, 0, 0.02);
        }

        .plan-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .plan-title {
          font-weight: 600;
          font-size: 13px;
        }

        .plan-slides-badge {
          background: var(--primary-color, #3b82f6);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
        }

        .plan-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .plan-running-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--primary-color, #3b82f6);
          font-size: 12px;
        }

        .plan-complete-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #10b981;
          font-size: 12px;
        }

        .plan-content {
          padding: 0 14px 14px;
        }

        .plan-understanding {
          padding: 10px 12px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 6px;
          font-size: 12px;
          color: var(--text-primary, #333);
          margin-bottom: 12px;
        }

        .plan-understanding strong {
          color: var(--primary-color, #3b82f6);
        }

        .plan-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .plan-step {
          display: flex;
          gap: 12px;
          padding: 10px 12px;
          background: white;
          border-radius: 6px;
          border-left: 3px solid var(--border-color, #e0e0e0);
          transition: all 0.2s;
        }

        .plan-step.running {
          border-left-color: var(--primary-color, #3b82f6);
          background: rgba(59, 130, 246, 0.05);
        }

        .plan-step.completed {
          border-left-color: #10b981;
          opacity: 0.7;
        }

        .plan-step.pending {
          border-left-color: var(--border-color, #e0e0e0);
        }

        .step-indicator {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .step-number {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--border-color, #e0e0e0);
          color: var(--text-muted, #666);
          border-radius: 50%;
          font-size: 11px;
          font-weight: 600;
        }

        .plan-step.completed .step-indicator svg {
          color: #10b981;
        }

        .step-content {
          flex: 1;
        }

        .step-action {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .step-icon {
          font-size: 14px;
        }

        .step-action-name {
          font-weight: 500;
          font-size: 12px;
          text-transform: capitalize;
        }

        .step-description {
          font-size: 11px;
          color: var(--text-muted, #666);
          line-height: 1.4;
        }

        .plan-approval {
          margin-top: 12px;
          padding: 12px;
          background: #fef3c7;
          border-radius: 6px;
          border: 1px solid #f59e0b;
        }

        .plan-approval p {
          margin: 0 0 10px 0;
          font-size: 12px;
          color: #92400e;
        }

        .plan-approval-actions {
          display: flex;
          gap: 8px;
        }

        .plan-actions {
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
}
