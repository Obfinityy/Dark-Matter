/**
 * wave83BCores.js — Infinity AI · Wave 83B
 * Lesson application and retrospective operations, ideas 53301–53320:
 * application tracking, outcome templates, failure celebrations,
 * ownership, time-boxing, confidence labels, external imports, gap
 * analysis, sentiment tracking, training modules, story archives,
 * versioning, facilitator rotation, agent lesson API, pre-hunt
 * briefings, effectiveness tests, action-item tracking, report
 * attribution, quiet surfacing, and peer review. Every helper takes
 * explicit inputs, never mutates them, and returns structured
 * view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE83_B_IDEAS = [
  { id: 53301, title: 'Lesson Application Tracking', skip: false },
  { id: 53302, title: 'Retrospective Templates per Outcome', skip: false },
  { id: 53303, title: 'Failure Celebration Rituals', skip: false },
  { id: 53304, title: 'Lesson Ownership Assignment', skip: false },
  { id: 53305, title: 'Retrospective Time-Boxing', skip: false },
  { id: 53306, title: 'Lesson Confidence Labels', skip: false },
  { id: 53307, title: 'External Lesson Imports', skip: false },
  { id: 53308, title: 'Lesson Gap Analysis', skip: false },
  { id: 53309, title: 'Retrospective Sentiment Tracking', skip: false },
  { id: 53310, title: 'Lesson-Driven Training Modules', skip: false },
  { id: 53311, title: 'Hunt Story Archives', skip: false },
  { id: 53312, title: 'Lesson Versioning', skip: false },
  { id: 53313, title: 'Retrospective Facilitator Rotation', skip: false },
  { id: 53314, title: 'Lesson API for Agents', skip: false },
  { id: 53315, title: 'Pre-Hunt Lesson Briefings', skip: false },
  { id: 53316, title: 'Lesson Effectiveness A/B Tests', skip: false },
  { id: 53317, title: 'Retrospective Action Item Tracking', skip: false },
  { id: 53318, title: 'Lesson Attribution in Reports', skip: false },
  { id: 53319, title: 'Quiet Lessons Surfacing', skip: false },
  { id: 53320, title: 'Lesson Quality Peer Review', skip: false },
];

function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp01(value) { return Math.min(1, Math.max(0, num(value, 0))); }
function rate(part, whole) { return whole ? round2(part / whole) : 0; }
function mean(values) { return values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : 0; }
function keyOf(item, fallback = 'lesson') {
  return String(item.key || item.id || item.lessonId || item.title || item.name || item.targetClass || fallback);
}
function tokensOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}
function groupCount(records, keyFn) {
  const groups = new Map();
  for (const record of records || []) {
    const key = keyFn(record);
    if (!key) continue;
    const group = groups.get(key) || { key, count: 0, values: [] };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Track whether a lesson was applied in later hunts (idea 53301). */
export function trackLessonApplications(applications = [], options = {}) {
  const rows = (applications || []).map(app => {
    const applied = app.applied === true || Boolean(app.appliedInHunt || app.huntId);
    const outcome = String(app.outcome || (applied ? 'applied' : 'not-applied'));
    return { key: keyOf(app), lesson: keyOf(app), applied, outcome, successful: outcome === 'finding' || outcome === 'improved' || app.successful === true, hunt: app.appliedInHunt || app.huntId || null };
  }).sort((a, b) => Number(b.applied) - Number(a.applied) || String(a.key).localeCompare(String(b.key)));
  const appliedRows = rows.filter(r => r.applied);
  return { rows, count: rows.length, appliedCount: appliedRows.length, applicationRate: rate(appliedRows.length, rows.length), successCount: rows.filter(r => r.successful).length, successRate: appliedRows.length ? rate(rows.filter(r => r.successful).length, appliedRows.length) : 0, top: rows[0] || null, summary: `Infinity AI tracked lesson application in ${appliedRows.length} of ${rows.length} later hunt(s).` };
}

