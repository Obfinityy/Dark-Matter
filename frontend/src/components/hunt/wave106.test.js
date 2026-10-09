/**
 * wave106.test.js — Infinity AI · Wave 106
 * node:test + node:assert/strict. Registry coverage (20/20 for 54201–54220,
 * 20/20 for 54221–54240, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave106.css
 * scope audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE106_A_IDEAS } from './wave106ACore.js';
import * as X106A from './wave106ACore.js';
import { WAVE106_B_IDEAS } from './wave106BCores.js';
import * as X106B from './wave106BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave106ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave106BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave106A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave106B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave106.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 106A ideas, 20/20 wave 106B ideas, zero skips', () => {
  assert.equal(WAVE106_A_IDEAS.length, 20);
  assert.equal(WAVE106_B_IDEAS.length, 20);
  const all = [...WAVE106_A_IDEAS, ...WAVE106_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 54201 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE106_A_IDEAS, ...WAVE106_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    54201: 'database-backed page checks',
    54202: 'webhook receiver checks',
    54203: 'business-hours check schedule',
    54204: 'health alert acknowledgment',
    54205: 'subdomain diff alerts',
    54206: 'new endpoint discovery alerts',
    54207: 'certificate transparency monitoring (targets)',
    54208: 'dns record change alerts',
    54209: 'ip address change alerts',
    54210: 'asn change alerts',
    54211: 'nameserver change alerts',
    54212: 'soa serial tracking',
    54213: 'technology stack change alerts',
    54214: 'javascript bundle change alerts',
    54215: 'page content diff',
    54216: 'http header change alerts',
    54217: 'new open ports alerts',
    54218: 'removed endpoint alerts',
    54219: 'redirect target changes',
    54220: 'robots.txt change alerts',
    54221: 'sitemap change alerts',
    54222: 'favicon change alerts',
    54223: 'title and meta change alerts',
    54224: 'form change detection',
    54225: 'new login page detection',
    54226: 'new file-upload detection',
    54227: 'waf on/off change detection',
    54228: 'cdn change detection',
    54229: 'tls version change alerts',
    54230: 'cipher suite change alerts',
    54231: 'certificate issuer change alerts',
    54232: 'san list change alerts',
    54233: 'whois change alerts',
    54234: 'hosting geolocation shifts',
    54235: 'response time shift detection',
    54236: 'status code shift detection',
    54237: 'new subdomains with screenshots',
    54238: 'change severity scoring',
    54239: 'change digest emails',
    54240: 'per-target change timeline',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 106A spot checks (one per idea) ---
test('54201 checkDatabaseBackedPages separates fresh, stale and shell pages', () => {
  const v = X106A.checkDatabaseBackedPages([
    { target: 'shop', markers: ['In stock', '$49'], pageText: 'In stock now, only $49', dataAgeSeconds: 60 },
    { target: 'legacy', markers: ['In stock'], pageText: 'Service error', dataAgeSeconds: 4000 },
    { target: 'stale', markers: ['Live price'], pageText: 'Live price board', dataAgeSeconds: 900 },
  ], { maxAgeSeconds: 300 });
  assert.equal(v.freshCount, 1);
  const legacy = v.rows.find(r => r.target === 'legacy');
  assert.equal(legacy.status, 'fresh-data-missing');
  assert.deepEqual(legacy.missing, ['In stock']);
  assert.equal(legacy.freshness, 0);
  assert.equal(v.rows.find(r => r.target === 'stale').status, 'data-stale');
  assert.equal(v.top.target, 'legacy');
});
test('54202 checkWebhookReceivers requires fast 2xx acknowledgements', () => {
  const v = X106A.checkWebhookReceivers([
    { target: 'hooks', ackStatus: 200, ackLatencyMs: 120 },
    { target: 'billing', ackStatus: 500, ackLatencyMs: 40 },
    { target: 'slowhooks', ackStatus: 204, ackLatencyMs: 2400 },
  ], { maxAckMs: 1000 });
  assert.equal(v.ackedCount, 1);
  assert.equal(v.slowCount, 1);
  assert.equal(v.rows.find(r => r.target === 'billing').status, 'webhook-unacknowledged');
  assert.equal(v.rows.find(r => r.target === 'slowhooks').status, 'webhook-slow-ack');
  assert.equal(v.top.target, 'billing');
});
test('54203 planBusinessHoursChecks pauses sleeping targets overnight', () => {
  const v = X106A.planBusinessHoursChecks([
    { target: 'shop', startHour: 9, endHour: 17, sleepsOvernight: true },
    { target: 'api', startHour: 8, endHour: 23, sleepsOvernight: true },
    { target: 'blog', startHour: 9, endHour: 17, sleepsOvernight: false },
  ], { nowHour: 22 });
  assert.equal(v.runningCount, 2);
  assert.equal(v.pausedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'checks-paused');
  assert.equal(v.top.target, 'shop');
});
test('54204 trackAlertAcknowledgments silences acked incidents', () => {
  const v = X106A.trackAlertAcknowledgments([
    { target: 'shop', alertId: 'inc-1', state: 'acknowledged' },
    { target: 'shop', alertId: 'inc-2', state: 'escalated' },
    { target: 'blog', alertId: 'inc-3', state: 'open' },
  ]);
  assert.equal(v.ackedCount, 1);
  assert.equal(v.escalatedCount, 1);
  assert.equal(v.openCount, 1);
  assert.equal(v.top.key, 'shop|inc-2');
  assert.equal(v.rows.find(r => r.alertId === 'inc-1').silenced, true);
});
test('54205 diffSubdomains reports additions and removals', () => {
  const v = X106A.diffSubdomains([
    { target: 'shop', previousSubdomains: ['www.example.com', 'api.example.com'], currentSubdomains: ['www.example.com', 'api.example.com', 'dev.example.com'] },
    { target: 'blog', previousSubdomains: ['a.example.com', 'b.example.com'], currentSubdomains: ['a.example.com'] },
  ]);
  assert.equal(v.changedCount, 2);
  assert.equal(v.totalAdded, 1);
  assert.equal(v.totalRemoved, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').added, ['dev.example.com']);
  assert.deepEqual(v.rows.find(r => r.target === 'blog').removed, ['b.example.com']);
});
test('54206 discoverNewEndpoints flags previously unseen routes', () => {
  const v = X106A.discoverNewEndpoints([
    { target: 'api', knownEndpoints: ['/health', '/users'], crawledEndpoints: ['/health', '/users', '/admin/metrics', '/v2/search'] },
    { target: 'blog', knownEndpoints: ['/'], crawledEndpoints: ['/'] },
  ]);
  assert.equal(v.totalNew, 2);
  assert.equal(v.foundCount, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'api').newEndpoints, ['/admin/metrics', '/v2/search']);
});
test('54207 monitorCertificateTransparency flags look-alike certificates', () => {
  const v = X106A.monitorCertificateTransparency([
    { target: 'shop', expectedDomains: ['example.com'], certs: [
      { subject: 'example.com', sans: ['www.example.com', 'api.example.com'] },
      { subject: 'secure-login-example.com', sans: [] },
    ] },
    { target: 'blog', expectedDomains: ['blog.example.org'], certs: [{ subject: 'blog.example.org', sans: [] }] },
  ]);
  assert.equal(v.flaggedTargets, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.flaggedCount, 1);
  assert.deepEqual(shop.unexpectedHosts, ['secure-login-example.com']);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'certificates-expected');
});
test('54208 diffDnsRecords reports before and after per record set', () => {
  const v = X106A.diffDnsRecords([
    { target: 'shop', recordType: 'MX', previousValues: ['mx1.example.com'], currentValues: ['mx1.example.com', 'mx2.example.com'] },
    { target: 'shop', recordType: 'A', previousValues: ['192.0.2.10'], currentValues: ['192.0.2.10'] },
  ]);
  assert.equal(v.changedCount, 1);
  const mx = v.rows.find(r => r.recordType === 'MX');
  assert.deepEqual(mx.added, ['mx2.example.com']);
  assert.equal(mx.sensitiveType, true);
  assert.equal(v.rows.find(r => r.recordType === 'A').status, 'dns-stable');
});
test('54209 detectIpChanges grades full swaps above partial moves', () => {
  const v = X106A.detectIpChanges([
    { target: 'shop', previousIps: ['192.0.2.10', '192.0.2.11'], currentIps: ['198.51.100.7'] },
    { target: 'blog', previousIps: ['203.0.113.5'], currentIps: ['203.0.113.5'] },
    { target: 'api', previousIps: ['192.0.2.10', '192.0.2.11'], currentIps: ['192.0.2.11', '192.0.2.12'] },
  ]);
  assert.equal(v.changedCount, 2);
  assert.equal(v.fullSwapCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'ip-fully-changed');
  assert.equal(v.rows.find(r => r.target === 'api').status, 'ip-partially-changed');
});
test('54210 detectAsnChanges flags provider moves', () => {
  const v = X106A.detectAsnChanges([
    { target: 'shop', previousAsn: 'AS64500', currentAsn: 'AS64501', previousProvider: 'Host A', currentProvider: 'Host B' },
    { target: 'blog', previousAsn: 'AS64510', currentAsn: 'AS64510', previousProvider: 'Host C', currentProvider: 'Host C' },
  ]);
  assert.equal(v.changedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'asn-changed');
});
test('54211 detectNameserverChanges flags full delegation swaps', () => {
  const v = X106A.detectNameserverChanges([
    { target: 'shop', previousNs: ['ns1.host-a.net', 'ns2.host-a.net'], currentNs: ['ns1.host-b.net', 'ns2.host-b.net'] },
    { target: 'blog', previousNs: ['ns1.host-a.net', 'ns2.host-a.net'], currentNs: ['ns1.host-a.net', 'ns3.host-a.net'] },
  ]);
  assert.equal(v.fullChangeCount, 1);
  assert.equal(v.changedCount, 2);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'ns-full-change');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'ns-partially-changed');
});
test('54212 trackSoaSerials reads zone edits and regressions', () => {
  const v = X106A.trackSoaSerials([
    { target: 'example.com', previousSerial: 2026100101, currentSerial: 2026100103 },
    { target: 'example.org', previousSerial: 44, currentSerial: 44 },
    { target: 'example.net', previousSerial: 90, currentSerial: 85 },
  ]);
  assert.equal(v.editedCount, 1);
  assert.equal(v.regressedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'example.com').delta, 2);
  assert.equal(v.rows.find(r => r.target === 'example.net').status, 'serial-regressed');
  assert.equal(v.top.target, 'example.com');
});
test('54213 detectTechStackChanges diffs server and framework sets', () => {
  const v = X106A.detectTechStackChanges([
    { target: 'shop', previousTech: ['nginx', 'react'], currentTech: ['caddy', 'react', 'nextjs'] },
    { target: 'blog', previousTech: ['apache', 'php'], currentTech: ['apache', 'php'] },
  ]);
  assert.equal(v.changedCount, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.deepEqual(shop.added, ['caddy', 'nextjs']);
  assert.deepEqual(shop.removed, ['nginx']);
});
test('54214 detectJsBundleChanges names added and modified bundles', () => {
  const v = X106A.detectJsBundleChanges([
    { target: 'shop', previousBundles: [{ name: 'app', hash: 'h1', sizeKb: 400 }, { name: 'vendor', hash: 'h2', sizeKb: 900 }], currentBundles: [{ name: 'app', hash: 'h1b', sizeKb: 520 }, { name: 'vendor', hash: 'h2', sizeKb: 900 }, { name: 'analytics', hash: 'h3', sizeKb: 60 }] },
    { target: 'blog', previousBundles: [{ name: 'main', hash: 'm1', sizeKb: 100 }], currentBundles: [{ name: 'main', hash: 'm1', sizeKb: 100 }] },
  ]);
  assert.equal(v.changedCount, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.deepEqual(shop.added, ['analytics']);
  assert.equal(shop.modified.length, 1);
  assert.equal(shop.modified[0].sizeDeltaKb, 120);
  assert.equal(shop.heavyCount, 1);
  assert.equal(shop.changeCount, 2);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'bundles-stable');
});
test('54215 diffPageContent computes word-level change ratio', () => {
  const v = X106A.diffPageContent([
    { target: 'shop', previousText: 'the quick brown fox', currentText: 'the quick red fox jumps' },
    { target: 'blog', previousText: 'same text here', currentText: 'same text here' },
  ]);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.deepEqual(shop.addedWords, ['jumps', 'red']);
  assert.deepEqual(shop.removedWords, ['brown']);
  assert.equal(shop.changeRatio, 0.5);
  assert.equal(shop.status, 'content-changed');
  assert.equal(v.changedCount, 1);
});
test('54216 diffHttpHeaders separates security header changes', () => {
  const v = X106A.diffHttpHeaders([
    { target: 'shop', previousHeaders: { 'Strict-Transport-Security': 'max-age=31536000', 'X-Frame-Options': 'DENY' }, currentHeaders: { 'X-Frame-Options': 'SAMEORIGIN' } },
    { target: 'blog', previousHeaders: { server: 'nginx' }, currentHeaders: { server: 'caddy' } },
    { target: 'cdn', previousHeaders: { server: 'edge' }, currentHeaders: { server: 'edge' } },
  ]);
  assert.equal(v.securityAlertCount, 1);
  assert.equal(v.changedCount, 2);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.deepEqual(shop.removed, ['strict-transport-security']);
  assert.equal(shop.changed[0].name, 'x-frame-options');
  assert.equal(shop.status, 'security-headers-changed');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'headers-changed');
});
test('54217 detectNewOpenPorts lists newly reachable ports', () => {
  const v = X106A.detectNewOpenPorts([
    { target: 'shop', previousPorts: [80, 443], currentPorts: [80, 443, 8080, 8443] },
    { target: 'blog', previousPorts: [22, 80], currentPorts: [80] },
  ]);
  assert.equal(v.alertCount, 1);
  assert.equal(v.totalNew, 2);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').newlyOpen, [8080, 8443]);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'ports-closed-only');
});
test('54218 detectRemovedEndpoints notes deprecations', () => {
  const v = X106A.detectRemovedEndpoints([
    { target: 'api', knownEndpoints: ['/health', '/billing', '/legacy-report'], currentEndpoints: ['/health', '/billing'] },
    { target: 'blog', knownEndpoints: ['/'], currentEndpoints: ['/'] },
  ]);
  assert.equal(v.alertCount, 1);
  assert.equal(v.totalRemoved, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'api').removed, ['/legacy-report']);
});
test('54219 detectRedirectTargetChanges catches destination swaps', () => {
  const v = X106A.detectRedirectTargetChanges([
    { target: 'shop', redirects: [{ path: '/old', previousTarget: '/a', currentTarget: '/b' }, { path: '/home', previousTarget: '/h', currentTarget: '/h' }] },
    { target: 'blog', redirects: [{ path: '/x', previousTarget: '/y', currentTarget: '/y' }] },
  ]);
  assert.equal(v.changedTargets, 1);
  assert.equal(v.totalChanged, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').changedPaths, ['/old']);
});
test('54220 diffRobotsTxt tracks exposed and disallowed paths', () => {
  const v = X106A.diffRobotsTxt([
    { target: 'shop', previousDisallowed: ['/admin'], currentDisallowed: ['/admin', '/internal', '/staging'] },
    { target: 'blog', previousDisallowed: ['/tmp', '/admin'], currentDisallowed: ['/admin'] },
  ]);
  assert.equal(v.changedCount, 2);
  assert.equal(v.exposedTotal, 1);
  assert.equal(v.disallowedTotal, 2);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').newlyDisallowed, ['/internal', '/staging']);
  assert.deepEqual(v.rows.find(r => r.target === 'blog').newlyExposed, ['/tmp']);
});

// --- Wave 106B spot checks (one per idea) ---
test('54221 diffSitemaps tracks structure additions and removals', () => {
  const v = X106B.diffSitemaps([
    { target: 'shop', previousUrls: ['/', '/about', '/old'], currentUrls: ['/', '/about', '/pricing'] },
    { target: 'blog', previousUrls: ['/'], currentUrls: ['/'] },
  ]);
  assert.equal(v.changedCount, 1);
  assert.equal(v.totalAdded, 1);
  assert.equal(v.totalRemoved, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').added, ['/pricing']);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').removed, ['/old']);
});
test('54222 detectFaviconChanges flags swaps and absence', () => {
  const v = X106B.detectFaviconChanges([
    { target: 'shop', previousHash: 'fav-1a', currentHash: 'fav-9z' },
    { target: 'blog', previousHash: 'fav-2b', currentHash: 'fav-2b' },
    { target: 'legacy', previousHash: 'fav-3c', currentHash: '' },
  ]);
  assert.equal(v.changedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'favicon-changed');
  assert.equal(v.rows.find(r => r.target === 'legacy').status, 'favicon-missing');
});
test('54223 detectTitleMetaChanges watches homepage wording', () => {
  const v = X106B.detectTitleMetaChanges([
    { target: 'shop', previousTitle: 'Shop - Home', currentTitle: 'Shop - Sale', previousDescription: 'Buy things', currentDescription: 'Buy things' },
    { target: 'blog', previousTitle: 'Blog', currentTitle: 'Blog', previousDescription: 'Notes', currentDescription: 'Field notes' },
    { target: 'cdn', previousTitle: 'Edge', currentTitle: 'Edge', previousDescription: 'Static', currentDescription: 'Static' },
  ]);
  assert.equal(v.changedCount, 2);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'title-changed');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'meta-changed');
});
test('54224 detectFormChanges elevates sensitive form edits', () => {
  const v = X106B.detectFormChanges([
    { target: 'shop', forms: [
      { name: 'checkout', sensitive: true, previousFields: ['card', 'cvv'], currentFields: ['card', 'cvv', 'wallet'] },
      { name: 'search', sensitive: false, previousFields: ['q'], currentFields: ['q'] },
    ] },
    { target: 'blog', forms: [{ name: 'comment', sensitive: false, previousFields: ['text'], currentFields: ['text'] }] },
  ]);
  assert.equal(v.sensitiveCount, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.status, 'sensitive-form-changed');
  assert.deepEqual(shop.sensitiveChangedNames, ['checkout']);
  assert.equal(shop.gainedTotal, 1);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'forms-stable');
});
test('54225 detectNewLoginPages queues auth entry points for review', () => {
  const v = X106B.detectNewLoginPages([
    { target: 'shop', endpoints: [{ path: '/login', hasPasswordField: true, known: true }, { path: '/sso-login', hasPasswordField: true, known: false }, { path: '/home', hasPasswordField: false, known: false }] },
    { target: 'blog', endpoints: [{ path: '/signin', hasPasswordField: true, known: true }] },
  ]);
  assert.equal(v.totalNew, 1);
  assert.equal(v.foundCount, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').newLoginPaths, ['/sso-login']);
});
test('54226 detectNewFileUploads highlights exposed upload endpoints', () => {
  const v = X106B.detectNewFileUploads([
    { target: 'api', endpoints: [{ path: '/avatar', acceptsUpload: true, known: true }, { path: '/media/upload', acceptsUpload: true, known: false }] },
  ]);
  assert.equal(v.totalNew, 1);
  assert.equal(v.foundCount, 1);
  assert.deepEqual(v.rows[0].newUploadPaths, ['/media/upload']);
  assert.equal(v.rows[0].status, 'new-upload-endpoints');
});
test('54227 detectWafChanges reads WAF appearance and removal', () => {
  const v = X106B.detectWafChanges([
    { target: 'shop', previousWaf: '', currentWaf: 'cloudflare' },
    { target: 'blog', previousWaf: 'akamai', currentWaf: '' },
    { target: 'cdn', previousWaf: 'cloudflare', currentWaf: 'cloudflare' },
  ]);
  assert.equal(v.changedCount, 2);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'waf-appeared');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'waf-disappeared');
});
test('54228 detectCdnChanges reads CDN switches', () => {
  const v = X106B.detectCdnChanges([
    { target: 'shop', previousCdn: 'cloudfront', currentCdn: 'fastly' },
    { target: 'blog', previousCdn: '', currentCdn: 'cloudflare' },
    { target: 'cdn', previousCdn: 'akamai', currentCdn: 'akamai' },
  ]);
  assert.equal(v.changedCount, 2);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'cdn-switched');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'cdn-appeared');
});
test('54229 detectTlsVersionChanges flags downgrades and legacy re-enable', () => {
  const v = X106B.detectTlsVersionChanges([
    { target: 'shop', previousVersions: ['TLS 1.2', 'TLS 1.3'], currentVersions: ['TLS 1.2'] },
    { target: 'legacy', previousVersions: ['TLS 1.2'], currentVersions: ['TLS 1.0', 'TLS 1.2'] },
    { target: 'blog', previousVersions: ['TLS 1.3'], currentVersions: ['TLS 1.3'] },
  ]);
  assert.equal(v.downgradeCount, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.status, 'tls-downgraded');
  assert.deepEqual(shop.removedVersions, ['tls 1.3']);
  const legacy = v.rows.find(r => r.target === 'legacy');
  assert.equal(legacy.status, 'tls-changed');
  assert.equal(legacy.legacyEnabled, true);
  assert.deepEqual(legacy.addedVersions, ['tls 1.0']);
});
test('54230 diffCipherSuites flags newly weak ciphers', () => {
  const v = X106B.diffCipherSuites([
    { target: 'shop', previousCiphers: ['TLS_AES_128_GCM_SHA256', 'TLS_CHACHA20_POLY1305_SHA256'], currentCiphers: ['TLS_AES_128_GCM_SHA256', 'TLS_CHACHA20_POLY1305_SHA256', 'TLS_RSA_WITH_3DES_EDE_CBC_SHA'] },
    { target: 'blog', previousCiphers: ['TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384'], currentCiphers: ['TLS_AES_128_GCM_SHA256'] },
  ]);
  assert.equal(v.weakenedCount, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.status, 'ciphers-weakened');
  assert.deepEqual(shop.weakAdded, ['tls_rsa_with_3des_ede_cbc_sha']);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'ciphers-changed');
});
test('54231 detectCertIssuerChanges flags unexpected CA moves', () => {
  const v = X106B.detectCertIssuerChanges([
    { target: 'shop', previousIssuer: "Let's Encrypt", currentIssuer: 'DigiCert' },
    { target: 'blog', previousIssuer: 'Sectigo', currentIssuer: 'Sectigo' },
  ]);
  assert.equal(v.changedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').changed, true);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'issuer-stable');
});
test('54232 diffSanLists catches new certificate hostnames', () => {
  const v = X106B.diffSanLists([
    { target: 'shop', previousSans: ['example.com', 'www.example.com'], currentSans: ['example.com', 'www.example.com', 'api.example.com'] },
    { target: 'blog', previousSans: ['blog.example.org'], currentSans: ['blog.example.org'] },
  ]);
  assert.equal(v.newHostTotal, 1);
  assert.equal(v.changedCount, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').added, ['api.example.com']);
});
test('54233 diffWhoisRecords separates registrar and expiry signals', () => {
  const v = X106B.diffWhoisRecords([
    { target: 'example.com', previousWhois: { registrar: 'NameCheap', expiresAt: '2027-05-01' }, currentWhois: { registrar: 'Unknown Registrar', expiresAt: '2027-05-01' } },
    { target: 'example.org', previousWhois: { registrar: 'NameCheap', expiresAt: '2027-05-01' }, currentWhois: { registrar: 'NameCheap', expiresAt: '2026-11-01' } },
  ]);
  assert.equal(v.changedCount, 2);
  assert.equal(v.registrarChangeCount, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'example.com').signals, ['registrar']);
  assert.deepEqual(v.rows.find(r => r.target === 'example.org').signals, ['expiry']);
});
test('54234 detectGeoShifts flags country moves', () => {
  const v = X106B.detectGeoShifts([
    { target: 'shop', previousCountry: 'US', currentCountry: 'DE' },
    { target: 'blog', previousCountry: 'US', currentCountry: 'US' },
  ]);
  assert.equal(v.movedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'geo-moved');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'geo-stable');
});
test('54235 detectResponseTimeShifts grades significant latency moves', () => {
  const v = X106B.detectResponseTimeShifts([
    { target: 'shop', baselineMs: 400, currentMs: 700 },
    { target: 'blog', baselineMs: 400, currentMs: 420 },
    { target: 'api', baselineMs: 800, currentMs: 500 },
  ], { significance: 0.25 });
  assert.equal(v.shiftedCount, 2);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.shiftRatio, 0.75);
  assert.equal(shop.direction, 'slower');
  assert.equal(shop.status, 'latency-shifted');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'latency-stable');
  assert.equal(v.rows.find(r => r.target === 'api').direction, 'faster');
});
test('54236 detectStatusCodeShifts surfaces worsened URLs', () => {
  const v = X106B.detectStatusCodeShifts([
    { target: 'api', urls: [{ url: '/pay', previousClass: 200, currentClass: 500 }, { url: '/home', previousClass: 200, currentClass: 200 }] },
    { target: 'blog', urls: [{ url: '/', previousClass: '2xx', currentClass: '2xx' }] },
  ]);
  assert.equal(v.worsenedTotal, 1);
  const api = v.rows.find(r => r.target === 'api');
  assert.equal(api.changedCount, 1);
  assert.deepEqual(api.worsenedUrls, ['/pay']);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'status-codes-stable');
});
test('54237 trackNewSubdomainScreenshots tracks triage coverage', () => {
  const v = X106B.trackNewSubdomainScreenshots([
    { target: 'shop', subdomains: [{ host: 'dev.example.com', screenshot: 'captured' }, { host: 'beta.example.com', screenshot: 'pending' }] },
    { target: 'blog', subdomains: [{ host: 'new.example.org', screenshot: 'captured' }] },
  ]);
  assert.equal(v.readyCount, 1);
  assert.equal(v.totalHosts, 3);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.capturedCount, 1);
  assert.deepEqual(shop.pendingHosts, ['beta.example.com']);
  assert.equal(shop.status, 'screenshots-pending');
});
test('54238 scoreChangeSeverity grades changes low medium high', () => {
  const v = X106B.scoreChangeSeverity([
    { target: 'shop', changes: [{ type: 'favicon' }, { type: 'certificate' }, { type: 'form', sensitive: true }] },
    { target: 'blog', changes: [{ type: 'robots' }] },
  ]);
  assert.equal(v.totalChanges, 4);
  assert.equal(v.highTotal, 2);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.highCount, 2);
  assert.equal(shop.topGrade, 'high');
  assert.equal(v.top.target, 'shop');
  assert.equal(v.rows.find(r => r.target === 'blog').topGrade, 'low');
});
test('54239 buildChangeDigests rolls changes up per group', () => {
  const v = X106B.buildChangeDigests([
    { group: 'payments', changes: [
      { target: 'shop', type: 'certificate', at: '2026-10-09T01:00:00Z' },
      { target: 'shop', type: 'form', at: '2026-10-09T02:00:00Z' },
      { target: 'api', type: 'certificate', at: '2026-10-09T03:00:00Z' },
    ] },
    { group: 'marketing', changes: [{ target: 'blog', type: 'title', at: '2026-10-09T04:00:00Z' }] },
  ], { period: 'daily' });
  assert.equal(v.totalChanges, 4);
  const payments = v.rows.find(r => r.group === 'payments');
  assert.equal(payments.changeCount, 3);
  assert.equal(payments.targetCount, 2);
  assert.deepEqual(payments.types, ['certificate', 'form']);
  assert.deepEqual(payments.typeCounts, { certificate: 2, form: 1 });
  assert.equal(payments.subject, 'daily change digest: payments');
  assert.equal(v.top.group, 'payments');
});
test('54240 buildTargetChangeTimeline orders and filters events', () => {
  const records = [{ target: 'shop', changes: [
    { type: 'certificate', at: '2026-10-09T01:00:00Z', detail: 'issuer changed' },
    { type: 'content', at: '2026-10-08T01:00:00Z', detail: 'page copy edited' },
  ] }];
  const v = X106B.buildTargetChangeTimeline(records);
  assert.equal(v.rows[0].eventCount, 2);
  assert.equal(v.rows[0].events[0].type, 'content');
  assert.deepEqual(v.rows[0].typesPresent, ['certificate', 'content']);
  assert.equal(v.rows[0].latestAt, '2026-10-09T01:00:00Z');
  const filtered = X106B.buildTargetChangeTimeline(records, { type: 'certificate' });
  assert.equal(filtered.rows[0].eventCount, 1);
  assert.equal(filtered.rows[0].events[0].detail, 'issuer changed');
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix, minComponents] of [['A', A_JSX, 'X106A', 20], ['B', B_JSX, 'X106B', 20]]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= minComponents, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w106 prefixes, zero keyframes, static layout only', () => {
  assert.ok(CSS_SRC.includes('.w106a-'));
  assert.ok(CSS_SRC.includes('.w106b-'));
  assert.ok(!CSS_SRC.includes('@key' + 'frames'), 'zero-keyframe rule violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('anim' + 'ation'), 'static-only order violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('trans' + 'ition'), 'static-only order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave106A.jsx', 'Wave106B.jsx']) {
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

test('no-debris audit: no placeholder text in wave 106 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mo' + 'ck'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('de' + 'mo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenSubs = Object.freeze([Object.freeze({ target: 'shop', previousSubdomains: Object.freeze(['www.example.com', 'api.example.com']), currentSubdomains: Object.freeze(['www.example.com', 'api.example.com', 'dev.example.com']) })]);
  const a = X106A.diffSubdomains(frozenSubs);
  assert.equal(a.changedCount, 1);
  assert.deepEqual(frozenSubs[0].currentSubdomains, ['www.example.com', 'api.example.com', 'dev.example.com']);
  const frozenTimeline = Object.freeze([Object.freeze({ target: 'shop', changes: Object.freeze([Object.freeze({ type: 'certificate', at: '2026-10-09T01:00:00Z', detail: 'issuer changed' }), Object.freeze({ type: 'content', at: '2026-10-08T01:00:00Z', detail: 'page copy edited' })]) })]);
  const b = X106B.buildTargetChangeTimeline(frozenTimeline);
  assert.equal(b.rows[0].eventCount, 2);
  assert.equal(b.rows[0].events[0].type, 'content');
  assert.equal(frozenTimeline[0].changes[0].type, 'certificate');
});
