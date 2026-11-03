// Dark Matter rule-based scanner — unit tests (no network, no docker).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTarget, authorizeTarget, assertInScope } from './target.js';
import { parseJsonl } from './runner.js';
import { detectTech, detectDbFamily } from './fingerprint.js';
import { extractLinks, extractForms, extractParams } from './crawl.js';
import { probeHeaders } from './probes/headers.js';
import { probeCsrf } from './probes/csrf.js';
import { probeIdorSurface } from './probes/idor.js';
import { verifyFindings } from './verifier.js';
import { probePostForms } from './probes/postForms.js';

describe('target', () => {
  it('normalizes bare hosts to https', () => {
    assert.equal(normalizeTarget('example.com'), 'https://example.com');
  });
  it('rejects non-http schemes', () => {
    assert.throws(() => normalizeTarget('ftp://example.com'), /only http/);
  });
  it('rejects empty target', () => {
    assert.throws(() => normalizeTarget(''), /empty target/);
  });
  it('authorizeTarget passes a user-confirmed target', () => {
    const r = authorizeTarget({
      target: 'https://example.com/x',
      scope: 'example.com',
      confirmedAuthorized: true,
    });
    assert.equal(r.host, 'example.com');
    assert.ok(Array.isArray(r.scope.hosts));
  });
  it('authorizeTarget rejects without user confirmation', () => {
    assert.throws(
      () =>
        authorizeTarget({
          target: 'https://example.com/',
          confirmedAuthorized: false,
        }),
      /must confirm the target/
    );
  });
  it('assertInScope allows the target host and rejects others', () => {
    const { scope } = authorizeTarget({
      target: 'https://example.com/',
      confirmedAuthorized: true,
    });
    assert.equal(assertInScope('https://example.com/page', scope), true);
    assert.throws(
      () => assertInScope('https://other.com/', scope),
      /outside authorized scope/
    );
  });
});

describe('runner', () => {
  it('parseJsonl skips malformed lines', () => {
    const rows = parseJsonl('{"a":1}\nnot json\n{"b":2}\n');
    assert.deepEqual(rows, [{ a: 1 }, { b: 2 }]);
  });
});

describe('fingerprint', () => {
  it('detects wordpress + php + nginx', () => {
    const tech = detectTech(
      { server: 'nginx/1.24', 'x-powered-by': 'PHP/8.1' },
      '<link href="/wp-content/themes/x/style.css">'
    );
    assert.ok(tech.includes('wordpress'));
    assert.ok(tech.includes('php'));
    assert.ok(tech.includes('nginx'));
  });
  it('detectDbFamily spots mysql errors', () => {
    assert.equal(
      detectDbFamily("You have an error in your SQL syntax near ''1'''"),
      'mysql'
    );
    assert.equal(detectDbFamily('all good'), null);
  });
});

describe('crawl', () => {
  it('extracts same-origin links only', () => {
    const links = extractLinks(
      '<a href="/a">x</a><a href="https://other.com/b">y</a>',
      'https://example.com/'
    );
    assert.deepEqual(links, ['https://example.com/a']);
  });
  it('extracts forms with inputs', () => {
    const forms = extractForms(
      '<form action="/login" method="post"><input name="u"><input name="p"></form>',
      'https://example.com/'
    );
    assert.equal(forms.length, 1);
    assert.equal(forms[0].action, 'https://example.com/login');
    assert.deepEqual(forms[0].inputs, ['u', 'p']);
  });
  it('extracts query params', () => {
    assert.deepEqual(extractParams('https://example.com/?a=1&b=2'), ['a', 'b']);
  });
});

