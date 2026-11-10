// Dark Matter rule-based scanner — SSRF via routing-based Host header probe
// (coverage row #494 [High] SSRF via routing-based Host header, CWE-918 |
// OWASP A10:2021; phase 'ssrf-routing').
//
// A routing middleware that dispatches by Host header can expose an
// internal service to the outside: a request carrying the internal
// host name is routed to the admin panel instead of the public site.
// This probe brute-forces candidate Host values and watches for the
// internal admin panel's response.
//
// ORACLE (differential, three legs, all required):
//   (1) BASELINE — a normal request (no forged Host) must NOT serve
//       the admin marker. A target whose public page already carries
//       it is a public admin panel, not Host routing, and is skipped.
//   (2) PROBE + REPEAT — the same candidate Host value must serve
//       the admin marker twice in a row. One divergent response is
//       jitter, not a finding.
//   (3) NONSENSE CONTROL — a random Host value that no router could
//       know must NOT serve the marker. If it does, the panel is
//       served regardless of Host and the verdict is rejected.
// The marker is content only the internal panel serves (an "admin
// panel / admin dashboard" page); the probe never claims a finding
// from a status code or a reflected Host value alone (that is the
// host-header probe's territory, not this one).
//
// GATES: none beyond the battery itself. The probe is read-only
// GETs, needs no lab session and no write permission, and runs at
// every depth. Findings are class 'ssrf_routing' — protocolFor
// routes any class containing 'ssrf' to the ssrf protocol, judged
// on evidence.oobHit (see differential.js): the admin marker in
// the response IS the internal fetch's observable effect, so a
// confirmed finding carries oobHit: true.
//
// HONEST LIMITS: node fetch (undici) treats Host as a forbidden
// header and drops it — verified against a local listener on Node
// v24.22.1: fetch(url, { headers: { Host: 'admin.internal' } })
// arrives with Host '127.0.0.1:<port>'. The probe therefore sends
// the Host leg through rawHeaderFetch (node:http.request, which
// honours an explicit Host header) by default; the fetchFn seam
// stays for tests and for callers that inject their own transport.
// A no-differential result is "not observed", never "proven safe".
// No dedicated host-routing lab exists today, so live proof needs
// a routing-middleware fixture first — the unit tests prove the
// oracle against local mock listeners instead. The canary is a
// local mock listener the test controls: no real internal address
// (192.168.0.0/24, 169.254.169.254, localhost services) is ever
// targeted.

import { randomBytes } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_CANDIDATES = 8;

// Plausible internal host names a routing middleware might dispatch
// on. Plain host names, never real internal addresses — the probe
// never dials an internal IP; it only changes the Host header of a
// request to the already-authorized scan target.
export const DEFAULT_HOST_CANDIDATES = [
  'admin.internal',
  'internal-admin.local',
  'admin.local',
  'internal',
  'intranet',
  'admin',
  'localhost',
  'internal-admin',
];

// Content only an internal admin panel serves. The baseline
// comparison guards the match: a public page that happens to say
// "admin" never confirms, because the baseline would carry the
// same marker.
const ADMIN_MARKER_RE = /admin[ -](panel|dashboard|console)|internal admin|administrator console|admin-only/i;

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true, oobHit: true };
}

async function req(fetchFn, url, headers, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...headers, ...(opts.headers || {}) },
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- raw transport (exported: the Referer probes share it) -----------------

/**
 * Raw-socket fetch replacement for requests that must carry a
 * forbidden header. Node fetch (undici) drops the Host header
 * outright — verified against a local listener on Node v24.22.1:
 * fetch(url, { headers: { Host: 'admin.internal' } }) arrives
 * with Host '127.0.0.1:<port>'. node:http.request honours an
 * explicit Host header, so the Host leg goes through this
 * transport by default. Only string / Buffer bodies are supported
 * — the header probes send no body beyond an empty GET or a JSON
 * string — and redirects are not followed (the probes judge
 * status codes, never a redirect target). The returned shape
 * matches what the probes read from fetch: { status, ok,
 * headers (a Headers instance, so .get() works), text() }.
 * Pure transport: no probe logic lives here.
 */
export function rawHeaderFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(String(url));
    } catch (e) {
      reject(e);
      return;
    }
    const body = init.body;
    if (body != null && typeof body !== 'string' && !Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
      reject(new TypeError('rawHeaderFetch supports string/Buffer bodies only'));
      return;
    }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      u,
      { method: init.method || 'GET', headers: { ...(init.headers || {}) } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const headers = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v === undefined) continue;
            for (const val of Array.isArray(v) ? v : [v]) headers.append(k, String(val));
          }
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            headers,
            text: async () => text,
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (init.signal) {
      if (init.signal.aborted) {
        req.destroy(new Error('The operation was aborted'));
        return;
      }
      init.signal.addEventListener('abort', () => req.destroy(new Error('The operation was aborted')), {
        once: true,
      });
    }
    if (body != null) req.write(body);
    req.end();
  });
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * True when the body carries content only an internal admin panel
 * serves. Pure.
 */
