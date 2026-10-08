/**
 * wave71BCores.js — bulk actions round 3 and post-hunt Q&A
 * (ideas 52821–52840).
 *
 * Pure logic for fix-version tagging, commit linking, closing and
 * reopening with reasons, assignee notification, PoC bundle and CVE
 * request drafting, SLA recalculation, decision-history export,
 * finding splits by asset, and the post-hunt question suite: severity
 * explanations from risk fields, exploit-chain walkthroughs, failed
 * attempt and coverage accounting, confidence interrogation, blast
 * radius estimation, fix follow-ups, cross-hunt comparison, and
 * submission-ready bounty writeups. Every helper takes explicit
 * inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE71_B_IDEAS = [
  { id: 52821, title: 'Bulk fix-version tagging', skip: false },
  { id: 52822, title: 'Bulk commit linking', skip: false },
  { id: 52823, title: 'Bulk close with reason', skip: false },
  { id: 52824, title: 'Bulk reopen with reason', skip: false },
  { id: 52825, title: 'Bulk assignee notification', skip: false },
  { id: 52826, title: 'Bulk PoC bundle generation', skip: false },
  { id: 52827, title: 'Bulk CVE-request drafts', skip: false },
  { id: 52828, title: 'Bulk SLA recalculation', skip: false },
  { id: 52829, title: 'Bulk export of decision history', skip: false },
  { id: 52830, title: 'Bulk finding split by asset', skip: false },
  { id: 52831, title: 'Post-hunt Q&A chat', skip: false },
  { id: 52832, title: '"Why is this critical?" explainer', skip: false },
  { id: 52833, title: 'Exploit-chain walkthrough', skip: false },
  { id: 52834, title: '"What did you try that failed?"', skip: false },
  { id: 52835, title: 'Coverage-gap Q&A', skip: false },
  { id: 52836, title: 'Per-finding confidence interrogation', skip: false },
  { id: 52837, title: 'Blast-radius estimator Q&A', skip: false },
  { id: 52838, title: 'Fix-suggestion follow-ups', skip: false },
  { id: 52839, title: 'Cross-hunt comparison questions', skip: false },
  { id: 52840, title: 'Bounty-writeup drafting', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const SEVERITY_LADDER = ['info', 'low', 'medium', 'high', 'critical'];
const TERMINAL_STATES = ['closed', 'dismissed', 'duplicate'];
const SLA_DEFAULT_HOURS = { critical: 24, high: 72, medium: 168, low: 720, info: 1440 };
const DEFAULT_COVERAGE_CHECKLIST = ['authentication', 'authorization', 'input-validation', 'session-management', 'api-security', 'file-upload', 'business-logic', 'security-configuration'];
const CWE_FIX_GUIDANCE = {
  'cwe-89': { weakness: 'SQL injection', fix: 'Use parameterized queries or a safe query builder for every database call; never concatenate input into SQL.', verification: 'Replay the original payloads and confirm no error-based or time-based behaviour remains.' },
  'cwe-79': { weakness: 'Cross-site scripting', fix: 'Encode output by context (HTML, attribute, JavaScript, URL) and add a strict content security policy.', verification: 'Replay stored and reflected payloads and confirm they render as inert text.' },
  'cwe-862': { weakness: 'Missing authorization', fix: 'Enforce server-side authorization checks on every protected object and action.', verification: 'Repeat the requests with a low-privilege account and confirm access is denied.' },
  'cwe-863': { weakness: 'Incorrect authorization', fix: 'Centralize authorization decisions and test every role against every protected route.', verification: 'Run the role matrix again and confirm only intended roles succeed.' },
  'cwe-352': { weakness: 'Cross-site request forgery', fix: 'Require unpredictable anti-CSRF tokens on state-changing requests and verify origin headers.', verification: 'Submit the forged request again and confirm it is rejected.' },
  'cwe-22': { weakness: 'Path traversal', fix: 'Canonicalize paths and enforce an allow-list of files or directories that may be served.', verification: 'Replay traversal sequences and confirm they cannot escape the allowed root.' },
  'cwe-918': { weakness: 'Server-side request forgery', fix: 'Allow-list outbound destinations, block private address ranges, and disable redirect following to internal hosts.', verification: 'Repeat the internal-address requests and confirm they are blocked.' },
};
const GENERIC_FIX = { weakness: 'Security weakness', fix: 'Identify the root cause in code, apply the smallest correct fix, and add a regression test for the reported behaviour.', verification: 'Replay the original proof of concept and confirm the behaviour is gone.' };

function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}

function sevKey(f) {
  return String((f && f.severity) || 'info').toLowerCase();
}

function stateOf(f) {
  return String((f && (f.status || f.state)) || 'new').toLowerCase().trim();
}

function normState(s) {
  return String(s || '').toLowerCase().trim();
}

function shortHash(text) {
  let hash = 0;
  const raw = String(text);
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function parseMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isNaN(ms) ? null : ms;
}

function normTags(list) {
  return [...new Set((list || []).map(t => String(t).toLowerCase().trim()).filter(Boolean))];
}

function withHistory(finding, from, to, actor, at, reason) {
  const entry = { from, to, actor: actor || 'system', at: at || null, reason: reason || '' };
  return { ...finding, status: to, state: to, stateEnteredAt: at || finding.stateEnteredAt || null, history: [...((finding && finding.history) || []), entry] };
}

function cweKey(f) {
  const raw = String((f && (f.cwe || f.cweId)) || '').toLowerCase();
  const match = raw.match(/cwe-\d+/);
  return match ? match[0] : raw;
}

function riskOf(f) {
  const n = Number((f && (f.riskScore ?? (f.cvss && f.cvss.score != null ? f.cvss.score * 10 : NaN))));
  return Number.isFinite(n) ? n : severityRank(sevKey(f)) * 25;
}

/**
 * Tag a selection with the release that fixes it (idea 52821).
 * The version is validated and normalized, then stored both as a
 * dedicated field and as a fix tag so release notes can group by it.
 * @param {Array} findings - Findings fixed in one release.
 * @param {string} version - Fix version, with or without a v prefix.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { ok, updated, taggedIds, version, error }.
 */
