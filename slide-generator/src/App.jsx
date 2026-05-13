import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { SlideProvider, useSlides } from './context/SlideContext';
import { KnowledgeBaseProvider } from './context/KnowledgeBaseContext';
import Header from './components/Header';
import SlideList from './components/SlideList';
import MainContent from './components/MainContent';
import AIChatbot from './components/AIChatbot';
import LoginPage from './components/LoginPage';
import AuthLoadingScreen from './components/AuthLoadingScreen';
import AccessDenied from './components/AccessDenied';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { loadSkills } from './services/skillsService';
import { AUTH_SESSION_EXPIRED_EVENT, authFetch } from './services/authFetch';
import { loadClientProfileFonts } from './services/stcFontLoader';
import { loadTemplateFromStorage } from './services/pptxTemplateService';
import { getActiveClientProfile } from './utils/clientDesignProfiles';
import PptxLab from './components/PptxLab';
import 'frontend-comps/styles.css';
import './styles/app.css';
import './styles/slides.css';

// Capture handoff ID at module level so it survives React StrictMode double-mount.
// The ID is also persisted to sessionStorage so it survives MSAL login redirects
// (first visit: URL has ?handoff= -> MSAL redirects to Microsoft -> comes back
// without the param -> sessionStorage still has it).
const _pendingHandoffId = (() => {
  const HANDOFF_KEY = 'pendingHandoffId';
  const params = new URLSearchParams(window.location.search);
  let id = params.get('handoff');

  if (id) {
    window.history.replaceState({}, '', window.location.pathname);
    try { sessionStorage.setItem(HANDOFF_KEY, id); } catch { /* noop */ }
  } else {
    try { id = sessionStorage.getItem(HANDOFF_KEY); } catch { /* noop */ }
  }

  if (id) {
    try {
      sessionStorage.removeItem(HANDOFF_KEY);
      localStorage.removeItem('slideGeneratorState');
    } catch { /* noop */ }
  }

  return id;
})();

// Auto-reload on new deployment — polls /health for buildId changes
function useAutoReload() {
  useEffect(() => {
    let knownBuildId = null;
    const check = async () => {
      try {
        const res = await fetch('/health');
        const data = await res.json();
        if (!knownBuildId) {
          knownBuildId = data.buildId;
        } else if (data.buildId !== knownBuildId) {
          console.log('[AutoReload] New deployment detected, reloading...');
          window.location.reload();
        }
      } catch { /* ignore network errors */ }
    };
    check();
    const interval = setInterval(check, 60_000); // check every 60s
    return () => clearInterval(interval);
  }, []);
}

function EditorContent() {
  useKeyboardShortcuts();
  useAutoReload();
  const { state, isPanelOpen, togglePanel, actions } = useSlides();
  const activeClientDesignProfileId = state.settings?.clientDesignProfileId || 'strategy';
  const [handoffData, setHandoffData] = useState(null);

  // Fetch handoff context using the ID captured at module level (before React mounted).
  const handoffFetchedRef = useRef(false);
  useEffect(() => {
    if (!_pendingHandoffId || handoffFetchedRef.current) return;
    handoffFetchedRef.current = true;

    (async () => {
      try {
        const res = await authFetch(`/api/handoffs/${_pendingHandoffId}`);
        if (!res.ok) {
          console.warn('[Handoff] fetch failed:', res.status);
          return;
        }
        const data = await res.json();
        setHandoffData(data);
      } catch (err) {
        console.warn('[Handoff] fetch error:', err?.message || err);
      }
    })();
  }, []);

  // Hydrate the consulting skills catalogue once when the editor mounts.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  useEffect(() => {
    let cancelled = false;
    loadSkills().then((skills) => {
      if (cancelled) return;
      actionsRef.current.setAvailableSkills(skills);
      console.log('[App] Skills catalogue loaded: %d skill(s)', skills.length);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const profile = getActiveClientProfile({ clientDesignProfileId: activeClientDesignProfileId });
    const profileId = profile.id || 'strategy';
    const master = profile.pptxMaster;
    loadClientProfileFonts(profileId).catch((error) => {
      console.warn('[App] %s font warm-up failed: %s', profile.name || profileId, error.message);
    });
    const shouldWarmMaster = profileId !== 'strategy'
      && (master?.bundled || master?.serverSync === 'backend-profile-default');
    if (!shouldWarmMaster) return undefined;

    let cancelled = false;
    loadTemplateFromStorage({ profileId }).then((template) => {
      if (cancelled) return;
      if (template?.data) {
        console.log('[App] %s PPTX master warmed on startup: %s', profile.name || profileId, template.fileName || 'default');
      }
    }).catch((error) => {
      if (!cancelled) console.warn('[App] %s PPTX master warm-up failed: %s', profile.name || profileId, error.message);
    });

    return () => { cancelled = true; };
  }, [activeClientDesignProfileId]);

  return (
    <div className="app-container">
      <Header />
      <div className="app-main">
        <SlideList />
        <MainContent />
        <AIChatbot initialHandoff={handoffData} />
      </div>
      {!isPanelOpen && (
        <button className="chatbot-fab" onClick={togglePanel} title="AI Assistant">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="chatbot-fab-badge">AI</span>
        </button>
      )}
    </div>
  );
}

