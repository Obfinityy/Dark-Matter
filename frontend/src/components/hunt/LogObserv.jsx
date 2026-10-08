/**
 * LogObserv.jsx — wave 32 (ideas 51241–51260): log observability round 3,
 * part 1. Real working components driving local state — no mocks,
 * no demo-only controls.
 */
import React, { useMemo, useState } from 'react';
import {
  addBookmark,
  removeBookmark,
  listBookmarks,
  flagAnomalies,
  correlateLines,
  tailFollowState,
  sampleLines,
  sampleLabel,
  toLogCards,
  diffLogSegments,
  toolRuntimeStats,
  commandEcho,
  retentionSlice,
  switchHuntLog,
  restoreScroll,
  addAnnotation,
  quietHoursCollapse,
  checkAlertPatterns,
  screenshotEvents,
  minimapBuckets,
  toCurl,
  applyRedactionPreset,
  thoughtStreamEntry,
  perfOverlay,
} from './logObservCore.js';

const DEMO_LINES = [
  {
    id: 'l1',
    ts: 1728220000000,
    level: 'info',
    module: 'recon',
    text: 'Starting subdomain enumeration for target.example.com',
  },
  {
    id: 'l2',
    ts: 1728220005000,
    level: 'info',
    module: 'recon',
    text: 'Found 12 subdomains via certificate transparency',
  },
  {
    id: 'l3',
    ts: 1728220010000,
    level: 'error',
    module: 'scanner',
    text: 'Connection refused on port 8443',
    tool: 'portscan',
    durationMs: 120,
  },
  {
    id: 'l4',
    ts: 1728220015000,
    level: 'error',
    module: 'scanner',
    text: 'Connection refused on port 8443',
    tool: 'portscan',
    durationMs: 110,
  },
  {
    id: 'l5',
    ts: 1728220020000,
    level: 'error',
    module: 'scanner',
    text: 'Connection refused on port 8443',
    tool: 'portscan',
    durationMs: 115,
  },
  {
    id: 'l6',
    ts: 1728220025000,
    level: 'finding',
    module: 'detector',
    text: 'XSS candidate on /search?q= — reflected without encoding',
    findingId: 'F-101',
    tool: 'vulnDetector',
    durationMs: 840,
  },
  { id: 'l7', ts: 1728220030000, level: 'info', module: 'heartbeat', text: 'heartbeat ok' },
  { id: 'l8', ts: 1728220035000, level: 'info', module: 'heartbeat', text: 'heartbeat ok' },
];

