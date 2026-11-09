// Dark Matter rule-based scanner — DOM-Based WebSocket-URL Poisoning
// probe (coverage row #92 [Medium] DOM-Based WebSocket-URL Poisoning,
// Technique (no single CVE) | PortSwigger DOM | Client-Side & Browser;
// phase 'cswsh').
//
// ORACLE (deterministic, no judge, no LLM, $0): a WebSocket endpoint is
// CSWSH-vulnerable only when its HTTP Upgrade handshake accepts a
// cross-origin caller. The probe works in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for WebSocket endpoints — `new WebSocket(<url>)` arguments
//   (absolute ws(s):// URLs, protocol-relative URLs, and absolute
//   paths resolved against the page origin) plus bare ws(s):// URL
//   literals. Vendor bundles are excluded by filename stem (a library
//   opening a socket is not the app's vulnerability). ZERO mined
//   endpoints means this page's code opens no socket at all.
//
//   TIER 2 — DISCOVER + DRIVE (raw-socket handshake differential):
//   every candidate endpoint — mined URLs plus the known-path
//   inventory (/ws, /websocket, /socket.io/, /cable, /realtime,
//   /notifications) — is driven through the real RFC 6455 handshake
//   on a raw socket (fetch cannot do the HTTP Upgrade, so the
//   transport is node:net / node:tls, zero deps). The CONTROL
//   handshake (legit Origin + the hunt's lab-session cookies when one
//   exists) must upgrade (101 + a Sec-WebSocket-Accept matching the
//   sent key canary) before the ATTACK handshake counts — a socket
//   the real app cannot open has no victim session to hijack, so
//   control-first is what keeps this probe off false positives. The
//   attack handshake carries `Origin: https://evil.example` and no
//   cookies; a 101 there is the missing-Origin-check finding (T1,
//   Medium — the row's severity). A third no-Origin handshake is
//   recorded as evidence context. No application message is ever
//   sent: the socket is closed immediately after the handshake (or
//   after a short frame-capture window where a tier needs one), so
//   the drive can never trigger an app action.
//
//   T2 — COOKIE-AUTHENTICATED CROSS-ORIGIN SOCKET (High): with the
//   lab session available, the evil-Origin handshake is repeated
//   WITH the session cookies and the server frames it pushes are
//   compared against the anonymous evil-Origin socket. A finding
//   fires only when the authenticated socket receives materially
//   more data (>20 bytes) and no auth challenge — the full CSWSH
//   demonstration. When the server demands an application-layer
//   auth message instead, the medium variant fires (Origin check
//   missing, app-layer auth still stands).
//
//   T3 — AUTH TOKEN IN WEBSOCKET URL (Low): a token-bearing query
//   parameter on a confirmed endpoint — tokens in URLs leak via
//   proxy logs, Referer headers, and browser history.
//
//   T4 — SENSITIVE DATA PUSHED ON CONNECT (Medium/High by content):
//   two stable runs of authenticated-vs-anonymous evil-Origin
//   sockets; a finding fires only when the authenticated runs
//   stably contain sensitive markers the anonymous runs do not.
//
// No CDP / browser drive is needed here, by design: the handshake
// differential IS the attack — a victim's browser sends exactly the
// same Origin header and the same cookies a raw socket sends, and
// the server's Origin/auth decision is made on those headers
// alone. A browser drive would only re-prove the same server
// behaviour through a heavier transport.
//
// GATES: none beyond the scan itself. Unlike the DOM trio probes
// (whose CDP drive needs a lab container + session), this drive is
// a connect-and-close raw socket — no container, no session, no
// writes — so it runs on every scan, lab or not. The lab session,
// when one exists, only sharpens the oracle (authenticated
// discovery + T2/T4). depth 'quick' runs T1 only (T2/T3/T4 need the
// standard/deep handshake budget). A socket the control cannot open
// is skipped, never a finding — including subprotocol endpoints
// (socket.io / GraphQL-WS), which reject a bare Upgrade without
// their own handshake and therefore report "not usable".
//
// HONEST LIMITS (stated up front, not discovered later):
// - A WebSocket URL built dynamically (a variable, a template
//   literal, a framework client such as socket.io's io()) is not
//   mined — the known-path inventory is the fallback for standard
//   paths, and anything else stays untested.
// - The probe never guesses tokens and never sends application
//   messages; a socket that stays silent until the client speaks
//   yields no T2/T4 signal by design.
// - Zero mined endpoints AND zero known-path upgrades is a proven
//   true negative BY THIS ORACLE (no WebSocket surface was found),
//   recorded in the phase record as wsSinks 0 / wsEndpoints 0 —
//   not proof that no socket exists on another page of the app.
// - The frame-capture window is bounded (frameWaitMs, default
//   min(3000, timeoutMs - 1000)); a server that pushes data later
//   than the window is read as silent.

