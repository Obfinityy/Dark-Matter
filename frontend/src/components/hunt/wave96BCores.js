/**
 * wave96BCores.js — Infinity AI · Wave 96B
 * Forgetting governance, metrics, and strategy experiments, ideas
 * 53821–53840: forgetting metrics, cross-org staleness signals, knowledge
 * half-life research, forgetting ethics reviews, stale integration cleanup,
 * knowledge freshness SLAs, forgetting-triggered alerts, archived knowledge
 * search, knowledge decay attribution, forgetting policy versioning, stale
 * training data purging, knowledge revival testing, forgetting communication
 * templates, annual forgetting audits, knowledge freshness gamification,
 * forgetting vs updating decisions, stale dashboard widget cleanup,
 * knowledge expiry countdowns, forgetting impact on new hires, and the hunt
 * strategy experiment framework.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE96_B_IDEAS = [
  { id: 53821, title: 'Forgetting Metrics', skip: false },
  { id: 53822, title: 'Cross-Org Staleness Signals', skip: false },
  { id: 53823, title: 'Knowledge Half-Life Research', skip: false },
  { id: 53824, title: 'Forgetting Ethics Reviews', skip: false },
  { id: 53825, title: 'Stale Integration Cleanup', skip: false },
  { id: 53826, title: 'Knowledge Freshness SLAs', skip: false },
  { id: 53827, title: 'Forgetting-Triggered Alerts', skip: false },
  { id: 53828, title: 'Archived Knowledge Search', skip: false },
  { id: 53829, title: 'Knowledge Decay Attribution', skip: false },
  { id: 53830, title: 'Forgetting Policy Versioning', skip: false },
  { id: 53831, title: 'Stale Training Data Purging', skip: false },
  { id: 53832, title: 'Knowledge Revival Testing', skip: false },
  { id: 53833, title: 'Forgetting Communication Templates', skip: false },
  { id: 53834, title: 'Annual Forgetting Audits', skip: false },
  { id: 53835, title: 'Knowledge Freshness Gamification', skip: false },
  { id: 53836, title: 'Forgetting vs Updating Decisions', skip: false },
  { id: 53837, title: 'Stale Dashboard Widget Cleanup', skip: false },
  { id: 53838, title: 'Knowledge Expiry Countdowns', skip: false },
  { id: 53839, title: 'Forgetting Impact on New Hires', skip: false },
  { id: 53840, title: 'Hunt Strategy Experiment Framework', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.entryId||it.id||it.name||fb);}
function parseVer(v){return String(v||'0.0.0').split('.').map(p=>num(p,0));}
function cmpVer(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}

/** Idea 53821 — Forgetting Metrics. Input records: {period, forgotten, revived, outcomeDelta}. Revival rate is revived over forgotten; net effect combines churn with the observed outcome delta. Tracks how much knowledge was forgotten, revived, and its net effect on outcomes. */
export function computeForgettingMetrics(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const period = String(r.period || 'period');
    const forgotten = num(r.forgotten, 0);
    const revived = num(r.revived, 0);
    const outcomeDelta = round2(num(r.outcomeDelta ?? r.delta, 0));
    return { key: period, period, forgotten, revived, netForgotten: forgotten - revived, revivalRate: rate(revived, forgotten), outcomeDelta, netEffect: round2(outcomeDelta - 0.01 * (forgotten - revived)) };
  }).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const totalForgotten = rows.reduce((s, r) => s + r.forgotten, 0);
  const totalRevived = rows.reduce((s, r) => s + r.revived, 0);
  return { rows, count: rows.length, totalForgotten, totalRevived, overallRevivalRate: rate(totalRevived, totalForgotten), averageNetEffect: mean(rows.map(r => r.netEffect)), top: rows[0] || null, summary: `Infinity AI measured forgetting across ${rows.length} period(s); ${totalForgotten} forgotten, ${totalRevived} revived.` };
}
/** Idea 53822 — Cross-Org Staleness Signals. Input records: {org, topic, staleShare, optedOut}. Aggregates opted-in orgs only; the anonymized signal is the mean stale share per topic with org identities removed. Shares anonymized staleness signals so orgs learn from each other's decay patterns. */
export function aggregateCrossOrgStalenessSignals(records = []) {
  const list = Array.isArray(records) ? records : [];
  const included = list.filter(r => r.optedOut !== true);
  const groups = new Map();
  for (const r of included) {
    const topic = String(r.topic || 'topic');
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(round2(clamp01(r.staleShare ?? r.share)));
  }
  const signals = [...groups.entries()].map(([topic, shares]) => {
    const meanShare = mean(shares);
    return { key: topic, topic, orgCount: shares.length, meanStaleShare: meanShare, anonymized: true, signalStrength: meanShare >= 0.5 ? 'strong' : meanShare >= 0.3 ? 'moderate' : 'weak' };
  }).sort((a, b) => b.meanStaleShare - a.meanStaleShare || String(a.key).localeCompare(String(b.key)));
  return { signals, count: signals.length, includedCount: included.length, excludedCount: list.length - included.length, top: signals[0] || null, summary: `Infinity AI aggregated staleness signals for ${signals.length} topic(s) from ${included.length} opted-in org(s).` };
}
/** Idea 53823 — Knowledge Half-Life Research. Input records: {topic, halfLifeDays, sampleSize}. Research-grade when at least 30 samples back the estimate; topics ranked fastest-decaying first. Publishes research on how fast different security knowledge decays. */
export function researchKnowledgeHalfLives(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const topic = String(r.topic || 'topic');
    const halfLifeDays = num(r.halfLifeDays, 0);
    const sampleSize = num(r.sampleSize ?? r.samples, 0);
    return { key: topic, topic, halfLifeDays, sampleSize, researchGrade: sampleSize >= 30, decayClass: halfLifeDays < 90 ? 'fast' : halfLifeDays < 365 ? 'medium' : 'slow' };
  }).sort((a, b) => a.halfLifeDays - b.halfLifeDays || String(a.key).localeCompare(String(b.key)));
  const researchGradeCount = rows.filter(r => r.researchGrade).length;
  return { rows, count: rows.length, researchGradeCount, medianHalfLife: median(rows.map(r => r.halfLifeDays)), fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, top: rows[0] || null, summary: `Infinity AI published half-life research for ${rows.length} topic(s); ${researchGradeCount} are research grade.` };
}
/** Idea 53824 — Forgetting Ethics Reviews. Input records: {entryId, category, safetyCritical, justification}. A violation is a safety-critical entry forgotten without justification, or a safety-category entry missing its ethics fields. Ensures forgetting doesn't erase safety-critical knowledge. */
export function reviewForgettingEthics(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const category = String(r.category || '').toLowerCase();
    const safetyCritical = Boolean(r.safetyCritical);
    const justification = String(r.justification || '');
    const violation = (safetyCritical && justification.length === 0) || (category === 'safety' && justification.length === 0);
    return { key: entryId, entryId, category, safetyCritical, justified: justification.length > 0, violation, compliant: !violation };
  }).sort((a, b) => Number(b.violation) - Number(a.violation) || String(a.key).localeCompare(String(b.key)));
  const violationCount = rows.filter(r => r.violation).length;
  return { rows, count: rows.length, violationCount, compliantCount: rows.length - violationCount, top: rows[0] || null, summary: `Infinity AI ran forgetting ethics reviews on ${rows.length} entr(ies); ${violationCount} violation(s) found.` };
}
/** Idea 53825 — Stale Integration Cleanup. Input records: {integrationId, lastUsedDaysAgo, monthlyCalls, connected}. Dead when unused for 90 days with fewer than 5 monthly calls; disconnected integrations are flagged separately. Removes integrations and connectors for tools nobody uses anymore. */
export function cleanStaleIntegrations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const integrationId = String(r.integrationId || r.integration || 'integration');
    const lastUsedDaysAgo = num(r.lastUsedDaysAgo ?? r.daysAgo, 0);
    const monthlyCalls = num(r.monthlyCalls ?? r.calls, 0);
    const connected = r.connected !== false;
    const dead = lastUsedDaysAgo > 90 && monthlyCalls < 5;
    return { key: integrationId, integrationId, tool: String(r.tool || ''), lastUsedDaysAgo, monthlyCalls, connected, dead, action: dead ? 'remove' : connected ? 'keep' : 'repair' };
  }).sort((a, b) => b.lastUsedDaysAgo - a.lastUsedDaysAgo || String(a.key).localeCompare(String(b.key)));
  const removeIds = rows.filter(r => r.dead).map(r => r.integrationId);
  return { rows, count: rows.length, removeCount: removeIds.length, removeIds, top: rows[0] || null, summary: `Infinity AI reviewed ${rows.length} integration(s) for cleanup; ${removeIds.length} are dead.` };
}
/** Idea 53826 — Knowledge Freshness SLAs. Input records: {category, targetDays, oldestDays}. Breach factor is oldest over target; compliant inside target, breached past it. Defines freshness targets per knowledge type (payloads: 90 days; principles: 2 years). */
export function evaluateKnowledgeFreshnessSLAs(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const category = String(r.category || 'category');
    const targetDays = num(r.targetDays ?? r.target, 0) || 90;
    const oldestDays = num(r.oldestDays ?? r.oldest, 0);
    const breachFactor = round2(oldestDays / targetDays);
    return { key: category, category, targetDays, oldestDays, breachFactor, compliant: oldestDays <= targetDays };
  }).sort((a, b) => b.breachFactor - a.breachFactor || String(a.key).localeCompare(String(b.key)));
  const breachCount = rows.filter(r => !r.compliant).length;
  return { rows, count: rows.length, breachCount, compliantCount: rows.length - breachCount, top: rows[0] || null, summary: `Infinity AI evaluated freshness SLAs for ${rows.length} categor(ies); ${breachCount} are breached.` };
}
/** Idea 53827 — Forgetting-Triggered Alerts. Input records: {eventId, forgottenCount, performanceDropPct, day}. An alert fires when a forgetting event of 100+ entries coincides with a performance drop of 5% or more. Alerts when a large forgetting event coincides with hunt performance drops. */
export function detectForgettingTriggeredAlerts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const eventId = String(r.eventId || r.event || 'event');
    const forgottenCount = num(r.forgottenCount ?? r.forgotten, 0);
    const performanceDropPct = round2(num(r.performanceDropPct ?? r.drop, 0));
    const severity = round2(Math.min(1, forgottenCount / 200) * Math.min(1, performanceDropPct / 20));
    return { key: eventId, eventId, forgottenCount, performanceDropPct, day: num(r.day, 0), severity, alert: forgottenCount >= 100 && performanceDropPct >= 5 };
  }).sort((a, b) => b.severity - a.severity || String(a.key).localeCompare(String(b.key)));
  const alerts = rows.filter(r => r.alert);
  return { rows, count: rows.length, alertCount: alerts.length, alertIds: alerts.map(r => r.eventId), top: rows[0] || null, summary: `Infinity AI scanned ${rows.length} forgetting event(s); ${alerts.length} triggered alerts.` };
}
/** Idea 53828 — Archived Knowledge Search. Input: a query plus records {entryId, title, body, status}. Title matches weigh double; archived and forgotten entries stay searchable with their status attached. Keeps archived knowledge searchable for historical research. */
export function searchArchivedKnowledge(query = '', records = []) {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const title = String(r.title || '');
    const body = String(r.body || '');
    const hayTitle = title.toLowerCase();
    const hayBody = body.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hayTitle.includes(t)) score += 2;
      if (hayBody.includes(t)) score += 1;
    }
    return { key: String(r.entryId || r.entry || 'entry'), entryId: String(r.entryId || r.entry || 'entry'), title, status: String(r.status || 'archived'), score };
  }).filter(r => terms.length === 0 || r.score > 0).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, query: String(query || ''), top: rows[0] || null, summary: `Infinity AI searched the archive for "${String(query || '')}"; ${rows.length} entr(ies) matched.` };
}
/** Idea 53829 — Knowledge Decay Attribution. Input records: {entryId, forgottenDay, changeDay, performanceDeltaPct}. Changes within 7 days of a forgetting event are attributed to it; the attributed delta sums their performance movement. Attributes performance changes to specific forgetting events. */
export function attributeKnowledgeDecay(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const forgottenDay = num(r.forgottenDay ?? r.forgotDay, 0);
    const changeDay = num(r.changeDay ?? r.perfDay, 0);
    const performanceDeltaPct = round2(num(r.performanceDeltaPct ?? r.delta, 0));
    const dayGap = Math.abs(changeDay - forgottenDay);
    const attributed = dayGap <= 7;
    return { key: entryId, entryId, forgottenDay, changeDay, dayGap, performanceDeltaPct, attributed };
  }).sort((a, b) => a.dayGap - b.dayGap || String(a.key).localeCompare(String(b.key)));
  const attributed = rows.filter(r => r.attributed);
  return { rows, count: rows.length, attributedCount: attributed.length, attributedDelta: round2(attributed.reduce((s, r) => s + r.performanceDeltaPct, 0)), top: rows[0] || null, summary: `Infinity AI attributed ${attributed.length} of ${rows.length} performance change(s) to forgetting events.` };
}
/** Idea 53830 — Forgetting Policy Versioning. Input records: {policyId, version, effectiveDay, changeSummary}. Versions compared numerically per policy; the highest is current and each policy keeps a changelog. Versions forgetting policies with changelogs. */
export function versionForgettingPolicies(records = []) {
  const list = Array.isArray(records) ? records : [];
  const latestByPolicy = new Map();
  for (const r of list) {
    const policyId = String(r.policyId || r.policy || 'policy');
    const parts = parseVer(r.version);
    const current = latestByPolicy.get(policyId);
    if (!current || cmpVer(parts, current) > 0) latestByPolicy.set(policyId, parts);
  }
  const rows = list.map(r => {
    const policyId = String(r.policyId || r.policy || 'policy');
    const version = String(r.version || '0.0.0');
    const parts = parseVer(version);
    const isCurrent = cmpVer(parts, latestByPolicy.get(policyId) || parts) === 0;
    return { key: `${policyId}@${version}`, policyId, version, parts, effectiveDay: num(r.effectiveDay ?? r.day, 0), changeSummary: String(r.changeSummary || ''), isCurrent };
  }).sort((a, b) => String(a.policyId).localeCompare(String(b.policyId)) || cmpVer(b.parts, a.parts));
  const currentCount = rows.filter(r => r.isCurrent).length;
  return { rows, count: rows.length, policyCount: latestByPolicy.size, currentCount, top: rows[0] || null, summary: `Infinity AI versioned ${latestByPolicy.size} forgetting polic(ies) across ${rows.length} release(s).` };
}
/** Idea 53831 — Stale Training Data Purging. Input records: {exampleId, ageDays, sourceStale, labelQuality}. Examples purge when their source went stale, labels fall below 0.4 quality, or they age past a year. Purges stale examples from training sets on a schedule. */
export function purgeStaleTrainingData(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const exampleId = String(r.exampleId || r.example || 'example');
    const ageDays = num(r.ageDays, 0);
    const labelQuality = round2(clamp01(r.labelQuality ?? r.quality));
    const sourceStale = Boolean(r.sourceStale);
    return { key: exampleId, exampleId, ageDays, labelQuality, sourceStale, purge: sourceStale || labelQuality < 0.4 || ageDays > 365 };
  }).sort((a, b) => Number(b.purge) - Number(a.purge) || b.ageDays - a.ageDays || String(a.key).localeCompare(String(b.key)));
  const purgeIds = rows.filter(r => r.purge).map(r => r.exampleId);
  return { rows, count: rows.length, purgeCount: purgeIds.length, purgeIds, keepCount: rows.length - purgeIds.length, top: rows[0] || null, summary: `Infinity AI screened ${rows.length} training example(s); ${purgeIds.length} are purged as stale.` };
}
/** Idea 53832 — Knowledge Revival Testing. Input records: {entryId, sandboxRuns, sandboxPasses, sideEffects}. Revival pass rate over sandbox runs; production ready at 0.8 or better with zero side effects. Tests revived knowledge in sandboxes before returning it to production. */
export function testKnowledgeRevival(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const sandboxRuns = num(r.sandboxRuns ?? r.runs, 0);
    const sandboxPasses = num(r.sandboxPasses ?? r.passes, 0);
    const sideEffects = num(r.sideEffects, 0);
    const passRate = rate(sandboxPasses, sandboxRuns);
    return { key: entryId, entryId, sandboxRuns, sandboxPasses, sideEffects, passRate, productionReady: passRate >= 0.8 && sideEffects === 0 };
  }).sort((a, b) => b.passRate - a.passRate || String(a.key).localeCompare(String(b.key)));
  const readyIds = rows.filter(r => r.productionReady).map(r => r.entryId);
  return { rows, count: rows.length, readyCount: readyIds.length, readyIds, top: rows[0] || null, summary: `Infinity AI sandbox-tested revival for ${rows.length} entr(ies); ${readyIds.length} are production ready.` };
}
/** Idea 53833 — Forgetting Communication Templates. Input records: {entryId, author, reason, category}. Renders the standard retirement notice for the entry's category with author, entry, and reason interpolated. Standard templates explaining to researchers why knowledge was retired. */
export function renderForgettingCommunication(records = []) {
  const templates = {
    stale: 'Hi {author}, your knowledge entry "{entry}" was retired because it went stale: {reason}. You can re-validate it from the archive within 90 days.',
    superseded: 'Hi {author}, your knowledge entry "{entry}" was retired because newer guidance supersedes it: {reason}. The replacement is linked from the archive.',
    compliance: 'Hi {author}, your knowledge entry "{entry}" was retired for compliance handling: {reason}. It remains preserved under retention rules.',
    default: 'Hi {author}, your knowledge entry "{entry}" was retired: {reason}. Reply to this notice if you believe it should be restored.',
  };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const author = String(r.author || 'researcher');
    const reason = String(r.reason || '');
    const category = String(r.category || 'default').toLowerCase();
    const template = templates[category] || templates.default;
    const message = template.replace('{author}', author).replace('{entry}', entryId).replace('{reason}', reason || 'no reason recorded');
    return { key: entryId, entryId, author, category, reason, rendered: true, message };
  });
  return { rows, count: rows.length, renderedCount: rows.length, templatesAvailable: Object.keys(templates).length, top: rows[0] || null, summary: `Infinity AI rendered forgetting notices for ${rows.length} entr(ies) from ${Object.keys(templates).length} template(s).` };
}
/** Idea 53834 — Annual Forgetting Audits. Input records: {year, forgotten, justified, revived}. Justification rate is justified over forgotten; stayed-forgotten excludes revivals. Yearly audit of everything forgotten and whether it stayed forgotten justifiably. */
export function auditAnnualForgetting(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const year = num(r.year, 0);
    const forgotten = num(r.forgotten, 0);
    const justified = num(r.justified, 0);
    const revived = num(r.revived, 0);
    return { key: String(year), year, forgotten, justified, revived, justificationRate: rate(justified, forgotten), stayedForgotten: Math.max(0, forgotten - revived), auditScore: round2(rate(justified, forgotten) * (1 - rate(revived, forgotten) * 0.5)) };
  }).sort((a, b) => b.year - a.year);
  const latest = rows[0] || null;
  return { rows, count: rows.length, totalForgotten: rows.reduce((s, r) => s + r.forgotten, 0), latest, top: latest, summary: `Infinity AI completed annual forgetting audits for ${rows.length} year(s).` };
}
/** Idea 53835 — Knowledge Freshness Gamification. Input records: {researcher, revalidated, points, streakDays}. Level rises with revalidation points: contributor under 100, guardian under 300, steward above; streaks add bonus recognition. Rewards researchers who re-validate aging knowledge. */
export function scoreKnowledgeFreshnessGame(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const points = num(r.points, 0);
    const revalidated = num(r.revalidated, 0);
    const streakDays = num(r.streakDays ?? r.streak, 0);
    const level = points >= 300 ? 'steward' : points >= 100 ? 'guardian' : 'contributor';
    const badges = [];
    if (revalidated >= 20) badges.push('revalidator');
    if (streakDays >= 30) badges.push('streak-keeper');
    if (points >= 300) badges.push('knowledge-steward');
    return { key: researcher, researcher, points, revalidated, streakDays, level, badges, badgeCount: badges.length };
  }).sort((a, b) => b.points - a.points || String(a.key).localeCompare(String(b.key)));
  rows.forEach((row, i) => { row.rank = i + 1; });
  return { rows, count: rows.length, totalPoints: rows.reduce((s, r) => s + r.points, 0), stewardCount: rows.filter(r => r.level === 'steward').length, top: rows[0] || null, summary: `Infinity AI scored freshness contributions for ${rows.length} researcher(s); ${rows.length ? rows[0].researcher : 'none'} leads.` };
}
/** Idea 53836 — Forgetting vs Updating Decisions. Input records: {entryId, evidenceStrength, updateCostHours, ageDays}. Update when evidence is strong and cheap to refresh; forget when evidence is weak and the entry is old; otherwise archive. Decision framework for when to update knowledge versus forget it. */
export function decideForgettingVsUpdating(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const evidenceStrength = round2(clamp01(r.evidenceStrength ?? r.evidence));
    const updateCostHours = num(r.updateCostHours ?? r.cost, 0);
    const ageDays = num(r.ageDays, 0);
    const updateValue = round2(evidenceStrength * Math.min(1, 8 / Math.max(1, updateCostHours)));
    const decision = evidenceStrength >= 0.5 && updateCostHours <= 8 ? 'update' : evidenceStrength < 0.3 && ageDays > 180 ? 'forget' : 'archive';
    return { key: entryId, entryId, evidenceStrength, updateCostHours, ageDays, updateValue, decision };
  }).sort((a, b) => ({ update: 0, archive: 1, forget: 2 }[a.decision] - { update: 0, archive: 1, forget: 2 }[b.decision]) || b.updateValue - a.updateValue || String(a.key).localeCompare(String(b.key)));
  const updateCount = rows.filter(r => r.decision === 'update').length;
  const forgetCount = rows.filter(r => r.decision === 'forget').length;
  return { rows, count: rows.length, updateCount, forgetCount, archiveCount: rows.length - updateCount - forgetCount, top: rows[0] || null, summary: `Infinity AI decided update-versus-forget for ${rows.length} entr(ies); ${updateCount} update, ${forgetCount} forget.` };
}
/** Idea 53837 — Stale Dashboard Widget Cleanup. Input records: {widgetId, viewsLast30d, ownerActive}. A widget is stale with fewer than 10 views in 30 days or no active owner; cleanup lists the stale ids. Removes dashboard widgets that nobody views anymore. */
export function cleanStaleDashboardWidgets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const widgetId = String(r.widgetId || r.widget || 'widget');
    const viewsLast30d = num(r.viewsLast30d ?? r.views, 0);
    const ownerActive = r.ownerActive !== false;
    const stale = viewsLast30d < 10 || !ownerActive;
    return { key: widgetId, widgetId, name: String(r.name || ''), viewsLast30d, ownerActive, stale, action: stale ? 'remove' : 'keep' };
  }).sort((a, b) => a.viewsLast30d - b.viewsLast30d || String(a.key).localeCompare(String(b.key)));
  const staleIds = rows.filter(r => r.stale).map(r => r.widgetId);
  return { rows, count: rows.length, staleCount: staleIds.length, staleIds, top: rows[0] || null, summary: `Infinity AI reviewed ${rows.length} dashboard widget(s); ${staleIds.length} are stale.` };
}
/** Idea 53838 — Knowledge Expiry Countdowns. Input records: {entryId, contributor, expiresInDays, revalidationHours}. Days-to-expiry drives the countdown; action is revalidate-now within 14 days, schedule within 60, otherwise monitor. Shows researchers when their contributions will expire without re-validation. */
export function countdownKnowledgeExpiry(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const entryId = String(r.entryId || r.entry || 'entry');
    const expiresInDays = num(r.expiresInDays ?? r.days, 0);
    const action = expiresInDays < 0 ? 'expired' : expiresInDays <= 14 ? 'revalidate-now' : expiresInDays <= 60 ? 'schedule' : 'monitor';
    return { key: entryId, entryId, contributor: String(r.contributor || ''), expiresInDays, revalidationHours: round2(num(r.revalidationHours ?? r.hours, 0)), action, attentionNeeded: action === 'revalidate-now' || action === 'expired' };
  }).sort((a, b) => a.expiresInDays - b.expiresInDays || String(a.key).localeCompare(String(b.key)));
  const attentionCount = rows.filter(r => r.attentionNeeded).length;
  return { rows, count: rows.length, attentionCount, top: rows[0] || null, summary: `Infinity AI counted down expiry for ${rows.length} contribution(s); ${attentionCount} need attention now.` };
}
/** Idea 53839 — Forgetting Impact on New Hires. Input records: {technique, forgotten, taughtInOnboarding}. Teaching risk when a forgotten technique is still taught to new hires; exposure counts affected onboarding topics. Ensures new researchers aren't taught already-forgotten techniques. */
export function auditNewHireForgettingImpact(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const technique = String(r.technique || 'technique');
    const forgotten = Boolean(r.forgotten);
    const taughtInOnboarding = Boolean(r.taughtInOnboarding ?? r.taught);
    return { key: technique, technique, forgotten, taughtInOnboarding, teachingRisk: forgotten && taughtInOnboarding, curriculum: forgotten ? (taughtInOnboarding ? 'remove-from-curriculum' : 'already-removed') : 'current' };
  }).sort((a, b) => Number(b.teachingRisk) - Number(a.teachingRisk) || String(a.key).localeCompare(String(b.key)));
  const riskIds = rows.filter(r => r.teachingRisk).map(r => r.technique);
  return { rows, count: rows.length, riskCount: riskIds.length, riskTechniques: riskIds, top: rows[0] || null, summary: `Infinity AI audited ${rows.length} onboarding technique(s); ${riskIds.length} forgotten technique(s) are still taught.` };
}
/** Idea 53840 — Hunt Strategy Experiment Framework. Input records: {experimentId, hypothesis, arms: [{name, isControl}], successMetric, targetSample}. A design is ready with a hypothesis, at least two arms including a control, a named success metric, and a target sample of 100 or more per arm. Standard framework for designing strategy A/B tests with hypotheses and success criteria. */
export function designHuntStrategyExperiment(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const arms = (Array.isArray(r.arms) ? r.arms : []).map(a => ({ name: String((a && a.name) || ''), isControl: Boolean(a && a.isControl) }));
    const checks = {
      hypothesis: String(r.hypothesis || '').length > 0,
      twoArms: arms.length >= 2,
      control: arms.some(a => a.isControl),
      metric: String(r.successMetric || r.metric || '').length > 0,
      sample: num(r.targetSample ?? r.sample, 0) >= 100,
    };
    const checksPassed = Object.values(checks).filter(Boolean).length;
    return { key: experimentId, experimentId, hypothesis: String(r.hypothesis || ''), armCount: arms.length, hasControl: checks.control, successMetric: String(r.successMetric || r.metric || ''), targetSample: num(r.targetSample ?? r.sample, 0), checks, checksPassed, ready: checksPassed === 5, powerAssessment: num(r.targetSample ?? r.sample, 0) >= 200 ? 'adequate' : 'limited' };
  }).sort((a, b) => b.checksPassed - a.checksPassed || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, top: rows[0] || null, summary: `Infinity AI designed ${rows.length} hunt strategy experiment(s); ${readyCount} are ready to run.` };
}
