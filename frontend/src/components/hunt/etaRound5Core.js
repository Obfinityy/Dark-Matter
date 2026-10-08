// etaRound5Core.js — Infinity AI · wave 45 (ideas 51761–51785)
// Pure logic for the second ETA suite: recalculation history, active/idle
// accounting, multi-hunt boards, prioritization, drift, scenarios, fairness,
// autoscaling, freeze, retrospective, and stakeholder payloads.
// Time is milliseconds everywhere; wall-clock inputs are explicit epoch ms so
// every function is deterministic for a given input.
// No DOM, no network, no side effects: pure transforms over plain descriptors.

export const ETA45_START = 51761;
export const ETA45_END = 51785;

export const ETA45_IDEAS = [
  [51761, 'ETA recalculation log', 'Every estimate change recorded with its cause.'],
  [51762, 'Time-to-first-finding', 'Tracked live and compared with historical averages.'],
  [51763, 'Idle-time accounting', 'Time spent paused or awaiting approval shown separately.'],
  [51764, 'Active-time counter', 'Pure working time excluding pauses and waits.'],
  [51765, 'ETA export', 'Timing data included in hunt exports for planning.'],
  [51766, 'Multi-hunt ETAs', "All running hunts' estimates on one comparison board."],
  [51767, 'ETA-based prioritization', 'The agent focuses on what fits the remaining time.'],
  [51768, 'Wrap-up ETA', '"Time to wrap up cleanly from here" estimated on demand.'],
  [51769, 'ETA for approvals', "Pending approvals show how long they've waited."],
  [51770, 'ETA for requested tests', 'Your on-demand tests show individual estimates.'],
  [51771, 'Overnight ETA', '"Done by morning" style estimates for long hunts.'],
  [51772, 'ETA timezone handling', 'Finish times shown correctly for distributed teams.'],
  [51773, 'ETA in tab title', 'The countdown visible in the browser tab.'],
  [51774, 'ETA milestones', '"50% there" style progress celebrations.'],
  [51775, 'ETA drift alerts', 'Warned when the estimate slips beyond a threshold.'],
  [51776, 'ETA scenario planner', '"What if I add two more hours?" answered instantly.'],
  [51777, 'ETA learning', 'The agent explains why its estimate changed in plain words.'],
  [51778, 'ETA for sub-agents', "Each sub-agent's remaining time shown in its tab."],
  [51779, 'ETA API', 'Programmatic access to live estimates.'],
  [51780, 'ETA dashboard', 'Timing analytics across all your hunts.'],
  [51781, 'ETA fairness', 'Remaining time distributed fairly across assets.'],
  [51782, 'ETA-based autoscaling', 'The agent adds parallelism when behind schedule.'],
  [51783, 'ETA freeze option', 'Lock the plan so the estimate stops moving during reviews.'],
  [51784, 'ETA retrospective', 'Post-hunt accuracy review of every estimate.'],
  [51785, 'Countdown voice control', 'Ask the avatar "how much longer?" hands-free.'],
];

// Format ms as a compact human duration: "45m", "2h 14m"
export function formatDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return `${h}h ${mm}m`;
}

// 51761 — every estimate change recorded with its cause; newest first
// events: [{ at, estimateMs, cause }]
export function etaRecalcLog(events) {
  const sorted = [...(events || [])].sort((a, b) => (a.at > b.at ? 1 : -1));
  return sorted.map((e, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    const deltaMs = prev ? e.estimateMs - prev.estimateMs : 0;
    const dir = deltaMs > 0 ? 'slipped' : deltaMs < 0 ? 'shrunk' : 'unchanged';
    return {
      at: e.at,
      estimateMs: e.estimateMs,
      cause: e.cause,
      deltaMs,
      text: i === 0
        ? `${e.at}: initial estimate ${formatDuration(e.estimateMs)} — ${e.cause}`
        : `${e.at}: ${dir} to ${formatDuration(e.estimateMs)} (${deltaMs > 0 ? '+' : ''}${formatDuration(Math.abs(deltaMs))}) — ${e.cause}`,
    };
  }).reverse();
}

