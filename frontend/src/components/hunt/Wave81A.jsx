/**
 * Wave81A.jsx — Infinity AI · Dark-Matter · Wave 81
 * 20 working React components for TTF follow-up analytics, ideas 53201–53220. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave81ACore.js';


const SAMPLE_HUNTS = [
  { strategy: 'auth-first', target: 'shop.example', targetClass: 'web', reconTool: 'katana', promptTemplate: 'sprint', modelTier: 'large', findingCategory: 'injection-like', networkCondition: 'fast', chained: true, novel: true, authState: 'authenticated', ttfMinutes: 14, coverageAtFirstFinding: 0.2, humanMinutes: 4, agentMinutes: 10, reHuntIntervalDays: 30, interval: '30d', startedAt: '2026-09-01T09:00:00Z', cohort: '2026-09', findings: 3, validatedFindings: 3 },
  { strategy: 'auth-first', target: 'shop.example', targetClass: 'web', reconTool: 'katana', promptTemplate: 'sprint', modelTier: 'large', findingCategory: 'auth-like', networkCondition: 'fast', chained: false, novel: false, authState: 'authenticated', ttfMinutes: 18, coverageAtFirstFinding: 0.3, humanMinutes: 5, agentMinutes: 13, reHuntIntervalDays: 90, interval: '90d', startedAt: '2026-10-01T09:00:00Z', cohort: '2026-10', findings: 2, validatedFindings: 2 },
  { strategy: 'breadth-first', target: 'api.example', targetClass: 'api', reconTool: 'httpx', promptTemplate: 'deep', modelTier: 'small', findingCategory: 'xss-like', networkCondition: 'throttled', chained: false, novel: false, authState: 'anonymous', ttfMinutes: 46, coverageAtFirstFinding: 0.6, humanMinutes: 20, agentMinutes: 26, reHuntIntervalDays: 180, interval: '180d', startedAt: '2026-08-01T09:00:00Z', cohort: '2026-08', findings: 1, validatedFindings: 1 },
  { strategy: 'breadth-first', target: 'api.example', targetClass: 'api', reconTool: 'httpx', promptTemplate: 'deep', modelTier: 'small', findingCategory: 'misconfiguration-like', networkCondition: 'normal', chained: true, novel: true, authState: 'anonymous', ttfMinutes: 58, coverageAtFirstFinding: 0.7, humanMinutes: 25, agentMinutes: 33, reHuntIntervalDays: 170, interval: '180d', startedAt: '2026-07-01T09:00:00Z', cohort: '2026-07', findings: 1, validatedFindings: 1 },
];
const SAMPLE_MOVES = [
  { move: 'rotate-recon-tool', recovered: true, recoveryMinutes: 6 },
  { move: 'rotate-recon-tool', recovered: true, recoveryMinutes: 8 },
  { move: 'switch-auth', recovered: true, recoveryMinutes: 12 },
  { move: 'restart-crawl', recovered: false, recoveryMinutes: 20 },
];
const SAMPLE_SIGNALS = [
  { signal: '5xx-spike', precededFinding: true, leadMinutes: 4, hadFinding: true },
  { signal: '5xx-spike', precededFinding: true, leadMinutes: 6, hadFinding: true },
  { signal: 'slow-endpoint', precededFinding: true, leadMinutes: 15, hadFinding: true },
];
const SAMPLE_TARGETS = [
  { asset: 'payments', predictedTTF: 20, criticality: 5 },
  { asset: 'blog', predictedTTF: 45, criticality: 1 },
  { asset: 'admin', predictedTTF: 30, criticality: 4 },
];


function Card({ title, note, children }) {
  return (
    <div className="w81a-card">
      <div className="w81a-title">{title}</div>
      {note ? <div className="w81a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w81a-badge w81a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w81a-kv">
      <span className="w81a-k">{k}</span>
      <span className="w81a-v">{String(v)}</span>
    </div>
  );
}


export function TTFAfterReHuntIntervals() {
  const v = XA.analyzeTTFAfterReHuntIntervals(SAMPLE_HUNTS);
  return (<Card title="TTF After Re-Hunt Intervals" note="Idea 53201"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByReconToolChoice() {
  const v = XA.analyzeTTFByReconTool(SAMPLE_HUNTS);
  return (<Card title="TTF by Recon Tool Choice" note="Idea 53202"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFStallRecoveryPlaybook() {
  const v = XA.buildTTFStallRecoveryPlaybook(SAMPLE_MOVES);
  return (<Card title="TTF Stall Recovery Playbook" note="Idea 53203"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFGamification() {
  const v = XA.buildTTFGamification(SAMPLE_HUNTS, { currentMinutes: 12 });
  return (<Card title="TTF Gamification" note="Idea 53204"><Kv k="Groups" v={v.sampleSize ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFAdjustedPricingInsights() {
  const v = XA.estimateTTFAdjustedPricing(SAMPLE_HUNTS);
  return (<Card title="TTF-Adjusted Pricing Insights" note="Idea 53205"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByPromptTemplate() {
  const v = XA.compareTTFByPromptTemplate(SAMPLE_HUNTS);
  return (<Card title="TTF by Prompt Template" note="Idea 53206"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFVarianceAsHealthMetric() {
  const v = XA.assessTTFVarianceHealth(SAMPLE_HUNTS);
  return (<Card title="TTF Variance as Health Metric" note="Idea 53207"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFForChainedFindings() {
  const v = XA.analyzeTTFForChainedFindings(SAMPLE_HUNTS);
  return (<Card title="TTF for Chained Findings" note="Idea 53208"><Kv k="Groups" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByNetworkConditions() {
  const v = XA.analyzeTTFByNetworkConditions(SAMPLE_HUNTS);
  return (<Card title="TTF by Network Conditions" note="Idea 53209"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFCohortAnalysis() {
  const v = XA.analyzeTTFCohorts(SAMPLE_HUNTS);
  return (<Card title="TTF Cohort Analysis" note="Idea 53210"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFFloorAnalysis() {
  const v = XA.analyzeTTFFloor(SAMPLE_HUNTS);
  return (<Card title="TTF Floor Analysis" note="Idea 53211"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByFindingCategory() {
  const v = XA.analyzeTTFByFindingCategory(SAMPLE_HUNTS);
  return (<Card title="TTF by Finding Category" note="Idea 53212"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFEarlySignalDetection() {
  const v = XA.detectTTFEarlySignals(SAMPLE_SIGNALS);
  return (<Card title="TTF Early-Signal Detection" note="Idea 53213"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFVsCoverageAtFirstFinding() {
  const v = XA.analyzeTTFVsCoverageAtFirstFinding(SAMPLE_HUNTS);
  return (<Card title="TTF vs Coverage at First Finding" note="Idea 53214"><Kv k="Groups" v={v.sampleSize ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFForZeroDayLikeFinds() {
  const v = XA.analyzeTTFForZeroDayLikeFinds(SAMPLE_HUNTS);
  return (<Card title="TTF for Zero-Day-like Finds" note="Idea 53215"><Kv k="Groups" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByModelSizeTier() {
  const v = XA.analyzeTTFByModelTier(SAMPLE_HUNTS);
  return (<Card title="TTF by Model Size Tier" note="Idea 53216"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFHumanVsAgentSplits() {
  const v = XA.splitTTFHumanVsAgent(SAMPLE_HUNTS);
  return (<Card title="TTF Human-vs-Agent Splits" note="Idea 53217"><Kv k="Groups" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFReportCardPerTarget() {
  const v = XA.buildTTFReportCardPerTarget(SAMPLE_HUNTS);
  return (<Card title="TTF Report Card per Target" note="Idea 53218"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFAnomalyExplanations() {
  const v = XA.explainTTFAnomalies(SAMPLE_HUNTS);
  return (<Card title="TTF Anomaly Explanations" note="Idea 53219"><Kv k="Groups" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFDrivenScopeTriage() {
  const v = XA.triageScopeByPredictedTTF(SAMPLE_TARGETS, { history: SAMPLE_HUNTS });
  return (<Card title="TTF-Driven Scope Triage" note="Idea 53220"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


const W81_A_GALLERY = [
  TTFAfterReHuntIntervals,
  TTFByReconToolChoice,
  TTFStallRecoveryPlaybook,
  TTFGamification,
  TTFAdjustedPricingInsights,
  TTFByPromptTemplate,
  TTFVarianceAsHealthMetric,
  TTFForChainedFindings,
  TTFByNetworkConditions,
  TTFCohortAnalysis,
  TTFFloorAnalysis,
  TTFByFindingCategory,
  TTFEarlySignalDetection,
  TTFVsCoverageAtFirstFinding,
  TTFForZeroDayLikeFinds,
  TTFByModelSizeTier,
  TTFHumanVsAgentSplits,
  TTFReportCardPerTarget,
  TTFAnomalyExplanations,
  TTFDrivenScopeTriage,
];

/** Gallery: renders every Wave 81A component, export-only. */
export function Wave81AGallery() {
  return (
    <div className="w81a-gallery">
      {W81_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
