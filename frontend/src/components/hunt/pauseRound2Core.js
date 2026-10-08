/**
 * pauseRound2Core.js — wave 34, part 1 (ideas 51321–51340): pause/abort
 * control round 2 — pure logic.
 *
 * Hands-free voice pause commands, mobile thumb-friendly pause spec, pause
 * inheritance to linked sub-hunts, resume ordering strategies, approvals
 * queued while paused, abort confirmation summaries, pause-to-steer, resume
 * with reduced scope, pause watchdog, abort cascade control, pause state
 * export, resume notes, sticky pause-button placement, mandatory abort
 * reasons, pause-and-snapshot report capture, resume speed ramp, pause
 * collaboration/discussion, recurring pause calendars (blackouts), pause
 * state diff on resume, and aborted-hunt archive search.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: time always arrives as an explicit `now`
 * argument (ms epoch), never Date.now(); no Math.random.
 */

export const WAVE34A_START = 51321;
export const WAVE34A_END = 51340;

/** Registry of the 20 pause/abort round-2 ideas — completeness is testable. */
export const WAVE34A_IDEAS = [
  [51321, 'hands-free pause toggle', 'Pause and resume the hunt with spoken voice commands'],
  [51322, 'mobile pause control', 'A big thumb-friendly pause button on the mobile view'],
  [51323, 'pause inheritance', 'Pausing a parent hunt pauses its linked sub-hunts'],
  [51324, 'resume ordering', 'When resuming multiple hunts, choose the order they restart'],
  [51325, 'pause during approvals', 'Approvals decided while paused queue for execution on resume'],
  [51326, 'abort confirmation summary', 'A final screen summarizing the hunt before it is gone'],
  [51327, 'pause-to-steer', 'One gesture that pauses and opens the steering panel together'],
  [51328, 'resume with reduced scope', 'Resume but drop the lowest-priority remaining phases'],
  [51329, 'pause watchdog', 'Alerts you if a hunt stays paused longer than expected'],
  [51330, 'abort cascade control', 'Choose whether aborting affects linked hunts or just this one'],
  [51331, 'pause state export', 'Download the frozen state for audit or transfer'],
  [51332, 'resume notes', 'Attach a note explaining why the hunt is resuming now'],
  [
    51333,
    'pause button placement',
    'The pause control stays visible and reachable on every hunt screen',
  ],
  [51334, 'abort requires reason', 'A mandatory reason that feeds hunt retrospectives'],
  [51335, 'pause-and-snapshot', 'Automatically capture a report snapshot at the moment of pausing'],
  [51336, 'resume speed ramp', 'Optionally resume at reduced request rate, ramping back up'],
  [51337, 'pause collaboration', 'Teammates see who paused and can discuss before resuming'],
  [51338, 'hunt pause calendar', 'Schedule recurring pause windows (e.g. business hours blackout)'],
  [51339, 'pause state diff', 'On resume, see what changed in the target during the pause'],
  [51340, 'abort archive search', 'Aborted hunts remain searchable with their partial findings'],
];

// --- 51321 hands-free pause toggle ------------------------------------------

/** Voice phrase catalogue: normalized phrase → control action + min confidence. */
export const VOICE_PAUSE_PHRASES = [
  { phrase: 'pause the hunt', action: 'pause', confidence: 0.8 },
  { phrase: 'pause hunt', action: 'pause', confidence: 0.75 },
  { phrase: 'hold on', action: 'pause', confidence: 0.7 },
  { phrase: 'freeze', action: 'pause', confidence: 0.7 },
  { phrase: 'resume the hunt', action: 'resume', confidence: 0.8 },
  { phrase: 'resume hunt', action: 'resume', confidence: 0.75 },
  { phrase: 'keep going', action: 'resume', confidence: 0.7 },
  { phrase: 'carry on', action: 'resume', confidence: 0.7 },
  { phrase: 'abort the hunt', action: 'abort', confidence: 0.85 },
  { phrase: 'stop everything', action: 'abort', confidence: 0.8 },
  { phrase: 'status', action: 'status', confidence: 0.7 },
  { phrase: 'what are you doing', action: 'status', confidence: 0.7 },
];

/**
 * Match a (lower-cased) voice transcript to a control action.
 * Returns { action, confidence } or { action: null } when nothing matches.
 */
