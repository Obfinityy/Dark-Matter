/**
 * PauseControl.jsx — wave 33 (ideas 51281–51300): pause/abort/resume
 * control suite + log governance + live artifact gallery, part 1.
 * Real working components driving local state — no mocks, no demo-only
 * controls. All state math comes from pauseControlCore.js.
 */
import React, { useState } from 'react';
import {
  ARTIFACT_TYPES, addArtifact, filterArtifacts, artifactCounts,
  LOG_ROLES, canSeeRawLogs, visibleLogView,
  RETENTION_POLICIES, applyRetentionPolicy,
  buildIncidentPackage,
  createHuntControl, instantPause, beginGracefulPause, gracefulDrainTick,
  completeInFlightUnit, PAUSE_REASONS, tagPauseReason, describePauseReason,
  resume, schedulePause, scheduledPauseDue, applyScheduledPause,
  shouldPauseOnFinding, pauseOnFinding, pauseOnApproval,
  prepareAbort, confirmAbort, abortAndArchive, softAbort,
  setModulePaused, pausedModules,
  pauseAllHunts, resumeAllHunts,
  pauseBanner, resumeChecklist,
  scheduleAutoResume, autoResumeDue, applyAutoResume,
  stealthPause,
} from './pauseControlCore.js';

const NOW = 1728220000000;

function Card({ title, idea, children }) {
  return (
    <section className="pc33-card" aria-label={title}>
      <header className="pc33-card-head">
        <h3 className="pc33-card-title">{title}</h3>
        <span className="pc33-idea">#{idea}</span>
      </header>
      <div className="pc33-card-body">{children}</div>
    </section>
  );
}

/** 51281 — Live artifact gallery: screenshots, responses, files as they arrive. */
export function ArtifactGallery() {
  const [gallery, setGallery] = useState([
    { id: 'art-1', type: 'screenshot', title: 'Login page render', capturedAt: NOW - 90000, meta: {} },
    { id: 'art-2', type: 'response', title: 'GET /api/v1/hunts — 200', capturedAt: NOW - 60000, meta: {} },
  ]);
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const visible = filterArtifacts(gallery, { type, query });
  const counts = artifactCounts(gallery);
  const capture = (t) => setGallery((g) => addArtifact(g, {
    type: t, title: `${t} captured just now`, capturedAt: NOW, meta: {},
  }));
  return (
    <Card title="Live artifact gallery" idea="51281">
      <div className="pc33-row">
        <select className="pc33-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="all">All ({counts.all})</option>
          {ARTIFACT_TYPES.map((t) => <option key={t} value={t}>{t} ({counts[t]})</option>)}
        </select>
        <input className="pc33-input" placeholder="Search artifacts…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search artifacts" />
      </div>
      <ul className="pc33-list">
        {visible.map((a) => (
          <li key={a.id} className="pc33-list-item">
            <span className={`pc33-tag pc33-tag-${a.type}`}>{a.type}</span>
            <span>{a.title}</span>
          </li>
        ))}
        {visible.length === 0 && <li className="pc33-muted">No artifacts match.</li>}
      </ul>
      <div className="pc33-row">
        {ARTIFACT_TYPES.map((t) => (
          <button key={t} type="button" className="pc33-btn" onClick={() => capture(t)}>Capture {t}</button>
        ))}
      </div>
    </Card>
  );
}

/** 51282 — Log access roles: who sees raw logs vs summaries. */
export function LogAccessRoles() {
  const [role, setRole] = useState('teammate');
  const lines = [
    { id: 'l1', text: 'POST /api/v1/login 200 — session=abc123' },
    { id: 'l2', text: 'GET /api/v1/hunts 200 — 14 rows' },
  ];
  const summaries = [{ id: 's1', text: '2 requests, 0 errors in the last minute' }];
  const view = visibleLogView(role, lines, summaries);
  return (
    <Card title="Log access roles" idea="51282">
      <div className="pc33-row">
        {LOG_ROLES.map(([r, label]) => (
          <button key={r} type="button" className={`pc33-btn ${role === r ? 'pc33-btn-active' : ''}`}
            onClick={() => setRole(r)} aria-pressed={role === r}>{label}</button>
        ))}
      </div>
      <p className="pc33-muted">Raw log access: {canSeeRawLogs(role) ? 'allowed' : 'denied'} — showing {view.mode} view.</p>
      <ul className="pc33-list">
        {view.lines.map((l) => <li key={l.id} className="pc33-list-item"><code>{l.text}</code></li>)}
      </ul>
    </Card>
  );
}