export function bulkTagFixVersion(findings = [], version = '', options = {}) {
  const raw = String(version || '').trim();
  if (!/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(raw)) {
    return { ok: false, updated: [], taggedIds: [], version: null, error: `fix version "${raw}" is not a valid release version` };
  }
  const normalized = raw.startsWith('v') ? raw : `v${raw}`;
  const tag = `fix:${normalized}`;
  const updated = (findings || []).map(f => ({
    ...f,
    fixVersion: normalized,
    tags: [...new Set([...normTags(f.tags), tag])],
    fixVersionTaggedBy: options.actor || 'system',
    fixVersionTaggedAt: options.at || null,
  }));
  return { ok: true, updated, taggedIds: updated.map(f => f.id), version: normalized, error: null };
}

/**
 * Link commits to a selection (idea 52822).
 * One shared commit links everywhere, a per-finding map links each
 * finding to its own fix, and malformed hashes are reported instead
 * of being stored.
 * @param {Array} findings - Findings receiving commit links.
 * @param {string|object|Array} commitSpec - Shared sha, id map, or sha list.
 * @param {object} [options] - { actor, at, repoBaseUrl }.
 * @returns {object} { updated, linkedIds, invalid, count }.
 */
export function bulkLinkCommits(findings = [], commitSpec = null, options = {}) {
  const base = String(options.repoBaseUrl || 'https://code.example.com/repo/commit').replace(/\/$/, '');
  const invalid = [];
  const linkedIds = [];
  const updated = (findings || []).map((f, i) => {
    let shas = [];
    if (typeof commitSpec === 'string' && commitSpec) shas = [commitSpec];
    else if (Array.isArray(commitSpec)) shas = i === 0 ? commitSpec : [];
    else if (commitSpec && typeof commitSpec === 'object') {
      const v = commitSpec[f.id];
      shas = Array.isArray(v) ? v : (v ? [v] : []);
    }
    const existing = [...((f.commits) || [])];
    for (const shaRaw of shas) {
      const sha = String(shaRaw).toLowerCase();
      if (!/^[0-9a-f]{7,40}$/.test(sha)) { invalid.push({ id: f.id, sha: String(shaRaw), reason: 'not a valid commit hash' }); continue; }
      if (!existing.some(c => String(c.sha) === sha)) {
        existing.push({ sha, url: `${base}/${sha}`, linkedBy: options.actor || 'system', at: options.at || null });
      }
    }
    if (existing.length > ((f.commits) || []).length) linkedIds.push(f.id);
    return { ...f, commits: existing };
  });
  return { updated, linkedIds, invalid, count: linkedIds.length };
}

/**
 * Close a selection under one documented reason (idea 52823).
 * Only findings that reached a closable state move to Closed; the
 * shared reason and reason code are recorded on every closure.
 * @param {Array} findings - Findings to close.
 * @param {object} [options] - { reason, reasonCode, actor, at }.
 * @returns {object} { ok, closed, closedIds, blocked, error }.
 */
export function bulkCloseWithReason(findings = [], options = {}) {
  const reason = String(options.reason || '').trim();
  if (reason.length < 3) return { ok: false, closed: [], closedIds: [], blocked: [], error: 'bulk close requires one documented reason' };
  const closable = ['verified', 'confirmed', 'fixing', 'verifying', 'assigned', 'triaged'];
  const closed = [];
  const blocked = [];
  for (const f of findings || []) {
    const state = stateOf(f);
    if (TERMINAL_STATES.includes(state)) { blocked.push({ id: f.id, reason: `already in terminal state ${state}` }); continue; }
    if (!closable.includes(state)) { blocked.push({ id: f.id, reason: `state ${state} cannot be closed directly` }); continue; }
    const moved = withHistory(f, state, 'closed', options.actor, options.at, reason);
    closed.push({ ...moved, closeReason: reason, closeReasonCode: options.reasonCode || 'fixed-verified', closedBy: options.actor || 'system', closedAt: options.at || null });
  }
  return { ok: blocked.length === 0, closed, closedIds: closed.map(f => f.id), blocked, error: null };
}

/**
 * Reopen a selection under one documented reason (idea 52824).
 * Closed, verified, and dismissed findings reopen with the shared
 * reason and an incremented reopen counter for regression tracking.
 * @param {Array} findings - Findings to reopen.
 * @param {object} [options] - { reason, reasonCode, actor, at }.
 * @returns {object} { ok, reopened, reopenedIds, blocked, error }.
 */
export function bulkReopenWithReason(findings = [], options = {}) {
  const reason = String(options.reason || '').trim();
  if (reason.length < 3) return { ok: false, reopened: [], reopenedIds: [], blocked: [], error: 'bulk reopen requires one documented reason' };
  const reopenable = ['closed', 'verified', 'dismissed'];
  const reopened = [];
  const blocked = [];
  for (const f of findings || []) {
    const state = stateOf(f);
    if (!reopenable.includes(state)) { blocked.push({ id: f.id, reason: `state ${state} cannot be reopened` }); continue; }
    const moved = withHistory(f, state, 'reopened', options.actor, options.at, reason);
    reopened.push({ ...moved, reopenCount: Number(f.reopenCount || 0) + 1, reopenReason: reason, reopenReasonCode: options.reasonCode || 'regression' });
  }
  return { ok: blocked.length === 0, reopened, reopenedIds: reopened.map(f => f.id), blocked, error: null };
}

