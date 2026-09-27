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

test('health is public but application tools require an account', async () => {
  const health = await request('/api/v1/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.framework, 'express');

  const tools = await request('/api/v1/tools');
  assert.equal(tools.response.status, 401);
  assert.equal(tools.body.error.code, 'AUTH_REQUIRED');
});

test('register and login create a database-backed cookie session', async () => {
  const registered = await request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Security Researcher', email: 'researcher@example.com', password: 'correct-horse-battery' })
  });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.body.user.email, 'researcher@example.com');
  assert.match(cookie, /^darkmatter_session=/);

  const me = await request('/api/v1/auth/me');
  assert.equal(me.response.status, 200);
  assert.equal(me.body.user.name, 'Security Researcher');

  const updated = await request('/api/v1/auth/me', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Elite Researcher' })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.user.name, 'Elite Researcher');
});

test('provider keys are encrypted and never returned', async () => {
  const saved = await request('/api/v1/settings/providers/openai', {
    method: 'PUT',
    body: JSON.stringify({ apiKey: 'sk-test-secret', enabled: true, priority: 1 })
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.hasApiKey, true);
  assert.equal(saved.body.apiKey, undefined);

  const provider = await database.collection('providers').findOne({ providerId: 'openai' });
  assert.equal(provider.apiKeyCiphertext.includes('sk-test-secret'), false);
});

test('agent requires authorization and accepts a domain without a scheme', async () => {
  const blocked = await request('/api/v1/agent/messages', {
    method: 'POST',
    body: JSON.stringify({ message: 'inspect example.com' })
  });
  assert.equal(blocked.response.status, 200);
  assert.equal(blocked.body.status, 'awaiting_authorization');

  const started = await request('/api/v1/agent/messages', {
    method: 'POST',
    body: JSON.stringify({ message: 'inspect example.com', authorizationConfirmed: true, mode: 'MEDIUM' })
  });
  assert.equal(started.response.status, 202);
  assert.equal(started.body.status, 'started');
  assert.equal(started.body.scan.toolId, 'subdomain-enumerator');

  const targets = await request('/api/v1/targets');
  assert.equal(targets.body.targets[0].url, 'https://example.com');
});

test('logout invalidates the session', async () => {
  const loggedOut = await request('/api/v1/auth/logout', { method: 'POST' });
  assert.equal(loggedOut.response.status, 204);
  const tools = await request('/api/v1/tools');
  assert.equal(tools.response.status, 401);
});
