/**
 * FindingCards5.jsx — Forge wave 6, ideas 50201–50240.
 *
 * Keyboard + advanced-filter suite for the findings UI. Every control below
 * is wired into the real filter pipeline in ./filtersCore.js
 * (applyFilters / sortFindings / serializeFilters / deserializeFilters).
 *
 * Components (idea numbers):
 *   50201 useGlobalShortcuts + SearchShortcutScope + ShortcutsHelpOverlay
 *   50202 RecentlyUsedFiltersRow        50217 UntriagedCriticalsPreset
 *   50203 AssigneeFilter                 50218 AdvancedFiltersPanel
 *   50204 ExcludeFpToggle                50219 useFilterState (persistence)
 *   50205 SortDirectionToggle            50220 SimilarToThisButton
 *   50206 GroupByControl + GroupedFindingsView
 *   50207 ChangedSinceVisitToggle        50221 RegexModeToggle
 *   50208 SelectAllFilteredBar           50222 EvidenceTypeFilter
 *   50209 PresetSyncControls             50223 sort keys firstSeen/lastUpdated (SortDropdown5)
 *   50210 NeedsRetestToggle              50224 StarredToggle
 *   50211 RiskScoreRangeSlider           50225 FilterFixSuggestions
 *   50212 ShowDismissedToggle            50226 ReorderableFilterPills
 *   50213 SeverityHistogramChips         50227 MobileFilterSheet
 *   50214 MyFindingsToggle               50228 CompareModeToggle
 *   50215 ExportFilteredButton           50229 ConfidenceBandPresets
 *   50216 ReplayabilitySegmented         50230 OriginSegmented
 *                                        50231 AgingSegmented
 *                                        50232 DefaultFilterManager
 *                                        50233 PresetBar (popular badges)
 *                                        50234 UndoRedoControls + useFilterState history
 *                                        50235 CommandPalette
 *                                        50236 FuzzySearchToggle
 *                                        50237 DebouncedSearchInput + HighlightedText
 *                                        50238 ScopedSearchTabs
 *                                        50239 RecentSearchesDropdown
 *                                        50240 SavedSearchesPanel + PinnedSearchRail
 *
 * Composite: <AdvancedFindingFilters> wires the whole suite end to end.
 */
import React from 'react';
import {
  DEFAULT_FILTERS,
  SEVERITY_KEYS,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  TRIAGE_STAGES,
  applyFilters,
  sortFindings,
  countActiveFilters,
  activeFilterLabels,
  PILL_RESETS,
  groupFindings,
  fuzzyScore,
  highlightSegments,
  suggestFilterFixes,
  countHiddenFalsePositives,
  describeExportSet,
  findingsToCsv,
  serializeFilters,
  deserializeFilters,
  pushHistory,
  undoOnce,
  redoOnce,
  saveFilterState,
  loadFilterState,
  saveUserDefault,
  loadUserDefault,
  clearUserDefault,
  recordRecentSearch,
  getRecentSearches,
  clearRecentSearches,
  recordRecentFilters,
  getRecentFilters,
  recordPresetUse,
  getPresetUsage,
  POPULAR_THRESHOLD,
  getSeenWatermark,
  markAllSeen,
  saveSortPrefs,
  loadSortPrefs,
  presetsToJson,
  presetsFromJson,
  makeSavedSearch,
} from './filtersCore';
import { FC_SEVERITY } from './FindingCards';
import './FindingCards5.css';

/* ------------------------------------------------------------------ */
/* 50219 / 50205 / 50234 — useFilterState: filters + undo + persistence */
/* ------------------------------------------------------------------ */

/**
 * Central filter-state hook: loads hunt-scoped persisted state, falls back to
 * the user's default filter (50232), pushes every committed change onto an
 * undo stack (50234, Ctrl+Z / Ctrl+Shift+Z), persists per hunt (50219) and
 * records recently-used filters (50202). Sort prefs persist per user (50205).
 */
export function useFilterState({ huntId = 'default', currentUserId = null, initialFilters = {} } = {}) {
  const [filters, setFiltersState] = React.useState(() => {
    const saved = loadFilterState(huntId);
    const userDefault = loadUserDefault();
    const sortPrefs = loadSortPrefs();
    return {
      ...DEFAULT_FILTERS,
      ...(userDefault || {}),
      ...(saved || {}),
      ...initialFilters,
      ...(sortPrefs ? { sortKey: sortPrefs.sortKey, sortDir: sortPrefs.sortDir } : {}),
    };
  });
  const [history, setHistory] = React.useState([filters]);
  const [future, setFuture] = React.useState([]);
  const [tagPriorityOrder, setTagPriorityOrder] = React.useState(() => filters.tags || []);

  const commit = React.useCallback((next) => {
    setFiltersState(next);
    setHistory((h) => pushHistory(h, next));
    setFuture([]);
  }, []);

  const setFilter = React.useCallback((key, value) => {
    commit((prev) => (typeof prev === 'object' ? { ...prev, [key]: value } : prev));
  }, [commit]);

  // function-form updater support
  const update = React.useCallback((updater) => {
    setFiltersState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      setHistory((h) => pushHistory(h, next));
      setFuture([]);
      return next;
    });
  }, []);

  const undo = React.useCallback(() => {
    const res = undoOnce(history, future);
    if (res) { setFiltersState(res.filters); setHistory(res.history); setFuture(res.future); }
  }, [history, future]);

  const redo = React.useCallback(() => {
    const res = redoOnce(history, future);
    if (res) { setFiltersState(res.filters); setHistory(res.history); setFuture(res.future); }
  }, [history, future]);

  const resetAll = React.useCallback(() => {
    const userDefault = loadUserDefault();
    commit({ ...DEFAULT_FILTERS, ...(userDefault || {}) });
  }, [commit]);

  const applyPreset = React.useCallback((presetFilters, presetName) => {
    update((prev) => ({ ...DEFAULT_FILTERS, sortKey: prev.sortKey, sortDir: prev.sortDir, ...presetFilters }));
    if (presetName) recordPresetUse(presetName);
  }, [update]);

  // 50234 — Ctrl+Z / Ctrl+Shift+Z restores previous filter sets (skipped inside text inputs).
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (document.activeElement && document.activeElement.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // 50219 — persist on every change (debounced); 50202 — record recent filters.
  const persistTimer = React.useRef(null);
  React.useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      saveFilterState(huntId, filters);
      recordRecentFilters(filters);
    }, 400);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
  }, [filters, huntId]);

  // 50205 — persist sort prefs per user.
  React.useEffect(() => {
    saveSortPrefs(filters.sortKey, filters.sortDir);
  }, [filters.sortKey, filters.sortDir]);

  return {
    filters, setFilter, update, commit, resetAll, applyPreset, undo, redo,
    canUndo: history.length > 1, canRedo: future.length > 0,
    tagPriorityOrder, setTagPriorityOrder,
    ctx: { currentUserId, currentHuntId: huntId, seenWatermark: getSeenWatermark() },
  };
}

/* ------------------------------------------------------------------ */
/* 50201 — global keyboard shortcuts: / focuses search, ? shows help     */
/* ------------------------------------------------------------------ */

