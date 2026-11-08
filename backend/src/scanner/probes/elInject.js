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
//      baseline and proves the oracle token (e.g. 9352) is not already on
//      the page.
//   2. Eval: benign EL payload, e.g. `${1336*7}` — if the response contains
//      the EVALUATED result (9352) while the literal payload is NOT
//      reflected, the server executed the expression: confirmed EL
//      injection. A literal reflection of ${1336*7} is never a finding.
//   3. Guards (oracleGuards.js, proof #18, 8 Nov 2026): the oracle must
//      not match inside a per-request random value — hidden input values
//      and long hex/token-looking attribute values are stripped from
//      BOTH bodies before the differential, and the evaluated value must
//      re-appear at the SAME reflection point in a repeat payload
//      request. A fresh 32-hex CSRF token can contain 9352 (DVWA
//      login.php did exactly that); the old "9352 cannot coincide"
//      claim is FALSE.
// Read-only GET, per-input unique canaries, redirect: manual.

import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';
import { stripVolatileValues, sameReflectionPoint } from './oracleGuards.js';

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


// Benign evaluation oracles: math shapes for ${}/${} and #{}, plus a
// string-method shape so string evaluation is distinguished from math
// coincidence. The oracle token (9352 / dmElTest) is unique to the payload:
// 9352 is a distinctive 4-digit product — a bare 49 can coincide with a
// random token substring, and (proof #18) so can 9352 inside a fresh
// 32-hex token, which is why the strip + repeat guards below apply.
const EL_PAYLOADS = [
  { payload: '${1336*7}', expect: '9352' },
  { payload: '#{1336*7}', expect: '9352' },
  { payload: "${'dmElTest'.toString()}", expect: 'dmElTest' },
];

export async function probeElInject(url, params, opts = {}) {
  const findings = [];
  const depth = opts.depth || 'standard';
  // max 3 payloads/param; quick depth fires on the single ${7*7} oracle.
  const payloads = depth === 'quick' ? EL_PAYLOADS.slice(0, 1) : EL_PAYLOADS.slice(0, 3);
  for (const param of (params || []).slice(0, 10)) {
    // Control: unique filler canary — never empty==empty, proves 49 is new.
    let controlRaw;
    try {
      controlRaw = await getText(mutateUrl(url, param, `dm_${rand()}`), opts);
    } catch {
      continue;
    }
    // Guard (a): strip per-request random values from the control before
    // the differential.
    const control = stripVolatileValues(controlRaw);
    for (const { payload, expect } of payloads) {
      let bodyRaw;
      try {
        bodyRaw = await getText(mutateUrl(url, param, payload), opts);
      } catch {
        continue;
      }
      // Guard (a): strip per-request random values from the payload body
      // too, so the oracle can never match inside a fresh token.
      const body = stripVolatileValues(bodyRaw);
      // Fire ONLY on the evaluation differential: oracle result present,
      // literal payload absent, oracle absent from the control response.
      if (body.includes(expect) && !bodyRaw.includes(payload) && !control.includes(expect)) {
        // Guard (b): repeat the payload request — a genuine evaluation
        // renders into the same static template slot every time; a
        // random-token coincidence lands elsewhere and changes on every
        // request.
        let body2Raw;
        try {
          body2Raw = await getText(mutateUrl(url, param, payload), opts);
        } catch {
          continue;
        }
        if (body2Raw.includes(payload)) continue;
        if (!sameReflectionPoint(body, stripVolatileValues(body2Raw), expect)) continue;
        const idx = body.indexOf(expect);
        const window = body.slice(Math.max(0, idx - 60), idx + 60);
        findings.push({
          class: 'el_injection',
          id: `el-injection-${probePointName(param)}`,
          title: `Expression Language injection in parameter '${probePointParameter(param)}'`,
          severity: 'high',
          url,
          parameter: probePointParameter(param),
          evidence: {
            request: `GET ${mutateUrl(url, param, payload)}`,
            response: `payload evaluated to '${expect}' (literal '${payload}' absent; oracle absent in control; repeat request confirmed the same reflection point) — "...${window}..."`,
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
