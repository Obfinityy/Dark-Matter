/**
 * LifecycleSync.jsx — Infinity AI · Dark-Matter · Wave 60
 * 20 working React components for lifecycle integrations & intelligence, ideas 52381–52400.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as LS from './lifecycleSyncCore.js';

const NOW = 1700000000000;
const DAY = 24 * 3600000;

const F = [
  {
    id: 'f-611',
    state: 'Triaged',
    severity: 'high',
    stateEnteredAt: NOW - 10 * DAY,
    openedAt: NOW - 12 * DAY,
    vulnClass: 'xss',
  },
  {
    id: 'f-612',
    state: 'InRetest',
    severity: 'medium',
    stateEnteredAt: NOW - 2 * DAY,
    openedAt: NOW - 20 * DAY,
    vulnClass: 'idor',
    evidence: [{ kind: 'fix', name: 'p.diff' }],
    retest: { passed: true },
  },
  {
    id: 'f-613',
    state: 'Closed',
    severity: 'low',
    stateEnteredAt: NOW - 1 * DAY,
    openedAt: NOW - 40 * DAY,
    vulnClass: 'xss',
  },
  {
    id: 'f-614',
    state: 'Blocked',
    severity: 'critical',
    stateEnteredAt: NOW - 20 * DAY,
    openedAt: NOW - 25 * DAY,
    vulnClass: 'sqli',
  },
];

const HIST = [
  {
    id: 'f-701',
    severity: 'high',
    vulnClass: 'xss',
    openedAt: NOW - 60 * DAY,
    closedAt: NOW - 50 * DAY,
  },
  {
    id: 'f-702',
    severity: 'high',
    vulnClass: 'xss',
    openedAt: NOW - 45 * DAY,
    closedAt: NOW - 30 * DAY,
  },
  {
    id: 'f-703',
    severity: 'medium',
    vulnClass: 'idor',
    openedAt: NOW - 50 * DAY,
    closedAt: NOW - 40 * DAY,
  },
];

function Note({ children }) {
  return <p className="ls60-note">{children}</p>;
}

function Mono({ children }) {
  return <pre className="ls60-mono">{children}</pre>;
}

/* 52381 — Lifecycle API (post-hunt). */
export function LifecycleApi() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52381 · Lifecycle API (post-hunt)</h3>
      <button className="ls60-btn" onClick={() => setRes(LS.lifecycleApiRoutes())}>
        List routes
      </button>
      {res && (
        <Note>
          {res.count} routes under {res.base}
        </Note>
      )}
      {res && (
        <Mono>
          {res.routes
            .slice(0, 5)
            .map(r => `${r.method} ${r.path}`)
            .join('\n')}
        </Mono>
      )}
    </div>
  );
}

/* 52382 — State-based smart views. */
export function SmartViews() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52382 · State-based smart views</h3>
      <button className="ls60-btn" onClick={() => setRes(LS.runSmartViews(F, NOW))}>
        Run smart views
      </button>
      {res && <Note>{res.views.map(v => `${v.title} (${v.count})`).join(' · ')}</Note>}
    </div>
  );
}

/* 52383 — State-based email rules. */
export function StateEmailRules() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52383 · State-based email rules</h3>
      <div className="ls60-row">
        <button
          className="ls60-btn"
          onClick={() =>
            setRes(
              LS.stateEmailRule({
                name: 'verified digest',
                onEnter: ['Verified'],
                recipients: ['team'],
                schedule: 'daily',
              })
            )
          }
        >
          Build rule
        </button>
        <button className="ls60-btn" onClick={() => setRes(LS.defaultEmailRules())}>
          Defaults
        </button>
      </div>
      {res && res.rule && (
        <Note>
          rule "{res.rule.name}": {res.rule.schedule} → {res.rule.recipients.join(', ')}
        </Note>
      )}
      {res && res.rules && (
        <Note>
          {res.rules.length} default rules: {res.rules.map(r => r.name).join(', ')}
        </Note>
      )}
    </div>
  );
}

