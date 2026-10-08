/**
 * governanceCore.js — wave 31 (ideas 51201–51240): approval governance
 * round 2 + live log observability suite — pure logic.
 *
 * Ideas 51201–51228 (approval governance round 2): approval history
 * search, policy inheritance across hunts, granular action scopes,
 * approval-required watermark, dual-control approvals, approval SLAs,
 * contextual approval hints, approval from chat, scheduled approval
 * windows, approval fatigue guard, pre-approved target list,
 * forbidden-target list, approval reason codes, agent self-denial log,
 * approval simulation mode, time-limited approvals, mid-hunt approval
 * revocation, cross-hunt approval rules, approval digest email,
 * legal-hold approvals, approval confidence score, alternative-action
 * suggestion, approval keyboard shortcuts, offline approval queue,
 * approval streaks, destructive-action insurance, approval ceremony
 * log, post-approval monitoring.
 *
 * Ideas 51229–51240 (live log observability): live log stream with
 * millisecond timestamps, log level filter, per-module log tabs, log
 * search, log line details, payload redaction, log highlighting,
 * error-only view, log export, live request inspector, response
 * viewer, log playback at 1x/4x/16x.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic (no Math.random, no Date.now inside).
 */

export const WAVE31_START = 51201;
export const WAVE31_END = 51240;

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE31_IDEAS = [
  [51201, 'approval history search', 'Find any past decision with its context in seconds'],
  [51202, 'policy inheritance', 'New hunts inherit approval policies from previous hunts'],
  [
    51203,
    'granular action scopes',
    'Approve an action for one endpoint without approving it everywhere',
  ],
  [
    51204,
    'approval-required watermark',
    'Hunt header shows a persistent badge while approvals are pending',
  ],
  [51205, 'dual-control approvals', 'Destructive actions need two different people to approve'],
  [51206, 'approval SLAs', 'Target decision time; the agent escalates if you exceed it'],
  [
    51207,
    'contextual approval hints',
    'Plain-words explanation of why this action matters right now',
  ],
  [51208, 'approval from chat', 'Decide directly inside the conversation, no separate panel'],
  [51209, 'scheduled approval windows', 'Approvals only interrupt you during hours you define'],
  [51210, 'approval fatigue guard', 'Agent batches or defers requests when you decide too often'],
  [51211, 'pre-approved target list', 'Actions against listed assets skip approval automatically'],
  [51212, 'forbidden-target list', 'Actions touching listed assets are denied before reaching you'],
  [51213, 'approval reason codes', 'Tag each decision with a reason for later review and learning'],
  [51214, 'agent self-denial log', 'See actions the agent considered but decided not to request'],
  [
    51215,
    'approval simulation mode',
    'Practice the approval flow on a demo hunt before a real one',
  ],
  [51216, 'time-limited approvals', 'An approval grants permission for N minutes, then expires'],
  [
    51217,
    'approval revocation (mid-hunt)',
    'Withdraw an approval while the action is still running',
  ],
  [51218, 'cross-hunt approval rules', 'One policy governing sensitive actions across all hunts'],
  [51219, 'approval digest email', 'Summary of decisions made, sent when the hunt ends'],
  [51220, 'legal-hold approvals', 'Flag approvals that need legal sign-off before execution'],
  [51221, 'approval confidence score', 'Agent shows how sure it is the action is necessary'],
  [51222, 'alternative-action suggestion', 'Each request offers a safer alternative'],
  [
    51223,
    'approval keyboard shortcuts',
    'Approve, deny, or request info without touching the mouse',
  ],
  [51224, 'offline approval queue', 'Decisions made offline sync and apply on reconnect'],
  [51225, 'approval streaks', 'Agent learns your patterns and pre-fills likely decisions'],
  [
    51226,
    'destructive-action insurance',
    'Snapshot target state before approved destructive tests',
  ],
  [51227, 'approval ceremony log', 'Formal record of approvals for regulated environments'],
  [51228, 'post-approval monitoring', 'Watch the action live effects with a kill switch at hand'],
  [51229, 'live log stream', 'Every tool invocation and result streaming in real time'],
  [51230, 'log level filter', 'Toggle debug / info / warning / error to control noise'],
  [
    51231,
    'per-module log tabs',
    'Separate live streams for recon, scanning, exploitation, reporting',
  ],
  [51232, 'log search', 'Instant full-text search across live and historical log buffer'],
  [51233, 'log line details', 'Expand any line to see request, response, and agent reasoning'],
  [51234, 'payload redaction', 'Sensitive values in logs masked automatically, reveal on click'],
  [51235, 'log highlighting', 'Custom rules highlight lines matching patterns you care about'],
  [51236, 'error-only view', 'One click to see only errors and warnings'],
  [51237, 'log export', 'Download the full log as structured JSON or readable text'],
  [51238, 'live request inspector', 'See the actual HTTP requests the agent sends as they go out'],
  [51239, 'response viewer', 'Expand any tool result to inspect the raw response body'],
  [51240, 'log playback', 'Replay the log stream at 1x, 4x, or 16x speed like a video'],
];

