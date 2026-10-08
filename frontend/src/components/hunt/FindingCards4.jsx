/**
 * FindingCards4.jsx — Forge wave 5, ideas 50181–50200.
 * Findings filter-bar suite with a real filter pipeline.
 *
 * Pure filter logic lives in ./filtersCore.js (single source of truth):
 *   DEFAULT_FILTERS / applyFilters(findings, filters, ctx) / sortFindings /
 *   countActiveFilters / activeFilterLabels / PILL_RESETS — imported below.
 * Kept here: serializeFilters / deserializeFilters (share-URL, wave-5 specific).
 * Components: 50181 UnreviewedToggle, 50182 SortDropdown, 50183 SavedFilterPresets,
 *   50184 ActiveFilterPills, 50185 ConditionalClearAll, 50186 StatusSegmentedControl,
 *   50187 ConfidenceSlider, 50188 ScopedSearchInput, 50189 AssetFilterDropdown,
 *   50190 EvidencePresenceToggles, 50191 TagMultiSelect, 50192 DateRangeFilter,
 *   50193 OwaspChecklist, 50194 ChainedOnlyToggle, 50195 ResultCountLine,
 *   50196 EmptyResultState, 50198 ShareableFilterUrlButton, 50199 AndOrLogicToggle,
 *   50200 InvertSeverityToggle, composite FindingFilters.
 *
 * 50197 — CSS only, sticky filter bar:
 *   .fc4-filterbar { position: sticky; top: 0; z-index: 40; } (see FindingCards4.css)
 */
import React from 'react';
import { FC_SEVERITY, FC_SEVERITY_KEYS } from './FindingCards';
import './FindingCards4.css';
import {
  DEFAULT_FILTERS,
  TRIAGE_STAGES,
  applyFilters,
  countActiveFilters,
  activeFilterLabels,
  PILL_RESETS,
} from './filtersCore';

/*
 * SHARED FINDING-DATA SHAPE (derived from FindingCards.jsx usage)
 * {
 *   id, title, severity ('critical'|'high'|'medium'|'low'|'info'), confidence (0-100),
 *   riskScore (0-10), discoveredAt (epoch ms), status ('new'|'triaged'|'confirmed'|'fixed'|'verified'),
 *   reviewed (bool), tags (string[]), asset: {host, path}, owasp ('A01'..'A10'|''),
 *   evidence ([{type:'image'|'code'|'text', label, code, src}]), hasPoc (bool),
 *   chained (bool) / parentId, exploitSteps (number|null)
 * }
 */

/** OWASP Top 10 names (local copy — FindingCards2 defines this but does not export it; not exported here to avoid name clash). */
const OWASP_TOP10 = {
  A01: 'Broken Access Control',
  A02: 'Cryptographic Failures',
  A03: 'Injection',
  A04: 'Insecure Design',
  A05: 'Security Misconfiguration',
  A06: 'Vulnerable and Outdated Components',
  A07: 'Identification and Authentication Failures',
  A08: 'Software and Data Integrity Failures',
  A09: 'Security Logging and Monitoring Failures',
  A10: 'Server-Side Request Forgery',
};
const OWASP_KEYS = Object.keys(OWASP_TOP10);

/** 50198 — serialize filters to a URL query string (arrays joined with commas). */
export function serializeFilters(filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const p = new URLSearchParams();
  if (f.severities.length) p.set('sev', f.severities.join(','));
  if (f.invertSeverity) p.set('sevInv', '1');
  if (f.unreviewedOnly) p.set('unrev', '1');
  if (f.status !== 'all') p.set('status', f.status);
  if (f.minConfidence > 0) p.set('minConf', String(f.minConfidence));
  if (String(f.query || '').trim()) p.set('q', f.query.trim());
  if (f.asset !== 'all') p.set('asset', f.asset);
  if (f.hasPoc) p.set('poc', '1');
  if (f.hasScreenshot) p.set('shot', '1');
  if (f.tags.length) p.set('tags', f.tags.join(','));
  if (f.tagLogic === 'AND') p.set('tagLogic', 'AND');
  if (f.dateRange !== 'all') p.set('range', f.dateRange);
  if (f.owasp.length) p.set('owasp', f.owasp.join(','));
  if (f.chainedOnly) p.set('chained', '1');
  return p.toString();
}

