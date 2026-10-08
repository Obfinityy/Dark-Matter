/**
 * resourceRound6Core.js — Infinity AI · wave 46 (ideas 51801–51820)
 * Pure logic for resource monitoring round 6: usage forecasting, comparisons,
 * CSV export, alert webhooks, per-asset views, cost breakdowns, quotas, egress
 * anomaly flags, disk tracking, auto-pause triggers, eco mode, presets, team
 * rollups, chargeback, anomaly alerts, parallelism tuning, cache hit rates,
 * strategy hints, session-time splits, and API quota monitoring.
 * No DOM, no network, no side effects: pure transforms over plain descriptors.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */
export const WAVE46_R6_START = 51801;
export const WAVE46_R6_END = 51820;

export const WAVE46_R6_IDEAS = [
  [51801, 'Usage forecaster', 'Linear projection of total usage and cost at hunt completion.'],
  [51802, 'Historical usage comparison', 'Deltas against the historical average burn.'],
  [51803, 'Resource CSV export', 'Usage rows exported as an RFC4180-style CSV string.'],
  [51804, 'Alert webhook rules', 'Crossed resource thresholds produce webhook payloads.'],
  [51805, 'Per-asset resource view', 'Per-asset usage rows with hunt-wide totals.'],
  [51806, 'Model cost breakdown', 'Spend per model with percentage of total.'],
  [51807, 'Quota session view', 'Remaining session time and percent of quota left.'],
  [51808, 'Egress spike monitor', 'Anomaly flags raised on traffic spikes.'],
  [51809, 'Disk growth tracker', 'Growth rate plus projected disk fill date.'],
  [51810, 'Auto-pause triggers', 'Rules that pause the hunt when conditions fire.'],
  [51811, 'Eco mode', 'Reduced token/request/compute targets for light hunts.'],
  [51812, 'Resource presets', 'Light, balanced, and unlimited usage profiles.'],
  [51813, 'Team resource dashboard', 'Organization-wide resource rollup across hunts.'],
  [51814, 'Chargeback tagging', 'Spend mapped to cost centers per tag.'],
  [51815, 'Usage anomaly alerts', 'Statistical anomaly flags on usage series.'],
  [51816, 'Parallelism tuner', 'Cost/throughput impact per concurrency level.'],
  [51817, 'Cache hit-rate monitor', 'Hit rates plus the reuse summary.'],
  [51818, 'Strategy hints', 'Budget-aware advice like "under budget — go deeper".'],
  [51819, 'Session time split', 'Wall-clock versus active compute time.'],
  [51820, 'API quota monitor', 'Remaining quota with throttling flags.'],
];

