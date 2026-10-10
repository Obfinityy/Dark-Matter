/**
 * webhookSecurityRecon.js — Webhook delivery + API-key-channel security reconnaissance.
 *
 * Defensive analyzer functions for an authorized bug-bounty agent. Each function
 * inspects OBSERVED behavior (responses, headers, docs) of authorized targets and
 * derives a security verdict — they never send exploit payloads, never brute-force
 * anything live, and never handle real secrets beyond entropy/strength estimates.
 *
 * Covers idea-bank ideas 1161-1170:
 *  1161 evaluateSignatureVerification — webhook receiver signature-verification posture
 *  1162 assessReplayRisk — replay/idempotency posture from repeated deliveries
 *  1163 measureTimestampTolerance — accepted timestamp-skew window analysis
 *  1164 assessSecretEntropy — webhook secret strength from documented format
 *  1165 estimateBruteForceFeasibility — offline/online guessing bands from keyspace
 *  1166 mapUrlValidation — outgoing webhook callback URL validation posture (SSRF flags)
 *  1167 mapRetryBehavior — delivery retry/backoff/hammering analysis
 *  1168 discoverKeySchemes — API-key auth placements discovered, weakest channel flagged
 *  1169 detectKeyInUrl — find keys leaked into URL query strings
 *  1170 parseAuthRealms — parse WWW-Authenticate headers, extract realms + env hints
 */

/** Ideas implemented by this module (auditable coverage). */
export const WAVE1161_COVERAGE = [1161, 1162, 1163, 1164, 1165, 1166, 1167, 1168, 1169, 1170];

/**
 * Map an idea number to the function that implements it.
 * @returns {Record<number, string>} idea number -> exported function name
 */
export function ideaFunctions() {
  return {
    1161: 'evaluateSignatureVerification',
    1162: 'assessReplayRisk',
    1163: 'measureTimestampTolerance',
    1164: 'assessSecretEntropy',
    1165: 'estimateBruteForceFeasibility',
    1166: 'mapUrlValidation',
    1167: 'mapRetryBehavior',
    1168: 'discoverKeySchemes',
    1169: 'detectKeyInUrl',
    1170: 'parseAuthRealms',
  };
}

// ---------------------------------------------------------------- 1161 ----

/**
 * Evaluate whether a webhook receiver actually verifies message signatures.
 *
 * Probe observations (from an authorized test receiver interaction):
 * @param {object} obs
 * @param {boolean} [obs.unsignedAccepted] — did the receiver accept a payload with NO signature header?
 * @param {boolean} [obs.wrongSignatureAccepted] — did it accept a payload with a forged/garbled signature?
 * @param {boolean} [obs.missingTimestampRejected] — did it reject when the timestamp field/header was missing?
 * @returns {{ verdict: 'PASS'|'WEAK'|'FAIL', findings: string[], score: number }}
 *   verdict PASS = verifies signatures; WEAK = partial; FAIL = does not verify.
 */
export function evaluateSignatureVerification({ unsignedAccepted, wrongSignatureAccepted, missingTimestampRejected } = {}) {
  const findings = [];
  let penalty = 0;

  if (unsignedAccepted === true) {
    findings.push('Receiver accepted an unsigned webhook delivery — signature verification is not enforced.');
    penalty += 50;
  } else if (unsignedAccepted === false) {
    findings.push('Receiver rejected unsigned delivery — signature verification appears enforced.');
  }

  if (wrongSignatureAccepted === true) {
    findings.push('Receiver accepted a delivery with an incorrect signature — verification is broken or decorative.');
    penalty += 40;
  } else if (wrongSignatureAccepted === false) {
    findings.push('Receiver rejected the incorrect signature — signature comparison appears functional.');
  }

  if (missingTimestampRejected === false) {
    findings.push('Receiver accepted a delivery with no timestamp — replay-timing defenses are absent.');
    penalty += 10;
  } else if (missingTimestampRejected === true) {
    findings.push('Receiver rejected missing-timestamp delivery — timestamp checks appear present.');
  }

  const observed = [unsignedAccepted, wrongSignatureAccepted, missingTimestampRejected]
    .filter((v) => typeof v === 'boolean').length;
  if (observed === 0) {
    findings.push('No signature-probe observations supplied — verdict is unknown.');
    return { verdict: 'UNKNOWN', findings, score: 0 };
  }

  const score = Math.max(0, 100 - penalty);
  const verdict = score >= 80 ? 'PASS' : score >= 40 ? 'WEAK' : 'FAIL';
  return { verdict, findings, score };
}