describe('probeHeaders', () => {
  it('flags missing headers and cors wildcard+credentials', () => {
    const findings = probeHeaders({
      url: 'https://example.com/',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-credentials': 'true',
      },
    });
    const ids = findings.map((f) => f.id);
    assert.ok(ids.includes('missing-hsts'));
    assert.ok(ids.includes('cors-wildcard-credentials'));
    assert.ok(findings.every((f) => f.evidence.signalCorrelated === true));
  });
  it('is quiet when headers are present', () => {
    const findings = probeHeaders({
      url: 'https://example.com/',
      headers: {
        'strict-transport-security': 'max-age=1',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    });
    assert.equal(findings.length, 0);
  });
});

describe('probeCsrf', () => {
  it('flags POST forms without a token field', () => {
    const findings = probeCsrf(
      [{ action: 'https://example.com/change', method: 'post', inputs: ['email'] }],
      'https://example.com/'
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'csrf');
    assert.ok(findings[0].evidence.signalCorrelated);
  });
  it('passes forms that carry a token', () => {
    const findings = probeCsrf(
      [{ action: 'https://example.com/change', method: 'post', inputs: ['email', 'csrf_token'] }],
      'https://example.com/'
    );
    assert.equal(findings.length, 0);
  });
  it('ignores GET forms', () => {
    const findings = probeCsrf(
      [{ action: 'https://example.com/search', method: 'get', inputs: ['q'] }],
      'https://example.com/'
    );
    assert.equal(findings.length, 0);
  });
});

describe('probeIdorSurface', () => {
  it('flags sequential numeric IDs', () => {
    const findings = probeIdorSurface('https://example.com/user/12345/profile');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'idor');
  });
  it('stays quiet without numeric IDs', () => {
    assert.equal(probeIdorSurface('https://example.com/about').length, 0);
  });
  it('never auto-confirms (stays unconfirmed by design)', () => {
    const { confirmed } = verifyFindings(
      probeIdorSurface('https://example.com/user/12345/profile')
    );
    assert.equal(confirmed.length, 0);
  });
});

describe('verifier', () => {
  it('confirms a finding whose differential control fired', () => {
    const { confirmed } = verifyFindings([
      {
        class: 'sqli_error',
        title: 't',
        severity: 'critical',
        url: 'https://example.com/',
        evidence: {
          request: 'GET https://example.com/?id=1%27',
          response: 'You have an error in your SQL syntax',
          impact_demo: 'error on malicious input, absent on benign input',
          errorCorrelated: true,
        },
      },
    ]);
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
  it('confirms header findings via the default control protocol', () => {
    const { confirmed, unconfirmed } = verifyFindings([
      {
        class: 'headers',
        title: 't',
        severity: 'low',
        url: 'https://example.com/',
        evidence: {
          request: 'GET https://example.com/',
          response: 'missing strict-transport-security header',
          signalCorrelated: true,
        },
      },
    ]);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });
});

describe('probePostForms', () => {
  const realFetch = globalThis.fetch;
  const form = {
    action: 'http://example.com/submit',
    method: 'post',
    inputs: ['q'],
  };
  const teardown = () => {
    globalThis.fetch = realFetch;
  };
  it('flags error-based SQLi in a POST field via the benign/malicious differential', async () => {
    globalThis.fetch = async (_url, { body }) => {
      const v = String(body || '');
      const text = v.includes("q=1%27") || v.includes("q=1'")
        ? 'You have an error in your SQL syntax near ... MySQL'
        : '<html>ok</html>';
      return { text: async () => text };
    };
    try {
      const findings = await probePostForms([form], { timeoutMs: 5000 });
      const sqli = findings.filter((f) => f.class === 'sqli_error');
      assert.equal(sqli.length, 1);
      assert.equal(sqli[0].severity, 'critical');
      assert.ok(sqli[0].evidence.errorCorrelated);
    } finally {
      teardown();
    }
  });
  it('flags reflected XSS in a POST field when the canary echoes verbatim', async () => {
    globalThis.fetch = async (_url, { body }) => {
      const params = new URLSearchParams(String(body || ''));
      const v = params.get('q') || '';
      return { text: async () => `<html>${v}</html>` };
    };
    try {
      const findings = await probePostForms([form], { timeoutMs: 5000 });
      const xss = findings.filter((f) => f.class === 'xss_reflected');
      assert.equal(xss.length, 1);
      assert.equal(xss[0].severity, 'high');
      assert.ok(xss[0].evidence.canaryReflected);
    } finally {
      teardown();
    }
  });
  it('stays quiet when POST responses are inert', async () => {
    globalThis.fetch = async () => ({ text: async () => '<html>ok</html>' });
    try {
      const findings = await probePostForms([form], { timeoutMs: 5000 });
      assert.equal(findings.length, 0);
    } finally {
      teardown();
    }
  });
});

describe('probeBlindSqli', () => {
  const realFetch = globalThis.fetch;
  const teardown = () => {
    globalThis.fetch = realFetch;
  };
  it('flags time-based blind SQLi when the SLEEP payload adds ~5s', async () => {
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const v = u.searchParams.get('id') || '';
      if (v.includes('SLEEP')) {
        await new Promise((r) => setTimeout(r, 4500));
      }
      return { text: async () => '<html>ok</html>' };
    };
    try {
      const { probeBlindSqli } = await import('./probes/sqliBlind.js');
      const findings = await probeBlindSqli('http://example.com/?id=1', ['id'], {
        timeoutMs: 10000,
      });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].class, 'sqli_blind');
      assert.equal(findings[0].severity, 'critical');
      assert.ok(findings[0].evidence.delayTracks);
    } finally {
      teardown();
    }
  });
  it('stays quiet when SLEEP adds no delay', async () => {
    globalThis.fetch = async () => ({ text: async () => '<html>ok</html>' });
    try {
      const { probeBlindSqli } = await import('./probes/sqliBlind.js');
      const findings = await probeBlindSqli('http://example.com/?id=1', ['id'], {
        timeoutMs: 10000,
      });
      assert.equal(findings.length, 0);
    } finally {
      teardown();
    }
  });
});

