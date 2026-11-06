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
      redirect: 'manual',
    });
    const body = await res.text().catch(() => '');
    // Defensive header read: real fetch Headers have forEach; test stubs
    // (and some proxies) expose only get(). Never throw on header shape.
    const h = {};
    if (res.headers && typeof res.headers.forEach === 'function') {
      res.headers.forEach((v, k) => { h[k] = v; });
    } else if (res.headers && typeof res.headers.get === 'function') {
      for (const k of ['x-cache', 'x-cache-status', 'x-proxy-cache', 'cf-cache-status', 'age']) {
        const v = res.headers.get(k);
        if (v !== null && v !== undefined) h[k] = String(v);
      }
    }
    return {
      body,
      headers: h,
      cacheHit: /hit/i.test(h['x-cache'] || '') ||
        /hit/i.test(h['x-cache-status'] || '') ||
        /hit/i.test(h['x-proxy-cache'] || '') ||
        /hit/i.test(h['cf-cache-status'] || '') ||
        h.hasOwnProperty('age'),
    };
  } finally {
    clearTimeout(t);
  }
}

export async function probeCachePoisoning(url, opts = {}) {
  const findings = [];
  const rand = randomBytes(4).toString('hex');
  const canary = `evil-${rand}.example`;
  try {
    const baseline = await get(url, {}, opts);
    if (baseline.body.includes(canary)) return findings; // sanity
    // Poison attempt with the unkeyed header.
    const poisoned = await get(url, { 'X-Forwarded-Host': canary }, opts);
    if (!poisoned.body.includes(canary)) {
      // App doesn't reflect it — nothing to poison with; deception still runs.
    } else {
      // Victim: clean request, must not carry the canary.
      const victim = await get(url, {}, opts);
      if (victim.body.includes(canary)) {
        const idx = victim.body.indexOf(canary);
        const window = victim.body.slice(Math.max(0, idx - 60), idx + 80);
        const hitHeader = Object.entries(victim.headers || {}).find(([k, v]) => /hit/i.test(String(v)) || k === 'age');
        findings.push({
          class: 'cache_poisoning',
          id: 'cache-poisoning-xfh',
          title: 'Web cache poisoning via unkeyed X-Forwarded-Host header',
          severity: 'medium',
          url,
          evidence: {
            request: `GET ${url} with X-Forwarded-Host: ${canary}, then clean GET`,
            response: `canary served to the clean victim request — "...${window}..."${hitHeader ? ` (${hitHeader[0]}: ${hitHeader[1]})` : ''} — poisoned page cached`,
            impact_demo: 'attacker-controlled host value cached and served to every visitor — defacement/phishing/JS injection primitive',
            signalCorrelated: true,
          },
        });
      }
    }
  } catch {
    // Network failure — deception phase below still runs its own requests.
  }
  // Phase 2: web cache deception (#169 / #434 / #435) — path-confusion
  // variants are probed regardless of the XFH result.
  for (const f of await probeCacheDeception(url, opts)) findings.push(f);
  return findings;
}

// ---- Web cache deception (#169 / #434 / #435) -----------------------------------------------
//
// Path confusion: caches key on a normalized path/extension while the
// origin still serves the dynamic page. If a static-looking variant of a
// dynamic URL (e.g. /account/.css) is served FROM CACHE with authenticated
// content, other visitors can pull the victim's cached page: deception.
//
// Oracle (differential, per variant, two requests):
//   1. Busted: GET <variant>?dmscb=<rand> — fresh request, expected MISS.
//   2. Unbusted: GET <variant> — if explicit cache-hit headers (Age,
//      X-Cache/X-Cache-Status/X-Proxy-Cache/Cf-Cache-Status: HIT) appear on
//      the unbusted request, the cache stored and served the confused
//      variant.
// A HIT with sensitive markers (session id, CSRF token, email, logout,
// account name) in the body → 'cache_deception' HIGH (#169/#434). A HIT
// with a clean body → info 'cache_deception_surface' LOW (#435 surface).
// Deliberate sub-limit: an identical Date header alone is NOT a hit signal
// (two fresh fetches in the same second share a Date) — only explicit
// cache headers count, which makes same-second negatives honest.
//
// Read-only GET, redirect: manual, unique cache-buster per run.