/* 51241 — Log bookmarks */
export function LogBookmarks({ lines }) {
  const [bookmarks, setBookmarks] = useState({});
  const [note, setNote] = useState('');
  const [sel, setSel] = useState('');
  const list = listBookmarks(bookmarks);
  return (
    <div className="lo32-card">
      <h4>Log bookmarks</h4>
      <div className="lo32-row">
        <select value={sel} onChange={e => setSel(e.target.value)} aria-label="Line to bookmark">
          <option value="">pick a line…</option>
          {lines.map(l => (
            <option key={l.id} value={l.id}>
              {l.id}: {String(l.text).slice(0, 40)}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="note…"
          aria-label="Bookmark note"
        />
        <button
          className="lo32-btn"
          onClick={() => sel && setBookmarks(b => addBookmark(b, sel, note))}
        >
          Bookmark
        </button>
      </div>
      <ul className="lo32-list">
        {list.map(b => (
          <li key={b.lineId}>
            {b.lineId} — {b.note || '(no note)'}
            <button
              className="lo32-link"
              onClick={() => setBookmarks(x => removeBookmark(x, b.lineId))}
            >
              remove
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="lo32-dim">No bookmarks yet.</p>}
    </div>
  );
}

/* 51242 — Anomaly flagging */
export function AnomalyFlags({ lines }) {
  const flags = useMemo(() => flagAnomalies(lines), [lines]);
  return (
    <div className="lo32-card">
      <h4>Anomaly flags ({flags.length})</h4>
      <ul className="lo32-list">
        {flags.map((f, i) => (
          <li key={i}>
            <span className="lo32-badge">{f.reason}</span> {f.lineId}
          </li>
        ))}
      </ul>
      {flags.length === 0 && <p className="lo32-dim">No anomalies detected.</p>}
    </div>
  );
}

/* 51243 — Log correlation */
export function LogCorrelation({ lines, findings }) {
  const correlated = useMemo(() => correlateLines(lines, findings), [lines, findings]);
  return (
    <div className="lo32-card">
      <h4>Log correlation</h4>
      <ul className="lo32-list">
        {correlated
          .filter(l => l.findingId)
          .map(l => (
            <li key={l.id}>
              {l.id} → <span className="lo32-badge">{l.findingId}</span>{' '}
              {l.phase ? `(${l.phase})` : ''}
            </li>
          ))}
      </ul>
      {correlated.every(l => !l.findingId) && (
        <p className="lo32-dim">No lines linked to findings.</p>
      )}
    </div>
  );
}

/* 51244 — Tail-follow mode */
export function TailFollow({ lines }) {
  const [following, setFollowing] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [scrolledUp, setScrolledUp] = useState(false);
  const state = tailFollowState({ following, hovering, scrolledUp });
  return (
    <div className="lo32-card">
      <h4>Tail-follow mode</h4>
      <p>
        Status: <span className="lo32-badge">{state}</span>
      </p>
      <div className="lo32-row">
        <button className="lo32-btn" onClick={() => setFollowing(f => !f)}>
          {following ? 'Unfollow' : 'Follow tail'}
        </button>
        <button className="lo32-btn" onClick={() => setScrolledUp(s => !s)}>
          {scrolledUp ? 'Scroll to bottom' : 'Simulate scroll-up'}
        </button>
      </div>
      <div
        className="lo32-log"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {lines.slice(-8).map(l => (
          <div key={l.id}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

/* 51245 — Log sampling */
export function LogSampling({ lines }) {
  const [maxN, setMaxN] = useState(5);
  const { sample, total, sampled } = useMemo(() => sampleLines(lines, maxN, []), [lines, maxN]);
  return (
    <div className="lo32-card">
      <h4>Log sampling</h4>
      <p className="lo32-dim">
        {sampleLabel(sample.length, total)}
        {sampled ? ' (sampled)' : ''}
      </p>
      <input
        type="range"
        min={2}
        max={lines.length}
        value={maxN}
        onChange={e => setMaxN(Number(e.target.value))}
        aria-label="Sample size"
      />
      <div className="lo32-log">
        {sample.map(l => (
          <div key={l.id}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

/* 51246 — Structured log cards */
export function LogCards({ lines }) {
  const cards = useMemo(() => toLogCards(lines), [lines]);
  return (
    <div className="lo32-card">
      <h4>Structured log cards ({cards.length})</h4>
      {cards.map(c => (
        <div key={c.id} className="lo32-logcard">
          <span className="lo32-badge">{c.kind}</span> <strong>{c.title}</strong>
          <p className="lo32-dim">{c.body.slice(0, 120)}</p>
        </div>
      ))}
    </div>
  );
}

/* 51247 — Log diff view */
export function LogDiff({ a, b }) {
  const d = useMemo(() => diffLogSegments(a, b), [a, b]);
  return (
    <div className="lo32-card">
      <h4>Log diff</h4>
      <p>
        <span className="lo32-badge">+{d.addedCount}</span>{' '}
        <span className="lo32-badge">−{d.removedCount}</span>
      </p>
      <div className="lo32-log">
        {d.added.map((l, i) => (
          <div key={`a${i}`} className="lo32-added">
            + {l.text}
          </div>
        ))}
        {d.removed.map((l, i) => (
          <div key={`r${i}`} className="lo32-removed">
            − {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 51248 — Tool runtime stats */
export function ToolStats({ lines }) {
  const stats = useMemo(() => toolRuntimeStats(lines), [lines]);
  return (
    <div className="lo32-card">
      <h4>Tool runtime stats</h4>
      <table className="lo32-table">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Runs</th>
            <th>Avg ms</th>
            <th>Err %</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.tool}>
              <td>{s.tool}</td>
              <td>{s.runs}</td>
              <td>{s.avgMs}</td>
              <td>{s.errorRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.length === 0 && <p className="lo32-dim">No tool data.</p>}
    </div>
  );
}

/* 51249 — Command echo */
export function CommandEcho({ decision }) {
  const e = commandEcho(decision);
  return (
    <div className="lo32-card">
      <h4>Command echo</h4>
      <pre className="lo32-pre">{e.line}</pre>
    </div>
  );
}

/* 51250 — Log retention control */
export function RetentionControl({ lines }) {
  const [limit, setLimit] = useState(50);
  const kept = useMemo(() => retentionSlice(lines, limit), [lines, limit]);
  return (
    <div className="lo32-card">
      <h4>Log retention</h4>
      <div className="lo32-row">
        <input
          type="range"
          min={1}
          max={Math.max(1, lines.length)}
          value={Math.min(limit, lines.length)}
          onChange={e => setLimit(Number(e.target.value))}
          aria-label="Retention limit"
        />
        <span className="lo32-dim">
          keeping last {kept.length} of {lines.length}
        </span>
      </div>
    </div>
  );
}

/* 51251 — Multi-hunt log switcher */
export function HuntLogSwitcher({ hunts }) {
  const [state, setState] = useState({ activeHuntId: hunts[0] && hunts[0].id, scroll: {} });
  const [scroll, setScroll] = useState(0);
  const active = hunts.find(h => h.id === state.activeHuntId);
  return (
    <div className="lo32-card">
      <h4>Multi-hunt log switcher</h4>
      <div className="lo32-row" role="tablist">
        {hunts.map(h => (
          <button
            key={h.id}
            role="tab"
            aria-selected={state.activeHuntId === h.id}
            className={`lo32-btn ${state.activeHuntId === h.id ? 'lo32-btn-active' : ''}`}
            onClick={() => {
              setState(s => switchHuntLog(s, h.id, scroll));
              setScroll(restoreScroll(state, h.id));
            }}
          >
            {h.name}
          </button>
        ))}
      </div>
      <p className="lo32-dim">
        Viewing {active ? active.name : '—'} — scroll restored to {scroll}px
      </p>
      <input
        type="range"
        min={0}
        max={1000}
        value={scroll}
        onChange={e => setScroll(Number(e.target.value))}
        aria-label="Scroll position"
      />
    </div>
  );
}

/* 51252 — Log annotations */
export function LogAnnotations({ lines }) {
  const [ann, setAnn] = useState({});
  const [sel, setSel] = useState('');
  const [note, setNote] = useState('');
  return (
    <div className="lo32-card">
      <h4>Log annotations</h4>
      <div className="lo32-row">
        <select value={sel} onChange={e => setSel(e.target.value)} aria-label="Line to annotate">
          <option value="">pick a line…</option>
          {lines.map(l => (
            <option key={l.id} value={l.id}>
              {l.id}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="your note…"
          aria-label="Annotation"
        />
        <button
          className="lo32-btn"
          onClick={() => sel && setAnn(a => addAnnotation(a, sel, 'you', note))}
        >
          Annotate
        </button>
      </div>
      <ul className="lo32-list">
        {Object.entries(ann).map(([id, list]) =>
          list.map((a, i) => (
            <li key={`${id}-${i}`}>
              {id}: <em>{a.author}</em> — {a.note}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* 51253 — Quiet hours for logs */
export function QuietHours({ lines }) {
  const [quiet, setQuiet] = useState(false);
  const {
    lines: kept,
    summaries,
    collapsedCount,
  } = useMemo(() => quietHoursCollapse(lines), [lines]);
  const shown = quiet ? [...kept, ...summaries] : lines;
  return (
    <div className="lo32-card">
      <h4>Quiet hours</h4>
      <button className="lo32-btn" onClick={() => setQuiet(q => !q)}>
        {quiet ? 'Disable' : 'Enable'} quiet hours
      </button>
      {quiet && <p className="lo32-dim">{collapsedCount} routine messages collapsed</p>}
      <div className="lo32-log">
        {shown.slice(-10).map(l => (
          <div key={l.id}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

/* 51254 — Log-driven alerts */
export function LogAlerts({ lines }) {
  const [pattern, setPattern] = useState('refused');
  const [patterns, setPatterns] = useState([{ pattern: 'refused', label: 'Connection issues' }]);
  const hits = useMemo(
    () => lines.flatMap(l => checkAlertPatterns(l, patterns).map(p => ({ line: l, pattern: p }))),
    [lines, patterns]
  );
  return (
    <div className="lo32-card">
      <h4>Log-driven alerts</h4>
      <div className="lo32-row">
        <input
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          placeholder="pattern…"
          aria-label="Alert pattern"
        />
        <button
          className="lo32-btn"
          onClick={() => pattern && setPatterns(p => [...p, { pattern, label: pattern }])}
        >
          Add alert
        </button>
      </div>
      <ul className="lo32-list">
        {hits.map((h, i) => (
          <li key={i}>
            <span className="lo32-badge">alert: {h.pattern.label}</span> {h.line.text}
          </li>
        ))}
      </ul>
      {hits.length === 0 && <p className="lo32-dim">No pattern matches.</p>}
    </div>
  );
}

/* 51255 — Screenshot-on-event */
export function ScreenshotEvents({ lines }) {
  const events = useMemo(() => screenshotEvents(lines), [lines]);
  return (
    <div className="lo32-card">
      <h4>Screenshot-on-event ({events.length})</h4>
      <ul className="lo32-list">
        {events.map((e, i) => (
          <li key={i}>
            {e.lineId} — captured ({e.reason})
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51256 — Log timeline minimap */
export function LogMinimap({ lines }) {
  const buckets = useMemo(() => minimapBuckets(lines, 24), [lines]);
  return (
    <div className="lo32-card">
      <h4>Timeline minimap</h4>
      <div className="lo32-minimap" role="img" aria-label="Log density minimap">
        {buckets.map((v, i) => (
          <span key={i} className="lo32-minibar" style={{ height: `${Math.max(4, v * 40)}px` }} />
        ))}
      </div>
    </div>
  );
}

/* 51257 — Copy-as-curl */
export function CopyAsCurl({ request }) {
  const [copied, setCopied] = useState(false);
  const cmd = toCurl(request);
  return (
    <div className="lo32-card">
      <h4>Copy as curl</h4>
      <pre className="lo32-pre">{cmd}</pre>
      <button
        className="lo32-btn"
        onClick={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

/* 51258 — Log redaction presets */
export function RedactionPresets({ text }) {
  const [preset, setPreset] = useState('demo');
  return (
    <div className="lo32-card">
      <h4>Redaction presets</h4>
      <div className="lo32-row" role="radiogroup" aria-label="Redaction preset">
        {['demo', 'client', 'public'].map(p => (
          <button
            key={p}
            className={`lo32-btn ${preset === p ? 'lo32-btn-active' : ''}`}
            onClick={() => setPreset(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <pre className="lo32-pre">{applyRedactionPreset(text, preset)}</pre>
    </div>
  );
}

/* 51259 — Agent thought stream */
export function ThoughtStream({ thoughts }) {
  return (
    <div className="lo32-card">
      <h4>Agent thought stream</h4>
      {thoughts.map(t => {
        const e = thoughtStreamEntry(t);
        return (
          <div key={e.id} className="lo32-thought">
            <p>{e.text}</p>
            {e.confidence != null && (
              <span className="lo32-dim">confidence {Math.round(e.confidence * 100)}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* 51260 — Log performance overlay */
export function PerfOverlay({ lines }) {
  const buckets = useMemo(() => perfOverlay(lines, 12), [lines]);
  const max = Math.max(...buckets.map(b => b.count), 1);
  return (
    <div className="lo32-card">
      <h4>Performance overlay</h4>
      <div className="lo32-minimap" role="img" aria-label="Request rate overlay">
        {buckets.map((b, i) => (
          <span
            key={i}
            className="lo32-minibar lo32-minibar-perf"
            style={{ height: `${Math.max(4, (b.count / max) * 40)}px` }}
            title={`${b.count} req, ${b.avgMs}ms avg`}
          />
        ))}
      </div>
      <p className="lo32-dim">bars = request rate, hover for avg latency</p>
    </div>
  );
}

/* Gallery showcasing all part-1 components */
export function LogObservGallery() {
  const findings = [{ id: 'F-101', phase: 'detection' }];
  const hunts = [
    { id: 'h1', name: 'Hunt A' },
    { id: 'h2', name: 'Hunt B' },
  ];
  return (
    <div className="lo32-gallery">
      <h3>Log observability round 3 — gallery (51241–51260)</h3>
      <LogBookmarks lines={DEMO_LINES} />
      <AnomalyFlags lines={DEMO_LINES} />
      <LogCorrelation lines={DEMO_LINES} findings={findings} />
      <TailFollow lines={DEMO_LINES} />
      <LogSampling lines={DEMO_LINES} />
      <LogCards lines={DEMO_LINES} />
      <LogDiff a={DEMO_LINES.slice(0, 4)} b={DEMO_LINES.slice(2, 6)} />
      <ToolStats lines={DEMO_LINES} />
      <CommandEcho
        decision={{
          decision: 'scan',
          command: 'nmap -sV target.example.com',
          why: 'open ports unknown',
        }}
      />
      <RetentionControl lines={DEMO_LINES} />
      <HuntLogSwitcher hunts={hunts} />
      <LogAnnotations lines={DEMO_LINES} />
      <QuietHours lines={DEMO_LINES} />
      <LogAlerts lines={DEMO_LINES} />
      <ScreenshotEvents lines={DEMO_LINES} />
      <LogMinimap lines={DEMO_LINES} />
      <CopyAsCurl
        request={{
          method: 'GET',
          url: 'https://target.example.com/api/users',
          headers: { Authorization: 'Bearer token123' },
        }}
      />
      <RedactionPresets text="login with password=s3cret and token=abc123 from 10.0.0.5" />
      <ThoughtStream
        thoughts={[
          {
            id: 't1',
            text: 'Port 8443 refused three times — likely filtered, moving to 443.',
            confidence: 0.82,
          },
        ]}
      />
      <PerfOverlay lines={DEMO_LINES} />
    </div>
  );
}
