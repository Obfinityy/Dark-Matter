// resourceRound7Core.js — Infinity AI · wave 46 (ideas 51821–51840)
// Pure logic for resource monitoring round 7: efficiency leaderboards, hunt
// retrospectives, live cost tickers, budget top-ups, guardrails, usage
// heatmaps, voice queries, mobile payloads, multi-hunt boards, export
// schedules, carbon estimates, budget pooling, idle-hunt costs, early-data
// forecasts, cost-per-finding, quota API shapes, alert routing, historical
// trends, off-peak scheduling, and one-click report descriptors.
// No DOM, no network, no side effects: pure transforms over plain descriptors.

export const WAVE46_R7_START = 51821;
export const WAVE46_R7_END = 51840;

export const WAVE46_R7_IDEAS = [
  [51821, 'Resource efficiency leaderboard', 'Hunts ranked by efficiency: findings per USD.'],
  [51822, 'Resource retrospective', 'Post-hunt review text with optimization tips.'],
  [51823, 'Live cost ticker', 'Cumulative spend total ticking with every event.'],
  [51824, 'Budget top-up', 'Add funds to the hunt budget with an audit record.'],
  [51825, 'Resource guardrails', 'Evaluated states for every resource rule.'],
  [51826, 'Usage heatmap', 'Usage cells normalized into a 0–1 intensity grid.'],
  [51827, 'Resource voice query', 'Spoken answers like "we have spent $12.40 so far".'],
  [51828, 'Mobile resource payload', 'Compact usage payload for the mobile view.'],
  [51829, 'Multi-hunt resource board', 'Side-by-side resource comparison rows.'],
  [51830, 'Resource export schedule', 'Scheduled usage-report record for a hunt.'],
  [51831, 'Carbon footprint estimate', 'Estimated kg CO2e from compute energy.'],
  [51832, 'Shared resource pools', 'Budgets pooled and split across hunts.'],
  [51833, 'Idle resource display', 'What paused hunts still cost while idle.'],
  [51834, 'Early-data prediction', 'Forecast from the first ten minutes of data.'],
  [51835, 'Spend per finding', 'Cost for each confirmed finding.'],
  [51836, 'Resource quota API', 'Quota-check response shape for integrations.'],
  [51837, 'Alert routing', 'Route resource alerts to recipients per policy.'],
  [51838, 'Historical efficiency trends', 'Month-by-month efficiency trend series.'],
  [51839, 'Off-peak scheduling', 'Off-peak window suggestions for heavy work.'],
  [51840, 'One-click resource report', 'Report descriptor attaching to the final report.'],
];

// 51821 — hunts ranked by efficiency: findings per USD
// hunts: [{ id, name, costUsd, findings }]
export function resourceLeaderboard(hunts) {
  const rows = [...(hunts || [])].map((h) => {
    const cost = Math.max(0.0001, h.costUsd || 0);
    const findings = Math.max(0, h.findings || 0);
    return {
      id: h.id,
      name: h.name,
      costUsd: Math.max(0, h.costUsd || 0),
      findings,
      findingsPerUsd: Math.round((findings / cost) * 100) / 100,
    };
  }).sort((a, b) => b.findingsPerUsd - a.findingsPerUsd);
  return {
    rows,
    count: rows.length,
    text: rows.length
      ? `Top efficiency: ${rows[0].name} with ${rows[0].findingsPerUsd} findings/USD; ${rows.length} hunts ranked.`
      : 'No hunts to rank.',
  };
}

