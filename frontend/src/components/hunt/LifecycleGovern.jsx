/**
 * LifecycleGovern.jsx — Infinity AI · Dark-Matter · Wave 60
 * 20 working React components for finding-lifecycle state governance, ideas 52361–52380.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as LG from './lifecycleGovernCore.js';

const NOW = 1700000000000;
const HOUR = 3600000;

const F1 = { id: 'f-601', state: 'New', severity: 'high', stateEnteredAt: NOW - 30 * HOUR, evidence: [], title: 'Stored XSS in reviews' };
const F2 = { id: 'f-602', state: 'Triaged', severity: 'critical', stateEnteredAt: NOW - 60 * HOUR, evidence: [], title: 'SQLi in search' };
const F3 = { id: 'f-603', state: 'InRetest', severity: 'medium', stateEnteredAt: NOW - 5 * HOUR, evidence: [{ kind: 'fix', name: 'patch.diff' }], retest: { passed: true, id: 'rt-9' }, title: 'IDOR in orders' };

function Note({ children }) {
  return <p className="lg60-note">{children}</p>;
}

function Mono({ children }) {
  return <pre className="lg60-mono">{children}</pre>;
}

/* 52361 — State transition rules. */
export function TransitionRules() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52361 · State transition rules</h3>
      <div className="lg60-row">
        <button className="lg60-btn" onClick={() => setRes({ ok: LG.canTransition('Verified', 'New'), label: 'Verified → New' })}>Test Verified → New</button>
        <button className="lg60-btn" onClick={() => setRes({ ok: LG.canTransition('Triaged', 'InProgress'), label: 'Triaged → InProgress' })}>Test Triaged → InProgress</button>
      </div>
      {res && <Note>{res.label}: {res.ok.legal ? 'LEGAL' : `ILLEGAL — ${res.ok.reason}`}</Note>}
    </div>
  );
}

/* 52362 — Per-role state permissions. */
export function RoleStatePermissions() {
  const [role, setRole] = useState('hunter');
  const res = LG.canRoleTransition(role, 'Verified', 'Closed');
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52362 · Per-role state permissions</h3>
      <div className="lg60-row">
        {['hunter', 'agent', 'triager', 'lead', 'manager'].map((r) => (
          <button key={r} className="lg60-chip" onClick={() => setRole(r)}>{r}{r === role ? ' ✓' : ''}</button>
        ))}
      </div>
      <Note>Verified → Closed as {role}: {res.ok ? 'ALLOWED' : `DENIED — ${res.reason}`}</Note>
    </div>
  );
}

/* 52363 — State-change audit log. */
export function StateAuditLog() {
  const [log, setLog] = useState([]);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52363 · State-change audit log</h3>
      <button className="lg60-btn" onClick={() => {
        const r = LG.appendStateAudit(log, { findingId: F1.id, actor: 'aria', from: 'New', to: 'Triaged', reason: 'initial triage complete' }, NOW + log.length);
        if (r.ok) setLog(r.log);
      }}>Append entry</button>
      <Note>{log.length} entr{log.length === 1 ? 'y' : 'ies'} · frozen: {log.every((e) => Object.isFrozen(e)) ? 'yes' : 'no'}</Note>
      {log.length > 0 && <Mono>{log.map((e) => `${e.actor} ${e.from}→${e.to} @${e.at} "${e.reason}"`).join('\n')}</Mono>}
    </div>
  );
}

/* 52364 — State-change notifications (post-hunt). */
export function StateChangeNotifications() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52364 · State-change notifications</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.notifyStateChange({
        findingId: F1.id, from: 'New', to: 'Triaged', by: 'aria',
        reason: 'initial triage complete', watchers: [{ id: 'bhavesh' }, { id: 'sec-lead' }],
      }, NOW))}>Notify watchers</button>
      {res && res.ok && <Note>{res.count} notification(s) queued · {res.notifications.map((n) => n.to).join(', ')}</Note>}
    </div>
  );
}

