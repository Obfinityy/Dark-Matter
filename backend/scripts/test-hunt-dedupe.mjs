// Regression test for hunt-creation deduplication (owner rule: entering a
// target that was already hunted must redirect to the existing hunt and
// resume it from its checkpoint — never create a duplicate).
// Run: node backend/scripts/test-hunt-dedupe.mjs
//
// Bugs this pins (all live on production before the fix):
//   1. Backend dedupe matched the raw target string with only a trailing
//      slash stripped, so "https://thebhavesh.online" and
//      "https://www.thebhavesh.online/" counted as different targets.
//   2. It returned the FIRST match in list order (newest createdAt), which
//      with ~20 legacy bench duplicates was a stale iter-5 paused hunt
//      instead of the running main hunt at iter 442.
//   3. It claimed "Resuming your existing hunt" but never resumed anything.
import { normalizeTargetKey, pickExistingHunt } from '../src/routes/hunts.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// ---- normalizeTargetKey ----------------------------------------------------
check('https root', normalizeTargetKey('https://thebhavesh.online') === 'thebhavesh.online');
check('www + trailing slash variant matches', normalizeTargetKey('https://www.thebhavesh.online/') === 'thebhavesh.online');
check('scheme variant matches', normalizeTargetKey('http://thebhavesh.online') === 'thebhavesh.online');
check('bare host matches', normalizeTargetKey('thebhavesh.online') === 'thebhavesh.online');
check('case-insensitive', normalizeTargetKey('HTTPS://WWW.Example.COM/') === 'example.com');
check('lab target keeps non-default port', normalizeTargetKey('http://172.17.0.1:3000') === '172.17.0.1:3000');
check('lab trailing slash variant matches', normalizeTargetKey('http://172.17.0.1:3000/') === '172.17.0.1:3000');
check('default https port dropped', normalizeTargetKey('https://example.com:443/') === 'example.com');
check('non-default port + path kept', normalizeTargetKey('https://example.com:8443/app/') === 'example.com:8443/app');
check('different paths are different targets', normalizeTargetKey('https://example.com/app') !== normalizeTargetKey('https://example.com'));
check('empty target', normalizeTargetKey('') === '' && normalizeTargetKey(null) === '');

// ---- pickExistingHunt -------------------------------------------------------
const U = 'user-1';
const bench = (huntId, state, iteration, createdAt) => ({
  huntId, userId: U, target: 'http://172.17.0.1:3000', state, iteration, createdAt,
});
const metas = [
  bench('h_newest_paused', 'paused', 5, '2026-10-20T09:00:00.000Z'),
  bench('h_main_running', 'running', 442, '2026-10-18T09:00:00.000Z'),
  bench('h_stopped', 'stopped', 32, '2026-10-19T09:00:00.000Z'),
  { huntId: 'h_other_user', userId: 'user-2', target: 'http://172.17.0.1:3000', state: 'running', iteration: 9, createdAt: '2026-10-20T10:00:00.000Z' },
  { huntId: 'h_www_paused', userId: U, target: 'https://www.thebhavesh.online/', state: 'paused', iteration: 30, createdAt: '2026-10-16T09:00:00.000Z' },
  { huntId: 'h_nowww_stopped', userId: U, target: 'https://thebhavesh.online', state: 'stopped', iteration: 10, createdAt: '2026-10-15T09:00:00.000Z' },
];

check('running hunt wins over newer paused duplicate',
  pickExistingHunt(metas, U, 'http://172.17.0.1:3000')?.huntId === 'h_main_running');
check('trailing-slash variant finds the same running hunt',
  pickExistingHunt(metas, U, 'http://172.17.0.1:3000/')?.huntId === 'h_main_running');
check('paused beats stopped for the same canonical target (www variant)',
  pickExistingHunt(metas, U, 'https://thebhavesh.online')?.huntId === 'h_www_paused');
check('another user\'s hunt is never reused',
  pickExistingHunt(metas, 'user-2', 'http://172.17.0.1:3000')?.huntId === 'h_other_user');
check('unknown user gets nothing',
  pickExistingHunt(metas, 'user-3', 'http://172.17.0.1:3000') === null);
check('unhunted target gets nothing',
  pickExistingHunt(metas, U, 'https://never-hunted.example') === null);

const tieMetas = [
  bench('h_low_iter', 'paused', 5, '2026-10-20T09:00:00.000Z'),
  bench('h_high_iter', 'paused', 38, '2026-10-19T09:00:00.000Z'),
];
check('same-state tie breaks toward most progress (iteration)',
  pickExistingHunt(tieMetas, U, 'http://172.17.0.1:3000')?.huntId === 'h_high_iter');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
