/**
 * snapshotPublishCore.js — wave 42 (ideas 51661–51680): snapshot publishing +
 * live confidence.
 *
 * Pure logic for taking snapshots further: persistent custom sections, JSON/CSV
 * export, cryptographic integrity seals (caller-supplied digest so the module
 * stays dependency-free), real-time collaborative notes, notification rules,
 * an archive browser, draft restore, plain-language diff summaries, KPI panels,
 * risk overviews, remediation previews, compliance mapping, a client portal
 * view, stakeholder feedback, one-click promotion to the final report — plus
 * the live confidence suite: 0–100 per-finding confidence, trend arrows,
 * evidence-strength meters, validation-stage labels, and score breakdowns.
 *
 * Pure functions only: no network, no DOM, no clock reads. Deterministic.
 */

import { escHtml, clamp, severityDistribution, SEVERITIES } from './snapshotDistribCore.js';

export { escHtml };

export const WAVE42_PUB_START = 51661;
export const WAVE42_PUB_END = 51680;

export const WAVE42_PUB_IDEAS = [
  [51661, 'snapshot custom sections', 'Add your own sections that persist across snapshots'],
  [51662, 'snapshot data export', 'Raw snapshot data as JSON/CSV for your own tooling'],
  [51663, 'snapshot integrity seal', "Cryptographic seal proving a snapshot hasn't been altered"],
  [51664, 'snapshot collaboration', 'Teammates co-edit snapshot notes in real time'],
  [51665, 'snapshot notification rules', 'Control who gets told about each new snapshot'],
  [51666, 'snapshot archive browser', 'Browse every snapshot from every hunt in one place'],
  [51667, 'snapshot restore', "Revert the draft report to an earlier snapshot's state"],
  [51668, 'snapshot diff summary', 'Plain-language "what changed" for each new snapshot'],
  [51669, 'snapshot KPI panel', 'Key metrics (findings, coverage, time) atop every snapshot'],
  [51670, 'snapshot risk overview', 'Overall risk posture summarized visually per snapshot'],
  [51671, 'snapshot remediation preview', 'Upcoming fix guidance included even mid-hunt'],
  [51672, 'snapshot compliance mapping', 'Findings mapped to frameworks live in the snapshot'],
  [
    51673,
    'snapshot client portal',
    'Clients view snapshots in a branded portal without seeing internals',
  ],
  [51674, 'snapshot feedback collection', 'Stakeholders rate snapshot usefulness per section'],
  [51675, 'final-from-snapshot', 'Promote any snapshot to the final report with one click'],
  [
    51676,
    'live confidence score',
    'Every finding shows a 0–100 confidence that updates as evidence grows',
  ],
  [51677, 'confidence trend arrow', 'Rising, falling, or stable indicators beside each score'],
  [51678, 'evidence-strength meter', 'Visual gauge of how much proof backs the finding'],
  [
    51679,
    'validation-stage labels',
    'Detected, reproducing, validated, confirmed stages shown live',
  ],
  [51680, 'confidence breakdown', 'Expand a score to see which evidence contributed how much'],
];

/* --- 51661 snapshot custom sections ------------------------------------------------- */

export function addCustomSection(store, { title, body, author }) {
  if (!String(title ?? '').trim()) throw new Error('section title required');
  const sections = [...(store?.customSections || [])];
  const existing = sections.findIndex(s => s.title === title);
  const entry = {
    title: String(title).trim(),
    body: String(body || ''),
    author: author || 'owner',
    updatedAt: store?.now || 'unscheduled',
  };
  if (existing >= 0) sections[existing] = entry;
  else sections.push(entry);
  return { ...(store || {}), customSections: sections };
}

export function customSections(store) {
  return [...(store?.customSections || [])];
}

export function sectionsForSnapshot(snapshot, store) {
  return [
    ...(snapshot?.sections || []),
    ...customSections(store).map(s => ({ ...s, custom: true })),
  ];
}

/* --- 51662 snapshot data export ------------------------------------------------------ */

export function snapshotToJson(snapshot) {
  return JSON.stringify(snapshot, null, 2);
}

