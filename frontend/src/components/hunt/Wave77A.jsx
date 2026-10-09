/**
 * Wave77A.jsx — Infinity AI · Dark-Matter · Wave 77
 * 20 working React components for hunt-learning analytics round 2, ideas 53041–53060. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave77ACore.js';

const SAMPLE_HUNT = { huntId: 'hunt-77', id: 'hunt-77', targetClass: 'web app', findings: 10, verified: 5, requests: 100, detectionRisk: 20 };
const SAMPLE_PHASES = [
  { phase: 'recon', probed: 100, anomalies: 20, validated: 5 },
  { phase: 'exploit', probed: 50, anomalies: 10, validated: 5 },
];
const SAMPLE_FINDINGS = [
  { id: 'f1', findingId: 'f1', title: 'SQL injection in login', signature: 'sqli-login', at: '2026-10-09T00:00:00Z', foundAt: '2026-10-09T00:00:00Z', confirmRequests: 30, request: 'REQ', response: 'RES', impact: 'account takeover', reproSteps: 'steps', steps: 'steps' },
  { id: 'f2', findingId: 'f2', title: 'Reflected XSS in search', signature: 'xss-search', at: '2026-10-09T00:10:00Z', foundAt: '2026-10-09T00:10:00Z', confirmRequests: 10, request: 'REQ' },
  { id: 'f3', findingId: 'f3', title: 'IDOR on invoice', signature: 'idor-invoice', at: '2026-10-09T00:40:00Z', foundAt: '2026-10-09T00:40:00Z', confirmRequests: 5, request: 'REQ', response: 'RES', impact: 'data exposure' },
  { id: 'f4', findingId: 'f4', title: 'Open redirect', signature: 'redirect-ext', at: '2026-10-09T00:45:00Z', foundAt: '2026-10-09T00:45:00Z', confirmRequests: 4 },
];
const SAMPLE_HISTORY = [{ signature: 'sqli-login', huntId: 'hunt-70', target: 'shop.example.com' }];
const SAMPLE_HYPOTHESES = [
  { id: 'h1', hypothesisId: 'h1', text: 'Login is injectable', confirmed: true, tests: 60 },
  { id: 'h2', hypothesisId: 'h2', text: 'Search reflects input', confirmed: true, tests: 40 },
  { id: 'h3', hypothesisId: 'h3', text: 'Admin panel exposed', refuted: true, tests: 5 },
  { id: 'h4', hypothesisId: 'h4', text: 'API leaks keys', tests: 0 },
];
const SAMPLE_AREAS = [
  { id: 'a1', areaId: 'a1', name: 'Admin', coveragePct: 10, expertLikelihood: 9 },
  { id: 'a2', areaId: 'a2', name: 'Home', coveragePct: 90, expertLikelihood: 1 },
  { id: 'a3', areaId: 'a3', name: 'API', coveragePct: 20, expertLikelihood: 7 },
];
const SAMPLE_TECHNIQUES = [
  { id: 't1', techniqueId: 't1', name: 'Union probe ladder', family: 'injection', novel: true, findings: 3, minutes: 30, uses: 3 },
  { id: 't2', techniqueId: 't2', name: 'DOM sink trace', family: 'client', adapted: true, findings: 2, minutes: 20, uses: 1 },
  { id: 't3', techniqueId: 't3', name: 'Header sweep', family: 'recon', findings: 1, minutes: 10, uses: 2 },
  { id: 't4', techniqueId: 't4', name: 'Param fuzzer', family: 'injection', findings: 0, minutes: 5, uses: 1 },
];
const SAMPLE_EVENTS = [
  { at: '2026-10-09T00:01:00Z', area: 'web' },
  { at: '2026-10-09T00:02:00Z', area: 'web', type: 'finding' },
  { at: '2026-10-09T00:03:00Z', area: 'api' },
  { at: '2026-10-09T00:04:00Z', area: 'web' },
];
const SAMPLE_HUNTS = [
  { huntId: 'hunt-77a', id: 'hunt-77a', targetClass: 'web app', findings: 2, requests: 100, computeMinutes: 60 },
  { huntId: 'hunt-77b', id: 'hunt-77b', targetClass: 'api', findings: 5, requests: 100, computeMinutes: 50 },
];
const SAMPLE_INTEL = [
  { id: 'i1', intelId: 'i1', kind: 'architecture doc', paidOff: true },
  { id: 'i2', intelId: 'i2', kind: 'note' },
  { id: 'i3', intelId: 'i3', kind: 'diagram' },
];
const SAMPLE_PLAN = [{ intelIds: ['i1', 'i3'] }, { intelId: 'i2' }];
const SAMPLE_ADJUSTMENTS = [
  { at: '2026-10-09T00:01:00Z', detector: 'sqli', from: 0.5, to: 0.7, precisionBefore: 0.6, precisionAfter: 0.8 },
  { at: '2026-10-09T00:00:00Z', detector: 'xss', from: 0.4, to: 0.3, precisionBefore: 0.7, precisionAfter: 0.65 },
];
const SAMPLE_DEAD_ENDS = [
  { id: 'd1', lineId: 'd1', name: 'Legacy SOAP surface', minutesSpent: 30 },
  { id: 'd2', lineId: 'd2', name: 'Static marketing pages', minutesSpent: 10 },
];
const SAMPLE_SIGNALS = [{ contradicts: true }, { contradicts: true, addressed: true }, { contradicts: false }];
const SAMPLE_KNOWN = [{ signature: 'redirect-ext' }, { signature: 'old-issue' }];

function Card({ title, note, children }) {
  return (
    <div className="w77a-card">
      <div className="w77a-title">{title}</div>
      {note ? <div className="w77a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w77a-badge w77a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w77a-kv">
      <span className="w77a-k">{k}</span>
      <span className="w77a-v">{String(v)}</span>
    </div>
  );
}

export function BaselineDeviationAlert() {
  const v = XA.alertBaselineDeviation(SAMPLE_HUNT, { findings: 5, verified: 5, requests: 200, targetClass: 'web app' }, { thresholdPct: 50 });
  return (
    <Card title="Baseline Deviation Alert" note="Idea 53041">
      <Kv k="Flagged" v={v.flaggedCount} />
      <Kv k="Worst metric" v={v.worst ? v.worst.metric : 'none'} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function DiscoveryFunnelVisualization() {
  const v = XA.buildDiscoveryFunnel(SAMPLE_PHASES);
  return (
    <Card title="Discovery Funnel Visualization" note="Idea 53042">
      <Kv k="Probed" v={v.totals.probed} />
      <Kv k="Validated" v={v.totals.validated} />
      <Kv k="Overall rate" v={v.overallValidationRate} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function InterFindingLagAnalysis() {
  const v = XA.analyzeInterFindingLag(SAMPLE_FINDINGS, { stuckMinutes: 20 });
  return (
    <Card title="Inter-Finding Lag Analysis" note="Idea 53043">
      <Kv k="Max gap min" v={v.maxGapMinutes} />
      <Kv k="Stuck windows" v={v.stuckCount} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function HypothesisHitRate() {
  const v = XA.scoreHypothesisHitRate(SAMPLE_HYPOTHESES);
  return (
    <Card title="Hypothesis Hit Rate" note="Idea 53044">
      <Kv k="Hit rate" v={v.hitRate} />
      <Kv k="Confirmed" v={v.confirmedCount} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function ConfirmationCostTracking() {
  const v = XA.trackConfirmationCost(SAMPLE_FINDINGS, { expensiveRequests: 25 });
  return (
    <Card title="Confirmation Cost Tracking" note="Idea 53045">
      <Kv k="Total requests" v={v.totalRequests} />
      <Kv k="Expensive" v={v.expensiveCount} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function CrossTargetPatternMatch() {
  const v = XA.matchCrossTargetPatterns(SAMPLE_FINDINGS, SAMPLE_HISTORY);
  return (
    <Card title="Cross-Target Pattern Match" note="Idea 53046">
      <Kv k="Matched" v={v.matchedCount} />
      <Kv k="Match rate" v={v.matchRate} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function ReportReadinessScore() {
  const v = XA.scoreReportReadiness(SAMPLE_FINDINGS);
  return (
    <Card title="Report-Readiness Score" note="Idea 53047">
      <Kv k="Ready" v={v.readyCount} />
      <Kv k="Avg score" v={v.avgScore} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function MissedObviousAudit() {
  const v = XA.auditMissedObvious(SAMPLE_AREAS, { maxCoveragePct: 25 });
  return (
    <Card title="Missed-Obvious Audit" note="Idea 53048">
      <Kv k="Flagged areas" v={v.count} />
      <Kv k="Top miss" v={v.topMiss ? v.topMiss.name : 'none'} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function TechniqueNoveltyBonus() {
  const v = XA.scoreTechniqueNovelty(SAMPLE_TECHNIQUES);
  return (
    <Card title="Technique Novelty Bonus" note="Idea 53049">
      <Kv k="Novel" v={v.novelCount} />
      <Kv k="Total bonus" v={v.totalBonus} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function ContextSwitchCost() {
  const v = XA.measureContextSwitchCost(SAMPLE_EVENTS);
  return (
    <Card title="Context-Switch Cost" note="Idea 53050">
      <Kv k="Blocks" v={v.blockCount} />
      <Kv k="Switches" v={v.switchCount} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function EvidenceChainCompleteness() {
  const v = XA.checkEvidenceChainCompleteness(SAMPLE_FINDINGS);
  return (
    <Card title="Evidence Chain Completeness" note="Idea 53051">
      <Kv k="Complete" v={v.completeCount} />
      <Kv k="Rate" v={v.completenessRate} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function StealthEfficiencyRating() {
  const v = XA.rateStealthEfficiency({ huntId: 'hunt-77', detectionRisk: 20 }, SAMPLE_FINDINGS);
  return (
    <Card title="Stealth Efficiency Rating" note="Idea 53052">
      <Kv k="Findings" v={v.findingCount} />
      <Kv k="Verdict" v={v.verdict} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function ResourceBurnRate() {
  const v = XA.computeResourceBurnRate(SAMPLE_HUNTS);
  return (
    <Card title="Resource Burn Rate" note="Idea 53053">
      <Kv k="Hunts" v={v.count} />
      <Kv k="Most efficient" v={v.mostEfficient ? v.mostEfficient.huntId : 'none'} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function PreHuntIntelUtilization() {
  const v = XA.measureIntelUtilization(SAMPLE_INTEL, SAMPLE_PLAN);
  return (
    <Card title="Pre-Hunt Intel Utilization" note="Idea 53054">
      <Kv k="Used" v={v.usedCount} />
      <Kv k="Rate" v={v.utilizationRate} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function AdaptiveThresholdTuningLog() {
  const v = XA.logAdaptiveThresholdTuning(SAMPLE_ADJUSTMENTS);
  return (
    <Card title="Adaptive Threshold Tuning Log" note="Idea 53055">
      <Kv k="Adjustments" v={v.count} />
      <Kv k="Improved" v={v.improvedCount} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function DeadEndRecoveryTime() {
  const v = XA.measureDeadEndRecoveryTime(SAMPLE_DEAD_ENDS);
  return (
    <Card title="Dead-End Recovery Time" note="Idea 53056">
      <Kv k="Dead ends" v={v.count} />
      <Kv k="Avg minutes" v={v.avgMinutes} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function ConfirmationBiasCheck() {
  const v = XA.checkConfirmationBias(SAMPLE_HYPOTHESES, SAMPLE_SIGNALS);
  return (
    <Card title="Confirmation Bias Check" note="Idea 53057">
      <Kv k="Top share %" v={v.topSharePct} />
      <Kv k="Ignored signals" v={v.ignoredCount} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function FindingFreshnessScore() {
  const v = XA.scoreFindingFreshness(SAMPLE_FINDINGS, SAMPLE_KNOWN);
  return (
    <Card title="Finding Freshness Score" note="Idea 53058">
      <Kv k="Fresh" v={v.freshCount} />
      <Kv k="Rate" v={v.freshnessRate} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function HuntSignatureFingerprint() {
  const v = XA.fingerprintHuntSignature(SAMPLE_HUNT, SAMPLE_TECHNIQUES);
  return (
    <Card title="Hunt Signature Fingerprint" note="Idea 53059">
      <Kv k="Fingerprint" v={v.fingerprint} />
      <Kv k="Families" v={v.vector.length} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function WhatWorkedDigestEmail() {
  const v = XA.composeWhatWorkedDigest(SAMPLE_HUNT, SAMPLE_TECHNIQUES);
  return (
    <Card title="What-Worked Digest Email" note="Idea 53060">
      <Kv k="Lines" v={v.lineCount} />
      <Kv k="Subject" v={v.subject} />
      <div className="w77a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

const W77_A_GALLERY = [
  BaselineDeviationAlert,
  DiscoveryFunnelVisualization,
  InterFindingLagAnalysis,
  HypothesisHitRate,
  ConfirmationCostTracking,
  CrossTargetPatternMatch,
  ReportReadinessScore,
  MissedObviousAudit,
  TechniqueNoveltyBonus,
  ContextSwitchCost,
  EvidenceChainCompleteness,
  StealthEfficiencyRating,
  ResourceBurnRate,
  PreHuntIntelUtilization,
  AdaptiveThresholdTuningLog,
  DeadEndRecoveryTime,
  ConfirmationBiasCheck,
  FindingFreshnessScore,
  HuntSignatureFingerprint,
  WhatWorkedDigestEmail,
];

/** Gallery: renders every Wave 77A component, export-only. */
export function Wave77AGallery() {
  return (
    <div className="w77a-gallery">
      {W77_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
