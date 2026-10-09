/**
 * wave84ACore.js — Infinity AI · Wave 84A
 * Lessons and retrospectives round 2, ideas 53321–53340:
 * participation metrics, translation layer, debrief podcasts,
 * dependency graphs, bias checks, retirement ceremonies,
 * leaderboards, embedding search, ticket integration, checklist
 * updates, post-incident reviews, community sharing, calibration,
 * impact dashboards, micro-lessons, context snapshots, follow-up
 * hunts, inheritance rules, annual anthology, and kickoff rituals.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE84_A_IDEAS = [
  { id: 53321, title: 'Retrospective Participation Metrics', skip: false },
  { id: 53322, title: 'Lesson Translation Layer', skip: false },
  { id: 53323, title: 'Hunt Debrief Podcasts', skip: false },
  { id: 53324, title: 'Lesson Dependency Graphs', skip: false },
  { id: 53325, title: 'Retrospective Bias Checks', skip: false },
  { id: 53326, title: 'Lesson Retirement Ceremonies', skip: false },
  { id: 53327, title: 'Team Lesson Leaderboards', skip: false },
  { id: 53328, title: 'Lesson Embedding Search', skip: false },
  { id: 53329, title: 'Retrospective Integration with Tickets', skip: false },
  { id: 53330, title: 'Lesson-Driven Checklist Updates', skip: false },
  { id: 53331, title: 'Post-Incident Learning Reviews', skip: false },
  { id: 53332, title: 'Lesson Sharing with Community', skip: false },
  { id: 53333, title: 'Retrospective Calibration Sessions', skip: false },
  { id: 53334, title: 'Lesson Impact Dashboards', skip: false },
  { id: 53335, title: 'Micro-Lesson Capture', skip: false },
  { id: 53336, title: 'Lesson Context Snapshots', skip: false },
  { id: 53337, title: 'Retrospective Follow-Up Hunts', skip: false },
  { id: 53338, title: 'Lesson Inheritance Rules', skip: false },
  { id: 53339, title: 'Annual Lessons Anthology', skip: false },
  { id: 53340, title: 'Lesson-Driven Hunt Kickoff Rituals', skip: false },
];

function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp01(value) { return Math.min(1, Math.max(0, num(value, 0))); }
function rate(part, whole) { return whole ? round2(part / whole) : 0; }
function mean(values) { return values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : 0; }
function keyOf(item, fallback = 'lesson') {
  return String(item.key || item.id || item.lessonId || item.title || item.name || item.area || item.vertical || fallback);
}
function tokensOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}
function wordCount(text) { return String(text || '').split(/\s+/).filter(Boolean).length; }

/** Idea 53321 — Participation metrics for retrospectives. */
export function computeRetrospectiveParticipationMetrics(participants = [], contributions = [], options = {}) {
  const contribByName = new Map();
  for (const c of contributions || []) {
    const name = String(c.researcher || c.name || c.author || '');
    if (!name) continue;
    const existing = contribByName.get(name) || { comments: 0, lessons: 0, speakingMs: 0 };
    existing.comments += num(c.comments, 1);
    existing.lessons += num(c.lessons ?? c.lessonsAdded, 0);
    existing.speakingMs += num(c.speakingMs ?? c.speakingMinutes * 60000, 0);
    contribByName.set(name, existing);
  }
  const rows = (participants || []).map(p => {
    const name = String(p.name || p.researcher || p.key || 'researcher');
    const c = contribByName.get(name) || { comments: 0, lessons: 0, speakingMs: 0 };
    const contributed = p.contributed === true || c.comments > 0 || c.lessons > 0 || Boolean(p.take);
    const engagement = round2(c.comments * 3 + c.lessons * 10 + (c.speakingMs / 60000) * 2);
    return { key: name, researcher: name, attended: p.attended !== false, contributed, comments: c.comments, lessons: c.lessons, speakingMinutes: round2(c.speakingMs / 60000), engagement, silent: !contributed };
  }).sort((a, b) => b.engagement - a.engagement || String(a.key).localeCompare(String(b.key)));
  const silentCount = rows.filter(r => r.silent).length;
  return { rows, count: rows.length, participantCount: rows.length, contributedCount: rows.length - silentCount, silentCount, participationRate: rate(rows.length - silentCount, rows.length), avgEngagement: mean(rows.map(r => r.engagement)), top: rows[0] || null, silent: rows.filter(r => r.silent), summary: `Infinity AI measured retrospective participation for ${rows.length} participant(s); participation rate ${rate(rows.length - silentCount, rows.length)}.` };
}