const CSV_COLS = ['id', 'title', 'severity', 'confidence', 'asset', 'technique'];

export function findingsToCsv(findings) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = (findings || []).map(f => CSV_COLS.map(c => q(f[c])).join(','));
  return [CSV_COLS.join(','), ...rows].join('\n');
}

/* --- 51663 snapshot integrity seal ----------------------------------------------------- */

export function sealSnapshot(snapshot, digestHex, sealedAt) {
  if (typeof digestHex !== 'function') throw new Error('digestHex function required');
  const canonical = JSON.stringify(stripSeal(snapshot));
  const digest = digestHex(canonical);
  return {
    algorithm: 'sha256',
    digest,
    sealedAt: sealedAt || 'unscheduled',
    version: snapshot?.version || 1,
  };
}

export function stripSeal(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const { seal, ...rest } = snapshot;
  return rest;
}

export function verifySnapshotSeal(snapshot, seal, digestHex) {
  if (!seal || typeof digestHex !== 'function') return false;
  const canonical = JSON.stringify(stripSeal(snapshot));
  return digestHex(canonical) === seal.digest;
}

/* --- 51664 snapshot collaboration -------------------------------------------------------- */

export function createCollabDoc() {
  return { notes: {}, ops: [], presence: [] };
}

export function applyCollabEdit(doc, { author, noteId, text, at }) {
  if (!noteId) throw new Error('noteId required');
  const op = {
    author: author || 'anonymous',
    noteId,
    text: String(text || ''),
    at: at || 'unscheduled',
  };
  const notes = { ...(doc?.notes || {}), [noteId]: op };
  return { notes, ops: [...(doc?.ops || []), op], presence: doc?.presence || [] };
}

export function collabNotes(doc) {
  return Object.entries(doc?.notes || {}).map(([noteId, op]) => ({ noteId, ...op }));
}

export function collabPresence(doc, author, at) {
  const presence = (doc?.presence || []).filter(p => p.author !== author);
  return { ...(doc || {}), presence: [...presence, { author, at: at || 'unscheduled' }] };
}

/* --- 51665 snapshot notification rules ----------------------------------------------------- */

export const SNAPSHOT_CHANNELS = ['email', 'slack', 'webhook'];

export function defaultSnapshotRules() {
  return [
    { on: 'significant', channel: 'slack', to: 'hunt-channel' },
    { on: 'significant', channel: 'email', to: 'stakeholders' },
    { on: 'info', channel: 'email', to: 'owner' },
  ];
}

export function notificationTargets(rules, alertLevel) {
  return (rules || [])
    .filter(r => r.on === alertLevel)
    .map(r => ({ channel: r.channel, to: r.to }));
}

/* --- 51666 snapshot archive browser ---------------------------------------------------------- */

export function buildSnapshotArchive(snapshots) {
  const byHunt = {};
  for (const s of snapshots || []) {
    const hunt = s.huntId || 'unknown';
    if (!byHunt[hunt]) byHunt[hunt] = [];
    byHunt[hunt].push(s);
  }
  for (const hunt of Object.keys(byHunt))
    byHunt[hunt].sort((a, b) => (b.version || 0) - (a.version || 0));
  return { byHunt, hunts: Object.keys(byHunt).sort(), total: (snapshots || []).length };
}

export function searchSnapshotArchive(archive, q) {
  const needle = String(q || '').toLowerCase();
  if (!needle) return [];
  const hits = [];
  for (const hunt of archive.hunts) {
    for (const s of archive.byHunt[hunt]) {
      const hay = `${s.target || ''} v${s.version || 0} ${hunt}`.toLowerCase();
      if (hay.includes(needle)) hits.push(s);
    }
  }
  return hits;
}

/* --- 51667 snapshot restore ---------------------------------------------------------------------- */

export function restoreDraftFromSnapshot(draft, snapshot, restoredAt) {
  if (!snapshot) throw new Error('snapshot required');
  return {
    ...(draft || {}),
    sections: JSON.parse(JSON.stringify(snapshot.sections || [])),
    findings: JSON.parse(JSON.stringify(snapshot.findings || [])),
    restoredFrom: { snapshotId: snapshot.id, version: snapshot.version },
    restoredAt: restoredAt || 'unscheduled',
  };
}

