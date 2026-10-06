/**
 * searchCore.test.mjs — Forge wave 7 (ideas 50241–50280).
 * Run: node --test frontend/test/searchCore.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQuery, suggestOperatorValues, naturalDate, expandSynonyms,
  multilingualVariants, search, groupResults, snippet, didYouMean,
  operatorHint, encodeSearch, decodeSearch, pushHistory, rankSuggestions,
  topQueries, saveSearchEntry, digestNewMatches, similarFindings,
  searchInText, searchTerminalLog, searchTimeline, shouldThrottleHint,
  serializeScopeState, deserializeScopeState, hostSearchQuery, resultBadge,
  phaseChip, STARTER_QUERIES, explainMatch,
} from '../src/components/hunt/searchCore.js';

const F = [
  { id: 'f1', title: 'SQL injection in login form', severity: 'critical', host: 'shop.example.com', huntName: 'hunt-a', phase: 'exploit', evidence: 'POST /login\npayload: \' OR 1=1--', notes: 'auth bypass confirmed', comments: ['retest needed'], poc: true, reviewed: false, tags: ['injection'], type: 'injection', createdAt: Date.now() - 3600000 },
  { id: 'f2', title: 'Reflected XSS in search box', severity: 'high', host: 'shop.example.com', huntName: 'hunt-a', phase: 'exploit', evidence: '<script>alert(1)</script>', reviewed: true, tags: ['xss'], type: 'xss', createdAt: Date.now() - 7200000 },
  { id: 'f3', title: 'Missing security headers', severity: 'low', host: 'blog.example.com', huntName: 'hunt-b', phase: 'recon', evidence: 'no CSP header', reviewed: false, archived: true, type: 'config', createdAt: Date.now() - 86400000 * 3 },
  { id: 'f4', title: 'Admin panel exposed', severity: 'medium', host: 'admin.example.com', huntName: 'hunt-b', phase: 'recon', evidence: '/admin returns 200', starred: true, reviewed: true, type: 'exposure', createdAt: Date.now() - 86400000 },
];

test('50241 — operators: sev: and host:', () => {
  const r = search(F, 'sev:critical host:shop.example.com');
  assert.equal(r.total, 1); assert.equal(r.results[0].finding.id, 'f1');
});

test('50241 — has: and is: operators', () => {
  assert.equal(search(F, 'has:poc').total, 1);
  assert.equal(search(F, 'is:unreviewed').total, 2); // f1, f3
  assert.equal(search(F, 'is:starred').total, 1);
});

test('50262 — is:unreviewed modifier', () => {
  const r = search(F, 'is:unreviewed sev:critical');
  assert.equal(r.total, 1); assert.equal(r.results[0].finding.id, 'f1');
});

test('50266 — boolean AND/OR/NOT with parens', () => {
  assert.equal(search(F, 'xss OR "sql injection"').total, 2);
  assert.equal(search(F, 'shop.example.com NOT xss').total, 1);
  assert.equal(search(F, '(xss OR headers) AND sev:low').total, 1);
});

test('50266 — implicit AND between terms', () => {
  assert.equal(search(F, 'login injection').total, 1);
});

test('50248 — wildcard terms', () => {
  assert.equal(search(F, 'adm*').total, 1);
  assert.equal(search(F, 'shop.example.*').total, 2);
});

test('50251 — synonym expansion login→auth', () => {
  const r = search(F, 'signin'); // matches f1 via synonym of login in title
  assert.ok(r.total >= 1);
  assert.ok(r.results[0].reasons.some((x) => x.text.includes('synonym')));
});

test('50252 — case-sensitivity toggle', () => {
  assert.equal(search(F, 'SQL', { caseSensitive: true }).total, 1);
  assert.equal(search(F, 'sql', { caseSensitive: true }).total, 0);
  assert.equal(search(F, 'sql', { caseSensitive: false }).total, 1);
});

test('50257 — in:evidence scope restriction', () => {
  // "confirmed" only appears in notes, not evidence
  assert.equal(search(F, 'in:evidence confirmed').total, 0);
  assert.equal(search(F, 'confirmed').total, 1);
});

test('50263 — notes/comments are searchable', () => {
  assert.equal(search(F, 'retest').total, 1); // comment on f1
});

test('50249 — contextual snippets', () => {
  const s = snippet(F[0], 'OR 1=1');
  assert.ok(s.text.includes('OR 1=1'));
  assert.ok(s.line >= 1);
});

test('50267 — relevance explanations', () => {
  const r = search(F, 'sev:critical');
  assert.ok(explainMatch(r.results[0].reasons).includes('matched sev:critical'));
});

test('50268/50245 — did-you-mean + operator hint', () => {
  const r = search(F, 'sqll'); // typo of sql
  assert.equal(r.correction, 'sql');
  const r2 = search(F, 'sv:critical');
  assert.ok(r2.operatorHint && r2.operatorHint.includes('sev'));
  assert.ok(operatorHint('hosst').includes('host'));
});

test('50269 — natural-language dates', () => {
  const d = naturalDate('last tuesday');
  assert.ok(d && d.from < d.to);
  assert.ok(naturalDate('today').to <= Date.now());
  assert.ok(naturalDate('3 days ago'));
  assert.ok(naturalDate('2026-09-01'));
  assert.equal(naturalDate('nonsense xyz'), null);
  const r = search(F, 'after:"last week"');
  assert.ok(r.total >= 3); // f1, f2, f4 within a week
});

test('50242 — operator autocomplete', () => {
  const s = suggestOperatorValues('sev:');
  assert.ok(s.some((x) => x.text === 'sev:critical'));
  const s2 = suggestOperatorValues('se');
  assert.ok(s2.some((x) => x.text === 'sev:'));
});

test('50286 — bang prefixes set scope', () => {
  const p = parseQuery('!report xss');
  assert.equal(p.scope, 'report');
  assert.ok(p.ast);
});

test('50265 — encoded search URLs round-trip', () => {
  const enc = encodeSearch({ q: 'sev:high xss', scope: 'evidence', caseSensitive: true });
  assert.ok(!/[+/=]/.test(enc));
  const dec = decodeSearch(enc);
  assert.equal(dec.q, 'sev:high xss');
  assert.equal(dec.scope, 'evidence');
  assert.equal(dec.caseSensitive, true);
  assert.deepEqual(decodeSearch('!!!bad!!!').q, '');
});

test('50243 — grouped results with counts', () => {
  const r = search(F, 'shop.example.com OR blog.example.com OR admin.example.com');
  const g = groupResults(r.results, 'severity');
  assert.ok(g.length >= 3);
  const crit = g.find((x) => x.key === 'critical');
  assert.equal(crit.count, 1);
  const byHost = groupResults(r.results, 'host');
  assert.ok(byHost.find((x) => x.key === 'shop.example.com').count === 2);
});

test('50259 — perf note', () => {
  const r = search(F, 'xss');
  assert.equal(r.searched, 4);
  assert.ok(r.ms >= 1);
});

test('50247/50255/50280 — history, ranked suggestions, top queries', () => {
  let h = [];
  h = pushHistory(h, 'sev:critical');
  h = pushHistory(h, 'xss');
  h = pushHistory(h, 'sev:critical');
  assert.equal(h[0].q, 'sev:critical');
  assert.equal(h[0].count, 2);
  const sug = rankSuggestions('sev', h);
  assert.equal(sug[0].q, 'sev:critical');
  const tops = topQueries(h);
  assert.equal(tops[0].q, 'sev:critical');
});

test('50264/50270 — saved searches + digest new matches', () => {
  let s = [];
  s = saveSearchEntry(s, { name: 'crit watch', q: 'sev:critical', pinned: true, digest: true, lastCheck: Date.now() - 7200000 });
  assert.equal(s[0].pinned, true);
  const fresh = [{ id: 'f9', title: 'Critical RCE', severity: 'critical', createdAt: Date.now() - 1000 }];
  const hits = digestNewMatches(s[0], fresh);
  assert.equal(hits.length, 1);
});

test('50275 — similar findings', () => {
  const sim = similarFindings(F[0], F);
  assert.ok(sim.length >= 1);
  assert.equal(sim[0].finding.id, 'f2'); // shared host shop.example.com
});

test('50246 — in-card evidence search offsets', () => {
  const hits = searchInText('line one\nline two\nline one', 'line one');
  assert.equal(hits.length, 2);
  assert.equal(hits[0].index, 0);
});

test('50261 — terminal log search', () => {
  const hits = searchTerminalLog(['nmap scan started', 'port 443 open', 'nmap done'], 'nmap');
  assert.equal(hits.length, 2);
  assert.equal(hits[0].line, 1);
});

test('50272 — timeline search first match', () => {
  const ev = [{ label: 'recon started' }, { label: 'xss probe sent' }];
  assert.equal(searchTimeline(ev, 'xss'), 1);
  assert.equal(searchTimeline(ev, 'zzz'), -1);
});

test('50277 — throttle hint heuristic', () => {
  assert.equal(shouldThrottleHint(5000, 20), true);
  assert.equal(shouldThrottleHint(100, 20), false);
  assert.equal(shouldThrottleHint(5000, 3), false);
});

test('50253 — per-tab state serialization', () => {
  const s = serializeScopeState({ all: { q: 'xss' }, findings: { q: 'sev:high', caseSensitive: true } });
  const d = deserializeScopeState(s);
  assert.equal(d.all.q, 'xss');
  assert.equal(d.findings.caseSensitive, true);
  assert.deepEqual(Object.keys(deserializeScopeState('bad')), ['all', 'findings', 'notes', 'evidence']);
});

test('50278/50284/50288 — action helpers', () => {
  assert.equal(hostSearchQuery('a.com'), 'host:a.com');
  assert.deepEqual(resultBadge(F[0]), { severity: 'critical', hunt: 'hunt-a' });
  assert.equal(phaseChip(F[0]), 'phase:exploit');
  assert.ok(STARTER_QUERIES.length >= 5);
});

test('50279 — multilingual variants', () => {
  const v = multilingualVariants('password');
  assert.ok(v.includes('contraseña'));
  const r = search([{ id: 'm1', title: 'Contraseña débil en login', severity: 'high' }], 'password', { multilingual: true, synonyms: false });
  assert.equal(r.total, 1);
});

test('50273 — archived toggle', () => {
  assert.equal(search(F, 'headers', { includeArchived: false }).total, 0);
  assert.equal(search(F, 'headers').total, 1);
});

test('empty query matches all', () => {
  assert.equal(search(F, '').total, 4);
});
