// Dark Matter rule-based scanner — SSTI probe, engine-specific legs
// (Coverage rows #288–#293 [Critical, except #293 High]:
//  #288 FreeMarker, #289 Velocity, #290 Thymeleaf, #291 Smarty,
//  #292 ERB, #293 Handlebars/Pug; phase 'ssti-engines'.)
//
// The generic probe (ssti.js) proves evaluation with {{1336*7}} -> 9352,
// which fires on any {{ }} engine — Jinja2, Twig, Blade. It can never
// fire on the six engines below, because none of them evaluates {{ }}
// arithmetic: FreeMarker interpolates ${...}, Velocity has no {{ }}
// interpolation at all, Thymeleaf evaluates th:* expressions, Smarty
// needs {math}/{if}, ERB evaluates <%= %>, Handlebars {{ }} is a
// LOOKUP ({{1336*7}} renders empty), and Pug uses #{...}. Each engine
// below therefore gets its own syntax leg, in the Pebble shape
// (sstiPebble.js): an engine-specific arithmetic leg, a discriminator
// leg only that engine evaluates, and the false branch as the nonsense
// control — a page that merely echoes the oracle fails the false leg.
//
// ORACLE (per engine, each leg repeated at the same reflection point
// unless noted — the proof-#18 guards from oracleGuards.js:
// stripVolatileValues + sameReflectionPoint, because a fresh
// per-request token can contain 9352 by chance):
//   FreeMarker: ${1336*7} -> 9352; ${(true)?then(9352,1111)} -> 9352;
//     ${(false)?then(9352,1111)} -> 1111 (nonsense control).
//   Velocity: #set($dmv=1336*7)$dmv -> 9352;
//     #if(true)9352#else 1111#end -> 9352;
//     #if(false)9352#else 1111#end -> 1111 (nonsense control).
//   Thymeleaf: ${1336*7} -> 9352 (shared screen with FreeMarker —
//     ${...} is both engines' interpolation; the discriminator below
//     is what separates them);
//     ${#strings.toUpperCase('dmtest')} -> DMTEST (#strings is a
//     Thymeleaf-only expression utility object; FreeMarker and JSP EL
//     have no such object);
//     ${false ? 9352 : 1111} -> 1111 (nonsense control; FreeMarker has
//     no ?: ternary, so it cannot render this leg).
//   Smarty: {math equation="1336*7"} -> 9352;
//     {if true}9352{else}1111{/if} -> 9352;
//     {if false}9352{else}1111{/if} -> 1111 (nonsense control).
//   ERB: <%= 1336*7 %> -> 9352; <%= true ? 9352 : 1111 %> -> 9352;
//     <%= false ? 9352 : 1111 %> -> 1111 (nonsense control).
//   Handlebars: {{#if true}}9352{{else}}1111{{/if}} -> 9352;
//     {{#if false}}9352{{else}}1111{{/if}} -> 1111 (nonsense control).
//     There is no arithmetic leg — {{ }} is a lookup in Handlebars,
//     so the #if block helper IS the evaluation proof.
//   Pug: #{1336*7} -> 9352; #{true ? 9352 : 1111} -> 9352;
//     #{false ? 9352 : 1111} -> 1111 (nonsense control).
//   A finding fires ONLY when every leg of one engine confirms.
//   The generic and Pebble findings can both stand on one sink
//   without colliding in the dedupe key (class + parameter + title);
//   these findings carry engine-specific ids/titles for the same reason.
//
// REQUEST BUDGET: one shared control + one screen request per DISTINCT
// leg-0 payload (6 — FreeMarker and Thymeleaf share ${1336*7}) per
// param, then full confirmation ONLY for engines whose screen fired
// (repeat + discriminator + nonsense control, Pebble-style). A target
// with no SSTI at all costs 7 requests per param — the same as the
// Pebble probe — instead of 30+ for a naive per-engine loop.
//
// GATES: none beyond the battery itself. Read-only GETs against the
// scan targets, the same surface ssti.js uses, at every depth.
// Findings are class 'ssti' with an engine-specific id/title.
//
// LITERAL CHECK (stronger than Pebble's): the judge uses
// isPayloadReflected, which catches the payload in ANY encoding (raw,
// percent-encoded, form-encoded, HTML-escaped) — a raw-only check
// would confirm an HTML-escaped reflection of an ERB payload, whose
// &lt;...&gt; form still carries the oracle digits. This matters here
// because several discriminator payloads contain the oracle digits
// themselves (?then(9352,1111), ternary legs): the false leg is what
// makes those self-referential payloads safe — a page reflecting the
// payload (even stripped of delimiters) renders 9352 on the false leg
// too, and the false leg requires 9352 ABSENT.
//
// HONEST LIMITS: no dedicated lab exists for any of these six engines
// — verified against local mock servers only (one evaluator stub per
// engine, a Jinja2-style stub, a literal reflector, and the proof-#18
// fresh-token shape). A live-engine target proof is a later lane.
// Engine versions differ in which functions exist; this probe uses
// only core syntax present in every release of each engine (FreeMarker
// ?then, Velocity #set/#if, Thymeleaf #strings, Smarty {math}/{if},
// ERB <%= %>, Handlebars #if, Pug #{}), so a version gap cannot flip
// the verdict — but a sink that evaluates templates only in a POST
// body or a header is out of scope here (GET params only, like
// ssti.js). Thymeleaf sinks that only evaluate th:* attributes (never
// raw ${...} in template text) are also out of scope: this probe
// assumes the input is processed as a Thymeleaf expression, the
// standard SSTI shape for the engine.

