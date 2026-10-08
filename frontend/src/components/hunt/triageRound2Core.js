/**
 * triageRound2Core.js — Infinity AI · Dark-Matter · Wave 52
 * Pure logic (no React, no DOM, no network) backing the post-hunt triage round 2 suite:
 * idea-bank ideas 52041–52063. Every exported function is pure and deterministic;
 * time is injected via `now` parameters (defaults to Date.now()).
 */

export const WAVE52_TRIAGE2_IDEAS = [
  { id: 52041, title: 'Review history timeline (post-hunt)' },
  { id: 52042, title: 'Multi-select finding comparison' },
  { id: 52043, title: 'Inbox dashboard widgets' },
  { id: 52044, title: 'Triage reminders' },
  { id: 52045, title: 'Offline triage queue (post-hunt)' },
  { id: 52046, title: 'Duplicate collapse suggestions' },
  { id: 52047, title: 'Cross-hunt findings explorer' },
  { id: 52048, title: 'Triage queue per team' },
  { id: 52049, title: 'Screen-reader accessible triage' },
  { id: 52050, title: 'Finding annotation on screenshots' },
  { id: 52051, title: 'Evidence chain viewer' },
  { id: 52052, title: '"Explain like I\'m new" toggle (post-hunt)' },
  { id: 52053, title: 'Triage performance leaderboard' },
  { id: 52054, title: 'Review templates per vuln class (post-hunt)' },
  { id: 52055, title: 'Bulk-select in inbox' },
  { id: 52056, title: 'Triage heatmap' },
  { id: 52057, title: 'Finding relationship graph (post-hunt)' },
  { id: 52058, title: '"First look" guided tour' },
  { id: 52059, title: 'Reviewer workload balancer' },
  { id: 52060, title: 'Triage export of decisions' },
  { id: 52061, title: 'Comment reactions (post-hunt)' },
  { id: 52062, title: 'Finding watchers (post-hunt)' },
  { id: 52063, title: 'Triage inbox API' },
];

// 52041 — Review history timeline: chronological audit trail per finding.
const TIMELINE_KINDS = ['view', 'comment', 'state-change', 'override'];
export function buildReviewTimeline(events) {
  const list = (Array.isArray(events) ? events : [])
    .filter(e => e && TIMELINE_KINDS.includes(e.kind) && e.at != null)
    .map(e => ({
      kind: e.kind,
      at: Number(e.at),
      actor: String(e.actor || 'unknown'),
      detail: String(e.detail || ''),
    }));
  list.sort((a, b) => a.at - b.at);
  return list;
}

// 52042 — Multi-select finding comparison: side-by-side table for 2–3 findings.
export function buildComparisonTable(findings) {
  const list = (Array.isArray(findings) ? findings : []).slice(0, 3);
  if (list.length < 2) return { ok: false, reason: 'select 2 or 3 findings to compare' };
  const rows = [
    { field: 'severity', values: list.map(f => f.severity || 'info') },
    { field: 'vulnClass', values: list.map(f => f.vulnClass || 'unknown') },
    { field: 'endpoint', values: list.map(f => f.endpoint || '—') },
    { field: 'confidence', values: list.map(f => f.confidence ?? '—') },
    { field: 'status', values: list.map(f => f.status || 'open') },
    {
      field: 'evidenceCount',
      values: list.map(f => (Array.isArray(f.evidence) ? f.evidence.length : 0)),
    },
  ];
  const differs = rows.filter(r => new Set(r.values.map(String)).size > 1).map(r => r.field);
  return { ok: true, columns: list.map(f => f.id || '?'), rows, differs };
}

// 52043 — Inbox dashboard widgets: embeddable counts.
export function buildWidgetCounts(findings, now = Date.now()) {
  const list = Array.isArray(findings) ? findings : [];
  const n = Number(now);
  return {
    openCriticals: list.filter(f => f.severity === 'critical' && f.status === 'open').length,
    unreviewed: list.filter(f => f.status === 'open' && !f.reviewed).length,
    slaBreaches: list.filter(
      f => f.slaDueAt != null && n > Number(f.slaDueAt) && f.status === 'open'
    ).length,
    totalOpen: list.filter(f => f.status === 'open').length,
  };
}

