/**
 * wave85ACore.js — Infinity AI · Wave 85A
 * Replay learning round 2, ideas 53361–53380:
 * transcript search, live sessions, difficulty progression,
 * multi-hunt comparisons, bookmarking, expert paths,
 * performance analytics, VR mode, narration styles,
 * interview tasks, failure clinics, scenario randomizer,
 * decision rationales, conference exports, accessibility,
 * completion certificates, adaptive difficulty, discussion
 * threads, historical archive, and metadata standards.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE85_A_IDEAS = [
  { id: 53361, title: 'Replay Transcript Search', skip: false },
  { id: 53362, title: 'Live Replay Sessions', skip: false },
  { id: 53363, title: 'Replay Difficulty Progression', skip: false },
  { id: 53364, title: 'Multi-Hunt Replay Comparisons', skip: false },
  { id: 53365, title: 'Replay Bookmarking', skip: false },
  { id: 53366, title: 'Expert Alternative Paths', skip: false },
  { id: 53367, title: 'Replay Performance Analytics', skip: false },
  { id: 53368, title: 'VR Hunt Replay Mode', skip: false },
  { id: 53369, title: 'Replay Narration Styles', skip: false },
  { id: 53370, title: 'Replay-Based Interview Tasks', skip: false },
  { id: 53371, title: 'Failure Replay Clinics', skip: false },
  { id: 53372, title: 'Replay Scenario Randomizer', skip: false },
  { id: 53373, title: 'Trainee Decision Rationales', skip: false },
  { id: 53374, title: 'Replay Export for Conferences', skip: false },
  { id: 53375, title: 'Replay Accessibility Features', skip: false },
  { id: 53376, title: 'Replay Completion Certificates', skip: false },
  { id: 53377, title: 'Adaptive Replay Difficulty', skip: false },
  { id: 53378, title: 'Replay Discussion Threads', skip: false },
  { id: 53379, title: 'Historical Replay Archive', skip: false },
  { id: 53380, title: 'Replay Metadata Standards', skip: false },
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
function mulberry32(seed) {
  let a = Number(seed || 0) >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Idea 53361 — Replay transcript search. */
export function searchReplayTranscripts(transcripts = [], query = {}, options = {}) {
  const queryText = String(query.text || query.keywords || '');
  const queryTokens = new Set(tokensOf(queryText));
  const limit = num(options.limit, 10);
  const rows = (transcripts || []).map(t => {
    const text = String(t.text || t.transcript || '');
    const title = String(t.title || keyOf(t));
    const tokens = new Set(tokensOf(`${title} ${text}`));
    let hits = 0;
    for (const qt of queryTokens) if (tokens.has(qt)) hits += 1;
    const score = queryTokens.size ? round2(hits / queryTokens.size) : 0;
    const matchedLines = String(text).split('\n').filter(line => {
      const lineTokens = new Set(tokensOf(line));
      for (const qt of queryTokens) if (lineTokens.has(qt)) return true;
      return false;
    }).length;
    return { key: keyOf(t), title, hits, score, matchedLines, durationSec: num(t.durationSec, 0) };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || b.hits - a.hits || String(a.key).localeCompare(String(b.key))).slice(0, limit);
  return { rows, results: rows, count: (transcripts || []).length, resultCount: rows.length, query: queryText, top: rows[0] || null, summary: `Infinity AI found ${rows.length} replay transcript(s) matching the query.` };
}

/** Idea 53362 — Live replay sessions. */
export function buildLiveReplaySessions(sessions = [], options = {}) {
  const capacityPerSession = num(options.capacity ?? options.maxViewers, 50);
  const rows = (sessions || []).map(s => {
    const viewers = num(s.viewers ?? s.viewerCount, 0);
    const started = s.started !== false && s.live !== false;
    const live = s.live === true || (started && num(s.endedAt ?? s.ended, 0) === 0);
    const capacityRatio = capacityPerSession ? round2(viewers / capacityPerSession) : 0;
    return { key: keyOf(s, 'session'), title: String(s.title || keyOf(s, 'session')), host: s.host ? String(s.host) : null, viewers, live, joinable: live && viewers < capacityPerSession, capacityRatio, full: viewers >= capacityPerSession };
  }).sort((a, b) => Number(b.live) - Number(a.live) || b.viewers - a.viewers || String(a.key).localeCompare(String(b.key)));
  const liveRows = rows.filter(r => r.live);
  return { rows, count: rows.length, liveCount: liveRows.length, liveSessions: liveRows, totalViewers: rows.reduce((s, r) => s + r.viewers, 0), joinableCount: rows.filter(r => r.joinable).length, top: rows[0] || null, summary: `Infinity AI listed ${rows.length} live replay session(s); ${liveRows.length} are live.` };
}

/** Idea 53363 — Replay difficulty progression. */
export function buildReplayDifficultyProgression(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const findings = num(r.findings ?? r.validatedFindings, 0);
    const steps = num(r.steps ?? r.eventCount, 0);
    const complexity = round2(findings * 2 + steps * 0.2 + num(r.durationSec, 0) / 600);
    const level = complexity >= 12 ? 5 : complexity >= 8 ? 4 : complexity >= 5 ? 3 : complexity >= 2 ? 2 : 1;
    return { key: keyOf(r), title: String(r.title || keyOf(r)), findings, steps, complexity, level, nextLevelAt: round2((level) * 3) };
  }).sort((a, b) => a.level - b.level || a.complexity - b.complexity || String(a.key).localeCompare(String(b.key)));
  const maxLevel = rows.length ? Math.max(...rows.map(r => r.level)) : 0;
  return { rows, count: rows.length, maxLevel, beginnerCount: rows.filter(r => r.level <= 2).length, advancedCount: rows.filter(r => r.level >= 4).length, progression: rows, top: rows[rows.length - 1] || null, summary: `Infinity AI built a difficulty progression across ${rows.length} replay(s) up to level ${maxLevel}.` };
}

