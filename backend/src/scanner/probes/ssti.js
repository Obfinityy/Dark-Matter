// Dark Matter rule-based scanner — SSTI probe.
// Oracle: {{1336*7}} is EVALUATED to 9352 (literal absent) — the template
// engine executed our input. A literal reflection means not vulnerable.
// 9352 (not 49) is the oracle: a 2-digit result can coincide with a random
// token substring, a 4-digit product cannot — plus a per-param control
// request proves 9352 is not already on the page.
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return randomBytes(3).toString('hex');
}

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

export async function probeSsti(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    // Control: unique filler — proves the oracle token is not already on the page.
    let control;
    try {
      control = await get(withParam(url, param, `dm_${rand()}`), opts);
    } catch {
      continue;
    }
    let body;
    try {
      body = await get(withParam(url, param, '{{1336*7}}'), opts);
    } catch {
      continue;
    }
    // Fire ONLY on the evaluation differential: distinctive result present,
    // literal payload absent, result absent from the control response.
    const idx = body.indexOf('9352');
    if (idx >= 0 && !body.includes('{{1336*7}}') && !control.includes('9352')) {
      const window = body.slice(Math.max(0, idx - 60), idx + 60);
      findings.push({
        class: 'ssti',
        id: `ssti-${param}`,
        title: `Server-side template injection in parameter '${param}'`,
        severity: 'critical',
        url,
        param,
        evidence: {
          request: `GET ${withParam(url, param, '{{1336*7}}')}`,
          response: `expression evaluated to 9352 (literal {{1336*7}} absent; 9352 absent in control) — "...${window}..."`,
          impact_demo: '{{1336*7}} rendered as 9352 — the template engine executes input',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