/** 51283 — Log retention policies: auto-archive or purge on schedule. */
export function LogRetentionPolicies() {
  const DAY = 86_400_000;
  const [policy, setPolicy] = useState('keep-7d');
  const [purgedPii] = useState(true);
  const lines = [
    { id: 'l1', ts: NOW - 2 * DAY, text: 'recent line', pii: false },
    { id: 'l2', ts: NOW - 40 * DAY, text: 'old line', pii: false },
    { id: 'l3', ts: NOW - 2 * DAY, text: 'line with token=secret', pii: true },
  ];
  const result = applyRetentionPolicy(lines, purgedPii && policy === 'purge-pii' ? 'purge-pii' : policy, NOW);
  return (
    <Card title="Log retention policies" idea="51283">
      <div className="pc33-row">
        <select className="pc33-select" value={policy} onChange={(e) => setPolicy(e.target.value)} aria-label="Retention policy">
          {RETENTION_POLICIES.map(([p, label]) => <option key={p} value={p}>{label}</option>)}
        </select>
        <label className="pc33-check"><input type="checkbox" checked={purgedPii} readOnly /> demo uses pii-flagged lines</label>
      </div>
      <p className="pc33-muted">Live: {result.live.length} · Archived: {result.archived.length} · Purged: {result.purged.length}</p>
    </Card>
  );
}

/** 51284 — One-click incident package: logs + findings + timeline bundle. */
export function IncidentPackage() {
  const [pack, setPack] = useState(null);
  const build = () => setPack(buildIncidentPackage({
    huntId: 'hunt-42',
    logs: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }],
    findings: [{ id: 'f1', severity: 'high' }, { id: 'f2', severity: 'medium' }],
    timeline: [{ id: 't1' }, { id: 't2' }],
    builtAt: NOW,
  }));
  return (
    <Card title="One-click incident package" idea="51284">
      {!pack && <button type="button" className="pc33-btn pc33-btn-primary" onClick={build}>Build incident package</button>}
      {pack && (
        <div>
          <p><strong>{pack.huntId}</strong> — {pack.manifest.findings} findings, {pack.manifest.timelineEvents} timeline events, {pack.manifest.logs} log lines.</p>
          <ul className="pc33-list">
            {pack.sections.map((s) => <li key={s.id} className="pc33-list-item">{s.title}{s.count != null ? ` (${s.count})` : ''}</li>)}
          </ul>
          <p className="pc33-muted">Shareable evidence pack ready.</p>
        </div>
      )}
    </Card>
  );
}

/** 51285 — Instant pause button: freeze everything within a second. */
export function InstantPauseButton() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42', ['recon', 'fuzzing']));
  const paused = ctrl.status === 'paused';
  return (
    <Card title="Instant pause button" idea="51285">
      <p className="pc33-muted">Status: <strong className={`pc33-status pc33-status-${ctrl.status}`}>{ctrl.status}</strong></p>
      <button type="button" className={`pc33-btn ${paused ? 'pc33-btn-primary' : 'pc33-btn-danger'}`}
        onClick={() => setCtrl((c) => paused ? resume(c, { now: NOW }) : instantPause(c, { reason: 'manual', by: 'operator', now: NOW }))}>
        {paused ? 'Resume' : 'Pause now'}
      </button>
      {paused && <p className="pc33-confirm">✓ All agent activity frozen — confirmed at step {ctrl.completedSteps}.</p>}
    </Card>
  );
}

/** 51286 — Graceful pause: drain in-flight work first. */
export function GracefulPause() {
  const [ctrl, setCtrl] = useState(() => ({ ...createHuntControl('hunt-42'), inFlight: 3 }));
  const draining = ctrl.status === 'draining';
  const tick = () => setCtrl((c) => gracefulDrainTick(completeInFlightUnit(c), NOW));
  return (
    <Card title="Graceful pause" idea="51286">
      <p className="pc33-muted">Status: <strong>{ctrl.status}</strong> · in-flight: {ctrl.inFlight}</p>
      {ctrl.status === 'running' && (
        <button type="button" className="pc33-btn" onClick={() => setCtrl((c) => beginGracefulPause(c, { reason: 'manual', by: 'operator', now: NOW }))}>
          Request graceful pause
        </button>
      )}
      {draining && (
        <div className="pc33-row">
          <button type="button" className="pc33-btn" onClick={tick}>Complete one in-flight unit</button>
          <span className="pc33-muted">Drain to zero — then the pause takes effect. No half-written state.</span>
        </div>
      )}
      {ctrl.status === 'paused' && <p className="pc33-confirm">✓ Paused cleanly after the in-flight work finished.</p>}
    </Card>
  );
}

