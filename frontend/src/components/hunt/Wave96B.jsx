/**
 * Wave96B.jsx — Infinity AI · Wave 96
 * 20 working React components for forgetting governance, metrics, and strategy experiments,
 * export-only module: components are not mounted anywhere. Interactive, props/state-driven
 * views over the pure cores.
 */
import React, { useState } from 'react';
import * as X96B from './wave96BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w96b-card">
      <div className="w96b-title">{title}</div>
      {note ? <div className="w96b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w96b-badge w96b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w96b-kv">
      <span className="w96b-k">{k}</span>
      <span className="w96b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w96b-bar-row">
      <span className="w96b-k">{label}</span>
      <div className="w96b-bar"><div className="w96b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w96b-v">{value}</span>
    </div>
  );
}

export function ForgettingMetrics() {
  const data = [
    { period: '2026-Q1', forgotten: 100, revived: 10, outcomeDelta: 0.05 },
    { period: '2026-Q2', forgotten: 50, revived: 25, outcomeDelta: -0.02 },
  ];
  const [period, setPeriod] = useState('2026-Q1');
  const v = X96B.computeForgettingMetrics(data);
  const row = v.rows.find(r => r.period === period);
  return (
    <Card title="ForgettingMetrics" note="Idea 53821">
      <Kv k="Total forgotten" v={v.totalForgotten} />
      <label className="w96b-field">Period
        <select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="2026-Q1">2026-Q1</option>
          <option value="2026-Q2">2026-Q2</option>
        </select>
      </label>
      <Kv k="revival rate" v={row.revivalRate} />
      <Kv k="net effect" v={row.netEffect} />
    </Card>
  );
}
export function CrossOrgStalenessSignals() {
  const data = [
    { org: 'org-a', topic: 'xss-vectors', staleShare: 0.7 },
    { org: 'org-b', topic: 'xss-vectors', staleShare: 0.5 },
    { org: 'org-c', topic: 'xss-vectors', staleShare: 0.9, optedOut: true },
    { org: 'org-a', topic: 'cloud-iam', staleShare: 0.2 },
  ];
  const [excludeOptOuts, setExcludeOptOuts] = useState(true);
  const v = X96B.aggregateCrossOrgStalenessSignals(excludeOptOuts ? data : data.map(d => ({ ...d, optedOut: false })));
  return (
    <Card title="CrossOrgStalenessSignals" note="Idea 53822">
      <Kv k="Topics" v={v.count} />
      <Kv k="Excluded orgs" v={v.excludedCount} />
      <button type="button" onClick={() => setExcludeOptOuts(x => !x)}>{excludeOptOuts ? 'Include opted-out orgs' : 'Respect opt-outs'}</button>
      {v.signals.map(s => <Bar key={s.key} label={s.topic} value={s.meanStaleShare} max={1} />)}
    </Card>
  );
}
export function KnowledgeHalfLifeResearch() {
  const data = [
    { topic: 'xss-vectors', halfLifeDays: 45, sampleSize: 120 },
    { topic: 'cloud-iam', halfLifeDays: 200, sampleSize: 90 },
    { topic: 'crypto-basics', halfLifeDays: 900, sampleSize: 12 },
  ];
  const [minSamples, setMinSamples] = useState(0);
  const v = X96B.researchKnowledgeHalfLives(data);
  const rows = v.rows.filter(r => r.sampleSize >= minSamples);
  return (
    <Card title="KnowledgeHalfLifeResearch" note="Idea 53823">
      <Kv k="Median half-life" v={v.medianHalfLife} />
      <label className="w96b-field">Min samples ({minSamples})
        <input type="range" min="0" max="150" step="10" value={minSamples} onChange={e => setMinSamples(Number(e.target.value))} />
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.topic} · ${r.decayClass}`} v={`${r.halfLifeDays}d`} />)}
    </Card>
  );
}
export function ForgettingEthicsReviews() {
  const data = [
    { entryId: 'safety-critical-auth', category: 'safety', safetyCritical: true, justification: '' },
    { entryId: 'justified-retirement', category: 'payload', safetyCritical: false, justification: 'superseded by v2 guidance' },
  ];
  const [justify, setJustify] = useState(false);
  const v = X96B.reviewForgettingEthics([justify ? { ...data[0], justification: 'expert panel approved 2026-09' } : data[0], data[1]]);
  return (
    <Card title="ForgettingEthicsReviews" note="Idea 53824">
      <Kv k="Violations" v={v.violationCount} />
      <button type="button" onClick={() => setJustify(j => !j)}>{justify ? 'Remove justification' : 'Add expert justification'}</button>
      {v.rows.map(r => <Kv key={r.key} k={r.entryId} v={r.violation ? 'violation' : 'compliant'} />)}
    </Card>
  );
}
export function StaleIntegrationCleanup() {
  const data = [
    { integrationId: 'legacy-scanner', tool: 'old-scanner', lastUsedDaysAgo: 200, monthlyCalls: 2, connected: true },
    { integrationId: 'hunt-notifier', tool: 'notifier', lastUsedDaysAgo: 1, monthlyCalls: 400, connected: true },
    { integrationId: 'flaky-connector', tool: 'connector-x', lastUsedDaysAgo: 10, monthlyCalls: 50, connected: false },
  ];
  const [action, setAction] = useState('all');
  const v = X96B.cleanStaleIntegrations(data);
  const rows = action === 'all' ? v.rows : v.rows.filter(r => r.action === action);
  return (
    <Card title="StaleIntegrationCleanup" note="Idea 53825">
      <Kv k="Remove" v={v.removeCount} />
      <label className="w96b-field">Action
        <select value={action} onChange={e => setAction(e.target.value)}>
          <option value="all">all</option>
          <option value="remove">remove</option>
          <option value="keep">keep</option>
          <option value="repair">repair</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.integrationId} · ${r.action}`} v={`${r.lastUsedDaysAgo}d ago`} />)}
    </Card>
  );
}
export function KnowledgeFreshnessSLAs() {
  const data = [
    { category: 'payloads', targetDays: 90, oldestDays: 140 },
    { category: 'principles', targetDays: 730, oldestDays: 400 },
  ];
  const [oldest, setOldest] = useState(140);
  const v = X96B.evaluateKnowledgeFreshnessSLAs([{ ...data[0], oldestDays: oldest }, data[1]]);
  const row = v.rows.find(r => r.category === 'payloads');
  return (
    <Card title="KnowledgeFreshnessSLAs" note="Idea 53826">
      <Kv k="Breached" v={v.breachCount} />
      <label className="w96b-field">Payload oldest age (days {oldest})
        <input type="range" min="30" max="300" value={oldest} onChange={e => setOldest(Number(e.target.value))} />
      </label>
      <Kv k="breach factor" v={row.breachFactor} />
      <Kv k="compliant" v={String(row.compliant)} />
    </Card>
  );
}
export function ForgettingTriggeredAlerts() {
  const data = [
    { eventId: 'forget-batch-9', forgottenCount: 150, performanceDropPct: 8, day: 120 },
    { eventId: 'forget-minor-3', forgottenCount: 20, performanceDropPct: 1, day: 121 },
  ];
  const [forgotten, setForgotten] = useState(150);
  const v = X96B.detectForgettingTriggeredAlerts([{ ...data[0], forgottenCount: forgotten }, data[1]]);
  const row = v.rows.find(r => r.eventId === 'forget-batch-9');
  return (
    <Card title="Forgetting-TriggeredAlerts" note="Idea 53827">
      <Kv k="Alerts" v={v.alertCount} />
      <label className="w96b-field">Batch size forgotten ({forgotten})
        <input type="range" min="0" max="300" step="10" value={forgotten} onChange={e => setForgotten(Number(e.target.value))} />
      </label>
      <Kv k="alert firing" v={String(row.alert)} />
      <Bar label="severity" value={row.severity} max={1} />
    </Card>
  );
}
export function ArchivedKnowledgeSearch() {
  const data = [
    { entryId: 'k-xss-2019', title: 'XSS filter bypass', body: 'Legacy xss vectors for old frameworks', status: 'archived' },
    { entryId: 'k-ssrf-map', title: 'SSRF internal map', body: 'archived cloud metadata notes', status: 'forgotten' },
  ];
  const [query, setQuery] = useState('xss');
  const v = X96B.searchArchivedKnowledge(query, data);
  return (
    <Card title="ArchivedKnowledgeSearch" note="Idea 53828">
      <label className="w96b-field">Search the archive
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <Kv k="Matches" v={v.count} />
      {v.rows.map(r => <Kv key={r.key} k={`${r.title} · ${r.status}`} v={`score ${r.score}`} />)}
    </Card>
  );
}
export function KnowledgeDecayAttribution() {
  const data = [
    { entryId: 'entry-correlated', forgottenDay: 100, changeDay: 103, performanceDeltaPct: -6 },
    { entryId: 'entry-unrelated', forgottenDay: 100, changeDay: 150, performanceDeltaPct: -2 },
  ];
  const [gap, setGap] = useState(103);
  const v = X96B.attributeKnowledgeDecay([{ ...data[0], changeDay: gap }, data[1]]);
  const row = v.rows.find(r => r.entryId === 'entry-correlated');
  return (
    <Card title="KnowledgeDecayAttribution" note="Idea 53829">
      <Kv k="Attributed" v={v.attributedCount} />
      <label className="w96b-field">Perf change day ({gap})
        <input type="range" min="95" max="160" value={gap} onChange={e => setGap(Number(e.target.value))} />
      </label>
      <Kv k="day gap" v={row.dayGap} />
      <Kv k="attributed" v={String(row.attributed)} />
    </Card>
  );
}
export function ForgettingPolicyVersioning() {
  const data = [
    { policyId: 'retention-main', version: '2.0.0', effectiveDay: 300, changeSummary: 'raise payload retention to 120 days' },
    { policyId: 'retention-main', version: '1.0.0', effectiveDay: 1, changeSummary: 'initial policy' },
  ];
  const v = X96B.versionForgettingPolicies(data);
  const current = v.rows.find(r => r.isCurrent);
  return (
    <Card title="ForgettingPolicyVersioning" note="Idea 53830">
      <Kv k="Policies" v={v.policyCount} />
      <Kv k="Current version" v={current.version} />
      {v.rows.map(r => <Kv key={r.key} k={`${r.policyId}@${r.version}`} v={r.isCurrent ? 'current' : 'superseded'} />)}
      <div className="w96b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}
export function StaleTrainingDataPurging() {
  const data = [
    { exampleId: 'ex-old-source', ageDays: 500, sourceStale: true, labelQuality: 0.9 },
    { exampleId: 'ex-fresh', ageDays: 10, sourceStale: false, labelQuality: 0.95 },
    { exampleId: 'ex-noisy', ageDays: 30, sourceStale: false, labelQuality: 0.2 },
  ];
  const [qualityFloor, setQualityFloor] = useState(0.2);
  const v = X96B.purgeStaleTrainingData(data.map(d => ({ ...d, labelQuality: d.exampleId === 'ex-noisy' ? qualityFloor : d.labelQuality })));
  return (
    <Card title="StaleTrainingDataPurging" note="Idea 53831">
      <Kv k="Purged" v={v.purgeCount} />
      <label className="w96b-field">ex-noisy label quality ({qualityFloor})
        <input type="range" min="0" max="0.9" step="0.05" value={qualityFloor} onChange={e => setQualityFloor(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.exampleId} v={r.purge ? 'purge' : 'keep'} />)}
    </Card>
  );
}
export function KnowledgeRevivalTesting() {
  const data = [
    { entryId: 'revived-ssrf', sandboxRuns: 20, sandboxPasses: 18, sideEffects: 0 },
    { entryId: 'revived-legacy', sandboxRuns: 20, sandboxPasses: 10, sideEffects: 2 },
  ];
  const [passes, setPasses] = useState(18);
  const v = X96B.testKnowledgeRevival([{ ...data[0], sandboxPasses: passes }, data[1]]);
  const row = v.rows.find(r => r.entryId === 'revived-ssrf');
  return (
    <Card title="KnowledgeRevivalTesting" note="Idea 53832">
      <Kv k="Production ready" v={v.readyCount} />
      <label className="w96b-field">Sandbox passes ({passes}/20)
        <input type="range" min="0" max="20" value={passes} onChange={e => setPasses(Number(e.target.value))} />
      </label>
      <Kv k="pass rate" v={row.passRate} />
      <Kv k="ready" v={String(row.productionReady)} />
    </Card>
  );
}
export function ForgettingCommunicationTemplates() {
  const [category, setCategory] = useState('stale');
  const v = X96B.renderForgettingCommunication([{ entryId: 'oauth-notes-2023', author: 'researcher-a', reason: 'oauth provider shipped breaking changes', category }]);
  return (
    <Card title="ForgettingCommunicationTemplates" note="Idea 53833">
      <Kv k="Templates" v={v.templatesAvailable} />
      <label className="w96b-field">Reason category
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="stale">stale</option>
          <option value="superseded">superseded</option>
          <option value="compliance">compliance</option>
          <option value="other">other</option>
        </select>
      </label>
      <div className="w96b-note">{v.rows[0].message}</div>
    </Card>
  );
}
export function AnnualForgettingAudits() {
  const data = [
    { year: 2025, forgotten: 400, justified: 380, revived: 10 },
    { year: 2026, forgotten: 300, justified: 240, revived: 30 },
  ];
  const [year, setYear] = useState(2026);
  const v = X96B.auditAnnualForgetting(data);
  const row = v.rows.find(r => r.year === year);
  return (
    <Card title="AnnualForgettingAudits" note="Idea 53834">
      <Kv k="Total forgotten" v={v.totalForgotten} />
      <label className="w96b-field">Audit year
        <select value={year} onChange={e => setYear(Number(e.target.value))}>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
      </label>
      <Kv k="justification rate" v={row.justificationRate} />
      <Kv k="stayed forgotten" v={row.stayedForgotten} />
    </Card>
  );
}
export function KnowledgeFreshnessGamification() {
  const data = [
    { researcher: 'r-a', revalidated: 25, points: 320, streakDays: 40 },
    { researcher: 'r-b', revalidated: 4, points: 60, streakDays: 3 },
  ];
  const [extra, setExtra] = useState(0);
  const v = X96B.scoreKnowledgeFreshnessGame([{ ...data[0], points: 320 + extra }, data[1]]);
  return (
    <Card title="KnowledgeFreshnessGamification" note="Idea 53835">
      <Kv k="Leader" v={v.top.researcher} />
      <label className="w96b-field">Bonus points for r-a ({extra})
        <input type="range" min="0" max="200" step="10" value={extra} onChange={e => setExtra(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`#${r.rank} ${r.researcher} · ${r.level}`} v={`${r.points} pts`} />)}
    </Card>
  );
}
export function ForgettingVsUpdatingDecisions() {
  const [evidence, setEvidence] = useState(0.8);
  const v = X96B.decideForgettingVsUpdating([
    { entryId: 'entry-decision', evidenceStrength: evidence, updateCostHours: 4, ageDays: 200 },
    { entryId: 'entry-weak', evidenceStrength: 0.1, updateCostHours: 20, ageDays: 400 },
  ]);
  const row = v.rows.find(r => r.entryId === 'entry-decision');
  return (
    <Card title="ForgettingVsUpdatingDecisions" note="Idea 53836">
      <Kv k="Update" v={v.updateCount} />
      <Kv k="Forget" v={v.forgetCount} />
      <label className="w96b-field">Evidence strength ({evidence})
        <input type="range" min="0" max="1" step="0.05" value={evidence} onChange={e => setEvidence(Number(e.target.value))} />
      </label>
      <Kv k="decision" v={row.decision} />
    </Card>
  );
}
export function StaleDashboardWidgetCleanup() {
  const data = [
    { widgetId: 'widget-unused-chart', name: 'Unused chart', viewsLast30d: 2, ownerActive: true },
    { widgetId: 'widget-hunt-feed', name: 'Hunt feed', viewsLast30d: 500, ownerActive: true },
    { widgetId: 'widget-orphan', name: 'Orphan panel', viewsLast30d: 40, ownerActive: false },
  ];
  const [onlyStale, setOnlyStale] = useState(false);
  const v = X96B.cleanStaleDashboardWidgets(data);
  const rows = onlyStale ? v.rows.filter(r => r.stale) : v.rows;
  return (
    <Card title="StaleDashboardWidgetCleanup" note="Idea 53837">
      <Kv k="Stale" v={v.staleCount} />
      <button type="button" onClick={() => setOnlyStale(s => !s)}>{onlyStale ? 'Show all widgets' : 'Show stale only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.name} · ${r.action}`} v={`${r.viewsLast30d} views`} />)}
    </Card>
  );
}
export function KnowledgeExpiryCountdowns() {
  const data = [
    { entryId: 'contrib-urgent', contributor: 'r-a', expiresInDays: 5, revalidationHours: 2 },
    { entryId: 'contrib-later', contributor: 'r-b', expiresInDays: 90, revalidationHours: 3 },
  ];
  const [days, setDays] = useState(5);
  const v = X96B.countdownKnowledgeExpiry([{ ...data[0], expiresInDays: days }, data[1]]);
  const row = v.rows.find(r => r.entryId === 'contrib-urgent');
  return (
    <Card title="KnowledgeExpiryCountdowns" note="Idea 53838">
      <Kv k="Need attention" v={v.attentionCount} />
      <label className="w96b-field">Days to expiry ({days})
        <input type="range" min="-5" max="120" value={days} onChange={e => setDays(Number(e.target.value))} />
      </label>
      <Kv k="action" v={row.action} />
    </Card>
  );
}
export function ForgettingImpactOnNewHires() {
  const data = [
    { technique: 'legacy-xss-vectors', forgotten: true, taughtInOnboarding: true },
    { technique: 'modern-api-auth', forgotten: false, taughtInOnboarding: true },
    { technique: 'old-cors-tricks', forgotten: true, taughtInOnboarding: false },
  ];
  const [untaught, setUntaught] = useState(false);
  const v = X96B.auditNewHireForgettingImpact(untaught ? data.map(d => d.technique === 'legacy-xss-vectors' ? { ...d, taughtInOnboarding: false } : d) : data);
  return (
    <Card title="ForgettingImpactOnNewHires" note="Idea 53839">
      <Kv k="Teaching risks" v={v.riskCount} />
      <button type="button" onClick={() => setUntaught(u => !u)}>{untaught ? 'Re-add legacy-xss to onboarding' : 'Remove legacy-xss from onboarding'}</button>
      {v.rows.map(r => <Kv key={r.key} k={`${r.technique}`} v={r.curriculum} />)}
    </Card>
  );
}
export function HuntStrategyExperimentFramework() {
  const [sample, setSample] = useState(150);
  const v = X96B.designHuntStrategyExperiment([
    { experimentId: 'exp-recon-depth', hypothesis: 'Deeper recon raises confirmed-finding rate', arms: [{ name: 'standard', isControl: true }, { name: 'deep-recon' }], successMetric: 'confirmed findings per hunt', targetSample: sample },
    { experimentId: 'exp-draft', hypothesis: '', arms: [{ name: 'only-arm' }], successMetric: '', targetSample: 10 },
  ]);
  const row = v.rows.find(r => r.experimentId === 'exp-recon-depth');
  return (
    <Card title="HuntStrategyExperimentFramework" note="Idea 53840">
      <Kv k="Ready" v={v.readyCount} />
      <label className="w96b-field">Target sample per arm ({sample})
        <input type="range" min="10" max="400" step="10" value={sample} onChange={e => setSample(Number(e.target.value))} />
      </label>
      <Kv k="checks passed" v={`${row.checksPassed}/5`} />
      <Kv k="power" v={row.powerAssessment} />
      <div className="w96b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE96_B_COMPONENTS = [ForgettingMetrics, CrossOrgStalenessSignals, KnowledgeHalfLifeResearch, ForgettingEthicsReviews, StaleIntegrationCleanup, KnowledgeFreshnessSLAs, ForgettingTriggeredAlerts, ArchivedKnowledgeSearch, KnowledgeDecayAttribution, ForgettingPolicyVersioning, StaleTrainingDataPurging, KnowledgeRevivalTesting, ForgettingCommunicationTemplates, AnnualForgettingAudits, KnowledgeFreshnessGamification, ForgettingVsUpdatingDecisions, StaleDashboardWidgetCleanup, KnowledgeExpiryCountdowns, ForgettingImpactOnNewHires, HuntStrategyExperimentFramework];

export function Wave96BGallery() {
  return (
    <div className="w96b-gallery">
      {WAVE96_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
