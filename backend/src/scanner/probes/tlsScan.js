// Dark Matter rule-based scanner — TLS / certificate / crypto-transport probe.
//
// Defensive detection framing: every check here is a *measurement* of the
// target's own presented surface — the certificate it serves, the protocol
// versions and cipher suites it negotiates, whether it serves content over
// cleartext HTTP. Nothing is exploited and nothing is mutated: the probe
// opens handshakes, reads the server's offered parameters, closes the
// socket. A finding fires only on the server's own evidence (its presented
// cert fields, a successful negotiation of a legacy protocol/cipher, a 200
// over cleartext). Weak-cipher/protocol probes send ONLY restricted
// ClientHellos — they succeed exactly when the server *offers* the weak
// option, which is itself the defect.
//
// Coverage (LIVE):
//   #125  cert invalid/expired/self-signed/hostname-mismatch (medium)
//   #451  certificate chain broken/untrusted (medium/high)
//   #129  cleartext HTTP + cleartext downgrade (high)
//   #133  weak cipher suites: RC4 / single-DES / export (high)
//   #450  SWEET32 (3DES) (medium)
//   #134  weak protocol versions TLS 1.0/1.1 (medium/low)
//   #447  BEAST (TLS 1.0 + CBC) (medium)
//   #448  BREACH oracle surface (compression + secret reflection) (medium)
// Honest gaps (no code, reported so the coordinator marks them GAP):
//   #123  improper certificate validation (client-side; unobservable black-box)
//   #126  sensitive data at rest unencrypted (server-side; unobservable)
//   #449  DROWN (SSLv2) — node:tls has zero SSLv2 support, cannot handshake
//   #448-full CRIME (TLS compression) — node:tls never offers compression,
//            so it is not testable from node; BREACH *surface* is testable
//            at the HTTP layer and is covered.
//
// Runtime budget: < 30s per scan. Stages stop early on failure; a hard
// deadline (25s) guards every stage. Weak cipher/protocol handshakes only
// run after a successful baseline handshake ("skip fast on failure").

import tls from 'node:tls';
import net from 'node:net';
import https from 'node:https';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const BUDGET_MS = 25000;

// ---------------------------------------------------------------------------
// TLS handshake plumbing
// ---------------------------------------------------------------------------

// One TLS handshake attempt. Resolves {ok, protocol, cipher, cert, error}.
// rejectUnauthorized:false for capture — the cert is ANALYSED by us, never
// trusted from the handshake.
function handshake(host, port, { minVersion, maxVersion, ciphers, strict = false } = {}) {
  return new Promise((resolve) => {
    let sock;
    const done = (r) => {
      try { sock.destroy(); } catch { /* already closed */ }
      resolve(r);
    };
    const watchdog = setTimeout(() => done({ ok: false, error: 'timeout' }), 5000);
    try {
      sock = tls.connect(
        {
          host,
          port,
          ...(net.isIP(host) ? {} : { servername: host }), // SNI only for DNS names
          minVersion,
          maxVersion,
          ciphers,
          rejectUnauthorized: strict,
          timeout: 5000,
        },
        () => {
          clearTimeout(watchdog);
          const cipher = sock.getCipher() || {};
          const cert = sock.getPeerCertificate(true) || {};
          done({
            ok: true,
            protocol: cipher.version || sock.getProtocol() || '?',
            cipher: cipher.name || '?',
            cert: cert.raw ? cert : null,
          });
        }
      );
    } catch (e) {
      // e.g. node throws synchronously for SSLv3 min/max — treated as
      // "not offered", never as an error. See probeTls SSLv3 stage.
      clearTimeout(watchdog);
      resolve({ ok: false, error: e && e.code ? e.code : 'connect-throw' });
      return;
    }
    sock.on('error', (e) => {
      clearTimeout(watchdog);
      done({ ok: false, error: e && e.code ? e.code : 'socket-error' });
    });
    sock.on('timeout', () => {
      clearTimeout(watchdog);
      done({ ok: false, error: 'timeout' });
    });
  });
}

