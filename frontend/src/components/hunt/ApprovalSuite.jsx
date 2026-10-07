/**
 * ApprovalSuite.jsx — wave 30 (ideas 51173–51200): approval/governance
 * suite — inline cards, risk labels, detail drawer, one-tap decisions,
 * bulk queue, timeouts, limits, standing rules, delegation, step-up auth,
 * audit trail, countdowns, graceful waiting, templates, sandbox preview,
 * reversible badges, mobile, voice, expiry, more-info, analytics,
 * deny-all, chat threads, side-effect estimates, rollback plans,
 * notifications, quiet batching.
 *
 * Real working components driving local state. No mocks.
 */
import { useMemo, useState } from 'react';
import {
  RISK_LEVELS, APPROVAL_TEMPLATES,
  toApprovalCard, riskLabel, approvalDetail, decideApproval,
  bulkDecide, applyApprovalTimeouts, approveWithLimits,
  addStandingRule, checkStandingRules, delegateApprovals, stepUpAuthorized,
  auditApproval, pendingCountdowns, gracefulWaitTasks, applyApprovalTemplate,
  sandboxPreview, reversibleBadge, mobileApprovalPayload, parseVoiceApproval,
  approvalScopeNote, requestMoreInfo, approvalAnalytics, emergencyDenyAll,
  approvalChatThread, estimateSideEffects, rollbackPlan,
  approvalNotifications, batchApprovals,
} from './governCore.js';

const SAMPLE = [
  { id: 'a1', title: 'Run nuclei scan on api.a.com', risk: 'cautious', requestedAt: 1000, targets: ['api.a.com'], reversible: true, category: 'scan' },
  { id: 'a2', title: 'POST fuzzing on /checkout', risk: 'destructive', requestedAt: 2000, targets: ['a.com/checkout'], reversible: false, category: 'fuzz' },
  { id: 'a3', title: 'Subdomain enumeration', risk: 'safe', requestedAt: 3000, targets: ['a.com'], reversible: true, category: 'recon' },
];

/* 51173 + 51174 + 51176 — inline approval cards with risk labels + one-tap */
export function ApprovalCard({ card, onDecide }) {
  const [expanded, setExpanded] = useState(false);
  const detail = approvalDetail(card);
  const badge = reversibleBadge(card);
  return (
    <div className={`gov30-approval gov30-risk-${riskLabel(card.risk)}`}>
      <div className="gov30-row">
        <span className="gov30-risk">{riskLabel(card.risk)}</span>
        <strong>{card.title}</strong>
        <span className={`gov30-badge-${badge.tone}`}>{badge.text}</span>
        <span className="gov30-dim">{card.status}</span>
      </div>
      <div className="gov30-row">
        <button onClick={() => setExpanded((e) => !e)}>{expanded ? 'Hide detail' : 'Detail'}</button>
        {card.status === 'pending' && (
          <>
            <button className="gov30-approve" onClick={() => onDecide(card.id, 'approved')}>Approve</button>
            <button className="gov30-deny" onClick={() => onDecide(card.id, 'denied')}>Deny</button>
          </>
        )}
      </div>
      {expanded && (
        <div className="gov30-note">
          <p>Targets: {detail.targets.join(', ') || '—'}</p>
          <p>Side effects: {detail.expectedSideEffects.join('; ') || '—'}</p>
        </div>
      )}
    </div>
  );
}

/* 51177 — bulk approval queue */
export function BulkApprovalQueue({ initial = SAMPLE }) {
  const [cards, setCards] = useState(initial.map(toApprovalCard));
  const [stats, setStats] = useState(null);
  const decide = (id, d) => setCards((cs) => cs.map((c) => (c.id === id ? decideApproval(c, d, 'you') : c)));
  const bulk = (d) => {
    const r = bulkDecide(cards, Object.fromEntries(cards.map((c) => [c.id, d])));
    setCards(r.cards);
    setStats({ approved: r.approved, denied: r.denied, remaining: r.remaining });
  };
  return (
    <div className="gov30-card">
      <h4>Bulk approval queue</h4>
      <div className="gov30-row">
        <button onClick={() => bulk('approved')}>Approve all pending</button>
        <button onClick={() => bulk('denied')}>Deny all pending</button>
      </div>
      {stats && <p className="gov30-note">Approved {stats.approved}, denied {stats.denied}, remaining {stats.remaining}</p>}
      {cards.map((c) => <ApprovalCard key={c.id} card={c} onDecide={decide} />)}
    </div>
  );
}

