/**
 * wave90BCores.js — Infinity AI · Wave 90B
 * Finding-cluster operations, ideas 53581–53600: cluster remediation
 * tracking, cluster false-positive rates, cluster bounty value analysis,
 * cluster geographic patterns, cluster temporal patterns, cluster
 * auth-requirement profiles, cluster exploit complexity scores, cluster
 * report templates, cluster trend forecasting, cluster-driven payload
 * breeding, cluster similarity search, cluster evolution timelines,
 * cluster membership explanations, cluster quality audits, cluster-based
 * training curricula, cluster impact dashboards, cluster anomaly
 * detection, cluster cross-referencing with CVE, cluster naming
 * governance, and cluster retirement.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE90_B_IDEAS = [
  { id: 53581, title: 'Cluster Remediation Tracking', skip: false },
  { id: 53582, title: 'Cluster False-Positive Rates', skip: false },
  { id: 53583, title: 'Cluster Bounty Value Analysis', skip: false },
  { id: 53584, title: 'Cluster Geographic Patterns', skip: false },
  { id: 53585, title: 'Cluster Temporal Patterns', skip: false },
  { id: 53586, title: 'Cluster Auth-Requirement Profiles', skip: false },
  { id: 53587, title: 'Cluster Exploit Complexity Scores', skip: false },
  { id: 53588, title: 'Cluster Report Templates', skip: false },
  { id: 53589, title: 'Cluster Trend Forecasting', skip: false },
  { id: 53590, title: 'Cluster-Driven Payload Breeding', skip: false },
  { id: 53591, title: 'Cluster Similarity Search', skip: false },
  { id: 53592, title: 'Cluster Evolution Timelines', skip: false },
  { id: 53593, title: 'Cluster Membership Explanations', skip: false },
  { id: 53594, title: 'Cluster Quality Audits', skip: false },
  { id: 53595, title: 'Cluster-Based Training Curricula', skip: false },
  { id: 53596, title: 'Cluster Impact Dashboards', skip: false },
  { id: 53597, title: 'Cluster Anomaly Detection', skip: false },
  { id: 53598, title: 'Cluster Cross-Referencing with CVE', skip: false },
  { id: 53599, title: 'Cluster Naming Governance', skip: false },
  { id: 53600, title: 'Cluster Retirement', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.id||it.clusterId||it.cluster||it.payloadId||it.payload||it.family||it.target||it.findingId||it.finding||it.name||it.title||fb);}

/** Idea 53581 — Cluster Remediation Tracking. */
export function trackClusterRemediation(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const total = num(c.totalFindings ?? c.findings, 0);
    const remediated = num(c.remediated ?? c.fixed, 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), total, remediated, open: total - remediated, remediationRate: rate(remediated, total) };
  }).sort((a, b) => b.remediationRate - a.remediationRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalFindings: rows.reduce((s, r) => s + r.total, 0), totalRemediated: rows.reduce((s, r) => s + r.remediated, 0), overallRate: rate(rows.reduce((s, r) => s + r.remediated, 0), rows.reduce((s, r) => s + r.total, 0)), top: rows[0] || null, summary: `Infinity AI tracked remediation across ${rows.length} cluster(s) at ${rate(rows.reduce((s, r) => s + r.remediated, 0), rows.reduce((s, r) => s + r.total, 0))} overall.` };
}
/** Idea 53582 — Cluster False-Positive Rates. */
export function clusterFalsePositiveRates(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const findings = num(c.findings ?? c.total, 0);
    const falsePositives = num(c.falsePositives ?? c.fp, 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), findings, falsePositives, fpRate: rate(falsePositives, findings), noisy: rate(falsePositives, findings) >= 0.3 };
  }).sort((a, b) => b.fpRate - a.fpRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, noisyCount: rows.filter(r => r.noisy).length, averageFpRate: mean(rows.map(r => r.fpRate)), top: rows[0] || null, summary: `Infinity AI measured false-positive rates for ${rows.length} cluster(s); ${rows.filter(r => r.noisy).length} are noisy.` };
}
/** Idea 53583 — Cluster Bounty Value Analysis. */
export function analyzeClusterBountyValue(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const findings = num(c.findings ?? c.count, 0);
    const totalBounty = num(c.totalBounty ?? c.bounty, 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), findings, totalBounty, avgBounty: findings ? round2(totalBounty / findings) : 0 };
  }).sort((a, b) => b.totalBounty - a.totalBounty || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalBounty: rows.reduce((s, r) => s + r.totalBounty, 0), totalFindings: rows.reduce((s, r) => s + r.findings, 0), top: rows[0] || null, summary: `Infinity AI analyzed bounty value across ${rows.length} cluster(s) totaling ${rows.reduce((s, r) => s + r.totalBounty, 0)}.` };
}
/** Idea 53584 — Cluster Geographic Patterns. */
export function clusterGeographicPatterns(findings = []) {
  const grouped = new Map();
  for (const f of Array.isArray(findings) ? findings : []) {
    const cluster = String(f.cluster || f.clusterId || 'cluster');
    const region = String(f.region || f.country || f.geo || 'unknown');
    const key = `${cluster}|${region}`;
    const g = grouped.get(key) || { key, cluster, region, count: 0 };
    g.count += num(f.count, 1);
    grouped.set(key, g);
  }
  const rows = [...grouped.values()].sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, regionCount: new Set(rows.map(r => r.region)).size, clusterCount: new Set(rows.map(r => r.cluster)).size, top: rows[0] || null, summary: `Infinity AI mapped geographic patterns for finding clusters across ${new Set(rows.map(r => r.region)).size} region(s).` };
}
/** Idea 53585 — Cluster Temporal Patterns. */
export function clusterTemporalPatterns(findings = []) {
  const grouped = new Map();
  for (const f of Array.isArray(findings) ? findings : []) {
    const cluster = String(f.cluster || f.clusterId || 'cluster');
    const hour = num(f.hour ?? f.hourOfDay, 0);
    const bucket = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const key = `${cluster}|${bucket}`;
    const g = grouped.get(key) || { key, cluster, bucket, count: 0 };
    g.count += num(f.count, 1);
    grouped.set(key, g);
  }
  const rows = [...grouped.values()].sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, peak: rows[0] || null, top: rows[0] || null, summary: `Infinity AI found temporal patterns in cluster activity, peaking in the ${rows[0] ? rows[0].bucket : 'unknown'} window.` };
}
/** Idea 53586 — Cluster Auth-Requirement Profiles. */
export function clusterAuthProfiles(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const total = num(c.findings ?? c.total, 0);
    const authRequired = num(c.authRequired ?? c.authed, 0);
    const unauth = total - authRequired;
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), total, authRequired, unauth, authRate: rate(authRequired, total), dominant: authRequired >= unauth ? 'authenticated' : 'unauthenticated' };
  }).sort((a, b) => b.authRate - a.authRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, authDominantCount: rows.filter(r => r.dominant === 'authenticated').length, top: rows[0] || null, summary: `Infinity AI profiled auth requirements for ${rows.length} cluster(s); ${rows.filter(r => r.dominant === 'authenticated').length} are auth-dominant.` };
}
/** Idea 53587 — Cluster Exploit Complexity Scores. */
export function scoreClusterExploitComplexity(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const steps = num(c.steps ?? c.exploitSteps, 1);
    const prerequisites = num(c.prerequisites ?? c.prereqs, 0);
    const complexity = clamp01(round2(Math.min(steps, 10) / 10 * 0.7 + Math.min(prerequisites, 5) / 5 * 0.3));
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), steps, prerequisites, complexity, level: complexity >= 0.7 ? 'high' : complexity >= 0.4 ? 'medium' : 'low' };
  }).sort((a, b) => b.complexity - a.complexity || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, highCount: rows.filter(r => r.level === 'high').length, averageComplexity: mean(rows.map(r => r.complexity)), top: rows[0] || null, summary: `Infinity AI scored exploit complexity for ${rows.length} cluster(s), ${rows.filter(r => r.level === 'high').length} high-complexity.` };
}
/** Idea 53588 — Cluster Report Templates. */
export function clusterReportTemplates(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const severity = String(c.severity || c.dominantSeverity || 'medium');
    const template = severity === 'critical' ? 'critical-cluster' : severity === 'high' ? 'high-cluster' : 'standard-cluster';
    const sections = ['summary', 'cluster-evidence', 'affected-targets', 'remediation'];
    if (severity === 'critical') sections.push('executive-brief');
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), severity, template, sections, sectionCount: sections.length };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, templateCount: new Set(rows.map(r => r.template)).size, top: rows[0] || null, summary: `Infinity AI selected report templates for ${rows.length} cluster(s) across ${new Set(rows.map(r => r.template)).size} template type(s).` };
}
/** Idea 53589 — Cluster Trend Forecasting. */
export function forecastClusterTrends(snapshots = []) {
  const grouped = new Map();
  for (const s of Array.isArray(snapshots) ? snapshots : []) {
    const cluster = String(s.cluster || s.clusterId || keyOf(s, 'cluster'));
    const g = grouped.get(cluster) || { key: cluster, cluster, points: [] };
    g.points.push({ period: String(s.period || ''), size: num(s.size ?? s.count, 0) });
    grouped.set(cluster, g);
  }
  const rows = [...grouped.values()].map(g => {
    const points = [...g.points].sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const first = points.length ? points[0].size : 0;
    const last = points.length ? points[points.length - 1].size : 0;
    const slope = points.length > 1 ? round2((last - first) / (points.length - 1)) : 0;
    return { key: g.key, cluster: g.cluster, points: points.length, firstSize: first, lastSize: last, slope, forecastNext: Math.round(last + slope), trend: slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'stable' };
  }).sort((a, b) => b.slope - a.slope || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, risingCount: rows.filter(r => r.trend === 'rising').length, top: rows[0] || null, summary: `Infinity AI forecast cluster trends for ${rows.length} cluster(s); ${rows.filter(r => r.trend === 'rising').length} are rising.` };
}
/** Idea 53590 — Cluster-Driven Payload Breeding. */
export function breedPayloadsFromClusters(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const parents = Array.isArray(c.topPayloads) ? c.topPayloads.map(String) : Array.isArray(c.payloads) ? c.payloads.map(String) : [String(c.topPayload || 'base')];
    const bred = [];
    for (let i = 0; i < parents.length; i++) for (let j = i + 1; j < parents.length; j++) bred.push(`${parents[i]}+${parents[j]}`);
    if (!bred.length && parents.length) bred.push(`${parents[0]}-mutant`);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), parents, bred, bredCount: bred.length };
  }).sort((a, b) => b.bredCount - a.bredCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalBred: rows.reduce((s, r) => s + r.bredCount, 0), top: rows[0] || null, summary: `Infinity AI bred ${rows.reduce((s, r) => s + r.bredCount, 0)} candidate payload(s) from top cluster members.` };
}
/** Idea 53591 — Cluster Similarity Search. */
export function searchClusterSimilarity(clusters = [], query = {}) {
  const qCluster = String(query.cluster || query.target || query.key || '');
  const qVector = Array.isArray(query.vector) ? query.vector.map(v => num(v, 0)) : null;
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const vector = Array.isArray(c.vector) ? c.vector.map(v => num(v, 0)) : [];
    let similarity = 0;
    if (qVector && vector.length) {
      const len = Math.min(qVector.length, vector.length);
      let dot = 0; let qa = 0; let qb = 0;
      for (let i = 0; i < len; i++) { dot += qVector[i] * vector[i]; qa += qVector[i] * qVector[i]; qb += vector[i] * vector[i]; }
      similarity = qa && qb ? round2(dot / (Math.sqrt(qa) * Math.sqrt(qb))) : 0;
    } else similarity = clamp01(c.similarity ?? 0);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), similarity, match: qCluster ? String(c.cluster || '') === qCluster : similarity >= 0.7 };
  }).sort((a, b) => b.similarity - a.similarity || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, matchCount: rows.filter(r => r.match).length, top: rows[0] || null, summary: `Infinity AI searched cluster similarity and ranked ${rows.length} cluster(s) against the query.` };
}
/** Idea 53592 — Cluster Evolution Timelines. */
export function clusterEvolutionTimelines(events = []) {
  const grouped = new Map();
  for (const e of Array.isArray(events) ? events : []) {
    const cluster = String(e.cluster || e.clusterId || keyOf(e, 'cluster'));
    const g = grouped.get(cluster) || { key: cluster, cluster, events: [] };
    g.events.push({ at: num(e.timestamp ?? e.at, 0), type: String(e.type || e.event || 'observation'), size: num(e.size, 0) });
    grouped.set(cluster, g);
  }
  const rows = [...grouped.values()].map(g => {
    const timeline = [...g.events].sort((a, b) => a.at - b.at);
    return { key: g.key, cluster: g.cluster, events: timeline.length, timeline, firstAt: timeline.length ? timeline[0].at : 0, lastAt: timeline.length ? timeline[timeline.length - 1].at : 0, splits: timeline.filter(t => t.type === 'split').length, merges: timeline.filter(t => t.type === 'merge').length };
  }).sort((a, b) => b.events - a.events || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalEvents: rows.reduce((s, r) => s + r.events, 0), top: rows[0] || null, summary: `Infinity AI built evolution timelines for ${rows.length} cluster(s) covering ${rows.reduce((s, r) => s + r.events, 0)} event(s).` };
}
/** Idea 53593 — Cluster Membership Explanations. */
export function explainClusterMembership(memberships = []) {
  const rows = (Array.isArray(memberships) ? memberships : []).map(m => {
    const reasons = Array.isArray(m.reasons) ? m.reasons.map(String) : m.reason ? [String(m.reason)] : ['shared-signature'];
    const confidence = clamp01(m.confidence ?? m.score ?? 0.5);
    return { key: String(m.findingId || m.finding || keyOf(m, 'finding')), finding: String(m.findingId || m.finding || ''), cluster: String(m.cluster || ''), reasons, reasonCount: reasons.length, confidence, explanation: `Finding ${String(m.findingId || m.finding || 'finding')} belongs to ${String(m.cluster || 'cluster')} because ${reasons.join(', ')} (confidence ${confidence}).` };
  }).sort((a, b) => b.confidence - a.confidence || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, explainedCount: rows.length, averageConfidence: mean(rows.map(r => r.confidence)), top: rows[0] || null, summary: `Infinity AI explained cluster membership for ${rows.length} finding(s) with supporting reasons.` };
}
/** Idea 53594 — Cluster Quality Audits. */
export function auditClusterQuality(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const cohesion = clamp01(c.cohesion ?? 0.5);
    const purity = clamp01(c.purity ?? 0.5);
    const size = num(c.size ?? c.members ?? c.findings, 0);
    const quality = round2(0.5 * cohesion + 0.5 * purity);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), cohesion, purity, size, quality, grade: quality >= 0.75 ? 'good' : quality >= 0.5 ? 'fair' : 'poor' };
  }).sort((a, b) => b.quality - a.quality || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, goodCount: rows.filter(r => r.grade === 'good').length, averageQuality: mean(rows.map(r => r.quality)), top: rows[0] || null, summary: `Infinity AI audited cluster quality: ${rows.filter(r => r.grade === 'good').length} of ${rows.length} cluster(s) graded good.` };
}
/** Idea 53595 — Cluster-Based Training Curricula. */
export function clusterTrainingCurricula(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const difficulty = clamp01(c.difficulty ?? c.complexity ?? 0.5);
    const level = difficulty >= 0.7 ? 'advanced' : difficulty >= 0.4 ? 'intermediate' : 'beginner';
    const modules = [`${level}-fundamentals`, `${String(c.cluster || 'cluster')}-lab`, `${String(c.cluster || 'cluster')}-review`];
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), difficulty, level, modules, moduleCount: modules.length };
  }).sort((a, b) => a.difficulty - b.difficulty || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, curriculumCount: rows.length, top: rows[0] || null, summary: `Infinity AI built cluster-based training curricula for ${rows.length} cluster(s) ordered by difficulty.` };
}
/** Idea 53596 — Cluster Impact Dashboards. */
export function clusterImpactDashboards(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const findings = num(c.findings ?? c.count, 0);
    const targets = num(c.targets ?? c.affectedTargets, 0);
    const bounty = num(c.bounty ?? c.totalBounty, 0);
    const impact = round2(findings * 1 + targets * 3 + Math.min(bounty / 500, 10));
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), findings, targets, bounty, impact, tier: impact >= 20 ? 'critical-impact' : impact >= 8 ? 'high-impact' : 'standard' };
  }).sort((a, b) => b.impact - a.impact || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalImpact: round2(rows.reduce((s, r) => s + r.impact, 0)), criticalCount: rows.filter(r => r.tier === 'critical-impact').length, top: rows[0] || null, summary: `Infinity AI built cluster impact dashboards ranking ${rows.length} cluster(s) by operational impact.` };
}
/** Idea 53597 — Cluster Anomaly Detection. */
export function detectClusterAnomalies(clusters = [], options = {}) {
  const zAt = num(options.zAt, 1.5);
  const sizes = (Array.isArray(clusters) ? clusters : []).map(c => num(c.size ?? c.findings ?? c.members, 0));
  const avg = mean(sizes);
  const variance = sizes.length ? mean(sizes.map(s => (s - avg) * (s - avg))) : 0;
  const std = round2(Math.sqrt(variance));
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const size = num(c.size ?? c.findings ?? c.members, 0);
    const z = std ? round2(Math.abs(size - avg) / std) : 0;
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), size, zScore: z, anomaly: z >= zAt };
  }).sort((a, b) => b.zScore - a.zScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, anomalyCount: rows.filter(r => r.anomaly).length, meanSize: avg, stdSize: std, top: rows[0] || null, summary: `Infinity AI detected ${rows.filter(r => r.anomaly).length} anomalous cluster(s) by size deviation.` };
}
/** Idea 53598 — Cluster Cross-Referencing with CVE. */
export function crossReferenceClustersWithCve(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const cves = Array.isArray(c.cves) ? c.cves.map(String) : c.cve ? [String(c.cve)] : [];
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), cves: [...cves].sort(), cveCount: cves.length, linked: cves.length > 0 };
  }).sort((a, b) => b.cveCount - a.cveCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, linkedCount: rows.filter(r => r.linked).length, totalCves: rows.reduce((s, r) => s + r.cveCount, 0), top: rows[0] || null, summary: `Infinity AI cross-referenced ${rows.filter(r => r.linked).length} cluster(s) with known CVE records.` };
}
/** Idea 53599 — Cluster Naming Governance. */
export function governClusterNaming(clusters = []) {
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const name = String(c.name || c.cluster || '');
    const hasPrefix = name.startsWith('cluster-') || /^[A-Z]/.test(name);
    const tooLong = name.length > 60;
    const approved = c.approved === true;
    const compliant = hasPrefix && !tooLong;
    return { key: keyOf(c, 'cluster'), name, hasPrefix, tooLong, approved, compliant, status: approved && compliant ? 'approved' : compliant ? 'pending-review' : 'non-compliant' };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, compliantCount: rows.filter(r => r.compliant).length, approvedCount: rows.filter(r => r.status === 'approved').length, top: rows[0] || null, summary: `Infinity AI governed cluster naming: ${rows.filter(r => r.compliant).length} of ${rows.length} name(s) comply with the convention.` };
}
/** Idea 53600 — Cluster Retirement. */
export function retireClusters(clusters = [], options = {}) {
  const idleDaysAt = num(options.idleDaysAt, 180);
  const rows = (Array.isArray(clusters) ? clusters : []).map(c => {
    const idleDays = num(c.idleDays ?? c.daysSinceLastFinding, 0);
    const size = num(c.size ?? c.findings ?? c.members, 0);
    const shouldRetire = idleDays >= idleDaysAt || String(c.status || '') === 'retired';
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), idleDays, size, shouldRetire, status: shouldRetire ? 'retired' : 'active' };
  }).sort((a, b) => b.idleDays - a.idleDays || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, retiredCount: rows.filter(r => r.shouldRetire).length, activeCount: rows.filter(r => !r.shouldRetire).length, top: rows[0] || null, summary: `Infinity AI retired ${rows.filter(r => r.shouldRetire).length} idle cluster(s) and kept ${rows.filter(r => !r.shouldRetire).length} active.` };
}
