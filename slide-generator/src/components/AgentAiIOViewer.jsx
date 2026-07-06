/**
 * AgentAiIOViewer Component
 *
 * Displays transparent AI input/output logs during agentic execution.
 * Shows what the agent is doing, what it's sending to the AI, and what it receives.
 */

import React, { useState, useEffect, useRef } from 'react';

// Format duration in a human-readable way
const formatDuration = (ms) => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// Format timestamp
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Truncate long strings
const truncate = (str, maxLen = 200) => {
  if (!str) return '';
  if (typeof str !== 'string') str = JSON.stringify(str);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
};

// Type icons and colors
const getTypeInfo = (type) => {
  const types = {
    agent_reasoning: {
      icon: '🧠',
      label: 'Thinking',
      color: '#6c5ce7',
    },
    tool_execution: {
      icon: '🔧',
      label: 'Tool',
      color: '#00b894',
    },
    tool_execution_error: {
      icon: '❌',
      label: 'Tool Error',
      color: '#d63031',
    },
    agent_reasoning_error: {
      icon: '⚠️',
      label: 'Error',
      color: '#fdcb6e',
    },
    web_search: {
      icon: '🔍',
      label: 'Search',
      color: '#0984e3',
    },
    fetch_webpage: {
      icon: '🌐',
      label: 'Fetch',
      color: '#00cec9',
    },
  };

  return types[type] || {
    icon: '📝',
    label: type || 'Log',
    color: '#636e72',
  };
};

