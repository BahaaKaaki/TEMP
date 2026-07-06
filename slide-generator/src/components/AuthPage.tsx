import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiRequestError } from '../services/apiClient';

type AuthMode = 'login' | 'register' | 'forgot';

interface AuthPageProps {
  onClose?: () => void;
  initialMode?: AuthMode;
}

export default function AuthPage({ onClose, initialMode = 'login' }: AuthPageProps) {
  const { login, register, isLoading, isBackendAvailable } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose?.();
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }
        await register({ email, password, firstName: firstName || undefined, lastName: lastName || undefined });
        onClose?.();
      } else if (mode === 'forgot') {
        // TODO: Implement forgot password
        setSuccess('If an account exists with this email, you will receive a password reset link.');
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  if (!isBackendAvailable) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Backend Unavailable</h2>
          <p className="auth-hint">
            The authentication server is not available. You can continue using the app in offline mode with local storage.
          </p>
          {onClose && (
            <button type="button" className="auth-btn secondary" onClick={onClose}>
              Continue Offline
            </button>
          )}
        </div>
        <style>{authStyles}</style>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h2>
            {mode === 'login' && 'Sign In'}
            {mode === 'register' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login' && 'Welcome back! Sign in to your account.'}
            {mode === 'register' && 'Create a new account to get started.'}
            {mode === 'forgot' && 'Enter your email to reset your password.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          {mode === 'register' && (
            <div className="auth-row">
              <div className="auth-field">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {mode !== 'forgot' && (
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
          )}

          <button type="submit" className="auth-btn primary" disabled={isLoading}>
            {isLoading ? 'Loading...' : (
              mode === 'login' ? 'Sign In' :
              mode === 'register' ? 'Create Account' :
              'Send Reset Link'
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'login' && (
            <>
              <button type="button" className="auth-link" onClick={() => { setMode('forgot'); setError(null); }}>
                Forgot password?
              </button>
              <p>
                Don't have an account?{' '}
                <button type="button" className="auth-link" onClick={() => { setMode('register'); setError(null); }}>
                  Sign up
                </button>
              </p>
            </>
          )}
          {mode === 'register' && (
            <p>
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => { setMode('login'); setError(null); }}>
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              Remember your password?{' '}
              <button type="button" className="auth-link" onClick={() => { setMode('login'); setError(null); setSuccess(null); }}>
                Sign in
              </button>
            </p>
          )}
        </div>

        {onClose && (
          <button type="button" className="auth-close" onClick={onClose}>
            Continue without signing in
          </button>
        )}
      </div>
      <style>{authStyles}</style>
    </div>
  );
}

const authStyles = `
  .auth-page {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    padding: 20px;
    z-index: 200;
  }

  .auth-card {
    background: white;
    border-radius: 16px;
    padding: 40px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .auth-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .auth-header h2 {
    margin: 0 0 8px 0;
    font-size: 28px;
    font-weight: 700;
    color: #1e293b;
  }

  .auth-subtitle {
    margin: 0;
    font-size: 14px;
    color: #64748b;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .auth-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .auth-field label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
  }

  .auth-field input {
    padding: 12px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s;
  }

  .auth-field input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .auth-btn {
    padding: 14px 20px;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .auth-btn.primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
  }

  .auth-btn.primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }

  .auth-btn.primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .auth-btn.secondary {
    background: #f1f5f9;
    color: #475569;
  }

  .auth-btn.secondary:hover {
    background: #e2e8f0;
  }

  .auth-error {
    padding: 12px 16px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 13px;
  }

  .auth-success {
    padding: 12px 16px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    color: #16a34a;
    font-size: 13px;
  }

  .auth-footer {
    margin-top: 24px;
    text-align: center;
    font-size: 13px;
    color: #64748b;
  }

  .auth-footer p {
    margin: 8px 0 0 0;
  }

  .auth-link {
    background: none;
    border: none;
    color: #6366f1;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
  }

  .auth-link:hover {
    text-decoration: underline;
  }

  .auth-close {
    margin-top: 20px;
    width: 100%;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    color: #64748b;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .auth-close:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  .auth-hint {
    text-align: center;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 20px;
  }
`;