/**
 * Build assignee notifications for a selection (idea 52825).
 * Findings are grouped by assignee so each person receives one
 * notification covering their findings; unassigned findings are
 * reported separately instead of being silently dropped.
 * @param {Array} findings - Findings to notify about.
 * @param {object} [options] - { channel, actor, at, message }.
 * @returns {object} { notifications, recipients, totalFindings, unassignedIds }.
 */
export function bulkNotifyAssignees(findings = [], options = {}) {
  const channel = String(options.channel || 'chat').toLowerCase();
  const byRecipient = new Map();
  const unassignedIds = [];
  for (const f of findings || []) {
    const recipient = f.assignee || f.owner || null;
    if (!recipient) { unassignedIds.push(f.id); continue; }
    if (!byRecipient.has(recipient)) byRecipient.set(recipient, []);
    byRecipient.get(recipient).push(f.id);
  }
  const notifications = [...byRecipient.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([recipient, ids]) => ({
    notificationId: `ntf_${shortHash(`${recipient}:${ids.join(',')}:${options.at || ''}`)}`,
    recipient,
    findingIds: [...ids],
    count: ids.length,
    channel,
    message: options.message || `Infinity AI: ${ids.length} finding(s) assigned to you need attention: ${ids.join(', ')}.`,
    sentBy: options.actor || 'system',
    at: options.at || null,
  }));
  return { notifications, recipients: notifications.map(n => n.recipient), totalFindings: (findings || []).length, unassignedIds };
}

/**
 * Describe the PoC bundle for a selection (idea 52826).
 * Each finding contributes a bundle folder with a proof-of-concept
 * script descriptor, a request capture, and a README step list built
 * from the finding type and target, all checksummed for verification.
 * @param {Array} findings - Findings to bundle proofs for.
 * @param {object} [options] - { bundleName, generatedAt }.
 * @returns {object} { bundleName, bundles, fileCount, totalFindings, checksum }.
 */
export function buildPocBundleManifest(findings = [], options = {}) {
  const bundles = (findings || []).map(f => {
    const type = String(f.type || 'finding').toLowerCase();
    const steps = [
      `Open the target ${f.target || 'unknown target'} in a test account session.`,
      `Replay the recorded ${type} proof of concept for finding ${f.id}.`,
      'Observe the behaviour described in the evidence and compare with the expected secure response.',
    ];
    if ((f.pocSteps || []).length) steps.splice(1, 0, ...(f.pocSteps || []).map(s => String(s)));
    const files = [
      { path: `poc/${f.id}/poc.txt`, kind: 'proof-of-concept', sizeBytes: steps.join('\n').length + 64 },
      { path: `poc/${f.id}/request.txt`, kind: 'request-capture', sizeBytes: String(f.target || '').length + 128 },
      { path: `poc/${f.id}/README.md`, kind: 'walkthrough', sizeBytes: steps.join('\n').length + 96 },
    ];
    for (const file of files) file.checksum = shortHash(`${file.path}:${f.id}:${file.sizeBytes}`);
    return { findingId: f.id, title: f.title || null, severity: sevKey(f), type, target: f.target || null, steps, files };
  });
  const fileCount = bundles.reduce((a, b) => a + b.files.length, 0);
  return {
    bundleName: options.bundleName || 'poc-bundle.zip',
    bundles,
    fileCount,
    totalFindings: bundles.length,
    checksum: shortHash(JSON.stringify(bundles.map(b => [b.findingId, b.files.map(x => x.checksum)]))),
    generatedBy: 'Infinity AI',
    generatedAt: options.generatedAt || null,
  };
}

/**
 * Draft CVE requests for eligible findings (idea 52827).
 * Critical and high findings with a recorded weakness and no CVE yet
 * receive a structured draft; everything else is listed with the
 * exact eligibility gap.
 * @param {Array} findings - Findings to consider.
 * @param {object} [options] - { requester, at }.
 * @returns {object} { drafts, ineligible, count }.
 */
export function draftBulkCveRequests(findings = [], options = {}) {
  const drafts = [];
  const ineligible = [];
  for (const f of findings || []) {
    const sev = sevKey(f);
    const cwe = cweKey(f);
    if (!['critical', 'high'].includes(sev)) { ineligible.push({ id: f.id, reason: `severity ${sev} does not qualify for a CVE request` }); continue; }
    if (!cwe) { ineligible.push({ id: f.id, reason: 'no CWE recorded for the finding' }); continue; }
    if (f.cveId) { ineligible.push({ id: f.id, reason: `already tracked as ${f.cveId}` }); continue; }
    drafts.push({
      draftId: `cve_${shortHash(`${f.id}:${cwe}:${f.target || ''}`)}`,
      findingId: f.id,
      status: 'draft',
      suggestedTitle: `${f.title || 'untitled finding'} (${cwe.toUpperCase()})`,
      weakness: cwe.toUpperCase(),
      affectedProduct: f.target || 'unknown product',
      severity: sev,
      description: `Infinity AI requests a CVE for ${f.title || 'a finding'} affecting ${f.target || 'the product'}: ${(f.evidence || [])[0] || 'evidence recorded in the finding'}.`,
      requester: options.requester || null,
      requestedAt: options.at || null,
    });
  }
  return { drafts, ineligible, count: drafts.length };
}

