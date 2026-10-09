import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTrackingParam,
  resolveDotSegments,
  canonicaliseUrl,
  dedupeFrontier,
  mergeFrontiers,
  frontierCanonicalisationReport,
} from './crawlFrontierDedup.js';

test('1000: canonicaliseUrl lowercases scheme and host', () => {
  const { canonical, ok } = canonicaliseUrl('HTTPS://EXAMPLE.COM/Path');
  assert.ok(ok);
  assert.equal(canonical, 'https://example.com/Path');
});

test('1000: canonicaliseUrl strips default ports only', () => {
  assert.equal(canonicaliseUrl('http://example.com:80/a').canonical, 'http://example.com/a');
  assert.equal(canonicaliseUrl('https://example.com:443/a').canonical, 'https://example.com/a');
  assert.equal(canonicaliseUrl('http://example.com:8080/a').canonical, 'http://example.com:8080/a');
  assert.equal(canonicaliseUrl('https://example.com:444/a').canonical, 'https://example.com:444/a');
});

test('1000: canonicaliseUrl removes fragments and empty queries', () => {
  assert.equal(canonicaliseUrl('https://example.com/a#section').canonical, 'https://example.com/a');
  assert.equal(canonicaliseUrl('https://example.com/a?').canonical, 'https://example.com/a');
});

test('1000: canonicaliseUrl strips tracking params and sorts the rest', () => {
  const { canonical } = canonicaliseUrl('https://example.com/shop?utm_source=google&gclid=abc&z=1&a=2&fbclid=xyz');
  assert.equal(canonical, 'https://example.com/shop?a=2&z=1');
});

test('1000: canonicaliseUrl keeps non-tracking params like utm-like custom names intact when not trackers', () => {
  const { canonical } = canonicaliseUrl('https://example.com/?q=hello&page=2');
  assert.equal(canonical, 'https://example.com/?page=2&q=hello');
});

test('1000: isTrackingParam recognises trackers and spares legit params', () => {
  assert.ok(isTrackingParam('utm_source'));
  assert.ok(isTrackingParam('UTM_MEDIUM'));
  assert.ok(isTrackingParam('gclid'));
  assert.ok(isTrackingParam('fbclid'));
  assert.ok(!isTrackingParam('q'));
  assert.ok(!isTrackingParam('page'));
  assert.ok(!isTrackingParam('product_id'));
});

test('1000: canonicaliseUrl resolves dot segments and collapses slashes', () => {
  assert.equal(canonicaliseUrl('https://example.com/a/b/../c').canonical, 'https://example.com/a/c');
  assert.equal(canonicaliseUrl('https://example.com/a/./c').canonical, 'https://example.com/a/c');
  assert.equal(canonicaliseUrl('https://example.com//a///c').canonical, 'https://example.com/a/c');
  assert.equal(canonicaliseUrl('https://example.com/../../a').canonical, 'https://example.com/a');
});

test('1000: resolveDotSegments handles edge cases', () => {
  assert.equal(resolveDotSegments('/a/b/c'), '/a/b/c');
  assert.equal(resolveDotSegments('/a/./b'), '/a/b');
  assert.equal(resolveDotSegments('/a/../b'), '/b');
  assert.equal(resolveDotSegments('/../..'), '/');
  assert.equal(resolveDotSegments(''), '/');
});

test('1000: canonicaliseUrl decodes unreserved percent-encodings', () => {
  assert.equal(canonicaliseUrl('https://example.com/%7Euser').canonical, 'https://example.com/~user');
  assert.equal(canonicaliseUrl('https://example.com/a%2Fb').canonical, 'https://example.com/a%2Fb');
});

test('1000: canonicaliseUrl normalises trailing slash on non-root paths', () => {
  assert.equal(canonicaliseUrl('https://example.com/docs/').canonical, 'https://example.com/docs');
  assert.equal(canonicaliseUrl('https://example.com/').canonical, 'https://example.com/');
});

test('1000: canonicaliseUrl rejects non-http schemes and empty input', () => {
  assert.ok(!canonicaliseUrl('javascript:alert(1)').ok);
  assert.ok(!canonicaliseUrl('mailto:a@b.com').ok);
  assert.ok(!canonicaliseUrl('data:text/plain,hi').ok);
  assert.ok(!canonicaliseUrl('').ok);
  assert.ok(!canonicaliseUrl('not a url').ok);
});

