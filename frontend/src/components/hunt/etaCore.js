// etaCore.js — Infinity AI · wave 44 (ideas 51731–51760)
// Pure logic for the live ETA suite: remaining-time estimation, trends,
// intervals, deadlines, budgets, per-asset/per-finding splits, calibration,
// and stakeholder-ready ETA payloads.
// Time is milliseconds everywhere; wall-clock inputs are explicit epoch ms so
// every function is deterministic for a given input.
// No DOM, no network, no side effects: pure transforms over plain descriptors.
//
// Hunt-phase shape (input convention):
//   { name, status: 'done'|'active'|'pending', estimatedMs, elapsedMs }

export const ETA44_START = 51731;
export const ETA44_END = 51760;

export const ETA44_IDEAS = [
  [51731, 'Live ETA display', 'Always-visible estimated completion time for the whole hunt.'],
  [51732, 'Per-phase ETAs', 'Each remaining phase shows its own estimated duration.'],
  [51733, 'ETA confidence interval', 'A range ("2–3 hours") instead of a false-precise number.'],
  [51734, 'ETA trend', 'Whether the estimate is shrinking or slipping, shown as a trend.'],
  [51735, 'Current-step ETA', 'How long the specific action in progress should take.'],
  [51736, 'ETA breakdown', 'Expand to see which phases consume the remaining time.'],
  [51737, 'ETA history graph', 'How the estimate evolved since the hunt started.'],
  [51738, 'Finish-time clock', 'The ETA rendered as a wall-clock time in your timezone.'],
  [51739, 'ETA notifications', 'Alerted when the estimate shifts significantly.'],
  [51740, 'Deadline mode', 'Set a hard deadline; the agent replans to fit.'],
  [51741, 'Deadline feasibility', 'The agent says honestly whether the deadline is achievable.'],
  [51742, 'Time-budget tracker', 'Hours used versus hours allocated, visualized live.'],
  [51743, 'Overtime warnings', 'Warned before the hunt exceeds its budget.'],
  [51744, 'ETA by strategy', 'How each strategy option changes the remaining time.'],
  [51745, 'Steering impact on ETA', 'Redirections show their time cost before you confirm.'],
  [51746, 'Pause-adjusted ETA', 'Pauses and resumes recalculate the estimate automatically.'],
  [51747, 'ETA per asset', 'Remaining time broken down by in-scope asset.'],
  [51748, 'ETA per finding', 'Average time-to-next-finding based on current pace.'],
  [51749, 'Slowdown detection', 'Flagged when progress per hour drops below expectations.'],
  [51750, 'Speed-up options', 'The agent offers concrete ways to finish faster.'],
  [51751, 'ETA calibration', 'Estimates improve using your historical hunt data.'],
  [51752, 'ETA in chat', 'Ask "how much longer?" anytime for an instant answer.'],
  [51753, 'ETA voice announcements', 'Milestone time updates spoken during long hunts.'],
  [51754, 'ETA mobile widget', 'A home-screen widget showing the live countdown.'],
  [51755, 'ETA sharing', 'Share a read-only countdown link with stakeholders.'],
  [51756, 'ETA in snapshots', 'Every report snapshot stamps the current estimate.'],
  [51757, 'ETA vs plan variance', 'Planned versus actual pace shown side by side.'],
  [51758, 'Phase-duration predictions', 'Upcoming phases estimated from similar past hunts.'],
  [51759, 'ETA confidence meter', 'How much to trust the current estimate.'],
  [51760, 'Best/worst-case ETAs', 'Optimistic and pessimistic bounds alongside the main estimate.'],
];

// Format ms as a compact human duration: "45m", "2h 14m"
export function formatDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return `${h}h ${mm}m`;
}

// 51731 — whole-hunt live ETA from weighted remaining work
// args: { now, elapsedActiveMs, totalExpectedActiveMs }
export function liveEta({ now, elapsedActiveMs, totalExpectedActiveMs }) {
  const expected = Math.max(0, totalExpectedActiveMs || 0);
  const elapsed = Math.max(0, elapsedActiveMs || 0);
  const remainingMs = Math.max(0, expected - elapsed);
  const pctComplete = expected ? Math.min(100, Math.round((elapsed / expected) * 100)) : 0;
  return { remainingMs, finishAtMs: now + remainingMs, pctComplete, label: formatDuration(remainingMs) };
}

