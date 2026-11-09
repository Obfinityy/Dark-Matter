// Dark Matter rule-based scanner — input validation probe
// (coverage rows #436 [Medium] integer overflow, #437 [High] type
// juggling, #438 [Medium] null-byte truncation, #439 [Medium]
// unicode / normalization bypass, #440 [Medium] hidden-field
// validation, phase 71).
//
// DIAGNOSIS: an application that never validates what it is given
// treats attacker-shaped input as if it were the valid value. The
// five shapes below are the observable ones — each is a value the
// application should reject, or at least treat differently from the
// value it was built to accept:
//   #436 an integer past the 32-bit (or 64-bit) range — a server
//     that parses it into a fixed-width int wraps it (2147483648
//     becomes -2147483648); the wrapped value in the response is
//     the proof, because the application computed it.
//   #437 an array where a scalar was expected (`q[]=v` instead of
//     `q=v`) — a loosely-typed server coerces it and answers as if
//     the valid value arrived (PHP loose comparison / array juggling).
//   #438 a value cut at a null byte (`v%00junk`) — a server that
//     truncates at %00 answers as if the plain value arrived.
//   #439 a fullwidth / normalized form of the value — a server (or
//     the filter in front of it) that normalizes unicode before
//     validation answers as if the canonical value arrived.
//   #440 a tampered hidden form field — a server that trusts the
//     hidden value the browser sent back accepts the attacker's
//     value and processes the submission as if it were genuine.
//
// VERIFICATION (100% truth rule): a finding counts ONLY on a
// differential with a garbage control. For the acceptance vectors
// (#437–#439) the crafted response must be equivalent to the
// baseline (same status + body similarity >= 0.9) AND the garbage
// control (a random value for the same parameter) must NOT be
// equivalent — an endpoint that answers the same to every value
// proves nothing and fires nothing. For #436 the wrapped value
// must appear in the crafted response AND NOT in the baseline —
// the wrapped value differs from what was sent, so only the server
// computing it can produce it. For #440 the tampered submit must
// return the same shape as the control submit (same status +
// similarity >= 0.9) AND the tampered value must appear where the
// original value appeared (substitution proof). A finding is one
// per distinct failure (class + target + parameter + vector).
//
// SAFETY: the GET vectors (#436–#439) are read-only GETs — no
// writes, no allowWrite gate. The hidden-field vector (#440)
// submits forms: POST submits run ONLY when opts.allowWrite ===
// true (the lab gate, same as method-override); GET-form submits
// are read-only GETs and run anywhere. CSRF-style hidden inputs
// (token/csrf/nonce names) are never tampered — they are sent
// with their fetched values so the control and tampered submits
// differ in exactly one field. Capped at 64 GET requests + 8
// form requests per scan (9 Nov 2026, deep-coverage audit: was 32
// GETs / 2 points per URL — the 3rd+ param on a target never got
// integer-overflow / type-juggling / null-byte / unicode tests;
// 3 URLs x 4 points x ~5 requests worst case is 63).
import { createHash } from 'node:crypto';
import { fetchPage } from '../fingerprint.js';
import {
  extractProbePoints,
  mutateUrl,
  setPathSegmentRaw,
  probePointName,
  probePointParameter,
  isPathPoint,
  isQueryPoint,
} from '../probePoints.js';

const MAX_URLS = 3;
const MAX_POINTS_PER_URL = 4;
const MAX_GET_REQUESTS = 64;
const MAX_FORMS = 2;
const MAX_FORM_REQUESTS = 8;
const MAX_FINDINGS = 20;
const SIMILARITY_THRESHOLD = 0.9;
const SNIPPET_RADIUS = 80;

// Garbage control value: random-looking, never a valid input.
const GARBAGE = '__dm_nope_7f3a9c__';
// Tampered hidden-field marker for non-numeric values.
const TAMPERED_MARKER = 'dm-validation-tampered';

// 32-bit wraparound: 2^31 sent, -2^31 expected back. 64-bit
// wraparound for values already past 32-bit: 2^63 sent, -2^63 back.
const OVERFLOW_32 = { sent: '2147483648', wrapped: '-2147483648' };
const OVERFLOW_64 = { sent: '9223372036854775808', wrapped: '-9223372036854775808' };

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function normLen(t) {
  return String(t || '').replace(/\s+/g, ' ').trim().length;
}