/** 50198 — deserialize a query string (or URLSearchParams) back into filters, merged over DEFAULT_FILTERS. */
export function deserializeFilters(query) {
  const p =
    query instanceof URLSearchParams
      ? query
      : new URLSearchParams(String(query || '').replace(/^\?/, ''));
  const csv = k =>
    (p.get(k) || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  return {
    ...DEFAULT_FILTERS,
    severities: csv('sev').filter(s => FC_SEVERITY_KEYS.includes(s)),
    invertSeverity: p.get('sevInv') === '1',
    unreviewedOnly: p.get('unrev') === '1',
    status: p.get('status') || 'all',
    minConfidence: Math.max(0, Math.min(100, parseInt(p.get('minConf') || '0', 10) || 0)),
    query: p.get('q') || '',
    asset: p.get('asset') || 'all',
    hasPoc: p.get('poc') === '1',
    hasScreenshot: p.get('shot') === '1',
    tags: csv('tags'),
    tagLogic: p.get('tagLogic') === 'AND' ? 'AND' : 'OR',
    dateRange: p.get('range') || 'all',
    owasp: csv('owasp').filter(c => OWASP_KEYS.includes(c)),
    chainedOnly: p.get('chained') === '1',
  };
}

/* ---------------- UI components ---------------- */

/** 50181 — Unreviewed-only toggle (switch style). */
export function UnreviewedToggle({ value = false, onChange, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={`fc4-switch ${value ? 'fc4-on' : ''} ${className}`}
      onClick={() => onChange && onChange(!value)}
      aria-label="Show unreviewed findings only"
    >
      <span className="fc4-switch-track" aria-hidden="true">
        <span className="fc4-switch-thumb" />
      </span>
      <span className="fc4-switch-label">Unreviewed only</span>
    </button>
  );
}

/** 50194 — Chained-only toggle (switch style). */
export function ChainedOnlyToggle({ value = false, onChange, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={`fc4-switch ${value ? 'fc4-on' : ''} ${className}`}
      onClick={() => onChange && onChange(!value)}
      aria-label="Show only chained findings"
    >
      <span className="fc4-switch-track" aria-hidden="true">
        <span className="fc4-switch-thumb" />
      </span>
      <span className="fc4-switch-label">Chained only</span>
    </button>
  );
}

/** 50200 — "invert selection" checkbox shown beside severity chips. */
export function InvertSeverityToggle({ value = false, onChange, className = '' }) {
  return (
    <label
      className={`fc4-invert ${className}`}
      title="Exclude the selected severities instead of including them"
    >
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange && onChange(e.target.checked)}
        aria-label="Invert severity selection"
      />
      <span>invert selection</span>
    </label>
  );
}

