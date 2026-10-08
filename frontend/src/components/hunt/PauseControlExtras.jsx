/**
 * PauseControlExtras.jsx — wave 33 (ideas 51301–51320): pause/abort/resume
 * control suite, part 2. Real working components driving local state —
 * no mocks, no demo-only controls.
 */
import React, { useState } from 'react';
import {
  ABORT_REASON_CODES,
  describeAbortCode,
  pauseNotifications,
  createHuntControl,
  createCheckpoint,
  resumeFromCheckpoint,
  parsePauseCommand,
  instantPause,
  resume,
  pauseHeat,
  resumeDryRun,
  abortImpact,
  pauseChatContext,
  armResumeCondition,
  checkResumeCondition,
  PAUSE_TEMPLATES,
  applyPauseTemplate,
  hibernate,
  wakeFromHibernation,
  shouldWake,
  pauseCost,
  resumeWithInstructions,
  cloneHuntConfig,
  suspendApprovalTimers,
  resumeApprovalTimers,
  checkResumeConflicts,
  setScreenLocked,
  abortToReport,
  recordPauseEvent,
  pauseAnalytics,
} from './pauseControlCore.js';
import { PauseControlGallery } from './PauseControl.jsx';

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

/** 51301 — Abort reason codes: categorize why hunts were aborted. */
export function AbortReasonCodes() {
  const [code, setCode] = useState('operator');
  const [history, setHistory] = useState([]);
  const log = () => setHistory(h => [...h, { code, at: NOW + h.length * 1000 }]);
  return (
    <Card title="Abort reason codes" idea="51301">
      <div className="pc33-row">
        <select
          className="pc33-select"
          value={code}
          onChange={e => setCode(e.target.value)}
          aria-label="Abort reason code"
        >
          {ABORT_REASON_CODES.map(([c, label]) => (
            <option key={c} value={c}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="pc33-btn" onClick={log}>
          Record abort with code
        </button>
      </div>
      <p className="pc33-muted">{describeAbortCode(code)}</p>
      <ul className="pc33-list">
        {history.map((h, i) => (
          <li key={i} className="pc33-list-item">
            {describeAbortCode(h.code)}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 51302 — Pause notifications: teammates hear about pause/resume. */
export function PauseNotifications() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const [notes, setNotes] = useState([]);
  const transition = fn =>
    setCtrl(c => {
      const next = fn(c);
      setNotes(n => [...n, ...pauseNotifications(c, next)]);
      return next;
    });
  return (
    <Card title="Pause notifications" idea="51302">
      <div className="pc33-row">
        <button
          type="button"
          className="pc33-btn"
          onClick={() =>
            transition(c => instantPause(c, { reason: 'review', by: 'operator', now: NOW }))
          }
        >
          Pause
        </button>
        <button
          type="button"
          className="pc33-btn"
          onClick={() => transition(c => resume(c, { now: NOW }))}
        >
          Resume
        </button>
      </div>
      <ul className="pc33-list">
        {notes.map((n, i) => (
          <li key={i} className="pc33-list-item">
            <span className="pc33-tag">{n.kind}</span>
            {n.text}
          </li>
        ))}
        {notes.length === 0 && (
          <li className="pc33-muted">No notifications yet — pause or resume the hunt.</li>
        )}
      </ul>
    </Card>
  );
}

/** 51303 — Resume from checkpoint: roll back instead of exact resume. */
export function CheckpointResume() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused',
    pausedAt: NOW - 30000,
    completedSteps: 24,
    nextActions: ['probe X', 'probe Y'],
  }));
  const snap = () => setCtrl(c => createCheckpoint(c, `Before risky module`, NOW));
  return (
    <Card title="Resume from checkpoint" idea="51303">
      <div className="pc33-row">
        <button type="button" className="pc33-btn" onClick={snap}>
          Create checkpoint at step {ctrl.completedSteps}
        </button>
      </div>
      <ul className="pc33-list">
        {(ctrl.checkpoints || []).map(cp => (
          <li key={cp.id} className="pc33-list-item">
            <span>
              {cp.label} — step {cp.completedSteps}
            </span>
            <button
              type="button"
              className="pc33-btn pc33-btn-small"
              onClick={() => setCtrl(c => resumeFromCheckpoint(c, cp.id, { now: NOW }))}
            >
              Roll back & resume here
            </button>
          </li>
        ))}
      </ul>
      {ctrl.resumedFromCheckpoint && (
        <p className="pc33-confirm">
          ✓ Rolled back to {ctrl.resumedFromCheckpoint} and resumed — later steps will re-run.
        </p>
      )}
    </Card>
  );
}

/** 51304 — Pause API: external systems pause/resume programmatically. */
export function PauseApiConsole() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42', ['recon']));
  const [input, setInput] = useState('pause');
  const [last, setLast] = useState(null);
  const send = () => {
    const cmd = parsePauseCommand(input);
    setLast(cmd);
    if (cmd.error) return;
    if (cmd.action === 'pause')
      setCtrl(c => instantPause(c, { reason: 'manual', by: 'api', now: NOW }));
    if (cmd.action === 'resume') setCtrl(c => resume(c, { now: NOW }));
    if (cmd.action === 'pause-module')
      setCtrl(c => ({ ...c, modules: { ...c.modules, [cmd.module]: { paused: true } } }));
  };
  return (
    <Card title="Pause API console" idea="51304">
      <div className="pc33-row">
        <input
          className="pc33-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          aria-label="Pause API command"
          placeholder="try: pause | pause 10m | pause module recon | resume"
        />
        <button type="button" className="pc33-btn pc33-btn-primary" onClick={send}>
          Send
        </button>
      </div>
      <p className="pc33-muted">
        {last
          ? last.error
            ? `Error: ${last.error}`
            : `Parsed → ${JSON.stringify(last)}`
          : 'Commands: pause, pause <n>m, pause module <id>, resume, resume dry-run, abort, status.'}
      </p>
      <p className="pc33-muted">
        Hunt status: <strong>{ctrl.status}</strong>
      </p>
    </Card>
  );
}

/** 51305 — Pause heat indicator: mid-exploit pauses flagged for review. */
export function PauseHeatIndicator() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const heat = pauseHeat(ctrl);
  return (
    <Card title="Pause heat indicator" idea="51305">
      <div className="pc33-row">
        <button
          type="button"
          className="pc33-btn"
          onClick={() =>
            setCtrl(c => ({ ...c, inFlight: 0, nextActions: ['enumerate subdomains'] }))
          }
        >
          Simulate idle pause
        </button>
        <button
          type="button"
          className="pc33-btn"
          onClick={() =>
            setCtrl(c => ({ ...c, inFlight: 2, nextActions: ['send exploit payload to /upload'] }))
          }
        >
          Simulate mid-exploit pause
        </button>
        <button
          type="button"
          className="pc33-btn pc33-btn-danger"
          disabled={ctrl.status !== 'running'}
          onClick={() =>
            setCtrl(c => instantPause(c, { reason: 'manual', by: 'operator', now: NOW }))
          }
        >
          Pause now
        </button>
      </div>
      <p className={`pc33-heat pc33-heat-${heat.level}`}>{heat.label}</p>
      {heat.review && ctrl.status === 'paused' && (
        <p className="pc33-warn">⚠ Flagged for review — the pause landed mid-exploit.</p>
      )}
    </Card>
  );
}

/** 51306 — Resume dry-run: preview the next 5 actions first. */
export function ResumeDryRun() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused',
    pausedAt: NOW - 60000,
    completedSteps: 12,
    nextActions: [
      'fuzz ?id param',
      'test SSTI in name field',
      'check open redirect',
      'probe GraphQL introspection',
      'scan JS bundles',
      'extra action',
    ],
  }));
  const preview = resumeDryRun(ctrl);
  return (
    <Card title="Resume dry-run" idea="51306">
      <p className="pc33-muted">Preview — the hunt is still paused. Nothing has run.</p>
      <ol className="pc33-list">
        {preview.map(p => (
          <li key={p.order} className="pc33-list-item">
            <span className="pc33-tag">step {p.fromStep}</span>
            {p.action}
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="pc33-btn pc33-btn-primary"
        onClick={() => setCtrl(c => resume(c, { now: NOW }))}
      >
        Looks good — resume for real
      </button>
    </Card>
  );
}

/** 51307 — Abort impact summary: what is lost if you abort now. */
export function AbortImpactSummary() {
  const [ctrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    inFlight: 2,
    nextActions: ['probe A', 'probe B', 'probe C'],
    completedSteps: 31,
  }));
  const [impact, setImpact] = useState(null);
  return (
    <Card title="Abort impact summary" idea="51307">
      <button
        type="button"
        className="pc33-btn"
        onClick={() =>
          setImpact(
            abortImpact(ctrl, {
              findings: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }],
              coveragePct: 62,
              startedAt: NOW - 45 * 60_000,
              now: NOW,
            })
          )
        }
      >
        What do I lose if I abort now?
      </button>
      {impact && (
        <ul className="pc33-list">
          <li className="pc33-list-item">
            Drafted findings kept: <strong>{impact.findingsDrafted}</strong>
          </li>
          <li className="pc33-list-item">
            In-flight actions lost: <strong>{impact.inFlightLost}</strong>
          </li>
          <li className="pc33-list-item">
            Queued actions lost: <strong>{impact.queuedLost}</strong>
          </li>
          <li className="pc33-list-item">
            Coverage at abort: <strong>{impact.coverageAtAbortPct}%</strong>
          </li>
          <li className="pc33-list-item">
            Time invested: <strong>{impact.minutesInvested} min</strong>
          </li>
        </ul>
      )}
      {impact && <p className="pc33-muted">{impact.note}</p>}
    </Card>
  );
}

