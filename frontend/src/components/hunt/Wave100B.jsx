/**
 * Wave100B.jsx — Infinity AI · Wave 100
 * 20 working React components for debrief delivery operations, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X100B from './wave100BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w100b-card">
      <div className="w100b-title">{title}</div>
      {note ? <div className="w100b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w100b-badge w100b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w100b-kv">
      <span className="w100b-k">{k}</span>
      <span className="w100b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w100b-bar-row">
      <span className="w100b-k">{label}</span>
      <div className="w100b-bar"><div className="w100b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w100b-v">{value}</span>
    </div>
  );
}

export function DebriefCollaborationComments() {
  const data = [
    { debriefId: 'dbr-1', section: 'findings', comments: 4, resolvedComments: 4 },
    { debriefId: 'dbr-1', section: 'risks', comments: 3, resolvedComments: 1 },
  ];
  const [doneOnly, setDoneOnly] = useState(false);
  const v = X100B.manageDebriefCollaborationComments(data);
  const rows = doneOnly ? v.rows.filter(r => r.resolved) : v.rows;
  return (
    <Card title="DebriefCollaborationComments" note="Idea 53981">
      <Kv k="Threads resolved" v={v.resolvedCount} />
      <button type="button" onClick={() => setDoneOnly(f => !f)}>{doneOnly ? 'Show all sections' : 'Show resolved only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} ${r.section}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefExportFormats() {
  const data = [
    { debriefId: 'dbr-1', format: 'pdf', sectionsTotal: 6, sectionsExported: 6 },
    { debriefId: 'dbr-2', format: 'docx', sectionsTotal: 6, sectionsExported: 3 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X100B.exportDebriefFormats(data);
  const rows = fullOnly ? v.rows.filter(r => r.exported) : v.rows;
  return (
    <Card title="DebriefExportFormats" note="Idea 53982">
      <Kv k="Fully exported" v={v.exportedCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all exports' : 'Show complete only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} ${r.format}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefApiAccess() {
  const data = [
    { debriefId: 'dbr-1', apiEnabled: true, integrations: 2, requestsServed: 140 },
    { debriefId: 'dbr-2', apiEnabled: false, integrations: 0, requestsServed: 0 },
  ];
  const [liveOnly, setLiveOnly] = useState(false);
  const v = X100B.provideDebriefApiAccess(data);
  const rows = liveOnly ? v.rows.filter(r => r.live) : v.rows;
  return (
    <Card title="DebriefApiAccess" note="Idea 53983">
      <Kv k="API live" v={v.liveCount} />
      <button type="button" onClick={() => setLiveOnly(f => !f)}>{liveOnly ? 'Show all debriefs' : 'Show live only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} requests`} v={r.requestsServed} />)}
    </Card>
  );
}
export function DebriefNotificationRules() {
  const data = [
    { stakeholder: 'exec-a', interests: ['critical', 'api'], debriefsPublished: 5, notified: 4 },
    { stakeholder: 'eng-b', interests: [], debriefsPublished: 5, notified: 0 },
  ];
  const [activeOnly, setActiveOnly] = useState(false);
  const v = X100B.applyDebriefNotificationRules(data);
  const rows = activeOnly ? v.rows.filter(r => r.subscribed) : v.rows;
  return (
    <Card title="DebriefNotificationRules" note="Idea 53984">
      <Kv k="Notifying" v={v.activeCount} />
      <button type="button" onClick={() => setActiveOnly(f => !f)}>{activeOnly ? 'Show all stakeholders' : 'Show active only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.stakeholder} notified`} v={r.notified} />)}
    </Card>
  );
}
export function DebriefPersonalization() {
  const data = [
    { stakeholder: 'exec-a', role: 'executive', focusAreas: ['risk', 'cost'], matchedAreas: 2 },
    { stakeholder: 'eng-b', role: 'engineer', focusAreas: ['evidence', 'repro'], matchedAreas: 1 },
  ];
  const [tailoredOnly, setTailoredOnly] = useState(false);
  const v = X100B.personalizeDebriefs(data);
  const rows = tailoredOnly ? v.rows.filter(r => r.tailored) : v.rows;
  return (
    <Card title="DebriefPersonalization" note="Idea 53985">
      <Kv k="Fully tailored" v={v.tailoredCount} />
      <button type="button" onClick={() => setTailoredOnly(f => !f)}>{tailoredOnly ? 'Show all readers' : 'Show tailored only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.stakeholder} value={r.matchRate} max={1} />)}
    </Card>
  );
}
export function DebriefReadingTimeEstimates() {
  const data = [
    { debriefId: 'dbr-1', wordCount: 800, wordsPerMinute: 200 },
    { debriefId: 'dbr-2', wordCount: 4000, wordsPerMinute: 200 },
  ];
  const [words, setWords] = useState(800);
  const v = X100B.estimateDebriefReadingTime([{ ...data[0], wordCount: words }, data[1]]);
  return (
    <Card title="DebriefReadingTimeEstimates" note="Idea 53986">
      <Kv k="Quick reads" v={v.quickCount} />
      <label className="w100b-field">First debrief words ({words})
        <input type="range" min="100" max="6000" step="100" value={words} onChange={e => setWords(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.debriefId} minutes`} v={r.minutes} />)}
    </Card>
  );
}
export function DebriefTldrGeneration() {
  const data = [
    { debriefId: 'dbr-1', wordCount: 2000, summaryWords: 120, keyPoints: 3 },
    { debriefId: 'dbr-2', wordCount: 2000, summaryWords: 900, keyPoints: 2 },
  ];
  const [summary, setSummary] = useState(120);
  const v = X100B.generateDebriefTldr([{ ...data[0], summaryWords: summary }, data[1]]);
  return (
    <Card title="DebriefTldrGeneration" note="Idea 53987">
      <Kv k="Ready" v={v.readyCount} />
      <label className="w100b-field">First summary words ({summary})
        <input type="range" min="20" max="1000" step="10" value={summary} onChange={e => setSummary(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.debriefId} status`} v={r.status} />)}
    </Card>
  );
}
export function DebriefGlossaryInclusion() {
  const data = [
    { debriefId: 'dbr-1', technicalTerms: 12, glossaryTerms: 12 },
    { debriefId: 'dbr-2', technicalTerms: 10, glossaryTerms: 4 },
  ];
  const [terms, setTerms] = useState(12);
  const v = X100B.includeDebriefGlossary([{ ...data[0], glossaryTerms: terms }, data[1]]);
  return (
    <Card title="DebriefGlossaryInclusion" note="Idea 53988">
      <Kv k="Glossary complete" v={v.completeCount} />
      <label className="w100b-field">First debrief defined terms ({terms})
        <input type="range" min="0" max="12" value={terms} onChange={e => setTerms(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.debriefId} coverage`} v={r.glossaryCoverage} />)}
    </Card>
  );
}
export function DebriefVisualDesignStandards() {
  const data = [
    { debriefId: 'dbr-1', checksTotal: 8, checksPassed: 8 },
    { debriefId: 'dbr-2', checksTotal: 8, checksPassed: 5 },
  ];
  const [cleanOnly, setCleanOnly] = useState(false);
  const v = X100B.enforceDebriefVisualStandards(data);
  const rows = cleanOnly ? v.rows.filter(r => r.compliant) : v.rows;
  return (
    <Card title="DebriefVisualDesignStandards" note="Idea 53989">
      <Kv k="Compliant" v={v.compliantCount} />
      <button type="button" onClick={() => setCleanOnly(f => !f)}>{cleanOnly ? 'Show all debriefs' : 'Show compliant only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} pass rate`} v={r.passRate} />)}
    </Card>
  );
}
export function DebriefAccessibilityCompliance() {
  const data = [
    { debriefId: 'dbr-1', checksTotal: 6, checksPassed: 6, screenReaderSafe: true },
    { debriefId: 'dbr-2', checksTotal: 6, checksPassed: 3, screenReaderSafe: false },
  ];
  const [cleanOnly, setCleanOnly] = useState(false);
  const v = X100B.auditDebriefAccessibilityCompliance(data);
  const rows = cleanOnly ? v.rows.filter(r => r.compliant) : v.rows;
  return (
    <Card title="DebriefAccessibilityCompliance" note="Idea 53990">
      <Kv k="Compliant" v={v.compliantCount} />
      <button type="button" onClick={() => setCleanOnly(f => !f)}>{cleanOnly ? 'Show all debriefs' : 'Show compliant only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} status`} v={r.status} />)}
    </Card>
  );
}
export function DebriefTranslationWorkflows() {
  const data = [
    { debriefId: 'dbr-1', language: 'es', machineTranslated: true, humanReviewed: true },
    { debriefId: 'dbr-2', language: 'fr', machineTranslated: true, humanReviewed: false },
  ];
  const [okOnly, setOkOnly] = useState(false);
  const v = X100B.runDebriefTranslationWorkflows(data);
  const rows = okOnly ? v.rows.filter(r => r.approved) : v.rows;
  return (
    <Card title="DebriefTranslationWorkflows" note="Idea 53991">
      <Kv k="Approved" v={v.approvedCount} />
      <button type="button" onClick={() => setOkOnly(f => !f)}>{okOnly ? 'Show all translations' : 'Show approved only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} ${r.language}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefSentimentCalibration() {
  const data = [
    { debriefId: 'dbr-1', alarmScore: 0.2, informScore: 0.85 },
    { debriefId: 'dbr-2', alarmScore: 0.8, informScore: 0.6 },
  ];
  const [alarmPct, setAlarmPct] = useState(20);
  const v = X100B.calibrateDebriefSentiment([{ ...data[0], alarmScore: alarmPct / 100 }, data[1]]);
  return (
    <Card title="DebriefSentimentCalibration" note="Idea 53992">
      <Kv k="Tone balanced" v={v.balancedCount} />
      <label className="w100b-field">First debrief alarm level ({alarmPct}%)
        <input type="range" min="0" max="100" value={alarmPct} onChange={e => setAlarmPct(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.debriefId} status`} v={r.status} />)}
    </Card>
  );
}
export function DebriefHistoricalComparisons() {
  const data = [
    { target: 'shop-example', currentFindings: 8, historicalAverage: 5, huntsCompared: 4 },
    { target: 'blog-example', currentFindings: 3, historicalAverage: 5, huntsCompared: 3 },
  ];
  const [current, setCurrent] = useState(8);
  const v = X100B.compareDebriefHistorical([{ ...data[0], currentFindings: current }, data[1]]);
  return (
    <Card title="DebriefHistoricalComparisons" note="Idea 53993">
      <Kv k="Ahead of history" v={v.improvedCount} />
      <label className="w100b-field">First target current findings ({current})
        <input type="range" min="0" max="15" value={current} onChange={e => setCurrent(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.target} delta`} v={r.delta} />)}
    </Card>
  );
}
export function DebriefMethodologyAppendices() {
  const data = [
    { huntId: 'hunt-1', methodologySections: 5, requiredSections: 5 },
    { huntId: 'hunt-2', methodologySections: 2, requiredSections: 5 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X100B.appendDebriefMethodology(data);
  const rows = fullOnly ? v.rows.filter(r => r.appended) : v.rows;
  return (
    <Card title="DebriefMethodologyAppendices" note="Idea 53994">
      <Kv k="Appendix complete" v={v.completeCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all hunts' : 'Show complete only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.huntId} value={r.appendixCoverage} max={1} />)}
    </Card>
  );
}
export function DebriefFindingCrossReferences() {
  const data = [
    { findingId: 'f-1', target: 'shop-example', pastReports: 3, linkedReports: 3 },
    { findingId: 'f-2', target: 'shop-example', pastReports: 4, linkedReports: 1 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X100B.crossReferenceDebriefFindings(data);
  const rows = fullOnly ? v.rows.filter(r => r.linked) : v.rows;
  return (
    <Card title="DebriefFindingCrossReferences" note="Idea 53995">
      <Kv k="Fully referenced" v={v.linkedCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all findings' : 'Show referenced only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.findingId} linked`} v={r.linkedReports} />)}
    </Card>
  );
}
export function DebriefActionItemOwners() {
  const data = [
    { debriefId: 'dbr-1', actionItems: 5, assignedOwners: 5 },
    { debriefId: 'dbr-2', actionItems: 4, assignedOwners: 1 },
  ];
  const [ownedOnly, setOwnedOnly] = useState(false);
  const v = X100B.assignDebriefActionItemOwners(data);
  const rows = ownedOnly ? v.rows.filter(r => r.owned) : v.rows;
  return (
    <Card title="DebriefActionItemOwners" note="Idea 53996">
      <Kv k="Fully owned" v={v.ownedCount} />
      <button type="button" onClick={() => setOwnedOnly(f => !f)}>{ownedOnly ? 'Show all debriefs' : 'Show owned only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} unowned`} v={r.unowned} />)}
    </Card>
  );
}
export function DebriefSlaTracking() {
  const data = [
    { debriefId: 'dbr-1', promisedHours: 48, deliveredHours: 30 },
    { debriefId: 'dbr-2', promisedHours: 48, deliveredHours: 70 },
  ];
  const [metOnly, setMetOnly] = useState(false);
  const v = X100B.trackDebriefSla(data);
  const rows = metOnly ? v.rows.filter(r => r.onTime) : v.rows;
  return (
    <Card title="DebriefSlaTracking" note="Idea 53997">
      <Kv k="Timeline met" v={v.metCount} />
      <button type="button" onClick={() => setMetOnly(f => !f)}>{metOnly ? 'Show all debriefs' : 'Show met only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} slack`} v={r.slackHours} />)}
    </Card>
  );
}
export function DebriefEffectivenessSurveys() {
  const data = [
    { debriefId: 'dbr-1', responses: 9, averageValueScore: 4.6 },
    { debriefId: 'dbr-2', responses: 2, averageValueScore: 3.2 },
  ];
  const [score, setScore] = useState(4.6);
  const v = X100B.surveyDebriefEffectiveness([{ ...data[0], averageValueScore: score }, data[1]]);
  return (
    <Card title="DebriefEffectivenessSurveys" note="Idea 53998">
      <Kv k="Highly valued" v={v.valuedCount} />
      <label className="w100b-field">First debrief value score ({score})
        <input type="range" min="1" max="5" step="0.1" value={score} onChange={e => setScore(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.debriefId} score`} v={r.averageValueScore} />)}
    </Card>
  );
}
export function DebriefContinuousImprovement() {
  const data = [
    { templateId: 'tpl-a', surveyIssues: 6, improvementsShipped: 6 },
    { templateId: 'tpl-b', surveyIssues: 5, improvementsShipped: 2 },
  ];
  const [closedOnly, setClosedOnly] = useState(false);
  const v = X100B.driveDebriefContinuousImprovement(data);
  const rows = closedOnly ? v.rows.filter(r => r.improved) : v.rows;
  return (
    <Card title="DebriefContinuousImprovement" note="Idea 53999">
      <Kv k="Loop closed" v={v.closedCount} />
      <button type="button" onClick={() => setClosedOnly(f => !f)}>{closedOnly ? 'Show all templates' : 'Show closed only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.templateId} value={r.improvementRate} max={1} />)}
    </Card>
  );
}
export function DebriefIntegrationWithReports() {
  const data = [
    { debriefId: 'dbr-1', findingsCount: 4, linkedReports: 4 },
    { debriefId: 'dbr-2', findingsCount: 5, linkedReports: 2 },
  ];
  const [linkedOnly, setLinkedOnly] = useState(false);
  const v = X100B.integrateDebriefWithReports(data);
  const rows = linkedOnly ? v.rows.filter(r => r.integrated) : v.rows;
  return (
    <Card title="DebriefIntegrationWithReports" note="Idea 54000">
      <Kv k="Integrated" v={v.integratedCount} />
      <button type="button" onClick={() => setLinkedOnly(f => !f)}>{linkedOnly ? 'Show all debriefs' : 'Show integrated only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} linked`} v={r.linkedReports} />)}
      <div className="w100b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE100_B_COMPONENTS = [DebriefCollaborationComments, DebriefExportFormats, DebriefApiAccess, DebriefNotificationRules, DebriefPersonalization, DebriefReadingTimeEstimates, DebriefTldrGeneration, DebriefGlossaryInclusion, DebriefVisualDesignStandards, DebriefAccessibilityCompliance, DebriefTranslationWorkflows, DebriefSentimentCalibration, DebriefHistoricalComparisons, DebriefMethodologyAppendices, DebriefFindingCrossReferences, DebriefActionItemOwners, DebriefSlaTracking, DebriefEffectivenessSurveys, DebriefContinuousImprovement, DebriefIntegrationWithReports];

export function Wave100BGallery() {
  return (
    <div className="w100b-gallery">
      {WAVE100_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