// ---------------------------------------------------------------- 1162 ----

/**
 * Assess replay risk from repeated-delivery observations.
 *
 * @param {object} obs
 * @param {Array<{ deliveryId: string, status: 'accepted'|'rejected'|'duplicate_ack', httpStatus?: number }>} [obs.retryHistory]
 *   — observed repeated deliveries of the same webhook event, in order.
 * @returns {{ verdict: 'IDEMPOTENT'|'REPEATS_EXECUTED'|'UNKNOWN', replayedCount: number, findings: string[] }}
 */
export function assessReplayRisk({ retryHistory = [] } = {}) {
  const findings = [];
  if (!Array.isArray(retryHistory) || retryHistory.length === 0) {
    findings.push('No repeated-delivery observations supplied — replay posture is unknown.');
    return { verdict: 'UNKNOWN', replayedCount: 0, findings };
  }

  const replayed = retryHistory.filter((r) => r.status === 'accepted');
  const deduped = retryHistory.filter((r) => r.status === 'duplicate_ack' || r.status === 'rejected');

  if (replayed.length === 0 && deduped.length > 0) {
    findings.push(
      `${deduped.length}/${retryHistory.length} repeated deliveries were deduplicated — receiver implements idempotency.`
    );
    return { verdict: 'IDEMPOTENT', replayedCount: 0, findings };
  }

  if (replayed.length > 0) {
    findings.push(
      `${replayed.length}/${retryHistory.length} repeated deliveries were re-executed — receiver lacks idempotency; ` +
      'duplicate deliveries can trigger duplicate side effects (double charge, double refund).'
    );
    return { verdict: 'REPEATS_EXECUTED', replayedCount: replayed.length, findings };
  }

  findings.push('Repeated-delivery observations were inconclusive.');
  return { verdict: 'UNKNOWN', replayedCount: 0, findings };
}

// ---------------------------------------------------------------- 1163 ----

const RECOMMENDED_SKEW_SECONDS = 300; // industry-standard 5-minute webhook tolerance window

/**
 * Measure the timestamp-tolerance window a webhook receiver accepts.
 *
 * @param {object} obs
 * @param {number[]} [obs.acceptedSkewsSeconds] — observed clock-skews (seconds, absolute) the receiver accepted.
 * @returns {{ maxAcceptedSkewSeconds: number|null, windowAnalysis: string, finding: string|null, withinRecommended: boolean }}
 */
export function measureTimestampTolerance({ acceptedSkewsSeconds = [] } = {}) {
  const skews = (Array.isArray(acceptedSkewsSeconds) ? acceptedSkewsSeconds : [])
    .map((s) => Math.abs(Number(s)))
    .filter((s) => Number.isFinite(s));

  if (skews.length === 0) {
    return {
      maxAcceptedSkewSeconds: null,
      windowAnalysis: 'No accepted-skew observations supplied — tolerance window is unknown.',
      finding: null,
      withinRecommended: false,
    };
  }

  const maxAccepted = Math.max(...skews);
  const withinRecommended = maxAccepted <= RECOMMENDED_SKEW_SECONDS;

  const windowAnalysis =
    `Receiver accepted deliveries with up to ${maxAccepted}s of timestamp skew ` +
    `(${skews.length} observation${skews.length === 1 ? '' : 's'}); ` +
    `recommended maximum is ${RECOMMENDED_SKEW_SECONDS}s.`;

  let finding = null;
  if (!withinRecommended) {
    finding =
      `Tolerance window (${maxAccepted}s) exceeds the recommended ${RECOMMENDED_SKEW_SECONDS}s — ` +
      'an attacker who captures a signed delivery has a longer replay window. Recommend tightening the skew check.';
  }

  return { maxAcceptedSkewSeconds: maxAccepted, windowAnalysis, finding, withinRecommended };
}

// ---------------------------------------------------------------- 1164 ----

/**
 * Assess webhook-signing secret strength from its observed/documented format.
 * Only estimates entropy — never the secret value itself.
 *
 * @param {object} obs
 * @param {string} [obs.secretSample] — a redacted-format sample, e.g. "whsec_XXXXXXXXXXXX" (X = unknown char).
 *   Literal alphanumerics are treated as known charset; everything else is ignored.
 * @param {string} [obs.documentedFormat] — vendor documentation text describing the secret format.
 * @returns {{ estimatedEntropyBits: number|null, strength: 'STRONG'|'MODERATE'|'WEAK'|'UNKNOWN', charsetSize: number|null, effectiveLength: number|null, notes: string[] }}
 */