/** 51287 — Pause with reason: tag every pause for the hunt record. */
export function PauseReasonTag() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const [note, setNote] = useState('');
  return (
    <Card title="Pause with reason" idea="51287">
      <div className="pc33-row">
        <select className="pc33-select" aria-label="Pause reason"
          value={ctrl.pauseReason || 'manual'}
          onChange={(e) => setCtrl((c) => tagPauseReason(c, e.target.value, note))}>
          {PAUSE_REASONS.map(([r, label]) => <option key={r} value={r}>{label}</option>)}
        </select>
        <input className="pc33-input" placeholder="Optional note…" value={note}
          onChange={(e) => { setNote(e.target.value); setCtrl((c) => tagPauseReason(c, c.pauseReason || 'manual', e.target.value)); }} />
      </div>
      <p className="pc33-muted">Recorded as: <strong>{describePauseReason(ctrl.pauseReason || 'manual')}</strong>{ctrl.pauseNote ? ` — “${ctrl.pauseNote}”` : ''}</p>
    </Card>
  );
}

/** 51288 — Resume exactly: pick up at the precise step. */
export function ResumeExactly() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused', pausedAt: NOW - 60000, completedSteps: 17,
    nextActions: ['probe /api/v1/users', 'fuzz ?debug param'],
  }));
  return (
    <Card title="Resume exactly" idea="51288">
      {ctrl.status === 'paused' ? (
        <div>
          <p className="pc33-muted">Paused at step {ctrl.completedSteps}. Nothing will be repeated or skipped.</p>
          <button type="button" className="pc33-btn pc33-btn-primary" onClick={() => setCtrl((c) => resume(c, { now: NOW }))}>
            Resume from step {ctrl.completedSteps + 1}
          </button>
        </div>
      ) : (
        <p className="pc33-confirm">✓ Running — resumed exactly at step {ctrl.completedSteps + 1} (resumedFromStep {ctrl.resumedFromStep}).</p>
      )}
    </Card>
  );
}

/** 51289 — Pause scheduling: automatic pause at a future time. */
export function PauseScheduler() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const [mins, setMins] = useState(30);
  const due = scheduledPauseDue(ctrl, NOW + mins * 60_000 + 1);
  return (
    <Card title="Pause scheduling" idea="51289">
      <div className="pc33-row">
        <input className="pc33-input pc33-input-narrow" type="number" min="1" value={mins}
          onChange={(e) => setMins(Number(e.target.value))} aria-label="Minutes from now" />
        <button type="button" className="pc33-btn"
          onClick={() => setCtrl((c) => schedulePause(c, NOW + mins * 60_000))}>
          Schedule pause in {mins}m
        </button>
        <button type="button" className="pc33-btn" disabled={!due}
          onClick={() => setCtrl((c) => applyScheduledPause(c, NOW + mins * 60_000 + 1))}>
          Simulate time passing
        </button>
      </div>
      <p className="pc33-muted">
        {ctrl.scheduledPauseAt ? `Pause scheduled. Due check at +${mins}m: ${due ? 'DUE' : 'not yet'}.` : 'No pause scheduled.'}
        {ctrl.status === 'paused' && ctrl.pauseReason === 'scheduled' && ' ✓ Auto-paused on schedule.'}
      </p>
    </Card>
  );
}

