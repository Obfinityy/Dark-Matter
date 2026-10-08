/**
 * srvRecordIntel.js — SRV-record intelligence for autonomous bug bounty.
 *
 * Implements Dark-Matter idea-bank items 00077–00080 as real, working
 * defensive asset-discovery capabilities for authorized targets:
 *
 *  00077 LDAP SRV record enumeration — query _ldap._tcp SRV records to
 *      discover directory-service hosts in the target's DNS.
 *  00078 Kerberos SRV record harvesting — enumerate _kerberos._tcp and
 *      _kpasswd SRV records to map authentication infrastructure.
 *  00079 SIP SRV record discovery — query _sip._tcp/_udp SRV records to
 *      find VoIP infrastructure tied to the target domain.
 *  00080 XMPP SRV record enumeration — harvest _xmpp-server SRV records
 *      to discover messaging infrastructure.
 *
 * All functions are pure parsers/analyzers: they operate on SRV record
 * data the operator already collected (e.g. from dig) and never perform
 * network I/O.
 */

/** @typedef {object} SrvRecord
 *  @property {string} name      Owner name, e.g. "_ldap._tcp.example.com."
 *  @property {number} priority
 *  @property {number} weight
 *  @property {number} port
 *  @property {string} target    Target host (FQDN)
 */

/** Service query names mapped to the idea that introduced them. */
export const KNOWN_SRV_SERVICES = {
  '_ldap._tcp': { idea: '00077', label: 'LDAP directory service' },
  '_ldaps._tcp': { idea: '00077', label: 'LDAP over TLS' },
  '_kerberos._tcp': { idea: '00078', label: 'Kerberos KDC' },
  '_kerberos._udp': { idea: '00078', label: 'Kerberos KDC (UDP)' },
  '_kpasswd._tcp': { idea: '00078', label: 'Kerberos password change' },
  '_kpasswd._udp': { idea: '00078', label: 'Kerberos password change (UDP)' },
  '_sip._tcp': { idea: '00079', label: 'SIP VoIP (TCP)' },
  '_sip._udp': { idea: '00079', label: 'SIP VoIP (UDP)' },
  '_sips._tcp': { idea: '00079', label: 'SIP over TLS' },
  '_xmpp-server._tcp': { idea: '00080', label: 'XMPP server-to-server' },
  '_xmpp-client._tcp': { idea: '00080', label: 'XMPP client-to-server' },
};

/**
 * Parse one dig-style SRV answer line:
 *   _ldap._tcp.example.com. 300 IN SRV 0 100 389 ldap1.example.com.
 *
 * Also accepts a pre-split object with the same fields.
 *
 * @param {string|object} line
 * @returns {SrvRecord|null}
 */
export function parseSrvLine(line) {
  if (line && typeof line === 'object') {
    return {
      name: String(line.name || ''),
      priority: Number(line.priority) || 0,
      weight: Number(line.weight) || 0,
      port: Number(line.port) || 0,
      target: String(line.target || '').replace(/\.$/, ''),
    };
  }
  if (typeof line !== 'string') return null;
  const m = line.trim().match(/^(\S+)\s+\d+\s+IN\s+SRV\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\.?$/i);
  if (!m) return null;
  return {
    name: m[1].replace(/\.$/, ''),
    priority: Number(m[2]),
    weight: Number(m[3]),
    port: Number(m[4]),
    target: m[5].replace(/\.$/, ''),
  };
}

/**
 * Parse a batch of SRV lines, dropping unparsable ones.
 *
 * @param {Array<string|object>} lines
 * @returns {SrvRecord[]}
 */
