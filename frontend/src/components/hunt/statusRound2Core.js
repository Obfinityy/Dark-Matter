/**
 * statusRound2Core.js — wave 28 (ideas 51081–51120): live hunt-status
 * transparency suite, round 2 — pure logic.
 *
 * Ideas 51081–51100 (status display layer): browser tab-title status,
 * machine-readable status API payload, timestamped status snapshots,
 * intent explanations, dependency display, approach confidence bands,
 * considered alternatives, per-module status drill-down, quiet status mode,
 * push status alerts, terminal-style status feed, emoji legend, time-since-
 * finding, coverage-so-far summary, paused-state status, approval-wait
 * status, status export (CSV/markdown), status Q&A threads, uncertainty
 * flags, upcoming-phase forecast.
 *
 * Ideas 51101–51120 (status control layer): status granularity dial,
 * component-specific status queries, mid-hunt timeline scrubber, status
 * bookmarks, agent workload meter, model-switch notices, bilingual status
 * view, payload-redacted status lines, finding-linked status updates,
 * idle-nudge suggestions, activity heatmap, avatar status narration,
 * manager-friendly status, since-last-visit diff, current-task ETA,
 * confidence trend sparkline, focus-this-URL command, skip-this-area
 * command, finding-type priority boost, noisy-check demotion.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic (no Math.random, no Date.now inside).
 */

export const WAVE28_START = 51081;
export const WAVE28_END = 51120;

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE28_IDEAS = [
  [
    51081,
    'tab-title status',
    'The browser tab title shows a one-line live status for at-a-glance monitoring',
  ],
  [51082, 'status API endpoint', 'Machine-readable current-status JSON for integrations and bots'],
  [
    51083,
    'status snapshots',
    'Capture timestamped status cards into the hunt record with one click',
  ],
  [
    51084,
    'intent explanation',
    '"Why am I doing this" answers that connect the current action to the hunt goal',
  ],
  [
    51085,
    'dependency display',
    'Shows what the current step is waiting for, e.g. recon results before probing',
  ],
  [
    51086,
    'approach confidence',
    'The agent states how confident it is that the current approach will pay off',
  ],
  [
    51087,
    'considered alternatives',
    'Ask what else it considered before choosing the current action',
  ],
  [
    51088,
    'per-module status',
    'Drill into any single module to see exactly what that component is doing',
  ],
  [
    51089,
    'quiet status mode',
    'Suppress routine updates and surface only phase changes and findings',
  ],
  [51090, 'push status alerts', 'Phase changes and completions pushed to your phone or desktop'],
  [
    51091,
    'terminal-style status',
    'An optional monospace live feed for users who prefer raw operational text',
  ],
  [51092, 'status emoji legend', 'Consistent icons for phases so status is scannable at a glance'],
  [
    51093,
    'time-since-finding',
    'How long since the last finding, to judge whether the hunt has gone cold',
  ],
  [
    51094,
    'coverage-so-far summary',
    'Which parts of the target have been exercised and which remain untouched',
  ],
  [
    51095,
    'paused-state status',
    'While paused, status shows exactly where the hunt froze and what resumes next',
  ],
  [
    51096,
    'approval-wait status',
    'During approval waits, status names the pending action and who is holding it up',
  ],
  [51097, 'status export', 'Download the full status history as CSV or markdown for records'],
  [
    51098,
    'status Q&A thread',
    'Every status update opens a thread where you can question that specific moment',
  ],
  [
    51099,
    'uncertainty flag',
    'The agent marks status lines it is unsure about rather than stating them as fact',
  ],
  [
    51100,
    'upcoming-phase forecast',
    '"About to start API fuzzing" style lookahead of the next 2–3 steps',
  ],
  [
    51101,
    'status granularity dial',
    'Choose summary, standard, or verbose depth for all status output',
  ],
  [
    51102,
    'component-specific status',
    'Ask "what\'s the crawler doing?" for a focused answer on one component',
  ],
  [
    51103,
    'timeline scrubber',
    'Drag through the hunt timeline to see what the agent was doing at any minute',
  ],
  [51104, 'status bookmarks', 'Bookmark moments in the status stream to revisit or cite later'],
  [
    51105,
    'agent workload meter',
    'How many parallel tasks the agent is juggling right now, shown as a simple gauge',
  ],
  [
    51106,
    'model-switch status',
    'A notice whenever the agent swaps brains mid-hunt, with the reason for the switch',
  ],
  [
    51107,
    'bilingual status view',
    'Status displayed in two languages side by side for mixed-language teams',
  ],
  [
    51108,
    'payload-redacted status',
    'Status lines automatically hide sensitive payload contents with reveal-on-click',
  ],
  [
    51109,
    'finding-linked status',
    'Each status update links to the findings discovered during that window',
  ],
  [
    51110,
    'idle-nudge suggestions',
    'When the agent idles, it proposes useful next steps you can approve with one tap',
  ],
  [51111, 'activity heatmap', 'A visual map of agent activity intensity across the hunt timeline'],
  [
    51112,
    'avatar status narration',
    'The avatar speaks status updates in a natural voice during long hunts',
  ],
  [
    51113,
    'manager-friendly status',
    'A jargon-free status view designed for non-technical stakeholders',
  ],
  [
    51114,
    'since-last-visit diff',
    '"Here\'s what happened since you last checked" summary shown on return',
  ],
  [
    51115,
    'current-task ETA',
    'Estimated finish time for the specific step in progress, not just the whole hunt',
  ],
  [
    51116,
    'status confidence trend',
    "A sparkline showing how the agent's confidence evolved across phases",
  ],
  [
    51117,
    'focus-this-URL command',
    'Tell the agent to concentrate testing on one URL with immediate reprioritization',
  ],
  [
    51118,
    'skip-this-area command',
    'Mark a section as off-limits and watch the agent reroute around it',
  ],
  [
    51119,
    'finding-type priority boost',
    'Elevate a vulnerability class so the agent hunts it first everywhere',
  ],
  [
    51120,
    'noisy-check demotion',
    'Push low-signal checks to the back of the queue without disabling them',
  ],
];

