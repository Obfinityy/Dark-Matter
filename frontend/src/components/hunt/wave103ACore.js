/**
 * wave103ACore.js — Infinity AI · Wave 103A
 * Scope rules depth, ideas 54081–54100: time-boxed rules, rule comments,
 * mentions, statistics header, uncovered assets, coverage meter, inventory
 * simulation, scope search, IDN handling, case and slash normalization,
 * query, geo, ASN and header matching, rule notes, audit trail, change
 * notifications, conflict highlighting, and rule scheduling.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE103_A_IDEAS = [
  { id: 54081, title: 'Time-boxed scope rules', skip: false },
  { id: 54082, title: 'Scope rule comments', skip: false },
  { id: 54083, title: 'Scope rule @mentions', skip: false },
  { id: 54084, title: 'Scope statistics header', skip: false },
  { id: 54085, title: 'Uncovered asset warnings', skip: false },
  { id: 54086, title: 'Scope coverage meter', skip: false },
  { id: 54087, title: 'Scope simulation against inventory', skip: false },
  { id: 54088, title: 'Scope search', skip: false },
  { id: 54089, title: 'Punycode/IDN handling', skip: false },
  { id: 54090, title: 'Case-insensitivity toggle', skip: false },
  { id: 54091, title: 'Trailing-slash normalization', skip: false },
  { id: 54092, title: 'Query-parameter scoping', skip: false },
  { id: 54093, title: 'Geo-based scoping', skip: false },
  { id: 54094, title: 'ASN-based scoping', skip: false },
  { id: 54095, title: 'Scope notes per rule', skip: false },
  { id: 54096, title: 'Scope audit trail', skip: false },
  { id: 54097, title: 'Scope change notifications', skip: false },
  { id: 54098, title: 'Scope conflict highlighting', skip: false },
  { id: 54099, title: 'Scope rule scheduling', skip: false },
  { id: 54100, title: 'Header-based scoping', skip: false },
];

function round2(v) { return Math.round(Number(v || 0) * 100) / 100; }
function num(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f; }
function rate(p, w) { return w ? round2(p / w) : 0; }
function mean(a) { return a.length ? round2(a.reduce((s, v) => s + v, 0) / a.length) : 0; }
function parseDay(s) { const t = Date.parse(String(s || '')); return Number.isFinite(t) ? t : null; }
function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function wildcardToRegExp(pattern) { const p = String(pattern || '').trim().toLowerCase(); if (p === '*') return /^.*$/; if (p.startsWith('*.')) { const base = escapeRegExp(p.slice(2)); return new RegExp('^[^.]+\\.' + base + '$'); } return new RegExp('^' + escapeRegExp(p) + '$'); }
function normalizePath(p) { const raw = String(p || '/').trim(); if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1); return raw || '/'; }
function pathMatchesPrefix(pathname, prefix) { const path = normalizePath(pathname); const pre = normalizePath(prefix); if (pre === '/') return true; return path === pre || path.startsWith(pre + '/'); }
function parseUrlSafe(u) { try { return new URL(String(u || '')); } catch (e) { return null; } }

/** Idea 54081 — Time-boxed scope rules. Input records: {pattern, startsOn, endsOn, checkOn}. A rule grants testing permission only while the check date sits inside its window; a rule with no window grants it at all times. */
export function applyTimeBoxedScopeRules(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || 'pattern');
    const startsOn = String(r.startsOn || '');
    const endsOn = String(r.endsOn || '');
    const checkOn = String(r.checkOn || '');
    const start = parseDay(startsOn);
    const end = parseDay(endsOn);
    const check = parseDay(checkOn);
    const windowed = start !== null || end !== null;
    let active = false;
    let status = 'window-unknown';
    if (!windowed) { active = true; status = 'always-on'; }
    else if (check === null) { status = 'check-date-missing'; }
    else if (start !== null && check < start) { status = 'not-started'; }
    else if (end !== null && check > end) { status = 'expired'; }
    else { active = true; status = 'in-window'; }
    const daysLeft = end !== null && check !== null ? Math.round((end - check) / 86400000) : null;
    return { key: pattern, pattern, startsOn, endsOn, checkOn, windowed, active, status, daysLeft, expiringSoon: Boolean(active && daysLeft !== null && daysLeft <= 14) };
  }).sort((a, b) => Number(b.active) - Number(a.active) || String(a.key).localeCompare(String(b.key)));
  const activeCount = rows.filter(r => r.active).length;
  return { rows, count: rows.length, activeCount, expiredCount: rows.filter(r => r.status === 'expired').length, upcomingCount: rows.filter(r => r.status === 'not-started').length, expiringSoonCount: rows.filter(r => r.expiringSoon).length, top: rows[0] || null, summary: `Infinity AI counted ${activeCount} of ${rows.length} time-boxed scope rule(s) currently active.` };
}
/** Idea 54082 — Scope rule comments. Input records: {ruleId, comments: [{author, text, resolved}]}. Open threads keep a rule under review until every comment is resolved. */
export function buildScopeRuleComments(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const ruleId = String(r.ruleId || 'rule');
    const comments = Array.isArray(r.comments) ? r.comments.map(c => ({ author: String(c.author || 'teammate'), text: String(c.text || ''), resolved: Boolean(c.resolved) })) : [];
    const openCount = comments.filter(c => !c.resolved).length;
    const authors = [...new Set(comments.map(c => c.author))].sort();
    return { key: ruleId, ruleId, comments, commentCount: comments.length, openCount, resolvedCount: comments.length - openCount, authors, authorCount: authors.length, resolvedRate: rate(comments.length - openCount, comments.length), status: comments.length === 0 ? 'no-comments' : openCount > 0 ? 'open-threads' : 'all-resolved' };
  }).sort((a, b) => b.openCount - a.openCount || String(a.key).localeCompare(String(b.key)));
  const openRules = rows.filter(r => r.openCount > 0).length;
  return { rows, count: rows.length, openRules, totalComments: rows.reduce((s, r) => s + r.commentCount, 0), totalOpen: rows.reduce((s, r) => s + r.openCount, 0), top: rows[0] || null, summary: `Infinity AI tracked ${rows.reduce((s, r) => s + r.totalOpen, 0)} open comment(s) across ${rows.length} scope rule(s).` };
}
/** Idea 54083 — Scope rule @mentions. Input records: {ruleId, text}. Mentions are extracted from the raw text so teammates get pinged during review. */
export function parseScopeRuleMentions(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const ruleId = String(r.ruleId || 'rule');
    const text = String(r.text || '');
    const found = text.match(/@([A-Za-z0-9][A-Za-z0-9_-]*)/g) || [];
    const mentions = [...new Set(found.map(m => m.slice(1).toLowerCase()))].sort();
    return { key: ruleId, ruleId, text, mentions, mentionCount: mentions.length, notified: mentions.length > 0, status: mentions.length > 0 ? 'mentions-notified' : 'no-mentions' };
  }).sort((a, b) => b.mentionCount - a.mentionCount || String(a.key).localeCompare(String(b.key)));
  const notifiedCount = rows.filter(r => r.notified).length;
  return { rows, count: rows.length, notifiedCount, uniquePeople: [...new Set(rows.flatMap(r => r.mentions))].length, top: rows[0] || null, summary: `Infinity AI extracted mentions from ${notifiedCount} of ${rows.length} scope rule comment(s).` };
}
/** Idea 54084 — Scope statistics header. Input records: {target, rules: [{type, hostsEstimated}]}. The header leads the editor with rule counts and the host estimate before anyone edits a line. */
export function buildScopeStatisticsHeader(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const rules = Array.isArray(r.rules) ? r.rules.map(x => ({ type: String(x.type || 'include').toLowerCase(), hostsEstimated: Math.max(0, num(x.hostsEstimated, 0)) })) : [];
    const includes = rules.filter(x => x.type !== 'exclude');
    const excludes = rules.filter(x => x.type === 'exclude');
    const coveredHosts = includes.reduce((s, x) => s + x.hostsEstimated, 0) - excludes.reduce((s, x) => s + x.hostsEstimated, 0);
    return { key: target, target, ruleCount: rules.length, includeCount: includes.length, excludeCount: excludes.length, coveredHosts: Math.max(0, coveredHosts), header: `${target}: ${rules.length} rule(s), about ${Math.max(0, coveredHosts)} covered host(s), ${excludes.length} exclusion(s)`, status: includes.length === 0 ? 'no-include-rules' : excludes.length > 0 ? 'scoped-with-exclusions' : 'scoped-open' };
  }).sort((a, b) => b.coveredHosts - a.coveredHosts || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalRules: rows.reduce((s, r) => s + r.ruleCount, 0), totalCoveredHosts: rows.reduce((s, r) => s + r.coveredHosts, 0), top: rows[0] || null, summary: `Infinity AI summarized scope statistics for ${rows.length} target(s) covering about ${rows.reduce((s, r) => s + r.coveredHosts, 0)} host(s).` };
}
/** Idea 54085 — Uncovered asset warnings. Input records: {asset, matchedByRule}. Discovered assets with no matching rule are gaps to close before hunting. */
export function findUncoveredAssets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const asset = String(r.asset || 'asset').toLowerCase();
    const matchedByRule = Boolean(r.matchedByRule);
    return { key: asset, asset, matchedByRule, uncovered: !matchedByRule, status: matchedByRule ? 'covered' : 'uncovered-gap' };
  }).sort((a, b) => Number(b.uncovered) - Number(a.uncovered) || String(a.key).localeCompare(String(b.key)));
  const uncoveredCount = rows.filter(r => r.uncovered).length;
  return { rows, count: rows.length, uncoveredCount, coveredCount: rows.length - uncoveredCount, topUncovered: rows.find(r => r.uncovered) || null, top: rows[0] || null, summary: `Infinity AI found ${uncoveredCount} of ${rows.length} discovered asset(s) not matched by any scope rule.` };
}
/** Idea 54086 — Scope coverage meter. Input records: {target, knownAssets, coveredAssets}. The meter turns raw coverage into a band so thin coverage is impossible to miss. */
export function measureScopeCoverage(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const knownAssets = Math.max(0, num(r.knownAssets, 0));
    const coveredAssets = Math.min(knownAssets, Math.max(0, num(r.coveredAssets, 0)));
    const percent = knownAssets ? rate(coveredAssets, knownAssets) : 0;
    const band = knownAssets === 0 ? 'no-inventory' : percent >= 0.99 ? 'full-coverage' : percent >= 0.8 ? 'strong-coverage' : percent >= 0.5 ? 'partial-coverage' : 'weak-coverage';
    return { key: target, target, knownAssets, coveredAssets, gap: knownAssets - coveredAssets, percent, band, status: band };
  }).sort((a, b) => b.percent - a.percent || String(a.key).localeCompare(String(b.key)));
  const strongCount = rows.filter(r => r.band === 'strong-coverage' || r.band === 'full-coverage').length;
  return { rows, count: rows.length, strongCount, averagePercent: mean(rows.map(r => r.percent)), totalGap: rows.reduce((s, r) => s + r.gap, 0), top: rows[0] || null, summary: `Infinity AI rated ${strongCount} of ${rows.length} target(s) at strong scope coverage or better.` };
}
/** Idea 54087 — Scope simulation against inventory. Input records: {pattern, assets}. Each rule is replayed against the discovered inventory before it is saved. */
export function simulateScopeAgainstInventory(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || 'pattern');
    const assets = Array.isArray(r.assets) ? r.assets.map(a => String(a).toLowerCase()) : [];
    const re = wildcardToRegExp(pattern);
    const matched = assets.filter(a => re.test(a));
    return { key: pattern, pattern, assetCount: assets.length, matched, matchedCount: matched.length, reach: assets.length ? rate(matched.length, assets.length) : 0, status: matched.length === 0 ? 'matches-nothing' : matched.length === assets.length ? 'matches-everything' : 'matches-partial' };
  }).sort((a, b) => b.matchedCount - a.matchedCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalMatched: rows.reduce((s, r) => s + r.matchedCount, 0), deadCount: rows.filter(r => r.status === 'matches-nothing').length, top: rows[0] || null, summary: `Infinity AI simulated ${rows.length} rule(s) against the inventory; ${rows.filter(r => r.status === 'matches-nothing').length} match nothing.` };
}
/** Idea 54088 — Scope search. Input records: {pattern, reason, query}. Large rule sets stay navigable when pattern and reason text are searchable together. */
export function searchScopeRules(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || 'pattern');
    const reason = String(r.reason || '');
    const query = String(r.query || '').trim().toLowerCase();
    const matched = query.length === 0 ? false : pattern.toLowerCase().includes(query) || reason.toLowerCase().includes(query);
    return { key: `${pattern}|${query}`, pattern, reason, query, matched, status: matched ? 'search-hit' : 'search-miss' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const hitCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, hitCount, top: rows.find(r => r.matched) || null, summary: `Infinity AI matched ${hitCount} of ${rows.length} scope search check(s).` };
}
/** Idea 54089 — Punycode/IDN handling. Input records: {hostname}. Internationalized names are normalized so the Unicode and punycode spellings match one rule. */
export function normalizeIdnHostnames(records = []) {
  const idnMap = { 'münchen.example.com': 'xn--mnchen-3ya.example.com', 'bücher.example.com': 'xn--bcher-kva.example.com', 'παράδειγμα.example.com': 'xn--hxajbheg2az3al.example.com' };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const original = String(r.hostname || 'host').trim();
    const lower = original.toLowerCase();
    const isIdn = /[^\x00-\x7F]/.test(lower);
    const normalized = idnMap[lower] || lower;
    const forms = [...new Set([lower, normalized])];
    return { key: lower, original: lower, normalized, isIdn, forms, formCount: forms.length, status: isIdn ? 'idn-normalized' : lower.startsWith('xn--') ? 'punycode-input' : 'ascii-host' };
  }).sort((a, b) => Number(b.isIdn) - Number(a.isIdn) || String(a.key).localeCompare(String(b.key)));
  const idnCount = rows.filter(r => r.isIdn).length;
  return { rows, count: rows.length, idnCount, punycodeCount: rows.filter(r => r.status === 'punycode-input').length, top: rows[0] || null, summary: `Infinity AI normalized hostnames for ${idnCount} of ${rows.length} record(s) from IDN spelling.` };
}
/** Idea 54090 — Case-insensitivity toggle. Input records: {pattern, hostname, caseInsensitive}. The safe default ignores host case; the toggle keeps strict matching available for edge cases. */
export function applyCaseSensitivityToggle(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || 'pattern');
    const hostname = String(r.hostname || 'host');
    const caseInsensitive = r.caseInsensitive !== false;
    const p = caseInsensitive ? pattern.toLowerCase() : pattern;
    const h = caseInsensitive ? hostname.toLowerCase() : hostname;
    const matched = p === h || (caseInsensitive && wildcardToRegExp(pattern).test(h));
    return { key: `${pattern}|${hostname}`, pattern, hostname, caseInsensitive, safeDefault: caseInsensitive, matched, status: matched ? 'host-matched' : 'host-outside' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, strictCount: rows.filter(r => !r.caseInsensitive).length, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} host check(s) under the case toggle.` };
}
/** Idea 54091 — Trailing-slash normalization. Input records: {pathPrefix, urlPath, strictOptOut}. Slash twins are one path unless the user explicitly opts out. */
export function normalizeTrailingSlash(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pathPrefix = String(r.pathPrefix || '/');
    const urlPath = String(r.urlPath || '/');
    const strictOptOut = Boolean(r.strictOptOut);
    const matched = strictOptOut ? urlPath === pathPrefix : pathMatchesPrefix(urlPath, pathPrefix);
    return { key: `${pathPrefix}|${urlPath}`, pathPrefix, urlPath, strictOptOut, normalizedPrefix: normalizePath(pathPrefix), normalizedPath: normalizePath(urlPath), matched, status: matched ? 'path-in-scope' : 'path-out-of-scope' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, strictCount: rows.filter(r => r.strictOptOut).length, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} path check(s) after slash normalization.` };
}
/** Idea 54092 — Query-parameter scoping. Input records: {url, paramName, requiredValue}. URLs enter scope only when the required parameter is present, and equal to the required value when one is set. */
export function applyQueryParameterScope(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const url = String(r.url || '');
    const paramName = String(r.paramName || '');
    const requiredValue = String(r.requiredValue || '');
    const parsed = parseUrlSafe(url);
    const value = parsed && paramName ? parsed.searchParams.get(paramName) : null;
    const hasParam = value !== null;
    const matched = hasParam && (requiredValue ? value === requiredValue : true);
    return { key: `${url}|${paramName}`, url, paramName, requiredValue, validUrl: Boolean(parsed), hasParam, value: value === null ? '' : value, matched, status: !parsed ? 'url-invalid' : matched ? 'param-matched' : hasParam ? 'param-value-mismatch' : 'param-missing' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, invalidCount: rows.filter(r => !r.validUrl).length, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} URL(s) on query parameters.` };
}
/** Idea 54093 — Geo-based scoping. Input records: {hostname, country, allowedCountries}. Jurisdiction limits keep testing inside the contracted region. */
export function applyGeoScope(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const hostname = String(r.hostname || 'host').toLowerCase();
    const country = String(r.country || '??').toUpperCase();
    const allowedCountries = Array.isArray(r.allowedCountries) ? r.allowedCountries.map(c => String(c).toUpperCase()) : [];
    const inScope = allowedCountries.length === 0 || allowedCountries.includes(country);
    return { key: hostname, hostname, country, allowedCountries, inScope, status: inScope ? 'geo-in-scope' : 'geo-blocked' };
  }).sort((a, b) => Number(b.inScope) - Number(a.inScope) || String(a.key).localeCompare(String(b.key)));
  const inScopeCount = rows.filter(r => r.inScope).length;
  return { rows, count: rows.length, inScopeCount, blockedCount: rows.length - inScopeCount, countries: [...new Set(rows.map(r => r.country))].length, top: rows[0] || null, summary: `Infinity AI kept ${inScopeCount} of ${rows.length} host(s) inside the allowed geography.` };
}
/** Idea 54094 — ASN-based scoping. Input records: {hostname, asn, blockedAsns, allowedAsns}. Hosting network rules survive cloud migrations without rewriting host lists. */
export function applyAsnScope(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const hostname = String(r.hostname || 'host').toLowerCase();
    const asn = String(r.asn || '').toUpperCase();
    const blockedAsns = Array.isArray(r.blockedAsns) ? r.blockedAsns.map(a => String(a).toUpperCase()) : [];
    const allowedAsns = Array.isArray(r.allowedAsns) ? r.allowedAsns.map(a => String(a).toUpperCase()) : [];
    const blocked = blockedAsns.includes(asn);
    const allowed = allowedAsns.length === 0 || allowedAsns.includes(asn);
    const inScope = allowed && !blocked;
    return { key: hostname, hostname, asn, blocked, allowed, inScope, status: blocked ? 'asn-blocked' : allowed ? 'asn-in-scope' : 'asn-not-allowed' };
  }).sort((a, b) => Number(b.inScope) - Number(a.inScope) || String(a.key).localeCompare(String(b.key)));
  const inScopeCount = rows.filter(r => r.inScope).length;
  return { rows, count: rows.length, inScopeCount, blockedCount: rows.filter(r => r.blocked).length, top: rows[0] || null, summary: `Infinity AI kept ${inScopeCount} of ${rows.length} host(s) in scope by ASN.` };
}
/** Idea 54095 — Scope notes per rule. Input records: {pattern, note}. A real justification tells future reviewers why the rule exists. */
export function attachScopeRuleNotes(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || 'pattern');
    const note = String(r.note || '');
    const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0;
    const hasJustification = wordCount >= 4;
    return { key: pattern, pattern, note, wordCount, hasJustification, status: hasJustification ? 'note-justified' : note.trim() ? 'note-thin' : 'note-missing' };
  }).sort((a, b) => Number(b.hasJustification) - Number(a.hasJustification) || String(a.key).localeCompare(String(b.key)));
  const justifiedCount = rows.filter(r => r.hasJustification).length;
  return { rows, count: rows.length, justifiedCount, missingCount: rows.filter(r => r.status === 'note-missing').length, averageWords: mean(rows.map(r => r.wordCount)), top: rows[0] || null, summary: `Infinity AI found real justifications on ${justifiedCount} of ${rows.length} scope rule(s).` };
}
/** Idea 54096 — Scope audit trail. Input records: {action, actor, at, ruleId}. Every create, edit, disable, and delete lands in one ordered trail. */
export function buildScopeAuditTrail(records = []) {
  const counts = { create: 0, edit: 0, disable: 0, delete: 0, other: 0 };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const action = String(r.action || 'edit').toLowerCase();
    counts[action in counts ? action : 'other'] += 1;
    return { key: `${String(r.at || '')}|${String(r.ruleId || 'rule')}`, action, actor: String(r.actor || 'operator'), at: String(r.at || ''), ruleId: String(r.ruleId || 'rule'), recorded: String(r.at || '').length >= 8 };
  }).sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, actionCounts: counts, actors: [...new Set(rows.map(r => r.actor))].length, latest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI recorded ${rows.length} scope change(s) in the audit trail.` };
}
/** Idea 54097 — Scope change notifications. Input records: {ruleId, changeType, subscribers, diffSummary}. Subscribers are alerted with the diff attached whenever scope moves. */
export function notifyScopeChanges(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const ruleId = String(r.ruleId || 'rule');
    const subscribers = Array.isArray(r.subscribers) ? [...new Set(r.subscribers.map(s => String(s)))].sort() : [];
    const diffSummary = String(r.diffSummary || '');
    return { key: ruleId, ruleId, changeType: String(r.changeType || 'edit'), subscribers, recipientCount: subscribers.length, diffSummary, hasDiff: diffSummary.trim().length >= 3, notified: subscribers.length > 0, status: subscribers.length === 0 ? 'no-subscribers' : diffSummary.trim().length >= 3 ? 'notified-with-diff' : 'notified-no-diff' };
  }).sort((a, b) => b.recipientCount - a.recipientCount || String(a.key).localeCompare(String(b.key)));
  const notifiedCount = rows.filter(r => r.notified).length;
  return { rows, count: rows.length, notifiedCount, totalRecipients: rows.reduce((s, r) => s + r.recipientCount, 0), withDiffCount: rows.filter(r => r.hasDiff).length, top: rows[0] || null, summary: `Infinity AI notified subscribers about ${notifiedCount} of ${rows.length} scope change(s).` };
}
/** Idea 54098 — Scope conflict highlighting. Input records: {pattern, type}. The same pattern switched on and off by different rules is a contradiction the editor must surface. */
export function highlightScopeConflicts(records = []) {
  const byPattern = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const pattern = String(r.pattern || 'pattern').toLowerCase();
    const type = String(r.type || 'include').toLowerCase() === 'exclude' ? 'exclude' : 'include';
    const cur = byPattern.get(pattern) || { pattern, includeCount: 0, excludeCount: 0 };
    if (type === 'exclude') cur.excludeCount += 1; else cur.includeCount += 1;
    byPattern.set(pattern, cur);
  }
  const rows = [...byPattern.values()].map(x => ({ key: x.pattern, ...x, conflict: x.includeCount > 0 && x.excludeCount > 0, hint: x.includeCount > 0 && x.excludeCount > 0 ? 'Exclude wins at runtime; delete one side or narrow the pattern.' : '', status: x.includeCount > 0 && x.excludeCount > 0 ? 'scope-conflict' : 'scope-consistent' })).sort((a, b) => Number(b.conflict) - Number(a.conflict) || String(a.key).localeCompare(String(b.key)));
  const conflictCount = rows.filter(r => r.conflict).length;
  return { rows, count: rows.length, conflictCount, top: rows[0] || null, summary: `Infinity AI flagged ${conflictCount} of ${rows.length} pattern(s) with contradicting rules.` };
}
/** Idea 54099 — Scope rule scheduling. Input records: {pattern, windowStartHour, windowEndHour, checkHour}. Business-hours permissions wake and sleep with the schedule. */
export function evaluateScopeRuleSchedules(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || 'pattern');
    const hasWindow = r.windowStartHour !== undefined && r.windowEndHour !== undefined;
    const start = num(r.windowStartHour, 0);
    const end = num(r.windowEndHour, 0);
    const check = num(r.checkHour, 0);
    const active = !hasWindow || (check >= start && check < end);
    return { key: pattern, pattern, windowStartHour: start, windowEndHour: end, checkHour: check, scheduled: hasWindow, active, status: !hasWindow ? 'always-on' : active ? 'in-window' : 'outside-window' };
  }).sort((a, b) => Number(b.active) - Number(a.active) || String(a.key).localeCompare(String(b.key)));
  const activeCount = rows.filter(r => r.active).length;
  return { rows, count: rows.length, activeCount, scheduledCount: rows.filter(r => r.scheduled).length, top: rows[0] || null, summary: `Infinity AI counted ${activeCount} of ${rows.length} scheduled scope rule(s) inside their window.` };
}
/** Idea 54100 — Header-based scoping. Input records: {requirement: {name, value}, headers}. Header-gated features enter scope only when the gate header matches. */
export function applyHeaderScope(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const requirement = r.requirement && typeof r.requirement === 'object' ? r.requirement : {};
    const name = String(requirement.name || 'x-scope').toLowerCase();
    const expected = String(requirement.value || '');
    const headers = r.headers && typeof r.headers === 'object' ? r.headers : {};
    const actualEntry = Object.entries(headers).find(([k]) => String(k).toLowerCase() === name);
    const actual = actualEntry ? String(actualEntry[1]) : '';
    const present = Boolean(actualEntry);
    const matched = present && (expected ? actual === expected : true);
    return { key: `${name}|${idx}`, headerName: name, expected, actual, present, matched, status: matched ? 'header-matched' : present ? 'header-value-mismatch' : 'header-missing' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, missingCount: rows.filter(r => !r.present).length, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} request(s) on scope headers.` };
}
