/**
 * exportOpsCore.js — Infinity AI · Dark-Matter · Wave 56 (ideas 52221–52240)
 * Pure JS (no React / DOM / network). Export-operations models: lifecycle,
 * comparison, charts, TOC, checklist, encryption, retention, versioning,
 * notifications, chunking, progress, retry, history, presets, Jira CSV,
 * STIX 2.1, CVSS, CWE, cover page, approval workflow. Time injected via
 * `now` params (default Date.now()).
 */

export const WAVE56_OPS_IDEAS = [
  { id: 52221, title: 'Lifecycle-history export', skip: false },
  { id: 52222, title: 'Comparison-data export', skip: false },
  { id: 52223, title: 'Chart PNG/SVG export', skip: false },
  { id: 52224, title: 'PDF table of contents', skip: false },
  { id: 52225, title: 'Remediation checklist appendix', skip: false },
  { id: 52226, title: 'PGP-encrypted export', skip: false },
  { id: 52227, title: 'Export retention policy', skip: false },
  { id: 52228, title: 'Export versioning', skip: false },
  { id: 52229, title: 'Export completion notifications', skip: false },
  { id: 52230, title: 'Large-hunt export chunking', skip: false },
  { id: 52231, title: 'Export progress indicator', skip: false },
  { id: 52232, title: 'Export retry on failure', skip: false },
  { id: 52233, title: 'Export history log', skip: false },
  { id: 52234, title: 'One-click export presets', skip: false },
  { id: 52235, title: 'Jira-compatible CSV export', skip: false },
  { id: 52236, title: 'STIX 2.1 export for threat intel', skip: false },
  { id: 52237, title: 'CVSS vector string export', skip: false },
  { id: 52238, title: 'CWE mapping export', skip: false },
  { id: 52239, title: 'Export with custom cover page', skip: false },
  { id: 52240, title: 'Export approval workflow (post-hunt)', skip: false },
];

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

/* 52221 — Lifecycle-history timeline builder. */
export function buildLifecycleTimeline(finding, events = []) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const timeline = events
    .filter(e => e.findingId === finding.id || !e.findingId)
    .map(e => ({
      at: e.at ?? null,
      from: e.from || null,
      to: e.to || 'unknown',
      actor: e.actor || 'unknown',
      note: e.note || null,
    }))
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  return { ok: true, findingId: finding.id, timeline, transitions: timeline.length };
}

/* 52222 — Comparison-data exporter (before/after diff datasets). */
export function exportComparisonData(before = [], after = []) {
  if (!Array.isArray(before) || !Array.isArray(after))
    return { ok: false, reason: 'before/after arrays required' };
  const b = new Map(before.map(f => [f.id, f]));
  const a = new Map(after.map(f => [f.id, f]));
  const added = [...a.keys()].filter(id => !b.has(id)).map(id => a.get(id));
  const removed = [...b.keys()].filter(id => !a.has(id)).map(id => b.get(id));
  const changed = [...a.keys()]
    .filter(id => b.has(id) && JSON.stringify(b.get(id)) !== JSON.stringify(a.get(id)))
    .map(id => ({ before: b.get(id), after: a.get(id) }));
  const unchanged = [...a.keys()].filter(
    id => b.has(id) && JSON.stringify(b.get(id)) === JSON.stringify(a.get(id))
  );
  return { ok: true, comparison: { added, removed, changed, unchangedCount: unchanged.length } };
}

/* 52223 — Chart export descriptor. */
const CHART_TYPES = ['severity-donut', 'trend-line', 'class-bar', 'heatmap', 'top-assets'];
export function buildChartExportDescriptor(chart) {
  if (!chart || !CHART_TYPES.includes(chart.type))
    return { ok: false, reason: `chart type must be one of: ${CHART_TYPES.join(', ')}` };
  const format = chart.format === 'svg' ? 'svg' : 'png';
  return {
    ok: true,
    descriptor: {
      type: chart.type,
      format,
      width: chart.width || 1200,
      height: chart.height || 675,
      title: chart.title || chart.type,
      filename: `${chart.type}.${format}`,
    },
  };
}

/* 52224 — PDF table-of-contents builder. */
export function buildToc(sections = []) {
  if (!Array.isArray(sections)) return { ok: false, reason: 'sections array required' };
  let page = 1;
  const entries = sections.map(s => {
    const startPage = page;
    page += Math.max(1, s.pageSpan || 1);
    return { title: s.title || 'Untitled', level: s.level || 1, page: startPage };
  });
  return { ok: true, toc: { title: 'Contents', entries, totalPages: page - 1 } };
}

/* 52225 — Remediation checklist appendix builder. */
export function buildChecklistAppendix(findings) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const items = findings
    .slice()
    .sort((a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0))
    .map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      assignee: f.assignee || null,
      done: false,
      remediation: f.remediation || 'TBD',
    }));
  return { ok: true, appendix: { title: 'Remediation checklist', items, openCount: items.length } };
}