describe('probeCors', () => {
  const realFetch = globalThis.fetch;
  const teardown = () => {
    globalThis.fetch = realFetch;
  };
  it('flags arbitrary origin reflection with credentials as high', async () => {
    const h = new Headers();
    h.set('Access-Control-Allow-Origin', 'https://evil-dm-probe.example');
    h.set('Access-Control-Allow-Credentials', 'true');
    globalThis.fetch = async () => ({ headers: h, text: async () => '' });
    try {
      const { probeCors } = await import('./probes/cors.js');
      const findings = await probeCors('http://example.com/', { timeoutMs: 5000 });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.equal(findings[0].class, 'cors_misconfig');
    } finally {
      teardown();
    }
  });
  it('stays quiet when no CORS headers are reflected', async () => {
    const h = new Headers();
    globalThis.fetch = async () => ({ headers: h, text: async () => '' });
    try {
      const { probeCors } = await import('./probes/cors.js');
      const findings = await probeCors('http://example.com/', { timeoutMs: 5000 });
      assert.equal(findings.length, 0);
    } finally {
      teardown();
    }
  });
});

describe('probeCookieFlags', () => {
  const realFetch = globalThis.fetch;
  const teardown = () => {
    globalThis.fetch = realFetch;
  };
  it('flags a session cookie missing Secure/HttpOnly/SameSite', async () => {
    const h = new Headers();
    h.append('set-cookie', 'sessionid=abc123; Path=/');
    globalThis.fetch = async () => ({
      headers: { ...h, getSetCookie: () => ['sessionid=abc123; Path=/'] },
      text: async () => '',
    });
    try {
      const { probeCookieFlags } = await import('./probes/cookies.js');
      const findings = await probeCookieFlags('http://example.com/', { timeoutMs: 5000 });
      assert.equal(findings.length, 1);
      assert.ok(findings[0].title.includes('Secure'));
      assert.ok(findings[0].title.includes('HttpOnly'));
    } finally {
      teardown();
    }
  });
  it('stays quiet when cookies carry all flags', async () => {
    globalThis.fetch = async () => ({
      headers: { getSetCookie: () => ['sid=x; Path=/; Secure; HttpOnly; SameSite=Lax'] },
      text: async () => '',
    });
    try {
      const { probeCookieFlags } = await import('./probes/cookies.js');
      const findings = await probeCookieFlags('http://example.com/', { timeoutMs: 5000 });
      assert.equal(findings.length, 0);
    } finally {
      teardown();
    }
  });
});

