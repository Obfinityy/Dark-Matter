// HUMAN-BRAIN lane (26 Oct 2026, owner order: PER-HUNT MEMORY
// ISOLATION) — each hunt/target gets its own memory; x.com must
// never leak into or interfere with y.com.
//
//   ISO-1  scopeGlobalMemoriesForTarget: a same-target entry passes
//          through untouched; a cross-target entry is reduced to
//          its technique rate only (payload/context/note/target
//          blanked); a target-less generic entry is untouched.
//   ISO-2  getRelevantMemories + formatGlobalMemoryForPrompt on a
//          real store: for y.com, no x.com target name, endpoint,
//          or payload appears; the y.com entry shows in full; the
//          x.com technique survives only as a nameless rate line.
//   ISO-3  searchRecall with a target: an x.com endpoint hit never
//          surfaces on y.com; a same-target hit does.
//   ISO-4  sameTargetFolder: origin match is case/origin exact
//          (host + non-default port — DVWA :3100 and Juice Shop
//          :3000 on one host are different targets);
//          empty/unknown never matches.
//   ISO-5  retrieveEpisodes with crossHunt + target: only episodes
//          from hunts on THAT target are returned; without a target
//          cross-hunt mode fails closed to the current hunt only (#321)
//          — the old "sees both hunts" control is the bug, not the spec.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE the store/config modules are imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-isolation-'));
process.env.DATA_DIR = tmpRoot;

const { scopeGlobalMemoriesForTarget, sameTargetFolder, getRelevantMemories, formatGlobalMemoryForPrompt } = await import('./globalMemory.js');
const { searchRecall } = await import('./reasoningMemory.js');
const { retrieveEpisodes, flushHuntEpisodes } = await import('./episodeStore.js');

const X_ENTRY = {
  type: 'technique', technique: 'sqli', target: 'https://x.com',
  appType: 'ecommerce', techStack: ['Node.js'],
  success: true, attempts: 3, successes: 1,
  payload: `{"email":"admin@x.com' OR 1=1--","password":"x"}`,
  context: 'POST /rest/user/login (x.com)',
  note: 'SQLi auth bypass returned a valid admin JWT on x.com.',
};
const Y_ENTRY = {
  type: 'technique', technique: 'xss', target: 'https://y.com',
  appType: 'ecommerce', techStack: ['Node.js'],
  success: false, attempts: 4, successes: 0,
  payload: '<script>alert(1)</script>',
  context: 'GET /search?q= (y.com)',
  note: 'Reflected XSS on y.com search: 0/4.',
};
const GENERIC_ENTRY = {
  type: 'fingerprint', technique: 'placeholder', target: '',
  appType: 'unknown', techStack: [],
  success: false, attempts: 5, successes: 0,
  payload: '', context: 'model command generation',
  note: 'The model sometimes emits literal placeholders instead of the concrete target URL.',
};

test('ISO-1: scoping keeps same-target detail, reduces cross-target to a rate', () => {
  const scoped = scopeGlobalMemoriesForTarget([X_ENTRY, Y_ENTRY, GENERIC_ENTRY], 'https://y.com');
  assert.equal(scoped.length, 3);
  // Same-target (y.com) passes through untouched.
  assert.equal(scoped[1].payload, Y_ENTRY.payload);
  assert.equal(scoped[1].context, Y_ENTRY.context);
  assert.equal(scoped[1].note, Y_ENTRY.note);
  // Cross-target (x.com) keeps only its technique rate.
  assert.equal(scoped[0].technique, 'sqli');
  assert.equal(scoped[0].appType, 'ecommerce');
  assert.equal(scoped[0].attempts, 3);
  assert.equal(scoped[0].successes, 1);
  assert.equal(scoped[0].payload, '', 'no payload from x.com may reach y.com');
  assert.equal(scoped[0].context, '', 'no endpoint from x.com may reach y.com');
  assert.equal(scoped[0].note, '', 'no target-specific note from x.com may reach y.com');
  assert.equal(scoped[0].target, '');
  // Generic (target-less) passes through untouched.
  assert.equal(scoped[2].note, GENERIC_ENTRY.note);
  // Inputs are never mutated.
  assert.equal(X_ENTRY.payload.includes('OR 1=1'), true);
});

