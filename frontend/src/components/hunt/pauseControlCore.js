/**
 * pauseControlCore.js — wave 33 (ideas 51281–51320): pause/abort/resume
 * control suite + log governance + live artifact gallery — pure logic.
 *
 * Ideas 51281–51320: live artifact gallery, log access roles, log retention
 * policies, one-click incident package, instant pause, graceful pause, pause
 * with reason, resume exactly, pause scheduling, pause on finding, pause on
 * approval, abort with confirmation, abort-and-archive, soft abort, pause per
 * module, global pause all hunts, pause state indicator, resume checklist,
 * auto-resume timer, pause during stealth, abort reason codes, pause
 * notifications, resume from checkpoint, pause API, pause heat indicator,
 * resume dry-run, abort impact summary, pause-and-chat, conditional
 * auto-resume, pause templates, hunt hibernation (mid-hunt), wake-on-finding,
 * pause cost display, resume with new instructions, abort-and-clone, pause
 * approval chains, resume conflict check, pause screen lock, abort to report,
 * pause analytics.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: time always arrives as an explicit `now`
 * argument (ms epoch), never Date.now(); no Math.random.
 */

export const WAVE33_START = 51281;
export const WAVE33_END = 51320;

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE33_IDEAS = [
  [
    51281,
    'live artifact gallery',
    'Screenshots, responses, and files the agent captured, browsable as they arrive',
  ],
  [51282, 'log access roles', 'Control which teammates can see raw logs versus summaries'],
  [51283, 'log retention policies', 'Auto-archive or purge logs per your compliance schedule'],
  [
    51284,
    'one-click incident package',
    'Bundle logs, findings, and timeline into a shareable evidence pack',
  ],
  [
    51285,
    'instant pause button',
    'Freeze all agent activity within a second, with visual confirmation',
  ],
  [
    51286,
    'graceful pause',
    'Finish the in-flight request before pausing to avoid half-written state',
  ],
  [51287, 'pause with reason', 'Tag each pause with a reason for the hunt record'],
  [
    51288,
    'resume exactly',
    'Pick up precisely where the hunt stopped — no repeated or skipped steps',
  ],
  [51289, 'pause scheduling', 'Set the hunt to pause automatically at a future time'],
  [51290, 'pause on finding', 'Auto-pause when a finding above a severity threshold appears'],
  [51291, 'pause on approval', 'Auto-pause while any sensitive-action approval is pending'],
  [
    51292,
    'abort with confirmation',
    'A two-step abort that shows what will be discarded before you commit',
  ],
  [51293, 'abort-and-archive', 'Stop the hunt and immediately archive everything collected so far'],
  [
    51294,
    'soft abort',
    'Stop new actions but let the agent finish writing findings and the report',
  ],
  [51295, 'pause per module', 'Freeze one testing module while others continue'],
  [51296, 'global pause all hunts', 'One command pauses every running hunt in your workspace'],
  [51297, 'pause state indicator', 'An unmistakable banner showing the hunt is paused and why'],
  [51298, 'resume checklist', 'Before resuming, see what will run next and confirm'],
  [51299, 'auto-resume timer', 'Pause for N minutes and resume automatically'],
  [
    51300,
    'pause during stealth',
    'Pausing also halts all network traffic instantly for sensitive windows',
  ],
  [51301, 'abort reason codes', 'Categorize why hunts were aborted for later analysis'],
  [51302, 'pause notifications', 'Teammates get notified when a shared hunt is paused or resumed'],
  [
    51303,
    'resume from checkpoint',
    'Roll back to an earlier checkpoint instead of the exact pause point',
  ],
  [51304, 'pause API', 'External systems can pause or resume hunts programmatically'],
  [
    51305,
    'pause heat indicator',
    'Shows how "hot" the pause is: mid-exploit pauses flagged for review',
  ],
  [51306, 'resume dry-run', 'Preview the next 5 actions before actually resuming'],
  [51307, 'abort impact summary', 'What findings, coverage, and time are lost if you abort now'],
  [
    51308,
    'pause-and-chat',
    'While paused, chat freely with the agent about strategy before resuming',
  ],
  [51309, 'conditional auto-resume', 'Resume automatically when a condition you set becomes true'],
  [51310, 'pause templates', 'Named pause reasons reused across hunts for consistent records'],
  [
    51311,
    'hunt hibernation (mid-hunt)',
    'Deep-freeze a hunt for days with full state preserved on disk',
  ],
  [51312, 'wake-on-finding', 'A hibernated hunt wakes if the target changes in a watched way'],
  [51313, 'pause cost display', 'Shows idle resource cost while a hunt sits paused'],
  [51314, 'resume with new instructions', 'Attach fresh steering commands that apply on resume'],
  [51315, 'abort-and-clone', 'Abort this run but clone its config for a fresh hunt later'],
  [51316, 'pause approval chains', 'Pausing also suspends pending approval timers'],
  [51317, 'resume conflict check', 'Warns if the target changed while paused before resuming'],
  [51318, 'pause screen lock', 'Optionally lock the hunt view while paused for shared screens'],
  [51319, 'abort to report', 'Abort testing but keep the agent available to finalize the report'],
  [51320, 'pause analytics', 'Track how often and why you pause to improve hunt planning'],
];