/** Use different retrospective templates per hunt outcome (idea 53302). */
export function assignRetrospectiveTemplates(hunts = [], options = {}) {
  const rows = (hunts || []).map(hunt => {
    const findings = num(hunt.findings ?? hunt.validatedFindings, 0);
    const incident = hunt.incidentAdjacent === true || hunt.incident === true;
    const outcome = incident ? 'incident-adjacent' : findings >= 5 ? 'high-yield' : findings === 0 ? 'dry' : 'standard';
    const template = outcome === 'high-yield' ? 'deep-dive-template' : outcome === 'dry' ? 'dry-run-template' : outcome === 'incident-adjacent' ? 'incident-template' : 'standard-template';
    return { key: keyOf(hunt, 'hunt'), hunt: keyOf(hunt, 'hunt'), findings, outcome, template };
  }).sort((a, b) => String(a.template).localeCompare(String(b.template)) || String(a.key).localeCompare(String(b.key)));
  const counts = {};
  for (const row of rows) counts[row.template] = (counts[row.template] || 0) + 1;
  return { rows, count: rows.length, counts, summary: `Infinity AI assigned retrospective templates to ${rows.length} hunt(s) by outcome.` };
}

/** Highlight the most instructive failed hunts monthly (idea 53303). */
export function selectFailureCelebrations(hunts = [], options = {}) {
  const limit = num(options.limit, 3);
  const rows = (hunts || []).map(hunt => {
    const findings = num(hunt.findings ?? hunt.validatedFindings, 0);
    const instructiveness = num(hunt.instructiveness ?? hunt.lessonCount, 0);
    const failed = findings === 0 || hunt.dry === true || hunt.failed === true;
    return { key: keyOf(hunt, 'hunt'), hunt: keyOf(hunt, 'hunt'), findings, instructiveness, failed, score: round2(instructiveness * 10 + (failed ? 5 : 0)) };
  }).filter(r => r.failed).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const celebrated = rows.slice(0, limit);
  return { rows: celebrated, celebrated, count: (hunts || []).length, celebratedCount: celebrated.length, top: celebrated[0] || null, summary: `Infinity AI selected ${celebrated.length} instructive failed hunt(s) for the monthly celebration.` };
}

/** Assign each promoted lesson an owner keeping it current (idea 53304). */
export function assignLessonOwnership(lessons = [], researchers = [], options = {}) {
  const pool = (researchers || []).map(r => String(r.name || r.researcher || r.key || '')).filter(Boolean);
  const load = new Map(pool.map(name => [name, num((researchers || []).find(r => String(r.name || r.researcher || r.key || '') === name)?.ownedCount, 0)]));
  const rows = (lessons || []).map(lesson => {
    let owner = lesson.owner ? String(lesson.owner) : null;
    if (!owner && pool.length) {
      owner = [...load.entries()].sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
      load.set(owner, (load.get(owner) || 0) + 1);
    }
    return { key: keyOf(lesson), owner, assigned: Boolean(owner), promoted: lesson.promoted === true || num(lesson.confirmations, 0) >= 3 };
  }).sort((a, b) => String(a.owner || '').localeCompare(String(b.owner || '')) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, assignedCount: rows.filter(r => r.assigned).length, unassignedCount: rows.filter(r => !r.assigned).length, owners: [...load.entries()].map(([owner, count]) => ({ owner, count })).sort((a, b) => String(a.owner).localeCompare(String(b.owner))), summary: `Infinity AI assigned ownership for ${rows.filter(r => r.assigned).length} of ${rows.length} lesson(s).` };
}

/** Cap retrospectives at 15 minutes of researcher time (idea 53305). */
export function auditRetrospectiveTimeBoxing(retrospectives = [], options = {}) {
  const capMinutes = num(options.capMinutes, 15);
  const rows = (retrospectives || []).map(retro => {
    const researcherMinutes = num(retro.researcherMinutes ?? retro.minutes, 0);
    const automatedMinutes = num(retro.automatedMinutes ?? retro.automationMinutes, 0);
    return { key: keyOf(retro, 'retro'), researcherMinutes, automatedMinutes, totalMinutes: round2(researcherMinutes + automatedMinutes), withinBox: researcherMinutes <= capMinutes, overBy: round2(Math.max(0, researcherMinutes - capMinutes)) };
  }).sort((a, b) => b.researcherMinutes - a.researcherMinutes || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, capMinutes, withinCount: rows.filter(r => r.withinBox).length, overCount: rows.filter(r => !r.withinBox).length, avgResearcherMinutes: mean(rows.map(r => r.researcherMinutes)), top: rows[0] || null, summary: `Infinity AI kept ${rows.filter(r => r.withinBox).length} of ${rows.length} retrospective(s) within the ${capMinutes}-minute researcher time-box.` };
}