/** Scope marker: any input with data-fc5-search-input can be focused by "/". */
export function useSearchInputRef() {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.setAttribute('data-fc5-search-input', '1');
    return () => { if (ref.current) ref.current.removeAttribute('data-fc5-search-input'); };
  }, []);
  return ref;
}

/**
 * 50201 — listens for "/" (focus search), "?" (toggle shortcuts help),
 * Escape (close overlays). Skipped while typing in inputs.
 */
export function useGlobalShortcuts({ onToggleHelp } = {}) {
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (document.activeElement && document.activeElement.isContentEditable);
      if (e.key === 'Escape') {
        if (onToggleHelp) onToggleHelp(false);
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        const el = document.querySelector('[data-fc5-search-input]');
        if (el) el.focus();
      } else if (e.key === '?') {
        if (onToggleHelp) onToggleHelp(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggleHelp]);
}

/** 50201 — overlay listing every keyboard shortcut. */
export function ShortcutsHelpOverlay({ open = false, onClose }) {
  if (!open) return null;
  const rows = [
    ['/', 'Focus the findings search box'],
    ['?', 'Open this shortcuts help'],
    ['Ctrl/⌘ + Z', 'Undo the last filter change'],
    ['Ctrl/⌘ + Shift + Z', 'Redo a filter change'],
    ['Ctrl/⌘ + K', 'Open the command palette'],
    ['Esc', 'Close overlays and dialogs'],
    ['Enter', 'Run a command-palette item'],
  ];
  return (
    <div className="fc5-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="fc5-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="fc5-dialog-head">
          <h3>Keyboard shortcuts</h3>
          <button type="button" className="fc5-icon-btn" onClick={onClose} aria-label="Close shortcuts help">✕</button>
        </div>
        <dl className="fc5-shortcut-list">
          {rows.map(([key, desc]) => (
            <div key={key} className="fc5-shortcut-row">
              <dt><kbd>{key}</kbd></dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50234 — undo / redo buttons                                           */
/* ------------------------------------------------------------------ */

export function UndoRedoControls({ canUndo = false, canRedo = false, onUndo, onRedo, className = '' }) {
  return (
    <div className={`fc5-undo ${className}`} role="group" aria-label="Undo and redo filter changes">
      <button type="button" disabled={!canUndo} onClick={onUndo} title="Undo filter change (Ctrl+Z)" aria-label="Undo filter change">↩ Undo</button>
      <button type="button" disabled={!canRedo} onClick={onRedo} title="Redo filter change (Ctrl+Shift+Z)" aria-label="Redo filter change">↪ Redo</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50235 — global command palette (Cmd+K)                                */
/* ------------------------------------------------------------------ */

/**
 * Jump-to-anywhere palette. `targets` is a real list of {id, label, kind, run};
 * default targets navigate the app shell via hash routes.
 */
export function CommandPalette({ targets = [], open: controlledOpen, onOpenChange, className = '' }) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v) => { if (onOpenChange) onOpenChange(v); else setInternalOpen(v); };
  const [query, setQuery] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef(null);

  const defaultTargets = React.useMemo(() => ([
    { id: 'findings', label: 'Go to findings list', kind: 'Findings', run: () => { window.location.hash = '#/hunts'; } },
    { id: 'hunts', label: 'Go to hunts', kind: 'Hunts', run: () => { window.location.hash = '#/hunts'; } },
    { id: 'reports', label: 'Go to reports', kind: 'Reports', run: () => { window.location.hash = '#/reports'; } },
    { id: 'settings', label: 'Open settings', kind: 'Settings', run: () => { window.location.hash = '#/settings'; } },
  ]), []);
  const all = targets.length ? targets : defaultTargets;

  const results = React.useMemo(() => {
    const q = query.trim();
    if (!q) return all;
    return all
      .map((t) => ({ t, s: fuzzyScore(q, `${t.label} ${t.kind}`) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.t);
  }, [all, query]);

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open); setQuery(''); setActiveIdx(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  React.useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open ]);

  if (!open) return null;
  const run = (t) => { setOpen(false); if (t && typeof t.run === 'function') t.run(); };
  return (
    <div className={`fc5-overlay ${className}`} role="dialog" aria-modal="true" aria-label="Command palette" onClick={() => setOpen(false)}>
      <div className="fc5-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef} type="text" value={query} placeholder="Jump to findings, hunts, reports, settings…"
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && results[activeIdx]) run(results[activeIdx]);
            if (e.key === 'Escape') setOpen(false);
          }}
          aria-label="Command palette search"
        />
        <ul className="fc5-palette-list" role="listbox" aria-label="Palette results">
          {results.map((t, i) => (
            <li key={t.id} role="option" aria-selected={i === activeIdx}
                className={i === activeIdx ? 'fc5-active' : ''} onClick={() => run(t)}>
              <span className="fc5-palette-kind">{t.kind}</span>
              <span>{t.label}</span>
            </li>
          ))}
          {results.length === 0 && <li className="fc5-palette-empty">No matches for “{query}”.</li>}
        </ul>
        <div className="fc5-palette-hint">Ctrl/⌘+K to toggle · ↑↓ to move · Enter to jump</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50237 — debounced search input (150ms) + highlight                   */
/* ------------------------------------------------------------------ */

/** 50237 — search-as-you-type with a real 150ms debounce. */
export function DebouncedSearchInput({ value = '', onChange, placeholder = 'Search titles and evidence…  ( / )', className = '' }) {
  const [draft, setDraft] = React.useState(value);
  const ref = useSearchInputRef();
  const timer = React.useRef(null);

  React.useEffect(() => { setDraft(value); }, [value]);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const handle = (v) => {
    setDraft(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (onChange) onChange(v); }, 150);
  };

  return (
    <label className={`fc5-search ${className}`}>
      <span aria-hidden="true" className="fc5-search-icon">⌕</span>
      <input
        ref={ref} type="search" value={draft} placeholder={placeholder}
        onChange={(e) => handle(e.target.value)} aria-label="Search findings"
      />
      {draft && (
        <button type="button" className="fc5-search-x" onClick={() => handle('')} aria-label="Clear search">✕</button>
      )}
    </label>
  );
}

/** 50237 — renders text with matched query terms highlighted. */
export function HighlightedText({ text = '', query = '', regexMode = false, className = '' }) {
  const segments = highlightSegments(text, query, { regexMode });
  return (
    <span className={`fc5-highlight ${className}`}>
      {segments.map((s, i) => (s.match
        ? <mark key={i} className="fc5-mark">{s.text}</mark>
        : <React.Fragment key={i}>{s.text}</React.Fragment>))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 50238 — scoped search tabs                                            */
/* ------------------------------------------------------------------ */

/** 50238 — This hunt / All hunts / Reports / Docs with real per-tab counts. */
export function ScopedSearchTabs({ value = 'thisHunt', onChange, counts = {}, className = '' }) {
  const tabs = [
    { key: 'thisHunt', label: 'This hunt' },
    { key: 'allHunts', label: 'All hunts' },
    { key: 'reports', label: 'Reports' },
    { key: 'docs', label: 'Docs' },
  ];
  return (
    <div className={`fc5-tabs ${className}`} role="tablist" aria-label="Search scope">
      {tabs.map((t) => (
        <button
          key={t.key} type="button" role="tab" aria-selected={value === t.key}
          className={value === t.key ? 'fc5-active' : ''}
          onClick={() => onChange && onChange(t.key)}
        >
          {t.label}
          {typeof counts[t.key] === 'number' && <span className="fc5-tab-count">{counts[t.key]}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50239 — recent searches dropdown                                      */
/* ------------------------------------------------------------------ */

/** 50239 — one-click rerun of recent queries + clear-all. */
export function RecentSearchesDropdown({ onRerun, className = '' }) {
  const [items, setItems] = React.useState(() => getRecentSearches());
  const [open, setOpen] = React.useState(false);
  const refresh = () => setItems(getRecentSearches());
  return (
    <div className={`fc5-dropdown ${className}`}>
      <button type="button" className="fc5-ghost-btn" aria-haspopup="listbox" aria-expanded={open}
              onClick={() => { refresh(); setOpen((o) => !o); }}>
        Recent searches
      </button>
      {open && (
        <ul className="fc5-dropdown-list" role="listbox" aria-label="Recent searches">
          {items.length === 0 && <li className="fc5-dropdown-empty">No recent searches yet.</li>}
          {items.map((s) => (
            <li key={`${s.at}-${s.query}`}>
              <button type="button" onClick={() => { if (onRerun) onRerun(s.query); setOpen(false); }}>
                <span className="fc5-search-icon" aria-hidden="true">⌕</span> {s.query}
              </button>
            </li>
          ))}
          {items.length > 0 && (
            <li className="fc5-dropdown-foot">
              <button type="button" onClick={() => { clearRecentSearches(); refresh(); }}>Clear all</button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50240 — named saved searches, pinnable to the sidebar                 */
/* ------------------------------------------------------------------ */

/** 50240 — save the current filter set under a custom name. */
export function SavedSearchesPanel({ filters, saved = [], onSave, onApply, onDelete, onTogglePin, className = '' }) {
  const [name, setName] = React.useState('');
  return (
    <div className={`fc5-saved ${className}`}>
      <div className="fc5-saved-form">
        <input
          type="text" value={name} placeholder="Name this search…"
          onChange={(e) => setName(e.target.value)} aria-label="Saved search name"
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && onSave) { onSave(name.trim()); setName(''); } }}
        />
        <button type="button" disabled={!name.trim()} onClick={() => { if (onSave) onSave(name.trim()); setName(''); }}>
          Save search
        </button>
      </div>
      <ul className="fc5-saved-list">
        {saved.map((s) => (
          <li key={s.id} className={s.pinned ? 'fc5-pinned' : ''}>
            <button type="button" className="fc5-saved-name" onClick={() => onApply && onApply(s)} title="Apply this saved search">
              {s.name}
            </button>
            <button type="button" className="fc5-icon-btn" aria-pressed={!!s.pinned} title={s.pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
                    onClick={() => onTogglePin && onTogglePin(s.id)}>
              {s.pinned ? '★' : '☆'}
            </button>
            <button type="button" className="fc5-icon-btn" aria-label={`Delete saved search ${s.name}`}
                    onClick={() => onDelete && onDelete(s.id)}>✕</button>
          </li>
        ))}
        {saved.length === 0 && <li className="fc5-dropdown-empty">No saved searches yet.</li>}
      </ul>
    </div>
  );
}

/** 50240 — pinned searches shown as a sidebar rail. */
export function PinnedSearchRail({ saved = [], onApply, className = '' }) {
  const pinned = saved.filter((s) => s.pinned);
  if (pinned.length === 0) return null;
  return (
    <nav className={`fc5-rail ${className}`} aria-label="Pinned saved searches">
      <span className="fc5-rail-title">Pinned</span>
      {pinned.map((s) => (
        <button key={s.id} type="button" className="fc5-rail-item" onClick={() => onApply && onApply(s)} title="Apply pinned search">
          ★ {s.name}
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* 50221 — regex search toggle                                           */
/* ------------------------------------------------------------------ */

/** 50221 — regex mode for the text filter, with an inline syntax hint. */
export function RegexModeToggle({ value = false, onChange, className = '' }) {
  return (
    <div className={`fc5-regex ${className}`}>
      <button
        type="button" role="switch" aria-checked={value}
        className={`fc5-switch fc5-switch-sm ${value ? 'fc5-on' : ''}`}
        onClick={() => onChange && onChange(!value)}
      >
        <span className="fc5-switch-track" aria-hidden="true"><span className="fc5-switch-thumb" /></span>
        <span className="fc5-switch-label"><code>.*</code> regex</span>
      </button>
      {value && (
        <span className="fc5-hint" role="note">
          Regex mode: <code>.</code> any · <code>*</code> repeat · <code>^$</code> anchors · <code>( )</code> group · <code>[ ]</code> class · invalid patterns match nothing.
        </span>
      )}
    </div>
  );
}

/** 50236 — typo-tolerant fuzzy matching for titles. */
export function FuzzySearchToggle({ value = false, onChange, className = '' }) {
  return (
    <button
      type="button" role="switch" aria-checked={value}
      className={`fc5-switch fc5-switch-sm ${value ? 'fc5-on' : ''} ${className}`}
      onClick={() => onChange && onChange(!value)}
      title="Tolerate typos in the search query (e.g. xss still matches)"
    >
      <span className="fc5-switch-track" aria-hidden="true"><span className="fc5-switch-thumb" /></span>
      <span className="fc5-switch-label">Fuzzy match</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50211 — risk-score range slider                                       */
/* ------------------------------------------------------------------ */

/** 50211 — dual min/max slider filtering by numeric risk score (0–10). */
export function RiskScoreRangeSlider({ min = 0, max = 10, onChange, className = '' }) {
  const setMin = (v) => { const nv = Math.min(v, max); if (onChange) onChange(nv, max); };
  const setMax = (v) => { const nv = Math.max(v, min); if (onChange) onChange(min, nv); };
  return (
    <div className={`fc5-risk ${className}`}>
      <span className="fc5-field-label">Risk score <strong>{min}–{max}</strong></span>
      <div className="fc5-risk-sliders">
        <input type="range" min={0} max={10} step={0.5} value={min}
               onChange={(e) => setMin(parseFloat(e.target.value))} aria-label="Minimum risk score" />
        <input type="range" min={0} max={10} step={0.5} value={max}
               onChange={(e) => setMax(parseFloat(e.target.value))} aria-label="Maximum risk score" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50213 — severity histogram chips                                      */
/* ------------------------------------------------------------------ */

/** 50213 — severity chips with an embedded histogram bar of the distribution. */
export function SeverityHistogramChips({ findings = [], selected = [], onChange, className = '' }) {
  const counts = React.useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) { if (f && c[f.severity] !== undefined) c[f.severity] += 1; }
    return c;
  }, [findings]);
  const peak = Math.max(1, ...Object.values(counts));
  const sel = new Set(selected);
  const toggle = (sev) => {
    const next = new Set(sel);
    if (next.has(sev)) next.delete(sev); else next.add(sev);
    if (onChange) onChange([...next]);
  };
  return (
    <div className={`fc5-hist ${className}`} role="group" aria-label="Filter by severity">
      {SEVERITY_KEYS.map((sev) => (
        <button
          key={sev} type="button" aria-pressed={sel.has(sev)}
          className={`fc5-hist-chip fc5-sev-${sev} ${sel.has(sev) ? 'fc5-active' : ''}`}
          style={{ '--fc5-sev': FC_SEVERITY[sev] ? FC_SEVERITY[sev].color : '#8b96ad' }}
          onClick={() => toggle(sev)}
          title={`${sev}: ${counts[sev]} findings`}
        >
          <span className="fc5-hist-bars" aria-hidden="true">
            <span className="fc5-hist-bar" style={{ height: `${Math.max(8, (counts[sev] / peak) * 100)}%` }} />
          </span>
          <span className="fc5-hist-label">{sev}</span>
          <span className="fc5-hist-count">{counts[sev]}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50204 / 50212 — false-positive exclusion + dismissed toggle           */
/* ------------------------------------------------------------------ */

/** 50204 — "Exclude false positives" defaults on; shows how many are hidden. */
export function ExcludeFpToggle({ value = true, hiddenCount = 0, onChange, className = '' }) {
  return (
    <button
      type="button" role="switch" aria-checked={value}
      className={`fc5-switch ${value ? 'fc5-on' : ''} ${className}`}
      onClick={() => onChange && onChange(!value)}
      title="Hide findings marked as false positives"
    >
      <span className="fc5-switch-track" aria-hidden="true"><span className="fc5-switch-thumb" /></span>
      <span className="fc5-switch-label">
        Exclude false positives
        {value && hiddenCount > 0 && <span className="fc5-hidden-count">{hiddenCount} hidden</span>}
      </span>
    </button>
  );
}

/** 50212 — reveal dismissed FP rows, shown muted. */
export function ShowDismissedToggle({ value = false, onChange, className = '' }) {
  return (
    <button
      type="button" role="switch" aria-checked={value}
      className={`fc5-switch fc5-switch-sm ${value ? 'fc5-on' : ''} ${className}`}
      onClick={() => onChange && onChange(!value)}
      title="Show dismissed findings in a muted style"
    >
      <span className="fc5-switch-track" aria-hidden="true"><span className="fc5-switch-thumb" /></span>
      <span className="fc5-switch-label">Show dismissed</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50203 — assignee filter                                               */
/* ------------------------------------------------------------------ */

/** 50203 — filter by reviewer/assignee, with avatar initials. */
export function AssigneeFilter({ findings = [], value = 'all', onChange, className = '' }) {
  const assignees = React.useMemo(() => {
    const map = new Map();
    for (const f of findings) {
      const a = f && f.assignee;
      if (!a || !a.name) continue;
      if (!map.has(a.name)) map.set(a.name, { ...a, count: 0 });
      map.get(a.name).count += 1;
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [findings]);
  return (
    <label className={`fc5-assignee ${className}`}>
      <span className="fc5-field-label">Assignee</span>
      <select value={value} onChange={(e) => onChange && onChange(e.target.value)} aria-label="Filter by assignee">
        <option value="all">Everyone</option>
        <option value="unassigned">Unassigned</option>
        {assignees.map((a) => (
          <option key={a.name} value={a.name}>{a.name} ({a.count})</option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* 50210 / 50214 / 50216 / 50222 / 50224 / 50228 / 50230 — quick toggles */
/* ------------------------------------------------------------------ */

function SimpleSwitch({ label, title, value, onChange, small = false, className = '' }) {
  return (
    <button
      type="button" role="switch" aria-checked={value} title={title || label}
      className={`fc5-switch ${small ? 'fc5-switch-sm' : ''} ${value ? 'fc5-on' : ''} ${className}`}
      onClick={() => onChange && onChange(!value)}
    >
      <span className="fc5-switch-track" aria-hidden="true"><span className="fc5-switch-thumb" /></span>
      <span className="fc5-switch-label">{label}</span>
    </button>
  );
}

/** 50210 — fixed findings awaiting verification get their own queue view. */
export function NeedsRetestToggle(props) {
  return <SimpleSwitch label="Needs retest" title="Show fixed findings awaiting verification" {...props} />;
}
/** 50214 — only findings the current user personally interacted with. */
export function MyFindingsToggle(props) {
  return <SimpleSwitch label="My findings" title="Show only findings you interacted with" small {...props} />;
}
/** 50224 — bookmarked findings get their own view. */
export function StarredToggle(props) {
  return <SimpleSwitch label="Starred only" title="Show only starred findings" small {...props} />;
}
/** 50228 — show only findings NEW versus the previous hunt. */
export function CompareModeToggle(props) {
  return <SimpleSwitch label="New vs previous hunt" title="Show only findings not seen in the previous hunt" small {...props} />;
}

/** 50216 — PoC replayability: replayable vs manual-only. */
export function ReplayabilitySegmented({ value = 'all', onChange, className = '' }) {
  const opts = [
    { key: 'all', label: 'Any' },
    { key: 'replayable', label: 'Replayable' },
    { key: 'manual', label: 'Manual only' },
  ];
  return (
    <div className={`fc5-segmented ${className}`} role="group" aria-label="Filter by PoC replayability">
      {opts.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key}
                className={value === o.key ? 'fc5-active' : ''}
                onClick={() => onChange && onChange(o.key)} title="Filter by PoC replayability">
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 50222 — filter by evidence type. */
export function EvidenceTypeFilter({ value = 'all', onChange, counts = {}, className = '' }) {
  const opts = ['all', ...EVIDENCE_TYPES];
  return (
    <div className={`fc5-evtype ${className}`} role="group" aria-label="Filter by evidence type">
      {opts.map((t) => (
        <button key={t} type="button" aria-pressed={value === t}
                className={`fc5-evtype-btn ${value === t ? 'fc5-active' : ''}`}
                onClick={() => onChange && onChange(t)}>
          {t === 'all' ? 'Any evidence' : EVIDENCE_TYPE_LABELS[t]}
          {typeof counts[t] === 'number' && <span className="fc5-chip-count">{counts[t]}</span>}
        </button>
      ))}
    </div>
  );
}

/** 50230 — agent-discovered vs human-confirmed origin. */
export function OriginSegmented({ value = 'all', onChange, className = '' }) {
  const opts = [
    { key: 'all', label: 'Any origin' },
    { key: 'agent', label: 'Agent-discovered' },
    { key: 'human', label: 'Human-confirmed' },
  ];
  return (
    <div className={`fc5-segmented ${className}`} role="group" aria-label="Filter by finding origin">
      {opts.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key}
                className={value === o.key ? 'fc5-active' : ''}
                onClick={() => onChange && onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 50231 — open longer than 7 / 30 days, for SLA tracking. */
export function AgingSegmented({ value = 'all', onChange, className = '' }) {
  const opts = [
    { key: 'all', label: 'Any age' },
    { key: '7d', label: 'Open > 7 days' },
    { key: '30d', label: 'Open > 30 days' },
  ];
  return (
    <div className={`fc5-segmented ${className}`} role="group" aria-label="Filter by finding age">
      {opts.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key}
                className={value === o.key ? 'fc5-active' : ''}
                onClick={() => onChange && onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50229 — confidence-band presets                                       */
/* ------------------------------------------------------------------ */

/** 50229 — "high only (>80%)" and "review queue (<60%)" one-click bands. */
export function ConfidenceBandPresets({ value = 'all', onChange, className = '' }) {
  const opts = [
    { key: 'all', label: 'All confidence' },
    { key: 'high', label: 'High only (>80%)' },
    { key: 'review', label: 'Review queue (<60%)' },
  ];
  return (
    <div className={`fc5-segmented ${className}`} role="group" aria-label="Confidence band presets">
      {opts.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key}
                className={value === o.key ? 'fc5-active' : ''}
                onClick={() => onChange && onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50207 — changed-since-visit (seen watermark)                          */
/* ------------------------------------------------------------------ */

/**
 * 50207 — the seen watermark powers an "only changed since last visit"
 * filter. "Mark all seen" stamps the watermark; the filter then shows only
 * findings updated after it.
 */
export function ChangedSinceVisitToggle({ value = false, onChange, onMarkSeen, className = '' }) {
  return (
    <div className={`fc5-changed ${className}`}>
      <SimpleSwitch label="Changed since visit" title="Show only findings updated since your last visit" small
                    value={value} onChange={onChange} />
      <button type="button" className="fc5-ghost-btn" onClick={onMarkSeen} title="Stamp the seen watermark to now">
        Mark all seen
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50217 — untriaged-criticals emergency preset                          */
/* ------------------------------------------------------------------ */

/** 50217 — one click: critical + new + unreviewed. */
export function UntriagedCriticalsPreset({ onApply, className = '' }) {
  return (
    <button
      type="button" className={`fc5-emergency ${className}`}
      onClick={() => onApply && onApply({
        severities: ['critical'],
        status: 'new',
        unreviewedOnly: true,
        excludeFalsePositives: true,
      }, 'untriaged-criticals')}
      title="Surface untriaged critical findings immediately"
    >
      Untriaged criticals
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50220 — similar-to-this filter                                        */
/* ------------------------------------------------------------------ */

/**
 * 50220 — an open finding seeds a "similar to this" filter (same severity,
 * same OWASP category, or shared tags) for hunting duplicates.
 */
export function SimilarToThisButton({ finding, active = false, onToggle, className = '' }) {
  if (!finding) return null;
  return (
    <button
      type="button" aria-pressed={active}
      className={`fc5-similar ${active ? 'fc5-active' : ''} ${className}`}
      onClick={() => onToggle && onToggle(finding)}
      title={`Find findings similar to "${finding.title || finding.id}" (same severity, OWASP, or tags)`}
    >
      {active ? 'Similar: on' : 'Similar to this'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50205 / 50223 — sort dropdown with persistent direction               */
/* ------------------------------------------------------------------ */

const SORT_OPTIONS = [
  { key: 'severity', label: 'Severity' },
  { key: 'priority', label: 'Priority score' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'firstSeen', label: 'First seen' },   // 50223
  { key: 'lastUpdated', label: 'Last updated' }, // 50223
  { key: 'title', label: 'Title A–Z' },
];

/** 50205 — sort key + direction toggle; direction persists per user across sessions. */
export function SortDropdown5({ sortKey = 'severity', sortDir = 'desc', onChange, className = '' }) {
  const set = (key, dir) => { if (onChange) onChange(key ?? sortKey, dir ?? sortDir); };
  return (
    <div className={`fc5-sortwrap ${className}`}>
      <label className="fc5-sort">
        <span className="fc5-field-label">Sort</span>
        <select value={sortKey} onChange={(e) => set(e.target.value)} aria-label="Sort findings">
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <button
        type="button" className="fc5-dir-btn" aria-label={`Sort direction: ${sortDir === 'desc' ? 'descending' : 'ascending'}. Toggle to change.`}
        onClick={() => set(undefined, sortDir === 'desc' ? 'asc' : 'desc')}
        title="Toggle sort direction (persists across sessions)"
      >
        {sortDir === 'desc' ? '↓ desc' : '↑ asc'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50206 — group-by control + grouped list                               */
/* ------------------------------------------------------------------ */

const GROUP_OPTIONS = [
  { key: 'none', label: 'No grouping' },
  { key: 'severity', label: 'Severity' },
  { key: 'host', label: 'Host' },
  { key: 'owasp', label: 'OWASP category' },
  { key: 'phase', label: 'Discovery phase' },
];

/** 50206 — group the list by severity, host, OWASP category, or discovery phase. */
export function GroupByControl({ value = 'none', onChange, className = '' }) {
  return (
    <label className={`fc5-groupby ${className}`}>
      <span className="fc5-field-label">Group by</span>
      <select value={value} onChange={(e) => onChange && onChange(e.target.value)} aria-label="Group findings by">
        {GROUP_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** 50206 — renders grouped findings; renderFinding draws one row. */
export function GroupedFindingsView({ groups = [], renderFinding, selectedIds = [], onToggleSelect, className = '' }) {
  return (
    <div className={`fc5-groups ${className}`}>
      {groups.map((g) => (
        <section key={g.key} className="fc5-group">
          <header className="fc5-group-head">
            <h4>{g.label}</h4>
            <span className="fc5-chip-count">{g.items.length}</span>
          </header>
          <ul className="fc5-group-list">
            {g.items.map((f) => (
              <li key={f.id} className={f.dismissed ? 'fc5-dismissed-row' : ''}>
                {onToggleSelect && (
                  <input
                    type="checkbox" checked={selectedIds.includes(f.id)} aria-label={`Select ${f.title || f.id}`}
                    onChange={() => onToggleSelect(f.id)}
                  />
                )}
                {renderFinding ? renderFinding(f) : <span>{f.title}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50208 — select all filtered                                           */
/* ------------------------------------------------------------------ */

/** 50208 — bulk selection offers "select all N shown" for the filtered set. */
export function SelectAllFilteredBar({ filtered = [], selectedIds = [], onChange, className = '' }) {
  const allSelected = filtered.length > 0 && filtered.every((f) => selectedIds.includes(f.id));
  return (
    <div className={`fc5-selectall ${className}`} role="group" aria-label="Bulk selection">
      <button
        type="button" disabled={filtered.length === 0}
        onClick={() => onChange && onChange(allSelected ? [] : filtered.map((f) => f.id))}
      >
        {allSelected ? 'Clear selection' : `Select all ${filtered.length} shown`}
      </button>
      {selectedIds.length > 0 && <span className="fc5-selected-count">{selectedIds.length} selected</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50215 — export respects filters                                       */
/* ------------------------------------------------------------------ */

/**
 * 50215 — export operates on the currently filtered set; the dialog states
 * exactly that, and downloads a real CSV.
 */
export function ExportFilteredButton({ filtered = [], total = 0, fileName = 'findings-export.csv', className = '' }) {
  const [open, setOpen] = React.useState(false);
  const download = () => {
    const csv = findingsToCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
  };
  return (
    <div className={`fc5-export ${className}`}>
      <button type="button" className="fc5-ghost-btn" onClick={() => setOpen(true)} disabled={filtered.length === 0}>
        Export CSV
      </button>
      {open && (
        <div className="fc5-overlay" role="dialog" aria-modal="true" aria-label="Export findings" onClick={() => setOpen(false)}>
          <div className="fc5-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fc5-dialog-head">
              <h3>Export findings</h3>
              <button type="button" className="fc5-icon-btn" onClick={() => setOpen(false)} aria-label="Close export dialog">✕</button>
            </div>
            <p className="fc5-dialog-body">{describeExportSet(filtered, total)}</p>
            <div className="fc5-dialog-foot">
              <button type="button" className="fc5-ghost-btn" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="fc5-primary-btn" onClick={download} disabled={filtered.length === 0}>
                Download {filtered.length} rows
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50225 — filter fix suggestions                                        */
/* ------------------------------------------------------------------ */

/** 50225 — when nothing matches, suggest which filter to remove, ranked by restored count. */
export function FilterFixSuggestions({ findings = [], filters = {}, ctx = {}, onRemove, className = '' }) {
  const fixes = React.useMemo(() => suggestFilterFixes(findings, filters, ctx), [findings, filters, ctx]);
  if (fixes.length === 0) return null;
  return (
    <div className={`fc5-fixes ${className}`} role="note" aria-label="Filter fix suggestions">
      <span className="fc5-fixes-title">No results. Try removing:</span>
      {fixes.map((fx) => (
        <button key={fx.key} type="button" className="fc5-fix-btn" onClick={() => onRemove && onRemove(fx.key)}
                title={`Removing this restores ${fx.restores} findings`}>
          {fx.label} <span className="fc5-chip-count">+{fx.restores}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50226 — drag-to-reorder pills                                         */
/* ------------------------------------------------------------------ */

/**
 * 50226 — active filter pills drag to reorder. When tags are active in OR
 * mode, the individual tag pills set precedence: the resulting tag order
 * feeds sortFindings as a priority tie-break.
 */
export function ReorderableFilterPills({ filters = {}, tagPriorityOrder = [], onRemovePill, onClearAll, onReorderTags, onReorderPills, className = '' }) {
  const labels = activeFilterLabels(filters);
  const [order, setOrder] = React.useState(() => labels.map((l) => l.key));
  const dragKey = React.useRef(null);

  React.useEffect(() => {
    setOrder((prev) => {
      const keys = labels.map((l) => l.key);
      const kept = prev.filter((k) => keys.includes(k));
      const added = keys.filter((k) => !kept.includes(k));
      return [...kept, ...added];
    });
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const ordered = order.map((k) => labels.find((l) => l.key === k)).filter(Boolean);
  const f = { ...DEFAULT_FILTERS, ...filters };
  const tags = f.tags || [];

  const onDragStart = (e, key) => { dragKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e, key) => {
    e.preventDefault();
    if (!dragKey.current || dragKey.current === key) return;
    setOrder((prev) => {
      const next = prev.filter((k) => k !== dragKey.current);
      next.splice(next.indexOf(key), 0, dragKey.current);
      return next;
    });
  };
  const onDropPill = () => {
    const final = order.filter((k) => k !== dragKey.current);
    if (onReorderPills) onReorderPills(final);
    dragKey.current = null;
  };
  const onDropTag = (tag) => {
    const remaining = tagPriorityOrder.filter((t) => t !== dragKey.current);
    const next = [...remaining];
    next.splice(next.indexOf(tag) >= 0 ? next.indexOf(tag) : next.length, 0, dragKey.current);
    if (onReorderTags) onReorderTags(next);
    dragKey.current = null;
  };

  if (ordered.length === 0) return null;
  return (
    <div className={`fc5-pills ${className}`} aria-label="Active filters (drag to reorder)">
      {ordered.map((pill) => (
        <span key={pill.key} className="fc5-pill" draggable
              onDragStart={(e) => onDragStart(e, pill.key)}
              onDragOver={(e) => onDragOver(e, pill.key)}
              onDragEnd={onDropPill}
              title="Drag to reorder">
          {pill.key === 'tags' ? (
            <span className="fc5-pill-tags" aria-label={`Tags in ${f.tagLogic} mode`}>
              {tagPriorityOrder.map((t) => (
                <span key={t} className="fc5-pill-tag" draggable
                      onDragStart={(e) => onDragStart(e, `tag:${t}`)}
                      onDragOver={(e) => onDragOver(e, `tag:${t}`)}
                      onDragEnd={() => onDropTag(t)}
                      title="Drag to set OR-mode precedence">
                  {t}
                </span>
              ))}
              <span className="fc5-pill-tag-logic">({f.tagLogic})</span>
            </span>
          ) : pill.text}
          <button type="button" className="fc5-pill-x" aria-label={`Remove filter ${pill.text}`}
                  onClick={() => onRemovePill && onRemovePill(pill.key)}>✕</button>
        </span>
      ))}
      <button type="button" className="fc5-clear-all" onClick={onClearAll}>Clear all</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50218 — collapsible advanced filters                                  */
/* ------------------------------------------------------------------ */

/** 50218 — advanced filters collapse into a panel, keeping the bar clean. */
export function AdvancedFiltersPanel({ title = 'Advanced filters', activeCount = 0, defaultOpen = false, children, className = '' }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={`fc5-advanced ${open ? 'fc5-open' : ''} ${className}`}>
      <button type="button" className="fc5-advanced-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="fc5-advanced-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        {title}
        {activeCount > 0 && <span className="fc5-chip-count">{activeCount}</span>}
      </button>
      {open && <div className="fc5-advanced-body">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50202 — recently-used filters                                         */
/* ------------------------------------------------------------------ */

/** 50202 — one-click reapplication of recently used filter sets. */
export function RecentlyUsedFiltersRow({ onApply, className = '' }) {
  const [items, setItems] = React.useState(() => getRecentFilters());
  return (
    <div className={`fc5-recent ${className}`}>
      <span className="fc5-field-label">Recent</span>
      <div className="fc5-recent-row">
        {items.length === 0 && <span className="fc5-empty-note">No recent filter sets yet.</span>}
        {items.map((it, i) => (
          <button key={`${it.at}-${i}`} type="button" className="fc5-recent-item"
                  onClick={() => { if (onApply) onApply(it.filters); }}
                  title={`${it.active} active filters · ${new Date(it.at).toLocaleTimeString()}`}>
            {activeFilterLabels(it.filters).slice(0, 3).map((l) => l.text).join(' · ') || `${it.active} filters`}
          </button>
        ))}
        {items.length > 0 && (
          <button type="button" className="fc5-ghost-btn" onClick={() => setItems(getRecentFilters())} title="Refresh recent list">
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50233 / 50209 — preset bar with popular badges + cross-device sync    */
/* ------------------------------------------------------------------ */

const BUILT_IN_PRESETS = [
  { name: 'Critical review queue', filters: { severities: ['critical', 'high'], unreviewedOnly: true } },
  { name: 'Verified PoCs only', filters: { hasPoc: true, minConfidence: 60 } },
  { name: 'Agent-found, needs human', filters: { origin: 'agent', status: 'new' } },
  { name: 'Stale SLA risks', filters: { aging: '30d' } },
];

/**
 * 50233 — named presets carry a "Popular" badge once used often enough.
 * 50209 — presets sync across devices through export/import of the library.
 */
export function PresetBar({ onApply, className = '' }) {
  const [usage, setUsage] = React.useState(() => getPresetUsage());
  const [custom, setCustom] = React.useState([]);
  const fileRef = React.useRef(null);

  const apply = (name, presetFilters) => {
    if (onApply) onApply(presetFilters, name);
    setUsage(recordPresetUse(name));
  };

  const exportJson = () => {
    const blob = new Blob([presetsToJson([...BUILT_IN_PRESETS, ...custom])], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'filter-presets.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const importJson = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = presetsFromJson(reader.result);
        setCustom(imported.filter((p) => !BUILT_IN_PRESETS.some((b) => b.name === p.name)));
      } catch (err) {
        // surface the failure honestly instead of silently swallowing it
        window.alert(`Could not import presets: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const all = [...BUILT_IN_PRESETS, ...custom];
  return (
    <div className={`fc5-presets ${className}`}>
      <span className="fc5-field-label">Presets</span>
      <div className="fc5-presets-row">
        {all.map((p) => (
          <button key={p.name} type="button" className="fc5-preset-btn" onClick={() => apply(p.name, p.filters)} title={`Apply preset “${p.name}”`}>
            {p.name}
            {(usage[p.name] || 0) >= POPULAR_THRESHOLD && <span className="fc5-popular-badge">Popular</span>}
          </button>
        ))}
        <span className="fc5-preset-sync" role="group" aria-label="Sync presets across devices">
          <button type="button" className="fc5-ghost-btn" onClick={exportJson} title="Export presets as JSON to move to another device">
            Export
          </button>
          <button type="button" className="fc5-ghost-btn" onClick={() => fileRef.current && fileRef.current.click()} title="Import presets JSON from another device">
            Import
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJson} aria-label="Import presets JSON" />
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50232 — user default filter                                           */
/* ------------------------------------------------------------------ */

/** 50232 — save the current filter set as the personal default, applied on load. */
export function DefaultFilterManager({ filters, onClearDefault, className = '' }) {
  const [hasDefault, setHasDefault] = React.useState(() => !!loadUserDefault());
  return (
    <div className={`fc5-default ${className}`}>
      <button type="button" className="fc5-ghost-btn"
              onClick={() => { saveUserDefault(filters); setHasDefault(true); }}
              title="Save the current filters as your default (applied every time the view loads)">
        Save as my default
      </button>
      {hasDefault && (
        <button type="button" className="fc5-ghost-btn"
                onClick={() => { clearUserDefault(); setHasDefault(false); if (onClearDefault) onClearDefault(); }}>
          Clear default
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50198-equivalent — shareable filter URL button                        */
/* ------------------------------------------------------------------ */

/** Copying the URL preserves the exact active filter state for sharing. */
export function ShareableFilterUrlButton({ filters, className = '' }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    const qs = serializeFilters(filters);
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" className={`fc5-ghost-btn ${className}`} onClick={copy} title="Copy a URL with the exact current filter state">
      {copied ? 'Link copied' : 'Share filters'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50227 — mobile bottom-sheet filters                                   */
/* ------------------------------------------------------------------ */

/**
 * 50227 — on mobile the filter bar becomes a bottom sheet with real
 * Apply and Reset buttons. Draft state commits only on Apply.
 */
export function MobileFilterSheet({ filters, onApply, onReset, children, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(filters);
  React.useEffect(() => { if (open) setDraft(filters); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`fc5-sheet-wrap ${className}`}>
      <button type="button" className="fc5-sheet-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        Filters{countActiveFilters(filters) > 0 && <span className="fc5-chip-count">{countActiveFilters(filters)}</span>}
      </button>
      {open && (
        <div className="fc5-sheet-overlay" role="dialog" aria-modal="true" aria-label="Filters" onClick={() => setOpen(false)}>
          <div className="fc5-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fc5-sheet-grip" aria-hidden="true" />
            <div className="fc5-sheet-body">
              {typeof children === 'function' ? children(draft, setDraft) : children}
            </div>
            <div className="fc5-sheet-foot">
              <button type="button" className="fc5-ghost-btn" onClick={() => { if (onReset) onReset(); setOpen(false); }}>
                Reset
              </button>
              <button type="button" className="fc5-primary-btn" onClick={() => { if (onApply) onApply(draft); setOpen(false); }}>
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composite: <AdvancedFindingFilters> — the whole suite wired together  */
/* ------------------------------------------------------------------ */

/**
 * Demo/composite wiring every wave-6 control into the real pipeline.
 * `findings`: full finding array. `renderFinding(f)`: one result row.
 */
export function AdvancedFindingFilters({
  findings = [],
  huntId = 'default',
  currentUserId = null,
  renderFinding,
  className = '',
}) {
  const state = useFilterState({ huntId, currentUserId });
  const { filters, setFilter, update, resetAll, applyPreset, undo, redo, canUndo, canRedo, tagPriorityOrder, setTagPriorityOrder, ctx } = state;
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [savedSearches, setSavedSearches] = React.useState([]);
  const [recentRerunKey, setRecentRerunKey] = React.useState(0);

  useGlobalShortcuts({ onToggleHelp: (v) => setHelpOpen(v === undefined ? (o) => !o : v) });

  const filtered = React.useMemo(() => applyFilters(findings, filters, {
    ...ctx,
    similarFinding: filters.similarToId ? findings.find((f) => f && f.id === filters.similarToId) : null,
  }), [findings, filters, ctx]);
  const sorted = React.useMemo(
    () => sortFindings(filtered, filters.sortKey, filters.sortDir, tagPriorityOrder),
    [filtered, filters.sortKey, filters.sortDir, tagPriorityOrder],
  );
  const groups = React.useMemo(() => groupFindings(sorted, filters.groupBy), [sorted, filters.groupBy]);
  const hiddenFpCount = React.useMemo(() => countHiddenFalsePositives(findings), [findings]);
  const scopeCounts = React.useMemo(() => ({
    thisHunt: findings.filter((f) => !ctx.currentHuntId || !f.huntId || f.huntId === ctx.currentHuntId).length,
    allHunts: findings.length,
  }), [findings, ctx.currentHuntId]);
  const evCounts = React.useMemo(() => {
    const c = {};
    for (const t of EVIDENCE_TYPES) c[t] = findings.filter((f) => Array.isArray(f.evidence) && f.evidence.some((e) => e && e.type === t)).length;
    return c;
  }, [findings]);
  const activeCount = countActiveFilters(filters);

  const commitSearch = (v) => { setFilter('query', v); recordRecentSearch(v); setRecentRerunKey((k) => k + 1); };
  const removePill = (key) => { const reset = PILL_RESETS[key]; if (reset) update((p) => ({ ...p, ...reset })); };

  return (
    <div className={`fc5-root ${className}`}>
      <CommandPalette />
      <ShortcutsHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className="fc5-toolbar">
        <div className="fc5-row">
          <DebouncedSearchInput value={filters.query} onChange={commitSearch} />
          <RecentSearchesDropdown key={recentRerunKey} onRerun={commitSearch} />
          <RegexModeToggle value={filters.regexMode} onChange={(v) => setFilter('regexMode', v)} />
          <FuzzySearchToggle value={filters.fuzzy} onChange={(v) => setFilter('fuzzy', v)} />
          <button type="button" className="fc5-ghost-btn" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)" aria-label="Show keyboard shortcuts">?</button>
        </div>
        <div className="fc5-row">
          <ScopedSearchTabs value={filters.searchScope} counts={scopeCounts} onChange={(v) => setFilter('searchScope', v)} />
          <SortDropdown5 sortKey={filters.sortKey} sortDir={filters.sortDir}
                         onChange={(key, dir) => update((p) => ({ ...p, sortKey: key, sortDir: dir }))} />
          <GroupByControl value={filters.groupBy} onChange={(v) => setFilter('groupBy', v)} />
          <UndoRedoControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
        </div>
        <div className="fc5-row">
          <SeverityHistogramChips findings={findings} selected={filters.severities} onChange={(v) => setFilter('severities', v)} />
        </div>
        <div className="fc5-row">
          <ExcludeFpToggle value={filters.excludeFalsePositives} hiddenCount={hiddenFpCount}
                           onChange={(v) => setFilter('excludeFalsePositives', v)} />
          <ShowDismissedToggle value={filters.showDismissed} onChange={(v) => setFilter('showDismissed', v)} />
          <UntriagedCriticalsPreset onApply={applyPreset} />
          <ConfidenceBandPresets value={filters.confidenceBand} onChange={(v) => setFilter('confidenceBand', v)} />
        </div>
        <ReorderableFilterPills
          filters={filters} tagPriorityOrder={tagPriorityOrder.length ? tagPriorityOrder : (filters.tags || [])}
          onRemovePill={removePill} onClearAll={resetAll}
          onReorderTags={(order) => setTagPriorityOrder(order)}
        />
        <RecentlyUsedFiltersRow onApply={(snap) => update((p) => ({ ...p, ...snap }))} />
        <PresetBar onApply={applyPreset} />
        <AdvancedFiltersPanel title="Advanced filters" activeCount={activeCount}>
          <div className="fc5-advanced-grid">
            <RiskScoreRangeSlider min={filters.riskScoreMin} max={filters.riskScoreMax}
                                  onChange={(mn, mx) => update((p) => ({ ...p, riskScoreMin: mn, riskScoreMax: mx }))} />
            <AssigneeFilter findings={findings} value={filters.assignee} onChange={(v) => setFilter('assignee', v)} />
            <EvidenceTypeFilter value={filters.evidenceType} counts={evCounts} onChange={(v) => setFilter('evidenceType', v)} />
            <ReplayabilitySegmented value={filters.replayable} onChange={(v) => setFilter('replayable', v)} />
            <OriginSegmented value={filters.origin} onChange={(v) => setFilter('origin', v)} />
            <AgingSegmented value={filters.aging} onChange={(v) => setFilter('aging', v)} />
            <div className="fc5-inline-toggles">
              <NeedsRetestToggle value={filters.needsRetest} onChange={(v) => setFilter('needsRetest', v)} />
              <MyFindingsToggle value={filters.myFindings} onChange={(v) => setFilter('myFindings', v)} />
              <StarredToggle value={filters.starredOnly} onChange={(v) => setFilter('starredOnly', v)} />
              <CompareModeToggle value={filters.compareMode} onChange={(v) => setFilter('compareMode', v)} />
            </div>
            <ChangedSinceVisitToggle value={filters.changedSinceVisit}
                                     onChange={(v) => setFilter('changedSinceVisit', v)}
                                     onMarkSeen={() => markAllSeen()} />
            <div className="fc5-row">
              <DefaultFilterManager filters={filters} onClearDefault={resetAll} />
              <ShareableFilterUrlButton filters={filters} />
              <ExportFilteredButton filtered={sorted} total={findings.length} />
            </div>
            <SavedSearchesPanel
              filters={filters} saved={savedSearches}
              onSave={(name) => setSavedSearches((s) => [...s, makeSavedSearch(name, filters)])}
              onApply={(s) => update((p) => ({ ...p, ...s.filters }))}
              onDelete={(id) => setSavedSearches((s) => s.filter((x) => x.id !== id))}
              onTogglePin={(id) => setSavedSearches((s) => s.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)))}
            />
          </div>
        </AdvancedFiltersPanel>
      </div>

      <div className="fc5-body">
        <PinnedSearchRail saved={savedSearches} onApply={(s) => update((p) => ({ ...p, ...s.filters }))} />
        <div className="fc5-results">
          <div className="fc5-result-line" aria-live="polite">
            Showing <strong>{sorted.length}</strong> of {findings.length} findings
            {activeCount > 0 && <span> · {activeCount} filter{activeCount === 1 ? '' : 's'} active</span>}
            {filters.excludeFalsePositives && hiddenFpCount > 0 && (
              <span> · {hiddenFpCount} false positive{hiddenFpCount === 1 ? '' : 's'} hidden</span>
            )}
          </div>
          <SelectAllFilteredBar filtered={sorted} selectedIds={selectedIds} onChange={setSelectedIds} />
          {sorted.length === 0 && (
            <FilterFixSuggestions findings={findings} filters={filters} ctx={ctx} onRemove={removePill} />
          )}
          <GroupedFindingsView
            groups={groups}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
            renderFinding={(f) => (
              <div className="fc5-finding-row">
                <span className={`fc5-sev-dot fc5-sev-${f.severity}`} aria-hidden="true" />
                <span className="fc5-finding-main">
                  <HighlightedText text={f.title} query={filters.query} regexMode={filters.regexMode} />
                  <span className="fc5-finding-meta">
                    {f.severity} · conf {f.confidence}% · risk {f.riskScore ?? '—'}
                    {f.starred ? ' ★' : ''}
                  </span>
                </span>
                <SimilarToThisButton finding={f} active={filters.similarToId === f.id}
                                     onToggle={(fd) => setFilter('similarToId', filters.similarToId === fd.id ? null : fd.id)} />
              </div>
            )}
          />
        </div>
      </div>

      <MobileFilterSheet
        filters={filters}
        onApply={(draft) => update((p) => ({ ...p, ...draft }))}
        onReset={resetAll}
      >
        {(draft, setDraft) => (
          <div className="fc5-sheet-filters">
            <DebouncedSearchInput value={draft.query} onChange={(v) => setDraft({ ...draft, query: v })} />
            <SeverityHistogramChips findings={findings} selected={draft.severities || []}
                                    onChange={(v) => setDraft({ ...draft, severities: v })} />
            <RiskScoreRangeSlider min={draft.riskScoreMin ?? 0} max={draft.riskScoreMax ?? 10}
                                  onChange={(mn, mx) => setDraft({ ...draft, riskScoreMin: mn, riskScoreMax: mx })} />
            <ExcludeFpToggle value={draft.excludeFalsePositives ?? true} hiddenCount={hiddenFpCount}
                             onChange={(v) => setDraft({ ...draft, excludeFalsePositives: v })} />
          </div>
        )}
      </MobileFilterSheet>
    </div>
  );
}
