/**
 * wave85BCores.js — Infinity AI · Wave 85B
 * Replay community and benchmarking, ideas 53381–53400:
 * cross-team exchange, mentorship matching, live-hunt scenarios,
 * ethics briefings, latency realism, annotation exports,
 * tournaments, playbook updates, viewing streaks, expert
 * playlists, feedback loops, onboarding, mistake search,
 * integrity checks, localized narrations, threat briefings,
 * benchmark consent, peer percentiles, skill benchmarks,
 * and experience-adjusted rankings.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE85_B_IDEAS = [
  { id: 53381, title: 'Cross-Team Replay Exchange', skip: false },
  { id: 53382, title: 'Replay-Based Mentorship Matching', skip: false },
  { id: 53383, title: 'Simulated Live Hunts', skip: false },
  { id: 53384, title: 'Replay Ethics Briefings', skip: false },
  { id: 53385, title: 'Replay Latency Realism', skip: false },
  { id: 53386, title: 'Replay Annotation Exports', skip: false },
  { id: 53387, title: 'Team Replay Tournaments', skip: false },
  { id: 53388, title: 'Replay-Driven Playbook Updates', skip: false },
  { id: 53389, title: 'Replay Viewing Streaks', skip: false },
  { id: 53390, title: 'Expert Replay Playlists', skip: false },
  { id: 53391, title: 'Replay Feedback Loops', skip: false },
  { id: 53392, title: 'New-Hire Replay Onboarding', skip: false },
  { id: 53393, title: 'Replay Search by Mistake Type', skip: false },
  { id: 53394, title: 'Replay Integrity Verification', skip: false },
  { id: 53395, title: 'Localized Replay Narrations', skip: false },
  { id: 53396, title: 'Replay-Based Threat Briefings', skip: false },
  { id: 53397, title: 'Opt-In Benchmark Consent', skip: false },
  { id: 53398, title: 'Anonymized Peer Percentiles', skip: false },
  { id: 53399, title: 'Skill-Area Benchmarks', skip: false },
  { id: 53400, title: 'Experience-Adjusted Rankings', skip: false },
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

/** Idea 53381 — Cross-team replay exchange. */
export function buildCrossTeamReplayExchange(exchanges = [], options = {}) {
  const rows = (exchanges || []).map(e => {
    const sourceTeam = String(e.sourceTeam || e.fromTeam || '');
    const targetTeam = String(e.targetTeam || e.toTeam || '');
    const replayCount = num(e.replayCount ?? e.count, 0) || (Array.isArray(e.replays) ? e.replays.length : 0);
    const accepted = e.accepted === true || String(e.status || '') === 'accepted';
    return { key: String(e.id || e.key || `${sourceTeam}-${targetTeam}`), sourceTeam, targetTeam, replayCount, accepted, crossTeam: sourceTeam !== targetTeam && Boolean(sourceTeam && targetTeam) };
  }).sort((a, b) => b.replayCount - a.replayCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, acceptedCount: rows.filter(r => r.accepted).length, crossTeamCount: rows.filter(r => r.crossTeam).length, totalReplays: rows.reduce((s, r) => s + r.replayCount, 0), top: rows[0] || null, summary: `Infinity AI tracked ${rows.length} cross-team replay exchange(s) covering ${rows.reduce((s, r) => s + r.replayCount, 0)} replay(s).` };
}

/** Idea 53382 — Replay-based mentorship matching. */
export function matchReplayBasedMentorship(mentees = [], mentors = [], options = {}) {
  const rows = (mentees || []).map(m => {
    const weakAreas = Array.isArray(m.weakAreas) ? m.weakAreas.map(String) : (m.weakArea ? [String(m.weakArea)] : []);
    const scored = (mentors || []).map(mt => {
      const strengths = Array.isArray(mt.strengths) ? mt.strengths.map(String) : (mt.strength ? [String(mt.strength)] : []);
      const overlap = weakAreas.filter(a => strengths.includes(a)).length;
      return { key: String(mt.name || mt.researcher || mt.key || 'mentor'), mentor: String(mt.name || mt.researcher || mt.key || 'mentor'), overlap, replaysWatched: num(mt.replaysWatched, 0) };
    }).sort((a, b2) => b2.overlap - a.overlap || b2.replaysWatched - a.replaysWatched || String(a.key).localeCompare(String(b2.key)));
    const best = scored[0] || null;
    return { key: String(m.name || m.researcher || m.key || 'mentee'), mentee: String(m.name || m.researcher || m.key || 'mentee'), weakAreas, bestMentor: best, matchScore: best ? best.overlap : 0, matched: Boolean(best && best.overlap > 0) };
  }).sort((a, b) => b.matchScore - a.matchScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, matchedCount: rows.filter(r => r.matched).length, mentorCount: (mentors || []).length, top: rows[0] || null, summary: `Infinity AI matched ${rows.filter(r => r.matched).length} mentee(s) to mentors via replay strengths.` };
}