/** 51290 — Pause on finding: auto-pause above a severity threshold. */
export function PauseOnFinding() {
  const [threshold, setThreshold] = useState('high');
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const [lastCheck, setLastCheck] = useState(null);
  const findings = [
    { id: 'f1', severity: 'medium', title: 'Verbose error page' },
    { id: 'f2', severity: 'critical', title: 'SQL injection in search' },
  ];
  const evaluate = (f) => {
    const hit = shouldPauseOnFinding(threshold, f);
    setLastCheck({ finding: f.id, hit });
    setCtrl((c) => pauseOnFinding({ ...createHuntControl('hunt-42'), status: c.status, completedSteps: c.completedSteps }, f, threshold, NOW));
  };
  return (
    <Card title="Pause on finding" idea="51290">
      <div className="pc33-row">
        <select className="pc33-select" value={threshold} onChange={(e) => setThreshold(e.target.value)} aria-label="Severity threshold">
          {['low', 'medium', 'high', 'critical'].map((s) => <option key={s} value={s}>{s}+</option>)}
        </select>
        {findings.map((f) => (
          <button key={f.id} type="button" className="pc33-btn" onClick={() => evaluate(f)}>
            New finding: {f.severity} — {f.title}
          </button>
        ))}
      </div>
      <p className="pc33-muted">
        {lastCheck ? `${lastCheck.finding}: ${lastCheck.hit ? 'threshold met — auto-paused ✓' : 'below threshold — hunt continues'}` : 'Feed a finding to evaluate the rule.'}
        {ctrl.status === 'paused' && ctrl.pauseReason === 'finding' && ' (paused by auto-rule)'}
      </p>
    </Card>
  );
}

/** 51291 — Pause on approval: auto-pause while approvals are pending. */
export function PauseOnApproval() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const [pending, setPending] = useState(0);
  const request = () => {
    const n = pending + 1;
    setPending(n);
    setCtrl((c) => pauseOnApproval(c, Array.from({ length: n }, (_, i) => `approval-${i}`), NOW));
  };
  const resolve = () => {
    setPending(0);
    setCtrl((c) => (c.status === 'paused' && c.pauseReason === 'approval' ? resume(c, { now: NOW }) : c));
  };
  return (
    <Card title="Pause on approval" idea="51291">
      <div className="pc33-row">
        <button type="button" className="pc33-btn" onClick={request}>Sensitive action requested (needs approval)</button>
        <button type="button" className="pc33-btn" onClick={resolve} disabled={pending === 0}>Resolve approvals</button>
      </div>
      <p className="pc33-muted">Pending approvals: {pending} · hunt status: <strong>{ctrl.status}</strong>
        {ctrl.status === 'paused' && ctrl.pauseReason === 'approval' && ' — auto-paused until approvals resolve.'}</p>
    </Card>
  );
}

/** 51292 — Abort with confirmation: two-step, shows what is discarded. */
export function AbortConfirm() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'), inFlight: 2, nextActions: ['probe A', 'probe B'],
  }));
  const [prep, setPrep] = useState(null);
  return (
    <Card title="Abort with confirmation" idea="51292">
      {ctrl.status !== 'aborted' && !prep && (
        <button type="button" className="pc33-btn pc33-btn-danger" onClick={() => setPrep(prepareAbort(ctrl))}>Abort hunt…</button>
      )}
      {prep && ctrl.status !== 'aborted' && (
        <div className="pc33-warn-box">
          <p>{prep.summary}</p>
          <div className="pc33-row">
            <button type="button" className="pc33-btn pc33-btn-danger"
              onClick={() => { setCtrl((c) => confirmAbort(c, prep.token, { code: 'operator', now: NOW })); setPrep(null); }}>
              Yes, abort — discard {prep.willDiscardInFlight} in-flight
            </button>
            <button type="button" className="pc33-btn" onClick={() => setPrep(null)}>Keep hunting</button>
          </div>
        </div>
      )}
      {ctrl.status === 'aborted' && <p className="pc33-confirm">✓ Hunt aborted. Findings and timeline kept.</p>}
    </Card>
  );
}

/** 51293 — Abort-and-archive: stop and immediately archive everything. */
export function AbortAndArchive() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const [prep, setPrep] = useState(null);
  return (
    <Card title="Abort-and-archive" idea="51293">
      {ctrl.status !== 'archived' && !prep && (
        <button type="button" className="pc33-btn pc33-btn-danger" onClick={() => setPrep(prepareAbort(ctrl))}>Abort & archive…</button>
      )}
      {prep && ctrl.status !== 'archived' && (
        <div className="pc33-warn-box">
          <p>{prep.summary} Everything collected so far will be archived immediately.</p>
          <div className="pc33-row">
            <button type="button" className="pc33-btn pc33-btn-danger"
              onClick={() => { setCtrl((c) => abortAndArchive(c, prep.token, { code: 'operator', now: NOW })); setPrep(null); }}>
              Abort and archive
            </button>
            <button type="button" className="pc33-btn" onClick={() => setPrep(null)}>Cancel</button>
          </div>
        </div>
      )}
      {ctrl.status === 'archived' && (
        <p className="pc33-confirm">✓ Archived at step {ctrl.completedSteps}: findings kept, timeline kept, {ctrl.archive.inFlightDiscarded} in-flight discarded.</p>
      )}
    </Card>
  );
}