// Single log entry component
const LogEntry = ({ entry, isExpanded, onToggle }) => {
  const typeInfo = getTypeInfo(entry.type || entry.tool);

  return (
    <div
      className={`agent-io-entry ${isExpanded ? 'expanded' : ''}`}
      style={{ borderLeftColor: typeInfo.color }}
    >
      <div className="agent-io-header" onClick={onToggle}>
        <span className="agent-io-icon">{typeInfo.icon}</span>
        <span className="agent-io-label" style={{ color: typeInfo.color }}>
          {entry.tool || typeInfo.label}
        </span>
        {entry.step && (
          <span className="agent-io-step">{entry.step}</span>
        )}
        <span className="agent-io-spacer" />
        {entry.model && (
          <span className="agent-io-model">{entry.model}</span>
        )}
        <span className="agent-io-time">{formatTime(entry.timestamp)}</span>
        {entry.duration && (
          <span className="agent-io-duration">{formatDuration(entry.duration)}</span>
        )}
        <span className="agent-io-toggle">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="agent-io-details">
          {/* Call parameters */}
          <div className="agent-io-params">
            {entry.model && <span className="agent-io-param"><b>Model:</b> {entry.model}</span>}
            {entry.maxTokens && <span className="agent-io-param"><b>Max tokens:</b> {entry.maxTokens}</span>}
            {entry.temperature != null && <span className="agent-io-param"><b>Temp:</b> {entry.temperature}</span>}
            {entry.searchEnabled != null && <span className="agent-io-param"><b>Search:</b> {entry.searchEnabled ? 'on' : 'off'}</span>}
            {entry.reasoningEffort && <span className="agent-io-param"><b>Reasoning:</b> {entry.reasoningEffort}</span>}
            {entry.useDeep && <span className="agent-io-param"><b>Deep model:</b> yes</span>}
            {entry.attempt > 1 && <span className="agent-io-param"><b>Attempt:</b> {entry.attempt}</span>}
            {entry.timeout && <span className="agent-io-param"><b>Timeout:</b> {formatDuration(entry.timeout)}</span>}
            {entry.duration && <span className="agent-io-param"><b>Duration:</b> {formatDuration(entry.duration)}</span>}
          </div>

          {entry.input && (
            <div className="agent-io-section">
              <div className="agent-io-section-label">Input:</div>
              <pre className="agent-io-code">
                {typeof entry.input === 'string'
                  ? entry.input
                  : JSON.stringify(entry.input, null, 2)}
              </pre>
            </div>
          )}

          {entry.output && (
            <div className="agent-io-section">
              <div className="agent-io-section-label">Output:</div>
              <pre className="agent-io-code">
                {typeof entry.output === 'string'
                  ? entry.output
                  : JSON.stringify(entry.output, null, 2)}
              </pre>
            </div>
          )}

          {entry.error && (
            <div className="agent-io-section error">
              <div className="agent-io-section-label">Error:</div>
              <pre className="agent-io-code error">{entry.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Summary stats component
const LogStats = ({ logs }) => {
  const stats = {
    total: logs.length,
    thinking: logs.filter(l => l.type === 'agent_reasoning').length,
    tools: logs.filter(l => l.type === 'tool_execution').length,
    errors: logs.filter(l => l.type?.includes('error') || l.error).length,
    totalDuration: logs.reduce((sum, l) => sum + (l.duration || 0), 0),
  };

  return (
    <div className="agent-io-stats">
      <span title="Total calls">📊 {stats.total}</span>
      <span title="AI reasoning">🧠 {stats.thinking}</span>
      <span title="Tool executions">🔧 {stats.tools}</span>
      {stats.errors > 0 && <span title="Errors" className="error">❌ {stats.errors}</span>}
      <span title="Total time">⏱️ {formatDuration(stats.totalDuration)}</span>
    </div>
  );
};

// Main component
export default function AgentAiIOViewer({
  aiIOLog = [],
  isCollapsed = true,
  onToggleCollapsed,
  maxHeight = 400,
}) {
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [filter, setFilter] = useState('all'); // 'all', 'thinking', 'tools', 'errors'
  const containerRef = useRef(null);

  // Auto-scroll to latest entry
  useEffect(() => {
    if (containerRef.current && !isCollapsed) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [aiIOLog.length, isCollapsed]);

  const toggleEntry = (index) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Filter logs
  const filteredLogs = aiIOLog.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'thinking') return log.type === 'agent_reasoning';
    if (filter === 'tools') return log.type === 'tool_execution' || log.tool;
    if (filter === 'errors') return log.type?.includes('error') || log.error;
    return true;
  });

  if (aiIOLog.length === 0) {
    return null;
  }

  return (
    <div className={`agent-io-viewer ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="agent-io-viewer-header" onClick={onToggleCollapsed}>
        <span className="agent-io-viewer-title">
          🔍 AI Activity Log
        </span>
        <LogStats logs={aiIOLog} />
        <span className="agent-io-viewer-toggle">
          {isCollapsed ? '▶' : '▼'}
        </span>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <>
          {/* Filter buttons */}
          <div className="agent-io-filters">
            {['all', 'thinking', 'tools', 'errors'].map(f => (
              <button
                key={f}
                className={`agent-io-filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' && '📋 All'}
                {f === 'thinking' && '🧠 Thinking'}
                {f === 'tools' && '🔧 Tools'}
                {f === 'errors' && '❌ Errors'}
              </button>
            ))}
          </div>

          {/* Log entries */}
          <div
            className="agent-io-entries"
            ref={containerRef}
            style={{ maxHeight }}
          >
            {filteredLogs.map((entry, index) => (
              <LogEntry
                key={entry.timestamp + '-' + index}
                entry={entry}
                isExpanded={expandedEntries.has(index)}
                onToggle={() => toggleEntry(index)}
              />
            ))}

            {filteredLogs.length === 0 && (
              <div className="agent-io-empty">
                No {filter === 'all' ? 'activity' : filter} logs yet
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Styles
const styles = `
.agent-io-viewer {
  background: var(--surface, #f8f9fa);
  border-radius: 8px;
  margin: 8px 0;
  font-size: 12px;
  border: 1px solid var(--border, #e0e0e0);
  overflow: hidden;
}

.agent-io-viewer.collapsed {
  border-radius: 4px;
}

.agent-io-viewer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--surface-alt, #eee);
  cursor: pointer;
  user-select: none;
}

.agent-io-viewer-header:hover {
  background: var(--border, #e0e0e0);
}

.agent-io-viewer-title {
  font-weight: 600;
  color: var(--heading, #1a1a1a);
}

.agent-io-stats {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--muted, #666);
  margin-left: auto;
}

.agent-io-stats .error {
  color: #d63031;
}

.agent-io-viewer-toggle {
  color: var(--muted, #666);
  font-size: 10px;
}

.agent-io-filters {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--border, #e0e0e0);
}

.agent-io-filter-btn {
  background: white;
  border: 1px solid var(--border, #e0e0e0);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.agent-io-filter-btn:hover {
  background: var(--surface, #f8f9fa);
}

.agent-io-filter-btn.active {
  background: var(--accent, #8B1538);
  color: white;
  border-color: var(--accent, #8B1538);
}

.agent-io-entries {
  overflow-y: auto;
  padding: 8px;
}

.agent-io-entry {
  background: white;
  border-radius: 4px;
  margin-bottom: 6px;
  border-left: 3px solid #636e72;
  overflow: hidden;
}

.agent-io-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
}

.agent-io-header:hover {
  background: var(--surface, #f8f9fa);
}

.agent-io-icon {
  font-size: 14px;
}

.agent-io-label {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
}

.agent-io-step {
  font-size: 11px;
  color: var(--heading, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

.agent-io-model {
  font-size: 10px;
  font-weight: 600;
  color: var(--heading, #1a1a1a);
  background: var(--surface, #f0f0f0);
  border: 1px solid var(--border, #d0d0d0);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.agent-io-spacer {
  flex: 1;
}

.agent-io-time {
  color: var(--muted, #666);
  font-size: 10px;
}

.agent-io-duration {
  background: var(--surface, #f8f9fa);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  color: var(--muted, #666);
}

.agent-io-toggle {
  color: var(--muted, #666);
  font-size: 10px;
}

.agent-io-details {
  padding: 0 10px 10px 10px;
  border-top: 1px solid var(--border, #e0e0e0);
}

.agent-io-params {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 8px 0 4px 0;
  font-size: 11px;
  color: var(--heading, #1a1a1a);
}

.agent-io-param {
  white-space: nowrap;
}

.agent-io-param b {
  color: var(--muted, #666);
  font-weight: 500;
  margin-right: 3px;
}

.agent-io-section {
  margin-top: 8px;
}

.agent-io-section-label {
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  color: var(--muted, #666);
  margin-bottom: 4px;
}

.agent-io-code {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.agent-io-code.error {
  background: #2d1515;
  color: #ff6b6b;
}

.agent-io-section.error .agent-io-section-label {
  color: #d63031;
}

.agent-io-empty {
  text-align: center;
  padding: 20px;
  color: var(--muted, #666);
  font-style: italic;
}
`;

// Inject styles once
if (typeof document !== 'undefined') {
  const styleId = 'agent-io-viewer-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}
