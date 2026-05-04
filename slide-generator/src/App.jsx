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
import { authFetch } from './services/authFetch';
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
  const { isPanelOpen, togglePanel, actions } = useSlides();
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
            console.warn('[ProtectedRoute] /api/whoami still 401 after recent re-auth -- stopping redirect loop');
            sessionStorage.removeItem(AUTH_RETRY_KEY);
            setBootstrap({ status: 'allowed', email: null });
            return;
          }
          console.warn('[ProtectedRoute] /api/whoami returned 401 -- triggering loginRedirect to refresh tokens');
          sessionStorage.setItem(AUTH_RETRY_KEY, String(now));
          try {
            await instance.loginRedirect({ scopes: LOGIN_SCOPES });
          } catch (err) {
            console.error('[ProtectedRoute] loginRedirect failed:', err);
            sessionStorage.removeItem(AUTH_RETRY_KEY);
            setBootstrap({ status: 'allowed', email: null });
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

  return children;
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
