/**
 * clientaccesspolicyMiner.js — Clientaccesspolicy.xml domain mining (idea 00111).
 *
 * Legacy Silverlight clientaccesspolicy.xml files linger on old IIS hosts and
 * enumerate the exact domains allowed to make cross-domain requests. The host
 * itself is a candidate legacy surface; each listed domain is a trust
 * relationship worth reviewing during an authorized engagement.
 *
 * Pure functions: parse a fetched policy document into domains.
 */

const DOMAIN_RE = /<domain\b[^>]*?(?:uri|domain)\s*=\s*"([^"]+)"/gi;

/**
 * Extract allowed domains from a clientaccesspolicy.xml body.
 * @param {string} xml — raw policy document
 * @returns {{ found: boolean, domains: string[], allowCredentials: boolean, notes: string[] }}
 */
export function parseClientAccessPolicy(xml = '') {
  const notes = [];
  if (typeof xml !== 'string' || !xml.includes('<access-policy')) {
    return {
      found: false,
      domains: [],
      allowCredentials: false,
      notes: ['Not a clientaccesspolicy.xml document'],
    };
  }

  const domains = new Set();
  let m;
  while ((m = DOMAIN_RE.exec(xml)) !== null) {
    const d = m[1].trim();
    if (d) domains.add(d);
  }

  const allowCredentials = /allow-credentials\s*=\s*"?true"?/i.test(xml);

  if (domains.has('*')) {
    notes.push(
      'Wildcard domain grants cross-domain access to ANY origin — review authorization scope.'
    );
  }
  if (domains.size === 0) {
    notes.push(
      'Policy present but no domain attributes found — may deny all cross-domain requests.'
    );
  }

  return {
    found: true,
    domains: [...domains],
    allowCredentials,
    notes,
  };
}

/**
 * Build the canonical policy URL for a host.
 * @param {string} host — e.g. "legacy.example.com"
 * @returns {string}
 */
export function clientAccessPolicyUrl(host) {
  const clean = String(host)
    .replace(/^https?:\/\//, '')
    .split('/')[0];
  return `https://${clean}/clientaccesspolicy.xml`;
}

/**
 * Score how interesting a policy is for further recon.
 * @param {object} parsed — output of parseClientAccessPolicy
 * @returns {{ score: number, reasons: string[] }} score 0-100
 */
export function scorePolicy(parsed) {
  let score = 10; // policy file exists → legacy stack confirmed
  const reasons = ['Legacy Silverlight policy file present (legacy IIS stack indicator)'];
  if (parsed.domains.includes('*')) {
    score += 45;
    reasons.push('Wildcard cross-domain grant');
  } else if (parsed.domains.length > 0) {
    score += parsed.domains.length * 5;
    reasons.push(`${parsed.domains.length} trusted domain(s) enumerated`);
  }
  if (parsed.allowCredentials) {
    score += 20;
    reasons.push('allow-credentials enabled');
  }
  return { score: Math.min(score, 100), reasons };
}

export const CLIENTACCESSPOLICY_MINER = {
  parseClientAccessPolicy,
  clientAccessPolicyUrl,
  scorePolicy,
};
export default CLIENTACCESSPOLICY_MINER;