/**
 * Gates the editor on both MSAL auth state and the backend staff allowlist.
 *
 * The bootstrap flow:
 *   1. Wait for MSAL to finish any redirect / silent handshake.
 *   2. If unauthenticated -> navigate to /login (branded sign-in page).
 *   3. If authenticated -> call /api/whoami to ask the backend whether this
 *      identity is on the approved staff list. The backend determines the
 *      answer from ALLOWLIST_MODE:
 *        - off     : always `allowed: true`, no JWT required.
 *        - log     : always `allowed: true` (log-only observation window).
 *        - enforce : `allowed` reflects whether the email is on the list.
 *   4. If `allowed === false` -> render <AccessDenied/> with a sign-out CTA.
 *   5. Otherwise -> render the editor.
 *
 * Handling 401 on /api/whoami: this happens when MSAL has a cached account
 * locally but the refresh token / Microsoft session has expired, so silent
 * token acquisition returns no id_token. We force a fresh sign-in via
 * `loginRedirect` -- Microsoft will SSO the user back in if their browser
 * session is still valid, or prompt for password/MFA if it isn't. A session
 * flag (`AUTH_RETRY_KEY`) guards against infinite redirect loops: if we
 * already retried in the last 60s and are *still* 401, we stop and render
 * the editor so the user isn't trapped by a backend misconfig.
 *
 * Any other non-ok response (500s, network errors) falls back to rendering
 * the editor so a transient hiccup doesn't lock users out; downstream
 * /api/* calls will surface the real error.
 */
const AUTH_RETRY_KEY = 'edwinAuthRetryAt';
const LOGIN_SCOPES = ['openid', 'profile', 'email'];