// 51822 — post-hunt review text plus optimization tips
// hunt: { id, costUsd, budgetUsd, requests, tokens, findings, wallMs }
export function resourceRetrospective(hunt) {
  const h = hunt || {};
  const cost = Math.max(0, h.costUsd || 0);
  const budget = Math.max(0.01, h.budgetUsd || 1);
  const pct = Math.round((cost / budget) * 100);
  const findings = Math.max(0, h.findings || 0);
  const costPerFinding = findings > 0 ? Math.round((cost / findings) * 100) / 100 : null;
  const tokens = Math.max(0, h.tokens || 0);
  const requests = Math.max(0, h.requests || 0);
  const tips = [];
  if (pct > 100) tips.push('Overspent the budget — set pause triggers next time (see 51810).');
  else if (pct > 85) tips.push('Ran close to the budget — add mid-hunt alerts at 50% and 80%.');
  else tips.push('Left budget on the table — go deeper or widen the asset list next run.');
  if (requests > 0 && findings === 0) tips.push('Zero findings after heavy requests — tune target selection and recheck waste flags.');
  if (costPerFinding != null && costPerFinding > 2) tips.push('Findings are expensive — try the balanced preset or raise parallelism against cheap targets.');
  if (tokens > 0 && requests > 0 && tokens / requests < 500) tips.push('Very few tokens per request — you may be underusing the model on each check.');
  const text = `Retrospective for ${h.id || 'this hunt'}: $${cost.toFixed(2)} spent of a $${budget.toFixed(2)} budget (${pct}%), ${findings} findings${costPerFinding != null ? ` at $${costPerFinding.toFixed(2)} each` : ''}, ${requests.toLocaleString('en-US')} requests, ${tokens.toLocaleString('en-US')} tokens.`;
  return { text, tips, spentPct: pct, costPerFinding };
}

// 51823 — cumulative live total from spend events
// spendEvents: [{ at, amountUsd }]
export function costTicker(spendEvents) {
  const events = [...(spendEvents || [])]
    .filter((e) => e && typeof e.amountUsd === 'number')
    .map((e) => ({ at: e.at, amountUsd: Math.max(0, e.amountUsd) }));
  let running = 0;
  const points = events.map((e) => {
    running = Math.round((running + e.amountUsd) * 100) / 100;
    return { at: e.at, amountUsd: e.amountUsd, cumulativeUsd: running };
  });
  const last = points[points.length - 1];
  return {
    points,
    totalUsd: last ? last.cumulativeUsd : 0,
    events: points.length,
    text: last
      ? `Live spend ticker: $${last.cumulativeUsd.toFixed(2)} across ${points.length} events.`
      : 'No spend events yet.',
  };
}

// 51824 — add funds to the hunt budget with an audit record
// budget: { currentUsd }, amount: top-up amount; recordedAtMs optional epoch
export function budgetTopUp(budget, amount, recordedAtMs) {
  const current = Math.max(0, (budget && budget.currentUsd) || 0);
  const add = Math.max(0, amount || 0);
  const record = {
    previousUsd: current,
    addedUsd: Math.round(add * 100) / 100,
    newUsd: Math.round((current + add) * 100) / 100,
    atMs: recordedAtMs || 0,
  };
  return {
    ...record,
    text: `Budget topped up from $${current.toFixed(2)} to $${record.newUsd.toFixed(2)} (+$${record.addedUsd.toFixed(2)}).`,
  };
}

// 51825 — evaluated states for every resource rule
// rules: [{ id, name, metric, op, threshold, level }], state: { metric: value }
export function resourceGuardrails(rules, state) {
  const s = state || {};
  const rows = (rules || []).map((r) => {
    const value = s[r.metric];
    let tripped = false;
    if (value != null) {
      switch (r.op) {
        case '>=': tripped = value >= r.threshold; break;
        case '>': tripped = value > r.threshold; break;
        case '<=': tripped = value <= r.threshold; break;
        case '<': tripped = value < r.threshold; break;
        default: tripped = false;
      }
    }
    return {
      id: r.id,
      name: r.name,
      metric: r.metric,
      value: value == null ? null : value,
      threshold: r.threshold,
      level: r.level || 'warning',
      state: value == null ? 'unknown' : tripped ? 'tripped' : 'holding',
    };
  });
  const tripped = rows.filter((r) => r.state === 'tripped');
  return {
    rows,
    trippedCount: tripped.length,
    healthy: tripped.length === 0,
    text: tripped.length
      ? `🚧 ${tripped.length} guardrail${tripped.length === 1 ? '' : 's'} tripped: ${tripped.map((r) => r.name).join(', ')}.`
      : `All ${rows.length} guardrails holding.`,
  };
}

