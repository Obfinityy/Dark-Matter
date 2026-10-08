/**
 * wave8.test.js — Forge wave 8, ideas 50281–50320.
 *
 * Node-runnable checks (pure logic + registry honesty + export presence).
 * Run: node --test frontend/src/components/hunt/wave8.test.js
 * (Must be run from repo root; resolves via relative paths.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const {
  escapeSearchReducer,
  initialEscapeSearchState,
  searchChainNodes,
  searchModels,
  readRetainedSearch,
  writeRetainedSearch,
  retainedSearchKey,
  SEARCH_REFINE_IDEAS,
} = await import('./searchRefine.js');
const { EMPTY_STATE_IDEAS } = extractEmptyStateIdeas(
  fs.readFileSync(path.join(here, 'EmptyStates.jsx'), 'utf8')
);

// EmptyStates.jsx imports CSS (not node-importable), so parse its registry
// from source instead of executing the module.
function extractEmptyStateIdeas(src) {
  const block = src.match(/export const EMPTY_STATE_IDEAS = \[([\s\S]*?)\];/);
  assert.ok(block, 'EMPTY_STATE_IDEAS registry not found in source');
  const entries = [...block[1].matchAll(/\{\s*idea:\s*(\d+),\s*name:\s*'([^']+)'\s*\}/g)].map(
    m => ({ idea: Number(m[1]), name: m[2] })
  );
  return { EMPTY_STATE_IDEAS: entries };
}

/* ---------- 50281: Esc clears search + restores previous filters ---- */

test('50281: snapshot taken when query goes empty→non-empty', () => {
  let s = initialEscapeSearchState({ query: '', filters: { sev: 'critical' } });
  s = escapeSearchReducer(s, { type: 'SET_QUERY', query: 'xss' });
  assert.deepEqual(s.preSearchFilters, { sev: 'critical' });
});

test('50281: ESCAPE clears query and restores filters', () => {
  let s = initialEscapeSearchState({ query: '', filters: { sev: 'critical' } });
  s = escapeSearchReducer(s, { type: 'SET_QUERY', query: 'xss' });
  s = escapeSearchReducer(s, { type: 'SET_FILTERS', filters: { sev: 'high' } });
  s = escapeSearchReducer(s, { type: 'ESCAPE' });
  assert.equal(s.query, '');
  assert.deepEqual(s.filters, { sev: 'critical' });
  assert.equal(s.preSearchFilters, null);
});

test('50281: ESCAPE with empty query is a no-op', () => {
  const s = initialEscapeSearchState({ query: '', filters: { sev: 'critical' } });
  assert.equal(escapeSearchReducer(s, { type: 'ESCAPE' }), s);
});

test('50281: ESCAPE without snapshot keeps current filters', () => {
  let s = initialEscapeSearchState({ query: 'q', filters: { sev: 'low' } });
  s = escapeSearchReducer(s, { type: 'ESCAPE' });
  assert.equal(s.query, '');
  assert.deepEqual(s.filters, { sev: 'low' });
});

/* ---------- 50282: chain-graph node search --------------------------- */

const NODES = [
  { id: 'n1', label: 'XSS in login form', kind: 'finding', severity: 'critical' },
  { id: 'n2', label: 'Session cookie', kind: 'finding', severity: 'high' },
  { id: 'n3', label: 'api.example.com', kind: 'asset' },
  { id: 'n4', label: 'Account takeover chain', kind: 'chain', severity: 'critical' },
];

test('50282: empty query returns all nodes', () => {
  assert.equal(searchChainNodes(NODES, '').length, 4);
});

test('50282: prefix match ranks first', () => {
  const r = searchChainNodes(NODES, 'xss');
  assert.equal(r[0].id, 'n1');
});

test('50282: substring match works', () => {
  const r = searchChainNodes(NODES, 'cookie');
  assert.equal(r[0].id, 'n2');
});

test('50282: multi-token match works', () => {
  const r = searchChainNodes(NODES, 'account chain');
  assert.equal(r[0].id, 'n4');
});

