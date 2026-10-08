/**
 * steeringQueueCore.js — wave 40 (ideas 51581–51600): proactive steering
 * prompt engine (part 2) for Infinity AI.
 *
 * Pure logic for the agent's second 20 proactive check-ins: notification
 * preference learning, handoff questions, retest proposals, collaboration
 * prompts, learning questions, assumption disclosures, plan reviews,
 * checkpoints, anomaly alerts, coverage/tool/evidence/timing/parallelism/
 * data-handling/disclosure questions, steering feedback, goal-alignment
 * checks, interruption triage, and question snoozing — plus the prompt
 * queue that orders them by urgency.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random(); time is
 * always passed in as an argument.
 */

export const WAVE40_SQ_START = 51581;
export const WAVE40_SQ_END = 51600;

/** Registry of the 20 steering-queue ideas — completeness is testable. */
export const WAVE40_SQ_IDEAS = [
  [51581, 'notification preference checks', 'The agent learns when you want to be interrupted'],
  [51582, 'handoff questions', '"You seem away — should I continue autonomously or wait?"'],
  [51583, 'retest proposals', '"The target changed; want me to re-verify the earlier findings?"'],
  [51584, 'collaboration prompts', '"Should I invite a teammate to look at this finding?"'],
  [51585, 'learning questions', '"Was that finding useful? Your answer improves my future hunts."'],
  [
    51586,
    'assumption disclosures',
    'The agent states assumptions it operates under for you to correct',
  ],
  [51587, 'plan-review prompts', '"Here\'s my plan for the next phase — any changes?"'],
  [51588, 'checkpoint questions', 'Scheduled moments where the agent asks for direction'],
  [
    51589,
    'anomaly alerts as questions',
    '"Traffic spiked unusually — should I investigate or ignore?"',
  ],
  [
    51590,
    'coverage questions',
    '"I\'ve covered 80% — chase the last 20% or go deeper on findings?"',
  ],
  [51591, 'tool-choice questions', '"Two tools could do this; prefer speed or thoroughness?"'],
  [51592, 'evidence questions', '"I have enough for a medium; want stronger proof for a high?"'],
  [51593, 'timing questions', '"This test is slow; run it now or overnight?"'],
  [51594, 'parallelism questions', '"I can run these in parallel; okay to increase load?"'],
  [51595, 'data-handling questions', '"I found exposed data; how should I handle it?"'],
  [
    51596,
    'disclosure questions',
    '"Critical finding confirmed — notify the client now or at the end?"',
  ],
  [51597, 'steering feedback requests', '"Did that redirection help? I\'ll remember your answer."'],
  [51598, 'goal-alignment checks', '"Just confirming: the goal is still maximum coverage, right?"'],
  [
    51599,
    'interruption triage',
    'When several questions queue, the agent asks the most urgent first',
  ],
  [51600, 'question snoozing', 'Snooze a proactive question and have it return at a better time'],
];

export const URGENCY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

/* --- prompt queue (51599 interruption triage / 51600 snoozing) ---------------- */

export function createQueue() {
  return { items: [] };
}

export function enqueue(queue, prompt) {
  const q = queue || createQueue();
  return { items: q.items.concat([prompt]) };
}

export function isSnoozed(prompt, nowMs) {
  return prompt && prompt.snoozedUntilMs != null && Number(prompt.snoozedUntilMs) > Number(nowMs);
}

export function duePrompts(queue, nowMs) {
  const q = queue || createQueue();
  return q.items.filter(p => p.status === 'open' && !isSnoozed(p, nowMs));
}

/** Most urgent due question first; ties broken by queue order. */
export function triageOrder(prompts) {
  return (prompts || []).slice().sort((a, b) => {
    const ua = URGENCY_ORDER[a.urgency] ?? 2;
    const ub = URGENCY_ORDER[b.urgency] ?? 2;
    return ua - ub;
  });
}

export function dequeueNext(queue, nowMs) {
  const due = triageOrder(duePrompts(queue, nowMs));
  if (!due.length) return { prompt: null, queue: queue || createQueue() };
  const next = due[0];
  return {
    prompt: next,
    queue: { items: (queue.items || []).filter(p => p.id !== next.id) },
  };
}

