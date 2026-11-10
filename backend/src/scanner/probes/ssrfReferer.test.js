// SSRF via Referer header probe tests (row #495 [High] SSRF via
// Referer header fetch (+ Shellshock variant), CWE-918; phase
// 'ssrf-referer').
//
// Leg 1 (Referer fetch) confirms only when the canary listener
// records a hit for the probe token and none for the control
// token. Leg 2 (Shellshock) confirms only when a Shellshock-shaped
// Referer echoes a fresh random marker reproducibly while a benign
// Referer never returns it. Leg 1 is exercised through the
// oobCallback/oobWaitFor collaborator seam with a fake fetch that
// simulates the target fetching the Referer URL; leg 2 is
// exercised both through that seam and against a real local
// node:http listener with NO injected fetchFn, so the default
// rawHeaderFetch transport is proven to transmit the Referer
// verbatim end to end.

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeSsrfReferer,
  refererCanaryUrl,
  shellshockReferer,
  assessRefererFetch,
  assessShellshock,
  __ssrfRefererMeta,
} from './ssrfReferer.js';
import { rawHeaderFetch } from './ssrfRouting.js';
import { verifyFindings } from '../verifier.js';

const OOB_BASE = 'http://127.0.0.1:9/collab';
const PLAIN_PAGE = '<html><body>hello</body></html>';

// Fake fetch + collaborator for leg 1. `mode` picks how the
// simulated target treats a canary Referer: 'fetch-first' (a link
// preview cached per page — only the first canary Referer is
// fetched), 'fetch-all' (every canary Referer is fetched),
// 'fetch-none' (the Referer is never fetched). The Shellshock leg
// always sees a plain page here, so it stays quiet.
function fakeFetchLeg1(mode) {
  const hits = new Set();
  let seenCanary = false;
  const fetchFn = async (url, init = {}) => {
    const ref = init.headers && init.headers.Referer;
    if (typeof ref === 'string' && ref.startsWith(OOB_BASE)) {
      const token = ref.slice(OOB_BASE.length + 1);
      if (mode === 'fetch-all' || (mode === 'fetch-first' && !seenCanary)) {
        seenCanary = true;
        hits.add(token);
      }
    }
    return { status: 200, text: async () => PLAIN_PAGE };
  };
  const oobWaitFor = async (token, ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (hits.has(token)) return true;
      await new Promise((r) => setTimeout(r, 5));
    }
    return hits.has(token);
  };
  return { fetchFn, oobWaitFor };
}

// Fake CGI fetch for leg 2. In 'cgi' mode a Shellshock-shaped
// Referer makes the marker come back as command output; in
// 'plain' mode the Referer is ignored.
function fakeFetchLeg2(mode) {
  return async (url, init = {}) => {
    const ref = (init.headers && init.headers.Referer) || '';
    if (mode === 'cgi' && ref.startsWith('() {')) {
      const marker = (ref.match(/echo\s+(\S+)/) || [])[1] || '';
      return { status: 200, text: async () => `cmd output: ${marker}` };
    }
    return { status: 200, text: async () => PLAIN_PAGE };
  };
}

// ---- pure helpers ------------------------------------------------------------

test('RF-1: refererCanaryUrl joins base and token, tolerating a trailing slash', () => {
  assert.equal(refererCanaryUrl('http://cb.example/x', 'tok1'), 'http://cb.example/x/tok1');
  assert.equal(refererCanaryUrl('http://cb.example/x/', 'tok1'), 'http://cb.example/x/tok1');
  assert.equal(refererCanaryUrl('http://cb.example/x///', 'tok1'), 'http://cb.example/x/tok1');
});

test('RF-2: shellshockReferer builds the bash function definition with the marker', () => {
  assert.equal(shellshockReferer('dmsh-abc'), '() { :; }; echo dmsh-abc');
});

test('RF-3: assessRefererFetch confirms probe-hit-only', () => {
  assert.equal(assessRefererFetch({ probeHit: true, controlHit: false }).verdict, 'confirmed');
});

test('RF-4: assessRefererFetch rejects when the probe canary was never hit', () => {
  assert.equal(assessRefererFetch({ probeHit: false, controlHit: false }).verdict, 'rejected');
});

test('RF-5: assessRefererFetch rejects when the control canary was also hit', () => {
  const v = assessRefererFetch({ probeHit: true, controlHit: true });
  assert.equal(v.verdict, 'rejected');
  assert.match(v.reason, /control/);
});

test('RF-6: assessShellshock confirms a reproducible echo the benign leg lacks', () => {
  assert.equal(
    assessShellshock({ probeHasMarker: true, repeatHasMarker: true, benignHasMarker: false }).verdict,
    'confirmed',
  );
});

test('RF-7: assessShellshock rejects a marker the benign Referer also returns', () => {
  assert.equal(
    assessShellshock({ probeHasMarker: true, repeatHasMarker: true, benignHasMarker: true }).verdict,
    'rejected',
  );
});

test('RF-8: assessShellshock rejects when the probe never echoes', () => {
  assert.equal(
    assessShellshock({ probeHasMarker: false, repeatHasMarker: false, benignHasMarker: false }).verdict,
    'rejected',
  );
});

test('RF-9: assessShellshock is unconfirmed when the echo does not reproduce', () => {
  assert.equal(
    assessShellshock({ probeHasMarker: true, repeatHasMarker: false, benignHasMarker: false }).verdict,
    'unconfirmed',
  );
});