/** Idea 53322 — Translation layer for lessons. */
export function translateLessonContent(lessons = [], options = {}) {
  const targetLangs = (options.targetLanguages || options.targets || ['en']).map(s => String(s).toLowerCase());
  const dictionary = options.dictionary || { auth: { es: 'autenticación', fr: 'authentification' }, endpoint: { es: 'punto de acceso', fr: 'point de terminaison' }, header: { es: 'encabezado', fr: 'en-tête' }, check: { es: 'verificación', fr: 'vérification' } };
  const rows = (lessons || []).map(lesson => {
    const text = String(lesson.text || lesson.title || '');
    const words = tokensOf(text);
    const translations = {};
    for (const lang of targetLangs) {
      if (lang === 'en') { translations[lang] = { text, coverage: 1, translatedWords: words.length }; continue; }
      let translatedWords = 0;
      const translatedTokens = words.map(w => {
        const entry = dictionary[w];
        const translated = entry ? entry[lang] : null;
        if (translated) translatedWords += 1;
        return translated || w;
      });
      translations[lang] = { text: translatedTokens.join(' '), coverage: words.length ? round2(translatedWords / words.length) : 1, translatedWords };
    }
    const avgCoverage = mean(Object.values(translations).map(t => t.coverage));
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), languages: targetLangs, translations, coverage: avgCoverage, fullyTranslated: avgCoverage >= 0.5 };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, targetLanguages: targetLangs, translatedCount: rows.filter(r => r.fullyTranslated).length, top: rows[0] || null, summary: `Infinity AI translated ${rows.length} lesson(s) across ${targetLangs.length} language(s).` };
}

/** Idea 53323 — Hunt debrief podcasts. */
export function buildHuntDebriefPodcast(hunts = [], options = {}) {
  const wordsPerMinute = num(options.wordsPerMinute, 150);
  const targetMinutes = num(options.targetMinutes, 5);
  const rows = (hunts || []).map(hunt => {
    const transcript = String(hunt.debrief || hunt.narrative || hunt.retrospective || hunt.text || '');
    const words = wordCount(transcript) || num(hunt.wordCount, 0);
    const minutes = round2(words / wordsPerMinute);
    const findings = num(hunt.findings ?? hunt.validatedFindings, 0);
    return { key: keyOf(hunt, 'hunt'), hunt: keyOf(hunt, 'hunt'), words, minutes, findings, fitsEpisode: minutes >= 1 && minutes <= targetMinutes + 3, title: `Infinity AI debrief: ${keyOf(hunt, 'hunt')} — ${findings} finding(s)` };
  }).sort((a, b) => b.findings - a.findings || b.minutes - a.minutes || String(a.key).localeCompare(String(b.key)));
  const episodes = rows.filter(r => r.fitsEpisode);
  const totalMinutes = round2(rows.reduce((s, r) => s + r.minutes, 0));
  return { rows, episodes, count: rows.length, episodeCount: episodes.length, totalMinutes, top: rows[0] || null, summary: `Infinity AI produced ${episodes.length} debrief podcast episode(s) totaling ${totalMinutes} minute(s).` };
}

