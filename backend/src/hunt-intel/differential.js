// Dark Matter hunt-intel — differential confirmation (technique #5) +
// exploitability rubric (from the crash-triage pattern).
//
// The cheapest false-positive killer in existence: NO finding is "confirmed"
// without a CONTROL — a true/false request pair proving the signal is not
// ambient noise. Adapted from nuclei-templates' differential checks
// (baseline-vs-always-false predicate testing).
//
// Verdicts:
//   confirmed   — control pair diverged as the vuln hypothesis predicts
//   unconfirmed — only a single observation exists; needs a control probe
//   rejected    — control pair did NOT diverge; almost certainly a false positive
//
// The exploitability rubric then answers: does the attacker CONTROL data,
// a code path, or merely cause an error? Only "control" findings become
// high/critical severity. This is what keeps reports credible (and hunters
// unbanned).

/**
 * Per-class confirmation protocols: what true/false pair proves the finding.
 * The engine (or a verification pass) executes these; this module judges.
 */
export const CONFIRMATION_PROTOCOLS = {
  sqli_boolean: {
    control: 'Send TRUE predicate (e.g. AND 1=1) and FALSE predicate (AND 1=2); responses must diverge.',
    judge: (r) => (r.diverged === true ? 'confirmed' : r.diverged === false ? 'rejected' : 'unconfirmed'),
  },
  sqli_time: {
    control: 'Baseline response time vs injected SLEEP(5); delay must track the injection.',
    judge: (r) => (r.delayTracks === true ? 'confirmed' : r.delayTracks === false ? 'rejected' : 'unconfirmed'),
  },
  sqli_error: {
    control: 'Trigger the DB error, then send a benign variant; error must disappear on the benign input.',
    judge: (r) => (r.errorCorrelated === true ? 'confirmed' : r.errorCorrelated === false ? 'rejected' : 'unconfirmed'),
  },
  xss_reflected: {
    control: 'Inject a unique canary; it must reflect unencoded. A second request with an encoded canary must NOT execute.',
    judge: (r) => (r.canaryReflected === true ? 'confirmed' : r.canaryReflected === false ? 'rejected' : 'unconfirmed'),
  },
  idor: {
    control: 'Request object A (own) and object B (other user). B must return 200 with foreign data while an unauthenticated request to B returns 401/403.',
    judge: (r) => (r.crossUserRead === true ? 'confirmed' : r.crossUserRead === false ? 'rejected' : 'unconfirmed'),
  },
  ssrf: {
    control: 'Point the fetcher at a collaborator URL; a DNS/HTTP hit must arrive. A non-routable canary must produce no hit.',
    judge: (r) => (r.oobHit === true ? 'confirmed' : r.oobHit === false ? 'rejected' : 'unconfirmed'),
  },
  auth_bypass: {
    control: 'Replay the privileged request with no session (expect 401) and with a low-priv session performing the same action (expect 403); the bypass session must get 200.',
    judge: (r) => (r.bypassWorks === true ? 'confirmed' : r.bypassWorks === false ? 'rejected' : 'unconfirmed'),
  },
  default: {
    control: 'Repeat the probe with a benign control input; the vulnerable signal must appear ONLY on the malicious input.',
    judge: (r) => (r.signalCorrelated === true ? 'confirmed' : r.signalCorrelated === false ? 'rejected' : 'unconfirmed'),
  },
};

function protocolFor(finding) {
  const cls = String(finding.class || finding.type || '').toLowerCase().replace(/[^a-z]/g, '');
  // Generic class -> most common protocol for that family.
  if (cls.includes('sqli') || cls.includes('sqlinjection')) {
    return cls.includes('time') || cls.includes('blind')
      ? CONFIRMATION_PROTOCOLS.sqli_time
      : cls.includes('error')
        ? CONFIRMATION_PROTOCOLS.sqli_error
        : CONFIRMATION_PROTOCOLS.sqli_boolean;
  }
  if (cls.includes('xss')) return CONFIRMATION_PROTOCOLS.xss_reflected;
  if (cls.includes('idor') || cls.includes('bola')) return CONFIRMATION_PROTOCOLS.idor;
  if (cls.includes('ssrf')) return CONFIRMATION_PROTOCOLS.ssrf;
  if (cls.includes('authbypass') || cls.includes('bypass')) return CONFIRMATION_PROTOCOLS.auth_bypass;
  for (const [key, proto] of Object.entries(CONFIRMATION_PROTOCOLS)) {
    if (key !== 'default' && cls.includes(key.replace(/_/g, ''))) return proto;
  }
  return CONFIRMATION_PROTOCOLS.default;
}

/** Judge a finding given its control-probe evidence. */
export function assessConfirmation(finding, evidence = {}) {
  const proto = protocolFor(finding);
  const verdict = proto.judge({ ...finding.evidence, ...evidence });
  return { verdict, protocol: proto.control };
}

// ---- Exploitability rubric -------------------------------------------------
// LIKELY_EXPLOITABLE: attacker controls data reaching a sensitive sink/code path.
// MEDIUM:              attacker influence is partial or impact is limited.
// BENIGN:              error/observation only; no attacker control demonstrated.
//
// Control is derived from the finding's CAPABILITY primitives (chainEngine),
// not from string-matching the class name.