/* 52365 — Bulk state transitions. */
export function BulkTransitions() {
  const [res, setRes] = useState(null);
  const batch = [F1, F2];
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52365 · Bulk state transitions</h3>
      <div className="lg60-row">
        <button className="lg60-btn" onClick={() => setRes({ ...LG.bulkTransitionPreview(batch, 'Triaged', NOW), mode: 'preview' })}>Preview Triaged</button>
        <button className="lg60-btn" onClick={() => setRes({ ...LG.bulkTransition(batch, 'Triaged', { reason: 'wave-60 bulk triage', actor: 'aria' }, NOW), mode: 'applied' })}>Apply with reason</button>
      </div>
      {res && <Note>{res.mode}: {res.counts.legal ?? res.counts.ok} legal, {res.counts.illegal ?? res.counts.failed} illegal of {res.counts.total} · audit entries: {res.auditLog ? res.auditLog.length : 'n/a'}</Note>}
    </div>
  );
}

/* 52366 — State SLA timers. */
export function StateSlaTimers() {
  const [state, setState] = useState('New');
  const check = LG.slaBreachCheck(state, NOW - 30 * HOUR, NOW);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52366 · State SLA timers</h3>
      <div className="lg60-row">
        {['New', 'Triaged', 'InProgress', 'Blocked'].map((s) => (
          <button key={s} className="lg60-chip" onClick={() => setState(s)}>{s}{s === state ? ' ✓' : ''}</button>
        ))}
      </div>
      <Note>{state}: {check.hasSla ? `${(check.targetMs / HOUR)}h target · elapsed ${(check.elapsedMs / HOUR).toFixed(1)}h · ${check.breached ? 'BREACHED' : 'within SLA'}` : 'no SLA for this state'}</Note>
    </div>
  );
}

/* 52367 — Lifecycle dashboard. */
export function LifecycleDashboard() {
  const [res, setRes] = useState(null);
  const findings = [F1, F2, F3, { ...F1, id: 'f-604', state: 'Verified', stateEnteredAt: NOW - 3 * HOUR }];
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52367 · Lifecycle dashboard</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.lifecycleDashboard(findings, NOW))}>Build kanban payload</button>
      {res && <Note>{res.total} findings across {res.columns.filter((c) => c.count > 0).length} active columns: {res.columns.filter((c) => c.count > 0).map((c) => `${c.state}(${c.count})`).join(', ')}</Note>}
    </div>
  );
}

/* 52368 — State timeline per finding. */
export function StateTimeline() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52368 · State timeline per finding</h3>
      <button className="lg60-btn" onClick={() => {
        let log = [];
        for (const [from, to, actor, at] of [['New', 'Triaged', 'aria', NOW], ['Triaged', 'InProgress', 'bhavesh', NOW + HOUR], ['InProgress', 'InRetest', 'aria', NOW + 3 * HOUR]]) {
          log = LG.appendStateAudit(log, { findingId: F1.id, actor, from, to, reason: `${from}→${to} demo`, at }).log;
        }
        setRes(LG.buildStateTimeline(log, F1.id));
      }}>Build timeline</button>
      {res && <Note>{res.steps} step(s) · total journey {res.totalMs !== null ? `${(res.totalMs / HOUR).toFixed(1)}h` : 'n/a'}</Note>}
      {res && <Mono>{res.timeline.map((t) => `${t.from} → ${t.to} (${t.actor})${t.durationInPriorStateMs !== null ? ` +${(t.durationInPriorStateMs / HOUR).toFixed(1)}h in prior` : ''}`).join('\n')}</Mono>}
    </div>
  );
}

/* 52369 — Mandatory state-change reasons. */
export function MandatoryChangeReasons() {
  const [reason, setReason] = useState('');
  const check = LG.requireChangeReason('Verified', 'Closed', reason);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52369 · Mandatory state-change reasons</h3>
      <input className="lg60-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason for closing…" />
      <Note>Verified → Closed: {check.ok ? 'reason accepted' : `BLOCKED — ${check.reason}`}</Note>
    </div>
  );
}