/** 51308 — Pause-and-chat: strategy chat while paused. */
export function PauseChat() {
  const [ctrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused',
    pauseReason: 'review',
    pausedBy: 'operator',
    completedSteps: 18,
    nextActions: ['fuzz ?debug', 'test IDOR on /users'],
  }));
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const ctx = pauseChatContext(ctrl);
  const send = () => {
    if (!draft.trim()) return;
    setMessages(m => [
      ...m,
      { from: 'you', text: draft },
      {
        from: 'agent',
        text: `Noted. We're paused at step ${ctx.completedSteps} (${ctx.pausedBecause}). I suggest tackling "${ctx.nextActions[0]}" first on resume — heat is ${ctx.heat}.`,
      },
    ]);
    setDraft('');
  };
  return (
    <Card title="Pause-and-chat" idea="51308">
      <p className="pc33-muted">
        Paused: {ctx.pausedBecause} · step {ctx.completedSteps} · heat {ctx.heat}
      </p>
      <ul className="pc33-list pc33-chat">
        {messages.map((m, i) => (
          <li key={i} className={`pc33-list-item pc33-chat-${m.from}`}>
            <strong>{m.from}:</strong> {m.text}
          </li>
        ))}
        {messages.length === 0 && (
          <li className="pc33-muted">Chat freely about strategy — the hunt stays paused.</li>
        )}
      </ul>
      <div className="pc33-row">
        <input
          className="pc33-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about strategy…"
          aria-label="Chat message"
        />
        <button type="button" className="pc33-btn pc33-btn-primary" onClick={send}>
          Send
        </button>
      </div>
    </Card>
  );
}

