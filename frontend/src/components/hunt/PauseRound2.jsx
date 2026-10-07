/**
 * PauseRound2.jsx — wave 34, part 1 (ideas 51321–51340): pause/abort
 * control round 2.
 * Real working components driving local state — no mocks, no demo-only
 * controls. All state math comes from pauseRound2Core.js.
 */
import React, { useState } from 'react';
import {
  VOICE_PAUSE_PHRASES, parseVoicePauseCommand, applyVoiceCommand,
  mobilePauseSpec,
  pauseWithInheritance, resumeWithInheritance, inheritedPausees,
  RESUME_ORDERS, orderResume,
  queueApprovalWhilePaused, drainApprovalQueue,
  abortSummary,
  pauseToSteer,
  reducedScope,
  watchdogCheck,
  ABORT_CASCADE_MODES, abortCascade,
  exportPauseState,
  attachResumeNote,
  pauseButtonPlacement,
  ABORT_REASON_CODES, validateAbortReason,
  snapshotOnPause,
  rampCurve,
  pauseDiscussion, addPauseComment, canResume,
  isInPauseWindow, addPauseWindow, describePauseWindow,
  diffPauseState,
  indexAbortedHunt, searchAbortedHunts,
} from './pauseRound2Core.js';

const NOW = 1728220000000;

function Card({ title, idea, children }) {
  return (
    <section className="pc34-card" aria-label={title}>
      <header className="pc34-card-head">
        <h3 className="pc34-card-title">{title}</h3>
        <span className="pc34-idea">#{idea}</span>
      </header>
      <div className="pc34-card-body">{children}</div>
    </section>
  );
}

/** 51321 — Hands-free pause toggle: voice commands pause/resume the hunt. */
export function VoicePauseToggle() {
  const [state, setState] = useState({ huntId: 'hunt-42', paused: false, voiceLog: [] });
  const [transcript, setTranscript] = useState('');
  const [last, setLast] = useState(null);
  const speak = () => {
    const parsed = parseVoicePauseCommand(transcript);
    const { state: next, accepted, note } = applyVoiceCommand(state, parsed, NOW);
    setState(next);
    setLast({ parsed, accepted, note });
  };
  return (
    <Card title="Hands-free pause toggle" idea="51321">
      <div className="pc34-row">
        <input className="pc34-input" placeholder='Say: "pause the hunt"… (typed transcript)' value={transcript} onChange={(e) => setTranscript(e.target.value)} aria-label="Voice transcript" />
        <button type="button" className="pc34-btn" onClick={speak}>Send command</button>
      </div>
      <p className="pc34-muted">Recognized phrases: {VOICE_PAUSE_PHRASES.map((p) => p.phrase).join(' · ')}</p>
      <p>Status: <strong>{state.paused ? 'PAUSED (voice)' : 'running'}</strong></p>
      {last && <p className="pc34-note">"{last.parsed.phrase || '—'}" → {last.accepted ? 'accepted' : 'not applied'} — {last.note} (confidence {last.parsed.confidence || 0})</p>}
      {state.abortArmed && <p className="pc34-warn">Abort armed by voice — confirm in the UI to proceed (voice never aborts directly).</p>}
    </Card>
  );
}

/** 51322 — Mobile pause control: big thumb-friendly pause button. */
export function MobilePauseControl() {
  const [width, setWidth] = useState(390);
  const [paused, setPaused] = useState(false);
  const spec = mobilePauseSpec(width, paused);
  return (
    <Card title="Mobile pause control" idea="51322">
      <div className="pc34-row">
        <label className="pc34-muted">Viewport width
          <input className="pc34-input" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Viewport width" />
        </label>
        <button type="button" className="pc34-btn" onClick={() => setPaused((p) => !p)}>{spec.label}</button>
      </div>
      <ul className="pc34-list">
        <li className="pc34-list-item">Touch target: <strong>{spec.touchTargetPx}px</strong> (min 56px)</li>
        <li className="pc34-list-item">Placement: {spec.placement} · safe-area inset: {spec.safeAreaInset ? 'yes' : 'no'}</li>
        <li className="pc34-list-item">State: <strong>{paused ? 'PAUSED' : 'running'}</strong> — size never changes with state</li>
      </ul>
    </Card>
  );
}

