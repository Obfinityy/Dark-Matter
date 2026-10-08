/**
 * exportCore.js — Infinity AI · Dark-Matter · Wave 55
 * Pure logic (no React, no DOM, no network) backing the report-export suite:
 * idea-bank ideas 52182–52200. Every exported function is pure and
 * deterministic; time is injected via `now` parameters (defaults to
 * Date.now()).
 */

export const WAVE55_EXP_IDEAS = [
  { id: 52182, title: 'Executive-summary PDF export' },
  { id: 52183, title: 'Technical deep-dive PDF' },
  { id: 52184, title: 'Per-finding PDF export' },
  { id: 52185, title: 'Evidence-free PDF variant' },
  { id: 52186, title: 'Watermarked PDFs' },
  { id: 52187, title: 'Password-protected PDFs' },
  { id: 52188, title: 'Digitally signed PDFs' },
  { id: 52189, title: 'Branded report letterhead' },
  { id: 52190, title: 'Versioned JSON full dump' },
  { id: 52191, title: 'Per-finding JSON export' },
  { id: 52192, title: 'SIEM-ready JSON format' },
  { id: 52193, title: 'Findings CSV export' },
  { id: 52194, title: 'Custom CSV column picker' },
  { id: 52195, title: 'Excel pivot-ready CSV' },
  { id: 52196, title: 'SARIF 2.1.0 export' },
  { id: 52197, title: 'Per-run SARIF files' },
  { id: 52198, title: 'GitHub code-scanning upload helper' },
  { id: 52199, title: 'HTML report export' },
  { id: 52200, title: 'Markdown report export (post-hunt)' },
];

export const EXPORT_SCHEMA = 'infinity-ai-export/v1';
export const SARIF_VERSION = '2.1.0';
export const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function riskScoreOf(findings) {
  const rows = Array.isArray(findings) ? findings : [];
  const weights = { critical: 25, high: 10, medium: 4, low: 1, info: 0 };
  const raw = rows.reduce((sum, f) => sum + (weights[f.severity] || 0), 0);
  return Math.min(100, Math.round(raw));
}

// 52182 — Executive-summary PDF export: one-page-per-hunt model with risk
// score, top findings, and remediation status, branded for leadership.
export function buildExecSummaryModel(hunt) {
  const findings = (hunt && Array.isArray(hunt.findings) ? hunt.findings : []).filter(
    f => f.status !== 'false-positive'
  );
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
  );
  const counts = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
  const remediated = findings.filter(f => f.status === 'fixed' || f.status === 'verified').length;
  return {
    kind: 'exec-summary',
    huntId: (hunt && hunt.id) || null,
    target: (hunt && hunt.target) || 'unknown target',
    generatedBy: 'Infinity AI',
    riskScore: riskScoreOf(findings),
    totalFindings: findings.length,
    severityCounts: counts,
    topFindings: sorted
      .slice(0, 5)
      .map(f => ({ id: f.id, title: f.title, severity: f.severity, status: f.status })),
    remediationStatus: { remediated, open: findings.length - remediated },
  };
}

// 52183 — Technical deep-dive PDF: full-evidence model with every
// request/response, PoC steps, and CWE references for engineers.
export function buildDeepDiveModel(hunt) {
  const findings = (hunt && Array.isArray(hunt.findings) ? hunt.findings : []).filter(
    f => f.status !== 'false-positive'
  );
  return {
    kind: 'deep-dive',
    huntId: (hunt && hunt.id) || null,
    target: (hunt && hunt.target) || 'unknown target',
    generatedBy: 'Infinity AI',
    findings: findings.map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      vulnClass: f.vulnClass || null,
      cwe: f.cwe || null,
      endpoint: f.endpoint || null,
      description: f.description || '',
      evidence: Array.isArray(f.evidence) ? f.evidence : [],
      poc: f.poc || null,
      remediation: f.remediation || '',
    })),
  };
}

// 52184 — Per-finding PDF export: standalone single-finding model for tickets
// or bounty submissions.
export function buildPerFindingModel(finding, hunt = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'a finding is required' };
  return {
    ok: true,
    model: {
      kind: 'per-finding',
      huntId: hunt.id || null,
      generatedBy: 'Infinity AI',
      finding: {
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        vulnClass: finding.vulnClass || null,
        cwe: finding.cwe || null,
        endpoint: finding.endpoint || null,
        description: finding.description || '',
        evidence: Array.isArray(finding.evidence) ? finding.evidence : [],
        poc: finding.poc || null,
        remediation: finding.remediation || '',
      },
    },
  };
}

