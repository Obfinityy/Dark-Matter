// Dark Matter rule-based scanner — cookie security flags probe.
// Checks Set-Cookie headers for missing Secure, HttpOnly, and SameSite.
// A session cookie without these is exposed to theft via XSS (no HttpOnly),
// network sniffing (no Secure), or CSRF (no/None SameSite).
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function parseSetCookies(headers) {
  // Node's fetch: getSetCookie() if available, else split the raw header.
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const raw = headers.get('set-cookie') || '';
  return raw ? raw.split(/,(?=[^;]+=)/) : [];
}

export async function probeCookieFlags(url, opts = {}) {
  const findings = [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  let headers;
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    headers = res.headers;
    await res.text().catch(() => '');
  } catch {
    return findings;
  } finally {
    clearTimeout(t);
  }
  const cookies = parseSetCookies(headers);
  for (const c of cookies) {
    const name = (c.split('=')[0] || '').trim() || '(unnamed)';
    const lower = c.toLowerCase();
    const missing = [];
    if (!/;\s*secure(\s*;|$)/.test(lower)) missing.push('Secure');
    if (!/;\s*httponly(\s*;|$)/.test(lower)) missing.push('HttpOnly');
    const ss = /samesite\s*=\s*(lax|strict|none)/.exec(lower);
    if (!ss) {
      missing.push('SameSite');
    } else if (ss[1] === 'none' && !/;\s*secure(\s*;|$)/.test(lower)) {
      missing.push('SameSite=None requires Secure');
    }
    if (missing.length > 0) {
      const isSession = /sess|auth|token|sid/i.test(name);
      findings.push({
        class: 'cookie_flags',
        id: `cookie-flags-${name}`,
        title: `Cookie '${name}' missing security flags: ${missing.join(', ')}`,
        severity: isSession ? 'medium' : 'low',
        url,
        evidence: {
          request: `GET ${url}`,
          response: `Set-Cookie: ${c.slice(0, 200)}`,
          impact_demo: `missing ${missing.join(', ')} — ` +
            (missing.includes('HttpOnly') ? 'stealable via XSS; ' : '') +
            (missing.includes('Secure') ? 'sent over plain HTTP; ' : '') +
            (missing.includes('SameSite') ? 'sent on cross-site requests (CSRF)' : ''),
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
