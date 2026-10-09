/**
 * wave91BCores.js — Infinity AI · Wave 91B
 * Industry intelligence, ideas 53621–53640: industry strategy playbooks,
 * industry TTF benchmarks, industry compliance overlays, industry threat
 * actor profiles, industry stack preferences, industry seasonal
 * patterns, industry auth pattern catalogs, industry data sensitivity
 * maps, industry third-party risk patterns, industry API design trends,
 * industry mobile app patterns, industry legacy system prevalence,
 * industry cloud adoption curves, industry incident correlation,
 * industry benchmark reports, industry peer comparisons,
 * industry-specific payload packs, industry regulatory change tracking,
 * industry M&A security patterns, and industry startup-vs-enterprise
 * splits.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE91_B_IDEAS = [
  { id: 53621, title: 'Industry Strategy Playbooks', skip: false },
  { id: 53622, title: 'Industry TTF Benchmarks', skip: false },
  { id: 53623, title: 'Industry Compliance Overlays', skip: false },
  { id: 53624, title: 'Industry Threat Actor Profiles', skip: false },
  { id: 53625, title: 'Industry Stack Preferences', skip: false },
  { id: 53626, title: 'Industry Seasonal Patterns', skip: false },
  { id: 53627, title: 'Industry Auth Pattern Catalogs', skip: false },
  { id: 53628, title: 'Industry Data Sensitivity Maps', skip: false },
  { id: 53629, title: 'Industry Third-Party Risk Patterns', skip: false },
  { id: 53630, title: 'Industry API Design Trends', skip: false },
  { id: 53631, title: 'Industry Mobile App Patterns', skip: false },
  { id: 53632, title: 'Industry Legacy System Prevalence', skip: false },
  { id: 53633, title: 'Industry Cloud Adoption Curves', skip: false },
  { id: 53634, title: 'Industry Incident Correlation', skip: false },
  { id: 53635, title: 'Industry Benchmark Reports', skip: false },
  { id: 53636, title: 'Industry Peer Comparisons', skip: false },
  { id: 53637, title: 'Industry-Specific Payload Packs', skip: false },
  { id: 53638, title: 'Industry Regulatory Change Tracking', skip: false },
  { id: 53639, title: 'Industry M&A Security Patterns', skip: false },
  { id: 53640, title: 'Industry Startup-vs-Enterprise Splits', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.industry||it.id||it.org||fb);}

/** Idea 53621 — Industry Strategy Playbooks. Input records: {industry, strategy, wins, attempts}. Picks the best strategy per industry by win rate. */
export function industryStrategyPlaybooks(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, options: [] };
    const wins = num(r.wins, 0);
    const attempts = num(r.attempts, 0);
    g.options.push({ strategy: String(r.strategy || 'strategy'), wins, attempts, winRate: rate(wins, attempts) });
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const best = [...g.options].sort((a, b) => b.winRate - a.winRate || String(a.strategy).localeCompare(String(b.strategy)))[0];
    return { key: g.key, industry: g.industry, strategy: best.strategy, winRate: best.winRate, wins: best.wins, attempts: best.attempts };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, playbookCount: rows.length, top: rows[0] || null, summary: `Infinity AI built strategy playbooks for ${rows.length} industry(ies) from win rates.` };
}
/** Idea 53622 — Industry TTF Benchmarks. Input records: {industry, ttfHours|hours}. Median time-to-finding per industry; fastest industry first. */
export function benchmarkIndustryTtf(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, values: [] };
    g.values.push(num(r.ttfHours ?? r.hours, 0));
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => ({ key: g.key, industry: g.industry, samples: g.values.length, medianTtf: median(g.values) })).sort((a, b) => a.medianTtf - b.medianTtf || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, fastest: rows[0] ? rows[0].industry : null, top: rows[0] || null, summary: `Infinity AI benchmarked time-to-finding for ${rows.length} industry(ies); fastest is ${rows[0] ? rows[0].industry : 'none'}.` };
}
/** Idea 53623 — Industry Compliance Overlays. Input records: {industry, regulation, findingTypes[]|types}. Maps finding types onto each regulation overlay. */
export function overlayIndustryCompliance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const industry = String(r.industry || 'industry');
    const regulation = String(r.regulation || 'regulation');
    const types = Array.isArray(r.findingTypes) ? r.findingTypes.map(String) : Array.isArray(r.types) ? r.types.map(String) : [];
    return { key: `${industry}|${regulation}`, industry, regulation, findingTypes: [...types].sort(), typeCount: types.length };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const findingsMapped = rows.reduce((s, r) => s + r.typeCount, 0);
  return { rows, count: rows.length, overlayCount: rows.length, findingsMapped, top: rows[0] || null, summary: `Infinity AI overlaid compliance rules on ${rows.length} industry record(s), mapping ${findingsMapped} finding type(s).` };
}
/** Idea 53624 — Industry Threat Actor Profiles. Input records: {industry, actor, ttps[]|count}. Groups distinct actors per industry with their technique totals. */
export function profileIndustryThreatActors(records = []) {
  const grouped = new Map();
  let pairs = 0;
  const seenPairs = new Set();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const actor = String(r.actor || 'actor');
    const pairKey = `${industry}|${actor}`;
    if (!seenPairs.has(pairKey)) { seenPairs.add(pairKey); pairs += 1; }
    const g = grouped.get(industry) || { key: industry, industry, actors: new Set(), totalTtps: 0 };
    g.actors.add(actor);
    g.totalTtps += Array.isArray(r.ttps) ? r.ttps.length : num(r.count, 0);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => ({ key: g.key, industry: g.industry, actors: [...g.actors].sort(), actorCount: g.actors.size, totalTtps: g.totalTtps })).sort((a, b) => b.actorCount - a.actorCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, profileCount: pairs, top: rows[0] || null, summary: `Infinity AI profiled threat actors for ${rows.length} industry(ies) covering ${pairs} actor profile(s).` };
}
/** Idea 53625 — Industry Stack Preferences. Input records: {industry, stack, count}. Dominant stack per industry with its share of volume. */
export function documentIndustryStackPreferences(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, total: 0, byStack: new Map() };
    const count = num(r.count, 1);
    g.total += count;
    const stack = String(r.stack || 'stack');
    g.byStack.set(stack, (g.byStack.get(stack) || 0) + count);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const best = [...g.byStack.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0] || ['stack', 0];
    return { key: g.key, industry: g.industry, stack: best[0], stackCount: best[1], total: g.total, share: rate(best[1], g.total) };
  }).sort((a, b) => b.share - a.share || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, industryCount: rows.length, top: rows[0] || null, summary: `Infinity AI recorded dominant stack preferences for ${rows.length} industry(ies).` };
}
/** Idea 53626 — Industry Seasonal Patterns. Input records: {industry, season, count}. Peak season per industry by finding volume. */
export function trackIndustrySeasonalPatterns(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, bySeason: new Map() };
    const season = String(r.season || 'season');
    g.bySeason.set(season, (g.bySeason.get(season) || 0) + num(r.count, 1));
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const best = [...g.bySeason.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0] || ['season', 0];
    return { key: g.key, industry: g.industry, peakSeason: best[0], peakCount: best[1] };
  }).sort((a, b) => b.peakCount - a.peakCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, industries: rows.length, industryCount: rows.length, top: rows[0] || null, summary: `Infinity AI tracked seasonal peaks for ${rows.length} industry(ies).` };
}
/** Idea 53627 — Industry Auth Pattern Catalogs. Input records: {industry, authPattern, count}. Dominant auth pattern per industry; catalog counts distinct industry-pattern pairs. */
export function catalogIndustryAuthPatterns(records = []) {
  const grouped = new Map();
  const pairs = new Set();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const pattern = String(r.authPattern || r.pattern || 'pattern');
    pairs.add(`${industry}|${pattern}`);
    const g = grouped.get(industry) || { key: industry, industry, byPattern: new Map(), total: 0 };
    const count = num(r.count, 1);
    g.total += count;
    g.byPattern.set(pattern, (g.byPattern.get(pattern) || 0) + count);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const best = [...g.byPattern.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0] || ['pattern', 0];
    return { key: g.key, industry: g.industry, authPattern: best[0], patternCount: best[1], share: rate(best[1], g.total) };
  }).sort((a, b) => b.share - a.share || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, catalogCount: pairs.size, industryCount: rows.length, top: rows[0] || null, summary: `Infinity AI cataloged auth patterns for ${rows.length} industry(ies) across ${pairs.size} catalog entr(ies).` };
}
/** Idea 53628 — Industry Data Sensitivity Maps. Input records: {industry, dataType, sensitivity, count}. Hotspots are records at sensitivity >= 0.8, highest first. */
export function mapIndustryDataSensitivity(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const industry = String(r.industry || 'industry');
    const dataType = String(r.dataType || 'data');
    const sensitivity = clamp01(r.sensitivity ?? 0);
    return { key: `${industry}|${dataType}`, industry, dataType, sensitivity, count: num(r.count, 0), hotspot: sensitivity >= 0.8 };
  }).sort((a, b) => b.sensitivity - a.sensitivity || String(a.key).localeCompare(String(b.key)));
  const hotspotCount = rows.filter(r => r.hotspot).length;
  return { rows, count: rows.length, hotspotCount, top: rows[0] || null, summary: `Infinity AI mapped data sensitivity and flagged ${hotspotCount} hotspot(s) needing strict handling.` };
}
/** Idea 53629 — Industry Third-Party Risk Patterns. Input records: {industry, vendor, riskScore, count}. Rows sorted by risk; high risk at score >= 0.7. */
export function assessIndustryThirdPartyRisk(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const industry = String(r.industry || 'industry');
    const vendor = String(r.vendor || 'vendor');
    const riskScore = clamp01(r.riskScore ?? 0);
    return { key: `${industry}|${vendor}`, industry, vendor, riskScore, count: num(r.count, 0), highRisk: riskScore >= 0.7 };
  }).sort((a, b) => b.riskScore - a.riskScore || String(a.key).localeCompare(String(b.key)));
  const highRiskCount = rows.filter(r => r.highRisk).length;
  return { rows, count: rows.length, highRiskCount, top: rows[0] || null, summary: `Infinity AI assessed third-party risk in ${rows.length} record(s); ${highRiskCount} vendor(s) are high risk.` };
}
/** Idea 53630 — Industry API Design Trends. Input records: {industry, apiPattern, flawCount, count}. Groups flaws by industry and API pattern. */
export function trackIndustryApiDesignTrends(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const apiPattern = String(r.apiPattern || r.pattern || 'rest');
    const key = `${industry}|${apiPattern}`;
    const g = grouped.get(key) || { key, industry, apiPattern, flawCount: 0, count: 0 };
    g.flawCount += num(r.flawCount, 0);
    g.count += num(r.count, 0);
    grouped.set(key, g);
  }
  const rows = [...grouped.values()].sort((a, b) => b.flawCount - a.flawCount || String(a.key).localeCompare(String(b.key)));
  const totalFlaws = rows.reduce((s, r) => s + r.flawCount, 0);
  return { rows, count: rows.length, trendCount: rows.length, totalFlaws, top: rows[0] || null, summary: `Infinity AI tracked API design trends across ${rows.length} pattern group(s) with ${totalFlaws} flaw(s).` };
}
/** Idea 53631 — Industry Mobile App Patterns. Input records: {industry, pattern, count}. Dominant mobile pattern per industry. */
export function profileIndustryMobilePatterns(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, byPattern: new Map(), total: 0 };
    const pattern = String(r.pattern || 'pattern');
    const count = num(r.count, 1);
    g.total += count;
    g.byPattern.set(pattern, (g.byPattern.get(pattern) || 0) + count);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const best = [...g.byPattern.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0] || ['pattern', 0];
    return { key: g.key, industry: g.industry, pattern: best[0], patternCount: best[1], share: rate(best[1], g.total) };
  }).sort((a, b) => b.share - a.share || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, industryCount: rows.length, top: rows[0] || null, summary: `Infinity AI profiled mobile app patterns for ${rows.length} industry(ies).` };
}
/** Idea 53632 — Industry Legacy System Prevalence. Input records: {industry, totalSystems, legacySystems, legacyFindings}. Legacy share per industry; high at share >= 0.5. */
export function measureIndustryLegacyPrevalence(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, totalSystems: 0, legacySystems: 0, legacyFindings: 0 };
    g.totalSystems += num(r.totalSystems, 0);
    g.legacySystems += num(r.legacySystems, 0);
    g.legacyFindings += num(r.legacyFindings, 0);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => ({ ...g, legacyShare: rate(g.legacySystems, g.totalSystems), highLegacy: rate(g.legacySystems, g.totalSystems) >= 0.5 })).sort((a, b) => b.legacyShare - a.legacyShare || String(a.key).localeCompare(String(b.key)));
  const highLegacyCount = rows.filter(r => r.highLegacy).length;
  return { rows, count: rows.length, industryCount: rows.length, highLegacyCount, top: rows[0] || null, summary: `Infinity AI measured legacy prevalence in ${rows.length} industry(ies); ${highLegacyCount} are legacy-heavy.` };
}
/** Idea 53633 — Industry Cloud Adoption Curves. Input records: {industry, period, cloudShare}. Delta is last minus first share per industry; migrating when delta > 0. */
export function trackIndustryCloudAdoption(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, points: [] };
    g.points.push({ period: String(r.period || ''), cloudShare: clamp01(r.cloudShare ?? 0) });
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const points = [...g.points].sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const firstShare = points.length ? points[0].cloudShare : 0;
    const lastShare = points.length ? points[points.length - 1].cloudShare : 0;
    return { key: g.key, industry: g.industry, firstShare, lastShare, delta: round2(lastShare - firstShare), migrating: round2(lastShare - firstShare) > 0 };
  }).sort((a, b) => b.delta - a.delta || String(a.key).localeCompare(String(b.key)));
  const migratingCount = rows.filter(r => r.migrating).length;
  return { rows, count: rows.length, migratingCount, industryCount: rows.length, top: rows[0] || null, summary: `Infinity AI tracked cloud adoption for ${rows.length} industry(ies); ${migratingCount} are still migrating.` };
}
/** Idea 53634 — Industry Incident Correlation. Input records: {industry, findings, publicIncidents}. Score is min/max of the two volumes; correlated at score >= 0.5. */
export function correlateIndustryIncidents(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const findings = num(r.findings, 0);
    const incidents = num(r.publicIncidents ?? r.incidents, 0);
    const score = findings || incidents ? round2(Math.min(findings, incidents) / Math.max(findings, incidents)) : 0;
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), findings, publicIncidents: incidents, score, correlated: score >= 0.5 };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const correlatedCount = rows.filter(r => r.correlated).length;
  return { rows, count: rows.length, correlatedCount, top: rows[0] || null, summary: `Infinity AI correlated findings with public incidents in ${rows.length} industry(ies); ${correlatedCount} track closely.` };
}
/** Idea 53635 — Industry Benchmark Reports. Input records: {industry, metric, value} plus options {quarter}. Averages the metric per industry into an anonymized report row. */
export function publishIndustryBenchmarkReports(records = [], options = {}) {
  const quarter = String(options.quarter || '2026-Q4');
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, values: [] };
    g.values.push(num(r.value, 0));
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => ({ key: g.key, industry: g.industry, samples: g.values.length, averageValue: mean(g.values), quarter })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, reportCount: rows.length, quarter, anonymized: true, top: rows[0] || null, summary: `Infinity AI published anonymized benchmark reports for ${rows.length} industry(ies) for ${quarter}.` };
}
/** Idea 53636 — Industry Peer Comparisons. Input orgs: {org, industry, score, optIn}. Only opted-in orgs are compared; percentile is the share of industry peers scored below. */
export function compareIndustryPeerPosture(orgs = []) {
  const opted = (Array.isArray(orgs) ? orgs : []).filter(o => o.optIn === true);
  const byIndustry = new Map();
  for (const o of opted) {
    const industry = String(o.industry || 'industry');
    const list = byIndustry.get(industry) || [];
    list.push(o);
    byIndustry.set(industry, list);
  }
  const rows = opted.map(o => {
    const industry = String(o.industry || 'industry');
    const score = num(o.score, 0);
    const peers = byIndustry.get(industry) || [];
    const below = peers.filter(p => num(p.score, 0) < score).length;
    const percentile = peers.length > 1 ? round2((below / (peers.length - 1)) * 100) : 100;
    const org = String(o.org || 'org');
    return { key: org, org, industry, score, percentile, peerCount: peers.length };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, comparedCount: rows.length, top: rows[0] || null, summary: `Infinity AI compared peer posture for ${rows.length} opted-in org(s) within their industries.` };
}
/** Idea 53637 — Industry-Specific Payload Packs. Input records: {industry, stack, payloads[]}. Merges payloads per industry into a sorted unique pack. */
export function curateIndustryPayloadPacks(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, payloads: new Set(), stacks: new Set() };
    for (const p of Array.isArray(r.payloads) ? r.payloads : []) g.payloads.add(String(p));
    if (r.stack) g.stacks.add(String(r.stack));
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => ({ key: g.key, industry: g.industry, stacks: [...g.stacks].sort(), payloads: [...g.payloads].sort(), payloadCount: g.payloads.size })).sort((a, b) => b.payloadCount - a.payloadCount || String(a.key).localeCompare(String(b.key)));
  const totalPayloads = rows.reduce((s, r) => s + r.payloadCount, 0);
  return { rows, count: rows.length, packCount: rows.length, totalPayloads, top: rows[0] || null, summary: `Infinity AI curated payload packs for ${rows.length} industry(ies) with ${totalPayloads} payload(s).` };
}
/** Idea 53638 — Industry Regulatory Change Tracking. Input changes: {industry, change, effectOnPriority|priorityDelta, effective}. Sorted by priority delta; high impact at delta >= 2. */
export function trackIndustryRegulatoryChanges(changes = []) {
  const rows = (Array.isArray(changes) ? changes : []).map(c => {
    const industry = String(c.industry || 'industry');
    const change = String(c.change || 'change');
    const delta = num(c.effectOnPriority ?? c.priorityDelta, 0);
    return { key: `${industry}|${change}`, industry, change, priorityDelta: delta, effective: String(c.effective || ''), highImpact: delta >= 2 };
  }).sort((a, b) => b.priorityDelta - a.priorityDelta || String(a.key).localeCompare(String(b.key)));
  const highImpactCount = rows.filter(r => r.highImpact).length;
  return { rows, count: rows.length, highImpactCount, changeCount: rows.length, top: rows[0] || null, summary: `Infinity AI tracked ${rows.length} regulatory change(s); ${highImpactCount} shift hunt priority sharply.` };
}
/** Idea 53639 — Industry M&A Security Patterns. Input deals: {industry, acquirer, preScore, postScore}. Delta is post minus pre; worsened when delta < 0. */
export function analyzeIndustryMaSecurityPatterns(deals = []) {
  const rows = (Array.isArray(deals) ? deals : []).map(d => {
    const industry = String(d.industry || 'industry');
    const preScore = num(d.preScore, 0);
    const postScore = num(d.postScore, 0);
    const delta = round2(postScore - preScore);
    return { key: `${industry}|${String(d.acquirer || 'deal')}`, industry, acquirer: String(d.acquirer || ''), preScore, postScore, delta, worsened: delta < 0 };
  }).sort((a, b) => a.delta - b.delta || String(a.key).localeCompare(String(b.key)));
  const worsenedCount = rows.filter(r => r.worsened).length;
  return { rows, count: rows.length, dealCount: rows.length, worsenedCount, avgDelta: mean(rows.map(r => r.delta)), top: rows[0] || null, summary: `Infinity AI reviewed security posture across ${rows.length} acquisition deal(s); ${worsenedCount} worsened after close.` };
}
/** Idea 53640 — Industry Startup-vs-Enterprise Splits. Input records: {industry, segment, findingRate|rate, count}. Per industry, gap is the absolute rate split between segments. */
export function splitIndustryStartupEnterprise(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const segment = String(r.segment || '') === 'enterprise' ? 'enterprise' : 'startup';
    const findingRate = clamp01(r.findingRate ?? r.rate ?? 0);
    const g = grouped.get(industry) || { key: industry, industry, startupRates: [], enterpriseRates: [] };
    if (segment === 'enterprise') g.enterpriseRates.push(findingRate); else g.startupRates.push(findingRate);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const startupRate = g.startupRates.length ? mean(g.startupRates) : null;
    const enterpriseRate = g.enterpriseRates.length ? mean(g.enterpriseRates) : null;
    const hasBoth = startupRate !== null && enterpriseRate !== null;
    return { key: g.key, industry: g.industry, startupRate, enterpriseRate, gap: hasBoth ? round2(Math.abs(startupRate - enterpriseRate)) : 0, hasBoth };
  }).sort((a, b) => b.gap - a.gap || String(a.key).localeCompare(String(b.key)));
  const splitCount = rows.filter(r => r.hasBoth).length;
  return { rows, count: rows.length, splitCount, industryCount: rows.length, top: rows[0] || null, summary: `Infinity AI split startup and enterprise finding rates for ${splitCount} industry(ies) with both segments present.` };
}
