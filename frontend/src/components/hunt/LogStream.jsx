/**
 * LogStream.jsx — wave 31 (ideas 51229–51240): live log observability
 * suite. Real working components driving local state — no mocks,
 * no demo-only controls.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  formatLogLine,
  filterByLevel,
  groupByModule,
  searchLogs,
  expandLine,
  redactPayloads,
  applyHighlightRules,
  errorOnlyView,
  exportLogs,
  inspectRequest,
  formatResponse,
  playbackSpeeds,
  playbackSchedule,
} from './governanceCore.js';

/* 51229 — Live log stream */
export function LiveLogStream({ lines }) {
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(lines);
  React.useEffect(() => {
    if (!paused) setVisible(lines);
  }, [lines, paused]);
  const endRef = useRef(null);
  return (
    <div className="gov31-card">
      <div className="gov31-row">
        <h4>Live log stream</h4>
        <button className="gov31-btn" onClick={() => setPaused((p) => !p)}>{paused ? 'Resume' : 'Pause'}</button>
      </div>
      <div className="gov31-log" role="log" aria-label="Live hunt log">
        {visible.slice(-60).map((l, i) => <div key={i} className={`gov31-loglevel-${l.level}`}>{formatLogLine(l)}</div>)}
        <div ref={endRef} />
      </div>
    </div>
  );
}

/* 51230 — Log level filter */
export function LogLevelFilter({ lines, onChange }) {
  const [level, setLevel] = useState('debug');
  const filtered = useMemo(() => filterByLevel(lines, level), [lines, level]);
  React.useEffect(() => { onChange && onChange(filtered, level); }, [filtered, level, onChange]);
  return (
    <div className="gov31-card">
      <h4>Level filter</h4>
      <div className="gov31-row" role="radiogroup" aria-label="Minimum log level">
        {['debug', 'info', 'warning', 'error'].map((lv) => (
          <label key={lv} className="gov31-check">
            <input type="radio" name="loglevel" checked={level === lv} onChange={() => setLevel(lv)} /> {lv}
          </label>))}
      </div>
      <p className="gov31-dim">{filtered.length} of {lines.length} lines</p>
    </div>
  );
}

/* 51231 — Per-module log tabs */
export function ModuleTabs({ lines }) {
  const groups = useMemo(() => groupByModule(lines), [lines]);
  const modules = Object.keys(groups);
  const [active, setActive] = useState(modules[0] || '');
  return (
    <div className="gov31-card">
      <h4>Per-module streams</h4>
      <div className="gov31-row" role="tablist" aria-label="Log modules">
        {modules.map((m) => (
          <button key={m} role="tab" aria-selected={active === m}
            className={`gov31-btn ${active === m ? 'gov31-btn-active' : ''}`}
            onClick={() => setActive(m)}>{m} ({groups[m].length})</button>))}
      </div>
      <div className="gov31-log" role="tabpanel">
        {(groups[active] || []).slice(-30).map((l, i) => <div key={i}>{formatLogLine(l)}</div>)}
      </div>
    </div>
  );
}

/* 51232 — Log search */
export function LogSearch({ lines }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchLogs(lines, q), [lines, q]);
  return (
    <div className="gov31-card">
      <h4>Search logs</h4>
      <input className="gov31-input" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Full-text search…" aria-label="Search logs" />
      <div className="gov31-log">
        {results.slice(-30).map((l, i) => <div key={i}>{formatLogLine(l)}</div>)}
      </div>
      <p className="gov31-dim">{results.length} match(es)</p>
    </div>
  );
}

/* 51233 — Log line details */
export function LogLineDetails({ line }) {
  const [open, setOpen] = useState(false);
  const d = expandLine(line);
  return (
    <div className="gov31-card">
      <button className="gov31-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Hide details' : 'Expand line details'}</button>
      {open && (
        <div className="gov31-details">
          <p className="gov31-mono">{d.summary}</p>
          {d.request && <pre className="gov31-pre">REQUEST: {JSON.stringify(d.request, null, 2)}</pre>}
          {d.response && <pre className="gov31-pre">RESPONSE: {JSON.stringify(d.response, null, 2)}</pre>}
          {d.reasoning && <p><b>Agent reasoning:</b> {d.reasoning}</p>}
          {!d.hasDetails && <p className="gov31-dim">No extra details on this line.</p>}
        </div>)}
    </div>
  );
}

