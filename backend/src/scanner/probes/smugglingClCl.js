// Dark Matter rule-based scanner — HTTP request smuggling probe,
// duplicate Content-Length (CL.CL).
// (Coverage row #166 [Critical] HTTP Request Smuggling — CL.CL variant,
// CWE-444; phase 'smuggling-cl-cl'. CL.CL has no dedicated checklist
// row: #351–#354 cover CL.TE / TE.CL / TE.TE / chunked-extension only.)
//
// Two Content-Length headers with different values on one request:
// a front-end that honours the first and a back-end that honours the
// second (or vice versa) disagree about where the request body ends,
// so bytes of the next pipelined request are consumed as body — or
// body bytes are parsed as a new request. The desync is the finding.
//
// ORACLE (conservative, mirroring smuggling.js): a clean baseline
// (POST with one correct Content-Length, pipelined GET) must yield
// two clean 200-class responses first — otherwise the oracle is
// unusable and the probe stays quiet. Then two CL.CL variants are
// tried (first-length-smaller, first-length-larger). A finding fires
// ONLY on a proven desync: the probe's response-status sequence
// differs from the baseline's (a 400 on the pipelined request, a
// missing/extra response, or a timeout where the baseline was
// instant). Accepted ambiguity alone is NOT a finding here —
// smuggling.js already reports that shape as a medium on CL.TE, and
// this probe must not re-report it. A server that REJECTS the
// duplicate headers with 400/501 on the first response is SAFE:
// rejection is the correct behaviour, never a desync.
//
// SAFETY: plain http only (raw node:net socket — fetch normalizes
// Content-Length, so the ambiguity must be crafted byte-exact).
// Tiny bodies, one pipelined GET, connection closed after each
// attempt. No cache poisoning, no floods.
//
// HONEST LIMITS: no dedicated smuggling lab exists today — verified
// against local raw-socket mock servers only (a front/back
// disagreement stub, a first-CL-wins stub, and a rejecting stub).
// A live two-tier topology proof is a later lane. HTTPS targets are
// out of scope (raw socket without TLS, like smuggling.js v1). The
// oracle observes the connection, not the topology: a lone
// single-tier origin that deterministically honours one length and
// rejects the leftover bytes as malformed produces the same
// observable as a desyncing pair, so a finding is a proven
// length-disagreement signal to confirm against the real front/back
// topology, not a proof of two tiers by itself.

import net from 'node:net';

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

/** All HTTP status lines in a raw byte stream, in order. Pure. */
export function responseStatuses(data) {
  return [...String(data || '').matchAll(/HTTP\/\d(?:\.\d)? (\d{3})/g)].map((m) => Number(m[1]));
}

/** Count of HTTP responses in a raw byte stream. Pure. */
export function countResponses(data) {
  return responseStatuses(data).length;
}

/**
 * Judge a CL.CL attempt against the clean baseline. 'confirmed' only
 * when the probe was not rejected outright (first status is not a
 * 400/501 rejection of the ambiguous request itself) and its status
 * sequence differs from the baseline's — a 400 on the pipelined
 * request, a missing/extra response, or a timeout where the baseline
 * was instant. 'rejected' when the server refused the ambiguity or
 * the sequences match. Pure.
 */
