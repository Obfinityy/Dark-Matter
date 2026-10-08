// multiHuntCore.js — Infinity AI · wave 47 (ideas 51841–51860)
// Pure logic for the multi-hunt command center: hunt switching, live tabs,
// fleet rollups, side-by-side comparison, global pause/resume, cross-hunt Q&A,
// priority ranking, priority-honoring resource allocation, attention sorting,
// grouping, bulk steering, bulk approvals, hunt cloning, templates, merged
// findings feeds, cross-hunt dedup, health scores, stalled-hunt alerts, shared
// request-budget pools, per-hunt caps, the scheduling queue, and dependency
// resolution (topological start order for "start B when A reaches reporting").
// No DOM, no network, no side effects: pure transforms over plain descriptors.
// Hunt descriptor shape used throughout:
// { id, name, target, phase, status, progress, findings:[{id,title,severity,
//   signature,atMs}], startedAtMs, lastActivityMs, etaMs, priority, owner,
//   campaignId, clientId, tags:[], needsAttention, blockedReason,
//   budgetUsedUsd, requestsUsed, dependencies:[{huntId, gate}] }

export const WAVE47_MULTIHUNT_START = 51841;
export const WAVE47_MULTIHUNT_END = 51860;

export const WAVE47_MULTIHUNT_IDEAS = [
  { id: 51841, name: 'Hunt switcher bar', status: 'done' },
  { id: 51842, name: 'Hunt tabs', status: 'done' },
  { id: 51843, name: 'Unified command center', status: 'done' },
  { id: 51844, name: 'Hunt comparison view (mid-hunt)', status: 'done' },
  { id: 51845, name: 'Global pause/resume', status: 'done' },
  { id: 51846, name: 'Cross-hunt chat', status: 'done' },
  { id: 51847, name: 'Hunt priority ranking', status: 'done' },
  { id: 51848, name: 'Attention-needed sorting', status: 'done' },
  { id: 51849, name: 'Hunt grouping', status: 'done' },
  { id: 51850, name: 'Bulk steering', status: 'done' },
  { id: 51851, name: 'Bulk approvals', status: 'done' },
  { id: 51852, name: 'Hunt cloning', status: 'done' },
  { id: 51853, name: 'Hunt templates', status: 'done' },
  { id: 51854, name: 'Cross-hunt findings', status: 'done' },
  { id: 51855, name: 'Cross-hunt deduplication (mid-hunt)', status: 'done' },
  { id: 51856, name: 'Hunt health scores', status: 'done' },
  { id: 51857, name: 'Stalled-hunt alerts', status: 'done' },
  { id: 51858, name: 'Hunt resource sharing', status: 'done' },
  { id: 51859, name: 'Per-hunt resource caps', status: 'done' },
  { id: 51860, name: 'Hunt scheduling (mid-hunt)', status: 'done' },
];

// A hunt counts as stalled when a running hunt shows no activity this long.
export const STALL_MS = 20 * 60 * 1000;

