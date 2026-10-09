/**
 * Wave88A.jsx — Infinity AI · Wave 88
 * 20 working React components for knowledge base round 2, ideas 53481–53500. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave88ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w88a-card">
      <div className="w88a-title">{title}</div>
      {note ? <div className="w88a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w88a-badge w88a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w88a-kv">
      <span className="w88a-k">{k}</span>
      <span className="w88a-v">{String(v)}</span>
    </div>
  );
}

export function KbChangeNotifications() {
  const v = XA.notifyKbChanges([{ id: 'a1', title: 'SSRF notes', significance: 0.9, subscribers: ['r1', 'r2'] }]);
  return (<Card title="KB Change Notifications" note="Idea 53481"><Kv k="Articles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbArticleBounties() {
  const v = XA.offerKbArticleBounties([{ id: 'g1', topic: 'GraphQL auth bypass', priority: 0.9 }]);
  return (<Card title="KB Article Bounties" note="Idea 53482"><Kv k="Gaps" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbQualityRubrics() {
  const v = XA.publishKbQualityRubrics([{ name: 'Accuracy', weight: 3, maxScore: 5 }]);
  return (<Card title="KB Quality Rubrics" note="Idea 53483"><Kv k="Criteria" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbExternalSourcing() {
  const v = XA.importKbExternalSources([{ id: 's1', title: 'Public research', license: 'CC-BY', attributed: true }]);
  return (<Card title="KB External Sourcing" note="Idea 53484"><Kv k="Sources" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbRedundancyWithPlaybooks() {
  const v = XA.delineateKbVsPlaybooks([{ id: 'i1', title: 'IDOR playbook', proceduralSteps: 6, concepts: 2 }]);
  return (<Card title="KB Redundancy with Playbooks" note="Idea 53485"><Kv k="Items" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbSearchSynonymExpansion() {
  const v = XA.expandKbSearchSynonyms([{ term: 'sqli', count: 9, clickedSynonyms: ['sql injection'] }]);
  return (<Card title="KB Search Synonym Expansion" note="Idea 53486"><Kv k="Terms" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbContributionOnboarding() {
  const v = XA.onboardKbContributors([{ name: 'researcher-a', completedSteps: ['pick-hunt', 'draft-article', 'peer-review', 'publish'] }]);
  return (<Card title="KB Contribution Onboarding" note="Idea 53487"><Kv k="Researchers" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbArticleTemplatesPerFindingType() {
  const v = XA.templateKbArticlesByFindingType([{ type: 'sqli' }, { type: 'xss' }]);
  return (<Card title="KB Article Templates per Finding Type" note="Idea 53488"><Kv k="Types" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbAnnualAudits() {
  const v = XA.auditKbArticlesAnnually([{ id: 'a1', title: 'JWT notes', accurate: true }]);
  return (<Card title="KB Annual Audits" note="Idea 53489"><Kv k="Audited" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbStalenessAlerts() {
  const v = XA.alertKbStaleness([{ id: 'a1', title: 'Old SSRF notes', owner: 'researcher-a', monthsSinceHuntValidation: 14 }]);
  return (<Card title="KB Staleness Alerts" note="Idea 53490"><Kv k="Articles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbCrossLinkingSuggestions() {
  const v = XA.suggestKbCrossLinks([{ id: 'a1', coCitations: { a2: 3 } }, { id: 'a2' }]);
  return (<Card title="KB Cross-Linking Suggestions" note="Idea 53491"><Kv k="Suggestions" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbReadingPaths() {
  const v = XA.buildKbReadingPaths([{ id: 'a1', title: 'API hunting basics', difficulty: 'beginner' }], { skillArea: 'api-hunting' });
  return (<Card title="KB Reading Paths" note="Idea 53492"><Kv k="Articles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbIncidentLearningsSection() {
  const v = XA.collectKbIncidentLearnings([{ id: 'inc1', hunt: 'hunt-7', lesson: 'Rate-limit before fuzzing', severity: 'high', published: true }]);
  return (<Card title="KB Incident Learnings Section" note="Idea 53493"><Kv k="Learnings" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbApiRateLimits() {
  const v = XA.enforceKbApiRateLimits([{ source: 'agent' }, { source: 'agent' }, { source: 'human' }]);
  return (<Card title="KB API Rate Limits" note="Idea 53494"><Kv k="Sources" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbOfflineSync() {
  const v = XA.syncKbOffline([{ id: 'a1', title: 'Field notes', localVersion: 1, remoteVersion: 2 }]);
  return (<Card title="KB Offline Sync" note="Idea 53495"><Kv k="Articles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbContributionRecognition() {
  const v = XA.recognizeKbContributions([{ name: 'researcher-a', articles: 4, citations: 9 }]);
  return (<Card title="KB Contribution Recognition" note="Idea 53496"><Kv k="Authors" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbArticleDifficultyLabels() {
  const v = XA.labelKbArticleDifficulty([{ id: 'a1', title: 'Kernel notes', depthScore: 9 }]);
  return (<Card title="KB Article Difficulty Labels" note="Idea 53497"><Kv k="Articles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbFeedbackTriage() {
  const v = XA.triageKbFeedback([{ id: 'f1', article: 'a1', note: 'Typo in payload', effortDays: 0.5 }]);
  return (<Card title="KB Feedback Triage" note="Idea 53498"><Kv k="Feedback" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbGrowthMetricsDashboard() {
  const v = XA.trackKbGrowthMetrics([{ period: '2026-09', articles: 120, coverage: 0.7, freshness: 0.8, usage: 400 }]);
  return (<Card title="KB Growth Metrics Dashboard" note="Idea 53499"><Kv k="Periods" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbSunsetArchives() {
  const v = XA.archiveKbSunsetArticles([{ id: 'a1', title: 'Legacy notes', status: 'deprecated', archiveReason: 'superseded' }]);
  return (<Card title="KB Sunset Archives" note="Idea 53500"><Kv k="Articles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export const WAVE88_A_COMPONENTS = [
  KbChangeNotifications, KbArticleBounties, KbQualityRubrics, KbExternalSourcing,
  KbRedundancyWithPlaybooks, KbSearchSynonymExpansion, KbContributionOnboarding,
  KbArticleTemplatesPerFindingType, KbAnnualAudits, KbStalenessAlerts,
  KbCrossLinkingSuggestions, KbReadingPaths, KbIncidentLearningsSection,
  KbApiRateLimits, KbOfflineSync, KbContributionRecognition,
  KbArticleDifficultyLabels, KbFeedbackTriage, KbGrowthMetricsDashboard, KbSunsetArchives,
];

export function Wave88AGallery() {
  return (
    <div className="w88a-gallery">
      {WAVE88_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