/** Idea 53364 — Multi-hunt replay comparisons. */
export function compareMultiHuntReplays(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const findings = num(r.findings ?? r.validatedFindings, 0);
    const durationMin = round2(num(r.durationSec ?? r.duration, 0) / 60) || num(r.durationMinutes, 0);
    const efficiency = durationMin ? round2(findings / durationMin * 10) : findings;
    const coverage = clamp01(r.coverage);
    return { key: keyOf(r), title: String(r.title || keyOf(r)), findings, durationMinutes: durationMin, efficiency, coverage, score: round2(findings * 3 + efficiency + coverage * 5) };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  const best = rows[0] || null;
  const worst = rows[rows.length - 1] || null;
  return { rows, count: rows.length, best, worst, fastest: rows.length ? [...rows].sort((a, b) => a.durationMinutes - b.durationMinutes)[0] : null, avgFindings: mean(rows.map(r => r.findings)), top: best, summary: `Infinity AI compared ${rows.length} hunt replay(s); best performer is ${best?.key || 'none'}.` };
}

/** Idea 53365 — Replay bookmarking. */
export function manageReplayBookmarks(replay = {}, bookmarks = [], options = {}) {
  const durationSec = num(replay.durationSec ?? replay.duration, 0);
  const rows = (bookmarks || []).map((b, i) => {
    const atSec = num(b.atSec ?? b.timestampSec, 0);
    return { key: String(b.id || b.key || `bookmark-${i}`), atSec, label: String(b.label || b.title || `Bookmark ${i + 1}`), note: String(b.note || ''), pinned: b.pinned === true, withinReplay: durationSec ? atSec <= durationSec : true };
  }).sort((a, b) => a.atSec - b.atSec || String(a.key).localeCompare(String(b.key)));
  const pinned = rows.filter(r => r.pinned);
  return { rows, bookmarks: rows, count: rows.length, pinnedCount: pinned.length, pinned, replay: keyOf(replay), durationSec, top: rows[0] || null, summary: `Infinity AI organized ${rows.length} bookmark(s) on the replay; ${pinned.length} are pinned.` };
}