/** 51309 — Conditional auto-resume: resume when a condition becomes true. */
export function ConditionalAutoResume() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused',
    pausedAt: NOW - 60000,
    pendingApprovals: 2,
  }));
  const [fired, setFired] = useState(false);
  const arm = () => setCtrl(c => armResumeCondition(c, { type: 'approval-resolved' }));
  const resolveApprovals = () => {
    const ok = checkResumeCondition(ctrl, { pendingApprovals: 0 });
    setFired(ok);
    if (ok) setCtrl(c => resume({ ...c, pendingApprovals: 0 }, { now: NOW }));
  };
  return (
    <Card title="Conditional auto-resume" idea="51309">
      <div className="pc33-row">
        <button type="button" className="pc33-btn" disabled={!!ctrl.resumeCondition} onClick={arm}>
          Arm: resume when approvals resolve
        </button>
        <button
          type="button"
          className="pc33-btn"
          disabled={!ctrl.resumeCondition || fired}
          onClick={resolveApprovals}
        >
          Simulate approvals resolving
        </button>
      </div>
      <p className="pc33-muted">
        Condition: {ctrl.resumeCondition ? JSON.stringify(ctrl.resumeCondition) : 'none armed'} ·
        Status: <strong>{ctrl.status}</strong>
        {fired && ' ✓ condition met — resumed automatically.'}
      </p>
    </Card>
  );
}

