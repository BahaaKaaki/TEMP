import { useState, useEffect, useRef, useMemo } from 'react';
import { useSlides } from '../context/SlideContext';
import { CLIENT_DESIGN_PROFILE_OPTIONS } from '../utils/clientDesignProfiles.js';

/**
 * Client template picker for the header. Visually matches the other
 * header-action-btn dropdowns (Export, Edwin GPTs). Switching is allowed
 * at any time — changing profile resets cached pptxCode on existing slides
 * (see UPDATE_SETTINGS reducer).
 */
export default function ClientDesignProfileSwitch() {
  const { state, actions } = useSlides();
  const activeId = state.settings.clientDesignProfileId || 'strategy';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const activeOption = useMemo(
    () => CLIENT_DESIGN_PROFILE_OPTIONS.find((p) => p.id === activeId) || CLIENT_DESIGN_PROFILE_OPTIONS[0],
    [activeId],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="header-action-group" ref={wrapRef}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="header-action-btn"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`Template: ${activeOption.navLabel}`}
          title={`Template: ${activeOption.navLabel}`}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
          <span className="header-btn-label">{activeOption.navLabel}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            className="header-dropdown"
            role="listbox"
            aria-label="Client templates"
            style={{ left: 0, right: 'auto', minWidth: 220 }}
          >
            {CLIENT_DESIGN_PROFILE_OPTIONS.map((p) => {
              const selected = p.id === activeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`header-dropdown-item${selected ? ' header-dropdown-item-accent' : ''}`}
                  onClick={() => {
                    if (!selected) actions.updateSettings({ clientDesignProfileId: p.id });
                    setOpen(false);
                  }}
                >
                  {p.navLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
