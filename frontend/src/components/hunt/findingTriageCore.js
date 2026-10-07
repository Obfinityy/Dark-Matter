/**
 * findingTriageCore.js — wave 39 (ideas 51521–51540): finding triage
 * collaboration suite for Infinity AI.
 *
 * Pure logic for the live findings feed's triage layer: live duplicate
 * detection with merge, timeline and map views, mid-hunt kanban, triage
 * actions, assignment, per-finding comment threads, watchers, version
 * history, inline evidence previews, step replay, provenance, markdown/
 * JSON export, read-only share links, print views, notification rules,
 * quiet (digest) mode, scheduled digest emails, RSS feeds, and webhook
 * payloads.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random(); time is
 * always passed in as an argument.
 */

export const WAVE39_TR_START = 51521;
export const WAVE39_TR_END = 51540;

/** Registry of the 20 triage collaboration ideas — completeness is testable. */
export const WAVE39_TR_IDEAS = [
  [51521, 'live duplicate detection', 'Near-duplicate findings merged as they arrive'],
  [51522, 'finding timeline view', 'Findings plotted on the hunt timeline by discovery moment'],
  [51523, 'finding map view', 'Findings plotted on a visual map of the target attack surface'],
  [51524, 'finding kanban board', 'Drag findings between new, triaging, confirmed, and false-positive'],
  [51525, 'live triage actions', 'Confirm, dismiss, or escalate directly from the feed'],
  [51526, 'finding assignment', 'Assign a live finding to a teammate with one click'],
  [51527, 'finding comments', 'Discuss each finding in its own thread as it develops'],
  [51528, 'finding watchers', 'Follow a finding to get updates as its evidence evolves'],
  [51529, 'finding version history', 'See how a finding changed from first detection to now'],
  [51530, 'inline evidence preview', 'Screenshots and payloads visible without opening a new view'],
  [51531, 'finding replay', 'Watch the exact steps that led to the finding, replayed live'],
  [51532, 'finding provenance', 'Which phase, module, and steering decision produced it'],
  [51533, 'finding export', 'Download any finding as markdown or JSON instantly'],
  [51534, 'finding share links', 'Read-only links to individual findings for stakeholders'],
  [51535, 'finding print view', 'Clean printable layout per finding or per batch'],
  [51536, 'finding notifications', 'Push, email, or Slack alerts tuned by severity threshold'],
  [51537, 'quiet finding mode', 'Batch low-severity findings into hourly digests'],
  [51538, 'finding digest emails', 'Scheduled summaries of new findings per hunt'],
  [51539, 'finding RSS feed', 'Subscribe to a hunt’s findings as a live feed'],
  [51540, 'finding webhook', 'Push new findings to your systems the instant they appear'],
];

/* --- shared helpers ----------------------------------------------------------- */

function djb2(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function normalizeAsset(asset) {
  return String(asset || '')
    .toLowerCase()
    .replace(/\/+$/, '')
    .replace(/\?.*$/, '')
    .trim();
}

export function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeHtml(s) {
  return escapeXml(s);
}

/* --- 51521 · live duplicate detection ------------------------------------------ */

/**
 * Canonical signature: two findings share a signature when they have the same
 * type and the same normalized asset and near-identical titles.
 */
export function signatureOf(finding) {
  const f = finding || {};
  const titleWords = String(f.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .sort()
    .slice(0, 6)
    .join('|');
  return (f.type || 'unknown') + '::' + normalizeAsset(f.asset) + '::' + titleWords;
}

/** Return ids of existing feed items that look like duplicates of `finding`. */
export function findDuplicates(feed, finding) {
  const sig = signatureOf(finding);
  return (feed || [])
    .filter((f) => f && f.id !== finding.id && signatureOf(f) === sig)
    .map((f) => f.id);
}

/**
 * Merge near-duplicate findings: group by signature, keep the earliest item,
 * fold evidence and mergeIds into the survivor. Never mutates the input.
 */
export function mergeDuplicates(feed) {
  const groups = new Map();
  for (const f of feed || []) {
    if (!f) continue;
    const sig = signatureOf(f);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push(f);
  }
  const out = [];
  for (const items of groups.values()) {
    if (items.length === 1) {
      out.push({ ...items[0] });
      continue;
    }
    const ordered = items.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));
    const survivor = { ...ordered[0] };
    survivor.evidence = ordered.flatMap((f) => f.evidence || []);
    survivor.mergeIds = ordered.slice(1).map((f) => f.id);
    survivor.mergeCount = ordered.length;
    out.push(survivor);
  }
  return out.sort((a, b) => (b.seq || 0) - (a.seq || 0));
}

