/**
 * wave96ACore.js — Infinity AI · Wave 96A
 * Knowledge forgetting operations, ideas 53801–53820: forgotten knowledge
 * graveyard, knowledge refresh campaigns, cross-stack staleness variance,
 * forgetting fairness checks, stale lesson pruning, knowledge decay
 * dashboards, forgetting notification feeds, time-capsule knowledge
 * snapshots, forgetting rollback windows, stale benchmark baselines,
 * knowledge expiry notifications, forgetting-driven retraining, defense-
 * changelog monitoring, stale cluster dissolution, knowledge provenance
 * tracking, forgetting threshold tuning, expert forgetting reviews,
 * forgetting simulation mode, knowledge revalidation queues, and stale
 * prompt retirement.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE96_A_IDEAS = [
  { id: 53801, title: 'Forgotten Knowledge Graveyard', skip: false },
  { id: 53802, title: 'Knowledge Refresh Campaigns', skip: false },
  { id: 53803, title: 'Cross-Stack Staleness Variance', skip: false },
  { id: 53804, title: 'Forgetting Fairness Checks', skip: false },
  { id: 53805, title: 'Stale Lesson Pruning', skip: false },
  { id: 53806, title: 'Knowledge Decay Dashboards', skip: false },
  { id: 53807, title: 'Forgetting Notification Feeds', skip: false },
  { id: 53808, title: 'Time-Capsule Knowledge Snapshots', skip: false },
  { id: 53809, title: 'Forgetting Rollback Windows', skip: false },
  { id: 53810, title: 'Stale Benchmark Baselines', skip: false },
  { id: 53811, title: 'Knowledge Expiry Notifications', skip: false },
  { id: 53812, title: 'Forgetting-Driven Retraining', skip: false },
  { id: 53813, title: 'Defense-Changelog Monitoring', skip: false },
  { id: 53814, title: 'Stale Cluster Dissolution', skip: false },
  { id: 53815, title: 'Knowledge Provenance Tracking', skip: false },
  { id: 53816, title: 'Forgetting Threshold Tuning', skip: false },
  { id: 53817, title: 'Expert Forgetting Reviews', skip: false },
  { id: 53818, title: 'Forgetting Simulation Mode', skip: false },
  { id: 53819, title: 'Knowledge Revalidation Queues', skip: false },
  { id: 53820, title: 'Stale Prompt Retirement', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.entryId||it.id||it.name||fb);}

/** Idea 53801 — Forgotten Knowledge Graveyard. Input records: {entryId, title, retiredReason, forgottenDaysAgo, restorable}. Graveyard rows oldest-first; reason rollup counts retirements per reason. Browsable archive of retired knowledge with retirement reasons. */
export function browseForgottenKnowledgeGraveyard(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const forgottenDaysAgo = num(r.forgottenDaysAgo ?? r.daysAgo, 0);
    const ancient = forgottenDaysAgo >= 365;
    return { key: entryId, entryId, title: String(r.title || ''), retiredReason: String(r.retiredReason || r.reason || 'unspecified'), forgottenDaysAgo, restorable: Boolean(r.restorable), ancient };
  }).sort((a, b) => b.forgottenDaysAgo - a.forgottenDaysAgo || String(a.key).localeCompare(String(b.key)));
  const byReason = new Map();
  for (const row of rows) byReason.set(row.retiredReason, (byReason.get(row.retiredReason) || 0) + 1);
  const reasonCounts = [...byReason.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || String(a.reason).localeCompare(String(b.reason)));
  const ancientCount = rows.filter(r => r.ancient).length;
  const restorableCount = rows.filter(r => r.restorable).length;
  return { rows, count: rows.length, reasonCounts, ancientCount, restorableCount, top: rows[0] || null, summary: `Infinity AI archived ${rows.length} forgotten knowledge entr(ies) in the graveyard; ${restorableCount} are restorable.` };
}
/** Idea 53802 — Knowledge Refresh Campaigns. Input records: {campaignId, entriesScheduled, entriesRefreshed, startDay, endDay, today}. Completion is refreshed over scheduled; status is scheduled/active/overdue/complete by day window. Periodic campaigns to re-validate aging knowledge against current targets. */
export function planKnowledgeRefreshCampaigns(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const campaignId = String(r.campaignId || r.campaign || 'campaign');
    const entriesScheduled = num(r.entriesScheduled ?? r.scheduled, 0);
    const entriesRefreshed = num(r.entriesRefreshed ?? r.refreshed, 0);
    const startDay = num(r.startDay, 0);
    const endDay = num(r.endDay, 0);
    const today = num(r.today, 0);
    const completionRate = rate(entriesRefreshed, entriesScheduled);
    const status = completionRate >= 1 ? 'complete' : today < startDay ? 'scheduled' : today <= endDay ? 'active' : 'overdue';
    return { key: campaignId, campaignId, entriesScheduled, entriesRefreshed, completionRate, status, remaining: Math.max(0, entriesScheduled - entriesRefreshed) };
  }).sort((a, b) => ({ overdue: 0, active: 1, scheduled: 2, complete: 3 }[a.status] - { overdue: 0, active: 1, scheduled: 2, complete: 3 }[b.status]) || String(a.key).localeCompare(String(b.key)));
  const overdueCount = rows.filter(r => r.status === 'overdue').length;
  const activeCount = rows.filter(r => r.status === 'active').length;
  return { rows, count: rows.length, overdueCount, activeCount, top: rows[0] || null, summary: `Infinity AI planned ${rows.length} knowledge refresh campaign(s); ${overdueCount} are overdue.` };
}
/** Idea 53803 — Cross-Stack Staleness Variance. Input records: {stack, lastVerifiedDays}. Each stack's decay rate is its stale share (unverified past 180 days); variance is the spread across stacks and the most volatile stack is flagged. Recognizes that knowledge goes stale at different rates per stack. */
export function measureCrossStackStalenessVariance(records = []) {
  const groups = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const stack = String(r.stack || 'stack');
    if (!groups.has(stack)) groups.set(stack, []);
    groups.get(stack).push(num(r.lastVerifiedDaysAgo ?? r.lastVerifiedDays ?? r.days, 0));
  }
  const rows = [...groups.entries()].map(([stack, days]) => {
    const staleShare = rate(days.filter(d => d > 180).length, days.length);
    return { key: stack, stack, entryCount: days.length, averageAgeDays: mean(days), staleShare, volatile: staleShare >= 0.6 };
  }).sort((a, b) => b.staleShare - a.staleShare || String(a.key).localeCompare(String(b.key)));
  const avgStaleShare = mean(rows.map(r => r.staleShare));
  const variance = rows.length ? round2(rows.reduce((s, r) => s + (r.staleShare - avgStaleShare) ** 2, 0) / rows.length) : 0;
  return { rows, count: rows.length, variance, averageStaleShare: avgStaleShare, top: rows[0] || null, summary: `Infinity AI measured staleness variance across ${rows.length} stack(s); spread is ${variance}.` };
}
/** Idea 53804 — Forgetting Fairness Checks. Input records: {stack, forgotten, total}. Share of all forgotten knowledge per stack versus its share of the corpus; a stack carrying more than twice its corpus share of forgetting is disproportionate. Ensures forgetting doesn't disproportionately erase knowledge about niche stacks. */
export function auditForgettingFairness(records = []) {
  const list = Array.isArray(records) ? records : [];
  const totalForgotten = list.reduce((s, r) => s + num(r.forgotten, 0), 0);
  const totalCorpus = list.reduce((s, r) => s + num(r.total, 0), 0);
  const rows = list.map(r => {
    const stack = String(r.stack || 'stack');
    const forgotten = num(r.forgotten, 0);
    const total = num(r.total, 0);
    const corpusShare = rate(total, totalCorpus);
    const forgottenShare = rate(forgotten, totalForgotten);
    const parityRatio = corpusShare > 0 ? round2(forgottenShare / corpusShare) : 0;
    return { key: stack, stack, forgotten, total, corpusShare, forgottenShare, parityRatio, disproportionate: parityRatio > 2 };
  }).sort((a, b) => b.parityRatio - a.parityRatio || String(a.key).localeCompare(String(b.key)));
  const disproportionateCount = rows.filter(r => r.disproportionate).length;
  return { rows, count: rows.length, totalForgotten, disproportionateCount, top: rows[0] || null, summary: `Infinity AI checked forgetting fairness across ${rows.length} stack(s); ${disproportionateCount} are over-erased.` };
}
/** Idea 53805 — Stale Lesson Pruning. Input records: {lessonId, outcomeScore, contradictionCount, daysSinceWin}. Severity blends contradiction count with days since the lesson last produced a win; prunable at severity 0.7 or at two or more contradictions. Prunes lessons-learned entries that contradict current evidence. */
export function pruneStaleLessons(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const lessonId = String(r.lessonId || r.lesson || 'lesson');
    const contradictionCount = num(r.contradictionCount ?? r.contradictions, 0);
    const daysSinceWin = num(r.daysSinceWin ?? r.daysSincePositiveOutcome, 0);
    const outcomeScore = round2(clamp01(r.outcomeScore));
    const severity = round2(Math.min(1, contradictionCount / 4 + daysSinceWin / 365));
    return { key: lessonId, lessonId, contradictionCount, daysSinceWin, outcomeScore, severity, prunable: severity >= 0.7 || contradictionCount >= 2 };
  }).sort((a, b) => b.severity - a.severity || String(a.key).localeCompare(String(b.key)));
  const prunableCount = rows.filter(r => r.prunable).length;
  return { rows, count: rows.length, prunableCount, top: rows[0] || null, summary: `Infinity AI reviewed ${rows.length} lesson(s) for pruning; ${prunableCount} are prunable.` };
}
/** Idea 53806 — Knowledge Decay Dashboards. Input records: {entryId, category, confidence, ageDays, halfLifeDays, quarantined, protected}. Decayed confidence uses the half-life curve; states are protected, quarantined, decayed below 0.3, or stable. Visualizes what's decaying, what's quarantined, and what's protected. */
export function buildKnowledgeDecayDashboard(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const halfLifeDays = num(r.halfLifeDays, 90) || 90;
    const initialConfidence = round2(clamp01(r.confidence ?? r.initialConfidence));
    const decayedConfidence = round2(initialConfidence * Math.pow(0.5, num(r.ageDays, 0) / halfLifeDays));
    const state = r.protected === true ? 'protected' : r.quarantined === true ? 'quarantined' : decayedConfidence < 0.3 ? 'decayed' : 'stable';
    return { key: entryId, entryId, category: String(r.category || ''), initialConfidence, decayedConfidence, state };
  }).sort((a, b) => a.decayedConfidence - b.decayedConfidence || String(a.key).localeCompare(String(b.key)));
  const stateCounts = { decayed: 0, quarantined: 0, protected: 0, stable: 0 };
  for (const row of rows) stateCounts[row.state] += 1;
  return { rows, count: rows.length, stateCounts, averageConfidence: mean(rows.map(r => r.decayedConfidence)), top: rows[0] || null, summary: `Infinity AI dashboarded knowledge decay for ${rows.length} entr(ies); ${stateCounts.decayed} have decayed.` };
}
/** Idea 53807 — Forgetting Notification Feeds. Input events: {entryId, contributor, daysUntilForget}. Urgency is critical within 7 days, warning within 30, otherwise gentle; the feed is soonest-first. Notifies relevant researchers before their contributed knowledge is forgotten. */
export function buildForgettingNotificationFeed(events = []) {
  const rows = (Array.isArray(events) ? events : []).map(e => {
    const entryId = String(e.entryId || e.entry || 'entry');
    const daysUntilForget = num(e.daysUntilForget ?? e.days, 0);
    const urgency = daysUntilForget <= 7 ? 'critical' : daysUntilForget <= 30 ? 'warning' : 'gentle';
    return { key: `${entryId}|${String(e.contributor || '')}`, entryId, contributor: String(e.contributor || ''), daysUntilForget, urgency };
  }).sort((a, b) => a.daysUntilForget - b.daysUntilForget || String(a.key).localeCompare(String(b.key)));
  const urgencyCounts = { critical: 0, warning: 0, gentle: 0 };
  for (const row of rows) urgencyCounts[row.urgency] += 1;
  return { rows, count: rows.length, urgencyCounts, top: rows[0] || null, summary: `Infinity AI queued ${rows.length} forgetting notification(s); ${urgencyCounts.critical} are critical.` };
}
/** Idea 53808 — Time-Capsule Knowledge Snapshots. Input records: {snapshotId, capturedDay, entryCount, integrityScore}; today is the reference day. Research ready when integrity is at least 0.8 and the capsule is at most 180 days old. Preserves point-in-time snapshots of the knowledge base for research. */
export function buildTimeCapsuleSnapshots(records = [], today = 0) {
  const now = num(today, 0);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const snapshotId = String(r.snapshotId || r.snapshot || 'snapshot');
    const capturedDay = num(r.capturedDay ?? r.day, 0);
    const integrityScore = round2(clamp01(r.integrityScore ?? r.integrity));
    const ageDays = Math.max(0, now - capturedDay);
    return { key: snapshotId, snapshotId, capturedDay, entryCount: num(r.entryCount, 0), integrityScore, ageDays, researchReady: integrityScore >= 0.8 && ageDays <= 180 };
  }).sort((a, b) => b.capturedDay - a.capturedDay || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.researchReady).length;
  const totalEntries = rows.reduce((s, r) => s + r.entryCount, 0);
  return { rows, count: rows.length, readyCount, totalEntries, top: rows[0] || null, summary: `Infinity AI sealed ${rows.length} time-capsule snapshot(s) holding ${totalEntries} entr(ies); ${readyCount} are research ready.` };
}
/** Idea 53809 — Forgetting Rollback Windows. Input records: {entryId, forgottenDaysAgo, rollbackWindowDays (default 90)}. Restorable while days forgotten stays inside the rollback window; at risk within the final 7 days. Keeps forgotten knowledge restorable for 90 days before permanent deletion. */
export function planForgettingRollbackWindows(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const forgottenDaysAgo = num(r.forgottenDaysAgo ?? r.daysAgo, 0);
    const windowDays = num(r.rollbackWindowDays ?? r.windowDays, 90) || 90;
    const daysRemaining = Math.max(0, round2(windowDays - forgottenDaysAgo));
    const status = forgottenDaysAgo > windowDays ? 'expired' : daysRemaining <= 7 ? 'at-risk' : 'restorable';
    return { key: entryId, entryId, forgottenDaysAgo, windowDays, daysRemaining, status };
  }).sort((a, b) => a.daysRemaining - b.daysRemaining || String(a.key).localeCompare(String(b.key)));
  const restorableCount = rows.filter(r => r.status === 'restorable').length;
  const expiredCount = rows.filter(r => r.status === 'expired').length;
  return { rows, count: rows.length, restorableCount, expiredCount, top: rows[0] || null, summary: `Infinity AI tracked rollback windows for ${rows.length} forgotten entr(ies); ${expiredCount} have expired.` };
}
/** Idea 53810 — Stale Benchmark Baselines. Input records: {baselineId, referenceValue, measuredDaysAgo, driftPct}. Priority rises with baseline age and drift magnitude; refresh is due past 90 days or 10% drift. Updates benchmark baselines as old performance data ages out. */
export function refreshStaleBenchmarkBaselines(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const baselineId = String(r.baselineId || r.baseline || 'baseline');
    const measuredDaysAgo = num(r.measuredDaysAgo ?? r.daysAgo, 0);
    const driftPct = round2(num(r.driftPct ?? r.drift, 0));
    const priority = round2(Math.min(1, measuredDaysAgo / 180) * Math.min(1, Math.abs(driftPct) / 20));
    return { key: baselineId, baselineId, referenceValue: num(r.referenceValue ?? r.value, 0), measuredDaysAgo, driftPct, priority, refreshDue: measuredDaysAgo > 90 || Math.abs(driftPct) > 10 };
  }).sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  const dueCount = rows.filter(r => r.refreshDue).length;
  return { rows, count: rows.length, dueCount, top: rows[0] || null, summary: `Infinity AI reviewed ${rows.length} benchmark baseline(s); ${dueCount} need a refresh.` };
}
/** Idea 53811 — Knowledge Expiry Notifications. Input records: {entryId, owner, expiresInDays, notified}. Expired entries are critical, those within 30 days are warnings; pending alerts are critical or warning entries not yet notified. Warns playbook owners before their content expires. */
export function notifyKnowledgeExpiry(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const expiresInDays = num(r.expiresInDays ?? r.days, 0);
    const alert = expiresInDays < 0 ? 'expired' : expiresInDays <= 30 ? 'warning' : 'ok';
    const notified = Boolean(r.notified);
    return { key: entryId, entryId, owner: String(r.owner || ''), expiresInDays, alert, notified, pending: alert !== 'ok' && !notified };
  }).sort((a, b) => a.expiresInDays - b.expiresInDays || String(a.key).localeCompare(String(b.key)));
  const pendingCount = rows.filter(r => r.pending).length;
  const expiredCount = rows.filter(r => r.alert === 'expired').length;
  return { rows, count: rows.length, pendingCount, expiredCount, top: rows[0] || null, summary: `Infinity AI raised expiry notices for ${rows.length} knowledge entr(ies); ${pendingCount} alerts are still pending.` };
}
/** Idea 53812 — Forgetting-Driven Retraining. Input records: {component, forgottenCount, daysSinceLastTrain}. Retraining is due after 25 forgetting events or 60 idle days; trigger score weights events over idle time. Retrains recommendation models after significant forgetting events. */
export function planForgettingDrivenRetraining(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const component = String(r.component || 'component');
    const forgottenCount = num(r.forgottenCount ?? r.events, 0);
    const daysSinceLastTrain = num(r.daysSinceLastTrain ?? r.days, 0);
    const triggerScore = round2(Math.min(1, forgottenCount / 25) * 0.6 + Math.min(1, daysSinceLastTrain / 60) * 0.4);
    return { key: component, component, forgottenCount, daysSinceLastTrain, triggerScore, due: forgottenCount >= 25 || daysSinceLastTrain >= 60 };
  }).sort((a, b) => b.triggerScore - a.triggerScore || String(a.key).localeCompare(String(b.key)));
  const dueCount = rows.filter(r => r.due).length;
  return { rows, count: rows.length, dueCount, top: rows[0] || null, summary: `Infinity AI evaluated retraining for ${rows.length} component(s); ${dueCount} are due after forgetting events.` };
}
/** Idea 53813 — Defense-Changelog Monitoring. Input records: {component, changeSeverity, entriesAffected, daysSinceChange}. Invalidation risk blends changelog severity with the share of entries the change touches; high at 0.6 or better. Monitors vendor changelogs to anticipate knowledge invalidation. */
export function monitorDefenseChangelogs(records = []) {
  const list = Array.isArray(records) ? records : [];
  const maxAffected = Math.max(0, ...list.map(r => num(r.entriesAffected ?? r.affected, 0)));
  const rows = list.map(r => {
    const component = String(r.component || 'component');
    const severity = round2(clamp01(r.changeSeverity ?? r.severity));
    const entriesAffected = num(r.entriesAffected ?? r.affected, 0);
    const risk = round2(0.7 * severity + 0.3 * (maxAffected ? entriesAffected / maxAffected : 0));
    return { key: component, component, changeSeverity: severity, entriesAffected, daysSinceChange: num(r.daysSinceChange ?? r.days, 0), risk, highRisk: risk >= 0.6 };
  }).sort((a, b) => b.risk - a.risk || String(a.key).localeCompare(String(b.key)));
  const highRiskCount = rows.filter(r => r.highRisk).length;
  return { rows, count: rows.length, highRiskCount, top: rows[0] || null, summary: `Infinity AI monitored defense changelogs for ${rows.length} component(s); ${highRiskCount} are high invalidation risk.` };
}
/** Idea 53814 — Stale Cluster Dissolution. Input records: {clusterId, lastSeenDaysAgo, memberCount}. Clusters unseen for 18 months (540 days) dissolve; those between 12 and 18 months are dormant. Dissolves finding clusters that haven't appeared in 18 months. */
export function dissolveStaleClusters(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const clusterId = String(r.clusterId || r.cluster || 'cluster');
    const lastSeenDaysAgo = num(r.lastSeenDaysAgo ?? r.daysAgo, 0);
    const state = lastSeenDaysAgo >= 540 ? 'dissolve' : lastSeenDaysAgo >= 365 ? 'dormant' : 'active';
    return { key: clusterId, clusterId, lastSeenDaysAgo, memberCount: num(r.memberCount ?? r.members, 0), state };
  }).sort((a, b) => b.lastSeenDaysAgo - a.lastSeenDaysAgo || String(a.key).localeCompare(String(b.key)));
  const dissolveIds = rows.filter(r => r.state === 'dissolve').map(r => r.clusterId);
  return { rows, count: rows.length, dissolveCount: dissolveIds.length, dissolveIds, top: rows[0] || null, summary: `Infinity AI reviewed ${rows.length} finding cluster(s); ${dissolveIds.length} are due for dissolution.` };
}
/** Idea 53815 — Knowledge Provenance Tracking. Input records: {entryId, sourceTrust, chainLength}. Chain score decays the source trust by each hand-off in the provenance chain; verified at 0.7 or better. Tracks where each knowledge item came from to assess staleness risk. */
export function trackKnowledgeProvenance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const sourceTrust = round2(clamp01(r.sourceTrust ?? r.trust));
    const chainLength = num(r.chainLength ?? r.hops, 0);
    const chainScore = round2(sourceTrust / (1 + 0.1 * chainLength));
    const risk = chainLength >= 5 || sourceTrust < 0.4 ? 'high' : chainScore >= 0.7 ? 'low' : 'medium';
    return { key: entryId, entryId, source: String(r.source || ''), sourceTrust, chainLength, chainScore, risk };
  }).sort((a, b) => a.chainScore - b.chainScore || String(a.key).localeCompare(String(b.key)));
  const verifiedCount = rows.filter(r => r.chainScore >= 0.7).length;
  const highRiskCount = rows.filter(r => r.risk === 'high').length;
  return { rows, count: rows.length, verifiedCount, highRiskCount, top: rows[0] || null, summary: `Infinity AI tracked provenance for ${rows.length} knowledge entr(ies); ${verifiedCount} have verified chains.` };
}
/** Idea 53816 — Forgetting Threshold Tuning. Input records: {category, threshold, falseForgetRate, staleRetentionRate}. Balance is one minus both error rates; the recommendation lowers the threshold when stale knowledge is kept too long, raises it when good knowledge is forgotten. Tunes forgetting aggressiveness per knowledge type using outcome data. */
export function tuneForgettingThresholds(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const category = String(r.category || 'category');
    const currentThreshold = round2(clamp01(r.threshold));
    const falseForgetRate = round2(clamp01(r.falseForgetRate));
    const staleRetentionRate = round2(clamp01(r.staleRetentionRate));
    const recommendation = falseForgetRate > 0.15 ? 'raise-threshold' : staleRetentionRate > 0.25 ? 'lower-threshold' : 'keep';
    const recommendedThreshold = recommendation === 'raise-threshold' ? round2(Math.min(1, currentThreshold + 0.05)) : recommendation === 'lower-threshold' ? round2(Math.max(0, currentThreshold - 0.05)) : currentThreshold;
    return { key: category, category, currentThreshold, falseForgetRate, staleRetentionRate, balance: round2(1 - falseForgetRate - staleRetentionRate), recommendation, recommendedThreshold };
  }).sort((a, b) => a.balance - b.balance || String(a.key).localeCompare(String(b.key)));
  const tuneCount = rows.filter(r => r.recommendation !== 'keep').length;
  return { rows, count: rows.length, tuneCount, top: rows[0] || null, summary: `Infinity AI tuned forgetting thresholds for ${rows.length} categor(ies); ${tuneCount} need adjustment.` };
}
/** Idea 53817 — Expert Forgetting Reviews. Input records: {reviewId, entriesReviewed, entriesOverturned, quarter}. Overturn rate is overturned over reviewed; a review needs attention above a 20% overturn rate. Quarterly expert review of what the system chose to forget. */
export function reviewExpertForgettingVerdicts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const reviewId = String(r.reviewId || r.review || 'review');
    const entriesReviewed = num(r.entriesReviewed ?? r.reviewed, 0);
    const entriesOverturned = num(r.entriesOverturned ?? r.overturned, 0);
    const overturnRate = rate(entriesOverturned, entriesReviewed);
    return { key: reviewId, reviewId, quarter: String(r.quarter || ''), entriesReviewed, entriesOverturned, overturnRate, needsAttention: overturnRate > 0.2 };
  }).sort((a, b) => b.overturnRate - a.overturnRate || String(a.key).localeCompare(String(b.key)));
  const attentionCount = rows.filter(r => r.needsAttention).length;
  return { rows, count: rows.length, attentionCount, averageOverturnRate: mean(rows.map(r => r.overturnRate)), top: rows[0] || null, summary: `Infinity AI summarized ${rows.length} expert forgetting review(s); ${attentionCount} need attention.` };
}
/** Idea 53818 — Forgetting Simulation Mode. Input: entries {entryId, ageDays, valueScore, category, protected} plus a policy {maxAgeDays, minValue}. Simulates forgetting without mutating inputs: wouldForget is old, low-value, and unprotected. Previews what would be forgotten under proposed thresholds before applying. */
export function simulateForgettingOutcomes(entries = [], policy = {}) {
  const maxAgeDays = num(policy.maxAgeDays, 365);
  const minValue = num(policy.minValue, 0.3);
  const rows = (Array.isArray(entries) ? entries : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const ageDays = num(r.ageDays, 0);
    const valueScore = round2(clamp01(r.valueScore ?? r.value));
    const isProtected = r.protected === true || String(r.category || '').toLowerCase() === 'compliance';
    const wouldForget = !isProtected && ageDays > maxAgeDays && valueScore < minValue;
    return { key: entryId, entryId, category: String(r.category || ''), ageDays, valueScore, protected: isProtected, wouldForget };
  }).sort((a, b) => Number(b.wouldForget) - Number(a.wouldForget) || b.ageDays - a.ageDays || String(a.key).localeCompare(String(b.key)));
  const wouldForgetIds = rows.filter(r => r.wouldForget).map(r => r.entryId);
  return { rows, count: rows.length, wouldForgetCount: wouldForgetIds.length, wouldForgetIds, simulated: true, applied: false, top: rows[0] || null, summary: `Infinity AI simulated forgetting over ${rows.length} entr(ies); ${wouldForgetIds.length} would be forgotten (nothing applied).` };
}
/** Idea 53819 — Knowledge Revalidation Queues. Input records: {entryId, ageDays, criticality, requiresAuth}. Priority blends age with criticality; queued at 0.5 or higher, auth-gated entries flagged for scoped runs. Queues aging knowledge for re-validation hunts. */
export function buildKnowledgeRevalidationQueue(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const ageDays = num(r.ageDays, 0);
    const criticality = round2(clamp01(r.criticality));
    const priority = round2(0.6 * Math.min(1, ageDays / 365) + 0.4 * criticality);
    return { key: entryId, entryId, ageDays, criticality, priority, queued: priority >= 0.5, requiresAuth: Boolean(r.requiresAuth), estimatedHours: round2(0.5 + priority) };
  }).sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  const queued = rows.filter(r => r.queued);
  return { rows, count: rows.length, queuedCount: queued.length, queuedIds: queued.map(r => r.entryId), totalEstimatedHours: round2(queued.reduce((s, r) => s + r.estimatedHours, 0)), top: rows[0] || null, summary: `Infinity AI queued ${queued.length} of ${rows.length} knowledge entr(ies) for re-validation.` };
}
/** Idea 53820 — Stale Prompt Retirement. Input records: {promptId, accuracyBefore, accuracyNow, usesLast30d}. Decline is the relative accuracy loss; retire when decline exceeds 50% or the prompt is unused and past its prime. Retires prompt templates whose performance decayed beyond recovery. */
export function retireStalePrompts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || r.prompt || 'prompt');
    const accuracyBefore = round2(clamp01(r.accuracyBefore ?? r.before));
    const accuracyNow = round2(clamp01(r.accuracyNow ?? r.now));
    const usesLast30d = num(r.usesLast30d ?? r.uses, 0);
    const decline = accuracyBefore > 0 ? round2((accuracyBefore - accuracyNow) / accuracyBefore) : 0;
    return { key: promptId, promptId, accuracyBefore, accuracyNow, usesLast30d, decline, retire: decline > 0.5 || (usesLast30d === 0 && decline > 0.25) };
  }).sort((a, b) => b.decline - a.decline || String(a.key).localeCompare(String(b.key)));
  const retireIds = rows.filter(r => r.retire).map(r => r.promptId);
  return { rows, count: rows.length, retireCount: retireIds.length, retireIds, top: rows[0] || null, summary: `Infinity AI reviewed ${rows.length} prompt template(s) for retirement; ${retireIds.length} are retired.` };
}
