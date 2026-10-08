/**
 * MobileRound2.jsx — Infinity AI · Dark-Matter · Wave 50
 * 20 working React components for mobile ideas 51961–51980 (mobile round 2).
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './mobileRound2Core.js';

/* 51961 — Snapshot viewer payload. */
export function SnapshotViewer() {
  const spec = C.normalizeSnapshot({
    huntId: 'h-101', status: 'running', targets: 3, takenAt: '2026-10-08T12:00:00Z',
    findings: [
      { id: 'f1', title: 'XSS on /search', severity: 'high' },
      { id: 'f2', title: 'Open redirect', severity: 'medium' },
    ],
  });
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51961 · Snapshot viewer</h3>
      <p className="mr2-result">{spec.huntId} · {spec.status} · {spec.summary.findings} findings</p>
      <ul className="mr2-list">
        {spec.topFindings.map((f) => <li key={f.id} className="mr2-item">{f.title} ({f.severity})</li>)}
      </ul>
    </div>
  );
}

/* 51962 — Swipe-triage reducer. */
export function SwipeTriage() {
  const [items, setItems] = useState([
    { id: 'f1', title: 'XSS on /search' },
    { id: 'f2', title: 'IDOR on /api/user' },
  ]);
  const [log, setLog] = useState([]);
  const swipe = (findingId, gesture) => {
    const r = C.reduceSwipeTriage(items, { findingId, swipe: gesture });
    setItems(r.state);
    if (r.applied) setLog([...log, `${findingId} → ${r.decision.decision}`]);
  };
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51962 · Swipe triage</h3>
      <ul className="mr2-list">
        {items.map((f) => (
          <li key={f.id} className="mr2-item">
            {f.title}{f.triage ? ` — ${f.triage}d` : ''}
            <button className="mr2-btn" onClick={() => swipe(f.id, 'swipe-right')}>✓</button>
            <button className="mr2-btn" onClick={() => swipe(f.id, 'swipe-left')}>✕</button>
            <button className="mr2-btn" onClick={() => swipe(f.id, 'swipe-up')}>↑</button>
          </li>
        ))}
      </ul>
      {log.map((l, i) => <p key={i} className="mr2-note">{l}</p>)}
    </div>
  );
}

/* 51963 — Offline snapshot cache. */
export function OfflineSnapshotCache() {
  const [cache, setCache] = useState([]);
  const [view, setView] = useState(null);
  const save = () => setCache(C.storeSnapshotCache(cache, C.normalizeSnapshot({ huntId: 'h-101', status: 'running', findings: [] }), 30));
  const load = () => setView(C.retrieveSnapshotCache(cache));
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51963 · Offline snapshot cache</h3>
      <button className="mr2-btn" onClick={save}>Store snapshot</button>
      <button className="mr2-btn" onClick={load}>Retrieve</button>
      {view && <p className="mr2-result">{view.hit ? `hit · stale: ${view.stale} · ${view.ageMinutes}m old` : 'empty cache'}</p>}
    </div>
  );
}

/* 51964 — Biometric lock gate. */
export function BiometricLockGate() {
  const [enrolled, setEnrolled] = useState(true);
  const [unlock, setUnlock] = useState(false);
  const g = C.evaluateBiometricGate({ requireBiometric: true, biometricEnrolled: enrolled, biometricUnlock: unlock, allowPinFallback: true });
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51964 · Biometric lock gate</h3>
      <label className="mr2-check"><input type="checkbox" checked={enrolled} onChange={(e) => setEnrolled(e.target.checked)} /> enrolled</label>
      <label className="mr2-check"><input type="checkbox" checked={unlock} onChange={(e) => setUnlock(e.target.checked)} /> unlock</label>
      <p className="mr2-result">{g.locked ? 'LOCKED' : 'UNLOCKED'} — {g.method} ({g.reason})</p>
    </div>
  );
}

/* 51965 — Quick-action shortcuts. */
export function QuickActionShortcuts() {
  const qa = C.buildQuickActions({ status: 'running', canEscalate: true });
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51965 · Quick-action shortcuts</h3>
      <ul className="mr2-list">
        {qa.actions.map((a) => <li key={a.id} className="mr2-item">{a.icon} — {a.label}</li>)}
      </ul>
    </div>
  );
}

/* 51966 — Dark-mode theme tokens. */
export function DarkModeTokens() {
  const t = C.buildNightThemeTokens();
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51966 · Night monitoring tokens</h3>
      <p className="mr2-result">bg {t.background} · surface {t.surface} · contrast ≥ {t.minContrastRatio}:1</p>
      <ul className="mr2-list">
        {Object.entries(t.severity).map(([k, v]) => <li key={k} className="mr2-item"><span style={{ color: v }}>■</span> {k}</li>)}
      </ul>
    </div>
  );
}

