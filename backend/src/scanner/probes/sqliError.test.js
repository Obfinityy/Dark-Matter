// Error-based SQLi probe tests — Zerodha false-positive fix (9 Nov 2026).
//
// Hunt h_6b5942052353 (zerodha.com/varsity, WordPress + Cloudflare)
// confirmed a [Critical] error-based SQLi whose "postgres" signature
// was a Cloudflare bot-management cookie/token: a long random token
// that happens to contain the substring "psql" ("...lpsqLYIL...").
// The old matcher (detectDbFamily) matched bare engine words, and
// WordPress runs MySQL and casts comment_post_ID to int — a Postgres
// error there is impossible.
//
// Rule under test: confirmation needs a GENUINE DB error phrase
// (detectDbError) on the malicious input, absent on the benign one,
// and an engine-specific signature that contradicts the fingerprinted
// stack (opts.tech) never confirms.
//
// Follow-up (9 Nov 2026, Zerodha-fix lab proof): the strict sqlite
// pattern missed the canonical `SQLITE_ERROR` form — its separator
// class `[\s.]` does not match the underscore — so the genuine Juice
// Shop SQLi (hunt h_5c95162cf81e, proof #34's {27,0} baseline) was
// lost. The pattern now allows `_` as a separator (SQLi-0, SQLi-9).
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeSqliError } from './sqliError.js';
import { detectDbFamily, detectDbError } from '../fingerprint.js';

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

// The recorded Zerodha token, built by concatenation so no single
// literal in this file is a long secret-shaped string. It contains
// the substring "psql" (l-psq-L) that the old matcher fired on.
const CLOUDFLARE_TOKEN =
  'pHdXIyO.44VVd9WN_JzDTU3tZ2zc424.6HcN.L_Ub1OKwrvzCFOP_3WhZl6' +
  'lpsqLYILtcHjBgCjFdcudBtjQflIzJs_kS94Ryf0HhzNxLbvwtSKyrfUzo2fHXsrDMiP4ayuLan2OFCOtPfCix6sr5uzacwsHOOeB';
const CLOUDFLARE_PAGE =
  '<html><head><title>Just a moment...</title></head><body>' +
  '<div id="cf-content">Checking your browser before accessing zerodha.com.</div>' +
  `<script>var cfToken="${CLOUDFLARE_TOKEN}";</script></body></html>`;
const NORMAL_PAGE = '<html><body><h1>Varsity</h1><p>Learn stock markets.</p></body></html>';
const MYSQL_ERROR =
  "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1";
const PG_ERROR =
  'Warning: pg_query(): Query failed: ERROR: syntax error at or near "\'" at character 8';
const ORA_ERROR = 'ORA-00933: SQL command not properly ended';
const SQLSTATE_ERROR = 'SQLSTATE[HY000]: General error';
// The recorded Juice Shop error page (proof #34 hunt h_7a1342904b11):
// GET /rest/products/search?q=1' returns a real SQLite syntax error.
const SQLITE_ERROR_PLAIN = 'Error: SQLITE_ERROR: near "\'": syntax error';
const SQLITE_ERROR_HTML =
  "<html><head><title>Error: SQLITE_ERROR: near &quot;&#39;%&#39;&quot;: syntax error</title></head>" +
  '<body><h1>Error</h1></body></html>';
// Bare engine mentions with no error phrase — must never detect.
const BARE_SQLITE_TOKEN = 'cf9d2a-sqlite-7b3e1f8a4c6d';
const BARE_SQLITE_MENTION = 'sqlite3 database version 3.40.1';

const TARGET = 'https://zerodha.com/varsity/wp-comments-post.php?comment_post_ID=1';
const JUICE_TARGET = 'http://172.17.0.1:3000/rest/products/search?q=dmprobe7_9b8a';

// Route by the injected value: a quote in the param means the
// malicious request, anything else is the benign control.
function makeFetch({ benign, malicious }, param = 'comment_post_ID') {
  return async (url) => {
    const value = new URL(String(url)).searchParams.get(param) || '';
    const body = value.includes("'") ? malicious : benign;
    return { status: 200, text: async () => body };
  };
}

