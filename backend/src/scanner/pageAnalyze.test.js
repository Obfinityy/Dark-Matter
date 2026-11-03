// One-page-deep element analysis tests (3 Nov 2026, owner order).
//
// The user pastes ONE page link. The scanner inventories every element on
// THAT page (inputs, buttons, forms, textareas, selects, URL params) and
// maps each element to its predefined vulnerability classes
// (ELEMENT_VULN_MATRIX) — no AI, every test case predefined.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePage,
  planForPage,
  matrixFor,
  extractAttributes,
  ELEMENT_VULN_MATRIX,
} from './pageAnalyze.js';
import { DEFAULT_PHASES } from './index.js';

const PAGE = `
<html><body>
<form action="/login.php" method="post">
  <input type="text" name="username" id="u">
  <input type="password" name="password">
  <input type="hidden" name="token" value="abc">
  <input type="submit" name="Login" value="Login">
  <textarea name="comment"></textarea>
  <select name="choice"><option>1</option></select>
  <button type="submit">Go</button>
</form>
<input type="text" name="standalone_q">
<input name="notype">
</body></html>`;
const URL = 'http://172.17.0.1:3100/login.php?debug=1';

test('extractAttributes parses quoted, single-quoted and bare values', () => {
  const a = extractAttributes('<input type="text" name=\'user\' disabled value=1>');
  assert.equal(a.type, 'text');
  assert.equal(a.name, 'user');
  assert.equal(a.value, '1');
  assert.ok('disabled' in a);
});

test('analyzePage inventories typed inputs with form refs', () => {
  const a = analyzePage(PAGE, URL);
  assert.equal(a.forms.length, 1);
  assert.equal(a.forms[0].method, 'post');
  assert.ok(a.forms[0].action.endsWith('/login.php'));
  const byName = Object.fromEntries(a.inputs.map((i) => [i.name, i]));
  assert.equal(byName.username.type, 'text');
  assert.equal(byName.password.type, 'password');
  assert.equal(byName.token.type, 'hidden');
  assert.ok(byName.username.form, 'in-form input carries its form');
  assert.equal(byName.username.form.method, 'post');
  // Standalone inputs (outside any form) are flagged form:null.
  assert.equal(byName.standalone_q.form, null);
  assert.equal(byName.notype.type, 'text', 'missing type defaults to text');
  assert.equal(byName.notype.form, null);
});

test('analyzePage inventories textareas, selects, buttons, params', () => {
  const a = analyzePage(PAGE, URL);
  assert.equal(a.textareas.length, 1);
  assert.equal(a.textareas[0].name, 'comment');
  assert.ok(a.textareas[0].form);
  assert.equal(a.selects.length, 1);
  assert.equal(a.selects[0].name, 'choice');
  assert.ok(a.buttons.length >= 1, 'button elements inventoried');
  assert.deepEqual(a.params, ['debug']);
});

test('every matrix class is a real probe phase (no dangling references)', () => {
  const phases = new Set(DEFAULT_PHASES);
  for (const [kind, classes] of Object.entries(ELEMENT_VULN_MATRIX)) {
    assert.ok(Array.isArray(classes), `${kind} maps to an array`);
    for (const c of classes) {
      assert.ok(phases.has(c), `${kind} -> unknown phase "${c}"`);
    }
  }
});

test('matrix covers the element kinds the analyzer emits', () => {
  for (const kind of ['input:text', 'input:password', 'input:hidden', 'input:file', 'textarea', 'select', 'url-param', 'form', 'page']) {
    assert.ok(kind in ELEMENT_VULN_MATRIX, `matrix missing kind ${kind}`);
  }
  // A text input must map to the injection battery.
  assert.ok(matrixFor('input:text').includes('sqli-error'));
  assert.ok(matrixFor('input:text').includes('xss'));
  // Unknown kinds map to nothing, never crash.
  assert.deepEqual(matrixFor('input:whatever'), []);
});

test('planForPage expands to one entry per element with its classes', () => {
  const a = analyzePage(PAGE, URL);
  const plan = planForPage(a);
  const kinds = plan.map((p) => p.kind);
  assert.ok(kinds.includes('input:text'));
  assert.ok(kinds.includes('input:password'));
  assert.ok(kinds.includes('input:hidden'));
  assert.ok(kinds.includes('textarea'));
  assert.ok(kinds.includes('select'));
  assert.ok(kinds.includes('url-param'));
  assert.ok(kinds.includes('form'));
  assert.ok(kinds.includes('page'));
  for (const p of plan) {
    assert.ok(Array.isArray(p.classes), `${p.element} has classes array`);
    assert.deepEqual(p.classes, matrixFor(p.kind), 'classes come from the matrix');
  }
  const standalone = plan.find((p) => p.element.includes('standalone_q'));
  assert.ok(standalone.element.includes('[standalone]'));
});
