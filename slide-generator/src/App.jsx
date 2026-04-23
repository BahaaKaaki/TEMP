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

  // Hydrate the consulting skills catalogue once when the editor mounts.
  // Bodies stay on the server; only metadata (id, name, category, order)
  // lands here and powers the skill dropdown in the AI Assistant panel.
  //
  // `actions` is re-created on every SlideProvider render, so we keep it in a
  // ref and fire the fetch with empty deps to guarantee a single request per
  // session instead of a render-loop hammering the backend.
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
        <AIChatbot />
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
 * If the bootstrap call itself fails (network error, 401, etc.) we fall back
 * to showing the editor rather than locking users out of the app for a
 * transient hiccup -- any subsequent /api/* call will hit the same gate and
 * surface the real error there.
 */
function ProtectedRoute({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
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
        if (!res.ok) {
          console.warn('[ProtectedRoute] /api/whoami returned %d -- allowing through', res.status);
          setBootstrap({ status: 'allowed', email: null });
          return;
        }
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
  }, [isLoading, isAuthenticated]);

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