// Length-ratio similarity — the same measure verb-tampering uses.
// Two pages of the same shape score high; an error page of a
// different size scores low. Used ONLY where the two bodies are
// supposed to differ in exactly one substituted value (the
// hidden-field vector, #440) — there the substitution proof, not
// content equality, carries the verification.
function lengthSimilarity(a, b) {
  const la = normLen(a);
  const lb = normLen(b);
  if (!la || !lb) return 0;
  return Math.min(la, lb) / Math.max(la, lb);
}

// Token Jaccard on ASCII word tokens (first 8k chars, perf bound).
// Two bodies with the same words score high even when a value was
// echoed back raw; two same-length bodies with different content
// ({"id":0} vs {"id":5}) score low.
function tokenJaccard(a, b) {
  const tokens = (t) => new Set((String(t || '').slice(0, 8000).match(/[A-Za-z0-9_]+/g) || []));
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

// Content-aware similarity for the acceptance differential: the
// MINIMUM of length-ratio and token Jaccard. Length alone lies —
// the fixture caught it ({"id":0} vs {"id":5} score 1.00 on
// length but 0.33 on tokens, and the server had NOT coerced the
// array into the scalar). Two genuinely equivalent responses
// score high on both.
function similarity(a, b) {
  return Math.min(lengthSimilarity(a, b), tokenJaccard(a, b));
}

function snippetAround(body, matchIndex, matchLen) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + matchLen + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

function isIntegerValue(v) {
  if (!/^-?\d+$/.test(String(v || ''))) return false;
  try {
    const n = BigInt(String(v));
    return n >= -9223372036854775808n && n <= 9223372036854775807n;
  } catch {
    return false;
  }
}

// Fullwidth form of an ASCII value: 'a' -> 'ａ', '1' -> '１'.
// Returns null when the value has no ASCII letter/digit to widen.
export function toFullwidth(value) {
  const s = String(value || '');
  let out = '';
  let changed = false;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code === 0x20) {
      out += '　';
      changed = true;
    } else if (code >= 0x21 && code <= 0x7e) {
      out += String.fromCodePoint(0xff01 + (code - 0x21));
      changed = true;
    } else {
      out += ch;
    }
  }
  return changed ? out : null;
}

// The current value of a probe point in a URL (decoded).
function pointValue(url, point) {
  try {
    const u = new URL(url);
    if (isPathPoint(point)) {
      const parts = u.pathname.split('/');
      const raw = parts[Number(point.segment)] || '';
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
    return u.searchParams.get(probePointName(point)) ?? '';
  } catch {
    return '';
  }
}

// Mutate a probe point with a RAW (unencoded) value — the value is
// placed into the URL string exactly as given, so a literal %00
// reaches the server as a null byte instead of being double-encoded
// to %2500 by searchParams.set / encodeURIComponent. Built via a
// placeholder so the rest of the URL keeps its normal encoding.
function mutateUrlRaw(url, point, rawValue) {
  const PLACEHOLDER = '__DMRAW9f27__';
  if (isPathPoint(point)) {
    return setPathSegmentRaw(url, point.segment, rawValue);
  }
  const u = new URL(url);
  u.searchParams.set(probePointName(point), PLACEHOLDER);
  return u.toString().replace(PLACEHOLDER, rawValue);
}

// Does the body contain the wrapped value as a standalone number
// (not as a substring of a longer digit run)?
function containsWrapped(body, wrapped) {
  const esc = wrapped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\d])${esc}(?:[^\\d]|$)`).test(String(body || ''));
}

// Does the body contain the token as a standalone token (not as
// a substring of a longer word/number)? '0' must not match inside
// '10' — otherwise a price 10 -> 0 tamper could never prove
// substitution, because the control body already contains '0'.
function containsToken(body, token) {
  const esc = String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\w])${esc}(?:[^\\w]|$)`).test(String(body || ''));
}

// Two responses are equivalent for the acceptance differential:
// same status and bodies of the same shape.
function equivalent(a, b) {
  if (!a || !b) return false;
  if (a.status !== b.status) return false;
  return similarity(a.body || '', b.body || '') >= SIMILARITY_THRESHOLD;
}