// 51762 — time-to-first-finding tracked live against history
// args: { startedAtMs, firstFindingAtMs, historyAvgMs }
export function timeToFirstFinding({ startedAtMs, firstFindingAtMs, historyAvgMs }) {
  const firstFindingMs = Math.max(0, (firstFindingAtMs || 0) - (startedAtMs || 0));
  const avg = Math.max(1, historyAvgMs || 1);
  const ratio = firstFindingMs / avg;
  const vsHistory = ratio <= 0.85 ? 'faster' : ratio >= 1.15 ? 'slower' : 'on-par';
  const deltaMs = Math.abs(firstFindingMs - avg);
  return {
    firstFindingMs,
    historyAvgMs: avg,
    vsHistory,
    text: `First finding in ${formatDuration(firstFindingMs)} — ${vsHistory} than the ${formatDuration(avg)} historical average (${formatDuration(deltaMs)} ${firstFindingMs <= avg ? 'under' : 'over'}).`,
  };
}

// 51763 — idle time (paused / awaiting approval / waiting on tests) split out
// args: { totalWallMs, segments: [{ kind, ms }] }
// kinds: 'active' | 'paused' | 'awaiting-approval' | 'awaiting-test'
export function idleTimeAccounting({ totalWallMs, segments }) {
  const segs = segments || [];
  const idleKinds = ['paused', 'awaiting-approval', 'awaiting-test'];
  const byKind = {};
  for (const s of segs) byKind[s.kind] = (byKind[s.kind] || 0) + Math.max(0, s.ms || 0);
  const idleMs = idleKinds.reduce((sum, k) => sum + (byKind[k] || 0), 0);
  const wall = Math.max(0, totalWallMs || 0);
  const idlePct = wall ? Math.round((idleMs / wall) * 100) : 0;
  return {
    wallMs: wall,
    idleMs,
    idlePct,
    byKind,
    text: `Idle ${formatDuration(idleMs)} of ${formatDuration(wall)} wall time (${idlePct}%): paused ${formatDuration(byKind['paused'] || 0)}, awaiting approval ${formatDuration(byKind['awaiting-approval'] || 0)}, awaiting tests ${formatDuration(byKind['awaiting-test'] || 0)}.`,
  };
}

// 51764 — pure working time: wall time minus every pause and wait
// args: { totalWallMs, pausedMs, approvalWaitMs, testWaitMs }
export function activeTimeCounter({ totalWallMs, pausedMs, approvalWaitMs, testWaitMs }) {
  const wall = Math.max(0, totalWallMs || 0);
  const idle = Math.max(0, pausedMs || 0) + Math.max(0, approvalWaitMs || 0) + Math.max(0, testWaitMs || 0);
  const activeMs = Math.max(0, wall - idle);
  const activePct = wall ? Math.round((activeMs / wall) * 100) : 0;
  return {
    activeMs,
    idleMs: idle,
    activePct,
    text: `${formatDuration(activeMs)} of active work (${activePct}% of wall time); ${formatDuration(idle)} lost to pauses and waits.`,
  };
}

// 51765 — timing data payload included in hunt exports
export function etaExportPayload({ huntId, exportedAtMs, etaMs, finishAtMs, timezone, pctComplete, recalculations }) {
  const payload = {
    huntId,
    exportedAt: exportedAtMs,
    timezone: timezone || 'UTC',
    timing: {
      remainingMs: Math.max(0, etaMs || 0),
      remainingHuman: formatDuration(etaMs || 0),
      finishAtMs: finishAtMs || null,
      pctComplete: pctComplete != null ? pctComplete : null,
      recalculationCount: (recalculations || []).length,
      recalculations: recalculations || [],
    },
  };
  payload.json = JSON.stringify(payload, null, 2);
  payload.csv = 'metric,value\n' +
    `remaining_ms,${payload.timing.remainingMs}\n` +
    `remaining_human,${payload.timing.remainingHuman}\n` +
    `pct_complete,${payload.timing.pctComplete}\n` +
    `recalculations,${payload.timing.recalculationCount}`;
  return payload;
}

// 51766 — every running hunt's estimate on one comparison board
// hunts: [{ id, name, remainingMs, finishAtMs, pctComplete }]
export function multiHuntEtas(hunts) {
  const rows = [...(hunts || [])]
    .map((h) => ({ id: h.id, name: h.name, remainingMs: Math.max(0, h.remainingMs || 0), finishAtMs: h.finishAtMs, pctComplete: h.pctComplete || 0 }))
    .sort((a, b) => a.remainingMs - b.remainingMs);
  const total = rows.length;
  const soonest = rows[0] || null;
  const longest = rows[rows.length - 1] || null;
  return {
    rows,
    count: total,
    text: total
      ? `${total} hunts on the board — soonest to finish: ${soonest.name} (${formatDuration(soonest.remainingMs)}); longest: ${longest.name} (${formatDuration(longest.remainingMs)}).`
      : 'No hunts running.',
  };
}

