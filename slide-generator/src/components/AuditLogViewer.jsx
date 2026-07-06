import { useState, useEffect, useRef } from 'react';
import { getAuditLog, clearAuditLog, exportAuditLog } from '../utils/auditLog';

const ROLE_COLORS = {
  'manager:managerScope':       '#1565C0',
  'manager:managerPlanning':    '#0277BD',
  'consultant:consultantAnalyzing':  '#2E7D32',
  'consultant:consultantResearching':'#388E3C',
  'manager:managerCompiling':   '#6A1B9A',
  'manager:managerReviewing':   '#4A148C',
  'agent:managerScope':         '#1565C0',
  'agent:managerPlanning':      '#0277BD',
  'agent:consultantAnalyzing':  '#2E7D32',
  'agent:consultantResearching':'#388E3C',
  'agent:managerCompiling':     '#6A1B9A',
  'agent:managerReviewing':     '#4A148C',
  'router':                     '#E65100',
  'report':                     '#880E4F',
};

const ROLE_LABELS = {
  managerScope:          'Manager / Scope',
  managerPlanning:       'Manager / Planning',
  consultantAnalyzing:   'Consultant / Analyzing',
  consultantResearching: 'Consultant / Researching',
  managerCompiling:      'Manager / Compiling',
  managerReviewing:      'Manager / Reviewing',
  router:                'Router',
  report:                'Report',
};

function getRoleColor(role) {
  if (ROLE_COLORS[role]) return ROLE_COLORS[role];
  const parts = role.split(':');
  if (parts[1] && ROLE_COLORS['agent:' + parts[1]]) return ROLE_COLORS['agent:' + parts[1]];
  return '#757575';
}

function getRoleLabel(role) {
  if (role === 'report') return 'Report';
  if (role === 'router') return 'Router';
  const parts = role.split(':');
  const key = parts[1] || parts[0];
  return ROLE_LABELS[key] || role;
}

function getStatusBg(status) {
  if (status === 'error') return 'rgba(244,67,54,0.12)';
  if (status === 'retry') return 'rgba(255,152,0,0.12)';
  return 'transparent';
}

