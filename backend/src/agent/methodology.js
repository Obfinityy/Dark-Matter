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
    { id: 'cloud-enum', name: 'Cloud asset enumeration', description: 'Look for exposed S3 buckets, storage and cloud metadata tied to the target.' }
  ],
  enumeration: [
    { id: 'port-scan', name: 'Port scanning', description: 'SYN scan the target for open services beyond HTTP/HTTPS.' },
    { id: 'dir-fuzz', name: 'Directory fuzzing', description: 'Brute-force hidden paths, admin panels and backup files.' },
    { id: 'param-discovery', name: 'Parameter discovery', description: 'Find hidden GET/POST parameters, headers and API arguments.' },
    { id: 'api-enum', name: 'API enumeration', description: 'Map REST/GraphQL endpoints, versions and undocumented operations.' },
    { id: 'vhost-fuzz', name: 'Virtual-host fuzzing', description: 'Probe Host-header variants for hidden vhosts and dev instances.' }
  ],
  probing: [
    { id: 'xss-probe', name: 'XSS probing', description: 'Test reflections, contexts and filters for cross-site scripting.' },
    { id: 'sqli-probe', name: 'SQL injection probing', description: 'Boolean, time-based and error-based injection probes.' },
    { id: 'ssrf-probe', name: 'SSRF probing', description: 'Coax the server into requesting attacker-controlled URLs.' },
    { id: 'idor-probe', name: 'IDOR probing', description: 'Swap object references across users to find broken access control.' },
    { id: 'auth-bypass-probe', name: 'Auth bypass probing', description: 'Logic flaws in login, OTP, password reset and session handling.' },
    { id: 'file-upload-probe', name: 'File upload probing', description: 'Test upload handlers for type confusion and path traversal.' }
  ],
  exploitation: [
    { id: 'xss-exploit', name: 'XSS confirmation', description: 'Turn a probe into a safe proof-of-concept with full context capture.' },
    { id: 'sqli-exploit', name: 'SQLi confirmation', description: 'Confirm injection impact without exfiltrating data beyond proof.' },
    { id: 'rce-probe', name: 'RCE probing', description: 'Template injection, deserialization and command-injection probes with harmless canaries.' },
    { id: 'privesc-probe', name: 'Privilege escalation probing', description: 'Role confusion, JWT tampering and vertical access tests.' }
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
export function describeHuntState({ stage, tried = [], findingsCount = 0 } = {}) {
  const current = stageForPhase(stage);
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
