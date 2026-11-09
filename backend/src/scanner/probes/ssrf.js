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
// URL is never confirmation. A full OOB collaborator listener is a
// documented next step.
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const URL_PARAM_RE = /^(url|uri|image|img|src|source|fetch|feed|redirect|next|callback|webhook)$/i;

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


export async function probeSsrf(url, params, opts = {}) {
  const findings = [];
  const candidates = params.filter((p) => URL_PARAM_RE.test(probePointName(p)));
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
  return findings;
}
