/**
 * archiveOpsCore.js — archive operations & email notifications core (ideas 52581–52600).
 *
 * Pure logic for archive migration, team stats, quota management, cleanup
 * suggestions, time-capsule summaries, linked-hunt preservation, transcript
 * and reasoning-trace archiving, report snapshots, restore testing, export
 * manifests, expiry warnings, search filters, re-indexing, and hunt
 * completion emails (auto, templated, executive, engineer, PDF-attached,
 * link-only).
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE65_AO_IDEAS = [
  { id: 52581, title: 'Archive migration tool', skip: false },
  { id: 52582, title: 'Per-team archive stats', skip: false },
  { id: 52583, title: 'Archive quota management', skip: false },
  { id: 52584, title: 'Archive cleanup suggestions', skip: false },
  { id: 52585, title: 'Archive "time capsule" summary', skip: false },
  { id: 52586, title: 'Linked-hunt preservation', skip: false },
  { id: 52587, title: 'Chat transcript archiving', skip: false },
  { id: 52588, title: 'Agent reasoning-trace archiving', skip: false },
  { id: 52589, title: 'Report snapshot in archive', skip: false },
  { id: 52590, title: 'Archive restore testing', skip: false },
  { id: 52591, title: 'Archive export manifest', skip: false },
  { id: 52592, title: 'Archive expiry warnings', skip: false },
  { id: 52593, title: 'Archive search filters', skip: false },
  { id: 52594, title: 'Archive restore with re-index', skip: false },
  { id: 52595, title: 'Auto email on hunt completion', skip: false },
  { id: 52596, title: 'Customizable email templates', skip: false },
  { id: 52597, title: 'Executive summary email', skip: false },
  { id: 52598, title: 'Engineer detail email', skip: false },
  { id: 52599, title: 'Email with PDF attached', skip: false },
  { id: 52600, title: 'Link-only email option', skip: false },
];

/**
 * Plan an archive migration between storage backends (idea 52581).
 * @param {object} archive - Archive record.
 * @param {string} fromBackend - Source backend name.
 * @param {string} toBackend - Destination backend name.
 * @returns {object} Migration plan with verification steps.
 */
export function planArchiveMigration(archive, fromBackend, toBackend) {
  return {
    archiveId: archive.id,
    from: fromBackend,
    to: toBackend,
    steps: ['copy', 'verify-checksums', 'switch-reads', 'delete-source'],
    verify: 'checksum-match-required',
  };
}

/**
 * Compute per-team archive stats (idea 52582).
 * @param {object[]} archives - Archives with team and sizeBytes.
 * @returns {object} Stats keyed by team.
 */
export function perTeamArchiveStats(archives) {
  const stats = {};
  for (const a of archives) {
    const t = a.team || 'unassigned';
    stats[t] = stats[t] || { count: 0, bytes: 0 };
    stats[t].count += 1;
    stats[t].bytes += a.sizeBytes || 0;
  }
  return stats;
}

/**
 * Check archive quota usage (idea 52583).
 * @param {object} usage - {usedBytes, quotaBytes, workspace}.
 * @returns {object} {percentUsed, status, action}.
 */
export function checkArchiveQuota(usage) {
  const percentUsed = usage.quotaBytes ? (usage.usedBytes / usage.quotaBytes) * 100 : 0;
  let status = 'ok';
  let action = null;
  if (percentUsed >= 95) { status = 'critical'; action = 'purge-or-expand'; }
  else if (percentUsed >= 80) { status = 'warning'; action = 'review-cleanup'; }
  return { workspace: usage.workspace, percentUsed: Math.round(percentUsed), status, action };
}

/**
 * Suggest archives safe to purge (idea 52584).
 * @param {object[]} archives - Archives with ageDays, isDuplicate, policy.
 * @returns {object[]} Purge suggestions with reasons.
 */
