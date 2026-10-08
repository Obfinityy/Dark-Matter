/**
 * exportFormatsCore.js — Infinity AI · Dark-Matter · Wave 56 (ideas 52201–52220)
 * Pure JS (no React / DOM / network). Deterministic report-export models,
 * builders, selectors and enrichers. Time is injected via `now` params
 * (default Date.now()) so every function is reproducible under a fixed clock.
 */

export const WAVE56_FMT_IDEAS = [
  { id: 52201, title: 'DOCX report export', skip: false },
  { id: 52202, title: 'Nessus-style XML export', skip: false },
  { id: 52203, title: 'JUnit XML for CI', skip: false },
  { id: 52204, title: 'Filtered-subset export', skip: false },
  { id: 52205, title: 'Selected-findings-only export', skip: false },
  { id: 52206, title: 'Triage-state-aware export', skip: false },
  { id: 52207, title: 'FP-reason-inclusive export', skip: false },
  { id: 52208, title: 'Remediation-status export', skip: false },
  { id: 52209, title: 'Scheduled exports (post-hunt)', skip: false },
  { id: 52210, title: 'Export to S3 / Google Drive', skip: false },
  { id: 52211, title: 'Export API endpoint', skip: false },
  { id: 52212, title: 'Export templates (post-hunt)', skip: false },
  { id: 52213, title: 'Multi-language exports', skip: false },
  { id: 52214, title: 'Redacted export mode', skip: false },
  { id: 52215, title: 'Severity-threshold export', skip: false },
  { id: 52216, title: 'Delta export (new since last)', skip: false },
  { id: 52217, title: 'PoC bundle ZIP export', skip: false },
  { id: 52218, title: 'Evidence attachments export', skip: false },
  { id: 52219, title: 'Audit-log export (post-hunt)', skip: false },
  { id: 52220, title: 'Comment-thread export', skip: false },
];

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function summarize(findings) {
  const counts = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
  return { total: findings.length, bySeverity: counts };
}

/* 52201 — DOCX payload model builder. */
export function buildDocxModel(hunt, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings))
    return { ok: false, reason: 'hunt with findings array required' };
  const sections = [
    { kind: 'cover', title: 'Security Assessment Report', target: hunt.target },
    { kind: 'summary', ...summarize(hunt.findings) },
    ...hunt.findings.map(f => ({
      kind: 'finding',
      id: f.id,
      heading: f.title,
      severity: f.severity,
      body: f.description,
      poc: f.poc || null,
      remediation: f.remediation || null,
    })),
  ];
  return {
    ok: true,
    docx: { format: 'docx', editable: true, target: hunt.target, generatedAt: now, sections },
  };
}

/* 52202 — Nessus-style XML builder. */
export function buildNessusXml(hunt, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings))
    return { ok: false, reason: 'hunt with findings array required' };
  const hosts = {};
  for (const f of hunt.findings) {
    const h = f.target || hunt.target || 'unknown';
    (hosts[h] = hosts[h] || []).push(f);
  }
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<NessusClientData_v2>\n';
  for (const [host, items] of Object.entries(hosts)) {
    xml += ` <ReportHost name="${esc(host)}">\n`;
    for (const f of items) {
      xml += `  <ReportItem port="0" pluginID="${esc(f.id)}" severity="${SEVERITY_ORDER[f.severity] ?? 0}" pluginName="${esc(f.title)}">\n`;
      xml += `   <description>${esc(f.description)}</description>\n`;
      xml += `   <solution>${esc(f.remediation || 'See remediation guidance.')}</solution>\n`;
      xml += `   <cwe>${esc(f.cwe || 'n/a')}</cwe>\n`;
      xml += '  </ReportItem>\n';
    }
    xml += ' </ReportHost>\n';
  }
  xml += ` <Policy><policyName>Infinity AI hunt ${esc(hunt.id)}</policyName></Policy>\n</NessusClientData_v2>`;
  return { ok: true, xml, hostCount: Object.keys(hosts).length, generatedAt: now };
}

