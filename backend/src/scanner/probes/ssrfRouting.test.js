// SSRF via routing-based Host header probe tests (row #494 [High]
// SSRF via routing-based Host header, CWE-918; phase
// 'ssrf-routing').
//
// The probe confirms only on a three-leg differential: the public
// baseline must NOT serve the admin marker, the candidate Host
// must serve it twice, and a nonsense Host must NOT serve it.
// The tests run the probe against real local node:http listeners
// with NO injected fetchFn, so the default rawHeaderFetch
// transport is exercised end to end — a Host header dropped by
// the transport would fail the positive test outright.

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeSsrfRouting,
  containsAdminMarker,
  assessRoutingOracle,
  DEFAULT_HOST_CANDIDATES,
  rawHeaderFetch,
  __ssrfRoutingMeta,
} from './ssrfRouting.js';
import { verifyFindings } from '../verifier.js';

const PUBLIC_PAGE = '<html><body><h1>Welcome to our site</h1></body></html>';
const ADMIN_PAGE = '<html><body><h1>Admin Panel</h1><p>internal admin dashboard</p></body></html>';

// Start a mock listener on 127.0.0.1. `handler` answers every
// request; returns { url, close, hits }.
async function startServer(handler) {
  const hits = [];
  const srv = http.createServer((req, res) => {
    hits.push({ host: req.headers.host, url: req.url });
    handler(req, res);
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close(), hits };
}

function send(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html' });
  res.end(body);
}

// ---- pure helpers ------------------------------------------------------------

test('SR-1: containsAdminMarker matches admin-panel content only', () => {
  assert.equal(containsAdminMarker(ADMIN_PAGE), true);
  assert.equal(containsAdminMarker('Welcome to the administrator console'), true);
  assert.equal(containsAdminMarker(PUBLIC_PAGE), false);
  assert.equal(containsAdminMarker('contact the admin for help'), false);
  assert.equal(containsAdminMarker(''), false);
  assert.equal(containsAdminMarker(null), false);
});

test('SR-2: assessRoutingOracle confirms the full clean matrix', () => {
  const v = assessRoutingOracle({
    baselineHasMarker: false,
    probeHasMarker: true,
    repeatHasMarker: true,
    nonsenseHasMarker: false,
  });
  assert.equal(v.verdict, 'confirmed');
});

test('SR-3: assessRoutingOracle rejects a public admin panel', () => {
  const v = assessRoutingOracle({
    baselineHasMarker: true,
    probeHasMarker: true,
    repeatHasMarker: true,
    nonsenseHasMarker: false,
  });
  assert.equal(v.verdict, 'rejected');
  assert.match(v.reason, /public/);
});

test('SR-4: assessRoutingOracle rejects when the candidate Host does not route', () => {
  assert.equal(
    assessRoutingOracle({ baselineHasMarker: false, probeHasMarker: false, repeatHasMarker: false, nonsenseHasMarker: false }).verdict,
    'rejected',
  );
});

test('SR-5: assessRoutingOracle is unconfirmed when the repeat does not reproduce', () => {
  assert.equal(
    assessRoutingOracle({ baselineHasMarker: false, probeHasMarker: true, repeatHasMarker: false, nonsenseHasMarker: false }).verdict,
    'unconfirmed',
  );
});

test('SR-6: assessRoutingOracle rejects when the nonsense Host also routes', () => {
  assert.equal(
    assessRoutingOracle({ baselineHasMarker: false, probeHasMarker: true, repeatHasMarker: true, nonsenseHasMarker: true }).verdict,
    'rejected',
  );
});

test('SR-7: default candidates are plain internal host names, never real IPs', () => {
  assert.ok(DEFAULT_HOST_CANDIDATES.includes('admin.internal'));
  assert.ok(DEFAULT_HOST_CANDIDATES.length <= 8);
  for (const c of DEFAULT_HOST_CANDIDATES) {
    assert.doesNotMatch(c, /^\d+\.\d+\.\d+\.\d+$/);
    assert.doesNotMatch(c, /169\.254/);
  }
});

test('SR-8: probe meta names the phase and all depths', () => {
  assert.deepEqual(__ssrfRoutingMeta.phases, ['ssrf-routing']);
  assert.deepEqual(__ssrfRoutingMeta.depth, ['quick', 'standard', 'deep']);
});

test('SR-9: rawHeaderFetch transmits a forged Host verbatim', async () => {
  const srv = await startServer((req, res) => send(res, JSON.stringify({ host: req.headers.host })));
  try {
    const res = await rawHeaderFetch(`${srv.url}echo`, { headers: { Host: 'admin.internal' } });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(await res.text()).host, 'admin.internal');
  } finally {
    srv.close();
  }
});