export function snoozeUntil(prompt, untilMs) {
  return { ...prompt, snoozedUntilMs: Math.max(0, Number(untilMs) || 0) };
}

export function snoozeByMinutes(prompt, minutes, nowMs) {
  const m = Math.max(1, Math.min(24 * 60, Number(minutes) || 15));
  return snoozeUntil(prompt, Number(nowMs) + m * 60000);
}

/** Re-admit snoozed prompts whose time has come; returns { woke, queue }. */
export function wakeSnoozed(queue, nowMs) {
  const q = queue || createQueue();
  const woke = (q.items || []).filter(p => p.status === 'open' && !isSnoozed(p, nowMs));
  return { woke: triageOrder(woke), queue: q };
}

export function queueSummary(queue, nowMs) {
  const q = queue || createQueue();
  const due = duePrompts(q, nowMs);
  const snoozed = (q.items || []).filter(p => p.status === 'open' && isSnoozed(p, nowMs)).length;
  return {
    total: q.items.length,
    due: due.length,
    snoozed,
    answered: q.items.filter(p => p.status === 'answered').length,
  };
}

/* --- 51581 notification preference checks ------------------------------------- */

export const INTERRUPT_MODES = ['interrupt', 'batch', 'silent'];

export function defaultInterruptPrefs() {
  return {
    critical: 'interrupt',
    high: 'interrupt',
    medium: 'batch',
    low: 'silent',
    info: 'silent',
  };
}

/** Learn when the human wants interruption from their answers. */
export function learnInterruptionPref(prefs, severity, answer) {
  const p = { ...(prefs || defaultInterruptPrefs()) };
  const s = String(severity || '').toLowerCase();
  if (!p[s]) return p;
  if (answer === 'interrupt') p[s] = 'interrupt';
  else if (answer === 'batch') p[s] = 'batch';
  else if (answer === 'silent') p[s] = 'silent';
  return p;
}

export function interruptionMode(prefs, severity) {
  const p = prefs || defaultInterruptPrefs();
  return p[String(severity || '').toLowerCase()] || 'batch';
}