/** Idea 53366 — Expert alternative paths. */
export function buildExpertAlternativePaths(replay = {}, paths = [], options = {}) {
  const rows = (paths || []).map((p, i) => {
    const steps = Array.isArray(p.steps) ? p.steps.map(String) : [];
    const estimatedFindings = num(p.estimatedFindings ?? p.findings, 0);
    const timeMinutes = num(p.timeMinutes ?? p.estimatedMinutes, 0);
    const expert = p.expert ? String(p.expert) : null;
    const efficiency = timeMinutes ? round2(estimatedFindings / timeMinutes * 10) : estimatedFindings;
    return { key: String(p.id || p.key || `path-${i}`), label: String(p.label || p.title || `Path ${i + 1}`), expert, steps, stepCount: steps.length, estimatedFindings, timeMinutes, efficiency, viable: steps.length > 0 };
  }).sort((a, b) => b.efficiency - a.efficiency || String(a.key).localeCompare(String(b.key)));
  return { rows, paths: rows, count: rows.length, viableCount: rows.filter(r => r.viable).length, bestPath: rows[0] || null, top: rows[0] || null, replay: keyOf(replay), summary: `Infinity AI mapped ${rows.length} expert alternative path(s) for the replay.` };
}

/** Idea 53367 — Replay performance analytics. */
export function analyzeReplayPerformance(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const views = num(r.views ?? r.viewCount, 0);
    const completions = num(r.completions ?? r.completedViews, 0);
    const quizAvg = num(r.quizAvg ?? r.avgQuizScore, 0);
    const completionRate = views ? rate(completions, views) : 0;
    const engagement = round2(completionRate * 10 + quizAvg * 0.1 + Math.min(10, views * 0.01));
    return { key: keyOf(r), title: String(r.title || keyOf(r)), views, completions, completionRate, quizAvg, engagement };
  }).sort((a, b) => b.engagement - a.engagement || String(a.key).localeCompare(String(b.key)));
  const totalViews = rows.reduce((s, r) => s + r.views, 0);
  const totalCompletions = rows.reduce((s, r) => s + r.completions, 0);
  return { rows, count: rows.length, totalViews, totalCompletions, overallCompletionRate: totalViews ? rate(totalCompletions, totalViews) : 0, avgEngagement: mean(rows.map(r => r.engagement)), top: rows[0] || null, summary: `Infinity AI analyzed performance for ${rows.length} replay(s); overall completion rate ${totalViews ? rate(totalCompletions, totalViews) : 0}.` };
}

/** Idea 53368 — VR hunt replay mode. */
export function buildVRHuntReplayMode(replay = {}, options = {}) {
  const durationSec = num(replay.durationSec ?? replay.duration, 0);
  const events = Array.isArray(replay.events) ? replay.events : [];
  const chapters = [];
  const chapterSize = num(options.chapterSize, 4);
  for (let i = 0; i < events.length; i += chapterSize) {
    const slice = events.slice(i, i + chapterSize);
    chapters.push({ index: chapters.length, startIndex: i, eventCount: slice.length, atSec: num(slice[0]?.atSec ?? slice[0]?.timestampSec, 0), spatial: true });
  }
  if (!chapters.length && durationSec > 0) chapters.push({ index: 0, startIndex: 0, eventCount: 0, atSec: 0, spatial: true });
  const comfortScore = round2(Math.max(0, 10 - chapters.length * 0.3));
  return { rows: chapters, chapters, count: events.length, chapterCount: chapters.length, durationSec, durationMinutes: round2(durationSec / 60), vrReady: chapters.length > 0, comfortScore, top: chapters[0] || null, summary: `Infinity AI prepared a VR replay view with ${chapters.length} spatial chapter(s) for ${events.length} event(s).` };
}

/** Idea 53369 — Replay narration styles. */
export function buildReplayNarrationStyles(replay = {}, options = {}) {
  const styles = (options.styles || ['concise', 'detailed', 'mentor', 'analyst']).map(String);
  const transcriptWords = String(replay.transcript || replay.debrief || '').split(/\s+/).filter(Boolean).length || num(replay.wordCount, 0);
  const rows = styles.map(style => {
    const factor = style === 'detailed' ? 1.4 : style === 'mentor' ? 1.2 : style === 'analyst' ? 1.1 : 1;
    const words = Math.round(transcriptWords * factor);
    return { key: style, style, words, minutes: round2(words / 150), available: true };
  }).sort((a, b) => a.words - b.words || String(a.key).localeCompare(String(b.key)));
  return { rows, styles: rows, count: rows.length, replay: keyOf(replay), baseWords: transcriptWords, top: rows[rows.length - 1] || null, summary: `Infinity AI generated ${rows.length} narration style(s) for the replay.` };
}