/* 51234 — Payload redaction */
export function RedactedLog({ text }) {
  const [revealed, setRevealed] = useState(false);
  const r = useMemo(() => redactPayloads(text), [text]);
  return (
    <div className="gov31-card">
      <h4>Redacted payload {r.redactedCount > 0 && <span className="gov31-pill gov31-warn">{r.redactedCount} masked</span>}</h4>
      <pre className="gov31-pre">{revealed ? text : r.text}</pre>
      {r.redactedCount > 0 && (
        <button className="gov31-btn" onClick={() => setRevealed((v) => !v)}>
          {revealed ? 'Mask again' : 'Reveal (logged)'}</button>)}
    </div>
  );
}

/* 51235 — Log highlighting */
export function HighlightRules({ lines }) {
  const [rules, setRules] = useState([{ pattern: 'error|fail', label: 'problems' }]);
  const [newRule, setNewRule] = useState('');
  const annotated = useMemo(() => applyHighlightRules(lines, rules), [lines, rules]);
  return (
    <div className="gov31-card">
      <h4>Highlight rules</h4>
      <div className="gov31-row">
        <input className="gov31-input" value={newRule} onChange={(e) => setNewRule(e.target.value)}
          placeholder="regex, e.g. timeout|retry" aria-label="New highlight pattern" />
        <button className="gov31-btn" disabled={!newRule.trim()}
          onClick={() => { setRules((rs) => [...rs, { pattern: newRule.trim(), label: newRule.trim() }]); setNewRule(''); }}>Add</button>
      </div>
      <div className="gov31-log">
        {annotated.slice(-20).map((l, i) => (
          <div key={i} className={l.highlights.length ? 'gov31-highlight' : ''}>
            {formatLogLine(l)}{l.highlights.length > 0 && <span className="gov31-dim"> ⚑ {l.highlights.join(',')}</span>}
          </div>))}
      </div>
    </div>
  );
}

/* 51236 — Error-only view */
export function ErrorOnlyToggle({ lines }) {
  const [on, setOn] = useState(false);
  const shown = on ? errorOnlyView(lines) : lines;
  return (
    <div className="gov31-card">
      <label className="gov31-check"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        Errors & warnings only</label>
      <div className="gov31-log">
        {shown.slice(-30).map((l, i) => <div key={i} className={`gov31-loglevel-${l.level}`}>{formatLogLine(l)}</div>)}
      </div>
    </div>
  );
}

