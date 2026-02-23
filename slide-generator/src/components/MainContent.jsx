import { useState } from 'react';
import SlidePreview from './SlidePreview';
import SlideEditor from './SlideEditor';

export default function MainContent() {
  const [activeView, setActiveView] = useState('preview');

  return (
    <div className="main-content">
      <div className="content-area">
        {activeView === 'preview' && <SlidePreview onSwitchToCode={() => setActiveView('editor')} />}
        {activeView === 'editor' && <SlideEditor onSwitchToPreview={() => setActiveView('preview')} />}
      </div>
    </div>
  );
}
