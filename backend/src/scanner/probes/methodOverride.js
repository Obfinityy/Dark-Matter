// Dark Matter rule-based scanner — HTTP method-override + Content-Type
// confusion probe (coverage rows #387 + #388, phase 68).
//
// #387 METHOD OVERRIDE: some frameworks honour an override signal on an
// otherwise ordinary GET — the `X-HTTP-Method-Override` header, or a
// `_method` query parameter (Rails / Laravel / Express method-override
// style) — and dispatch the request to the PUT/DELETE/PATCH handler.
// That is a distinct primitive from verb tampering: the direct verb may
// be refused (405) while the override sails through, or the override
// may reproduce the verb's behaviour on a GET-only endpoint.
//
// #388 CONTENT-TYPE CONFUSION: an endpoint that accepts the same
// parameters under a different Content-Type than it declares — a POST
// form (native application/x-www-form-urlencoded) that also processes
// an application/json body, or a GET endpoint whose query parameters
// are also accepted as a POST JSON / form body. The confusion is real
// only when the parameters are observably PROCESSED, never when both
// responses merely look alike.
//
// VERIFICATION (100% truth rule): every finding is a differential
// against TWO references, never a single response:
//   #387 (a) OVERRIDE CONFUSION — the override response is 2xx AND
//       substantively the same as the DIRECT verb response
//       (similarity >= 0.9) AND clearly different from the GET
//       baseline (similarity < 0.9): the server routed on the
//       override, and the overridden method behaves differently
//       from GET. When the override is ignored the response IS the
//       GET baseline — never a finding. When the verb itself behaves
//       like GET, verb-tampering already found it — no duplicate.
//   #387 (b) OVERRIDE BYPASS — the direct verb is refused (non-2xx)
//       while the override response is 2xx AND carries a JSON success
//       marker the GET baseline does NOT: the override achieved
//       something the direct verb could not.
//   #388 (form) — the JSON POST is 2xx AND substantively the same
//       as the native form POST (similarity >= 0.9) AND the form POST
//       itself differs from a plain GET of the action
//       (similarity < 0.9): the parameters were processed under
//       both encodings. When the form POST returns the same page as
//       a plain GET (e.g. a failed-login page), the parameters are
//       unobservable and nothing fires — that kills the
//       "JSON ignored, same page back" false positive.
//   #388 (GET endpoint) — the POST JSON / form body is 2xx AND
//       substantively the same as the GET-with-params baseline
//       (similarity >= 0.9) AND the GET-with-params baseline differs
//       from a plain GET of the bare path (similarity < 0.9): the
//       body-carried parameters were processed exactly like the query
//       parameters. Targets with no query parameters skip this
//       vector (no parameters to confuse).
// A 405/501/404/3xx on any variant is NOT a finding. Exact status
// codes plus body hash/length comparisons land in the evidence.
//
// SAFETY: the direct write verbs (PUT/DELETE/PATCH) and every POST
// run ONLY when opts.allowWrite === true — the same lab gate runScan
// sets solely for lab targets (labTargets), exactly like
// verb-tampering and file-upload. Without it the probe sends nothing
// at all and returns []: the override comparison needs the direct-verb
// reference, and no speculative finding is ever emitted. The override
// GETs themselves are GETs, but without the reference they cannot
// prove anything, so they do not leave either. No OPTIONS requests.
import { createHash } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

// Methods the override can impersonate.
const WRITE_METHODS = ['PUT', 'DELETE', 'PATCH'];
// One method-variant set per distinct endpoint URL — a URL with five
// params is one endpoint, not five. Bounds the request count.
const MAX_URLS = 10;
const MAX_FORMS = 10;
const SIMILARITY_THRESHOLD = 0.9;

// A JSON success field — tight enough that an error page cannot
// match it (it needs a success/result/status key with a truthy or
// past-tense value), loose enough for {"success":true} /
// {"status":"updated"} shapes. Same marker verbTampering uses.
const SUCCESS_MARKER_RE =
  /"(success|result|status)"\s*:\s*(true|"ok"|"success"|"updated"|"deleted"|"created"|"done")/i;

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function normLen(t) {
  return String(t || '').replace(/\s+/g, ' ').trim().length;
}