/** 51323 — Pause inheritance: pausing a parent pauses linked sub-hunts. */
export function PauseInheritance() {
  const [tree, setTree] = useState(null);
  const subs = ['sub-1', 'sub-2', 'sub-3'];
  return (
    <Card title="Pause inheritance" idea="51323">
      <div className="pc34-row">
        <button type="button" className="pc34-btn" onClick={() => setTree(pauseWithInheritance('parent-1', subs, NOW))}>Pause parent + subs</button>
        <button type="button" className="pc34-btn pc34-btn-ghost" onClick={() => setTree((t) => (t ? resumeWithInheritance(t, NOW) : t))}>Resume inherited</button>
      </div>
      {!tree && <p className="pc34-muted">Nothing paused yet.</p>}
      {tree && (
        <ul className="pc34-list">
          {tree.map((n) => (
            <li key={n.huntId} className="pc34-list-item">
              <span className={n.paused ? 'pc34-warn' : 'pc34-ok'}>{n.paused ? '⏸' : '▶'}</span>
              <span>{n.huntId}{n.inheritedFrom ? ` (inherited from ${n.inheritedFrom})` : ' — parent'}</span>
            </li>
          ))}
        </ul>
      )}
      {tree && <p className="pc34-note">Inherited pausees: {inheritedPausees(tree, 'parent-1').join(', ') || 'none'}</p>}
    </Card>
  );
}