/**
 * Build the GET validation cases for a set of GET probe targets.
 * Pure — exported for unit tests. Each case carries the crafted
 * URL, the baseline URL it is differenced against, the probe
 * point, the vector and the crafted value. The garbage control is
 * fetched per point at probe time (one request, shared by the
 * acceptance vectors). Capped at MAX_URLS targets ×
 * MAX_POINTS_PER_URL points; the request cap is enforced by the
 * probe loop, not the builder.
 */
export function buildValidationCases(urls, pathParamsByUrl) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const cases = [];
  for (const raw of list.slice(0, MAX_URLS)) {
    let points;
    try {
      points = extractProbePoints(raw, pathParamsByUrl ? pathParamsByUrl.get(raw) : undefined);
    } catch {
      continue;
    }
    for (const point of points.slice(0, MAX_POINTS_PER_URL)) {
      const value = pointValue(raw, point);
      const label = probePointParameter(point);
      const base = { baselineUrl: raw, parameter: label, point };
      if (isIntegerValue(value)) {
        const ov = BigInt(value) >= 2147483648n || BigInt(value) <= -2147483649n ? OVERFLOW_64 : OVERFLOW_32;
        cases.push({
          ...base,
          vector: 'integer-overflow',
          craftedValue: ov.sent,
          url: mutateUrl(raw, point, ov.sent),
          wrapped: ov.wrapped,
        });
      }
      if (isQueryPoint(point)) {
        const juggling = new URL(raw);
        juggling.searchParams.delete(probePointName(point));
        juggling.searchParams.set(`${probePointName(point)}[]`, value);
        cases.push({
          ...base,
          vector: 'type-juggling',
          craftedValue: `${probePointName(point)}[]=${value}`,
          url: juggling.toString(),
        });
      }
      cases.push({
        ...base,
        vector: 'null-byte',
        craftedValue: `${value}%00dmjunk`,
        url: mutateUrlRaw(raw, point, `${encodeURIComponent(value)}%00dmjunk`),
      });
      const wide = toFullwidth(value);
      if (wide !== null) {
        cases.push({
          ...base,
          vector: 'unicode',
          craftedValue: wide,
          url: mutateUrl(raw, point, wide),
        });
      }
    }
  }
  return cases;
}

