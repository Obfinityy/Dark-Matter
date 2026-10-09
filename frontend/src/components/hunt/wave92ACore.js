/**
 * wave92ACore.js — Infinity AI · Wave 92A
 * Industry intelligence, ideas 53641–53660: industry bug bounty
 * economics, industry disclosure norms, industry security maturity
 * models, industry conference intelligence, industry threat briefings,
 * industry hunt scheduling guides, industry-specific training tracks,
 * industry talent benchmarks, industry tool effectiveness, industry
 * supply chain patterns, industry ransomware exposure indicators,
 * industry data residency patterns, industry identity provider trends,
 * industry payment flow patterns, industry IoT exposure profiles,
 * industry AI adoption security, industry remote work patterns,
 * industry vendor concentration risks, industry open source usage,
 * and industry security hiring signals.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE92_A_IDEAS = [
  { id: 53641, title: 'Industry Bug Bounty Economics', skip: false },
  { id: 53642, title: 'Industry Disclosure Norms', skip: false },
  { id: 53643, title: 'Industry Security Maturity Models', skip: false },
  { id: 53644, title: 'Industry Conference Intelligence', skip: false },
  { id: 53645, title: 'Industry Threat Briefings', skip: false },
  { id: 53646, title: 'Industry Hunt Scheduling Guides', skip: false },
  { id: 53647, title: 'Industry-Specific Training Tracks', skip: false },
  { id: 53648, title: 'Industry Talent Benchmarks', skip: false },
  { id: 53649, title: 'Industry Tool Effectiveness', skip: false },
  { id: 53650, title: 'Industry Supply Chain Patterns', skip: false },
  { id: 53651, title: 'Industry Ransomware Exposure Indicators', skip: false },
  { id: 53652, title: 'Industry Data Residency Patterns', skip: false },
  { id: 53653, title: 'Industry Identity Provider Trends', skip: false },
  { id: 53654, title: 'Industry Payment Flow Patterns', skip: false },
  { id: 53655, title: 'Industry IoT Exposure Profiles', skip: false },
  { id: 53656, title: 'Industry AI Adoption Security', skip: false },
  { id: 53657, title: 'Industry Remote Work Patterns', skip: false },
  { id: 53658, title: 'Industry Vendor Concentration Risks', skip: false },
  { id: 53659, title: 'Industry Open Source Usage', skip: false },
  { id: 53660, title: 'Industry Security Hiring Signals', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.industry||it.id||it.name||fb);}

/** Idea 53641 — Industry Bug Bounty Economics. Input records: {industry, bountyPaid, findings}. Groups by industry and computes average bounty per finding. */
export function analyzeIndustryBugBountyEconomics(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, bountyPaid: 0, findings: 0 };
    g.bountyPaid += num(r.bountyPaid ?? r.totalBounty, 0);
    g.findings += num(r.findings, 0);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => ({ ...g, avgBounty: g.findings ? round2(g.bountyPaid / g.findings) : 0 })).sort((a, b) => b.avgBounty - a.avgBounty || String(a.key).localeCompare(String(b.key)));
  const totalBounty = rows.reduce((s, r) => s + r.bountyPaid, 0);
  return { rows, count: rows.length, totalBounty, top: rows[0] || null, summary: `Infinity AI analyzed bug bounty economics for ${rows.length} industry(ies) totaling ${totalBounty}.` };
}
/** Idea 53642 — Industry Disclosure Norms. Input records: {industry, disclosed, total}. Disclosure rate per industry; open at rate >= 0.8, selective at >= 0.5, otherwise closed. */
export function trackIndustryDisclosureNorms(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const disclosed = num(r.disclosed, 0);
    const total = num(r.total, 0);
    const disclosureRate = rate(disclosed, total);
    const norm = disclosureRate >= 0.8 ? 'open' : disclosureRate >= 0.5 ? 'selective' : 'closed';
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), disclosed, total, disclosureRate, norm };
  }).sort((a, b) => b.disclosureRate - a.disclosureRate || String(a.key).localeCompare(String(b.key)));
  const openCount = rows.filter(r => r.norm === 'open').length;
  return { rows, count: rows.length, openCount, top: rows[0] || null, summary: `Infinity AI tracked disclosure norms for ${rows.length} industry(ies); ${openCount} are open.` };
}
/** Idea 53643 — Industry Security Maturity Models. Input records: {industry, implemented, totalControls}. Maturity is implemented over total controls; advanced at >= 0.8, intermediate at >= 0.5. */
export function assessIndustrySecurityMaturity(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const implemented = num(r.implemented, 0);
    const totalControls = num(r.totalControls ?? r.total, 0);
    const maturity = rate(implemented, totalControls);
    const level = maturity >= 0.8 ? 'advanced' : maturity >= 0.5 ? 'intermediate' : 'basic';
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), implemented, totalControls, maturity, level };
  }).sort((a, b) => b.maturity - a.maturity || String(a.key).localeCompare(String(b.key)));
  const advancedCount = rows.filter(r => r.level === 'advanced').length;
  return { rows, count: rows.length, advancedCount, averageMaturity: mean(rows.map(r => r.maturity)), top: rows[0] || null, summary: `Infinity AI assessed security maturity for ${rows.length} industry(ies); ${advancedCount} are advanced.` };
}
/** Idea 53644 — Industry Conference Intelligence. Input records: {industry, events, talks}. Talks per event per industry. */
export function gatherIndustryConferenceIntelligence(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const events = num(r.events, 0);
    const talks = num(r.talks, 0);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), events, talks, talksPerEvent: rate(talks, events) };
  }).sort((a, b) => b.talksPerEvent - a.talksPerEvent || String(a.key).localeCompare(String(b.key)));
  const totalTalks = rows.reduce((s, r) => s + r.talks, 0);
  return { rows, count: rows.length, totalTalks, top: rows[0] || null, summary: `Infinity AI gathered conference intelligence for ${rows.length} industry(ies) with ${totalTalks} talk(s).` };
}
/** Idea 53645 — Industry Threat Briefings. Input records: {industry, threats, critical}. Critical share per industry; urgent at share >= 0.5. */
export function briefIndustryThreats(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const threats = num(r.threats, 0);
    const critical = num(r.critical, 0);
    const criticalShare = rate(critical, threats);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), threats, critical, criticalShare, urgent: criticalShare >= 0.5 };
  }).sort((a, b) => b.criticalShare - a.criticalShare || String(a.key).localeCompare(String(b.key)));
  const urgentCount = rows.filter(r => r.urgent).length;
  return { rows, count: rows.length, urgentCount, briefingCount: rows.length, top: rows[0] || null, summary: `Infinity AI briefed threats for ${rows.length} industry(ies); ${urgentCount} need urgent attention.` };
}
/** Idea 53646 — Industry Hunt Scheduling Guides. Input records: {industry, hunts, windowDays}. Hunts per day; busy at >= 2. */
export function guideIndustryHuntScheduling(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const hunts = num(r.hunts, 0);
    const windowDays = num(r.windowDays ?? r.days, 0);
    const huntsPerDay = rate(hunts, windowDays);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), hunts, windowDays, huntsPerDay, busy: huntsPerDay >= 2 };
  }).sort((a, b) => b.huntsPerDay - a.huntsPerDay || String(a.key).localeCompare(String(b.key)));
  const busyCount = rows.filter(r => r.busy).length;
  return { rows, count: rows.length, busyCount, guideCount: rows.length, top: rows[0] || null, summary: `Infinity AI built hunt scheduling guides for ${rows.length} industry(ies); ${busyCount} run at a busy cadence.` };
}
/** Idea 53647 — Industry-Specific Training Tracks. Input records: {industry, track, learners, completions}. Completion rate per track; effective at >= 0.7. */
export function buildIndustryTrainingTracks(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const industry = String(r.industry || 'industry');
    const track = String(r.track || 'track');
    const learners = num(r.learners, 0);
    const completions = num(r.completions, 0);
    const completionRate = rate(completions, learners);
    return { key: `${industry}|${track}`, industry, track, learners, completions, completionRate, effective: completionRate >= 0.7 };
  }).sort((a, b) => b.completionRate - a.completionRate || String(a.key).localeCompare(String(b.key)));
  const effectiveCount = rows.filter(r => r.effective).length;
  return { rows, count: rows.length, effectiveCount, trackCount: rows.length, top: rows[0] || null, summary: `Infinity AI built training tracks for ${rows.length} industry track(s); ${effectiveCount} are effective.` };
}
/** Idea 53648 — Industry Talent Benchmarks. Input records: {industry, researchers, experts}. Expert share per industry; benchmark at share >= 0.3. */
export function benchmarkIndustryTalent(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researchers = num(r.researchers, 0);
    const experts = num(r.experts, 0);
    const expertShare = rate(experts, researchers);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), researchers, experts, expertShare, benchmark: expertShare >= 0.3 };
  }).sort((a, b) => b.expertShare - a.expertShare || String(a.key).localeCompare(String(b.key)));
  const benchmarkCount = rows.filter(r => r.benchmark).length;
  return { rows, count: rows.length, benchmarkCount, top: rows[0] || null, summary: `Infinity AI benchmarked talent for ${rows.length} industry(ies); ${benchmarkCount} meet the expert benchmark.` };
}
/** Idea 53649 — Industry Tool Effectiveness. Input records: {industry, tool, detections, falsePositives}. Precision is detections over detections plus false positives; effective at >= 0.8. */
export function measureIndustryToolEffectiveness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const industry = String(r.industry || 'industry');
    const tool = String(r.tool || 'tool');
    const detections = num(r.detections, 0);
    const falsePositives = num(r.falsePositives, 0);
    const effectiveness = rate(detections, detections + falsePositives);
    return { key: `${industry}|${tool}`, industry, tool, detections, falsePositives, effectiveness, effective: effectiveness >= 0.8 };
  }).sort((a, b) => b.effectiveness - a.effectiveness || String(a.key).localeCompare(String(b.key)));
  const effectiveCount = rows.filter(r => r.effective).length;
  return { rows, count: rows.length, effectiveCount, top: rows[0] || null, summary: `Infinity AI measured tool effectiveness across ${rows.length} industry tool(s); ${effectiveCount} are effective.` };
}
/** Idea 53650 — Industry Supply Chain Patterns. Input records: {industry, suppliers, incidents}. Incident rate per supplier; risky at >= 0.5. */
export function mapIndustrySupplyChainPatterns(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const suppliers = num(r.suppliers, 0);
    const incidents = num(r.incidents, 0);
    const incidentRate = rate(incidents, suppliers);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), suppliers, incidents, incidentRate, risky: incidentRate >= 0.5 };
  }).sort((a, b) => b.incidentRate - a.incidentRate || String(a.key).localeCompare(String(b.key)));
  const riskyCount = rows.filter(r => r.risky).length;
  return { rows, count: rows.length, riskyCount, patternCount: rows.length, top: rows[0] || null, summary: `Infinity AI mapped supply chain patterns for ${rows.length} industry(ies); ${riskyCount} are risky.` };
}
/** Idea 53651 — Industry Ransomware Exposure Indicators. Input records: {industry, systems, vulnerable}. Exposure is vulnerable over systems; high at >= 0.4. */
export function assessIndustryRansomwareExposure(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const systems = num(r.systems, 0);
    const vulnerable = num(r.vulnerable, 0);
    const exposure = rate(vulnerable, systems);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), systems, vulnerable, exposure, high: exposure >= 0.4 };
  }).sort((a, b) => b.exposure - a.exposure || String(a.key).localeCompare(String(b.key)));
  const highCount = rows.filter(r => r.high).length;
  return { rows, count: rows.length, highCount, indicatorCount: rows.length, top: rows[0] || null, summary: `Infinity AI assessed ransomware exposure for ${rows.length} industry(ies); ${highCount} show high exposure.` };
}
/** Idea 53652 — Industry Data Residency Patterns. Input records: {industry, datasets, localDatasets}. Residency rate; compliant at >= 0.8. */
export function trackIndustryDataResidency(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const datasets = num(r.datasets, 0);
    const localDatasets = num(r.localDatasets, 0);
    const residencyRate = rate(localDatasets, datasets);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), datasets, localDatasets, residencyRate, compliant: residencyRate >= 0.8 };
  }).sort((a, b) => b.residencyRate - a.residencyRate || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  return { rows, count: rows.length, compliantCount, top: rows[0] || null, summary: `Infinity AI tracked data residency for ${rows.length} industry(ies); ${compliantCount} are compliant.` };
}
/** Idea 53653 — Industry Identity Provider Trends. Input records: {industry, provider, users}. Dominant provider per industry with its user share. */
export function trackIndustryIdentityProviderTrends(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, total: 0, byProvider: new Map() };
    const users = num(r.users, 0);
    const provider = String(r.provider || 'provider');
    g.total += users;
    g.byProvider.set(provider, (g.byProvider.get(provider) || 0) + users);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const best = [...g.byProvider.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0] || ['provider', 0];
    return { key: g.key, industry: g.industry, provider: best[0], providerUsers: best[1], total: g.total, share: rate(best[1], g.total) };
  }).sort((a, b) => b.share - a.share || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, industryCount: rows.length, trendCount: rows.length, top: rows[0] || null, summary: `Infinity AI tracked identity provider trends for ${rows.length} industry(ies).` };
}
/** Idea 53654 — Industry Payment Flow Patterns. Input records: {industry, flow, transactions, failures}. Failure rate per flow; risky at >= 0.1. */
export function analyzeIndustryPaymentFlowPatterns(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const industry = String(r.industry || 'industry');
    const flow = String(r.flow || 'flow');
    const transactions = num(r.transactions, 0);
    const failures = num(r.failures, 0);
    const failureRate = rate(failures, transactions);
    return { key: `${industry}|${flow}`, industry, flow, transactions, failures, failureRate, risky: failureRate >= 0.1 };
  }).sort((a, b) => b.failureRate - a.failureRate || String(a.key).localeCompare(String(b.key)));
  const riskyCount = rows.filter(r => r.risky).length;
  return { rows, count: rows.length, riskyCount, flowCount: rows.length, top: rows[0] || null, summary: `Infinity AI analyzed payment flow patterns across ${rows.length} flow(s); ${riskyCount} are risky.` };
}
/** Idea 53655 — Industry IoT Exposure Profiles. Input records: {industry, devices, exposed}. Exposure rate; high at >= 0.3. */
export function profileIndustryIotExposure(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const devices = num(r.devices, 0);
    const exposed = num(r.exposed, 0);
    const exposureRate = rate(exposed, devices);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), devices, exposed, exposureRate, high: exposureRate >= 0.3 };
  }).sort((a, b) => b.exposureRate - a.exposureRate || String(a.key).localeCompare(String(b.key)));
  const highCount = rows.filter(r => r.high).length;
  return { rows, count: rows.length, highCount, profileCount: rows.length, top: rows[0] || null, summary: `Infinity AI profiled IoT exposure for ${rows.length} industry(ies); ${highCount} show high exposure.` };
}
/** Idea 53656 — Industry AI Adoption Security. Input records: {industry, aiSystems, secured}. Secured rate; secure at >= 0.8. */
export function assessIndustryAiAdoptionSecurity(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const aiSystems = num(r.aiSystems ?? r.systems, 0);
    const secured = num(r.secured, 0);
    const securedRate = rate(secured, aiSystems);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), aiSystems, secured, securedRate, secure: securedRate >= 0.8 };
  }).sort((a, b) => b.securedRate - a.securedRate || String(a.key).localeCompare(String(b.key)));
  const secureCount = rows.filter(r => r.secure).length;
  return { rows, count: rows.length, secureCount, top: rows[0] || null, summary: `Infinity AI assessed AI adoption security for ${rows.length} industry(ies); ${secureCount} are secure.` };
}
/** Idea 53657 — Industry Remote Work Patterns. Input records: {industry, employees, remote, vpnUsers}. Remote share and vpn coverage; remote-heavy at remote share >= 0.5. */
export function analyzeIndustryRemoteWorkPatterns(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const employees = num(r.employees, 0);
    const remote = num(r.remote, 0);
    const vpnUsers = num(r.vpnUsers, 0);
    const remoteShare = rate(remote, employees);
    const vpnCoverage = rate(vpnUsers, remote);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), employees, remote, vpnUsers, remoteShare, vpnCoverage, remoteHeavy: remoteShare >= 0.5 };
  }).sort((a, b) => b.remoteShare - a.remoteShare || String(a.key).localeCompare(String(b.key)));
  const remoteHeavyCount = rows.filter(r => r.remoteHeavy).length;
  return { rows, count: rows.length, remoteHeavyCount, patternCount: rows.length, top: rows[0] || null, summary: `Infinity AI analyzed remote work patterns for ${rows.length} industry(ies); ${remoteHeavyCount} are remote-heavy.` };
}
/** Idea 53658 — Industry Vendor Concentration Risks. Input records: {industry, vendor, spend}. Per industry, concentration is the top vendor share of total spend; risky at >= 0.5. */
export function assessIndustryVendorConcentration(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const industry = String(r.industry || 'industry');
    const g = grouped.get(industry) || { key: industry, industry, total: 0, byVendor: new Map() };
    const spend = num(r.spend, 0);
    const vendor = String(r.vendor || 'vendor');
    g.total += spend;
    g.byVendor.set(vendor, (g.byVendor.get(vendor) || 0) + spend);
    grouped.set(industry, g);
  }
  const rows = [...grouped.values()].map(g => {
    const best = [...g.byVendor.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0] || ['vendor', 0];
    const share = rate(best[1], g.total);
    return { key: g.key, industry: g.industry, vendor: best[0], vendorSpend: best[1], total: g.total, share, risky: share >= 0.5 };
  }).sort((a, b) => b.share - a.share || String(a.key).localeCompare(String(b.key)));
  const riskyCount = rows.filter(r => r.risky).length;
  return { rows, count: rows.length, riskyCount, top: rows[0] || null, summary: `Infinity AI assessed vendor concentration for ${rows.length} industry(ies); ${riskyCount} are concentrated.` };
}
/** Idea 53659 — Industry Open Source Usage. Input records: {industry, projects, ossProjects}. Open source share; high usage at >= 0.5. */
export function trackIndustryOpenSourceUsage(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const projects = num(r.projects, 0);
    const ossProjects = num(r.ossProjects ?? r.openSourceProjects, 0);
    const ossShare = rate(ossProjects, projects);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), projects, ossProjects, ossShare, highUsage: ossShare >= 0.5 };
  }).sort((a, b) => b.ossShare - a.ossShare || String(a.key).localeCompare(String(b.key)));
  const highUsageCount = rows.filter(r => r.highUsage).length;
  return { rows, count: rows.length, highUsageCount, usageCount: rows.length, top: rows[0] || null, summary: `Infinity AI tracked open source usage for ${rows.length} industry(ies); ${highUsageCount} are high-usage.` };
}
/** Idea 53660 — Industry Security Hiring Signals. Input records: {industry, postings, securityPostings}. Security share of postings; strong signal at >= 0.2. */
export function detectIndustrySecurityHiringSignals(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const postings = num(r.postings, 0);
    const securityPostings = num(r.securityPostings, 0);
    const securityShare = rate(securityPostings, postings);
    return { key: keyOf(r, 'industry'), industry: String(r.industry || 'industry'), postings, securityPostings, securityShare, strong: securityShare >= 0.2 };
  }).sort((a, b) => b.securityShare - a.securityShare || String(a.key).localeCompare(String(b.key)));
  const strongCount = rows.filter(r => r.strong).length;
  return { rows, count: rows.length, strongCount, signalCount: rows.length, top: rows[0] || null, summary: `Infinity AI detected security hiring signals for ${rows.length} industry(ies); ${strongCount} are strong.` };
}
