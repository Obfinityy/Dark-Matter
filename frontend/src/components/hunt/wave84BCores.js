/**
 * wave84BCores.js — Infinity AI · Wave 84B
 * Hunt replay theater, ideas 53341–53360:
 * replay theater, decision-point pausing, difficulty ratings,
 * overlays, branching scenarios, speed controls, highlight reels,
 * quiz generation, trainee comparisons, mistake replays, leaderboards,
 * collaborative rooms, scenario library, redacted sharing,
 * certifications, speed-run challenges, commentary crowdsourcing,
 * counterfactual engine, attention heatmaps, and mobile viewing.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE84_B_IDEAS = [
  { id: 53341, title: 'Hunt Replay Theater (learning)', skip: false },
  { id: 53342, title: 'Decision-Point Pausing', skip: false },
  { id: 53343, title: 'Replay Difficulty Ratings', skip: false },
  { id: 53344, title: 'Annotated Replay Overlays', skip: false },
  { id: 53345, title: 'Branching Replay Scenarios', skip: false },
  { id: 53346, title: 'Replay Speed Controls', skip: false },
  { id: 53347, title: 'Finding-Moment Highlight Reels', skip: false },
  { id: 53348, title: 'Replay Quiz Generation', skip: false },
  { id: 53349, title: 'Trainee-vs-Agent Comparisons', skip: false },
  { id: 53350, title: 'Mistake Replays', skip: false },
  { id: 53351, title: 'Replay Leaderboards', skip: false },
  { id: 53352, title: 'Collaborative Replay Rooms', skip: false },
  { id: 53353, title: 'Replay Scenario Library', skip: false },
  { id: 53354, title: 'Redacted Replay Sharing', skip: false },
  { id: 53355, title: 'Replay-Based Certifications', skip: false },
  { id: 53356, title: 'Speed-Run Challenges', skip: false },
  { id: 53357, title: 'Replay Commentary Crowdsourcing', skip: false },
  { id: 53358, title: 'Counterfactual Replay Engine', skip: false },
  { id: 53359, title: 'Replay Attention Heatmaps', skip: false },
  { id: 53360, title: 'Mobile Replay Viewing', skip: false },
];

function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp01(value) { return Math.min(1, Math.max(0, num(value, 0))); }
function rate(part, whole) { return whole ? round2(part / whole) : 0; }
function mean(values) { return values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : 0; }
function keyOf(item, fallback = 'replay') {
  return String(item.key || item.id || item.replayId || item.title || item.name || fallback);
}
function tokensOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

/** Idea 53341 — Hunt replay theater. */
export function buildHuntReplayTheater(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const durationSec = num(r.durationSec ?? r.duration, 0);
    const events = num(r.events ?? r.eventCount, 0);
    const findings = num(r.findings ?? r.validatedFindings, 0);
    return { key: keyOf(r), title: String(r.title || keyOf(r)), durationSec, durationMinutes: round2(durationSec / 60), events, findings, watchable: durationSec > 0 && events > 0, quality: durationSec > 0 ? (events / Math.max(1, durationSec / 60)) : 0 };
  }).sort((a, b) => b.events - a.events || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, watchableCount: rows.filter(r => r.watchable).length, totalEvents: rows.reduce((s, r) => s + r.events, 0), totalMinutes: round2(rows.reduce((s, r) => s + r.durationMinutes, 0)), top: rows[0] || null, summary: `Infinity AI staged ${rows.length} replay(s) in the theater; ${rows.filter(r => r.watchable).length} are watchable.` };
}

