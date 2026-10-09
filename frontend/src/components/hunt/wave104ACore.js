/**
 * wave104ACore.js — Infinity AI · Wave 104A
 * Target dashboard views and widgets, ideas 54121–54140: per-team and
 * per-client dashboards, customizable columns, density modes, favicons,
 * uptime and certificate badges, owner avatars, hunt timestamps, bulk
 * actions, dashboard search, sorting, leaderboards, compliance and
 * coverage widgets, change digests, verification and onboarding status,
 * archive browsing, and CSV export.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE104_A_IDEAS = [
  { id: 54121, title: 'Per-team dashboards', skip: false },
  { id: 54122, title: 'Per-client dashboards', skip: false },
  { id: 54123, title: 'Customizable columns', skip: false },
  { id: 54124, title: 'Density toggle (targets)', skip: false },
  { id: 54125, title: 'Target favicons and screenshots', skip: false },
  { id: 54126, title: 'Uptime badges', skip: false },
  { id: 54127, title: 'Certificate expiry badges', skip: false },
  { id: 54128, title: 'Owner avatars', skip: false },
  { id: 54129, title: 'Last-hunt timestamps', skip: false },
  { id: 54130, title: 'Bulk action toolbar', skip: false },
  { id: 54131, title: 'Dashboard search (targets)', skip: false },
  { id: 54132, title: 'Sort options', skip: false },
  { id: 54133, title: 'Score leaderboard', skip: false },
  { id: 54134, title: 'Program compliance widget', skip: false },
  { id: 54135, title: 'Scope coverage widget', skip: false },
  { id: 54136, title: 'Change digest widget', skip: false },
  { id: 54137, title: 'Verification status widget', skip: false },
  { id: 54138, title: 'Onboarding progress widget', skip: false },
  { id: 54139, title: 'Archive browser', skip: false },
  { id: 54140, title: 'Export dashboard to CSV', skip: false },
];

function round2(v) { return Math.round(Number(v || 0) * 100) / 100; }
function num(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f; }
function rate(p, w) { return w ? round2(p / w) : 0; }
function riskBand(score) { const s = num(score, 0); return s >= 80 ? 'critical' : s >= 60 ? 'high' : s >= 35 ? 'medium' : 'low'; }
function bandOfScore(score) { const s = num(score, 0); return s >= 90 ? 'top-10%' : s >= 75 ? 'top-25%' : s >= 50 ? 'top-50%' : 'bottom-half'; }

/** Idea 54121 — Per-team dashboards. Input records: {target, team, riskScore, openFindings}. Each team's dashboard scopes to its own targets with a team-level rollup. */
export function buildTeamDashboards(records = []) {
  const byTeam = new Map();
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const team = String(r.team || 'unassigned');
    const riskScore = Math.max(0, Math.min(100, num(r.riskScore, 0)));
    const cur = byTeam.get(team) || { team, targets: [], findings: 0, risks: [] };
    cur.targets.push(target);
    cur.findings += Math.max(0, num(r.openFindings, 0));
    cur.risks.push(riskScore);
    byTeam.set(team, cur);
    return { key: `${team}|${target}`, target, team, riskScore, band: riskBand(riskScore) };
  }).sort((a, b) => String(a.team).localeCompare(String(b.team)) || b.riskScore - a.riskScore);
  const teams = [...byTeam.values()].map(t => ({ team: t.team, count: t.targets.length, targets: [...t.targets].sort(), openFindings: t.findings, averageRisk: t.risks.length ? round2(t.risks.reduce((s, v) => s + v, 0) / t.risks.length) : 0 })).sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
  const topTeam = teams[0] || null;
  return { rows, count: rows.length, teams, teamCount: teams.length, topTeam, top: rows[0] || null, summary: `Infinity AI scoped ${rows.length} target(s) across ${teams.length} team dashboard(s).` };
}
/** Idea 54122 — Per-client dashboards. Input records: {target, client, clientSafe, publicSummary}. Client-ready views hide anything not cleared for external eyes. */
export function buildClientDashboards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const client = String(r.client || 'direct');
    const clientSafe = r.clientSafe === undefined ? true : Boolean(r.clientSafe);
    const publicSummary = String(r.publicSummary || '');
    const hasSummary = publicSummary.trim().length >= 5;
    const shareable = clientSafe && hasSummary;
    return { key: `${client}|${target}`, target, client, clientSafe, hasSummary, shareable, status: shareable ? 'client-view-ready' : clientSafe ? 'client-needs-summary' : 'client-not-shareable' };
  }).sort((a, b) => String(a.client).localeCompare(String(b.client)) || Number(b.shareable) - Number(a.shareable));
  const clients = [...new Set(rows.map(r => r.client))].sort();
  const shareableCount = rows.filter(r => r.shareable).length;
  return { rows, count: rows.length, clients, clientCount: clients.length, shareableCount, top: rows.find(r => r.shareable) || rows[0] || null, summary: `Infinity AI prepared client-ready dashboards for ${shareableCount} of ${rows.length} target(s).` };
}
/** Idea 54123 — Customizable columns. Input records: {columns: [{field, custom}], available}: defined display names, visible sets, and custom fields. */
export function manageCustomColumns(scenario = {}) {
  const columns = Array.isArray(scenario.columns) ? scenario.columns.map(c => ({ field: String(c.field || 'field'), label: String(c.label || c.field || 'field'), visible: c.visible !== false, custom: Boolean(c.custom), order: Math.max(0, num(c.order, 0)) })) : [];
  const available = Array.isArray(scenario.available) ? [...new Set(scenario.available.map(a => String(a)))] : [];
  const hidden = columns.filter(c => !c.visible).map(c => c.field);
  const customCount = columns.filter(c => c.custom).length;
  const visibleInOrder = [...columns].filter(c => c.visible).sort((a, b) => a.order - b.order).map(c => c.field);
  const addable = available.filter(a => !columns.some(c => c.field === a));
  const status = addable.length ? 'columns-addable' : columns.length ? 'columns-complete' : 'columns-empty';
  return { columns, count: columns.length, hiddenCount: hidden.length, hidden, customCount, visibleCount: columns.length - hidden.length, visibleInOrder, addable, status, summary: `Infinity AI manages ${columns.length} dashboard column(s); ${addable.length} more can be added.` };
}
/** Idea 54124 — Density toggle (targets). Input records: {target, previousDensity, requestedDensity}. The chosen density sets row height for the whole list. */
export function applyDensityToggle(records = [], scenario = {}) {
  const density = String(scenario.density || 'comfortable').toLowerCase() === 'compact' ? 'compact' : 'comfortable';
  const rowHeight = density === 'compact' ? 28 : 44;
  const rows = (Array.isArray(records) ? records : []).map(r => ({ key: String(r.target || 'target'), target: String(r.target || 'target'), density, rowHeight, mode: density === 'compact' ? 'density-compact' : 'density-comfortable' })).sort((a, b) => String(a.target).localeCompare(String(b.target)));
  return { rows, count: rows.length, density, rowHeight, top: rows[0] || null, summary: `Infinity AI renders ${rows.length} target row(s) in ${density} density at ${rowHeight}px each.` };
}
/** Idea 54125 — Target favicons and screenshots. Input records: {target, faviconUrl, screenshotCachedAt}. Visual identities make long target lists scannable in a glance. */
export function buildTargetVisuals(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const faviconUrl = String(r.faviconUrl || '');
    const screenshotDaysAgo = Math.max(0, num(r.screenshotDaysAgo, 999));
    const hasFavicon = faviconUrl.length >= 10 && faviconUrl.startsWith('http');
    const hasScreenshot = screenshotDaysAgo <= 7;
    return { key: target, target, faviconUrl, hasFavicon, screenshotDaysAgo, hasScreenshot, scannable: hasFavicon && hasScreenshot, status: hasFavicon && hasScreenshot ? 'visual-ready' : hasFavicon ? 'favicon-only' : hasScreenshot ? 'screenshot-only' : 'visual-missing' };
  }).sort((a, b) => Number(b.scannable) - Number(a.scannable) || a.screenshotDaysAgo - b.screenshotDaysAgo);
  const readyCount = rows.filter(r => r.scannable).length;
  return { rows, count: rows.length, readyCount, faviconCount: rows.filter(r => r.hasFavicon).length, screenshotCount: rows.filter(r => r.hasScreenshot).length, top: rows[0] || null, summary: `Infinity AI found visual identities for ${readyCount} of ${rows.length} target(s).` };
}
/** Idea 54126 — Uptime badges. Input records: {target, uptimePercent30d}. Badges carry the raw number so status meetings never need the dashboard open. */
export function buildUptimeBadges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const percent = Math.max(0, Math.min(100, num(r.uptimePercent30d, 0)));
    const band = percent >= 99.9 ? 'badge-platinum' : percent >= 99.5 ? 'badge-gold' : percent >= 99 ? 'badge-silver' : 'badge-bronze';
    return { key: target, target, percent, band, status: percent >= 99.9 ? 'uptime-excellent' : percent >= 99 ? 'uptime-good' : 'uptime-poor', label: `${percent}% uptime 30d` };
  }).sort((a, b) => b.percent - a.percent || String(a.key).localeCompare(String(b.key)));
  const excellentCount = rows.filter(r => r.status === 'uptime-excellent').length;
  return { rows, count: rows.length, excellentCount, top: rows[0] || null, summary: `Infinity AI badged ${excellentCount} of ${rows.length} target(s) as excellent uptime.` };
}
/** Idea 54127 — Certificate expiry badges. Input records: {target, daysUntilCertExpiry}. Cards warn directly when TLS expiry lands within 30 days. */
export function buildCertificateExpiryBadges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const days = num(r.daysUntilCertExpiry, 9999);
    return { key: target, target, daysUntilCertExpiry: days, warning: days <= 30, tone: days < 0 ? 'badge-expired' : days <= 30 ? 'badge-warning' : 'badge-safe', status: days < 0 ? 'cert-expired' : days <= 30 ? 'cert-expiring' : 'cert-safe' };
  }).sort((a, b) => a.daysUntilCertExpiry - b.daysUntilCertExpiry || String(a.key).localeCompare(String(b.key)));
  const warningCount = rows.filter(r => r.warning).length;
  const soonest = rows[0] || null;
  return { rows, count: rows.length, warningCount, expiredCount: rows.filter(r => r.status === 'cert-expired').length, soonest, top: soonest, summary: `Infinity AI flagged ${warningCount} target(s) with certificates expiring within 30 days.` };
}
/** Idea 54128 — Owner avatars. Input records: {owner, photoAvailable}. Owners are identified by photo first, with deterministic initials fallback. */
export function buildOwnerAvatars(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const owner = String(r.owner || 'unassigned').trim();
    const initials = owner.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??';
    const photoAvailable = Boolean(r.photoAvailable);
    return { key: owner, owner, initials, photoAvailable, label: photoAvailable ? `photo:${initials}` : `initials:${initials}`, status: photoAvailable ? 'avatar-photo' : 'avatar-initials' };
  }).sort((a, b) => Number(b.photoAvailable) - Number(a.photoAvailable) || String(a.key).localeCompare(String(b.key)));
  const photoCount = rows.filter(r => r.photoAvailable).length;
  return { rows, count: rows.length, photoCount, initialsCount: rows.length - photoCount, top: rows[0] || null, summary: `Infinity AI shows photos for ${photoCount} of ${rows.length} target owner(s).` };
}
/** Idea 54129 — Last-hunt timestamps. Input records: {target, daysSinceLastHunt, cadenceDays}. Relative labels flag targets hunted past their cadence. */
export function buildLastHuntTimestamps(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const days = Math.max(0, num(r.daysSinceLastHunt, 0));
    const cadence = Math.max(1, num(r.cadenceDays, 14));
    const overdue = days > cadence;
    return { key: target, target, daysSinceLastHunt: days, cadenceDays: cadence, overdue, label: days === 0 ? 'hunted today' : days === 1 ? 'hunted 1d ago' : `hunted ${days}d ago`, tone: overdue ? 'tone-overdue' : days === 0 ? 'tone-fresh' : 'tone-aging', status: overdue ? 'hunt-overdue' : 'hunt-current' };
  }).sort((a, b) => b.daysSinceLastHunt - a.daysSinceLastHunt || String(a.key).localeCompare(String(b.key)));
  const overdueCount = rows.filter(r => r.overdue).length;
  return { rows, count: rows.length, overdueCount, top: rows[0] || null, summary: `Infinity AI flagged ${overdueCount} of ${rows.length} target(s) past their hunt cadence.` };
}
/** Idea 54130 — Bulk action toolbar. Input records: {target, selected, actionToApply}. Multi-select actions hit every selected target in one pass. */
export function buildBulkActionToolbar(records = [], scenario = {}) {
  const action = String(scenario.action || 'tag');
  const selectedIds = (Array.isArray(records) ? records : []).filter(r => r.selected).map(r => String(r.target || 'target'));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const selected = Boolean(r.selected);
    return { key: target, target, selected, applied: selected, status: selected ? `bulk-${action}-ready` : 'bulk-idle' };
  });
  return { rows, count: rows.length, selectedCount: selectedIds.length, selectedIds, action, actionTargets: selectedIds, ready: selectedIds.length > 0, status: selectedIds.length ? 'toolbar-ready' : 'toolbar-idle', top: rows[0] || null, summary: `Infinity AI queued the ${action} action for ${selectedIds.length} selected target(s).` };
}
/** Idea 54131 — Dashboard search (targets). Input records: {target, domain, tags, notes, query}. Typing narrows the inventory across every visible field. */
export function applyDashboardSearchTargets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const query = String(r.query || '').trim().toLowerCase();
    const fields = [String(r.target || '').toLowerCase(), String(r.domain || '').toLowerCase(), (Array.isArray(r.tags) ? r.tags.join(' ') : '').toLowerCase(), String(r.notes || '').toLowerCase()];
    const hitCount = query ? fields.filter(f => f.includes(query)).length : 0;
    const matched = query.length > 0 && hitCount > 0;
    return { key: String(r.target || 'target'), target: String(r.target || 'target'), query, hitCount, matched, searchableFields: hitCount, status: matched ? 'search-hit' : 'search-miss' };
  }).sort((a, b) => b.hitCount - a.hitCount || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, top: rows.find(r => r.matched) || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} dashboard search(es).` };
}
/** Idea 54132 — Sort options. Input records: {targets: [...], sortKey, order}. One tap restacks the inventory on any field the meeting needs. */
export function buildTargetSortOptions(scenario = {}) {
  const targets = (Array.isArray(scenario.targets) ? scenario.targets : []).map(t => ({ target: String(t.name || t.target || 'target'), riskScore: num(t.riskScore, 0), health: String(t.health || ''), lastHuntedDaysAgo: num(t.lastHuntedDaysAgo, 999), dateAdded: String(t.dateAdded || ''), findings: num(t.findings, 0), custom: t.custom && typeof t.custom === 'object' ? t.custom : {} }));
  const sortKey = String(scenario.sortKey || 'risk');
  const order = String(scenario.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const valueOf = (t, key) => key === 'risk' ? t.riskScore : key === 'last-hunt' ? t.lastHuntedDaysAgo : key === 'findings' ? t.findings : key === 'health' ? t.health : key === 'date-added' ? t.dateAdded : key === 'name' ? t.target : (t.custom[key] ?? t.riskScore);
  const sorted = [...targets].sort((a, b) => {
    const va = valueOf(a, sortKey); const vb = valueOf(b, sortKey);
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return (order === 'desc' ? -cmp : cmp) || a.target.localeCompare(b.target);
  });
  return { rows: sorted.map(t => ({ key: t.target, ...t })), count: sorted.length, sortKey, order, sortedNames: sorted.map(t => t.target), top: sorted[0] ? sorted[0].target : null, summary: `Infinity AI sorted ${sorted.length} target(s) by ${sortKey} (${order}).` };
}
/** Idea 54133 — Score leaderboard. Input records: {target, riskScore}. Percentile bands turn a wall of scores into a hit list. */
export function buildScoreLeaderboard(records = []) {
  const sorted = (Array.isArray(records) ? records : []).map(r => ({ target: String(r.target || 'target'), riskScore: Math.max(0, Math.min(100, num(r.riskScore, 0))) })).sort((a, b) => b.riskScore - a.riskScore || a.target.localeCompare(b.target));
  const rows = sorted.map((r, i) => ({ key: r.target, ...r, rank: i + 1, band: bandOfScore(r.riskScore), percentile: sorted.length > 1 ? Math.round((1 - i / (sorted.length - 1)) * 100) : 100, label: `#${i + 1} ${r.target} ${r.riskScore}` }));
  return { rows, count: rows.length, bands: rows.reduce((m, r) => { m[r.band] = (m[r.band] || 0) + 1; return m; }, {}), top: rows[0] || null, summary: `Infinity AI ranked ${rows.length} target(s) on the risk leaderboard.` };
}
/** Idea 54134 — Program compliance widget. Input records: {target, programScopeHosts, targetInScopeHosts}. Scope drift shows before a program complains. */
export function buildProgramComplianceWidget(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const programHosts = (Array.isArray(r.programScopeHosts) ? r.programScopeHosts : []).map(h => String(h).toLowerCase());
    const targetHosts = (Array.isArray(r.targetInScopeHosts) ? r.targetInScopeHosts : []).map(h => String(h).toLowerCase());
    const outOfScope = targetHosts.filter(h => !programHosts.includes(h));
    const missing = programHosts.filter(h => !targetHosts.includes(h));
    const driftRate = programHosts.length ? rate(outOfScope.length, programHosts.length) : 0;
    return { key: target, target, outOfScope, outOfScopeCount: outOfScope.length, missingCount: missing.length, driftRate, status: outOfScope.length ? 'scope-drift' : missing.length ? 'scope-undercovered' : 'scope-aligned' };
  }).sort((a, b) => b.outOfScopeCount - a.outOfScopeCount || String(a.key).localeCompare(String(b.key)));
  const driftCount = rows.filter(r => r.status === 'scope-drift').length;
  return { rows, count: rows.length, driftCount, alignedCount: rows.filter(r => r.status === 'scope-aligned').length, top: rows[0] || null, summary: `Infinity AI checked program scope alignment for ${rows.length} target(s); ${driftCount} drift.` };
}
/** Idea 54135 — Scope coverage widget. Input records: {target, totalAssets, coveredAssets}. Portfolio-wide coverage per target, at a glance. */
export function measureWidgetCoverage(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const total = Math.max(0, num(r.totalAssets, 0));
    const covered = Math.min(total, Math.max(0, num(r.coveredAssets, 0)));
    return { key: target, target, totalAssets: total, coveredAssets: covered, percent: rate(covered, total), gap: total - covered, band: total === 0 ? 'no-inventory' : rate(covered, total) >= 0.99 ? 'widget-full' : rate(covered, total) >= 0.8 ? 'widget-strong' : 'widget-thin' };
  }).sort((a, b) => b.percent - a.percent || String(a.key).localeCompare(String(b.key)));
  const averagePercent = rows.length ? round2(rows.reduce((s, r) => s + r.percent, 0) / rows.length) : 0;
  return { rows, count: rows.length, averagePercent, top: rows[0] || null, summary: `Infinity AI averaged portfolio scope coverage of ${averagePercent} across ${rows.length} target(s).` };
}
/** Idea 54136 — Change digest widget. Input records: {target, subdomainChanges, endpointChanges, certChanges}. A weekly digest turns inventory churn into one readable card. */
export function buildChangeDigest(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const subdomainChanges = Math.max(0, num(r.subdomainChanges, 0));
    const endpointChanges = Math.max(0, num(r.endpointChanges, 0));
    const certChanges = Math.max(0, num(r.certChanges, 0));
    const total = subdomainChanges + endpointChanges + certChanges;
    return { key: target, target, subdomainChanges, endpointChanges, certChanges, total, headline: `${target}: ${total} change(s) this week (${subdomainChanges} subdomains, ${endpointChanges} endpoints, ${certChanges} certificates)`, busy: total >= 3 };
  }).sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));
  const totalChanges = rows.reduce((s, r) => s + r.total, 0);
  return { rows, count: rows.length, totalChanges, activeCount: rows.filter(r => r.busy).length, top: rows[0] || null, summary: `Infinity AI digested ${totalChanges} change(s) across ${rows.length} target(s) this week.` };
}
/** Idea 54137 — Verification status widget. Input records: {target, verificationStatus}. Verified, pending, expired, and failed, with next actions. */
export function buildVerificationWidget(records = []) {
  const statuses = ['verified', 'pending', 'expired', 'failed'];
  const normalized = (Array.isArray(records) ? records : []).map(r => {
    const status = statuses.includes(String(r.verificationStatus || '').toLowerCase()) ? String(r.verificationStatus).toLowerCase() : 'pending';
    return { key: String(r.target || 'target'), target: String(r.target || 'target'), status, action: status === 'verified' ? 'none' : status === 'expired' ? 're-verify' : status === 'failed' ? 'investigate' : 'verify-now' };
  });
  return { rows: normalized, count: normalized.length, verifiedCount: normalized.filter(r => r.status === 'verified').length, pendingCount: normalized.filter(r => r.status === 'pending').length, expiredCount: normalized.filter(r => r.status === 'expired').length, failedCount: normalized.filter(r => r.status === 'failed').length, verifiedPercent: rate(normalized.filter(r => r.status === 'verified').length, normalized.length), top: normalized[0] || null, summary: `Infinity AI tracks verification for ${normalized.length} target(s); ${rate(normalized.filter(r => r.status === 'verified').length, normalized.length)} verified.` };
}
/** Idea 54138 — Onboarding progress widget. Input records: {target, stage}. Stages flow from added to actively hunting. */
export function buildOnboardingWidget(records = []) {
  const stages = ['added', 'scope-approved', 'verified', 'first-hunt', 'active'];
  const normalized = (Array.isArray(records) ? records : []).map(r => {
    const stage = stages.includes(String(r.stage || '').toLowerCase()) ? String(r.stage).toLowerCase() : 'added';
    return { key: String(r.target || 'target'), target: String(r.target || 'target'), stage, stageNumber: stage[0].toUpperCase() + stage.slice(1).replace(/-/g, ' '), position: stages.indexOf(stage) + 1, percent: round2(((stages.indexOf(stage) + 1) / stages.length)) };
  });
  const stageCounts = Object.fromEntries(stages.map(s => [s, normalized.filter(r => r.stage === s).length]));
  const activeCount = normalized.filter(r => r.stage === 'active').length;
  return { rows: normalized, count: normalized.length, activeCount, stageCounts, newest: normalized[0] || null, top: normalized[0] || null, summary: `Infinity AI tracks ${activeCount} of ${normalized.length} target(s) through onboarding.` };
}
/** Idea 54139 — Archive browser. Input records: {target, archived, reason}. Archived targets rest out of the way until restored or purged. */
export function browseArchive(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const archived = Boolean(r.archived);
    return { key: target, target, archived, reason: String(r.reason || ''), canRestore: archived, canDelete: archived, status: archived ? 'archived-record' : 'active-record' };
  }).sort((a, b) => Number(b.archived) - Number(a.archived) || String(a.key).localeCompare(String(b.key)));
  const archivedCount = rows.filter(r => r.archived).length;
  const restorables = rows.filter(r => r.canRestore).map(r => r.target);
  return { rows, count: rows.length, archivedCount, restorables, top: rows[0] || null, summary: `Infinity AI holds ${archivedCount} archived target(s) ready to restore or purge.` };
}
/** Idea 54140 — Export dashboard to CSV. Input records: {targets, columns}. The visible, filtered list becomes a file for reporting. */
export function exportDashboardCsv(scenario = {}) {
  const targets = (Array.isArray(scenario.targets) ? scenario.targets : []).map(t => ({ target: String(t.target || 'target'), team: String(t.team || ''), client: String(t.client || ''), riskScore: num(t.riskScore, 0), health: String(t.health || ''), uptimePercent30d: num(t.uptimePercent30d, 0), owner: String(t.owner || '') }));
  const columns = Array.isArray(scenario.columns) ? [...new Set(scenario.columns.map(c => String(c)))] : ['target'];
  const safe = v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [columns.join(',')].concat(targets.map(t => columns.map(c => safe(t[c] === undefined ? '' : t[c])).join(',')));
  const csv = lines.join('\n');
  return { csv, rowCount: targets.length, columnCount: columns.length, columns, content: csv, charCount: csv.length, top: targets[0] || null, summary: `Infinity AI exported ${targets.length} target(s) across ${columns.length} column(s) to CSV.` };
}