/** Idea 53383 — Live-hunt scenario builder (idea: Simulated Live Hunts). */
export function buildSimulatedLiveHunts(scenarios = [], options = {}) {
  const rows = (scenarios || []).map(s => {
    const durationSec = num(s.durationSec ?? s.duration, 0);
    const steps = num(s.steps ?? s.eventCount, 0);
    const liveReady = durationSec > 0 && steps > 0;
    return { key: keyOf(s, 'scenario'), title: String(s.title || keyOf(s, 'scenario')), durationSec, steps, liveReady, difficulty: String(s.difficulty || 'intermediate'), participants: num(s.participants, 0) };
  }).sort((a, b) => b.steps - a.steps || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, liveReadyCount: rows.filter(r => r.liveReady).length, totalSteps: rows.reduce((s, r) => s + r.steps, 0), top: rows[0] || null, summary: `Infinity AI prepared ${rows.filter(r => r.liveReady).length} live-hunt scenario(s) ready to run.` };
}

/** Idea 53384 — Replay ethics briefings. */
export function buildReplayEthicsBriefings(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const text = String(r.text || r.transcript || r.notes || '');
    const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text);
    const hasSecretPattern = /token|secret|password/i.test(text);
    const needsBriefing = hasEmail || hasSecretPattern;
    return { key: keyOf(r), title: String(r.title || keyOf(r)), needsBriefing, hasEmail, hasSecretPattern, cleared: !needsBriefing };
  }).sort((a, b) => Number(b.needsBriefing) - Number(a.needsBriefing) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, briefingCount: rows.filter(r => r.needsBriefing).length, clearedCount: rows.filter(r => r.cleared).length, top: rows[0] || null, summary: `Infinity AI flagged ${rows.filter(r => r.needsBriefing).length} replay(s) needing an ethics briefing.` };
}

/** Idea 53385 — Replay latency realism. */
export function measureReplayLatencyRealism(replays = [], options = {}) {
  const targetMs = num(options.targetMs ?? options.budgetMs, 200);
  const rows = (replays || []).map(r => {
    const events = Array.isArray(r.events) ? r.events : [];
    const latencies = events.map(e => num(e.latencyMs ?? e.delayMs, 0)).filter(v => v > 0);
    const avgLatency = latencies.length ? mean(latencies) : num(r.avgLatencyMs, 0);
    const p95 = latencies.length ? [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1] : avgLatency;
    const realistic = avgLatency <= targetMs;
    return { key: keyOf(r), title: String(r.title || keyOf(r)), avgLatencyMs: round2(avgLatency), p95LatencyMs: round2(p95 || 0), sampleCount: latencies.length, realistic, overBudget: !realistic };
  }).sort((a, b) => a.avgLatencyMs - b.avgLatencyMs || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, targetMs, realisticCount: rows.filter(r => r.realistic).length, avgLatencyMs: mean(rows.map(r => r.avgLatencyMs)), top: rows[0] || null, summary: `Infinity AI measured latency realism for ${rows.length} replay(s) against a ${targetMs}ms target.` };
}

/** Idea 53386 — Replay annotation exports. */
export function buildReplayAnnotationExports(replay = {}, annotations = [], options = {}) {
  const format = String(options.format || 'json');
  const rows = (annotations || []).map((a, i) => {
    const atSec = num(a.atSec ?? a.timestampSec, 0);
    return { key: String(a.id || a.key || `note-${i}`), atSec, text: String(a.text || a.note || ''), author: a.author ? String(a.author) : null, kind: String(a.kind || a.type || 'note') };
  }).sort((a, b) => a.atSec - b.atSec || String(a.key).localeCompare(String(b.key)));
  const payload = format === 'csv'
    ? ['atSec,text,author', ...rows.map(r => `${r.atSec},"${r.text.replace(/"/g, '""')}","${r.author || ''}"`)].join('\n')
    : JSON.stringify(rows);
  return { rows, count: rows.length, format, replay: keyOf(replay), payload, payloadLength: payload.length, exportReady: rows.length > 0, top: rows[0] || null, summary: `Infinity AI exported ${rows.length} annotation(s) in ${format} format.` };
}

