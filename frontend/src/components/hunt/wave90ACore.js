/**
 * wave90ACore.js — Infinity AI · Wave 90A
 * Failure forecasting + finding-cluster analytics, ideas 53561–53580: failure
 * trend forecasting, payload failure documentation standards, failure-driven
 * strategy pivots, annual failure analysis report, cross-hunt finding
 * embeddings, cluster naming and definitions, emerging cluster alerts, cluster
 * growth tracking, cluster-to-technique mapping, cluster severity profiles,
 * cluster stack affinities, cluster industry affinities, cluster lifecycles,
 * novel cluster verification, cluster deduplication, cluster split detection,
 * cluster hunting playbooks, cluster-based target prioritization, cluster
 * prediction models, and cluster co-occurrence analysis.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE90_A_IDEAS = [
  { id: 53561, title: 'Failure Trend Forecasting', skip: false },
  { id: 53562, title: 'Payload Failure Documentation Standards', skip: false },
  { id: 53563, title: 'Failure-Driven Strategy Pivots', skip: false },
  { id: 53564, title: 'Annual Failure Analysis Report', skip: false },
  { id: 53565, title: 'Cross-Hunt Finding Embeddings', skip: false },
  { id: 53566, title: 'Cluster Naming and Definitions', skip: false },
  { id: 53567, title: 'Emerging Cluster Alerts', skip: false },
  { id: 53568, title: 'Cluster Growth Tracking', skip: false },
  { id: 53569, title: 'Cluster-to-Technique Mapping', skip: false },
  { id: 53570, title: 'Cluster Severity Profiles', skip: false },
  { id: 53571, title: 'Cluster Stack Affinities', skip: false },
  { id: 53572, title: 'Cluster Industry Affinities', skip: false },
  { id: 53573, title: 'Cluster Lifecycles', skip: false },
  { id: 53574, title: 'Novel Cluster Verification', skip: false },
  { id: 53575, title: 'Cluster Deduplication', skip: false },
  { id: 53576, title: 'Cluster Split Detection', skip: false },
  { id: 53577, title: 'Cluster Hunting Playbooks', skip: false },
  { id: 53578, title: 'Cluster-Based Target Prioritization', skip: false },
  { id: 53579, title: 'Cluster Prediction Models', skip: false },
  { id: 53580, title: 'Cluster Co-Occurrence Analysis', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.id||it.clusterId||it.cluster||it.payloadId||it.payload||it.family||it.target||it.name||it.title||fb);}

/** Idea 53561 — Failure Trend Forecasting. Input points: {period, failures, attempts} or {period, failureRate}. Fits a linear slope and forecasts the next period. */
export function forecastFailureTrend(points = [], options = {}) {
  const sorted = [...(points || [])].sort((a, b) => String(a.period || '').localeCompare(String(b.period || '')));
  const rows = sorted.map((p, i) => {
    const failureRate = p.failureRate !== undefined ? clamp01(p.failureRate) : rate(num(p.failures, 0), num(p.attempts, 0));
    return { key: String(p.period || `p-${i}`), period: String(p.period || `p-${i}`), index: i, failures: num(p.failures, 0), attempts: num(p.attempts, 0), failureRate };
  });
  let slope = 0;
  if (rows.length > 1) {
    const xMean = mean(rows.map(r => r.index));
    const yMean = mean(rows.map(r => r.failureRate));
    const numSlope = rows.reduce((s, r) => s + (r.index - xMean) * (r.failureRate - yMean), 0);
    const denSlope = rows.reduce((s, r) => s + (r.index - xMean) * (r.index - xMean), 0);
    slope = denSlope ? round2(numSlope / denSlope) : 0;
  }
  const last = rows[rows.length - 1];
  const forecastNext = last ? clamp01(round2(last.failureRate + slope)) : 0;
  const trend = slope > 0.05 ? 'rising' : slope < -0.05 ? 'falling' : 'stable';
  return { rows, count: rows.length, slope, forecastNext, trend, top: last || null, summary: `Infinity AI forecast the failure trend as ${trend} with next-period rate ${forecastNext}.` };
}
/** Idea 53562 — Payload Failure Documentation Standards. Input failures: {payloadId|key, reason, defense, statusCode, hasNotes}. Scores documentation completeness against the Infinity AI standard. */
export function documentPayloadFailures(failures = [], options = {}) {
  const required = ['reason', 'defense', 'statusCode'];
  const rows = (failures || []).map(f => {
    const present = required.filter(k => f[k] !== undefined && f[k] !== '' && f[k] !== 0).length;
    const hasNotes = f.hasNotes === true || Boolean(f.notes);
    const completeness = round2((present + (hasNotes ? 1 : 0)) / (required.length + 1));
    return { key: keyOf(f, 'payload'), reason: String(f.reason || ''), defense: String(f.defense || ''), statusCode: num(f.statusCode, 0), hasNotes, completeness, compliant: completeness >= 0.75 };
  }).sort((a, b) => b.completeness - a.completeness || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  return { rows, count: rows.length, compliantCount, averageCompleteness: mean(rows.map(r => r.completeness)), top: rows[0] || null, summary: `Infinity AI checked payload failure documentation: ${compliantCount} of ${rows.length} record(s) meet the documentation standard.` };
}
/** Idea 53563 — Failure-Driven Strategy Pivots. Input families: {family|key, failureRate, attempts}. Recommends pivoting away from families above the failure threshold. */
export function pivotStrategyFromFailures(families = [], options = {}) {
  const pivotAt = num(options.pivotAt, 0.7);
  const rows = (families || []).map(f => {
    const failureRate = clamp01(f.failureRate ?? rate(num(f.failures, 0), num(f.attempts, 0)));
    return { key: keyOf(f, 'family'), family: String(f.family || keyOf(f, 'family')), failureRate, attempts: num(f.attempts, 0), pivot: failureRate >= pivotAt, action: failureRate >= pivotAt ? 'pivot' : failureRate >= 0.4 ? 'mutate' : 'continue' };
  }).sort((a, b) => b.failureRate - a.failureRate || String(a.key).localeCompare(String(b.key)));
  const pivotCount = rows.filter(r => r.pivot).length;
  return { rows, count: rows.length, pivotCount, top: rows[0] || null, summary: `Infinity AI recommended strategy pivots for ${pivotCount} payload family(ies) breaching the failure threshold.` };
}
/** Idea 53564 — Annual Failure Analysis Report. Input failures: {family, month, defense}. Aggregates a year of failures into family and monthly rows. */
export function annualFailureReport(failures = [], options = {}) {
  const year = num(options.year, 2026);
  const byFamily = new Map();
  const byMonth = new Map();
  for (const f of failures || []) {
    const family = String(f.family || 'general');
    const month = String(f.month || 'unknown');
    byFamily.set(family, (byFamily.get(family) || 0) + num(f.count, 1));
    byMonth.set(month, (byMonth.get(month) || 0) + num(f.count, 1));
  }
  const rows = [...byFamily.entries()].map(([family, count]) => ({ key: family, family, count, share: rate(count, (failures || []).reduce((s, f) => s + num(f.count, 1), 0)) }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
  const monthRows = [...byMonth.entries()].map(([month, count]) => ({ key: month, month, count })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, monthRows, monthCount: monthRows.length, totalFailures: rows.reduce((s, r) => s + r.count, 0), year, top: rows[0] || null, summary: `Infinity AI compiled the ${year} annual failure analysis report across ${rows.length} family(ies) and ${monthRows.length} month(s).` };
}
/** Idea 53565 — Cross-Hunt Finding Embeddings. Input findings: {id|key, hunt, vector|embedding|score, cluster}. Groups findings by embedding cluster for cross-hunt similarity. */
export function embedCrossHuntFindings(findings = []) {
  const grouped = new Map();
  for (const f of findings || []) {
    const cluster = String(f.cluster || f.embeddingCluster || 'unclustered');
    const g = grouped.get(cluster) || { key: cluster, cluster, findings: 0, hunts: new Set(), totalScore: 0 };
    g.findings += 1;
    g.hunts.add(String(f.hunt || f.huntId || 'hunt'));
    const score = Array.isArray(f.vector) ? mean(f.vector.map(v => clamp01(v))) : clamp01(f.score ?? f.similarity ?? 0.5);
    g.totalScore += score;
    grouped.set(cluster, g);
  }
  const rows = [...grouped.values()].map(g => ({ key: g.key, cluster: g.cluster, findings: g.findings, huntCount: g.hunts.size, hunts: [...g.hunts].sort(), avgScore: g.findings ? round2(g.totalScore / g.findings) : 0, crossHunt: g.hunts.size >= 2 }))
    .sort((a, b) => b.findings - a.findings || String(a.key).localeCompare(String(b.key)));
  const crossHuntCount = rows.filter(r => r.crossHunt).length;
  return { rows, count: rows.length, crossHuntCount, totalFindings: rows.reduce((s, r) => s + r.findings, 0), top: rows[0] || null, summary: `Infinity AI embedded findings across hunts and found ${crossHuntCount} cross-hunt cluster(s).` };
}
/** Idea 53566 — Cluster Naming and Definitions. Input clusters: {clusterId|key, name, definition, findings}. Validates names and definitions are present and unique. */
export function defineClusterNames(clusters = []) {
  const seen = new Set();
  const rows = (clusters || []).map(c => {
    const name = String(c.name || c.cluster || keyOf(c, 'cluster'));
    const definition = String(c.definition || '');
    const duplicate = seen.has(name.toLowerCase());
    seen.add(name.toLowerCase());
    return { key: keyOf(c, 'cluster'), name, definition, findingCount: num(c.findings ?? c.count, 0), named: name.length >= 3, defined: definition.length >= 10, duplicate };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const validCount = rows.filter(r => r.named && r.defined && !r.duplicate).length;
  return { rows, count: rows.length, validCount, duplicateCount: rows.filter(r => r.duplicate).length, top: rows[0] || null, summary: `Infinity AI validated cluster naming and definitions: ${validCount} cluster(s) fully named and defined.` };
}
/** Idea 53567 — Emerging Cluster Alerts. Input clusters: {clusterId|key, recentFindings, baselineFindings, windowDays}. Alerts when recent volume surges above baseline. */
export function alertEmergingClusters(clusters = [], options = {}) {
  const surgeAt = num(options.surgeAt, 2);
  const rows = (clusters || []).map(c => {
    const recent = num(c.recentFindings ?? c.recent, 0);
    const baseline = num(c.baselineFindings ?? c.baseline, 0);
    const growthRatio = baseline ? round2(recent / baseline) : recent > 0 ? recent : 0;
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), recent, baseline, growthRatio, emerging: growthRatio >= surgeAt && recent >= 3 };
  }).sort((a, b) => b.growthRatio - a.growthRatio || String(a.key).localeCompare(String(b.key)));
  const alertCount = rows.filter(r => r.emerging).length;
  return { rows, count: rows.length, alertCount, top: rows[0] || null, summary: `Infinity AI raised emerging-cluster alerts for ${alertCount} fast-growing cluster(s).` };
}
/** Idea 53568 — Cluster Growth Tracking. Input snapshots: {clusterId|key, period, size|count}. Tracks per-cluster growth between first and last snapshot. */
export function trackClusterGrowth(snapshots = []) {
  const grouped = new Map();
  for (const s of snapshots || []) {
    const cluster = String(s.cluster || s.clusterId || keyOf(s, 'cluster'));
    const g = grouped.get(cluster) || { key: cluster, cluster, points: [] };
    g.points.push({ period: String(s.period || ''), size: num(s.size ?? s.count, 0) });
    grouped.set(cluster, g);
  }
  const rows = [...grouped.values()].map(g => {
    const points = [...g.points].sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const first = points.length ? points[0].size : 0;
    const last = points.length ? points[points.length - 1].size : 0;
    const growth = last - first;
    return { key: g.key, cluster: g.cluster, points: points.length, firstSize: first, lastSize: last, growth, growthRate: first ? round2(growth / first) : 0 };
  }).sort((a, b) => b.growth - a.growth || String(a.key).localeCompare(String(b.key)));
  const growingCount = rows.filter(r => r.growth > 0).length;
  return { rows, count: rows.length, growingCount, top: rows[0] || null, summary: `Infinity AI tracked growth for ${rows.length} cluster(s); ${growingCount} are growing.` };
}
/** Idea 53569 — Cluster-to-Technique Mapping. Input clusters: {clusterId|key, technique, techniques, findings}. Maps each cluster to its dominant techniques. */
export function mapClustersToTechniques(clusters = []) {
  const rows = (clusters || []).map(c => {
    const techniques = Array.isArray(c.techniques) ? c.techniques.map(String) : c.technique ? [String(c.technique)] : [];
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), techniques: [...techniques].sort(), techniqueCount: techniques.length, primaryTechnique: [...techniques].sort()[0] || 'none', findings: num(c.findings ?? c.count, 0) };
  }).sort((a, b) => b.techniqueCount - a.techniqueCount || String(a.key).localeCompare(String(b.key)));
  const mappedCount = rows.filter(r => r.techniqueCount > 0).length;
  return { rows, count: rows.length, mappedCount, totalTechniques: rows.reduce((s, r) => s + r.techniqueCount, 0), top: rows[0] || null, summary: `Infinity AI mapped ${mappedCount} cluster(s) to their exploitation techniques.` };
}
/** Idea 53570 — Cluster Severity Profiles. Input clusters: {clusterId|key, findings, critical, high, medium, low} or per-finding severities. Computes a weighted severity score. */
export function profileClusterSeverity(clusters = []) {
  const weights = { critical: 4, high: 3, medium: 2, low: 1 };
  const rows = (clusters || []).map(c => {
    const critical = num(c.critical, 0); const high = num(c.high, 0); const medium = num(c.medium, 0); const low = num(c.low, 0);
    const total = num(c.findings ?? c.total, critical + high + medium + low);
    const weighted = total ? round2((critical * weights.critical + high * weights.high + medium * weights.medium + low * weights.low) / total) : 0;
    const dominant = critical >= high && critical >= medium && critical >= low && critical > 0 ? 'critical' : high >= medium && high >= low && high > 0 ? 'high' : medium >= low && medium > 0 ? 'medium' : 'low';
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), total, critical, high, medium, low, severityScore: weighted, dominantSeverity: dominant };
  }).sort((a, b) => b.severityScore - a.severityScore || String(a.key).localeCompare(String(b.key)));
  const criticalCount = rows.filter(r => r.dominantSeverity === 'critical').length;
  return { rows, count: rows.length, criticalCount, averageSeverity: mean(rows.map(r => r.severityScore)), top: rows[0] || null, summary: `Infinity AI profiled cluster severity: ${criticalCount} cluster(s) are critical-dominant.` };
}
/** Idea 53571 — Cluster Stack Affinities. Input findings: {cluster, stack, count}. Ranks stacks per cluster by finding volume. */
export function clusterStackAffinities(findings = []) {
  const grouped = new Map();
  for (const f of findings || []) {
    const cluster = String(f.cluster || f.clusterId || 'cluster');
    const stack = String(f.stack || f.tech || 'unknown');
    const key = `${cluster}|${stack}`;
    const g = grouped.get(key) || { key, cluster, stack, count: 0 };
    g.count += num(f.count, 1);
    grouped.set(key, g);
  }
  const totals = new Map();
  for (const g of grouped.values()) totals.set(g.cluster, (totals.get(g.cluster) || 0) + g.count);
  const rows = [...grouped.values()].map(g => ({ ...g, share: rate(g.count, totals.get(g.cluster) || 0), affinity: rate(g.count, totals.get(g.cluster) || 0) >= 0.5 ? 'strong' : 'moderate' }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, clusterCount: totals.size, totalFindings: rows.reduce((s, r) => s + r.count, 0), top: rows[0] || null, summary: `Infinity AI measured stack affinities across ${totals.size} cluster(s) from finding distributions.` };
}
/** Idea 53572 — Cluster Industry Affinities. Input findings: {cluster, industry, count}. Ranks industries per cluster. */
export function clusterIndustryAffinities(findings = []) {
  const grouped = new Map();
  for (const f of findings || []) {
    const cluster = String(f.cluster || f.clusterId || 'cluster');
    const industry = String(f.industry || f.vertical || 'unknown');
    const key = `${cluster}|${industry}`;
    const g = grouped.get(key) || { key, cluster, industry, count: 0 };
    g.count += num(f.count, 1);
    grouped.set(key, g);
  }
  const totals = new Map();
  for (const g of grouped.values()) totals.set(g.cluster, (totals.get(g.cluster) || 0) + g.count);
  const rows = [...grouped.values()].map(g => ({ ...g, share: rate(g.count, totals.get(g.cluster) || 0) }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, clusterCount: totals.size, industryCount: new Set(rows.map(r => r.industry)).size, top: rows[0] || null, summary: `Infinity AI measured industry affinities for ${totals.size} cluster(s) across ${new Set(rows.map(r => r.industry)).size} industry(ies).` };
}
/** Idea 53573 — Cluster Lifecycles. Input clusters: {clusterId|key, ageDays, recentFindings, totalFindings, status}. Classifies lifecycle stage from age and activity. */
export function clusterLifecycles(clusters = [], options = {}) {
  const rows = (clusters || []).map(c => {
    const ageDays = num(c.ageDays ?? c.age, 0);
    const recent = num(c.recentFindings ?? c.recent, 0);
    const total = num(c.totalFindings ?? c.findings, 0);
    const activity = total ? round2(recent / total) : 0;
    const stage = String(c.status || '') === 'retired' ? 'retired' : ageDays <= 30 && activity >= 0.5 ? 'emerging' : ageDays <= 180 ? 'growing' : activity >= 0.2 ? 'mature' : 'declining';
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), ageDays, recent, total, activity, stage };
  }).sort((a, b) => b.ageDays - a.ageDays || String(a.key).localeCompare(String(b.key)));
  const stageCounts = { emerging: rows.filter(r => r.stage === 'emerging').length, growing: rows.filter(r => r.stage === 'growing').length, mature: rows.filter(r => r.stage === 'mature').length, declining: rows.filter(r => r.stage === 'declining').length, retired: rows.filter(r => r.stage === 'retired').length };
  return { rows, count: rows.length, stageCounts, emergingCount: stageCounts.emerging, top: rows[0] || null, summary: `Infinity AI classified ${rows.length} cluster(s) into lifecycle stages (${stageCounts.emerging} emerging, ${stageCounts.mature} mature).` };
}
/** Idea 53574 — Novel Cluster Verification. Input clusters: {clusterId|key, similarityToKnown, memberCount, verified}. Flags clusters dissimilar enough to known ones as novel candidates. */
export function verifyNovelClusters(clusters = [], options = {}) {
  const novelBelow = num(options.novelBelow, 0.4);
  const rows = (clusters || []).map(c => {
    const similarity = clamp01(c.similarityToKnown ?? c.similarity ?? 0.5);
    const novel = similarity < novelBelow;
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), similarity, memberCount: num(c.memberCount ?? c.members ?? c.findings, 0), novel, verified: c.verified === true || (novel && num(c.memberCount ?? c.members, 0) >= 3) };
  }).sort((a, b) => a.similarity - b.similarity || String(a.key).localeCompare(String(b.key)));
  const novelCount = rows.filter(r => r.novel).length;
  return { rows, count: rows.length, novelCount, verifiedCount: rows.filter(r => r.verified).length, top: rows[0] || null, summary: `Infinity AI verified ${rows.filter(r => r.verified).length} novel cluster(s) dissimilar from every known cluster.` };
}
/** Idea 53575 — Cluster Deduplication. Input clusters: {clusterId|key, name, centroid|signature, members}. Detects near-duplicate cluster pairs by shared signature or name. */
export function deduplicateClusters(clusters = []) {
  const list = clusters || [];
  const pairs = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]; const b = list[j];
      const sigA = String(a.signature || a.centroid || a.name || '').toLowerCase();
      const sigB = String(b.signature || b.centroid || b.name || '').toLowerCase();
      const nameA = String(a.name || a.cluster || '').toLowerCase();
      const nameB = String(b.name || b.cluster || '').toLowerCase();
      const duplicate = sigA !== '' && sigA === sigB || nameA !== '' && nameA === nameB;
      if (duplicate) pairs.push({ key: `${keyOf(a, 'cluster')}|${keyOf(b, 'cluster')}`, a: keyOf(a, 'cluster'), b: keyOf(b, 'cluster'), reason: sigA === sigB ? 'signature' : 'name' });
    }
  }
  pairs.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const duplicateKeys = new Set(pairs.flatMap(p => [p.a, p.b]));
  return { rows: pairs, count: pairs.length, duplicateClusterCount: duplicateKeys.size, uniqueCount: list.length - duplicateKeys.size, top: pairs[0] || null, summary: `Infinity AI found ${pairs.length} duplicate cluster pair(s) covering ${duplicateKeys.size} cluster(s) for deduplication.` };
}
/** Idea 53576 — Cluster Split Detection. Input clusters: {clusterId|key, subGroups|subClusters, cohesion, members}. Detects clusters whose internal cohesion dropped enough to warrant a split. */
export function detectClusterSplits(clusters = [], options = {}) {
  const cohesionBelow = num(options.cohesionBelow, 0.4);
  const rows = (clusters || []).map(c => {
    const cohesion = clamp01(c.cohesion ?? 0.5);
    const subGroups = num(c.subGroups ?? c.subClusters, Array.isArray(c.subGroups) ? c.subGroups.length : 1);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), cohesion, subGroups, members: num(c.members ?? c.memberCount, 0), shouldSplit: cohesion < cohesionBelow && subGroups >= 2 };
  }).sort((a, b) => a.cohesion - b.cohesion || String(a.key).localeCompare(String(b.key)));
  const splitCount = rows.filter(r => r.shouldSplit).length;
  return { rows, count: rows.length, splitCount, top: rows[0] || null, summary: `Infinity AI detected ${splitCount} cluster(s) whose cohesion dropped enough to split.` };
}
/** Idea 53577 — Cluster Hunting Playbooks. Input clusters: {clusterId|key, technique, severity, findings}. Generates a step playbook per cluster from its technique and severity. */
export function clusterHuntingPlaybooks(clusters = []) {
  const rows = (clusters || []).map(c => {
    const technique = String(c.technique || (Array.isArray(c.techniques) ? c.techniques[0] : '') || 'general-probe');
    const severity = String(c.severity || c.dominantSeverity || 'medium');
    const steps = [`Enumerate targets matching the ${technique} surface`, `Run cluster payload family for ${technique}`, `Verify findings against cluster signature`, severity === 'critical' || severity === 'high' ? 'Escalate confirmed findings immediately' : 'Queue findings for standard review'];
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), technique, severity, steps, stepCount: steps.length, findings: num(c.findings, 0) };
  }).sort((a, b) => b.findings - a.findings || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, playbookCount: rows.length, totalSteps: rows.reduce((s, r) => s + r.stepCount, 0), top: rows[0] || null, summary: `Infinity AI generated hunting playbooks for ${rows.length} finding cluster(s).` };
}
/** Idea 53578 — Cluster-Based Target Prioritization. Input targets: {target|key, clusterMatches|matchedClusters, severityScore, bounty}. Scores targets by cluster coverage and severity. */
export function prioritizeTargetsByCluster(targets = []) {
  const rows = (targets || []).map(t => {
    const matches = Array.isArray(t.clusterMatches) ? t.clusterMatches.length : num(t.clusterMatches ?? t.matchedClusters, 0);
    const severityScore = clamp01(t.severityScore ?? t.severity ?? 0.5);
    const bounty = num(t.bounty ?? t.bountyValue, 0);
    const score = round2(matches * 2 + severityScore * 5 + Math.min(bounty / 1000, 3));
    return { key: keyOf(t, 'target'), target: String(t.target || keyOf(t, 'target')), clusterMatches: matches, severityScore, bounty, score, priority: score >= 8 ? 'high' : score >= 4 ? 'medium' : 'low' };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const highCount = rows.filter(r => r.priority === 'high').length;
  return { rows, count: rows.length, highCount, top: rows[0] || null, summary: `Infinity AI prioritized ${rows.length} target(s) by cluster coverage, ${highCount} at high priority.` };
}
/** Idea 53579 — Cluster Prediction Models. Input clusters: {clusterId|key, growthRate, severityScore, recentFindings}. Predicts next-period cluster size and risk. */
export function predictClusterModels(clusters = []) {
  const rows = (clusters || []).map(c => {
    const growthRate = clamp01(c.growthRate ?? 0.1);
    const currentSize = num(c.currentSize ?? c.size ?? c.findings, 0);
    const severityScore = clamp01(c.severityScore ?? c.severity ?? 0.5);
    const predictedSize = Math.round(currentSize * (1 + growthRate));
    const riskScore = round2(0.6 * growthRate + 0.4 * severityScore);
    return { key: keyOf(c, 'cluster'), cluster: String(c.cluster || keyOf(c, 'cluster')), currentSize, growthRate, predictedSize, severityScore, riskScore, risk: riskScore >= 0.6 ? 'high' : riskScore >= 0.35 ? 'medium' : 'low' };
  }).sort((a, b) => b.riskScore - a.riskScore || String(a.key).localeCompare(String(b.key)));
  const highRiskCount = rows.filter(r => r.risk === 'high').length;
  return { rows, count: rows.length, highRiskCount, averageRisk: mean(rows.map(r => r.riskScore)), top: rows[0] || null, summary: `Infinity AI predicted cluster growth and risk for ${rows.length} cluster(s), ${highRiskCount} high-risk.` };
}
/** Idea 53580 — Cluster Co-Occurrence Analysis. Input hunts/findings: {hunt, clusters[]}. Counts how often cluster pairs appear together. */
export function analyzeClusterCoOccurrence(records = []) {
  const pairCounts = new Map();
  const clusterCounts = new Map();
  for (const r of records || []) {
    const clusters = [...new Set((Array.isArray(r.clusters) ? r.clusters : r.cluster ? [r.cluster] : []).map(String))].sort();
    for (const c of clusters) clusterCounts.set(c, (clusterCounts.get(c) || 0) + 1);
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      const key = `${clusters[i]}|${clusters[j]}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
  }
  const rows = [...pairCounts.entries()].map(([key, count]) => {
    const [a, b] = key.split('|');
    const denom = Math.max(clusterCounts.get(a) || 0, clusterCounts.get(b) || 0);
    return { key, a, b, count, coRate: rate(count, denom) };
  }).sort((x, y) => y.count - x.count || String(x.key).localeCompare(String(y.key)));
  return { rows, count: rows.length, clusterCount: clusterCounts.size, top: rows[0] || null, summary: `Infinity AI analyzed cluster co-occurrence across ${clusterCounts.size} cluster(s) and ${rows.length} pair(s).` };
}
