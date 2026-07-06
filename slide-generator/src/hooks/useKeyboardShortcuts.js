import { useContext, useEffect } from 'react';
import SlideContext from '../context/SlideContext';

/**
 * Hook to handle global keyboard shortcuts
 * - Ctrl+Z: Undo
 * - Ctrl+Shift+Z / Ctrl+Y: Redo
 */
export function useKeyboardShortcuts() {
  const ctx = useContext(SlideContext);
  const actions = ctx?.actions;
  const historyState = ctx?.historyState;

  useEffect(() => {
    if (!actions) return;
    const handleKeyDown = (e) => {
      // Skip if user is typing in an input, textarea, or contenteditable
      const target = e.target;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]');

      // For undo/redo, we want it to work even in inputs (like PowerPoint)
      // But let's not interfere with native undo in text inputs
      // Only intercept when Ctrl/Cmd is pressed

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Undo: Ctrl+Z (not in text inputs, or with special handling)
      if (e.key === 'z' && !e.shiftKey) {
        // If in a text input, let native undo work
        if (isEditing) return;

        e.preventDefault();
        if (actions.undo) {
          const success = actions.undo();
          if (success) {
            console.log('[Undo] Restored previous state');
          }
        }
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        // If in a text input, let native redo work
        if (isEditing) return;

        e.preventDefault();
        if (actions.redo) {
          const success = actions.redo();
          if (success) {
            console.log('[Redo] Restored next state');
          }
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  return historyState;
}

export default useKeyboardShortcuts;
