/**
 * dnsCheckerRecordSweepIntel.js — Multi-record-type propagation sweep engine.
 *
 * Implements idea-bank item 00187 (WhatsMyDNS record-type sweep): sweep every
 * DNS record type through propagation checkers and find records that are
 * visible only in some regions or only under certain record types. TXT
 * verification strings, CAA policy, stray SRV records, and region-only A
 * records are easy to miss with a single-resolver single-type lookup.
 *
 * Pure functions: the caller supplies per-type/per-resolver observation sets.
 */

/**
 * @typedef {object} RecordSweepObservation
 * @property {string} hostname
 * @property {string} type       e.g. 'A', 'AAAA', 'TXT', 'CAA', 'SRV', 'MX'
 * @property {string} region     propagation-checker region label
 * @property {string[]} values   observed record values in that region
 */

export const SWEEP_RECORD_TYPES = [
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'NS',
  'SOA',
  'CAA',
  'SRV',
  'PTR',
  'DS',
  'TLSA',
];

/**
 * Build a coverage matrix: type → region → observed-or-not.
 * @param {RecordSweepObservation[]} observations
 * @returns {{types: string[], regions: string[], matrix: Record<string, Record<string, boolean>>}}
 */
export function buildCoverageMatrix(observations) {
  const types = new Set();
  const regions = new Set();
  const present = new Set();
  for (const obs of observations ?? []) {
    const t = String(obs.type ?? '').toUpperCase();
    const r = String(obs.region ?? 'default');
    types.add(t);
    regions.add(r);
    if ((obs.values ?? []).length) present.add(`${t}|${r}`);
  }
  const matrix = {};
  for (const t of types) {
    matrix[t] = {};
    for (const r of regions) matrix[t][r] = present.has(`${t}|${r}`);
  }
  return { types: [...types].sort(), regions: [...regions].sort(), matrix };
}

/**
 * Find record types that exist in some regions but not others — these
 * "shadow records" (verification tokens, staged changes, geo-split answers)
 * are invisible to single-vantage-point recon.
 * @param {RecordSweepObservation[]} observations
 * @returns {Array<{hostname: string, type: string, visibleIn: string[], missingIn: string[], ratio: number}>}
 */
export function findRegionOnlyRecords(observations) {
  const byKey = new Map();
  for (const obs of observations ?? []) {
    const host = String(obs.hostname ?? '')
      .trim()
      .toLowerCase();
    const t = String(obs.type ?? '').toUpperCase();
    const r = String(obs.region ?? 'default');
    const key = `${host}|${t}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { hostname: host, type: t, visibleIn: new Set(), missingIn: new Set() };
      byKey.set(key, entry);
    }
    if ((obs.values ?? []).length) entry.visibleIn.add(r);
    else entry.missingIn.add(r);
  }
  const out = [];
  for (const entry of byKey.values()) {
    if (entry.visibleIn.size && entry.missingIn.size) {
      const total = entry.visibleIn.size + entry.missingIn.size;
      out.push({
        hostname: entry.hostname,
        type: entry.type,
        visibleIn: [...entry.visibleIn].sort(),
        missingIn: [...entry.missingIn].sort(),
        ratio: Math.round((entry.visibleIn.size / total) * 100) / 100,
      });
    }
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}

/**
 * Collect sensitive record values worth manual review: verification tokens
 * (proves admin-panel access at some point), SPF/DKIM records (mail infra
 * mapping), and CAA (cert issuance policy).
 * @param {RecordSweepObservation[]} observations
 * @returns {Array<{hostname: string, type: string, value: string, signal: string}>}
 */
export function collectSensitiveRecords(observations) {
  const out = [];
  for (const obs of observations ?? []) {
    const t = String(obs.type ?? '').toUpperCase();
    for (const raw of obs.values ?? []) {
      const value = String(raw);
      const host = String(obs.hostname ?? '')
        .trim()
        .toLowerCase();
      let signal = null;
      if (t === 'TXT' && /spf1/i.test(value)) signal = 'spf-policy';
      else if (
        t === 'TXT' &&
        /google-site-verification|_globalsign|digicert|_amazonses|MS=ms/i.test(value)
      )
        signal = 'domain-verification-token';
      else if (t === 'CAA') signal = 'ca-issuance-policy';
      else if (t === 'SRV') signal = 'service-endpoint';
      else if (t === 'TLSA') signal = 'dane-policy';
      if (signal) out.push({ hostname: host, type: t, value, signal });
    }
  }
  const seen = new Set();
  return out.filter(r => {
    const key = `${r.hostname}|${r.type}|${r.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Score sweep completeness per hostname (0-100): fraction of standard record
 * types probed across regions.
 * @param {RecordSweepObservation[]} observations
 * @param {string} hostname
 * @returns {number}
 */
export function sweepCompleteness(observations, hostname) {
  const host = String(hostname).trim().toLowerCase();
  const seenTypes = new Set();
  for (const obs of observations ?? []) {
    if (
      String(obs.hostname ?? '')
        .trim()
        .toLowerCase() === host
    ) {
      seenTypes.add(String(obs.type ?? '').toUpperCase());
    }
  }
  return Math.round((seenTypes.size / SWEEP_RECORD_TYPES.length) * 100);
}