// 51732 — per-phase remaining estimates (active phase nets out elapsed time)
export function phaseEtas(phases) {
  return (phases || [])
    .filter((p) => p.status !== 'done')
    .map((p) => {
      const etaMs = p.status === 'active'
        ? Math.max(0, (p.estimatedMs || 0) - (p.elapsedMs || 0))
        : (p.estimatedMs || 0);
      return { name: p.name, status: p.status, etaMs };
    });
}

// 51733 — interval instead of a false-precise number; width shrinks with confidence
export function etaInterval(etaMs, confidence = 70) {
  const c = Math.max(0, Math.min(100, confidence));
  const half = Math.round(etaMs * (1 - c / 100) * 1.2);
  const loMs = Math.max(0, etaMs - half);
  const hiMs = etaMs + half;
  return { estimateMs: etaMs, loMs, hiMs, confidence: c, label: `${formatDuration(loMs)}–${formatDuration(hiMs)}` };
}

// 51734 — is the estimate shrinking or slipping? samples: [{ at, estimateMs }]
export function etaTrend(samples) {
  if (!samples || samples.length === 0) return { trend: 'unknown', deltaMs: 0, samples: 0 };
  const deltaMs = samples[samples.length - 1].estimateMs - samples[0].estimateMs;
  const tolerance = 5 * 60000;
  const trend = deltaMs < -tolerance ? 'shrinking' : deltaMs > tolerance ? 'slipping' : 'steady';
  return { trend, deltaMs, samples: samples.length };
}

// 51735 — current in-progress step: elapsed vs typical, with overrun flag
// step: { name, startedAt, now, typicalMs }
export function currentStepEta({ name, startedAt, now, typicalMs }) {
  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, typicalMs - elapsedMs);
  return { name, elapsedMs, typicalMs, remainingMs, runningOver: elapsedMs > typicalMs };
}

// 51736 — remaining time broken down by phase, largest share first
export function etaBreakdown(phases) {
  const rows = phaseEtas(phases);
  const total = rows.reduce((s, r) => s + r.etaMs, 0);
  return rows
    .map((r) => ({ ...r, sharePct: total ? Math.round((r.etaMs / total) * 100) : 0 }))
    .sort((a, b) => b.etaMs - a.etaMs);
}

// 51737 — normalized history series for the graph
// samples: [{ at, estimateMs }]
export function etaHistorySeries(samples) {
  return (samples || []).map((s) => ({ at: s.at, estimateMin: Math.round(s.estimateMs / 60000) }));
}

// 51738 — finish rendered as a wall-clock time; tz given explicitly so it is deterministic
export function finishTimeClock(finishAtMs, { tzOffsetMin = 330, label = 'IST' } = {}) {
  const d = new Date(finishAtMs + tzOffsetMin * 60000);
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const clock = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
  return { clock, label, weekday: d.toUTCString().slice(0, 3), text: `${clock} ${label}` };
}

// 51739 — alert only when the estimate shifts beyond the tolerance
export function etaShiftAlerts(prevMs, currMs, { thresholdMs = 900000 } = {}) {
  const deltaMs = currMs - prevMs;
  const significant = Math.abs(deltaMs) >= thresholdMs;
  return {
    significant,
    deltaMs,
    direction: deltaMs > 0 ? 'slipped' : deltaMs < 0 ? 'improved' : 'unchanged',
    text: significant
      ? `ETA ${deltaMs > 0 ? 'slipped' : 'improved'} by ${formatDuration(Math.abs(deltaMs))}.`
      : 'ETA steady within tolerance.',
  };
}

// 51740 — deadline mode: replan remaining phases to fit the available window
export function deadlinePlan(remainingPhases, availableMs) {
  const totalMs = remainingPhases.reduce((s, p) => s + (p.estimatedMs || 0), 0);
  const fits = totalMs <= availableMs;
  const factor = totalMs ? availableMs / totalMs : 1;
  return {
    fits,
    totalMs,
    availableMs,
    compressionFactor: Math.round(Math.min(1, factor) * 100) / 100,
    phases: remainingPhases.map((p) => ({
      name: p.name,
      fullMs: p.estimatedMs || 0,
      plannedMs: Math.round((p.estimatedMs || 0) * Math.min(1, factor)),
    })),
  };
}

