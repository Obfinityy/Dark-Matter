// Dark Matter rule-based scanner — Host-header injection probe.
//
// Sends a canary Host plus X-Forwarded-Host / X-Host variants and flags the
// target when the canary host is reflected in the response body or the
// Location header. Reflected host headers feed password-reset poisoning,
// cache poisoning and redirect abuse.
//
// Differential: the canary is freshly random, so the baseline (normal Host)
// cannot contain it — reflection proves the header is trusted.
// class 'host_header_injection' → default protocol → signalCorrelated=true.
//
// NOTE: fetch (undici) treats `Host` as a forbidden header and drops it, so
// the X-Forwarded-Host / X-Host variants carry the real signal; the Host
// attempt is kept for runtimes that honour it.
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
    return { body, location: res.headers.get('location') || '' };
  } finally {
    clearTimeout(t);
  }
}

export async function probeHostHeader(url, opts = {}) {
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
  const variants = [
    { Host: canary },
    { 'X-Forwarded-Host': canary },
    { 'X-Host': canary },
  ];
  for (const v of variants) {
    let r;
    try {
      r = await get(url, v, opts);
    } catch {
      continue;
    }
    const headerName = Object.keys(v)[0];
    const reflectedBody = r.body.includes(canary) && !baseline.body.includes(canary);
    const reflectedLoc = r.location.includes(canary);
    if (!reflectedBody && !reflectedLoc) continue;
    const bodyIdx = reflectedBody ? r.body.indexOf(canary) : -1;
    const bodyWindow = bodyIdx >= 0 ? r.body.slice(Math.max(0, bodyIdx - 60), bodyIdx + 80) : '';
    findings.push({
      class: 'host_header_injection',
      id: `host-header-${headerName.toLowerCase().replace(/[^a-z-]/g, '')}`,
      title: `Host header injection via '${headerName}' (reflected)`,
      severity: 'medium',
      url,
      evidence: {
        request: `GET ${url} with ${headerName}: ${canary}`,
        response: reflectedBody
          ? `canary host reflected verbatim in response body — "...${bodyWindow}..."`
          : `canary host reflected in Location: ${r.location}`,
        impact_demo: 'untrusted host value feeds password-reset links, cache keys and redirects',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
