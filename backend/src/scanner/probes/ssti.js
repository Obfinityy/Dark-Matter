// Dark Matter rule-based scanner — SSTI probe.
// Oracle: {{1336*7}} is EVALUATED to 9352 (literal absent) — the template
// engine executed our input. A literal reflection means not vulnerable.
// 9352 (not 49) is the oracle: a 2-digit result can coincide with a random
// token substring, and — disproven by proof #18 (8 Nov 2026) — so can a
// 4-digit product: DVWA login.php mints a fresh 32-hex user_token per GET,
// and one payload response's token contained 9352 while the control's did
// not, firing a CRITICAL false positive on a page that never evaluates
// templates. The old "a 4-digit product cannot coincide" claim is FALSE.
// Confirmation therefore needs BOTH guards from oracleGuards.js:
//   (a) stripVolatileValues on the payload body AND the control — the
//       oracle must not match inside a hidden input value or any other
//       long hex/token-looking attribute value; and
//   (b) a repeat payload request — the evaluated value must re-appear at
//       the SAME reflection point (identical context window) in a second,
//       independent response. A random token changes every request; a real
//       evaluation is stable.
import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';
import { stripVolatileValues, sameReflectionPoint } from './oracleGuards.js';

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


export async function probeSsti(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    // Control: unique filler — proves the oracle token is not already on the page.
    let controlRaw;
    try {
      controlRaw = await get(mutateUrl(url, param, `dm_${rand()}`), opts);
    } catch {
      continue;
    }
    let bodyRaw;
    try {
      bodyRaw = await get(mutateUrl(url, param, '{{1336*7}}'), opts);
    } catch {
      continue;
    }
    // Guard (a): strip per-request random values (hidden inputs, long
    // token-like attribute values) from BOTH bodies before the
    // differential, so the oracle can never match inside a fresh token.
    const control = stripVolatileValues(controlRaw);
    const body = stripVolatileValues(bodyRaw);
    // Fire ONLY on the evaluation differential: distinctive result present,
    // literal payload absent, result absent from the control response.
    const idx = body.indexOf('9352');
    if (idx < 0 || bodyRaw.includes('{{1336*7}}') || control.includes('9352')) continue;
    // Guard (b): repeat the payload request — a genuine evaluation renders
    // into the same static template slot every time; a random-token
    // coincidence lands elsewhere and changes on every request.
    let body2Raw;
    try {
      body2Raw = await get(mutateUrl(url, param, '{{1336*7}}'), opts);
    } catch {
      continue;
    }
    if (body2Raw.includes('{{1336*7}}')) continue;
    const body2 = stripVolatileValues(body2Raw);
    if (!sameReflectionPoint(body, body2, '9352')) continue;
    const window = body.slice(Math.max(0, idx - 60), idx + 60);
    findings.push({
      class: 'ssti',
      id: `ssti-${probePointName(param)}`,
      title: `Server-side template injection in parameter '${probePointParameter(param)}'`,
      severity: 'critical',
      url,
      param: probePointParameter(param),
      evidence: {
        request: `GET ${mutateUrl(url, param, '{{1336*7}}')}`,
        response: `expression evaluated to 9352 (literal {{1336*7}} absent; 9352 absent in control; repeat request confirmed the same reflection point) — "...${window}..."`,
        impact_demo: '{{1336*7}} rendered as 9352 — the template engine executes input',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
