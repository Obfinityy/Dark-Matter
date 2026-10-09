/**
 * Wave83B.jsx — Infinity AI · Wave 83
 * 20 working React components for lesson application and retrospective operations, ideas 53301–53320. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave83BCores.js';


const SAMPLE_APPLICATIONS = [
  { id: 'lesson-1', applied: true, huntId: 'hunt-9', outcome: 'finding' },
  { id: 'lesson-2', applied: false, outcome: 'not-applied' },
];
const SAMPLE_HUNTS = [
  { id: 'hunt-high', findings: 8 },
  { id: 'hunt-dry', findings: 0 },
  { id: 'hunt-incident', findings: 1, incidentAdjacent: true },
];
const SAMPLE_FAILED = [
  { id: 'hunt-dry', findings: 0, instructiveness: 5 },
  { id: 'hunt-ok', findings: 3, instructiveness: 1 },
];
const SAMPLE_LESSONS = [
  { id: 'lesson-1', title: 'Check auth first', text: 'Always check auth on admin endpoints', targetClass: 'web', stack: 'node', views: 1, ageDays: 200, upvotes: 6, challenges: 1 },
  { id: 'lesson-2', title: 'Map routes early', text: 'Map every route before deep testing begins', targetClass: 'web', stack: 'node', views: 40, ageDays: 10, upvotes: 1, challenges: 4 },
];
const SAMPLE_RESEARCHERS = [
  { name: 'researcher-a', ownedCount: 2 },
  { name: 'researcher-b', ownedCount: 0 },
];
const SAMPLE_RETROS = [
  { id: 'retro-1', researcherMinutes: 10, automatedMinutes: 20, text: 'Great progress, learned a clear workflow' },
  { id: 'retro-2', researcherMinutes: 25, automatedMinutes: 5, text: 'Frustrated and stuck, blocked all hunt' },
];
const SAMPLE_EXTERNAL = [
  { id: 'ext-1', title: 'Auth bypass write-up', tags: ['auth'], sanitized: true },
  { id: 'ext-2', title: 'Random notes', tags: ['random'], sanitized: true },
];
const SAMPLE_HISTORY = [
  { facilitator: 'researcher-a', at: '2026-09-01' },
  { facilitator: 'researcher-a', at: '2026-09-15' },
];
const SAMPLE_ROSTER = [
  { name: 'researcher-a' },
  { name: 'researcher-b' },
];
const SAMPLE_BRIEFED = [
  { findings: 4 },
  { findings: 5 },
];
const SAMPLE_CONTROL = [
  { findings: 1 },
  { findings: 2 },
];
const SAMPLE_ITEMS = [
  { id: 'item-1', owner: 'researcher-a', deadline: '2026-10-01', status: 'open' },
  { id: 'item-2', owner: 'researcher-b', deadline: '2026-12-01', status: 'done' },
];


function Card({ title, note, children }) {
  return (
    <div className="w83b-card">
      <div className="w83b-title">{title}</div>
      {note ? <div className="w83b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w83b-badge w83b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w83b-kv">
      <span className="w83b-k">{k}</span>
      <span className="w83b-v">{String(v)}</span>
    </div>
  );
}


export function LessonApplicationTracking() {
  const v = XB.trackLessonApplications(SAMPLE_APPLICATIONS);
  return (<Card title="Lesson Application Tracking" note="Idea 53301"><Kv k="Applications" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function RetrospectiveTemplatesPerOutcome() {
  const v = XB.assignRetrospectiveTemplates(SAMPLE_HUNTS);
  return (<Card title="Retrospective Templates per Outcome" note="Idea 53302"><Kv k="Hunts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function FailureCelebrationRituals() {
  const v = XB.selectFailureCelebrations(SAMPLE_FAILED);
  return (<Card title="Failure Celebration Rituals" note="Idea 53303"><Kv k="Celebrated" v={v.celebratedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonOwnershipAssignment() {
  const v = XB.assignLessonOwnership(SAMPLE_LESSONS, SAMPLE_RESEARCHERS);
  return (<Card title="Lesson Ownership Assignment" note="Idea 53304"><Kv k="Assigned" v={v.assignedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function RetrospectiveTimeBoxing() {
  const v = XB.auditRetrospectiveTimeBoxing(SAMPLE_RETROS);
  return (<Card title="Retrospective Time-Boxing" note="Idea 53305"><Kv k="Within box" v={v.withinCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonConfidenceLabels() {
  const v = XB.labelLessonConfidence([{ id: 'proven', supportingHunts: 6 }, { id: 'anecdotal', supportingHunts: 1 }]);
  return (<Card title="Lesson Confidence Labels" note="Idea 53306"><Kv k="Proven" v={v.provenCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function ExternalLessonImports() {
  const v = XB.importExternalLessons(SAMPLE_EXTERNAL);
  return (<Card title="External Lesson Imports" note="Idea 53307"><Kv k="Imported" v={v.importedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonGapAnalysis() {
  const v = XB.analyzeLessonGaps(SAMPLE_LESSONS);
  return (<Card title="Lesson Gap Analysis" note="Idea 53308"><Kv k="Gaps" v={v.gapCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function RetrospectiveSentimentTracking() {
  const v = XB.trackRetrospectiveSentiment(SAMPLE_RETROS);
  return (<Card title="Retrospective Sentiment Tracking" note="Idea 53309"><Kv k="Entries" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonDrivenTrainingModules() {
  const v = XB.buildLessonTrainingModules([{ id: 'short', title: 'Short lesson', text: 'Check auth first' }, { id: 'long', title: 'Long lesson', text: Array(900).fill('word').join(' ') }]);
  return (<Card title="Lesson-Driven Training Modules" note="Idea 53310"><Kv k="Modules" v={v.moduleCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function HuntStoryArchives() {
  const v = XB.archiveHuntStories([{ id: 'hunt-1', target: 'shop', narrative: Array(60).fill('story').join(' ') }]);
  return (<Card title="Hunt Story Archives" note="Idea 53311"><Kv k="Archived" v={v.archivedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonVersioning() {
  const v = XB.trackLessonVersions([{ id: 'lesson-1', version: 3, history: [{ reason: 'initial' }, { reason: 'refined' }, { reason: 'corrected' }] }]);
  return (<Card title="Lesson Versioning" note="Idea 53312"><Kv k="Revised" v={v.revisedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function RetrospectiveFacilitatorRotation() {
  const v = XB.rotateRetrospectiveFacilitators(SAMPLE_HISTORY, SAMPLE_ROSTER);
  return (<Card title="Retrospective Facilitator Rotation" note="Idea 53313"><Kv k="Next" v={v.nextFacilitator ?? ''} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonAPIForAgents() {
  const v = XB.buildLessonAPIForAgents(SAMPLE_LESSONS, { targetClass: 'web' });
  return (<Card title="Lesson API for Agents" note="Idea 53314"><Kv k="Results" v={v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function PreHuntLessonBriefings() {
  const v = XB.buildPreHuntLessonBriefings({ targetClass: 'web', stack: 'node', focus: 'auth' }, SAMPLE_LESSONS);
  return (<Card title="Pre-Hunt Lesson Briefings" note="Idea 53315"><Kv k="Briefing" v={v.briefingCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonEffectivenessABTests() {
  const v = XB.testLessonEffectivenessAB(SAMPLE_BRIEFED, SAMPLE_CONTROL);
  return (<Card title="Lesson Effectiveness A/B Tests" note="Idea 53316"><Kv k="Uplift" v={v.uplift ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function RetrospectiveActionItemTracking() {
  const v = XB.trackRetrospectiveActionItems(SAMPLE_ITEMS);
  return (<Card title="Retrospective Action Item Tracking" note="Idea 53317"><Kv k="Overdue" v={v.overdueCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonAttributionInReports() {
  const v = XB.attributeLessonsInReports({ hunt: 'hunt-9', influencedBy: ['lesson-1', 'lesson-2'] });
  return (<Card title="Lesson Attribution in Reports" note="Idea 53318"><Kv k="Citations" v={v.attributedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function QuietLessonsSurfacing() {
  const v = XB.surfaceQuietLessons(SAMPLE_LESSONS, { targetClass: 'web', stack: 'node' });
  return (<Card title="Quiet Lessons Surfacing" note="Idea 53319"><Kv k="Resurfaced" v={v.resurfacedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonQualityPeerReview() {
  const v = XB.reviewLessonQualityPeer(SAMPLE_LESSONS);
  return (<Card title="Lesson Quality Peer Review" note="Idea 53320"><Kv k="Trusted" v={v.trustedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


const W83_B_GALLERY = [
  LessonApplicationTracking,
  RetrospectiveTemplatesPerOutcome,
  FailureCelebrationRituals,
  LessonOwnershipAssignment,
  RetrospectiveTimeBoxing,
  LessonConfidenceLabels,
  ExternalLessonImports,
  LessonGapAnalysis,
  RetrospectiveSentimentTracking,
  LessonDrivenTrainingModules,
  HuntStoryArchives,
  LessonVersioning,
  RetrospectiveFacilitatorRotation,
  LessonAPIForAgents,
  PreHuntLessonBriefings,
  LessonEffectivenessABTests,
  RetrospectiveActionItemTracking,
  LessonAttributionInReports,
  QuietLessonsSurfacing,
  LessonQualityPeerReview,
];

/** Gallery: renders every Wave 83B component, export-only. */
export function Wave83BGallery() {
  return (
    <div className="w83b-gallery">
      {W83_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
