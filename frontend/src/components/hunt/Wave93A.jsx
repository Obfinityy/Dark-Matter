/**
 * Wave93A.jsx — Infinity AI · Wave 93
 * 20 working React components for prompt intelligence round 2 (part A), export-only module:
 * components are not mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as X93A from './wave93ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w93a-card">
      <div className="w93a-title">{title}</div>
      {note ? <div className="w93a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w93a-badge w93a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w93a-kv">
      <span className="w93a-k">{k}</span>
      <span className="w93a-v">{String(v)}</span>
    </div>
  );
}

export function PromptDriftDetection() {
  const v = X93A.detectPromptDrift([{ promptId: 'prompt-a', currentScore: 0.5, baselineScore: 0.9 }, { promptId: 'prompt-b', currentScore: 0.85, baselineScore: 0.9 }]);
  return (<Card title="PromptDriftDetection" note="Idea 53681"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function ContextWindowPromptOptimization() {
  const v = X93A.optimizeContextWindowPrompts([{ promptId: 'prompt-a', contextWindow: 8000, candidates: 10, selected: 8 }, { promptId: 'prompt-b', contextWindow: 4000, candidates: 10, selected: 4 }]);
  return (<Card title="ContextWindowPromptOptimization" note="Idea 53682"><Kv k="Records" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptLengthVsPerformanceCurves() {
  const v = X93A.curvePromptLengthPerformance([{ promptId: 'prompt-a', lengthChars: 300, runs: 20, wins: 14 }, { promptId: 'prompt-b', lengthChars: 1200, runs: 20, wins: 10 }]);
  return (<Card title="PromptLengthVsPerformanceCurves" note="Idea 53683"><Kv k="Buckets" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FewShotExampleCuration() {
  const v = X93A.curateFewShotExamples([{ promptId: 'prompt-a', exampleId: 'ex-1', runs: 20, wins: 16, baselineWins: 10 }, { promptId: 'prompt-b', exampleId: 'ex-2', runs: 20, wins: 10, baselineWins: 10 }]);
  return (<Card title="FewShotExampleCuration" note="Idea 53684"><Kv k="Examples" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function NegativeExampleMining() {
  const v = X93A.mineNegativeExamples([{ promptId: 'prompt-a', exampleId: 'neg-1', failuresAvoided: 8, totalFailures: 10 }, { promptId: 'prompt-b', exampleId: 'neg-2', failuresAvoided: 2, totalFailures: 10 }]);
  return (<Card title="NegativeExampleMining" note="Idea 53685"><Kv k="Examples" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptInstructionClarityScores() {
  const v = X93A.scorePromptInstructionClarity([{ promptId: 'prompt-a', runs: 20, consistentInterpretations: 18 }, { promptId: 'prompt-b', runs: 20, consistentInterpretations: 10 }]);
  return (<Card title="PromptInstructionClarityScores" note="Idea 53686"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function RoleFramingExperiments() {
  const v = X93A.experimentRoleFraming([{ promptId: 'prompt-a', role: 'attacker', runs: 20, wins: 15 }, { promptId: 'prompt-a', role: 'auditor', runs: 20, wins: 8 }]);
  return (<Card title="RoleFramingExperiments" note="Idea 53687"><Kv k="Roles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function ChainOfThoughtPromptTuning() {
  const v = X93A.tuneChainOfThoughtPrompts([{ promptId: 'prompt-a', traces: 20, winningTraces: 15 }, { promptId: 'prompt-b', traces: 20, winningTraces: 6 }]);
  return (<Card title="ChainOfThoughtPromptTuning" note="Idea 53688"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptHallucinationGuards() {
  const v = X93A.guardPromptHallucinations([{ promptId: 'prompt-a', runs: 100, hallucinations: 5 }, { promptId: 'prompt-b', runs: 100, hallucinations: 25 }]);
  return (<Card title="PromptHallucinationGuards" note="Idea 53689"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function ToolUsePromptOptimization() {
  const v = X93A.optimizeToolUsePrompts([{ promptId: 'prompt-a', toolCalls: 50, successfulCalls: 45 }, { promptId: 'prompt-b', toolCalls: 50, successfulCalls: 25 }]);
  return (<Card title="ToolUsePromptOptimization" note="Idea 53690"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function MultiTurnPromptStrategies() {
  const v = X93A.strategizeMultiTurnPrompts([{ promptId: 'prompt-a', avgTurns: 8, runs: 20, wins: 15 }, { promptId: 'prompt-b', avgTurns: 2, runs: 20, wins: 6 }]);
  return (<Card title="MultiTurnPromptStrategies" note="Idea 53691"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptPersonalizationPerModel() {
  const v = X93A.personalizePromptsPerModel([{ promptId: 'prompt-a', model: 'model-x', runs: 20, wins: 16 }, { promptId: 'prompt-a', model: 'model-y', runs: 20, wins: 8 }]);
  return (<Card title="PromptPersonalizationPerModel" note="Idea 53692"><Kv k="Variants" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptTokenEfficiency() {
  const v = X93A.measurePromptTokenEfficiency([{ promptId: 'prompt-a', tokens: 2000, wins: 15 }, { promptId: 'prompt-b', tokens: 2000, wins: 4 }]);
  return (<Card title="PromptTokenEfficiency" note="Idea 53693"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptSafetyCalibration() {
  const v = X93A.calibratePromptSafety([{ promptId: 'prompt-a', legitimateActions: 100, blockedLegitimate: 5 }, { promptId: 'prompt-b', legitimateActions: 100, blockedLegitimate: 30 }]);
  return (<Card title="PromptSafetyCalibration" note="Idea 53694"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptLocalizationEffects() {
  const v = X93A.measurePromptLocalizationEffects([{ promptId: 'prompt-a', language: 'hi', runs: 20, wins: 15 }, { promptId: 'prompt-a', language: 'en', runs: 20, wins: 10 }]);
  return (<Card title="PromptLocalizationEffects" note="Idea 53695"><Kv k="Records" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptTemperatureTuning() {
  const v = X93A.tunePromptTemperature([{ promptId: 'prompt-a', phase: 'recon', temperature: 0.2, runs: 20, wins: 15 }, { promptId: 'prompt-a', phase: 'exploit', temperature: 0.9, runs: 20, wins: 8 }]);
  return (<Card title="PromptTemperatureTuning" note="Idea 53696"><Kv k="Phases" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptFallbackChains() {
  const v = X93A.chainPromptFallbacks([{ promptId: 'prompt-a', degenerateRuns: 20, fallbackWins: 14 }, { promptId: 'prompt-b', degenerateRuns: 20, fallbackWins: 5 }]);
  return (<Card title="PromptFallbackChains" note="Idea 53697"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptInjectionResistance() {
  const v = X93A.resistPromptInjection([{ promptId: 'prompt-a', attacks: 50, blocked: 45 }, { promptId: 'prompt-b', attacks: 50, blocked: 20 }]);
  return (<Card title="PromptInjectionResistance" note="Idea 53698"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptConsistencyChecks() {
  const v = X93A.checkPromptConsistency([{ promptId: 'prompt-a', runs: 20, consistentRuns: 18 }, { promptId: 'prompt-b', runs: 20, consistentRuns: 10 }]);
  return (<Card title="PromptConsistencyChecks" note="Idea 53699"><Kv k="Prompts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PromptBiasAudits() {
  const v = X93A.auditPromptBias([{ promptId: 'prompt-a', focusClass: 'sqli', hunts: 30, totalHunts: 40 }, { promptId: 'prompt-a', focusClass: 'xss', hunts: 8, totalHunts: 40 }]);
  return (<Card title="PromptBiasAudits" note="Idea 53700"><Kv k="Classes" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w93a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export const WAVE93_A_COMPONENTS = [PromptDriftDetection, ContextWindowPromptOptimization, PromptLengthVsPerformanceCurves, FewShotExampleCuration, NegativeExampleMining, PromptInstructionClarityScores, RoleFramingExperiments, ChainOfThoughtPromptTuning, PromptHallucinationGuards, ToolUsePromptOptimization, MultiTurnPromptStrategies, PromptPersonalizationPerModel, PromptTokenEfficiency, PromptSafetyCalibration, PromptLocalizationEffects, PromptTemperatureTuning, PromptFallbackChains, PromptInjectionResistance, PromptConsistencyChecks, PromptBiasAudits];

export function Wave93AGallery() {
  return (
    <div className="w93a-gallery">
      {WAVE93_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