// 51826 — usage cells normalized into a 0–1 intensity grid
// cells: [{ row, col, value }] → rows of intensities
export function usageHeatmap(cells) {
  const cs = cells || [];
  const max = Math.max(1, ...cs.map((c) => Math.max(0, c.value || 0)));
  const grid = {};
  for (const c of cs) {
    const row = c.row || 'r0';
    const col = c.col || 0;
    const intensity = Math.round((Math.max(0, c.value || 0) / max) * 100) / 100;
    if (!grid[row]) grid[row] = [];
    grid[row][col] = { value: Math.max(0, c.value || 0), intensity };
  }
  return {
    rows: Object.entries(grid).map(([row, cols]) => ({ row, cells: cols })),
    max,
    text: cs.length
      ? `Heatmap of ${cs.length} cells — hottest ${max.toLocaleString('en-US')} normalized to 1.0.`
      : 'No heatmap cells.',
  };
}

// 51827 — spoken answers for plain-language spend queries
// text: the question; usage: { spentUsd, budgetUsd, requests, tokens, findings }
export function resourceVoiceQuery(text, usage) {
  const q = String(text || '').toLowerCase();
  const u = usage || {};
  const spent = Math.max(0, u.spentUsd || 0);
  const budget = Math.max(0, u.budgetUsd || 0);
  const pct = budget ? Math.round((spent / budget) * 100) : 0;
  const req = Math.max(0, u.requests || 0);
  const tok = Math.max(0, u.tokens || 0);
  const findings = Math.max(0, u.findings || 0);
  if (q.includes('spend') || q.includes('spent') || q.includes('cost') || q.includes('much')) {
    return `We have spent $${spent.toFixed(2)} so far${budget ? ` of a $${budget.toFixed(2)} budget — that's ${pct}%` : ''}.`;
  }
  if (q.includes('budget') || q.includes('left') || q.includes('remain')) {
    return budget
      ? `$${Math.max(0, budget - spent).toFixed(2)} of the budget is still available.`
      : 'No budget is set for this hunt.';
  }
  if (q.includes('request')) {
    return `${req.toLocaleString('en-US')} requests sent so far${tok ? ` with ${tok.toLocaleString('en-US')} tokens` : ''}.`;
  }
  if (q.includes('finding')) {
    return findings
      ? `${findings} finding${findings === 1 ? '' : 's'} confirmed${spent ? ` at $${(spent / findings).toFixed(2)} each` : ''}.`
      : 'No confirmed findings yet.';
  }
  return `Right now we have spent $${spent.toFixed(2)}${budget ? ` of $${budget.toFixed(2)}` : ''}, with ${findings} findings.`;
}

// 51828 — compact usage payload for the mobile view
// usage: { spentUsd, budgetUsd, requests, tokens, findings, quotaPct }
export function mobileResourcePayload(usage) {
  const u = usage || {};
  const budget = Math.max(0, u.budgetUsd || 0);
  const spent = Math.max(0, u.spentUsd || 0);
  return {
    v: 1,
    spent: Math.round(spent * 100) / 100,
    budget,
    pct: budget ? Math.round((spent / budget) * 100) : 0,
    req: Math.max(0, u.requests || 0),
    tok: Math.max(0, u.tokens || 0),
    f: Math.max(0, u.findings || 0),
    q: u.quotaPct != null ? u.quotaPct : null,
  };
}

