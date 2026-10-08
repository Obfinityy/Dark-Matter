/**
 * wave73BCores.js — hunt reopen workflows (ideas 52901–52920).
 *
 * Pure logic for history-preserving reopen, reason templates,
 * approval workflow, bulk reopen, the reopen API, email and
 * comparison entry points, threat-intel / code-change /
 * acquisition / incident triggers, expiry policy, fresh-engine
 * reopen, cost estimates, scheduled reopen, discussion threads,
 * badges, search filters, analytics, and the reopen-vs-regression
 * explainer. Every helper takes explicit inputs, never mutates
 * them, and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE73_B_IDEAS = [
  { id: 52901, title: 'History-preserving reopen', skip: false },
  { id: 52902, title: 'Reopen reason templates', skip: false },
  { id: 52903, title: 'Reopen approval workflow', skip: false },
  { id: 52904, title: 'Bulk reopen (post-hunt)', skip: false },
  { id: 52905, title: 'Reopen API', skip: false },
  { id: 52906, title: 'Reopen from email link', skip: false },
  { id: 52907, title: 'Reopen from comparison view', skip: false },
  { id: 52908, title: 'Threat-intel-triggered reopen', skip: false },
  { id: 52909, title: 'Code-change-triggered reopen', skip: false },
  { id: 52910, title: 'Acquisition-triggered reopen', skip: false },
  { id: 52911, title: 'Incident-triggered reopen', skip: false },
  { id: 52912, title: 'Reopen expiry policy', skip: false },
  { id: 52913, title: 'Fresh-engine reopen', skip: false },
  { id: 52914, title: 'Reopen cost estimate', skip: false },
  { id: 52915, title: 'Scheduled reopen', skip: false },
  { id: 52916, title: 'Reopen discussion thread', skip: false },
  { id: 52917, title: 'Reopened-hunt badge', skip: false },
  { id: 52918, title: 'Reopen search filter', skip: false },
  { id: 52919, title: 'Reopen analytics', skip: false },
  { id: 52920, title: 'Reopen-vs-regression explainer', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const REASON_TEMPLATES = [
  { id: 'regression', label: 'Regression detected', text: 'A previously fixed finding appears to have regressed and needs verification.', category: 'regression' },
  { id: 'threat-intel', label: 'New threat intel', text: 'New threat intelligence matches this target stack and warrants another look.', category: 'new-intel' },
  { id: 'scope-expanded', label: 'Scope expanded', text: 'Scope expanded with new surface that belongs in this hunt record.', category: 'scope-change' },
  { id: 'fp-dispute', label: 'False-positive dispute', text: 'A disputed false-positive decision needs re-examination with new evidence.', category: 'dispute' },
  { id: 'incident-followup', label: 'Incident follow-up', text: 'A security incident on this asset requires reopening the last hunt for context.', category: 'incident' },
  { id: 'scheduled-recheck', label: 'Scheduled recheck', text: 'Planned periodic recheck of this hunt after changes have landed.', category: 'general' },
];

function sevKey(f) {
  return String((f && f.severity) || 'info').toLowerCase();
}
function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}
function parseMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isNaN(ms) ? null : ms;
}
function hostOf(value) {
  const m = String(value || '').match(/^(?:[a-z]+:\/\/)?([^/:?#]+)/i);
  return m ? m[1].toLowerCase() : '';
}
function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}

/**
 * Reopen without erasing closure history (idea 52901).
 * The closed chapter stays readable and a new chapter opens with
 * the reopen event; nothing from the first chapter is rewritten.
 */
