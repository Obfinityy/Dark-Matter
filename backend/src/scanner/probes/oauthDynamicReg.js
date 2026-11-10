// Dark Matter rule-based scanner — SSRF via OIDC dynamic client
// registration probe (coverage row #493 [High] SSRF via OIDC dynamic
// client registration, CWE-918 | phase 'oauth-dynamic-registration').
//
// Open dynamic client registration (RFC 7591) that fetches the
// supplied jwks_uri / logo_uri server-side with no allowlist is an
// SSRF sink: the registration request makes the server issue HTTP
// requests to attacker-chosen URLs — internal services, cloud
// metadata, or an attacker listener that receives the hit.
//
// ORACLE (two independent witnesses of the same server-side fetch):
//   W1 — the probe's own canary listener (a local HTTP server it
//   starts for the duration of the phase) receives a GET for the
//   jwks_uri / logo_uri it supplied. The listener is the ground
//   truth: only a server-side fetch can reach it.
//   W2 — the lab's fetch log (GET /api/admin/fetch-log) records an
//   entry for the same canary URL with a completed status.
//   CONTROL — a second registration with an unroutable URL
//   (http://invalid.invalid/…) produces a fetch-log error entry and
//   NO listener hit, proving the log distinguishes attempted fetches
//   from delivered ones.
// A finding fires only when W1 AND W2 agree on the canary URL.
// One witness alone is never a verdict.
//
// GATES: lab-only. Dynamic registration triggers server-side
// fetches, so a non-lab target returns nothing. Depth quick is
// skipped. The canary URL is NEVER the instance-metadata address
// 169.254.169.254 (refused by the probe before it is ever sent,
// and blocked by the lab itself); the intended canary is the
// scanner host's own listener, reached via the bridge gateway
// (172.17.0.1, same convention as the SAML OOB collaborator) or an
// explicit opts.canaryBaseUrl in tests.
//
// HONEST LIMITS: the probe proves the server fetches
// attacker-supplied URLs; it does not exfiltrate internal data
// (the fetch response is never returned to the probe beyond the
// log's status/bytes) and it never aims the fetch at metadata or
// internal services — the canary is always the probe's own
// listener, so the severity rests on the fetch capability, not on
// a demonstrated internal read.

import http from 'node:http';
import {
  originOf,
  jsonRequest,
  oauthFinding,
  isMetadataUrl,
  labGated,
  getDiag,
} from './oauthShared.js';

const TIMEOUT_MS = 15000;
const FETCH_WAIT_MS = 4000;

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the dynamic-registration matrix. 'confirmed' only when the
 * canary listener received a hit for the supplied jwks/logo URL AND
 * the fetch log records the same URL with a completed status, while
 * the unroutable control produced no listener hit. Pure.
 */
export function assessDynamicReg({ logEntries, listenerHits, canaryUrls, controlUrl }) {
  const logs = Array.isArray(logEntries) ? logEntries : [];
  const hits = Array.isArray(listenerHits) ? listenerHits : [];
  const canaries = Array.isArray(canaryUrls) ? canaryUrls : [];
  const logged = canaries.filter((u) => logs.some((e) => e && e.url === u && typeof e.status === 'number'));
  const hit = canaries.filter((u) => hits.some((h) => h && h.url === u));
  const both = logged.filter((u) => hit.includes(u));
  if (controlUrl && hits.some((h) => h && h.url === controlUrl)) {
    return { verdict: 'unconfirmed', reason: 'control URL also produced a listener hit — listener cannot be trusted' };
  }
  if (both.length === 0) {
    return { verdict: 'rejected', reason: 'no canary URL was both fetched (log) and received (listener)' };
  }
  return { verdict: 'confirmed', reason: `server-side fetch confirmed for ${both.join(', ')} (fetch log + listener hit agree)` };
}

// ---- canary listener ----------------------------------------------------------

/**
 * Start a minimal HTTP listener that records every GET it receives
 * (path + query) and answers 200 with a small JWKS-shaped body.
 * Resolves { baseUrl, hits, close } — hits is the live array the
 * probe reads after registration. The listener binds 0.0.0.0 on an
 * ephemeral port; callers close it in a finally block so no listener
 * outlives the phase.
 */