// 51829 — side-by-side resource comparison rows
// hunts: [{ id, name, costUsd, budgetUsd, requests, findings }]
export function multiHuntResourceBoard(hunts) {
  const rows = [...(hunts || [])].map((h) => {
    const budget = Math.max(0.01, h.budgetUsd || 1);
    const spent = Math.max(0, h.costUsd || 0);
    const findings = Math.max(0, h.findings || 0);
    return {
      id: h.id,
      name: h.name,
      spentUsd: Math.round(spent * 100) / 100,
      budgetPct: Math.round((spent / budget) * 100),
      requests: Math.max(0, h.requests || 0),
      findings,
      costPerFinding: findings > 0 ? Math.round((spent / findings) * 100) / 100 : null,
    };
  }).sort((a, b) => b.budgetPct - a.budgetPct);
  return {
    rows,
    count: rows.length,
    text: rows.length
      ? `${rows.length} hunts side by side — hottest burn: ${rows[0].name} at ${rows[0].budgetPct}% of budget.`
      : 'No hunts on the board.',
  };
}

// 51830 — scheduled usage-report record for a hunt
// hunt: { id }, schedule: { cadence: 'daily'|'weekly', hourUtc, recipients }
export function resourceExportSchedule(hunt, schedule) {
  const s = schedule || {};
  const cadence = ['daily', 'weekly'].includes(s.cadence) ? s.cadence : 'daily';
  return {
    huntId: (hunt && hunt.id) || null,
    cadence,
    hourUtc: Math.max(0, Math.min(23, s.hourUtc != null ? s.hourUtc : 9)),
    recipients: s.recipients || [],
    enabled: s.enabled !== false,
    format: s.format || 'pdf',
    text: `Resource report for ${hunt && hunt.id} scheduled ${cadence} at ${String(Math.max(0, Math.min(23, s.hourUtc != null ? s.hourUtc : 9))).padStart(2, '0')}:00 UTC in ${(s.format || 'pdf').toUpperCase()}.`,
  };
}

// 51831 — estimated kg CO2e from compute energy
// kwh: kilowatt-hours; gridFactor defaults to 0.4 kg CO2e/kWh
export function carbonEstimate(kwh, gridFactor) {
  const energy = Math.max(0, kwh || 0);
  const factor = gridFactor != null ? Math.max(0, gridFactor) : 0.4;
  const kg = Math.round(energy * factor * 100) / 100;
  return {
    kwh: energy,
    gridFactor: factor,
    kgCO2e: kg,
    rating: kg < 1 ? 'low' : kg < 10 ? 'moderate' : 'high',
    text: `Estimated ${kg.toFixed(2)} kg CO2e for ${energy.toFixed(2)} kWh of compute.`,
  };
}

// 51832 — budgets pooled and split across hunts
// pools: [{ id, name, budgetUsd, assignedHunts: [huntId] }]
export function resourceSharing(pools) {
  const ps = pools || [];
  const rows = ps.map((p) => {
    const n = Math.max(1, (p.assignedHunts || []).length);
    const perHunt = Math.round(((p.budgetUsd || 0) / n) * 100) / 100;
    return {
      id: p.id,
      name: p.name,
      budgetUsd: Math.max(0, p.budgetUsd || 0),
      hunts: n,
      perHuntUsd: perHunt,
    };
  });
  const totalUsd = Math.round(rows.reduce((s, r) => s + r.budgetUsd, 0) * 100) / 100;
  return {
    rows,
    totalUsd,
    text: ps.length
      ? `${ps.length} shared pool${ps.length === 1 ? '' : 's'} totalling $${totalUsd.toFixed(2)} across ${rows.reduce((s, r) => s + r.hunts, 0)} hunt assignments.`
      : 'No shared resource pools.',
  };
}

