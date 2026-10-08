/**
 * FindingCards3.jsx — Forge wave 5, ideas 50161–50180.
 *
 * Card interaction features: report inclusion, view mode, sticky headers,
 * deep links, retest diffs, activity feed, escalation, PoC replay, age,
 * priority scoring, minimize, previous-hunt comparison, a11y card markup,
 * severity multi-select chips.
 *
 * Note 50169 (hover elevation / active spine) is CSS-only: see
 * .fc3-hoverable:hover and .fc3-active in FindingCards3.css.
 * Dark-theme suite: pairs with FindingCards.jsx (imports FC_SEVERITY).
 */
import React from 'react';
import { FC_SEVERITY, FC_SEVERITY_KEYS } from './FindingCards';
import './FindingCards3.css';

/** Relative time for feed/age displays: "3 min ago", "2 h ago", "5 d ago". */
export function formatRelative(ts = 0) {
  const d = Date.now() - ts;
  if (d < 60 * 1000) return 'just now';
  if (d < 60 * 60 * 1000) return `${Math.floor(d / 60000)} min ago`;
  if (d < 24 * 60 * 60 * 1000) return `${Math.floor(d / 3600000)} h ago`;
  return `${Math.floor(d / 86400000)} d ago`;
}

/** Age duration without "ago": "12 min", "5 hours", "3 days". */
export function formatAge(ts = 0) {
  const d = Math.max(0, Date.now() - ts);
  if (d < 60 * 60 * 1000) return `${Math.max(1, Math.floor(d / 60000))} min`;
  if (d < 24 * 60 * 60 * 1000) return `${Math.floor(d / 3600000)} hours`;
  return `${Math.floor(d / 86400000)} days`;
}

/** 50161 — Add-to-report toggle: checkbox-style switch bound to report inclusion. */
export function AddToReportToggle({ included = false, onToggle, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={included}
      className={`fc3-switch ${included ? 'fc3-on' : ''} ${className}`}
      onClick={() => onToggle && onToggle(!included)}
      aria-label={included ? 'Remove from report' : 'Add to report'}
      title={included ? 'Included in report — click to remove' : 'Add to report'}
    >
      <span className="fc3-switch-knob" aria-hidden="true" />
      <span className="fc3-switch-label">{included ? 'In report' : 'Add to report'}</span>
    </button>
  );
}

/**
 * 50162 — Grid versus list view toggle (segmented control).
 *
 * FindingsGrid usage note: render the card list inside a wrapper that
 * switches layout by mode, e.g.
 *   <div className={`fc3-findings ${mode === 'grid' ? 'fc3-grid' : 'fc3-list'}`}>…cards…</div>
 * .fc3-grid uses a responsive card grid; .fc3-list stacks full-width rows.
 */
export function FindingsViewModeToggle({ mode = 'grid', onChange, className = '' }) {
  const modes = [
    { key: 'grid', label: 'Grid', icon: '▦' },
    { key: 'list', label: 'List', icon: '☰' },
  ];
  return (
    <div className={`fc3-viewmode ${className}`} role="group" aria-label="Findings view mode">
      {modes.map(m => (
        <button
          key={m.key}
          type="button"
          className={`fc3-viewmode-btn ${mode === m.key ? 'fc3-active' : ''}`}
          onClick={() => onChange && onChange(m.key)}
          aria-pressed={mode === m.key}
        >
          <span aria-hidden="true">{m.icon}</span> {m.label}
        </button>
      ))}
    </div>
  );
}