/* 51967 — Data-saver mode. */
export function DataSaverMode() {
  const [saver, setSaver] = useState(true);
  const full = { title: 'Hunt update', target: 'api.example', token: 'secret-abc', evidence: '<long html>' };
  const out = saver ? C.applyDataSaver(full, { redactSecrets: true, stripEvidence: true }) : { payload: full, fieldCount: 4, dataSaver: false };
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51967 · Data-saver mode</h3>
      <label className="mr2-check"><input type="checkbox" checked={saver} onChange={(e) => setSaver(e.target.checked)} /> data saver</label>
      <p className="mr2-result">{out.fieldCount} fields · token: {out.payload.token}</p>
    </div>
  );
}

/* 51968 — Battery-saver polling schedule. */
export function BatterySaverSchedule() {
  const [battery, setBattery] = useState(20);
  const s = C.scheduleBatterySaver(battery, false);
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51968 · Battery-saver polling</h3>
      <label className="mr2-check">Battery %
        <input className="mr2-input" type="number" value={battery} min={0} max={100} onChange={(e) => setBattery(Number(e.target.value))} />
      </label>
      <p className="mr2-result">{s.mode} — poll every {s.intervalSeconds}s</p>
    </div>
  );
}

/* 51969 — Widget-stack builder. */
export function WidgetStackBuilder() {
  const [types, setTypes] = useState(['status', 'findings']);
  const stack = C.buildWidgetStack(types.map((t, i) => ({ id: `w${i}`, type: t, huntId: 'h-101' })));
  const toggle = (t) => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t]);
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51969 · Widget stack</h3>
      {C.buildWidgetStack([]).validTypes.map((t) => (
        <label key={t} className="mr2-check"><input type="checkbox" checked={types.includes(t)} onChange={() => toggle(t)} /> {t}</label>
      ))}
      <p className="mr2-result">{stack.count} widgets: {stack.widgets.map((w) => w.type).join(', ')}</p>
    </div>
  );
}

/* 51970 — Apple Watch alert payload. */
export function AppleWatchAlert() {
  const a = C.buildAppleWatchAlert({ title: 'SQL injection confirmed', severity: 'critical' });
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51970 · Apple Watch alert</h3>
      <p className="mr2-result">{a.shortText}</p>
      {a.actions.map((x) => <button key={x.id} className="mr2-btn">{x.label}</button>)}
    </div>
  );
}

/* 51971 — Wear OS alert payload. */
export function WearOsAlert() {
  const a = C.buildWearOsAlert({ title: 'Open redirect', severity: 'medium' });
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51971 · Wear OS alert</h3>
      <p className="mr2-result">{a.shortText}</p>
      {a.actions.map((x) => <button key={x.id} className="mr2-btn">{x.label}</button>)}
    </div>
  );
}

/* 51972 — Tablet two-pane layout spec. */
export function TabletTwoPane() {
  const [width, setWidth] = useState(1280);
  const l = C.buildTabletLayout({ width, selectedId: 'f1' });
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51972 · Tablet two-pane</h3>
      <label className="mr2-check">Width px
        <input className="mr2-input" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      </label>
      <p className="mr2-result">{l.breakpoint} · two-pane: {String(l.twoPane)} · master {Math.round(l.master.widthRatio * 100)}% / detail {Math.round(l.detail.widthRatio * 100)}%</p>
    </div>
  );
}

/* 51973 — Landscape layout spec. */
export function LandscapeLayout() {
  const [dims, setDims] = useState({ width: 844, height: 390 });
  const l = C.buildLandscapeLayout(dims);
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51973 · Landscape layout</h3>
      <label className="mr2-check">W
        <input className="mr2-input" type="number" value={dims.width} onChange={(e) => setDims({ ...dims, width: Number(e.target.value) })} />
      </label>
      <label className="mr2-check">H
        <input className="mr2-input" type="number" value={dims.height} onChange={(e) => setDims({ ...dims, height: Number(e.target.value) })} />
      </label>
      <p className="mr2-result">{l.orientation} · {l.columns} columns · chart {l.chartHeight}px</p>
    </div>
  );
}

/* 51974 — Share-sheet payload builder. */
export function ShareSheetBuilder() {
  const p = C.buildSharePayload({ title: 'Critical finding', summary: 'SQLi on /login', url: 'https://app.example/f/9' }, 'system-sheet');
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51974 · Share sheet</h3>
      <p className="mr2-result">{p.text}</p>
      <p className="mr2-note">{p.url} → {p.target}</p>
    </div>
  );
}

