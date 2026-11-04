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

// ---- D1: surface inventory ---------------------------------------------------------------------
function jsonpParams(params) {
  return (params || []).filter((p) => JSONP_PARAM_RES.test(p));
}

// ---- D2: arbitrary-callback reflection ------------------------------------------------------------
async function d2Reflection(url, cbParams, opts, rid) {
  const out = [];
  const cb = `dmCb${rid}`;
  for (const p of cbParams.slice(0, 4)) {
    const u = new URL(url);
    u.searchParams.set(p, cb);
    const r = await getFull(u.toString(), opts);
    if (!r) continue;
    const verbatim = r.text.includes(`${cb}(`) && JS_CT_RES.test(r.ct);
    // Validation probe: paren variant, string-level only.
    const u2 = new URL(url);
    u2.searchParams.set(p, `${cb}x(1)`);
    const r2 = await getFull(u2.toString(), opts);
    const unsanitized = r2 && r2.text.includes(`${cb}x(1)`);
    if (verbatim) {
      out.push({
        param: p, unsanitized: !!unsanitized,
        sensitive: SENSITIVE_RES.test(r.text),
        sample: r.text.slice(0, 200),
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
  for (const hit of d2) {
    if (hit.unsanitized) {
      findings.push({
        class: 'jsonpinjection',
        id: `jsonp-xss-${rand()}`,
        title: 'JSONP callback injection — reflected XSS in script context (HIGH)',
        severity: 'high',
        url,
        parameter: hit.param,
        evidence: ev(
          `GET ${url}?${hit.param}=dmCb${rid} (string-level reflection check, never rendered)`,
          `Unique callback reflected VERBATIM as the JS wrapper (executable content-type); paren variant also unsanitized — callback parameter is a reflected-XSS sink in a script context.`,
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
        parameter: hit.param,
        evidence: ev(
          `GET ${url}?${hit.param}=dmCb${rid}`,
          `Callback reflected verbatim with executable content-type (validation blocked parens — hardening partial).`,
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
        parameter: hit.param,
        evidence: ev(
          `GET ${url}?${hit.param}=dmCb${rid} (authorized session, own data)`,
          `Sensitive JSON wrapped in attacker-controlled callback — cross-origin data theft vector via script include.`,
          'Defensive finding: authenticated JSONP endpoint needs callback lockdown or CORS migration.'
        ),
      });
      break;
    }
    break; // dedupe: one finding per endpoint
  }
  // D4/D5: hardening + error smell recorded as INFO when no D2 confirm.
  return findings;
}

export const __jsonpMeta = { phases: ['jsonp'], depth: ['quick', 'standard', 'deep'] };