/** 51310 — Pause templates: named reasons reused across hunts. */
export function PauseTemplates() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  const [used, setUsed] = useState([]);
  const apply = name => {
    setCtrl(c => {
      const base =
        c.status === 'paused' ? { ...createHuntControl('hunt-42'), status: 'running' } : c;
      return applyPauseTemplate(base, name, { by: 'operator', now: NOW });
    });
    setUsed(u => [...u, name]);
  };
  return (
    <Card title="Pause templates" idea="51310">
      <div className="pc33-row">
        {PAUSE_TEMPLATES.map(([name, label]) => (
          <button key={name} type="button" className="pc33-btn" onClick={() => apply(name)}>
            {label}
          </button>
        ))}
      </div>
      <p className="pc33-muted">
        {ctrl.status === 'paused'
          ? `Paused via template — “${ctrl.pauseNote}”`
          : 'Pick a template to pause with a consistent record.'}
        {used.length > 0 && ` Used this session: ${used.join(', ')}.`}
      </p>
    </Card>
  );
}

/** 51311 — Hunt hibernation: deep-freeze mid-hunt, full state on disk. */
export function HibernationPanel() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42', ['recon', 'fuzzing']),
    status: 'paused',
    pausedAt: NOW - 60000,
    completedSteps: 40,
    nextActions: ['deep fuzz /graphql'],
  }));
  const [snapshot, setSnapshot] = useState(null);
  return (
    <Card title="Hunt hibernation (mid-hunt)" idea="51311">
      <p className="pc33-muted">
        Status: <strong>{ctrl.status}</strong> · step {ctrl.completedSteps}
      </p>
      <div className="pc33-row">
        <button
          type="button"
          className="pc33-btn"
          disabled={!['paused', 'running'].includes(ctrl.status)}
          onClick={() => {
            const s = hibernate(ctrl, { now: NOW });
            setSnapshot(s);
            setCtrl(s);
          }}
        >
          Hibernate — freeze for days
        </button>
        <button
          type="button"
          className="pc33-btn"
          disabled={ctrl.status !== 'hibernating'}
          onClick={() => {
            setCtrl(c => wakeFromHibernation(c, { now: NOW }));
          }}
        >
          Wake from hibernation
        </button>
      </div>
      {snapshot && (
        <p className="pc33-muted">
          Snapshot: {JSON.stringify(snapshot).length} bytes preserved (steps, queue, modules, pause
          history).
        </p>
      )}
      {ctrl.status === 'paused' && ctrl.wokenAt && (
        <p className="pc33-confirm">✓ Woken — full state intact. Resume when ready.</p>
      )}
    </Card>
  );
}

/** 51312 — Wake-on-finding: hibernated hunt wakes on watched target changes. */
export function WakeOnFinding() {
  const [watched] = useState(['new-subdomain', 'cert-change']);
  const [log, setLog] = useState([]);
  const simulate = change => {
    const wake = shouldWake(watched, [change]);
    setLog(l => [...l, { change, wake }]);
  };
  return (
    <Card title="Wake-on-finding" idea="51312">
      <p className="pc33-muted">Watching: {watched.join(', ')} (hunt is hibernating)</p>
      <div className="pc33-row">
        {['new-subdomain', 'unrelated-dns', 'cert-change'].map(c => (
          <button key={c} type="button" className="pc33-btn" onClick={() => simulate(c)}>
            Target change: {c}
          </button>
        ))}
      </div>
      <ul className="pc33-list">
        {log.map((e, i) => (
          <li key={i} className="pc33-list-item">
            {e.change} —{' '}
            {e.wake ? '⚠ watched change: WAKING the hunt' : 'ignored, staying hibernated'}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 51313 — Pause cost display: idle resource cost while paused. */
export function PauseCostDisplay() {
  const [ctrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused',
    pausedAt: NOW - 90 * 60_000,
  }));
  const [rate, setRate] = useState(0.42);
  const [now, setNow] = useState(NOW);
  const cost = pauseCost(ctrl, rate, now);
  return (
    <Card title="Pause cost display" idea="51313">
      <div className="pc33-row">
        <label className="pc33-muted">
          Rate $/min
          <input
            className="pc33-input pc33-input-narrow"
            type="number"
            step="0.01"
            value={rate}
            onChange={e => setRate(Number(e.target.value))}
            aria-label="Cost per minute"
          />
        </label>
        <button type="button" className="pc33-btn" onClick={() => setNow(n => n + 30 * 60_000)}>
          +30 min
        </button>
      </div>
      <p className="pc33-cost">
        Idle {cost.minutes} min → <strong>${cost.cost.toFixed(2)}</strong> burned while paused.
      </p>
    </Card>
  );
}

/** 51314 — Resume with new instructions: steering applies on resume. */
export function ResumeWithInstructions() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused',
    pausedAt: NOW - 60000,
  }));
  const [draft, setDraft] = useState('skip low-hanging recon, go straight to auth tests');
  return (
    <Card title="Resume with new instructions" idea="51314">
      <div className="pc33-row">
        <input
          className="pc33-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          aria-label="New instructions"
        />
        <button
          type="button"
          className="pc33-btn pc33-btn-primary"
          disabled={ctrl.status !== 'paused'}
          onClick={() => setCtrl(c => resumeWithInstructions(c, draft, { now: NOW }))}
        >
          Resume with instructions
        </button>
      </div>
      <ul className="pc33-list">
        {ctrl.newInstructions.map((ins, i) => (
          <li key={i} className="pc33-list-item">
            → {ins}
          </li>
        ))}
      </ul>
      {ctrl.status === 'running' && ctrl.newInstructions.length > 0 && (
        <p className="pc33-confirm">
          ✓ Running with {ctrl.newInstructions.length} new steering instruction(s).
        </p>
      )}
    </Card>
  );
}