import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
import { stripVolatileValues, sameReflectionPoint, isPayloadReflected } from './oracleGuards.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_PARAMS = 10;
const ORACLE = '9352';
const OTHER_BRANCH = '1111';

function ev(request, response, impact, engine) {
  return { request, response, impact_demo: impact, signalCorrelated: true, engine };
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

// ---- the engine table (pure data; exported via engineLegs()) -----------

const ENGINES = [
  {
    key: 'freemarker',
    row: 288,
    name: 'FreeMarker',
    severity: 'critical',
    legs: [
      { payload: '${1336*7}', expected: ORACLE },
      { payload: '${(true)?then(9352,1111)}', expected: ORACLE },
      { payload: '${(false)?then(9352,1111)}', expected: OTHER_BRANCH },
    ],
  },
  {
    key: 'velocity',
    row: 289,
    name: 'Velocity',
    severity: 'critical',
    legs: [
      { payload: '#set($dmv=1336*7)$dmv', expected: ORACLE },
      { payload: '#if(true)9352#else 1111#end', expected: ORACLE },
      { payload: '#if(false)9352#else 1111#end', expected: OTHER_BRANCH },
    ],
  },
  {
    key: 'thymeleaf',
    row: 290,
    name: 'Thymeleaf',
    severity: 'critical',
    legs: [
      { payload: '${1336*7}', expected: ORACLE },
      { payload: "${#strings.toUpperCase('dmtest')}", expected: 'DMTEST' },
      { payload: '${false ? 9352 : 1111}', expected: OTHER_BRANCH },
    ],
  },
  {
    key: 'smarty',
    row: 291,
    name: 'Smarty',
    severity: 'critical',
    legs: [
      { payload: '{math equation="1336*7"}', expected: ORACLE },
      { payload: '{if true}9352{else}1111{/if}', expected: ORACLE },
      { payload: '{if false}9352{else}1111{/if}', expected: OTHER_BRANCH },
    ],
  },
  {
    key: 'erb',
    row: 292,
    name: 'ERB',
    severity: 'critical',
    legs: [
      { payload: '<%= 1336*7 %>', expected: ORACLE },
      { payload: '<%= true ? 9352 : 1111 %>', expected: ORACLE },
      { payload: '<%= false ? 9352 : 1111 %>', expected: OTHER_BRANCH },
    ],
  },
  {
    key: 'handlebars',
    row: 293,
    name: 'Handlebars',
    severity: 'high',
    legs: [
      { payload: '{{#if true}}9352{{else}}1111{{/if}}', expected: ORACLE },
      { payload: '{{#if false}}9352{{else}}1111{{/if}}', expected: OTHER_BRANCH },
    ],
  },
  {
    key: 'pug',
    row: 293,
    name: 'Pug',
    severity: 'high',
    legs: [
      { payload: '#{1336*7}', expected: ORACLE },
      { payload: '#{true ? 9352 : 1111}', expected: ORACLE },
      { payload: '#{false ? 9352 : 1111}', expected: OTHER_BRANCH },
    ],
  },
];

/** The engine table. Pure — callers must not mutate it. */
export function engineLegs() {
  return ENGINES;
}

// ---- pure helpers (exported for unit tests) ------------------------------

/**
 * Judge one evaluated leg: the expected value is present, the payload
 * is not reflected in ANY encoding (isPayloadReflected — raw,
 * percent-encoded, form-encoded, HTML-escaped), the stripped control
 * lacks the value, and a repeat renders it at the same reflection
 * point. Pure.
 */
export function assessEngineLeg({ controlRaw, bodyRaw, bodyRepeatRaw, payload, expected }) {
  if (bodyRaw === null || bodyRepeatRaw === null || controlRaw === null) {
    return { verdict: 'unconfirmed', reason: 'a request failed' };
  }
  if (isPayloadReflected(bodyRaw, payload)) {
    return { verdict: 'rejected', reason: 'payload reflected (raw or encoded) — never evaluated' };
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

/**
 * Judge the nonsense (false-branch) leg: the OTHER value renders, the
 * oracle does NOT, the payload is not reflected in any encoding, and
 * the control carries neither value. No repeat (Pebble shape). Pure.
 */
export function assessFalseLeg({ controlRaw, bodyRaw, payload }) {
  if (bodyRaw === null || controlRaw === null) return false;
  if (isPayloadReflected(bodyRaw, payload)) return false;
  const control = stripVolatileValues(controlRaw);
  const body = stripVolatileValues(bodyRaw);
  if (!body.includes(OTHER_BRANCH)) return false;
  if (control.includes(OTHER_BRANCH)) return false;
  if (body.includes(ORACLE)) return false;
  return true;
}

/**
 * Screen check (no repeat yet): the expected value is present, the
 * payload is not reflected in any encoding, and the stripped control
 * lacks the value. Pure.
 */
export function screenPasses({ controlRaw, bodyRaw, payload, expected }) {
  if (bodyRaw === null || controlRaw === null) return false;
  if (isPayloadReflected(bodyRaw, payload)) return false;
  if (stripVolatileValues(controlRaw).includes(expected)) return false;
  return stripVolatileValues(bodyRaw).includes(expected);
}

// ---- the probe ---------------------------------------------------------------

export async function probeSstiEngines(url, params, opts = {}) {
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
  const confirmedEngines = [];
  for (const param of points) {
    paramsTried += 1;
    setDiag('paramsTried', paramsTried);
    const controlRaw = await get(fetchFn, mutateUrl(url, param, `dm_${randomBytes(3).toString('hex')}`), opts);
    attempts += 1;
    if (controlRaw === null) continue;

    // Screen: one request per DISTINCT leg-0 payload (FreeMarker and
    // Thymeleaf share ${1336*7}, so 6 requests cover 7 engines).
    const screens = new Map();
    for (const engine of ENGINES) {
      const leg0 = engine.legs[0];
      if (!screens.has(leg0.payload)) {
        const raw = await get(fetchFn, mutateUrl(url, param, leg0.payload), opts);
        attempts += 1;
        screens.set(leg0.payload, raw);
      }
    }

    for (const engine of ENGINES) {
      const [leg0, ...rest] = engine.legs;
      const screenRaw = screens.get(leg0.payload);
      if (!screenPasses({ controlRaw, bodyRaw: screenRaw, payload: leg0.payload, expected: leg0.expected })) continue;

      // Confirm leg 0 with a repeat (guard b).
      const leg0RepeatRaw = await get(fetchFn, mutateUrl(url, param, leg0.payload), opts);
      attempts += 1;
      if (leg0RepeatRaw === null) continue;
      const leg0Verdict = assessEngineLeg({
        controlRaw,
        bodyRaw: screenRaw,
        bodyRepeatRaw: leg0RepeatRaw,
        payload: leg0.payload,
        expected: leg0.expected,
      });
      if (leg0Verdict.verdict !== 'confirmed') continue;

      // The remaining legs: every leg except the last is a repeated
      // evaluated leg; the last leg is the false branch (nonsense
      // control, no repeat — Pebble shape).
      let confirmed = true;
      let confirmEvidence = null;
      for (let i = 0; i < rest.length; i += 1) {
        const leg = rest[i];
        const isFalseLeg = i === rest.length - 1;
        const bodyRaw = await get(fetchFn, mutateUrl(url, param, leg.payload), opts);
        attempts += 1;
        if (bodyRaw === null) {
          confirmed = false;
          break;
        }
        if (isFalseLeg) {
          if (!assessFalseLeg({ controlRaw, bodyRaw, payload: leg.payload })) {
            confirmed = false;
            break;
          }
        } else {
          const repeatRaw = await get(fetchFn, mutateUrl(url, param, leg.payload), opts);
          attempts += 1;
          if (repeatRaw === null) {
            confirmed = false;
            break;
          }
          const v = assessEngineLeg({
            controlRaw,
            bodyRaw,
            bodyRepeatRaw: repeatRaw,
            payload: leg.payload,
            expected: leg.expected,
          });
          if (v.verdict !== 'confirmed') {
            confirmed = false;
            break;
          }
          if (!confirmEvidence) {
            const stripped = stripVolatileValues(bodyRaw);
            const idx = stripped.indexOf(leg.expected);
            confirmEvidence = stripped.slice(Math.max(0, idx - 60), idx + 60);
          }
        }
      }
      if (!confirmed) continue;

      confirmedEngines.push(engine.key);
      setDiag('confirmedEngines', [...confirmedEngines]);
      const stripped0 = stripVolatileValues(screenRaw);
      const idx0 = stripped0.indexOf(leg0.expected);
      const window0 = stripped0.slice(Math.max(0, idx0 - 60), idx0 + 60);
      const discrim = rest[rest.length - 2] || leg0;
      findings.push({
        class: 'ssti',
        id: `ssti-${engine.key}-${probePointName(param)}`,
        title: `Server-side template injection (${engine.name} engine) in parameter '${probePointParameter(param)}'`,
        severity: engine.severity,
        url,
        param: probePointParameter(param),
        parameter: probePointParameter(param),
        evidence: ev(
          `GET ${mutateUrl(url, param, leg0.payload)} and GET ${mutateUrl(url, param, discrim.payload)}`,
          `${engine.name} evaluated: ${leg0.payload} rendered ${leg0.expected} (literal absent in any encoding; absent from control; repeat at the same reflection point) and the false branch rendered ${OTHER_BRANCH} instead of ${ORACLE} — "...${window0}..."${confirmEvidence ? ` discriminator "...${confirmEvidence}..."` : ''}`,
          `${engine.name} template engine executes attacker input — the ${discrim.payload} discriminator is ${engine.name}-specific, so this fingerprints the engine, not just generic template evaluation`,
          engine.key,
        ),
      });
    }
  }
  setDiag('attempts', attempts);
  return findings;
}

export const __sstiEnginesMeta = { phases: ['ssti-engines'], depth: ['quick', 'standard', 'deep'] };
