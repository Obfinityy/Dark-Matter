/**
 * Wave99B.jsx — Infinity AI · Wave 99
 * 11 working React components for hunt debrief operations, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X99B from './wave99BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w99b-card">
      <div className="w99b-title">{title}</div>
      {note ? <div className="w99b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w99b-badge w99b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w99b-kv">
      <span className="w99b-k">{k}</span>
      <span className="w99b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w99b-bar-row">
      <span className="w99b-k">{label}</span>
      <div className="w99b-bar"><div className="w99b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w99b-v">{value}</span>
    </div>
  );
}

export function OnePageHuntDebriefs() {
  const data = [
    { huntId: 'hunt-alpha', findingsCount: 6, wordCount: 350, maxWords: 400 },
    { huntId: 'hunt-beta', findingsCount: 9, wordCount: 720, maxWords: 400 },
  ];
  const [fitsOnly, setFitsOnly] = useState(false);
  const v = X99B.buildOnePageHuntDebriefs(data);
  const rows = fitsOnly ? v.rows.filter(r => r.fits) : v.rows;
  return (
    <Card title="OnePageHuntDebriefs" note="Idea 53950">
      <Kv k="One-page" v={v.fitsCount} />
      <button type="button" onClick={() => setFitsOnly(f => !f)}>{fitsOnly ? 'Show all hunts' : 'Show one-page only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} words`} v={r.wordCount} />)}
    </Card>
  );
}
export function ExecutiveDebriefSummaries() {
  const data = [
    { huntId: 'hunt-alpha', riskScore: 0.8, businessImpact: 9000, plainLanguageScore: 0.85 },
    { huntId: 'hunt-beta', riskScore: 0.6, businessImpact: 4000, plainLanguageScore: 0.4 },
  ];
  const [impact, setImpact] = useState(9000);
  const v = X99B.buildExecutiveDebriefSummaries([{ ...data[0], businessImpact: impact }, data[1]]);
  return (
    <Card title="ExecutiveDebriefSummaries" note="Idea 53951">
      <Kv k="Executive-ready" v={v.readyCount} />
      <label className="w99b-field">First hunt business impact ({impact})
        <input type="range" min="0" max="20000" step="500" value={impact} onChange={e => setImpact(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.huntId} status`} v={r.status} />)}
    </Card>
  );
}
export function TechnicalDeepDiveDebriefs() {
  const data = [
    { huntId: 'hunt-alpha', findingsCount: 4, evidenceItems: 6, reproductionSteps: 5 },
    { huntId: 'hunt-beta', findingsCount: 5, evidenceItems: 2, reproductionSteps: 1 },
  ];
  const [completeOnly, setCompleteOnly] = useState(false);
  const v = X99B.buildTechnicalDeepDiveDebriefs(data);
  const rows = completeOnly ? v.rows.filter(r => r.complete) : v.rows;
  return (
    <Card title="TechnicalDeepDiveDebriefs" note="Idea 53952">
      <Kv k="Complete" v={v.completeCount} />
      <button type="button" onClick={() => setCompleteOnly(f => !f)}>{completeOnly ? 'Show all hunts' : 'Show complete only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} evidence per finding`} v={r.evidencePerFinding} />)}
    </Card>
  );
}
export function DebriefNarrativeGeneration() {
  const data = [
    { huntId: 'hunt-alpha', findingsCount: 5, timelineEvents: 8, toneScore: 0.8 },
    { huntId: 'hunt-beta', findingsCount: 1, timelineEvents: 1, toneScore: 0.5 },
  ];
  const [events, setEvents] = useState(8);
  const v = X99B.generateDebriefNarratives([{ ...data[0], timelineEvents: events }, data[1]]);
  return (
    <Card title="DebriefNarrativeGeneration" note="Idea 53953">
      <Kv k="Narrative-ready" v={v.readyCount} />
      <label className="w99b-field">First hunt timeline events ({events})
        <input type="range" min="0" max="20" value={events} onChange={e => setEvents(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.huntId} status`} v={r.status} />)}
    </Card>
  );
}
export function DebriefFindingTimelines() {
  const data = [
    { huntId: 'hunt-alpha', findingId: 'f-1', discoveredHour: 2, verifiedHour: 3 },
    { huntId: 'hunt-alpha', findingId: 'f-2', discoveredHour: 5, verifiedHour: 12 },
    { huntId: 'hunt-beta', findingId: 'f-3', discoveredHour: 1, verifiedHour: 2 },
  ];
  const [fastOnly, setFastOnly] = useState(false);
  const v = X99B.buildDebriefFindingTimelines(data);
  const rows = fastOnly ? v.rows.filter(r => r.fastTrack) : v.rows;
  return (
    <Card title="DebriefFindingTimelines" note="Idea 53954">
      <Kv k="Fast-tracked" v={v.fastTrackCount} />
      <button type="button" onClick={() => setFastOnly(f => !f)}>{fastOnly ? 'Show full timeline' : 'Show fast-track only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.findingId} verify lag`} v={r.verifyLag} />)}
    </Card>
  );
}
export function DebriefStrategyAnnotations() {
  const data = [
    { huntId: 'hunt-alpha', strategyNote: 'Pivoted to API after recon stalled', decisionCount: 4, outcomesLinked: 4 },
    { huntId: 'hunt-beta', strategyNote: '', decisionCount: 0, outcomesLinked: 0 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X99B.annotateDebriefStrategy(data);
  const rows = fullOnly ? v.rows.filter(r => r.status === 'fully-annotated') : v.rows;
  return (
    <Card title="DebriefStrategyAnnotations" note="Idea 53955">
      <Kv k="Fully annotated" v={v.fullyCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all debriefs' : 'Show fully annotated only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.huntId} value={r.linkRate} max={1} />)}
    </Card>
  );
}
export function DebriefLessonExtraction() {
  const data = [
    { huntId: 'hunt-alpha', rawNotes: 10, lessonsExtracted: 6, reusableLessons: 4 },
    { huntId: 'hunt-beta', rawNotes: 3, lessonsExtracted: 1, reusableLessons: 0 },
  ];
  const [bankedOnly, setBankedOnly] = useState(false);
  const v = X99B.extractDebriefLessons(data);
  const rows = bankedOnly ? v.rows.filter(r => r.productive) : v.rows;
  return (
    <Card title="DebriefLessonExtraction" note="Idea 53956">
      <Kv k="Lessons banked" v={v.bankedCount} />
      <button type="button" onClick={() => setBankedOnly(f => !f)}>{bankedOnly ? 'Show all debriefs' : 'Show banked only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} reusable`} v={r.reusableLessons} />)}
    </Card>
  );
}
export function DebriefComparisonViews() {
  const data = [
    { huntId: 'hunt-new', baselineHuntId: 'hunt-old', findingsDelta: 3, durationDeltaHours: -2 },
    { huntId: 'hunt-flat', baselineHuntId: 'hunt-old', findingsDelta: -1, durationDeltaHours: 4 },
  ];
  const [improvedOnly, setImprovedOnly] = useState(false);
  const v = X99B.buildDebriefComparisonViews(data);
  const rows = improvedOnly ? v.rows.filter(r => r.improved) : v.rows;
  return (
    <Card title="DebriefComparisonViews" note="Idea 53957">
      <Kv k="Improved" v={v.improvedCount} />
      <button type="button" onClick={() => setImprovedOnly(f => !f)}>{improvedOnly ? 'Show all pairs' : 'Show improved only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} vs ${r.baselineHuntId}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefDistributionLists() {
  const data = [
    { huntId: 'hunt-alpha', recipients: ['team', 'leads', 'security'], requiredRoles: ['team', 'leads', 'security'], sentCount: 3 },
    { huntId: 'hunt-beta', recipients: ['team'], requiredRoles: ['team', 'leads'], sentCount: 1 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X99B.buildDebriefDistributionLists(data);
  const rows = fullOnly ? v.rows.filter(r => r.fullyDistributed) : v.rows;
  return (
    <Card title="DebriefDistributionLists" note="Idea 53958">
      <Kv k="Fully distributed" v={v.fullCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all debriefs' : 'Show fully distributed only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.huntId} missing roles`} v={r.missingCount} />)}
    </Card>
  );
}
export function DebriefFeedbackCollection() {
  const data = [
    { huntId: 'hunt-alpha', responses: 8, readers: 10, averageRating: 4.6 },
    { huntId: 'hunt-beta', responses: 1, readers: 10, averageRating: 3.1 },
  ];
  const [rating, setRating] = useState(4.6);
  const v = X99B.collectDebriefFeedback([{ ...data[0], averageRating: rating }, data[1]]);
  return (
    <Card title="DebriefFeedbackCollection" note="Idea 53959">
      <Kv k="Well received" v={v.wellReceivedCount} />
      <label className="w99b-field">First debrief average rating ({rating})
        <input type="range" min="1" max="5" step="0.1" value={rating} onChange={e => setRating(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.huntId} rating`} v={r.averageRating} />)}
    </Card>
  );
}
export function DebriefTemplateCustomization() {
  const data = [
    { team: 'red', templateId: 'debrief-v2', sectionsCustomized: 4, sectionsTotal: 6, active: true },
    { team: 'blue', templateId: 'debrief-v1', sectionsCustomized: 0, sectionsTotal: 6, active: true },
  ];
  const [tailoredOnly, setTailoredOnly] = useState(false);
  const v = X99B.customizeDebriefTemplates(data);
  const rows = tailoredOnly ? v.rows.filter(r => r.tailored) : v.rows;
  return (
    <Card title="DebriefTemplateCustomization" note="Idea 53960">
      <Kv k="Tailored" v={v.tailoredCount} />
      <button type="button" onClick={() => setTailoredOnly(f => !f)}>{tailoredOnly ? 'Show all templates' : 'Show tailored only'}</button>
      {rows.map(r => <Bar key={r.key} label={`${r.team} ${r.templateId}`} value={r.customizationRate} max={1} />)}
      <div className="w99b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE99_B_COMPONENTS = [OnePageHuntDebriefs, ExecutiveDebriefSummaries, TechnicalDeepDiveDebriefs, DebriefNarrativeGeneration, DebriefFindingTimelines, DebriefStrategyAnnotations, DebriefLessonExtraction, DebriefComparisonViews, DebriefDistributionLists, DebriefFeedbackCollection, DebriefTemplateCustomization];

export function Wave99BGallery() {
  return (
    <div className="w99b-gallery">
      {WAVE99_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
