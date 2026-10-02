/**
 * chainBuilder.js — Vulnerability chaining engine.
 *
 * Elite hunters don't report single lows — they CHAIN them:
 *  - XSS + CSRF = account takeover
 *  - Open redirect + OAuth = token theft
 *  - IDOR + info leak = data breach
 *  - SSRF + cloud metadata = server compromise
 *
 * Takes individual findings and suggests high-impact chains.
 */

const CHAIN_RULES = [
  {
    name: 'Account Takeover via XSS + Session Handling',
    needs: ['Cross-Site Scripting', 'Session'],
    impact: 'Full account takeover: XSS steals session tokens when session cookies lack HttpOnly/SameSite.',
    severity: 'Critical',
  },
  {
    name: 'OAuth Token Theft',
    needs: ['Open Redirect', 'OAuth'],
    impact: 'Attacker redirects OAuth flow to malicious site, stealing authorization codes/tokens.',
    severity: 'Critical',
  },
  {
    name: 'Data Breach via IDOR Chain',
    needs: ['IDOR', 'Sensitive'],
    impact: 'Sequential IDOR across multiple endpoints enables mass data harvesting.',
    severity: 'High',
  },
  {
    name: 'Server Compromise via SSRF',
    needs: ['SSRF', 'Cloud'],
    impact: 'SSRF to cloud metadata service yields credentials → server/cloud compromise.',
    severity: 'Critical',
  },
  {
    name: 'Privilege Escalation Chain',
    needs: ['IDOR', 'Admin'],
    impact: 'IDOR on admin endpoints allows privilege escalation to administrator.',
    severity: 'High',
  },
];

/**
 * Given findings, suggest chains. Returns [{ name, impact, severity, findings[] }].
 */
export function findChains(findings = []) {
  const chains = [];
  const types = findings.map((f) => String(f.type || '').toLowerCase());

  for (const rule of CHAIN_RULES) {
    const matched = [];
    let allFound = true;
    for (const need of rule.needs) {
      const hit = findings.find((f) =>
        String(f.type || '').toLowerCase().includes(need.toLowerCase()) ||
        String(f.url || '').toLowerCase().includes(need.toLowerCase()) ||
        String(f.evidence || '').toLowerCase().includes(need.toLowerCase())
      );
      if (hit) matched.push(hit);
      else { allFound = false; break; }
    }
    if (allFound && matched.length === rule.needs.length) {
      chains.push({
        name: rule.name,
        impact: rule.impact,
        severity: rule.severity,
        type: 'Vulnerability Chain',
        confidence: 'medium',
        cwe: 'CWE-693', // Protection Mechanism Failure (chain)
        findings: matched.map((f) => f.type),
        evidence: `Chain of ${matched.length} findings: ${matched.map((f) => f.type).join(' + ')}`,
      });
    }
  }
  return chains;
}

export const CHAIN_BUILDER = { findChains, CHAIN_RULES };
export default CHAIN_BUILDER;