export function assessSecretEntropy({ secretSample = '', documentedFormat = '' } = {}) {
  const notes = [];
  const sample = String(secretSample);
  const docs = String(documentedFormat).toLowerCase();

  // Infer charset size from the sample: count distinct characters in unknown slots.
  let charsetSize = null;
  let effectiveLength = null;

  const xSlots = (sample.match(/x/gi) || []).length;
  if (xSlots > 0) {
    const known = new Set(sample.replace(/[^a-z0-9]/gi, '').toLowerCase().split(''));
    // Heuristic charset detection from docs or sample.
    if (/base64/.test(docs) || /[a-z]/.test(sample) && /[A-Z]/.test(sample) && /[0-9]/.test(sample)) {
      charsetSize = /base64/.test(docs) ? 64 : 62;
    } else if (/hex/.test(docs) || /^[0-9a-fx]+$/i.test(sample)) {
      charsetSize = 16;
    } else if (/[0-9]/.test(sample)) {
      charsetSize = /[a-z]/i.test(sample) ? 36 : 10;
    } else {
      charsetSize = 26;
    }
    effectiveLength = xSlots;
    notes.push(`Estimated ${xSlots} unknown characters drawn from a charset of ~${charsetSize}.`);
  } else if (/(\d+)\s*[- ]?(bit|byte|char)/.test(docs)) {
    const m = docs.match(/(\d+)\s*[- ]?(bit|byte|char)/);
    const n = Number(m[1]);
    const unit = m[2];
    const bits = unit === 'bit' ? n : unit === 'byte' ? n * 8 : Math.round(n * Math.log2(62));
    notes.push(`Documented secret strength parsed from vendor docs: ~${bits} bits.`);
    return {
      estimatedEntropyBits: bits,
      strength: bits >= 128 ? 'STRONG' : bits >= 80 ? 'MODERATE' : 'WEAK',
      charsetSize: null,
      effectiveLength: null,
      notes,
    };
  }

  if (charsetSize === null || effectiveLength === null) {
    notes.push('Could not determine secret format from sample or docs — strength is unknown.');
    return { estimatedEntropyBits: null, strength: 'UNKNOWN', charsetSize: null, effectiveLength: null, notes };
  }

  const bits = Math.round(effectiveLength * Math.log2(charsetSize));
  const strength = bits >= 128 ? 'STRONG' : bits >= 80 ? 'MODERATE' : 'WEAK';
  if (strength === 'WEAK') {
    notes.push(`~${bits} bits of entropy is below the 80-bit minimum — secret is guessable; rotate to a 128-bit+ random value.`);
  } else if (strength === 'MODERATE') {
    notes.push(`~${bits} bits of entropy is acceptable but below the 128-bit recommended target.`);
  } else {
    notes.push(`~${bits} bits of entropy meets the 128-bit recommendation.`);
  }
  return { estimatedEntropyBits: bits, strength, charsetSize, effectiveLength, notes };
}

// ---------------------------------------------------------------- 1165 ----

/**
 * Estimate HMAC-secret brute-force feasibility from keyspace observations.
 * Pure arithmetic — performs no guessing and sends no traffic.
 *
 * @param {object} obs
 * @param {number} obs.charsetSize — e.g. 62 for alphanumeric, 16 for hex.
 * @param {number} obs.length — secret length in characters.
 * @returns {{ keyspace: string, bands: Array<{ scenario: string, guessesPerSecond: number, timeToExhaust: string }>, feasible: boolean, notes: string[] }}
 */