test('SR-10: rawHeaderFetch rejects a non-string body instead of sending it', async () => {
  await assert.rejects(rawHeaderFetch('http://127.0.0.1:1/', { body: new FormData() }), /string\/Buffer bodies only/);
});

// ---- probe behaviour (real listeners, default transport) ---------------------

test('SR-11: Host-routed admin panel confirms', async () => {
  const srv = await startServer((req, res) => {
    send(res, req.headers.host === 'admin.internal' ? ADMIN_PAGE : PUBLIC_PAGE);
  });
  try {
    const diag = {};
    const findings = await probeSsrfRouting(srv.url, [], {
      hostCandidates: ['admin.internal'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'ssrf_routing');
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].param, 'Host');
    assert.match(findings[0].title, /admin\.internal/);
    assert.equal(findings[0].evidence.oobHit, true);
    assert.equal(findings[0].evidence.signalCorrelated, true);
    assert.equal(diag.hostValue, 'admin.internal');
    assert.equal(diag.baselineHasMarker, false);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.filter((f) => f.class === 'ssrf_routing').length, 1);
    // The forged Host really crossed the wire (not just the mock).
    assert.ok(srv.hits.some((h) => h.host === 'admin.internal'));
  } finally {
    srv.close();
  }
});

test('SR-12: public page that never routes stays quiet', async () => {
  const srv = await startServer((req, res) => send(res, PUBLIC_PAGE));
  try {
    const findings = await probeSsrfRouting(srv.url, [], { hostCandidates: ['admin.internal'] });
    assert.equal(findings.length, 0);
  } finally {
    srv.close();
  }
});

test('SR-13: baseline already serving the admin panel stays quiet', async () => {
  const srv = await startServer((req, res) => send(res, ADMIN_PAGE));
  try {
    const findings = await probeSsrfRouting(srv.url, [], { hostCandidates: ['admin.internal'] });
    assert.equal(findings.length, 0);
  } finally {
    srv.close();
  }
});

test('SR-14: panel served for any forged Host stays quiet (nonsense control)', async () => {
  const srv = await startServer((req, res) => {
    // The baseline Host (127.0.0.1) gets the public page, but ANY
    // other Host value gets the panel — so the nonsense control
    // also routes and the oracle must reject.
    send(res, String(req.headers.host || '').startsWith('127.0.0.1') ? PUBLIC_PAGE : ADMIN_PAGE);
  });
  try {
    const findings = await probeSsrfRouting(srv.url, [], { hostCandidates: ['admin.internal'] });
    assert.equal(findings.length, 0);
  } finally {
    srv.close();
  }
});

test('SR-15: marker on the first probe only stays quiet (no repeat)', async () => {
  let adminHits = 0;
  const srv = await startServer((req, res) => {
    if (req.headers.host === 'admin.internal') {
      adminHits += 1;
      send(res, adminHits === 1 ? ADMIN_PAGE : PUBLIC_PAGE);
      return;
    }
    send(res, PUBLIC_PAGE);
  });
  try {
    const findings = await probeSsrfRouting(srv.url, [], { hostCandidates: ['admin.internal'] });
    assert.equal(findings.length, 0);
  } finally {
    srv.close();
  }
});

test('SR-16: injected fetchFn seam still works', async () => {
  const fetchFn = async (url, init = {}) => {
    const host = init.headers && init.headers.Host;
    const body = host === 'admin.internal' ? ADMIN_PAGE : PUBLIC_PAGE;
    return { status: 200, text: async () => body };
  };
  const findings = await probeSsrfRouting('http://example.com/', [], {
    fetchFn,
    hostCandidates: ['admin.internal'],
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'ssrf_routing');
});

test('SR-17: network errors never crash the probe', async () => {
  const fetchFn = async () => {
    throw new Error('network down');
  };
  const findings = await probeSsrfRouting('http://example.com/', [], {
    fetchFn,
    hostCandidates: ['admin.internal'],
  });
  assert.equal(findings.length, 0);
});

test('SR-18: diagnostics record candidates and attempts', async () => {
  const srv = await startServer((req, res) => send(res, PUBLIC_PAGE));
  try {
    const diag = {};
    await probeSsrfRouting(srv.url, [], {
      hostCandidates: ['admin.internal', 'internal'],
      diagnostics: diag,
    });
    assert.equal(diag.candidates, 2);
    assert.equal(diag.attempts, 2);
    assert.equal(diag.baselineHasMarker, false);
  } finally {
    srv.close();
  }
});
