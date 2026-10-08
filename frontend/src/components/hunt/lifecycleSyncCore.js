/**
 * lifecycleSyncCore.js — Infinity AI · Dark-Matter · Wave 60 (ideas 52381–52400)
 * Pure JS (no React / DOM / network). Post-hunt lifecycle integration and
 * intelligence layer: lifecycle API route descriptors, state-based smart
 * views, email rules, export filters, aging reports, stuck-in-state alerts
 * with manager escalation, transition approval gates, history export,
 * funnel analytics, per-severity rules, terminal-state configuration,
 * suggested next-state heuristics, transition checklists, gated actions,
 * mobile approval payloads, lifecycle documentation generation,
 * time-to-close prediction, state-based prioritization, Jira two-way sync
 * mapping, and bounty-platform status sync. Time is injected via `now`
 * params (default Date.now()) so every function is reproducible.
 */

export const WAVE60_SYNC_IDEAS = [
  {
    id: 52381,
    title: 'Lifecycle API (post-hunt)',
    desc: 'Full programmatic control of states, transitions, and history for custom integrations.',
    skip: false,
  },
  {
    id: 52382,
    title: 'State-based smart views',
    desc: 'Auto-generated views like "Stuck in Triaged > 7 days" or "Verifying now."',
    skip: false,
  },
  {
    id: 52383,
    title: 'State-based email rules',
    desc: 'Trigger emails on entering/exiting states (e.g., daily "newly verified" digest).',
    skip: false,
  },
  {
    id: 52384,
    title: 'State-based export filters',
    desc: 'Export exactly the findings in chosen states for status reports.',
    skip: false,
  },
  {
    id: 52385,
    title: 'State aging reports',
    desc: 'Show how long findings sit in each state to find process bottlenecks.',
    skip: false,
  },
  {
    id: 52386,
    title: 'Stuck-in-state alerts',
    desc: 'Proactive alerts when findings exceed state SLAs, escalating to managers.',
    skip: false,
  },
  {
    id: 52387,
    title: 'Transition approval gates',
    desc: 'Require approval for high-impact transitions (e.g., closing a Critical).',
    skip: false,
  },
  {
    id: 52388,
    title: 'State history export',
    desc: 'Export per-finding state timelines for audits and retrospectives.',
    skip: false,
  },
  {
    id: 52389,
    title: 'State analytics',
    desc: 'Funnel analysis: how many findings reach each state and where they drop off.',
    skip: false,
  },
  {
    id: 52390,
    title: 'Per-severity state rules',
    desc: 'Different SLAs and approval gates for Critical vs Low findings.',
    skip: false,
  },
  {
    id: 52391,
    title: 'Terminal-state configuration',
    desc: 'Define which states count as "done" for reporting and archiving rules.',
    skip: false,
  },
  {
    id: 52392,
    title: 'AI-suggested next state',
    desc: 'Recommend the most likely next state based on finding data and history, one click to apply.',
    skip: false,
  },
  {
    id: 52393,
    title: 'State-transition checklists',
    desc: 'Required checks before key transitions (e.g., "evidence of fix attached" before Verified).',
    skip: false,
  },
  {
    id: 52394,
    title: 'State-gated actions',
    desc: 'Block actions until prerequisites are met (can\u2019t mark Verified without a retest record).',
    skip: false,
  },
  {
    id: 52395,
    title: 'State change mobile approval',
    desc: 'Approve pending transitions from the phone app with full context.',
    skip: false,
  },
  {
    id: 52396,
    title: 'Lifecycle documentation',
    desc: 'Auto-generated docs describing your configured states, rules, and SLAs for onboarding.',
    skip: false,
  },
  {
    id: 52397,
    title: 'State prediction',
    desc: 'Estimate of time-to-close per finding based on similar historical findings.',
    skip: false,
  },
  {
    id: 52398,
    title: 'State-based prioritization',
    desc: 'Boost priority of findings stuck in early states past their SLA.',
    skip: false,
  },
  {
    id: 52399,
    title: 'Jira two-way state sync',
    desc: 'Map lifecycle states to Jira statuses and keep both systems in sync automatically.',
    skip: false,
  },
  {
    id: 52400,
    title: 'Bounty-platform state sync',
    desc: 'Reflect platform report statuses (triaged, resolved) in the finding lifecycle.',
    skip: false,
  },
];