// 51801 — linear projection of total usage and cost at completion
// samples: [{ elapsedMs, usedUsd }] must be ascending; elapsedMs > 0; budgetUsd optional
// budgetUsd: spend budget for the hunt
export function forecastUsage(samples, elapsedMs, budgetUsd) {
  const pts = [...(samples || [])]
    .filter(s => s && s.elapsedMs > 0 && s.usedUsd >= 0)
    .sort((a, b) => a.elapsedMs - b.elapsedMs);
  const budget = Math.max(0, budgetUsd || 0);
  if (pts.length < 2 || elapsedMs <= 0) {
    const spent = pts.length ? pts[pts.length - 1].usedUsd : 0;
    return {
      projectedUsd: spent,
      confidence: 'low',
      burnPerHour: 0,
      budgetPct: budget ? Math.round((spent / budget) * 100) : 0,
      text: 'Not enough samples to forecast — need at least two usage readings.',
    };
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  const spanMs = Math.max(1, last.elapsedMs - first.elapsedMs);
  const spanUsd = Math.max(0, last.usedUsd - first.usedUsd);
  const burnPerHour = (spanUsd / spanMs) * 3600000;
  const remainingMs = Math.max(0, elapsedMs - last.elapsedMs);
  const projectedUsd =
    Math.round((last.usedUsd + (burnPerHour * remainingMs) / 3600000) * 100) / 100;
  return {
    projectedUsd,
    burnPerHour: Math.round(burnPerHour * 100) / 100,
    confidence: pts.length >= 5 ? 'high' : 'medium',
    budgetPct: budget ? Math.round((projectedUsd / budget) * 100) : 0,
    text: `Burning $${burnPerHour.toFixed(2)}/h — projected $${projectedUsd.toFixed(2)} at completion${budget ? ` (${Math.round((projectedUsd / budget) * 100)}% of the $${budget} budget)` : ''}.`,
  };
}

// 51802 — deltas vs the historical average burn
// current: { requests, tokens, cost }, historical: { avgRequests, avgTokens, avgCost }
export function usageComparison(current, historical) {
  const cur = current || {};
  const hist = historical || {};
  const keys = [
    ['requests', cur.requests, hist.avgRequests],
    ['tokens', cur.tokens, hist.avgTokens],
    ['cost', cur.cost, hist.avgCost],
  ];
  const rows = keys.map(([label, now, avg]) => {
    const n = Math.max(0, now || 0);
    const a = Math.max(1, avg || 1);
    const delta = n - a;
    const deltaPct = Math.round((delta / a) * 100);
    const direction = deltaPct > 10 ? 'above' : deltaPct < -10 ? 'below' : 'near';
    return { metric: label, now: n, avg: a, deltaPct, direction };
  });
  const hot = rows.filter(r => r.direction === 'above');
  return {
    rows,
    text: hot.length
      ? `Running hot on ${hot.map(r => `${r.metric} (+${r.deltaPct}%)`).join(', ')} vs the historical average.`
      : 'Usage is within the historical band on every metric.',
  };
}

// 51803 — RFC4180-ish CSV of usage rows
// rows: [{ at, requests, tokens, costUsd }] → CSV string
export function resourceCsvExport(rows) {
  const head = ['at', 'requests', 'tokens', 'cost_usd'];
  const escape = v => {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(',')];
  for (const r of rows || []) {
    lines.push(
      [r.at, r.requests || 0, r.tokens || 0, (r.costUsd || 0).toFixed(2)].map(escape).join(',')
    );
  }
  return lines.join('\r\n') + '\r\n';
}

// 51804 — crossed resource thresholds produce webhook payloads
// rules: [{ id, name, metric, threshold, level }], readings: { metric: value }
// resourceAlertsApi: webhook target descriptor
export function resourceAlertRules(rules, readings, resourceAlertsApi) {
  const values = readings || {};
  const crossed = (rules || [])
    .filter(r => values[r.metric] != null && values[r.metric] >= r.threshold)
    .map(r => ({
      id: r.id,
      name: r.name,
      metric: r.metric,
      value: values[r.metric],
      threshold: r.threshold,
      level: r.level || 'warning',
    }));
  const payloads = crossed.map(c => ({
    event: 'resource.threshold.crossed',
    alert: c,
    target: resourceAlertsApi || { url: null },
    text: `🚨 ${c.name}: ${c.metric} at ${c.value} crossed threshold ${c.threshold} (${c.level}).`,
  }));
  return {
    crossed,
    payloads,
    count: crossed.length,
    text: crossed.length
      ? `${crossed.length} threshold${crossed.length === 1 ? '' : 's'} crossed — webhook payloads prepared.`
      : 'No thresholds crossed.',
  };
}

// 51805 — per-asset rows plus hunt-wide totals
// assets: [{ name, requests, tokens, costUsd, findings }]
export function perAssetView(assets) {
  const rows = [...(assets || [])]
    .map(a => ({
      name: a.name,
      requests: Math.max(0, a.requests || 0),
      tokens: Math.max(0, a.tokens || 0),
      costUsd: Math.max(0, a.costUsd || 0),
      findings: Math.max(0, a.findings || 0),
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
  const totals = {
    requests: rows.reduce((s, r) => s + r.requests, 0),
    tokens: rows.reduce((s, r) => s + r.tokens, 0),
    costUsd: Math.round(rows.reduce((s, r) => s + r.costUsd, 0) * 100) / 100,
    findings: rows.reduce((s, r) => s + r.findings, 0),
  };
  return {
    rows,
    totals,
    text: rows.length
      ? `${rows.length} assets tracked — top cost: ${rows[0].name} ($${rows[0].costUsd.toFixed(2)}). Totals: $${totals.costUsd.toFixed(2)}, ${totals.tokens.toLocaleString('en-US')} tokens, ${totals.findings} findings.`
      : 'No assets tracked.',
  };
}

// 51806 — spend per model with percent of total
// modelSpends: [{ model, costUsd }]
export function modelCostBreakdown(modelSpends) {
  const rows = [...(modelSpends || [])]
    .map(m => ({ model: m.model, costUsd: Math.max(0, m.costUsd || 0) }))
    .sort((a, b) => b.costUsd - a.costUsd);
  const total = Math.max(
    1,
    rows.reduce((s, r) => s + r.costUsd, 0)
  );
  const withPct = rows.map(r => ({ ...r, pct: Math.round((r.costUsd / total) * 100) }));
  return {
    rows: withPct,
    totalUsd: Math.round(total * 100) / 100,
    text: withPct.length
      ? `Model spend $${total.toFixed(2)} total — top: ${withPct[0].model} (${withPct[0].pct}%).`
      : 'No model spend recorded.',
  };
}

// 51807 — remaining session time and percent of quota left
// quota: { sessionLimitMs, elapsedMs }
export function quotaView(quota) {
  const q = quota || {};
  const limit = Math.max(1, q.sessionLimitMs || 1);
  const elapsed = Math.min(limit, Math.max(0, q.elapsedMs || 0));
  const remainingMs = limit - elapsed;
  const remainingPct = Math.round((remainingMs / limit) * 100);
  const usedPct = 100 - remainingPct;
  return {
    remainingMs,
    remainingPct,
    usedPct,
    state: remainingPct <= 10 ? 'critical' : remainingPct <= 30 ? 'low' : 'ok',
    text: `${remainingPct}% of session quota left (${formatShortMs(remainingMs)} of ${formatShortMs(limit)}).`,
  };
}

function formatShortMs(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// 51808 — anomaly flags on traffic spikes
// windows: [{ at, egressBytes }] — flags windows with >= 2.5x the median
export function egressMonitor(windows) {
  const ws = windows || [];
  const sizes = ws.map(w => Math.max(0, w.egressBytes || 0)).sort((a, b) => a - b);
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const threshold = Math.max(1, median * 2.5);
  const flagged = ws.filter(w => (w.egressBytes || 0) >= threshold);
  const peak = sizes.length ? sizes[sizes.length - 1] : 0;
  return {
    median,
    threshold,
    peak,
    flagged: flagged.map(w => ({
      at: w.at,
      egressBytes: w.egressBytes,
      multipleOfMedian: median ? Math.round(((w.egressBytes || 0) / median) * 10) / 10 : 0,
    })),
    text: flagged.length
      ? `⚠ ${flagged.length} egress spike${flagged.length === 1 ? '' : 's'} flagged (≥ 2.5× median of ${formatBytes(median)}).`
      : 'Egress is within normal bounds — no spikes.',
  };
}

function formatBytes(bytes) {
  const b = Math.max(0, bytes || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// 51809 — growth rate plus projected disk fill date
// entries: [{ atMs, usedBytes, capacityBytes }]
export function diskTracker(entries) {
  const es = [...(entries || [])].sort((a, b) => a.atMs - b.atMs);
  if (es.length < 2) {
    const latest = es[es.length - 1];
    return {
      growthPerDay: 0,
      projectedFullAtMs: null,
      text: latest ? 'Not enough readings to project disk growth.' : 'No disk readings.',
    };
  }
  const first = es[0];
  const last = es[es.length - 1];
  const spanMs = Math.max(1, last.atMs - first.atMs);
  const growth = Math.max(0, (last.usedBytes || 0) - (first.usedBytes || 0));
  const growthPerDay = (growth / spanMs) * 86400000;
  const capacity = last.capacityBytes || 0;
  const remaining = Math.max(0, capacity - (last.usedBytes || 0));
  const projectedFullAtMs =
    growthPerDay > 0 && capacity > 0
      ? Math.round(last.atMs + (remaining / growthPerDay) * 86400000)
      : null;
  return {
    growthPerDay: Math.round(growthPerDay),
    projectedFullAtMs,
    text: projectedFullAtMs
      ? `Disk growing ${formatBytes(growthPerDay)}/day — projected full around ${new Date(projectedFullAtMs).toISOString().slice(0, 10)}.`
      : 'Disk usage is flat — no growth to project.',
  };
}

// 51810 — rules that pause the hunt when their conditions fire
// state: { costUsd, requestsPerMin, errorRatePct, budgetUsd }
// rules: [{ id, name, when: { metric, op, value } }]
export function pauseTriggers(state, rules) {
  const s = state || {};
  const fired = (rules || []).filter(r => {
    const v = s[r.when && r.when.metric];
    if (v == null) return false;
    const target = r.when.value;
    switch (r.when.op) {
      case '>=':
        return v >= target;
      case '>':
        return v > target;
      case '<=':
        return v <= target;
      case '<':
        return v < target;
      case '==':
        return v === target;
      default:
        return false;
    }
  });
  return {
    triggered: fired.map(r => ({ id: r.id, name: r.name, when: r.when })),
    shouldPause: fired.length > 0,
    text: fired.length
      ? `⏸ ${fired.length} pause rule${fired.length === 1 ? '' : 's'} fired: ${fired.map(r => r.name).join(', ')} — hunt should pause.`
      : 'No pause triggers fired — hunt continues.',
  };
}

// 51811 — reduced token/request/compute targets for light hunts
// state: { tokenTarget, requestsPerMin, computeHours }
export function ecoMode(state) {
  const s = state || {};
  const scale = (v, f) => Math.max(1, Math.round((v || 0) * f));
  const eco = {
    tokenTarget: scale(s.tokenTarget, 0.5),
    requestsPerMin: scale(s.requestsPerMin, 0.5),
    computeHours: Math.round((s.computeHours || 0) * 0.5 * 100) / 100,
    savings: 'halves token, request-rate, and compute targets for a low-impact hunt',
  };
  return {
    normal: {
      tokenTarget: s.tokenTarget || 0,
      requestsPerMin: s.requestsPerMin || 0,
      computeHours: s.computeHours || 0,
    },
    eco,
    text: `Eco mode: tokens ${s.tokenTarget || 0}→${eco.tokenTarget}, rate ${s.requestsPerMin || 0}→${eco.requestsPerMin}/min, compute ${s.computeHours || 0}→${eco.computeHours}h.`,
  };
}

// 51812 — light, balanced, and unlimited usage profiles
export function resourcePreset(name) {
  const presets = {
    light: {
      requestsPerMin: 20,
      tokensPerMin: 15000,
      maxParallelism: 2,
      budgetUsd: 2,
      note: 'Careful, low-cost sweep.',
    },
    balanced: {
      requestsPerMin: 60,
      tokensPerMin: 60000,
      maxParallelism: 4,
      budgetUsd: 10,
      note: 'Default hunt profile.',
    },
    unlimited: {
      requestsPerMin: 200,
      tokensPerMin: 240000,
      maxParallelism: 10,
      budgetUsd: 100,
      note: 'Full-throttle deep dive.',
    },
  };
  const key = String(name || '').toLowerCase();
  const profile = presets[key] || presets.balanced;
  return {
    name: presets[key] ? key : 'balanced',
    profile,
    text: `${presets[key] ? key : 'balanced'} preset: ${profile.requestsPerMin} req/min, ${profile.tokensPerMin.toLocaleString('en-US')} tokens/min, ${profile.maxParallelism} workers, $${profile.budgetUsd} budget.`,
  };
}

// 51813 — organization-wide resource rollup across hunts
// hunts: [{ id, name, costUsd, requests, tokens, findings }]
export function teamDashboard(hunts) {
  const hs = hunts || [];
  const total = {
    costUsd: Math.round(hs.reduce((s, h) => s + Math.max(0, h.costUsd || 0), 0) * 100) / 100,
    requests: hs.reduce((s, h) => s + Math.max(0, h.requests || 0), 0),
    tokens: hs.reduce((s, h) => s + Math.max(0, h.tokens || 0), 0),
    findings: hs.reduce((s, h) => s + Math.max(0, h.findings || 0), 0),
  };
  const rows = [...hs]
    .sort((a, b) => (b.costUsd || 0) - (a.costUsd || 0))
    .map(h => ({
      id: h.id,
      name: h.name,
      costUsd: Math.max(0, h.costUsd || 0),
      findings: Math.max(0, h.findings || 0),
      costPerFinding: h.findings > 0 ? Math.round((h.costUsd / h.findings) * 100) / 100 : null,
    }));
  const costPerFinding =
    total.findings > 0 ? Math.round((total.costUsd / total.findings) * 100) / 100 : null;
  return {
    hunts: hs.length,
    rows,
    totals: total,
    costPerFinding,
    text: hs.length
      ? `${hs.length} hunts: $${total.costUsd.toFixed(2)} total, ${total.findings} findings${costPerFinding != null ? ` ($${costPerFinding.toFixed(2)}/finding)` : ''}.`
      : 'No hunts in the team dashboard.',
  };
}

// 51814 — spend mapped to cost centers per tag
// hunt: { id, costUsd }, tags: [{ name, costCenter, sharePct }]
export function chargebackTags(hunt, tags) {
  const cost = Math.max(0, (hunt && hunt.costUsd) || 0);
  const shares = tags || [];
  const totalShare = shares.reduce((s, t) => s + Math.max(0, t.sharePct || 0), 0);
  const rows = shares.map(t => {
    const share = Math.max(0, t.sharePct || 0);
    const amount = totalShare > 0 ? Math.round(cost * (share / totalShare) * 100) / 100 : 0;
    return { name: t.name, costCenter: t.costCenter, sharePct: share, amountUsd: amount };
  });
  return {
    huntId: (hunt && hunt.id) || null,
    totalUsd: cost,
    rows,
    balanced: totalShare === 100,
    text: rows.length
      ? `Chargeback for ${hunt && hunt.id}: $${cost.toFixed(2)} split across ${rows.map(r => `${r.costCenter} (${r.sharePct}%)`).join(', ')}${totalShare !== 100 ? ` — shares total ${totalShare}%, not 100%` : ''}.`
      : 'No chargeback tags assigned.',
  };
}

// 51815 — statistical anomaly flags on a usage series
// series: [{ at, value }], k = sigma multiplier
export function anomalyAlerts(series, k) {
  const vals = (series || []).map(s => ({ at: s.at, value: Math.max(0, s.value || 0) }));
  const mult = k || 2.5;
  if (vals.length < 4) {
    return {
      flagged: [],
      mean: 0,
      sigma: 0,
      text: 'Need at least four samples to detect anomalies.',
    };
  }
  const mean = vals.reduce((s, v) => s + v.value, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v.value - mean) * (v.value - mean), 0) / vals.length;
  const sigma = Math.sqrt(variance);
  const hi = mean + mult * sigma;
  const lo = Math.max(0, mean - mult * sigma);
  const flagged = vals
    .filter(v => v.value > hi || v.value < lo)
    .map(v => ({
      ...v,
      deviation: Math.round(((v.value - mean) / Math.max(1e-9, sigma)) * 10) / 10,
    }));
  return {
    flagged,
    mean: Math.round(mean * 100) / 100,
    sigma: Math.round(sigma * 100) / 100,
    text: flagged.length
      ? `⚠ ${flagged.length} anomal${flagged.length === 1 ? 'y' : 'ies'} flagged beyond ${mult}σ (mean ${mean.toFixed(1)}, σ ${sigma.toFixed(1)}).`
      : `No anomalies — ${vals.length} samples inside the ${mult}σ band.`,
  };
}

// 51816 — cost/throughput impact per concurrency level
// workers: { max }, impactModel: { baseCostPerWorker, throughputPerWorker, efficiencyDropPct }
export function parallelismTuner(workers, impactModel) {
  const m = impactModel || {};
  const max = Math.max(1, Math.min(16, (workers && workers.max) || 8));
  const base = Math.max(0, m.baseCostPerWorker || 0.1);
  const perWorker = Math.max(0, m.throughputPerWorker || 100);
  const dropPct = Math.min(95, Math.max(0, m.efficiencyDropPct || 8));
  const rows = [];
  for (let n = 1; n <= max; n += 1) {
    const efficiency = Math.pow(1 - dropPct / 100, n - 1);
    const throughput = Math.round(n * perWorker * efficiency);
    const cost = Math.round(n * base * 100) / 100;
    const costPerUnit = throughput ? Math.round((cost / throughput) * 100000) / 100000 : Infinity;
    rows.push({ workers: n, throughput, costUsd: cost, costPerUnit });
  }
  const best = rows.reduce((a, b) => (a.costPerUnit <= b.costPerUnit ? a : b));
  return {
    rows,
    bestWorkers: best.workers,
    text: `Sweet spot: ${best.workers} worker${best.workers === 1 ? '' : 's'} at $${best.costPerUnit}/unit of throughput.`,
  };
}

// 51817 — hit rate plus the reuse summary
// args: { hits, misses }
export function cacheHitRates({ hits, misses }) {
  const h = Math.max(0, hits || 0);
  const m = Math.max(0, misses || 0);
  const total = h + m;
  const hitRate = total ? Math.round((h / total) * 1000) / 10 : 0;
  const band =
    hitRate >= 90 ? 'excellent' : hitRate >= 75 ? 'good' : hitRate >= 50 ? 'fair' : 'poor';
  return {
    hits: h,
    misses: m,
    hitRatePct: hitRate,
    band,
    text: `Cache hit rate ${hitRate}% (${h.toLocaleString('en-US')} hits, ${m.toLocaleString('en-US')} misses) — ${band} reuse.`,
  };
}

// 51818 — budget-aware strategy advice
// usage: { spentUsd, findings }, budget: budget in USD
export function strategyHints(usage, budget) {
  const u = usage || {};
  const spent = Math.max(0, u.spentUsd || 0);
  const cap = Math.max(0.01, budget || u.budgetUsd || 1);
  const pct = Math.round((spent / cap) * 100);
  const hints = [];
  if (pct < 50) hints.push('under budget — go deeper: expand the asset list or add checks');
  else if (pct < 80) hints.push('on pace — keep the current plan, watch the forecast');
  else if (pct <= 100) hints.push('near the cap — finish open checks, then wrap up');
  else hints.push('over budget — pause, verify findings, then request a top-up');
  if (pct < 50 && (u.findings || 0) >= 5)
    hints.push('results are cheap — double parallelism while the price is right');
  return {
    spentPct: pct,
    hints,
    text: `${pct}% of budget spent — ${hints[0]}.`,
  };
}

// 51819 — wall-clock versus active compute time
// sessions: [{ id, wallMs, idleMs }]
export function sessionTime(sessions) {
  const ss = sessions || [];
  const wallMs = ss.reduce((s, x) => s + Math.max(0, x.wallMs || 0), 0);
  const idleMs = ss.reduce((s, x) => s + Math.max(0, x.idleMs || 0), 0);
  const activeMs = Math.max(0, wallMs - idleMs);
  const activePct = wallMs ? Math.round((activeMs / wallMs) * 100) : 0;
  const rows = ss.map(x => {
    const w = Math.max(0, x.wallMs || 0);
    const i = Math.max(0, x.idleMs || 0);
    return {
      id: x.id,
      wallMs: w,
      activeMs: Math.max(0, w - i),
      activePct: w ? Math.round(((w - i) / w) * 100) : 0,
    };
  });
  return {
    rows,
    wallMs,
    activeMs,
    idleMs,
    activePct,
    text: `${formatShortMs(activeMs)} active compute of ${formatShortMs(wallMs)} wall-clock (${activePct}%); ${formatShortMs(idleMs)} idle.`,
  };
}

// 51820 — remaining quota with throttling flags
// limits: { requests, tokens }, usage: { requests, tokens }
export function apiQuotaMonitor(limits, usage) {
  const l = limits || {};
  const u = usage || {};
  const rows = [
    { kind: 'requests', limit: Math.max(1, l.requests || 1), used: Math.max(0, u.requests || 0) },
    { kind: 'tokens', limit: Math.max(1, l.tokens || 1), used: Math.max(0, u.tokens || 0) },
  ].map(r => {
    const remaining = Math.max(0, r.limit - r.used);
    const usedPct = Math.round((r.used / r.limit) * 100);
    const throttled = usedPct >= 90;
    return { ...r, remaining, usedPct, throttled };
  });
  const throttled = rows.filter(r => r.throttled);
  return {
    rows,
    throttledCount: throttled.length,
    text: throttled.length
      ? `⚠ ${throttled.map(r => r.kind).join(' & ')} at ${throttled.map(r => `${r.usedPct}%`).join('/')} — throttling advised.`
      : 'All API quotas healthy with headroom.',
  };
}