/** Idea 53342 — Decision-point pausing. */
export function planDecisionPointPauses(replay = {}, options = {}) {
  const events = Array.isArray(replay.events) ? replay.events : [];
  const rows = events.map((e, idx) => {
    const type = String(e.type || e.kind || '');
    const isDecision = type === 'decision' || e.decisionPoint === true || Boolean(e.choice);
    return { key: String(e.id || `event-${idx}`), index: idx, type: type || 'event', isDecision, pauseAt: isDecision, prompt: isDecision ? String(e.prompt || e.choice || 'Decision point — what next?') : null };
  });
  const pauseRows = rows.filter(r => r.isDecision);
  return { rows, pauseRows, count: events.length, pauseCount: pauseRows.length, pauseRate: events.length ? rate(pauseRows.length, events.length) : 0, top: pauseRows[0] || null, summary: `Infinity AI placed ${pauseRows.length} decision-point pause(s) in the replay.` };
}

/** Idea 53343 — Replay difficulty ratings. */
export function rateReplayDifficulty(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const findings = num(r.findings, 0);
    const durationSec = num(r.durationSec ?? r.duration, 0);
    const steps = num(r.steps ?? r.eventCount, 0);
    const complexity = round2(findings * 2 + steps * 0.2 + (durationSec / 600));
    const tier = complexity >= 12 ? 'expert' : complexity >= 7 ? 'advanced' : complexity >= 3 ? 'intermediate' : 'beginner';
    return { key: keyOf(r), title: String(r.title || keyOf(r)), findings, steps, complexity, difficulty: tier, tier };
  }).sort((a, b) => b.complexity - a.complexity || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, expertCount: rows.filter(r => r.tier === 'expert').length, avgComplexity: mean(rows.map(r => r.complexity)), top: rows[0] || null, summary: `Infinity AI rated difficulty for ${rows.length} replay(s); hardest is ${rows[0]?.key || 'none'}.` };
}

/** Idea 53344 — Annotated replay overlays. */
export function buildAnnotatedReplayOverlays(replay = {}, annotations = [], options = {}) {
  const rows = (annotations || []).map(a => {
    const atSec = num(a.atSec ?? a.timestampSec, 0);
    return { key: String(a.id || a.key || `note-${atSec}`), atSec, text: String(a.text || a.note || ''), kind: String(a.kind || a.type || 'note'), pinned: atSec >= 0, author: a.author ? String(a.author) : null };
  }).sort((a, b) => a.atSec - b.atSec || String(a.key).localeCompare(String(b.key)));
  const durationSec = num(replay.durationSec ?? replay.duration, 0);
  return { rows, overlays: rows, count: rows.length, replay: keyOf(replay), durationSec, density: durationSec ? round2(rows.length / (durationSec / 60)) : 0, top: rows[0] || null, summary: `Infinity AI placed ${rows.length} annotation overlay(s) on the replay.` };
}

/** Idea 53345 — Branching replay scenarios. */
export function buildBranchingReplayScenarios(scenario = {}, options = {}) {
  const nodes = Array.isArray(scenario.nodes) ? scenario.nodes : [];
  const rows = nodes.map(n => {
    const branches = Array.isArray(n.branches) ? n.branches : [];
    return { key: String(n.id || n.key || ''), prompt: String(n.prompt || n.title || ''), branches: branches.map(b => String(b.label || b.id || '')), branchCount: branches.length, isBranchPoint: branches.length > 1 };
  }).sort((a, b) => b.branchCount - a.branchCount || String(a.key).localeCompare(String(b.key)));
  const branchPoints = rows.filter(r => r.isBranchPoint);
  return { rows, count: rows.length, branchPointCount: branchPoints.length, totalBranches: rows.reduce((s, r) => s + r.branchCount, 0), top: rows[0] || null, summary: `Infinity AI built a branching scenario with ${branchPoints.length} branch point(s) and ${rows.reduce((s, r) => s + r.branchCount, 0)} branch(es).` };
}