import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';
import { isVendorBundle } from './domXssSinks.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes / domOpenRedirect
const MAX_INLINE = 10;
const MAX_ENDPOINTS = 5; // mined + known-path endpoints driven per scan
const MAX_KNOWN_DISCOVERED = 3; // known-path endpoints accepted per scan

// Known WebSocket endpoint paths to probe (max 6)
const WS_PATHS = ['/ws', '/websocket', '/socket.io/', '/cable', '/realtime', '/notifications'];

// Bundle strings that hint at WebSocket usage (passive detection)
const WS_BUNDLE_PATTERNS = [
  /new\s+WebSocket\s*\(/i,
  /wss:\/\//i,
  /\bws:\/\//i,
  /graphql-ws/i,
  /subscriptions-transport-ws/i,
  /socket\.io/i,
  /SockJS/i,
  /actioncable/i,
  /\/cable\b/i,
];

const SENSITIVE_RE = /email|password|token|balance|ssn|address|phone|api[_-]?key/i;
const TOKEN_IN_URL_RE = /[?&](token|access_token|auth|api[_-]?key)=/i;

// `new WebSocket(<quoted url>)` — the only constructor form whose
// argument is statically resolvable. A variable / template literal
// argument is not mined (see HONEST LIMITS).
const WS_CTOR_RE = /new\s+WebSocket\s*\(\s*['"]([^'"]+)['"]/g;
// Bare ws(s):// URL literals anywhere in code.
const WS_URL_RE = /\bwss?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/g;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function wsKey() {
  return crypto.randomBytes(16).toString('base64');
}

function expectedAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

// Resolve one mined WebSocket URL against the pasted page. Absolute
// ws(s):// URLs and protocol-relative URLs pass through; absolute
// paths resolve against the page origin (ws for http pages, wss for
// https pages). Bare relative paths ('ws', 'socket') are ambiguous
// and are NOT resolved — the known-path inventory covers them.
export function resolveWsUrl(raw, pageUrl) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^wss?:\/\//i.test(s)) return s;
  let baseU;
  try {
    baseU = new URL(pageUrl);
  } catch {
    return null;
  }
  if (s.startsWith('//')) {
    return `${baseU.protocol}//${s.slice(2)}`.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  }
  if (s.startsWith('/')) {
    const scheme = baseU.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${baseU.host}${s}`;
  }
  return null;
}

// All WebSocket endpoint URLs mined from one source body, deduped,
// in first-seen order. Pure — exported for unit tests.
export function extractWsUrls(body, pageUrl) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const cleaned = String(raw || '').replace(/['"<>),;`\\]+$/, '');
    const resolved = resolveWsUrl(cleaned, pageUrl);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      out.push(resolved);
    }
  };
  for (const m of text.matchAll(WS_CTOR_RE)) push(m[1]);
  for (const m of text.matchAll(WS_URL_RE)) {
    // A literal running into `${` is a template prefix, not a
    // complete URL — mining it would probe a truncated path. (The
    // `$` itself is consumed by the URL character class, so the
    // interpolation shows up as a trailing `$` before `{`.)
    const end = m.index + m[0].length;
    if (text.slice(end, end + 2) === '${') continue;
    if (m[0].endsWith('$') && text[end] === '{') continue;
    push(m[0]);
  }
  return out;
}