/** Idea 53387 — Team replay tournaments. */
export function buildTeamReplayTournaments(entries = [], options = {}) {
  const rows = (entries || []).map(e => {
    const wins = num(e.wins, 0);
    const losses = num(e.losses, 0);
    const findings = num(e.findings ?? e.totalFindings, 0);
    const score = round2(wins * 10 - losses * 2 + findings * 1.5);
    return { key: String(e.team || e.name || e.key || 'team'), team: String(e.team || e.name || e.key || 'team'), wins, losses, findings, games: wins + losses, score, winRate: (wins + losses) ? rate(wins, wins + losses) : 0 };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, bracket: rows, count: rows.length, champion: rows[0] || null, top: rows[0] || null, totalGames: rows.reduce((s, r) => s + r.games, 0), summary: `Infinity AI ranked ${rows.length} team(s) in the replay tournament; leader is ${rows[0]?.key || 'none'}.` };
}

/** Idea 53388 — Replay-driven playbook updates. */
export function applyReplayDrivenPlaybookUpdates(playbooks = [], replays = [], options = {}) {
  const minImpact = num(options.minImpact, 5);
  const rows = (playbooks || []).map(p => {
    const area = String(p.area || p.targetClass || '').toLowerCase();
    const related = (replays || []).filter(r => String(r.targetClass || r.area || '').toLowerCase() === area && num(r.impact ?? r.impactScore, 0) >= minImpact);
    const updates = related.map(r => ({ key: keyOf(r), title: String(r.title || keyOf(r)), impact: num(r.impact ?? r.impactScore, 0) }));
    return { key: keyOf(p, 'playbook'), name: String(p.name || p.title || keyOf(p, 'playbook')), area, updates, updateCount: updates.length, needsUpdate: updates.length > 0 };
  }).sort((a, b) => b.updateCount - a.updateCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, updateCount: rows.filter(r => r.needsUpdate).length, totalUpdates: rows.reduce((s, r) => s + r.updateCount, 0), top: rows[0] || null, summary: `Infinity AI suggested ${rows.reduce((s, r) => s + r.updateCount, 0)} playbook update(s) from replay evidence.` };
}

/** Idea 53389 — Replay viewing streaks. */
export function trackReplayViewingStreaks(viewers = [], options = {}) {
  const rows = (viewers || []).map(v => {
    const days = Array.isArray(v.days) ? v.days.map(Number) : (Array.isArray(v.viewDays) ? v.viewDays.map(Number) : []);
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    let streak = 0; let best = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i] === sorted[i - 1] + 1) streak += 1; else streak = 1;
      best = Math.max(best, streak);
    }
    const currentStreak = sorted.length ? (() => { let s = 1; for (let i = sorted.length - 1; i > 0; i--) { if (sorted[i] === sorted[i - 1] + 1) s += 1; else break; } return s; })() : 0;
    return { key: String(v.name || v.researcher || v.key || 'viewer'), researcher: String(v.name || v.researcher || v.key || 'viewer'), activeDays: sorted.length, currentStreak, bestStreak: best, streakDays: sorted };
  }).sort((a, b) => b.currentStreak - a.currentStreak || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, activeViewerCount: rows.filter(r => r.currentStreak > 0).length, longestStreak: rows.length ? Math.max(...rows.map(r => r.bestStreak)) : 0, top: rows[0] || null, summary: `Infinity AI tracked viewing streaks for ${rows.length} viewer(s); longest streak is ${rows.length ? Math.max(...rows.map(r => r.bestStreak)) : 0} day(s).` };
}