// 52044 — Triage reminders: nudges for pending queues at configurable intervals.
export function computeReminders(queue, rules, now = Date.now()) {
  const q = Array.isArray(queue) ? queue : [];
  const r = rules || {};
  const pending = q.filter(f => f.status === 'open');
  const reminders = [];
  const n = Number(now);
  if (pending.length > 0) {
    const intervalMs = Number(r.intervalHours || 24) * 3600000;
    const lastSent = Number(r.lastSentAt || 0);
    if (n - lastSent >= intervalMs) {
      reminders.push({
        channel: String(r.channel || 'in-app'),
        message: `${pending.length} findings pending triage`,
        pending: pending.length,
        sentAt: n,
      });
    }
  }
  if (pending.some(f => f.severity === 'critical') && r.criticalEscalate) {
    reminders.push({
      channel: 'chat',
      message: 'critical findings awaiting triage',
      pending: 0,
      sentAt: n,
      escalated: true,
    });
  }
  return reminders;
}

// 52045 — Offline triage queue: download, triage offline, sync with conflict resolution.
export function packOfflineQueue(findings, rev, now = Date.now()) {
  return {
    rev: Number(rev || 1),
    packedAt: Number(now),
    findings: (Array.isArray(findings) ? findings : []).map(f => ({
      id: f.id,
      decision: null,
      updatedAt: Number(f.updatedAt || 0),
    })),
  };
}
export function applyOfflineDecision(pack, findingId, decision, now = Date.now()) {
  const p = pack || { findings: [] };
  const findings = p.findings.map(f =>
    f.id === findingId ? { ...f, decision, updatedAt: Number(now) } : f
  );
  return { ...p, findings };
}
export function mergeOfflineDecisions(pack, serverDecisions) {
  const p = pack || { findings: [] };
  const server = new Map(
    (Array.isArray(serverDecisions) ? serverDecisions : []).map(s => [s.id, s])
  );
  const merged = [];
  const conflicts = [];
  for (const local of p.findings) {
    const srv = server.get(local.id);
    if (!local.decision) continue;
    if (!srv || !srv.decision) {
      merged.push({ id: local.id, decision: local.decision, source: 'offline' });
    } else if (srv.decision === local.decision) {
      merged.push({ id: local.id, decision: local.decision, source: 'both-agree' });
    } else if (Number(local.updatedAt || 0) >= Number(srv.updatedAt || 0)) {
      merged.push({ id: local.id, decision: local.decision, source: 'offline-newer' });
      conflicts.push({
        id: local.id,
        local: local.decision,
        server: srv.decision,
        resolution: 'offline-newer-kept',
      });
    } else {
      merged.push({ id: local.id, decision: srv.decision, source: 'server-newer' });
      conflicts.push({
        id: local.id,
        local: local.decision,
        server: srv.decision,
        resolution: 'server-newer-kept',
      });
    }
  }
  return { merged, conflicts };
}