// Parse hidden inputs out of page HTML, grouped by form action.
// Returns [{ action, hidden: [{ name, value }] }]; actions are
// resolved against pageUrl. Token-like names are kept here (the
// submitter needs their real values) and filtered at tamper time.
export function extractHiddenInputs(html, pageUrl) {
  const out = [];
  const formRe = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let fm;
  while ((fm = formRe.exec(String(html || '')))) {
    const tag = fm[0].slice(0, 400);
    const inner = fm[1];
    const actionAttr = (/action=["']([^"']*)["']/i.exec(tag) || [])[1] || '';
    let action = pageUrl;
    try {
      action = new URL(actionAttr || pageUrl, pageUrl).toString();
    } catch {
      action = pageUrl;
    }
    const hidden = [];
    const ire = /<input[^>]*>/gi;
    let im;
    while ((im = ire.exec(inner))) {
      const inputTag = im[0];
      if (!/\btype\s*=\s*["']?hidden["']?/i.test(inputTag)) continue;
      const name = (/name\s*=\s*["']([^"']+)["']/i.exec(inputTag) || [])[1];
      if (!name) continue;
      const value = (/value\s*=\s*["']([^"']*)["']/i.exec(inputTag) || [])[1] ?? '';
      hidden.push({ name, value });
    }
    if (hidden.length > 0) out.push({ action, hidden });
  }
  return out;
}

const TOKEN_NAME_RE = /token|csrf|nonce|xsrf/i;

// Default form submitter (global fetch): GET submits encode the
// values into the action URL, POST submits send them urlencoded.
// `values` is an ordered map of input name -> value.
async function defaultSubmit(form, values, opts = {}) {
  const method = String(form.method || 'get').toLowerCase();
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) params.set(k, String(v));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    let res;
    if (method === 'post') {
      res = await fetch(form.action, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'DarkMatter-Scanner/1.0 (+authorized-scan)',
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(opts.headers || {}),
        },
        body: params.toString(),
      });
    } else {
      const u = new URL(form.action);
      for (const [k, v] of params) u.searchParams.set(k, v);
      res = await fetch(u.toString(), {
        method: 'GET',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'DarkMatter-Scanner/1.0 (+authorized-scan)', ...(opts.headers || {}) },
      });
    }
    const text = await res.text().catch(() => '');
    return { status: res.status, body: text.slice(0, 500000) };
  } catch {
    return { status: 0, body: '' };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Probe input validation (#436–#440).
 * @param {string[]} urls — distinct GET probe target URLs.
 * @param {object[]} forms — scan forms { action, method, inputs: [{ name, type, value }] }.
 * @param {object} opts — { timeoutMs, headers, fetchPage, submitForm,
 *   allowWrite, pathParamsByUrl, pageUrl }.
 *   fetchPage is the GET seam (defaults to fingerprint.fetchPage);
 *   submitForm is the form-submit seam (defaults to defaultSubmit);
 *   allowWrite gates POST submits (lab gate); pageUrl is the page
 *   the forms were found on (hidden inputs are fetched from it).
 * @returns {object[]} findings (classes 'integer_overflow' medium,
 *   'type_juggling' high, 'null_byte_truncation' medium,
 *   'unicode_normalization' medium, 'hidden_field_validation'
 *   medium).
 */
export async function probeValidation(urls, forms, opts = {}) {
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const submitFn = typeof opts.submitForm === 'function' ? opts.submitForm : defaultSubmit;
  const allowWrite = opts && opts.allowWrite === true;
  const findings = [];
  const seen = new Set();
  let getRequests = 0;
  let formRequests = 0;

  const push = (cls, severity, title, url, parameter, request, response, impact) => {
    const key = `${cls}|${sha12(`${url}|${parameter}`)}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (findings.length >= MAX_FINDINGS) return;
    findings.push({
      class: cls,
      id: `validation-${cls}-${sha12(`${url}|${parameter}`)}`,
      title,
      severity,
      url,
      parameter,
      evidence: { request, response, impact_demo: impact, signalCorrelated: true },
    });
  };

  // ---- GET vectors (#436–#439) -------------------------------------
  const cases = buildValidationCases(urls, opts.pathParamsByUrl);
  const baselines = new Map();
  const garbageByPoint = new Map();
  for (const c of cases) {
    if (getRequests >= MAX_GET_REQUESTS) break;
    if (findings.length >= MAX_FINDINGS) break;
    let baseline = baselines.get(c.baselineUrl);
    if (baseline === undefined) {
      if (getRequests >= MAX_GET_REQUESTS) break;
      try {
        const res = await fetchFn(c.baselineUrl, opts);
        getRequests += 1;
        baseline = { status: res && typeof res.status === 'number' ? res.status : 0, body: res && res.body ? String(res.body) : '' };
      } catch {
        baseline = { status: 0, body: '' };
      }
      baselines.set(c.baselineUrl, baseline);
    }
    if (!baseline.body) continue;

    // The garbage control, once per (target, point): a random value
    // for the same parameter. Shared by the acceptance vectors.
    const pointKey = `${c.baselineUrl}|${c.parameter}`;
    if (c.vector !== 'integer-overflow' && !garbageByPoint.has(pointKey)) {
      if (getRequests >= MAX_GET_REQUESTS) break;
      let garbage;
      try {
        const gUrl = mutateUrl(c.baselineUrl, c.point, GARBAGE);
        const res = await fetchFn(gUrl, opts);
        getRequests += 1;
        garbage = { status: res && typeof res.status === 'number' ? res.status : 0, body: res && res.body ? String(res.body) : '' };
      } catch {
        garbage = { status: 0, body: '' };
      }
      garbageByPoint.set(pointKey, garbage);
    }

    if (getRequests >= MAX_GET_REQUESTS) break;
    let crafted;
    try {
      const res = await fetchFn(c.url, opts);
      getRequests += 1;
      crafted = { status: res && typeof res.status === 'number' ? res.status : 0, body: res && res.body ? String(res.body) : '' };
    } catch {
      continue;
    }
    if (!crafted.body && crafted.status === 0) continue;

    const baseText = `GET ${c.baselineUrl} -> ${baseline.status} (${baseline.body.length} bytes)`;
    if (c.vector === 'integer-overflow') {
      // WRAPAROUND PROOF: the wrapped value differs from what was
      // sent — only the server computing it can produce it. The
      // baseline must not carry it (else it is page furniture).
      if (containsWrapped(crafted.body, c.wrapped) && !containsWrapped(baseline.body, c.wrapped)) {
        const idx = crafted.body.search(new RegExp(`(?:^|[^\\d])${c.wrapped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        push(
          'integer_overflow',
          'medium',
          `Integer overflow — 32-bit wraparound accepted for parameter '${c.parameter}'`,
          c.url,
          c.parameter,
          `GET ${c.url} (integer ${c.craftedValue} for '${c.parameter}'); baseline ${baseText}`,
          `crafted ${crafted.status} (${crafted.body.length} bytes) contains the wrapped value ${c.wrapped} the baseline does not: snippet: ${snippetAround(crafted.body, Math.max(0, idx), c.wrapped.length)}`,
          'Integer-overflow primitive — the server parsed the out-of-range value into a fixed-width int and wrapped it; a wrapped quantity/ID/limit is attacker-controlled arithmetic — chain with a quantity, price or pagination sink where the wrapped value changes the outcome.'
        );
      }
      continue;
    }

    // Acceptance vectors (#437–#439): the crafted value must be
    // treated like the valid one (equivalent to baseline) while the
    // garbage control is not — an endpoint that answers the same to
    // every value proves nothing.
    if (baseline.status < 200 || baseline.status >= 300) continue;
    const garbage = garbageByPoint.get(pointKey);
    if (!garbage || equivalent(garbage, baseline)) continue;
    if (!equivalent(crafted, baseline)) continue;
    if (c.vector === 'type-juggling') {
      push(
        'type_juggling',
        'high',
        `Type juggling — array value accepted where a scalar was expected for parameter '${c.parameter}'`,
        c.url,
        c.parameter,
        `GET ${c.url} (array form '${c.craftedValue}'); baseline ${baseText}; garbage control GET ${mutateUrl(c.baselineUrl, c.point, GARBAGE)} -> ${garbage.status} (${garbage.body.length} bytes, not equivalent)`,
        `crafted ${crafted.status} (${crafted.body.length} bytes) equivalent to the baseline (similarity ${similarity(crafted.body, baseline.body).toFixed(2)}) while the garbage value diverges — the server coerced the array into the scalar it expected`,
        'Type-juggling primitive — the server accepted a wrong-typed value as the valid one; loose comparison / coercion at a check (auth, ID, amount) lets a different-typed value pass it — chain with a PHP loose-comparison sink (== against a hash, 0, or boolean).'
      );
    } else if (c.vector === 'null-byte') {
      push(
        'null_byte_truncation',
        'medium',
        `Null-byte truncation — value after %00 ignored for parameter '${c.parameter}'`,
        c.url,
        c.parameter,
        `GET ${c.url} (value '${c.craftedValue}'); baseline ${baseText}; garbage control GET ${mutateUrl(c.baselineUrl, c.point, GARBAGE)} -> ${garbage.status} (${garbage.body.length} bytes, not equivalent)`,
        `crafted ${crafted.status} (${crafted.body.length} bytes) equivalent to the baseline (similarity ${similarity(crafted.body, baseline.body).toFixed(2)}) while the garbage value diverges — the server processed the value truncated at the null byte`,
        'Null-byte-truncation primitive — the server (or a C layer below it) cut the value at %00; a truncated filename/extension check passes a value the validator saw whole — chain with a file/path sink where the extension check runs on the untruncated string.'
      );
    } else if (c.vector === 'unicode') {
      push(
        'unicode_normalization',
        'medium',
        `Unicode normalization bypass — fullwidth value accepted as '${c.parameter}'`,
        c.url,
        c.parameter,
        `GET ${c.url} (fullwidth form of the baseline value); baseline ${baseText}; garbage control GET ${mutateUrl(c.baselineUrl, c.point, GARBAGE)} -> ${garbage.status} (${garbage.body.length} bytes, not equivalent)`,
        `crafted ${crafted.status} (${crafted.body.length} bytes) equivalent to the baseline (similarity ${similarity(crafted.body, baseline.body).toFixed(2)}) while the garbage value diverges — the server or its filter normalized the unicode back to the canonical value before validation`,
        'Unicode-normalization primitive — the value was normalized before the check, so a filter that blocks the canonical form can be bypassed with a normalized twin; chain with a blocklist / WAF rule that matches the plain spelling only.'
      );
    }
  }

  // ---- Hidden-field vector (#440) ----------------------------------
  const formList = Array.isArray(forms) ? forms : [];
  if (formList.length > 0 && opts.pageUrl && formRequests < MAX_FORM_REQUESTS) {
    let pageHtml = '';
    try {
      const pageRes = await fetchFn(opts.pageUrl, opts);
      formRequests += 1;
      pageHtml = pageRes && pageRes.body ? String(pageRes.body) : '';
    } catch {
      pageHtml = '';
    }
    const hiddenByAction = new Map();
    for (const entry of extractHiddenInputs(pageHtml, opts.pageUrl)) {
      hiddenByAction.set(entry.action, entry.hidden);
    }
    let fillerN = 0;
    const filler = () => `dmprobe${++fillerN}_x`;
    for (const form of formList.slice(0, MAX_FORMS)) {
      if (findings.length >= MAX_FINDINGS) break;
      if (formRequests + 2 > MAX_FORM_REQUESTS) break;
      const isPost = String(form.method || 'get').toLowerCase() === 'post';
      // LAB GATE: a POST submit is a write — it never leaves
      // toward a non-lab host. GET-form submits are read-only.
      if (isPost && !allowWrite) continue;
      const hidden = hiddenByAction.get(String(form.action)) || [];
      const tamperable = hidden.filter((h) => !TOKEN_NAME_RE.test(h.name));
      if (tamperable.length === 0) continue;
      const target = tamperable[0];
      const original = String(target.value ?? '');
      const tampered = /^-?\d+$/.test(original) ? (original === '0' ? '-1' : '0') : TAMPERED_MARKER;
      const valuesFor = (override) => {
        const values = {};
        // Inputs are { name, type, value } objects (D1, #474 repair) —
        // the value map is keyed by NAME, never by the object itself.
        for (const inp of form.inputs || []) {
          const name = inp.name;
          if (!name) continue;
          const h = hidden.find((x) => x.name === name);
          if (h) {
            values[name] = override && h.name === target.name ? tampered : String(h.value ?? '');
          } else if (/^submit$/i.test(name)) {
            values[name] = '1';
          } else {
            values[name] = filler();
          }
        }
        return values;
      };
      let control;
      let tamperedRes;
      try {
        control = await submitFn(form, valuesFor(false), opts);
        formRequests += 1;
      } catch {
        continue;
      }
      try {
        tamperedRes = await submitFn(form, valuesFor(true), opts);
        formRequests += 1;
      } catch {
        continue;
      }
      const controlBody = control && control.body ? String(control.body) : '';
      const tamperedBody = tamperedRes && tamperedRes.body ? String(tamperedRes.body) : '';
      const controlStatus = control && typeof control.status === 'number' ? control.status : 0;
      const tamperedStatus = tamperedRes && typeof tamperedRes.status === 'number' ? tamperedRes.status : 0;
      // SUBSTITUTION PROOF: both submits succeed with the same
      // shape, and the tampered value sits where the original sat
      // (token-aware: '0' must not match inside '10').
      if (
        controlStatus >= 200 && controlStatus < 300 &&
        tamperedStatus >= 200 && tamperedStatus < 300 &&
        lengthSimilarity(controlBody, tamperedBody) >= SIMILARITY_THRESHOLD &&
        containsToken(tamperedBody, tampered) &&
        containsToken(controlBody, original) &&
        !containsToken(tamperedBody, original) &&
        !containsToken(controlBody, tampered)
      ) {
        push(
          'hidden_field_validation',
          'medium',
          `Missing input validation on hidden field '${target.name}' — tampered value accepted`,
          String(form.action),
          target.name,
          `${isPost ? 'POST' : 'GET'} ${form.action} with hidden field '${target.name}' changed '${original}' -> '${tampered}' (all other inputs identical, CSRF/token fields untouched); control submit returned ${controlStatus}`,
          `tampered submit ${tamperedStatus} (${tamperedBody.length} bytes) equivalent to the control submit (length similarity ${lengthSimilarity(controlBody, tamperedBody).toFixed(2)}) and the tampered value '${tampered}' appears where the original '${original}' appeared — the server processed the attacker's hidden value as genuine`,
          'Hidden-field-validation primitive — the server trusted a client-controlled hidden value (price, role, quantity, ID) without re-validating it; chain with a price/role/quantity hidden field whose tampered value changes the transaction.'
        );
      }
    }
  }

  return findings;
}

export const __validationMeta = { phases: ['validation'], depth: ['quick', 'standard', 'deep'] };