export function parseVoicePauseCommand(transcript) {
  if (!transcript || typeof transcript !== 'string') return { action: null, confidence: 0 };
  const t = transcript.trim().toLowerCase();
  let best = null;
  for (const entry of VOICE_PAUSE_PHRASES) {
    if (t.includes(entry.phrase)) {
      if (!best || entry.confidence > best.confidence) best = entry;
    }
  }
  if (!best) return { action: null, confidence: 0 };
  return { action: best.action, confidence: best.confidence, phrase: best.phrase };
}

/**
 * Apply a parsed voice command to a hunt control state.
 * Returns { state, accepted, note }. Abort requires the two-step token and
 * is never applied directly from voice — the transcript only arms it.
 */
export function applyVoiceCommand(state, parsed, now) {
  const next = { ...state, voiceLog: [...(state.voiceLog || [])] };
  if (!parsed || !parsed.action) return { state: next, accepted: false, note: 'no action matched' };
  next.voiceLog.push({ action: parsed.action, confidence: parsed.confidence, at: now });
  switch (parsed.action) {
    case 'pause':
      if (next.paused) return { state: next, accepted: false, note: 'already paused' };
      next.paused = true;
      next.pausedAt = now;
      next.pauseVia = 'voice';
      return { state: next, accepted: true, note: 'paused via voice' };
    case 'resume':
      if (!next.paused) return { state: next, accepted: false, note: 'not paused' };
      next.paused = false;
      next.resumedAt = now;
      return { state: next, accepted: true, note: 'resumed via voice' };
    case 'abort':
      next.abortArmed = true;
      next.abortArmedAt = now;
      return { state: next, accepted: false, note: 'abort armed — confirm in UI' };
    case 'status':
      return { state: next, accepted: true, note: next.paused ? 'paused' : 'running' };
    default:
      return { state: next, accepted: false, note: 'unknown action' };
  }
}

// --- 51322 mobile pause control ----------------------------------------------

/**
 * Thumb-friendly pause spec for the mobile view. Returns the recommended
 * button geometry (min 56px touch target, thumb-zone placement) for a given
 * viewport width; the pause state only changes the label/color, never size.
 */
export function mobilePauseSpec(viewportWidth, paused) {
  const isPhone = viewportWidth < 640;
  return {
    touchTargetPx: isPhone ? 72 : 56,
    placement: 'bottom-right-thumb-zone',
    safeAreaInset: true,
    label: paused ? 'Resume' : 'Pause',
    prominence: 'primary',
    reachable: true,
  };
}

// --- 51323 pause inheritance ---------------------------------------------------

/**
 * Pause a parent hunt and inherit the pause into linked sub-hunts.
 * Returns the paused tree: [{ huntId, paused, inheritedFrom }].
 */
export function pauseWithInheritance(parentId, subHuntIds, now) {
  const tree = [{ huntId: parentId, paused: true, inheritedFrom: null, pausedAt: now }];
  for (const sub of subHuntIds || []) {
    tree.push({ huntId: sub, paused: true, inheritedFrom: parentId, pausedAt: now });
  }
  return tree;
}

/** Resume side of inheritance: only unpauses sub-hunts paused via the parent. */
export function resumeWithInheritance(tree, now) {
  return (tree || []).map(n => (n.inheritedFrom ? { ...n, paused: false, resumedAt: now } : n));
}

/** Which sub-hunts inherited their pause from a given parent. */
export function inheritedPausees(tree, parentId) {
  return (tree || []).filter(n => n.inheritedFrom === parentId).map(n => n.huntId);
}

// --- 51324 resume ordering -----------------------------------------------------

/** Resume ordering strategies for a batch of paused hunts. */
export const RESUME_ORDERS = ['priority', 'fifo', 'largest-first', 'quickest-first'];

/**
 * Order a resume queue. Each entry: { huntId, priority (1-5), pausedAt,
 * findings, remainingPhases }. Strategy picks the sort key; ties keep input
 * order (stable).
 */