/* 52226 — PGP export descriptor. */
export function buildPgpExportDescriptor(recipient) {
  if (!recipient || !recipient.fingerprint)
    return { ok: false, reason: 'recipient {fingerprint} required' };
  return {
    ok: true,
    descriptor: {
      kind: 'pgp',
      recipient: {
        name: recipient.name || null,
        email: recipient.email || null,
        fingerprint: recipient.fingerprint,
      },
      cipher: 'AES-256',
      armor: recipient.armor !== false,
    },
  };
}

/* 52227 — Retention evaluator. */
export function evaluateRetention(exports, policy = {}, now = Date.now()) {
  if (!Array.isArray(exports)) return { ok: false, reason: 'exports array required' };
  const ttlMs = (policy.retainDays ?? 30) * 86400000;
  const expired = exports.filter(e => typeof e.createdAt === 'number' && now - e.createdAt > ttlMs);
  const kept = exports.filter(e => !expired.includes(e));
  return {
    ok: true,
    expired: expired.map(e => e.id),
    kept: kept.map(e => e.id),
    policy: { retainDays: policy.retainDays ?? 30 },
    evaluatedAt: now,
  };
}

/* 52228 — Versioning log appender. */
export function appendVersion(versionLog = [], entry, now = Date.now()) {
  if (!entry || !entry.exportId) return { ok: false, reason: 'entry {exportId} required' };
  const v = {
    exportId: entry.exportId,
    version: versionLog.filter(l => l.exportId === entry.exportId).length + 1,
    createdAt: entry.createdAt ?? now,
    hash: entry.hash || null,
    note: entry.note || null,
  };
  return { ok: true, version: v, log: [...versionLog, v] };
}

/* 52229 — Completion notification builder. */
export function buildCompletionNotification(job) {
  if (!job || !job.id) return { ok: false, reason: 'job {id} required' };
  const title = job.status === 'failed' ? 'Export failed' : 'Export ready';
  return {
    ok: true,
    notification: {
      title,
      jobId: job.id,
      format: job.format || 'unknown',
      downloadUrl:
        job.status === 'failed' ? null : job.downloadUrl || `/api/v1/exports/${job.id}/download`,
      message:
        job.status === 'failed'
          ? `Export ${job.id} failed after ${job.attempts || 1} attempt(s).`
          : `Export ${job.id} (${job.format}) is ready for download.`,
    },
  };
}

/* 52230 — Large-hunt chunking splitter. */
export function chunkExports(findings, chunkSize = 500) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const size = Math.max(1, Math.floor(chunkSize) || 500);
  const chunks = [];
  for (let i = 0; i < findings.length; i += size)
    chunks.push({ index: chunks.length, findings: findings.slice(i, i + size) });
  return { ok: true, chunks, chunkSize: size, total: findings.length };
}

/* 52231 — Progress tracker reducer. */
export const PROGRESS_INITIAL = { done: 0, total: 0, stage: 'idle', percent: 0 };
export function progressReducer(state = PROGRESS_INITIAL, action) {
  if (!action || !action.type) return state;
  if (action.type === 'start') {
    const total = action.total || 0;
    return { done: 0, total, stage: 'running', percent: 0 };
  }
  if (action.type === 'advance') {
    const done = Math.min(state.total, state.done + (action.by || 1));
    return {
      done,
      total: state.total,
      stage: done >= state.total ? 'complete' : 'running',
      percent: state.total ? Math.round((done / state.total) * 100) : 0,
    };
  }
  if (action.type === 'fail')
    return { ...state, stage: 'failed', error: action.error || 'unknown' };
  return state;
}

/* 52232 — Retry-with-backoff evaluator. */
export function evaluateRetry(attempt) {
  const a = attempt || {};
  const maxAttempts = a.maxAttempts ?? 3;
  const attempts = a.attempts ?? 1;
  if (attempts > maxAttempts) return { ok: true, action: 'alert', reason: 'max attempts exceeded' };
  if (a.status === 'success') return { ok: true, action: 'none', reason: 'already succeeded' };
  const backoffMs = Math.min(60000, 2000 * 2 ** Math.max(0, attempts - 1));
  return { ok: true, action: 'retry', nextAttemptInMs: backoffMs, attemptNumber: attempts + 1 };
}

/* 52233 — History log appender. */
export function appendHistory(log = [], entry, now = Date.now()) {
  if (!entry || !entry.format) return { ok: false, reason: 'entry {format} required' };
  const record = {
    id: entry.id || `exp-${now}-${log.length + 1}`,
    who: entry.who || 'unknown',
    when: entry.when ?? now,
    format: entry.format,
    filter: entry.filter || {},
    hash: entry.hash || null,
  };
  return { ok: true, record, log: [...log, record] };
}

