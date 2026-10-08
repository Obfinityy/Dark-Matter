/**
 * pocGenerator.js — Automatic proof-of-concept generator.
 *
 * For each confirmed finding, generates:
 *  - A curl command reproducing the vulnerability
 *  - A Python requests script
 *  - Step-by-step manual reproduction steps
 *  - Expected vs actual behavior
 *
 * PoCs are SAFE by design: read-only probes, no data destruction,
 * no authentication bypass attempts beyond the finding itself.
 */

function curlFor({ url, method = 'GET', headers = {}, body = null }) {
  const parts = ['curl', '-i', '-s', '-X', method.toUpperCase()];
  for (const [k, v] of Object.entries(headers)) {
    parts.push('-H', `'${k}: ${v}'`);
  }
  if (body) parts.push('--data-raw', `'${String(body).slice(0, 500)}'`);
  parts.push(`'${url}'`);
  return parts.join(' ');
}

function pythonFor({ url, method = 'GET', headers = {}, body = null }) {
  return `import requests

url = "${url}"
headers = ${JSON.stringify(headers, null, 2) || '{}'}

${body ? `data = """${String(body).slice(0, 500)}"""\nresp = requests.${method.toLowerCase()}(url, headers=headers, data=data)` : `resp = requests.${method.toLowerCase()}(url, headers=headers)`}

print("Status:", resp.status_code)
print("Evidence in response:", "vulnerable-marker" in resp.text)
# Check resp.text for the evidence string from the finding
`;
}

/**
 * Generate a PoC bundle for a finding.
 * @param {object} finding { type, url, evidence, confidence, cwe, params? }
 */
export function generatePoC(finding = {}) {
  if (!finding || typeof finding !== 'object') finding = {};
  const { type = 'Unknown', url = '', evidence = '', cwe = '' } = finding;
  // Normalize: real hunt findings carry category-style values ("sql-injection")
  // or free-text titles — match case-insensitively on the normalized form.
  const t = String(type).toLowerCase().replace(/[-_]/g, ' ');
  const steps = [];
  let curl = '';
  let python = '';

  if (t.includes('sql injection') || t.includes('sqli')) {
    const payload = "' OR '1'='1";
    const testUrl = url.includes('?')
      ? `${url}${encodeURIComponent(payload)}`
      : `${url}?id=${encodeURIComponent(payload)}`;
    curl = curlFor({ url: testUrl });
    python = pythonFor({ url: testUrl });
    steps.push(
      '1. Send the request below with a single-quote payload.',
      '2. Observe the SQL error message in the response.',
      '3. Compare with a benign request — the error only appears with the payload.',
      'Expected: input is sanitized, no SQL error. Actual: raw SQL error leaks.'
    );
  } else if (t.includes('xss')) {
    const payload = '<script>alert(document.domain)</script>';
    curl = curlFor({ url, body: payload });
    python = pythonFor({ url, body: payload });
    steps.push(
      '1. Submit the XSS canary below.',
      '2. Observe the response — the payload is reflected unescaped.',
      '3. In a real browser this would execute JavaScript.',
      'Expected: output-encoded reflection. Actual: raw HTML/JS reflected.'
    );
  } else if (t.includes('ssrf')) {
    steps.push(
      '1. Replace the URL parameter with http://169.254.169.254/latest/meta-data/ (or a Burp Collaborator URL).',
      '2. If the server fetches it, the response will contain cloud metadata.',
      '3. Use a collaborator URL for a safe, external proof.',
      'Expected: URL is validated against an allowlist. Actual: arbitrary URLs are fetched.'
    );
    curl = curlFor({
      url: url.replace(/(url|uri|link)=[^&]*/i, '$1=http://YOUR-COLLABORATOR-URL'),
    });
    python = pythonFor({ url });
  } else if (t.includes('idor')) {
    steps.push(
      '1. Authenticate as User A and note your object ID.',
      "2. Change the ID parameter to User B's object ID.",
      "3. If User B's data is returned, IDOR is confirmed.",
      "Expected: 403 Forbidden. Actual: 200 with another user's data."
    );
    curl = curlFor({ url });
    python = pythonFor({ url });
  } else {
    curl = curlFor({ url });
    python = pythonFor({ url });
    steps.push(
      '1. Reproduce with the request below.',
      `2. Evidence: ${String(evidence).slice(0, 200)}`,
      '3. Document expected vs actual behavior.'
    );
  }

  return {
    findingType: type,
    cwe,
    curl,
    python,
    steps,
    severity_hint: 'Validate impact manually before reporting. This PoC is read-only.',
  };
}

export const POC_GENERATOR = { generatePoC, curlFor, pythonFor };
export default POC_GENERATOR;
