/**
 * wave103BCores.js — Infinity AI · Wave 103B
 * Scope tail plus target dashboard views and widgets, ideas 54101–54120:
 * cookie scoping, third-party exclusion help, review reminders, sign-off
 * records, card, table, kanban, heatmap and map views, health and stale
 * widgets, risky rankings, activity feeds, coverage gauges, severity bars,
 * sparklines, quick filters, and saved layouts.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE103_B_IDEAS = [
  { id: 54101, title: 'Cookie-based scoping', skip: false },
  { id: 54102, title: 'Third-party exclusion helper', skip: false },
  { id: 54103, title: 'Scope review reminders', skip: false },
  { id: 54104, title: 'Scope sign-off record', skip: false },
  { id: 54105, title: 'Card grid view', skip: false },
  { id: 54106, title: 'Dense table view', skip: false },
  { id: 54107, title: 'Kanban by lifecycle', skip: false },
  { id: 54108, title: 'Risk heatmap view', skip: false },
  { id: 54109, title: 'Geo map view', skip: false },
  { id: 54110, title: 'Health summary widget', skip: false },
  { id: 54111, title: 'Needs-verification widget', skip: false },
  { id: 54112, title: 'Stale targets widget', skip: false },
  { id: 54113, title: 'Expiring scopes widget', skip: false },
  { id: 54114, title: 'Top risky targets widget', skip: false },
  { id: 54115, title: 'Recent activity feed', skip: false },
  { id: 54116, title: 'Hunt coverage gauge', skip: false },
  { id: 54117, title: 'Findings-by-severity mini bars', skip: false },
  { id: 54118, title: 'Trend sparklines', skip: false },
  { id: 54119, title: 'Quick filters bar', skip: false },
  { id: 54120, title: 'Saved dashboard layouts', skip: false },
];

function round2(v) { return Math.round(Number(v || 0) * 100) / 100; }
function num(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f; }
function rate(p, w) { return w ? round2(p / w) : 0; }
function hostOf(u) { const raw = String(u || '').trim().toLowerCase(); const noProto = raw.replace(/^https?:\/\//, ''); return noProto.split('/')[0].split(':')[0]; }
function riskBand(score) { const s = num(score, 0); return s >= 80 ? 'critical' : s >= 60 ? 'high' : s >= 35 ? 'medium' : 'low'; }
const SPARK_GLYPHS = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];

/** Idea 54101 — Cookie-based scoping. Input records: {cookieName, requiredValue, cookies}. Authenticated areas enter scope only when the session carries the right cookie. */
export function applyCookieScope(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const cookieName = String(r.cookieName || 'session');
    const requiredValue = String(r.requiredValue || '');
    const cookies = r.cookies && typeof r.cookies === 'object' ? r.cookies : {};
    const present = Object.prototype.hasOwnProperty.call(cookies, cookieName);
    const actual = present ? String(cookies[cookieName]) : '';
    const matched = present && (requiredValue ? actual === requiredValue : true);
    return { key: `${cookieName}|${idx}`, cookieName, requiredValue, actual, present, matched, status: matched ? 'cookie-matched' : present ? 'cookie-value-mismatch' : 'cookie-missing' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, missingCount: rows.filter(r => !r.present).length, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} session(s) on scope cookies.` };
}
/** Idea 54102 — Third-party exclusion helper. Input records: {pageHost, resources}. Off-inventory hosts loaded by a page are one-click exclusion candidates. */
export function suggestThirdPartyExclusions(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pageHost = hostOf(r.pageHost);
    const resources = Array.isArray(r.resources) ? [...new Set(r.resources.map(x => hostOf(x)).filter(Boolean))] : [];
    const thirdParty = resources.filter(h => h !== pageHost && !h.endsWith(`.${pageHost}`));
    const firstParty = resources.filter(h => h === pageHost || h.endsWith(`.${pageHost}`));
    return { key: pageHost, pageHost, resources, suggestions: thirdParty, suggestedCount: thirdParty.length, firstPartyCount: firstParty.length, status: thirdParty.length ? 'exclusions-suggested' : 'no-third-party' };
  }).sort((a, b) => b.suggestedCount - a.suggestedCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalSuggestions: rows.reduce((s, r) => s + r.suggestedCount, 0), top: rows[0] || null, summary: `Infinity AI suggested ${rows.reduce((s, r) => s + r.suggestedCount, 0)} third-party exclusion(s) across ${rows.length} page(s).` };
}
/** Idea 54103 — Scope review reminders. Input records: {target, lastConfirmedDaysAgo, thresholdDays}. Owners get nudged before stale scope quietly goes wrong. */
export function planScopeReviewReminders(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const threshold = Math.max(1, num(r.thresholdDays, 90));
    const days = Math.max(0, num(r.lastConfirmedDaysAgo, 0));
    const overdue = days > threshold;
    const status = overdue ? 'review-overdue' : days >= Math.floor(threshold * 0.8) ? 'review-due-soon' : 'review-fresh';
    return { key: target, target, lastConfirmedDaysAgo: days, thresholdDays: threshold, overdue, status, message: status === 'review-overdue' ? `Re-confirm scope for ${target}; last confirmed ${days} day(s) ago.` : status === 'review-due-soon' ? `Scope review for ${target} is coming due.` : `${target} scope was confirmed recently.` };
  }).sort((a, b) => b.lastConfirmedDaysAgo - a.lastConfirmedDaysAgo || String(a.key).localeCompare(String(b.key)));
  const overdueCount = rows.filter(r => r.overdue).length;
  return { rows, count: rows.length, overdueCount, dueSoonCount: rows.filter(r => r.status === 'review-due-soon').length, top: rows[0] || null, summary: `Infinity AI flagged ${overdueCount} of ${rows.length} target(s) overdue for scope review.` };
}
/** Idea 54104 — Scope sign-off record. Input records: {target, signedBy, signedAt, approved}. Compliance evidence exists only when an approver and a timestamp are both captured. */
export function buildScopeSignoffRecord(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const signedBy = String(r.signedBy || '');
    const signedAt = String(r.signedAt || '');
    const approved = Boolean(r.approved);
    const valid = approved && signedBy.length >= 2 && signedAt.length >= 8;
    const record = valid ? { target, signedBy, signedAt, statement: `Client signed off on the testing scope for ${target}.` } : null;
    return { key: target, target, signedBy, signedAt, approved, valid, record, status: valid ? 'signed-off' : approved ? 'record-incomplete' : 'awaiting-signoff' };
  }).sort((a, b) => Number(b.valid) - Number(a.valid) || String(a.key).localeCompare(String(b.key)));
  const validCount = rows.filter(r => r.valid).length;
  return { rows, count: rows.length, validCount, top: rows[0] || null, summary: `Infinity AI holds valid sign-off records for ${validCount} of ${rows.length} target(s).` };
}
/** Idea 54105 — Card grid view. Input records: {target, health, riskScore, owner}. Rich cards put the health badge and risk band in front of every other detail. */
export function buildCardGridView(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const health = String(r.health || 'unknown').toLowerCase();
    const riskScore = Math.max(0, Math.min(100, num(r.riskScore, 0)));
    const band = riskBand(riskScore);
    return { key: target, target, health, riskScore, band, owner: String(r.owner || 'unassigned'), badge: health, card: `${target} · ${band} risk (${riskScore}) · ${health}`, status: band === 'critical' ? 'card-critical' : health === 'down' ? 'card-down' : 'card-normal' };
  }).sort((a, b) => b.riskScore - a.riskScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, criticalCount: rows.filter(r => r.band === 'critical').length, healthyCount: rows.filter(r => r.health === 'healthy').length, top: rows[0] || null, summary: `Infinity AI rendered ${rows.length} target card(s); ${rows.filter(r => r.band === 'critical').length} sit in the critical band.` };
}
/** Idea 54106 — Dense table view. Input records: {target, riskScore, columns}. Power users get a sortable table with the columns they actually asked for. */
export function buildDenseTableView(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const riskScore = Math.max(0, Math.min(100, num(r.riskScore, 0)));
    const columns = Array.isArray(r.columns) ? [...new Set(r.columns.map(c => String(c)))].filter(Boolean) : ['target', 'riskScore'];
    return { key: target, target, riskScore, band: riskBand(riskScore), columns, columnCount: columns.length };
  }).sort((a, b) => b.riskScore - a.riskScore || String(a.key).localeCompare(String(b.key)));
  const columnUnion = [...new Set(rows.flatMap(r => r.columns))].sort();
  return { rows, count: rows.length, columnUnion, totalColumns: columnUnion.length, sortKey: 'riskScore', order: 'desc', top: rows[0] || null, summary: `Infinity AI lined up ${rows.length} target row(s) across ${columnUnion.length} column(s).` };
}
/** Idea 54107 — Kanban by lifecycle. Input records: {target, lifecycle}. Lifecycle columns make stalled verification work impossible to hide. */
export function buildLifecycleKanban(records = []) {
  const columns = ['Active', 'Paused', 'Pending Verification', 'Archived'];
  const byColumn = Object.fromEntries(columns.map(c => [c, []]));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const lifecycle = String(r.lifecycle || 'Active');
    const column = columns.find(c => c.toLowerCase() === lifecycle.toLowerCase()) || 'Active';
    byColumn[column].push(target);
    return { key: target, target, lifecycle, column };
  }).sort((a, b) => String(a.column).localeCompare(String(b.column)) || String(a.key).localeCompare(String(b.key)));
  for (const c of columns) byColumn[c].sort();
  const fullest = columns.map(c => ({ column: c, count: byColumn[c].length })).sort((a, b) => b.count - a.count || a.column.localeCompare(b.column))[0] || { column: 'Active', count: 0 };
  return { rows, count: rows.length, columns, byColumn, columnCounts: Object.fromEntries(columns.map(c => [c, byColumn[c].length])), fullestColumn: fullest.column, top: rows[0] || null, summary: `Infinity AI arranged ${rows.length} target(s); the fullest lifecycle column is ${fullest.column} with ${fullest.count}.` };
}
/** Idea 54108 — Risk heatmap view. Input records: {target, severity, exposure}. Severity crossed with exposure spotlights the inventory that burns first. */
export function buildRiskHeatmap(records = []) {
  const bandOf = v => (v >= 7 ? 'high' : v >= 4 ? 'medium' : 'low');
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const severity = Math.max(0, Math.min(10, num(r.severity, 0)));
    const exposure = Math.max(0, Math.min(10, num(r.exposure, 0)));
    const heat = round2((severity * exposure) / 100);
    return { key: target, target, severity, exposure, severityBand: bandOf(severity), exposureBand: bandOf(exposure), cell: `${bandOf(severity)}x${bandOf(exposure)}`, heat, status: heat >= 0.49 ? 'heat-critical' : heat >= 0.16 ? 'heat-warm' : 'heat-cool' };
  }).sort((a, b) => b.heat - a.heat || String(a.key).localeCompare(String(b.key)));
  const cells = {};
  for (const r of rows) cells[r.cell] = (cells[r.cell] || 0) + 1;
  return { rows, count: rows.length, cells, criticalCount: rows.filter(r => r.status === 'heat-critical').length, hottest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI plotted ${rows.length} target(s) on the risk heatmap; ${rows.filter(r => r.status === 'heat-critical').length} run critical.` };
}
/** Idea 54109 — Geo map view. Input records: {target, country, region}. Pins by hosting geography reveal concentration and jurisdiction patterns. */
export function buildGeoMapView(records = []) {
  const byCountry = new Map();
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const country = String(r.country || '??').toUpperCase();
    const region = String(r.region || '');
    const cur = byCountry.get(country) || { country, targets: [], regions: new Set() };
    cur.targets.push(target);
    if (region) cur.regions.add(region);
    byCountry.set(country, cur);
    return { key: target, target, country, region, pin: `${target}@${country}` };
  }).sort((a, b) => String(a.country).localeCompare(String(b.country)) || String(a.key).localeCompare(String(b.key)));
  const pins = [...byCountry.values()].map(x => ({ country: x.country, count: x.targets.length, targets: [...x.targets].sort(), regions: [...x.regions].sort() })).sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
  return { rows, count: rows.length, pins, countryCount: pins.length, topCountry: pins[0] || null, top: rows[0] || null, summary: `Infinity AI pinned ${rows.length} target(s) across ${pins.length} countr${pins.length === 1 ? 'y' : 'ies'}.` };
}
/** Idea 54110 — Health summary widget. Input records: {target, health}. A one-line health census with drill-down counts per state. */
export function summarizeTargetHealth(records = []) {
  const normalized = (Array.isArray(records) ? records : []).map(r => ({ target: String(r.target || 'target'), health: String(r.health || 'unknown').toLowerCase() }));
  const healthy = normalized.filter(r => r.health === 'healthy');
  const degraded = normalized.filter(r => r.health === 'degraded');
  const down = normalized.filter(r => r.health === 'down');
  const healthPercent = rate(healthy.length, normalized.length);
  return { rows: normalized, count: normalized.length, healthyCount: healthy.length, degradedCount: degraded.length, downCount: down.length, healthPercent, healthyTargets: healthy.map(r => r.target), degradedTargets: degraded.map(r => r.target), downTargets: down.map(r => r.target), status: down.length ? 'has-down-targets' : degraded.length ? 'has-degraded-targets' : 'all-healthy', top: down[0] || degraded[0] || healthy[0] || null, summary: `Infinity AI counted ${healthy.length} healthy, ${degraded.length} degraded, and ${down.length} down target(s).` };
}
/** Idea 54111 — Needs-verification widget. Input records: {target, verified, daysUnverified}. The oldest unverified target floats to the top for quick action. */
export function findNeedsVerification(records = []) {
  const rows = (Array.isArray(records) ? records : []).filter(r => !r.verified).map(r => {
    const target = String(r.target || 'target');
    const days = Math.max(0, num(r.daysUnverified, 0));
    return { key: target, target, verified: false, daysUnverified: days, stale: days >= 7, status: days >= 7 ? 'verification-stale' : 'verification-pending' };
  }).sort((a, b) => b.daysUnverified - a.daysUnverified || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, staleCount: rows.filter(r => r.stale).length, oldest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI surfaced ${rows.length} target(s) awaiting verification; ${rows.filter(r => r.stale).length} are stale.` };
}
/** Idea 54112 — Stale targets widget. Input records: {target, lastActivityDaysAgo, thresholdDays}. Silence past the threshold means the target needs attention or archiving. */
export function findStaleTargets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const threshold = Math.max(1, num(r.thresholdDays, 30));
    const days = Math.max(0, num(r.lastActivityDaysAgo, 0));
    const stale = days > threshold;
    return { key: target, target, lastActivityDaysAgo: days, thresholdDays: threshold, stale, status: stale ? 'target-stale' : 'target-active' };
  }).sort((a, b) => b.lastActivityDaysAgo - a.lastActivityDaysAgo || String(a.key).localeCompare(String(b.key)));
  const staleCount = rows.filter(r => r.stale).length;
  return { rows, count: rows.length, staleCount, stalest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI flagged ${staleCount} of ${rows.length} target(s) as stale.` };
}
/** Idea 54113 — Expiring scopes widget. Input records: {target, scopeExpiresInDays}. Time-boxed permissions get flagged before they lapse mid-hunt. */
export function findExpiringScopes(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const days = num(r.scopeExpiresInDays, 9999);
    return { key: target, target, scopeExpiresInDays: days, expired: days < 0, expiring: days >= 0 && days <= 30, status: days < 0 ? 'scope-expired' : days <= 30 ? 'scope-expiring' : 'scope-safe' };
  }).sort((a, b) => a.scopeExpiresInDays - b.scopeExpiresInDays || String(a.key).localeCompare(String(b.key)));
  const expiringCount = rows.filter(r => r.expiring).length;
  return { rows, count: rows.length, expiringCount, expiredCount: rows.filter(r => r.expired).length, soonest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI flagged ${expiringCount} scope(s) expiring within 30 days and ${rows.filter(r => r.expired).length} already expired.` };
}
/** Idea 54114 — Top risky targets widget. Input records: {target, riskScore, trend}. The ten riskiest targets, ranked, with trend arrows for momentum. */
export function rankTopRiskyTargets(records = []) {
  const arrows = { up: '\u2191', down: '\u2193', flat: '\u2192' };
  const ranked = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const riskScore = Math.max(0, Math.min(100, num(r.riskScore, 0)));
    const trend = ['up', 'down', 'flat'].includes(String(r.trend || 'flat')) ? String(r.trend) : 'flat';
    return { target, riskScore, trend, arrow: arrows[trend] };
  }).sort((a, b) => b.riskScore - a.riskScore || a.target.localeCompare(b.target));
  const rows = ranked.slice(0, 10).map((r, i) => ({ key: r.target, ...r, rank: i + 1, label: `#${i + 1} ${r.target} ${r.arrow}`, band: riskBand(r.riskScore) }));
  return { rows, count: rows.length, considered: ranked.length, climbingCount: rows.filter(r => r.trend === 'up').length, top: rows[0] || null, summary: `Infinity AI ranked the riskiest ${rows.length} target(s); ${rows.filter(r => r.trend === 'up').length} are climbing.` };
}
/** Idea 54115 — Recent activity feed. Input records: {type, target, at, actor}. Hunts, findings, changes, and notes stream newest-first across all targets. */
export function buildRecentActivityFeed(records = []) {
  const types = ['hunt', 'finding', 'change', 'note'];
  const counts = Object.fromEntries(types.map(t => [t, 0]));
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const type = types.includes(String(r.type || '')) ? String(r.type) : 'note';
    counts[type] += 1;
    const at = String(r.at || '');
    const parsed = Date.parse(at);
    return { key: `${at}|${String(r.target || '')}|${idx}`, type, target: String(r.target || 'target'), at, actor: String(r.actor || 'Infinity AI'), ts: Number.isFinite(parsed) ? parsed : 0, line: `${type} on ${String(r.target || 'target')} at ${at}` };
  }).sort((a, b) => b.ts - a.ts || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, typeCounts: counts, latest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI streamed ${rows.length} activit${rows.length === 1 ? 'y' : 'ies'} into the feed.` };
}
/** Idea 54116 — Hunt coverage gauge. Input records: {target, active, huntedInPeriod}. The gauge shows how much of the live inventory actually got hunted. */
export function measureHuntCoverage(records = []) {
  const normalized = (Array.isArray(records) ? records : []).map(r => ({ target: String(r.target || 'target'), active: r.active !== false, hunted: Boolean(r.huntedInPeriod) }));
  const activeTargets = normalized.filter(r => r.active);
  const hunted = activeTargets.filter(r => r.hunted);
  const uncovered = activeTargets.filter(r => !r.hunted).map(r => r.target);
  const percent = rate(hunted.length, activeTargets.length);
  return { rows: normalized, count: normalized.length, activeCount: activeTargets.length, huntedCount: hunted.length, uncovered, uncoveredCount: uncovered.length, percent, band: percent >= 0.9 ? 'coverage-strong' : percent >= 0.6 ? 'coverage-moderate' : 'coverage-thin', top: normalized[0] || null, summary: `Infinity AI hunted ${hunted.length} of ${activeTargets.length} active target(s) in the period (${Math.round(percent * 100)}%).` };
}
/** Idea 54117 — Findings-by-severity mini bars. Input records: {target, findingsBySeverity}. Per-target severity break-downs ride inside cards and rows. */
export function buildSeverityMiniBars(records = []) {
  const severities = ['critical', 'high', 'medium', 'low'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const raw = r.findingsBySeverity && typeof r.findingsBySeverity === 'object' ? r.findingsBySeverity : {};
    const counts = Object.fromEntries(severities.map(s => [s, Math.max(0, num(raw[s], 0))]));
    const total = severities.reduce((s, k) => s + counts[k], 0);
    const shares = Object.fromEntries(severities.map(s => [s, rate(counts[s], total)]));
    const dominant = severities.reduce((m, s) => (counts[s] > counts[m] ? s : m), 'low');
    return { key: target, target, counts, shares, total, dominant: total ? dominant : 'none', bars: severities.map(s => `${s}:${counts[s]}`).join(' '), status: counts.critical > 0 ? 'has-critical' : total ? 'has-findings' : 'no-findings' };
  }).sort((a, b) => b.counts.critical - a.counts.critical || b.total - a.total || String(a.key).localeCompare(String(b.key)));
  const totals = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of rows) for (const s of severities) totals[s] += r.counts[s];
  return { rows, count: rows.length, totals, grandTotal: rows.reduce((s, r) => s + r.total, 0), top: rows[0] || null, summary: `Infinity AI charted severity bars for ${rows.length} target(s) with ${rows.reduce((s, r) => s + r.total, 0)} finding(s).` };
}
/** Idea 54118 — Trend sparklines. Input records: {target, series}. Tiny momentum lines let a whole inventory be read at a glance. */
export function buildTrendSparklines(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const series = Array.isArray(r.series) ? r.series.map(v => num(v, 0)) : [];
    const min = series.length ? Math.min(...series) : 0;
    const max = series.length ? Math.max(...series) : 0;
    const sparkline = series.map(v => SPARK_GLYPHS[max === min ? 3 : Math.round(((v - min) / (max - min)) * 7)]).join('');
    const delta = series.length >= 2 ? round2(series[series.length - 1] - series[0]) : 0;
    return { key: target, target, series, sparkline, delta, direction: delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'flat', points: series.length, status: series.length === 0 ? 'no-data' : delta > 0 ? 'trend-rising' : delta < 0 ? 'trend-falling' : 'trend-flat' };
  }).sort((a, b) => b.delta - a.delta || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, risingCount: rows.filter(r => r.direction === 'rising').length, fallingCount: rows.filter(r => r.direction === 'falling').length, top: rows[0] || null, summary: `Infinity AI drew sparklines for ${rows.length} target(s); ${rows.filter(r => r.direction === 'rising').length} are rising.` };
}
/** Idea 54119 — Quick filters bar. Input records: {targets, filter}. One-click chips combine lifecycle, health, verification, risk band, and ownership. */
export function buildQuickFiltersBar(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const targets = Array.isArray(r.targets) ? r.targets.map(t => ({ name: String(t.name || 'target'), lifecycle: String(t.lifecycle || ''), health: String(t.health || ''), verified: Boolean(t.verified), riskScore: num(t.riskScore, 0), owner: String(t.owner || '') })) : [];
    const filter = r.filter && typeof r.filter === 'object' ? r.filter : {};
    const matched = targets.filter(t =>
      (!filter.lifecycle || t.lifecycle === String(filter.lifecycle)) &&
      (!filter.health || t.health === String(filter.health)) &&
      (filter.verified === undefined || t.verified === Boolean(filter.verified)) &&
      (!filter.riskBand || riskBand(t.riskScore) === String(filter.riskBand)) &&
      (!filter.mine || t.owner === String(filter.mine))
    );
    const chips = ['lifecycle', 'health', 'verified', 'riskBand', 'mine'].filter(k => filter[k] !== undefined && filter[k] !== '').map(k => `${k}:${String(filter[k])}`);
    return { key: `filter|${idx}`, chips, chipCount: chips.length, targets: matched.map(t => t.name), matchedCount: matched.length, total: targets.length, status: chips.length === 0 ? 'filter-empty' : matched.length === 0 ? 'filter-no-match' : 'filter-matched' };
  }).sort((a, b) => b.matchedCount - a.matchedCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, filteredCount: rows.filter(r => r.chipCount > 0).length, top: rows[0] || null, summary: `Infinity AI applied ${rows.filter(r => r.chipCount > 0).length} quick filter(s) across ${rows.length} scenario(s).` };
}
/** Idea 54120 — Saved dashboard layouts. Input records: {name, views}. Named arrangements switch between card, table, and kanban without rebuilding them. */
export function manageSavedDashboardLayouts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const name = String(r.name || `layout-${idx + 1}`);
    const views = Array.isArray(r.views) ? [...new Set(r.views.map(v => String(v).toLowerCase()))].filter(Boolean) : [];
    return { key: name, name, views, viewCount: views.length, complete: views.includes('cards') && views.includes('table') && views.includes('kanban'), status: views.includes('cards') && views.includes('table') && views.includes('kanban') ? 'layout-complete' : views.length ? 'layout-partial' : 'layout-empty' };
  }).sort((a, b) => b.viewCount - a.viewCount || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, totalViews: rows.reduce((s, r) => s + r.viewCount, 0), top: rows[0] || null, summary: `Infinity AI saved ${rows.length} dashboard layout(s); ${completeCount} cover all three views.` };
}