/**
 * Recalculate SLAs for a selection under a severity policy
 * (idea 52828). Due instants derive from creation time plus the
 * policy hours for the severity; remaining time and breach state
 * are computed against the supplied instant.
 * @param {Array} findings - Findings to recalculate.
 * @param {object} [policy] - { bySeverity: { critical: hours } }.
 * @param {string} nowIso - Current instant.
 * @returns {object} { results, breachedIds, withinIds, count, policyUsed }.
 */
export function recalculateBulkSla(findings = [], policy = {}, nowIso = '') {
  const bySeverity = { ...SLA_DEFAULT_HOURS, ...((policy && policy.bySeverity) || {}) };
  const nowMs = parseMs(nowIso);
  const results = (findings || []).map(f => {
    const sev = sevKey(f);
    const hours = Number(bySeverity[sev] || SLA_DEFAULT_HOURS.medium);
    const createdMs = parseMs(f.createdAt || f.stateEnteredAt || '');
    const dueMs = createdMs === null ? null : createdMs + hours * 3600000;
    const remainingHours = dueMs === null || nowMs === null ? null : Math.round(((dueMs - nowMs) / 3600000) * 10) / 10;
    const elapsed = createdMs === null || nowMs === null ? 0 : Math.max(0, (nowMs - createdMs) / 3600000);
    return {
      id: f.id,
      severity: sev,
      slaHours: hours,
      dueAt: dueMs === null ? null : new Date(dueMs).toISOString(),
      remainingHours,
      percentUsed: hours ? Math.min(999, Math.round((elapsed / hours) * 1000) / 10) : 0,
      breached: remainingHours !== null && remainingHours < 0 && !TERMINAL_STATES.includes(stateOf(f)),
    };
  });
  return {
    results,
    breachedIds: results.filter(r => r.breached).map(r => r.id),
    withinIds: results.filter(r => !r.breached).map(r => r.id),
    count: results.length,
    policyUsed: bySeverity,
  };
}

/**
 * Export the decision history behind a selection (idea 52829).
 * Every recorded transition becomes one decision row with its actor
 * and reason, serialized as JSON, CSV, or Markdown with a checksum.
 * @param {Array} findings - Findings with history.
 * @param {string} [format] - json, csv, or markdown.
 * @param {object} [options] - { exportedBy }.
 * @returns {object} { format, filename, content, rows, checksum }.
 */
export function exportDecisionHistory(findings = [], format = 'json', options = {}) {
  const fmt = ['json', 'csv', 'markdown'].includes(String(format).toLowerCase()) ? String(format).toLowerCase() : 'json';
  const rows = [];
  for (const f of findings || []) {
    for (const h of (f.history) || []) {
      rows.push({
        findingId: f.id,
        from: normState(h.from || ''),
        to: normState(h.to || ''),
        actor: h.actor || 'system',
        at: h.at || null,
        reason: h.reason || '',
      });
    }
  }
  rows.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || String(a.findingId).localeCompare(String(b.findingId)));
  let content = '';
  if (fmt === 'json') content = JSON.stringify({ exportedBy: options.exportedBy || 'Infinity AI', decisions: rows }, null, 2);
  else if (fmt === 'csv') content = ['findingId,from,to,actor,at,reason', ...rows.map(r => [r.findingId, r.from, r.to, r.actor, r.at || '', `"${String(r.reason).replace(/"/g, '""')}"`].join(','))].join('\n');
  else content = ['# Decision history', '', ...rows.map(r => `- ${r.findingId}: ${r.from} -> ${r.to} by ${r.actor} (${r.reason || 'no reason recorded'})`)].join('\n');
  return {
    format: fmt,
    filename: `decision-history.${fmt === 'markdown' ? 'md' : fmt}`,
    content,
    rows: rows.length,
    findingsCovered: (findings || []).length,
    checksum: shortHash(content),
  };
}

/**
 * Split multi-asset findings into one finding per asset (idea 52830).
 * Each copy keeps the shared title, severity, and evidence, records
 * the asset it covers, and points back at the original finding.
 * @param {Array} findings - Findings, some covering several assets.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { split, originalIds, createdIds, count, splitCount }.
 */
export function splitFindingsByAsset(findings = [], options = {}) {
  const split = [];
  const createdIds = [];
  let splitCount = 0;
  for (const f of findings || []) {
    const assets = [...new Set([...((f.assets) || []), ...((f.targets) || [])].map(String).filter(Boolean))];
    if (assets.length <= 1) {
      split.push({ ...f, asset: assets[0] || f.target || null });
      continue;
    }
    splitCount += 1;
    assets.forEach((asset, i) => {
      const id = `${f.id}-a${i + 1}`;
      createdIds.push(id);
      split.push({
        ...f,
        id,
        asset,
        target: asset,
        assets: [asset],
        splitFrom: f.id,
        splitIndex: i + 1,
        splitAt: options.at || null,
        splitBy: options.actor || 'system',
      });
    });
  }
  return { split, originalIds: (findings || []).map(f => f.id), createdIds, count: split.length, splitCount };
}

function huntSummaryData(hunt) {
  const findings = (hunt && hunt.findings) || [];
  const bySeverity = {};
  const byState = {};
  for (const f of findings) {
    bySeverity[sevKey(f)] = (bySeverity[sevKey(f)] || 0) + 1;
    byState[stateOf(f)] = (byState[stateOf(f)] || 0) + 1;
  }
  const top = [...findings].sort((a, b) => riskOf(b) - riskOf(a) || String(a.id).localeCompare(String(b.id)))[0] || null;
  return { findings, bySeverity, byState, top };
}

