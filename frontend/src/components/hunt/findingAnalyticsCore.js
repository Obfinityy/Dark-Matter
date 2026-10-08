/**
 * findingAnalyticsCore.js — wave 39 (ideas 51541–51560): finding analytics
 * and governance suite for Infinity AI.
 *
 * Pure logic for the live findings feed's analytics layer: the findings
 * API shape, embeddable dashboard widgets, attack-surface heatmaps, finding
 * trend series, hunt-over-hunt comparison, count milestones, technique/
 * module leaderboards, coverage meters, deduplication review queues,
 * mid-hunt severity voting with consensus, SLA tracking, aging alerts,
 * bulk actions, the tag system, saved filter views, presentation mode,
 * voice briefing scripts, mobile card payloads, offline snapshots, and
 * redaction mode.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random(); time is
 * always passed in as an argument.
 */

export const WAVE39_AN_START = 51541;
export const WAVE39_AN_END = 51560;

/** Registry of the 20 analytics & governance ideas — completeness is testable. */
export const WAVE39_AN_IDEAS = [
  [51541, 'finding API', 'Programmatic access to the live findings stream'],
  [51542, 'finding dashboard widgets', 'Embeddable live counters and lists for your dashboards'],
  [51543, 'finding heatmap', 'Target areas colored by finding density in real time'],
  [51544, 'finding trends', 'Live chart of finding rate and severity mix over the hunt'],
  [51545, 'finding comparison', 'Current hunt findings overlaid on the last hunt'],
  [51546, 'finding milestones', 'Celebrations and markers at finding-count milestones'],
  [51547, 'finding leaderboard', 'Which techniques and modules are finding the most, live'],
  [51548, 'finding coverage meter', 'Findings mapped against attack-surface coverage'],
  [51549, 'finding deduplication review', 'Review and split auto-merged findings if needed'],
  [51550, 'finding severity voting', 'Teammates vote on severity; the agent shows the consensus'],
  [51551, 'finding SLA tracking', 'Time-to-triage tracked live per finding'],
  [51552, 'finding aging alerts', 'Nudge when a critical finding sits untriaged too long'],
  [51553, 'finding bulk actions', 'Select many findings to triage, assign, or export together'],
  [51554, 'finding tag system', 'Custom tags for organizing findings your way'],
  [51555, 'finding saved views', 'Save filter combinations as named views like "criticals only"'],
  [51556, 'finding presentation mode', 'Full-screen, auto-advancing walkthrough of findings'],
  [51557, 'finding voice briefing', 'The avatar reads out new findings as they arrive'],
  [51558, 'finding mobile cards', 'Thumb-friendly finding cards optimized for phones'],
  [51559, 'finding offline access', 'The feed stays browsable if the connection drops'],
  [51560, 'finding redaction mode', 'Hide sensitive evidence when screen-sharing the feed'],
];

/* --- shared helpers ----------------------------------------------------------- */

