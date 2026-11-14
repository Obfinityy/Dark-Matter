// Tests for the crypto token harvester (rows #124/#261/#369).
// The harvester supplies opts.cryptoTokens from what the scan already
// saw — zero extra requests. Pure functions; no network.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  harvestScanTokens,
  harvestTokensFromHeaders,
  harvestTokensFromForms,
  splitSetCookieHeader,
} from './tokenHarvest.js';

describe('splitSetCookieHeader', () => {
  it('splits a comma-joined Set-Cookie value into one header per cookie', () => {
    const joined = 'session=sess-100001; Path=/, csrf=csrf-200001; Path=/; Secure';
    const parts = splitSetCookieHeader(joined);
    assert.equal(parts.length, 2);
    assert.ok(parts[0].startsWith('session=sess-100001'));
    assert.ok(parts[1].startsWith('csrf=csrf-200001'));
  });

  it('does NOT split on the comma inside an Expires attribute', () => {
    const joined =
      'session=sess-100001; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/, other=xyz-999888; Path=/';
    const parts = splitSetCookieHeader(joined);
    assert.equal(parts.length, 2);
    assert.ok(parts[0].includes('Expires=Wed, 21 Oct 2026'));
    assert.ok(parts[1].startsWith('other=xyz-999888'));
  });

  it('passes a single cookie through untouched', () => {
    assert.deepEqual(splitSetCookieHeader('session=abc12345; Path=/'), ['session=abc12345; Path=/']);
  });

  it('returns [] for empty input', () => {
    assert.deepEqual(splitSetCookieHeader(''), []);
    assert.deepEqual(splitSetCookieHeader(null), []);
  });
});

describe('harvestTokensFromHeaders', () => {
  it('harvests session-named cookies from a plain headers object', () => {
    const tokens = harvestTokensFromHeaders(
      { 'set-cookie': 'session=sess-100001; Path=/, csrf=csrf-200001; Path=/' },
      'set-cookie:http://127.0.0.1/'
    );
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].value, 'sess-100001');
    assert.equal(tokens[0].name, 'session');
    assert.equal(tokens[1].value, 'csrf-200001');
    assert.ok(tokens.every((t) => t.source === 'set-cookie:http://127.0.0.1/'));
  });

  it('skips tracking cookies by name', () => {
    const tokens = harvestTokensFromHeaders(
      { 'set-cookie': '_ga=GA1.2.123; Path=/, _gid=GA1.2.456; Path=/' },
      'set-cookie:http://127.0.0.1/'
    );
    assert.equal(tokens.length, 0);
  });

  it('harvests a long value even under an unrecognised name', () => {
    const tokens = harvestTokensFromHeaders(
      { 'set-cookie': 'weirdname=9f2c47ab81d5e03a6c4b9f0d2e7a5c8; Path=/' },
      'set-cookie:http://127.0.0.1/'
    );
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, '9f2c47ab81d5e03a6c4b9f0d2e7a5c8');
  });

  it('skips a long DOTTED value under an unrecognised name (tracking format)', () => {
    const tokens = harvestTokensFromHeaders(
      { 'set-cookie': 'weirdname=GA1.2.1234567890.1234567890; Path=/' },
      'set-cookie:http://127.0.0.1/'
    );
    assert.equal(tokens.length, 0);
  });

  it('harvests every cookie from a setCookies array (no collapse loss)', () => {
    const tokens = harvestTokensFromHeaders(
      ['session=sess-100001; Path=/', '_ga=GA1.2.1234567890.1234567890; Path=/'],
      'set-cookie:http://127.0.0.1/'
    );
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, 'sess-100001');
  });

  it('skips short values', () => {
    const tokens = harvestTokensFromHeaders({ 'set-cookie': 'session=abc; Path=/' }, 'x');
    assert.equal(tokens.length, 0);
  });

  it('returns [] when no set-cookie header is present', () => {
    assert.deepEqual(harvestTokensFromHeaders({}, 'x'), []);
    assert.deepEqual(harvestTokensFromHeaders(null, 'x'), []);
  });
});