// --- pause state machine -----------------------------------------------------

export const HUNT_STATUSES = [
  'running',
  'draining',
  'paused',
  'finishing',
  'aborted',
  'archived',
  'hibernating',
  'reporting',
];

/** Fresh hunt control state. `modules` is a list of testing module ids. */
export function createHuntControl(huntId, modules = []) {
  return {
    huntId: String(huntId),
    status: 'running',
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    pauseNote: '',
    pauseHeat: 'cool',
    inFlight: 0,
    networkHalted: false,
    screenLocked: false,
    modules: Object.fromEntries((modules || []).map(m => [m, { paused: false }])),
    nextActions: [],
    completedSteps: 0,
    scheduledPauseAt: null,
    autoResumeAt: null,
    resumeCondition: null,
    newInstructions: [],
    checkpoints: [],
    approvalsSuspended: false,
    pendingApprovals: 0,
    targetFingerprint: null,
    abortedAt: null,
    abortCode: null,
  };
}

// --- 51285 instant pause -----------------------------------------------------

/** Freeze all agent activity immediately. Returns a new control state. */
export function instantPause(ctrl, { reason, by, now }) {
  if (!ctrl || ctrl.status !== 'running') return ctrl;
  return {
    ...ctrl,
    status: 'paused',
    pausedAt: now,
    pausedBy: by || 'operator',
    pauseReason: reason || 'manual',
    networkHalted: false,
    autoResumeAt: null,
  };
}

// --- 51286 graceful pause ----------------------------------------------------

/** Begin draining: no new actions, in-flight work finishes first. */
export function beginGracefulPause(ctrl, { reason, by, now }) {
  if (!ctrl || ctrl.status !== 'running') return ctrl;
  return {
    ...ctrl,
    status: 'draining',
    pausedBy: by || 'operator',
    pauseReason: reason || 'graceful',
    gracefulRequestedAt: now,
  };
}

/** One drain tick: when inFlight reaches 0 the pause takes effect. */
export function gracefulDrainTick(ctrl, now) {
  if (!ctrl || ctrl.status !== 'draining') return ctrl;
  if ((ctrl.inFlight || 0) > 0) return ctrl;
  return { ...ctrl, status: 'paused', pausedAt: now };
}

/** Advance one unit of in-flight work to completion (pure, for UI demo math). */
export function completeInFlightUnit(ctrl) {
  if (!ctrl) return ctrl;
  return { ...ctrl, inFlight: Math.max(0, (ctrl.inFlight || 0) - 1) };
}

// --- 51287 pause with reason -------------------------------------------------

export const PAUSE_REASONS = [
  ['manual', 'Manual — operator paused deliberately'],
  ['lunch', 'Break — stepping away briefly'],
  ['review', 'Review — inspecting findings before continuing'],
  ['approval', 'Approval — waiting on a sensitive-action decision'],
  ['stealth', 'Stealth — sensitive window, halt all traffic'],
  ['finding', 'Finding — paused automatically on a significant finding'],
  ['scheduled', 'Scheduled — automatic pause at a planned time'],
  ['cost', 'Cost — pausing to stop resource burn'],
  ['other', 'Other — custom note attached'],
];

/** Attach a reason tag (and optional free-text note) to the pause record. */
export function tagPauseReason(ctrl, reason, note = '') {
  const known = PAUSE_REASONS.some(([r]) => r === reason);
  if (!ctrl) return ctrl;
  return { ...ctrl, pauseReason: known ? reason : 'other', pauseNote: String(note || '') };
}

export function describePauseReason(reason) {
  const found = PAUSE_REASONS.find(([r]) => r === reason);
  return found ? found[1] : reason;
}

// --- 51288 resume exactly ----------------------------------------------------

