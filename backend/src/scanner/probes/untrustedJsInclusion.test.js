// Tests for the untrusted JavaScript inclusion probe
// (coverage row #98 [High], phase 79).
// No network, no lab needed — the probe inspects page HTML only.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeUntrustedJsInclusion,
  isTrustedHost,
  isTextBody,
  scriptSrcs,
} from './untrustedJsInclusion.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://lab.local/app/index.html';
const UNTRUSTED = 'https://evil-tracker.example.net/lib.js';
const UNTRUSTED2 = 'https://ads.sketchy-cdn.example.org/a.js';
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js';
const SRI_VALID = 'sha384-' + 'A'.repeat(64);

function pageWith(body) {
  return `<html><head>${body}</head><body><h1>hi</h1></body></html>`;
}

describe('isTextBody', () => {
  it('accepts a normal string', () => assert.equal(isTextBody('<html></html>'), true));
  it('rejects a body with a NUL byte (binary)', () => assert.equal(isTextBody('a\u0000b'), false));
  it('rejects non-strings', () => {
    assert.equal(isTextBody(null), false);
    assert.equal(isTextBody(undefined), false);
    assert.equal(isTextBody(42), false);
  });
});

describe('isTrustedHost', () => {
  it('trusts the page host itself', () => assert.equal(isTrustedHost('lab.local', 'lab.local'), true));
  it('does not trust a different host', () => assert.equal(isTrustedHost('evil.example.net', 'lab.local'), false));
  it('trusts cdnjs exactly', () => assert.equal(isTrustedHost('cdnjs.cloudflare.com', 'lab.local'), true));
  it('trusts jsdelivr exactly', () => assert.equal(isTrustedHost('cdn.jsdelivr.net', 'lab.local'), true));
  it('trusts unpkg exactly', () => assert.equal(isTrustedHost('unpkg.com', 'lab.local'), true));
  it('trusts a subdomain of a trusted CDN', () =>
    assert.equal(isTrustedHost('foo.cdn.jsdelivr.net', 'lab.local'), true));
  it('matches hosts case-insensitively', () =>
    assert.equal(isTrustedHost('CDNJS.CLOUDFLARE.COM', 'LAB.LOCAL'), true));
  it('does not trust a lookalike host (suffix attack)', () =>
    assert.equal(isTrustedHost('cdnjs.cloudflare.com.evil.example.net', 'lab.local'), false));
  it('returns false on empty inputs', () => {
    assert.equal(isTrustedHost('', 'lab.local'), false);
    assert.equal(isTrustedHost('lab.local', ''), false);
  });
});

describe('scriptSrcs', () => {
  it('extracts src + integrity from a script tag', () => {
    const out = scriptSrcs(pageWith(`<script src="${UNTRUSTED}" integrity="${SRI_VALID}"></script>`));
    assert.equal(out.length, 1);
    assert.equal(out[0].src, UNTRUSTED);
    assert.equal(out[0].integrity, SRI_VALID);
  });
  it('skips inline scripts (no src)', () => {
    assert.equal(scriptSrcs(pageWith('<script>var x = 1;</script>')).length, 0);
  });
  it('skips importmap scripts', () => {
    const out = scriptSrcs(pageWith('<script type="importmap" src="https://x.example.net/m.json"></script>'));
    assert.equal(out.length, 0);
  });
  it('skips data: and blob: srcs', () => {
    const out = scriptSrcs(
      pageWith('<script src="data:text/javascript,alert(1)"></script><script src="blob:https://lab.local/1"></script>')
    );
    assert.equal(out.length, 0);
  });
  it('extracts modulepreload hrefs, skips other links', () => {
    const out = scriptSrcs(
      pageWith(
        '<link rel="modulepreload" href="https://x.example.net/m.js">' +
          '<link rel="stylesheet" href="https://x.example.net/s.css">'
      )
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].src, 'https://x.example.net/m.js');
  });
  it('ignores script tags inside HTML comments', () => {
    const out = scriptSrcs(pageWith(`<!-- <script src="${UNTRUSTED}"></script> -->`));
    assert.equal(out.length, 0);
  });
  it('handles single-quoted and unquoted src', () => {
    const out = scriptSrcs(
      pageWith("<script src='https://a.example.net/1.js'></script><script src=https://b.example.net/2.js></script>")
    );
    assert.equal(out.length, 2);
  });
  it('returns [] for empty or non-string html', () => {
    assert.deepEqual(scriptSrcs(''), []);
    assert.deepEqual(scriptSrcs(null), []);
  });
});

