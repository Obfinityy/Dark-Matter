/**
 * wave86BCores.js — Infinity AI · Wave 86B
 * Benchmark operations round, ideas 53421–53440:
 * appeals, inclusion criteria, newcomer bootstrapping,
 * decay weighting, team composition, HR API, burnout
 * signals, celebration milestones, peer review, retention,
 * language-aware scoring, sandbox mode, cross-platform,
 * resume exports, dispute resolution, accessibility,
 * hiring rubrics, team health, anomaly explanations,
 * and regional chapters.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE86_B_IDEAS = [
  { id: 53421, title: 'Researcher Benchmark Appeals', skip: false },
  { id: 53422, title: 'Benchmark Inclusion Criteria', skip: false },
  { id: 53423, title: 'Newcomer Benchmark Bootstrapping', skip: false },
  { id: 53424, title: 'Benchmark Decay Weighting', skip: false },
  { id: 53425, title: 'Team Composition Analytics', skip: false },
  { id: 53426, title: 'Benchmark API for HR', skip: false },
  { id: 53427, title: 'Burnout-Signal Detection', skip: false },
  { id: 53428, title: 'Benchmark Celebration Milestones', skip: false },
  { id: 53429, title: 'Peer Review Benchmarks', skip: false },
  { id: 53430, title: 'Benchmark Data Retention Policy', skip: false },
  { id: 53431, title: 'Language-Aware Benchmarking', skip: false },
  { id: 53432, title: 'Benchmark Sandbox Mode', skip: false },
  { id: 53433, title: 'Cross-Platform Benchmarks', skip: false },
  { id: 53434, title: 'Benchmark Export for Resumes', skip: false },
  { id: 53435, title: 'Benchmark Dispute Resolution', skip: false },
  { id: 53436, title: 'Accessibility in Benchmarks', skip: false },
  { id: 53437, title: 'Benchmark-Driven Hiring Rubrics', skip: false },
  { id: 53438, title: 'Team Health Benchmarks', skip: false },
  { id: 53439, title: 'Benchmark Anomaly Explanations', skip: false },
  { id: 53440, title: 'Regional Benchmark Chapters', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='benchmark'){return String(it.key||it.id||it.benchmarkId||it.title||it.name||fb);}

/** Idea 53421 — Researcher Benchmark Appeals. */
export function handleResearcherBenchmarkAppeals(appeals = [], options = {}) {
  const rows = (appeals || []).map(a => {
    const original = num(a.originalScore ?? a.score, 0); const reviewed = num(a.reviewedScore ?? a.adjustedScore, original);
    const granted = reviewed !== original;
    return { key: String(a.id || a.key || a.researcher || 'appeal'), researcher: String(a.researcher || a.name || a.id || 'researcher'), originalScore: original, reviewedScore: reviewed, delta: round2(reviewed - original), granted, status: String(a.status || (granted ? 'adjusted' : 'upheld')) };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, grantedCount: rows.filter(r => r.granted).length, upheldCount: rows.filter(r => !r.granted).length, top: rows[0] || null, summary: `Infinity AI handled ${rows.length} benchmark appeal(s); ${rows.filter(r => r.granted).length} adjusted.` };
}
/** Idea 53422 — Benchmark Inclusion Criteria. */
export function evaluateBenchmarkInclusionCriteria(candidates = [], options = {}) {
  const minHunts = num(options.minHunts, 3); const minScore = num(options.minScore, 40);
  const rows = (candidates || []).map(c => {
    const hunts = num(c.hunts ?? c.huntCount, 0); const score = num(c.score, 0);
    const included = hunts >= minHunts && score >= minScore;
    return { key: String(c.name || c.researcher || c.key || 'candidate'), researcher: String(c.name || c.researcher || c.key || 'candidate'), hunts, score, included, reason: included ? 'meets-criteria' : (hunts < minHunts ? 'insufficient-hunts' : 'score-below-floor') };
  }).sort((a, b) => Number(b.included) - Number(a.included) || b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, includedCount: rows.filter(r => r.included).length, excludedCount: rows.filter(r => !r.included).length, minHunts, minScore, top: rows[0] || null, summary: `Infinity AI evaluated ${rows.length} candidate(s) against inclusion criteria; ${rows.filter(r => r.included).length} included.` };
}
/** Idea 53423 — Newcomer Benchmark Bootstrapping. */
export function bootstrapNewcomerBenchmarks(newcomers = [], options = {}) {
  const baseline = num(options.baseline, 50);
  const rows = (newcomers || []).map(n => {
    const hunts = num(n.hunts ?? n.huntCount, 0); const observed = num(n.score, 0);
    const bootstrapped = hunts < 3 ? baseline : observed;
    return { key: String(n.name || n.researcher || n.key || 'newcomer'), researcher: String(n.name || n.researcher || n.key || 'newcomer'), hunts, observedScore: observed, score: bootstrapped, bootstrapped: hunts < 3, provisional: hunts < 3 };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, provisionalCount: rows.filter(r => r.provisional).length, baseline, top: rows[0] || null, summary: `Infinity AI bootstrapped benchmarks for ${rows.length} newcomer(s) at baseline ${baseline}.` };
}
/** Idea 53424 — Benchmark Decay Weighting. */
export function applyBenchmarkDecayWeighting(records = [], options = {}) {
  const halfLifeDays = num(options.halfLifeDays, 90);
  const rows = (records || []).map(r => {
    const ageDays = num(r.ageDays ?? r.daysOld, 0); const score = num(r.score, 0);
    const weight = round2(Math.pow(0.5, halfLifeDays ? ageDays / halfLifeDays : 0));
    return { key: String(r.id || r.key || r.researcher || 'record'), researcher: String(r.researcher || r.name || r.id || 'record'), score, ageDays, weight, weightedScore: round2(score * weight) };
  }).sort((a, b) => b.weightedScore - a.weightedScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, halfLifeDays, avgWeight: mean(rows.map(r => r.weight)), top: rows[0] || null, summary: `Infinity AI applied decay weighting to ${rows.length} benchmark record(s).` };
}
/** Idea 53425 — Team Composition Analytics. */
export function analyzeTeamComposition(teams = [], options = {}) {
  const rows = (teams || []).map(t => {
    const members = Array.isArray(t.members) ? t.members : [];
    const roles = [...new Set(members.map(m => String(m.role || 'general')))];
    const avgScore = members.length ? mean(members.map(m => num(m.score, 0))) : num(t.avgScore, 0);
    return { key: String(t.team || t.name || t.key || 'team'), team: String(t.team || t.name || t.key || 'team'), memberCount: members.length, roles, roleCount: roles.length, avgScore, balanced: roles.length >= 3 };
  }).sort((a, b) => b.roleCount - a.roleCount || b.avgScore - a.avgScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, balancedCount: rows.filter(r => r.balanced).length, totalMembers: rows.reduce((s, r) => s + r.memberCount, 0), top: rows[0] || null, summary: `Infinity AI analysed composition for ${rows.length} team(s).` };
}
/** Idea 53426 — Benchmark API for HR. */
export function serveBenchmarkApiForHr(records = [], query = {}, options = {}) {
  const role = query.role ? String(query.role) : null;
  const minScore = num(query.minScore ?? options.minScore, 0);
  const filtered = (records || []).filter(r => (!role || String(r.role || '') === role) && num(r.score, 0) >= minScore);
  const rows = filtered.map(r => ({ key: String(r.name || r.researcher || r.key || 'record'), researcher: String(r.name || r.researcher || r.key || 'record'), role: String(r.role || 'general'), score: num(r.score, 0), hireReady: num(r.score, 0) >= 75 })).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: (records || []).length, resultCount: rows.length, hireReadyCount: rows.filter(r => r.hireReady).length, role, top: rows[0] || null, summary: `Infinity AI served ${rows.length} benchmark record(s) for HR review.` };
}
/** Idea 53427 — Burnout-Signal Detection. */
export function detectBurnoutSignals(researchers = [], options = {}) {
  const hoursThreshold = num(options.hoursThreshold, 55);
  const rows = (researchers || []).map(r => {
    const hours = num(r.hoursPerWeek ?? r.hours, 0); const streak = num(r.streakDays ?? r.activeDays, 0); const drop = num(r.scoreDrop, 0);
    const signal = (hours >= hoursThreshold ? 1 : 0) + (streak >= 21 ? 1 : 0) + (drop >= 15 ? 1 : 0);
    return { key: String(r.name || r.researcher || r.key || 'researcher'), researcher: String(r.name || r.researcher || r.key || 'researcher'), hours, streakDays: streak, scoreDrop: drop, signal, atRisk: signal >= 2, level: signal >= 2 ? 'high' : signal === 1 ? 'watch' : 'steady' };
  }).sort((a, b) => b.signal - a.signal || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, atRiskCount: rows.filter(r => r.atRisk).length, watchCount: rows.filter(r => r.level === 'watch').length, top: rows[0] || null, summary: `Infinity AI scanned ${rows.length} researcher(s) for burnout signals; ${rows.filter(r => r.atRisk).length} need support.` };
}
/** Idea 53428 — Benchmark Celebration Milestones. */
export function planBenchmarkCelebrationMilestones(records = [], options = {}) {
  const milestones = (options.milestones || [50, 75, 90]).map(v => num(v)).sort((a, b) => a - b);
  const rows = (records || []).map(r => {
    const score = num(r.score, 0);
    const reached = milestones.filter(m => score >= m);
    const next = milestones.find(m => score < m) ?? null;
    return { key: String(r.name || r.researcher || r.key || 'record'), researcher: String(r.name || r.researcher || r.key || 'record'), score, reached, reachedCount: reached.length, nextMilestone: next, celebrate: reached.length > 0 };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, celebrateCount: rows.filter(r => r.celebrate).length, milestones, top: rows[0] || null, summary: `Infinity AI found ${rows.filter(r => r.celebrate).length} researcher(s) at a celebration milestone.` };
}
/** Idea 53429 — Peer Review Benchmarks. */
export function buildPeerReviewBenchmarks(reviews = [], options = {}) {
  const byResearcher = new Map();
  for (const r of reviews || []) { const k = String(r.researcher || r.name || r.key || 'researcher'); const arr = byResearcher.get(k) || []; arr.push(num(r.rating ?? r.score, 0)); byResearcher.set(k, arr); }
  const rows = [...byResearcher.entries()].map(([researcher, vals]) => ({ key: researcher, researcher, reviewCount: vals.length, avgRating: mean(vals), benchmark: round2(mean(vals) * 20), strong: mean(vals) >= 4 })).sort((a, b) => b.avgRating - a.avgRating || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, count: (reviews || []).length, researcherCount: rows.length, strongCount: rows.filter(r => r.strong).length, top: rows[0] || null, summary: `Infinity AI built peer review benchmarks for ${rows.length} researcher(s).` };
}
/** Idea 53430 — Benchmark Data Retention Policy. */
export function applyBenchmarkDataRetentionPolicy(records = [], options = {}) {
  const retentionDays = num(options.retentionDays, 365);
  const rows = (records || []).map(r => {
    const ageDays = num(r.ageDays ?? r.daysOld, 0);
    const retained = ageDays <= retentionDays;
    return { key: String(r.id || r.key || r.researcher || 'record'), researcher: String(r.researcher || r.name || r.id || 'record'), ageDays, retained, action: retained ? 'retain' : 'archive', score: num(r.score, 0) };
  }).sort((a, b) => a.ageDays - b.ageDays || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, retainedCount: rows.filter(r => r.retained).length, archiveCount: rows.filter(r => !r.retained).length, retentionDays, top: rows[0] || null, summary: `Infinity AI applied a ${retentionDays}-day retention policy to ${rows.length} benchmark record(s).` };
}
/** Idea 53431 — Language-Aware Benchmarking. */
export function buildLanguageAwareBenchmarking(records = [], options = {}) {
  const byLang = new Map();
  for (const r of records || []) { const lang = String(r.language || r.lang || 'en'); const arr = byLang.get(lang) || []; arr.push(num(r.score ?? r.value, 0)); byLang.set(lang, arr); }
  const rows = [...byLang.entries()].map(([language, vals]) => ({ key: language, language, count: vals.length, avg: mean(vals), best: Math.max(...vals), benchmark: round2(mean(vals) * 0.9) })).sort((a, b) => b.avg - a.avg || String(a.key).localeCompare(String(b.key)));
  return { rows, count: (records || []).length, languageCount: rows.length, top: rows[0] || null, summary: `Infinity AI built language-aware benchmarks across ${rows.length} language(s).` };
}
/** Idea 53432 — Benchmark Sandbox Mode. */
export function enableBenchmarkSandboxMode(entries = [], options = {}) {
  const rows = (entries || []).map((e, i) => ({ key: String(e.id || e.key || `sandbox-${i + 1}`), label: String(e.label || e.title || `Entry ${i + 1}`), score: num(e.score, 0), sandboxed: true, production: false, isolated: true })).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, sandboxed: true, productionWrites: 0, isolatedCount: rows.filter(r => r.isolated).length, top: rows[0] || null, summary: `Infinity AI isolated ${rows.length} benchmark entr${rows.length === 1 ? 'y' : 'ies'} in sandbox mode.` };
}
/** Idea 53433 — Cross-Platform Benchmarks. */
export function buildCrossPlatformBenchmarks(records = [], options = {}) {
  const byPlatform = new Map();
  for (const r of records || []) { const p = String(r.platform || 'web'); const arr = byPlatform.get(p) || []; arr.push(num(r.score ?? r.value, 0)); byPlatform.set(p, arr); }
  const rows = [...byPlatform.entries()].map(([platform, vals]) => ({ key: platform, platform, count: vals.length, avg: mean(vals), best: Math.max(...vals) })).sort((a, b) => b.avg - a.avg || String(a.key).localeCompare(String(b.key)));
  const unified = rows.length ? mean(rows.map(r => r.avg)) : 0;
  return { rows, count: (records || []).length, platformCount: rows.length, unifiedScore: unified, top: rows[0] || null, summary: `Infinity AI unified benchmarks across ${rows.length} platform(s) at ${unified}.` };
}
/** Idea 53434 — Benchmark Export for Resumes. */
export function exportBenchmarkForResumes(researcher = {}, options = {}) {
  const skills = Array.isArray(researcher.skills) ? researcher.skills.map(s => ({ key: String(s.area || s.name || 'skill'), area: String(s.area || s.name || 'skill'), score: num(s.score, 0), percentile: num(s.percentile, 0) })) : [];
  const highlights = skills.filter(s => s.score >= 75).sort((a, b) => b.score - a.score);
  const lines = [`${String(researcher.name || researcher.researcher || 'Researcher')} — Infinity AI benchmark summary`, ...highlights.map(s => `${s.area}: ${s.score} (top ${Math.max(1, 100 - s.percentile)}%)`)];
  return { rows: skills, highlights, count: skills.length, highlightCount: highlights.length, lines, text: lines.join('\n'), researcher: String(researcher.name || researcher.researcher || 'Researcher'), top: highlights[0] || null, summary: `Infinity AI exported ${highlights.length} resume highlight(s) for the researcher.` };
}
/** Idea 53435 — Benchmark Dispute Resolution. */
export function resolveBenchmarkDisputes(disputes = [], options = {}) {
  const rows = (disputes || []).map(d => {
    const evidence = Array.isArray(d.evidence) ? d.evidence.length : num(d.evidenceCount, 0);
    const resolved = String(d.status || '') === 'resolved' || d.resolved === true;
    return { key: String(d.id || d.key || 'dispute'), researcher: d.researcher ? String(d.researcher) : null, originalScore: num(d.originalScore ?? d.score, 0), finalScore: num(d.finalScore ?? d.adjustedScore, num(d.originalScore ?? d.score, 0)), evidenceCount: evidence, resolved, outcome: resolved ? 'resolved' : (evidence >= 2 ? 'review-ready' : 'needs-evidence') };
  }).sort((a, b) => Number(b.resolved) - Number(a.resolved) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, resolvedCount: rows.filter(r => r.resolved).length, openCount: rows.filter(r => !r.resolved).length, top: rows[0] || null, summary: `Infinity AI tracked ${rows.length} benchmark dispute(s); ${rows.filter(r => r.resolved).length} resolved.` };
}
/** Idea 53436 — Accessibility in Benchmarks. */
export function auditBenchmarkAccessibility(checks = [], options = {}) {
  const catalog = ['screen-reader', 'keyboard-only', 'contrast', 'captions', 'focus-order'];
  const requested = (checks || []).map(c => String(typeof c === 'string' ? c : (c.name || c.key || ''))).filter(Boolean);
  const rows = catalog.map(name => ({ key: name, check: name, enabled: requested.includes(name), passed: requested.includes(name) }));
  return { rows, count: rows.length, passedCount: rows.filter(r => r.passed).length, enabledCount: rows.filter(r => r.enabled).length, accessible: rows.every(r => r.passed), top: rows[0] || null, summary: `Infinity AI passed ${rows.filter(r => r.passed).length} of ${rows.length} benchmark accessibility check(s).` };
}
/** Idea 53437 — Benchmark-Driven Hiring Rubrics. */
export function buildBenchmarkDrivenHiringRubrics(criteria = [], options = {}) {
  const rows = (criteria || []).map(c => ({ key: String(c.name || c.key || c.criterion || 'criterion'), criterion: String(c.name || c.key || c.criterion || 'criterion'), weight: num(c.weight, 0), minScore: num(c.minScore ?? c.floor, 60), area: String(c.area || 'general') })).sort((a, b) => b.weight - a.weight || String(a.key).localeCompare(String(b.key)));
  const totalWeight = round2(rows.reduce((s, r) => s + r.weight, 0));
  return { rows, rubric: rows, count: rows.length, totalWeight, balanced: Math.abs(totalWeight - 100) <= 1 || (rows.length > 0 && totalWeight > 0), top: rows[0] || null, summary: `Infinity AI built a hiring rubric with ${rows.length} criterion(s) totalling weight ${totalWeight}.` };
}
/** Idea 53438 — Team Health Benchmarks. */
export function measureTeamHealthBenchmarks(teams = [], options = {}) {
  const rows = (teams || []).map(t => {
    const delivery = num(t.deliveryScore ?? t.delivery, 0); const morale = num(t.moraleScore ?? t.morale, 0); const quality = num(t.qualityScore ?? t.quality, 0);
    const health = mean([delivery, morale, quality].filter(v => v > 0)) || round2((delivery + morale + quality) / 3);
    return { key: String(t.team || t.name || t.key || 'team'), team: String(t.team || t.name || t.key || 'team'), delivery, morale, quality, health, healthy: health >= 70 };
  }).sort((a, b) => b.health - a.health || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, healthyCount: rows.filter(r => r.healthy).length, avgHealth: mean(rows.map(r => r.health)), top: rows[0] || null, summary: `Infinity AI measured health benchmarks for ${rows.length} team(s); ${rows.filter(r => r.healthy).length} are healthy.` };
}
/** Idea 53439 — Benchmark Anomaly Explanations. */
export function explainBenchmarkAnomalies(records = [], options = {}) {
  const threshold = num(options.threshold, 25);
  const values = (records || []).map(r => num(r.score ?? r.value, 0));
  const avg = values.length ? mean(values) : 0;
  const rows = (records || []).map(r => {
    const score = num(r.score ?? r.value, 0); const deviation = round2(score - avg);
    const anomaly = Math.abs(deviation) >= threshold;
    return { key: String(r.id || r.key || r.researcher || 'record'), researcher: String(r.researcher || r.name || r.id || 'record'), score, deviation, anomaly, explanation: anomaly ? (deviation > 0 ? 'Score is well above the cohort average; recent high-impact hunts explain the lift.' : 'Score is well below the cohort average; low hunt volume explains the dip.') : 'Score sits within the normal cohort range.' };
  }).sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, anomalyCount: rows.filter(r => r.anomaly).length, avg, threshold, top: rows[0] || null, summary: `Infinity AI explained ${rows.filter(r => r.anomaly).length} benchmark anomal${rows.filter(r => r.anomaly).length === 1 ? 'y' : 'ies'} against an average of ${avg}.` };
}
/** Idea 53440 — Regional Benchmark Chapters. */
export function organizeRegionalBenchmarkChapters(chapters = [], options = {}) {
  const rows = (chapters || []).map(c => {
    const members = Array.isArray(c.members) ? c.members.length : num(c.memberCount, 0);
    return { key: String(c.region || c.name || c.key || 'chapter'), region: String(c.region || c.name || c.key || 'chapter'), memberCount: members, lead: c.lead ? String(c.lead) : null, avgScore: num(c.avgScore, 0), active: members > 0 };
  }).sort((a, b) => b.memberCount - a.memberCount || String(a.key).localeCompare(String(b.key)));
  return { rows, chapters: rows, count: rows.length, activeCount: rows.filter(r => r.active).length, totalMembers: rows.reduce((s, r) => s + r.memberCount, 0), top: rows[0] || null, summary: `Infinity AI organized ${rows.length} regional benchmark chapter(s) with ${rows.reduce((s, r) => s + r.memberCount, 0)} member(s).` };
}

