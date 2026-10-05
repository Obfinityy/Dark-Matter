/**
 * defaultCredentialProbes.js — Safe default-credential probe planner.
 *
 * Builds a tightly-scoped, read-only default-credential probe plan for an
 * identified service (vendor factory defaults only — public knowledge), with
 * hard safety guardrails (attempt caps, lockout abort, no brute force), and
 * classifies already-captured probe outcomes.
 *
 * SAFETY: this module only *plans* and *classifies*. It never opens a login
 * session, never transmits credentials, and never touches a real host. Any
 * execution must be explicitly authorized, in scope, and read-only.
 */

const PROBE_SAFETY_POLICY = {
  readOnly: true,
  scope: 'authorized-target-only',
  requiresExplicitAuthorization: true,
  noBruteForce: true,
  stopOnFirstSuccess: true,
  abortOnLockoutSignal: true,
  maxAttemptsPerService: 5,
  delayBetweenAttemptsMs: 2000,
  forbidden: [
    'Password spraying across many accounts',
    'Trying credentials beyond the vendor-default list',
    'Any write, delete, or configuration change after login',
    'Probing hosts outside the authorized scope',
  ],
};

// Vendor factory defaults (public knowledge). Kept minimal on purpose:
// the first few defaults catch the overwhelming majority of misconfigurations.
const DEFAULT_CREDENTIALS = [
  { vendors: ['generic'], service: 'http-basic', pairs: [['admin', 'admin'], ['admin', 'password'], ['administrator', 'administrator']] },
  { vendors: ['generic'], service: 'ssh', pairs: [['root', 'root'], ['root', 'toor'], ['admin', 'admin']] },
  { vendors: ['generic'], service: 'telnet', pairs: [['root', 'root'], ['admin', 'admin'], ['guest', 'guest']] },
  { vendors: ['generic'], service: 'ftp', pairs: [['admin', 'admin'], ['anonymous', 'anonymous']] },
  { vendors: ['cisco'], service: 'ssh', pairs: [['cisco', 'cisco'], ['admin', 'admin']] },
  { vendors: ['cisco'], service: 'telnet', pairs: [['cisco', 'cisco']] },
  { vendors: ['ubiquiti', 'ubnt'], service: 'ssh', pairs: [['ubnt', 'ubnt'], ['root', 'ubnt']] },
  { vendors: ['mikrotik'], service: 'ssh', pairs: [['admin', '']] },
  { vendors: ['apache', 'tomcat'], service: 'http-basic', pairs: [['tomcat', 'tomcat'], ['admin', 'admin'], ['manager', 'manager']] },
  { vendors: ['jenkins'], service: 'http-form', pairs: [['admin', 'admin']] },
  { vendors: ['raspberry', 'raspberrypi'], service: 'ssh', pairs: [['pi', 'raspberry']] },
  { vendors: ['netgear'], service: 'http-basic', pairs: [['admin', 'password']] },
  { vendors: ['dlink', 'd-link'], service: 'http-basic', pairs: [['admin', '']] },
  { vendors: ['hikvision'], service: 'http-basic', pairs: [['admin', '12345']] },
  { vendors: ['dahua'], service: 'http-basic', pairs: [['admin', 'admin']] },
];

/**
 * Build a safe, read-only default-credential probe plan for an identified service.
 * Returns a plan object only — it does not execute anything.
 * @param {{host: string, port?: number, service: string, vendor?: string, authorized?: boolean}} input
 */
export function buildProbeConfig({ host, port = null, service, vendor = 'generic', authorized = false } = {}) {
  if (!host || !service) {
    return { error: 'host and service are required.', planned: false };
  }
  if (!authorized) {
    return {
      planned: false,
      host,
      service,
      error: 'Refusing to plan: target is not marked authorized. Default-credential probes require explicit authorization.',
    };
  }

  const svc = String(service).toLowerCase();
  const vnd = String(vendor).toLowerCase();
  const entry = DEFAULT_CREDENTIALS.find(
    (e) => e.service === svc && e.vendors.some((v) => vnd.includes(v) || v.includes(vnd)),
  ) || DEFAULT_CREDENTIALS.find((e) => e.service === svc && e.vendors.includes('generic'));

  if (!entry) {
    return { planned: false, host, service, error: `No default-credential list for service '${service}'.` };
  }

  const pairs = entry.pairs.slice(0, PROBE_SAFETY_POLICY.maxAttemptsPerService).map(([username, password]) => ({
    username,
    passwordSet: password !== '',
    // The actual secret is never embedded — the executor resolves the
    // well-known default at run time. This keeps secrets out of plans/logs.
    credentialRef: `vendor-default:${username}`,
  }));

  return {
    planned: true,
    host,
    port,
    service: entry.service,
    matchedVendor: entry.vendors[0],
    pairs,
    attemptCount: pairs.length,
    safety: { ...PROBE_SAFETY_POLICY },
    executionRules: [
      'Execute only against the authorized in-scope host above.',
      'Authenticate read-only: verify access, then stop — no commands, no writes.',
      `Abort immediately on any lockout signal; never exceed ${PROBE_SAFETY_POLICY.maxAttemptsPerService} attempts.`,
      `Wait ${PROBE_SAFETY_POLICY.delayBetweenAttemptsMs}ms between attempts.`,
      'Log every attempt with timestamp for the engagement report.',
    ],
    note: 'Plan only — no login is performed by this module.',
  };
}

/**
 * Classify an already-captured probe outcome (no live probing here).
 * @param {{outcome: 'success'|'failure'|'lockout'|'error', responseDetail?: string, readOnlyVerified?: boolean, service?: string, host?: string}} input
 */
export function classifyProbeResult({ outcome, responseDetail = '', readOnlyVerified = false, service = null, host = null } = {}) {
  const detail = String(responseDetail).slice(0, 300);

  if (outcome === 'lockout') {
    return {
      classification: 'account-locked-stop',
      severity: 'High',
      host, service,
      detail,
      action: 'STOP all further attempts immediately — the account or IP is locked. Report the lockout to the engagement lead; continued attempts are a denial-of-service risk.',
    };
  }
  if (outcome === 'success') {
    return {
      classification: readOnlyVerified ? 'default-creds-confirmed' : 'default-creds-likely',
      severity: 'High',
      host, service,
      detail,
      action: readOnlyVerified
        ? 'Confirmed: vendor default credentials grant read access. Report with the read-only verification evidence; recommend immediate rotation. Do NOT escalate or modify anything.'
        : 'Login appeared to succeed — re-verify with a strictly read-only check before reporting.',
    };
  }
  if (outcome === 'error') {
    return {
      classification: 'inconclusive',
      severity: 'Info',
      host, service,
      detail,
      action: 'Transport or protocol error — not a credential verdict. Retry once after the safety delay, then stop.',
    };
  }
  return {
    classification: 'no-default-creds',
    severity: 'Info',
    host, service,
    detail,
    action: 'None of the vendor defaults worked. Do not expand into guessing — move on.',
  };
}

export const DEFAULT_CREDENTIAL_PROBES = {
  buildProbeConfig,
  classifyProbeResult,
  PROBE_SAFETY_POLICY,
};
export default DEFAULT_CREDENTIAL_PROBES;