/** Idea 53324 — Lesson dependency graphs. */
export function buildLessonDependencyGraph(lessons = [], options = {}) {
  const byKey = new Map((lessons || []).map(l => [keyOf(l), l]));
  const edges = [];
  for (const lesson of lessons || []) {
    const deps = Array.isArray(lesson.dependsOn) ? lesson.dependsOn.map(String) : (lesson.requires ? [String(lesson.requires)] : []);
    for (const dep of deps) if (byKey.has(dep)) edges.push({ from: keyOf(lesson), to: dep, type: 'depends-on' });
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const roots = (lessons || []).map(l => keyOf(l)).filter(k => !edges.some(e => e.from === k));
  const leaves = (lessons || []).map(l => keyOf(l)).filter(k => !edges.some(e => e.to === k));
  const cyclic = edges.some(e => edges.some(r => r.from === e.to && r.to === e.from));
  return { rows: edges, edges, nodes: (lessons || []).map(l => keyOf(l)), count: (lessons || []).length, nodeCount: (lessons || []).length, edgeCount: edges.length, roots: roots.sort(), leaves: leaves.sort(), cyclic, summary: `Infinity AI mapped ${edges.length} dependency edge(s) across ${(lessons || []).length} lesson(s).` };
}

/** Idea 53325 — Retrospective bias checks. */
export function auditRetrospectiveBias(retrospectives = [], options = {}) {
  const rows = (retrospectives || []).map(retro => {
    const text = String(retro.text || retro.draft || '').toLowerCase();
    const recencySignals = (text.match(/\b(recent|latest|just now|yesterday|last week)\b/g) || []).length;
    const outcomeSignals = (text.match(/\b(found|success|win|shipped)\b/g) || []).length;
    const failureSignals = (text.match(/\b(miss|failed|dry|stuck|blocked)\b/g) || []).length;
    const biasScore = round2(recencySignals * 0.4 + Math.abs(outcomeSignals - failureSignals) * 0.2);
    return { key: keyOf(retro, 'retro'), recencySignals, outcomeSignals, failureSignals, biasScore, biased: biasScore >= 1, band: biasScore >= 2 ? 'high-bias' : biasScore >= 1 ? 'moderate-bias' : 'low-bias' };
  }).sort((a, b) => b.biasScore - a.biasScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, biasedCount: rows.filter(r => r.biased).length, highBiasCount: rows.filter(r => r.band === 'high-bias').length, top: rows[0] || null, avgBiasScore: mean(rows.map(r => r.biasScore)), summary: `Infinity AI checked ${rows.length} retrospective(s) for bias; ${rows.filter(r => r.biased).length} show measurable bias.` };
}

/** Idea 53326 — Lesson retirement ceremonies. */
export function planLessonRetirementCeremony(lessons = [], options = {}) {
  const staleAgeDays = num(options.staleAgeDays, 365);
  const rows = (lessons || []).map(lesson => {
    const ageDays = num(lesson.ageDays, 0);
    const superseded = lesson.superseded === true || Boolean(lesson.supersededBy);
    const stale = ageDays >= staleAgeDays && !lesson.revalidated;
    const retire = superseded || stale;
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), ageDays, superseded, stale, retire, supersededBy: lesson.supersededBy ? String(lesson.supersededBy) : null, reason: superseded ? 'superseded' : stale ? 'stale' : 'active', ceremonyReady: retire };
  }).sort((a, b) => Number(b.retire) - Number(a.retire) || b.ageDays - a.ageDays || String(a.key).localeCompare(String(b.key)));
  const retiring = rows.filter(r => r.retire);
  return { rows, retiring, count: rows.length, retirementCount: retiring.length, activeCount: rows.length - retiring.length, top: rows[0] || null, summary: `Infinity AI planned retirement ceremonies for ${retiring.length} of ${rows.length} lesson(s).` };
}

