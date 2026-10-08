// resourceCore.js — Infinity AI · wave 45 (ideas 51786–51800)
// Pure logic for the resource monitoring suite: request counters, rate series,
// bandwidth, CPU/GPU/memory panels, token tracking, cost estimation, budget
// alerts, per-module splits, caps, throttles, efficiency, and waste detection.
// No DOM, no network, no side effects: pure transforms over plain descriptors.

export const RES45_START = 51786;
export const RES45_END = 51800;

export const RES45_IDEAS = [
  [51786, 'Live request counter', 'Total HTTP requests sent, ticking in real time.'],
  [51787, 'Request-rate graph', 'Requests per second plotted live with your cap overlaid.'],
  [51788, 'Bandwidth meter', 'Data sent and received, with per-phase breakdowns.'],
  [51789, 'CPU usage panel', 'Local agent CPU consumption shown live.'],
  [51790, 'Memory usage panel', 'RAM footprint with warnings before limits hit.'],
  [51791, 'GPU usage display', 'Accelerator utilization when local models run.'],
  [51792, 'Token usage tracker', 'LLM tokens consumed per phase and per hunt.'],
  [51793, 'Cost estimator', 'Live projected spend based on tokens, compute, and APIs.'],
  [51794, 'Budget alerts (mid-hunt)', 'Warned at 50%, 80%, and 100% of your resource budget.'],
  [51795, 'Per-module resource split', 'Which modules consume the most, ranked live.'],
  [51796, 'Resource history', 'Usage curves across the whole hunt for review.'],
  [51797, 'Resource caps', 'Set hard limits; the agent throttles or pauses at the cap.'],
  [51798, 'Throttle controls', 'Dial request rate, parallelism, or model usage live.'],
  [51799, 'Resource efficiency score', 'Findings per thousand requests, tracked live.'],
  [51800, 'Waste detector', 'Flags modules burning resources with no results.'],
];