test('1000: canonicaliseUrl resolves relative URLs against a base', () => {
  const { canonical } = canonicaliseUrl('/docs/../pricing?utm_source=x', { base: 'https://example.com/shop/' });
  assert.equal(canonical, 'https://example.com/pricing');
});

test('1000: dedupeFrontier collapses duplicates across every canonical rule', () => {
  const frontier = [
    'https://example.com/shop/',
    'HTTPS://EXAMPLE.COM/shop',
    'https://example.com:443/shop?utm_source=google',
    'https://example.com/shop#reviews',
    'https://example.com//shop',
    'https://example.com/a/../shop',
    'https://example.com/blog?page=2&q=x',
    'https://example.com/blog?q=x&page=2',
    'https://example.com/blog?utm_medium=email&q=x&page=2',
  ];
  const { unique, duplicates, stats } = dedupeFrontier(frontier);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 7);
  assert.equal(stats.input, 9);
  assert.equal(stats.unique, 2);
  assert.equal(stats.duplicateCount, 7);
  assert.equal(stats.reductionPct, 77.8);
  assert.ok(duplicates.every(d => d.canonical === 'https://example.com/shop' || d.canonical === 'https://example.com/blog?page=2&q=x'));
  assert.ok(duplicates.every(d => d.duplicateOf === 'https://example.com/shop/' || d.duplicateOf === 'https://example.com/blog?page=2&q=x'));
});

test('1000: dedupeFrontier keeps genuinely distinct URLs', () => {
  const { unique, duplicates } = dedupeFrontier([
    'https://example.com/a?id=1',
    'https://example.com/a?id=2',
    'https://example.com/b?id=1',
  ]);
  assert.equal(unique.length, 3);
  assert.equal(duplicates.length, 0);
});

test('1000: dedupeFrontier skips unusable inputs', () => {
  const { unique, skipped, stats } = dedupeFrontier(['https://example.com/ok', 'javascript:alert(1)', '']);
  assert.equal(unique.length, 1);
  assert.equal(skipped.length, 2);
  assert.ok(skipped.some(s => s.reason === 'non-http-scheme'));
  assert.equal(stats.skipped, 2);
});

test('1000: dedupeFrontier resolves relative URLs against base', () => {
  const { unique } = dedupeFrontier(
    ['https://example.com/pricing', '/pricing'],
    { base: 'https://example.com/shop/' }
  );
  assert.equal(unique.length, 1);
});

test('1000: dedupeFrontier treats differently-ordered duplicate query keys as identical', () => {
  const { unique } = dedupeFrontier(['https://example.com/?b=2&a=1', 'https://example.com/?a=1&b=2']);
  assert.equal(unique.length, 1);
});

test('1000: dedupeFrontier does not collapse port-distinct URLs', () => {
  const { unique } = dedupeFrontier(['http://example.com:8080/a', 'http://example.com/a']);
  assert.equal(unique.length, 2);
});

test('1000: mergeFrontiers merges and dedupes several lists', () => {
  const { unique, stats } = mergeFrontiers([
    ['https://example.com/a', 'https://example.com/b'],
    ['https://example.com/b?utm_source=x', 'https://example.com/c'],
  ]);
  assert.equal(unique.length, 3);
  assert.equal(stats.input, 4);
});

test('1000: frontierCanonicalisationReport counts affected rules', () => {
  const report = frontierCanonicalisationReport([
    'HTTPS://EXAMPLE.COM/a',
    'https://example.com:443/b',
    'https://example.com/c#frag',
    'https://example.com/d?utm_source=x&b=2',
    'https://example.com/e?z=1&a=2',
    'https://example.com/f/',
    'https://example.com/g/../h',
    'https://example.com/%7ei',
  ]);
  assert.equal(report.schemeOrHostCase, 1);
  assert.equal(report.defaultPortStripped, 1);
  assert.equal(report.fragmentRemoved, 1);
  assert.equal(report.trackingParamsRemoved, 1);
  assert.equal(report.querySorted, 2);
  assert.equal(report.trailingSlashNormalised, 1);
  assert.equal(report.dotSegmentsResolved, 1);
  assert.equal(report.percentDecoded, 1);
});
