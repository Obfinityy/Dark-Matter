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
