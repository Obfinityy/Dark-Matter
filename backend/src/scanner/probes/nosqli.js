// Dark Matter rule-based scanner — NoSQL injection probe.
//
// Targets MongoDB-style operator injection in URL params / POST fields:
//   param[$ne]=x      (not-equal bypass — returns rows the equality check
//                      would hide)
//   {"$gt": ""}       (JSON operator smuggling)
//   {"$where": "..."} (JS execution — error oracle only here)
//
// Oracle (differential, two variants):
//   1. Boolean: benign `param=<unlikely>` vs `param[$ne]=<unlikely>` —
//      the operator variant must return a DIFFERENT (usually larger) result
//      set than the benign one (diverged=true).
//   2. Error: MongoDB error text ("MongoError", "unknown operator",
//      "$where") appears on the malicious input and not the benign one.
//
// class 'nosql_injection' routes to the sqli_boolean protocol (the class
// string contains 'sqli'), so evidence.diverged=true → 'confirmed'.
// Severity: high (auth bypass / data exfiltration primitive).
import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints, isQueryPoint } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

const MONGO_ERRORS = /mongoerror|unknown operator|\$where|bson|mongodb/i;

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


// Rough result-set size signal: length + count of repeated row markers.
function resultSignal(text) {
  return text.length;
}

export async function probeNoSqli(url, params, opts = {}) {
  const findings = [];
  // Operator syntax (param[$ne]) only exists in the query string —
  // path segments carry no operator names. Query points only.
  const queryParams = params.filter(isQueryPoint);
  noteAttemptedPoints(opts, queryParams.slice(0, 10));
  for (const param of queryParams.slice(0, 10)) {
    const unlikely = `dmno${randomBytes(3).toString('hex')}`;
    let benign;
    try {
      benign = await get(mutateUrl(url, param, unlikely), opts);
    } catch {
      continue;
    }
    // Variant 1: $ne operator bypass (PHP-style param[$ne] and JSON style).
    for (const op of [{ kind: 'query', name: `${probePointName(param)}[$ne]` }, param]) {
      const opValue = op === param ? JSON.stringify({ $ne: unlikely }) : unlikely;
      let malicious;
      try {
        malicious = await get(mutateUrl(url, op, opValue), opts);
      } catch {
        continue;
      }
      const benignErr = MONGO_ERRORS.test(benign.text);
      const malErr = MONGO_ERRORS.test(malicious.text);
      if (malErr && !benignErr) {
        const m = malicious.text.match(MONGO_ERRORS);
        const idx = malicious.text.indexOf(m[0]);
        const window = malicious.text.slice(Math.max(0, idx - 60), idx + 120);
        findings.push({
          class: 'nosql_injection',
          id: `nosqli-error-${probePointName(param)}`,
          title: `NoSQL injection (MongoDB error) in parameter '${probePointParameter(param)}'`,
          severity: 'high',
          url,
          param: probePointParameter(param),
          parameter: probePointParameter(param),
          evidence: {
            request: `GET ${mutateUrl(url, op, opValue)}`,
            response: `MongoDB error text on operator input — "...${window}..." — absent on benign input`,
            impact_demo: 'operator reached the NoSQL query builder — $ne/$gt/$where are injectable',
            diverged: true,
          },
        });
        break;
      }
      // Boolean differential: operator bypass must change the result set.
      const delta = Math.abs(resultSignal(malicious.text) - resultSignal(benign.text));
      const baseline = Math.max(resultSignal(benign.text), 500);
      if (delta > baseline * 0.25 && delta > 200) {
        findings.push({
          class: 'nosql_injection',
          id: `nosqli-bool-${probePointName(param)}`,
          title: `NoSQL injection (boolean bypass) in parameter '${probePointParameter(param)}'`,
          severity: 'high',
          url,
          param: probePointParameter(param),
          parameter: probePointParameter(param),
          evidence: {
            request: `GET ${mutateUrl(url, op, opValue)} vs benign ${mutateUrl(url, param, unlikely)}`,
            response: `result set diverged by ${delta} chars (benign ${resultSignal(benign.text)}, operator ${resultSignal(malicious.text)})`,
            impact_demo: '$ne operator bypassed the equality filter — authentication/lookup bypass primitive',
            diverged: true,
            // Structured lengths for the shared tiny-error-page guard
            // (hunt-intel/differential.js): a 31-char operator stub vs a
            // 45k-char benign page is a rejected request, not a bypass.
            benignLength: resultSignal(benign.text),
            operatorLength: resultSignal(malicious.text),
          },
        });
        break;
      }
    }
  }
  return findings;
}