/** Idea 53370 — Replay-based interview tasks. */
export function buildReplayBasedInterviewTasks(replays = [], options = {}) {
  const maxTasks = num(options.limit, 6);
  const rows = (replays || []).map(r => {
    const decisions = Array.isArray(r.events) ? r.events.filter(e => e.decisionPoint === true || e.type === 'decision').length : num(r.decisionCount, 0);
    const findings = num(r.findings ?? r.validatedFindings, 0);
    const taskScore = round2(decisions * 2 + findings * 1.5);
    return { key: keyOf(r), title: String(r.title || keyOf(r)), decisions, findings, taskScore, task: `Review ${keyOf(r)} and explain ${Math.max(1, decisions)} decision(s)` };
  }).sort((a, b) => b.taskScore - a.taskScore || String(a.key).localeCompare(String(b.key))).slice(0, maxTasks);
  return { rows, tasks: rows, count: (replays || []).length, taskCount: rows.length, top: rows[0] || null, summary: `Infinity AI drafted ${rows.length} replay-based interview task(s) from ${(replays || []).length} replay(s).` };
}

/** Idea 53371 — Failure replay clinics. */
export function buildFailureReplayClinics(cases = [], options = {}) {
  const rows = (cases || []).map(c => {
    const failures = Array.isArray(c.failures) ? c.failures : (Array.isArray(c.mistakes) ? c.mistakes : []);
    const severityTotal = failures.reduce((s, f) => s + num(f.severity, 1), 0);
    const clinicPriority = round2(severityTotal + failures.length);
    return { key: keyOf(c, 'case'), title: String(c.title || keyOf(c, 'case')), failures: failures.map((f, i) => ({ key: String(f.id || `failure-${i}`), label: String(f.label || f.type || 'failure'), severity: num(f.severity, 1) })), failureCount: failures.length, severityTotal, clinicPriority, needsClinic: failures.length > 0 };
  }).sort((a, b) => b.clinicPriority - a.clinicPriority || String(a.key).localeCompare(String(b.key)));
  const clinicCases = rows.filter(r => r.needsClinic);
  return { rows, count: rows.length, clinicCount: clinicCases.length, clinicCases, totalFailures: rows.reduce((s, r) => s + r.failureCount, 0), top: rows[0] || null, summary: `Infinity AI scheduled ${clinicCases.length} failure clinic case(s) covering ${rows.reduce((s, r) => s + r.failureCount, 0)} failure(s).` };
}

/** Idea 53372 — Replay scenario randomizer (seeded). */
export function buildReplayScenarioRandomizer(scenarios = [], options = {}) {
  const seed = num(options.seed ?? options.randomSeed, 42);
  const count = num(options.count ?? options.pick, Math.min(3, (scenarios || []).length));
  const rand = mulberry32(seed);
  const pool = (scenarios || []).map((s, i) => ({ key: keyOf(s, `scenario-${i}`), title: String(s.title || keyOf(s, `scenario-${i}`)), originalIndex: i, difficulty: String(s.difficulty || 'intermediate') }));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }
  const picks = shuffled.slice(0, Math.max(0, count));
  return { rows: picks, picks, count: pool.length, pickCount: picks.length, pickedCount: picks.length, seed, top: picks[0] || null, summary: `Infinity AI picked ${picks.length} scenario(s) with seed ${seed} from a pool of ${pool.length}.` };
}