/** Resume: pick up precisely where the hunt stopped. */
export function resume(ctrl, { now }) {
  if (!ctrl) return ctrl;
  if (!['paused', 'draining'].includes(ctrl.status)) return ctrl;
  const wasDraining = ctrl.status === 'draining';
  return {
    ...ctrl,
    status: 'running',
    pausedAt: null,
    resumeAt: now,
    autoResumeAt: null,
    resumeCondition: null,
    networkHalted: false,
    resumedFromStep: wasDraining ? ctrl.completedSteps : ctrl.completedSteps,
  };
}

// --- 51289 pause scheduling --------------------------------------------------

/** Schedule an automatic pause at a future epoch-ms time. */
export function schedulePause(ctrl, atMs) {
  if (!ctrl) return ctrl;
  return { ...ctrl, scheduledPauseAt: atMs };
}

/** True when the scheduled pause time has arrived and the hunt is running. */
export function scheduledPauseDue(ctrl, now) {
  return (
    !!ctrl &&
    ctrl.status === 'running' &&
    ctrl.scheduledPauseAt != null &&
    now >= ctrl.scheduledPauseAt
  );
}

/** Apply a due scheduled pause (same mechanics as instant pause). */
export function applyScheduledPause(ctrl, now) {
  if (!scheduledPauseDue(ctrl, now)) return ctrl;
  const paused = instantPause(ctrl, { reason: 'scheduled', by: 'scheduler', now });
  return { ...paused, scheduledPauseAt: null };
}

// --- 51290 pause on finding --------------------------------------------------

const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** True when a finding's severity meets/exceeds the pause threshold. */
export function shouldPauseOnFinding(threshold, finding) {
  const rank = s => SEVERITY_RANK[String(s || '').toLowerCase()] ?? -1;
  return rank(finding && finding.severity) >= rank(threshold) && rank(threshold) >= 0;
}

/** Auto-pause a running hunt on a qualifying finding. */
export function pauseOnFinding(ctrl, finding, threshold, now) {
  if (!ctrl || ctrl.status !== 'running') return ctrl;
  if (!shouldPauseOnFinding(threshold, finding)) return ctrl;
  return instantPause(ctrl, { reason: 'finding', by: 'auto-rule', now });
}

// --- 51291 pause on approval -------------------------------------------------

/** Auto-pause while any sensitive-action approval is pending. */
export function pauseOnApproval(ctrl, pendingApprovals, now) {
  if (!ctrl || ctrl.status !== 'running') return ctrl;
  if (!pendingApprovals || pendingApprovals.length === 0) return ctrl;
  const paused = instantPause(ctrl, { reason: 'approval', by: 'auto-rule', now });
  return { ...paused, pendingApprovals: pendingApprovals.length };
}

// --- 51292 abort with confirmation -------------------------------------------

/**
 * Two-step abort, step 1: compute what will be discarded and mint a
 * confirmation token (deterministic from hunt id + step count).
 */
export function prepareAbort(ctrl) {
  if (!ctrl) return null;
  const inFlight = ctrl.inFlight || 0;
  return {
    huntId: ctrl.huntId,
    willDiscardInFlight: inFlight,
    willKeepFindings: true,
    willKeepTimeline: true,
    queuedActions: (ctrl.nextActions || []).length,
    token: `abort-${ctrl.huntId}-${ctrl.completedSteps}-${inFlight}`,
    summary:
      `Aborting will discard ${inFlight} in-flight action(s) and ` +
      `${(ctrl.nextActions || []).length} queued action(s). Findings and timeline are kept.`,
  };
}

/** Two-step abort, step 2: confirm with the token from prepareAbort. */
export function confirmAbort(ctrl, token, { code, now } = {}) {
  const prep = prepareAbort(ctrl);
  if (!ctrl || !prep || prep.token !== token) return ctrl;
  if (!['running', 'paused', 'draining'].includes(ctrl.status)) return ctrl;
  return { ...ctrl, status: 'aborted', abortedAt: now, abortCode: code || 'operator' };
}

// --- 51293 abort-and-archive -------------------------------------------------

/** Stop the hunt and immediately archive everything collected. */
export function abortAndArchive(ctrl, token, { code, now } = {}) {
  const aborted = confirmAbort(ctrl, token, { code, now });
  if (aborted === ctrl) return ctrl;
  return {
    ...aborted,
    status: 'archived',
    archivedAt: now,
    archive: {
      findingsKept: true,
      timelineKept: true,
      inFlightDiscarded: ctrl.inFlight || 0,
      archivedAt: now,
    },
  };
}

// --- 51294 soft abort --------------------------------------------------------