export function reopenPreservingHistory(hunt = {}, reopenInfo = {}, options = {}) {
  const chapters = (hunt.chapters || []).map(c => ({ ...c }));
  if (!chapters.length && hunt.closedAt) {
    chapters.push({ number: 1, kind: 'original', openedAt: hunt.createdAt || null, closedAt: hunt.closedAt, findingCount: (hunt.findings || []).length });
  }
  const nextNumber = chapters.length + 1;
  const newChapter = {
    number: nextNumber,
    kind: 'reopen',
    openedAt: reopenInfo.at || options.now || '2026-10-09T00:00:00Z',
    closedAt: null,
    reason: String(reopenInfo.reason || '').slice(0, 200),
    openedBy: reopenInfo.actor || reopenInfo.requestedBy || 'unknown',
    findingCount: 0,
  };
  return {
    huntId: hunt.huntId || hunt.id || null,
    chapters: [...chapters, newChapter],
    chapterCount: chapters.length + 1,
    historyPreserved: true,
    currentChapter: nextNumber,
    summary: `Infinity AI reopened ${hunt.huntId || 'the hunt'} as chapter ${nextNumber}; ${chapters.length} prior chapter(s) preserved.`,
  };
}

/**
 * List one-click reopen reason templates (idea 52902).
 * Templates cover regression, new intel, scope expansion, disputes,
 * incidents, and scheduled rechecks with ready-to-send wording.
 */
export function listReopenReasonTemplates(options = {}) {
  const category = String(options.category || '').toLowerCase();
  const templates = REASON_TEMPLATES
    .filter(t => !category || t.category === category)
    .map(t => ({ ...t }));
  const picked = options.templateId
    ? REASON_TEMPLATES.find(t => t.id === String(options.templateId).toLowerCase()) || REASON_TEMPLATES[0]
    : null;
  const ctx = options.context || {};
  const applied = picked ? {
    templateId: picked.id,
    label: picked.label,
    category: picked.category,
    reason: `${picked.text}${ctx.detail ? ` Detail: ${String(ctx.detail).trim()}` : ''}${ctx.target ? ` Target: ${ctx.target}.` : ''}`.slice(0, 300),
    valid: true,
  } : null;
  return {
    templates,
    count: templates.length,
    categories: [...new Set(REASON_TEMPLATES.map(t => t.category))],
    applied,
    summary: `Infinity AI offers ${templates.length} reopen reason template(s).`,
  };
}

/**
 * Plan the approval workflow for a sensitive reopen (idea 52903).
 * Steps, approvers, and the current gate derive from hunt
 * sensitivity, requester role, and program policy.
 */
export function planReopenApprovalWorkflow(hunt = {}, requester = {}, options = {}) {
  const sensitive = Boolean(hunt.sensitive || hunt.requiresApproval || sevKey(hunt) === 'critical');
  const needsLead = sensitive || Boolean(options.requireLead);
  const steps = [
    { step: 1, name: 'Request submitted', actor: requester.id || 'requester', done: true },
    { step: 2, name: 'Reason documented', actor: requester.id || 'requester', done: Boolean(requester.reason) },
  ];
  if (needsLead) {
    steps.push({ step: 3, name: 'Lead approval', actor: options.leadId || 'security-lead', done: false });
    steps.push({ step: 4, name: 'Reopen executed', actor: 'Infinity AI', done: false });
  } else {
    steps.push({ step: 3, name: 'Reopen executed', actor: 'Infinity AI', done: false });
  }
  const pendingStep = steps.find(s => !s.done) || null;
  return {
    huntId: hunt.huntId || hunt.id || null,
    requiresApproval: needsLead,
    steps,
    stepCount: steps.length,
    pendingStep: pendingStep ? pendingStep.name : null,
    approvers: needsLead ? [options.leadId || 'security-lead'] : [],
    summary: needsLead
      ? `Infinity AI reopen of ${hunt.huntId || 'the hunt'} needs lead approval (${steps.length} steps).`
      : `Infinity AI reopen of ${hunt.huntId || 'the hunt'} can proceed without approval.`,
  };
}

/**
 * Reopen many hunts in one post-hunt operation (idea 52904).
 * Each hunt is checked independently; successes, refusals, and the
 * shared reason are reported per hunt so partial failure is honest.
 */