/** Idea 53346 — Replay speed controls. */
export function buildReplaySpeedControls(replay = {}, options = {}) {
  const speeds = options.speeds || [0.5, 1, 1.5, 2, 3];
  const durationSec = num(replay.durationSec ?? replay.duration, 0);
  const rows = speeds.map(s => {
    const speed = num(s, 1);
    return { speed, effectiveSeconds: durationSec ? round2(durationSec / speed) : 0, label: `${speed}x`, recommended: speed === 1 || speed === 1.5 };
  });
  return { rows, speeds: rows, count: speeds.length, durationSec, baseDuration: durationSec, fastest: rows[rows.length - 1] || null, summary: `Infinity AI configured ${rows.length} playback speed(s) for the replay.` };
}

/** Idea 53347 — Finding-moment highlight reels. */
export function buildFindingMomentHighlightReels(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const moments = Array.isArray(r.findingMoments) ? r.findingMoments : (Array.isArray(r.moments) ? r.moments : []);
    const highlights = moments.map((m, i) => ({ key: String(m.id || `moment-${i}`), atSec: num(m.atSec ?? m.timestampSec, 0), label: String(m.label || m.title || `Finding ${i + 1}`), severity: num(m.severity, 1) })).sort((a, b) => b.severity - a.severity || a.atSec - b.atSec);
    return { key: keyOf(r), title: String(r.title || keyOf(r)), highlights, highlightCount: highlights.length, topMoment: highlights[0] || null };
  }).sort((a, b) => b.highlightCount - a.highlightCount || String(a.key).localeCompare(String(b.key)));
  const totalHighlights = rows.reduce((s, r) => s + r.highlightCount, 0);
  return { rows, reels: rows, count: rows.length, totalHighlights, top: rows[0] || null, summary: `Infinity AI cut highlight reels with ${totalHighlights} finding moment(s) across ${rows.length} replay(s).` };
}

/** Idea 53348 — Replay quiz generation. */
export function generateReplayQuiz(replay = {}, options = {}) {
  const events = Array.isArray(replay.events) ? replay.events : [];
  const questions = events.filter(e => e.decisionPoint === true || e.type === 'decision' || Boolean(e.choice)).map((e, i) => {
    const choices = Array.isArray(e.choices) ? e.choices.map(String) : ['continue', 'pivot', 'stop'];
    return { key: String(e.id || `q-${i}`), prompt: String(e.prompt || e.choice || 'What should happen next?'), choices, correctIndex: num(e.correctIndex, 0), atSec: num(e.atSec ?? e.timestampSec, 0) };
  }).sort((a, b) => a.atSec - b.atSec);
  return { rows: questions, questions, count: questions.length, quizLength: questions.length, top: questions[0] || null, summary: `Infinity AI generated ${questions.length} quiz question(s) from the replay.` };
}

/** Idea 53349 — Trainee-vs-agent comparisons. */
export function compareTraineeVsAgent(trainee = {}, agent = {}, options = {}) {
  const traineeFindings = num(trainee.findings ?? trainee.validatedFindings, 0);
  const agentFindings = num(agent.findings ?? agent.validatedFindings, 0);
  const traineeMinutes = num(trainee.durationMinutes ?? trainee.minutes, 0);
  const agentMinutes = num(agent.durationMinutes ?? agent.minutes, 0);
  const deltaFindings = round2(traineeFindings - agentFindings);
  const deltaMinutes = round2(traineeMinutes - agentMinutes);
  const rows = [
    { key: 'trainee', label: 'Trainee', findings: traineeFindings, minutes: traineeMinutes },
    { key: 'agent', label: 'Agent', findings: agentFindings, minutes: agentMinutes },
  ];
  return { rows, count: rows.length, traineeFindings, agentFindings, deltaFindings, deltaMinutes, winner: traineeFindings > agentFindings ? 'trainee' : agentFindings > traineeFindings ? 'agent' : 'tie', traineeAhead: traineeFindings > agentFindings, summary: `Infinity AI compared trainee vs agent: ${deltaFindings} finding delta over ${deltaMinutes} minute(s).` };
}

