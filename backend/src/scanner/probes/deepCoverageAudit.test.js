// Deep per-component coverage audit — tests (9 Nov 2026).
//
// The audit found the scanner's one-page-deep model had silent gaps:
// the static form extractor dropped textareas/selects, SPA route
// discovery burned render slots on asset URLs, validation tested only
// 2 points per URL, error-disclosure malformed only the first param,
// and no phase reported which inventoried points it actually
// attempted. These tests pin the fixes. No network, no lab needed —
// fetches go through a stubbed global fetch; fixtures are fake.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractForms } from '../crawl.js';
import { extractSpaRoutes } from '../domRender.js';
import {
  noteAttemptedPoints,
  buildCoverageExtras,
  probePointParameter,
} from '../probePoints.js';
import { probeSqliError } from './sqliError.js';
import { probeRfi } from './rfi.js';
import { probeTabnabbing } from './tabnabbing.js';
import { probeCsvLog } from './csvLogInjection.js';

const realFetch = globalThis.fetch;
const inertFetch = async () =>
  new Response('<html><body>inert</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=UTF-8' },
  });

describe('coverage diagnostic helpers (probePoints.js)', () => {
  it('noteAttemptedPoints labels query + path points and is a no-op without a diagnostics object', () => {
    const diag = {};
    noteAttemptedPoints({ diagnostics: diag }, ['q', { name: 'id', kind: 'path', segment: 2 }]);
    assert.deepEqual(diag.pointsAttempted, ['q', 'id (path)']);
    // No diagnostics object: must not throw, must not attach anything.
    noteAttemptedPoints({}, ['q']);
    noteAttemptedPoints(null, ['q']);
    assert.equal(diag.pointsAttempted.length, 2);
  });

  it('noteAttemptedPoints accumulates across calls (union, deduped)', () => {
    const diag = {};
    noteAttemptedPoints({ diagnostics: diag }, ['a', 'b']);
    noteAttemptedPoints({ diagnostics: diag }, ['b', 'c']);
    assert.deepEqual(diag.pointsAttempted, ['a', 'b', 'c']);
  });

  it('buildCoverageExtras reports offered / attempted / skipped, and nulls when a probe never reported', () => {
    const points = ['a', 'b', 'c', 'd'];
    assert.deepEqual(buildCoverageExtras({ pointsAttempted: ['a', 'c'] }, points), {
      coverage: {
        pointsOffered: 4,
        pointsAttempted: 2,
        attemptedPoints: ['a', 'c'],
        skippedPoints: ['b', 'd'],
      },
    });
    assert.deepEqual(buildCoverageExtras({}, points), {
      coverage: {
        pointsOffered: 4,
        pointsAttempted: null,
        attemptedPoints: null,
        skippedPoints: null,
      },
    });
  });

  it('buildCoverageExtras carries a coverageNote through as note', () => {
    const out = buildCoverageExtras(
      { pointsAttempted: [], coverageNote: 'markup-only probe — no params attempted by design' },
      ['a']
    );
    assert.equal(out.coverage.note, 'markup-only probe — no params attempted by design');
    assert.deepEqual(out.coverage.skippedPoints, ['a']);
  });

  it('probePointParameter labels a bare string and a path point', () => {
    assert.equal(probePointParameter('q'), 'q');
    assert.equal(probePointParameter({ name: 'id', kind: 'path', segment: 2 }), 'id (path)');
  });
});

