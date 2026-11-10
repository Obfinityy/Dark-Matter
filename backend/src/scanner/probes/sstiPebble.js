// Dark Matter rule-based scanner — SSTI probe, Pebble engine (Java).
// (Coverage row #486 [Critical] SSTI — Pebble, CWE-94; phase 'ssti-pebble'.)
//
// The generic probe (ssti.js) proves evaluation with {{1336*7}} -> 9352,
// which fires on any {{ }} engine. This probe proves the engine is
// PEBBLE specifically, using syntax other {{ }} engines do not evaluate:
// Pebble's Java-style ternary operator {{ true ? 9352 : 1111 }}. Jinja2
// and Twig spell the same conditional as {{ 9352 if true else 1111 }};
// FreeMarker uses {{ 9352?then(...) }}-style built-ins; Velocity has no
// {{ }} interpolation at all. A sink that evaluates BOTH the arithmetic
// oracle AND the Pebble ternary — and evaluates the false leg of the
// ternary to the other branch — is a Pebble template, not a generic
// {{ }} evaluator.
//
// ORACLE (all three legs, each repeated):
//   A — arithmetic: {{1336*7}} renders 9352, literal absent.
//   T — ternary true: {{ true ? 9352 : 1111 }} renders 9352.
//   F — ternary false: {{ false ? 9352 : 1111 }} renders 1111 (the
//       nonsense control: a page that merely echoes "9352" from
//       anywhere — a token, a static string — renders 9352 on leg F
//       too, or renders the literal; either way the probe stays quiet).
//   Each leg is checked against a benign control (no 9352 anywhere
//   after stripping volatile values), and the 9352 legs must re-appear
//   at the SAME reflection point on a repeat request (oracleGuards:
//   stripVolatileValues + sameReflectionPoint — the proof-#18 guards,
//   because a fresh per-request token can contain 9352 by chance).
//   A finding fires ONLY when A and T both confirm AND F renders the
//   other branch. Arithmetic alone is generic SSTI (ssti.js owns it);
//   ternary alone could be a coincidental 9352; together they
//   fingerprint Pebble.
//
// GATES: none beyond the battery itself. Read-only GETs against the
// scan targets, the same surface ssti.js uses, at every depth.
// Findings are class 'ssti' with a Pebble-specific id/title, so the
// generic and Pebble findings can both stand on one sink without
// colliding in the dedupe key (class + parameter + title).
//
// HONEST LIMITS: no dedicated Pebble lab exists today — verified
// against local mock servers only (a Pebble-evaluating stub, a
// Jinja2-style stub that evaluates arithmetic and the if-expression
// but not the ternary, a literal reflector, and the proof-#18 fresh
// token shape). A live Pebble target proof is a later lane. Pebble
// versions differ in which filters/functions exist; this probe uses
// only core syntax (arithmetic, ternary, literal) present in every
// Pebble release, so a version gap cannot flip the verdict — but a
// sink that evaluates templates only in a POST body or a header is
// out of scope here (GET params only, like ssti.js).

import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
import { stripVolatileValues, sameReflectionPoint } from './oracleGuards.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_PARAMS = 10;
const ORACLE = '9352';
const OTHER_BRANCH = '1111';

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true, engine: 'pebble' };
}

