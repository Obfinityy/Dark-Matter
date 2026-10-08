/**
 * regressCore.js — Infinity AI · Dark-Matter · Wave 61 (ideas 52412–52440)
 * Pure JS (no React / DOM / network). Deterministic remediation & regression
 * management: fix assignment and due dates, verification retest actions,
 * remediation kanban with WIP limits, fix notes, commit linking, regression
 * hunt launch descriptors (one-click, scope auto-builder, deploy/CI/git-push
 * triggers, cron scheduling, cadence presets), diff reports, templates,
 * notifications, auto-compare, cost estimates, depth control, engine pinning,
 * new-engine and cross-environment runs, queues, calendar payloads,
 * pause/resume, skip-if-no-change, change-detection triggers, and naming
 * conventions. Time is injected via `now` params (default Date.now()).
 */

export const WAVE61_RG_IDEAS = [
  { id: 52412, title: 'Fix assignment', desc: 'Assign each confirmed finding to an owner with role-based suggestions from asset mapping.', skip: false },
  { id: 52413, title: 'Fix due dates', desc: 'Per-severity default due dates, adjustable per finding, with calendar integration.', skip: false },
  { id: 52414, title: 'Fix verification retest link', desc: 'Every assigned fix carries a one-click "verify with retest" action for the fixer.', skip: false },
  { id: 52415, title: 'Remediation kanban board', desc: 'Drag findings across To fix / Fixing / Verifying / Done columns with WIP limits.', skip: false },
  { id: 52416, title: 'Per-finding fix notes', desc: 'Structured notes on what was changed (files, commits, config) attached to the finding.', skip: false },
  { id: 52417, title: 'Code commit linking', desc: 'Link fix commits (GitHub/GitLab) to findings; show diff stats inline.', skip: false },
  { id: 52418, title: 'One-click regression hunt', desc: 'Launch a regression hunt scoped to previously vulnerable endpoints from the remediation board.', skip: false },
  { id: 52419, title: 'Regression scope auto-builder', desc: 'Build regression scope from all open or recently fixed findings on a target automatically.', skip: false },
  { id: 52420, title: 'Deploy-triggered regression', desc: 'Webhook from CI/CD auto-starts a regression hunt when code ships to the target.', skip: false },
  { id: 52421, title: 'Cron-scheduled regression hunts', desc: 'Recurring hunts on a cron expression with timezone-aware scheduling.', skip: false },
  { id: 52422, title: 'Regression diff report', desc: 'Every regression hunt ends with a fixed / still-vulnerable / new-finding diff against baseline.', skip: false },
  { id: 52423, title: 'Regression cadence presets', desc: 'One-click weekly, bi-weekly, or monthly regression schedules per target.', skip: false },
  { id: 52424, title: 'Post-fix verification scheduling', desc: 'When a fix is marked deployed, auto-schedule its verification retest.', skip: false },
  { id: 52425, title: 'Regression hunt templates', desc: 'Saved regression configurations (depth, engines, scope rules) reusable across targets.', skip: false },
  { id: 52426, title: 'Regression notifications', desc: 'Alert owners when a regression starts, finishes, and what the verdict is.', skip: false },
  { id: 52427, title: 'Regression auto-compare', desc: 'Automatically diff regression results against the original hunt without manual setup.', skip: false },
  { id: 52428, title: 'Regression cost estimate', desc: 'Show estimated time/compute before launching a regression hunt.', skip: false },
  { id: 52429, title: 'Quick vs full regression depth', desc: 'Choose a fast check (known findings only) or full re-exploration per run.', skip: false },
  { id: 52430, title: 'Engine-pinned regression', desc: 'Re-run with the exact engine/model versions of the original hunt for apples-to-apples comparison.', skip: false },
  { id: 52431, title: 'New-engine regression', desc: 'Optionally include newly released engines to catch what older runs missed.', skip: false },
  { id: 52432, title: 'Cross-environment regression', desc: 'Run the regression against staging and production in one job and compare.', skip: false },
  { id: 52433, title: 'Regression queue', desc: 'Central queue of scheduled and pending regression hunts with priorities and owners.', skip: false },
  { id: 52434, title: 'Regression calendar view', desc: 'Calendar showing all upcoming regression hunts across targets.', skip: false },
  { id: 52435, title: 'Pause/resume scheduled hunts', desc: 'Temporarily halt a recurring regression without deleting its configuration.', skip: false },
  { id: 52436, title: 'Skip-if-no-change', desc: "Skip a scheduled regression when change detection shows the target hasn't changed.", skip: false },
  { id: 52437, title: 'Target change-detection trigger', desc: 'Fingerprint the target; auto-trigger regression when tech stack or content shifts.', skip: false },
  { id: 52438, title: 'Git-push regression trigger', desc: 'Start a scoped regression when pushes touch watched repos/paths.', skip: false },
  { id: 52439, title: 'CI pipeline regression trigger', desc: 'API-driven regression starts from Jenkins/GitHub Actions/GitLab CI jobs.', skip: false },
  { id: 52440, title: 'Scheduled hunt naming conventions', desc: 'Auto-name recurring hunts ("acme-prod weekly #12") for easy history browsing.', skip: false },
];

