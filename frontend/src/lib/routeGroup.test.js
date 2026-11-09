// Route grouping tests (9 Nov 2026, /* scope).
//
// Whole-site hunts group their findings under the route each was found
// on. A route is origin + pathname — query and fragment stripped — so
// /search?q=a and /search?q=b render under the same route. Findings
// without a URL group under the hunt target (the fallback).
// Run with plain node --test (no frontend runner exists in this repo).

import test from 'node:test';
import assert from 'node:assert/strict';
import { routeKeyForUrl, groupFindingsByRoute } from './routeGroup.js';

test('route key is origin + pathname: query and fragment stripped', () => {
  assert.equal(routeKeyForUrl('http://site.test/search?q=a#top'), 'http://site.test/search');
  assert.equal(routeKeyForUrl('http://site.test/api/Users'), 'http://site.test/api/Users');
  assert.equal(routeKeyForUrl('http://site.test/'), 'http://site.test/');
  assert.equal(routeKeyForUrl(null, 'http://site.test/'), 'http://site.test/');
  assert.equal(routeKeyForUrl('not a url', null), 'not a url');
});

test('groups findings by route in first-appearance order', () => {
  const groups = groupFindingsByRoute(
    [
      { title: 'SQLi in q', severity: 'high', url: 'http://site.test/search?q=1' },
      { title: 'XSS in q', severity: 'medium', url: 'http://site.test/search?q=2' },
      { title: 'BFLA on Users', severity: 'high', url: 'http://site.test/api/Users' },
      { title: 'Missing HSTS', severity: 'low', url: null },
    ],
    'http://site.test/'
  );
  assert.deepEqual(
    groups.map((g) => g.route),
    ['http://site.test/search', 'http://site.test/api/Users', 'http://site.test/']
  );
  assert.deepEqual(
    groups.map((g) => g.findings.map((f) => f.title)),
    [
      ['SQLi in q', 'XSS in q'],
      ['BFLA on Users'],
      ['Missing HSTS'],
    ]
  );
});

test('findings keep their full row (severity, detail) inside a group', () => {
  const groups = groupFindingsByRoute(
    [{ title: 'T', severity: 'high', verified: true, detail: 'd', url: 'http://site.test/a?x=1' }],
    'http://site.test/'
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].route, 'http://site.test/a');
  assert.deepEqual(groups[0].findings[0], {
    title: 'T',
    severity: 'high',
    verified: true,
    detail: 'd',
    url: 'http://site.test/a?x=1',
  });
});

test('empty or null input groups to nothing', () => {
  assert.deepEqual(groupFindingsByRoute([], 'http://site.test/'), []);
  assert.deepEqual(groupFindingsByRoute(null, 'http://site.test/'), []);
});
