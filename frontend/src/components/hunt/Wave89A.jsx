/**
 * Wave89A.jsx — Infinity AI · Wave 89
 * 20 working React components for failure forensics (part A: payload rot + failure forensics core), export-only module:
 * components are not mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as XA from './wave89ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w89a-card">
      <div className="w89a-title">{title}</div>
      {note ? <div className="w89a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w89a-badge w89a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w89a-kv">
      <span className="w89a-k">{k}</span>
      <span className="w89a-v">{String(v)}</span>
    </div>
  );
}

export function PayloadRotSchedules() {
  const v = XA.schedulePayloadRot([{ payloadId: 'p1', family: 'sqli', lastTriedDaysAgo: 120, failed: true },{ payloadId: 'p2', family: 'xss', lastTriedDaysAgo: 10, failed: true }]);
  return (<Card title="PayloadRotSchedules" note="Idea 53521"><Kv k="Rotted payloads" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureAttributionToStackChanges() {
  const v = XA.attributeFailuresToStack([{ payloadId: 'p1', diedAt: '2026-09-01', reason: 'blocked' },{ payloadId: 'p2', diedAt: '2026-09-03', reason: 'filtered' }]);
  return (<Card title="FailureAttributionToStackChanges" note="Idea 53522"><Kv k="Deaths linked" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function CannibalizedPayloadDetection() {
  const v = XA.detectCannibalizedPayloads([{ payloadId: 'p1', order: 1, armedDefense: true },{ payloadId: 'p2', order: 2, failedAfterArm: true }]);
  return (<Card title="CannibalizedPayloadDetection" note="Idea 53523"><Kv k="Cannibalized" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function OrderDependentFailureAnalysis() {
  const v = XA.analyzeOrderDependence([{ position: 1, attempts: 20, failures: 4 },{ position: 2, attempts: 20, failures: 11 }]);
  return (<Card title="OrderDependentFailureAnalysis" note="Idea 53524"><Kv k="Positions" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureRateBaselines() {
  const v = XA.baselineFailureRates([{ family: 'sqli', attempts: 100, failures: 30 },{ family: 'xss', attempts: 80, failures: 8 }]);
  return (<Card title="FailureRateBaselines" note="Idea 53525"><Kv k="Families" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function EnvironmentalFailureTags() {
  const v = XA.tagEnvironmentalFailures([{ id: 'f1', reason: 'timeout' },{ id: 'f2', reason: 'waf-block' }]);
  return (<Card title="EnvironmentalFailureTags" note="Idea 53526"><Kv k="Failures tagged" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadPrecisionDecayCurves() {
  const v = XA.precisionDecayCurves([{ payloadId: 'p1', ageDays: 30, successes: 9, attempts: 10 },{ payloadId: 'p1', ageDays: 120, successes: 3, attempts: 10 }]);
  return (<Card title="PayloadPrecisionDecayCurves" note="Idea 53527"><Kv k="Points" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailurePatternAlerts() {
  const v = XA.alertFailurePatterns([{ family: 'sqli', recentFailures: 40, baselineFailures: 10 },{ family: 'xss', recentFailures: 5, baselineFailures: 6 }]);
  return (<Card title="FailurePatternAlerts" note="Idea 53528"><Kv k="Families watched" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function RetiredPayloadGraveyards() {
  const v = XA.retiredPayloadGraveyards([{ payloadId: 'p-old', family: 'sqli', retired: true, failureHistory: 42 },{ payloadId: 'p-new', family: 'xss', retired: false }]);
  return (<Card title="RetiredPayloadGraveyards" note="Idea 53529"><Kv k="In graveyard" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureDrivenDefenseMapping() {
  const v = XA.mapDefensesFromFailures([{ defense: 'waf-x', family: 'sqli', blocked: 30, attempted: 40 },{ defense: 'waf-x', family: 'xss', blocked: 4, attempted: 40 }]);
  return (<Card title="FailureDrivenDefenseMapping" note="Idea 53530"><Kv k="Matrix rows" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadFragilityScores() {
  const v = XA.scorePayloadFragility([{ payloadId: 'p1', mutants: 10, survivingMutants: 2 },{ payloadId: 'p2', mutants: 10, survivingMutants: 9 }]);
  return (<Card title="PayloadFragilityScores" note="Idea 53531"><Kv k="Payloads scored" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureReplaySandboxes() {
  const v = XA.failureReplaySandbox([{ id: 'f1', recordedResponse: '403 blocked', stillFails: true },{ id: 'f2', recordedResponse: '200', stillFails: false }]);
  return (<Card title="FailureReplaySandboxes" note="Idea 53532"><Kv k="Replays" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function CrossTargetFailureCorrelation() {
  const v = XA.correlateFailuresAcrossTargets([{ payloadId: 'p1', targetType: 'wordpress', failed: true },{ payloadId: 'p2', targetType: 'wordpress', failed: true },{ payloadId: 'p3', targetType: 'wordpress', failed: true }]);
  return (<Card title="CrossTargetFailureCorrelation" note="Idea 53533"><Kv k="Correlated groups" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureToSuccessConversionTracking() {
  const v = XA.trackFailureConversions([{ mutation: 'encoding', fromFailure: true, becameSuccess: true },{ mutation: 'case', fromFailure: true, becameSuccess: false }]);
  return (<Card title="FailureToSuccessConversionTracking" note="Idea 53534"><Kv k="Mutations tracked" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function HumanFailureReviewQueues() {
  const v = XA.queueHumanFailureReviews([{ id: 'f1', novelty: 0.9, reason: 'novel-defense' },{ id: 'f2', novelty: 0.2, reason: 'timeout' }]);
  return (<Card title="HumanFailureReviewQueues" note="Idea 53535"><Kv k="Queued for review" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureExplanationGeneration() {
  const v = XA.generateFailureExplanations([{ id: 'f1', reason: 'waf-block', defense: 'waf-x' },{ id: 'f2', reason: 'patched', defense: 'input-validation' }]);
  return (<Card title="FailureExplanationGeneration" note="Idea 53536"><Kv k="Explained" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadFailureHeatmaps() {
  const v = XA.payloadFailureHeatmap([{ family: 'sqli', stack: 'php', reason: 'waf-block' },{ family: 'sqli', stack: 'php', reason: 'patched' },{ family: 'xss', stack: 'node', reason: 'waf-block' }]);
  return (<Card title="PayloadFailureHeatmaps" note="Idea 53537"><Kv k="Heat cells" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function DefenseEvasionLearningLoops() {
  const v = XA.evasionLearningLoop([{ defense: 'waf-x', bypassKnown: false, failures: 12 },{ defense: 'waf-y', bypassKnown: true, failures: 3 }]);
  return (<Card title="DefenseEvasionLearningLoops" note="Idea 53538"><Kv k="Evasion candidates" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureDataSharingOptIn() {
  const v = XA.shareFailureData([{ id: 'f1', target: 'shop.example', reason: 'waf-block', optIn: true },{ id: 'f2', target: 'bank.example', reason: 'patched', optIn: false }]);
  return (<Card title="FailureDataSharingOptIn" note="Idea 53539"><Kv k="Shared anonymized" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadAgeVsFailureCurves() {
  const v = XA.payloadAgeFailureCurves([{ payloadId: 'p1', ageDays: 30, attempts: 50, failures: 5 },{ payloadId: 'p1', ageDays: 180, attempts: 50, failures: 30 }]);
  return (<Card title="PayloadAgeVsFailureCurves" note="Idea 53540"><Kv k="Curve points" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export const WAVE89_A_COMPONENTS = [PayloadRotSchedules, FailureAttributionToStackChanges, CannibalizedPayloadDetection, OrderDependentFailureAnalysis, FailureRateBaselines, EnvironmentalFailureTags, PayloadPrecisionDecayCurves, FailurePatternAlerts, RetiredPayloadGraveyards, FailureDrivenDefenseMapping, PayloadFragilityScores, FailureReplaySandboxes, CrossTargetFailureCorrelation, FailureToSuccessConversionTracking, HumanFailureReviewQueues, FailureExplanationGeneration, PayloadFailureHeatmaps, DefenseEvasionLearningLoops, FailureDataSharingOptIn, PayloadAgeVsFailureCurves];

export function Wave89AGallery() {
  return (
    <div className="w89a-gallery">
      {WAVE89_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
