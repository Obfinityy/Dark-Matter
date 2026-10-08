/**
 * formSurfaceMiner.test.js — Tests for ideas 761–770 (form/ARIA/input crawl-surface miner).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  harvestAriaDescribedByTargets,
  catalogFormActions,
  detectMethodOverrides,
  harvestInputNames,
  mineHiddenFields,
  mineSelectOptionUrls,
  harvestDatalistValues,
  findAutocompleteHints,
  mapSearchSuggestionApis,
  inferPaginationPatterns,
  FORM_SURFACE_IDEAS,
  registryComplete,
} from '../src/engines/formSurfaceMiner.js';

/* ---------------- 761 — ARIA-describedby target mapping ---------------- */

test('761: harvests referenced element contents', () => {
  const html = `
    <label for="q">Search</label>
    <input id="q" aria-describedby="q-help" />
    <div id="q-help">Use filters like <b>site:</b> to narrow results.</div>`;
  const out = harvestAriaDescribedByTargets(html);
  assert.equal(out.length, 1);
  assert.equal(out[0].describing, 'input#q');
  assert.equal(out[0].refId, '#q-help');
  assert.ok(out[0].text.includes('site:'), `unexpected text: ${out[0].text}`);
  assert.equal(out[0].hidden, false);
});

test('761: multiple ids in one aria-describedby, hidden target flagged', () => {
  const html = `
    <button id="go" aria-describedby="h1 h2">Go</button>
    <span id="h1" hidden>hidden help</span>
    <span id="h2">visible help</span>`;
  const out = harvestAriaDescribedByTargets(html);
  assert.equal(out.length, 2);
  assert.equal(out[0].text, 'hidden help');
  assert.equal(out[0].hidden, true);
  assert.equal(out[1].hidden, false);
});

test('761: dangling reference and empty HTML yield nothing', () => {
  assert.deepEqual(harvestAriaDescribedByTargets('<input aria-describedby="nope">'), []);
  assert.deepEqual(harvestAriaDescribedByTargets(''), []);
  assert.deepEqual(harvestAriaDescribedByTargets(), []);
});

/* ---------------- 762 — Form-action endpoint cataloging ---------------- */

test('762: catalogs form action URLs and methods', () => {
  const html = `
    <form id="login" action="/api/auth/login" method="post">
      <input name="u">
    </form>
    <form action="https://example.com/submit"><input name="e"></form>`;
  const out = catalogFormActions(html);
  assert.equal(out.length, 2);
  assert.equal(out[0].form, 'form#login');
  assert.equal(out[0].action, '/api/auth/login');
  assert.equal(out[0].method, 'POST');
  assert.equal(out[1].action, 'https://example.com/submit');
  assert.equal(out[1].method, 'GET');
});

test('762: forms without action are still cataloged', () => {
  const out = catalogFormActions('<form name="search"><input name="q"></form>');
  assert.equal(out.length, 1);
  assert.equal(out[0].action, '');
  assert.equal(out[0].form, 'form[name="search"]');
});

test('762: empty HTML yields empty catalog', () => {
  assert.deepEqual(catalogFormActions(''), []);
});

/* ---------------- 763 — Form-method override detection ---------------- */

test('763: detects hidden-input _method overrides', () => {
  const html = `
    <form id="upd" action="/items/1" method="post">
      <input type="hidden" name="_method" value="PUT">
    </form>`;
  const out = detectMethodOverrides(html);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { form: 'form#upd', override: 'PUT', source: 'hidden_input' });
});

test('763: detects query-param _method overrides', () => {
  const html = '<form action="/items/1?_method=DELETE" method="post"></form>';
  const out = detectMethodOverrides(html);
  assert.equal(out.length, 1);
  assert.equal(out[0].override, 'DELETE');
  assert.equal(out[0].source, 'query_param');
});

test('763: plain forms yield no overrides', () => {
  assert.deepEqual(detectMethodOverrides('<form action="/x" method="post"></form>'), []);
  assert.deepEqual(detectMethodOverrides(''), []);
});

