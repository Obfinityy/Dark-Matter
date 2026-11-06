// Dark Matter rule-based scanner — JSONP callback-injection detector (#49).
//
// Defensive purpose: detect JSONP endpoints with attacker-controlled
// callback names on authorized targets so the owner can harden them.
// Detection is string-level only — payloads are never rendered in a
// browser; no stored state is created.
//   D1. Surface inventory: callback/jsonp/cb params, `name({...})`
//       response shapes, JS content-types on JSON bodies.
//   D2. Arbitrary-callback reflection — HIGH: unique dmCb<RUNID> reflected
//       verbatim as the wrapper with executable Content-Type; validation
//       probed with paren/semicolon variants (string-level, never executed).
//   D3. Authenticated-data exfiltration — HIGH: sensitive JSON wrapped in
//       attacker-controlled callback (needs authorized session; own data).
//   D4. Validation hardening — INFO: strict identifier regex recorded.
//   D5. Error-oracle smell — MEDIUM/INFO.
//
// Class key: jsonpinjection (no double-count vs xss.js). Per-run canary.
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function getFull(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 300000), ct: res.headers.get('content-type') || '' };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const JSONP_PARAM_RES = /^(callback|jsonp|cb|jsoncallback|json_callback|jscallback)$/i;
const JSONP_WRAP_RES = /^\s*[\w$.]+\s*\(\s*[\[{]/;
const JS_CT_RES = /javascript|ecmascript/i;
const SENSITIVE_RES = /email|phone|token|ssn|password|address|card|account|balance|order/i;
// Error-oracle smell: internal error disclosure on a malformed callback
// (stack traces, file/line leaks, uncaught exceptions). A plain "invalid
// callback" rejection is validation, not a smell, so it is not matched.
const ERROR_SMELL_RES = /(stack trace|traceback|uncaught (type|reference|syntax)error|fatal error|\.php on line \d+|line \d+, in <module>)/i;

// ---- D1: surface inventory ---------------------------------------------------------------------
function jsonpParams(params) {
  return (params || []).filter((p) => JSONP_PARAM_RES.test(probePointName(p)));
}

// ---- D2: arbitrary-callback reflection ------------------------------------------------------------
// Returns { hits, errorSmells, probed }: hits are verbatim reflections;
// errorSmells are internal-error disclosures on the malformed-callback
// probe (D5); probed counts successful fetches (D4 needs at least one).
async function d2Reflection(url, cbParams, opts, rid) {
  const out = { hits: [], errorSmells: [], probed: 0 };
  const cb = `dmCb${rid}`;
  for (const p of cbParams.slice(0, 4)) {
    const r = await getFull(mutateUrl(url, p, cb), opts);
    if (!r) continue;
    out.probed += 1;
    const verbatim = r.text.includes(`${cb}(`) && JS_CT_RES.test(r.ct);
    // Validation probe: paren variant, string-level only.
    const r2 = await getFull(mutateUrl(url, p, `${cb}x(1)`), opts);
    const unsanitized = r2 && r2.text.includes(`${cb}x(1)`);
    if (r2 && ERROR_SMELL_RES.test(r2.text)) {
      const m = r2.text.match(ERROR_SMELL_RES);
      const idx = r2.text.indexOf(m[0]);
      out.errorSmells.push({
        param: probePointParameter(p),
        snippet: r2.text.slice(Math.max(0, idx - 60), idx + 120),
      });
    }
    if (verbatim) {
      const sMatch = r.text.match(SENSITIVE_RES);
      const sIdx = sMatch ? r.text.indexOf(sMatch[0]) : -1;
      out.hits.push({
        param: probePointParameter(p), unsanitized: !!unsanitized,
        sensitive: SENSITIVE_RES.test(r.text),
        sample: r.text.slice(0, 200),
        sensitiveWindow: sIdx >= 0 ? r.text.slice(Math.max(0, sIdx - 60), sIdx + 120) : null,
        sensitiveField: sMatch ? sMatch[0] : null,
      });
    }
  }
  return out;
}

export async function probeJsonp(url, params, opts = {}) {
  const findings = [];
  const cbParams = jsonpParams(params);
  // Also detect JSONP-shaped responses even without a known param.
  let shaped = cbParams.length > 0;
  if (!shaped) {
    const r0 = await getFull(url, opts);
    if (r0 && JSONP_WRAP_RES.test(r0.text) && JS_CT_RES.test(r0.ct)) shaped = true;
  }
  if (!shaped) return findings; // no JSONP surface — INFO, not a miss
  const rid = rand();
  const targets = cbParams.length ? cbParams : ['callback'];
  const d2 = await d2Reflection(url, targets, opts, rid);
  for (const hit of d2.hits) {
    if (hit.unsanitized) {
      findings.push({
        class: 'jsonpinjection',
        id: `jsonp-xss-${rand()}`,
        title: 'JSONP callback injection — reflected XSS in script context (HIGH)',
        severity: 'high',
        url,
        parameter: probePointParameter(hit.param),
        evidence: ev(
          `GET ${mutateUrl(url, hit.param, `dmCb${rid}`)} (string-level reflection check, never rendered)`,
          `Unique callback reflected VERBATIM as the JS wrapper — "${hit.sample}" — paren variant also unsanitized; callback parameter is a reflected-XSS sink in a script context.`,
          'Defensive finding: JSONP callback needs strict identifier validation.'
        ),
      });
    } else {
      findings.push({
        class: 'jsonpinjection',
        id: `jsonp-refl-${rand()}`,
        title: 'JSONP arbitrary callback reflected (HIGH)',
        severity: 'high',
        url,
        parameter: probePointParameter(hit.param),
        evidence: ev(
          `GET ${mutateUrl(url, hit.param, `dmCb${rid}`)}`,
          `Callback reflected verbatim with executable content-type — "${hit.sample}" (validation blocked parens — hardening partial).`,
          'Defensive finding: callback reflection present; tighten validation.'
        ),
      });
    }
    // D3: authenticated-data exfiltration — only with an authorized session
    // and only the session's own data (documented; fires when D2 confirms
    // on an endpoint returning sensitive JSON under ambient credentials).
    if (hit.sensitive && opts.authenticated) {
      findings.push({
        class: 'jsonpinjection',
        id: `jsonp-exfil-${rand()}`,
        title: 'JSONP data exfiltration — sensitive JSON in attacker callback (HIGH)',
        severity: 'high',
        url,
        parameter: probePointParameter(hit.param),
        evidence: ev(
          `GET ${mutateUrl(url, hit.param, `dmCb${rid}`)} (authorized session, own data)`,
          `Sensitive field "${hit.sensitiveField}" wrapped in attacker-controlled callback — "...${hit.sensitiveWindow || hit.sample}..." — cross-origin data theft via script include.`,
          'Defensive finding: authenticated JSONP endpoint needs callback lockdown or CORS migration.'
        ),
      });
      break;
    }
    break; // dedupe: one finding per endpoint
  }
  if (d2.hits.length === 0) {
    // D4: validation held — shaped endpoint, arbitrary callback not
    // reflected verbatim. Only when at least one probe fetch succeeded;
    // a dead endpoint proves nothing about validation.
    if (d2.probed > 0) {
      findings.push({
        class: 'jsonpinjection',
        id: `jsonp-valid-${rand()}`,
        title: 'JSONP callback validation held — arbitrary callback not reflected (INFO)',
        severity: 'info',
        url,
        parameter: probePointParameter(targets[0]),
        evidence: ev(
          `GET ${mutateUrl(url, targets[0], `dmCb${rid}`)}`,
          `Arbitrary callback dmCb${rid} NOT reflected verbatim — endpoint validates callback names (or does not reflect the parameter).`,
          'Positive hardening note: callback parameter is not a reflected-XSS sink.'
        ),
      });
    }
    // D5: error-oracle smell on the malformed-callback probe.
    const smell = d2.errorSmells[0];
    if (smell) {
      findings.push({
        class: 'jsonpinjection',
        id: `jsonp-err-${rand()}`,
        title: 'JSONP error oracle — malformed callback discloses internals (INFO)',
        severity: 'info',
        url,
        parameter: smell.param,
        evidence: ev(
          `GET ${url}?${smell.param}=dmCb${rid}x(1)`,
          `Malformed callback drew an error disclosure: "${smell.snippet}"`,
          'Error text may leak paths/versions — tighten error handling.'
        ),
      });
    }
  }
  return findings;
}

export const __jsonpMeta = { phases: ['jsonp'], depth: ['quick', 'standard', 'deep'] };