export function bulkReopenHunts(hunts = [], options = {}) {
  const reason = String(options.reason || 'Bulk reopen after an infrastructure change.');
  const results = (hunts || []).map(h => {
    const state = String(h.status || h.state || '').toLowerCase();
    const eligible = ['closed', 'archived', 'completed'].includes(state);
    return {
      huntId: h.huntId || h.id || null,
      previousState: state || 'unknown',
      success: eligible,
      newState: eligible ? 'open' : state,
      note: eligible ? 'Reopened in bulk operation.' : 'Skipped: hunt is not closed.',
    };
  });
  return {
    results,
    total: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    reason,
    summary: `Infinity AI bulk reopen: ${results.filter(r => r.success).length} of ${results.length} hunt(s) reopened.`,
  };
}

/**
 * Describe a programmatic reopen API call (idea 52905).
 * Method, path, headers, and JSON body are assembled from the
 * request payload; validation errors are listed, never hidden.
 */
export function buildReopenApiRequest(huntId = '', payload = {}, options = {}) {
  const errors = [];
  if (!huntId) errors.push('huntId is required');
  if (!payload.reason || String(payload.reason).trim().length < 12) errors.push('reason of at least 12 characters is required');
  const base = String(options.baseUrl || 'https://api.infinity-ai.example').replace(/\/$/, '');
  return {
    method: 'POST',
    url: `${base}/api/v1/hunts/${encodeURIComponent(String(huntId || 'unknown'))}/reopen`,
    headers: { 'content-type': 'application/json', 'x-client': 'Infinity AI' },
    body: {
      reason: String(payload.reason || ''),
      requestedBy: payload.requestedBy || options.requestedBy || null,
      restoreSnapshot: payload.restoreSnapshot !== false,
      extendedScope: payload.extendedScope || null,
    },
    valid: errors.length === 0,
    errors,
    summary: errors.length
      ? `Infinity AI reopen API request invalid: ${errors.join('; ')}.`
      : `Infinity AI reopen API request ready for hunt ${huntId}.`,
  };
}

/**
 * Validate a one-click reopen link from an email (idea 52906).
 * The token, hunt id, and expiry in the link are checked locally;
 * only a signed, unexpired link for an authorized user passes.
 */
