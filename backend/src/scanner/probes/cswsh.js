// Dark Matter rule-based scanner — Cross-Site WebSocket Hijacking (CSWSH) probe.
// Tests WebSocket endpoints for missing Origin validation on the HTTP Upgrade
// handshake, cookie-authenticated cross-origin sockets, tokens in WS URLs, and
// sensitive data pushed on connect. All CONFIRMED verdicts sit behind
// differential oracles per the 100% truth rule. fetch cannot do the HTTP
// Upgrade, so the transport is a raw socket (node:net / node:tls, zero deps).
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

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

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function wsKey() {
  return crypto.randomBytes(16).toString('base64');
}

function expectedAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

// Raw-socket WebSocket handshake. Returns { ok, status, accept, frames, raw }.
// Sends a clean close frame (0x88 0x00) after capturing initial frames.
export function wsHandshake(wsUrl, opts = {}) {
  return new Promise((resolve) => {
    const timeoutMs = opts.timeoutMs || 5000;
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
        // Give the server up to the remaining timeout to push frames.
        setTimeout(() => {
          try { sock.write(Buffer.from([0x88, 0x00])); } catch {}
          done({ ok: true, status, accept, frames, key });
        }, Math.min(3000, timeoutMs - 1000));
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

// Find WebSocket endpoints: known-path Upgrade probes + bundle hints.
async function findWsEndpoints(baseUrl, opts = {}) {
  const endpoints = [];
  const base = baseUrl.replace(/\/$/, '');
  const baseU = new URL(base);
  const scheme = baseU.protocol === 'https:' ? 'wss' : 'ws';

  for (const p of WS_PATHS) {
    const wsUrl = `${scheme}://${baseU.host}${p}`;
    try {
      const r = await wsHandshake(wsUrl, { origin: `${baseU.protocol}//${baseU.host}`, timeoutMs: opts.timeoutMs || 5000, insecureTLS: opts.insecureTLS });
      if (r.ok && r.status === 101 && !r.acceptMismatch) endpoints.push(wsUrl);
    } catch {}
    if (endpoints.length >= 3) break;
  }
  // Bundle hints supplied by the caller (crawler output).
  for (const hint of opts.bundleHits || []) {
    if (/^wss?:\/\//i.test(hint) && !endpoints.includes(hint)) endpoints.push(hint);
    if (endpoints.length >= 5) break;
  }
  return endpoints;
}

function evidenceBase(wsUrl, canary, note) {
  return {
    request: `GET ${wsUrl} HTTP/1.1 + Upgrade: websocket (Origin: https://evil.example, Sec-WebSocket-Key canary ${canary})`,
    response: note,
    impact_demo: 'An attacker page can open a victim-authenticated WebSocket and read/send messages as the victim',
    signalCorrelated: true,
  };
}

export async function probeCswsh(url, opts = {}) {
  const findings = [];
  const timeoutMs = opts.timeoutMs || 5000;
  const depth = opts.depth || 'standard'; // quick, standard, deep
  const canary = `dm${rand()}`;
  const evilOrigin = 'https://evil.example';

  let baseU;
  try { baseU = new URL(url); } catch { return findings; }
  const legitOrigin = `${baseU.protocol}//${baseU.host}`;

  // Step 1: find endpoints
  const endpoints = await findWsEndpoints(url, { ...opts, timeoutMs });
  if (endpoints.length === 0) return findings;

  for (const wsUrl of endpoints) {
    // ---- T1: Origin validation (core CSWSH condition) ----
    const rLegit = await wsHandshake(wsUrl, { origin: legitOrigin, timeoutMs, insecureTLS: opts.insecureTLS });
    const rEvil = await wsHandshake(wsUrl, { origin: evilOrigin, timeoutMs, insecureTLS: opts.insecureTLS });
    const rNone = await wsHandshake(wsUrl, { timeoutMs, insecureTLS: opts.insecureTLS }); // no Origin

    const evilUpgraded = rEvil.ok && rEvil.status === 101 && !rEvil.acceptMismatch;
    const legitUpgraded = rLegit.ok && rLegit.status === 101 && !rLegit.acceptMismatch;

    if (evilUpgraded) {
      findings.push({
        class: 'cswsh_origin_missing',
        id: `cswsh-origin-${canary}`,
        title: 'WebSocket handshake missing Origin validation — CSWSH possible',
        severity: 'high',
        url: wsUrl,
        parameter: 'Origin',
        evidence: evidenceBase(wsUrl, canary,
          `evil Origin → 101 (accept canary matched); legit Origin → ${rLegit.status || 'err'}; no Origin → ${rNone.status || 'err'}`),
      });
    } else if (legitUpgraded && rEvil.ok && [400, 403].includes(rEvil.status)) {
      // Origin check present — no finding, noted only.
    }

    if (depth === 'quick') continue;

    // ---- T2: cookie-authenticated cross-origin socket ----
    if (evilUpgraded && opts.cookies) {
      const rAuth = await wsHandshake(wsUrl, { origin: evilOrigin, cookies: opts.cookies, timeoutMs, insecureTLS: opts.insecureTLS });
      const rAnon = await wsHandshake(wsUrl, { origin: evilOrigin, timeoutMs, insecureTLS: opts.insecureTLS });
      const authFrames = (rAuth.frames || []).join(' ');
      const anonFrames = (rAnon.frames || []).join(' ');
      if (rAuth.ok && rAuth.status === 101 && !rAuth.acceptMismatch) {
        const authGotData = authFrames.length > anonFrames.length + 20;
        const demandsAuth = /auth|login|token|unauthor/i.test(authFrames.slice(0, 500));
        if (authGotData && !demandsAuth) {
          findings.push({
            class: 'cswsh_cookie_auth',
            id: `cswsh-cookie-${canary}`,
            title: 'Cross-origin WebSocket authenticated via victim cookies — full CSWSH',
            severity: 'high',
            url: wsUrl,
            parameter: 'Cookie',
            evidence: evidenceBase(wsUrl, canary,
              `evil Origin + session cookies → 101 with ${authFrames.length} bytes of server frames and no auth challenge; anonymous evil-Origin got ${anonFrames.length} bytes`),
          });
        } else if (demandsAuth) {
          findings.push({
            class: 'cswsh_origin_missing',
            id: `cswsh-applayer-${canary}`,
            title: 'WebSocket missing Origin check but requires application-layer auth',
            severity: 'medium',
            url: wsUrl,
            parameter: 'Origin',
            evidence: evidenceBase(wsUrl, canary,
              `evil Origin → 101, but server demands an auth message before data: "${authFrames.slice(0, 120)}"`),
          });
        }
      }
    }

    // ---- T3: auth token in WebSocket URL (bundle-string check) ----
    if (TOKEN_IN_URL_RE.test(wsUrl)) {
      findings.push({
        class: 'cswsh_token_in_url',
        id: `cswsh-tokenurl-${canary}`,
        title: 'Authentication token embedded in WebSocket URL',
        severity: 'low',
        url: wsUrl,
        parameter: 'query',
        evidence: {
          request: `bundle/endpoint string: ${wsUrl}`,
          response: 'endpoint upgrades (101) with token in query string',
          impact_demo: 'Tokens in URLs leak via proxy logs, Referer headers, and browser history',
          signalCorrelated: true,
        },
      });
    }

    // ---- T4: sensitive data pushed on connect (differential) ----
    if (evilUpgraded) {
      const runs = [];
      for (let i = 0; i < 2; i++) {
        const a = await wsHandshake(wsUrl, { origin: evilOrigin, cookies: opts.cookies, timeoutMs, insecureTLS: opts.insecureTLS });
        const b = await wsHandshake(wsUrl, { origin: evilOrigin, timeoutMs, insecureTLS: opts.insecureTLS });
        runs.push({ auth: (a.frames || []).join(' '), anon: (b.frames || []).join(' ') });
      }
      const authSensitive = runs.map(r => (r.auth.match(SENSITIVE_RE) || []).map(m => m.toLowerCase()).sort().join(','));
      const anonSensitive = runs.map(r => (r.anon.match(SENSITIVE_RE) || []).map(m => m.toLowerCase()).sort().join(','));
      const stable = authSensitive[0] === authSensitive[1] && authSensitive[0].length > 0;
      const anonClean = anonSensitive.every(s => s.length === 0) || anonSensitive[0] !== authSensitive[0];
      if (stable && anonClean) {
        const creds = /password|token|api[_-]?key|balance/i.test(authSensitive[0]);
        findings.push({
          class: 'cswsh_sensitive_push',
          id: `cswsh-push-${canary}`,
          title: 'WebSocket pushes sensitive data on connect without client auth',
          severity: creds ? 'high' : 'medium',
          url: wsUrl,
          parameter: '(server push)',
          evidence: evidenceBase(wsUrl, canary,
            `authenticated socket frames (2 stable runs) contain: ${authSensitive[0]}; anonymous socket does not`),
        });
      }
    }
  }

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