function fmtDuration(ms) {
  if (ms == null || ms < 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function slug(s) {
  return (
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'hunt'
  );
}

function hash32(s) {
  let h = 5381;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function isQuiet(h, nowMs) {
  return h.status === 'running' && nowMs != null && nowMs - (h.lastActivityMs || 0) > STALL_MS;
}

// 51841 — switch the active hunt; returns the new active hunt state
// previousId: the hunt that was active before (may be null)
export function switchHunt(hunts, id, previousId = null) {
  const active = (hunts || []).find(h => h.id === id) || null;
  return {
    activeId: active ? active.id : null,
    previousId,
    active,
    text: active
      ? `Switched to ${active.name} (${active.id}) — ${active.phase}, ${active.progress || 0}% complete.`
      : `Hunt ${id} not found — staying on ${previousId || 'nothing'}.`,
  };
}

// 51842 — tab descriptors with live status badges
// badge kinds: live | paused | alert | done | queued
export function huntTabs(hunts, nowMs) {
  const tabs = (hunts || []).map(h => {
    const badge =
      h.needsAttention || isQuiet(h, nowMs)
        ? { kind: 'alert', label: 'needs attention' }
        : h.status === 'paused'
          ? { kind: 'paused', label: 'paused' }
          : h.status === 'done'
            ? { kind: 'done', label: 'done' }
            : h.status === 'queued'
              ? { kind: 'queued', label: 'queued' }
              : { kind: 'live', label: 'live' };
    return {
      id: h.id,
      name: h.name,
      target: h.target,
      phase: h.phase,
      status: h.status,
      progress: h.progress || 0,
      findings: (h.findings || []).length,
      badge,
    };
  });
  return {
    tabs,
    count: tabs.length,
    live: tabs.filter(t => t.badge.kind === 'live').length,
    alerts: tabs.filter(t => t.badge.kind === 'alert').length,
    text: `${tabs.length} hunt tabs — ${tabs.filter(t => t.badge.kind === 'live').length} live, ${tabs.filter(t => t.badge.kind === 'alert').length} need attention.`,
  };
}

// 51843 — one-screen rollup across the whole fleet
export function commandCenterMetrics(hunts) {
  const list = hunts || [];
  const totalFindings = list.reduce((n, h) => n + (h.findings || []).length, 0);
  const activeHunts = list.filter(h => h.status === 'running').length;
  const avgProgress = list.length
    ? Math.round(list.reduce((n, h) => n + (h.progress || 0), 0) / list.length)
    : 0;
  const totalEtaMs = list.reduce((n, h) => n + Math.max(0, h.etaMs || 0), 0);
  const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const h of list) {
    for (const f of h.findings || []) {
      if (severityBreakdown[f.severity] != null) severityBreakdown[f.severity] += 1;
      else severityBreakdown.info += 1;
    }
  }
  return {
    totalHunts: list.length,
    activeHunts,
    pausedHunts: list.filter(h => h.status === 'paused').length,
    queuedHunts: list.filter(h => h.status === 'queued').length,
    doneHunts: list.filter(h => h.status === 'done').length,
    totalFindings,
    avgProgress,
    totalEtaMs,
    totalEta: fmtDuration(totalEtaMs),
    severityBreakdown,
    text: `${activeHunts}/${list.length} hunts running · ${totalFindings} findings · avg progress ${avgProgress}% · combined ETA ${fmtDuration(totalEtaMs)}.`,
  };
}

// 51844 — side-by-side comparison of two hunts: progress, findings, ETA, phase
export function compareHunts(a, b) {
  const x = a || {};
  const y = b || {};
  const rows = [
    {
      metric: 'progress',
      a: `${x.progress || 0}%`,
      b: `${y.progress || 0}%`,
      aNum: x.progress || 0,
      bNum: y.progress || 0,
      higherBetter: true,
    },
    {
      metric: 'findings',
      a: String((x.findings || []).length),
      b: String((y.findings || []).length),
      aNum: (x.findings || []).length,
      bNum: (y.findings || []).length,
      higherBetter: true,
    },
    {
      metric: 'eta',
      a: fmtDuration(x.etaMs),
      b: fmtDuration(y.etaMs),
      aNum: x.etaMs == null ? Infinity : x.etaMs,
      bNum: y.etaMs == null ? Infinity : y.etaMs,
      higherBetter: false,
    },
    {
      metric: 'phase',
      a: x.phase || '—',
      b: y.phase || '—',
      aNum: null,
      bNum: null,
      higherBetter: null,
    },
    {
      metric: 'status',
      a: x.status || '—',
      b: y.status || '—',
      aNum: null,
      bNum: null,
      higherBetter: null,
    },
  ];
  let aWins = 0;
  let bWins = 0;
  for (const r of rows) {
    if (r.higherBetter == null || r.aNum === r.bNum) continue;
    if (r.higherBetter ? r.aNum > r.bNum : r.aNum < r.bNum) aWins += 1;
    else bWins += 1;
  }
  const leader = aWins === bWins ? null : aWins > bWins ? x.id || null : y.id || null;
  return {
    aId: x.id || null,
    bId: y.id || null,
    rows,
    aWins,
    bWins,
    leader,
    text: leader
      ? `${leader} leads ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)} on numeric metrics.`
      : 'The two hunts are tied on numeric metrics.',
  };
}

// 51845 — pause every running hunt, or only the given subset
export function globalPause(hunts, ids) {
  const list = hunts || [];
  const set = ids ? new Set(ids) : null;
  const pausedIds = [];
  const updated = list.map(h => {
    if (h.status === 'running' && (!set || set.has(h.id))) {
      pausedIds.push(h.id);
      return { ...h, status: 'paused' };
    }
    return h;
  });
  return {
    hunts: updated,
    pausedIds,
    count: pausedIds.length,
    text: pausedIds.length
      ? `Paused ${pausedIds.length} hunt${pausedIds.length === 1 ? '' : 's'}: ${pausedIds.join(', ')}.`
      : 'Nothing to pause — no running hunts matched.',
  };
}

// 51845 — resume every paused hunt, or only the given subset
export function globalResume(hunts, ids) {
  const list = hunts || [];
  const set = ids ? new Set(ids) : null;
  const resumedIds = [];
  const updated = list.map(h => {
    if (h.status === 'paused' && (!set || set.has(h.id))) {
      resumedIds.push(h.id);
      return { ...h, status: 'running' };
    }
    return h;
  });
  return {
    hunts: updated,
    resumedIds,
    count: resumedIds.length,
    text: resumedIds.length
      ? `Resumed ${resumedIds.length} hunt${resumedIds.length === 1 ? '' : 's'}: ${resumedIds.join(', ')}.`
      : 'Nothing to resume — no paused hunts matched.',
  };
}

// 51846 — answer a coordinator question from real fleet data (grounded summary)
export function crossHuntChatAnswer(question, hunts, nowMs) {
  const q = String(question || '').toLowerCase();
  const list = hunts || [];
  const m = commandCenterMetrics(list);
  const parts = [];
  if (/progress|how.*(going|doing)|status|overview/.test(q)) {
    parts.push(
      `${m.activeHunts} of ${m.totalHunts} hunts running, average progress ${m.avgProgress}%.`
    );
  }
  if (/finding|vuln|bug|result/.test(q)) {
    const top = [...list].sort((a, b) => (b.findings || []).length - (a.findings || []).length)[0];
    parts.push(
      `${m.totalFindings} findings fleet-wide (${m.severityBreakdown.critical} critical, ${m.severityBreakdown.high} high).` +
        (top && (top.findings || []).length
          ? ` Most from ${top.name} (${(top.findings || []).length}).`
          : '')
    );
  }
  if (/stall|quiet|stuck|silent/.test(q)) {
    const s = stalledAlerts(list, nowMs == null ? 0 : nowMs);
    parts.push(
      s.count
        ? `${s.count} stalled: ${s.alerts.map(a => `${a.name} (quiet ${fmtDuration(a.quietForMs)})`).join(', ')}.`
        : 'No hunts are stalled right now.'
    );
  }
  if (/eta|long|finish|done|remain/.test(q)) {
    parts.push(`Combined remaining ETA ${m.totalEta}.`);
  }
  if (/paus/.test(q)) {
    parts.push(`${m.pausedHunts} paused, ${m.queuedHunts} queued.`);
  }
  if (/health/.test(q)) {
    const weak = list
      .map(h => ({ h, s: healthScore(h, nowMs) }))
      .filter(x => x.s.label !== 'on-track');
    parts.push(
      weak.length
        ? `Needs care: ${weak.map(x => `${x.h.name} (${x.s.label}, ${x.s.score})`).join(', ')}.`
        : 'Every hunt is on track.'
    );
  }
  if (!parts.length) {
    parts.push(m.text);
  }
  return parts.join(' ');
}

// 51847 — reorder hunts into priority order; priority numbers follow the order
// order: array of hunt ids, highest priority first
export function rankHunts(hunts, order) {
  const list = hunts || [];
  const rank = new Map((order || []).map((id, i) => [id, i]));
  const ranked = [...list]
    .sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
      return ra - rb || (a.priority || 999) - (b.priority || 999);
    })
    .map((h, i) => ({ ...h, priority: i + 1 }));
  return {
    hunts: ranked,
    order: ranked.map(h => h.id),
    text: `Priority order: ${ranked.map(h => `${h.priority}. ${h.name}`).join(' · ')}.`,
  };
}

