/**
 * wave106BCores.js — Infinity AI · Wave 106B
 * Change intelligence, ideas 54221–54240: sitemap, favicon, title/meta,
 * form, login-page, and file-upload change detection, WAF and CDN change
 * detection, TLS version, cipher suite, certificate issuer, and SAN list
 * changes, WHOIS and geolocation shifts, response-time and status-code
 * shift detection, screenshots for new subdomains, change severity
 * scoring, change digest rollups, and the per-target change timeline.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE106_B_IDEAS = [
  { id: 54221, title: 'Sitemap change alerts', skip: false },
  { id: 54222, title: 'Favicon change alerts', skip: false },
  { id: 54223, title: 'Title and meta change alerts', skip: false },
  { id: 54224, title: 'Form change detection', skip: false },
  { id: 54225, title: 'New login page detection', skip: false },
  { id: 54226, title: 'New file-upload detection', skip: false },
  { id: 54227, title: 'WAF on/off change detection', skip: false },
  { id: 54228, title: 'CDN change detection', skip: false },
  { id: 54229, title: 'TLS version change alerts', skip: false },
  { id: 54230, title: 'Cipher suite change alerts', skip: false },
  { id: 54231, title: 'Certificate issuer change alerts', skip: false },
  { id: 54232, title: 'SAN list change alerts', skip: false },
  { id: 54233, title: 'WHOIS change alerts', skip: false },
  { id: 54234, title: 'Hosting geolocation shifts', skip: false },
  { id: 54235, title: 'Response time shift detection', skip: false },
  { id: 54236, title: 'Status code shift detection', skip: false },
  { id: 54237, title: 'New subdomains with screenshots', skip: false },
  { id: 54238, title: 'Change severity scoring', skip: false },
  { id: 54239, title: 'Change digest emails', skip: false },
  { id: 54240, title: 'Per-target change timeline', skip: false },
];

function round2(v) { return Math.round(Number(v || 0) * 100) / 100; }
function num(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f; }
function rate(p, w) { return w ? round2(p / w) : 0; }
function strs(values) { return (Array.isArray(values) ? values : []).map(v => String(v)).filter(Boolean); }
function normSet(values) { return [...new Set(strs(values).map(v => v.trim().toLowerCase()).filter(Boolean))].sort(); }
function diffSets(prev, curr) {
  const p = new Set(prev);
  const c = new Set(curr);
  return { added: curr.filter(v => !p.has(v)), removed: prev.filter(v => !c.has(v)), overlap: curr.filter(v => p.has(v)) };
}

/** Idea 54221 — Sitemap change alerts. Input records: {target, previousUrls, currentUrls}. Sitemap additions and removals proxy site structure changes. */
export function diffSitemaps(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.previousUrls), normSet(r.currentUrls));
    return { key: target, target, added: d.added, removed: d.removed, changeCount: d.added.length + d.removed.length, status: d.added.length || d.removed.length ? 'sitemap-changed' : 'sitemap-stable' };
  }).sort((a, b) => b.changeCount - a.changeCount || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.changeCount > 0).length;
  const totalAdded = rows.reduce((s, r) => s + r.added.length, 0);
  const totalRemoved = rows.reduce((s, r) => s + r.removed.length, 0);
  return { rows, count: rows.length, changedCount, totalAdded, totalRemoved, top: rows[0] || null, summary: `Infinity AI tracked ${totalAdded} sitemap addition(s) and ${totalRemoved} removal(s).` };
}
/** Idea 54222 — Favicon change alerts. Input records: {target, previousHash, currentHash}. Favicon swaps sometimes accompany rebrands or phishing clones. */
export function detectFaviconChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = String(r.previousHash || '');
    const curr = String(r.currentHash || '');
    const changed = Boolean(prev) && Boolean(curr) && prev !== curr;
    return { key: target, target, present: Boolean(curr), changed, status: !curr ? 'favicon-missing' : changed ? 'favicon-changed' : 'favicon-stable' };
  }).sort((a, b) => Number(b.changed) - Number(a.changed) || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.changed).length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI flagged favicon swaps on ${changedCount} of ${rows.length} target(s).` };
}
/** Idea 54223 — Title and meta change alerts. Input records: {target, previousTitle, currentTitle, previousDescription, currentDescription}. Homepage wording changes worth a human look. */
export function detectTitleMetaChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const titleChanged = String(r.previousTitle || '') !== String(r.currentTitle || '');
    const descriptionChanged = String(r.previousDescription || '') !== String(r.currentDescription || '');
    return { key: target, target, titleChanged, descriptionChanged, status: titleChanged && descriptionChanged ? 'title-and-meta-changed' : titleChanged ? 'title-changed' : descriptionChanged ? 'meta-changed' : 'title-meta-stable' };
  }).sort((a, b) => Number(b.titleChanged || b.descriptionChanged) - Number(a.titleChanged || a.descriptionChanged) || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.titleChanged || r.descriptionChanged).length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI detected title or meta changes on ${changedCount} of ${rows.length} target(s).` };
}
/** Idea 54224 — Form change detection. Input records: {target, forms: [{name, sensitive, previousFields, currentFields}]}. Field gains or losses on login and payment forms are high interest. */
export function detectFormChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const forms = (Array.isArray(r.forms) ? r.forms : []).map(f => {
      const d = diffSets(normSet(f.previousFields), normSet(f.currentFields));
      const changed = d.added.length > 0 || d.removed.length > 0;
      return { name: String(f.name || 'form'), sensitive: Boolean(f.sensitive), gained: d.added, lost: d.removed, changed, sensitiveChange: changed && Boolean(f.sensitive) };
    });
    const changedForms = forms.filter(f => f.changed);
    const sensitiveChanges = forms.filter(f => f.sensitiveChange);
    return { key: target, target, formCount: forms.length, changedFormCount: changedForms.length, sensitiveChangedNames: sensitiveChanges.map(f => f.name).sort(), gainedTotal: forms.reduce((s, f) => s + f.gained.length, 0), lostTotal: forms.reduce((s, f) => s + f.lost.length, 0), status: sensitiveChanges.length ? 'sensitive-form-changed' : changedForms.length ? 'forms-changed' : 'forms-stable' };
  }).sort((a, b) => b.sensitiveChangedNames.length - a.sensitiveChangedNames.length || b.changedFormCount - a.changedFormCount || String(a.target).localeCompare(String(b.target)));
  const sensitiveCount = rows.filter(r => r.sensitiveChangedNames.length > 0).length;
  return { rows, count: rows.length, sensitiveCount, top: rows[0] || null, summary: `Infinity AI flagged sensitive form changes on ${sensitiveCount} of ${rows.length} target(s).` };
}
/** Idea 54225 — New login page detection. Input records: {target, endpoints: [{path, hasPasswordField, known}]}. Newly discovered authentication entry points queue for scope review. */
export function detectNewLoginPages(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const endpoints = (Array.isArray(r.endpoints) ? r.endpoints : []).map(e => ({ path: String(e.path || '/'), hasPasswordField: Boolean(e.hasPasswordField), known: Boolean(e.known) }));
    const fresh = endpoints.filter(e => e.hasPasswordField && !e.known).map(e => e.path).sort();
    return { key: target, target, endpointCount: endpoints.length, newLoginPaths: fresh, status: fresh.length ? 'new-login-pages-found' : 'no-new-login-pages' };
  }).sort((a, b) => b.newLoginPaths.length - a.newLoginPaths.length || String(a.target).localeCompare(String(b.target)));
  const totalNew = rows.reduce((s, r) => s + r.newLoginPaths.length, 0);
  const foundCount = rows.filter(r => r.newLoginPaths.length > 0).length;
  return { rows, count: rows.length, totalNew, foundCount, top: rows[0] || null, summary: `Infinity AI queued ${totalNew} new login page(s) for scope review across ${foundCount} target(s).` };
}
/** Idea 54226 — New file-upload detection. Input records: {target, endpoints: [{path, acceptsUpload, known}]}. Newly exposed upload functionality is high-interest change. */
export function detectNewFileUploads(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const endpoints = (Array.isArray(r.endpoints) ? r.endpoints : []).map(e => ({ path: String(e.path || '/'), acceptsUpload: Boolean(e.acceptsUpload), known: Boolean(e.known) }));
    const fresh = endpoints.filter(e => e.acceptsUpload && !e.known).map(e => e.path).sort();
    return { key: target, target, endpointCount: endpoints.length, newUploadPaths: fresh, status: fresh.length ? 'new-upload-endpoints' : 'no-new-uploads' };
  }).sort((a, b) => b.newUploadPaths.length - a.newUploadPaths.length || String(a.target).localeCompare(String(b.target)));
  const totalNew = rows.reduce((s, r) => s + r.newUploadPaths.length, 0);
  const foundCount = rows.filter(r => r.newUploadPaths.length > 0).length;
  return { rows, count: rows.length, totalNew, foundCount, top: rows[0] || null, summary: `Infinity AI highlighted ${totalNew} newly exposed upload endpoint(s) on ${foundCount} target(s).` };
}
/** Idea 54227 — WAF on/off change detection. Input records: {target, previousWaf, currentWaf}. WAF presence appearing or disappearing between checks changes hunt strategy. */
export function detectWafChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = String(r.previousWaf || '').trim();
    const curr = String(r.currentWaf || '').trim();
    const status = !prev && curr ? 'waf-appeared' : prev && !curr ? 'waf-disappeared' : prev && curr && prev.toLowerCase() !== curr.toLowerCase() ? 'waf-switched' : 'waf-unchanged';
    return { key: target, target, previousWaf: prev, currentWaf: curr, status };
  }).sort((a, b) => Number(b.status !== 'waf-unchanged') - Number(a.status !== 'waf-unchanged') || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.status !== 'waf-unchanged').length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI detected WAF posture changes on ${changedCount} of ${rows.length} target(s).` };
}
/** Idea 54228 — CDN change detection. Input records: {target, previousCdn, currentCdn}. CDN provider switches alter edge behaviour and caching. */
export function detectCdnChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = String(r.previousCdn || '').trim();
    const curr = String(r.currentCdn || '').trim();
    const status = !prev && curr ? 'cdn-appeared' : prev && !curr ? 'cdn-removed' : prev && curr && prev.toLowerCase() !== curr.toLowerCase() ? 'cdn-switched' : 'cdn-unchanged';
    return { key: target, target, previousCdn: prev, currentCdn: curr, status };
  }).sort((a, b) => Number(b.status !== 'cdn-unchanged') - Number(a.status !== 'cdn-unchanged') || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.status !== 'cdn-unchanged').length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI detected CDN changes on ${changedCount} of ${rows.length} target(s).` };
}
/** Idea 54229 — TLS version change alerts. Input records: {target, previousVersions, currentVersions}. A drop in the best supported version, or re-enabled legacy versions, weakens transport security. */
export function detectTlsVersionChanges(records = []) {
  const rank = { 'ssl 3.0': 0, 'tls 1.0': 1, 'tls 1.1': 2, 'tls 1.2': 3, 'tls 1.3': 4 };
  const tlsName = v => { const s = String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); return /^\d+\.\d+$/.test(s) ? `tls ${s}` : s; };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = normSet((Array.isArray(r.previousVersions) ? r.previousVersions : []).map(tlsName));
    const curr = normSet((Array.isArray(r.currentVersions) ? r.currentVersions : []).map(tlsName));
    const d = diffSets(prev, curr);
    const prevMax = prev.reduce((m, n) => Math.max(m, rank[n] ?? -1), -1);
    const currMax = curr.reduce((m, n) => Math.max(m, rank[n] ?? -1), -1);
    const downgraded = prevMax >= 0 && currMax >= 0 && currMax < prevMax;
    const legacyEnabled = d.added.some(n => n === 'tls 1.0' || n === 'tls 1.1' || n === 'ssl 3.0');
    return { key: target, target, previousVersions: prev, currentVersions: curr, addedVersions: d.added, removedVersions: d.removed, downgraded, legacyEnabled, status: downgraded ? 'tls-downgraded' : d.added.length || d.removed.length ? 'tls-changed' : 'tls-stable' };
  }).sort((a, b) => Number(b.downgraded) - Number(a.downgraded) || String(a.target).localeCompare(String(b.target)));
  const downgradeCount = rows.filter(r => r.downgraded).length;
  return { rows, count: rows.length, downgradeCount, top: rows[0] || null, summary: `Infinity AI flagged TLS version downgrades on ${downgradeCount} of ${rows.length} target(s).` };
}
/** Idea 54230 — Cipher suite change alerts. Input records: {target, previousCiphers, currentCiphers}; scenario.weakCiphers overrides the weak list. Newly offered weak ciphers weaken transport security. */
export function diffCipherSuites(records = [], scenario = {}) {
  const weak = (Array.isArray(scenario.weakCiphers) ? scenario.weakCiphers : ['RC4', 'DES', '3DES', 'EXPORT', 'NULL', 'MD5']).map(w => String(w).toUpperCase());
  const isWeak = name => { const upper = String(name).toUpperCase(); return weak.some(w => upper.split(/[-_]/).includes(w) || upper.includes(w)); };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.previousCiphers), normSet(r.currentCiphers));
    const weakAdded = d.added.filter(isWeak);
    return { key: target, target, added: d.added, removed: d.removed, weakAdded, weakened: weakAdded.length > 0, status: weakAdded.length ? 'ciphers-weakened' : d.added.length || d.removed.length ? 'ciphers-changed' : 'ciphers-stable' };
  }).sort((a, b) => Number(b.weakened) - Number(a.weakened) || String(a.target).localeCompare(String(b.target)));
  const weakenedCount = rows.filter(r => r.weakened).length;
  return { rows, count: rows.length, weakenedCount, top: rows[0] || null, summary: `Infinity AI flagged weakened cipher suites on ${weakenedCount} of ${rows.length} target(s).` };
}
/** Idea 54231 — Certificate issuer change alerts. Input records: {target, previousIssuer, currentIssuer}. Unexpected CA changes can indicate mis-issuance. */
export function detectCertIssuerChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = String(r.previousIssuer || '').trim();
    const curr = String(r.currentIssuer || '').trim();
    const changed = prev.toLowerCase() !== curr.toLowerCase();
    return { key: target, target, previousIssuer: prev, currentIssuer: curr, changed, status: changed ? 'issuer-changed' : 'issuer-stable' };
  }).sort((a, b) => Number(b.changed) - Number(a.changed) || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.changed).length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI flagged certificate issuer changes on ${changedCount} of ${rows.length} target(s).` };
}
/** Idea 54232 — SAN list change alerts. Input records: {target, previousSans, currentSans}. New Subject Alternative Names catch new hostnames early. */
export function diffSanLists(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.previousSans), normSet(r.currentSans));
    return { key: target, target, added: d.added, removed: d.removed, status: d.added.length || d.removed.length ? 'san-changed' : 'san-stable' };
  }).sort((a, b) => b.added.length - a.added.length || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.status === 'san-changed').length;
  const newHostTotal = rows.reduce((s, r) => s + r.added.length, 0);
  return { rows, count: rows.length, changedCount, newHostTotal, top: rows[0] || null, summary: `Infinity AI found ${newHostTotal} new certificate hostname(s) across ${changedCount} target(s).` };
}
/** Idea 54233 — WHOIS change alerts. Input records: {target, previousWhois: {registrar, expiresAt, registrant}, currentWhois: {...}}. Registrar and expiry changes are domain-hijack signals. */
export function diffWhoisRecords(records = []) {
  const clean = w => (w && typeof w === 'object' ? w : {});
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = clean(r.previousWhois);
    const curr = clean(r.currentWhois);
    const registrarChanged = String(prev.registrar || '').trim().toLowerCase() !== String(curr.registrar || '').trim().toLowerCase();
    const expiryChanged = String(prev.expiresAt || '') !== String(curr.expiresAt || '');
    const registrantChanged = String(prev.registrant || '').trim().toLowerCase() !== String(curr.registrant || '').trim().toLowerCase();
    const signals = [registrarChanged && 'registrar', expiryChanged && 'expiry', registrantChanged && 'registrant'].filter(Boolean);
    return { key: target, target, registrarChanged, expiryChanged, registrantChanged, signals, status: signals.length ? 'whois-changed' : 'whois-stable' };
  }).sort((a, b) => Number(b.registrarChanged) - Number(a.registrarChanged) || b.signals.length - a.signals.length || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.signals.length > 0).length;
  const registrarChangeCount = rows.filter(r => r.registrarChanged).length;
  return { rows, count: rows.length, changedCount, registrarChangeCount, top: rows[0] || null, summary: `Infinity AI flagged WHOIS changes on ${changedCount} target(s); ${registrarChangeCount} registrar move(s).` };
}
/** Idea 54234 — Hosting geolocation shifts. Input records: {target, previousCountry, currentCountry}. Resolved locations moving countries unexpectedly are alerted. */
export function detectGeoShifts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = String(r.previousCountry || '').trim();
    const curr = String(r.currentCountry || '').trim();
    const known = Boolean(prev) && Boolean(curr);
    const moved = known && prev.toLowerCase() !== curr.toLowerCase();
    return { key: target, target, previousCountry: prev, currentCountry: curr, status: !known ? 'geo-unknown' : moved ? 'geo-moved' : 'geo-stable' };
  }).sort((a, b) => Number(b.status === 'geo-moved') - Number(a.status === 'geo-moved') || String(a.target).localeCompare(String(b.target)));
  const movedCount = rows.filter(r => r.status === 'geo-moved').length;
  return { rows, count: rows.length, movedCount, top: rows[0] || null, summary: `Infinity AI detected hosting country moves on ${movedCount} of ${rows.length} target(s).` };
}
/** Idea 54235 — Response time shift detection. Input records: {target, baselineMs, currentMs}; scenario.significance sets the shift ratio. Statistically significant latency shifts suggest infrastructure changes. */
export function detectResponseTimeShifts(records = [], scenario = {}) {
  const significance = Math.max(0, num(scenario.significance, 0.25));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const baseline = Math.max(0, num(r.baselineMs, 0));
    const current = Math.max(0, num(r.currentMs, 0));
    const shiftRatio = baseline > 0 ? round2((current - baseline) / baseline) : 0;
    const shifted = Math.abs(shiftRatio) >= significance;
    return { key: target, target, baselineMs: baseline, currentMs: current, shiftRatio, direction: shiftRatio > 0 ? 'slower' : shiftRatio < 0 ? 'faster' : 'flat', status: shifted ? 'latency-shifted' : 'latency-stable' };
  }).sort((a, b) => Math.abs(b.shiftRatio) - Math.abs(a.shiftRatio) || String(a.target).localeCompare(String(b.target)));
  const shiftedCount = rows.filter(r => r.status === 'latency-shifted').length;
  return { rows, count: rows.length, shiftedCount, significance, top: rows[0] || null, summary: `Infinity AI flagged significant response-time shifts on ${shiftedCount} of ${rows.length} target(s).` };
}
/** Idea 54236 — Status code shift detection. Input records: {target, urls: [{url, previousClass, currentClass}]}. Key URLs returning different status classes are reported, worsened ones first. */
export function detectStatusCodeShifts(records = []) {
  const rank = { '2xx': 4, '3xx': 3, '4xx': 2, '5xx': 1, '0xx': 0 };
  const codeClass = v => { const s = String(v || '').toLowerCase(); if (s.includes('xx')) return s; const c = num(v, 0); return c >= 500 ? '5xx' : c >= 400 ? '4xx' : c >= 300 ? '3xx' : c >= 200 ? '2xx' : '0xx'; };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const entries = (Array.isArray(r.urls) ? r.urls : []).map(u => {
      const prev = codeClass(u.previousClass);
      const curr = codeClass(u.currentClass);
      return { url: String(u.url || '/'), previousClass: prev, currentClass: curr, changed: prev !== curr, worsened: (rank[curr] ?? 0) < (rank[prev] ?? 0) };
    });
    const worsened = entries.filter(e => e.worsened);
    return { key: target, target, urlCount: entries.length, changedCount: entries.filter(e => e.changed).length, worsenedUrls: worsened.map(e => e.url).sort(), status: entries.some(e => e.changed) ? 'status-codes-shifted' : 'status-codes-stable' };
  }).sort((a, b) => b.worsenedUrls.length - a.worsenedUrls.length || b.changedCount - a.changedCount || String(a.target).localeCompare(String(b.target)));
  const worsenedTotal = rows.reduce((s, r) => s + r.worsenedUrls.length, 0);
  return { rows, count: rows.length, worsenedTotal, top: rows[0] || null, summary: `Infinity AI flagged status code shifts on ${rows.length} target(s); ${worsenedTotal} URL(s) worsened.` };
}
/** Idea 54237 — New subdomains with screenshots. Input records: {target, subdomains: [{host, screenshot}]}. Each newly found subdomain gets a screenshot for quick triage. */
export function trackNewSubdomainScreenshots(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const subs = (Array.isArray(r.subdomains) ? r.subdomains : []).map(s => ({ host: String(s.host || 'host'), screenshot: ['captured', 'pending', 'failed'].includes(String(s.screenshot || '').toLowerCase()) ? String(s.screenshot).toLowerCase() : 'pending' }));
    const captured = subs.filter(s => s.screenshot === 'captured');
    return { key: target, target, hostCount: subs.length, capturedCount: captured.length, pendingHosts: subs.filter(s => s.screenshot !== 'captured').map(s => s.host).sort(), coverage: rate(captured.length, subs.length), status: subs.length && captured.length === subs.length ? 'screenshots-ready' : 'screenshots-pending' };
  }).sort((a, b) => a.coverage - b.coverage || String(a.target).localeCompare(String(b.target)));
  const readyCount = rows.filter(r => r.status === 'screenshots-ready').length;
  const totalHosts = rows.reduce((s, r) => s + r.hostCount, 0);
  return { rows, count: rows.length, readyCount, totalHosts, top: rows[0] || null, summary: `Infinity AI captured triage screenshots for new subdomains on ${readyCount} of ${rows.length} target(s).` };
}
/** Idea 54238 — Change severity scoring. Input records: {target, changes: [{type, sensitive}]}. Each detected change is graded low, medium, or high so noisy diffs do not drown signals. */
export function scoreChangeSeverity(records = []) {
  const points = { nameserver: 3, certificate: 3, tls: 3, form: 3, 'login-page': 3, upload: 3, dns: 2, ip: 2, asn: 2, ports: 2, subdomain: 2, endpoint: 2, redirect: 2, headers: 2, 'status-code': 2, waf: 2, cdn: 2, whois: 2, content: 1, favicon: 1, title: 1, robots: 1, sitemap: 1, 'response-time': 1, geo: 1, bundle: 1, soa: 1 };
  const grade = score => (score >= 3 ? 'high' : score === 2 ? 'medium' : 'low');
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const changes = (Array.isArray(r.changes) ? r.changes : []).map(c => {
      const type = String(c.type || 'change').toLowerCase();
      const score = (points[type] ?? 1) + (c.sensitive ? 1 : 0);
      return { type, sensitive: Boolean(c.sensitive), score, grade: grade(score) };
    }).sort((a, b) => b.score - a.score || String(a.type).localeCompare(String(b.type)));
    return { key: target, target, changes, changeCount: changes.length, highCount: changes.filter(c => c.grade === 'high').length, mediumCount: changes.filter(c => c.grade === 'medium').length, lowCount: changes.filter(c => c.grade === 'low').length, topGrade: changes.length ? changes[0].grade : 'none', status: changes.some(c => c.grade === 'high') ? 'high-severity-changes' : changes.length ? 'routine-changes' : 'no-changes' };
  }).sort((a, b) => b.highCount - a.highCount || String(a.target).localeCompare(String(b.target)));
  const highTotal = rows.reduce((s, r) => s + r.highCount, 0);
  const totalChanges = rows.reduce((s, r) => s + r.changeCount, 0);
  return { rows, count: rows.length, totalChanges, highTotal, top: rows[0] || null, summary: `Infinity AI graded ${totalChanges} detected change(s); ${highTotal} rated high severity.` };
}
/** Idea 54239 — Change digest emails. Input records: {group, changes: [{target, type, at}]}; scenario.period labels the rollup. Daily or weekly digests per target group keep inboxes quiet between hunts. */
export function buildChangeDigests(records = [], scenario = {}) {
  const period = String(scenario.period || 'daily');
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const group = String(r.group || 'default');
    const changes = (Array.isArray(r.changes) ? r.changes : []).map(c => ({ target: String(c.target || 'target'), type: String(c.type || 'change').toLowerCase(), at: String(c.at || '') }));
    const typeCounts = {};
    for (const c of changes) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    return { key: group, group, changeCount: changes.length, targetCount: [...new Set(changes.map(c => c.target))].length, types: Object.keys(typeCounts).sort(), typeCounts, subject: `${period} change digest: ${group}`, status: changes.length ? 'digest-ready' : 'digest-empty' };
  }).sort((a, b) => b.changeCount - a.changeCount || String(a.group).localeCompare(String(b.group)));
  const totalChanges = rows.reduce((s, r) => s + r.changeCount, 0);
  return { rows, count: rows.length, totalChanges, period, top: rows[0] || null, summary: `Infinity AI prepared ${period} change digests covering ${totalChanges} change(s) across ${rows.length} group(s).` };
}
/** Idea 54240 — Per-target change timeline. Input records: {target, changes: [{type, at, detail}]}; scenario.type filters the stream. Every detected change lands on the target timeline, filterable by type. */
export function buildTargetChangeTimeline(records = [], scenario = {}) {
  const filterType = scenario.type ? String(scenario.type).toLowerCase() : null;
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const all = (Array.isArray(r.changes) ? r.changes : []).map(c => ({ type: String(c.type || 'change').toLowerCase(), at: String(c.at || ''), detail: String(c.detail || '') })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const events = filterType ? all.filter(e => e.type === filterType) : all;
    return { key: target, target, events, eventCount: events.length, totalEvents: all.length, typesPresent: [...new Set(all.map(e => e.type))].sort(), latestAt: all.length ? all[all.length - 1].at : null, status: events.length ? 'timeline-active' : 'timeline-empty' };
  }).sort((a, b) => b.totalEvents - a.totalEvents || String(a.target).localeCompare(String(b.target)));
  const totalEvents = rows.reduce((s, r) => s + r.eventCount, 0);
  return { rows, count: rows.length, totalEvents, filterType, top: rows[0] || null, summary: `Infinity AI timelines hold ${totalEvents} change event(s) across ${rows.length} target(s).` };
}
