// Dark Matter rule-based scanner — open redirect probe.
// Oracle: 3xx response whose Location points at our evil host.
// redirect:'manual' so we observe the Location header instead of following it.
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function getManual(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual',
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    await res.text().catch(() => '');
    return { status: res.status, location: res.headers.get('location') };
  } finally {
    clearTimeout(t);
  }
}


export async function probeOpenRedirect(url, params, opts = {}) {
  const findings = [];
  const evil = 'https://evil.example/';
  noteAttemptedPoints(opts, params.slice(0, 10));
  for (const param of params.slice(0, 10)) {
    let r;
    try {
      r = await getManual(mutateUrl(url, param, evil), opts);
    } catch {
      continue;
    }
    if (
      r.status >= 300 &&
      r.status < 400 &&
      r.location &&
      r.location.includes('evil.example')
    ) {
      findings.push({
        class: 'open_redirect',
        id: `open-redirect-${probePointName(param)}`,
        title: `Open redirect in parameter '${probePointParameter(param)}'`,
        severity: 'medium',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${mutateUrl(url, param, evil)}`,
          response: `HTTP ${r.status} with Location: ${r.location}`,
          impact_demo: 'attacker-controlled external redirect (phishing)',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