/* --- 51668 snapshot diff summary (plain language) ------------------------------------------------------ */

export function plainDiffSummary(prev, next) {
  const added = (next?.findings || []).filter(
    f => !(prev?.findings || []).some(p => p.id === f.id)
  );
  const removed = (prev?.findings || []).filter(
    p => !(next?.findings || []).some(f => f.id === p.id)
  );
  const changed = (next?.findings || []).filter(f => {
    const p = (prev?.findings || []).find(x => x.id === f.id);
    return p && p.severity !== f.severity;
  });
  const lines = [];
  if (added.length)
    lines.push(
      `${added.length} new finding${added.length > 1 ? 's' : ''}: ${added
        .slice(0, 3)
        .map(f => f.title)
        .join('; ')}${added.length > 3 ? ` and ${added.length - 3} more` : ''}.`
    );
  if (removed.length)
    lines.push(`${removed.length} finding${removed.length > 1 ? 's' : ''} resolved or removed.`);
  if (changed.length)
    lines.push(`${changed.length} finding${changed.length > 1 ? 's' : ''} changed severity.`);
  if (!lines.length) lines.push('No material changes since the previous snapshot.');
  return lines;
}

/* --- 51669 snapshot KPI panel ------------------------------------------------------------------------------ */

export function snapshotKpis(snapshot) {
  const findings = snapshot?.findings || [];
  const dist = severityDistribution(findings);
  const elapsedMin = snapshot?.elapsedMin ?? 0;
  const coveragePct = clamp(snapshot?.coveragePct ?? 0, 0, 100);
  return {
    findings: findings.length,
    critical: dist.critical,
    high: dist.high,
    coveragePct,
    elapsedMin,
    resolved: snapshot?.resolvedCount ?? 0,
    perHour: elapsedMin > 0 ? Math.round((findings.length / elapsedMin) * 60 * 10) / 10 : 0,
  };
}

/* --- 51670 snapshot risk overview ---------------------------------------------------------------------------------- */

const SEV_WEIGHT = { critical: 10, high: 6, medium: 3, low: 1, info: 0 };

export function snapshotRiskOverview(findings) {
  const list = findings || [];
  let score = 0;
  for (const f of list) score += SEV_WEIGHT[String(f.severity || 'info').toLowerCase()] ?? 0;
  const level = score >= 40 ? 'critical' : score >= 20 ? 'high' : score >= 8 ? 'medium' : 'low';
  const drivers = [...list]
    .sort(
      (a, b) =>
        (SEV_WEIGHT[String(b.severity || 'info').toLowerCase()] ?? 0) -
        (SEV_WEIGHT[String(a.severity || 'info').toLowerCase()] ?? 0)
    )
    .slice(0, 3)
    .map(f => ({ id: f.id, title: f.title, severity: f.severity }));
  return { level, score, drivers, total: list.length };
}

/* --- 51671 snapshot remediation preview ------------------------------------------------------------------------------------ */

export const REMEDIATION_GUIDANCE = {
  xss: {
    guidance: 'Encode output per context; deploy a strict Content-Security-Policy.',
    effort: 'medium',
  },
  sqli: {
    guidance: 'Use parameterized queries everywhere; retire string-built SQL.',
    effort: 'medium',
  },
  ssrf: { guidance: 'Allowlist outbound destinations; block link-local ranges.', effort: 'medium' },
  idor: {
    guidance: 'Enforce server-side ownership checks on every object reference.',
    effort: 'low',
  },
  csrf: { guidance: 'Add per-session CSRF tokens to state-changing requests.', effort: 'low' },
  rce: {
    guidance: 'Remove dynamic code execution paths; sandbox the affected service now.',
    effort: 'high',
  },
  auth: {
    guidance: 'Harden session handling; rotate exposed secrets immediately.',
    effort: 'medium',
  },
};

