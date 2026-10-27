// Self-auth chain (27 Oct 2026, owner order) — the agent tries to make the
// account ITSELF first (save_credential -> use_saved_credential ->
// fetch_verification_code) and only asks the owner (request_details) after
// that path fails. The server REFUSES a fresh ask until a self-auth attempt
// for the site exists in the hunt's events.
//
// Asserted here (pure helper):
//   - hasSelfAuthAttempt matches a self-auth tool_call whose recorded
//     detail (the credential handle cred:<host>:<hex>) names the site.
//   - It does NOT match other tools, other hosts, or an empty history.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSelfAuthAttempt } from './humanLoop.js';

const dvwa = 'http://172.17.0.1:3100/';
const ev = (tool, detail) => ({ type: 'tool_call', tool, detail });

test('hasSelfAuthAttempt matches a save for the same host', () => {
  const events = [ev('save_credential', 'cred:172.17.0.1:a1b2c3d4e5f6')];
  assert.equal(hasSelfAuthAttempt(events, dvwa), true);
});

test('hasSelfAuthAttempt matches use_saved_credential and fetch_verification_code', () => {
  assert.equal(hasSelfAuthAttempt([ev('use_saved_credential', 'cred:172.17.0.1:a1b2c3d4e5f6')], dvwa), true);
  assert.equal(hasSelfAuthAttempt([ev('fetch_verification_code', 'cred:172.17.0.1:a1b2c3d4e5f6')], dvwa), true);
});

test('hasSelfAuthAttempt does not match another host', () => {
  const events = [ev('save_credential', 'cred:ksuite.infomaniak.com:a1b2c3d4e5f6')];
  assert.equal(hasSelfAuthAttempt(events, dvwa), false);
});

test('hasSelfAuthAttempt does not match non-self-auth tools', () => {
  const events = [ev('browser_open', 'http://172.17.0.1:3100/')];
  assert.equal(hasSelfAuthAttempt(events, dvwa), false);
});

test('hasSelfAuthAttempt handles empty history and empty site', () => {
  assert.equal(hasSelfAuthAttempt([], dvwa), false);
  assert.equal(hasSelfAuthAttempt(null, dvwa), false);
  assert.equal(hasSelfAuthAttempt([ev('save_credential', 'cred:172.17.0.1:a1b2c3d4e5f6')], ''), false);
  assert.equal(hasSelfAuthAttempt([ev('save_credential', 'cred:172.17.0.1:a1b2c3d4e5f6')], null), false);
});

test('hasSelfAuthAttempt normalises a bare host and a full URL the same way', () => {
  const events = [ev('save_credential', 'cred:dvwa.example:a1b2c3d4e5f6')];
  assert.equal(hasSelfAuthAttempt(events, 'https://dvwa.example/login.php'), true);
  assert.equal(hasSelfAuthAttempt(events, 'dvwa.example'), true);
});
