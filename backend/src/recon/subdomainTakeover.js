/**
 * Subdomain takeover detection — subzy-style fingerprint checks.
 *
 * Two stages:
 *   1. FINGERPRINT: a candidate (subdomain + its CNAME/HTTP evidence) is
 *      matched against known dangling-service fingerprints. A match means
 *      "takeover likely" — this is what the hunt uses, fully safe.
 *   2. CLAIM-CHECK (code path only, never executed against real DNS here):
 *      `claimCheck()` models the verification a human would do before
 *      reporting — re-resolve the CNAME and confirm the target no longer
 *      answers. Unit-tested with a stubbed resolver; the live DNS claim is
 *      deliberately NOT performed in this environment.
 *
 * Fingerprints are a curated subset of the public can-i-take-over-xyz list
 * (service → cname pattern + HTTP "dangling" marker).
 */

export const TAKEOVER_FINGERPRINTS = Object.freeze([
  { service: 'GitHub Pages', cname: /\.github\.io$/i, httpMarker: /There isn't a GitHub Pages site here/i, confidence: 0.9 },
  { service: 'Heroku', cname: /\.herokudns\.com$|\.herokuapp\.com$/i, httpMarker: /No such app|There's nothing here/i, confidence: 0.85 },
  { service: 'AWS S3', cname: /\.s3\.amazonaws\.com$/i, httpMarker: /NoSuchBucket|The specified bucket does not exist/i, confidence: 0.9 },
  { service: 'Azure', cname: /\.azurewebsites\.net$|\.cloudapp\.azure\.com$/i, httpMarker: /404 Web Site not found/i, confidence: 0.85 },
  { service: 'Netlify', cname: /\.netlify\.app$/i, httpMarker: /Not Found - Request ID/i, confidence: 0.85 },
  { service: 'Vercel', cname: /\.vercel\.app$/i, httpMarker: /The deployment could not be found/i, confidence: 0.85 },
  { service: 'Shopify', cname: /\.myshopify\.com$/i, httpMarker: /Sorry, this shop is currently unavailable/i, confidence: 0.9 },
  { service: 'Zendesk', cname: /\.zendesk\.com$/i, httpMarker: /Help Center Closed/i, confidence: 0.85 },
  { service: 'Fastly', cname: /\.fastly\.net$/i, httpMarker: /Fastly error: unknown domain/i, confidence: 0.8 },
  { service: 'Ghost', cname: /\.ghost\.io$/i, httpMarker: /The thing you were looking for is no longer here/i, confidence: 0.85 },
  { service: 'Tumblr', cname: /domains\.tumblr\.com$/i, httpMarker: /Whatever you were looking for doesn't currently exist/i, confidence: 0.9 },
  { service: 'WordPress.com', cname: /\.wordpress\.com$/i, httpMarker: /Do you want to register.*This domain/i, confidence: 0.85 },
  { service: 'Surge.sh', cname: /\.surge\.sh$/i, httpMarker: /project not found/i, confidence: 0.85 },
  { service: 'Bitbucket', cname: /\.bitbucket\.io$/i, httpMarker: /Repository not found/i, confidence: 0.85 },
  { service: 'Cargo Collective', cname: /cargocollective\.com$/i, httpMarker: /If you are trying to view a live site/i, confidence: 0.8 }
]);

/**
 * Match one candidate against fingerprints.
 * @param {{subdomain, cname, httpBody}} candidate
 * @returns {{matched, service, confidence, evidence} | {matched:false}}
 */
export function matchTakeoverFingerprint(candidate = {}) {
  const cname = String(candidate.cname || '');
  const body = String(candidate.httpBody || '');
  for (const fp of TAKEOVER_FINGERPRINTS) {
    if (!fp.cname.test(cname)) continue;
    const httpConfirmed = fp.httpMarker.test(body);
    return {
      matched: true,
      service: fp.service,
      httpConfirmed,
      // CNAME-only match is weaker; HTTP dangling marker raises confidence.
      confidence: httpConfirmed ? fp.confidence : Math.max(0.4, fp.confidence - 0.25),
      evidence: { cname, httpMarkerMatched: httpConfirmed, service: fp.service }
    };
  }
  return { matched: false };
}

/** Batch: candidates → takeover candidate findings (normalized). */
export function detectTakeovers(candidates = []) {
  const findings = [];
  let checked = 0;
  for (const c of candidates) {
    checked++;
    const m = matchTakeoverFingerprint(c);
    if (!m.matched) continue;
    findings.push({
      type: 'subdomain-takeover',
      title: `Subdomain takeover candidate: ${c.subdomain} → ${m.service}${m.httpConfirmed ? ' (dangling confirmed via HTTP marker)' : ' (CNAME fingerprint only)'}`,
      severity: m.httpConfirmed ? 'high' : 'medium',
      url: `https://${c.subdomain}`,
      evidence: { subdomain: c.subdomain, ...m.evidence, claimCheck: 'not-performed (safe mode)' },
      confidence: m.confidence,
      source: 'takeover-fingerprint'
    });
  }
  return { findings, checked };
}

/**
 * SAFE CLAIM-CHECK code path.
 *
 * A real claim would attempt to register the dangling resource on the
 * third-party service — that is an out-of-scope action for an autonomous
 * agent and is NOT implemented. This function implements the SAFE part:
 * re-resolve the CNAME and re-fetch HTTP; if the dangling marker is gone,
 * the candidate is marked resolved (someone else fixed or claimed it).
 *
 * `resolver` / `fetcher` are injectable so unit tests run without network.
 * Returns { status: 'still-dangling' | 'resolved' | 'inconclusive', ... }.
 */
export async function claimCheck(candidate, {
  resolver = null,   // async (hostname) → { cname } — defaults to node:dns
  fetcher = null,    // async (url) → { status, body }
  enforceLoopback = true
} = {}) {
  if (!candidate?.subdomain) throw new Error('claimCheck requires candidate.subdomain');
  const fp = TAKEOVER_FINGERPRINTS.find((f) => f.cname.test(String(candidate.cname || '')));
  if (!fp) return { status: 'inconclusive', reason: 'no fingerprint for this CNAME — nothing safe to verify' };

  const resolve = resolver || (async (host) => {
    if (enforceLoopback && !/^(127\.0\.0\.1|localhost)$/.test(host)) {
      throw new Error('claimCheck refused: non-loopback DNS in safe mode');
    }
    const dns = await import('node:dns/promises');
    const cnames = await dns.resolveCname(host).catch(() => []);
    return { cname: cnames[0] || null };
  });
  const fetchBody = fetcher || (async (url) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return { status: res.status, body: await res.text() };
  });

  try {
    const { cname } = await resolve(candidate.subdomain);
    if (!cname || !fp.cname.test(cname)) {
      return { status: 'resolved', reason: 'CNAME no longer points at the dangling service', cname };
    }
    const { body } = await fetchBody(`https://${candidate.subdomain}`);
    if (!fp.httpMarker.test(String(body))) {
      return { status: 'resolved', reason: 'dangling HTTP marker gone — resource likely claimed or removed' };
    }
    return { status: 'still-dangling', reason: 'CNAME and HTTP dangling marker both still present; reporting WITHOUT claiming', service: fp.service };
  } catch (error) {
    return { status: 'inconclusive', reason: `verification failed safely: ${error.message}` };
  }
}