// Lab-session cookies ({token, cookies:[{name, value, ...}]}) as one
// Cookie header value; a raw cookie string passes through; anything
// else yields '' (no session — T2/T4 are skipped, never faked).
export function cookiesToHeader(session) {
  if (typeof session === 'string') return session;
  if (!session || !Array.isArray(session.cookies)) return '';
  return session.cookies
    .filter((c) => c && typeof c.name === 'string' && typeof c.value === 'string')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

// T1 verdict from the handshake differential. Pure — exported for
// unit tests. The control MUST upgrade: a socket the real app
// cannot open has no victim session to hijack.
export function assessOriginCheck({ controlUp, evilUp }) {
  if (!controlUp) return { verdict: 'uncalibrated', reason: 'control handshake did not upgrade — endpoint not usable' };
  if (evilUp) return { verdict: 'confirmed', reason: 'evil-Origin handshake upgraded while the control did' };
  return { verdict: 'not-vulnerable', reason: 'evil-Origin handshake rejected while the control upgraded' };
}

// T2 verdict from the frame differential. Pure — exported for unit
// tests. authGotData: the authenticated socket received materially
// more data; demandsAuth: the server asked for an application-layer
// auth message before serving data.
export function assessCookieAuth({ authFrames, anonFrames }) {
  const auth = typeof authFrames === 'string' ? authFrames : '';
  const anon = typeof anonFrames === 'string' ? anonFrames : '';
  const authGotData = auth.length > anon.length + 20;
  const demandsAuth = /auth|login|token|unauthor/i.test(auth.slice(0, 500));
  if (authGotData && !demandsAuth) return { verdict: 'confirmed', reason: 'authenticated cross-origin socket received data the anonymous socket did not' };
  if (demandsAuth) return { verdict: 'app-layer-auth', reason: 'server demands an application-layer auth message before data' };
  return { verdict: 'not-vulnerable', reason: 'authenticated socket received no more data than the anonymous socket' };
}

// All sensitive markers in a frame capture, deduped by the join.
// (String.match with a non-global regex returns only the FIRST
// marker — the sort/join below only means something with matchAll.)
function sensitiveMarkers(text) {
  const rx = new RegExp(SENSITIVE_RE.source, 'gi');
  return [...String(text || '').matchAll(rx)].map((m) => m[0].toLowerCase()).sort().join(',');
}

// T4 verdict from two stable runs of authenticated-vs-anonymous
// frame captures. Pure — exported for unit tests. A finding needs
// stable sensitive markers on the authenticated runs that the
// anonymous runs do not carry.
export function assessSensitivePush(runs) {
  const list = Array.isArray(runs) ? runs : [];
  if (list.length < 2) return { verdict: 'not-vulnerable', reason: 'fewer than two runs to compare' };
  const authSensitive = list.map((r) => sensitiveMarkers((r && r.auth) || ''));
  const anonSensitive = list.map((r) => sensitiveMarkers((r && r.anon) || ''));
  const stable = authSensitive[0] === authSensitive[1] && authSensitive[0].length > 0;
  const anonClean = anonSensitive.every((s) => s.length === 0) || anonSensitive[0] !== authSensitive[0];
  if (stable && anonClean) {
    const creds = /password|token|api[_-]?key|balance/i.test(authSensitive[0]);
    return { verdict: 'confirmed', reason: `authenticated socket frames stably contain: ${authSensitive[0]}`, severity: creds ? 'high' : 'medium', markers: authSensitive[0] };
  }
  return { verdict: 'not-vulnerable', reason: 'no stable sensitive markers on the authenticated runs' };
}

// Raw-socket WebSocket handshake. Returns { ok, status, accept, frames, raw }.
// Sends a clean close frame (0x88 0x00) after capturing initial frames.
// opts.captureFrames === false resolves immediately after a 101
// (status-only handshakes — control / attack / no-Origin); otherwise
// the socket stays open for opts.frameWaitMs (default min(3000,
// timeoutMs - 1000)) so a server greeting frame can be captured.
export function wsHandshake(wsUrl, opts = {}) {
  return new Promise((resolve) => {
    const timeoutMs = opts.timeoutMs || 5000;
    const frameWaitMs =
      Number.isFinite(opts.frameWaitMs) && opts.frameWaitMs >= 0
        ? opts.frameWaitMs
        : Math.min(3000, timeoutMs - 1000);
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { sock.destroy(); } catch {}
      resolve(result);
    };
    const timer = setTimeout(() => done({ ok: false, error: 'timeout' }), timeoutMs);

    let u;
    try {
      u = new URL(wsUrl);
    } catch {
      done({ ok: false, error: 'bad-url' });
      return;
    }
    const secure = u.protocol === 'wss:';
    const port = u.port ? parseInt(u.port, 10) : (secure ? 443 : 80);
    const path = (u.pathname || '/') + (u.search || '');
    const key = wsKey();
    const origin = opts.origin; // may be undefined = no Origin header
    const cookieHeader = opts.cookies ? `Cookie: ${opts.cookies}\r\n` : '';

    const request =
      `GET ${path} HTTP/1.1\r\n` +
      `Host: ${u.hostname}${u.port ? ':' + u.port : ''}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\n` +
      `Sec-WebSocket-Version: 13\r\n` +
      (origin ? `Origin: ${origin}\r\n` : '') +
      cookieHeader +
      `User-Agent: ${UA}\r\n` +
      `\r\n`;

    const connectOpts = { host: u.hostname, port };
    if (secure) {
      connectOpts.rejectUnauthorized = opts.rejectUnauthorized !== false ? false : true;
      // Lab targets use self-signed certs; honor scanner insecure-TLS flag.
      if (opts.insecureTLS) connectOpts.rejectUnauthorized = false;
    }
    const sock = secure ? tls.connect(connectOpts) : net.connect(connectOpts);

    let buf = Buffer.alloc(0);
    let headerDone = false;
    let statusLine = '';
    let headers = {};
    const frames = [];

    sock.on('connect', () => sock.write(request));
    sock.on('error', () => done({ ok: false, error: 'connect-failed' }));
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!headerDone) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        const head = buf.slice(0, idx).toString('latin1');
        buf = buf.slice(idx + 4);
        const lines = head.split('\r\n');
        statusLine = lines[0] || '';
        for (const line of lines.slice(1)) {
          const c = line.indexOf(':');
          if (c > 0) headers[line.slice(0, c).trim().toLowerCase()] = line.slice(c + 1).trim();
        }
        headerDone = true;
        const m = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/);
        const status = m ? parseInt(m[1], 10) : 0;
        if (status !== 101) {
          // Send nothing further; capture remaining bytes as raw for evidence.
          done({ ok: true, status, accept: headers['sec-websocket-accept'] || '', frames: [], key });
          return;
        }
        // 101: verify the accept canary, then capture a few frames, then close.
        const accept = headers['sec-websocket-accept'] || '';
        if (accept !== expectedAccept(key)) {
          done({ ok: true, status, accept, frames: [], key, acceptMismatch: true });
          return;
        }
        if (opts.captureFrames === false) {
          try { sock.write(Buffer.from([0x88, 0x00])); } catch {}
          done({ ok: true, status, accept, frames: [], key });
          return;
        }
        // Bytes already buffered past the headers are frame data too:
        // a greeting sent with the 101 in one segment must not be
        // lost waiting for a next data event that never comes.
        if (buf.length > 0) {
          frames.push(buf.toString('latin1'));
          buf = Buffer.alloc(0);
        }
        // Give the server up to the frame window to push frames.
        setTimeout(() => {
          try { sock.write(Buffer.from([0x88, 0x00])); } catch {}
          done({ ok: true, status, accept, frames, key });
        }, frameWaitMs);
      } else {
        // Capture raw frame bytes (cap at 8KB) for the sensitive-data oracle.
        if (buf.length > 0 && frames.join('').length < 8192) {
          frames.push(buf.toString('latin1'));
          buf = Buffer.alloc(0);
        }
      }
    });
    sock.on('close', () => {
      if (!settled && headerDone) {
        const m = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/);
        done({ ok: true, status: m ? parseInt(m[1], 10) : 0, accept: headers['sec-websocket-accept'] || '', frames, key });
      } else if (!settled) {
        done({ ok: false, error: 'closed-before-headers' });
      }
    });
  });
}

