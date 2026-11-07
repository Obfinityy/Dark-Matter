// Tests for the sensitive-data-cached-by-browser probe
// (coverage row #96 [Medium], phase 84).
// No network, no lab needed — pure inspection of an already-fetched
// landing-page response (headers + body).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSensitiveCache,
  parseCacheDirectives,
  sensitiveSignals,
  AUTH_GATED_SEGMENTS,
} from './sensitiveCache.js';
import { verifyFindings } from '../verifier.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LOGIN_URL = 'http://lab.local/login.php';
const PUBLIC_URL = 'http://lab.local/about';
const HTML_LOGIN =
  '<html><body><form action="/login.php" method="post">' +
  '<input type="text" name="username"><input type="password" name="password">' +
  '</form></body></html>';
const HTML_PUBLIC = '<html><body><h1>Welcome</h1><p>Public page.</p></body></html>';
const HTML_SPA = '<html><body><div id="root"></div><script src="/main.js"></script></body></html>';

describe('parseCacheDirectives', () => {
  it('parses a multi-directive list and lowercases names', () => {
    const dirs = parseCacheDirectives('no-cache, must-revalidate, max-age=3600');
    assert.deepEqual([...dirs].sort(), ['max-age', 'must-revalidate', 'no-cache']);
  });
  it('accepts mixed-case No-Store', () => {
    assert.equal(parseCacheDirectives('No-Store').has('no-store'), true);
    assert.equal(parseCacheDirectives('NO-STORE, max-age=0').has('no-store'), true);
  });
  it('drops directive values — max-age=3600 yields max-age, not the value', () => {
    const dirs = parseCacheDirectives('public, max-age=3600');
    assert.equal(dirs.has('max-age'), true);
    assert.equal(dirs.has('3600'), false);
  });
  it('a quoted value containing no-store never yields the directive', () => {
    const dirs = parseCacheDirectives('foo="no-store", max-age=60');
    assert.equal(dirs.has('no-store'), false);
    assert.equal(dirs.has('foo'), true);
  });
  it('handles an array of header values', () => {
    const dirs = parseCacheDirectives(['no-cache', 'no-store']);
    assert.equal(dirs.has('no-store'), true);
  });
  it('handles absent / non-string input as empty', () => {
    assert.equal(parseCacheDirectives(undefined).size, 0);
    assert.equal(parseCacheDirectives(null).size, 0);
    assert.equal(parseCacheDirectives(42).size, 0);
  });
});

describe('sensitiveSignals', () => {
  it('fires on a Set-Cookie string', () => {
    const sigs = sensitiveSignals(LOGIN_URL, { 'set-cookie': 'sid=abc; path=/' }, HTML_PUBLIC);
    assert.ok(sigs.some((s) => s.includes('cookie')));
  });
  it('fires on a Set-Cookie array', () => {
    const sigs = sensitiveSignals(LOGIN_URL, { 'set-cookie': ['a=1', 'b=2'] }, HTML_PUBLIC);
    assert.ok(sigs.some((s) => s.includes('cookie')));
  });
  it('fires on a password input', () => {
    const sigs = sensitiveSignals(PUBLIC_URL, {}, HTML_LOGIN);
    assert.ok(sigs.some((s) => s.includes('password')));
  });
  it('ignores a commented-out password input', () => {
    const html = '<html><body><!-- <input type="password" name="p"> --></body></html>';
    assert.deepEqual(sensitiveSignals(PUBLIC_URL, {}, html), []);
  });
  it('fires on a login form without a password input', () => {
    const html = '<html><body><form action="/login" method="post"><input name="u"></form></body></html>';
    const sigs = sensitiveSignals(PUBLIC_URL, {}, html);
    assert.ok(sigs.some((s) => s.includes('login form')));
  });
  it('fires on an auth-gated path but not on /accounting', () => {
    assert.ok(sensitiveSignals('http://lab.local/login.php', {}, HTML_PUBLIC).length > 0);
    assert.ok(sensitiveSignals('http://lab.local/admin/users', {}, HTML_PUBLIC).length > 0);
    assert.deepEqual(sensitiveSignals('http://lab.local/accounting', {}, HTML_PUBLIC), []);
  });
  it('a public page carries no signal', () => {
    assert.deepEqual(sensitiveSignals(PUBLIC_URL, {}, HTML_PUBLIC), []);
  });
  it('an invalid URL yields no path signal', () => {
    assert.deepEqual(sensitiveSignals('not a url', {}, HTML_PUBLIC), []);
  });
});

