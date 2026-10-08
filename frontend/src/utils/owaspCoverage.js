/**
 * owaspCoverage — client-side mirror of backend/src/agent/methodology.js.
 *
 * Computes the per-hunt OWASP Top-10 (2021) coverage meter from archived
 * findings. Only validated/confirmed findings move the meter.
 */

const CATEGORIES = [
  {
    id: 'A01',
    name: 'Broken Access Control',
    types: [
      'idor',
      'broken_access_control',
      'mass_assignment',
      'auth_bypass',
      'privilege_escalation',
      'bola',
    ],
  },
  {
    id: 'A02',
    name: 'Cryptographic Failures',
    types: ['weak_crypto', 'sensitive_data_exposure', 'insecure_randomness', 'plaintext_secret'],
  },
  {
    id: 'A03',
    name: 'Injection',
    types: [
      'xss_reflected',
      'xss_stored',
      'xss_dom',
      'xss',
      'sqli',
      'sql_injection',
      'command_injection',
      'rce',
      'ssti',
      'template_injection',
      'xxe',
      'lfi',
      'path_traversal',
      'path-traversal',
      'ldap_injection',
      'header_injection',
    ],
  },
  {
    id: 'A04',
    name: 'Insecure Design',
    types: ['business_logic', 'race_condition', 'workflow_bypass', 'price_manipulation'],
  },
  {
    id: 'A05',
    name: 'Security Misconfiguration',
    types: [
      'misconfiguration',
      'default_credentials',
      'verbose_errors',
      'directory_listing',
      'unnecessary_features',
    ],
  },
  {
    id: 'A06',
    name: 'Vulnerable and Outdated Components',
    types: ['outdated_component', 'known_cve', 'vulnerable_library'],
  },
  {
    id: 'A07',
    name: 'Identification and Authentication Failures',
    types: [
      'auth_failure',
      'weak_password_policy',
      'session_fixation',
      'credential_stuffing',
      'jwt_flaw',
    ],
  },
  {
    id: 'A08',
    name: 'Software and Data Integrity Failures',
    types: ['insecure_deserialization', 'unsigned_update', 'ci_cd_tampering'],
  },
  {
    id: 'A09',
    name: 'Security Logging and Monitoring Failures',
    types: ['insufficient_logging', 'log_injection'],
  },
  { id: 'A10', name: 'Server-Side Request Forgery', types: ['ssrf'] },
];

function typeOf(finding) {
  return String(finding.type || finding.vulnType || finding.category || '').toLowerCase();
}

function categoryFor(type) {
  for (const cat of CATEGORIES) {
    if (cat.types.some(t => type === t || type.includes(t))) return cat;
  }
  return null;
}

/**
 * owaspCoverage — compute OWASP Top-10 coverage from a findings list.
 * @param {Array} findings - Finding descriptors with category/class fields.
 * @returns {object} Coverage map keyed by OWASP category.
 */
export function owaspCoverage(findings = []) {
  const confirmed = findings.filter(f =>
    ['validated', 'confirmed'].includes(String(f.status || f.state || '').toLowerCase())
  );
  const hits = new Map();
  for (const f of confirmed) {
    const cat = categoryFor(typeOf(f));
    if (cat) hits.set(cat.id, (hits.get(cat.id) || 0) + 1);
  }
  const covered = CATEGORIES.filter(c => hits.has(c.id)).map(c => ({
    ...c,
    findings: hits.get(c.id),
  }));
  const uncovered = CATEGORIES.filter(c => !hits.has(c.id));
  return {
    percent: Math.round((covered.length / CATEGORIES.length) * 100),
    covered,
    uncovered,
    total: CATEGORIES.length,
  };
}