/**
 * Answer a post-hunt question from the hunt record (idea 52831).
 * The question intent is classified from its wording (counts,
 * criticals, top finding, state breakdown, coverage, failures) and
 * answered from the actual findings and attempts on record.
 * @param {object} hunt - { huntId, target, findings, attempts, coveredCategories }.
 * @param {string} question - Natural-language question.
 * @returns {object} { question, intent, answer, data }.
 */
export function answerPostHuntQuestion(hunt = {}, question = '') {
  const q = String(question || '').toLowerCase();
  const { findings, bySeverity, byState, top } = huntSummaryData(hunt);
  let intent = 'summary';
  if (/\b(how many|count|total|number of)\b/.test(q)) intent = 'count';
  else if (/critical/.test(q)) intent = 'critical';
  else if (/\b(top|worst|highest|most severe)\b/.test(q)) intent = 'top-finding';
  else if (/\b(state|status|open|closed|breakdown)\b/.test(q)) intent = 'state-breakdown';
  else if (/coverage|covered|gap/.test(q)) intent = 'coverage';
  else if (/fail|attempt|tried/.test(q)) intent = 'failures';
  const criticals = findings.filter(f => sevKey(f) === 'critical');
  const attempts = (hunt && hunt.attempts) || [];
  const failed = attempts.filter(a => ['failed', 'blocked', 'error', 'no-finding'].includes(String(a.outcome || '').toLowerCase()));
  let answer = '';
  let data = {};
  if (intent === 'count') {
    answer = `Infinity AI found ${findings.length} findings in this hunt.`;
    data = { total: findings.length, bySeverity };
  } else if (intent === 'critical') {
    answer = criticals.length
      ? `Infinity AI recorded ${criticals.length} critical finding(s): ${criticals.map(f => f.id).join(', ')}.`
      : 'Infinity AI recorded no critical findings in this hunt.';
    data = { criticalIds: criticals.map(f => f.id), count: criticals.length };
  } else if (intent === 'top-finding') {
    answer = top
      ? `The highest-risk finding is ${top.id} (${top.title || 'untitled'}, ${sevKey(top)}, risk ${riskOf(top)}).`
      : 'This hunt has no findings yet.';
    data = { topId: top ? top.id : null, riskScore: top ? riskOf(top) : 0 };
  } else if (intent === 'state-breakdown') {
    answer = `Finding states: ${Object.entries(byState).map(([s, n]) => `${s} ${n}`).join(', ') || 'none'}.`;
    data = { byState };
  } else if (intent === 'coverage') {
    const gaps = analyzeCoverageGaps(hunt, (hunt && hunt.checklist) || DEFAULT_COVERAGE_CHECKLIST);
    answer = `Coverage is ${gaps.coveragePercent}% (${gaps.testedCount}/${gaps.expectedCount} areas); gaps: ${gaps.gaps.join(', ') || 'none'}.`;
    data = { coveragePercent: gaps.coveragePercent, gaps: gaps.gaps };
  } else if (intent === 'failures') {
    answer = failed.length
      ? `${failed.length} of ${attempts.length} recorded attempts did not produce a finding; see the failed-attempt summary.`
      : 'No failed attempts are recorded for this hunt.';
    data = { failedCount: failed.length, totalAttempts: attempts.length };
  } else {
    answer = `Infinity AI hunt summary: ${findings.length} findings (${criticals.length} critical) across states ${Object.keys(byState).join(', ') || 'none'}.`;
    data = { total: findings.length, bySeverity, byState };
  }
  return { question: String(question || ''), intent, answer, data, huntId: (hunt && hunt.huntId) || null };
}

/**
 * Explain, from the risk fields, why a finding is critical
 * (idea 52832). CVSS-style vector parts, the numeric risk score,
 * exposure of the target, and recorded impact each contribute named
 * factors with points, so the severity call can be defended.
 * @param {object} finding - Finding with severity, risk, cvss fields.
 * @returns {object} { findingId, severity, score, factors, verdict, summary }.
 */
export function explainCriticality(finding = {}) {
  const factors = [];
  const sev = sevKey(finding);
  const risk = riskOf(finding);
  factors.push({ factor: 'severity-rating', points: severityRank(sev) * 10, detail: `Recorded severity is ${sev}.` });
  factors.push({ factor: 'risk-score', points: Math.round(risk / 2), detail: `Risk score is ${risk} on the hunt scale.` });
  const cvss = (finding && finding.cvss) || {};
  if (cvss.score != null) factors.push({ factor: 'cvss-score', points: Math.round(Number(cvss.score) * 3), detail: `CVSS base score is ${cvss.score}.` });
  const vector = String(cvss.vector || '').toUpperCase();
  if (vector.includes('AV:N')) factors.push({ factor: 'network-reachable', points: 12, detail: 'Attack vector is network-reachable (AV:N).' });
  if (vector.includes('AC:L')) factors.push({ factor: 'low-complexity', points: 8, detail: 'Attack complexity is low (AC:L).' });
  if (vector.includes('PR:N')) factors.push({ factor: 'no-privileges', points: 10, detail: 'No privileges are required (PR:N).' });
  if (vector.includes('UI:N')) factors.push({ factor: 'no-interaction', points: 6, detail: 'No user interaction is required (UI:N).' });
  if (String(finding.impact || '').toLowerCase().includes('data') || String(finding.impact || '').toLowerCase().includes('account')) {
    factors.push({ factor: 'sensitive-impact', points: 10, detail: `Recorded impact: ${finding.impact}.` });
  }
  if ((finding.evidence || []).length) factors.push({ factor: 'recorded-evidence', points: 5, detail: `${(finding.evidence || []).length} evidence item(s) support the finding.` });
  const score = factors.reduce((a, f) => a + f.points, 0);
  const justified = sev === 'critical' && score >= 70;
  return {
    findingId: finding.id || null,
    severity: sev,
    score,
    factors,
    verdict: justified ? 'critical-justified' : (sev === 'critical' ? 'critical-review-advised' : 'not-critical'),
    summary: justified
      ? `Infinity AI: this finding is critical because ${factors.slice(0, 3).map(f => f.detail).join(' ')}`
      : `Infinity AI: severity ${sev} with explanation score ${score}; review the factors before challenging the rating.`,
  };
}

