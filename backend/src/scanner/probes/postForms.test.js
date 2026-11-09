// POST-form battery tests — Zerodha false-positive fix (9 Nov 2026).
//
// This is the variant that actually fired on hunt h_6b5942052353:
// a POST to zerodha.com/varsity/wp-comments-post.php with
// comment_post_ID=<payload> was confirmed as [Critical] error-based
// SQLi ("postgres") on a Cloudflare bot-management token. postForms
// shared the loose bare-word matcher (detectDbFamily) with the GET
// probe, so it gets the same strict fix: genuine DB error phrases
// only, plus the stack gate.
//
// Rule under test: same as sqliError — a genuine DB error phrase on
// the malicious POST, absent on the benign one, and an
// engine-specific signature contradicting the fingerprinted stack
// never confirms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probePostForms } from './postForms.js';

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

// The recorded Zerodha token (same fixture as sqliError.test.js),
// built by concatenation so no single literal is a long
// secret-shaped string. Contains the substring "psql".
const CLOUDFLARE_TOKEN =
  'pHdXIyO.44VVd9WN_JzDTU3tZ2zc424.6HcN.L_Ub1OKwrvzCFOP_3WhZl6' +
  'lpsqLYILtcHjBgCjFdcudBtjQflIzJs_kS94Ryf0HhzNxLbvwtSKyrfUzo2fHXsrDMiP4ayuLan2OFCOtPfCix6sr5uzacwsHOOeB';
const CLOUDFLARE_PAGE =
  '<html><head><title>Just a moment...</title></head><body>' +
  '<div id="cf-content">Checking your browser before accessing zerodha.com.</div>' +
  `<script>var cfToken="${CLOUDFLARE_TOKEN}";</script></body></html>`;
const NORMAL_PAGE = '<html><body><h1>Varsity</h1><p>Leave a comment.</p></body></html>';
const MYSQL_ERROR =
  "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1";
const PG_ERROR =
  'Warning: pg_query(): Query failed: ERROR: syntax error at or near "\'" at character 8';

const ACTION = 'https://zerodha.com/varsity/wp-comments-post.php';
const FORM = {
  method: 'POST',
  action: ACTION,
  inputs: [
    { name: 'comment_post_ID', type: 'hidden', value: '1' },
    { name: 'author', type: 'text', value: '' },
    { name: 'email', type: 'text', value: '' },
    { name: 'url', type: 'text', value: '' },
    { name: 'submit', type: 'submit', value: 'Post Comment' },
  ],
};

// Route by the posted comment_post_ID value: a quote in it means
// the malicious request, anything else is the benign control. All
// other checks (XSS canary, timing) see instant benign bodies.
function makeFetch({ benign, malicious }) {
  return async (url, init = {}) => {
    const params = new URLSearchParams(String(init.body || ''));
    const value = params.get('comment_post_ID') || '';
    const body = value.includes("'") ? malicious : benign;
    return { status: 200, text: async () => body };
  };
}

test('PF-1: Cloudflare token page on POST (Zerodha FP) — no finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: CLOUDFLARE_PAGE });
  const findings = await probePostForms([FORM], {});
  assert.equal(findings.length, 0, 'a bot token containing "psql" is not a DB error');
});

test('PF-2: same FP with the WordPress stack fingerprinted — no finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: CLOUDFLARE_PAGE });
  const findings = await probePostForms([FORM], { tech: ['php', 'wordpress', 'cloudflare'] });
  assert.equal(findings.length, 0);
});

test('PF-3: genuine MySQL error on POST (DVWA shape) — one critical finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: MYSQL_ERROR });
  const findings = await probePostForms([FORM], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'sqli_error');
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].dbFamily, 'mysql');
  assert.equal(findings[0].evidence.errorCorrelated, true);
});

test('PF-4: Postgres error on POST with a WordPress stack — stack gate blocks it', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: PG_ERROR });
  const findings = await probePostForms([FORM], { tech: ['php', 'wordpress', 'cloudflare'] });
  assert.equal(findings.length, 0);
});

test('PF-5: Postgres error on POST without stack info — one finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: PG_ERROR });
  const findings = await probePostForms([FORM], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].dbFamily, 'postgres');
});

test('PF-6: error present on the benign POST too — no finding', async () => {
  globalThis.fetch = makeFetch({ benign: MYSQL_ERROR, malicious: MYSQL_ERROR });
  const findings = await probePostForms([FORM], {});
  assert.equal(findings.length, 0, 'the differential control must stay intact');
});