/** Idea 53390 — Expert replay playlists. */
export function buildExpertReplayPlaylists(playlists = [], options = {}) {
  const rows = (playlists || []).map(p => {
    const items = Array.isArray(p.items) ? p.items : (Array.isArray(p.replays) ? p.replays : []);
    const expert = p.expert ? String(p.expert) : (p.curator ? String(p.curator) : null);
    const totalMinutes = round2(items.reduce((s, it) => s + num(it.durationSec, 0) / 60, 0));
    return { key: keyOf(p, 'playlist'), title: String(p.title || keyOf(p, 'playlist')), expert, items: items.map(it => keyOf(it)), itemCount: items.length, totalMinutes, curated: Boolean(expert) };
  }).sort((a, b) => b.itemCount - a.itemCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, curatedCount: rows.filter(r => r.curated).length, totalItems: rows.reduce((s, r) => s + r.itemCount, 0), top: rows[0] || null, summary: `Infinity AI catalogued ${rows.length} expert playlist(s) with ${rows.reduce((s, r) => s + r.itemCount, 0)} replay(s).` };
}

/** Idea 53391 — Replay feedback loops. */
export function buildReplayFeedbackLoops(feedback = [], options = {}) {
  const rows = (feedback || []).map(f => {
    const rating = num(f.rating ?? f.score, 0);
    const acted = f.acted === true || String(f.status || '') === 'acted' || String(f.status || '') === 'closed';
    return { key: String(f.id || f.key || ''), replay: f.replayId ? String(f.replayId) : null, rating, text: String(f.text || f.comment || ''), acted, open: !acted, kind: String(f.kind || f.type || 'comment') };
  }).sort((a, b) => b.rating - a.rating || String(a.key).localeCompare(String(b.key)));
  const openRows = rows.filter(r => r.open);
  return { rows, count: rows.length, openCount: openRows.length, actedCount: rows.length - openRows.length, avgRating: mean(rows.map(r => r.rating)), top: rows[0] || null, summary: `Infinity AI tracked ${rows.length} replay feedback item(s); ${openRows.length} remain open.` };
}

/** Idea 53392 — New-hire replay onboarding. */
export function buildNewHireReplayOnboarding(hires = [], curriculum = [], options = {}) {
  const requiredIds = (curriculum || []).map(c => keyOf(c, 'lesson'));
  const rows = (hires || []).map(h => {
    const completed = Array.isArray(h.completed) ? h.completed.map(String) : [];
    const doneRequired = requiredIds.filter(id => completed.includes(id)).length;
    const progress = requiredIds.length ? rate(doneRequired, requiredIds.length) : 0;
    return { key: String(h.name || h.researcher || h.key || 'hire'), hire: String(h.name || h.researcher || h.key || 'hire'), completedCount: completed.length, requiredCount: requiredIds.length, doneRequired, progress, onboarded: requiredIds.length > 0 && doneRequired === requiredIds.length };
  }).sort((a, b) => b.progress - a.progress || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, curriculumCount: requiredIds.length, onboardedCount: rows.filter(r => r.onboarded).length, avgProgress: mean(rows.map(r => r.progress)), top: rows[0] || null, summary: `Infinity AI tracked onboarding for ${rows.length} new hire(s); ${rows.filter(r => r.onboarded).length} finished the replay curriculum.` };
}

/** Idea 53393 — Replay search by mistake type. */
export function searchReplayByMistakeType(replays = [], query = {}, options = {}) {
  const wanted = String(query.mistakeType || query.type || '').toLowerCase();
  const rows = (replays || []).map(r => {
    const mistakes = Array.isArray(r.mistakes) ? r.mistakes : [];
    const matched = mistakes.filter(m => !wanted || String(m.type || m.label || '').toLowerCase().includes(wanted));
    return { key: keyOf(r), title: String(r.title || keyOf(r)), mistakes: matched.map((m, i) => ({ key: String(m.id || `m-${i}`), type: String(m.type || m.label || ''), severity: num(m.severity, 1) })), matchCount: matched.length, totalMistakes: mistakes.length };
  }).filter(r => r.matchCount > 0).sort((a, b) => b.matchCount - a.matchCount || String(a.key).localeCompare(String(b.key)));
  return { rows, results: rows, count: (replays || []).length, resultCount: rows.length, mistakeType: wanted, totalMatches: rows.reduce((s, r) => s + r.matchCount, 0), top: rows[0] || null, summary: `Infinity AI found ${rows.length} replay(s) with mistake type "${wanted || 'any'}".` };
}