/* --- 51522 · finding timeline view ---------------------------------------------- */

export function timelineSlots(findings, startMs, bucketMs) {
  const buckets = new Map();
  for (const f of findings || []) {
    const t = f.detectedAtMs == null ? startMs : f.detectedAtMs;
    const idx = Math.max(0, Math.floor((t - startMs) / bucketMs));
    if (!buckets.has(idx)) buckets.set(idx, { start: startMs + idx * bucketMs, count: 0, severities: {} });
    const b = buckets.get(idx);
    b.count += 1;
    b.severities[f.severity || 'low'] = (b.severities[f.severity || 'low'] || 0) + 1;
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, b]) => ({ bucket: idx, ...b }));
}

/** Fractional position of t on [start, end], clamped to 0..1. */
export function timelinePosition(t, startMs, endMs) {
  if (endMs <= startMs) return 0;
  return Math.min(1, Math.max(0, (t - startMs) / (endMs - startMs)));
}

/* --- 51523 · finding map view ----------------------------------------------------- */

export const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * One map node per asset: deterministic grid position derived from a hash of
 * the asset path, plus count and top severity. Pure — the UI renders the grid.
 */
export function mapNodes(findings, cols = 6) {
  const byAsset = new Map();
  for (const f of findings || []) {
    const asset = normalizeAsset(f.asset) || '(root)';
    if (!byAsset.has(asset)) byAsset.set(asset, []);
    byAsset.get(asset).push(f);
  }
  const nodes = [];
  let i = 0;
  for (const [asset, items] of byAsset.entries()) {
    const h = parseInt(djb2(asset), 36);
    const topSeverity = items
      .map((f) => f.severity || 'low')
      .sort((a, b) => (SEVERITY_RANK[b] || 0) - (SEVERITY_RANK[a] || 0))[0];
    nodes.push({
      asset,
      x: (h % cols) + (i % 2 === 0 ? 0.3 : 0.7),
      y: Math.floor(h / cols) % 4 + 0.5,
      count: items.length,
      topSeverity,
      findingIds: items.map((f) => f.id),
    });
    i += 1;
  }
  return nodes.sort((a, b) => b.count - a.count);
}

/* --- 51524 · finding kanban board -------------------------------------------------- */

export const KANBAN_COLUMNS = ['new', 'triaging', 'confirmed', 'false-positive'];

export function emptyKanban() {
  return { new: [], triaging: [], confirmed: [], 'false-positive': [] };
}

/** Move a finding id between columns; throws on unknown column. Never mutates. */
export function moveToColumn(board, findingId, column) {
  if (!KANBAN_COLUMNS.includes(column)) throw new Error('unknown kanban column: ' + column);
  const next = {};
  for (const c of KANBAN_COLUMNS) next[c] = (board[c] || []).filter((id) => id !== findingId);
  next[column] = [...next[column], findingId];
  return next;
}

export function kanbanColumnOf(board, findingId) {
  for (const c of KANBAN_COLUMNS) {
    if ((board[c] || []).includes(findingId)) return c;
  }
  return 'new';
}

/* --- 51525 · live triage actions ----------------------------------------------------- */

