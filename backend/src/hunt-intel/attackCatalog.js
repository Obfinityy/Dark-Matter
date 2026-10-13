// Dark Matter hunt-intel — technique catalog with MITRE ATT&CK tags.
// Technique: CyberStrike (MIT). Every technique the agent knows is tagged,
// so the learning loop retrieves by structured tactic instead of free text.

export const TECHNIQUE_CATALOG = [
  // Reconnaissance (TA0043)
  { id: 'T-subdomain-enum', name: 'Subdomain enumeration', tactic: 'TA0043', techniques: ['T1590.002'] },
  { id: 'T-tech-fingerprint', name: 'Technology fingerprinting', tactic: 'TA0043', techniques: ['T1592.002'] },
  { id: 'T-js-secret-scan', name: 'JS secret scanning', tactic: 'TA0043', techniques: ['T1592.004'] },
  { id: 'T-source-map', name: 'Source-map reconstruction', tactic: 'TA0043', techniques: ['T1592.004'] },

  // Initial Access (TA0001)
  { id: 'T-sqli', name: 'SQL injection', tactic: 'TA0001', techniques: ['T1190'] },
  { id: 'T-ssrf', name: 'Server-side request forgery', tactic: 'TA0001', techniques: ['T1190'] },
  { id: 'T-file-upload', name: 'Malicious file upload', tactic: 'TA0001', techniques: ['T1190'] },
  { id: 'T-xxe', name: 'XML external entity', tactic: 'TA0001', techniques: ['T1190'] },

  // Execution (TA0002)
  { id: 'T-rce', name: 'Remote code execution', tactic: 'TA0002', techniques: ['T1059'] },
  { id: 'T-ssti', name: 'Server-side template injection', tactic: 'TA0002', techniques: ['T1059'] },
  { id: 'T-deserialization', name: 'Insecure deserialization', tactic: 'TA0002', techniques: ['T1059'] },

  // Persistence (TA0003)
  { id: 'T-webshell', name: 'Webshell persistence', tactic: 'TA0003', techniques: ['T1505.003'] },

  // Privilege Escalation (TA0004)
  { id: 'T-idor', name: 'Insecure direct object reference', tactic: 'TA0004', techniques: ['T1548'] },
  { id: 'T-mass-assign', name: 'Mass assignment', tactic: 'TA0004', techniques: ['T1548'] },
  { id: 'T-jwt-weak', name: 'JWT weakness', tactic: 'TA0004', techniques: ['T1550'] },
  { id: 'T-bfla', name: 'Broken function-level authorization', tactic: 'TA0004', techniques: ['T1548'] },
  { id: 'T-role-escalation', name: 'Role escalation via invite', tactic: 'TA0004', techniques: ['T1548'] },

  // Defense Evasion (TA0005)
  { id: 'T-waf-bypass', name: 'WAF bypass / obfuscation', tactic: 'TA0005', techniques: ['T1027'] },
  { id: 'T-api-downgrade', name: 'API version downgrade', tactic: 'TA0005', techniques: ['T1027'] },

  // Credential Access (TA0006)
  { id: 'T-cred-leak', name: 'Credential disclosure', tactic: 'TA0006', techniques: ['T1552'] },
  { id: 'T-otp-bruteforce', name: 'OTP brute-force', tactic: 'TA0006', techniques: ['T1110'] },
  { id: 'T-2fa-bypass', name: '2FA bypass', tactic: 'TA0006', techniques: ['T1550'] },
  { id: 'T-password-reset', name: 'Password reset poisoning', tactic: 'TA0006', techniques: ['T1552'] },

  // Collection (TA0009)
  { id: 'T-data-exfil', name: 'Data enumeration via IDOR', tactic: 'TA0009', techniques: ['T1005'] },

  // Impact (TA0040)
  { id: 'T-price-tamper', name: 'Price/business-logic manipulation', tactic: 'TA0040', techniques: ['T1496'] },
  { id: 'T-race-condition', name: 'Race condition / double-spend', tactic: 'TA0040', techniques: ['T1496'] },
];

/** Find techniques by MITRE tactic ID. */
export function techniquesByTactic(tacticId) {
  return TECHNIQUE_CATALOG.filter((t) => t.tactic === tacticId);
}

/** Find techniques by keyword. */
export function searchTechniques(keyword) {
  const k = String(keyword || '').toLowerCase();
  return TECHNIQUE_CATALOG.filter(
    (t) => t.name.toLowerCase().includes(k) || t.id.toLowerCase().includes(k)
  );
}
