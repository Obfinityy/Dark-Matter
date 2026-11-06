// Dark Matter rule-based scanner — reflected XSS probe.
// Oracle: unique canary reflected UNENCODED (canaryReflected), with an
// HTML-encoded variant as the control (must not reflect raw).
import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

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


export async function probeXssReflected(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    const rand = randomBytes(4).toString('hex');
    const payload = `'"<>${`dmxss${rand}`}`;
    let body;
    try {
      body = await get(mutateUrl(url, param, payload), opts);
    } catch {
      continue;
    }
    if (!body.includes(payload)) continue;
    // Control: the HTML-encoded variant must not come back raw.
    const encoded = payload
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    let body2 = '';
    try {
      body2 = await get(mutateUrl(url, param, encoded), opts);
    } catch {
      // ignore control failure
    }
    const pIdx = body.indexOf(payload);
    const pWindow = pIdx >= 0 ? body.slice(Math.max(0, pIdx - 60), pIdx + 120) : body.slice(0, 200);
    findings.push({
      class: 'xss_reflected',
      id: `xss-reflected-${probePointName(param)}`,
      title: `Reflected XSS in parameter '${probePointParameter(param)}'`,
      severity: 'high',
      url,
      param: probePointParameter(param),
      evidence: {
        request: `GET ${mutateUrl(url, param, payload)}`,
        response: `payload reflected unencoded — "...${pWindow}..."`,
        impact_demo:
          body2.includes(encoded) && !body2.includes(payload)
            ? 'encoded variant neutralized — raw variant is the executable one'
            : 'raw payload reflected verbatim in HTML context',
        canaryReflected: true,
      },
    });
  }
  return findings;
}
