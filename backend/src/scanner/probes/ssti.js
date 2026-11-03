// Dark Matter rule-based scanner — SSTI probe.
// Oracle: {{7*7}} is EVALUATED to 49 (literal absent) — the template
// engine executed our input. A literal reflection means not vulnerable.
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

export async function probeSsti(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    let body;
    try {
      body = await get(withParam(url, param, '{{7*7}}'), opts.timeoutMs);
    } catch {
      continue;
    }
    if (body.includes('49') && !body.includes('{{7*7}}')) {
      findings.push({
        class: 'ssti',
        id: `ssti-${param}`,
        title: `Server-side template injection in parameter '${param}'`,
        severity: 'critical',
        url,
        param,
        evidence: {
          request: `GET ${withParam(url, param, '{{7*7}}')}`,
          response: 'expression evaluated to 49 (literal {{7*7}} absent)',
          impact_demo: '{{7*7}} rendered as 49 — the template engine executes input',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