test('50282: no match returns empty', () => {
  assert.equal(searchChainNodes(NODES, 'zzzz').length, 0);
});

test('50282: respects limit', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, label: `node ${i}` }));
  assert.ok(searchChainNodes(many, '', 20).length <= 20);
});

/* ---------- 50285: models-page incremental search -------------------- */

const MODELS = [
  {
    id: 'qwen-vl',
    name: 'Qwen2.5-VL',
    provider: 'Kaggle',
    slot: 'vision',
    kind: 'model',
    tags: ['multimodal'],
  },
  {
    id: 'hydra-x',
    name: 'Hydra',
    provider: 'kali',
    slot: 'hacker',
    kind: 'plugin',
    tags: ['bruteforce'],
  },
  {
    id: 'kokoro',
    name: 'Kokoro-82M',
    provider: 'builtin',
    slot: 'tts',
    kind: 'model',
    tags: ['voice'],
  },
];

test('50285: empty query returns all', () => {
  assert.equal(searchModels(MODELS, '').length, 3);
});

test('50285: name match ranks first', () => {
  assert.equal(searchModels(MODELS, 'hydra')[0].id, 'hydra-x');
});

test('50285: synonym expansion (vision ↔ image/multimodal)', () => {
  const r = searchModels(MODELS, 'vision');
  assert.equal(r[0].id, 'qwen-vl');
});

test('50285: tag match', () => {
  const r = searchModels(MODELS, 'voice');
  assert.equal(r[0].id, 'kokoro');
});

test('50285: no match returns empty', () => {
  assert.equal(searchModels(MODELS, 'zzzzz').length, 0);
});

/* ---------- 50287: retained search text ------------------------------ */

function memStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: k => m.delete(k),
  };
}

test('50287: retainedSearchKey namespaces', () => {
  assert.equal(retainedSearchKey('findings'), 'dm:search:findings');
});

test('50287: write then read round-trips', () => {
  const store = memStore();
  writeRetainedSearch('findings', 'sev:critical', store);
  assert.equal(readRetainedSearch('findings', store), 'sev:critical');
});

test('50287: empty value clears', () => {
  const store = memStore();
  writeRetainedSearch('findings', 'q', store);
  writeRetainedSearch('findings', '', store);
  assert.equal(readRetainedSearch('findings', store), '');
});

/* ---------- registry honesty ------------------------------------------ */

test('registries cover 50281–50320 with unique idea numbers', () => {
  const covered = new Set([
    ...SEARCH_REFINE_IDEAS.map(e => e.idea),
    ...EMPTY_STATE_IDEAS.map(e => e.idea),
  ]);
  // 50283/50284/50286/50288/50289 live in wave 7's SearchSuite (merged #65)
  const waved7 = new Set([50283, 50284, 50286, 50288, 50289]);
  for (let i = 50281; i <= 50320; i++) {
    assert.ok(covered.has(i) || waved7.has(i), `idea ${i} uncovered`);
  }
  assert.equal(
    new Set([...SEARCH_REFINE_IDEAS, ...EMPTY_STATE_IDEAS].map(e => e.idea)).size,
    SEARCH_REFINE_IDEAS.length + EMPTY_STATE_IDEAS.length,
    'duplicate idea numbers'
  );
});

test('EmptyStates.jsx exports all 31 named components', () => {
  const src = fs.readFileSync(path.join(here, 'EmptyStates.jsx'), 'utf8');
  for (const { name } of EMPTY_STATE_IDEAS) {
    assert.ok(new RegExp(`export function ${name}\\b`).test(src), `missing export: ${name}`);
  }
});

test('search components exist', () => {
  assert.ok(fs.existsSync(path.join(here, 'ChainGraphSearch.jsx')));
  assert.ok(fs.existsSync(path.join(here, 'ModelsPageSearch.jsx')));
  assert.ok(fs.existsSync(path.join(here, 'ChainGraphSearch.css')));
  assert.ok(fs.existsSync(path.join(here, 'ModelsPageSearch.css')));
  assert.ok(fs.existsSync(path.join(here, 'EmptyStates.css')));
});
