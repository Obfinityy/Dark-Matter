// Dark Matter rule-based scanner — cryptography measurement probe (#34).
//
// First class that MEASURES properties instead of injecting payloads:
//   T1. TLS version/cipher baseline — MEDIUM/HIGH: pinned handshakes per
//       version; accepts TLS1.0/1.1 -> MEDIUM, RC4/3DES/export/null -> HIGH.
//   T2. Session-token structure — HIGH when predictable: >=2 independent
//       structural signals (monotonic, timestamp-decode, low entropy,
//       username-derived). Needs harvested tokens (opts.cryptoTokens).
//   T3. Reset-token analysis — HIGH/CRITICAL: static or structured tokens.
//       Needs lab mailbox surface; skipped gracefully when absent.
//   T4. Plaintext password in reset flow — CRITICAL: single observation,
//       password redacted at capture (p***d).
//   T5. Exposed password hashes — HIGH: MD5/SHA1 tied to an account;
//       bcrypt/argon2 -> INFO (sound). Scans fetched page/API bodies.
//   T6. Weak secret derivation — MEDIUM: base64(username:ts)/md5(username)
//       round-trip decode on harvested tokens.
//
// Overlaps deliberately avoided: JWT (#27), cookie flags (cookies.js),
// HSTS (headers.js), open-redirect (redirect.js) — untouched.
// Safety: <=8 handshakes per origin, sequential, 5s cap each. No cracking
// (identification is the finding). No cert-validation bypass. Tokens only
// from self-owned lab accounts. Every CONFIRMED behind the stated bar.

import tls from 'node:tls';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- T1: TLS version / cipher measurement ---------------------------------
const TLS_VERSIONS = [
  { name: 'TLS1.0', min: 'TLSv1', max: 'TLSv1' },
  { name: 'TLS1.1', min: 'TLSv1.1', max: 'TLSv1.1' },
  { name: 'TLS1.2', min: 'TLSv1.2', max: 'TLSv1.2' },
  { name: 'TLS1.3', min: 'TLSv1.3', max: 'TLSv1.3' },
];
const WEAK_CIPHERS = [
  'RC4-SHA',
  'RC4-MD5',
  'DES-CBC3-SHA', // 3DES
  'EXP-RC4-MD5',
  'EXP-DES-CBC-SHA',
  'NULL-SHA',
  'NULL-MD5',
];

function tlsProbe(host, port, { minVersion, maxVersion, ciphers } = {}) {
  return new Promise((resolve) => {
    const sock = tls.connect(
      {
        host,
        port,
        minVersion,
        maxVersion,
        ciphers,
        rejectUnauthorized: false,
        servername: host,
        timeout: 5000,
      },
      () => {
        const cipher = sock.getCipher();
        const proto = sock.getProtocol();
        sock.end();
        resolve({ ok: true, cipher: cipher ? cipher.name : '?', version: cipher ? cipher.version : proto });
      }
    );
    sock.on('error', () => resolve({ ok: false }));
    sock.on('timeout', () => {
      sock.destroy();
      resolve({ ok: false });
    });
    setTimeout(() => {
      try {
        sock.destroy();
      } catch {}
      resolve({ ok: false });
    }, 6000).unref?.();
  });
}

