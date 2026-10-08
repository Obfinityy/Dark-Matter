/**
 * SearchSuite.jsx — Forge wave 7, ideas 50241–50280.
 *
 * Findings Search Suite: a full search UI wired into the real query engine
 * in ./searchCore.js (operators, booleans, wildcards, synonyms, snippets,
 * did-you-mean, natural dates, URL encoding, history ranking, similar finds).
 *
 * Components (idea numbers):
 *   50241 SearchBox (operator chips)        50262 is:unreviewed (engine, chip)
 *   50242 SearchBox autocomplete           50263 scope chips (notes/comments)
 *   50243 SearchResults grouped view       50264 SavedSearchesPanel + PinnedSearchWidget
 *   50244 SearchResults keyboard nav       50265 URL sync + CopySearchLinkButton
 *   50245 no-results hints                 50266 boolean help (engine)
 *   50246 InCardSearch                     50267 match-explanation tooltips
 *   50247 SearchHistoryPanel               50268 did-you-mean (engine + UI)
 *   50248 wildcard hint chip               50269 natural-date help (engine)
 *   50249 snippet rendering                50270 digest badges in SavedSearchesPanel
 *   50250 ReportPreviewSearch              50271 "/" shortcut in placeholder
 *   50251 synonym badges (engine)          50272 TimelineSearch
 *   50252 case-sensitivity toggle          50273 archived toggle
 *   50253 per-scope-tab query state        50274 hover preview cards
 *   50254 quick-filter chips               50275 SimilarFindingsButton
 *   50255 ranked suggestions               50276 CopySearchLinkButton
 *   50256 open-all-results                 50277 typing-throttle indicator
 *   50257 evidence-only scope              50278 SearchThisHostButton
 *   50258 highlight-all toggle             50279 multilingual toggle
 *   50259 perf footer                      50280 top queries in SearchHistoryPanel
 *   50260 VoiceSearchButton                50283 RandomFindingButton
 *   50261 TerminalLogSearch                50284 result badges
 *                                          50288 narrow-to-phase chips
 *                                          50289 empty-box starter queries
 *
 * Composite: <FindingsSearchSuite> wires search → results → history → saved.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  parseQuery,
  suggestOperatorValues,
  search as coreSearch,
  groupResults,
  explainMatch,
  encodeSearch,
  decodeSearch,
  pushHistory,
  loadHistory,
  saveHistory,
  rankSuggestions,
  topQueries,
  loadSaved,
  saveSaved,
  saveSearchEntry,
  digestNewMatches,
  similarFindings,
  searchInText,
  searchTerminalLog,
  searchTimeline,
  shouldThrottleHint,
  serializeScopeState,
  deserializeScopeState,
  hostSearchQuery,
  resultBadge,
  phaseChip,
  STARTER_QUERIES,
  RESULT_SCOPES,
} from './searchCore.js';
import './SearchSuite.css';

/* Severity hues come from design tokens via .ss-sev-dot[data-sev] in SearchSuite.css. */

/* ------------------------------------------------------------------ */
/* Small shared bits                                                  */
/* ------------------------------------------------------------------ */

export function HighlightMatches({ text = '', terms = [], className = '' }) {
  const t = String(text);
  if (!terms.length || !t) return <span className={className}>{t}</span>;
  const needles = terms.filter(Boolean).map(x => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!needles.length) return <span className={className}>{t}</span>;
  const re = new RegExp(`(${needles.join('|')})`, 'gi');
  const parts = t.split(re);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="ss-mark">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </span>
  );
}

function termsFromQuery(raw) {
  const { ast } = parseQuery(raw);
  const out = [];
  const walk = n => {
    if (!n) return;
    if (n.type === 'term' || n.type === 'phrase') out.push(n.value.replace(/\*/g, ''));
    if (n.a) walk(n.a);
    if (n.b) walk(n.b);
  };
  walk(ast);
  return [...new Set(out.filter(Boolean))];
}

/* ------------------------------------------------------------------ */
/* 50260 — voice search                                               */
/* ------------------------------------------------------------------ */