// Tier 1 — mine first-party code for WebSocket endpoints. Vendor
// bundles are excluded by filename stem (a library opening a socket
// is not the app's vulnerability). Returns deduped absolute ws(s)://
// URLs in first-seen order.
async function mineWsEndpoints(targets, pageUrl, fetchFn, opts) {
  const urls = [];
  const seen = new Set();
  const addAll = (list) => {
    for (const u of list) {
      if (!seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    }
  };
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];
  for (const bundleUrl of bundles) {
    if (isVendorBundle(bundleUrl)) continue;
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    addAll(extractWsUrls(res.body, pageUrl));
  }
  for (const body of inline) addAll(extractWsUrls(body, pageUrl));
  return urls;
}

// A token-bearing endpoint URL with the token VALUE redacted
// (the parameter name stays). Findings are persisted to the hunt
// log and the report — a live token value must never land there.
function redactWsUrl(wsUrl) {
  return String(wsUrl || '').replace(/((?:token|access_token|auth|api[_-]?key)=)[^&]*/i, '$1<redacted>');
}

function evidenceBase(wsUrl, canary, note) {
  return {
    request: `GET ${redactWsUrl(wsUrl)} HTTP/1.1 + Upgrade: websocket (Origin: https://evil.example, Sec-WebSocket-Key canary ${canary})`,
    response: note,
    impact_demo: 'An attacker page can open a victim-authenticated WebSocket and read/send messages as the victim',
    signalCorrelated: true,
  };
}