// Length-ratio similarity — the same measure rpo.js uses (threshold
// 0.9 there). Two pages of the same shape score high; an error page
// of a different size scores low.
function similarity(a, b) {
  const la = normLen(a);
  const lb = normLen(b);
  if (!la || !lb) return 0;
  return Math.min(la, lb) / Math.max(la, lb);
}

async function request(url, method, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      body: opts.body !== undefined ? opts.body : undefined,
      // Baseline GETs follow redirects (the scanner's normal GET);
      // every other request is manual — a redirect is never an
      // acceptance.
      redirect: method === 'GET' && !opts.body ? 'follow' : 'manual',
    });
    const text = method === 'HEAD' ? '' : await res.text().catch(() => '');
    return {
      status: res.status,
      text: text.slice(0, 500000),
      // Final URL after redirects (mocked fetch has no .url — the
      // requested URL is the fallback).
      url: res.url || url,
      ct: (res.headers && res.headers.get('content-type')) || '',
    };
  } catch {
    return { status: 0, text: '', url, ct: '' };
  } finally {
    clearTimeout(t);
  }
}

function is2xx(r) {
  return r && r.status >= 200 && r.status < 300;
}

// Unique filler values for a form's inputs — the same safety rule the
// param battery uses (never empty, never equal): a state-changing
// gate that requires matching values can never fire on them.
function formFillers(form) {
  const values = {};
  let n = 0;
  // Inputs are { name, type, value } objects (D1, #474 repair) —
  // the filler map is keyed by NAME, never by the object itself.
  for (const inp of form.inputs || []) {
    const name = inp.name;
    if (!name) continue;
    if (/^submit$/i.test(name)) values[name] = '1';
    else values[name] = `dmprobe${++n}_${Math.random().toString(16).slice(2, 6)}`;
  }
  return values;
}

function urlencoded(values) {
  return new URLSearchParams(values).toString();
}

function stripSearch(u) {
  try {
    const parsed = new URL(u);
    parsed.search = '';
    return parsed.toString();
  } catch {
    return u;
  }
}