// 51741 — honest feasibility verdict: feasible / marginal / infeasible with the margin
export function deadlineFeasibility(requiredMs, availableMs) {
  const marginMs = availableMs - requiredMs;
  const ratio = requiredMs ? availableMs / requiredMs : 1;
  const verdict = ratio >= 1.15 ? 'feasible' : ratio >= 0.95 ? 'marginal' : 'infeasible';
  const note = verdict === 'feasible'
    ? 'The deadline fits with buffer to spare.'
    : verdict === 'marginal'
      ? 'The deadline is tight: any slip misses it.'
      : 'The deadline cannot be met without cutting scope.';
  return { verdict, marginMs, ratio: Math.round(ratio * 100) / 100, note };
}

// 51742 — hours used vs allocated
export function budgetTracker(allocatedMs, usedMs) {
  const usedPct = allocatedMs ? Math.min(100, Math.round((usedMs / allocatedMs) * 100)) : 0;
  return {
    allocatedMs,
    usedMs,
    usedPct,
    remainingMs: Math.max(0, allocatedMs - usedMs),
    overBudget: usedMs > allocatedMs,
  };
}

// 51743 — warnings before (and when) the hunt exceeds its budget
export function overtimeWarnings(allocatedMs, usedMs, projectedTotalMs) {
  const warnings = [];
  if (usedMs >= allocatedMs) {
    warnings.push({ level: 'critical', text: 'Budget exhausted — the hunt is now in overtime.' });
  } else if (usedMs >= allocatedMs * 0.8) {
    warnings.push({ level: 'warning', text: `Budget ${Math.round((usedMs / allocatedMs) * 100)}% used — slow down or replan.` });
  }
  if (projectedTotalMs > allocatedMs) {
    warnings.push({ level: 'projected', text: `At current pace the hunt will overrun by ${formatDuration(projectedTotalMs - allocatedMs)}.` });
  }
  return warnings;
}

// 51744 — remaining time under each strategy option
// strategies: [{ name, scaleFactor, baseRemainingMs }]
export function etaByStrategy(strategies) {
  return (strategies || [])
    .map((s) => ({ name: s.name, scaleFactor: s.scaleFactor, remainingMs: Math.round(s.baseRemainingMs * s.scaleFactor) }))
    .sort((a, b) => a.remainingMs - b.remainingMs);
}

// 51745 — time cost of a proposed redirection, shown before the analyst confirms
// change: { description, addsMs, removesMs }
export function steeringTimeImpact(currentRemainingMs, { description = '', addsMs = 0, removesMs = 0 } = {}) {
  const deltaMs = addsMs - removesMs;
  const newRemainingMs = Math.max(0, currentRemainingMs + deltaMs);
  return {
    description,
    deltaMs,
    newRemainingMs,
    recommendation: deltaMs > 0
      ? `Costs ${formatDuration(deltaMs)} — confirm before redirecting.`
      : deltaMs < 0
        ? `Saves ${formatDuration(-deltaMs)} — worth doing.`
        : 'No time impact.',
  };
}

// 51746 — pause-aware ETA: pauses push the finish out by the paused duration
// eta: { remainingMs, finishAtMs }
export function pauseAdjustedEta(eta, { extraPausedMs = 0 } = {}) {
  return {
    remainingMs: eta.remainingMs,
    pausedMs: extraPausedMs,
    finishAtMs: eta.finishAtMs + extraPausedMs,
    note: extraPausedMs > 0
      ? `Paused ${formatDuration(extraPausedMs)} — finish pushed by the same amount.`
      : 'No pause adjustment.',
  };
}

// 51747 — remaining time split per asset (explicit remainingMs, or weight-proportional)
export function etaPerAsset(assets, totalRemainingMs) {
  const totalWeight = (assets || []).reduce((s, a) => s + (a.weight || 0), 0);
  return (assets || []).map((a) => ({
    name: a.name,
    etaMs: a.remainingMs != null
      ? a.remainingMs
      : Math.round(totalRemainingMs * ((a.weight || 0) / Math.max(1, totalWeight))),
  }));
}