export const TRIAGE_ACTIONS = ['confirm', 'dismiss', 'escalate'];

export function triageAction(finding, action) {
  if (!TRIAGE_ACTIONS.includes(action)) throw new Error('unknown triage action: ' + action);
  const status = action === 'confirm' ? 'confirmed' : action === 'dismiss' ? 'dismissed' : 'escalated';
  return { ...(finding || {}), triageStatus: status };
}

/* --- 51526 · finding assignment ------------------------------------------------------- */

export function assignFinding(finding, teammate) {
  if (!teammate) throw new Error('teammate is required');
  return { ...(finding || {}), assignee: teammate };
}

export function unassignFinding(finding) {
  const next = { ...(finding || {}) };
  delete next.assignee;
  return next;
}

/* --- 51527 · finding comments ----------------------------------------------------------- */

export function newCommentThread(findingId) {
  return { findingId, comments: [] };
}

export function addComment(thread, { author, text, tsMs }) {
  if (!text || !String(text).trim()) throw new Error('comment text is required');
  const comments = (thread.comments || []).slice();
  comments.push({
    id: 'c-' + djb2(findingIdOf(thread) + '|' + comments.length + '|' + String(tsMs)),
    author: author || 'Infinity AI',
    text: String(text),
    tsMs: tsMs == null ? 0 : tsMs,
  });
  return { ...thread, comments };
}

function findingIdOf(thread) {
  return (thread && thread.findingId) || 'unknown';
}

export function threadCount(thread) {
  return (thread.comments || []).length;
}

/* --- 51528 · finding watchers -------------------------------------------------------------- */

export function watchFinding(watchers, findingId, user) {
  const list = (watchers || []).slice();
  if (!list.some((w) => w.findingId === findingId && w.user === user)) {
    list.push({ findingId, user });
  }
  return list;
}

export function unwatchFinding(watchers, findingId, user) {
  return (watchers || []).filter((w) => !(w.findingId === findingId && w.user === user));
}

export function watchersFor(watchers, findingId) {
  return (watchers || []).filter((w) => w.findingId === findingId).map((w) => w.user);
}

/* --- 51529 · finding version history ------------------------------------------------------------ */

export function recordVersion(history, finding, tsMs) {
  const entries = (history || []).slice();
  entries.push({
    findingId: finding.id,
    tsMs: tsMs == null ? 0 : tsMs,
    snapshot: {
      title: finding.title,
      severity: finding.severity,
      confidence: finding.confidence,
      triageStatus: finding.triageStatus || 'new',
      assignee: finding.assignee || null,
    },
  });
  return entries;
}

export function versionHistory(history, findingId) {
  return (history || [])
    .filter((e) => e.findingId === findingId)
    .sort((a, b) => a.tsMs - b.tsMs);
}

/** Field-level diff between two version snapshots. */
export function diffVersions(before, after) {
  const diffs = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if ((before || {})[k] !== (after || {})[k]) {
      diffs.push({ field: k, from: (before || {})[k], to: (after || {})[k] });
    }
  }
  return diffs;
}

/* --- 51530 · inline evidence preview --------------------------------------------------------- */

export function evidencePreview(evidence, max = 2) {
  const list = evidence || [];
  return {
    preview: list.slice(0, max),
    more: Math.max(0, list.length - max),
    total: list.length,
  };
}

/* --- 51531 · finding replay ----------------------------------------------------------------------- */

export function replayScript(finding) {
  const steps = (finding && finding.steps) || [];
  return steps.map((s, i) => ({
    n: i + 1,
    action: s.action || 'step',
    detail: s.detail || '',
    technique: s.technique || (finding && finding.technique) || '',
  }));
}

export function replayStep(script, idx) {
  if (!script || script.length === 0) return { current: null, total: 0, hasNext: false, hasPrev: false };
  const i = Math.min(Math.max(0, idx), script.length - 1);
  return {
    current: script[i],
    total: script.length,
    hasNext: i < script.length - 1,
    hasPrev: i > 0,
    index: i,
  };
}

