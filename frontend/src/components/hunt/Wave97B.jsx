/**
 * Wave97B.jsx — Infinity AI · Wave 97
 * 20 working React components for experiment analysis, validity, and lifecycle, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X97B from './wave97BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w97b-card">
      <div className="w97b-title">{title}</div>
      {note ? <div className="w97b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w97b-badge w97b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w97b-kv">
      <span className="w97b-k">{k}</span>
      <span className="w97b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w97b-bar-row">
      <span className="w97b-k">{label}</span>
      <div className="w97b-bar"><div className="w97b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w97b-v">{value}</span>
    </div>
  );
}

export function HeterogeneousTreatmentEffects() {
  const data = [
    { cohort: 'newcomers', variantEffect: 0.3, baselineEffect: 0.1, sampleSize: 50 },
    { cohort: 'veterans', variantEffect: 0.12, baselineEffect: 0.1, sampleSize: 40 },
    { cohort: 'weekend-hunters', variantEffect: 0.5, baselineEffect: 0.1, sampleSize: 5 },
  ];
  const [reliableOnly, setReliableOnly] = useState(false);
  const v = X97B.analyzeTreatmentEffects(data);
  const rows = reliableOnly ? v.rows.filter(r => r.reliable) : v.rows;
  return (
    <Card title="HeterogeneousTreatmentEffects" note="Idea 53861">
      <Kv k="Most responsive" v={v.mostResponsive ? v.mostResponsive.cohort : 'none'} />
      <button type="button" onClick={() => setReliableOnly(f => !f)}>{reliableOnly ? 'Show all cohorts' : 'Show reliable cohorts'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.cohort} lift`} v={r.lift} />)}
    </Card>
  );
}
export function ExperimentMonitoringAlerts() {
  const data = [
    { experimentId: 'exp-payloads', variant: 'aggressive', recentWinRate: 0.05, baselineWinRate: 0.2, variantSamples: 60 },
    { experimentId: 'exp-payloads', variant: 'steady', recentWinRate: 0.18, baselineWinRate: 0.2, variantSamples: 55 },
  ];
  const [recentPct, setRecentPct] = useState(5);
  const v = X97B.detectExperimentMonitoringAlerts([{ ...data[0], recentWinRate: recentPct / 100 }, data[1]]);
  return (
    <Card title="ExperimentMonitoringAlerts" note="Idea 53862">
      <Kv k="Alerts" v={v.alertCount} />
      <label className="w97b-field">Aggressive recent win rate ({recentPct}%)
        <input type="range" min="0" max="25" value={recentPct} onChange={e => setRecentPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.variant} · ${r.severity}`} v={r.dropRatio} />)}
    </Card>
  );
}
export function ExperimentDocumentationStandards() {
  const data = [
    { experimentId: 'exp-registered', hypothesis: 'Deeper recon raises findings', primaryMetric: 'confirmed findings per hunt', analysisPlan: 'two-proportion z test', startDay: 5, endDay: 20, registeredDay: 1, launchDay: 5 },
    { experimentId: 'exp-loose', hypothesis: 'Try a new order', primaryMetric: 'findings', analysisPlan: '', startDay: 5, endDay: 20, registeredDay: 6, launchDay: 5 },
  ];
  const [compliantOnly, setCompliantOnly] = useState(false);
  const v = X97B.validateExperimentDocumentation(data);
  const rows = compliantOnly ? v.rows.filter(r => r.compliant) : v.rows;
  return (
    <Card title="ExperimentDocumentationStandards" note="Idea 53863">
      <Kv k="Compliant" v={v.compliantCount} />
      <button type="button" onClick={() => setCompliantOnly(f => !f)}>{compliantOnly ? 'Show all experiments' : 'Show compliant only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={`${r.checksPassed}/5 checks`} />)}
    </Card>
  );
}
export function ExperimentPeerReview() {
  const data = [
    { experimentId: 'exp-reviewed', approvals: 3, rejections: 0, blockers: 0 },
    { experimentId: 'exp-blocked-design', approvals: 1, rejections: 1, blockers: 1 },
    { experimentId: 'exp-fresh-design', approvals: 0, rejections: 0, blockers: 0 },
  ];
  const [approvedOnly, setApprovedOnly] = useState(false);
  const v = X97B.reviewExperimentPeerDesigns(data);
  const rows = approvedOnly ? v.rows.filter(r => r.approved) : v.rows;
  return (
    <Card title="ExperimentPeerReview" note="Idea 53864">
      <Kv k="Approved" v={v.approvedCount} />
      <button type="button" onClick={() => setApprovedOnly(f => !f)}>{approvedOnly ? 'Show all designs' : 'Show approved only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.status} />)}
    </Card>
  );
}
export function LongitudinalExperimentTracking() {
  const data = [
    { experimentId: 'exp-long-winner', month: 1, effect: 0.2 }, { experimentId: 'exp-long-winner', month: 2, effect: 0.18 }, { experimentId: 'exp-long-winner', month: 3, effect: 0.16 },
    { experimentId: 'exp-fading', month: 1, effect: 0.25 }, { experimentId: 'exp-fading', month: 2, effect: 0.05 }, { experimentId: 'exp-fading', month: 3, effect: -0.02 },
  ];
  const [persistentOnly, setPersistentOnly] = useState(false);
  const v = X97B.trackLongitudinalExperiments(data);
  const rows = persistentOnly ? v.rows.filter(r => r.persistent) : v.rows;
  return (
    <Card title="LongitudinalExperimentTracking" note="Idea 53865">
      <Kv k="Persistent winners" v={v.persistentCount} />
      <button type="button" onClick={() => setPersistentOnly(f => !f)}>{persistentOnly ? 'Show all experiments' : 'Show persistent winners'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.experimentId} retention`} v={r.retention} />)}
    </Card>
  );
}
export function ExperimentContaminationChecks() {
  const data = [
    { huntId: 'h1', experimentId: 'exp-a', assignedVariant: 'control', exposedVariant: 'control' },
    { huntId: 'h2', experimentId: 'exp-a', assignedVariant: 'control', exposedVariant: 'variant' },
    { huntId: 'h3', experimentId: 'exp-a', assignedVariant: 'variant', exposedVariant: 'variant' },
    { huntId: 'h4', experimentId: 'exp-b', assignedVariant: 'control', exposedVariant: 'control' },
  ];
  const [thresholdPct, setThresholdPct] = useState(5);
  const v = X97B.checkExperimentContamination(data, thresholdPct / 100);
  return (
    <Card title="ExperimentContaminationChecks" note="Idea 53866">
      <Kv k="Contaminated hunts" v={v.contaminatedCount} />
      <label className="w97b-field">Flag threshold ({thresholdPct}%)
        <input type="range" min="1" max="50" value={thresholdPct} onChange={e => setThresholdPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} contamination`} v={r.contaminationRate} />)}
    </Card>
  );
}
export function ExperimentSampleRepresentativeness() {
  const data = [
    { segment: 'web', populationShare: 0.5, sampleShare: 0.48 },
    { segment: 'api', populationShare: 0.3, sampleShare: 0.42 },
    { segment: 'mobile', populationShare: 0.2, sampleShare: 0.1 },
  ];
  const [samplePct, setSamplePct] = useState(48);
  const v = X97B.checkSampleRepresentativeness([{ ...data[0], sampleShare: samplePct / 100 }, data[1], data[2]]);
  return (
    <Card title="ExperimentSampleRepresentativeness" note="Idea 53867">
      <Kv k="Score" v={v.representativenessScore} />
      <label className="w97b-field">Web sample share ({samplePct}%)
        <input type="range" min="20" max="80" value={samplePct} onChange={e => setSamplePct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.segment} deviation`} v={r.deviation} />)}
    </Card>
  );
}
export function ExperimentFatigueManagement() {
  const data = [
    { researcher: 'r-a', concurrentExperiments: 3, limit: 2 },
    { researcher: 'r-b', concurrentExperiments: 1, limit: 2 },
  ];
  const [load, setLoad] = useState(3);
  const v = X97B.manageExperimentFatigue([{ ...data[0], concurrentExperiments: load }, data[1]]);
  return (
    <Card title="ExperimentFatigueManagement" note="Idea 53868">
      <Kv k="Over limit" v={v.overLimitCount} />
      <label className="w97b-field">Researcher r-a concurrent experiments ({load})
        <input type="range" min="0" max="6" value={load} onChange={e => setLoad(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} utilization`} v={r.utilization} />)}
    </Card>
  );
}
export function ExperimentIncentiveAlignment() {
  const data = [
    { researcher: 'r-a', controlHunts: 50, variantHunts: 50, controlReward: 100, variantReward: 100 },
    { researcher: 'r-b', controlHunts: 60, variantHunts: 40, controlReward: 60, variantReward: 140 },
  ];
  const [reward, setReward] = useState(60);
  const v = X97B.alignExperimentIncentives([data[0], { ...data[1], controlReward: reward }]);
  return (
    <Card title="ExperimentIncentiveAlignment" note="Idea 53869">
      <Kv k="Misaligned" v={v.misalignedCount} />
      <label className="w97b-field">Researcher r-b control reward ({reward})
        <input type="range" min="0" max="200" step="5" value={reward} onChange={e => setReward(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.researcher} alignment`} v={r.misaligned ? 'misaligned' : 'aligned'} />)}
    </Card>
  );
}
export function ExperimentCommunicationTemplates() {
  const data = [
    { experimentId: 'exp-recon-depth', owner: 'r-a', outcome: 'winner' },
    { experimentId: 'exp-auth-order', owner: 'r-b', outcome: 'pending' },
  ];
  const [template, setTemplate] = useState('announcement');
  const v = X97B.renderExperimentCommunication(data, template);
  return (
    <Card title="ExperimentCommunicationTemplates" note="Idea 53870">
      <Kv k="Templates available" v={v.templatesAvailable} />
      <label className="w97b-field">Template
        <select value={template} onChange={e => setTemplate(e.target.value)}>
          <option value="announcement">announcement</option>
          <option value="results">results</option>
          <option value="guardrail-pause">guardrail-pause</option>
          <option value="wrap-up">wrap-up</option>
        </select>
      </label>
      {v.rows.map(r => <div key={r.key} className="w97b-note">{r.message}</div>)}
    </Card>
  );
}
export function ExperimentDataQualityGates() {
  const data = [
    { experimentId: 'exp-clean', totalRows: 1000, nullRate: 0.01, duplicateRate: 0.005, missingAssignmentRate: 0.002 },
    { experimentId: 'exp-messy', totalRows: 800, nullRate: 0.08, duplicateRate: 0, missingAssignmentRate: 0 },
  ];
  const [nullPct, setNullPct] = useState(8);
  const v = X97B.gateExperimentDataQuality([data[0], { ...data[1], nullRate: nullPct / 100 }]);
  return (
    <Card title="ExperimentDataQualityGates" note="Idea 53871">
      <Kv k="Passed gates" v={v.passedCount} />
      <label className="w97b-field">Messy experiment null rate ({nullPct}%)
        <input type="range" min="0" max="20" value={nullPct} onChange={e => setNullPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.passed ? 'passed' : `blocked: ${r.failures.join(', ')}`} />)}
    </Card>
  );
}
export function BayesianExperimentAnalysis() {
  const [wins, setWins] = useState(60);
  const data = [
    { variant: 'deep-recon', wins, losses: 100 - wins },
    { variant: 'control', wins: 40, losses: 60 },
  ];
  const v = X97B.analyzeBayesianExperiment(data);
  return (
    <Card title="BayesianExperimentAnalysis" note="Idea 53872">
      <Kv k="Recommended" v={v.recommended ? v.recommended.variant : 'none'} />
      <label className="w97b-field">Deep-recon wins out of 100 ({wins})
        <input type="range" min="30" max="80" value={wins} onChange={e => setWins(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.variant} best probability`} v={r.probBest} />)}
    </Card>
  );
}
export function ExperimentSegmentAnalysis() {
  const data = [
    { segment: 'web', dimension: 'target-class', variantEffect: 0.2, hunts: 80 },
    { segment: 'api', dimension: 'target-class', variantEffect: 0.05, hunts: 60 },
    { segment: 'senior', dimension: 'researcher-tenure', variantEffect: 0.3, hunts: 20 },
    { segment: 'junior', dimension: 'researcher-tenure', variantEffect: 0.1, hunts: 90 },
  ];
  const [dimension, setDimension] = useState('all');
  const v = X97B.analyzeExperimentSegments(data);
  const rows = dimension === 'all' ? v.rows : v.rows.filter(r => r.dimension === dimension);
  return (
    <Card title="ExperimentSegmentAnalysis" note="Idea 53873">
      <Kv k="Strongest segment" v={v.strongest ? v.strongest.segment : 'none'} />
      <label className="w97b-field">Dimension
        <select value={dimension} onChange={e => setDimension(e.target.value)}>
          <option value="all">all dimensions</option>
          <option value="target-class">target-class</option>
          <option value="researcher-tenure">researcher-tenure</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.segment} effect`} v={r.variantEffect} />)}
    </Card>
  );
}
export function ExperimentExternalValidity() {
  const data = [
    { experimentId: 'exp-lab-realistic', labRealismScore: 0.9, conditionMatchScore: 0.8, targetRepresentativeness: 0.85 },
    { experimentId: 'exp-synthetic', labRealismScore: 0.4, conditionMatchScore: 0.5, targetRepresentativeness: 0.3 },
  ];
  const [realismPct, setRealismPct] = useState(40);
  const v = X97B.assessExternalValidity([data[0], { ...data[1], labRealismScore: realismPct / 100 }]);
  return (
    <Card title="ExperimentExternalValidity" note="Idea 53874">
      <Kv k="Generalizes" v={v.generalizesCount} />
      <label className="w97b-field">Synthetic experiment realism ({realismPct}%)
        <input type="range" min="0" max="100" value={realismPct} onChange={e => setRealismPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} validity`} v={r.validity} />)}
    </Card>
  );
}
export function ExperimentRegistry() {
  const data = [
    { experimentId: 'exp-planned-1', status: 'planned', team: 'red', startDay: 20 },
    { experimentId: 'exp-running-1', status: 'running', team: 'blue', startDay: 3 },
    { experimentId: 'exp-running-2', status: 'running', team: 'red', startDay: 5 },
    { experimentId: 'exp-done-1', status: 'completed', team: 'blue', startDay: 1 },
    { experimentId: 'exp-killed-1', status: 'killed', team: 'red', startDay: 2 },
  ];
  const [status, setStatus] = useState('all');
  const v = X97B.buildExperimentRegistry(data);
  const rows = status === 'all' ? v.rows : v.rows.filter(r => r.status === status);
  return (
    <Card title="ExperimentRegistry" note="Idea 53875">
      <Kv k="Running now" v={v.activeCount} />
      <label className="w97b-field">Status
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">all statuses</option>
          <option value="planned">planned</option>
          <option value="running">running</option>
          <option value="completed">completed</option>
          <option value="killed">killed</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.experimentId} (${r.team})`} v={r.status} />)}
    </Card>
  );
}
export function ExperimentReproducibilityPackages() {
  const data = [
    { experimentId: 'exp-sealed', configHash: 'c0ffee42', seedDocumented: true, dataSnapshot: 'snap-2026-10', codeVersion: '1.4.0' },
    { experimentId: 'exp-partial', configHash: 'bead1984', seedDocumented: false, dataSnapshot: '', codeVersion: '1.4.0' },
  ];
  const [sealed, setSealed] = useState(false);
  const v = X97B.packageExperimentReproducibility([data[0], { ...data[1], seedDocumented: sealed, dataSnapshot: sealed ? 'snap-2026-10' : '' }]);
  return (
    <Card title="ExperimentReproducibilityPackages" note="Idea 53876">
      <Kv k="Reproducible" v={v.reproducibleCount} />
      <label className="w97b-field">Capture partial package seed and snapshot
        <input type="checkbox" checked={sealed} onChange={e => setSealed(e.target.checked)} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} completeness`} v={r.completeness} />)}
    </Card>
  );
}
export function ExperimentKillCriteria() {
  const data = [
    { experimentId: 'exp-overrun', day: 45, hunts: 300, currentEffect: 0.01, minEffect: 0.05, maxDays: 30, budgetUsedPct: 0.6 },
    { experimentId: 'exp-healthy', day: 10, hunts: 50, currentEffect: 0.2, minEffect: 0.05, maxDays: 30, budgetUsedPct: 0.3 },
    { experimentId: 'exp-spent', day: 20, hunts: 80, currentEffect: 0.08, minEffect: 0.05, maxDays: 60, budgetUsedPct: 1 },
  ];
  const [day, setDay] = useState(10);
  const v = X97B.evaluateExperimentKillCriteria([data[0], { ...data[1], day }, data[2]]);
  return (
    <Card title="ExperimentKillCriteria" note="Idea 53877">
      <Kv k="Stop now" v={v.killCount} />
      <label className="w97b-field">Healthy experiment current day ({day})
        <input type="range" min="1" max="60" value={day} onChange={e => setDay(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.killRecommended ? `kill: ${r.reasons.join(', ')}` : 'continue'} />)}
    </Card>
  );
}
export function ExperimentWinnerAdoptionTracking() {
  const data = [
    { variant: 'deep-recon', adoptedTeams: 8, totalTeams: 10, daysSinceWin: 12, postAdoptionEffect: 0.18 },
    { variant: 'niche-payloads', adoptedTeams: 2, totalTeams: 10, daysSinceWin: 90, postAdoptionEffect: 0.1 },
    { variant: 'mid-rollout', adoptedTeams: 5, totalTeams: 10, daysSinceWin: 20, postAdoptionEffect: 0.14 },
  ];
  const [days, setDays] = useState(90);
  const v = X97B.trackWinnerAdoption([data[0], { ...data[1], daysSinceWin: days }, data[2]]);
  return (
    <Card title="ExperimentWinnerAdoptionTracking" note="Idea 53878">
      <Kv k="Stalled" v={v.stalledCount} />
      <label className="w97b-field">Niche-payloads days since win ({days})
        <input type="range" min="10" max="180" value={days} onChange={e => setDays(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.variant} adoption`} v={`${r.adoptionRate} · ${r.status}`} />)}
    </Card>
  );
}
export function ExperimentCalendar() {
  const data = [
    { experimentId: 'exp-a', team: 'red', startDay: 1, endDay: 10, targetPool: 'pool-x' },
    { experimentId: 'exp-b', team: 'blue', startDay: 5, endDay: 12, targetPool: 'pool-x' },
    { experimentId: 'exp-c', team: 'red', startDay: 20, endDay: 25, targetPool: 'pool-x' },
  ];
  const [startB, setStartB] = useState(5);
  const v = X97B.buildExperimentCalendar([data[0], { ...data[1], startDay: startB }, data[2]]);
  return (
    <Card title="ExperimentCalendar" note="Idea 53879">
      <Kv k="Busy days" v={v.busyDays} />
      <label className="w97b-field">Experiment B start day ({startB})
        <input type="range" min="1" max="30" value={startB} onChange={e => setStartB(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} days ${r.startDay}-${r.endDay}`} v={r.conflictsWith.join(', ') || 'clear'} />)}
    </Card>
  );
}
export function ExperimentRetrospectiveTemplates() {
  const data = [
    { experimentId: 'exp-retro-full', outcome: 'winner', sectionsFilled: 5, followUps: 3 },
    { experimentId: 'exp-retro-thin', outcome: 'negative', sectionsFilled: 2, followUps: 0 },
  ];
  const [sections, setSections] = useState(2);
  const v = X97B.applyRetrospectiveTemplates([data[0], { ...data[1], sectionsFilled: sections }]);
  return (
    <Card title="ExperimentRetrospectiveTemplates" note="Idea 53880">
      <Kv k="Thorough" v={v.thoroughCount} />
      <label className="w97b-field">Thin retrospective sections filled ({sections}/5)
        <input type="range" min="0" max="5" value={sections} onChange={e => setSections(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} completeness`} v={r.completeness} />)}
      <div className="w97b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE97_B_COMPONENTS = [HeterogeneousTreatmentEffects, ExperimentMonitoringAlerts, ExperimentDocumentationStandards, ExperimentPeerReview, LongitudinalExperimentTracking, ExperimentContaminationChecks, ExperimentSampleRepresentativeness, ExperimentFatigueManagement, ExperimentIncentiveAlignment, ExperimentCommunicationTemplates, ExperimentDataQualityGates, BayesianExperimentAnalysis, ExperimentSegmentAnalysis, ExperimentExternalValidity, ExperimentRegistry, ExperimentReproducibilityPackages, ExperimentKillCriteria, ExperimentWinnerAdoptionTracking, ExperimentCalendar, ExperimentRetrospectiveTemplates];

export function Wave97BGallery() {
  return (
    <div className="w97b-gallery">
      {WAVE97_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