export function estimateBruteForceFeasibility({ charsetSize, length } = {}) {
  const notes = [];
  const cs = Number(charsetSize);
  const len = Number(length);

  if (!Number.isFinite(cs) || cs < 2 || !Number.isFinite(len) || len < 1) {
    notes.push('Invalid charsetSize/length — need charsetSize >= 2 and length >= 1.');
    return { keyspace: 'unknown', bands: [], feasible: false, notes };
  }

  const keyspace = Math.pow(cs, len);
  const keyspaceStr = keyspace > 1e15 ? keyspace.toExponential(2) : String(Math.round(keyspace));

  const scenarios = [
    { scenario: 'online rate-limited endpoint', guessesPerSecond: 10 },
    { scenario: 'online unthrottled endpoint', guessesPerSecond: 1e3 },
    { scenario: 'offline HMAC cracking rig', guessesPerSecond: 1e9 },
  ];

  const bands = scenarios.map(({ scenario, guessesPerSecond }) => {
    const seconds = keyspace / guessesPerSecond / 2; // expected time = half the keyspace
    return { scenario, guessesPerSecond, timeToExhaust: formatDuration(seconds) };
  });

  const feasible = keyspace / 2 / 1e9 < 86400; // exhaustible offline within a day
  notes.push(
    feasible
      ? 'Keyspace is small enough to exhaust offline within a day — secret format is too weak for HMAC signing.'
      : 'Keyspace is too large for practical brute force at any modeled rate.'
  );

  return { keyspace: keyspaceStr, bands, feasible, notes };
}

/**
 * Format a duration in seconds as a human-readable band.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'effectively never';
  if (seconds < 1) return 'under a second';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hours`;
  if (seconds < 31536000) return `${(seconds / 86400).toFixed(1)} days`;
  const years = seconds / 31536000;
  return years > 1e9 ? `${years.toExponential(1)} years` : `${Math.round(years).toLocaleString('en-GB')} years`;
}

// ---------------------------------------------------------------- 1166 ----

const PRIVATE_HOST_PATTERNS = [
  /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /\.internal$/i,
  /\.local$/i,
  /^metadata\.google/i,
];

const REDIRECTOR_PATTERNS = [
  /url=|redirect=|next=|continue=|dest=|destination=|r=|u=/i,
];

/**
 * Map outgoing-webhook callback URL validation posture from observed accept/reject decisions.
 *
 * @param {object} obs
 * @param {string[]} [obs.acceptedUrls] — callback URLs the platform accepted.
 * @param {string[]} [obs.rejectedUrls] — callback URLs the platform rejected.
 * @returns {{ posture: 'STRICT'|'PARTIAL'|'OPEN', ssrfFlags: Array<{ url: string, reason: string }>, acceptedCount: number, rejectedCount: number, findings: string[] }}
 */
export function mapUrlValidation({ acceptedUrls = [], rejectedUrls = [] } = {}) {
  const findings = [];
  const accepted = (Array.isArray(acceptedUrls) ? acceptedUrls : []).map(String);
  const rejected = (Array.isArray(rejectedUrls) ? rejectedUrls : []).map(String);

  const ssrfFlags = [];
  for (const url of accepted) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      findings.push(`Accepted URL is not parseable: ${redactUrl(url)}`);
      continue;
    }
    if (PRIVATE_HOST_PATTERNS.some((p) => p.test(host))) {
      ssrfFlags.push({ url: redactUrl(url), reason: 'Accepted callback targets a private/internal host — SSRF-adjacent risk.' });
    }
    if (!/^https:$/i.test(new URL(url).protocol)) {
      ssrfFlags.push({ url: redactUrl(url), reason: 'Accepted callback uses a non-HTTPS scheme — credential/secret transit in cleartext.' });
    }
    if (REDIRECTOR_PATTERNS.some((p) => p.test(url)) && /open-redirect/i.test(url) === false) {
      // informational only: open-redirector-looking params on accepted callbacks
      findings.push(`Accepted callback contains redirect-style parameters: ${redactUrl(url)} — verify the destination is not attacker-influenced.`);
    }
  }

  // Posture semantics: OPEN = risky callbacks accepted; STRICT = rejections
  // observed and nothing risky accepted; PARTIAL = only clean accepts observed
  // (no evidence of enforcement); UNKNOWN = no observations at all.
  const posture = ssrfFlags.length > 0 ? 'OPEN'
    : rejected.length > 0 ? 'STRICT'
    : accepted.length > 0 ? 'PARTIAL'
    : 'UNKNOWN';
  findings.unshift(
    posture === 'OPEN'
      ? `URL validation is OPEN: ${ssrfFlags.length} risky accepted callback${ssrfFlags.length === 1 ? '' : 's'}.`
      : posture === 'STRICT'
        ? `URL validation is STRICT: platform rejects bad callbacks (${rejected.length}) and no risky accepted ones were observed.`
        : posture === 'PARTIAL'
          ? 'URL validation is PARTIAL: only clean accepts observed, no rejection evidence — enforcement depth is unverified.'
          : 'No callback accept/reject observations supplied — URL validation posture is unknown.'
  );

  return { posture, ssrfFlags, acceptedCount: accepted.length, rejectedCount: rejected.length, findings };
}

