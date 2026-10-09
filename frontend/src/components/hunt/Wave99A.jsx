/**
 * Wave99A.jsx — Infinity AI · Wave 99
 * 29 working React components for skill gap operations, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X99A from './wave99ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w99a-card">
      <div className="w99a-title">{title}</div>
      {note ? <div className="w99a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w99a-badge w99a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w99a-kv">
      <span className="w99a-k">{k}</span>
      <span className="w99a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w99a-bar-row">
      <span className="w99a-k">{label}</span>
      <div className="w99a-bar"><div className="w99a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w99a-v">{value}</span>
    </div>
  );
}

export function SkillGapAlertThresholds() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapScore: 0.82, warnThreshold: 0.4, alertThreshold: 0.7 },
    { researcher: 'r-b', skill: 'web', gapScore: 0.25, warnThreshold: 0.4, alertThreshold: 0.7 },
  ];
  const [alertsOnly, setAlertsOnly] = useState(false);
  const v = X99A.setSkillGapAlertThresholds(data);
  const rows = alertsOnly ? v.rows.filter(r => r.alerting) : v.rows;
  return (
    <Card title="SkillGapAlertThresholds" note="Idea 53921">
      <Kv k="Alerting" v={v.alertCount} />
      <button type="button" onClick={() => setAlertsOnly(f => !f)}>{alertsOnly ? 'Show all skills' : 'Show alerts only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.level} />)}
    </Card>
  );
}
export function CareerPathSkillMapping() {
  const data = [
    { researcher: 'r-a', targetRole: 'senior-hunter', requiredSkills: ['recon', 'web', 'api', 'reporting'], heldSkills: ['recon', 'web', 'api', 'reporting'] },
    { researcher: 'r-b', targetRole: 'senior-hunter', requiredSkills: ['recon', 'web', 'api', 'reporting'], heldSkills: ['recon', 'web'] },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X99A.mapCareerPathSkills(data);
  const rows = readyOnly ? v.rows.filter(r => r.ready) : v.rows;
  return (
    <Card title="CareerPathSkillMapping" note="Idea 53922">
      <Kv k="Path-ready" v={v.readyCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all paths' : 'Show ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} readiness`} v={r.readiness} />)}
    </Card>
  );
}
export function SkillGapInterviewInsights() {
  const data = [
    { candidate: 'c-a', skill: 'api', interviewScore: 0.42, threshold: 0.6 },
    { candidate: 'c-b', skill: 'web', interviewScore: 0.78, threshold: 0.6 },
  ];
  const [floorPct, setFloorPct] = useState(60);
  const v = X99A.extractSkillGapInterviewInsights(data.map(d => ({ ...d, threshold: floorPct / 100 })));
  return (
    <Card title="SkillGapInterviewInsights" note="Idea 53923">
      <Kv k="Below bar" v={v.gapCount} />
      <label className="w99a-field">Hiring bar ({floorPct}%)
        <input type="range" min="30" max="90" value={floorPct} onChange={e => setFloorPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.candidate} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function JustInTimeMicrolearning() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapScore: 0.7, lessonMinutes: 6, maxMinutes: 10 },
    { researcher: 'r-b', skill: 'web', gapScore: 0.1, lessonMinutes: 5, maxMinutes: 10 },
  ];
  const [gapPct, setGapPct] = useState(70);
  const v = X99A.deliverJustInTimeMicrolearning([{ ...data[0], gapScore: gapPct / 100 }, data[1]]);
  return (
    <Card title="JustInTimeMicrolearning" note="Idea 53924">
      <Kv k="Served" v={v.servedCount} />
      <label className="w99a-field">First gap intensity ({gapPct}%)
        <input type="range" min="0" max="100" value={gapPct} onChange={e => setGapPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.action} />)}
    </Card>
  );
}
export function SkillPracticeSandboxes() {
  const data = [
    { researcher: 'r-a', skill: 'api', sandboxAttempts: 4, sandboxScore: 0.85, passMark: 0.7 },
    { researcher: 'r-b', skill: 'web', sandboxAttempts: 3, sandboxScore: 0.5, passMark: 0.7 },
  ];
  const [scorePct, setScorePct] = useState(85);
  const v = X99A.runSkillPracticeSandboxes([{ ...data[0], sandboxScore: scorePct / 100 }, data[1]]);
  return (
    <Card title="SkillPracticeSandboxes" note="Idea 53925">
      <Kv k="Hunt-ready" v={v.passedCount} />
      <label className="w99a-field">First sandbox score ({scorePct}%)
        <input type="range" min="0" max="100" value={scorePct} onChange={e => setScorePct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function SkillGapPeerStudyGroups() {
  const data = [
    { skill: 'api', members: ['r-a', 'r-b', 'r-c', 'r-d'], targetSize: 4 },
    { skill: 'mobile', members: ['r-e'], targetSize: 4 },
  ];
  const [formedOnly, setFormedOnly] = useState(false);
  const v = X99A.formSkillGapPeerStudyGroups(data);
  const rows = formedOnly ? v.rows.filter(r => r.formed) : v.rows;
  return (
    <Card title="SkillGapPeerStudyGroups" note="Idea 53926">
      <Kv k="Groups formed" v={v.formedCount} />
      <button type="button" onClick={() => setFormedOnly(f => !f)}>{formedOnly ? 'Show all skills' : 'Show formed only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} members`} v={r.memberCount} />)}
    </Card>
  );
}
export function CertificationAlignment() {
  const data = [
    { researcher: 'r-a', certification: 'web-hunting-cert', requiredLevel: 2, currentLevel: 2, expiresDays: 120 },
    { researcher: 'r-b', certification: 'api-cert', requiredLevel: 3, currentLevel: 1, expiresDays: 10 },
  ];
  const [alignedOnly, setAlignedOnly] = useState(false);
  const v = X99A.alignCertifications(data);
  const rows = alignedOnly ? v.rows.filter(r => r.aligned) : v.rows;
  return (
    <Card title="CertificationAlignment" note="Idea 53927">
      <Kv k="Aligned" v={v.alignedCount} />
      <button type="button" onClick={() => setAlignedOnly(f => !f)}>{alignedOnly ? 'Show all certs' : 'Show aligned only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.certification}`} v={r.status} />)}
    </Card>
  );
}
export function SkillGapDataMinimization() {
  const data = [
    { researcher: 'r-a', fieldsCollected: ['gap', 'score'], fieldsNeeded: ['gap', 'score'] },
    { researcher: 'r-b', fieldsCollected: ['gap', 'score', 'manager-notes', 'peer-rank'], fieldsNeeded: ['gap', 'score'] },
  ];
  const [leanOnly, setLeanOnly] = useState(false);
  const v = X99A.minimizeSkillGapData(data);
  const rows = leanOnly ? v.rows.filter(r => r.minimized) : v.rows;
  return (
    <Card title="SkillGapDataMinimization" note="Idea 53928">
      <Kv k="Minimized" v={v.minimizedCount} />
      <button type="button" onClick={() => setLeanOnly(f => !f)}>{leanOnly ? 'Show all profiles' : 'Show minimized only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} excess fields`} v={r.excessCount} />)}
    </Card>
  );
}
export function SkillProfilePortability() {
  const data = [
    { researcher: 'r-a', format: 'json', fieldsTotal: 12, fieldsExported: 12 },
    { researcher: 'r-b', format: 'pdf-image', fieldsTotal: 12, fieldsExported: 5 },
  ];
  const [exported, setExported] = useState(12);
  const v = X99A.exportSkillProfilePortability([{ ...data[0], fieldsExported: exported }, data[1]]);
  return (
    <Card title="SkillProfilePortability" note="Idea 53929">
      <Kv k="Portable" v={v.portableCount} />
      <label className="w99a-field">First export fields ({exported})
        <input type="range" min="0" max="12" value={exported} onChange={e => setExported(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.researcher} value={r.coverage} max={1} />)}
    </Card>
  );
}
export function SkillGapFeedbackLoops() {
  const data = [
    { researcher: 'r-a', skill: 'api', feedbackItems: 5, actedItems: 5, daysToClose: 9 },
    { researcher: 'r-b', skill: 'web', feedbackItems: 4, actedItems: 1, daysToClose: 30 },
  ];
  const [closedOnly, setClosedOnly] = useState(false);
  const v = X99A.runSkillGapFeedbackLoops(data);
  const rows = closedOnly ? v.rows.filter(r => r.closed) : v.rows;
  return (
    <Card title="SkillGapFeedbackLoops" note="Idea 53930">
      <Kv k="Loops closed" v={v.closedCount} />
      <button type="button" onClick={() => setClosedOnly(f => !f)}>{closedOnly ? 'Show all loops' : 'Show closed only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function TeamLeadSkillCoachingGuides() {
  const data = [
    { lead: 'lead-a', skill: 'api', guideSections: 4, requiredSections: 4, researcherCount: 6 },
    { lead: 'lead-b', skill: 'web', guideSections: 2, requiredSections: 4, researcherCount: 3 },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X99A.buildTeamLeadCoachingGuides(data);
  const rows = readyOnly ? v.rows.filter(r => r.ready) : v.rows;
  return (
    <Card title="TeamLeadSkillCoachingGuides" note="Idea 53931">
      <Kv k="Guides ready" v={v.readyCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all guides' : 'Show ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.lead} ${r.skill}`} v={`${r.completeness} complete`} />)}
    </Card>
  );
}
export function SkillGapResolutionPlaybooks() {
  const data = [
    { skill: 'api', playbookSteps: 5, completedSteps: 5, successRate: 0.8 },
    { skill: 'web', playbookSteps: 5, completedSteps: 2, successRate: 0.4 },
  ];
  const [successPct, setSuccessPct] = useState(80);
  const v = X99A.buildSkillGapResolutionPlaybooks([{ ...data[0], successRate: successPct / 100 }, data[1]]);
  return (
    <Card title="SkillGapResolutionPlaybooks" note="Idea 53932">
      <Kv k="Proven playbooks" v={v.provenCount} />
      <label className="w99a-field">First playbook success ({successPct}%)
        <input type="range" min="0" max="100" value={successPct} onChange={e => setSuccessPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.skill} status`} v={r.status} />)}
    </Card>
  );
}
export function SkillAssessmentFairnessAudits() {
  const data = [
    { skill: 'api', groupAScore: 0.7, groupBScore: 0.68, tolerance: 0.1 },
    { skill: 'reporting', groupAScore: 0.75, groupBScore: 0.4, tolerance: 0.1 },
  ];
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const v = X99A.auditSkillAssessmentFairness(data);
  const rows = flaggedOnly ? v.rows.filter(r => !r.fair) : v.rows;
  return (
    <Card title="SkillAssessmentFairnessAudits" note="Idea 53933">
      <Kv k="Fair" v={v.fairCount} />
      <button type="button" onClick={() => setFlaggedOnly(f => !f)}>{flaggedOnly ? 'Show all skills' : 'Show flagged only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} disparity`} v={r.disparity} />)}
    </Card>
  );
}
export function SkillGrowthStorytelling() {
  const data = [
    { researcher: 'r-a', skill: 'api', milestones: ['first-pass', 'sandbox-pass', 'mentor-review', 'live-hunt-win'], valueDelivered: 4200 },
    { researcher: 'r-b', skill: 'web', milestones: ['first-pass'], valueDelivered: 300 },
  ];
  const [storiesOnly, setStoriesOnly] = useState(false);
  const v = X99A.buildSkillGrowthStories(data);
  const rows = storiesOnly ? v.rows.filter(r => r.storyReady) : v.rows;
  return (
    <Card title="SkillGrowthStorytelling" note="Idea 53934">
      <Kv k="Full stories" v={v.readyCount} />
      <button type="button" onClick={() => setStoriesOnly(f => !f)}>{storiesOnly ? 'Show all journeys' : 'Show full stories only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.arc} />)}
    </Card>
  );
}
export function SkillGapEarlyWarnings() {
  const data = [
    { researcher: 'r-a', skill: 'api', gapVelocity: 0.3, gapScore: 0.6, warnVelocity: 0.15 },
    { researcher: 'r-b', skill: 'web', gapVelocity: -0.1, gapScore: 0.4, warnVelocity: 0.15 },
  ];
  const [velocityPct, setVelocityPct] = useState(30);
  const v = X99A.detectSkillGapEarlyWarnings([{ ...data[0], gapVelocity: velocityPct / 100 }, data[1]]);
  return (
    <Card title="SkillGapEarlyWarnings" note="Idea 53935">
      <Kv k="Warnings" v={v.warningCount} />
      <label className="w99a-field">First gap velocity ({velocityPct}%)
        <input type="range" min="-20" max="60" value={velocityPct} onChange={e => setVelocityPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function CrossFunctionalSkillSharing() {
  const data = [
    { skill: 'api', homeTeam: 'red', sharedTeams: ['blue', 'green'], sessionsHeld: 3 },
    { skill: 'niche-recon', homeTeam: 'red', sharedTeams: [], sessionsHeld: 0 },
  ];
  const [sharedOnly, setSharedOnly] = useState(false);
  const v = X99A.shareCrossFunctionalSkills(data);
  const rows = sharedOnly ? v.rows.filter(r => r.shared) : v.rows;
  return (
    <Card title="CrossFunctionalSkillSharing" note="Idea 53936">
      <Kv k="Shared" v={v.sharedCount} />
      <button type="button" onClick={() => setSharedOnly(f => !f)}>{sharedOnly ? 'Show all skills' : 'Show shared only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} reach`} v={r.reach} />)}
    </Card>
  );
}
export function SkillGapGamification() {
  const data = [
    { researcher: 'r-a', skill: 'api', pointsEarned: 120, pointsToNextLevel: 30, challengesDone: 5 },
    { researcher: 'r-b', skill: 'web', pointsEarned: 10, pointsToNextLevel: 90, challengesDone: 0 },
  ];
  const [points, setPoints] = useState(120);
  const v = X99A.applySkillGapGamification([{ ...data[0], pointsEarned: points }, data[1]]);
  return (
    <Card title="SkillGapGamification" note="Idea 53937">
      <Kv k="Engaged" v={v.engagedCount} />
      <label className="w99a-field">First researcher points ({points})
        <input type="range" min="0" max="300" step="10" value={points} onChange={e => setPoints(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={`${r.researcher} ${r.skill}`} value={r.levelProgress} max={1} />)}
    </Card>
  );
}
export function SkillBenchmarkCalibration() {
  const data = [
    { skill: 'api', internalBenchmark: 0.72, externalBenchmark: 0.7, sampleSize: 120 },
    { skill: 'mobile', internalBenchmark: 0.9, externalBenchmark: 0.55, sampleSize: 80 },
  ];
  const [internalPct, setInternalPct] = useState(72);
  const v = X99A.calibrateSkillBenchmarks([{ ...data[0], internalBenchmark: internalPct / 100 }, data[1]]);
  return (
    <Card title="SkillBenchmarkCalibration" note="Idea 53938">
      <Kv k="Calibrated" v={v.calibratedCount} />
      <label className="w99a-field">First internal benchmark ({internalPct}%)
        <input type="range" min="30" max="100" value={internalPct} onChange={e => setInternalPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.skill} drift`} v={r.drift} />)}
    </Card>
  );
}
export function SkillGapRetrospectiveIntegration() {
  const data = [
    { huntId: 'hunt-1', skill: 'api', gapNoted: true, retroLogged: true, actionAssigned: true },
    { huntId: 'hunt-2', skill: 'web', gapNoted: true, retroLogged: false, actionAssigned: false },
  ];
  const [integratedOnly, setIntegratedOnly] = useState(false);
  const v = X99A.integrateSkillGapRetrospectives(data);
  const rows = integratedOnly ? v.rows.filter(r => r.integrated) : v.rows;
  return (
    <Card title="SkillGapRetrospectiveIntegration" note="Idea 53939">
      <Kv k="Integrated" v={v.integratedCount} />
      <button type="button" onClick={() => setIntegratedOnly(f => !f)}>{integratedOnly ? 'Show all hunts' : 'Show integrated only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function LearningTimeAllocation() {
  const data = [
    { researcher: 'r-a', skill: 'api', weeklyHours: 10, allocatedHours: 4, gapScore: 0.8 },
    { researcher: 'r-b', skill: 'web', weeklyHours: 10, allocatedHours: 1, gapScore: 0.7 },
  ];
  const [allocated, setAllocated] = useState(4);
  const v = X99A.allocateLearningTime([{ ...data[0], allocatedHours: allocated }, data[1]]);
  return (
    <Card title="LearningTimeAllocation" note="Idea 53940">
      <Kv k="Time-protected" v={v.protectedCount} />
      <label className="w99a-field">First allocated hours ({allocated})
        <input type="range" min="0" max="10" value={allocated} onChange={e => setAllocated(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function SkillGapSuccessionPlanning() {
  const data = [
    { skill: 'api', primaryHolder: 'r-a', backupHolders: ['r-b', 'r-c'], criticality: 0.9 },
    { skill: 'mobile', primaryHolder: 'r-d', backupHolders: [], criticality: 0.85 },
  ];
  const [riskOnly, setRiskOnly] = useState(false);
  const v = X99A.planSkillGapSuccession(data);
  const rows = riskOnly ? v.rows.filter(r => !r.safe) : v.rows;
  return (
    <Card title="SkillGapSuccessionPlanning" note="Idea 53941">
      <Kv k="At risk" v={v.atRiskCount} />
      <button type="button" onClick={() => setRiskOnly(f => !f)}>{riskOnly ? 'Show all skills' : 'Show at-risk only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} backups`} v={r.backupCount} />)}
    </Card>
  );
}
export function SkillCommunityContributions() {
  const data = [
    { researcher: 'r-a', skill: 'api', contributions: 8, reviews: 5, helpfulVotes: 40 },
    { researcher: 'r-b', skill: 'web', contributions: 0, reviews: 0, helpfulVotes: 0 },
  ];
  const [contributions, setContributions] = useState(8);
  const v = X99A.trackSkillCommunityContributions([{ ...data[0], contributions }, data[1]]);
  return (
    <Card title="SkillCommunityContributions" note="Idea 53942">
      <Kv k="Active sharers" v={v.activeCount} />
      <label className="w99a-field">First researcher contributions ({contributions})
        <input type="range" min="0" max="20" value={contributions} onChange={e => setContributions(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function SkillGapReviewCadence() {
  const data = [
    { skill: 'api', lastReviewedDays: 45, reviewDays: 30, openGaps: 5 },
    { skill: 'web', lastReviewedDays: 10, reviewDays: 30, openGaps: 1 },
  ];
  const [dueOnly, setDueOnly] = useState(false);
  const v = X99A.scheduleSkillGapReviewCadence(data);
  const rows = dueOnly ? v.rows.filter(r => r.due) : v.rows;
  return (
    <Card title="SkillGapReviewCadence" note="Idea 53943">
      <Kv k="Due" v={v.dueCount} />
      <button type="button" onClick={() => setDueOnly(f => !f)}>{dueOnly ? 'Show all skills' : 'Show due only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} status`} v={r.status} />)}
    </Card>
  );
}
export function SkillDevelopmentROI() {
  const data = [
    { skill: 'api', trainingCost: 2000, findingsGain: 12, valuePerFinding: 300 },
    { skill: 'web', trainingCost: 3000, findingsGain: 2, valuePerFinding: 300 },
  ];
  const [gain, setGain] = useState(12);
  const v = X99A.calculateSkillDevelopmentROI([{ ...data[0], findingsGain: gain }, data[1]]);
  return (
    <Card title="SkillDevelopmentROI" note="Idea 53944">
      <Kv k="Paying off" v={v.positiveCount} />
      <label className="w99a-field">First skill findings gained ({gain})
        <input type="range" min="0" max="30" value={gain} onChange={e => setGain(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.skill} ROI`} v={r.roi} />)}
    </Card>
  );
}
export function SkillGapTransparencyReports() {
  const data = [
    { team: 'red', skill: 'api', gapScore: 0.7, published: true, audience: ['team', 'leads', 'managers'] },
    { team: 'blue', skill: 'web', gapScore: 0.4, published: false, audience: [] },
  ];
  const [transparentOnly, setTransparentOnly] = useState(false);
  const v = X99A.publishSkillGapTransparencyReports(data);
  const rows = transparentOnly ? v.rows.filter(r => r.transparent) : v.rows;
  return (
    <Card title="SkillGapTransparencyReports" note="Idea 53945">
      <Kv k="Transparent" v={v.transparentCount} />
      <button type="button" onClick={() => setTransparentOnly(f => !f)}>{transparentOnly ? 'Show all reports' : 'Show transparent only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.team} ${r.skill}`} v={r.status} />)}
    </Card>
  );
}
export function SkillAssessmentAccessibility() {
  const data = [
    { assessmentId: 'assess-api', accommodationsOffered: ['extra-time', 'screen-reader'], accommodationsNeeded: ['extra-time', 'screen-reader'], screenReaderSafe: true },
    { assessmentId: 'assess-web', accommodationsOffered: ['extra-time'], accommodationsNeeded: ['extra-time', 'captions'], screenReaderSafe: false },
  ];
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const v = X99A.auditSkillAssessmentAccessibility(data);
  const rows = accessibleOnly ? v.rows.filter(r => r.accessible) : v.rows;
  return (
    <Card title="SkillAssessmentAccessibility" note="Idea 53946">
      <Kv k="Accessible" v={v.accessibleCount} />
      <button type="button" onClick={() => setAccessibleOnly(f => !f)}>{accessibleOnly ? 'Show all assessments' : 'Show accessible only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.assessmentId} status`} v={r.status} />)}
    </Card>
  );
}
export function SkillGapDataRetention() {
  const data = [
    { researcher: 'r-a', dataType: 'gap-history', ageDays: 400, retentionDays: 365 },
    { researcher: 'r-b', dataType: 'gap-history', ageDays: 40, retentionDays: 365 },
  ];
  const [age, setAge] = useState(400);
  const v = X99A.planSkillGapDataRetention([{ ...data[0], ageDays: age }, data[1]]);
  return (
    <Card title="SkillGapDataRetention" note="Idea 53947">
      <Kv k="Due for archival" v={v.expiredCount} />
      <label className="w99a-field">First dataset age in days ({age})
        <input type="range" min="0" max="800" step="10" value={age} onChange={e => setAge(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} action`} v={r.action} />)}
    </Card>
  );
}
export function SkillBasedHuntStaffing() {
  const data = [
    { huntId: 'hunt-1', requiredSkill: 'api', researcher: 'r-a', proficiency: 0.85, requiredProficiency: 0.7 },
    { huntId: 'hunt-2', requiredSkill: 'mobile', researcher: 'r-b', proficiency: 0.3, requiredProficiency: 0.75 },
  ];
  const [staffedOnly, setStaffedOnly] = useState(false);
  const v = X99A.staffSkillBasedHunts(data);
  const rows = staffedOnly ? v.rows.filter(r => r.fit) : v.rows;
  return (
    <Card title="SkillBasedHuntStaffing" note="Idea 53948">
      <Kv k="Staffed" v={v.staffedCount} />
      <button type="button" onClick={() => setStaffedOnly(f => !f)}>{staffedOnly ? 'Show all hunts' : 'Show staffed only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} ${r.researcher}`} v={r.status} />)}
    </Card>
  );
}
export function FutureSkillForecasting() {
  const data = [
    { skill: 'ai-assisted-hunting', demandGrowth: 0.8, currentCoverage: 0.2, horizonMonths: 12 },
    { skill: 'web-basics', demandGrowth: 0.1, currentCoverage: 0.9, horizonMonths: 12 },
  ];
  const [trainOnly, setTrainOnly] = useState(false);
  const v = X99A.forecastFutureSkills(data);
  const rows = trainOnly ? v.rows.filter(r => r.willGap) : v.rows;
  return (
    <Card title="FutureSkillForecasting" note="Idea 53949">
      <Kv k="Train now" v={v.trainNowCount} />
      <button type="button" onClick={() => setTrainOnly(f => !f)}>{trainOnly ? 'Show all forecasts' : 'Show train-now only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.skill} status`} v={r.status} />)}
      <div className="w99a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE99_A_COMPONENTS = [SkillGapAlertThresholds, CareerPathSkillMapping, SkillGapInterviewInsights, JustInTimeMicrolearning, SkillPracticeSandboxes, SkillGapPeerStudyGroups, CertificationAlignment, SkillGapDataMinimization, SkillProfilePortability, SkillGapFeedbackLoops, TeamLeadSkillCoachingGuides, SkillGapResolutionPlaybooks, SkillAssessmentFairnessAudits, SkillGrowthStorytelling, SkillGapEarlyWarnings, CrossFunctionalSkillSharing, SkillGapGamification, SkillBenchmarkCalibration, SkillGapRetrospectiveIntegration, LearningTimeAllocation, SkillGapSuccessionPlanning, SkillCommunityContributions, SkillGapReviewCadence, SkillDevelopmentROI, SkillGapTransparencyReports, SkillAssessmentAccessibility, SkillGapDataRetention, SkillBasedHuntStaffing, FutureSkillForecasting];

export function Wave99AGallery() {
  return (
    <div className="w99a-gallery">
      {WAVE99_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