/**
 * Narrate an exploit chain hop by hop (idea 52833).
 * Each hop names the finding, its severity, and the step it enables;
 * the walkthrough closes with the combined impact and the strongest
 * single mitigation point in the chain.
 * @param {object} chain - { id, hops: [{ findingId, action }] } or { findingIds }.
 * @param {Array} findings - Findings referenced by the chain.
 * @returns {object} { chainId, steps, stepCount, maxSeverity, narrative, breakPoint }.
 */
export function walkthroughExploitChain(chain = {}, findings = []) {
  const byId = new Map((findings || []).map(f => [String(f.id), f]));
  const hops = (chain.hops && chain.hops.length)
    ? chain.hops
    : ((chain.findingIds) || []).map(id => ({ findingId: id, action: '' }));
  const steps = hops.map((hop, i) => {
    const f = byId.get(String(hop.findingId)) || {};
    const sev = sevKey(f);
    return {
      step: i + 1,
      findingId: hop.findingId || null,
      title: f.title || 'unknown finding',
      severity: sev,
      narration: `Step ${i + 1}: ${f.title || hop.findingId || 'hop'} (${sev})${hop.action ? ` — ${hop.action}` : ''}.`,
    };
  });
  const maxSeverity = steps.reduce((best, s) => (severityRank(s.severity) > severityRank(best) ? s.severity : best), 'info');
  const weakest = steps.reduce((best, s) => (best === null || severityRank(s.severity) < severityRank(best.severity) ? s : best), null);
  return {
    chainId: chain.id || null,
    steps,
    stepCount: steps.length,
    maxSeverity: steps.length ? maxSeverity : 'info',
    narrative: steps.map(s => s.narration).join(' '),
    breakPoint: weakest ? { step: weakest.step, findingId: weakest.findingId, advice: `Fixing step ${weakest.step} (${weakest.title}) breaks the chain at its weakest link.` } : null,
    source: 'Infinity AI',
  };
}

/**
 * Account for what was tried that did not yield a finding
 * (idea 52834). Attempts are normalized, grouped by check and by
 * outcome, and the failure rate is computed so reviewers can tell
 * real negatives from blocked testing.
 * @param {object} hunt - { attempts: [{ check, target, outcome, reason }] }.
 * @returns {object} { total, failed, byOutcome, byCheck, failureRate, summary }.
 */
export function summarizeFailedAttempts(hunt = {}) {
  const attempts = ((hunt && hunt.attempts) || []).map(a => ({
    check: String((a && a.check) || 'unspecified check'),
    target: (a && a.target) || null,
    outcome: String((a && a.outcome) || 'no-finding').toLowerCase(),
    reason: (a && a.reason) || '',
  }));
  const failedOutcomes = ['failed', 'blocked', 'error', 'no-finding'];
  const failed = attempts.filter(a => failedOutcomes.includes(a.outcome));
  const byOutcome = {};
  const byCheck = {};
  for (const a of attempts) {
    byOutcome[a.outcome] = (byOutcome[a.outcome] || 0) + 1;
    byCheck[a.check] = byCheck[a.check] || { attempted: 0, failed: 0 };
    byCheck[a.check].attempted += 1;
    if (failedOutcomes.includes(a.outcome)) byCheck[a.check].failed += 1;
  }
  return {
    total: attempts.length,
    failed,
    failedCount: failed.length,
    byOutcome,
    byCheck,
    failureRate: attempts.length ? Math.round((failed.length / attempts.length) * 1000) / 10 : 0,
    summary: `Infinity AI tried ${attempts.length} checks; ${failed.length} produced no finding (${attempts.length ? Math.round((failed.length / attempts.length) * 100) : 0}%).`,
  };
}

/**
 * Find the coverage gaps in a hunt (idea 52835).
 * The expected checklist is compared with the areas the hunt actually
 * covered, through recorded categories or attempt checks, producing
 * the gap list and a coverage percentage.
 * @param {object} hunt - { coveredCategories, attempts }.
 * @param {Array} [checklist] - Expected coverage areas.
 * @returns {object} { covered, gaps, coveragePercent, testedCount, expectedCount, recommendations }.
 */
export function analyzeCoverageGaps(hunt = {}, checklist = []) {
  const expected = (checklist && checklist.length ? checklist : DEFAULT_COVERAGE_CHECKLIST).map(s => String(s).toLowerCase());
  const coveredSet = new Set(((hunt && hunt.coveredCategories) || []).map(s => String(s).toLowerCase()));
  for (const a of ((hunt && hunt.attempts) || [])) {
    const check = String((a && a.check) || '').toLowerCase();
    for (const area of expected) {
      if (check.includes(area) || area.includes(check) && check) coveredSet.add(area);
    }
  }
  const covered = expected.filter(a => coveredSet.has(a));
  const gaps = expected.filter(a => !coveredSet.has(a));
  return {
    covered,
    gaps,
    coveragePercent: expected.length ? Math.round((covered.length / expected.length) * 1000) / 10 : 0,
    testedCount: covered.length,
    expectedCount: expected.length,
    recommendations: gaps.map(g => `Add ${g} checks to the next hunt plan.`),
  };
}