/** Label lessons anecdotal, corroborated, or proven (idea 53306). */
export function labelLessonConfidence(lessons = [], options = {}) {
  const rows = (lessons || []).map(lesson => {
    const supporting = num(lesson.supportingHunts ?? lesson.confirmations ?? lesson.evidenceCount, 0);
    const label = supporting >= 5 ? 'proven' : supporting >= 2 ? 'corroborated' : 'anecdotal';
    return { key: keyOf(lesson), supportingHunts: supporting, label, confidence: label };
  }).sort((a, b) => b.supportingHunts - a.supportingHunts || String(a.key).localeCompare(String(b.key)));
  const counts = { anecdotal: 0, corroborated: 0, proven: 0 };
  for (const row of rows) counts[row.label] += 1;
  return { rows, count: rows.length, counts, provenCount: counts.proven, top: rows[0] || null, summary: `Infinity AI labeled lesson confidence for ${rows.length} lesson(s); ${counts.proven} are proven.` };
}

/** Import sanitized external lessons mapped to internal taxonomy (idea 53307). */
export function importExternalLessons(external = [], options = {}) {
  const taxonomy = (options.taxonomy || ['technique', 'tooling', 'mindset', 'process']).map(s => String(s).toLowerCase());
  const tagMap = options.tagMap || { auth: 'technique', authentication: 'technique', scanner: 'tooling', automation: 'tooling', workflow: 'process', checklist: 'process', mindset: 'mindset' };
  const rows = (external || []).map(item => {
    const rawTags = (Array.isArray(item.tags) ? item.tags : []).map(t => String(t).toLowerCase());
    const mapped = [...new Set(rawTags.map(t => tagMap[t] || (taxonomy.includes(t) ? t : null)).filter(Boolean))].sort();
    const text = String(item.text || item.title || '');
    const sanitized = !/@|https?:\/\//.test(text) || item.sanitized === true;
    return { key: keyOf(item, 'external'), source: item.source || 'public-writeup', tags: mapped, mappedCount: mapped.length, sanitized, imported: mapped.length > 0 && sanitized };
  }).sort((a, b) => b.mappedCount - a.mappedCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, importedCount: rows.filter(r => r.imported).length, rejectedCount: rows.filter(r => !r.imported).length, imported: rows.filter(r => r.imported), summary: `Infinity AI imported ${rows.filter(r => r.imported).length} of ${rows.length} external lesson(s) into the internal taxonomy.` };
}

/** Identify target classes with suspiciously few lessons (idea 53308). */
export function analyzeLessonGaps(lessons = [], options = {}) {
  const expected = num(options.expectedPerClass, 3);
  const byClass = groupCount(lessons, l => String(l.targetClass || l.type || ''));
  const byTechnique = groupCount(lessons, l => String(l.technique || (Array.isArray(l.tags) ? l.tags[0] : '') || ''));
  const rows = byClass.map(g => ({ ...g, dimension: 'targetClass', gap: g.count < expected, deficit: Math.max(0, expected - g.count) }))
    .sort((a, b) => a.count - b.count || String(a.key).localeCompare(String(b.key)));
  const techniqueRows = byTechnique.map(g => ({ ...g, dimension: 'technique', gap: g.count < expected, deficit: Math.max(0, expected - g.count) }))
    .sort((a, b) => a.count - b.count || String(a.key).localeCompare(String(b.key)));
  const gaps = rows.filter(r => r.gap);
  return { rows, techniqueRows, count: (lessons || []).length, expectedPerClass: expected, gaps, gapCount: gaps.length, weakest: rows[0] || null, summary: `Infinity AI found ${gaps.length} target class(es) with suspiciously few lessons.` };
}

