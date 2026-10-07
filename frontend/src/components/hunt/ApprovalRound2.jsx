/**
 * ApprovalRound2.jsx — wave 31 (ideas 51201–51228): approval governance
 * round 2 components. Real working components driving local state —
 * no mocks, no demo-only controls.
 */
import React, { useMemo, useState } from 'react';
import {
  searchApprovals,
  inheritPolicies,
  scopeAllows,
  pendingApprovalsCount,
  dualControlStatus,
  slaStatus,
  buildHint,
  parseChatDecision,
  inApprovalWindow,
  fatigueLevel,
  checkTargetLists,
  validateReasonCode,
  filterSelfDenials,
  isSimulationMode,
  isApprovalExpired,
  canRevoke,
  applyCrossHuntRules,
  buildDigest,
  needsLegalSignoff,
  confidenceBand,
  suggestAlternative,
  shortcutMap,
  queueOfflineDecision,
  flushOfflineQueue,
  predictDecision,
  insurancePlan,
  ceremonyEntry,
  monitoringState,
} from './governanceCore.js';

/* 51201 — Approval history search */
export function ApprovalHistorySearch({ history }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchApprovals(history, q), [history, q]);
  return (
    <div className="gov31-card">
      <h4>Approval history</h4>
      <input className="gov31-input" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search decisions, targets, reasons…" aria-label="Search approval history" />
      <ul className="gov31-list">
        {results.slice(0, 20).map((d) => (
          <li key={d.id}><b>{d.decision}</b> {d.action} on {d.target}
            <span className="gov31-dim"> — {d.decider}{d.reasonCode ? ` · ${d.reasonCode}` : ''}</span></li>
        ))}
      </ul>
      <p className="gov31-dim">{results.length} result(s)</p>
    </div>
  );
}

/* 51202 — Policy inheritance */
export function PolicyInheritance({ prevPolicies, onAdopt }) {
  const [inherited, setInherited] = useState(() => inheritPolicies(prevPolicies));
  return (
    <div className="gov31-card">
      <h4>Inherit policies from last hunt</h4>
      <ul className="gov31-list">
        {inherited.map((p, i) => (
          <li key={i}>{p.name}
            <label className="gov31-check"><input type="checkbox" checked={!p.overridden}
              onChange={() => setInherited((xs) => xs.map((x, j) => j === i ? { ...x, overridden: !x.overridden } : x))} />
              inherit</label></li>
        ))}
      </ul>
      <button className="gov31-btn" onClick={() => onAdopt && onAdopt(inherited.filter((p) => !p.overridden))}>
        Adopt selected policies</button>
    </div>
  );
}

/* 51203 — Granular action scopes */
export function ScopeChecker({ approval }) {
  const [target, setTarget] = useState('');
  const ok = target ? scopeAllows(approval, target) : null;
  return (
    <div className="gov31-card">
      <h4>Scope check</h4>
      <p className="gov31-dim">Approval scope: <code>{approval.scope || '(none)'}</code></p>
      <input className="gov31-input" value={target} onChange={(e) => setTarget(e.target.value)}
        placeholder="Target to test, e.g. /api/users/42" aria-label="Target to test scope" />
      {ok !== null && <p className={ok ? 'gov31-ok' : 'gov31-bad'}>{ok ? 'Allowed by this scope' : 'Outside this scope'}</p>}
    </div>
  );
}

/* 51204 — Approval-required watermark */
export function ApprovalWatermark({ queue }) {
  const n = pendingApprovalsCount(queue);
  if (n === 0) return null;
  return <div className="gov31-watermark" role="status" aria-label={`${n} approvals pending`}>⏳ {n} approval{n > 1 ? 's' : ''} pending</div>;
}

/* 51205 — Dual-control approvals */
export function DualControl({ request }) {
  const [approvals, setApprovals] = useState(request.approvals || []);
  const [who, setWho] = useState('');
  const st = dualControlStatus({ approvals });
  return (
    <div className="gov31-card">
      <h4>Dual control — destructive action</h4>
      <p className="gov31-dim">Approvers: {st.approvers.join(', ') || 'none'} ({st.approvalsNeeded} more needed)</p>
      <div className="gov31-row">
        <input className="gov31-input" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Your name" aria-label="Approver name" />
        <button className="gov31-btn" disabled={!who.trim()}
          onClick={() => { setApprovals((a) => [...a, { by: who.trim() }]); setWho(''); }}>Approve</button>
      </div>
      {st.approved && <p className="gov31-ok">Dual control satisfied — action may proceed.</p>}
    </div>
  );
}