// 51847 — split a shared resource pool honoring priority order (rank 1 first)
export function allocateResources(hunts, pool) {
  const list = [...(hunts || [])].sort((a, b) => (a.priority || 999) - (b.priority || 999));
  const n = list.length;
  const totalW = list.reduce((sum, _, i) => sum + (n - i), 0);
  const R = Math.max(0, (pool && pool.requests) || 0);
  const B = Math.max(0, (pool && pool.budgetUsd) || 0);
  let rRem = R;
  let bRem = B;
  const allocations = list.map((h, i) => {
    const w = n - i;
    const last = i === n - 1;
    const requests = last ? rRem : Math.floor((R * w) / totalW);
    const budgetUsd = last
      ? Math.round(bRem * 100) / 100
      : Math.floor(((B * w) / totalW) * 100) / 100;
    rRem -= requests;
    bRem = Math.round((bRem - budgetUsd) * 100) / 100;
    return {
      huntId: h.id,
      name: h.name,
      priority: h.priority || i + 1,
      weight: w,
      requests,
      budgetUsd,
    };
  });
  return {
    allocations,
    pool: { requests: R, budgetUsd: B },
    text: `Pool split across ${n} hunts by priority: ${allocations.map(a => `${a.huntId} ${a.requests} req / $${a.budgetUsd.toFixed(2)}`).join(' · ')}.`,
  };
}

