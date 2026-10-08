/**
 * huntOpsCore.js — Infinity AI · wave 47 (ideas 51861–51880)
 * Pure logic for hunt operations across the fleet: dependency gate status,
 * campaign and client rollups, search, filters, archiving, favorites, the
 * notifications hub, routing rules, ownership transfer, collaboration roles,
 * the activity feed, timeline comparison, notes, tags, saved views,
 * bulk export (JSON/CSV/markdown with injection-safe cells), per-hunt API
 * token descriptors, webhook payload descriptors, and SSO scoping.
 * No DOM, no network, no side effects: pure transforms over plain descriptors.
 * API tokens and webhook signatures here are deterministic SAMPLE descriptors
 * for UI display — never real credentials.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */
export const WAVE47_HUNTOPS_START = 51861;
export const WAVE47_HUNTOPS_END = 51880;

export const WAVE47_HUNTOPS_IDEAS = [
  { id: 51861, name: 'Hunt dependencies', status: 'done' },
  { id: 51862, name: 'Campaign view', status: 'done' },
  { id: 51863, name: 'Client view', status: 'done' },
  { id: 51864, name: 'Hunt search (mid-hunt)', status: 'done' },
  { id: 51865, name: 'Hunt filters', status: 'done' },
  { id: 51866, name: 'Hunt archiving (mid-hunt)', status: 'done' },
  { id: 51867, name: 'Hunt favorites', status: 'done' },
  { id: 51868, name: 'Hunt notifications hub', status: 'done' },
  { id: 51869, name: 'Notification routing (mid-hunt)', status: 'done' },
  { id: 51870, name: 'Hunt ownership', status: 'done' },
  { id: 51871, name: 'Hunt collaboration', status: 'done' },
  { id: 51872, name: 'Hunt activity feed', status: 'done' },
  { id: 51873, name: 'Hunt timeline compare', status: 'done' },
  { id: 51874, name: 'Hunt notes', status: 'done' },
  { id: 51875, name: 'Hunt tags', status: 'done' },
  { id: 51876, name: 'Hunt saved views', status: 'done' },
  { id: 51877, name: 'Hunt export all', status: 'done' },
  { id: 51878, name: 'Hunt API tokens', status: 'done' },
  { id: 51879, name: 'Hunt webhooks', status: 'done' },
  { id: 51880, name: 'Hunt SSO scoping', status: 'done' },
];

export const COLLAB_ROLES = ['viewer', 'analyst', 'admin'];

