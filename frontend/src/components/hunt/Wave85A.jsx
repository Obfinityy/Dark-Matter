/**
 * Wave85A.jsx — Infinity AI · Wave 85
 * 20 working React components for replay learning round 2, ideas 53361–53380. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave85ACore.js';

const SAMPLE_TRANSCRIPTS = [
  { id: 'tr-1', title: 'Auth hunt transcript', text: 'Checked auth endpoint for IDOR\nTested header validation', durationSec: 600 },
  { id: 'tr-2', title: 'Route mapping transcript', text: 'Mapped routes and listed endpoints', durationSec: 300 },
];
const SAMPLE_REPLAYS = [
  { id: 'replay-1', title: 'Auth hunt replay', durationSec: 600, findings: 3, steps: 12, views: 120, completions: 90, coverage: 0.8, year: 2026 },
  { id: 'replay-2', title: 'Route mapping replay', durationSec: 300, findings: 1, steps: 5, views: 40, completions: 10, coverage: 0.5, year: 2024 },
];
const SAMPLE_REPLAY = {
  id: 'replay-1',
  title: 'Auth hunt replay',
  durationSec: 600,
  findings: 3,
  transcript: 'Checked auth endpoint and found IDOR in checkout flow',
  events: [
    { id: 'e1', type: 'decision', decisionPoint: true, choice: 'Test auth first', rationale: 'Auth surface is highest risk here', atSec: 30 },
    { id: 'e2', type: 'action', atSec: 120 },
    { id: 'e3', type: 'decision', decisionPoint: true, choice: 'Pivot to routes', atSec: 300 },
  ],
};

function Card({ title, note, children }) {
  return (
    <div className="w85a-card">
      <div className="w85a-title">{title}</div>
      {note ? <div className="w85a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w85a-badge w85a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w85a-kv">
      <span className="w85a-k">{k}</span>
      <span className="w85a-v">{String(v)}</span>
    </div>
  );
}

export function ReplayTranscriptSearch() {
  const v = XA.searchReplayTranscripts(SAMPLE_TRANSCRIPTS, { text: 'auth endpoint' });
  return (<Card title="Replay Transcript Search" note="Idea 53361"><Kv k="Results" v={v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LiveReplaySessions() {
  const v = XA.buildLiveReplaySessions([{ id: 's1', title: 'Live review', viewers: 12, live: true }, { id: 's2', title: 'Archive watch', viewers: 2, live: false }]);
  return (<Card title="Live Replay Sessions" note="Idea 53362"><Kv k="Live" v={v.liveCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayDifficultyProgression() {
  const v = XA.buildReplayDifficultyProgression(SAMPLE_REPLAYS);
  return (<Card title="Replay Difficulty Progression" note="Idea 53363"><Kv k="Max level" v={v.maxLevel ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function MultiHuntReplayComparisons() {
  const v = XA.compareMultiHuntReplays(SAMPLE_REPLAYS);
  return (<Card title="Multi-Hunt Replay Comparisons" note="Idea 53364"><Kv k="Compared" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayBookmarking() {
  const v = XA.manageReplayBookmarks(SAMPLE_REPLAY, [{ id: 'b1', atSec: 30, label: 'Key decision', pinned: true }, { id: 'b2', atSec: 120, label: 'Finding moment' }]);
  return (<Card title="Replay Bookmarking" note="Idea 53365"><Kv k="Bookmarks" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ExpertAlternativePaths() {
  const v = XA.buildExpertAlternativePaths(SAMPLE_REPLAY, [{ id: 'p1', label: 'Auth-first path', steps: ['check auth', 'test IDOR'], estimatedFindings: 3, timeMinutes: 20, expert: 'researcher-a' }]);
  return (<Card title="Expert Alternative Paths" note="Idea 53366"><Kv k="Paths" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayPerformanceAnalytics() {
  const v = XA.analyzeReplayPerformance(SAMPLE_REPLAYS);
  return (<Card title="Replay Performance Analytics" note="Idea 53367"><Kv k="Replays" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function VRHuntReplayMode() {
  const v = XA.buildVRHuntReplayMode(SAMPLE_REPLAY);
  return (<Card title="VR Hunt Replay Mode" note="Idea 53368"><Kv k="Chapters" v={v.chapterCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayNarrationStyles() {
  const v = XA.buildReplayNarrationStyles(SAMPLE_REPLAY);
  return (<Card title="Replay Narration Styles" note="Idea 53369"><Kv k="Styles" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayBasedInterviewTasks() {
  const v = XA.buildReplayBasedInterviewTasks(SAMPLE_REPLAYS);
  return (<Card title="Replay-Based Interview Tasks" note="Idea 53370"><Kv k="Tasks" v={v.taskCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function FailureReplayClinics() {
  const v = XA.buildFailureReplayClinics([{ id: 'case-1', title: 'Missed header check', failures: [{ id: 'f1', label: 'Header check skipped', severity: 3 }] }]);
  return (<Card title="Failure Replay Clinics" note="Idea 53371"><Kv k="Clinics" v={v.clinicCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayScenarioRandomizer() {
  const v = XA.buildReplayScenarioRandomizer([{ id: 'sc-1', title: 'Auth bypass', difficulty: 'advanced' }, { id: 'sc-2', title: 'Route mapping', difficulty: 'beginner' }, { id: 'sc-3', title: 'Header checks', difficulty: 'intermediate' }], { seed: 7, count: 2 });
  return (<Card title="Replay Scenario Randomizer" note="Idea 53372"><Kv k="Picked" v={v.pickCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function TraineeDecisionRationales() {
  const v = XA.captureTraineeDecisionRationales(SAMPLE_REPLAY.events);
  return (<Card title="Trainee Decision Rationales" note="Idea 53373"><Kv k="Decisions" v={v.decisionCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayExportForConferences() {
  const v = XA.buildReplayExportForConferences(SAMPLE_REPLAYS, { format: 'slides' });
  return (<Card title="Replay Export for Conferences" note="Idea 53374"><Kv k="Ready" v={v.exportReadyCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayAccessibilityFeatures() {
  const v = XA.buildReplayAccessibilityFeatures(SAMPLE_REPLAY, ['captions', 'keyboard-nav']);
  return (<Card title="Replay Accessibility Features" note="Idea 53375"><Kv k="Enabled" v={v.enabledCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayCompletionCertificates() {
  const v = XA.issueReplayCompletionCertificates([{ name: 'researcher-a', score: 85, replaysWatched: 3 }]);
  return (<Card title="Replay Completion Certificates" note="Idea 53376"><Kv k="Certified" v={v.certifiedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function AdaptiveReplayDifficulty() {
  const v = XA.buildAdaptiveReplayDifficulty({ skill: 0.6 }, SAMPLE_REPLAYS);
  return (<Card title="Adaptive Replay Difficulty" note="Idea 53377"><Kv k="Recommended" v={v.recommendedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayDiscussionThreads() {
  const v = XA.buildReplayDiscussionThreads([{ id: 'th-1', title: 'Auth approach', posts: [{ id: 'p1', text: 'Strong catch', atSec: 30 }] }]);
  return (<Card title="Replay Discussion Threads" note="Idea 53378"><Kv k="Threads" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function HistoricalReplayArchive() {
  const v = XA.buildHistoricalReplayArchive(SAMPLE_REPLAYS, { cutoffYear: 2025 });
  return (<Card title="Historical Replay Archive" note="Idea 53379"><Kv k="Archived" v={v.archivedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayMetadataStandards() {
  const v = XA.validateReplayMetadataStandards([{ id: 'replay-1', title: 'Auth hunt', durationSec: 600, findings: 3 }, { id: 'replay-2', title: 'Partial' }]);
  return (<Card title="Replay Metadata Standards" note="Idea 53380"><Kv k="Compliant" v={v.compliantCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

const W85_A_GALLERY = [
  ReplayTranscriptSearch,
  LiveReplaySessions,
  ReplayDifficultyProgression,
  MultiHuntReplayComparisons,
  ReplayBookmarking,
  ExpertAlternativePaths,
  ReplayPerformanceAnalytics,
  VRHuntReplayMode,
  ReplayNarrationStyles,
  ReplayBasedInterviewTasks,
  FailureReplayClinics,
  ReplayScenarioRandomizer,
  TraineeDecisionRationales,
  ReplayExportForConferences,
  ReplayAccessibilityFeatures,
  ReplayCompletionCertificates,
  AdaptiveReplayDifficulty,
  ReplayDiscussionThreads,
  HistoricalReplayArchive,
  ReplayMetadataStandards,
];

/** Gallery: renders every Wave 85A component, export-only. */
export function Wave85AGallery() {
  return (
    <div className="w85a-gallery">
      {W85_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
