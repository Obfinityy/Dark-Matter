/**
 * Wave84A.jsx — Infinity AI · Wave 84
 * 20 working React components for lessons and retrospectives round 2, ideas 53321–53340. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave84ACore.js';

const SAMPLE_PARTICIPANTS = [
  { name: 'researcher-a' },
  { name: 'researcher-b' },
];
const SAMPLE_CONTRIBUTIONS = [
  { researcher: 'researcher-a', comments: 4, lessons: 1, speakingMinutes: 2 },
];
const SAMPLE_LESSONS = [
  { id: 'lesson-auth', title: 'Check auth on every endpoint', text: 'Auth endpoint parameter checks', targetClass: 'web', stack: 'node', impact: 9, appliedCount: 4, outcomeChangedCount: 3, ageDays: 400, year: 2026, views: 1 },
  { id: 'lesson-routes', title: 'Map routes early', text: 'Route mapping first pass', targetClass: 'web', stack: 'node', impact: 5, appliedCount: 2, outcomeChangedCount: 1, ageDays: 10, year: 2026, views: 40 },
];
const SAMPLE_HUNTS = [
  { id: 'hunt-1', findings: 3, debrief: 'Checked auth endpoints and found IDOR in checkout flow with follow up tests', durationSec: 600, narrative: 'Full hunt story with many details here for the archive record' },
  { id: 'hunt-2', findings: 0, debrief: 'Dry hunt with no findings but useful process notes', durationSec: 400 },
];
const SAMPLE_RETROS = [
  { id: 'retro-1', text: 'Recent success win found shipped quickly', darkAreas: ['admin', 'billing'], findings: 3, coverage: 0.4 },
  { id: 'retro-2', text: 'Missed blocked stuck failed process notes', darkAreas: [], findings: 0, coverage: 0.9 },
];

function Card({ title, note, children }) {
  return (
    <div className="w84a-card">
      <div className="w84a-title">{title}</div>
      {note ? <div className="w84a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w84a-badge w84a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w84a-kv">
      <span className="w84a-k">{k}</span>
      <span className="w84a-v">{String(v)}</span>
    </div>
  );
}

export function RetrospectiveParticipationMetrics() {
  const v = XA.computeRetrospectiveParticipationMetrics(SAMPLE_PARTICIPANTS, SAMPLE_CONTRIBUTIONS);
  return (<Card title="Retrospective Participation Metrics" note="Idea 53321"><Kv k="Rate" v={v.participationRate ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonTranslationLayer() {
  const v = XA.translateLessonContent(SAMPLE_LESSONS, { targetLanguages: ['es', 'en'] });
  return (<Card title="Lesson Translation Layer" note="Idea 53322"><Kv k="Lessons" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function HuntDebriefPodcasts() {
  const v = XA.buildHuntDebriefPodcast(SAMPLE_HUNTS);
  return (<Card title="Hunt Debrief Podcasts" note="Idea 53323"><Kv k="Episodes" v={v.episodeCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonDependencyGraphs() {
  const v = XA.buildLessonDependencyGraph([{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: [] }]);
  return (<Card title="Lesson Dependency Graphs" note="Idea 53324"><Kv k="Edges" v={v.edgeCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function RetrospectiveBiasChecks() {
  const v = XA.auditRetrospectiveBias(SAMPLE_RETROS);
  return (<Card title="Retrospective Bias Checks" note="Idea 53325"><Kv k="Biased" v={v.biasedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonRetirementCeremonies() {
  const v = XA.planLessonRetirementCeremony(SAMPLE_LESSONS);
  return (<Card title="Lesson Retirement Ceremonies" note="Idea 53326"><Kv k="Retiring" v={v.retirementCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function TeamLessonLeaderboards() {
  const v = XA.buildTeamLessonLeaderboard([{ name: 'researcher-a', lessons: 4, applied: 3, upvotes: 5 }, { name: 'researcher-b', lessons: 1, applied: 0, upvotes: 1 }]);
  return (<Card title="Team Lesson Leaderboards" note="Idea 53327"><Kv k="Researchers" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonEmbeddingSearch() {
  const v = XA.searchLessonsByEmbedding(SAMPLE_LESSONS, { text: 'auth endpoint checks' });
  return (<Card title="Lesson Embedding Search" note="Idea 53328"><Kv k="Results" v={v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function RetrospectiveIntegrationWithTickets() {
  const v = XA.buildTicketIntegrationPlan(SAMPLE_RETROS, [{ id: 'T-1', status: 'open' }]);
  return (<Card title="Retrospective Integration with Tickets" note="Idea 53329"><Kv k="Synced" v={v.syncedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonDrivenChecklistUpdates() {
  const v = XA.applyLessonDrivenChecklistUpdates([{ id: 'check-web', name: 'Web checklist', items: [] }], SAMPLE_LESSONS);
  return (<Card title="Lesson-Driven Checklist Updates" note="Idea 53330"><Kv k="Additions" v={v.totalAdditions ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function PostIncidentLearningReviews() {
  const v = XA.reviewPostIncidentLearning([{ id: 'inc-1', severity: 5, lessons: ['lesson-auth'], daysToReview: 3 }]);
  return (<Card title="Post-Incident Learning Reviews" note="Idea 53331"><Kv k="Reviewed" v={v.reviewedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonSharingWithCommunity() {
  const v = XA.shareLessonsWithCommunity(SAMPLE_LESSONS);
  return (<Card title="Lesson Sharing with Community" note="Idea 53332"><Kv k="Shared" v={v.sharedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function RetrospectiveCalibrationSessions() {
  const v = XA.calibrateRetrospectiveSession([{ id: 'retro-1', score: 8 }, { id: 'retro-2', score: 5 }]);
  return (<Card title="Retrospective Calibration Sessions" note="Idea 53333"><Kv k="Spread" v={v.spread ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonImpactDashboards() {
  const v = XA.buildLessonImpactDashboard(SAMPLE_LESSONS);
  return (<Card title="Lesson Impact Dashboards" note="Idea 53334"><Kv k="Rate" v={v.overallImpactRate ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function MicroLessonCapture() {
  const v = XA.captureMicroLesson([{ id: 'micro-1', text: 'Check auth first on every endpoint' }]);
  return (<Card title="Micro-Lesson Capture" note="Idea 53335"><Kv k="Micro" v={v.microCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonContextSnapshots() {
  const v = XA.snapshotLessonContext(SAMPLE_LESSONS, SAMPLE_HUNTS);
  return (<Card title="Lesson Context Snapshots" note="Idea 53336"><Kv k="Snapshots" v={v.snapshotCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function RetrospectiveFollowUpHunts() {
  const v = XA.planRetrospectiveFollowUpHunts(SAMPLE_RETROS);
  return (<Card title="Retrospective Follow-Up Hunts" note="Idea 53337"><Kv k="Follow-ups" v={v.followUpCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonInheritanceRules() {
  const v = XA.applyLessonInheritanceRules(SAMPLE_LESSONS, [{ name: 'web-rule', scope: 'web', active: true }]);
  return (<Card title="Lesson Inheritance Rules" note="Idea 53338"><Kv k="Inherited" v={v.inheritedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function AnnualLessonsAnthology() {
  const v = XA.compileAnnualLessonsAnthology(SAMPLE_LESSONS, { year: 2026 });
  return (<Card title="Annual Lessons Anthology" note="Idea 53339"><Kv k="Entries" v={v.anthologyCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LessonDrivenHuntKickoffRituals() {
  const v = XA.planLessonDrivenHuntKickoff({ targetClass: 'web', stack: 'node', id: 'hunt-new' }, SAMPLE_LESSONS);
  return (<Card title="Lesson-Driven Hunt Kickoff Rituals" note="Idea 53340"><Kv k="Lessons" v={v.kickoffLessons?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

const W84_A_GALLERY = [
  RetrospectiveParticipationMetrics,
  LessonTranslationLayer,
  HuntDebriefPodcasts,
  LessonDependencyGraphs,
  RetrospectiveBiasChecks,
  LessonRetirementCeremonies,
  TeamLessonLeaderboards,
  LessonEmbeddingSearch,
  RetrospectiveIntegrationWithTickets,
  LessonDrivenChecklistUpdates,
  PostIncidentLearningReviews,
  LessonSharingWithCommunity,
  RetrospectiveCalibrationSessions,
  LessonImpactDashboards,
  MicroLessonCapture,
  LessonContextSnapshots,
  RetrospectiveFollowUpHunts,
  LessonInheritanceRules,
  AnnualLessonsAnthology,
  LessonDrivenHuntKickoffRituals,
];

/** Gallery: renders every Wave 84A component, export-only. */
export function Wave84AGallery() {
  return (
    <div className="w84a-gallery">
      {W84_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