/* 51178 + 51185 — approval timeouts + pending countdowns */
export function TimeoutPanel({ initial = SAMPLE }) {
  const [cards, setCards] = useState(initial.map(toApprovalCard));
  const apply = () => setCards((cs) => applyApprovalTimeouts(cs, 600000, 120000, 'auto-deny'));
  const counts = pendingCountdowns(cards, 600000, { a1: 'enumerating subdomains' });
  return (
    <div className="gov30-card">
      <h4>Approval timeouts & countdowns</h4>
      <button onClick={apply}>Apply 2-min timeout at t=10min</button>
      <ul className="gov30-list">
        {counts.map((c) => <li key={c.id}>{c.id}: waited {Math.round(c.waitedMs / 1000)}s — agent: {c.agentMeanwhile}</li>)}
      </ul>
      <ul className="gov30-list">{cards.map((c) => <li key={c.id}>{c.id}: {c.status}</li>)}</ul>
    </div>
  );
}

/* 51179 — approve with limits */
export function ApproveWithLimitsDemo() {
  const [card, setCard] = useState(toApprovalCard(SAMPLE[1]));
  return (
    <div className="gov30-card">
      <h4>Approve with limits</h4>
      <button onClick={() => setCard((c) => approveWithLimits(c, { scope: ['a.com/checkout'], maxRps: 5, durationMinutes: 10 }))}>Approve capped</button>
      {card.limits && <p className="gov30-note">Limits: scope {card.limits.scope.join(', ')}, {card.limits.maxRps} rps, {card.limits.durationMinutes} min</p>}
      <p className="gov30-dim">Status: {card.status}</p>
    </div>
  );
}

/* 51180 + 51181 — standing rules */
export function StandingRules() {
  const [rules, setRules] = useState([]);
  const [kind, setKind] = useState('allow');
  const [cat, setCat] = useState('');
  return (
    <div className="gov30-card">
      <h4>Always-allow / always-deny rules</h4>
      <div className="gov30-row">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Rule kind">
          <option value="allow">allow</option><option value="deny">deny</option>
        </select>
        <input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="category" aria-label="Category" />
        <button onClick={() => { setRules((r) => addStandingRule(r, kind, cat)); setCat(''); }}>Add rule</button>
      </div>
      <ul className="gov30-list">{rules.map((r, i) => <li key={i}>{r.kind}: {r.category} ({r.scope})</li>)}</ul>
      <p className="gov30-note">Check "fuzz": {checkStandingRules(rules, 'fuzz') || 'no rule'}</p>
    </div>
  );
}

/* 51182 + 51183 — delegation + step-up auth */
export function DelegationStepUp() {
  const [delegations, setDelegations] = useState({});
  const card = toApprovalCard(SAMPLE[1]);
  return (
    <div className="gov30-card">
      <h4>Delegation & step-up auth</h4>
      <button onClick={() => setDelegations((d) => delegateApprovals(d, 'fuzz', 'teammate-2'))}>Delegate fuzz → teammate-2</button>
      <p className="gov30-note">Delegations: {JSON.stringify(delegations)}</p>
      <p className="gov30-note">Destructive card authorized with 1 factor: {String(stepUpAuthorized(card, ['password']))} · with 2: {String(stepUpAuthorized(card, ['password', 'totp']))}</p>
    </div>
  );
}

