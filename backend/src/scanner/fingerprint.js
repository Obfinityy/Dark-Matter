// Dark Matter rule-based scanner — lightweight tech-stack fingerprint.
// Pure Node fetch; supplements the wappalyzer-cli pipeline phase.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

export async function fetchPage(url, { timeoutMs = 15000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*', ...headers },
    });
    const respHeaders = {};
    for (const [k, v] of res.headers) respHeaders[k.toLowerCase()] = v;
    // MULTI-COOKIE (14 Nov 2026, rows #124/#261/#369): iterating a
    // Headers object collapses several Set-Cookie values into ONE
    // entry — last wins, the rest are silently lost (verified: a
    // two-cookie response collapses to the second cookie only).
    // Keep the collapsed headers object untouched for existing
    // consumers, and ALSO return the full list via getSetCookie()
    // so callers that need every cookie (the crypto token harvest)
    // can read it. Guarded: stubbed fetch impls in tests may not
    // implement getSetCookie().
    const setCookies =
      res.headers && typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    let body = '';
    try {
      body = await res.text();
    } catch {
      body = '';
    }
    // Return the POST-REDIRECT landing URL (5 Nov 2026, 35/63 fix):
    // fetch follows redirects, so `res.url` is where the page actually
    // lives (e.g. / -> /login.php). Callers resolve links/forms against
    // this URL; returning the requested URL made crawl describe the
    // pre-redirect root instead of the real page. `res.url` is absent on
    // stubbed fetch implementations in tests — fall back to the requested
    // URL then, never undefined.
    return {
      url: res.url || url,
      status: res.status,
      headers: respHeaders,
      setCookies,
      body: body.slice(0, 500000),
    };
  } finally {
    clearTimeout(t);
  }
}

export function detectTech(headers, body) {
  const tech = new Set();
  const h = JSON.stringify(headers || {}).toLowerCase();
  const b = String(body || '').toLowerCase();
  const has = (s) => h.includes(s) || b.includes(s);

  if (has('php') || has('x-powered-by') && h.includes('php')) tech.add('php');
  if (has('asp.net') || has('__viewstate')) tech.add('aspnet');
  if (has('jsessionid') || has('jsp') || has('java')) tech.add('java');
  if (has('django') || has('csrftoken')) tech.add('django');
  if (has('flask') || has('werkzeug')) tech.add('flask');
  if (has('express') || has('x-powered-by') && h.includes('express')) tech.add('node-express');
  if (has('wp-content') || has('wp-includes') || has('wordpress')) tech.add('wordpress');
  if (has('drupal')) tech.add('drupal');
  if (has('joomla')) tech.add('joomla');
  if (has('jquery')) tech.add('jquery');
  if (has('react')) tech.add('react');
  if (has('angular')) tech.add('angular');
  if (has('vue.js') || has('vue')) tech.add('vue');
  if ((headers['server'] || '').toLowerCase().includes('nginx')) tech.add('nginx');
  if ((headers['server'] || '').toLowerCase().includes('apache')) tech.add('apache');
  if ((headers['server'] || '').toLowerCase().includes('iis')) tech.add('iis');
  if (has('cloudflare')) tech.add('cloudflare');
  return [...tech];
}

// DB-family hint from an error page or version string. Used to pick the
// right SQLi payload family (MySQL vs MSSQL vs Postgres vs SQLite).
export function detectDbFamily(text) {
  const t = String(text || '').toLowerCase();
  if (/you have an error in your sql syntax|mysql|mariadb/.test(t)) return 'mysql';
  if (/microsoft ole db|odbc sql server|unclosed quotation mark/.test(t)) return 'mssql';
  if (/pg_query|postgresql|psql/.test(t)) return 'postgres';
  if (/sqlite/.test(t)) return 'sqlite';
  if (/ora-\d{5}/.test(t)) return 'oracle';
  return null;
}