// 51767 — focus on what fits the remaining time, ranked by value density
// items: [{ id, title, expectedMs, valueScore }], remainingMs
export function etaPrioritization(items, remainingMs) {
  const budget = Math.max(0, remainingMs || 0);
  const ranked = [...(items || [])]
    .map((it) => ({ ...it, density: (it.valueScore || 0) / Math.max(1, it.expectedMs || 1) }))
    .sort((a, b) => b.density - a.density);
  const fits = [];
  const deferred = [];
  let used = 0;
  for (const it of ranked) {
    const need = Math.max(0, it.expectedMs || 0);
    if (used + need <= budget) { fits.push(it); used += need; }
    else deferred.push(it);
  }
  return {
    fits,
    deferred,
    usedMs: used,
    text: `${fits.length} items fit the remaining ${formatDuration(budget)} (${formatDuration(used)} used); ${deferred.length} deferred to the next window.`,
  };
}

// 51768 — "time to wrap up cleanly from here" estimated on demand
// args: { remainingWorkMs, reportMs, verifyMs }
export function wrapUpEta({ remainingWorkMs, reportMs, verifyMs }) {
  const work = Math.max(0, remainingWorkMs || 0);
  const verify = Math.max(0, verifyMs || 0);
  const report = Math.max(0, reportMs || 0);
  const totalMs = work + verify + report;
  return {
    totalMs,
    phases: [
      { name: 'Finish open checks', etaMs: work },
      { name: 'Verify findings', etaMs: verify },
      { name: 'Write the report', etaMs: report },
    ],
    text: `Clean wrap-up in ${formatDuration(totalMs)}: ${formatDuration(work)} to finish open checks, ${formatDuration(verify)} to verify findings, ${formatDuration(report)} to write the report.`,
  };
}

// 51769 — pending approvals show how long they've waited
// approvals: [{ id, title, requestedAtMs, avgDecisionMs }], nowMs
export function approvalEta(approvals, nowMs) {
  return (approvals || []).map((a) => {
    const waitedMs = Math.max(0, (nowMs || 0) - (a.requestedAtMs || 0));
    const avg = Math.max(1, a.avgDecisionMs || 1);
    const expectedInMs = Math.max(0, avg - waitedMs);
    const overdue = waitedMs >= avg;
    return {
      id: a.id,
      title: a.title,
      waitedMs,
      expectedInMs,
      state: overdue ? 'overdue' : waitedMs >= avg * 0.75 ? 'nearing' : 'fresh',
      text: `${a.title}: waited ${formatDuration(waitedMs)}${overdue ? ` — overdue by ${formatDuration(waitedMs - avg)}` : `, decision expected in ~${formatDuration(expectedInMs)}`}.`,
    };
  });
}

// 51770 — on-demand tests show individual estimates with queue position
// tests: [{ id, name, requestedAtMs, expectedDurationMs, queuePosition }], nowMs
export function testRequestEta(tests, nowMs) {
  const now = nowMs || 0;
  return (tests || []).map((t) => {
    const waitedMs = Math.max(0, now - (t.requestedAtMs || 0));
    const dur = Math.max(0, t.expectedDurationMs || 0);
    const startsInMs = Math.max(0, (t.queuePosition || 0) * 8 * 60000);
    return {
      id: t.id,
      name: t.name,
      waitedMs,
      startsInMs,
      estimatedMs: dur,
      text: `${t.name}: queued ${formatDuration(waitedMs)}, starts in ~${formatDuration(startsInMs)}, runs ~${formatDuration(dur)}.`,
    };
  });
}

// 51771 — "done by morning" style estimate: does the finish beat the target?
// args: { finishAtMs, targetMorningMs }
export function overnightEta({ finishAtMs, targetMorningMs }) {
  const finish = finishAtMs || 0;
  const target = targetMorningMs || 0;
  const meetsMorning = finish <= target;
  const deltaMs = Math.abs(finish - target);
  return {
    finishAtMs: finish,
    targetMorningMs: target,
    meetsMorning,
    text: meetsMorning
      ? `Done by morning with ${formatDuration(deltaMs)} to spare.`
      : `Misses the morning target by ${formatDuration(deltaMs)} — trim scope or add parallelism to make it.`,
  };
}

