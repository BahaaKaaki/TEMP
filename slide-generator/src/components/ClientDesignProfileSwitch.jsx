import { useState, useEffect, useRef, useMemo } from 'react';
import { useSlides } from '../context/SlideContext';
import { CLIENT_DESIGN_PROFILE_OPTIONS } from '../utils/clientDesignProfiles.js';

const PROFILE_ACCENT = {
  strategy: '#8E1E1E',
  stc: '#4F008C',
  pif: '#005C4D',
};

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

/**
 * Client design profile picker for the header.
 * Scales to many profiles (filter + scroll list). Profile is locked once the deck has slides.
 */
export default function ClientDesignProfileSwitch() {
  const { state, actions } = useSlides();
  const activeId = state.settings.clientDesignProfileId || 'strategy';
  const profileLocked = state.slides.length > 0;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapRef = useRef(null);

  const activeOption = useMemo(
    () => CLIENT_DESIGN_PROFILE_OPTIONS.find((p) => p.id === activeId) || CLIENT_DESIGN_PROFILE_OPTIONS[0],
    [activeId],
  );

  /** Match display title (nav label) only — simple and predictable. */
  const filtered = useMemo(() => {
    const q = normalize(filter);
    if (!q) return CLIENT_DESIGN_PROFILE_OPTIONS;
    return CLIENT_DESIGN_PROFILE_OPTIONS.filter((p) => normalize(p.navLabel).includes(q));
  }, [filter]);

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

  useEffect(() => {
    if (!open) setFilter('');
  }, [open]);

  const triggerTitle = profileLocked
    ? `Template "${activeOption.navLabel}" is fixed for this deck. Start a new deck or clear all slides to change it.`
    : `Template: ${activeOption.navLabel}. Choose before adding slides.`;

  const triggerAria = profileLocked
    ? `Template ${activeOption.navLabel}, locked for this deck`
    : `Template, ${activeOption.navLabel}, menu`;

  return (
    <div className="header-client-profile-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`header-client-profile-trigger${profileLocked ? ' header-client-profile-trigger--locked' : ''}${open ? ' header-client-profile-trigger--open' : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={triggerAria}
        aria-disabled={profileLocked}
        disabled={profileLocked}
        title={triggerTitle}
        onClick={() => {
          if (profileLocked) return;
          setOpen((v) => !v);
        }}
      >
        <span className="header-client-profile-trigger-badge">Template</span>
        <span className="header-client-profile-trigger-body">
          <span className="header-client-profile-trigger-name">{activeOption.navLabel}</span>
          {profileLocked ? (
            <span className="header-client-profile-trigger-icon" aria-hidden>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
          ) : (
            <span className="header-client-profile-trigger-icon" aria-hidden>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          )}
        </span>
      </button>

      {open && !profileLocked && (
        <div className="header-client-profile-popover" role="listbox" aria-label="Client templates">
          <div className="header-client-profile-popover-head">
            <input
              type="search"
              className="header-client-profile-filter"
              placeholder="Filter by template name…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoComplete="off"
              aria-label="Filter templates by name"
            />
          </div>
          <ul className="header-client-profile-list">
            {filtered.length === 0 ? (
              <li className="header-client-profile-empty">No matches</li>
            ) : (
              filtered.map((p) => {
                const selected = p.id === activeId;
                const rowAccent = PROFILE_ACCENT[p.id] || '#64748b';
                return (
                  <li key={p.id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`header-client-profile-option${selected ? ' header-client-profile-option--selected' : ''}`}
                      style={selected ? { '--row-accent': rowAccent } : undefined}
                      onClick={() => {
                        if (!selected) {
                          actions.updateSettings({ clientDesignProfileId: p.id });
                        }
                        setOpen(false);
                      }}
                    >
                      <span className="header-client-profile-option-title">{p.navLabel}</span>
                      {p.description ? (
                        <span className="header-client-profile-option-desc">{p.description}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