describe('iter2 probes: storedXss, weakCreds, hostHeader, csp', () => {
  const realFetch = globalThis.fetch;
  const teardown = () => {
    globalThis.fetch = realFetch;
  };

  it('storedXss confirms when the canary persists and re-renders', async () => {
    const { probeStoredXss } = await import('./probes/storedXss.js');
    const stored = [];
    globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
      if (String(method).toUpperCase() === 'POST') {
        const params = new URLSearchParams(String(body || ''));
        for (const v of params.values()) stored.push(v);
        return { text: async () => '<html>saved</html>' };
      }
      return { text: async () => `<html>guestbook: ${stored.join(' | ')}</html>` };
    };
    try {
      const forms = [{ action: 'http://example.com/guestbook', method: 'post', inputs: ['name', 'message'] }];
      const findings = await probeStoredXss(forms, 'http://example.com/', { timeoutMs: 5000 });
      const sx = findings.filter((f) => f.class === 'xss_stored');
      // both text inputs are injection points → one finding each
      assert.equal(sx.length, 2);
      assert.equal(sx[0].severity, 'high');
      assert.ok(sx[0].evidence.canaryReflected);
      const { confirmed } = verifyFindings(findings);
      assert.equal(confirmed.filter((f) => f.class === 'xss_stored').length, 2);
    } finally {
      teardown();
    }
  });

  it('storedXss stays quiet when nothing persists', async () => {
    const { probeStoredXss } = await import('./probes/storedXss.js');
    globalThis.fetch = async () => ({ text: async () => '<html>static page</html>' });
    try {
      const forms = [{ action: 'http://example.com/guestbook', method: 'post', inputs: ['name'] }];
      const findings = await probeStoredXss(forms, 'http://example.com/', { timeoutMs: 5000 });
      assert.equal(findings.length, 0);
    } finally {
      teardown();
    }
  });

  it('weakCreds confirms a login with default credentials', async () => {
    const { probeWeakCreds } = await import('./probes/weakCreds.js');
    globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
      if (String(method).toUpperCase() !== 'POST') return { text: async () => '<html><form></form></html>', headers: { get: () => null } };
      const params = new URLSearchParams(String(body || ''));
      const ok = params.get('username') === 'admin' && params.get('password') === 'admin';
      return {
        text: async () => (ok ? '<html>Welcome admin <a href="/logout">Logout</a></html>' : '<html>Login failed</html>'),
        headers: { get: () => null },
      };
    };
    try {
      const forms = [{ action: 'http://example.com/login', method: 'post', inputs: ['username', 'password', 'Login'] }];
      const findings = await probeWeakCreds(forms, { timeoutMs: 5000 });
      const wc = findings.filter((f) => f.class === 'weak_credentials');
      assert.equal(wc.length, 1);
      assert.equal(wc[0].severity, 'high');
      assert.ok(wc[0].evidence.signalCorrelated);
      const { confirmed } = verifyFindings(findings);
      assert.equal(confirmed.filter((f) => f.class === 'weak_credentials').length, 1);
    } finally {
      teardown();
    }
  });

  it('weakCreds skips non-login forms', async () => {
    const { probeWeakCreds } = await import('./probes/weakCreds.js');
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return { text: async () => '', headers: { get: () => null } };
    };
    try {
      const forms = [{ action: 'http://example.com/search', method: 'post', inputs: ['q'] }];
      const findings = await probeWeakCreds(forms, { timeoutMs: 5000 });
      assert.equal(findings.length, 0);
      assert.equal(calls, 0);
    } finally {
      teardown();
    }
  });

  it('hostHeader flags a reflected X-Forwarded-Host', async () => {
    const { probeHostHeader } = await import('./probes/hostHeader.js');
    globalThis.fetch = async (_url, { headers } = {}) => {
      const xfh = headers && (headers['X-Forwarded-Host'] || headers['X-Host']);
      return { text: async () => (xfh ? `<html>host: ${xfh}</html>` : '<html>home</html>'), headers: { get: () => null } };
    };
    try {
      const findings = await probeHostHeader('http://example.com/', { timeoutMs: 5000 });
      const hh = findings.filter((f) => f.class === 'host_header_injection');
      assert.ok(hh.length >= 1);
      assert.equal(hh[0].severity, 'medium');
      const { confirmed } = verifyFindings(findings);
      assert.ok(confirmed.some((f) => f.class === 'host_header_injection'));
    } finally {
      teardown();
    }
  });

  it('headers probe analyzes weak CSP directives', async () => {
    const csp = "script-src 'self' 'unsafe-inline'; object-src 'none'";
    const findings = probeHeaders({ url: 'http://example.com/', headers: { 'content-security-policy': csp } });
    const ids = findings.map((f) => f.id);
    assert.ok(ids.includes('csp-unsafe-inline'));
    assert.ok(ids.includes('csp-missing-frame-ancestors'));
    assert.ok(!ids.includes('csp-missing-object-src'));
    assert.ok(!ids.includes('missing-csp'));
    const { confirmed } = verifyFindings(findings);
    assert.ok(confirmed.some((f) => f.id === 'csp-unsafe-inline'));
  });

  it('headers probe stays quiet on a strict CSP', async () => {
    const csp = "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'";
    const findings = probeHeaders({ url: 'http://example.com/', headers: { 'content-security-policy': csp } });
    assert.ok(!findings.some((f) => f.class === 'csp_weak'));
  });
});