import {
  LIFECYCLE_STATES,
  TRANSITION_GRAPH,
  STATE_SLA_MS,
  slaBreachCheck,
} from './lifecycleGovernCore.js';

const DAY = 24 * 3600000;

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `ls60_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/* 52381 — Lifecycle API route descriptors for custom integrations. */
export function lifecycleApiRoutes() {
  const routes = [
    {
      method: 'GET',
      path: '/api/v1/lifecycle/states',
      summary: 'List all configured lifecycle states.',
      auth: 'bearer',
    },
    {
      method: 'GET',
      path: '/api/v1/lifecycle/rules',
      summary: 'Fetch the legal transition graph and role permissions.',
      auth: 'bearer',
    },
    {
      method: 'GET',
      path: '/api/v1/lifecycle/findings/:id/state',
      summary: 'Read a finding\u2019s current state and SLA status.',
      auth: 'bearer',
    },
    {
      method: 'POST',
      path: '/api/v1/lifecycle/findings/:id/transition',
      summary: 'Request a state transition (gates, reasons, approvals enforced).',
      auth: 'bearer',
      body: '{ to, reason, actor }',
    },
    {
      method: 'POST',
      path: '/api/v1/lifecycle/findings/:id/undo',
      summary: 'Undo a transition inside the grace window.',
      auth: 'bearer',
    },
    {
      method: 'GET',
      path: '/api/v1/lifecycle/findings/:id/history',
      summary: 'Full state timeline for one finding.',
      auth: 'bearer',
    },
    {
      method: 'GET',
      path: '/api/v1/lifecycle/dashboard',
      summary: 'Kanban dashboard payload: counts and aging per state.',
      auth: 'bearer',
    },
    {
      method: 'POST',
      path: '/api/v1/lifecycle/bulk-transition',
      summary: 'Bulk transition with shared reason and preview.',
      auth: 'bearer',
      body: '{ ids[], to, reason, actor }',
    },
    {
      method: 'GET',
      path: '/api/v1/lifecycle/smart-views',
      summary: 'List smart views and their current matches.',
      auth: 'bearer',
    },
    {
      method: 'GET',
      path: '/api/v1/lifecycle/alerts/stuck',
      summary: 'Stuck-in-state alerts with escalation info.',
      auth: 'bearer',
    },
    {
      method: 'GET',
      path: '/api/v1/lifecycle/analytics/funnel',
      summary: 'Funnel analytics: counts per state and drop-off.',
      auth: 'bearer',
    },
    {
      method: 'POST',
      path: '/api/v1/lifecycle/webhooks',
      summary: 'Register a state-transition webhook target.',
      auth: 'bearer',
      body: '{ name, url }',
    },
  ];
  return { ok: true, base: '/api/v1/lifecycle', count: routes.length, routes };
}

/* 52382 — State-based smart views. */
export function smartViewDefinitions() {
  return [
    {
      id: 'stuck-triaged-7d',
      title: 'Stuck in Triaged > 7 days',
      description: 'Findings sitting in Triaged longer than a week.',
      run: (findings = [], now = Date.now()) =>
        (Array.isArray(findings) ? findings : []).filter(
          f =>
            f.state === 'Triaged' &&
            typeof f.stateEnteredAt === 'number' &&
            now - f.stateEnteredAt > 7 * DAY
        ),
    },
    {
      id: 'verifying-now',
      title: 'Verifying now',
      description: 'Findings currently awaiting or undergoing verification retest.',
      run: (findings = []) =>
        (Array.isArray(findings) ? findings : []).filter(f => f.state === 'InRetest'),
    },
    {
      id: 'needs-info-aging',
      title: 'Parked waiting on info',
      description: 'Findings in NeedsInfo for more than 3 days.',
      run: (findings = [], now = Date.now()) =>
        (Array.isArray(findings) ? findings : []).filter(
          f =>
            f.state === 'NeedsInfo' &&
            typeof f.stateEnteredAt === 'number' &&
            now - f.stateEnteredAt > 3 * DAY
        ),
    },
    {
      id: 'blocked-external',
      title: 'Blocked on externals',
      description: 'Findings in Blocked, grouped by the external dependency.',
      run: (findings = []) =>
        (Array.isArray(findings) ? findings : []).filter(f => f.state === 'Blocked'),
    },
    {
      id: 'risk-expiring-30d',
      title: 'Risk acceptances expiring < 30 days',
      description: 'Accepted risks whose expiry is approaching.',
      run: (findings = [], now = Date.now()) =>
        (Array.isArray(findings) ? findings : []).filter(
          f =>
            f.state === 'RiskAccepted' &&
            typeof f.riskExpiryAt === 'number' &&
            f.riskExpiryAt - now < 30 * DAY &&
            f.riskExpiryAt > now
        ),
    },
  ];
}

export function runSmartViews(findings = [], now = Date.now()) {
  const defs = smartViewDefinitions();
  return {
    ok: true,
    views: defs.map(d => {
      const matches = d.run(findings, now);
      return {
        id: d.id,
        title: d.title,
        description: d.description,
        count: matches.length,
        findings: matches.map(f => f.id),
      };
    }),
    generatedAt: now,
  };
}

/* 52383 — State-based email rules. */
export function stateEmailRule({
  name,
  onEnter = [],
  onExit = [],
  recipients = [],
  schedule = 'immediate',
  template = null,
} = {}) {
  if (!name || String(name).trim() === '') return { ok: false, reason: 'rule name is required' };
  if (!onEnter.length && !onExit.length)
    return { ok: false, reason: 'at least one onEnter or onExit state is required' };
  if (!recipients.length) return { ok: false, reason: 'at least one recipient is required' };
  return {
    ok: true,
    rule: {
      id: tokenFor('email', name, Date.now()),
      name: String(name),
      onEnter: [...onEnter],
      onExit: [...onExit],
      recipients: [...recipients],
      schedule,
      template: template || `finding entered/exited ${[...onEnter, ...onExit].join(', ')}`,
      enabled: true,
    },
  };
}

export function defaultEmailRules() {
  return {
    ok: true,
    rules: [
      {
        name: 'Newly verified digest',
        onEnter: ['Verified'],
        schedule: 'daily',
        recipients: ['team'],
      },
      {
        name: 'Critical closed alert',
        onEnter: ['Closed'],
        schedule: 'immediate',
        recipients: ['security-lead'],
        severityFilter: 'critical',
      },
      {
        name: 'Reopened regression alert',
        onEnter: ['Reopened'],
        schedule: 'immediate',
        recipients: ['assignee', 'manager'],
      },
      {
        name: 'Left Blocked notice',
        onExit: ['Blocked'],
        schedule: 'immediate',
        recipients: ['watchers'],
      },
    ],
  };
}

/* 52384 — State-based export filters. */
export function stateExportFilter(states = [], { columns = null, format = 'csv' } = {}) {
  const list = Array.isArray(states) ? states : [];
  const unknown = list.filter(s => !LIFECYCLE_STATES.includes(s));
  if (list.length === 0) return { ok: false, reason: 'at least one state is required' };
  if (unknown.length) return { ok: false, reason: `unknown states: ${unknown.join(', ')}` };
  return {
    ok: true,
    filter: {
      states: [...list],
      format,
      columns: columns || ['id', 'title', 'state', 'severity', 'stateEnteredAt', 'assignee'],
      predicate: f => list.includes(f.state),
    },
  };
}

/* 52385 — State aging reports. */
export function stateAgingReport(findings = [], now = Date.now()) {
  const rows = Array.isArray(findings) ? findings : [];
  const perState = LIFECYCLE_STATES.map(state => {
    const ages = rows
      .filter(f => f.state === state && typeof f.stateEnteredAt === 'number')
      .map(f => now - f.stateEnteredAt);
    const total = ages.reduce((a, b) => a + b, 0);
    return {
      state,
      count: ages.length,
      avgAgeMs: ages.length ? total / ages.length : null,
      maxAgeMs: ages.length ? Math.max(...ages) : null,
      totalAgeMs: total,
    };
  });
  const bottleneck =
    perState.filter(p => p.avgAgeMs !== null).sort((a, b) => b.avgAgeMs - a.avgAgeMs)[0] || null;
  return {
    ok: true,
    total: rows.length,
    perState,
    bottleneck: bottleneck ? bottleneck.state : null,
    generatedAt: now,
  };
}

/* 52386 — Stuck-in-state alerts with manager escalation. */
export function stuckAlerts(findings = [], now = Date.now()) {
  const rows = Array.isArray(findings) ? findings : [];
  const alerts = [];
  for (const f of rows) {
    if (typeof f.stateEnteredAt !== 'number') continue;
    const check = slaBreachCheck(f.state, f.stateEnteredAt, now);
    if (!check.ok || !check.hasSla || !check.breached) continue;
    const severityMultiplier = check.breachByMs > check.targetMs;
    alerts.push({
      id: tokenFor('alert', f.id, now),
      findingId: f.id,
      state: f.state,
      ageMs: check.elapsedMs,
      overByMs: check.breachByMs,
      severity: f.severity || 'unknown',
      escalation:
        severityMultiplier || (f.severity || '').toLowerCase() === 'critical'
          ? 'manager'
          : 'team-lead',
      escalatedAt: now,
      message: `Finding ${f.id} stuck in ${f.state} for ${Math.round(check.elapsedMs / 3600000)}h (SLA ${Math.round(check.targetMs / 3600000)}h)`,
    });
  }
  return {
    ok: true,
    count: alerts.length,
    alerts,
    escalatedToManager: alerts.filter(a => a.escalation === 'manager').length,
    checkedAt: now,
  };
}

/* 52387 — Transition approval gates (e.g., closing a Critical needs approval). */
export function transitionApprovalGates(finding, from, to) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  const sev = (finding.severity || '').toLowerCase();
  const gates = [];
  if (['Closed', 'WontFix'].includes(to) && ['critical', 'high'].includes(sev)) {
    gates.push({
      gate: 'severity-closure',
      approverRole: 'manager',
      reason: `${sev} findings need manager approval to reach ${to}`,
    });
  }
  if (to === 'RiskAccepted') {
    gates.push({
      gate: 'risk-acceptance',
      approverRole: 'approver',
      reason: 'risk acceptance always requires a designated approver',
    });
  }
  if (to === 'Archived') {
    gates.push({
      gate: 'archive',
      approverRole: 'manager',
      reason: 'archiving needs manager sign-off',
    });
  }
  return {
    ok: true,
    findingId: finding.id,
    from,
    to,
    required: gates.length > 0,
    gates,
  };
}

export function approveTransitionGate(
  pending,
  { approver, approved, note, now = Date.now() } = {}
) {
  if (!pending || !pending.findingId)
    return { ok: false, reason: 'pending transition record required' };
  if (!approver) return { ok: false, reason: 'approver identity is required' };
  return {
    ok: true,
    findingId: pending.findingId,
    from: pending.from,
    to: pending.to,
    approved: Boolean(approved),
    approver,
    note: note || null,
    decidedAt: now,
  };
}

/* 52388 — State history export for audits and retrospectives. */
export function stateHistoryExport(log = [], format = 'json') {
  const rows = (Array.isArray(log) ? log : []).slice().sort((a, b) => a.at - b.at);
  if (format === 'csv') {
    const header = 'id,findingId,actor,from,to,reason,at';
    const esc = v => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
    const lines = rows.map(e =>
      [e.id, e.findingId, e.actor, e.from, e.to, e.reason, e.at].map(esc).join(',')
    );
    return { ok: true, format: 'csv', rows: rows.length, export: [header, ...lines].join('\n') };
  }
  if (format === 'markdown') {
    const lines = rows.map(
      e => `- ${new Date(e.at).toISOString()} · **${e.from} → ${e.to}** by ${e.actor} — ${e.reason}`
    );
    return { ok: true, format: 'markdown', rows: rows.length, export: lines.join('\n') };
  }
  return { ok: true, format: 'json', rows: rows.length, export: rows };
}

/* 52389 — State analytics: funnel counts per state + drop-off. */
export function funnelAnalytics(findings = [], history = []) {
  const rows = Array.isArray(findings) ? findings : [];
  const counts = {};
  for (const s of LIFECYCLE_STATES) counts[s] = 0;
  for (const f of rows) if (counts[f.state] !== undefined) counts[f.state] += 1;
  const started = rows.length;
  const closed = counts.Closed + counts.Archived;
  const verified = counts.Verified;
  const terminalDropped = counts.Duplicate + counts.WontFix + counts.RiskAccepted;
  const reachVerified = started ? verified / started : null;
  const reachClosed = started ? closed / started : null;
  const reopenRate = history.length
    ? history.filter(e => e.to === 'Reopened').length /
      Math.max(1, history.filter(e => e.to === 'Closed').length)
    : null;
  return {
    ok: true,
    total: started,
    counts,
    funnel: {
      started,
      triagedOrBeyond: started - counts.New,
      verified,
      closed,
      archived: counts.Archived,
      droppedTerminal: terminalDropped,
      reachVerifiedRate: reachVerified,
      reachClosedRate: reachClosed,
      reopenRate,
    },
    dropOff: {
      neverTriaged: counts.New,
      stuckPreVerify:
        counts.Triaged +
        counts.NeedsInfo +
        counts.InProgress +
        counts.Blocked +
        counts.Deferred +
        counts.InRetest,
    },
  };
}

/* 52390 — Per-severity state rules: different SLAs and approval gates. */
export const SEVERITY_STATE_RULES = {
  critical: {
    slaMultipliers: { New: 0.5, Triaged: 0.5, InProgress: 0.5, InRetest: 0.5, Verified: 0.5 },
    approvalGates: ['Closed', 'WontFix', 'RiskAccepted', 'Archived'],
    escalateTo: 'manager',
  },
  high: {
    slaMultipliers: { New: 0.75, Triaged: 0.75 },
    approvalGates: ['Closed', 'WontFix', 'Archived'],
    escalateTo: 'team-lead',
  },
  medium: { slaMultipliers: {}, approvalGates: [], escalateTo: 'team-lead' },
  low: { slaMultipliers: {}, approvalGates: [], escalateTo: null },
};

export function severityStateRules(severity) {
  const sev = (severity || '').toLowerCase();
  if (!SEVERITY_STATE_RULES[sev]) return { ok: false, reason: `unknown severity: ${severity}` };
  return { ok: true, severity: sev, rules: SEVERITY_STATE_RULES[sev] };
}

export function severitySlaMs(severity, state) {
  const rules = SEVERITY_STATE_RULES[(severity || '').toLowerCase()];
  if (!rules || !(state in STATE_SLA_MS)) return { ok: false, reason: 'unknown severity or state' };
  const base = STATE_SLA_MS[state];
  if (base === null) return { ok: true, severity, state, slaMs: null };
  const mult = rules.slaMultipliers[state] || 1;
  return { ok: true, severity, state, slaMs: Math.round(base * mult) };
}

/* 52391 — Terminal-state configuration. */
export const TERMINAL_STATES = ['Duplicate', 'WontFix', 'RiskAccepted', 'Closed', 'Archived'];

export function terminalStatesConfig() {
  return {
    ok: true,
    terminal: [...TERMINAL_STATES],
    active: LIFECYCLE_STATES.filter(s => !TERMINAL_STATES.includes(s)),
    isTerminal: state => TERMINAL_STATES.includes(state),
    reportingNote:
      'Terminal states count as "done" for reporting and archiving rules; Reopened is never terminal.',
  };
}

/* 52392 — Suggested next state: heuristic ranked suggestion with a reason. */
export function suggestNextState(finding = {}, history = []) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  const state = finding.state;
  const legal = TRANSITION_GRAPH[state] || [];
  const suggestions = [];
  const push = (target, confidence, reason) => {
    if (legal.includes(target)) suggestions.push({ state: target, confidence, reason });
  };
  const sev = (finding.severity || '').toLowerCase();
  const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
  const hasFixEvidence = evidence.some(
    e => e && (e.kind === 'fix' || e.kind === 'patch' || e.kind === 'retest-pass')
  );
  const hasRetest = Boolean(finding.retest && finding.retest.passed);
  switch (state) {
    case 'New':
      push('Triaged', 0.9, 'new findings are triaged first');
      break;
    case 'Triaged':
      if (finding.duplicateOf) push('Duplicate', 0.85, 'finding references a canonical duplicate');
      else if (hasFixEvidence)
        push('InRetest', 0.8, 'fix evidence present — ready for verification retest');
      else push('InProgress', 0.75, 'no blocker recorded — assign for remediation');
      break;
    case 'NeedsInfo':
      push('Triaged', 0.7, 'once info arrives, re-triage');
      break;
    case 'InProgress':
      if (hasFixEvidence) push('InRetest', 0.9, 'fix evidence attached — schedule retest');
      else push('Blocked', 0.4, 'consider Blocked if waiting on an external dependency');
      break;
    case 'InRetest':
      if (hasRetest) push('Verified', 0.92, 'passing retest record — verify');
      else push('Verified', 0.6, 'retest pending — verify once it passes');
      break;
    case 'Verified':
      push('Closed', sev === 'critical' ? 0.7 : 0.85, 'verification done — complete admin closure');
      break;
    case 'Blocked':
      push('InProgress', 0.65, 'unblock when the dependency lands');
      break;
    case 'Deferred':
      push('Triaged', 0.6, 're-triage when the deferral date arrives');
      break;
    case 'Reopened':
      push('InProgress', 0.8, 'regression — reassign for remediation');
      break;
    case 'RiskAccepted':
      push('Reopened', 0.55, 'reopen if compensating controls fail or expiry nears');
      break;
    default:
      break;
  }
  const ranked = suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .map((s, i) => ({ rank: i + 1, ...s, oneClick: { to: s.state, from: state } }));
  return { ok: true, findingId: finding.id, from: state, suggestions: ranked };
}

/* 52393 — Transition checklists: required checks before key transitions. */
const TRANSITION_CHECKLISTS = {
  'InRetest→Verified': [
    'evidence of fix attached',
    'retest record present and passing',
    'no open blockers',
  ],
  'Verified→Closed': [
    'closure summary written',
    'closed-by owner assigned',
    'bounty/platform status synced',
  ],
  'Triaged→WontFix': ['documented rationale recorded', 'approver assigned'],
  'Triaged→RiskAccepted': ['risk owner assigned', 'expiry date set', 'compensating controls noted'],
  '*→Closed': ['no open blockers', 'final evidence archived'],
  '*→Duplicate': ['canonical finding linked'],
};

export function transitionChecklists(from, to) {
  const key = `${from}→${to}`;
  const specific = TRANSITION_CHECKLISTS[key] || [];
  const wildcard = TRANSITION_CHECKLISTS[`*→${to}`] || [];
  const checks = [...new Set([...specific, ...wildcard])];
  return { ok: true, from, to, checks };
}

export function evaluateChecklist(finding, from, to) {
  const { checks } = transitionChecklists(from, to);
  const results = checks.map(c => {
    const lc = c.toLowerCase();
    let satisfied = false;
    if (lc.includes('evidence of fix') || lc.includes('fix attached')) {
      satisfied = (finding.evidence || []).some(e => e && (e.kind === 'fix' || e.kind === 'patch'));
    } else if (lc.includes('retest')) {
      satisfied = Boolean(finding.retest && finding.retest.passed);
    } else if (lc.includes('rationale')) {
      satisfied = Boolean(finding.wontFixRationale);
    } else if (lc.includes('approver')) {
      satisfied = Boolean(finding.approver);
    } else if (lc.includes('risk owner')) {
      satisfied = Boolean(finding.riskOwner);
    } else if (lc.includes('expiry')) {
      satisfied = typeof finding.riskExpiryAt === 'number';
    } else if (lc.includes('controls')) {
      satisfied =
        Array.isArray(finding.compensatingControls) && finding.compensatingControls.length > 0;
    } else if (lc.includes('canonical')) {
      satisfied = Boolean(finding.duplicateOf);
    } else if (lc.includes('closure summary')) {
      satisfied = Boolean(finding.closureSummary);
    } else if (lc.includes('closed-by')) {
      satisfied = Boolean(finding.closedBy);
    } else if (lc.includes('blocker')) {
      satisfied = finding.state !== 'Blocked';
    } else {
      satisfied = false;
    }
    return { check: c, satisfied };
  });
  return {
    ok: true,
    from,
    to,
    checks: results,
    allSatisfied: results.every(r => r.satisfied),
    missing: results.filter(r => !r.satisfied).map(r => r.check),
  };
}

/* 52394 — State-gated actions: block actions until prerequisites are met. */
export function gatedActions(finding, action) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  const missing = [];
  switch (action) {
    case 'mark-verified':
      if (!(finding.retest && finding.retest.passed === true))
        missing.push('retest record (must pass)');
      break;
    case 'close':
      if (finding.state !== 'Verified') missing.push('finding must be Verified first');
      if (!finding.closureSummary) missing.push('closure summary');
      if (!finding.closedBy) missing.push('closed-by owner');
      break;
    case 'archive':
      if (!TERMINAL_STATES.includes(finding.state))
        missing.push('finding must be in a terminal state');
      break;
    case 'risk-accept':
      if (!finding.riskOwner) missing.push('risk owner');
      if (typeof finding.riskExpiryAt !== 'number') missing.push('expiry date');
      break;
    default:
      return { ok: false, reason: `unknown gated action: ${action}` };
  }
  return { ok: true, findingId: finding.id, action, allowed: missing.length === 0, missing };
}

/* 52395 — State-change mobile approval payload. */
export function mobileApprovalPayload(
  pending,
  { requestedBy, expiresAt, deepLinkBase = 'infinityai://approvals' } = {}
) {
  if (!pending || !pending.findingId || !pending.from || !pending.to) {
    return { ok: false, reason: 'pending transition with findingId, from, and to is required' };
  }
  const gates = pending.gates || [];
  return {
    ok: true,
    payload: {
      approvalId: tokenFor('mobile', pending.findingId, Date.now()),
      findingId: pending.findingId,
      findingTitle: pending.findingTitle || null,
      severity: pending.severity || null,
      from: pending.from,
      to: pending.to,
      reason: pending.reason || null,
      requestedBy: requestedBy || 'Infinity AI',
      requestedAt: Date.now(),
      expiresAt: expiresAt || null,
      gates,
      deepLink: `${deepLinkBase}/${pending.findingId}`,
      actions: ['approve', 'reject'],
      context: {
        stateAgeHrs:
          typeof pending.stateAgeMs === 'number' ? Math.round(pending.stateAgeMs / 3600000) : null,
        checklist: pending.checklist || null,
      },
    },
  };
}

/* 52396 — Lifecycle documentation generator (markdown for onboarding). */
export function lifecycleDocs({
  states = LIFECYCLE_STATES,
  graph = TRANSITION_GRAPH,
  slaMs = STATE_SLA_MS,
} = {}) {
  const lines = [
    '# Finding Lifecycle — Infinity AI',
    '',
    'Auto-generated lifecycle documentation for onboarding and audits.',
    '',
    '## States',
    '',
    ...states.map(s => `- **${s}**${TERMINAL_STATES.includes(s) ? ' _(terminal)_' : ''}`),
    '',
    '## Legal transitions',
    '',
    ...states.map(s => {
      const targets = graph[s] || [];
      return `- ${s} → ${targets.length ? targets.join(', ') : '_terminal (no outgoing transitions)_'}`;
    }),
    '',
    '## SLA targets',
    '',
    ...states.map(s => {
      const ms = slaMs[s];
      return `- ${s}: ${ms === null || ms === undefined ? 'no SLA' : `${Math.round(ms / 3600000)}h`}`;
    }),
    '',
    '## Notes',
    '',
    '- Verified (technical: the fix works) is distinct from Closed (administrative: paperwork done).',
    '- Transitions into Closed, Won\u2019t Fix, and Risk Accepted require a reason note and role approval.',
    '- A failing retest auto-reopens the finding; a passing one auto-verifies it.',
  ];
  return { ok: true, format: 'markdown', doc: lines.join('\n') };
}

/* 52397 — Time-to-close prediction from similar historical findings. */
export function predictTimeToClose(finding = {}, history = [], now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  const rows = Array.isArray(history) ? history : [];
  const similar = rows.filter(
    h =>
      h.severity === finding.severity &&
      h.vulnClass === finding.vulnClass &&
      typeof h.openedAt === 'number' &&
      typeof h.closedAt === 'number' &&
      h.closedAt > h.openedAt
  );
  if (!similar.length) {
    return {
      ok: true,
      findingId: finding.id,
      predictedCloseAt: null,
      confidence: 0,
      sampleSize: 0,
      note: 'no similar historical findings',
    };
  }
  const durations = similar.map(h => h.closedAt - h.openedAt).sort((a, b) => a - b);
  const median =
    (durations[Math.floor((durations.length - 1) / 2)] +
      durations[Math.ceil((durations.length - 1) / 2)]) /
    2;
  const openedAt = typeof finding.openedAt === 'number' ? finding.openedAt : now;
  const predictedCloseAt = openedAt + median;
  return {
    ok: true,
    findingId: finding.id,
    predictedCloseAt,
    predictedInMs: Math.max(0, predictedCloseAt - now),
    confidence: Math.min(0.95, 0.4 + similar.length * 0.05),
    sampleSize: similar.length,
    basis: { severity: finding.severity, vulnClass: finding.vulnClass, medianDurationMs: median },
  };
}

/* 52398 — State-based prioritization: boost findings stuck in early states past SLA. */
const EARLY_STATES = ['New', 'Triaged', 'NeedsInfo', 'Reopened'];
const SEVERITY_WEIGHT = { critical: 100, high: 60, medium: 30, low: 10 };

export function prioritizeByState(findings = [], now = Date.now()) {
  const rows = Array.isArray(findings) ? findings : [];
  const scored = rows.map(f => {
    const sev = (f.severity || 'low').toLowerCase();
    let score = SEVERITY_WEIGHT[sev] || 10;
    const boosts = [];
    if (EARLY_STATES.includes(f.state) && typeof f.stateEnteredAt === 'number') {
      const check = slaBreachCheck(f.state, f.stateEnteredAt, now);
      if (check.ok && check.hasSla && check.breached) {
        const boost = 40 + Math.min(60, Math.round((check.breachByMs / check.targetMs) * 40));
        score += boost;
        boosts.push(`stuck in ${f.state} past SLA (+${boost})`);
      } else if (check.ok && check.hasSla) {
        score += 10;
        boosts.push(`aging in early state ${f.state} (+10)`);
      }
    }
    if (f.state === 'Reopened') {
      score += 25;
      boosts.push('regression (+25)');
    }
    return { id: f.id, state: f.state, severity: sev, priorityScore: score, boostReasons: boosts };
  });
  scored.sort((a, b) => b.priorityScore - a.priorityScore);
  return { ok: true, count: scored.length, ranked: scored, rankedAt: now };
}

/* 52399 — Jira two-way state sync mapping descriptor. */
export function jiraStateSync() {
  const infinityToJira = {
    New: 'To Do',
    Triaged: 'To Do',
    NeedsInfo: 'Waiting for Info',
    InProgress: 'In Progress',
    Blocked: 'Blocked',
    Deferred: 'Deferred',
    InRetest: 'In Review',
    Verified: 'Done (verified)',
    Duplicate: 'Done (duplicate)',
    WontFix: "Won't Fix",
    RiskAccepted: 'Done (risk accepted)',
    Closed: 'Done',
    Reopened: 'Reopened',
    Archived: 'Archived',
  };
  const jiraToInfinity = {};
  for (const [inf, jira] of Object.entries(infinityToJira)) {
    if (!jiraToInfinity[jira]) jiraToInfinity[jira] = inf;
  }
  return {
    ok: true,
    direction: 'two-way',
    infinityToJira,
    jiraToInfinity,
    conflictPolicy: 'last-writer-wins with Infinity AI audit log as the tiebreaker record',
    syncOn: ['transition', 'webhook-in', 'scheduled-reconcile'],
  };
}

/* 52400 — Bounty-platform status sync descriptor. */
export function platformStateSync() {
  return {
    ok: true,
    direction: 'platform → Infinity AI (read), Infinity AI → platform (write on close)',
    platforms: {
      hackerone: {
        new: 'New',
        triaged: 'Triaged',
        'needs-more-info': 'NeedsInfo',
        resolved: 'Verified',
        'not-applicable': 'WontFix',
        duplicate: 'Duplicate',
        informative: 'Closed',
        retesting: 'InRetest',
      },
      bugcrowd: {
        new: 'New',
        accepted: 'Triaged',
        'needs-info': 'NeedsInfo',
        fixed: 'Verified',
        'wont-fix': 'WontFix',
        duplicate: 'Duplicate',
        closed: 'Closed',
        reopened: 'Reopened',
      },
      intigriti: {
        open: 'New',
        'in-review': 'Triaged',
        accepted: 'InProgress',
        resolved: 'Verified',
        closed: 'Closed',
        duplicate: 'Duplicate',
      },
    },
    onPlatformEvent:
      'map the platform status to the lifecycle state and append an audit entry with actor "platform-sync"',
  };
}
