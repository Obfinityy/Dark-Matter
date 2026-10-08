/**
 * archiveNotifyCore.js — archive notifications & governance core (ideas 52561–52580).
 *
 * Pure logic for archive lifecycle notifications, approval workflows, archive
 * packaging, templates, scheduled sweeps, cross-archive search, analytics,
 * compliance mapping, redaction, sharing, duplicate detection, naming, folder
 * organization, API surface, webhooks, review reminders, restore requests,
 * and ownership transfer.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE65_AN_IDEAS = [
  { id: 52561, title: 'Archive notifications', skip: false },
  { id: 52562, title: 'Archive approval workflow', skip: false },
  { id: 52563, title: 'Archive associated files', skip: false },
  { id: 52564, title: 'Separate evidence archiving', skip: false },
  { id: 52565, title: 'Partial archive option', skip: false },
  { id: 52566, title: 'Archive templates', skip: false },
  { id: 52567, title: 'Scheduled archive sweeps', skip: false },
  { id: 52568, title: 'Cross-archive search', skip: false },
  { id: 52569, title: 'Archive analytics', skip: false },
  { id: 52570, title: 'Compliance retention mapping', skip: false },
  { id: 52571, title: 'Archive redaction option', skip: false },
  { id: 52572, title: 'Limited archive sharing', skip: false },
  { id: 52573, title: 'Duplicate-archive detection', skip: false },
  { id: 52574, title: 'Archive naming conventions', skip: false },
  { id: 52575, title: 'Archive folder structure', skip: false },
  { id: 52576, title: 'Archive API', skip: false },
  { id: 52577, title: 'Archive webhooks', skip: false },
  { id: 52578, title: 'Pre-archive review reminder', skip: false },
  { id: 52579, title: 'Archive restore request flow', skip: false },
  { id: 52580, title: 'Archive ownership transfer', skip: false },
];

/**
 * Build the notification plan for an archive event (idea 52561).
 * @param {object} archive - Archive record {id, target, ownerEmail}.
 * @param {string} event - 'pre-archive' | 'archived' | 'restored'.
 * @returns {object} Notification plan with recipients and message.
 */
export function planArchiveNotifications(archive, event) {
  const owners = [archive.ownerEmail].filter(Boolean);
  const messages = {
    'pre-archive': `Hunt "${archive.target}" will be auto-archived soon.`,
    archived: `Hunt "${archive.target}" has been archived.`,
    restored: `Archive for hunt "${archive.target}" has been restored.`,
  };
  return { event, recipients: owners, message: messages[event] || 'Archive event.', archiveId: archive.id };
}

/**
 * Check whether an archive needs lead approval (idea 52562).
 * @param {object} hunt - Hunt with findings array.
 * @returns {object} {needsApproval, reason}.
 */
export function checkArchiveApproval(hunt) {
  const openCritical = (hunt.findings || []).filter(
    f => f.severity === 'critical' && f.status !== 'fixed' && f.status !== 'verified'
  );
  if (openCritical.length > 0) {
    return { needsApproval: true, reason: `${openCritical.length} open Critical finding(s) require lead approval.` };
  }
  return { needsApproval: false, reason: 'No open Critical findings.' };
}

/**
 * List files included in an archive package (idea 52563).
 * @param {object} hunt - Hunt with pocBundles, exports, attachments.
 * @returns {string[]} File paths in the package.
 */
export function listArchiveFiles(hunt) {
  return [
    ...(hunt.pocBundles || []),
    ...(hunt.exports || []),
    ...(hunt.attachments || []),
    'report.pdf',
    'findings.json',
  ];
}

/**
 * Tier evidence blobs between hot and cold storage (idea 52564).
 * @param {object[]} blobs - Evidence blobs {id, sizeBytes, lastAccessedAt}.
 * @param {number} hotDays - Days of inactivity before tiering to cold.
 * @returns {object} {hot: [], cold: []} blob id lists.
 */
export function tierEvidenceBlobs(blobs, hotDays = 30) {
  const cutoff = Date.now() - hotDays * 86400000;
  const hot = [];
  const cold = [];
  for (const b of blobs) {
    if (new Date(b.lastAccessedAt).getTime() >= cutoff) hot.push(b.id);
    else cold.push(b.id);
  }
  return { hot, cold };
}

/**
 * Build a partial archive manifest (idea 52565).
 * @param {object} hunt - Hunt record.
 * @param {object} options - {includeFindings, includeReports, dropTrafficLogs}.
 * @returns {object} Manifest of included/excluded sections.
 */