function hash32(s) {
  let h = 5381;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Escape user-controlled strings before they reach HTML/markdown surfaces.
export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 51861 — per-hunt dependency gate status: which gates are met, who is blocked
// dependencies: [{ huntId, gate: 'done' | 'reporting' }]
export function dependencyGates(hunts) {
  const byId = new Map((hunts || []).map(h => [h.id, h]));
  const satisfiedGate = (dep, gate) => {
    if (!dep) return false;
    if (gate === 'done') return dep.status === 'done';
    if (gate === 'reporting') return dep.phase === 'reporting' || dep.status === 'done';
    return false;
  };
  const rows = (hunts || [])
    .filter(h => (h.dependencies || []).length)
    .map(h => {
      const gates = (h.dependencies || []).map(d => ({
        depId: d.huntId,
        gate: d.gate,
        satisfied: satisfiedGate(byId.get(d.huntId), d.gate),
      }));
      return { huntId: h.id, name: h.name, gates, blocked: gates.some(g => !g.satisfied) };
    });
  return {
    rows,
    blocked: rows.filter(r => r.blocked).map(r => r.huntId),
    ready: rows.filter(r => !r.blocked).map(r => r.huntId),
    text: rows.length
      ? `${rows.filter(r => r.blocked).length} of ${rows.length} dependent hunts blocked on gates.`
      : 'No hunts declare dependencies.',
  };
}

// 51862 — campaign dashboard rollup across all its hunts
export function campaignRollup(hunts, campaignId) {
  const inCampaign = (hunts || []).filter(h => h.campaignId === campaignId);
  const findings = inCampaign.reduce((n, h) => n + (h.findings || []).length, 0);
  const activeHunts = inCampaign.filter(h => h.status === 'running').length;
  const avgProgress = inCampaign.length
    ? Math.round(inCampaign.reduce((n, h) => n + (h.progress || 0), 0) / inCampaign.length)
    : 0;
  const totalCostUsd =
    Math.round(inCampaign.reduce((n, h) => n + (h.budgetUsedUsd || 0), 0) * 100) / 100;
  const byStatus = {};
  for (const h of inCampaign)
    byStatus[h.status || 'unknown'] = (byStatus[h.status || 'unknown'] || 0) + 1;
  return {
    campaignId,
    hunts: inCampaign.length,
    findings,
    activeHunts,
    avgProgress,
    totalCostUsd,
    byStatus,
    huntIds: inCampaign.map(h => h.id),
    text: `Campaign ${campaignId}: ${inCampaign.length} hunts, ${findings} findings, ${activeHunts} active, avg ${avgProgress}% — $${totalCostUsd.toFixed(2)} spent.`,
  };
}

// 51863 — per-client rollup of hunts, findings, time, and spend
export function clientRollup(hunts, clientId) {
  const owned = (hunts || []).filter(h => h.clientId === clientId);
  const findings = owned.reduce((n, h) => n + (h.findings || []).length, 0);
  const totalTimeMs = owned.reduce((n, h) => n + Math.max(0, h.durationMs || 0), 0);
  const totalCostUsd =
    Math.round(owned.reduce((n, h) => n + (h.budgetUsedUsd || 0), 0) * 100) / 100;
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const h of owned)
    for (const f of h.findings || [])
      if (bySeverity[f.severity] != null) bySeverity[f.severity] += 1;
  return {
    clientId,
    hunts: owned.length,
    findings,
    totalTimeMs,
    totalTimeHrs: Math.round((totalTimeMs / 3600000) * 10) / 10,
    totalCostUsd,
    bySeverity,
    huntIds: owned.map(h => h.id),
    text: `Client ${clientId}: ${owned.length} hunts, ${findings} findings, ${(totalTimeMs / 3600000).toFixed(1)}h hunt time, $${totalCostUsd.toFixed(2)} spent.`,
  };
}

// 51864 — find any hunt by target, name, id, owner, or tag
export function searchHunts(hunts, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q)
    return {
      results: [],
      count: 0,
      query: '',
      text: 'Type to search hunts by target, name, owner, or tag.',
    };
  const results = (hunts || []).filter(h =>
    [h.id, h.name, h.target, h.owner, ...(h.tags || [])]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q))
  );
  return {
    results,
    count: results.length,
    query: q,
    text: results.length
      ? `${results.length} hunt${results.length === 1 ? '' : 's'} match “${query}”.`
      : `No hunts match “${query}”.`,
  };
}

// 51865 — filter by phase, severity, owner, health label, tag, or minimum findings
// filters: { phase?, status?, owner?, health?, tag?, severity?, minFindings? }
// health matches h.health when the caller attaches health labels to hunts.
export function filterHunts(hunts, filters) {
  const f = filters || {};
  const results = (hunts || []).filter(
    h =>
      (!f.phase || h.phase === f.phase) &&
      (!f.status || h.status === f.status) &&
      (!f.owner || h.owner === f.owner) &&
      (!f.health || h.health === f.health) &&
      (!f.tag || (h.tags || []).includes(f.tag)) &&
      (f.minFindings == null || (h.findings || []).length >= f.minFindings) &&
      (!f.severity || (h.findings || []).some(x => x.severity === f.severity))
  );
  return {
    results,
    count: results.length,
    filters: f,
    text: results.length
      ? `${results.length} hunt${results.length === 1 ? '' : 's'} pass the filters.`
      : 'No hunts pass the current filters.',
  };
}

// 51866 — archive a finished hunt; reopening restores it instantly
export function archiveHunt(hunts, id) {
  const updated = (hunts || []).map(h => (h.id === id ? { ...h, archived: true } : h));
  const hunt = updated.find(h => h.id === id) || null;
  return {
    hunts: updated,
    hunt,
    text: hunt ? `Hunt ${id} archived — reopen it any time.` : `Hunt ${id} not found.`,
  };
}