test('ISO-2: for y.com, the prompt shows y.com in full and x.com only as a rate', () => {
  fs.writeFileSync(path.join(tmpRoot, 'global-memory.jsonl'),
    [X_ENTRY, Y_ENTRY, GENERIC_ENTRY].map((e) => JSON.stringify(e)).join('\n') + '\n');
  const picked = getRelevantMemories({ appType: 'ecommerce', techStack: ['Node.js'] }, 6, { target: 'https://y.com' });
  const text = formatGlobalMemoryForPrompt(picked);
  assert.ok(!text.includes('x.com'), 'no x.com target name may appear');
  assert.ok(!text.includes('/rest/user/login'), 'no x.com endpoint may appear');
  assert.ok(!text.includes('OR 1=1'), 'no x.com payload may appear');
  assert.ok(!text.includes('admin JWT on x.com'), 'no x.com claim may appear');
  assert.ok(text.includes('/search?q= (y.com)'), 'the y.com entry shows in full on its own target');
  assert.ok(text.includes('SQLI [ecommerce] (1/3 succeeded): try early.'), 'the x.com technique survives only as a nameless rate line');
  assert.ok(text.includes('Lesson: The model sometimes emits literal placeholders'), 'generic lessons survive');
  // And the same store, read for x.com, shows the x.com detail in full.
  const forX = formatGlobalMemoryForPrompt(getRelevantMemories({ appType: 'ecommerce', techStack: ['Node.js'] }, 6, { target: 'https://x.com' }));
  assert.ok(forX.includes('/rest/user/login (x.com)'), 'x.com detail shows on x.com');
});

test('ISO-3: recall on y.com never surfaces an x.com endpoint', () => {
  const hit = searchRecall({ events: [], reasoningRows: [], globalMemories: [X_ENTRY, Y_ENTRY], query: 'sqli login', limit: 8, target: 'https://y.com' });
  assert.ok(!hit.text.includes('x.com'), 'recall must not name the other target');
  assert.ok(!hit.text.includes('/rest/user/login'), 'recall must not carry the other target endpoint');
  assert.ok(!hit.text.includes('OR 1=1'), 'recall must not carry the other target payload');
  const same = searchRecall({ events: [], reasoningRows: [], globalMemories: [X_ENTRY, Y_ENTRY], query: 'xss search', limit: 8, target: 'https://y.com' });
  assert.ok(same.text.includes('/search?q= (y.com)'), 'same-target recall shows its own detail');
});

test('ISO-4: same-target matching is origin-exact; unknown never matches', () => {
  assert.ok(sameTargetFolder('https://X.com/', 'https://x.com'));
  assert.ok(sameTargetFolder('http://172.17.0.1:3100/', 'http://172.17.0.1:3100/login.php'), 'same host + same port is the same target');
  // Zero-genuine lane (27 Oct 2026): a host-only key merged DVWA
  // (:3100) and Juice Shop (:3000) into one target, so Juice Shop
  // endpoints leaked into the DVWA hunt. Same host, different port
  // is a DIFFERENT target now.
  assert.ok(!sameTargetFolder('https://x.com:8443/a', 'http://x.com/b'), 'same host, different port, is a different target');
  assert.ok(!sameTargetFolder('http://172.17.0.1:3100/', 'http://172.17.0.1:3000/'), 'DVWA :3100 and Juice Shop :3000 never share memory');
  assert.ok(!sameTargetFolder('https://x.com', 'https://y.com'));
  assert.ok(!sameTargetFolder('https://a.x.com', 'https://x.com'), 'a subdomain is not its parent');
  assert.ok(!sameTargetFolder('', 'https://x.com'));
  assert.ok(!sameTargetFolder('https://x.com', ''));
});

function seedHunt(huntId, target, title) {
  const dir = path.join(tmpRoot, 'hunts', huntId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ huntId, target, state: 'running', iteration: 1 }));
  fs.writeFileSync(path.join(dir, 'events.jsonl'), JSON.stringify({
    type: 'finding', title, class: 'sqli', verified: true,
    verification: 'verified by probe', cachedAt: new Date().toISOString(),
  }) + '\n');
}

test('ISO-5: cross-hunt episode retrieval stays within the same target', async () => {
  seedHunt('h_iso_x', 'https://x.com', 'SQLi login bypass on x.com');
  seedHunt('h_iso_y', 'https://y.com', 'SQLi login bypass on y.com');
  flushHuntEpisodes('h_iso_x');
  flushHuntEpisodes('h_iso_y');
  // Fail-closed control (#321): without a target, cross-hunt retrieval
  // is scoped to the current hunt only — no other target's episodes.
  const unscoped = await retrieveEpisodes('sqli login', { huntId: 'h_iso_y', crossHunt: true, limit: 5 });
  const unscopedHunts = new Set(unscoped.results.map((r) => r.hunt_id));
  assert.ok(!unscopedHunts.has('h_iso_x'), 'fail-closed: unscoped cross-hunt retrieval must NOT see x.com episodes');
  assert.ok(unscopedHunts.has('h_iso_y'), 'fail-closed: unscoped cross-hunt retrieval still sees the current hunt');
  // Scoped: only the y.com hunt's episodes may return.
  const scoped = await retrieveEpisodes('sqli login', { huntId: 'h_iso_y', crossHunt: true, limit: 5, target: 'https://y.com' });
  assert.ok(scoped.results.length > 0, 'scoped retrieval still returns the same-target episodes');
  for (const r of scoped.results) {
    assert.equal(r.hunt_id, 'h_iso_y', `no x.com episode may reach y.com (got ${r.hunt_id})`);
  }
  assert.ok(!scoped.results.some((r) => String(r.title || '').includes('x.com')));
});
