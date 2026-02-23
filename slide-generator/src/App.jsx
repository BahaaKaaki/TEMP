import { SlideProvider } from './context/SlideContext';
import { KnowledgeBaseProvider } from './context/KnowledgeBaseContext';
import Header from './components/Header';
import SlideList from './components/SlideList';
import MainContent from './components/MainContent';
import AIChatbot from './components/AIChatbot';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './styles/app.css';
import './styles/slides.css';

// Inner component that uses the context
function AppContent() {
  // Enable global keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
  useKeyboardShortcuts();

  return (
    <div className="app-container">
      <Header />
      <div className="app-main">
        <SlideList />
        <MainContent />
      </div>
      <AIChatbot />
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
