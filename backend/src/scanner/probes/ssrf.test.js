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
import { probeSsrf, stripReflectedUrl, fetchedMetadataMarker, ssrfBlindCanaryUrl, assessBlindSsrf } from './ssrf.js';

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

// ---- Blind SSRF leg (row #237 [High] + #311, same concept filed twice) ----
//
// The blind leg sends a collaborator canary URL as the param value and
// confirms ONLY on a collaborator hit for the probe token with no hit
// for a never-advertised control token (the ssrfReferer.js leg-1
// model). The tests drive the collaborator seam with a mock waiter:
// waitFor calls arrive probe-first, control-second, so the mock
// answers from an ordered hit list.
const LAB_PAGE = 'http://172.17.0.1:3100/fetch?url=x';
const LAB_TARGETS = '172.17.0.1';
const OOB_BASE = 'http://172.17.0.1:18099';

// A waiter mock: answers each waitFor call in order from `hits`
// (true = a hit arrived for that token, false = none).
function orderWaiter(hits) {
  let i = 0;
  return async (token, ms) => {
    const hit = hits[i++] === true;
    return hit ? { token, path: `/${token}`, method: 'GET', at: new Date().toISOString() } : null;
  };
}

// A fetch stub that records every requested URL and returns an empty
// body — the server returns nothing, so only the collaborator hit can
// confirm. The metadata leg therefore stays quiet in these tests.
function recordingFetch(seen) {
  return async (url) => {
    seen.push(String(url));
    return { status: 200, text: async () => '' };
  };
}

function blindOpts(seen, hits) {
  return {
    labTargets: LAB_TARGETS,
    oobCallback: OOB_BASE,
    oobWaitFor: orderWaiter(hits),
  };
}

test('SSRF-10: blind leg — probe hit, control silent — one high finding', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(LAB_PAGE, ['url'], blindOpts(seen, [true, false]));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'ssrf_blind');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].evidence.oobHit, true);
  // The probe canary went out as the param value.
  assert.ok(seen.some((u) => decodeURIComponent(u).includes(OOB_BASE)), 'canary URL was sent as the param value');
});

test('SSRF-11: blind leg — no probe hit — no finding', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(LAB_PAGE, ['url'], blindOpts(seen, [false, false]));
  assert.equal(findings.length, 0, 'a fetch that never arrives is not a finding');
});

test('SSRF-12: blind leg — control token also hit — no finding', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(LAB_PAGE, ['url'], blindOpts(seen, [true, true]));
  assert.equal(findings.length, 0, 'a hit for the never-advertised control means the listener is noisy, not a fetch');
});

test('SSRF-13: blind leg — non-lab target — no canary sent, no finding', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(PAGE, ['url'], blindOpts(seen, [true, false]));
  assert.equal(findings.length, 0);
  assert.equal(seen.some((u) => decodeURIComponent(u).includes(OOB_BASE)), false, 'a non-lab target never receives a callback URL');
});

test('SSRF-14: blind leg — no collaborator in opts — leg skipped, metadata leg unaffected', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  const findings = await probeSsrf(LAB_PAGE, ['url'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0, 'without the collaborator seam the leg is skipped, never guessed at');
  assert.equal(seen.some((u) => decodeURIComponent(u).includes(OOB_BASE)), false);
});

test('SSRF-15: blind leg — cap of 2 params (sqli-oob global-cap discipline)', async () => {
  const seen = [];
  globalThis.fetch = recordingFetch(seen);
  // Three URL-shaped params; both attempted params confirm.
  const findings = await probeSsrf(LAB_PAGE, ['url', 'src', 'next'], blindOpts(seen, [true, false, true, false]));
  assert.equal(findings.length, 2, 'only the first 2 params are attempted');
  const canaryUrls = seen.filter((u) => decodeURIComponent(u).includes(OOB_BASE));
  assert.equal(canaryUrls.length, 2, '2 probe canaries only — the control token is never sent, no third param');
});

test('SSRF-16: assessBlindSsrf — pure verdicts', () => {
  assert.equal(assessBlindSsrf({ probeHit: true, controlHit: false }).verdict, 'confirmed');
  assert.equal(assessBlindSsrf({ probeHit: false, controlHit: false }).verdict, 'rejected');
  assert.equal(assessBlindSsrf({ probeHit: true, controlHit: true }).verdict, 'rejected');
  assert.equal(assessBlindSsrf({ probeHit: false, controlHit: true }).verdict, 'rejected');
});

test('SSRF-17: ssrfBlindCanaryUrl — pure builder', () => {
  assert.equal(ssrfBlindCanaryUrl('http://172.17.0.1:18099/', 'dmssrf-abc'), 'http://172.17.0.1:18099/dmssrf-abc');
  assert.equal(ssrfBlindCanaryUrl('http://172.17.0.1:18099', 'dmssrf-abc'), 'http://172.17.0.1:18099/dmssrf-abc');
});