/* --- 51532 · finding provenance -------------------------------------------------------------------- */

export function provenanceOf(finding) {
  const f = finding || {};
  return {
    phase: f.phase || 'recon',
    module: f.module || 'unknown-engine',
    steeringDecision: f.steeringDecision || 'auto',
    technique: f.technique || 'unknown',
    detectedAtMs: f.detectedAtMs == null ? null : f.detectedAtMs,
  };
}

export function provenanceLine(prov) {
  const p = prov || {};
  return `${p.phase} · ${p.module} · ${p.steeringDecision}`;
}

/* --- 51533 · finding export --------------------------------------------------------------------------- */

export function exportFindingMarkdown(finding) {
  const f = finding || {};
  const lines = [
    `# Finding: ${f.title || '(untitled)'}`,
    '',
    `- **ID:** ${f.id || 'n/a'}`,
    `- **Severity:** ${f.severity || 'low'}`,
    `- **Confidence:** ${f.confidence == null ? 'n/a' : f.confidence + '%'}`,
    `- **Asset:** ${f.asset || 'n/a'}`,
    `- **Technique:** ${f.technique || 'n/a'}`,
    `- **Status:** ${f.triageStatus || 'new'}`,
  ];
  if (f.assignee) lines.push(`- **Assignee:** ${f.assignee}`);
  lines.push('', '## Evidence', '');
  for (const e of f.evidence || []) lines.push(`- ${e}`);
  return lines.join('\n');
}

export function exportFindingJson(finding) {
  return JSON.stringify(finding || {}, null, 2);
}

/* --- 51534 · finding share links ------------------------------------------------------------------------- */

export function shareToken(findingId) {
  return 'sh_' + djb2('finding|' + findingId);
}

/** Read-only share link; the token is a stable descriptor, not a secret. */
export function shareLink(finding, baseUrl) {
  const f = finding || {};
  const base = (baseUrl || 'https://app.infinity-ai/findings').replace(/\/+$/, '');
  return `${base}/${f.id || 'unknown'}?t=${shareToken(f.id)}&ro=1`;
}

/* --- 51535 · finding print view ------------------------------------------------------------------------------- */

export function printViewHtml(finding) {
  const f = finding || {};
  const evidence = (f.evidence || []).map((e) => `<li>${escapeHtml(e)}</li>`).join('');
  return [
    '<article class="finding-print">',
    `<h1>${escapeHtml(f.title || '(untitled)')}</h1>`,
    `<p>ID ${escapeHtml(f.id || 'n/a')} · severity ${escapeHtml(f.severity || 'low')} · confidence ${escapeHtml(f.confidence == null ? 'n/a' : f.confidence + '%')}</p>`,
    `<p>Asset: ${escapeHtml(f.asset || 'n/a')} · Technique: ${escapeHtml(f.technique || 'n/a')}</p>`,
    `<h2>Evidence</h2><ul>${evidence}</ul>`,
    '</article>',
  ].join('\n');
}

export function batchPrintViewHtml(findings, huntName) {
  return [
    `<header><h1>${escapeHtml(huntName || 'Hunt')} — findings report</h1></header>`,
    (findings || []).map(printViewHtml).join('\n<hr/>\n'),
  ].join('\n');
}

/* --- 51536 · finding notifications --------------------------------------------------------------------------------- */

export const NOTIFICATION_CHANNELS = {
  critical: ['push', 'email', 'slack'],
  high: ['push', 'email'],
  medium: ['email'],
  low: [],
};

export function notificationChannels(severity) {
  return (NOTIFICATION_CHANNELS[severity] || []).slice();
}

/**
 * prefs: { threshold: 'critical'|'high'|'medium'|'low', muted: bool }.
 * A finding notifies when its severity rank meets the threshold and alerts
 * are not muted.
 */