function SessionExpiredPrompt({ compact = false, message, onSignIn, isSigningIn = false }) {
  const title = 'Your session expired';
  const defaultMessage = 'Please sign in again to continue using Edwin.';
  const content = (
    <>
      <div className="auth-session-title">{title}</div>
      <div className="auth-session-message">
        {message || defaultMessage}
      </div>
      <button
        type="button"
        onClick={onSignIn}
        disabled={isSigningIn}
        className="auth-session-button"
      >
        {isSigningIn ? 'Opening sign-in...' : 'Sign in again'}
      </button>
    </>
  );

  if (compact) {
    return (
      <div role="alert" className="auth-session-banner">
        {content}
      </div>
    );
  }

  return (
    <div role="alert" className="auth-session-page">
      <div className="auth-session-card">
        {content}
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const { instance, inProgress } = useMsal();
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState({ status: 'pending', email: null });

  const isLoading = inProgress !== InteractionStatus.None;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/whoami');
        if (cancelled) return;

        if (res.status === 401) {
          const now = Date.now();
          const lastRetry = parseInt(sessionStorage.getItem(AUTH_RETRY_KEY) || '0', 10);
          if (now - lastRetry < 60_000) {
            console.warn('[ProtectedRoute] /api/whoami still 401 after recent re-auth -- prompting user');
            sessionStorage.removeItem(AUTH_RETRY_KEY);
            setBootstrap({
              status: 'authExpired',
              message: 'Please sign in again to continue using Edwin.',
            });
            return;
          }
          console.warn('[ProtectedRoute] /api/whoami returned 401 -- triggering loginRedirect to refresh tokens');
          sessionStorage.setItem(AUTH_RETRY_KEY, String(now));
          try {
            await instance.loginRedirect({ scopes: LOGIN_SCOPES });
          } catch (err) {
            console.error('[ProtectedRoute] loginRedirect failed:', err);
            sessionStorage.removeItem(AUTH_RETRY_KEY);
            setBootstrap({
              status: 'authExpired',
              message: 'We could not open Microsoft sign-in. Please try again.',
            });
          }
          return;
        }

        if (!res.ok) {
          console.warn('[ProtectedRoute] /api/whoami returned %d -- allowing through', res.status);
          setBootstrap({ status: 'allowed', email: null });
          return;
        }

        sessionStorage.removeItem(AUTH_RETRY_KEY);
        const data = await res.json();
        if (cancelled) return;
        if (data.allowed) {
          await Promise.all([
            loadClientProfileFonts('stc'),
            loadClientProfileFonts('pif'),
            loadClientProfileFonts('dge'),
          ]);
          if (cancelled) return;
        }
        setBootstrap({
          status: data.allowed ? 'allowed' : 'denied',
          email: data.email || null,
        });
      } catch (err) {
        console.warn('[ProtectedRoute] /api/whoami failed:', err?.message || err);
        if (!cancelled) setBootstrap({ status: 'allowed', email: null });
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, isAuthenticated, instance]);

  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated) return null;
  if (bootstrap.status === 'pending') return <AuthLoadingScreen />;
  if (bootstrap.status === 'denied') {
    return <AccessDenied email={bootstrap.email} />;
  }
  if (bootstrap.status === 'authExpired') {
    return (
      <SessionExpiredPrompt
        message={bootstrap.message}
        isSigningIn={isLoading}
        onSignIn={() => {
          sessionStorage.setItem(AUTH_RETRY_KEY, String(Date.now()));
          instance.loginRedirect({ scopes: LOGIN_SCOPES }).catch((err) => {
            console.error('[ProtectedRoute] manual loginRedirect failed:', err);
            sessionStorage.removeItem(AUTH_RETRY_KEY);
            setBootstrap({
              status: 'authExpired',
              message: 'We could not open Microsoft sign-in. Please refresh the page and try again.',
            });
          });
        }}
      />
    );
  }

  return children;
}

function AuthSessionNotice() {
  const { instance, inProgress } = useMsal();
  const [notice, setNotice] = useState(null);
  const isSigningIn = inProgress !== InteractionStatus.None;

  useEffect(() => {
    const onAuthExpired = (event) => {
      const detail = event.detail || {};
      setNotice({
        message: detail.source === 'api_401'
          ? 'Please sign in again before continuing.'
          : 'Please sign in again to refresh your Microsoft session.',
      });
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onAuthExpired);
  }, []);

  if (!notice) return null;

  return (
    <SessionExpiredPrompt
      compact
      message={notice.message}
      isSigningIn={isSigningIn}
      onSignIn={() => {
        instance.loginRedirect({ scopes: LOGIN_SCOPES }).catch((err) => {
          console.error('[AuthSessionNotice] loginRedirect failed:', err);
          setNotice({
            message: 'We could not open Microsoft sign-in. Please refresh the page and try again.',
          });
        });
      }}
    />
  );
}

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <SlideProvider>
      <KnowledgeBaseProvider>
        <AuthSessionNotice />
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <EditorContent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pptx-lab"
            element={
              <ProtectedRoute>
                <PptxLab />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </KnowledgeBaseProvider>
    </SlideProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
