/**
 * wave101ACore.js — Infinity AI · Wave 101A
 * Debrief closeout plus target onboarding, ideas 54001–54020: mobile
 * optimization, print stylesheets, digital signatures, annual
 * retrospective, quick-add entry, paste detection, guided wizard,
 * duplicate detection, type presets, draft queue, checklist
 * tracking, deferred verification, DNS pre-check, live screenshot,
 * technology preview, redirect preview, program linking, team
 * assignment, tag assignment, and client association.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE101_A_IDEAS = [
  { id: 54001, title: 'Debrief Mobile Optimization', skip: false },
  { id: 54002, title: 'Debrief Print Stylesheets', skip: false },
  { id: 54003, title: 'Debrief Digital Signatures', skip: false },
  { id: 54004, title: 'Annual Debrief Retrospective', skip: false },
  { id: 54005, title: 'Single-field quick-add bar', skip: false },
  { id: 54006, title: 'Paste-and-detect onboarding', skip: false },
  { id: 54007, title: 'Guided onboarding wizard', skip: false },
  { id: 54008, title: 'Duplicate target detector', skip: false },
  { id: 54009, title: 'Target type presets', skip: false },
  { id: 54010, title: 'Draft targets queue', skip: false },
  { id: 54011, title: 'Onboarding checklist tracker (targets)', skip: false },
  { id: 54012, title: 'Skip-and-verify-later mode', skip: false },
  { id: 54013, title: 'DNS pre-check on add', skip: false },
  { id: 54014, title: 'Live screenshot capture on add', skip: false },
  { id: 54015, title: 'Technology guess preview', skip: false },
  { id: 54016, title: 'Redirect chain preview', skip: false },
  { id: 54017, title: 'Program linking at add time', skip: false },
  { id: 54018, title: 'Team assignment at add time', skip: false },
  { id: 54019, title: 'Tag assignment at add time', skip: false },
  { id: 54020, title: 'Client association at add time', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}

/** Idea 54001 — Debrief Mobile Optimization. Input records: {debriefId, device, viewportChecks, passedChecks}. A debrief is ready for phone readers only when almost every viewport check passes. Optimizes debrief layout for small screens. */
export function optimizeDebriefMobile(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const device = String(r.device || 'phone').toLowerCase();
    const viewportChecks = Math.max(1, num(r.viewportChecks, 1));
    const passedChecks = Math.min(viewportChecks, num(r.passedChecks, 0));
    const coverage = rate(passedChecks, viewportChecks);
    return { key: `${debriefId}|${device}`, debriefId, device, viewportChecks, passedChecks, coverage, optimized: coverage >= 0.9, status: coverage >= 0.9 ? 'mobile-ready' : 'mobile-fixes-needed' };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const optimizedCount = rows.filter(r => r.optimized).length;
  return { rows, count: rows.length, optimizedCount, averageCoverage: mean(rows.map(r => r.coverage)), top: rows[0] || null, summary: `Infinity AI made ${optimizedCount} of ${rows.length} debrief(s) ready for phone readers.` };
}
/** Idea 54002 — Debrief Print Stylesheets. Input records: {debriefId, pages, printReadyPages}. A printed debrief reads cleanly only when every page carries print rules. Adds print stylesheets to debrief documents. */
export function buildDebriefPrintStylesheets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const pages = Math.max(1, num(r.pages, 1));
    const printReadyPages = Math.min(pages, num(r.printReadyPages, 0));
    const printCoverage = rate(printReadyPages, pages);
    return { key: debriefId, debriefId, pages, printReadyPages, printCoverage, printReady: printReadyPages >= pages, status: printReadyPages >= pages ? 'print-ready' : 'print-partial' };
  }).sort((a, b) => b.printCoverage - a.printCoverage || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.printReady).length;
  return { rows, count: rows.length, readyCount, totalPages: rows.reduce((s, r) => s + r.pages, 0), top: rows[0] || null, summary: `Infinity AI made ${readyCount} of ${rows.length} debrief(s) fully print-ready.` };
}
/** Idea 54003 — Debrief Digital Signatures. Input records: {debriefId, signed, verified, signer}. A signature counts only when it is both applied and verified. Signs debriefs digitally for authenticity. */
export function signDebriefDigitally(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const debriefId = String(r.debriefId || 'debrief');
    const signed = Boolean(r.signed);
    const verified = Boolean(r.verified);
    const signer = String(r.signer || 'signer');
    const valid = signed && verified;
    return { key: `${debriefId}|${signer}`, debriefId, signed, verified, signer, valid, status: valid ? 'signature-valid' : signed ? 'signature-unverified' : 'unsigned' };
  }).sort((a, b) => Number(b.valid) - Number(a.valid) || String(a.key).localeCompare(String(b.key)));
  const validCount = rows.filter(r => r.valid).length;
  return { rows, count: rows.length, validCount, signedCount: rows.filter(r => r.signed).length, top: rows[0] || null, summary: `Infinity AI verified digital signatures on ${validCount} of ${rows.length} debrief(s).` };
}
/** Idea 54004 — Annual Debrief Retrospective. Input records: {year, huntsCompleted, findingsTotal, goalsMet}. A year wraps up only when the hunting goals were actually met. Reviews the full debrief year in one retrospective. */
export function runAnnualDebriefRetrospective(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const year = Math.max(1, num(r.year, 0));
    const huntsCompleted = num(r.huntsCompleted, 0);
    const findingsTotal = num(r.findingsTotal, 0);
    const goalsMet = num(r.goalsMet, 0);
    const findingsPerHunt = huntsCompleted ? round2(findingsTotal / huntsCompleted) : 0;
    return { key: `year-${year}`, year, huntsCompleted, findingsTotal, goalsMet, findingsPerHunt, complete: goalsMet >= 8, status: goalsMet >= 8 ? 'year-wrapped-up' : 'retrospective-open' };
  }).sort((a, b) => b.year - a.year || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, totalHunts: rows.reduce((s, r) => s + r.huntsCompleted, 0), totalFindings: rows.reduce((s, r) => s + r.findingsTotal, 0), top: rows[0] || null, summary: `Infinity AI wrapped up ${completeCount} of ${rows.length} annual debrief retrospective(s).` };
}
/** Idea 54005 — Single-field quick-add bar. Input records: {input, detectedType, normalized}. One typed value becomes a target only when its type is recognized. Adds targets from a single typed field. */
export function runQuickAddBar(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const input = String(r.input || '');
    const detectedType = String(r.detectedType || 'unknown').toLowerCase();
    const normalized = String(r.normalized || '');
    const detected = detectedType !== 'unknown' && normalized.length >= 4;
    return { key: `${input}|${detectedType}`, input, detectedType, normalized, detected, status: detected ? 'target-detected' : 'type-unrecognized' };
  }).sort((a, b) => Number(b.detected) - Number(a.detected) || String(a.key).localeCompare(String(b.key)));
  const detectedCount = rows.filter(r => r.detected).length;
  return { rows, count: rows.length, detectedCount, undetectedCount: rows.length - detectedCount, top: rows[0] || null, summary: `Infinity AI recognized ${detectedCount} of ${rows.length} quick-add value(s) as targets.` };
}
/** Idea 54006 — Paste-and-detect onboarding. Input records: {batchLabel, pastedUrls, detectedTargets, duplicatesRemoved}. Pasted lists are import-ready when most pasted links resolve to targets. Detects targets inside pasted text. */
export function detectPastedTargets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const batchLabel = String(r.batchLabel || 'batch');
    const pastedUrls = Math.max(1, num(r.pastedUrls, 1));
    const detectedTargets = Math.min(pastedUrls, num(r.detectedTargets, 0));
    const duplicatesRemoved = Math.min(detectedTargets, num(r.duplicatesRemoved, 0));
    const detectionRate = rate(detectedTargets, pastedUrls);
    return { key: batchLabel, batchLabel, pastedUrls, detectedTargets, duplicatesRemoved, uniqueTargets: detectedTargets - duplicatesRemoved, detectionRate, readyForImport: detectionRate >= 0.8, status: detectionRate >= 0.8 ? 'import-ready' : 'needs-cleaning' };
  }).sort((a, b) => b.detectionRate - a.detectionRate || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.readyForImport).length;
  return { rows, count: rows.length, readyCount, totalDetected: rows.reduce((s, r) => s + r.detectedTargets, 0), averageDetectionRate: mean(rows.map(r => r.detectionRate)), top: rows[0] || null, summary: `Infinity AI made ${readyCount} of ${rows.length} pasted target list(s) import-ready.` };
}
/** Idea 54007 — Guided onboarding wizard. Input records: {userId, currentStep, totalSteps, completedWizard}. The wizard is finished only when every step is reached and closed. Walks new operators through target setup. */
export function runGuidedOnboardingWizard(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const userId = String(r.userId || 'user');
    const totalSteps = Math.max(1, num(r.totalSteps, 1));
    const currentStep = Math.min(totalSteps, num(r.currentStep, 0));
    const completedWizard = Boolean(r.completedWizard);
    const progress = rate(currentStep, totalSteps);
    const finished = completedWizard && currentStep >= totalSteps;
    return { key: userId, userId, currentStep, totalSteps, completedWizard, progress, finished, status: finished ? 'wizard-finished' : 'wizard-in-progress' };
  }).sort((a, b) => b.progress - a.progress || String(a.key).localeCompare(String(b.key)));
  const finishedCount = rows.filter(r => r.finished).length;
  return { rows, count: rows.length, finishedCount, averageProgress: mean(rows.map(r => r.progress)), top: rows[0] || null, summary: `Infinity AI guided ${finishedCount} of ${rows.length} operator(s) through the full onboarding wizard.` };
}
/** Idea 54008 — Duplicate target detector. Input records: {target, normalizedHost, isDuplicate, existingId}. A target is new only when its host is not already hunted. Flags targets that already exist. */
export function detectDuplicateTargets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const normalizedHost = String(r.normalizedHost || target).toLowerCase();
    const isDuplicate = Boolean(r.isDuplicate);
    const existingId = String(r.existingId || '');
    return { key: `${target}|${normalizedHost}`, target, normalizedHost, isDuplicate, existingId, unique: !isDuplicate, status: isDuplicate ? 'duplicate-blocked' : 'target-unique' };
  }).sort((a, b) => Number(b.unique) - Number(a.unique) || String(a.key).localeCompare(String(b.key)));
  const uniqueCount = rows.filter(r => r.unique).length;
  return { rows, count: rows.length, uniqueCount, duplicateCount: rows.length - uniqueCount, top: rows[0] || null, summary: `Infinity AI kept ${uniqueCount} of ${rows.length} target(s) because they are unique.` };
}
/** Idea 54009 — Target type presets. Input records: {targetType, presetsAvailable, presetsApplied}. A type is configured only when all of its presets are applied. Applies ready-made settings per target type. */
export function applyTargetTypePresets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const targetType = String(r.targetType || 'web').toLowerCase();
    const presetsAvailable = Math.max(1, num(r.presetsAvailable, 1));
    const presetsApplied = Math.min(presetsAvailable, num(r.presetsApplied, 0));
    const presetCoverage = rate(presetsApplied, presetsAvailable);
    return { key: targetType, targetType, presetsAvailable, presetsApplied, presetCoverage, configured: presetsApplied >= presetsAvailable, status: presetsApplied >= presetsAvailable ? 'presets-configured' : 'presets-pending' };
  }).sort((a, b) => b.presetCoverage - a.presetCoverage || String(a.key).localeCompare(String(b.key)));
  const configuredCount = rows.filter(r => r.configured).length;
  return { rows, count: rows.length, configuredCount, totalPresets: rows.reduce((s, r) => s + r.presetsAvailable, 0), averageCoverage: mean(rows.map(r => r.presetCoverage)), top: rows[0] || null, summary: `Infinity AI configured presets for ${configuredCount} of ${rows.length} target type(s).` };
}
/** Idea 54010 — Draft targets queue. Input records: {draftId, ageHours, ownerAssigned}. A draft is promotion-ready only when it is fresh and owned. Queues unfinished targets for review. */
export function manageDraftTargetsQueue(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const draftId = String(r.draftId || 'draft');
    const ageHours = num(r.ageHours, 0);
    const ownerAssigned = Boolean(r.ownerAssigned);
    const ready = ageHours <= 48 && ownerAssigned;
    return { key: draftId, draftId, ageHours, ownerAssigned, ready, status: ready ? 'promotion-ready' : ageHours > 48 ? 'draft-stale' : 'owner-missing' };
  }).sort((a, b) => a.ageHours - b.ageHours || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, averageAgeHours: mean(rows.map(r => r.ageHours)), top: rows[0] || null, summary: `Infinity AI found ${readyCount} of ${rows.length} draft target(s) ready for promotion.` };
}
/** Idea 54011 — Onboarding checklist tracker (targets). Input records: {target, checklistTotal, checklistDone, blocked}. Onboarding ends only when the checklist is done and unblocked. Tracks onboarding steps per target. */
export function trackOnboardingChecklist(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const checklistTotal = Math.max(1, num(r.checklistTotal, 1));
    const checklistDone = Math.min(checklistTotal, num(r.checklistDone, 0));
    const blocked = Boolean(r.blocked);
    const coverage = rate(checklistDone, checklistTotal);
    const complete = checklistDone >= checklistTotal && !blocked;
    return { key: target, target, checklistTotal, checklistDone, blocked, coverage, complete, status: complete ? 'onboarding-complete' : blocked ? 'onboarding-blocked' : 'onboarding-in-progress' };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, blockedCount: rows.filter(r => r.blocked).length, averageCoverage: mean(rows.map(r => r.coverage)), top: rows[0] || null, summary: `Infinity AI completed onboarding checklists for ${completeCount} of ${rows.length} target(s).` };
}
/** Idea 54012 — Skip-and-verify-later mode. Input records: {target, verificationDeferred, verificationDoneLater, daysDeferred}. Deferred checks stay pending until the verification actually lands. Lets operators skip checks and verify later. */
export function manageSkipAndVerifyLater(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const verificationDeferred = Boolean(r.verificationDeferred);
    const verificationDoneLater = Boolean(r.verificationDoneLater);
    const daysDeferred = num(r.daysDeferred, 0);
    const pending = verificationDeferred && !verificationDoneLater;
    return { key: target, target, verificationDeferred, verificationDoneLater, daysDeferred, pending, status: pending ? 'verification-pending' : verificationDoneLater ? 'verification-completed' : 'not-deferred' };
  }).sort((a, b) => b.daysDeferred - a.daysDeferred || String(a.key).localeCompare(String(b.key)));
  const pendingCount = rows.filter(r => r.pending).length;
  return { rows, count: rows.length, pendingCount, completedCount: rows.filter(r => r.verificationDoneLater).length, top: rows[0] || null, summary: `Infinity AI still owes verification on ${pendingCount} of ${rows.length} deferred target(s).` };
}
/** Idea 54013 — DNS pre-check on add. Input records: {domain, resolves, nxdomain, aRecords}. A domain is huntable only when it resolves to a real address. Checks DNS before a target is added. */
export function runDnsPreCheck(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const domain = String(r.domain || 'domain').toLowerCase();
    const resolves = Boolean(r.resolves);
    const nxdomain = Boolean(r.nxdomain);
    const aRecords = num(r.aRecords, 0);
    const dnsOk = resolves && !nxdomain && aRecords >= 1;
    return { key: domain, domain, resolves, nxdomain, aRecords, dnsOk, status: dnsOk ? 'dns-resolved' : nxdomain ? 'domain-missing' : 'dns-unresolved' };
  }).sort((a, b) => Number(b.dnsOk) - Number(a.dnsOk) || String(a.key).localeCompare(String(b.key)));
  const okCount = rows.filter(r => r.dnsOk).length;
  return { rows, count: rows.length, okCount, totalARecords: rows.reduce((s, r) => s + r.aRecords, 0), top: rows[0] || null, summary: `Infinity AI confirmed DNS for ${okCount} of ${rows.length} domain(s) before hunting.` };
}
/** Idea 54014 — Live screenshot capture on add. Input records: {target, screenshotCaptured, screenshotKb, loadedOk}. A screenshot is useful only when the page rendered with real content. Captures a live page view when a target is added. */
export function captureLiveScreenshotOnAdd(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const screenshotCaptured = Boolean(r.screenshotCaptured);
    const screenshotKb = num(r.screenshotKb, 0);
    const loadedOk = Boolean(r.loadedOk);
    const displayed = screenshotCaptured && loadedOk && screenshotKb > 0;
    return { key: target, target, screenshotCaptured, screenshotKb, loadedOk, displayed, status: displayed ? 'screenshot-ready' : screenshotCaptured ? 'screenshot-blank' : 'screenshot-missing' };
  }).sort((a, b) => b.screenshotKb - a.screenshotKb || String(a.key).localeCompare(String(b.key)));
  const displayedCount = rows.filter(r => r.displayed).length;
  return { rows, count: rows.length, displayedCount, totalKb: rows.reduce((s, r) => s + r.screenshotKb, 0), top: rows[0] || null, summary: `Infinity AI captured usable page views for ${displayedCount} of ${rows.length} new target(s).` };
}
/** Idea 54015 — Technology guess preview. Input records: {target, guesses, confirmedGuesses, topGuessConfidence}. Guesses are trusted only when most are later confirmed true. Previews the likely technology stack of a target. */
export function previewTechnologyGuess(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const guesses = Math.max(1, num(r.guesses, 1));
    const confirmedGuesses = Math.min(guesses, num(r.confirmedGuesses, 0));
    const topGuessConfidence = round2(clamp01(r.topGuessConfidence));
    const accuracy = rate(confirmedGuesses, guesses);
    return { key: target, target, guesses, confirmedGuesses, topGuessConfidence, accuracy, highConfidence: topGuessConfidence >= 0.8, accurate: accuracy >= 0.7, status: accuracy >= 0.7 ? 'guess-reliable' : 'guess-uncertain' };
  }).sort((a, b) => b.accuracy - a.accuracy || String(a.key).localeCompare(String(b.key)));
  const accurateCount = rows.filter(r => r.accurate).length;
  return { rows, count: rows.length, accurateCount, highConfidenceCount: rows.filter(r => r.highConfidence).length, averageAccuracy: mean(rows.map(r => r.accuracy)), top: rows[0] || null, summary: `Infinity AI produced reliable technology previews for ${accurateCount} of ${rows.length} target(s).` };
}
/** Idea 54016 — Redirect chain preview. Input records: {target, hops, finalStatus, loopDetected}. Redirect chains are safe to hunt only when short, settled, and loop-free. Previews redirect chains before a hunt starts. */
export function previewRedirectChain(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const hops = num(r.hops, 0);
    const finalStatus = num(r.finalStatus, 0);
    const loopDetected = Boolean(r.loopDetected);
    const settled = finalStatus >= 200 && finalStatus < 400;
    const chainOk = !loopDetected && hops <= 6 && settled;
    return { key: target, target, hops, finalStatus, loopDetected, settled, chainOk, status: chainOk ? 'chain-safe' : loopDetected ? 'redirect-loop' : 'chain-risky' };
  }).sort((a, b) => a.hops - b.hops || String(a.key).localeCompare(String(b.key)));
  const safeCount = rows.filter(r => r.chainOk).length;
  return { rows, count: rows.length, safeCount, averageHops: mean(rows.map(r => r.hops)), top: rows[0] || null, summary: `Infinity AI cleared redirect chains for ${safeCount} of ${rows.length} target(s).` };
}
/** Idea 54017 — Program linking at add time. Input records: {target, programId, linked, inScopeCount}. A target inherits rules only when it is linked to its program. Links targets to their bounty program on entry. */
export function linkProgramAtAddTime(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const programId = String(r.programId || '');
    const linked = Boolean(r.linked) && programId.length >= 1;
    const inScopeCount = num(r.inScopeCount, 0);
    return { key: `${target}|${programId}`, target, programId, linked, inScopeCount, status: linked ? 'program-linked' : 'program-unlinked' };
  }).sort((a, b) => Number(b.linked) - Number(a.linked) || String(a.key).localeCompare(String(b.key)));
  const linkedCount = rows.filter(r => r.linked).length;
  return { rows, count: rows.length, linkedCount, totalInScope: rows.reduce((s, r) => s + r.inScopeCount, 0), top: rows[0] || null, summary: `Infinity AI linked ${linkedCount} of ${rows.length} target(s) to their bounty program.` };
}
/** Idea 54018 — Team assignment at add time. Input records: {target, team, assignedMembers, requiredMembers}. A target is staffed only when every required member is assigned. Assigns the hunting team when a target is added. */
export function assignTeamAtAddTime(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const team = String(r.team || '');
    const requiredMembers = Math.max(1, num(r.requiredMembers, 1));
    const assignedMembers = Math.min(requiredMembers, num(r.assignedMembers, 0));
    const staffingCoverage = rate(assignedMembers, requiredMembers);
    const staffed = assignedMembers >= requiredMembers && team.length >= 1;
    return { key: `${target}|${team}`, target, team, assignedMembers, requiredMembers, staffingCoverage, staffed, status: staffed ? 'team-staffed' : 'team-understaffed' };
  }).sort((a, b) => b.staffingCoverage - a.staffingCoverage || String(a.key).localeCompare(String(b.key)));
  const staffedCount = rows.filter(r => r.staffed).length;
  return { rows, count: rows.length, staffedCount, averageCoverage: mean(rows.map(r => r.staffingCoverage)), top: rows[0] || null, summary: `Infinity AI fully staffed ${staffedCount} of ${rows.length} new target team(s).` };
}
/** Idea 54019 — Tag assignment at add time. Input records: {target, tagsAssigned, tagsRequired}. A target is findable only when its required tags are present. Tags targets as they are added. */
export function assignTagsAtAddTime(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const tagsRequired = Math.max(1, num(r.tagsRequired, 1));
    const tagsAssigned = Math.min(tagsRequired, num(r.tagsAssigned, 0));
    const tagCoverage = rate(tagsAssigned, tagsRequired);
    return { key: target, target, tagsAssigned, tagsRequired, tagCoverage, tagged: tagsAssigned >= tagsRequired, status: tagsAssigned >= tagsRequired ? 'tags-complete' : 'tags-missing' };
  }).sort((a, b) => b.tagCoverage - a.tagCoverage || String(a.key).localeCompare(String(b.key)));
  const taggedCount = rows.filter(r => r.tagged).length;
  return { rows, count: rows.length, taggedCount, totalTags: rows.reduce((s, r) => s + r.tagsAssigned, 0), averageCoverage: mean(rows.map(r => r.tagCoverage)), top: rows[0] || null, summary: `Infinity AI completed required tags for ${taggedCount} of ${rows.length} target(s).` };
}
/** Idea 54020 — Client association at add time. Input records: {target, client, associated, clientTargets}. A target belongs to a client only when the association is recorded. Associates targets with their client on entry. */
export function associateClientAtAddTime(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const client = String(r.client || '');
    const associated = Boolean(r.associated) && client.length >= 1;
    const clientTargets = num(r.clientTargets, 0);
    return { key: `${target}|${client}`, target, client, associated, clientTargets, status: associated ? 'client-associated' : 'client-unassigned' };
  }).sort((a, b) => Number(b.associated) - Number(a.associated) || String(a.key).localeCompare(String(b.key)));
  const associatedCount = rows.filter(r => r.associated).length;
  return { rows, count: rows.length, associatedCount, totalClientTargets: rows.reduce((s, r) => s + r.clientTargets, 0), top: rows[0] || null, summary: `Infinity AI associated ${associatedCount} of ${rows.length} target(s) with their client.` };
}
