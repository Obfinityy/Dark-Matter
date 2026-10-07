/**
 * ModelsPageSearch.jsx — Forge wave 8, idea 50285.
 *
 * Incremental search for the Models + Plugins library page: filters model
 * cards and plugin rows as you type (name, id, provider, slot, tags,
 * synonym-expanded terms like "vision" ↔ "image"). Pure matcher in
 * searchRefine.js (testable).
 */

import { useMemo, useRef, useState } from 'react';
import { searchModels } from './searchRefine.js';
import './ModelsPageSearch.css';

export function ModelsSearchBox({ entries = [], onResults, placeholder = 'Search models & plugins…' }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const results = useMemo(() => searchModels(entries, query), [entries, query]);

  const handle = (q) => {
    setQuery(q);
    onResults && onResults(searchModels(entries, q));
  };

  return (
    <div className="mp-search" role="search">
      <span className="mp-icon" aria-hidden="true">⌕</span>
      <input
        ref={inputRef}
        className="mp-input"
        value={query}
        placeholder={placeholder}
        onChange={(e) => handle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') handle(''); }}
        aria-label="Search models and plugins"
      />
      {query && (
        <button
          type="button"
          className="mp-clear"
          onClick={() => handle('')}
          aria-label="Clear models search"
        >
          ✕
        </button>
      )}
      <span className="mp-count" aria-live="polite">
        {query ? `${results.length} of ${entries.length}` : `${entries.length} entries`}
      </span>
    </div>
  );
}

/**
 * Ready-made model/plugin card wrapper that hides non-matching entries.
 * Pass your existing card component as `renderEntry`.
 */
export function ModelsSearchGrid({ entries = [], renderEntry, emptyHint }) {
  const [visible, setVisible] = useState(entries);
  return (
    <div className="mp-grid-wrap">
      <ModelsSearchBox entries={entries} onResults={setVisible} />
      {visible.length === 0 ? (
        <div className="mp-no-results">
          <p>No models or plugins match your search.</p>
          {emptyHint ?? <p className="mp-hint">Try “vision”, “hacker”, “tts”, or a provider name.</p>}
        </div>
      ) : (
        <div className="mp-grid">
          {visible.map((m, i) => (
            <div key={m.id ?? i} className="mp-cell">
              {renderEntry ? renderEntry(m) : <DefaultModelCard entry={m} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DefaultModelCard({ entry }) {
  return (
    <article className="mp-card">
      <header className="mp-card-head">
        <strong>{entry.name ?? entry.id}</strong>
        <span className={`mp-kind kind-${entry.kind ?? 'model'}`}>{entry.kind ?? 'model'}</span>
      </header>
      {entry.provider && <div className="mp-provider">{entry.provider}</div>}
      {entry.slot && <div className="mp-slot">slot: {entry.slot}</div>}
      {Array.isArray(entry.tags) && entry.tags.length > 0 && (
        <div className="mp-tags">
          {entry.tags.map((t) => (
            <span key={t} className="mp-tag">{t}</span>
          ))}
        </div>
      )}
    </article>
  );
}

export default ModelsSearchGrid;