/* 51184 — audit trail */
export function AuditTrailView() {
  const [trail, setTrail] = useState([]);
  return (
    <div className="gov30-card">
      <h4>Approval audit trail</h4>
      <button onClick={() => setTrail((t) => auditApproval(t, { who: 'you', decision: 'approved', cardId: 'a1', context: 'low risk scan' }))}>Log approval</button>
      <ul className="gov30-list">{trail.map((e) => <li key={e.seq}>#{e.seq} {e.who} {e.decision} {e.cardId} — {e.context}</li>)}</ul>
    </div>
  );
}

/* 51186 + 51187 — graceful wait + templates */
export function WaitAndTemplates() {
  const tasks = useMemo(() => gracefulWaitTasks([
    { id: 't1', label: 'Parse sitemap', safe: true },
    { id: 't2', label: 'POST fuzz', safe: false, needsApproval: true },
    { id: 't3', label: 'Review headers', safe: true },
  ]), []);
  const [tpl, setTpl] = useState(null);
  return (
    <div className="gov30-card">
      <h4>Graceful waiting & templates</h4>
      <p className="gov30-note">Safe background tasks: {tasks.map((t) => t.label).join(', ')}</p>
      <div className="gov30-row">
        {APPROVAL_TEMPLATES.map((t) => <button key={t} onClick={() => setTpl(applyApprovalTemplate(t))}>{t}</button>)}
      </div>
      {tpl && <p className="gov30-note">{tpl.name}: auto-allow {tpl.autoAllow.join(', ') || 'none'}, timeout {tpl.timeoutMs / 1000}s → {tpl.timeoutAction}</p>}
    </div>
  );
}

/* 51188 + 51197 + 51198 — sandbox preview, side effects, rollback */
export function DestructivePreview() {
  const action = { id: 'a2', risk: 'destructive', targets: ['a.com/checkout'], estimatedRps: 20, estimatedSeconds: 60, reversible: false, writesData: true };
  const preview = sandboxPreview(action);
  return (
    <div className="gov30-card gov30-danger">
      <h4>Destructive preview</h4>
      <p className="gov30-note">Simulated: ~{preview.estimatedRequests} requests on {preview.targetsAffected} target(s). {preview.warning}</p>
      <p className="gov30-note">Side effects: {estimateSideEffects(action).join('; ')}</p>
      <p className="gov30-note">Rollback: {rollbackPlan(action).note}</p>
    </div>
  );
}

/* 51190 + 51191 — mobile + voice */
export function MobileVoice() {
  const card = toApprovalCard(SAMPLE[0]);
  const mobile = mobileApprovalPayload(card);
  const [said, setSaid] = useState('');
  return (
    <div className="gov30-card">
      <h4>Mobile & voice approvals</h4>
      <p className="gov30-note">Mobile payload: full context = {String(mobile.fullContext)} (channel: {mobile.channel})</p>
      <div className="gov30-row">
        <input value={said} onChange={(e) => setSaid(e.target.value)} placeholder='say "approved"' aria-label="Voice transcript" />
        <span className="gov30-note">→ {parseVoiceApproval(said, true) || 'no decision (needs verification)'}</span>
      </div>
      <p className="gov30-dim">{approvalScopeNote(card)}</p>
    </div>
  );
}

/* 51193 + 51196 — more-info + chat thread */
export function ApprovalDiscussion() {
  const [card, setCard] = useState(toApprovalCard(SAMPLE[1]));
  const [thread, setThread] = useState([]);
  const [msg, setMsg] = useState('');
  return (
    <div className="gov30-card">
      <h4>Approval discussion</h4>
      <div className="gov30-row">
        <button onClick={() => setCard((c) => requestMoreInfo(c, 'Why is POST fuzzing needed here?'))}>Request more info</button>
        <span className="gov30-dim">{card.status}{card.infoQuestion ? `: ${card.infoQuestion}` : ''}</span>
      </div>
      <div className="gov30-row">
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="discuss with agent" aria-label="Chat message" />
        <button onClick={() => { setThread((t) => approvalChatThread(t, 'you', msg)); setMsg(''); }}>Send</button>
      </div>
      <ul className="gov30-list">{thread.map((m, i) => <li key={i}><b>{m.author}:</b> {m.message}</li>)}</ul>
    </div>
  );
}

/* 51194 + 51199 + 51200 — analytics, notifications, quiet batching */
export function AnalyticsNotifyBatch() {
  const analytics = useMemo(() => approvalAnalytics([
    { category: 'recon', decision: 'approved' }, { category: 'recon', decision: 'approved' },
    { category: 'recon', decision: 'approved' }, { category: 'fuzz', decision: 'denied' },
    { category: 'fuzz', decision: 'denied' }, { category: 'fuzz', decision: 'denied' },
  ]), []);
  const cards = SAMPLE.map(toApprovalCard);
  const batched = batchApprovals(cards);
  const notifs = approvalNotifications(toApprovalCard(SAMPLE[1]), ['push', 'email']);
  return (
    <div className="gov30-card">
      <h4>Analytics, notifications, batching</h4>
      <ul className="gov30-list">{analytics.map((a) => <li key={a.category}>{a.category}: {a.approvalRate * 100}% approve → {a.suggestion}</li>)}</ul>
      <p className="gov30-note">Notifications queued: {notifs.map((n) => n.channel).join(', ')}</p>
      <p className="gov30-note">Interrupt now: {batched.interruptNow.length} · digest: {batched.digest.length}</p>
    </div>
  );
}

/* 51195 — emergency deny-all */
export function EmergencyDenyAll({ initial = SAMPLE }) {
  const [state, setState] = useState({ cards: initial.map(toApprovalCard), huntPaused: false });
  return (
    <div className="gov30-card gov30-danger">
      <h4>Emergency deny-all</h4>
      <button onClick={() => setState(emergencyDenyAll(state.cards))}>Deny all & pause hunt</button>
      <p className="gov30-note">Hunt paused: {String(state.huntPaused)} · pending left: {state.cards.filter((c) => c.status === 'pending').length}</p>
    </div>
  );
}

/* Gallery */
export function ApprovalSuiteGallery() {
  return (
    <div className="gov30-gallery">
      <h3>Approval / governance suite — gallery</h3>
      <BulkApprovalQueue />
      <TimeoutPanel />
      <ApproveWithLimitsDemo />
      <StandingRules />
      <DelegationStepUp />
      <AuditTrailView />
      <WaitAndTemplates />
      <DestructivePreview />
      <MobileVoice />
      <ApprovalDiscussion />
      <AnalyticsNotifyBatch />
      <EmergencyDenyAll />
    </div>
  );
}