describe('iter3 probes: nosqli, ldapi, xpathi', () => {
  const realFetch = globalThis.fetch;
  const teardown = () => {
    globalThis.fetch = realFetch;
  };

  it('nosqli confirms on $ne boolean divergence', async () => {
    const { probeNoSqli } = await import('./probes/nosqli.js');
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const hasNe = [...u.searchParams.keys()].some((k) => k.includes('$ne')) ||
        [...u.searchParams.values()].some((v) => v.includes('$ne'));
      const body = hasNe
        ? `<html>${'<div class="user">admin</div>'.repeat(50)}</html>`
        : '<html>no results</html>';
      return { text: async () => body, status: 200 };
    };
    try {
      const findings = await probeNoSqli('http://example.com/search', ['q'], { timeoutMs: 5000 });
      const n = findings.filter((f) => f.class === 'nosql_injection');
      assert.equal(n.length, 1);
      assert.ok(n[0].evidence.diverged);
      const { confirmed } = verifyFindings(findings);
      assert.equal(confirmed.filter((f) => f.class === 'nosql_injection').length, 1);
    } finally {
      teardown();
    }
  });

  it('nosqli stays quiet when the operator changes nothing', async () => {
    const { probeNoSqli } = await import('./probes/nosqli.js');
    globalThis.fetch = async () => ({ text: async () => '<html>no results</html>', status: 200 });
    try {
      const findings = await probeNoSqli('http://example.com/search', ['q'], { timeoutMs: 5000 });
      assert.equal(findings.length, 0);
    } finally {
      teardown();
    }
  });

  it('ldapi confirms on filter-breakout divergence', async () => {
    const { probeLdapInjection } = await import('./probes/ldapi.js');
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const v = u.searchParams.get('user') || '';
      const body = v.includes('*') || v.includes(')(')
        ? `<html>${'<li>uid=admin</li>'.repeat(40)}</html>`
        : '<html>1 result</html>';
      return { text: async () => body, status: 200 };
    };
    try {
      const findings = await probeLdapInjection('http://example.com/users', ['user'], { timeoutMs: 5000 });
      const l = findings.filter((f) => f.class === 'ldap_injection');
      assert.equal(l.length, 1);
      assert.ok(l[0].evidence.signalCorrelated);
      const { confirmed } = verifyFindings(findings);
      assert.equal(confirmed.filter((f) => f.class === 'ldap_injection').length, 1);
    } finally {
      teardown();
    }
  });

  it('ldapi flags LDAP error text differentially', async () => {
    const { probeLdapInjection } = await import('./probes/ldapi.js');
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const v = u.searchParams.get('user') || '';
      const body = v.includes(')(')
        ? '<html>LDAP: error code 21 - Invalid DN syntax</html>'
        : '<html>ok</html>';
      return { text: async () => body, status: 200 };
    };
    try {
      const findings = await probeLdapInjection('http://example.com/users', ['user'], { timeoutMs: 5000 });
      assert.ok(findings.some((f) => f.class === 'ldap_injection' && f.id.startsWith('ldapi-error')));
    } finally {
      teardown();
    }
  });

  it('xpathi confirms on TRUE-payload divergence', async () => {
    const { probeXpathInjection } = await import('./probes/xpathi.js');
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const v = u.searchParams.get('q') || '';
      const body = v.includes(`' or '1'='1`)
        ? `<html>${'<book>secret</book>'.repeat(40)}</html>`
        : '<html>no books</html>';
      return { text: async () => body, status: 200 };
    };
    try {
      const findings = await probeXpathInjection('http://example.com/books', ['q'], { timeoutMs: 5000 });
      const x = findings.filter((f) => f.class === 'xpath_injection');
      assert.equal(x.length, 1);
      const { confirmed } = verifyFindings(findings);
      assert.equal(confirmed.filter((f) => f.class === 'xpath_injection').length, 1);
    } finally {
      teardown();
    }
  });

  it('xpathi stays quiet on inert responses', async () => {
    const { probeXpathInjection } = await import('./probes/xpathi.js');
    globalThis.fetch = async () => ({ text: async () => '<html>no books</html>', status: 200 });
    try {
      const findings = await probeXpathInjection('http://example.com/books', ['q'], { timeoutMs: 5000 });
      assert.equal(findings.length, 0);
    } finally {
      teardown();
    }
  });
});

