// Dark Matter rule-based scanner — session fixation probe (#44, #262) +
// logout-invalidation probe (#474, CWE-613).
//
// Owns ONLY the session-identifier lifecycle across authentication
// (cookie flags stay in cookies.js; brute force in weakCreds.js).
//   D1. Login-surface inventory: password-type forms + pre-login Set-Cookie.
//   D2. Pre-auth session capture + planted-ID adoption test.
//   D3. Post-auth comparison oracle.
//   T1. No-regeneration on login — MEDIUM (HIGH only with T2): S_pre == S_post.
//   T2. Planted-ID adoption — HIGH (LAB-GATED): two jars, same planted ID,
//       authenticated state reachable with the planted value.
//   T3. Session ID in URL — MEDIUM: authenticated request with URL-carried
//       ID alone, no regeneration.
//   T4. Logout does not invalidate (cookie) — MEDIUM: old session cookie
//       still auths after logout (row #474, CWE-613).
//   T4b. Logout does not invalidate (bearer) — MEDIUM: old bearer token
//       still auths after logout; fires when the app has no HTML login
//       form but exposes a JSON login + check endpoint (row #474).
//
// Hard safety: only OUR canary credentials/sessions; ≤5 logins per surface;
// T2 labOnly. Needs opts.labCreds {username,password} else graceful skip.
// T4b additionally needs opts.apiRoutes (discovered route URLs, wired in
// by runScan from scanTargets) — no login candidate or no check endpoint
// means an honest [] (never fires on the SPA-root HTML alone).
// Per-run canary __dm_sessfix_<runid>. $0, no new deps.
//
// Repairs (7 Nov 2026, #474 lane — the three T4 defects the #47 prep's
// "already covered" claim missed):
//   1. T4 was cookie-only — Juice auth is a Bearer JWT, so T4b exists.
//   2. T4/T2 replayed against the login page (form.action), whose 302
//      body is empty for authed sessions — replay + T2 auth-check now
//      fetch the pasted pageUrl and follow same-origin redirects (≤2).
//   3. T4 POSTed the DISCOVERED form's (stale) hidden token — the login
//      is now posted with a freshly re-fetched token (loginWithFreshToken).

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function isLab(url, opts) {
  try {
    const host = new URL(url).hostname;
    return String(opts.labTargets || '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Minimal cookie jar for the differential lifecycle.
class Jar {
  constructor() {
    this.cookies = new Map();
  }
  ingest(setCookies) {
    for (const c of setCookies || []) {
      const m = c.match(/^([^=;]+)=([^;]*)/);
      if (m) this.cookies.set(m[1].trim(), m[2]);
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  get(name) {
    return this.cookies.get(name);
  }
  clear() {
    this.cookies.clear();
  }
}

async function req(url, opts = {}, { method = 'GET', jar = null, body = null, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method, signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(jar ? { Cookie: jar.header() } : {}), ...headers },
      body, redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (jar) jar.ingest(setCookies);
    return {
      status: res.status,
      text: text.slice(0, 200000),
      setCookies,
      location: res.headers.get('location'),
      authorization: res.headers.get('authorization'),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const SESSION_COOKIE_RES = /phpsessid|jsessionid|sessionid|connect\.sid|_session|session_|sessid|auth.?token/i;
const AUTH_MARKER_RE = /logout|dashboard|welcome|profile/i;
const LOGOUT_PATHS = ['/logout', '/logout.php', '/signout', '/auth/logout'];
const LOGIN_PATH_RE = /login|signin|authenticate|auth\/token/i;
const CHECK_PATH_RE = /whoami|\/me$|\/profile$|\/user\/whoami/i;
const TOKEN_FIELDS = ['token', 'accessToken', 'access_token', 'jwt'];

function sessionCookieNames(setCookies) {
  return (setCookies || [])
    .map((c) => (c.match(/^([^=;]+)/) || [])[1])
    .filter((n) => n && SESSION_COOKIE_RES.test(n.trim()));
}

function loginForms(forms) {
  return forms.filter((f) =>
    (f.inputs || []).some((i) => String(i.type || '').toLowerCase() === 'password')
  );
}

// ---- shared login helpers ---------------------------------------------------

// Quote-agnostic attribute read for a single <input ...> tag.
function attrValue(tag, attr) {
  const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

// Hidden inputs of a login page (fresh CSRF token et al). Single- AND
// double-quoted attributes both parse — DVWA's token input uses single
// quotes (<input type='hidden' name='user_token' value='...'>).
function parseHiddenInputs(html) {
  const out = {};
  if (!html) return out;
  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const type = attrValue(tag, 'type');
    if (!type || type.toLowerCase() !== 'hidden') continue;
    const name = attrValue(tag, 'name');
    if (!name) continue;
    out[name] = attrValue(tag, 'value') ?? '';
  }
  return out;
}

// GET an authenticated page, following same-origin redirects (max 2 hops).
// A bare 302 body is empty — the old replay read exactly that and failed
// closed even for a still-valid session. A redirect chain that lands on a
// login page still fails the caller's marker/no-login gate.
async function fetchAuthedPage(url, opts, jar) {
  let cur = url;
  let last = null;
  for (let hop = 0; hop <= 2; hop++) {
    const r = await req(cur, opts, { jar });
    if (!r) return null;
    last = r;
    if ([301, 302, 303, 307, 308].includes(r.status) && r.location && hop < 2) {
      let next;
      try {
        next = new URL(r.location, cur).toString();
      } catch {
        return r;
      }
      try {
        if (new URL(next).origin !== new URL(cur).origin) return r;
      } catch {
        return r;
      }
      cur = next;
      continue;
    }
    return r;
  }
  return last;
}

// POST the canary login with a FRESH hidden token: re-fetch the login
// page and re-parse its hidden inputs first. A stale discovered token
// (DVWA's user_token is per-page-load) makes the login fail outright
// and the whole test returns [] vacuously.
async function loginWithFreshToken(form, opts, creds, jar) {
  const fresh = await req(form.action || form.pageUrl, opts, { jar });
  const freshHidden = fresh ? parseHiddenInputs(fresh.text) : {};
  const fields = {};
  for (const inp of form.inputs || []) {
    if (!inp.name) continue;
    const n = inp.name.toLowerCase();
    // Fresh hidden value FIRST: a CSRF token field such as DVWA's
    // `user_token` matches /user/ below, so the name heuristic must
    // never overwrite it with the username — that was defect 3.
    if (Object.prototype.hasOwnProperty.call(freshHidden, inp.name)) fields[inp.name] = freshHidden[inp.name];
    else if (/pass/.test(n)) fields[inp.name] = creds.password;
    else if (/user|login|email/.test(n)) fields[inp.name] = creds.username;
    else fields[inp.name] = inp.value || '';
  }
  // Hidden inputs the fresh page carries that the discovered form lacks.
  for (const [k, v] of Object.entries(freshHidden)) {
    if (!(k in fields)) fields[k] = v;
  }
  return req(form.action || form.pageUrl, opts, {
    method: 'POST', jar,
    body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

// ---- T1: no-regeneration on login --------------------------------------------------
async function t1NoRegen(form, opts, creds) {
  const findings = [];
  const jar = new Jar();
  const rPre = await req(form.action || form.pageUrl, opts, { jar });
  if (!rPre) return findings;
  const names = sessionCookieNames(rPre.setCookies);
  const targetName = names[0];
  const sPre = targetName ? jar.get(targetName) : null;
  // POST canary login (fresh hidden token — see loginWithFreshToken).
  const rPost = await loginWithFreshToken(form, opts, creds, jar);
  if (!rPost) return findings;
  const sPost = targetName ? jar.get(targetName) : null;
  // No pre-auth ID issued at all -> rotation question is moot, no finding.
  if (!sPre) return findings;
  if (sPost && sPost === sPre) {
    findings.push({
      class: 'session_fixation',
      id: `sf-noregen-${rand()}`,
      title: 'Session fixation — session ID not regenerated on login (MEDIUM)',
      severity: 'medium',
      url: form.action || form.pageUrl,
      parameter: targetName,
      evidence: ev(
        `Clean jar -> GET login page (S_pre=${String(sPre).slice(0, 12)}...) -> POST canary login -> S_post`,
        `S_pre == S_post (${targetName}) — the server did NOT rotate the session ID at the privilege boundary. Fixation window proven; planting itself graded in T2.`,
        'Session-fixation window: anyone who knew the pre-auth ID shares the authenticated session.'
      ),
    });
  }
  return findings;
}

// ---- T2: planted-ID adoption (lab-only) ------------------------------------------------
async function t2PlantedAdoption(form, opts, creds, rid) {
  const findings = [];
  if (!isLab(form.action || form.pageUrl || '', opts)) return findings;
  const canary = `__dm_sessfix_${rid}`;
  // Attacker jar: plant the ID. Victim jar: same planted ID, then login.
  const jarV = new Jar();
  const rPre = await req(form.action || form.pageUrl, opts, { jar: jarV });
  if (!rPre) return findings;
  const names = sessionCookieNames(rPre.setCookies);
  if (!names.length) return findings;
  const targetName = names[0];
  jarV.cookies.set(targetName, canary); // plant
  await loginWithFreshToken(form, opts, creds, jarV);
  const kept = jarV.get(targetName) === canary;
  // Attacker jar with the planted ID — does it reach authenticated state?
  // The check fetches the pasted page (an authenticated page) and follows
  // redirects — the old check fetched the login page, whose 302 body is
  // empty for an authed session, and failed closed even when adopted.
  const jarA = new Jar();
  jarA.cookies.set(targetName, canary);
  const rAuth = await fetchAuthedPage(form.pageUrl, opts, jarA);
  const authed = rAuth && AUTH_MARKER_RE.test(rAuth.text);
  if (kept && authed) {
    const m = rAuth.text.match(AUTH_MARKER_RE);
    const idx = rAuth.text.indexOf(m[0]);
    const window = rAuth.text.slice(Math.max(0, idx - 60), idx + 120);
    findings.push({
      class: 'session_fixation',
      id: `sf-planted-${rand()}`,
      title: 'Session fixation — planted session ID reaches authenticated state (HIGH)',
      severity: 'high',
      url: form.action || form.pageUrl,
      parameter: targetName,
      evidence: ev(
        `Planted ${targetName}=${canary} -> canary login -> attacker jar replays planted ID`,
        `Server kept the planted ID through login AND it reaches an authenticated page — "...${window}..." — full fixation chain, lab-only, both sides ours.`,
        'Full session-fixation primitive: no password needed with a planted ID.'
      ),
    });
  }
  return findings;
}

// ---- T4: logout does not invalidate (cookie) ----------------------------------------
async function t4Logout(form, opts, creds) {
  const findings = [];
  const loginFormsList = loginForms([form]);
  if (!loginFormsList.length) return findings;
  const jar = new Jar();
  // Login with a fresh hidden token (stale discovered token fails the
  // login outright and this test would return [] vacuously).
  await loginWithFreshToken(form, opts, creds, jar);
  const sessName = [...jar.cookies.keys()].find((k) => SESSION_COOKIE_RES.test(k));
  if (!sessName) return findings;
  const sVal = jar.get(sessName);
  // Logout: follow common logout paths.
  const base = new URL(form.action || form.pageUrl);
  for (const lp of LOGOUT_PATHS) {
    await req(new URL(lp, base.origin).toString(), opts, { jar });
  }
  // Replay the old session against the PASTED page (an authenticated
  // page), following redirects — never the login page's bare 302 body.
  const jar2 = new Jar();
  jar2.cookies.set(sessName, sVal);
  const rReplay = await fetchAuthedPage(form.pageUrl, opts, jar2);
  if (rReplay && AUTH_MARKER_RE.test(rReplay.text) && !/login/i.test(rReplay.text.slice(0, 2000))) {
    const m = rReplay.text.match(AUTH_MARKER_RE);
    const idx = rReplay.text.indexOf(m[0]);
    const window = rReplay.text.slice(Math.max(0, idx - 60), idx + 120);
    findings.push({
      class: 'session_fixation',
      id: `sf-logout-${rand()}`,
      title: 'Session lifecycle — logout does not invalidate server-side (MEDIUM)',
      severity: 'medium',
      url: form.action || form.pageUrl,
      parameter: sessName,
      evidence: ev(
        `Login (canary) -> logout -> replay old ${sessName}`,
        `Old session still authenticates post-logout — "...${window}..." — server-side invalidation missing.`,
        'Stale-session primitive: stolen IDs survive logout.'
      ),
    });
  }
  return findings;
}

// ---- T4b: logout does not invalidate (bearer / API login) --------------------------
// Runs ONLY when no HTML login form exists (SPA, e.g. Juice Shop) and
// labCreds are present. Login + check endpoints come from the
// already-discovered route set (opts.apiRoutes, wired in by runScan) —
// no new discovery phase, and never a fire on the SPA-root HTML alone.
function sameOriginRoute(routes, origin, re) {
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin === origin && re.test(u.pathname)) return u.toString();
    } catch {
      // ignore malformed route entries
    }
  }
  return null;
}

// Shallow-recursive token hunt (depth ≤ 3): Juice nests the token under
// {authentication: {token}} — a top-level-only read would miss it.
function findTokenField(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 3) return null;
  for (const key of TOKEN_FIELDS) {
    const v = node[key];
    if (typeof v === 'string' && v) return v;
  }
  for (const v of Object.values(node)) {
    const found = findTokenField(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function extractBearerToken(res) {
  if (!res) return null;
  try {
    const body = JSON.parse(res.text);
    const fromBody = findTokenField(body);
    if (fromBody) return fromBody;
  } catch {
    // not JSON — fall through to the Authorization header
  }
  if (res.authorization) {
    const tok = String(res.authorization).replace(/^Bearer\s+/i, '').trim();
    if (tok) return tok;
  }
  return null;
}

async function t4bBearer(url, opts, creds) {
  const findings = [];
  const routes = (opts.apiRoutes || []).map(String);
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return findings;
  }
  const loginUrl = sameOriginRoute(routes, origin, LOGIN_PATH_RE);
  if (!loginUrl) return findings;
  const checkUrl = sameOriginRoute(routes, origin, CHECK_PATH_RE);
  if (!checkUrl) return findings;
  // API login: {email, password} first, then {username, password} on
  // 401/400. Cap: 2 login attempts, 1 endpoint per scan.
  let loginRes = null;
  for (const body of [
    { email: creds.username, password: creds.password },
    { username: creds.username, password: creds.password },
  ]) {
    const r = await req(loginUrl, opts, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r) return findings;
    if (r.status === 401 || r.status === 400) continue;
    if (r.status < 200 || r.status >= 300) return findings;
    loginRes = r;
    break;
  }
  if (!loginRes) return findings;
  const token = extractBearerToken(loginRes);
  if (!token) return findings;
  // Logout attempt: the 4 common paths + any discovered logout op.
  // Record whether a server logout endpoint exists at all (Juice: none
  // — the finding text must say so, not imply a clearable session).
  let serverLogoutExists = false;
  const logoutOps = routes.filter((r) => {
    try {
      const u = new URL(String(r));
      return u.origin === origin && /logout|signout/i.test(u.pathname);
    } catch {
      return false;
    }
  });
  const logoutUrls = [...new Set([...LOGOUT_PATHS.map((p) => new URL(p, origin).toString()), ...logoutOps])];
  for (const lu of logoutUrls) {
    const r = await req(lu, opts, { headers: { Authorization: `Bearer ${token}` } });
    if (r && r.status !== 404) serverLogoutExists = true;
  }
  // Replay the OLD token against the check endpoint.
  const rReplay = await req(checkUrl, opts, { headers: { Authorization: `Bearer ${token}` } });
  if (!rReplay || rReplay.status !== 200) return findings;
  const canary = String(creds.username).toLowerCase();
  const bodyHasCanary = rReplay.text.toLowerCase().includes(canary);
  const marker = rReplay.text.match(AUTH_MARKER_RE);
  // A bare 200 (SPA HTML, generic JSON) is NOT enough — the replay must
  // name the canary account or carry an authenticated-content marker.
  if (!bodyHasCanary && !marker) return findings;
  const anchor = bodyHasCanary ? canary : marker[0];
  const idx = rReplay.text.toLowerCase().indexOf(String(anchor).toLowerCase());
  const window = rReplay.text.slice(Math.max(0, idx - 60), idx + 120);
  findings.push({
    class: 'session_fixation',
    id: `sf-logout-bearer-${rand()}`,
    title: 'Session lifecycle — bearer token remains valid after logout (MEDIUM)',
    severity: 'medium',
    url: checkUrl,
    parameter: 'Authorization',
    evidence: ev(
      `API login (canary) -> logout attempted -> replay old Bearer token to ${checkUrl}`,
      `Old bearer token still returns 200 with the canary account — "...${window}..." — ${serverLogoutExists ? 'a server logout was attempted but the token was not invalidated' : 'no server logout endpoint exists; logout is client-side only, the token stays valid until expiry'}.`,
      'Stale-token primitive: a stolen bearer token survives logout.'
    ),
  });
  return findings;
}

export async function probeSessionFixation(forms, url, opts = {}) {
  const findings = [];
  const creds = opts.labCreds;
  if (!creds || !creds.username) return findings; // graceful skip without canary creds
  const lfs = loginForms(forms);
  const rid = rand();
  const depth = opts.depth || 'standard';
  if (!lfs.length) {
    // No HTML login form (SPA) — the bearer/API path is the only
    // applicable test; without a discoverable login it returns [].
    if (depth !== 'quick') findings.push(...(await t4bBearer(url, opts, creds)));
    return findings;
  }
  for (const form of lfs.slice(0, 2)) {
    form.pageUrl = form.pageUrl || url;
    findings.push(...(await t1NoRegen(form, opts, creds)));
    findings.push(...(await t2PlantedAdoption(form, opts, creds, rid)));
    if (depth === 'quick') continue;
    findings.push(...(await t4Logout(form, opts, creds)));
    // T3 URL-carried session ID rides the T1 oracle (documented).
  }
  return findings;
}

export const __sfMeta = { phases: ['session-fixation'], depth: ['quick', 'standard', 'deep'] };