// 51748 — average time-to-next-finding from current pace
export function etaPerFinding(findingsCount, elapsedActiveMs) {
  if (findingsCount <= 0 || elapsedActiveMs <= 0) {
    return { findingsPerHour: 0, avgMinutesPerFinding: null, nextFindingInMs: null, note: 'No findings yet — pace unknown.' };
  }
  const avgMs = elapsedActiveMs / findingsCount;
  const findingsPerHour = Math.round((findingsCount / (elapsedActiveMs / 3600000)) * 10) / 10;
  return {
    findingsPerHour,
    avgMinutesPerFinding: Math.round(avgMs / 60000),
    nextFindingInMs: Math.round(avgMs),
    note: `At current pace the next finding lands in about ${formatDuration(avgMs)}.`,
  };
}

// 51749 — flag when progress per hour drops below expectations
// paceSamples: [{ at, items, windowMs }]
export function slowdownDetection(paceSamples, expectedPerHour) {
  if (!paceSamples || paceSamples.length === 0) return { flagged: false, reason: 'No pace data yet.' };
  const latest = paceSamples[paceSamples.length - 1];
  const perHour = latest.windowMs > 0 ? latest.items / (latest.windowMs / 3600000) : 0;
  const ratio = expectedPerHour ? perHour / expectedPerHour : 1;
  const rounded = Math.round(perHour * 10) / 10;
  return {
    flagged: ratio < 0.6,
    perHour: rounded,
    expectedPerHour,
    ratio: Math.round(ratio * 100) / 100,
    reason: ratio < 0.6
      ? `Pace ${rounded}/h is under 60% of the expected ${expectedPerHour}/h.`
      : 'Pace is within expectations.',
  };
}

// 51750 — concrete ways to finish faster, each with real saved time
// state: { remainingMs, parallelizableMs, lowYieldMs }
export function speedupOptions({ remainingMs, parallelizableMs = 0, lowYieldMs = 0 } = {}) {
  const options = [];
  if (parallelizableMs > 0) {
    options.push({
      id: 'parallelize',
      label: 'Run independent phases in parallel',
      savesMs: Math.round(parallelizableMs / 2),
      tradeoff: 'Uses more compute; results arrive interleaved.',
    });
  }
  if (lowYieldMs > 0) {
    options.push({
      id: 'trim-low-yield',
      label: 'Skip low-yield checks first',
      savesMs: lowYieldMs,
      tradeoff: 'May miss low-severity findings.',
    });
  }
  options.push({
    id: 'narrow-scope',
    label: 'Focus on the two highest-value assets',
    savesMs: Math.round(remainingMs * 0.2),
    tradeoff: 'Remaining assets move to a follow-up hunt.',
  });
  return options.sort((a, b) => b.savesMs - a.savesMs);
}

// 51751 — learn a calibration factor from past hunts; calibrate() adjusts new estimates
// history: [{ predictedMs, actualMs }]
export function etaCalibration(history) {
  if (!history || history.length === 0) {
    return { factor: 1, direction: 'none', samples: 0, note: 'No historical hunts yet — estimates are uncalibrated.' };
  }
  const ratios = history.map((h) => (h.predictedMs ? h.actualMs / h.predictedMs : 1));
  const factor = Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100) / 100;
  const direction = factor > 1.05 ? 'underestimate' : factor < 0.95 ? 'overestimate' : 'calibrated';
  return {
    factor,
    direction,
    samples: history.length,
    note: `Past hunts ran ${factor}× the estimate.`,
    calibrate: (estimateMs) => Math.round(estimateMs * factor),
  };
}

// 51752 — chat answer to "how much longer?": instant, plain, with the finish clock
export function etaChatAnswer(question, eta) {
  const q = (question || '').toLowerCase();
  const range = `${formatDuration(eta.loMs != null ? eta.loMs : eta.etaMs)}–${formatDuration(eta.hiMs != null ? eta.hiMs : eta.etaMs)}`;
  const clock = finishTimeClock(eta.finishAtMs).text;
  if (q.includes('done') || q.includes('finish') || q.includes('longer') || q.includes('left') || q.includes('remaining')) {
    return `About ${formatDuration(eta.etaMs)} left (roughly ${range}), finishing around ${clock}.`;
  }
  return `Current estimate: ${formatDuration(eta.etaMs)} remaining (${range}), finishing around ${clock}.`;
}