/* ---------------- 764 — Input-name parameter harvesting ---------------- */

test('764: harvests input names attributed to their form', () => {
  const html = `
    <form id="login" action="/login" method="post">
      <input type="text" name="username">
      <input type="password" name="password">
      <select name="locale"><option value="en">EN</option></select>
      <textarea name="notes"></textarea>
    </form>`;
  const out = harvestInputNames(html);
  assert.deepEqual(out.map((o) => o.name), ['username', 'password', 'locale', 'notes']);
  assert.ok(out.every((o) => o.form === 'form#login'));
  assert.equal(out[1].type, 'password');
  assert.equal(out[2].tag, 'select');
});

test('764: dedupes repeated names and marks orphan fields', () => {
  const html = `
    <form id="a"><input name="q"></form>
    <form id="b"><input name="q"></form>
    <input name="standalone">`;
  const out = harvestInputNames(html);
  assert.deepEqual(out.map((o) => o.name), ['q', 'standalone']);
  assert.equal(out[0].form, 'form#a');
  assert.equal(out[1].form, '(no form)');
});

test('764: nameless inputs skipped, empty HTML empty', () => {
  assert.deepEqual(harvestInputNames('<input type="text"><form></form>'), []);
  assert.deepEqual(harvestInputNames(''), []);
});

/* ---------------- 765 — Hidden-field value mining ---------------- */

test('765: mines hidden name/value pairs per form', () => {
  const html = `
    <form id="pay" action="/pay" method="post">
      <input type="hidden" name="csrf_token" value="abc123">
      <input type="hidden" name="order_id" value="42">
      <input type="text" name="card">
    </form>`;
  const out = mineHiddenFields(html);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { form: 'form#pay', name: 'csrf_token', value: 'abc123' });
  assert.deepEqual(out[1], { form: 'form#pay', name: 'order_id', value: '42' });
});

test('765: hidden inputs without name are skipped', () => {
  assert.deepEqual(mineHiddenFields('<form><input type="hidden" value="x"></form>'), []);
  assert.deepEqual(mineHiddenFields('<input type="hidden" name="orphan" value="1">'), []);
  assert.deepEqual(mineHiddenFields(''), []);
});

/* ---------------- 766 — Select-option URL mining ---------------- */

test('766: extracts URLs from select option values', () => {
  const html = `
    <select id="jump" onchange="go(this.value)">
      <option value="">Choose…</option>
      <option value="/docs">Docs</option>
      <option value="https://blog.example.com">Blog</option>
      <option value="plain-label">Not a URL</option>
    </select>`;
  const out = mineSelectOptionUrls(html);
  assert.equal(out.length, 2);
  assert.equal(out[0].select, 'select#jump');
  assert.equal(out[0].label, 'Docs');
  assert.equal(out[0].url, '/docs');
  assert.equal(out[1].url, 'https://blog.example.com');
});

test('766: no URL-like values yields nothing', () => {
  assert.deepEqual(
    mineSelectOptionUrls('<select><option value="a">A</option></select>'),
    []
  );
  assert.deepEqual(mineSelectOptionUrls(''), []);
});

/* ---------------- 767 — Datalist value harvesting ---------------- */

test('767: harvests datalist values', () => {
  const html = `
    <input list="browsers" name="browser">
    <datalist id="browsers">
      <option value="Chrome">
      <option value="Firefox">
      <option>Safari</option>
    </datalist>`;
  const out = harvestDatalistValues(html);
  assert.equal(out.length, 1);
  assert.equal(out[0].datalist, 'datalist#browsers');
  assert.deepEqual(out[0].values, ['Chrome', 'Firefox', 'Safari']);
});

test('767: empty datalist omitted, empty HTML empty', () => {
  assert.deepEqual(harvestDatalistValues('<datalist id="x"></datalist>'), []);
  assert.deepEqual(harvestDatalistValues(''), []);
});