export function VoiceSearchButton({ onResult, className = '' }) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const start = () => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = e => {
      onResult && onResult(e.results[0][0].transcript);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`ss-icon-btn ${className} ${listening ? 'ss-listening' : ''}`}
      onClick={start}
      title="Voice search"
      aria-label="Voice search"
    >
      {listening ? '●' : '◉'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50276 — copy search link                                           */
/* ------------------------------------------------------------------ */

export function CopySearchLinkButton({ state }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}${window.location.pathname}#s=${encodeSearch(state || {})}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      className="ss-ghost-btn"
      onClick={copy}
      title="Copy a shareable link that reproduces this exact search"
      aria-label="Copy a shareable link that reproduces this exact search"
    >
      {copied ? 'Link copied' : 'Copy search link'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50278 — search this host                                           */
/* ------------------------------------------------------------------ */

export function SearchThisHostButton({ host, onSearch }) {
  if (!host) return null;
  return (
    <button
      type="button"
      className="ss-ghost-btn ss-small"
      onClick={() => onSearch && onSearch(hostSearchQuery(host))}
      title={`Search everything on ${host}`}
    >
      Search this host
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50283 — random finding                                             */
/* ------------------------------------------------------------------ */

export function RandomFindingButton({ findings = [], onPick }) {
  const pick = () => {
    if (!findings.length) return;
    onPick && onPick(findings[Math.floor(Math.random() * findings.length)]);
  };
  return (
    <button
      type="button"
      className="ss-ghost-btn"
      onClick={pick}
      title="Surface a random finding for review"
    >
      Surprise me
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50275 — similar findings                                           */
/* ------------------------------------------------------------------ */

export function SimilarFindingsButton({ finding, findings = [], onPick }) {
  const [open, setOpen] = useState(false);
  const sims = useMemo(() => similarFindings(finding || {}, findings, 5), [finding, findings]);
  if (!finding) return null;
  return (
    <span className="ss-similar-wrap">
      <button
        type="button"
        className="ss-ghost-btn ss-small"
        onClick={() => setOpen(o => !o)}
        title="Find duplicate candidates"
      >
        Similar ({sims.length})
      </button>
      {open && (
        <span className="ss-popover">
          {sims.length === 0 && <span className="ss-empty-note">No similar findings.</span>}
          {sims.map(({ finding: f, score }) => (
            <button
              key={f.id}
              type="button"
              className="ss-popover-item"
              onClick={() => {
                onPick && onPick(f);
                setOpen(false);
              }}
            >
              <span className="ss-sev-dot" data-sev={String(f.severity || 'info').toLowerCase()} />
              {f.title} <span className="ss-muted">· score {score}</span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* SearchBox — 50241/50242/50254/50252/50258/50257/50273/50271/        */
/*             50277/50289/50255/50279                                */
/* ------------------------------------------------------------------ */

const QUICK_CHIPS = [
  { label: 'Critical', q: 'sev:critical' },
  { label: 'Has PoC', q: 'has:poc' },
  { label: 'Unreviewed', q: 'is:unreviewed' },
  { label: 'Starred', q: 'is:starred' },
];

export function SearchBox({
  value,
  onChange,
  onSubmit,
  history = [],
  datasetSize = 0,
  caseSensitive,
  onToggleCase,
  highlightAll,
  onToggleHighlight,
  searchScope,
  onSearchScope,
  includeArchived,
  onToggleArchived,
  multilingual,
  onToggleMultilingual,
  inputRef,
}) {
  const [focused, setFocused] = useState(false);
  const [acIndex, setAcIndex] = useState(-1);
  const keyTimes = useRef([]);

  // 50271 — "/" focuses the box from anywhere (unless typing in a field)
  useEffect(() => {
    const h = e => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const t = e.target;
        const typing =
          t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (!typing && inputRef && inputRef.current) {
          e.preventDefault();
          inputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [inputRef]);

  const lastToken = (value.match(/(\S+)$/) || [''])[0];
  const completions = useMemo(() => {
    if (!focused) return [];
    if (!value.trim()) return STARTER_QUERIES.map(q => ({ text: q, kind: 'starter' })); // 50289
    const ops = suggestOperatorValues(lastToken); // 50242
    const ranked = rankSuggestions(value, history, 4).map(h => ({ text: h.q, kind: 'history' })); // 50255
    return [...ops, ...ranked].slice(0, 8);
  }, [value, focused, history, lastToken]);

  const applyCompletion = text => {
    if (lastToken && /:$/.test(lastToken) === false && suggestOperatorValues(lastToken).length) {
      onChange(value.replace(/(\S+)$/, text));
    } else onChange(text);
    setAcIndex(-1);
    inputRef && inputRef.current && inputRef.current.focus();
  };

  const trackKeys = () => {
    const now = Date.now();
    keyTimes.current = [...keyTimes.current.filter(t => now - t < 2000), now];
  };
  const cps = keyTimes.current.length / 2;
  const throttled = shouldThrottleHint(datasetSize, cps); // 50277

  const onKeyDown = e => {
    if (completions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setAcIndex(i =>
        e.key === 'ArrowDown'
          ? (i + 1) % completions.length
          : (i - 1 + completions.length) % completions.length
      );
    } else if (e.key === 'Enter' && acIndex >= 0 && completions[acIndex]) {
      e.preventDefault();
      applyCompletion(completions[acIndex].text);
    } else if (e.key === 'Enter') {
      onSubmit && onSubmit(value);
    } else if (e.key === 'Escape') {
      setAcIndex(-1);
      inputRef && inputRef.current && inputRef.current.blur();
    }
  };

  return (
    <div className="ss-searchbox">
      <div className="ss-search-row">
        <input
          ref={inputRef}
          className="ss-input"
          value={value}
          placeholder='Search findings…  ( press / )   try: sev:critical has:poc "sql injection"'
          onChange={e => {
            trackKeys();
            onChange(e.target.value);
            setAcIndex(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={onKeyDown}
          aria-label="Search findings"
          aria-expanded={focused && completions.length > 0}
          aria-controls="ss-autocomplete"
        />
        <VoiceSearchButton
          onResult={t => {
            onChange(t);
            onSubmit && onSubmit(t);
          }}
        />
        {throttled && (
          <span
            className="ss-throttle"
            title="Very fast typing on a huge dataset — results are throttled"
          >
            throttling…
          </span>
        )}
      </div>

      {focused && completions.length > 0 && (
        <div className="ss-ac" role="listbox" id="ss-autocomplete" aria-label="Search suggestions">
          {completions.map((c, i) => (
            <button
              key={`${c.kind}-${c.text}-${i}`}
              type="button"
              role="option"
              aria-selected={i === acIndex}
              className={`ss-ac-item ${i === acIndex ? 'ss-active' : ''}`}
              onMouseDown={e => {
                e.preventDefault();
                applyCompletion(c.text);
              }}
            >
              <span className={`ss-ac-kind ss-kind-${c.kind}`}>{c.kind}</span>
              <HighlightMatches text={c.text} terms={[lastToken]} />
            </button>
          ))}
        </div>
      )}

      <div className="ss-search-meta">
        <div className="ss-chips">
          {QUICK_CHIPS.map(c => (
            <button
              key={c.q}
              type="button"
              className="ss-chip"
              onClick={() => {
                onChange(c.q);
                onSubmit && onSubmit(c.q);
              }}
            >
              {c.label}
            </button>
          ))}
          <span className="ss-chip-hint">
            wildcards: <code>adm*</code>
          </span>
        </div>
        <div className="ss-toggles">
          <label className="ss-toggle" title="Case-sensitive matching">
            <input type="checkbox" checked={!!caseSensitive} onChange={onToggleCase} /> Aa
          </label>
          <label className="ss-toggle" title="Highlight every match across the list">
            <input type="checkbox" checked={!!highlightAll} onChange={onToggleHighlight} />{' '}
            highlight all
          </label>
          <label className="ss-toggle" title="Include archived hunts">
            <input type="checkbox" checked={!!includeArchived} onChange={onToggleArchived} />{' '}
            archived
          </label>
          <label className="ss-toggle" title="Match translated finding titles">
            <input type="checkbox" checked={!!multilingual} onChange={onToggleMultilingual} />{' '}
            multilingual
          </label>
          <span className="ss-toggle-group" role="radiogroup" aria-label="Search scope">
            {[
              ['all', 'all'],
              ['evidence', 'in:evidence'],
              ['notes', 'in:notes'],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={searchScope === v}
                className={`ss-scope ${searchScope === v ? 'ss-active' : ''}`}
                onClick={() => onSearchScope(v)}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SearchResults — 50243/50244/50249/50274/50267/50245/50256/          */
/*                 50259/50284/50288/50253                            */
/* ------------------------------------------------------------------ */

function ResultRow({
  result,
  query,
  highlightAll,
  active,
  onOpen,
  onNarrowPhase,
  onPickSimilar,
  findings,
}) {
  const { finding: f, reasons, snippet: snip } = result;
  const badge = resultBadge(f); // 50284
  const [hover, setHover] = useState(false);
  const terms = highlightAll ? termsFromQuery(query) : [];
  return (
    <div
      className={`ss-result ${active ? 'ss-active' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen && onOpen(f)}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && onOpen) {
          e.preventDefault();
          onOpen(f);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open finding: ${f.title || '(untitled)'}`}
      title={explainMatch(reasons)} // 50267 — relevance explanation
    >
      <span className="ss-sev-dot" data-sev={badge.severity} />
      <div className="ss-result-main">
        <div className="ss-result-title">
          <HighlightMatches text={f.title || '(untitled)'} terms={terms} />
        </div>
        <div className="ss-result-snippet">
          {snip && snip.text ? (
            <>
              <span className="ss-muted">L{snip.line} · </span>
              <HighlightMatches text={snip.text} terms={terms} />
            </>
          ) : (
            <span className="ss-empty-note">no snippet</span>
          )}
        </div>
        <div className="ss-result-foot">
          <span className="ss-hunt-tag">{badge.hunt}</span>
          {f.host && <span className="ss-muted">{f.host}</span>}
          {f.phase && (
            <button
              type="button"
              className="ss-phase-chip"
              title="Narrow search to this phase"
              onClick={e => {
                e.stopPropagation();
                onNarrowPhase && onNarrowPhase(phaseChip(f));
              }}
            >
              {f.phase}
            </button>
          )}
          <SimilarFindingsButton finding={f} findings={findings} onPick={onPickSimilar} />
        </div>
      </div>
      {hover && (
        <div className="ss-hover-card">
          <div className="ss-hover-title">{f.title}</div>
          <div className="ss-hover-meta">
            {badge.severity} · {f.host || 'no host'} · {f.huntName || ''}
          </div>
          <div className="ss-hover-why">{explainMatch(reasons)}</div>
          {f.notes && <div className="ss-hover-notes">{String(f.notes).slice(0, 140)}</div>}
        </div>
      )}
    </div>
  );
}

export function SearchResults({
  searchOutput,
  query,
  highlightAll,
  onOpen,
  onOpenAll,
  groupBy,
  onGroupByChange,
  scope,
  onScopeChange,
  findings = [],
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);
  const {
    results = [],
    total = 0,
    searched = 0,
    ms = 0,
    correction,
    operatorHint: opHint,
  } = searchOutput || {};

  useEffect(() => setActiveIndex(0), [query, scope, groupBy]);

  // 50244 — arrow keys move through results, Enter opens
  useEffect(() => {
    const h = e => {
      if (!results.length) return;
      const t = e.target;
      const typing =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i =>
          e.key === 'ArrowDown' ? Math.min(results.length - 1, i + 1) : Math.max(0, i - 1)
        );
      } else if (e.key === 'Enter' && document.activeElement === document.body) {
        onOpen && onOpen(results[activeIndex].finding);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [results, activeIndex, onOpen]);

  const narrowPhase = chip => onScopeChange && onScopeChange(chip);

  const body = () => {
    if (!query.trim())
      return (
        <div className="ss-empty-note">
          Type a query above — operators like <code>sev:critical</code>, <code>has:poc</code>,{' '}
          <code>is:unreviewed</code> narrow results precisely.
        </div>
      );
    if (!results.length) {
      // 50245 — no-results operator hints
      return (
        <div className="ss-no-results">
          <div className="ss-no-results-title">No findings match.</div>
          {correction && (
            <div>
              Did you mean{' '}
              <button type="button" className="ss-link" onClick={() => onScopeChange(correction)}>
                {correction}
              </button>
              ?
            </div>
          )}
          {opHint && <div className="ss-hint">{opHint}</div>}
          {!correction && !opHint && (
            <div className="ss-hint">
              Try fewer terms, a wildcard like <code>adm*</code>, or <code>OR</code> between
              alternatives.
            </div>
          )}
        </div>
      );
    }
    const flat =
      groupBy === 'none'
        ? [{ key: 'all', count: results.length, results }]
        : groupResults(results, groupBy);
    let idx = -1;
    return flat.map(g => (
      <div key={g.key} className="ss-group">
        {groupBy !== 'none' && (
          <div className="ss-group-head">
            <span className="ss-group-key">{g.key}</span>
            <span className="ss-chip-count">{g.count}</span>
          </div>
        )}
        {g.results.map(r => {
          idx += 1;
          const my = idx;
          return (
            <ResultRow
              key={r.finding.id || my}
              result={r}
              query={query}
              highlightAll={highlightAll}
              active={my === activeIndex}
              findings={findings}
              onOpen={onOpen}
              onNarrowPhase={narrowPhase}
              onPickSimilar={onOpen}
            />
          );
        })}
      </div>
    ));
  };

  return (
    <div className="ss-results" ref={listRef}>
      <div className="ss-results-bar">
        <div className="ss-scope-tabs" role="tablist" aria-label="Result scope">
          {RESULT_SCOPES.map(s => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              className={`ss-tab ${scope === s ? 'ss-active' : ''}`}
              onClick={() => onScopeChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="ss-groupby">
          group by
          <select value={groupBy} onChange={e => onGroupByChange(e.target.value)}>
            <option value="none">none</option>
            <option value="severity">severity</option>
            <option value="host">host</option>
            <option value="type">type</option>
            <option value="hunt">hunt</option>
          </select>
        </label>
      </div>

      {body()}

      {results.length > 0 && (
        <div className="ss-results-foot">
          <span className="ss-muted" aria-live="polite">
            searched {searched} findings in {ms}ms
          </span>
          {results.length <= 25 && results.length > 1 && (
            <button
              type="button"
              className="ss-ghost-btn ss-small"
              onClick={() => onOpenAll && onOpenAll(results.map(r => r.finding))}
            >
              Open all {results.length} results
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50247/50255/50280 — search history panel                            */
/* ------------------------------------------------------------------ */

export function SearchHistoryPanel({ history = [], onRun, onClear }) {
  const tops = topQueries(history, 8);
  return (
    <div className="ss-panel">
      <div className="ss-panel-head">
        <span className="ss-field-label">Search history</span>
        {history.length > 0 && (
          <button
            type="button"
            className="ss-link"
            onClick={onClear}
            aria-label="Clear search history"
          >
            clear
          </button>
        )}
      </div>
      {history.length === 0 && (
        <div className="ss-empty-note">Your recent searches will appear here.</div>
      )}
      <div className="ss-history-list">
        {history.slice(0, 12).map(h => (
          <button
            key={h.q}
            type="button"
            className="ss-history-item"
            onClick={() => onRun(h.q)}
            title={`run ${h.count}×`}
          >
            <span className="ss-history-q">{h.q}</span>
            <span className="ss-chip-count">{h.count}×</span>
          </button>
        ))}
      </div>
      {tops.length > 0 && (
        <>
          <div className="ss-field-label ss-mt">Top queries</div>
          <div className="ss-chips">
            {tops.slice(0, 5).map(h => (
              <button key={h.q} type="button" className="ss-chip" onClick={() => onRun(h.q)}>
                {h.q}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50264/50270/50276 — saved searches + pinned widgets + digests      */
/* ------------------------------------------------------------------ */

export function SavedSearchesPanel({ saved = [], findings = [], onRun, onChange }) {
  const [name, setName] = useState('');
  const [pendingQ, setPendingQ] = useState('');
  const [digests, setDigests] = useState({});

  const save = q => {
    if (!q.trim()) return;
    onChange(saveSearchEntry(saved, { name: name.trim() || q.trim(), q: q.trim() }));
    setName('');
    setPendingQ('');
  };

  const toggle = (id, key) =>
    onChange(saved.map(s => (s.id === id ? { ...s, [key]: !s[key] } : s)));
  const remove = id => onChange(saved.filter(s => s.id !== id));
  const markChecked = s => {
    onChange(saved.map(x => (x.id === s.id ? { ...x, lastCheck: Date.now() } : x)));
    setDigests(d => ({ ...d, [s.id]: 0 }));
  };

  useEffect(() => {
    const d = {};
    for (const s of saved) if (s.digest) d[s.id] = digestNewMatches(s, findings).length;
    setDigests(d);
  }, [saved, findings]);

  return (
    <div className="ss-panel">
      <div className="ss-panel-head">
        <span className="ss-field-label">Saved searches</span>
      </div>
      <div className="ss-save-row">
        <input
          className="ss-input ss-small-input"
          placeholder="Name this search…"
          aria-label="Name this search"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="ss-input ss-small-input"
          placeholder="Query to save…"
          aria-label="Query to save"
          value={pendingQ}
          onChange={e => setPendingQ(e.target.value)}
        />
        <button type="button" className="ss-ghost-btn ss-small" onClick={() => save(pendingQ)}>
          Save
        </button>
      </div>
      {saved.length === 0 && (
        <div className="ss-empty-note">
          Save any query to pin it as a live dashboard widget or get digests.
        </div>
      )}
      {saved.map(s => (
        <div key={s.id} className="ss-saved-item">
          <button type="button" className="ss-saved-q" onClick={() => onRun(s.q)} title={s.q}>
            {s.name}
          </button>
          <span className="ss-saved-meta">{s.q}</span>
          {s.digest && digests[s.id] > 0 && (
            <button
              type="button"
              className="ss-digest-badge"
              onClick={() => markChecked(s)}
              title="New matches since last check — click to mark checked"
            >
              {digests[s.id]} new
            </button>
          )}
          <span className="ss-saved-actions">
            <button
              type="button"
              className={`ss-mini-btn ${s.pinned ? 'ss-on' : ''}`}
              onClick={() => toggle(s.id, 'pinned')}
              title="Pin as dashboard widget"
            >
              pin
            </button>
            <button
              type="button"
              className={`ss-mini-btn ${s.digest ? 'ss-on' : ''}`}
              onClick={() => toggle(s.id, 'digest')}
              title="Email-style digest on new matches"
            >
              digest
            </button>
            <CopySearchLinkButton state={{ q: s.q, scope: s.scope }} />
            <button
              type="button"
              className="ss-mini-btn"
              onClick={() => remove(s.id)}
              title="Delete"
            >
              ✕
            </button>
          </span>
        </div>
      ))}
      {saved.some(s => s.pinned) && (
        <>
          <div className="ss-field-label ss-mt">Pinned widgets</div>
          <div className="ss-widgets">
            {saved
              .filter(s => s.pinned)
              .map(s => (
                <PinnedSearchWidget key={s.id} saved={s} findings={findings} onRun={onRun} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PinnedSearchWidget({ saved, findings = [], onRun }) {
  const count = useMemo(
    () => coreSearch(findings, saved.q || '', { synonyms: true }).total,
    [findings, saved.q]
  );
  return (
    <button
      type="button"
      className="ss-widget"
      onClick={() => onRun(saved.q)}
      title={`Run: ${saved.q}`}
    >
      <span className="ss-widget-count">{count}</span>
      <span className="ss-widget-name">{saved.name}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50261 — terminal log search                                        */
/* ------------------------------------------------------------------ */

export function TerminalLogSearch({ lines = [], onJump }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchTerminalLog(lines, q), [lines, q]);
  return (
    <div className="ss-panel">
      <div className="ss-panel-head">
        <span className="ss-field-label">Terminal log search</span>
      </div>
      <input
        className="ss-input"
        placeholder="Search live terminal log…"
        aria-label="Search live terminal log"
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {q && (
        <div className="ss-muted ss-mt" aria-live="polite">
          {hits.length} match{hits.length === 1 ? '' : 'es'}
        </div>
      )}
      <div className="ss-log-hits">
        {hits.slice(0, 30).map(h => (
          <button
            key={h.line}
            type="button"
            className="ss-log-hit"
            onClick={() => onJump && onJump(h.line)}
          >
            <span className="ss-chip-count">L{h.line}</span>
            <HighlightMatches text={h.text} terms={[q]} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50272 — timeline text search                                       */
/* ------------------------------------------------------------------ */

export function TimelineSearch({ events = [], onJump }) {
  const [q, setQ] = useState('');
  const idx = useMemo(() => searchTimeline(events, q), [events, q]);
  return (
    <div className="ss-inline-search">
      <input
        className="ss-input ss-small-input"
        placeholder="Search timeline…"
        aria-label="Search timeline"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && idx >= 0) onJump && onJump(idx);
        }}
      />
      <button
        type="button"
        className="ss-ghost-btn ss-small"
        disabled={idx < 0}
        onClick={() => onJump && onJump(idx)}
        title="Jump to first matching event"
      >
        {idx >= 0 ? `Jump to #${idx + 1}` : 'No match'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50246 — in-card evidence search                                    */
/* ------------------------------------------------------------------ */

export function InCardSearch({ text = '' }) {
  const [q, setQ] = useState('');
  const [pos, setPos] = useState(0);
  const inputRef = useRef(null);
  const hits = useMemo(() => searchInText(text, q), [text, q]);

  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        inputRef.current && inputRef.current.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => setPos(0), [q, text]);

  const render = () => {
    if (!q || !hits.length) return text;
    const out = [];
    let last = 0;
    hits.forEach((h, i) => {
      out.push(<React.Fragment key={`t${i}`}>{String(text).slice(last, h.index)}</React.Fragment>);
      out.push(
        <mark key={`m${i}`} className={`ss-mark ${i === pos ? 'ss-current' : ''}`}>
          {String(text).slice(h.index, h.index + h.length)}
        </mark>
      );
      last = h.index + h.length;
    });
    out.push(<React.Fragment key="tail">{String(text).slice(last)}</React.Fragment>);
    return out;
  };

  return (
    <div className="ss-incard">
      <div className="ss-incard-bar">
        <input
          ref={inputRef}
          className="ss-input ss-small-input"
          placeholder="Ctrl+F in evidence…"
          aria-label="Find in evidence"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {hits.length > 0 && (
          <span className="ss-incard-nav" aria-live="polite">
            <span className="ss-muted">
              {pos + 1}/{hits.length}
            </span>
            <button
              type="button"
              className="ss-mini-btn"
              onClick={() => setPos(p => (p - 1 + hits.length) % hits.length)}
            >
              ↑
            </button>
            <button
              type="button"
              className="ss-mini-btn"
              onClick={() => setPos(p => (p + 1) % hits.length)}
            >
              ↓
            </button>
          </span>
        )}
      </div>
      <pre className="ss-evidence">{render()}</pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50250 — report preview search                                     */
/* ------------------------------------------------------------------ */

export function ReportPreviewSearch({ pages = [], onJumpToPage }) {
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return pages
      .map((p, i) => ({ page: p.page ?? i + 1, text: p.text || '' }))
      .filter(p => p.text.toLowerCase().includes(needle));
  }, [pages, q]);
  return (
    <div className="ss-panel">
      <div className="ss-panel-head">
        <span className="ss-field-label">Search report preview</span>
      </div>
      <input
        className="ss-input"
        placeholder="Search inside the report…"
        aria-label="Search inside the report"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && matches[0]) onJumpToPage && onJumpToPage(matches[0].page);
        }}
      />
      {q && (
        <div className="ss-muted ss-mt" aria-live="polite">
          {matches.length} page{matches.length === 1 ? '' : 's'}
        </div>
      )}
      {matches.slice(0, 10).map(m => (
        <button
          key={m.page}
          type="button"
          className="ss-log-hit"
          onClick={() => onJumpToPage && onJumpToPage(m.page)}
        >
          <span className="ss-chip-count">p{m.page}</span>
          <HighlightMatches text={m.text.slice(0, 160)} terms={[q]} />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composite — wires the whole suite end to end                       */
/* ------------------------------------------------------------------ */

const SCOPE_STORE_KEY = 'infinityai.search.scopes.v1';

export function FindingsSearchSuite({
  findings = [],
  terminalLines = [],
  timelineEvents = [],
  reportPages = [],
  onOpenFinding,
  onOpenAllFindings,
}) {
  const inputRef = useRef(null);
  const [perScope, setPerScope] = useState(() => {
    try {
      const raw =
        typeof window !== 'undefined' ? window.localStorage.getItem(SCOPE_STORE_KEY) : null;
      return raw ? deserializeScopeState(raw) : deserializeScopeState('');
    } catch {
      return deserializeScopeState('');
    }
  });
  const [scope, setScopeState] = useState('all'); // 50253 — result scope tabs
  const [searchScope, setSearchScope] = useState('all'); // in: evidence/notes restriction
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [highlightAll, setHighlightAll] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [multilingual, setMultilingual] = useState(false);
  const [groupBy, setGroupBy] = useState('severity');
  const [history, setHistory] = useState(() => loadHistory());
  const [saved, setSaved] = useState(() => loadSaved());

  const q = (perScope[scope] || {}).q || '';
  const setQ = useCallback(
    v => {
      setPerScope(ps => {
        const next = { ...ps, [scope]: { ...(ps[scope] || {}), q: v } };
        try {
          window.localStorage.setItem(SCOPE_STORE_KEY, serializeScopeState(next));
        } catch {}
        return next;
      });
    },
    [scope]
  );

  const setScope = s => {
    if (RESULT_SCOPES.includes(s))
      setScopeState(s); // scope tab
    else setQ(s); // phase chip / correction query
  };

  const output = useMemo(
    () =>
      coreSearch(findings, q, {
        caseSensitive,
        synonyms: true,
        multilingual,
        includeArchived,
        inScope: searchScope === 'all' ? undefined : searchScope,
      }),
    [findings, q, caseSensitive, multilingual, includeArchived, searchScope]
  );

  const submit = val => {
    const next = pushHistory(history, val);
    setHistory(next);
    saveHistory(next);
  };

  // 50265 — sync search state into the URL hash so links reproduce it
  useEffect(() => {
    const enc = encodeSearch({
      q,
      scope: searchScope,
      caseSensitive,
      includeArchived,
      multilingual,
    });
    const url = new URL(window.location.href);
    if (q) url.hash = `s=${enc}`;
    else if (url.hash.startsWith('#s=')) url.hash = '';
    window.history.replaceState(null, '', url.toString());
  }, [q, searchScope, caseSensitive, includeArchived, multilingual]);

  // restore from #s= on first mount
  useEffect(() => {
    const m = window.location.hash.match(/^#s=(.+)/);
    if (m) {
      const st = decodeSearch(m[1]);
      if (st.q) {
        setQ(st.q);
        setSearchScope(st.scope || 'all');
        setCaseSensitive(st.caseSensitive);
        setIncludeArchived(st.includeArchived);
        setMultilingual(st.multilingual);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runQuery = val => {
    setQ(val);
    submit(val);
    inputRef.current && inputRef.current.focus();
  };

  return (
    <div className="ss-root">
      <SearchBox
        value={q}
        onChange={setQ}
        onSubmit={submit}
        history={history}
        datasetSize={findings.length}
        caseSensitive={caseSensitive}
        onToggleCase={() => setCaseSensitive(v => !v)}
        highlightAll={highlightAll}
        onToggleHighlight={() => setHighlightAll(v => !v)}
        searchScope={searchScope}
        onSearchScope={setSearchScope}
        includeArchived={includeArchived}
        onToggleArchived={() => setIncludeArchived(v => !v)}
        multilingual={multilingual}
        onToggleMultilingual={() => setMultilingual(v => !v)}
        inputRef={inputRef}
      />
      <div className="ss-suite-bar">
        <CopySearchLinkButton
          state={{ q, scope: searchScope, caseSensitive, includeArchived, multilingual }}
        />
        <RandomFindingButton findings={findings} onPick={onOpenFinding} />
        <span className="ss-muted">
          Boolean: <code>AND OR NOT ( )</code> · <code>before:/after:</code> accept “last tuesday”
        </span>
      </div>
      <div className="ss-body">
        <div className="ss-main">
          <SearchResults
            searchOutput={output}
            query={q}
            highlightAll={highlightAll}
            onOpen={onOpenFinding}
            onOpenAll={onOpenAllFindings}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            scope={scope}
            onScopeChange={setScope}
            findings={findings}
          />
        </div>
        <div className="ss-side">
          <SearchHistoryPanel
            history={history}
            onRun={runQuery}
            onClear={() => {
              setHistory([]);
              saveHistory([]);
            }}
          />
          <SavedSearchesPanel
            saved={saved}
            findings={findings}
            onRun={runQuery}
            onChange={s => {
              setSaved(s);
              saveSaved(s);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default FindingsSearchSuite;
