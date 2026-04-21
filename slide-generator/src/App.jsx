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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { loadSkills } from './services/skillsService';
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

function ProtectedRoute({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const navigate = useNavigate();

  const isLoading = inProgress !== InteractionStatus.None;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated) return null;

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