// 51753 — spoken milestone script for long hunts
export function etaVoiceScript(milestone, etaMs) {
  return `Milestone update: ${milestone}. Roughly ${formatDuration(etaMs)} of the hunt remains. I will announce again at the next phase change.`;
}

// 51754 — compact payload for the mobile home-screen widget
export function etaWidgetPayload({ etaMs, finishAtMs, pctComplete = 0 }) {
  return {
    etaMin: Math.round(etaMs / 60000),
    clock: finishTimeClock(finishAtMs).text,
    pctComplete,
    compact: `${formatDuration(etaMs)} · ${pctComplete}%`,
  };
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 51755 — read-only share link encoding the current ETA state (no control actions)
export function etaShareLink(baseUrl, { etaMs, finishAtMs, huntName = 'hunt' }) {
  const token = toBase64Url(JSON.stringify({ etaMs, finishAtMs, huntName }));
  return {
    url: `${String(baseUrl).replace(/\/$/, '')}/eta/${token}`,
    readOnly: true,
    note: 'Read-only countdown link — no control actions are exposed.',
  };
}

// 51756 — stamp the current estimate onto a report snapshot
export function snapshotEtaStamp(eta, { at = 'now', snapshotId = 'snapshot' } = {}) {
  return {
    snapshotId,
    at,
    remainingMs: eta.remainingMs,
    finishAtMs: eta.finishAtMs,
    confidence: eta.confidence != null ? eta.confidence : null,
  };
}

// 51757 — planned vs actual pace side by side
export function etaVariance(plannedMs, actualMs) {
  const deltaMs = actualMs - plannedMs;
  const pct = plannedMs ? Math.round((deltaMs / plannedMs) * 100) : 0;
  const status = deltaMs <= 0 ? 'ahead' : pct <= 10 ? 'on-track' : 'behind';
  return {
    plannedMs,
    actualMs,
    deltaMs,
    pct,
    status,
    text: deltaMs <= 0
      ? `${formatDuration(-deltaMs)} ahead of plan.`
      : `${formatDuration(deltaMs)} behind plan (${pct}%).`,
  };
}

// 51758 — predict upcoming phase durations from medians of similar past hunts
// historical: [{ name, actualMs }]
export function phasePredictions(upcoming, historical) {
  const byName = {};
  (historical || []).forEach((h) => { (byName[h.name] = byName[h.name] || []).push(h.actualMs); });
  const all = (historical || []).map((h) => h.actualMs).sort((a, b) => a - b);
  const median = (arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : null);
  const globalMedian = median(all);
  return (upcoming || []).map((name) => {
    const same = (byName[name] || []).sort((a, b) => a - b);
    const match = median(same);
    return {
      name,
      predictedMs: match != null ? match : globalMedian,
      source: match != null
        ? `median of ${same.length} similar past phase(s)`
        : 'median of all past phases',
      samples: same.length,
    };
  });
}

// 51759 — how much to trust the estimate: data points, calibration freshness, progress
export function etaConfidenceMeter({ dataPoints = 0, calibrationAgeDays = 0, progressPct = 0 } = {}) {
  const dataScore = Math.min(40, dataPoints * 8);
  const freshScore = Math.max(0, 30 - calibrationAgeDays);
  const progressScore = Math.min(30, progressPct * 0.3);
  const meter = Math.round(dataScore + freshScore + progressScore);
  return {
    meter,
    trust: meter >= 80 ? 'high' : meter >= 50 ? 'moderate' : 'low',
    factors: { dataScore, freshScore, progressScore },
  };
}

// 51760 — optimistic and pessimistic bounds alongside the main estimate
export function etaBounds(etaMs, confidence = 70) {
  const c = Math.max(0, Math.min(100, confidence));
  const spread = etaMs * (1 - c / 100);
  const bestMs = Math.max(0, Math.round(etaMs - spread));
  const worstMs = Math.round(etaMs + spread * 1.5);
  return { estimateMs: etaMs, bestMs, worstMs, label: `Best ${formatDuration(bestMs)} · worst ${formatDuration(worstMs)}` };
}
