/**
 * wave101BCores.js — Infinity AI · Wave 101B
 * Target onboarding operations, ideas 54021–54040: scope pre-fill,
 * verification files, DNS text guidance, meta tag snippets,
 * subdomain and address previews, edge service preview, crawler
 * file preview, security header preview, cookie and auth preview,
 * audit log, draft promotion, undo, contact capture, notification
 * preferences, hunt service windows, quick-start suggestions,
 * extension import, mobile binding, and cloud binding.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE101_B_IDEAS = [
  { id: 54021, title: 'Scope pre-fill from program', skip: false },
  { id: 54022, title: 'Verification file download', skip: false },
  { id: 54023, title: 'DNS TXT instructions generator', skip: false },
  { id: 54024, title: 'Meta tag snippet generator', skip: false },
  { id: 54025, title: 'Subdomain count preview', skip: false },
  { id: 54026, title: 'IP resolution preview', skip: false },
  { id: 54027, title: 'WAF/CDN preview', skip: false },
  { id: 54028, title: 'robots.txt and sitemap preview', skip: false },
  { id: 54029, title: 'Security header preview', skip: false },
  { id: 54030, title: 'Cookie and auth preview', skip: false },
  { id: 54031, title: 'Onboarding audit log', skip: false },
  { id: 54032, title: 'Bulk draft promotion', skip: false },
  { id: 54033, title: 'Onboarding undo', skip: false },
  { id: 54034, title: 'Contact details capture', skip: false },
  { id: 54035, title: 'Notification preferences per target', skip: false },
  { id: 54036, title: 'Hunt SLA setting', skip: false },
  { id: 54037, title: 'Quick-start hunt suggestion', skip: false },
  { id: 54038, title: 'Browser extension import', skip: false },
  { id: 54039, title: 'Mobile app binding', skip: false },
  { id: 54040, title: 'Cloud account binding', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}

/** Idea 54021 — Scope pre-fill from program. Input records: {target, programScopeItems, prefilledItems}. Scope is ready only when every program item carried over. Fills target scope from the linked program. */
export function prefillScopeFromProgram(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const programScopeItems = Math.max(1, num(r.programScopeItems, 1));
    const prefilledItems = Math.min(programScopeItems, num(r.prefilledItems, 0));
    const fillRate = rate(prefilledItems, programScopeItems);
    return { key: target, target, programScopeItems, prefilledItems, fillRate, prefilled: prefilledItems >= programScopeItems, status: prefilledItems >= programScopeItems ? 'scope-prefilled' : 'scope-incomplete' };
  }).sort((a, b) => b.fillRate - a.fillRate || String(a.key).localeCompare(String(b.key)));
  const prefilledCount = rows.filter(r => r.prefilled).length;
  return { rows, count: rows.length, prefilledCount, totalScopeItems: rows.reduce((s, r) => s + r.programScopeItems, 0), averageFillRate: mean(rows.map(r => r.fillRate)), top: rows[0] || null, summary: `Infinity AI pre-filled scope for ${prefilledCount} of ${rows.length} target(s) from program rules.` };
}
/** Idea 54022 — Verification file download. Input records: {target, fileType, downloads, fileSizeKb}. Ownership checks pass only when a supported file was fetched. Serves the ownership verification file. */
export function downloadVerificationFile(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const fileType = String(r.fileType || '').toLowerCase();
    const downloads = num(r.downloads, 0);
    const fileSizeKb = num(r.fileSizeKb, 0);
    const supported = ['html', 'txt', 'dns', 'json'].includes(fileType);
    const verified = supported && downloads >= 1 && fileSizeKb > 0;
    return { key: `${target}|${fileType}`, target, fileType, downloads, fileSizeKb, supported, verified, status: verified ? 'verification-file-ready' : supported ? 'file-not-fetched' : 'file-type-unsupported' };
  }).sort((a, b) => b.downloads - a.downloads || String(a.key).localeCompare(String(b.key)));
  const verifiedCount = rows.filter(r => r.verified).length;
  return { rows, count: rows.length, verifiedCount, totalDownloads: rows.reduce((s, r) => s + r.downloads, 0), top: rows[0] || null, summary: `Infinity AI served verification files for ${verifiedCount} of ${rows.length} target(s).` };
}
/** Idea 54023 — DNS TXT instructions generator. Input records: {domain, token, ttlSeconds, txtHost}. Guidance is usable only with a token and a sane record lifetime. Generates DNS text record instructions. */
export function generateDnsTxtInstructions(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const domain = String(r.domain || 'domain').toLowerCase();
    const token = String(r.token || '');
    const ttlSeconds = num(r.ttlSeconds, 0);
    const txtHost = String(r.txtHost || '');
    const generated = token.length >= 4 && ttlSeconds >= 60 && txtHost.length >= 1;
    return { key: domain, domain, token, ttlSeconds, txtHost, generated, status: generated ? 'instructions-ready' : 'token-or-ttl-missing' };
  }).sort((a, b) => Number(b.generated) - Number(a.generated) || String(a.key).localeCompare(String(b.key)));
  const generatedCount = rows.filter(r => r.generated).length;
  return { rows, count: rows.length, generatedCount, top: rows[0] || null, summary: `Infinity AI generated DNS text instructions for ${generatedCount} of ${rows.length} domain(s).` };
}
/** Idea 54024 — Meta tag snippet generator. Input records: {target, metaName, metaContent, inserted}. A snippet proves ownership only once the tag sits on the page. Generates the verification meta tag snippet. */
export function generateMetaTagSnippet(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const metaName = String(r.metaName || '');
    const metaContent = String(r.metaContent || '');
    const inserted = Boolean(r.inserted);
    const valid = metaName.length >= 2 && metaContent.length >= 2 && inserted;
    return { key: `${target}|${metaName}`, target, metaName, metaContent, inserted, valid, status: valid ? 'snippet-live' : inserted ? 'snippet-incomplete' : 'snippet-not-inserted' };
  }).sort((a, b) => Number(b.valid) - Number(a.valid) || String(a.key).localeCompare(String(b.key)));
  const validCount = rows.filter(r => r.valid).length;
  return { rows, count: rows.length, validCount, top: rows[0] || null, summary: `Infinity AI placed live verification snippets on ${validCount} of ${rows.length} target(s).` };
}
/** Idea 54025 — Subdomain count preview. Input records: {domain, subdomainsFound, probedHosts}. A target looks rich when the preview finds many live subdomains. Previews subdomain counts before adding. */
export function previewSubdomainCount(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const domain = String(r.domain || 'domain').toLowerCase();
    const subdomainsFound = num(r.subdomainsFound, 0);
    const probedHosts = Math.max(1, num(r.probedHosts, 1));
    const discoveryRate = rate(subdomainsFound, probedHosts);
    return { key: domain, domain, subdomainsFound, probedHosts, discoveryRate, rich: subdomainsFound >= 10, status: subdomainsFound >= 10 ? 'surface-rich' : 'surface-thin' };
  }).sort((a, b) => b.subdomainsFound - a.subdomainsFound || String(a.key).localeCompare(String(b.key)));
  const richCount = rows.filter(r => r.rich).length;
  return { rows, count: rows.length, richCount, totalSubdomains: rows.reduce((s, r) => s + r.subdomainsFound, 0), averageDiscoveryRate: mean(rows.map(r => r.discoveryRate)), top: rows[0] || null, summary: `Infinity AI previewed ${rows.reduce((s, r) => s + r.subdomainsFound, 0)} subdomain(s); ${richCount} target surface(s) look rich.` };
}
/** Idea 54026 — IP resolution preview. Input records: {host, ipsResolved, ipv6Count, resolvesOk}. A host is reachable only when name resolution returns answers. Previews address resolution for a host. */
export function previewIpResolution(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const host = String(r.host || 'host').toLowerCase();
    const ipsResolved = num(r.ipsResolved, 0);
    const ipv6Count = num(r.ipv6Count, 0);
    const resolvesOk = Boolean(r.resolvesOk);
    const resolved = resolvesOk && ipsResolved >= 1;
    return { key: host, host, ipsResolved, ipv6Count, resolvesOk, resolved, status: resolved ? 'host-resolved' : 'host-unresolved' };
  }).sort((a, b) => b.ipsResolved - a.ipsResolved || String(a.key).localeCompare(String(b.key)));
  const resolvedCount = rows.filter(r => r.resolved).length;
  return { rows, count: rows.length, resolvedCount, totalIps: rows.reduce((s, r) => s + r.ipsResolved, 0), totalIpv6: rows.reduce((s, r) => s + r.ipv6Count, 0), top: rows[0] || null, summary: `Infinity AI resolved addresses for ${resolvedCount} of ${rows.length} host(s).` };
}
/** Idea 54027 — WAF/CDN preview. Input records: {target, wafDetected, cdnDetected, provider}. Edge shielding changes hunt expectations before work starts. Detects edge protection in front of a target. */
export function previewWafCdn(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const wafDetected = Boolean(r.wafDetected);
    const cdnDetected = Boolean(r.cdnDetected);
    const provider = String(r.provider || '');
    const shielded = wafDetected || cdnDetected;
    return { key: target, target, wafDetected, cdnDetected, provider, shielded, status: wafDetected && cdnDetected ? 'edge-and-waf' : wafDetected ? 'waf-only' : cdnDetected ? 'cdn-only' : 'edge-exposed' };
  }).sort((a, b) => Number(b.shielded) - Number(a.shielded) || String(a.key).localeCompare(String(b.key)));
  const shieldedCount = rows.filter(r => r.shielded).length;
  return { rows, count: rows.length, shieldedCount, wafCount: rows.filter(r => r.wafDetected).length, cdnCount: rows.filter(r => r.cdnDetected).length, top: rows[0] || null, summary: `Infinity AI found edge shielding on ${shieldedCount} of ${rows.length} target(s).` };
}
/** Idea 54028 — robots.txt and sitemap preview. Input records: {target, robotsFound, sitemapFound, disallowedPaths}. Crawl guidance is complete only when both files answer. Previews crawler files for a target. */
export function previewRobotsAndSitemap(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const robotsFound = Boolean(r.robotsFound);
    const sitemapFound = Boolean(r.sitemapFound);
    const disallowedPaths = num(r.disallowedPaths, 0);
    const complete = robotsFound && sitemapFound;
    return { key: target, target, robotsFound, sitemapFound, disallowedPaths, complete, status: complete ? 'crawl-files-complete' : robotsFound ? 'sitemap-missing' : 'robots-missing' };
  }).sort((a, b) => Number(b.complete) - Number(a.complete) || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, totalDisallowed: rows.reduce((s, r) => s + r.disallowedPaths, 0), top: rows[0] || null, summary: `Infinity AI found complete crawl files on ${completeCount} of ${rows.length} target(s).` };
}
/** Idea 54029 — Security header preview. Input records: {target, headersTotal, headersPresent, strictTransport}. Headers protect only when nearly all are present and transport is strict. Previews security response headers. */
export function previewSecurityHeaders(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const headersTotal = Math.max(1, num(r.headersTotal, 1));
    const headersPresent = Math.min(headersTotal, num(r.headersPresent, 0));
    const strictTransport = Boolean(r.strictTransport);
    const headerCoverage = rate(headersPresent, headersTotal);
    const secured = headerCoverage >= 0.8 && strictTransport;
    return { key: target, target, headersTotal, headersPresent, strictTransport, headerCoverage, secured, status: secured ? 'headers-strong' : 'headers-weak' };
  }).sort((a, b) => b.headerCoverage - a.headerCoverage || String(a.key).localeCompare(String(b.key)));
  const securedCount = rows.filter(r => r.secured).length;
  return { rows, count: rows.length, securedCount, averageCoverage: mean(rows.map(r => r.headerCoverage)), top: rows[0] || null, summary: `Infinity AI rated headers strong on ${securedCount} of ${rows.length} target(s).` };
}
/** Idea 54030 — Cookie and auth preview. Input records: {target, cookiesFound, secureCookies, authDetected}. Sessions look safe only when cookies are secured and sign-in is visible. Previews cookies and authentication signals. */
export function previewCookiesAndAuth(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const cookiesFound = Math.max(1, num(r.cookiesFound, 1));
    const secureCookies = Math.min(cookiesFound, num(r.secureCookies, 0));
    const authDetected = Boolean(r.authDetected);
    const secureRate = rate(secureCookies, cookiesFound);
    const safe = secureRate >= 0.8 && authDetected;
    return { key: target, target, cookiesFound, secureCookies, authDetected, secureRate, safe, status: safe ? 'session-safe' : authDetected ? 'cookies-exposed' : 'auth-invisible' };
  }).sort((a, b) => b.secureRate - a.secureRate || String(a.key).localeCompare(String(b.key)));
  const safeCount = rows.filter(r => r.safe).length;
  return { rows, count: rows.length, safeCount, totalCookies: rows.reduce((s, r) => s + r.cookiesFound, 0), averageSecureRate: mean(rows.map(r => r.secureRate)), top: rows[0] || null, summary: `Infinity AI rated sessions safe on ${safeCount} of ${rows.length} target(s).` };
}
/** Idea 54031 — Onboarding audit log. Input records: {actor, action, sequence, detailPresent}. An audit entry proves little without human-readable detail. Logs every onboarding step for review. */
export function buildOnboardingAuditLog(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const actor = String(r.actor || 'actor');
    const action = String(r.action || 'action');
    const sequence = num(r.sequence, 0);
    const detailPresent = Boolean(r.detailPresent);
    return { key: `${sequence}|${actor}|${action}`, actor, action, sequence, detailPresent, auditable: detailPresent, status: detailPresent ? 'entry-detailed' : 'entry-bare' };
  }).sort((a, b) => a.sequence - b.sequence || String(a.key).localeCompare(String(b.key)));
  const detailedCount = rows.filter(r => r.detailPresent).length;
  return { rows, count: rows.length, detailedCount, bareCount: rows.length - detailedCount, top: rows[0] || null, summary: `Infinity AI recorded ${rows.length} onboarding audit entr(ies); ${detailedCount} carry full detail.` };
}
/** Idea 54032 — Bulk draft promotion. Input records: {batchId, draftsSelected, promoted, blocked}. A batch finishes only when every draft promotes without blocks. Promotes many drafts in one action. */
export function promoteBulkDrafts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const batchId = String(r.batchId || 'batch');
    const draftsSelected = Math.max(1, num(r.draftsSelected, 1));
    const promoted = Math.min(draftsSelected, num(r.promoted, 0));
    const blocked = num(r.blocked, 0);
    const promotionRate = rate(promoted, draftsSelected);
    return { key: batchId, batchId, draftsSelected, promoted, blocked, promotionRate, fullyPromoted: promoted >= draftsSelected && blocked === 0, status: promoted >= draftsSelected && blocked === 0 ? 'batch-promoted' : blocked > 0 ? 'batch-blocked' : 'batch-partial' };
  }).sort((a, b) => b.promotionRate - a.promotionRate || String(a.key).localeCompare(String(b.key)));
  const fullyPromotedCount = rows.filter(r => r.fullyPromoted).length;
  return { rows, count: rows.length, fullyPromotedCount, totalPromoted: rows.reduce((s, r) => s + r.promoted, 0), totalBlocked: rows.reduce((s, r) => s + r.blocked, 0), top: rows[0] || null, summary: `Infinity AI fully promoted ${fullyPromotedCount} of ${rows.length} draft batch(es).` };
}
/** Idea 54033 — Onboarding undo. Input records: {actionId, undoable, undone, reversibleWindowMin}. An undo helps only while the action is still reversible. Reverts recent onboarding actions. */
export function undoOnboardingActions(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const actionId = String(r.actionId || 'action');
    const undoable = Boolean(r.undoable);
    const undone = Boolean(r.undone);
    const reversibleWindowMin = num(r.reversibleWindowMin, 0);
    const available = undoable && !undone;
    return { key: actionId, actionId, undoable, undone, reversibleWindowMin, available, status: undone ? 'already-undone' : undoable ? 'undo-available' : 'undo-locked' };
  }).sort((a, b) => a.actionId.localeCompare(b.actionId));
  const undoneCount = rows.filter(r => r.undone).length;
  return { rows, count: rows.length, undoneCount, availableCount: rows.filter(r => r.available).length, top: rows[0] || null, summary: `Infinity AI undid ${undoneCount} onboarding action(s); ${rows.filter(r => r.available).length} remain reversible.` };
}
/** Idea 54034 — Contact details capture. Input records: {target, contactEmails, contactForms, verifiedContacts}. A target is reachable only when at least one channel verifies. Captures program contact channels. */
export function captureContactDetails(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const contactEmails = num(r.contactEmails, 0);
    const contactForms = num(r.contactForms, 0);
    const totalChannels = contactEmails + contactForms;
    const verifiedContacts = Math.min(Math.max(1, totalChannels), num(r.verifiedContacts, 0));
    const reachRate = rate(verifiedContacts, Math.max(1, totalChannels));
    return { key: target, target, contactEmails, contactForms, totalChannels, verifiedContacts, reachRate, reachable: verifiedContacts >= 1, status: verifiedContacts >= 1 ? 'contact-reachable' : 'contact-missing' };
  }).sort((a, b) => b.reachRate - a.reachRate || String(a.key).localeCompare(String(b.key)));
  const reachableCount = rows.filter(r => r.reachable).length;
  return { rows, count: rows.length, reachableCount, totalChannels: rows.reduce((s, r) => s + r.totalChannels, 0), averageReachRate: mean(rows.map(r => r.reachRate)), top: rows[0] || null, summary: `Infinity AI found verified contact channels for ${reachableCount} of ${rows.length} target(s).` };
}
/** Idea 54035 — Notification preferences per target. Input records: {target, channelsEnabled, channelsTotal, muteAll}. Alerts flow only when channels are on and the target is unmuted. Sets alert channels per target. */
export function manageNotificationPreferences(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const channelsTotal = Math.max(1, num(r.channelsTotal, 1));
    const channelsEnabled = Math.min(channelsTotal, num(r.channelsEnabled, 0));
    const muteAll = Boolean(r.muteAll);
    const channelCoverage = rate(channelsEnabled, channelsTotal);
    const active = !muteAll && channelsEnabled >= 1;
    return { key: target, target, channelsEnabled, channelsTotal, muteAll, channelCoverage, active, status: active ? 'alerts-active' : muteAll ? 'alerts-muted' : 'alerts-off' };
  }).sort((a, b) => b.channelCoverage - a.channelCoverage || String(a.key).localeCompare(String(b.key)));
  const activeCount = rows.filter(r => r.active).length;
  return { rows, count: rows.length, activeCount, mutedCount: rows.filter(r => r.muteAll).length, averageCoverage: mean(rows.map(r => r.channelCoverage)), top: rows[0] || null, summary: `Infinity AI keeps alerts active on ${activeCount} of ${rows.length} target(s).` };
}
/** Idea 54036 — Hunt SLA setting. Input records: {huntType, slaHours, breachedHunts, totalHunts}. A service window holds only when breaches stay rare. Sets delivery windows per hunt type. */
export function setHuntSla(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntType = String(r.huntType || 'standard').toLowerCase();
    const slaHours = Math.max(1, num(r.slaHours, 1));
    const totalHunts = num(r.totalHunts, 0);
    const breachedHunts = Math.min(totalHunts, num(r.breachedHunts, 0));
    const breachRate = rate(breachedHunts, totalHunts);
    return { key: huntType, huntType, slaHours, breachedHunts, totalHunts, breachRate, withinSla: breachRate <= 0.1 && totalHunts >= 1, status: breachRate <= 0.1 && totalHunts >= 1 ? 'window-holding' : 'window-slipping' };
  }).sort((a, b) => a.breachRate - b.breachRate || String(a.key).localeCompare(String(b.key)));
  const withinCount = rows.filter(r => r.withinSla).length;
  return { rows, count: rows.length, withinCount, averageSlaHours: mean(rows.map(r => r.slaHours)), top: rows[0] || null, summary: `Infinity AI holds the service window for ${withinCount} of ${rows.length} hunt type(s).` };
}
/** Idea 54037 — Quick-start hunt suggestion. Input records: {targetType, suggestedChecks, estimatedMinutes, accepted}. A suggestion is quick only when it starts within half an hour. Suggests a first hunt for a new target. */
export function suggestQuickStartHunt(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const targetType = String(r.targetType || 'web').toLowerCase();
    const suggestedChecks = num(r.suggestedChecks, 0);
    const estimatedMinutes = num(r.estimatedMinutes, 0);
    const accepted = Boolean(r.accepted);
    return { key: targetType, targetType, suggestedChecks, estimatedMinutes, accepted, quick: estimatedMinutes <= 30 && suggestedChecks >= 1, status: estimatedMinutes <= 30 && suggestedChecks >= 1 ? 'quick-start-ready' : 'long-onboarding' };
  }).sort((a, b) => a.estimatedMinutes - b.estimatedMinutes || String(a.key).localeCompare(String(b.key)));
  const quickCount = rows.filter(r => r.quick).length;
  return { rows, count: rows.length, quickCount, acceptedCount: rows.filter(r => r.accepted).length, averageMinutes: mean(rows.map(r => r.estimatedMinutes)), top: rows[0] || null, summary: `Infinity AI prepared quick-start hunts for ${quickCount} of ${rows.length} target type(s).` };
}
/** Idea 54038 — Browser extension import. Input records: {source, importedTargets, rejectedTargets, duplicatesSkipped}. Imports count as clean when almost every candidate lands. Imports targets collected in the browser. */
export function importFromBrowserExtension(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const source = String(r.source || 'extension');
    const importedTargets = num(r.importedTargets, 0);
    const rejectedTargets = num(r.rejectedTargets, 0);
    const duplicatesSkipped = num(r.duplicatesSkipped, 0);
    const importRate = rate(importedTargets, importedTargets + rejectedTargets);
    return { key: source, source, importedTargets, rejectedTargets, duplicatesSkipped, importRate, clean: importRate >= 0.8, status: importRate >= 0.8 ? 'import-clean' : 'import-lossy' };
  }).sort((a, b) => b.importRate - a.importRate || String(a.key).localeCompare(String(b.key)));
  const cleanCount = rows.filter(r => r.clean).length;
  return { rows, count: rows.length, cleanCount, totalImported: rows.reduce((s, r) => s + r.importedTargets, 0), averageImportRate: mean(rows.map(r => r.importRate)), top: rows[0] || null, summary: `Infinity AI imported cleanly from ${cleanCount} of ${rows.length} browser collection(s).` };
}
/** Idea 54039 — Mobile app binding. Input records: {device, bound, targetsSynced, lastSyncOk}. A phone is useful only when bound and syncing real targets. Binds the companion mobile app. */
export function bindMobileApp(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const device = String(r.device || 'device');
    const bound = Boolean(r.bound);
    const targetsSynced = num(r.targetsSynced, 0);
    const lastSyncOk = Boolean(r.lastSyncOk);
    const synced = bound && lastSyncOk && targetsSynced >= 1;
    return { key: device, device, bound, targetsSynced, lastSyncOk, synced, status: synced ? 'app-syncing' : bound ? 'app-stale' : 'app-unbound' };
  }).sort((a, b) => b.targetsSynced - a.targetsSynced || String(a.key).localeCompare(String(b.key)));
  const syncedCount = rows.filter(r => r.synced).length;
  return { rows, count: rows.length, syncedCount, totalSynced: rows.reduce((s, r) => s + r.targetsSynced, 0), top: rows[0] || null, summary: `Infinity AI syncs live targets to ${syncedCount} of ${rows.length} bound device(s).` };
}
/** Idea 54040 — Cloud account binding. Input records: {provider, account, connected, resourcesDiscovered}. A cloud link matters only when connected and finding resources. Binds cloud accounts for asset discovery. */
export function bindCloudAccount(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const provider = String(r.provider || 'cloud').toLowerCase();
    const account = String(r.account || '');
    const connected = Boolean(r.connected);
    const resourcesDiscovered = num(r.resourcesDiscovered, 0);
    const bound = connected && account.length >= 1 && resourcesDiscovered >= 1;
    return { key: `${provider}|${account}`, provider, account, connected, resourcesDiscovered, bound, status: bound ? 'cloud-bound' : connected ? 'cloud-empty' : 'cloud-disconnected' };
  }).sort((a, b) => b.resourcesDiscovered - a.resourcesDiscovered || String(a.key).localeCompare(String(b.key)));
  const boundCount = rows.filter(r => r.bound).length;
  return { rows, count: rows.length, boundCount, totalResources: rows.reduce((s, r) => s + r.resourcesDiscovered, 0), top: rows[0] || null, summary: `Infinity AI bound ${boundCount} of ${rows.length} cloud account(s) with discovered resources.` };
}
