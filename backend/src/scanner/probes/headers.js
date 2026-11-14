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
          `Access-Control-Allow-Origin: ${acao} with Access-Control-Allow-Credentials: ${h['access-control-allow-credentials']}`,
        signalCorrelated: true,
      },
    });
  }

  // CSP directive analysis (iter2): a present-but-weak CSP is a CSP-bypass
  // class finding. Static parse — no browser needed.
  const cspRaw = h['content-security-policy'];
  if (cspRaw) {
    const dirs = {};
    for (const part of String(cspRaw).split(';')) {
      const [name, ...rest] = part.trim().split(/\s+/);
      if (name) dirs[name.toLowerCase()] = rest.join(' ');
    }
    const scriptSrc = dirs['script-src'] || dirs['default-src'] || '';
    const cspFinding = (id, title, severity, detail) => ({
      class: 'csp_weak',
      id,
      title,
      severity,
      url,
      evidence: {
        request: `GET ${url}`,
        response: `Content-Security-Policy: ${cspRaw}`,
        impact_demo: detail,
        signalCorrelated: true,
      },
    });
    // CSP keywords are single-quoted tokens ('unsafe-eval', 'wasm-unsafe-eval',
    // 'strict-dynamic', ...). Match whole tokens only — a substring regex
    // fires on 'wasm-unsafe-eval' (Wasm only, NOT eval): that was the
    // h_e2d40734ddcb false positive on muse.ai (12 Nov 2026).
    const scriptTokens = scriptSrc.split(/\s+/).filter(Boolean);
    if (scriptTokens.includes("'unsafe-inline'")) {
      findings.push(
        cspFinding(
          'csp-unsafe-inline',
          'CSP allows unsafe-inline in script-src',
          'medium',
          'inline scripts allowed — reflected XSS is not neutralized by the CSP'
        )
      );
    }
    if (scriptTokens.includes("'unsafe-eval'")) {
      findings.push(
        cspFinding(
          'csp-unsafe-eval',
          'CSP allows unsafe-eval in script-src',
          'medium',
          'eval() allowed — widens every script-injection sink'
        )
      );
    }
    if (/(^|\s)\*(\s|;|$)/.test(` ${scriptSrc} `)) {
      findings.push(
        cspFinding(
          'csp-wildcard-script',
          'CSP script-src allows wildcard sources',
          'medium',
          'scripts may load from any host — CSP bypassable via an attacker domain'
        )
      );
    }
    // object-src falls back to default-src per the CSP spec — only flag when
    // neither restricts plugins/objects.
    if (!dirs['object-src'] && !dirs['default-src']) {
      findings.push(
        cspFinding(
          'csp-missing-object-src',
          'CSP missing object-src directive',
          'low',
          'plugins/objects unrestricted — Flash/Java-era vector class stays open'
        )
      );
    }
    // frame-ancestors has no default-src fallback, but X-Frame-Options
    // covers the same clickjacking ground — only flag when both are absent.
    if (!dirs['frame-ancestors'] && !h['x-frame-options']) {
      findings.push(
        cspFinding(
          'csp-missing-frame-ancestors',
          'CSP missing frame-ancestors directive',
          'low',
          'no CSP-level clickjacking defense (X-Frame-Options may still cover it)'
        )
      );
    }
  }
  return findings;
}