export function reopenHunt(hunts, id) {
  const updated = (hunts || []).map(h => (h.id === id ? { ...h, archived: false } : h));
  const hunt = updated.find(h => h.id === id) || null;
  return { hunts: updated, hunt, text: hunt ? `Hunt ${id} reopened.` : `Hunt ${id} not found.` };
}

// 51867 — pin critical hunts to the top of every list
export function favoriteHunt(hunts, id) {
  const updated = (hunts || []).map(h => (h.id === id ? { ...h, favorite: true } : h));
  return { hunts: updated, huntId: id, text: `Hunt ${id} pinned as a favorite.` };
}

export function unfavoriteHunt(hunts, id) {
  const updated = (hunts || []).map(h => (h.id === id ? { ...h, favorite: false } : h));
  return { hunts: updated, huntId: id, text: `Hunt ${id} removed from favorites.` };
}

// 51868 — one inbox for alerts from all hunts
// notifications: [{ id, huntId, severity, type, title, atMs, read }]
export function notificationsHub(notifications) {
  const items = [...(notifications || [])].sort((a, b) => (b.atMs || 0) - (a.atMs || 0));
  const unread = items.filter(n => !n.read).length;
  const groups = {};
  for (const n of items) {
    const k = n.severity || 'info';
    (groups[k] = groups[k] || []).push(n);
  }
  return {
    items,
    total: items.length,
    unread,
    groups,
    text: items.length
      ? `${unread} unread of ${items.length} notifications.`
      : 'Notification inbox is empty.',
  };
}

// 51869 — per-hunt routing rules decide who gets which alerts, on which channel
// rules: [{ id, match: { severity?, huntId?, type? }, channels: [], recipients: [] }]
export function routeNotifications(rules, notification) {
  const n = notification || {};
  const matched = (rules || []).filter(r => {
    const m = r.match || {};
    return (
      (!m.severity || m.severity === n.severity) &&
      (!m.huntId || m.huntId === n.huntId) &&
      (!m.type || m.type === n.type)
    );
  });
  const routes = matched.map(r => ({
    ruleId: r.id,
    channels: r.channels || ['inapp'],
    recipients: r.recipients || [],
  }));
  return {
    routes,
    matched: routes.length > 0,
    count: routes.length,
    text: routes.length
      ? `Alert routed by ${routes.length} rule${routes.length === 1 ? '' : 's'}: ${routes.map(r => r.ruleId).join(', ')}.`
      : 'No routing rule matched — alert stays in the hub only.',
  };
}

// 51870 — assign an owner; transfers keep a clean history
export function assignOwner(hunts, huntId, owner) {
  const updated = (hunts || []).map(h => (h.id === huntId ? { ...h, owner } : h));
  return { hunts: updated, huntId, owner, text: `Hunt ${huntId} assigned to ${owner}.` };
}

export function transferOwnership(hunts, huntId, newOwner, atMs = 0) {
  let previousOwner = null;
  const updated = (hunts || []).map(h => {
    if (h.id !== huntId) return h;
    previousOwner = h.owner || null;
    return {
      ...h,
      owner: newOwner,
      ownershipHistory: [
        ...(h.ownershipHistory || []),
        { from: previousOwner, to: newOwner, atMs },
      ],
    };
  });
  return {
    hunts: updated,
    huntId,
    previousOwner,
    newOwner,
    text: previousOwner
      ? `Ownership of ${huntId} transferred from ${previousOwner} to ${newOwner}.`
      : `Hunt ${huntId} assigned to ${newOwner}.`,
  };
}

// 51871 — invite a teammate to a hunt with viewer / analyst / admin
export function inviteCollaborator(hunt, user, role, atMs = 0) {
  const h = hunt || {};
  if (!COLLAB_ROLES.includes(role)) {
    return { ok: false, hunt: h, error: `Unknown role “${role}” — use viewer, analyst, or admin.` };
  }
  const collaborators = [
    ...(h.collaborators || []).filter(c => c.user !== user),
    { user, role, invitedAtMs: atMs },
  ];
  const invitation = { huntId: h.id || null, user, role, atMs };
  return {
    ok: true,
    hunt: { ...h, collaborators },
    invitation,
    text: `${user} invited to ${h.id || 'the hunt'} as ${role}.`,
  };
}

