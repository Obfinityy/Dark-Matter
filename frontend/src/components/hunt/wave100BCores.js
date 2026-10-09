/**
 * wave100BCores.js — Infinity AI · Wave 100B
 * Debrief delivery operations, ideas 53981–54000: collaboration
 * comments, export formats, API access, notification rules,
 * personalization, reading time estimates, TL;DR generation,
 * glossary inclusion, visual design standards, accessibility
 * compliance, translation workflows, sentiment calibration,
 * historical comparisons, methodology appendices, finding
 * cross-references, action item owners, SLA tracking,
 * effectiveness surveys, continuous improvement, and integration
 * with reports.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE100_B_IDEAS = [
  { id: 53981, title: 'Debrief Collaboration Comments', skip: false },
  { id: 53982, title: 'Debrief Export Formats', skip: false },
  { id: 53983, title: 'Debrief API Access', skip: false },
  { id: 53984, title: 'Debrief Notification Rules', skip: false },
  { id: 53985, title: 'Debrief Personalization', skip: false },
  { id: 53986, title: 'Debrief Reading Time Estimates', skip: false },
  { id: 53987, title: 'Debrief TL;DR Generation', skip: false },
  { id: 53988, title: 'Debrief Glossary Inclusion', skip: false },
  { id: 53989, title: 'Debrief Visual Design Standards', skip: false },
  { id: 53990, title: 'Debrief Accessibility Compliance', skip: false },
  { id: 53991, title: 'Debrief Translation Workflows', skip: false },
  { id: 53992, title: 'Debrief Sentiment Calibration', skip: false },
  { id: 53993, title: 'Debrief Historical Comparisons', skip: false },
  { id: 53994, title: 'Debrief Methodology Appendices', skip: false },
  { id: 53995, title: 'Debrief Finding Cross-References', skip: false },
  { id: 53996, title: 'Debrief Action Item Owners', skip: false },
  { id: 53997, title: 'Debrief SLA Tracking', skip: false },
  { id: 53998, title: 'Debrief Effectiveness Surveys', skip: false },
  { id: 53999, title: 'Debrief Continuous Improvement', skip: false },
  { id: 54000, title: 'Debrief Integration with Reports', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}

/** Idea 53981 — Debrief Collaboration Comments. Input records: {debriefId, section, comments, resolvedComments}. Section comments close only when every thread is resolved. Allows stakeholders to comment directly on debrief sections. */
export function manageDebriefCollaborationComments(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const section = String(r.section || 'section');
    const comments = num(r.comments, 0);
    const resolvedComments = Math.min(comments, num(r.resolvedComments, 0));
    const resolutionRate = rate(resolvedComments, comments);
    return { key: `${debriefId}|${section}`, debriefId, section, comments, resolvedComments, openComments: comments - resolvedComments, resolutionRate, resolved: comments > 0 && resolvedComments >= comments, status: comments > 0 && resolvedComments >= comments ? 'threads-resolved' : comments > 0 ? 'threads-open' : 'no-comments' };
  }).sort((a, b) => b.resolutionRate - a.resolutionRate || String(a.key).localeCompare(String(b.key)));
  const resolvedCount = rows.filter(r => r.resolved).length;
  return { rows, count: rows.length, resolvedCount, totalComments: rows.reduce((s, r) => s + r.comments, 0), top: rows[0] || null, summary: `Infinity AI resolved comment threads on ${resolvedCount} of ${rows.length} debrief section(s).` };
}
/** Idea 53982 — Debrief Export Formats. Input records: {debriefId, format, sectionsTotal, sectionsExported}. Exports carry every section into the requested file format intact. Exports debriefs to PDF, DOCX, Markdown, and HTML. */
export function exportDebriefFormats(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const format = String(r.format || 'pdf').toLowerCase();
    const sectionsTotal = Math.max(1, num(r.sectionsTotal, 1));
    const sectionsExported = Math.min(sectionsTotal, num(r.sectionsExported, 0));
    const exportCoverage = rate(sectionsExported, sectionsTotal);
    const supported = ['pdf', 'docx', 'markdown', 'html'].includes(format);
    return { key: `${debriefId}|${format}`, debriefId, format, sectionsTotal, sectionsExported, exportCoverage, supported, exported: supported && sectionsExported >= sectionsTotal, status: supported && sectionsExported >= sectionsTotal ? 'fully-exported' : supported ? 'partial-export' : 'format-unsupported' };
  }).sort((a, b) => b.exportCoverage - a.exportCoverage || String(a.key).localeCompare(String(b.key)));
  const exportedCount = rows.filter(r => r.exported).length;
  return { rows, count: rows.length, exportedCount, averageCoverage: mean(rows.map(r => r.exportCoverage)), top: rows[0] || null, summary: `Infinity AI fully exported ${exportedCount} of ${rows.length} debrief file(s).` };
}
/** Idea 53983 — Debrief API Access. Input records: {debriefId, apiEnabled, integrations, requestsServed}. API access lets governance tools pull debriefs without manual files. Exposes debriefs via API for integration with GRC tools. */
export function provideDebriefApiAccess(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const apiEnabled = Boolean(r.apiEnabled);
    const integrations = num(r.integrations, 0);
    const requestsServed = num(r.requestsServed, 0);
    const live = apiEnabled && integrations >= 1;
    return { key: debriefId, debriefId, apiEnabled, integrations, requestsServed, live, status: live ? 'api-live' : apiEnabled ? 'api-idle' : 'api-disabled' };
  }).sort((a, b) => b.requestsServed - a.requestsServed || String(a.key).localeCompare(String(b.key)));
  const liveCount = rows.filter(r => r.live).length;
  return { rows, count: rows.length, liveCount, totalRequests: rows.reduce((s, r) => s + r.requestsServed, 0), top: rows[0] || null, summary: `Infinity AI exposed ${liveCount} of ${rows.length} debrief(s) through live API access.` };
}
/** Idea 53984 — Debrief Notification Rules. Input records: {stakeholder, interests, debriefsPublished, notified}. Stakeholders hear only about debriefs matching their stated interests. Notifies stakeholders when debriefs matching their interests publish. */
export function applyDebriefNotificationRules(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const stakeholder = String(r.stakeholder || 'stakeholder');
    const interests = Array.isArray(r.interests) ? r.interests.map(String) : [];
    const debriefsPublished = num(r.debriefsPublished, 0);
    const notified = Math.min(debriefsPublished, num(r.notified, 0));
    const notifyRate = rate(notified, debriefsPublished);
    return { key: stakeholder, stakeholder, interests, interestCount: interests.length, debriefsPublished, notified, notifyRate, subscribed: interests.length >= 1 && notified >= 1, status: interests.length >= 1 && notified >= 1 ? 'notifications-active' : 'notifications-idle' };
  }).sort((a, b) => b.notifyRate - a.notifyRate || String(a.key).localeCompare(String(b.key)));
  const activeCount = rows.filter(r => r.subscribed).length;
  return { rows, count: rows.length, activeCount, totalNotified: rows.reduce((s, r) => s + r.notified, 0), top: rows[0] || null, summary: `Infinity AI actively notifies ${activeCount} of ${rows.length} stakeholder(s) on matching debriefs.` };
}
/** Idea 53985 — Debrief Personalization. Input records: {stakeholder, role, focusAreas, matchedAreas}. Each reader sees emphasis matched to their role and past interests. Tailors debrief emphasis to each stakeholder's role and past interests. */
export function personalizeDebriefs(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const stakeholder = String(r.stakeholder || 'stakeholder');
    const role = String(r.role || 'reader');
    const focusAreas = Array.isArray(r.focusAreas) ? r.focusAreas.map(String) : [];
    const matchedAreas = Math.min(focusAreas.length, num(r.matchedAreas, 0));
    const matchRate = rate(matchedAreas, Math.max(1, focusAreas.length));
    return { key: `${stakeholder}|${role}`, stakeholder, role, focusAreas, focusCount: focusAreas.length, matchedAreas, matchRate, tailored: focusAreas.length > 0 && matchedAreas >= focusAreas.length, status: focusAreas.length > 0 && matchedAreas >= focusAreas.length ? 'fully-tailored' : 'generic-view' };
  }).sort((a, b) => b.matchRate - a.matchRate || String(a.key).localeCompare(String(b.key)));
  const tailoredCount = rows.filter(r => r.tailored).length;
  return { rows, count: rows.length, tailoredCount, averageMatch: mean(rows.map(r => r.matchRate)), top: rows[0] || null, summary: `Infinity AI fully tailored debrief views for ${tailoredCount} of ${rows.length} stakeholder(s).` };
}
/** Idea 53986 — Debrief Reading Time Estimates. Input records: {debriefId, wordCount, wordsPerMinute}. Honest reading estimates help busy readers choose what to open. Shows estimated reading time to encourage consumption. */
export function estimateDebriefReadingTime(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const wordCount = num(r.wordCount, 0);
    const wordsPerMinute = Math.max(50, num(r.wordsPerMinute, 200));
    const minutes = round2(wordCount / wordsPerMinute);
    return { key: debriefId, debriefId, wordCount, wordsPerMinute, minutes, quickRead: minutes <= 5, status: minutes <= 5 ? 'quick-read' : minutes <= 15 ? 'standard-read' : 'long-read' };
  }).sort((a, b) => a.minutes - b.minutes || String(a.key).localeCompare(String(b.key)));
  const quickCount = rows.filter(r => r.quickRead).length;
  return { rows, count: rows.length, quickCount, averageMinutes: mean(rows.map(r => r.minutes)), top: rows[0] || null, summary: `Infinity AI estimated reading time for ${rows.length} debrief(s); ${quickCount} are quick reads.` };
}
/** Idea 53987 — Debrief TL;DR Generation. Input records: {debriefId, wordCount, summaryWords, keyPoints}. A TL;DR is useful only when it is far shorter than the full debrief. Generates ultra-short summaries for busy executives. */
export function generateDebriefTldr(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const wordCount = Math.max(1, num(r.wordCount, 1));
    const summaryWords = num(r.summaryWords, 0);
    const keyPoints = num(r.keyPoints, 0);
    const compression = round2(summaryWords / wordCount);
    const concise = summaryWords > 0 && compression <= 0.1 && keyPoints >= 1;
    return { key: debriefId, debriefId, wordCount, summaryWords, keyPoints, compression, concise, status: concise ? 'tldr-ready' : 'summary-too-long' };
  }).sort((a, b) => a.compression - b.compression || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.concise).length;
  return { rows, count: rows.length, readyCount, top: rows[0] || null, summary: `Infinity AI generated ready summaries for ${readyCount} of ${rows.length} debrief(s).` };
}
/** Idea 53988 — Debrief Glossary Inclusion. Input records: {debriefId, technicalTerms, glossaryTerms}. Every technical term in a debrief is defined in its glossary. Auto-includes glossaries for non-technical readers. */
export function includeDebriefGlossary(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const technicalTerms = Math.max(1, num(r.technicalTerms, 1));
    const glossaryTerms = Math.min(technicalTerms, num(r.glossaryTerms, 0));
    const glossaryCoverage = rate(glossaryTerms, technicalTerms);
    return { key: debriefId, debriefId, technicalTerms, glossaryTerms, glossaryCoverage, complete: glossaryTerms >= technicalTerms, status: glossaryTerms >= technicalTerms ? 'glossary-complete' : 'glossary-gaps' };
  }).sort((a, b) => b.glossaryCoverage - a.glossaryCoverage || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, averageCoverage: mean(rows.map(r => r.glossaryCoverage)), top: rows[0] || null, summary: `Infinity AI completed glossaries for ${completeCount} of ${rows.length} debrief(s).` };
}
/** Idea 53989 — Debrief Visual Design Standards. Input records: {debriefId, checksTotal, checksPassed}. Consistent visual standards keep every debrief looking professional. Enforces consistent, professional visual design across debriefs. */
export function enforceDebriefVisualStandards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const checksTotal = Math.max(1, num(r.checksTotal, 1));
    const checksPassed = Math.min(checksTotal, num(r.checksPassed, 0));
    const passRate = rate(checksPassed, checksTotal);
    return { key: debriefId, debriefId, checksTotal, checksPassed, checksFailed: checksTotal - checksPassed, passRate, compliant: checksPassed >= checksTotal, status: checksPassed >= checksTotal ? 'design-compliant' : 'design-violations' };
  }).sort((a, b) => b.passRate - a.passRate || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  return { rows, count: rows.length, compliantCount, top: rows[0] || null, summary: `Infinity AI passed visual standards on ${compliantCount} of ${rows.length} debrief(s).` };
}
/** Idea 53990 — Debrief Accessibility Compliance. Input records: {debriefId, checksTotal, checksPassed, screenReaderSafe}. Debriefs are compliant only when every check passes and reading tools work. Ensures debriefs meet accessibility standards. */
export function auditDebriefAccessibilityCompliance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const checksTotal = Math.max(1, num(r.checksTotal, 1));
    const checksPassed = Math.min(checksTotal, num(r.checksPassed, 0));
    const screenReaderSafe = Boolean(r.screenReaderSafe);
    const passRate = rate(checksPassed, checksTotal);
    const compliant = checksPassed >= checksTotal && screenReaderSafe;
    return { key: debriefId, debriefId, checksTotal, checksPassed, screenReaderSafe, passRate, compliant, status: compliant ? 'accessibility-compliant' : 'accessibility-barriers' };
  }).sort((a, b) => b.passRate - a.passRate || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  return { rows, count: rows.length, compliantCount, top: rows[0] || null, summary: `Infinity AI made ${compliantCount} of ${rows.length} debrief(s) fully accessibility compliant.` };
}
/** Idea 53991 — Debrief Translation Workflows. Input records: {debriefId, language, machineTranslated, humanReviewed}. Machine translation ships only after a human reviewer signs off. Manages human review of machine-translated debriefs. */
export function runDebriefTranslationWorkflows(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const language = String(r.language || 'en').toLowerCase();
    const machineTranslated = Boolean(r.machineTranslated);
    const humanReviewed = Boolean(r.humanReviewed);
    const approved = machineTranslated && humanReviewed;
    return { key: `${debriefId}|${language}`, debriefId, language, machineTranslated, humanReviewed, approved, status: approved ? 'translation-approved' : machineTranslated ? 'awaiting-human-review' : 'not-translated' };
  }).sort((a, b) => Number(b.approved) - Number(a.approved) || String(a.key).localeCompare(String(b.key)));
  const approvedCount = rows.filter(r => r.approved).length;
  return { rows, count: rows.length, approvedCount, awaitingCount: rows.filter(r => r.status === 'awaiting-human-review').length, top: rows[0] || null, summary: `Infinity AI approved ${approvedCount} of ${rows.length} translated debrief(s) after human review.` };
}
/** Idea 53992 — Debrief Sentiment Calibration. Input records: {debriefId, alarmScore, informScore}. Calibrated tone informs stakeholders without alarming them needlessly. Calibrates tone so debriefs inform without alarming unnecessarily. */
export function calibrateDebriefSentiment(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const alarmScore = round2(clamp01(r.alarmScore));
    const informScore = round2(clamp01(r.informScore));
    const balanced = informScore >= 0.7 && alarmScore <= 0.4;
    return { key: debriefId, debriefId, alarmScore, informScore, balance: round2(informScore - alarmScore), balanced, status: balanced ? 'tone-balanced' : alarmScore > 0.4 ? 'over-alarming' : 'under-informing' };
  }).sort((a, b) => b.balance - a.balance || String(a.key).localeCompare(String(b.key)));
  const balancedCount = rows.filter(r => r.balanced).length;
  return { rows, count: rows.length, balancedCount, averageBalance: mean(rows.map(r => r.balance)), top: rows[0] || null, summary: `Infinity AI balanced tone on ${balancedCount} of ${rows.length} debrief(s).` };
}
/** Idea 53993 — Debrief Historical Comparisons. Input records: {target, currentFindings, historicalAverage, huntsCompared}. History shows whether this hunt improved on the target record. Charts current results against the target's hunt history. */
export function compareDebriefHistorical(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const currentFindings = num(r.currentFindings, 0);
    const historicalAverage = num(r.historicalAverage, 0);
    const huntsCompared = num(r.huntsCompared, 0);
    const delta = round2(currentFindings - historicalAverage);
    const improved = currentFindings > historicalAverage && huntsCompared >= 2;
    return { key: target, target, currentFindings, historicalAverage, huntsCompared, delta, improved, status: improved ? 'ahead-of-history' : huntsCompared < 2 ? 'thin-history' : 'at-or-below-history' };
  }).sort((a, b) => b.delta - a.delta || String(a.key).localeCompare(String(b.key)));
  const improvedCount = rows.filter(r => r.improved).length;
  return { rows, count: rows.length, improvedCount, top: rows[0] || null, summary: `Infinity AI compared ${rows.length} target(s) with hunt history; ${improvedCount} are ahead of history.` };
}
/** Idea 53994 — Debrief Methodology Appendices. Input records: {huntId, methodologySections, requiredSections}. Technical readers get the full method in an appendix, not the main text. Appends detailed methodology for technical audiences. */
export function appendDebriefMethodology(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || 'hunt');
    const requiredSections = Math.max(1, num(r.requiredSections, 1));
    const methodologySections = Math.min(requiredSections, num(r.methodologySections, 0));
    const appendixCoverage = rate(methodologySections, requiredSections);
    return { key: huntId, huntId, methodologySections, requiredSections, appendixCoverage, appended: methodologySections >= requiredSections, status: methodologySections >= requiredSections ? 'appendix-complete' : 'appendix-partial' };
  }).sort((a, b) => b.appendixCoverage - a.appendixCoverage || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.appended).length;
  return { rows, count: rows.length, completeCount, averageCoverage: mean(rows.map(r => r.appendixCoverage)), top: rows[0] || null, summary: `Infinity AI completed methodology appendices for ${completeCount} of ${rows.length} hunt(s).` };
}
/** Idea 53995 — Debrief Finding Cross-References. Input records: {findingId, target, pastReports, linkedReports}. Cross-references connect a finding to every past report on the target. Cross-references findings with past reports on the same target. */
export function crossReferenceDebriefFindings(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const findingId = String(r.findingId || 'finding');
    const target = String(r.target || 'target');
    const pastReports = Math.max(1, num(r.pastReports, 1));
    const linkedReports = Math.min(pastReports, num(r.linkedReports, 0));
    const linkCoverage = rate(linkedReports, pastReports);
    return { key: `${findingId}|${target}`, findingId, target, pastReports, linkedReports, linkCoverage, linked: linkedReports >= pastReports, status: linkedReports >= pastReports ? 'fully-referenced' : 'references-missing' };
  }).sort((a, b) => b.linkCoverage - a.linkCoverage || String(a.key).localeCompare(String(b.key)));
  const linkedCount = rows.filter(r => r.linked).length;
  return { rows, count: rows.length, linkedCount, totalPastReports: rows.reduce((s, r) => s + r.pastReports, 0), top: rows[0] || null, summary: `Infinity AI fully cross-referenced ${linkedCount} of ${rows.length} finding(s) with past reports.` };
}
/** Idea 53996 — Debrief Action Item Owners. Input records: {debriefId, actionItems, assignedOwners}. Every action item needs a named owner before the debrief ships. Assigns owners to each debrief action item automatically. */
export function assignDebriefActionItemOwners(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const actionItems = num(r.actionItems, 0);
    const assignedOwners = Math.min(actionItems, num(r.assignedOwners, 0));
    const ownershipRate = rate(assignedOwners, actionItems);
    return { key: debriefId, debriefId, actionItems, assignedOwners, unowned: actionItems - assignedOwners, ownershipRate, owned: actionItems > 0 && assignedOwners >= actionItems, status: actionItems > 0 && assignedOwners >= actionItems ? 'fully-owned' : 'owners-missing' };
  }).sort((a, b) => b.ownershipRate - a.ownershipRate || String(a.key).localeCompare(String(b.key)));
  const ownedCount = rows.filter(r => r.owned).length;
  return { rows, count: rows.length, ownedCount, totalItems: rows.reduce((s, r) => s + r.actionItems, 0), top: rows[0] || null, summary: `Infinity AI assigned owners for every action item in ${ownedCount} of ${rows.length} debrief(s).` };
}
/** Idea 53997 — Debrief SLA Tracking. Input records: {debriefId, promisedHours, deliveredHours}. Delivery is on time only when it lands inside the promised window. Tracks debrief delivery against promised timelines. */
export function trackDebriefSla(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const promisedHours = Math.max(1, num(r.promisedHours, 1));
    const deliveredHours = num(r.deliveredHours, 0);
    const onTime = deliveredHours > 0 && deliveredHours <= promisedHours;
    return { key: debriefId, debriefId, promisedHours, deliveredHours, slackHours: round2(promisedHours - deliveredHours), onTime, breached: deliveredHours > promisedHours, status: onTime ? 'sla-met' : deliveredHours > promisedHours ? 'sla-breached' : 'sla-pending' };
  }).sort((a, b) => a.deliveredHours - b.deliveredHours || String(a.key).localeCompare(String(b.key)));
  const metCount = rows.filter(r => r.onTime).length;
  return { rows, count: rows.length, metCount, breachedCount: rows.filter(r => r.breached).length, top: rows[0] || null, summary: `Infinity AI met the delivery timeline on ${metCount} of ${rows.length} debrief(s).` };
}
/** Idea 53998 — Debrief Effectiveness Surveys. Input records: {debriefId, responses, averageValueScore}. Surveys measure whether stakeholders found the debrief valuable. Surveys stakeholders on debrief value quarterly. */
export function surveyDebriefEffectiveness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const responses = num(r.responses, 0);
    const averageValueScore = round2(Math.min(5, Math.max(0, num(r.averageValueScore ?? r.valueScore, 0))));
    const valued = averageValueScore >= 4 && responses >= 3;
    return { key: debriefId, debriefId, responses, averageValueScore, valued, status: valued ? 'highly-valued' : responses > 0 ? 'surveyed' : 'unsurveyed' };
  }).sort((a, b) => b.averageValueScore - a.averageValueScore || b.responses - a.responses || String(a.key).localeCompare(String(b.key)));
  const valuedCount = rows.filter(r => r.valued).length;
  return { rows, count: rows.length, valuedCount, totalResponses: rows.reduce((s, r) => s + r.responses, 0), averageScore: mean(rows.map(r => r.averageValueScore)), top: rows[0] || null, summary: `Infinity AI surveyed effectiveness on ${rows.length} debrief(s); ${valuedCount} are highly valued.` };
}
/** Idea 53999 — Debrief Continuous Improvement. Input records: {templateId, surveyIssues, improvementsShipped}. Survey complaints become shipped template improvements, closing the loop. Feeds survey results into debrief template improvements. */
export function driveDebriefContinuousImprovement(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const templateId = String(r.templateId || 'template');
    const surveyIssues = num(r.surveyIssues, 0);
    const improvementsShipped = Math.min(surveyIssues, num(r.improvementsShipped, 0));
    const improvementRate = rate(improvementsShipped, surveyIssues);
    return { key: templateId, templateId, surveyIssues, improvementsShipped, openIssues: surveyIssues - improvementsShipped, improvementRate, improved: surveyIssues > 0 && improvementsShipped >= surveyIssues, status: surveyIssues > 0 && improvementsShipped >= surveyIssues ? 'loop-closed' : surveyIssues > 0 ? 'improving' : 'no-survey-input' };
  }).sort((a, b) => b.improvementRate - a.improvementRate || String(a.key).localeCompare(String(b.key)));
  const closedCount = rows.filter(r => r.improved).length;
  return { rows, count: rows.length, closedCount, totalShipped: rows.reduce((s, r) => s + r.improvementsShipped, 0), top: rows[0] || null, summary: `Infinity AI closed the improvement loop on ${closedCount} of ${rows.length} debrief template(s).` };
}
/** Idea 54000 — Debrief Integration with Reports. Input records: {debriefId, findingsCount, linkedReports}. Debriefs link back to the formal reports they summarize, both ways. Links debriefs to the formal finding reports they summarize. */
export function integrateDebriefWithReports(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const findingsCount = Math.max(1, num(r.findingsCount, 1));
    const linkedReports = Math.min(findingsCount, num(r.linkedReports, 0));
    const linkCoverage = rate(linkedReports, findingsCount);
    return { key: debriefId, debriefId, findingsCount, linkedReports, linkCoverage, integrated: linkedReports >= findingsCount, status: linkedReports >= findingsCount ? 'reports-integrated' : 'reports-unlinked' };
  }).sort((a, b) => b.linkCoverage - a.linkCoverage || String(a.key).localeCompare(String(b.key)));
  const integratedCount = rows.filter(r => r.integrated).length;
  return { rows, count: rows.length, integratedCount, totalLinked: rows.reduce((s, r) => s + r.linkedReports, 0), top: rows[0] || null, summary: `Infinity AI integrated ${integratedCount} of ${rows.length} debrief(s) with their formal reports.` };
}