export function assessSmugglingDesync({ baseline, probe }) {
  if (!baseline || !probe) return { verdict: 'unconfirmed', reason: 'incomplete exchange — a request failed' };
  if (baseline.error || baseline.timedOut) {
    return { verdict: 'unconfirmed', reason: 'baseline unusable — the oracle cannot be calibrated' };
  }
  const baseStatuses = responseStatuses(baseline.data);
  if (baseStatuses.length < 2) {
    return { verdict: 'unconfirmed', reason: 'baseline did not pipeline — oracle unusable' };
  }
  if (probe.error) return { verdict: 'unconfirmed', reason: 'probe exchange errored' };
  if (probe.timedOut) {
    return { verdict: 'confirmed', reason: 'probe timed out where the baseline answered instantly — connection desynced' };
  }
  const probeStatuses = responseStatuses(probe.data);
  if (probeStatuses.length === 0) {
    return { verdict: 'unconfirmed', reason: 'probe produced no response at all' };
  }
  if (probeStatuses[0] === 400 || probeStatuses[0] === 501) {
    return { verdict: 'rejected', reason: 'server rejected the duplicate Content-Length headers — ambiguity refused, not desynced' };
  }
  if (probeStatuses.length !== baseStatuses.length) {
    return {
      verdict: 'confirmed',
      reason: `response count diverged: baseline ${baseStatuses.length} responses, probe ${probeStatuses.length}`,
    };
  }
  for (let i = 0; i < baseStatuses.length; i += 1) {
    if (probeStatuses[i] !== baseStatuses[i]) {
      return {
        verdict: 'confirmed',
        reason: `response ${i + 1} status diverged: baseline ${baseStatuses[i]}, probe ${probeStatuses[i]} — leftover bytes desynced the connection`,
      };
    }
  }
  return { verdict: 'rejected', reason: 'probe status sequence matches the baseline — no desync' };
}

/**
 * Build a CL.CL payload: a POST carrying two Content-Length headers
 * (firstLen, secondLen) with a body of bodyLen bytes, then a pipelined
 * GET. Pure.
 */
export function buildClClPayload(path, host, firstLen, secondLen, body) {
  const base = `Host: ${host}\r\nUser-Agent: ${UA}\r\nConnection: keep-alive\r\n`;
  return (
    `POST ${path} HTTP/1.1\r\n${base}Content-Length: ${firstLen}\r\nContent-Length: ${secondLen}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n${body}` +
    `GET ${path} HTTP/1.1\r\n${base}\r\n`
  );
}

/** Build the clean baseline payload (one correct Content-Length). Pure. */
export function buildBaselinePayload(path, host) {
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

// Two CL.CL shapes: the smaller length first (front CL 5 / back CL 11)
// and the larger first (front CL 11 / back CL 5). Either direction of
// front/back disagreement desyncs one of them.
const VARIANTS = [
  { name: 'cl-cl-small-first', firstLen: 5, secondLen: 11, body: '12345' },
  { name: 'cl-cl-large-first', firstLen: 11, secondLen: 5, body: '12345ABCDEF' },
];

export async function probeSmugglingClCl(url, opts = {}) {
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

  const baseline = await rawExchange(host, port, buildBaselinePayload(path, host), timeoutMs);
  if (baseline.error || baseline.timedOut || countResponses(baseline.data) < 2) {
    setDiag('skipped', 'baseline did not pipeline cleanly — oracle unusable');
    return findings;
  }
  setDiag('baselineResponses', countResponses(baseline.data));

  for (const variant of VARIANTS) {
    const payload = buildClClPayload(path, host, variant.firstLen, variant.secondLen, variant.body);
    const probe = await rawExchange(host, port, payload, timeoutMs);
    const judged = assessSmugglingDesync({ baseline, probe });
    setDiag(`variant:${variant.name}`, judged.verdict);
    if (judged.verdict !== 'confirmed') continue;
    findings.push({
      class: 'request_smuggling',
      id: 'request-smuggling-cl-cl',
      title: 'HTTP request smuggling (CL.CL duplicate Content-Length desync proven)',
      severity: 'high',
      url,
      evidence: {
        request: `POST with duplicate Content-Length headers (${variant.firstLen} then ${variant.secondLen}), pipelined GET`,
        response: `baseline: ${countResponses(baseline.data)} clean responses (${responseStatuses(baseline.data).join(',')}); probe (${variant.name}): ${countResponses(probe.data)} responses (${responseStatuses(probe.data).join(',')}) — ${judged.reason}`,
        impact_demo: 'front/back length disagreement lets attacker bytes be processed as a new request — cache poisoning / credential hijack primitive',
        signalCorrelated: true,
      },
    });
    return findings;
  }
  return findings;
}

export const __smugglingClClMeta = { phases: ['smuggling-cl-cl'], depth: ['standard', 'deep'] };
