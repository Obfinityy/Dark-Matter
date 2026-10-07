/**
 * snapshotDistribCore.js — wave 42 (ideas 51641–51660): snapshot distribution.
 *
 * Pure logic for sharing mid-hunt snapshots: stakeholder comments, immutable
 * versioning, significant-diff alerts, a read API, wiki/dashboard embedding,
 * client-safe redaction, cover pages, tables of contents, charts, appendices,
 * digital sign-off, expiring links, access logs, one-click language labels,
 * print plans, mobile views, voice-summary scripts, grounded snapshot Q&A,
 * cross-snapshot comparison data, and phase-completion milestone markers.
 *
 * Everything here is a pure function: no network, no DOM, no clock reads.
 * Callers pass timestamps in; tests pass fixed values. Deterministic.
 */

/* --- shared helpers ----------------------------------------------------------- */

export const WAVE42_DIST_START = 51641;
export const WAVE42_DIST_END = 51660;

export const WAVE42_DIST_IDEAS = [
  [51641, 'snapshot comments', 'Stakeholders comment on snapshots without hunt access'],
  [51642, 'snapshot versioning', 'Every snapshot numbered and immutable once shared'],
  [51643, 'snapshot diff alerts', 'Notified when a new snapshot differs significantly'],
  [51644, 'snapshot API', 'Pull snapshot data programmatically into your systems'],
  [51645, 'snapshot embedding', 'Embed a live-updating snapshot in wikis or dashboards'],
  [51646, 'snapshot redaction', 'Generate client-safe snapshots with sensitive details hidden'],
  [51647, 'snapshot cover page', 'Auto-generated cover with target, date, and scope summary'],
  [51648, 'snapshot table of contents', 'Navigable TOC generated for every snapshot'],
  [51649, 'snapshot charts', 'Severity distribution and trend charts rendered automatically'],
  [51650, 'snapshot appendices', 'Evidence and logs attached as organized appendices'],
  [51651, 'snapshot sign-off', 'Collect stakeholder sign-off on a snapshot digitally'],
  [51652, 'snapshot expiry', 'Shared links expire automatically after a set period'],
  [51653, 'snapshot access logs', 'See who viewed each snapshot and when'],
  [51654, 'snapshot translation', 'One-click translation of the full snapshot'],
  [51655, 'snapshot print optimization', 'Layouts tuned for clean printing'],
  [51656, 'snapshot mobile view', 'Snapshots readable and navigable on phones'],
  [51657, 'snapshot voice summary', 'An audio walkthrough of the latest snapshot'],
  [51658, 'snapshot Q&A', 'Ask questions about a snapshot and get answers grounded in it'],
  [51659, 'snapshot comparison charts', 'Finding counts across snapshots visualized'],
  [51660, 'snapshot milestone markers', 'Snapshots auto-taken at phase completions'],
];

