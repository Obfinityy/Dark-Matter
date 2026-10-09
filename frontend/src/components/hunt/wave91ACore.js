/**
 * wave91ACore.js — Infinity AI · Wave 91A
 * Cluster insights, ideas 53601–53620: cluster confidence intervals,
 * cluster-based hunt briefings, cluster defense mapping, cluster
 * exploit-kit correlation, cluster researcher specialization, cluster
 * data export API, cluster visualization gallery, cluster-driven
 * conference topics, cluster feedback loops, cluster-based risk
 * scoring, cluster hunt replay tags, cluster annual review, cluster
 * naming localization, cluster privacy safeguards, cluster contribution
 * credits, cluster early-warning system, cluster mitigation playbooks,
 * cluster benchmark comparisons, cluster research grants, and industry
 * finding fingerprints.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE91_A_IDEAS = [
  { id: 53601, title: 'Cluster Confidence Intervals', skip: false },
  { id: 53602, title: 'Cluster-Based Hunt Briefings', skip: false },
  { id: 53603, title: 'Cluster Defense Mapping', skip: false },
  { id: 53604, title: 'Cluster Exploit-Kit Correlation', skip: false },
  { id: 53605, title: 'Cluster Researcher Specialization', skip: false },
  { id: 53606, title: 'Cluster Data Export API', skip: false },
  { id: 53607, title: 'Cluster Visualization Gallery', skip: false },
  { id: 53608, title: 'Cluster-Driven Conference Topics', skip: false },
  { id: 53609, title: 'Cluster Feedback Loops', skip: false },
  { id: 53610, title: 'Cluster-Based Risk Scoring', skip: false },
  { id: 53611, title: 'Cluster Hunt Replay Tags', skip: false },
  { id: 53612, title: 'Cluster Annual Review', skip: false },
  { id: 53613, title: 'Cluster Naming Localization', skip: false },
  { id: 53614, title: 'Cluster Privacy Safeguards', skip: false },
  { id: 53615, title: 'Cluster Contribution Credits', skip: false },
  { id: 53616, title: 'Cluster Early-Warning System', skip: false },
  { id: 53617, title: 'Cluster Mitigation Playbooks', skip: false },
  { id: 53618, title: 'Cluster Benchmark Comparisons', skip: false },
  { id: 53619, title: 'Cluster Research Grants', skip: false },
  { id: 53620, title: 'Industry Finding Fingerprints', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.cluster||it.id||it.replay||it.researcher||it.industry||it.name||fb);}

/** Idea 53601 — Cluster Confidence Intervals. Input clusters: {cluster, estimate, sampleSize|n}. Computes a 95% interval estimate ± 1.96*sqrt(est(1-est)/n), rounded to 2, with width and a confident flag when width < 0.4. */
export function measureClusterConfidenceIntervals(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const estimate = clamp01(c.estimate ?? 0);
    const n = Math.max(1, num(c.sampleSize ?? c.n, 1));
    const margin = 1.96 * Math.sqrt(Math.max(0, estimate * (1 - estimate)) / n);
    const low = round2(Math.max(0, estimate - margin));
    const high = round2(Math.min(1, estimate + margin));
    const width = round2(high - low);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), estimate, sampleSize: n, low, high, width, confident: width < 0.4 };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const confidentCount = rows.filter(r => r.confident).length;
  const top = rows.length ? [...rows].sort((a, b) => a.width - b.width || String(a.key).localeCompare(String(b.key)))[0] : null;
  return { rows, count: rows.length, confidentCount, averageWidth: mean(rows.map(r => r.width)), top, summary: `Infinity AI measured 95% confidence intervals for ${rows.length} cluster(s); ${confidentCount} are narrow enough to act on.` };
}
/** Idea 53602 — Cluster-Based Hunt Briefings. Input clusters: {cluster, expectedYield, hunterCount}. Ranks clusters by expected yield and writes a briefing line per cluster. */
export function briefHuntersOnClusters(clusters = []) {
  const ranked = (Array.isArray(clusters) ? clusters : []).map(c => {
    const expectedYield = num(c.expectedYield ?? c.yield, 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), expectedYield, hunterCount: num(c.hunterCount ?? c.hunters, 0) };
  }).sort((a, b) => b.expectedYield - a.expectedYield || String(a.key).localeCompare(String(b.key)));
  const rows = ranked.map((r, i) => ({ ...r, rank: i + 1, briefing: `Rank ${i + 1}: hunt ${r.cluster} first, expected yield ${r.expectedYield} with ${r.hunterCount} hunter(s) assigned.` }));
  return { rows, count: rows.length, briefCount: rows.length, top: rows[0] || null, summary: `Infinity AI briefed hunters on ${rows.length} cluster(s) ranked by expected yield.` };
}
/** Idea 53603 — Cluster Defense Mapping. Input clusters: {cluster, defenses[]|mitigations, threats}. Coverage is mitigated defenses over threat count; defended at coverage >= 0.7. */
export function mapClusterDefenses(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const defenses = Array.isArray(c.defenses) ? c.defenses.map(String) : Array.isArray(c.mitigations) ? c.mitigations.map(String) : [];
    const threatCount = Array.isArray(c.threats) ? c.threats.length : num(c.threats, defenses.length || 1);
    const coverage = threatCount ? clamp01(round2(defenses.length / threatCount)) : 1;
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), defenses: [...defenses].sort(), defenseCount: defenses.length, threatCount, coverage, defended: coverage >= 0.7 };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const defendedCount = rows.filter(r => r.defended).length;
  return { rows, count: rows.length, defendedCount, averageCoverage: mean(rows.map(r => r.coverage)), top: rows[0] || null, summary: `Infinity AI mapped defenses for ${rows.length} cluster(s); ${defendedCount} meet the coverage bar.` };
}
/** Idea 53604 — Cluster Exploit-Kit Correlation. Input records: {cluster, kit, overlap}. Correlated when overlap >= 0.5. */
export function correlateClusterExploitKits(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const overlap = clamp01(r.overlap ?? 0);
    const cluster = String(r.cluster || 'cluster');
    const kit = String(r.kit || 'kit');
    return { key: `${cluster}|${kit}`, cluster, kit, overlap, correlated: overlap >= 0.5 };
  }).sort((a, b) => b.overlap - a.overlap || String(a.key).localeCompare(String(b.key)));
  const correlatedCount = rows.filter(r => r.correlated).length;
  return { rows, count: rows.length, correlatedCount, top: rows[0] || null, summary: `Infinity AI correlated exploit kits across ${rows.length} cluster record(s); ${correlatedCount} show strong overlap.` };
}
/** Idea 53605 — Cluster Researcher Specialization. Input researchers: {researcher, cluster, score, findings}. Keeps the best cluster per researcher; specialist at score >= 0.8. */
export function identifyClusterSpecialists(researchers = []) {
  const best = new Map();
  for (const r of Array.isArray(researchers) ? researchers : []) {
    const researcher = String(r.researcher || 'researcher');
    const score = clamp01(r.score ?? 0);
    const current = best.get(researcher);
    if (!current || score > current.score) best.set(researcher, { key: researcher, researcher, cluster: String(r.cluster || ''), score, findings: num(r.findings, 0) });
  }
  const rows = [...best.values()].map(r => ({ ...r, specialist: r.score >= 0.8 })).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const specialistCount = rows.filter(r => r.specialist).length;
  return { rows, count: rows.length, specialistCount, top: rows[0] || null, summary: `Infinity AI identified ${specialistCount} cluster specialist(s) among ${rows.length} researcher(s).` };
}
/** Idea 53606 — Cluster Data Export API. Input clusters plus options {format}. Builds rows and a payload string: JSON text, or CSV text with header cluster,findings. */
export function exportClusterData(clusters = [], options = {}) {
  const format = String(options.format || 'json').toLowerCase() === 'csv' ? 'csv' : 'json';
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => ({ key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), findings: num(c.findings ?? c.count, 0) }))
    .sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const payload = format === 'csv' ? ['cluster,findings', ...rows.map(r => `${r.cluster},${r.findings}`)].join('\n') : JSON.stringify(rows);
  return { rows, count: rows.length, recordCount: rows.length, format, payload, top: rows[0] || null, summary: `Infinity AI exported ${rows.length} cluster record(s) as ${format} for the hunt data API.` };
}
/** Idea 53607 — Cluster Visualization Gallery. Input clusters: {cluster, size, severityScore}. Chart type is heatmap at size >= 20, bar at size >= 8, otherwise list. */
export function buildClusterVisualizationGallery(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const size = num(c.size, 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), size, severityScore: clamp01(c.severityScore ?? 0), chart: size >= 20 ? 'heatmap' : size >= 8 ? 'bar' : 'list' };
  }).sort((a, b) => b.size - a.size || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, vizCount: rows.length, top: rows[0] || null, summary: `Infinity AI built a visualization gallery with ${rows.length} cluster chart(s).` };
}
/** Idea 53608 — Cluster-Driven Conference Topics. Input clusters: {cluster, interest, novelty}. Topic score is 0.6*interest + 0.4*novelty; proposed at score >= 0.6. */
export function proposeClusterConferenceTopics(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const interest = clamp01(c.interest ?? 0);
    const novelty = clamp01(c.novelty ?? 0);
    const topicScore = round2(0.6 * interest + 0.4 * novelty);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), interest, novelty, topicScore, proposed: topicScore >= 0.6, topic: `${String(c.cluster || 'cluster')} findings in practice` };
  }).sort((a, b) => b.topicScore - a.topicScore || String(a.key).localeCompare(String(b.key)));
  const proposedCount = rows.filter(r => r.proposed).length;
  return { rows, count: rows.length, proposedCount, top: rows[0] || null, summary: `Infinity AI proposed ${proposedCount} conference topic(s) from cluster interest and novelty.` };
}
/** Idea 53609 — Cluster Feedback Loops. Input clusters: {cluster, insights, detectionsAdjusted}. A loop is closed when insights > 0 and detections were adjusted. */
export function buildClusterFeedbackLoops(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const insights = num(c.insights, 0);
    const adjusted = num(c.detectionsAdjusted ?? c.adjusted, 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), insights, detectionsAdjusted: adjusted, closed: insights > 0 && adjusted > 0 };
  }).sort((a, b) => (b.insights + b.detectionsAdjusted) - (a.insights + a.detectionsAdjusted) || String(a.key).localeCompare(String(b.key)));
  const closedCount = rows.filter(r => r.closed).length;
  return { rows, count: rows.length, closedCount, loopCount: rows.length, top: rows[0] || null, summary: `Infinity AI closed ${closedCount} cluster feedback loop(s) where insights changed detections.` };
}
/** Idea 53610 — Cluster-Based Risk Scoring. Input clusters: {cluster, severity, likelihood, exposure}. Risk is severity * likelihood * exposure, rounded to 2; high at risk >= 0.5. */
export function scoreClustersByRisk(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const severity = clamp01(c.severity ?? 0);
    const likelihood = clamp01(c.likelihood ?? 0);
    const exposure = clamp01(c.exposure ?? 0);
    const risk = round2(severity * likelihood * exposure);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), severity, likelihood, exposure, risk, high: risk >= 0.5 };
  }).sort((a, b) => b.risk - a.risk || String(a.key).localeCompare(String(b.key)));
  const highCount = rows.filter(r => r.high).length;
  return { rows, count: rows.length, highCount, averageRisk: mean(rows.map(r => r.risk)), top: rows[0] || null, summary: `Infinity AI scored cluster risk for ${rows.length} cluster(s); ${highCount} are high risk.` };
}
/** Idea 53611 — Cluster Hunt Replay Tags. Input replays: {replay|id, clusters[]}. Tags are the sorted unique cluster names per replay. */
export function tagClusterHuntReplays(replays = []) {
  const rows = (Array.isArray(replays) ? replays : []).map(r => {
    const tags = [...new Set((Array.isArray(r.clusters) ? r.clusters : []).map(String))].sort();
    const replay = String(r.replay || r.id || 'replay');
    return { key: replay, replay, tags, tagCount: tags.length };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const taggedCount = rows.filter(r => r.tagCount > 0).length;
  const totalTags = rows.reduce((s, r) => s + r.tagCount, 0);
  return { rows, count: rows.length, taggedCount, totalTags, top: rows[0] || null, summary: `Infinity AI tagged ${taggedCount} hunt replay(s) with ${totalTags} cluster tag(s).` };
}
/** Idea 53612 — Cluster Annual Review. Input clusters: {cluster, growth, findings, ageDays}. Recommendation: invest when growth > 0.2, retire when findings is 0, otherwise monitor. */
export function reviewClustersAnnually(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const growth = num(c.growth, 0);
    const findings = num(c.findings, 0);
    const recommendation = growth > 0.2 ? 'invest' : findings === 0 ? 'retire' : 'monitor';
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), growth, findings, ageDays: num(c.ageDays, 0), recommendation };
  }).sort((a, b) => b.growth - a.growth || String(a.key).localeCompare(String(b.key)));
  const investCount = rows.filter(r => r.recommendation === 'invest').length;
  const retireCount = rows.filter(r => r.recommendation === 'retire').length;
  return { rows, count: rows.length, investCount, retireCount, monitorCount: rows.filter(r => r.recommendation === 'monitor').length, top: rows[0] || null, summary: `Infinity AI finished the annual cluster review: ${investCount} to invest in, ${retireCount} to retire.` };
}
/** Idea 53613 — Cluster Naming Localization. Input names: {cluster, names:{en,hi}} plus options {locale}. Label falls back to en, then to the cluster key; localized when the label differs from the key. */
export function localizeClusterNames(names = [], options = {}) {
  const locale = String(options.locale || 'en');
  const rows = (Array.isArray(names) ? names : []).map(n => {
    const cluster = String(n.cluster || keyOf(n, 'cluster'));
    const dict = n.names && typeof n.names === 'object' ? n.names : {};
    const label = String(dict[locale] || dict.en || cluster);
    return { key: cluster, cluster, label, locale, localized: label !== cluster };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const localizedCount = rows.filter(r => r.localized).length;
  return { rows, count: rows.length, localizedCount, top: rows[0] || null, summary: `Infinity AI localized ${localizedCount} cluster name(s) for locale ${locale}.` };
}
/** Idea 53614 — Cluster Privacy Safeguards. Input clusters: {cluster, members, hasIdentifiers}. Safe under k-anonymity when members >= 5 and no direct identifiers are held. */
export function safeguardClusterPrivacy(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const members = num(c.members, 0);
    const hasIdentifiers = c.hasIdentifiers === true;
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), members, hasIdentifiers, safe: members >= 5 && !hasIdentifiers };
  }).sort((a, b) => b.members - a.members || String(a.key).localeCompare(String(b.key)));
  const safeguardedCount = rows.filter(r => r.safe).length;
  return { rows, count: rows.length, safeguardedCount, top: rows[0] || null, summary: `Infinity AI checked privacy safeguards: ${safeguardedCount} of ${rows.length} cluster(s) pass k-anonymity.` };
}
/** Idea 53615 — Cluster Contribution Credits. Input contributions: {researcher, cluster, findings}. Credits aggregate findings per researcher. */
export function creditClusterContributors(contributions = []) {
  const totals = new Map();
  for (const c of Array.isArray(contributions) ? contributions : []) {
    const researcher = String(c.researcher || 'researcher');
    totals.set(researcher, (totals.get(researcher) || 0) + num(c.findings, 0));
  }
  const rows = [...totals.entries()].map(([researcher, credits]) => ({ key: researcher, researcher, credits })).sort((a, b) => b.credits - a.credits || String(a.key).localeCompare(String(b.key)));
  const totalCredits = rows.reduce((s, r) => s + r.credits, 0);
  return { rows, count: rows.length, creditedCount: rows.length, totalCredits, top: rows[0] || null, summary: `Infinity AI credited ${rows.length} contributor(s) with ${totalCredits} cluster credit(s).` };
}
/** Idea 53616 — Cluster Early-Warning System. Input clusters: {cluster, growthRate, severityScore, recent}. Warns when growth >= 0.5 and severity >= 0.6. */
export function warnClusterEarly(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const growthRate = clamp01(c.growthRate ?? 0);
    const severityScore = clamp01(c.severityScore ?? 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), growthRate, severityScore, recent: num(c.recent, 0), warning: growthRate >= 0.5 && severityScore >= 0.6 };
  }).sort((a, b) => b.growthRate - a.growthRate || String(a.key).localeCompare(String(b.key)));
  const warningCount = rows.filter(r => r.warning).length;
  return { rows, count: rows.length, warningCount, top: rows[0] || null, summary: `Infinity AI raised early warnings for ${warningCount} fast-growing severe cluster(s).` };
}
/** Idea 53617 — Cluster Mitigation Playbooks. Input clusters: {cluster, defense|topDefense, severity}. Builds a fixed four-step playbook per cluster including a defense coverage validation step. */
export function createClusterMitigationPlaybooks(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const defense = String(c.defense || c.topDefense || 'baseline-controls');
    const steps = [`Confirm cluster scope and affected targets`, `Apply ${defense} as the primary mitigation`, `Validate ${defense} coverage`, `Re-scan the cluster and record residual findings`];
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), defense, severity: String(c.severity || 'medium'), steps, stepCount: steps.length };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, playbookCount: rows.length, totalSteps: rows.reduce((s, r) => s + r.stepCount, 0), top: rows[0] || null, summary: `Infinity AI wrote mitigation playbooks for ${rows.length} cluster(s).` };
}
/** Idea 53618 — Cluster Benchmark Comparisons. Input orgs: {org, cluster, share}. Per cluster, divergence is max share minus min share across orgs. */
export function compareClusterBenchmarks(orgs = []) {
  const grouped = new Map();
  for (const o of Array.isArray(orgs) ? orgs : []) {
    const cluster = String(o.cluster || 'cluster');
    const g = grouped.get(cluster) || { key: cluster, cluster, shares: [], orgs: new Set() };
    g.shares.push(num(o.share, 0));
    g.orgs.add(String(o.org || 'org'));
    grouped.set(cluster, g);
  }
  const rows = [...grouped.values()].map(g => {
    const maxShare = g.shares.length ? round2(Math.max(...g.shares)) : 0;
    const minShare = g.shares.length ? round2(Math.min(...g.shares)) : 0;
    return { key: g.key, cluster: g.cluster, orgCount: g.orgs.size, maxShare, minShare, divergence: round2(maxShare - minShare) };
  }).sort((a, b) => b.divergence - a.divergence || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, benchmarkCount: rows.length, top: rows[0] || null, summary: `Infinity AI compared benchmarks across ${rows.length} cluster(s) and ranked divergence.` };
}
/** Idea 53619 — Cluster Research Grants. Input clusters: {cluster, impact, unexplained} plus options {budget, grantSize}. Allocates full grants in priority order impact*unexplained while the budget allows. */
export function fundClusterResearchGrants(clusters = [], options = {}) {
  const budget = num(options.budget, 10000);
  const grantSize = Math.max(1, num(options.grantSize, 2500));
  let remaining = budget;
  const sorted = (Array.isArray(clusters) ? clusters : []).map(c => {
    const impact = clamp01(c.impact ?? 0);
    const unexplained = clamp01(c.unexplained ?? 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), impact, unexplained, priority: round2(impact * unexplained), allocated: 0, funded: false };
  }).sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  const rows = sorted.map(r => {
    if (remaining >= grantSize) { remaining -= grantSize; return { ...r, allocated: grantSize, funded: true }; }
    return r;
  });
  const fundedCount = rows.filter(r => r.funded).length;
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  return { rows, count: rows.length, fundedCount, totalAllocated, remaining, top: rows[0] || null, summary: `Infinity AI funded ${fundedCount} cluster research grant(s) totaling ${totalAllocated}.` };
}
/** Idea 53620 — Industry Finding Fingerprints. Input findings: {industry, type, count}. Per industry, the fingerprint is industry:topType with the total volume. */
export function fingerprintIndustryFindings(findings = []) {
  const grouped = new Map();
  for (const f of Array.isArray(findings) ? findings : []) {
    const industry = String(f.industry || 'industry');
    const type = String(f.type || 'finding');
    const g = grouped.get(industry) || { key: industry, industry, total: 0, byType: new Map() };
    g.total += num(f.count, 1);
    g.byType.set(type, (g.byType.get(type) || 0) + num(f.count, 1));
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const topType = [...g.byType.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || 'finding';
    return { key: g.key, industry: g.industry, topType, total: g.total, fingerprint: `${g.industry}:${topType}` };
  }).sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, industries: rows.length, top: rows[0] || null, summary: `Infinity AI fingerprinted findings for ${rows.length} industry(ies) by dominant finding type.` };
}
