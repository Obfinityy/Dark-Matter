/**
 * Wave83A.jsx — Infinity AI · Wave 83
 * 20 working React components for coverage benchmarks and lessons capture, ideas 53281–53300. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave83ACore.js';


const SAMPLE_VERTICALS = [
  { vertical: 'fintech', coverage: 0.8 },
  { vertical: 'fintech', coverage: 0.9 },
  { vertical: 'ecommerce', coverage: 0.5 },
];
const SAMPLE_GAPS = [
  { area: 'checkout', coverage: 0.1, plannedCoverage: 0.7 },
  { area: 'admin', coverage: 0.2, plannedCoverage: 0.7 },
];
const SAMPLE_CURRENT = [
  { area: 'checkout', coverage: 0.8 },
  { area: 'admin', coverage: 0.3 },
];
const SAMPLE_EVENTS = [
  { id: 'gap-checkout', title: 'Checkout gap resolved', impact: 5, resolved: true, at: '2026-10-01' },
  { id: 'gap-admin', title: 'Admin dark area', impact: 2, resolved: false, at: '2026-10-02' },
];
const SAMPLE_HUNTS = [
  { id: 'hunt-1', testedAreas: 9, totalAreas: 10 },
  { id: 'hunt-2', testedAreas: 4, totalAreas: 10 },
];
const SAMPLE_NOTES = [
  { id: 'note-1', researcher: 'researcher-a', durationSec: 45, transcript: 'Auth checks on the admin endpoint need a tool pass', tags: ['technique'] },
  { id: 'note-2', researcher: 'researcher-b', durationSec: 75, transcript: 'Process workflow note', tags: ['process'] },
];
const SAMPLE_LESSONS = [
  { id: 'lesson-auth', title: 'Check auth on every endpoint', text: 'Auth endpoint parameter checks', tags: ['technique'] },
  { id: 'lesson-scanner', title: 'Scanner tooling pass', text: 'Run the scanner tool on upload endpoints', tags: ['unknown-tag'] },
  { id: 'lesson-auth-2', title: 'Check auth on every endpoint', text: 'Auth endpoint parameter checks', tags: ['technique'] },
];
const SAMPLE_PARTICIPANTS = [
  { name: 'researcher-a' },
  { name: 'researcher-b' },
];
const SAMPLE_SUBMISSIONS = [
  { text: 'I missed the admin endpoint, contact me at a@example.com', sensitive: true },
  { text: 'Near-miss on the billing workflow', sensitive: true },
];
const SAMPLE_NEAR_MISS = [
  { id: 'nm-1', type: 'near-miss', almostFound: true, severity: 4 },
  { id: 'ev-1', type: 'finding', severity: 1 },
];
const SAMPLE_DEVIANCE_HUNTS = [
  { id: 'hunt-a', findings: 2, behaviors: ['deep-auth-checks'] },
  { id: 'hunt-b', findings: 3, behaviors: ['deep-auth-checks'] },
  { id: 'hunt-c', findings: 12, behaviors: ['deep-auth-checks', 'route-mapping'] },
];
const SAMPLE_RETROS = [
  { id: 'retro-1', text: 'Tested /admin endpoint parameter header flow with 4 follow-ups', actionItems: 2 },
  { id: 'retro-2', text: 'Looked around', actionItems: 0 },
];
const SAMPLE_LINKED = [
  { id: 'lesson-1', references: ['lesson-2'] },
  { id: 'lesson-2', references: ['lesson-3'] },
  { id: 'lesson-3', references: [] },
];
const SAMPLE_DIGEST = [
  { id: 'lesson-new', title: 'Fresh high impact', impact: 9, ageDays: 1 },
  { id: 'lesson-old', title: 'Old lesson', impact: 10, ageDays: 40 },
];


function Card({ title, note, children }) {
  return (
    <div className="w83a-card">
      <div className="w83a-title">{title}</div>
      {note ? <div className="w83a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w83a-badge w83a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w83a-kv">
      <span className="w83a-k">{k}</span>
      <span className="w83a-v">{String(v)}</span>
    </div>
  );
}


export function CoverageBenchmarkPerVertical() {
  const v = XA.benchmarkCoverageByVertical(SAMPLE_VERTICALS);
  return (<Card title="Coverage Benchmark per Vertical" note="Idea 53281"><Kv k="Verticals" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function CoverageGapFixVerification() {
  const v = XA.verifyCoverageGapFix(SAMPLE_GAPS, SAMPLE_CURRENT);
  return (<Card title="Coverage Gap Fix Verification" note="Idea 53282"><Kv k="Gaps" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function CoverageLessonsFeed() {
  const v = XA.buildCoverageLessonsFeed(SAMPLE_EVENTS);
  return (<Card title="Coverage Lessons Feed" note="Idea 53283"><Kv k="Events" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function CoverageCompletenessCertificates() {
  const v = XA.issueCoverageCompletenessCertificates(SAMPLE_HUNTS);
  return (<Card title="Coverage Completeness Certificates" note="Idea 53284"><Kv k="Hunts" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function AutomatedRetrospectiveDrafts() {
  const v = XA.draftAutomatedRetrospective({ findings: 6, coverage: 0.8, durationMinutes: 90, darkAreas: ['admin'] });
  return (<Card title="Automated Retrospective Drafts" note="Idea 53285"><Kv k="Outcome" v={v.outcome ?? ''} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function ResearcherVoiceNoteCapture() {
  const v = XA.captureResearcherVoiceNotes(SAMPLE_NOTES);
  return (<Card title="Researcher Voice-Note Capture" note="Idea 53286"><Kv k="Notes" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonTaggingTaxonomy() {
  const v = XA.validateLessonTaggingTaxonomy(SAMPLE_LESSONS);
  return (<Card title="Lesson Tagging Taxonomy" note="Idea 53287"><Kv k="Lessons" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonDeduplicationEngine() {
  const v = XA.deduplicateLessons(SAMPLE_LESSONS);
  return (<Card title="Lesson Deduplication Engine" note="Idea 53288"><Kv k="Lessons" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonFreshnessDecay() {
  const v = XA.applyLessonFreshnessDecay([{ id: 'fresh', ageDays: 10, prominence: 1 }, { id: 'stale', ageDays: 500, prominence: 1 }]);
  return (<Card title="Lesson Freshness Decay" note="Idea 53289"><Kv k="Lessons" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function ContradictoryLessonResolution() {
  const v = XA.resolveContradictoryLessons([{ id: 'l1', topic: 'auth', stance: 'always-test' }, { id: 'l2', topic: 'auth', stance: 'skip-if-hardened' }]);
  return (<Card title="Contradictory Lesson Resolution" note="Idea 53290"><Kv k="Contradictions" v={v.contradictionCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonImpactScoring() {
  const v = XA.scoreLessonImpact([{ id: 'high', appliedCount: 4, outcomeChangedCount: 3 }, { id: 'low', appliedCount: 2, outcomeChangedCount: 0 }]);
  return (<Card title="Lesson Impact Scoring" note="Idea 53291"><Kv k="Lessons" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function RetrospectiveParticipationNudges() {
  const v = XA.buildRetrospectiveParticipationNudges(SAMPLE_PARTICIPANTS, { contributors: ['researcher-a'] });
  return (<Card title="Retrospective Participation Nudges" note="Idea 53292"><Kv k="Missing" v={v.missingCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function AnonymousLessonSubmission() {
  const v = XA.submitAnonymousLessons(SAMPLE_SUBMISSIONS);
  return (<Card title="Anonymous Lesson Submission" note="Idea 53293"><Kv k="Submissions" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function NearMissLessonCapture() {
  const v = XA.captureNearMissLessons(SAMPLE_NEAR_MISS);
  return (<Card title="Near-Miss Lesson Capture" note="Idea 53294"><Kv k="Captured" v={v.capturedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function PositiveDevianceStudies() {
  const v = XA.studyPositiveDeviance(SAMPLE_DEVIANCE_HUNTS);
  return (<Card title="Positive Deviance Studies" note="Idea 53295"><Kv k="Outliers" v={v.outlierCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonToPlaybookPromotion() {
  const v = XA.promoteLessonsToPlaybook([{ id: 'ready', confirmations: 3 }, { id: 'candidate', confirmations: 1 }]);
  return (<Card title="Lesson-to-Playbook Promotion" note="Idea 53296"><Kv k="Promoted" v={v.promotedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function RetrospectiveQualityScores() {
  const v = XA.scoreRetrospectiveQuality(SAMPLE_RETROS);
  return (<Card title="Retrospective Quality Scores" note="Idea 53297"><Kv k="Retrospectives" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function CrossHuntLessonLinking() {
  const v = XA.linkCrossHuntLessons(SAMPLE_LINKED);
  return (<Card title="Cross-Hunt Lesson Linking" note="Idea 53298"><Kv k="Edges" v={v.edgeCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function LessonSearchWithContext() {
  const v = XA.searchLessonsWithContext(SAMPLE_LESSONS, { targetClass: '', keywords: 'auth' });
  return (<Card title="Lesson Search with Context" note="Idea 53299"><Kv k="Results" v={v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function WeeklyLessonsDigest() {
  const v = XA.buildWeeklyLessonsDigest(SAMPLE_DIGEST);
  return (<Card title="Weekly Lessons Digest" note="Idea 53300"><Kv k="Digest" v={v.digestCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w83a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


const W83_A_GALLERY = [
  CoverageBenchmarkPerVertical,
  CoverageGapFixVerification,
  CoverageLessonsFeed,
  CoverageCompletenessCertificates,
  AutomatedRetrospectiveDrafts,
  ResearcherVoiceNoteCapture,
  LessonTaggingTaxonomy,
  LessonDeduplicationEngine,
  LessonFreshnessDecay,
  ContradictoryLessonResolution,
  LessonImpactScoring,
  RetrospectiveParticipationNudges,
  AnonymousLessonSubmission,
  NearMissLessonCapture,
  PositiveDevianceStudies,
  LessonToPlaybookPromotion,
  RetrospectiveQualityScores,
  CrossHuntLessonLinking,
  LessonSearchWithContext,
  WeeklyLessonsDigest,
];

/** Gallery: renders every Wave 83A component, export-only. */
export function Wave83AGallery() {
  return (
    <div className="w83a-gallery">
      {W83_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