/** Idea 53327 — Team lesson leaderboards. */
export function buildTeamLessonLeaderboard(researchers = [], options = {}) {
  const period = String(options.period || 'monthly');
  const rows = (researchers || []).map(r => {
    const lessons = num(r.lessons ?? r.lessonsAdded, 0);
    const applied = num(r.applied ?? r.lessonsApplied, 0);
    const upvotes = num(r.upvotes ?? r.receivedUpvotes, 0);
    const score = round2(lessons * 5 + applied * 3 + upvotes * 1.5);
    return { key: String(r.name || r.researcher || r.key || 'researcher'), researcher: String(r.name || r.researcher || r.key || 'researcher'), lessons, lessonsAdded: lessons, applied, lessonsApplied: applied, upvotes, score, rankScore: score };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, leaderboard: rows, count: rows.length, period, top: rows[0] || null, totalLessons: rows.reduce((s, r) => s + r.lessons, 0), summary: `Infinity AI ranked ${rows.length} researcher(s) on the ${period} lesson leaderboard.` };
}

/** Idea 53328 — Lesson embedding search. */
export function searchLessonsByEmbedding(lessons = [], query = {}, options = {}) {
  const queryText = String(query.text || query.keywords || query.situation || '');
  const queryTokens = new Set(tokensOf(queryText));
  const limit = num(options.limit, 10);
  const rows = (lessons || []).map(lesson => {
    const lessonTokens = new Set(tokensOf(`${lesson.title || ''} ${lesson.text || ''}`));
    let inter = 0;
    for (const t of queryTokens) if (lessonTokens.has(t)) inter += 1;
    const union = queryTokens.size + lessonTokens.size - inter;
    const similarity = union ? round2(inter / union) : 0;
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), similarity, score: similarity, matchedTokens: inter };
  }).filter(r => r.similarity > 0).sort((a, b) => b.similarity - a.similarity || String(a.key).localeCompare(String(b.key))).slice(0, limit);
  return { rows, results: rows, count: (lessons || []).length, resultCount: rows.length, query: queryText, top: rows[0] || null, summary: `Infinity AI found ${rows.length} lesson(s) similar to the query via embedding search.` };
}

/** Idea 53329 — Retrospective integration with tickets. */
export function buildTicketIntegrationPlan(retrospectives = [], tickets = [], options = {}) {
  const ticketById = new Map((tickets || []).map(t => [String(t.id || t.key || ''), t]));
  const rows = (retrospectives || []).map(retro => {
    const linkedIds = Array.isArray(retro.ticketIds) ? retro.ticketIds.map(String) : (retro.ticketId ? [String(retro.ticketId)] : []);
    const linked = linkedIds.map(id => ticketById.get(id)).filter(Boolean);
    const openLinked = linked.filter(t => t.status !== 'done' && t.status !== 'closed');
    return { key: keyOf(retro, 'retro'), ticketIds: linkedIds, linkedCount: linked.length, openCount: openLinked.length, synced: linkedIds.length > 0, retroOnly: linkedIds.length === 0 };
  }).sort((a, b) => b.linkedCount - a.linkedCount || String(a.key).localeCompare(String(b.key)));
  const syncedCount = rows.filter(r => r.synced).length;
  return { rows, count: rows.length, ticketCount: (tickets || []).length, syncedCount, retroOnlyCount: rows.length - syncedCount, top: rows[0] || null, summary: `Infinity AI integrated ${syncedCount} of ${rows.length} retrospective(s) with ${(tickets || []).length} ticket(s).` };
}

/** Idea 53330 — Lesson-driven checklist updates. */
export function applyLessonDrivenChecklistUpdates(checklists = [], lessons = [], options = {}) {
  const rows = (checklists || []).map(checklist => {
    const items = Array.isArray(checklist.items) ? checklist.items : [];
    const relatedLessons = (lessons || []).filter(l => {
      const area = String(l.targetClass || l.area || '').toLowerCase();
      const name = String(checklist.name || checklist.title || '').toLowerCase();
      return area && name.includes(area);
    });
    const additions = relatedLessons.filter(l => num(l.impact ?? l.impactScore, 0) >= num(options.minImpact, 5)).map(l => ({ key: keyOf(l), addition: String(l.title || keyOf(l)), priority: num(l.impact ?? l.impactScore, 0) >= 8 ? 'high' : 'normal' }));
    return { key: keyOf(checklist, 'checklist'), name: String(checklist.name || checklist.title || keyOf(checklist, 'checklist')), itemCount: items.length, additions, additionCount: additions.length, updateSuggested: additions.length > 0 };
  }).sort((a, b) => b.additionCount - a.additionCount || String(a.key).localeCompare(String(b.key)));
  const totalAdditions = rows.reduce((s, r) => s + r.additionCount, 0);
  return { rows, count: rows.length, totalAdditions, updateCount: rows.filter(r => r.updateSuggested).length, top: rows[0] || null, summary: `Infinity AI suggested ${totalAdditions} checklist addition(s) from ${(lessons || []).length} lesson(s).` };
}