/* 52234 — One-click preset definitions. */
export const EXPORT_PRESETS = {
  'exec-pack': {
    formats: ['pdf', 'pptx-notes'],
    filter: { severity: ['critical', 'high'] },
    branding: true,
    label: 'Executive pack',
  },
  'engineer-pack': {
    formats: ['sarif', 'csv', 'json'],
    filter: {},
    includePoc: true,
    label: 'Engineer pack',
  },
  'auditor-pack': {
    formats: ['pdf', 'docx', 'csv'],
    filter: {},
    redacted: false,
    includeAuditLog: true,
    label: 'Auditor pack',
  },
};
export function getExportPreset(name) {
  const p = EXPORT_PRESETS[name];
  if (!p)
    return { ok: false, reason: `unknown preset: ${name}`, available: Object.keys(EXPORT_PRESETS) };
  return { ok: true, preset: { name, ...p } };
}

/* 52235 — Jira-compatible CSV export. */
const JIRA_COLUMNS = ['Issue Type', 'Summary', 'Priority', 'Description', 'Labels'];
function jiraPriority(sev) {
  return (
    { critical: 'Highest', high: 'High', medium: 'Medium', low: 'Low', info: 'Lowest' }[sev] ||
    'Medium'
  );
}
export function buildJiraCsv(findings) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const q = v => JSON.stringify(v ?? '');
  const rows = findings.map(f =>
    [
      'Task',
      `${f.id}: ${f.title}`,
      jiraPriority(f.severity),
      `${f.description}\n\nRemediation: ${f.remediation || 'TBD'}\nCWE: ${f.cwe || 'n/a'}`,
      `security ${f.severity}`,
    ]
      .map(q)
      .join(',')
  );
  return {
    ok: true,
    csv: [JIRA_COLUMNS.join(','), ...rows].join('\n'),
    rows: rows.length,
    mapping: JIRA_COLUMNS,
  };
}

/* 52236 — STIX 2.1 bundle builder. */
function stixId(prefix, now) {
  return `${prefix}--${String(now).padStart(13, '0')}-${prefix.length}`;
}
export function buildStixBundle(findings, now = Date.now()) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const objects = findings.map((f, i) => ({
    type: 'vulnerability',
    spec_version: '2.1',
    id: stixId('vulnerability', now + i),
    created: new Date(now).toISOString(),
    modified: new Date(now).toISOString(),
    name: f.title,
    description: f.description || '',
    external_references: f.cwe ? [{ source_name: 'cwe', external_id: f.cwe }] : [],
    x_dark_matter_severity: f.severity,
  }));
  return {
    ok: true,
    bundle: { type: 'bundle', id: stixId('bundle', now), objects },
    count: objects.length,
  };
}

/* 52237 — CVSS vector extractor. */
export function extractCvssVectors(findings) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const rows = findings.map(f => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    vector: f.cvssVector || null,
    score: typeof f.cvssScore === 'number' ? f.cvssScore : null,
  }));
  return { ok: true, vectors: rows, withVector: rows.filter(r => r.vector).length };
}

/* 52238 — CWE mapping builder. */
export function buildCweMapping(findings) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const mapping = {};
  for (const f of findings) {
    const cwe = f.cwe || 'CWE-UNKNOWN';
    (mapping[cwe] = mapping[cwe] || []).push(f.id);
  }
  return { ok: true, mapping, cweCount: Object.keys(mapping).length };
}

/* 52239 — Custom cover-page model. */
export function buildCoverPageModel(opts = {}) {
  const model = {
    engagement: opts.engagement || 'Security assessment',
    tester: opts.tester || 'Infinity AI',
    client: opts.client || 'Client',
    dates: opts.dates || null,
    scope: opts.scope || [],
    classification: opts.classification || 'Confidential',
  };
  return { ok: true, coverPage: model };
}

/* 52240 — Export approval workflow state machine. */
export const APPROVAL_STATES = ['none', 'requested', 'approved', 'rejected'];
export function approvalWorkflow(state = 'none', action, now = Date.now()) {
  if (action === 'request' && state === 'none')
    return { ok: true, state: 'requested', requestedAt: now };
  if (action === 'approve' && state === 'requested')
    return { ok: true, state: 'approved', decidedAt: now, decidedBy: 'lead' };
  if (action === 'reject' && state === 'requested')
    return { ok: true, state: 'rejected', decidedAt: now, decidedBy: 'lead' };
  if (action === 'reset' && (state === 'approved' || state === 'rejected'))
    return { ok: true, state: 'none' };
  return {
    ok: false,
    reason: `invalid transition: ${state} + ${action}`,
    allowed: APPROVAL_STATES,
  };
}
