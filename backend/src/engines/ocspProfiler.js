/**
 * ocspProfiler.js — OCSP stapling behavior profiling.
 *
 * Takes already-collected OCSP stapling data for a host and profiles how the
 * server handles OCSP staples: presence, freshness, responder identity and
 * update cadence. CDN edges aggressively cache and refresh staples (often via
 * their own responder infrastructure), while origins frequently omit stapling
 * or serve stale responses — a useful edge-vs-origin discriminator.
 * Pure analysis: takes collected handshake/OCSP data as input, no network I/O.
 */

const HOUR_MS = 3600000;

/** Responder URL patterns associated with CDN/edge operators. */
export const EDGE_RESPONDER_PATTERNS = [
  { match: /cloudflare/i, operator: 'Cloudflare' },
  { match: /akamai/i, operator: 'Akamai' },
  { match: /fastly/i, operator: 'Fastly' },
  { match: /amazonaws|amazontrust/i, operator: 'Amazon' },
  { match: /google/i, operator: 'Google' },
  { match: /digicert/i, operator: 'DigiCert' },
  { match: /sectigo|comodo/i, operator: 'Sectigo' },
  { match: /letsencrypt|isrg/i, operator: "Let's Encrypt" },
];

/**
 * Profile OCSP stapling behavior for one endpoint.
 *
 * @param {Object} args
 * @param {boolean} args.stapled - whether the server stapled an OCSP response
 * @param {Object} [args.ocsp] - the stapled OCSP response fields:
 *   { producedAt, thisUpdate, nextUpdate, responderUrl, responseStatus }
 * @param {string} [args.certNotAfter] - leaf certificate expiry (ISO)
 * @param {string} [args.host] - hostname (for reporting only)
 * @returns {{stapling: Object, freshness: Object, responder: Object, profile: Object}}
 */
export function profileOcsp({
  stapled = false,
  ocsp = null,
  certNotAfter = null,
  host = null,
} = {}) {
  const now = Date.now();

  const stapling = {
    stapled: !!stapled,
    responsePresent: !!ocsp,
    confidence: 'high',
  };

  const freshness = { score: 0, details: [] };
  let responder = { url: null, operator: 'unknown', edgeOperated: false };

  if (stapled && ocsp) {
    const produced = ocsp.producedAt ? new Date(ocsp.producedAt).getTime() : NaN;
    const thisUpd = ocsp.thisUpdate ? new Date(ocsp.thisUpdate).getTime() : NaN;
    const nextUpd = ocsp.nextUpdate ? new Date(ocsp.nextUpdate).getTime() : NaN;

    const ageHours = Number.isFinite(produced) ? (now - produced) / HOUR_MS : null;
    freshness.ageHours = ageHours !== null ? Math.round(ageHours * 10) / 10 : null;

    if (ageHours !== null) {
      if (ageHours < 24) {
        freshness.score += 40;
        freshness.details.push('staple produced <24h ago — freshly fetched');
      } else if (ageHours < 72) {
        freshness.score += 20;
        freshness.details.push('staple 1-3 days old — acceptable');
      } else {
        freshness.details.push(`staple ${Math.round(ageHours / 24)} days old — stale cache`);
      }
    }
    if (Number.isFinite(nextUpd)) {
      if (nextUpd < now) {
        freshness.details.push('nextUpdate is in the past — response technically expired');
      } else {
        const windowHours = (nextUpd - (Number.isFinite(thisUpd) ? thisUpd : now)) / HOUR_MS;
        freshness.validityWindowHours = Math.round(windowHours * 10) / 10;
        // Short validity windows imply aggressive refresh cadence (edge-like).
        if (windowHours <= 96) {
          freshness.score += 30;
          freshness.details.push(
            `short validity window (~${Math.round(windowHours)}h) — aggressive refresh`
          );
        } else {
          freshness.score += 10;
          freshness.details.push(`long validity window (~${Math.round(windowHours / 24)}d)`);
        }
      }
    }
    if (ocsp.responseStatus && String(ocsp.responseStatus).toLowerCase() !== 'successful') {
      freshness.details.push(`OCSP responder status: ${ocsp.responseStatus}`);
      freshness.score = Math.max(freshness.score - 20, 0);
    }

    const url = String(ocsp.responderUrl || '');
    responder.url = url || null;
    for (const p of EDGE_RESPONDER_PATTERNS) {
      if (p.match.test(url)) {
        responder.operator = p.operator;
        responder.edgeOperated = true;
        freshness.score += 10;
        break;
      }
    }
  } else if (!stapled) {
    freshness.details.push(
      'no OCSP staple served — clients must fetch OCSP themselves (privacy + latency cost)'
    );
  }

  freshness.score = Math.min(Math.max(freshness.score, 0), 100);

  // Edge vs origin classification.
  let classification, confidence, evidence;
  if (stapled && freshness.score >= 60 && responder.edgeOperated) {
    classification = 'cdn-edge';
    confidence = 'high';
    evidence = `Fresh staple (score ${freshness.score}) from ${responder.operator} responder infrastructure.`;
  } else if (stapled && freshness.score >= 60) {
    classification = 'well-managed-origin';
    confidence = 'medium';
    evidence = `Fresh staple (score ${freshness.score}) — actively refreshed OCSP cache.`;
  } else if (stapled && freshness.score < 40) {
    classification = 'stale-origin';
    confidence = 'medium';
    evidence = `Stapled response is stale or long-cached (score ${freshness.score}) — likely an origin with infrequent refresh.`;
  } else {
    classification = 'no-stapling-origin';
    confidence = 'medium';
    evidence = 'Server does not staple OCSP responses — typical of origins or minimal TLS stacks.';
  }

  // Cert expiry vs nextUpdate sanity: staple should not outlive the cert.
  let expiryNote = null;
  if (ocsp && ocsp.nextUpdate && certNotAfter) {
    const nu = new Date(ocsp.nextUpdate).getTime();
    const ce = new Date(certNotAfter).getTime();
    if (Number.isFinite(nu) && Number.isFinite(ce) && nu > ce) {
      expiryNote =
        'OCSP nextUpdate is after certificate expiry — responder data looks inconsistent.';
    }
  }

  return {
    host,
    stapling,
    freshness,
    responder,
    profile: { classification, confidence, evidence, expiryNote },
  };
}

/**
 * Compare OCSP profiles across multiple endpoints (e.g. edge PoPs vs origin)
 * to detect infrastructure tiering.
 *
 * @param {Array<Object>} profiles - outputs of profileOcsp()
 * @returns {{tiered: boolean, groups: Object, note: string}}
 */
export function compareOcspProfiles(profiles = []) {
  const groups = {};
  for (const p of profiles) {
    const key = p?.profile?.classification || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p.host || 'unnamed');
  }
  const keys = Object.keys(groups);
  return {
    tiered: keys.length > 1,
    groups,
    note:
      keys.length > 1
        ? `Mixed OCSP behavior across endpoints (${keys.join(' vs ')}) — suggests tiered edge/origin infrastructure.`
        : 'Uniform OCSP behavior — single infrastructure tier.',
  };
}

export const OCSP_PROFILER = { profileOcsp, compareOcspProfiles, EDGE_RESPONDER_PATTERNS };
export default OCSP_PROFILER;