const DAY = 24 * 3600000;

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `rg61_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/* 52412 — Fix assignment: owner + role-based suggestions from asset mapping. */
export function suggestFixOwners(finding, assetMap = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding is required' };
  const asset = assetMap[finding.assetId] || {};
  const suggestions = [];
  if (asset.owner) suggestions.push({ assignee: asset.owner, role: 'asset-owner', basis: `owner of asset ${finding.assetId}` });
  if (finding.severity === 'critical' && asset.securityChampion) suggestions.push({ assignee: asset.securityChampion, role: 'security-champion', basis: 'critical severity' });
  suggestions.push({ assignee: asset.team || 'triage-pool', role: 'team', basis: 'default owning team' });
  return { ok: true, findingId: finding.id, suggestions };
}

export function assignFixOwner(findingId, assignee, now = Date.now()) {
  if (!findingId || !assignee) return { ok: false, reason: 'findingId and assignee are required' };
  return { ok: true, findingId, owner: assignee, assignedAt: now };
}

/* 52413 — Fix due dates: per-severity defaults, adjustable, calendar payload. */
const SEVERITY_DUE_DAYS = { critical: 3, high: 14, medium: 30, low: 60, info: 90 };

export function fixDueDate(severity, now = Date.now(), overrideDays = null) {
  const days = overrideDays != null ? overrideDays : (SEVERITY_DUE_DAYS[(severity || '').toLowerCase()] ?? 30);
  return { ok: true, severity: severity || 'medium', days, dueAt: now + days * DAY };
}

export function fixCalendarPayload(findingId, dueAt) {
  if (!findingId || !dueAt) return { ok: false, reason: 'findingId and dueAt are required' };
  return {
    ok: true,
    event: { title: `Fix due: ${findingId}`, start: dueAt, provider: 'calendar-sync', brand: 'Infinity AI' },
  };
}

/* 52414 — Fix verification retest link: one-click verify-with-retest descriptor. */
export function verifyWithRetestAction(findingId, now = Date.now()) {
  if (!findingId) return { ok: false, reason: 'findingId is required' };
  return {
    ok: true,
    action: { id: tokenFor('vrt', findingId, now), label: 'Verify with retest', findingId, createdAt: now, deeplink: `/hunts/retest?finding=${encodeURIComponent(findingId)}` },
  };
}

/* 52415 — Remediation kanban board: To fix / Fixing / Verifying / Done with
 * WIP-limit reducer. */
export const KANBAN_COLUMNS = ['ToFix', 'Fixing', 'Verifying', 'Done'];

export function kanbanReducer(board, action) {
  if (!board || !action || !action.type) return { ok: false, reason: 'board and action are required' };
  if (action.type === 'move') {
    const { findingId, to } = action;
    if (!KANBAN_COLUMNS.includes(to)) return { ok: false, reason: `unknown column ${to}` };
    const limits = board.wipLimits || {};
    const inColumn = (board.cards || []).filter((c) => c.column === to).length;
    if (limits[to] != null && inColumn >= limits[to]) return { ok: false, reason: `WIP limit reached for ${to}` };
    return { ok: true, cards: (board.cards || []).map((c) => (c.findingId === findingId ? { ...c, column: to } : c)) };
  }
  if (action.type === 'add') {
    return { ok: true, cards: [...(board.cards || []), { findingId: action.findingId, column: 'ToFix' }] };
  }
  return { ok: false, reason: `unknown action ${action.type}` };
}

/* 52416 — Per-finding fix notes: structured files/commits/config notes. */
export function addFixNote(finding, note, now = Date.now()) {
  if (!finding || !finding.id || !note || !note.summary) return { ok: false, reason: 'finding and a note summary are required' };
  const entry = {
    id: tokenFor('fxn', `${finding.id}:${note.summary}`, now),
    summary: note.summary,
    files: Array.isArray(note.files) ? note.files : [],
    commits: Array.isArray(note.commits) ? note.commits : [],
    config: note.config || null,
    author: note.author || 'unassigned',
    at: now,
  };
  return { ok: true, findingId: finding.id, note: entry };
}

/* 52417 — Code commit linking: GitHub/GitLab commit + diff stats. */
export function linkCommit(findingId, commit, now = Date.now()) {
  if (!findingId || !commit || !commit.sha) return { ok: false, reason: 'findingId and a commit sha are required' };
  const provider = /github\.com/.test(commit.url || '') ? 'github' : (/gitlab/.test(commit.url || '') ? 'gitlab' : 'git');
  return {
    ok: true,
    link: {
      findingId, sha: commit.sha, provider, url: commit.url || null,
      stats: { files: commit.filesChanged ?? 0, additions: commit.additions ?? 0, deletions: commit.deletions ?? 0 },
      linkedAt: now,
    },
  };
}

/* 52418 — One-click regression hunt: scoped launch descriptor. */
export function oneClickRegressionHunt(finding, scope, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding is required' };
  return {
    ok: true,
    launch: {
      id: tokenFor('rgh', finding.id, now),
      kind: 'regression',
      target: finding.target || 'unknown-target',
      endpoints: (scope && scope.endpoints) || [finding.endpoint].filter(Boolean),
      baselineFindingIds: [finding.id],
      createdAt: now,
      brand: 'Infinity AI',
    },
  };
}

/* 52419 — Regression scope auto-builder: from open or recently fixed findings. */
export function buildRegressionScope(findings, target, now = Date.now()) {
  if (!Array.isArray(findings) || !target) return { ok: false, reason: 'findings and target are required' };
  const recentMs = 30 * DAY;
  const endpoints = new Set();
  const included = [];
  for (const f of findings) {
    const recent = f.state === 'InRetest' || f.state === 'Verified' || (f.closedAt && now - f.closedAt < recentMs) || !['Verified', 'Closed', 'WontFix', 'RiskAccepted'].includes(f.state);
    if (f.endpoint && recent) { endpoints.add(f.endpoint); included.push(f.id); }
  }
  return { ok: true, target, endpoints: [...endpoints], findingIds: included, generatedAt: now, stats: { endpoints: endpoints.size, findings: included.length } };
}

/* 52420 — Deploy-triggered regression: CI/CD webhook → hunt descriptor. */
export function deployTriggeredRegression(deployEvent, now = Date.now()) {
  if (!deployEvent || !deployEvent.target || !deployEvent.deployId) return { ok: false, reason: 'deploy event with target and deployId is required' };
  return {
    ok: true,
    trigger: 'deploy',
    hunt: {
      id: tokenFor('dep', deployEvent.deployId, now),
      target: deployEvent.target,
      environment: deployEvent.environment || 'production',
      ref: deployEvent.ref || 'main',
      triggeredAt: now,
    },
  };
}

/* 52421 — Cron-scheduled regression hunts: cron expr + timezone-aware next run. */
function nextRunFromCron(expr, now, tzOffsetMin) {
  // Supports only "M H * * *" (daily) and "M H * * DOW" (weekly) forms deterministically.
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { ok: false, reason: 'only 5-part cron expressions are supported' };
  const [mStr, hStr, , , dowStr] = parts;
  const m = Number(mStr); const h = Number(hStr);
  if (!Number.isInteger(m) || !Number.isInteger(h) || m < 0 || m > 59 || h < 0 || h > 23) return { ok: false, reason: 'only fixed minute/hour cron is supported' };
  const local = new Date(now + (tzOffsetMin || 0) * 60000);
  const candidate = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m, 0) - (tzOffsetMin || 0) * 60000);
  if (candidate.getTime() <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  if (dowStr !== '*') {
    const wanted = Number(dowStr);
    if (!Number.isInteger(wanted) || wanted < 0 || wanted > 6) return { ok: false, reason: 'DOW must be 0-6' };
    while (((candidate.getUTCDay() + Math.round((tzOffsetMin || 0) / 1440)) % 7 + 7) % 7 !== wanted) candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return { ok: true, nextRun: candidate.getTime() };
}

export function cronRegressionSchedule(expr, target, opts = {}, now = Date.now()) {
  if (!expr || !target) return { ok: false, reason: 'cron expression and target are required' };
  const r = nextRunFromCron(expr, now, opts.tzOffsetMin || 0);
  if (!r.ok) return r;
  return { ok: true, id: tokenFor('cron', `${target}:${expr}`, now), target, expr, timezone: opts.timezone || 'UTC', tzOffsetMin: opts.tzOffsetMin || 0, nextRun: r.nextRun, createdAt: now, paused: false };
}

/* 52422 — Regression diff report: fixed / still-vulnerable / new vs baseline. */
export function regressionDiffReport(baseline, current) {
  if (!Array.isArray(baseline) || !Array.isArray(current)) return { ok: false, reason: 'baseline and current finding lists are required' };
  const baseIds = new Set(baseline.map((f) => f.id));
  const curIds = new Set(current.map((f) => f.id));
  const curOpen = new Set(current.filter((f) => f.status === 'open').map((f) => f.id));
  const fixed = baseline.filter((f) => !curOpen.has(f.id)).map((f) => f.id);
  const stillVulnerable = baseline.filter((f) => curOpen.has(f.id)).map((f) => f.id);
  const newFindings = current.filter((f) => !baseIds.has(f.id)).map((f) => f.id);
  const closedOrGone = baseline.filter((f) => !curIds.has(f.id)).length;
  return {
    ok: true,
    fixed, stillVulnerable, newFindings,
    verdict: stillVulnerable.length === 0 && newFindings.length === 0 ? 'clean' : (stillVulnerable.length > 0 ? 'regressed' : 'new-issues'),
    stats: { baseline: baseline.length, current: current.length, fixed: fixed.length, stillVulnerable: stillVulnerable.length, newFindings: newFindings.length, closedOrGone },
  };
}

/* 52423 — Regression cadence presets: weekly / bi-weekly / monthly. */
const CADENCE_PRESETS = { weekly: '0 2 * * 1', biweekly: '0 2 * * 1/2', monthly: '0 2 1 * *' };

export function regressionCadencePreset(name, target, now = Date.now()) {
  const expr = CADENCE_PRESETS[name];
  if (!expr) return { ok: false, reason: `unknown preset "${name}" (weekly|biweekly|monthly)` };
  return { ok: true, preset: name, target, schedule: cronRegressionSchedule(expr, target, {}, now) };
}

/* 52424 — Post-fix verification scheduling: auto-schedule on fix-deployed. */
export function schedulePostFixVerification(findingId, deployAt = Date.now(), delayMs = DAY) {
  if (!findingId) return { ok: false, reason: 'findingId is required' };
  return { ok: true, findingId, verifyAt: deployAt + delayMs, scheduledAt: Date.now(), kind: 'post-fix-verification' };
}

/* 52425 — Regression hunt templates: saved reusable configs. */
export function saveRegressionTemplate(name, config) {
  if (!name || !config) return { ok: false, reason: 'name and config are required' };
  return { ok: true, template: { id: tokenFor('tpl', name, 0), name, depth: config.depth || 'quick', engines: config.engines || [], scopeRules: config.scopeRules || [], createdAt: Date.now() } };
}

export function applyRegressionTemplate(template, target, now = Date.now()) {
  if (!template || !target) return { ok: false, reason: 'template and target are required' };
  return { ok: true, launch: { id: tokenFor('rtpl', template.name, now), target, depth: template.depth, engines: [...template.engines], scopeRules: [...template.scopeRules], createdAt: now } };
}

/* 52426 — Regression notifications: start/finish/verdict alerts. */
export function regressionNotifications(hunt, event, now = Date.now()) {
  if (!hunt || !hunt.id || !event || !event.type) return { ok: false, reason: 'hunt and event are required' };
  const messages = {
    start: `Regression hunt ${hunt.id} started on ${hunt.target}.`,
    finish: `Regression hunt ${hunt.id} finished on ${hunt.target}.`,
    verdict: `Regression hunt ${hunt.id} verdict: ${event.verdict || 'unknown'}.`,
  };
  if (!messages[event.type]) return { ok: false, reason: `unknown event type ${event.type}` };
  return { ok: true, huntId: hunt.id, type: event.type, recipients: event.recipients || [hunt.owner || 'team-lead'], message: messages[event.type], at: now, brand: 'Infinity AI' };
}

/* 52427 — Regression auto-compare: diff vs the original hunt. */
export function autoCompareRegression(regression, original) {
  if (!regression || !original) return { ok: false, reason: 'regression and original hunt results are required' };
  return { ok: true, regressionId: regression.id, originalId: original.id, diff: regressionDiffReport(original.findings || [], regression.findings || []) };
}

/* 52428 — Regression cost estimate: time/compute preview. */
export function estimateRegressionCost(config) {
  if (!config || !config.scope) return { ok: false, reason: 'config with a scope is required' };
  const endpoints = config.scope.endpoints ? config.scope.endpoints.length : 0;
  const depthFactor = config.depth === 'full' ? 4 : 1;
  const estimatedMinutes = Math.max(5, endpoints * 2 * depthFactor);
  const estimatedComputeUnits = endpoints * depthFactor * 10;
  return { ok: true, endpoints, depth: config.depth || 'quick', estimatedMinutes, estimatedComputeUnits, engines: config.engines || [] };
}

/* 52429 — Quick vs full regression depth. */
export function regressionDepthConfig(depth) {
  if (depth !== 'quick' && depth !== 'full') return { ok: false, reason: 'depth must be quick or full' };
  return {
    ok: true, depth,
    checks: depth === 'quick' ? ['known-findings-only', 'fingerprint-diff'] : ['known-findings', 'full-exploration', 'engine-sweep', 'chain-search'],
    estimatedMultiplier: depth === 'quick' ? 1 : 4,
  };
}

/* 52430 — Engine-pinned regression: exact engine/model versions. */
export function pinEngines(launch, versions) {
  if (!launch || !launch.id || !versions || typeof versions !== 'object') return { ok: false, reason: 'launch and engine versions are required' };
  return { ok: true, launch: { ...launch, engines: { ...versions }, pinned: true } };
}

/* 52431 — New-engine regression: include newly released engines. */
export function includeNewEngines(launch, releasedEngines) {
  if (!launch || !launch.id || !Array.isArray(releasedEngines)) return { ok: false, reason: 'launch and released engines are required' };
  const existing = new Set(Object.keys(launch.engines || {}));
  const added = releasedEngines.filter((e) => !existing.has(e.name));
  return { ok: true, added: added.map((e) => e.name), launch: { ...launch, engines: { ...(launch.engines || {}), ...Object.fromEntries(added.map((e) => [e.name, e.version])) } } };
}

/* 52432 — Cross-environment regression: staging + prod in one job. */
export function crossEnvironmentRegression(base, environments) {
  if (!base || !base.id || !Array.isArray(environments) || environments.length < 2) return { ok: false, reason: 'base launch and 2+ environments are required' };
  return {
    ok: true,
    job: { id: tokenFor('xenv', base.id, Date.now()), baseLaunchId: base.id, environments: [...environments], compare: true },
  };
}

/* 52433 — Regression queue: scheduled/pending hunts with priorities + owners. */
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

export function regressionQueueAdd(queue, hunt, opts = {}) {
  if (!hunt || !hunt.id) return { ok: false, reason: 'hunt is required' };
  const priority = PRIORITY_RANK[opts.priority] != null ? opts.priority : 'normal';
  const entry = { huntId: hunt.id, priority, owner: opts.owner || 'unassigned', queuedAt: Date.now(), status: 'pending' };
  const next = [...(queue || []), entry].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  return { ok: true, queue: next, added: entry };
}

/* 52434 — Regression calendar view: upcoming hunts payload. */
export function regressionCalendarPayload(hunts, now = Date.now()) {
  if (!Array.isArray(hunts)) return { ok: false, reason: 'hunts array is required' };
  const upcoming = hunts
    .filter((h) => h.nextRun && h.nextRun > now && !h.paused)
    .sort((a, b) => a.nextRun - b.nextRun)
    .map((h) => ({ id: h.id, target: h.target, nextRun: h.nextRun, cadence: h.preset || h.expr || 'once', owner: h.owner || 'unassigned' }));
  return { ok: true, generatedAt: now, upcoming, count: upcoming.length };
}

/* 52435 — Pause/resume scheduled hunts without deleting configuration. */
export function pauseScheduledHunt(schedule, now = Date.now()) {
  if (!schedule || !schedule.id) return { ok: false, reason: 'schedule is required' };
  return { ok: true, schedule: { ...schedule, paused: true, pausedAt: now } };
}

export function resumeScheduledHunt(schedule, now = Date.now()) {
  if (!schedule || !schedule.id) return { ok: false, reason: 'schedule is required' };
  return { ok: true, schedule: { ...schedule, paused: false, resumedAt: now, nextRun: cronRegressionSchedule(schedule.expr, schedule.target, { tzOffsetMin: schedule.tzOffsetMin || 0 }, now).nextRun } };
}

/* 52436 — Skip-if-no-change: change detection gate before a scheduled run. */
export function skipIfNoChange(schedule, changeReport) {
  if (!schedule || !schedule.id) return { ok: false, reason: 'schedule is required' };
  if (!changeReport) return { ok: false, reason: 'change report is required' };
  const changed = !!changeReport.changed;
  return { ok: true, scheduleId: schedule.id, skipped: !changed, reason: changed ? 'target changed — running' : 'no change detected — skipping run' };
}

/* 52437 — Target change-detection trigger: fingerprint shift fires regression. */
export function targetChangeTrigger(oldFingerprint, newFingerprint, target, now = Date.now()) {
  if (!oldFingerprint || !newFingerprint || !target) return { ok: false, reason: 'fingerprints and target are required' };
  const techShift = JSON.stringify(oldFingerprint.tech || []) !== JSON.stringify(newFingerprint.tech || []);
  const contentShift = (oldFingerprint.contentHash || '') !== (newFingerprint.contentHash || '');
  const changed = techShift || contentShift;
  return {
    ok: true, target, changed,
    trigger: changed ? { id: tokenFor('chg', target, now), target, kind: 'change-detection', shifts: { techShift, contentShift }, at: now } : null,
  };
}

/* 52438 — Git-push regression trigger: pushes on watched repos/paths. */
export function gitPushTrigger(pushEvent, watched) {
  if (!pushEvent || !pushEvent.repo || !Array.isArray(pushEvent.paths)) return { ok: false, reason: 'push event with repo and paths is required' };
  const watchedPaths = (watched && watched[pushEvent.repo]) || [];
  const hits = pushEvent.paths.filter((p) => watchedPaths.some((w) => p.startsWith(w)));
  return { ok: true, repo: pushEvent.repo, matchedPaths: hits, trigger: hits.length > 0, reason: hits.length > 0 ? `watched paths changed: ${hits.join(', ')}` : 'no watched paths changed' };
}

/* 52439 — CI pipeline regression trigger: Jenkins / GitHub Actions / GitLab CI. */
export function ciPipelineTrigger(ciEvent, now = Date.now()) {
  if (!ciEvent || !ciEvent.provider || !ciEvent.job || !ciEvent.target) return { ok: false, reason: 'CI event with provider, job, and target is required' };
  const providers = ['jenkins', 'github-actions', 'gitlab-ci'];
  if (!providers.includes(ciEvent.provider)) return { ok: false, reason: `unsupported provider ${ciEvent.provider}` };
  return {
    ok: true,
    hunt: { id: tokenFor('ci', `${ciEvent.provider}:${ciEvent.job}`, now), target: ciEvent.target, provider: ciEvent.provider, job: ciEvent.job, ref: ciEvent.ref || 'main', status: ciEvent.status || 'success', triggeredAt: now },
  };
}

/* 52440 — Scheduled hunt naming conventions: "acme-prod weekly #12". */
export function autoNameScheduledHunt(target, cadence, sequence, now = Date.now()) {
  if (!target || !cadence) return { ok: false, reason: 'target and cadence are required' };
  const seq = sequence != null ? sequence : 1;
  return { ok: true, name: `${target} ${cadence} #${seq}`, target, cadence, sequence: seq, generatedAt: now };
}