// 51772 — finish times rendered for every team timezone
// finishAtMs, timezones: [{ label, offsetMin }]
export function etaTimezone(finishAtMs, timezones) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (timezones || []).map((tz) => {
    const d = new Date((finishAtMs || 0) + (tz.offsetMin || 0) * 60000);
    let h = d.getUTCHours();
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return {
      label: tz.label,
      clock: `${h}:${m} ${ap}`,
      weekday: DAYS[d.getUTCDay()],
      text: `${h}:${m} ${ap} ${tz.label} (${DAYS[d.getUTCDay()]})`,
    };
  });
}

// 51773 — pure string helper for the tab title; the component assigns document.title
export function etaTabTitle({ remainingMs, phaseName }) {
  const rem = formatDuration(remainingMs || 0);
  return `⏳ ${rem}${phaseName ? ' · ' + phaseName : ''} — Dark-Matter`;
}

// 51774 — "50% there" style progress milestones
// remainingMs, totalMs, milestonesPct: [25, 50, 75, 100]
export function etaMilestones(remainingMs, totalMs, milestonesPct) {
  const total = Math.max(1, totalMs || 1);
  const remaining = Math.max(0, remainingMs || 0);
  const donePct = Math.min(100, Math.round(((total - remaining) / total) * 100));
  return (milestonesPct || [25, 50, 75, 100]).map((pct) => ({
    pct,
    reached: donePct >= pct,
    label: pct === 100 ? 'Hunt complete' : `${pct}% there`,
    text: donePct >= pct ? `🎉 ${pct}% there — keep going.` : `${pct}% milestone: ${pct - donePct} points away.`,
  }));
}

// 51775 — warn when the estimate slips beyond a threshold
// args: { baselineMs, currentMs, thresholdMs }
export function etaDriftAlerts({ baselineMs, currentMs, thresholdMs }) {
  const base = Math.max(0, baselineMs || 0);
  const current = Math.max(0, currentMs || 0);
  const threshold = Math.max(0, thresholdMs || 15 * 60000);
  const delta = current - base;
  if (Math.abs(delta) <= threshold) return [];
  return [{
    direction: delta > 0 ? 'slipped' : 'shrunk',
    deltaMs: Math.abs(delta),
    text: delta > 0
      ? `⚠ ETA slipped ${formatDuration(delta)} beyond the ${formatDuration(threshold)} tolerance — now ${formatDuration(current)}.`
      : `✓ ETA improved ${formatDuration(-delta)} beyond the ${formatDuration(threshold)} tolerance — now ${formatDuration(current)}.`,
  }];
}

// 51776 — "what if I add two more hours?" answered instantly
// args: { remainingMs, scenarios: [{ id, label, addMs, removeMs, parallelismBoostPct }] }
export function etaScenarioPlanner({ remainingMs, scenarios }) {
  const remaining = Math.max(0, remainingMs || 0);
  return (scenarios || []).map((s) => {
    const add = Math.max(0, s.addMs || 0);
    const remove = Math.max(0, s.removeMs || 0);
    const boost = Math.max(0, s.parallelismBoostPct || 0);
    const boosted = boost ? Math.round((remaining + add - remove) / (1 + boost / 100)) : remaining + add - remove;
    const newRemainingMs = Math.max(0, boosted);
    return {
      id: s.id,
      label: s.label,
      newRemainingMs,
      deltaMs: newRemainingMs - remaining,
      text: `${s.label}: new ETA ${formatDuration(newRemainingMs)} (${newRemainingMs <= remaining ? 'saves' : 'adds'} ${formatDuration(Math.abs(newRemainingMs - remaining))}).`,
    };
  });
}

// 51777 — the agent explains estimate changes in plain words
// changes: [{ fromMs, toMs, cause, phaseName }]
export function etaLearning(changes) {
  return (changes || []).map((c) => {
    const from = Math.max(0, c.fromMs || 0);
    const to = Math.max(0, c.toMs || 0);
    const delta = to - from;
    const why = delta > 0
      ? `because ${c.cause || 'new work was discovered'}, so the finish moved out`
      : delta < 0
        ? `because ${c.cause || 'work finished ahead of pace'}, so the finish pulled in`
        : `— ${c.cause || 'no material change'}, the estimate held steady`;
    return {
      phase: c.phaseName || 'hunt',
      deltaMs: delta,
      text: `The estimate ${delta > 0 ? 'grew' : delta < 0 ? 'shrank' : 'stayed'} from ${formatDuration(from)} to ${formatDuration(to)} ${why}.`,
    };
  });
}