test('SQLi-0: the old matcher fires on the token, the strict one does not', () => {
  assert.equal(detectDbFamily(CLOUDFLARE_PAGE), 'postgres');
  assert.equal(detectDbError(CLOUDFLARE_PAGE), null);
  assert.equal(detectDbError(MYSQL_ERROR), 'mysql');
  assert.equal(detectDbError(PG_ERROR), 'postgres');
  assert.equal(detectDbError(ORA_ERROR), 'oracle');
  assert.equal(detectDbError(SQLSTATE_ERROR), 'generic');
  // The canonical SQLite error code uses an underscore separator.
  assert.equal(detectDbError(SQLITE_ERROR_PLAIN), 'sqlite');
  assert.equal(detectDbError(SQLITE_ERROR_HTML), 'sqlite');
  // A bare engine mention with no error phrase is not a DB error.
  assert.equal(detectDbError(BARE_SQLITE_TOKEN), null);
  assert.equal(detectDbError(BARE_SQLITE_MENTION), null);
});

test('SQLi-1: Cloudflare token page (Zerodha FP) — no finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: CLOUDFLARE_PAGE });
  const findings = await probeSqliError(TARGET, ['comment_post_ID'], {});
  assert.equal(findings.length, 0, 'a bot token containing "psql" is not a DB error');
});

test('SQLi-2: same FP with the WordPress stack fingerprinted — no finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: CLOUDFLARE_PAGE });
  const findings = await probeSqliError(TARGET, ['comment_post_ID'], {
    tech: ['php', 'wordpress', 'cloudflare'],
  });
  assert.equal(findings.length, 0);
});

test('SQLi-3: genuine MySQL error (DVWA shape) — one critical finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: MYSQL_ERROR });
  const findings = await probeSqliError(TARGET, ['comment_post_ID'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'sqli_error');
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].dbFamily, 'mysql');
  assert.equal(findings[0].evidence.errorCorrelated, true);
});

test('SQLi-4: genuine Postgres error — one critical finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: PG_ERROR });
  const findings = await probeSqliError(TARGET, ['comment_post_ID'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].dbFamily, 'postgres');
});

test('SQLi-5: Postgres error on a WordPress stack — stack gate blocks it', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: PG_ERROR });
  const findings = await probeSqliError(TARGET, ['comment_post_ID'], {
    tech: ['php', 'wordpress', 'cloudflare'],
  });
  assert.equal(findings.length, 0, 'postgres cannot run under WordPress/MySQL');
});

test('SQLi-6: MySQL error on a WordPress stack — stack gate allows it', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: MYSQL_ERROR });
  const findings = await probeSqliError(TARGET, ['comment_post_ID'], {
    tech: ['php', 'wordpress', 'cloudflare'],
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].dbFamily, 'mysql');
});

test('SQLi-7: error present on the benign input too — no finding', async () => {
  globalThis.fetch = makeFetch({ benign: MYSQL_ERROR, malicious: MYSQL_ERROR });
  const findings = await probeSqliError(TARGET, ['comment_post_ID'], {});
  assert.equal(findings.length, 0, 'the differential control must stay intact');
});

test('SQLi-8: Oracle and SQLSTATE errors still confirm', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: ORA_ERROR });
  const ora = await probeSqliError(TARGET, ['comment_post_ID'], {});
  assert.equal(ora.length, 1);
  assert.equal(ora[0].dbFamily, 'oracle');
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: SQLSTATE_ERROR });
  const state = await probeSqliError(TARGET, ['comment_post_ID'], {});
  assert.equal(state.length, 1);
  assert.equal(state[0].dbFamily, 'generic');
});

test('SQLi-9: genuine SQLite error (Juice Shop shape) — one critical finding', async () => {
  globalThis.fetch = makeFetch({ benign: NORMAL_PAGE, malicious: SQLITE_ERROR_HTML }, 'q');
  const findings = await probeSqliError(JUICE_TARGET, ['q'], { tech: ['node', 'express'] });
  assert.equal(findings.length, 1, 'the real SQLITE_ERROR on q=1\' must confirm');
  assert.equal(findings[0].class, 'sqli_error');
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].dbFamily, 'sqlite');
  assert.equal(findings[0].title, "Error-based SQL injection in parameter 'q'");
  assert.equal(findings[0].evidence.errorCorrelated, true);
});
