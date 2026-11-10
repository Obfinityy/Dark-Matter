// SSRF via OIDC dynamic client registration probe tests (row #493
// [High] CWE-918; phase 'oauth-dynamic-registration').
//
// The fake lab mirrors the lab's /oauth/register and
// /api/admin/fetch-log endpoints. In 'vulnerable' mode registration
// performs a real server-side GET of the supplied jwks_uri/logo_uri
// (here: a real fetch against the test's own canary listener, the
// same shape as the lab fetching the scanner host) and logs it; in
// 'secure' mode it records the URLs without fetching them. The
// probe must fire only when the fetch log AND the listener agree
// that the canary was fetched.

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeOauthDynamicReg,
  assessDynamicReg,
  startCanaryListener,
  __oauthDynamicRegMeta,
} from './oauthDynamicReg.js';
import { isMetadataUrl } from './oauthShared.js';
import { verifyFindings } from '../verifier.js';

const LAB = 'http://localhost:3620';
const LAB_TARGETS = ['localhost:3620'];

function res(obj, status = 200) {
  return { status, text: async () => JSON.stringify(obj) };
}

// A real local HTTP server standing in for the probe's canary
// listener. The fake lab's "server-side fetch" is a real fetch
// against it, so a hit proves a fetch actually happened.
function startTestCanary(hits) {
  return new Promise((resolve) => {
    const server = http.createServer((req, resp) => {
      hits.push({ url: `http://127.0.0.1:${server.address().port}${req.url}` });
      resp.writeHead(200, { 'content-type': 'application/json' });
      resp.end(JSON.stringify({ keys: [] }));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        close: () =>
          new Promise((d) => {
            // Drop keep-alive connections first: plain close() waits
            // for them and the test process never exits.
            server.closeAllConnections();
            server.close(() => d());
          }),
      });
    });
  });
}

function fakeLab(mode, canaryHits) {
  const log = [];
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    if (u.pathname === '/oauth/register' && init.method === 'POST') {
      const fetched = [];
      for (const source of ['jwks_uri', 'logo_uri']) {
        if (!body[source]) continue;
        if (mode === 'vulnerable') {
          // Server-side fetch, as the lab does: a real GET. The
          // unroutable control URL fails fast without a fetch (the
          // sandbox proxy stalls ~2s on invalid.invalid, which
          // would also eat the probe's per-request timeout).
          if (new URL(body[source]).hostname === 'invalid.invalid') {
            log.push({ url: body[source], source, status: null, error: 'ENOTFOUND', bytes: 0, blocked: false });
            continue;
          }
          try {
            const r = await fetch(body[source], { signal: AbortSignal.timeout(2000) });
            await r.text().catch(() => '');
            log.push({ url: body[source], source, status: r.status, bytes: 11, blocked: false });
            fetched.push({ url: body[source], status: r.status });
          } catch (e) {
            log.push({ url: body[source], source, status: null, error: e.code || 'fetch-error', bytes: 0, blocked: false });
          }
        } else {
          log.push({ url: body[source], source, status: null, error: 'fetch-disabled', bytes: 0, blocked: false });
        }
      }
      return res({ client_id: 'cid-1', client_secret: 'cs-1', fetched }, 201);
    }
    if (u.pathname === '/api/admin/fetch-log') {
      return res({ fetches: log });
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('DR-1: assessDynamicReg confirms when log and listener agree', () => {
  const v = assessDynamicReg({
    logEntries: [{ url: 'http://127.0.0.1:9/jwks.json', status: 200, bytes: 11 }],
    listenerHits: [{ url: 'http://127.0.0.1:9/jwks.json' }],
    canaryUrls: ['http://127.0.0.1:9/jwks.json', 'http://127.0.0.1:9/logo.png'],
    controlUrl: 'http://invalid.invalid/x',
  });
  assert.equal(v.verdict, 'confirmed');
});

test('DR-2: assessDynamicReg rejects when the listener never saw the canary', () => {
  const v = assessDynamicReg({
    logEntries: [{ url: 'http://127.0.0.1:9/jwks.json', status: 200, bytes: 11 }],
    listenerHits: [],
    canaryUrls: ['http://127.0.0.1:9/jwks.json'],
    controlUrl: 'http://invalid.invalid/x',
  });
  assert.equal(v.verdict, 'rejected');
});

test('DR-3: isMetadataUrl flags only the metadata address', () => {
  assert.equal(isMetadataUrl('http://169.254.169.254/latest/meta-data/'), true);
  assert.equal(isMetadataUrl('http://172.17.0.1:3620/health'), false);
  assert.equal(isMetadataUrl('http://127.0.0.1:9/jwks.json'), false);
  assert.equal(isMetadataUrl('not a url'), false);
});

test('DR-4: startCanaryListener records hits and closes cleanly', async () => {
  const listener = await startCanaryListener();
  const r = await fetch(`http://127.0.0.1:${listener.port}/.well-known/jwks.json`);
  assert.equal(r.status, 200);
  assert.equal(listener.hits.length, 1);
  assert.equal(listener.hits[0].url, '/.well-known/jwks.json');
  await listener.close();
});

test('DR-5: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__oauthDynamicRegMeta.phases, ['oauth-dynamic-registration']);
  assert.deepEqual(__oauthDynamicRegMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('DR-6: vulnerable lab fires one high finding (log + listener agree)', async () => {
  const canaryHits = [];
  const canary = await startTestCanary(canaryHits);
  try {
    const diag = {};
    const findings = await probeOauthDynamicReg(LAB, [], {
      fetchFn: fakeLab('vulnerable', canaryHits),
      labTargets: LAB_TARGETS,
      canaryBaseUrl: `http://127.0.0.1:${canary.port}`,
      canaryHits,
      timeoutMs: 5000,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'oauth_dynamic_registration_ssrf');
    assert.equal(findings[0].severity, 'high');
    assert.equal(diag.verdict, 'confirmed');
    assert.ok(diag.listenerHits >= 1);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  } finally {
    await canary.close();
  }
});

test('DR-7: secure lab (registration fetches nothing) stays quiet', async () => {
  const canaryHits = [];
  const canary = await startTestCanary(canaryHits);
  try {
    const findings = await probeOauthDynamicReg(LAB, [], {
      fetchFn: fakeLab('secure', canaryHits),
      labTargets: LAB_TARGETS,
      canaryBaseUrl: `http://127.0.0.1:${canary.port}`,
      canaryHits,
      timeoutMs: 5000,
    });
    assert.equal(findings.length, 0);
    assert.equal(canaryHits.length, 0);
  } finally {
    await canary.close();
  }
});

test('DR-8: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeOauthDynamicReg('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});
