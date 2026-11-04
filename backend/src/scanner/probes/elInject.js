// Dark Matter rule-based scanner — Expression Language injection probe (#197).
//
// Defensive purpose: detect endpoints that evaluate Expression Language
// syntax (${...} / #{...} — JSP EL, JSF, Spring EL) inside user input, so
// the owner can remediate on authorized targets. This module only DETECTS
// evaluation behaviour using benign math/string oracles; it never attempts
// to reach side-effecting EL functions, scopes, or the application runtime.
//
// Oracle (differential, per parameter):
//   1. Control: unique plain-text filler `dm_<rand>` — shows the page's
//      baseline and proves the oracle token (e.g. 49) is not already on
//      the page.
//   2. Eval: benign EL payload, e.g. `${7*7}` — if the response contains
//      the EVALUATED result (49) while the literal payload is NOT
//      reflected, the server executed the expression: confirmed EL
//      injection. A literal reflection of ${7*7} is never a finding.
// Read-only GET, per-input unique canaries, redirect: manual.

import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return randomBytes(3).toString('hex');
}

async function getText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    return text.slice(0, 500000);
  } finally {
    clearTimeout(t);
  }
}

function withParam(url, name, value) {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}

// Benign evaluation oracles: math shapes for ${}/${} and #{}, plus a
// string-method shape so string evaluation is distinguished from math
// coincidence. The oracle token (49 / dmElTest) is unique to the payload.
const EL_PAYLOADS = [
  { payload: '${7*7}', expect: '49' },
  { payload: '#{7*7}', expect: '49' },
  { payload: "${'dmElTest'.toString()}", expect: 'dmElTest' },
];

export async function probeElInject(url, params, opts = {}) {
  const findings = [];
  const depth = opts.depth || 'standard';
  // max 3 payloads/param; quick depth fires on the single ${7*7} oracle.
  const payloads = depth === 'quick' ? EL_PAYLOADS.slice(0, 1) : EL_PAYLOADS.slice(0, 3);
  for (const param of (params || []).slice(0, 10)) {
    // Control: unique filler canary — never empty==empty, proves 49 is new.
    let control;
    try {
      control = await getText(withParam(url, param, `dm_${rand()}`), opts);
    } catch {
      continue;
    }
    for (const { payload, expect } of payloads) {
      let body;
      try {
        body = await getText(withParam(url, param, payload), opts);
      } catch {
        continue;
      }
      // Fire ONLY on the evaluation differential: oracle result present,
      // literal payload absent, oracle absent from the control response.
      if (body.includes(expect) && !body.includes(payload) && !control.includes(expect)) {
        findings.push({
          class: 'el_injection',
          id: `el-injection-${param}`,
          title: `Expression Language injection in parameter '${param}'`,
          severity: 'high',
          url,
          parameter: param,
          evidence: {
            request: `GET ${withParam(url, param, payload)}`,
            response: `payload evaluated to '${expect}' (literal '${payload}' absent; oracle absent in control)`,
            impact_demo: `EL expression ${payload} executed server-side — input reaches an EL evaluator`,
            signalCorrelated: true,
          },
        });
        break; // one finding per param at highest severity
      }
    }
  }
  return findings;
}