/* 52384 — State-based export filters. */
export function StateExportFilters() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52384 · State-based export filters</h3>
      <button
        className="ls60-btn"
        onClick={() => {
          const r = LS.stateExportFilter(['Verified', 'Closed']);
          setRes({
            filter: r.filter,
            matches: r.ok ? F.filter(r.filter.predicate).map(f => f.id) : [],
          });
        }}
      >
        Export Verified+Closed
      </button>
      {res && res.filter && (
        <Note>
          filter on [{res.filter.states.join(', ')}] · matches: {res.matches.join(', ') || 'none'} ·
          columns: {res.filter.columns.length}
        </Note>
      )}
    </div>
  );
}

/* 52385 — State aging reports. */
export function StateAgingReports() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52385 · State aging reports</h3>
      <button className="ls60-btn" onClick={() => setRes(LS.stateAgingReport(F, NOW))}>
        Build report
      </button>
      {res && (
        <Note>
          bottleneck: {res.bottleneck || 'none'} ·{' '}
          {res.perState
            .filter(p => p.count > 0)
            .map(p => `${p.state}: avg ${(p.avgAgeMs / DAY).toFixed(1)}d`)
            .join(' · ')}
        </Note>
      )}
    </div>
  );
}

/* 52386 — Stuck-in-state alerts. */
export function StuckInStateAlerts() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52386 · Stuck-in-state alerts</h3>
      <button className="ls60-btn" onClick={() => setRes(LS.stuckAlerts(F, NOW))}>
        Evaluate alerts
      </button>
      {res && (
        <Note>
          {res.count} alert(s) · escalated to manager: {res.escalatedToManager}
        </Note>
      )}
      {res && res.alerts.length > 0 && (
        <Mono>
          {res.alerts.map(a => `${a.findingId} in ${a.state} → ${a.escalation}`).join('\n')}
        </Mono>
      )}
    </div>
  );
}

/* 52387 — Transition approval gates. */
export function TransitionApprovalGates() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52387 · Transition approval gates</h3>
      <div className="ls60-row">
        <button
          className="ls60-btn"
          onClick={() => setRes(LS.transitionApprovalGates(F[3], 'Blocked', 'Closed'))}
        >
          Close critical f-614
        </button>
        <button
          className="ls60-btn"
          onClick={() => setRes(LS.transitionApprovalGates(F[0], 'Triaged', 'InProgress'))}
        >
          Move f-611
        </button>
      </div>
      {res && (
        <Note>
          {res.required
            ? `APPROVAL REQUIRED — ${res.gates.map(g => `${g.gate} (${g.approverRole})`).join(', ')}`
            : 'no gates — transition may proceed'}
        </Note>
      )}
    </div>
  );
}

/* 52388 — State history export. */
export function StateHistoryExport() {
  const [res, setRes] = useState(null);
  const log = [
    {
      id: 'a1',
      findingId: 'f-611',
      actor: 'aria',
      from: 'New',
      to: 'Triaged',
      reason: 'triage',
      at: NOW,
    },
    {
      id: 'a2',
      findingId: 'f-611',
      actor: 'bhavesh',
      from: 'Triaged',
      to: 'InProgress',
      reason: 'assigned',
      at: NOW + DAY,
    },
  ];
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52388 · State history export</h3>
      <div className="ls60-row">
        <button className="ls60-btn" onClick={() => setRes(LS.stateHistoryExport(log, 'csv'))}>
          CSV
        </button>
        <button className="ls60-btn" onClick={() => setRes(LS.stateHistoryExport(log, 'markdown'))}>
          Markdown
        </button>
      </div>
      {res && (
        <Note>
          {res.format}: {res.rows} row(s)
        </Note>
      )}
      {res && <Mono>{String(res.export).split('\n').slice(0, 3).join('\n')}</Mono>}
    </div>
  );
}

