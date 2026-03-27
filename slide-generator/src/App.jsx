import { SlideProvider, useSlides } from './context/SlideContext';
import { KnowledgeBaseProvider } from './context/KnowledgeBaseContext';
import Header from './components/Header';
import SlideList from './components/SlideList';
import MainContent from './components/MainContent';
import AIChatbot from './components/AIChatbot';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './styles/app.css';
import './styles/slides.css';

function AppContent() {
  useKeyboardShortcuts();
  const { isPanelOpen, togglePanel } = useSlides();

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

function App() {
  return (
    <SlideProvider>
      <KnowledgeBaseProvider>
        <AppContent />
      </KnowledgeBaseProvider>
    </SlideProvider>
  );
}

export default App;
