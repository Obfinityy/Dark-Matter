// Lane AK (24 Oct 2026) — the label-click ReferenceError.
//
// The CDP driver injects resolveClickTarget's source into the Node
// script, but the click expression runs IN THE PAGE via
// Runtime.evaluate — where the Node-side declaration does not exist.
// Every label click ("Login", ...) therefore died with
// "ReferenceError: resolveClickTarget is not defined" (the 16:22Z
// "Browser control failed: cdp.mjs:95" that stalled the Infomaniak
// login). The fix interpolates the function's source into the
// evaluated expression itself.
//
// These tests run the ACTUAL click expression from the shipped
// CDP_SCRIPT (not a copy) in a vm sandbox with a fake document:
// the fixed construction must click "Login", and the old
// construction (injection stripped) must throw the ReferenceError —
// proving the test would have caught the bug.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { CDP_SCRIPT, resolveClickTarget } from './guiTools.js';
import { flatLabel, fuzzyThreshold, bestLabelMatch } from './labelMatch.js';

function clickExprFromScript(script) {
  const m = /const expr = `\(\(\) => \{([\s\S]*?) \}\)\(\)`;\n  const clicked = await evaluate\(expr\);/.exec(script);
  assert.ok(m, 'click expression must be present in CDP_SCRIPT');
  return m[1];
}

function fakeDocument() {
  const mk = (label) => ({
    innerText: label,
    value: '',
    tagName: 'BUTTON',
    getAttribute: () => '',
    placeholder: '',
    name: '',
    id: '',
    scrollIntoView() {},
    focus() {},
    click() { this.clicked = true; },
    clicked: false,
  });
  const els = [mk('Login'), mk('Sign in'), mk('Create an account (free)')];
  return {
    els,
    querySelector: () => null,
    querySelectorAll: () => els,
  };
}

function runClickExpr(exprSrc, raw) {
  const interpolated = exprSrc
    .replace('${resolveClickTarget.toString()}', resolveClickTarget.toString())
    .replace('${JSON.stringify(params.text)}', JSON.stringify(raw));
  const code = `(() => {${interpolated} })()`;
  const document = fakeDocument();
  const sandbox = { document, location: { href: 'https://login.infomaniak.com/en/login' } };
  vm.createContext(sandbox);
  const result = vm.runInContext(code, sandbox, { timeout: 1000 });
  return { result, clickedEl: document.els[0] };
}

test('AK-1: the click branch of CDP_SCRIPT injects resolveClickTarget into the page', () => {
  const expr = clickExprFromScript(CDP_SCRIPT);
  assert.match(expr, /\$\{resolveClickTarget\.toString\(\)\}/, 'the evaluated expression must carry the function source');
});

test('AK-2: the fixed click expression clicks "Login" in a page context', () => {
  const expr = clickExprFromScript(CDP_SCRIPT);
  const { result, clickedEl } = runClickExpr(expr, 'Login');
  assert.equal(result.ok, true);
  assert.equal(result.clicked, 'Login');
  assert.equal(clickedEl.clicked, true);
  assert.equal(result.url, 'https://login.infomaniak.com/en/login');
});

test('AK-3: without the injection the same expression throws the ReferenceError (the live bug)', () => {
  const expr = clickExprFromScript(CDP_SCRIPT);
  const stripped = expr.replace('${resolveClickTarget.toString()}', '');
  assert.throws(
    () => runClickExpr(stripped, 'Login'),
    // vm-realm errors do not pass host instanceof checks; match by name.
    (e) => e && e.name === 'ReferenceError' && /resolveClickTarget/.test(e.message),
    'expected ReferenceError: resolveClickTarget is not defined'
  );
});

test('AK-4: a non-matching label still fails cleanly with the label list (no throw)', () => {
  const expr = clickExprFromScript(CDP_SCRIPT);
  const { result } = runClickExpr(expr, 'No such button');
  assert.equal(result.ok, false);
  assert.match(result.error, /no clickable element matches/);
  assert.match(result.error, /Login/);
});

// OCR FUZZY TIERS (27 Oct 2026, live 22:50 failure): the OCR map
// reads "Username" as "u ername" and "Password" as "pa word", and
// tiers 1–3 could not match them — the DVWA login died on one OCR
// misread. Tier 4 (normalised exact) repairs splits; tier 5
// (fuzzy, small edit distance, strictly-closest only) repairs
// dropped letters. Exact matches still win (tier 1), and a tie
// still fails rather than guessing.