/** 50180-local — Severity multi-select chips (filter-bar suite's own wired copy; not imported from elsewhere). */
export function SeverityFilterChips({ findings = [], selected = [], onChange, className = '' }) {
  const sel = new Set(selected || []);
  const counts = React.useMemo(() => {
    const c = {};
    for (const fd of findings) {
      if (!fd) continue;
      c[fd.severity] = (c[fd.severity] || 0) + 1;
    }
    return c;
  }, [findings]);
  const toggle = sev => {
    const next = new Set(sel);
    if (next.has(sev)) next.delete(sev);
    else next.add(sev);
    if (onChange) onChange([...next]);
  };
  return (
    <div className={`fc4-sev-chips ${className}`} role="group" aria-label="Filter by severity">
      {FC_SEVERITY_KEYS.map(sev => {
        const active = sel.has(sev);
        return (
          <button
            key={sev}
            type="button"
            className={`fc4-sev-chip fc4-sev-${sev} ${active ? 'fc4-active' : ''}`}
            style={{ '--fc4-sev': FC_SEVERITY[sev].color }}
            aria-pressed={active}
            onClick={() => toggle(sev)}
            title={`${FC_SEVERITY[sev].label} — ${counts[sev] || 0} findings`}
          >
            {FC_SEVERITY[sev].label}
            <span className="fc4-chip-count">{counts[sev] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 50182 — Sort dropdown. */
export function SortDropdown({ value = 'severity', onChange, className = '' }) {
  return (
    <label className={`fc4-sort ${className}`}>
      <span className="fc4-field-label">Sort</span>
      <select
        value={value}
        onChange={e => onChange && onChange(e.target.value)}
        aria-label="Sort findings"
      >
        <option value="severity">Severity</option>
        <option value="confidence">Confidence</option>
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="title">Title A–Z</option>
        <option value="priority">Priority score</option>
      </select>
    </label>
  );
}

/** 50186 — Status segmented control: All + triage stages. */
export function StatusSegmentedControl({ value = 'all', onChange, className = '' }) {
  const options = ['all', ...TRIAGE_STAGES];
  return (
    <div className={`fc4-segmented ${className}`} role="group" aria-label="Filter by triage status">
      {options.map(st => (
        <button
          key={st}
          type="button"
          className={value === st ? 'fc4-active' : ''}
          aria-pressed={value === st}
          onClick={() => onChange && onChange(st)}
        >
          {st === 'all' ? 'All' : st}
        </button>
      ))}
    </div>
  );
}

/** 50199 — AND/OR segmented toggle for tag logic. */
export function AndOrLogicToggle({ value = 'OR', onChange, className = '' }) {
  return (
    <div
      className={`fc4-segmented fc4-andor ${className}`}
      role="group"
      aria-label="Tag match logic"
    >
      {['AND', 'OR'].map(op => (
        <button
          key={op}
          type="button"
          className={value === op ? 'fc4-active' : ''}
          aria-pressed={value === op}
          onClick={() => onChange && onChange(op)}
          title={
            op === 'AND'
              ? 'Finding must have ALL selected tags'
              : 'Finding must have ANY selected tag'
          }
        >
          {op}
        </button>
      ))}
    </div>
  );
}

/** 50187 — Confidence slider: range input 0–100 with "≥ N%" label. */
export function ConfidenceSlider({ value = 0, onChange, className = '' }) {
  return (
    <label className={`fc4-confidence ${className}`}>
      <span className="fc4-field-label">
        Confidence <strong>≥ {value}%</strong>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={e => onChange && onChange(parseInt(e.target.value, 10))}
        aria-label="Minimum confidence percent"
      />
    </label>
  );
}

/** 50188 — Scoped search input (titles + impact/summary + evidence). */
export function ScopedSearchInput({ value = '', onChange, className = '' }) {
  return (
    <label className={`fc4-search ${className}`}>
      <span aria-hidden="true" className="fc4-search-icon">
        ⌕
      </span>
      <input
        type="search"
        value={value}
        placeholder="Search titles and evidence…"
        onChange={e => onChange && onChange(e.target.value)}
        aria-label="Search titles and evidence"
      />
      {value && (
        <button
          type="button"
          className="fc4-search-x"
          onClick={() => onChange && onChange('')}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </label>
  );
}

/** 50189 — Asset dropdown: distinct hosts with per-asset counts. */
export function AssetFilterDropdown({ findings = [], value = 'all', onChange, className = '' }) {
  const assets = React.useMemo(() => {
    const map = new Map();
    for (const fd of findings) {
      const host = fd && fd.asset && fd.asset.host;
      if (!host) continue;
      map.set(host, (map.get(host) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [findings]);
  return (
    <label className={`fc4-asset ${className}`}>
      <span className="fc4-field-label">Asset</span>
      <select
        value={value}
        onChange={e => onChange && onChange(e.target.value)}
        aria-label="Filter by asset host"
      >
        <option value="all">All assets</option>
        {assets.map(([host, count]) => (
          <option key={host} value={host}>
            {host} ({count})
          </option>
        ))}
      </select>
    </label>
  );
}

/** 50190 — Evidence presence toggles: has PoC / has screenshot. */
export function EvidencePresenceToggles({
  hasPoc = false,
  hasScreenshot = false,
  onChange,
  className = '',
}) {
  const set = (key, v) => onChange && onChange({ hasPoc, hasScreenshot, [key]: v });
  return (
    <div
      className={`fc4-evidence ${className}`}
      role="group"
      aria-label="Evidence presence filters"
    >
      {[
        { key: 'hasPoc', val: hasPoc, label: 'Has PoC' },
        { key: 'hasScreenshot', val: hasScreenshot, label: 'Has screenshot' },
      ].map(t => (
        <button
          key={t.key}
          type="button"
          role="switch"
          aria-checked={t.val}
          className={`fc4-switch fc4-switch-sm ${t.val ? 'fc4-on' : ''}`}
          onClick={() => set(t.key, !t.val)}
        >
          <span className="fc4-switch-track" aria-hidden="true">
            <span className="fc4-switch-thumb" />
          </span>
          <span className="fc4-switch-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/** 50191 — Tag multi-select: text input with datalist autocomplete + removable chips. */
export function TagMultiSelect({ allTags = [], selected = [], onChange, className = '' }) {
  const [draft, setDraft] = React.useState('');
  const listId = React.useId();
  const sel = selected || [];
  const add = tag => {
    const t = String(tag || '').trim();
    if (!t || sel.includes(t)) return;
    if (onChange) onChange([...sel, t]);
  };
  const remove = tag => {
    if (onChange) onChange(sel.filter(t => t !== tag));
  };
  return (
    <div className={`fc4-tags ${className}`}>
      <label className="fc4-tag-input">
        <span className="fc4-field-label">Tags</span>
        <input
          type="text"
          value={draft}
          list={listId}
          placeholder="Type a tag and press Enter…"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
              setDraft('');
            }
          }}
          aria-label="Add a tag filter"
        />
        <datalist id={listId}>
          {(allTags || [])
            .filter(t => !sel.includes(t))
            .map(t => (
              <option key={t} value={t} />
            ))}
        </datalist>
      </label>
      {sel.length > 0 && (
        <div className="fc4-tag-chips" aria-label="Selected tag filters">
          {sel.map(t => (
            <span key={t} className="fc4-tag-chip">
              {t}
              <button type="button" onClick={() => remove(t)} aria-label={`Remove tag ${t}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 50192 — Date range preset buttons: All time, Last hour, Today, This hunt. */
export function DateRangeFilter({ value = 'all', onChange, className = '' }) {
  const options = [
    { key: 'all', label: 'All time' },
    { key: 'hour', label: 'Last hour' },
    { key: 'today', label: 'Today' },
    { key: 'thisHunt', label: 'This hunt' },
  ];
  return (
    <div
      className={`fc4-segmented ${className}`}
      role="group"
      aria-label="Filter by discovery date"
    >
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          className={value === o.key ? 'fc4-active' : ''}
          aria-pressed={value === o.key}
          onClick={() => onChange && onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 50193 — OWASP checklist: checkbox list of the 10 categories with finding counts (counts over the full list). */
export function OwaspChecklist({ findings = [], selected = [], onChange, className = '' }) {
  const sel = new Set(selected || []);
  const counts = React.useMemo(() => {
    const c = {};
    for (const fd of findings) {
      if (fd && fd.owasp) c[fd.owasp] = (c[fd.owasp] || 0) + 1;
    }
    return c;
  }, [findings]);
  const toggle = code => {
    const next = new Set(sel);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    if (onChange) onChange([...next]);
  };
  return (
    <div
      className={`fc4-owasp ${className}`}
      role="group"
      aria-label="Filter by OWASP Top 10 category"
    >
      {OWASP_KEYS.map(code => (
        <label key={code} className={`fc4-owasp-row ${sel.has(code) ? 'fc4-checked' : ''}`}>
          <input
            type="checkbox"
            checked={sel.has(code)}
            onChange={() => toggle(code)}
            aria-label={`${code} — ${OWASP_TOP10[code]}`}
          />
          <span className="fc4-owasp-code">{code}</span>
          <span className="fc4-owasp-name">{OWASP_TOP10[code]}</span>
          <span className="fc4-owasp-count">{counts[code] || 0}</span>
        </label>
      ))}
    </div>
  );
}

/** 50183 — Saved filter presets: built-ins + named presets persisted to localStorage ('fc4-presets'). */
const PRESET_LS_KEY = 'fc4-presets';
const BUILT_IN_PRESETS = [
  {
    name: 'Criticals to fix',
    filters: { ...DEFAULT_FILTERS, severities: ['critical'], status: 'new', minConfidence: 50 },
  },
  {
    name: 'Needs review',
    filters: { ...DEFAULT_FILTERS, unreviewedOnly: true, status: 'new' },
  },
];

function loadPresets() {
  try {
    const raw = window.localStorage.getItem(PRESET_LS_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter(p => p && p.name && p.filters) : [];
  } catch {
    return [];
  }
}

export function SavedFilterPresets({ filters, onApply, onSave, className = '' }) {
  const [saved, setSaved] = React.useState(loadPresets);
  const [draft, setDraft] = React.useState('');
  const persist = list => {
    setSaved(list);
    try {
      window.localStorage.setItem(PRESET_LS_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
  };
  const saveCurrent = () => {
    const name = draft.trim();
    if (!name) return;
    const next = [...saved.filter(p => p.name !== name), { name, filters: { ...filters } }];
    persist(next);
    setDraft('');
    if (onSave) onSave(name, filters);
  };
  const remove = name => persist(saved.filter(p => p.name !== name));
  return (
    <div className={`fc4-presets ${className}`} role="group" aria-label="Saved filter presets">
      {BUILT_IN_PRESETS.map(p => (
        <button
          key={p.name}
          type="button"
          className="fc4-preset"
          onClick={() => onApply && onApply(p.filters)}
          title="Apply built-in preset"
        >
          {p.name}
        </button>
      ))}
      {saved.map(p => (
        <span key={p.name} className="fc4-preset-saved">
          <button
            type="button"
            className="fc4-preset"
            onClick={() => onApply && onApply(p.filters)}
            title={`Apply preset “${p.name}”`}
          >
            {p.name}
          </button>
          <button
            type="button"
            className="fc4-preset-x"
            onClick={() => remove(p.name)}
            aria-label={`Delete preset ${p.name}`}
          >
            ✕
          </button>
        </span>
      ))}
      <span className="fc4-preset-save">
        <input
          type="text"
          value={draft}
          placeholder="Name this filter set…"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveCurrent();
          }}
          aria-label="Preset name"
        />
        <button type="button" onClick={saveCurrent} disabled={!draft.trim()}>
          Save
        </button>
      </span>
    </div>
  );
}

/** 50184 — Active filter pills; each ✕ calls onRemove(key) to clear that dimension. */
export function ActiveFilterPills({ filters, onRemove, className = '' }) {
  const pills = activeFilterLabels(filters);
  if (!pills.length) return null;
  return (
    <div className={`fc4-pills ${className}`} aria-label="Active filters">
      {pills.map(p => (
        <span key={p.key} className="fc4-pill">
          <span className="fc4-pill-text">{p.text}</span>
          <button
            type="button"
            className="fc4-pill-x"
            onClick={() => onRemove && onRemove(p.key)}
            aria-label={`Remove filter: ${p.text}`}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}

/** 50185 — Renders only when any filter is active; label "Clear all (N)". */
export function ConditionalClearAll({ filters, onClear, className = '' }) {
  const n = countActiveFilters(filters);
  if (n === 0) return null;
  return (
    <button
      type="button"
      className={`fc4-clearall ${className}`}
      onClick={() => onClear && onClear()}
    >
      Clear all ({n})
    </button>
  );
}

/** 50195 — Result count line: "Showing {shown} of {total} findings". */
export function ResultCountLine({ shown = 0, total = 0, className = '' }) {
  return (
    <p className={`fc4-count ${className}`} role="status" aria-live="polite">
      Showing {shown} of {total} finding{total === 1 ? '' : 's'}
    </p>
  );
}

/** 50196 — Zero-results guidance naming the active filters plus a Clear button. */
export function EmptyResultState({ filters, onClear, className = '' }) {
  const labels = activeFilterLabels(filters);
  return (
    <div className={`fc4-empty ${className}`} role="status">
      <div className="fc4-empty-icon" aria-hidden="true">
        ∅
      </div>
      <h3>No findings match</h3>
      {labels.length > 0 ? (
        <p>
          Active filters: {labels.map(l => l.text).join(' · ')}. Try widening a filter below or
          clear everything to see the full list.
        </p>
      ) : (
        <p>No findings to show. The hunt hasn't surfaced any results yet.</p>
      )}
      {labels.length > 0 && (
        <button type="button" className="fc4-clearall" onClick={() => onClear && onClear()}>
          Clear all ({labels.length})
        </button>
      )}
    </div>
  );
}

/** 50198 — Serialize filters into the URL, copy the shareable link to the clipboard. */
export function ShareableFilterUrlButton({ filters, className = '' }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copyFallback = text => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  };

  const share = async () => {
    const qs = serializeFilters(filters);
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`;
    try {
      window.history.replaceState(null, '', url);
    } catch {
      /* history unavailable */
    }
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      } else {
        ok = copyFallback(url);
      }
    } catch {
      ok = copyFallback(url);
    }
    if (ok) {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      className={`fc4-share ${className}`}
      onClick={share}
      title="Copy a shareable link with these filters"
    >
      {copied ? '✓ Copied' : '⧉ Share filters'}
    </button>
  );
}

/**
 * composite — FindingFilters: the full filter bar.
 *
 * Renders search, severity chips (with live counts computed AFTER all other
 * filters except severity are applied), invert toggle, unreviewed toggle,
 * status segmented control, sort dropdown, confidence slider, asset dropdown,
 * evidence toggles, tag multi-select + AND/OR, date range, OWASP checklist,
 * chained toggle, presets, active pills, conditional clear-all and the share-URL
 * button — wrapped in a sticky <section className="fc4-filterbar"> with grouped
 * fieldsets + legends for accessibility.
 */
export function FindingFilters({
  findings = [],
  filters,
  onChange,
  onClear,
  sort = 'severity',
  onSortChange,
  huntStartedAt = 0,
  className = '',
}) {
  const f = { ...DEFAULT_FILTERS, ...(filters || {}) };
  const set = patch => onChange && onChange({ ...f, ...patch });
  const removeFilter = key => {
    const reset = PILL_RESETS[key] || {};
    set(reset);
  };

  // Live severity counts: apply everything EXCEPT severity, then count per severity.
  const sevCountBase = React.useMemo(
    () =>
      applyFilters(
        findings,
        { ...DEFAULT_FILTERS, ...(filters || {}), severities: [], invertSeverity: false },
        { huntStartedAt }
      ),
    [findings, filters, huntStartedAt]
  );

  const allTags = React.useMemo(() => {
    const s = new Set();
    for (const fd of findings) {
      if (Array.isArray(fd && fd.tags)) for (const t of fd.tags) s.add(t);
    }
    return [...s].sort();
  }, [findings]);

  return (
    <section className={`fc4-filterbar ${className}`} aria-label="Finding filters">
      <div className="fc4-row fc4-row-main">
        <ScopedSearchInput value={f.query} onChange={v => set({ query: v })} />
        <SortDropdown value={sort} onChange={onSortChange} />
        <ShareableFilterUrlButton filters={f} />
      </div>

      <fieldset className="fc4-group">
        <legend>Severity</legend>
        <SeverityFilterChips
          findings={sevCountBase}
          selected={f.severities}
          onChange={v => set({ severities: v })}
        />
        <InvertSeverityToggle value={f.invertSeverity} onChange={v => set({ invertSeverity: v })} />
      </fieldset>

      <fieldset className="fc4-group">
        <legend>Status & review</legend>
        <StatusSegmentedControl value={f.status} onChange={v => set({ status: v })} />
        <div className="fc4-inline-toggles">
          <UnreviewedToggle value={f.unreviewedOnly} onChange={v => set({ unreviewedOnly: v })} />
          <ChainedOnlyToggle value={f.chainedOnly} onChange={v => set({ chainedOnly: v })} />
        </div>
      </fieldset>

      <fieldset className="fc4-group">
        <legend>Confidence & evidence</legend>
        <ConfidenceSlider value={f.minConfidence} onChange={v => set({ minConfidence: v })} />
        <EvidencePresenceToggles
          hasPoc={f.hasPoc}
          hasScreenshot={f.hasScreenshot}
          onChange={({ hasPoc, hasScreenshot }) => set({ hasPoc, hasScreenshot })}
        />
      </fieldset>

      <fieldset className="fc4-group">
        <legend>Asset</legend>
        <AssetFilterDropdown
          findings={findings}
          value={f.asset}
          onChange={v => set({ asset: v })}
        />
      </fieldset>

      <fieldset className="fc4-group">
        <legend>Tags</legend>
        <div className="fc4-tags-row">
          <TagMultiSelect allTags={allTags} selected={f.tags} onChange={v => set({ tags: v })} />
          <AndOrLogicToggle value={f.tagLogic} onChange={v => set({ tagLogic: v })} />
        </div>
      </fieldset>

      <fieldset className="fc4-group">
        <legend>Discovered</legend>
        <DateRangeFilter value={f.dateRange} onChange={v => set({ dateRange: v })} />
      </fieldset>

      <fieldset className="fc4-group">
        <legend>OWASP Top 10</legend>
        <OwaspChecklist findings={findings} selected={f.owasp} onChange={v => set({ owasp: v })} />
      </fieldset>

      <fieldset className="fc4-group">
        <legend>Presets</legend>
        <SavedFilterPresets filters={f} onApply={next => set({ ...DEFAULT_FILTERS, ...next })} />
      </fieldset>

      <div className="fc4-row fc4-row-foot">
        <ActiveFilterPills filters={f} onRemove={removeFilter} />
        <ConditionalClearAll filters={f} onClear={onClear} />
      </div>
    </section>
  );
}
