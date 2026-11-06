// Dark Matter rule-based scanner — Server-Side Includes (SSI) injection.
//
// Pages processed by the web server for SSI directives execute
// `<!--#echo ... -->`, `<!--#include ... -->`, `<!--#exec ... -->`.
// If user input lands in such a page unescaped, the directives run.
//
// Oracle: inject `<!--#echo var="DATE_LOCAL" -->` — a date string appears
// where the benign input was echoed back inertly. Differential: the
// directive must NOT execute for the benign value, and a date-like token
// must appear for the malicious one.
// class 'ssi_injection' → default protocol → signalCorrelated=true.
// Severity: high (directive execution; #exec = RCE on misconfigured hosts).
import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

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


// A rendered date looks like "Tuesday, 03-Nov-2026 21:24:01 IST" or
// "11/03/2026" — the directive output, not our input.
const DATE_LIKE = /\b(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s+\d{1,2}[\s-](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[\s-]\d{2,4}|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i;

export async function probeSsiInjection(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    const rand = randomBytes(4).toString('hex');
    const benignVal = `dmssi${rand}`;
    const payload = `<!--#echo var="DATE_LOCAL" -->`;
    let benign, malicious;
    try {
      benign = await get(mutateUrl(url, param, benignVal), opts);
      malicious = await get(mutateUrl(url, param, payload), opts);
    } catch {
      continue;
    }
    const benignDate = DATE_LIKE.test(benign.text);
    const malDate = DATE_LIKE.test(malicious.text);
    // The raw directive must not just echo back unprocessed.
    const directiveEchoed = malicious.text.includes('#echo');
    if (malDate && !benignDate && !directiveEchoed) {
      const m = malicious.text.match(DATE_LIKE);
      const idx = malicious.text.indexOf(m[0]);
      const window = malicious.text.slice(Math.max(0, idx - 60), idx + 120);
      findings.push({
        class: 'ssi_injection',
        id: `ssi-${probePointName(param)}`,
        title: `Server-Side Includes injection in parameter '${probePointParameter(param)}'`,
        severity: 'high',
        url,
        param: probePointParameter(param),
        parameter: probePointParameter(param),
        evidence: {
          request: `GET ${mutateUrl(url, param, payload)}`,
          response: `SSI #echo directive executed — server rendered the date — "...${window}..." — benign input rendered inertly`,
          impact_demo: 'server-side directive executed from user input; #exec variant is remote code execution',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
