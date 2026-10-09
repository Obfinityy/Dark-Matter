/**
 * Wave100A.jsx — Infinity AI · Wave 100
 * 20 working React components for debrief delivery operations, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X100A from './wave100ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w100a-card">
      <div className="w100a-title">{title}</div>
      {note ? <div className="w100a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w100a-badge w100a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w100a-kv">
      <span className="w100a-k">{k}</span>
      <span className="w100a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w100a-bar-row">
      <span className="w100a-k">{label}</span>
      <div className="w100a-bar"><div className="w100a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w100a-v">{value}</span>
    </div>
  );
}

export function DebriefMultilingualGeneration() {
  const data = [
    { debriefId: 'dbr-1', language: 'es', sectionsTotal: 8, sectionsTranslated: 8 },
    { debriefId: 'dbr-2', language: 'fr', sectionsTotal: 8, sectionsTranslated: 3 },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X100A.generateMultilingualDebriefs(data);
  const rows = readyOnly ? v.rows.filter(r => r.localized) : v.rows;
  return (
    <Card title="DebriefMultilingualGeneration" note="Idea 53961">
      <Kv k="Localized" v={v.localizedCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all debriefs' : 'Show localized only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} ${r.language}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefRedactionControls() {
  const data = [
    { debriefId: 'dbr-1', sensitiveItems: 5, redactedItems: 5, distributionTier: 'public' },
    { debriefId: 'dbr-2', sensitiveItems: 4, redactedItems: 1, distributionTier: 'partner' },
  ];
  const [safeOnly, setSafeOnly] = useState(false);
  const v = X100A.applyDebriefRedactionControls(data);
  const rows = safeOnly ? v.rows.filter(r => r.safeToShare) : v.rows;
  return (
    <Card title="DebriefRedactionControls" note="Idea 53962">
      <Kv k="Safe to share" v={v.safeCount} />
      <button type="button" onClick={() => setSafeOnly(f => !f)}>{safeOnly ? 'Show all debriefs' : 'Show safe only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.debriefId} value={r.redactionRate} max={1} />)}
    </Card>
  );
}
export function DebriefArchiveSearch() {
  const data = [
    { debriefId: 'dbr-1', title: 'api-hunt-debrief', indexedFields: 10, totalFields: 10 },
    { debriefId: 'dbr-2', title: 'web-hunt-debrief', indexedFields: 4, totalFields: 10 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X100A.searchDebriefArchive(data);
  const rows = fullOnly ? v.rows.filter(r => r.searchable) : v.rows;
  return (
    <Card title="DebriefArchiveSearch" note="Idea 53963">
      <Kv k="Searchable" v={v.searchableCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all archive' : 'Show searchable only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.debriefId} v={r.status} />)}
    </Card>
  );
}
export function DebriefToTicketConversion() {
  const data = [
    { debriefId: 'dbr-1', actionItems: 6, ticketsCreated: 6 },
    { debriefId: 'dbr-2', actionItems: 5, ticketsCreated: 2 },
  ];
  const [doneOnly, setDoneOnly] = useState(false);
  const v = X100A.convertDebriefToTickets(data);
  const rows = doneOnly ? v.rows.filter(r => r.converted) : v.rows;
  return (
    <Card title="DebriefToTicketConversion" note="Idea 53964">
      <Kv k="Converted" v={v.convertedCount} />
      <button type="button" onClick={() => setDoneOnly(f => !f)}>{doneOnly ? 'Show all debriefs' : 'Show converted only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} tickets`} v={r.ticketsCreated} />)}
    </Card>
  );
}
export function DebriefQualityScoring() {
  const data = [
    { debriefId: 'dbr-1', completeness: 0.9, clarity: 0.85, actionability: 0.8 },
    { debriefId: 'dbr-2', completeness: 0.4, clarity: 0.5, actionability: 0.3 },
  ];
  const [passOnly, setPassOnly] = useState(false);
  const v = X100A.scoreDebriefQuality(data);
  const rows = passOnly ? v.rows.filter(r => r.passing) : v.rows;
  return (
    <Card title="DebriefQualityScoring" note="Idea 53965">
      <Kv k="Passing" v={v.passingCount} />
      <button type="button" onClick={() => setPassOnly(f => !f)}>{passOnly ? 'Show all debriefs' : 'Show passing only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} quality`} v={r.qualityScore} />)}
    </Card>
  );
}
export function DebriefPeerReview() {
  const data = [
    { debriefId: 'dbr-1', reviewersAssigned: 2, reviewsCompleted: 2, revisionsRequested: 0 },
    { debriefId: 'dbr-2', reviewersAssigned: 2, reviewsCompleted: 1, revisionsRequested: 1 },
  ];
  const [clearedOnly, setClearedOnly] = useState(false);
  const v = X100A.runDebriefPeerReview(data);
  const rows = clearedOnly ? v.rows.filter(r => r.cleared) : v.rows;
  return (
    <Card title="DebriefPeerReview" note="Idea 53966">
      <Kv k="Cleared" v={v.clearedCount} />
      <button type="button" onClick={() => setClearedOnly(f => !f)}>{clearedOnly ? 'Show all debriefs' : 'Show cleared only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} status`} v={r.status} />)}
    </Card>
  );
}
export function DebriefVersionControl() {
  const data = [
    { debriefId: 'dbr-1', version: 3, findingsRevalidated: 4, findingsCorrected: 1 },
    { debriefId: 'dbr-2', version: 1, findingsRevalidated: 0, findingsCorrected: 0 },
  ];
  const [trackedOnly, setTrackedOnly] = useState(false);
  const v = X100A.versionDebriefs(data);
  const rows = trackedOnly ? v.rows.filter(r => r.versioned) : v.rows;
  return (
    <Card title="DebriefVersionControl" note="Idea 53967">
      <Kv k="Version-tracked" v={v.trackedCount} />
      <button type="button" onClick={() => setTrackedOnly(f => !f)}>{trackedOnly ? 'Show all versions' : 'Show tracked only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} v${r.version}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefStakeholderAnalytics() {
  const data = [
    { debriefId: 'dbr-1', stakeholder: 'exec-a', opened: true, focusScore: 0.8, timeSpentMinutes: 12 },
    { debriefId: 'dbr-1', stakeholder: 'eng-b', opened: false, focusScore: 0, timeSpentMinutes: 0 },
  ];
  const [engagedOnly, setEngagedOnly] = useState(false);
  const v = X100A.trackDebriefStakeholderAnalytics(data);
  const rows = engagedOnly ? v.rows.filter(r => r.engaged) : v.rows;
  return (
    <Card title="DebriefStakeholderAnalytics" note="Idea 53968">
      <Kv k="Engaged" v={v.engagedCount} />
      <button type="button" onClick={() => setEngagedOnly(f => !f)}>{engagedOnly ? 'Show all readers' : 'Show engaged only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.stakeholder} v={r.status} />)}
    </Card>
  );
}
export function DebriefFollowUpTracking() {
  const data = [
    { debriefId: 'dbr-1', recommendations: 5, actedOn: 5, overdueCount: 0 },
    { debriefId: 'dbr-2', recommendations: 4, actedOn: 1, overdueCount: 2 },
  ];
  const [doneOnly, setDoneOnly] = useState(false);
  const v = X100A.trackDebriefFollowUps(data);
  const rows = doneOnly ? v.rows.filter(r => r.followedUp) : v.rows;
  return (
    <Card title="DebriefFollowUpTracking" note="Idea 53969">
      <Kv k="Fully followed" v={v.followedCount} />
      <button type="button" onClick={() => setDoneOnly(f => !f)}>{doneOnly ? 'Show all debriefs' : 'Show followed only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.debriefId} value={r.actionRate} max={1} />)}
    </Card>
  );
}
export function DebriefKnowledgeBaseLinks() {
  const data = [
    { debriefId: 'dbr-1', sections: 6, kbLinks: 6 },
    { debriefId: 'dbr-2', sections: 6, kbLinks: 2 },
  ];
  const [links, setLinks] = useState(6);
  const v = X100A.linkDebriefKnowledgeBase([{ ...data[0], kbLinks: links }, data[1]]);
  return (
    <Card title="DebriefKnowledgeBaseLinks" note="Idea 53970">
      <Kv k="Fully linked" v={v.linkedCount} />
      <label className="w100a-field">First debrief links ({links})
        <input type="range" min="0" max="6" value={links} onChange={e => setLinks(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.debriefId} coverage`} v={r.linkCoverage} />)}
    </Card>
  );
}
export function DebriefReplayEmbeds() {
  const data = [
    { debriefId: 'dbr-1', findingsCount: 4, replayEmbeds: 4 },
    { debriefId: 'dbr-2', findingsCount: 5, replayEmbeds: 1 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X100A.embedDebriefReplays(data);
  const rows = fullOnly ? v.rows.filter(r => r.embedded) : v.rows;
  return (
    <Card title="DebriefReplayEmbeds" note="Idea 53971">
      <Kv k="Embedded" v={v.embeddedCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all debriefs' : 'Show embedded only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} embeds`} v={r.replayEmbeds} />)}
    </Card>
  );
}
export function DebriefCostBreakdowns() {
  const data = [
    { huntId: 'hunt-1', totalCost: 1200, findingsCount: 4, hoursSpent: 20 },
    { huntId: 'hunt-2', totalCost: 4000, findingsCount: 2, hoursSpent: 30 },
  ];
  const [cost, setCost] = useState(1200);
  const v = X100A.buildDebriefCostBreakdowns([{ ...data[0], totalCost: cost }, data[1]]);
  return (
    <Card title="DebriefCostBreakdowns" note="Idea 53972">
      <Kv k="Efficient" v={v.efficientCount} />
      <label className="w100a-field">First hunt total cost ({cost})
        <input type="range" min="200" max="5000" step="100" value={cost} onChange={e => setCost(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.huntId} per finding`} v={r.costPerFinding} />)}
    </Card>
  );
}
export function DebriefCoverageMaps() {
  const data = [
    { huntId: 'hunt-1', endpointsTotal: 50, endpointsTested: 45 },
    { huntId: 'hunt-2', endpointsTotal: 50, endpointsTested: 10 },
  ];
  const [tested, setTested] = useState(45);
  const v = X100A.buildDebriefCoverageMaps([{ ...data[0], endpointsTested: tested }, data[1]]);
  return (
    <Card title="DebriefCoverageMaps" note="Idea 53973">
      <Kv k="Well covered" v={v.coveredCount} />
      <label className="w100a-field">First hunt endpoints tested ({tested})
        <input type="range" min="0" max="50" value={tested} onChange={e => setTested(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.huntId} value={r.coverage} max={1} />)}
    </Card>
  );
}
export function DebriefRiskNarratives() {
  const data = [
    { huntId: 'hunt-1', findingsCount: 3, businessRiskScore: 0.8, narrativeSections: 3 },
    { huntId: 'hunt-2', findingsCount: 4, businessRiskScore: 0.6, narrativeSections: 1 },
  ];
  const [framedOnly, setFramedOnly] = useState(false);
  const v = X100A.buildDebriefRiskNarratives(data);
  const rows = framedOnly ? v.rows.filter(r => r.framed) : v.rows;
  return (
    <Card title="DebriefRiskNarratives" note="Idea 53974">
      <Kv k="Risk-framed" v={v.framedCount} />
      <button type="button" onClick={() => setFramedOnly(f => !f)}>{framedOnly ? 'Show all hunts' : 'Show framed only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} exposure`} v={r.exposure} />)}
    </Card>
  );
}
export function DebriefRemediationGuidance() {
  const data = [
    { findingId: 'f-1', priorityScore: 0.9, stepsProvided: 4, stepsTotal: 4 },
    { findingId: 'f-2', priorityScore: 0.5, stepsProvided: 1, stepsTotal: 4 },
  ];
  const [doneOnly, setDoneOnly] = useState(false);
  const v = X100A.buildDebriefRemediationGuidance(data);
  const rows = doneOnly ? v.rows.filter(r => r.guided) : v.rows;
  return (
    <Card title="DebriefRemediationGuidance" note="Idea 53975">
      <Kv k="Guidance complete" v={v.guidedCount} />
      <button type="button" onClick={() => setDoneOnly(f => !f)}>{doneOnly ? 'Show all findings' : 'Show complete only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.findingId} coverage`} v={r.guidanceCoverage} />)}
    </Card>
  );
}
export function DebriefTrendContext() {
  const data = [
    { huntId: 'hunt-1', findingsCount: 9, fleetAverage: 4 },
    { huntId: 'hunt-2', findingsCount: 4, fleetAverage: 4 },
  ];
  const [findings, setFindings] = useState(9);
  const v = X100A.addDebriefTrendContext([{ ...data[0], findingsCount: findings }, data[1]]);
  return (
    <Card title="DebriefTrendContext" note="Idea 53976">
      <Kv k="Outliers" v={v.outlierCount} />
      <label className="w100a-field">First hunt findings ({findings})
        <input type="range" min="0" max="15" value={findings} onChange={e => setFindings(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.huntId} trend`} v={r.trend} />)}
    </Card>
  );
}
export function DebriefComplianceMapping() {
  const data = [
    { findingId: 'f-1', framework: 'soc2', controlsMapped: 5, controlsTotal: 5 },
    { findingId: 'f-2', framework: 'pci', controlsMapped: 2, controlsTotal: 5 },
  ];
  const [mappedOnly, setMappedOnly] = useState(false);
  const v = X100A.mapDebriefCompliance(data);
  const rows = mappedOnly ? v.rows.filter(r => r.mapped) : v.rows;
  return (
    <Card title="DebriefComplianceMapping" note="Idea 53977">
      <Kv k="Fully mapped" v={v.mappedCount} />
      <button type="button" onClick={() => setMappedOnly(f => !f)}>{mappedOnly ? 'Show all findings' : 'Show mapped only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.findingId} ${r.framework}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefAttestationStatements() {
  const data = [
    { huntId: 'hunt-1', methodologySteps: 6, attestedSteps: 6, signed: true },
    { huntId: 'hunt-2', methodologySteps: 6, attestedSteps: 2, signed: false },
  ];
  const [signedOnly, setSignedOnly] = useState(false);
  const v = X100A.buildDebriefAttestations(data);
  const rows = signedOnly ? v.rows.filter(r => r.attested) : v.rows;
  return (
    <Card title="DebriefAttestationStatements" note="Idea 53978">
      <Kv k="Attested" v={v.attestedCount} />
      <button type="button" onClick={() => setSignedOnly(f => !f)}>{signedOnly ? 'Show all hunts' : 'Show attested only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} status`} v={r.status} />)}
    </Card>
  );
}
export function DebriefWatermarking() {
  const data = [
    { debriefId: 'dbr-1', recipient: 'client-a', watermarked: true, copiesShared: 2 },
    { debriefId: 'dbr-2', recipient: 'partner-b', watermarked: false, copiesShared: 3 },
  ];
  const [safeOnly, setSafeOnly] = useState(false);
  const v = X100A.applyDebriefWatermarking(data);
  const rows = safeOnly ? v.rows.filter(r => r.protectedCopy) : v.rows;
  return (
    <Card title="DebriefWatermarking" note="Idea 53979">
      <Kv k="Protected copies" v={v.protectedCount} />
      <button type="button" onClick={() => setSafeOnly(f => !f)}>{safeOnly ? 'Show all copies' : 'Show protected only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} ${r.recipient}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefExpiryNotices() {
  const data = [
    { debriefId: 'dbr-1', daysSinceHunt: 10, freshnessDays: 30 },
    { debriefId: 'dbr-2', daysSinceHunt: 90, freshnessDays: 30 },
  ];
  const [days, setDays] = useState(10);
  const v = X100A.applyDebriefExpiryNotices([{ ...data[0], daysSinceHunt: days }, data[1]]);
  return (
    <Card title="DebriefExpiryNotices" note="Idea 53980">
      <Kv k="Fresh" v={v.freshCount} />
      <label className="w100a-field">First debrief age in days ({days})
        <input type="range" min="0" max="120" value={days} onChange={e => setDays(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.debriefId} status`} v={r.status} />)}
      <div className="w100a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE100_A_COMPONENTS = [DebriefMultilingualGeneration, DebriefRedactionControls, DebriefArchiveSearch, DebriefToTicketConversion, DebriefQualityScoring, DebriefPeerReview, DebriefVersionControl, DebriefStakeholderAnalytics, DebriefFollowUpTracking, DebriefKnowledgeBaseLinks, DebriefReplayEmbeds, DebriefCostBreakdowns, DebriefCoverageMaps, DebriefRiskNarratives, DebriefRemediationGuidance, DebriefTrendContext, DebriefComplianceMapping, DebriefAttestationStatements, DebriefWatermarking, DebriefExpiryNotices];

export function Wave100AGallery() {
  return (
    <div className="w100a-gallery">
      {WAVE100_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
