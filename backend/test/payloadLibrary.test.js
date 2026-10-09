/**
 * Payload Library tests.
 *
 * Covers the PayloadLibraryService dataset layer: category listing, paged
 * payload reads, full-text search, random picks, stats, and the hunt-flow
 * payloadsFor() adapter. Uses the real shipped datasets (read-only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PayloadLibraryService, normalizeSlug } from '../src/services/payloadLibraryService.js';

const service = new PayloadLibraryService({ logger: { warn() {}, log() {}, error() {} } });

test('normalizeSlug: trims, lowercases and hyphenates', () => {
  assert.equal(normalizeSlug(' XSS Injection '), 'xss-injection');
  assert.equal(normalizeSlug('SQL_Injection'), 'sql-injection');
  assert.equal(normalizeSlug(''), '');
});

test('listCategories: returns 22 datasets with counts', async () => {
  const categories = await service.listCategories();
  assert.equal(categories.length, 22);
  const slugs = categories.map(c => c.slug);
  for (const expected of ['xss', 'sqli', 'ssrf', 'xxe', 'command-injection', 'file-inclusion']) {
    assert.ok(slugs.includes(expected), `missing category ${expected}`);
  }
  for (const c of categories) {
    assert.ok(c.count > 0, `${c.slug} should have payloads`);
    assert.ok(c.name && c.name.length > 0, `${c.slug} should have a name`);
  }
});

test('getPayloads: paginates and validates item shape', async () => {
  const page1 = await service.getPayloads('xss', { limit: 5, offset: 0 });
  assert.equal(page1.category, 'xss');
  assert.ok(page1.total > 0);
  assert.equal(page1.payloads.length, 5);

  const page2 = await service.getPayloads('xss', { limit: 5, offset: 5 });
  assert.notDeepEqual(
    page1.payloads.map(p => p.id),
    page2.payloads.map(p => p.id)
  );

  for (const item of page1.payloads) {
    assert.ok(item.id && item.payload && item.title, 'item shape');
  }
});

test('getPayloads: clamps limit and handles unknown category', async () => {
  const huge = await service.getPayloads('sqli', { limit: 99999 });
  assert.ok(huge.limit <= 500);
  const unknown = await service.getPayloads('no-such-category');
  assert.equal(unknown.total, 0);
  assert.deepEqual(unknown.payloads, []);
});

test('searchPayloads: finds payloads across datasets', async () => {
  const { results, total } = await service.searchPayloads('script', { limit: 10 });
  assert.ok(total > 0);
  assert.ok(results.length > 0 && results.length <= 10);
  for (const r of results) {
    const haystack = `${r.title} ${r.payload} ${r.context}`.toLowerCase();
    assert.ok(haystack.includes('script'));
    assert.ok(r.category, 'result carries its category');
  }
});

test('searchPayloads: empty query returns nothing', async () => {
  const { results, total } = await service.searchPayloads('   ');
  assert.equal(total, 0);
  assert.deepEqual(results, []);
});

test('randomPayload: returns an item from the category', async () => {
  const pick = await service.randomPayload('xxe');
  assert.ok(pick && pick.payload);
  assert.equal(pick.category, 'xxe');
  const missing = await service.randomPayload('no-such-category');
  assert.equal(missing, null);
});

test('getStats: totals match the sum of categories', async () => {
  const stats = await service.getStats();
  assert.equal(stats.categories, 22);
  const sum = stats.byCategory.reduce((n, c) => n + c.count, 0);
  assert.equal(stats.totalPayloads, sum);
  assert.ok(stats.totalPayloads > 1000, 'dataset should be substantial');
});

test('payloadsFor: hunt-flow adapter returns bounded lists', async () => {
  const payloads = await service.payloadsFor('sqli', { limit: 3 });
  assert.equal(payloads.length, 3);
  assert.ok(payloads.every(p => p.payload));
  const unknown = await service.payloadsFor('no-such-category');
  assert.deepEqual(unknown, []);
});

test('listCategories: is cached (same reference on repeat calls)', async () => {
  const a = await service.listCategories();
  const b = await service.listCategories();
  assert.equal(a, b);
});