describe('probeSensitiveCache', () => {
  it('(a) login page with no-store present does not fire', () => {
    const findings = probeSensitiveCache(
      LOGIN_URL,
      { 'cache-control': 'no-store, no-cache, must-revalidate', pragma: 'no-cache' },
      HTML_LOGIN
    );
    assert.deepEqual(findings, []);
  });
  it('(b) login page with public caching fires once', () => {
    const findings = probeSensitiveCache(
      LOGIN_URL,
      { 'cache-control': 'public, max-age=3600' },
      HTML_LOGIN
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'sensitive_cache');
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].id, 'sensitive-cache-no-store');
    assert.ok(findings[0].title.includes('no-store'));
    assert.ok(findings[0].evidence.response.includes('public, max-age=3600'));
  });
  it('(c) public page with public caching does not fire', () => {
    const findings = probeSensitiveCache(
      PUBLIC_URL,
      { 'cache-control': 'public, max-age=3600' },
      HTML_PUBLIC
    );
    assert.deepEqual(findings, []);
  });
  it('(d) session cookie set + missing no-store fires', () => {
    const findings = probeSensitiveCache(
      PUBLIC_URL,
      { 'cache-control': 'public, max-age=60', 'set-cookie': 'sid=abc; path=/' },
      HTML_PUBLIC
    );
    assert.equal(findings.length, 1);
    assert.ok(findings[0].evidence.response.includes('Set-Cookie'));
  });
  it('(e) no-cache without no-store fires (strict gate)', () => {
    const findings = probeSensitiveCache(
      LOGIN_URL,
      { 'cache-control': 'no-cache, must-revalidate', pragma: 'no-cache' },
      HTML_LOGIN
    );
    assert.equal(findings.length, 1);
  });
  it('(f) DVWA shape — no-cache/must-revalidate + Pragma + session cookie fires', () => {
    const findings = probeSensitiveCache(
      'http://lab.local/login.php',
      {
        'cache-control': 'no-cache, must-revalidate',
        pragma: 'no-cache',
        expires: 'Tue, 23 Jun 2009 12:00:00 GMT',
        'set-cookie': ['PHPSESSID=abc; path=/', 'security=low; path=/'],
      },
      HTML_LOGIN
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'medium');
  });
  it('(g) Juice shape — SPA root, public max-age=0, no signal, does not fire', () => {
    const findings = probeSensitiveCache(
      'http://lab.local/',
      { 'cache-control': 'public, max-age=0' },
      HTML_SPA
    );
    assert.deepEqual(findings, []);
  });
  it('(h) mixed-case No-Store protects', () => {
    const findings = probeSensitiveCache(
      LOGIN_URL,
      { 'Cache-Control': 'No-Store' },
      HTML_LOGIN
    );
    assert.deepEqual(findings, []);
  });
  it('(i) absent Cache-Control on a sensitive page fires', () => {
    const findings = probeSensitiveCache(LOGIN_URL, {}, HTML_LOGIN);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].evidence.response.includes('(absent)'));
  });
  it('(j) exactly one finding per scan', () => {
    const findings = probeSensitiveCache(
      LOGIN_URL,
      { 'cache-control': 'public', 'set-cookie': 'sid=abc; path=/' },
      HTML_LOGIN
    );
    assert.equal(findings.length, 1);
  });
  it('(k) the finding survives verifyFindings as confirmed', () => {
    const findings = probeSensitiveCache(
      LOGIN_URL,
      { 'cache-control': 'public, max-age=3600' },
      HTML_LOGIN
    );
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('(l) differential routing: default protocol confirms on signalCorrelated', () => {
    const findings = probeSensitiveCache(
      LOGIN_URL,
      { 'cache-control': 'public, max-age=3600' },
      HTML_LOGIN
    );
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });
  it('(m) invalid page URL returns []', () => {
    assert.deepEqual(probeSensitiveCache('not a url', {}, HTML_LOGIN), []);
    assert.deepEqual(probeSensitiveCache('', {}, HTML_LOGIN), []);
  });
  it('(n) header keys are matched case-insensitively', () => {
    const findings = probeSensitiveCache(
      LOGIN_URL,
      { 'CACHE-CONTROL': 'public, max-age=60' },
      HTML_LOGIN
    );
    assert.equal(findings.length, 1);
    const protectedFindings = probeSensitiveCache(
      LOGIN_URL,
      { 'CACHE-CONTROL': 'NO-STORE' },
      HTML_LOGIN
    );
    assert.deepEqual(protectedFindings, []);
  });
  it('AUTH_GATED_SEGMENTS is the documented short list', () => {
    assert.deepEqual(
      [...AUTH_GATED_SEGMENTS].sort(),
      ['account', 'admin', 'checkout', 'login', 'profile', 'settings']
    );
  });
});