/** Idea 53394 — Replay integrity verification. */
export function verifyReplayIntegrity(replay = {}, options = {}) {
  const events = Array.isArray(replay.events) ? replay.events : [];
  const expectedCount = num(replay.eventCount ?? replay.expectedEvents, events.length);
  const checksum = String(replay.checksum || replay.hash || '');
  const computedLength = events.reduce((s, e) => s + String(e.id || '').length + String(e.type || '').length, 0);
  const countMatches = events.length === expectedCount;
  const hasChecksum = checksum.length >= 4;
  const ordered = events.every((e, i) => i === 0 || num(e.atSec ?? e.timestampSec, 0) >= num(events[i - 1].atSec ?? events[i - 1].timestampSec, 0));
  const verified = countMatches && hasChecksum && ordered;
  const rows = [
    { key: 'event-count', check: 'event-count', passed: countMatches, detail: `${events.length}/${expectedCount}` },
    { key: 'checksum-present', check: 'checksum-present', passed: hasChecksum, detail: hasChecksum ? 'present' : 'missing' },
    { key: 'chronological', check: 'chronological', passed: ordered, detail: ordered ? 'ordered' : 'out-of-order' },
  ];
  return { rows, checks: rows, count: events.length, expectedCount, verified, passedCount: rows.filter(r => r.passed).length, checksumLength: checksum.length, computedLength, replay: keyOf(replay), summary: `Infinity AI verified replay integrity: ${verified ? 'verified' : 'needs review'} (${rows.filter(r => r.passed).length}/3 checks passed).` };
}