/** Track retrospective sentiment as a burnout proxy (idea 53309). */
export function trackRetrospectiveSentiment(retrospectives = [], options = {}) {
  const positive = ['great', 'learned', 'progress', 'clear', 'useful'];
  const negative = ['frustrated', 'blocked', 'burned', 'stuck', 'exhausted', 'confusing'];
  const rows = (retrospectives || []).map(retro => {
    const supplied = retro.sentimentScore ?? retro.sentiment;
    let score;
    if (supplied !== undefined && supplied !== null && Number.isFinite(Number(supplied))) score = round2(Math.max(-1, Math.min(1, Number(supplied))));
    else {
      const text = String(retro.text || '').toLowerCase();
      const pos = positive.filter(w => text.includes(w)).length;
      const neg = negative.filter(w => text.includes(w)).length;
      score = pos + neg ? round2((pos - neg) / (pos + neg)) : 0;
    }
    return { key: keyOf(retro, 'retro'), researcher: retro.researcher ? String(retro.researcher) : null, score, band: score >= 0.3 ? 'positive' : score <= -0.3 ? 'negative' : 'neutral', burnoutRisk: score <= -0.5 };
  }).sort((a, b) => a.score - b.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, avgSentiment: mean(rows.map(r => r.score)), negativeCount: rows.filter(r => r.band === 'negative').length, burnoutRiskCount: rows.filter(r => r.burnoutRisk).length, weakest: rows[0] || null, summary: `Infinity AI tracked retrospective sentiment across ${rows.length} entr(ies); average sentiment is ${mean(rows.map(r => r.score))}.` };
}

/** Convert top lessons into 5-minute training modules (idea 53310). */
export function buildLessonTrainingModules(lessons = [], options = {}) {
  const wordsPerMinute = num(options.wordsPerMinute, 150);
  const targetMinutes = num(options.targetMinutes, 5);
  const rows = (lessons || []).map(lesson => {
    const text = String(lesson.text || lesson.title || '');
    const words = text.split(/\s+/).filter(Boolean).length || num(lesson.wordCount, 0);
    const minutes = round2(words / wordsPerMinute);
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), words, minutes, readingMinutes: minutes, fitsModule: minutes <= targetMinutes, module: `Infinity AI 5-minute module: ${String(lesson.title || keyOf(lesson))}` };
  }).sort((a, b) => a.minutes - b.minutes || String(a.key).localeCompare(String(b.key)));
  return { rows, modules: rows, count: rows.length, targetMinutes, moduleCount: rows.filter(r => r.fitsModule).length, top: rows[0] || null, summary: `Infinity AI converted ${rows.filter(r => r.fitsModule).length} lesson(s) into ${targetMinutes}-minute training modules.` };
}

/** Preserve narrative hunt stories for cultural learning (idea 53311). */
export function archiveHuntStories(hunts = [], options = {}) {
  const rows = (hunts || []).map(hunt => {
    const narrative = String(hunt.narrative || hunt.story || '');
    const words = narrative.split(/\s+/).filter(Boolean).length;
    return { key: keyOf(hunt, 'hunt'), hunt: keyOf(hunt, 'hunt'), words, wordCount: words, archived: words >= 20, complete: words >= 50 && Boolean(hunt.target || hunt.key), excerpt: narrative.slice(0, 80) };
  }).sort((a, b) => b.words - a.words || String(a.key).localeCompare(String(b.key)));
  return { rows, archive: rows, count: rows.length, archivedCount: rows.filter(r => r.archived).length, top: rows[0] || null, summary: `Infinity AI archived ${rows.filter(r => r.archived).length} narrative hunt stor(ies) for cultural learning.` };
}

/** Version lessons as understanding evolves (idea 53312). */
export function trackLessonVersions(lessons = [], options = {}) {
  const rows = (lessons || []).map(lesson => {
    const history = Array.isArray(lesson.history) ? lesson.history : (Array.isArray(lesson.versions) ? lesson.versions : []);
    const version = num(lesson.version, history.length || 1);
    const changes = history.map((entry, index) => ({ version: index + 1, reason: String(entry.reason || entry.change || 'revised'), at: String(entry.at || '') }));
    return { key: keyOf(lesson), version, currentVersion: version, changeCount: Math.max(0, history.length ? history.length - 1 : version - 1), history: changes, revised: version > 1 };
  }).sort((a, b) => b.version - a.version || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, revisedCount: rows.filter(r => r.revised).length, totalVersions: rows.reduce((s, r) => s + r.version, 0), top: rows[0] || null, summary: `Infinity AI tracked lesson versions for ${rows.length} lesson(s); ${rows.filter(r => r.revised).length} have been revised.` };
}

