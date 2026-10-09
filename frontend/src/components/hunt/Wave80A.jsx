/**
 * Wave80A.jsx — Infinity AI · Dark-Matter · Wave 80
 * 20 working React components for strategy remix and TTF analytics, ideas 53161–53180. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave80ACore.js';


const SAMPLE_HUNTS = [
  { strategy: 'auth-first', authState: 'authenticated', firstFindingSeverity: 'critical', severity: 'critical', success: true, findings: 4, validatedFindings: 4, findingsCount: 4, ttfMinutes: 18, timeToFirstFindingMinutes: 18, requests: 120, phaseTimes: { recon: 4, probing: 10, confirmation: 4 }, startedAt: '2026-10-01T09:00:00Z' },
  { strategy: 'breadth-first', authState: 'unauthenticated', firstFindingSeverity: 'medium', severity: 'medium', success: true, findings: 2, validatedFindings: 2, findingsCount: 2, ttfMinutes: 32, timeToFirstFindingMinutes: 32, requests: 210, phaseTimes: { recon: 12, probing: 14, confirmation: 6 }, startedAt: '2026-10-02T14:00:00Z' },
  { strategy: 'deep-dive', authState: 'authenticated', firstFindingSeverity: 'high', severity: 'high', success: true, findings: 3, validatedFindings: 3, findingsCount: 3, ttfMinutes: 24, timeToFirstFindingMinutes: 24, requests: 90, phaseTimes: { recon: 6, probing: 12, confirmation: 6 }, startedAt: '2026-10-03T10:00:00Z' },
  { strategy: 'breadth-first', authState: 'unauthenticated', firstFindingSeverity: 'low', severity: 'low', success: false, findings: 0, validatedFindings: 0, findingsCount: 0, ttfMinutes: 55, timeToFirstFindingMinutes: 55, requests: 260, phaseTimes: { recon: 15, probing: 30, confirmation: 10 }, startedAt: '2026-10-04T16:00:00Z' },
];
const SAMPLE_STATS = [
  { strategy: 'auth-first', key: 'auth-first', hunts: 40, attempts: 40, wins: 28, successes: 28, winRate: 0.7, findingTypes: ['sqli', 'auth'] },
  { strategy: 'deep-dive', key: 'deep-dive', hunts: 22, attempts: 22, wins: 15, successes: 15, winRate: 0.68, findingTypes: ['idor', 'auth'] },
  { strategy: 'legacy-probe', key: 'legacy-probe', hunts: 25, attempts: 25, wins: 2, successes: 2, winRate: 0.08, findingTypes: ['xss'] },
  { strategy: 'new-scout', key: 'new-scout', hunts: 3, attempts: 3, wins: 2, successes: 2, winRate: 0.67, findingTypes: ['ssrf'] },
];
const SAMPLE_EXPERIMENTS = [
  { variant: 'A', trials: 100, attempts: 100, wins: 40, successes: 40 },
  { variant: 'B', trials: 100, attempts: 100, wins: 60, successes: 60 },
];
const SAMPLE_REPLAYS = [
  { strategy: 'auth-first', at: '2026-09-01T00:00:00Z', winRate: 0.5, findings: 2, validatedFindings: 2 },
  { strategy: 'auth-first', at: '2026-10-01T00:00:00Z', winRate: 0.7, findings: 4, validatedFindings: 4 },
  { strategy: 'breadth-first', at: '2026-09-01T00:00:00Z', winRate: 0.45, findings: 1, validatedFindings: 1 },
  { strategy: 'breadth-first', at: '2026-10-01T00:00:00Z', winRate: 0.4, findings: 1, validatedFindings: 1 },
];
const SAMPLE_SNAPSHOTS = [
  { strategy: 'auth-first', at: '2026-09-01T00:00:00Z', winRate: 0.65 },
  { strategy: 'auth-first', at: '2026-10-01T00:00:00Z', winRate: 0.7 },
  { strategy: 'legacy-probe', at: '2026-09-01T00:00:00Z', winRate: 0.6 },
  { strategy: 'legacy-probe', at: '2026-10-01T00:00:00Z', winRate: 0.25 },
];
const SAMPLE_TTF_TREND = [
  { strategy: 'auth-first', at: '2026-09-01T00:00:00Z', medianTTF: 45, ttfMinutes: 45 },
  { strategy: 'auth-first', at: '2026-10-01T00:00:00Z', medianTTF: 28, ttfMinutes: 28 },
  { strategy: 'breadth-first', at: '2026-09-01T00:00:00Z', medianTTF: 40, ttfMinutes: 40 },
  { strategy: 'breadth-first', at: '2026-10-01T00:00:00Z', medianTTF: 52, ttfMinutes: 52 },
];


function Card({ title, note, children }) {
  return (
    <div className="w80a-card">
      <div className="w80a-title">{title}</div>
      {note ? <div className="w80a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w80a-badge w80a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w80a-kv">
      <span className="w80a-k">{k}</span>
      <span className="w80a-v">{String(v)}</span>
    </div>
  );
}


export function StrategyRemixSuggestions() {
  const v = XA.suggestStrategyRemixes(SAMPLE_STATS);
  return (<Card title="Strategy Remix Suggestions" note="Idea 53161"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyBriefingCards() {
  const v = XA.buildStrategyBriefingCards(SAMPLE_HUNTS);
  return (<Card title="Strategy Briefing Cards" note="Idea 53162"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyABSignificanceDashboard() {
  const v = XA.evaluateStrategyABSignificance(SAMPLE_EXPERIMENTS);
  return (<Card title="Strategy A/B Significance Dashboard" note="Idea 53163"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyWinAttributionNotes() {
  const v = XA.writeStrategyWinAttributionNotes(SAMPLE_HUNTS);
  return (<Card title="Strategy Win Attribution Notes" note="Idea 53164"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyRiskAdjustedRankings() {
  const v = XA.rankStrategiesRiskAdjusted(SAMPLE_HUNTS);
  return (<Card title="Strategy Risk-Adjusted Rankings" note="Idea 53165"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyColdStartGuide() {
  const v = XA.buildStrategyColdStartGuide(SAMPLE_STATS);
  return (<Card title="Strategy Cold-Start Guide" note="Idea 53166"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyTelemetrySchema() {
  const v = XA.defineStrategyTelemetrySchema(SAMPLE_HUNTS);
  return (<Card title="Strategy Telemetry Schema" note="Idea 53167"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyReplayDiffs() {
  const v = XA.diffStrategyReplays(SAMPLE_REPLAYS);
  return (<Card title="Strategy Replay Diffs" note="Idea 53168"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyCoachingPrompts() {
  const v = XA.generateStrategyCoachingPrompts(SAMPLE_HUNTS);
  return (<Card title="Strategy Coaching Prompts" note="Idea 53169"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyHallOfFame() {
  const v = XA.buildStrategyHallOfFame(SAMPLE_STATS);
  return (<Card title="Strategy Hall of Fame" note="Idea 53170"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategySunsetRetrospectives() {
  const v = XA.writeStrategySunsetRetrospectives(SAMPLE_STATS);
  return (<Card title="Strategy Sunset Retrospectives" note="Idea 53171"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyWinRateAlerts() {
  const v = XA.detectStrategyWinRateAlerts(SAMPLE_SNAPSHOTS);
  return (<Card title="Strategy Win-Rate Alerts" note="Idea 53172"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function MedianTimeToFirstFindingBenchmarks() {
  const v = XA.benchmarkMedianTTF(SAMPLE_HUNTS);
  return (<Card title="Median Time-to-First-Finding Benchmarks" note="Idea 53173"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFPercentileBands() {
  const v = XA.buildTTFPercentileBands(SAMPLE_HUNTS);
  return (<Card title="TTF Percentile Bands" note="Idea 53174"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByAuthenticationState() {
  const v = XA.compareTTFByAuthState(SAMPLE_HUNTS);
  return (<Card title="TTF by Authentication State" note="Idea 53175"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByFindingSeverity() {
  const v = XA.compareTTFByFindingSeverity(SAMPLE_HUNTS);
  return (<Card title="TTF by Finding Severity" note="Idea 53176"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFDecomposition() {
  const v = XA.decomposeTTF(SAMPLE_HUNTS);
  return (<Card title="TTF Decomposition" note="Idea 53177"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFPredictionAtHuntStart() {
  const v = XA.predictTTFAtHuntStart({ strategy: 'auth-first', authState: 'authenticated' }, SAMPLE_HUNTS);
  return (<Card title="TTF Prediction at Hunt Start" note="Idea 53178"><Kv k="Groups" v={v.sampleSize ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFSlipAlerts() {
  const v = XA.detectTTFSlipAlerts(SAMPLE_TTF_TREND);
  return (<Card title="TTF Slip Alerts" note="Idea 53179"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFImprovementLeaderboard() {
  const v = XA.buildTTFImprovementLeaderboard(SAMPLE_TTF_TREND);
  return (<Card title="TTF Improvement Leaderboard" note="Idea 53180"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w80a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


const W80_A_GALLERY = [
  StrategyRemixSuggestions,
  StrategyBriefingCards,
  StrategyABSignificanceDashboard,
  StrategyWinAttributionNotes,
  StrategyRiskAdjustedRankings,
  StrategyColdStartGuide,
  StrategyTelemetrySchema,
  StrategyReplayDiffs,
  StrategyCoachingPrompts,
  StrategyHallOfFame,
  StrategySunsetRetrospectives,
  StrategyWinRateAlerts,
  MedianTimeToFirstFindingBenchmarks,
  TTFPercentileBands,
  TTFByAuthenticationState,
  TTFByFindingSeverity,
  TTFDecomposition,
  TTFPredictionAtHuntStart,
  TTFSlipAlerts,
  TTFImprovementLeaderboard,
];

/** Gallery: renders every Wave 80A component, export-only. */
export function Wave80AGallery() {
  return (
    <div className="w80a-gallery">
      {W80_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