export function shouldNotify(finding, prefs) {
  const p = prefs || {};
  if (p.muted) return false;
  const rank = SEVERITY_RANK[(finding && finding.severity) || 'low'] || 0;
  const thresholdRank = SEVERITY_RANK[p.threshold || 'high'] || 0;
  return rank >= thresholdRank;
}

export function notificationFor(finding, prefs) {
  if (!shouldNotify(finding, prefs)) return null;
  const severity = (finding && finding.severity) || 'low';
  return {
    findingId: finding.id,
    severity,
    channels: notificationChannels(severity),
    title: `[${severity}] ${finding.title || 'new finding'}`,
  };
}

/* --- 51537 · quiet finding mode ---------------------------------------------------------------------------------------- */

export function isQuietCandidate(finding) {
  const sev = (finding && finding.severity) || 'low';
  return sev === 'low';
}

/** Split a batch: loud findings go out now, quiet ones join the hourly digest. */
export function quietBatch(findings) {
  const loud = [];
  const digest = [];
  for (const f of findings || []) {
    if (isQuietCandidate(f)) digest.push(f);
    else loud.push(f);
  }
  return { loud, digest };
}

/* --- 51538 · finding digest emails ------------------------------------------------------------------------------------------ */

export function digestEmail(findings, huntName, periodLabel) {
  const list = findings || [];
  const bySeverity = {};
  for (const f of list) bySeverity[f.severity || 'low'] = (bySeverity[f.severity || 'low'] || 0) + 1;
  const body = [
    `Hunt: ${huntName || 'untitled'}`,
    `Period: ${periodLabel || 'last hour'}`,
    `New findings: ${list.length}`,
    '',
    'By severity:',
    ...Object.entries(bySeverity).map(([s, n]) => `- ${s}: ${n}`),
    '',
    ...list.map((f) => `* [${f.severity}] ${f.title} (${f.asset})`),
  ].join('\n');
  return {
    subject: `[Infinity AI] ${list.length} new findings — ${huntName || 'hunt'} (${periodLabel || 'hourly'})`,
    body,
    count: list.length,
  };
}

/* --- 51539 · finding RSS feed -------------------------------------------------------------------------------------------------- */

export function rssFeed(findings, huntName, feedUrl) {
  const items = (findings || [])
    .map((f) => [
      '  <item>',
      `    <title>${escapeXml(`[${f.severity}] ${f.title}`)}</title>`,
      `    <link>${escapeXml((feedUrl || 'https://app.infinity-ai/findings') + '/' + f.id)}</link>`,
      `    <description>${escapeXml(f.asset || '')}</description>`,
      `    <guid>${escapeXml(String(f.id))}</guid>`,
      '  </item>',
    ].join('\n'))
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    ' <channel>',
    `  <title>${escapeXml('Infinity AI findings — ' + (huntName || 'hunt'))}</title>`,
    `  <link>${escapeXml(feedUrl || 'https://app.infinity-ai/findings')}</link>`,
    items,
    ' </channel>',
    '</rss>',
  ].join('\n');
}

/* --- 51540 · finding webhook -------------------------------------------------------------------------------------------------------- */

export function webhookPayload(finding, event, tsMs) {
  const f = finding || {};
  return {
    event: event || 'finding.created',
    tsMs: tsMs == null ? 0 : tsMs,
    finding: {
      id: f.id,
      title: f.title,
      severity: f.severity,
      confidence: f.confidence,
      asset: f.asset,
      technique: f.technique,
    },
  };
}

/** Delivery descriptor: endpoint, event filter, and a stable idempotency key. */
export function webhookDelivery(payload, endpoint) {
  if (!endpoint) throw new Error('webhook endpoint is required');
  const body = JSON.stringify(payload);
  return {
    endpoint,
    idempotencyKey: 'wh_' + djb2(body),
    body,
    contentType: 'application/json',
  };
}