/** Idea 53350 — Mistake replays. */
export function buildMistakeReplays(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const mistakes = Array.isArray(r.mistakes) ? r.mistakes : [];
    const mistakeRows = mistakes.map((m, i) => ({ key: String(m.id || `m-${i}`), atSec: num(m.atSec ?? m.timestampSec, 0), label: String(m.label || m.type || 'mistake'), severity: num(m.severity, 1) })).sort((a, b) => b.severity - a.severity);
    return { key: keyOf(r), title: String(r.title || keyOf(r)), mistakes: mistakeRows, mistakeCount: mistakeRows.length, topMistake: mistakeRows[0] || null };
  }).sort((a, b) => b.mistakeCount - a.mistakeCount || String(a.key).localeCompare(String(b.key)));
  const totalMistakes = rows.reduce((s, r) => s + r.mistakeCount, 0);
  return { rows, count: rows.length, totalMistakes, mistakeReplayCount: rows.filter(r => r.mistakeCount > 0).length, top: rows[0] || null, summary: `Infinity AI compiled ${totalMistakes} mistake replay moment(s) across ${rows.length} replay(s).` };
}

/** Idea 53351 — Replay leaderboards. */
export function buildReplayLeaderboard(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const views = num(r.views ?? r.viewCount, 0);
    const completions = num(r.completions ?? r.completedViews, 0);
    const rating = num(r.rating ?? r.avgRating, 0);
    const completionRate = views ? rate(completions, views) : 0;
    return { key: keyOf(r), title: String(r.title || keyOf(r)), views, completions, completionRate, rating, score: round2(views * 0.1 + completionRate * 20 + rating * 5) };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, leaderboard: rows, count: rows.length, top: rows[0] || null, totalViews: rows.reduce((s, r) => s + r.views, 0), summary: `Infinity AI ranked ${rows.length} replay(s) on the leaderboard.` };
}

/** Idea 53352 — Collaborative replay rooms. */
export function buildCollaborativeReplayRoom(room = {}, participants = [], options = {}) {
  const maxParticipants = num(options.maxParticipants ?? room.capacity, 8);
  const rows = (participants || []).map(p => {
    const joined = p.joined !== false;
    return { key: String(p.name || p.researcher || p.key || 'participant'), researcher: String(p.name || p.researcher || p.key || 'participant'), joined, canAnnotate: p.canAnnotate !== false, role: String(p.role || 'viewer') };
  }).sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.key).localeCompare(String(b.key)));
  const active = rows.filter(r => r.joined);
  return { rows, participants: rows, count: rows.length, activeCount: active.length, capacity: maxParticipants, full: active.length >= maxParticipants, room: String(room.name || room.id || 'replay-room'), summary: `Infinity AI opened a collaborative replay room for ${active.length} participant(s) (capacity ${maxParticipants}).` };
}

/** Idea 53353 — Replay scenario library. */
export function buildReplayScenarioLibrary(scenarios = [], options = {}) {
  const rows = (scenarios || []).map(s => {
    const tags = Array.isArray(s.tags) ? s.tags.map(String) : [];
    return { key: keyOf(s), title: String(s.title || keyOf(s)), tags, difficulty: String(s.difficulty || 'intermediate'), durationSec: num(s.durationSec, 0), curated: s.curated === true || tags.length >= 2 };
  }).sort((a, b) => String(a.difficulty).localeCompare(String(b.difficulty)) || String(a.key).localeCompare(String(b.key)));
  const curated = rows.filter(r => r.curated);
  return { rows, library: rows, count: rows.length, curatedCount: curated.length, curated, top: rows[0] || null, summary: `Infinity AI catalogued ${rows.length} scenario(s) in the replay library; ${curated.length} are curated.` };
}