/* 51975 — Screenshot markup spec. */
export function ScreenshotMarkup() {
  const spec = C.buildMarkupSpec([
    { tool: 'arrow', x: 120, y: 80, label: 'injection point' },
    { tool: 'blur', x: 300, y: 200, label: 'PII' },
  ]);
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51975 · Screenshot markup</h3>
      <ul className="mr2-list">
        {spec.annotations.map((a) => <li key={a.id} className="mr2-item">{a.tool} @ ({a.x},{a.y}) — {a.label}</li>)}
      </ul>
      <p className="mr2-note">tools: {spec.tools.join(', ')}</p>
    </div>
  );
}

/* 51976 — Comment-thread builder. */
export function CommentThread() {
  const [thread, setThread] = useState(C.buildCommentThread('f1', [{ author: 'Infinity AI', body: 'Confirmed on staging.' }]));
  const [draft, setDraft] = useState('');
  const add = () => { if (draft.trim()) { setThread(C.appendComment(thread, { author: 'You', body: draft.trim() })); setDraft(''); } };
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51976 · Comment thread</h3>
      {thread.comments.map((c) => <p key={c.id} className="mr2-item"><strong>{c.author}:</strong> {c.body}</p>)}
      <input className="mr2-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" />
      <button className="mr2-btn" onClick={add}>Post</button>
    </div>
  );
}

/* 51977 — Mobile steering command builder. */
export function SteeringCommandBuilder() {
  const [cmd, setCmd] = useState('pause');
  const c = C.buildSteeringCommand(cmd, 'h-101', 'holding while I check');
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51977 · Steering commands</h3>
      <select className="mr2-input" value={cmd} onChange={(e) => setCmd(e.target.value)}>
        <option>pause</option><option>resume</option><option>escalate-scope</option>
        <option>deescalate</option><option>snapshot</option><option>request-approval</option>
      </select>
      <p className="mr2-result">{c.valid ? `${c.command} — risk ${c.risk}${c.requiresApproval ? ' · needs approval' : ''}` : 'invalid command'}</p>
    </div>
  );
}

/* 51978 — Strategy picker options. */
export function StrategyPicker() {
  const [current, setCurrent] = useState('balanced');
  const opts = C.listStrategyOptions(current);
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51978 · Strategy picker</h3>
      {opts.map((o) => (
        <button key={o.id} className="mr2-btn" onClick={() => setCurrent(C.selectStrategy(current, o.id).selected)}>
          {o.label}{o.selected ? ' ✓' : ''} — {o.description}
        </button>
      ))}
    </div>
  );
}

/* 51979 — Mobile test-request payload. */
export function MobileTestRequest() {
  const [check, setCheck] = useState('xss-reflected');
  const r = C.buildTestRequest('h-101', check, 'https://shop.example/search?q=1');
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51979 · Test request</h3>
      <input className="mr2-input" value={check} onChange={(e) => setCheck(e.target.value)} placeholder="check id" />
      <p className="mr2-result">{r.valid ? `queued: ${r.check} on ${r.target}` : `invalid — ${r.errors.join('; ')}`}</p>
    </div>
  );
}

/* 51980 — Confidence view payload. */
export function ConfidenceView() {
  const v = C.buildConfidenceView([
    { id: 'f1', title: 'SQLi', confidence: 92 },
    { id: 'f2', title: 'Open redirect', confidence: 64 },
    { id: 'f3', title: 'Info disclosure', confidence: 31 },
  ]);
  return (
    <div className="mr2-card">
      <h3 className="mr2-title">51980 · Confidence view</h3>
      <p className="mr2-result">average {v.average}% across {v.count} findings</p>
      <ul className="mr2-list">
        {v.findings.map((f) => <li key={f.id} className="mr2-item">{f.title} — {f.confidence}% ({f.band})</li>)}
      </ul>
    </div>
  );
}

export function MobileRound2Gallery() {
  return (
    <div className="mr2-gallery">
      <SnapshotViewer /><SwipeTriage /><OfflineSnapshotCache /><BiometricLockGate />
      <QuickActionShortcuts /><DarkModeTokens /><DataSaverMode /><BatterySaverSchedule />
      <WidgetStackBuilder /><AppleWatchAlert /><WearOsAlert /><TabletTwoPane />
      <LandscapeLayout /><ShareSheetBuilder /><ScreenshotMarkup /><CommentThread />
      <SteeringCommandBuilder /><StrategyPicker /><MobileTestRequest /><ConfidenceView />
    </div>
  );
}
