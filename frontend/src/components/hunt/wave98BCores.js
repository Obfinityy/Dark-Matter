/**
 * wave98BCores.js — Infinity AI · Wave 98B
 * Skill intelligence for hunters, ideas 53895–53920: skill taxonomy,
 * skill proficiency inference, skill gap heatmaps, peer-relative skill
 * profiles, skill gap trend tracking, the training recommendation
 * engine, skill gap team aggregation, new-hire skill baselines, skill
 * validation challenges, mentor matching by gap, skill gap privacy
 * controls, skill progress milestones, cross-training suggestions,
 * skill gap versus assignment fit, skill decay detection, emerging
 * skill identification, skill gap benchmarking, personalized learning
 * paths, skill assessment cadence, skill evidence portfolios, manager
 * skill dashboards, skill gap closure verification, team skill
 * diversity metrics, skill gap cost estimates, learning resource
 * ratings, and skill mentorship credit.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE98_B_IDEAS = [
  { id: 53895, title: 'Skill Taxonomy for Hunters', skip: false },
  { id: 53896, title: 'Skill Proficiency Inference', skip: false },
  { id: 53897, title: 'Skill Gap Heatmaps', skip: false },
  { id: 53898, title: 'Peer-Relative Skill Profiles', skip: false },
  { id: 53899, title: 'Skill Gap Trend Tracking', skip: false },
  { id: 53900, title: 'Training Recommendation Engine', skip: false },
  { id: 53901, title: 'Skill Gap Team Aggregation', skip: false },
  { id: 53902, title: 'New-Hire Skill Baselines', skip: false },
  { id: 53903, title: 'Skill Validation Challenges', skip: false },
  { id: 53904, title: 'Mentor Matching by Gap', skip: false },
  { id: 53905, title: 'Skill Gap Privacy Controls', skip: false },
  { id: 53906, title: 'Skill Progress Milestones', skip: false },
  { id: 53907, title: 'Cross-Training Suggestions (learning)', skip: false },
  { id: 53908, title: 'Skill Gap vs Assignment Fit', skip: false },
  { id: 53909, title: 'Skill Decay Detection', skip: false },
  { id: 53910, title: 'Emerging Skill Identification', skip: false },
  { id: 53911, title: 'Skill Gap Benchmarking', skip: false },
  { id: 53912, title: 'Personalized Learning Paths', skip: false },
  { id: 53913, title: 'Skill Assessment Cadence', skip: false },
  { id: 53914, title: 'Skill Evidence Portfolios', skip: false },
  { id: 53915, title: 'Manager Skill Dashboards', skip: false },
  { id: 53916, title: 'Skill Gap Closure Verification', skip: false },
  { id: 53917, title: 'Team Skill Diversity Metrics', skip: false },
  { id: 53918, title: 'Skill Gap Cost Estimates', skip: false },
  { id: 53919, title: 'Learning Resource Ratings', skip: false },
  { id: 53920, title: 'Skill Mentorship Credit', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}

/** Idea 53895 — Skill Taxonomy for Hunters. Input records: {skill, area, requiredLevel, currentLevel}. Coverage is the share of taxonomy skills at or above their required level; gaps list what is missing for gap analysis. Defines the skill areas (recon, web, API, mobile, chaining, reporting) used for gap analysis. */
export function buildSkillTaxonomy(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const requiredLevel = num(r.requiredLevel, 0);
    const currentLevel = num(r.currentLevel, 0);
    const gap = round2(Math.max(0, requiredLevel - currentLevel));
    return { key: skill, skill, area: String(r.area || 'general'), requiredLevel, currentLevel, gap, covered: gap === 0, levelRatio: requiredLevel > 0 ? round2(currentLevel / requiredLevel) : 1 };
  }).sort((a, b) => b.gap - a.gap || String(a.key).localeCompare(String(b.key)));
  const areas = [...new Set(rows.map(r => r.area))].sort();
  const coveredCount = rows.filter(r => r.covered).length;
  return { rows, count: rows.length, areas, areaCount: areas.length, coveredCount, gapCount: rows.length - coveredCount, coverage: rate(coveredCount, rows.length), top: rows[0] || null, summary: `Infinity AI mapped ${rows.length} taxonomy skill(s) across ${areas.length} area(s); coverage is ${rate(coveredCount, rows.length)}.` };
}
/** Idea 53896 — Skill Proficiency Inference. Input records: {researcher, skill, hunts, confirmedFindings, falsePositives}. Proficiency blends finding rate with precision from hunt outcomes instead of self-assessment. Infers proficiency from hunt outcomes, not self-assessments. */
export function inferSkillProficiency(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const hunts = num(r.hunts, 0);
    const confirmedFindings = num(r.confirmedFindings ?? r.findings, 0);
    const falsePositives = num(r.falsePositives, 0);
    const findingRate = rate(confirmedFindings, hunts);
    const precision = rate(confirmedFindings, confirmedFindings + falsePositives);
    const proficiency = round2(0.6 * findingRate + 0.4 * precision);
    const level = proficiency >= 0.6 ? 'expert' : proficiency >= 0.4 ? 'proficient' : proficiency >= 0.2 ? 'developing' : 'novice';
    return { key: `${researcher}|${skill}`, researcher, skill, hunts, confirmedFindings, falsePositives, findingRate, precision, proficiency, level, evidenceBased: hunts >= 10 };
  }).sort((a, b) => b.proficiency - a.proficiency || String(a.key).localeCompare(String(b.key)));
  const expertCount = rows.filter(r => r.level === 'expert').length;
  return { rows, count: rows.length, expertCount, averageProficiency: mean(rows.map(r => r.proficiency)), top: rows[0] || null, summary: `Infinity AI inferred proficiency for ${rows.length} researcher skill(s) from hunt outcomes.` };
}
/** Idea 53897 — Skill Gap Heatmaps. Input records: {researcher, skill, gapScore}. Heat intensity buckets each gap so strengths and gaps read at a glance across the taxonomy. Heatmaps showing each researcher's strengths and gaps across the taxonomy. */
export function buildSkillGapHeatmaps(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const heat = gapScore >= 0.7 ? 'critical' : gapScore >= 0.45 ? 'high' : gapScore >= 0.2 ? 'moderate' : 'strength';
    return { key: `${researcher}|${skill}`, researcher, skill, gapScore, heat, isGap: gapScore >= 0.2, isStrength: heat === 'strength' };
  }).sort((a, b) => b.gapScore - a.gapScore || String(a.key).localeCompare(String(b.key)));
  const researchers = [...new Set(rows.map(r => r.researcher))].sort();
  const skills = [...new Set(rows.map(r => r.skill))].sort();
  const heatCounts = {};
  for (const row of rows) heatCounts[row.heat] = (heatCounts[row.heat] || 0) + 1;
  return { rows, count: rows.length, researchers, researcherCount: researchers.length, skills, skillCount: skills.length, heatCounts, criticalCount: heatCounts.critical || 0, top: rows[0] || null, summary: `Infinity AI built a skill gap heatmap for ${researchers.length} researcher(s) across ${skills.length} skill(s).` };
}
/** Idea 53898 — Peer-Relative Skill Profiles. Input records: {researcher, skill, score, peerScores}. Percentile places a researcher inside the anonymized peer distribution without naming peers. Compares researcher skills against anonymized peer distributions. */
export function buildPeerRelativeProfiles(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const score = round2(num(r.score, 0));
    const peerScores = (Array.isArray(r.peerScores) ? r.peerScores : []).map(v => num(v, 0));
    const below = peerScores.filter(p => p < score).length;
    const percentile = peerScores.length ? round2(below / peerScores.length) : 0;
    const peerMean = mean(peerScores);
    const band = percentile >= 0.75 ? 'top-quartile' : percentile >= 0.5 ? 'above-median' : percentile >= 0.25 ? 'below-median' : 'bottom-quartile';
    return { key: `${researcher}|${skill}`, researcher, skill, score, peerCount: peerScores.length, peerMean, percentile, deltaVsPeers: round2(score - peerMean), band, anonymized: true };
  }).sort((a, b) => b.percentile - a.percentile || String(a.key).localeCompare(String(b.key)));
  const topQuartileCount = rows.filter(r => r.band === 'top-quartile').length;
  return { rows, count: rows.length, topQuartileCount, averagePercentile: mean(rows.map(r => r.percentile)), top: rows[0] || null, summary: `Infinity AI placed ${rows.length} skill profile(s) against anonymized peer distributions.` };
}
/** Idea 53899 — Skill Gap Trend Tracking. Input records: {researcher, skill, month, gapScore}. The trend compares the latest gap with the first; closing gaps shrink by at least a tenth. Tracks whether gaps are closing or widening over time per researcher. */
export function trackSkillGapTrends(records = []) {
  const groups = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const key = `${String(r.researcher || 'researcher')}|${String(r.skill || 'skill')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ month: num(r.month, 0), gapScore: round2(clamp01(r.gapScore ?? r.gap)) });
  }
  const rows = [...groups.entries()].map(([key, points]) => {
    const sorted = [...points].sort((a, b) => a.month - b.month);
    const firstGap = sorted.length ? sorted[0].gapScore : 0;
    const latestGap = sorted.length ? sorted[sorted.length - 1].gapScore : 0;
    const change = round2(latestGap - firstGap);
    const direction = sorted.length < 2 ? 'insufficient-data' : change <= -0.1 ? 'closing' : change >= 0.1 ? 'widening' : 'stable';
    return { key, researcher: key.split('|')[0], skill: key.split('|')[1], observations: sorted.length, firstGap, latestGap, change, direction, closing: direction === 'closing' };
  }).sort((a, b) => a.change - b.change || String(a.key).localeCompare(String(b.key)));
  const closingCount = rows.filter(r => r.closing).length;
  const wideningCount = rows.filter(r => r.direction === 'widening').length;
  return { rows, count: rows.length, closingCount, wideningCount, stableCount: rows.filter(r => r.direction === 'stable').length, top: rows[0] || null, summary: `Infinity AI tracked gap trends for ${rows.length} researcher skill(s); ${closingCount} are closing.` };
}
/** Idea 53900 — Training Recommendation Engine. Input records: {researcher, skill, gapScore, moduleId, moduleFit}. Each gap above the bar recommends its best-fitting module, ranked by gap then fit. Recommends specific training modules for each detected gap. */
export function recommendTraining(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const moduleFit = round2(clamp01(r.moduleFit ?? r.fit));
    const priority = round2(gapScore * moduleFit);
    const recommended = gapScore >= 0.3;
    return { key: `${researcher}|${skill}`, researcher, skill, gapScore, moduleId: String(r.moduleId || r.module || 'module'), moduleFit, priority, recommended, action: recommended ? 'enroll' : 'monitor' };
  }).sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  rows.forEach((row, i) => { row.rank = i + 1; });
  const recommendedCount = rows.filter(r => r.recommended).length;
  return { rows, count: rows.length, recommendedCount, top: rows[0] || null, summary: `Infinity AI recommended training for ${recommendedCount} of ${rows.length} detected gap(s).` };
}
/** Idea 53901 — Skill Gap Team Aggregation. Input records: {researcher, skill, gapScore}. Team aggregation averages each skill across researchers to plan group training where gaps concentrate. Aggregates gaps team-wide to plan group training sessions. */
export function aggregateTeamSkillGaps(records = []) {
  const groups = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const skill = String(r.skill || 'skill');
    if (!groups.has(skill)) groups.set(skill, []);
    groups.get(skill).push(round2(clamp01(r.gapScore ?? r.gap)));
  }
  const rows = [...groups.entries()].map(([skill, gaps]) => {
    const averageGap = mean(gaps);
    const affectedCount = gaps.filter(g => g >= 0.3).length;
    return { key: skill, skill, researchers: gaps.length, averageGap, worstGap: gaps.length ? Math.max(...gaps) : 0, affectedCount, needsGroupTraining: averageGap >= 0.4 && affectedCount >= 2 };
  }).sort((a, b) => b.averageGap - a.averageGap || String(a.key).localeCompare(String(b.key)));
  const groupTrainingCount = rows.filter(r => r.needsGroupTraining).length;
  return { rows, count: rows.length, skillCount: rows.length, groupTrainingCount, teamAverageGap: mean(rows.map(r => r.averageGap)), top: rows[0] || null, summary: `Infinity AI aggregated gaps across ${rows.length} skill(s); ${groupTrainingCount} need group training.` };
}
/** Idea 53902 — New-Hire Skill Baselines. Input records: {researcher, skill, replayScore, earlyHuntScore, daysOnboard}. Baselines blend replay performance with early hunt evidence, weighted toward live hunts as tenure grows. Establishes skill baselines for new hires from replay performance and early hunts. */
export function establishNewHireBaselines(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const replayScore = round2(clamp01(r.replayScore ?? r.replay));
    const earlyHuntScore = round2(clamp01(r.earlyHuntScore ?? r.earlyHunts));
    const daysOnboard = num(r.daysOnboard ?? r.days, 0);
    const huntWeight = round2(Math.min(0.8, 0.3 + daysOnboard / 100));
    const baseline = round2(earlyHuntScore * huntWeight + replayScore * (1 - huntWeight));
    return { key: `${researcher}|${skill}`, researcher, skill, replayScore, earlyHuntScore, daysOnboard, huntWeight, baseline, level: baseline >= 0.6 ? 'strong-start' : baseline >= 0.35 ? 'typical-start' : 'needs-support', established: daysOnboard >= 14 };
  }).sort((a, b) => b.baseline - a.baseline || String(a.key).localeCompare(String(b.key)));
  const establishedCount = rows.filter(r => r.established).length;
  return { rows, count: rows.length, establishedCount, averageBaseline: mean(rows.map(r => r.baseline)), top: rows[0] || null, summary: `Infinity AI established baselines for ${rows.length} new-hire skill(s) from replay and early hunt evidence.` };
}
/** Idea 53903 — Skill Validation Challenges. Input records: {researcher, skill, claimedLevel, challengeScore, passMark}. A claim validates when the practical challenge score clears the pass mark at the claimed level. Practical challenges that validate claimed skill improvements. */
export function validateSkillChallenges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const claimedLevel = num(r.claimedLevel, 0);
    const challengeScore = round2(clamp01(r.challengeScore ?? r.score));
    const passMark = round2(clamp01(r.passMark ?? 0.7));
    const validated = challengeScore >= passMark;
    return { key: `${researcher}|${skill}`, researcher, skill, claimedLevel, challengeScore, passMark, validated, margin: round2(challengeScore - passMark), status: validated ? 'validated' : 'not-yet-validated' };
  }).sort((a, b) => b.challengeScore - a.challengeScore || String(a.key).localeCompare(String(b.key)));
  const validatedCount = rows.filter(r => r.validated).length;
  return { rows, count: rows.length, validatedCount, pendingCount: rows.length - validatedCount, top: rows[0] || null, summary: `Infinity AI validated ${validatedCount} of ${rows.length} claimed skill improvement(s) through practical challenges.` };
}
/** Idea 53904 — Mentor Matching by Gap. Input records: {researcher, skill, gapScore, mentor, mentorStrength}. A match pairs a real gap with a mentor strong in exactly that area. Matches researchers with mentors strong in their gap areas. */
export function matchMentorsByGap(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const mentorStrength = round2(clamp01(r.mentorStrength ?? r.strength));
    const matchScore = round2(gapScore * mentorStrength);
    const matched = gapScore >= 0.3 && mentorStrength >= 0.6;
    return { key: `${researcher}|${skill}`, researcher, skill, gapScore, mentor: String(r.mentor || 'mentor'), mentorStrength, matchScore, matched, quality: matched ? (matchScore >= 0.4 ? 'strong-match' : 'workable-match') : 'no-match' };
  }).sort((a, b) => b.matchScore - a.matchScore || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, unmatchedCount: rows.length - matchedCount, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} gap(s) with mentors strong in the area.` };
}
/** Idea 53905 — Skill Gap Privacy Controls. Input records: {researcher, visibility, requesterRole}. Profiles stay visible only within the sharing scope the researcher chose. Lets researchers control who sees their skill profiles. */
export function applySkillPrivacyControls(records = []) {
  const scopes = { private: ['self'], 'mentor-only': ['self', 'mentor'], team: ['self', 'mentor', 'team'], managers: ['self', 'mentor', 'team', 'manager'], public: ['self', 'mentor', 'team', 'manager', 'public'] };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const visibility = String(r.visibility || 'private').toLowerCase();
    const requesterRole = String(r.requesterRole || r.role || 'team').toLowerCase();
    const allowed = scopes[visibility] || scopes.private;
    const canView = allowed.includes(requesterRole);
    return { key: `${researcher}|${requesterRole}`, researcher, visibility: scopes[visibility] ? visibility : 'private', requesterRole, allowedRoles: allowed, canView, restricted: !canView };
  }).sort((a, b) => Number(b.canView) - Number(a.canView) || String(a.key).localeCompare(String(b.key)));
  const visibleCount = rows.filter(r => r.canView).length;
  return { rows, count: rows.length, visibleCount, restrictedCount: rows.length - visibleCount, top: rows[0] || null, summary: `Infinity AI applied privacy controls to ${rows.length} skill profile request(s); ${rows.length - visibleCount} stayed restricted.` };
}
/** Idea 53906 — Skill Progress Milestones. Input records: {researcher, skill, startGap, currentGap, milestoneGap}. A milestone lands when the gap closes past the celebration threshold from where it started. Celebrates when researchers close significant gaps. */
export function trackSkillProgressMilestones(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const startGap = round2(clamp01(r.startGap));
    const currentGap = round2(clamp01(r.currentGap));
    const milestoneGap = round2(clamp01(r.milestoneGap ?? 0.3));
    const closedShare = startGap > 0 ? round2((startGap - currentGap) / startGap) : 0;
    const milestoneReached = currentGap <= milestoneGap && startGap > milestoneGap;
    return { key: `${researcher}|${skill}`, researcher, skill, startGap, currentGap, milestoneGap, closedShare, milestoneReached, status: milestoneReached ? 'milestone-reached' : currentGap <= milestoneGap ? 'already-strong' : 'in-progress' };
  }).sort((a, b) => b.closedShare - a.closedShare || String(a.key).localeCompare(String(b.key)));
  const milestoneCount = rows.filter(r => r.milestoneReached).length;
  return { rows, count: rows.length, milestoneCount, inProgressCount: rows.filter(r => r.status === 'in-progress').length, top: rows[0] || null, summary: `Infinity AI celebrated ${milestoneCount} skill milestone(s) across ${rows.length} tracked gap(s).` };
}
/** Idea 53907 — Cross-Training Suggestions (learning). Input records: {researcher, strengthSkill, strengthScore, gapSkill, gapScore, partner}. Suggestions pair a researcher's strength with a complementary gap so teammates teach each other. Suggests cross-training based on complementary team gaps. */
export function suggestCrossTraining(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const strengthScore = round2(clamp01(r.strengthScore));
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const complementarity = round2(strengthScore * gapScore);
    const suggested = strengthScore >= 0.6 && gapScore >= 0.3;
    return { key: `${researcher}|${String(r.gapSkill || 'skill')}`, researcher, strengthSkill: String(r.strengthSkill || 'skill'), strengthScore, gapSkill: String(r.gapSkill || 'skill'), gapScore, partner: String(r.partner || 'partner'), complementarity, suggested, action: suggested ? 'pair-up' : 'hold' };
  }).sort((a, b) => b.complementarity - a.complementarity || String(a.key).localeCompare(String(b.key)));
  const suggestedCount = rows.filter(r => r.suggested).length;
  return { rows, count: rows.length, suggestedCount, top: rows[0] || null, summary: `Infinity AI suggested ${suggestedCount} cross-training pairing(s) from complementary team gaps.` };
}
/** Idea 53908 — Skill Gap vs Assignment Fit. Input records: {researcher, assignmentSkill, proficiency, requiredProficiency}. Assignments misalign when proficiency falls well below what the target demands. Flags when a researcher is assigned targets misaligned with their skills. */
export function checkAssignmentFit(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const assignmentSkill = String(r.assignmentSkill || r.skill || 'skill');
    const proficiency = round2(clamp01(r.proficiency));
    const requiredProficiency = round2(clamp01(r.requiredProficiency ?? r.required));
    const deficit = round2(Math.max(0, requiredProficiency - proficiency));
    const misaligned = deficit >= 0.25;
    return { key: `${researcher}|${assignmentSkill}`, researcher, assignmentSkill, proficiency, requiredProficiency, deficit, misaligned, fit: misaligned ? 'misaligned' : deficit > 0 ? 'stretched' : 'aligned' };
  }).sort((a, b) => b.deficit - a.deficit || String(a.key).localeCompare(String(b.key)));
  const misalignedCount = rows.filter(r => r.misaligned).length;
  return { rows, count: rows.length, misalignedCount, alignedCount: rows.filter(r => r.fit === 'aligned').length, top: rows[0] || null, summary: `Infinity AI flagged ${misalignedCount} of ${rows.length} assignment(s) as misaligned with researcher skills.` };
}
/** Idea 53909 — Skill Decay Detection. Input records: {researcher, skill, lastUsedDays, peakProficiency, currentProficiency}. Decay shows when a once-strong skill idles for months and its live proficiency slips. Detects skills degrading from disuse and suggests refreshers. */
export function detectSkillDecay(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const lastUsedDays = num(r.lastUsedDays ?? r.idleDays, 0);
    const peakProficiency = round2(clamp01(r.peakProficiency ?? r.peak));
    const currentProficiency = round2(clamp01(r.currentProficiency ?? r.current));
    const decay = round2(Math.max(0, peakProficiency - currentProficiency));
    const decayed = lastUsedDays >= 90 && decay >= 0.2;
    return { key: `${researcher}|${skill}`, researcher, skill, lastUsedDays, peakProficiency, currentProficiency, decay, decayed, refresherSuggested: decayed, status: decayed ? 'decayed' : lastUsedDays >= 90 ? 'idle-intact' : 'active' };
  }).sort((a, b) => b.decay - a.decay || b.lastUsedDays - a.lastUsedDays || String(a.key).localeCompare(String(b.key)));
  const decayedCount = rows.filter(r => r.decayed).length;
  return { rows, count: rows.length, decayedCount, refresherCount: decayedCount, top: rows[0] || null, summary: `Infinity AI detected decay in ${decayedCount} of ${rows.length} idle skill(s) and suggested refreshers.` };
}
/** Idea 53910 — Emerging Skill Identification. Input records: {skill, targetDemand, teamCoverage, demandGrowth}. Emerging skills combine fast-growing demand with thin team coverage. Identifies new skills the team lacks as technology evolves. */
export function identifyEmergingSkills(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const targetDemand = round2(clamp01(r.targetDemand ?? r.demand));
    const teamCoverage = round2(clamp01(r.teamCoverage ?? r.coverage));
    const demandGrowth = round2(num(r.demandGrowth ?? r.growth, 0));
    const urgency = round2(targetDemand * (1 - teamCoverage) * Math.max(0, demandGrowth));
    const emerging = demandGrowth >= 0.3 && teamCoverage < 0.4;
    return { key: skill, skill, targetDemand, teamCoverage, demandGrowth, urgency, emerging, status: emerging ? 'emerging-gap' : teamCoverage >= 0.4 ? 'covered' : 'watch' };
  }).sort((a, b) => b.urgency - a.urgency || String(a.key).localeCompare(String(b.key)));
  const emergingCount = rows.filter(r => r.emerging).length;
  return { rows, count: rows.length, emergingCount, coveredCount: rows.filter(r => r.status === 'covered').length, top: rows[0] || null, summary: `Infinity AI identified ${emergingCount} emerging skill(s) the team lacks as targets evolve.` };
}
/** Idea 53911 — Skill Gap Benchmarking. Input records: {skill, teamScore, industryScore}. Benchmark gaps measure the team against industry expectations per skill. Compares team skill profiles against industry expectations. */
export function benchmarkSkillGaps(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const teamScore = round2(clamp01(r.teamScore ?? r.team));
    const industryScore = round2(clamp01(r.industryScore ?? r.industry));
    const benchmarkGap = round2(industryScore - teamScore);
    return { key: skill, skill, teamScore, industryScore, benchmarkGap, behind: benchmarkGap > 0.15, standing: benchmarkGap <= 0 ? 'at-or-above' : benchmarkGap > 0.15 ? 'behind' : 'near' };
  }).sort((a, b) => b.benchmarkGap - a.benchmarkGap || String(a.key).localeCompare(String(b.key)));
  const behindCount = rows.filter(r => r.behind).length;
  return { rows, count: rows.length, behindCount, atOrAboveCount: rows.filter(r => r.standing === 'at-or-above').length, averageGap: mean(rows.map(r => r.benchmarkGap)), top: rows[0] || null, summary: `Infinity AI benchmarked ${rows.length} skill(s) against industry expectations; ${behindCount} lag behind.` };
}
/** Idea 53912 — Personalized Learning Paths. Input records: {researcher, skill, gapScore, moduleId, orderHint}. Paths order each researcher's gap modules from the largest gap down into a study sequence. Builds ordered learning paths from each researcher's gap profile. */
export function buildLearningPaths(records = []) {
  const groups = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const researcher = String(r.researcher || 'researcher');
    if (!groups.has(researcher)) groups.set(researcher, []);
    groups.get(researcher).push({ skill: String(r.skill || 'skill'), gapScore: round2(clamp01(r.gapScore ?? r.gap)), moduleId: String(r.moduleId || r.module || 'module') });
  }
  const rows = [...groups.entries()].map(([researcher, items]) => {
    const path = [...items].sort((a, b) => b.gapScore - a.gapScore || String(a.skill).localeCompare(String(b.skill))).map((item, i) => ({ ...item, step: i + 1 }));
    const totalGap = round2(items.reduce((s, i) => s + i.gapScore, 0));
    return { key: researcher, researcher, path, stepCount: path.length, totalGap, firstStep: path[0] || null, estimatedWeeks: Math.max(1, Math.ceil(totalGap * 4)) };
  }).sort((a, b) => b.totalGap - a.totalGap || String(a.key).localeCompare(String(b.key)));
  const totalSteps = rows.reduce((s, r) => s + r.stepCount, 0);
  return { rows, count: rows.length, researcherCount: rows.length, totalSteps, top: rows[0] || null, summary: `Infinity AI built personalized learning paths for ${rows.length} researcher(s) covering ${totalSteps} step(s).` };
}
/** Idea 53913 — Skill Assessment Cadence. Input records: {researcher, skill, lastAssessedDays, reassessDays}. Assessments come due on cadence without over-testing fresh evidence. Defines how often skills are reassessed without over-testing. */
export function scheduleSkillAssessments(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const lastAssessedDays = num(r.lastAssessedDays ?? r.daysSince, 0);
    const reassessDays = Math.max(7, num(r.reassessDays ?? r.cadenceDays, 90));
    const due = lastAssessedDays >= reassessDays;
    return { key: `${researcher}|${skill}`, researcher, skill, lastAssessedDays, reassessDays, daysOverdue: Math.max(0, lastAssessedDays - reassessDays), due, overTested: lastAssessedDays < reassessDays / 3, status: due ? 'due' : lastAssessedDays < reassessDays / 3 ? 'recently-tested' : 'on-cadence' };
  }).sort((a, b) => b.daysOverdue - a.daysOverdue || String(a.key).localeCompare(String(b.key)));
  const dueCount = rows.filter(r => r.due).length;
  return { rows, count: rows.length, dueCount, onCadenceCount: rows.filter(r => r.status === 'on-cadence').length, top: rows[0] || null, summary: `Infinity AI scheduled skill reassessments; ${dueCount} of ${rows.length} are due without over-testing.` };
}
/** Idea 53914 — Skill Evidence Portfolios. Input records: {researcher, skill, highlights, verifiedHighlights}. Portfolios showcase verified hunt highlights as evidence behind a claimed skill. Lets researchers showcase evidence of skills from hunt highlights. */
export function buildEvidencePortfolios(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const highlights = num(r.highlights, 0);
    const verifiedHighlights = Math.min(highlights, num(r.verifiedHighlights ?? r.verified, 0));
    const evidenceStrength = rate(verifiedHighlights, Math.max(1, highlights));
    return { key: `${researcher}|${skill}`, researcher, skill, highlights, verifiedHighlights, evidenceStrength, showcaseReady: verifiedHighlights >= 3, status: verifiedHighlights >= 3 ? 'showcase-ready' : highlights > 0 ? 'building' : 'empty' };
  }).sort((a, b) => b.verifiedHighlights - a.verifiedHighlights || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.showcaseReady).length;
  return { rows, count: rows.length, readyCount, totalHighlights: rows.reduce((s, r) => s + r.highlights, 0), top: rows[0] || null, summary: `Infinity AI built evidence portfolios for ${rows.length} skill(s); ${readyCount} are showcase-ready.` };
}
/** Idea 53915 — Manager Skill Dashboards. Input records: {team, skill, averageGap, researcherCount, exposedIndividuals}. Manager views aggregate team gaps while keeping individual weaknesses unexposed. Gives managers aggregate views without exposing individual weaknesses inappropriately. */
export function buildManagerSkillDashboards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const team = String(r.team || 'team');
    const skill = String(r.skill || 'skill');
    const averageGap = round2(clamp01(r.averageGap ?? r.gap));
    const researcherCount = num(r.researcherCount ?? r.researchers, 0);
    const exposedIndividuals = num(r.exposedIndividuals ?? r.exposed, 0);
    const privacySafe = exposedIndividuals === 0 && researcherCount >= 3;
    return { key: `${team}|${skill}`, team, skill, averageGap, researcherCount, exposedIndividuals, privacySafe, aggregationLevel: researcherCount >= 3 ? 'team-aggregate' : 'suppressed-small-group', visible: privacySafe };
  }).sort((a, b) => b.averageGap - a.averageGap || String(a.key).localeCompare(String(b.key)));
  const safeCount = rows.filter(r => r.privacySafe).length;
  return { rows, count: rows.length, safeCount, suppressedCount: rows.length - safeCount, top: rows[0] || null, summary: `Infinity AI prepared ${safeCount} privacy-safe manager dashboard view(s) across ${rows.length} team skill(s).` };
}
/** Idea 53916 — Skill Gap Closure Verification. Input records: {researcher, skill, gapBefore, gapAfter, huntEvidence}. Closure verifies only when observed hunt performance confirms the gap actually shrank. Verifies gaps actually closed through observed hunt performance. */
export function verifySkillGapClosure(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const gapBefore = round2(clamp01(r.gapBefore ?? r.before));
    const gapAfter = round2(clamp01(r.gapAfter ?? r.after));
    const huntEvidence = num(r.huntEvidence ?? r.evidence, 0);
    const improvement = round2(gapBefore - gapAfter);
    const verified = improvement >= 0.25 && huntEvidence >= 5;
    return { key: `${researcher}|${skill}`, researcher, skill, gapBefore, gapAfter, improvement, huntEvidence, verified, status: verified ? 'closure-verified' : improvement > 0 ? 'improving-unverified' : 'no-closure' };
  }).sort((a, b) => b.improvement - a.improvement || String(a.key).localeCompare(String(b.key)));
  const verifiedCount = rows.filter(r => r.verified).length;
  return { rows, count: rows.length, verifiedCount, unverifiedCount: rows.length - verifiedCount, top: rows[0] || null, summary: `Infinity AI verified gap closure for ${verifiedCount} of ${rows.length} skill(s) through observed hunt performance.` };
}
/** Idea 53917 — Team Skill Diversity Metrics. Input records: {skill, specialists, totalResearchers}. Diversity rewards skills held by some but not all researchers, a resilience signal against single points of failure. Measures skill diversity as a team resilience indicator. */
export function measureTeamSkillDiversity(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const specialists = num(r.specialists, 0);
    const totalResearchers = Math.max(1, num(r.totalResearchers ?? r.teamSize, 1));
    const share = rate(specialists, totalResearchers);
    const diversityContribution = round2(4 * share * (1 - share));
    return { key: skill, skill, specialists, totalResearchers, share, diversityContribution, singlePointOfFailure: specialists === 1, resilient: specialists >= 3 };
  }).sort((a, b) => b.diversityContribution - a.diversityContribution || String(a.key).localeCompare(String(b.key)));
  const diversityIndex = mean(rows.map(r => r.diversityContribution));
  const fragileCount = rows.filter(r => r.singlePointOfFailure).length;
  return { rows, count: rows.length, diversityIndex, fragileCount, resilientCount: rows.filter(r => r.resilient).length, top: rows[0] || null, summary: `Infinity AI measured team skill diversity at ${diversityIndex} across ${rows.length} skill(s); ${fragileCount} rest on one person.` };
}
/** Idea 53918 — Skill Gap Cost Estimates. Input records: {skill, gapScore, huntsAffected, findingsPerHunt, valuePerFinding}. Lost findings price the gap so training investment has a business case. Estimates findings lost to skill gaps to justify training investment. */
export function estimateSkillGapCosts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const huntsAffected = num(r.huntsAffected ?? r.hunts, 0);
    const findingsPerHunt = round2(num(r.findingsPerHunt, 0));
    const valuePerFinding = num(r.valuePerFinding ?? r.value, 0);
    const lostFindings = round2(gapScore * huntsAffected * findingsPerHunt);
    const lostValue = round2(lostFindings * valuePerFinding);
    return { key: skill, skill, gapScore, huntsAffected, findingsPerHunt, valuePerFinding, lostFindings, lostValue, justifiesTraining: lostValue >= 1000 };
  }).sort((a, b) => b.lostValue - a.lostValue || String(a.key).localeCompare(String(b.key)));
  const totalLostValue = round2(rows.reduce((s, r) => s + r.lostValue, 0));
  const totalLostFindings = round2(rows.reduce((s, r) => s + r.lostFindings, 0));
  return { rows, count: rows.length, totalLostFindings, totalLostValue, justifiedCount: rows.filter(r => r.justifiesTraining).length, top: rows[0] || null, summary: `Infinity AI estimated skill gaps cost ${totalLostFindings} finding(s) worth ${totalLostValue} across ${rows.length} skill(s).` };
}
/** Idea 53919 — Learning Resource Ratings. Input records: {resourceId, skill, ratings, averageRating, completions}. Rated resources rank by researcher ratings weighted by completions so recommendations improve. Lets researchers rate training resources to improve recommendations. */
export function rateLearningResources(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const resourceId = String(r.resourceId || r.resource || 'resource');
    const skill = String(r.skill || 'skill');
    const ratings = num(r.ratings, 0);
    const averageRating = round2(Math.min(5, Math.max(0, num(r.averageRating ?? r.rating, 0))));
    const completions = num(r.completions, 0);
    const confidence = round2(Math.min(1, ratings / 20));
    const recommendationScore = round2((averageRating / 5) * (0.5 + 0.5 * confidence));
    return { key: resourceId, resourceId, skill, ratings, averageRating, completions, confidence, recommendationScore, recommended: averageRating >= 4 && ratings >= 5 };
  }).sort((a, b) => b.recommendationScore - a.recommendationScore || String(a.key).localeCompare(String(b.key)));
  rows.forEach((row, i) => { row.rank = i + 1; });
  const recommendedCount = rows.filter(r => r.recommended).length;
  return { rows, count: rows.length, recommendedCount, top: rows[0] || null, summary: `Infinity AI ranked ${rows.length} learning resource(s) from researcher ratings; ${recommendedCount} are recommended.` };
}
/** Idea 53920 — Skill Mentorship Credit. Input records: {mentor, mentee, skill, gapClosed, sessions}. Credit accrues when mentees close gaps, shared between effort and outcome. Credits mentors when mentees close gaps. */
export function creditSkillMentorship(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const mentor = String(r.mentor || 'mentor');
    const mentee = String(r.mentee || 'mentee');
    const skill = String(r.skill || 'skill');
    const gapClosed = round2(clamp01(r.gapClosed));
    const sessions = num(r.sessions, 0);
    const credit = round2(gapClosed * 10 + Math.min(5, sessions * 0.5));
    const credited = gapClosed >= 0.25;
    return { key: `${mentor}|${mentee}|${skill}`, mentor, mentee, skill, gapClosed, sessions, credit, credited, status: credited ? 'credit-earned' : 'in-progress' };
  }).sort((a, b) => b.credit - a.credit || String(a.key).localeCompare(String(b.key)));
  const mentorTotals = new Map();
  for (const row of rows) if (row.credited) mentorTotals.set(row.mentor, round2((mentorTotals.get(row.mentor) || 0) + row.credit));
  const mentorCredits = [...mentorTotals.entries()].map(([mentor, credit]) => ({ mentor, credit })).sort((a, b) => b.credit - a.credit || String(a.mentor).localeCompare(String(b.mentor)));
  const creditedCount = rows.filter(r => r.credited).length;
  return { rows, count: rows.length, creditedCount, totalCredit: round2(rows.reduce((s, r) => s + (r.credited ? r.credit : 0), 0)), mentorCredits, topMentor: mentorCredits[0] || null, top: rows[0] || null, summary: `Infinity AI credited mentors for ${creditedCount} closed gap(s) across ${rows.length} mentorship pairing(s).` };
}