// 51833 — what paused hunts still cost while idle
// hunts: [{ id, name, pausedAtMs, idleCostPerDayUsd, nowMs }]
export function idleResourceDisplay(hunts) {
  const rows = (hunts || []).map((h) => {
    const pausedMs = Math.max(0, (h.nowMs || 0) - (h.pausedAtMs || 0));
    const idleDays = pausedMs / 86400000;
    const idleCostUsd = Math.round(idleDays * Math.max(0, h.idleCostPerDayUsd || 0) * 100) / 100;
    return { id: h.id, name: h.name, idleCostUsd, pausedDays: Math.round(idleDays * 10) / 10 };
  });
  const total = Math.round(rows.reduce((s, r) => s + r.idleCostUsd, 0) * 100) / 100;
  return {
    rows,
    totalIdleCostUsd: total,
    text: rows.length
      ? `${rows.length} paused hunt${rows.length === 1 ? '' : 's'} costing $${total.toFixed(2)} while idle.`
      : 'No paused hunts.',
  };
}

// 51834 — forecast from the first ten minutes of data
// first10min: [{ atMs, usedUsd }], elapsedMs: planned total hunt time
export function resourcePrediction(first10min, elapsedMs) {
  const pts = [...(first10min || [])].sort((a, b) => a.atMs - b.atMs);
  if (pts.length < 2 || elapsedMs <= 0) {
    return { projectedUsd: 0, confidence: 'low', method: 'early-extrapolation', text: 'Not enough early data — run the hunt for a few more minutes.' };
  }
  const span = Math.max(1, pts[pts.length - 1].atMs - pts[0].atMs);
  const spent = Math.max(0, pts[pts.length - 1].usedUsd - pts[0].usedUsd);
  const rate = spent / span;
  const remaining = Math.max(0, elapsedMs - span);
  const projectedUsd = Math.round((pts[pts.length - 1].usedUsd + rate * remaining) * 100) / 100;
  const variance = pts.length > 2
    ? Math.max(...pts.map((p) => p.usedUsd)) - Math.min(...pts.map((p) => p.usedUsd))
    : spent;
  return {
    projectedUsd,
    confidence: variance / Math.max(1, spent) < 0.5 ? 'medium' : 'low',
    method: 'early-extrapolation',
    text: `Early-data forecast: $${projectedUsd.toFixed(2)} total from the first ${Math.round(span / 60000)} minutes of burn.`,
  };
}

// 51835 — cost for each confirmed finding
// cost: total hunt cost USD, findings: confirmed finding count
export function spendByFinding(cost, findings) {
  const c = Math.max(0, cost || 0);
  const f = Math.max(0, findings || 0);
  const perFinding = f > 0 ? Math.round((c / f) * 100) / 100 : null;
  return {
    costUsd: c,
    findings: f,
    perFindingUsd: perFinding,
    text: f > 0
      ? `$${c.toFixed(2)} across ${f} confirmed finding${f === 1 ? '' : 's'} — $${perFinding.toFixed(2)} each.`
      : `$${c.toFixed(2)} spent with no confirmed findings yet.`,
  };
}

// 51836 — quota-check response shape for integrations
// budget: { spentUsd, limitUsd }
export function resourceQuotaApi(budget) {
  const b = budget || {};
  const spent = Math.max(0, b.spentUsd || 0);
  const limit = Math.max(0.01, b.limitUsd || 1);
  const pct = Math.round((spent / limit) * 100);
  const remaining = Math.max(0, limit - spent);
  return {
    ok: pct < 100,
    spentUsd: spent,
    limitUsd: limit,
    remainingUsd: Math.round(remaining * 100) / 100,
    usedPct: pct,
    retryAfterSec: pct >= 100 ? 3600 : null,
    text: pct >= 100 ? 'Quota exhausted — stop spending, top up the budget.' : `${pct}% of quota used, $${remaining.toFixed(2)} remaining.`,
  };
}