/** Stop new actions but let the agent finish findings and the report. */
export function softAbort(ctrl, { now } = {}) {
  if (!ctrl || !['running', 'paused'].includes(ctrl.status)) return ctrl;
  return {
    ...ctrl,
    status: 'finishing',
    softAbortAt: now,
    nextActions: [],
  };
}

// --- 51295 pause per module --------------------------------------------------

/** Freeze one testing module while the rest of the hunt continues. */
export function setModulePaused(ctrl, moduleId, paused) {
  if (!ctrl || !ctrl.modules || !(moduleId in ctrl.modules)) return ctrl;
  return {
    ...ctrl,
    modules: { ...ctrl.modules, [moduleId]: { paused: !!paused } },
  };
}

export function pausedModules(ctrl) {
  if (!ctrl || !ctrl.modules) return [];
  return Object.keys(ctrl.modules).filter(m => ctrl.modules[m].paused);
}

// --- 51296 global pause all hunts --------------------------------------------

/** One command pauses every running hunt in the workspace. */
export function pauseAllHunts(controls, { by, now } = {}) {
  return (controls || []).map(c =>
    c.status === 'running' ? instantPause(c, { reason: 'global', by: by || 'operator', now }) : c
  );
}

/** Resume every hunt paused by the global pause. */
export function resumeAllHunts(controls, { now } = {}) {
  return (controls || []).map(c =>
    c.status === 'paused' && c.pauseReason === 'global' ? resume(c, { now }) : c
  );
}

// --- 51297 pause state indicator ---------------------------------------------

/** Unmistakable banner model: what to show and why. */
export function pauseBanner(ctrl) {
  if (!ctrl) return { show: false };
  const s = ctrl.status;
  if (s === 'paused') {
    return {
      show: true,
      tone: 'paused',
      title: 'HUNT PAUSED',
      detail: `${describePauseReason(ctrl.pauseReason)}${ctrl.pauseNote ? ` — ${ctrl.pauseNote}` : ''}`,
      by: ctrl.pausedBy,
    };
  }
  if (s === 'draining') {
    return {
      show: true,
      tone: 'draining',
      title: 'PAUSING…',
      detail: `Finishing ${ctrl.inFlight || 0} in-flight action(s) before the pause takes effect.`,
    };
  }
  if (s === 'hibernating') {
    return {
      show: true,
      tone: 'hibernating',
      title: 'HUNT HIBERNATING',
      detail: 'Deep-frozen. Full state preserved on disk.',
    };
  }
  if (s === 'aborted' || s === 'archived') {
    return {
      show: true,
      tone: 'ended',
      title: s === 'aborted' ? 'HUNT ABORTED' : 'HUNT ARCHIVED',
      detail: describeAbortCode(ctrl.abortCode),
    };
  }
  return { show: false };
}

// --- 51298 resume checklist --------------------------------------------------

/** What will run next when the hunt resumes — the operator confirms. */
export function resumeChecklist(ctrl) {
  if (!ctrl) return [];
  const items = [];
  items.push({
    id: 'step',
    label: `Resume from step ${ctrl.completedSteps + 1} — no steps repeated or skipped`,
  });
  (ctrl.nextActions || []).slice(0, 4).forEach((a, i) => {
    items.push({ id: `action-${i}`, label: `Next action: ${a}` });
  });
  if (ctrl.networkHalted)
    items.push({ id: 'net', label: 'Network traffic will resume (stealth pause lifted)' });
  if (ctrl.newInstructions && ctrl.newInstructions.length) {
    items.push({
      id: 'instr',
      label: `${ctrl.newInstructions.length} new instruction(s) will apply on resume`,
    });
  }
  if (!items.length)
    items.push({ id: 'idle', label: 'Nothing queued — the agent will plan the next step' });
  return items;
}

// --- 51299 auto-resume timer -------------------------------------------------

/** Pause for N minutes, then resume automatically. */
export function scheduleAutoResume(ctrl, minutes, now) {
  if (!ctrl) return ctrl;
  const mins = Math.max(1, Math.min(24 * 60, Math.floor(Number(minutes) || 0)));
  return { ...ctrl, autoResumeAt: now + mins * 60_000, autoResumeMinutes: mins };
}

/** True when the auto-resume timer has fired while paused. */
export function autoResumeDue(ctrl, now) {
  return (
    !!ctrl && ctrl.status === 'paused' && ctrl.autoResumeAt != null && now >= ctrl.autoResumeAt
  );
}

export function applyAutoResume(ctrl, now) {
  if (!autoResumeDue(ctrl, now)) return ctrl;
  const resumed = resume(ctrl, { now });
  return { ...resumed, resumedBy: 'auto-timer' };
}