function djb2(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

function severityRank(sev) {
  const i = SEVERITY_ORDER.indexOf(sev);
  return i < 0 ? 99 : i;
}

/* --- 51541 · finding API ------------------------------------------------------------- */

export const FINDING_API_ROUTES = [
  ['GET', '/api/v1/findings', 'List live findings with filters'],
  ['GET', '/api/v1/findings/:id', 'Fetch one finding with evidence'],
  ['POST', '/api/v1/findings/:id/triage', 'Confirm, dismiss, or escalate'],
  ['POST', '/api/v1/findings/:id/comments', 'Add a comment to the thread'],
  ['GET', '/api/v1/findings/stream', 'Server-sent events: the live findings stream'],
  ['GET', '/api/v1/findings/feed.rss', 'RSS 2.0 feed of hunt findings'],
];

export function apiRouteList() {
  return FINDING_API_ROUTES.map(([method, path, desc]) => ({ method, path, desc }));
}

/** Public DTO: only whitelisted fields leave the API; internal notes stay in. */
export function apiFindingShape(finding) {
  const f = finding || {};
  return {
    id: f.id,
    title: f.title,
    type: f.type,
    severity: f.severity,
    confidence: f.confidence,
    asset: f.asset,
    technique: f.technique,
    triageStatus: f.triageStatus || 'new',
    assignee: f.assignee || null,
    detectedAtMs: f.detectedAtMs == null ? null : f.detectedAtMs,
  };
}

/* --- 51542 · finding dashboard widgets ----------------------------------------------------- */

export const WIDGET_KINDS = ['counter', 'list', 'severity-mix'];

export function widgetPayload(kind, findings) {
  const list = findings || [];
  if (kind === 'counter') {
    return {
      kind,
      total: list.length,
      critical: list.filter(f => f.severity === 'critical').length,
    };
  }
  if (kind === 'list') {
    return {
      kind,
      items: list.slice(0, 5).map(f => ({ id: f.id, title: f.title, severity: f.severity })),
    };
  }
  if (kind === 'severity-mix') {
    const mix = {};
    for (const s of SEVERITY_ORDER) mix[s] = 0;
    for (const f of list) mix[f.severity || 'low'] = (mix[f.severity || 'low'] || 0) + 1;
    return { kind, mix, total: list.length };
  }
  throw new Error('unknown widget kind: ' + kind);
}

/* --- 51543 · finding heatmap -------------------------------------------------------------------- */

export function heatmapCells(findings) {
  const byAsset = new Map();
  for (const f of findings || []) {
    const asset = String(f.asset || '(root)');
    byAsset.set(asset, (byAsset.get(asset) || 0) + 1);
  }
  const max = Math.max(1, ...byAsset.values());
  return [...byAsset.entries()]
    .map(([asset, count]) => ({ asset, count, intensity: count / max }))
    .sort((a, b) => b.count - a.count);
}

/* --- 51544 · finding trends -------------------------------------------------------------------------- */

export function trendSeries(findings, startMs, bucketMs, bucketCount) {
  const series = [];
  for (let i = 0; i < bucketCount; i++) {
    const start = startMs + i * bucketMs;
    const inBucket = (findings || []).filter(f => {
      const t = f.detectedAtMs == null ? startMs : f.detectedAtMs;
      return t >= start && t < start + bucketMs;
    });
    const bySeverity = {};
    for (const s of SEVERITY_ORDER) bySeverity[s] = 0;
    for (const f of inBucket) bySeverity[f.severity || 'low'] += 1;
    series.push({ start, count: inBucket.length, bySeverity });
  }
  return series;
}

/* --- 51545 · finding comparison ---------------------------------------------------------------------------- */

export function compareHunts(current, previous) {
  const cur = new Map((current || []).map(f => [f.id, f]));
  const prev = new Map((previous || []).map(f => [f.id, f]));
  let persisting = 0;
  for (const id of cur.keys()) if (prev.has(id)) persisting += 1;
  return {
    currentCount: cur.size,
    previousCount: prev.size,
    newCount: cur.size - persisting,
    persistingCount: persisting,
    resolvedCount: Math.max(0, prev.size - persisting),
  };
}

/* --- 51546 · finding milestones ---------------------------------------------------------------------------------- */

export const MILESTONES = [10, 25, 50, 100, 250, 500];

export function milestonesReached(total) {
  return MILESTONES.map(n => ({ n, reached: total >= n }));
}

export function nextMilestone(total) {
  const n = MILESTONES.find(m => m > total);
  return n == null ? null : { n, remaining: n - total };
}

/* --- 51547 · finding leaderboard ----------------------------------------------------------------------------------------- */

export function leaderboard(findings, by = 'technique') {
  const counts = new Map();
  for (const f of findings || []) {
    const key = String(f[by] || 'unknown');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/* --- 51548 · finding coverage meter ------------------------------------------------------------------------------------------------ */

export function coverageMeter(findings, surfaceAssets) {
  const surface = surfaceAssets || [];
  const covered = new Set((findings || []).map(f => String(f.asset || '')));
  const uncovered = surface.filter(a => !covered.has(String(a)));
  const total = Math.max(1, surface.length);
  return {
    covered: surface.length - uncovered.length,
    total: surface.length,
    pct: Math.round(((surface.length - uncovered.length) / total) * 100),
    uncovered,
  };
}

/* --- 51549 · finding deduplication review --------------------------------------------------------- */

/** Queue of auto-merged groups for a human to review: split or keep. */
export function dedupReviewQueue(mergedFindings) {
  return (mergedFindings || [])
    .filter(f => f && f.mergeCount > 1)
    .map(f => ({
      groupId: f.id,
      title: f.title,
      count: f.mergeCount,
      mergeIds: (f.mergeIds || []).slice(),
      evidenceCount: (f.evidence || []).length,
      decision: 'pending',
    }));
}

/** Split a reviewed group back into separate findings. */
export function splitGroup(mergedFinding) {
  const f = mergedFinding || {};
  const ids = [f.id, ...(f.mergeIds || [])];
  const evidence = f.evidence || [];
  const per = Math.max(1, Math.ceil(evidence.length / ids.length));
  return ids.map((id, i) => ({
    ...f,
    id,
    evidence: evidence.slice(i * per, (i + 1) * per),
    mergeIds: [],
    mergeCount: 1,
    splitFrom: f.id,
  }));
}

export function resolveReview(queue, groupId, decision) {
  if (decision !== 'keep' && decision !== 'split')
    throw new Error('unknown review decision: ' + decision);
  return (queue || []).map(q => (q.groupId === groupId ? { ...q, decision } : q));
}

/* --- 51550 · finding severity voting -------------------------------------------------------------------- */

export function castVote(votes, findingId, user, severity) {
  if (!['critical', 'high', 'medium', 'low'].includes(severity))
    throw new Error('bad severity vote: ' + severity);
  const list = (votes || []).filter(v => !(v.findingId === findingId && v.user === user));
  list.push({ findingId, user, severity });
  return list;
}

export function severityConsensus(votes, findingId) {
  const tally = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const v of votes || []) {
    if (v.findingId === findingId) tally[v.severity] = (tally[v.severity] || 0) + 1;
  }
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  let consensus = null;
  let best = 0;
  for (const s of SEVERITY_ORDER) {
    if (tally[s] > best) {
      best = tally[s];
      consensus = s;
    }
  }
  return { tally, total, consensus };
}

/* --- 51551 · finding SLA tracking --------------------------------------------------------------------------- */

export function slaStatus(finding, nowMs, slaMs) {
  const detected = (finding && finding.detectedAtMs) == null ? nowMs : finding.detectedAtMs;
  const elapsedMs = Math.max(0, nowMs - detected);
  const triaged = finding && finding.triageStatus && finding.triageStatus !== 'new';
  const remainingMs = Math.max(0, slaMs - elapsedMs);
  return {
    elapsedMs,
    remainingMs,
    breached: !triaged && elapsedMs > slaMs,
    state: triaged ? 'triaged' : elapsedMs > slaMs ? 'breached' : 'open',
  };
}

/* --- 51552 · finding aging alerts ---------------------------------------------------------------------------------- */

export function agingAlerts(findings, nowMs, maxUntriagedMs) {
  return (findings || []).filter(f => {
    const triaged = f.triageStatus && f.triageStatus !== 'new';
    if (triaged) return false;
    const detected = f.detectedAtMs == null ? nowMs : f.detectedAtMs;
    return (
      (f.severity === 'critical' || f.severity === 'high') && nowMs - detected > maxUntriagedMs
    );
  });
}

/* --- 51553 · finding bulk actions ----------------------------------------------------------------------------------------- */

export function bulkTriage(findings, ids, action) {
  const idSet = new Set(ids || []);
  const valid = { confirm: 'confirmed', dismiss: 'dismissed', escalate: 'escalated' };
  if (!valid[action]) throw new Error('unknown bulk action: ' + action);
  const list = (findings || []).map(f =>
    idSet.has(f.id) ? { ...f, triageStatus: valid[action] } : f
  );
  return {
    findings: list,
    updated: [...idSet].filter(id => (findings || []).some(f => f.id === id)).length,
  };
}

export function bulkAssign(findings, ids, teammate) {
  const idSet = new Set(ids || []);
  const list = (findings || []).map(f => (idSet.has(f.id) ? { ...f, assignee: teammate } : f));
  return {
    findings: list,
    updated: [...idSet].filter(id => (findings || []).some(f => f.id === id)).length,
  };
}

/* --- 51554 · finding tag system ------------------------------------------------------------------------------------------------ */

export function addTag(tags, findingId, tag) {
  const t = String(tag || '')
    .trim()
    .toLowerCase();
  if (!t) throw new Error('tag is required');
  const list = (tags || []).slice();
  if (!list.some(x => x.findingId === findingId && x.tag === t)) list.push({ findingId, tag: t });
  return list;
}

export function removeTag(tags, findingId, tag) {
  return (tags || []).filter(
    x => !(x.findingId === findingId && x.tag === String(tag).toLowerCase())
  );
}

export function tagsFor(tags, findingId) {
  return (tags || []).filter(x => x.findingId === findingId).map(x => x.tag);
}

export function findingsByTag(tags, findings, tag) {
  const ids = new Set(
    (tags || []).filter(x => x.tag === String(tag).toLowerCase()).map(x => x.findingId)
  );
  return (findings || []).filter(f => ids.has(f.id));
}

/* --- 51555 · finding saved views ------------------------------------------------------------------------------------------------------- */

export function saveView(views, name, filter) {
  if (!name || !String(name).trim()) throw new Error('view name is required');
  const list = (views || []).filter(v => v.name !== String(name).trim());
  list.push({ name: String(name).trim(), filter: filter || {} });
  return list;
}

export function applyView(views, name) {
  const v = (views || []).find(x => x.name === name);
  return v ? { ...v.filter } : null;
}

export function deleteView(views, name) {
  return (views || []).filter(x => x.name !== name);
}

/* --- 51556 · finding presentation mode -------------------------------------------------------------------------------------------------------------- */

export function presentationOrder(findings) {
  return (findings || [])
    .slice()
    .sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        (b.confidence || 0) - (a.confidence || 0)
    );
}

export function presentationStep(order, idx) {
  if (!order || order.length === 0)
    return { current: null, total: 0, hasNext: false, hasPrev: false, index: 0 };
  const i = Math.min(Math.max(0, idx), order.length - 1);
  return {
    current: order[i],
    total: order.length,
    hasNext: i < order.length - 1,
    hasPrev: i > 0,
    index: i,
  };
}

/* --- 51557 · finding voice briefing ------------------------------------------------------------------------------------------------------------------------------------- */

export function voiceBriefingScript(findings, maxItems = 5) {
  const top = presentationOrder(findings).slice(0, maxItems);
  const script = [`Hunt update: ${findings.length} findings so far.`];
  for (const f of top) {
    script.push(
      `${f.severity} finding on ${f.asset}: ${f.title}. Confidence ${f.confidence || 'unknown'} percent.`
    );
  }
  return script;
}

/* --- 51558 · finding mobile cards ----------------------------------------------------------------------------------------------------------------------------------------------- */

export function mobileCardPayload(finding) {
  const f = finding || {};
  return {
    id: f.id,
    title: f.title,
    severity: f.severity,
    asset: f.asset,
    oneLine: `[${f.severity}] ${f.title} — ${f.asset}`,
    triageStatus: f.triageStatus || 'new',
  };
}

/* --- 51559 · finding offline access --------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function offlineSnapshot(findings) {
  return {
    version: 'wf39-1',
    count: (findings || []).length,
    items: (findings || []).map(apiFindingShape),
  };
}

export function offlineDiff(snapshot, liveFindings) {
  const snapIds = new Set((snapshot.items || []).map(f => f.id));
  const liveIds = new Set((liveFindings || []).map(f => f.id));
  return {
    added: (liveFindings || []).filter(f => !snapIds.has(f.id)).map(f => f.id),
    removed: (snapshot.items || []).filter(f => !liveIds.has(f.id)).map(f => f.id),
  };
}

/* --- 51560 · finding redaction mode ------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

const REDACTED = '[redacted]';

export function redactFinding(finding) {
  const f = finding || {};
  return {
    ...f,
    title: f.title,
    evidence: (f.evidence || []).map(() => REDACTED),
    steps: (f.steps || []).map(s => ({ ...s, detail: REDACTED })),
    shareable: false,
  };
}

export function redactionNotice() {
  return 'Redaction mode: evidence and step details are hidden for screen sharing.';
}