/** Idea 53373 — Trainee decision rationales. */
export function captureTraineeDecisionRationales(events = [], options = {}) {
  const rows = (events || []).map((e, i) => {
    const rationale = String(e.rationale || e.reason || e.explanation || '');
    const words = rationale.split(/\s+/).filter(Boolean).length;
    const decided = e.decisionPoint === true || e.type === 'decision' || Boolean(e.choice);
    return { key: String(e.id || `event-${i}`), index: i, decided, choice: e.choice ? String(e.choice) : null, rationale, wordCount: words, hasRationale: words >= 3 };
  });
  const decisions = rows.filter(r => r.decided);
  const explained = decisions.filter(r => r.hasRationale);
  return { rows, decisions, count: rows.length, decisionCount: decisions.length, explainedCount: explained.length, rationaleRate: decisions.length ? rate(explained.length, decisions.length) : 0, top: decisions[0] || null, summary: `Infinity AI captured rationales for ${explained.length} of ${decisions.length} trainee decision(s).` };
}

/** Idea 53374 — Replay export for conferences. */
export function buildReplayExportForConferences(replays = [], options = {}) {
  const format = String(options.format || 'slides');
  const rows = (replays || []).map(r => {
    const findings = num(r.findings ?? r.validatedFindings, 0);
    const durationMin = round2(num(r.durationSec, 0) / 60);
    const exportReady = findings > 0;
    return { key: keyOf(r), title: String(r.title || keyOf(r)), findings, durationMinutes: durationMin, format, exportReady, slideCount: Math.max(1, Math.ceil(durationMin / 2) + findings) };
  }).sort((a, b) => b.findings - a.findings || String(a.key).localeCompare(String(b.key)));
  const ready = rows.filter(r => r.exportReady);
  return { rows, count: rows.length, format, exportReadyCount: ready.length, ready, totalSlides: rows.reduce((s, r) => s + r.slideCount, 0), top: rows[0] || null, summary: `Infinity AI prepared ${ready.length} replay export(s) in ${format} format for conferences.` };
}

/** Idea 53375 — Replay accessibility features. */
export function buildReplayAccessibilityFeatures(replay = {}, features = [], options = {}) {
  const requested = (features || []).map(f => String(typeof f === 'string' ? f : (f.name || f.key || ''))).filter(Boolean);
  const catalog = ['captions', 'transcript', 'audio-description', 'keyboard-nav', 'high-contrast', 'reduced-motion', 'speed-control'];
  const transcriptWords = String(replay.transcript || '').split(/\s+/).filter(Boolean).length;
  const rows = catalog.map(name => {
    const enabled = requested.includes(name) || (name === 'transcript' && transcriptWords > 0) || (name === 'captions' && transcriptWords > 0);
    return { key: name, feature: name, enabled, available: true };
  });
  const enabledRows = rows.filter(r => r.enabled);
  return { rows, count: rows.length, enabledCount: enabledRows.length, enabled: enabledRows, replay: keyOf(replay), transcriptWords, top: enabledRows[0] || null, summary: `Infinity AI enabled ${enabledRows.length} accessibility feature(s) for the replay.` };
}