// 51848 — hunts needing input float to the top: attention, stalled, blocked, paused
export function attentionSort(hunts, nowMs) {
  const rankOf = h => {
    if (h.needsAttention) return 0;
    if (h.status === 'stalled' || isQuiet(h, nowMs)) return 1;
    if (h.blockedReason) return 2;
    if (h.status === 'paused') return 3;
    return 4;
  };
  const sorted = [...(hunts || [])].sort(
    (a, b) => rankOf(a) - rankOf(b) || (a.progress || 0) - (b.progress || 0)
  );
  return {
    hunts: sorted,
    order: sorted.map(h => h.id),
    top: sorted[0] || null,
    text: sorted.length
      ? `Top of the queue: ${sorted[0].name} (${sorted[0].needsAttention ? 'needs attention' : sorted[0].status}).`
      : 'No hunts to sort.',
  };
}

// 51849 — organize hunts into campaign / client / status / phase / owner folders
export function groupHunts(hunts, key) {
  const props = {
    campaign: 'campaignId',
    client: 'clientId',
    status: 'status',
    phase: 'phase',
    owner: 'owner',
  };
  const prop = props[key] || key;
  const map = new Map();
  for (const h of hunts || []) {
    const k = h[prop] == null || h[prop] === '' ? 'ungrouped' : String(h[prop]);
    if (!map.has(k)) map.set(k, { key: k, huntIds: [], findings: 0 });
    const g = map.get(k);
    g.huntIds.push(h.id);
    g.findings += (h.findings || []).length;
  }
  const groups = [...map.values()]
    .map(g => ({ ...g, hunts: g.huntIds.length }))
    .sort((a, b) => b.findings - a.findings || b.hunts - a.hunts);
  return {
    groups,
    groupBy: key,
    count: groups.length,
    text: `${groups.length} group${groups.length === 1 ? '' : 's'} by ${key}: ${groups.map(g => `${g.key} (${g.hunts})`).join(', ') || 'none'}.`,
  };
}

// 51850 — apply one steering command to several hunts at once
// command: { type: 'pause'|'resume'|'setPhase'|'addTag'|'setPriority', phase?, tag?, priority? }
export function bulkSteer(hunts, ids, command) {
  const KNOWN = ['pause', 'resume', 'setPhase', 'addTag', 'setPriority'];
  const set = new Set(ids || []);
  const cmd = command || {};
  const ok = KNOWN.includes(cmd.type);
  const results = [];
  const updated = (hunts || []).map(h => {
    if (!set.has(h.id)) return h;
    let nh = { ...h };
    let detail = '';
    if (ok && cmd.type === 'pause' && nh.status === 'running') {
      nh = { ...nh, status: 'paused' };
      detail = 'paused';
    } else if (ok && cmd.type === 'resume' && nh.status === 'paused') {
      nh = { ...nh, status: 'running' };
      detail = 'resumed';
    } else if (ok && cmd.type === 'setPhase' && cmd.phase) {
      nh = { ...nh, phase: cmd.phase };
      detail = `phase → ${cmd.phase}`;
    } else if (ok && cmd.type === 'addTag' && cmd.tag) {
      nh = { ...nh, tags: [...new Set([...(nh.tags || []), cmd.tag])] };
      detail = `tagged “${cmd.tag}”`;
    } else if (ok && cmd.type === 'setPriority' && cmd.priority != null) {
      nh = { ...nh, priority: cmd.priority };
      detail = `priority → ${cmd.priority}`;
    } else {
      detail = `no-op (${cmd.type || 'missing command'})`;
    }
    results.push({ huntId: h.id, ok, detail });
    return nh;
  });
  return {
    hunts: updated,
    results,
    applied: results.filter(r => r.ok).length,
    text: ok
      ? `Steering “${cmd.type}” applied to ${results.filter(r => r.ok).length} hunt${results.length === 1 ? '' : 's'}.`
      : `Unknown steering command “${cmd.type}” — nothing changed.`,
  };
}