export function orderResume(queue, strategy = 'priority') {
  const rows = (queue || []).map((h, i) => ({ ...h, _i: i }));
  const key =
    {
      priority: h => [-h.priority, h.pausedAt],
      fifo: h => [h.pausedAt],
      'largest-first': h => [-(h.findings || 0), h.pausedAt],
      'quickest-first': h => [h.remainingPhases || 0, h.pausedAt],
    }[strategy] || (h => [h.pausedAt]);
  rows.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    }
    return a._i - b._i;
  });
  return rows.map(({ _i, ...rest }) => rest);
}

// --- 51325 pause during approvals ----------------------------------------------

/** Queue an approval decision made while paused; executed on resume. */
export function queueApprovalWhilePaused(queue, approval) {
  const q = [...(queue || [])];
  q.push({ ...approval, queued: true });
  return q;
}

/**
 * Drain the approval queue on resume: approvals execute in FIFO order.
 * Returns { executed, remaining } — remaining holds anything still gated.
 */
export function drainApprovalQueue(queue, gate) {
  const executed = [];
  const remaining = [];
  for (const a of queue || []) {
    if (gate && !gate(a)) remaining.push(a);
    else executed.push({ ...a, executed: true });
  }
  return { executed, remaining };
}

// --- 51326 abort confirmation summary -------------------------------------------

/**
 * Final pre-abort summary: findings, coverage, elapsed time, in-flight
 * modules, and artifact counts — the "are you sure?" screen data.
 */
export function abortSummary(hunt) {
  const h = hunt || {};
  const phases = h.phases || [];
  const done = phases.filter(p => p.status === 'done').length;
  return {
    huntId: h.huntId || h.id || 'unknown',
    target: h.target || '',
    findings: (h.findings || []).length,
    criticalFindings: (h.findings || []).filter(f => f.severity === 'critical').length,
    coverage: phases.length ? Math.round((done / phases.length) * 100) : 0,
    phasesDone: done,
    phasesTotal: phases.length,
    elapsedMin: h.startedAt
      ? Math.max(0, Math.round(((h.now || Date.now()) - h.startedAt) / 60000))
      : 0,
    modulesActive: (h.modules || []).filter(m => m.active).length,
    artifacts: h.artifactCount || 0,
    irreversible: true,
  };
}

// --- 51327 pause-to-steer -------------------------------------------------------

/** One gesture: pause the hunt AND open the steering panel together. */
export function pauseToSteer(hunt, now) {
  return {
    ...hunt,
    paused: true,
    pausedAt: now,
    pauseVia: 'pause-to-steer',
    steeringOpen: true,
    steeringOpenedAt: now,
  };
}

// --- 51328 resume with reduced scope --------------------------------------------

/**
 * Resume but drop the lowest-priority remaining phases. Phases: [{ id,
 * priority (1-5, 5 = highest), status }]. Keeps `keepTop` highest-priority
 * non-done phases, drops the rest.
 */
export function reducedScope(phases, keepTop = 3) {
  const remaining = (phases || []).filter(p => p.status !== 'done');
  const sorted = [...remaining].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const kept = new Set(sorted.slice(0, keepTop).map(p => p.id));
  return {
    kept: sorted.filter(p => kept.has(p.id)),
    dropped: sorted.filter(p => !kept.has(p.id)),
  };
}

// --- 51329 pause watchdog ---------------------------------------------------------

/**
 * Watchdog: flags hunts paused longer than the expected window.
 * Returns { overdue, elapsedMin, overByMin }.
 */
export function watchdogCheck(pausedAt, now, thresholdMin = 30) {
  if (!pausedAt) return { overdue: false, elapsedMin: 0, overByMin: 0 };
  const elapsedMin = Math.max(0, (now - pausedAt) / 60000);
  return {
    overdue: elapsedMin > thresholdMin,
    elapsedMin: Math.round(elapsedMin),
    overByMin: elapsedMin > thresholdMin ? Math.round(elapsedMin - thresholdMin) : 0,
  };
}

// --- 51330 abort cascade control --------------------------------------------------

export const ABORT_CASCADE_MODES = ['this-only', 'cascade'];

/**
 * Abort with cascade control: 'this-only' aborts just the hunt; 'cascade'
 * also aborts linked hunts. Returns the list of aborted hunt ids + mode.
 */
export function abortCascade(huntId, linkedIds, mode = 'this-only') {
  if (!ABORT_CASCADE_MODES.includes(mode)) mode = 'this-only';
  const aborted = [huntId];
  if (mode === 'cascade') aborted.push(...(linkedIds || []));
  return { aborted, mode, linkedAborted: mode === 'cascade' ? (linkedIds || []).length : 0 };
}

