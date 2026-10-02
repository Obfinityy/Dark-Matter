/**
 * methodology.js — the bug-bounty methodology the autonomous brain hunts by.
 *
 * An elite human hunter works in stages: recon → enumeration → probing →
 * exploitation → chaining → reporting. This module gives the agent that same
 * skeleton: `stageForPhase` normalizes whatever phase the job is in, and
 * `techniquesForStage` lists the concrete techniques available at each stage
 * so the brain always has fresh angles to try (non-stop hunting) instead of
 * repeating itself or stalling.
 */

const STAGES = ['recon', 'enumeration', 'probing', 'exploitation', 'chaining', 'reporting'];

// Job phases that are not methodology stages map to the closest stage.
const PHASE_TO_STAGE = {
  initializing: 'recon',
  idle: 'recon',
  verifying: 'probing',
  waiting: 'probing',
  paused: 'probing',
  complete: 'reporting'
};

export function stageForPhase(phase) {
  const p = String(phase || '').toLowerCase().trim();
  if (STAGES.includes(p)) return p;
  return PHASE_TO_STAGE[p] || 'recon';
}

const TECHNIQUES = {
  recon: [
    { id: 'subdomain-enum', name: 'Subdomain enumeration', description: 'Discover subdomains via certificate transparency, DNS brute-forcing and search engines.' },
    { id: 'tech-fingerprint', name: 'Technology fingerprinting', description: 'Identify frameworks, CMS, servers and third-party services from headers and page markers.' },
    { id: 'dns-history', name: 'DNS history & passive recon', description: 'Historical DNS, WHOIS and archived snapshots for forgotten assets.' },
    { id: 'js-discovery', name: 'JavaScript discovery', description: 'Harvest JS bundles for hidden endpoints, API keys and internal routes.' },
    { id: 'js-deep-analysis', name: 'JavaScript deep analysis', description: 'DEEP: extract secrets, API keys, hidden endpoints, client-side logic flaws, source maps from JS. Use jsAnalyzer.' },
    { id: 'cloud-enum', name: 'Cloud asset enumeration', description: 'Look for exposed S3 buckets, storage and cloud metadata tied to the target.' },
    { id: 'cloud-misconfig', name: 'Cloud misconfiguration testing', description: 'Test S3/Azure/GCP/Firebase for public access. Use cloudEngine.' },
    { id: 'takeover-check', name: 'Subdomain takeover check', description: 'Detect dangling CNAMEs to 30+ takeover-prone services. Use takeoverEngine.' }
  ],
  enumeration: [
    { id: 'port-scan', name: 'Port scanning', description: 'SYN scan the target for open services beyond HTTP/HTTPS.' },
    { id: 'dir-fuzz', name: 'Directory fuzzing', description: 'Brute-force hidden paths, admin panels and backup files.' },
    { id: 'param-discovery', name: 'Parameter discovery', description: 'Find hidden GET/POST parameters, headers and API arguments.' },
    { id: 'api-enum', name: 'API enumeration', description: 'Map REST/GraphQL endpoints, versions and undocumented operations.' },
    { id: 'api-deep-test', name: 'Deep API security testing', description: 'BOLA, mass assignment, JWT flaws, excessive data, GraphQL introspection. Use apiSecurityEngine.' },
    { id: 'vhost-fuzz', name: 'Virtual-host fuzzing', description: 'Probe Host-header variants for hidden vhosts and dev instances.' },
    { id: 'waf-detect', name: 'WAF detection', description: 'Detect WAF/protection and adapt. Use stealthEngine before aggressive tests.' }
  ],
  probing: [
    { id: 'xss-probe', name: 'XSS probing', description: 'Test reflections, contexts and filters for cross-site scripting.' },
    { id: 'sqli-probe', name: 'SQL injection probing', description: 'Boolean, time-based and error-based injection probes.' },
    { id: 'ssrf-probe', name: 'SSRF probing', description: 'Coax the server into requesting attacker-controlled URLs.' },
    { id: 'idor-probe', name: 'IDOR probing', description: 'Swap object references across users to find broken access control.' },
    { id: 'auth-bypass-probe', name: 'Auth bypass probing', description: 'Logic flaws in login, OTP, password reset and session handling.' },
    { id: 'file-upload-probe', name: 'File upload probing', description: 'Test upload handlers for type confusion and path traversal.' },
    { id: 'business-logic', name: 'Business logic testing', description: 'ELITE: price manipulation, workflow bypass, race conditions, mass assignment, coupon abuse. Use businessLogicEngine. This is where big bounties live.' },
    { id: 'stealth-probe', name: 'Stealth probing', description: 'WAF-aware probing with bypass techniques, rate-limit respect, randomized requests. Use stealthEngine.' }
  ],
  exploitation: [
    { id: 'xss-exploit', name: 'XSS confirmation', description: 'Turn a probe into a safe proof-of-concept with full context capture.' },
    { id: 'sqli-exploit', name: 'SQLi confirmation', description: 'Confirm injection impact without exfiltrating data beyond proof.' },
    { id: 'rce-probe', name: 'RCE probing', description: 'Template injection, deserialization and command-injection probes with harmless canaries.' },
    { id: 'privesc-probe', name: 'Privilege escalation probing', description: 'Role confusion, JWT tampering and vertical access tests.' },
    { id: 'poc-generate', name: 'PoC generation', description: 'Generate working proof-of-concept for confirmed findings. Use exploitEngine.' },
    { id: 'visual-proof', name: 'Visual proof capture', description: 'Screenshot the vulnerability in action for the report. Use visualProof.' }
  ],
  chaining: [
    { id: 'chain-combine', name: 'Vulnerability chaining', description: 'Combine confirmed low/medium findings into higher-impact attack chains.' },
    { id: 'chain-escalate', name: 'Impact escalation', description: 'Re-test chains for account takeover, data access or full compromise.' }
  ],
  reporting: [
    { id: 'evidence-compile', name: 'Evidence compilation', description: 'Gather screenshots, logs and repro steps for each confirmed finding.' },
    { id: 'report-draft', name: 'Report drafting', description: 'Write the submission-quality vulnerability report.' }
  ]
};