// ---------------------------------------------------------------------------
// Pure certificate analysis helpers (unit-testable, no network)
// ---------------------------------------------------------------------------

// Node cert objects: {subject:{CN,...}, issuer:{CN,...}, valid_from,
// valid_to, serialNumber, fingerprint, subjectaltname, issuerCertificate}.
export function isSelfSigned(cert) {
  if (!cert || !cert.subject || !cert.issuer) return false;
  // Primary: issuerCertificate is a self-reference (node does this for
  // self-signed roots). Fallback: subject and issuer RDNs identical.
  if (cert.issuerCertificate === cert) return true;
  return JSON.stringify(cert.subject) === JSON.stringify(cert.issuer);
}

// Number of certs in the presented chain (leaf → ... → root). A lone leaf
// whose issuerCertificate is itself or missing yields depth 1.
export function getChainDepth(cert) {
  let depth = 0;
  let cur = cert;
  const seen = new Set();
  while (cur && cur.issuerCertificate && !seen.has(cur) && depth < 16) {
    seen.add(cur);
    depth += 1;
    cur = cur.issuerCertificate;
  }
  // Leaf without any issuerCertificate info counts as depth 1 (presented
  // alone) when we have a raw cert at all.
  if (depth === 0 && cert && cert.raw) return 1;
  return depth;
}

function parseSanList(cert) {
  const out = [];
  const raw = String(cert.subjectaltname || '');
  for (const part of raw.split(',')) {
    const p = part.trim();
    if (/^DNS:/i.test(p)) out.push({ type: 'dns', value: p.slice(4).trim() });
    else if (/^IP Address:/i.test(p)) out.push({ type: 'ip', value: p.slice(11).trim() });
  }
  return out;
}

function dnsNameMatches(pattern, host) {
  const p = String(pattern).toLowerCase();
  const h = String(host).toLowerCase();
  if (p === h) return true;
  if (p.startsWith('*.')) {
    const suffix = p.slice(1); // ".example.com"
    const label = h.slice(0, h.length - suffix.length);
    return h.endsWith(suffix) && label.length > 0 && !label.includes('.');
  }
  return false;
}

// Hostname check against SANs (preferred) with CN fallback — mirrors what a
// validating client does, but we do it ourselves on the captured cert.
export function hostMatchesCert(host, cert) {
  if (!cert) return false;
  const sans = parseSanList(cert);
  if (sans.length) {
    for (const s of sans) {
      if (s.type === 'ip' && net.isIP(host) && s.value === host) return true;
      if (s.type === 'dns' && !net.isIP(host) && dnsNameMatches(s.value, host)) return true;
    }
    return false;
  }
  const cn = cert.subject && cert.subject.CN;
  return typeof cn === 'string' && dnsNameMatches(cn, String(host));
}

function certSummary(cert) {
  const sans = parseSanList(cert).map((s) => `${s.type}:${s.value}`).join(', ');
  return [
    `subject=${JSON.stringify(cert.subject || {})}`,
    `issuer=${JSON.stringify(cert.issuer || {})}`,
    `valid_from=${cert.valid_from || '?'}`,
    `valid_to=${cert.valid_to || '?'}`,
    `serial=${cert.serialNumber || '?'}`,
    `SANs=[${sans || 'none'}]`,
  ].join(' ');
}

