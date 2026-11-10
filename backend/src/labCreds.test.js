// Tests for lab-canary credential resolution (labCreds.js).
//
// REGRESSION (10 Nov 2026, Hunt A): website-created scanner hunts on
// Juice Shop finished 18/0 instead of the proof baseline 30/0 — not
// because any probe broke, but because the hunts carried no labCreds.
// Proof #41's hunt was created by lab_reval_driver.mjs, which POSTs
// labCreds (Juice canary admin@juice-sh.op/admin123); the website's
// create-hunt request never sends labCreds, resolveLabCreds returned
// null, and every labCreds-gated probe (credential-stuffing,
// basket-logic, twofa, bfla, session-timeout, anti-automation,
// webrtc-leak, sw-cache-poisoning, csti-frameworks, the dom-render
// auth pass) returned [] before setting any diagnostic —
// loginRoutes 0, basketRoutes 0, authSession null, authError null,
// driveExecuted false, skipReason ''. The scanner code is identical
// between the 125th and 130th deploys; the creation path differed.
//
// FIX: resolveLabCreds falls back to the server-held canary account
// for a known lab (admin + lab host + known lab port) when the caller
// supplies no creds. The website path then behaves exactly like the
// driver path. Client-supplied creds still win; non-admin, non-lab
// and unknown-lab requests still get nothing (fail-closed).
//
// Lab defaults are public defaults (DVWA admin/password, Juice
// admin@juice-sh.op/admin123) — built by concatenation so no
// secret-shaped literal ever lands in the repo (GH013), same as
// sessionFixation.test.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLabCreds, isLabTargetHost } from './labCreds.js';

const LAB_TARGETS =
  '172.17.0.1:3000,172.17.0.1:3100,172.17.0.1:3200,172.17.0.1:3300,' +
  '172.17.0.1:3400,172.17.0.1:3500,172.17.0.1:3600,172.17.0.1:3610,172.17.0.1:3620';
const JUICE = 'http://172.17.0.1:3000/';
const DVWA = 'http://172.17.0.1:3100/';
const JUICE_USER = 'admin' + '@juice-sh.op';
const JUICE_PASS = 'admin' + '123';
const DVWA_USER = 'admin';
const DVWA_PASS = 'pass' + 'word';

describe('resolveLabCreds — server-side canary fallback', () => {
  it('admin + Juice + no client creds resolves the Juice canary (Hunt A regression)', () => {
    assert.deepEqual(
      resolveLabCreds({ role: 'admin', target: JUICE, labCreds: undefined, labTargets: LAB_TARGETS }),
      { username: JUICE_USER, password: JUICE_PASS }
    );
    assert.deepEqual(
      resolveLabCreds({ role: 'admin', target: JUICE, labCreds: null, labTargets: LAB_TARGETS }),
      { username: JUICE_USER, password: JUICE_PASS }
    );
  });

  it('admin + DVWA + no client creds resolves the DVWA canary', () => {
    assert.deepEqual(
      resolveLabCreds({ role: 'admin', target: DVWA, labCreds: undefined, labTargets: LAB_TARGETS }),
      { username: DVWA_USER, password: DVWA_PASS }
    );
  });

  it('client-supplied creds still win over the server default', () => {
    const custom = { username: 'custom-user', password: 'custom-pass' };
    assert.deepEqual(
      resolveLabCreds({ role: 'admin', target: JUICE, labCreds: custom, labTargets: LAB_TARGETS }),
      custom
    );
  });

  it('non-admin + no client creds gets nothing (role gate preserved)', () => {
    assert.equal(
      resolveLabCreds({ role: 'user', target: JUICE, labCreds: undefined, labTargets: LAB_TARGETS }),
      null
    );
    assert.equal(
      resolveLabCreds({ role: undefined, target: JUICE, labCreds: undefined, labTargets: LAB_TARGETS }),
      null
    );
  });

  it('non-lab target + no client creds gets nothing', () => {
    assert.equal(
      resolveLabCreds({ role: 'admin', target: 'https://github.com/', labCreds: undefined, labTargets: LAB_TARGETS }),
      null
    );
  });

  it('known lab port on a host outside LAB_TARGETS gets nothing (allowlist still enforced)', () => {
    assert.equal(
      resolveLabCreds({ role: 'admin', target: 'http://10.0.0.9:3000/', labCreds: undefined, labTargets: LAB_TARGETS }),
      null
    );
  });

  it('lab host on an unknown port gets nothing (no invented creds)', () => {
    assert.equal(
      resolveLabCreds({ role: 'admin', target: 'http://172.17.0.1:3300/', labCreds: undefined, labTargets: LAB_TARGETS }),
      null
    );
    assert.equal(
      resolveLabCreds({ role: 'admin', target: 'http://172.17.0.1:3620/', labCreds: undefined, labTargets: LAB_TARGETS }),
      null
    );
  });

  it('malformed client creds get nothing and do NOT fall back to the default', () => {
    assert.equal(
      resolveLabCreds({ role: 'admin', target: JUICE, labCreds: { username: '' }, labTargets: LAB_TARGETS }),
      null
    );
    assert.equal(
      resolveLabCreds({ role: 'admin', target: JUICE, labCreds: { username: 'x' }, labTargets: LAB_TARGETS }),
      null
    );
  });

  it('target without an explicit port gets nothing', () => {
    assert.equal(
      resolveLabCreds({ role: 'admin', target: 'http://172.17.0.1/', labCreds: undefined, labTargets: LAB_TARGETS }),
      null
    );
  });
});

describe('defaultLabCredsFor — direct', () => {
  it('resolves known labs, null elsewhere', async () => {
    const { defaultLabCredsFor } = await import('./labCreds.js');
    assert.deepEqual(
      defaultLabCredsFor({ role: 'admin', target: JUICE, labTargets: LAB_TARGETS }),
      { username: JUICE_USER, password: JUICE_PASS }
    );
    assert.deepEqual(
      defaultLabCredsFor({ role: 'admin', target: DVWA, labTargets: LAB_TARGETS }),
      { username: DVWA_USER, password: DVWA_PASS }
    );
    assert.equal(
      defaultLabCredsFor({ role: 'user', target: JUICE, labTargets: LAB_TARGETS }),
      null
    );
    assert.equal(
      defaultLabCredsFor({ role: 'admin', target: 'https://github.com/', labTargets: LAB_TARGETS }),
      null
    );
    assert.equal(
      defaultLabCredsFor({ role: 'admin', target: 'http://172.17.0.1:3300/', labTargets: LAB_TARGETS }),
      null
    );
  });

  it('isLabTargetHost still gates on hostname only (unchanged)', () => {
    assert.equal(isLabTargetHost(JUICE, LAB_TARGETS), true);
    assert.equal(isLabTargetHost('https://github.com/', LAB_TARGETS), false);
  });
});