// Genuine DB error phrases ONLY (9 Nov 2026, Zerodha FP fix). A finding
// may confirm on a database error only when the response carries real
// DB error TEXT. Bare engine words ("mysql", "psql", "sqlite",
// "postgresql") are NOT error proof — they occur inside unrelated
// tokens (a Cloudflare bot-management cookie containing "psql" was
// confirmed as a "postgres" error) and in ordinary page text. Every
// pattern below is a phrase with spaces or punctuation that a random
// token cannot spell, or a versioned error code (ORA-xxxxx,
// SQLSTATE). detectDbFamily above stays loose on purpose: it only
// picks a payload family, where a wrong hint costs a probe, never a
// finding.
export const DB_ERROR_PATTERNS = {
  mysql:
    /you have an error in your sql syntax|warning:\s*mysql_|mysql_fetch|mysqli?_query|mysql_num_rows|mysql_result|check the manual that corresponds to your (mysql|mariadb) server version|supplied argument is not a valid mysql|mysql server has gone away/i,
  mssql:
    /unclosed quotation mark|microsoft ole db|odbc sql server|incorrect syntax near|conversion failed when converting/i,
  postgres:
    /pg_query|pg_exec|warning:\s*pg_|syntax error at or near|unterminated quoted string|psql:\s*(error|fatal)/i,
  sqlite:
    /sqlite3?[_\s.]\w*error|unrecognized token|no such (table|column)|sqlite3?\.operationalerror/i,
  oracle: /ora-\d{5}|\boci_[a-z_]+\(\)/i,
};

// Engine-neutral but unmistakable SQL error text: a SQLSTATE code.
const DB_ERROR_GENERIC_RE = /\bSQLSTATE\s*[[=: ]?\s*[A-Z0-9]{5}/i;

// Strict DB-error matcher for CONFIRMATION paths (sqliError,
// postForms). Returns the engine family ('mysql' | 'mssql' |
// 'postgres' | 'sqlite' | 'oracle' | 'generic') or null. A long
// random/token-looking string never matches: every pattern needs a
// genuine error phrase, not a bare engine word.
export function detectDbError(text) {
  const t = String(text || '');
  for (const [family, re] of Object.entries(DB_ERROR_PATTERNS)) {
    if (re.test(t)) return family;
  }
  if (DB_ERROR_GENERIC_RE.test(t)) return 'generic';
  return null;
}

// Quote window around the matched error phrase for finding evidence.
// Falls back to the response head when no phrase matches (the
// 'generic' family, or a caller quoting a non-matching body).
export function dbErrorWindow(text, family) {
  const s = String(text || '');
  const re = DB_ERROR_PATTERNS[family] || (family === 'generic' ? DB_ERROR_GENERIC_RE : null);
  if (!re) return s.slice(0, 200);
  const m = s.match(re);
  if (!m) return s.slice(0, 200);
  const idx = s.indexOf(m[0]);
  return s.slice(Math.max(0, idx - 60), idx + 140);
}

// Stack → database engine for stacks that run exactly one engine in
// practice (9 Nov 2026, Zerodha FP fix). A postgres-flavoured error
// on a WordPress target (MySQL; comment_post_ID is cast to int) is
// impossible — an engine-specific signature that contradicts the
// fingerprinted stack must never confirm. Only unambiguous stacks
// are mapped; anything else returns null (no gate).
const STACK_DB_ENGINE = {
  wordpress: 'mysql',
  drupal: 'mysql',
  joomla: 'mysql',
  magento: 'mysql',
};
export function engineForTech(tech) {
  for (const t of tech || []) {
    const engine = STACK_DB_ENGINE[String(t || '').toLowerCase()];
    if (engine) return engine;
  }
  return null;
}

export async function fingerprint(url, opts = {}) {
  const page = await fetchPage(url, opts);
  return {
    url: page.url,
    status: page.status,
    headers: page.headers,
    setCookies: page.setCookies || [],
    server: page.headers['server'] || null,
    poweredBy: page.headers['x-powered-by'] || null,
    tech: detectTech(page.headers, page.body),
    dbHint: detectDbFamily(page.body),
    body: page.body,
  };
}