/* 52370 — State undo. */
export function StateUndo() {
  const [res, setRes] = useState(null);
  const entry = LG.appendStateAudit([], { findingId: F1.id, actor: 'aria', from: 'New', to: 'Triaged', reason: 'triage', at: NOW }).entry;
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52370 · State undo</h3>
      <div className="lg60-row">
        <button className="lg60-btn" onClick={() => setRes(LG.undoTransition(entry, 15 * 60 * 1000, NOW + 5 * 60 * 1000))}>Undo within grace</button>
        <button className="lg60-btn" onClick={() => setRes(LG.undoTransition(entry, 15 * 60 * 1000, NOW + 60 * 60 * 1000))}>Undo after grace</button>
      </div>
      {res && <Note>{res.ok ? `restored to ${res.restore.to} (original entry ${res.restore.originalTransitionId})` : `denied: ${res.reason}`}</Note>}
    </div>
  );
}

/* 52371 — "Needs info" state. */
export function NeedsInfoState() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52371 · "Needs info" state</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.parkNeedsInfo(
        { ...F1, state: 'Triaged' },
        { question: 'Reproduction steps on the staging build?', requestedFrom: 'reporter' }, NOW))}>Park finding</button>
      {res && res.ok && <Note>parked in {res.to} · question: "{res.park.question}" · prior: {res.park.priorState}</Note>}
      {res && !res.ok && <Note>failed: {res.reason}</Note>}
    </div>
  );
}

/* 52372 — "Duplicate" state with link. */
export function DuplicateStateLink() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52372 · "Duplicate" state with link</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.markDuplicate(
        { ...F1, state: 'Triaged', evidence: [{ kind: 'screenshot', name: 'dup.png' }] },
        { id: 'f-100', evidence: [{ kind: 'screenshot', name: 'canon.png' }] },
        { reason: 'same XSS on reviews page' }, NOW))}>Mark duplicate</button>
      {res && res.ok && <Note>→ {res.to} of {res.duplicateOf} · evidence merged: {res.evidenceMergedCount} item(s)</Note>}
    </div>
  );
}

/* 52373 — "Won't fix" state with reason. */
export function WontFixState() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52373 · "Won't fix" state with reason</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.wontFix(
        { ...F1, state: 'Triaged' },
        { rationale: 'legacy system, sunset in Q1', approver: 'sec-lead' }, NOW))}>Won't fix</button>
      {res && res.ok && <Note>→ {res.to} · "{res.rationale}" · approved by {res.approver}</Note>}
    </div>
  );
}

/* 52374 — "Risk accepted" state. */
export function RiskAcceptedState() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52374 · "Risk accepted" state</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.riskAccepted(
        { ...F1, state: 'Triaged' },
        { owner: 'ciso', expiryAt: NOW + 90 * 24 * HOUR, compensatingControls: ['WAF rule 88', 'rate limiting'], now: NOW }, NOW))}>Accept risk</button>
      {res && res.ok && <Note>→ {res.to} · owner {res.owner} · expires in 90d · controls: {res.compensatingControls.join(', ')}</Note>}
    </div>
  );
}

/* 52375 — "Deferred" state with date. */
export function DeferredState() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52375 · "Deferred" state with date</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.deferFinding(
        { ...F1, state: 'Triaged' },
        { reopenAt: NOW + 30 * 24 * HOUR, note: 'revisit after Q1 roadmap', now: NOW }, NOW))}>Defer 30d</button>
      {res && res.ok && (() => {
        const due = LG.checkDeferredDue(res, NOW + 31 * 24 * HOUR);
        return <Note>→ {res.to} · auto-reopen {due.due ? 'DUE (31d later)' : 'not yet due'} · note: {res.note}</Note>;
      })()}
    </div>
  );
}