// 51837 — route resource alerts to recipients per policy
// alert: { id, level }, policies: [{ level, recipients: [email] }]
export function alertRouting(alert, policies) {
  const a = alert || {};
  const match = (policies || []).find((p) => p.level === a.level);
  const recipients = (match && match.recipients) || [];
  const fallback = (policies || []).find((p) => p.level === 'default');
  const final = recipients.length ? recipients : (fallback && fallback.recipients) || [];
  return {
    alertId: a.id || null,
    level: a.level || 'info',
    recipients: final,
    routed: final.length > 0,
    text: final.length
      ? `Alert routed to ${final.join(', ')} via the "${a.level}" policy.`
      : `No recipients for level "${a.level}" — alert held for review.`,
  };
}

// 51838 — month-by-month efficiency trend series
// months: [{ label, costUsd, findings }]
export function historicalTrends(months) {
  const rows = (months || []).map((m) => {
    const cost = Math.max(0.0001, m.costUsd || 0);
    const findings = Math.max(0, m.findings || 0);
    return {
      label: m.label,
      costUsd: Math.max(0, m.costUsd || 0),
      findings,
      findingsPerUsd: Math.round((findings / cost) * 100) / 100,
    };
  });
  const trend = rows.length >= 2
    ? rows[rows.length - 1].findingsPerUsd - rows[0].findingsPerUsd
    : 0;
  const direction = trend > 0.05 ? 'improving' : trend < -0.05 ? 'declining' : 'flat';
  return {
    rows,
    trendDelta: Math.round(trend * 100) / 100,
    direction,
    text: rows.length
      ? `Efficiency trend ${direction} over ${rows.length} months (${rows[0].label} → ${rows[rows.length - 1].label}).`
      : 'No historical data.',
  };
}

// 51839 — off-peak window suggestions for heavy work
// hunts: [{ id, name, heavyWork: 'high'|'low' }], windows: [{ label, offPeak, discountPct }]
export function awareScheduling(hunts, windows) {
  const ws = (windows || []).filter((w) => w.offPeak);
  const heavy = (hunts || []).filter((h) => h.heavyWork === 'high');
  const suggestions = heavy.map((h) => ({
    huntId: h.id,
    huntName: h.name,
    windows: ws.map((w) => ({ label: w.label, discountPct: Math.max(0, w.discountPct || 0) })),
  }));
  const best = ws.length ? [...ws].sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))[0] : null;
  return {
    suggestions,
    count: suggestions.length,
    text: suggestions.length && best
      ? `Move ${suggestions.length} heavy hunt${suggestions.length === 1 ? '' : 's'} to "${best.label}" for a ${best.discountPct}% off-peak discount.`
      : suggestions.length
        ? `${suggestions.length} heavy hunts found but no off-peak windows are configured.`
        : 'No heavy work needs rescheduling.',
  };
}

// 51840 — report descriptor attaching to the final hunt report
// hunt: { id, name, costUsd, findings, durationMs }
export function oneClickResourceReport(hunt) {
  const h = hunt || {};
  const cost = Math.max(0, h.costUsd || 0);
  const findings = Math.max(0, h.findings || 0);
  const duration = Math.max(0, h.durationMs || 0);
  const mins = Math.max(1, Math.round(duration / 60000));
  return {
    huntId: h.id || null,
    title: `Resource report — ${h.name || h.id || 'hunt'}`,
    sections: [
      { name: 'Spend summary', detail: `$${cost.toFixed(2)} total spend` },
      { name: 'Findings value', detail: `${findings} confirmed findings` },
      { name: 'Duration', detail: `${mins} minutes wall-clock` },
      { name: 'Cost per finding', detail: findings > 0 ? `$${(cost / findings).toFixed(2)}` : 'n/a' },
    ],
    attachment: {
      kind: 'resource-report',
      format: 'markdown',
      filename: `resource-report-${h.id || 'hunt'}.md`,
    },
    text: `One-click resource report ready for ${h.id || 'this hunt'} — $${cost.toFixed(2)} spend, ${findings} findings, attach as resource-report-${h.id || 'hunt'}.md.`,
  };
}
