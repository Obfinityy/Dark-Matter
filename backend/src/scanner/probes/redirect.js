// Dark Matter rule-based scanner — open redirect probe.
// Oracle: 3xx response whose Location points at our evil host.
// redirect:'manual' so we observe the Location header instead of following it.
//
// Variant legs (coverage rows #401/#403/#470, batch 7):
// the plain value alone misses servers that block `https://evil.example/`
// but fall to a bypass spelling. Each variant is tried ONLY when the plain
// value did not fire for that parameter, in group order below; the first
// firing variant records one finding naming the variant and its row.
// Request budget: at most 10 params x (1 base + 9 variants) = 100 requests,
// and a param stops at its first firing value.
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function getManual(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual',
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    await res.text().catch(() => '');
    return { status: res.status, location: res.headers.get('location') };
  } finally {
    clearTimeout(t);
  }
}

// The plain value (coverage rows #94/#402). Unchanged behaviour.
const BASE_EVIL = 'https://evil.example/';

// Bypass spellings, grouped by coverage row. The oracle is the same for
// every value: a 3xx whose Location contains the evil host.
const VARIANT_GROUPS = [
  {
    // #401 — protocol-relative / backslash. A server that validates the
    // value as a relative path (or strips the scheme) may still redirect
    // to the attacker host.
    row: 401,
    name: 'protocol-relative',
    values: ['//evil.example', '/\\evil.example', 'https://evil.example\\'],
  },
  {
    // #403 — userinfo (@) trick. A validator that checks the string
    // before the '@' (or decodes %40 after validating) sees a trusted
    // host; the redirect lands on the host after the '@'.
    row: 403,
    name: 'userinfo',
    values: ['https://trusted.com@evil.example', 'https://evil.example%40trusted.com'],
  },
  {
    // #470 — Unicode / IDN tricks. A validator comparing raw strings
    // misses what a URL parser normalises to the attacker host:
    // U+3002 ideographic full stop and full-width latin both normalise
    // to `evil.example` (WHATWG URL); the punycode label is the
    // Cyrillic-е homograph `еvil` (domainToASCII: xn--vil-qdd);
    // %C0%AF is overlong UTF-8 for `/`, which lenient decoders accept.
    row: 470,
    name: 'unicode-idn',
    values: [
      'https://evil。example/',
      'https://ｅｖｉｌ.example/',
      'https://xn--vil-qdd.example/',
      'https:%C0%AF%2Fevil.example',
    ],
  },
];

function isRedirectToEvil(r) {
  return r.status >= 300 && r.status < 400 && r.location && r.location.includes('evil.example');
}

export async function probeOpenRedirect(url, params, opts = {}) {
  const findings = [];
  noteAttemptedPoints(opts, params.slice(0, 10));
  for (const param of params.slice(0, 10)) {
    // Try the plain value first, then each variant group in order;
    // stop at the first value that fires for this parameter.
    const attempts = [{ value: BASE_EVIL, group: null }];
    for (const group of VARIANT_GROUPS) {
      for (const value of group.values) attempts.push({ value, group });
    }
    for (const attempt of attempts) {
      let r;
      try {
        r = await getManual(mutateUrl(url, param, attempt.value), opts);
      } catch {
        continue;
      }
      if (!isRedirectToEvil(r)) continue;
      const evidence = {
        request: `GET ${mutateUrl(url, param, attempt.value)}`,
        response: `HTTP ${r.status} with Location: ${r.location}`,
        impact_demo: 'attacker-controlled external redirect (phishing)',
        signalCorrelated: true,
      };
      if (attempt.group) {
        evidence.variant = attempt.value;
        evidence.coverageRow = attempt.group.row;
        findings.push({
          class: 'open_redirect',
          id: `open-redirect-${attempt.group.name}-${probePointName(param)}`,
          title: `Open redirect via ${attempt.group.name} variant in parameter '${probePointParameter(param)}'`,
          severity: 'medium',
          url,
          param: probePointParameter(param),
          evidence,
        });
      } else {
        findings.push({
          class: 'open_redirect',
          id: `open-redirect-${probePointName(param)}`,
          title: `Open redirect in parameter '${probePointParameter(param)}'`,
          severity: 'medium',
          url,
          param: probePointParameter(param),
          evidence,
        });
      }
      break;
    }
  }
  return findings;
}
