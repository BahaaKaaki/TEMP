import { useState, useEffect } from 'react';
import { getLogs, clearLogs, LogLevel } from '../utils/debugLog';

export default function DebugPanel({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Refresh logs
  const refreshLogs = () => {
    const allLogs = getLogs();
    if (filter) {
      setLogs(allLogs.filter(l =>
        l.category.toLowerCase().includes(filter.toLowerCase()) ||
        l.level.toLowerCase().includes(filter.toLowerCase()) ||
        l.message.toLowerCase().includes(filter.toLowerCase())
      ).reverse());
    } else {
      setLogs([...allLogs].reverse());
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
      if (autoRefresh) {
        const interval = setInterval(refreshLogs, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, filter, autoRefresh]);

  if (!isOpen) return null;

  const getLevelColor = (level) => {
    switch (level) {
      case LogLevel.ERROR: return '#F44336';
      case LogLevel.WARN: return '#FF9800';
      case LogLevel.INFO: return '#2196F3';
      case LogLevel.DEBUG: return '#9E9E9E';
      default: return '#666';
    }
  };

  const formatTime = (timestamp) => {
    return timestamp.split('T')[1].split('.')[0];
  };

  return (
    <div className="debug-panel-overlay" onClick={onClose}>
      <div className="debug-panel" onClick={e => e.stopPropagation()}>
        <div className="debug-panel-header">
          <h3>🔍 AI Debug Log</h3>
          <div className="debug-panel-controls">
            <input
              type="text"
              placeholder="Filter logs..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="debug-filter"
            />
            <label className="debug-auto-refresh">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button onClick={refreshLogs} className="btn btn-sm">Refresh</button>
            <button onClick={() => { clearLogs(); refreshLogs(); }} className="btn btn-sm btn-ghost">Clear</button>
            <button onClick={onClose} className="debug-close">&times;</button>
          </div>
        </div>

        <div className="debug-panel-body">
          {logs.length === 0 ? (
            <div className="debug-empty">No logs yet. Make an AI request to see logs here.</div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`debug-log-entry ${expandedLog === idx ? 'expanded' : ''}`}
                onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
              >
                <div className="debug-log-header">
                  <span className="debug-time">{formatTime(log.timestamp)}</span>
                  <span
                    className="debug-level"
                    style={{ backgroundColor: getLevelColor(log.level) }}
                  >
                    {log.level}
                  </span>
                  <span className="debug-category">{log.category}</span>
                  <span className="debug-message">{log.message}</span>
                </div>
                {expandedLog === idx && log.data && (
                  <div className="debug-log-data">
                    <pre>{typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="debug-panel-footer">
          <span>{logs.length} log entries</span>
          <span className="debug-hint">Click a log entry to expand details</span>
        </div>
      </div>
    </div>
  );
}