// 52046 — Duplicate collapse suggestions: propose likely duplicates, merge with evidence union.
export function signatureOf(f) {
  return [f.vulnClass || '', f.endpoint || '', f.parameter || ''].join('|').toLowerCase();
}
export function suggestDuplicates(findings) {
  const list = Array.isArray(findings) ? findings : [];
  const groups = new Map();
  for (const f of list) {
    const sig = signatureOf(f);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push(f);
  }
  const suggestions = [];
  for (const [, g] of groups) {
    if (g.length > 1) {
      suggestions.push({
        signature: signatureOf(g[0]),
        findingIds: g.map(f => f.id),
        count: g.length,
      });
    }
  }
  return suggestions;
}
export function mergeFindings(primary, duplicate) {
  const p = primary || {};
  const d = duplicate || {};
  const ev = [
    ...(Array.isArray(p.evidence) ? p.evidence : []),
    ...(Array.isArray(d.evidence) ? d.evidence : []),
  ];
  const seen = new Set();
  const evidence = ev.filter(e => {
    const k = JSON.stringify(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ...p, evidence, mergedFrom: [...(p.mergedFrom || []), d.id].filter(Boolean) };
}

// 52047 — Cross-hunt findings explorer: unified search across every hunt.
export function searchAllHunts(hunts, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return [];
  const results = [];
  for (const h of Array.isArray(hunts) ? hunts : []) {
    for (const f of Array.isArray(h.findings) ? h.findings : []) {
      const hay = [f.id, f.title, f.vulnClass, f.endpoint, f.parameter, f.severity]
        .map(x => String(x || '').toLowerCase())
        .join(' ');
      if (hay.includes(q)) results.push({ huntId: h.id, huntName: h.name, ...f });
    }
  }
  return results;
}

// 52048 — Triage queue per team: auto-route by asset ownership mapping.
export function routeToTeams(findings, ownershipMap) {
  const map = ownershipMap || {};
  const queues = {};
  for (const f of Array.isArray(findings) ? findings : []) {
    const team = map[f.asset] || 'unassigned';
    if (!queues[team]) queues[team] = [];
    queues[team].push(f);
  }
  return queues;
}

// 52049 — Screen-reader accessible triage: semantic description of a finding.
export function describeForScreenReader(finding) {
  const f = finding || {};
  const bits = [
    `Finding ${f.id || 'unknown'}`,
    `severity ${f.severity || 'info'}`,
    `status ${f.status || 'open'}`,
    f.title ? `titled ${f.title}` : null,
    f.vulnClass ? `class ${f.vulnClass}` : null,
    f.endpoint ? `on endpoint ${f.endpoint}` : null,
  ].filter(Boolean);
  return bits.join(', ') + '.';
}
export const TRIAGE_KEYBOARD_HINTS = [
  { key: 'Tab', action: 'move between triage landmarks' },
  { key: 'Enter', action: 'open focused finding' },
  { key: 'ArrowUp/ArrowDown', action: 'move within the finding list' },
  { key: 'a', action: 'accept finding' },
  { key: 'd', action: 'dismiss finding' },
];

// 52050 — Finding annotation on screenshots.
export function addAnnotation(annotations, box) {
  const list = Array.isArray(annotations) ? annotations : [];
  const b = box || {};
  if (b.x == null || b.y == null || b.w == null || b.h == null)
    return { annotations: list, ok: false, reason: 'box needs x, y, w, h' };
  const next = {
    id: `ann-${list.length + 1}-${Math.abs(Math.floor(Number(b.x) * 7 + Number(b.y) * 13))}`,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    label: String(b.label || 'vulnerable element'),
  };
  return { annotations: [...list, next], ok: true };
}
export function removeAnnotation(annotations, id) {
  const list = Array.isArray(annotations) ? annotations : [];
  return list.filter(a => a.id !== id);
}

// 52051 — Evidence chain viewer: numbered multi-request sequence.
export function buildEvidenceChain(steps) {
  const list = (Array.isArray(steps) ? steps : []).map((s, i) => ({
    step: i + 1,
    method: String((s || {}).method || 'GET'),
    url: String((s || {}).url || ''),
    request: String((s || {}).request || ''),
    response: String((s || {}).response || ''),
  }));
  return { steps: list, totalSteps: list.length, valid: list.length > 0 };
}

// 52052 — "Explain like I'm new" toggle: rewrite jargon with a glossary.
export function simplifyFinding(detail, glossary) {
  const g = glossary || {};
  let text = String(detail || '');
  for (const [term, plain] of Object.entries(g)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped, 'gi'), `${term} (${plain})`);
  }
  return text;
}