export function buildPartialArchiveManifest(hunt, options = {}) {
  const { includeFindings = true, includeReports = true, dropTrafficLogs = true } = options;
  return {
    huntId: hunt.id,
    included: [
      ...(includeFindings ? ['findings.json'] : []),
      ...(includeReports ? ['report.pdf'] : []),
    ],
    excluded: [...(dropTrafficLogs ? ['traffic-logs/'] : [])],
  };
}

/**
 * Apply an archive template in one click (idea 52566).
 * @param {object} template - {name, include, retentionDays, tier}.
 * @param {object} hunt - Hunt to archive.
 * @returns {object} Resolved archive configuration.
 */
export function applyArchiveTemplate(template, hunt) {
  return {
    huntId: hunt.id,
    templateName: template.name,
    include: template.include || ['findings', 'reports'],
    retentionDays: template.retentionDays || 365,
    tier: template.tier || 'standard',
    appliedAt: new Date().toISOString(),
  };
}

/**
 * Plan a scheduled archive sweep (idea 52567).
 * @param {object[]} hunts - Candidate hunts.
 * @param {object} rules - Auto-archive rules {inactiveDays, maxOpenFindings}.
 * @returns {object} {toArchive: [], preview: string}.
 */
export function planArchiveSweep(hunts, rules = {}) {
  const { inactiveDays = 90, maxOpenFindings = 0 } = rules;
  const cutoff = Date.now() - inactiveDays * 86400000;
  const toArchive = hunts.filter(h => {
    const inactive = new Date(h.lastActivityAt).getTime() < cutoff;
    const openCount = (h.findings || []).filter(f => f.status === 'open').length;
    return inactive && openCount <= maxOpenFindings;
  });
  return {
    toArchive: toArchive.map(h => h.id),
    preview: `${toArchive.length} hunt(s) match auto-archive rules.`,
  };
}

/**
 * Search across archived hunts' findings (idea 52568).
 * @param {object[]} archives - Archives with findings arrays.
 * @param {string} query - Full-text query.
 * @returns {object[]} Matching findings with archive context.
 */
export function searchAcrossArchives(archives, query) {
  const q = query.toLowerCase();
  const results = [];
  for (const a of archives) {
    for (const f of a.findings || []) {
      const hay = `${f.title || ''} ${f.description || ''}`.toLowerCase();
      if (hay.includes(q)) results.push({ archiveId: a.id, target: a.target, finding: f });
    }
  }
  return results;
}

/**
 * Compute archive analytics (idea 52569).
 * @param {object[]} archives - Archive records with createdAt/restoredAt.
 * @returns {object} Volume, growth, and restore-frequency stats.
 */
export function computeArchiveAnalytics(archives) {
  const byMonth = {};
  let restores = 0;
  for (const a of archives) {
    const m = (a.createdAt || '').slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
    if (a.restoredAt) restores += 1;
  }
  return {
    totalArchives: archives.length,
    archivesByMonth: byMonth,
    restoreCount: restores,
    restoreRate: archives.length ? restores / archives.length : 0,
  };
}

/**
 * Map retention to a compliance requirement (idea 52570).
 * @param {string} framework - e.g. 'PCI-DSS', 'SOC2', 'GDPR'.
 * @returns {object} {framework, retentionDays, note}.
 */
export function complianceRetention(framework) {
  const map = {
    'PCI-DSS': { retentionDays: 365, note: '1-year log retention.' },
    SOC2: { retentionDays: 365, note: '1-year audit evidence retention.' },
    GDPR: { retentionDays: 2555, note: 'Up to 7 years where lawful basis exists.' },
    'ISO27001': { retentionDays: 1095, note: '3-year record retention.' },
  };
  return { framework, ...(map[framework] || { retentionDays: 365, note: 'Default 1-year retention.' }) };
}

/**
 * Redact secrets/PII from archive content (idea 52571).
 * @param {string} text - Archive text content.
 * @returns {object} {redacted, redactionCount}.
 */
export function redactForArchive(text) {
  let redactionCount = 0;
  const redacted = String(text)
    .replace(/sk-[a-zA-Z0-9]{16,}/g, m => { redactionCount++; return '[REDACTED-KEY]'; })
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, () => { redactionCount++; return '[REDACTED-PRIVATE-KEY]'; })
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, () => { redactionCount++; return '[REDACTED-EMAIL]'; });
  return { redacted, redactionCount };
}

/**
 * Build a limited share payload for an archived hunt (idea 52572).
 * @param {object} archive - Archive record.
 * @returns {object} Summary safe for external parties.
 */