// 51851 — decide a whole queue of pending approvals in one action
// queue: [{ id, huntId, kind, summary, decision? }]; items keep their own
// decision when set, otherwise take the bulk decision
export function bulkApprove(queue, decision = 'approved', atMs = 0) {
  const decided = (queue || []).map(q => ({
    id: q.id,
    huntId: q.huntId,
    kind: q.kind,
    summary: q.summary,
    decision: q.decision || decision,
    decidedAtMs: atMs,
  }));
  const approved = decided.filter(d => d.decision === 'approved').length;
  return {
    decided,
    count: decided.length,
    approved,
    rejected: decided.filter(d => d.decision === 'rejected').length,
    text: decided.length
      ? `Decided ${decided.length} approvals: ${approved} approved, ${decided.length - approved} otherwise.`
      : 'Approval queue is empty.',
  };
}

// 51852 — clone a hunt's config into a fresh sibling (progress/findings reset)
export function cloneHuntConfig(hunt) {
  const h = hunt || {};
  const clone = {
    ...h,
    id: `${h.id || 'H-x'}-clone`,
    name: `${h.name || 'hunt'} (clone)`,
    status: 'queued',
    phase: 'recon',
    progress: 0,
    findings: [],
    needsAttention: false,
    blockedReason: null,
    startedAtMs: null,
    lastActivityMs: null,
    budgetUsedUsd: 0,
    requestsUsed: 0,
  };
  return {
    hunt: clone,
    text: `Cloned ${h.id || '?'} → ${clone.id}: config preserved, findings and progress reset.`,
  };
}

// 51853 — launch a new hunt from a saved template configuration
export function applyTemplate(template) {
  const t = template || {};
  const hunt = {
    id: `H-${slug(t.name)}-${hash32(t.name || 'template').slice(0, 4)}`,
    name: t.name || 'Untitled hunt',
    target: t.target || '',
    scope: t.scope || '',
    strategy: t.strategy || 'balanced',
    phases:
      t.phases && t.phases.length
        ? [...t.phases]
        : ['recon', 'scanning', 'exploitation', 'reporting'],
    budgetCapUsd: t.budgetCapUsd == null ? null : t.budgetCapUsd,
    tags: [...(t.tags || [])],
    status: 'queued',
    phase: 'recon',
    progress: 0,
    findings: [],
    priority: t.priority || 5,
    owner: t.owner || null,
    dependencies: [],
  };
  return {
    hunt,
    template: t.name || 'unnamed',
    text: `New hunt ${hunt.id} launched from template “${t.name || 'unnamed'}” targeting ${hunt.target || 'no target'}.`,
  };
}

// 51854 — one merged feed of findings from every hunt, newest first
export function mergeFindingsFeeds(hunts) {
  const feed = [];
  for (const h of hunts || []) {
    for (const f of h.findings || []) feed.push({ ...f, huntId: h.id, huntName: h.name });
  }
  feed.sort((a, b) => (b.atMs || 0) - (a.atMs || 0));
  return {
    feed,
    count: feed.length,
    hunts: (hunts || []).length,
    text: `${feed.length} findings merged from ${(hunts || []).length} hunts.`,
  };
}