// 51778 — each sub-agent's remaining time shown in its tab
// subAgents: [{ id, name, tabName, remainingMs, taskCount }]
export function subAgentEtas(subAgents) {
  const rows = [...(subAgents || [])]
    .map((s) => ({ id: s.id, name: s.name, tabName: s.tabName || s.name, remainingMs: Math.max(0, s.remainingMs || 0), taskCount: s.taskCount || 0 }))
    .sort((a, b) => b.remainingMs - a.remainingMs);
  const total = rows.reduce((s, r) => s + r.remainingMs, 0);
  return {
    rows,
    totalMs: total,
    text: rows.length
      ? `${rows.length} sub-agents, ${formatDuration(total)} combined remaining — longest: ${rows[0].name} (${formatDuration(rows[0].remainingMs)}).`
      : 'No sub-agents running.',
  };
}

// 51779 — programmatic access to live estimates: route descriptors, no server code
// args: { baseUrl }
export function etaApi({ baseUrl }) {
  const base = (baseUrl || 'https://api.infinity-ai.example/v1').replace(/\/+$/, '');
  return [
    {
      method: 'GET',
      path: `${base}/hunts/{huntId}/eta`,
      description: 'Live remaining time, finish timestamp, and progress for one hunt.',
      sample: { remainingMs: 6600000, finishAtMs: 1728294600000, pctComplete: 31, confidence: 72 },
    },
    {
      method: 'GET',
      path: `${base}/hunts/{huntId}/eta/history`,
      description: 'The estimate recalculation log (see 51761) as paginated events.',
      sample: { events: [{ at: '09:30', estimateMs: 9600000, cause: 'added subnet' }] },
    },
    {
      method: 'POST',
      path: `${base}/hunts/{huntId}/eta/scenarios`,
      description: 'Evaluate a what-if plan; body: { addMs, removeMs, parallelismBoostPct }.',
      sample: { newRemainingMs: 5400000, deltaMs: -1200000 },
    },
    {
      method: 'GET',
      path: `${base}/hunts/eta-board`,
      description: 'Multi-hunt ETA board (see 51766) for every running hunt.',
      sample: { hunts: [{ id: 'H-1', remainingMs: 6600000 }] },
    },
  ];
}

// 51780 — timing analytics across all hunts
// hunts: [{ id, predictedMs, actualMs, findings }]
export function etaDashboard(hunts) {
  const hs = hunts || [];
  const withActual = hs.filter((h) => h.actualMs != null && h.predictedMs != null);
  const errors = withActual.map((h) => Math.abs(h.actualMs - h.predictedMs) / Math.max(1, h.predictedMs));
  const avgError = errors.length ? errors.reduce((s, e) => s + e, 0) / errors.length : 0;
  const accuracy = Math.max(0, Math.round((1 - avgError) * 100));
  const totalFindings = hs.reduce((s, h) => s + (h.findings || 0), 0);
  return {
    hunts: hs.length,
    accuracyPct: accuracy,
    avgErrorPct: Math.round(avgError * 100),
    totalFindings,
    verdict: accuracy >= 85 ? 'excellent' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'fair' : 'needs-work',
    text: `${hs.length} hunts tracked · estimate accuracy ${accuracy}% (${withActual.length} with actuals) · ${totalFindings} total findings.`,
  };
}

// 51781 — remaining time distributed fairly across assets by weight
// assets: [{ name, weight }], remainingMs
export function etaFairness(assets, remainingMs) {
  const total = Math.max(0, remainingMs || 0);
  const as = assets || [];
  const weights = as.map((a) => Math.max(1, a.weight || 1));
  const sum = weights.reduce((s, w) => s + w, 0);
  let assigned = 0;
  const rows = as.map((a, i) => {
    const share = i === as.length - 1 ? total - assigned : Math.round((total * weights[i]) / sum);
    assigned += share;
    return { name: a.name, weight: weights[i], etaMs: Math.max(0, share), fairSharePct: Math.round((share / Math.max(1, total)) * 100) };
  });
  return {
    rows,
    text: `Fair split of ${formatDuration(total)}: ${rows.map((r) => `${r.name} ${r.fairSharePct}%`).join(', ')}.`,
  };
}