/**
 * Redact a URL for safe reporting (strip credentials and long tokens from query).
 * @param {string} url
 * @returns {string}
 */
function redactUrl(url) {
  try {
    const u = new URL(String(url));
    if (u.password) u.password = '***';
    if (u.username) u.username = '***';
    for (const [k, v] of u.searchParams) {
      if (v.length > 12) u.searchParams.set(k, `${v.slice(0, 4)}…redacted`);
    }
    return u.toString();
  } catch {
    return String(url).slice(0, 120);
  }
}

// ---------------------------------------------------------------- 1167 ----

/**
 * Map webhook delivery retry behavior from observed attempts.
 *
 * @param {object} obs
 * @param {Array<{ at: string|number|Date, status: string, httpStatus?: number }>} [obs.attempts]
 *   — delivery attempts in chronological order.
 * @returns {{ attemptCount: number, backoff: 'exponential'|'constant'|'none'|'unknown', backoffSeconds: number[], hammeringWindowSeconds: number|null, findings: string[] }}
 */
export function mapRetryBehavior({ attempts = [] } = {}) {
  const findings = [];
  const list = Array.isArray(attempts) ? attempts : [];
  if (list.length === 0) {
    findings.push('No delivery attempts observed — retry behavior is unknown.');
    return { attemptCount: 0, backoff: 'unknown', backoffSeconds: [], hammeringWindowSeconds: null, findings };
  }

  const times = list.map((a) => new Date(a.at).getTime()).filter((t) => Number.isFinite(t));
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(Math.round((times[i] - times[i - 1]) / 1000));
  const backoffSeconds = gaps;

  let backoff = 'unknown';
  if (gaps.length >= 2) {
    const ratios = gaps.slice(1).map((g, i) => (gaps[i] === 0 ? 0 : g / gaps[i]));
    const growing = ratios.filter((r) => r >= 1.5).length;
    const steady = ratios.filter((r) => r >= 0.8 && r < 1.5).length;
    if (growing >= ratios.length / 2 && growing > 0) backoff = 'exponential';
    else if (steady >= ratios.length / 2) backoff = 'constant';
    else backoff = 'none';
  } else if (gaps.length === 1) {
    backoff = 'none';
  }

  const hammeringWindowSeconds = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) : null;

  findings.push(
    `Observed ${list.length} delivery attempt${list.length === 1 ? '' : 's'} ` +
    (backoffSeconds.length > 0
      ? `with retry gaps of ${backoffSeconds.join('s, ')}s — backoff pattern: ${backoff}.`
      : '— no retry gaps measurable.')
  );

  if (gaps.length >= 5) {
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap <= 10) {
      findings.push(
        `Hammering detected: average retry gap is ${avgGap.toFixed(1)}s over a ` +
        `${hammeringWindowSeconds}s window — a slow receiver could be overwhelmed; recommend exponential backoff with jitter.`
      );
    }
  }

  const statuses = list.map((a) => a.status);
  if (statuses.includes('delivered') || statuses.includes('accepted')) {
    findings.push('At least one attempt eventually succeeded — retry logic is functional.');
  }

  return { attemptCount: list.length, backoff, backoffSeconds, hammeringWindowSeconds, findings };
}

// ---------------------------------------------------------------- 1168 ----

/**
 * Discover which API-key auth schemes/placements a target accepts.
 *
 * @param {object} obs
 * @param {Array<{ placement: 'header'|'query'|'cookie'|'body'|'basic', scheme?: string, accepted: boolean }>} [obs.placements]
 *   — per-placement probe results from an authorized test.
 * @returns {{ schemes: string[], weakestChannel: string|null, findings: string[] }}
 */
