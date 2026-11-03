// Dark Matter rule-based scanner — CSRF probe.
// Static oracle: a state-changing (POST) form with no anti-CSRF token field.
// Pure function of the crawled forms — no network.
const TOKEN_NAME_RE = /csrf|xsrf|_token|authenticity|nonce/i;

export function probeCsrf(forms, url) {
  const findings = [];
  for (const form of forms || []) {
    if (String(form.method || 'get').toLowerCase() !== 'post') continue;
    const hasToken = (form.inputs || []).some((n) => TOKEN_NAME_RE.test(n));
    if (hasToken) continue;
    const path = (() => {
      try {
        return new URL(form.action).pathname.replace(/\//g, '_') || 'root';
      } catch {
        return 'root';
      }
    })();
    findings.push({
      class: 'csrf',
      id: `csrf-missing-token${path}`,
      title: `State-changing form without anti-CSRF token: ${form.action}`,
      severity: 'medium',
      url: form.action,
      evidence: {
        request: `POST ${form.action} (inputs: ${(form.inputs || []).join(', ') || 'none'})`,
        response: 'no anti-CSRF token field in the form',
        impact_demo: 'missing csrf/xsrf/_token/authenticity/nonce field',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