function withMethodParam(u, method) {
  try {
    const parsed = new URL(u);
    if (parsed.searchParams.has('_method')) return null;
    parsed.searchParams.set('_method', method);
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Probe method-override (#387) and Content-Type confusion (#388).
 * @param {string[]} urls — distinct GET probe-target endpoint URLs.
 * @param {object[]} postForms — POST forms ({ method, action, inputs }).
 * @param {object} opts — { timeoutMs, headers, allowWrite }.
 *   allowWrite === true (lab gate) is required: without it the probe
 *   sends nothing and returns [].
 * @returns {object[]} findings (classes 'method_override' and
 *   'content_type_confusion', medium).
 */
export async function probeMethodOverride(urls, postForms = [], opts = {}) {
  const findings = [];
  // LAB GATE: the direct write verbs and every POST need it, and the
  // override comparison needs the direct-verb reference — without it
  // no rigorous finding is possible, so nothing is sent at all.
  if (!opts || opts.allowWrite !== true) return findings;
  const targets = [...new Set((Array.isArray(urls) ? urls : []).filter(Boolean))].slice(0, MAX_URLS);

  for (const targetUrl of targets) {
    // GET baseline — the endpoint must be a live GET endpoint, and
    // the variants go to the URL that actually serves content.
    const base = await request(targetUrl, 'GET', opts);
    if (!is2xx(base)) continue;
    const finalUrl = base.url || targetUrl;
    const baseHash = sha12(base.text);
    const baseLen = base.text.length;
    const baseSuccess = SUCCESS_MARKER_RE.test(base.text);

    // ---- #387: method override (header, then _method param) ----
    for (const method of WRITE_METHODS) {
      // Direct-verb reference — the same empty-body replay
      // verb-tampering makes.
      const direct = await request(finalUrl, method, opts);
      const vectors = [
        {
          name: `X-HTTP-Method-Override: ${method}`,
          req: () =>
            request(finalUrl, 'GET', {
              ...opts,
              headers: { ...(opts.headers || {}), 'X-HTTP-Method-Override': method },
            }),
        },
      ];
      const methodUrl = withMethodParam(finalUrl, method);
      if (methodUrl) {
        vectors.push({ name: `_method=${method}`, req: () => request(methodUrl, 'GET', opts) });
      }
      for (const v of vectors) {
        const o = await v.req();
        if (!is2xx(o)) continue;
        const simDirect = similarity(o.text, direct.text);
        const simBase = similarity(o.text, base.text);
        const oSuccess = SUCCESS_MARKER_RE.test(o.text);
        const directSuccess = SUCCESS_MARKER_RE.test(direct.text);
        // (a) override confusion: matches the direct verb, differs
        // from GET. (b) override bypass: direct verb refused, but
        // the override carries a success marker the baseline lacks.
        const confused = simDirect >= SIMILARITY_THRESHOLD && simBase < SIMILARITY_THRESHOLD;
        const bypass =
          !is2xx(direct) && oSuccess && !baseSuccess && directSuccess === false;
        if (!confused && !bypass) continue;
        findings.push({
          class: 'method_override',
          id: `method-override-${method.toLowerCase()}-${sha12(finalUrl)}`,
          title: confused
            ? `HTTP method override — ${v.name} honoured on a GET endpoint (override confusion)`
            : `HTTP method override — ${v.name} bypassed the direct-verb refusal (override bypass)`,
          severity: 'medium',
          url: finalUrl,
          parameter: v.name,
          evidence: {
            request: `GET ${finalUrl} with ${v.name}; baseline GET ${finalUrl}; direct ${method} ${finalUrl} (empty body)`,
            response:
              `GET ${base.status} (${baseLen} bytes, sha256 ${baseHash}) vs ` +
              `direct ${method} ${direct.status} vs ` +
              `override ${o.status} (${o.text.length} bytes, sha256 ${sha12(o.text)}), ` +
              `override-vs-direct similarity ${simDirect.toFixed(2)}, ` +
              `override-vs-GET similarity ${simBase.toFixed(2)}` +
              (confused ? ' — server routed on the override, and the overridden method behaves differently from GET' : '') +
              (bypass ? ' — direct verb refused, override carries a success marker the GET baseline does not' : '') +
              '.',
            impact_demo:
              'Method-override primitive — an endpoint that only documents GET dispatches on an override signal; chain with auth-gated actions for privilege/state impact.',
            signalCorrelated: true,
          },
        });
        break; // one finding per method per URL — first firing vector wins
      }
    }

    // ---- #388 vector 2: body-carried params on a GET endpoint ----
    // Only targets that actually carry query parameters: with no
    // parameters there is nothing to confuse, and a bare path's POST
    // would only re-test verb acceptance (empty-body POST is not in
    // this probe's scope).
    let queryParams = null;
    try {
      queryParams = new URL(finalUrl).searchParams;
    } catch {
      queryParams = null;
    }
    if (queryParams && [...queryParams.keys()].length > 0) {
      const barePath = stripSearch(finalUrl);
      const plain = await request(barePath, 'GET', opts);
      if (is2xx(plain) && similarity(base.text, plain.text) < SIMILARITY_THRESHOLD) {
        const values = {};
        for (const [k, v] of queryParams.entries()) values[k] = v;
        const variants = [
          {
            ct: 'application/json',
            body: JSON.stringify(values),
            label: 'JSON body',
          },
          {
            ct: 'application/x-www-form-urlencoded',
            body: urlencoded(values),
            label: 'form-encoded body',
          },
        ];
        for (const variant of variants) {
          const r = await request(barePath, 'POST', {
            ...opts,
            headers: { ...(opts.headers || {}), 'Content-Type': variant.ct },
            body: variant.body,
          });
          if (!is2xx(r)) continue;
          const sim = similarity(r.text, base.text);
          if (sim < SIMILARITY_THRESHOLD) continue;
          findings.push({
            class: 'content_type_confusion',
            id: `content-type-confusion-get-${sha12(finalUrl)}-${variant.ct === 'application/json' ? 'json' : 'form'}`,
            title: `Content-Type confusion — ${variant.label} processed like query parameters on a GET endpoint`,
            severity: 'medium',
            url: barePath,
            parameter: variant.ct,
            evidence: {
              request: `POST ${barePath} (${variant.ct}, same parameters as GET ${finalUrl})`,
              response:
                `GET with params ${base.status} (${baseLen} bytes, sha256 ${baseHash}) vs ` +
                `plain GET ${plain.status} (${plain.text.length} bytes) vs ` +
                `${variant.label} POST ${r.status} (${r.text.length} bytes, sha256 ${sha12(r.text)}), ` +
                `POST-vs-GET-with-params similarity ${sim.toFixed(2)}, ` +
                `GET-with-params-vs-plain-GET similarity ${similarity(base.text, plain.text).toFixed(2)} — ` +
                `the body-carried parameters were processed exactly like the query parameters.`,
              impact_demo:
                'Content-Type confusion primitive — an endpoint that only documents GET query parameters also accepts the same parameters as a POST body; chain with parser differentials (JSON parsed as form, or vice versa) for auth/state impact.',
              signalCorrelated: true,
            },
          });
        }
      }
    }
  }

  // ---- #388 vector 1: JSON body processed like a form POST ----
  const forms = [];
  const formSeen = new Set();
  for (const f of Array.isArray(postForms) ? postForms : []) {
    if (!f || !f.action) continue;
    const key = `${String(f.method || 'post').toLowerCase()}|${f.action}|${(f.inputs || []).map((i) => i.name).join(',')}`;
    if (formSeen.has(key)) continue;
    formSeen.add(key);
    forms.push(f);
    if (forms.length >= MAX_FORMS) break;
  }
  for (const form of forms) {
    const values = formFillers(form);
    // Plain GET of the action — the "no parameters" reference.
    const plain = await request(form.action, 'GET', opts);
    if (!is2xx(plain)) continue;
    // Native form POST (urlencoded) — the baseline the JSON variant
    // must match.
    const native = await request(form.action, 'POST', {
      ...opts,
      headers: { ...(opts.headers || {}), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: urlencoded(values),
    });
    if (!is2xx(native)) continue;
    // The form POST must observably process the parameters — if it
    // returns the same page as a plain GET, nothing distinguishes
    // "JSON parsed as form" from "JSON ignored".
    if (similarity(native.text, plain.text) >= SIMILARITY_THRESHOLD) continue;
    const json = await request(form.action, 'POST', {
      ...opts,
      headers: { ...(opts.headers || {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!is2xx(json)) continue;
    const sim = similarity(json.text, native.text);
    if (sim < SIMILARITY_THRESHOLD) continue;
    findings.push({
      class: 'content_type_confusion',
      id: `content-type-confusion-form-${sha12(form.action)}`,
      title: 'Content-Type confusion — JSON body processed like a form POST',
      severity: 'medium',
      url: form.action,
      parameter: 'application/json',
      evidence: {
        request: `POST ${form.action} (application/json, same fields as the native form POST)`,
        response:
          `plain GET ${plain.status} (${plain.text.length} bytes, sha256 ${sha12(plain.text)}) vs ` +
          `form POST ${native.status} (${native.text.length} bytes, sha256 ${sha12(native.text)}) vs ` +
          `JSON POST ${json.status} (${json.text.length} bytes, sha256 ${sha12(json.text)}), ` +
          `JSON-vs-form similarity ${sim.toFixed(2)}, ` +
          `form-vs-plain-GET similarity ${similarity(native.text, plain.text).toFixed(2)} — ` +
          `the server parsed the JSON body as form parameters.`,
        impact_demo:
          'Content-Type confusion primitive — a form endpoint that declares urlencoded also processes a JSON body as the same parameters; chain with parser differentials for auth/state impact.',
        signalCorrelated: true,
      },
    });
  }

  return findings;
}

export const __methodOverrideMeta = { phases: ['method-override'], depth: ['quick', 'standard', 'deep'] };