/** Rotate retrospective facilitators to diversify perspectives (idea 53313). */
export function rotateRetrospectiveFacilitators(history = [], roster = [], options = {}) {
  const counts = new Map();
  for (const entry of history || []) {
    const name = String(entry.facilitator || entry.name || '');
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  const names = (roster || []).map(r => String(r.name || r.researcher || r.key || '')).filter(Boolean);
  const pool = names.length ? names : [...counts.keys()];
  const rows = pool.map(name => ({ key: name, facilitator: name, sessions: counts.get(name) || 0, lastFacilitated: [...(history || [])].reverse().find(e => String(e.facilitator || e.name || '') === name)?.at || null }))
    .sort((a, b) => a.sessions - b.sessions || String(a.key).localeCompare(String(b.key)));
  const next = rows[0] || null;
  const spread = rows.length ? round2(rows[rows.length - 1].sessions - rows[0].sessions) : 0;
  return { rows, count: pool.length, next, nextFacilitator: next ? next.key : null, spread, fair: spread <= 1, summary: `Infinity AI rotated the retrospective facilitator; next up is ${next ? next.key : 'none'}.` };
}

/** Expose the lesson store to the hunting agent (idea 53314). */
export function buildLessonAPIForAgents(lessons = [], query = {}, options = {}) {
  const endpoint = options.endpoint || '/api/v1/lessons';
  const targetClass = String(query.targetClass || '').toLowerCase();
  const stack = String(query.stack || '').toLowerCase();
  const filtered = (lessons || []).filter(lesson => {
    if (targetClass && String(lesson.targetClass || '').toLowerCase() !== targetClass) return false;
    if (stack && String(lesson.stack || '').toLowerCase() !== stack) return false;
    return true;
  }).map(lesson => ({ key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), targetClass: lesson.targetClass || null, stack: lesson.stack || null, confidence: lesson.confidence || null }));
  const payload = { generatedBy: 'Infinity AI', endpoint, totalLessons: filtered.length, lessons: filtered };
  return { payload, rows: filtered, lessons: filtered, count: (lessons || []).length, resultCount: filtered.length, endpoint, query: `GET ${endpoint}`, summary: `Infinity AI exposed ${filtered.length} lesson(s) to agents at ${endpoint}.` };
}