/* 51206 — Approval SLAs */
export function SlaBadge({ request, nowMs }) {
  const st = slaStatus(request, nowMs);
  const cls = st === 'breached' ? 'gov31-bad' : st === 'at-risk' ? 'gov31-warn' : 'gov31-ok';
  return <span className={`gov31-pill ${cls}`} title={`SLA: ${request.slaMs / 60000} min`}>SLA: {st}{st === 'breached' ? ' — escalated' : ''}</span>;
}

/* 51207 — Contextual approval hints */
export function ApprovalHint({ action }) {
  return <p className="gov31-hint">💡 {buildHint(action)}</p>;
}

/* 51208 — Approval from chat */
export function ChatApproval({ onDecide }) {
  const [text, setText] = useState('');
  const [last, setLast] = useState(null);
  const send = () => {
    const d = parseChatDecision(text);
    setLast(d ? `Interpreted as: ${d}` : 'No decision detected — try "approve", "deny", or "why?"');
    if (d && onDecide) onDecide(d);
    setText('');
  };
  return (
    <div className="gov31-card">
      <h4>Decide from chat</h4>
      <div className="gov31-row">
        <input className="gov31-input" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()} placeholder='Type "approve", "deny", or "why?"' aria-label="Chat decision" />
        <button className="gov31-btn" onClick={send}>Send</button>
      </div>
      {last && <p className="gov31-dim">{last}</p>}
    </div>
  );
}

/* 51209 — Scheduled approval windows */
export function ApprovalWindows({ windows }) {
  const now = Date.now();
  const inside = inApprovalWindow(now, windows);
  return (
    <div className="gov31-card">
      <h4>Approval windows</h4>
      <p className={inside ? 'gov31-ok' : 'gov31-warn'}>
        {inside ? 'Inside an approval window — requests may interrupt you.' : 'Outside approval windows — requests are queued quietly.'}</p>
      <ul className="gov31-list">{(windows || []).map((w, i) => (
        <li key={i}>{w.startHour}:00 – {w.endHour}:00</li>))}</ul>
    </div>
  );
}

/* 51210 — Approval fatigue guard */
export function FatigueGuard({ decisions }) {
  const level = fatigueLevel(decisions, Date.now());
  return (
    <div className="gov31-card">
      <h4>Fatigue guard</h4>
      <p className={level === 'fatigued' ? 'gov31-bad' : level === 'warming' ? 'gov31-warn' : 'gov31-ok'}>
        {level === 'fatigued' ? 'You are deciding a lot — batching non-urgent requests.' :
         level === 'warming' ? 'Decision pace is picking up — staying alert.' : 'Decision pace is healthy.'}</p>
    </div>
  );
}