/**
 * Probe DOM-Based WebSocket-URL Poisoning (#92).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body).
 * @param {object} opts — { depth, timeoutMs, headers, fetchPage,
 *   session, cookies, diagnostics, insecureTLS, frameWaitMs }.
 *   session is the hunt's lab session ({token, cookies}) when one
 *   exists — it sharpens the oracle (authenticated discovery +
 *   T2/T4) and is never sent to any origin but the target itself.
 *   fetchPage is the bundle-fetch seam (defaults to
 *   fingerprint.fetchPage). diagnostics receives wsSinks /
 *   wsEndpoints / driveAttempted / driveExecuted / sessionOk.
 * @returns {object[]} findings — classes cswsh_origin_missing
 *   (Medium, the row), cswsh_cookie_auth (High, full authenticated
 *   hijack), cswsh_token_in_url (Low), cswsh_sensitive_push
 *   (Medium/High by content). At most one T1/T2 finding per
 *   endpoint, plus at most one T3 and one T4 per endpoint.
 */
export async function probeCswsh(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const timeoutMs = opts.timeoutMs || 5000;
  const depth = opts.depth || 'standard'; // quick, standard, deep
  const canary = `dm${rand()}`;
  const evilOrigin = 'https://evil.example';

  let baseU;
  try { baseU = new URL(pageUrl); } catch { return findings; }
  const legitOrigin = `${baseU.protocol}//${baseU.host}`;
  const cookies = cookiesToHeader(opts.session) || (typeof opts.cookies === 'string' ? opts.cookies : '');
  setDiag('sessionOk', cookies.length > 0);
  const hsOpts = { timeoutMs, insecureTLS: opts.insecureTLS, frameWaitMs: opts.frameWaitMs };

  // TIER 1 — mine first-party code for WebSocket endpoints.
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const mined = await mineWsEndpoints(targets || {}, pageUrl, fetchFn, opts);
  setDiag('wsSinks', mined.length);

  // TIER 2 — discover + drive. The known-path inventory runs even
  // when tier 1 mined nothing: six cheap Upgrade handshakes, not a
  // browser drive, and a sink-less page still gets a full
  // true-negative oracle (mining + known paths). The differential
  // attack handshakes run ONLY on endpoints the control confirms.
  setDiag('driveAttempted', true);
  const candidates = [...mined];
  const scheme = baseU.protocol === 'https:' ? 'wss' : 'ws';
  let discovered = 0;
  for (const p of WS_PATHS) {
    if (candidates.length >= MAX_ENDPOINTS || discovered >= MAX_KNOWN_DISCOVERED) break;
    const wsUrl = `${scheme}://${baseU.host}${p}`;
    if (candidates.includes(wsUrl)) continue;
    const r = await wsHandshake(wsUrl, { origin: legitOrigin, cookies, ...hsOpts, captureFrames: false });
    if (r.ok && r.status === 101 && !r.acceptMismatch) {
      candidates.push(wsUrl);
      discovered += 1;
    }
  }

  let confirmed = 0;
  let executed = false;
  for (const wsUrl of candidates.slice(0, MAX_ENDPOINTS)) {
    // CONTROL — the real app's own handshake must upgrade first.
    const control = await wsHandshake(wsUrl, { origin: legitOrigin, cookies, ...hsOpts, captureFrames: false });
    const controlUp = control.ok && control.status === 101 && !control.acceptMismatch;
    if (!controlUp) continue; // endpoint not usable — never a finding
    confirmed += 1;

    // ATTACK — evil Origin, no cookies. No-Origin recorded as context.
    const evil = await wsHandshake(wsUrl, { origin: evilOrigin, ...hsOpts, captureFrames: false });
    const none = await wsHandshake(wsUrl, { ...hsOpts, captureFrames: false });
    const evilUp = evil.ok && evil.status === 101 && !evil.acceptMismatch;
    executed = true;

    // ---- T1: Origin validation (core CSWSH condition) ----
    const t1 = assessOriginCheck({ controlUp, evilUp });
    if (t1.verdict === 'confirmed') {
      findings.push({
        class: 'cswsh_origin_missing',
        id: `cswsh-origin-${canary}`,
        title: 'WebSocket handshake missing Origin validation — CSWSH possible',
        severity: 'medium',
        url: redactWsUrl(wsUrl),
        parameter: 'Origin',
        evidence: evidenceBase(wsUrl, canary,
          `evil Origin → 101 (accept canary matched); legit Origin → ${control.status || 'err'}; no Origin → ${none.status || 'err'}`),
      });
    }

    if (depth === 'quick') continue;

    // ---- T2: cookie-authenticated cross-origin socket ----
    if (evilUp && cookies) {
      const rAuth = await wsHandshake(wsUrl, { origin: evilOrigin, cookies, ...hsOpts });
      const rAnon = await wsHandshake(wsUrl, { origin: evilOrigin, ...hsOpts });
      const t2 = assessCookieAuth({ authFrames: (rAuth.frames || []).join(' '), anonFrames: (rAnon.frames || []).join(' ') });
      if (t2.verdict === 'confirmed') {
        findings.push({
          class: 'cswsh_cookie_auth',
          id: `cswsh-cookie-${canary}`,
          title: 'Cross-origin WebSocket authenticated via victim cookies — full CSWSH',
          severity: 'high',
          url: redactWsUrl(wsUrl),
          parameter: 'Cookie',
          evidence: evidenceBase(wsUrl, canary,
            `evil Origin + session cookies → 101 with ${(rAuth.frames || []).join(' ').length} bytes of server frames and no auth challenge; anonymous evil-Origin got ${(rAnon.frames || []).join(' ').length} bytes`),
        });
      } else if (t2.verdict === 'app-layer-auth') {
        findings.push({
          class: 'cswsh_origin_missing',
          id: `cswsh-applayer-${canary}`,
          title: 'WebSocket missing Origin check but requires application-layer auth',
          severity: 'medium',
          url: redactWsUrl(wsUrl),
          parameter: 'Origin',
          evidence: evidenceBase(wsUrl, canary,
            `evil Origin → 101, but server demands an auth message before data: "${(rAuth.frames || []).join(' ').slice(0, 120)}"`),
        });
      }
    }

    // ---- T3: auth token in WebSocket URL (static check on a live endpoint) ----
    if (TOKEN_IN_URL_RE.test(wsUrl)) {
      const tokParam = (wsUrl.match(/[?&](token|access_token|auth|api[_-]?key)=/i) || [])[1] || 'token';
      const redactedUrl = wsUrl.replace(/((?:token|access_token|auth|api[_-]?key)=)[^&]*/i, '$1<redacted>');
      findings.push({
        class: 'cswsh_token_in_url',
        id: `cswsh-tokenurl-${canary}`,
        title: 'Authentication token embedded in WebSocket URL',
        severity: 'low',
        url: redactWsUrl(wsUrl),
        parameter: 'query',
        evidence: {
          request: `bundle/endpoint string: ${redactedUrl}`,
          response: `endpoint upgrades (${evil.status || '?'}) with ${tokParam} in the query string — token value redacted`,
          impact_demo: 'Tokens in URLs leak via proxy logs, Referer headers, and browser history',
          signalCorrelated: true,
        },
      });
    }

    // ---- T4: sensitive data pushed on connect (differential) ----
    if (evilUp) {
      const runs = [];
      for (let i = 0; i < 2; i++) {
        const a = await wsHandshake(wsUrl, { origin: evilOrigin, cookies, ...hsOpts });
        const b = await wsHandshake(wsUrl, { origin: evilOrigin, ...hsOpts });
        runs.push({ auth: (a.frames || []).join(' '), anon: (b.frames || []).join(' ') });
      }
      const t4 = assessSensitivePush(runs);
      if (t4.verdict === 'confirmed') {
        findings.push({
          class: 'cswsh_sensitive_push',
          id: `cswsh-push-${canary}`,
          title: 'WebSocket pushes sensitive data on connect without client auth',
          severity: t4.severity,
          url: redactWsUrl(wsUrl),
          parameter: '(server push)',
          evidence: evidenceBase(wsUrl, canary,
            `authenticated socket frames (2 stable runs) contain: ${t4.markers}; anonymous socket does not`),
        });
      }
    }
  }
  setDiag('wsEndpoints', confirmed);
  setDiag('driveExecuted', executed);

  return findings;
}

// Exported for tests: bundle-pattern matcher.
export function matchWsBundleHints(text) {
  const hits = [];
  for (const re of WS_BUNDLE_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

export { WS_PATHS, TOKEN_IN_URL_RE };
export const __cswshMeta = { phases: ['cswsh'], depth: ['quick', 'standard', 'deep'] };
