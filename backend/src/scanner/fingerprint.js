// Dark Matter rule-based scanner — lightweight tech-stack fingerprint.
// Pure Node fetch; supplements the wappalyzer-cli pipeline phase.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

export async function fetchPage(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    });
    const headers = {};
    for (const [k, v] of res.headers) headers[k.toLowerCase()] = v;
    let body = '';
    try {
      body = await res.text();
    } catch {
      body = '';
    }
    return { url, status: res.status, headers, body: body.slice(0, 500000) };
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

export async function fingerprint(url, opts = {}) {
  const page = await fetchPage(url, opts);
  return {
    url: page.url,
    status: page.status,
    headers: page.headers,
    server: page.headers['server'] || null,
    poweredBy: page.headers['x-powered-by'] || null,
    tech: detectTech(page.headers, page.body),
    dbHint: detectDbFamily(page.body),
    body: page.body,
  };
}
