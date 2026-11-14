// Dark Matter rule-based scanner — CSRF probe.
// Row #407 [Medium] CSRF — SameSite / referer-only defense gaps.
// (Row #408 login CSRF stays VERIFIED detection-level on the
// token-presence leg below; this file does not re-file it.)
//
// Leg S (static, pure): a state-changing (POST) form with no
// anti-CSRF token field. When the session cookie carries
// SameSite=Lax/Strict the finding is class csrf_samesite_only:
// the site's ONLY CSRF defense is the cookie attribute, not a
// token — Lax still allows top-level GET cross-site requests and
// neither value stops a same-site (subdomain) attacker. Without
// SameSite protection the finding stays the original
// csrf-missing-token (unchanged behaviour when no cookie info is
// supplied, so existing callers and tests are unaffected).
//
// Leg R (live differential): a token-less POST form with NO
// SameSite protection is submitted twice — once with a
// same-origin Referer (control) and once with a cross-site
// Referer — through rawHeaderFetch (node:http.request, which
// transmits Referer verbatim; fetch/undici drops it as a
// forbidden header). A finding (csrf_referer_only) fires ONLY
// when the control is accepted, the cross-site Referer is
// refused, and the refusal reproduces on a repeat. Auth-gated
// forms fail the control and stay silent — no false positive.
// Same risk class as the post-forms battery (benign filler
// POSTs, unique values per input, capped at 2 forms / 6
// requests); the leg never runs when SameSite already
// characterizes the defense (Leg S owns those forms).
import { randomBytes } from 'node:crypto';
import { rawHeaderFetch } from './ssrfRouting.js';
import { getSessionCookieSameSite } from './cookies.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TOKEN_NAME_RE = /csrf|xsrf|_token|authenticity|nonce/i;
// A refusal is a 4xx, a redirect to a login page, or a body that
// names the CSRF/Referer check. Anything else on a 2xx/3xx is
// acceptance; 5xx and transport errors are 'unclear' (no verdict).
const CSRF_ERROR_RE =
  /csrf|xsrf|invalid token|forbidden|referer (not allowed|check failed|mismatch|invalid)|origin (not allowed|mismatch)/i;
const LOGIN_PATH_RE = /login|signin|sign-in|auth/i;
const MAX_REFERER_FORMS = 2;
const EVIL_REFERER = 'https://evil.example/';