// --- 51300 pause during stealth ----------------------------------------------

/** Pausing also halts all network traffic instantly for sensitive windows. */
export function stealthPause(ctrl, { by, now }) {
  const paused = instantPause(ctrl, { reason: 'stealth', by: by || 'operator', now });
  if (paused === ctrl) return ctrl;
  return { ...paused, networkHalted: true };
}

// --- 51301 abort reason codes ------------------------------------------------

export const ABORT_REASON_CODES = [
  ['operator', 'Operator decision — manual abort'],
  ['false-start', 'False start — hunt configured wrong, restarting'],
  ['target-down', 'Target down — the target stopped responding'],
  ['scope-change', 'Scope change — authorization or scope changed'],
  ['budget', 'Budget — resource or time budget exhausted'],
  ['duplicate', 'Duplicate — superseded by another hunt'],
  ['incident', 'Incident — aborted to preserve evidence'],
  ['other', 'Other — see note'],
];

export function describeAbortCode(code) {
  const found = ABORT_REASON_CODES.find(([c]) => c === code);
  return found ? found[1] : 'Aborted';
}

// --- 51302 pause notifications -----------------------------------------------

/** Teammate notifications derived from a pause/resume transition. */
export function pauseNotifications(prev, next) {
  if (!prev || !next || prev.status === next.status) return [];
  const who = next.pausedBy || next.resumedBy || 'operator';
  if (next.status === 'paused') {
    return [
      {
        to: 'team',
        kind: 'paused',
        text: `Hunt ${next.huntId} paused by ${who} — ${describePauseReason(next.pauseReason)}`,
      },
    ];
  }
  if (next.status === 'running' && prev.status === 'paused') {
    return [
      {
        to: 'team',
        kind: 'resumed',
        text: `Hunt ${next.huntId} resumed by ${who}`,
      },
    ];
  }
  return [];
}

// --- 51303 resume from checkpoint --------------------------------------------

/** Snapshot the current position for a possible rollback. */
export function createCheckpoint(ctrl, label, now) {
  if (!ctrl) return ctrl;
  const cp = {
    id: `cp-${(ctrl.checkpoints || []).length + 1}`,
    label: String(label || `Checkpoint ${(ctrl.checkpoints || []).length + 1}`),
    at: now,
    completedSteps: ctrl.completedSteps,
    nextActions: [...(ctrl.nextActions || [])],
  };
  return { ...ctrl, checkpoints: [...(ctrl.checkpoints || []), cp] };
}

/** Roll back to an earlier checkpoint instead of the exact pause point. */
export function resumeFromCheckpoint(ctrl, checkpointId, { now } = {}) {
  if (!ctrl) return ctrl;
  const cp = (ctrl.checkpoints || []).find(c => c.id === checkpointId);
  if (!cp) return ctrl;
  const resumed = resume(ctrl, { now });
  return {
    ...resumed,
    completedSteps: cp.completedSteps,
    nextActions: [...cp.nextActions],
    resumedFromCheckpoint: cp.id,
  };
}

// --- 51304 pause API ---------------------------------------------------------

/**
 * Parse an external pause/resume command string into an action.
 * Supported: "pause", "pause <n>m", "pause module <id>", "resume",
 * "resume dry-run", "abort", "status".
 */
export function parsePauseCommand(input) {
  const text = String(input || '')
    .trim()
    .toLowerCase();
  if (!text) return { error: 'empty command' };
  let m = text.match(/^pause\s+(\d+)\s*m$/);
  if (m) return { action: 'pause-timed', minutes: parseInt(m[1], 10) };
  m = text.match(/^pause\s+module\s+([a-z0-9_-]+)$/);
  if (m) return { action: 'pause-module', module: m[1] };
  if (text === 'pause') return { action: 'pause' };
  if (text === 'resume') return { action: 'resume' };
  if (text === 'resume dry-run') return { action: 'resume-dry-run' };
  if (text === 'abort') return { action: 'abort' };
  if (text === 'status') return { action: 'status' };
  return { error: `unknown command: ${input}` };
}

// --- 51305 pause heat indicator ----------------------------------------------

/**
 * How "hot" the pause is: pausing mid-exploit (or mid sensitive action)
 * gets flagged for review.
 */
export function pauseHeat(ctrl) {
  if (!ctrl) return { level: 'cool', label: 'Cool', review: false };
  const hot =
    (ctrl.inFlight || 0) > 0 &&
    /exploit|payload|sensitive/i.test(
      (ctrl.nextActions || []).join(' ') + ' ' + (ctrl.pauseNote || '')
    );
  const warm = (ctrl.inFlight || 0) > 0;
  if (hot) return { level: 'hot', label: 'Hot — mid-exploit pause', review: true };
  if (warm) return { level: 'warm', label: 'Warm — actions were in flight', review: false };
  return { level: 'cool', label: 'Cool — idle pause', review: false };
}

