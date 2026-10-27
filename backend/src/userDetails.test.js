// Dynamic details request (27 Oct 2026, owner order) — user-provided details vault.
//
// The agent asks the owner for details (a login, an OTP, any field) instead
// of creating its own account. The owner fills them in on the frontend card.
// SECURITY INVARIANTS asserted here:
//   - Values NEVER appear in any public form, list, or screen line except
//     the one-turn brain screen line (which rides in-memory only).
//   - The vault file is 0600.
//   - One pending request per hunt at a time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE the store (via config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-user-details-'));
process.env.DATA_DIR = tmpRoot;

const {
  createDetailRequest,
  submitDetailRequest,
  cancelDetailRequest,
  getPendingRequests,
  listDetailRequests,
  getFilledValues,
  detailValuesForScrub,
  detailsRequestScreenLines,
  userDetailsFile,
} = await import('./userDetails.js');

const HUNT = 'h_test_details1';
const FIELDS = [
  { key: 'email', label: 'Login email', type: 'email', required: true },
  { key: 'password', label: 'Password', type: 'password', required: true },
];

test('createDetailRequest: a valid request is pending and its public form has no values', () => {
  const { ok, request } = createDetailRequest({ huntId: HUNT, title: 'Login for kSuite', fields: FIELDS, site: 'https://ksuite.infomaniak.com' });
  assert.equal(ok, true);
  assert.equal(request.status, 'pending');
  assert.equal(request.title, 'Login for kSuite');
  assert.deepEqual(request.fields, FIELDS);
  assert.equal('values' in request, false);
  assert.equal(request.id.startsWith('udet:'), true);
});

test('createDetailRequest: a second pending request for the same hunt is refused', () => {
  const second = createDetailRequest({ huntId: HUNT, title: 'Another login', fields: FIELDS });
  assert.equal(second.ok, false);
  assert.match(second.error, /already pending/);
});

test('createDetailRequest: invalid fields are refused', () => {
  const hunt = 'h_test_details_bad';
  assert.equal(createDetailRequest({ huntId: hunt, title: 'x', fields: [] }).ok, false);
  assert.equal(createDetailRequest({ huntId: hunt, title: 'x', fields: [{ key: 'Bad Key', label: 'x', type: 'text' }] }).ok, false);
  assert.equal(createDetailRequest({ huntId: hunt, title: 'x', fields: [{ key: 'a', label: 'x', type: 'secret' }] }).ok, false);
  assert.equal(createDetailRequest({ huntId: hunt, title: 'x', fields: [{ key: 'a', label: 'x', type: 'text' }, { key: 'a', label: 'y', type: 'text' }] }).ok, false);
  assert.equal(createDetailRequest({ huntId: hunt, title: 'x', fields: Array.from({ length: 7 }, (_, i) => ({ key: `f${i}`, label: 'x', type: 'text' })) }).ok, false);
  assert.equal(createDetailRequest({ huntId: hunt, title: '', fields: FIELDS }).ok, false);
});

test('submitDetailRequest: a missing required field is refused; a full submit fills it and values stay server-side only', () => {
  const missing = submitDetailRequest(getPendingRequests(HUNT)[0].id, { email: 'owner@example.com' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /Password/);
  const filled = submitDetailRequest(getPendingRequests(HUNT)[0].id, { email: 'owner@example.com', password: 's3cret-pass' });
  assert.equal(filled.ok, true);
  assert.equal(filled.request.status, 'filled');
  assert.equal('values' in filled.request, false);
  // Server-side only: values retrievable via the internal getter.
  assert.deepEqual(getFilledValues(filled.request.id), { email: 'owner@example.com', password: 's3cret-pass' });
  // And the public list never carries them.
  for (const r of listDetailRequests(HUNT)) assert.equal('values' in r, false);
  // A second submit is refused.
  assert.equal(submitDetailRequest(filled.request.id, { email: 'x', password: 'y' }).ok, false);
});

test('detailsRequestScreenLines: a filled request shows its values exactly once, then is used', () => {
  const secrets = new Set();
  const lines1 = detailsRequestScreenLines(HUNT, secrets);
  const joined1 = lines1.join('\n');
  assert.match(joined1, /DETAILS RECEIVED/);
  assert.match(joined1, /s3cret-pass/);
  assert.equal(secrets.has('s3cret-pass'), true);
  assert.equal(secrets.has('owner@example.com'), true);
  // Second call: the request is used — no values line anymore.
  const lines2 = detailsRequestScreenLines(HUNT, new Set());
  assert.doesNotMatch(lines2.join('\n'), /s3cret-pass/);
  assert.doesNotMatch(lines2.join('\n'), /DETAILS RECEIVED/);
});

test('detailsRequestScreenLines: a pending request says WAIT and never shows values', () => {
  const hunt = 'h_test_details_wait';
  createDetailRequest({ huntId: hunt, title: 'OTP for login', fields: [{ key: 'otp', label: 'Code', type: 'otp' }] });
  const lines = detailsRequestScreenLines(hunt, new Set());
  assert.match(lines.join('\n'), /WAITING FOR THE OWNER/);
  assert.match(lines.join('\n'), /OTP for login/);
});

test('cancelDetailRequest: a pending request can be declined, and the screen says so once', () => {
  const hunt = 'h_test_details_cancel';
  const { request } = createDetailRequest({ huntId: hunt, title: 'API key', fields: [{ key: 'key', label: 'Key', type: 'password' }] });
  const cancelled = cancelDetailRequest(request.id);
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.request.status, 'cancelled');
  assert.equal(cancelDetailRequest(request.id).ok, false);
  const lines = detailsRequestScreenLines(hunt, new Set());
  assert.match(lines.join('\n'), /DECLINED/);
  assert.match(lines.join('\n'), /API key/);
});

test('detailValuesForScrub: filled values join the scrub list', () => {
  assert.deepEqual(detailValuesForScrub(HUNT).sort(), ['owner@example.com', 's3cret-pass']);
  assert.deepEqual(detailValuesForScrub('h_test_details_wait'), []);
});

test('vault file: user-details.json is written 0600', () => {
  const mode = fs.statSync(userDetailsFile()).mode & 0o777;
  assert.equal(mode, 0o600);
});
