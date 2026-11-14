// Dark Matter rule-based scanner — cookie security flags probe.
// Checks Set-Cookie headers for missing Secure, HttpOnly, and SameSite.
// A session cookie without these is exposed to theft via XSS (no HttpOnly),
// network sniffing (no Secure), or CSRF (no/None SameSite).
//
// SCOPE leg (14 Nov 2026, row #260 [Medium] Overly Broad Cookie Scope):
// the same pass also parses Domain= / Path= and flags a cookie whose
// Domain is a PARENT of the target host (shared across subdomains — an
// XSS on any subdomain can steal it), class `cookie_scope`. Domain is
// compared case-insensitively with a leading dot stripped; a Domain
// equal to the host, or a foreign Domain that is not a suffix of the
// host, never flags. Path= is parsed and recorded in the evidence, but
// Path=/ ALONE is deliberately NOT a finding: it is the near-universal
// default for session cookies, and flagging it would fire on essentially
// every site — the existing "stays quiet when cookies carry all flags"
// test codifies that a fully-flagged cookie with Path=/ is fine. The
// discriminating signal for overly broad scope is the parent Domain.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function parseSetCookies(headers) {
  // Node's fetch: getSetCookie() if available, else split the raw header.
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const raw = headers.get('set-cookie') || '';
  return raw ? raw.split(/,(?=[^;]+=)/) : [];
}

function parseCookieAttr(cookie, attr) {
  const m = new RegExp(`;\\s*${attr}\\s*=\\s*([^;]*)`, 'i').exec(cookie);
  return m ? m[1].trim() : null;
}

// True when `domain` (leading dot stripped, case-insensitive) is a
// strict parent of `host` — i.e. the cookie is shared across subdomains.
function isParentDomain(domain, host) {
  const d = String(domain || '').toLowerCase().replace(/^\./, '');
  const h = String(host || '').toLowerCase();
  return d !== '' && d !== h && h.endsWith(`.${d}`);
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
    // Scope leg (row #260): a parent Domain shares the cookie across
    // subdomains. Path= is parsed for the record but never flags alone
    // (see the header note).
    const domain = parseCookieAttr(c, 'Domain');
    const path = parseCookieAttr(c, 'Path');
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      host = '';
    }
    if (domain && host && isParentDomain(domain, host)) {
      const isSession = /sess|auth|token|sid/i.test(name);
      findings.push({
        class: 'cookie_scope',
        id: `cookie-scope-${name}`,
        title: `Cookie '${name}' scoped too broadly: Domain=${domain} shares it across subdomains of ${host}`,
        severity: isSession ? 'medium' : 'low',
        url,
        evidence: {
          request: `GET ${url}`,
          response: `Set-Cookie: ${c.slice(0, 200)}`,
          impact_demo: `Domain=${domain} sends this cookie to every subdomain of ${host}` +
            (path ? ` (Path=${path})` : '') +
            ' — an XSS on any subdomain can steal it',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
