// Dark Matter rule-based scanner — HTTP request smuggling probe,
// 0.CL / CL.0 (Content-Length: 0 alongside a body).
// (Coverage row #166 [Critical] HTTP Request Smuggling — 0.CL / CL.0
// variant, CWE-444; phase 'smuggling-zero-cl'. 0.CL / CL.0 has no
// dedicated checklist row: #351–#354 cover CL.TE / TE.CL / TE.TE /
// chunked-extension only.)
//
// One Content-Length header says 0 while a second says N (and the
// reverse): a front-end that honours the 0 treats the body bytes as
// the start of the next request, while a back-end that honours N
// waits for a body — or vice versa. The body bytes (or the pipelined
// GET behind them) are then parsed as a request line, desyncing the
// connection. The desync is the finding.
//
// ORACLE (conservative, mirroring smuggling.js and smugglingClCl.js):
// a clean baseline (POST with one correct Content-Length, pipelined
// GET) must yield two clean 200-class responses first — otherwise
// the oracle is unusable and the probe stays quiet. Then two
// variants are tried: 0.CL (Content-Length: 0 first, then N) and
// CL.0 (N first, then 0). A finding fires ONLY on a proven desync,
// judged by the shared assessSmugglingDesync oracle (status sequence
// diverges from the baseline — a 400 on the pipelined request, a
// missing/extra response, or a timeout where the baseline was
// instant). Accepted ambiguity alone is NOT a finding. A server that
// REJECTS the conflicting headers with 400/501 on the first response
// is SAFE: rejection is the correct behaviour, never a desync.
//
// SAFETY: plain http only (raw node:net socket — fetch normalizes
// Content-Length, so the ambiguity must be crafted byte-exact).
// Tiny bodies, one pipelined GET, connection closed after each
// attempt. No cache poisoning, no floods.
//
// HONEST LIMITS: no dedicated smuggling lab exists today — verified
// against local raw-socket mock servers only (a zero-length
// disagreement stub, a deterministic-resolution stub, and a rejecting stub).
// A live two-tier topology proof is a later lane. HTTPS targets are
// out of scope (raw socket without TLS, like smuggling.js v1). The
// oracle observes the connection, not the topology: a lone
// single-tier origin that deterministically honours the 0 and
// rejects the leftover bytes as malformed produces the same
// observable as a desyncing pair, so a finding is a proven
// length-disagreement signal to confirm against the real front/back
// topology, not a proof of two tiers by itself.

import net from 'node:net';
import { assessSmugglingDesync, responseStatuses, countResponses } from './smugglingClCl.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 12000;

function targetParts(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80,
    tls: u.protocol === 'https:',
    path: u.pathname + u.search || '/',
  };
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Build a 0.CL / CL.0 payload: a POST carrying Content-Length: 0 and
 * Content-Length: N (in the order named by `variant`), with an
 * N-byte body, then a pipelined GET. Pure.
 */
export function buildZeroClPayload(path, host, variant, body) {
  const base = `Host: ${host}\r\nUser-Agent: ${UA}\r\nConnection: keep-alive\r\n`;
  const headers =
    variant === 'zero-cl'
      ? `Content-Length: 0\r\nContent-Length: ${body.length}\r\n`
      : `Content-Length: ${body.length}\r\nContent-Length: 0\r\n`;
  return (
    `POST ${path} HTTP/1.1\r\n${base}${headers}Content-Type: application/x-www-form-urlencoded\r\n\r\n${body}` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`
  );
}

/** Build the clean baseline payload (one correct Content-Length). Pure. */
export function buildZeroClBaselinePayload(path, host) {
  const base = `Host: ${host}\r\nUser-Agent: ${UA}\r\nConnection: keep-alive\r\n`;
  const body = 'a=1';
  return (
    `POST ${path} HTTP/1.1\r\n${base}Content-Length: ${body.length}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n${body}` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`
  );
}

// ---- raw socket exchange ------------------------------------------------------

function rawExchange(host, port, payload, timeoutMs = TIMEOUT_MS) {
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
    }, Math.min(timeoutMs - 1000, 1000));
  });
}

// ---- the probe ---------------------------------------------------------------

// Both orders of the disagreement: the tier that honours the 0 treats
// the body as the next request; the tier that honours N waits for it.
const VARIANTS = [
  { name: 'zero-cl', body: '1234567' },
  { name: 'cl-zero', body: '1234567' },
];

export async function probeSmugglingZeroCl(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const { host, port, tls, path } = targetParts(url);
  if (tls) {
    setDiag('skipped', 'https unsupported (raw socket, no TLS)');
    return findings;
  }
  const timeoutMs = opts.timeoutMs || TIMEOUT_MS;

  const baseline = await rawExchange(host, port, buildZeroClBaselinePayload(path, host), timeoutMs);
  if (baseline.error || baseline.timedOut || countResponses(baseline.data) < 2) {
    setDiag('skipped', 'baseline did not pipeline cleanly — oracle unusable');
    return findings;
  }
  setDiag('baselineResponses', countResponses(baseline.data));

  for (const variant of VARIANTS) {
    const payload = buildZeroClPayload(path, host, variant.name, variant.body);
    const probe = await rawExchange(host, port, payload, timeoutMs);
    const judged = assessSmugglingDesync({ baseline, probe });
    setDiag(`variant:${variant.name}`, judged.verdict);
    if (judged.verdict !== 'confirmed') continue;
    findings.push({
      class: 'request_smuggling',
      id: 'request-smuggling-zero-cl',
      title: `HTTP request smuggling (${variant.name === 'zero-cl' ? '0.CL' : 'CL.0'} Content-Length: 0 desync proven)`,
      severity: 'high',
      url,
      evidence: {
        request: `POST with conflicting Content-Length headers (${variant.name === 'zero-cl' ? '0 then 7' : '7 then 0'}) plus a body, pipelined GET`,
        response: `baseline: ${countResponses(baseline.data)} clean responses (${responseStatuses(baseline.data).join(',')}); probe (${variant.name}): ${countResponses(probe.data)} responses (${responseStatuses(probe.data).join(',')}) — ${judged.reason}`,
        impact_demo: 'front/back disagreement over a zero body length lets attacker bytes be processed as a new request — cache poisoning / credential hijack primitive',
        signalCorrelated: true,
      },
    });
    return findings;
  }
  return findings;
}

export const __smugglingZeroClMeta = { phases: ['smuggling-zero-cl'], depth: ['standard', 'deep'] };