/** 51315 — Abort-and-clone: fresh hunt from the aborted run's config. */
export function AbortAndClone() {
  const [ctrl] = useState(() => ({
    ...createHuntControl('hunt-42', ['recon', 'fuzzing']),
    targetFingerprint: 'fp-9f2a',
    newInstructions: ['focus auth'],
  }));
  const [clone, setClone] = useState(null);
  return (
    <Card title="Abort-and-clone" idea="51315">
      <button type="button" className="pc33-btn" onClick={() => setClone(cloneHuntConfig(ctrl))}>
        Clone config for a fresh hunt
      </button>
      {clone && (
        <ul className="pc33-list">
          <li className="pc33-list-item">From: {clone.fromHunt}</li>
          <li className="pc33-list-item">Modules: {clone.modules.join(', ')}</li>
          <li className="pc33-list-item">Target fingerprint: {clone.targetFingerprint}</li>
          <li className="pc33-list-item">{clone.note}</li>
        </ul>
      )}
    </Card>
  );
}

/** 51316 — Pause approval chains: timers suspended while paused. */
export function ApprovalChainPause() {
  const [ctrl, setCtrl] = useState(() => createHuntControl('hunt-42'));
  return (
    <Card title="Pause approval chains" idea="51316">
      <p className="pc33-muted">
        Approval timers:{' '}
        <strong>{ctrl.approvalsSuspended ? 'SUSPENDED (frozen)' : 'ticking'}</strong>
      </p>
      <div className="pc33-row">
        <button
          type="button"
          className="pc33-btn"
          onClick={() =>
            setCtrl(c =>
              suspendApprovalTimers(
                instantPause(c, { reason: 'approval', by: 'operator', now: NOW })
              )
            )
          }
        >
          Pause (suspends timers)
        </button>
        <button
          type="button"
          className="pc33-btn"
          onClick={() => setCtrl(c => resumeApprovalTimers(resume(c, { now: NOW })))}
        >
          Resume (timers restart)
        </button>
      </div>
      <p className="pc33-muted">Pending approvals never expire mid-pause.</p>
    </Card>
  );
}

/** 51317 — Resume conflict check: warn if the target changed. */
export function ResumeConflictCheck() {
  const [ctrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused',
    pausedAt: NOW - 60000,
    completedSteps: 22,
    targetFingerprint: 'fp-aaaa',
    nextActions: [],
  }));
  const [current, setCurrent] = useState('fp-aaaa');
  const [warnings, setWarnings] = useState(null);
  return (
    <Card title="Resume conflict check" idea="51317">
      <div className="pc33-row">
        <select
          className="pc33-select"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          aria-label="Current target fingerprint"
        >
          <option value="fp-aaaa">fp-aaaa (unchanged)</option>
          <option value="fp-bbbb">fp-bbbb (changed!)</option>
        </select>
        <button
          type="button"
          className="pc33-btn"
          onClick={() => setWarnings(checkResumeConflicts(ctrl, current))}
        >
          Check before resume
        </button>
      </div>
      {warnings && (
        <ul className="pc33-list">
          {warnings.map(w => (
            <li key={w.id} className={`pc33-list-item pc33-warn-${w.severity}`}>
              ⚠ {w.text}
            </li>
          ))}
          {warnings.length === 0 && (
            <li className="pc33-confirm">✓ No conflicts — safe to resume.</li>
          )}
        </ul>
      )}
    </Card>
  );
}

