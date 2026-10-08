/**
 * sniDiscoverer.js — SNI-based virtual-host discovery analysis.
 *
 * When many TLS virtual hosts share one IP, sending different SNI values in
 * the handshake reveals which hostnames the server actually terminates — no
 * DNS enumeration needed. This module takes the per-SNI probe results
 * (already collected) and:
 *   - identifies which SNIs return a matching certificate (real vhosts) vs a
 *     default/fallback certificate (not hosted),
 *   - builds candidate SNI lists from observed naming patterns,
 *   - flags wildcard and default-vhost behavior.
 * Pure analysis: takes collected handshake results as input, no network I/O.
 */

/** Normalize a hostname for comparison. */
export function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
}

/** Check whether a certificate SAN list covers a given SNI value. */
export function sanCoversSni(sans = [], sni) {
  const target = normalizeHost(sni);
  const labels = target.split('.');
  for (const raw of sans || []) {
    const san = normalizeHost(raw);
    if (san === target) return true;
    if (san.startsWith('*.')) {
      const suffix = san.slice(2).split('.');
      // Wildcard covers exactly one label: *.example.com matches a.example.com
      if (labels.length === suffix.length + 1 && labels.slice(1).join('.') === suffix.join('.'))
        return true;
    }
  }
  return false;
}

/** Fingerprint a certificate for grouping (issuer + serial-ish fields). */
export function certIdentity(cert = {}) {
  return [
    normalizeHost(cert.issuer || ''),
    normalizeHost(cert.subject || ''),
    cert.serialNumber || cert.serial || '',
  ].join('|');
}

/**
 * Analyze per-SNI probe results to enumerate real virtual hosts on one IP.
 *
 * @param {Object} args
 * @param {Array<Object>} args.probes - One entry per attempted SNI:
 *   { sni, connected, cert: { subject, issuer, serialNumber, sans }, ja4s }
 * @returns {{vhosts: Array, defaultVhost: Object|null, wildcard: Object|null, summary: Object}}
 */
export function discoverVhosts({ probes = [] } = {}) {
  const usable = probes.filter(p => p && p.connected && p.cert);
  const groups = new Map();
  for (const p of usable) {
    const id = certIdentity(p.cert);
    if (!groups.has(id)) groups.set(id, { cert: p.cert, snis: [] });
    groups.get(id).snis.push(p.sni);
  }

  const vhosts = [];
  let defaultVhost = null;
  const certGroups = [...groups.values()];

  // The default vhost is the certificate served for SNIs it does not cover.
  for (const g of certGroups) {
    const uncovered = g.snis.filter(s => !sanCoversSni(g.cert.sans || [], s));
    const covered = g.snis.filter(s => sanCoversSni(g.cert.sans || [], s));
    if (uncovered.length > 0 && covered.length === 0) {
      defaultVhost = {
        cert: g.cert,
        probedWith: g.snis,
        confidence: 'high',
        evidence: `Certificate served for ${g.snis.length} SNI(s) it does not cover — default/fallback vhost.`,
      };
    } else if (covered.length > 0) {
      vhosts.push({
        cert: g.cert,
        hostnames: covered,
        confidence: 'high',
        evidence: `Certificate SANs cover ${covered.join(', ')}.`,
      });
    }
  }

  // Wildcard detection: one cert covering many distinct probed hostnames.
  let wildcard = null;
  for (const g of certGroups) {
    const wildcards = (g.cert.sans || []).filter(s => normalizeHost(s).startsWith('*.'));
    if (wildcards.length && g.snis.length >= 3) {
      wildcard = { cert: g.cert, patterns: wildcards, probedCount: g.snis.length };
    }
  }

  // JA4S divergence: same IP returning different server stacks per SNI
  // suggests SNI-based routing to different backends.
  const ja4sSet = new Set(usable.map(p => p.ja4s).filter(Boolean));
  const divergentStacks = ja4sSet.size > 1;

  return {
    vhosts,
    defaultVhost,
    wildcard,
    summary: {
      ipProbedSnis: probes.length,
      successfulHandshakes: usable.length,
      confirmedVhosts: vhosts.length,
      defaultVhostDetected: !!defaultVhost,
      wildcardDetected: !!wildcard,
      divergentServerStacks: divergentStacks,
      uniqueStacks: ja4sSet.size,
    },
  };
}

/**
 * Build candidate SNI values from observed naming patterns for further probing.
 * Expands a seed hostname with common prefixes/subdomain mutations.
 *
 * @param {string} seedHost - e.g. "app.example.com"
 * @param {Array<string>} [extraPrefixes] - additional prefixes to try
 * @returns {Array<string>} candidate hostnames
 */
export function buildSniCandidates(seedHost, extraPrefixes = []) {
  const seed = normalizeHost(seedHost);
  if (!seed) return [];
  const parts = seed.split('.');
  const domain = parts.slice(-2).join('.');
  const sub = parts.slice(0, -2).join('.');

  const prefixes = [
    'www',
    'api',
    'admin',
    'dev',
    'staging',
    'test',
    'portal',
    'app',
    'vpn',
    'mail',
    'ftp',
    'blog',
    'shop',
    'cdn',
    'static',
    'assets',
    'internal',
    'beta',
    'demo',
    'old',
    'new',
    'secure',
    'login',
    'auth',
    'sso',
    ...extraPrefixes,
  ];

  const candidates = new Set();
  for (const p of prefixes) {
    candidates.add(`${p}.${domain}`);
    if (sub) candidates.add(`${p}.${sub}.${domain}`);
  }
  // Subdomain mutation: strip leading numeric/dash suffixes, try alternates.
  if (sub) {
    const base = sub.replace(/[-_]?(\d+)$/, '');
    if (base && base !== sub) candidates.add(`${base}.${domain}`);
  }
  candidates.delete(seed);
  return [...candidates].sort();
}

export const SNI_DISCOVERER = { discoverVhosts, buildSniCandidates, sanCoversSni, normalizeHost };
export default SNI_DISCOVERER;
