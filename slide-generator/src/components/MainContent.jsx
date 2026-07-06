import { useState } from 'react';
import SlidePreview from './SlidePreview';
import SlideEditor from './SlideEditor';

const DEBUG_MODE = typeof window !== 'undefined' && localStorage.getItem('DEBUG_MODE') === 'true';

export default function MainContent() {
  const [activeView, setActiveView] = useState('preview');

  return (
    <div className="main-content">
      <div className="content-area">
        {activeView === 'preview' && (
          <SlidePreview onSwitchToCode={DEBUG_MODE ? () => setActiveView('editor') : undefined} />
        )}
        {activeView === 'editor' && <SlideEditor onSwitchToPreview={() => setActiveView('preview')} />}
      </div>
    </div>
  );
}
