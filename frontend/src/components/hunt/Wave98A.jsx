/**
 * Wave98A.jsx — Infinity AI · Wave 98
 * 14 working React components for experiment governance and knowledge, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X98A from './wave98ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w98a-card">
      <div className="w98a-title">{title}</div>
      {note ? <div className="w98a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w98a-badge w98a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w98a-kv">
      <span className="w98a-k">{k}</span>
      <span className="w98a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w98a-bar-row">
      <span className="w98a-k">{label}</span>
      <div className="w98a-bar"><div className="w98a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w98a-v">{value}</span>
    </div>
  );
}

export function ExperimentTooling() {
  const data = [
    { experimentId: 'exp-simple-ab', setupSteps: 5, requiredSteps: 5, selfServiceEligible: true, needsSupport: false },
    { experimentId: 'exp-complex-targeting', setupSteps: 3, requiredSteps: 6, selfServiceEligible: false, needsSupport: true },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X98A.buildExperimentTooling(data);
  const rows = readyOnly ? v.rows.filter(r => r.launchable) : v.rows;
  return (
    <Card title="ExperimentTooling" note="Idea 53881">
      <Kv k="Self-service ready" v={v.readyCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all experiments' : 'Show ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.status} />)}
    </Card>
  );
}
export function ExperimentReviewBoards() {
  const data = [
    { experimentId: 'exp-high-risk-scan', riskScore: 0.85, cost: 4000, approvals: 1, requiredApprovals: 2 },
    { experimentId: 'exp-routine-copy-test', riskScore: 0.2, cost: 300, approvals: 0, requiredApprovals: 2 },
  ];
  const [boardOnly, setBoardOnly] = useState(false);
  const v = X98A.routeExperimentReviewBoards(data);
  const rows = boardOnly ? v.rows.filter(r => r.needsBoard) : v.rows;
  return (
    <Card title="ExperimentReviewBoards" note="Idea 53882">
      <Kv k="Routed to board" v={v.boardCount} />
      <button type="button" onClick={() => setBoardOnly(f => !f)}>{boardOnly ? 'Show all experiments' : 'Show board cases only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.status} />)}
    </Card>
  );
}
export function ExperimentMetricHierarchies() {
  const data = [
    { experimentId: 'exp-full-hierarchy', primaryMetric: 'confirmed findings', secondaryCount: 3, guardrailCount: 2 },
    { experimentId: 'exp-thin-metrics', primaryMetric: 'clicks', secondaryCount: 0, guardrailCount: 0 },
  ];
  const [completeOnly, setCompleteOnly] = useState(false);
  const v = X98A.defineMetricHierarchies(data);
  const rows = completeOnly ? v.rows.filter(r => r.complete) : v.rows;
  return (
    <Card title="ExperimentMetricHierarchies" note="Idea 53883">
      <Kv k="Complete hierarchies" v={v.completeCount} />
      <button type="button" onClick={() => setCompleteOnly(f => !f)}>{completeOnly ? 'Show all experiments' : 'Show complete only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={`${r.checksPassed}/3 checks`} />)}
    </Card>
  );
}
export function ExperimentNoveltyEffects() {
  const data = [
    { experimentId: 'exp-novelty-fade', earlyEffect: 0.3, lateEffect: 0.1 },
    { experimentId: 'exp-durable-win', earlyEffect: 0.25, lateEffect: 0.24 },
  ];
  const [latePct, setLatePct] = useState(10);
  const v = X98A.measureNoveltyEffects([{ ...data[0], lateEffect: latePct / 100 }, data[1]]);
  return (
    <Card title="ExperimentNoveltyEffects" note="Idea 53884">
      <Kv k="Faded" v={v.fadedCount} />
      <label className="w98a-field">First experiment late effect ({latePct}%)
        <input type="range" min="0" max="40" value={latePct} onChange={e => setLatePct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} retention`} v={r.retention} />)}
    </Card>
  );
}
export function ExperimentCrossValidation() {
  const data = [
    { experimentId: 'exp-validated-winner', trainingEffect: 0.2, holdoutEffect: 0.16, holdoutHunts: 120 },
    { experimentId: 'exp-holdout-failure', trainingEffect: 0.2, holdoutEffect: -0.05, holdoutHunts: 120 },
  ];
  const [minHunts, setMinHunts] = useState(50);
  const v = X98A.crossValidateExperiments(data.map(d => ({ ...d, minHoldoutHunts: minHunts })));
  return (
    <Card title="ExperimentCrossValidation" note="Idea 53885">
      <Kv k="Validated" v={v.validatedCount} />
      <label className="w98a-field">Minimum holdout hunts
        <input type="number" min="0" max="300" value={minHunts} onChange={e => setMinHunts(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.status} />)}
    </Card>
  );
}
export function ExperimentPublicationStandards() {
  const data = [
    { experimentId: 'exp-polished-writeup', wordCount: 1200, minWords: 500, sections: 4, requiredSections: 4, citations: 6 },
    { experimentId: 'exp-rough-notes', wordCount: 220, minWords: 500, sections: 2, requiredSections: 4, citations: 0 },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X98A.checkPublicationStandards(data);
  const rows = readyOnly ? v.rows.filter(r => r.publishReady) : v.rows;
  return (
    <Card title="ExperimentPublicationStandards" note="Idea 53886">
      <Kv k="Publication-ready" v={v.readyCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all writeups' : 'Show ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.publishReady ? 'ready' : r.gaps.join(', ')} />)}
    </Card>
  );
}
export function ExperimentKnowledgeSharing() {
  const data = [
    { experimentId: 'exp-shared-learning', channels: ['forum', 'digest'], audienceSize: 40, views: 30 },
    { experimentId: 'exp-quiet-result', channels: [], audienceSize: 40, views: 0 },
  ];
  const [views, setViews] = useState(30);
  const v = X98A.shareExperimentKnowledge([{ ...data[0], views }, data[1]]);
  return (
    <Card title="ExperimentKnowledgeSharing" note="Idea 53887">
      <Kv k="Shared experiments" v={v.sharedCount} />
      <label className="w98a-field">First learning views ({views})
        <input type="range" min="0" max="40" value={views} onChange={e => setViews(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} reach`} v={r.reachRate} />)}
    </Card>
  );
}
export function ExperimentAutomation() {
  const data = [
    { experimentId: 'exp-auto-pipeline', stepsTotal: 8, stepsAutomated: 8, manualMinutesSaved: 240 },
    { experimentId: 'exp-manual-flow', stepsTotal: 8, stepsAutomated: 2, manualMinutesSaved: 30 },
  ];
  const [saved, setSaved] = useState(240);
  const v = X98A.automateExperiments([{ ...data[0], manualMinutesSaved: saved }, data[1]]);
  return (
    <Card title="ExperimentAutomation" note="Idea 53888">
      <Kv k="Hours saved" v={v.totalSavedHours} />
      <label className="w98a-field">Pipeline minutes saved ({saved})
        <input type="range" min="0" max="600" step="20" value={saved} onChange={e => setSaved(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.experimentId} value={r.automationRate} max={1} />)}
    </Card>
  );
}
export function ExperimentPortfolioReviews() {
  const data = [
    { experimentId: 'exp-portfolio-star', impact: 9000, cost: 2000, quarter: 'Q3' },
    { experimentId: 'exp-portfolio-drain', impact: 500, cost: 3000, quarter: 'Q3' },
    { experimentId: 'exp-portfolio-steady', impact: 4000, cost: 1500, quarter: 'Q2' },
  ];
  const [quarter, setQuarter] = useState('all');
  const v = X98A.reviewExperimentPortfolio(data);
  const rows = quarter === 'all' ? v.rows : v.rows.filter(r => r.quarter === quarter);
  return (
    <Card title="ExperimentPortfolioReviews" note="Idea 53889">
      <Kv k="Portfolio return" v={v.portfolioReturn} />
      <label className="w98a-field">Quarter
        <select value={quarter} onChange={e => setQuarter(e.target.value)}>
          <option value="all">all quarters</option>
          <option value="Q2">Q2</option>
          <option value="Q3">Q3</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.experimentId} net`} v={r.net} />)}
    </Card>
  );
}
export function ExperimentRiskTiers() {
  const data = [
    { experimentId: 'exp-critical-tier', targetRisk: 0.9, dataRisk: 0.8, scale: 0.7 },
    { experimentId: 'exp-low-tier', targetRisk: 0.1, dataRisk: 0.1, scale: 0.2 },
  ];
  const [targetPct, setTargetPct] = useState(90);
  const v = X98A.tierExperimentRisk([{ ...data[0], targetRisk: targetPct / 100 }, data[1]]);
  return (
    <Card title="ExperimentRiskTiers" note="Idea 53890">
      <Kv k="Critical tier" v={v.criticalCount} />
      <label className="w98a-field">First experiment target risk ({targetPct}%)
        <input type="range" min="0" max="100" value={targetPct} onChange={e => setTargetPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} tier`} v={`${r.tier} · ${r.oversight}`} />)}
    </Card>
  );
}
export function ExperimentSuccessAttribution() {
  const data = [
    { experimentId: 'exp-main-driver', fleetImprovement: 100, contributionShare: 0.5, adopted: true },
    { experimentId: 'exp-unadopted', fleetImprovement: 100, contributionShare: 0.4, adopted: false },
  ];
  const [sharePct, setSharePct] = useState(50);
  const v = X98A.attributeExperimentSuccess([{ ...data[0], contributionShare: sharePct / 100 }, data[1]]);
  return (
    <Card title="ExperimentSuccessAttribution" note="Idea 53891">
      <Kv k="Attributed improvement" v={v.totalAttributed} />
      <label className="w98a-field">Main driver contribution ({sharePct}%)
        <input type="range" min="0" max="100" value={sharePct} onChange={e => setSharePct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} attributed`} v={r.attributedImpact} />)}
    </Card>
  );
}
export function ExperimentDataRetention() {
  const data = [
    { experimentId: 'exp-old-results', dataType: 'raw-events', ageDays: 400, retentionDays: 365 },
    { experimentId: 'exp-fresh-results', dataType: 'summaries', ageDays: 30, retentionDays: 365 },
  ];
  const [age, setAge] = useState(400);
  const v = X98A.planExperimentDataRetention([{ ...data[0], ageDays: age }, data[1]]);
  return (
    <Card title="ExperimentDataRetention" note="Idea 53892">
      <Kv k="Due for archival" v={v.expiredCount} />
      <label className="w98a-field">Old dataset age in days ({age})
        <input type="range" min="0" max="800" step="10" value={age} onChange={e => setAge(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.experimentId} action`} v={r.action} />)}
    </Card>
  );
}
export function ExperimentChampionRoles() {
  const data = [
    { experimentId: 'exp-championed', champion: 'r-a', backup: 'r-b', huntsLed: 40 },
    { experimentId: 'exp-ownerless', champion: '', backup: '', huntsLed: 0 },
    { experimentId: 'exp-single-cover', champion: 'r-a', backup: '', huntsLed: 12 },
  ];
  const [coveredOnly, setCoveredOnly] = useState(false);
  const v = X98A.assignExperimentChampions(data);
  const rows = coveredOnly ? v.rows.filter(r => r.covered) : v.rows;
  return (
    <Card title="ExperimentChampionRoles" note="Idea 53893">
      <Kv k="Fully covered" v={v.coveredCount} />
      <button type="button" onClick={() => setCoveredOnly(f => !f)}>{coveredOnly ? 'Show all experiments' : 'Show covered only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.experimentId} v={r.status} />)}
    </Card>
  );
}
export function AnnualExperimentImpactReport() {
  const data = [
    { experimentId: 'exp-2025-win', year: 2025, effect: 0.2, adopted: true, findingsValue: 5000 },
    { experimentId: 'exp-2026-win', year: 2026, effect: 0.3, adopted: true, findingsValue: 9000 },
    { experimentId: 'exp-2026-trial', year: 2026, effect: 0.1, adopted: false, findingsValue: 0 },
  ];
  const [year, setYear] = useState('all');
  const v = X98A.buildAnnualImpactReport(data);
  const rows = year === 'all' ? v.rows : v.rows.filter(r => r.year === Number(year));
  return (
    <Card title="AnnualExperimentImpactReport" note="Idea 53894">
      <Kv k="Years covered" v={v.yearCount} />
      <label className="w98a-field">Report year
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="all">all years</option>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`Year ${r.year} adopted`} v={`${r.adoptedCount}/${r.experiments}`} />)}
      <div className="w98a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE98_A_COMPONENTS = [ExperimentTooling, ExperimentReviewBoards, ExperimentMetricHierarchies, ExperimentNoveltyEffects, ExperimentCrossValidation, ExperimentPublicationStandards, ExperimentKnowledgeSharing, ExperimentAutomation, ExperimentPortfolioReviews, ExperimentRiskTiers, ExperimentSuccessAttribution, ExperimentDataRetention, ExperimentChampionRoles, AnnualExperimentImpactReport];

export function Wave98AGallery() {
  return (
    <div className="w98a-gallery">
      {WAVE98_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
