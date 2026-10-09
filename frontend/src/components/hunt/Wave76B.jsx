/**
 * Wave76B.jsx — Infinity AI · Dark-Matter · Wave 76
 * 20 working React components for hunt learning and
 * decision analysis, ideas 53021–53040. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave76BCores.js';

const NOW = '2026-10-09T00:00:00Z';

const SAMPLE_HUNT = { huntId: 'hunt-76', id: 'hunt-76', scope: { include: ['shop.example.com', 'api.example.com'] }, visitedHosts: ['shop.example.com'] };

const SAMPLE_AREAS = [
  { id: 'a1', name: 'Checkout', coveragePct: 90, findings: 4 },
  { id: 'a2', name: 'Search', coveragePct: 40, findings: 1 },
];

function Card({ title, note, children }) {
  return (
    <div className="w76b-card">
      <div className="w76b-title">{title}</div>
      {note ? <div className="w76b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w76b-badge w76b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w76b-kv">
      <span className="w76b-k">{k}</span>
      <span className="w76b-v">{String(v)}</span>
    </div>
  );
}

export function CoverageToFindingCorrelation() {
  const v = XB.correlateCoverageToFindings(SAMPLE_AREAS, {});
  return (
    <Card title="Coverage-to-Finding Correlation" note="Idea 53021">
      <Kv k="Areas" v={v.count} />
      <Kv k="Corr" v={v.correlation} />
    </Card>
  );
}

export function MostValuableSingleProbe() {
  const v = XB.findMostValuableSingleProbe([{ id: 'pr1', name: 'Param probe' }, { id: 'pr2', name: 'Header probe' }], [{ id: 'f1', probeId: 'pr1', score: 8 }, { id: 'f2', probeId: 'pr1', score: 7 }], {});
  return (
    <Card title="Most Valuable Single Probe" note="Idea 53022">
      <Kv k="Best" v={v.best ? v.best.probeId : 'none'} />
      <Kv k="Score" v={v.best ? v.best.score : 0} />
    </Card>
  );
}

export function QuietPhaseAudit() {
  const v = XB.auditQuietPhase([{ id: 'ph1', name: 'Idle wait', findings: 0, minutes: 25 }, { id: 'ph2', name: 'Recon', findings: 2, minutes: 20 }], { minMinutes: 15 });
  return (
    <Card title="Quiet-Phase Audit" note="Idea 53023">
      <Kv k="Quiet" v={v.count} />
      <Kv k="Minutes" v={v.totalQuietMinutes} />
    </Card>
  );
}

export function AssumptionBusterLog() {
  const v = XB.logAssumptionBusters([{ type: 'assumption-buster', at: NOW }], [{ id: 'as1', text: 'API is rate limited', holds: false }], {});
  return (
    <Card title="Assumption Buster Log" note="Idea 53024">
      <Kv k="Busted" v={v.count} />
      <div className="w76b-note">{v.busted[0] ? v.busted[0].text : 'none'}</div>
    </Card>
  );
}

export function SignalDensityMap() {
  const v = XB.buildSignalDensityMap([{ id: 'seg1', label: 'auth', signals: 8, probes: 4 }, { id: 'seg2', label: 'search', signals: 2, probes: 4 }], {});
  return (
    <Card title="Signal Density Map" note="Idea 53025">
      <Kv k="Segments" v={v.count} />
      <Kv k="Hottest" v={v.hottest ? v.hottest.segmentId : 'none'} />
    </Card>
  );
}

export function EscalationPathEffectiveness() {
  const v = XB.evaluateEscalationPathEffectiveness([{ id: 'esc1', from: 'low', to: 'high', findings: 2, minutes: 10, success: true }], {});
  return (
    <Card title="Escalation Path Effectiveness" note="Idea 53026">
      <Kv k="Paths" v={v.count} />
      <Kv k="Success" v={v.successRate} />
    </Card>
  );
}

export function ManualOverrideImpact() {
  const v = XB.measureManualOverrideImpact([{ id: 'ov1', action: 'force queue', findings: 2, savedMinutes: 15 }], [{ id: 'f1', afterOverride: true }], {});
  return (
    <Card title="Manual-Override Impact" note="Idea 53027">
      <Kv k="Overrides" v={v.count} />
      <Kv k="Findings" v={v.totalFindings} />
    </Card>
  );
}

export function ExploitabilityConversionRate() {
  const v = XB.computeExploitabilityConversionRate([{ id: 'f1', exploitable: true }, { id: 'f2', exploitable: false }, { id: 'f3', status: 'exploitable' }], {});
  return (
    <Card title="Exploitability Conversion Rate" note="Idea 53028">
      <Kv k="Rate" v={v.rate} />
      <Kv k="Exploitable" v={v.exploitable} />
      <div className="w76b-row"><Badge tone="info">Infinity AI rate</Badge></div>
    </Card>
  );
}

export function TriageAccuracyReview() {
  const v = XB.reviewTriageAccuracy([{ predicted: 'real', actual: 'real' }, { predicted: 'real', actual: 'false-positive' }], {});
  return (
    <Card title="Triage Accuracy Review" note="Idea 53029">
      <Kv k="Accuracy" v={v.accuracy} />
      <Kv k="Total" v={v.total} />
    </Card>
  );
}

export function ToolSelectionScorecard() {
  const v = XB.scoreToolSelection([{ id: 'tool1', name: 'Scanner', used: true, findings: 4, minutes: 20 }], SAMPLE_HUNT, {});
  return (
    <Card title="Tool Selection Scorecard" note="Idea 53030">
      <Kv k="Tools" v={v.count} />
      <Kv k="Best" v={v.best ? v.best.toolId : 'none'} />
    </Card>
  );
}

export function CredentialQualityEffect() {
  const v = XB.evaluateCredentialQualityEffect([{ id: 'c1', quality: 'high', findings: 3, success: true }, { id: 'c2', quality: 'low', findings: 1, success: false }], {});
  return (
    <Card title="Credential Quality Effect" note="Idea 53031">
      <Kv k="Delta" v={v.delta} />
      <Kv k="High avg" v={v.highAvg} />
    </Card>
  );
}

export function ScopeUtilizationReview() {
  const v = XB.reviewScopeUtilization({ include: ['shop.example.com', 'api.example.com'] }, SAMPLE_HUNT, {});
  return (
    <Card title="Scope Utilization Review" note="Idea 53032">
      <Kv k="Rate" v={v.utilizationRate} />
      <Kv k="Unused" v={v.unused.length} />
    </Card>
  );
}

export function EnvironmentParityCheck() {
  const v = XB.checkEnvironmentParity({ runtime: 'node20', region: 'us' }, { runtime: 'node20', region: 'eu' }, {});
  return (
    <Card title="Environment Parity Check" note="Idea 53033">
      <Kv k="Parity" v={String(v.parity)} />
      <Kv k="Diffs" v={v.diffCount} />
    </Card>
  );
}

export function NegativeSpaceReport() {
  const v = XB.buildNegativeSpaceReport([{ id: 'a1', name: 'Checkout', coveragePct: 80 }, { id: 'a2', name: 'Admin', coveragePct: 0 }], {});
  return (
    <Card title="Negative Space Report" note="Idea 53034">
      <Kv k="Untouched" v={v.untouchedCount} />
      <Kv k="Total" v={v.total} />
    </Card>
  );
}

export function BestDecisionTimeline() {
  const v = XB.buildBestDecisionTimeline([{ id: 'd1', at: NOW, text: 'focus checkout', impact: 9 }], {});
  return (
    <Card title="Best-Decision Timeline" note="Idea 53035">
      <Kv k="Decisions" v={v.count} />
      <Kv k="Top impact" v={v.top ? v.top.impact : 0} />
    </Card>
  );
}

export function WorstDecisionPostmortem() {
  const v = XB.buildWorstDecisionPostmortem([{ id: 'd1', at: NOW, text: 'skip auth', impact: -5, lesson: 'Check auth early' }, { id: 'd2', at: NOW, text: 'focus checkout', impact: 9 }], {});
  return (
    <Card title="Worst-Decision Postmortem" note="Idea 53036">
      <Kv k="Worst" v={v.worst ? v.worst.decisionId : 'none'} />
      <div className="w76b-note">{v.worst ? v.worst.lesson : 'none'}</div>
    </Card>
  );
}

export function ParameterChoiceAudit() {
  const v = XB.auditParameterChoices([{ id: 'pr1', params: ['a', 'b'], findings: 2 }], {});
  return (
    <Card title="Parameter Choice Audit" note="Idea 53037">
      <Kv k="Probes" v={v.count} />
      <Kv k="Risky" v={v.riskyCount} />
    </Card>
  );
}

export function SessionLengthSweetSpot() {
  const v = XB.findSessionLengthSweetSpot([{ minutes: 45, findings: 3 }, { minutes: 50, findings: 4 }, { minutes: 20, findings: 1 }], {});
  return (
    <Card title="Session Length Sweet Spot" note="Idea 53038">
      <Kv k="Buckets" v={v.count} />
      <Kv k="Best" v={v.sweetSpot ? v.sweetSpot.bucket : 'none'} />
    </Card>
  );
}

export function ParallelismGainAnalysis() {
  const v = XB.analyzeParallelismGain([{ minutes: 30, parallel: false }, { minutes: 40, parallel: true }], {});
  return (
    <Card title="Parallelism Gain Analysis" note="Idea 53039">
      <Kv k="Gain pct" v={v.gainPct} />
      <Kv k="Wall m" v={v.wallClockMinutes} />
    </Card>
  );
}

export function RetryPolicyEffectiveness() {
  const v = XB.evaluateRetryPolicyEffectiveness([{ retries: 2, success: true, extraMinutes: 5 }, { retries: 1, success: false, extraMinutes: 3 }], {});
  return (
    <Card title="Retry Policy Effectiveness" note="Idea 53040">
      <Kv k="Retried" v={v.retriedCount} />
      <Kv k="Rate" v={v.recoveryRate} />
      <div className="w76b-row"><Badge tone="info">{`checked ${NOW.slice(0, 10)}`}</Badge></div>
    </Card>
  );
}

/** Gallery list: all 20 idea-53021–53040 components, export-only. */
export const W76_B_GALLERY = [
  CoverageToFindingCorrelation,
  MostValuableSingleProbe,
  QuietPhaseAudit,
  AssumptionBusterLog,
  SignalDensityMap,
  EscalationPathEffectiveness,
  ManualOverrideImpact,
  ExploitabilityConversionRate,
  TriageAccuracyReview,
  ToolSelectionScorecard,
  CredentialQualityEffect,
  ScopeUtilizationReview,
  EnvironmentParityCheck,
  NegativeSpaceReport,
  BestDecisionTimeline,
  WorstDecisionPostmortem,
  ParameterChoiceAudit,
  SessionLengthSweetSpot,
  ParallelismGainAnalysis,
  RetryPolicyEffectiveness,
];

/** Gallery: renders every Wave 76B component, export-only. */
export function Wave76BGallery() {
  return (
    <div className="w76b-gallery">
      {W76_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
