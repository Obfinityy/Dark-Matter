/**
 * wave99BCores.js — Infinity AI · Wave 99B
 * Hunt debrief operations, ideas 53950–53960: one-page hunt debriefs,
 * executive debrief summaries, technical deep-dive debriefs, debrief
 * narrative generation, debrief finding timelines, debrief strategy
 * annotations, debrief lesson extraction, debrief comparison views,
 * debrief distribution lists, debrief feedback collection, and debrief
 * template customization.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE99_B_IDEAS = [
  { id: 53950, title: 'One-Page Hunt Debriefs', skip: false },
  { id: 53951, title: 'Executive Debrief Summaries', skip: false },
  { id: 53952, title: 'Technical Deep-Dive Debriefs', skip: false },
  { id: 53953, title: 'Debrief Narrative Generation', skip: false },
  { id: 53954, title: 'Debrief Finding Timelines', skip: false },
  { id: 53955, title: 'Debrief Strategy Annotations', skip: false },
  { id: 53956, title: 'Debrief Lesson Extraction', skip: false },
  { id: 53957, title: 'Debrief Comparison Views', skip: false },
  { id: 53958, title: 'Debrief Distribution Lists', skip: false },
  { id: 53959, title: 'Debrief Feedback Collection', skip: false },
  { id: 53960, title: 'Debrief Template Customization', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}

/** Idea 53950 — One-Page Hunt Debriefs. Input records: {huntId, findingsCount, wordCount, maxWords}. One-page debriefs fit the whole hunt inside the word budget without dropping findings. Condenses each hunt into a single skimmable page. */
export function buildOnePageHuntDebriefs(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const findingsCount = num(r.findingsCount ?? r.findings, 0);
    const wordCount = num(r.wordCount, 0);
    const maxWords = Math.max(50, num(r.maxWords, 400));
    const fits = wordCount <= maxWords;
    const density = maxWords > 0 ? round2(findingsCount / Math.max(1, wordCount / 100)) : 0;
    return { key: huntId, huntId, findingsCount, wordCount, maxWords, fits, density, wordsOver: Math.max(0, wordCount - maxWords), status: fits ? 'one-page' : 'needs-condensing' };
  }).sort((a, b) => b.findingsCount - a.findingsCount || String(a.key).localeCompare(String(b.key)));
  const fitsCount = rows.filter(r => r.fits).length;
  return { rows, count: rows.length, fitsCount, overCount: rows.length - fitsCount, totalFindings: rows.reduce((s, r) => s + r.findingsCount, 0), top: rows[0] || null, summary: `Infinity AI condensed ${fitsCount} of ${rows.length} hunt(s) into one-page debriefs.` };
}
/** Idea 53951 — Executive Debrief Summaries. Input records: {huntId, riskScore, businessImpact, plainLanguageScore}. Executive summaries lead with business impact in plain language, not technique. Summarizes hunts for executives in business terms. */
export function buildExecutiveDebriefSummaries(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const riskScore = round2(clamp01(r.riskScore ?? r.risk));
    const businessImpact = num(r.businessImpact ?? r.impact, 0);
    const plainLanguageScore = round2(clamp01(r.plainLanguageScore ?? r.plainLanguage));
    const executiveReady = plainLanguageScore >= 0.7 && businessImpact > 0;
    return { key: huntId, huntId, riskScore, businessImpact, plainLanguageScore, executiveReady, priority: round2(riskScore * businessImpact), status: executiveReady ? 'executive-ready' : 'needs-translation' };
  }).sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.executiveReady).length;
  return { rows, count: rows.length, readyCount, totalImpact: round2(rows.reduce((s, r) => s + r.businessImpact, 0)), top: rows[0] || null, summary: `Infinity AI prepared executive summaries for ${readyCount} of ${rows.length} hunt(s).` };
}
/** Idea 53952 — Technical Deep-Dive Debriefs. Input records: {huntId, findingsCount, evidenceItems, reproductionSteps}. Deep dives are complete when every finding carries evidence and reproduction steps. Gives engineers the full technical detail behind each finding. */
export function buildTechnicalDeepDiveDebriefs(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const findingsCount = Math.max(1, num(r.findingsCount ?? r.findings, 1));
    const evidenceItems = num(r.evidenceItems ?? r.evidence, 0);
    const reproductionSteps = num(r.reproductionSteps ?? r.steps, 0);
    const evidencePerFinding = round2(evidenceItems / findingsCount);
    const complete = evidenceItems >= findingsCount && reproductionSteps >= findingsCount;
    return { key: huntId, huntId, findingsCount, evidenceItems, reproductionSteps, evidencePerFinding, complete, status: complete ? 'deep-dive-complete' : 'detail-missing' };
  }).sort((a, b) => b.evidencePerFinding - a.evidencePerFinding || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, incompleteCount: rows.length - completeCount, top: rows[0] || null, summary: `Infinity AI completed technical deep dives for ${completeCount} of ${rows.length} hunt(s).` };
}
/** Idea 53953 — Debrief Narrative Generation. Input records: {huntId, findingsCount, timelineEvents, toneScore}. Narratives weave findings and timeline events into a readable hunt story. Generates a readable story of how each hunt unfolded. */
export function generateDebriefNarratives(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const findingsCount = num(r.findingsCount ?? r.findings, 0);
    const timelineEvents = num(r.timelineEvents ?? r.events, 0);
    const toneScore = round2(clamp01(r.toneScore ?? r.tone));
    const rich = findingsCount >= 1 && timelineEvents >= 3;
    const readable = toneScore >= 0.6;
    return { key: huntId, huntId, findingsCount, timelineEvents, toneScore, rich, readable, publishable: rich && readable, status: rich && readable ? 'narrative-ready' : 'narrative-thin' };
  }).sort((a, b) => b.timelineEvents - a.timelineEvents || b.findingsCount - a.findingsCount || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.publishable).length;
  return { rows, count: rows.length, readyCount, averageTone: mean(rows.map(r => r.toneScore)), top: rows[0] || null, summary: `Infinity AI generated publishable narratives for ${readyCount} of ${rows.length} hunt debrief(s).` };
}
/** Idea 53954 — Debrief Finding Timelines. Input records: {huntId, findingId, discoveredHour, verifiedHour}. Timelines order findings by discovery so the hunt sequence stays honest. Shows when each finding was discovered and verified during a hunt. */
export function buildDebriefFindingTimelines(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const findingId = String(r.findingId || r.finding || 'finding');
    const discoveredHour = num(r.discoveredHour ?? r.discovered, 0);
    const verifiedHour = num(r.verifiedHour ?? r.verified, 0);
    const verifyLag = round2(Math.max(0, verifiedHour - discoveredHour));
    return { key: `${huntId}|${findingId}`, huntId, findingId, discoveredHour, verifiedHour, verifyLag, verified: verifiedHour >= discoveredHour && verifiedHour > 0, fastTrack: verifyLag <= 2 && verifiedHour > 0 };
  }).sort((a, b) => a.discoveredHour - b.discoveredHour || String(a.key).localeCompare(String(b.key)));
  const hunts = [...new Set(rows.map(r => r.huntId))].sort();
  return { rows, count: rows.length, huntCount: hunts.length, fastTrackCount: rows.filter(r => r.fastTrack).length, averageLag: mean(rows.map(r => r.verifyLag)), top: rows[0] || null, summary: `Infinity AI built finding timelines covering ${rows.length} finding(s) across ${hunts.length} hunt(s).` };
}
/** Idea 53955 — Debrief Strategy Annotations. Input records: {huntId, strategyNote, decisionCount, outcomesLinked}. Annotations link strategy decisions to the outcomes they produced. Annotates debriefs with the strategy decisions behind each move. */
export function annotateDebriefStrategy(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const strategyNote = String(r.strategyNote || r.note || '').trim();
    const decisionCount = num(r.decisionCount ?? r.decisions, 0);
    const outcomesLinked = Math.min(decisionCount, num(r.outcomesLinked ?? r.linked, 0));
    const linkRate = rate(outcomesLinked, decisionCount);
    const annotated = strategyNote.length > 0 && decisionCount >= 1;
    return { key: huntId, huntId, strategyNote, decisionCount, outcomesLinked, linkRate, annotated, status: annotated && linkRate >= 0.8 ? 'fully-annotated' : annotated ? 'partially-annotated' : 'unannotated' };
  }).sort((a, b) => b.linkRate - a.linkRate || b.decisionCount - a.decisionCount || String(a.key).localeCompare(String(b.key)));
  const fullyCount = rows.filter(r => r.status === 'fully-annotated').length;
  return { rows, count: rows.length, fullyCount, annotatedCount: rows.filter(r => r.annotated).length, top: rows[0] || null, summary: `Infinity AI fully annotated strategy on ${fullyCount} of ${rows.length} hunt debrief(s).` };
}
/** Idea 53956 — Debrief Lesson Extraction. Input records: {huntId, rawNotes, lessonsExtracted, reusableLessons}. Extraction turns raw hunt notes into reusable lessons for future hunts. Extracts reusable lessons from every hunt debrief automatically. */
export function extractDebriefLessons(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const rawNotes = num(r.rawNotes ?? r.notes, 0);
    const lessonsExtracted = Math.min(rawNotes, num(r.lessonsExtracted ?? r.lessons, 0));
    const reusableLessons = Math.min(lessonsExtracted, num(r.reusableLessons ?? r.reusable, 0));
    const yieldRate = rate(lessonsExtracted, rawNotes);
    return { key: huntId, huntId, rawNotes, lessonsExtracted, reusableLessons, yieldRate, productive: reusableLessons >= 2, status: reusableLessons >= 2 ? 'lessons-banked' : lessonsExtracted > 0 ? 'lessons-extracted' : 'no-lessons' };
  }).sort((a, b) => b.reusableLessons - a.reusableLessons || b.yieldRate - a.yieldRate || String(a.key).localeCompare(String(b.key)));
  const bankedCount = rows.filter(r => r.productive).length;
  return { rows, count: rows.length, bankedCount, totalLessons: rows.reduce((s, r) => s + r.lessonsExtracted, 0), totalReusable: rows.reduce((s, r) => s + r.reusableLessons, 0), top: rows[0] || null, summary: `Infinity AI banked reusable lessons from ${bankedCount} of ${rows.length} hunt debrief(s).` };
}
/** Idea 53957 — Debrief Comparison Views. Input records: {huntId, baselineHuntId, findingsDelta, durationDeltaHours}. Comparisons place a hunt beside its baseline so improvement is visible. Compares debriefs side by side to spot improvement between hunts. */
export function buildDebriefComparisonViews(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const baselineHuntId = String(r.baselineHuntId || r.baseline || 'baseline');
    const findingsDelta = num(r.findingsDelta ?? r.delta, 0);
    const durationDeltaHours = round2(num(r.durationDeltaHours ?? r.durationDelta, 0));
    const improved = findingsDelta > 0 && durationDeltaHours <= 0;
    return { key: `${huntId}|${baselineHuntId}`, huntId, baselineHuntId, findingsDelta, durationDeltaHours, improved, faster: durationDeltaHours < 0, status: improved ? 'improved' : findingsDelta > 0 ? 'more-findings-slower' : 'regressed-or-flat' };
  }).sort((a, b) => b.findingsDelta - a.findingsDelta || a.durationDeltaHours - b.durationDeltaHours || String(a.key).localeCompare(String(b.key)));
  const improvedCount = rows.filter(r => r.improved).length;
  return { rows, count: rows.length, improvedCount, fasterCount: rows.filter(r => r.faster).length, top: rows[0] || null, summary: `Infinity AI compared ${rows.length} hunt pair(s); ${improvedCount} improved on the baseline.` };
}
/** Idea 53958 — Debrief Distribution Lists. Input records: {huntId, recipients, requiredRoles, sentCount}. Distribution reaches every required role so no stakeholder misses the debrief. Sends each debrief to exactly the people who need it. */
export function buildDebriefDistributionLists(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const recipients = Array.isArray(r.recipients) ? r.recipients.map(String) : [];
    const requiredRoles = Array.isArray(r.requiredRoles) ? r.requiredRoles.map(String) : [];
    const sentCount = Math.min(recipients.length, num(r.sentCount ?? r.sent, 0));
    const recipientSet = new Set(recipients.map(s => s.toLowerCase()));
    const missingRoles = requiredRoles.filter(role => !recipientSet.has(role.toLowerCase()));
    const fullyDistributed = missingRoles.length === 0 && sentCount >= recipients.length;
    return { key: huntId, huntId, recipients, requiredRoles, sentCount, recipientCount: recipients.length, missingRoles, missingCount: missingRoles.length, fullyDistributed, status: fullyDistributed ? 'fully-distributed' : 'distribution-gaps' };
  }).sort((a, b) => a.missingCount - b.missingCount || String(a.key).localeCompare(String(b.key)));
  const fullCount = rows.filter(r => r.fullyDistributed).length;
  return { rows, count: rows.length, fullCount, gapCount: rows.length - fullCount, top: rows[0] || null, summary: `Infinity AI fully distributed ${fullCount} of ${rows.length} hunt debrief(s) to every required role.` };
}
/** Idea 53959 — Debrief Feedback Collection. Input records: {huntId, responses, readers, averageRating}. Feedback shows whether debriefs actually help their readers improve. Collects reader feedback so debriefs keep getting more useful. */
export function collectDebriefFeedback(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const responses = num(r.responses, 0);
    const readers = Math.max(1, num(r.readers, 1));
    const averageRating = round2(Math.min(5, Math.max(0, num(r.averageRating ?? r.rating, 0))));
    const responseRate = rate(responses, readers);
    const wellReceived = averageRating >= 4 && responses >= 3;
    return { key: huntId, huntId, responses, readers, averageRating, responseRate, wellReceived, status: wellReceived ? 'well-received' : responses > 0 ? 'feedback-collected' : 'no-feedback-yet' };
  }).sort((a, b) => b.averageRating - a.averageRating || b.responseRate - a.responseRate || String(a.key).localeCompare(String(b.key)));
  const wellReceivedCount = rows.filter(r => r.wellReceived).length;
  return { rows, count: rows.length, wellReceivedCount, totalResponses: rows.reduce((s, r) => s + r.responses, 0), averageRating: mean(rows.map(r => r.averageRating)), top: rows[0] || null, summary: `Infinity AI collected feedback on ${rows.length} debrief(s); ${wellReceivedCount} are well received.` };
}
/** Idea 53960 — Debrief Template Customization. Input records: {team, templateId, sectionsCustomized, sectionsTotal, active}. Custom templates keep required sections while fitting each team format. Lets each team customize debrief templates without losing required sections. */
export function customizeDebriefTemplates(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const team = String(r.team || 'team');
    const templateId = String(r.templateId || r.template || 'template');
    const sectionsTotal = Math.max(1, num(r.sectionsTotal ?? r.total, 1));
    const sectionsCustomized = Math.min(sectionsTotal, num(r.sectionsCustomized ?? r.customized, 0));
    const active = Boolean(r.active ?? true);
    const customizationRate = rate(sectionsCustomized, sectionsTotal);
    const tailored = customizationRate >= 0.5 && active;
    return { key: `${team}|${templateId}`, team, templateId, sectionsCustomized, sectionsTotal, active, customizationRate, tailored, status: tailored ? 'tailored' : active ? 'default-template' : 'inactive' };
  }).sort((a, b) => b.customizationRate - a.customizationRate || String(a.key).localeCompare(String(b.key)));
  const tailoredCount = rows.filter(r => r.tailored).length;
  return { rows, count: rows.length, tailoredCount, activeCount: rows.filter(r => r.active).length, top: rows[0] || null, summary: `Infinity AI tailored ${tailoredCount} of ${rows.length} debrief template(s) to team formats.` };
}
