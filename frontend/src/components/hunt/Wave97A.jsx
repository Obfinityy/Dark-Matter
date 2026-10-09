/**
 * Wave97A.jsx — Infinity AI · Wave 97
 * 20 working React components for experiment assignment and rigor, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X97A from './wave97ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w97a-card">
      <div className="w97a-title">{title}</div>
      {note ? <div className="w97a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w97a-badge w97a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w97a-kv">
      <span className="w97a-k">{k}</span>
      <span className="w97a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w97a-bar-row">
      <span className="w97a-k">{label}</span>
      <div className="w97a-bar"><div className="w97a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w97a-v">{value}</span>
    </div>
  );
}

export function RandomizedHuntAssignment() {
  const data = [{ huntId: 'hunt-101' }, { huntId: 'hunt-102' }, { huntId: 'hunt-103' }, { huntId: 'hunt-104' }];
  const [seed, setSeed] = useState('infinity-ai');
  const v = X97A.assignRandomizedHunts(data.map(d => ({ ...d, seed })), ['control', 'deep-recon']);
  return (
    <Card title="RandomizedHuntAssignment" note="Idea 53841">
      <Kv k="Hunts" v={v.count} />
      <Kv k="Imbalance" v={v.imbalance} />
      <label className="w97a-field">Assignment seed
        <input type="text" value={seed} onChange={e => setSeed(e.target.value)} />
      </label>
      {v.perVariant.map(r => <Bar key={r.variant} label={r.variant} value={r.count} max={v.count || 1} />)}
    </Card>
  );
}
export function ExperimentPowerCalculators() {
  const [baseline, setBaseline] = useState(10);
  const v = X97A.calculateExperimentPower([{ experimentId: 'exp-recon-depth', baselineRate: baseline / 100, minDetectableEffect: 0.05, significanceLevel: 0.05, desiredPower: 0.8, availablePerArm: 700 }]);
  const row = v.rows[0];
  return (
    <Card title="ExperimentPowerCalculators" note="Idea 53842">
      <Kv k="Powered experiments" v={v.poweredCount} />
      <label className="w97a-field">Baseline rate ({baseline}%)
        <input type="range" min="2" max="40" value={baseline} onChange={e => setBaseline(Number(e.target.value))} />
      </label>
      <Kv k="Needed per arm" v={row.requiredPerArm} />
      <Kv k="Status" v={row.powered ? 'powered' : 'underpowered'} />
    </Card>
  );
}
export function VariantPerformanceDashboards() {
  const data = [
    { variant: 'control', hunts: 100, wins: 12, cost: 500 },
    { variant: 'deep-recon', hunts: 100, wins: 21, cost: 800 },
  ];
  const [leaderOnly, setLeaderOnly] = useState(false);
  const v = X97A.buildVariantPerformanceDashboards(data);
  const rows = leaderOnly ? v.rows.filter(r => r.isLeader) : v.rows;
  return (
    <Card title="VariantPerformanceDashboards" note="Idea 53843">
      <Kv k="Overall win rate" v={v.overallWinRate} />
      <button type="button" onClick={() => setLeaderOnly(f => !f)}>{leaderOnly ? 'Show all variants' : 'Show leader only'}</button>
      {rows.map(r => <Bar key={r.key} label={`${r.variant} #${r.rank}`} value={r.winRate} max={1} />)}
    </Card>
  );
}
export function ExperimentGuardrails() {
  const data = [
    { experimentId: 'exp-payload-rotation', variant: 'aggressive', relativeDrop: -0.45 },
    { experimentId: 'exp-payload-rotation', variant: 'steady', relativeDrop: -0.05 },
  ];
  const [thresholdPct, setThresholdPct] = useState(20);
  const v = X97A.evaluateExperimentGuardrails(data.map(d => ({ ...d, guardrailThreshold: thresholdPct / 100 })));
  return (
    <Card title="ExperimentGuardrails" note="Idea 53844">
      <Kv k="Paused" v={v.pausedCount} />
      <label className="w97a-field">Guardrail threshold ({thresholdPct}%)
        <input type="range" min="5" max="60" value={thresholdPct} onChange={e => setThresholdPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.variant} · ${r.status}`} v={r.relativeDrop} />)}
    </Card>
  );
}
export function MultiArmedBanditAllocation() {
  const data = [
    { variant: 'control', hunts: 100, wins: 20 },
    { variant: 'deep-recon', hunts: 100, wins: 50 },
  ];
  const [epsilonPct, setEpsilonPct] = useState(20);
  const v = X97A.allocateBanditTraffic(data, epsilonPct / 100);
  return (
    <Card title="MultiArmedBanditAllocation" note="Idea 53845">
      <Kv k="Best variant" v={v.best ? v.best.variant : 'none'} />
      <label className="w97a-field">Exploration ({epsilonPct}%)
        <input type="range" min="0" max="50" value={epsilonPct} onChange={e => setEpsilonPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.variant} value={r.allocatedShare} max={1} />)}
    </Card>
  );
}
export function ExperimentStratification() {
  const data = [
    { huntId: 'h1', targetClass: 'web', variant: 'control' }, { huntId: 'h2', targetClass: 'web', variant: 'control' },
    { huntId: 'h3', targetClass: 'web', variant: 'variant' }, { huntId: 'h4', targetClass: 'web', variant: 'variant' },
    { huntId: 'h5', targetClass: 'api', variant: 'control' }, { huntId: 'h6', targetClass: 'api', variant: 'control' },
    { huntId: 'h7', targetClass: 'api', variant: 'control' }, { huntId: 'h8', targetClass: 'api', variant: 'variant' },
  ];
  const [selected, setSelected] = useState('all');
  const v = X97A.stratifyExperiment(data);
  const rows = selected === 'all' ? v.rows : v.rows.filter(r => r.targetClass === selected);
  return (
    <Card title="ExperimentStratification" note="Idea 53846">
      <Kv k="Strata" v={v.stratumCount} />
      <label className="w97a-field">Target class
        <select value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="all">all classes</option>
          <option value="web">web</option>
          <option value="api">api</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.targetClass} control share`} v={r.controlShare} />)}
    </Card>
  );
}
export function SequentialTestingMethods() {
  const data = [
    { day: 1, controlHunts: 40, controlWins: 4, variantHunts: 40, variantWins: 8 },
    { day: 2, controlHunts: 100, controlWins: 10, variantHunts: 100, variantWins: 22 },
  ];
  const [boundary, setBoundary] = useState(1.96);
  const v = X97A.runSequentialTest(data, boundary);
  return (
    <Card title="SequentialTestingMethods" note="Idea 53847">
      <Kv k="Status" v={v.status} />
      <Kv k="Winner" v={v.winner || 'undecided'} />
      <label className="w97a-field">Stopping boundary (z = {boundary})
        <input type="range" min="1" max="3.5" step="0.05" value={boundary} onChange={e => setBoundary(Number(e.target.value))} />
      </label>
    </Card>
  );
}
export function ExperimentReplicationRequirements() {
  const data = [
    { experimentId: 'exp-recon-depth', originalEffect: 0.2, replicationEffect: 0.15, replicationHunts: 120 },
    { experimentId: 'exp-quick-win', originalEffect: 0.2, replicationEffect: -0.05, replicationHunts: 120 },
  ];
  const [required, setRequired] = useState(100);
  const v = X97A.checkExperimentReplication(data.map(d => ({ ...d, requiredHunts: required })));
  return (
    <Card title="ExperimentReplicationRequirements" note="Idea 53848">
      <Kv k="Replicated" v={v.replicatedCount} />
      <label className="w97a-field">Required fresh hunts
        <input type="number" min="0" max="300" value={required} onChange={e => setRequired(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.status} />)}
    </Card>
  );
}
export function NegativeResultPublishing() {
  const data = [
    { experimentId: 'exp-dead-end-auth', effectSize: -0.08, writeupReady: true, published: false },
    { experimentId: 'exp-stalled-idea', effectSize: -0.03, writeupReady: false, published: false },
    { experimentId: 'exp-published-win', effectSize: 0.12, writeupReady: true, published: true },
  ];
  const [queueOnly, setQueueOnly] = useState(false);
  const v = X97A.publishNegativeResults(data);
  const rows = queueOnly ? v.rows.filter(r => r.publishable) : v.rows;
  return (
    <Card title="NegativeResultPublishing" note="Idea 53849">
      <Kv k="Ready to publish" v={v.publishableCount} />
      <button type="button" onClick={() => setQueueOnly(f => !f)}>{queueOnly ? 'Show all results' : 'Show publish queue'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.action} />)}
    </Card>
  );
}
export function ExperimentIdeaBacklogs() {
  const data = [
    { ideaId: 'idea-deep-recon', title: 'Deeper recon first', impact: 9, effort: 3, confidence: 0.8 },
    { ideaId: 'idea-new-wordlist', title: 'Bigger wordlists', impact: 5, effort: 5, confidence: 0.5 },
    { ideaId: 'idea-chain-scoring', title: 'Chain-aware scoring', impact: 8, effort: 2, confidence: 0.9 },
  ];
  const [minScore, setMinScore] = useState(0);
  const v = X97A.manageExperimentBacklog(data);
  const rows = v.rows.filter(r => r.score >= minScore);
  return (
    <Card title="ExperimentIdeaBacklogs" note="Idea 53850">
      <Kv k="Ideas" v={v.count} />
      <label className="w97a-field">Minimum priority score ({minScore})
        <input type="range" min="0" max="4" step="0.2" value={minScore} onChange={e => setMinScore(Number(e.target.value))} />
      </label>
      {rows.map(r => <Kv key={r.key} k={`#${r.rank} ${r.ideaId}`} v={r.score} />)}
    </Card>
  );
}
export function CrossTeamExperimentCoordination() {
  const data = [
    { experimentId: 'exp-red-1', team: 'red', targetPool: 'pool-x', startDay: 1, endDay: 10 },
    { experimentId: 'exp-blue-1', team: 'blue', targetPool: 'pool-x', startDay: 5, endDay: 15 },
    { experimentId: 'exp-blue-2', team: 'blue', targetPool: 'pool-y', startDay: 5, endDay: 15 },
  ];
  const [pool, setPool] = useState('all');
  const v = X97A.coordinateCrossTeamExperiments(data);
  const rows = pool === 'all' ? v.rows : v.rows.filter(r => r.targetPool === pool);
  return (
    <Card title="CrossTeamExperimentCoordination" note="Idea 53851">
      <Kv k="Interfering" v={v.conflictedCount} />
      <label className="w97a-field">Target pool
        <select value={pool} onChange={e => setPool(e.target.value)}>
          <option value="all">all pools</option>
          <option value="pool-x">pool-x</option>
          <option value="pool-y">pool-y</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.experimentId} (${r.team})`} v={r.conflictsWith.join(', ') || 'clear'} />)}
    </Card>
  );
}
export function ExperimentEthicsReviews() {
  const data = [
    { experimentId: 'exp-aggressive-scan', targetRisk: 0.9, researcherRisk: 0.3, consentObtained: false, documented: true },
    { experimentId: 'exp-passive-recon', targetRisk: 0.2, researcherRisk: 0.1, consentObtained: true, documented: true },
  ];
  const [violationsOnly, setViolationsOnly] = useState(false);
  const v = X97A.reviewExperimentEthics(data);
  const rows = violationsOnly ? v.rows.filter(r => r.violation) : v.rows;
  return (
    <Card title="ExperimentEthicsReviews" note="Idea 53852">
      <Kv k="Violations" v={v.violationCount} />
      <button type="button" onClick={() => setViolationsOnly(f => !f)}>{violationsOnly ? 'Show all experiments' : 'Show violations only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.violation ? 'violation' : 'compliant'} />)}
    </Card>
  );
}
export function ExperimentBlinding() {
  const data = [
    { experimentId: 'exp-blind-recon', feasible: true, blinded: true, assessedBy: 'r-a' },
    { experimentId: 'exp-open-payloads', feasible: true, blinded: false, assessedBy: 'r-b' },
    { experimentId: 'exp-live-target', feasible: false, blinded: false, assessedBy: 'r-c' },
  ];
  const [feasibleOnly, setFeasibleOnly] = useState(false);
  const v = X97A.evaluateExperimentBlinding(data);
  const rows = feasibleOnly ? v.rows.filter(r => r.feasible) : v.rows;
  return (
    <Card title="ExperimentBlinding" note="Idea 53853">
      <Kv k="Blinding rate" v={v.blindingRate} />
      <label className="w97a-field">Feasible only
        <input type="checkbox" checked={feasibleOnly} onChange={e => setFeasibleOnly(e.target.checked)} />
      </label>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.status} />)}
    </Card>
  );
}
export function ExperimentDurationGuidelines() {
  const data = [
    { experimentId: 'exp-fast-peek', plannedDays: 3, maxDays: 90 },
    { experimentId: 'exp-standard', plannedDays: 30, maxDays: 90 },
    { experimentId: 'exp-marathon', plannedDays: 120, maxDays: 90 },
  ];
  const [minDays, setMinDays] = useState(14);
  const v = X97A.checkExperimentDurations(data.map(d => ({ ...d, minDays })));
  return (
    <Card title="ExperimentDurationGuidelines" note="Idea 53854">
      <Kv k="Compliant" v={v.compliantCount} />
      <label className="w97a-field">Minimum duration (days {minDays})
        <input type="range" min="1" max="60" value={minDays} onChange={e => setMinDays(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.status} />)}
    </Card>
  );
}
export function InteractionEffectDetection() {
  const data = [
    { pairId: 'pair-recon-scan', changeA: 'deep-recon', changeB: 'fast-scan', effectA: 0.1, effectB: 0.05 },
    { pairId: 'pair-auth-chain', changeA: 'auth-checks', changeB: 'chain-builder', effectA: 0.1, effectB: 0.1, combinedEffect: 0.19 },
  ];
  const [combinedPct, setCombinedPct] = useState(25);
  const v = X97A.detectInteractionEffects([{ ...data[0], combinedEffect: combinedPct / 100 }, data[1]]);
  return (
    <Card title="InteractionEffectDetection" note="Idea 53855">
      <Kv k="Interactions" v={v.interactionCount} />
      <label className="w97a-field">First pair combined effect ({combinedPct}%)
        <input type="range" min="0" max="40" value={combinedPct} onChange={e => setCombinedPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.pairId} v={`${r.kind} (${r.interactionEffect})`} />)}
    </Card>
  );
}
export function ExperimentRollbackPlans() {
  const data = [
    { experimentId: 'exp-ready', steps: 4, owner: 'r-a', tested: true },
    { experimentId: 'exp-unready', steps: 1, owner: '', tested: false },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X97A.checkRollbackPlans(data);
  const rows = readyOnly ? v.rows.filter(r => r.ready) : v.rows;
  return (
    <Card title="ExperimentRollbackPlans" note="Idea 53856">
      <Kv k="Launch-ready" v={v.readyCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all plans' : 'Show launch-ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.ready ? 'ready' : r.blockers.join(', ')} />)}
    </Card>
  );
}
export function WinningVariantRolloutPlaybooks() {
  const [stages, setStages] = useState(2);
  const data = [
    { variant: 'deep-recon', effect: 0.15, stagesCompleted: stages, totalStages: 4 },
    { variant: 'flat-scan', effect: -0.02, stagesCompleted: 1, totalStages: 4 },
  ];
  const v = X97A.planWinnerRollout(data);
  const row = v.rows.find(r => r.variant === 'deep-recon');
  return (
    <Card title="WinningVariantRolloutPlaybooks" note="Idea 53857">
      <Kv k="Rolling out" v={v.rollingCount} />
      <button type="button" onClick={() => setStages(s => Math.min(4, s + 1))}>Advance deep-recon stage</button>
      <Kv k="deep-recon progress" v={row.progress} />
      <Kv k="next stage" v={row.nextStage} />
    </Card>
  );
}
export function ExperimentCostTracking() {
  const data = [
    { experimentId: 'exp-recon-depth', huntsRun: 100, huntCost: 20, winnerValue: 4000 },
    { experimentId: 'exp-broad-scan', huntsRun: 200, huntCost: 20, opportunityPerHunt: 10, winnerValue: 1000 },
  ];
  const [opportunity, setOpportunity] = useState(5);
  const v = X97A.trackExperimentCosts([{ ...data[0], opportunityPerHunt: opportunity }, data[1]]);
  return (
    <Card title="ExperimentCostTracking" note="Idea 53858">
      <Kv k="Total cost" v={v.totalCost} />
      <label className="w97a-field">Recon-depth opportunity cost per hunt ({opportunity})
        <input type="range" min="0" max="20" value={opportunity} onChange={e => setOpportunity(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.experimentId} v={`net ${r.netValue}`} />)}
    </Card>
  );
}
export function ExperimentResultRepositories() {
  const data = [
    { experimentId: 'exp-recon-depth', title: 'Deep recon experiment', summary: 'Recon depth raised findings', outcome: 'winner', tags: ['recon'] },
    { experimentId: 'exp-auth-payloads', title: 'Auth payload test', summary: 'auth recon ordering', outcome: 'negative', tags: ['auth'] },
  ];
  const [query, setQuery] = useState('recon');
  const v = X97A.searchExperimentResults(data, query);
  return (
    <Card title="ExperimentResultRepositories" note="Idea 53859">
      <Kv k="Matches" v={v.count} />
      <label className="w97a-field">Repository search
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.title} v={`score ${r.score}`} />)}
    </Card>
  );
}
export function ExperimentPrioritizationScoring() {
  const data = [
    { ideaId: 'idea-recon-depth', expectedValue: 100, cost: 20, strategicFit: 0.9 },
    { ideaId: 'idea-scope-creep', expectedValue: 50, confidence: 0.5, cost: 10, strategicFit: 0.5 },
  ];
  const [confidencePct, setConfidencePct] = useState(80);
  const v = X97A.scoreExperimentPriorities([{ ...data[0], confidence: confidencePct / 100 }, data[1]]);
  return (
    <Card title="ExperimentPrioritizationScoring" note="Idea 53860">
      <Kv k="Qualified" v={v.qualifiedCount} />
      <label className="w97a-field">Recon-depth confidence ({confidencePct}%)
        <input type="range" min="10" max="100" value={confidencePct} onChange={e => setConfidencePct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`#${r.rank} ${r.ideaId}`} v={r.score} />)}
    </Card>
  );
}

export const WAVE97_A_COMPONENTS = [RandomizedHuntAssignment, ExperimentPowerCalculators, VariantPerformanceDashboards, ExperimentGuardrails, MultiArmedBanditAllocation, ExperimentStratification, SequentialTestingMethods, ExperimentReplicationRequirements, NegativeResultPublishing, ExperimentIdeaBacklogs, CrossTeamExperimentCoordination, ExperimentEthicsReviews, ExperimentBlinding, ExperimentDurationGuidelines, InteractionEffectDetection, ExperimentRollbackPlans, WinningVariantRolloutPlaybooks, ExperimentCostTracking, ExperimentResultRepositories, ExperimentPrioritizationScoring];

export function Wave97AGallery() {
  return (
    <div className="w97a-gallery">
      {WAVE97_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
