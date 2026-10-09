/**
 * wave86ACore.js — Infinity AI · Wave 86A
 * Benchmarking and learning round, ideas 53401–53420:
 * season windows, team benchmarks, privacy controls,
 * velocity rankings, data portability, blind mode,
 * mentor views, calibration hunts, anti-gaming safeguards,
 * confidence labels, role benchmarks, opt-out, peer matches,
 * trend alerts, org aggregates, fairness audits,
 * specialization badges, training plans, cross-org exchange,
 * and methodology transparency.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE86_A_IDEAS = [
  { id: 53401, title: 'Benchmark Season Windows', skip: false },
  { id: 53402, title: 'Team-vs-Team Benchmarks', skip: false },
  { id: 53403, title: 'Benchmark Privacy Controls', skip: false },
  { id: 53404, title: 'Improvement Velocity Rankings', skip: false },
  { id: 53405, title: 'Benchmark Data Portability', skip: false },
  { id: 53406, title: 'Blind Benchmark Mode', skip: false },
  { id: 53407, title: 'Mentor Benchmark Views', skip: false },
  { id: 53408, title: 'Benchmark Calibration Hunts', skip: false },
  { id: 53409, title: 'Anti-Gaming Safeguards (learning)', skip: false },
  { id: 53410, title: 'Benchmark Confidence Labels', skip: false },
  { id: 53411, title: 'Role-Based Benchmarks', skip: false },
  { id: 53412, title: 'Benchmark Opt-Out Anytime', skip: false },
  { id: 53413, title: 'Peer Learning Matches', skip: false },
  { id: 53414, title: 'Benchmark Trend Alerts', skip: false },
  { id: 53415, title: 'Organization Benchmark Aggregates', skip: false },
  { id: 53416, title: 'Benchmark Fairness Audits', skip: false },
  { id: 53417, title: 'Specialization Badges (learning)', skip: false },
  { id: 53418, title: 'Benchmark-Driven Training Plans', skip: false },
  { id: 53419, title: 'Cross-Org Benchmark Exchange', skip: false },
  { id: 53420, title: 'Benchmark Methodology Transparency', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='benchmark'){return String(it.key||it.id||it.benchmarkId||it.title||it.name||fb);}

/** Idea 53401 — Benchmark Season Windows. */
export function buildBenchmarkSeasonWindows(seasons = [], options = {}) {
  const windowDays = num(options.windowDays, 90);
  const rows = (seasons || []).map(s => {
    const startDay = num(s.startDay ?? s.start, 0);
    const endDay = num(s.endDay ?? s.end, startDay + windowDays);
    const active = endDay >= startDay;
    return { key: keyOf(s, 'season'), title: String(s.title || keyOf(s, 'season')), startDay, endDay, durationDays: Math.max(0, endDay - startDay), active, score: num(s.score, 0) };
  }).sort((a, b) => a.startDay - b.startDay || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, activeCount: rows.filter(r => r.active).length, windowDays, top: rows[0] || null, summary: `Infinity AI built ${rows.length} benchmark season window(s) spanning ${windowDays} day(s).` };
}
/** Idea 53402 — Team-vs-Team Benchmarks. */
export function buildTeamVsTeamBenchmarks(teams = [], options = {}) {
  const rows = (teams || []).map(t => {
    const wins = num(t.wins, 0); const losses = num(t.losses, 0); const score = num(t.score ?? t.benchmarkScore, 0);
    return { key: String(t.team || t.name || t.key || 'team'), team: String(t.team || t.name || t.key || 'team'), wins, losses, games: wins + losses, winRate: (wins + losses) ? rate(wins, wins + losses) : 0, score, benchmark: round2(score * 0.9) };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, count: rows.length, leader: rows[0] || null, top: rows[0] || null, totalGames: rows.reduce((s, r) => s + r.games, 0), summary: `Infinity AI compared ${rows.length} team(s) in team-vs-team benchmarks; leader is ${rows[0]?.key || 'none'}.` };
}
/** Idea 53403 — Benchmark Privacy Controls. */
export function applyBenchmarkPrivacyControls(records = [], options = {}) {
  const rows = (records || []).map(r => {
    const visibility = String(r.visibility || (r.private === true ? 'private' : 'team'));
    const anonymized = r.anonymized === true || visibility === 'private' || visibility === 'anonymous';
    return { key: String(r.researcher || r.name || r.key || 'record'), researcher: String(r.researcher || r.name || r.key || 'record'), visibility, anonymized, shareable: visibility === 'public' && !anonymized, score: num(r.score, 0) };
  }).sort((a, b) => String(a.visibility).localeCompare(String(b.visibility)) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, privateCount: rows.filter(r => r.anonymized).length, publicCount: rows.filter(r => r.shareable).length, top: rows[0] || null, summary: `Infinity AI applied privacy controls to ${rows.length} benchmark record(s).` };
}
/** Idea 53404 — Improvement Velocity Rankings. */
export function rankImprovementVelocity(researchers = [], options = {}) {
  const weeks = num(options.weeks, 4);
  const rows = (researchers || []).map(r => {
    const start = num(r.startScore ?? r.fromScore, 0); const end = num(r.endScore ?? r.toScore ?? r.score, 0);
    const velocity = weeks ? round2((end - start) / weeks) : round2(end - start);
    return { key: String(r.name || r.researcher || r.key || 'researcher'), researcher: String(r.name || r.researcher || r.key || 'researcher'), startScore: start, endScore: end, gain: round2(end - start), velocity, improving: end > start };
  }).sort((a, b) => b.velocity - a.velocity || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, count: rows.length, weeks, improvingCount: rows.filter(r => r.improving).length, avgVelocity: mean(rows.map(r => r.velocity)), top: rows[0] || null, summary: `Infinity AI ranked improvement velocity for ${rows.length} researcher(s) over ${weeks} week(s).` };
}
/** Idea 53405 — Benchmark Data Portability. */
export function exportBenchmarkDataPortability(records = [], options = {}) {
  const format = String(options.format || 'json');
  const rows = (records || []).map(r => ({ key: String(r.id || r.key || r.researcher || 'record'), researcher: String(r.researcher || r.name || r.id || 'record'), score: num(r.score, 0), exported: true }));
  const payload = format === 'csv' ? ['researcher,score', ...rows.map(r => `${r.researcher},${r.score}`)].join('\n') : JSON.stringify(rows);
  return { rows, count: rows.length, format, payload, payloadLength: payload.length, exportReady: rows.length > 0, top: rows[0] || null, summary: `Infinity AI prepared ${rows.length} benchmark record(s) for export in ${format} format.` };
}
/** Idea 53406 — Blind Benchmark Mode. */
export function enableBlindBenchmarkMode(entries = [], options = {}) {
  const rows = (entries || []).map((e, i) => ({ key: `entry-${i + 1}`, label: `Entry ${i + 1}`, score: num(e.score ?? e.value, 0), blinded: true, researcher: null, band: num(e.score ?? e.value, 0) >= 80 ? 'leading' : num(e.score ?? e.value, 0) >= 50 ? 'middle' : 'developing' })).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, blinded: true, revealed: false, top: rows[0] || null, anonymized: true, summary: `Infinity AI blinded identities for ${rows.length} benchmark entr${rows.length === 1 ? 'y' : 'ies'} in blind benchmark mode.` };
}
/** Idea 53407 — Mentor Benchmark Views. */
export function buildMentorBenchmarkViews(mentees = [], options = {}) {
  const rows = (mentees || []).map(m => {
    const score = num(m.score ?? m.benchmarkScore, 0); const target = num(m.target ?? m.goal, 75);
    return { key: String(m.name || m.mentee || m.key || 'mentee'), mentee: String(m.name || m.mentee || m.key || 'mentee'), mentor: m.mentor ? String(m.mentor) : null, score, target, gap: round2(target - score), onTrack: score >= target };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, onTrackCount: rows.filter(r => r.onTrack).length, avgGap: mean(rows.map(r => r.gap)), top: rows[0] || null, summary: `Infinity AI built mentor benchmark views for ${rows.length} mentee(s).` };
}
/** Idea 53408 — Benchmark Calibration Hunts. */
export function runBenchmarkCalibrationHunts(hunts = [], options = {}) {
  const targetScore = num(options.targetScore, 70);
  const rows = (hunts || []).map(h => {
    const observed = num(h.observedScore ?? h.score, 0); const expected = num(h.expectedScore, targetScore);
    const drift = round2(observed - expected);
    return { key: keyOf(h, 'hunt'), title: String(h.title || keyOf(h, 'hunt')), observed, expected, drift, calibrated: Math.abs(drift) <= 10 };
  }).sort((a, b) => Math.abs(a.drift) - Math.abs(b.drift) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, calibratedCount: rows.filter(r => r.calibrated).length, targetScore, avgDrift: mean(rows.map(r => r.drift)), top: rows[0] || null, summary: `Infinity AI calibrated ${rows.filter(r => r.calibrated).length} of ${rows.length} calibration hunt(s).` };
}
/** Idea 53409 — Anti-Gaming Safeguards (learning). */
export function applyAntiGamingSafeguards(entries = [], options = {}) {
  const maxGain = num(options.maxWeeklyGain, 30);
  const rows = (entries || []).map(e => {
    const gain = num(e.weeklyGain ?? e.gain, 0); const hunts = num(e.hunts ?? e.huntCount, 1);
    const flagged = gain > maxGain && hunts < 3;
    return { key: String(e.researcher || e.name || e.key || 'entry'), researcher: String(e.researcher || e.name || e.key || 'entry'), gain, hunts, flagged, safeguard: flagged ? 'review-required' : 'clear' };
  }).sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.gain - a.gain || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, flaggedCount: rows.filter(r => r.flagged).length, clearCount: rows.filter(r => !r.flagged).length, maxWeeklyGain: maxGain, top: rows[0] || null, summary: `Infinity AI checked ${rows.length} benchmark entr${rows.length === 1 ? 'y' : 'ies'} against anti-gaming safeguards; ${rows.filter(r => r.flagged).length} flagged.` };
}
/** Idea 53410 — Benchmark Confidence Labels. */
export function labelBenchmarkConfidence(records = [], options = {}) {
  const rows = (records || []).map(r => {
    const samples = num(r.samples ?? r.sampleCount ?? r.hunts, 0); const variance = num(r.variance, 0);
    const confidence = samples >= 10 && variance <= 15 ? 'high' : samples >= 4 ? 'medium' : 'low';
    return { key: String(r.researcher || r.name || r.key || 'record'), researcher: String(r.researcher || r.name || r.key || 'record'), score: num(r.score, 0), samples, variance, confidence, label: confidence };
  }).sort((a, b) => b.samples - a.samples || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, highCount: rows.filter(r => r.confidence === 'high').length, mediumCount: rows.filter(r => r.confidence === 'medium').length, lowCount: rows.filter(r => r.confidence === 'low').length, top: rows[0] || null, summary: `Infinity AI labelled confidence for ${rows.length} benchmark record(s).` };
}
/** Idea 53411 — Role-Based Benchmarks. */
export function buildRoleBasedBenchmarks(records = [], options = {}) {
  const byRole = new Map();
  for (const r of records || []) { const role = String(r.role || 'general'); const arr = byRole.get(role) || []; arr.push(num(r.score ?? r.value, 0)); byRole.set(role, arr); }
  const rows = [...byRole.entries()].map(([role, vals]) => ({ key: role, role, count: vals.length, avg: mean(vals), best: Math.max(...vals), benchmark: round2(mean(vals) * 0.9) })).sort((a, b) => b.avg - a.avg || String(a.key).localeCompare(String(b.key)));
  return { rows, count: (records || []).length, roleCount: rows.length, top: rows[0] || null, summary: `Infinity AI built role-based benchmarks across ${rows.length} role(s).` };
}
/** Idea 53412 — Benchmark Opt-Out Anytime. */
export function processBenchmarkOptOut(records = [], options = {}) {
  const rows = (records || []).map(r => {
    const optedOut = r.optedOut === true || String(r.status || '') === 'opted-out';
    return { key: String(r.researcher || r.name || r.key || 'record'), researcher: String(r.researcher || r.name || r.key || 'record'), optedOut, included: !optedOut, status: optedOut ? 'opted-out' : 'included' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, optedOutCount: rows.filter(r => r.optedOut).length, includedCount: rows.filter(r => r.included).length, top: rows[0] || null, summary: `Infinity AI processed benchmark opt-out for ${rows.length} record(s); ${rows.filter(r => r.optedOut).length} opted out.` };
}
/** Idea 53413 — Peer Learning Matches. */
export function matchPeerLearning(researchers = [], options = {}) {
  const rows = (researchers || []).map(r => {
    const weak = Array.isArray(r.weakAreas) ? r.weakAreas.map(String) : (r.weakArea ? [String(r.weakArea)] : []);
    const peers = (researchers || []).filter(p => p !== r).map(p => {
      const strengths = Array.isArray(p.strengths) ? p.strengths.map(String) : (p.strength ? [String(p.strength)] : []);
      const overlap = weak.filter(w => strengths.includes(w)).length;
      return { key: String(p.name || p.researcher || p.key || 'peer'), peer: String(p.name || p.researcher || p.key || 'peer'), overlap };
    }).sort((a, b) => b.overlap - a.overlap || String(a.key).localeCompare(String(b.key)));
    const best = peers[0] || null;
    return { key: String(r.name || r.researcher || r.key || 'researcher'), researcher: String(r.name || r.researcher || r.key || 'researcher'), weakAreas: weak, bestPeer: best, matchScore: best ? best.overlap : 0, matched: Boolean(best && best.overlap > 0) };
  }).sort((a, b) => b.matchScore - a.matchScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, matchedCount: rows.filter(r => r.matched).length, top: rows[0] || null, summary: `Infinity AI matched ${rows.filter(r => r.matched).length} researcher(s) for peer learning.` };
}
/** Idea 53414 — Benchmark Trend Alerts. */
export function detectBenchmarkTrendAlerts(series = [], options = {}) {
  const threshold = num(options.threshold, 10);
  const rows = (series || []).map(s => {
    const points = Array.isArray(s.points) ? s.points.map(v => num(v)) : (Array.isArray(s.scores) ? s.scores.map(v => num(v)) : []);
    const delta = points.length >= 2 ? round2(points[points.length - 1] - points[0]) : 0;
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    return { key: keyOf(s, 'series'), title: String(s.title || keyOf(s, 'series')), points, delta, direction, alert: Math.abs(delta) >= threshold };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, alertCount: rows.filter(r => r.alert).length, threshold, top: rows[0] || null, summary: `Infinity AI detected ${rows.filter(r => r.alert).length} benchmark trend alert(s).` };
}
/** Idea 53415 — Organization Benchmark Aggregates. */
export function aggregateOrganizationBenchmarks(orgs = [], options = {}) {
  const rows = (orgs || []).map(o => {
    const members = Array.isArray(o.members) ? o.members : [];
    const scores = members.map(m => num(m.score ?? m.value, 0));
    const fallback = num(o.score, 0);
    const avg = scores.length ? mean(scores) : fallback;
    return { key: String(o.org || o.name || o.key || 'org'), org: String(o.org || o.name || o.key || 'org'), memberCount: members.length || num(o.memberCount, 0), avg, aggregate: avg, topScore: scores.length ? Math.max(...scores) : fallback };
  }).sort((a, b) => b.avg - a.avg || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalMembers: rows.reduce((s, r) => s + r.memberCount, 0), top: rows[0] || null, summary: `Infinity AI aggregated benchmarks for ${rows.length} organization(s).` };
}
/** Idea 53416 — Benchmark Fairness Audits. */
export function auditBenchmarkFairness(records = [], options = {}) {
  const rows = (records || []).map(r => {
    const expected = num(r.expectedScore ?? r.expected, 70); const observed = num(r.score ?? r.observedScore, 0);
    const bias = round2(observed - expected);
    return { key: String(r.group || r.name || r.key || 'group'), group: String(r.group || r.name || r.key || 'group'), observed, expected, bias, fair: Math.abs(bias) <= 8 };
  }).sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, fairCount: rows.filter(r => r.fair).length, flaggedCount: rows.filter(r => !r.fair).length, top: rows[0] || null, summary: `Infinity AI audited benchmark fairness for ${rows.length} group(s); ${rows.filter(r => r.fair).length} are fair.` };
}
/** Idea 53417 — Specialization Badges (learning). */
export function awardSpecializationBadges(researchers = [], options = {}) {
  const threshold = num(options.threshold, 80);
  const rows = (researchers || []).map(r => {
    const area = String(r.area || r.specialization || 'general'); const score = num(r.score ?? r.areaScore, 0);
    const earned = score >= threshold;
    return { key: String(r.name || r.researcher || r.key || 'researcher'), researcher: String(r.name || r.researcher || r.key || 'researcher'), area, score, earned, badge: earned ? `${area}-specialist` : null };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, badgeCount: rows.filter(r => r.earned).length, threshold, top: rows[0] || null, summary: `Infinity AI awarded ${rows.filter(r => r.earned).length} specialization badge(s).` };
}
/** Idea 53418 — Benchmark-Driven Training Plans. */
export function planBenchmarkDrivenTraining(researchers = [], options = {}) {
  const rows = (researchers || []).map(r => {
    const score = num(r.score, 0); const target = num(r.target, 85);
    const weak = Array.isArray(r.weakAreas) ? r.weakAreas.map(String) : [];
    const focus = weak.length ? weak[0] : (score < target ? 'foundations' : 'advanced');
    return { key: String(r.name || r.researcher || r.key || 'researcher'), researcher: String(r.name || r.researcher || r.key || 'researcher'), score, target, gap: round2(target - score), focus, planWeeks: Math.max(1, Math.ceil(Math.max(0, target - score) / 10)), needsPlan: score < target };
  }).sort((a, b) => b.gap - a.gap || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, planCount: rows.filter(r => r.needsPlan).length, top: rows[0] || null, summary: `Infinity AI planned training for ${rows.filter(r => r.needsPlan).length} researcher(s) from benchmark gaps.` };
}
/** Idea 53419 — Cross-Org Benchmark Exchange. */
export function exchangeCrossOrgBenchmarks(exchanges = [], options = {}) {
  const rows = (exchanges || []).map(e => {
    const fromOrg = String(e.fromOrg || e.sourceOrg || ''); const toOrg = String(e.toOrg || e.targetOrg || '');
    const recordCount = num(e.recordCount ?? e.count, 0) || (Array.isArray(e.records) ? e.records.length : 0);
    return { key: String(e.id || e.key || `${fromOrg}-${toOrg}`), fromOrg, toOrg, recordCount, accepted: e.accepted === true || String(e.status || '') === 'accepted', crossOrg: Boolean(fromOrg && toOrg && fromOrg !== toOrg) };
  }).sort((a, b) => b.recordCount - a.recordCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, crossOrgCount: rows.filter(r => r.crossOrg).length, acceptedCount: rows.filter(r => r.accepted).length, totalRecords: rows.reduce((s, r) => s + r.recordCount, 0), top: rows[0] || null, summary: `Infinity AI exchanged benchmarks across ${rows.filter(r => r.crossOrg).length} cross-org link(s).` };
}
/** Idea 53420 — Benchmark Methodology Transparency. */
export function explainBenchmarkMethodologyTransparency(method = {}, options = {}) {
  const factors = Array.isArray(method.factors) ? method.factors.map(f => ({ key: String(f.name || f.key || 'factor'), name: String(f.name || f.key || 'factor'), weight: num(f.weight, 0) })) : [];
  const totalWeight = round2(factors.reduce((s, f) => s + f.weight, 0));
  const rows = factors.sort((a, b) => b.weight - a.weight || String(a.key).localeCompare(String(b.key)));
  const disclosed = rows.length > 0 && totalWeight > 0;
  return { rows, factors: rows, count: rows.length, totalWeight, disclosed, transparent: disclosed, method: String(method.name || method.title || 'benchmark'), top: rows[0] || null, summary: `Infinity AI disclosed ${rows.length} methodology factor(s) totalling weight ${totalWeight}.` };
}

