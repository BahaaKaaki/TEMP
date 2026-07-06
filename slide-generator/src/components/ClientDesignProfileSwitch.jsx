import { useState, useEffect, useRef, useMemo } from 'react';
import { useSlides } from '../context/SlideContext';
import { CLIENT_DESIGN_PROFILE_OPTIONS } from '../utils/clientDesignProfiles.js';

function ProfileSwatch({ swatch }) {
  const accent = swatch?.accent || '#8E1E1E';
  const heading = swatch?.heading || '#111111';
  const page = swatch?.page || '#FFFFFF';
  return (
    <span className="client-profile-swatch" aria-hidden="true">
      <span className="client-profile-swatch-chip" style={{ background: page, borderColor: '#e5e7eb' }} />
      <span className="client-profile-swatch-chip" style={{ background: heading }} />
      <span className="client-profile-swatch-chip" style={{ background: accent }} />
    </span>
  );
}

/**
 * Client template picker for the header. Searchable panel with brand color swatches.
 */
export default function ClientDesignProfileSwitch() {
  const { state, actions } = useSlides();
  const activeId = state.settings.clientDesignProfileId || 'strategy';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  const sortedOptions = useMemo(() => {
    const list = [...CLIENT_DESIGN_PROFILE_OPTIONS];
    list.sort((a, b) => {
      if (a.id === 'strategy') return -1;
      if (b.id === 'strategy') return 1;
      return a.navLabel.localeCompare(b.navLabel);
    });
    return list;
  }, []);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedOptions;
    return sortedOptions.filter((p) => (
      p.navLabel.toLowerCase().includes(q)
      || p.name.toLowerCase().includes(q)
      || p.id.toLowerCase().includes(q)
      || (p.description || '').toLowerCase().includes(q)
    ));
  }, [query, sortedOptions]);

  const activeOption = useMemo(
    () => CLIENT_DESIGN_PROFILE_OPTIONS.find((p) => p.id === activeId) || CLIENT_DESIGN_PROFILE_OPTIONS[0],
    [activeId],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
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
          <ProfileSwatch swatch={activeOption.swatch} />
          <span className="header-btn-label">{activeOption.navLabel}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            className="header-dropdown client-profile-picker"
            role="listbox"
            aria-label="Client templates"
          >
            <div className="client-profile-picker-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates..."
                aria-label="Search client templates"
                className="client-profile-picker-search-input"
              />
            </div>

            <div className="client-profile-picker-list">
              {filteredOptions.length === 0 ? (
                <div className="client-profile-picker-empty">No templates match your search.</div>
              ) : (
                filteredOptions.map((p) => {
                  const selected = p.id === activeId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`client-profile-picker-item${selected ? ' is-selected' : ''}`}
                      onClick={() => {
                        if (!selected) actions.updateSettings({ clientDesignProfileId: p.id });
                        setOpen(false);
                      }}
                    >
                      <ProfileSwatch swatch={p.swatch} />
                      <span className="client-profile-picker-text">
                        <span className="client-profile-picker-name">{p.navLabel}</span>
                        {p.description ? (
                          <span className="client-profile-picker-desc">{p.description}</span>
                        ) : null}
                      </span>
                      {selected ? (
                        <svg className="client-profile-picker-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
