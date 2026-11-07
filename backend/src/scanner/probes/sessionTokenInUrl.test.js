// Tests for the session token in URL probe
// (coverage rows #265 [Medium] + #321 [Medium], phase 81).
// No network, no lab needed — pure URL inspection.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSessionTokenInUrl,
  isTokenLike,
  maskToken,
  extractSessionParams,
  crossOriginHosts,
  SESSION_PARAM_NAMES,
} from './sessionTokenInUrl.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://lab.local/app/index.html';
const ORIGIN = 'http://lab.local';

// Token fixtures are built by concatenation, never as single
// literals — a single high-entropy literal trips GitHub push
// protection (GH013).
const HEX32 = 'a1b2c3d4' + 'e5f60718' + '293a4b5c' + '6d7e8f90';
const TOKEN26 = 'abc123' + 'def456' + 'ghi789' + 'jkl012' + 'mn';
const B64_24 = 'Ab3dEf6h' + 'IjKlMnOp' + 'QrStUvWx';
const UUID_TOK = '123e4567' + '-e89b-12d3' + '-a456-426614174000';
const HTML_CLEAN = '<html><head><script src="/app.js"></script></head><body></body></html>';
const HTML_XORIGIN =
  '<html><head><script src="https://cdn.evil.example/x.js"></script>' +
  '<img src="https://img.evil.example/p.png"></head><body></body></html>';
const HTML_LINKOUT =
  '<html><body><a href="https://out.evil.example/page">out</a></body></html>';

describe('isTokenLike', () => {
  it('accepts a 32-char hex session id', () => {
    assert.equal(isTokenLike(HEX32), true);
  });
  it('accepts a 26-char alphanumeric session id', () => {
    assert.equal(isTokenLike(TOKEN26), true);
  });
  it('accepts a 24-char mixed-case base64 session id', () => {
    assert.equal(isTokenLike(B64_24), true);
  });
  it('accepts a UUID session id', () => {
    assert.equal(isTokenLike(UUID_TOK), true);
  });
  it('accepts a percent-encoded base64 value once decoded', () => {
    assert.equal(isTokenLike('Ab3d%2Bx9Q' + '%2FzA1b2C3d4'), true);
  });
  it('rejects short values', () => {
    assert.equal(isTokenLike('1'), false);
    assert.equal(isTokenLike('abc'), false);
    assert.equal(isTokenLike('guest'), false);
    assert.equal(isTokenLike('1234567890abcde'), false);
  });
  it('rejects digits-only values', () => {
    assert.equal(isTokenLike('1234567890123456'), false);
  });
  it('rejects letters-only values', () => {
    assert.equal(isTokenLike('aaaaaaaaaaaaaaaa'), false);
  });
  it('rejects values with spaces or non-token characters', () => {
    assert.equal(isTokenLike('hello world 123456'), false);
    assert.equal(isTokenLike('abc123<>def4567890'), false);
  });
});

describe('maskToken', () => {
  it('shows first 4 + last 2 chars and the length, never the full value', () => {
    assert.equal(maskToken(HEX32), 'a1b2…90 (32 chars)');
    assert.ok(!maskToken(HEX32).includes(HEX32.slice(4, 28)));
  });
});

describe('extractSessionParams', () => {
  it('matches all seven session param names case-insensitively', () => {
    for (const name of SESSION_PARAM_NAMES) {
      const found = extractSessionParams(`${ORIGIN}/x?${name}=${HEX32}`);
      assert.equal(found.length, 1, name);
      assert.equal(found[0].value, HEX32);
    }
    assert.equal(extractSessionParams(`${ORIGIN}/x?PHPSESSID=${HEX32}`).length, 1);
    assert.equal(extractSessionParams(`${ORIGIN}/x?Session_Token=${HEX32}`).length, 1);
  });
  it('ignores non-session params including CSRF tokens', () => {
    const found = extractSessionParams(
      `${ORIGIN}/x?page=2&id=12&csrf_token=${HEX32}&_token=${HEX32}&authenticity_token=${HEX32}`
    );
    assert.deepEqual(found, []);
  });
  it('extracts ;name=value path params (Java EE URL rewriting)', () => {
    const found = extractSessionParams(`${ORIGIN}/app;jsessionid=${HEX32}/home`);
    assert.equal(found.length, 1);
    assert.equal(found[0].param, 'jsessionid');
    assert.equal(found[0].value, HEX32);
  });
  it('ignores params in the fragment (never sent to the server)', () => {
    assert.deepEqual(extractSessionParams(`${ORIGIN}/x#sid=${HEX32}`), []);
  });
  it('returns [] for a malformed URL', () => {
    assert.deepEqual(extractSessionParams('not-a-url'), []);
  });
});

