/**
 * Wave84B.jsx — Infinity AI · Wave 84
 * 20 working React components for hunt replay theater, ideas 53341–53360. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave84BCores.js';

const SAMPLE_REPLAY = {
  id: 'replay-1',
  title: 'Auth hunt replay',
  durationSec: 600,
  duration: 600,
  findings: 3,
  events: [
    { id: 'e1', type: 'decision', decisionPoint: true, choice: 'Test auth first?', prompt: 'Test auth first?', atSec: 30, choices: ['test-auth', 'map-routes'], correctIndex: 0, text: 'Start with auth checks' },
    { id: 'e2', type: 'action', atSec: 120, text: 'Checked endpoint a@example.com token=abc123' },
    { id: 'e3', type: 'decision', decisionPoint: true, atSec: 300, text: 'Found IDOR moment' },
  ],
  findingMoments: [
    { id: 'm1', atSec: 295, label: 'IDOR found', severity: 5 },
  ],
  mistakes: [
    { id: 'ms1', atSec: 90, label: 'Skipped header check', severity: 3 },
  ],
  views: 120,
  completions: 90,
  rating: 4,
};

const SAMPLE_REPLAYS = [
  SAMPLE_REPLAY,
  { id: 'replay-2', title: 'Route mapping replay', durationSec: 300, duration: 300, findings: 1, events: [{ id: 'x1', type: 'action', atSec: 10 }], findingMoments: [], mistakes: [], views: 40, completions: 10, rating: 3 },
];

function Card({ title, note, children }) {
  return (
    <div className="w84b-card">
      <div className="w84b-title">{title}</div>
      {note ? <div className="w84b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w84b-badge w84b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w84b-kv">
      <span className="w84b-k">{k}</span>
      <span className="w84b-v">{String(v)}</span>
    </div>
  );
}

export function HuntReplayTheater() {
  const v = XB.buildHuntReplayTheater(SAMPLE_REPLAYS);
  return (<Card title="Hunt Replay Theater (learning)" note="Idea 53341"><Kv k="Replays" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function DecisionPointPausing() {
  const v = XB.planDecisionPointPauses(SAMPLE_REPLAY);
  return (<Card title="Decision-Point Pausing" note="Idea 53342"><Kv k="Pauses" v={v.pauseCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayDifficultyRatings() {
  const v = XB.rateReplayDifficulty(SAMPLE_REPLAYS);
  return (<Card title="Replay Difficulty Ratings" note="Idea 53343"><Kv k="Rated" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function AnnotatedReplayOverlays() {
  const v = XB.buildAnnotatedReplayOverlays(SAMPLE_REPLAY, [{ id: 'a1', atSec: 30, text: 'Key decision here', kind: 'insight' }]);
  return (<Card title="Annotated Replay Overlays" note="Idea 53344"><Kv k="Overlays" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function BranchingReplayScenarios() {
  const v = XB.buildBranchingReplayScenarios({ nodes: [{ id: 'n1', prompt: 'Start', branches: [{ label: 'auth' }, { label: 'routes' }] }] });
  return (<Card title="Branching Replay Scenarios" note="Idea 53345"><Kv k="Branch points" v={v.branchPointCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplaySpeedControls() {
  const v = XB.buildReplaySpeedControls(SAMPLE_REPLAY);
  return (<Card title="Replay Speed Controls" note="Idea 53346"><Kv k="Speeds" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function FindingMomentHighlightReels() {
  const v = XB.buildFindingMomentHighlightReels(SAMPLE_REPLAYS);
  return (<Card title="Finding-Moment Highlight Reels" note="Idea 53347"><Kv k="Highlights" v={v.totalHighlights ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayQuizGeneration() {
  const v = XB.generateReplayQuiz(SAMPLE_REPLAY);
  return (<Card title="Replay Quiz Generation" note="Idea 53348"><Kv k="Questions" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function TraineeVsAgentComparisons() {
  const v = XB.compareTraineeVsAgent({ findings: 2, durationMinutes: 60 }, { findings: 3, durationMinutes: 45 });
  return (<Card title="Trainee-vs-Agent Comparisons" note="Idea 53349"><Kv k="Delta" v={v.deltaFindings ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function MistakeReplays() {
  const v = XB.buildMistakeReplays(SAMPLE_REPLAYS);
  return (<Card title="Mistake Replays" note="Idea 53350"><Kv k="Mistakes" v={v.totalMistakes ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayLeaderboards() {
  const v = XB.buildReplayLeaderboard(SAMPLE_REPLAYS);
  return (<Card title="Replay Leaderboards" note="Idea 53351"><Kv k="Replays" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function CollaborativeReplayRooms() {
  const v = XB.buildCollaborativeReplayRoom({ name: 'review-room', id: 'room-1' }, [{ name: 'researcher-a', role: 'host' }]);
  return (<Card title="Collaborative Replay Rooms" note="Idea 53352"><Kv k="Active" v={v.activeCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayScenarioLibrary() {
  const v = XB.buildReplayScenarioLibrary([{ id: 'sc-1', title: 'Auth bypass', tags: ['auth', 'idor'], difficulty: 'advanced' }]);
  return (<Card title="Replay Scenario Library" note="Idea 53353"><Kv k="Scenarios" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function RedactedReplaySharing() {
  const v = XB.buildRedactedReplayShare(SAMPLE_REPLAY);
  return (<Card title="Redacted Replay Sharing" note="Idea 53354"><Kv k="Redactions" v={v.totalRedactions ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayBasedCertifications() {
  const v = XB.issueReplayBasedCertifications([{ name: 'researcher-a', quizScore: 85, replaysWatched: 3 }]);
  return (<Card title="Replay-Based Certifications" note="Idea 53355"><Kv k="Certified" v={v.certifiedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function SpeedRunChallenges() {
  const v = XB.buildSpeedRunChallenges([{ id: 'ch-1', title: 'Auth speed-run', targetSeconds: 300, bestSeconds: 240, attempts: 3 }]);
  return (<Card title="Speed-Run Challenges" note="Idea 53356"><Kv k="Beaten" v={v.beatenCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayCommentaryCrowdsourcing() {
  const v = XB.crowdsourceReplayCommentary([{ id: 'c1', text: 'Great catch here', atSec: 30, upvotes: 5 }]);
  return (<Card title="Replay Commentary Crowdsourcing" note="Idea 53357"><Kv k="Helpful" v={v.helpfulCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function CounterfactualReplayEngine() {
  const v = XB.runCounterfactualReplayEngine(SAMPLE_REPLAY, { atIndex: 0, label: 'map-routes-first' });
  return (<Card title="Counterfactual Replay Engine" note="Idea 53358"><Kv k="Projected" v={v.projectedFindings ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayAttentionHeatmaps() {
  const v = XB.buildReplayAttentionHeatmap([{ atSec: 15, pauses: 2 }, { atSec: 35, pauses: 1 }]);
  return (<Card title="Replay Attention Heatmaps" note="Idea 53359"><Kv k="Buckets" v={v.bucketCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function MobileReplayViewing() {
  const v = XB.buildMobileReplayView(SAMPLE_REPLAY);
  return (<Card title="Mobile Replay Viewing" note="Idea 53360"><Kv k="Chapters" v={v.chapterCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w84b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

const W84_B_GALLERY = [
  HuntReplayTheater,
  DecisionPointPausing,
  ReplayDifficultyRatings,
  AnnotatedReplayOverlays,
  BranchingReplayScenarios,
  ReplaySpeedControls,
  FindingMomentHighlightReels,
  ReplayQuizGeneration,
  TraineeVsAgentComparisons,
  MistakeReplays,
  ReplayLeaderboards,
  CollaborativeReplayRooms,
  ReplayScenarioLibrary,
  RedactedReplaySharing,
  ReplayBasedCertifications,
  SpeedRunChallenges,
  ReplayCommentaryCrowdsourcing,
  CounterfactualReplayEngine,
  ReplayAttentionHeatmaps,
  MobileReplayViewing,
];

/** Gallery: renders every Wave 84B component, export-only. */
export function Wave84BGallery() {
  return (
    <div className="w84b-gallery">
      {W84_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