/** Idea 53354 — Redacted replay sharing. */
export function buildRedactedReplayShare(replay = {}, options = {}) {
  const events = Array.isArray(replay.events) ? replay.events : [];
  const rows = events.map((e, idx) => {
    const text = String(e.text || e.label || '');
    const redacted = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted]').replace(/token[:=]\S+/gi, 'token=[redacted]');
    const redactions = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).length + (text.match(/token[:=]\S+/gi) || []).length;
    return { key: String(e.id || `event-${idx}`), atSec: num(e.atSec ?? e.timestampSec, 0), text: redacted, redactions, safe: redactions > 0 || !/@/.test(text) };
  }).sort((a, b) => a.atSec - b.atSec);
  const totalRedactions = rows.reduce((s, r) => s + r.redactions, 0);
  return { rows, count: rows.length, totalRedactions, shareable: true, replay: keyOf(replay), summary: `Infinity AI prepared a redacted replay share with ${totalRedactions} redaction(s).` };
}

/** Idea 53355 — Replay-based certifications. */
export function issueReplayBasedCertifications(candidates = [], options = {}) {
  const passScore = num(options.passScore, 70);
  const rows = (candidates || []).map(c => {
    const quizScore = num(c.quizScore ?? c.score, 0);
    const replaysWatched = num(c.replaysWatched ?? c.watched, 0);
    const passed = quizScore >= passScore && replaysWatched >= num(options.minReplays, 2);
    return { key: String(c.name || c.researcher || c.key || 'candidate'), researcher: String(c.name || c.researcher || c.key || 'candidate'), quizScore, replaysWatched, passed, certified: passed, level: passed ? (quizScore >= 90 ? 'advanced' : 'standard') : 'not-certified' };
  }).sort((a, b) => b.quizScore - a.quizScore || String(a.key).localeCompare(String(b.key)));
  const certified = rows.filter(r => r.certified);
  return { rows, certified, count: rows.length, certifiedCount: certified.length, passScore, top: rows[0] || null, summary: `Infinity AI issued replay-based certifications to ${certified.length} of ${rows.length} candidate(s).` };
}

/** Idea 53356 — Speed-run challenges. */
export function buildSpeedRunChallenges(challenges = [], options = {}) {
  const rows = (challenges || []).map(c => {
    const targetSeconds = num(c.targetSeconds ?? c.budgetSec, 0);
    const bestSeconds = num(c.bestSeconds ?? c.fastestSec, 0);
    const attempts = num(c.attempts, 0);
    const beat = targetSeconds > 0 && bestSeconds > 0 && bestSeconds <= targetSeconds;
    return { key: keyOf(c, 'challenge'), title: String(c.title || keyOf(c, 'challenge')), targetSeconds, bestSeconds, attempts, beat, marginSeconds: targetSeconds && bestSeconds ? round2(targetSeconds - bestSeconds) : 0 };
  }).sort((a, b) => b.marginSeconds - a.marginSeconds || String(a.key).localeCompare(String(b.key)));
  const beaten = rows.filter(r => r.beat);
  return { rows, count: rows.length, beatenCount: beaten.length, beaten, top: rows[0] || null, summary: `Infinity AI tracked ${rows.length} speed-run challenge(s); ${beaten.length} have been beaten.` };
}

/** Idea 53357 — Replay commentary crowdsourcing. */
export function crowdsourceReplayCommentary(comments = [], options = {}) {
  const rows = (comments || []).map(c => {
    const upvotes = num(c.upvotes, 0);
    const text = String(c.text || c.comment || '');
    return { key: String(c.id || c.key || ''), author: c.author ? String(c.author) : null, text, atSec: num(c.atSec ?? c.timestampSec, 0), upvotes, helpful: upvotes >= 2, words: text.split(/\s+/).filter(Boolean).length };
  }).sort((a, b) => b.upvotes - a.upvotes || a.atSec - b.atSec || String(a.key).localeCompare(String(b.key)));
  const helpful = rows.filter(r => r.helpful);
  return { rows, count: rows.length, helpfulCount: helpful.length, helpful, top: rows[0] || null, totalUpvotes: rows.reduce((s, r) => s + r.upvotes, 0), summary: `Infinity AI crowdsourced ${rows.length} replay comment(s); ${helpful.length} are helpful.` };
}

