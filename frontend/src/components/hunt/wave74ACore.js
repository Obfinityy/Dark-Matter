/**
 * wave74ACore.js — Infinity AI · Dark-Matter · Wave 74A
 * Post-hunt reopen restoration and continuity, ideas 52921–52940.
 * Pure logic for share and schedule restoration, ticket links,
 * stakeholder views, Q&A context, agent briefings, asset-change
 * suggestions, reminders, digests, mobile reopen, triage and SLA
 * continuity, audit exports, compliance notes, guards, conflicts,
 * platform, dispute and appeal flows, and reopen templates.
 * Every helper takes explicit inputs, returns a structured view
 * model, and never mutates its arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE74_A_IDEAS = [
  { id: 52921, title: 'Share-restoration on reopen', skip: false },
  { id: 52922, title: 'Schedule-restoration on reopen', skip: false },
  { id: 52923, title: 'Ticket-link preservation', skip: false },
  { id: 52924, title: 'Stakeholder-view refresh', skip: false },
  { id: 52925, title: 'Q&A context restoration', skip: false },
  { id: 52926, title: 'Agent briefing on reopen', skip: false },
  { id: 52927, title: 'Auto-suggest reopen on asset change', skip: false },
  { id: 52928, title: 'Reopen reminders', skip: false },
  { id: 52929, title: 'Reopen digest', skip: false },
  { id: 52930, title: 'Mobile reopen', skip: false },
  { id: 52931, title: 'Triage-decision preservation', skip: false },
  { id: 52932, title: 'SLA reset option on reopen', skip: false },
  { id: 52933, title: 'Close-reopen history export', skip: false },
  { id: 52934, title: 'Compliance note on reopen', skip: false },
  { id: 52935, title: 'Duplicate-reopen guard', skip: false },
  { id: 52936, title: 'Reopen conflict resolution', skip: false },
  { id: 52937, title: 'Platform-status reopen', skip: false },
  { id: 52938, title: 'FP-dispute reopen', skip: false },
  { id: 52939, title: 'Researcher-appeal reopen', skip: false },
  { id: 52940, title: 'Reopen templates', skip: false },
];

function parseMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isNaN(ms) ? null : ms;
}
function slug(text) {
  return String(text || 'hunt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'hunt';
}
function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}
function hostOf(value) {
  const m = String(value || '').match(/^(?:[a-z]+:\/\/)?([^/:?#]+)/i);
  return m ? m[1].toLowerCase() : '';
}

/**
 * Reactivate share links when their hunt reopens (idea 52921).
 * Expired or revoked links stay blocked unless the caller explicitly
 * allows revival; active links are carried forward untouched.
 */
export function restoreShareLinksOnReopen(hunt = {}, shareLinks = [], options = {}) {
  const nowMs = parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z');
  const allowRevival = options.allowRevival === true;
  const links = (shareLinks || []).map(l => ({ ...l }));
  const restored = [];
  const blocked = [];
  for (const link of links) {
    const expiresMs = parseMs(link.expiresAt);
    const expired = expiresMs !== null && expiresMs < nowMs;
    const revoked = Boolean(link.revoked);
    if (revoked && !allowRevival) {
      blocked.push({ id: link.id || null, url: link.url || null, why: 'revoked' });
    } else if (expired && !allowRevival) {
      blocked.push({ id: link.id || null, url: link.url || null, why: 'expired' });
    } else {
      restored.push({ id: link.id || null, url: link.url || null, permission: link.permission || 'view', reactivated: expired || revoked });
    }
  }
  return {
    huntId: hunt.huntId || hunt.id || null,
    restored,
    blocked,
    restoredCount: restored.length,
    blockedCount: blocked.length,
    summary: `Infinity AI restored ${restored.length} share link(s) for ${hunt.huntId || 'the hunt'}; ${blocked.length} stayed blocked.`,
  };
}

