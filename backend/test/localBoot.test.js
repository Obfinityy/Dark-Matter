/**
 * localBoot + permission-mode regression tests (n6b-shell).
 *
 * 1. CORS trusts any localhost origin — the vite dev server may land on any
 *    port (5173, 5174, …) when several instances run; a port drift must not
 *    break the frontend against the localhost backend.
 * 2. GET/PUT /users/me/permissions: default 'ask', valid updates persist,
 *    invalid values are rejected with 400.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabase } from '../src/models/database.js';

const database = new MemoryDatabase();
const { createApp } = await import('../src/app.js');
const app = await createApp({ database });
app.locals.services.subdomainService.start = async () => undefined;
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let cookie = '';

async function request(url, options = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
    ...(options.headers || {})
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

test('CORS preflight allows an arbitrary localhost port', async () => {
  const { response } = await request('/api/v1/auth/register', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5999',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5999');
});

test('CORS preflight rejects non-localhost origins', async () => {
  const { response } = await request('/api/v1/auth/register', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.notEqual(response.headers.get('access-control-allow-origin'), 'https://evil.example');
});

test('permission mode defaults to ask, updates persist, invalid rejected', async () => {
  const stamp = Date.now();
  const registered = await request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `perms${stamp}@example.com`,
      username: `perms${stamp}`,
      name: 'Perms',
      password: 'TestPass123!'
    })
  });
  assert.equal(registered.response.status, 201);

  const before = await request('/api/v1/users/me/permissions');
  assert.equal(before.response.status, 200);
  assert.equal(before.body.permissionMode, 'ask');

  const updated = await request('/api/v1/users/me/permissions', {
    method: 'PUT',
    body: JSON.stringify({ permissionMode: 'full' })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.permissionMode, 'full');

  const after = await request('/api/v1/users/me/permissions');
  assert.equal(after.body.permissionMode, 'full');

  const bad = await request('/api/v1/users/me/permissions', {
    method: 'PUT',
    body: JSON.stringify({ permissionMode: 'yolo' })
  });
  assert.equal(bad.response.status, 400);
  assert.equal(bad.body.error.code, 'INVALID_PERMISSION_MODE');
});
