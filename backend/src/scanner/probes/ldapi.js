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
// Zerodha guards (9 Nov 2026 — hunt h_6b5942052353): the sibling
// ldapBlind probe fired on a Cloudflare "Just a moment" challenge page
// whose length bucket wobbled, on a WordPress site with no LDAP backend.
// The same noise shapes can reach this probe's boolean leg, so:
//   (a) the benign baseline is fetched TWICE and must reproduce itself
//       (FP3 double-control guard, oracleGuards.js) or the parameter
//       is skipped;
//   (b) a bot-challenge page on either side voids the differential —
//       the error leg still requires genuine LDAP error text, never a
//       challenge page;
//   (c) PHP/WordPress stacks skip the probe entirely (no LDAP filter
//       backend exists there).
//
// class 'ldap_injection' → default protocol → signalCorrelated=true
// (boolean variant also sets diverged=true for the evidence trail).
// Severity: high.
import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
import {
  isBotChallengePage,
  controlObservationsStable,
  isPhpWordpressStack,
} from './oracleGuards.js';

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


const BREAKOUTS = ['*)(uid=*))(|(uid=*', '*', 'admin)(uid=*'];

export async function probeLdapInjection(url, params, opts = {}) {
  const findings = [];
  // Stack gate: no LDAP filter backend exists on PHP/WordPress stacks.
  // Coverage diagnostic, before the early return: a gated-out stack
  // reports attempted [] (deliberate, not a silent skip) instead of
  // leaving pointsAttempted unset.
  if (isPhpWordpressStack(opts.stack)) {
    noteAttemptedPoints(opts, []);
    return findings;
  }
  noteAttemptedPoints(opts, params.slice(0, 10));
  for (const param of params.slice(0, 10)) {
    const unlikely = `dmldap${randomBytes(3).toString('hex')}`;
    let benign;
    let benign2;
    try {
      benign = await get(mutateUrl(url, param, unlikely), opts);
      // FP3: the benign baseline must reproduce itself. Same input,
      // second request — a wobbling baseline makes every divergence
      // unconfirmable.
      benign2 = await get(mutateUrl(url, param, unlikely), opts);
    } catch {
      continue;
    }
    // Bot-challenge invalidation: a challenged baseline voids the param.
    if (isBotChallengePage(benign.text) || isBotChallengePage(benign2.text)) continue;
    if (!controlObservationsStable(benign, benign2)) continue;
    for (const payload of BREAKOUTS) {
      let malicious;
      try {
        malicious = await get(mutateUrl(url, param, payload), opts);
      } catch {
        continue;
      }
      // Bot-challenge invalidation: a challenged leg voids its differential.
      if (isBotChallengePage(malicious.text)) continue;
      if (LDAP_ERRORS.test(malicious.text) && !LDAP_ERRORS.test(benign.text)) {
        const m = malicious.text.match(LDAP_ERRORS);
        const idx = malicious.text.indexOf(m[0]);
        const window = malicious.text.slice(Math.max(0, idx - 60), idx + 120);
        findings.push({
          class: 'ldap_injection',
          id: `ldapi-error-${probePointName(param)}`,
          title: `LDAP injection (error) in parameter '${probePointParameter(param)}'`,
          severity: 'high',
          url,
          param: probePointParameter(param),
          parameter: probePointParameter(param),
          evidence: {
            request: `GET ${mutateUrl(url, param, payload)}`,
            response: `LDAP error text on filter-breakout input — "...${window}..." — absent on benign input`,
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
          id: `ldapi-bool-${probePointName(param)}`,
          title: `LDAP injection (filter breakout) in parameter '${probePointParameter(param)}'`,
          severity: 'high',
          url,
          param: probePointParameter(param),
          parameter: probePointParameter(param),
          evidence: {
            request: `GET ${mutateUrl(url, param, payload)} vs benign`,
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
