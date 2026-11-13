// Dark Matter rule-based scanner — CORS misconfiguration probe.
// Oracle: send an arbitrary Origin; if the server reflects it in
// Access-Control-Allow-Origin, any site can read cross-origin responses.
// With Access-Control-Allow-Credentials: true, it's session hijack.
// Legs (each evaluated on its own response, never on reflection alone):
//   (1) reflected evil origin, #394 — unchanged;
//   (2) null Origin reflected with credentials, #395 — a literal
//       `Access-Control-Allow-Origin: null` + credentials lets any
//       sandboxed/redirected page read credentialed responses;
//   (3) bare wildcard without credentials, #396 — `*` with no
//       credentials allowed is a weaker, separate misconfiguration
//       (own class/id, never the #394 class).
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function fetchHeaders(url, origin, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Origin: origin, ...(opts.headers || {}) },
    });
    await res.text().catch(() => '');
    return res.headers;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function probeCors(url, opts = {}) {
  const findings = [];
  const evilOrigin = 'https://evil-dm-probe.example';

  // Legs 1 + 3 share the evil-origin response — the wildcard is a
  // property of the policy, not of the Origin sent, so it is judged
  // once here and never re-judged on the null-origin response.
  const headers = await fetchHeaders(url, evilOrigin, opts);
  if (headers) {
    const acao = headers.get('access-control-allow-origin') || '';
    const acac = (headers.get('access-control-allow-credentials') || '').toLowerCase();

    // Wildcard with credentials is contradictory but still informative; the
    // critical case is reflection of the attacker's origin.
    if (acao.trim() === evilOrigin) {
      const withCreds = acac === 'true';
      findings.push({
        class: 'cors_misconfig',
        id: 'cors-reflect-origin',
        title: withCreds
          ? 'CORS misconfiguration: arbitrary origin reflected WITH credentials (session hijack)'
          : 'CORS misconfiguration: arbitrary origin reflected (cross-origin data theft)',
        severity: withCreds ? 'high' : 'medium',
        url,
        evidence: {
          request: `GET ${url} with Origin: ${evilOrigin}`,
          response: `Access-Control-Allow-Origin: ${acao}` +
            (withCreds ? ' + Access-Control-Allow-Credentials: true' : ''),
          impact_demo: withCreds
            ? 'any malicious site can make credentialed cross-origin requests and read the responses'
            : 'any malicious site can read cross-origin responses from this endpoint',
          signalCorrelated: true,
        },
      });
    } else if (acao.trim() === '*' && acac === 'true') {
      findings.push({
        class: 'cors_misconfig',
        id: 'cors-wildcard-creds',
        title: 'CORS misconfiguration: wildcard origin with credentials allowed',
        severity: 'medium',
        url,
        evidence: {
          request: `GET ${url} with Origin: ${evilOrigin}`,
          response: `Access-Control-Allow-Origin: ${acao.trim()} + Access-Control-Allow-Credentials: ${acac}`,
          impact_demo: 'misconfigured CORS policy (browsers block this combo, but it signals a broken policy)',
          signalCorrelated: true,
        },
      });
    } else if (acao.trim() === '*' && acac !== 'true') {
      findings.push({
        class: 'cors_wildcard',
        id: 'cors-wildcard-no-creds',
        title: 'CORS misconfiguration: wildcard origin without credentials',
        severity: 'medium',
        url,
        evidence: {
          request: `GET ${url} with Origin: ${evilOrigin}`,
          response: `Access-Control-Allow-Origin: ${acao.trim()}` +
            (acac ? ` + Access-Control-Allow-Credentials: ${acac}` : ' (no Access-Control-Allow-Credentials header)'),
          impact_demo: 'any site can read cross-origin responses from this endpoint without credentials',
          signalCorrelated: true,
        },
      });
    }
  }

  // Leg 2 — null Origin. Evaluated ONLY on the null-origin response:
  // a literal `null` on any other request is not this leg's oracle.
  const nullHeaders = await fetchHeaders(url, 'null', opts);
  if (nullHeaders) {
    const acao = nullHeaders.get('access-control-allow-origin') || '';
    const acac = (nullHeaders.get('access-control-allow-credentials') || '').toLowerCase();
    if (acao.trim() === 'null' && acac === 'true') {
      findings.push({
        class: 'cors_misconfig',
        id: 'cors-null-origin',
        title: 'CORS misconfiguration: null origin allowed with credentials (session hijack)',
        severity: 'high',
        url,
        evidence: {
          request: `GET ${url} with Origin: null`,
          response: 'Access-Control-Allow-Origin: null + Access-Control-Allow-Credentials: true',
          impact_demo: 'a sandboxed or redirected page (Origin: null) can make credentialed cross-origin requests and read the responses',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
