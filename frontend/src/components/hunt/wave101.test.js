/**
 * wave101.test.js — Infinity AI · Wave 101
 * node:test + node:assert/strict. Registry coverage (20/20 for 54001–54020,
 * 20/20 for 54021–54040, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave101.css
 * scope audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE101_A_IDEAS } from './wave101ACore.js';
import * as X101A from './wave101ACore.js';
import { WAVE101_B_IDEAS } from './wave101BCores.js';
import * as X101B from './wave101BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave101ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave101BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave101A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave101B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave101.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 101A ideas, 20/20 wave 101B ideas, zero skips', () => {
  assert.equal(WAVE101_A_IDEAS.length, 20);
  assert.equal(WAVE101_B_IDEAS.length, 20);
  const all = [...WAVE101_A_IDEAS, ...WAVE101_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 54001 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE101_A_IDEAS, ...WAVE101_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    54001: 'debrief mobile optimization',
    54002: 'debrief print stylesheets',
    54003: 'debrief digital signatures',
    54004: 'annual debrief retrospective',
    54005: 'single-field quick-add bar',
    54006: 'paste-and-detect onboarding',
    54007: 'guided onboarding wizard',
    54008: 'duplicate target detector',
    54009: 'target type presets',
    54010: 'draft targets queue',
    54011: 'onboarding checklist tracker (targets)',
    54012: 'skip-and-verify-later mode',
    54013: 'dns pre-check on add',
    54014: 'live screenshot capture on add',
    54015: 'technology guess preview',
    54016: 'redirect chain preview',
    54017: 'program linking at add time',
    54018: 'team assignment at add time',
    54019: 'tag assignment at add time',
    54020: 'client association at add time',
    54021: 'scope pre-fill from program',
    54022: 'verification file download',
    54023: 'dns txt instructions generator',
    54024: 'meta tag snippet generator',
    54025: 'subdomain count preview',
    54026: 'ip resolution preview',
    54027: 'waf/cdn preview',
    54028: 'robots.txt and sitemap preview',
    54029: 'security header preview',
    54030: 'cookie and auth preview',
    54031: 'onboarding audit log',
    54032: 'bulk draft promotion',
    54033: 'onboarding undo',
    54034: 'contact details capture',
    54035: 'notification preferences per target',
    54036: 'hunt sla setting',
    54037: 'quick-start hunt suggestion',
    54038: 'browser extension import',
    54039: 'mobile app binding',
    54040: 'cloud account binding',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 101A spot checks (one per idea) ---
test('54001 optimizeDebriefMobile readies small-screen debriefs', () => {
  const v = X101A.optimizeDebriefMobile([
    { debriefId: 'dbr-1', device: 'phone', viewportChecks: 5, passedChecks: 5 },
    { debriefId: 'dbr-2', device: 'tablet', viewportChecks: 5, passedChecks: 3 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.optimizedCount, 1);
  assert.equal(v.top.key, 'dbr-1|phone');
  assert.equal(v.averageCoverage, 0.8);
});
test('54002 buildDebriefPrintStylesheets readies printed pages', () => {
  const v = X101A.buildDebriefPrintStylesheets([
    { debriefId: 'dbr-1', pages: 12, printReadyPages: 12 },
    { debriefId: 'dbr-2', pages: 10, printReadyPages: 6 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.totalPages, 22);
  assert.equal(v.top.key, 'dbr-1');
});
test('54003 signDebriefDigitally verifies applied signatures', () => {
  const v = X101A.signDebriefDigitally([
    { debriefId: 'dbr-1', signed: true, verified: true, signer: 'ana' },
    { debriefId: 'dbr-2', signed: true, verified: false, signer: 'bob' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.validCount, 1);
  assert.equal(v.signedCount, 2);
  assert.equal(v.top.key, 'dbr-1|ana');
});
test('54004 runAnnualDebriefRetrospective wraps the year', () => {
  const v = X101A.runAnnualDebriefRetrospective([
    { year: 2026, huntsCompleted: 40, findingsTotal: 320, goalsMet: 10 },
    { year: 2025, huntsCompleted: 30, findingsTotal: 180, goalsMet: 6 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.equal(v.totalHunts, 70);
  assert.equal(v.totalFindings, 500);
  assert.equal(v.top.key, 'year-2026');
});
test('54005 runQuickAddBar recognizes typed targets', () => {
  const v = X101A.runQuickAddBar([
    { input: 'example.com', detectedType: 'domain', normalized: 'https://example.com' },
    { input: '???', detectedType: 'unknown', normalized: '' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.detectedCount, 1);
  assert.equal(v.undetectedCount, 1);
  assert.equal(v.top.detectedType, 'domain');
});
test('54006 detectPastedTargets readies pasted lists', () => {
  const v = X101A.detectPastedTargets([
    { batchLabel: 'list-a', pastedUrls: 10, detectedTargets: 9, duplicatesRemoved: 1 },
    { batchLabel: 'list-b', pastedUrls: 8, detectedTargets: 4, duplicatesRemoved: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.totalDetected, 13);
  assert.equal(v.averageDetectionRate, 0.7);
  assert.equal(v.top.uniqueTargets, 8);
});
test('54007 runGuidedOnboardingWizard finishes the walk', () => {
  const v = X101A.runGuidedOnboardingWizard([
    { userId: 'op-1', currentStep: 5, totalSteps: 5, completedWizard: true },
    { userId: 'op-2', currentStep: 2, totalSteps: 6, completedWizard: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.finishedCount, 1);
  assert.equal(v.averageProgress, 0.67);
  assert.equal(v.top.key, 'op-1');
});
test('54008 detectDuplicateTargets keeps unique targets', () => {
  const v = X101A.detectDuplicateTargets([
    { target: 'a.example.com', normalizedHost: 'a.example.com', isDuplicate: false, existingId: '' },
    { target: 'www.a.example.com', normalizedHost: 'a.example.com', isDuplicate: true, existingId: 't-1' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.uniqueCount, 1);
  assert.equal(v.duplicateCount, 1);
  assert.equal(v.top.target, 'a.example.com');
});
test('54009 applyTargetTypePresets configures target types', () => {
  const v = X101A.applyTargetTypePresets([
    { targetType: 'web', presetsAvailable: 4, presetsApplied: 4 },
    { targetType: 'api', presetsAvailable: 5, presetsApplied: 2 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.configuredCount, 1);
  assert.equal(v.totalPresets, 9);
  assert.equal(v.averageCoverage, 0.7);
  assert.equal(v.top.key, 'web');
});
test('54010 manageDraftTargetsQueue readies fresh drafts', () => {
  const v = X101A.manageDraftTargetsQueue([
    { draftId: 'draft-1', ageHours: 12, ownerAssigned: true },
    { draftId: 'draft-2', ageHours: 120, ownerAssigned: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.averageAgeHours, 66);
  assert.equal(v.top.key, 'draft-1');
});
test('54011 trackOnboardingChecklist completes onboarding', () => {
  const v = X101A.trackOnboardingChecklist([
    { target: 'shop.example.com', checklistTotal: 8, checklistDone: 8, blocked: false },
    { target: 'blog.example.com', checklistTotal: 8, checklistDone: 4, blocked: true },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.equal(v.blockedCount, 1);
  assert.equal(v.averageCoverage, 0.75);
});
test('54012 manageSkipAndVerifyLater tracks deferred checks', () => {
  const v = X101A.manageSkipAndVerifyLater([
    { target: 'api.example.com', verificationDeferred: true, verificationDoneLater: false, daysDeferred: 3 },
    { target: 'web.example.com', verificationDeferred: true, verificationDoneLater: true, daysDeferred: 1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.pendingCount, 1);
  assert.equal(v.completedCount, 1);
  assert.equal(v.top.key, 'api.example.com');
});
test('54013 runDnsPreCheck confirms resolvable domains', () => {
  const v = X101A.runDnsPreCheck([
    { domain: 'good.example.com', resolves: true, nxdomain: false, aRecords: 2 },
    { domain: 'gone.example.com', resolves: false, nxdomain: true, aRecords: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.okCount, 1);
  assert.equal(v.totalARecords, 2);
  assert.equal(v.top.key, 'good.example.com');
});
test('54014 captureLiveScreenshotOnAdd captures page views', () => {
  const v = X101A.captureLiveScreenshotOnAdd([
    { target: 'shop.example.com', screenshotCaptured: true, screenshotKb: 140, loadedOk: true },
    { target: 'blank.example.com', screenshotCaptured: true, screenshotKb: 0, loadedOk: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.displayedCount, 1);
  assert.equal(v.totalKb, 140);
  assert.equal(v.top.key, 'shop.example.com');
});
test('54015 previewTechnologyGuess grades stack guesses', () => {
  const v = X101A.previewTechnologyGuess([
    { target: 'shop.example.com', guesses: 4, confirmedGuesses: 3, topGuessConfidence: 0.9 },
    { target: 'blog.example.com', guesses: 4, confirmedGuesses: 1, topGuessConfidence: 0.5 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.accurateCount, 1);
  assert.equal(v.highConfidenceCount, 1);
  assert.equal(v.averageAccuracy, 0.5);
  assert.equal(v.top.key, 'shop.example.com');
});
test('54016 previewRedirectChain clears safe chains', () => {
  const v = X101A.previewRedirectChain([
    { target: 'shop.example.com', hops: 2, finalStatus: 200, loopDetected: false },
    { target: 'loop.example.com', hops: 9, finalStatus: 200, loopDetected: true },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.safeCount, 1);
  assert.equal(v.averageHops, 5.5);
  assert.equal(v.top.key, 'shop.example.com');
});
test('54017 linkProgramAtAddTime links bounty programs', () => {
  const v = X101A.linkProgramAtAddTime([
    { target: 'shop.example.com', programId: 'prog-a', linked: true, inScopeCount: 5 },
    { target: 'orphan.example.com', programId: '', linked: false, inScopeCount: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.linkedCount, 1);
  assert.equal(v.totalInScope, 5);
  assert.equal(v.top.target, 'shop.example.com');
});
test('54018 assignTeamAtAddTime staffs new targets', () => {
  const v = X101A.assignTeamAtAddTime([
    { target: 'shop.example.com', team: 'red', assignedMembers: 3, requiredMembers: 3 },
    { target: 'blog.example.com', team: 'blue', assignedMembers: 1, requiredMembers: 3 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.staffedCount, 1);
  assert.equal(v.averageCoverage, 0.67);
  assert.equal(v.top.target, 'shop.example.com');
});
test('54019 assignTagsAtAddTime completes required tags', () => {
  const v = X101A.assignTagsAtAddTime([
    { target: 'shop.example.com', tagsAssigned: 4, tagsRequired: 4 },
    { target: 'blog.example.com', tagsAssigned: 2, tagsRequired: 5 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.taggedCount, 1);
  assert.equal(v.totalTags, 6);
  assert.equal(v.averageCoverage, 0.7);
});
test('54020 associateClientAtAddTime assigns clients', () => {
  const v = X101A.associateClientAtAddTime([
    { target: 'shop.example.com', client: 'acme', associated: true, clientTargets: 4 },
    { target: 'solo.example.com', client: '', associated: false, clientTargets: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.associatedCount, 1);
  assert.equal(v.totalClientTargets, 4);
  assert.equal(v.top.target, 'shop.example.com');
});

// --- Wave 101B spot checks (one per idea) ---
test('54021 prefillScopeFromProgram fills target scope', () => {
  const v = X101B.prefillScopeFromProgram([
    { target: 'shop.example.com', programScopeItems: 6, prefilledItems: 6 },
    { target: 'blog.example.com', programScopeItems: 6, prefilledItems: 2 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.prefilledCount, 1);
  assert.equal(v.totalScopeItems, 12);
  assert.equal(v.averageFillRate, 0.67);
});
test('54022 downloadVerificationFile serves ownership files', () => {
  const v = X101B.downloadVerificationFile([
    { target: 'shop.example.com', fileType: 'html', downloads: 3, fileSizeKb: 2 },
    { target: 'odd.example.com', fileType: 'exe', downloads: 0, fileSizeKb: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.verifiedCount, 1);
  assert.equal(v.totalDownloads, 3);
  assert.equal(v.top.target, 'shop.example.com');
});
test('54023 generateDnsTxtInstructions builds record guidance', () => {
  const v = X101B.generateDnsTxtInstructions([
    { domain: 'good.example.com', token: 'tok-1234', ttlSeconds: 300, txtHost: '_verify' },
    { domain: 'bare.example.com', token: '', ttlSeconds: 0, txtHost: '' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.generatedCount, 1);
  assert.equal(v.top.key, 'good.example.com');
  assert.equal(v.top.status, 'instructions-ready');
});
test('54024 generateMetaTagSnippet places live snippets', () => {
  const v = X101B.generateMetaTagSnippet([
    { target: 'shop.example.com', metaName: 'ownership', metaContent: 'abc-123', inserted: true },
    { target: 'blog.example.com', metaName: 'ownership', metaContent: '', inserted: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.validCount, 1);
  assert.equal(v.top.target, 'shop.example.com');
  assert.equal(v.top.status, 'snippet-live');
});
test('54025 previewSubdomainCount sizes target surfaces', () => {
  const v = X101B.previewSubdomainCount([
    { domain: 'big.example.com', subdomainsFound: 25, probedHosts: 100 },
    { domain: 'tiny.example.com', subdomainsFound: 3, probedHosts: 20 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.richCount, 1);
  assert.equal(v.totalSubdomains, 28);
  assert.equal(v.top.key, 'big.example.com');
});
test('54026 previewIpResolution resolves host addresses', () => {
  const v = X101B.previewIpResolution([
    { host: 'api.example.com', ipsResolved: 3, ipv6Count: 1, resolvesOk: true },
    { host: 'old.example.com', ipsResolved: 0, ipv6Count: 0, resolvesOk: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.resolvedCount, 1);
  assert.equal(v.totalIps, 3);
  assert.equal(v.totalIpv6, 1);
  assert.equal(v.top.key, 'api.example.com');
});
test('54027 previewWafCdn finds edge shielding', () => {
  const v = X101B.previewWafCdn([
    { target: 'shop.example.com', wafDetected: true, cdnDetected: true, provider: 'edge-a' },
    { target: 'bare.example.com', wafDetected: false, cdnDetected: false, provider: '' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.shieldedCount, 1);
  assert.equal(v.wafCount, 1);
  assert.equal(v.cdnCount, 1);
  assert.equal(v.top.status, 'edge-and-waf');
});
test('54028 previewRobotsAndSitemap reads crawl files', () => {
  const v = X101B.previewRobotsAndSitemap([
    { target: 'shop.example.com', robotsFound: true, sitemapFound: true, disallowedPaths: 2 },
    { target: 'blog.example.com', robotsFound: true, sitemapFound: false, disallowedPaths: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.equal(v.totalDisallowed, 2);
  assert.equal(v.top.key, 'shop.example.com');
});
test('54029 previewSecurityHeaders grades response headers', () => {
  const v = X101B.previewSecurityHeaders([
    { target: 'shop.example.com', headersTotal: 6, headersPresent: 6, strictTransport: true },
    { target: 'blog.example.com', headersTotal: 6, headersPresent: 2, strictTransport: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.securedCount, 1);
  assert.equal(v.averageCoverage, 0.67);
  assert.equal(v.top.key, 'shop.example.com');
});
test('54030 previewCookiesAndAuth grades session safety', () => {
  const v = X101B.previewCookiesAndAuth([
    { target: 'shop.example.com', cookiesFound: 5, secureCookies: 5, authDetected: true },
    { target: 'blog.example.com', cookiesFound: 4, secureCookies: 1, authDetected: true },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.safeCount, 1);
  assert.equal(v.totalCookies, 9);
  assert.equal(v.averageSecureRate, 0.63);
});
test('54031 buildOnboardingAuditLog records onboarding steps', () => {
  const v = X101B.buildOnboardingAuditLog([
    { actor: 'ana', action: 'target-added', sequence: 1, detailPresent: true },
    { actor: 'bob', action: 'scope-set', sequence: 2, detailPresent: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.detailedCount, 1);
  assert.equal(v.bareCount, 1);
  assert.equal(v.top.sequence, 1);
});
test('54032 promoteBulkDrafts promotes draft batches', () => {
  const v = X101B.promoteBulkDrafts([
    { batchId: 'batch-a', draftsSelected: 8, promoted: 8, blocked: 0 },
    { batchId: 'batch-b', draftsSelected: 6, promoted: 3, blocked: 1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.fullyPromotedCount, 1);
  assert.equal(v.totalPromoted, 11);
  assert.equal(v.totalBlocked, 1);
  assert.equal(v.top.key, 'batch-a');
});
test('54033 undoOnboardingActions reverts reversible steps', () => {
  const v = X101B.undoOnboardingActions([
    { actionId: 'act-1', undoable: true, undone: true, reversibleWindowMin: 60 },
    { actionId: 'act-2', undoable: true, undone: false, reversibleWindowMin: 30 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.undoneCount, 1);
  assert.equal(v.availableCount, 1);
  assert.equal(v.top.key, 'act-1');
});
test('54034 captureContactDetails verifies contact channels', () => {
  const v = X101B.captureContactDetails([
    { target: 'shop.example.com', contactEmails: 2, contactForms: 1, verifiedContacts: 2 },
    { target: 'quiet.example.com', contactEmails: 1, contactForms: 0, verifiedContacts: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.reachableCount, 1);
  assert.equal(v.totalChannels, 4);
  assert.equal(v.averageReachRate, 0.34);
});
test('54035 manageNotificationPreferences sets alert channels', () => {
  const v = X101B.manageNotificationPreferences([
    { target: 'shop.example.com', channelsEnabled: 3, channelsTotal: 4, muteAll: false },
    { target: 'quiet.example.com', channelsEnabled: 0, channelsTotal: 4, muteAll: true },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.activeCount, 1);
  assert.equal(v.mutedCount, 1);
  assert.equal(v.averageCoverage, 0.38);
});
test('54036 setHuntSla holds delivery windows', () => {
  const v = X101B.setHuntSla([
    { huntType: 'standard', slaHours: 48, breachedHunts: 1, totalHunts: 20 },
    { huntType: 'rush', slaHours: 4, breachedHunts: 3, totalHunts: 10 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.withinCount, 1);
  assert.equal(v.averageSlaHours, 26);
  assert.equal(v.top.key, 'standard');
});
test('54037 suggestQuickStartHunt prepares first hunts', () => {
  const v = X101B.suggestQuickStartHunt([
    { targetType: 'web', suggestedChecks: 5, estimatedMinutes: 20, accepted: true },
    { targetType: 'api', suggestedChecks: 2, estimatedMinutes: 90, accepted: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.quickCount, 1);
  assert.equal(v.acceptedCount, 1);
  assert.equal(v.averageMinutes, 55);
  assert.equal(v.top.key, 'web');
});
test('54038 importFromBrowserExtension imports collected targets', () => {
  const v = X101B.importFromBrowserExtension([
    { source: 'extension-a', importedTargets: 9, rejectedTargets: 1, duplicatesSkipped: 2 },
    { source: 'extension-b', importedTargets: 2, rejectedTargets: 6, duplicatesSkipped: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.cleanCount, 1);
  assert.equal(v.totalImported, 11);
  assert.equal(v.averageImportRate, 0.57);
});
test('54039 bindMobileApp syncs bound devices', () => {
  const v = X101B.bindMobileApp([
    { device: 'phone-1', bound: true, targetsSynced: 4, lastSyncOk: true },
    { device: 'phone-2', bound: false, targetsSynced: 0, lastSyncOk: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.syncedCount, 1);
  assert.equal(v.totalSynced, 4);
  assert.equal(v.top.key, 'phone-1');
});
test('54040 bindCloudAccount binds discovered accounts', () => {
  const v = X101B.bindCloudAccount([
    { provider: 'cloud-a', account: 'acct-1', connected: true, resourcesDiscovered: 12 },
    { provider: 'cloud-b', account: '', connected: false, resourcesDiscovered: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.boundCount, 1);
  assert.equal(v.totalResources, 12);
  assert.equal(v.top.key, 'cloud-a|acct-1');
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix, minComponents] of [['A', A_JSX, 'X101A', 20], ['B', B_JSX, 'X101B', 20]]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= minComponents, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w101 prefixes, static layout only', () => {
  assert.ok(CSS_SRC.includes('.w101a-'));
  assert.ok(CSS_SRC.includes('.w101b-'));
  assert.ok(!CSS_SRC.includes('@key' + 'frames'), 'static-only order violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('anim' + 'ation'), 'static-only order violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('trans' + 'ition'), 'static-only order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave101A.jsx', 'Wave101B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

test('branding audit: Infinity AI only, no other AI names', () => {
  const banned = ['cl' + 'aude', 'chat' + 'gpt', 'open' + 'ai', 'gem' + 'ini', 'copil' + 'ot'];
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    for (const b of banned) assert.ok(!low.includes(b), `${name} leaks ${b}`);
    assert.ok(src.includes('Infinity AI'), `${name} missing Infinity AI branding`);
  }
});

test('no-debris audit: no placeholder text in wave 101 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mo' + 'ck'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('de' + 'mo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenDns = Object.freeze([Object.freeze({ domain: 'good.example.com', resolves: true, nxdomain: false, aRecords: 2 }), Object.freeze({ domain: 'gone.example.com', resolves: false, nxdomain: true, aRecords: 0 })]);
  const a = X101A.runDnsPreCheck(frozenDns);
  assert.equal(a.count, 2);
  assert.equal(a.okCount, 1);
  const frozenSla = Object.freeze([Object.freeze({ huntType: 'standard', slaHours: 48, breachedHunts: 1, totalHunts: 20 }), Object.freeze({ huntType: 'rush', slaHours: 4, breachedHunts: 3, totalHunts: 10 })]);
  const b = X101B.setHuntSla(frozenSla);
  assert.equal(b.count, 2);
  assert.equal(b.withinCount, 1);
});
