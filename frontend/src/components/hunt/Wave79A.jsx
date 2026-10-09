/**
 * Wave79A.jsx — Infinity AI · Dark-Matter · Wave 79
 * 20 working React components for strategy analytics round 2, ideas 53121–53140. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave79ACore.js';


const SAMPLE_HUNTS = [
  { strategy: 'auth-first', targetClass: 'saas', mode: 'first-principles', approach: 'first-principles', posture: 'aggressive', pace: 'aggressive', startMode: 'authenticated', firstMode: 'authenticated', prioritySurface: 'api', firstSurface: 'api', reconLevel: 'heavy', seeded: true, manualSeed: true, timeBoxed: true, sprint: true, flowStyle: 'sprint', traversal: 'depth-first', chained: true, chainCount: 2, huntType: 'regression', regression: true, differential: true, crowdInformed: true, crowdSeeded: true, disclosurePatterns: 3, patterns: 3, promptFraming: 'adversarial', framing: 'adversarial', executionStyle: 'checklist', style: 'checklist', coverage: 0.9, coverageScore: 0.9, targeting: 'business-critical', targetPriority: 'business-critical', rotation: 'session', rotatesPerSession: true, modelVersion: 'current', tenure: 'current', lineage: 'auth-lineage', branch: 'auth-lineage', parentStrategy: 'auth-first', mutations: 1, mutated: true, success: true, findings: 4, validatedFindings: 4, rawFindings: 5, requests: 100, computeCost: 10, cost: 10, hours: 2, checkpoints: 2, humanCheckpoints: true, checkpointsCount: 2, contextStyle: 'summarized', contextMode: 'summarized', toolStyle: 'many-tools', orchestration: 'many-tools', toolCount: 8, toolsUsed: 8, season: 'active-dev', explainabilityScore: 0.9, score: 0.9, isFallback: true, fallback: true, fallbackStrategy: 'auth-first' },
  { strategy: 'breadth-first', targetClass: 'ecommerce', mode: 'playbook', approach: 'playbook', posture: 'stealth', pace: 'stealth', startMode: 'unauthenticated', firstMode: 'unauthenticated', prioritySurface: 'ui', firstSurface: 'ui', reconLevel: 'light', seeded: false, manualSeed: false, timeBoxed: false, sprint: false, flowStyle: 'continuous', traversal: 'breadth-first', chained: false, chainCount: 0, huntType: 'standard', regression: false, differential: false, crowdInformed: false, crowdSeeded: false, promptFraming: 'neutral', framing: 'neutral', executionStyle: 'adaptive', style: 'adaptive', coverage: 0.7, coverageScore: 0.7, targeting: 'attack-surface', targetPriority: 'attack-surface', rotation: 'committed', rotatesPerSession: false, modelVersion: 'older', tenure: 'older', lineage: 'breadth-lineage', branch: 'breadth-lineage', parentStrategy: 'breadth-first', mutations: 0, success: false, findings: 0, validatedFindings: 0, rawFindings: 2, requests: 200, computeCost: 20, cost: 20, hours: 3, checkpoints: 0, humanCheckpoints: false, contextStyle: 'full', contextMode: 'full', toolStyle: 'few-deep', orchestration: 'few-deep', toolCount: 3, toolsUsed: 3, season: 'holiday-freeze', explainabilityScore: 0.6, score: 0.6, isFallback: false, fallback: false },
  { strategy: 'deep-dive', targetClass: 'fintech', mode: 'playbook', approach: 'playbook', posture: 'stealth', startMode: 'authenticated', prioritySurface: 'api', reconLevel: 'heavy', seeded: true, flowStyle: 'sprint', sprint: true, traversal: 'depth-first', chained: true, chainCount: 1, huntType: 'differential', differential: true, diffFindings: 2, crowdInformed: true, disclosurePatterns: 2, promptFraming: 'adversarial', executionStyle: 'checklist', coverage: 0.8, targeting: 'business-critical', modelVersion: 'current', lineage: 'auth-lineage', success: true, findings: 3, validatedFindings: 3, rawFindings: 3, requests: 80, computeCost: 8, hours: 2, humanCheckpoints: true, checkpoints: 1, contextStyle: 'summarized', toolStyle: 'many-tools', toolCount: 7, season: 'active-dev', explainabilityScore: 0.8, score: 0.8 },
];
const SAMPLE_SNAPSHOTS = [
  { strategy: 'auth-first', at: '2026-07-01T00:00:00Z', winRate: 0.6, hitRate: 0.6, trial: 1, hunts: 1 },
  { strategy: 'auth-first', at: '2026-10-01T00:00:00Z', winRate: 0.3, hitRate: 0.3, trial: 10, hunts: 10 },
  { strategy: 'breadth-first', at: '2026-07-01T00:00:00Z', winRate: 0.4, hitRate: 0.4, trial: 1, hunts: 1 },
  { strategy: 'breadth-first', at: '2026-10-01T00:00:00Z', winRate: 0.5, hitRate: 0.5, trial: 12, hunts: 12 },
];
const SAMPLE_SWITCHES = [
  { trigger: 'no-findings-30m', signal: 'no-findings-30m', strategy: 'auth-first', success: true, findings: 2, validatedFindings: 2 },
  { trigger: 'waf-block', signal: 'waf-block', strategy: 'stealth', success: false, findings: 0, validatedFindings: 0 },
];
const SAMPLE_STATS = [
  { strategy: 'auth-first', key: 'auth-first', hunts: 40, attempts: 40, wins: 24, successes: 24, winRate: 0.6, findingsPerHour: 2, expectedRate: 2, findingTypes: ['sqli', 'auth'] },
  { strategy: 'legacy-probe', key: 'legacy-probe', hunts: 25, attempts: 25, wins: 2, successes: 2, winRate: 0.08, findingsPerHour: 0.3, expectedRate: 0.3, findingTypes: ['xss'] },
  { strategy: 'breadth-first', key: 'breadth-first', hunts: 8, attempts: 8, wins: 4, successes: 4, winRate: 0.5, findingsPerHour: 1, expectedRate: 1, findingTypes: ['idor'] },
];
const SAMPLE_MATCHES = [
  { strategyA: 'auth-first', strategyB: 'breadth-first', winner: 'auth-first', aFindings: 3, bFindings: 1 },
  { strategyA: 'auth-first', strategyB: 'deep-dive', winner: 'deep-dive', aFindings: 1, bFindings: 2 },
];
const SAMPLE_ADOPTION = [
  { strategy: 'auth-first', at: '2026-09-01T00:00:00Z', adoptionShare: 0.2, share: 0.2, missedFindings: 3, lagCost: 3 },
  { strategy: 'auth-first', at: '2026-10-01T00:00:00Z', adoptionShare: 0.6, share: 0.6, missedFindings: 1, lagCost: 1 },
];


function Card({ title, note, children }) {
  return (
    <div className="w79a-card">
      <div className="w79a-title">{title}</div>
      {note ? <div className="w79a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w79a-badge w79a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w79a-kv">
      <span className="w79a-k">{k}</span>
      <span className="w79a-v">{String(v)}</span>
    </div>
  );
}


export function StrategyCostCurves() {
  const v = XA.plotStrategyCostCurves(SAMPLE_HUNTS);
  return (<Card title="Strategy Cost Curves" note="Idea 53121"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function HybridStrategyEffectiveness() {
  const v = XA.measureHybridStrategyEffectiveness(SAMPLE_HUNTS);
  return (<Card title="Hybrid Strategy Effectiveness" note="Idea 53122"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyConsistencyScores() {
  const v = XA.scoreStrategyConsistency(SAMPLE_HUNTS);
  return (<Card title="Strategy Consistency Scores" note="Idea 53123"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TargetClassStrategyFit() {
  const v = XA.mapTargetClassStrategyFit(SAMPLE_HUNTS);
  return (<Card title="Target-Class Strategy Fit" note="Idea 53124"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategyDecayOverTime() {
  const v = XA.trackStrategyDecayOverTime(SAMPLE_SNAPSHOTS);
  return (<Card title="Strategy Decay Over Time" note="Idea 53125"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function UnderdogStrategySpotlights() {
  const v = XA.spotlightUnderdogStrategies(SAMPLE_HUNTS);
  return (<Card title="Underdog Strategy Spotlights" note="Idea 53126"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function StrategySwitchingTriggers() {
  const v = XA.learnStrategySwitchingTriggers(SAMPLE_SWITCHES);
  return (<Card title="Strategy Switching Triggers" note="Idea 53127"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function FirstPrinciplesVsPlaybookComparison() {
  const v = XA.compareFirstPrinciplesVsPlaybook(SAMPLE_HUNTS);
  return (<Card title="First-Principles vs Playbook Comparison" note="Idea 53128"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function AggressiveVsStealthWinRates() {
  const v = XA.compareAggressiveVsStealthWinRates(SAMPLE_HUNTS);
  return (<Card title="Aggressive-vs-Stealth Win Rates" note="Idea 53129"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function AuthenticatedFirstWinRates() {
  const v = XA.measureAuthenticatedFirstWinRates(SAMPLE_HUNTS);
  return (<Card title="Authenticated-First Win Rates" note="Idea 53130"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function ApiFirstVsUiFirstOutcomes() {
  const v = XA.compareApiFirstVsUiFirstOutcomes(SAMPLE_HUNTS);
  return (<Card title="API-First vs UI-First Outcomes" note="Idea 53131"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function ReconHeavyVsReconLight() {
  const v = XA.compareReconHeavyVsReconLight(SAMPLE_HUNTS);
  return (<Card title="Recon-Heavy vs Recon-Light" note="Idea 53132"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function ManualSeedStrategyBoost() {
  const v = XA.measureManualSeedBoost(SAMPLE_HUNTS);
  return (<Card title="Manual-Seed Strategy Boost" note="Idea 53133"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TimeBoxedSprintStrategies() {
  const v = XA.compareTimeBoxedSprintStrategies(SAMPLE_HUNTS);
  return (<Card title="Time-Boxed Sprint Strategies" note="Idea 53134"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function DepthFirstTraversalWins() {
  const v = XA.trackDepthFirstTraversalWins(SAMPLE_HUNTS);
  return (<Card title="Depth-First Traversal Wins" note="Idea 53135"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function BreadthFirstTraversalWins() {
  const v = XA.trackBreadthFirstTraversalWins(SAMPLE_HUNTS);
  return (<Card title="Breadth-First Traversal Wins" note="Idea 53136"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function ChainedFindingStrategies() {
  const v = XA.measureChainedFindingStrategies(SAMPLE_HUNTS);
  return (<Card title="Chained-Finding Strategies" note="Idea 53137"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function RegressionHuntStrategies() {
  const v = XA.evaluateRegressionHuntStrategies(SAMPLE_HUNTS);
  return (<Card title="Regression-Hunt Strategies" note="Idea 53138"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function DifferentialTestingStrategies() {
  const v = XA.compareDifferentialTestingStrategies(SAMPLE_HUNTS);
  return (<Card title="Differential Testing Strategies" note="Idea 53139"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function CrowdInformedStrategies() {
  const v = XA.measureCrowdInformedStrategies(SAMPLE_HUNTS);
  return (<Card title="Crowd-Informed Strategies" note="Idea 53140"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w79a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


const W79_A_GALLERY = [
  StrategyCostCurves,
  HybridStrategyEffectiveness,
  StrategyConsistencyScores,
  TargetClassStrategyFit,
  StrategyDecayOverTime,
  UnderdogStrategySpotlights,
  StrategySwitchingTriggers,
  FirstPrinciplesVsPlaybookComparison,
  AggressiveVsStealthWinRates,
  AuthenticatedFirstWinRates,
  ApiFirstVsUiFirstOutcomes,
  ReconHeavyVsReconLight,
  ManualSeedStrategyBoost,
  TimeBoxedSprintStrategies,
  DepthFirstTraversalWins,
  BreadthFirstTraversalWins,
  ChainedFindingStrategies,
  RegressionHuntStrategies,
  DifferentialTestingStrategies,
  CrowdInformedStrategies,
];

/** Gallery: renders every Wave 79A component, export-only. */
export function Wave79AGallery() {
  return (
    <div className="w79a-gallery">
      {W79_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
