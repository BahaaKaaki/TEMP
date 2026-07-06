import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { groupSkillsByCategory } from '../services/skillsService';

function Check() {
  return (
    <svg
      className="skills-picker-item-check"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Caret({ open }) {
  return (
    <svg
      className={`skills-picker-caret${open ? ' skills-picker-caret--open' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="skills-picker-search-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

function normalize(text) {
  return (text || '').toLowerCase();
}

/**
 * Single-select dropdown for consulting skills.
 *
 * Props:
 *   skills     -- array of { id, name, description, category, order }
 *   value      -- currently selected skill id, or null
 *   onChange   -- (nextId: string | null) => void. Called with `null` to clear.
 *   onClose    -- () => void. Called when the user dismisses the popover
 *                 (outside click, Escape, or after a selection).
 *   anchorRef  -- optional React ref pointing at the element that toggles
 *                 this popover (the Skill button's wrapper). Clicks inside
 *                 the anchor are NOT treated as outside-clicks, so the
 *                 toggle button can cleanly close the popover via its own
 *                 onClick without fighting this listener.
 *   loading    -- when true and the list is empty, show a "Loading skills..."
 *                 placeholder instead of the "No skills available" message.
 *
 * Design rules:
 *   - Exactly one skill may be selected, or none.
 *   - A "No skill" row at the top makes unselecting explicit. Clicking the
 *     already-selected skill also clears it.
 *   - Categories are collapsible so users can see all 8 groups at once as a
 *     bird's-eye table of contents. Every open starts fresh (all collapsed),
 *     except the category of the currently-selected skill, which auto-opens
 *     so the active choice is always visible.
 *   - A search box filters by name/description/category. Any category with
 *     at least one match auto-expands while a query is active.
 *   - Descriptions clamp to one line by default (dense list), expand to full
 *     on row hover, and always render in full while a search is active or on
 *     the currently-selected row.
 *   - Order/category come from the backend `order` and `category` fields.
 */
function SkillsPicker({ skills, value, onChange, onClose, anchorRef, loading = false }) {
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);

  const grouped = useMemo(() => groupSkillsByCategory(skills || []), [skills]);

  const [query, setQuery] = useState('');
  // Start with every category collapsed so the popover always reads as a
  // bird's-eye table of contents of the catalogue. Expand state does not
  // persist across close/reopen -- each open is intentionally a clean slate.
  // The "auto-open the selected skill's category" effect below still
  // surfaces an active selection on reopen.
  const [expanded, setExpanded] = useState(() => new Set());

  const hasQuery = query.trim().length > 0;

  // Filter groups by the query and compute per-category match counts.
  const filteredGroups = useMemo(() => {
    if (!hasQuery) {
      return grouped.map(group => ({
        ...group,
        matchCount: group.skills.length,
      }));
    }
    const needle = normalize(query);
    return grouped
      .map(group => {
        const matches = group.skills.filter(skill => {
          const hay = `${skill.name}\n${skill.description}\n${skill.category}`;
          return normalize(hay).includes(needle);
        });
        return { ...group, skills: matches, matchCount: matches.length };
      })
      .filter(group => group.skills.length > 0);
  }, [grouped, query, hasQuery]);

  // Autofocus the search when the popover opens.
  useEffect(() => {
    const t = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // If the current selection lives in a group that is collapsed, expand that
  // group once so the user can see their active choice.
  useEffect(() => {
    if (!value) return;
    const owner = grouped.find(group => group.skills.some(s => s.id === value));
    if (!owner) return;
    setExpanded(prev => {
      if (prev.has(owner.category)) return prev;
      const next = new Set(prev);
      next.add(owner.category);
      return next;
    });
  }, [value, grouped]);

  useEffect(() => {
    function handleDocClick(event) {
      const inPopover = rootRef.current && rootRef.current.contains(event.target);
      const inAnchor = anchorRef?.current && anchorRef.current.contains(event.target);
      if (!inPopover && !inAnchor) {
        onClose?.();
      }
    }
    function handleKey(event) {
      if (event.key !== 'Escape') return;
      // Pressing Escape with a query clears it; a second Escape closes the popover.
      if (hasQuery) {
        setQuery('');
        event.stopPropagation();
      } else {
        onClose?.();
      }
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, anchorRef, hasQuery]);

  const toggleCategory = useCallback(category => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  function handleSelect(id) {
    if (value === id) {
      onChange?.(null);
    } else {
      onChange?.(id);
    }
    onClose?.();
  }

  function handleClear() {
    onChange?.(null);
    onClose?.();
  }

  const noneSelected = !value;
  const totalVisible = filteredGroups.reduce((sum, g) => sum + g.skills.length, 0);

  return (
    <div className="skills-picker-popover" ref={rootRef} role="dialog" aria-label="Select consulting skill">
      <div className="skills-picker-header">
        <span className="skills-picker-title">Consulting Skills</span>
        <span className="skills-picker-hint">Pick a playbook to steer the planner, or choose "No skill" to let it decide.</span>
      </div>

      <label className="skills-picker-search">
        <SearchIcon />
        <input
          ref={searchInputRef}
          type="text"
          className="skills-picker-search-input"
          placeholder="Search skills..."
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label="Search skills"
        />
        {hasQuery && (
          <button
            type="button"
            className="skills-picker-search-clear"
            onClick={() => {
              setQuery('');
              searchInputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <ClearIcon />
          </button>
        )}
      </label>

      <ul className="skills-picker-list skills-picker-list--none">
        <li>
          <button
            type="button"
            className={`skills-picker-item skills-picker-item--none${noneSelected ? ' skills-picker-item--selected' : ''}`}
            onClick={handleClear}
          >
            <span className="skills-picker-item-body">
              <span className="skills-picker-item-name">No skill</span>
              <span className="skills-picker-item-desc">
                Let the planner decide on its own without a specific playbook.
              </span>
            </span>
            {noneSelected && <Check />}
          </button>
        </li>
      </ul>

      {grouped.length === 0 ? (
        <div className="skills-picker-empty">
          {loading ? 'Loading skills...' : 'No skills available.'}
        </div>
      ) : totalVisible === 0 ? (
        <div className="skills-picker-empty">
          No skills match <strong>"{query}"</strong>.
        </div>
      ) : (
        <div className="skills-picker-body">
          {filteredGroups.map(({ category, skills: items, matchCount }) => {
            const isOpen = hasQuery || expanded.has(category);
            const countLabel = hasQuery
              ? `${matchCount} match${matchCount === 1 ? '' : 'es'}`
              : `${items.length}`;
            return (
              <div key={category} className={`skills-picker-group${isOpen ? ' skills-picker-group--open' : ''}`}>
                <button
                  type="button"
                  className="skills-picker-group-label"
                  onClick={() => {
                    if (hasQuery) return;
                    toggleCategory(category);
                  }}
                  aria-expanded={isOpen}
                  disabled={hasQuery}
                >
                  <Caret open={isOpen} />
                  <span className="skills-picker-group-name">{category}</span>
                  <span className="skills-picker-group-count">{countLabel}</span>
                </button>
                {isOpen && (
                  <ul className="skills-picker-list">
                    {items.map(skill => {
                      const selected = skill.id === value;
                      const itemClass = [
                        'skills-picker-item',
                        selected ? 'skills-picker-item--selected' : '',
                        hasQuery ? 'skills-picker-item--expanded' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <li key={skill.id}>
                          <button
                            type="button"
                            className={itemClass}
                            onClick={() => handleSelect(skill.id)}
                          >
                            <span className="skills-picker-item-body">
                              <span className="skills-picker-item-name">{skill.name}</span>
                              {skill.description && (
                                <span className="skills-picker-item-desc">{skill.description}</span>
                              )}
                            </span>
                            {selected && <Check />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SkillsPicker;