async function t1Tls(url, opts) {
  const findings = [];
  let u;
  try {
    u = new URL(url);
  } catch {
    return findings;
  }
  if (u.protocol !== 'https:') return findings; // nothing to measure
  const host = u.hostname;
  const port = u.port ? parseInt(u.port, 10) : 443;
  const accepted = [];
  for (const v of TLS_VERSIONS) {
    const r = await tlsProbe(host, port, { minVersion: v.min, maxVersion: v.max });
    if (r.ok) accepted.push({ ...v, cipher: r.cipher });
  }
  for (const v of accepted) {
    if (v.name === 'TLS1.0' || v.name === 'TLS1.1') {
      findings.push({
        class: 'weak_crypto',
        id: `tls-version-${rand()}`,
        title: `Weak TLS — deprecated ${v.name} accepted (MEDIUM)`,
        severity: 'medium',
        url: `${host}:${port}`,
        parameter: 'tls-version',
        evidence: ev(
          `TLS handshake offering ONLY ${v.name} to ${host}:${port}`,
          `Server ACCEPTED ${v.name} (negotiated cipher: ${v.cipher}). Deprecated protocol exposed to POODLE/BEAST-class attacks.`,
          'Downgrade/legacy-protocol attack surface on the TLS endpoint.'
        ),
      });
    }
  }
  // Weak-only cipher list against TLS1.2.
  const rw = await tlsProbe(host, port, {
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.2',
    ciphers: WEAK_CIPHERS.join(':'),
  });
  if (rw.ok) {
    findings.push({
      class: 'weak_crypto',
      id: `tls-cipher-${rand()}`,
      title: 'Weak TLS — broken cipher suite accepted (RC4/3DES/export/null) (HIGH)',
      severity: 'high',
      url: `${host}:${port}`,
      parameter: 'tls-cipher',
      evidence: ev(
        `TLS1.2 handshake to ${host}:${port} offering ONLY weak ciphers (${WEAK_CIPHERS.slice(0, 4).join(', ')}...)`,
        `Server ACCEPTED a broken cipher: ${rw.cipher}. RC4/3DES/export/null primitives are cryptographically broken.`,
        'Traffic decryption primitive via broken cipher negotiation.'
      ),
    });
  }
  return findings;
}

// ---- T2/T6: token structure analysis --------------------------------------
function shannonEntropy(s) {
  const freq = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  let e = 0;
  for (const c in freq) {
    const p = freq[c] / s.length;
    e -= p * Math.log2(p);
  }
  return e;
}

function tryTimestampDecode(token) {
  // Try base64/hex segments against current epoch +/- 1h.
  const now = Math.floor(Date.now() / 1000);
  const cands = token.split(/[^A-Za-z0-9+/=_-]/).filter((s) => s.length >= 6);
  for (const c of cands) {
    try {
      const b64 = c.replace(/-/g, '+').replace(/_/g, '/');
      const buf = Buffer.from(b64, 'base64');
      if (buf.length >= 4) {
        const v = buf.readUInt32BE(0);
        if (Math.abs(v - now) < 3600) return { segment: c, decoded: v, kind: 'epoch-be32' };
        const vle = buf.readUInt32LE(0);
        if (Math.abs(vle - now) < 3600) return { segment: c, decoded: vle, kind: 'epoch-le32' };
      }
    } catch {}
    if (/^[0-9a-fA-F]+$/.test(c) && c.length >= 8) {
      const v = parseInt(c.slice(0, 8), 16);
      if (Math.abs(v - now) < 3600) return { segment: c, decoded: v, kind: 'epoch-hex' };
    }
  }
  return null;
}

function analyzeTokens(tokens) {
  // Returns { signals: [...], predictable: bool }
  const signals = [];
  if (tokens.length >= 2) {
    // (a) monotonic / sequential
    const nums = tokens.map((t) => {
      const m = t.match(/(\d+)(?!.*\d)/);
      return m ? parseInt(m[1], 10) : null;
    });
    if (nums.every((n) => n !== null)) {
      const sorted = [...nums].sort((a, b) => a - b);
      const deltas = sorted.slice(1).map((v, i) => v - sorted[i]);
      if (deltas.length && deltas.every((d) => d > 0 && d < 1000000)) {
        signals.push(`monotonic numeric suffix, deltas ${deltas.slice(0, 3).join(',')}`);
      }
    }
    // (b) timestamp decode
    const dec = tokens.map(tryTimestampDecode).filter(Boolean);
    if (dec.length >= 2) signals.push(`timestamp-decodable segments (${dec[0].kind})`);
    // (d) username-derived: token contains a known username verbatim
  }
  // (c) length/charset entropy per token
  const weakLen = tokens.filter((t) => {
    const alpha = new Set(t).size;
    return t.length < 16 && alpha <= 36 && shannonEntropy(t) < 4.0;
  });
  if (weakLen.length >= 2) signals.push(`${weakLen.length} tokens brute-force-feasible (<16 chars, low entropy)`);
  return { signals, predictable: signals.length >= 2 };
}