async function get(fetchFn, url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/** Pebble arithmetic oracle payload. Pure. */
export function pebbleArithmeticPayload() {
  return '{{1336*7}}';
}

/** Pebble ternary payload, true leg: renders 9352 on a Pebble sink. Pure. */
export function pebbleTernaryTruePayload() {
  return '{{ true ? 9352 : 1111 }}';
}

/** Pebble ternary payload, false leg: renders 1111 on a Pebble sink. Pure. */
export function pebbleTernaryFalsePayload() {
  return '{{ false ? 9352 : 1111 }}';
}

/** Jinja2/Twig if-expression spelling of the same conditional. A Pebble
 *  sink does NOT evaluate this; a Jinja2/Twig sink does. Used by the
 *  tests as the cross-engine discriminator, not by the probe itself. Pure. */
export function jinjaConditionalPayload() {
  return '{{ 9352 if true else 1111 }}';
}

/**
 * Judge one evaluated leg: the expected value is present, the literal
 * payload is absent, the stripped control lacks the value, and a repeat
 * renders it at the same reflection point. Pure.
 */
export function assessPebbleLeg({ controlRaw, bodyRaw, bodyRepeatRaw, payload, expected }) {
  if (bodyRaw === null || bodyRepeatRaw === null || controlRaw === null) {
    return { verdict: 'unconfirmed', reason: 'a request failed' };
  }
  if (bodyRaw.includes(payload)) {
    return { verdict: 'rejected', reason: 'payload reflected literally — never evaluated' };
  }
  const control = stripVolatileValues(controlRaw);
  const body = stripVolatileValues(bodyRaw);
  const bodyRepeat = stripVolatileValues(bodyRepeatRaw);
  if (control.includes(expected)) {
    return { verdict: 'rejected', reason: 'expected value already present in the control response' };
  }
  if (!body.includes(expected)) {
    return { verdict: 'rejected', reason: 'expected value absent from the payload response' };
  }
  if (!sameReflectionPoint(body, bodyRepeat, expected)) {
    return { verdict: 'unconfirmed', reason: 'repeat did not render at the same reflection point' };
  }
  return { verdict: 'confirmed', reason: 'evaluated value present, absent from control, repeat-stable' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeSstiPebble(url, params, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const points = (params || []).slice(0, MAX_PARAMS);
  noteAttemptedPoints(opts, points);
  setDiag('pointsAttempted', points.map((p) => probePointParameter(p)));
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  let attempts = 0;
  let paramsTried = 0;
  let pebbleParams = 0;
  for (const param of points) {
    paramsTried += 1;
    setDiag('paramsTried', paramsTried);
    const controlRaw = await get(fetchFn, mutateUrl(url, param, `dm_${randomBytes(3).toString('hex')}`), opts);
    attempts += 1;
    if (controlRaw === null) continue;

    // Leg A: arithmetic oracle + repeat.
    const arithRaw = await get(fetchFn, mutateUrl(url, param, pebbleArithmeticPayload()), opts);
    attempts += 1;
    if (arithRaw === null) continue;
    const arithRepeatRaw = await get(fetchFn, mutateUrl(url, param, pebbleArithmeticPayload()), opts);
    attempts += 1;
    if (arithRepeatRaw === null) continue;
    const arith = assessPebbleLeg({
      controlRaw,
      bodyRaw: arithRaw,
      bodyRepeatRaw: arithRepeatRaw,
      payload: pebbleArithmeticPayload(),
      expected: ORACLE,
    });
    if (arith.verdict !== 'confirmed') continue;

    // Leg T: Pebble ternary, true branch + repeat.
    const ternRaw = await get(fetchFn, mutateUrl(url, param, pebbleTernaryTruePayload()), opts);
    attempts += 1;
    if (ternRaw === null) continue;
    const ternRepeatRaw = await get(fetchFn, mutateUrl(url, param, pebbleTernaryTruePayload()), opts);
    attempts += 1;
    if (ternRepeatRaw === null) continue;
    const tern = assessPebbleLeg({
      controlRaw,
      bodyRaw: ternRaw,
      bodyRepeatRaw: ternRepeatRaw,
      payload: pebbleTernaryTruePayload(),
      expected: ORACLE,
    });
    if (tern.verdict !== 'confirmed') continue;

    // Leg F: the false branch must render the OTHER value — the
    // nonsense control. A page echoing 9352 unconditionally fails here.
    const falseRaw = await get(fetchFn, mutateUrl(url, param, pebbleTernaryFalsePayload()), opts);
    attempts += 1;
    if (falseRaw === null) continue;
    const falseBody = stripVolatileValues(falseRaw);
    if (falseBody.includes(pebbleTernaryFalsePayload())) continue;
    if (!falseBody.includes(OTHER_BRANCH)) continue;
    if (stripVolatileValues(controlRaw).includes(OTHER_BRANCH)) continue;
    if (falseBody.includes(ORACLE)) continue;

    pebbleParams += 1;
    setDiag('pebbleParams', pebbleParams);
    setDiag('attempts', attempts);
    const idx = stripVolatileValues(ternRaw).indexOf(ORACLE);
    const window = stripVolatileValues(ternRaw).slice(Math.max(0, idx - 60), idx + 60);
    findings.push({
      class: 'ssti',
      id: `ssti-pebble-${probePointName(param)}`,
      title: `Server-side template injection (Pebble engine) in parameter '${probePointParameter(param)}'`,
      severity: 'critical',
      url,
      param: probePointParameter(param),
      parameter: probePointParameter(param),
      evidence: ev(
        `GET ${mutateUrl(url, param, pebbleTernaryTruePayload())} and GET ${mutateUrl(url, param, pebbleArithmeticPayload())}`,
        `Pebble ternary evaluated: {{ true ? 9352 : 1111 }} rendered 9352 (literal absent; absent from control; repeat at the same reflection point) and {{ false ? 9352 : 1111 }} rendered the other branch 1111; arithmetic {{1336*7}} also evaluated to 9352 — "...${window}..."`,
        'Pebble template engine executes attacker input — the ternary operator is Pebble-specific (Jinja2/Twig use if-expressions, not ? :), so this fingerprints the engine, not just {{ }} evaluation',
      ),
    });
  }
  setDiag('attempts', attempts);
  return findings;
}

export const __sstiPebbleMeta = { phases: ['ssti-pebble'], depth: ['quick', 'standard', 'deep'] };
