// Dark Matter rule-based scanner — blind XPath injection probe
// (coverage row #479 [High] Blind XPath injection, CWE-643 |
// OWASP A03:2021; phase 103, 'blind-xpath').
//
// The general XPath row (#215) is covered by xpathi.js: an error
// string from the XPath engine, or a widening payload (' or '1'='1)
// returning a node set diverging >25%. This probe covers the blind
// variant the xpathi doc lists as a limit ("Blind XPath (no output
// difference) is not confirmed"): the sink evaluates injected XPath
// but the application suppresses engine errors and caps or pages
// the result set, so no single payload shows a large divergence.
// The verdict is proven by DIFFERENTIAL response behaviour only —
// never by one error string, never by one widened response.
//
// ORACLE (two independent boolean witnesses, each repeated):
//   T1 — TRUE/FALSE pair differing ONLY in the compared character
//   of an injected XPath boolean, everything else byte-identical.
//   Shape A (primary): substring() on an embedded literal whose
//   value the probe KNOWS — ' or substring('dmprobe',1,1)='d
//   (TRUE) vs ' or substring('dmprobe',1,1)='0 (FALSE). Shape B
//   (fallback, when shape A shows no differential): the minimal
//   equality pair ' or '1'='1 (TRUE) vs ' or '1'='2 (FALSE).
//   The pair must DIVERGE, and each leg must REPRODUCE on a repeat
//   request — a single divergent pair is jitter, not a finding.
//   T2 — a second, independent boolean witness on the same param:
//   shape A extracts the literal further (positions 2 and 3 —
//   'm', 'p'): each position's TRUE leg must match the T1-TRUE
//   signature and its FALSE leg the T1-FALSE signature, so the
//   extracted prefix is self-verifying against the known literal.
//   Shape B has no literal to extract, so its T2 is a
//   string-length() pair on the same literal —
//   ' or string-length('dmprobe')=7 (TRUE) vs =6 (FALSE) —
//   repeated the same way.
//   A finding fires ONLY when T1 AND T2 both hold. The FALSE leg
//   is itself the nonsense control: TRUE and FALSE differ only in
//   the compared value, so a server that merely reacts to "weird
//   input" (any quote breaks the query into the same error page)
//   shows TRUE == FALSE and the probe stays quiet — the same
//   veto logic as ldapBlind's zzz* control.
//
// CALIBRATION: two benign requests (different unlikely values)
// must agree first; a jittery page skips the param, never a
// finding. Responses "match" when their status class agrees and
// their lengths agree within max(64, 2%) — a search page whose
// result set changes size is a different answer; a page whose
// body wobbles by a few bytes is the same answer.
//
// GATES: none beyond the battery itself. The probe is read-only
// GETs against the scan targets (the same surface xpathi uses),
// needs no lab session and no write permission, and runs at every
// depth including 'quick'. Findings are class 'xpath_injection' —
// the default confirmation protocol judges them on
// signalCorrelated (see differential.js), exactly like xpathi's
// boolean finding; the title and id keep the blind variant
// distinct in the dedupe key (class + parameter + title), so the
// general and blind findings can both stand on one sink.

import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_PARAMS = 6;
// The embedded literal: a fixed probe marker whose value the probe
// knows in advance, so extraction is self-verifying. A plain word,
// not secret-shaped, never a credential.
const LITERAL = 'dmprobe';
// Extraction positions beyond T1's position 1. At least one must
// verify for the shape-A second witness.
const EXTRACT_POSITIONS = [2, 3];
// Length tolerance for "same answer": an absolute floor for small
// bodies plus 2% for large ones (a search page whose result set
// changes size is a different answer; a few wobbling bytes are not).
const LEN_FLOOR = 64;
const LEN_PCT = 0.02;

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true, blindOracle: true };
}