export function remediationPreview(findings) {
  return (findings || []).map(f => {
    const key = String(f.type || '').toLowerCase();
    const g = REMEDIATION_GUIDANCE[key] || {
      guidance: 'Triage with the security team; validate before rolling out a fix.',
      effort: 'unknown',
    };
    return { findingId: f.id, title: f.title, guidance: g.guidance, effort: g.effort };
  });
}

/* --- 51672 snapshot compliance mapping ------------------------------------------------------------------------------------------ */

export const COMPLIANCE_MAP = {
  xss: [
    { framework: 'OWASP', ref: 'A03:2021 Injection' },
    { framework: 'CWE', ref: 'CWE-79' },
  ],
  sqli: [
    { framework: 'OWASP', ref: 'A03:2021 Injection' },
    { framework: 'CWE', ref: 'CWE-89' },
  ],
  ssrf: [
    { framework: 'OWASP', ref: 'A10:2021 SSRF' },
    { framework: 'CWE', ref: 'CWE-918' },
  ],
  idor: [
    { framework: 'OWASP', ref: 'A01:2021 Broken Access Control' },
    { framework: 'CWE', ref: 'CWE-639' },
  ],
  csrf: [
    { framework: 'OWASP', ref: 'A01:2021 Broken Access Control' },
    { framework: 'CWE', ref: 'CWE-352' },
  ],
  rce: [
    { framework: 'OWASP', ref: 'A03:2021 Injection' },
    { framework: 'CWE', ref: 'CWE-94' },
  ],
  auth: [
    { framework: 'OWASP', ref: 'A07:2021 Auth Failures' },
    { framework: 'CWE', ref: 'CWE-287' },
  ],
};

export function complianceMapping(findings) {
  const byFramework = {};
  for (const f of findings || []) {
    const refs = COMPLIANCE_MAP[String(f.type || '').toLowerCase()] || [];
    for (const r of refs) {
      if (!byFramework[r.framework]) byFramework[r.framework] = {};
      if (!byFramework[r.framework][r.ref]) byFramework[r.framework][r.ref] = [];
      byFramework[r.framework][r.ref].push(f.id);
    }
  }
  return byFramework;
}

/* --- 51673 snapshot client portal ------------------------------------------------------------------------------------- */

const PORTAL_HIDDEN = new Set([
  'internalNotes',
  'toolOutput',
  'rawRequest',
  'operatorName',
  'technique',
]);

export function clientPortalView(snapshot, { brand = 'Infinity AI', accent = '#6d5cff' } = {}) {
  const findings = (snapshot?.findings || []).map(f => {
    const clean = {};
    for (const [k, v] of Object.entries(f)) if (!PORTAL_HIDDEN.has(k)) clean[k] = v;
    return clean;
  });
  return {
    brand,
    accent,
    title: `Security snapshot — ${snapshot?.target || 'your assets'}`,
    version: snapshot?.version || 1,
    takenAt: snapshot?.takenAt || 'unscheduled',
    kpis: {
      findings: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
    },
    findings: findings.map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      summary: f.summary || '',
    })),
    note: 'Prepared for client review. Internal tooling detail withheld.',
  };
}

/* --- 51674 snapshot feedback collection ------------------------------------------------------------------------------------ */

export function recordSnapshotFeedback(store, { snapshotId, section, rating, note }) {
  if (!snapshotId || !section) throw new Error('snapshotId and section required');
  const r = clamp(rating, 1, 5);
  const entries = [...(store?.entries || []), { snapshotId, section, rating: r, note: note || '' }];
  return { ...(store || {}), entries };
}

export function feedbackSummary(store, snapshotId) {
  const entries = (store?.entries || []).filter(e => e.snapshotId === snapshotId);
  const bySection = {};
  for (const e of entries) {
    if (!bySection[e.section]) bySection[e.section] = [];
    bySection[e.section].push(e.rating);
  }
  const avgBySection = {};
  for (const [sec, ratings] of Object.entries(bySection)) {
    avgBySection[sec] = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  }
  return { count: entries.length, avgBySection };
}

/* --- 51675 final-from-snapshot ---------------------------------------------------------------------------------------------- */

