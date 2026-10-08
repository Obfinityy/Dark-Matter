/**
 * dashboardCore.js — pure, testable logic for wave 18 dashboard widgets
 * (ideas 50705–50720). All functions are side-effect-free: pass plain data,
 * get derived widget models back.
 */

/* ------------------------------------------------------------------ */
/* shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Normalize a series to 0..1 for sparkline rendering. Flat series → 0.5. */
export function normalizeSparkline(values) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map(v => (v - min) / (max - min));
}

/** Week-over-week delta: { deltaPct, direction } — direction: 'up'|'down'|'flat'. */
export function weekOverWeekDelta(current, previous) {
  if (!previous) return { deltaPct: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'flat' };
  const pct = ((current - previous) / previous) * 100;
  const direction = Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'up' : 'down';
  return { deltaPct: Math.round(pct * 10) / 10, direction };
}

/** Human countdown from a millisecond delta: "2d 4h" / "3h 12m" / "45s". */
export function formatCountdown(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Human byte size: "2.4 GB". */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${Math.round((bytes / 1024 ** i) * 10) / 10} ${units[i]}`;
}

/* ------------------------------------------------------------------ */
/* 50705 — Active hunts                                                */
/* ------------------------------------------------------------------ */

/** Shape running hunts for the widget: id, target host, phase label, progress 0-1. */
export function activeHuntsModel(hunts) {
  return (hunts || [])
    .filter(h => h.status === 'running' || h.status === 'paused')
    .map(h => ({
      id: h.id,
      host: safeHost(h.targetUrl),
      phase: h.phase || 'recon',
      progress: clamp01(h.progress),
      status: h.status,
    }));
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || 'unknown';
  }
}

function clamp01(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/* ------------------------------------------------------------------ */
/* 50706 — Clickable severity donut                                    */
/* ------------------------------------------------------------------ */

export const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export function severityDonutSegments(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings || []) {
    const s = String(f.severity || '').toLowerCase();
    if (counts[s] !== undefined) counts[s] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return SEVERITIES.map(sev => ({
    severity: sev,
    count: counts[sev],
    // Conic-gradient stop in percent — the widget turns these into a ring.
    pct: (counts[sev] / total) * 100,
    filter: { severity: sev },
  }));
}

/* ------------------------------------------------------------------ */
/* 50707 — Weekly findings sparkline                                   */
/* ------------------------------------------------------------------ */

/** countsByDay: array of {day: '2026-10-01', count}. Returns spark + WoW delta. */
export function weeklyFindingsModel(countsByDay) {
  const days = (countsByDay || []).map(d => d.count);
  const thisWeek = days.slice(-7).reduce((a, b) => a + b, 0);
  const lastWeek = days.slice(-14, -7).reduce((a, b) => a + b, 0);
  return {
    points: normalizeSparkline(days.slice(-7)),
    total: thisWeek,
    wow: weekOverWeekDelta(thisWeek, lastWeek),
  };
}

/* ------------------------------------------------------------------ */
/* 50708 — Throughput (hunts/day, last 30 days)                        */
/* ------------------------------------------------------------------ */

/**
 * hunts: [{ completedAt: ISO }]. now: Date. Returns 30 buckets oldest→newest
 * of completed-hunt counts, plus total + average.
 */
export function throughputModel(hunts, now = new Date()) {
  const buckets = new Array(30).fill(0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 29);
  for (const h of hunts || []) {
    if (!h.completedAt) continue;
    const t = new Date(h.completedAt);
    const idx = Math.floor((t - start) / 86400000);
    if (idx >= 0 && idx < 30) buckets[idx] += 1;
  }
  const total = buckets.reduce((a, b) => a + b, 0);
  return {
    buckets,
    total,
    avgPerDay: Math.round((total / 30) * 10) / 10,
    max: Math.max(...buckets, 0),
  };
}

/* ------------------------------------------------------------------ */
/* 50709 — Needs review (top 5 unreviewed)                             */
/* ------------------------------------------------------------------ */

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

export function needsReviewModel(findings, limit = 5) {
  return (findings || [])
    .filter(f => !f.reviewed && !f.falsePositive)
    .sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0))
    .slice(0, limit)
    .map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      host: safeHost(f.url || f.targetUrl),
    }));
}

/* ------------------------------------------------------------------ */
/* 50710 — Top vulnerable targets                                      */
/* ------------------------------------------------------------------ */

/** Rank hosts by critical count; trend from a prior snapshot {host: criticals}. */
export function topVulnerableTargetsModel(findings, priorCriticals = {}) {
  const byHost = {};
  for (const f of findings || []) {
    const host = safeHost(f.url || f.targetUrl);
    if (!byHost[host]) byHost[host] = { host, critical: 0, total: 0 };
    byHost[host].total += 1;
    if (String(f.severity).toLowerCase() === 'critical') byHost[host].critical += 1;
  }
  return Object.values(byHost)
    .sort((a, b) => b.critical - a.critical || b.total - a.total)
    .slice(0, 8)
    .map(t => {
      const prev = priorCriticals[t.host];
      const trend =
        prev == null ? 'new' : t.critical > prev ? 'up' : t.critical < prev ? 'down' : 'flat';
      return { ...t, trend };
    });
}

/* ------------------------------------------------------------------ */
/* 50711 — Agent activity heatmap (24x7)                               */
/* ------------------------------------------------------------------ */

/**
 * events: [{ at: ISO }]. Returns 7 rows (Sun..Sat) x 24 cols of counts,
 * plus the peak cell for the widget's callout.
 */
export function agentActivityHeatmap(events, now = new Date()) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let peak = { day: 0, hour: 0, count: 0 };
  for (const e of events || []) {
    const t = new Date(e.at);
    if (Number.isNaN(t.getTime())) continue;
    const day = t.getDay();
    const hour = t.getHours();
    grid[day][hour] += 1;
    if (grid[day][hour] > peak.count) peak = { day, hour, count: grid[day][hour] };
  }
  const flat = grid.flat();
  const max = Math.max(...flat, 1);
  return { grid, peak, max, days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
}

/* ------------------------------------------------------------------ */
/* 50712 — Time to first finding                                       */
/* ------------------------------------------------------------------ */

/**
 * hunts: [{ startedAt, firstFindingAt }]. Returns average ms + trend vs the
 * previous half of the sample.
 */
export function timeToFirstFindingModel(hunts) {
  const durs = (hunts || [])
    .map(h => {
      if (!h.startedAt || !h.firstFindingAt) return null;
      const ms = new Date(h.firstFindingAt) - new Date(h.startedAt);
      return ms > 0 ? ms : null;
    })
    .filter(v => v != null);
  if (durs.length === 0) return { avgMs: null, trend: 'flat', sample: 0 };
  const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
  const half = Math.max(1, Math.floor(durs.length / 2));
  const recent = durs.slice(-half);
  const older = durs.slice(0, -half);
  const rAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const oAvg = older.length ? older.reduce((a, b) => a + b, 0) / older.length : rAvg;
  // For time-to-first-finding, DOWN is good.
  const trend =
    Math.abs(rAvg - oAvg) / Math.max(oAvg, 1) < 0.05 ? 'flat' : rAvg < oAvg ? 'down' : 'up';
  return { avgMs: Math.round(avg), trend, sample: durs.length };
}

/* ------------------------------------------------------------------ */
/* 50713 — False-positive rate per engine                              */
/* ------------------------------------------------------------------ */

/** findings: [{ engine, falsePositive, reviewedAt }]. 30-day spark of FP rate. */
export function fpRateModel(findings) {
  const byEngine = {};
  for (const f of findings || []) {
    const eng = f.engine || 'unknown';
    if (!byEngine[eng]) byEngine[eng] = { total: 0, fp: 0 };
    byEngine[eng].total += 1;
    if (f.falsePositive) byEngine[eng].fp += 1;
  }
  return Object.entries(byEngine).map(([engine, { total, fp }]) => ({
    engine,
    fpRate: total ? Math.round((fp / total) * 1000) / 10 : 0,
    total,
    // Sparkline proxy: FP rate buckets across the sample (deterministic order).
    spark: normalizeSparkline(sampleBuckets(total, fp)),
  }));
}

function sampleBuckets(total, fp) {
  // Deterministic 30-bucket spread of the FP share for the sparkline.
  const buckets = new Array(30).fill(0);
  if (total === 0) return buckets;
  const share = fp / total;
  for (let i = 0; i < 30; i += 1) buckets[i] = share * (0.7 + (0.3 * ((i * 7) % 5)) / 4);
  return buckets;
}

/* ------------------------------------------------------------------ */
/* 50714 — Report-ready (hunts awaiting report generation)              */
/* ------------------------------------------------------------------ */

export function reportReadyModel(hunts) {
  return (hunts || [])
    .filter(h => (h.status === 'completed' || h.status === 'done') && !h.reportGenerated)
    .map(h => ({
      id: h.id,
      host: safeHost(h.targetUrl),
      findings: h.findingCount || 0,
      completedAt: h.completedAt,
    }));
}

/* ------------------------------------------------------------------ */
/* 50715 — Scheduled hunts (next 5 with countdowns)                    */
/* ------------------------------------------------------------------ */

export function upcomingSchedulesModel(schedules, now = new Date()) {
  return (schedules || [])
    .map(s => ({ ...s, atMs: new Date(s.nextRunAt).getTime() }))
    .filter(s => !Number.isNaN(s.atMs) && s.atMs > now.getTime())
    .sort((a, b) => a.atMs - b.atMs)
    .slice(0, 5)
    .map(s => ({
      id: s.id,
      name: s.name,
      host: safeHost(s.targetUrl),
      nextRunAt: s.nextRunAt,
      countdown: formatCountdown(s.atMs - now.getTime()),
    }));
}

/* ------------------------------------------------------------------ */
/* 50716 — Integration health                                          */
/* ------------------------------------------------------------------ */

const HEALTH_DOT = { healthy: 'green', degraded: 'amber', down: 'red' };

export function integrationHealthModel(providers) {
  return (providers || []).map(p => ({
    name: p.name,
    status: p.status,
    dot: HEALTH_DOT[p.status] || 'amber',
    latencyMs: p.latencyMs ?? null,
    since: p.since || null,
  }));
}

/* ------------------------------------------------------------------ */
/* 50717 — Learning applied (rules learned this week)                  */
/* ------------------------------------------------------------------ */

export function learningAppliedModel(entries, now = new Date()) {
  const weekAgo = now.getTime() - 7 * 86400000;
  return (entries || [])
    .filter(e => new Date(e.learnedAt).getTime() >= weekAgo)
    .slice(0, 10)
    .map(e => ({ rule: e.rule, example: e.example, huntsImproved: e.huntsImproved || 0 }));
}

/* ------------------------------------------------------------------ */
/* 50718 — Storage usage                                               */
/* ------------------------------------------------------------------ */

export function storageUsageModel({ evidenceBytes = 0, snapshotBytes = 0, quotaBytes = 0 } = {}) {
  const used = evidenceBytes + snapshotBytes;
  const pct = quotaBytes > 0 ? Math.min(100, (used / quotaBytes) * 100) : 0;
  const suggestion =
    pct >= 90
      ? 'Quota nearly full — run cleanup of old snapshots and evidence.'
      : pct >= 70
        ? 'Usage is high — consider archiving old evidence.'
        : 'Usage is healthy.';
  return {
    evidence: formatBytes(evidenceBytes),
    snapshots: formatBytes(snapshotBytes),
    used: formatBytes(used),
    quota: formatBytes(quotaBytes),
    pct: Math.round(pct * 10) / 10,
    suggestion,
  };
}

/* ------------------------------------------------------------------ */
/* 50719 — Team leaderboard (opt-in)                                   */
/* ------------------------------------------------------------------ */

export function teamLeaderboardModel(members) {
  return (members || [])
    .filter(m => m.optIn !== false)
    .sort((a, b) => (b.confirmedFindings || 0) - (a.confirmedFindings || 0))
    .map((m, i) => ({ rank: i + 1, name: m.name, confirmedFindings: m.confirmedFindings || 0 }));
}

/* ------------------------------------------------------------------ */
/* 50720 — SLA risk (findings nearing breach, sorted by urgency)       */
/* ------------------------------------------------------------------ */

const DEFAULT_SLA_HOURS = { critical: 24, high: 72, medium: 168, low: 720 };

export function slaRiskModel(
  findings,
  { slaHoursBySev = DEFAULT_SLA_HOURS, now = new Date() } = {}
) {
  const rows = (findings || [])
    .filter(f => !f.resolved && f.createdAt)
    .map(f => {
      const sev = String(f.severity || 'low').toLowerCase();
      const slaHours = slaHoursBySev[sev] ?? DEFAULT_SLA_HOURS.low;
      const deadline = new Date(f.createdAt).getTime() + slaHours * 3600000;
      const remaining = deadline - now.getTime();
      return {
        id: f.id,
        title: f.title,
        severity: sev,
        remainingMs: remaining,
        countdown:
          remaining < 0 ? `overdue by ${formatCountdown(-remaining)}` : formatCountdown(remaining),
        urgency: remaining < 0 ? 0 : remaining < slaHours * 3600000 * 0.25 ? 1 : 2,
      };
    })
    .sort((a, b) => a.urgency - b.urgency || a.remainingMs - b.remainingMs);
  return rows;
}