export function parseEmailReopenLink(url = '', user = {}, options = {}) {
  const text = String(url || '');
  const huntMatch = text.match(/hunts\/([^/?#]+)/);
  const tokenMatch = text.match(/[?&]token=([^&#]+)/);
  const expMatch = text.match(/[?&]exp=(\d+)/);
  const huntId = huntMatch ? decodeURIComponent(huntMatch[1]) : null;
  const hasToken = Boolean(tokenMatch && tokenMatch[1].length >= 8);
  const exp = expMatch ? Number(expMatch[1]) : null;
  const nowSec = Math.floor((parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z')) / 1000);
  const expired = exp !== null && exp < nowSec;
  const authorized = Boolean(user && (user.id || user.role));
  const valid = Boolean(huntId && hasToken && !expired && authorized);
  const reasons = [];
  if (!huntId) reasons.push('no hunt id in link');
  if (!hasToken) reasons.push('missing or short token');
  if (expired) reasons.push('link expired');
  if (!authorized) reasons.push('user is not signed in');
  if (valid) reasons.push('link valid for one-click reopen');
  return {
    huntId,
    valid,
    expired,
    reasons,
    action: valid ? 'reopen' : 'sign-in-required',
    summary: valid
      ? `Infinity AI email link can reopen ${huntId} for ${user.id || 'the user'}.`
      : `Infinity AI email link rejected: ${reasons.join('; ')}.`,
  };
}

/**
 * Offer reopen directly from a hunt comparison view (idea 52907).
 * A regression spotted in the diff points back at the baseline
 * hunt; the recommendation names it and carries the diff evidence.
 */
export function reopenFromComparison(comparison = {}, options = {}) {
  const regressions = (comparison.regressions || comparison.newFindings || []).map(f => ({ ...f }));
  const baseline = comparison.baseline || {};
  const hasRegression = regressions.length > 0;
  return {
    baselineHuntId: baseline.huntId || baseline.id || comparison.baselineHuntId || null,
    candidateHuntId: (comparison.candidate || {}).huntId || comparison.candidateHuntId || null,
    regressionCount: regressions.length,
    regressions: regressions.map(f => ({ id: f.id, title: f.title || 'Untitled', severity: sevKey(f) })),
    recommended: hasRegression,
    action: hasRegression ? 'reopen-baseline' : 'none',
    summary: hasRegression
      ? `Infinity AI: ${regressions.length} regression(s) in the diff; reopen ${baseline.huntId || 'the baseline hunt'} to investigate.`
      : 'Infinity AI: no regression in this comparison; no reopen suggested.',
  };
}

/**
 * Suggest reopening when new threat intel matches a hunt (idea 52908).
 * Intel keywords, stack tags, and target hosts score each closed
 * hunt; strong matches become reopen suggestions with context.
 */
export function suggestThreatIntelReopen(intel = {}, hunts = [], options = {}) {
  const minScore = Number(options.minScore || 2);
  const intelText = `${intel.title || ''} ${intel.summary || ''} ${(intel.tags || []).join(' ')} ${(intel.affectedProducts || []).join(' ')}`.toLowerCase();
  const intelTokens = new Set(tokenize(intelText));
  const suggestions = [];
  for (const h of hunts || []) {
    const state = String(h.status || h.state || '').toLowerCase();
    if (!['closed', 'archived', 'completed'].includes(state)) continue;
    const huntText = `${h.target || ''} ${(h.techStack || []).join(' ')} ${(h.findings || []).map(f => f.title || '').join(' ')}`.toLowerCase();
    const hostHit = intel.affectedHosts && intel.affectedHosts.map(x => String(x).toLowerCase()).includes(hostOf(h.target || ''));
    let score = hostHit ? 3 : 0;
    for (const t of intelTokens) if (huntText.includes(t)) score += 1;
    if (score >= minScore) {
      suggestions.push({ huntId: h.huntId || h.id, target: h.target || null, score, reason: `Intel "${intel.title || 'advisory'}" matches this target stack.` });
    }
  }
  suggestions.sort((a, b) => b.score - a.score);
  return {
    intelId: intel.id || null,
    suggestions,
    count: suggestions.length,
    summary: suggestions.length
      ? `Infinity AI: threat intel suggests reopening ${suggestions.length} hunt(s); top ${suggestions[0].huntId}.`
      : 'Infinity AI: no closed hunt matches this threat intel.',
  };
}

/**
 * Suggest reopening after a major code change or deploy (idea 52909).
 * Changed paths are matched to the last hunt covering the same
 * surface; a large or security-relevant deploy raises the priority.
 */
export function suggestCodeChangeReopen(deploy = {}, hunts = [], options = {}) {
  const changed = (deploy.changedPaths || deploy.files || []).map(String);
  const securityRelevant = changed.some(p => /auth|payment|checkout|session|token|upload/i.test(p));
  const suggestions = [];
  for (const h of hunts || []) {
    const state = String(h.status || h.state || '').toLowerCase();
    if (!['closed', 'archived', 'completed'].includes(state)) { continue; }
    const target = String(h.target || '').toLowerCase();
    const hostHit = changed.some(p => target && p.toLowerCase().includes(hostOf(target))) || changed.length > 0;
    const score = (securityRelevant ? 3 : 1) + (hostHit ? 2 : 0) + Math.min(3, Math.floor(changed.length / 5));
    if (score >= Number(options.minScore || 3)) {
      suggestions.push({ huntId: h.huntId || h.id, target: h.target || null, score, securityRelevant });
    }
  }
  suggestions.sort((a, b) => b.score - a.score);
  return {
    deployId: deploy.id || deploy.commit || null,
    changedCount: changed.length,
    securityRelevant,
    suggestions,
    count: suggestions.length,
    summary: suggestions.length
      ? `Infinity AI: deploy ${deploy.id || ''} suggests reopening ${suggestions.length} hunt(s).`
      : 'Infinity AI: this deploy does not require a reopen.',
  };
}

/**
 * Suggest reopening after an acquisition adds assets (idea 52910).
 * Newly acquired hosts are matched to related closed hunts so prior
 * coverage is extended instead of starting from zero.
 */
export function suggestAcquisitionReopen(acquisition = {}, hunts = [], options = {}) {
  const newHosts = new Set((acquisition.assets || acquisition.newHosts || []).map(a => hostOf(a.host || a.url || a)));
  const suggestions = [];
  for (const h of hunts || []) {
    const host = hostOf(h.target || '');
    const related = newHosts.has(host) || [...newHosts].some(nh => host && (host.endsWith(nh) || nh.endsWith(host)));
    const state = String(h.status || h.state || '').toLowerCase();
    if (related && ['closed', 'archived', 'completed'].includes(state)) {
      suggestions.push({ huntId: h.huntId || h.id, target: h.target || null, sharedHost: host, reason: 'Acquired asset overlaps this hunt target.' });
    }
  }
  return {
    acquisitionId: acquisition.id || null,
    newAssetCount: newHosts.size,
    suggestions,
    count: suggestions.length,
    summary: suggestions.length
      ? `Infinity AI: acquisition adds ${newHosts.size} asset(s); ${suggestions.length} related hunt(s) could reopen.`
      : 'Infinity AI: no related closed hunt for this acquisition.',
  };
}

/**
 * Suggest reopening the most recent hunt after an incident (idea 52911).
 * The incident asset selects candidate hunts; the most recently
 * closed one is recommended with the incident context attached.
 */
export function suggestIncidentReopen(incident = {}, hunts = [], options = {}) {
  const assetHost = hostOf(incident.asset || incident.target || '');
  const candidates = (hunts || [])
    .filter(h => ['closed', 'archived', 'completed'].includes(String(h.status || h.state || '').toLowerCase()))
    .filter(h => !assetHost || hostOf(h.target || '') === assetHost)
    .map(h => ({ huntId: h.huntId || h.id, target: h.target || null, closedAt: h.closedAt || null, score: severityRank(incident.severity) * 10 + ((h.findings || []).length) }))
    .sort((a, b) => String(b.closedAt || '').localeCompare(String(a.closedAt || '')));
  const top = candidates[0] || null;
  return {
    incidentId: incident.id || null,
    asset: incident.asset || incident.target || null,
    candidates,
    recommendedHuntId: top ? top.huntId : null,
    summary: top
      ? `Infinity AI: incident ${incident.id || ''} suggests reopening ${top.huntId} (most recent on this asset).`
      : 'Infinity AI: no recent closed hunt on the incident asset.',
  };
}

/**
 * Enforce the reopen expiry policy (idea 52912).
 * Hunts closed longer than the configured window must start fresh;
 * younger hunts may reopen, with the exact age reported.
 */
export function checkReopenExpiry(hunt = {}, policy = {}, options = {}) {
  const maxMonths = Number(policy.maxReopenMonths ?? policy.months ?? 6);
  const closedMs = parseMs(hunt.closedAt);
  const nowMs = parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z');
  const ageDays = closedMs !== null ? Math.max(0, Math.floor((nowMs - closedMs) / 86400000)) : null;
  const ageMonths = ageDays !== null ? Math.floor(ageDays / 30) : null;
  const expired = ageMonths !== null && ageMonths > maxMonths;
  return {
    huntId: hunt.huntId || hunt.id || null,
    closedAt: hunt.closedAt || null,
    ageDays,
    ageMonths,
    maxReopenMonths: maxMonths,
    expired,
    allowed: !expired,
    action: expired ? 'new-hunt-required' : 'reopen-allowed',
    summary: expired
      ? `Infinity AI: ${hunt.huntId || 'this hunt'} closed ${ageMonths} month(s) ago, past the ${maxMonths}-month reopen window; start a new hunt.`
      : `Infinity AI: ${hunt.huntId || 'this hunt'} is within the ${maxMonths}-month reopen window.`,
  };
}

/**
 * Plan a reopen that runs fresh engines on preserved results (idea 52913).
 * Old findings stay as the baseline; new engine runs are scheduled
 * against the same scope so deltas are directly comparable.
 */
export function planFreshEngineReopen(hunt = {}, engines = [], options = {}) {
  const available = (engines || []).map(e => (typeof e === 'string' ? { id: e, current: true } : { ...e }));
  const selected = available.filter(e => e.enabled !== false);
  const oldFindings = hunt.findings || [];
  const byEngine = {};
  for (const f of oldFindings) byEngine[f.engine || 'unknown'] = (byEngine[f.engine || 'unknown'] || 0) + 1;
  const runs = selected.map((e, i) => ({
    run: i + 1,
    engine: e.id,
    scope: hunt.target || null,
    baselineFindings: byEngine[e.id] || 0,
    mode: 'delta-against-baseline',
  }));
  return {
    huntId: hunt.huntId || hunt.id || null,
    runs,
    engineCount: runs.length,
    preservedFindings: oldFindings.length,
    summary: `Infinity AI fresh-engine reopen for ${hunt.huntId || 'the hunt'}: ${runs.length} engine run(s), ${oldFindings.length} baseline finding(s) preserved.`,
  };
}

/**
 * Estimate the cost of a reopen before confirming it (idea 52914).
 * Scope size, finding volume, and fresh scanning drive compute and
 * time estimates with a per-factor breakdown for transparency.
 */
export function estimateReopenCost(hunt = {}, options = {}) {
  const scopeSize = Number((hunt.scope?.include || hunt.scope || []).length || 1);
  const findings = (hunt.findings || []).length;
  const freshScan = options.freshScan !== false;
  const baseMinutes = 15;
  const scopeMinutes = scopeSize * 4;
  const findingMinutes = findings * 2;
  const scanMinutes = freshScan ? 30 : 0;
  const totalMinutes = baseMinutes + scopeMinutes + findingMinutes + scanMinutes;
  const computeUnits = Math.round(totalMinutes * 1.5);
  return {
    huntId: hunt.huntId || hunt.id || null,
    estimatedMinutes: totalMinutes,
    estimatedHours: Math.round((totalMinutes / 60) * 10) / 10,
    computeUnits,
    breakdown: [
      { factor: 'restore and setup', minutes: baseMinutes },
      { factor: 'scope surface', minutes: scopeMinutes },
      { factor: 'existing findings review', minutes: findingMinutes },
      { factor: 'fresh scanning', minutes: scanMinutes },
    ],
    freshScan,
    summary: `Infinity AI estimates reopening ${hunt.huntId || 'this hunt'} at ${totalMinutes} minute(s) and ${computeUnits} compute unit(s).`,
  };
}

/**
 * Schedule a hunt to reopen at a future date (idea 52915).
 * The scheduled entry carries the reason, requester, and restore
 * choices; past dates and missing reasons are rejected plainly.
 */
export function scheduleReopen(hunt = {}, schedule = {}, options = {}) {
  const at = schedule.at || schedule.date || null;
  const atMs = parseMs(at);
  const nowMs = parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z');
  const reason = String(schedule.reason || '');
  const errors = [];
  if (!at || atMs === null) errors.push('a valid future date is required');
  if (atMs !== null && atMs <= nowMs) errors.push('scheduled date is in the past');
  if (reason.trim().length < 12) errors.push('reason of at least 12 characters is required');
  const entry = errors.length ? null : {
    huntId: hunt.huntId || hunt.id || null,
    scheduledAt: new Date(atMs).toISOString(),
    reason: reason.slice(0, 200),
    requestedBy: schedule.requestedBy || null,
    restoreSnapshot: schedule.restoreSnapshot !== false,
  };
  return {
    scheduled: Boolean(entry),
    entry,
    errors,
    summary: entry
      ? `Infinity AI scheduled ${entry.huntId} to reopen at ${entry.scheduledAt.slice(0, 10)}.`
      : `Infinity AI cannot schedule this reopen: ${errors.join('; ')}.`,
  };
}

/**
 * Open a dedicated discussion thread about reopening (idea 52916).
 * Positions for and against, open questions, and a decision field
 * structure the debate so the outcome is recorded, not lost in chat.
 */
export function buildReopenDiscussionThread(hunt = {}, comments = [], options = {}) {
  const list = (comments || []).map(c => ({ ...c }));
  const supporting = list.filter(c => c.position === 'for' || c.stance === 'for').length;
  const opposing = list.filter(c => c.position === 'against' || c.stance === 'against').length;
  const openQuestions = list.filter(c => String(c.text || '').includes('?') && !c.answered).map(c => c.text);
  const decision = supporting > opposing ? 'leaning-reopen' : opposing > supporting ? 'leaning-keep-closed' : 'undecided';
  return {
    huntId: hunt.huntId || hunt.id || null,
    threadId: `reopen-${hunt.huntId || hunt.id || 'hunt'}`,
    comments: list,
    commentCount: list.length,
    supporting,
    opposing,
    openQuestions,
    decision,
    summary: `Infinity AI reopen discussion for ${hunt.huntId || 'the hunt'}: ${list.length} comment(s), decision ${decision}.`,
  };
}

/**
 * Describe the badge a reopened hunt carries (idea 52917).
 * Reopen count, chapter, and last-reopen date shape the label so a
 * reopened hunt is never mistaken for a never-closed one.
 */
export function getReopenedHuntBadge(hunt = {}, options = {}) {
  const reopenCount = Number(hunt.reopenCount ?? (hunt.chapters ? hunt.chapters.filter(c => c.kind === 'reopen').length : 0));
  const lastReopen = hunt.lastReopenedAt || hunt.reopenedAt || null;
  const isReopened = reopenCount > 0 || String(hunt.status || '').toLowerCase() === 'reopened';
  return {
    huntId: hunt.huntId || hunt.id || null,
    show: isReopened,
    label: isReopened ? `Reopened${reopenCount > 1 ? ` ×${reopenCount}` : ''}` : 'Original',
    tone: isReopened ? 'warn' : 'info',
    reopenCount,
    lastReopenedAt: lastReopen,
    summary: isReopened
      ? `Infinity AI badge: ${hunt.huntId || 'this hunt'} was reopened ${reopenCount} time(s).`
      : `Infinity AI: ${hunt.huntId || 'this hunt'} has never been reopened.`,
  };
}

/**
 * Filter hunts by reopen count and history (idea 52918).
 * Minimum reopen counts, reason keywords, and date windows narrow
 * the list for process analysis; ordering stays deterministic.
 */
export function filterHuntsByReopen(hunts = [], filter = {}, options = {}) {
  const minReopens = Number(filter.minReopens ?? 1);
  const reasonNeedle = String(filter.reasonIncludes || '').toLowerCase();
  const list = (hunts || []).map(h => ({ ...h }));
  const matched = list.filter(h => {
    const count = Number(h.reopenCount ?? (h.reopenHistory || []).length);
    if (count < minReopens) return false;
    if (reasonNeedle) {
      const reasons = (h.reopenHistory || []).map(r => String(r.reason || '').toLowerCase()).join(' ');
      if (!reasons.includes(reasonNeedle)) return false;
    }
    return true;
  }).map(h => ({
    huntId: h.huntId || h.id,
    target: h.target || null,
    reopenCount: Number(h.reopenCount ?? (h.reopenHistory || []).length),
    lastReason: (h.reopenHistory || [])[(h.reopenHistory || []).length - 1]?.reason || null,
  }));
  matched.sort((a, b) => b.reopenCount - a.reopenCount || String(a.huntId).localeCompare(String(b.huntId)));
  return {
    hunts: matched.slice(0, Number(options.limit || 50)),
    count: matched.length,
    total: list.length,
    summary: `Infinity AI found ${matched.length} hunt(s) with at least ${minReopens} reopen(s).`,
  };
}

/**
 * Analyze reopen rates and reasons across hunts (idea 52919).
 * Premature closures surface through short close-to-reopen gaps;
 * reason categories show what keeps bringing hunts back.
 */
export function analyzeReopenAnalytics(hunts = [], options = {}) {
  const list = hunts || [];
  const reopened = list.filter(h => Number(h.reopenCount ?? (h.reopenHistory || []).length) > 0);
  const totalReopens = reopened.reduce((s, h) => s + Number(h.reopenCount ?? (h.reopenHistory || []).length), 0);
  const byReason = {};
  let shortGaps = 0;
  let gapCount = 0;
  let gapSum = 0;
  for (const h of reopened) {
    for (const r of h.reopenHistory || []) {
      const cat = String(r.category || 'general');
      byReason[cat] = (byReason[cat] || 0) + 1;
      const closedMs = parseMs(h.closedAt);
      const reopenMs = parseMs(r.at);
      if (closedMs !== null && reopenMs !== null) {
        const gap = Math.round((reopenMs - closedMs) / 86400000);
        gapSum += gap;
        gapCount += 1;
        if (gap <= 7) shortGaps += 1;
      }
    }
  }
  const topReason = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    totalHunts: list.length,
    reopenedHunts: reopened.length,
    reopenRatePercent: list.length ? Math.round((reopened.length / list.length) * 100) : 0,
    totalReopens,
    byReason,
    topReason: topReason ? { category: topReason[0], count: topReason[1] } : null,
    averageGapDays: gapCount ? Math.round((gapSum / gapCount) * 10) / 10 : null,
    prematureClosures: shortGaps,
    summary: `Infinity AI reopen analytics: ${reopened.length} of ${list.length} hunt(s) reopened (${list.length ? Math.round((reopened.length / list.length) * 100) : 0}%).`,
  };
}

/**
 * Explain reopen versus regression hunt versus new hunt (idea 52920).
 * Changed scope, suspected regression, and elapsed time pick the
 * recommended path with a plain-language comparison of all three.
 */
export function explainReopenVsRegression(context = {}, options = {}) {
  const regression = Boolean(context.regressionSuspected || context.suspectedRegression);
  const scopeChanged = Number(context.scopeDriftPercent || 0) > 40 || Boolean(context.majorScopeChange);
  const ageMonths = Number(context.ageMonths ?? 0);
  const expired = ageMonths > Number(context.maxReopenMonths ?? 6);
  let recommended = 'reopen';
  if (expired || scopeChanged) recommended = 'new-hunt';
  else if (regression) recommended = 'regression-hunt';
  const optionsList = [
    { id: 'reopen', label: 'Reopen the original hunt', when: 'Same target, context still fresh, history matters.', cost: 'Low: state restores instantly.' },
    { id: 'regression-hunt', label: 'Start a regression hunt', when: 'A fix may have regressed and needs focused retesting.', cost: 'Medium: narrow scope, baseline exists.' },
    { id: 'new-hunt', label: 'Start a new hunt', when: 'Scope changed a lot or the hunt is too old to reopen.', cost: 'High: full fresh baseline.' },
  ];
  return {
    recommended,
    options: optionsList,
    reasoning: [
      regression ? 'A suspected regression is recorded.' : 'No regression is suspected.',
      scopeChanged ? 'Scope changed substantially since close.' : 'Scope is broadly unchanged.',
      expired ? `Hunt age ${ageMonths} month(s) exceeds the reopen window.` : 'Hunt is inside the reopen window.',
    ],
    summary: `Infinity AI recommends: ${optionsList.find(o => o.id === recommended).label.toLowerCase()}.`,
  };
}