export function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clamp(n, lo, hi) {
  const v = Number(n);
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

let commentSeq = 0;
export function newSnapshotComment({ snapshotId, section, author, role = 'stakeholder', text, createdAt }) {
  if (!snapshotId) throw new Error('snapshotId required');
  if (!String(text ?? '').trim()) throw new Error('comment text required');
  commentSeq += 1;
  return {
    id: `sc-${snapshotId}-${commentSeq}`,
    snapshotId,
    section: section || 'general',
    author: author || 'anonymous',
    role,
    text: String(text).trim(),
    createdAt: createdAt || 'unscheduled',
  };
}

export function commentsForSnapshot(comments, snapshotId) {
  return (comments || []).filter(c => c.snapshotId === snapshotId);
}

export function commentsForSection(comments, snapshotId, section) {
  return commentsForSnapshot(comments, snapshotId).filter(c => c.section === section);
}

/* --- 51642 snapshot versioning -------------------------------------------------- */

export function nextSnapshotVersion(history) {
  const versions = (history || []).map(s => s.version || 0);
  return (versions.length ? Math.max(...versions) : 0) + 1;
}

export function freezeSnapshot(snapshot, version, sealedAt) {
  if (!snapshot) throw new Error('snapshot required');
  return { ...snapshot, version, immutable: true, sealedAt: sealedAt || 'unscheduled' };
}

export function isFrozen(snapshot) {
  return Boolean(snapshot && snapshot.immutable === true);
}

/* --- 51643 snapshot diff alerts --------------------------------------------------- */

export function snapshotDelta(prev, next) {
  const p = new Map((prev?.findings || []).map(f => [f.id, f]));
  const n = new Map((next?.findings || []).map(f => [f.id, f]));
  const added = [...n.keys()].filter(id => !p.has(id));
  const removed = [...p.keys()].filter(id => !n.has(id));
  const severityChanged = [...n.keys()].filter(id => p.has(id) && p.get(id).severity !== n.get(id).severity);
  return { added, removed, severityChanged, addedCount: added.length, removedCount: removed.length, changedCount: severityChanged.length };
}

export function diffAlertLevel(delta, thresholds = { significant: 5 }) {
  const total = delta.addedCount + delta.removedCount + delta.changedCount;
  if (total >= (thresholds.significant ?? 5)) return 'significant';
  if (total > 0) return 'info';
  return 'none';
}

/* --- 51644 snapshot API ------------------------------------------------------------- */

export const SNAPSHOT_API_ROUTES = [
  { method: 'GET', path: '/api/v1/snapshots', desc: 'List snapshots for a hunt' },
  { method: 'GET', path: '/api/v1/snapshots/:id', desc: 'Fetch one snapshot (public DTO)' },
  { method: 'GET', path: '/api/v1/snapshots/:id/findings', desc: 'Findings inside a snapshot' },
  { method: 'GET', path: '/api/v1/snapshots/:id/diff', desc: 'Diff against the previous version' },
];

const API_DTO_FIELDS = ['id', 'version', 'huntId', 'target', 'takenAt', 'findingCounts', 'kpis', 'immutable'];

export function snapshotApiDto(snapshot) {
  const dto = {};
  for (const f of API_DTO_FIELDS) if (snapshot && f in snapshot) dto[f] = snapshot[f];
  return dto;
}

/* --- 51645 snapshot embedding ------------------------------------------------------- */

export const EMBED_THEMES = ['dark', 'light', 'auto'];

export function snapshotEmbedHtml({ snapshotId, baseUrl, theme = 'auto', width = '100%', height = 560 }) {
  if (!snapshotId) throw new Error('snapshotId required');
  const safeTheme = EMBED_THEMES.includes(theme) ? theme : 'auto';
  const src = `${String(baseUrl || 'https://app.infinity-ai.local').replace(/\/$/, '')}/embed/snapshots/${encodeURIComponent(snapshotId)}?theme=${safeTheme}`;
  return `<iframe src="${escHtml(src)}" width="${escHtml(width)}" height="${escHtml(Number(height) || 560)}" ` +
    `frameborder="0" loading="lazy" title="Snapshot ${escHtml(snapshotId)}"></iframe>`;
}

/* --- 51646 snapshot redaction --------------------------------------------------------- */

export const REDACT_FIELDS = ['internalNotes', 'toolOutput', 'rawRequest', 'credentialsHint', 'operatorName'];

export const REDACT_TOKEN = '[redacted]';

export function redactSnapshot(snapshot, extraFields = []) {
  if (!snapshot) throw new Error('snapshot required');
  const fields = new Set([...REDACT_FIELDS, ...extraFields]);
  const out = Array.isArray(snapshot) ? [...snapshot] : { ...snapshot };
  const redactValue = (v) => (v === undefined || v === null) ? v : REDACT_TOKEN;
  const walk = (obj) => {
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      const copy = {};
      for (const [k, v] of Object.entries(obj)) copy[k] = fields.has(k) ? redactValue(v) : walk(v);
      return copy;
    }
    return obj;
  };
  const redacted = walk(out);
  redacted.redactedFields = [...fields].filter(f => f in (snapshot || {}));
  redacted.redacted = true;
  return redacted;
}

/* --- 51647 snapshot cover page ---------------------------------------------------------- */

export function snapshotCover(snapshot) {
  const findings = snapshot?.findings || [];
  const counts = severityDistribution(findings);
  return {
    title: `Hunt snapshot — ${snapshot?.target || 'unknown target'}`,
    target: snapshot?.target || 'unknown target',
    takenAt: snapshot?.takenAt || 'unscheduled',
    version: snapshot?.version || 1,
    scopeSummary: snapshot?.scopeSummary || `${findings.length} findings across in-scope assets`,
    findingCounts: counts,
    total: findings.length,
  };
}

/* --- 51648 snapshot table of contents ----------------------------------------------------- */

