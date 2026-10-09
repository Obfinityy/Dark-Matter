/**
 * Wave88B.jsx — Infinity AI · Wave 88
 * 20 working React components for KB governance and failure analysis, ideas 53501–53520. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave88BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w88b-card">
      <div className="w88b-title">{title}</div>
      {note ? <div className="w88b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w88b-badge w88b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w88b-kv">
      <span className="w88b-k">{k}</span>
      <span className="w88b-v">{String(v)}</span>
    </div>
  );
}

export function KbLegalReviewQueue() {
  const v = XB.queueKbLegalReviews([{ id: 'a1', title: 'Zero-day handling notes', body: 'Handle exploit details carefully' }]);
  return (<Card title="KB Legal Review Queue" note="Idea 53501"><Kv k="Articles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbCommunityContributions() {
  const v = XB.moderateKbCommunityContributions([{ id: 'c1', author: 'external-researcher', title: 'Cache poisoning notes', reviewed: true, spamScore: 0.1 }]);
  return (<Card title="KB Community Contributions" note="Idea 53502"><Kv k="Contributions" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbArticleImpactScores() {
  const v = XB.scoreKbArticleImpact([{ id: 'a1', title: 'SSRF notes', huntsImproved: 3, findingsEnabled: 2 }]);
  return (<Card title="KB Article Impact Scores" note="Idea 53503"><Kv k="Articles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbSemanticDeduplication() {
  const v = XB.deduplicateKbSemantically([{ id: 'a1', similarity: { a2: 0.95 } }, { id: 'a2' }]);
  return (<Card title="KB Semantic Deduplication" note="Idea 53504"><Kv k="Pairs" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbOnboardingChecklists() {
  const v = XB.buildKbOnboardingChecklists([{ name: 'new-member', articlesRead: 10 }]);
  return (<Card title="KB Onboarding Checklists" note="Idea 53505"><Kv k="Members" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbHuntCitationRequirements() {
  const v = XB.enforceKbHuntCitations([{ id: 'r1', hunt: 'hunt-9', kbCitations: ['a1', 'a2'] }]);
  return (<Card title="KB Hunt-Citation Requirements" note="Idea 53506"><Kv k="Reports" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbKnowledgeGraphVisualizations() {
  const v = XB.buildKbKnowledgeGraph([{ id: 'a1', title: 'SSRF notes', links: ['a2'] }, { id: 'a2', title: 'Metadata notes', links: [] }]);
  return (<Card title="KB Knowledge Graph Visualizations" note="Idea 53507"><Kv k="Nodes" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function KbAnnualGrowthReport() {
  const v = XB.reportKbAnnualGrowth([{ year: 2026, articles: 240, gapsClosed: 18, topArticle: 'SSRF notes' }]);
  return (<Card title="KB Annual Growth Report" note="Idea 53508"><Kv k="Years" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureTaxonomy() {
  const v = XB.classifyFailureTaxonomy([{ id: 'f1', payload: "' OR 1=1--", status: 403 }]);
  return (<Card title="Failure Taxonomy" note="Idea 53509"><Kv k="Failures" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function NearMissPayloadDetection() {
  const v = XB.detectNearMissPayloads([{ id: 'p1', payload: '<svg onload=x>', partialSignal: 0.8 }]);
  return (<Card title="Near-Miss Payload Detection" note="Idea 53510"><Kv k="Payloads" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function BlockedVsPatchedDifferentiation() {
  const v = XB.differentiateBlockedVsPatched([{ id: 'p1', status: 403, wafHeader: true }]);
  return (<Card title="Blocked-vs-Patched Differentiation" note="Idea 53511"><Kv k="Failures" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FilterFingerprintingFromFailures() {
  const v = XB.fingerprintFiltersFromFailures([{ id: 'f1', filterSignature: 'modsec-rule-942', strippedTokens: ['union', 'select'] }]);
  return (<Card title="Filter Fingerprinting from Failures" note="Idea 53512"><Kv k="Fingerprints" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureClustering() {
  const v = XB.clusterFailures([{ id: 'f1', target: 'api.example', contentType: 'application/json' }, { id: 'f2', target: 'api.example', contentType: 'application/json' }, { id: 'f3', target: 'api.example', contentType: 'application/json' }]);
  return (<Card title="Failure Clustering" note="Idea 53513"><Kv k="Clusters" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function PayloadAutopsyReports() {
  const v = XB.generatePayloadAutopsies([{ id: 'p1', payload: '{{7*7}}', stoppedBy: 'waf', transformation: 'url-encode', status: 403 }]);
  return (<Card title="Payload Autopsy Reports" note="Idea 53514"><Kv k="Autopsies" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureCostAccounting() {
  const v = XB.accountFailureCosts([{ id: 'p1', requests: 40, successProbability: 0.02, doomed: true }]);
  return (<Card title="Failure Cost Accounting" note="Idea 53515"><Kv k="Payloads" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function SurvivorshipBiasCorrection() {
  const v = XB.correctSurvivorshipBias([{ id: 't1', technique: 'double-encoding', effectiveness: 0.9, timesTested: 10, timesSurvived: 6 }]);
  return (<Card title="Survivorship Bias Correction" note="Idea 53516"><Kv k="Techniques" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureDrivenMutationSuggestions() {
  const v = XB.suggestFailureDrivenMutations([{ id: 'p1', defense: 'waf' }]);
  return (<Card title="Failure-Driven Mutation Suggestions" note="Idea 53517"><Kv k="Failures" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function TimeToFailureAnalysis() {
  const v = XB.analyzeTimeToFailure([{ id: 'p1', timeToFailureMs: 900 }]);
  return (<Card title="Time-to-Failure Analysis" note="Idea 53518"><Kv k="Failures" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FailureSignalLibraries() {
  const v = XB.buildFailureSignalLibraries([{ product: 'modsecurity', signature: 'modsec-block-942' }]);
  return (<Card title="Failure Signal Libraries" note="Idea 53519"><Kv k="Products" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}
export function FalseNegativeFailureReviews() {
  const v = XB.reviewFalseNegativeFailures([{ id: 'r1', target: 'api.example', payload: 'id=1', laterFoundManually: true, originalVerdict: 'failed' }]);
  return (<Card title="False-Negative Failure Reviews" note="Idea 53520"><Kv k="Reviews" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w88b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export const WAVE88_B_COMPONENTS = [
  KbLegalReviewQueue, KbCommunityContributions, KbArticleImpactScores, KbSemanticDeduplication,
  KbOnboardingChecklists, KbHuntCitationRequirements, KbKnowledgeGraphVisualizations,
  KbAnnualGrowthReport, FailureTaxonomy, NearMissPayloadDetection,
  BlockedVsPatchedDifferentiation, FilterFingerprintingFromFailures, FailureClustering,
  PayloadAutopsyReports, FailureCostAccounting, SurvivorshipBiasCorrection,
  FailureDrivenMutationSuggestions, TimeToFailureAnalysis, FailureSignalLibraries,
  FalseNegativeFailureReviews,
];

export function Wave88BGallery() {
  return (
    <div className="w88b-gallery">
      {WAVE88_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