export function buildLimitedArchiveShare(archive) {
  return {
    archiveId: archive.id,
    target: archive.target,
    summary: archive.summary || '',
    findingCounts: archive.findingCounts || {},
    archivedAt: archive.archivedAt,
    note: 'Summary only — full archive not restored.',
  };
}

/**
 * Detect duplicate archives (idea 52573).
 * @param {object} candidate - New archive {target, createdAt, findingHash}.
 * @param {object[]} existing - Existing archives.
 * @returns {object|null} Duplicate warning or null.
 */
export function detectDuplicateArchive(candidate, existing) {
  const dup = existing.find(
    a => a.target === candidate.target && a.findingHash === candidate.findingHash
  );
  return dup ? { duplicateOf: dup.id, warning: `Duplicates existing archive ${dup.id}.` } : null;
}

/**
 * Auto-name an archive (idea 52574).
 * @param {object} hunt - {target, id}.
 * @param {string} pattern - Naming pattern with {target}, {date}, {id}.
 * @returns {string} Archive name.
 */
export function autoNameArchive(hunt, pattern = '{target}-{date}-{id}') {
  const date = new Date().toISOString().slice(0, 10);
  return pattern
    .replace('{target}', String(hunt.target || 'hunt').replace(/[^a-z0-9]+/gi, '-').toLowerCase())
    .replace('{date}', date)
    .replace('{id}', String(hunt.id).slice(0, 8));
}

/**
 * Resolve an archive's folder path (idea 52575).
 * @param {object} archive - {client, target, createdAt}.
 * @param {string} scheme - 'client/year' | 'target/year' | 'year'.
 * @returns {string} Folder path.
 */
export function archiveFolderPath(archive, scheme = 'client/year') {
  const year = (archive.createdAt || '').slice(0, 4) || 'unknown';
  if (scheme === 'target/year') return `${archive.target || 'hunts'}/${year}`;
  if (scheme === 'year') return year;
  return `${archive.client || 'default'}/${year}`;
}

/**
 * Validate an archive API request (idea 52576).
 * @param {object} req - {action, archiveId, apiKey}.
 * @returns {object} {valid, error}.
 */
export function validateArchiveApiRequest(req) {
  const actions = ['archive', 'restore', 'search', 'purge'];
  if (!actions.includes(req.action)) return { valid: false, error: `Unknown action: ${req.action}.` };
  if (!req.apiKey) return { valid: false, error: 'API key required.' };
  if (['archive', 'restore', 'purge'].includes(req.action) && !req.archiveId) {
    return { valid: false, error: 'archiveId required.' };
  }
  return { valid: true, error: null };
}

/**
 * Build webhook payloads for archive events (idea 52577).
 * @param {string} event - 'archived' | 'restored' | 'purged'.
 * @param {object} archive - Archive record.
 * @returns {object} Webhook payload.
 */
export function buildArchiveWebhook(event, archive) {
  return {
    event: `archive.${event}`,
    archiveId: archive.id,
    target: archive.target,
    at: new Date().toISOString(),
  };
}

/**
 * Build a pre-archive review reminder (idea 52578).
 * @param {object} hunt - Hunt with open findings.
 * @param {string} scheduledAt - Planned auto-archive time.
 * @returns {object} Reminder details.
 */
export function preArchiveReviewReminder(hunt, scheduledAt) {
  const open = (hunt.findings || []).filter(f => f.status === 'open').length;
  return {
    huntId: hunt.id,
    scheduledAt,
    openFindings: open,
    message: `${open} open finding(s) — review before auto-archive at ${scheduledAt}.`,
  };
}

/**
 * Handle an archive restore request (idea 52579).
 * @param {object} request - {archiveId, requester, reason}.
 * @returns {object} Request ticket awaiting owner approval.
 */
export function requestArchiveRestore(request) {
  return {
    ticketId: `restore-${Date.now().toString(36)}`,
    archiveId: request.archiveId,
    requester: request.requester,
    reason: request.reason || '',
    status: 'pending-owner-approval',
    requestedAt: new Date().toISOString(),
  };
}

/**
 * Transfer archive ownership (idea 52580).
 * @param {object} archive - Archive record.
 * @param {string} newOwner - New owner email.
 * @param {string} reason - Transfer reason.
 * @returns {object} Updated archive ownership record.
 */
export function transferArchiveOwnership(archive, newOwner, reason = '') {
  return {
    archiveId: archive.id,
    previousOwner: archive.ownerEmail,
    newOwner,
    reason,
    transferredAt: new Date().toISOString(),
  };
}
