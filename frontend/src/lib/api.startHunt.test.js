// startHunt payload tests (5 Nov 2026, Re-run brainMode fix).
//
// Regression: Re-run on an Autonomous hunt created an AI hunt. The
// backend honours the brainMode it is sent, so the contract pinned here
// is the request itself: startHunt posts brainMode + scanDepth +
// forceNew/fresh exactly as its arguments say, and maps the 201
// response through (brainMode/scanDepth/reused). The card-side drop
// (legacy restored cards) is covered in huntMode.test.js.
// Run with plain node --test; fetch + localStorage are stubbed here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Vite resolves extensionless relative imports ('../config'); Node ESM
// does not — register the local resolve hook before importing api.js.
register('./node-test-hooks.mjs', import.meta.url);

// localStorage is touched by getAuthToken() on every request.
globalThis.localStorage = {
  getItem: () => '',
  setItem: () => {},
  removeItem: () => {},
};

let lastCall = null;
const okJson = (body, status = 201) => ({
  ok: true,
  status,
  json: async () => body,
});
globalThis.fetch = async (url, init) => {
  lastCall = { url, method: init && init.method, body: init && init.body ? JSON.parse(init.body) : undefined };
  return okJson({ huntId: 'h_new', brainMode: lastCall.body.brainMode, scanDepth: lastCall.body.scanDepth, scanScope: lastCall.body.scanScope });
};

const { startHunt } = await import('./api.js');

test('Re-run payload: scanner + deep + forceNew reach the backend verbatim', async () => {
  const res = await startHunt('http://172.17.0.1:3100', 'lab', 'infinity', true, 'scanner', 'deep', 'site', true, false);
  assert.equal(lastCall.url, 'https://api.thebhavesh.online/api/v1/hunts');
  assert.equal(lastCall.method, 'POST');
  assert.equal(lastCall.body.target, 'http://172.17.0.1:3100');
  assert.equal(lastCall.body.mode, 'infinity');
  assert.equal(lastCall.body.confirmedAuthorized, true);
  assert.equal(lastCall.body.brainMode, 'scanner');
  assert.equal(lastCall.body.scanDepth, 'deep');
  assert.equal(lastCall.body.scanScope, 'site');
  assert.equal(lastCall.body.forceNew, true);
  assert.equal('fresh' in lastCall.body, false);
  assert.equal(res.ok, true);
  assert.equal(res.data.huntId, 'h_new');
  assert.equal(res.data.brainMode, 'scanner');
  assert.equal(res.data.scanDepth, 'deep');
  assert.equal(res.data.scanScope, 'site');
  assert.equal(res.data.reused, false);
});

test('defaults: no brainMode/scanDepth args -> ai + standard, no bypass flags', async () => {
  await startHunt('http://example.com/', '', 'infinity', true);
  assert.equal(lastCall.body.brainMode, 'ai');
  assert.equal(lastCall.body.scanDepth, 'standard');
  assert.equal(lastCall.body.scanScope, 'page');
  assert.equal('forceNew' in lastCall.body, false);
  assert.equal('fresh' in lastCall.body, false);
});

test('Start-from-scratch payload carries fresh, not forceNew', async () => {
  await startHunt('http://172.17.0.1:3100', '', 'infinity', true, 'scanner', 'standard', 'page', false, true);
  assert.equal(lastCall.body.brainMode, 'scanner');
  assert.equal(lastCall.body.scanScope, 'page');
  assert.equal(lastCall.body.fresh, true);
  assert.equal('forceNew' in lastCall.body, false);
});

test('a dedupe (reused) response passes through untouched', async () => {
  globalThis.fetch = async (url, init) => {
    lastCall = { url, method: init && init.method, body: JSON.parse(init.body) };
    return okJson({ huntId: 'h_old', reused: true, resumed: false, state: 'stopped', message: 'You already have a hunt for this target — opening it instead of creating a duplicate.' }, 200);
  };
  const res = await startHunt('http://172.17.0.1:3100', '', 'infinity', true, 'scanner', 'standard', 'page', false, false);
  assert.equal(res.ok, true);
  assert.equal(res.data.reused, true);
  assert.equal(res.data.huntId, 'h_old');
  assert.equal(res.data.state, 'stopped');
});

test('a failed create passes the error through', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ ok: false, error: 'authorization_not_confirmed', message: 'Hunt creation requires explicit authorization' }),
  });
  const res = await startHunt('http://172.17.0.1:3100', '', 'infinity', false, 'scanner', 'standard', 'page', true, false);
  assert.equal(res.ok, false);
  assert.equal(res.status, 403);
});