// 51872 — every action across hunts in one chronological stream
// events: [{ atMs, actor, huntId, action, detail }]
export function activityFeed(events) {
  const items = [...(events || [])].sort((a, b) => (b.atMs || 0) - (a.atMs || 0));
  return {
    items,
    count: items.length,
    text: items.length ? `${items.length} events, newest first.` : 'No activity recorded yet.',
  };
}

// 51873 — overlay two hunts' progress timelines to compare pace
// a, b: { id, samples: [{ atMs, progress }] }
export function timelineCompare(a, b) {
  const x = a || {};
  const y = b || {};
  const sx = [...(x.samples || [])].sort((p, q) => p.atMs - q.atMs);
  const sy = [...(y.samples || [])].sort((p, q) => p.atMs - q.atMs);
  const at = (samples, t) => {
    let v = 0;
    for (const p of samples) {
      if (p.atMs <= t) v = p.progress;
      else break;
    }
    return v;
  };
  const times = [...new Set([...sx.map(p => p.atMs), ...sy.map(p => p.atMs)])].sort(
    (p, q) => p - q
  );
  const rows = times.map(t => {
    const ap = at(sx, t);
    const bp = at(sy, t);
    return { atMs: t, aProgress: ap, bProgress: bp, delta: ap - bp };
  });
  const la = sx.length ? sx[sx.length - 1].progress : 0;
  const lb = sy.length ? sy[sy.length - 1].progress : 0;
  const leader = la === lb ? null : la > lb ? x.id || null : y.id || null;
  return {
    aId: x.id || null,
    bId: y.id || null,
    rows,
    leader,
    delta: la - lb,
    text: leader
      ? `${leader} is ahead by ${Math.abs(la - lb)} points of progress.`
      : 'Both hunts are on the same pace.',
  };
}

// 51874 — per-hunt notes visible to the whole team (body escaped for HTML)
export function addHuntNote(hunts, huntId, note) {
  const n = note || {};
  const full = {
    author: n.author || 'unknown',
    body: String(n.body || ''),
    atMs: n.atMs || 0,
    bodyHtml: escapeHtml(n.body || ''),
  };
  const updated = (hunts || []).map(h =>
    h.id === huntId ? { ...h, notes: [...(h.notes || []), full] } : h
  );
  return { hunts: updated, huntId, note: full, text: `Note added to ${huntId} by ${full.author}.` };
}

// 51875 — custom tags for slicing hunts any way the team likes
export function tagHunt(hunts, huntId, tags) {
  const add = (Array.isArray(tags) ? tags : [tags]).filter(Boolean).map(String);
  const updated = (hunts || []).map(h =>
    h.id === huntId ? { ...h, tags: [...new Set([...(h.tags || []), ...add])] } : h
  );
  return {
    hunts: updated,
    huntId,
    tags: add,
    text: `Tagged ${huntId}: ${add.join(', ') || 'no new tags'}.`,
  };
}

// 51876 — named filter sets ("my criticals this week") applied in one tap
// view: { name, filters, sortBy?: 'progress'|'findings'|'name', sortDir?: 'asc'|'desc' }
export function applySavedView(hunts, view) {
  const v = view || {};
  const filtered = filterHunts(hunts, v.filters || {}).results;
  const dir = v.sortDir === 'desc' ? -1 : 1;
  const val = h =>
    v.sortBy === 'progress'
      ? h.progress || 0
      : v.sortBy === 'name'
        ? String(h.name || '')
        : (h.findings || []).length;
  const sorted = [...filtered].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });
  return {
    hunts: sorted,
    viewName: v.name || 'unnamed',
    count: sorted.length,
    text: `View “${v.name || 'unnamed'}”: ${sorted.length} hunt${sorted.length === 1 ? '' : 's'}.`,
  };
}