export function suggestArchiveCleanup(archives) {
  return archives
    .filter(a => (a.ageDays || 0) > 365 || a.isDuplicate || a.policyExpired)
    .map(a => ({
      archiveId: a.id,
      reasons: [
        ...(a.ageDays > 365 ? [`age ${a.ageDays}d`] : []),
        ...(a.isDuplicate ? ['duplicate'] : []),
        ...(a.policyExpired ? ['retention-expired'] : []),
      ],
    }));
}

/**
 * Write a time-capsule narrative summary (idea 52585).
 * @param {object} hunt - Hunt with target, findings, dates.
 * @returns {string} Narrative summary.
 */
export function writeTimeCapsuleSummary(hunt) {
  const findings = hunt.findings || [];
  const critical = findings.filter(f => f.severity === 'critical').length;
  return (
    `Hunt on ${hunt.target} ran ${hunt.startedAt || 'unknown'}–${hunt.finishedAt || 'unknown'}. ` +
    `${findings.length} findings (${critical} critical). ` +
    `What mattered: ${hunt.headline || 'see findings for details.'}`
  );
}

/**
 * Preserve linked-hunt references in an archive (idea 52586).
 * @param {object} archive - Archive record.
 * @param {object[]} links - [{type: 'regression'|'comparison', id}].
 * @returns {object} Archive with preserved links.
 */
export function preserveLinkedHunts(archive, links) {
  return { ...archive, linkedHunts: links.map(l => ({ type: l.type, id: l.id })) };
}

/**
 * Package chat transcripts for archiving (idea 52587).
 * @param {object[]} transcripts - [{role, text, at}].
 * @returns {object} Archived transcript bundle.
 */
export function archiveChatTranscripts(transcripts) {
  return {
    count: transcripts.length,
    messages: transcripts.map(t => ({ role: t.role, text: t.text, at: t.at })),
    archivedAt: new Date().toISOString(),
  };
}

/**
 * Package agent reasoning traces for archiving (idea 52588).
 * @param {object[]} traces - [{step, decision, rationale, at}].
 * @returns {object} Archived trace bundle.
 */
export function archiveReasoningTraces(traces) {
  return {
    count: traces.length,
    traces: traces.map(t => ({ step: t.step, decision: t.decision, rationale: t.rationale, at: t.at })),
    archivedAt: new Date().toISOString(),
  };
}

/**
 * Snapshot the report at archive time (idea 52589).
 * @param {object} report - {pdfUrl, generatedAt, hash}.
 * @returns {object} Immutable snapshot record.
 */
export function snapshotReport(report) {
  return {
    pdfUrl: report.pdfUrl,
    generatedAt: report.generatedAt,
    hash: report.hash,
    snapshotAt: new Date().toISOString(),
    immutable: true,
  };
}

/**
 * Schedule an archive restore test (idea 52590).
 * @param {object} archive - Archive record.
 * @returns {object} Test plan.
 */
export function scheduleRestoreTest(archive) {
  return {
    archiveId: archive.id,
    testId: `restore-test-${Date.now().toString(36)}`,
    steps: ['restore-to-sandbox', 'verify-checksums', 'spot-check-findings', 'teardown'],
    scheduledAt: new Date().toISOString(),
  };
}

/**
 * Build an export manifest with hashes (idea 52591).
 * @param {object[]} files - [{path, hash, bytes}].
 * @returns {object} Manifest for chain-of-custody.
 */
export function buildExportManifest(files) {
  return {
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    totalBytes: files.reduce((n, f) => n + (f.bytes || 0), 0),
    files: files.map(f => ({ path: f.path, hash: f.hash, bytes: f.bytes })),
  };
}

/**
 * Compute archive expiry warnings (idea 52592).
 * @param {object} archive - {retentionExpiresAt}.
 * @returns {object[]} Warnings due at 30/7/1 days.
 */
export function archiveExpiryWarnings(archive) {
  const expiry = new Date(archive.retentionExpiresAt).getTime();
  const now = Date.now();
  const daysLeft = Math.ceil((expiry - now) / 86400000);
  const warnings = [];
  for (const d of [30, 7, 1]) {
    if (daysLeft <= d && daysLeft > 0) {
      warnings.push({ daysLeft, message: `Archive expires in ${daysLeft} day(s) — purge scheduled.` });
    }
  }
  return warnings;
}