async function get(fetchFn, url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Response signature: status class + length bucket (200 chars).
 * Pure.
 */
export function responseSig(r) {
  if (!r || typeof r.status !== 'number') return 'err:missing';
  const cls = r.status < 400 ? 'ok' : 'err';
  const len = typeof r.text === 'string' ? r.text.length : 0;
  return `${cls}:${Math.floor(len / 200)}`;
}

/**
 * Two responses are "the same answer" when their status class
 * agrees and their lengths agree within max(64, 2%). Pure.
 */
export function responsesMatch(a, b) {
  if (!a || !b) return false;
  const clsA = a.status < 400 ? 'ok' : 'err';
  const clsB = b.status < 400 ? 'ok' : 'err';
  if (clsA !== clsB) return false;
  const lenA = typeof a.text === 'string' ? a.text.length : 0;
  const lenB = typeof b.text === 'string' ? b.text.length : 0;
  return Math.abs(lenA - lenB) <= Math.max(LEN_FLOOR, LEN_PCT * Math.max(lenA, lenB));
}

/**
 * Shape A payloads: substring() on the embedded literal. TRUE
 * guesses the literal's character at `pos` (1-based); FALSE
 * guesses '0', which never occurs in the literal. The payloads
 * differ ONLY in the compared character. Pure.
 */
export function blindTruePayload(pos, ch) {
  return `' or substring('${LITERAL}',${pos},1)='${ch}`;
}

export function blindFalsePayload(pos) {
  return `' or substring('${LITERAL}',${pos},1)='0`;
}

/** Shape B payloads: the minimal equality pair. Pure. */
export function equalityTruePayload() {
  return `' or '1'='1`;
}

export function equalityFalsePayload() {
  return `' or '1'='2`;
}

/**
 * Shape-B T2 payloads: string-length() on the embedded literal —
 * 7 is the literal's true length, 6 is false. Pure.
 */
export function lengthTruePayload() {
  return `' or string-length('${LITERAL}')=7`;
}

export function lengthFalsePayload() {
  return `' or string-length('${LITERAL}')=6`;
}

/**
 * Judge one boolean-witness matrix: two baselines plus a
 * TRUE/FALSE pair and its repeat. 'confirmed' only when the
 * baselines agree, the legs diverge, and each leg reproduces.
 * 'rejected' when the legs are indistinguishable (no oracle);
 * 'unconfirmed' when the matrix is incomplete or jittery. Pure.
 */
export function assessBlindOracle({ base1, base2, trueLeg, falseLeg, trueRepeat, falseRepeat }) {
  if (!base1 || !base2 || !trueLeg || !falseLeg || !trueRepeat || !falseRepeat) {
    return { verdict: 'unconfirmed', reason: 'incomplete witness matrix — a request failed' };
  }
  if (!responsesMatch(base1, base2)) {
    return { verdict: 'unconfirmed', reason: 'benign baselines disagree — page is jittery' };
  }
  if (responsesMatch(trueLeg, falseLeg)) {
    return { verdict: 'rejected', reason: 'TRUE and FALSE legs are indistinguishable — no boolean oracle' };
  }
  if (!responsesMatch(trueLeg, trueRepeat) || !responsesMatch(falseLeg, falseRepeat)) {
    return { verdict: 'unconfirmed', reason: 'a leg did not reproduce on repeat — single divergent pair is jitter' };
  }
  return { verdict: 'confirmed', reason: 'TRUE/FALSE legs diverge reproducibly against stable baselines' };
}

/**
 * Judge the shape-A extraction: for each position, the TRUE guess
 * must diverge from the FALSE guess AND match the T1-TRUE
 * reference, while the FALSE guess matches the T1-FALSE reference.
 * Returns the verified prefix (positions are 1-based into the
 * literal; position 1 was already proven by T1 itself). Pure.
 */
export function assessBlindExtract(positions) {
  let extracted = LITERAL[0];
  let verified = 0;
  for (const p of positions || []) {
    const ch = LITERAL[p.pos - 1];
    if (!ch) continue;
    if (!p.trueLeg || !p.falseLeg || !p.trueRef || !p.falseRef) continue;
    if (
      !responsesMatch(p.trueLeg, p.falseLeg) &&
      responsesMatch(p.trueLeg, p.trueRef) &&
      responsesMatch(p.falseLeg, p.falseRef)
    ) {
      extracted += ch;
      verified += 1;
    }
  }
  return { extracted, verified };
}

// ---- the probe ---------------------------------------------------------------

export async function probeBlindXpath(url, params, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  setDiag('pointsAttempted', (params || []).slice(0, MAX_PARAMS).map((p) => probePointParameter(p)));
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  let attempts = 0;
  let paramsTried = 0;
  let oracleParams = 0;
  for (const param of (params || []).slice(0, MAX_PARAMS)) {
    paramsTried += 1;
    setDiag('paramsTried', paramsTried);
    // Calibration: two benign requests must agree, or the page is
    // jittery and the param is skipped — never a finding.
    const unlikely1 = `dmxp${randomBytes(3).toString('hex')}`;
    const unlikely2 = `dmxp${randomBytes(3).toString('hex')}`;
    const base1 = await get(fetchFn, mutateUrl(url, param, unlikely1), opts);
    attempts += 1;
    const base2 = await get(fetchFn, mutateUrl(url, param, unlikely2), opts);
    attempts += 1;
    if (!base1 || !base2) continue;

    // T1 shape A: substring() TRUE/FALSE pair + repeat.
    const trueA = await get(fetchFn, mutateUrl(url, param, blindTruePayload(1, LITERAL[0])), opts);
    attempts += 1;
    const falseA = await get(fetchFn, mutateUrl(url, param, blindFalsePayload(1)), opts);
    attempts += 1;
    let shape = null;
    let t1 = null;
    let trueRef = null;
    let falseRef = null;
    if (trueA && falseA) {
      const trueA2 = await get(fetchFn, mutateUrl(url, param, blindTruePayload(1, LITERAL[0])), opts);
      attempts += 1;
      const falseA2 = await get(fetchFn, mutateUrl(url, param, blindFalsePayload(1)), opts);
      attempts += 1;
      if (trueA2 && falseA2) {
        const judged = assessBlindOracle({
          base1,
          base2,
          trueLeg: trueA,
          falseLeg: falseA,
          trueRepeat: trueA2,
          falseRepeat: falseA2,
        });
        if (judged.verdict === 'confirmed') {
          shape = 'substring';
          t1 = judged;
          trueRef = trueA;
          falseRef = falseA;
        }
      }
    }
    // T1 shape B fallback: only when shape A completed but showed
    // no oracle (a fetch failure skips the param outright — the
    // endpoint, not the payload shape, is at fault).
    if (!shape && trueA && falseA) {
      const trueB = await get(fetchFn, mutateUrl(url, param, equalityTruePayload()), opts);
      attempts += 1;
      const falseB = await get(fetchFn, mutateUrl(url, param, equalityFalsePayload()), opts);
      attempts += 1;
      if (trueB && falseB) {
        const trueB2 = await get(fetchFn, mutateUrl(url, param, equalityTruePayload()), opts);
        attempts += 1;
        const falseB2 = await get(fetchFn, mutateUrl(url, param, equalityFalsePayload()), opts);
        attempts += 1;
        if (trueB2 && falseB2) {
          const judged = assessBlindOracle({
            base1,
            base2,
            trueLeg: trueB,
            falseLeg: falseB,
            trueRepeat: trueB2,
            falseRepeat: falseB2,
          });
          if (judged.verdict === 'confirmed') {
            shape = 'equality';
            t1 = judged;
            trueRef = trueB;
            falseRef = falseB;
          }
        }
      }
    }
    if (!shape) continue;
    oracleParams += 1;
    setDiag('oracleParams', oracleParams);

    // T2 — second independent witness, then the finding.
    // Shape A: extract the literal further (positions 2, 3); at
    // least one position must verify against the T1 references.
    // Shape B: string-length() pair + repeat on the same literal.
    let t2ok = false;
    let extracted = LITERAL[0];
    if (shape === 'substring') {
      const positions = [];
      for (const pos of EXTRACT_POSITIONS) {
        const tLeg = await get(fetchFn, mutateUrl(url, param, blindTruePayload(pos, LITERAL[pos - 1])), opts);
        attempts += 1;
        const fLeg = await get(fetchFn, mutateUrl(url, param, blindFalsePayload(pos)), opts);
        attempts += 1;
        if (!tLeg || !fLeg) continue;
        positions.push({ pos, trueLeg: tLeg, falseLeg: fLeg, trueRef, falseRef });
      }
      const ext = assessBlindExtract(positions);
      extracted = ext.extracted;
      t2ok = ext.verified >= 1;
    } else {
      const trueL = await get(fetchFn, mutateUrl(url, param, lengthTruePayload()), opts);
      attempts += 1;
      const falseL = await get(fetchFn, mutateUrl(url, param, lengthFalsePayload()), opts);
      attempts += 1;
      if (trueL && falseL) {
        const trueL2 = await get(fetchFn, mutateUrl(url, param, lengthTruePayload()), opts);
        attempts += 1;
        const falseL2 = await get(fetchFn, mutateUrl(url, param, lengthFalsePayload()), opts);
        attempts += 1;
        if (trueL2 && falseL2) {
          t2ok =
            assessBlindOracle({
              base1,
              base2,
              trueLeg: trueL,
              falseLeg: falseL,
              trueRepeat: trueL2,
              falseRepeat: falseL2,
            }).verdict === 'confirmed';
        }
      }
    }
    setDiag('attempts', attempts);
    if (!t2ok) continue;
    setDiag('shape', shape);
    setDiag('extracted', extracted);
    findings.push({
      class: 'xpath_injection',
      id: `xpath-blind-${probePointName(param)}`,
      title: `Blind XPath injection in parameter '${probePointParameter(param)}'`,
      severity: 'high',
      url,
      param: probePointParameter(param),
      parameter: probePointParameter(param),
      evidence: ev(
        `GET ${mutateUrl(url, param, shape === 'substring' ? blindTruePayload(1, LITERAL[0]) : equalityTruePayload())} (TRUE) vs ${mutateUrl(url, param, shape === 'substring' ? blindFalsePayload(1) : equalityFalsePayload())} (FALSE), each repeated, against two benign baselines`,
        `Two independent boolean witnesses hold on '${probePointParameter(param)}' (${shape} oracle: ${t1.reason}; second witness confirmed${shape === 'substring' ? `; extracted "${extracted}" from the known literal "${LITERAL}"` : ''}). TRUE leg ${responseSig(trueRef)} vs FALSE leg ${responseSig(falseRef)} vs benign ${responseSig(base1)} — the injected XPath boolean flips the observable result set.`,
        'Attacker-controlled XPath boolean: substring() extraction reads XML-stored data one character at a time without any error output.',
      ),
    });
    // Max 1 finding per param; the loop continues to the next param
    // (other params may carry their own sinks).
  }
  setDiag('attempts', attempts);
  return findings;
}

export const __blindXpathMeta = { phases: ['blind-xpath'], depth: ['quick', 'standard', 'deep'] };