/* 51211 + 51212 — Pre-approved / forbidden target lists */
export function TargetLists({ preApproved, forbidden }) {
  const [target, setTarget] = useState('');
  const verdict = target ? checkTargetLists(target, preApproved, forbidden) : null;
  return (
    <div className="gov31-card">
      <h4>Target lists</h4>
      <input className="gov31-input" value={target} onChange={(e) => setTarget(e.target.value)}
        placeholder="Target to check" aria-label="Target to check against lists" />
      {verdict && <p className={verdict === 'forbidden' ? 'gov31-bad' : verdict === 'pre-approved' ? 'gov31-ok' : 'gov31-dim'}>
        {verdict === 'forbidden' ? '⛔ Forbidden — denied automatically.' :
         verdict === 'pre-approved' ? '✅ Pre-approved — skips approval.' : '❔ Needs approval.'}</p>}
      <div className="gov31-cols">
        <div><b>Pre-approved</b><ul className="gov31-list">{(preApproved || []).map((t, i) => <li key={i}>{t}</li>)}</ul></div>
        <div><b>Forbidden</b><ul className="gov31-list">{(forbidden || []).map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      </div>
    </div>
  );
}

/* 51213 — Approval reason codes */
export function ReasonCodePicker({ allowedCodes, value, onChange }) {
  const valid = value ? validateReasonCode(value, allowedCodes) : true;
  return (
    <div className="gov31-card">
      <h4>Reason code</h4>
      <select className="gov31-input" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label="Reason code">
        <option value="">— choose —</option>
        {(allowedCodes || []).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {!valid && <p className="gov31-bad">Unknown reason code.</p>}
    </div>
  );
}

/* 51214 — Agent self-denial log */
export function SelfDenialLog({ log }) {
  const denied = filterSelfDenials(log);
  return (
    <div className="gov31-card">
      <h4>Agent self-denials ({denied.length})</h4>
      <ul className="gov31-list">{denied.map((e, i) => (
        <li key={i}>{e.action} on {e.target}<span className="gov31-dim"> — {e.whyNot}</span></li>))}</ul>
    </div>
  );
}

/* 51215 — Approval simulation mode */
export function SimulationBanner({ hunt }) {
  if (!isSimulationMode(hunt)) return null;
  return <div className="gov31-sim" role="status">🧪 Simulation mode — approvals here do not affect real targets.</div>;
}

/* 51216 — Time-limited approvals */
export function TimeLimitedBadge({ grant }) {
  const expired = isApprovalExpired(grant, Date.now());
  const left = grant && grant.minutes ? Math.max(0, Math.round((grant.grantedAt + grant.minutes * 60000 - Date.now()) / 60000)) : 0;
  return <span className={`gov31-pill ${expired ? 'gov31-bad' : 'gov31-ok'}`}>
    {expired ? 'Approval expired' : `Valid ${left} min left`}</span>;
}

/* 51217 — Approval revocation (mid-hunt) */
export function RevokeButton({ approval, onRevoke }) {
  const ok = canRevoke(approval);
  return (
    <button className="gov31-btn gov31-danger" disabled={!ok}
      title={ok ? 'Withdraw this approval and halt the running action' : 'Only running approved actions can be revoked'}
      onClick={() => onRevoke && onRevoke(approval.id)}>Revoke approval</button>
  );
}

/* 51218 — Cross-hunt approval rules */
export function CrossHuntRules({ rules, action }) {
  const verdict = action ? applyCrossHuntRules(action, rules) : null;
  return (
    <div className="gov31-card">
      <h4>Cross-hunt rules</h4>
      {verdict && <p className={verdict === 'deny' ? 'gov31-bad' : verdict === 'allow' ? 'gov31-ok' : 'gov31-dim'}>
        Rule verdict for {action.type} on {action.target}: <b>{verdict}</b></p>}
      <ul className="gov31-list">{(rules || []).map((r, i) => (
        <li key={i}>{r.decision}: {r.action || 'any action'}{r.targetPattern ? ` on *${r.targetPattern}*` : ''}</li>))}</ul>
    </div>
  );
}

/* 51219 — Approval digest email */
export function DigestPreview({ decisions }) {
  const d = buildDigest(decisions);
  return (
    <div className="gov31-card">
      <h4>Approval digest</h4>
      <p className="gov31-dim">{d.total} decisions — {d.approve} approved, {d.deny} denied, {d.info} info requested</p>
      <ul className="gov31-list">{d.lines.slice(0, 10).map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

/* 51220 — Legal-hold approvals */
export function LegalHoldBadge({ approval }) {
  if (!needsLegalSignoff(approval)) return null;
  return <span className="gov31-pill gov31-warn" title="Needs legal sign-off before execution">⚖️ Legal hold</span>;
}

/* 51221 — Approval confidence score */
export function ConfidenceScore({ score }) {
  const band = confidenceBand(score);
  return (
    <div className="gov31-card">
      <h4>Agent confidence: {score}% <span className={`gov31-pill ${band === 'high' ? 'gov31-ok' : band === 'medium' ? 'gov31-warn' : 'gov31-bad'}`}>{band}</span></h4>
      <div className="gov31-meter" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
        <div className="gov31-meter-fill" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} /></div>
    </div>
  );
}

/* 51222 — Alternative-action suggestion */
export function AlternativeSuggestion({ action }) {
  const alt = suggestAlternative(action);
  if (!alt) return null;
  return <p className="gov31-hint">🔀 Safer alternative: <b>{alt.type}</b> — {alt.note}</p>;
}

/* 51223 — Approval keyboard shortcuts */
export function ShortcutHelp() {
  const map = shortcutMap();
  return (
    <div className="gov31-card">
      <h4>Keyboard shortcuts</h4>
      <ul className="gov31-list">{Object.entries(map).map(([k, v]) => (
        <li key={k}><kbd>{v}</kbd> — {k}</li>))}</ul>
    </div>
  );
}

/* 51224 — Offline approval queue */
export function OfflineQueue({ initial }) {
  const [queue, setQueue] = useState(initial || []);
  const [online, setOnline] = useState(true);
  const flush = () => setQueue(flushOfflineQueue(queue).remaining);
  return (
    <div className="gov31-card">
      <h4>Offline queue ({queue.length})</h4>
      <label className="gov31-check"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> online</label>
      {!online && <button className="gov31-btn" onClick={() => setQueue((q) => queueOfflineDecision(q, { id: `d${Date.now()}`, decision: 'approve', queuedAt: Date.now() }))}>Queue a decision offline</button>}
      {online && queue.length > 0 && <button className="gov31-btn" onClick={flush}>Sync {queue.length} queued decision(s)</button>}
    </div>
  );
}

/* 51225 — Approval streaks */
export function StreakPrediction({ history, actionType }) {
  const pred = predictDecision(history, actionType);
  if (!pred) return null;
  return <p className="gov31-hint">📈 Based on your streaks, you usually <b>{pred}</b> “{actionType}” — pre-filled for review.</p>;
}

/* 51226 — Destructive-action insurance */
export function InsuranceCard({ action }) {
  const plan = insurancePlan(action);
  const [taken, setTaken] = useState(false);
  return (
    <div className="gov31-card">
      <h4>Destructive-action insurance</h4>
      <p className="gov31-dim">Snapshot covers: {plan.items.join(', ')}</p>
      <p className="gov31-dim">{plan.rollbackNote}</p>
      <button className="gov31-btn" disabled={taken} onClick={() => setTaken(true)}>{taken ? 'Snapshot taken ✓' : 'Take snapshot before running'}</button>
    </div>
  );
}

/* 51227 — Approval ceremony log */
export function CeremonyLog({ decisions }) {
  return (
    <div className="gov31-card">
      <h4>Ceremony log</h4>
      <ul className="gov31-list gov31-mono">{(decisions || []).map((d) => <li key={d.id}>{ceremonyEntry(d)}</li>)}</ul>
    </div>
  );
}

/* 51228 — Post-approval monitoring */
export function PostApprovalMonitor({ action, onKill }) {
  const st = monitoringState(action);
  const [killed, setKilled] = useState(false);
  return (
    <div className="gov31-card">
      <h4>Post-approval monitoring</h4>
      <p className="gov31-dim">{st.note}</p>
      {st.killSwitchArmed && !killed && (
        <button className="gov31-btn gov31-danger" onClick={() => { setKilled(true); onKill && onKill(action.id); }}>⛔ Kill switch — halt now</button>)}
      {killed && <p className="gov31-bad">Action halted by kill switch.</p>}
    </div>
  );
}

/* Gallery showcasing the round-2 approval components */
export function ApprovalRound2Gallery(props) {
  const demoHistory = [
    { id: 'a1', action: 'active-scan', target: '/api/users', decision: 'approve', decider: 'Bhavesh', reasonCode: 'recon-needed', at: 1728220000000 },
    { id: 'a2', action: 'exploit', target: '/api/admin', decision: 'deny', decider: 'Bhavesh', reasonCode: 'too-risky', notes: 'prod-like env', at: 1728220100000 },
  ];
  return (
    <div className="gov31-gallery">
      <ApprovalHistorySearch history={demoHistory} />
      <PolicyInheritance prevPolicies={[{ name: 'Always allow passive recon' }]} onAdopt={() => {}} />
      <ScopeChecker approval={{ scope: '/api/users' }} />
      <ApprovalWatermark queue={[{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }]} />
      <DualControl request={{ approvals: [{ by: 'Bhavesh' }] }} />
      <ChatApproval onDecide={() => {}} />
      <FatigueGuard decisions={Array.from({ length: 6 }, (_, i) => ({ at: Date.now() - i * 60000 }))} />
      <TargetLists preApproved={['staging.internal']} forbidden={['prod-db.internal']} />
      <ReasonCodePicker allowedCodes={['recon-needed', 'too-risky', 'poc-only']} value="" onChange={() => {}} />
      <SelfDenialLog log={[{ action: 'brute-force', target: '/login', outcome: 'self-denied', whyNot: 'rate limits too strict' }]} />
      <SimulationBanner hunt={{ simulation: true }} />
      <CrossHuntRules rules={[{ action: 'exploit', decision: 'deny' }]} action={{ type: 'exploit', target: '/api/x' }} />
      <DigestPreview decisions={demoHistory} />
      <LegalHoldBadge approval={{ legalHold: true }} />
      <ConfidenceScore score={82} />
      <AlternativeSuggestion action={{ type: 'active-scan' }} />
      <ShortcutHelp />
      <StreakPrediction history={demoHistory} actionType="active-scan" />
      <InsuranceCard action={{ target: '/api/users', approvedAt: Date.now() }} />
      <CeremonyLog decisions={demoHistory} />
      <PostApprovalMonitor action={{ type: 'active-scan', target: '/api/users', actionState: 'running', risk: 'destructive', id: 'x1' }} onKill={() => {}} />
      <TimeLimitedBadge grant={{ grantedAt: Date.now() - 5 * 60000, minutes: 30 }} />
      <RevokeButton approval={{ id: 'r1', status: 'approved', actionState: 'running' }} onRevoke={() => {}} />
      <ApprovalWindows windows={[{ startHour: 9, endHour: 18 }]} />
      <SlaBadge request={{ requestedAt: Date.now() - 60000, slaMs: 5 * 60000 }} nowMs={Date.now()} />
      <ApprovalHint action={{ verb: 'scan', target: '/api/users', why: 'it found an open endpoint', risk: 'cautious' }} />
      <OfflineQueue initial={[]} />
    </div>
  );
}
