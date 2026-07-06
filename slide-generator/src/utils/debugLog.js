// Debug logging utility for AI operations
// Logs are stored in memory and can be viewed via console or exported

const MAX_LOGS = 100;
const logs = [];

export const LogLevel = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG',
};

export function debugLog(level, category, message, data = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data: data ? JSON.stringify(data, null, 2).substring(0, 2000) : null,
  };

  logs.push(entry);

  // Keep only last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Also log to console with color coding
  const prefix = `[${entry.timestamp.split('T')[1].split('.')[0]}] [${category}]`;
  const style = {
    INFO: 'color: #2196F3',
    WARN: 'color: #FF9800',
    ERROR: 'color: #F44336; font-weight: bold',
    DEBUG: 'color: #9E9E9E',
  }[level] || '';

  if (level === 'ERROR') {
    console.error(`%c${prefix} ${message}`, style, data || '');
  } else if (level === 'WARN') {
    console.warn(`%c${prefix} ${message}`, style, data || '');
  } else {
    console.log(`%c${prefix} ${message}`, style, data || '');
  }

  return entry;
}

export function getLogs(filter = null) {
  if (!filter) return [...logs];
  return logs.filter(log =>
    log.category === filter ||
    log.level === filter ||
    log.message.toLowerCase().includes(filter.toLowerCase())
  );
}

export function clearLogs() {
  logs.length = 0;
}

export function exportLogs() {
  return JSON.stringify(logs, null, 2);
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.aiDebugLogs = {
    get: getLogs,
    clear: clearLogs,
    export: exportLogs,
    show: (filter) => {
      const filtered = getLogs(filter);
      console.table(filtered.map(l => ({
        time: l.timestamp.split('T')[1].split('.')[0],
        level: l.level,
        category: l.category,
        message: l.message.substring(0, 100),
      })));
      return filtered;
    },
    showLast: (n = 10) => {
      const last = logs.slice(-n);
      last.forEach(l => {
        console.log(`[${l.level}] ${l.category}: ${l.message}`);
        if (l.data) console.log(l.data);
      });
    },
  };
  console.log('%c[Debug] AI logs available via window.aiDebugLogs.show() or window.aiDebugLogs.showLast(10)', 'color: #9C27B0');
}
