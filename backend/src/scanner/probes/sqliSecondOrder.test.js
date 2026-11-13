// Second-order SQL injection probe tests (14 Nov 2026, coverage row #208 [High]).
//
// The scanner had NO second-order concept anywhere (batch 3 re-proof:
// a case-insensitive grep for second-order|secondOrder across the whole
// scanner source returns nothing; sqliError / sqliBlind / sqliOob are all
// first-order — they inject and read the IMMEDIATE response). This probe
// is the two-step leg the fix plan specifies:
//
//   Step 0 (baseline): GET the trigger page — it must NOT already carry
//     a DB error (else the oracle is void).
//   Step 1 (benign control): store a benign value via the form, re-GET
//     the trigger page — it must stay clean (else storing anything
//     breaks the page and the oracle is void).
//   Step 2 (store): submit a canary SQLi payload (unbalanced quote)
//     into a text input — the value is STORED server-side.
//   Step 3 (trigger): re-GET the trigger page. If a genuine DB error
//     signature now appears — present on the malicious-stored value,
//     absent on the benign-stored value — the stored value was executed
//     in a later query: second-order SQLi, confirmed.
//
// Lab-gated like the rest of the SQLi family: the store step WRITES to
// the target, so the probe returns [] without a single request on a
// non-lab host (isLabTargetHost, labCreds.js — same gate as sqliOob).
// One confirmed finding per form: a confirmed malicious store poisons
// the trigger page for every later input in the same form, so later
// inputs could not be attributed honestly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeSqliSecondOrder } from './sqliSecondOrder.js';

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

const LAB_HOST = '172.17.0.1';
const LAB_URL = `http://${LAB_HOST}:3100/profile.php`;
const LAB_ROOT = `http://${LAB_HOST}:3100/`;
const NONLAB_URL = 'https://example.com/profile.php';
const MYSQL_ERROR =
  "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1";
const PG_ERROR =
  'Warning: pg_query(): Query failed: ERROR: syntax error at or near "\'" at character 8';
const SQLITE_ERROR = 'Error: SQLITE_ERROR: near "\'": syntax error';
const NORMAL_PAGE = '<html><body><h1>Profile</h1><p>Your profile.</p></body></html>';
const SAVED_PAGE = '<html><body><h1>Profile updated</h1></body></html>';

function profileForm(method = 'post', inputs) {
  return {
    action: LAB_URL,
    method,
    inputs: inputs || [
      { name: 'username', type: 'text', value: '' },
      { name: 'bio', type: 'text', value: '' },
      { name: 'Update', type: 'submit', value: 'Update' },
    ],
  };
}

// Mock lab app: an in-memory store keyed by input name. A stored value
// carrying an unbalanced quote breaks the app's later query, so the
// trigger page (the form action + the site root) comes back with a DB
// error; benign stored values render cleanly. Modes:
//   vulnerable-mysql / -sqlite / -pg: the trigger page errors (with that
//     dialect's signature) once a quoted value is stored.
//   clean: the trigger page never errors — no second-order SQLi.
//   benign-errors: the trigger page errors once ANYTHING is stored, even
//     benign — the oracle is void, never a finding.
//   baseline-errors: the trigger page errors before anything is stored —
//     the oracle is void, never a finding.
function makeLabFetch(mode) {
  const stored = {};
  let calls = 0;
  const errorFor = () =>
    mode === 'vulnerable-sqlite' ? SQLITE_ERROR : mode === 'vulnerable-pg' ? PG_ERROR : MYSQL_ERROR;
  const triggerBody = () => {
    if (mode === 'baseline-errors') return `<html><body>${errorFor()}</body></html>`;
    const values = Object.values(stored);
    if (values.length === 0) return NORMAL_PAGE;
    if (mode === 'benign-errors') return `<html><body>${errorFor()}</body></html>`;
    if (mode.startsWith('vulnerable-') && values.some((v) => String(v).includes("'"))) {
      return `<html><body>${errorFor()}</body></html>`;
    }
    return NORMAL_PAGE;
  };
  const fetchMock = async (url, options = {}) => {
    calls += 1;
    const u = new URL(String(url));
    const isStore =
      options.method === 'POST' || u.searchParams.toString().length > 0;
    if (isStore && (u.href.startsWith(LAB_URL) || u.href === LAB_URL)) {
      const params =
        options.method === 'POST'
          ? new URLSearchParams(String(options.body || ''))
          : u.searchParams;
      for (const [k, v] of params.entries()) {
        if (k !== 'Submit') stored[k] = v;
      }
      return { status: 200, text: async () => SAVED_PAGE };
    }
    return { status: 200, text: async () => triggerBody() };
  };
  fetchMock.calls = () => calls;
  fetchMock.stored = () => ({ ...stored });
  return fetchMock;
}