export function containsAdminMarker(body) {
  return ADMIN_MARKER_RE.test(String(body || ''));
}

/**
 * Judge the routing differential. 'confirmed' only when the
 * baseline is clean, the candidate Host serves the admin marker
 * twice, and a nonsense Host does not. Pure.
 */
export function assessRoutingOracle({ baselineHasMarker, probeHasMarker, repeatHasMarker, nonsenseHasMarker }) {
  if (baselineHasMarker) {
    return {
      verdict: 'rejected',
      reason: 'baseline already serves the admin marker — the panel is public, not Host-routed',
    };
  }
  if (!probeHasMarker) {
    return { verdict: 'rejected', reason: 'candidate Host did not reach the admin panel' };
  }
  if (!repeatHasMarker) {
    return { verdict: 'unconfirmed', reason: 'admin marker did not reproduce on repeat — single divergent response is jitter' };
  }
  if (nonsenseHasMarker) {
    return { verdict: 'rejected', reason: 'nonsense Host also reached the admin panel — not Host-routed' };
  }
  return {
    verdict: 'confirmed',
    reason: 'admin panel reachable only with the candidate Host value, reproducibly',
  };
}

// ---- the probe ---------------------------------------------------------------

export async function probeSsrfRouting(url, params, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // Host-header probe: the URL itself is the surface, not its
  // parameters — record an empty attempted list plus a note so the
  // coverage extras read as "not a param probe", not a skip.
  if (diag) {
    diag.pointsAttempted = [];
    diag.coverageNote = 'Host-header probe: the URL itself is the surface, not its parameters';
  }
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : rawHeaderFetch;
  const candidates = (
    Array.isArray(opts.hostCandidates) && opts.hostCandidates.length
      ? opts.hostCandidates
      : DEFAULT_HOST_CANDIDATES
  ).slice(0, MAX_CANDIDATES);
  setDiag('candidates', candidates.length);

  // Leg 1 — baseline: the public page must not serve the marker.
  const baseline = await req(fetchFn, url, {}, opts);
  if (!baseline) return findings;
  const baselineHasMarker = containsAdminMarker(baseline.text);
  setDiag('baselineHasMarker', baselineHasMarker);
  if (baselineHasMarker) return findings;

  let attempts = 0;
  for (const candidate of candidates) {
    // Leg 2 — probe: the candidate Host must serve the marker.
    const probe = await req(fetchFn, url, { Host: candidate }, opts);
    attempts += 1;
    if (!probe) continue;
    if (!containsAdminMarker(probe.text)) continue;
    // Repeat: the marker must reproduce with the same Host.
    const repeat = await req(fetchFn, url, { Host: candidate }, opts);
    attempts += 1;
    // Leg 3 — nonsense control: an unknowable Host must not serve it.
    const nonsenseHost = `dm-nonsense-${randomBytes(3).toString('hex')}.invalid`;
    const nonsense = await req(fetchFn, url, { Host: nonsenseHost }, opts);
    attempts += 1;
    setDiag('attempts', attempts);
    const verdict = assessRoutingOracle({
      baselineHasMarker,
      probeHasMarker: containsAdminMarker(probe.text),
      repeatHasMarker: repeat ? containsAdminMarker(repeat.text) : false,
      nonsenseHasMarker: nonsense ? containsAdminMarker(nonsense.text) : false,
    });
    if (verdict.verdict !== 'confirmed') continue;
    setDiag('hostValue', candidate);
    const slug = String(candidate).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    findings.push({
      class: 'ssrf_routing',
      id: `ssrf-routing-host-${slug}`,
      title: `SSRF via routing-based Host header — internal admin panel reachable with Host '${candidate}'`,
      severity: 'high',
      url,
      param: 'Host',
      parameter: 'Host',
      evidence: ev(
        `GET ${url} with Host: ${candidate} (baseline: no forged Host; control: Host: ${nonsenseHost})`,
        `The internal admin panel answers only for Host '${candidate}' — marker served on the probe and its repeat, absent from the baseline and from the nonsense-Host control. ${verdict.reason}.`,
        'A routing middleware dispatches by Host header: an attacker who guesses the internal host name reaches the internal admin panel from the outside.',
      ),
    });
    // One confirmed Host value proves the routing flaw; further
    // candidates add no new class of finding.
    return findings;
  }
  setDiag('attempts', attempts);
  return findings;
}

export const __ssrfRoutingMeta = { phases: ['ssrf-routing'], depth: ['quick', 'standard', 'deep'] };
