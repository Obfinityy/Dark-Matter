/**
 * huntDiffCore.js — Infinity AI · Dark-Matter · Wave 62 (ideas 52461–52480)
 * Pure JS (no React / DOM / network). Deterministic hunt comparison and
 * post-hunt operations: regression scope-diff previews, auto-archive rules,
 * comparison dashboards, "all clear" certificates, schedule-via-API/chat,
 * reminders, digest emails, multi-target campaigns, PR linking for fixes,
 * fix diff viewing, verification evidence, "verified fixed" badges, fix SLAs,
 * breach alerts, remediation progress, before/after diff views, target-vs-target
 * comparison, and new/fixed finding highlights. Time is injected via `now`
 * params (default Date.now()) so every function is reproducible.
 */

export const WAVE62_HD_IDEAS = [
  {
    id: 52461,
    title: 'Regression scope-diff preview',
    desc: 'Show what the next regression will cover vs the last run before it starts.',
    skip: false,
  },
  {
    id: 52462,
    title: 'Auto-archive old regressions',
    desc: 'Archive regression runs older than N months, keeping only their diff summaries.',
    skip: false,
  },
  {
    id: 52463,
    title: 'Regression comparison dashboard',
    desc: 'Side-by-side verdicts of the last N regressions per target.',
    skip: false,
  },
  {
    id: 52464,
    title: '"All clear" certificate',
    desc: 'Generate a signed certificate when a regression finds zero open issues.',
    skip: false,
  },
  {
    id: 52465,
    title: 'Schedule-via-API',
    desc: 'Create and manage recurring hunts programmatically.',
    skip: false,
  },
  {
    id: 52466,
    title: 'Schedule-via-chat',
    desc: 'Tell the agent "regression every Monday at 2am" and it configures the schedule.',
    skip: false,
  },
  {
    id: 52467,
    title: 'Regression reminders',
    desc: 'Remind owners before a scheduled regression and nudge if targets are unreachable.',
    skip: false,
  },
  {
    id: 52468,
    title: 'Regression digest email',
    desc: 'Periodic summary of all regression outcomes across targets.',
    skip: false,
  },
  {
    id: 52469,
    title: 'Multi-target regression campaigns',
    desc: 'Group regressions across an asset portfolio into one campaign with unified reporting.',
    skip: false,
  },
  {
    id: 52470,
    title: 'PR linking for fixes',
    desc: 'Link pull requests to findings; show PR status (open/merged) on the remediation card.',
    skip: false,
  },
  {
    id: 52471,
    title: 'Fix diff viewer',
    desc: 'View the actual code diff of a linked fix commit without leaving the finding page.',
    skip: false,
  },
  {
    id: 52472,
    title: 'Verification evidence panel',
    desc: 'Retest evidence displayed alongside the fix notes for one-glance verification.',
    skip: false,
  },
  {
    id: 52473,
    title: '"Verified fixed" badge',
    desc: 'Prominent badge on findings that passed verification retest, with date and verifier.',
    skip: false,
  },
  {
    id: 52474,
    title: 'Fix SLA per severity',
    desc: 'Configurable fix deadlines (Critical: 7d, High: 30d...) with breach escalation.',
    skip: false,
  },
  {
    id: 52475,
    title: 'SLA breach alerts (post-hunt)',
    desc: 'Escalating notifications (assignee → lead → manager) as fix SLAs approach and pass.',
    skip: false,
  },
  {
    id: 52476,
    title: 'Remediation progress percentage',
    desc: 'Per-hunt and per-target % of findings fixed and verified, shown on dashboards.',
    skip: false,
  },
  {
    id: 52477,
    title: 'Before/after hunt diff view (post-hunt)',
    desc: 'Visual diff of two hunts: new, fixed, persistent, and severity-changed findings.',
    skip: false,
  },
  {
    id: 52478,
    title: 'Target A vs target B compare',
    desc: "Compare two different targets' hunts to benchmark security posture.",
    skip: false,
  },
  {
    id: 52479,
    title: 'New-findings highlight',
    desc: 'In diffs, new findings get a prominent badge with "first seen" timestamps.',
    skip: false,
  },
  {
    id: 52480,
    title: 'Fixed-findings highlight',
    desc: 'Celebrate remediated findings in diffs with fix dates and linked commits.',
    skip: false,
  },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `hd62_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/* 52461 — Regression scope-diff preview: what the next regression will cover
 * versus the last run, before it starts. */
export function previewScopeDiff(lastScope, nextScope) {
  if (!lastScope || !nextScope)
    return { ok: false, reason: 'lastScope and nextScope are required' };
  const last = new Set((lastScope.endpoints || []).map(String));
  const next = new Set((nextScope.endpoints || []).map(String));
  const added = [...next].filter(e => !last.has(e));
  const removed = [...last].filter(e => !next.has(e));
  const unchanged = [...next].filter(e => last.has(e));
  const enginesChanged =
    JSON.stringify(lastScope.engines || []) !== JSON.stringify(nextScope.engines || []);
  return {
    ok: true,
    added,
    removed,
    unchanged,
    enginesChanged,
    stats: {
      lastEndpoints: last.size,
      nextEndpoints: next.size,
      added: added.length,
      removed: removed.length,
      coveragePct: next.size === 0 ? 0 : Math.round((unchanged.length / next.size) * 100) / 100,
    },
  };
}

/* 52462 — Auto-archive old regressions: archive runs older than N months,
 * keeping only their diff summaries. */
export function autoArchiveCandidates(runs, olderThanDays, now = Date.now()) {
  if (!Array.isArray(runs)) return { ok: false, reason: 'runs array is required' };
  if (typeof olderThanDays !== 'number' || olderThanDays <= 0) {
    return { ok: false, reason: 'positive olderThanDays is required' };
  }
  const cutoff = now - olderThanDays * 24 * 3600000;
  const candidates = [];
  const kept = [];
  for (const r of runs) {
    const summary = {
      runId: r.id,
      target: r.target,
      verdict: r.verdict || 'unknown',
      stats: r.stats || {},
      archivedAt: now,
      summaryOnly: true,
    };
    if ((r.startedAt || 0) < cutoff && !r.pinned) candidates.push(summary);
    else kept.push(r.id);
  }
  return {
    ok: true,
    olderThanDays,
    archived: candidates,
    kept,
    counts: { archived: candidates.length, kept: kept.length },
  };
}

/* 52463 — Regression comparison dashboard: side-by-side verdicts of the last
 * N regressions per target. */
export function buildComparisonDashboard(runs, perTarget = 5) {
  if (!Array.isArray(runs)) return { ok: false, reason: 'runs array is required' };
  const byTarget = new Map();
  for (const r of runs) {
    if (!byTarget.has(r.target)) byTarget.set(r.target, []);
    byTarget.get(r.target).push(r);
  }
  const cards = [];
  for (const [target, list] of byTarget) {
    const recent = list
      .slice()
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, perTarget)
      .map(r => ({
        runId: r.id,
        verdict: r.verdict || 'unknown',
        at: r.startedAt,
        stats: r.stats || {},
      }));
    cards.push({ target, recent, count: recent.length });
  }
  return { ok: true, perTarget, cards, targets: cards.length };
}

/* 52464 — "All clear" certificate: signed certificate when a regression finds
 * zero open issues. */
export function issueAllClearCertificate(regression, issuer = 'Infinity AI', now = Date.now()) {
  if (!regression || !regression.id) return { ok: false, reason: 'regression run is required' };
  const open = (regression.stats && regression.stats.openIssues) || 0;
  if (open > 0) {
    return { ok: false, reason: `cannot certify: ${open} open issue(s) remain` };
  }
  return {
    ok: true,
    certificate: {
      id: tokenFor('clear', regression.id, now),
      regressionId: regression.id,
      target: regression.target || 'unknown',
      issuedBy: issuer,
      issuedAt: now,
      statement: 'Zero open issues found — regression complete, target clear.',
      signed: true,
    },
  };
}

/* 52465 — Schedule-via-API: validate an API payload into a recurring schedule. */
export function parseScheduleApiPayload(payload, now = Date.now()) {
  if (!payload || typeof payload !== 'object')
    return { ok: false, reason: 'payload object is required' };
  const { targetId, cadence, depth = 'quick', owner = null } = payload;
  if (!targetId) return { ok: false, reason: 'targetId is required' };
  if (!/^(hourly|daily|weekly|monthly|once)$/.test(cadence || '')) {
    return { ok: false, reason: 'cadence must be one of hourly|daily|weekly|monthly|once' };
  }
  return {
    ok: true,
    schedule: {
      id: tokenFor('api', `${targetId}:${cadence}`, now),
      targetId,
      cadence,
      depth,
      owner,
      via: 'api',
      createdAt: now,
      status: 'scheduled',
    },
  };
}

/* 52466 — Schedule-via-chat: parse a natural-language command like
 * "regression every Monday at 2am" into a schedule. */
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseScheduleChatCommand(text, now = Date.now()) {
  if (typeof text !== 'string' || !text.trim())
    return { ok: false, reason: 'command text is required' };
  const lower = text.toLowerCase();
  if (!/regression/.test(lower)) return { ok: false, reason: 'command must mention regression' };
  let cadence = 'weekly';
  if (/every\s+day|daily/.test(lower)) cadence = 'daily';
  else if (/every\s+week|weekly/.test(lower)) cadence = 'weekly';
  else if (/every\s+month|monthly/.test(lower)) cadence = 'monthly';
  const dayMatch = DAYS.find(d => lower.includes(d));
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let hour = 2;
  let minute = 0;
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2] || 0);
    if (timeMatch[3] === 'pm' && hour < 12) hour += 12;
    if (timeMatch[3] === 'am' && hour === 12) hour = 0;
  }
  return {
    ok: true,
    parsed: { cadence, day: dayMatch || null, hour, minute },
    schedule: {
      id: tokenFor('chat', text.slice(0, 40), now),
      cadence,
      dayOfWeek: dayMatch || null,
      hour,
      minute,
      via: 'chat',
      raw: text.trim(),
      createdAt: now,
      status: 'scheduled',
    },
  };
}

/* 52467 — Regression reminders: remind owners before a scheduled regression
 * and nudge when targets look unreachable. */
export function regressionReminders(schedules, health, now = Date.now()) {
  if (!Array.isArray(schedules)) return { ok: false, reason: 'schedules array is required' };
  const healthMap = health && typeof health === 'object' ? health : {};
  const reminders = [];
  for (const s of schedules) {
    if (s.status !== 'scheduled' || typeof s.runAt !== 'number') continue;
    const msLeft = s.runAt - now;
    if (msLeft > 0 && msLeft <= 24 * 3600000) {
      reminders.push({
        kind: 'upcoming',
        scheduleId: s.id,
        owner: s.owner || 'unassigned',
        runAt: s.runAt,
        message: `Regression ${s.id} runs in ${Math.round(msLeft / 3600000)}h`,
      });
    }
    if (healthMap[s.targetId] === false) {
      reminders.push({
        kind: 'unreachable',
        scheduleId: s.id,
        targetId: s.targetId,
        owner: s.owner || 'unassigned',
        message: `Target ${s.targetId} is unreachable — regression ${s.id} may fail`,
      });
    }
  }
  return { ok: true, count: reminders.length, reminders };
}

/* 52468 — Regression digest email: periodic summary of all regression
 * outcomes across targets. */
export function buildDigestEmail(runs, periodLabel, now = Date.now()) {
  if (!Array.isArray(runs)) return { ok: false, reason: 'runs array is required' };
  const byVerdict = {};
  for (const r of runs) {
    const v = r.verdict || 'unknown';
    byVerdict[v] = (byVerdict[v] || 0) + 1;
  }
  return {
    ok: true,
    subject: `[Infinity AI] Regression digest — ${periodLabel || 'recent'}`,
    period: periodLabel || 'recent',
    total: runs.length,
    byVerdict,
    sections: runs.slice(0, 25).map(r => `${r.id} · ${r.target} · ${r.verdict || 'unknown'}`),
    generatedAt: now,
  };
}

/* 52469 — Multi-target regression campaigns: group regressions across an
 * asset portfolio into one campaign with unified reporting. */
export function buildCampaign(name, regressions, now = Date.now()) {
  if (!name || typeof name !== 'string') return { ok: false, reason: 'campaign name is required' };
  if (!Array.isArray(regressions) || regressions.length === 0)
    return { ok: false, reason: 'regressions array is required' };
  const targets = [...new Set(regressions.map(r => r.target))];
  const totals = { new: 0, fixed: 0, persistent: 0 };
  for (const r of regressions) {
    const s = r.stats || {};
    totals.new += s.newFindings || 0;
    totals.fixed += s.fixed || 0;
    totals.persistent += s.persistent || 0;
  }
  return {
    ok: true,
    campaign: {
      id: tokenFor('camp', name, now),
      name,
      targets,
      regressionIds: regressions.map(r => r.id),
      totals,
      createdAt: now,
      status: 'active',
    },
  };
}

/* 52470 — PR linking for fixes: link pull requests to findings and surface PR
 * status on the remediation card. */
export function linkPrToFinding(finding, pr, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding is required' };
  if (!pr || !pr.number) return { ok: false, reason: 'PR with a number is required' };
  const status = pr.merged ? 'merged' : pr.closed ? 'closed' : 'open';
  const linked = {
    number: pr.number,
    url: pr.url || null,
    status,
    title: pr.title || '',
    linkedAt: now,
  };
  const existing = Array.isArray(finding.linkedPrs) ? finding.linkedPrs : [];
  return { ok: true, findingId: finding.id, pr: linked, linkedPrs: [...existing, linked] };
}

/* 52471 — Fix diff viewer: payload for viewing the actual code diff of a
 * linked fix commit. */
export function fixDiffViewerPayload(pr, files = []) {
  if (!pr || !pr.number) return { ok: false, reason: 'PR with a number is required' };
  const rows = files.map(f => ({
    path: f.path,
    additions: f.additions || 0,
    deletions: f.deletions || 0,
    language: f.path.split('.').pop() || 'txt',
  }));
  const stats = {
    files: rows.length,
    additions: rows.reduce((a, r) => a + r.additions, 0),
    deletions: rows.reduce((a, r) => a + r.deletions, 0),
  };
  return { ok: true, prNumber: pr.number, files: rows, stats };
}

/* 52472 — Verification evidence panel: retest evidence shown alongside fix
 * notes for one-glance verification. */
export function evidencePanelPayload(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding is required' };
  const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
  const retest = finding.retest || null;
  return {
    ok: true,
    findingId: finding.id,
    fixNotes: finding.fixNotes || '',
    evidence,
    retest: retest
      ? { passed: !!retest.passed, at: retest.at || null, by: retest.by || null }
      : null,
    verdict: retest && retest.passed ? 'verified-fixed' : 'pending-verification',
    evidenceCount: evidence.length,
  };
}

/* 52473 — "Verified fixed" badge: prominent badge for findings that passed
 * verification retest, with date and verifier. */
export function verifiedFixedBadge(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding is required' };
  const r = finding.retest;
  if (!r || r.passed !== true) {
    return { ok: false, reason: 'finding has not passed a verification retest' };
  }
  return {
    ok: true,
    badge: {
      kind: 'verified-fixed',
      findingId: finding.id,
      verifiedAt: r.at || null,
      verifiedBy: r.by || 'unknown',
      label: 'Verified fixed',
    },
  };
}

/* 52474 — Fix SLA per severity: configurable fix deadlines
 * (Critical: 7d, High: 30d...) with breach escalation. */
const DEFAULT_FIX_SLA_DAYS = { critical: 7, high: 30, medium: 60, low: 90 };

export function fixSlaDeadline(severity, foundAt, policy = {}) {
  if (typeof foundAt !== 'number') return { ok: false, reason: 'foundAt timestamp is required' };
  const sev = String(severity || '').toLowerCase();
  const days = policy[sev] || DEFAULT_FIX_SLA_DAYS[sev];
  if (!days) return { ok: false, reason: `unknown severity "${severity}"` };
  return {
    ok: true,
    severity: sev,
    slaDays: days,
    deadline: foundAt + days * 24 * 3600000,
    foundAt,
  };
}

/* 52475 — SLA breach alerts (post-hunt): escalating notifications
 * (assignee → lead → manager) as fix SLAs approach and pass. */
export function slaBreachAlerts(findings, policy = {}, now = Date.now()) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array is required' };
  const alerts = [];
  for (const f of findings) {
    const sla = fixSlaDeadline(f.severity, f.foundAt, policy);
    if (!sla.ok) continue;
    const msLeft = sla.deadline - now;
    if (msLeft < 0) {
      const daysOver = Math.floor(-msLeft / (24 * 3600000));
      const level = daysOver >= 14 ? 'manager' : daysOver >= 7 ? 'lead' : 'assignee';
      alerts.push({
        findingId: f.id,
        severity: sla.severity,
        kind: 'breached',
        level,
        daysOver,
        deadline: sla.deadline,
      });
    } else if (msLeft <= 3 * 24 * 3600000) {
      alerts.push({
        findingId: f.id,
        severity: sla.severity,
        kind: 'approaching',
        level: 'assignee',
        msLeft,
        deadline: sla.deadline,
      });
    }
  }
  return { ok: true, count: alerts.length, alerts };
}

/* 52476 — Remediation progress percentage: per-hunt and per-target % of
 * findings fixed and verified. */
export function remediationProgress(findings) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array is required' };
  const total = findings.length;
  if (total === 0) return { ok: true, total: 0, pct: 0, fixed: 0, verified: 0 };
  const fixed = findings.filter(f => ['Fixed', 'Verified', 'Closed'].includes(f.state)).length;
  const verified = findings.filter(
    f => f.state === 'Verified' || (f.retest && f.retest.passed === true)
  ).length;
  return {
    ok: true,
    total,
    fixed,
    verified,
    pct: Math.round((fixed / total) * 1000) / 10,
    verifiedPct: Math.round((verified / total) * 1000) / 10,
  };
}

/* 52477 — Before/after hunt diff view (post-hunt): visual diff of two hunts —
 * new, fixed, persistent, and severity-changed findings. */
export function diffHunts(huntA, huntB) {
  if (!huntA || !huntB) return { ok: false, reason: 'both hunts are required' };
  const mapA = new Map((huntA.findings || []).map(f => [f.id, f]));
  const mapB = new Map((huntB.findings || []).map(f => [f.id, f]));
  const newFindings = [];
  const fixed = [];
  const persistent = [];
  const severityChanged = [];
  for (const [id, b] of mapB) {
    const a = mapA.get(id);
    if (!a) {
      newFindings.push(b);
      continue;
    }
    const bFixed = ['Fixed', 'Verified', 'Closed'].includes(b.state);
    if (bFixed && !['Fixed', 'Verified', 'Closed'].includes(a.state)) {
      fixed.push({ from: a, to: b });
      continue;
    }
    persistent.push({ from: a, to: b });
    if (a.severity !== b.severity) severityChanged.push({ from: a, to: b });
  }
  return {
    ok: true,
    huntA: huntA.id,
    huntB: huntB.id,
    newFindings,
    fixed,
    persistent,
    severityChanged,
    counts: {
      new: newFindings.length,
      fixed: fixed.length,
      persistent: persistent.length,
      severityChanged: severityChanged.length,
    },
  };
}

/* 52478 — Target A vs target B compare: benchmark two different targets'
 * hunts to compare security posture. */
export function compareTargets(huntA, huntB) {
  const d = diffHunts(huntA, huntB);
  if (!d.ok) return d;
  const riskOf = h =>
    (h.findings || []).reduce(
      (sum, f) =>
        sum + ({ critical: 4, high: 3, medium: 2, low: 1 }[String(f.severity).toLowerCase()] || 0),
      0
    );
  const ra = riskOf(huntA);
  const rb = riskOf(huntB);
  return {
    ok: true,
    targetA: huntA.target,
    targetB: huntB.target,
    riskScoreA: ra,
    riskScoreB: rb,
    riskDelta: rb - ra,
    posture: rb < ra ? 'B stronger' : rb > ra ? 'A stronger' : 'tied',
    counts: d.counts,
  };
}

/* 52479 — New-findings highlight: in diffs, new findings get a prominent
 * badge with "first seen" timestamps. */
export function highlightNewFindings(diff, now = Date.now()) {
  if (!diff || !Array.isArray(diff.newFindings))
    return { ok: false, reason: 'diff with newFindings is required' };
  return {
    ok: true,
    items: diff.newFindings.map(f => ({
      id: f.id,
      title: f.title || f.id,
      severity: f.severity,
      firstSeenAt: f.firstSeenAt || now,
      badge: { kind: 'new-finding', label: 'NEW', at: f.firstSeenAt || now },
    })),
  };
}

/* 52480 — Fixed-findings highlight: celebrate remediated findings in diffs
 * with fix dates and linked commits. */
export function highlightFixedFindings(diff) {
  if (!diff || !Array.isArray(diff.fixed))
    return { ok: false, reason: 'diff with fixed is required' };
  return {
    ok: true,
    items: diff.fixed.map(({ from, to }) => ({
      id: to.id,
      title: to.title || to.id,
      severity: to.severity,
      fixedAt: to.fixedAt || null,
      commit: (to.linkedPrs && to.linkedPrs.find(p => p.status === 'merged')) || null,
      badge: { kind: 'fixed-finding', label: 'FIXED', at: to.fixedAt || null },
    })),
  };
}