export function parseSrvBatch(lines) {
  const out = [];
  for (const line of lines || []) {
    const rec = parseSrvLine(line);
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * Split an SRV owner name into its service and proto labels plus domain.
 *
 * @param {string} name
 * @returns {{service: string|null, proto: string|null, domain: string}}
 */
export function splitSrvName(name) {
  const labels = String(name || '')
    .replace(/\.$/, '')
    .split('.');
  if (labels.length < 3 || !labels[0].startsWith('_')) {
    return { service: null, proto: null, domain: labels.join('.') };
  }
  return {
    service: labels[0],
    proto: labels[1].startsWith('_') ? labels[1] : null,
    domain: labels.slice(2).join('.'),
  };
}

/**
 * Harvest SRV records into per-service host inventories.
 *
 * @param {SrvRecord[]} records
 * @param {string[]} [services]  Service keys like "_ldap._tcp"; defaults to all known
 * @returns {Record<string, {label: string, idea: string, hosts: SrvRecord[], uniqueTargets: string[]}>}
 */
export function harvestServiceHosts(records, services = Object.keys(KNOWN_SRV_SERVICES)) {
  const wanted = new Set(services.map(s => s.toLowerCase()));
  const out = {};
  for (const rec of records || []) {
    const { service, proto } = splitSrvName(rec.name);
    if (!service) continue;
    const key = (service + (proto ? '.' + proto : '')).toLowerCase();
    if (!wanted.has(key)) continue;
    if (!KNOWN_SRV_SERVICES[key]) continue;
    if (!out[key]) {
      out[key] = {
        label: KNOWN_SRV_SERVICES[key].label,
        idea: KNOWN_SRV_SERVICES[key].idea,
        hosts: [],
        uniqueTargets: [],
      };
    }
    out[key].hosts.push(rec);
    if (rec.target && !out[key].uniqueTargets.includes(rec.target)) {
      out[key].uniqueTargets.push(rec.target);
    }
  }
  for (const k of Object.keys(out)) out[k].uniqueTargets.sort();
  return out;
}

/**
 * Analyze SRV topology for resilience and configuration findings:
 *  - single-target services (no redundancy) are flagged;
 *  - non-standard ports are flagged;
 *  - targets shared across services are reported (shared-fate hosts).
 *
 * @param {SrvRecord[]} records
 * @returns {Array<{severity: 'info'|'warning', service: string, finding: string, detail: string}>}
 */
export function analyzeSrvTopology(records) {
  const findings = [];
  const byService = harvestServiceHosts(records);
  const targetToServices = new Map();

  const DEFAULT_PORTS = {
    '_ldap._tcp': 389,
    '_ldaps._tcp': 636,
    '_kerberos._tcp': 88,
    '_kerberos._udp': 88,
    '_kpasswd._tcp': 464,
    '_kpasswd._udp': 464,
    '_sip._tcp': 5060,
    '_sip._udp': 5060,
    '_sips._tcp': 5061,
    '_xmpp-server._tcp': 5269,
    '_xmpp-client._tcp': 5222,
  };

  for (const [key, svc] of Object.entries(byService)) {
    if (svc.uniqueTargets.length === 1) {
      findings.push({
        severity: 'warning',
        service: key,
        finding: 'single point of failure',
        detail: `only one target (${svc.uniqueTargets[0]}) advertises ${svc.label}`,
      });
    }
    const expected = DEFAULT_PORTS[key];
    for (const h of svc.hosts) {
      if (expected && h.port !== expected) {
        findings.push({
          severity: 'info',
          service: key,
          finding: 'non-standard port',
          detail: `${h.target} advertises port ${h.port} (expected ${expected})`,
        });
      }
    }
    for (const t of svc.uniqueTargets) {
      if (!targetToServices.has(t)) targetToServices.set(t, []);
      targetToServices.get(t).push(key);
    }
  }

  for (const [target, svcs] of targetToServices) {
    if (svcs.length > 1) {
      findings.push({
        severity: 'info',
        service: svcs.join(', '),
        finding: 'shared infrastructure host',
        detail: `${target} serves ${svcs.length} SRV-advertised services`,
      });
    }
  }
  return findings;
}

/**
 * Build a merged authentication-infrastructure view from LDAP + Kerberos
 * SRV data (ideas 00077 + 00078 combined).
 *
 * @param {SrvRecord[]} records
 * @returns {{
 *   directoryHosts: string[],
 *   kdcHosts: string[],
 *   kpasswdHosts: string[],
 *   sharedHosts: string[],
 * }}
 */
export function buildAuthInfraMap(records) {
  const harvested = harvestServiceHosts(records, [
    '_ldap._tcp',
    '_ldaps._tcp',
    '_kerberos._tcp',
    '_kerberos._udp',
    '_kpasswd._tcp',
    '_kpasswd._udp',
  ]);
  const pick = keys => {
    const set = new Set();
    for (const k of keys) for (const t of harvested[k]?.uniqueTargets || []) set.add(t);
    return [...set].sort();
  };
  const directoryHosts = pick(['_ldap._tcp', '_ldaps._tcp']);
  const kdcHosts = pick(['_kerberos._tcp', '_kerberos._udp']);
  const kpasswdHosts = pick(['_kpasswd._tcp', '_kpasswd._udp']);
  const all = new Set([...directoryHosts, ...kdcHosts, ...kpasswdHosts]);
  const sharedHosts = [...all].filter(
    h => [directoryHosts, kdcHosts, kpasswdHosts].filter(l => l.includes(h)).length > 1
  );
  return { directoryHosts, kdcHosts, kpasswdHosts, sharedHosts };
}