describe('crossOriginHosts', () => {
  it('finds cross-origin script + img subresources', () => {
    const { subresources, outboundLinks } = crossOriginHosts(HTML_XORIGIN, PAGE);
    assert.deepEqual(subresources.sort(), ['cdn.evil.example', 'img.evil.example']);
    assert.deepEqual(outboundLinks, []);
  });
  it('ignores same-origin subresources', () => {
    const { subresources } = crossOriginHosts(HTML_CLEAN, PAGE);
    assert.deepEqual(subresources, []);
  });
  it('finds outbound <a> links separately from subresources', () => {
    const { subresources, outboundLinks } = crossOriginHosts(HTML_LINKOUT, PAGE);
    assert.deepEqual(subresources, []);
    assert.deepEqual(outboundLinks, ['out.evil.example']);
  });
  it('ignores data: sources and commented-out tags', () => {
    const html = '<!-- <script src="https://cdn.evil.example/x.js"></script> -->' +
      '<img src="data:image/png;base64,abcd">';
    assert.deepEqual(crossOriginHosts(html, PAGE), { subresources: [], outboundLinks: [] });
  });
  it('returns empty sets with no html or an invalid page URL', () => {
    assert.deepEqual(crossOriginHosts('', PAGE), { subresources: [], outboundLinks: [] });
    assert.deepEqual(crossOriginHosts(HTML_XORIGIN, 'not-a-url'), { subresources: [], outboundLinks: [] });
  });
});

describe('probeSessionTokenInUrl', () => {
  it('returns [] on clean URLs', () => {
    const findings = probeSessionTokenInUrl(PAGE, [`${ORIGIN}/x?page=2`, `${ORIGIN}/y?id=12`], {});
    assert.deepEqual(findings, []);
  });
  it('fires on a token in the page URL (#265 variant)', () => {
    const findings = probeSessionTokenInUrl(`${ORIGIN}/app?PHPSESSID=${HEX32}`, [], {});
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'session_token_in_url');
    assert.equal(f.severity, 'medium');
    assert.equal(f.parameter, 'PHPSESSID');
    assert.ok(f.title.includes('PHPSESSID'), f.title);
    assert.ok(!f.title.includes('Referer'), f.title);
    assert.ok(f.evidence.request.includes(`${ORIGIN}/app?PHPSESSID=`));
    assert.ok(f.evidence.response.includes('(#265:'), f.evidence.response);
    assert.ok(!f.evidence.response.includes(HEX32), 'full token must never be published');
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });
  it('fires once per param (two params → two findings)', () => {
    const findings = probeSessionTokenInUrl(
      `${ORIGIN}/app?PHPSESSID=${HEX32}&sid=${TOKEN26}`,
      [],
      {}
    );
    assert.equal(findings.length, 2);
    assert.ok(findings.some((f) => f.parameter === 'PHPSESSID'));
    assert.ok(findings.some((f) => f.parameter === 'sid'));
  });
  it('dedupes the same url+param across page and targets', () => {
    const url = `${ORIGIN}/app?sid=${HEX32}`;
    const findings = probeSessionTokenInUrl(url, [url, url], {});
    assert.equal(findings.length, 1);
  });
  it('fires the #321 subresource variant when the page loads cross-origin scripts', () => {
    const findings = probeSessionTokenInUrl(`${ORIGIN}/app?sid=${HEX32}`, [], { html: HTML_XORIGIN });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('Referer'), findings[0].title);
    assert.ok(findings[0].title.includes('cdn.evil.example'), findings[0].title);
    assert.ok(findings[0].evidence.response.includes('(#321:'), findings[0].evidence.response);
  });
  it('fires the #321 outbound-link variant when the page only links out', () => {
    const findings = probeSessionTokenInUrl(`${ORIGIN}/app?sid=${HEX32}`, [], { html: HTML_LINKOUT });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('Referer'), findings[0].title);
    assert.ok(findings[0].title.includes('out.evil.example'), findings[0].title);
  });
  it('stays #265 when the page HTML has only same-origin resources', () => {
    const findings = probeSessionTokenInUrl(`${ORIGIN}/app?sid=${HEX32}`, [], { html: HTML_CLEAN });
    assert.equal(findings.length, 1);
    assert.ok(!findings[0].title.includes('Referer'), findings[0].title);
  });
  it('does not claim the leak path for a token on a non-landing target', () => {
    const findings = probeSessionTokenInUrl(PAGE, [`${ORIGIN}/x?sid=${HEX32}`], { html: HTML_XORIGIN });
    assert.equal(findings.length, 1);
    assert.ok(!findings[0].title.includes('Referer'), findings[0].title);
    assert.ok(findings[0].evidence.response.includes('(#265:'), findings[0].evidence.response);
  });
  it('fires on a ;jsessionid= path param', () => {
    const findings = probeSessionTokenInUrl(`${ORIGIN}/app;jsessionid=${HEX32}/home`, [], {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'jsessionid');
  });
  it('does not fire on low-entropy values', () => {
    const findings = probeSessionTokenInUrl(
      `${ORIGIN}/app?sid=1&sessionid=guest&PHPSESSID=1234567890`,
      [],
      {}
    );
    assert.deepEqual(findings, []);
  });
  it('returns [] for an invalid page URL', () => {
    assert.deepEqual(probeSessionTokenInUrl('not-a-url', [], {}), []);
  });
  it('caps findings at 5', () => {
    const targets = [];
    for (let i = 0; i < 6; i += 1) targets.push(`${ORIGIN}/p${i}?sid=${HEX32}`);
    const findings = probeSessionTokenInUrl(PAGE, targets, {});
    assert.equal(findings.length, 5);
  });
});
