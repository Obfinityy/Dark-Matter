/**
 * Wave98B.jsx — Infinity AI · Wave 98
 * 26 working React components for skill intelligence, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X98B from './wave98BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w98b-card">
      <div className="w98b-title">{title}</div>
      {note ? <div className="w98b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w98b-badge w98b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w98b-kv">
      <span className="w98b-k">{k}</span>
      <span className="w98b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w98b-bar-row">
      <span className="w98b-k">{label}</span>
      <div className="w98b-bar"><div className="w98b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w98b-v">{value}</span>
    </div>
  );
}

export function SkillTaxonomyForHunters() {
  const data = [
    { skill: 'recon', area: 'recon', requiredLevel: 4, currentLevel: 4 },
    { skill: 'api-testing', area: 'api', requiredLevel: 4, currentLevel: 2 },
    { skill: 'reporting', area: 'reporting', requiredLevel: 3, currentLevel: 3 },
  ];
  const [gapsOnly, setGapsOnly] = useState(false);
  const v = X98B.buildSkillTaxonomy(data);
  const rows = gapsOnly ? v.rows.filter(r => !r.covered) : v.rows;
  return (
    <Card title="SkillTaxonomyForHunters" note="Idea 53895">
      <Kv k="Coverage" v={v.coverage} />
      <button type="button" onClick={() => setGapsOnly(f => !f)}>{gapsOnly ? 'Show all skills' : 'Show gaps only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} (${r.area}) gap`} v={r.gap} />)}
    </Card>
  );
}
export function SkillProficiencyInference() {
  const data = [
    { researcher: 'r-a', skill: 'web', hunts: 50, confirmedFindings: 25, falsePositives: 5 },
    { researcher: 'r-b', skill: 'web', hunts: 40, confirmedFindings: 6, falsePositives: 10 },
  ];
  const [findings, setFindings] = useState(25);
  const v = X98B.inferSkillProficiency([{ ...data[0], confirmedFindings: findings }, data[1]]);
  return (
    <Card title="SkillProficiencyInference" note="Idea 53896">
      <Kv k="Experts" v={v.expertCount} />
      <label className="w98b-field">Researcher r-a confirmed findings ({findings})
        <input type="range" min="0" max="50" value={findings} onChange={e => setFindings(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={`${r.proficiency} · ${r.level}`} />)}
    </Card>
  );
}
export function SkillGapHeatmaps() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapScore: 0.8 },
    { researcher: 'r-a', skill: 'web', gapScore: 0.1 },
    { researcher: 'r-b', skill: 'api', gapScore: 0.5 },
  ];
  const [criticalOnly, setCriticalOnly] = useState(false);
  const v = X98B.buildSkillGapHeatmaps(data);
  const rows = criticalOnly ? v.rows.filter(r => r.heat === 'critical') : v.rows;
  return (
    <Card title="SkillGapHeatmaps" note="Idea 53897">
      <Kv k="Critical cells" v={v.criticalCount} />
      <button type="button" onClick={() => setCriticalOnly(f => !f)}>{criticalOnly ? 'Show full heatmap' : 'Show critical only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.heat} />)}
    </Card>
  );
}
export function PeerRelativeSkillProfiles() {
  const data = [
    { researcher: 'r-a', skill: 'recon', score: 0.8, peerScores: [0.3, 0.4, 0.5, 0.6] },
    { researcher: 'r-b', skill: 'recon', score: 0.35, peerScores: [0.3, 0.4, 0.5, 0.6] },
  ];
  const [scorePct, setScorePct] = useState(80);
  const v = X98B.buildPeerRelativeProfiles([{ ...data[0], score: scorePct / 100 }, data[1]]);
  return (
    <Card title="PeerRelativeSkillProfiles" note="Idea 53898">
      <Kv k="Top quartile" v={v.topQuartileCount} />
      <label className="w98b-field">Researcher r-a score ({scorePct}%)
        <input type="range" min="10" max="100" value={scorePct} onChange={e => setScorePct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={`${r.band} (${r.percentile})`} />)}
    </Card>
  );
}
export function SkillGapTrendTracking() {
  const data = [
    { researcher: 'r-a', skill: 'api', month: 1, gapScore: 0.8 }, { researcher: 'r-a', skill: 'api', month: 2, gapScore: 0.5 }, { researcher: 'r-a', skill: 'api', month: 3, gapScore: 0.3 },
    { researcher: 'r-b', skill: 'web', month: 1, gapScore: 0.3 }, { researcher: 'r-b', skill: 'web', month: 2, gapScore: 0.55 },
  ];
  const [closingOnly, setClosingOnly] = useState(false);
  const v = X98B.trackSkillGapTrends(data);
  const rows = closingOnly ? v.rows.filter(r => r.closing) : v.rows;
  return (
    <Card title="SkillGapTrendTracking" note="Idea 53899">
      <Kv k="Closing gaps" v={v.closingCount} />
      <button type="button" onClick={() => setClosingOnly(f => !f)}>{closingOnly ? 'Show all trends' : 'Show closing only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.direction} />)}
    </Card>
  );
}
export function TrainingRecommendationEngine() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapScore: 0.8, moduleId: 'api-fuzzing-lab', moduleFit: 0.9 },
    { researcher: 'r-b', skill: 'web', gapScore: 0.15, moduleId: 'web-basics', moduleFit: 0.8 },
  ];
  const [gapPct, setGapPct] = useState(80);
  const v = X98B.recommendTraining([{ ...data[0], gapScore: gapPct / 100 }, data[1]]);
  return (
    <Card title="TrainingRecommendationEngine" note="Idea 53900">
      <Kv k="Enrollments" v={v.recommendedCount} />
      <label className="w98b-field">Researcher r-a api gap ({gapPct}%)
        <input type="range" min="0" max="100" value={gapPct} onChange={e => setGapPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`#${r.rank} ${r.skill} module`} v={r.moduleId} />)}
    </Card>
  );
}
export function SkillGapTeamAggregation() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapScore: 0.8 }, { researcher: 'r-b', skill: 'api', gapScore: 0.6 },
    { researcher: 'r-a', skill: 'web', gapScore: 0.1 }, { researcher: 'r-b', skill: 'web', gapScore: 0.2 },
  ];
  const [groupOnly, setGroupOnly] = useState(false);
  const v = X98B.aggregateTeamSkillGaps(data);
  const rows = groupOnly ? v.rows.filter(r => r.needsGroupTraining) : v.rows;
  return (
    <Card title="SkillGapTeamAggregation" note="Idea 53901">
      <Kv k="Group sessions needed" v={v.groupTrainingCount} />
      <button type="button" onClick={() => setGroupOnly(f => !f)}>{groupOnly ? 'Show all skills' : 'Show group training only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} average gap`} v={r.averageGap} />)}
    </Card>
  );
}
export function NewHireSkillBaselines() {
  const data = [
    { researcher: 'new-a', skill: 'recon', replayScore: 0.7, earlyHuntScore: 0.6, daysOnboard: 30 },
    { researcher: 'new-b', skill: 'recon', replayScore: 0.4, earlyHuntScore: 0.3, daysOnboard: 7 },
  ];
  const [days, setDays] = useState(30);
  const v = X98B.establishNewHireBaselines([{ ...data[0], daysOnboard: days }, data[1]]);
  return (
    <Card title="NewHireSkillBaselines" note="Idea 53902">
      <Kv k="Average baseline" v={v.averageBaseline} />
      <label className="w98b-field">First hire days onboard ({days})
        <input type="range" min="0" max="90" value={days} onChange={e => setDays(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} baseline`} v={`${r.baseline} · ${r.level}`} />)}
    </Card>
  );
}
export function SkillValidationChallenges() {
  const data = [
    { researcher: 'r-a', skill: 'api', claimedLevel: 3, challengeScore: 0.85, passMark: 0.7 },
    { researcher: 'r-b', skill: 'api', claimedLevel: 3, challengeScore: 0.5, passMark: 0.7 },
  ];
  const [scorePct, setScorePct] = useState(85);
  const v = X98B.validateSkillChallenges([{ ...data[0], challengeScore: scorePct / 100 }, data[1]]);
  return (
    <Card title="SkillValidationChallenges" note="Idea 53903">
      <Kv k="Validated" v={v.validatedCount} />
      <label className="w98b-field">Researcher r-a challenge score ({scorePct}%)
        <input type="range" min="0" max="100" value={scorePct} onChange={e => setScorePct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function MentorMatchingByGap() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapScore: 0.8, mentor: 'mentor-x', mentorStrength: 0.9 },
    { researcher: 'r-b', skill: 'web', gapScore: 0.7, mentor: 'mentor-y', mentorStrength: 0.3 },
  ];
  const [matchedOnly, setMatchedOnly] = useState(false);
  const v = X98B.matchMentorsByGap(data);
  const rows = matchedOnly ? v.rows.filter(r => r.matched) : v.rows;
  return (
    <Card title="MentorMatchingByGap" note="Idea 53904">
      <Kv k="Matched" v={v.matchedCount} />
      <button type="button" onClick={() => setMatchedOnly(f => !f)}>{matchedOnly ? 'Show all gaps' : 'Show matched only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} with ${r.mentor}`} v={r.quality} />)}
    </Card>
  );
}
export function SkillGapPrivacyControls() {
  const data = [
    { researcher: 'r-a', visibility: 'mentor-only', requesterRole: 'mentor' },
    { researcher: 'r-a', visibility: 'mentor-only', requesterRole: 'team' },
    { researcher: 'r-b', visibility: 'team', requesterRole: 'team' },
  ];
  const [visibleOnly, setVisibleOnly] = useState(false);
  const v = X98B.applySkillPrivacyControls(data);
  const rows = visibleOnly ? v.rows.filter(r => r.canView) : v.rows;
  return (
    <Card title="SkillGapPrivacyControls" note="Idea 53905">
      <Kv k="Restricted requests" v={v.restrictedCount} />
      <button type="button" onClick={() => setVisibleOnly(f => !f)}>{visibleOnly ? 'Show all requests' : 'Show visible only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} to ${r.requesterRole}`} v={r.canView ? 'visible' : 'restricted'} />)}
    </Card>
  );
}
export function SkillProgressMilestones() {
  const data = [
    { researcher: 'r-a', skill: 'api', startGap: 0.8, currentGap: 0.25, milestoneGap: 0.3 },
    { researcher: 'r-b', skill: 'web', startGap: 0.6, currentGap: 0.5, milestoneGap: 0.3 },
  ];
  const [currentPct, setCurrentPct] = useState(25);
  const v = X98B.trackSkillProgressMilestones([{ ...data[0], currentGap: currentPct / 100 }, data[1]]);
  return (
    <Card title="SkillProgressMilestones" note="Idea 53906">
      <Kv k="Milestones reached" v={v.milestoneCount} />
      <label className="w98b-field">Researcher r-a current gap ({currentPct}%)
        <input type="range" min="0" max="90" value={currentPct} onChange={e => setCurrentPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function CrossTrainingSuggestions() {
  const data = [
    { researcher: 'r-a', strengthSkill: 'web', strengthScore: 0.85, gapSkill: 'api', gapScore: 0.7, partner: 'r-b' },
    { researcher: 'r-b', strengthSkill: 'reporting', strengthScore: 0.4, gapSkill: 'recon', gapScore: 0.2, partner: 'r-a' },
  ];
  const [suggestedOnly, setSuggestedOnly] = useState(false);
  const v = X98B.suggestCrossTraining(data);
  const rows = suggestedOnly ? v.rows.filter(r => r.suggested) : v.rows;
  return (
    <Card title="CrossTrainingSuggestions" note="Idea 53907">
      <Kv k="Pairings suggested" v={v.suggestedCount} />
      <button type="button" onClick={() => setSuggestedOnly(f => !f)}>{suggestedOnly ? 'Show all researchers' : 'Show suggested only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} teaches, learns ${r.gapSkill}`} v={r.action} />)}
    </Card>
  );
}
export function SkillGapVsAssignmentFit() {
  const data = [
    { researcher: 'r-a', assignmentSkill: 'mobile', proficiency: 0.3, requiredProficiency: 0.8 },
    { researcher: 'r-b', assignmentSkill: 'web', proficiency: 0.85, requiredProficiency: 0.7 },
  ];
  const [misalignedOnly, setMisalignedOnly] = useState(false);
  const v = X98B.checkAssignmentFit(data);
  const rows = misalignedOnly ? v.rows.filter(r => r.misaligned) : v.rows;
  return (
    <Card title="SkillGapVsAssignmentFit" note="Idea 53908">
      <Kv k="Misaligned" v={v.misalignedCount} />
      <button type="button" onClick={() => setMisalignedOnly(f => !f)}>{misalignedOnly ? 'Show all assignments' : 'Show misaligned only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} on ${r.assignmentSkill}`} v={r.fit} />)}
    </Card>
  );
}
export function SkillDecayDetection() {
  const data = [
    { researcher: 'r-a', skill: 'mobile', lastUsedDays: 150, peakProficiency: 0.8, currentProficiency: 0.45 },
    { researcher: 'r-b', skill: 'web', lastUsedDays: 10, peakProficiency: 0.7, currentProficiency: 0.68 },
  ];
  const [idleDays, setIdleDays] = useState(150);
  const v = X98B.detectSkillDecay([{ ...data[0], lastUsedDays: idleDays }, data[1]]);
  return (
    <Card title="SkillDecayDetection" note="Idea 53909">
      <Kv k="Decayed" v={v.decayedCount} />
      <label className="w98b-field">Researcher r-a idle days ({idleDays})
        <input type="range" min="0" max="365" step="5" value={idleDays} onChange={e => setIdleDays(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function EmergingSkillIdentification() {
  const data = [
    { skill: 'graphql-testing', targetDemand: 0.8, teamCoverage: 0.2, demandGrowth: 0.6 },
    { skill: 'web-basics', targetDemand: 0.5, teamCoverage: 0.9, demandGrowth: 0.1 },
  ];
  const [emergingOnly, setEmergingOnly] = useState(false);
  const v = X98B.identifyEmergingSkills(data);
  const rows = emergingOnly ? v.rows.filter(r => r.emerging) : v.rows;
  return (
    <Card title="EmergingSkillIdentification" note="Idea 53910">
      <Kv k="Emerging gaps" v={v.emergingCount} />
      <button type="button" onClick={() => setEmergingOnly(f => !f)}>{emergingOnly ? 'Show all skills' : 'Show emerging only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.skill} v={r.status} />)}
    </Card>
  );
}
export function SkillGapBenchmarking() {
  const data = [
    { skill: 'cloud-hunting', teamScore: 0.4, industryScore: 0.75 },
    { skill: 'web', teamScore: 0.8, industryScore: 0.7 },
  ];
  const [behindOnly, setBehindOnly] = useState(false);
  const v = X98B.benchmarkSkillGaps(data);
  const rows = behindOnly ? v.rows.filter(r => r.behind) : v.rows;
  return (
    <Card title="SkillGapBenchmarking" note="Idea 53911">
      <Kv k="Behind industry" v={v.behindCount} />
      <button type="button" onClick={() => setBehindOnly(f => !f)}>{behindOnly ? 'Show all skills' : 'Show behind only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} standing`} v={r.standing} />)}
    </Card>
  );
}
export function PersonalizedLearningPaths() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapScore: 0.8, moduleId: 'api-lab' },
    { researcher: 'r-a', skill: 'mobile', gapScore: 0.5, moduleId: 'mobile-lab' },
    { researcher: 'r-b', skill: 'web', gapScore: 0.4, moduleId: 'web-lab' },
  ];
  const [firstStepOnly, setFirstStepOnly] = useState(false);
  const v = X98B.buildLearningPaths(data);
  const rows = firstStepOnly ? v.rows.filter(r => r.firstStep) : v.rows;
  return (
    <Card title="PersonalizedLearningPaths" note="Idea 53912">
      <Kv k="Total steps" v={v.totalSteps} />
      <button type="button" onClick={() => setFirstStepOnly(f => !f)}>{firstStepOnly ? 'Show all paths' : 'Show paths with a first step'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} first step`} v={r.firstStep ? r.firstStep.moduleId : 'none'} />)}
    </Card>
  );
}
export function SkillAssessmentCadence() {
  const data = [
    { researcher: 'r-a', skill: 'api', lastAssessedDays: 120, reassessDays: 90 },
    { researcher: 'r-b', skill: 'web', lastAssessedDays: 10, reassessDays: 90 },
  ];
  const [dueOnly, setDueOnly] = useState(false);
  const v = X98B.scheduleSkillAssessments(data);
  const rows = dueOnly ? v.rows.filter(r => r.due) : v.rows;
  return (
    <Card title="SkillAssessmentCadence" note="Idea 53913">
      <Kv k="Due now" v={v.dueCount} />
      <button type="button" onClick={() => setDueOnly(f => !f)}>{dueOnly ? 'Show all skills' : 'Show due only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function SkillEvidencePortfolios() {
  const data = [
    { researcher: 'r-a', skill: 'web', highlights: 6, verifiedHighlights: 5 },
    { researcher: 'r-b', skill: 'api', highlights: 2, verifiedHighlights: 1 },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X98B.buildEvidencePortfolios(data);
  const rows = readyOnly ? v.rows.filter(r => r.showcaseReady) : v.rows;
  return (
    <Card title="SkillEvidencePortfolios" note="Idea 53914">
      <Kv k="Showcase-ready" v={v.readyCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all portfolios' : 'Show ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function ManagerSkillDashboards() {
  const data = [
    { team: 'red', skill: 'api', averageGap: 0.65, researcherCount: 6, exposedIndividuals: 0 },
    { team: 'blue', skill: 'web', averageGap: 0.3, researcherCount: 2, exposedIndividuals: 0 },
  ];
  const [safeOnly, setSafeOnly] = useState(false);
  const v = X98B.buildManagerSkillDashboards(data);
  const rows = safeOnly ? v.rows.filter(r => r.privacySafe) : v.rows;
  return (
    <Card title="ManagerSkillDashboards" note="Idea 53915">
      <Kv k="Privacy-safe views" v={v.safeCount} />
      <button type="button" onClick={() => setSafeOnly(f => !f)}>{safeOnly ? 'Show all views' : 'Show safe only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.team} ${r.skill}`} v={r.aggregationLevel} />)}
    </Card>
  );
}
export function SkillGapClosureVerification() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapBefore: 0.8, gapAfter: 0.3, huntEvidence: 12 },
    { researcher: 'r-b', skill: 'web', gapBefore: 0.6, gapAfter: 0.45, huntEvidence: 2 },
  ];
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const v = X98B.verifySkillGapClosure(data);
  const rows = verifiedOnly ? v.rows.filter(r => r.verified) : v.rows;
  return (
    <Card title="SkillGapClosureVerification" note="Idea 53916">
      <Kv k="Verified closures" v={v.verifiedCount} />
      <button type="button" onClick={() => setVerifiedOnly(f => !f)}>{verifiedOnly ? 'Show all skills' : 'Show verified only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function TeamSkillDiversityMetrics() {
  const data = [
    { skill: 'recon', specialists: 5, totalResearchers: 10 },
    { skill: 'mobile', specialists: 1, totalResearchers: 10 },
  ];
  const [specialists, setSpecialists] = useState(5);
  const v = X98B.measureTeamSkillDiversity([{ ...data[0], specialists }, data[1]]);
  return (
    <Card title="TeamSkillDiversityMetrics" note="Idea 53917">
      <Kv k="Diversity index" v={v.diversityIndex} />
      <label className="w98b-field">Recon specialists ({specialists})
        <input type="range" min="0" max="10" value={specialists} onChange={e => setSpecialists(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.skill} value={r.diversityContribution} max={1} />)}
    </Card>
  );
}
export function SkillGapCostEstimates() {
  const data = [
    { skill: 'api', gapScore: 0.8, huntsAffected: 50, findingsPerHunt: 0.5, valuePerFinding: 300 },
    { skill: 'web', gapScore: 0.2, huntsAffected: 40, findingsPerHunt: 0.4, valuePerFinding: 300 },
  ];
  const [gapPct, setGapPct] = useState(80);
  const v = X98B.estimateSkillGapCosts([{ ...data[0], gapScore: gapPct / 100 }, data[1]]);
  return (
    <Card title="SkillGapCostEstimates" note="Idea 53918">
      <Kv k="Lost value" v={v.totalLostValue} />
      <label className="w98b-field">Api gap intensity ({gapPct}%)
        <input type="range" min="0" max="100" value={gapPct} onChange={e => setGapPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.skill} lost value`} v={r.lostValue} />)}
    </Card>
  );
}
export function LearningResourceRatings() {
  const data = [
    { resourceId: 'api-fuzzing-course', skill: 'api', ratings: 18, averageRating: 4.6, completions: 25 },
    { resourceId: 'dated-webinar', skill: 'web', ratings: 3, averageRating: 3.2, completions: 4 },
  ];
  const [rating, setRating] = useState(4.6);
  const v = X98B.rateLearningResources([{ ...data[0], averageRating: rating }, data[1]]);
  return (
    <Card title="LearningResourceRatings" note="Idea 53919">
      <Kv k="Recommended" v={v.recommendedCount} />
      <label className="w98b-field">Top course average rating ({rating})
        <input type="range" min="1" max="5" step="0.1" value={rating} onChange={e => setRating(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`#${r.rank} ${r.resourceId}`} v={r.recommendationScore} />)}
    </Card>
  );
}
export function SkillMentorshipCredit() {
  const data = [
    { mentor: 'mentor-x', mentee: 'r-a', skill: 'api', gapClosed: 0.5, sessions: 6 },
    { mentor: 'mentor-x', mentee: 'r-b', skill: 'web', gapClosed: 0.1, sessions: 2 },
    { mentor: 'mentor-y', mentee: 'r-c', skill: 'recon', gapClosed: 0.4, sessions: 4 },
  ];
  const [creditedOnly, setCreditedOnly] = useState(false);
  const v = X98B.creditSkillMentorship(data);
  const rows = creditedOnly ? v.rows.filter(r => r.credited) : v.rows;
  return (
    <Card title="SkillMentorshipCredit" note="Idea 53920">
      <Kv k="Top mentor" v={v.topMentor ? v.topMentor.mentor : 'none'} />
      <button type="button" onClick={() => setCreditedOnly(f => !f)}>{creditedOnly ? 'Show all pairings' : 'Show credited only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.mentor} with ${r.mentee}`} v={`${r.credit} · ${r.status}`} />)}
      <div className="w98b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE98_B_COMPONENTS = [SkillTaxonomyForHunters, SkillProficiencyInference, SkillGapHeatmaps, PeerRelativeSkillProfiles, SkillGapTrendTracking, TrainingRecommendationEngine, SkillGapTeamAggregation, NewHireSkillBaselines, SkillValidationChallenges, MentorMatchingByGap, SkillGapPrivacyControls, SkillProgressMilestones, CrossTrainingSuggestions, SkillGapVsAssignmentFit, SkillDecayDetection, EmergingSkillIdentification, SkillGapBenchmarking, PersonalizedLearningPaths, SkillAssessmentCadence, SkillEvidencePortfolios, ManagerSkillDashboards, SkillGapClosureVerification, TeamSkillDiversityMetrics, SkillGapCostEstimates, LearningResourceRatings, SkillMentorshipCredit];

export function Wave98BGallery() {
  return (
    <div className="w98b-gallery">
      {WAVE98_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
