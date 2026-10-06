/**
 * llmnrNbnsSurfaceMapper.js — LLMNR/NBNS responder (spoof-surface) mapper.
 *
 * LLMNR (UDP 5355) and NBNS/NetBIOS-NS (UDP 137) responders answer
 * link-local name queries; on networks where they are active, an attacker
 * could spoof responses to redirect authentication. An authorized agent
 * passively observes which hosts answer these queries to map the spoofing
 * surface — no spoofing is performed by this module, ever.
 *
 * Defensive framing: exposure assessment from passively observed multicast/
 * broadcast name-resolution answers during an authorized assessment.
 */

/**
 * Classify one observed name-resolution response.
 *
 * @param {Object} input
 * @param {string} [input.responder] - IP of the host that answered.
 * @param {string} [input.protocol] - 'LLMNR' or 'NBNS'.
 * @param {string} [input.queriedName] - Name that was queried.
 * @param {string} [input.answerType] - Record type answered (A, AAAA, etc.).
 * @param {boolean} [input.authoritative] - Whether the answer claimed authority.
 * @returns {Object} Per-responder classification.
 */
export function classifyResponder({
  responder = '',
  protocol = '',
  queriedName = '',
  answerType = '',
  authoritative = false,
} = {}) {
  const proto = String(protocol).toUpperCase();
  const known = proto === 'LLMNR' || proto === 'NBNS';
  const nameMatches = queriedName && String(queriedName).length > 0;

  return {
    type: 'LLMNR/NBNS Spoof-Surface Mapping',
    responder: responder || 'unknown',
    protocol: proto || 'unknown',
    responds: known && nameMatches,
    confidence: known ? 'high' : 'medium',
    evidence: known
      ? `${proto} responder at ${responder || 'unknown'} answered a query for "${queriedName || 'n/a'}" (${answerType || 'unknown type'}${authoritative ? ', authoritative' : ''}) — this host participates in legacy name resolution and is part of the spoofing surface.`
      : `Response from ${responder || 'unknown'} is not a recognized LLMNR/NBNS answer.`,
  };
}

/**
 * Build a spoof-surface map from a set of observed responders.
 *
 * @param {Array<Object>} observations - Per-response classifyResponder inputs.
 * @returns {Object} Aggregate surface map with hardening guidance.
 */
export function mapSpoofSurface(observations = []) {
  const responders = observations.map((o) => classifyResponder(o)).filter((r) => r.responds);

  const llmnr = responders.filter((r) => r.protocol === 'LLMNR');
  const nbns = responders.filter((r) => r.protocol === 'NBNS');
  const uniqueHosts = [...new Set(responders.map((r) => r.responder))];

  return {
    type: 'LLMNR/NBNS Spoof-Surface Map',
    confidence: 'high',
    llmnrResponderCount: llmnr.length,
    nbnsResponderCount: nbns.length,
    exposedHosts: uniqueHosts,
    evidence: `${uniqueHosts.length} host(s) answer legacy name resolution (LLMNR: ${llmnr.length}, NBNS: ${nbns.length}) — each is a potential spoofing target surface.`,
    hardening: uniqueHosts.length
      ? 'Recommend disabling LLMNR and NetBIOS-NS via Group Policy (or per-host config) on these hosts and ensuring DNS-only resolution.'
      : undefined,
  };
}

export const LLMNR_NBNS_SURFACE_MAPPER = {
  classifyResponder,
  mapSpoofSurface,
};
export default LLMNR_NBNS_SURFACE_MAPPER;