const CONTROL_CAPS = new Set(['code_exec', 'db_read', 'db_write', 'file_read', 'file_write', 'auth_bypass', 'priv_esc', 'ssrf', 'js_exec', 'session_theft', 'cloud_meta']);
const PARTIAL_CAPS = new Set(['info_leak', 'data_read', 'data_write', 'state_change', 'phishing', 'bruteforce', 'admin_access', 'source_leak', 'cred_leak']);

function capabilitiesOfFinding(finding) {
  const cls = String(finding.class || finding.type || finding.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  // Local copy of the primitive map (kept in sync with chainEngine.js).
  const map = {
    sqli: ['db_read', 'db_write'], sqli_blind: ['db_read'], sqli_error: ['db_read'],
    xss_stored: ['js_exec', 'session_theft'], xss_reflected: ['js_exec'], xss_dom: ['js_exec'],
    ssrf: ['ssrf'], lfi: ['file_read'], rfi: ['file_read', 'code_exec'], rce: ['code_exec'],
    cmd_injection: ['code_exec'], idor: ['data_read', 'data_write'], auth_bypass: ['auth_bypass'],
    jwt_weak: ['auth_bypass', 'priv_esc'], priv_esc: ['priv_esc'], cred_leak: ['cred_leak'],
    file_upload: ['file_write'], xxe: ['file_read', 'ssrf'], ssti: ['code_exec'],
    deserialization: ['code_exec'], exposed_admin: ['admin_access'], exposed_git: ['source_leak', 'cred_leak'],
  };
  if (map[cls]) return map[cls];
  for (const [key, caps] of Object.entries(map)) {
    if (cls.includes(key) || key.includes(cls)) return caps;
  }
  return [];
}

export function scoreExploitability(finding, confirmation = 'unconfirmed') {
  const conf = String(confirmation).toLowerCase();
  if (conf === 'rejected') return { level: 'BENIGN', reason: 'Control probe did not diverge — likely false positive.' };
  const caps = capabilitiesOfFinding(finding);
  const hasControl = caps.some((c) => CONTROL_CAPS.has(c));
  const hasPartial = caps.some((c) => PARTIAL_CAPS.has(c));
  if (hasControl && conf === 'confirmed') {
    return { level: 'LIKELY_EXPLOITABLE', reason: 'Confirmed attacker control over a sensitive sink.' };
  }
  if (hasControl) {
    return { level: 'MEDIUM', reason: 'Sensitive sink reachable but not yet differentially confirmed.' };
  }
  if (hasPartial && conf === 'confirmed') {
    return { level: 'MEDIUM', reason: 'Confirmed finding with limited direct impact — chain it.' };
  }
  return { level: 'BENIGN', reason: 'Observation only; no attacker control demonstrated.' };
}

// ---- Dedup -----------------------------------------------------------------
// Dedup by (vuln-class + sink location + trigger), NOT by URL — stops 50
// duplicate reports for the same underlying flaw.

export function dedupeFindings(findings) {
  const seen = new Map();
  for (const f of findings || []) {
    const key = [
      String(f.class || f.type || '').toLowerCase(),
      String(f.sink || f.parameter || f.url || '').toLowerCase(),
      String(f.trigger || f.payload || '').toLowerCase().slice(0, 80),
    ].join('|');
    if (!seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

// ---- Evidence-first gate (BugTraceAI technique, Apache-2.0) -----------------
// "AI output is a hypothesis, evidence makes it a finding."
// No finding ships to the user without attached execution evidence:
// the exact request, the exact response, and what proves exploitation.

const EVIDENCE_REQUIREMENTS = {
  critical: ['request', 'response', 'impact_demo'],
  high: ['request', 'response'],
  medium: ['request', 'response'],
  low: ['request'],
};

/**
 * Gate a finding: does it carry enough evidence to ship?
 * @returns {{pass: boolean, missing: string[], gated: object}}
 */
export function evidenceGate(finding) {
  const severity = String(finding.severity || 'medium').toLowerCase();
  const required = EVIDENCE_REQUIREMENTS[severity] || EVIDENCE_REQUIREMENTS.medium;
  const evidence = finding.evidence || {};
  const missing = required.filter((k) => !evidence[k]);
  const gated = {
    ...finding,
    evidenceStatus: missing.length === 0 ? 'evidenced' : 'hypothesis',
    evidenceMissing: missing,
  };
  return { pass: missing.length === 0, missing, gated };
}

// ---- 4-step verify pipeline (0sec technique) --------------------------------
// reachability → payload validation → impact assessment → exploit confirmation.
// ANY step fails = false positive. No exceptions.

export const VERIFY_STEPS = [
  { id: 'reachability', desc: 'Target endpoint is reachable and responds' },
  { id: 'payload_validation', desc: 'Payload reaches the sink unmodified (or predictably transformed)' },
  { id: 'impact_assessment', desc: 'Observed behavior proves security impact (not just reflection)' },
  { id: 'exploit_confirmation', desc: 'Impact is reproducible and attacker-controlled' },
];

/**
 * Run the 4-step verify pipeline over step results.
 * @param {{reachability: boolean, payload_validation: boolean, impact_assessment: boolean, exploit_confirmation: boolean}} steps
 * @returns {{verified: boolean, failedAt: string|null, verdict: string}}
 */
export function verifyPipeline(steps) {
  for (const step of VERIFY_STEPS) {
    if (!steps[step.id]) {
      return {
        verified: false,
        failedAt: step.id,
        verdict: `false_positive (${step.id}: ${step.desc} — FAILED)`,
      };
    }
  }
  return { verified: true, failedAt: null, verdict: 'confirmed (all 4 steps passed)' };
}