/* 52203 — JUnit XML for CI. */
export function buildJUnitXml(hunt, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings))
    return { ok: false, reason: 'hunt with findings array required' };
  const failures = hunt.findings.filter(f => f.severity === 'critical' || f.severity === 'high');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="dark-matter-hunt-${esc(hunt.id)}" tests="${hunt.findings.length}" failures="${failures.length}" timestamp="${new Date(now).toISOString()}">\n`;
  for (const f of hunt.findings) {
    const failed = f.severity === 'critical' || f.severity === 'high';
    xml += ` <testcase classname="${esc(f.vulnClass || 'finding')}" name="${esc(f.id)} ${esc(f.title)}">\n`;
    if (failed)
      xml += `  <failure message="${esc(f.severity)} finding">${esc(f.description)}</failure>\n`;
    xml += ' </testcase>\n';
  }
  xml += '</testsuite>';
  return { ok: true, xml, tests: hunt.findings.length, failures: failures.length };
}

/* 52204 — Filtered-subset selector. */
export function selectFilteredSubset(findings, filter = {}) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const { severity, status, vulnClass, target } = filter;
  const subset = findings.filter(
    f =>
      (!severity ||
        (Array.isArray(severity) ? severity.includes(f.severity) : f.severity === severity)) &&
      (!status || f.status === status) &&
      (!vulnClass || f.vulnClass === vulnClass) &&
      (!target || f.target === target)
  );
  return { ok: true, subset, total: findings.length, filter };
}

/* 52205 — Selected-only exporter (list order preserved). */
export function exportSelectedOnly(findings, selectedIds) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  const picked = ids.map(id => findings.find(f => f.id === id)).filter(Boolean);
  return { ok: true, findings: picked, requested: ids.length, resolved: picked.length };
}

/* 52206 — Triage-state-aware enricher. */
export function enrichWithTriage(findings, triage = {}) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const enriched = findings.map(f => {
    const t = triage[f.id] || {};
    return {
      ...f,
      triage: {
        decision: t.decision || 'pending',
        reviewer: t.reviewer || null,
        decidedAt: t.decidedAt || null,
      },
    };
  });
  return { ok: true, findings: enriched };
}

/* 52207 — FP appendix builder. */
export function buildFpAppendix(dismissedFindings) {
  if (!Array.isArray(dismissedFindings))
    return { ok: false, reason: 'dismissed findings array required' };
  const entries = dismissedFindings.map(f => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    reason: f.fpReason || f.dismissalReason || 'no reason recorded',
    dismissedBy: f.dismissedBy || null,
    dismissedAt: f.dismissedAt || null,
  }));
  return {
    ok: true,
    appendix: { title: 'Dismissed findings (false positives)', entries, count: entries.length },
  };
}

/* 52208 — Remediation-status enricher. */
export function enrichRemediationStatus(findings, statusMap = {}) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const enriched = findings.map(f => {
    const s = statusMap[f.id] || {};
    return {
      ...f,
      remediationStatus: {
        state: s.state || 'not-started',
        assignee: s.assignee || f.assignee || null,
        verification: s.verification || null,
        updatedAt: s.updatedAt || null,
      },
    };
  });
  return { ok: true, findings: enriched };
}

/* 52209 — Schedule evaluator. */
export function evaluateSchedule(schedules, now = Date.now()) {
  if (!Array.isArray(schedules)) return { ok: false, reason: 'schedules array required' };
  const due = schedules.filter(s => typeof s.nextRunAt === 'number' && s.nextRunAt <= now);
  const upcoming = schedules
    .filter(s => typeof s.nextRunAt === 'number' && s.nextRunAt > now)
    .sort((a, b) => a.nextRunAt - b.nextRunAt);
  return { ok: true, due, upcoming, evaluatedAt: now };
}

/* 52210 — S3 / Drive delivery descriptor. */
export function buildDeliveryDescriptor(destination) {
  if (!destination || !destination.kind)
    return { ok: false, reason: 'destination {kind} required' };
  const kind = destination.kind;
  if (kind === 's3') {
    if (!destination.bucket || !destination.key)
      return { ok: false, reason: 's3 needs bucket + key' };
    return {
      ok: true,
      descriptor: {
        kind,
        bucket: destination.bucket,
        key: destination.key,
        region: destination.region || 'us-east-1',
        acl: destination.acl || 'private',
      },
    };
  }
  if (kind === 'drive') {
    if (!destination.folderId) return { ok: false, reason: 'drive needs folderId' };
    return {
      ok: true,
      descriptor: {
        kind,
        folderId: destination.folderId,
        filename: destination.filename || 'report.pdf',
        shareWith: destination.shareWith || [],
      },
    };
  }
  return { ok: false, reason: `unsupported destination kind: ${kind}` };
}

/* 52211 — Export API request descriptor. */
export function buildApiExportRequest(opts) {
  if (!opts || !opts.format) return { ok: false, reason: 'format required' };
  const allowed = ['pdf', 'docx', 'csv', 'json', 'sarif', 'nessus', 'junit', 'html', 'md', 'stix'];
  if (!allowed.includes(opts.format))
    return { ok: false, reason: `unsupported format: ${opts.format}` };
  return {
    ok: true,
    request: {
      method: 'POST',
      path: '/api/v1/exports',
      body: {
        format: opts.format,
        huntId: opts.huntId || null,
        filter: opts.filter || {},
        language: opts.language || 'en',
        redacted: !!opts.redacted,
      },
    },
  };
}

/* 52212 — Export template store (pure, immutable). */
export function templateStore(templates = {}, action) {
  if (!action || !action.type) return { ok: false, reason: 'action {type} required' };
  if (action.type === 'save') {
    if (!action.name || !action.config) return { ok: false, reason: 'save needs name + config' };
    return {
      ok: true,
      templates: {
        ...templates,
        [action.name]: { ...action.config, savedAt: action.now ?? Date.now() },
      },
    };
  }
  if (action.type === 'apply') {
    const t = templates[action.name];
    if (!t) return { ok: false, reason: `unknown template: ${action.name}` };
    return { ok: true, config: t };
  }
  if (action.type === 'list') return { ok: true, names: Object.keys(templates).sort() };
  return { ok: false, reason: `unknown action type: ${action.type}` };
}

/* 52213 — Multi-language export descriptor. */
export const EXPORT_LANGUAGES = ['en', 'hi', 'es', 'fr', 'de', 'pt'];
export function buildLanguageDescriptor(lang) {
  if (!EXPORT_LANGUAGES.includes(lang))
    return { ok: false, reason: `unsupported language: ${lang}`, supported: EXPORT_LANGUAGES };
  return { ok: true, language: { code: lang, direction: 'ltr', templateKey: `report.${lang}` } };
}

/* 52214 — Redaction function. */
const REDACT_PATTERNS = [
  {
    name: 'secret-key',
    re: /(?<=[a-zA-Z0-9_-]{4})([a-zA-Z0-9_-]{20,})/g,
    mask: m => m.slice(0, 4) + '…[redacted]',
  },
  {
    name: 'email',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    mask: () => '[email redacted]',
  },
  { name: 'ipv4', re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, mask: () => '[ip redacted]' },
];
export function redactForExport(text, { redactPayloads = true } = {}) {
  let out = String(text ?? '');
  const redactions = [];
  for (const p of REDACT_PATTERNS) {
    out = out.replace(p.re, m => {
      redactions.push(p.name);
      return p.mask(m);
    });
  }
  if (redactPayloads) {
    const before = out.length;
    out = out.replace(/<script[\s\S]*?<\/script>/gi, '[payload redacted]');
    if (out.length !== before) redactions.push('payload');
  }
  return { text: out, redactions };
}

/* 52215 — Severity-threshold filter. */
export function filterBySeverityThreshold(findings, threshold = 'medium') {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const min = SEVERITY_ORDER[threshold] ?? 2;
  const subset = findings.filter(f => (SEVERITY_ORDER[f.severity] ?? 0) >= min);
  return { ok: true, findings: subset, threshold, kept: subset.length, total: findings.length };
}

/* 52216 — Delta selector (new since last export/date). */
export function selectDelta(findings, since) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  if (typeof since !== 'number') return { ok: false, reason: 'since timestamp required' };
  const fresh = findings.filter(f => (f.createdAt ?? 0) > since || (f.updatedAt ?? 0) > since);
  return { ok: true, findings: fresh, since, count: fresh.length };
}

/* 52217 — PoC bundle ZIP manifest builder. */
export function buildPocZipManifest(findings, now = Date.now()) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const withPoc = findings.filter(f => f.poc);
  const files = withPoc.map(f => ({
    path: `poc/${f.id}/curl.sh`,
    findingId: f.id,
    kind: 'poc',
    hasPython: Boolean(f.pocPython),
  }));
  return {
    ok: true,
    manifest: {
      archive: `poc-bundle-${now}.zip`,
      files,
      findingCount: withPoc.length,
      skippedWithoutPoc: findings.length - withPoc.length,
    },
  };
}

/* 52218 — Evidence manifest builder. */
export function buildEvidenceManifest(findings) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array required' };
  const rows = [];
  for (const f of findings)
    for (const e of f.evidence || [])
      rows.push({
        findingId: f.id,
        kind: e.kind || 'unknown',
        summary: e.summary || '',
        hash: e.hash || null,
      });
  return {
    ok: true,
    manifest: { rows, total: rows.length },
    csv: [
      'finding_id,kind,summary,hash',
      ...rows.map(r => [r.findingId, r.kind, JSON.stringify(r.summary), r.hash || ''].join(',')),
    ].join('\n'),
  };
}

/* 52219 — Audit-log exporter. */
export function exportAuditLog(events, now = Date.now()) {
  if (!Array.isArray(events)) return { ok: false, reason: 'events array required' };
  const rows = events.map(e => ({
    at: e.at ?? null,
    actor: e.actor || 'unknown',
    action: e.action || 'unknown',
    target: e.target || null,
  }));
  const csv = [
    'at,actor,action,target',
    ...rows.map(r => [r.at ?? '', r.actor, JSON.stringify(r.action), r.target ?? ''].join(',')),
  ].join('\n');
  return { ok: true, events: rows, csv, count: rows.length, exportedAt: now };
}

/* 52220 — Comment-thread exporter. */
export function exportCommentThreads(threads) {
  if (!Array.isArray(threads)) return { ok: false, reason: 'threads array required' };
  const out = threads.map(t => ({
    findingId: t.findingId,
    comments: (t.comments || []).map(c => ({
      author: c.author || 'unknown',
      at: c.at || null,
      body: c.body || '',
    })),
    count: (t.comments || []).length,
  }));
  return { ok: true, threads: out, totalComments: out.reduce((n, t) => n + t.count, 0) };
}
