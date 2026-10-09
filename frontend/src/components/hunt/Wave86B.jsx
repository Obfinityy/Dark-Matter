/**
 * Wave86B.jsx — Infinity AI · Wave 86
 * 20 working React components for benchmark operations, ideas 53421–53440. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave86BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w86b-card">
      <div className="w86b-title">{title}</div>
      {note ? <div className="w86b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w86b-badge w86b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w86b-kv">
      <span className="w86b-k">{k}</span>
      <span className="w86b-v">{String(v)}</span>
    </div>
  );
}

export function ResearcherBenchmarkAppeals() {
  const v = XB.handleResearcherBenchmarkAppeals([{ id: 'a1', researcher: 'researcher-a', originalScore: 64, reviewedScore: 71, status: 'adjusted' }]);
  return (<Card title="Researcher Benchmark Appeals" note="Idea 53421"><Kv k="Appeals" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkInclusionCriteria() {
  const v = XB.evaluateBenchmarkInclusionCriteria([{ name: 'researcher-a', hunts: 5, score: 72 }, { name: 'researcher-b', hunts: 1, score: 55 }]);
  return (<Card title="Benchmark Inclusion Criteria" note="Idea 53422"><Kv k="Included" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function NewcomerBenchmarkBootstrapping() {
  const v = XB.bootstrapNewcomerBenchmarks([{ name: 'newcomer-a', hunts: 1, score: 40 }]);
  return (<Card title="Newcomer Benchmark Bootstrapping" note="Idea 53423"><Kv k="Newcomers" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkDecayWeighting() {
  const v = XB.applyBenchmarkDecayWeighting([{ id: 'r1', researcher: 'researcher-a', score: 84, ageDays: 45 }]);
  return (<Card title="Benchmark Decay Weighting" note="Idea 53424"><Kv k="Records" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function TeamCompositionAnalytics() {
  const v = XB.analyzeTeamComposition([{ team: 'alpha', members: [{ role: 'web', score: 80 }, { role: 'api', score: 76 }, { role: 'review', score: 82 }] }]);
  return (<Card title="Team Composition Analytics" note="Idea 53425"><Kv k="Teams" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkApiForHr() {
  const v = XB.serveBenchmarkApiForHr([{ name: 'researcher-a', role: 'web', score: 86 }, { name: 'researcher-b', role: 'api', score: 71 }]);
  return (<Card title="Benchmark API for HR" note="Idea 53426"><Kv k="Served" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BurnoutSignalDetection() {
  const v = XB.detectBurnoutSignals([{ name: 'researcher-a', hoursPerWeek: 58, streakDays: 24, scoreDrop: 18 }, { name: 'researcher-b', hoursPerWeek: 38, streakDays: 5, scoreDrop: 2 }]);
  return (<Card title="Burnout-Signal Detection" note="Idea 53427"><Kv k="At risk" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkCelebrationMilestones() {
  const v = XB.planBenchmarkCelebrationMilestones([{ name: 'researcher-a', score: 82 }, { name: 'researcher-b', score: 44 }]);
  return (<Card title="Benchmark Celebration Milestones" note="Idea 53428"><Kv k="Celebrating" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PeerReviewBenchmarks() {
  const v = XB.buildPeerReviewBenchmarks([{ researcher: 'researcher-a', rating: 5 }, { researcher: 'researcher-a', rating: 4 }, { researcher: 'researcher-b', rating: 3 }]);
  return (<Card title="Peer Review Benchmarks" note="Idea 53429"><Kv k="Researchers" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkDataRetentionPolicy() {
  const v = XB.applyBenchmarkDataRetentionPolicy([{ id: 'r1', researcher: 'researcher-a', ageDays: 120, score: 77 }, { id: 'r2', researcher: 'researcher-b', ageDays: 480, score: 69 }]);
  return (<Card title="Benchmark Data Retention Policy" note="Idea 53430"><Kv k="Retained" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function LanguageAwareBenchmarking() {
  const v = XB.buildLanguageAwareBenchmarking([{ language: 'en', score: 82 }, { language: 'en', score: 74 }, { language: 'es', score: 79 }]);
  return (<Card title="Language-Aware Benchmarking" note="Idea 53431"><Kv k="Languages" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkSandboxMode() {
  const v = XB.enableBenchmarkSandboxMode([{ id: 'sb1', label: 'Trial entry', score: 66 }]);
  return (<Card title="Benchmark Sandbox Mode" note="Idea 53432"><Kv k="Entries" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function CrossPlatformBenchmarks() {
  const v = XB.buildCrossPlatformBenchmarks([{ platform: 'web', score: 83 }, { platform: 'api', score: 77 }, { platform: 'web', score: 79 }]);
  return (<Card title="Cross-Platform Benchmarks" note="Idea 53433"><Kv k="Platforms" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkExportForResumes() {
  const v = XB.exportBenchmarkForResumes({ name: 'researcher-a', skills: [{ area: 'web', score: 88, percentile: 92 }, { area: 'api', score: 64, percentile: 58 }] });
  return (<Card title="Benchmark Export for Resumes" note="Idea 53434"><Kv k="Highlights" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkDisputeResolution() {
  const v = XB.resolveBenchmarkDisputes([{ id: 'd1', researcher: 'researcher-a', originalScore: 60, finalScore: 68, status: 'resolved', evidence: ['hunt-log', 'review'] }]);
  return (<Card title="Benchmark Dispute Resolution" note="Idea 53435"><Kv k="Disputes" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function AccessibilityInBenchmarks() {
  const v = XB.auditBenchmarkAccessibility(['screen-reader', 'keyboard-only', 'contrast', 'captions', 'focus-order']);
  return (<Card title="Accessibility in Benchmarks" note="Idea 53436"><Kv k="Passed" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkDrivenHiringRubrics() {
  const v = XB.buildBenchmarkDrivenHiringRubrics([{ name: 'findings quality', weight: 50, minScore: 70 }, { name: 'coverage depth', weight: 30, minScore: 65 }]);
  return (<Card title="Benchmark-Driven Hiring Rubrics" note="Idea 53437"><Kv k="Criteria" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function TeamHealthBenchmarks() {
  const v = XB.measureTeamHealthBenchmarks([{ team: 'alpha', deliveryScore: 82, moraleScore: 78, qualityScore: 85 }, { team: 'beta', deliveryScore: 55, moraleScore: 60, qualityScore: 58 }]);
  return (<Card title="Team Health Benchmarks" note="Idea 53438"><Kv k="Teams" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenchmarkAnomalyExplanations() {
  const v = XB.explainBenchmarkAnomalies([{ id: 'r1', researcher: 'researcher-a', score: 95 }, { id: 'r2', researcher: 'researcher-b', score: 62 }, { id: 'r3', researcher: 'researcher-c', score: 58 }]);
  return (<Card title="Benchmark Anomaly Explanations" note="Idea 53439"><Kv k="Anomalies" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function RegionalBenchmarkChapters() {
  const v = XB.organizeRegionalBenchmarkChapters([{ region: 'Delhi', members: [{ name: 'a' }, { name: 'b' }], lead: 'researcher-a', avgScore: 76 }]);
  return (<Card title="Regional Benchmark Chapters" note="Idea 53440"><Kv k="Chapters" v={v.count ?? v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w86b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

const W86_B_GALLERY = [
  ResearcherBenchmarkAppeals,
  BenchmarkInclusionCriteria,
  NewcomerBenchmarkBootstrapping,
  BenchmarkDecayWeighting,
  TeamCompositionAnalytics,
  BenchmarkApiForHr,
  BurnoutSignalDetection,
  BenchmarkCelebrationMilestones,
  PeerReviewBenchmarks,
  BenchmarkDataRetentionPolicy,
  LanguageAwareBenchmarking,
  BenchmarkSandboxMode,
  CrossPlatformBenchmarks,
  BenchmarkExportForResumes,
  BenchmarkDisputeResolution,
  AccessibilityInBenchmarks,
  BenchmarkDrivenHiringRubrics,
  TeamHealthBenchmarks,
  BenchmarkAnomalyExplanations,
  RegionalBenchmarkChapters,
];

/** Gallery: renders every Wave 86B component, export-only. */
export function Wave86BGallery() {
  return (
    <div className="w86b-gallery">
      {W86_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
