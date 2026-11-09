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
//      the page. The control is fetched TWICE with the same filler; if
//      the two controls disagree (FP3 guard, oracleGuards.js) the page
//      is noisy and the parameter is skipped, never confirmed.
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
//   4. Zerodha guards (9 Nov 2026, hunt h_6b5942052353): the old string
//      oracle ${'dmElTest'.toString()} is RETIRED — its expected marker
//      'dmElTest' is a substring of the payload itself, so a URL-encoded
//      reflection of the payload ("...%24%7B%27dmElTest%27...") counted
//      as "evaluation" on a WordPress page with no EL evaluator. The
//      string oracle is now ${'dmElTest'.toUpperCase()} expecting
//      'DMELTEST' (nowhere in the payload in any encoding), every
//      payload must pass the self-referential marker ban plus an
//      encoded-reflection check, and a bot-challenge page on either
//      side voids the differential. PHP/WordPress stacks skip the
//      probe entirely (no EL evaluator exists there).
// Read-only GET, per-input unique canaries, redirect: manual.

import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';
import {
  stripVolatileValues,
  sameReflectionPoint,
  isBotChallengePage,
  isSelfReferentialMarker,
  isPayloadReflected,
  controlObservationsStable,
  isPhpWordpressStack,
} from './oracleGuards.js';

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
    return { status: res.status, text: text.slice(0, 500000) };
  } finally {
    clearTimeout(t);
  }
}


// Benign evaluation oracles: math shapes for ${}/${} and #{}, plus a
// string-method shape so string evaluation is distinguished from math
// coincidence. The oracle token (9352 / DMELTEST) is unique to the payload:
// 9352 is a distinctive 4-digit product — a bare 49 can coincide with a
// random token substring, and (proof #18) so can 9352 inside a fresh
// 32-hex token, which is why the strip + repeat guards below apply.
// The string oracle MUST stay non-self-referential: 'DMELTEST' appears
// nowhere in ${'dmElTest'.toUpperCase()} in any encoding (the retired
// ${'dmElTest'.toString()} / 'dmElTest' shape failed exactly this — see
// isSelfReferentialMarker). Every payload below is re-checked against
// the ban at runtime; a self-referential payload can never fire.
const EL_PAYLOADS = [
  { payload: '${1336*7}', expect: '9352' },
  { payload: '#{1336*7}', expect: '9352' },
  { payload: "${'dmElTest'.toUpperCase()}", expect: 'DMELTEST' },
];

export async function probeElInject(url, params, opts = {}) {
  const findings = [];
  // Stack gate: no EL evaluator exists on PHP/WordPress stacks.
  if (isPhpWordpressStack(opts.stack)) return findings;
  const depth = opts.depth || 'standard';
  // max 3 payloads/param; quick depth fires on the single ${7*7} oracle.
  // Self-referential payloads are banned outright — they can never prove
  // evaluation, however the page reflects them.
  const payloads = (depth === 'quick' ? EL_PAYLOADS.slice(0, 1) : EL_PAYLOADS.slice(0, 3))
    .filter(({ payload, expect }) => !isSelfReferentialMarker(payload, expect));
  for (const param of (params || []).slice(0, 10)) {
    // Control: unique filler canary — never empty==empty, proves 49 is new.
    // Fetched TWICE with the same filler (FP3): if the two controls
    // disagree beyond trivial rotation, the page is noisy — skip the
    // parameter, never confirm from a wobbling baseline.
    const filler = `dm_${rand()}`;
    let controlRaw;
    let controlRaw2;
    try {
      controlRaw = await getText(mutateUrl(url, param, filler), opts);
      controlRaw2 = await getText(mutateUrl(url, param, filler), opts);
    } catch {
      continue;
    }
    // Guard (a): strip per-request random values from the controls before
    // the differential.
    const control = stripVolatileValues(controlRaw.text);
    const control2 = stripVolatileValues(controlRaw2.text);
    if (isBotChallengePage(controlRaw.text) || isBotChallengePage(controlRaw2.text)) continue;
    if (!controlObservationsStable(
      { status: controlRaw.status, text: control },
      { status: controlRaw2.status, text: control2 },
    )) continue;
    for (const { payload, expect } of payloads) {
      let bodyRaw;
      try {
        bodyRaw = await getText(mutateUrl(url, param, payload), opts);
      } catch {
        continue;
      }
      // Guard (a): strip per-request random values from the payload body
      // too, so the oracle can never match inside a fresh token.
      const body = stripVolatileValues(bodyRaw.text);
      // Fire ONLY on the evaluation differential: oracle result present,
      // literal payload absent (raw AND encoded — a URL-encoded reflection
      // of the payload is still a reflection, never evaluation), oracle
      // absent from the control response, and neither side a bot-challenge
      // page.
      if (body.includes(expect) && !isPayloadReflected(bodyRaw.text, payload) && !control.includes(expect) && !isBotChallengePage(bodyRaw.text)) {
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
        if (isPayloadReflected(body2Raw.text, payload)) continue;
        if (!sameReflectionPoint(body, stripVolatileValues(body2Raw.text), expect)) continue;
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
            response: `payload evaluated to '${expect}' (literal/encoded payload absent; oracle absent in control; repeat request confirmed the same reflection point) — "...${window}..."`,
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
