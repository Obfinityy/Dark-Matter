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