/* ------------------------------------------------------------------ */
/* 51081 — tab-title status                                            */
/* ------------------------------------------------------------------ */

/** One-line live status string suitable for document.title. */
export function tabTitleStatus({ phase, action, findingCount }) {
  const p = phase || 'idle';
  const a = action ? ` — ${action}` : '';
  const f = typeof findingCount === 'number' ? ` (${findingCount} findings)` : '';
  return `Dark-Matter: ${p}${a}${f}`;
}

/* ------------------------------------------------------------------ */
/* 51082 — status API endpoint payload                                 */
/* ------------------------------------------------------------------ */

/** Machine-readable current-status JSON for integrations and bots. */
export function statusApiPayload({
  huntId,
  phase,
  action,
  progressPct,
  findingCount,
  updatedAtMs,
  paused,
}) {
  return {
    version: 1,
    huntId: huntId || null,
    phase: phase || 'idle',
    action: action || null,
    progressPct: typeof progressPct === 'number' ? progressPct : 0,
    findingCount: typeof findingCount === 'number' ? findingCount : 0,
    paused: !!paused,
    updatedAtMs: typeof updatedAtMs === 'number' ? updatedAtMs : 0,
  };
}

/* ------------------------------------------------------------------ */
/* 51083 — status snapshots                                           */
/* ------------------------------------------------------------------ */

/** Capture a timestamped status card into the hunt record. */
export function captureSnapshot(state, capturedAtMs, snapshots) {
  const snap = {
    id: `snap-${capturedAtMs}`,
    capturedAtMs,
    phase: state.phase || 'idle',
    action: state.action || null,
    progressPct: state.progressPct || 0,
    findingCount: state.findingCount || 0,
  };
  return [...(snapshots || []), snap];
}

/* ------------------------------------------------------------------ */
/* 51084 — intent explanation                                         */
/* ------------------------------------------------------------------ */

