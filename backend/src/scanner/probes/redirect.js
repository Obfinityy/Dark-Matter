// Dark Matter rule-based scanner — open redirect probe.
// Oracle: 3xx response whose Location points at our evil host.
// redirect:'manual' so we observe the Location header instead of following it.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function getManual(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual',
      headers: { 'User-Agent': UA },
    });
    await res.text().catch(() => '');
    return { status: res.status, location: res.headers.get('location') };
  } finally {
    clearTimeout(t);
  }
}

function withParam(url, name, value) {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}

export async function probeOpenRedirect(url, params, opts = {}) {
  const findings = [];
  const evil = 'https://evil.example/';
  for (const param of params.slice(0, 10)) {
    let r;
    try {
      r = await getManual(withParam(url, param, evil), opts.timeoutMs);
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
        id: `open-redirect-${param}`,
        title: `Open redirect in parameter '${param}'`,
        severity: 'medium',
        url,
        param,
        evidence: {
          request: `GET ${withParam(url, param, evil)}`,
          response: `HTTP ${r.status} with Location: ${r.location}`,
          impact_demo: 'attacker-controlled external redirect (phishing)',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