function formatDuration(ms) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AuditLogViewer({ isOpen, onClose }) {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bodyRef = useRef(null);

  const refresh = () => {
    let all = getAuditLog();
    if (roleFilter !== 'all') {
      all = all.filter(e => e.role.includes(roleFilter));
    }
    if (statusFilter !== 'all') {
      all = all.filter(e => e.status === statusFilter);
    }
    if (filter) {
      const f = filter.toLowerCase();
      all = all.filter(e =>
        e.role.toLowerCase().includes(f) ||
        e.action.toLowerCase().includes(f) ||
        e.model.toLowerCase().includes(f) ||
        (e.context || '').toLowerCase().includes(f) ||
        (e.query || '').toLowerCase().includes(f)
      );
    }
    setEntries([...all].reverse());
  };

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    if (autoRefresh) {
      const iv = setInterval(refresh, 1500);
      return () => clearInterval(iv);
    }
  }, [isOpen, filter, roleFilter, statusFilter, autoRefresh]);

  if (!isOpen) return null;

  const handleExport = () => {
    const blob = new Blob([exportAuditLog()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueRoles = [...new Set(getAuditLog().map(e => {
    const parts = e.role.split(':');
    return parts[1] || parts[0];
  }))];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '92%', maxWidth: 1100,
        height: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1, color: '#111' }}>
            Audit Log
          </h3>

          <input
            type="text" placeholder="Search..." value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              padding: '5px 10px', border: '1px solid #ddd', borderRadius: 6,
              fontSize: 12, width: 180, outline: 'none',
            }}
          />

          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12 }}>
            <option value="all">All roles</option>
            {uniqueRoles.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
            ))}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12 }}>
            <option value="all">All status</option>
            <option value="ok">OK</option>
            <option value="error">Error</option>
            <option value="retry">Retry</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Live
          </label>

          <button onClick={refresh} style={{
            padding: '4px 10px', border: '1px solid #ddd', borderRadius: 6,
            fontSize: 11, background: '#fff', cursor: 'pointer',
          }}>Refresh</button>

          <button onClick={handleExport} style={{
            padding: '4px 10px', border: '1px solid #ddd', borderRadius: 6,
            fontSize: 11, background: '#fff', cursor: 'pointer',
          }}>Export</button>

          <button onClick={() => { clearAuditLog(); refresh(); }} style={{
            padding: '4px 10px', border: '1px solid #ddd', borderRadius: 6,
            fontSize: 11, background: '#fff', cursor: 'pointer', color: '#dc3545',
          }}>Clear</button>

          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
            color: '#666', padding: '0 4px', lineHeight: 1,
          }}>&times;</button>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '70px 150px 1fr 140px 80px 70px 70px 60px',
          padding: '8px 20px',
          borderBottom: '2px solid #e0e0e0',
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
          color: '#888', flexShrink: 0,
        }}>
          <span>Time</span>
          <span>Role</span>
          <span>Action / Context</span>
          <span>Model</span>
          <span>Tokens</span>
          <span>Duration</span>
          <span>Temp</span>
          <span>Status</span>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ flex: 1, overflow: 'auto' }}>
          {entries.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
              No audit entries yet. Run an agent, chatbot, or report to see logs here.
            </div>
          ) : entries.map(entry => (
            <div key={entry.id}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 150px 1fr 140px 80px 70px 70px 60px',
                  padding: '7px 20px',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: 12, cursor: 'pointer',
                  background: getStatusBg(entry.status),
                  transition: 'background 0.15s',
                }}
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onMouseOver={e => { if (entry.status === 'ok') e.currentTarget.style.background = '#f8f8f8'; }}
                onMouseOut={e => { e.currentTarget.style.background = getStatusBg(entry.status); }}
              >
                <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 11 }}>
                  {entry.ts.split('T')[1]?.split('.')[0] || ''}
                </span>
                <span style={{
                  fontWeight: 600, fontSize: 11,
                  color: getRoleColor(entry.role),
                }}>
                  {getRoleLabel(entry.role)}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#333' }}>
                  <span style={{ fontWeight: 500 }}>{entry.action}</span>
                  {entry.query && (
                    <span style={{ color: '#888', marginLeft: 6 }}>
                      {entry.query.slice(0, 80)}{entry.query.length > 80 ? '...' : ''}
                    </span>
                  )}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.model}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>
                  {entry.tokens || '-'}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: entry.duration > 10000 ? '#E65100' : '#555' }}>
                  {formatDuration(entry.duration)}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>
                  {entry.temperature != null ? entry.temperature : '-'}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  color: entry.status === 'ok' ? '#4CAF50' : entry.status === 'error' ? '#F44336' : '#FF9800',
                }}>
                  {entry.status}
                </span>
              </div>

              {/* Expanded detail */}
              {expandedId === entry.id && (
                <div style={{
                  padding: '12px 20px 12px 90px',
                  background: '#fafafa', borderBottom: '1px solid #e0e0e0',
                  fontSize: 12, lineHeight: 1.6,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
                    <div><strong>Context:</strong> {entry.context || '-'}</div>
                    <div><strong>Model:</strong> {entry.model}</div>
                    <div><strong>Max Tokens (requested):</strong> {entry.tokens || '-'}</div>
                    <div><strong>Reasoning:</strong> {entry.reasoning || '-'}</div>
                    <div><strong>Temperature:</strong> {entry.temperature ?? '-'}</div>
                    <div><strong>Search:</strong> {entry.search ? 'Yes' : 'No'}</div>
                    <div><strong>Input Length:</strong> {entry.inputLen != null ? `${(entry.inputLen / 1000).toFixed(1)}K chars` : '-'}</div>
                    <div><strong>Output Length:</strong> {entry.outputLen != null ? `${(entry.outputLen / 1000).toFixed(1)}K chars` : '-'}</div>
                    <div><strong>Duration:</strong> {formatDuration(entry.duration)}</div>
                    <div><strong>Status:</strong> {entry.status}</div>
                  </div>
                  {entry.apiRequest && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 4 }}>
                      <strong style={{ fontSize: 11, color: '#4338ca' }}>Actual API Request:</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 16px', marginTop: 4, fontSize: 11, fontFamily: 'monospace' }}>
                        <div>model: <strong>{entry.apiRequest.model || '-'}</strong></div>
                        <div>max_tokens: <strong>{entry.apiRequest.max_tokens ?? 'not set'}</strong></div>
                        <div>reasoning: <strong>{entry.apiRequest.reasoning ?? 'none'}</strong></div>
                        <div>temperature: <strong>{entry.apiRequest.temperature ?? 'not set'}</strong></div>
                        <div>json_mode: <strong>{entry.apiRequest.json_mode ? 'yes' : 'no'}</strong></div>
                        <div>endpoint: <strong>{entry.apiRequest.endpoint || '-'}</strong></div>
                      </div>
                    </div>
                  )}
                  {entry.error && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(244,67,54,0.08)', borderRadius: 4, color: '#c62828', fontSize: 11, fontFamily: 'monospace' }}>
                      {entry.error}
                    </div>
                  )}
                  {entry.query && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Query:</strong>
                      <div style={{ marginTop: 4, padding: '6px 10px', background: '#f0f0f0', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', maxHeight: 120, overflow: 'auto' }}>
                        {entry.query}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 20px', borderTop: '1px solid #e0e0e0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11, color: '#888', flexShrink: 0,
        }}>
          <span>{entries.length} entries{roleFilter !== 'all' ? ` (filtered by ${ROLE_LABELS[roleFilter] || roleFilter})` : ''}</span>
          <span>Click a row to expand details</span>
        </div>
      </div>
    </div>
  );
}