// 52185 — Evidence-free PDF variant: same report model with raw payloads
// stripped, safe for wider distribution. Raw HTTP bodies and payload strings
// are removed while keeping titles, severities, and remediation guidance.
export function stripEvidenceForSharing(model) {
  if (!model || typeof model !== 'object')
    return { ok: false, reason: 'a report model is required' };
  const clone = JSON.parse(JSON.stringify(model));
  const scrub = finding => {
    delete finding.poc;
    if (Array.isArray(finding.evidence)) {
      finding.evidence = finding.evidence.map(e => ({
        kind: e.kind || 'note',
        summary: 'evidence redacted for sharing',
      }));
    }
    return finding;
  };
  if (Array.isArray(clone.findings)) clone.findings = clone.findings.map(scrub);
  if (clone.finding) clone.finding = scrub(clone.finding);
  if (Array.isArray(clone.topFindings)) clone.topFindings = clone.topFindings.map(f => ({ ...f }));
  clone.evidenceRedacted = true;
  return { ok: true, model: clone };
}

// 52186 — Watermarked PDFs: "Confidential — <viewer>" watermark descriptor
// applied per recipient for traceability.
export function watermarkDescriptor(viewer, options = {}) {
  if (!viewer) return { ok: false, reason: 'a viewer name is required' };
  return {
    ok: true,
    watermark: {
      text: `Confidential — ${viewer}`,
      opacity: options.opacity || 0.15,
      diagonal: options.diagonal !== false,
      fontSize: options.fontSize || 48,
      placement: options.placement || 'center',
    },
  };
}

// 52187 — Password-protected PDFs: encryption descriptor; the password is
// delivered through a separate channel (never stored in the export itself).
export function buildProtectionDescriptor(password, options = {}) {
  if (!password || String(password).length < 8) {
    return { ok: false, reason: 'password must be at least 8 characters' };
  }
  return {
    ok: true,
    protection: {
      algorithm: 'AES-256',
      passwordDeliveredVia: options.deliveryChannel || 'separate-channel',
      permissions: options.permissions || ['print', 'copy'],
      passwordSet: true,
    },
  };
}

// 52188 — Digitally signed PDFs: signature block referencing the org
// certificate so recipients can verify authenticity.
export function buildSignatureBlock(cert, payloadHash, now = Date.now()) {
  if (!cert || !cert.subject)
    return { ok: false, reason: 'a certificate with a subject is required' };
  if (!payloadHash) return { ok: false, reason: 'payload hash is required' };
  return {
    ok: true,
    signature: {
      signer: cert.subject,
      issuer: cert.issuer || null,
      algorithm: 'RSA-SHA256',
      payloadHash,
      signedAt: now,
      valid: typeof cert.expiresAt === 'number' ? now < cert.expiresAt : true,
    },
  };
}

// 52189 — Branded report letterhead: company logo, colors, and footer applied
// to all PDF exports via a branding profile.
export function applyLetterheadBrand(model, brand) {
  if (!model || typeof model !== 'object')
    return { ok: false, reason: 'a report model is required' };
  if (!brand || !brand.companyName)
    return { ok: false, reason: 'a branding profile with companyName is required' };
  return {
    ok: true,
    model: {
      ...JSON.parse(JSON.stringify(model)),
      letterhead: {
        companyName: brand.companyName,
        logoUrl: brand.logoUrl || null,
        primaryColor: brand.primaryColor || '#6d28d9',
        footer: brand.footer || `Generated by Infinity AI · ${brand.companyName}`,
      },
    },
  };
}

// 52190 — Versioned JSON full dump: complete hunt data as schema-versioned
// JSON for pipelines.
export function buildVersionedDump(hunt, now = Date.now()) {
  return {
    schema: EXPORT_SCHEMA,
    generatedBy: 'Infinity AI',
    exportedAt: now,
    hunt: {
      id: (hunt && hunt.id) || null,
      target: (hunt && hunt.target) || null,
      startedAt: (hunt && hunt.startedAt) || null,
      completedAt: (hunt && hunt.completedAt) || null,
    },
    findings: (hunt && Array.isArray(hunt.findings) ? hunt.findings : []).map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      vulnClass: f.vulnClass || null,
      cwe: f.cwe || null,
      status: f.status || 'open',
      endpoint: f.endpoint || null,
      target: f.target || null,
      confidence: f.confidence || null,
      evidence: Array.isArray(f.evidence) ? f.evidence : [],
      poc: f.poc || null,
      remediation: f.remediation || '',
    })),
  };
}