test('RF-10: probe meta names the phase and its depths', () => {
  assert.deepEqual(__ssrfRefererMeta.phases, ['ssrf-referer']);
  assert.deepEqual(__ssrfRefererMeta.depth, ['standard', 'deep']);
});

test('RF-11: rawHeaderFetch transmits a Shellshock-shaped Referer verbatim', async () => {
  const seen = [];
  const srv = http.createServer((req, res) => {
    seen.push(req.headers.referer);
    res.end('ok');
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  try {
    await rawHeaderFetch(`http://127.0.0.1:${srv.address().port}/`, {
      headers: { Referer: '() { :; }; echo dmsh-abc123' },
    });
    assert.equal(seen[0], '() { :; }; echo dmsh-abc123');
  } finally {
    srv.close();
  }
});

// ---- leg 1: Referer fetch (collaborator seam) --------------------------------

test('RF-12: target fetching the probe Referer (and not the control) confirms leg 1', async () => {
  const { fetchFn, oobWaitFor } = fakeFetchLeg1('fetch-first');
  const diag = {};
  const findings = await probeSsrfReferer('http://example.com/page', {
    fetchFn,
    oobCallback: OOB_BASE,
    oobWaitFor,
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'ssrf_referer');
  assert.equal(findings[0].id, 'ssrf-referer-fetch');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].param, 'Referer');
  assert.equal(findings[0].evidence.oobHit, true);
  assert.equal(diag.refererFetchVerdict, 'confirmed');
  assert.equal(diag.refererFetchProbeHit, true);
  assert.equal(diag.refererFetchControlHit, false);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.filter((f) => f.id === 'ssrf-referer-fetch').length, 1);
});

test('RF-13: target never fetching the Referer stays quiet on leg 1', async () => {
  const { fetchFn, oobWaitFor } = fakeFetchLeg1('fetch-none');
  const findings = await probeSsrfReferer('http://example.com/page', {
    fetchFn,
    oobCallback: OOB_BASE,
    oobWaitFor,
  });
  assert.equal(findings.length, 0);
});

test('RF-14: target fetching every Referer stays quiet (control hit vetoes)', async () => {
  const { fetchFn, oobWaitFor } = fakeFetchLeg1('fetch-all');
  const diag = {};
  const findings = await probeSsrfReferer('http://example.com/page', {
    fetchFn,
    oobCallback: OOB_BASE,
    oobWaitFor,
    diagnostics: diag,
  });
  assert.equal(findings.length, 0);
  assert.equal(diag.refererFetchVerdict, 'rejected');
});

test('RF-15: no collaborator skips leg 1 instead of guessing', async () => {
  const diag = {};
  const findings = await probeSsrfReferer('http://example.com/page', {
    fetchFn: fakeFetchLeg2('plain'),
    diagnostics: diag,
  });
  assert.equal(findings.length, 0);
  assert.equal(diag.refererFetchVerdict, 'skipped-no-collaborator');
});

// ---- leg 2: Shellshock (fake fetch + real listener) ---------------------------

test('RF-16: CGI handler executing the Referer confirms leg 2', async () => {
  const diag = {};
  const findings = await probeSsrfReferer('http://example.com/cgi-bin/test', {
    fetchFn: fakeFetchLeg2('cgi'),
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].id, 'ssrf-referer-shellshock');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].evidence.oobHit, true);
  assert.equal(diag.shellshockVerdict, 'confirmed');
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.filter((f) => f.id === 'ssrf-referer-shellshock').length, 1);
});

test('RF-17: plain handler ignoring the Referer stays quiet on leg 2', async () => {
  const findings = await probeSsrfReferer('http://example.com/page', {
    fetchFn: fakeFetchLeg2('plain'),
  });
  assert.equal(findings.length, 0);
});

test('RF-18: Shellshock echo against a real listener confirms via the default transport', async () => {
  const referers = [];
  const srv = http.createServer((req, res) => {
    const ref = req.headers.referer || '';
    referers.push(ref);
    if (ref.startsWith('() {')) {
      const marker = (ref.match(/echo\s+(\S+)/) || [])[1] || '';
      res.end(`cmd output: ${marker}`);
      return;
    }
    res.end(PLAIN_PAGE);
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  try {
    const findings = await probeSsrfReferer(`http://127.0.0.1:${srv.address().port}/cgi-bin/test`, {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'ssrf-referer-shellshock');
    // The Shellshock Referer really crossed the wire.
    assert.ok(referers.some((r) => r.startsWith('() { :; }; echo dmsh-')));
    assert.ok(referers.includes('https://example.com/'));
  } finally {
    srv.close();
  }
});

test('RF-19: real listener that never echoes stays quiet', async () => {
  const srv = http.createServer((req, res) => res.end(PLAIN_PAGE));
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  try {
    const findings = await probeSsrfReferer(`http://127.0.0.1:${srv.address().port}/page`, {});
    assert.equal(findings.length, 0);
  } finally {
    srv.close();
  }
});

test('RF-20: network errors never crash the probe', async () => {
  const findings = await probeSsrfReferer('http://example.com/page', {
    fetchFn: async () => {
      throw new Error('network down');
    },
  });
  assert.equal(findings.length, 0);
});