/* ---------------- 768 — Autocomplete endpoint discovery ---------------- */

test('768: finds endpoint hints in oninput and data-api attributes', () => {
  const html = `
    <input id="s" oninput="fetch('/api/suggest?q='+this.value)">
    <input id="t" data-api="/api/v2/autocomplete">`;
  const out = findAutocompleteHints(html);
  assert.equal(out.length, 2);
  const bySource = Object.fromEntries(out.map((o) => [o.source, o.hint]));
  assert.equal(bySource.oninput, '/api/suggest?q=');
  assert.equal(bySource['data-api'], '/api/v2/autocomplete');
  assert.equal(out[0].element, 'input#s');
});

test('768: non-URL handler code yields nothing', () => {
  assert.deepEqual(findAutocompleteHints('<input oninput="doCount()">'), []);
  assert.deepEqual(findAutocompleteHints(''), []);
});

/* ---------------- 769 — Search-suggestion API mapping ---------------- */

test('769: maps suggestion APIs from keyup handlers', () => {
  const html = `
    <input id="search" onkeyup="suggest('/api/typeahead?term='+this.value)">
    <input id="city" onkeydown="cityLookup('https://geo.example.com/hint')">`;
  const out = mapSearchSuggestionApis(html);
  assert.equal(out.length, 2);
  assert.equal(out[0].handler, 'onkeyup');
  assert.equal(out[0].candidate, '/api/typeahead?term=');
  assert.equal(out[1].handler, 'onkeydown');
  assert.equal(out[1].candidate, 'https://geo.example.com/hint');
});

test('769: key handlers without URLs yield nothing', () => {
  assert.deepEqual(mapSearchSuggestionApis('<input onkeyup="validate()">'), []);
  assert.deepEqual(mapSearchSuggestionApis(''), []);
});

/* ---------------- 770 — Pagination-link pattern inference ---------------- */

test('770: infers query-param pagination patterns with working generator', () => {
  const html = `
    <nav class="pagination">
      <a href="/blog?page=1">1</a>
      <a href="/blog?page=2">2</a>
      <a href="/blog?page=3">3</a>
    </nav>`;
  const out = inferPaginationPatterns(html);
  assert.equal(out.length, 1);
  assert.equal(out[0].pattern, '/blog?page={n}');
  assert.equal(out[0].count, 3);
  assert.equal(out[0].generator(42), '/blog?page=42');
  assert.ok(out[0].exampleUrls.includes('/blog?page=2'));
});

test('770: infers path-segment pagination patterns and groups separately', () => {
  const html = `
    <a href="/shop/page/1">1</a><a href="/shop/page/2">2</a>
    <a href="/blog?page=7">7</a>`;
  const out = inferPaginationPatterns(html);
  assert.equal(out.length, 2);
  const byPattern = Object.fromEntries(out.map((o) => [o.pattern, o.generator(9)]));
  assert.equal(byPattern['/shop/page/{n}'], '/shop/page/9');
  assert.equal(byPattern['/blog?page={n}'], '/blog?page=9');
});

test('770: links without page numbers yield no patterns', () => {
  assert.deepEqual(inferPaginationPatterns('<a href="/about">About</a>'), []);
  assert.deepEqual(inferPaginationPatterns(''), []);
});

/* ---------------- Registry ---------------- */

test('registry: covers all 10 ideas 761–770 with zero skips', () => {
  const ids = Object.keys(FORM_SURFACE_IDEAS).map(Number).sort((a, b) => a - b);
  assert.deepEqual(ids, [761, 762, 763, 764, 765, 766, 767, 768, 769, 770]);
  for (const id of ids) {
    assert.ok(typeof FORM_SURFACE_IDEAS[id] === 'string' && FORM_SURFACE_IDEAS[id].length > 0);
  }
  assert.deepEqual(registryComplete(), { covered: 10, total: 10 });
});
