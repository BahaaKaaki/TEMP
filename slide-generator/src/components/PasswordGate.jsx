import { useState, useEffect } from 'react';

const STORAGE_KEY = 'sg_auth_token';
const ENV_PASSWORD = import.meta.env.VITE_ACCESS_PASSWORD;

// If no password is set in environment, skip the gate entirely
function isGateEnabled() {
  return !!ENV_PASSWORD;
}

function isAuthenticated() {
  if (!isGateEnabled()) return true;
  return localStorage.getItem(STORAGE_KEY) === 'authenticated';
}

export default function PasswordGate({ children }) {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Skip gate if no password configured
  if (!isGateEnabled()) return children;
  if (authed) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ENV_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'authenticated');
      setAuthed(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0a0a0f', color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 12,
        padding: '40px 36px', width: 360, textAlign: 'center',
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>Edwin AI</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#888' }}>Enter the access password to continue</p>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14,
            background: '#1e1e2e', border: '1px solid #333', borderRadius: 6,
            color: '#e0e0e0', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ color: '#f44', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button type="submit" style={{
          marginTop: 16, width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 600,
          background: '#c8102e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer',
        }}>
          Enter
        </button>
      </form>
    </div>
  );
}