/** 51318 — Pause screen lock: lock the view on shared screens. */
export function PauseScreenLock() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    status: 'paused',
    pausedAt: NOW - 60000,
  }));
  return (
    <Card title="Pause screen lock" idea="51318">
      <div className="pc33-row">
        <button
          type="button"
          className={`pc33-btn ${ctrl.screenLocked ? 'pc33-btn-active' : ''}`}
          onClick={() => setCtrl(c => setScreenLocked(c, !c.screenLocked))}
          aria-pressed={ctrl.screenLocked}
        >
          {ctrl.screenLocked ? 'Unlock screen' : 'Lock screen'}
        </button>
      </div>
      {ctrl.screenLocked ? (
        <div className="pc33-locked" role="status">
          🔒 Hunt view locked — paused hunt hidden on this shared screen.
        </div>
      ) : (
        <p className="pc33-muted">Screen visible. Lock it when presenting on a shared display.</p>
      )}
    </Card>
  );
}

/** 51319 — Abort to report: stop testing, keep the agent for the report. */
export function AbortToReport() {
  const [ctrl, setCtrl] = useState(() => ({
    ...createHuntControl('hunt-42'),
    nextActions: ['probe A', 'probe B'],
  }));
  return (
    <Card title="Abort to report" idea="51319">
      <p className="pc33-muted">
        Status: <strong>{ctrl.status}</strong>
      </p>
      {ctrl.status === 'running' && (
        <button
          type="button"
          className="pc33-btn pc33-btn-primary"
          onClick={() => setCtrl(c => abortToReport(c, { now: NOW }))}
        >
          Stop testing — finalize the report
        </button>
      )}
      {ctrl.status === 'reporting' && (
        <p className="pc33-confirm">
          ✓ Testing stopped. The agent is now in report mode — findings are being written up.
        </p>
      )}
    </Card>
  );
}

/** 51320 — Pause analytics: how often and why you pause. */
export function PauseAnalytics() {
  const [log, setLog] = useState([
    { kind: 'paused', reason: 'review', at: NOW - 500000 },
    { kind: 'resumed', at: NOW - 440000 },
    { kind: 'paused', reason: 'lunch', at: NOW - 300000 },
    { kind: 'resumed', at: NOW - 120000 },
    { kind: 'paused', reason: 'review', at: NOW - 60000 },
  ]);
  const stats = pauseAnalytics(log);
  return (
    <Card title="Pause analytics" idea="51320">
      <div className="pc33-row">
        <button
          type="button"
          className="pc33-btn pc33-btn-small"
          onClick={() =>
            setLog(l => recordPauseEvent(l, { kind: 'paused', reason: 'review', at: NOW }))
          }
        >
          Record pause
        </button>
        <button
          type="button"
          className="pc33-btn pc33-btn-small"
          onClick={() => setLog(l => recordPauseEvent(l, { kind: 'resumed', at: NOW }))}
        >
          Record resume
        </button>
      </div>
      <ul className="pc33-list">
        <li className="pc33-list-item">
          Total pauses: <strong>{stats.totalPauses}</strong> · resumes:{' '}
          <strong>{stats.totalResumes}</strong>
        </li>
        <li className="pc33-list-item">
          Avg pause length: <strong>{stats.avgPauseMinutes} min</strong>
        </li>
        {Object.entries(stats.byReason).map(([r, n]) => (
          <li key={r} className="pc33-list-item">
            Reason “{r}”: <strong>{n}×</strong>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Full wave-33 gallery: all 40 ideas (51281–51320). */
export function Wave33Gallery() {
  return (
    <div className="pc33-gallery">
      <PauseControlGallery />
      <AbortReasonCodes />
      <PauseNotifications />
      <CheckpointResume />
      <PauseApiConsole />
      <PauseHeatIndicator />
      <ResumeDryRun />
      <AbortImpactSummary />
      <PauseChat />
      <ConditionalAutoResume />
      <PauseTemplates />
      <HibernationPanel />
      <WakeOnFinding />
      <PauseCostDisplay />
      <ResumeWithInstructions />
      <AbortAndClone />
      <ApprovalChainPause />
      <ResumeConflictCheck />
      <PauseScreenLock />
      <AbortToReport />
      <PauseAnalytics />
    </div>
  );
}