/** Idea 53331 — Post-incident learning reviews. */
export function reviewPostIncidentLearning(incidents = [], options = {}) {
  const rows = (incidents || []).map(incident => {
    const lessons = Array.isArray(incident.lessons) ? incident.lessons : [];
    const severity = num(incident.severity, 3);
    const daysToReview = num(incident.daysToReview ?? incident.reviewLagDays, 0);
    const systemic = incident.systemic === true || lessons.length >= 2;
    return { key: keyOf(incident, 'incident'), severity, lessonCount: lessons.length, lessons, daysToReview, timely: daysToReview > 0 && daysToReview <= 7, systemic, reviewed: lessons.length > 0 };
  }).sort((a, b) => b.severity - a.severity || a.daysToReview - b.daysToReview || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, reviewedCount: rows.filter(r => r.reviewed).length, systemicCount: rows.filter(r => r.systemic).length, timelyCount: rows.filter(r => r.timely).length, top: rows[0] || null, summary: `Infinity AI reviewed post-incident learning for ${rows.length} incident(s); ${rows.filter(r => r.reviewed).length} produced lessons.` };
}

/** Idea 53332 — Lesson sharing with community. */
export function shareLessonsWithCommunity(lessons = [], options = {}) {
  const channel = String(options.channel || 'community-board');
  const rows = (lessons || []).map(lesson => {
    const text = String(lesson.text || lesson.title || '');
    const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text);
    const hasSecret = /token|secret|password|api[-_ ]?key/i.test(text);
    const impact = num(lesson.impact ?? lesson.impactScore, 0);
    const shareable = !hasEmail && !hasSecret && impact >= num(options.minImpact, 3);
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), impact, sanitized: !hasEmail && !hasSecret, shareable, channel, reason: hasSecret ? 'contains-secret-pattern' : hasEmail ? 'contains-email' : shareable ? 'ready' : 'low-impact' };
  }).sort((a, b) => b.impact - a.impact || String(a.key).localeCompare(String(b.key)));
  const shared = rows.filter(r => r.shareable);
  return { rows, shared, count: rows.length, sharedCount: shared.length, withheldCount: rows.length - shared.length, channel, top: rows[0] || null, summary: `Infinity AI prepared ${shared.length} lesson(s) for sharing with the community via ${channel}.` };
}

/** Idea 53333 — Retrospective calibration sessions. */
export function calibrateRetrospectiveSession(scores = [], options = {}) {
  const values = (scores || []).map(s => num(s.score ?? s.rating, 0)).filter(v => Number.isFinite(v));
  const rows = (scores || []).map(s => {
    const score = num(s.score ?? s.rating, 0);
    const avg = values.length ? mean(values) : 0;
    return { key: keyOf(s, 'retro'), researcher: s.researcher ? String(s.researcher) : null, score, deviation: round2(score - avg), outlier: Math.abs(score - avg) >= 2 };
  }).sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation) || String(a.key).localeCompare(String(b.key)));
  const spreads = values.length ? Math.max(...values) - Math.min(...values) : 0;
  return { rows, count: rows.length, mean: values.length ? mean(values) : 0, median: median(values), spread: round2(spreads), outlierCount: rows.filter(r => r.outlier).length, calibrated: values.length > 0, top: rows[0] || null, summary: `Infinity AI calibrated ${rows.length} retrospective score(s); spread is ${round2(spreads)}.` };
}