/* 52376 — "Blocked" state with reason. */
export function BlockedState() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52376 · "Blocked" state with reason</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.blockFinding(
        { ...F2, state: 'Triaged' },
        { dependency: 'vendor patch for lib-2.4.1', note: 'ETA from vendor: 2 weeks' }, NOW))}>Block finding</button>
      {res && res.ok && <Note>→ {res.to} · blocked on: {res.dependency}</Note>}
    </div>
  );
}

/* 52377 — "Verified" vs "Closed" distinction. */
export function VerifiedVsClosed() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52377 · "Verified" vs "Closed" distinction</h3>
      <div className="lg60-row">
        <button className="lg60-btn" onClick={() => setRes(LG.verifiedVsClosedCheck(F3, {}))}>Check f-603 (retest passed)</button>
        <button className="lg60-btn" onClick={() => setRes(LG.verifiedVsClosedCheck(F3, { summary: 'fix shipped in 2.4.2', closedBy: 'sec-lead' }))}>Check with paperwork</button>
      </div>
      {res && <Note>Verified claimable: {res.verified.claimable ? 'yes (fix works)' : 'no'} · Closed claimable: {res.closed.claimable ? 'yes (paperwork done)' : `no — missing: ${res.closed.missing.join('; ') || 'none'}`}</Note>}
    </div>
  );
}

/* 52378 — "Reopened" state. */
export function ReopenedState() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52378 · "Reopened" state</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.reopenFinding(
        { ...F1, state: 'Closed' },
        { reason: 'regression in 2.5.0', by: 'aria', originalClosure: { id: 'cl-77', closedAt: NOW - 10 * 24 * HOUR } }, NOW))}>Reopen</button>
      {res && res.ok && <Note>→ {res.to} · linked closure {res.originalClosureId} · reason: {res.reason}</Note>}
    </div>
  );
}

/* 52379 — Auto-transitions on retest. */
export function AutoTransitionOnRetest() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52379 · Auto-transitions on retest</h3>
      <div className="lg60-row">
        <button className="lg60-btn" onClick={() => setRes(LG.autoTransitionOnRetest({ ...F1, state: 'InRetest' }, { passed: true, retestId: 'rt-10' }, NOW))}>Passing retest</button>
        <button className="lg60-btn" onClick={() => setRes(LG.autoTransitionOnRetest({ ...F1, state: 'InRetest' }, { passed: false, retestId: 'rt-11' }, NOW))}>Failing retest</button>
      </div>
      {res && res.ok && <Note>auto → {res.to} · {res.reason}</Note>}
    </div>
  );
}

/* 52380 — State-transition webhooks. */
export function TransitionWebhooks() {
  const [res, setRes] = useState(null);
  return (
    <div className="lg60-card">
      <h3 className="lg60-title">52380 · State-transition webhooks</h3>
      <button className="lg60-btn" onClick={() => setRes(LG.transitionWebhookPayload(
        { findingId: F1.id, from: 'InRetest', to: 'Verified', actor: 'aria', reason: 'retest passed', at: NOW },
        [{ name: 'ticketing', url: 'https://tickets.example.com/hooks' }, { name: 'chatops', url: 'https://chat.example.com/hooks' }], NOW))}>Fire webhooks</button>
      {res && res.ok && <Note>event {res.event.event} · {res.targets} target(s) · deliveries: {res.deliveries.map((d) => d.target).join(', ')}</Note>}
    </div>
  );
}

export const LG60_GALLERY = [
  TransitionRules, RoleStatePermissions, StateAuditLog, StateChangeNotifications,
  BulkTransitions, StateSlaTimers, LifecycleDashboard, StateTimeline,
  MandatoryChangeReasons, StateUndo, NeedsInfoState, DuplicateStateLink,
  WontFixState, RiskAcceptedState, DeferredState, BlockedState,
  VerifiedVsClosed, ReopenedState, AutoTransitionOnRetest, TransitionWebhooks,
];

export function LifecycleGovernGallery() {
  return (
    <div className="lg60-gallery">
      {LG60_GALLERY.map((C, i) => <C key={i} />)}
    </div>
  );
}