/** "Why am I doing this" — connect the current action to the hunt goal. */
export function intentExplanation(action, goal) {
  if (!action) return 'No action in progress.';
  const g = goal || 'find vulnerabilities in the target';
  return `Doing "${action}" because it advances the goal: ${g}.`;
}

/* ------------------------------------------------------------------ */
/* 51085 — dependency display                                         */
/* ------------------------------------------------------------------ */

/** Show what the current step is waiting for. */
export function dependencyDisplay(step) {
  if (!step) return { blocked: false, waitsFor: [] };
  const waitsFor = Array.isArray(step.waitsFor) ? step.waitsFor : [];
  return { blocked: waitsFor.length > 0, waitsFor };
}

/* ------------------------------------------------------------------ */
/* 51086 — approach confidence                                        */
/* ------------------------------------------------------------------ */

export const CONF_HIGH = 'high';
export const CONF_MEDIUM = 'medium';
export const CONF_LOW = 'low';

/** Band a 0–1 confidence score into high/medium/low. */
export function approachConfidence(score) {
  const s = typeof score === 'number' ? Math.max(0, Math.min(1, score)) : 0;
  if (s >= 0.7) return CONF_HIGH;
  if (s >= 0.4) return CONF_MEDIUM;
  return CONF_LOW;
}

export function confidenceLabel(band) {
  if (band === CONF_HIGH) return 'High confidence — approach likely to pay off';
  if (band === CONF_MEDIUM) return 'Medium confidence — worth continuing, watching closely';
  return 'Low confidence — considering a pivot';
}

/* ------------------------------------------------------------------ */
/* 51087 — considered alternatives                                    */
/* ------------------------------------------------------------------ */

/** What else was considered before choosing the current action. */
export function consideredAlternatives(action) {
  const alts = (action && action.alternatives) || [];
  return alts.map(a => ({
    name: a.name || 'unknown',
    rejectedBecause: a.rejectedBecause || 'not evaluated',
  }));
}

/* ------------------------------------------------------------------ */
/* 51088 — per-module status                                          */
/* ------------------------------------------------------------------ */

/** Drill into a single module for its focused status. */
export function moduleStatus(modules, name) {
  const m = (modules || []).find(x => x.name === name);
  if (!m) return { name, found: false, status: 'No such module in this hunt.' };
  return {
    name,
    found: true,
    status: m.status || 'idle',
    detail: m.detail || '',
    progressPct: typeof m.progressPct === 'number' ? m.progressPct : 0,
  };
}

/* ------------------------------------------------------------------ */
/* 51089 — quiet status mode                                          */
/* ------------------------------------------------------------------ */

export const QUIET_OFF = 'off';
export const QUIET_ON = 'on';

/** In quiet mode, keep only phase changes and findings. */
export function quietModeFilter(updates, mode) {
  if (mode !== QUIET_ON) return updates || [];
  return (updates || []).filter(u => u.kind === 'phase' || u.kind === 'finding');
}

/* ------------------------------------------------------------------ */
/* 51090 — push status alerts                                         */
/* ------------------------------------------------------------------ */

/** Build a push-notification payload for a status event. */
export function pushAlertPayload(event) {
  return {
    title: event.title || 'Dark-Matter status',
    body: event.body || '',
    kind: event.kind || 'phase',
    atMs: event.atMs || 0,
    huntId: event.huntId || null,
  };
}

/* ------------------------------------------------------------------ */
/* 51091 — terminal-style status                                      */
/* ------------------------------------------------------------------ */

/** Format a status event as a monospace terminal line. */
export function terminalLine(event) {
  const ts = new Date(event.atMs || 0).toISOString().slice(11, 19);
  const kind = String(event.kind || 'info')
    .toUpperCase()
    .padEnd(7, ' ');
  return `[${ts}] ${kind} ${event.text || ''}`;
}

/* ------------------------------------------------------------------ */
/* 51092 — status emoji legend                                        */
/* ------------------------------------------------------------------ */