/** Idea 53334 — Lesson impact dashboards. */
export function buildLessonImpactDashboard(lessons = [], options = {}) {
  const rows = (lessons || []).map(lesson => {
    const applied = num(lesson.appliedCount ?? lesson.applications, 0);
    const changed = num(lesson.outcomeChangedCount ?? lesson.changedOutcomes, 0);
    const coverageBoost = num(lesson.coverageBoost ?? lesson.deltaCoverage, 0);
    const impactRate = applied ? rate(changed, applied) : 0;
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), applied, changed, impactRate, coverageBoost, score: round2(impactRate * 10 + coverageBoost) };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const totalApplied = rows.reduce((s, r) => s + r.applied, 0);
  const totalChanged = rows.reduce((s, r) => s + r.changed, 0);
  return { rows, count: rows.length, totalApplied, totalChanged, overallImpactRate: totalApplied ? rate(totalChanged, totalApplied) : 0, top: rows[0] || null, summary: `Infinity AI built a lesson impact dashboard for ${rows.length} lesson(s); overall impact rate ${totalApplied ? rate(totalChanged, totalApplied) : 0}.` };
}

/** Idea 53335 — Micro-lesson capture. */
export function captureMicroLesson(entries = [], options = {}) {
  const maxWords = num(options.maxWords, 50);
  const rows = (entries || []).map(entry => {
    const text = String(entry.text || entry.lesson || '');
    const words = wordCount(text);
    return { key: keyOf(entry, 'entry'), text: text.slice(0, 280), words, withinLimit: words > 0 && words <= maxWords, format: words <= maxWords ? 'micro' : 'full', researcher: entry.researcher ? String(entry.researcher) : null };
  }).sort((a, b) => a.words - b.words || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, maxWords, microCount: rows.filter(r => r.withinLimit).length, oversizedCount: rows.filter(r => !r.withinLimit).length, avgWords: mean(rows.map(r => r.words)), top: rows[0] || null, summary: `Infinity AI captured ${rows.filter(r => r.withinLimit).length} micro-lesson(s) within ${maxWords} word(s).` };
}

/** Idea 53336 — Lesson context snapshots. */
export function snapshotLessonContext(lessons = [], hunts = [], options = {}) {
  const huntById = new Map((hunts || []).map(h => [keyOf(h, 'hunt'), h]));
  const rows = (lessons || []).map(lesson => {
    const hunt = huntById.get(String(lesson.huntId || lesson.originHunt || '')) || null;
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), originHunt: hunt ? keyOf(hunt, 'hunt') : (lesson.huntId ? String(lesson.huntId) : null), coverage: hunt ? num(hunt.coverage, 0) : num(lesson.coverage, 0), stack: hunt ? String(hunt.stack || '') : String(lesson.stack || ''), targetClass: hunt ? String(hunt.targetClass || '') : String(lesson.targetClass || ''), hasSnapshot: Boolean(hunt) };
  }).sort((a, b) => Number(b.hasSnapshot) - Number(a.hasSnapshot) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, snapshotCount: rows.filter(r => r.hasSnapshot).length, orphanCount: rows.filter(r => !r.hasSnapshot).length, top: rows[0] || null, summary: `Infinity AI captured context snapshots for ${rows.filter(r => r.hasSnapshot).length} of ${rows.length} lesson(s).` };
}

