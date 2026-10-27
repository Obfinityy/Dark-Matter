// Keyword-Index Memory (27 Oct 2026, owner order) — Action Index.
//
// Asserted here (pure helpers):
//   - sequential numbering: #1, #2, #3… in record order (array
//     position, NOT random) — the fetch key.
//   - content-hash: the same action hashes the same, a different
//     action hashes differently — the dedup key.
//   - label format: `what | where | variant | outcome`, specific,
//     never just "JWT done".
//   - bounded rendering: 100 actions stay within ~2,000 chars, the
//     newest 12 in full, older ones grouped per area.
//   - recall by id: 7 / '7' / '#7' all resolve to the same full
//     record (event + reasoning note); out of range names the count.
//   - recall by hash: first action with that hash.
//   - firstRunNumber: where a repeat already lives.
//   - PER-HUNT ISOLATION (the hard rule): an index built from hunt
//     A's events contains only A's actions; recall on A's events
//     can NEVER return hunt B's data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActionIndex,
  indexLines,
  recallById,
  recallByHash,
  firstRunNumber,
  parseRecallId,
  contentHash,
  labelFor,
} from './actionIndex.js';
import { contentHash as hashFromIdentity } from './actionIdentity.js';

const ev = (tool, detail, cachedAt = '2026-10-27T10:00:00.000Z') => ({ type: 'tool_call', tool, detail, cachedAt });
const note = (action, result) => ({ action, why: 'testing', result, learned: '' });

// Hunt A (x.com) and hunt B (y.com) — different targets, different
// actions. The isolation tests use these two sets throughout.
const eventsA = [
  ev('search', 'undocumented api endpoints'),
  ev('browser_open', 'https://x.com/login'),
  ev('browser_open', 'https://x.com/login'),
  ev('search', 'JWT alg-none bypass'),
  ev('claim_finding', 'JWT alg-none accepted'),
];
const notesA = [
  note('search: undocumented api endpoints', 'found 3 endpoints'),
  note('browser_open: https://x.com/login', 'login page opened'),
  note('browser_open: https://x.com/login', 'login page opened'),
  note('search: JWT alg-none bypass', 'no bypass found'),
  note('claim_finding: JWT alg-none accepted', 'claim recorded, unverified'),
];
const eventsB = [
  ev('search', 'y.com admin panel'),
  ev('browser_open', 'https://y.com/admin'),
  ev('shell', 'nmap -sV y.com'),
];
const notesB = [
  note('search: y.com admin panel', 'admin panel found'),
  note('browser_open: https://y.com/admin', 'admin page opened'),
  note('shell: nmap -sV y.com', 'ports 80, 443 open'),
];

test('index numbers actions sequentially from 1 in record order', () => {
  const idx = buildActionIndex(eventsA, notesA);
  assert.deepEqual(idx.map((e) => e.n), [1, 2, 3, 4, 5]);
  assert.equal(idx[0].tool, 'search');
  assert.equal(idx[4].tool, 'claim_finding');
});

test('content-hash is deterministic: same action, same hash', () => {
  assert.equal(contentHash('search', 'undocumented api endpoints'), contentHash('search', 'undocumented api endpoints'));
  assert.equal(contentHash('search', 'undocumented api endpoints'), hashFromIdentity('search', 'undocumented api endpoints'));
  assert.notEqual(contentHash('search', 'undocumented api endpoints'), contentHash('search', 'JWT alg-none bypass'));
  // URL normalisation: /login and /login/ are the SAME page, so the
  // same action — one hash, and the dedup gate treats them as one.
  assert.equal(contentHash('browser_open', 'https://x.com/login'), contentHash('browser_open', 'https://x.com/login/'));
  assert.notEqual(contentHash('browser_open', 'https://x.com/login'), contentHash('browser_open', 'https://x.com/signup'));
  assert.match(contentHash('search', 'x'), /^[0-9a-f]{8}$/);
});

test('label is specific: what | where | variant | outcome', () => {
  const idx = buildActionIndex(eventsA, notesA);
  assert.equal(idx[0].label, 'search | — | undocumented api endpoints | found');
  assert.equal(idx[3].label, 'search | — | JWT alg-none bypass | fail');
  assert.equal(idx[1].label, 'browser_open | x.com/login | — | done');
  assert.equal(idx[4].label, 'claim_finding | — | JWT alg-none accepted | claimed');
  assert.equal(labelFor('search', 'JWT alg-none', 'done'), 'search | — | JWT alg-none | done');
});