export function techniquesForStage(stage) {
  return [...(TECHNIQUES[stage] || TECHNIQUES.recon)];
}

/**
 * Plain-language hunt context for the brain prompt: where the methodology
 * stands, what was already tried, and how many findings exist — so every
 * reasoning cycle starts from the true state, never from a blank slate.
 */
export function describeHuntState({ stage, tried = [], findingsCount = 0 } = {}) {  const current = stageForPhase(stage);
  const idx = STAGES.indexOf(current);
  const triedList = tried.length ? tried.join(', ') : 'nothing yet';
  return [
    `Methodology stage: ${current} (step ${idx + 1} of ${STAGES.length}: ${STAGES.join(' → ')}).`,
    `Techniques already tried: ${triedList}.`,
    `Confirmed findings so far: ${findingsCount}.`,
    tried.length
      ? 'Do NOT repeat a tried technique unless you have a genuinely new angle — keep moving to untried techniques.'
      : 'Start with the earliest untried technique for this stage.'
  ].join('\n');
}

/**
 * ── OWASP Top-10 coverage meter (2021) ────────────────────────────────────
 *
 * Per-hunt coverage: which OWASP categories have at least one CONFIRMED
 * finding, expressed as a percentage. Shown in the Reports UI as the
 * coverage meter, and embedded in hunt records. Coverage of a category by a
 * confirmed finding is evidence of real testing breadth — not a claim that
 * the other categories are clean.
 */
export const OWASP_TOP10_2021 = Object.freeze([
  { id: 'A01', name: 'Broken Access Control', vulnTypes: ['idor', 'broken_access_control', 'mass_assignment', 'auth_bypass', 'privilege_escalation', 'bola'] },
  { id: 'A02', name: 'Cryptographic Failures', vulnTypes: ['weak_crypto', 'sensitive_data_exposure', 'insecure_randomness', 'plaintext_secret'] },
  { id: 'A03', name: 'Injection', vulnTypes: ['xss_reflected', 'xss_stored', 'xss_dom', 'xss', 'sqli', 'sql_injection', 'command_injection', 'rce', 'ssti', 'template_injection', 'xxe', 'lfi', 'path_traversal', 'path-traversal', 'ldap_injection', 'header_injection'] },
  { id: 'A04', name: 'Insecure Design', vulnTypes: ['business_logic', 'race_condition', 'workflow_bypass', 'price_manipulation'] },
  { id: 'A05', name: 'Security Misconfiguration', vulnTypes: ['misconfiguration', 'default_credentials', 'verbose_errors', 'directory_listing', 'unnecessary_features'] },
  { id: 'A06', name: 'Vulnerable and Outdated Components', vulnTypes: ['outdated_component', 'known_cve', 'vulnerable_library'] },
  { id: 'A07', name: 'Identification and Authentication Failures', vulnTypes: ['auth_failure', 'weak_password_policy', 'session_fixation', 'credential_stuffing', 'jwt_flaw'] },
  { id: 'A08', name: 'Software and Data Integrity Failures', vulnTypes: ['insecure_deserialization', 'unsigned_update', 'ci_cd_tampering'] },
  { id: 'A09', name: 'Security Logging and Monitoring Failures', vulnTypes: ['insufficient_logging', 'log_injection'] },
  { id: 'A10', name: 'Server-Side Request Forgery', vulnTypes: ['ssrf'] },
  { id: 'A00', name: 'Other (outside OWASP Top-10)', vulnTypes: ['csrf', 'open_redirect', 'clickjacking', 'cors_misconfig', 'subdomain_takeover', 'info_disclosure'] }
]);

function findingTypeOf(finding) {
  return String(finding.type || finding.vulnType || finding.category || '').toLowerCase().trim();
}

export function owaspCategoryFor(vulnType) {
  const type = String(vulnType || '').toLowerCase().trim();
  for (const cat of OWASP_TOP10_2021) {
    if (cat.vulnTypes.some((v) => type === v || type.includes(v))) return cat;
  }
  return null;
}

/**
 * Compute per-hunt OWASP coverage from findings.
 * Only `validated`/`confirmed` findings count — hypotheses don't move the meter.
 *
 * @param {Array} findings
 * @returns {{ percent: number, covered: Array, uncovered: Array, total: number }}
 */
export function owaspCoverage(findings = []) {
  const confirmed = findings.filter((f) =>
    ['validated', 'confirmed'].includes(String(f.status || f.state || '').toLowerCase())
  );
  const hits = new Map(); // category id -> count
  for (const finding of confirmed) {
    const cat = owaspCategoryFor(findingTypeOf(finding));
    if (cat && cat.id !== 'A00') {
      hits.set(cat.id, (hits.get(cat.id) || 0) + 1);
    }
  }
  const real = OWASP_TOP10_2021.filter((c) => c.id !== 'A00');
  const covered = real
    .filter((c) => hits.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, findings: hits.get(c.id) }));
  const uncovered = real
    .filter((c) => !hits.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }));
  const percent = Math.round((covered.length / real.length) * 100);
  return { percent, covered, uncovered, total: real.length };
}