/** Idea 53337 — Retrospective follow-up hunts. */
export function planRetrospectiveFollowUpHunts(retrospectives = [], options = {}) {
  const rows = (retrospectives || []).map(retro => {
    const darkAreas = Array.isArray(retro.darkAreas) ? retro.darkAreas.map(String) : [];
    const findings = num(retro.findings, 0);
    const coverage = num(retro.coverage, 0);
    const needsFollowUp = darkAreas.length > 0 || coverage < 0.6;
    return { key: keyOf(retro, 'retro'), darkAreas, darkCount: darkAreas.length, findings, coverage, needsFollowUp, priority: needsFollowUp ? (darkAreas.length >= 2 ? 'high' : 'normal') : 'none', followUpHunts: darkAreas.map(area => ({ area, reason: 'dark-area' })) };
  }).sort((a, b) => b.darkCount - a.darkCount || a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const followUps = rows.filter(r => r.needsFollowUp);
  return { rows, followUps, count: rows.length, followUpCount: followUps.length, plannedHunts: rows.reduce((s, r) => s + r.followUpHunts.length, 0), top: rows[0] || null, summary: `Infinity AI planned follow-up hunts for ${followUps.length} retrospective(s); ${rows.reduce((s, r) => s + r.followUpHunts.length, 0)} dark-area hunt(s) queued.` };
}

/** Idea 53338 — Lesson inheritance rules. */
export function applyLessonInheritanceRules(lessons = [], rules = [], options = {}) {
  const activeRules = (rules || []).filter(r => r.active !== false);
  const rows = (lessons || []).map(lesson => {
    const matched = activeRules.filter(rule => {
      const scope = String(rule.scope || rule.targetClass || '').toLowerCase();
      const lessonScope = String(lesson.targetClass || lesson.stack || '').toLowerCase();
      return !scope || lessonScope.includes(scope);
    });
    const inherited = matched.length > 0;
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), targetClass: lesson.targetClass || null, inherited, ruleCount: matched.length, rules: matched.map(r => String(r.name || r.key || '')), level: inherited ? 'inherited' : 'standalone' };
  }).sort((a, b) => b.ruleCount - a.ruleCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, inheritedCount: rows.filter(r => r.inherited).length, ruleCount: activeRules.length, top: rows[0] || null, summary: `Infinity AI applied ${activeRules.length} inheritance rule(s); ${rows.filter(r => r.inherited).length} lesson(s) inherited.` };
}

/** Idea 53339 — Annual lessons anthology. */
export function compileAnnualLessonsAnthology(lessons = [], options = {}) {
  const year = num(options.year, 2026);
  const limit = num(options.limit, 20);
  const rows = (lessons || []).filter(l => num(l.year, year) === year)
    .map(lesson => {
      const impact = num(lesson.impact ?? lesson.impactScore, 0);
      const applications = num(lesson.appliedCount ?? lesson.applications, 0);
      return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), year: num(lesson.year, year), impact, applications, anthologyScore: round2(impact * 2 + applications) };
    }).sort((a, b) => b.anthologyScore - a.anthologyScore || String(a.key).localeCompare(String(b.key))).slice(0, limit);
  return { rows, anthology: rows, count: (lessons || []).length, year, anthologyCount: rows.length, totalImpact: rows.reduce((s, r) => s + r.impact, 0), top: rows[0] || null, summary: `Infinity AI compiled the ${year} lessons anthology with ${rows.length} entr(ies).` };
}

/** Idea 53340 — Lesson-driven hunt kickoff rituals. */
export function planLessonDrivenHuntKickoff(hunt = {}, lessons = [], options = {}) {
  const targetClass = String(hunt.targetClass || '').toLowerCase();
  const stack = String(hunt.stack || '').toLowerCase();
  const scored = (lessons || []).map(lesson => {
    let relevance = 0;
    if (targetClass && String(lesson.targetClass || '').toLowerCase() === targetClass) relevance += 3;
    if (stack && String(lesson.stack || '').toLowerCase() === stack) relevance += 3;
    relevance += num(lesson.impact ?? lesson.impactScore, 0) * 0.2;
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), relevance: round2(relevance) };
  }).sort((a, b) => b.relevance - a.relevance || String(a.key).localeCompare(String(b.key)));
  const kickoffLessons = scored.slice(0, num(options.limit, 3));
  const ritualSteps = ['read-briefing', 'review-lessons', 'set-checklist', 'begin-hunt'];
  return { rows: kickoffLessons, kickoffLessons, count: (lessons || []).length, ritualSteps, stepCount: ritualSteps.length, hunt: hunt.id ? String(hunt.id) : null, top: kickoffLessons[0] || null, summary: `Infinity AI planned a lesson-driven kickoff ritual with ${kickoffLessons.length} lesson(s) across ${ritualSteps.length} step(s).` };
}
