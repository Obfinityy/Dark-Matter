// Dark Matter rule-based scanner — SSRF via Referer header probe
// (coverage row #495 [High] SSRF via Referer header fetch (+ Shellshock
// variant), CWE-918 | OWASP A10:2021; phase 'ssrf-referer').
//
// Some servers fetch the URL carried in the Referer header (link
// preview, analytics enrichment, "fetch the referring page") —
// an attacker-controlled Referer then turns into a server-side
// request. A second, related sink treats the Referer as a CGI
// environment variable, so the classic Shellshock function
// definition in Referer executes in a bash-based CGI handler.
// This probe covers both legs; each leg confirms only on its own
// differential, and the two legs are independent findings.
//
// ORACLE — leg 1 (Referer fetch):
//   The probe sends the scan target a request whose Referer points
//   at a canary URL the scanner controls (opts.oobCallback +
//   opts.oobWaitFor, the same collaborator seam sqli-oob and xxe
//   use). CONFIRM only when the canary listener records a hit for
//   the probe token AND a second request carrying a different,
//   never-advertised control token records NO hit. A fetch that
//   never arrives is not a finding — the leg stays quiet and says
//   so in diagnostics.
// ORACLE — leg 2 (Shellshock):
//   A Shellshock-shaped Referer (`() { :; }; echo <marker>`) must
//   make the marker come back in the response, reproducibly on a
//   repeat request, while a benign Referer (a plain URL) must NOT
//   return it. The marker is a fresh random value per run, so the
//   benign leg cannot contain it by coincidence.
// Both legs set evidence.oobHit — leg 1 literally (the canary was
// hit), leg 2 by the same protocol's meaning (the injected
// command's output came back out-of-band from the server's
// execution). Findings are class 'ssrf_referer' — protocolFor
// routes any class containing 'ssrf' to the ssrf protocol, judged
// on evidence.oobHit (see differential.js).
//
// GATES: leg 1 needs the collaborator (oobCallback + oobWaitFor);
// without it the leg is skipped, never guessed at. The wiring
// starts the collaborator only for lab-gated scans (allowWrite,
// the same host check as file-upload), so a non-lab target never
// receives a callback URL. Leg 2 is read-only GETs and needs no
// lab session. Findings are per leg (max 2), with distinct ids.
//
// HONEST LIMITS: leg 1 can only observe a fetch the target makes
// to the scanner's canary — a fetcher that blocks private or
// non-HTTP(S) canary URLs, or that fetches asynchronously after
// the wait window, shows no hit and the leg stays quiet. Leg 2
// only fires when the pasted URL itself behaves as a CGI endpoint;
// the probe does not mine CGI paths. No dedicated Referer-fetch
// lab exists today, so live proof needs a fixture that fetches
// Referer (or a CGI handler) first — the unit tests prove both
// oracles against local mock listeners instead. The canary is a
// local mock listener the test controls: no real internal address
// (169.254.169.254 or any intranet host) is ever targeted.
//
// UNDICI CAVEAT: Referer is a forbidden header name in the Fetch
// spec, so a browser fetch (and some fetch runtimes) silently
// drops a caller-set Referer. Node's undici DOES transmit it —
// verified against a local listener on Node v24.22.1 — but the
// probe does not depend on that: both legs send through
// rawHeaderFetch (node:http.request, shared with ssrfRouting.js),
// which transmits the header verbatim on every runtime, and the
// fetchFn seam stays for tests and injected transports.

import { randomBytes } from 'node:crypto';
import { rawHeaderFetch } from './ssrfRouting.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
// How long leg 1 waits for the canary hit (the target fetches
// asynchronously, so the window must cover a slow fetcher) and
// how long the control token gets to prove its absence.
const PROBE_WAIT_MS = 5000;
const CONTROL_WAIT_MS = 1000;
// A benign Referer: a plain URL no fetcher would treat as a
// command, and no CGI handler would execute.
const BENIGN_REFERER = 'https://example.com/';

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

