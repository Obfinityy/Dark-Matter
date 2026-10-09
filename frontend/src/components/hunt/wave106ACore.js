/**
 * wave106ACore.js — Infinity AI · Wave 106A
 * Change-detection alerts, ideas 54201–54220: database-backed page checks,
 * webhook receiver checks, business-hours scheduling, alert acknowledgment,
 * subdomain and endpoint diffs, certificate transparency monitoring, DNS,
 * IP, ASN, and nameserver change alerts, SOA serial tracking, technology
 * stack and JavaScript bundle changes, page-content and header diffs, new
 * port and removed endpoint alerts, redirect target changes, robots diffs.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE106_A_IDEAS = [
  { id: 54201, title: 'Database-backed page checks', skip: false },
  { id: 54202, title: 'Webhook receiver checks', skip: false },
  { id: 54203, title: 'Business-hours check schedule', skip: false },
  { id: 54204, title: 'Health alert acknowledgment', skip: false },
  { id: 54205, title: 'Subdomain diff alerts', skip: false },
  { id: 54206, title: 'New endpoint discovery alerts', skip: false },
  { id: 54207, title: 'Certificate transparency monitoring (targets)', skip: false },
  { id: 54208, title: 'DNS record change alerts', skip: false },
  { id: 54209, title: 'IP address change alerts', skip: false },
  { id: 54210, title: 'ASN change alerts', skip: false },
  { id: 54211, title: 'Nameserver change alerts', skip: false },
  { id: 54212, title: 'SOA serial tracking', skip: false },
  { id: 54213, title: 'Technology stack change alerts', skip: false },
  { id: 54214, title: 'JavaScript bundle change alerts', skip: false },
  { id: 54215, title: 'Page content diff', skip: false },
  { id: 54216, title: 'HTTP header change alerts', skip: false },
  { id: 54217, title: 'New open ports alerts', skip: false },
  { id: 54218, title: 'Removed endpoint alerts', skip: false },
  { id: 54219, title: 'Redirect target changes', skip: false },
  { id: 54220, title: 'robots.txt change alerts', skip: false },
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
function ok2xx(code) { const c = num(code, 0); return c >= 200 && c < 300; }

/** Idea 54201 — Database-backed page checks. Input records: {target, markers, pageText, dataAgeSeconds, maxAgeSeconds}. Fresh markers plus a young data age prove the page renders live data, not a cached error shell. */
export function checkDatabaseBackedPages(records = [], scenario = {}) {
  const defaultMaxAge = Math.max(0, num(scenario.maxAgeSeconds, 300));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const markers = strs(r.markers);
    const text = String(r.pageText || '').toLowerCase();
    const found = markers.filter(m => text.includes(m.toLowerCase()));
    const missing = markers.filter(m => !text.includes(m.toLowerCase()));
    const age = Math.max(0, num(r.dataAgeSeconds, 0));
    const maxAge = Math.max(0, num(r.maxAgeSeconds, defaultMaxAge));
    const stale = age > maxAge;
    return { key: target, target, markerCount: markers.length, foundCount: found.length, missing, dataAgeSeconds: age, maxAgeSeconds: maxAge, freshness: rate(found.length, markers.length), status: missing.length ? 'fresh-data-missing' : stale ? 'data-stale' : 'data-fresh' };
  }).sort((a, b) => a.freshness - b.freshness || b.dataAgeSeconds - a.dataAgeSeconds || String(a.target).localeCompare(String(b.target)));
  const freshCount = rows.filter(r => r.status === 'data-fresh').length;
  return { rows, count: rows.length, freshCount, top: rows[0] || null, summary: `Infinity AI verified fresh database-backed data on ${freshCount} of ${rows.length} page(s).` };
}
/** Idea 54202 — Webhook receiver checks. Input records: {target, ackStatus, ackLatencyMs}. Receivers must acknowledge test payloads with a 2xx, quickly. */
export function checkWebhookReceivers(records = [], scenario = {}) {
  const maxAck = Math.max(1, num(scenario.maxAckMs, 1000));
  const rank = { 'webhook-unacknowledged': 0, 'webhook-slow-ack': 1, 'webhook-acknowledged': 2 };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const code = num(r.ackStatus, 0);
    const acked = ok2xx(code);
    const latency = Math.max(0, num(r.ackLatencyMs, 0));
    const slow = acked && latency > maxAck;
    return { key: target, target, ackStatus: code, ackLatencyMs: latency, acked, status: !acked ? 'webhook-unacknowledged' : slow ? 'webhook-slow-ack' : 'webhook-acknowledged' };
  }).sort((a, b) => rank[a.status] - rank[b.status] || b.ackLatencyMs - a.ackLatencyMs);
  const ackedCount = rows.filter(r => r.status === 'webhook-acknowledged').length;
  const slowCount = rows.filter(r => r.status === 'webhook-slow-ack').length;
  return { rows, count: rows.length, ackedCount, slowCount, top: rows[0] || null, summary: `Infinity AI confirmed webhook acknowledgements on ${ackedCount} of ${rows.length} receiver(s).` };
}
/** Idea 54203 — Business-hours check schedule. Input records: {target, startHour, endHour, sleepsOvernight}; scenario.nowHour. Sleeping targets are only probed inside business hours. */
export function planBusinessHoursChecks(records = [], scenario = {}) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const start = Math.max(0, Math.min(23, num(r.startHour, 9)));
    const end = Math.max(0, Math.min(23, num(r.endHour, 17)));
    const hour = Math.max(0, Math.min(23, num(scenario.nowHour, num(r.nowHour, 12))));
    const within = start <= end ? hour >= start && hour < end : hour >= start || hour < end;
    const sleeps = Boolean(r.sleepsOvernight);
    const running = !sleeps || within;
    return { key: target, target, startHour: start, endHour: end, nowHour: hour, withinHours: within, sleepsOvernight: sleeps, status: running ? 'checks-running' : 'checks-paused' };
  }).sort((a, b) => Number(a.status === 'checks-running') - Number(b.status === 'checks-running') || String(a.target).localeCompare(String(b.target)));
  const runningCount = rows.filter(r => r.status === 'checks-running').length;
  return { rows, count: rows.length, runningCount, pausedCount: rows.length - runningCount, top: rows[0] || null, summary: `Infinity AI runs business-hours checks for ${runningCount} of ${rows.length} target(s) at this hour.` };
}
/** Idea 54204 — Health alert acknowledgment. Input records: {target, alertId, state}. Acknowledged incidents stop repeat notifications; escalated ones stay loud. */
export function trackAlertAcknowledgments(records = []) {
  const rank = { 'alert-escalated': 0, 'alert-open': 1, 'alert-acknowledged': 2 };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const alertId = String(r.alertId || 'alert');
    const raw = String(r.state || 'open').toLowerCase();
    const state = ['acknowledged', 'escalated', 'open'].includes(raw) ? raw : 'open';
    return { key: `${target}|${alertId}`, target, alertId, state, silenced: state === 'acknowledged', status: `alert-${state}` };
  }).sort((a, b) => rank[a.status] - rank[b.status] || String(a.key).localeCompare(String(b.key)));
  const ackedCount = rows.filter(r => r.state === 'acknowledged').length;
  const escalatedCount = rows.filter(r => r.state === 'escalated').length;
  return { rows, count: rows.length, ackedCount, escalatedCount, openCount: rows.length - ackedCount - escalatedCount, top: rows[0] || null, summary: `Infinity AI tracks ${ackedCount} acknowledged, ${escalatedCount} escalated, ${rows.length - ackedCount - escalatedCount} open alert(s).` };
}
/** Idea 54205 — Subdomain diff alerts. Input records: {target, previousSubdomains, currentSubdomains}. Additions and removals between runs are surfaced per target. */
export function diffSubdomains(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.previousSubdomains), normSet(r.currentSubdomains));
    return { key: target, target, added: d.added, removed: d.removed, changeCount: d.added.length + d.removed.length, status: d.added.length || d.removed.length ? 'subdomains-changed' : 'subdomains-stable' };
  }).sort((a, b) => b.changeCount - a.changeCount || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.changeCount > 0).length;
  const totalAdded = rows.reduce((s, r) => s + r.added.length, 0);
  const totalRemoved = rows.reduce((s, r) => s + r.removed.length, 0);
  return { rows, count: rows.length, changedCount, totalAdded, totalRemoved, top: rows[0] || null, summary: `Infinity AI found ${totalAdded} new and ${totalRemoved} removed subdomain(s) across ${changedCount} target(s).` };
}
/** Idea 54206 — New endpoint discovery alerts. Input records: {target, knownEndpoints, crawledEndpoints}. Previously unseen routes in crawl data raise a review alert. */
export function discoverNewEndpoints(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.knownEndpoints), normSet(r.crawledEndpoints));
    return { key: target, target, newEndpoints: d.added, newCount: d.added.length, goneCount: d.removed.length, status: d.added.length ? 'new-endpoints-found' : 'no-new-endpoints' };
  }).sort((a, b) => b.newCount - a.newCount || String(a.target).localeCompare(String(b.target)));
  const totalNew = rows.reduce((s, r) => s + r.newCount, 0);
  const foundCount = rows.filter(r => r.newCount > 0).length;
  return { rows, count: rows.length, totalNew, foundCount, top: rows[0] || null, summary: `Infinity AI discovered ${totalNew} previously unseen endpoint(s) on ${foundCount} target(s).` };
}
/** Idea 54207 — Certificate transparency monitoring (targets). Input records: {target, expectedDomains, certs: [{subject, sans}]}. Certificates covering hostnames outside the target's expected domains are flagged. */
export function monitorCertificateTransparency(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const expected = normSet(r.expectedDomains);
    const certs = (Array.isArray(r.certs) ? r.certs : []).map(c => {
      const hosts = normSet([c.subject, ...(Array.isArray(c.sans) ? c.sans : [])]);
      const unexpected = hosts.filter(h => !expected.includes(h) && !expected.some(d => h.endsWith(`.${d}`)));
      return { subject: String(c.subject || ''), hosts, unexpected, flagged: unexpected.length > 0 };
    });
    const flagged = certs.filter(c => c.flagged);
    const unexpectedHosts = [...new Set(flagged.flatMap(c => c.unexpected))].sort();
    return { key: target, target, certCount: certs.length, flaggedCount: flagged.length, unexpectedHosts, status: flagged.length ? 'unexpected-certificate' : 'certificates-expected' };
  }).sort((a, b) => b.flaggedCount - a.flaggedCount || String(a.target).localeCompare(String(b.target)));
  const flaggedTargets = rows.filter(r => r.flaggedCount > 0).length;
  return { rows, count: rows.length, flaggedTargets, top: rows[0] || null, summary: `Infinity AI flagged unexpected certificates on ${flaggedTargets} of ${rows.length} target(s).` };
}
/** Idea 54208 — DNS record change alerts. Input records: {target, recordType, previousValues, currentValues}. Before/after values are reported for every changed record set. */
export function diffDnsRecords(records = []) {
  const sensitiveTypes = ['NS', 'MX', 'TXT'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const type = String(r.recordType || 'A').toUpperCase();
    const d = diffSets(normSet(r.previousValues), normSet(r.currentValues));
    return { key: `${target}|${type}`, target, recordType: type, added: d.added, removed: d.removed, sensitiveType: sensitiveTypes.includes(type), status: d.added.length || d.removed.length ? 'dns-changed' : 'dns-stable' };
  }).sort((a, b) => Number(b.status === 'dns-changed') - Number(a.status === 'dns-changed') || String(a.key).localeCompare(String(b.key)));
  const changedCount = rows.filter(r => r.status === 'dns-changed').length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI detected changes in ${changedCount} of ${rows.length} DNS record set(s).` };
}
/** Idea 54209 — IP address change alerts. Input records: {target, previousIps, currentIps}. A full address swap hints at migration or takeover risk. */
export function detectIpChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.previousIps), normSet(r.currentIps));
    const changed = d.added.length > 0 || d.removed.length > 0;
    return { key: target, target, added: d.added, removed: d.removed, overlap: d.overlap, status: !changed ? 'ip-stable' : d.overlap.length ? 'ip-partially-changed' : 'ip-fully-changed' };
  }).sort((a, b) => Number(b.status === 'ip-fully-changed') - Number(a.status === 'ip-fully-changed') || b.added.length - a.added.length || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.status !== 'ip-stable').length;
  const fullSwapCount = rows.filter(r => r.status === 'ip-fully-changed').length;
  return { rows, count: rows.length, changedCount, fullSwapCount, top: rows[0] || null, summary: `Infinity AI detected hosting IP changes on ${changedCount} target(s); ${fullSwapCount} full swap(s).` };
}
/** Idea 54210 — ASN change alerts. Input records: {target, previousAsn, currentAsn, previousProvider, currentProvider}. Moves between autonomous systems or providers are flagged. */
export function detectAsnChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prevAsn = String(r.previousAsn || '').trim();
    const currAsn = String(r.currentAsn || '').trim();
    const prevProvider = String(r.previousProvider || '').trim();
    const currProvider = String(r.currentProvider || '').trim();
    const changed = prevAsn !== currAsn || prevProvider.toLowerCase() !== currProvider.toLowerCase();
    return { key: target, target, previousAsn: prevAsn, currentAsn: currAsn, previousProvider: prevProvider, currentProvider: currProvider, status: changed ? 'asn-changed' : 'asn-stable' };
  }).sort((a, b) => Number(b.status === 'asn-changed') - Number(a.status === 'asn-changed') || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.status === 'asn-changed').length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI flagged ASN or provider moves on ${changedCount} of ${rows.length} target(s).` };
}
/** Idea 54211 — Nameserver change alerts. Input records: {target, previousNs, currentNs}. Full delegation swaps can signal DNS hijacking. */
export function detectNameserverChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.previousNs), normSet(r.currentNs));
    const changed = d.added.length > 0 || d.removed.length > 0;
    return { key: target, target, added: d.added, removed: d.removed, status: !changed ? 'ns-stable' : d.overlap.length ? 'ns-partially-changed' : 'ns-full-change' };
  }).sort((a, b) => Number(b.status === 'ns-full-change') - Number(a.status === 'ns-full-change') || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.status !== 'ns-stable').length;
  const fullChangeCount = rows.filter(r => r.status === 'ns-full-change').length;
  return { rows, count: rows.length, changedCount, fullChangeCount, top: rows[0] || null, summary: `Infinity AI detected nameserver changes on ${changedCount} target(s); ${fullChangeCount} full delegation swap(s).` };
}
/** Idea 54212 — SOA serial tracking. Input records: {target, previousSerial, currentSerial}. Serial increments are a lightweight signal of zone edits; regressions are anomalies. */
export function trackSoaSerials(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = num(r.previousSerial, 0);
    const curr = num(r.currentSerial, 0);
    const delta = curr - prev;
    return { key: target, target, previousSerial: prev, currentSerial: curr, delta, status: delta > 0 ? 'zone-edited' : delta < 0 ? 'serial-regressed' : 'zone-unchanged' };
  }).sort((a, b) => b.delta - a.delta || String(a.target).localeCompare(String(b.target)));
  const editedCount = rows.filter(r => r.status === 'zone-edited').length;
  const regressedCount = rows.filter(r => r.status === 'serial-regressed').length;
  return { rows, count: rows.length, editedCount, regressedCount, top: rows[0] || null, summary: `Infinity AI tracked SOA serial edits on ${editedCount} zone(s); ${regressedCount} regression(s).` };
}
/** Idea 54213 — Technology stack change alerts. Input records: {target, previousTech, currentTech}. Server, framework, or CDN swaps between profile refreshes are diffed. */
export function detectTechStackChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.previousTech), normSet(r.currentTech));
    return { key: target, target, added: d.added, removed: d.removed, changeCount: d.added.length + d.removed.length, status: d.added.length || d.removed.length ? 'stack-changed' : 'stack-stable' };
  }).sort((a, b) => b.changeCount - a.changeCount || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.changeCount > 0).length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI detected technology stack changes on ${changedCount} of ${rows.length} target(s).` };
}
/** Idea 54214 — JavaScript bundle change alerts. Input records: {target, previousBundles: [{name, hash, sizeKb}], currentBundles: [...]}. New, removed, or heavily modified scripts are flagged by name. */
export function detectJsBundleChanges(records = [], scenario = {}) {
  const heavyKb = Math.max(0, num(scenario.heavySizeDeltaKb, 100));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prevList = (Array.isArray(r.previousBundles) ? r.previousBundles : []).map(b => ({ name: String(b.name || 'bundle'), hash: String(b.hash || ''), sizeKb: Math.max(0, num(b.sizeKb, 0)) }));
    const currList = (Array.isArray(r.currentBundles) ? r.currentBundles : []).map(b => ({ name: String(b.name || 'bundle'), hash: String(b.hash || ''), sizeKb: Math.max(0, num(b.sizeKb, 0)) }));
    const prevByName = new Map(prevList.map(b => [b.name, b]));
    const currByName = new Map(currList.map(b => [b.name, b]));
    const added = currList.filter(b => !prevByName.has(b.name)).map(b => b.name).sort();
    const removed = prevList.filter(b => !currByName.has(b.name)).map(b => b.name).sort();
    const modified = currList.filter(b => prevByName.has(b.name) && prevByName.get(b.name).hash !== b.hash)
      .map(b => ({ name: b.name, sizeDeltaKb: round2(b.sizeKb - prevByName.get(b.name).sizeKb) }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const heavyCount = modified.filter(m => Math.abs(m.sizeDeltaKb) >= heavyKb).length;
    return { key: target, target, bundleCount: currList.length, added, removed, modified, heavyCount, changeCount: added.length + removed.length + modified.length, status: added.length || removed.length || modified.length ? 'bundles-changed' : 'bundles-stable' };
  }).sort((a, b) => b.changeCount - a.changeCount || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.changeCount > 0).length;
  return { rows, count: rows.length, changedCount, top: rows[0] || null, summary: `Infinity AI detected JavaScript bundle changes on ${changedCount} of ${rows.length} target(s).` };
}
/** Idea 54215 — Page content diff. Input records: {target, previousText, currentText}. Word-level additions and removals between snapshots, graded by change ratio. */
export function diffPageContent(records = [], scenario = {}) {
  const threshold = Math.max(0, num(scenario.threshold, 0.1));
  const words = text => [...new Set((String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []))].sort();
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(words(r.previousText), words(r.currentText));
    const union = new Set([...words(r.previousText), ...words(r.currentText)]).size;
    const changeRatio = rate(d.added.length + d.removed.length, union);
    return { key: target, target, addedWords: d.added, removedWords: d.removed, changeRatio, status: changeRatio > threshold ? 'content-changed' : 'content-stable' };
  }).sort((a, b) => b.changeRatio - a.changeRatio || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.status === 'content-changed').length;
  return { rows, count: rows.length, changedCount, threshold, top: rows[0] || null, summary: `Infinity AI flagged meaningful page content changes on ${changedCount} of ${rows.length} page(s).` };
}
/** Idea 54216 — HTTP header change alerts. Input records: {target, previousHeaders, currentHeaders}. Security header changes are separated from routine header churn. */
export function diffHttpHeaders(records = []) {
  const security = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
  const toMap = obj => {
    const m = {};
    for (const [k, v] of Object.entries(obj && typeof obj === 'object' ? obj : {})) m[String(k).toLowerCase()] = String(v);
    return m;
  };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = toMap(r.previousHeaders);
    const curr = toMap(r.currentHeaders);
    const names = [...new Set([...Object.keys(prev), ...Object.keys(curr)])].sort();
    const added = names.filter(n => !(n in prev));
    const removed = names.filter(n => !(n in curr));
    const changed = names.filter(n => n in prev && n in curr && prev[n] !== curr[n]).map(n => ({ name: n, previousValue: prev[n], currentValue: curr[n] }));
    const securityChanged = security.some(s => added.includes(s) || removed.includes(s) || changed.some(c => c.name === s));
    return { key: target, target, added, removed, changed, securityChanged, status: securityChanged ? 'security-headers-changed' : added.length || removed.length || changed.length ? 'headers-changed' : 'headers-stable' };
  }).sort((a, b) => Number(b.securityChanged) - Number(a.securityChanged) || String(a.target).localeCompare(String(b.target)));
  const securityAlertCount = rows.filter(r => r.securityChanged).length;
  const changedCount = rows.filter(r => r.status !== 'headers-stable').length;
  return { rows, count: rows.length, changedCount, securityAlertCount, top: rows[0] || null, summary: `Infinity AI flagged header changes on ${changedCount} target(s); ${securityAlertCount} involve security headers.` };
}
/** Idea 54217 — New open ports alerts. Input records: {target, previousPorts, currentPorts}. Newly reachable ports from periodic re-scans are reported per target. */
export function detectNewOpenPorts(records = []) {
  const portList = values => [...new Set((Array.isArray(values) ? values : []).map(v => num(v, 0)).filter(p => p > 0))].sort((a, b) => a - b);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const prev = portList(r.previousPorts);
    const curr = portList(r.currentPorts);
    const newlyOpen = curr.filter(p => !prev.includes(p));
    const closed = prev.filter(p => !curr.includes(p));
    return { key: target, target, newlyOpen, closed, status: newlyOpen.length ? 'new-ports-open' : closed.length ? 'ports-closed-only' : 'ports-unchanged' };
  }).sort((a, b) => b.newlyOpen.length - a.newlyOpen.length || String(a.target).localeCompare(String(b.target)));
  const alertCount = rows.filter(r => r.newlyOpen.length > 0).length;
  const totalNew = rows.reduce((s, r) => s + r.newlyOpen.length, 0);
  return { rows, count: rows.length, alertCount, totalNew, top: rows[0] || null, summary: `Infinity AI reported ${totalNew} newly open port(s) across ${alertCount} target(s).` };
}
/** Idea 54218 — Removed endpoint alerts. Input records: {target, knownEndpoints, currentEndpoints}. Disappearing endpoints hint at deprecations or breakage. */
export function detectRemovedEndpoints(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.knownEndpoints), normSet(r.currentEndpoints));
    return { key: target, target, removed: d.removed, removedCount: d.removed.length, status: d.removed.length ? 'endpoints-removed' : 'endpoints-intact' };
  }).sort((a, b) => b.removedCount - a.removedCount || String(a.target).localeCompare(String(b.target)));
  const alertCount = rows.filter(r => r.removedCount > 0).length;
  const totalRemoved = rows.reduce((s, r) => s + r.removedCount, 0);
  return { rows, count: rows.length, alertCount, totalRemoved, top: rows[0] || null, summary: `Infinity AI noted ${totalRemoved} removed endpoint(s) across ${alertCount} target(s).` };
}
/** Idea 54219 — Redirect target changes. Input records: {target, redirects: [{path, previousTarget, currentTarget}]}. Destination swaps can catch hijacks or migrations. */
export function detectRedirectTargetChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const entries = (Array.isArray(r.redirects) ? r.redirects : []).map(x => ({ path: String(x.path || '/'), previousTarget: String(x.previousTarget || ''), currentTarget: String(x.currentTarget || '') }));
    const changed = entries.filter(x => x.previousTarget !== x.currentTarget);
    return { key: target, target, redirectCount: entries.length, changedCount: changed.length, changedPaths: changed.map(x => x.path).sort(), status: changed.length ? 'redirect-targets-changed' : 'redirect-targets-stable' };
  }).sort((a, b) => b.changedCount - a.changedCount || String(a.target).localeCompare(String(b.target)));
  const changedTargets = rows.filter(r => r.changedCount > 0).length;
  const totalChanged = rows.reduce((s, r) => s + r.changedCount, 0);
  return { rows, count: rows.length, changedTargets, totalChanged, top: rows[0] || null, summary: `Infinity AI detected ${totalChanged} redirect destination change(s) on ${changedTargets} target(s).` };
}
/** Idea 54220 — robots.txt change alerts. Input records: {target, previousDisallowed, currentDisallowed}. Newly disallowed or newly exposed paths are diffed both ways. */
export function diffRobotsTxt(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const d = diffSets(normSet(r.previousDisallowed), normSet(r.currentDisallowed));
    return { key: target, target, newlyDisallowed: d.added, newlyExposed: d.removed, status: d.added.length || d.removed.length ? 'robots-changed' : 'robots-stable' };
  }).sort((a, b) => (b.newlyDisallowed.length + b.newlyExposed.length) - (a.newlyDisallowed.length + a.newlyExposed.length) || String(a.target).localeCompare(String(b.target)));
  const changedCount = rows.filter(r => r.status === 'robots-changed').length;
  const exposedTotal = rows.reduce((s, r) => s + r.newlyExposed.length, 0);
  const disallowedTotal = rows.reduce((s, r) => s + r.newlyDisallowed.length, 0);
  return { rows, count: rows.length, changedCount, exposedTotal, disallowedTotal, top: rows[0] || null, summary: `Infinity AI diffed robots.txt on ${changedCount} target(s); ${exposedTotal} path(s) newly exposed.` };
}
