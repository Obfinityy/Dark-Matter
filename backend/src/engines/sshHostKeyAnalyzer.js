/**
 * sshHostKeyAnalyzer.js — SSH host-key algorithm list analyzer.
 *
 * Analyzes the ordered server_host_key_algorithms name-list from a captured
 * SSH_MSG_KEXINIT packet to infer the server's era and hardening posture:
 * legacy (ssh-dss / SHA-1 rsa), transitional (rsa + ecdsa), or modern
 * (ssh-ed25519 preferred), plus certificate and post-quantum signals.
 *
 * Pure analysis of captured data only — no connections are made here.
 */

const LEGACY_ALGORITHMS = ['ssh-dss'];
const SHA1_RSA_ALGORITHMS = ['ssh-rsa', 'rsa-sha2-256', 'rsa-sha2-512'];
const ECDSA_ALGORITHMS = [
  'ecdsa-sha2-nistp256',
  'ecdsa-sha2-nistp384',
  'ecdsa-sha2-nistp521',
];
const MODERN_ALGORITHMS = [
  'ssh-ed25519',
  'sk-ssh-ed25519@openssh.com',
  'sk-ecdsa-sha2-nistp256@openssh.com',
];
const POST_QUANTUM_PREFIXES = ['sntrup761x25519-sha512', 'mlkem768x25519-sha256'];

/**
 * Classify a single host-key algorithm token.
 * @param {string} algo
 * @returns {'legacy-dss'|'sha1-rsa'|'sha2-rsa'|'ecdsa'|'ed25519'|'cert'|'post-quantum'|'unknown'}
 */
function classifyAlgorithm(algo = '') {
  const a = String(algo).trim();
  if (LEGACY_ALGORITHMS.includes(a)) return 'legacy-dss';
  if (a === 'ssh-rsa') return 'sha1-rsa';
  if (a === 'rsa-sha2-256' || a === 'rsa-sha2-512') return 'sha2-rsa';
  if (ECDSA_ALGORITHMS.includes(a)) return 'ecdsa';
  if (MODERN_ALGORITHMS.includes(a)) return 'ed25519';
  if (a.endsWith('-cert-v01@openssh.com')) return 'cert';
  if (POST_QUANTUM_PREFIXES.some((p) => a.startsWith(p))) return 'post-quantum';
  return 'unknown';
}

/**
 * Analyze an ordered list of host-key algorithms offered by a server.
 *
 * @param {string[]} algorithms — ordered server_host_key_algorithms list from captured KEXINIT.
 * @returns {{ era: 'legacy'|'transitional'|'modern'|'unknown', hostKeyTypes: string[], findings: object[], confidence: 'high'|'medium'|'low' }}
 */
export function analyzeHostKeyAlgorithms(algorithms = []) {
  const list = (Array.isArray(algorithms) ? algorithms : []).map((a) => String(a).trim()).filter(Boolean);
  const hostKeyTypes = list.map(classifyAlgorithm);

  const hasDss = hostKeyTypes.includes('legacy-dss');
  const hasSha1Rsa = hostKeyTypes.includes('sha1-rsa');
  const hasSha2Rsa = hostKeyTypes.includes('sha2-rsa');
  const hasEcdsa = hostKeyTypes.includes('ecdsa');
  const hasEd25519 = hostKeyTypes.includes('ed25519');
  const hasCert = hostKeyTypes.includes('cert');
  const hasPQ = hostKeyTypes.includes('post-quantum');
  const firstIsEd25519 = list.length > 0 && classifyAlgorithm(list[0]) === 'ed25519';

  let era = 'unknown';
  let confidence = 'low';
  if (hasDss && !hasEd25519) {
    era = 'legacy';
    confidence = 'high';
  } else if (firstIsEd25519 || (hasEd25519 && !hasDss && !hasSha1Rsa)) {
    era = 'modern';
    confidence = 'high';
  } else if (hasSha2Rsa || hasEcdsa || hasEd25519 || hasCert) {
    era = 'transitional';
    confidence = 'medium';
  } else if (list.length === 0) {
    era = 'unknown';
    confidence = 'low';
  } else {
    era = 'legacy';
    confidence = 'medium';
  }

  const findings = [];

  if (hasDss) {
    findings.push({
      type: 'ssh-dss host key offered',
      severity: 'High',
      confidence: 'high',
      evidence: `ssh-dss present in offered list: [${list.join(', ')}] — DSS keys were deprecated in OpenSSH 7.0 (2015).`,
      recommendation: 'Server is very old or misconfigured; retire ssh-dss from HostKeyAlgorithms.',
    });
  }
  if (hasSha1Rsa) {
    findings.push({
      type: 'SHA-1 ssh-rsa host key offered',
      severity: 'Medium',
      confidence: 'high',
      evidence: 'ssh-rsa (SHA-1 signature) offered — vulnerable to chosen-prefix collision forgery in principle.',
      recommendation: 'Prefer rsa-sha2-256/512 or ssh-ed25519; disable plain ssh-rsa if the client base allows.',
    });
  }
  if (!hasEd25519 && list.length > 0) {
    findings.push({
      type: 'No ssh-ed25519 offered',
      severity: 'Info',
      confidence: 'medium',
      evidence: 'ed25519 absent — server predates the OpenSSH 6.5 era (2014) or has it disabled.',
      recommendation: 'Enable ssh-ed25519 for a smaller, faster, modern host key.',
    });
  }
  if (firstIsEd25519) {
    findings.push({
      type: 'ssh-ed25519 preferred first',
      severity: 'Info',
      confidence: 'high',
      evidence: 'ssh-ed25519 is the first offered algorithm — modern, well-ordered configuration.',
      recommendation: 'None — posture is good; keep legacy algorithms disabled.',
    });
  }
  if (hasCert) {
    findings.push({
      type: 'OpenSSH certificate host keys offered',
      severity: 'Info',
      confidence: 'high',
      evidence: '*-cert-v01@openssh.com algorithms present — server supports certificate-based host authentication.',
      recommendation: 'Certificates simplify fleet key management; verify CA practices before trusting them.',
    });
  }
  if (hasPQ) {
    findings.push({
      type: 'Post-quantum hybrid host key offered',
      severity: 'Info',
      confidence: 'medium',
      evidence: 'sntrup761/mlkem hybrid algorithm present — server experiments with quantum-resistant keys.',
      recommendation: 'Track for compatibility; hybrids are still pre-standard on some stacks.',
    });
  }
  if (hostKeyTypes.includes('unknown') && list.length > 0) {
    const unknowns = list.filter((a) => classifyAlgorithm(a) === 'unknown');
    findings.push({
      type: 'Unrecognized host-key algorithms',
      severity: 'Info',
      confidence: 'low',
      evidence: `Unknown tokens: ${unknowns.join(', ')} — possibly vendor-proprietary extensions.`,
      recommendation: 'Cross-check against vendor documentation; proprietary algorithms warrant extra scrutiny.',
    });
  }

  return { era, hostKeyTypes, findings, confidence };
}

export const SSH_HOST_KEY_ANALYZER = { analyzeHostKeyAlgorithms };
export default SSH_HOST_KEY_ANALYZER;