// 51782 — when behind schedule, the agent adds parallelism to recover
// args: { remainingMs, plannedMs, currentParallelism, maxParallelism }
export function etaAutoscale({ remainingMs, plannedMs, currentParallelism, maxParallelism }) {
  const remaining = Math.max(0, remainingMs || 0);
  const planned = Math.max(1, plannedMs || 1);
  const current = Math.max(1, currentParallelism || 1);
  const max = Math.max(current, maxParallelism || current);
  const behind = remaining > planned;
  const overshoot = Math.max(0, remaining - planned);
  const addSlots = behind ? Math.min(max - current, Math.ceil(overshoot / planned)) : 0;
  const newParallelism = current + addSlots;
  const newRemainingMs = behind ? Math.round(remaining * (current / newParallelism)) : remaining;
  return {
    behind,
    addSlots,
    newParallelism,
    newRemainingMs,
    text: behind
      ? `Behind by ${formatDuration(overshoot)} — adding ${addSlots} parallel slot${addSlots === 1 ? '' : 's'} (${current}→${newParallelism}); new ETA ${formatDuration(newRemainingMs)}.`
      : `On schedule (${formatDuration(remaining)} vs ${formatDuration(planned)} planned) — no scaling needed.`,
  };
}

// 51783 — lock the plan so the estimate stops moving during reviews
// args: { estimate: { remainingMs, finishAtMs }, frozen, frozenAtMs }
export function etaFreeze({ estimate, frozen, frozenAtMs }) {
  const e = estimate || {};
  if (!frozen) {
    return {
      frozen: false,
      remainingMs: e.remainingMs || 0,
      text: `Estimate live — ${formatDuration(e.remainingMs || 0)} remaining.`,
    };
  }
  return {
    frozen: true,
    frozenAtMs: frozenAtMs || 0,
    remainingMs: e.remainingMs || 0,
    finishAtMs: e.finishAtMs || 0,
    text: `🔒 Plan frozen — the estimate is locked at ${formatDuration(e.remainingMs || 0)} until you unfreeze. New work queues behind the freeze.`,
  };
}

// 51784 — post-hunt accuracy review of every estimate
// args: { estimates: [{ at, estimateMs }], actualMs, predictedAtMs }
export function etaRetrospective({ estimates, actualMs, predictedAtMs }) {
  const actual = Math.max(1, actualMs || 1);
  const first = (estimates || [])[0];
  const last = (estimates || [])[(estimates || []).length - 1];
  const firstError = first ? Math.round((Math.abs(first.estimateMs - actual) / actual) * 100) : null;
  const lastError = last ? Math.round((Math.abs(last.estimateMs - actual) / actual) * 100) : null;
  const rows = (estimates || []).map((e) => {
    const err = Math.round((Math.abs((e.estimateMs || 0) - actual) / actual) * 100);
    return { at: e.at, estimateMs: e.estimateMs || 0, errorPct: err, accuracyPct: Math.max(0, 100 - err) };
  });
  const improvement = firstError != null && lastError != null ? firstError - lastError : 0;
  return {
    actualMs: actual,
    estimates: rows.length,
    firstErrorPct: firstError,
    lastErrorPct: lastError,
    improvedBy: improvement,
    verdict: lastError != null && lastError <= 10 ? 'accurate' : lastError != null && lastError <= 25 ? 'close' : 'drifted',
    text: rows.length
      ? `Actual ${formatDuration(actual)} vs first estimate ${formatDuration(first.estimateMs)} (${firstError}% off) and final estimate ${formatDuration(last.estimateMs)} (${lastError}% off) — estimates ${improvement >= 0 ? 'improved' : 'worsened'} by ${Math.abs(improvement)} points.`
      : 'No estimates were recorded for this hunt.',
  };
}

// 51785 — hands-free countdown script for the avatar
// question, remainingMs, phaseName
export function countdownVoiceScript(question, remainingMs, phaseName) {
  const rem = formatDuration(remainingMs || 0);
  const base = `About ${rem} to go${phaseName ? ` — currently in ${phaseName}` : ''}.`;
  const q = (question || '').toLowerCase();
  if (q.includes('finish') || q.includes('done')) return `We'll be done in roughly ${rem}. ${base}`;
  if (q.includes('phase')) return `${phaseName ? `We're in ${phaseName}, with ${rem} left overall.` : base}`;
  return `You asked "${question || 'how much longer'}?" — ${base}`;
}
