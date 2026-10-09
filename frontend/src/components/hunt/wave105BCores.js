/**
 * wave105BCores.js — Infinity AI · Wave 105B
 * Health intelligence and status operations, ideas 54181–54200: dependency
 * rollups, maintenance windows, flapping detection, degraded-vs-down states,
 * composite health scores, history charts, SLA compliance, downtime
 * annotations, auto-pause and recovery flows, incident timelines, alert
 * routing, check-interval policy, regional status pages, check-log retention,
 * health-based sorting, the integrations health API, check-region selection,
 * SSO provider checks, and mobile API host checks.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE105_B_IDEAS = [
  { id: 54181, title: 'Dependency health rollup', skip: false },
  { id: 54182, title: 'Scheduled maintenance windows', skip: false },
  { id: 54183, title: 'Flapping detection', skip: false },
  { id: 54184, title: 'Degraded vs down states', skip: false },
  { id: 54185, title: 'Health score 0–100', skip: false },
  { id: 54186, title: 'Health history charts', skip: false },
  { id: 54187, title: 'SLA compliance percentage (targets)', skip: false },
  { id: 54188, title: 'Downtime annotations', skip: false },
  { id: 54189, title: 'Auto-pause hunts on outage', skip: false },
  { id: 54190, title: 'Recovery notifications', skip: false },
  { id: 54191, title: 'Incident timeline (targets)', skip: false },
  { id: 54192, title: 'Alert channel routing', skip: false },
  { id: 54193, title: 'Configurable check intervals', skip: false },
  { id: 54194, title: 'Per-region status page', skip: false },
  { id: 54195, title: 'Health check logs', skip: false },
  { id: 54196, title: 'Health-based target sorting', skip: false },
  { id: 54197, title: 'Health API for integrations', skip: false },
  { id: 54198, title: 'User-selected check regions', skip: false },
  { id: 54199, title: 'SSO provider checks', skip: false },
  { id: 54200, title: 'Mobile API checks', skip: false },
];

function round2(v) { return Math.round(Number(v || 0) * 100) / 100; }
function num(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f; }
function rate(p, w) { return w ? round2(p / w) : 0; }
function healthBand(score) { const s = num(score, 0); return s >= 90 ? 'health-excellent' : s >= 75 ? 'health-good' : s >= 50 ? 'health-fair' : 'health-poor'; }

/** Idea 54181 — Dependency health rollup. Input records: {target, dependencies: [{name, status}]}. CDN, DNS, and SSO dependency status tracked alongside the target. */
export function rollupDependencyHealth(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const deps = (Array.isArray(r.dependencies) ? r.dependencies : []).map(d => ({ name: String(d.name || 'dependency'), status: String(d.status || 'down') }));
    const down = deps.filter(d => d.status === 'down');
    const degraded = deps.filter(d => d.status === 'degraded');
    return { key: target, target, dependencyCount: deps.length, downCount: down.length, degradedCount: degraded.length, downNames: down.map(d => d.name), status: down.length ? 'dependency-down' : degraded.length ? 'dependency-degraded' : 'dependency-healthy' };
  }).sort((a, b) => b.downCount - a.downCount || b.degradedCount - a.degradedCount || String(a.target).localeCompare(String(b.target)));
  const downTargets = rows.filter(r => r.status === 'dependency-down').length;
  const totalDependencies = rows.reduce((s, r) => s + r.dependencyCount, 0);
  return { rows, count: rows.length, downTargets, totalDependencies, top: rows[0] || null, summary: `Infinity AI rolled up ${totalDependencies} dependencies; ${downTargets} target(s) have one down.` };
}
/** Idea 54182 — Scheduled maintenance windows. Input records: {target, windows: [{startHour, endHour}]}. Alerts suppress during declared windows and the timeline is labelled. */
export function planMaintenanceWindows(records = [], scenario = {}) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const nowHour = Math.max(0, Math.min(23, num(scenario.nowHour, num(r.nowHour, 0))));
    const windows = (Array.isArray(r.windows) ? r.windows : []).map(w => ({ startHour: Math.max(0, Math.min(23, num(w.startHour, 0))), endHour: Math.max(0, Math.min(23, num(w.endHour, 0))) }));
    const active = windows.some(w => (w.startHour <= w.endHour ? nowHour >= w.startHour && nowHour < w.endHour : nowHour >= w.startHour || nowHour < w.endHour));
    return { key: target, target, windowCount: windows.length, suppressed: active, status: active ? 'maintenance-window' : 'alerts-active' };
  }).sort((a, b) => Number(b.suppressed) - Number(a.suppressed) || String(a.target).localeCompare(String(b.target)));
  const suppressedCount = rows.filter(r => r.suppressed).length;
  return { rows, count: rows.length, suppressedCount, top: rows[0] || null, summary: `Infinity AI suppresses alerts inside declared windows for ${suppressedCount} of ${rows.length} target(s).` };
}
/** Idea 54183 — Flapping detection. Input records: {target, states}. Rapidly oscillating up/down states consolidate into one incident. */
export function detectFlapping(records = [], scenario = {}) {
  const threshold = Math.max(1, num(scenario.transitionThreshold, 4));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const states = (Array.isArray(r.states) ? r.states : []).map(s => String(s));
    const transitions = states.reduce((n, s, i) => (i > 0 && s !== states[i - 1] ? n + 1 : n), 0);
    const flapping = transitions >= threshold;
    return { key: target, target, observations: states.length, transitions, currentState: states[states.length - 1] || 'unknown', flapping, status: flapping ? 'state-flapping' : 'state-stable' };
  }).sort((a, b) => b.transitions - a.transitions || String(a.target).localeCompare(String(b.target)));
  const flappingCount = rows.filter(r => r.flapping).length;
  return { rows, count: rows.length, flappingCount, threshold, top: rows[0] || null, summary: `Infinity AI consolidated flapping into single incidents on ${flappingCount} of ${rows.length} target(s).` };
}
/** Idea 54184 — Degraded vs down states. Input records: {target, reachable, latencyMs, errorRate}. Slow or partial failures never read as full outages. */
export function classifyTargetState(records = [], scenario = {}) {
  const slowMs = Math.max(1, num(scenario.slowMs, 1200));
  const errorThreshold = Math.max(0, num(scenario.errorThreshold, 0.1));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const reachable = Boolean(r.reachable);
    const latencyMs = Math.max(0, num(r.latencyMs, 0));
    const errorRate = Math.max(0, num(r.errorRate, 0));
    const degraded = reachable && (latencyMs > slowMs || errorRate > errorThreshold);
    return { key: target, target, reachable, latencyMs, errorRate, state: !reachable ? 'down' : degraded ? 'degraded' : 'up', reason: !reachable ? 'unreachable' : degraded ? (latencyMs > slowMs ? 'slow-response' : 'elevated-errors') : 'healthy' };
  }).sort((a, b) => String(a.state).localeCompare(String(b.state)) || b.latencyMs - a.latencyMs);
  const downCount = rows.filter(r => r.state === 'down').length;
  const degradedCount = rows.filter(r => r.state === 'degraded').length;
  return { rows, count: rows.length, downCount, degradedCount, top: rows[0] || null, summary: `Infinity AI classified ${downCount} down, ${degradedCount} degraded, ${rows.length - downCount - degradedCount} up.` };
}
/** Idea 54185 — Health score 0–100. Input records: {target, uptimePercent, p95Ms, tlsGrade, errorRate}. Composite of uptime, latency, TLS, and error signals. */
export function computeHealthScore(records = []) {
  const gradeScore = { 'A+': 100, A: 95, B: 80, C: 60, D: 40, F: 0 };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const uptime = Math.max(0, Math.min(100, num(r.uptimePercent, 0)));
    const p95 = Math.max(0, num(r.p95Ms, 0));
    const latencyScore = p95 <= 300 ? 100 : p95 >= 3000 ? 0 : round2((100 * (3000 - p95)) / 2700);
    const tlsScore = gradeScore[String(r.tlsGrade || '').toUpperCase()] ?? 50;
    const errorScore = Math.max(0, round2(100 - num(r.errorRate, 0) * 200));
    const score = Math.round(Math.max(0, Math.min(100, uptime * 0.5 + latencyScore * 0.2 + tlsScore * 0.15 + errorScore * 0.15)));
    return { key: target, target, uptimePercent: uptime, latencyScore, tlsScore, errorScore, score, band: healthBand(score) };
  }).sort((a, b) => a.score - b.score || String(a.target).localeCompare(String(b.target)));
  const averageScore = rows.length ? round2(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;
  return { rows, count: rows.length, averageScore, sickest: rows[0] || null, top: rows[rows.length - 1] || null, summary: `Infinity AI scored ${rows.length} target(s); portfolio average health ${averageScore}/100.` };
}
/** Idea 54186 — Health history charts. Input records: {target, checks: [{at, up, latencyMs}]}. Uptime, latency, and incident markers for per-target charts. */
export function buildHealthHistory(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const checks = (Array.isArray(r.checks) ? r.checks : []).map(c => ({ at: String(c.at || ''), up: Boolean(c.up), latencyMs: Math.max(0, num(c.latencyMs, 0)) })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const ups = checks.filter(c => c.up).length;
    const points = checks.map(c => ({ at: c.at, latencyMs: c.latencyMs, status: c.up ? 'up' : 'down' }));
    return { key: target, target, checkCount: checks.length, upCount: ups, uptime: rate(ups, checks.length), averageLatencyMs: checks.length ? round2(checks.reduce((s, c) => s + c.latencyMs, 0) / checks.length) : 0, points, markers: checks.filter(c => !c.up).map(c => c.at) };
  }).sort((a, b) => a.uptime - b.uptime || String(a.target).localeCompare(String(b.target)));
  const totalChecks = rows.reduce((s, r) => s + r.checkCount, 0);
  return { rows, count: rows.length, totalChecks, top: rows[0] || null, summary: `Infinity AI charted ${totalChecks} health check(s) across ${rows.length} target(s).` };
}
/** Idea 54187 — SLA compliance percentage (targets). Input records: {target, uptimePercent, slaPercent}. Uptime measured against per-target objectives with breach highlighting. */
export function measureSlaCompliance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const uptime = Math.max(0, Math.min(100, num(r.uptimePercent, 0)));
    const sla = Math.max(0, Math.min(100, num(r.slaPercent, 99)));
    const margin = round2(uptime - sla);
    return { key: target, target, uptimePercent: uptime, slaPercent: sla, margin, compliant: uptime >= sla, status: uptime >= sla ? 'sla-met' : 'sla-breached' };
  }).sort((a, b) => a.margin - b.margin);
  const breachCount = rows.filter(r => !r.compliant).length;
  return { rows, count: rows.length, breachCount, compliantCount: rows.length - breachCount, top: rows[0] || null, summary: `Infinity AI found ${breachCount} of ${rows.length} target(s) in SLA breach.` };
}
/** Idea 54188 — Downtime annotations. Input records: {target, incidentId, notes: [{author, text, rootCause}]}. Root-cause notes complete the postmortem record. */
export function manageDowntimeAnnotations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const notes = (Array.isArray(r.notes) ? r.notes : []).map(n => ({ author: String(n.author || 'on-call'), text: String(n.text || ''), rootCause: Boolean(n.rootCause) }));
    const hasRootCause = notes.some(n => n.rootCause);
    return { key: `${target}|${String(r.incidentId || 'incident')}`, target, incidentId: String(r.incidentId || 'incident'), noteCount: notes.length, hasRootCause, latest: notes.length ? notes[notes.length - 1].text : null, status: hasRootCause ? 'annotation-complete' : notes.length ? 'annotation-partial' : 'annotation-missing' };
  }).sort((a, b) => a.noteCount - b.noteCount || String(a.target).localeCompare(String(b.target)));
  const completeCount = rows.filter(r => r.hasRootCause).length;
  return { rows, count: rows.length, completeCount, top: rows[0] || null, summary: `Infinity AI holds root-cause annotations for ${completeCount} of ${rows.length} incident(s).` };
}
/** Idea 54189 — Auto-pause hunts on outage. Input records: {target, state, runningHunts}. Hunts pause automatically when a target goes down. */
export function planAutoPauseHunts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const state = String(r.state || 'up');
    const runningHunts = Math.max(0, num(r.runningHunts, 0));
    const action = state === 'down' ? 'pause-hunts' : state === 'degraded' ? 'throttle-hunts' : 'keep-running';
    return { key: target, target, state, runningHunts, action, affectedHunts: action === 'keep-running' ? 0 : runningHunts };
  }).sort((a, b) => b.affectedHunts - a.affectedHunts || String(a.target).localeCompare(String(b.target)));
  const pausedCount = rows.filter(r => r.action === 'pause-hunts').length;
  const affectedTotal = rows.reduce((s, r) => s + r.affectedHunts, 0);
  return { rows, count: rows.length, pausedCount, affectedTotal, top: rows[0] || null, summary: `Infinity AI auto-pauses hunts on ${pausedCount} down target(s); ${affectedTotal} hunt(s) affected.` };
}
/** Idea 54190 — Recovery notifications. Input records: {target, wasDown, nowUp, downtimeMinutes, channels}. "Back up" alerts carry the downtime duration. */
export function buildRecoveryNotifications(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const recovered = Boolean(r.wasDown) && Boolean(r.nowUp);
    const minutes = Math.max(0, num(r.downtimeMinutes, 0));
    const channels = (Array.isArray(r.channels) ? r.channels : []).map(c => String(c));
    return { key: target, target, recovered, downtimeMinutes: minutes, channelCount: channels.length, message: recovered ? `${target} back up after ${minutes}m` : null, status: recovered ? 'recovery-notified' : r.wasDown ? 'still-down' : 'steady-up' };
  }).sort((a, b) => Number(b.recovered) - Number(a.recovered) || b.downtimeMinutes - a.downtimeMinutes);
  const notifiedCount = rows.filter(r => r.recovered).length;
  return { rows, count: rows.length, notifiedCount, top: rows[0] || null, summary: `Infinity AI sent recovery notifications for ${notifiedCount} of ${rows.length} target(s).` };
}
/** Idea 54191 — Incident timeline (targets). Input records: {target, incidentId, events: [{type, at}]}. Detection, acknowledgment, and resolution events per outage. */
export function buildIncidentTimeline(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const events = (Array.isArray(r.events) ? r.events : []).map(e => ({ type: String(e.type || 'detected'), at: String(e.at || '') })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const detected = events.find(e => e.type === 'detected');
    const resolved = events.find(e => e.type === 'resolved');
    const acknowledged = events.find(e => e.type === 'acknowledged');
    const durationMinutes = detected && resolved ? Math.max(0, Math.round((Date.parse(resolved.at) - Date.parse(detected.at)) / 60000)) : null;
    return { key: `${target}|${String(r.incidentId || 'incident')}`, target, incidentId: String(r.incidentId || 'incident'), eventCount: events.length, events, durationMinutes, stage: resolved ? 'resolved' : acknowledged ? 'acknowledged' : 'detected' };
  }).sort((a, b) => String(a.stage).localeCompare(String(b.stage)) || String(a.target).localeCompare(String(b.target)));
  const resolvedCount = rows.filter(r => r.stage === 'resolved').length;
  return { rows, count: rows.length, resolvedCount, top: rows[0] || null, summary: `Infinity AI tracks ${rows.length} incident timeline(s); ${resolvedCount} resolved.` };
}
/** Idea 54192 — Alert channel routing. Input records: {target, group, severity}; scenario.rules: [{group?, severity?, channel}]. Routes to email, Slack, PagerDuty, or webhooks per target or group. */
export function routeAlertChannels(records = [], scenario = {}) {
  const rules = (Array.isArray(scenario.rules) ? scenario.rules : []).map(r => ({ group: r.group === undefined ? null : String(r.group), severity: r.severity === undefined ? null : String(r.severity), channel: String(r.channel || 'email') }));
  const fallback = String(scenario.defaultChannel || 'email');
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const group = String(r.group || 'default');
    const severity = String(r.severity || 'info');
    const channels = [...new Set(rules.filter(rule => (rule.group === null || rule.group === group) && (rule.severity === null || rule.severity === severity)).map(rule => rule.channel))];
    const usedFallback = channels.length === 0;
    return { key: target, target, group, severity, channels: usedFallback ? [fallback] : channels, channelCount: usedFallback ? 1 : channels.length, usedFallback, status: 'alert-routed' };
  }).sort((a, b) => String(a.group).localeCompare(String(b.group)) || String(a.target).localeCompare(String(b.target)));
  const fallbackCount = rows.filter(r => r.usedFallback).length;
  return { rows, count: rows.length, fallbackCount, ruleCount: rules.length, top: rows[0] || null, summary: `Infinity AI routed health alerts for ${rows.length} target(s) across ${rules.length} rule(s).` };
}
/** Idea 54193 — Configurable check intervals. Input records: {target, criticality, requestedMinutes}. Frequencies from 1 minute to 24 hours based on criticality. */
export function planCheckIntervals(records = []) {
  const recommended = { critical: 1, high: 5, standard: 15, low: 60 };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const criticality = String(r.criticality || 'standard').toLowerCase();
    const rec = recommended[criticality] ?? 15;
    const requested = num(r.requestedMinutes, rec);
    const effective = Math.min(1440, Math.max(1, requested));
    return { key: target, target, criticality, recommendedMinutes: rec, effectiveMinutes: effective, status: effective <= rec ? 'interval-ok' : 'interval-sparse' };
  }).sort((a, b) => a.effectiveMinutes - b.effectiveMinutes || String(a.target).localeCompare(String(b.target)));
  const sparseCount = rows.filter(r => r.status === 'interval-sparse').length;
  return { rows, count: rows.length, sparseCount, top: rows[0] || null, summary: `Infinity AI set check intervals for ${rows.length} target(s); ${sparseCount} sparser than recommended.` };
}
/** Idea 54194 — Per-region status page. Input records: {target, region, status, healthScore}. A simple published page per target or client showing current health. */
export function buildRegionStatusPage(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const region = String(r.region || 'global');
    const status = String(r.status || 'up');
    const score = Math.max(0, Math.min(100, num(r.healthScore, 0)));
    return { key: `${target}|${region}`, target, region, status, healthScore: score, band: healthBand(score), label: `${region}: ${status} (${score})` };
  }).sort((a, b) => a.healthScore - b.healthScore || String(a.region).localeCompare(String(b.region)));
  const downCount = rows.filter(r => r.status === 'down').length;
  const regions = [...new Set(rows.map(r => r.region))].sort();
  return { rows, count: rows.length, downCount, regions, regionCount: regions.length, worst: rows[0] || null, top: rows[0] || null, summary: `Infinity AI publishes status for ${rows.length} target-region row(s); ${downCount} down.` };
}
/** Idea 54195 — Health check logs. Input records: {target, checks: [{at, statusCode, durationMs}]}. Raw results with timings retained for debugging and evidence. */
export function retainHealthCheckLogs(records = [], scenario = {}) {
  const retention = Math.max(1, num(scenario.retention, 100));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const checks = (Array.isArray(r.checks) ? r.checks : []).map(c => ({ at: String(c.at || ''), statusCode: num(c.statusCode, 0), durationMs: Math.max(0, num(c.durationMs, 0)) })).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const retained = checks.slice(0, retention);
    return { key: target, target, retainedCount: retained.length, droppedCount: checks.length - retained.length, averageMs: retained.length ? round2(retained.reduce((s, c) => s + c.durationMs, 0) / retained.length) : 0, slowestMs: retained.length ? Math.max(...retained.map(c => c.durationMs)) : 0, latestAt: retained.length ? retained[0].at : null };
  }).sort((a, b) => b.slowestMs - a.slowestMs || String(a.target).localeCompare(String(b.target)));
  const totalRetained = rows.reduce((s, r) => s + r.retainedCount, 0);
  return { rows, count: rows.length, totalRetained, retention, top: rows[0] || null, summary: `Infinity AI retained ${totalRetained} raw health check log(s) with timings.` };
}
/** Idea 54196 — Health-based target sorting. Input records: {target, healthScore}. Inventory sorted so the sickest targets surface first. */
export function sortTargetsByHealth(records = [], scenario = {}) {
  const threshold = num(scenario.threshold, 50);
  const sorted = (Array.isArray(records) ? records : []).map(r => ({ target: String(r.target || 'target'), healthScore: Math.max(0, Math.min(100, num(r.healthScore, 0))) })).sort((a, b) => a.healthScore - b.healthScore || String(a.target).localeCompare(String(b.target)));
  const rows = sorted.map((r, i) => ({ key: r.target, target: r.target, healthScore: r.healthScore, rank: i + 1, band: healthBand(r.healthScore), belowThreshold: r.healthScore < threshold }));
  const belowCount = rows.filter(r => r.belowThreshold).length;
  return { rows, count: rows.length, belowCount, threshold, sickest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI sorted ${rows.length} target(s) by health; ${belowCount} below ${threshold}.` };
}
/** Idea 54197 — Health API for integrations. Input records: {target, status, healthScore, updatedAt}. Current status and history exposed for external dashboards. */
export function exposeHealthApiPayload(records = []) {
  const targets = (Array.isArray(records) ? records : []).map(r => ({ target: String(r.target || 'target'), status: String(r.status || 'unknown'), healthScore: Math.max(0, Math.min(100, num(r.healthScore, 0))), updatedAt: String(r.updatedAt || '') })).sort((a, b) => String(a.target).localeCompare(String(b.target)));
  const payload = { product: 'Infinity AI', version: 'v1', targets, summary: { total: targets.length, down: targets.filter(t => t.status === 'down').length, degraded: targets.filter(t => t.status === 'degraded').length } };
  return { payload, count: targets.length, downCount: payload.summary.down, top: targets[0] || null, summary: `Infinity AI exposes health for ${targets.length} target(s) via the integrations API.` };
}
/** Idea 54198 — User-selected check regions. Input records: {target, selectedRegions}. Users pick which regions probe each target for compliance needs. */
export function selectCheckRegions(records = [], scenario = {}) {
  const minRegions = Math.max(1, num(scenario.minRegions, 2));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const selected = [...new Set((Array.isArray(r.selectedRegions) ? r.selectedRegions : []).map(x => String(x)))].sort();
    return { key: target, target, selectedRegions: selected, selectedCount: selected.length, missingCount: Math.max(0, minRegions - selected.length), status: selected.length >= minRegions ? 'regions-selected' : 'regions-insufficient' };
  }).sort((a, b) => a.selectedCount - b.selectedCount || String(a.target).localeCompare(String(b.target)));
  const insufficientCount = rows.filter(r => r.status === 'regions-insufficient').length;
  return { rows, count: rows.length, insufficientCount, minRegions, top: rows[0] || null, summary: `Infinity AI honours user-selected check regions; ${insufficientCount} target(s) below the ${minRegions}-region minimum.` };
}
/** Idea 54199 — SSO provider checks. Input records: {target, provider, endpointStatus, loginGated}. Identity provider endpoints that gated login depends on. */
export function checkSsoProviders(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const code = num(r.endpointStatus, 0);
    const reachable = code >= 200 && code < 400;
    const loginGated = Boolean(r.loginGated);
    return { key: target, target, provider: String(r.provider || 'sso'), endpointStatus: code, reachable, loginGated, blocking: !reachable && loginGated, status: reachable ? 'sso-healthy' : loginGated ? 'sso-blocking-login' : 'sso-degraded' };
  }).sort((a, b) => Number(b.blocking) - Number(a.blocking) || String(a.target).localeCompare(String(b.target)));
  const blockingCount = rows.filter(r => r.blocking).length;
  return { rows, count: rows.length, blockingCount, top: rows[0] || null, summary: `Infinity AI monitors SSO providers; ${blockingCount} outage(s) currently block gated logins.` };
}
/** Idea 54200 — Mobile API checks. Input records: {target, webStatus, mobileApiStatus, mobileApiLatencyMs}. API hosts backing mobile apps probed separately from web frontends. */
export function checkMobileApiHosts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const webDown = num(r.webStatus, 0) === 0 || num(r.webStatus, 0) >= 500;
    const mobileDown = num(r.mobileApiStatus, 0) === 0 || num(r.mobileApiStatus, 0) >= 500;
    return { key: target, target, webStatus: num(r.webStatus, 0), mobileApiStatus: num(r.mobileApiStatus, 0), mobileApiLatencyMs: Math.max(0, num(r.mobileApiLatencyMs, 0)), webDown, mobileDown, status: mobileDown && webDown ? 'full-outage' : mobileDown ? 'mobile-only-outage' : 'mobile-api-healthy' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || b.mobileApiLatencyMs - a.mobileApiLatencyMs);
  const outageCount = rows.filter(r => r.status !== 'mobile-api-healthy').length;
  return { rows, count: rows.length, outageCount, top: rows[0] || null, summary: `Infinity AI probes mobile API hosts separately; ${outageCount} mobile outage(s) detected.` };
}
