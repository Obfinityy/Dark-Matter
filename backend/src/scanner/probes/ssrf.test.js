// SSRF probe tests — Zerodha false-positive fix (9 Nov 2026).
//
// Hunt h_6b5942052353 (zerodha.com/varsity, WordPress + Cloudflare)
// confirmed a [Critical] SSRF whose only "proof" was the probe's own
// payload URL reflected in the page: the comment form echoed the
// request URL, which carries "meta-data" as a path segment, and the
// old bare-word matcher (/ami-id|instance-id|meta-data/) fired on
// it. No metadata body was ever returned.
//
// Rule under test: a finding confirms ONLY on content actually
// fetched from the metadata URL — a value-shaped marker (AMI /
// instance id value, IMDS credential JSON, role name) or the
// metadata listing itself (two or more listing fields as whole
// lines), after every reflection of the sent URL (raw and
// percent-encoded) is stripped from the response.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeSsrf, stripReflectedUrl, fetchedMetadataMarker } from './ssrf.js';

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

const PAGE = 'https://zerodha.com/varsity/wp-comments-post.php?author=dmprobe1_0f82&email=dmprobe2_a399';
const SENT = `${PAGE}&url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2F`;

// A fetch stub that echoes the requested URL the way the WordPress
// comment page did: the full request URL (percent-encoded) inside a
// hidden field, plus ordinary page text. No metadata body.
function reflectingFetch() {
  return async (url) => {
    const body =
      '<html><body><form>' +
      `<input type="hidden" name="redirect_to" value="${encodeURIComponent(String(url))}">` +
      '<p>Leave a comment below.</p>' +
      '</form></body></html>';
    return { status: 200, text: async () => body };
  };
}

test('SSRF-1: reflected payload URL (Zerodha FP) — no finding', async () => {
  globalThis.fetch = reflectingFetch();
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 0, 'echoing the request URL is not fetch proof');
});

test('SSRF-2: raw reflected URL in the body — no finding', async () => {
  globalThis.fetch = async (url) => ({
    status: 200,
    text: async () => `<html><body><p>Fetched ${String(url)} for you.</p></body></html>`,
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 0);
});

test('SSRF-3: the word "meta-data" in page prose — no finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () => '<html><body><p>Our docs explain the meta-data endpoint.</p></body></html>',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 0);
});

test('SSRF-4: a single listing field alone — no finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () => 'ami-id\n',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 0, 'one field name is docs text, not a fetch');
});

test('SSRF-5: real metadata listing echoed — one critical finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () =>
      'ami-id\nami-launch-index\nami-manifest-path\ninstance-id\ninstance-type\nlocal-ipv4\n',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'ssrf');
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].evidence.oobHit, true);
});

test('SSRF-6: real AMI id value echoed — one critical finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () => '<html><body><pre>ami-0a1b2c3d4e5f67890</pre></body></html>',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidence.oobHit, true);
});

test('SSRF-7: IMDS credential JSON echoed — one critical finding', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () =>
      '{"Code":"Success","LastUpdated":"2026-11-09T00:00:00Z","Type":"AWS-HMAC",' +
      '"AccessKeyId":"ASIAIOSFODNN7EXAMPLE","SecretAccessKey":"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",' +
      '"Token":"AQoDYXdzEJr...","Expiration":"2026-11-09T06:00:00Z"}',
  });
  const findings = await probeSsrf(PAGE, ['url'], {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidence.oobHit, true);
});

test('SSRF-8: stripReflectedUrl removes raw and encoded reflections', () => {
  const body = `before ${SENT} middle ${encodeURIComponent(SENT)} after`;
  const clean = stripReflectedUrl(body, SENT);
  assert.equal(clean.includes('meta-data'), false);
  assert.equal(clean, 'before  middle  after');
});

test('SSRF-9: fetchedMetadataMarker ignores a match inside the reflection', () => {
  const body = `<input value="${encodeURIComponent(SENT)}">`;
  assert.equal(fetchedMetadataMarker(body, SENT), null);
  const listing = 'ami-id\nami-launch-index\n';
  assert.ok(fetchedMetadataMarker(listing, SENT));
});