/**
 * Interrogate how much a finding can be trusted (idea 52836).
 * Evidence volume, a recorded proof of concept, reproduction steps,
 * independent verification, and history confirmations each earn
 * weighted points; missing pieces become follow-up questions.
 * @param {object} finding - Finding to interrogate.
 * @returns {object} { findingId, confidenceScore, level, factors, questions }.
 */
export function interrogateConfidence(finding = {}) {
  const evidence = (finding.evidence) || [];
  const pocText = `${(finding.pocSteps || []).join(' ')} ${evidence.join(' ')}`.toLowerCase();
  const hasPoc = Boolean((finding.pocSteps || []).length) || /curl|payload|request|poc/.test(pocText);
  const factors = [];
  const add = (name, points, max, present, detail) => factors.push({ name, points: present ? points : 0, max, detail });
  add('evidence-volume', 25, 25, evidence.length >= 2, `${evidence.length} evidence item(s) recorded.`);
  add('proof-of-concept', 25, 25, hasPoc, hasPoc ? 'A proof of concept is recorded.' : 'No proof of concept recorded yet.');
  add('reproduction-steps', 20, 20, (finding.reproductionSteps || []).length >= 2 || (finding.pocSteps || []).length >= 2, `${((finding.reproductionSteps) || (finding.pocSteps) || []).length} reproduction step(s) recorded.`);
  add('independent-verification', 20, 20, Boolean(finding.verifiedBy || stateOf(finding) === 'verified' || stateOf(finding) === 'closed'), finding.verifiedBy ? `Verified by ${finding.verifiedBy}.` : 'No independent verifier recorded.');
  const confirmations = ((finding.history) || []).filter(h => normState(h.to || '') === 'confirmed').length;
  add('triage-confirmation', 10, 10, confirmations > 0, `${confirmations} confirmation transition(s) in history.`);
  const confidenceScore = factors.reduce((a, f) => a + f.points, 0);
  const questions = [];
  for (const f of factors) {
    if (f.points < f.max) questions.push(`Interrogate ${f.name}: ${f.detail}`);
  }
  return {
    findingId: finding.id || null,
    confidenceScore,
    level: confidenceScore >= 75 ? 'high' : confidenceScore >= 45 ? 'medium' : 'low',
    factors,
    questions,
    summary: `Infinity AI confidence ${confidenceScore}/100 (${confidenceScore >= 75 ? 'high' : confidenceScore >= 45 ? 'medium' : 'low'}) for finding ${finding.id || 'unknown'}.`,
  };
}

/**
 * Estimate how far one finding can spread (idea 52837).
 * Assets sharing the target host or a shared service with the
 * finding are counted as reachable; severity, sensitivity, and
 * reach combine into a radius score with named factors.
 * @param {object} finding - Finding to estimate from.
 * @param {object} [context] - { assets: [{ id, host, criticality, sharedServices }] }.
 * @returns {object} { findingId, affectedAssets, affectedCount, radiusScore, level, factors }.
 */
export function estimateBlastRadius(finding = {}, context = {}) {
  const assets = (context && context.assets) || [];
  const hostOf = url => {
    const m = String(url || '').match(/^(?:[a-z]+:\/\/)?([^/:]+)/i);
    return m ? m[1].toLowerCase() : '';
  };
  const targetHost = hostOf(finding.target || finding.asset || '');
  const services = new Set(((finding.sharedServices) || []).map(s => String(s).toLowerCase()));
  const affectedAssets = [];
  for (const a of assets) {
    const sameHost = targetHost && hostOf(a.host || a.id || '') === targetHost;
    const shared = ((a.sharedServices) || []).some(s => services.has(String(s).toLowerCase()));
    if (sameHost || shared) affectedAssets.push({ id: a.id || a.host || 'asset', reason: sameHost ? 'same host as target' : 'shared service with target' });
  }
  const sevPoints = severityRank(sevKey(finding)) * 15;
  const reachPoints = Math.min(30, affectedAssets.length * 10);
  const sensitivityPoints = /payment|auth|pii|database|admin/i.test(`${finding.target || ''} ${finding.title || ''} ${finding.impact || ''}`) ? 15 : 5;
  const radiusScore = Math.min(100, sevPoints + reachPoints + sensitivityPoints);
  return {
    findingId: finding.id || null,
    targetHost: targetHost || null,
    affectedAssets,
    affectedCount: affectedAssets.length,
    radiusScore,
    level: radiusScore >= 70 ? 'wide' : radiusScore >= 40 ? 'moderate' : 'contained',
    factors: [
      { factor: 'severity', points: sevPoints, detail: `Severity ${sevKey(finding)} drives the base radius.` },
      { factor: 'reachable-assets', points: reachPoints, detail: `${affectedAssets.length} asset(s) share the host or a service.` },
      { factor: 'sensitivity', points: sensitivityPoints, detail: 'Sensitivity judged from target, title, and impact wording.' },
    ],
    summary: `Infinity AI blast radius ${radiusScore}/100 across ${affectedAssets.length} reachable asset(s).`,
  };
}

/**
 * Suggest the fix and its follow-ups for a finding (idea 52838).
 * Guidance is keyed by CWE with a tested generic fallback; every
 * suggestion carries a priority and the retest that proves the fix.
 * @param {object} finding - Finding needing a fix.
 * @returns {object} { findingId, cwe, weakness, suggestions, followUpQuestions }.
 */