test('task_complete events are milestone entries in the index', () => {
  const events = [...eventsA, { type: 'task_complete', task: 'Map the login surface', cachedAt: '2026-10-27T11:00:00.000Z' }];
  const idx = buildActionIndex(events, notesA);
  assert.equal(idx.length, 6);
  assert.equal(idx[5].tool, 'task_complete');
  assert.equal(idx[5].n, 6);
  assert.match(idx[5].label, /task_complete \| — \| Map the login surface \| done/);
});

test('indexLines stays bounded at 100 actions: newest 12 in full, older grouped', () => {
  const events = [];
  const notes = [];
  for (let i = 0; i < 100; i++) {
    const tool = i % 3 === 0 ? 'search' : i % 3 === 1 ? 'browser_open' : 'shell';
    const detail = tool === 'search' ? `probe topic ${i}` : tool === 'browser_open' ? `https://x.com/page${i}` : `curl https://x.com/api${i}`;
    events.push(ev(tool, detail));
    notes.push(note(`${tool}: ${detail}`, 'done'));
  }
  const idx = buildActionIndex(events, notes);
  assert.equal(idx.length, 100);
  const lines = indexLines(idx);
  assert.ok(lines.join('\n').length <= 2000, `index block is ${lines.join('\n').length} chars`);
  const full = lines.filter((l) => /^#\d+ /.test(l));
  assert.equal(full.length, 12);
  assert.ok(full[0].startsWith('#89 '), `first full line is ${full[0]}`);
  assert.ok(full[11].startsWith('#100 '));
  assert.ok(lines.some((l) => l.startsWith('earlier:')), 'older actions roll into per-area summaries');
});

test('recallById resolves 7, "7" and "#7" to the same full record', () => {
  for (const id of [4, '4', '#4']) {
    const rec = recallById(eventsA, notesA, id);
    assert.equal(rec.error, undefined);
    assert.equal(rec.entry.n, 4);
    assert.equal(rec.entry.tool, 'search');
    assert.equal(rec.event.detail, 'JWT alg-none bypass');
    assert.equal(rec.note.result, 'no bypass found');
  }
});

test('recallById out of range names the count', () => {
  const rec = recallById(eventsA, notesA, 99);
  assert.ok(rec.error);
  assert.match(rec.error, /holds 5 action/);
  assert.equal(rec.count, 5);
  assert.equal(recallById(eventsA, notesA, 0).error !== undefined, true);
  assert.equal(recallById(eventsA, notesA, 'abc').error !== undefined, true);
});

test('recallByHash returns the first action with that hash', () => {
  const h = contentHash('browser_open', 'https://x.com/login');
  const rec = recallByHash(eventsA, notesA, h);
  assert.equal(rec.entry.n, 2);
  assert.equal(recallByHash(eventsA, notesA, 'deadbeef').error !== undefined, true);
});

test('firstRunNumber names where a repeat already lives', () => {
  assert.equal(firstRunNumber(eventsA, 'browser_open', 'https://x.com/login'), 2);
  assert.equal(firstRunNumber(eventsA, 'browser_open', 'https://x.com/login/'), 2);
  assert.equal(firstRunNumber(eventsA, 'search', 'never searched'), null);
});

test('parseRecallId accepts 7, "7", "#7" and rejects the rest', () => {
  assert.equal(parseRecallId(7), 7);
  assert.equal(parseRecallId('7'), 7);
  assert.equal(parseRecallId('#7'), 7);
  assert.equal(parseRecallId('  #12 '), 12);
  assert.equal(parseRecallId('abc'), null);
  assert.equal(parseRecallId(null), null);
  assert.equal(parseRecallId(1.5), null);
});

test('ISOLATION: hunt A index contains only hunt A actions', () => {
  const idxA = buildActionIndex(eventsA, notesA);
  const idxB = buildActionIndex(eventsB, notesB);
  assert.ok(idxA.every((e) => !String(e.detail).includes('y.com')), 'no y.com detail in A');
  assert.ok(idxB.every((e) => !String(e.detail).includes('x.com')), 'no x.com detail in B');
  assert.equal(idxA.length, 5);
  assert.equal(idxB.length, 3);
});

test('ISOLATION: recall on A events can NEVER return B data', () => {
  // B has 3 actions; asking A for #3 returns A's own #3, not B's.
  const rec = recallById(eventsA, notesA, 3);
  assert.equal(rec.event.detail, 'https://x.com/login');
  // An id that only exists in B's range is out of range for A when
  // A is shorter — and a hash of B's action is not found in A.
  const shortA = recallById(eventsA.slice(0, 2), [], 3);
  assert.ok(shortA.error);
  const hashB = contentHash('browser_open', 'https://y.com/admin');
  assert.ok(recallByHash(eventsA, notesA, hashB).error);
  assert.equal(firstRunNumber(eventsA, 'browser_open', 'https://y.com/admin'), null);
});
