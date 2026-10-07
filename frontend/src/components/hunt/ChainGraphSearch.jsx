/**
 * ChainGraphSearch.jsx — Forge wave 8, idea 50282.
 *
 * The chain-graph view supports searching by node label: type to filter the
 * graph down to matching nodes, arrow-key through them, Enter to focus/zoom
 * the selected node. Pure matcher lives in searchRefine.js (testable).
 */

import { useMemo, useRef, useState } from 'react';
import { searchChainNodes } from './searchRefine.js';
import './ChainGraphSearch.css';

export function ChainGraphSearch({
  nodes = [],
  value = '',
  onChange,
  onFocusNode,
  placeholder = 'Search nodes…  (type a label, ↑↓, Enter)',
  limit = 20,
}) {
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(
    () => searchChainNodes(nodes, value, limit),
    [nodes, value, limit]
  );

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      onFocusNode && onFocusNode(results[active]);
    } else if (e.key === 'Escape') {
      onChange && onChange('');
      setActive(0);
      inputRef.current && inputRef.current.blur();
    }
  };

  return (
    <div className="cg-search" role="search">
      <input
        ref={inputRef}
        className="cg-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange && onChange(e.target.value); setActive(0); }}
        onKeyDown={onKeyDown}
        aria-label="Search chain-graph nodes"
        aria-expanded={value.trim() ? 'true' : 'false'}
      />
      {value.trim() && (
        <div className="cg-results" role="listbox" aria-label="Matching nodes">
          {results.length === 0 && (
            <div className="cg-empty">No nodes match “{value}”.</div>
          )}
          {results.map((n, i) => (
            <button
              key={n.id ?? i}
              type="button"
              role="option"
              aria-selected={i === active}
              className={'cg-node' + (i === active ? ' active' : '')}
              onMouseEnter={() => setActive(i)}
              onClick={() => onFocusNode && onFocusNode(n)}
            >
              <span className="cg-kind" data-kind={n.kind ?? 'node'} />
              <span className="cg-label">{n.label ?? n.id}</span>
              {n.severity && <span className={`cg-sev sev-${n.severity}`}>{n.severity}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="cg-count" aria-live="polite">
        {value.trim() ? `${results.length} of ${nodes.length} nodes` : `${nodes.length} nodes`}
      </div>
    </div>
  );
}

export default ChainGraphSearch;
