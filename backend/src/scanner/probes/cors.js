// Dark Matter rule-based scanner — CORS misconfiguration probe.
// Oracle: send an arbitrary Origin; if the server reflects it in
// Access-Control-Allow-Origin, any site can read cross-origin responses.
// With Access-Control-Allow-Credentials: true, it's session hijack.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

export async function probeCors(url, opts = {}) {
  const findings = [];
  const evilOrigin = 'https://evil-dm-probe.example';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  let headers;
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Origin: evilOrigin, ...(opts.headers || {}) },
    });
    headers = res.headers;
    await res.text().catch(() => '');
  } catch {
    return findings;
  } finally {
    clearTimeout(t);
  }
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
        response: 'Access-Control-Allow-Origin: * + Access-Control-Allow-Credentials: true',
        impact_demo: 'misconfigured CORS policy (browsers block this combo, but it signals a broken policy)',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