// 51855 — link identical finding signatures across hunts automatically
export function dedupeFindings(feed) {
  const map = new Map();
  for (const f of feed || []) {
    const sig = f.signature || `${f.severity || 'info'}:${f.title || f.id}`;
    if (!map.has(sig)) {
      map.set(sig, {
        signature: sig,
        findingIds: [],
        hunts: [],
        representative: { id: f.id, title: f.title, severity: f.severity },
      });
    }
    const g = map.get(sig);
    g.findingIds.push(f.id);
    if (f.huntId && !g.hunts.includes(f.huntId)) g.hunts.push(f.huntId);
  }
  const groups = [...map.values()];
  const total = (feed || []).length;
  const crossHunt = groups.filter(g => g.hunts.length > 1);
  return {
    groups,
    unique: groups.length,
    total,
    duplicates: total - groups.length,
    crossHuntLinks: crossHunt.length,
    crossHuntGroups: crossHunt.map(g => ({
      signature: g.signature,
      hunts: g.hunts,
      count: g.findingIds.length,
    })),
    text:
      total - groups.length
        ? `${total - groups.length} duplicate${total - groups.length === 1 ? '' : 's'} linked into ${groups.length} unique findings (${crossHunt.length} span multiple hunts).`
        : `${total} findings, all unique — nothing to link.`,
  };
}