// 52191 — Per-finding JSON export: single-finding JSON for feeding individual
// issues into automation.
export function findingToJson(finding, hunt = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'a finding is required' };
  return {
    ok: true,
    json: {
      schema: EXPORT_SCHEMA,
      generatedBy: 'Infinity AI',
      huntId: hunt.id || null,
      finding: {
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        vulnClass: finding.vulnClass || null,
        cwe: finding.cwe || null,
        status: finding.status || 'open',
        endpoint: finding.endpoint || null,
        target: finding.target || null,
        confidence: finding.confidence || null,
        evidence: Array.isArray(finding.evidence) ? finding.evidence : [],
        poc: finding.poc || null,
        remediation: finding.remediation || '',
      },
    },
  };
}

// 52192 — SIEM-ready JSON format: flattened JSON mapping finding fields to
// common SIEM schemas (ECS/CEF-friendly).
export function flattenToSiem(findings, hunt = {}) {
  const rows = Array.isArray(findings) ? findings : [];
  return rows.map(f => ({
    '@timestamp': f.detectedAt ? new Date(f.detectedAt).toISOString() : null,
    'event.kind': 'alert',
    'event.category': ['vulnerability'],
    'event.severity': f.severity || 'unknown',
    'vulnerability.id': f.id,
    'vulnerability.title': f.title,
    'vulnerability.classification': f.vulnClass || null,
    'vulnerability.cwe': f.cwe || null,
    'url.full': f.endpoint || null,
    'observer.vendor': 'Infinity AI',
    'observer.product': 'Dark-Matter',
    'related.hunt': hunt.id || null,
    'user.name': f.assignee || null,
  }));
}

// 52193 + 52194 — Findings CSV export with configurable columns; column
// presets let users save layouts (evidence-free preset included).
export const CSV_COLUMNS = [
  { id: 'id', label: 'Finding ID' },
  { id: 'title', label: 'Title' },
  { id: 'severity', label: 'Severity' },
  { id: 'vulnClass', label: 'Vuln class' },
  { id: 'cwe', label: 'CWE' },
  { id: 'status', label: 'Status' },
  { id: 'endpoint', label: 'Endpoint' },
  { id: 'target', label: 'Target' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'confidence', label: 'Confidence' },
  { id: 'remediation', label: 'Remediation' },
];
export const CSV_COLUMN_PRESETS = {
  default: ['id', 'title', 'severity', 'status', 'endpoint', 'target', 'assignee'],
  leadership: ['id', 'title', 'severity', 'status'],
  'no-evidence': ['id', 'title', 'severity', 'status', 'remediation'],
  full: CSV_COLUMNS.map(c => c.id),
};
export function applyColumnPreset(presetName) {
  const preset = CSV_COLUMN_PRESETS[presetName];
  if (!preset) return { ok: false, reason: `unknown preset: ${presetName}` };
  return { ok: true, columns: [...preset] };
}
export function findingsToCsv(findings, columns) {
  const cols = Array.isArray(columns) && columns.length > 0 ? columns : CSV_COLUMN_PRESETS.default;
  const header = cols.map(c => {
    const def = CSV_COLUMNS.find(d => d.id === c);
    return def ? def.label : c;
  });
  const lines = [header.map(csvCell).join(',')];
  for (const f of Array.isArray(findings) ? findings : []) {
    lines.push(cols.map(c => csvCell(f[c])).join(','));
  }
  return {
    csv: lines.join('\n'),
    columns: cols,
    rows: Array.isArray(findings) ? findings.length : 0,
  };
}

// 52195 — Excel pivot-ready CSV: normalized, denormalized rows (one per
// affected asset) optimized for pivot tables.
export function findingsToPivotCsv(findings) {
  const header = ['finding_id', 'title', 'severity', 'asset', 'status'];
  const lines = [header.join(',')];
  let rows = 0;
  for (const f of Array.isArray(findings) ? findings : []) {
    const assets =
      Array.isArray(f.assets) && f.assets.length > 0
        ? f.assets
        : [f.asset || f.target || 'unknown'];
    for (const asset of assets) {
      lines.push([f.id, f.title, f.severity, asset, f.status || 'open'].map(csvCell).join(','));
      rows += 1;
    }
  }
  return { csv: lines.join('\n'), rows };
}