/** Idea 53358 — Counterfactual replay engine. */
export function runCounterfactualReplayEngine(replay = {}, alternateDecision = {}, options = {}) {
  const events = Array.isArray(replay.events) ? replay.events : [];
  const atIndex = num(alternateDecision.atIndex ?? alternateDecision.index, -1);
  const alternateLabel = String(alternateDecision.label || alternateDecision.choice || 'alternate-path');
  const baselineFindings = num(replay.findings ?? replay.validatedFindings, 0);
  const projectedDelta = alternateDecision.projectedFindings !== undefined ? num(alternateDecision.projectedFindings, 0) : (atIndex >= 0 ? 1 : 0);
  const projectedFindings = baselineFindings + projectedDelta;
  const rows = events.slice(0, Math.max(0, atIndex + 1)).map((e, i) => ({ key: String(e.id || `event-${i}`), index: i, label: String(e.label || e.type || `event-${i}`), onAlternatePath: i === atIndex }));
  return { rows, count: events.length, baselineFindings, projectedFindings, projectedDelta, alternateLabel, divergedAt: atIndex, divergencePoint: atIndex >= 0 ? rows[rows.length - 1] || null : null, summary: `Infinity AI ran a counterfactual replay diverging at event ${atIndex}; projected findings ${projectedFindings} vs baseline ${baselineFindings}.` };
}

/** Idea 53359 — Replay attention heatmaps. */
export function buildReplayAttentionHeatmap(views = [], options = {}) {
  const bucketSec = num(options.bucketSec, 10);
  const buckets = new Map();
  for (const v of views || []) {
    const atSec = num(v.atSec ?? v.timestampSec, 0);
    const bucket = Math.floor(atSec / bucketSec) * bucketSec;
    const existing = buckets.get(bucket) || { bucket, views: 0, pauses: 0, rewinds: 0 };
    existing.views += 1;
    existing.pauses += num(v.pauses, v.paused ? 1 : 0);
    existing.rewinds += num(v.rewinds, v.rewound ? 1 : 0);
    buckets.set(bucket, existing);
  }
  const rows = [...buckets.values()].map(b => ({ ...b, intensity: round2(b.views + b.pauses * 2 + b.rewinds * 1.5), bucketLabel: `${b.bucket}s–${b.bucket + bucketSec}s` })).sort((a, b) => b.intensity - a.intensity || a.bucket - b.bucket);
  return { rows, heatmap: rows, count: (views || []).length, bucketSec, peak: rows[0] || null, bucketCount: rows.length, summary: `Infinity AI built an attention heatmap with ${rows.length} bucket(s); peak intensity ${rows[0]?.intensity || 0}.` };
}

/** Idea 53360 — Mobile replay viewing. */
export function buildMobileReplayView(replay = {}, options = {}) {
  const durationSec = num(replay.durationSec ?? replay.duration, 0);
  const events = Array.isArray(replay.events) ? replay.events : [];
  const chapters = [];
  const chapterSize = num(options.chapterSize, 5);
  for (let i = 0; i < events.length; i += chapterSize) {
    chapters.push({ index: chapters.length, startIndex: i, eventCount: Math.min(chapterSize, events.length - i), atSec: num(events[i]?.atSec ?? events[i]?.timestampSec, 0) });
  }
  if (!chapters.length && durationSec > 0) chapters.push({ index: 0, startIndex: 0, eventCount: 0, atSec: 0 });
  return { rows: chapters, chapters, count: events.length, chapterCount: chapters.length, durationSec, durationMinutes: round2(durationSec / 60), mobileReady: chapters.length > 0, top: chapters[0] || null, summary: `Infinity AI prepared a mobile replay view with ${chapters.length} chapter(s) for ${events.length} event(s).` };
}
