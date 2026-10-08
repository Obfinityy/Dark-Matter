/**
 * dnsEdnsComplianceTester.js — DNS EDNS compliance tester (idea 00520).
 *
 * Evaluates EDNS(0) compliance signals from DNS resolver responses —
 * supported version, buffer size, DO bit handling, truncation behavior —
 * and uses the resulting compliance profile to fingerprint resolver
 * software families. Pure analyzer over observed response metadata;
 * defensive, authorized bug-bounty use.
 */

const VERSION_PATTERNS = {
  supported: /BADVERS|NOERROR/i,
};

/**
 * Build the compliance profile from an EDNS probe exchange.
 * @param {{query: {ednsVersion: number, udpSize: number, doBit: boolean}, response: {rcode: string, ednsVersion: number|null, udpSize: number|null, truncated: boolean, doEchoed: boolean}}} exchange
 * @returns {{compliant: boolean, grade: 'A'|'B'|'C'|'F', signals: string[], downgradeRisk: boolean}}
 */
export function profileEdnsCompliance(exchange = {}) {
  const q = exchange.query || {};
  const r = exchange.response || {};
  const signals = [];
  let gradeScore = 100;

  if (r.ednsVersion === null || r.ednsVersion === undefined) {
    signals.push('No EDNS response version observed; server may ignore EDNS (legacy behavior).');
    gradeScore -= 30;
  } else if (Number(r.ednsVersion) > Number(q.ednsVersion)) {
    signals.push(
      'Server echoed a higher EDNS version than requested; version negotiation anomaly.'
    );
    gradeScore -= 20;
  }

  if (r.truncated === true) {
    signals.push(
      'Response truncated (TC bit); client should retry over TCP — resolver honors truncation.'
    );
  }

  if (q.doBit && r.doEchoed === false) {
    signals.push('DO bit not echoed; DNSSEC responses may be degraded.');
    gradeScore -= 25;
  }

  if (/BADVERS/i.test(String(r.rcode))) {
    signals.push('BADVERS returned for unsupported EDNS version — correct RFC 6891 behavior.');
  }

  if (Number(r.udpSize) > 4096) {
    signals.push(`Large advertised UDP size (${r.udpSize}); fragmentation risk on the path.`);
    gradeScore -= 10;
  }

  const grade = gradeScore >= 90 ? 'A' : gradeScore >= 70 ? 'B' : gradeScore >= 50 ? 'C' : 'F';
  return {
    compliant: gradeScore >= 70,
    grade,
    signals,
    downgradeRisk: gradeScore < 70,
  };
}

/**
 * Fingerprint resolver family from its EDNS behavior fingerprint.
 * @param {{grade: string, signals: string[], udpSizeEchoed: number|null, badversOk: boolean}} profile
 * @returns {{family: string|null, confidence: number, reason: string}}
 */
export function fingerprintResolverByEdns(profile = {}) {
  // EDNS behavior clusters are soft signals; combine into a best-effort label.
  const signals = (profile.signals || []).join(' ');
  let family = null;
  let confidence = 0;
  let reason = '';

  if (profile.badversOk && profile.grade === 'A') {
    family = 'Modern recursive resolver (BIND 9.16+ / Unbound / Knot family)';
    confidence = 0.6;
    reason = 'Correct BADVERS handling and full compliance suggest a current resolver build.';
  } else if (/ignore EDNS/i.test(signals)) {
    family = 'Legacy or minimal resolver (dnsmasq-like / embedded)';
    confidence = 0.55;
    reason = 'EDNS ignored entirely; common in embedded/legacy stacks.';
  } else if (profile.grade === 'F') {
    family = 'Non-compliant resolver';
    confidence = 0.5;
    reason = 'Multiple EDNS compliance failures; treat as fingerprintable anomaly.';
  }

  return { family, confidence, reason };
}

/**
 * Score the resolver for downgrade-attack susceptibility.
 * @param {{grade: string, downgradeRisk: boolean, signals: string[]}} profile
 * @returns {{risk: 'low'|'medium'|'high', notes: string[]}}
 */
export function scoreDowngradeSusceptibility(profile = {}) {
  const notes = [...(profile.signals || [])];
  const risk = profile.grade === 'F' ? 'high' : profile.grade === 'C' ? 'medium' : 'low';
  if (risk !== 'low')
    notes.push('EDNS non-compliance can let an attacker force plaintext/unsigned fallback.');
  return { risk, notes };
}

export const DNS_EDNS_COMPLIANCE_TESTER = {
  profileEdnsCompliance,
  fingerprintResolverByEdns,
  scoreDowngradeSusceptibility,
  VERSION_PATTERNS,
};

export default DNS_EDNS_COMPLIANCE_TESTER;