// Severity-threshold + run-delta filters shared by exports.
export function filterBySeverityThreshold(findings, minSeverity = 'medium') {
  const rank = SEVERITY_RANK[minSeverity];
  if (rank === undefined) return { ok: false, reason: `unknown severity: ${minSeverity}` };
  return {
    ok: true,
    findings: (Array.isArray(findings) ? findings : []).filter(
      f => (SEVERITY_RANK[f.severity] ?? 99) <= rank
    ),
  };
}
export function diffRunsToDelta(current, previous) {
  const cur = new Map((Array.isArray(current) ? current : []).map(f => [f.id, f]));
  const prev = new Map((Array.isArray(previous) ? previous : []).map(f => [f.id, f]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [id, f] of cur) {
    if (!prev.has(id)) added.push(id);
    else if (prev.get(id).status !== f.status || prev.get(id).severity !== f.severity)
      changed.push(id);
  }
  for (const id of prev.keys()) if (!cur.has(id)) removed.push(id);
  return { added, removed, changed };
}

// 52196 — SARIF 2.1.0 export: standards-compliant SARIF so results import
// into GitHub code scanning and other SARIF consumers.
function sarifLevel(severity) {
  return severity === 'critical' || severity === 'high'
    ? 'error'
    : severity === 'medium'
      ? 'warning'
      : 'note';
}
export function buildSarif(hunt, options = {}) {
  const findings = (hunt && Array.isArray(hunt.findings) ? hunt.findings : []).filter(
    f => f.status !== 'false-positive'
  );
  const rules = [];
  const ruleIndex = new Map();
  for (const f of findings) {
    const ruleId = f.vulnClass ? `infinity-ai/${f.vulnClass}` : `infinity-ai/${f.id}`;
    if (!ruleIndex.has(ruleId)) {
      ruleIndex.set(ruleId, rules.length);
      rules.push({
        id: ruleId,
        name: f.title || ruleId,
        shortDescription: { text: f.title || ruleId },
        fullDescription: { text: f.description || '' },
        properties: { severity: f.severity, cwe: f.cwe || null },
      });
    }
  }
  return {
    version: SARIF_VERSION,
    $schema: SARIF_SCHEMA,
    runs: [
      {
        tool: {
          driver: {
            name: 'Infinity AI Dark-Matter',
            version: options.toolVersion || '1.0.0',
            informationUri: 'https://app.infinity.ai',
            rules,
          },
        },
        results: findings.map(f => ({
          ruleId: ruleIndex.has(`infinity-ai/${f.vulnClass}`)
            ? `infinity-ai/${f.vulnClass}`
            : `infinity-ai/${f.id}`,
          level: sarifLevel(f.severity),
          message: { text: `${f.title} — ${f.severity}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.endpoint || f.target || 'unknown' },
              },
            },
          ],
          properties: {
            findingId: f.id,
            status: f.status || 'open',
            confidence: f.confidence || null,
          },
        })),
      },
    ],
  };
}

// 52197 — Per-run SARIF files: split SARIF output per hunt run for repos
// that track one scan per commit.
export function buildSarifPerRun(runs, options = {}) {
  const list = Array.isArray(runs) ? runs : [];
  return list.map(run => ({
    runId: run.id || 'run',
    sarif: buildSarif({ findings: run.findings || [] }, options),
  }));
}

// 52198 — GitHub code-scanning upload helper: one-click package plus
// instructions to upload SARIF results to GitHub code scanning.
export function buildCodeScanningUploadPackage(sarif, repo) {
  if (!sarif || sarif.version !== SARIF_VERSION)
    return { ok: false, reason: 'a SARIF 2.1.0 document is required' };
  if (!repo || !repo.includes('/'))
    return { ok: false, reason: 'a repo in owner/name form is required' };
  return {
    ok: true,
    package: {
      repo,
      sarifFileName: 'infinity-ai-results.sarif',
      commitShaPlaceholder: '<COMMIT_SHA>',
      refPlaceholder: 'refs/heads/main',
      instructions: [
        '1. Save the SARIF document as infinity-ai-results.sarif in your checkout.',
        '2. Upload with: POST /repos/{owner}/{repo}/code-scanning/sarifs',
        '3. Body: { "commit_sha": "<COMMIT_SHA>", "ref": "refs/heads/main", "sarif": "<base64>" }',
      ],
    },
  };
}

// 52199 — HTML report export: self-contained, styled HTML report with
// collapsible findings for sharing without the app.
export function renderHtmlReport(model) {
  if (!model || typeof model !== 'object')
    return { ok: false, reason: 'a report model is required' };
  const findings = Array.isArray(model.findings)
    ? model.findings
    : Array.isArray(model.topFindings)
      ? model.topFindings
      : model.finding
        ? [model.finding]
        : [];
  const brand = (model.letterhead && model.letterhead.primaryColor) || '#6d28d9';
  const items = findings
    .map(
      f => `
    <details class="finding">
      <summary><span class="sev sev-${escHtml(f.severity || 'info')}">${escHtml(f.severity || 'info')}</span> ${escHtml(f.title || f.id)}</summary>
      <p class="desc">${escHtml(f.description || '')}</p>
      ${f.remediation ? `<p class="rem"><strong>Remediation:</strong> ${escHtml(f.remediation)}</p>` : ''}
    </details>`
    )
    .join('\n');
  return {
    ok: true,
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escHtml(model.target || 'Hunt report')} — Infinity AI</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#111}.sev{font-weight:bold;text-transform:uppercase;font-size:.75rem;padding:.15rem .5rem;border-radius:4px;color:#fff;background:${brand}}.sev-critical{background:#b91c1c}.sev-high{background:#c2410c}.sev-medium{background:#a16207}.sev-low{background:#1d4ed8}.sev-info{background:#6b7280}.finding{border:1px solid #ddd;border-radius:8px;margin:.75rem 0;padding:.75rem}summary{cursor:pointer}</style>
</head>
<body>
<header><h1>Hunt report — ${escHtml(model.target || 'unknown target')}</h1><p>Generated by Infinity AI${model.riskScore !== undefined ? ` · Risk score ${model.riskScore}` : ''}</p></header>
<main>${items || '<p>No findings.</p>'}</main>
</body></html>`,
  };
}

// 52200 — Markdown report export (post-hunt): clean Markdown for wikis,
// Notion, and developer docs.
export function renderMarkdownReport(model) {
  if (!model || typeof model !== 'object')
    return { ok: false, reason: 'a report model is required' };
  const findings = Array.isArray(model.findings)
    ? model.findings
    : Array.isArray(model.topFindings)
      ? model.topFindings
      : model.finding
        ? [model.finding]
        : [];
  const lines = [
    `# Hunt report — ${model.target || 'unknown target'}`,
    '',
    `_Generated by Infinity AI${model.riskScore !== undefined ? ` · Risk score ${model.riskScore}` : ''}_`,
    '',
    `## Findings (${findings.length})`,
    '',
  ];
  for (const f of findings) {
    lines.push(`### ${f.title || f.id} \`[${f.severity || 'info'}]\``);
    if (f.cwe) lines.push(`CWE: ${f.cwe}`);
    if (f.description) lines.push('', f.description);
    if (f.remediation) lines.push('', `**Remediation:** ${f.remediation}`);
    lines.push('');
  }
  return { ok: true, markdown: lines.join('\n') };
}

// Redaction helper: mask payloads and secrets before sharing an export.
export function redactForSharing(text, patterns = []) {
  let out = String(text ?? '');
  const defaults = [
    /Bearer\s+[A-Za-z0-9\-_.=+/]+/gi,
    /api[_-]?key["'\s:=]+[A-Za-z0-9\-_.]+/gi,
    /password["'\s:=]+\S+/gi,
  ];
  for (const rx of [...defaults, ...patterns]) out = out.replace(rx, '[REDACTED]');
  return out;
}

// Export template apply: named combinations of model builder + options for
// repeatable export runs.
export const EXPORT_TEMPLATES = {
  'leadership-pdf': { kind: 'exec-summary', watermarked: true, letterhead: true },
  'engineering-pdf': { kind: 'deep-dive', watermarked: false, letterhead: true },
  'ticket-json': { kind: 'per-finding-json', evidenceFree: true },
  'siem-feed': { kind: 'siem-json', minSeverity: 'medium' },
  'ci-gate-sarif': { kind: 'sarif', minSeverity: 'high' },
};
export function applyExportTemplate(templateName) {
  const tpl = EXPORT_TEMPLATES[templateName];
  if (!tpl) return { ok: false, reason: `unknown template: ${templateName}` };
  return { ok: true, template: { name: templateName, ...tpl } };
}