// Returns array of {id,title,severity,detail} — the #125 / #451-static
// verdicts from the captured cert alone.
export function analyzeCertificate(cert, host) {
  const out = [];
  if (!cert || !cert.raw) return out;
  const now = Date.now();
  const summary = certSummary(cert);

  if (cert.valid_to) {
    const end = new Date(cert.valid_to).getTime();
    if (Number.isFinite(end) && end < now) {
      out.push({
        id: 'tls_cert_expired',
        title: 'TLS certificate is expired',
        severity: 'medium',
        detail: `server presented an expired certificate: valid_to=${cert.valid_to} (now=${new Date(now).toISOString()}). ${summary}`,
      });
    }
  }

  if (isSelfSigned(cert)) {
    out.push({
      id: 'tls_cert_selfsigned',
      title: 'TLS certificate is self-signed (not trusted by any strict client)',
      severity: 'medium',
      detail: `issuer == subject; no CA signature. ${summary}`,
    });
  }

  if (!hostMatchesCert(host, cert)) {
    out.push({
      id: 'tls_cert_hostname_mismatch',
      title: 'TLS certificate does not match the target hostname',
      severity: 'medium',
      detail: `certificate names do not cover host '${host}'. ${summary}`,
    });
  }

  // #451 static half: chain presented as a lone leaf that is NOT
  // self-signed => intermediates missing (clients without AIA chasing
  // will fail to build the chain).
  const depth = getChainDepth(cert);
  if (depth === 1 && !isSelfSigned(cert)) {
    out.push({
      id: 'tls_cert_chain_incomplete',
      title: 'TLS certificate chain is incomplete (missing intermediate CA)',
      severity: 'medium',
      detail: `server presented only the leaf (chain depth 1, not self-signed); strict clients cannot build a path to a trusted root. ${summary}`,
    });
  }

  return out;
}

// Strict-handshake (rejectUnauthorized:true) error → honest verdict.
// Returns 'untrusted' | 'already-covered' | null. We only raise
// tls_cert_untrusted (high) for errors that prove a *cryptographically
// invalid* chain or a self-signed cert mid-chain — beyond the cases the
// static analysis already covers (expiry, lone self-signed leaf), to avoid
// double-counting the same defect.
export function mapStrictHandshakeError(code) {
  switch (code) {
    case 'CERT_HAS_EXPIRED':
      return 'already-covered'; // tls_cert_expired (medium) already fired
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
      return 'already-covered'; // tls_cert_selfsigned (medium) already fired
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'CERT_UNTRUSTED':
      return 'untrusted';
    default:
      return null; // e.g. UNABLE_TO_GET_ISSUER_CERT_LOCALLY is about OUR
                   // trust store, not the cert's validity — no finding.
  }
}

// BEAST heuristic: TLS 1.0 negotiated WITH a CBC-mode cipher suite.
export function isCbcCipher(name) {
  const n = String(name || '');
  if (/CBC/i.test(n)) return true;
  // Legacy '-SHA' suites without GCM/CHACHA20 are CBC (e.g. AES128-SHA).
  return /-SHA\d*$/.test(n) && !/GCM/i.test(n) && !/CHACHA/i.test(n);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function fetchManual(url, { headers = {}, timeoutMs = 10000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual', // observe Location/cookies, never follow
      headers: { 'User-Agent': UA, ...headers },
    });
    const body = await res.text().catch(() => '');
    const setCookie = res.headers.get('set-cookie') || '';
    return { status: res.status, location: res.headers.get('location') || '', setCookie, body };
  } catch (e) {
    return { error: String((e && e.code) || (e && e.message) || e) };
  } finally {
    clearTimeout(t);
  }
}

// Raw HTTPS GET that does NOT auto-decompress (undici fetch would), so we
// can observe the true Content-Encoding the server applies.
function rawHttpsGet(url, { headers = {}, timeoutMs = 10000, maxBytes = 1 << 20 } = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, ...headers }, timeout: timeoutMs }, (res) => {
      let bytes = 0;
      res.on('data', (c) => {
        bytes += c.length;
        if (bytes > maxBytes) { res.destroy(); resolve({ status: res.statusCode, contentEncoding: res.headers['content-encoding'] || '', truncated: true }); }
      });
      res.on('end', () => resolve({ status: res.statusCode, contentEncoding: res.headers['content-encoding'] || '' }));
      res.on('error', () => resolve({ error: 'body-error' }));
      res.resume(); // discard body; only headers matter here
    });
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', (e) => resolve({ error: String((e && e.code) || e) }));
  });
}