/**
 * Filter archives by criteria (idea 52593).
 * @param {object[]} archives - Archive records.
 * @param {object} filters - {from, to, target, severity, tags}.
 * @returns {object[]} Matching archives.
 */
export function filterArchives(archives, filters = {}) {
  return archives.filter(a => {
    if (filters.from && (a.createdAt || '') < filters.from) return false;
    if (filters.to && (a.createdAt || '') > filters.to) return false;
    if (filters.target && !(a.target || '').includes(filters.target)) return false;
    if (filters.severity && (a.topSeverity || '') !== filters.severity) return false;
    if (filters.tags && !(filters.tags.every(t => (a.tags || []).includes(t)))) return false;
    return true;
  });
}

/**
 * Plan re-indexing after a restore (idea 52594).
 * @param {object} archive - Restored archive.
 * @returns {object} Re-index plan.
 */
export function planRestoreReindex(archive) {
  return {
    archiveId: archive.id,
    indexes: ['search', 'diff', 'analytics'],
    status: 'scheduled',
  };
}

/**
 * Build the auto email on hunt completion (idea 52595).
 * @param {object} hunt - Finished hunt.
 * @param {string[]} recipients - Stakeholder emails.
 * @returns {object} Email draft.
 */
export function buildHuntCompletionEmail(hunt, recipients) {
  const findings = hunt.findings || [];
  return {
    to: recipients,
    subject: `Hunt complete: ${hunt.target} — ${findings.length} findings`,
    body: `The hunt on ${hunt.target} finished with ${findings.length} findings.`,
    huntId: hunt.id,
  };
}

/**
 * Render an email template with variables (idea 52596).
 * @param {string} template - HTML with {{variables}}.
 * @param {object} vars - Variable values.
 * @returns {string} Rendered HTML.
 */
export function renderEmailTemplate(template, vars) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/**
 * Build an executive summary email (idea 52597).
 * @param {object} hunt - Finished hunt.
 * @returns {object} Jargon-free email draft.
 */
export function buildExecSummaryEmail(hunt) {
  const findings = hunt.findings || [];
  const critical = findings.filter(f => f.severity === 'critical').length;
  return {
    subject: `Executive summary: ${hunt.target}`,
    body:
      `Risk score: ${hunt.riskScore ?? 'n/a'}. Critical findings: ${critical}. ` +
      `Decision needed: ${critical > 0 ? 'review critical findings' : 'none'}.`,
  };
}

/**
 * Build an engineer detail email (idea 52598).
 * @param {object} hunt - Finished hunt.
 * @returns {object} Technical email draft.
 */
export function buildEngineerDetailEmail(hunt) {
  const top = (hunt.findings || []).slice(0, 5);
  return {
    subject: `Technical details: ${hunt.target}`,
    body: top.map(f => `- ${f.title} (${f.severity}) — ${f.evidenceUrl || 'see report'}`).join('\n'),
  };
}

/**
 * Attach the right PDF to a summary email (idea 52599).
 * @param {object} email - Email draft.
 * @param {string} audience - 'exec' | 'engineer'.
 * @param {object} pdfs - {exec: url, technical: url}.
 * @returns {object} Email with attachment.
 */
export function attachPdfToEmail(email, audience, pdfs) {
  const url = audience === 'exec' ? pdfs.exec : pdfs.technical;
  return { ...email, attachments: [{ filename: `${audience}-summary.pdf`, url }] };
}

/**
 * Build a link-only email for sensitive hunts (idea 52600).
 * @param {object} hunt - Finished hunt.
 * @param {string} secureLink - Time-limited secure URL.
 * @returns {object} Minimal email draft.
 */
export function buildLinkOnlyEmail(hunt, secureLink) {
  return {
    subject: `Hunt summary available: ${hunt.target}`,
    body: `A summary is available at this secure link (expires in 24h): ${secureLink}`,
    containsDetails: false,
  };
}