describe('harvestTokensFromForms', () => {
  it('harvests hidden token/csrf inputs and skips other hidden inputs', () => {
    const forms = [
      {
        action: 'http://127.0.0.1/login',
        inputs: [
          { name: 'csrf_token', type: 'hidden', value: 'csrf-300001' },
          { name: 'next', type: 'hidden', value: '/dashboard' },
          { name: 'username', type: 'text', value: 'alice' },
        ],
      },
    ];
    const tokens = harvestTokensFromForms(forms);
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, 'csrf-300001');
    assert.equal(tokens[0].name, 'csrf_token');
    assert.equal(tokens[0].source, 'form:http://127.0.0.1/login');
  });

  it('skips short token values', () => {
    const tokens = harvestTokensFromForms([
      { action: 'http://127.0.0.1/x', inputs: [{ name: 'token', type: 'hidden', value: 'abc' }] },
    ]);
    assert.equal(tokens.length, 0);
  });

  it('returns [] for no forms', () => {
    assert.deepEqual(harvestTokensFromForms([]), []);
    assert.deepEqual(harvestTokensFromForms(null), []);
  });
});

describe('harvestScanTokens', () => {
  it('merges fingerprint cookies, form tokens and the lab session, deduped', () => {
    const tokens = harvestScanTokens({
      fingerprint: { headers: { 'set-cookie': 'session=sess-100001; Path=/' } },
      crawled: null,
      forms: [
        {
          action: 'http://127.0.0.1/login',
          inputs: [{ name: 'csrf_token', type: 'hidden', value: 'csrf-200001' }],
        },
      ],
      authSession: {
        ok: true,
        session: {
          token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.signature',
          cookies: [{ name: 'PHPSESSID', value: 'sess-100001' }],
        },
      },
      labUsername: 'alice',
      targetUrl: 'http://127.0.0.1/',
    });
    // sess-100001 appears twice (fingerprint cookie + lab cookie) — once.
    const values = tokens.map((t) => t.value);
    assert.equal(values.length, new Set(values).size);
    assert.ok(values.includes('sess-100001'));
    assert.ok(values.includes('csrf-200001'));
    assert.ok(values.includes('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.signature'));
    // Lab-session tokens carry the username so the T2
    // username-derived signal can fire.
    const bearer = tokens.find((t) => t.value.startsWith('eyJ'));
    assert.equal(bearer.username, 'alice');
  });

  it('caps the harvest at 12 tokens', () => {
    const cookies = Array.from({ length: 20 }, (_, i) => `session${i}=tok-${100000 + i}`).join(', ');
    const tokens = harvestScanTokens({
      fingerprint: { headers: { 'set-cookie': cookies } },
      crawled: null,
      forms: [],
      authSession: null,
      labUsername: null,
      targetUrl: 'http://127.0.0.1/',
    });
    assert.equal(tokens.length, 12);
  });

  it('returns [] when the scan saw no tokens', () => {
    assert.deepEqual(
      harvestScanTokens({
        fingerprint: null,
        crawled: null,
        forms: [],
        authSession: null,
        labUsername: null,
        targetUrl: 'http://127.0.0.1/',
      }),
      []
    );
  });

  it('prefers the full setCookies list over the collapsed headers object', () => {
    // The collapsed object keeps only the LAST cookie (a tracking
    // cookie here); the full list carries the session cookie too.
    const tokens = harvestScanTokens({
      fingerprint: {
        url: 'http://127.0.0.1/',
        headers: { 'set-cookie': '_ga=GA1.2.1234567890.1234567890; Path=/' },
        setCookies: ['session=sess-100001; Path=/', '_ga=GA1.2.1234567890.1234567890; Path=/'],
      },
      crawled: null,
      forms: [],
      authSession: null,
      labUsername: null,
      targetUrl: 'http://127.0.0.1/',
    });
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, 'sess-100001');
  });
});