// Format bytes compactly: "850 MB", "2.4 GB"
export function formatBytes(bytes) {
  const b = Math.max(0, bytes || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb >= 100 ? Math.round(gb) : gb.toFixed(1)} GB`;
}

// 51786 — total HTTP requests sent, ticking in real time
// state: { total }, delta: new requests since the last tick
export function requestCounter(state, delta) {
  const total = Math.max(0, (state && state.total) || 0) + Math.max(0, delta || 0);
  return {
    total,
    lastDelta: Math.max(0, delta || 0),
    text: `${total.toLocaleString('en-US')} requests sent so far.`,
  };
}

// 51787 — requests per second plotted live with the cap overlaid
// buckets: [{ sec, count }], capPerSec
export function requestRateSeries(buckets, capPerSec) {
  const bs = buckets || [];
  const counts = bs.map((b) => Math.max(0, b.count || 0));
  const peak = counts.length ? Math.max(...counts) : 0;
  const avg = counts.length ? counts.reduce((s, c) => s + c, 0) / counts.length : 0;
  const cap = Math.max(0, capPerSec || 0);
  return {
    points: bs.map((b) => ({ sec: b.sec, count: Math.max(0, b.count || 0), overCap: cap > 0 && b.count > cap })),
    peak,
    avg: Math.round(avg * 10) / 10,
    capPerSec: cap,
    overCapCount: bs.filter((b) => cap > 0 && b.count > cap).length,
    text: `Rate averaging ${Math.round(avg * 10) / 10}/s, peaking at ${peak}/s${cap > 0 ? ` against a ${cap}/s cap (${bs.filter((b) => b.count > cap).length} seconds over)` : '.'}`,
  };
}

// 51788 — data sent and received, with per-phase breakdowns
// samples: [{ phase, sentBytes, recvBytes }]
export function bandwidthMeter(samples) {
  const rows = (samples || []).map((s) => ({
    phase: s.phase,
    sentBytes: Math.max(0, s.sentBytes || 0),
    recvBytes: Math.max(0, s.recvBytes || 0),
  }));
  const sentTotal = rows.reduce((s, r) => s + r.sentBytes, 0);
  const recvTotal = rows.reduce((s, r) => s + r.recvBytes, 0);
  const grand = Math.max(1, sentTotal + recvTotal);
  const ranked = [...rows].sort((a, b) => (b.sentBytes + b.recvBytes) - (a.sentBytes + a.recvBytes));
  return {
    rows: ranked.map((r) => ({ ...r, sharePct: Math.round(((r.sentBytes + r.recvBytes) / grand) * 100) })),
    sentBytes: sentTotal,
    recvBytes: recvTotal,
    totalBytes: sentTotal + recvTotal,
    text: `Sent ${formatBytes(sentTotal)}, received ${formatBytes(recvTotal)} — heaviest phase: ${ranked.length ? ranked[0].phase : 'none'}.`,
  };
}

// 51789 — local agent CPU consumption shown live
// samples: [{ at, pct }] — returns avg/peak/current plus a status
export function cpuPanel(samples) {
  const pcts = (samples || []).map((s) => Math.max(0, Math.min(100, s.pct || 0)));
  const current = pcts.length ? pcts[pcts.length - 1] : 0;
  const peak = pcts.length ? Math.max(...pcts) : 0;
  const avg = pcts.length ? Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10 : 0;
  const status = current >= 90 ? 'critical' : current >= 70 ? 'high' : current >= 40 ? 'moderate' : 'idle-ish';
  return {
    current,
    peak,
    avg,
    status,
    text: `CPU ${current}% now (avg ${avg}%, peak ${peak}%) — ${status === 'critical' ? 'sustained load, consider throttling' : status === 'high' ? 'heavy, watch the temperature' : status === 'moderate' ? 'healthy working load' : 'mostly idle'}.`,
  };
}

// 51790 — RAM footprint with warnings before limits hit
// args: { usedBytes, limitBytes }
export function memoryPanel({ usedBytes, limitBytes }) {
  const used = Math.max(0, usedBytes || 0);
  const limit = Math.max(1, limitBytes || 1);
  const usedPct = Math.min(100, Math.round((used / limit) * 100));
  const status = usedPct >= 95 ? 'critical' : usedPct >= 80 ? 'warning' : 'healthy';
  return {
    usedBytes: used,
    limitBytes: limit,
    usedPct,
    remainingBytes: Math.max(0, limit - used),
    status,
    text: `Memory ${formatBytes(used)} of ${formatBytes(limit)} (${usedPct}%) — ${status === 'healthy' ? 'plenty of headroom' : status === 'warning' ? 'approaching the limit' : 'critical, free memory now'}.`,
  };
}

// 51791 — accelerator utilization when local models run
// args: { utilPct, vramUsedBytes, vramTotalBytes, modelName }
export function gpuDisplay({ utilPct, vramUsedBytes, vramTotalBytes, modelName }) {
  const util = Math.max(0, Math.min(100, utilPct || 0));
  const vramPct = vramTotalBytes ? Math.min(100, Math.round(((vramUsedBytes || 0) / vramTotalBytes) * 100)) : 0;
  return {
    utilPct: util,
    vramUsedBytes: Math.max(0, vramUsedBytes || 0),
    vramTotalBytes: Math.max(0, vramTotalBytes || 0),
    vramPct,
    modelName: modelName || 'no model loaded',
    status: util >= 90 ? 'saturated' : util >= 50 ? 'working' : util > 0 ? 'light' : 'idle',
    text: util > 0
      ? `GPU ${util}% (${modelName || 'model'}), VRAM ${formatBytes(vramUsedBytes || 0)} of ${formatBytes(vramTotalBytes || 0)} (${vramPct}%).`
      : 'GPU idle — no local model running.',
  };
}

// 51792 — LLM tokens consumed per phase and per hunt
// phases: [{ name, tokens }]
export function tokenTracker(phases) {
  const rows = [...(phases || [])]
    .map((p) => ({ name: p.name, tokens: Math.max(0, p.tokens || 0) }))
    .sort((a, b) => b.tokens - a.tokens);
  const total = rows.reduce((s, r) => s + r.tokens, 0);
  const grand = Math.max(1, total);
  return {
    rows: rows.map((r) => ({ ...r, sharePct: Math.round((r.tokens / grand) * 100) })),
    totalTokens: total,
    text: `${total.toLocaleString('en-US')} tokens total — top consumer: ${rows.length ? rows[0].name : 'none'} (${rows.length ? rows[0].sharePct : 0}%).`,
  };
}

// 51793 — live projected spend based on tokens, compute, and APIs
// args: { tokens, modelRatePerK, computeHours, computeRatePerH, apiCalls, apiRatePerCall }
export function costEstimator({ tokens, modelRatePerK, computeHours, computeRatePerH, apiCalls, apiRatePerCall }) {
  const tok = Math.max(0, tokens || 0);
  const modelCost = (tok / 1000) * Math.max(0, modelRatePerK || 0);
  const computeCost = Math.max(0, computeHours || 0) * Math.max(0, computeRatePerH || 0);
  const apiCost = Math.max(0, apiCalls || 0) * Math.max(0, apiRatePerCall || 0);
  const total = modelCost + computeCost + apiCost;
  const rows = [
    { kind: 'LLM tokens', cost: modelCost },
    { kind: 'Compute', cost: computeCost },
    { kind: 'API calls', cost: apiCost },
  ].sort((a, b) => b.cost - a.cost);
  return {
    rows,
    modelCost,
    computeCost,
    apiCost,
    totalCost: Math.round(total * 10000) / 10000,
    text: `Projected spend $${(Math.round(total * 10000) / 10000).toFixed(4)} — tokens $${modelCost.toFixed(4)}, compute $${computeCost.toFixed(4)}, APIs $${apiCost.toFixed(4)}.`,
  };
}

// 51794 — warned at 50%, 80%, and 100% of your resource budget
// args: { spent, budget, thresholds }
export function budgetAlerts({ spent, budget, thresholds }) {
  const b = Math.max(1, budget || 1);
  const s = Math.max(0, spent || 0);
  const usedPct = Math.round((s / b) * 100);
  const th = (thresholds || [50, 80, 100]).slice().sort((a, b2) => a - b2);
  const fired = th.filter((t) => usedPct >= t);
  return {
    usedPct,
    budget: b,
    spent: s,
    remaining: Math.max(0, b - s),
    alerts: fired.map((t) => ({
      threshold: t,
      level: t >= 100 ? 'critical' : t >= 80 ? 'warning' : 'info',
      text: t >= 100
        ? `⛔ Budget ${t}% reached — the hunt is at its resource limit.`
        : t >= 80
          ? `⚠ Budget ${t}% used — only ${Math.max(0, 100 - t)}% headroom left.`
          : `ℹ Budget ${t}% used — halfway through the allowance.`,
    })),
    text: fired.length
      ? `Budget ${usedPct}% used — ${fired.length} alert${fired.length === 1 ? '' : 's'} fired (${fired.join(', ')}%).`
      : `Budget ${usedPct}% used — no alerts yet.`,
  };
}

// 51795 — which modules consume the most, ranked live
// modules: [{ name, requests, tokens, cost }]
export function moduleResourceSplit(modules) {
  const rows = [...(modules || [])]
    .map((m) => ({
      name: m.name,
      requests: Math.max(0, m.requests || 0),
      tokens: Math.max(0, m.tokens || 0),
      cost: Math.max(0, m.cost || 0),
    }))
    .sort((a, b) => b.cost - a.cost);
  const total = rows.reduce((s, r) => s + r.cost, 0);
  const grand = Math.max(0.0001, total);
  return {
    rows: rows.map((r) => ({ ...r, sharePct: Math.round((r.cost / grand) * 100) })),
    totalCost: total,
    text: rows.length
      ? `Most expensive module: ${rows[0].name} (${rows[0].sharePct}% of spend).`
      : 'No module usage recorded yet.',
  };
}

// 51796 — usage curves across the whole hunt for review
// series: [{ at, requests, tokens, costPct }]
export function resourceHistory(series) {
  const rows = [...(series || [])];
  const maxReq = Math.max(1, ...rows.map((r) => r.requests || 0));
  const maxTok = Math.max(1, ...rows.map((r) => r.tokens || 0));
  return {
    points: rows.map((r) => ({
      at: r.at,
      requests: r.requests || 0,
      tokens: r.tokens || 0,
      costPct: r.costPct || 0,
      requestsNorm: Math.round(((r.requests || 0) / maxReq) * 100),
      tokensNorm: Math.round(((r.tokens || 0) / maxTok) * 100),
    })),
    samples: rows.length,
    text: `${rows.length} samples — peak ${maxReq.toLocaleString('en-US')} requests and ${(maxTok).toLocaleString('en-US')} tokens in a single sample.`,
  };
}

// 51797 — set hard limits; the agent throttles or pauses at the cap
// args: { usage: { requests, tokens, cost }, caps: { requests, tokens, cost } }
export function resourceCaps({ usage, caps }) {
  const kinds = ['requests', 'tokens', 'cost'];
  const rows = kinds
    .filter((k) => caps && caps[k] != null && caps[k] > 0)
    .map((k) => {
      const used = Math.max(0, (usage || {})[k] || 0);
      const limit = Math.max(1, caps[k]);
      const usedPct = Math.round((used / limit) * 100);
      const action = usedPct >= 100 ? 'pause' : usedPct >= 90 ? 'throttle' : usedPct >= 75 ? 'warn' : 'ok';
      return { kind: k, used, limit, usedPct, action };
    });
  const worst = rows.find((r) => r.action === 'pause') || rows.find((r) => r.action === 'throttle') || rows.find((r) => r.action === 'warn');
  return {
    rows,
    decision: worst ? worst.action : 'ok',
    text: rows.length
      ? `Caps: ${rows.map((r) => `${r.kind} ${r.usedPct}%`).join(', ')} — decision: ${worst ? worst.action.toUpperCase() : 'OK, all within limits'}.`
      : 'No caps configured.',
  };
}

// 51798 — dial request rate, parallelism, or model usage live
// args: { ratePerSec, maxRatePerSec, parallelism, maxParallelism, modelTier: 'full'|'lite' }
export function throttleControls({ ratePerSec, maxRatePerSec, parallelism, maxParallelism, modelTier }) {
  const rate = Math.max(0, Math.min(ratePerSec || 0, maxRatePerSec || ratePerSec || 0));
  const par = Math.max(1, Math.min(parallelism || 1, maxParallelism || parallelism || 1));
  const tier = modelTier === 'lite' ? 'lite' : 'full';
  const tierFactor = tier === 'lite' ? 0.4 : 1;
  const effectiveRate = Math.round(rate * par * tierFactor * 10) / 10;
  return {
    ratePerSec: rate,
    parallelism: par,
    modelTier: tier,
    effectiveRate,
    text: `Throttle set: ${rate}/s × ${par} parallel slots on ${tier} model → effective ${effectiveRate}/s.`,
  };
}

// 51799 — findings per thousand requests, tracked live
// args: { findings, requests }
export function efficiencyScore({ findings, requests }) {
  const f = Math.max(0, findings || 0);
  const r = Math.max(1, requests || 1);
  const score = Math.round((f / r) * 1000 * 100) / 100;
  const band = score >= 5 ? 'excellent' : score >= 1 ? 'good' : score >= 0.2 ? 'low' : 'poor';
  return {
    findings: f,
    requests,
    per1000: score,
    band,
    text: `${f} findings from ${(requests || 0).toLocaleString('en-US')} requests = ${score} per 1000 (${band}).`,
  };
}

// 51800 — flags modules burning resources with no results
// modules: [{ name, requests, tokens, findings }]
export function wasteDetector(modules) {
  const flagged = (modules || [])
    .map((m) => ({
      name: m.name,
      requests: Math.max(0, m.requests || 0),
      tokens: Math.max(0, m.tokens || 0),
      findings: Math.max(0, m.findings || 0),
    }))
    .filter((m) => m.findings === 0 && (m.requests > 2000 || m.tokens > 50000))
    .map((m) => ({
      ...m,
      severity: m.requests > 20000 || m.tokens > 500000 ? 'high' : 'medium',
      text: `${m.name}: ${m.requests.toLocaleString('en-US')} requests, ${m.tokens.toLocaleString('en-US')} tokens, zero findings — ${m.requests > 20000 || m.tokens > 500000 ? 'high' : 'medium'} waste.`,
    }));
  return {
    flagged,
    count: flagged.length,
    text: flagged.length
      ? `${flagged.length} wasteful module${flagged.length === 1 ? '' : 's'} flagged: ${flagged.map((m) => m.name).join(', ')}.`
      : 'No waste detected — every active module has produced results.',
  };
}