/** 51294 — Soft abort: stop new actions, finish findings + report. */
export function SoftAbort() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'), nextActions: ['probe A', 'probe B'],
  }));
  return (
    <Card title="Soft abort" idea="51294">
      <p className="pc33-muted">Status: <strong>{ctrl.status}</strong> · queued actions: {ctrl.nextActions.length}</p>
      {ctrl.status === 'running' && (
        <button type="button" className="pc33-btn" onClick={() => setCtrl((c) => softAbort(c, { now: NOW }))}>
          Soft abort — finish writing, stop new actions
        </button>
      )}
      {ctrl.status === 'finishing' && (
        <p className="pc33-confirm">✓ No new actions will start. The agent is finishing findings and the report.</p>
      )}
    </Card>
  );
}

/** 51295 — Pause per module: freeze one module, others continue. */
export function ModulePauseList() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42', ['recon', 'fuzzing', 'auth-tests']));
  const paused = pausedModules(ctrl);
  return (
    <Card title="Pause per module" idea="51295">
      <ul className="pc33-list">
        {Object.keys(ctrl.modules).map((m) => (
          <li key={m} className="pc33-list-item">
            <span>{m}</span>
            <button type="button" className="pc33-btn pc33-btn-small"
              onClick={() => setCtrl((c) => setModulePaused(c, m, !c.modules[m].paused))}>
              {ctrl.modules[m].paused ? 'Resume module' : 'Pause module'}
            </button>
          </li>
        ))}
      </ul>
      <p className="pc33-muted">{paused.length ? `Frozen: ${paused.join(', ')} — the rest continue.` : 'All modules running.'}</p>
    </Card>
  );
}

/** 51296 — Global pause all hunts: one command for the whole workspace. */
export function GlobalPauseAll() {
  const [hunts, setHunts] = useState(() => [
    createHuntControl('hunt-42', ['recon']),
    createHuntControl('hunt-43', ['fuzzing']),
    { ...createHuntControl('hunt-44', ['auth']), status: 'paused', pauseReason: 'manual', pausedAt: NOW - 5000 },
  ]);
  const running = hunts.filter((h) => h.status === 'running').length;
  return (
    <Card title="Global pause all hunts" idea="51296">
      <p className="pc33-muted">{running} of {hunts.length} hunts running.</p>
      <div className="pc33-row">
        <button type="button" className="pc33-btn pc33-btn-danger" disabled={running === 0}
          onClick={() => setHunts((hs) => pauseAllHunts(hs, { by: 'operator', now: NOW }))}>
          Pause all hunts
        </button>
        <button type="button" className="pc33-btn"
          onClick={() => setHunts((hs) => resumeAllHunts(hs, { now: NOW }))}>
          Resume globally-paused
        </button>
      </div>
      <ul className="pc33-list">
        {hunts.map((h) => <li key={h.huntId} className="pc33-list-item"><span>{h.huntId}</span><span className={`pc33-status pc33-status-${h.status}`}>{h.status}</span></li>)}
      </ul>
    </Card>
  );
}

/** 51297 — Pause state indicator: unmistakable banner with the why. */
export function PauseBanner() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const banner = pauseBanner(ctrl);
  const cycle = () => setCtrl((c) => {
    if (c.status === 'running') return instantPause(c, { reason: 'review', by: 'operator', now: NOW });
    if (c.status === 'paused') return beginGracefulPause({ ...c, status: 'running', pausedAt: null }, { reason: 'manual', by: 'operator', now: NOW });
    return { ...createHuntControl('hunt-42'), status: 'running' };
  });
  return (
    <Card title="Pause state indicator" idea="51297">
      <button type="button" className="pc33-btn" onClick={cycle}>Cycle state (running → paused → draining)</button>
      {banner.show ? (
        <div className={`pc33-banner pc33-banner-${banner.tone}`} role="status">
          <strong>{banner.title}</strong>
          <span>{banner.detail}</span>
        </div>
      ) : (
        <p className="pc33-muted">No banner — the hunt is running normally.</p>
      )}
    </Card>
  );
}