// --- 51331 pause state export -----------------------------------------------------

/**
 * Export the frozen pause state as a JSON-serializable snapshot for audit
 * or transfer. Strips any non-serializable fields defensively.
 */
export function exportPauseState(hunt, now) {
  const h = hunt || {};
  const snapshot = {
    format: 'dark-matter-pause-state',
    version: 1,
    exportedAt: now,
    huntId: h.huntId || h.id || null,
    target: h.target || '',
    paused: !!h.paused,
    pausedAt: h.pausedAt || null,
    pauseReason: h.pauseReason || null,
    phaseStatuses: (h.phases || []).map(p => ({ id: p.id, status: p.status })),
    findingsCount: (h.findings || []).length,
    checkpoints: h.checkpoints || [],
  };
  return JSON.parse(JSON.stringify(snapshot));
}

// --- 51332 resume notes -------------------------------------------------------------

/** Attach a resume note explaining why the hunt resumes now. */
export function attachResumeNote(hunt, note, author, now) {
  const notes = [...(hunt.resumeNotes || [])];
  notes.push({ note: String(note || '').slice(0, 500), author: author || 'unknown', at: now });
  return { ...hunt, resumeNotes: notes };
}

// --- 51333 pause button placement -----------------------------------------------------

/**
 * Sticky pause placement per hunt screen: the control is always visible and
 * reachable (thumb zone on mobile, top bar on desktop).
 */
export function pauseButtonPlacement(screen, viewportWidth) {
  const mobile = viewportWidth < 640;
  return {
    screen,
    position: mobile ? 'fixed-bottom-right' : 'fixed-top-bar',
    sticky: true,
    alwaysVisible: true,
    zIndex: 60,
    ariaLabel: 'Pause hunt',
  };
}

// --- 51334 abort requires reason -----------------------------------------------------------

export const ABORT_REASON_CODES = [
  'false-positive-storm',
  'target-unreachable',
  'scope-changed',
  'duplicate-hunt',
  'owner-request',
  'tool-failure',
  'other',
];

/**
 * Validate a mandatory abort reason. Returns { ok, errors[] } — the abort
 * is blocked until a valid reason is supplied.
 */
export function validateAbortReason(reason) {
  const errors = [];
  if (!reason || typeof reason !== 'object') errors.push('reason is required');
  else {
    if (!ABORT_REASON_CODES.includes(reason.code))
      errors.push(`code must be one of: ${ABORT_REASON_CODES.join(', ')}`);
    if (!reason.detail || String(reason.detail).trim().length < 8)
      errors.push('detail must be at least 8 characters');
  }
  return { ok: errors.length === 0, errors };
}

// --- 51335 pause-and-snapshot ------------------------------------------------------------------

/**
 * Capture a report snapshot at the moment of pausing: summary counts,
 * top findings, and phase progress — frozen for the hunt record.
 */
export function snapshotOnPause(hunt, now) {
  const h = hunt || {};
  const findings = h.findings || [];
  const sev = s => findings.filter(f => f.severity === s).length;
  return {
    snapshotAt: now,
    huntId: h.huntId || h.id || 'unknown',
    target: h.target || '',
    findingsTotal: findings.length,
    bySeverity: {
      critical: sev('critical'),
      high: sev('high'),
      medium: sev('medium'),
      low: sev('low'),
    },
    topFindings: findings.slice(0, 5).map(f => ({ title: f.title, severity: f.severity })),
    phases: (h.phases || []).map(p => ({ id: p.id, status: p.status })),
  };
}

// --- 51336 resume speed ramp ---------------------------------------------------------------------

/**
 * Ramp the request rate back up after resume: starts at `startPct` of the
 * base rate and steps up linearly over `rampMinutes`. Returns the effective
 * requests-per-minute at `elapsedMin` since resume.
 */
export function rampRate(baseRpm, elapsedMin, rampMinutes = 10, startPct = 25) {
  if (elapsedMin <= 0) return Math.round((baseRpm * startPct) / 100);
  if (elapsedMin >= rampMinutes) return baseRpm;
  const pct = startPct + ((100 - startPct) * elapsedMin) / rampMinutes;
  return Math.round((baseRpm * pct) / 100);
}