function rand() {
  return randomBytes(4).toString('hex');
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * The canary URL for a probe token: the collaborator base plus the
 * token as the path, so the listener can attribute the hit. Pure.
 */
export function refererCanaryUrl(base, token) {
  return `${String(base).replace(/\/+$/, '')}/${token}`;
}

/**
 * The Shellshock-shaped Referer for a marker: a bash function
 * definition followed by an echo of the marker. The marker is a
 * fresh random value per run — never a fixed string the server
 * could echo by coincidence. Pure.
 */
export function shellshockReferer(marker) {
  return `() { :; }; echo ${marker}`;
}

/**
 * Judge leg 1: confirmed only when the probe token's canary was
 * hit and the never-advertised control token's was not. Pure.
 */
export function assessRefererFetch({ probeHit, controlHit }) {
  if (probeHit && !controlHit) {
    return {
      verdict: 'confirmed',
      reason: 'canary hit arrived for the probe Referer and none for the control Referer',
    };
  }
  if (!probeHit) {
    return { verdict: 'rejected', reason: 'no canary hit arrived for the probe Referer — the server did not fetch it' };
  }
  return {
    verdict: 'rejected',
    reason: 'control Referer was also fetched — the listener records hits the probe did not cause',
  };
}

/**
 * Judge leg 2: confirmed only when the marker echoes on the probe
 * and its repeat, and never on the benign Referer. Pure.
 */
export function assessShellshock({ probeHasMarker, repeatHasMarker, benignHasMarker }) {
  if (benignHasMarker) {
    return { verdict: 'rejected', reason: 'benign Referer also returned the marker — the marker is not command output' };
  }
  if (!probeHasMarker) {
    return { verdict: 'rejected', reason: 'Shellshock Referer did not echo the marker' };
  }
  if (!repeatHasMarker) {
    return { verdict: 'unconfirmed', reason: 'marker echo did not reproduce on repeat' };
  }
  return { verdict: 'confirmed', reason: 'Shellshock Referer executes reproducibly; benign Referer does not' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeSsrfReferer(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  if (diag) {
    diag.pointsAttempted = [];
    diag.coverageNote = 'Referer-header probe: the URL itself is the surface, not its parameters';
  }
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : rawHeaderFetch;
  const waitMs = typeof opts.waitMs === 'number' ? opts.waitMs : PROBE_WAIT_MS;
  let attempts = 0;

  // ---- Leg 1 — Referer fetch --------------------------------------------
  // Needs the collaborator seam; without it the leg is skipped,
  // never guessed at.
  const oobCallback = typeof opts.oobCallback === 'string' && opts.oobCallback ? opts.oobCallback : null;
  const oobWaitFor = typeof opts.oobWaitFor === 'function' ? opts.oobWaitFor : null;
  if (oobCallback && oobWaitFor) {
    const probeToken = `dmref-${rand()}`;
    const controlToken = `dmref-ctrl-${rand()}`;
    const probeCanary = refererCanaryUrl(oobCallback, probeToken);
    const controlCanary = refererCanaryUrl(oobCallback, controlToken);
    // The probe Referer: the target is asked to fetch the canary.
    await req(fetchFn, url, { Referer: probeCanary }, opts);
    attempts += 1;
    let probeHit = false;
    try {
      probeHit = await oobWaitFor(probeToken, waitMs);
    } catch {
      probeHit = false;
    }
    // The control Referer: a different canary URL, sent the same
    // way, must produce NO hit.
    await req(fetchFn, url, { Referer: controlCanary }, opts);
    attempts += 1;
    let controlHit = false;
    try {
      controlHit = await oobWaitFor(controlToken, CONTROL_WAIT_MS);
    } catch {
      controlHit = false;
    }
    setDiag('refererFetchProbeHit', probeHit);
    setDiag('refererFetchControlHit', controlHit);
    const judged = assessRefererFetch({ probeHit, controlHit });
    setDiag('refererFetchVerdict', judged.verdict);
    if (judged.verdict === 'confirmed') {
      setDiag('refererFetchConfirmed', true);
      findings.push({
        class: 'ssrf_referer',
        id: 'ssrf-referer-fetch',
        title: 'SSRF via Referer header — server fetches the URL in Referer',
        severity: 'high',
        url,
        param: 'Referer',
        parameter: 'Referer',
        evidence: ev(
          `GET ${url} with Referer: ${probeCanary} (control Referer: ${controlCanary})`,
          `The canary listener recorded a hit for the probe Referer token and none for the control token — the server issued a request to the URL carried in Referer. ${judged.reason}.`,
          'An attacker-controlled Referer becomes a server-side request: internal-service probing and cloud-metadata reads through the Referer header.',
        ),
      });
    }
  } else {
    setDiag('refererFetchVerdict', 'skipped-no-collaborator');
  }

  // ---- Leg 2 — Shellshock via Referer ------------------------------------
  const marker = `dmsh-${rand()}`;
  const shellshock = shellshockReferer(marker);
  const probe = await req(fetchFn, url, { Referer: shellshock }, opts);
  attempts += 1;
  const benign = await req(fetchFn, url, { Referer: BENIGN_REFERER }, opts);
  attempts += 1;
  let repeat = null;
  if (probe && probe.text.includes(marker)) {
    repeat = await req(fetchFn, url, { Referer: shellshock }, opts);
    attempts += 1;
  }
  setDiag('attempts', attempts);
  const judgedShell = assessShellshock({
    probeHasMarker: probe ? probe.text.includes(marker) : false,
    repeatHasMarker: repeat ? repeat.text.includes(marker) : false,
    benignHasMarker: benign ? benign.text.includes(marker) : false,
  });
  setDiag('shellshockVerdict', judgedShell.verdict);
  if (judgedShell.verdict === 'confirmed') {
    setDiag('shellshockConfirmed', true);
    findings.push({
      class: 'ssrf_referer',
      id: 'ssrf-referer-shellshock',
      title: 'Shellshock via Referer header — CGI handler executes the Referer as bash',
      severity: 'high',
      url,
      param: 'Referer',
      parameter: 'Referer',
      evidence: ev(
        `GET ${url} with Referer: ${shellshock} (benign Referer: ${BENIGN_REFERER})`,
        `The Shellshock-shaped Referer made the marker '${marker}' come back in the response, reproducibly on repeat, while the benign Referer never returned it. ${judgedShell.reason}.`,
        'The Referer header reaches a bash-based CGI handler as an environment variable: remote command execution through a single header.',
      ),
    });
  }
  return findings;
}

export const __ssrfRefererMeta = { phases: ['ssrf-referer'], depth: ['standard', 'deep'] };
