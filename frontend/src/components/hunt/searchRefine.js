/**
 * searchRefine.js — Forge wave 8, ideas 50281–50289 (search refinements).
 *
 * Genuinely NEW items in this file (wave 7's SearchSuite already covers
 * 50283/50284/50286/50288/50289 — those live on main via PR #65):
 *   50281 — Esc clears the search AND restores the pre-search filter state
 *   50282 — chain-graph node search (pure matcher; component in ChainGraphSearch.jsx)
 *   50285 — models-page incremental search (pure matcher)
 *   50287 — retained search text across navigation (sessionStorage)
 *
 * Pure functions are unit-tested; React hooks are thin wrappers around them.
 */

import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/* 50281 — Esc clears search + restores the previous filter state       */
/* ------------------------------------------------------------------ */

/**
 * Pure state machine for 50281. Kept out of the hook so tests can run it.
 *
 * state: { query, filters, preSearchFilters } where preSearchFilters is the
 * snapshot taken the moment the query goes from empty → non-empty.
 */
export function escapeSearchReducer(state, action) {
  switch (action.type) {
    case 'SET_QUERY': {
      const q = action.query;
      // snapshot filters the first time a query is typed over an empty box
      const preSearchFilters =
        state.query === '' && q !== '' && state.preSearchFilters == null
          ? state.filters
          : state.preSearchFilters;
      return { ...state, query: q, preSearchFilters };
    }
    case 'SET_FILTERS':
      return { ...state, filters: action.filters };
    case 'ESCAPE': {
      if (state.query === '') return state; // nothing to clear
      return {
        query: '',
        filters: state.preSearchFilters ?? state.filters, // 50281: restore
        preSearchFilters: null,
      };
    }
    default:
      return state;
  }
}

export function initialEscapeSearchState({ query = '', filters = {} } = {}) {
  return { query, filters, preSearchFilters: null };
}

/**
 * 50281 — React hook. Returns a key-down handler plus state setters.
 * Attach onKeyDown to the search input.
 */
export function useSearchEscape({ query = '', filters = {}, onQueryChange, onFiltersChange }) {
  const [internal, setInternal] = useState(() => initialEscapeSearchState({ query, filters }));
  // keep snapshot up to date if the parent drives query from elsewhere
  useEffect(() => {
    setInternal(s => escapeSearchReducer(s, { type: 'SET_QUERY', query }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    setInternal(s => escapeSearchReducer(s, { type: 'SET_FILTERS', filters }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const onKeyDown = e => {
    if (e.key !== 'Escape') return;
    const next = escapeSearchReducer(internal, { type: 'ESCAPE' });
    if (next !== internal) {
      setInternal(next);
      onQueryChange && onQueryChange('');
      onFiltersChange && onFiltersChange(next.filters);
      e.preventDefault && e.preventDefault();
    }
  };

  return { onKeyDown, snapshot: internal.preSearchFilters };
}

/* ------------------------------------------------------------------ */
/* 50287 — retained search text across navigation (sessionStorage)      */
/* ------------------------------------------------------------------ */

export function retainedSearchKey(namespace) {
  return `dm:search:${namespace}`;
}

/** Read the persisted value. Guarded for SSR / non-browser test envs. */
export function readRetainedSearch(namespace, storage) {
  const store = storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (!store) return '';
  try {
    return store.getItem(retainedSearchKey(namespace)) ?? '';
  } catch {
    return '';
  }
}

/** Persist the value. */
export function writeRetainedSearch(namespace, value, storage) {
  const store = storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (!store) return;
  try {
    if (value) store.setItem(retainedSearchKey(namespace), value);
    else store.removeItem(retainedSearchKey(namespace));
  } catch {
    /* storage full/blocked — search still works, just not retained */
  }
}

/**
 * 50287 — React hook. The input keeps its value when the user navigates
 * away to a finding and back (per-namespace sessionStorage).
 */
export function useRetainedSearch(namespace, { debounceMs = 200 } = {}) {
  const [value, setValue] = useState(() => readRetainedSearch(namespace));
  const timer = useRef(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => writeRetainedSearch(namespace, value), debounceMs);
    return () => timer.current && clearTimeout(timer.current);
  }, [value, namespace, debounceMs]);
  return [value, setValue];
}

/* ------------------------------------------------------------------ */
/* 50282 — chain-graph node search (pure matcher)                       */
/* ------------------------------------------------------------------ */

/**
 * 50282 — search chain-graph nodes by label. Returns up to `limit` nodes
 * scored by label match (prefix > substring > token match).
 */
export function searchChainNodes(nodes = [], query = '', limit = 20) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return nodes.slice(0, limit);
  const tokens = q.split(/\s+/);
  const scored = [];
  for (const n of nodes) {
    const label = String(n.label ?? n.id ?? '').toLowerCase();
    if (!label) continue;
    let score = 0;
    if (label.startsWith(q)) score = 3;
    else if (label.includes(q)) score = 2;
    else {
      const hits = tokens.filter(t => label.includes(t)).length;
      if (hits === 0) continue;
      score = 1 + hits / tokens.length;
    }
    scored.push({ node: n, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.node);
}

/* ------------------------------------------------------------------ */
/* 50285 — models-page incremental search (pure matcher)                */
/* ------------------------------------------------------------------ */

const MODEL_SYNONYMS = {
  vision: ['image', 'multimodal', 'vl', 'sight'],
  hacker: ['pentest', 'hack', 'attack', 'redteam'],
  grounding: ['ui', 'click', 'coordinate', 'locator'],
  tts: ['voice', 'speech', 'speak', 'kokoro'],
  llm: ['chat', 'language', 'brain', 'model'],
};

/**
 * 50285 — incremental search over the models + plugins library page.
 * Each entry: { id, name, provider, slot, kind: 'model'|'plugin', tags[] }.
 */
export function searchModels(entries = [], query = '', limit = 50) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return entries.slice(0, limit);
  const terms = [q, ...(MODEL_SYNONYMS[q] ?? [])];
  const scored = [];
  for (const m of entries) {
    const hay = [m.name, m.id, m.provider, m.slot, m.kind, ...(Array.isArray(m.tags) ? m.tags : [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (!t) continue;
      const field = String(m.name ?? '').toLowerCase();
      if (field.startsWith(t)) score += 4;
      else if (field.includes(t)) score += 3;
      else if (hay.includes(t)) score += 2;
    }
    if (score > 0) scored.push({ entry: m, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry);
}

/* ------------------------------------------------------------------ */
/* Idea → export registry for honesty checks                           */
/* ------------------------------------------------------------------ */

export const SEARCH_REFINE_IDEAS = [
  { idea: 50281, name: 'useSearchEscape / escapeSearchReducer' },
  { idea: 50282, name: 'searchChainNodes' },
  { idea: 50285, name: 'searchModels' },
  { idea: 50287, name: 'useRetainedSearch' },
];
