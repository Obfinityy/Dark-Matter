// Dark Matter scanner — cookie flags probe tests, incl. the scope leg
// (row #260 [Medium] Overly Broad Cookie Scope, fix lane 14 Nov 2026).
// Tests written BEFORE the implementation (test-first): the scope leg
// does not exist yet, so the scope cases fail until it lands.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetchWithCookies(cookieHeaders) {
  return async () => ({
    headers: { getSetCookie: () => cookieHeaders },
    text: async () => '',
  });
}

describe('probeCookieFlags scope leg (row #260)', () => {
  it('flags a session cookie whose Domain is a parent of the target host', async () => {
    globalThis.fetch = mockFetchWithCookies(['sessionid=abc; Domain=.example.com; Path=/; Secure; HttpOnly; SameSite=Lax']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://app.example.com/', { timeoutMs: 5000 });
    const scope = findings.filter((f) => f.class === 'cookie_scope');
    assert.equal(scope.length, 1);
    assert.equal(scope[0].severity, 'medium');
    assert.ok(scope[0].title.includes('Domain'));
    assert.ok(scope[0].evidence.signalCorrelated);
  });

  it('flags a parent Domain without a leading dot too', async () => {
    globalThis.fetch = mockFetchWithCookies(['auth=x; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Lax']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://app.example.com/dashboard', { timeoutMs: 5000 });
    const scope = findings.filter((f) => f.class === 'cookie_scope');
    assert.equal(scope.length, 1);
    assert.equal(scope[0].severity, 'medium');
  });

  it('stays quiet when Domain equals the target host exactly', async () => {
    globalThis.fetch = mockFetchWithCookies(['sessionid=abc; Domain=app.example.com; Path=/; Secure; HttpOnly; SameSite=Lax']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://app.example.com/', { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });

  it('stays quiet when no Domain attribute is present', async () => {
    globalThis.fetch = mockFetchWithCookies(['sessionid=abc; Path=/; Secure; HttpOnly; SameSite=Lax']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://app.example.com/', { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });

  it('stays quiet for a foreign Domain that is not a suffix of the host', async () => {
    globalThis.fetch = mockFetchWithCookies(['sessionid=abc; Domain=other.com; Path=/; Secure; HttpOnly; SameSite=Lax']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://app.example.com/', { timeoutMs: 5000 });
    assert.equal(findings.filter((f) => f.class === 'cookie_scope').length, 0);
  });

  it('rates a non-session cookie with a parent Domain as low', async () => {
    globalThis.fetch = mockFetchWithCookies(['prefs=dark; Domain=.example.com; Path=/; Secure; HttpOnly; SameSite=Lax']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://app.example.com/', { timeoutMs: 5000 });
    const scope = findings.filter((f) => f.class === 'cookie_scope');
    assert.equal(scope.length, 1);
    assert.equal(scope[0].severity, 'low');
  });

  it('does NOT flag Path=/ alone (documented scope decision: Path=/ is the near-universal default for session cookies)', async () => {
    globalThis.fetch = mockFetchWithCookies(['sid=x; Path=/; Secure; HttpOnly; SameSite=Lax']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://example.com/', { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });
});

describe('probeCookieFlags flag leg (regression)', () => {
  it('still flags a session cookie missing Secure/HttpOnly/SameSite', async () => {
    globalThis.fetch = mockFetchWithCookies(['sessionid=abc123; Path=/']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://example.com/', { timeoutMs: 5000 });
    const flags = findings.filter((f) => f.class === 'cookie_flags');
    assert.equal(flags.length, 1);
    assert.ok(flags[0].title.includes('Secure'));
    assert.ok(flags[0].title.includes('HttpOnly'));
  });

  it('stays quiet when cookies carry all flags and no Domain', async () => {
    globalThis.fetch = mockFetchWithCookies(['sid=x; Path=/; Secure; HttpOnly; SameSite=Lax']);
    const { probeCookieFlags } = await import('./cookies.js');
    const findings = await probeCookieFlags('http://example.com/', { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });
});