export function suggestFixFollowUps(finding = {}) {
  const cwe = cweKey(finding);
  const guidance = CWE_FIX_GUIDANCE[cwe] || GENERIC_FIX;
  const sev = sevKey(finding);
  const priority = sev === 'critical' ? 'immediate' : sev === 'high' ? 'current-sprint' : 'planned';
  return {
    findingId: finding.id || null,
    cwe: cwe ? cwe.toUpperCase() : 'UNSPECIFIED',
    weakness: guidance.weakness,
    suggestions: [
      { action: guidance.fix, priority, verification: guidance.verification },
      { action: 'Add a regression test that replays the original proof of concept in CI.', priority, verification: 'The regression test fails before the fix and passes after it.' },
      { action: 'Search sibling endpoints and assets for the same pattern before closing.', priority: 'planned', verification: 'Sibling sweep results are recorded on the finding.' },
    ],
    followUpQuestions: [
      `Has the ${guidance.weakness.toLowerCase()} pattern been checked on every route that shares this code path?`,
      'Which release will carry the fix, and who owns the retest?',
      finding.fixVersion ? `Is the fix still on track for ${finding.fixVersion}?` : 'Which fix version should this finding be tagged with?',
    ],
    source: 'Infinity AI',
  };
}

/**
 * Compare two hunts for follow-up questions (idea 52839).
 * Totals, severity mix, state mix, and average risk are computed for
 * both hunts and differenced, so questions like "are we improving?"
 * get a numeric answer.
 * @param {object} huntA - Earlier hunt { huntId, findings }.
 * @param {object} huntB - Later hunt { huntId, findings }.
 * @returns {object} { a, b, delta, summary }.
 */
export function compareHuntHistory(huntA = {}, huntB = {}) {
  const metrics = hunt => {
    const findings = (hunt && hunt.findings) || [];
    const bySeverity = {};
    const byState = {};
    let riskSum = 0;
    for (const f of findings) {
      bySeverity[sevKey(f)] = (bySeverity[sevKey(f)] || 0) + 1;
      byState[stateOf(f)] = (byState[stateOf(f)] || 0) + 1;
      riskSum += riskOf(f);
    }
    return {
      huntId: (hunt && hunt.huntId) || null,
      total: findings.length,
      critical: bySeverity.critical || 0,
      bySeverity,
      byState,
      avgRisk: findings.length ? Math.round((riskSum / findings.length) * 10) / 10 : 0,
      open: findings.filter(f => !TERMINAL_STATES.includes(stateOf(f))).length,
    };
  };
  const a = metrics(huntA);
  const b = metrics(huntB);
  const delta = {
    total: b.total - a.total,
    critical: b.critical - a.critical,
    avgRisk: Math.round((b.avgRisk - a.avgRisk) * 10) / 10,
    open: b.open - a.open,
  };
  return {
    a,
    b,
    delta,
    summary: `Infinity AI comparison: findings ${delta.total >= 0 ? '+' : ''}${delta.total}, criticals ${delta.critical >= 0 ? '+' : ''}${delta.critical}, average risk ${delta.avgRisk >= 0 ? '+' : ''}${delta.avgRisk} between hunts ${a.huntId || 'A'} and ${b.huntId || 'B'}.`,
  };
}

/**
 * Draft a submission-ready bounty writeup (idea 52840).
 * Title, summary, severity, target, reproduction steps, impact,
 * evidence, and remediation are assembled into a Markdown document;
 * missing pieces are listed so the draft is never silently thin.
 * @param {object} finding - Finding to write up.
 * @param {object} [options] - { submitter, program }.
 * @returns {object} { findingId, title, markdown, wordCount, sections, missing, ready }.
 */
export function draftBountyWriteup(finding = {}, options = {}) {
  const sev = sevKey(finding);
  const cwe = cweKey(finding);
  const guidance = CWE_FIX_GUIDANCE[cwe] || GENERIC_FIX;
  const steps = ((finding.pocSteps) || (finding.reproductionSteps) || []).map(s => String(s));
  const evidence = (finding.evidence || []).map(e => String(e));
  const missing = [];
  if (!finding.title) missing.push('title');
  if (!finding.target) missing.push('target');
  if (!steps.length) missing.push('reproduction steps');
  if (!evidence.length) missing.push('evidence');
  if (!finding.impact) missing.push('impact statement');
  const title = `[${sev}] ${finding.title || 'Untitled finding'} on ${finding.target || 'unknown target'}`;
  const sections = ['Summary', 'Severity', 'Target', 'Steps to reproduce', 'Impact', 'Evidence', 'Remediation'];
  const markdown = [
    `# ${title}`,
    '',
    '## Summary',
    `${finding.title || 'A security finding'} was identified on ${finding.target || 'the target'} during an Infinity AI hunt${cwe ? ` and is classified as ${cwe.toUpperCase()} (${guidance.weakness})` : ''}.`,
    '',
    '## Severity',
    `${sev} (risk score ${riskOf(finding)})`,
    '',
    '## Target',
    String(finding.target || 'not specified'),
    '',
    '## Steps to reproduce',
    ...(steps.length ? steps.map((s, i) => `${i + 1}. ${s}`) : ['1. Reproduction steps to be recorded during verification.']),
    '',
    '## Impact',
    String(finding.impact || 'Impact to be confirmed during triage.'),
    '',
    '## Evidence',
    ...(evidence.length ? evidence.map(e => `- ${e}`) : ['- Evidence to be attached before submission.']),
    '',
    '## Remediation',
    guidance.fix,
    '',
    `Submitted by ${options.submitter || 'Infinity AI'}${options.program ? ` to ${options.program}` : ''}.`,
  ].join('\n');
  return {
    findingId: finding.id || null,
    title,
    markdown,
    wordCount: markdown.split(/\s+/).filter(Boolean).length,
    sections,
    missing,
    ready: missing.length === 0,
  };
}
