// Dark Matter rule-based scanner — error-based SQLi probe with benign control.
// Oracle: DB error appears on the malicious input AND disappears on the
// benign input (errorCorrelated) — the differential control from hunt-intel.
import { detectDbFamily } from '../fingerprint.js';
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } finally {
    clearTimeout(t);
  }
}


// Error-based SQLi: inject a quote, look for a DB error signature,
// then re-request with the benign value to prove correlation.
export async function probeSqliError(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    let base;
    try {
      base = mutateUrl(url, param, '1');
    } catch {
      continue;
    }
    const benign = await get(base, opts).catch(() => null);
    const malicious = await get(mutateUrl(url, param, "1'"), opts).catch(() => null);
    if (!benign || !malicious) continue;

    const dbFamily = detectDbFamily(malicious.text);
    const benignDb = detectDbFamily(benign.text);
    if (dbFamily && !benignDb) {
      findings.push({
        class: 'sqli_error',
        id: `sqli-error-${probePointName(param)}`,
        title: `Error-based SQL injection in parameter '${probePointParameter(param)}'`,
        severity: 'critical',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${mutateUrl(url, param, "1'")}`,
          response: `DB error signature (${dbFamily}): ${malicious.text.slice(0, 200)}`,
          impact_demo: 'error present on malicious input "1\'"; absent on benign input "1"',
          errorCorrelated: true,
        },
        dbFamily,
      });
    }
  }
  return findings;
}