// --- 51306 resume dry-run ----------------------------------------------------

/** Preview the next 5 actions before actually resuming. */
export function resumeDryRun(ctrl) {
  if (!ctrl) return [];
  return (ctrl.nextActions || []).slice(0, 5).map((a, i) => ({
    order: i + 1,
    action: a,
    fromStep: ctrl.completedSteps + i + 1,
  }));
}

// --- 51307 abort impact summary ----------------------------------------------

/** What findings, coverage, and time are lost if you abort now. */
export function abortImpact(ctrl, { findings = [], coveragePct = 0, startedAt = 0, now = 0 } = {}) {
  const minutesInvested = Math.max(0, Math.round((now - startedAt) / 60_000));
  const inFlight = (ctrl && ctrl.inFlight) || 0;
  const queued = ctrl && ctrl.nextActions ? ctrl.nextActions.length : 0;
  return {
    findingsDrafted: findings.length,
    inFlightLost: inFlight,
    queuedLost: queued,
    coverageAtAbortPct: coveragePct,
    minutesInvested,
    note:
      inFlight + queued > 0
        ? `${inFlight + queued} action(s) will not run; drafted findings are kept.`
        : 'No actions pending — nothing is lost beyond the remaining plan.',
  };
}

// --- 51308 pause-and-chat ----------------------------------------------------

/** Context bundle handed to the strategy chat while paused. */
export function pauseChatContext(ctrl) {
  if (!ctrl) return null;
  return {
    huntId: ctrl.huntId,
    status: ctrl.status,
    pausedBecause: describePauseReason(ctrl.pauseReason),
    completedSteps: ctrl.completedSteps,
    nextActions: (ctrl.nextActions || []).slice(0, 5),
    heat: pauseHeat(ctrl).label,
  };
}

// --- 51309 conditional auto-resume -------------------------------------------

/** Arm a resume condition, e.g. { type: 'approval-resolved' } or { type: 'at', at }. */
export function armResumeCondition(ctrl, condition) {
  if (!ctrl) return ctrl;
  return { ...ctrl, resumeCondition: condition };
}

/** True when the armed condition is satisfied by current facts. */
export function checkResumeCondition(ctrl, facts = {}) {
  const cond = ctrl && ctrl.resumeCondition;
  if (!cond || ctrl.status !== 'paused') return false;
  if (cond.type === 'approval-resolved') return (facts.pendingApprovals || 0) === 0;
  if (cond.type === 'at') return (facts.now || 0) >= cond.at;
  if (cond.type === 'finding-reviewed') return facts.findingReviewed === true;
  return false;
}

// --- 51310 pause templates ---------------------------------------------------

export const PAUSE_TEMPLATES = [
  ['standup', 'Standup — pausing for the daily sync'],
  ['demo-prep', 'Demo prep — freezing state before a demo'],
  ['change-freeze', 'Change freeze — holding during a sensitive window'],
  ['handoff', 'Handoff — pausing for shift handoff'],
  ['budget-check', 'Budget check — reviewing spend before continuing'],
];

/** Apply a named pause template (reason + canned note). */
export function applyPauseTemplate(ctrl, name, { by, now }) {
  const tpl = PAUSE_TEMPLATES.find(([n]) => n === name);
  if (!ctrl || !tpl) return ctrl;
  const reason = name === 'change-freeze' ? 'stealth' : 'manual';
  const paused = instantPause(ctrl, { reason, by: by || 'operator', now });
  return tagPauseReason(paused, reason, tpl[1]);
}

// --- 51311 hunt hibernation (mid-hunt) ---------------------------------------

/** Deep-freeze a hunt: full state preserved as a JSON-safe snapshot. */
export function hibernate(ctrl, { now } = {}) {
  if (!ctrl || !['paused', 'running'].includes(ctrl.status)) return ctrl;
  const snapshot = JSON.parse(
    JSON.stringify({
      ...ctrl,
      status: 'hibernating',
      hibernatedAt: now,
    })
  );
  return snapshot;
}

/** Wake a hibernated hunt back to paused (operator then resumes). */
export function wakeFromHibernation(snapshot, { now } = {}) {
  if (!snapshot || snapshot.status !== 'hibernating') return snapshot;
  return {
    ...snapshot,
    status: 'paused',
    pausedAt: now,
    wokenAt: now,
    pauseReason: 'manual',
    pauseNote: 'Woken from hibernation',
  };
}

