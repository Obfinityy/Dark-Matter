// Dark Matter rule-based scanner — web cache poisoning probe.
//
// If the cache key ignores a header the app reflects (e.g.
// X-Forwarded-Host), an attacker poisons the cached page for every later
// visitor.
//
// Oracle (differential, three steps):
//   1. Baseline: clean GET — record body, must NOT contain the canary.
//   2. Poison: GET with `X-Forwarded-Host: evil-<rand>.example`. If the app
//      reflects it, the cache may store the poisoned variant.
//   3. Victim: clean GET again (no canary header). If the canary now
//      appears, the poisoned response was served from cache: confirmed.
//
// A cache-hit signal (Age/X-Cache/Cf-Cache-Status headers) strengthens the
// verdict but is not required — the canary in a clean response IS the proof.
// class 'cache_poisoning' → default protocol → signalCorrelated=true.
// Severity: medium (high when the reflected input is script-executable,
// but this probe claims medium — the XSS layer is a separate finding).
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function get(url, headers, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...headers, ...(opts.headers || {}) },
    });
    const body = await res.text().catch(() => '');
    return {
      body,
      cacheHit: /hit/i.test(res.headers.get('x-cache') || '') ||
        /hit/i.test(res.headers.get('cf-cache-status') || '') ||
        res.headers.has('age'),
    };
  } finally {
    clearTimeout(t);
  }
}

export async function probeCachePoisoning(url, opts = {}) {
  const findings = [];
  const rand = randomBytes(4).toString('hex');
  const canary = `evil-${rand}.example`;
  let baseline;
  try {
    baseline = await get(url, {}, opts);
  } catch {
    return findings;
  }
  if (baseline.body.includes(canary)) return findings; // sanity
  // Step 2: poison attempt with the unkeyed header.
  let poisoned;
  try {
    poisoned = await get(url, { 'X-Forwarded-Host': canary }, opts);
  } catch {
    return findings;
  }
  if (!poisoned.body.includes(canary)) return findings; // app doesn't reflect it — nothing to poison with
  // Step 3: victim — clean request, must not carry the canary.
  let victim;
  try {
    victim = await get(url, {}, opts);
  } catch {
    return findings;
  }
  if (!victim.body.includes(canary)) return findings;
  findings.push({
    class: 'cache_poisoning',
    id: 'cache-poisoning-xfh',
    title: 'Web cache poisoning via unkeyed X-Forwarded-Host header',
    severity: 'medium',
    url,
    evidence: {
      request: `GET ${url} with X-Forwarded-Host: ${canary}, then clean GET`,
      response: `canary served to the clean victim request${victim.cacheHit ? ' (cache-hit headers present)' : ''} — poisoned page cached`,
      impact_demo: 'attacker-controlled host value cached and served to every visitor — defacement/phishing/JS injection primitive',
      signalCorrelated: true,
    },
  });
  return findings;
}