/** Idea 53376 — Replay completion certificates. */
export function issueReplayCompletionCertificates(candidates = [], options = {}) {
  const passScore = num(options.passScore, 70);
  const rows = (candidates || []).map(c => {
    const score = num(c.score ?? c.quizScore ?? c.completionScore, 0);
    const watched = num(c.replaysWatched ?? c.watched, 0);
    const completed = score >= passScore && watched >= num(options.minReplays, 1);
    return { key: String(c.name || c.researcher || c.key || 'candidate'), researcher: String(c.name || c.researcher || c.key || 'candidate'), score, replaysWatched: watched, completed, certified: completed, level: completed ? (score >= 90 ? 'advanced' : 'standard') : 'not-certified' };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const certified = rows.filter(r => r.certified);
  return { rows, certified, count: rows.length, certifiedCount: certified.length, passScore, top: rows[0] || null, summary: `Infinity AI issued replay completion certificates to ${certified.length} of ${rows.length} candidate(s).` };
}

/** Idea 53377 — Adaptive replay difficulty. */
export function buildAdaptiveReplayDifficulty(profile = {}, replays = [], options = {}) {
  const skill = clamp01(profile.skill ?? profile.skillLevel ?? 0.5);
  const rows = (replays || []).map(r => {
    const base = num(r.complexity ?? r.difficultyScore, 0) || round2(num(r.findings, 0) * 2 + num(r.steps ?? r.eventCount, 0) * 0.2);
    const fit = round2(1 - Math.abs(base / 15 - skill));
    const recommended = fit >= 0.6;
    return { key: keyOf(r), title: String(r.title || keyOf(r)), baseComplexity: base, fit, recommended, adjustedLevel: base <= 4 ? 'beginner' : base <= 8 ? 'intermediate' : 'advanced' };
  }).sort((a, b) => b.fit - a.fit || String(a.key).localeCompare(String(b.key)));
  const recommended = rows.filter(r => r.recommended);
  return { rows, count: rows.length, skill, recommendedCount: recommended.length, recommended, top: rows[0] || null, summary: `Infinity AI adapted replay difficulty for skill ${skill}; ${recommended.length} replay(s) recommended.` };
}

/** Idea 53378 — Replay discussion threads. */
export function buildReplayDiscussionThreads(threads = [], options = {}) {
  const rows = (threads || []).map(t => {
    const posts = Array.isArray(t.posts) ? t.posts : (Array.isArray(t.comments) ? t.comments : []);
    const postRows = posts.map((p, i) => ({ key: String(p.id || `post-${i}`), author: p.author ? String(p.author) : null, text: String(p.text || p.comment || ''), atSec: num(p.atSec, 0) }));
    const lastActivity = postRows.length ? Math.max(...postRows.map(p => p.atSec)) : 0;
    return { key: keyOf(t, 'thread'), title: String(t.title || keyOf(t, 'thread')), posts: postRows, postCount: postRows.length, lastActivity, resolved: t.resolved === true, active: postRows.length > 0 && !t.resolved };
  }).sort((a, b) => b.postCount - a.postCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, activeCount: rows.filter(r => r.active).length, resolvedCount: rows.filter(r => r.resolved).length, totalPosts: rows.reduce((s, r) => s + r.postCount, 0), top: rows[0] || null, summary: `Infinity AI organized ${rows.length} replay discussion thread(s) with ${rows.reduce((s, r) => s + r.postCount, 0)} post(s).` };
}

/** Idea 53379 — Historical replay archive. */
export function buildHistoricalReplayArchive(replays = [], options = {}) {
  const cutoffYear = num(options.cutoffYear ?? options.beforeYear, 2025);
  const rows = (replays || []).map(r => {
    const year = num(r.year ?? r.archivedYear, 2026);
    const archived = year <= cutoffYear || r.archived === true;
    return { key: keyOf(r), title: String(r.title || keyOf(r)), year, archived, findings: num(r.findings, 0) };
  }).sort((a, b) => a.year - b.year || String(a.key).localeCompare(String(b.key)));
  const archivedRows = rows.filter(r => r.archived);
  return { rows, archive: archivedRows, count: rows.length, archivedCount: archivedRows.length, activeCount: rows.length - archivedRows.length, earliestYear: rows.length ? rows[0].year : null, top: rows[0] || null, summary: `Infinity AI archived ${archivedRows.length} historical replay(s) in the archive.` };
}

/** Idea 53380 — Replay metadata standards. */
export function validateReplayMetadataStandards(records = [], options = {}) {
  const required = (options.requiredFields || ['id', 'title', 'durationSec', 'findings']).map(String);
  const rows = (records || []).map(r => {
    const present = required.filter(f => r[f] !== undefined && r[f] !== null && r[f] !== '');
    const missing = required.filter(f => !(f in r) || r[f] === undefined || r[f] === null || r[f] === '');
    const compliance = required.length ? round2(present.length / required.length) : 1;
    return { key: keyOf(r), title: String(r.title || keyOf(r)), present, missing, compliance, compliant: missing.length === 0 };
  }).sort((a, b) => b.compliance - a.compliance || String(a.key).localeCompare(String(b.key)));
  const compliant = rows.filter(r => r.compliant);
  return { rows, count: rows.length, requiredFields: required, compliantCount: compliant.length, nonCompliantCount: rows.length - compliant.length, avgCompliance: mean(rows.map(r => r.compliance)), top: rows[0] || null, summary: `Infinity AI validated metadata for ${rows.length} replay(s); ${compliant.length} are fully compliant.` };
}
