/**
 * compareOpsCore.js — Infinity AI · Dark-Matter · Wave 63 (ideas 52501–52520)
 * Pure JS (no React / DOM / network). Deterministic comparison operations and
 * analytics: time-to-detect, engine performance, model A/B, config diff,
 * payload-count, duration, cost comparisons, maturity-score trends, comparison
 * dashboards, scheduled reports, annotations, "what changed" summaries, change
 * attribution, diff API payloads, webhooks, templates, saved comparisons,
 * new-critical alerts, trend forecasting, and seasonality analysis.
 * Time is injected via `now` params (default Date.now()) so every function
 * is reproducible.
 */

export const WAVE63_CO_IDEAS = [
  { id: 52501, title: 'Time-to-detect comparison', desc: 'Compare how quickly each hunt surfaced its critical findings.', skip: false },
  { id: 52502, title: 'Engine performance comparison', desc: 'Which engines found what in each hunt, for pipeline tuning.', skip: false },
  { id: 52503, title: 'Model A vs model B comparison', desc: 'Compare hunts run with different brains to evaluate model upgrades.', skip: false },
  { id: 52504, title: 'Hunt config comparison', desc: 'Diff the configurations (depth, payloads, scope) of two hunts.', skip: false },
  { id: 52505, title: 'Payload-count comparison', desc: 'Requests sent, payloads tried, and efficiency (findings per 1k requests) per hunt.', skip: false },
  { id: 52506, title: 'Duration comparison', desc: 'Hunt runtimes side by side with phase breakdowns.', skip: false },
  { id: 52507, title: 'Cost comparison', desc: 'Compute/time cost per hunt and cost per confirmed finding.', skip: false },
  { id: 52508, title: 'Target maturity score trend', desc: 'Composite maturity score (coverage, fix rate, FP rate) tracked over hunts.', skip: false },
  { id: 52509, title: 'Comparison dashboard', desc: 'Saved comparison views with all charts in one place.', skip: false },
  { id: 52510, title: 'Scheduled comparison reports (post-hunt)', desc: 'Auto-email monthly before/after comparisons to stakeholders.', skip: false },
  { id: 52511, title: 'Comparison annotations (post-hunt)', desc: 'Add notes to a comparison ("v2.4 deploy introduced 3 XSS") for future context.', skip: false },
  { id: 52512, title: 'AI "what changed" summary', desc: 'Natural-language summary of the meaningful differences between two hunts.', skip: false },
  { id: 52513, title: 'Change attribution (post-hunt)', desc: 'Link new findings to likely causes (deploy, config change, new feature) via timeline correlation.', skip: false },
  { id: 52514, title: 'Diff API', desc: 'Programmatic access to hunt comparisons for custom dashboards and gates.', skip: false },
  { id: 52515, title: 'Diff webhooks', desc: 'Fire webhooks with comparison results for CI gates ("fail build if new Criticals").', skip: false },
  { id: 52516, title: 'Comparison templates (post-hunt)', desc: 'Saved comparison setups (hunt pairs, filters, charts) for recurring reviews.', skip: false },
  { id: 52517, title: 'Saved comparisons', desc: 'Bookmark comparisons to revisit later without reconfiguring.', skip: false },
  { id: 52518, title: 'New-critical comparison alerts', desc: 'Alert immediately when a comparison reveals a new Critical not in the baseline.', skip: false },
  { id: 52519, title: 'Trend forecasting (post-hunt)', desc: 'Project future finding counts and risk scores from historical hunt trajectories.', skip: false },
  { id: 52520, title: 'Seasonality analysis (post-hunt)', desc: 'Detect patterns like post-release finding spikes across hunt history.', skip: false },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `co63_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function findingsOf(hunt) {
  return (hunt && Array.isArray(hunt.findings)) ? hunt.findings : [];
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

/* 52501 — Time-to-detect comparison: how quickly each hunt surfaced criticals. */
export function timeToDetectCompare(hunts) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  const rows = hunts.map((h) => {
    const crits = findingsOf(h).filter((f) => f.severity === 'critical' && f.detectedAt && h.at);
    const times = crits.map((f) => (f.detectedAt - h.at) / 60000);
    const fastest = times.length ? round1(Math.min(...times)) : null;
    const median = times.length ? round1(times.slice().sort((a, b) => a - b)[Math.floor(times.length / 2)]) : null;
    return { huntId: h.id, criticals: crits.length, fastestMin: fastest, medianMin: median };
  });
  return { ok: true, rows };
}

/* 52502 — Engine performance comparison: which engines found what per hunt. */
export function engineCompare(hunts) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  const engines = {};
  for (const h of hunts) {
    const perEngine = (h.engines && h.engines.length)
      ? h.engines
      : [{ name: 'default', findings: findingsOf(h).length }];
    for (const e of perEngine) {
      engines[e.name] = engines[e.name] || { engine: e.name, findings: 0, hunts: 0 };
      engines[e.name].findings += e.findings || 0;
      engines[e.name].hunts += 1;
    }
  }
  const rows = Object.values(engines)
    .map((e) => ({ ...e, avgPerHunt: round1(e.findings / e.hunts) }))
    .sort((a, b) => b.findings - a.findings);
  return { ok: true, rows };
}

/* 52503 — Model A vs model B comparison: group hunts by brain model. */
export function modelCompare(hunts) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  const by = {};
  for (const h of hunts) {
    const m = h.model || 'unknown';
    by[m] = by[m] || { model: m, hunts: 0, findings: 0, criticals: 0 };
    by[m].hunts += 1;
    by[m].findings += findingsOf(h).length;
    by[m].criticals += findingsOf(h).filter((f) => f.severity === 'critical').length;
  }
  const rows = Object.values(by).map((r) => ({ ...r, avgFindings: round1(r.findings / r.hunts) }));
  return { ok: true, rows };
}

/* 52504 — Hunt config comparison: diff depth/payloads/scope configurations. */
export function configDiff(configA, configB) {
  if (!configA || !configB) return { ok: false, reason: 'two configs are required' };
  const keys = [...new Set([...Object.keys(configA), ...Object.keys(configB)])];
  const changed = keys
    .filter((k) => JSON.stringify(configA[k]) !== JSON.stringify(configB[k]))
    .map((k) => ({ key: k, from: configA[k] ?? null, to: configB[k] ?? null }));
  return { ok: true, changed, identical: changed.length === 0 };
}

/* 52505 — Payload-count comparison: requests, payloads, findings per 1k requests. */
export function payloadCompare(hunts) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  const rows = hunts.map((h) => {
    const requests = (h.stats && h.stats.requests) || 0;
    const payloads = (h.stats && h.stats.payloads) || 0;
    const findings = findingsOf(h).length;
    return {
      huntId: h.id,
      requests,
      payloads,
      findings,
      findingsPer1k: requests === 0 ? null : round1((findings / requests) * 1000),
    };
  });
  return { ok: true, rows };
}

/* 52506 — Duration comparison: runtimes side by side with phase breakdowns. */
export function durationCompare(hunts) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  const rows = hunts.map((h) => {
    const phases = (h.stats && h.stats.phases) || {};
    const totalMs = Object.values(phases).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
      || (h.finishedAt && h.at ? h.finishedAt - h.at : null);
    return { huntId: h.id, phases, totalMin: totalMs == null ? null : round1(totalMs / 60000) };
  });
  return { ok: true, rows };
}

/* 52507 — Cost comparison: compute/time cost per hunt and per confirmed finding. */
export function costCompare(hunts, costPerHour) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  if (typeof costPerHour !== 'number' || costPerHour < 0) return { ok: false, reason: 'a valid cost-per-hour is required' };
  const rows = hunts.map((h) => {
    const hours = h.stats && typeof h.stats.hours === 'number' ? h.stats.hours
      : h.finishedAt && h.at ? (h.finishedAt - h.at) / 3600000 : 0;
    const confirmed = findingsOf(h).filter((f) => !f.fp).length;
    const cost = round1(hours * costPerHour);
    return { huntId: h.id, hours: round1(hours), cost, costPerConfirmed: confirmed === 0 ? null : round1(cost / confirmed) };
  });
  return { ok: true, rows, currency: 'USD' };
}

/* 52508 — Target maturity score trend: composite (coverage, fix rate, FP rate). */
export function maturityTrend(hunts) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  const points = hunts
    .filter((h) => h.stats)
    .sort((x, y) => x.at - y.at)
    .map((h) => {
      const s = h.stats || {};
      const coverage = Math.min(100, (s.endpointsCovered || 0) / Math.max(1, s.endpointsTotal || 0) * 100);
      const fixed = findingsOf(h).filter((f) => f.state === 'fixed').length;
      const fixRate = findingsOf(h).length === 0 ? 100 : (fixed / findingsOf(h).length) * 100;
      const fpRate = findingsOf(h).length === 0 ? 0 : (findingsOf(h).filter((f) => f.fp).length / findingsOf(h).length) * 100;
      const score = round1(coverage * 0.4 + fixRate * 0.4 + (100 - fpRate) * 0.2);
      return { huntId: h.id, at: h.at, score, coverage: round1(coverage), fixRate: round1(fixRate), fpRate: round1(fpRate) };
    });
  return { ok: true, points, latest: points.length ? points[points.length - 1].score : null };
}

/* 52509 — Comparison dashboard: saved comparison view model with all charts. */
export function buildComparisonDashboard(huntA, huntB, opts) {
  if (!huntA || !huntB) return { ok: false, reason: 'two hunts are required' };
  const o = opts || {};
  return {
    ok: true,
    dashboard: {
      huntAId: huntA.id,
      huntBId: huntB.id,
      charts: o.charts && o.charts.length ? o.charts : ['summary', 'bar', 'donut', 'trend'],
      filters: o.filters || {},
      refreshed: false,
    },
  };
}

/* 52510 — Scheduled comparison reports: auto-email monthly comparisons. */
export function scheduleComparisonReport(targetId, schedule, now = Date.now()) {
  if (!targetId) return { ok: false, reason: 'a target id is required' };
  const allowed = ['daily', 'weekly', 'monthly'];
  const cadence = schedule && schedule.cadence;
  if (!allowed.includes(cadence)) return { ok: false, reason: `cadence must be one of ${allowed.join(', ')}` };
  const recipients = (schedule && schedule.recipients) || [];
  if (recipients.length === 0) return { ok: false, reason: 'at least one recipient is required' };
  return {
    ok: true,
    schedule: { id: tokenFor('cmprpt', targetId, now), targetId, cadence, recipients, nextRunAt: now + 30 * 86400000, createdAt: now },
  };
}

/* 52511 — Comparison annotations: attach notes to a comparison for context. */
export function addAnnotation(comparisonId, note, author, now = Date.now()) {
  if (!comparisonId || typeof note !== 'string' || !note.trim()) {
    return { ok: false, reason: 'comparison id and non-empty note are required' };
  }
  return {
    ok: true,
    annotation: { id: tokenFor('annot', comparisonId, now), comparisonId, note: note.trim(), author: author || 'anonymous', at: now },
  };
}

/* 52512 — AI "what changed" summary: deterministic natural-language summary of
 * the meaningful differences between two hunts. */
export function whatChangedSummary(summary) {
  if (!summary || typeof summary.added !== 'number') return { ok: false, reason: 'a diff summary is required' };
  const parts = [];
  if (summary.added > 0) parts.push(`${summary.added} new finding${summary.added === 1 ? '' : 's'} appeared`);
  if (summary.removed > 0) parts.push(`${summary.removed} were fixed and dropped`);
  if (summary.persistent > 0) parts.push(`${summary.persistent} carried over`);
  if (summary.severityChanges > 0) parts.push(`${summary.severityChanges} changed severity`);
  const text = parts.length
    ? `Between the two hunts: ${parts.join(', ')}.`
    : 'No meaningful differences between the two hunts.';
  return { ok: true, text };
}

/* 52513 — Change attribution: link new findings to likely causes via timeline. */
export function attributeChanges(newFindings, timeline) {
  if (!Array.isArray(newFindings) || !Array.isArray(timeline)) {
    return { ok: false, reason: 'new findings and a timeline are required' };
  }
  const attributions = newFindings.map((f) => {
    const candidates = timeline
      .filter((t) => t.at <= (f.detectedAt || Infinity))
      .sort((a, b) => b.at - a.at);
    const best = candidates[0];
    return {
      findingId: f.id,
      cause: best ? best.type : 'unknown',
      causeAt: best ? best.at : null,
      confidence: best ? (f.detectedAt - best.at < 7 * 86400000 ? 'high' : 'low') : 'none',
    };
  });
  return { ok: true, attributions };
}

/* 52514 — Diff API: paginated programmatic payload for custom dashboards/gates. */
export function diffApiResponse(diff, params) {
  if (!diff || !Array.isArray(diff.rows)) return { ok: false, reason: 'a diff object with rows is required' };
  const p = params || {};
  const page = Math.max(1, p.page || 1);
  const perPage = Math.min(100, Math.max(1, p.perPage || 20));
  const start = (page - 1) * perPage;
  const rows = diff.rows.slice(start, start + perPage);
  return {
    ok: true,
    page,
    perPage,
    total: diff.rows.length,
    pages: Math.ceil(diff.rows.length / perPage),
    rows,
  };
}

/* 52515 — Diff webhooks: build the CI-gate payload (firing is the caller's job). */
export function fireDiffWebhook(comparison, url) {
  if (!comparison || !comparison.huntAId || !comparison.huntBId) {
    return { ok: false, reason: 'a comparison with both hunt ids is required' };
  }
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return { ok: false, reason: 'a valid http(s) webhook url is required' };
  const newCriticals = comparison.newCriticals || 0;
  return {
    ok: true,
    payload: {
      event: 'hunt.comparison.completed',
      huntA: comparison.huntAId,
      huntB: comparison.huntBId,
      newCriticals,
      gate: newCriticals > 0 ? 'fail' : 'pass',
      deliveredTo: url,
    },
  };
}

/* 52516 — Comparison templates: saved setups for recurring reviews. */
export function saveComparisonTemplate(name, config, now = Date.now()) {
  if (typeof name !== 'string' || !name.trim()) return { ok: false, reason: 'a template name is required' };
  return {
    ok: true,
    template: { id: tokenFor('tmpl', name, now), name: name.trim(), config: config || {}, createdAt: now, usageCount: 0 },
  };
}

/* 52517 — Saved comparisons: bookmark a comparison to revisit later. */
export function saveComparison(name, huntAId, huntBId, config, now = Date.now()) {
  if (typeof name !== 'string' || !name.trim()) return { ok: false, reason: 'a name is required' };
  if (!huntAId || !huntBId) return { ok: false, reason: 'both hunt ids are required' };
  return {
    ok: true,
    saved: { id: tokenFor('saved', name, now), name: name.trim(), huntAId, huntBId, config: config || {}, savedAt: now },
  };
}

/* 52518 — New-critical comparison alerts: alert when a comparison reveals new
 * Criticals not in the baseline. */
export function newCriticalAlerts(huntA, huntB) {
  const aIds = new Set(findingsOf(huntA).filter((f) => f.severity === 'critical').map((f) => f.id));
  const newOnes = findingsOf(huntB).filter((f) => f.severity === 'critical' && !aIds.has(f.id));
  return {
    ok: true,
    count: newOnes.length,
    alerts: newOnes.map((f) => ({ findingId: f.id, title: f.title, severity: 'critical', message: `New Critical "${f.title}" not present in baseline hunt` })),
  };
}

/* 52519 — Trend forecasting: project future finding counts and risk scores
 * using a linear fit over the historical trajectory. */
export function forecastTrend(hunts, periods) {
  if (!Array.isArray(hunts) || hunts.length < 2) return { ok: false, reason: 'at least two hunts are required' };
  const n = periods && periods > 0 ? periods : 3;
  const sorted = hunts.slice().sort((a, b) => a.at - b.at);
  const counts = sorted.map((h) => findingsOf(h).length);
  const scores = sorted.map((h) => (typeof h.riskScore === 'number' ? h.riskScore : null));
  const fit = (vals) => {
    const ys = vals.filter((v) => v != null);
    if (ys.length < 2) return { slope: 0, last: ys[ys.length - 1] || 0 };
    const xMean = (ys.length - 1) / 2;
    const yMean = ys.reduce((s, v) => s + v, 0) / ys.length;
    let num = 0;
    let den = 0;
    ys.forEach((y, i) => { num += (i - xMean) * (y - yMean); den += (i - xMean) * (i - xMean); });
    return { slope: den === 0 ? 0 : num / den, last: ys[ys.length - 1] };
  };
  const fc = fit(counts);
  const fs = fit(scores);
  const projections = Array.from({ length: n }, (_, i) => ({
    period: i + 1,
    projectedFindings: Math.max(0, Math.round(fc.last + fc.slope * (i + 1))),
    projectedRisk: Math.max(0, round1(fs.last + fs.slope * (i + 1))),
  }));
  return { ok: true, periods: n, projections };
}

/* 52520 — Seasonality analysis: detect post-release spikes and weekly patterns. */
export function seasonalityAnalysis(hunts, releases) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  const rels = Array.isArray(releases) ? releases : [];
  const sorted = hunts.slice().sort((a, b) => a.at - b.at);
  const spikes = sorted.filter((h) => {
    const nearby = rels.find((r) => h.at >= r.at && h.at - r.at <= 7 * 86400000);
    if (!nearby) return false;
    const idx = sorted.indexOf(h);
    const prev = sorted[idx - 1];
    return prev ? findingsOf(h).length > findingsOf(prev).length * 1.5 : findingsOf(h).length > 0;
  });
  const byDow = {};
  for (const h of sorted) {
    const dow = new Date(h.at).getUTCDay();
    byDow[dow] = byDow[dow] || { hunts: 0, findings: 0 };
    byDow[dow].hunts += 1;
    byDow[dow].findings += findingsOf(h).length;
  }
  return {
    ok: true,
    postReleaseSpikes: spikes.map((h) => h.id),
    spikeCount: spikes.length,
    dayOfWeekAvg: Object.entries(byDow).map(([dow, v]) => ({ dow: Number(dow), avgFindings: round1(v.findings / v.hunts) })),
  };
}