describe('probeUntrustedJsInclusion', () => {
  it('fires on an untrusted cross-origin script without SRI (fields + verifyFindings 1/0)', () => {
    const findings = probeUntrustedJsInclusion({ url: PAGE, html: pageWith(`<script src="${UNTRUSTED}"></script>`) });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'untrusted_js_inclusion');
    assert.equal(f.severity, 'high');
    assert.ok(f.title.includes('evil-tracker.example.net'), f.title);
    assert.ok(f.evidence.request.includes(PAGE));
    assert.ok(f.evidence.response.includes(UNTRUSTED));
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });
  it('does not fire on a same-origin script', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith('<script src="http://lab.local/app/main.js"></script>'),
    });
    assert.equal(findings.length, 0);
  });
  it('does not fire on a relative src (same-origin)', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith('<script src="/app/main.js"></script><script src="lib.js"></script>'),
    });
    assert.equal(findings.length, 0);
  });
  it('does not fire on a same-host script on a different port', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith('<script src="http://lab.local:8080/app/x.js"></script>'),
    });
    assert.equal(findings.length, 0);
  });
  it('fires on a protocol-relative untrusted src', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith('<script src="//evil-tracker.example.net/lib.js"></script>'),
    });
    assert.equal(findings.length, 1);
  });
  it('does not fire on allowlisted CDNs without SRI', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith(
        `<script src="${CDN}"></script>` +
          '<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js"></script>' +
          '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>' +
          '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>' +
          '<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>' +
          '<script src="https://stackpath.bootstrapcdn.com/bootstrap/5.3.0/js/bootstrap.min.js"></script>'
      ),
    });
    assert.equal(findings.length, 0);
  });
  it('does not fire on an untrusted origin WITH a valid SRI hash', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith(`<script src="${UNTRUSTED}" integrity="${SRI_VALID}"></script>`),
    });
    assert.equal(findings.length, 0);
  });
  it('fires on an untrusted origin with a malformed integrity value', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith(`<script src="${UNTRUSTED}" integrity="not-a-hash"></script>`),
    });
    assert.equal(findings.length, 1);
  });
  it('fires on an untrusted origin with an empty integrity attribute', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith(`<script src="${UNTRUSTED}" integrity=""></script>`),
    });
    assert.equal(findings.length, 1);
  });
  it('dedupes multiple tags from the same untrusted origin to 1 finding', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith(`<script src="${UNTRUSTED}"></script><script src="https://evil-tracker.example.net/other.js"></script>`),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('evil-tracker.example.net'));
  });
  it('reports two findings for two distinct untrusted origins', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith(`<script src="${UNTRUSTED}"></script><script src="${UNTRUSTED2}"></script>`),
    });
    assert.equal(findings.length, 2);
  });
  it('fires on an untrusted modulepreload href', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith('<link rel="modulepreload" href="https://evil-tracker.example.net/m.js">'),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'untrusted_js_inclusion');
  });
  it('does not fire on a modulepreload href with valid SRI', () => {
    const findings = probeUntrustedJsInclusion({
      url: PAGE,
      html: pageWith(`<link rel="modulepreload" href="${UNTRUSTED}" integrity="${SRI_VALID}">`),
    });
    assert.equal(findings.length, 0);
  });
  it('returns [] for a binary (NUL) body', () => {
    assert.deepEqual(probeUntrustedJsInclusion({ url: PAGE, html: 'x\u0000y' }), []);
  });
  it('returns [] for empty html and for a page with no scripts', () => {
    assert.deepEqual(probeUntrustedJsInclusion({ url: PAGE, html: '' }), []);
    assert.deepEqual(probeUntrustedJsInclusion({ url: PAGE, html: '<html><body>hi</body></html>' }), []);
  });
  it('returns [] for a missing or invalid url', () => {
    assert.deepEqual(probeUntrustedJsInclusion({ url: '', html: pageWith(`<script src="${UNTRUSTED}"></script>`) }), []);
    assert.deepEqual(
      probeUntrustedJsInclusion({ url: 'not a url', html: pageWith(`<script src="${UNTRUSTED}"></script>`) }),
      []
    );
  });
  it('caps findings at 20 across many untrusted origins', () => {
    const tags = Array.from({ length: 25 }, (_, i) => `<script src="https://evil${i}.example.net/x.js"></script>`).join('');
    const findings = probeUntrustedJsInclusion({ url: PAGE, html: pageWith(tags) });
    assert.equal(findings.length, 20);
  });
});