export function promoteSnapshotToFinal(snapshot, { reportId, promotedAt } = {}) {
  if (!snapshot) throw new Error('snapshot required');
  return {
    reportId: reportId || `final-${snapshot.id || 'snapshot'}`,
    promotedFrom: { snapshotId: snapshot.id, version: snapshot.version },
    title: `Final report — ${snapshot.target || 'hunt'}`,
    sections: JSON.parse(JSON.stringify(snapshot.sections || [])),
    findings: JSON.parse(JSON.stringify(snapshot.findings || [])),
    status: 'draft-final',
    promotedAt: promotedAt || 'unscheduled',
  };
}

/* --- 51676 live confidence score ----------------------------------------------------------------------------------------------- */

const EVIDENCE_WEIGHTS = { poc: 35, screenshot: 15, log: 12, response: 10, header: 6, note: 4 };

export function evidencePoints(evidence) {
  let pts = 0;
  for (const e of evidence || []) pts += EVIDENCE_WEIGHTS[String(e.kind || '').toLowerCase()] ?? 3;
  return pts;
}

export function confidenceScore(finding) {
  if (!finding) return 0;
  const base = 20;
  const total = base + evidencePoints(finding.evidence);
  return clamp(total, 0, 100);
}

export function addEvidence(finding, ev) {
  const evidence = [...(finding?.evidence || []), ev];
  const updated = { ...(finding || {}), evidence };
  const score = confidenceScore(updated);
  updated.confidence = score;
  updated.confidenceHistory = [...(finding?.confidenceHistory || []), score];
  return updated;
}

/* --- 51677 confidence trend arrow -------------------------------------------------------------------------------------------------- */

export function confidenceTrend(history) {
  const h = (history || []).filter(v => Number.isFinite(v));
  if (h.length < 2) return 'stable';
  const delta = h[h.length - 1] - h[0];
  if (delta >= 5) return 'rising';
  if (delta <= -5) return 'falling';
  return 'stable';
}

export const TREND_GLYPH = { rising: '▲', falling: '▼', stable: '●' };

/* --- 51678 evidence-strength meter --------------------------------------------------------------------------------------------------- */

export function evidenceStrengthMeter(evidence) {
  const kinds = new Set((evidence || []).map(e => String(e.kind || '').toLowerCase()));
  const score = clamp(evidencePoints(evidence), 0, 100);
  const band = score >= 60 ? 'strong' : score >= 25 ? 'moderate' : 'weak';
  return { score, band, kinds: [...kinds], count: (evidence || []).length };
}

/* --- 51679 validation-stage labels ------------------------------------------------------------------------------------------------------- */

export const VALIDATION_STAGES = ['detected', 'reproducing', 'validated', 'confirmed'];

export function validationStage(finding) {
  const s = String(finding?.validationStage || 'detected').toLowerCase();
  return VALIDATION_STAGES.includes(s) ? s : 'detected';
}

export function advanceValidationStage(finding) {
  const idx = VALIDATION_STAGES.indexOf(validationStage(finding));
  const next = VALIDATION_STAGES[Math.min(idx + 1, VALIDATION_STAGES.length - 1)];
  return { ...(finding || {}), validationStage: next };
}

export function stageIndex(finding) {
  return VALIDATION_STAGES.indexOf(validationStage(finding));
}

/* --- 51680 confidence breakdown ---------------------------------------------------------------------------------------------------------------- */

export function confidenceBreakdown(finding) {
  const base = 20;
  const parts = [{ source: 'base', label: 'Initial detection', points: base }];
  for (const e of finding?.evidence || []) {
    const pts = EVIDENCE_WEIGHTS[String(e.kind || '').toLowerCase()] ?? 3;
    parts.push({
      source: e.kind || 'unknown',
      label: e.label || String(e.kind || 'evidence'),
      points: pts,
    });
  }
  const raw = parts.reduce((a, p) => a + p.points, 0);
  const total = clamp(raw, 0, 100);
  const scale = raw > 100 ? 100 / raw : 1;
  const scaled = parts.map(p => ({ ...p, points: Math.round(p.points * scale * 10) / 10 }));
  return { total, parts: scaled, capped: raw > 100 };
}
