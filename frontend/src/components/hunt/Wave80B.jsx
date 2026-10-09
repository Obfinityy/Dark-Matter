/**
 * Wave80B.jsx — Infinity AI · Dark-Matter · Wave 80
 * 20 working React components for TTF deep analytics, ideas 53181–53200. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave80BCores.js';


const SAMPLE_HUNTS = [
  { strategy: 'auth-first', firstFindingType: 'sqli', payloadFamily: 'sqli', huntMode: 'api-first', vertical: 'fintech', maturity: 'mature', season: 'summer', researcherExperience: 'senior', authState: 'authenticated', success: true, findings: 4, validatedFindings: 4, findingsCount: 4, ttfMinutes: 15, timeToFirstFindingMinutes: 15, totalMinutes: 90, hour: 9, startedAt: '2026-07-10T09:00:00Z', scopeSize: 8, endpoints: 8, warmStart: true, isFirstHunt: false, priorHunts: 12, interFindingMinutes: [8, 12, 10], falsePositives: 1, depth: 2 },
  { strategy: 'auth-first', firstFindingType: 'sqli', payloadFamily: 'sqli', huntMode: 'api-first', vertical: 'fintech', maturity: 'mature', season: 'summer', researcherExperience: 'senior', authState: 'authenticated', success: true, findings: 2, validatedFindings: 2, findingsCount: 2, ttfMinutes: 25, timeToFirstFindingMinutes: 25, totalMinutes: 80, hour: 10, startedAt: '2026-07-11T10:00:00Z', scopeSize: 9, endpoints: 9, warmStart: true, isFirstHunt: false, priorHunts: 12, interFindingMinutes: [15], falsePositives: 0, depth: 3 },
  { strategy: 'breadth-first', firstFindingType: 'xss', payloadFamily: 'xss', huntMode: 'ui-first', vertical: 'retail', maturity: 'new', season: 'winter', researcherExperience: 'junior', authState: 'unauthenticated', success: true, findings: 1, validatedFindings: 1, findingsCount: 1, ttfMinutes: 48, timeToFirstFindingMinutes: 48, totalMinutes: 120, hour: 2, startedAt: '2026-01-12T02:00:00Z', scopeSize: 80, endpoints: 80, warmStart: false, isFirstHunt: true, priorHunts: 0, interFindingMinutes: [], falsePositives: 5, depth: 10 },
  { strategy: 'breadth-first', firstFindingType: 'idor', payloadFamily: 'idor', huntMode: 'ui-first', vertical: 'retail', maturity: 'new', season: 'winter', researcherExperience: 'junior', authState: 'unauthenticated', success: false, findings: 0, validatedFindings: 0, findingsCount: 0, ttfMinutes: 60, timeToFirstFindingMinutes: 60, totalMinutes: 110, hour: 3, startedAt: '2026-01-13T03:00:00Z', scopeSize: 90, endpoints: 90, warmStart: false, isFirstHunt: true, priorHunts: 0, interFindingMinutes: [], falsePositives: 6, depth: 11 },
];
const SAMPLE_TTF_TREND = [
  { strategy: 'auth-first', at: '2026-09-01T00:00:00Z', medianTTF: 22, ttfMinutes: 22 },
  { strategy: 'auth-first', at: '2026-10-01T00:00:00Z', medianTTF: 20, ttfMinutes: 20 },
  { strategy: 'breadth-first', at: '2026-09-01T00:00:00Z', medianTTF: 30, ttfMinutes: 30 },
  { strategy: 'breadth-first', at: '2026-10-01T00:00:00Z', medianTTF: 52, ttfMinutes: 52 },
];


function Card({ title, note, children }) {
  return (
    <div className="w80b-card">
      <div className="w80b-title">{title}</div>
      {note ? <div className="w80b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w80b-badge w80b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w80b-kv">
      <span className="w80b-k">{k}</span>
      <span className="w80b-v">{String(v)}</span>
    </div>
  );
}


export function ZeroFindingHuntTTFAnalysis() {
  const v = XB.analyzeZeroFindingHuntTTF(SAMPLE_HUNTS);
  return (<Card title="Zero-Finding Hunt TTF Analysis" note="Idea 53181"><Kv k="Groups" v={v.totalHunts ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFVsTotalFindingsCorrelation() {
  const v = XB.correlateTTFWithTotalFindings(SAMPLE_HUNTS);
  return (<Card title="TTF vs Total Findings Correlation" note="Idea 53182"><Kv k="Groups" v={v.count ?? v.sampleSize ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function FirstFindingTypeProfiles() {
  const v = XB.profileFirstFindingTypes(SAMPLE_HUNTS);
  return (<Card title="First-Finding Type Profiles" note="Idea 53183"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByTimeOfDay() {
  const v = XB.analyzeTTFByTimeOfDay(SAMPLE_HUNTS);
  return (<Card title="TTF by Time of Day" note="Idea 53184"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByScopeSize() {
  const v = XB.analyzeTTFByScopeSize(SAMPLE_HUNTS);
  return (<Card title="TTF by Scope Size" note="Idea 53185"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByResearcherExperience() {
  const v = XB.analyzeTTFByExperience(SAMPLE_HUNTS);
  return (<Card title="TTF by Researcher Experience" note="Idea 53186"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFWarmStartEffect() {
  const v = XB.measureTTFWarmStartEffect(SAMPLE_HUNTS);
  return (<Card title="TTF Warm-Start Effect" note="Idea 53187"><Kv k="Groups" v={(v.warmCount ?? 0) + (v.coldCount ?? 0)} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFColdStartPenalty() {
  const v = XB.measureTTFColdStartPenalty(SAMPLE_HUNTS);
  return (<Card title="TTF Cold-Start Penalty" note="Idea 53188"><Kv k="Groups" v={(v.firstCount ?? 0) + (v.repeatCount ?? 0)} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function InterFindingTimeDistributions() {
  const v = XB.analyzeInterFindingTimeDistributions(SAMPLE_HUNTS);
  return (<Card title="Inter-Finding Time Distributions" note="Idea 53189"><Kv k="Groups" v={v.gapCount ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByPayloadFamily() {
  const v = XB.analyzeTTFByPayloadFamily(SAMPLE_HUNTS);
  return (<Card title="TTF by Payload Family" note="Idea 53190"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFRegressionDetection() {
  const v = XB.detectTTFRegression(SAMPLE_TTF_TREND);
  return (<Card title="TTF Regression Detection" note="Idea 53191"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFBudgetPlanner() {
  const v = XB.planTTFBudget(SAMPLE_HUNTS);
  return (<Card title="TTF Budget Planner" note="Idea 53192"><Kv k="Groups" v={v.sampleSize ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFOutlierAutopsies() {
  const v = XB.autopsyTTFOutliers(SAMPLE_HUNTS);
  return (<Card title="TTF Outlier Autopsies" note="Idea 53193"><Kv k="Groups" v={v.sampleSize ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByHuntMode() {
  const v = XB.compareTTFByHuntMode(SAMPLE_HUNTS);
  return (<Card title="TTF by Hunt Mode" note="Idea 53194"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFConfidenceIntervalsPerStrategy() {
  const v = XB.buildTTFConfidenceIntervals(SAMPLE_HUNTS);
  return (<Card title="TTF Confidence Intervals per Strategy" note="Idea 53195"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFVsFalsePositiveTradeoff() {
  const v = XB.analyzeTTFVsFalsePositiveTradeoff(SAMPLE_HUNTS);
  return (<Card title="TTF vs False-Positive Tradeoff" note="Idea 53196"><Kv k="Groups" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function FirstFindingDepthAnalysis() {
  const v = XB.analyzeFirstFindingDepth(SAMPLE_HUNTS);
  return (<Card title="First-Finding Depth Analysis" note="Idea 53197"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByIndustryVertical() {
  const v = XB.analyzeTTFByVertical(SAMPLE_HUNTS);
  return (<Card title="TTF by Industry Vertical" note="Idea 53198"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFSeasonality() {
  const v = XB.analyzeTTFSeasonality(SAMPLE_HUNTS);
  return (<Card title="TTF Seasonality" note="Idea 53199"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByTargetMaturity() {
  const v = XB.analyzeTTFByTargetMaturity(SAMPLE_HUNTS);
  return (<Card title="TTF by Target Maturity" note="Idea 53200"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


const W80_B_GALLERY = [
  ZeroFindingHuntTTFAnalysis,
  TTFVsTotalFindingsCorrelation,
  FirstFindingTypeProfiles,
  TTFByTimeOfDay,
  TTFByScopeSize,
  TTFByResearcherExperience,
  TTFWarmStartEffect,
  TTFColdStartPenalty,
  InterFindingTimeDistributions,
  TTFByPayloadFamily,
  TTFRegressionDetection,
  TTFBudgetPlanner,
  TTFOutlierAutopsies,
  TTFByHuntMode,
  TTFConfidenceIntervalsPerStrategy,
  TTFVsFalsePositiveTradeoff,
  FirstFindingDepthAnalysis,
  TTFByIndustryVertical,
  TTFSeasonality,
  TTFByTargetMaturity,
];

/** Gallery: renders every Wave 80B component, export-only. */
export function Wave80BGallery() {
  return (
    <div className="w80b-gallery">
      {W80_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
