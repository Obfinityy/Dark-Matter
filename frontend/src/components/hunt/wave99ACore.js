/**
 * wave99ACore.js — Infinity AI · Wave 99A
 * Skill gap operations, ideas 53921–53949: skill gap alert thresholds,
 * career path skill mapping, skill gap interview insights, just-in-time
 * microlearning, skill practice sandboxes, skill gap peer study groups,
 * certification alignment, skill gap data minimization, skill profile
 * portability, skill gap feedback loops, team lead skill coaching
 * guides, skill gap resolution playbooks, skill assessment fairness
 * audits, skill growth storytelling, skill gap early warnings,
 * cross-functional skill sharing, skill gap gamification, skill
 * benchmark calibration, skill gap retrospective integration, learning
 * time allocation, skill gap succession planning, skill community
 * contributions, skill gap review cadence, skill development ROI,
 * skill gap transparency reports, skill assessment accessibility,
 * skill gap data retention, skill-based hunt staffing, and future
 * skill forecasting.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE99_A_IDEAS = [
  { id: 53921, title: 'Skill Gap Alert Thresholds', skip: false },
  { id: 53922, title: 'Career Path Skill Mapping', skip: false },
  { id: 53923, title: 'Skill Gap Interview Insights', skip: false },
  { id: 53924, title: 'Just-in-Time Microlearning', skip: false },
  { id: 53925, title: 'Skill Practice Sandboxes', skip: false },
  { id: 53926, title: 'Skill Gap Peer Study Groups', skip: false },
  { id: 53927, title: 'Certification Alignment', skip: false },
  { id: 53928, title: 'Skill Gap Data Minimization', skip: false },
  { id: 53929, title: 'Skill Profile Portability', skip: false },
  { id: 53930, title: 'Skill Gap Feedback Loops', skip: false },
  { id: 53931, title: 'Team Lead Skill Coaching Guides', skip: false },
  { id: 53932, title: 'Skill Gap Resolution Playbooks', skip: false },
  { id: 53933, title: 'Skill Assessment Fairness Audits', skip: false },
  { id: 53934, title: 'Skill Growth Storytelling', skip: false },
  { id: 53935, title: 'Skill Gap Early Warnings', skip: false },
  { id: 53936, title: 'Cross-Functional Skill Sharing', skip: false },
  { id: 53937, title: 'Skill Gap Gamification', skip: false },
  { id: 53938, title: 'Skill Benchmark Calibration', skip: false },
  { id: 53939, title: 'Skill Gap Retrospective Integration', skip: false },
  { id: 53940, title: 'Learning Time Allocation', skip: false },
  { id: 53941, title: 'Skill Gap Succession Planning', skip: false },
  { id: 53942, title: 'Skill Community Contributions', skip: false },
  { id: 53943, title: 'Skill Gap Review Cadence', skip: false },
  { id: 53944, title: 'Skill Development ROI', skip: false },
  { id: 53945, title: 'Skill Gap Transparency Reports', skip: false },
  { id: 53946, title: 'Skill Assessment Accessibility', skip: false },
  { id: 53947, title: 'Skill Gap Data Retention', skip: false },
  { id: 53948, title: 'Skill-Based Hunt Staffing', skip: false },
  { id: 53949, title: 'Future Skill Forecasting', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}

/** Idea 53921 — Skill Gap Alert Thresholds. Input records: {researcher, skill, gapScore, warnThreshold, alertThreshold}. Alerts fire when a gap crosses its personal warn or alert line so coaching starts early. Sets the gap levels that trigger coaching alerts per researcher and skill. */
export function setSkillGapAlertThresholds(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const warnThreshold = round2(clamp01(r.warnThreshold ?? 0.4));
    const alertThreshold = round2(clamp01(r.alertThreshold ?? 0.7));
    const level = gapScore >= alertThreshold ? 'alert' : gapScore >= warnThreshold ? 'warn' : 'clear';
    return { key: `${researcher}|${skill}`, researcher, skill, gapScore, warnThreshold, alertThreshold, level, alerting: level === 'alert', watching: level === 'warn' };
  }).sort((a, b) => b.gapScore - a.gapScore || String(a.key).localeCompare(String(b.key)));
  const alertCount = rows.filter(r => r.alerting).length;
  return { rows, count: rows.length, alertCount, warnCount: rows.filter(r => r.watching).length, clearCount: rows.filter(r => r.level === 'clear').length, top: rows[0] || null, summary: `Infinity AI evaluated gap thresholds for ${rows.length} skill(s); ${alertCount} crossed the alert line.` };
}
/** Idea 53922 — Career Path Skill Mapping. Input records: {researcher, targetRole, requiredSkills, heldSkills}. Readiness is held over required skills on the path to a target role. Maps current skills onto the requirements of a desired career path. */
export function mapCareerPathSkills(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const targetRole = String(r.targetRole || r.role || 'role');
    const requiredSkills = Array.isArray(r.requiredSkills) ? r.requiredSkills.map(String) : [];
    const heldSkills = Array.isArray(r.heldSkills) ? r.heldSkills.map(String) : [];
    const heldSet = new Set(heldSkills.map(s => s.toLowerCase()));
    const missing = requiredSkills.filter(s => !heldSet.has(s.toLowerCase()));
    const readiness = rate(requiredSkills.length - missing.length, requiredSkills.length || 1);
    return { key: `${researcher}|${targetRole}`, researcher, targetRole, requiredCount: requiredSkills.length, heldCount: heldSkills.length, missing, missingCount: missing.length, readiness, ready: missing.length === 0 };
  }).sort((a, b) => b.readiness - a.readiness || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, averageReadiness: mean(rows.map(r => r.readiness)), top: rows[0] || null, summary: `Infinity AI mapped ${rows.length} career path(s); ${readyCount} already cover every required skill.` };
}
/** Idea 53923 — Skill Gap Interview Insights. Input records: {candidate, skill, interviewScore, threshold}. Insights compare interview signals with the hiring bar to spot systematic gaps. Surfaces recurring skill gaps from interview performance signals. */
export function extractSkillGapInterviewInsights(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const candidate = String(r.candidate || 'candidate');
    const skill = String(r.skill || 'skill');
    const interviewScore = round2(clamp01(r.interviewScore ?? r.score));
    const threshold = round2(clamp01(r.threshold ?? 0.6));
    const belowBar = interviewScore < threshold;
    return { key: `${candidate}|${skill}`, candidate, skill, interviewScore, threshold, belowBar, margin: round2(interviewScore - threshold), status: belowBar ? 'gap-signal' : 'meets-bar' };
  }).sort((a, b) => a.margin - b.margin || String(a.key).localeCompare(String(b.key)));
  const gapCount = rows.filter(r => r.belowBar).length;
  const skillsWithGaps = [...new Set(rows.filter(r => r.belowBar).map(r => r.skill))].sort();
  return { rows, count: rows.length, gapCount, skillsWithGaps, averageScore: mean(rows.map(r => r.interviewScore)), top: rows[0] || null, summary: `Infinity AI reviewed ${rows.length} interview signal(s); ${gapCount} fell below the hiring bar.` };
}
/** Idea 53924 — Just-in-Time Microlearning. Input records: {researcher, skill, gapScore, lessonMinutes, maxMinutes}. Microlearning serves short lessons only when a live gap justifies the interruption. Delivers brief lessons exactly when a hunter hits a skill gap. */
export function deliverJustInTimeMicrolearning(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const lessonMinutes = num(r.lessonMinutes, 0);
    const maxMinutes = num(r.maxMinutes, 10);
    const served = gapScore >= 0.3 && lessonMinutes <= maxMinutes;
    return { key: `${researcher}|${skill}`, researcher, skill, gapScore, lessonMinutes, maxMinutes, served, tooLong: lessonMinutes > maxMinutes, action: served ? 'serve-now' : 'defer' };
  }).sort((a, b) => b.gapScore - a.gapScore || String(a.key).localeCompare(String(b.key)));
  const servedCount = rows.filter(r => r.served).length;
  return { rows, count: rows.length, servedCount, deferredCount: rows.length - servedCount, totalMinutes: rows.filter(r => r.served).reduce((s, r) => s + r.lessonMinutes, 0), top: rows[0] || null, summary: `Infinity AI served just-in-time microlearning for ${servedCount} of ${rows.length} live gap(s).` };
}
/** Idea 53925 — Skill Practice Sandboxes. Input records: {researcher, skill, sandboxAttempts, sandboxScore, passMark}. Sandbox practice counts only when attempts clear the pass mark before live hunts. Provides safe practice environments for closing skill gaps. */
export function runSkillPracticeSandboxes(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const sandboxAttempts = num(r.sandboxAttempts ?? r.attempts, 0);
    const sandboxScore = round2(clamp01(r.sandboxScore ?? r.score));
    const passMark = round2(clamp01(r.passMark ?? 0.7));
    const passed = sandboxScore >= passMark && sandboxAttempts >= 1;
    return { key: `${researcher}|${skill}`, researcher, skill, sandboxAttempts, sandboxScore, passMark, passed, margin: round2(sandboxScore - passMark), status: passed ? 'hunt-ready' : 'keep-practicing' };
  }).sort((a, b) => b.sandboxScore - a.sandboxScore || String(a.key).localeCompare(String(b.key)));
  const passedCount = rows.filter(r => r.passed).length;
  return { rows, count: rows.length, passedCount, practicingCount: rows.length - passedCount, averageScore: mean(rows.map(r => r.sandboxScore)), top: rows[0] || null, summary: `Infinity AI ran practice sandboxes for ${rows.length} skill(s); ${passedCount} are hunt-ready.` };
}
/** Idea 53926 — Skill Gap Peer Study Groups. Input records: {skill, members, targetSize}. Groups form around shared gaps once enough peers with the same gap sign up. Groups peers who share a gap so they can study together. */
export function formSkillGapPeerStudyGroups(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const members = Array.isArray(r.members) ? r.members.map(String) : [];
    const targetSize = Math.max(2, num(r.targetSize, 4));
    const memberCount = members.length;
    const formed = memberCount >= targetSize;
    return { key: skill, skill, members, memberCount, targetSize, formed, seatsLeft: Math.max(0, targetSize - memberCount), status: formed ? 'group-formed' : memberCount > 0 ? 'recruiting' : 'empty' };
  }).sort((a, b) => b.memberCount - a.memberCount || String(a.key).localeCompare(String(b.key)));
  const formedCount = rows.filter(r => r.formed).length;
  return { rows, count: rows.length, formedCount, recruitingCount: rows.filter(r => r.status === 'recruiting').length, totalMembers: rows.reduce((s, r) => s + r.memberCount, 0), top: rows[0] || null, summary: `Infinity AI formed ${formedCount} peer study group(s) across ${rows.length} shared gap(s).` };
}
/** Idea 53927 — Certification Alignment. Input records: {researcher, certification, requiredLevel, currentLevel, expiresDays}. Alignment checks level coverage and expiry so certifications stay meaningful. Aligns hunter certifications with the skills hunts actually require. */
export function alignCertifications(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const certification = String(r.certification || r.cert || 'certification');
    const requiredLevel = num(r.requiredLevel, 0);
    const currentLevel = num(r.currentLevel, 0);
    const expiresDays = num(r.expiresDays, 0);
    const levelMet = currentLevel >= requiredLevel;
    const expiringSoon = expiresDays <= 30;
    return { key: `${researcher}|${certification}`, researcher, certification, requiredLevel, currentLevel, expiresDays, levelMet, expiringSoon, aligned: levelMet && !expiringSoon, status: !levelMet ? 'level-gap' : expiringSoon ? 'renew-soon' : 'aligned' };
  }).sort((a, b) => Number(b.aligned) - Number(a.aligned) || a.expiresDays - b.expiresDays || String(a.key).localeCompare(String(b.key)));
  const alignedCount = rows.filter(r => r.aligned).length;
  return { rows, count: rows.length, alignedCount, renewCount: rows.filter(r => r.status === 'renew-soon').length, gapCount: rows.filter(r => r.status === 'level-gap').length, top: rows[0] || null, summary: `Infinity AI aligned ${alignedCount} of ${rows.length} certification(s) with hunt requirements.` };
}
/** Idea 53928 — Skill Gap Data Minimization. Input records: {researcher, fieldsCollected, fieldsNeeded}. Minimization keeps only fields needed for coaching and drops the rest. Collects only the skill data needed for coaching, nothing more. */
export function minimizeSkillGapData(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const fieldsCollected = Array.isArray(r.fieldsCollected) ? r.fieldsCollected.map(String) : [];
    const fieldsNeeded = Array.isArray(r.fieldsNeeded) ? r.fieldsNeeded.map(String) : [];
    const neededSet = new Set(fieldsNeeded.map(s => s.toLowerCase()));
    const excess = fieldsCollected.filter(f => !neededSet.has(f.toLowerCase()));
    return { key: researcher, researcher, fieldsCollected, fieldsNeeded, collectedCount: fieldsCollected.length, neededCount: fieldsNeeded.length, excess, excessCount: excess.length, minimized: excess.length === 0, retentionRatio: rate(fieldsNeeded.length, Math.max(1, fieldsCollected.length)) };
  }).sort((a, b) => b.excessCount - a.excessCount || String(a.key).localeCompare(String(b.key)));
  const minimizedCount = rows.filter(r => r.minimized).length;
  return { rows, count: rows.length, minimizedCount, totalExcess: rows.reduce((s, r) => s + r.excessCount, 0), top: rows[0] || null, summary: `Infinity AI minimized skill data for ${rows.length} profile(s); ${minimizedCount} already collect only what coaching needs.` };
}
/** Idea 53929 — Skill Profile Portability. Input records: {researcher, format, fieldsTotal, fieldsExported}. Portability means every profile field exports in an open format on demand. Lets researchers export their skill profile in open formats. */
export function exportSkillProfilePortability(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const format = String(r.format || 'json').toLowerCase();
    const fieldsTotal = Math.max(1, num(r.fieldsTotal, 1));
    const fieldsExported = Math.min(fieldsTotal, num(r.fieldsExported, 0));
    const coverage = rate(fieldsExported, fieldsTotal);
    const openFormat = ['json', 'csv', 'markdown'].includes(format);
    return { key: `${researcher}|${format}`, researcher, format, fieldsTotal, fieldsExported, coverage, openFormat, portable: coverage >= 1 && openFormat, status: coverage >= 1 && openFormat ? 'portable' : 'partial-export' };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const portableCount = rows.filter(r => r.portable).length;
  return { rows, count: rows.length, portableCount, averageCoverage: mean(rows.map(r => r.coverage)), top: rows[0] || null, summary: `Infinity AI checked profile portability for ${rows.length} export(s); ${portableCount} are fully portable.` };
}
/** Idea 53930 — Skill Gap Feedback Loops. Input records: {researcher, skill, feedbackItems, actedItems, daysToClose}. Loops close when feedback is acted on quickly and completely. Closes the loop between gap feedback and visible follow-through. */
export function runSkillGapFeedbackLoops(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const feedbackItems = num(r.feedbackItems ?? r.feedback, 0);
    const actedItems = Math.min(feedbackItems, num(r.actedItems ?? r.acted, 0));
    const daysToClose = num(r.daysToClose, 0);
    const closureRate = rate(actedItems, feedbackItems);
    const closed = feedbackItems > 0 && actedItems >= feedbackItems && daysToClose <= 14;
    return { key: `${researcher}|${skill}`, researcher, skill, feedbackItems, actedItems, daysToClose, closureRate, closed, status: closed ? 'loop-closed' : feedbackItems === 0 ? 'no-feedback' : 'loop-open' };
  }).sort((a, b) => b.closureRate - a.closureRate || a.daysToClose - b.daysToClose || String(a.key).localeCompare(String(b.key)));
  const closedCount = rows.filter(r => r.closed).length;
  return { rows, count: rows.length, closedCount, openCount: rows.filter(r => r.status === 'loop-open').length, averageClosure: mean(rows.map(r => r.closureRate)), top: rows[0] || null, summary: `Infinity AI closed the feedback loop on ${closedCount} of ${rows.length} skill gap(s).` };
}
/** Idea 53931 — Team Lead Skill Coaching Guides. Input records: {lead, skill, guideSections, requiredSections, researcherCount}. Guides are ready when every required coaching section exists for the leads team. Gives team leads structured guides for coaching each skill gap. */
export function buildTeamLeadCoachingGuides(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const lead = String(r.lead || 'lead');
    const skill = String(r.skill || 'skill');
    const guideSections = num(r.guideSections ?? r.sections, 0);
    const requiredSections = Math.max(1, num(r.requiredSections, 4));
    const researcherCount = num(r.researcherCount ?? r.researchers, 0);
    const completeness = rate(Math.min(guideSections, requiredSections), requiredSections);
    return { key: `${lead}|${skill}`, lead, skill, guideSections, requiredSections, researcherCount, completeness, ready: completeness >= 1, missingSections: Math.max(0, requiredSections - guideSections) };
  }).sort((a, b) => b.completeness - a.completeness || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, averageCompleteness: mean(rows.map(r => r.completeness)), totalResearchers: rows.reduce((s, r) => s + r.researcherCount, 0), top: rows[0] || null, summary: `Infinity AI prepared coaching guides for ${readyCount} of ${rows.length} lead skill(s).` };
}
/** Idea 53932 — Skill Gap Resolution Playbooks. Input records: {skill, playbookSteps, completedSteps, successRate}. Playbooks resolve gaps by walking proven steps in order to a verified outcome. Step-by-step playbooks that resolve common skill gaps predictably. */
export function buildSkillGapResolutionPlaybooks(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const playbookSteps = Math.max(1, num(r.playbookSteps ?? r.steps, 1));
    const completedSteps = Math.min(playbookSteps, num(r.completedSteps, 0));
    const successRate = round2(clamp01(r.successRate));
    const progress = rate(completedSteps, playbookSteps);
    const resolved = progress >= 1 && successRate >= 0.6;
    return { key: skill, skill, playbookSteps, completedSteps, successRate, progress, resolved, status: resolved ? 'playbook-proven' : progress >= 1 ? 'playbook-unproven' : 'in-playbook' };
  }).sort((a, b) => b.successRate - a.successRate || b.progress - a.progress || String(a.key).localeCompare(String(b.key)));
  const provenCount = rows.filter(r => r.resolved).length;
  return { rows, count: rows.length, provenCount, averageSuccess: mean(rows.map(r => r.successRate)), top: rows[0] || null, summary: `Infinity AI validated ${provenCount} of ${rows.length} gap resolution playbook(s).` };
}
/** Idea 53933 — Skill Assessment Fairness Audits. Input records: {skill, groupAScore, groupBScore, tolerance}. Fairness holds when group score gaps stay inside the tolerance band. Audits assessments so no group is scored unfairly for the same skill. */
export function auditSkillAssessmentFairness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const groupAScore = round2(clamp01(r.groupAScore));
    const groupBScore = round2(clamp01(r.groupBScore));
    const tolerance = round2(clamp01(r.tolerance ?? 0.1));
    const disparity = round2(Math.abs(groupAScore - groupBScore));
    const fair = disparity <= tolerance;
    return { key: skill, skill, groupAScore, groupBScore, tolerance, disparity, fair, status: fair ? 'fair' : 'disparity-flagged' };
  }).sort((a, b) => b.disparity - a.disparity || String(a.key).localeCompare(String(b.key)));
  const fairCount = rows.filter(r => r.fair).length;
  return { rows, count: rows.length, fairCount, flaggedCount: rows.length - fairCount, worstDisparity: rows.length ? rows[0].disparity : 0, top: rows[0] || null, summary: `Infinity AI audited fairness for ${rows.length} assessment(s); ${rows.length - fairCount} show a disparity.` };
}
/** Idea 53934 — Skill Growth Storytelling. Input records: {researcher, skill, milestones, valueDelivered}. Stories turn milestone sequences into growth narratives teams can learn from. Turns individual skill growth into stories the team can learn from. */
export function buildSkillGrowthStories(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const milestones = Array.isArray(r.milestones) ? r.milestones.map(String) : [];
    const valueDelivered = num(r.valueDelivered ?? r.value, 0);
    const storyReady = milestones.length >= 3;
    return { key: `${researcher}|${skill}`, researcher, skill, milestones, milestoneCount: milestones.length, valueDelivered, storyReady, arc: storyReady ? 'full-arc' : milestones.length > 0 ? 'early-arc' : 'no-story' };
  }).sort((a, b) => b.milestoneCount - a.milestoneCount || b.valueDelivered - a.valueDelivered || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.storyReady).length;
  return { rows, count: rows.length, readyCount, totalValue: round2(rows.reduce((s, r) => s + r.valueDelivered, 0)), top: rows[0] || null, summary: `Infinity AI drafted ${readyCount} full growth stor(ies) from ${rows.length} skill journey(s).` };
}
/** Idea 53935 — Skill Gap Early Warnings. Input records: {researcher, skill, gapVelocity, gapScore, warnVelocity}. Warnings fire when gaps widen fast, before they become blockers. Warns when a skill gap is widening fast enough to become a blocker. */
export function detectSkillGapEarlyWarnings(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const gapVelocity = round2(num(r.gapVelocity ?? r.velocity, 0));
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const warnVelocity = round2(num(r.warnVelocity ?? 0.15));
    const warning = gapVelocity >= warnVelocity && gapScore >= 0.3;
    return { key: `${researcher}|${skill}`, researcher, skill, gapVelocity, gapScore, warnVelocity, warning, urgency: round2(gapVelocity * gapScore), status: warning ? 'early-warning' : gapVelocity > 0 ? 'widening-slowly' : 'stable-or-closing' };
  }).sort((a, b) => b.urgency - a.urgency || String(a.key).localeCompare(String(b.key)));
  const warningCount = rows.filter(r => r.warning).length;
  return { rows, count: rows.length, warningCount, top: rows[0] || null, summary: `Infinity AI raised early warnings on ${warningCount} of ${rows.length} widening skill gap(s).` };
}
/** Idea 53936 — Cross-Functional Skill Sharing. Input records: {skill, homeTeam, sharedTeams, sessionsHeld}. Sharing counts when a skill is taught beyond its home team in real sessions. Shares scarce skills across teams instead of hoarding them locally. */
export function shareCrossFunctionalSkills(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const homeTeam = String(r.homeTeam || r.team || 'team');
    const sharedTeams = Array.isArray(r.sharedTeams) ? r.sharedTeams.map(String) : [];
    const sessionsHeld = num(r.sessionsHeld ?? r.sessions, 0);
    const shared = sharedTeams.length >= 1 && sessionsHeld >= 1;
    return { key: skill, skill, homeTeam, sharedTeams, sharedTeamCount: sharedTeams.length, sessionsHeld, shared, reach: sharedTeams.length + 1, status: shared ? 'shared-cross-team' : 'team-local' };
  }).sort((a, b) => b.sharedTeamCount - a.sharedTeamCount || b.sessionsHeld - a.sessionsHeld || String(a.key).localeCompare(String(b.key)));
  const sharedCount = rows.filter(r => r.shared).length;
  return { rows, count: rows.length, sharedCount, totalSessions: rows.reduce((s, r) => s + r.sessionsHeld, 0), top: rows[0] || null, summary: `Infinity AI shared ${sharedCount} of ${rows.length} skill(s) across team boundaries.` };
}
/** Idea 53937 — Skill Gap Gamification. Input records: {researcher, skill, pointsEarned, pointsToNextLevel, challengesDone}. Gamification rewards verified gap closure with points toward the next level. Rewards verified gap closure with points, levels, and challenges. */
export function applySkillGapGamification(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const pointsEarned = num(r.pointsEarned ?? r.points, 0);
    const pointsToNextLevel = Math.max(0, num(r.pointsToNextLevel, 0));
    const challengesDone = num(r.challengesDone ?? r.challenges, 0);
    const levelProgress = pointsToNextLevel > 0 ? round2(pointsEarned / (pointsEarned + pointsToNextLevel)) : 1;
    return { key: `${researcher}|${skill}`, researcher, skill, pointsEarned, pointsToNextLevel, challengesDone, levelProgress, leveledUp: pointsToNextLevel === 0 && pointsEarned > 0, engaged: challengesDone >= 1 };
  }).sort((a, b) => b.pointsEarned - a.pointsEarned || String(a.key).localeCompare(String(b.key)));
  const engagedCount = rows.filter(r => r.engaged).length;
  return { rows, count: rows.length, engagedCount, totalPoints: rows.reduce((s, r) => s + r.pointsEarned, 0), top: rows[0] || null, summary: `Infinity AI gamified gap closure for ${rows.length} skill(s); ${engagedCount} researcher(s) completed challenges.` };
}
/** Idea 53938 — Skill Benchmark Calibration. Input records: {skill, internalBenchmark, externalBenchmark, sampleSize}. Calibration aligns internal bars with external reality once samples are large enough. Calibrates internal skill benchmarks against external reference data. */
export function calibrateSkillBenchmarks(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const internalBenchmark = round2(clamp01(r.internalBenchmark ?? r.internal));
    const externalBenchmark = round2(clamp01(r.externalBenchmark ?? r.external));
    const sampleSize = num(r.sampleSize ?? r.samples, 0);
    const drift = round2(internalBenchmark - externalBenchmark);
    const calibrated = Math.abs(drift) <= 0.1 && sampleSize >= 30;
    return { key: skill, skill, internalBenchmark, externalBenchmark, sampleSize, drift, calibrated, status: calibrated ? 'calibrated' : sampleSize < 30 ? 'thin-sample' : 'drifted' };
  }).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift) || String(a.key).localeCompare(String(b.key)));
  const calibratedCount = rows.filter(r => r.calibrated).length;
  return { rows, count: rows.length, calibratedCount, driftedCount: rows.filter(r => r.status === 'drifted').length, top: rows[0] || null, summary: `Infinity AI calibrated ${calibratedCount} of ${rows.length} skill benchmark(s) against external data.` };
}
/** Idea 53939 — Skill Gap Retrospective Integration. Input records: {huntId, skill, gapNoted, retroLogged, actionAssigned}. Integration means every noted gap lands in the retrospective with an owner. Feeds skill gaps found in hunts into team retrospectives with owners. */
export function integrateSkillGapRetrospectives(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const skill = String(r.skill || 'skill');
    const gapNoted = Boolean(r.gapNoted);
    const retroLogged = Boolean(r.retroLogged);
    const actionAssigned = Boolean(r.actionAssigned);
    const integrated = gapNoted && retroLogged && actionAssigned;
    return { key: `${huntId}|${skill}`, huntId, skill, gapNoted, retroLogged, actionAssigned, integrated, status: integrated ? 'integrated' : !gapNoted ? 'no-gap-noted' : 'partially-integrated' };
  }).sort((a, b) => Number(b.integrated) - Number(a.integrated) || String(a.key).localeCompare(String(b.key)));
  const integratedCount = rows.filter(r => r.integrated).length;
  const notedCount = rows.filter(r => r.gapNoted).length;
  return { rows, count: rows.length, integratedCount, notedCount, integrationRate: rate(integratedCount, notedCount), top: rows[0] || null, summary: `Infinity AI integrated ${integratedCount} of ${notedCount} noted gap(s) into retrospectives with owners.` };
}
/** Idea 53940 — Learning Time Allocation. Input records: {researcher, skill, weeklyHours, allocatedHours, gapScore}. Allocation protects learning time proportional to the gap it must close. Protects weekly learning time sized to each researcher's gaps. */
export function allocateLearningTime(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const weeklyHours = num(r.weeklyHours, 0);
    const allocatedHours = Math.min(weeklyHours, num(r.allocatedHours, 0));
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const utilization = rate(allocatedHours, weeklyHours);
    const protectedTime = allocatedHours >= gapScore * 4;
    return { key: `${researcher}|${skill}`, researcher, skill, weeklyHours, allocatedHours, gapScore, utilization, protectedTime, status: protectedTime ? 'time-protected' : 'time-at-risk' };
  }).sort((a, b) => b.gapScore - a.gapScore || String(a.key).localeCompare(String(b.key)));
  const protectedCount = rows.filter(r => r.protectedTime).length;
  return { rows, count: rows.length, protectedCount, totalAllocated: round2(rows.reduce((s, r) => s + r.allocatedHours, 0)), averageUtilization: mean(rows.map(r => r.utilization)), top: rows[0] || null, summary: `Infinity AI protected learning time for ${protectedCount} of ${rows.length} gap(s).` };
}
/** Idea 53941 — Skill Gap Succession Planning. Input records: {skill, primaryHolder, backupHolders, criticality}. Succession is safe when a critical skill has at least two backups ready. Plans backups so critical skills survive any single departure. */
export function planSkillGapSuccession(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const primaryHolder = String(r.primaryHolder || r.primary || 'holder');
    const backupHolders = Array.isArray(r.backupHolders) ? r.backupHolders.map(String) : [];
    const criticality = round2(clamp01(r.criticality));
    const backupCount = backupHolders.length;
    const safe = criticality < 0.5 || backupCount >= 2;
    return { key: skill, skill, primaryHolder, backupHolders, backupCount, criticality, safe, risk: round2(criticality * Math.max(0, 1 - backupCount / 2)), status: safe ? 'succession-safe' : 'single-point-risk' };
  }).sort((a, b) => b.risk - a.risk || String(a.key).localeCompare(String(b.key)));
  const safeCount = rows.filter(r => r.safe).length;
  return { rows, count: rows.length, safeCount, atRiskCount: rows.length - safeCount, top: rows[0] || null, summary: `Infinity AI succession-planned ${rows.length} critical skill(s); ${rows.length - safeCount} still rest on one person.` };
}
/** Idea 53942 — Skill Community Contributions. Input records: {researcher, skill, contributions, reviews, helpfulVotes}. Contributions share hard-won skill knowledge back to the wider community. Tracks researchers sharing skill knowledge with the wider community. */
export function trackSkillCommunityContributions(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const skill = String(r.skill || 'skill');
    const contributions = num(r.contributions, 0);
    const reviews = num(r.reviews, 0);
    const helpfulVotes = num(r.helpfulVotes ?? r.votes, 0);
    const impact = round2(contributions * 2 + reviews + helpfulVotes * 0.5);
    const active = contributions >= 1;
    return { key: `${researcher}|${skill}`, researcher, skill, contributions, reviews, helpfulVotes, impact, active, status: impact >= 20 ? 'community-leader' : active ? 'contributor' : 'not-yet-sharing' };
  }).sort((a, b) => b.impact - a.impact || String(a.key).localeCompare(String(b.key)));
  const activeCount = rows.filter(r => r.active).length;
  return { rows, count: rows.length, activeCount, totalContributions: rows.reduce((s, r) => s + r.contributions, 0), totalImpact: round2(rows.reduce((s, r) => s + r.impact, 0)), top: rows[0] || null, summary: `Infinity AI tracked community contributions from ${activeCount} of ${rows.length} researcher skill(s).` };
}
/** Idea 53943 — Skill Gap Review Cadence. Input records: {skill, lastReviewedDays, reviewDays, openGaps}. Reviews come due on cadence, sooner when open gaps are waiting on decisions. Sets how often skill gaps are reviewed so nothing goes stale. */
export function scheduleSkillGapReviewCadence(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const lastReviewedDays = num(r.lastReviewedDays ?? r.daysSince, 0);
    const reviewDays = Math.max(7, num(r.reviewDays ?? r.cadenceDays, 30));
    const openGaps = num(r.openGaps ?? r.gaps, 0);
    const due = lastReviewedDays >= reviewDays;
    const urgent = due && openGaps >= 3;
    return { key: skill, skill, lastReviewedDays, reviewDays, openGaps, due, urgent, daysOverdue: Math.max(0, lastReviewedDays - reviewDays), status: urgent ? 'due-urgent' : due ? 'due' : 'on-cadence' };
  }).sort((a, b) => b.daysOverdue - a.daysOverdue || b.openGaps - a.openGaps || String(a.key).localeCompare(String(b.key)));
  const dueCount = rows.filter(r => r.due).length;
  return { rows, count: rows.length, dueCount, urgentCount: rows.filter(r => r.urgent).length, top: rows[0] || null, summary: `Infinity AI scheduled gap reviews; ${dueCount} of ${rows.length} skill(s) are due for review.` };
}
/** Idea 53944 — Skill Development ROI. Input records: {skill, trainingCost, findingsGain, valuePerFinding}. ROI compares the value of gained findings with the full cost of training. Measures whether skill development spending pays for itself. */
export function calculateSkillDevelopmentROI(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const trainingCost = num(r.trainingCost ?? r.cost, 0);
    const findingsGain = num(r.findingsGain ?? r.gain, 0);
    const valuePerFinding = num(r.valuePerFinding ?? r.value, 0);
    const gainedValue = round2(findingsGain * valuePerFinding);
    const roi = trainingCost > 0 ? round2(gainedValue / trainingCost) : (gainedValue > 0 ? 1 : 0);
    return { key: skill, skill, trainingCost, findingsGain, valuePerFinding, gainedValue, roi, net: round2(gainedValue - trainingCost), positive: gainedValue > trainingCost, status: gainedValue > trainingCost ? 'pays-off' : 'underwater' };
  }).sort((a, b) => b.roi - a.roi || String(a.key).localeCompare(String(b.key)));
  const positiveCount = rows.filter(r => r.positive).length;
  return { rows, count: rows.length, positiveCount, totalCost: round2(rows.reduce((s, r) => s + r.trainingCost, 0)), totalGainedValue: round2(rows.reduce((s, r) => s + r.gainedValue, 0)), top: rows[0] || null, summary: `Infinity AI measured development ROI for ${rows.length} skill(s); ${positiveCount} pay for themselves.` };
}
/** Idea 53945 — Skill Gap Transparency Reports. Input records: {team, skill, gapScore, published, audience}. Transparency means gap reports are published to the audience that can act on them. Publishes honest team skill gap reports to everyone who can act. */
export function publishSkillGapTransparencyReports(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const team = String(r.team || 'team');
    const skill = String(r.skill || 'skill');
    const gapScore = round2(clamp01(r.gapScore ?? r.gap));
    const published = Boolean(r.published);
    const audience = Array.isArray(r.audience) ? r.audience.map(String) : [];
    const transparent = published && audience.length >= 2;
    return { key: `${team}|${skill}`, team, skill, gapScore, published, audience, audienceCount: audience.length, transparent, status: transparent ? 'transparent' : published ? 'narrow-audience' : 'unpublished' };
  }).sort((a, b) => Number(b.transparent) - Number(a.transparent) || b.gapScore - a.gapScore || String(a.key).localeCompare(String(b.key)));
  const transparentCount = rows.filter(r => r.transparent).length;
  return { rows, count: rows.length, transparentCount, unpublishedCount: rows.filter(r => r.status === 'unpublished').length, top: rows[0] || null, summary: `Infinity AI published transparent gap reports for ${transparentCount} of ${rows.length} team skill(s).` };
}
/** Idea 53946 — Skill Assessment Accessibility. Input records: {assessmentId, accommodationsOffered, accommodationsNeeded, screenReaderSafe}. Accessibility holds when every needed accommodation is offered and format-safe. Makes skill assessments usable by every researcher. */
export function auditSkillAssessmentAccessibility(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const assessmentId = String(r.assessmentId || r.assessment || 'assessment');
    const accommodationsOffered = Array.isArray(r.accommodationsOffered) ? r.accommodationsOffered.map(String) : [];
    const accommodationsNeeded = Array.isArray(r.accommodationsNeeded) ? r.accommodationsNeeded.map(String) : [];
    const offeredSet = new Set(accommodationsOffered.map(s => s.toLowerCase()));
    const missing = accommodationsNeeded.filter(a => !offeredSet.has(a.toLowerCase()));
    const screenReaderSafe = Boolean(r.screenReaderSafe);
    const accessible = missing.length === 0 && screenReaderSafe;
    return { key: assessmentId, assessmentId, accommodationsOffered, accommodationsNeeded, missing, missingCount: missing.length, screenReaderSafe, accessible, status: accessible ? 'accessible' : 'barriers-remain' };
  }).sort((a, b) => b.missingCount - a.missingCount || String(a.key).localeCompare(String(b.key)));
  const accessibleCount = rows.filter(r => r.accessible).length;
  return { rows, count: rows.length, accessibleCount, barrierCount: rows.length - accessibleCount, top: rows[0] || null, summary: `Infinity AI audited accessibility for ${rows.length} assessment(s); ${accessibleCount} are usable by every researcher.` };
}
/** Idea 53947 — Skill Gap Data Retention. Input records: {researcher, dataType, ageDays, retentionDays}. Skill data is archived once its age passes the retention window set for coaching. Defines how long skill gap data is kept before archival. */
export function planSkillGapDataRetention(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const dataType = String(r.dataType || 'profile');
    const ageDays = num(r.ageDays, 0);
    const retentionDays = Math.max(1, num(r.retentionDays, 1));
    const expired = ageDays > retentionDays;
    return { key: `${researcher}|${dataType}`, researcher, dataType, ageDays, retentionDays, daysLeft: Math.max(0, retentionDays - ageDays), ageRatio: round2(ageDays / retentionDays), expired, action: expired ? 'archive' : 'retain' };
  }).sort((a, b) => b.ageRatio - a.ageRatio || String(a.key).localeCompare(String(b.key)));
  const expiredCount = rows.filter(r => r.expired).length;
  return { rows, count: rows.length, expiredCount, retainedCount: rows.length - expiredCount, top: rows[0] || null, summary: `Infinity AI planned retention for ${rows.length} skill data set(s); ${expiredCount} are due for archival.` };
}
/** Idea 53948 — Skill-Based Hunt Staffing. Input records: {huntId, requiredSkill, researcher, proficiency, requiredProficiency}. Staffing matches hunts to researchers whose proficiency clears the hunt bar. Staffs hunts with researchers whose skills fit the target. */
export function staffSkillBasedHunts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const requiredSkill = String(r.requiredSkill || r.skill || 'skill');
    const researcher = String(r.researcher || 'researcher');
    const proficiency = round2(clamp01(r.proficiency));
    const requiredProficiency = round2(clamp01(r.requiredProficiency ?? r.required));
    const fit = proficiency >= requiredProficiency;
    return { key: `${huntId}|${researcher}`, huntId, requiredSkill, researcher, proficiency, requiredProficiency, fit, margin: round2(proficiency - requiredProficiency), status: fit ? 'staffed' : 'under-skilled' };
  }).sort((a, b) => b.margin - a.margin || String(a.key).localeCompare(String(b.key)));
  const staffedCount = rows.filter(r => r.fit).length;
  return { rows, count: rows.length, staffedCount, understaffedCount: rows.length - staffedCount, top: rows[0] || null, summary: `Infinity AI staffed ${staffedCount} of ${rows.length} hunt assignment(s) on skill fit.` };
}
/** Idea 53949 — Future Skill Forecasting. Input records: {skill, demandGrowth, currentCoverage, horizonMonths}. Forecasts flag skills whose demand will outrun coverage within the horizon. Forecasts which skills hunts will demand next so training starts early. */
export function forecastFutureSkills(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const skill = String(r.skill || 'skill');
    const demandGrowth = round2(num(r.demandGrowth ?? r.growth, 0));
    const currentCoverage = round2(clamp01(r.currentCoverage ?? r.coverage));
    const horizonMonths = num(r.horizonMonths ?? r.horizon, 0);
    const projectedDemand = round2(currentCoverage * (1 + demandGrowth));
    const willGap = demandGrowth >= 0.4 && currentCoverage < 0.5 && horizonMonths >= 6;
    const urgency = round2(demandGrowth * (1 - currentCoverage));
    return { key: skill, skill, demandGrowth, currentCoverage, horizonMonths, projectedDemand, willGap, urgency, status: willGap ? 'train-now' : demandGrowth >= 0.4 ? 'watch' : 'stable' };
  }).sort((a, b) => b.urgency - a.urgency || String(a.key).localeCompare(String(b.key)));
  const trainNowCount = rows.filter(r => r.willGap).length;
  return { rows, count: rows.length, trainNowCount, watchCount: rows.filter(r => r.status === 'watch').length, top: rows[0] || null, summary: `Infinity AI forecast ${rows.length} future skill(s); ${trainNowCount} need training to start now.` };
}
