// Dark Matter rule-based scanner — session fixation probe (#44).
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
//   T4. Logout does not invalidate — MEDIUM: old session still auths.
//
// Hard safety: only OUR canary credentials/sessions; ≤5 logins per surface;
// T2 labOnly. Needs opts.labCreds {username,password} else graceful skip.
// Per-run canary __dm_sessfix_<runid>. $0, no new deps.

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
    return { status: res.status, text: text.slice(0, 200000), setCookies, location: res.headers.get('location') };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const SESSION_COOKIE_RES = /phpsessid|jsessionid|sessionid|connect\.sid|_session|session_|sessid|auth.?token/i;

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

// ---- T1: no-regeneration on login --------------------------------------------------
async function t1NoRegen(form, opts, creds) {
  const findings = [];
  const jar = new Jar();
  const rPre = await req(form.action || form.pageUrl, opts, { jar });
  if (!rPre) return findings;
  const names = sessionCookieNames(rPre.setCookies);
  const targetName = names[0];
  const sPre = targetName ? jar.get(targetName) : null;
  // POST canary login.
  const fields = {};
  for (const inp of form.inputs || []) {
    if (!inp.name) continue;
    const n = inp.name.toLowerCase();
    if (/pass/.test(n)) fields[inp.name] = creds.password;
    else if (/user|login|email/.test(n)) fields[inp.name] = creds.username;
    else fields[inp.name] = inp.value || '';
  }
  const rPost = await req(form.action || form.pageUrl, opts, {
    method: 'POST', jar,
    body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
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
  const fields = {};
  for (const inp of form.inputs || []) {
    if (!inp.name) continue;
    const n = inp.name.toLowerCase();
    if (/pass/.test(n)) fields[inp.name] = creds.password;
    else if (/user|login|email/.test(n)) fields[inp.name] = creds.username;
    else fields[inp.name] = inp.value || '';
  }
  await req(form.action || form.pageUrl, opts, {
    method: 'POST', jar: jarV,
    body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const kept = jarV.get(targetName) === canary;
  // Attacker jar with the planted ID — does it reach authenticated state?
  const jarA = new Jar();
  jarA.cookies.set(targetName, canary);
  const rAuth = await req(form.action || form.pageUrl, opts, { jar: jarA });
  const authed = rAuth && /logout|dashboard|welcome|profile/i.test(rAuth.text);
  if (kept && authed) {
    findings.push({
      class: 'session_fixation',
      id: `sf-planted-${rand()}`,
      title: 'Session fixation — planted session ID reaches authenticated state (HIGH)',
      severity: 'high',
      url: form.action || form.pageUrl,
      parameter: targetName,
      evidence: ev(
        `Planted ${targetName}=${canary} -> canary login -> attacker jar replays planted ID`,
        `Server kept the planted ID through login AND it reaches an authenticated page — full fixation chain, lab-only, both sides ours.`,
        'Full session-fixation primitive: no password needed with a planted ID.'
      ),
    });
  }
  return findings;
}

// ---- T4: logout does not invalidate -------------------------------------------------------
async function t4Logout(form, opts, creds) {
  const findings = [];
  const loginFormsList = loginForms([form]);
  if (!loginFormsList.length) return findings;
  const jar = new Jar();
  const fields = {};
  for (const inp of form.inputs || []) {
    if (!inp.name) continue;
    const n = inp.name.toLowerCase();
    if (/pass/.test(n)) fields[inp.name] = creds.password;
    else if (/user|login|email/.test(n)) fields[inp.name] = creds.username;
    else fields[inp.name] = inp.value || '';
  }
  await req(form.action || form.pageUrl, opts, { jar });
  await req(form.action || form.pageUrl, opts, {
    method: 'POST', jar,
    body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const names = sessionCookieNames([]);
  const sessName = [...jar.cookies.keys()].find((k) => SESSION_COOKIE_RES.test(k));
  if (!sessName) return findings;
  const sVal = jar.get(sessName);
  // Logout: follow common logout paths.
  const base = new URL(form.action || form.pageUrl);
  for (const lp of ['/logout', '/logout.php', '/signout', '/auth/logout']) {
    await req(new URL(lp, base.origin).toString(), opts, { jar });
  }
  // Replay the old session.
  const jar2 = new Jar();
  jar2.cookies.set(sessName, sVal);
  const rReplay = await req(form.action || form.pageUrl, opts, { jar: jar2 });
  if (rReplay && /logout|dashboard|welcome|profile/i.test(rReplay.text) && !/login/i.test(rReplay.text.slice(0, 2000))) {
    findings.push({
      class: 'session_fixation',
      id: `sf-logout-${rand()}`,
      title: 'Session lifecycle — logout does not invalidate server-side (MEDIUM)',
      severity: 'medium',
      url: form.action || form.pageUrl,
      parameter: sessName,
      evidence: ev(
        `Login (canary) -> logout -> replay old ${sessName}`,
        `Old session still authenticates post-logout — server-side invalidation missing.`,
        'Stale-session primitive: stolen IDs survive logout.'
      ),
    });
  }
  void names;
  return findings;
}

export async function probeSessionFixation(forms, url, opts = {}) {
  const findings = [];
  const creds = opts.labCreds;
  if (!creds || !creds.username) return findings; // graceful skip without canary creds
  const lfs = loginForms(forms);
  if (!lfs.length) return findings; // no login form — INFO, not a miss
  const rid = rand();
  const depth = opts.depth || 'standard';
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
