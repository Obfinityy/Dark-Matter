/**
 * wave95BCores.js — Infinity AI · Wave 95B
 * Benchmarks, learning, and knowledge forgetting, ideas 53781–53800: strategy
 * recommendation benchmarks, recommendation continuous learning, strategy
 * recommendation transparency reports, recommendation-driven hunt templates,
 * payload freshness scoring, stale knowledge detection, automatic payload
 * quarantine, knowledge half-life modeling, patch-driven invalidation,
 * version-aware knowledge expiry, forgetting audit trails, selective
 * forgetting controls, forgetting impact assessments, resurrection protocols,
 * stale playbook detection, knowledge confidence decay, seasonal knowledge
 * cycling, defense-evolution tracking, forgetting vs archiving policies, and
 * human forgetting overrides.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE95_B_IDEAS = [
  { id: 53781, title: 'Strategy Recommendation Benchmarks', skip: false },
  { id: 53782, title: 'Recommendation Continuous Learning', skip: false },
  { id: 53783, title: 'Strategy Recommendation Transparency Reports', skip: false },
  { id: 53784, title: 'Recommendation-Driven Hunt Templates', skip: false },
  { id: 53785, title: 'Payload Freshness Scoring', skip: false },
  { id: 53786, title: 'Stale Knowledge Detection', skip: false },
  { id: 53787, title: 'Automatic Payload Quarantine', skip: false },
  { id: 53788, title: 'Knowledge Half-Life Modeling', skip: false },
  { id: 53789, title: 'Patch-Driven Invalidation', skip: false },
  { id: 53790, title: 'Version-Aware Knowledge Expiry', skip: false },
  { id: 53791, title: 'Forgetting Audit Trails', skip: false },
  { id: 53792, title: 'Selective Forgetting Controls', skip: false },
  { id: 53793, title: 'Forgetting Impact Assessments', skip: false },
  { id: 53794, title: 'Resurrection Protocols', skip: false },
  { id: 53795, title: 'Stale Playbook Detection', skip: false },
  { id: 53796, title: 'Knowledge Confidence Decay', skip: false },
  { id: 53797, title: 'Seasonal Knowledge Cycling', skip: false },
  { id: 53798, title: 'Defense-Evolution Tracking', skip: false },
  { id: 53799, title: 'Forgetting vs Archiving Policies', skip: false },
  { id: 53800, title: 'Human Forgetting Overrides', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.strategy||it.entryId||it.payloadId||it.id||it.name||fb);}
function parseVer(v){return String(v||'0.0.0').split('.').map(p=>num(p,0));}
function cmpVer(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}

/** Idea 53781 — Strategy Recommendation Benchmarks. Input records: {strategy, benchmarkCases, passed, latencyMs}. Pass rate over the benchmark suite, ranked; benchmarked at 0.8 or better. Benchmarks recommendation quality against a fixed case suite. */
export function benchmarkStrategyRecommendations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const benchmarkCases = num(r.benchmarkCases ?? r.cases, 0);
    const passed = num(r.passed, 0);
    const passRate = rate(passed, benchmarkCases);
    return { key: strategy, strategy, benchmarkCases, passed, latencyMs: num(r.latencyMs, 0), passRate, benchmarked: passRate >= 0.8 };
  }).sort((a, b) => b.passRate - a.passRate || a.latencyMs - b.latencyMs || String(a.key).localeCompare(String(b.key)));
  rows.forEach((row, i) => { row.rank = i + 1; });
  const benchmarkedCount = rows.filter(r => r.benchmarked).length;
  return { rows, count: rows.length, benchmarkedCount, top: rows[0] || null, summary: `Infinity AI benchmarked ${rows.length} strategy record(s); ${benchmarkedCount} meet the benchmark bar.` };
}
/** Idea 53782 — Recommendation Continuous Learning. Input records: {strategy, feedbackEvents, modelUpdates, winRateBefore, winRateAfter}. Improvement is the win-rate delta after feedback-driven updates; learning when updates land and outcomes improve. Folds live feedback back into the recommendation engine. */
export function learnFromRecommendationFeedback(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const feedbackEvents = num(r.feedbackEvents ?? r.events, 0);
    const updatesApplied = num(r.modelUpdates ?? r.updatesApplied ?? r.updates, 0);
    const updateRate = rate(updatesApplied, feedbackEvents);
    const improvement = round2(clamp01(r.winRateAfter) - clamp01(r.winRateBefore));
    return { key: strategy, strategy, feedbackEvents, updatesApplied, updateRate, improvement, learning: updatesApplied > 0 && improvement > 0 };
  }).sort((a, b) => b.improvement - a.improvement || String(a.key).localeCompare(String(b.key)));
  const learningCount = rows.filter(r => r.learning).length;
  return { rows, count: rows.length, learningCount, top: rows[0] || null, summary: `Infinity AI ran continuous learning for ${rows.length} strategy record(s); ${learningCount} improved from feedback.` };
}
/** Idea 53783 — Strategy Recommendation Transparency Reports. Input records: {reportId, factorsDisclosed, factorsTotal, dataSources}. Transparency is disclosed factors over total factors; transparent at 0.8 or better. Publishes what drives recommendations and which data feeds them. */
export function reportStrategyRecommendationTransparency(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const reportId = String(r.reportId || r.report || 'report');
    const factorsDisclosed = num(r.factorsDisclosed ?? r.disclosed, 0);
    const factorsTotal = num(r.factorsTotal ?? r.total, 0);
    const dataSources = (Array.isArray(r.dataSources) ? r.dataSources : []).map(s => String(s));
    const transparency = rate(factorsDisclosed, factorsTotal);
    return { key: reportId, reportId, factorsDisclosed, factorsTotal, dataSourceCount: dataSources.length, transparency, transparent: transparency >= 0.8 };
  }).sort((a, b) => b.transparency - a.transparency || String(a.key).localeCompare(String(b.key)));
  const transparentCount = rows.filter(r => r.transparent).length;
  return { rows, count: rows.length, transparentCount, top: rows[0] || null, summary: `Infinity AI published transparency reports for ${rows.length} report(s); ${transparentCount} are fully transparent.` };
}
/** Idea 53784 — Recommendation-Driven Hunt Templates. Input records: {templateId, sourceStrategies, steps}. A template is ready when it carries at least two steps derived from at least one recommended strategy. Turns winning recommendations into reusable hunt templates. */
export function buildRecommendationHuntTemplates(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const templateId = String(r.templateId || r.template || 'template');
    const sourceStrategies = (Array.isArray(r.sourceStrategies) ? r.sourceStrategies : []).map(s => String(s));
    const steps = (Array.isArray(r.steps) ? r.steps : []).map(s => String(s));
    return { key: templateId, templateId, sourceCount: sourceStrategies.length, stepCount: steps.length, ready: steps.length >= 2 && sourceStrategies.length >= 1 };
  }).sort((a, b) => b.stepCount - a.stepCount || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, top: rows[0] || null, summary: `Infinity AI built recommendation-driven hunt templates for ${rows.length} template(s); ${readyCount} are ready.` };
}
/** Idea 53785 — Payload Freshness Scoring. Input records: {payloadId, ageDays, halfLifeDays}. Freshness decays by half-life: 0.5 raised to age over half-life; fresh at 0.5 or better, stale below 0.25. Scores how current each payload still is. */
export function scorePayloadFreshness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const payloadId = String(r.payloadId || r.payload || 'payload');
    const ageDays = num(r.ageDays, 0);
    const halfLifeDays = num(r.halfLifeDays, 90) || 90;
    const freshness = round2(Math.pow(0.5, ageDays / halfLifeDays));
    const state = freshness >= 0.5 ? 'fresh' : freshness >= 0.25 ? 'aging' : 'stale';
    return { key: payloadId, payloadId, ageDays, halfLifeDays, freshness, state };
  }).sort((a, b) => b.freshness - a.freshness || String(a.key).localeCompare(String(b.key)));
  const freshCount = rows.filter(r => r.state === 'fresh').length;
  const staleCount = rows.filter(r => r.state === 'stale').length;
  return { rows, count: rows.length, freshCount, staleCount, top: rows[0] || null, summary: `Infinity AI scored payload freshness for ${rows.length} payload(s); ${freshCount} are fresh and ${staleCount} are stale.` };
}
/** Idea 53786 — Stale Knowledge Detection. Input records: {entryId, lastVerifiedDaysAgo, contradictionCount}. Staleness grows with days since verification plus a penalty per contradiction; stale past 180 days or on any contradiction. Detects knowledge entries that no longer match reality. */
export function detectStaleKnowledge(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const lastVerifiedDaysAgo = num(r.lastVerifiedDaysAgo ?? r.daysAgo, 0);
    const contradictionCount = num(r.contradictionCount ?? r.contradictions, 0);
    const staleness = round2(Math.min(1, lastVerifiedDaysAgo / 365 + 0.1 * contradictionCount));
    return { key: entryId, entryId, lastVerifiedDaysAgo, contradictionCount, staleness, stale: lastVerifiedDaysAgo > 180 || contradictionCount > 0 };
  }).sort((a, b) => b.staleness - a.staleness || String(a.key).localeCompare(String(b.key)));
  const staleCount = rows.filter(r => r.stale).length;
  return { rows, count: rows.length, staleCount, top: rows[0] || null, summary: `Infinity AI scanned ${rows.length} knowledge entr(ies) for staleness; ${staleCount} are stale.` };
}
/** Idea 53787 — Automatic Payload Quarantine. Input records: {payloadId, attempts, successes}. Failure rate over attempts; quarantined after at least 5 attempts with failure rate at 0.8 or higher. Automatically quarantines payloads that keep failing. */
export function quarantinePayloadsAutomatically(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const payloadId = String(r.payloadId || r.payload || 'payload');
    const attempts = num(r.attempts, 0);
    const successes = num(r.successes, 0);
    const failureRate = rate(attempts - successes, attempts);
    const quarantined = attempts >= 5 && failureRate >= 0.8;
    return { key: payloadId, payloadId, attempts, successes, failureRate, quarantined, action: quarantined ? 'quarantine' : 'active' };
  }).sort((a, b) => b.failureRate - a.failureRate || String(a.key).localeCompare(String(b.key)));
  const quarantinedIds = rows.filter(r => r.quarantined).map(r => r.payloadId);
  return { rows, count: rows.length, quarantinedCount: quarantinedIds.length, quarantinedIds, top: rows[0] || null, summary: `Infinity AI evaluated ${rows.length} payload(s) for quarantine; ${quarantinedIds.length} quarantined.` };
}
/** Idea 53788 — Knowledge Half-Life Modeling. Input records: {topic, initialAccuracy, currentAccuracy, ageDays}. Half-life is solved from observed accuracy decay; null when accuracy held or improved. Models how fast each knowledge topic decays. */
export function modelKnowledgeHalfLife(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const topic = String(r.topic || 'topic');
    const initialAccuracy = round2(clamp01(r.initialAccuracy ?? r.initial));
    const currentAccuracy = round2(clamp01(r.currentAccuracy ?? r.current));
    const ageDays = num(r.ageDays, 0);
    const ratio = initialAccuracy > 0 ? currentAccuracy / initialAccuracy : 0;
    const stable = ratio >= 1;
    const halfLifeDays = !stable && ratio > 0 && ageDays > 0 ? round2(ageDays * (Math.log(0.5) / Math.log(ratio))) : null;
    return { key: topic, topic, initialAccuracy, currentAccuracy, ageDays, halfLifeDays, stable };
  }).sort((a, b) => (a.halfLifeDays === null ? Infinity : a.halfLifeDays) - (b.halfLifeDays === null ? Infinity : b.halfLifeDays) || String(a.key).localeCompare(String(b.key)));
  const modeledCount = rows.filter(r => r.halfLifeDays !== null).length;
  return { rows, count: rows.length, modeledCount, top: rows[0] || null, summary: `Infinity AI modeled knowledge half-life for ${rows.length} topic(s); ${modeledCount} are decaying measurably.` };
}
/** Idea 53789 — Patch-Driven Invalidation. Input records: {entryId, affectedComponent, patchComponent, relevance}. Entries are invalidated when a patch lands on their component with relevance at 0.5 or higher. Invalidates knowledge when vendors patch the underlying weakness. */
export function invalidateKnowledgeByPatch(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const component = String(r.affectedComponent || r.component || '');
    const patchComponent = String(r.patchComponent || '');
    const relevance = round2(clamp01(r.relevance));
    const invalidated = component.length > 0 && component === patchComponent && relevance >= 0.5;
    return { key: entryId, entryId, component, patchComponent, relevance, invalidated, action: invalidated ? 'invalidate' : 'retain' };
  }).sort((a, b) => Number(b.invalidated) - Number(a.invalidated) || b.relevance - a.relevance || String(a.key).localeCompare(String(b.key)));
  const invalidatedCount = rows.filter(r => r.invalidated).length;
  return { rows, count: rows.length, invalidatedCount, top: rows[0] || null, summary: `Infinity AI checked patch-driven invalidation for ${rows.length} knowledge entr(ies); ${invalidatedCount} invalidated.` };
}
/** Idea 53790 — Version-Aware Knowledge Expiry. Input records: {entryId, validFrom, validUntil, currentVersion}. Status is pending before the valid range, active inside it, expired past it, using numeric version comparison. Expires knowledge tied to software versions that moved on. */
export function expireKnowledgeByVersion(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const validFrom = String(r.validFrom || '0.0.0');
    const validUntil = String(r.validUntil || '999.0.0');
    const currentVersion = String(r.currentVersion || '0.0.0');
    const current = parseVer(currentVersion);
    const status = cmpVer(current, parseVer(validFrom)) < 0 ? 'pending' : cmpVer(current, parseVer(validUntil)) > 0 ? 'expired' : 'active';
    return { key: entryId, entryId, validFrom, validUntil, currentVersion, status, expired: status === 'expired' };
  }).sort((a, b) => Number(b.expired) - Number(a.expired) || String(a.key).localeCompare(String(b.key)));
  const expiredCount = rows.filter(r => r.expired).length;
  const activeCount = rows.filter(r => r.status === 'active').length;
  return { rows, count: rows.length, expiredCount, activeCount, top: rows[0] || null, summary: `Infinity AI checked version-aware expiry for ${rows.length} knowledge entr(ies); ${expiredCount} expired.` };
}
/** Idea 53791 — Forgetting Audit Trails. Input events: {entryId, action, actor, reason, timestamp}. Newest first; an audit gap is any event recorded without a reason. Keeps an auditable record of every forgetting decision. */
export function traceForgettingAuditTrail(events = []) {
  const rows = (Array.isArray(events) ? events : []).map(e => {
    const entryId = String(e.entryId || e.entry || 'entry');
    const reason = String(e.reason || '');
    return { key: `${entryId}|${num(e.timestamp, 0)}`, entryId, action: String(e.action || ''), actor: String(e.actor || ''), reason, timestamp: num(e.timestamp, 0), reasoned: reason.length > 0 };
  }).sort((a, b) => b.timestamp - a.timestamp || String(a.key).localeCompare(String(b.key)));
  const forgetCount = rows.filter(r => r.action === 'forget').length;
  const unreasonedCount = rows.filter(r => !r.reasoned).length;
  return { rows, count: rows.length, forgetCount, unreasonedCount, top: rows[0] || null, summary: `Infinity AI traced ${rows.length} forgetting audit event(s); ${unreasonedCount} lack a recorded reason.` };
}
/** Idea 53792 — Selective Forgetting Controls. Input records: {entryId, category, ageDays, valueScore}. Compliance and legal entries are protected; entries older than a year with value below 0.3 are forgotten; everything else retained. Lets owners choose exactly what the system forgets. */
export function applySelectiveForgettingControls(records = []) {
  const protectedCategories = new Set(['compliance', 'legal']);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const category = String(r.category || '').toLowerCase();
    const ageDays = num(r.ageDays, 0);
    const valueScore = round2(clamp01(r.valueScore ?? r.value));
    const isProtected = protectedCategories.has(category);
    const decision = isProtected ? 'protected' : ageDays > 365 && valueScore < 0.3 ? 'forget' : 'retain';
    return { key: entryId, entryId, category, ageDays, valueScore, decision };
  }).sort((a, b) => ({ forget: 0, retain: 1, protected: 2 }[a.decision] - { forget: 0, retain: 1, protected: 2 }[b.decision]) || String(a.key).localeCompare(String(b.key)));
  const forgetCount = rows.filter(r => r.decision === 'forget').length;
  const retainedCount = rows.filter(r => r.decision === 'retain').length;
  const protectedCount = rows.filter(r => r.decision === 'protected').length;
  return { rows, count: rows.length, forgetCount, retainedCount, protectedCount, top: rows[0] || null, summary: `Infinity AI applied selective forgetting to ${rows.length} knowledge entr(ies); ${forgetCount} forgotten, ${protectedCount} protected.` };
}
/** Idea 53793 — Forgetting Impact Assessments. Input records: {entryId, dependents, activeDependents}. Impact scales with dependents still in active use; safe to forget only when none are active. Assesses what breaks before knowledge is forgotten. */
export function assessForgettingImpact(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const dependents = Array.isArray(r.dependents) ? r.dependents.map(s => String(s)) : [];
    const activeDependents = num(r.activeDependents, 0);
    const impactScore = round2(Math.min(1, activeDependents / 3));
    const safeToForget = activeDependents === 0;
    return { key: entryId, entryId, dependentCount: dependents.length, activeDependents, impactScore, safeToForget, blocked: !safeToForget };
  }).sort((a, b) => Number(b.safeToForget) - Number(a.safeToForget) || a.impactScore - b.impactScore || String(a.key).localeCompare(String(b.key)));
  const safeCount = rows.filter(r => r.safeToForget).length;
  return { rows, count: rows.length, safeCount, blockedCount: rows.length - safeCount, top: rows[0] || null, summary: `Infinity AI assessed forgetting impact for ${rows.length} knowledge entr(ies); ${safeCount} are safe to forget.` };
}
/** Idea 53794 — Resurrection Protocols. Input records: {entryId, forgottenDaysAgo, archiveIntegrity}. Viability multiplies archive integrity by a slow time discount; resurrectable at 0.5 or better. Defines how forgotten knowledge can be restored when needed again. */
export function planKnowledgeResurrection(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const forgottenDaysAgo = num(r.forgottenDaysAgo ?? r.daysAgo, 0);
    const archiveIntegrity = round2(clamp01(r.archiveIntegrity ?? r.integrity));
    const viability = round2(archiveIntegrity * clamp01(1 - forgottenDaysAgo / 3650));
    return { key: entryId, entryId, forgottenDaysAgo, archiveIntegrity, viability, resurrectable: viability >= 0.5 };
  }).sort((a, b) => b.viability - a.viability || String(a.key).localeCompare(String(b.key)));
  const resurrectableCount = rows.filter(r => r.resurrectable).length;
  return { rows, count: rows.length, resurrectableCount, top: rows[0] || null, summary: `Infinity AI planned resurrection for ${rows.length} forgotten entr(ies); ${resurrectableCount} are resurrectable.` };
}
/** Idea 53795 — Stale Playbook Detection. Input records: {playbookId, lastRunDaysAgo, failureRate}. Staleness blends time since last run (capped at 180 days) with recent failure rate; stale at 0.5 or higher. Flags playbooks that have not run or kept working. */
export function detectStalePlaybooks(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const playbookId = String(r.playbookId || r.playbook || 'playbook');
    const lastRunDaysAgo = num(r.lastRunDaysAgo ?? r.daysAgo, 0);
    const failureRate = round2(clamp01(r.failureRate));
    const staleScore = round2(0.6 * Math.min(1, lastRunDaysAgo / 180) + 0.4 * failureRate);
    return { key: playbookId, playbookId, lastRunDaysAgo, failureRate, staleScore, stale: staleScore >= 0.5 };
  }).sort((a, b) => b.staleScore - a.staleScore || String(a.key).localeCompare(String(b.key)));
  const staleCount = rows.filter(r => r.stale).length;
  return { rows, count: rows.length, staleCount, top: rows[0] || null, summary: `Infinity AI scanned ${rows.length} playbook(s) for staleness; ${staleCount} are stale.` };
}
/** Idea 53796 — Knowledge Confidence Decay. Input records: {entryId, confidence, ageDays, halfLifeDays}. Confidence halves every half-life period; below 0.3 the entry needs re-verification. Decays stored confidence as knowledge ages. */
export function decayKnowledgeConfidence(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const initialConfidence = round2(clamp01(r.confidence ?? r.initialConfidence));
    const ageDays = num(r.ageDays, 0);
    const halfLifeDays = num(r.halfLifeDays, 90) || 90;
    const decayedConfidence = round2(initialConfidence * Math.pow(0.5, ageDays / halfLifeDays));
    return { key: entryId, entryId, initialConfidence, ageDays, halfLifeDays, decayedConfidence, confidenceLoss: round2(initialConfidence - decayedConfidence), belowThreshold: decayedConfidence < 0.3 };
  }).sort((a, b) => b.confidenceLoss - a.confidenceLoss || String(a.key).localeCompare(String(b.key)));
  const belowThresholdCount = rows.filter(r => r.belowThreshold).length;
  return { rows, count: rows.length, belowThresholdCount, top: rows[0] || null, summary: `Infinity AI decayed confidence for ${rows.length} knowledge entr(ies); ${belowThresholdCount} fell below the trust threshold.` };
}
/** Idea 53797 — Seasonal Knowledge Cycling. Input records: {entryId, activeSeason, currentSeason}. In season when the entry's season matches the current season or runs all year; otherwise dormant. Cycles seasonal knowledge in and out of the active set. */
export function cycleSeasonalKnowledge(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const activeSeason = String(r.activeSeason || r.season || '');
    const currentSeason = String(r.currentSeason || '');
    const inSeason = activeSeason === 'all-year' || activeSeason === currentSeason;
    return { key: entryId, entryId, activeSeason, currentSeason, inSeason, status: inSeason ? 'active' : 'dormant' };
  }).sort((a, b) => Number(b.inSeason) - Number(a.inSeason) || String(a.key).localeCompare(String(b.key)));
  const activeCount = rows.filter(r => r.inSeason).length;
  return { rows, count: rows.length, activeCount, dormantCount: rows.length - activeCount, top: rows[0] || null, summary: `Infinity AI cycled seasonal knowledge for ${rows.length} entr(ies); ${activeCount} are in season.` };
}
/** Idea 53798 — Defense-Evolution Tracking. Input records: {technique, defensesObserved, hunts, wins}. Counter pressure is defenses seen per hunt; exposure discounts pressure by the evasion rate; outdated at 0.5 or higher. Tracks how target defenses evolve against known techniques. */
export function trackDefenseEvolution(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const technique = String(r.technique || 'technique');
    const defensesObserved = num(r.defensesObserved ?? r.defenses, 0);
    const hunts = num(r.hunts, 0);
    const wins = num(r.wins, 0);
    const counterPressure = rate(defensesObserved, hunts);
    const evasionRate = rate(wins, hunts);
    const exposure = round2(counterPressure * (1 - evasionRate));
    return { key: technique, technique, defensesObserved, hunts, wins, counterPressure, evasionRate, exposure, outdated: exposure >= 0.5 };
  }).sort((a, b) => b.exposure - a.exposure || String(a.key).localeCompare(String(b.key)));
  const outdatedCount = rows.filter(r => r.outdated).length;
  return { rows, count: rows.length, outdatedCount, top: rows[0] || null, summary: `Infinity AI tracked defense evolution for ${rows.length} technique(s); ${outdatedCount} are outdated by new defenses.` };
}
/** Idea 53799 — Forgetting vs Archiving Policies. Input records: {entryId, ageDays, recentAccess, regulatory}. Regulatory entries always archive; untouched entries older than 180 days are forgotten; the rest archive or retain by age. Codifies when knowledge is forgotten versus archived. */
export function decideForgettingVsArchiving(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const ageDays = num(r.ageDays, 0);
    const recentAccess = num(r.recentAccess ?? r.access, 0);
    const regulatory = Boolean(r.regulatory);
    const decision = regulatory ? 'archive' : ageDays > 180 && recentAccess === 0 ? 'forget' : ageDays > 180 ? 'archive' : 'retain';
    return { key: entryId, entryId, ageDays, recentAccess, regulatory, decision };
  }).sort((a, b) => ({ forget: 0, archive: 1, retain: 2 }[a.decision] - { forget: 0, archive: 1, retain: 2 }[b.decision]) || String(a.key).localeCompare(String(b.key)));
  const forgetCount = rows.filter(r => r.decision === 'forget').length;
  const archiveCount = rows.filter(r => r.decision === 'archive').length;
  const retainCount = rows.filter(r => r.decision === 'retain').length;
  return { rows, count: rows.length, forgetCount, archiveCount, retainCount, top: rows[0] || null, summary: `Infinity AI decided forgetting versus archiving for ${rows.length} entr(ies); ${forgetCount} forgotten, ${archiveCount} archived, ${retainCount} retained.` };
}
/** Idea 53800 — Human Forgetting Overrides. Input records: {entryId, systemDecision, humanDecision, reason}. A human decision that differs from the system wins; overrides without a reason are audit gaps. Lets humans override automated forgetting decisions. */
export function applyHumanForgettingOverrides(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const systemDecision = String(r.systemDecision || 'retain');
    const humanDecision = String(r.humanDecision || '');
    const reason = String(r.reason || '');
    const overridden = humanDecision.length > 0 && humanDecision !== systemDecision;
    return { key: entryId, entryId, systemDecision, humanDecision, reason, overridden, finalDecision: humanDecision || systemDecision, audited: !overridden || reason.length > 0 };
  }).sort((a, b) => Number(b.overridden) - Number(a.overridden) || String(a.key).localeCompare(String(b.key)));
  const overrideCount = rows.filter(r => r.overridden).length;
  const unauditedCount = rows.filter(r => !r.audited).length;
  return { rows, count: rows.length, overrideCount, unauditedCount, top: rows[0] || null, summary: `Infinity AI applied human forgetting overrides to ${rows.length} entr(ies); ${overrideCount} override(s) recorded.` };
}