test('AK-5: tier 4 — a space-split label matches its normalised form', () => {
  assert.equal(resolveClickTarget('User Name', ['Username']).tier, 4);
  assert.equal(resolveClickTarget('User Name', ['Username']).index, 0);
  assert.equal(resolveClickTarget('Log in', ['Login']).tier, 4);
});

test('AK-6: tier 5 — the live OCR cases resolve to the right control', () => {
  const labels = ['u ername', 'pa word', 'Login'];
  const user = resolveClickTarget('Username', labels);
  assert.equal(user.status, 'resolved');
  assert.equal(user.tier, 5);
  assert.equal(user.label, 'u ername');
  const pass = resolveClickTarget('Password', labels);
  assert.equal(pass.status, 'resolved');
  assert.equal(pass.tier, 5);
  assert.equal(pass.label, 'pa word');
});

test('AK-7: tier 5 — exact still wins, and a tie still fails (never a guess)', () => {
  const exact = resolveClickTarget('Login', ['Login', 'Logln']);
  assert.equal(exact.tier, 1);
  assert.equal(exact.label, 'Login');
  // 'u ername' and 'usernane' are both distance 1 from 'Username'.
  const tied = resolveClickTarget('Username', ['u ername', 'usernane']);
  assert.equal(tied.status, 'none');
  // Too far from every label: still a clean failure with the list.
  // ('uname' is distance 3 from 'Username' — past the threshold of 2.)
  const far = resolveClickTarget('Username', ['uname', 'pa55word']);
  assert.equal(far.status, 'none');
  assert.match(far.candidates.join(' '), /uname/);
});

test('AK-8: the shipped click expression clicks the OCR-mangled "u ername" for "Username"', () => {
  const expr = clickExprFromScript(CDP_SCRIPT);
  const document = {
    els: ['u ername', 'pa word', 'Login'].map((label) => {
      const el = {
        innerText: label,
        value: '',
        tagName: 'INPUT',
        getAttribute: () => '',
        placeholder: '',
        name: '',
        id: '',
        scrollIntoView() {},
        focus() {},
        click() { this.clicked = true; },
        clicked: false,
      };
      return el;
    }),
    querySelector: () => null,
    querySelectorAll: () => document.els,
  };
  const interpolated = expr
    .replace('${resolveClickTarget.toString()}', resolveClickTarget.toString())
    .replace('${JSON.stringify(params.text)}', JSON.stringify('Username'));
  const code = `(() => {${interpolated} })()`;
  const sandbox = { document, location: { href: 'http://172.17.0.1:3100/login.php' } };
  vm.createContext(sandbox);
  const result = vm.runInContext(code, sandbox, { timeout: 1000 });
  assert.equal(result.ok, true);
  assert.equal(result.clicked, 'u ername');
  assert.equal(document.els[0].clicked, true);
});

test('AK-9: the inline fuzzy logic stays in sync with labelMatch.js (the canonical copy)', () => {
  // resolveClickTarget's source is embedded into the CDP driver, so
  // its fuzzy logic is an inline copy of labelMatch.js — this table
  // fails if the two ever disagree on the chosen element.
  const cases = [
    ['Username', ['u ername', 'pa word', 'Login']],
    ['Password', ['u ername', 'pa word', 'Login']],
    ['Login', ['u ername', 'pa word', 'Login']],
    ['Username', ['u ername', 'usernane']],
    ['Username', ['uname', 'pa55word']],
    ['User Name', ['Username']],
    ['Log in', ['Login']],
    ['Submit', ['low', 'medium', 'Submit']],
  ];
  for (const [wanted, labels] of cases) {
    const verdict = resolveClickTarget(wanted, labels);
    const got = verdict.status === 'none' ? null : verdict.index;
    const canonical = bestLabelMatch(wanted, labels, { maxDistance: fuzzyThreshold(flatLabel(wanted).length), requireUnique: true });
    const want = canonical ? canonical.index : null;
    assert.equal(got, want, `wanted ${wanted} over [${labels.join(', ')}]: resolver chose ${got}, canonical chose ${want}`);
  }
});