export function snapshotToc(sections) {
  return (sections || []).map((s, i) => ({
    anchor: `sec-${String(s.id || i).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: s.title || `Section ${i + 1}`,
    depth: clamp(s.depth || 0, 0, 3),
  }));
}

/* --- 51649 snapshot charts ------------------------------------------------------------------ */

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

export function severityDistribution(findings) {
  const dist = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings || []) {
    const sev = String(f.severity || 'info').toLowerCase();
    if (sev in dist) dist[sev] += 1; else dist.info += 1;
  }
  return dist;
}

export function findingTrend(snapshots) {
  return (snapshots || []).map(s => ({
    version: s.version || 0,
    takenAt: s.takenAt || 'unscheduled',
    total: (s.findings || []).length,
    ...severityDistribution(s.findings),
  }));
}

/* --- 51650 snapshot appendices -------------------------------------------------------------- */

export function snapshotAppendices(snapshot) {
  const findings = snapshot?.findings || [];
  const evidence = findings.flatMap(f => (f.evidence || []).map(e => ({ findingId: f.id, kind: 'evidence', ...e })));
  return [
    { id: 'app-a', title: 'Appendix A — Evidence index', kind: 'evidence', entries: evidence },
    { id: 'app-b', title: 'Appendix B — Activity log', kind: 'log', entries: snapshot?.activityLog || [] },
    { id: 'app-c', title: 'Appendix C — Scope record', kind: 'scope', entries: snapshot?.scopeRecord || [] },
  ];
}

/* --- 51651 snapshot sign-off ------------------------------------------------------------------ */

export function signoffRequest(snapshotId, stakeholders, createdAt) {
  if (!snapshotId) throw new Error('snapshotId required');
  return {
    id: `signoff-${snapshotId}`,
    snapshotId,
    createdAt: createdAt || 'unscheduled',
    status: 'pending',
    required: (stakeholders || []).map(s => ({ name: s.name || s, role: s.role || 'stakeholder', signedAt: null })),
  };
}

export function recordSignature(request, { by, at }) {
  if (!request) throw new Error('request required');
  const required = request.required.map(r => r.name === by ? { ...r, signedAt: at || 'unscheduled' } : r);
  const done = required.every(r => r.signedAt);
  return { ...request, required, status: done ? 'complete' : 'pending' };
}

export function signoffStatus(request) {
  const signed = request.required.filter(r => r.signedAt).length;
  return { signed, total: request.required.length, status: request.status };
}

/* --- 51652 snapshot expiry -------------------------------------------------------------------- */

export function expiringLink({ snapshotId, ttlHours = 72, createdAt, baseUrl }) {
  if (!snapshotId) throw new Error('snapshotId required');
  const created = Number(createdAt) || 0;
  const expiresAt = created + ttlHours * 3600 * 1000;
  const base = String(baseUrl || 'https://app.infinity-ai.local').replace(/\/$/, '');
  return { snapshotId, url: `${base}/s/${encodeURIComponent(snapshotId)}`, createdAt: created, expiresAt, ttlHours };
}

export function linkExpired(link, now) {
  return Number(now) >= Number(link.expiresAt);
}

/* --- 51653 snapshot access logs ----------------------------------------------------------------- */

export function logSnapshotAccess(log, { snapshotId, viewer, role = 'stakeholder', at }) {
  if (!snapshotId || !viewer) throw new Error('snapshotId and viewer required');
  return [...(log || []), { snapshotId, viewer, role, at: at || 'unscheduled' }];
}

export function accessLogFor(log, snapshotId) {
  return (log || []).filter(e => e.snapshotId === snapshotId);
}

export function uniqueViewers(log, snapshotId) {
  return [...new Set(accessLogFor(log, snapshotId).map(e => e.viewer))];
}

/* --- 51654 snapshot language labels --------------------------------------------------------------- */

export const SNAPSHOT_LANGUAGES = ['en', 'hi', 'es'];

const SECTION_LABELS = {
  en: { cover: 'Cover', findings: 'Findings', charts: 'Charts', appendices: 'Appendices', signoff: 'Sign-off' },
  hi: { cover: 'मुखपृष्ठ', findings: 'निष्कर्ष', charts: 'चार्ट', appendices: 'परिशिष्ट', signoff: 'अनुमोदन' },
  es: { cover: 'Portada', findings: 'Hallazgos', charts: 'Gráficos', appendices: 'Apéndices', signoff: 'Aprobación' },
};

export function snapshotSectionLabels(lang = 'en') {
  return SECTION_LABELS[lang] || SECTION_LABELS.en;
}

export function localizedSnapshotMeta(snapshot, lang = 'en') {
  return { ...snapshotCover(snapshot), labels: snapshotSectionLabels(lang), lang };
}

/* --- 51655 snapshot print optimization -------------------------------------------------------------- */

export function snapshotPrintPlan(snapshot) {
  const sections = (snapshot?.sections || []).map(s => s.title || s.id);
  return {
    pageSize: 'A4',
    orientation: 'portrait',
    marginsMm: { top: 18, right: 15, bottom: 18, left: 15 },
    sections,
    pageBreakBefore: sections.filter((_, i) => i > 0 && i % 3 === 0),
    header: snapshot?.target || 'Hunt snapshot',
    footer: `Snapshot v${snapshot?.version || 1} — ${snapshot?.takenAt || ''}`,
  };
}

/* --- 51656 snapshot mobile view ----------------------------------------------------------------------- */

export function mobileSnapshotView(snapshot) {
  const cover = snapshotCover(snapshot);
  const top = [...(snapshot?.findings || [])]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 3)
    .map(f => ({ id: f.id, title: f.title, severity: f.severity }));
  return { title: cover.title, version: cover.version, total: cover.total, counts: cover.findingCounts, topFindings: top };
}

export function severityRank(sev) {
  return SEVERITIES.indexOf(String(sev || 'info').toLowerCase());
}

/* --- 51657 snapshot voice summary ----------------------------------------------------------------------- */

export function snapshotVoiceScript(snapshot) {
  const cover = snapshotCover(snapshot);
  const c = cover.findingCounts;
  const script = `Snapshot ${cover.version} for ${cover.target}, taken ${cover.takenAt}. ` +
    `${cover.total} findings: ${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low. ` +
    `${cover.scopeSummary}.`;
  const estSeconds = Math.max(8, Math.round(script.split(/\s+/).length / 2.4));
  return { script, estSeconds, voice: 'aria' };
}

/* --- 51658 snapshot Q&A (extractive, keyword-grounded) ----------------------------------------------------- */

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'and', 'or', 'is', 'are', 'what', 'how', 'why', 'when', 'which', 'does', 'do', 'it', 'this', 'that', 'with', 'by', 'from']);

export function answerSnapshotQuestion(snapshot, question) {
  const words = String(question || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !STOPWORDS.has(w));
  const sections = snapshot?.sections || [];
  const scored = sections.map(s => {
    const hay = `${s.title || ''} ${s.body || ''}`.toLowerCase();
    const hits = words.filter(w => hay.includes(w));
    return { section: s, score: hits.length, hits };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 2);
  if (!top.length) {
    return { answer: 'No section of this snapshot covers that question.', groundedIn: [], confidence: 0 };
  }
  const answer = top.map(t => `${t.section.title}: ${String(t.section.body || '').slice(0, 220)}`).join(' ');
  return {
    answer,
    groundedIn: top.map(t => t.section.title),
    confidence: clamp(Math.round((top[0].score / Math.max(1, words.length)) * 100), 5, 95),
  };
}

/* --- 51659 snapshot comparison charts ------------------------------------------------------------------------ */

export function snapshotComparison(snapshots) {
  const versions = (snapshots || []).map(s => `v${s.version || 0}`);
  const series = {};
  for (const sev of SEVERITIES) series[sev] = (snapshots || []).map(s => severityDistribution(s.findings)[sev]);
  return { versions, series, totals: (snapshots || []).map(s => (s.findings || []).length) };
}

/* --- 51660 snapshot milestone markers -------------------------------------------------------------------------- */

export const MILESTONE_PHASES = ['recon', 'scanning', 'exploitation', 'reporting'];

export function isMilestoneEvent(event) {
  return event && event.type === 'phase-complete' && MILESTONE_PHASES.includes(event.phase);
}

export function milestoneSnapshots(events) {
  return (events || []).filter(isMilestoneEvent).map((e, i) => ({
    id: `ms-${e.phase}-${i}`,
    phase: e.phase,
    autoTaken: true,
    reason: `Phase "${e.phase}" completed`,
    at: e.at || 'unscheduled',
  }));
}