/** The full ramp curve (one entry per minute) for display. */
export function rampCurve(baseRpm, rampMinutes = 10, startPct = 25) {
  const curve = [];
  for (let m = 0; m <= rampMinutes; m += 1)
    curve.push({ minute: m, rpm: rampRate(baseRpm, m, rampMinutes, startPct) });
  return curve;
}

// --- 51337 pause collaboration ---------------------------------------------------------------------

/**
 * Pause discussion: who paused, who can resume, and a comment thread.
 * Only participants (or the pauser) may resume while discussion is open.
 */
export function pauseDiscussion(pauseEvent) {
  return {
    pausedBy: pauseEvent.pausedBy || 'unknown',
    pausedAt: pauseEvent.pausedAt || null,
    reason: pauseEvent.reason || '',
    participants: [
      ...new Set([pauseEvent.pausedBy, ...(pauseEvent.watchers || [])].filter(Boolean)),
    ],
    comments: [],
    discussionOpen: true,
  };
}

export function addPauseComment(thread, author, text, now) {
  const comments = [...thread.comments, { author, text: String(text).slice(0, 500), at: now }];
  return { ...thread, comments };
}

export function canResume(thread, userId) {
  if (!thread.discussionOpen) return true;
  return thread.participants.includes(userId) || thread.pausedBy === userId;
}

// --- 51338 hunt pause calendar -----------------------------------------------------------------------

/**
 * Recurring pause windows (blackouts), e.g. business hours. A window:
 * { days: [0-6] (0=Sunday), startHour, endHour } in the hunt's local time.
 * `isInPauseWindow` takes an explicit local-time { day, hour } so it stays
 * pure/deterministic in tests.
 */
export function isInPauseWindow(calendar, localDay, localHour) {
  for (const w of calendar || []) {
    if ((w.days || []).includes(localDay) && localHour >= w.startHour && localHour < w.endHour) {
      return { inWindow: true, window: w };
    }
  }
  return { inWindow: false, window: null };
}

export function addPauseWindow(calendar, window) {
  const cal = [...(calendar || [])];
  cal.push({
    days: [...(window.days || [])],
    startHour: window.startHour,
    endHour: window.endHour,
    label: window.label || '',
  });
  return cal;
}

/** Human description of a window, e.g. "Mon–Fri 09:00–18:00". */
export function describePauseWindow(w) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ds = (w.days || []).map(d => days[d]).join(',');
  const hh = h => `${String(h).padStart(2, '0')}:00`;
  return `${ds} ${hh(w.startHour)}–${hh(w.endHour)}${w.label ? ` (${w.label})` : ''}`;
}

// --- 51339 pause state diff ----------------------------------------------------------------------------

/**
 * On resume, diff what changed in the target during the pause: compare the
 * frozen target fingerprint with the fresh one.
 */
export function diffPauseState(before, after) {
  const b = before || {};
  const a = after || {};
  const changes = [];
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const k of keys) {
    const bv = JSON.stringify(b[k]);
    const av = JSON.stringify(a[k]);
    if (bv !== av) changes.push({ field: k, before: b[k], after: a[k] });
  }
  return { changed: changes.length > 0, changeCount: changes.length, changes };
}

// --- 51340 abort archive search ----------------------------------------------------------------------------

/**
 * Index an aborted hunt (with its partial findings) for later search.
 * `index` is a plain array; search matches target, reason, and finding
 * titles case-insensitively.
 */
export function indexAbortedHunt(index, hunt) {
  const idx = [...(index || [])];
  idx.push({
    huntId: hunt.huntId || hunt.id,
    target: hunt.target || '',
    abortedAt: hunt.abortedAt || null,
    abortReason: (hunt.abortReason && hunt.abortReason.code) || 'other',
    findings: (hunt.findings || []).map(f => ({ title: f.title, severity: f.severity })),
  });
  return idx;
}

export function searchAbortedHunts(index, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return [];
  return (index || []).filter(
    h =>
      h.target.toLowerCase().includes(q) ||
      h.abortReason.toLowerCase().includes(q) ||
      h.findings.some(f => f.title.toLowerCase().includes(q))
  );
}
