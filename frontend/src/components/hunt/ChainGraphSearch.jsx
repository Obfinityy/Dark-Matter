/**
 * ChainGraphSearch.jsx — Forge wave 8, idea 50282.
 *
 * The chain-graph view supports searching by node label: type to filter the
 * graph down to matching nodes, arrow-key through them, Enter to focus/zoom
 * the selected node. Pure matcher lives in searchRefine.js (testable).
 */

import { useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchChainNodes } from './searchRefine.js';
import './ChainGraphSearch.css';
import './ChainGraphSearch.polish.css';

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
  const listRef = useRef(null);

  const results = useMemo(() => searchChainNodes(nodes, value, limit), [nodes, value, limit]);

  const moveActive = dir => {
    if (!results.length) return;
    const next = (active + dir + results.length) % results.length;
    setActive(next);
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`#cg-opt-${next}`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  };

  const clearSearch = () => {
    onChange && onChange('');
    setActive(0);
    inputRef.current && inputRef.current.focus();
  };

  const onKeyDown = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      onFocusNode && onFocusNode(results[active]);
    } else if (e.key === 'Escape') {
      onChange && onChange('');
      setActive(0);
      inputRef.current && inputRef.current.blur();
    }
  };

  const showResults = value.trim().length > 0;

  return (
    <div className="cg-search" role="search">
      <div className="cg-input-wrap">
        <Search className="cg-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          className="cg-input"
          value={value}
          placeholder={placeholder}
          onChange={e => {
            onChange && onChange(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          aria-label="Search chain-graph nodes"
          aria-expanded={showResults ? 'true' : 'false'}
          aria-activedescendant={
            showResults && results.length > 0 ? `cg-opt-${active % results.length}` : undefined
          }
          role="combobox"
          aria-autocomplete="list"
          aria-controls="cg-results-listbox"
        />
        {value && (
          <button
            type="button"
            className="cg-clear"
            onClick={clearSearch}
            aria-label="Clear search"
            title="Clear search"
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {showResults && (
        <div
          ref={listRef}
          className="cg-results"
          id="cg-results-listbox"
          role="listbox"
          aria-label="Matching nodes"
        >
          {results.length === 0 && <div className="cg-empty">No nodes match “{value}”.</div>}
          {results.map((n, i) => (
            <button
              key={n.id ?? i}
              id={`cg-opt-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              className={'cg-node' + (i === active ? ' active' : '')}
              onMouseEnter={() => setActive(i)}
              onClick={() => onFocusNode && onFocusNode(n)}
            >
              <span className="cg-kind" data-kind={n.kind ?? 'node'} aria-hidden="true" />
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