describe('extractForms includes textareas and selects (crawl.js)', () => {
  it('a form with a textarea and a select yields them with type + value', () => {
    const forms = extractForms(
      `<form action="/guest" method="post">
        <input name="txtName">
        <textarea name="mtxMessage">hello</textarea>
        <select name="rating"><option value="1">1</option><option value="2" selected>2</option></select>
        <input type="submit" name="btnSign" value="Sign">
      </form>`,
      'https://example.com/'
    );
    assert.equal(forms.length, 1);
    // Grouped by tag type (inputs, then textareas, then selects) —
    // document order is NOT preserved across tag types. On the
    // measured pages (<=4 controls per form) no cap binds, so nothing
    // is skipped; on a form with 5+ controls a per-URL cap would test
    // inputs first and the diagnostic would name the skipped tail.
    assert.deepEqual(forms[0].inputs, [
      { name: 'txtName', type: 'text', value: '' },
      { name: 'btnSign', type: 'submit', value: 'Sign' },
      { name: 'mtxMessage', type: 'textarea', value: 'hello' },
      { name: 'rating', type: 'select', value: '2' },
    ]);
  });

  it('a select with no selected option takes the first option value; a nameless textarea is skipped', () => {
    const forms = extractForms(
      `<form action="/x"><select name="s"><option value="a">A</option><option value="b">B</option></select>
      <textarea>no name</textarea></form>`,
      'https://example.com/'
    );
    assert.deepEqual(forms[0].inputs, [{ name: 's', type: 'select', value: 'a' }]);
  });
});

describe('extractSpaRoutes filters non-HTML assets (domRender.js)', () => {
  it('favicon.ico / styles.css / bundles never consume a DOM render slot', () => {
    const html = `<a href="/assets/public/favicon_js.ico">f</a>
      <link href="/styles.css" rel="stylesheet">
      <script src="/main.js"></script>
      <a href="/logo.png">p</a>
      <a href="#/login">login</a><a href="/about">about</a>`;
    assert.deepEqual(extractSpaRoutes(html, 'http://172.17.0.1:3000/'), [
      'http://172.17.0.1:3000/#/login',
      // /about is an app route, so it hash-maps like /login — only the
      // asset paths are dropped, never the routes themselves.
      'http://172.17.0.1:3000/#/about',
    ]);
  });
});

describe('battery probes report their attempted points', () => {
  it('sqli-error notes the first 10 params of 12 (per-target cap, not a silent skip)', async () => {
    const diag = {};
    globalThis.fetch = inertFetch;
    try {
      const params = Array.from({ length: 12 }, (_, i) => `p${i}`);
      await probeSqliError('http://lab.local/search', params, { diagnostics: diag });
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.deepEqual(diag.pointsAttempted, Array.from({ length: 10 }, (_, i) => `p${i}`));
    const extras = buildCoverageExtras(diag, Array.from({ length: 12 }, (_, i) => `p${i}`));
    assert.equal(extras.coverage.pointsOffered, 12);
    assert.equal(extras.coverage.pointsAttempted, 10);
    assert.deepEqual(extras.coverage.skippedPoints, ['p10', 'p11']);
  });

  it('rfi with no include-smell params reports attempted [] (deliberate, not unreported)', async () => {
    const diag = {};
    await probeRfi('http://lab.local/login.php', ['username', 'password'], { diagnostics: diag });
    assert.deepEqual(diag.pointsAttempted, []);
    const extras = buildCoverageExtras(diag, ['username', 'password']);
    assert.equal(extras.coverage.pointsAttempted, 0);
    assert.deepEqual(extras.coverage.skippedPoints, ['username', 'password']);
  });

  it('tabnabbing is a markup probe: attempted [] plus a coverageNote naming its real surface', async () => {
    const diag = {};
    globalThis.fetch = inertFetch;
    try {
      await probeTabnabbing('http://lab.local/page', { diagnostics: diag });
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.deepEqual(diag.pointsAttempted, []);
    assert.match(diag.coverageNote || '', /markup-only/);
  });

  it('csv-log unions both halves: the log half attempts the first 6 params even when no CSV export exists', async () => {
    const diag = {};
    globalThis.fetch = inertFetch;
    try {
      const params = Array.from({ length: 8 }, (_, i) => `f${i}`);
      await probeCsvLog('http://lab.local/export', params, { diagnostics: diag });
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.deepEqual(diag.pointsAttempted, ['f0', 'f1', 'f2', 'f3', 'f4', 'f5']);
  });
});
