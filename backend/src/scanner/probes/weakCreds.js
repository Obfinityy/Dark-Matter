// Dark Matter rule-based scanner — weak/default credentials probe.
//
// Detects login forms heuristically (a password-like input name plus a
// user-like name, or an action URL containing login/signin/auth), then tries
// a TINY default-credential list with rate limiting (<=1 attempt / 2s).
//
// Success oracle (differential vs a wrong-password baseline):
//   - the response shows an authenticated state the baseline does not
//     (logout link, welcome text), or
//   - a new session cookie appears that the baseline did not set, or
//   - the redirect target differs from the baseline's.
//
// Severity: high. class 'weak_credentials' → default protocol →
// evidence.signalCorrelated=true confirms it.
//
// SAFETY: authorized targets only (whole scan is behind authorizeTarget);
// 5 attempts max per form, 2s spacing, unique wrong-password baseline so a
// state-changing form can never be triggered by filler equality.
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

// Tiny on purpose: this is a smoke check for factory defaults, not a
// brute-force. Real brute force stays out of the rule-based scanner.
const DEFAULT_CREDS = [
  ['admin', 'admin'],
  ['admin', 'password'],
  ['msfadmin', 'msfadmin'],
  ['guest', 'guest'],
  ['root', 'root'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isLoginForm(f) {
  // Inputs are { name, type, value } objects (D1, #474 repair) —
  // the name heuristics read .name, never the object itself.
  const names = (f.inputs || []).map((i) => String(i.name || ''));
  const hasPass = names.some((n) => /passw|passwd|\bpwd\b/i.test(n));
  const hasUser = names.some((n) => /user(name)?|login|email|account/i.test(n));
  if (hasPass && hasUser) return true;
  if (hasPass && /login|signin|sign-in|auth/i.test(String(f.action || ''))) return true;
  return false;
}

function fieldNames(f) {
  const names = (f.inputs || []).map((i) => String(i.name || ''));
  const user = names.find((n) => /user(name)?|login|email|account/i.test(n)) || names[0];
  const pass = names.find((n) => /passw|passwd|\bpwd\b/i.test(n)) || names[1];
  return { user, pass };
}

// Pull hidden inputs (CSRF tokens etc.) from the live form page so the
// login POST is shaped like the real one; values come from the page.
async function hiddenFields(pageUrl, opts) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
    let body = '';
    try {
      const res = await fetch(pageUrl, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      });
      body = await res.text().catch(() => '');
    } finally {
      clearTimeout(t);
    }
    const out = {};
    const re = /<input[^>]+type=["']?hidden["']?[^>]*>/gi;
    let m;
    while ((m = re.exec(body))) {
      const tag = m[0];
      const name = (/name=["']([^"']+)["']/i.exec(tag) || [])[1];
      const value = (/value=["']([^"']*)["']/i.exec(tag) || [])[1] || '';
      if (name) out[name] = value;
    }
    return out;
  } catch {
    return {};
  }
}

async function tryLogin(form, username, password, hidden, opts = {}) {
  const params = new URLSearchParams();
  const { user, pass } = fieldNames(form);
  for (const [k, v] of Object.entries(hidden)) params.set(k, v);
  let n = 0;
  for (const inp of form.inputs || []) {
    const name = inp.name;
    if (!name) continue;
    if (name === user) params.set(name, username);
    else if (name === pass) params.set(name, password);
    else if (/^(submit|button)$/i.test(name)) params.set(name, 'Login');
    else if (!(name in hidden)) params.set(name, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(opts.headers || {}),
      },
      body: params.toString(),
      redirect: 'manual',
    });
    const body = await res.text().catch(() => '');
    const setCookie = res.headers.get('set-cookie') || '';
    const location = res.headers.get('location') || '';
    return { status: res.status, body, setCookie, location };
  } finally {
    clearTimeout(t);
  }
}

function looksAuthenticated(r, baseline) {
  const authMarkers = /log ?out|sign ?out|log ?off|welcome|dashboard|my account/i;
  const m = r.body.match(authMarkers);
  if (m && !authMarkers.test(baseline.body)) {
    const idx = r.body.indexOf(m[0]);
    return {
      how: 'authenticated marker in body (absent in baseline)',
      window: r.body.slice(Math.max(0, idx - 60), idx + 80),
    };
  }
  if (r.setCookie && r.setCookie !== baseline.setCookie && /sess|auth|token|sid/i.test(r.setCookie)) {
    return {
      how: 'new session cookie set',
      window: `Set-Cookie: ${r.setCookie.slice(0, 120)}`,
    };
  }
  if (r.location && r.location !== baseline.location && r.status >= 300 && r.status < 400) {
    return {
      how: `redirected to ${r.location} (baseline: ${baseline.location || 'none'})`,
      window: `Location: ${r.location}`,
    };
  }
  return null;
}

export async function probeWeakCreds(forms, opts = {}) {
  const findings = [];
  for (const form of (forms || []).slice(0, 3)) {
    if (!isLoginForm(form)) continue;
    if (String(form.method || 'get').toLowerCase() !== 'post') continue;
    const hidden = await hiddenFields(form.action, opts);
    // Baseline: wrong password — must NOT look authenticated.
    const baseline = await tryLogin(form, 'admin', `wrong_${randomBytes(4).toString('hex')}`, hidden, opts);
    if (looksAuthenticated(baseline, { body: '', setCookie: '', location: '' })) continue; // oracle unusable
    for (const [u, p] of DEFAULT_CREDS) {
      await sleep(2000); // rate limit: <=1 attempt / 2s
      let r;
      try {
        r = await tryLogin(form, u, p, hidden, opts);
      } catch {
        continue;
      }
      const how = looksAuthenticated(r, baseline);
      if (!how) continue;
      findings.push({
        class: 'weak_credentials',
        id: `weak-creds-${form.action}`.slice(0, 120),
        title: `Login with default credentials '${u}/${p}'`,
        severity: 'high',
        url: form.action,
        evidence: {
          request: `POST ${form.action} (${fieldNames(form).user}=${u}, ${fieldNames(form).pass}=${'*'.repeat(p.length)})`,
          response: `${how.how} — "...${how.window}..." — wrong-password baseline showed no authenticated state`,
          impact_demo: 'anyone on the internet can log in with factory defaults',
          signalCorrelated: true,
        },
      });
      break; // one confirmed default pair is enough per form
    }
  }
  return findings;
}
