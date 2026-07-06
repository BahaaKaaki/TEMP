/**
 * AgentTaskList Component
 *
 * Displays the dynamic task list during agentic execution.
 * Similar to Claude Code's todo list UI.
 */

import React, { useState, useEffect, useRef } from 'react';
import { TaskStatus } from '../services/agentTaskSystem';

// Status icons
const StatusIcon = ({ status }) => {
  const icons = {
    [TaskStatus.PENDING]: (
      <svg className="agent-task-icon pending" viewBox="0 0 20 20" fill="currentColor">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    [TaskStatus.IN_PROGRESS]: (
      <svg className="agent-task-icon in-progress" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="50" strokeDashoffset="0">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 10 10"
            to="360 10 10"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    ),
    [TaskStatus.COMPLETED]: (
      <svg className="agent-task-icon completed" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    [TaskStatus.FAILED]: (
      <svg className="agent-task-icon failed" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    [TaskStatus.SKIPPED]: (
      <svg className="agent-task-icon skipped" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
      </svg>
    ),
  };

  return icons[status] || icons[TaskStatus.PENDING];
};

// Progress bar component
const ProgressBar = ({ progress }) => {
  const percentage = progress?.percentage || 0;

  return (
    <div className="agent-progress-bar-container">
      <div className="agent-progress-bar">
        <div
          className="agent-progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="agent-progress-text">
        {progress?.completed || 0}/{progress?.total || 0} tasks
      </span>
    </div>
  );
};

// Single task item
const TaskItem = ({ task, isExpanded, onToggle }) => {
  const statusClasses = {
    [TaskStatus.PENDING]: 'pending',
    [TaskStatus.IN_PROGRESS]: 'in-progress',
    [TaskStatus.COMPLETED]: 'completed',
    [TaskStatus.FAILED]: 'failed',
    [TaskStatus.SKIPPED]: 'skipped',
  };

  const displayText = task.status === TaskStatus.IN_PROGRESS
    ? task.activeForm
    : task.content;

  return (
    <div className={`agent-task-item ${statusClasses[task.status] || ''}`}>
      <div className="agent-task-main" onClick={() => onToggle(task.id)}>
        <StatusIcon status={task.status} />
        <span className="agent-task-content">{displayText}</span>
        {task.error && (
          <span className="agent-task-error-badge" title={task.error}>!</span>
        )}
      </div>

      {isExpanded && (
        <div className="agent-task-details">
          {task.error && (
            <div className="agent-task-error">
              <strong>Error:</strong> {task.error}
            </div>
          )}
          {task.result && typeof task.result === 'string' && (
            <div className="agent-task-result">
              <strong>Result:</strong> {task.result.slice(0, 200)}
            </div>
          )}
          {task.retryCount > 0 && (
            <div className="agent-task-retry">
              Retry {task.retryCount}/{task.maxRetries}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main component
export default function AgentTaskList({ taskState, onStop, isCompact = false }) {
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const listRef = useRef(null);

  // Auto-scroll to current task
  useEffect(() => {
    if (listRef.current && taskState?.currentTaskId) {
      const currentTaskEl = listRef.current.querySelector('.in-progress');
      if (currentTaskEl) {
        currentTaskEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [taskState?.currentTaskId]);

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  if (!taskState || !taskState.tasks || taskState.tasks.length === 0) {
    return null;
  }

  const { tasks, progress, currentIteration, maxIterations } = taskState;
  const isRunning = tasks.some(t => t.status === TaskStatus.IN_PROGRESS);

  return (
    <div className={`agent-task-list ${isCompact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="agent-task-header">
        <div className="agent-task-title">
          {isRunning ? (
            <>
              <span className="agent-spinner" />
              Working...
            </>
          ) : progress?.percentage === 100 ? (
            '✅ Complete'
          ) : (
            '📋 Tasks'
          )}
        </div>
        {isRunning && onStop && (
          <button className="agent-stop-btn" onClick={onStop} title="Stop execution">
            ⏹ Stop
          </button>
        )}
      </div>

      {/* Progress bar */}
      <ProgressBar progress={progress} />

      {/* Iteration counter (if running) */}
      {isRunning && currentIteration > 0 && (
        <div className="agent-iteration-counter">
          Step {currentIteration}/{maxIterations}
        </div>
      )}

      {/* Task list */}
      <div className="agent-task-items" ref={listRef}>
        {tasks.map((task, index) => (
          <TaskItem
            key={task.id}
            task={task}
            isExpanded={expandedTasks.has(task.id)}
            onToggle={toggleTask}
          />
        ))}
      </div>
    </div>
  );
}

// Styles (inject into document)
const styles = `
.agent-task-list {
  background: var(--surface, #f8f9fa);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  font-size: 13px;
}

.agent-task-list.compact {
  padding: 8px;
  font-size: 12px;
}

.agent-task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--heading, #1a1a1a);
}

.agent-task-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border, #e0e0e0);
  border-top-color: var(--accent, #8B1538);
  border-radius: 50%;
  animation: agent-spin 0.8s linear infinite;
}

@keyframes agent-spin {
  to { transform: rotate(360deg); }
}

.agent-stop-btn {
  background: var(--accent, #8B1538);
  color: white;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.agent-stop-btn:hover {
  opacity: 0.9;
}

.agent-progress-bar-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.agent-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--border, #e0e0e0);
  border-radius: 3px;
  overflow: hidden;
}

.agent-progress-bar-fill {
  height: 100%;
  background: var(--accent, #8B1538);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.agent-progress-text {
  font-size: 11px;
  color: var(--muted, #666);
  white-space: nowrap;
}

.agent-iteration-counter {
  font-size: 10px;
  color: var(--muted, #666);
  margin-bottom: 8px;
  text-align: center;
}

.agent-task-items {
  max-height: 300px;
  overflow-y: auto;
}

.agent-task-item {
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  background: white;
  transition: background 0.2s;
}

.agent-task-item.in-progress {
  background: var(--accent-soft, rgba(139, 21, 56, 0.1));
  border-left: 3px solid var(--accent, #8B1538);
}

.agent-task-item.completed {
  opacity: 0.7;
}

.agent-task-item.failed {
  background: rgba(220, 53, 69, 0.1);
  border-left: 3px solid #dc3545;
}

.agent-task-item.skipped {
  opacity: 0.5;
}

.agent-task-main {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.agent-task-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.agent-task-icon.pending { color: var(--muted, #666); }
.agent-task-icon.in-progress { color: var(--accent, #8B1538); }
.agent-task-icon.completed { color: #28a745; }
.agent-task-icon.failed { color: #dc3545; }
.agent-task-icon.skipped { color: #6c757d; }

.agent-task-content {
  flex: 1;
  line-height: 1.4;
}

.agent-task-error-badge {
  background: #dc3545;
  color: white;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

.agent-task-details {
  margin-top: 6px;
  padding: 6px 8px 6px 24px;
  font-size: 11px;
  color: var(--muted, #666);
  border-top: 1px solid var(--border, #e0e0e0);
}

.agent-task-error {
  color: #dc3545;
}

.agent-task-result {
  white-space: pre-wrap;
  word-break: break-word;
}

.agent-task-retry {
  font-style: italic;
}
`;

// Inject styles once
if (typeof document !== 'undefined') {
  const styleId = 'agent-task-list-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}