/** 50163 — Sticky header bar inside an expanded card body (position: sticky in CSS). */
export function StickyExpandedHeader({ title = 'Details', onClose, className = '' }) {
  return (
    <div className={`fc3-sticky-header ${className}`}>
      <span className="fc3-sticky-title">{title}</span>
      {onClose && (
        <button
          type="button"
          className="fc3-sticky-close"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** 50164 — Share-finding deep link: copies origin+path+#finding-<id>. */
export function DeepLinkCopyButton({ findingId = '', className = '' }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    const url = `${window.location.origin}${window.location.pathname}#finding-${findingId}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (fallbackErr) {
        ok = false;
      }
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
      className={`fc3-deeplink ${className}`}
      onClick={copy}
      title={`Copy deep link to finding ${findingId}`}
    >
      <span aria-hidden="true">🔗</span>{' '}
      <span aria-live="polite">{copied ? '✓ Copied' : 'Copy link'}</span>
    </button>
  );
}

/** Minimal line-based LCS diff used by RetestDiffView. */
function diffRows(before, after) {
  const a = String(before).split('\n');
  const b = String(after).split('\n');
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'ctx', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'del', text: a[i] });
      i++;
    } else {
      rows.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: 'del', text: a[i] });
    i++;
  }
  while (j < m) {
    rows.push({ type: 'add', text: b[j] });
    j++;
  }
  return rows;
}

/** 50165 — Retest diff view: line-based diff of before/after retest output. */
export function RetestDiffView({ before = '', after = '', className = '' }) {
  const rows = React.useMemo(() => diffRows(before, after), [before, after]);
  const changed = rows.filter(r => r.type !== 'ctx').length;
  return (
    <div className={`fc3-diff ${className}`}>
      <div className="fc3-diff-summary" role="status">
        {changed === 0
          ? 'No changes — output identical'
          : `${changed} line${changed === 1 ? '' : 's'} changed`}
      </div>
      <pre className="fc3-diff-body" aria-label="Retest diff" tabIndex={0}>
        {rows.map((r, idx) => (
          <div key={idx} className={`fc3-diff-line fc3-diff-${r.type}`}>
            <span className="fc3-diff-sign" aria-hidden="true">
              {r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '}
            </span>
            <code>{r.text || ' '}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

/** 50166 — Card activity feed: mini log with local append + relative times. */
export function CardActivityFeed({ entries = [], onAdd, className = '' }) {
  const [draft, setDraft] = React.useState('');
  const [local, setLocal] = React.useState([]);
  const all = [...local, ...entries];

  const log = () => {
    const action = draft.trim();
    if (!action) return;
    const entry = { who: 'Infinity AI', action, at: Date.now() };
    setLocal(l => [entry, ...l]);
    setDraft('');
    if (onAdd) onAdd(entry);
  };

  return (
    <div className={`fc3-activity ${className}`}>
      <div className="fc3-activity-add">
        <input
          type="text"
          className="fc3-activity-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') log();
          }}
          placeholder="Log an action… (Enter to save)"
          aria-label="Log activity"
        />
        <button type="button" className="fc3-activity-log" onClick={log} disabled={!draft.trim()}>
          Log
        </button>
      </div>
      {all.length === 0 ? (
        <p className="fc3-activity-empty">No activity yet — be the first to log one.</p>
      ) : (
        <ul className="fc3-activity-list">
          {all.map((e, idx) => (
            <li key={idx} className="fc3-activity-item">
              <span className="fc3-activity-who">{e.who || 'Infinity AI'}</span>
              <span className="fc3-activity-action">{e.action}</span>
              <time className="fc3-activity-at" title={new Date(e.at).toLocaleString()}>
                {formatRelative(e.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 50167 — Escalate button: inline severity-escalation form with mandatory reason + audit note. */
export function EscalateButton({
  findingId = '',
  currentSeverity = 'medium',
  onEscalate,
  className = '',
}) {
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState('high');
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(null);

  const confirm = () => {
    if (!reason.trim()) {
      setError('A reason is required to escalate.');
      return;
    }
    const record = {
      findingId,
      from: currentSeverity,
      to,
      reason: reason.trim(),
      at: Date.now(),
      by: 'Infinity AI',
    };
    if (onEscalate) onEscalate(record);
    setDone(record);
    setOpen(false);
    setReason('');
    setError('');
  };

  if (done) {
    return (
      <div className={`fc3-escalated ${className}`} role="status">
        <span aria-hidden="true">⬆</span> Escalated {done.from} → {done.to} by {done.by} —{' '}
        {new Date(done.at).toLocaleString()}
        <div className="fc3-escalated-reason">“{done.reason}”</div>
      </div>
    );
  }

  return (
    <span className={`fc3-escalate ${className}`}>
      {!open ? (
        <button
          type="button"
          className="fc3-escalate-open"
          onClick={() => {
            setOpen(true);
            setTo(currentSeverity === 'critical' ? 'critical' : 'high');
          }}
        >
          <span aria-hidden="true">⬆</span> Escalate
        </button>
      ) : (
        <span className="fc3-escalate-form" role="form" aria-label="Escalate finding">
          <label>
            Target severity
            <select value={to} onChange={e => setTo(e.target.value)} aria-label="Target severity">
              {FC_SEVERITY_KEYS.map(k => (
                <option key={k} value={k}>
                  {FC_SEVERITY[k].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reason{' '}
            <span className="fc3-required" aria-hidden="true">
              *
            </span>
            <input
              type="text"
              value={reason}
              onChange={e => {
                setReason(e.target.value);
                setError('');
              }}
              placeholder="Why escalate this finding?"
              aria-required="true"
            />
          </label>
          {error && (
            <span className="fc3-form-error" role="alert">
              {error}
            </span>
          )}
          <span className="fc3-escalate-actions">
            <button type="button" className="fc3-escalate-confirm" onClick={confirm}>
              Confirm escalation
            </button>
            <button
              type="button"
              className="fc3-escalate-cancel"
              onClick={() => {
                setOpen(false);
                setError('');
              }}
            >
              Cancel
            </button>
          </span>
        </span>
      )}
    </span>
  );
}

/** 50168 — Empty-evidence placeholder: shown when no screenshot exists. */
export function EmptyEvidencePlaceholder({ className = '' }) {
  return (
    <div
      className={`fc3-empty-evidence ${className}`}
      role="note"
      aria-label="No screenshot evidence"
    >
      <span aria-hidden="true" className="fc3-empty-evidence-icon">
        ▨
      </span>
      <span>no screenshot — request/response only</span>
    </div>
  );
}

/** 50170 — Translate-summary toggle: original vs user-language translation. */
export function TranslateSummaryToggle({ original = '', translations = {}, className = '' }) {
  const userLang = (
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
  )
    .split('-')[0]
    .toLowerCase();
  const translated = translations[userLang];
  const [showTranslated, setShowTranslated] = React.useState(false);

  return (
    <div className={`fc3-translate ${className}`}>
      <p className="fc3-translate-text" lang={showTranslated && translated ? userLang : 'en'}>
        {showTranslated && translated ? translated : original}
      </p>
      {translated ? (
        <button
          type="button"
          className="fc3-translate-btn"
          onClick={() => setShowTranslated(s => !s)}
          aria-pressed={showTranslated}
        >
          {showTranslated ? 'Show original' : `Translate (${userLang})`}
        </button>
      ) : (
        <span className="fc3-translate-note" role="note">
          translation unavailable for {userLang}
        </span>
      )}
    </div>
  );
}

/** 50171 — Reading-time estimate at ~200 wpm; only renders at >= 1 min. */
export function ReadingTimeEstimate({ text = '', className = '' }) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.floor(words / 200);
  if (minutes < 1) return null;
  return (
    <span
      className={`fc3-readtime ${className}`}
      aria-label={`Estimated reading time ${minutes} minutes`}
    >
      <span aria-hidden="true">⏱</span> {minutes} min read
    </span>
  );
}

/** 50172 — Report-inclusion corner fold: folded-corner marker when included. */
export function ReportInclusionCornerFold({ included = false }) {
  if (!included) return null;
  return (
    <span className="fc3-corner-fold" aria-label="Included in report" title="Included in report" />
  );
}

/** 50173 — Suppress-similar action: builds a dedup rule and passes it to onSuppress. */
export function SuppressSimilarButton({ finding = {}, onSuppress, className = '' }) {
  const [stage, setStage] = React.useState('idle'); // idle | confirm | done

  const signature = `${String(finding.title || 'untitled')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()}@${finding.asset && finding.asset.host ? finding.asset.host : 'unknown'}`;

  const suppress = () => {
    const rule = {
      signature,
      severity: finding.severity || 'medium',
      createdAt: Date.now(),
      by: 'Infinity AI',
    };
    if (onSuppress) onSuppress(rule);
    setStage('done');
  };

  if (stage === 'done') {
    return (
      <span className={`fc3-suppress-done ${className}`} role="status">
        <span aria-hidden="true">✓</span> Similar findings suppressed
      </span>
    );
  }

  return (
    <span className={`fc3-suppress ${className}`}>
      {stage === 'confirm' ? (
        <span className="fc3-suppress-confirm">
          <span>
            Suppress all matching <code>{signature}</code>?
          </span>
          <button type="button" className="fc3-suppress-yes" onClick={suppress}>
            Confirm
          </button>
          <button type="button" className="fc3-suppress-no" onClick={() => setStage('idle')}>
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="fc3-suppress-open"
          onClick={() => setStage('confirm')}
          title="Create a dedup rule for similar findings"
        >
          <span aria-hidden="true">⛔</span> Suppress similar
        </button>
      )}
    </span>
  );
}

/** 50174 — Embedded PoC-replay player: real timed playback through PoC steps. */
export function PocReplayPlayer({ steps = [], className = '' }) {
  const [idx, setIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (!playing || steps.length === 0) return undefined;
    if (idx >= steps.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const t = setTimeout(() => setIdx(i => Math.min(i + 1, steps.length - 1)), 1200);
    return () => clearTimeout(t);
  }, [playing, idx, steps.length]);

  if (!steps.length) {
    return (
      <div className={`fc3-poc ${className}`}>
        <p className="fc3-poc-empty">No PoC steps recorded.</p>
      </div>
    );
  }

  const step = steps[idx];
  const pct = ((idx + 1) / steps.length) * 100;

  return (
    <div className={`fc3-poc ${className}`} aria-label="PoC replay player">
      <div className="fc3-poc-step">
        <div className="fc3-poc-label">{step.label || `Step ${idx + 1}`}</div>
        {step.detail && (
          <pre className="fc3-poc-detail" tabIndex={0} aria-label="PoC step detail">
            {step.detail}
          </pre>
        )}
      </div>
      <div
        className="fc3-poc-progress-track"
        role="progressbar"
        aria-valuenow={idx + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label="PoC progress"
      >
        <div className="fc3-poc-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="fc3-poc-controls">
        <button
          type="button"
          className="fc3-poc-btn"
          onClick={() => {
            setPlaying(false);
            setIdx(i => Math.max(0, i - 1));
          }}
          disabled={idx === 0}
          aria-label="Previous step"
        >
          <span aria-hidden="true">⏮</span>
        </button>
        <button
          type="button"
          className="fc3-poc-btn fc3-poc-play"
          onClick={() => setPlaying(p => !p)}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          aria-pressed={playing}
        >
          <span aria-hidden="true">{playing ? '⏸' : '▶'}</span>
        </button>
        <button
          type="button"
          className="fc3-poc-btn"
          onClick={() => {
            setPlaying(false);
            setIdx(i => Math.min(steps.length - 1, i + 1));
          }}
          disabled={idx === steps.length - 1}
          aria-label="Next step"
        >
          <span aria-hidden="true">⏭</span>
        </button>
        <span className="fc3-poc-counter" aria-live="polite">
          Step {idx + 1} of {steps.length}
        </span>
      </div>
    </div>
  );
}

/** 50175 — Finding-age indicator: "open N days/hours/min", color shifts with age. */
export function FindingAgeIndicator({ discoveredAt = 0, className = '' }) {
  const ageMs = Date.now() - discoveredAt;
  const day = 24 * 60 * 60 * 1000;
  const tone = ageMs < day ? 'fresh' : ageMs < 7 * day ? 'warning' : 'stale';
  return (
    <span
      className={`fc3-age fc3-age-${tone} ${className}`}
      title={`Discovered ${new Date(discoveredAt).toLocaleString()}`}
    >
      <span aria-hidden="true">◷</span> open {formatAge(discoveredAt)}
    </span>
  );
}

/**
 * 50176 — Priority score (pure function): 0–100 integer.
 * severity weight (critical 40 / high 30 / medium 20 / low 10 / info 5)
 * + confidence (0–100 → 0–30 pts)
 * + exploitability (exploitSteps → up to 30 pts; theoretical = 5).
 */
export function priorityScore(finding = {}) {
  const sevWeights = { critical: 40, high: 30, medium: 20, low: 10, info: 5 };
  const sevPts = sevWeights[finding.severity] !== undefined ? sevWeights[finding.severity] : 10;
  const conf = Math.max(0, Math.min(100, Number(finding.confidence) || 0));
  const confPts = (conf / 100) * 30;
  let exploitPts = 5; // theoretical
  if (typeof finding.exploitSteps === 'number' && finding.exploitSteps > 0) {
    exploitPts = Math.max(12, Math.min(30, 34 - finding.exploitSteps * 4));
  }
  return Math.round(Math.min(100, sevPts + confPts + exploitPts));
}

/** 50176 — Priority score badge: renders the number; sort with priorityScore(). */
export function PriorityScoreBadge({ finding = {}, className = '' }) {
  const score = priorityScore(finding);
  const tone = score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low';
  return (
    <span
      className={`fc3-priority fc3-priority-${tone} ${className}`}
      title={`Priority score ${score}/100`}
      aria-label={`Priority score ${score} of 100`}
    >
      <span aria-hidden="true">⚑</span> {score}
    </span>
  );
}

/** 50177 — Minimize toggle: collapses the card to a title-bar-only row. */
export function MinimizeToggle({ minimized = false, onToggle, className = '' }) {
  return (
    <button
      type="button"
      className={`fc3-minimize ${className}`}
      onClick={() => onToggle && onToggle(!minimized)}
      aria-expanded={!minimized}
      aria-label={minimized ? 'Restore card' : 'Minimize card to title bar'}
      title={minimized ? 'Restore' : 'Minimize'}
    >
      <span aria-hidden="true">{minimized ? '▢' : '—'}</span>
    </button>
  );
}

/** 50177 — Minimized rendering: a title-bar-only row (card in minimized mode). */
export function MinimizedFindingCard({
  title = 'Untitled finding',
  severity = 'medium',
  onRestore,
  className = '',
}) {
  const s = FC_SEVERITY[severity] || FC_SEVERITY.medium;
  return (
    <article
      className={`fc3-minimized ${className}`}
      aria-label={`Minimized: ${title}, ${s.label} severity`}
    >
      <span className="fc3-minimized-dot" style={{ '--fc-sev': s.color }} aria-hidden="true" />
      <h3 className="fc3-minimized-title">{title}</h3>
      <button
        type="button"
        className="fc3-minimized-restore"
        onClick={onRestore}
        aria-label={`Restore ${title}`}
      >
        <span aria-hidden="true">▢</span> Restore
      </button>
    </article>
  );
}

/** 50178 — Previous-hunt comparison badge: NEW green, REGRESSED red, FIXED gray. */
export function PreviousHuntBadge({ status = '', className = '' }) {
  const map = {
    new: { label: 'NEW', cls: 'fc3-prev-new' },
    regressed: { label: 'REGRESSED', cls: 'fc3-prev-regressed' },
    fixed: { label: 'FIXED', cls: 'fc3-prev-fixed' },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <span
      className={`fc3-prev ${m.cls} ${className}`}
      role="status"
      aria-label={`Previous hunt status: ${m.label}`}
    >
      {m.label}
    </span>
  );
}

/**
 * 50179 — Accessible card markup.
 *
 * Heading hierarchy this models: page <h1> → hunt summary <h2> →
 * card title <h3> (here) → expanded sections <h4>. The article carries
 * role="article", the title is a real <h3>, and the chevron button owns
 * aria-expanded + an aria-label naming the severity.
 */
export function AccessibleFindingCard({
  title = 'Untitled finding',
  severity = 'medium',
  children,
  className = '',
}) {
  const [expanded, setExpanded] = React.useState(false);
  const s = FC_SEVERITY[severity] || FC_SEVERITY.medium;
  return (
    <article
      role="article"
      className={`fc3-a11y-card ${className}`}
      aria-label={`${title}, ${s.label} severity`}
    >
      <header className="fc3-a11y-head">
        <h3 className="fc3-a11y-title">{title}</h3>
        <button
          type="button"
          className="fc3-a11y-chevron"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}, ${s.label} severity`}
        >
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        </button>
      </header>
      {expanded && <div className="fc3-a11y-body">{children}</div>}
    </article>
  );
}

/** 50180 — Severity multi-select chips with live counts; toggle + All/None reset. */
export function SeverityMultiSelectChips({ selected = [], counts = {}, onChange, className = '' }) {
  const toggle = key => {
    const next = selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key];
    if (onChange) onChange(next);
  };
  return (
    <div className={`fc3-sevchips ${className}`} role="group" aria-label="Filter by severity">
      {FC_SEVERITY_KEYS.map(key => {
        const active = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            className={`fc3-sevchip ${active ? 'fc3-selected' : ''}`}
            style={{ '--fc-sev': FC_SEVERITY[key].color }}
            onClick={() => toggle(key)}
            aria-pressed={active}
            aria-label={`${FC_SEVERITY[key].label} severity, ${counts[key] || 0} findings${active ? ', selected' : ''}`}
          >
            <span className="fc3-sevchip-dot" aria-hidden="true" />
            {FC_SEVERITY[key].label}
            <span className="fc3-sevchip-count">{counts[key] || 0}</span>
          </button>
        );
      })}
      <span className="fc3-sevchip-reset">
        <button type="button" onClick={() => onChange && onChange(FC_SEVERITY_KEYS.slice())}>
          All
        </button>
        <button type="button" onClick={() => onChange && onChange([])}>
          None
        </button>
      </span>
    </div>
  );
}