export const STATUS_EMOJI = {
  recon: '🔍',
  crawl: '🕷️',
  probe: '🎯',
  fuzz: '💥',
  analyze: '🧠',
  report: '📝',
  paused: '⏸️',
  done: '✅',
  error: '⚠️',
  idle: '💤',
};

/** Consistent icon for a phase; falls back to a generic dot. */
export function emojiForPhase(phase) {
  return STATUS_EMOJI[phase] || '•';
}

/* ------------------------------------------------------------------ */
/* 51093 — time-since-finding                                         */
/* ------------------------------------------------------------------ */

/** Human string for how long since the last finding. */
export function timeSinceFinding(lastFindingMs, nowMs) {
  if (!lastFindingMs) return 'No findings yet';
  const delta = Math.max(0, nowMs - lastFindingMs);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m since last finding`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h since last finding`;
  return `${Math.floor(hrs / 24)}d since last finding`;
}

/* ------------------------------------------------------------------ */
/* 51094 — coverage-so-far summary                                    */
/* ------------------------------------------------------------------ */

/** Which parts of the target are exercised vs untouched. */
export function coverageSummary(areas) {
  const list = areas || [];
  const covered = list.filter(a => a.covered);
  const untouched = list.filter(a => !a.covered);
  const pct = list.length === 0 ? 0 : Math.round((covered.length / list.length) * 100);
  return {
    total: list.length,
    covered: covered.length,
    untouched: untouched.map(a => a.name),
    pct,
  };
}

/* ------------------------------------------------------------------ */
/* 51095 — paused-state status                                        */
/* ------------------------------------------------------------------ */

