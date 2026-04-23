import { useEffect, useMemo, useRef } from 'react';
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
 * Design rules (see docs/plan: Simple Skills Rebuild):
 *   - Exactly one skill may be selected, or none.
 *   - A "No skill" row at the top makes unselecting explicit. Clicking the
 *     already-selected skill also clears it.
 *   - Each skill item shows its name plus a two-line description so users can
 *     tell playbooks apart without hovering.
 *   - Order comes from the backend `order` field; groups come from `category`.
 */
function SkillsPicker({ skills, value, onChange, onClose, anchorRef, loading = false }) {
  const rootRef = useRef(null);

  const grouped = useMemo(() => groupSkillsByCategory(skills || []), [skills]);

  useEffect(() => {
    function handleDocClick(event) {
      const inPopover = rootRef.current && rootRef.current.contains(event.target);
      const inAnchor = anchorRef?.current && anchorRef.current.contains(event.target);
      if (!inPopover && !inAnchor) {
        onClose?.();
      }
    }
    function handleKey(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, anchorRef]);

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

  return (
    <div className="skills-picker-popover" ref={rootRef} role="dialog" aria-label="Select consulting skill">
      <div className="skills-picker-header">
        <span className="skills-picker-title">Consulting Skills</span>
        <span className="skills-picker-hint">Pick a playbook to steer the planner, or choose "No skill" to let it decide.</span>
      </div>

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
      ) : (
        <div className="skills-picker-body">
          {grouped.map(({ category, subGroups }) => (
            <div key={category} className="skills-picker-group">
              <div className="skills-picker-group-label">{category}</div>
              {subGroups.map(({ subCategory, skills: items }) => (
                <div
                  key={subCategory || '__none__'}
                  className={`skills-picker-subgroup${subCategory ? '' : ' skills-picker-subgroup--flat'}`}
                >
                  {subCategory && (
                    <div className="skills-picker-subgroup-label">{subCategory}</div>
                  )}
                  <ul className="skills-picker-list">
                    {items.map(skill => {
                      const selected = skill.id === value;
                      return (
                        <li key={skill.id}>
                          <button
                            type="button"
                            className={`skills-picker-item${selected ? ' skills-picker-item--selected' : ''}`}
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
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SkillsPicker;
