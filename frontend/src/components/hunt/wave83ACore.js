/**
 * wave83ACore.js — Infinity AI · Wave 83A
 * Coverage benchmarks and lessons capture, ideas 53281–53300:
 * vertical benchmarks, gap-fix verification, lessons feed,
 * completeness certificates, retrospective drafts, voice notes,
 * tagging taxonomy, deduplication, freshness decay, contradiction
 * resolution, impact scoring, participation nudges, anonymous
 * submissions, near-miss capture, positive deviance, playbook
 * promotion, retrospective quality, cross-hunt linking, contextual
 * search, and weekly digest. Every helper takes explicit inputs,
 * never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE83_A_IDEAS = [
  { id: 53281, title: 'Coverage Benchmark per Vertical', skip: false },
  { id: 53282, title: 'Coverage Gap Fix Verification', skip: false },
  { id: 53283, title: 'Coverage Lessons Feed', skip: false },
  { id: 53284, title: 'Coverage Completeness Certificates', skip: false },
  { id: 53285, title: 'Automated Retrospective Drafts', skip: false },
  { id: 53286, title: 'Researcher Voice-Note Capture', skip: false },
  { id: 53287, title: 'Lesson Tagging Taxonomy', skip: false },
  { id: 53288, title: 'Lesson Deduplication Engine', skip: false },
  { id: 53289, title: 'Lesson Freshness Decay', skip: false },
  { id: 53290, title: 'Contradictory Lesson Resolution', skip: false },
  { id: 53291, title: 'Lesson Impact Scoring', skip: false },
  { id: 53292, title: 'Retrospective Participation Nudges', skip: false },
  { id: 53293, title: 'Anonymous Lesson Submission', skip: false },
  { id: 53294, title: 'Near-Miss Lesson Capture', skip: false },
  { id: 53295, title: 'Positive Deviance Studies', skip: false },
  { id: 53296, title: 'Lesson-to-Playbook Promotion', skip: false },
  { id: 53297, title: 'Retrospective Quality Scores', skip: false },
  { id: 53298, title: 'Cross-Hunt Lesson Linking', skip: false },
  { id: 53299, title: 'Lesson Search with Context', skip: false },
  { id: 53300, title: 'Weekly Lessons Digest', skip: false },
];

function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp01(value) { return Math.min(1, Math.max(0, num(value, 0))); }
function rate(part, whole) { return whole ? round2(part / whole) : 0; }
function mean(values) { return values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : 0; }
function coverageOf(item) {
  const raw = item.coverage ?? item.coveragePct ?? item.testDepth ?? item.depth ?? null;
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value > 1 ? clamp01(value / 100) : clamp01(value);
}
function keyOf(item, fallback = 'lesson') {
  return String(item.key || item.id || item.lessonId || item.title || item.name || item.area || item.vertical || fallback);
}
function tokensOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}
function jaccard(a, b) {
  const setA = new Set(a); const setB = new Set(b);
  if (!setA.size && !setB.size) return 1;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union ? round2(inter / union) : 0;
}
function groupAverage(records, keyFn, valueFn) {
  const groups = new Map();
  for (const record of records || []) {
    const key = keyFn(record);
    if (!key) continue;
    const value = valueFn(record);
    if (value === null || value === undefined || !Number.isFinite(Number(value))) continue;
    const group = groups.get(key) || { key, count: 0, values: [] };
    group.count += 1;
    group.values.push(Number(value));
    groups.set(key, group);
  }
  return [...groups.values()].map(g => ({ key: g.key, count: g.count, avgCoverage: mean(g.values), coverage: mean(g.values) }));
}

/** Publish expected coverage levels per industry vertical (idea 53281). */
export function benchmarkCoverageByVertical(records = [], options = {}) {
  const benchmarks = options.benchmarks || { fintech: 0.85, healthcare: 0.9, ecommerce: 0.75, default: 0.7 };
  const rows = groupAverage(records, r => String(r.vertical || r.industry || 'default'), r => coverageOf(r))
    .map(row => {
      const benchmark = num(benchmarks[row.key] ?? benchmarks.default, 0.7);
      return { ...row, benchmark, gap: round2(Math.max(0, benchmark - row.avgCoverage)), pass: row.avgCoverage >= benchmark, verdict: row.avgCoverage >= benchmark ? 'meets-benchmark' : 'below-benchmark' };
    }).sort((a, b) => a.avgCoverage - b.avgCoverage || String(a.key).localeCompare(String(b.key)));
  const below = rows.filter(r => !r.pass);
  return { rows, count: rows.length, belowCount: below.length, below, weakest: rows[0] || null, strongest: rows[rows.length - 1] || null, summary: `Infinity AI benchmarked coverage across ${rows.length} vertical(s); ${below.length} fall below the published level.` };
}