// 51877 — bulk-export several hunts at once as JSON, CSV, or markdown
// CSV cells guard against formula injection; markdown cells are HTML-escaped.
function csvCell(v) {
  const s = String(v == null ? '' : v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function bulkExport(hunts, ids, format = 'json') {
  const set = new Set(ids || []);
  const rows = (hunts || [])
    .filter(h => set.has(h.id))
    .map(h => ({
      id: h.id,
      name: h.name,
      target: h.target,
      phase: h.phase,
      status: h.status,
      progress: h.progress || 0,
      findings: (h.findings || []).length,
      owner: h.owner || '',
      tags: (h.tags || []).join(';'),
    }));
  let content;
  let filename;
  if (format === 'csv') {
    const head = [
      'id',
      'name',
      'target',
      'phase',
      'status',
      'progress',
      'findings',
      'owner',
      'tags',
    ];
    content = `${head.join(',')}\r\n${rows.map(r => head.map(k => csvCell(r[k])).join(',')).join('\r\n')}\r\n`;
    filename = 'hunts-export.csv';
  } else if (format === 'markdown') {
    const lines = [
      '# Hunt export',
      '',
      '| id | name | target | phase | status | progress | findings |',
      '|---|---|---|---|---|---|---|',
    ];
    for (const r of rows) {
      lines.push(
        `| ${escapeHtml(r.id)} | ${escapeHtml(r.name)} | ${escapeHtml(r.target)} | ${escapeHtml(r.phase)} | ${escapeHtml(r.status)} | ${r.progress}% | ${r.findings} |`
      );
    }
    content = `${lines.join('\n')}\n`;
    filename = 'hunts-export.md';
  } else {
    content = JSON.stringify({ exported: 'hunts', count: rows.length, hunts: rows }, null, 2);
    filename = 'hunts-export.json';
  }
  return {
    format,
    filename,
    content,
    count: rows.length,
    text: `Exported ${rows.length} hunt${rows.length === 1 ? '' : 's'} as ${format} (${filename}).`,
  };
}

// 51878 — per-hunt API token descriptor. The prefix is a deterministic SAMPLE
// for UI display — it is not a credential and no secret is ever produced here.
export function issueApiToken(huntId) {
  const prefix = `dm47_sample_${hash32(String(huntId || '')).slice(0, 8)}`;
  return {
    tokenPrefix: prefix,
    scopes: ['hunt:read', 'findings:read', 'webhooks:write'],
    issuedAt: '1970-01-01T00:00:00.000Z',
    sample: true,
    label: 'SAMPLE DESCRIPTOR — not a real credential',
    note: 'Real tokens are issued by the backend and never rendered in full; this deterministic prefix exists only so integrations can be recognized in the UI.',
    text: `Sample API token descriptor for ${huntId} (${prefix}…) — not a credential.`,
  };
}

// 51879 — per-hunt webhook event payload descriptor (sample signature, not real)
export function webhookPayload(event) {
  const e = event || {};
  return {
    event: e.type || 'hunt.event',
    huntId: e.huntId || null,
    data: e.data || {},
    signature: `sample-sha256:${hash32(JSON.stringify(e)).slice(0, 12)}`,
    deliveredAt: '1970-01-01T00:00:00.000Z',
    sample: true,
    note: 'Sample descriptor — not a real signature; the backend signs live deliveries.',
    text: `Webhook payload descriptor for ${e.type || 'hunt.event'} (sample signature).`,
  };
}

// 51880 — SSO scoping: a member sees only the hunts they are assigned to
// user: { id, assignedHuntIds: [...] | 'all' }
export function ssoScope(user, hunts) {
  const u = user || {};
  const list = hunts || [];
  const visible =
    u.assignedHuntIds === 'all' ? list : list.filter(h => (u.assignedHuntIds || []).includes(h.id));
  return {
    userId: u.id || null,
    hunts: visible,
    count: visible.length,
    hidden: list.length - visible.length,
    text: visible.length
      ? `${u.id || 'user'} can see ${visible.length} of ${list.length} hunts.`
      : `${u.id || 'user'} has no hunts in scope.`,
  };
}