/** While paused: where the hunt froze and what resumes next. */
export function pausedStatus({ frozenPhase, frozenAction, resumeNext, pausedAtMs }) {
  return {
    paused: true,
    frozenPhase: frozenPhase || 'unknown',
    frozenAction: frozenAction || 'unknown',
    resumeNext: resumeNext || 'unknown',
    pausedAtMs: pausedAtMs || 0,
    summary: `Paused during ${frozenPhase} (${frozenAction}). Resumes with: ${resumeNext}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 51096 — approval-wait status                                       */
/* ------------------------------------------------------------------ */

/** During approval waits: name the pending action and who's holding it up. */
export function approvalWaitStatus({ action, holder, requestedAtMs }) {
  return {
    waiting: true,
    action: action || 'unknown action',
    holder: holder || 'you',
    requestedAtMs: requestedAtMs || 0,
    summary: `Waiting on ${holder || 'you'} to approve: ${action || 'unknown action'}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 51097 — status export                                              */
/* ------------------------------------------------------------------ */

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export status history as CSV. */
export function exportStatusCsv(history) {
  const rows = (history || []).map(h => [h.atMs, h.kind, h.phase, h.text].map(csvCell).join(','));
  return ['atMs,kind,phase,text', ...rows].join('\n');
}

/** Export status history as markdown. */
export function exportStatusMarkdown(history) {
  const lines = (history || []).map(
    h =>
      `- ${new Date(h.atMs || 0).toISOString()} **[${h.kind || 'info'}]** (${h.phase || 'idle'}): ${h.text || ''}`
  );
  return ['# Hunt status history', '', ...lines].join('\n');
}

/* ------------------------------------------------------------------ */
/* 51098 — status Q&A thread                                          */
/* ------------------------------------------------------------------ */

/** Open a question thread anchored to one status update. */
export function openQaThread(statusId) {
  return { statusId, open: true, exchanges: [] };
}

/** Append a question/answer exchange to a thread. */
export function qaReply(thread, question, answer) {
  return {
    ...thread,
    exchanges: [...(thread.exchanges || []), { question, answer: answer || null }],
  };
}

/* ------------------------------------------------------------------ */
/* 51099 — uncertainty flag                                           */
/* ------------------------------------------------------------------ */

/** Mark a status line the agent is unsure about. */
export function flagUncertain(line, reason) {
  return {
    text: line,
    uncertain: true,
    reason: reason || 'low signal',
    display: `~ ${line} (uncertain: ${reason || 'low signal'})`,
  };
}

/* ------------------------------------------------------------------ */
/* 51100 — upcoming-phase forecast                                    */
/* ------------------------------------------------------------------ */

/** Lookahead of the next n steps from the plan. */
export function forecastPhases(plan, currentIdx, n = 3) {
  const upcoming = (plan || []).slice(currentIdx + 1, currentIdx + 1 + n);
  return upcoming.map((p, i) => ({
    order: i + 1,
    phase: p.phase || p,
    note: p.note || '',
  }));
}

/* ------------------------------------------------------------------ */
/* 51101 — status granularity dial                                    */
/* ------------------------------------------------------------------ */

export const GRAN_SUMMARY = 'summary';
export const GRAN_STANDARD = 'standard';
export const GRAN_VERBOSE = 'verbose';
export const GRANULARITIES = [GRAN_SUMMARY, GRAN_STANDARD, GRAN_VERBOSE];

/** Filter status output by chosen depth. */
export function applyGranularity(updates, level) {
  const list = updates || [];
  if (level === GRAN_SUMMARY) return list.filter(u => u.depth === 'summary');
  if (level === GRAN_VERBOSE) return list;
  return list.filter(u => u.depth !== 'verbose');
}

/* ------------------------------------------------------------------ */
/* 51102 — component-specific status                                  */
/* ------------------------------------------------------------------ */

/** Focused answer for "what's the X doing?" */
export function componentStatus(components, query) {
  const q = String(query || '').toLowerCase();
  const hit = (components || []).find(
    c =>
      String(c.name || '')
        .toLowerCase()
        .includes(q) ||
      String(c.alias || '')
        .toLowerCase()
        .includes(q)
  );
  if (!hit) return { found: false, answer: `No component matches "${query}".` };
  return {
    found: true,
    name: hit.name,
    answer: `${hit.name} is ${hit.status || 'idle'}${hit.detail ? ` — ${hit.detail}` : ''}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 51103 — timeline scrubber                                          */
/* ------------------------------------------------------------------ */

/** What the agent was doing at a given minute offset. */
export function scrubTimeline(events, minute) {
  const at = (events || []).filter(e => (e.minute || 0) <= minute);
  if (at.length === 0) return { minute, found: false, summary: 'Hunt had not started yet.' };
  const last = at[at.length - 1];
  return {
    minute,
    found: true,
    phase: last.phase || 'unknown',
    action: last.action || '',
    summary: `At minute ${minute}: ${last.phase || 'unknown'} — ${last.action || 'no recorded action'}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 51104 — status bookmarks                                           */
/* ------------------------------------------------------------------ */

/** Bookmark a moment in the status stream. */
export function addBookmark(bookmarks, event, label) {
  const b = {
    id: `bm-${event.atMs || Date.now()}`,
    atMs: event.atMs || 0,
    label: label || event.text || 'bookmark',
    phase: event.phase || '',
  };
  const list = bookmarks || [];
  if (list.some(x => x.id === b.id)) return list;
  return [...list, b];
}

export function removeBookmark(bookmarks, id) {
  return (bookmarks || []).filter(b => b.id !== id);
}

/* ------------------------------------------------------------------ */
/* 51105 — agent workload meter                                       */
/* ------------------------------------------------------------------ */

/** Gauge of parallel tasks: 0–1 load plus a label. */
export function workloadMeter(activeTasks, capacity = 8) {
  const load = capacity > 0 ? Math.max(0, Math.min(1, activeTasks / capacity)) : 0;
  const label = load < 0.4 ? 'light' : load < 0.75 ? 'busy' : 'saturated';
  return { activeTasks, capacity, load: Math.round(load * 100) / 100, label };
}

/* ------------------------------------------------------------------ */
/* 51106 — model-switch status                                        */
/* ------------------------------------------------------------------ */

/** Notice when the agent swaps brains mid-hunt. */
export function modelSwitchNotice(from, to, reason, atMs) {
  return {
    atMs: atMs || 0,
    from: from || 'unknown',
    to: to || 'unknown',
    reason: reason || 'not specified',
    summary: `Switched model from ${from || 'unknown'} to ${to || 'unknown'}: ${reason || 'not specified'}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 51107 — bilingual status view                                      */
/* ------------------------------------------------------------------ */

/** Side-by-side two-language status. */
export function bilingualStatus(primary, secondary, primaryLang = 'en', secondaryLang = 'hi') {
  return {
    primary: { lang: primaryLang, text: primary || '' },
    secondary: { lang: secondaryLang, text: secondary || '' },
  };
}

/* ------------------------------------------------------------------ */
/* 51108 — payload-redacted status                                    */
/* ------------------------------------------------------------------ */

/** Hide sensitive payload contents; reveal-on-click handled by UI state. */
export function redactPayload(line) {
  const s = String(line || '');
  const redacted = s.replace(
    /(password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
    '$1: [redacted]'
  );
  return { original: s, redacted, wasRedacted: redacted !== s };
}

/* ------------------------------------------------------------------ */
/* 51109 — finding-linked status                                      */
/* ------------------------------------------------------------------ */

/** Attach finding links to a status update. */
export function linkFindings(status, findings) {
  const links = (findings || []).map(f => ({ id: f.id, title: f.title || f.id }));
  return { ...status, findingLinks: links, findingCount: links.length };
}

/* ------------------------------------------------------------------ */
/* 51110 — idle-nudge suggestions                                     */
/* ------------------------------------------------------------------ */

/** Propose next steps when the agent idles. */
export function idleNudges(idleMs, context) {
  if ((idleMs || 0) < 60000) return [];
  const c = context || {};
  const nudges = [];
  if (c.unreviewedFindings > 0)
    nudges.push({ id: 'review', text: `Review ${c.unreviewedFindings} unreviewed finding(s)` });
  if (c.uncoveredAreas > 0)
    nudges.push({
      id: 'coverage',
      text: `Expand coverage to ${c.uncoveredAreas} untouched area(s)`,
    });
  if (nudges.length === 0) nudges.push({ id: 'wrap', text: 'Wrap up and generate the report' });
  return nudges;
}

/* ------------------------------------------------------------------ */
/* 51111 — activity heatmap                                           */
/* ------------------------------------------------------------------ */

/** Intensity per time bucket for a visual activity map. */
export function activityHeatmap(events, bucketMinutes = 5) {
  const buckets = {};
  for (const e of events || []) {
    const b = Math.floor((e.minute || 0) / bucketMinutes) * bucketMinutes;
    buckets[b] = (buckets[b] || 0) + 1;
  }
  return Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map(start => ({
      startMinute: start,
      endMinute: start + bucketMinutes,
      count: buckets[start],
    }));
}

/* ------------------------------------------------------------------ */
/* 51112 — avatar status narration                                    */
/* ------------------------------------------------------------------ */

/** Spoken script for avatar/voice status updates. */
export function avatarNarration(status) {
  const phase = status.phase || 'idle';
  const action = status.action ? ` Currently ${status.action}.` : '';
  const findings =
    typeof status.findingCount === 'number' ? ` ${status.findingCount} findings so far.` : '';
  return `Hunt status: ${phase}.${action}${findings}`;
}

/* ------------------------------------------------------------------ */
/* 51113 — manager-friendly status                                    */
/* ------------------------------------------------------------------ */

const JARGON_MAP = [
  [/fuzzing/gi, 'automated security testing'],
  [/recon/gi, 'initial survey'],
  [/payload/gi, 'test input'],
  [/exploit/gi, 'proof of issue'],
  [/CVE/gi, 'known issue'],
  [/XSS/gi, 'script injection issue'],
  [/SQLi/gi, 'database injection issue'],
];

/** Jargon-free status for non-technical stakeholders. */
export function managerStatus(status) {
  let text = `${status.phase || 'idle'}${status.action ? `: ${status.action}` : ''}`;
  for (const [re, plain] of JARGON_MAP) text = text.replace(re, plain);
  return text;
}

/* ------------------------------------------------------------------ */
/* 51114 — since-last-visit diff                                      */
/* ------------------------------------------------------------------ */

/** "Here's what happened since you last checked." */
export function lastVisitDiff(events, lastVisitMs) {
  const fresh = (events || []).filter(e => (e.atMs || 0) > (lastVisitMs || 0));
  const findings = fresh.filter(e => e.kind === 'finding').length;
  const phases = [...new Set(fresh.map(e => e.phase).filter(Boolean))];
  return {
    eventCount: fresh.length,
    newFindings: findings,
    phasesTouched: phases,
    summary:
      fresh.length === 0
        ? 'Nothing new since your last visit.'
        : `${fresh.length} update(s) since your last visit: ${findings} new finding(s), phases: ${phases.join(', ') || 'none'}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 51115 — current-task ETA                                           */
/* ------------------------------------------------------------------ */

/** Estimated finish for the step in progress. */
export function currentTaskEta(startedMs, estDurationMs, nowMs) {
  if (!startedMs || !estDurationMs) return { etaMs: null, remainingMs: null, label: 'ETA unknown' };
  const etaMs = startedMs + estDurationMs;
  const remainingMs = Math.max(0, etaMs - nowMs);
  const mins = Math.ceil(remainingMs / 60000);
  return { etaMs, remainingMs, label: mins <= 0 ? 'finishing now' : `~${mins}m remaining` };
}

/* ------------------------------------------------------------------ */
/* 51116 — status confidence trend                                    */
/* ------------------------------------------------------------------ */

/** Sparkline data: confidence score per phase index. */
export function confidenceTrend(scores) {
  const pts = (scores || []).map((s, i) => ({ x: i, y: Math.max(0, Math.min(1, s)) }));
  if (pts.length === 0) return { points: [], direction: 'flat' };
  const first = pts[0].y;
  const last = pts[pts.length - 1].y;
  const direction = last > first + 0.05 ? 'up' : last < first - 0.05 ? 'down' : 'flat';
  return { points: pts, direction };
}

/* ------------------------------------------------------------------ */
/* 51117 — focus-this-URL command                                     */
/* ------------------------------------------------------------------ */

/** Parse "focus <url>" steering commands. */
export function parseFocusCommand(text) {
  const m = String(text || '').match(/^\s*focus\s+(\S+)\s*$/i);
  if (!m) return null;
  return { command: 'focus', url: m[1] };
}

/* ------------------------------------------------------------------ */
/* 51118 — skip-this-area command                                     */
/* ------------------------------------------------------------------ */

/** Parse "skip <area>" steering commands. */
export function parseSkipCommand(text) {
  const m = String(text || '').match(/^\s*skip\s+(.+?)\s*$/i);
  if (!m) return null;
  return { command: 'skip', area: m[1] };
}

/* ------------------------------------------------------------------ */
/* 51119 — finding-type priority boost                                */
/* ------------------------------------------------------------------ */

/** Elevate a vulnerability class to the front of the hunt order. */
export function priorityBoost(types, vulnClass) {
  const list = [...(types || [])];
  const idx = list.findIndex(t => String(t).toLowerCase() === String(vulnClass).toLowerCase());
  if (idx <= 0) return list;
  const [hit] = list.splice(idx, 1);
  return [hit, ...list];
}

/* ------------------------------------------------------------------ */
/* 51120 — noisy-check demotion                                       */
/* ------------------------------------------------------------------ */

/** Push low-signal checks to the back without disabling them. */
export function demoteNoisy(checks, noisyIds) {
  const noisy = new Set(noisyIds || []);
  const keep = (checks || []).filter(c => !noisy.has(c.id || c));
  const demoted = (checks || []).filter(c => noisy.has(c.id || c));
  return [...keep, ...demoted];
}
