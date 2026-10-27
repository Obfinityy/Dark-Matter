// Fuzzy label matching for OCR-mangled screen text (27 Oct 2026).
//
// Live failure (22:50:01 IST 27 Oct 2026): the DVWA login-first
// died because the OCR map reads "Username" as "u ername" and
// "Password" as "pa word", and the click resolver demanded an
// exact label. Asserted here (pure):
//   - flatLabel strips spaces/punctuation and lowercases.
//   - labelEditDistance is the Levenshtein distance on flat forms.
//   - bestLabelMatch finds the closest label, honours maxDistance
//     and requireUnique, and never guesses between ties.
//   - the live cases: "u ername" -> "Username" (distance 1),
//     "pa word" -> "Password" (distance 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flatLabel, labelEditDistance, fuzzyThreshold, bestLabelMatch } from './labelMatch.js';

test('flatLabel strips spaces and punctuation, lowercases', () => {
  assert.equal(flatLabel('u ername'), 'uername');
  assert.equal(flatLabel('Username'), 'username');
  assert.equal(flatLabel('pa word'), 'paword');
  assert.equal(flatLabel('Log in!'), 'login');
  assert.equal(flatLabel(''), '');
  assert.equal(flatLabel(null), '');
});

test('labelEditDistance is Levenshtein on the flat forms', () => {
  assert.equal(labelEditDistance('Username', 'u ername'), 1);
  assert.equal(labelEditDistance('Password', 'pa word'), 2);
  assert.equal(labelEditDistance('Login', 'Login'), 0);
  assert.equal(labelEditDistance('Login', 'Logln'), 1);
  assert.equal(labelEditDistance('', 'abc'), 3);
  assert.equal(labelEditDistance('abc', ''), 3);
});

test('fuzzyThreshold is a quarter of the length, at least 1', () => {
  assert.equal(fuzzyThreshold(8), 2);
  assert.equal(fuzzyThreshold(5), 1);
  assert.equal(fuzzyThreshold(3), 1);
  assert.equal(fuzzyThreshold(0), 1);
});

test('bestLabelMatch: the live OCR cases resolve to the right control', () => {
  const labels = ['u ername', 'pa word', 'Login'];
  const user = bestLabelMatch('Username', labels, { maxDistance: fuzzyThreshold(8), requireUnique: true });
  assert.deepEqual(user, { index: 0, label: 'u ername', distance: 1 });
  const pass = bestLabelMatch('Password', labels, { maxDistance: fuzzyThreshold(8), requireUnique: true });
  assert.deepEqual(pass, { index: 1, label: 'pa word', distance: 2 });
  const login = bestLabelMatch('Login', labels, { maxDistance: fuzzyThreshold(5), requireUnique: true });
  assert.deepEqual(login, { index: 2, label: 'Login', distance: 0 });
});

test('bestLabelMatch: too far is null; a tie with requireUnique is null', () => {
  // 'uname' is distance 3 from 'Username' — past the fuzzy threshold (2).
  assert.equal(bestLabelMatch('Username', ['uname', 'pa55word'], { maxDistance: 2, requireUnique: true }), null);
  // 'u ername' (1) and 'usernane' (1) tie for 'Username' — never guess.
  assert.equal(bestLabelMatch('Username', ['u ername', 'usernane'], { maxDistance: 2, requireUnique: true }), null);
  // Without requireUnique the first closest wins (the map fallback's relaxed rule).
  const relaxed = bestLabelMatch('Username', ['u ername', 'usernane'], { maxDistance: 2 });
  assert.equal(relaxed.index, 0);
  assert.equal(bestLabelMatch('', ['Login']), null);
  assert.equal(bestLabelMatch('Login', []), null);
});
