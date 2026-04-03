import { useState, useEffect } from 'react';
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
import 'frontend-comps/styles.css';
import './styles/app.css';
import './styles/slides.css';

function EditorContent() {
  useKeyboardShortcuts();
  const { isPanelOpen, togglePanel } = useSlides();
  const [phase, setPhase] = useState('hidden');

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase('ready'));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <style>{`
        @keyframes editor-reveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="app-container"
        style={{
          animation: phase === 'ready' ? 'editor-reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both' : 'none',
          opacity: phase === 'ready' ? undefined : 0,
        }}
      >
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
    </>
  );
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const isLoading = inProgress !== InteractionStatus.None;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !leaving) {
      setLeaving(true);
      const timer = setTimeout(() => setShowContent(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, leaving]);

  if (showContent) return children;

  return (
    <>
      <style>{`
        @keyframes pr-exit {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(1.03); }
        }
      `}</style>
      <div style={leaving ? {
        animation: 'pr-exit 0.45s cubic-bezier(0.4,0,0.2,1) forwards',
      } : undefined}>
        <AuthLoadingScreen />
      </div>
    </>
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
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <EditorContent />
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