// 52053 — Triage performance leaderboard (opt-in).
export function buildLeaderboard(reviewers) {
  const list = (Array.isArray(reviewers) ? reviewers : [])
    .filter(r => r && r.optIn)
    .map(r => ({
      name: String(r.name || 'anonymous'),
      reviewed: Number(r.reviewed || 0),
      accuracy: Math.min(1, Math.max(0, Number(r.accuracy ?? 0))),
    }));
  list.sort((a, b) => b.reviewed - a.reviewed || b.accuracy - a.accuracy);
  return list.map((r, i) => ({ ...r, rank: i + 1 }));
}

// 52054 — Review templates per vuln class.
const REVIEW_TEMPLATES = {
  xss: [
    'check reflected vs stored context',
    'confirm output encoding on render path',
    'verify CSP does not allow inline scripts',
  ],
  sqli: [
    'confirm parameterized queries at sink',
    'check error messages leak schema',
    'verify least-privilege DB user',
  ],
  auth: ['test session fixation', 'check MFA enforcement', 'verify password reset token entropy'],
  ssrf: [
    'confirm allowlist of internal hosts',
    'check cloud metadata endpoint blocked',
    'verify redirect validation',
  ],
  default: [
    'reproduce with provided evidence',
    'confirm affected asset scope',
    'check for duplicates',
  ],
};
export function getReviewTemplate(vulnClass) {
  const key = String(vulnClass || '').toLowerCase();
  return REVIEW_TEMPLATES[key] || REVIEW_TEMPLATES.default;
}

// 52055 — Bulk-select in inbox.
export function toggleSelect(selection, id) {
  const s = new Set(Array.isArray(selection) ? selection : []);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  return [...s];
}
export function selectAll(findings) {
  return (Array.isArray(findings) ? findings : []).map(f => f.id).filter(Boolean);
}

// 52056 — Triage heatmap: asset × vuln class counts, clickable to filter.
export function buildHeatmap(findings) {
  const matrix = {};
  for (const f of Array.isArray(findings) ? findings : []) {
    const asset = f.asset || 'unknown';
    const cls = f.vulnClass || 'unknown';
    if (!matrix[asset]) matrix[asset] = {};
    matrix[asset][cls] = (matrix[asset][cls] || 0) + 1;
  }
  const cells = [];
  for (const [asset, classes] of Object.entries(matrix)) {
    for (const [cls, count] of Object.entries(classes)) {
      cells.push({ asset, vulnClass: cls, count, filter: { asset, vulnClass: cls } });
    }
  }
  cells.sort((a, b) => b.count - a.count);
  return cells;
}

// 52057 — Finding relationship graph: links by shared endpoint, parameter, exploit chain.
export function buildRelationshipGraph(findings) {
  const list = Array.isArray(findings) ? findings : [];
  const nodes = list.map(f => ({
    id: f.id,
    label: f.title || f.id,
    vulnClass: f.vulnClass || 'unknown',
  }));
  const edges = [];
  const link = (key, type) => {
    const groups = new Map();
    list.forEach((f, i) => {
      const v = String(f[key] || '');
      if (!v) return;
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(list[i].id);
    });
    for (const ids of groups.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          edges.push({ from: ids[i], to: ids[j], via: type });
        }
      }
    }
  };
  link('endpoint', 'shared-endpoint');
  link('parameter', 'shared-parameter');
  link('chainId', 'exploit-chain');
  const dedup = new Map();
  for (const e of edges) {
    const k = [e.from, e.to, e.via].join('>');
    if (!dedup.has(k)) dedup.set(k, e);
  }
  return { nodes, edges: [...dedup.values()] };
}

// 52058 — "First look" guided tour: top 5 findings with walkthrough steps.
export function buildFirstLookTour(findings) {
  const list = (Array.isArray(findings) ? findings : [])
    .slice()
    .sort((a, b) => {
      const w = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (
        (w[String(a.severity).toLowerCase()] ?? 5) - (w[String(b.severity).toLowerCase()] ?? 5)
      );
    })
    .slice(0, 5);
  return {
    steps: list.map((f, i) => ({
      step: i + 1,
      findingId: f.id,
      headline: f.title || f.id,
      tip:
        i === 0
          ? 'Start here: highest severity. Read the evidence, then accept or dismiss.'
          : 'Check this next and apply the same accept/dismiss flow.',
    })),
    totalSteps: list.length,
  };
}