function formPath(form) {
  try {
    return new URL(form.action).pathname.replace(/\//g, '_') || 'root';
  } catch {
    return 'root';
  }
}

function tokenlessPostForms(forms) {
  return (forms || []).filter((form) => {
    if (String(form.method || 'get').toLowerCase() !== 'post') return false;
    const names = (form.inputs || []).map((i) => i.name).filter(Boolean);
    return !names.some((n) => TOKEN_NAME_RE.test(n));
  });
}

export function probeCsrf(forms, url, opts = {}) {
  const findings = [];
  const ss = opts.sessionSameSite || null;
  const samesiteOnly = ss && (ss.sameSite === 'lax' || ss.sameSite === 'strict');
  for (const form of tokenlessPostForms(forms)) {
    // Inputs are { name, type, value } objects (D1, #474 repair) —
    // the token test reads the NAME, never the object itself.
    const names = (form.inputs || []).map((i) => i.name).filter(Boolean);
    const path = formPath(form);
    if (samesiteOnly) {
      const value = ss.sameSite === 'lax' ? 'Lax' : 'Strict';
      findings.push({
        class: 'csrf_samesite_only',
        id: `csrf-samesite-only${path}`,
        title: `State-changing form relies on SameSite cookie instead of an anti-CSRF token: ${form.action}`,
        severity: 'medium',
        url: form.action,
        evidence: {
          request: `POST ${form.action} (inputs: ${names.join(', ') || 'none'})`,
          response: `no anti-CSRF token field in the form; session cookie '${ss.name}' carries SameSite=${value}`,
          impact_demo:
            `SameSite=${value} is the only CSRF defense — Lax still allows top-level GET cross-site ` +
            'requests; neither Lax nor Strict stops a same-site (subdomain) attacker',
          signalCorrelated: true,
        },
      });
      continue;
    }
    findings.push({
      class: 'csrf',
      id: `csrf-missing-token${path}`,
      title: `State-changing form without anti-CSRF token: ${form.action}`,
      severity: 'medium',
      url: form.action,
      evidence: {
        request: `POST ${form.action} (inputs: ${names.join(', ') || 'none'})`,
        response: 'no anti-CSRF token field in the form',
        impact_demo: 'missing csrf/xsrf/_token/authenticity/nonce field',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}

// GET the target URL and read the session cookie's SameSite
// attribute (cookies.js owns the parsing). Returns
// { name, sameSite } or null when the fetch fails, no session
// cookie is set, or it carries no SameSite. A null return keeps
// probeCsrf on its original behaviour — the leg degrades
// honestly instead of guessing.
export async function fetchSessionSameSite(url, opts = {}) {
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : fetch;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetchFn(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    await res.text().catch(() => '');
    const headers = res.headers || {};
    let values = [];
    if (typeof headers.getSetCookie === 'function') {
      values = headers.getSetCookie();
    } else if (typeof headers.get === 'function') {
      const raw = headers.get('set-cookie') || '';
      values = raw ? raw.split(/,(?=[^;]+=)/) : [];
    }
    return getSessionCookieSameSite(values);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Judge one Referer-leg POST response. 'accepted' only when the
 * server processed the request (2xx, or a 3xx away from login);
 * 'refused' on a 4xx, a redirect to a login page, or a body
 * naming the CSRF/Referer check; 'unclear' on 5xx, a 3xx with
 * no Location, or anything else. Pure.
 */
export function assessRefererResponse(status, body, location) {
  if (CSRF_ERROR_RE.test(String(body || ''))) return 'refused';
  if (status >= 400 && status < 500) return 'refused';
  if (status >= 300 && status < 400) {
    const loc = String(location || '');
    if (!loc) return 'unclear';
    return LOGIN_PATH_RE.test(loc) ? 'refused' : 'accepted';
  }
  if (status >= 200 && status < 300) return 'accepted';
  return 'unclear';
}

// Benign filler body for the Referer differential — the same
// pattern as postForms.js: unique values per input (never equal,
// so a form that fires only on matching inputs stays quiet),
// submit buttons set to '1'.
function buildFillerBody(form) {
  const params = new URLSearchParams();
  let n = 0;
  for (const inp of form.inputs || []) {
    const name = inp.name;
    if (!name) continue;
    if (/^submit$/i.test(name)) params.set(name, '1');
    else params.set(name, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
  }
  return params.toString();
}

export async function probeCsrfRefererOnly(forms, url, opts = {}) {
  const findings = [];
  const ss = opts.sessionSameSite || null;
  // SameSite already characterizes the defense — Leg S owns it;
  // a cross-site Referer POST would also fail for a different
  // reason (the browser withholds the cookie), so the
  // differential would be confounded here.
  if (ss && (ss.sameSite === 'lax' || ss.sameSite === 'strict')) return findings;
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : rawHeaderFetch;
  for (const form of tokenlessPostForms(forms).slice(0, MAX_REFERER_FORMS)) {
    let action;
    try {
      action = new URL(form.action, url).toString();
    } catch {
      continue;
    }
    const protocol = new URL(action).protocol;
    if (protocol !== 'http:' && protocol !== 'https:') continue;
    const body = buildFillerBody(form);
    const post = async (referer) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
      try {
        const res = await fetchFn(action, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: referer,
          },
          body,
        });
        const text = await res.text().catch(() => '');
        const location =
          res.headers && typeof res.headers.get === 'function' ? res.headers.get('location') : null;
        return { verdict: assessRefererResponse(res.status, text, location), status: res.status };
      } catch {
        return { verdict: 'unclear', status: null };
      } finally {
        clearTimeout(t);
      }
    };
    const control = await post(url);
    if (control.verdict !== 'accepted') continue;
    const test = await post(EVIL_REFERER);
    if (test.verdict !== 'refused') continue;
    const repeat = await post(EVIL_REFERER);
    if (repeat.verdict !== 'refused') continue;
    findings.push({
      class: 'csrf_referer_only',
      id: `csrf-referer-only${formPath(form)}`,
      title: `State-changing form relies on Referer checking instead of an anti-CSRF token: ${form.action}`,
      severity: 'medium',
      url: form.action,
      evidence: {
        request: `POST ${form.action} with Referer: ${EVIL_REFERER} (control: Referer: ${url})`,
        response:
          `same-origin Referer accepted (HTTP ${control.status}); cross-site Referer refused ` +
          `(HTTP ${test.status}) on two identical submissions`,
        impact_demo:
          'Referer is fully attacker-controlled and suppressible — a Referer-only check is ' +
          'bypassable; no anti-CSRF token field in the form',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