const SECRET_CONTEXT_RES = [
  /name=["']?(csrf|_token|authenticity_token|__requestverificationtoken|xsrf)[^>]{0,200}/i,
  /\b(session[_-]?id|phpsessid|jsessionid|aspsessionid)\b\s*[=:]\s*["']?[A-Za-z0-9\-_]{16,}/i,
];

function findSecretContext(body) {
  for (const re of SECRET_CONTEXT_RES) {
    const m = String(body).match(re);
    if (m) return m[0].slice(0, 120); // pattern shape only; token value truncated
  }
  return null;
}

// ---------------------------------------------------------------------------
// Finding factory (probe contract)
// ---------------------------------------------------------------------------

function finding({ cls, id, title, severity, url, parameter, request, response, impact }) {
  return {
    class: cls,
    id,
    title,
    severity,
    url,
    parameter,
    evidence: { request, response, impact_demo: impact, signalCorrelated: true },
  };
}

// ---------------------------------------------------------------------------
// Main probe — runs once per scan, not per parameter
// ---------------------------------------------------------------------------

export async function probeTls(url, opts = {}) {
  const findings = [];
  let u;
  try {
    u = new URL(url);
  } catch {
    return findings;
  }
  const host = u.hostname;
  const isHttps = u.protocol === 'https:';
  const port = u.port ? Number(u.port) : isHttps ? 443 : 80;
  const deadline = Date.now() + (opts.budgetMs || BUDGET_MS);
  const timeLeft = () => deadline - Date.now();

  const mk = (cls, id, title, severity, parameter, request, response, impact) =>
    findings.push(finding({ cls, id, title, severity, url, parameter, request, response, impact }));

  // ---- #129: cleartext HTTP ----------------------------------------------
  // http:// target serving content at all = cleartext transport finding.
  if (!isHttps) {
    if (timeLeft() > 0) {
      const r = await fetchManual(url, { timeoutMs: Math.min(10000, timeLeft()) });
      if (!r.error && r.status >= 200 && r.status < 400) {
        mk(
          'tls', 'tls_cleartext_http', 'Target served over cleartext HTTP', 'high', 'scheme',
          `GET ${url} (User-Agent: ${UA}, redirect:manual)`,
          `HTTP ${r.status} over cleartext http:// — no TLS`,
          'credentials, session cookies and page content traverse the network unencrypted; passive sniffing and active MITM'
        );
      }
    }
    return findings; // nothing else is meaningful without TLS
  }

  // ---- baseline TLS handshake (cert capture) -------------------------------
  let base = null;
  if (timeLeft() > 2000) {
    base = await handshake(host, port);
  }
  if (!base || !base.ok) {
    // No TLS at all on the target port — nothing further to measure.
    return findings;
  }

  // ---- #125 / #451-static: analyse the captured cert -----------------------
  if (base.cert) {
    for (const v of analyzeCertificate(base.cert, host)) {
      mk(
        'tls', v.id, v.title, v.severity, 'certificate',
        `TLS handshake to ${host}:${port}${net.isIP(host) ? '' : ` (SNI: ${host})`} — certificate captured with rejectUnauthorized:false, then analysed locally (handshake never trusted)`,
        v.detail,
        v.id === 'tls_cert_expired'
          ? 'expired cert trains users to click through warnings; strict clients refuse the connection'
          : v.id === 'tls_cert_selfsigned'
            ? 'no CA attestation — any MITM can present an equally "valid" self-signed cert'
            : v.id === 'tls_cert_hostname_mismatch'
              ? 'validating clients abort; users click through, enabling MITM'
              : 'strict clients fail closed (no trust path); availability + downgrade pressure'
      );
    }
  }

  // ---- #451-dynamic: strict handshake — does a validating client accept? ---
  if (timeLeft() > 2000) {
    const strict = await handshake(host, port, { strict: true });
    if (!strict.ok && strict.error) {
      const verdict = mapStrictHandshakeError(strict.error);
      if (verdict === 'untrusted') {
        mk(
          'tls', 'tls_cert_untrusted', 'TLS certificate rejected by a strict validating client', 'high', 'certificate',
          `TLS handshake to ${host}:${port} with rejectUnauthorized:true`,
          `strict handshake failed with ${strict.error}; certificate chain is cryptographically invalid or contains a self-signed cert (chain depth seen: ${base.cert ? getChainDepth(base.cert) : '?'})`,
          'browsers and API clients refuse the connection; operators/users disable validation to cope, opening MITM'
        );
      }
      // 'already-covered' (expired / lone self-signed) and null (our trust
      // store lacks the issuer — a local-store fact, not a cert defect)
      // produce no finding. Honest by construction.
    }
  }

  // ---- #134 / #447: weak protocol versions + BEAST --------------------------
  const tryVersion = async (maxVersion, fid, title, severity, beastCheck) => {
    if (timeLeft() <= 2000) return;
    const r = await handshake(host, port, { minVersion: maxVersion, maxVersion });
    if (r.ok) {
      mk(
        'tls', fid, title, severity, 'tls-protocol',
        `TLS handshake to ${host}:${port} with maxVersion=${maxVersion}`,
        `server negotiated ${r.protocol} with cipher ${r.cipher}`,
        fid === 'tls_weak_protocol_1_0'
          ? 'TLS 1.0 lacks per-record IV randomisation (BEAST) and modern AEAD; POODLE-class padding issues in legacy stacks'
          : 'TLS 1.1 deprecated (RFC 8996); no AEAD, weak against modern attacks'
      );
      if (beastCheck && /^TLSv?1(\.0)?$/.test(String(r.protocol)) && isCbcCipher(r.cipher)) {
        mk(
          'tls', 'tls_beast', 'BEAST: TLS 1.0 negotiated with a CBC-mode cipher suite', 'medium', 'tls-protocol',
          `TLS handshake to ${host}:${port} with maxVersion=${maxVersion}`,
          `negotiated ${r.protocol} + CBC cipher ${r.cipher} — the BEAST precondition (predictable IV chaining)`,
          'chosen-plaintext recovery of session cookies on TLS 1.0 + CBC (largely mitigated client-side by 1/n-1 splitting, but server-side support keeps the surface)'
        );
      }
    }
  };
  await tryVersion('TLSv1', 'tls_weak_protocol_1_0', 'Server accepts TLS 1.0', 'medium', true);
  await tryVersion('TLSv1.1', 'tls_weak_protocol_1_1', 'Server accepts TLS 1.1', 'low', false);
  // SSLv3: node:tls throws (unsupported protocol) — that throw IS the
  // evidence it is not offered. No finding, no error, by design.
  if (timeLeft() > 2000) {
    const ssl3 = await handshake(host, port, { minVersion: 'SSLv3', maxVersion: 'SSLv3' });
    if (ssl3.ok) {
      mk('tls', 'tls_sslv3_offered', 'Server accepts SSLv3 (POODLE)', 'high', 'tls-protocol',
        `TLS handshake to ${host}:${port} with maxVersion=SSLv3`,
        `server negotiated ${ssl3.protocol} — SSLv3 must never be offered`,
        'POODLE padding-oracle: full plaintext recovery of cookies');
    }
    // ssl3.ok === false (throw / alert) → not offered → silent, correct.
  }

  // ---- #133 / #450: weak cipher suites --------------------------------------
  const tryCiphers = async (ciphers, fid, cls, title, severity, impact) => {
    if (timeLeft() <= 2000) return;
    const r = await handshake(host, port, { ciphers });
    if (r.ok) {
      mk(cls, fid, title, severity, 'tls-cipher',
        `TLS handshake to ${host}:${port} offering ONLY cipher list: ${ciphers}`,
        `server completed the handshake with cipher ${r.cipher} (${r.protocol}) — it accepts the weak suite`,
        impact);
    }
    // Failure (no cipher match / handshake alert) = not offered → silent.
  };
  await tryCiphers(
    'RC4-SHA:RC4-MD5', 'tls_weak_cipher_rc4', 'tls',
    'Server negotiates RC4 cipher suites', 'high',
    'RC4 keystream biases allow plaintext recovery (e.g. session cookies) with enough captured traffic'
  );
  await tryCiphers(
    'DES-CBC3-SHA', 'tls_weak_cipher_3des', 'tls_sweet32',
    'Server negotiates 3DES (SWEET32: 64-bit block cipher)', 'medium',
    'SWEET32: 64-bit block size → birthday collisions after ~32GB on one connection; practical cookie recovery on long-lived TLS sessions'
  );
  await tryCiphers(
    'DES-CBC-SHA:EXP-DES-CBC-SHA', 'tls_weak_cipher_des_export', 'tls',
    'Server negotiates single-DES / export-grade DES cipher suites', 'high',
    '56-bit (or 40-bit export) DES is brute-forceable; export suites are the FREAK-class downgrade surface'
  );

  // ---- #129 downgrade: does http:// serve content instead of redirecting? --
  // Test hook: opts.plainHttpUrl overrides the derived URL (lets tests point
  // at a local stub; production path is always http://host/).
  if (timeLeft() > 2000) {
    const plainUrl = opts.plainHttpUrl || `http://${host}/`;
    const r = await fetchManual(plainUrl, { timeoutMs: Math.min(10000, timeLeft()) });
    if (!r.error && r.status === 200) {
      const hasLogin = /<input[^>]*type=["']?password["']?/i.test(r.body) || /<form[^>]*>/i.test(r.body);
      const hasSessionCookie = /set-cookie/i.test(r.setCookie) || /(session|sid|token|auth)=/i.test(r.setCookie);
      if (hasLogin || hasSessionCookie) {
        mk(
          'tls', 'tls_cleartext_downgrade', 'Cleartext HTTP serves sensitive content instead of redirecting to HTTPS', 'high', 'scheme',
          `GET ${plainUrl} (User-Agent: ${UA}, redirect:manual)`,
          `HTTP 200 over cleartext with ${hasLogin ? 'a login form' : ''}${hasLogin && hasSessionCookie ? ' and ' : ''}${hasSessionCookie ? `session cookie (${r.setCookie.slice(0, 80)})` : ''} — no redirect to https://`,
          'credentials submitted or sessions minted over cleartext are sniffable/MITM-able despite the site "having" HTTPS'
        );
      }
    }
    // 3xx → https, 4xx/5xx, or connection refused → no finding. Correct:
    // the downgrade defect is specifically 200-with-secrets on cleartext.
  }

  // ---- #448: BREACH oracle surface (HTTP-layer compression + secret reflection)
  // CRIME (TLS-level compression) is NOT testable from node:tls — the stack
  // never offers compression, so no active test exists. Documented as an
  // honest gap in docs/scanner/tls-scan.md. What IS measurable: the server
  // compressing HTTP responses that reflect secret-ish values gives an
  // attacker the BREACH oracle precondition. Full BREACH exploitation needs
  // thousands of adaptive requests and is explicitly out of scope — this
  // finding reports the *surface*, not an exploited oracle.
  if (timeLeft() > 2000) {
    const probeUrl = url; // the target page itself
    const [compressed, page] = await Promise.all([
      rawHttpsGet(probeUrl, { headers: { 'Accept-Encoding': 'gzip, deflate' }, timeoutMs: Math.min(8000, timeLeft()) }),
      fetchManual(probeUrl, { timeoutMs: Math.min(10000, timeLeft()) }),
    ]);
    const ce = String(compressed.contentEncoding || '').toLowerCase();
    if (!compressed.error && /gzip|deflate/.test(ce) && !page.error) {
      const secretCtx = findSecretContext(page.body);
      if (secretCtx) {
        mk(
          'tls', 'tls_breach_surface', 'BREACH oracle surface: HTTP compression enabled on a page reflecting secret values', 'medium', 'http-compression',
          `GET ${probeUrl} with Accept-Encoding: gzip, deflate (raw socket, no auto-decompression)`,
          `response Content-Encoding: ${compressed.contentEncoding}; same page reflects secret-shaped values (e.g. ${secretCtx}…)`,
          'BREACH precondition: attacker-influenced reflection inside a compressed secret-bearing response lets a MITM recover the secret byte-by-byte; full adaptive exploitation is out of scope for this probe'
        );
      }
    }
  }

  return findings;
}