/* 52389 — State analytics. */
export function StateAnalytics() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52389 · State analytics</h3>
      <button className="ls60-btn" onClick={() => setRes(LS.funnelAnalytics(F, []))}>
        Compute funnel
      </button>
      {res && (
        <Note>
          total {res.total} · verified {res.funnel.verified} · closed {res.funnel.closed} · never
          triaged {res.dropOff.neverTriaged} · stuck pre-verify {res.dropOff.stuckPreVerify}
        </Note>
      )}
    </div>
  );
}

/* 52390 — Per-severity state rules. */
export function SeverityStateRules() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52390 · Per-severity state rules</h3>
      <button
        className="ls60-btn"
        onClick={() =>
          setRes({
            rules: LS.severityStateRules('critical').rules,
            sla: LS.severitySlaMs('critical', 'New'),
          })
        }
      >
        Critical rules
      </button>
      {res && (
        <Note>
          gates: {res.rules.approvalGates.join(', ') || 'none'} · New SLA {res.sla.slaMs / 3600000}h
          · escalates to {res.rules.escalateTo}
        </Note>
      )}
    </div>
  );
}

/* 52391 — Terminal-state configuration. */
export function TerminalStateConfig() {
  const res = LS.terminalStatesConfig();
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52391 · Terminal-state configuration</h3>
      <Note>
        terminal ({res.terminal.length}): {res.terminal.join(', ')}
      </Note>
      <Note>
        active ({res.active.length}): {res.active.join(', ')}
      </Note>
      <Note>
        is Closed terminal? {res.isTerminal('Closed') ? 'yes' : 'no'} · is Reopened terminal?{' '}
        {res.isTerminal('Reopened') ? 'yes' : 'no'}
      </Note>
    </div>
  );
}

/* 52392 — AI-suggested next state. */
export function SuggestedNextState() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52392 · AI-suggested next state</h3>
      <button className="ls60-btn" onClick={() => setRes(LS.suggestNextState(F[1], []))}>
        Suggest for f-612
      </button>
      {res && res.ok && (
        <Note>
          top suggestion:{' '}
          {res.suggestions[0]
            ? `${res.suggestions[0].state} (${Math.round(res.suggestions[0].confidence * 100)}%) — ${res.suggestions[0].reason}`
            : 'none'}
        </Note>
      )}
    </div>
  );
}

/* 52393 — State-transition checklists. */
export function TransitionChecklists() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52393 · State-transition checklists</h3>
      <button
        className="ls60-btn"
        onClick={() => setRes(LS.evaluateChecklist(F[1], 'InRetest', 'Verified'))}
      >
        Check f-612 → Verified
      </button>
      {res && (
        <Note>{res.allSatisfied ? 'all checks pass' : `missing: ${res.missing.join('; ')}`}</Note>
      )}
      {res && (
        <Mono>{res.checks.map(c => `${c.satisfied ? '[x]' : '[ ]'} ${c.check}`).join('\n')}</Mono>
      )}
    </div>
  );
}

/* 52394 — State-gated actions. */
export function StateGatedActions() {
  const [action, setAction] = useState('mark-verified');
  const res = LS.gatedActions(F[0], action);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52394 · State-gated actions</h3>
      <div className="ls60-row">
        {['mark-verified', 'close', 'archive'].map(a => (
          <button key={a} className="ls60-chip" onClick={() => setAction(a)}>
            {a}
            {a === action ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <Note>
        f-611 {action}: {res.allowed ? 'ALLOWED' : `BLOCKED — missing: ${res.missing.join('; ')}`}
      </Note>
    </div>
  );
}

/* 52395 — State change mobile approval. */
export function MobileApproval() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52395 · State change mobile approval</h3>
      <button
        className="ls60-btn"
        onClick={() =>
          setRes(
            LS.mobileApprovalPayload(
              {
                findingId: 'f-614',
                findingTitle: 'SQLi in search',
                severity: 'critical',
                from: 'Blocked',
                to: 'Closed',
                reason: 'vendor patch verified',
                gates: [{ gate: 'severity-closure', approverRole: 'manager' }],
                stateAgeMs: 20 * DAY,
              },
              { requestedBy: 'aria', expiresAt: NOW + 2 * DAY }
            )
          )
        }
      >
        Build payload
      </button>
      {res && res.ok && (
        <Note>
          approval {res.payload.approvalId} · deep link {res.payload.deepLink} · actions:{' '}
          {res.payload.actions.join('/')}
        </Note>
      )}
    </div>
  );
}

/* 52396 — Lifecycle documentation. */
export function LifecycleDocs() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52396 · Lifecycle documentation</h3>
      <button className="ls60-btn" onClick={() => setRes(LS.lifecycleDocs())}>
        Generate docs
      </button>
      {res && (
        <Note>
          markdown doc generated · {res.doc.split('\n').length} lines · branded "Infinity AI":{' '}
          {res.doc.includes('Infinity AI') ? 'yes' : 'no'}
        </Note>
      )}
    </div>
  );
}