/** Idea 53395 — Localized replay narrations. */
export function buildLocalizedReplayNarrations(replay = {}, options = {}) {
  const languages = (options.languages || options.targetLanguages || ['en']).map(s => String(s).toLowerCase());
  const baseWords = String(replay.transcript || replay.narration || '').split(/\s+/).filter(Boolean).length || num(replay.wordCount, 0);
  const dictionary = options.dictionary || { auth: { es: 'autenticación', fr: 'authentification', de: 'Authentifizierung' }, check: { es: 'verificación', fr: 'vérification', de: 'Prüfung' } };
  const sourceTokens = tokensOf(replay.transcript || replay.narration || '');
  const rows = languages.map(lang => {
    if (lang === 'en') return { key: lang, language: lang, words: baseWords, coverage: 1, ready: true };
    let covered = 0;
    for (const t of sourceTokens) if (dictionary[t] && dictionary[t][lang]) covered += 1;
    const coverage = sourceTokens.length ? round2(covered / sourceTokens.length) : 1;
    return { key: lang, language: lang, words: baseWords, coverage, ready: coverage > 0 || baseWords === 0 };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, languages, replay: keyOf(replay), baseWords, localizedCount: rows.filter(r => r.ready).length, top: rows[0] || null, summary: `Infinity AI localized the replay narration into ${rows.length} language(s).` };
}

/** Idea 53396 — Replay-based threat briefings. */
export function buildReplayBasedThreatBriefings(replays = [], options = {}) {
  const rows = (replays || []).map(r => {
    const findings = num(r.findings ?? r.validatedFindings, 0);
    const severities = Array.isArray(r.findingsList) ? r.findingsList.map(f => num(f.severity, 1)) : [];
    const maxSeverity = severities.length ? Math.max(...severities) : num(r.maxSeverity, findings > 0 ? 3 : 0);
    const threatLevel = maxSeverity >= 5 ? 'critical' : maxSeverity >= 4 ? 'high' : maxSeverity >= 2 ? 'medium' : 'low';
    return { key: keyOf(r), title: String(r.title || keyOf(r)), findings, maxSeverity, threatLevel, briefingReady: findings > 0 };
  }).sort((a, b) => b.maxSeverity - a.maxSeverity || b.findings - a.findings || String(a.key).localeCompare(String(b.key)));
  return { rows, briefings: rows, count: rows.length, criticalCount: rows.filter(r => r.threatLevel === 'critical').length, readyCount: rows.filter(r => r.briefingReady).length, top: rows[0] || null, summary: `Infinity AI drafted threat briefings for ${rows.length} replay(s); ${rows.filter(r => r.threatLevel === 'critical').length} are critical.` };
}

/** Idea 53397 — Opt-in benchmark consent. */
export function manageOptInBenchmarkConsent(records = [], options = {}) {
  const rows = (records || []).map(r => {
    const optedIn = r.optedIn === true || r.consent === true || String(r.consentStatus || '') === 'opted-in';
    const optedOut = r.optedIn === false || String(r.consentStatus || '') === 'opted-out';
    return { key: String(r.name || r.researcher || r.key || 'researcher'), researcher: String(r.name || r.researcher || r.key || 'researcher'), optedIn, optedOut, status: optedIn ? 'opted-in' : optedOut ? 'opted-out' : 'pending' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.key).localeCompare(String(b.key)));
  const optedInRows = rows.filter(r => r.optedIn);
  return { rows, count: rows.length, optedInCount: optedInRows.length, optedOutCount: rows.filter(r => r.optedOut).length, pendingCount: rows.filter(r => r.status === 'pending').length, consentRate: rows.length ? rate(optedInRows.length, rows.length) : 0, top: rows[0] || null, summary: `Infinity AI recorded benchmark consent for ${rows.length} researcher(s); ${optedInRows.length} opted in.` };
}

/** Idea 53398 — Anonymized peer percentiles. */
export function computeAnonymizedPeerPercentiles(scores = [], options = {}) {
  const values = (scores || []).map(s => num(s.score ?? s.value, 0));
  const sorted = [...values].sort((a, b) => a - b);
  const rows = (scores || []).map((s, i) => {
    const value = num(s.score ?? s.value, 0);
    const below = sorted.filter(v => v < value).length;
    const percentile = sorted.length ? round2(below / sorted.length * 100) : 0;
    return { key: `peer-${i + 1}`, label: `Peer ${i + 1}`, score: value, percentile, band: percentile >= 90 ? 'top-decile' : percentile >= 50 ? 'above-median' : 'below-median' };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const medianValue = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  return { rows, count: rows.length, median: medianValue, top: rows[0] || null, anonymized: true, summary: `Infinity AI computed anonymized peer percentiles for ${rows.length} score(s); median is ${medianValue}.` };
}

/** Idea 53399 — Skill-area benchmarks. */
export function buildSkillAreaBenchmarks(records = [], options = {}) {
  const byArea = new Map();
  for (const r of records || []) {
    const area = String(r.area || r.skillArea || r.skill || 'general');
    const existing = byArea.get(area) || [];
    existing.push(num(r.score ?? r.value, 0));
    byArea.set(area, existing);
  }
  const rows = [...byArea.entries()].map(([area, vals]) => {
    const avg = mean(vals);
    const best = Math.max(...vals);
    return { key: area, area, count: vals.length, avg, best, benchmark: round2(avg * 0.9), aboveBenchmark: vals.filter(v => v >= round2(avg * 0.9)).length };
  }).sort((a, b) => b.avg - a.avg || String(a.key).localeCompare(String(b.key)));
  return { rows, count: (records || []).length, areaCount: rows.length, top: rows[0] || null, summary: `Infinity AI built skill-area benchmarks across ${rows.length} area(s) from ${(records || []).length} record(s).` };
}

/** Idea 53400 — Experience-adjusted rankings. */
export function buildExperienceAdjustedRankings(researchers = [], options = {}) {
  const rows = (researchers || []).map(r => {
    const rawScore = num(r.score ?? r.rawScore, 0);
    const months = num(r.experienceMonths ?? r.months, 0);
    const hunts = num(r.hunts ?? r.huntCount, 0);
    const experienceFactor = round2(1 + Math.min(0.5, months / 120) + Math.min(0.3, hunts / 100));
    const adjusted = round2(rawScore * experienceFactor);
    return { key: String(r.name || r.researcher || r.key || 'researcher'), researcher: String(r.name || r.researcher || r.key || 'researcher'), rawScore, experienceMonths: months, hunts, experienceFactor, adjustedScore: adjusted };
  }).sort((a, b) => b.adjustedScore - a.adjustedScore || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, rankings: rows, count: rows.length, top: rows[0] || null, avgAdjusted: mean(rows.map(r => r.adjustedScore)), summary: `Infinity AI ranked ${rows.length} researcher(s) with experience-adjusted scores; leader is ${rows[0]?.key || 'none'}.` };
}