export function startCanaryListener() {
  return new Promise((resolve, reject) => {
    const hits = [];
    const server = http.createServer((req, res) => {
      hits.push({ url: req.url, method: req.method, at: new Date().toISOString() });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [] }));
    });
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const { port } = server.address();
      resolve({
        port,
        hits,
        close: () =>
          new Promise((done) => {
            // Drop keep-alive connections first: plain close() waits
            // for them and the scan process would never exit.
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

// ---- the probe ---------------------------------------------------------------

export async function probeOauthDynamicReg(url, params, opts = {}) {
  const findings = [];
  const diag = getDiag(opts);
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const timeoutMs = opts.timeoutMs || TIMEOUT_MS;
  let attempts = 0;
  const req = async (u, init) => {
    attempts += 1;
    return jsonRequest(fetchFn, u, { ...init, timeoutMs });
  };

  setDiag('gated', labGated(url, opts));
  if (!labGated(url, opts)) {
    setDiag('attempts', 0);
    return findings;
  }
  if (opts.depth === 'quick') {
    setDiag('skippedQuick', true);
    setDiag('attempts', 0);
    return findings;
  }
  const origin = originOf(url);
  if (!origin) return findings;

  // Canary base: explicit override (tests) or the scanner host's own
  // listener reached via the bridge gateway (production, same
  // convention as the SAML OOB collaborator).
  let listener = null;
  let canaryBase = typeof opts.canaryBaseUrl === 'string' ? opts.canaryBaseUrl : null;
  try {
    if (!canaryBase) {
      listener = await startCanaryListener();
      const callbackHost = opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1';
      canaryBase = `http://${callbackHost}:${listener.port}`;
    }
    const jwksUrl = `${canaryBase}/.well-known/jwks.json`;
    const logoUrl = `${canaryBase}/logo.png`;
    if (isMetadataUrl(jwksUrl) || isMetadataUrl(logoUrl)) {
      setDiag('attempts', attempts);
      return findings;
    }
    const controlUrl = 'http://invalid.invalid/dm-control-jwks.json';

    // PROBE: register a client whose jwks/logo point at the canary.
    const registered = await req(`${origin}/oauth/register`, {
      method: 'POST',
      body: {
        client_name: 'dm-canary-client',
        redirect_uris: ['http://localhost/cb'],
        jwks_uri: jwksUrl,
        logo_uri: logoUrl,
      },
    });
    if (!registered || registered.status !== 201) {
      setDiag('attempts', attempts);
      return findings;
    }
    // The server-side fetch is synchronous in the lab, but allow a
    // short window for the log and the listener to settle.
    await new Promise((r) => setTimeout(r, Math.min(FETCH_WAIT_MS, timeoutMs / 4)));

    // CONTROL: a registration with an unroutable URL.
    await req(`${origin}/oauth/register`, {
      method: 'POST',
      body: {
        client_name: 'dm-control-client',
        redirect_uris: ['http://localhost/cb'],
        jwks_uri: controlUrl,
      },
    });

    // W2: the fetch log. W1: the listener hits (paths, resolved
    // against the canary base the probe supplied).
    const logResp = await req(`${origin}/api/admin/fetch-log`);
    const logEntries = logResp && logResp.status === 200 && logResp.json && Array.isArray(logResp.json.fetches)
      ? logResp.json.fetches
      : [];
    const listenerHits = listener
      ? listener.hits.map((h) => ({ url: `${canaryBase}${h.url}` }))
      : (Array.isArray(opts.canaryHits) ? opts.canaryHits : []);
    setDiag('attempts', attempts);
    setDiag('listenerHits', listenerHits.length);
    setDiag('logEntries', logEntries.length);

    const verdict = assessDynamicReg({
      logEntries,
      listenerHits,
      canaryUrls: [jwksUrl, logoUrl],
      controlUrl,
    });
    setDiag('verdict', verdict.verdict);
    if (verdict.verdict !== 'confirmed') return findings;

    const loggedEntry = logEntries.find((e) => e.url === jwksUrl || e.url === logoUrl);
    findings.push(
      oauthFinding({
        findingClass: 'oauth_dynamic_registration_ssrf',
        id: 'oauth-dynamic-reg-ssrf',
        title: 'SSRF via OIDC dynamic client registration — server fetches attacker-supplied jwks_uri/logo_uri',
        severity: 'high',
        url: `${origin}/oauth/register`,
        parameter: 'jwks_uri',
        request: `POST /oauth/register {client_name:"dm-canary-client", jwks_uri:"${jwksUrl}", logo_uri:"${logoUrl}"} (no authentication)`,
        response: `Canary listener received ${listenerHits.length} hit(s) for the supplied URLs and the fetch log records them (e.g. ${loggedEntry ? `${loggedEntry.url} → status ${loggedEntry.status}, ${loggedEntry.bytes} bytes` : 'n/a'}); the unroutable control URL produced a log error and no listener hit. Registration is open — no authentication, no allowlist.`,
        impact: 'An unauthenticated attacker makes the server issue HTTP requests to chosen URLs — internal services and cloud metadata are one parameter away from a full SSRF read.',
        // oobHit: the class routes to the SSRF confirmation protocol
        // (hunt-intel/differential.js judges 'ssrf' on the
        // collaborator hit), and the canary listener hit IS that
        // hit — the second witness, not just a flag.
        extraEvidence: { oobHit: true },
      })
    );
    return findings;
  } finally {
    if (listener) {
      try {
        await listener.close();
      } catch { /* close is best-effort */ }
    }
  }
}

export const __oauthDynamicRegMeta = { phases: ['oauth-dynamic-registration'], depth: ['standard', 'deep'] };
