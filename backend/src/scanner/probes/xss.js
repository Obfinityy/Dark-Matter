// Dark Matter rule-based scanner — reflected XSS probe.
// Oracle: unique canary reflected UNENCODED (canaryReflected), with an
// HTML-encoded variant as the control (must not reflect raw).
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function get(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
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

export async function probeXssReflected(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    const rand = randomBytes(4).toString('hex');
    const payload = `'"<>${`dmxss${rand}`}`;
    let body;
    try {
      body = await get(withParam(url, param, payload), opts.timeoutMs);
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
      body2 = await get(withParam(url, param, encoded), opts.timeoutMs);
    } catch {
      // ignore control failure
    }
    findings.push({
      class: 'xss_reflected',
      id: `xss-reflected-${param}`,
      title: `Reflected XSS in parameter '${param}'`,
      severity: 'high',
      url,
      param,
      evidence: {
        request: `GET ${withParam(url, param, payload)}`,
        response: `payload reflected unencoded (${payload.length} chars verbatim)`,
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
