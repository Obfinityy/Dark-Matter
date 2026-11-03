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
import net from 'node:net';

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

export async function probeRequestSmuggling(url, opts = {}) {
  const findings = [];
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

  // Proven desync: the pipelined GET's response differs from baseline —
  // extra/missing responses, or a 400 where the baseline was clean.
  const baselineSecondOk = countResponses(baseline.data) >= 2;
  if ((ambResponses !== baselineResponses || ambHas400) && !amb.timedOut) {
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