// 52059 — Reviewer workload balancer: distribute unreviewed findings across reviewers.
export function balanceWorkload(findings, reviewers) {
  const queue = (Array.isArray(findings) ? findings : []).filter(
    f => f.status === 'open' && !f.assignee
  );
  const team = (Array.isArray(reviewers) ? reviewers : []).map(r => ({
    name: String(r.name || 'reviewer'),
    load: Number(r.load || 0),
    assigned: [],
  }));
  if (team.length === 0) return { assignments: [], unassigned: queue.map(f => f.id) };
  const assignments = [];
  for (const f of queue) {
    team.sort((a, b) => a.load - b.load);
    team[0].load += 1;
    team[0].assigned.push(f.id);
    assignments.push({ findingId: f.id, reviewer: team[0].name });
  }
  return { assignments, unassigned: [] };
}

// 52060 — Triage export of decisions: who decided what and when, as CSV.
export function exportDecisions(decisions) {
  const rows = [['finding_id', 'decided_by', 'decision', 'decided_at']];
  for (const d of Array.isArray(decisions) ? decisions : []) {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    rows.push([esc(d.findingId), esc(d.decidedBy), esc(d.decision), esc(d.decidedAt)]);
  }
  return rows.map(r => r.join(',')).join('\n');
}

// 52061 — Comment reactions.
const REACTION_EMOJI = ['👍', '✅', '❓', '🔍', '🚫'];
export function reactionOptions() {
  return [...REACTION_EMOJI];
}
export function toggleReaction(comment, emoji, user) {
  const c = comment || {};
  const reactions = { ...(c.reactions || {}) };
  const users = new Set(reactions[emoji] || []);
  if (users.has(user)) users.delete(user);
  else users.add(user);
  if (users.size === 0) delete reactions[emoji];
  else reactions[emoji] = [...users];
  return { ...c, reactions };
}

// 52062 — Finding watchers.
export function watchFinding(finding, user) {
  const f = finding || {};
  const watchers = new Set(Array.isArray(f.watchers) ? f.watchers : []);
  watchers.add(user);
  return { ...f, watchers: [...watchers] };
}
export function unwatchFinding(finding, user) {
  const f = finding || {};
  return { ...f, watchers: (Array.isArray(f.watchers) ? f.watchers : []).filter(w => w !== user) };
}
export function notifiableWatchers(finding) {
  return Array.isArray(finding && finding.watchers) ? [...finding.watchers] : [];
}

// 52063 — Triage inbox API descriptor.
export function describeTriageApi() {
  return [
    {
      method: 'GET',
      path: '/api/v1/triage/queue',
      summary: 'list triage queue with filters (severity, team, status)',
    },
    {
      method: 'GET',
      path: '/api/v1/triage/queue/{findingId}',
      summary: 'fetch one finding with evidence and history',
    },
    {
      method: 'POST',
      path: '/api/v1/triage/queue/{findingId}/decide',
      summary: 'accept, dismiss, or escalate a finding',
    },
    {
      method: 'POST',
      path: '/api/v1/triage/queue/bulk',
      summary: 'apply a decision to many findings at once',
    },
    {
      method: 'GET',
      path: '/api/v1/triage/teams',
      summary: 'list per-team queues and routing rules',
    },
    { method: 'GET', path: '/api/v1/triage/export', summary: 'export decisions as CSV' },
    {
      method: 'POST',
      path: '/api/v1/triage/queue/{findingId}/comments',
      summary: 'comment on a finding',
    },
    {
      method: 'GET',
      path: '/api/v1/triage/openapi.json',
      summary: 'OpenAPI spec for the whole triage surface',
    },
  ];
}
