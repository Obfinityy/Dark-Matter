/**
 * wave100ACore.js — Infinity AI · Wave 100A
 * Debrief delivery operations, ideas 53961–53980: multilingual
 * generation, redaction controls, archive search, ticket conversion,
 * quality scoring, peer review, version control, stakeholder
 * analytics, follow-up tracking, knowledge base links, replay
 * embeds, cost breakdowns, coverage maps, risk narratives,
 * remediation guidance, trend context, compliance mapping,
 * attestation statements, watermarking, and expiry notices.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE100_A_IDEAS = [
  { id: 53961, title: 'Debrief Multilingual Generation', skip: false },
  { id: 53962, title: 'Debrief Redaction Controls', skip: false },
  { id: 53963, title: 'Debrief Archive Search', skip: false },
  { id: 53964, title: 'Debrief-to-Ticket Conversion', skip: false },
  { id: 53965, title: 'Debrief Quality Scoring', skip: false },
  { id: 53966, title: 'Debrief Peer Review', skip: false },
  { id: 53967, title: 'Debrief Version Control', skip: false },
  { id: 53968, title: 'Debrief Stakeholder Analytics', skip: false },
  { id: 53969, title: 'Debrief Follow-Up Tracking', skip: false },
  { id: 53970, title: 'Debrief Knowledge Base Links', skip: false },
  { id: 53971, title: 'Debrief Replay Embeds', skip: false },
  { id: 53972, title: 'Debrief Cost Breakdowns', skip: false },
  { id: 53973, title: 'Debrief Coverage Maps', skip: false },
  { id: 53974, title: 'Debrief Risk Narratives', skip: false },
  { id: 53975, title: 'Debrief Remediation Guidance', skip: false },
  { id: 53976, title: 'Debrief Trend Context', skip: false },
  { id: 53977, title: 'Debrief Compliance Mapping', skip: false },
  { id: 53978, title: 'Debrief Attestation Statements', skip: false },
  { id: 53979, title: 'Debrief Watermarking', skip: false },
  { id: 53980, title: 'Debrief Expiry Notices', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}

/** Idea 53961 — Debrief Multilingual Generation. Input records: {debriefId, language, sectionsTotal, sectionsTranslated}. A debrief is localized only when every section exists in the stakeholder language. Generates debriefs in the stakeholder's preferred language. */
export function generateMultilingualDebriefs(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const language = String(r.language || 'en').toLowerCase();
    const sectionsTotal = Math.max(1, num(r.sectionsTotal, 1));
    const sectionsTranslated = Math.min(sectionsTotal, num(r.sectionsTranslated, 0));
    const coverage = rate(sectionsTranslated, sectionsTotal);
    return { key: `${debriefId}|${language}`, debriefId, language, sectionsTotal, sectionsTranslated, coverage, localized: coverage >= 1, status: coverage >= 1 ? 'fully-localized' : 'partial-translation' };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const localizedCount = rows.filter(r => r.localized).length;
  return { rows, count: rows.length, localizedCount, averageCoverage: mean(rows.map(r => r.coverage)), top: rows[0] || null, summary: `Infinity AI localized ${localizedCount} of ${rows.length} debrief(s) for stakeholder languages.` };
}
/** Idea 53962 — Debrief Redaction Controls. Input records: {debriefId, sensitiveItems, redactedItems, distributionTier}. Wider distribution requires every sensitive item to be redacted first. Redacts sensitive details for broader distribution. */
export function applyDebriefRedactionControls(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const sensitiveItems = num(r.sensitiveItems, 0);
    const redactedItems = Math.min(sensitiveItems, num(r.redactedItems, 0));
    const distributionTier = String(r.distributionTier || 'internal');
    const redactionRate = rate(redactedItems, sensitiveItems);
    const safeToShare = sensitiveItems === 0 || redactedItems >= sensitiveItems;
    return { key: debriefId, debriefId, sensitiveItems, redactedItems, distributionTier, redactionRate, safeToShare, status: safeToShare ? 'safe-to-share' : 'redaction-pending' };
  }).sort((a, b) => b.redactionRate - a.redactionRate || String(a.key).localeCompare(String(b.key)));
  const safeCount = rows.filter(r => r.safeToShare).length;
  return { rows, count: rows.length, safeCount, totalSensitive: rows.reduce((s, r) => s + r.sensitiveItems, 0), top: rows[0] || null, summary: `Infinity AI cleared ${safeCount} of ${rows.length} debrief(s) for wider distribution.` };
}
/** Idea 53963 — Debrief Archive Search. Input records: {debriefId, title, indexedFields, totalFields}. Historical debriefs stay findable only when every field is indexed. Makes all historical debriefs searchable. */
export function searchDebriefArchive(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const title = String(r.title || '');
    const indexedFields = Math.min(num(r.totalFields, 1) || 1, num(r.indexedFields, 0));
    const totalFields = Math.max(1, num(r.totalFields, 1));
    const indexCoverage = rate(indexedFields, totalFields);
    return { key: debriefId, debriefId, title, indexedFields, totalFields, indexCoverage, searchable: indexCoverage >= 1, status: indexCoverage >= 1 ? 'fully-searchable' : 'partially-indexed' };
  }).sort((a, b) => b.indexCoverage - a.indexCoverage || String(a.key).localeCompare(String(b.key)));
  const searchableCount = rows.filter(r => r.searchable).length;
  return { rows, count: rows.length, searchableCount, averageCoverage: mean(rows.map(r => r.indexCoverage)), top: rows[0] || null, summary: `Infinity AI made ${searchableCount} of ${rows.length} archived debrief(s) fully searchable.` };
}
/** Idea 53964 — Debrief-to-Ticket Conversion. Input records: {debriefId, actionItems, ticketsCreated}. Every debrief action item becomes a tracked ticket so nothing is lost. Converts debrief action items into tracked tickets automatically. */
export function convertDebriefToTickets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const actionItems = num(r.actionItems, 0);
    const ticketsCreated = Math.min(actionItems, num(r.ticketsCreated, 0));
    const conversionRate = rate(ticketsCreated, actionItems);
    return { key: debriefId, debriefId, actionItems, ticketsCreated, outstanding: actionItems - ticketsCreated, conversionRate, converted: actionItems > 0 && ticketsCreated >= actionItems, status: actionItems > 0 && ticketsCreated >= actionItems ? 'fully-converted' : 'conversion-pending' };
  }).sort((a, b) => b.conversionRate - a.conversionRate || String(a.key).localeCompare(String(b.key)));
  const convertedCount = rows.filter(r => r.converted).length;
  return { rows, count: rows.length, convertedCount, totalTickets: rows.reduce((s, r) => s + r.ticketsCreated, 0), top: rows[0] || null, summary: `Infinity AI converted action items into tickets for ${convertedCount} of ${rows.length} debrief(s).` };
}
/** Idea 53965 — Debrief Quality Scoring. Input records: {debriefId, completeness, clarity, actionability}. Quality is the average of completeness, clarity, and actionability. Scores debriefs on completeness, clarity, and actionability. */
export function scoreDebriefQuality(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const completeness = round2(clamp01(r.completeness));
    const clarity = round2(clamp01(r.clarity));
    const actionability = round2(clamp01(r.actionability));
    const qualityScore = round2((completeness + clarity + actionability) / 3);
    return { key: debriefId, debriefId, completeness, clarity, actionability, qualityScore, passing: qualityScore >= 0.7, status: qualityScore >= 0.7 ? 'high-quality' : 'needs-improvement' };
  }).sort((a, b) => b.qualityScore - a.qualityScore || String(a.key).localeCompare(String(b.key)));
  const passingCount = rows.filter(r => r.passing).length;
  return { rows, count: rows.length, passingCount, averageQuality: mean(rows.map(r => r.qualityScore)), top: rows[0] || null, summary: `Infinity AI scored ${rows.length} debrief(s); ${passingCount} meet the quality bar.` };
}
/** Idea 53966 — Debrief Peer Review. Input records: {debriefId, reviewersAssigned, reviewsCompleted, revisionsRequested}. Debriefs ship only after assigned reviewers finish with no open revisions. Routes debriefs for peer review before client delivery. */
export function runDebriefPeerReview(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const reviewersAssigned = Math.max(1, num(r.reviewersAssigned, 1));
    const reviewsCompleted = Math.min(reviewersAssigned, num(r.reviewsCompleted, 0));
    const revisionsRequested = num(r.revisionsRequested, 0);
    const reviewCoverage = rate(reviewsCompleted, reviewersAssigned);
    const cleared = reviewsCompleted >= reviewersAssigned && revisionsRequested === 0;
    return { key: debriefId, debriefId, reviewersAssigned, reviewsCompleted, revisionsRequested, reviewCoverage, cleared, status: cleared ? 'review-cleared' : revisionsRequested > 0 ? 'revisions-requested' : 'review-pending' };
  }).sort((a, b) => b.reviewCoverage - a.reviewCoverage || String(a.key).localeCompare(String(b.key)));
  const clearedCount = rows.filter(r => r.cleared).length;
  return { rows, count: rows.length, clearedCount, averageCoverage: mean(rows.map(r => r.reviewCoverage)), top: rows[0] || null, summary: `Infinity AI cleared ${clearedCount} of ${rows.length} debrief(s) through peer review.` };
}
/** Idea 53967 — Debrief Version Control. Input records: {debriefId, version, findingsRevalidated, findingsCorrected}. New versions are tracked whenever findings are re-validated or corrected. Versions debriefs as findings get re-validated or corrected. */
export function versionDebriefs(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const version = Math.max(1, num(r.version, 1));
    const findingsRevalidated = num(r.findingsRevalidated, 0);
    const findingsCorrected = num(r.findingsCorrected, 0);
    const changed = findingsRevalidated + findingsCorrected > 0;
    return { key: `${debriefId}|v${version}`, debriefId, version, findingsRevalidated, findingsCorrected, changed, versioned: version >= 2 && changed, status: version >= 2 && changed ? 'version-tracked' : version >= 2 ? 'version-noop' : 'initial-version' };
  }).sort((a, b) => b.version - a.version || String(a.key).localeCompare(String(b.key)));
  const trackedCount = rows.filter(r => r.versioned).length;
  return { rows, count: rows.length, trackedCount, totalCorrections: rows.reduce((s, r) => s + r.findingsCorrected, 0), top: rows[0] || null, summary: `Infinity AI version-tracked ${trackedCount} of ${rows.length} debrief update(s).` };
}
/** Idea 53968 — Debrief Stakeholder Analytics. Input records: {debriefId, stakeholder, opened, focusScore, timeSpentMinutes}. Analytics show which stakeholders read debriefs and what they focus on. Tracks which stakeholders read debriefs and what they focus on. */
export function trackDebriefStakeholderAnalytics(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const stakeholder = String(r.stakeholder || 'stakeholder');
    const opened = Boolean(r.opened);
    const focusScore = round2(clamp01(r.focusScore));
    const timeSpentMinutes = num(r.timeSpentMinutes, 0);
    const engaged = opened && timeSpentMinutes >= 3;
    return { key: `${debriefId}|${stakeholder}`, debriefId, stakeholder, opened, focusScore, timeSpentMinutes, engaged, status: engaged ? 'engaged-reader' : opened ? 'skimmed' : 'not-opened' };
  }).sort((a, b) => b.timeSpentMinutes - a.timeSpentMinutes || String(a.key).localeCompare(String(b.key)));
  const openedCount = rows.filter(r => r.opened).length;
  return { rows, count: rows.length, openedCount, engagedCount: rows.filter(r => r.engaged).length, averageFocus: mean(rows.map(r => r.focusScore)), top: rows[0] || null, summary: `Infinity AI tracked ${openedCount} of ${rows.length} stakeholder read(s) across debriefs.` };
}
/** Idea 53969 — Debrief Follow-Up Tracking. Input records: {debriefId, recommendations, actedOn, overdueCount}. Follow-up tracking shows whether debrief recommendations were acted upon. Tracks whether debrief recommendations were acted upon. */
export function trackDebriefFollowUps(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const recommendations = num(r.recommendations, 0);
    const actedOn = Math.min(recommendations, num(r.actedOn, 0));
    const overdueCount = num(r.overdueCount, 0);
    const actionRate = rate(actedOn, recommendations);
    return { key: debriefId, debriefId, recommendations, actedOn, overdueCount, actionRate, followedUp: recommendations > 0 && actedOn >= recommendations, status: recommendations > 0 && actedOn >= recommendations ? 'fully-followed-up' : overdueCount > 0 ? 'follow-up-overdue' : 'follow-up-pending' };
  }).sort((a, b) => b.actionRate - a.actionRate || String(a.key).localeCompare(String(b.key)));
  const followedCount = rows.filter(r => r.followedUp).length;
  return { rows, count: rows.length, followedCount, totalOverdue: rows.reduce((s, r) => s + r.overdueCount, 0), top: rows[0] || null, summary: `Infinity AI fully followed up ${followedCount} of ${rows.length} debrief recommendation set(s).` };
}
/** Idea 53970 — Debrief Knowledge Base Links. Input records: {debriefId, sections, kbLinks}. Each debrief section links to the knowledge base article that explains it. Links debrief sections to relevant KB articles automatically. */
export function linkDebriefKnowledgeBase(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const sections = Math.max(1, num(r.sections, 1));
    const kbLinks = Math.min(sections, num(r.kbLinks, 0));
    const linkCoverage = rate(kbLinks, sections);
    return { key: debriefId, debriefId, sections, kbLinks, linkCoverage, fullyLinked: kbLinks >= sections, status: kbLinks >= sections ? 'fully-linked' : kbLinks > 0 ? 'partially-linked' : 'unlinked' };
  }).sort((a, b) => b.linkCoverage - a.linkCoverage || String(a.key).localeCompare(String(b.key)));
  const linkedCount = rows.filter(r => r.fullyLinked).length;
  return { rows, count: rows.length, linkedCount, totalLinks: rows.reduce((s, r) => s + r.kbLinks, 0), top: rows[0] || null, summary: `Infinity AI fully linked ${linkedCount} of ${rows.length} debrief(s) to the knowledge base.` };
}
/** Idea 53971 — Debrief Replay Embeds. Input records: {debriefId, findingsCount, replayEmbeds}. Key replay moments sit inside the debrief next to the findings they prove. Embeds key replay moments directly in the debrief document. */
export function embedDebriefReplays(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const findingsCount = Math.max(1, num(r.findingsCount, 1));
    const replayEmbeds = Math.min(findingsCount, num(r.replayEmbeds, 0));
    const embedCoverage = rate(replayEmbeds, findingsCount);
    return { key: debriefId, debriefId, findingsCount, replayEmbeds, embedCoverage, embedded: replayEmbeds >= findingsCount, status: replayEmbeds >= findingsCount ? 'replays-embedded' : 'replays-missing' };
  }).sort((a, b) => b.embedCoverage - a.embedCoverage || String(a.key).localeCompare(String(b.key)));
  const embeddedCount = rows.filter(r => r.embedded).length;
  return { rows, count: rows.length, embeddedCount, totalEmbeds: rows.reduce((s, r) => s + r.replayEmbeds, 0), top: rows[0] || null, summary: `Infinity AI embedded replays for every finding in ${embeddedCount} of ${rows.length} debrief(s).` };
}
/** Idea 53972 — Debrief Cost Breakdowns. Input records: {huntId, totalCost, findingsCount, hoursSpent}. Breakdowns expose cost per finding and where hunt time actually went. Includes cost-per-finding and time allocation breakdowns. */
export function buildDebriefCostBreakdowns(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || 'hunt');
    const totalCost = num(r.totalCost, 0);
    const findingsCount = Math.max(1, num(r.findingsCount, 1));
    const hoursSpent = num(r.hoursSpent, 0);
    const costPerFinding = round2(totalCost / findingsCount);
    const costPerHour = hoursSpent > 0 ? round2(totalCost / hoursSpent) : 0;
    return { key: huntId, huntId, totalCost, findingsCount, hoursSpent, costPerFinding, costPerHour, efficient: costPerFinding <= 500, status: costPerFinding <= 500 ? 'cost-efficient' : 'cost-heavy' };
  }).sort((a, b) => a.costPerFinding - b.costPerFinding || String(a.key).localeCompare(String(b.key)));
  const efficientCount = rows.filter(r => r.efficient).length;
  return { rows, count: rows.length, efficientCount, totalCost: round2(rows.reduce((s, r) => s + r.totalCost, 0)), top: rows[0] || null, summary: `Infinity AI broke down hunt costs for ${rows.length} debrief(s); ${efficientCount} are cost-efficient.` };
}
/** Idea 53973 — Debrief Coverage Maps. Input records: {huntId, endpointsTotal, endpointsTested}. Coverage maps show what was tested and what was deliberately left out. Embeds coverage visualizations showing what was and was not tested. */
export function buildDebriefCoverageMaps(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || 'hunt');
    const endpointsTotal = Math.max(1, num(r.endpointsTotal, 1));
    const endpointsTested = Math.min(endpointsTotal, num(r.endpointsTested, 0));
    const coverage = rate(endpointsTested, endpointsTotal);
    return { key: huntId, huntId, endpointsTotal, endpointsTested, endpointsMissed: endpointsTotal - endpointsTested, coverage, mapped: coverage >= 0.8, status: coverage >= 0.8 ? 'well-covered' : 'coverage-gaps' };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const coveredCount = rows.filter(r => r.mapped).length;
  return { rows, count: rows.length, coveredCount, averageCoverage: mean(rows.map(r => r.coverage)), top: rows[0] || null, summary: `Infinity AI mapped coverage for ${rows.length} hunt(s); ${coveredCount} are well covered.` };
}
/** Idea 53974 — Debrief Risk Narratives. Input records: {huntId, findingsCount, businessRiskScore, narrativeSections}. Risk narratives frame findings in business language executives act on. Frames findings in business-risk language for executives. */
export function buildDebriefRiskNarratives(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || 'hunt');
    const findingsCount = num(r.findingsCount, 0);
    const businessRiskScore = round2(clamp01(r.businessRiskScore ?? r.riskScore));
    const narrativeSections = num(r.narrativeSections, 0);
    const framed = findingsCount > 0 && narrativeSections >= findingsCount;
    return { key: huntId, huntId, findingsCount, businessRiskScore, narrativeSections, framed, exposure: round2(businessRiskScore * findingsCount), status: framed ? 'risk-framed' : 'findings-unframed' };
  }).sort((a, b) => b.exposure - a.exposure || String(a.key).localeCompare(String(b.key)));
  const framedCount = rows.filter(r => r.framed).length;
  return { rows, count: rows.length, framedCount, top: rows[0] || null, summary: `Infinity AI framed business risk for ${framedCount} of ${rows.length} hunt debrief(s).` };
}
/** Idea 53975 — Debrief Remediation Guidance. Input records: {findingId, priorityScore, stepsProvided, stepsTotal}. Guidance gives an ordered fix path for every finding, highest risk first. Includes prioritized remediation steps per finding. */
export function buildDebriefRemediationGuidance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const findingId = String(r.findingId || 'finding');
    const priorityScore = round2(clamp01(r.priorityScore ?? r.priority));
    const stepsTotal = Math.max(1, num(r.stepsTotal, 1));
    const stepsProvided = Math.min(stepsTotal, num(r.stepsProvided, 0));
    const guidanceCoverage = rate(stepsProvided, stepsTotal);
    return { key: findingId, findingId, priorityScore, stepsProvided, stepsTotal, guidanceCoverage, guided: stepsProvided >= stepsTotal, status: stepsProvided >= stepsTotal ? 'guidance-complete' : 'guidance-partial' };
  }).sort((a, b) => b.priorityScore - a.priorityScore || b.guidanceCoverage - a.guidanceCoverage || String(a.key).localeCompare(String(b.key)));
  const guidedCount = rows.filter(r => r.guided).length;
  return { rows, count: rows.length, guidedCount, averageCoverage: mean(rows.map(r => r.guidanceCoverage)), top: rows[0] || null, summary: `Infinity AI wrote complete remediation guidance for ${guidedCount} of ${rows.length} finding(s).` };
}
/** Idea 53976 — Debrief Trend Context. Input records: {huntId, findingsCount, fleetAverage}. Trend context places one hunt against the fleet so outliers stand out. Places the hunt's results in the context of fleet-wide trends. */
export function addDebriefTrendContext(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || 'hunt');
    const findingsCount = num(r.findingsCount, 0);
    const fleetAverage = num(r.fleetAverage, 0);
    const delta = round2(findingsCount - fleetAverage);
    const deltaRate = fleetAverage > 0 ? round2(delta / fleetAverage) : 0;
    const outlier = Math.abs(deltaRate) >= 0.5;
    return { key: huntId, huntId, findingsCount, fleetAverage, delta, deltaRate, outlier, trend: delta > 0 ? 'above-fleet' : delta < 0 ? 'below-fleet' : 'at-fleet-average', status: outlier ? 'trend-outlier' : 'trend-typical' };
  }).sort((a, b) => Math.abs(b.deltaRate) - Math.abs(a.deltaRate) || String(a.key).localeCompare(String(b.key)));
  const outlierCount = rows.filter(r => r.outlier).length;
  return { rows, count: rows.length, outlierCount, top: rows[0] || null, summary: `Infinity AI placed ${rows.length} hunt(s) in fleet trend context; ${outlierCount} are outliers.` };
}
/** Idea 53977 — Debrief Compliance Mapping. Input records: {findingId, framework, controlsMapped, controlsTotal}. Every finding maps to the compliance controls it touches. Maps findings to relevant compliance frameworks automatically. */
export function mapDebriefCompliance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const findingId = String(r.findingId || 'finding');
    const framework = String(r.framework || 'framework');
    const controlsTotal = Math.max(1, num(r.controlsTotal, 1));
    const controlsMapped = Math.min(controlsTotal, num(r.controlsMapped, 0));
    const mappingCoverage = rate(controlsMapped, controlsTotal);
    return { key: `${findingId}|${framework}`, findingId, framework, controlsMapped, controlsTotal, mappingCoverage, mapped: controlsMapped >= controlsTotal, status: controlsMapped >= controlsTotal ? 'fully-mapped' : 'mapping-incomplete' };
  }).sort((a, b) => b.mappingCoverage - a.mappingCoverage || String(a.key).localeCompare(String(b.key)));
  const mappedCount = rows.filter(r => r.mapped).length;
  return { rows, count: rows.length, mappedCount, totalControls: rows.reduce((s, r) => s + r.controlsTotal, 0), top: rows[0] || null, summary: `Infinity AI fully mapped ${mappedCount} of ${rows.length} finding(s) to compliance controls.` };
}
/** Idea 53978 — Debrief Attestation Statements. Input records: {huntId, methodologySteps, attestedSteps, signed}. Attestations state exactly what method was followed, for audit use. Includes methodology attestations for audit purposes. */
export function buildDebriefAttestations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || 'hunt');
    const methodologySteps = Math.max(1, num(r.methodologySteps, 1));
    const attestedSteps = Math.min(methodologySteps, num(r.attestedSteps, 0));
    const signed = Boolean(r.signed);
    const attestationCoverage = rate(attestedSteps, methodologySteps);
    const attested = attestedSteps >= methodologySteps && signed;
    return { key: huntId, huntId, methodologySteps, attestedSteps, signed, attestationCoverage, attested, status: attested ? 'attested' : signed ? 'partially-attested' : 'unattested' };
  }).sort((a, b) => b.attestationCoverage - a.attestationCoverage || String(a.key).localeCompare(String(b.key)));
  const attestedCount = rows.filter(r => r.attested).length;
  return { rows, count: rows.length, attestedCount, top: rows[0] || null, summary: `Infinity AI attested methodology for ${attestedCount} of ${rows.length} hunt debrief(s).` };
}
/** Idea 53979 — Debrief Watermarking. Input records: {debriefId, recipient, watermarked, copiesShared}. Watermarks tie each distributed copy to its recipient to deter leaks. Watermarks debriefs with recipient identity to deter leaks. */
export function applyDebriefWatermarking(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const recipient = String(r.recipient || 'recipient');
    const watermarked = Boolean(r.watermarked);
    const copiesShared = num(r.copiesShared, 0);
    const protectedCopy = watermarked && copiesShared >= 1;
    return { key: `${debriefId}|${recipient}`, debriefId, recipient, watermarked, copiesShared, protectedCopy, status: protectedCopy ? 'watermark-protected' : watermarked ? 'watermarked-not-shared' : 'unwatermarked' };
  }).sort((a, b) => b.copiesShared - a.copiesShared || String(a.key).localeCompare(String(b.key)));
  const protectedCount = rows.filter(r => r.protectedCopy).length;
  return { rows, count: rows.length, protectedCount, totalCopies: rows.reduce((s, r) => s + r.copiesShared, 0), top: rows[0] || null, summary: `Infinity AI watermark-protected ${protectedCount} of ${rows.length} distributed debrief copy(ies).` };
}
/** Idea 53980 — Debrief Expiry Notices. Input records: {debriefId, daysSinceHunt, freshnessDays}. Expiry notices warn readers when hunt data is stale because targets change. Marks debriefs with data freshness dates since targets change. */
export function applyDebriefExpiryNotices(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const daysSinceHunt = num(r.daysSinceHunt, 0);
    const freshnessDays = Math.max(1, num(r.freshnessDays, 30));
    const fresh = daysSinceHunt <= freshnessDays;
    return { key: debriefId, debriefId, daysSinceHunt, freshnessDays, daysLeft: Math.max(0, freshnessDays - daysSinceHunt), fresh, expired: !fresh, status: fresh ? 'data-fresh' : 'stale-notice-shown' };
  }).sort((a, b) => b.daysSinceHunt - a.daysSinceHunt || String(a.key).localeCompare(String(b.key)));
  const freshCount = rows.filter(r => r.fresh).length;
  return { rows, count: rows.length, freshCount, expiredCount: rows.length - freshCount, top: rows[0] || null, summary: `Infinity AI marked freshness on ${rows.length} debrief(s); ${rows.length - freshCount} now show a stale notice.` };
}