/* 52397 — State prediction. */
export function StatePrediction() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52397 · State prediction</h3>
      <button
        className="ls60-btn"
        onClick={() =>
          setRes(
            LS.predictTimeToClose(
              { id: 'f-615', severity: 'high', vulnClass: 'xss', openedAt: NOW - 5 * DAY },
              HIST,
              NOW
            )
          )
        }
      >
        Predict f-615
      </button>
      {res && (
        <Note>
          {res.predictedCloseAt
            ? `predicted close in ${(res.predictedInMs / DAY).toFixed(1)}d · confidence ${Math.round(res.confidence * 100)}% · ${res.sampleSize} similar`
            : 'no similar history'}
        </Note>
      )}
    </div>
  );
}

/* 52398 — State-based prioritization. */
export function StatePrioritization() {
  const [res, setRes] = useState(null);
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52398 · State-based prioritization</h3>
      <button className="ls60-btn" onClick={() => setRes(LS.prioritizeByState(F, NOW))}>
        Prioritize
      </button>
      {res && (
        <Note>
          top:{' '}
          {res.ranked[0]
            ? `${res.ranked[0].id} (score ${res.ranked[0].priorityScore}) — ${res.ranked[0].boostReasons.join('; ') || 'no boost'}`
            : 'none'}
        </Note>
      )}
      {res && <Mono>{res.ranked.map(r => `${r.id}: ${r.priorityScore}`).join('\n')}</Mono>}
    </div>
  );
}

/* 52399 — Jira two-way state sync. */
export function JiraStateSync() {
  const res = LS.jiraStateSync();
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52399 · Jira two-way state sync</h3>
      <Note>direction: {res.direction}</Note>
      <Mono>
        {Object.entries(res.infinityToJira)
          .slice(0, 6)
          .map(([i, j]) => `${i} ⇄ ${j}`)
          .join('\n')}
      </Mono>
      <Note>conflicts: {res.conflictPolicy}</Note>
    </div>
  );
}

/* 52400 — Bounty-platform state sync. */
export function PlatformStateSync() {
  const res = LS.platformStateSync();
  return (
    <div className="ls60-card">
      <h3 className="ls60-title">52400 · Bounty-platform state sync</h3>
      <Note>platforms: {Object.keys(res.platforms).join(', ')}</Note>
      <Note>
        hackerone "resolved" → {res.platforms.hackerone.resolved} · bugcrowd "fixed" →{' '}
        {res.platforms.bugcrowd.fixed}
      </Note>
      <Note>{res.onPlatformEvent}</Note>
    </div>
  );
}

export const LS60_GALLERY = [
  LifecycleApi,
  SmartViews,
  StateEmailRules,
  StateExportFilters,
  StateAgingReports,
  StuckInStateAlerts,
  TransitionApprovalGates,
  StateHistoryExport,
  StateAnalytics,
  SeverityStateRules,
  TerminalStateConfig,
  SuggestedNextState,
  TransitionChecklists,
  StateGatedActions,
  MobileApproval,
  LifecycleDocs,
  StatePrediction,
  StatePrioritization,
  JiraStateSync,
  PlatformStateSync,
];

export function LifecycleSyncGallery() {
  return (
    <div className="ls60-gallery">
      {LS60_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