/** 51324 — Resume ordering: choose the order paused hunts restart. */
export function ResumeOrdering() {
  const [strategy, setStrategy] = useState('priority');
  const queue = [
    { huntId: 'hunt-a', priority: 3, pausedAt: NOW - 50000, findings: 12, remainingPhases: 4 },
    { huntId: 'hunt-b', priority: 5, pausedAt: NOW - 90000, findings: 3, remainingPhases: 2 },
    { huntId: 'hunt-c', priority: 3, pausedAt: NOW - 20000, findings: 30, remainingPhases: 6 },
    { huntId: 'hunt-d', priority: 1, pausedAt: NOW - 10000, findings: 1, remainingPhases: 1 },
  ];
  const ordered = orderResume(queue, strategy);
  return (
    <Card title="Resume ordering" idea="51324">
      <div className="pc34-row">
        <label className="pc34-muted">Order
          <select className="pc34-select" value={strategy} onChange={(e) => setStrategy(e.target.value)} aria-label="Resume order">
            {RESUME_ORDERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
      <ol className="pc34-list">
        {ordered.map((h, i) => (
          <li key={h.huntId} className="pc34-list-item"><strong>#{i + 1}</strong> {h.huntId} — priority {h.priority}, {h.findings} findings, {h.remainingPhases} phases left</li>
        ))}
      </ol>
    </Card>
  );
}

/** 51325 — Pause during approvals: decisions queue for execution on resume. */
export function PauseApprovals() {
  const [queue, setQueue] = useState([]);
  const [executed, setExecuted] = useState([]);
  const add = () => setQueue((q) => queueApprovalWhilePaused(q, { id: `appr-${q.length + 1}`, action: 'run exploit PoC', decided: 'approved', at: NOW }));
  const drain = () => {
    const { executed: ex, remaining } = drainApprovalQueue(queue, null);
    setExecuted((e) => [...e, ...ex]);
    setQueue(remaining);
  };
  return (
    <Card title="Pause during approvals" idea="51325">
      <p className="pc34-muted">The hunt is paused — approval decisions queue up instead of firing.</p>
      <div className="pc34-row">
        <button type="button" className="pc34-btn" onClick={add}>Decide approval (queued)</button>
        <button type="button" className="pc34-btn pc34-btn-ghost" onClick={drain}>Resume → execute queue</button>
      </div>
      <p>Queued: <strong>{queue.length}</strong> · Executed on resume: <strong>{executed.length}</strong></p>
      {executed.length > 0 && <p className="pc34-note">Executed: {executed.map((e) => e.action).join(', ')}</p>}
    </Card>
  );
}

/** 51326 — Abort confirmation summary: final screen before the hunt is gone. */
export function AbortConfirmationSummary() {
  const [confirmed, setConfirmed] = useState(false);
  const hunt = {
    huntId: 'hunt-42', target: 'https://shop.example.com', startedAt: NOW - 5400000, now: NOW,
    phases: [{ id: 'recon', status: 'done' }, { id: 'fuzz', status: 'done' }, { id: 'auth', status: 'running' }, { id: 'poc', status: 'pending' }],
    findings: [{ title: 'Reflected XSS', severity: 'high' }, { title: 'Verbose error', severity: 'low' }],
    modules: [{ id: 'fuzzer', active: true }, { id: 'crawler', active: false }],
    artifactCount: 18,
  };
  const s = abortSummary(hunt);
  return (
    <Card title="Abort confirmation summary" idea="51326">
      <ul className="pc34-list">
        <li className="pc34-list-item">Hunt <strong>{s.huntId}</strong> on {s.target}</li>
        <li className="pc34-list-item">{s.findings} findings ({s.criticalFindings} critical) · coverage {s.coverage}% ({s.phasesDone}/{s.phasesTotal} phases)</li>
        <li className="pc34-list-item">{s.elapsedMin} min elapsed · {s.modulesActive} modules active · {s.artifacts} artifacts</li>
        <li className="pc34-list-item pc34-warn">This is irreversible — partial findings are archived, the run is gone.</li>
      </ul>
      <button type="button" className="pc34-btn pc34-btn-danger" onClick={() => setConfirmed(true)}>I understand — abort the hunt</button>
      {confirmed && <p className="pc34-note">Confirmed (this panel only — real abort goes through the two-step flow).</p>}
    </Card>
  );
}

/** 51327 — Pause-to-steer: one gesture pauses and opens steering together. */
export function PauseToSteer() {
  const [hunt, setHunt] = useState({ huntId: 'hunt-42', paused: false, steeringOpen: false });
  return (
    <Card title="Pause-to-steer" idea="51327">
      <button type="button" className="pc34-btn" onClick={() => setHunt((h) => pauseToSteer(h, NOW))}>Pause + open steering</button>
      <p>Paused: <strong>{hunt.paused ? 'yes' : 'no'}</strong> · Steering panel: <strong>{hunt.steeringOpen ? 'open' : 'closed'}</strong></p>
      {hunt.steeringOpen && <p className="pc34-note">Steering opened at the pause moment — redirect the agent, then resume.</p>}
    </Card>
  );
}

/** 51328 — Resume with reduced scope: drop the lowest-priority phases. */
export function ResumeReducedScope() {
  const [keepTop, setKeepTop] = useState(3);
  const phases = [
    { id: 'auth-deep', priority: 5, status: 'pending' },
    { id: 'business-logic', priority: 4, status: 'pending' },
    { id: 'exploit-chain', priority: 3, status: 'pending' },
    { id: 'report-polish', priority: 2, status: 'pending' },
    { id: 'surface-map', priority: 1, status: 'pending' },
  ];
  const { kept, dropped } = reducedScope(phases, keepTop);
  return (
    <Card title="Resume with reduced scope" idea="51328">
      <div className="pc34-row">
        <label className="pc34-muted">Keep top N phases
          <input className="pc34-input" type="number" min="1" max="5" value={keepTop} onChange={(e) => setKeepTop(Number(e.target.value))} aria-label="Keep top N phases" />
        </label>
      </div>
      <p>Kept: <strong>{kept.map((p) => p.id).join(', ')}</strong></p>
      <p className="pc34-muted">Dropped: {dropped.map((p) => p.id).join(', ') || 'none'}</p>
    </Card>
  );
}

/** 51329 — Pause watchdog: alerts when a hunt sits paused too long. */
export function PauseWatchdog() {
  const [threshold, setThreshold] = useState(30);
  const pausedAt = NOW - 47 * 60000;
  const w = watchdogCheck(pausedAt, NOW, threshold);
  return (
    <Card title="Pause watchdog" idea="51329">
      <div className="pc34-row">
        <label className="pc34-muted">Alert after (min)
          <input className="pc34-input" type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Watchdog threshold minutes" />
        </label>
      </div>
      <p>Paused for <strong>{w.elapsedMin} min</strong> — {w.overdue
        ? <span className="pc34-warn">⚠ overdue by {w.overByMin} min — resume, extend, or abort.</span>
        : <span className="pc34-ok">within the expected window.</span>}</p>
    </Card>
  );
}

/** 51330 — Abort cascade control: this hunt only, or linked hunts too. */
export function AbortCascadeControl() {
  const [mode, setMode] = useState('this-only');
  const [result, setResult] = useState(null);
  const linked = ['hunt-b', 'hunt-c'];
  return (
    <Card title="Abort cascade control" idea="51330">
      <div className="pc34-row">
        <select className="pc34-select" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Abort cascade mode">
          {ABORT_CASCADE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button type="button" className="pc34-btn pc34-btn-danger" onClick={() => setResult(abortCascade('hunt-a', linked, mode))}>Abort</button>
      </div>
      {result && <p className="pc34-note">Mode <strong>{result.mode}</strong>: aborted {result.aborted.join(', ')} ({result.linkedAborted} linked).</p>}
    </Card>
  );
}

/** 51331 — Pause state export: frozen state as a downloadable snapshot. */
export function PauseStateExport() {
  const [json, setJson] = useState('');
  const hunt = { huntId: 'hunt-42', target: 'https://shop.example.com', paused: true, pausedAt: NOW - 60000, pauseReason: 'owner review', phases: [{ id: 'recon', status: 'done' }], findings: [{ title: 'XSS' }], checkpoints: ['cp-1'] };
  return (
    <Card title="Pause state export" idea="51331">
      <button type="button" className="pc34-btn" onClick={() => setJson(JSON.stringify(exportPauseState(hunt, NOW), null, 2))}>Export frozen state</button>
      {json && <pre className="pc34-pre">{json}</pre>}
    </Card>
  );
}

/** 51332 — Resume notes: why is the hunt resuming now? */
export function ResumeNotes() {
  const [hunt, setHunt] = useState({ huntId: 'hunt-42', resumeNotes: [] });
  const [text, setText] = useState('');
  return (
    <Card title="Resume notes" idea="51332">
      <div className="pc34-row">
        <input className="pc34-input" placeholder="Why resume now?…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Resume note" />
        <button type="button" className="pc34-btn" onClick={() => { if (text.trim()) { setHunt((h) => attachResumeNote(h, text, 'you', NOW)); setText(''); } }}>Attach note</button>
      </div>
      <ul className="pc34-list">
        {hunt.resumeNotes.map((n, i) => <li key={i} className="pc34-list-item">"{n.note}" — {n.author}</li>)}
        {hunt.resumeNotes.length === 0 && <li className="pc34-muted">No resume notes yet.</li>}
      </ul>
    </Card>
  );
}

/** 51333 — Pause button placement: visible + reachable on every hunt screen. */
export function PauseButtonPlacement() {
  const [screen, setScreen] = useState('hunt-overview');
  const [width, setWidth] = useState(390);
  const spec = pauseButtonPlacement(screen, width);
  return (
    <Card title="Pause button placement" idea="51333">
      <div className="pc34-row">
        <select className="pc34-select" value={screen} onChange={(e) => setScreen(e.target.value)} aria-label="Hunt screen">
          {['hunt-overview', 'findings', 'timeline', 'steering', 'reports'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="pc34-input" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Viewport width" />
      </div>
      <p>On <strong>{spec.screen}</strong> at {width}px: <strong>{spec.position}</strong>, sticky, always visible, aria "{spec.ariaLabel}".</p>
    </Card>
  );
}

/** 51334 — Abort requires reason: mandatory reason feeding retrospectives. */
export function AbortRequiresReason() {
  const [code, setCode] = useState('scope-changed');
  const [detail, setDetail] = useState('');
  const [result, setResult] = useState(null);
  return (
    <Card title="Abort requires reason" idea="51334">
      <div className="pc34-row">
        <select className="pc34-select" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Abort reason code">
          {ABORT_REASON_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input className="pc34-input" placeholder="Detail (min 8 chars)…" value={detail} onChange={(e) => setDetail(e.target.value)} aria-label="Abort reason detail" />
      <button type="button" className="pc34-btn pc34-btn-danger" onClick={() => setResult(validateAbortReason({ code, detail }))}>Abort with reason</button>
      {result && (result.ok
        ? <p className="pc34-ok">Reason accepted — abort may proceed; feeds the retrospective.</p>
        : <ul className="pc34-list">{result.errors.map((e, i) => <li key={i} className="pc34-warn">{e}</li>)}</ul>)}
    </Card>
  );
}

/** 51335 — Pause-and-snapshot: report snapshot captured at pause time. */
export function PauseAndSnapshot() {
  const [snap, setSnap] = useState(null);
  const hunt = {
    huntId: 'hunt-42', target: 'https://shop.example.com',
    findings: [
      { title: 'Reflected XSS on /search', severity: 'high' },
      { title: 'Missing rate limit on /login', severity: 'medium' },
      { title: 'Verbose 500 page', severity: 'low' },
    ],
    phases: [{ id: 'recon', status: 'done' }, { id: 'auth', status: 'running' }],
  };
  return (
    <Card title="Pause-and-snapshot" idea="51335">
      <button type="button" className="pc34-btn" onClick={() => setSnap(snapshotOnPause(hunt, NOW))}>Pause + capture snapshot</button>
      {snap && (
        <ul className="pc34-list">
          <li className="pc34-list-item">{snap.findingsTotal} findings — critical {snap.bySeverity.critical}, high {snap.bySeverity.high}, medium {snap.bySeverity.medium}, low {snap.bySeverity.low}</li>
          {snap.topFindings.map((f, i) => <li key={i} className="pc34-list-item">[{f.severity}] {f.title}</li>)}
        </ul>
      )}
    </Card>
  );
}

/** 51336 — Resume speed ramp: reduced rate ramping back up. */
export function ResumeSpeedRamp() {
  const [base, setBase] = useState(60);
  const [rampMin, setRampMin] = useState(10);
  const curve = rampCurve(base, rampMin, 25);
  return (
    <Card title="Resume speed ramp" idea="51336">
      <div className="pc34-row">
        <label className="pc34-muted">Base RPM
          <input className="pc34-input" type="number" value={base} onChange={(e) => setBase(Number(e.target.value))} aria-label="Base requests per minute" />
        </label>
        <label className="pc34-muted">Ramp (min)
          <input className="pc34-input" type="number" value={rampMin} onChange={(e) => setRampMin(Number(e.target.value))} aria-label="Ramp minutes" />
        </label>
      </div>
      <p className="pc34-muted">Starts at 25% of base, linear ramp to 100%:</p>
      <p className="pc34-note">{curve.map((c) => `${c.minute}m:${c.rpm}`).join(' → ')}</p>
    </Card>
  );
}

/** 51337 — Pause collaboration: teammates see who paused and discuss. */
export function PauseCollaboration() {
  const [thread, setThread] = useState(() => pauseDiscussion({ pausedBy: 'priya', pausedAt: NOW - 300000, reason: 'Checking scope with client', watchers: ['arjun'] }));
  const [comment, setComment] = useState('');
  const [user, setUser] = useState('arjun');
  return (
    <Card title="Pause collaboration" idea="51337">
      <p>Paused by <strong>{thread.pausedBy}</strong> — "{thread.reason}". Participants: {thread.participants.join(', ')}</p>
      <ul className="pc34-list">
        {thread.comments.map((c, i) => <li key={i} className="pc34-list-item"><strong>{c.author}:</strong> {c.text}</li>)}
        {thread.comments.length === 0 && <li className="pc34-muted">No comments yet.</li>}
      </ul>
      <div className="pc34-row">
        <input className="pc34-input" placeholder="Discuss…" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Discussion comment" />
        <select className="pc34-select" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Acting user">
          {['arjun', 'priya', 'outsider'].map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <button type="button" className="pc34-btn" onClick={() => { if (comment.trim()) { setThread((t) => addPauseComment(t, user, comment, NOW)); setComment(''); } }}>Comment</button>
      </div>
      <p>{canResume(thread, user) ? <span className="pc34-ok">{user} may resume.</span> : <span className="pc34-warn">{user} is not a participant — resume blocked while discussion is open.</span>}</p>
    </Card>
  );
}

/** 51338 — Hunt pause calendar: recurring blackout windows. */
export function HuntPauseCalendar() {
  const [calendar, setCalendar] = useState([
    { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18, label: 'business hours' },
  ]);
  const [checkDay, setCheckDay] = useState(3);
  const [checkHour, setCheckHour] = useState(14);
  const res = isInPauseWindow(calendar, checkDay, checkHour);
  return (
    <Card title="Hunt pause calendar" idea="51338">
      <ul className="pc34-list">
        {calendar.map((w, i) => <li key={i} className="pc34-list-item">{describePauseWindow(w)}</li>)}
      </ul>
      <div className="pc34-row">
        <button type="button" className="pc34-btn pc34-btn-ghost" onClick={() => setCalendar((c) => addPauseWindow(c, { days: [0, 6], startHour: 0, endHour: 24, label: 'weekends' }))}>Add weekend blackout</button>
      </div>
      <div className="pc34-row">
        <label className="pc34-muted">Day (0=Sun)
          <input className="pc34-input" type="number" min="0" max="6" value={checkDay} onChange={(e) => setCheckDay(Number(e.target.value))} aria-label="Check day" />
        </label>
        <label className="pc34-muted">Hour
          <input className="pc34-input" type="number" min="0" max="23" value={checkHour} onChange={(e) => setCheckHour(Number(e.target.value))} aria-label="Check hour" />
        </label>
      </div>
      <p>{res.inWindow ? <span className="pc34-warn">⏸ In a pause window — the hunt stays frozen.</span> : <span className="pc34-ok">Outside pause windows — hunt may run.</span>}</p>
    </Card>
  );
}

/** 51339 — Pause state diff: what changed in the target during the pause. */
export function PauseStateDiff() {
  const [diff, setDiff] = useState(null);
  const before = { openPorts: [80, 443], serverHeader: 'nginx/1.24', loginForm: 'v1' };
  const after = { openPorts: [80, 443, 8080], serverHeader: 'nginx/1.24', loginForm: 'v2' };
  return (
    <Card title="Pause state diff" idea="51339">
      <button type="button" className="pc34-btn" onClick={() => setDiff(diffPauseState(before, after))}>Compare fingerprints on resume</button>
      {diff && (
        <div>
          <p>{diff.changed ? <span className="pc34-warn">{diff.changeCount} change(s) while paused:</span> : <span className="pc34-ok">No changes during the pause.</span>}</p>
          <ul className="pc34-list">
            {diff.changes.map((c, i) => <li key={i} className="pc34-list-item"><strong>{c.field}:</strong> {JSON.stringify(c.before)} → {JSON.stringify(c.after)}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** 51340 — Abort archive search: aborted hunts stay searchable. */
export function AbortArchiveSearch() {
  const [index] = useState(() => {
    let idx = [];
    idx = indexAbortedHunt(idx, { huntId: 'hunt-11', target: 'https://shop.example.com', abortedAt: NOW - 86400000, abortReason: { code: 'scope-changed' }, findings: [{ title: 'Reflected XSS', severity: 'high' }] });
    idx = indexAbortedHunt(idx, { huntId: 'hunt-12', target: 'https://api.bank.example', abortedAt: NOW - 3600000, abortReason: { code: 'false-positive-storm' }, findings: [{ title: 'Verbose error', severity: 'low' }] });
    return idx;
  });
  const [query, setQuery] = useState('');
  const results = searchAbortedHunts(index, query);
  return (
    <Card title="Abort archive search" idea="51340">
      <input className="pc34-input" placeholder="Search aborted hunts…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search aborted hunts" />
      <ul className="pc34-list">
        {query.trim() === '' && <li className="pc34-muted">{index.length} aborted hunts in the archive.</li>}
        {results.map((h) => (
          <li key={h.huntId} className="pc34-list-item">
            <strong>{h.huntId}</strong> — {h.target} · reason: {h.abortReason} · {h.findings.length} partial finding(s)
            {h.findings.map((f) => <span key={f.title} className="pc34-note"> [{f.severity}] {f.title}</span>)}
          </li>
        ))}
        {query.trim() !== '' && results.length === 0 && <li className="pc34-muted">No aborted hunts match.</li>}
      </ul>
    </Card>
  );
}

/** Gallery showcasing all 20 pause/abort round-2 components. */
export function PauseRound2Gallery() {
  return (
    <div className="pc34-gallery">
      <VoicePauseToggle />
      <MobilePauseControl />
      <PauseInheritance />
      <ResumeOrdering />
      <PauseApprovals />
      <AbortConfirmationSummary />
      <PauseToSteer />
      <ResumeReducedScope />
      <PauseWatchdog />
      <AbortCascadeControl />
      <PauseStateExport />
      <ResumeNotes />
      <PauseButtonPlacement />
      <AbortRequiresReason />
      <PauseAndSnapshot />
      <ResumeSpeedRamp />
      <PauseCollaboration />
      <HuntPauseCalendar />
      <PauseStateDiff />
      <AbortArchiveSearch />
    </div>
  );
}