// --- 51312 wake-on-finding ---------------------------------------------------

/** A hibernated hunt wakes if the target changes in a watched way. */
export function shouldWake(watched, changes) {
  if (!watched || !changes) return false;
  return watched.some(w => changes.includes(w));
}

// --- 51313 pause cost display ------------------------------------------------

/** Idle resource cost accrued while the hunt sits paused. */
export function pauseCost(ctrl, costPerMinute, now) {
  if (!ctrl || ctrl.status !== 'paused' || ctrl.pausedAt == null) {
    return { minutes: 0, cost: 0, currency: 'USD' };
  }
  const minutes = Math.max(0, (now - ctrl.pausedAt) / 60_000);
  const rate = Math.max(0, Number(costPerMinute) || 0);
  return {
    minutes: Math.round(minutes * 10) / 10,
    cost: Math.round(minutes * rate * 100) / 100,
    currency: 'USD',
  };
}

// --- 51314 resume with new instructions --------------------------------------

/** Attach fresh steering commands that apply on resume. */
export function resumeWithInstructions(ctrl, instructions, { now } = {}) {
  if (!ctrl) return ctrl;
  const list = Array.isArray(instructions) ? instructions : [instructions];
  const withInstr = {
    ...ctrl,
    newInstructions: [...(ctrl.newInstructions || []), ...list.map(String)],
  };
  return resume(withInstr, { now });
}

// --- 51315 abort-and-clone ---------------------------------------------------

/** Abort this run but clone its config for a fresh hunt later. */
export function cloneHuntConfig(ctrl) {
  if (!ctrl) return null;
  return {
    kind: 'hunt-config-clone',
    fromHunt: ctrl.huntId,
    modules: Object.keys(ctrl.modules || {}),
    targetFingerprint: ctrl.targetFingerprint,
    newInstructions: [...(ctrl.newInstructions || [])],
    note: 'Fresh hunt — no findings, timeline, or pause history carried over.',
  };
}

// --- 51316 pause approval chains ---------------------------------------------

/** Pausing suspends pending approval timers (they don't expire mid-pause). */
export function suspendApprovalTimers(ctrl) {
  if (!ctrl) return ctrl;
  return { ...ctrl, approvalsSuspended: true };
}

export function resumeApprovalTimers(ctrl) {
  if (!ctrl) return ctrl;
  return { ...ctrl, approvalsSuspended: false };
}

// --- 51317 resume conflict check ---------------------------------------------

/** Warn if the target changed while paused before resuming. */
export function checkResumeConflicts(ctrl, currentFingerprint) {
  if (!ctrl) return [];
  const warnings = [];
  if (
    ctrl.targetFingerprint &&
    currentFingerprint &&
    ctrl.targetFingerprint !== currentFingerprint
  ) {
    warnings.push({
      id: 'target-changed',
      severity: 'high',
      text: 'Target fingerprint changed while paused — re-run recon before resuming.',
    });
  }
  if ((ctrl.nextActions || []).length === 0 && ctrl.completedSteps > 0) {
    warnings.push({
      id: 'no-plan',
      severity: 'low',
      text: 'No queued actions — the agent will re-plan on resume.',
    });
  }
  return warnings;
}

// --- 51318 pause screen lock -------------------------------------------------

/** Optionally lock the hunt view while paused (shared screens). */
export function setScreenLocked(ctrl, locked) {
  if (!ctrl) return ctrl;
  return { ...ctrl, screenLocked: !!locked };
}

// --- 51319 abort to report ---------------------------------------------------

/** Abort testing but keep the agent available to finalize the report. */
export function abortToReport(ctrl, { now } = {}) {
  if (!ctrl || !['running', 'paused', 'draining'].includes(ctrl.status)) return ctrl;
  return {
    ...ctrl,
    status: 'reporting',
    abortedAt: now,
    abortCode: 'report-only',
    nextActions: [],
    reportMode: true,
  };
}

// --- 51320 pause analytics ---------------------------------------------------

/** Record a pause/resume lifecycle event for analytics. */
export function recordPauseEvent(log, event) {
  return [...(log || []), { ...event }];
}

