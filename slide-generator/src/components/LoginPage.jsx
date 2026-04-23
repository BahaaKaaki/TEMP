import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { createLoginRequest } from 'frontend-comps';

const loginRequest = createLoginRequest(['openid', 'profile', 'email']);

export default function LoginPage() {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setFadeOut(true);
      const timer = setTimeout(() => navigate('/', { replace: true }), 600);
      return () => clearTimeout(timer);
    }
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isAuthenticated, navigate]);

  const isProcessing = inProgress !== 'none';

  // Easy Auth has already authenticated the user at the edge by the time this
  // page renders, so MSAL can acquire a token silently via hidden iframe SSO.
  // Auto-trigger loginRedirect on mount to skip the "Sign in with Microsoft"
  // button; users experience a single seamless sign-in instead of two.
  useEffect(() => {
    if (!isAuthenticated && inProgress === 'none') {
      instance.loginRedirect(loginRequest).catch(() => {
        // If silent flow fails (e.g. the Easy Auth session expired in the
        // gap between pages), fall back to the visible button below.
      });
    }
  }, [isAuthenticated, inProgress, instance]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #fff 0%, #fdf6f6 50%, #f9eded 100%)',
      overflow: 'hidden',
      opacity: fadeOut ? 0 : 1,
      transform: fadeOut ? 'scale(1.04)' : 'scale(1)',
      transition: 'opacity 0.55s cubic-bezier(0.4,0,0.2,1), transform 0.55s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <style>{`
        .lp-card {
          max-width: 480px;
          width: 100%;
          padding: 0 2rem;
          animation: lp-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes lp-enter {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .lp-btn {
          width: 100%;
          padding: 1.1rem 1.5rem;
          color: white;
          font-weight: 600;
          font-size: 1.05rem;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #8E1E1E 0%, #a82828 100%);
          box-shadow: 0 4px 16px rgba(142, 30, 30, 0.25), 0 1px 3px rgba(142, 30, 30, 0.15);
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
          position: relative;
          overflow: hidden;
        }
        .lp-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.08) 100%);
          opacity: 0;
          transition: opacity 0.25s;
        }
        .lp-btn:hover:not(:disabled)::after { opacity: 1; }
        .lp-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(142, 30, 30, 0.35), 0 2px 6px rgba(142, 30, 30, 0.2);
        }
        .lp-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.985);
          box-shadow: 0 2px 8px rgba(142, 30, 30, 0.2);
        }
        .lp-btn:disabled {
          cursor: wait;
          opacity: 0.85;
        }
        .lp-divider {
          position: relative;
          text-align: center;
          margin: 2.5rem 0;
        }
        .lp-divider::before {
          content: '';
          position: absolute;
          left: 10%;
          right: 10%;
          top: 50%;
          height: 1px;
          background: linear-gradient(90deg, transparent, #e0d0d0, transparent);
        }
        .lp-divider span {
          position: relative;
          background: linear-gradient(160deg, #fff 0%, #fdf6f6 50%, #f9eded 100%);
          padding: 0 1.25rem;
          color: #9a8888;
          font-size: 0.82rem;
          letter-spacing: 0.03em;
        }
        @keyframes lp-spin {
          to { transform: rotate(360deg); }
        }
        .lp-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: lp-spin 0.65s linear infinite;
        }
      `}</style>

      <div className="lp-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <img
            src={`${import.meta.env.BASE_URL}SLogoLong.png`}
            alt="Strategy& Logo"
            style={{ height: 64, margin: '0 auto' }}
          />
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{
            fontSize: '1.75rem', fontWeight: 300, color: '#1a1a1a',
            margin: '0 0 0.5rem', letterSpacing: '-0.01em',
          }}>
            Welcome to <span style={{ fontWeight: 600, color: '#8E1E1E' }}>Edwin AI</span>
          </h1>
          <p style={{ color: '#888', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
            AI-powered presentation platform
          </p>
        </div>

        {/* Sign-in button */}
        <button
          onClick={() => instance.loginRedirect(loginRequest)}
          className="lp-btn"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="lp-spinner" />
              Signing in...
            </>
          ) : (
            <>
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
              </svg>
              Sign in with Microsoft
            </>
          )}
        </button>

        {/* Divider */}
        <div className="lp-divider">
          <span>Secured by Microsoft Azure AD</span>
        </div>

        {/* Footer */}
        <p style={{
          fontSize: '0.78rem', color: '#b0a0a0',
          textAlign: 'center', margin: 0, letterSpacing: '0.04em',
        }}>
          Part of the PwC network
        </p>
      </div>
    </div>
  );
}