const DECEPTION_VARIANTS = [
  { slug: 'semicolon-css', suffix: '/;x.css' },        // path confusion (a)
  { slug: 'dotslash-css', suffix: '/..;/x.css' },      // path confusion (a)
  { slug: 'encoded-dotslash', suffix: '/%2e%2f/x.css' }, // path confusion (a)
  { slug: 'dot-css', suffix: '/.css' },                // extension trick (b) #435
  { slug: 'png-trick', suffix: '/x.png' },             // extension trick (b) #435
  { slug: 'encoded-parent', suffix: '/%2f..%2f/x.png' }, // normalization (c)
];

// Small sensitive-content marker set for cached bodies.
const SENSITIVE_RES = [
  /csrf[_-]?token/i,
  /session[_-]?id|phpsessid|jsessionid|aspsessionid/i,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  /\blogout\b/i,
  /account[_-]?name|"username"\s*:\s*"|"email"\s*:\s*"/i,
];

const DYNAMIC_RE = /account|profile|settings|dashboard|admin|user|session|cart|checkout|order/i;

function variantUrl(url, suffix) {
  // String surgery (no WHATWG URL parse) so %2e/%2f segments are NOT
  // normalized away by the parser's dot-segment handling.
  const noFrag = url.split('#')[0];
  const qi = noFrag.indexOf('?');
  const pathPart = (qi === -1 ? noFrag : noFrag.slice(0, qi)).replace(/\/*$/, '');
  const queryPart = qi === -1 ? '' : noFrag.slice(qi);
  return pathPart + suffix + queryPart;
}

async function probeCacheDeception(url, opts = {}) {
  const findings = [];
  let u;
  try {
    u = new URL(url);
  } catch {
    return findings;
  }
  // Only dynamic-looking URLs: query params or session-ish path tokens.
  if (!u.search && !DYNAMIC_RE.test(u.pathname)) return findings;
  const rand = randomBytes(4).toString('hex');
  const variants = opts.depth === 'quick' ? DECEPTION_VARIANTS.slice(0, 2) : DECEPTION_VARIANTS;
  const hits = [];
  for (const v of variants) {
    const vurl = variantUrl(url, v.suffix);
    let r1, r2;
    try {
      r1 = await get(`${vurl}${vurl.includes('?') ? '&' : '?'}dmscb=${rand}`, {}, opts);
      r2 = await get(vurl, {}, opts);
    } catch {
      continue;
    }
    if (!r2.cacheHit) continue; // unbusted variant not cached — no deception
    const signals = ['x-cache', 'x-cache-status', 'x-proxy-cache', 'cf-cache-status', 'age']
      .filter((k) => r2.headers[k])
      .map((k) => `${k}: ${r2.headers[k]}`)
      .join(', ');
    const sensitive = SENSITIVE_RES.find((re) => re.test(r2.body));
    hits.push({ variant: v, r1, r2, signals, sensitive });
  }
  if (!hits.length) return findings;
  // One finding: the strongest hit (sensitive content first).
  hits.sort((a, b) => (b.sensitive ? 1 : 0) - (a.sensitive ? 1 : 0));
  const h = hits[0];
  const vurl = variantUrl(url, h.variant.suffix);
  if (h.sensitive) {
    const sMatch = h.r2.body.match(h.sensitive);
    const sIdx = sMatch ? h.r2.body.indexOf(sMatch[0]) : -1;
    const sWindow = sIdx >= 0 ? h.r2.body.slice(Math.max(0, sIdx - 60), sIdx + 120) : '';
    findings.push({
      class: 'cache_deception',
      id: `cache-deception-${h.variant.slug}`,
      title: `Web cache deception — cached '${h.variant.suffix}' variant exposes authenticated content`,
      severity: 'high',
      url,
      evidence: {
        request: `GET ${vurl}?dmscb=${rand} then GET ${vurl}`,
        response: `unbusted variant served from cache (${h.signals || 'cache-hit headers'}); cached body matched sensitive marker — "...${sWindow}..."`,
        impact_demo: 'authenticated page content cached under a static-looking URL — any visitor requesting the variant gets the victim\'s cached page',
        signalCorrelated: true,
      },
    });
  } else {
    findings.push({
      class: 'cache_deception_surface',
      id: `cache-deception-surface-${h.variant.slug}`,
      title: `Web cache deception surface — '${h.variant.suffix}' variant served from cache (no sensitive markers)`,
      severity: 'low',
      url,
      evidence: {
        request: `GET ${vurl}?dmscb=${rand} then GET ${vurl}`,
        response: `unbusted variant served from cache (${h.signals || 'cache-hit headers'}); no sensitive markers in the cached body`,
        impact_demo: 'path-confusion variant is cached — review cache-key rules before authenticated content lands in it',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
