/**
 * Payload Library API E2E tests.
 *
 * Boots the full Express app (in-memory database), registers an account,
 * then exercises the /api/v1/payload-library dataset endpoints: categories,
 * search, per-category catalog, stats, and error cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { MemoryDatabase } from '../src/models/database.js';

const database = new MemoryDatabase();
const app = await createApp({ database });
app.locals.services.subdomainService.start = async () => undefined;
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
let cookie = '';

async function request(url, options = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await database.close();
});

test('payload-library endpoints require authentication', async () => {
  const res = await request('/api/v1/payload-library/categories');
  assert.equal(res.response.status, 401);
});

test('categories: lists 22 datasets with counts', async () => {
  await request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Payload Tester', email: 'payloads@example.com', password: 'correct-horse-battery' }),
  });
  const res = await request('/api/v1/payload-library/categories');
  assert.equal(res.response.status, 200);
  assert.equal(res.body.categories.length, 22);
  const xss = res.body.categories.find(c => c.slug === 'xss');
  assert.ok(xss && xss.count > 0 && xss.name === 'XSS Injection');
});

test('catalog: paged payloads for a category', async () => {
  const res = await request('/api/v1/payload-library/sqli?limit=5&offset=0');
  assert.equal(res.response.status, 200);
  assert.equal(res.body.category, 'sqli');
  assert.ok(res.body.total > 0);
  assert.equal(res.body.payloads.length, 5);
  assert.ok(res.body.payloads[0].id && res.body.payloads[0].payload);
});

test('catalog: unknown category returns 404 with valid slugs', async () => {
  const res = await request('/api/v1/payload-library/nope');
  assert.equal(res.response.status, 404);
  assert.equal(res.body.error.code, 'UNKNOWN_CATEGORY');
  assert.ok(Array.isArray(res.body.categories) && res.body.categories.includes('xss'));
});

test('search: finds payloads across the library', async () => {
  const res = await request('/api/v1/payload-library/search?q=%3Cscript%3E&limit=5');
  assert.equal(res.response.status, 200);
  assert.ok(res.body.total > 0);
  assert.ok(res.body.results.length > 0);
  assert.ok(res.body.results.every(r => r.category));
});

test('search: missing q returns 400', async () => {
  const res = await request('/api/v1/payload-library/search');
  assert.equal(res.response.status, 400);
  assert.equal(res.body.error.code, 'QUERY_REQUIRED');
});

test('stats: includes the dataset library stats', async () => {
  const res = await request('/api/v1/payload-library/stats');
  assert.equal(res.response.status, 200);
  assert.ok(res.body.library, 'library stats present');
  assert.equal(res.body.library.categories, 22);
  assert.ok(res.body.library.totalPayloads > 1000);
  assert.ok(res.body.stats, 'learning stats still present');
});