/** 51298 — Resume checklist: see what runs next, then confirm. */
export function ResumeChecklist() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused', pausedAt: NOW - 60000, completedSteps: 9,
    nextActions: ['fuzz ?redirect param', 'test JWT none-alg', 'check CORS wildcard'],
    networkHalted: true,
    newInstructions: ['focus on auth endpoints'],
  }));
  const [confirmed, setConfirmed] = useState(false);
  const items = resumeChecklist(ctrl);
  return (
    <Card title="Resume checklist" idea="51298">
      {ctrl.status === 'paused' && !confirmed && (
        <div>
          <ul className="pc33-list">
            {items.map((i) => <li key={i.id} className="pc33-list-item"><span className="pc33-check-icon">▢</span>{i.label}</li>)}
          </ul>
          <button type="button" className="pc33-btn pc33-btn-primary" onClick={() => { setCtrl((c) => resume(c, { now: NOW })); setConfirmed(true); }}>
            Confirm — resume hunt
          </button>
        </div>
      )}
      {confirmed && <p className="pc33-confirm">✓ Resumed with full awareness of what runs next.</p>}
    </Card>
  );
}

/** 51299 — Auto-resume timer: pause N minutes, resume automatically. */
export function AutoResumeTimer() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const [mins, setMins] = useState(15);
  const due = autoResumeDue(ctrl, NOW + mins * 60_000 + 1);
  return (
    <Card title="Auto-resume timer" idea="51299">
      <div className="pc33-row">
        <button type="button" className="pc33-btn" disabled={ctrl.status !== 'running'}
          onClick={() => setCtrl((c) => scheduleAutoResume(instantPause(c, { reason: 'manual', by: 'operator', now: NOW }), mins, NOW))}>
          Pause for
        </button>
        <input className="pc33-input pc33-input-narrow" type="number" min="1" max="1440" value={mins}
          onChange={(e) => setMins(Number(e.target.value))} aria-label="Minutes" />
        <span className="pc33-muted">minutes, then auto-resume</span>
        <button type="button" className="pc33-btn" disabled={!due}
          onClick={() => setCtrl((c) => applyAutoResume(c, NOW + mins * 60_000 + 1))}>
          Simulate timer firing
        </button>
      </div>
      <p className="pc33-muted">
        Status: <strong>{ctrl.status}</strong>
        {ctrl.autoResumeAt ? ` · auto-resume in ${ctrl.autoResumeMinutes}m` : ''}
        {ctrl.resumedBy === 'auto-timer' && ' ✓ resumed automatically by the timer.'}
      </p>
    </Card>
  );
}

/** 51300 — Pause during stealth: halts all network traffic instantly. */
export function StealthPause() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  return (
    <Card title="Pause during stealth" idea="51300">
      <p className="pc33-muted">Network: <strong>{ctrl.networkHalted ? 'HALTED' : 'active'}</strong> · Status: <strong>{ctrl.status}</strong></p>
      {ctrl.status === 'running' && (
        <button type="button" className="pc33-btn pc33-btn-danger"
          onClick={() => setCtrl((c) => stealthPause(c, { by: 'operator', now: NOW }))}>
          Stealth pause — halt all traffic now
        </button>
      )}
      {ctrl.networkHalted && (
        <div>
          <p className="pc33-confirm">✓ Zero packets leaving the machine. Safe window confirmed.</p>
          <button type="button" className="pc33-btn" onClick={() => setCtrl((c) => resume(c, { now: NOW }))}>Resume (traffic restarts)</button>
        </div>
      )}
    </Card>
  );
}

/** Gallery for wave 33, part 1 (ideas 51281–51300). */
export function PauseControlGallery() {
  return (
    <div className="pc33-gallery">
      <ArtifactGallery />
      <LogAccessRoles />
      <LogRetentionPolicies />
      <IncidentPackage />
      <InstantPauseButton />
      <GracefulPause />
      <PauseReasonTag />
      <ResumeExactly />
      <PauseScheduler />
      <PauseOnFinding />
      <PauseOnApproval />
      <AbortConfirm />
      <AbortAndArchive />
      <SoftAbort />
      <ModulePauseList />
      <GlobalPauseAll />
      <PauseBanner />
      <ResumeChecklist />
      <AutoResumeTimer />
      <StealthPause />
    </div>
  );
}