// ---------------------------------------------------------------------------
// 51201 — Approval history search
// ---------------------------------------------------------------------------

/**
 * Search past approval decisions by free text across action, target,
 * decider, reason code, and notes. Case-insensitive substring match.
 */
export function searchApprovals(history, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return [...history];
  return history.filter(d => {
    const hay = [d.action, d.target, d.decider, d.reasonCode, d.notes, d.decision]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

// ---------------------------------------------------------------------------
// 51202 — Policy inheritance
// ---------------------------------------------------------------------------

/**
 * Build a new hunt's approval policy set by inheriting the previous
 * hunt's policies, tagging each as inherited (overridable).
 */
export function inheritPolicies(prevPolicies) {
  return (prevPolicies || []).map(p => ({
    ...p,
    inherited: true,
    overridden: false,
  }));
}

// ---------------------------------------------------------------------------
// 51203 — Granular action scopes
// ---------------------------------------------------------------------------

/**
 * Check whether an approval scoped to `scope` (e.g. a single endpoint)
 * authorizes an action against `target`. Exact match or target is a
 * sub-path of the scope.
 */
export function scopeAllows(approval, target) {
  const scope = String(approval.scope || '').replace(/\/+$/, '');
  const t = String(target || '').replace(/\/+$/, '');
  if (!scope) return false;
  return t === scope || t.startsWith(scope + '/');
}

// ---------------------------------------------------------------------------
// 51204 — Approval-required watermark
// ---------------------------------------------------------------------------

/** Count pending approvals to drive the header watermark badge. */
export function pendingApprovalsCount(queue) {
  return (queue || []).filter(a => a.status === 'pending').length;
}

// ---------------------------------------------------------------------------
// 51205 — Dual-control approvals
// ---------------------------------------------------------------------------

/**
 * Evaluate dual-control state for a destructive action: needs two
 * DISTINCT approvers. Returns { approved, approvalsNeeded, approvers }.
 */
export function dualControlStatus(request) {
  const approvers = [...new Set((request.approvals || []).map(a => a.by))];
  return {
    approved: approvers.length >= 2,
    approvalsNeeded: Math.max(0, 2 - approvers.length),
    approvers,
  };
}

// ---------------------------------------------------------------------------
// 51206 — Approval SLAs
// ---------------------------------------------------------------------------

/**
 * SLA state for a pending request: 'on-track' | 'at-risk' | 'breached'.
 * at-risk when >75% of the SLA window has elapsed.
 */
export function slaStatus(request, nowMs) {
  const elapsed = nowMs - request.requestedAt;
  const ratio = request.slaMs > 0 ? elapsed / request.slaMs : 0;
  if (ratio >= 1) return 'breached';
  if (ratio >= 0.75) return 'at-risk';
  return 'on-track';
}

// ---------------------------------------------------------------------------
// 51207 — Contextual approval hints
// ---------------------------------------------------------------------------

/** Build a plain-words hint explaining why an action matters now. */
export function buildHint(action) {
  const why = action.why || 'the agent needs this step to continue the hunt';
  const risk = action.risk || 'cautious';
  return `The agent wants to ${action.verb || 'run'} ${action.target || 'this target'} because ${why}. Risk level: ${risk}.`;
}

// ---------------------------------------------------------------------------
// 51208 — Approval from chat
// ---------------------------------------------------------------------------

/**
 * Parse a chat message into an approval decision:
 * 'approve' | 'deny' | 'info' | null (not a decision).
 */
export function parseChatDecision(text) {
  const t = String(text || '')
    .trim()
    .toLowerCase();
  if (/^(yes|approve|approved|go ahead|ok|okay|do it|allow)\b/.test(t)) return 'approve';
  if (/^(no|deny|denied|don't|stop|block|reject)\b/.test(t)) return 'deny';
  if (/\b(why|explain|more info|details|what)\b/.test(t)) return 'info';
  return null;
}

// ---------------------------------------------------------------------------
// 51209 — Scheduled approval windows
// ---------------------------------------------------------------------------

/**
 * Check whether `nowMs` falls inside any approval window.
 * Windows: [{ startHour, endHour }] in 0–23 (end exclusive; wraps midnight).
 */
export function inApprovalWindow(nowMs, windows) {
  if (!windows || windows.length === 0) return true; // no windows = always allowed
  const d = new Date(nowMs);
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  return windows.some(w => {
    if (w.startHour <= w.endHour) return h >= w.startHour && h < w.endHour;
    return h >= w.startHour || h < w.endHour; // wraps midnight
  });
}

// ---------------------------------------------------------------------------
// 51210 — Approval fatigue guard
// ---------------------------------------------------------------------------

/**
 * Fatigue level from decision count in a trailing window:
 * 'fresh' | 'warming' | 'fatigued'. Fatigued → suggest batching.
 */
export function fatigueLevel(decisions, nowMs, windowMs = 15 * 60 * 1000) {
  const recent = (decisions || []).filter(d => nowMs - d.at <= windowMs).length;
  if (recent >= 10) return 'fatigued';
  if (recent >= 5) return 'warming';
  return 'fresh';
}

// ---------------------------------------------------------------------------
// 51211 / 51212 — Pre-approved & forbidden target lists
// ---------------------------------------------------------------------------

/**
 * Check a target against allow/deny lists.
 * Returns 'pre-approved' | 'forbidden' | 'needs-approval'.
 * Forbidden wins over pre-approved.
 */
export function checkTargetLists(target, preApproved, forbidden) {
  const t = String(target || '').toLowerCase();
  const hit = list => (list || []).some(e => t.includes(String(e).toLowerCase()));
  if (hit(forbidden)) return 'forbidden';
  if (hit(preApproved)) return 'pre-approved';
  return 'needs-approval';
}

// ---------------------------------------------------------------------------
// 51213 — Approval reason codes
// ---------------------------------------------------------------------------

/** Validate a reason code against the allowed set. */
export function validateReasonCode(code, allowedCodes) {
  return (allowedCodes || []).includes(code);
}

// ---------------------------------------------------------------------------
// 51214 — Agent self-denial log
// ---------------------------------------------------------------------------

/** Filter the agent's internal log to actions it considered but skipped. */
export function filterSelfDenials(log) {
  return (log || []).filter(e => e.outcome === 'self-denied');
}

// ---------------------------------------------------------------------------
// 51215 — Approval simulation mode
// ---------------------------------------------------------------------------

/** Whether a hunt is a simulation (practice) hunt. */
export function isSimulationMode(hunt) {
  return Boolean(hunt && hunt.simulation === true);
}

// ---------------------------------------------------------------------------
// 51216 — Time-limited approvals
// ---------------------------------------------------------------------------

/** Whether a time-boxed approval grant has expired at nowMs. */
export function isApprovalExpired(grant, nowMs) {
  if (!grant || !grant.minutes) return false;
  return nowMs - grant.grantedAt >= grant.minutes * 60 * 1000;
}

// ---------------------------------------------------------------------------
// 51217 — Approval revocation (mid-hunt)
// ---------------------------------------------------------------------------

/** An approval can be revoked while its action is running (not done). */
export function canRevoke(approval) {
  return approval.status === 'approved' && approval.actionState === 'running';
}

// ---------------------------------------------------------------------------
// 51218 — Cross-hunt approval rules
// ---------------------------------------------------------------------------

/**
 * Apply cross-hunt rules to an action. First matching rule decides:
 * returns 'allow' | 'deny' | 'needs-approval'.
 */
export function applyCrossHuntRules(action, rules) {
  for (const r of rules || []) {
    const matchAction = !r.action || r.action === action.type;
    const matchTarget = !r.targetPattern || String(action.target || '').includes(r.targetPattern);
    if (matchAction && matchTarget) return r.decision;
  }
  return 'needs-approval';
}

// ---------------------------------------------------------------------------
// 51219 — Approval digest email
// ---------------------------------------------------------------------------

/** Build a digest summary of decisions for the end-of-hunt email. */
export function buildDigest(decisions) {
  const counts = { approve: 0, deny: 0, info: 0 };
  for (const d of decisions || []) {
    if (counts[d.decision] !== undefined) counts[d.decision] += 1;
  }
  return {
    total: (decisions || []).length,
    ...counts,
    lines: (decisions || []).map(
      d =>
        `${d.decision.toUpperCase()}: ${d.action} on ${d.target} (${d.reasonCode || 'no reason'})`
    ),
  };
}

// ---------------------------------------------------------------------------
// 51220 — Legal-hold approvals
// ---------------------------------------------------------------------------

/** Whether an approval needs legal sign-off before execution. */
export function needsLegalSignoff(approval) {
  return Boolean(approval.legalHold) && !approval.legalSignedOff;
}

// ---------------------------------------------------------------------------
// 51221 — Approval confidence score
// ---------------------------------------------------------------------------

/** Map a 0–100 confidence score to a band label. */
export function confidenceBand(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// 51222 — Alternative-action suggestion
// ---------------------------------------------------------------------------

/**
 * Suggest a safer alternative for a requested action.
 * Returns null when the action is already the safest option.
 */
export function suggestAlternative(action) {
  const safer = {
    'active-scan': {
      type: 'passive-scan',
      note: 'Passive scan first — no packets sent to the target.',
    },
    exploit: { type: 'poc-dry-run', note: 'Dry-run the PoC against a local replica instead.' },
    'brute-force': {
      type: 'wordlist-sample',
      note: 'Try a 100-entry sample before the full list.',
    },
  };
  return safer[action.type] || null;
}

// ---------------------------------------------------------------------------
// 51223 — Approval keyboard shortcuts
// ---------------------------------------------------------------------------

/** Default keyboard shortcut map for approval decisions. */
export function shortcutMap() {
  return { approve: 'A', deny: 'D', info: 'I', snooze: 'S' };
}

// ---------------------------------------------------------------------------
// 51224 — Offline approval queue
// ---------------------------------------------------------------------------

/** Queue a decision made offline; flush applies them in order on reconnect. */
export function queueOfflineDecision(queue, decision) {
  return [...(queue || []), { ...decision, queuedAt: decision.queuedAt ?? 0, synced: false }];
}

export function flushOfflineQueue(queue) {
  const ordered = [...(queue || [])].sort((a, b) => a.queuedAt - b.queuedAt);
  return { applied: ordered.map(d => ({ ...d, synced: true })), remaining: [] };
}

// ---------------------------------------------------------------------------
// 51225 — Approval streaks
// ---------------------------------------------------------------------------

/**
 * Predict the likely decision for an action type from history streaks.
 * Returns the most common past decision, or null when no history.
 */
export function predictDecision(history, actionType) {
  const relevant = (history || []).filter(d => d.action === actionType);
  if (relevant.length === 0) return null;
  const counts = {};
  for (const d of relevant) counts[d.decision] = (counts[d.decision] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ---------------------------------------------------------------------------
// 51226 — Destructive-action insurance
// ---------------------------------------------------------------------------

/** Build a snapshot plan (insurance) before an approved destructive test. */
export function insurancePlan(action) {
  return {
    target: action.target,
    snapshotAt: action.approvedAt ?? 0,
    items: ['config', 'database', 'filesystem-manifest'],
    rollbackNote: `Restore ${action.target} from snapshot if the test causes damage.`,
  };
}

// ---------------------------------------------------------------------------
// 51227 — Approval ceremony log
// ---------------------------------------------------------------------------

/** Format a formal ceremony-log entry for regulated environments. */
export function ceremonyEntry(decision) {
  return [
    `CEREMONY ${decision.id}`,
    `action=${decision.action}`,
    `target=${decision.target}`,
    `decision=${decision.decision}`,
    `by=${decision.decider}`,
    `at=${new Date(decision.at).toISOString()}`,
    `reason=${decision.reasonCode || 'n/a'}`,
  ].join(' | ');
}

// ---------------------------------------------------------------------------
// 51228 — Post-approval monitoring
// ---------------------------------------------------------------------------

/**
 * Monitoring state for an approved running action.
 * Returns { watching, killSwitchArmed, note }.
 */
export function monitoringState(action) {
  const running = action.actionState === 'running';
  return {
    watching: running,
    killSwitchArmed: running && action.risk === 'destructive',
    note: running
      ? `Monitoring ${action.type} on ${action.target} — kill switch ready.`
      : 'Action not running.',
  };
}

// ---------------------------------------------------------------------------
// 51229 — Live log stream
// ---------------------------------------------------------------------------

const LOG_LEVELS = ['debug', 'info', 'warning', 'error'];

/** Format a log entry with millisecond timestamp: [HH:MM:SS.mmm]. */
export function formatLogLine(entry) {
  const d = new Date(entry.at);
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const ts = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
  return `[${ts}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}`;
}

// ---------------------------------------------------------------------------
// 51230 — Log level filter
// ---------------------------------------------------------------------------

/** Keep lines at or above the chosen severity level. */
export function filterByLevel(lines, minLevel) {
  const minIdx = LOG_LEVELS.indexOf(minLevel);
  if (minIdx < 0) return [...lines];
  return (lines || []).filter(l => LOG_LEVELS.indexOf(l.level) >= minIdx);
}

// ---------------------------------------------------------------------------
// 51231 — Per-module log tabs
// ---------------------------------------------------------------------------

/** Group log lines by module (recon, scanning, exploitation, reporting…). */
export function groupByModule(lines) {
  const groups = {};
  for (const l of lines || []) {
    const m = l.module || 'other';
    if (!groups[m]) groups[m] = [];
    groups[m].push(l);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// 51232 — Log search
// ---------------------------------------------------------------------------

/** Full-text search across message, module, and detail fields. */
export function searchLogs(lines, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return [...(lines || [])];
  return (lines || []).filter(l =>
    [l.message, l.module, l.detail].filter(Boolean).join(' ').toLowerCase().includes(q)
  );
}

// ---------------------------------------------------------------------------
// 51233 — Log line details
// ---------------------------------------------------------------------------

/** Expand a log line into request / response / reasoning detail view. */
export function expandLine(line) {
  return {
    summary: formatLogLine(line),
    request: line.request || null,
    response: line.response || null,
    reasoning: line.reasoning || null,
    hasDetails: Boolean(line.request || line.response || line.reasoning),
  };
}

// ---------------------------------------------------------------------------
// 51234 — Payload redaction
// ---------------------------------------------------------------------------

const SECRET_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'session',
];

/**
 * Mask sensitive values in a log string. Returns { text, redactedCount }.
 * Matches key=value, key: value, and "key": "value" shapes.
 */
export function redactPayloads(text) {
  let count = 0;
  const pattern = new RegExp(
    `(["']?)(${SECRET_KEYS.join('|')})(["']?)\\s*[:=]\\s*(["']?)([^\\s,"'}\\]]+)(["']?)`,
    'gi'
  );
  const out = String(text || '').replace(pattern, (_m, q1, key, q2, q3, _val, q4) => {
    count += 1;
    return `${q1}${key}${q2}: ${q3}•••${q4}`;
  });
  return { text: out, redactedCount: count };
}

// ---------------------------------------------------------------------------
// 51235 — Log highlighting
// ---------------------------------------------------------------------------

/**
 * Apply highlight rules: [{ pattern (regex string), label }].
 * Returns lines annotated with matched rule labels.
 */
export function applyHighlightRules(lines, rules) {
  return (lines || []).map(l => {
    const matched = (rules || [])
      .filter(r => {
        try {
          return new RegExp(r.pattern, 'i').test(l.message);
        } catch {
          return false;
        }
      })
      .map(r => r.label);
    return { ...l, highlights: matched };
  });
}

// ---------------------------------------------------------------------------
// 51236 — Error-only view
// ---------------------------------------------------------------------------

/** Keep only warning and error lines. */
export function errorOnlyView(lines) {
  return (lines || []).filter(l => l.level === 'warning' || l.level === 'error');
}

// ---------------------------------------------------------------------------
// 51237 — Log export
// ---------------------------------------------------------------------------

/**
 * Export log lines as structured JSON or readable text.
 * Returns { format, content, lineCount }.
 */
export function exportLogs(lines, format) {
  const arr = lines || [];
  if (format === 'json') {
    return { format, content: JSON.stringify(arr, null, 2), lineCount: arr.length };
  }
  return { format: 'text', content: arr.map(formatLogLine).join('\n'), lineCount: arr.length };
}

// ---------------------------------------------------------------------------
// 51238 — Live request inspector
// ---------------------------------------------------------------------------

/** Summarize an outgoing HTTP request entry for the inspector panel. */
export function inspectRequest(entry) {
  return {
    method: entry.method || 'GET',
    url: entry.url || '',
    headers: entry.headers || {},
    bodyPreview: entry.body ? String(entry.body).slice(0, 200) : null,
    at: entry.at,
  };
}

// ---------------------------------------------------------------------------
// 51239 — Response viewer
// ---------------------------------------------------------------------------

/** Prepare a tool result for raw-body inspection. */
export function formatResponse(result) {
  const body = result.body ?? result.output ?? '';
  const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  return {
    status: result.status ?? null,
    truncated: text.length > 4000,
    preview: text.slice(0, 4000),
    fullLength: text.length,
  };
}

// ---------------------------------------------------------------------------
// 51240 — Log playback
// ---------------------------------------------------------------------------

const PLAYBACK_SPEEDS = [1, 4, 16];

/** Allowed playback speeds. */
export function playbackSpeeds() {
  return [...PLAYBACK_SPEEDS];
}

/**
 * Compute playback schedule: each line's delay scaled by speed.
 * Returns [{ line, delayMs }] where delayMs is ms after stream start.
 */
export function playbackSchedule(lines, speed) {
  const s = PLAYBACK_SPEEDS.includes(speed) ? speed : 1;
  const arr = lines || [];
  if (arr.length === 0) return [];
  const t0 = arr[0].at;
  return arr.map(l => ({ line: l, delayMs: Math.max(0, Math.round((l.at - t0) / s)) }));
}