/**
 * Resume paused regression schedules on reopen (idea 52922).
 * Schedules whose hunt reopened move back to active with the next
 * run computed; other hunts' schedules are left alone.
 */
export function restoreSchedulesOnReopen(hunt = {}, schedules = [], options = {}) {
  const huntId = hunt.huntId || hunt.id || null;
  const list = (schedules || []).map(s => ({ ...s }));
  const resumed = [];
  const skipped = [];
  for (const s of list) {
    const belongs = s.huntId === huntId || s.huntId === undefined;
    const paused = s.status === 'paused' || s.paused === true;
    if (belongs && paused) {
      resumed.push({ id: s.id || null, cadence: s.cadence || 'weekly', nextRunAt: s.nextRunAt || options.nextRunAt || '2026-10-16T09:00:00Z', status: 'active' });
    } else {
      skipped.push({ id: s.id || null, why: !belongs ? 'different hunt' : 'not paused' });
    }
  }
  return {
    huntId,
    resumed,
    skipped,
    resumedCount: resumed.length,
    summary: `Infinity AI resumed ${resumed.length} schedule(s) for ${huntId || 'the hunt'}.`,
  };
}

/**
 * Preserve tracker links across a reopen (idea 52923).
 * Every Jira or Linear link is carried forward intact and the
 * reopen is noted on the ticket side as a comment draft.
 */