test('SO-1: non-lab target — lab gate returns [] and sends nothing', async () => {
  const fetchMock = makeLabFetch('vulnerable-mysql');
  globalThis.fetch = fetchMock;
  const findings = await probeSqliSecondOrder(
    [profileForm()],
    NONLAB_URL,
    { labTargets: LAB_HOST }
  );
  assert.equal(findings.length, 0);
  assert.equal(fetchMock.calls(), 0, 'a non-lab target must never receive a store request');
});

test('SO-2: lab target, no forms — no finding, no requests', async () => {
  const fetchMock = makeLabFetch('vulnerable-mysql');
  globalThis.fetch = fetchMock;
  const findings = await probeSqliSecondOrder([], LAB_URL, { labTargets: LAB_HOST });
  assert.equal(findings.length, 0);
  assert.equal(fetchMock.calls(), 0);
});

test('SO-3: stored quote triggers a MySQL error on the second request — one high finding', async () => {
  globalThis.fetch = makeLabFetch('vulnerable-mysql');
  const findings = await probeSqliSecondOrder([profileForm()], LAB_URL, { labTargets: LAB_HOST });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'sqli_second_order');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].dbFamily, 'mysql');
  assert.equal(findings[0].param, 'username');
  assert.equal(findings[0].evidence.errorCorrelated, true);
  assert.equal(findings[0].evidence.diverged, true);
  assert.match(findings[0].title, /Second-order SQL injection/);
});

test('SO-4: clean lab app — stored quote never errors, no finding', async () => {
  globalThis.fetch = makeLabFetch('clean');
  const findings = await probeSqliSecondOrder([profileForm()], LAB_URL, { labTargets: LAB_HOST });
  assert.equal(findings.length, 0);
});

test('SO-5: trigger page errors on the benign stored value too — oracle void, no finding', async () => {
  globalThis.fetch = makeLabFetch('benign-errors');
  const findings = await probeSqliSecondOrder([profileForm()], LAB_URL, { labTargets: LAB_HOST });
  assert.equal(findings.length, 0, 'the differential control must stay intact');
});

test('SO-6: trigger page already errors at baseline — oracle void, no finding', async () => {
  globalThis.fetch = makeLabFetch('baseline-errors');
  const findings = await probeSqliSecondOrder([profileForm()], LAB_URL, { labTargets: LAB_HOST });
  assert.equal(findings.length, 0, 'a pre-existing error is not a second-order finding');
});

test('SO-7: SQLite and Postgres error signatures confirm with the right family', async () => {
  globalThis.fetch = makeLabFetch('vulnerable-sqlite');
  const lite = await probeSqliSecondOrder([profileForm()], LAB_URL, { labTargets: LAB_HOST });
  assert.equal(lite.length, 1);
  assert.equal(lite[0].dbFamily, 'sqlite');
  globalThis.fetch = makeLabFetch('vulnerable-pg');
  const pg = await probeSqliSecondOrder([profileForm()], LAB_URL, { labTargets: LAB_HOST });
  assert.equal(pg.length, 1);
  assert.equal(pg[0].dbFamily, 'postgres');
});

test('SO-8: Postgres error on a WordPress stack — stack gate blocks it', async () => {
  globalThis.fetch = makeLabFetch('vulnerable-pg');
  const findings = await probeSqliSecondOrder([profileForm()], LAB_URL, {
    labTargets: LAB_HOST,
    tech: ['php', 'wordpress', 'cloudflare'],
  });
  assert.equal(findings.length, 0, 'postgres cannot run under WordPress/MySQL');
});

test('SO-9: MySQL error on a WordPress stack — stack gate allows it', async () => {
  globalThis.fetch = makeLabFetch('vulnerable-mysql');
  const findings = await probeSqliSecondOrder([profileForm()], LAB_URL, {
    labTargets: LAB_HOST,
    tech: ['php', 'wordpress', 'cloudflare'],
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].dbFamily, 'mysql');
});

test('SO-10: GET form stores via query string and still confirms', async () => {
  globalThis.fetch = makeLabFetch('vulnerable-mysql');
  const findings = await probeSqliSecondOrder([profileForm('get')], LAB_URL, {
    labTargets: LAB_HOST,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'sqli_second_order');
});

test('SO-11: two vulnerable inputs in one form — one finding (contamination rule)', async () => {
  globalThis.fetch = makeLabFetch('vulnerable-mysql');
  const findings = await probeSqliSecondOrder([profileForm()], LAB_URL, { labTargets: LAB_HOST });
  assert.equal(findings.length, 1, 'a confirmed store poisons the trigger page for later inputs');
});