describe('iter4 probe: ssi', () => {
  const realFetch = globalThis.fetch;
  const teardown = () => {
    globalThis.fetch = realFetch;
  };

  it('ssi confirms when the echo directive executes', async () => {
    const { probeSsiInjection } = await import('./probes/ssi.js');
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const v = u.searchParams.get('q') || '';
      const body = v.includes('#echo')
        ? '<html>Tuesday, 03-Nov-2026 21:30:00 IST</html>'
        : `<html>you said: ${v}</html>`;
      return { text: async () => body, status: 200 };
    };
    try {
      const findings = await probeSsiInjection('http://example.com/page', ['q'], { timeoutMs: 5000 });
      const s = findings.filter((f) => f.class === 'ssi_injection');
      assert.equal(s.length, 1);
      assert.equal(s[0].severity, 'high');
      const { confirmed } = verifyFindings(findings);
      assert.equal(confirmed.filter((f) => f.class === 'ssi_injection').length, 1);
    } finally {
      teardown();
    }
  });

  it('ssi stays quiet when the directive echoes back unprocessed', async () => {
    const { probeSsiInjection } = await import('./probes/ssi.js');
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const v = u.searchParams.get('q') || '';
      return { text: async () => `<html>you said: ${v}</html>`, status: 200 };
    };
    try {
      const findings = await probeSsiInjection('http://example.com/page', ['q'], { timeoutMs: 5000 });
      assert.equal(findings.length, 0);
    } finally {
      teardown();
    }
  });
});