export function notificationPrefPrompt(prefs) {
  return {
    id: 'pref-check',
    kind: 'notification-preference',
    title: 'How should I notify you?',
    body: 'Current: criticals interrupt, highs interrupt, mediums batch, lows stay silent. Change anything?',
    options: [
      { key: 'keep', label: 'Keep as-is' },
      { key: 'quieter', label: 'Quieter (batch highs too)' },
      { key: 'louder', label: 'Louder (interrupt on mediums)' },
    ],
    urgency: 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51582 handoff questions --------------------------------------------------- */

export function handoffQuestion(idleMs, thresholdMs, nowMs) {
  const idle = Math.max(0, Number(idleMs) || 0);
  const threshold = Math.max(1, Number(thresholdMs) || 10 * 60000);
  if (idle < threshold) return null;
  return {
    id: 'handoff-' + Math.round(Number(nowMs) || 0),
    kind: 'handoff',
    title: 'You seem away — continue or wait?',
    body:
      'No response for ' +
      Math.round(idle / 60000) +
      ' minutes. Should I continue autonomously or pause for you?',
    options: [
      { key: 'continue', label: 'Continue autonomously' },
      { key: 'wait', label: 'Wait for me' },
      { key: 'safe', label: 'Continue, safe steps only' },
    ],
    urgency: 'high',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51583 retest proposals --------------------------------------------------- */

export function retestProposal(changedAssets, findings) {
  const changed = (changedAssets || []).map(String);
  const affected = (findings || []).filter(f => changed.includes(String(f.asset)));
  return {
    id: 'retest-' + affected.length,
    kind: 'retest',
    title: 'Re-verify earlier findings?',
    body:
      changed.length +
      ' asset' +
      (changed.length === 1 ? '' : 's') +
      ' changed since the hunt (' +
      changed.slice(0, 3).join(', ') +
      '). ' +
      affected.length +
      ' finding' +
      (affected.length === 1 ? '' : 's') +
      ' may be affected.',
    options: [
      { key: 'retest', label: 'Re-verify affected (' + affected.length + ')' },
      { key: 'all', label: 'Re-verify everything' },
      { key: 'skip', label: 'Skip' },
    ],
    urgency: affected.some(f => String(f.severity).toLowerCase() === 'critical')
      ? 'high'
      : 'normal',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
    affectedFindingIds: affected.map(f => f.id),
  };
}

/* --- 51584 collaboration prompts ---------------------------------------------- */

export function collaborationPrompt(finding, teammates) {
  const f = finding || {};
  const team = (teammates || []).map(t => ({ key: String(t), label: String(t) }));
  return {
    id: 'collab-' + String(f.id || 'x'),
    kind: 'collaboration',
    title: 'Invite a teammate to look at this?',
    body:
      '"' +
      String(f.title || 'This finding') +
      '" [' +
      String(f.severity || '?') +
      '] could use a second pair of eyes.',
    options: team.length
      ? team.concat([{ key: 'no', label: 'Handle solo' }])
      : [
          { key: 'invite', label: 'Invite teammate' },
          { key: 'no', label: 'Handle solo' },
        ],
    urgency: 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51585 learning questions -------------------------------------------------- */

export function learningQuestion(finding) {
  const f = finding || {};
  return {
    id: 'learn-' + String(f.id || 'x'),
    kind: 'learning',
    title: 'Was this finding useful?',
    body: '"' + String(f.title || 'This finding') + '" — your answer improves my future hunts.',
    options: [
      { key: 'useful', label: 'Useful' },
      { key: 'noise', label: 'Noise' },
      { key: 'unsure', label: 'Not sure' },
    ],
    urgency: 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

export function recordLearningAnswer(store, findingId, useful) {
  const s = store || {};
  const entry = {
    findingId: String(findingId),
    useful: useful === true || useful === 'useful',
    atMs: 0,
  };
  return { entries: (s.entries || []).concat([entry]) };
}

export function learningSummary(store) {
  const entries = (store && store.entries) || [];
  const useful = entries.filter(e => e.useful).length;
  return { total: entries.length, useful, noise: entries.length - useful };
}

/* --- 51586 assumption disclosures ---------------------------------------------- */

export function assumptionDisclosure(assumptions) {
  const list = (assumptions || []).map((a, i) => ({ n: i + 1, text: String(a) }));
  return {
    id: 'assumptions',
    kind: 'assumption-disclosure',
    title: 'Assumptions I am operating under',
    body: 'Correct anything wrong — I will adjust immediately.',
    assumptions: list,
    options: [
      { key: 'all-good', label: 'All correct' },
      { key: 'correct', label: 'Let me correct one' },
    ],
    urgency: 'normal',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51587 plan-review prompts -------------------------------------------------- */

export function planReviewPrompt(plan) {
  const p = plan || {};
  const phases = (p.phases || []).map((ph, i) => i + 1 + '. ' + String(ph));
  return {
    id: 'plan-review',
    kind: 'plan-review',
    title: 'Here is my plan for the next phase — any changes?',
    body: phases.length ? phases.join(' → ') : 'No phases defined yet.',
    phases,
    options: [
      { key: 'approve', label: 'Approve plan' },
      { key: 'tweak', label: 'Tweak a phase' },
      { key: 'rewrite', label: 'Propose something else' },
    ],
    urgency: 'normal',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51588 checkpoint questions --------------------------------------------------- */

export function checkpointQuestion(phase, intervalMs, elapsedMs) {
  const interval = Math.max(1, Number(intervalMs) || 30 * 60000);
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const due = elapsed > 0 && elapsed % interval < 60000;
  if (!due && elapsed === 0) return null;
  return {
    id: 'checkpoint-' + Math.round(elapsed),
    kind: 'checkpoint',
    title: 'Checkpoint — ' + String(phase || 'hunt'),
    body:
      'Scheduled direction check at ' +
      Math.round(elapsed / 60000) +
      ' minutes into ' +
      String(phase || 'the hunt') +
      '. Keep going or change course?',
    options: [
      { key: 'continue', label: 'Keep going' },
      { key: 'steer', label: 'Steer me' },
      { key: 'stop', label: 'Stop the hunt' },
    ],
    urgency: 'normal',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51589 anomaly alerts as questions ------------------------------------------- */

export function anomalyQuestion(metric, baseline, current) {
  const b = Number(baseline) || 0;
  const c = Number(current) || 0;
  const mult = b > 0 ? c / b : c > 0 ? 99 : 1;
  return {
    id: 'anomaly-' + String(metric || 'm'),
    kind: 'anomaly',
    title: 'Unusual ' + String(metric || 'traffic') + ' — investigate?',
    body:
      String(metric || 'Traffic') +
      ' is at ' +
      c +
      ' vs a baseline of ' +
      b +
      ' (' +
      (b > 0 ? mult.toFixed(1) + '×' : 'new activity') +
      '). Investigate or ignore?',
    options: [
      { key: 'investigate', label: 'Investigate' },
      { key: 'ignore', label: 'Ignore' },
      { key: 'watch', label: 'Watch it' },
    ],
    urgency: mult >= 5 ? 'urgent' : 'high',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
    multiplier: b > 0 ? Math.round(mult * 10) / 10 : null,
  };
}

/* --- 51590 coverage questions ----------------------------------------------------- */

export function coverageQuestion(coveredPct, totalAssets) {
  const pct = Math.max(0, Math.min(100, Number(coveredPct) || 0));
  return {
    id: 'coverage',
    kind: 'coverage',
    title: 'Coverage at ' + pct + '% — chase the rest or go deeper?',
    body: 'Covered ' + pct + '% of ' + Number(totalAssets || 0) + ' assets.',
    options: [
      { key: 'remaining', label: 'Chase the remaining ' + (100 - pct) + '%' },
      { key: 'deeper', label: 'Go deeper on findings' },
    ],
    urgency: pct >= 80 ? 'normal' : 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51591 tool-choice questions ---------------------------------------------------- */

export function toolChoiceQuestion(toolA, toolB) {
  const a = String(toolA || 'fast-scan'),
    b = String(toolB || 'deep-scan');
  return {
    id: 'tool-choice',
    kind: 'tool-choice',
    title: 'Speed or thoroughness?',
    body: 'Two tools could do this: ' + a + ' (fast) vs ' + b + ' (thorough).',
    options: [
      { key: 'speed', label: 'Speed — ' + a },
      { key: 'thorough', label: 'Thorough — ' + b },
    ],
    urgency: 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51592 evidence questions -------------------------------------------------------- */

export function evidenceQuestion(finding, targetSeverity) {
  const f = finding || {};
  const target = String(targetSeverity || 'high');
  return {
    id: 'evidence-' + String(f.id || 'x'),
    kind: 'evidence',
    title: 'Stronger proof for a ' + target + '?',
    body:
      'I have enough for "' +
      String(f.title || 'this finding') +
      '" at ' +
      String(f.severity || 'current severity') +
      '. Want stronger proof to justify ' +
      target +
      '?',
    options: [
      { key: 'strengthen', label: 'Gather stronger proof' },
      { key: 'enough', label: 'Current proof is enough' },
    ],
    urgency: 'normal',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51593 timing questions ------------------------------------------------------------ */

export function timingQuestion(testName, estMs) {
  const est = Math.max(0, Number(estMs) || 0);
  const slow = est >= 30 * 60000;
  return {
    id: 'timing-' + String(testName || 't'),
    kind: 'timing',
    title: 'Run "' + String(testName || 'this test') + '" now or overnight?',
    body: 'Estimated duration: ' + Math.round(est / 60000) + ' minutes.',
    options: [
      { key: 'now', label: 'Run now' },
      { key: 'overnight', label: 'Schedule overnight' },
      { key: 'skip', label: 'Skip it' },
    ],
    urgency: slow ? 'normal' : 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
    estimatedMs: est,
  };
}

/* --- 51594 parallelism questions ----------------------------------------------------------- */

export function parallelismQuestion(jobs, currentParallel, maxParallel) {
  const j = Math.max(0, Number(jobs) || 0);
  const cur = Math.max(1, Number(currentParallel) || 1);
  const max = Math.max(cur, Number(maxParallel) || 4);
  return {
    id: 'parallelism',
    kind: 'parallelism',
    title: 'Increase parallel load?',
    body:
      j +
      ' jobs queued; currently running ' +
      cur +
      ' at a time (max ' +
      max +
      '). Okay to increase load?',
    options: [
      { key: 'increase', label: 'Increase to ' + Math.min(max, cur + 2) },
      { key: 'keep', label: 'Keep at ' + cur },
    ],
    urgency: 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
    suggestedParallel: Math.min(max, cur + 2),
  };
}

/* --- 51595 data-handling questions --------------------------------------------------------------- */

export const DATA_HANDLING_OPTIONS = ['quarantine', 'redact-log', 'report-only', 'delete'];

export function dataHandlingQuestion(finding) {
  const f = finding || {};
  return {
    id: 'data-' + String(f.id || 'x'),
    kind: 'data-handling',
    title: 'How should I handle this exposed data?',
    body:
      '"' +
      String(f.title || 'The finding') +
      '" exposed data on ' +
      String(f.asset || 'the target') +
      '. I will not store raw sensitive content without your say.',
    options: DATA_HANDLING_OPTIONS.map(k => ({
      key: k,
      label: k[0].toUpperCase() + k.slice(1).replace('-', ' '),
    })),
    urgency: 'urgent',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51596 disclosure questions ----------------------------------------------------------------------- */

export function disclosureQuestion(finding, stage) {
  const f = finding || {};
  return {
    id: 'disclosure-' + String(f.id || 'x'),
    kind: 'disclosure',
    title: 'Notify the client now or at the end?',
    body:
      'Critical finding confirmed: "' +
      String(f.title || 'a critical finding') +
      '". Disclosure stage: ' +
      String(stage || 'mid-hunt') +
      '.',
    options: [
      { key: 'now', label: 'Notify now' },
      { key: 'end', label: 'At the end of the hunt' },
      { key: 'never', label: 'Do not notify' },
    ],
    urgency: 'urgent',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

/* --- 51597 steering feedback requests ------------------------------------------------------------------- */

export function steeringFeedbackRequest(action) {
  return {
    id: 'steerfb-' + String((action && action.id) || 'x'),
    kind: 'steering-feedback',
    title: 'Did that redirection help?',
    body:
      'I redirected after "' +
      String((action && action.label) || 'your steering') +
      '" — your answer teaches me for next time.',
    options: [
      { key: 'helped', label: 'It helped' },
      { key: 'hurt', label: 'It hurt' },
      { key: 'neutral', label: 'No difference' },
    ],
    urgency: 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

export function recordSteeringFeedback(store, actionId, answer) {
  const s = store || {};
  const entry = { actionId: String(actionId), answer: String(answer), atMs: 0 };
  return { entries: (s.entries || []).concat([entry]) };
}

export function steeringFeedbackSummary(store) {
  const entries = (store && store.entries) || [];
  return {
    total: entries.length,
    helped: entries.filter(e => e.answer === 'helped').length,
    hurt: entries.filter(e => e.answer === 'hurt').length,
  };
}

/* --- 51598 goal-alignment checks ---------------------------------------------------------------------------- */

export function goalAlignmentCheck(goal, lastConfirmedMs, nowMs) {
  const stale = Number(nowMs) - Number(lastConfirmedMs || 0) > 4 * 3600000;
  return {
    id: 'goal-align',
    kind: 'goal-alignment',
    title: 'Just confirming the goal',
    body: 'Just confirming: the goal is still "' + String(goal || 'maximum coverage') + '", right?',
    options: [
      { key: 'yes', label: 'Still the goal' },
      { key: 'change', label: 'Goal changed' },
    ],
    urgency: stale ? 'normal' : 'low',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}
