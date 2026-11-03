// Dark Matter rule-based scanner — security-header probe.
// Pure Node, no docker needed. Informational/low severity by design:
// a missing header alone is not a vulnerability, it is hardening signal.
const HEADER_CHECKS = [
  { id: 'missing-hsts', header: 'strict-transport-security', severity: 'low', title: 'Missing Strict-Transport-Security header' },
  { id: 'missing-csp', header: 'content-security-policy', severity: 'low', title: 'Missing Content-Security-Policy header' },
  { id: 'missing-xfo', header: 'x-frame-options', severity: 'low', title: 'Missing X-Frame-Options header (clickjacking)' },
  { id: 'missing-xcto', header: 'x-content-type-options', severity: 'info', title: 'Missing X-Content-Type-Options header' },
  { id: 'missing-rp', header: 'referrer-policy', severity: 'info', title: 'Missing Referrer-Policy header' },
];

export function probeHeaders({ url, headers = {} }) {
  const findings = [];
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[String(k).toLowerCase()] = v;

  for (const c of HEADER_CHECKS) {
    if (!h[c.header]) {
      findings.push({
        class: 'headers',
        id: c.id,
        title: c.title,
        severity: c.severity,
        url,
        // differential oracle: header absent on the live response (deterministic)
        evidence: {
          request: `GET ${url}`,
          response: `HTTP response is missing the ${c.header} header`,
          signalCorrelated: true,
        },
      });
    }
  }

  // CORS misconfiguration: wildcard origin + credentials = real finding.
  const acao = h['access-control-allow-origin'];
  const acac = String(h['access-control-allow-credentials'] || '').toLowerCase();
  if (acao === '*' && acac === 'true') {
    findings.push({
      class: 'cors',
      id: 'cors-wildcard-credentials',
      title: 'CORS wildcard origin with credentials allowed',
      severity: 'medium',
      url,
      evidence: {
        request: `GET ${url}`,
        response:
          'Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