/** Aggregate pause analytics: totals, by-reason counts, avg pause length. */
export function pauseAnalytics(log) {
  const events = log || [];
  const pauses = events.filter(e => e.kind === 'paused');
  const resumes = events.filter(e => e.kind === 'resumed');
  const byReason = {};
  pauses.forEach(p => {
    byReason[p.reason] = (byReason[p.reason] || 0) + 1;
  });
  const durations = [];
  for (let i = 0; i < pauses.length; i += 1) {
    const r = resumes.find(x => x.at > pauses[i].at);
    if (r) durations.push(r.at - pauses[i].at);
  }
  const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  return {
    totalPauses: pauses.length,
    totalResumes: resumes.length,
    byReason,
    avgPauseMinutes: Math.round((avgMs / 60_000) * 10) / 10,
  };
}

// --- 51282 log access roles --------------------------------------------------

export const LOG_ROLES = [
  ['owner', 'Owner — full raw logs'],
  ['teammate', 'Teammate — raw logs for shared hunts'],
  ['auditor', 'Auditor — summaries only, no raw lines'],
  ['viewer', 'Viewer — high-level status only'],
];

/** Which teammates may see raw logs versus summaries. */
export function canSeeRawLogs(role) {
  return role === 'owner' || role === 'teammate';
}

/** The log view a role is allowed to see. */
export function visibleLogView(role, lines, summaries) {
  if (canSeeRawLogs(role)) return { mode: 'raw', lines };
  if (role === 'auditor') return { mode: 'summaries', lines: summaries || [] };
  return { mode: 'status', lines: [] };
}

// --- 51283 log retention policies --------------------------------------------

export const RETENTION_POLICIES = [
  ['keep-7d', 'Keep 7 days — then archive'],
  ['keep-30d', 'Keep 30 days — then archive'],
  ['keep-90d', 'Keep 90 days — then archive'],
  ['archive-now', 'Archive now — move everything to cold storage'],
  ['purge-pii', 'Purge PII — drop flagged lines, keep the rest'],
];

/**
 * Apply a retention policy to log lines.
 * Returns { live, archived, purged } — line objects carry `ts` and `pii` flags.
 */
export function applyRetentionPolicy(lines, policy, now) {
  const all = lines || [];
  const DAY = 86_400_000;
  const cutoffDays = { 'keep-7d': 7, 'keep-30d': 30, 'keep-90d': 90 }[policy];
  if (policy === 'archive-now') return { live: [], archived: all, purged: [] };
  if (policy === 'purge-pii') {
    return {
      live: all.filter(l => !l.pii),
      archived: [],
      purged: all.filter(l => l.pii),
    };
  }
  if (cutoffDays != null) {
    const cutoff = now - cutoffDays * DAY;
    return {
      live: all.filter(l => l.ts >= cutoff),
      archived: all.filter(l => l.ts < cutoff),
      purged: [],
    };
  }
  return { live: all, archived: [], purged: [] };
}

// --- 51284 one-click incident package ----------------------------------------

/** Bundle logs, findings, and timeline into a shareable evidence pack. */
export function buildIncidentPackage({ huntId, logs, findings, timeline, builtAt }) {
  const pack = {
    kind: 'incident-package',
    huntId: String(huntId),
    builtAt,
    manifest: {
      logs: (logs || []).length,
      findings: (findings || []).length,
      timelineEvents: (timeline || []).length,
    },
    sections: [
      { id: 'summary', title: 'Incident summary' },
      { id: 'findings', title: 'Findings', count: (findings || []).length },
      { id: 'timeline', title: 'Timeline', count: (timeline || []).length },
      { id: 'logs', title: 'Logs', count: (logs || []).length },
    ],
    shareable: true,
  };
  return pack;
}

// --- 51281 live artifact gallery ---------------------------------------------

export const ARTIFACT_TYPES = ['screenshot', 'response', 'file', 'note'];

/** Append an artifact as it arrives — the gallery grows live. */
export function addArtifact(gallery, artifact) {
  const a = {
    id: `art-${(gallery || []).length + 1}`,
    type: ARTIFACT_TYPES.includes(artifact.type) ? artifact.type : 'note',
    title: String(artifact.title || 'Untitled artifact'),
    capturedAt: artifact.capturedAt,
    meta: artifact.meta || {},
  };
  return [...(gallery || []), a];
}

/** Filter the gallery by type and/or free-text query. */
export function filterArtifacts(gallery, { type, query } = {}) {
  const q = String(query || '').toLowerCase();
  return (gallery || []).filter(a => {
    if (type && type !== 'all' && a.type !== type) return false;
    if (q && !`${a.title} ${a.type}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function artifactCounts(gallery) {
  const counts = { all: (gallery || []).length };
  ARTIFACT_TYPES.forEach(t => {
    counts[t] = (gallery || []).filter(a => a.type === t).length;
  });
  return counts;
}