export function preserveTicketLinks(hunt = {}, tickets = [], options = {}) {
  const links = (tickets || hunt.ticketLinks || []).map(t => ({ ...t }));
  const preserved = links.map(t => ({
    id: t.id || t.key || null,
    system: t.system || (String(t.url || '').includes('linear') ? 'linear' : 'jira'),
    url: t.url || null,
    note: `Infinity AI: hunt ${hunt.huntId || 'hunt'} reopened. Reason: ${String(options.reason || 'reopen').slice(0, 60)}`,
  }));
  return {
    huntId: hunt.huntId || hunt.id || null,
    links: preserved,
    preservedCount: preserved.length,
    intact: preserved.every(l => Boolean(l.url)),
    summary: `Infinity AI preserved ${preserved.length} ticket link(s) for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Refresh stakeholder views after a reopen (idea 52924).
 * Leadership, engineering, and customer views are recomputed from
 * the reopened state so every audience sees the same facts.
 */
export function refreshStakeholderViews(hunt = {}, views = [], options = {}) {
  const state = String(hunt.status || hunt.state || 'open').toLowerCase();
  const findingCount = (hunt.findings || []).length;
  const bySev = {};
  for (const f of hunt.findings || []) bySev[String(f.severity || 'info').toLowerCase()] = (bySev[String(f.severity || 'info').toLowerCase()] || 0) + 1;
  const refreshed = (views || []).map(v => ({
    id: v.id || v.name || 'view',
    audience: v.audience || 'team',
    huntState: state,
    findingCount,
    reopened: state === 'open' && Boolean(hunt.reopenedAt || options.reopenedAt),
    updatedAt: options.now || '2026-10-09T00:00:00Z',
  }));
  if (!refreshed.length) {
    refreshed.push(
      { id: 'leadership', audience: 'leadership', huntState: state, findingCount, reopened: true, updatedAt: options.now || '2026-10-09T00:00:00Z' },
      { id: 'engineering', audience: 'engineering', huntState: state, findingCount, reopened: true, updatedAt: options.now || '2026-10-09T00:00:00Z' },
    );
  }
  return {
    huntId: hunt.huntId || hunt.id || null,
    views: refreshed,
    viewCount: refreshed.length,
    bySeverity: bySev,
    summary: `Infinity AI refreshed ${refreshed.length} stakeholder view(s) for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Restore prior Q&A threads with the reopened hunt (idea 52925).
 * Threads reload in order with their finding links intact so the
 * reopened review starts where the last conversation ended.
 */
export function restoreQaContext(hunt = {}, threads = [], options = {}) {
  const list = (threads || hunt.qaHistory || hunt.qa || []).map(t => ({ ...t, entries: [...((t.entries) || [])] }));
  const flat = list.flatMap(t => (t.entries && t.entries.length ? t.entries : [t]));
  const findingIds = [...new Set(flat.map(e => e.findingId).filter(Boolean).map(String))];
  const entryCount = flat.length;
  return {
    huntId: hunt.huntId || hunt.id || null,
    threads: list,
    entryCount,
    findingIds,
    restored: entryCount > 0,
    summary: `Infinity AI restored ${entryCount} Q&A exchange(s) across ${findingIds.length} finding(s) for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Brief reviewers on what changed since close (idea 52926).
 * Scope, stack, and finding deltas between the snapshot and the
 * current record become a short orientation briefing.
 */
export function briefOnReopen(hunt = {}, snapshot = {}, options = {}) {
  const before = snapshot.findings || [];
  const after = hunt.findings || [];
  const beforeIds = new Set(before.map(f => String(f.id)));
  const afterIds = new Set(after.map(f => String(f.id)));
  const added = after.filter(f => !beforeIds.has(String(f.id))).map(f => ({ id: f.id, title: f.title || 'Untitled' }));
  const removed = before.filter(f => !afterIds.has(String(f.id))).map(f => ({ id: f.id, title: f.title || 'Untitled' }));
  const closedMs = parseMs(snapshot.closedAt || hunt.closedAt);
  const nowMs = parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z');
  const awayDays = closedMs !== null ? Math.max(0, Math.round((nowMs - closedMs) / 86400000)) : null;
  const bullets = [
    added.length ? `${added.length} finding(s) appeared since close.` : 'No new findings since close.',
    removed.length ? `${removed.length} finding(s) left the record since close.` : 'No findings removed since close.',
    awayDays !== null ? `Hunt was closed for ${awayDays} day(s).` : 'Close date not recorded.',
  ];
  return {
    huntId: hunt.huntId || hunt.id || null,
    added,
    removed,
    addedCount: added.length,
    removedCount: removed.length,
    awayDays,
    bullets,
    summary: `Infinity AI briefing for ${hunt.huntId || 'the hunt'}: ${bullets[0]}`,
  };
}

/**
 * Suggest a reopen when the asset stack changes (idea 52927).
 * Detected technology changes are matched against the closed hunt's
 * coverage; material changes produce a scored suggestion.
 */
export function suggestReopenOnAssetChange(asset = {}, hunt = {}, options = {}) {
  const before = new Set((asset.beforeStack || hunt.techStack || []).map(s => String(s).toLowerCase()));
  const after = new Set((asset.afterStack || asset.techStack || []).map(s => String(s).toLowerCase()));
  const addedStack = [...after].filter(s => !before.has(s));
  const removedStack = [...before].filter(s => !after.has(s));
  const securitySurface = addedStack.some(s => /auth|pay|checkout|session|oauth|stripe|upload/i.test(s));
  const score = addedStack.length * 2 + (securitySurface ? 3 : 0);
  const suggest = String(hunt.status || hunt.state || '').toLowerCase() !== 'open' && score >= Number(options.minScore || 2);
  return {
    huntId: hunt.huntId || hunt.id || null,
    target: hunt.target || asset.target || null,
    addedStack,
    removedStack,
    score,
    suggest,
    summary: suggest
      ? `Infinity AI suggests reopening ${hunt.huntId || 'the hunt'}: stack gained ${addedStack.join(', ') || 'new surface'}.`
      : `Infinity AI: no reopen needed for ${hunt.huntId || 'this asset'} yet.`,
  };
}

/**
 * Remind owners when a deferred reopen comes due (idea 52928).
 * Hunts marked to reopen after a release produce a reminder once
 * their date arrives; future marks stay quiet.
 */
export function buildReopenReminders(hunts = [], options = {}) {
  const nowMs = parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z');
  const reminders = [];
  for (const h of hunts || []) {
    const dueMs = parseMs(h.reopenAfter || h.reopenAt || h.remindAt);
    if (dueMs === null || dueMs > nowMs) continue;
    reminders.push({
      huntId: h.huntId || h.id || null,
      owner: h.owner || null,
      dueAt: new Date(dueMs).toISOString(),
      target: h.target || null,
      message: `Infinity AI reminder: ${h.huntId || 'a hunt'} was marked to reopen after release and is now due.`,
    });
  }
  reminders.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  return {
    reminders,
    count: reminders.length,
    summary: reminders.length
      ? `Infinity AI has ${reminders.length} reopen reminder(s) due.`
      : 'Infinity AI: no reopen reminders are due.',
  };
}

/**
 * Build the leadership digest of recent reopens (idea 52929).
 * Reopened hunts in the window are listed with reasons and reopen
 * counts so leadership sees the pattern at a glance.
 */
export function buildReopenDigest(hunts = [], options = {}) {
  const nowMs = parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z');
  const windowDays = Number(options.windowDays || 7);
  const entries = [];
  for (const h of hunts || []) {
    const lastMs = parseMs(h.lastReopenedAt || h.reopenedAt);
    if (lastMs === null) continue;
    const ageDays = Math.floor((nowMs - lastMs) / 86400000);
    if (ageDays < 0 || ageDays > windowDays) continue;
    const history = h.reopenHistory || [];
    entries.push({
      huntId: h.huntId || h.id || null,
      target: h.target || null,
      reopenCount: Number(h.reopenCount ?? history.length),
      lastReason: history.length ? history[history.length - 1].reason || null : null,
      ageDays,
    });
  }
  entries.sort((a, b) => a.ageDays - b.ageDays || String(a.huntId).localeCompare(String(b.huntId)));
  return {
    entries,
    count: entries.length,
    windowDays,
    summary: `Infinity AI digest: ${entries.length} hunt(s) reopened in the last ${windowDays} day(s).`,
  };
}

/**
 * Plan a reopen from the mobile app (idea 52930).
 * Reason validation, approval need, and step order are computed
 * for the small-screen flow before anything is submitted.
 */
export function planMobileReopen(hunt = {}, request = {}, options = {}) {
  const reason = String(request.reason || '').trim();
  const reasonValid = reason.length >= 12;
  const sensitive = Boolean(hunt.sensitive || hunt.requiresApproval);
  const needsApproval = sensitive && String(request.role || '').toLowerCase() !== 'lead' && String(request.role || '').toLowerCase() !== 'admin';
  const steps = [
    { step: 1, name: 'Confirm hunt', done: Boolean(hunt.huntId || hunt.id) },
    { step: 2, name: 'Enter reason', done: reasonValid },
    { step: 3, name: needsApproval ? 'Request lead approval' : 'Submit reopen', done: false },
  ];
  return {
    huntId: hunt.huntId || hunt.id || null,
    channel: 'mobile',
    reasonValid,
    needsApproval,
    steps,
    ready: reasonValid,
    summary: reasonValid
      ? `Infinity AI mobile reopen for ${hunt.huntId || 'the hunt'} is ready${needsApproval ? ' with lead approval' : ''}.`
      : 'Infinity AI mobile reopen needs a reason of at least 12 characters.',
  };
}

/**
 * Carry triage decisions through a reopen untouched (idea 52931).
 * Prior accept and false-positive calls are copied forward with
 * their authors and timestamps; nothing is re-decided implicitly.
 */
export function preserveTriageDecisions(hunt = {}, decisions = [], options = {}) {
  const source = decisions.length ? decisions : (hunt.decisions || hunt.triageDecisions || []);
  const kept = (source || []).map(d => ({ ...d }));
  const byDecision = {};
  for (const d of kept) byDecision[String(d.decision || 'open').toLowerCase()] = (byDecision[String(d.decision || 'open').toLowerCase()] || 0) + 1;
  return {
    huntId: hunt.huntId || hunt.id || null,
    decisions: kept,
    decisionCount: kept.length,
    byDecision,
    untouched: true,
    summary: `Infinity AI preserved ${kept.length} triage decision(s) for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Decide SLA handling for a reopen (idea 52932).
 * The chosen mode either restarts the clocks or keeps the original
 * ones; the resulting deadlines are stated explicitly.
 */
export function planSlaOnReopen(hunt = {}, choice = {}, options = {}) {
  const mode = String(choice.mode || options.mode || 'continue').toLowerCase();
  const nowIso = options.now || '2026-10-09T00:00:00Z';
  const nowMs = parseMs(nowIso) || Date.parse('2026-10-09T00:00:00Z');
  const triageHours = Number(choice.triageHours || hunt.sla?.triageHours || 24);
  const fixHours = Number(choice.fixHours || hunt.sla?.fixHours || 120);
  const restart = mode === 'reset' || mode === 'restart';
  const triageDue = restart
    ? new Date(nowMs + triageHours * 3600000).toISOString()
    : (hunt.sla?.triageDue || hunt.triageDue || 'not recorded');
  const fixDue = restart
    ? new Date(nowMs + fixHours * 3600000).toISOString()
    : (hunt.sla?.fixDue || hunt.fixDue || 'not recorded');
  return {
    huntId: hunt.huntId || hunt.id || null,
    mode: restart ? 'reset' : 'continue',
    triageDue,
    fixDue,
    triageHours,
    fixHours,
    summary: restart
      ? `Infinity AI will reset SLAs for ${hunt.huntId || 'the hunt'} (triage ${triageHours}h, fix ${fixHours}h).`
      : `Infinity AI keeps the original SLAs for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Export the full close and reopen timeline (idea 52933).
 * Chapters and audit events merge into one ordered history in
 * Markdown or plain text for external review.
 */
export function exportCloseReopenHistory(hunt = {}, options = {}) {
  const format = String(options.format || 'markdown').toLowerCase();
  const chapters = hunt.chapters || [];
  const history = hunt.reopenHistory || [];
  const events = [];
  for (const c of chapters) events.push({ at: c.openedAt || '', kind: c.kind === 'reopen' ? 'reopen' : 'open', note: `chapter ${c.number}` });
  for (const c of chapters) if (c.closedAt) events.push({ at: c.closedAt, kind: 'close', note: `chapter ${c.number} closed` });
  for (const r of history) events.push({ at: r.at || '', kind: 'reopen', note: String(r.reason || '').slice(0, 80) });
  events.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const lines = format === 'markdown'
    ? [`# Close-reopen history — ${hunt.huntId || 'hunt'}`, '', `Exported by Infinity AI · ${events.length} event(s)`, '', ...events.map(e => `- ${e.at || 'undated'} — ${e.kind}: ${e.note}`)]
    : [`Close-reopen history — ${hunt.huntId || 'hunt'}`, ...events.map(e => `${e.at || 'undated'} ${e.kind} ${e.note}`)];
  const content = lines.join('\n');
  return {
    huntId: hunt.huntId || hunt.id || null,
    format: format === 'markdown' ? 'markdown' : 'text',
    filename: `${slug(hunt.huntId || 'hunt')}-history.${format === 'markdown' ? 'md' : 'txt'}`,
    events,
    eventCount: events.length,
    content,
    summary: `Infinity AI exported ${events.length} history event(s) for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Write the compliance note for a reopen (idea 52934).
 * Continued due diligence is documented with scope, reason, and
 * the controls that remain in force after reopening.
 */
export function buildComplianceNoteOnReopen(hunt = {}, reopenEvent = {}, options = {}) {
  const reason = String(reopenEvent.reason || options.reason || '').slice(0, 200);
  const record = {
    huntId: hunt.huntId || hunt.id || null,
    target: hunt.target || null,
    reopenedAt: reopenEvent.at || options.now || '2026-10-09T00:00:00Z',
    reopenedBy: reopenEvent.actor || reopenEvent.requestedBy || 'unknown',
    reason,
    controls: ['scope limits enforced', 'audit log appended', 'stakeholders notified'],
    statement: `Infinity AI reopened ${hunt.huntId || 'this hunt'} to continue due diligence. Reason: ${reason || 'not recorded'}.`,
  };
  return {
    ...record,
    complianceReady: Boolean(reason && record.reopenedBy !== 'unknown'),
    summary: `Infinity AI compliance note ready for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Block duplicate reopens (idea 52935).
 * An already-open hunt or a pending request produces a warning
 * with the existing request named instead of a second reopen.
 */
export function checkDuplicateReopen(hunt = {}, pending = [], options = {}) {
  const state = String(hunt.status || hunt.state || '').toLowerCase();
  const alreadyOpen = state === 'open' || state === 'reopened';
  const list = (pending || []).map(p => ({ ...p }));
  const pendingForHunt = list.filter(p => (p.huntId || p.id) === (hunt.huntId || hunt.id));
  const duplicate = alreadyOpen || pendingForHunt.length > 0;
  return {
    huntId: hunt.huntId || hunt.id || null,
    state: state || 'unknown',
    alreadyOpen,
    pendingCount: pendingForHunt.length,
    duplicate,
    warning: duplicate
      ? `Infinity AI: ${hunt.huntId || 'this hunt'} is already open or has a pending reopen; a second reopen is blocked.`
      : null,
    summary: duplicate
      ? `Infinity AI blocked a duplicate reopen for ${hunt.huntId || 'the hunt'}.`
      : `Infinity AI: no duplicate reopen for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Merge simultaneous reopen requests (idea 52936).
 * Competing requests for one hunt collapse into a single record
 * that keeps every requester and the strongest reason.
 */
export function resolveReopenConflicts(requests = [], options = {}) {
  const list = (requests || []).map(r => ({ ...r }));
  const byHunt = {};
  for (const r of list) {
    const key = String(r.huntId || r.id || 'unknown');
    if (!byHunt[key]) byHunt[key] = [];
    byHunt[key].push(r);
  }
  const merged = Object.entries(byHunt).map(([huntId, group]) => {
    const best = [...group].sort((a, b) => String(b.reason || '').length - String(a.reason || '').length || String(a.at || '').localeCompare(String(b.at || '')))[0];
    return {
      huntId,
      requesters: [...new Set(group.map(r => r.requestedBy || r.actor).filter(Boolean))],
      reason: String(best.reason || '').slice(0, 200),
      mergedFrom: group.length,
      conflict: group.length > 1,
    };
  });
  merged.sort((a, b) => String(a.huntId).localeCompare(String(b.huntId)));
  return {
    merged,
    conflictCount: merged.filter(m => m.conflict).length,
    totalRequests: list.length,
    summary: `Infinity AI merged ${list.length} reopen request(s) into ${merged.length} record(s).`,
  };
}

/**
 * Trigger a reopen from a platform status change (idea 52937).
 * A bounty platform reopening a report maps to the hunt reopen
 * flow with the platform reason attached.
 */
export function handlePlatformStatusReopen(platformEvent = {}, hunt = {}, options = {}) {
  const status = String(platformEvent.status || platformEvent.reportStatus || '').toLowerCase();
  const triggers = status.includes('reopen') || status === 'needs-more-info' || status === 'informative';
  return {
    huntId: hunt.huntId || hunt.id || null,
    platform: platformEvent.platform || 'bounty-platform',
    reportId: platformEvent.reportId || platformEvent.id || null,
    platformStatus: status || 'unknown',
    triggersReopen: triggers,
    action: triggers ? 'start-reopen-flow' : 'no-action',
    reason: triggers ? `Platform report ${platformEvent.reportId || ''} moved to ${status}; hunt review reopens.` : 'Platform status does not require a reopen.',
    summary: triggers
      ? `Infinity AI will reopen ${hunt.huntId || 'the hunt'} from the platform update.`
      : 'Infinity AI: platform update needs no reopen.',
  };
}

/**
 * Reopen a finding after a false-positive dispute (idea 52938).
 * A successful dispute flips the finding back to open inside its
 * hunt and records the evidence that won the argument.
 */
export function reopenFindingOnFpDispute(dispute = {}, hunt = {}, options = {}) {
  const successful = dispute.outcome === 'upheld' || dispute.successful === true || dispute.status === 'won';
  const findingId = dispute.findingId || null;
  const findings = (hunt.findings || []).map(f => ({ ...f }));
  const target = findings.find(f => String(f.id) === String(findingId));
  return {
    huntId: hunt.huntId || hunt.id || null,
    findingId,
    successful,
    findingStatus: successful && target ? 'reopened' : (target ? target.status || 'unchanged' : 'not-found'),
    evidence: String(dispute.evidence || dispute.note || '').slice(0, 200),
    action: successful ? 'reopen-finding' : 'keep-decision',
    summary: successful
      ? `Infinity AI reopened finding ${findingId || ''} in ${hunt.huntId || 'the hunt'} after the dispute.`
      : 'Infinity AI: the dispute did not succeed; the decision stands.',
  };
}

/**
 * Route a researcher appeal into a reopen review (idea 52939).
 * Grounds, evidence, and prior decisions shape the review queue
 * entry so the appeal is judged on its merits.
 */
export function routeResearcherAppeal(appeal = {}, hunt = {}, options = {}) {
  const grounds = tokenize(`${appeal.grounds || ''} ${appeal.text || ''}`);
  const hasEvidence = Boolean(appeal.evidence || (appeal.attachments || []).length);
  const complete = grounds.length >= 2 && hasEvidence;
  const queue = complete ? 'reopen-review' : 'needs-more-info';
  return {
    huntId: hunt.huntId || hunt.id || null,
    appealId: appeal.id || null,
    researcher: appeal.researcher || appeal.from || 'researcher',
    grounds: String(appeal.grounds || '').slice(0, 160),
    hasEvidence,
    complete,
    queue,
    summary: complete
      ? `Infinity AI routed appeal ${appeal.id || ''} for ${hunt.huntId || 'the hunt'} to reopen review.`
      : 'Infinity AI: the appeal needs stronger grounds or evidence before review.',
  };
}

/**
 * List and apply saved reopen templates (idea 52940).
 * Templates bundle scope extensions, engine choices, and
 * notification preferences for one-click consistent reopens.
 */
export function listReopenTemplates(options = {}) {
  const catalog = [
    { id: 'regression-quick', label: 'Regression quick reopen', scopeExtension: [], engines: ['vuln-scan'], notify: ['owner', 'watchers'] },
    { id: 'intel-deep', label: 'Threat-intel deep reopen', scopeExtension: ['api subdomain'], engines: ['recon', 'vuln-scan'], notify: ['owner', 'security-lead'] },
    { id: 'scope-grow', label: 'Scope-growth reopen', scopeExtension: ['new subdomain'], engines: ['recon', 'vuln-scan', 'secret-scan'], notify: ['owner', 'watchers', 'stakeholders'] },
  ];
  const picked = options.templateId ? catalog.find(t => t.id === String(options.templateId).toLowerCase()) || catalog[0] : null;
  const ctx = options.context || {};
  const applied = picked ? {
    templateId: picked.id,
    label: picked.label,
    scope: [...(ctx.baseScope || []), ...picked.scopeExtension],
    engines: [...picked.engines],
    notify: [...picked.notify],
  } : null;
  return {
    templates: catalog.map(t => ({ ...t })),
    count: catalog.length,
    applied,
    summary: `Infinity AI offers ${catalog.length} reopen template(s).`,
  };
}
