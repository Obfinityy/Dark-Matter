/**
 * Wave86A.jsx — Infinity AI · Wave 86
 * 20 working React components for benchmark operations, ideas 53401–53420. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave86ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w86a-card">
      <div className="w86a-title">{title}</div>
      {note ? <div className="w86a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w86a-badge w86a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w86a-kv">
      <span className="w86a-k">{k}</span>
      <span className="w86a-v">{String(v)}</span>
    </div>
  );
}

export function BenchmarkSeasonWindows() {
  const v = XA.buildBenchmarkSeasonWindows([{ id: 's1', title: 'Spring season', startDay: 0, endDay: 90, score: 72 }]);
  return (<Card title="Benchmark Season Windows" note="Idea 53401"><Kv k="Seasons" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function TeamVsTeamBenchmarks() {
  const v = XA.buildTeamVsTeamBenchmarks([{ team: 'alpha', wins: 3, losses: 1, score: 84 }, { team: 'beta', wins: 1, losses: 2, score: 61 }]);
  return (<Card title="Team-vs-Team Benchmarks" note="Idea 53402"><Kv k="Teams" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkPrivacyControls() {
  const v = XA.applyBenchmarkPrivacyControls([{ researcher: 'researcher-a', visibility: 'private', score: 80 }, { researcher: 'researcher-b', visibility: 'public', score: 70 }]);
  return (<Card title="Benchmark Privacy Controls" note="Idea 53403"><Kv k="Records" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function ImprovementVelocityRankings() {
  const v = XA.rankImprovementVelocity([{ name: 'researcher-a', startScore: 50, endScore: 78 }, { name: 'researcher-b', startScore: 60, endScore: 66 }]);
  return (<Card title="Improvement Velocity Rankings" note="Idea 53404"><Kv k="Ranked" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkDataPortability() {
  const v = XA.exportBenchmarkDataPortability([{ id: 'r1', researcher: 'researcher-a', score: 82 }]);
  return (<Card title="Benchmark Data Portability" note="Idea 53405"><Kv k="Records" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BlindBenchmarkMode() {
  const v = XA.enableBlindBenchmarkMode([{ score: 88 }, { score: 64 }]);
  return (<Card title="Blind Benchmark Mode" note="Idea 53406"><Kv k="Entries" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function MentorBenchmarkViews() {
  const v = XA.buildMentorBenchmarkViews([{ name: 'mentee-a', score: 68, target: 75, mentor: 'mentor-a' }]);
  return (<Card title="Mentor Benchmark Views" note="Idea 53407"><Kv k="Mentees" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkCalibrationHunts() {
  const v = XA.runBenchmarkCalibrationHunts([{ id: 'h1', title: 'Calibration hunt', observedScore: 72, expectedScore: 70 }]);
  return (<Card title="Benchmark Calibration Hunts" note="Idea 53408"><Kv k="Hunts" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function AntiGamingSafeguards() {
  const v = XA.applyAntiGamingSafeguards([{ researcher: 'researcher-a', weeklyGain: 12, hunts: 4 }, { researcher: 'researcher-b', weeklyGain: 45, hunts: 1 }]);
  return (<Card title="Anti-Gaming Safeguards (learning)" note="Idea 53409"><Kv k="Flagged" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkConfidenceLabels() {
  const v = XA.labelBenchmarkConfidence([{ researcher: 'researcher-a', score: 81, samples: 12, variance: 8 }]);
  return (<Card title="Benchmark Confidence Labels" note="Idea 53410"><Kv k="High confidence" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function RoleBasedBenchmarks() {
  const v = XA.buildRoleBasedBenchmarks([{ role: 'web', score: 82 }, { role: 'web', score: 74 }, { role: 'api', score: 79 }]);
  return (<Card title="Role-Based Benchmarks" note="Idea 53411"><Kv k="Roles" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkOptOutAnytime() {
  const v = XA.processBenchmarkOptOut([{ researcher: 'researcher-a', status: 'included' }, { researcher: 'researcher-b', status: 'opted-out' }]);
  return (<Card title="Benchmark Opt-Out Anytime" note="Idea 53412"><Kv k="Included" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PeerLearningMatches() {
  const v = XA.matchPeerLearning([{ name: 'researcher-a', weakAreas: ['auth'], strengths: ['routes'] }, { name: 'researcher-b', weakAreas: ['routes'], strengths: ['auth'] }]);
  return (<Card title="Peer Learning Matches" note="Idea 53413"><Kv k="Matched" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkTrendAlerts() {
  const v = XA.detectBenchmarkTrendAlerts([{ id: 's1', title: 'Auth benchmark', points: [50, 62, 78] }]);
  return (<Card title="Benchmark Trend Alerts" note="Idea 53414"><Kv k="Alerts" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function OrganizationBenchmarkAggregates() {
  const v = XA.aggregateOrganizationBenchmarks([{ org: 'org-a', members: [{ score: 80 }, { score: 70 }] }]);
  return (<Card title="Organization Benchmark Aggregates" note="Idea 53415"><Kv k="Orgs" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkFairnessAudits() {
  const v = XA.auditBenchmarkFairness([{ group: 'cohort-a', score: 73, expected: 70 }, { group: 'cohort-b', score: 52, expected: 70 }]);
  return (<Card title="Benchmark Fairness Audits" note="Idea 53416"><Kv k="Fair" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function SpecializationBadges() {
  const v = XA.awardSpecializationBadges([{ name: 'researcher-a', area: 'web', score: 88 }, { name: 'researcher-b', area: 'api', score: 62 }]);
  return (<Card title="Specialization Badges (learning)" note="Idea 53417"><Kv k="Badges" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkDrivenTrainingPlans() {
  const v = XA.planBenchmarkDrivenTraining([{ name: 'researcher-a', score: 58, target: 85, weakAreas: ['auth'] }]);
  return (<Card title="Benchmark-Driven Training Plans" note="Idea 53418"><Kv k="Plans" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function CrossOrgBenchmarkExchange() {
  const v = XA.exchangeCrossOrgBenchmarks([{ id: 'ex1', fromOrg: 'org-a', toOrg: 'org-b', recordCount: 12, status: 'accepted' }]);
  return (<Card title="Cross-Org Benchmark Exchange" note="Idea 53419"><Kv k="Links" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkMethodologyTransparency() {
  const v = XA.explainBenchmarkMethodologyTransparency({ name: 'Infinity AI benchmark', factors: [{ name: 'findings', weight: 50 }, { name: 'coverage', weight: 30 }] });
  return (<Card title="Benchmark Methodology Transparency" note="Idea 53420"><Kv k="Factors" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

const W86_A_GALLERY = [
  BenchmarkSeasonWindows,
  TeamVsTeamBenchmarks,
  BenchmarkPrivacyControls,
  ImprovementVelocityRankings,
  BenchmarkDataPortability,
  BlindBenchmarkMode,
  MentorBenchmarkViews,
  BenchmarkCalibrationHunts,
  AntiGamingSafeguards,
  BenchmarkConfidenceLabels,
  RoleBasedBenchmarks,
  BenchmarkOptOutAnytime,
  PeerLearningMatches,
  BenchmarkTrendAlerts,
  OrganizationBenchmarkAggregates,
  BenchmarkFairnessAudits,
  SpecializationBadges,
  BenchmarkDrivenTrainingPlans,
  CrossOrgBenchmarkExchange,
  BenchmarkMethodologyTransparency,
];

/** Gallery: renders every Wave 86A component, export-only. */
export function Wave86AGallery() {
  return (
    <div className="w86a-gallery">
      {W86_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
