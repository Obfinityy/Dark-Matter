/**
 * Wave89B.jsx — Infinity AI · Wave 89
 * 20 working React components for failure forensics (part B: failure forensics operations), export-only module:
 * components are not mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as XB from './wave89BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w89b-card">
      <div className="w89b-title">{title}</div>
      {note ? <div className="w89b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w89b-badge w89b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w89b-kv">
      <span className="w89b-k">{k}</span>
      <span className="w89b-v">{String(v)}</span>
    </div>
  );
}

export function FailureCascadeDetection() {
  const v = XB.detectFailureCascades([{ defenseChange: 'waf-rule-9', family: 'sqli', failedAfter: true },{ defenseChange: 'waf-rule-9', family: 'xss', failedAfter: true },{ defenseChange: 'waf-rule-9', family: 'ssrf', failedAfter: true }]);
  return (<Card title="FailureCascadeDetection" note="Idea 53541"><Kv k="Cascades" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BenignFailureFiltering() {
  const v = XB.filterBenignFailures([{ id: 'f1', setupError: true, reason: 'malformed-payload' },{ id: 'f2', setupError: false, reason: 'waf-block' }]);
  return (<Card title="BenignFailureFiltering" note="Idea 53542"><Kv k="Benign filtered" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureRootCauseConfidence() {
  const v = XB.scoreRootCauseConfidence([{ id: 'f1', signals: 5, agreeingSignals: 4 },{ id: 'f2', signals: 4, agreeingSignals: 1 }]);
  return (<Card title="FailureRootCauseConfidence" note="Idea 53543"><Kv k="Classified" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadFailureBenchmarks() {
  const v = XB.benchmarkPayloadFailures([{ family: 'sqli', attempts: 100, failures: 30, successes: 60 },{ family: 'xss', attempts: 100, failures: 10, successes: 85 }]);
  return (<Card title="PayloadFailureBenchmarks" note="Idea 53544"><Kv k="Families benchmarked" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureDrivenTargetProfiling() {
  const v = XB.profileTargetFromFailures([{ target: 't1', reason: 'waf-block', responseSignature: 'X-WAF:1' },{ target: 't1', reason: 'waf-block', responseSignature: 'X-WAF:1' },{ target: 't1', reason: 'challenge', responseSignature: 'captcha' }]);
  return (<Card title="FailureDrivenTargetProfiling" note="Idea 53545"><Kv k="Targets profiled" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function AdaptiveFailureBudgets() {
  const v = XB.adaptiveFailureBudgets([{ family: 'sqli', failureRate: 0.8, intelValue: 0.3 },{ family: 'xss', failureRate: 0.1, intelValue: 0.9 }]);
  return (<Card title="AdaptiveFailureBudgets" note="Idea 53546"><Kv k="Budgets allocated" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureLessonAutoDrafting() {
  const v = XB.draftFailureLessons([{ id: 'f1', pattern: 'waf-rule-9 blocks quote variants', impact: 0.9 },{ id: 'f2', pattern: 'timeout cluster', impact: 0.2 }]);
  return (<Card title="FailureLessonAutoDrafting" note="Idea 53547"><Kv k="Lessons drafted" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadFailureTimelines() {
  const v = XB.payloadFailureTimelines([{ payloadId: 'p1', at: '2026-08-01', failed: true },{ payloadId: 'p1', at: '2026-09-15', failed: true },{ payloadId: 'p2', at: '2026-09-01', failed: false }]);
  return (<Card title="PayloadFailureTimelines" note="Idea 53548"><Kv k="Timelines" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureModeShiftDetection() {
  const v = XB.detectFailureModeShifts([{ payloadId: 'p1', period: '2026-08', mode: 'filter' },{ payloadId: 'p1', period: '2026-09', mode: 'patch' },{ payloadId: 'p1', period: '2026-09', mode: 'patch' }]);
  return (<Card title="FailureModeShiftDetection" note="Idea 53549"><Kv k="Shifts detected" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function CrossDefenseFailureComparison() {
  const v = XB.compareFailuresAcrossDefenses([{ payloadId: 'p1', defense: 'waf-x', blocked: true },{ payloadId: 'p1', defense: 'waf-y', blocked: false },{ payloadId: 'p1', defense: 'waf-y', blocked: false }]);
  return (<Card title="CrossDefenseFailureComparison" note="Idea 53550"><Kv k="Weakest links" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureInformedPayloadDesign() {
  const v = XB.designFromFailures([{ reason: 'encoding-filter', failures: 20 },{ reason: 'length-cap', failures: 5 }]);
  return (<Card title="FailureInformedPayloadDesign" note="Idea 53551"><Kv k="Design recommendations" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadFailureInsuranceMetrics() {
  const v = XB.payloadFailureInsurance([{ family: 'sqli', failureRate: 0.5, targetSurvival: 0.95 },{ family: 'xss', failureRate: 0.1, targetSurvival: 0.95 }]);
  return (<Card title="PayloadFailureInsuranceMetrics" note="Idea 53552"><Kv k="Families insured" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureReviewRituals() {
  const v = XB.failureReviewRituals([{ id: 'f1', insightScore: 0.95, reviewed: false },{ id: 'f2', insightScore: 0.4, reviewed: false },{ id: 'f3', insightScore: 0.2, reviewed: true }]);
  return (<Card title="FailureReviewRituals" note="Idea 53553"><Kv k="Review picks" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureDataRetentionTiers() {
  const v = XB.failureRetentionTiers([{ id: 'f1', novelty: 0.9 },{ id: 'f2', novelty: 0.1 }]);
  return (<Card title="FailureDataRetentionTiers" note="Idea 53554"><Kv k="Tiered records" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadFailurePrediction() {
  const v = XB.predictPayloadFailure([{ payloadId: 'p1', family: 'sqli' },{ payloadId: 'p2', family: 'xss' }]);
  return (<Card title="PayloadFailurePrediction" note="Idea 53555"><Kv k="Predictions" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureAwareScheduling() {
  const v = XB.scheduleFailureAware([{ payloadId: 'p1', risk: 0.9 },{ payloadId: 'p2', risk: 0.2 }]);
  return (<Card title="FailureAwareScheduling" note="Idea 53556"><Kv k="Scheduled slots" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailurePatternSearch() {
  const v = XB.searchFailurePatterns([{ id: 'f1', responseSignature: '403 waf-x' },{ id: 'f2', responseSignature: '200 ok' }]);
  return (<Card title="FailurePatternSearch" note="Idea 53557"><Kv k="Matches" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureDrivenWafIdentification() {
  const v = XB.identifyWafFromFailures([{ responseSignature: 'X-Sucuri', count: 8 },{ responseSignature: 'cf-ray', count: 5 }]);
  return (<Card title="FailureDrivenWafIdentification" note="Idea 53558"><Kv k="WAFs identified" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadFailureCostBenefit() {
  const v = XB.failureCostBenefit([{ id: 'f1', intelValue: 0.9, requestCost: 3 },{ id: 'f2', intelValue: 0.1, requestCost: 9 }]);
  return (<Card title="PayloadFailureCostBenefit" note="Idea 53559"><Kv k="Worth-it failures" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureAutopsyLeaderboards() {
  const v = XB.failureAutopsyLeaderboard([{ researcher: 'researcher-a', insights: 12, autopsies: 10 },{ researcher: 'researcher-b', insights: 4, autopsies: 10 }]);
  return (<Card title="FailureAutopsyLeaderboards" note="Idea 53560"><Kv k="Researchers ranked" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w89b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export const WAVE89_B_COMPONENTS = [FailureCascadeDetection, BenignFailureFiltering, FailureRootCauseConfidence, PayloadFailureBenchmarks, FailureDrivenTargetProfiling, AdaptiveFailureBudgets, FailureLessonAutoDrafting, PayloadFailureTimelines, FailureModeShiftDetection, CrossDefenseFailureComparison, FailureInformedPayloadDesign, PayloadFailureInsuranceMetrics, FailureReviewRituals, FailureDataRetentionTiers, PayloadFailurePrediction, FailureAwareScheduling, FailurePatternSearch, FailureDrivenWafIdentification, PayloadFailureCostBenefit, FailureAutopsyLeaderboards];

export function Wave89BGallery() {
  return (
    <div className="w89b-gallery">
      {WAVE89_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