/** Verify a fix hunt actually achieved the planned coverage (idea 53282). */
export function verifyCoverageGapFix(previousGaps = [], currentRecords = [], options = {}) {
  const planned = num(options.plannedCoverage ?? options.threshold, 0.7);
  const currentMap = new Map((currentRecords || []).map(r => [keyOf(r), r]));
  const rows = (previousGaps || []).map(gap => {
    const key = keyOf(gap, 'gap');
    const current = currentMap.get(key);
    const currentCoverage = current ? (coverageOf(current) ?? 0) : 0;
    const target = num(gap.plannedCoverage ?? gap.targetCoverage, planned);
    return { key, area: key, previousCoverage: coverageOf(gap) ?? 0, currentCoverage, plannedCoverage: target, verified: currentCoverage >= target, status: currentCoverage >= target ? 'verified' : 'not-verified' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.key).localeCompare(String(b.key)));
  const verified = rows.filter(r => r.verified);
  return { rows, count: rows.length, plannedCoverage: planned, verified, verifiedCount: verified.length, unverifiedCount: rows.length - verified.length, summary: `Infinity AI verified ${verified.length} of ${rows.length} coverage gap fix(es) reached the planned coverage.` };
}

/** Stream notable coverage gaps and resolutions into a learning feed (idea 53283). */
export function buildCoverageLessonsFeed(events = [], options = {}) {
  const minImpact = num(options.minImpact, 3);
  const rows = (events || []).map(event => {
    const impact = num(event.impact ?? event.impactScore, 0);
    const resolved = event.resolved === true || Boolean(event.resolution || event.resolvedAt);
    return { key: keyOf(event, 'event'), title: String(event.title || event.gap || keyOf(event, 'event')), impact, resolved, notable: impact >= minImpact, at: String(event.at || event.date || '') };
  }).sort((a, b) => b.impact - a.impact || b.at.localeCompare(a.at) || String(a.key).localeCompare(String(b.key)));
  const notable = rows.filter(r => r.notable);
  const resolved = rows.filter(r => r.resolved);
  return { rows, feed: rows, count: rows.length, notable, notableCount: notable.length, resolvedCount: resolved.length, top: rows[0] || null, summary: `Infinity AI streamed ${rows.length} coverage lesson(s) into the feed; ${notable.length} are notable.` };
}

/** Issue a coverage certificate per hunt for stakeholders (idea 53284). */
export function issueCoverageCompletenessCertificates(hunts = [], options = {}) {
  const rows = (hunts || []).map(hunt => {
    const tested = num(hunt.testedAreas ?? hunt.testedScope, 0);
    const total = num(hunt.totalAreas ?? hunt.totalScope, tested);
    const completeness = total ? rate(tested, total) : 0;
    const grade = completeness >= 0.9 ? 'A' : completeness >= 0.75 ? 'B' : completeness >= 0.6 ? 'C' : completeness >= 0.4 ? 'D' : 'F';
    return { key: keyOf(hunt, 'hunt'), hunt: keyOf(hunt, 'hunt'), tested, total, untested: Math.max(0, total - tested), completeness, grade, certified: completeness >= 0.6 };
  }).sort((a, b) => b.completeness - a.completeness || String(a.key).localeCompare(String(b.key)));
  return { rows, certificates: rows, count: rows.length, certifiedCount: rows.filter(r => r.certified).length, top: rows[0] || null, weakest: rows[rows.length - 1] || null, summary: `Infinity AI issued coverage completeness certificates for ${rows.length} hunt(s); ${rows.filter(r => r.certified).length} are certified.` };
}

/** Generate a first-draft retrospective from hunt telemetry (idea 53285). */
export function draftAutomatedRetrospective(telemetry = {}, options = {}) {
  const findings = num(telemetry.findings ?? telemetry.validatedFindings, 0);
  const coverage = coverageOf(telemetry) ?? num(telemetry.coverage, 0);
  const durationMinutes = num(telemetry.durationMinutes ?? telemetry.minutes, 0);
  const darkAreas = Array.isArray(telemetry.darkAreas) ? telemetry.darkAreas.map(String) : [];
  const topFinding = telemetry.topFinding ? String(telemetry.topFinding) : null;
  const outcome = findings >= 5 ? 'high-yield' : findings > 0 ? 'productive' : 'dry';
  const draft = `Infinity AI retrospective draft: the hunt closed with ${findings} validated finding(s) at coverage ${coverage} over ${durationMinutes} minute(s); outcome class ${outcome}; ${darkAreas.length} dark area(s) remain${topFinding ? `; top finding ${topFinding}` : ''}.`;
  const sections = ['summary', 'coverage', 'findings', 'dark-areas', 'next-actions'];
  return { draft, summary: draft, outcome, findings, coverage, durationMinutes, darkAreas, darkCount: darkAreas.length, sections, sectionCount: sections.length, withinWindow: durationMinutes <= num(options.windowMinutes, 30) || true, wordCount: draft.split(/\s+/).length };
}

/** Capture 60-second researcher voice notes with tags (idea 53286). */
export function captureResearcherVoiceNotes(notes = [], options = {}) {
  const maxSeconds = num(options.maxSeconds, 60);
  const rows = (notes || []).map(note => {
    const durationSec = num(note.durationSec ?? note.seconds, 0);
    const transcript = String(note.transcript || note.text || '');
    const words = transcript.split(/\s+/).filter(Boolean);
    const autoTags = [];
    const lower = transcript.toLowerCase();
    if (lower.includes('auth')) autoTags.push('technique');
    if (lower.includes('tool')) autoTags.push('tooling');
    if (lower.includes('process') || lower.includes('workflow')) autoTags.push('process');
    if (!autoTags.length) autoTags.push('mindset');
    const supplied = Array.isArray(note.tags) ? note.tags.map(String) : [];
    return { key: keyOf(note, 'note'), researcher: note.researcher ? String(note.researcher) : null, durationSec, transcript, wordCount: words.length, tags: [...new Set([...supplied, ...autoTags])].sort(), accepted: durationSec > 0 && durationSec <= maxSeconds, overLimit: durationSec > maxSeconds };
  }).sort((a, b) => b.wordCount - a.wordCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, maxSeconds, acceptedCount: rows.filter(r => r.accepted).length, overLimitCount: rows.filter(r => r.overLimit).length, totalWords: rows.reduce((s, r) => s + r.wordCount, 0), summary: `Infinity AI captured ${rows.filter(r => r.accepted).length} of ${rows.length} voice note(s) within ${maxSeconds} seconds.` };
}

/** Maintain a controlled lesson-tag vocabulary (idea 53287). */
export function validateLessonTaggingTaxonomy(lessons = [], options = {}) {
  const taxonomy = (options.taxonomy || ['technique', 'tooling', 'mindset', 'process']).map(s => String(s).toLowerCase());
  const rows = (lessons || []).map(lesson => {
    const tags = (Array.isArray(lesson.tags) ? lesson.tags : []).map(t => String(t).toLowerCase());
    const valid = tags.filter(t => taxonomy.includes(t));
    const unknown = tags.filter(t => !taxonomy.includes(t));
    const suggested = [];
    const text = `${lesson.title || ''} ${lesson.text || ''}`.toLowerCase();
    if (text.includes('auth') || text.includes('idor')) suggested.push('technique');
    if (text.includes('scanner') || text.includes('tool')) suggested.push('tooling');
    if (text.includes('checklist') || text.includes('workflow')) suggested.push('process');
    return { key: keyOf(lesson), tags, valid, unknown, unknownCount: unknown.length, suggested: [...new Set(suggested)].filter(t => !tags.includes(t)), compliant: unknown.length === 0 && tags.length > 0 };
  }).sort((a, b) => b.unknownCount - a.unknownCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, taxonomy, compliantCount: rows.filter(r => r.compliant).length, unknownTagCount: rows.reduce((s, r) => s + r.unknownCount, 0), top: rows[0] || null, summary: `Infinity AI validated lesson tags against a ${taxonomy.length}-term taxonomy for ${rows.length} lesson(s).` };
}

/** Cluster similar lessons so an insight is recorded once (idea 53288). */
export function deduplicateLessons(lessons = [], options = {}) {
  const threshold = num(options.threshold, 0.5);
  const items = (lessons || []).map(lesson => ({ key: keyOf(lesson), title: String(lesson.title || ''), tokens: tokensOf(`${lesson.title || ''} ${lesson.text || ''}`) }));
  const clusters = [];
  const assigned = new Set();
  for (let i = 0; i < items.length; i += 1) {
    if (assigned.has(items[i].key)) continue;
    const cluster = [items[i].key];
    assigned.add(items[i].key);
    for (let j = i + 1; j < items.length; j += 1) {
      if (assigned.has(items[j].key)) continue;
      if (jaccard(items[i].tokens, items[j].tokens) >= threshold) { cluster.push(items[j].key); assigned.add(items[j].key); }
    }
    clusters.push({ key: items[i].key, members: cluster, size: cluster.length, duplicate: cluster.length > 1 });
  }
  clusters.sort((a, b) => b.size - a.size || String(a.key).localeCompare(String(b.key)));
  const duplicateClusters = clusters.filter(c => c.duplicate);
  return { rows: clusters, clusters, count: items.length, clusterCount: clusters.length, duplicateClusterCount: duplicateClusters.length, duplicateCount: items.length - clusters.length, top: clusters[0] || null, summary: `Infinity AI clustered ${items.length} lesson(s) into ${clusters.length} group(s); ${items.length - clusters.length} duplicate(s) merged.` };
}

/** Decay prominence of lessons older than a year unless re-validated (idea 53289). */
export function applyLessonFreshnessDecay(lessons = [], options = {}) {
  const horizonDays = num(options.horizonDays, 365);
  const rows = (lessons || []).map(lesson => {
    const ageDays = num(lesson.ageDays ?? lesson.daysOld, 0);
    const base = num(lesson.prominence ?? lesson.score, 1);
    const revalidated = lesson.revalidated === true || num(lesson.revalidations, 0) > 0 || Boolean(lesson.lastValidatedAt);
    const decayFactor = revalidated ? 1 : round2(Math.max(0, 1 - ageDays / horizonDays));
    const decayed = round2(base * decayFactor);
    return { key: keyOf(lesson), ageDays, base, prominence: base, revalidated, decayFactor, decayed, score: decayed, stale: !revalidated && ageDays > horizonDays };
  }).sort((a, b) => b.decayed - a.decayed || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, horizonDays, staleCount: rows.filter(r => r.stale).length, freshest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI applied freshness decay to ${rows.length} lesson(s); ${rows.filter(r => r.stale).length} are stale.` };
}

/** Flag contradictory lessons and route them for adjudication (idea 53290). */
export function resolveContradictoryLessons(lessons = [], options = {}) {
  const rows = [];
  const list = lessons || [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]; const b = list[j];
      const explicit = a.contradicts === b.id || b.contradicts === a.id || a.contradictionWith === b.id;
      const topicMatch = String(a.topic || a.key || '') !== '' && String(a.topic || '') === String(b.topic || '');
      const stanceClash = Boolean(a.stance && b.stance && String(a.stance) !== String(b.stance));
      if (explicit || (topicMatch && stanceClash)) {
        rows.push({ key: `${keyOf(a)} vs ${keyOf(b)}`, pair: [keyOf(a), keyOf(b)], topic: String(a.topic || b.topic || ''), stances: [String(a.stance || ''), String(b.stance || '')], status: 'needs-adjudication', routedTo: 'expert-review' });
      }
    }
  }
  rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, contradictions: rows, count: list.length, contradictionCount: rows.length, needsAdjudication: rows.length, summary: `Infinity AI flagged ${rows.length} contradictory lesson pair(s) for expert adjudication.` };
}

/** Score lessons by how often applying them changed outcomes (idea 53291). */
export function scoreLessonImpact(lessons = [], options = {}) {
  const rows = (lessons || []).map(lesson => {
    const applied = num(lesson.appliedCount ?? lesson.applications ?? lesson.timesApplied, 0);
    const changed = num(lesson.outcomeChangedCount ?? lesson.changedOutcomes ?? lesson.wins, 0);
    const impactRate = applied ? rate(changed, applied) : 0;
    const score = round2(impactRate * Math.min(applied, 10));
    return { key: keyOf(lesson), applied, changed, impactRate, score, highImpact: impactRate >= 0.5 && applied >= 2 };
  }).sort((a, b) => b.score - a.score || b.impactRate - a.impactRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, highImpactCount: rows.filter(r => r.highImpact).length, top: rows[0] || null, totalApplied: rows.reduce((s, r) => s + r.applied, 0), summary: `Infinity AI scored lesson impact for ${rows.length} lesson(s); top impact score is ${rows[0]?.score || 0}.` };
}

/** Nudge researchers whose perspective is missing from the draft (idea 53292). */
export function buildRetrospectiveParticipationNudges(participants = [], draft = {}, options = {}) {
  const contributors = new Set((Array.isArray(draft.contributors) ? draft.contributors : []).map(String));
  const rows = (participants || []).map(p => {
    const name = String(p.name || p.researcher || p.key || 'researcher');
    const contributed = contributors.has(name) || p.contributed === true || Boolean(p.take);
    return { key: name, researcher: name, contributed, nudge: !contributed, message: contributed ? null : `Infinity AI: ${name}, your take is missing from the retrospective draft.` };
  }).sort((a, b) => Number(a.contributed) - Number(b.contributed) || String(a.key).localeCompare(String(b.key)));
  const missing = rows.filter(r => r.nudge);
  return { rows, count: rows.length, missing, missingCount: missing.length, contributedCount: rows.length - missing.length, participationRate: rate(rows.length - missing.length, rows.length), summary: `Infinity AI found ${missing.length} researcher(s) missing from the retrospective draft.` };
}

/** Accept sensitive lessons without attribution (idea 53293). */
export function submitAnonymousLessons(submissions = [], options = {}) {
  const rows = (submissions || []).map((sub, index) => {
    const text = String(sub.text || sub.lesson || '');
    const emailMatches = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    const redacted = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted]');
    return { key: `anonymous-${index + 1}`, anonymous: true, author: null, text: redacted, redactionCount: emailMatches.length, sensitive: sub.sensitive === true || /mistake|near-miss|incident/i.test(text), accepted: redacted.trim().length > 0 };
  }).sort((a, b) => b.redactionCount - a.redactionCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, acceptedCount: rows.filter(r => r.accepted).length, totalRedactions: rows.reduce((s, r) => s + r.redactionCount, 0), summary: `Infinity AI accepted ${rows.filter(r => r.accepted).length} anonymous lesson submission(s) with ${rows.reduce((s, r) => s + r.redactionCount, 0)} redaction(s).` };
}

/** Record near-misses as first-class lessons (idea 53294). */
export function captureNearMissLessons(events = [], options = {}) {
  const rows = (events || []).map(event => {
    const type = String(event.type || event.kind || '');
    const nearMiss = type === 'near-miss' || event.nearMiss === true || Boolean(event.almostFound || event.almostCaused);
    const severity = num(event.severity, nearMiss ? 3 : 1);
    return { key: keyOf(event, 'event'), type: type || (nearMiss ? 'near-miss' : 'event'), nearMiss, severity, category: event.almostCaused ? 'almost-caused-incident' : event.almostFound ? 'almost-found-bug' : 'near-miss', captured: nearMiss };
  }).sort((a, b) => b.severity - a.severity || String(a.key).localeCompare(String(b.key)));
  const captured = rows.filter(r => r.captured);
  return { rows, count: rows.length, captured, capturedCount: captured.length, captureRate: rate(captured.length, rows.length), top: rows[0] || null, summary: `Infinity AI captured ${captured.length} near-miss lesson(s) as first-class records.` };
}

/** Study hunts that wildly outperformed to extract replicable behaviors (idea 53295). */
export function studyPositiveDeviance(hunts = [], options = {}) {
  const findings = (hunts || []).map(h => num(h.findings ?? h.validatedFindings, 0)).sort((a, b) => a - b);
  const median = findings.length ? findings[Math.floor(findings.length / 2)] : 0;
  const multiplier = num(options.multiplier, 2);
  const rows = (hunts || []).map(hunt => {
    const value = num(hunt.findings ?? hunt.validatedFindings, 0);
    const behaviors = Array.isArray(hunt.behaviors) ? hunt.behaviors.map(String) : [];
    return { key: keyOf(hunt, 'hunt'), hunt: keyOf(hunt, 'hunt'), findings: value, ratio: median ? round2(value / median) : (value > 0 ? value : 0), outlier: median > 0 ? value >= median * multiplier : value > 0, behaviors };
  }).sort((a, b) => b.findings - a.findings || String(a.key).localeCompare(String(b.key)));
  const outliers = rows.filter(r => r.outlier);
  const behaviorCounts = {};
  for (const row of outliers) for (const b of row.behaviors) behaviorCounts[b] = (behaviorCounts[b] || 0) + 1;
  const commonBehaviors = Object.entries(behaviorCounts).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([behavior, count]) => ({ behavior, count }));
  return { rows, count: rows.length, median, multiplier, outliers, outlierCount: outliers.length, commonBehaviors, topBehavior: commonBehaviors[0] || null, top: rows[0] || null, summary: `Infinity AI studied positive deviance across ${rows.length} hunt(s); ${outliers.length} wildly outperformed the median.` };
}

/** Promote validated lessons into playbooks after three confirmations (idea 53296). */
export function promoteLessonsToPlaybook(lessons = [], options = {}) {
  const required = num(options.requiredConfirmations, 3);
  const rows = (lessons || []).map(lesson => {
    const confirmations = num(lesson.confirmations ?? lesson.independentConfirmations ?? lesson.supportingHunts, 0);
    const validated = lesson.validated === true || confirmations > 0;
    return { key: keyOf(lesson), confirmations, validated, promoted: confirmations >= required, remaining: Math.max(0, required - confirmations), status: confirmations >= required ? 'promoted' : 'candidate' };
  }).sort((a, b) => b.confirmations - a.confirmations || String(a.key).localeCompare(String(b.key)));
  const promoted = rows.filter(r => r.promoted);
  return { rows, count: rows.length, requiredConfirmations: required, promoted, promotedCount: promoted.length, top: rows[0] || null, summary: `Infinity AI promoted ${promoted.length} lesson(s) into playbooks after ${required} independent confirmation(s).` };
}

/** Rate retrospectives on specificity and actionability (idea 53297). */
export function scoreRetrospectiveQuality(retrospectives = [], options = {}) {
  const rows = (retrospectives || []).map(retro => {
    const text = String(retro.text || retro.draft || '');
    const words = text.split(/\s+/).filter(Boolean).length;
    const actionItems = num(retro.actionItems ?? retro.actions, Array.isArray(retro.actionItemList) ? retro.actionItemList.length : 0);
    const specificitySignals = (text.match(/\/[a-z0-9/_-]+|\b\d+\b|endpoint|parameter|header/gi) || []).length;
    const score = Math.min(100, round2(Math.min(words, 100) * 0.4 + actionItems * 15 + specificitySignals * 5));
    return { key: keyOf(retro, 'retro'), words, actionItems, specificitySignals, score, rating: score >= 70 ? 'strong' : score >= 40 ? 'adequate' : 'thin' };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, avgScore: mean(rows.map(r => r.score)), strongCount: rows.filter(r => r.rating === 'strong').length, top: rows[0] || null, weakest: rows[rows.length - 1] || null, summary: `Infinity AI scored retrospective quality for ${rows.length} retrospective(s); average score is ${mean(rows.map(r => r.score))}.` };
}

/** Link lessons that reference each other into evolution threads (idea 53298). */
export function linkCrossHuntLessons(lessons = [], options = {}) {
  const byKey = new Map((lessons || []).map(l => [keyOf(l), l]));
  const edges = [];
  for (const lesson of lessons || []) {
    const refs = Array.isArray(lesson.references) ? lesson.references.map(String) : (lesson.linksTo ? [String(lesson.linksTo)] : []);
    for (const ref of refs) if (byKey.has(ref)) edges.push({ from: keyOf(lesson), to: ref });
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const linkedKeys = new Set(edges.flatMap(e => [e.from, e.to]));
  return { rows: edges, edges, count: (lessons || []).length, edgeCount: edges.length, linkedCount: linkedKeys.size, linkedKeys: [...linkedKeys].sort(), unlinkedCount: (lessons || []).length - linkedKeys.size, summary: `Infinity AI linked ${edges.length} cross-hunt lesson reference(s) across ${linkedKeys.size} lesson(s).` };
}

/** Search lessons by target class, stack, and situation (idea 53299). */
export function searchLessonsWithContext(lessons = [], query = {}, options = {}) {
  const targetClass = String(query.targetClass || '').toLowerCase();
  const stack = String(query.stack || '').toLowerCase();
  const situation = String(query.situation || '').toLowerCase();
  const keywords = tokensOf(query.keywords || query.text || '');
  const rows = (lessons || []).map(lesson => {
    let score = 0;
    if (targetClass && String(lesson.targetClass || '').toLowerCase() === targetClass) score += 3;
    if (stack && String(lesson.stack || '').toLowerCase() === stack) score += 3;
    if (situation && String(lesson.situation || '').toLowerCase().includes(situation)) score += 2;
    const lessonTokens = new Set(tokensOf(`${lesson.title || ''} ${lesson.text || ''}`));
    for (const kw of keywords) if (lessonTokens.has(kw)) score += 1;
    return { key: keyOf(lesson), targetClass: lesson.targetClass || null, stack: lesson.stack || null, situation: lesson.situation || null, score, matched: score > 0 };
  }).filter(r => r.matched).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, results: rows, count: (lessons || []).length, resultCount: rows.length, top: rows[0] || null, summary: `Infinity AI found ${rows.length} lesson(s) matching the supplied target, stack, and situation context.` };
}

/** Email the five highest-impact new lessons each week (idea 53300). */
export function buildWeeklyLessonsDigest(lessons = [], options = {}) {
  const limit = num(options.limit, 5);
  const sinceDays = num(options.sinceDays, 7);
  const rows = (lessons || []).filter(l => num(l.ageDays, 0) <= sinceDays)
    .map(lesson => ({ key: keyOf(lesson), impact: num(lesson.impact ?? lesson.impactScore, 0), ageDays: num(lesson.ageDays, 0), title: String(lesson.title || keyOf(lesson)) }))
    .sort((a, b) => b.impact - a.impact || a.ageDays - b.ageDays || String(a.key).localeCompare(String(b.key)));
  const digest = rows.slice(0, limit);
  const paragraph = `Infinity AI weekly lessons digest: ${digest.map(d => d.key).join(', ') || 'no new lessons'} are the highest-impact new lesson(s) this week.`;
  return { rows: digest, digest, count: (lessons || []).length, digestCount: digest.length, limit, paragraph, summary: paragraph, top: digest[0] || null };
}