export function discoverKeySchemes({ placements = [] } = {}) {
  const findings = [];
  const list = Array.isArray(placements) ? placements : [];

  const label = (p) => {
    const where = String(p.placement || 'unknown').toLowerCase();
    const scheme = String(p.scheme || '').toLowerCase();
    if (where === 'header') return scheme ? `${scheme}-header` : 'custom-header';
    if (where === 'basic') return 'basic-auth';
    return `${where}-param`;
  };

  const accepted = list.filter((p) => p.accepted === true).map(label);
  const schemes = [...new Set(accepted)];

  let weakestChannel = null;
  const WEAK_ORDER = ['query-param', 'body-param', 'cookie-param', 'basic-auth', 'custom-header', 'bearer-header'];
  for (const weak of WEAK_ORDER) {
    if (schemes.includes(weak)) {
      weakestChannel = weak;
      break;
    }
  }

  if (schemes.length === 0) {
    findings.push('No API-key placement was accepted — key auth schemes could not be discovered.');
  } else {
    findings.push(`Accepted API-key schemes: ${schemes.join(', ')}.`);
    if (weakestChannel === 'query-param') {
      findings.push('Weakest channel is the query string — keys in URLs leak into logs, proxies, and browser history. Prefer header-based auth.');
    } else if (weakestChannel === 'basic-auth') {
      findings.push('Weakest channel is HTTP Basic auth — credentials are only base64-encoded; ensure TLS is enforced.');
    }
  }

  return { schemes, weakestChannel, findings };
}

// ---------------------------------------------------------------- 1169 ----

const KEY_PARAM_NAMES = /^(api[_-]?key|apikey|key|token|access[_-]?token|secret|auth[_-]?token|client[_-]?secret|private[_-]?key)$/i;

/**
 * Scan URLs for API keys leaked into query parameters.
 * Reported values are redacted — only the first 4 characters are kept.
 *
 * @param {string[]} urls — URLs observed in traffic, logs, or docs of an authorized target.
 * @returns {Array<{ url: string, param: string, redactedUrl: string }>}
 */
export function detectKeyInUrl(urls = []) {
  const leaks = [];
  for (const raw of Array.isArray(urls) ? urls : []) {
    if (typeof raw !== 'string') continue;
    let u;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    for (const [name, value] of u.searchParams) {
      if (KEY_PARAM_NAMES.test(name) && value.length >= 8) {
        const redacted = new URL(raw);
        redacted.searchParams.set(name, `${value.slice(0, 4)}...redacted`);
        leaks.push({ url: raw, param: name, redactedUrl: redacted.toString() });
      }
    }
  }
  return leaks;
}

// ---------------------------------------------------------------- 1170 ----

const ENV_HINT_PATTERNS = [
  { pattern: /\bstaging\b/i, hint: 'staging' },
  { pattern: /\bprod(uction)?\b/i, hint: 'production' },
  { pattern: /\bdev(elopment)?\b/i, hint: 'development' },
  { pattern: /\btest(ing)?\b/i, hint: 'test' },
  { pattern: /\binternal\b/i, hint: 'internal' },
  { pattern: /\bqa\b/i, hint: 'qa' },
  { pattern: /\bsandbox\b/i, hint: 'sandbox' },
  { pattern: /\bbeta\b/i, hint: 'beta' },
  { pattern: /\benterprise\b/i, hint: 'enterprise' },
  { pattern: /\bcommunity\b/i, hint: 'community' },
  { pattern: /\bv\d+(\.\d+)*/i, hint: null }, // version hint extracted separately
];

/**
 * Parse WWW-Authenticate headers to enumerate auth realms and disclosed hints.
 *
 * @param {string[]} wwwAuthenticateHeaders — raw WWW-Authenticate header values.
 * @returns {Array<{ scheme: string, realm: string|null, envHints: string[], raw: string }>}
 */
export function parseAuthRealms(wwwAuthenticateHeaders = []) {
  const out = [];
  for (const raw of Array.isArray(wwwAuthenticateHeaders) ? wwwAuthenticateHeaders : []) {
    const header = String(raw || '').trim();
    if (!header) continue;
    const schemeMatch = header.match(/^([A-Za-z][A-Za-z0-9-]*)/);
    const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : 'unknown';
    const realmMatch = header.match(/realm\s*=\s*"([^"]*)"/i);
    const realm = realmMatch ? realmMatch[1] : null;

    const envHints = [];
    const haystack = `${realm || ''} ${header}`;
    for (const { pattern, hint } of ENV_HINT_PATTERNS) {
      const m = haystack.match(pattern);
      if (m) envHints.push(hint || m[0].toLowerCase());
    }

    out.push({ scheme, realm, envHints: [...new Set(envHints)], raw: header });
  }
  return out;
}