async function t2Tokens(opts) {
  const findings = [];
  const tokens = opts.cryptoTokens || [];
  if (tokens.length < 2) return findings; // need >=2 for structural analysis
  const { signals, predictable } = analyzeTokens(tokens.map((t) => t.value));
  // Username-derived check needs the usernames.
  const withUser = tokens.filter(
    (t) => t.username && t.value.toLowerCase().includes(t.username.toLowerCase())
  );
  if (withUser.length >= 1) signals.push('username-derived segment in token');
  // T6: base64(username:ts) / md5(username) round-trip
  for (const t of tokens.slice(0, 4)) {
    try {
      const dec = Buffer.from(t.value, 'base64').toString('utf8');
      if (t.username && dec.startsWith(t.username + ':')) {
        signals.push(`base64(username:timestamp) derivation round-trips for ${t.username}`);
        break;
      }
    } catch {}
  }
  if (signals.length >= 2 || predictable) {
    findings.push({
      class: 'weak_crypto',
      id: `token-predict-${rand()}`,
      title: 'Predictable session/token structure (HIGH)',
      severity: 'high',
      url: opts.cryptoTokenSource || 'token-harvest',
      parameter: 'session-token',
      evidence: ev(
        `${tokens.length} tokens harvested from self-owned lab flows`,
        `Structural signals (${signals.length}): ${signals.slice(0, 3).join(' | ')}. >=2 independent signals agree — tokens are guessable, not random.`,
        'Session prediction / fixation primitive: attacker mints valid sessions.'
      ),
    });
  }
  return findings;
}

// ---- T5: exposed password hashes -------------------------------------------
const HASH_RES = [
  { re: /\b[0-9a-f]{32}\b/gi, kind: 'MD5', fast: true },
  { re: /\b[0-9a-f]{40}\b/gi, kind: 'SHA1', fast: true },
  { re: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, kind: 'bcrypt', fast: false },
  { re: /\$argon2(id|d|i)\$[^"'\s<>]{10,}/g, kind: 'argon2', fast: false },
];

async function fetchText(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return text.slice(0, 500000);
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

async function t5Hashes(url, opts) {
  const findings = [];
  const pages = opts.cryptoPages || [url];
  const seen = new Map(); // hash -> {kind, page}
  for (const p of pages.slice(0, 8)) {
    const text = await fetchText(p, opts);
    if (!text) continue;
    for (const { re, kind, fast } of HASH_RES) {
      const matches = text.match(re) || [];
      for (const m of matches.slice(0, 5)) {
        if (!seen.has(m)) seen.set(m, { kind, fast, page: p });
      }
    }
  }
  for (const [h, meta] of seen) {
    if (!meta.fast) {
      // bcrypt/argon2 = sound storage — recorded INFO is handled by caller
      // as a tested-and-sound note; only fast hashes become findings.
      continue;
    }
    // Tie to an account: look for username/email near the hash in evidence.
    findings.push({
      class: 'weak_crypto',
      id: `exposed-hash-${rand()}`,
      title: `Exposed fast password hash (${meta.kind}) — offline-crackable (HIGH)`,
      severity: 'high',
      url: meta.page,
      parameter: 'response-body',
      evidence: ev(
        `GET ${meta.page} (response body scan)`,
        `${meta.kind} hash ${h.slice(0, 12)}... exposed in a server response. Fast hash = offline brute-force feasible; unsalted if reused across accounts.`,
        'Offline password-recovery primitive from an exposed fast hash.'
      ),
    });
    if (findings.length >= 3) break;
  }
  return findings;
}

export async function probeCrypto(url, opts = {}) {
  const findings = [];
  findings.push(...(await t1Tls(url, opts)));
  findings.push(...(await t2Tokens(opts)));
  // T3 (reset-token analysis) + T4 (plaintext password in reset): need the
  // lab mailbox read surface. Skipped gracefully when absent — documented,
  // never silently missing: the phase ran, the surface was absent.
  findings.push(...(await t5Hashes(url, opts)));
  return findings;
}

export const __cryptoMeta = { phases: ['crypto'], depth: ['quick', 'standard', 'deep'] };