/** Attach the three most relevant lessons to each new hunt (idea 53315). */
export function buildPreHuntLessonBriefings(hunt = {}, lessons = [], options = {}) {
  const limit = num(options.limit, 3);
  const targetClass = String(hunt.targetClass || '').toLowerCase();
  const stack = String(hunt.stack || '').toLowerCase();
  const huntTokens = new Set(tokensOf(`${hunt.target || ''} ${hunt.focus || ''}`));
  const scored = (lessons || []).map(lesson => {
    let score = 0;
    if (targetClass && String(lesson.targetClass || '').toLowerCase() === targetClass) score += 3;
    if (stack && String(lesson.stack || '').toLowerCase() === stack) score += 3;
    for (const token of tokensOf(`${lesson.title || ''} ${lesson.text || ''}`)) if (huntTokens.has(token)) score += 1;
    score += num(lesson.impact ?? lesson.impactScore, 0) * 0.1;
    return { key: keyOf(lesson), title: String(lesson.title || keyOf(lesson)), score: round2(score) };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const briefing = scored.slice(0, limit);
  return { rows: briefing, briefing, count: (lessons || []).length, briefingCount: briefing.length, limit, top: briefing[0] || null, summary: `Infinity AI attached the ${briefing.length} most relevant past lesson(s) to the new hunt briefing.` };
}

/** Test whether lesson-briefed hunts outperform controls (idea 53316). */
export function testLessonEffectivenessAB(briefed = [], control = [], options = {}) {
  const avg = list => mean((list || []).map(h => num(h.findings ?? h.validatedFindings, 0)));
  const briefedAvg = avg(briefed);
  const controlAvg = avg(control);
  const uplift = round2(briefedAvg - controlAvg);
  const briefedWins = (briefed || []).filter(h => num(h.findings, 0) > controlAvg).length;
  return { briefedAvg, controlAvg, uplift, briefedCount: (briefed || []).length, controlCount: (control || []).length, briefedWins, winRate: (briefed || []).length ? rate(briefedWins, (briefed || []).length) : 0, effective: uplift > 0, summary: `Infinity AI compared ${briefed?.length || 0} briefed hunt(s) against ${control?.length || 0} control hunt(s); uplift is ${uplift} finding(s).` };
}

/** Track retrospective action items to completion (idea 53317). */
export function trackRetrospectiveActionItems(items = [], options = {}) {
  const today = String(options.today || '2026-10-09');
  const rows = (items || []).map(item => {
    const done = item.done === true || item.status === 'done' || item.status === 'completed';
    const due = String(item.deadline || item.due || '');
    return { key: keyOf(item, 'item'), owner: item.owner ? String(item.owner) : null, deadline: due || null, done, status: done ? 'done' : 'open', overdue: !done && due !== '' && due < today };
  }).sort((a, b) => Number(a.done) - Number(b.done) || String(a.deadline || '').localeCompare(String(b.deadline || '')) || String(a.key).localeCompare(String(b.key)));
  const open = rows.filter(r => !r.done);
  return { rows, count: rows.length, doneCount: rows.filter(r => r.done).length, openCount: open.length, overdue: rows.filter(r => r.overdue), overdueCount: rows.filter(r => r.overdue).length, completionRate: rate(rows.filter(r => r.done).length, rows.length), summary: `Infinity AI tracked ${rows.filter(r => r.done).length} of ${rows.length} retrospective action item(s) to completion.` };
}

/** Cite which past lessons influenced a hunt in its report (idea 53318). */
export function attributeLessonsInReports(report = {}, options = {}) {
  const influenced = Array.isArray(report.influencedBy) ? report.influencedBy.map(String) : (Array.isArray(report.lessonIds) ? report.lessonIds.map(String) : []);
  const citations = influenced.map((lessonId, index) => ({ key: lessonId, lesson: lessonId, citation: `[${index + 1}] Infinity AI lesson ${lessonId} influenced this hunt approach.`, appendix: true }));
  return { rows: citations, citations, count: influenced.length, attributedCount: citations.length, appendix: citations.map(c => c.citation).join(' '), hunt: report.hunt ? String(report.hunt) : null, summary: `Infinity AI attributed ${citations.length} past lesson(s) in the report appendix.` };
}

/** Resurface old, rarely-viewed lessons matching a hunt profile (idea 53319). */
export function surfaceQuietLessons(lessons = [], profile = {}, options = {}) {
  const maxViews = num(options.maxViews, 5);
  const minAgeDays = num(options.minAgeDays, 90);
  const targetClass = String(profile.targetClass || '').toLowerCase();
  const stack = String(profile.stack || '').toLowerCase();
  const rows = (lessons || []).map(lesson => {
    const views = num(lesson.views ?? lesson.viewCount, 0);
    const ageDays = num(lesson.ageDays, 0);
    const quiet = views <= maxViews && ageDays >= minAgeDays;
    const matches = (!targetClass || String(lesson.targetClass || '').toLowerCase() === targetClass) && (!stack || String(lesson.stack || '').toLowerCase() === stack);
    return { key: keyOf(lesson), views, ageDays, quiet, matches, resurfaced: quiet && matches, score: round2(ageDays / 10 - views) };
  }).filter(r => r.resurfaced).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, resurfaced: rows, count: (lessons || []).length, resurfacedCount: rows.length, top: rows[0] || null, summary: `Infinity AI resurfaced ${rows.length} quiet lesson(s) matching the current hunt profile.` };
}

/** Let senior researchers upvote or challenge lessons (idea 53320). */
export function reviewLessonQualityPeer(lessons = [], options = {}) {
  const rows = (lessons || []).map(lesson => {
    const upvotes = num(lesson.upvotes, 0);
    const challenges = num(lesson.challenges ?? lesson.downvotes, 0);
    const total = upvotes + challenges;
    const score = total ? round2((upvotes - challenges) / total) : 0;
    return { key: keyOf(lesson), upvotes, challenges, totalVotes: total, score, qualityScore: score, contested: challenges >= 3 && upvotes >= 3, approved: score >= 0.5 && total >= 2, band: score >= 0.5 ? 'trusted' : score <= -0.5 ? 'flagged' : 'unrated' };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, trustedCount: rows.filter(r => r.band === 'trusted').length, contestedCount: rows.filter(r => r.contested).length, flaggedCount: rows.filter(r => r.band === 'flagged').length, top: rows[0] || null, summary: `Infinity AI peer-reviewed ${rows.length} lesson(s); ${rows.filter(r => r.band === 'trusted').length} are trusted.` };
}
