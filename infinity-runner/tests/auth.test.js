/**
 * auth.test.js — sign-in / token storage (config dir redirected to a temp dir).
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-auth-test-'));
process.env.INFINITY_AI_CONFIG_DIR = tmpDir;

const { emailFromToken, signIn, signOut, loadAuth, configFile } = require('../main/auth.js');

function fakeJwt(email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64({ email })}.${b64({ sig: 1 })}`;
}

beforeEach(() => {
  try { fs.rmSync(configFile(), { force: true }); } catch { /* noop */ }
  delete process.env.POLLER_TOKEN;
});

test('emailFromToken() decodes the payload for display', () => {
  assert.equal(emailFromToken(fakeJwt('user@example.com')), 'user@example.com');
  assert.equal(emailFromToken('not-a-jwt'), null);
});

test('signIn() stores only the token (mode 600), never the password', async () => {
  const token = fakeJwt('bhavesh@example.com');
  const fetchImpl = async (url, opts) => {
    assert.match(url, /\/api\/v1\/auth\/login$/);
    const body = JSON.parse(opts.body);
    assert.equal(body.email, 'bhavesh@example.com');
    assert.equal(body.password, 's3cret');
    return { ok: true, json: async () => ({ token }) };
  };
  const account = await signIn('bhavesh@example.com', 's3cret', { fetchImpl, backendUrl: 'https://x.test' });
  assert.equal(account.email, 'bhavesh@example.com');
  const saved = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  assert.equal(saved.token, token);
  assert.ok(!JSON.stringify(saved).includes('s3cret'), 'password must never be stored');
  assert.equal(fs.statSync(configFile()).mode & 0o777, 0o600);
  assert.equal(loadAuth().email, 'bhavesh@example.com');
});

test('signIn() throws a user-safe error on bad credentials', async () => {
  const fetchImpl = async () => ({
    ok: false,
    json: async () => ({ error: { message: 'Invalid email or password.' } }),
  });
  await assert.rejects(() => signIn('a@b.c', 'wrong', { fetchImpl }), /Invalid email or password/);
  assert.ok(!fs.existsSync(configFile()), 'no config file on failed login');
});

test('signIn() throws a user-safe error when the backend is unreachable', async () => {
  const fetchImpl = async () => { throw new Error('ENOTFOUND'); };
  await assert.rejects(() => signIn('a@b.c', 'pw', { fetchImpl }), /Could not reach Dark Matter/);
});

test('signOut() removes the token but keeps other config', async () => {
  const token = fakeJwt('u@e.com');
  await signIn('u@e.com', 'pw', {
    fetchImpl: async () => ({ ok: true, json: async () => ({ token }) }),
    backendUrl: 'https://x.test',
  });
  assert.ok(loadAuth().token);
  signOut();
  const saved = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  assert.equal(saved.token, undefined);
  assert.equal(saved.backendUrl, 'https://x.test');
  assert.equal(loadAuth().token, '');
});