// 51856 — at-a-glance health: on-track / struggling / stalled with a 0–100 score
export function healthScore(hunt, nowMs) {
  const h = hunt || {};
  let score = 100;
  const reasons = [];
  if (h.status === 'stalled') {
    score = Math.min(score, 20);
    reasons.push('marked stalled');
  }
  if (isQuiet(h, nowMs)) {
    score -= 45;
    reasons.push('no activity for 20+ min');
  }
  if (h.needsAttention) {
    score -= 20;
    reasons.push('needs attention');
  }
  if (h.blockedReason) {
    score -= 25;
    reasons.push(`blocked: ${h.blockedReason}`);
  }
  if (h.status === 'running' && (h.progress || 0) < 25 && (h.findings || []).length === 0) {
    score -= 15;
    reasons.push('slow start, no findings yet');
  }
  if (h.status === 'paused') {
    score -= 10;
    reasons.push('paused');
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 70 ? 'on-track' : score >= 40 ? 'struggling' : 'stalled';
  return {
    huntId: h.id || null,
    score,
    label,
    reasons,
    text: `Hunt ${h.id || '?'} health ${score}/100 — ${label}${reasons.length ? ` (${reasons.join('; ')})` : ''}.`,
  };
}

// 51857 — flag every hunt that went quiet unexpectedly
export function stalledAlerts(hunts, now) {
  const t = now == null ? 0 : now;
  const alerts = (hunts || [])
    .filter(h => isQuiet(h, t))
    .map(h => ({
      huntId: h.id,
      name: h.name,
      quietForMs: t - (h.lastActivityMs || 0),
      quietFor: fmtDuration(t - (h.lastActivityMs || 0)),
      severity: t - (h.lastActivityMs || 0) > 2 * STALL_MS ? 'critical' : 'warning',
    }))
    .sort((a, b) => b.quietForMs - a.quietForMs);
  return {
    alerts,
    count: alerts.length,
    text: alerts.length
      ? `${alerts.length} stalled hunt${alerts.length === 1 ? '' : 's'}: ${alerts.map(a => `${a.name} (quiet ${a.quietFor})`).join(', ')}.`
      : 'No hunts are stalled — everything active reported recently.',
  };
}

// 51858 — a shared request-budget pool split across hunts; track what remains
export function sharePool(pool, allocations) {
  const p = pool || {};
  const rows = allocations || [];
  const usedRequests = rows.reduce((n, a) => n + (a.requests || 0), 0);
  const usedBudget = Math.round(rows.reduce((n, a) => n + (a.budgetUsd || 0), 0) * 100) / 100;
  const remaining = {
    requests: Math.max(0, (p.totalRequests || 0) - usedRequests),
    budgetUsd: Math.max(0, Math.round(((p.totalBudgetUsd || 0) - usedBudget) * 100) / 100),
  };
  const over = usedRequests > (p.totalRequests || 0) || usedBudget > (p.totalBudgetUsd || 0);
  return {
    poolId: p.id || null,
    poolName: p.name || 'shared pool',
    rows,
    used: { requests: usedRequests, budgetUsd: usedBudget },
    remaining,
    over,
    text: over
      ? `Pool “${p.name || 'shared pool'}” is over-allocated.`
      : `Pool “${p.name || 'shared pool'}”: ${remaining.requests.toLocaleString('en-US')} requests and $${remaining.budgetUsd.toFixed(2)} remaining.`,
  };
}

// 51859 — individual limits inside the shared pool; usage is clamped, excess flagged
export function enforceCaps(hunts, caps) {
  const c = caps || {};
  const violations = [];
  const updated = (hunts || []).map(h => {
    const cap = c[h.id];
    if (!cap) return h;
    let nh = { ...h };
    if (cap.maxBudgetUsd != null && (nh.budgetUsedUsd || 0) > cap.maxBudgetUsd) {
      violations.push({
        huntId: h.id,
        metric: 'budgetUsd',
        used: nh.budgetUsedUsd,
        cap: cap.maxBudgetUsd,
      });
      nh = { ...nh, budgetUsedUsd: cap.maxBudgetUsd, needsAttention: true };
    }
    if (cap.maxRequests != null && (nh.requestsUsed || 0) > cap.maxRequests) {
      violations.push({
        huntId: h.id,
        metric: 'requests',
        used: nh.requestsUsed,
        cap: cap.maxRequests,
      });
      nh = { ...nh, requestsUsed: cap.maxRequests, needsAttention: true };
    }
    return nh;
  });
  return {
    hunts: updated,
    violations,
    count: violations.length,
    text: violations.length
      ? `${violations.length} cap violation${violations.length === 1 ? '' : 's'}: ${violations.map(v => `${v.huntId} ${v.metric} ${v.used} > ${v.cap}`).join(', ')}.`
      : 'Every hunt is inside its resource caps.',
  };
}

// 51860 — queue hunts to start when others finish; dependency-free hunts first
// queue: [{ huntId, position?, after?: [huntIds] }]
export function scheduleQueue(queue) {
  const items = [...(queue || [])];
  const ready = items
    .filter(q => !(q.after && q.after.length))
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const waiting = items
    .filter(q => q.after && q.after.length)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const order = [...ready, ...waiting].map(q => q.huntId);
  return {
    order,
    ready: ready.map(q => q.huntId),
    waiting: waiting.map(q => ({ huntId: q.huntId, after: [...q.after] })),
    text: order.length
      ? `Start order: ${order.join(' → ')}${waiting.length ? ` (${waiting.length} waiting on predecessors)` : ''}.`
      : 'Scheduling queue is empty.',
  };
}

// 51860 — resolve "start B when A reaches reporting/done" into a start order
// dependencies: [{ huntId, gate: 'done' | 'reporting' }]
export function gateSatisfied(depHunt, gate) {
  if (!depHunt) return false;
  if (gate === 'done') return depHunt.status === 'done';
  if (gate === 'reporting') return depHunt.phase === 'reporting' || depHunt.status === 'done';
  return false;
}

export function resolveDependencies(hunts) {
  const list = hunts || [];
  const byId = new Map(list.map(h => [h.id, h]));
  const indeg = new Map(list.map(h => [h.id, 0]));
  const adj = new Map(list.map(h => [h.id, []]));
  const gates = [];
  for (const h of list) {
    for (const d of h.dependencies || []) {
      const dep = byId.get(d.huntId);
      const satisfied = gateSatisfied(dep, d.gate);
      gates.push({ huntId: h.id, depId: d.huntId, gate: d.gate, satisfied });
      if (!satisfied && dep) {
        adj.get(d.huntId).push(h.id);
        indeg.set(h.id, indeg.get(h.id) + 1);
      }
    }
  }
  const ready = [...indeg.entries()]
    .filter(([, d]) => d === 0)
    .map(([id]) => id)
    .sort();
  const order = [];
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const nx of adj.get(id)) {
      indeg.set(nx, indeg.get(nx) - 1);
      if (indeg.get(nx) === 0) {
        ready.push(nx);
        ready.sort();
      }
    }
  }
  const cycles = list.map(h => h.id).filter(id => !order.includes(id));
  const blocked = [...new Set(gates.filter(g => !g.satisfied).map(g => g.huntId))];
  return {
    order,
    gates,
    cycles,
    blocked,
    text: cycles.length
      ? `Dependency cycle detected involving ${cycles.join(', ')} — resolve the cycle before scheduling.`
      : `Start order: ${order.join(' → ') || 'none'}${blocked.length ? `; blocked: ${blocked.join(', ')}` : ''}.`,
  };
}
