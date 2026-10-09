/**
 * Wave85B.jsx — Infinity AI · Wave 85
 * 20 working React components for replay community and benchmarking, ideas 53381–53400. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave85BCores.js';

const SAMPLE_REPLAY = {
  id: 'replay-1',
  title: 'Auth hunt replay',
  durationSec: 600,
  duration: 600,
  findings: 3,
  eventCount: 3,
  checksum: 'abc123checksum',
  transcript: 'Checked auth endpoint and found IDOR',
  events: [
    { id: 'e1', type: 'decision', atSec: 30, latencyMs: 120 },
    { id: 'e2', type: 'action', atSec: 120, latencyMs: 80 },
  ],
};

const SAMPLE_REPLAYS = [
  { id: 'replay-1', title: 'Auth hunt replay', findings: 3, durationSec: 600, mistakes: [{ id: 'm1', type: 'header-check', label: 'Header check', severity: 3 }], area: 'web', impact: 9, maxSeverity: 5, targetClass: 'web' },
  { id: 'replay-2', title: 'Route replay', findings: 1, durationSec: 300, mistakes: [], area: 'api', impact: 4, maxSeverity: 2, targetClass: 'api' },
];

function Card({ title, note, children }) {
  return (
    <div className="w85b-card">
      <div className="w85b-title">{title}</div>
      {note ? <div className="w85b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w85b-badge w85b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w85b-kv">
      <span className="w85b-k">{k}</span>
      <span className="w85b-v">{String(v)}</span>
    </div>
  );
}

export function CrossTeamReplayExchange() {
  const v = XB.buildCrossTeamReplayExchange([{ id: 'ex-1', sourceTeam: 'alpha', targetTeam: 'beta', replayCount: 3, status: 'accepted' }]);
  return (<Card title="Cross-Team Replay Exchange" note="Idea 53381"><Kv k="Exchanges" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayBasedMentorshipMatching() {
  const v = XB.matchReplayBasedMentorship([{ name: 'mentee-a', weakAreas: ['auth'] }], [{ name: 'mentor-a', strengths: ['auth'], replaysWatched: 12 }]);
  return (<Card title="Replay-Based Mentorship Matching" note="Idea 53382"><Kv k="Matched" v={v.matchedCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function SimulatedLiveHunts() {
  const v = XB.buildSimulatedLiveHunts([{ id: 'sc-1', title: 'Header checks live', durationSec: 600, steps: 10, participants: 4 }]);
  return (<Card title="Simulated Live Hunts" note="Idea 53383"><Kv k="Ready" v={v.liveReadyCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayEthicsBriefings() {
  const v = XB.buildReplayEthicsBriefings([{ id: 'r1', title: 'Clean replay', text: 'Checked endpoints' }, { id: 'r2', title: 'Sensitive note', text: 'Contact a@example.com' }]);
  return (<Card title="Replay Ethics Briefings" note="Idea 53384"><Kv k="Flagged" v={v.briefingCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayLatencyRealism() {
  const v = XB.measureReplayLatencyRealism([SAMPLE_REPLAY], { targetMs: 200 });
  return (<Card title="Replay Latency Realism" note="Idea 53385"><Kv k="Realistic" v={v.realisticCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayAnnotationExports() {
  const v = XB.buildReplayAnnotationExports(SAMPLE_REPLAY, [{ id: 'a1', atSec: 30, text: 'Key moment', author: 'researcher-a' }], { format: 'json' });
  return (<Card title="Replay Annotation Exports" note="Idea 53386"><Kv k="Notes" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function TeamReplayTournaments() {
  const v = XB.buildTeamReplayTournaments([{ team: 'alpha', wins: 3, losses: 1, findings: 8 }, { team: 'beta', wins: 1, losses: 2, findings: 3 }]);
  return (<Card title="Team Replay Tournaments" note="Idea 53387"><Kv k="Teams" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayDrivenPlaybookUpdates() {
  const v = XB.applyReplayDrivenPlaybookUpdates([{ id: 'pb-web', name: 'Web playbook', area: 'web' }], SAMPLE_REPLAYS, { minImpact: 5 });
  return (<Card title="Replay-Driven Playbook Updates" note="Idea 53388"><Kv k="Updates" v={v.totalUpdates ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayViewingStreaks() {
  const v = XB.trackReplayViewingStreaks([{ name: 'researcher-a', days: [1, 2, 3, 5] }]);
  return (<Card title="Replay Viewing Streaks" note="Idea 53389"><Kv k="Viewers" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ExpertReplayPlaylists() {
  const v = XB.buildExpertReplayPlaylists([{ id: 'pl-1', title: 'Auth essentials', expert: 'researcher-a', items: [{ id: 'replay-1', durationSec: 600 }] }]);
  return (<Card title="Expert Replay Playlists" note="Idea 53390"><Kv k="Playlists" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayFeedbackLoops() {
  const v = XB.buildReplayFeedbackLoops([{ id: 'f1', rating: 5, text: 'Helpful pacing', status: 'open' }]);
  return (<Card title="Replay Feedback Loops" note="Idea 53391"><Kv k="Open" v={v.openCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function NewHireReplayOnboarding() {
  const v = XB.buildNewHireReplayOnboarding([{ name: 'hire-a', completed: ['replay-1'] }], [{ id: 'replay-1' }]);
  return (<Card title="New-Hire Replay Onboarding" note="Idea 53392"><Kv k="Hires" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplaySearchByMistakeType() {
  const v = XB.searchReplayByMistakeType(SAMPLE_REPLAYS, { mistakeType: 'header' });
  return (<Card title="Replay Search by Mistake Type" note="Idea 53393"><Kv k="Matches" v={v.resultCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayIntegrityVerification() {
  const v = XB.verifyReplayIntegrity(SAMPLE_REPLAY);
  return (<Card title="Replay Integrity Verification" note="Idea 53394"><Kv k="Verified" v={v.verified ? 1 : 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function LocalizedReplayNarrations() {
  const v = XB.buildLocalizedReplayNarrations(SAMPLE_REPLAY, { languages: ['en', 'es'] });
  return (<Card title="Localized Replay Narrations" note="Idea 53395"><Kv k="Languages" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReplayBasedThreatBriefings() {
  const v = XB.buildReplayBasedThreatBriefings(SAMPLE_REPLAYS);
  return (<Card title="Replay-Based Threat Briefings" note="Idea 53396"><Kv k="Briefings" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function OptInBenchmarkConsent() {
  const v = XB.manageOptInBenchmarkConsent([{ name: 'researcher-a', optedIn: true }, { name: 'researcher-b', consentStatus: 'pending' }]);
  return (<Card title="Opt-In Benchmark Consent" note="Idea 53397"><Kv k="Opted in" v={v.optedInCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function AnonymizedPeerPercentiles() {
  const v = XB.computeAnonymizedPeerPercentiles([{ score: 40 }, { score: 70 }, { score: 90 }]);
  return (<Card title="Anonymized Peer Percentiles" note="Idea 53398"><Kv k="Peers" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function SkillAreaBenchmarks() {
  const v = XB.buildSkillAreaBenchmarks([{ area: 'web', score: 80 }, { area: 'web', score: 60 }, { area: 'api', score: 70 }]);
  return (<Card title="Skill-Area Benchmarks" note="Idea 53399"><Kv k="Areas" v={v.areaCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ExperienceAdjustedRankings() {
  const v = XB.buildExperienceAdjustedRankings([{ name: 'researcher-a', score: 80, experienceMonths: 24, hunts: 20 }]);
  return (<Card title="Experience-Adjusted Rankings" note="Idea 53400"><Kv k="Ranked" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w85b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

const W85_B_GALLERY = [
  CrossTeamReplayExchange,
  ReplayBasedMentorshipMatching,
  SimulatedLiveHunts,
  ReplayEthicsBriefings,
  ReplayLatencyRealism,
  ReplayAnnotationExports,
  TeamReplayTournaments,
  ReplayDrivenPlaybookUpdates,
  ReplayViewingStreaks,
  ExpertReplayPlaylists,
  ReplayFeedbackLoops,
  NewHireReplayOnboarding,
  ReplaySearchByMistakeType,
  ReplayIntegrityVerification,
  LocalizedReplayNarrations,
  ReplayBasedThreatBriefings,
  OptInBenchmarkConsent,
  AnonymizedPeerPercentiles,
  SkillAreaBenchmarks,
  ExperienceAdjustedRankings,
];

/** Gallery: renders every Wave 85B component, export-only. */
export function Wave85BGallery() {
  return (
    <div className="w85b-gallery">
      {W85_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