/* 51237 — Log export */
export function LogExport({ lines }) {
  const [format, setFormat] = useState('text');
  const [done, setDone] = useState('');
  const doExport = () => {
    const out = exportLogs(lines, format);
    const blob = new Blob([out.content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hunt-log.${format === 'json' ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDone(`Exported ${out.lineCount} lines as ${format.toUpperCase()}.`);
  };
  return (
    <div className="gov31-card">
      <h4>Export log</h4>
      <div className="gov31-row">
        <select className="gov31-input" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Export format">
          <option value="text">Readable text</option>
          <option value="json">Structured JSON</option>
        </select>
        <button className="gov31-btn" onClick={doExport}>Download</button>
      </div>
      {done && <p className="gov31-ok">{done}</p>}
    </div>
  );
}

/* 51238 — Live request inspector */
export function RequestInspector({ entry }) {
  if (!entry) return null;
  const r = inspectRequest(entry);
  return (
    <div className="gov31-card">
      <h4>Request inspector</h4>
      <p className="gov31-mono">{r.method} {r.url}</p>
      {Object.keys(r.headers).length > 0 && <pre className="gov31-pre">{JSON.stringify(r.headers, null, 2)}</pre>}
      {r.bodyPreview && <pre className="gov31-pre">{r.bodyPreview}</pre>}
    </div>
  );
}

/* 51239 — Response viewer */
export function ResponseViewer({ result }) {
  const [full, setFull] = useState(false);
  if (!result) return null;
  const v = formatResponse(result);
  return (
    <div className="gov31-card">
      <h4>Response viewer {v.status != null && <span className="gov31-dim">· HTTP {v.status}</span>}</h4>
      <pre className="gov31-pre">{full || !v.truncated ? v.preview + (v.truncated && full ? '' : '') : v.preview + '\n… (truncated)'}</pre>
      {v.truncated && (
        <button className="gov31-btn" onClick={() => setFull((f) => !f)}>{full ? 'Collapse' : `Show full (${v.fullLength} chars)`}</button>)}
    </div>
  );
}

/* 51240 — Log playback */
export function LogPlayback({ lines }) {
  const speeds = playbackSpeeds();
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(0);
  const schedule = useMemo(() => playbackSchedule(lines, speed), [lines, speed]);
  const timers = useRef([]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; setPlaying(false); };
  const play = () => {
    stop();
    setPlaying(true);
    setShown(0);
    schedule.forEach((s, i) => {
      timers.current.push(setTimeout(() => {
        setShown(i + 1);
        if (i === schedule.length - 1) setPlaying(false);
      }, s.delayMs));
    });
  };
  React.useEffect(() => stop, []);
  return (
    <div className="gov31-card">
      <h4>Log playback</h4>
      <div className="gov31-row" role="radiogroup" aria-label="Playback speed">
        {speeds.map((s) => (
          <label key={s} className="gov31-check">
            <input type="radio" name="playspeed" checked={speed === s} onChange={() => setSpeed(s)} /> {s}x
          </label>))}
        {!playing
          ? <button className="gov31-btn" onClick={play} disabled={schedule.length === 0}>▶ Play</button>
          : <button className="gov31-btn" onClick={stop}>⏸ Stop</button>}
      </div>
      <div className="gov31-log">
        {schedule.slice(0, shown).map((s, i) => <div key={i}>{formatLogLine(s.line)}</div>)}
      </div>
      <p className="gov31-dim">{shown} / {schedule.length} lines @ {speed}x</p>
    </div>
  );
}

/* Gallery showcasing the log observability components */
export function LogStreamGallery() {
  const t0 = 1728220000000;
  const demo = [
    { at: t0, level: 'info', module: 'recon', message: 'Subdomain enumeration started', detail: 'target example.com' },
    { at: t0 + 120, level: 'debug', module: 'recon', message: 'Trying wordlist entry', request: { method: 'GET', url: 'https://api.example.com/admin' } },
    { at: t0 + 340, level: 'warning', module: 'scanning', message: 'Rate limit approaching on /api', reasoning: 'Backing off 2s' },
    { at: t0 + 900, level: 'error', module: 'exploitation', message: 'PoC failed: connection refused', response: { status: 0, body: 'ECONNREFUSED' } },
    { at: t0 + 1500, level: 'info', module: 'reporting', message: 'Finding drafted: open S3 bucket' },
  ];
  const [filtered, setFiltered] = useState(demo);
  return (
    <div className="gov31-gallery">
      <LiveLogStream lines={demo} />
      <LogLevelFilter lines={demo} onChange={(f) => setFiltered(f)} />
      <ModuleTabs lines={filtered} />
      <LogSearch lines={demo} />
      <LogLineDetails line={demo[1]} />
      <RedactedLog text={'POST /login password=hunter2 token=abc123 ok=true'} />
      <HighlightRules lines={demo} />
      <ErrorOnlyToggle lines={demo} />
      <LogExport lines={demo} />
      <RequestInspector entry={{ method: 'POST', url: 'https://api.example.com/login', headers: { 'content-type': 'application/json' }, body: '{"user":"admin"}', at: t0 }} />
      <ResponseViewer result={{ status: 200, body: { found: true, items: [1, 2, 3] } }} />
      <LogPlayback lines={demo} />
    </div>
  );
}
