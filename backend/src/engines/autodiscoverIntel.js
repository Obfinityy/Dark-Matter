/**
 * autodiscoverIntel.js — Autodiscover record probing (idea 00081).
 *
 * Defensive mail-client configuration endpoint discovery for an authorized
 * bug-bounty agent. Autodiscover is the protocol mail clients (Outlook,
 * Thunderbird, mobile apps) use to bootstrap Exchange / Office 365 /
 * IMAP-SMTP settings. Probing the `_autodiscover._tcp` SRV record and the
 * well-known `autodiscover.<domain>` / `autoconfig.<domain>` hostnames maps
 * the mail ingress footprint: endpoints worth TLS, auth-policy and
 * misconfiguration review during an authorized assessment.
 *
 * All lookups run against operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/**
 * Known Autodiscover/Autoconfig hostname prefixes, in client lookup order.
 * @type {string[]}
 */
export const AUTODISCOVER_NAMES = [
  'autodiscover',
  'autoconfig',
  'mail',
  'webmail',
  'exchange',
  'owa',
  'outlook',
  'mapi',
];

/**
 * Parse a DNS SRV record entry into a normalized service endpoint object.
 * Accepts the Node `dns.promises.Resolver#resolveSrv` shape
 * { name, port, priority, weight }.
 *
 * @param {{name?:string, port?:number, priority?:number, weight?:number}|string} record
 * @returns {{target:string, port:number, priority:number, weight:number}|null}
 */
export function parseSrvRecord(record) {
  if (record && typeof record === 'object') {
    return {
      target: String(record.name || record.target || '')
        .replace(/\.$/, '')
        .toLowerCase(),
      port: Number(record.port) || 0,
      priority: Number(record.priority) || 0,
      weight: Number(record.weight) || 0,
    };
  }
  // Textual form: "0 0 443 autodiscover.example.com."
  const m = String(record || '')
    .trim()
    .match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)$/);
  if (!m) return null;
  return {
    target: m[4].replace(/\.$/, '').toLowerCase(),
    port: Number(m[3]),
    priority: Number(m[1]),
    weight: Number(m[2]),
  };
}

/**
 * Idea 00081 — probe `_autodiscover._tcp` SRV records for a domain.
 *
 * Returns the sorted SRV targets (priority, then weight) with a defensive
 * assessment note per target: each target is a mail-client configuration
 * endpoint the assessment scope should cover for TLS and auth-policy review.
 *
 * @param {string} domain e.g. "example.com"
 * @returns {Promise<{domain:string, records:Array<{target:string,port:number,priority:number,weight:number}>, found:boolean, notes:string[]}>}
 */
export async function probeAutodiscoverSrv(domain) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const notes = [];
  let records = [];
  try {
    const raw = await resolver.resolveSrv(`_autodiscover._tcp.${d}`);
    records = raw
      .map(parseSrvRecord)
      .filter(Boolean)
      .sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  } catch (err) {
    if (err && err.code !== 'ENODATA' && err.code !== 'ENOTFOUND' && err.code !== 'SERVFAIL')
      throw err;
  }
  if (records.length === 0) {
    notes.push(
      'No _autodiscover._tcp SRV record — mail clients fall back to HTTPS autodiscover hosts.'
    );
  } else {
    notes.push(
      `SRV exposes ${records.length} mail-client endpoint(s); include each target in TLS and authentication-policy review.`
    );
    const port443 = records.filter(r => r.port === 443);
    if (port443.length)
      notes.push(
        `${port443.length} target(s) serve Autodiscover over HTTPS — check for NTLM/NTLMv2 or basic-auth exposure on /autodiscover/autodiscover.xml.`
      );
  }
  return { domain: d, records, found: records.length > 0, notes };
}

/**
 * Probe the well-known Autodiscover/Autoconfig hostnames for a domain and
 * return the ones that resolve (A/AAAA). These hostnames serve
 * /autodiscover/autodiscover.xml, /mail/config-v1.1.xml or similar bootstrap
 * documents and are in scope for configuration-review probing.
 *
 * @param {string} domain e.g. "example.com"
 * @param {string[]} [names] hostname prefixes to try
 * @returns {Promise<Array<{hostname:string, addresses:string[]}>>} resolvable hostnames
 */
export async function probeAutodiscoverHosts(domain, names = AUTODISCOVER_NAMES) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const hits = [];
  await Promise.all(
    names.map(async n => {
      const hostname = `${n}.${d}`;
      try {
        const addrs = await resolver.resolve(hostname);
        hits.push({ hostname, addresses: addrs });
      } catch {
        /* not resolvable — not a finding */
      }
    })
  );
  return hits.sort((a, b) => a.hostname.localeCompare(b.hostname));
}

/**
 * Build the full Autodiscover attack-surface map for a domain: SRV records
 * plus resolvable well-known hostnames, each annotated with the assessment
 * notes a hunter needs next.
 *
 * @param {string} domain
 * @returns {Promise<{domain:string, srv:ReturnType<typeof probeAutodiscoverSrv>, hosts:Array, summary:string[]}>}
 */
export async function mapAutodiscoverSurface(domain) {
  const [srv, hosts] = await Promise.all([
    probeAutodiscoverSrv(domain),
    probeAutodiscoverHosts(domain),
  ]);
  const summary = [...srv.notes];
  if (hosts.length > 0) {
    summary.push(
      `${hosts.length} autodiscover-style hostname(s) resolve: ${hosts.map(h => h.hostname).join(', ')} — enumerate their config endpoints for TLS and credential-transport review.`
    );
  } else {
    summary.push(
      'No autodiscover-style hostnames resolve — mail bootstrap is external (e.g. Office 365 / Google Workspace) or unpublished.'
    );
  }
  return { domain: String(domain).toLowerCase().replace(/\.$/, ''), srv, hosts, summary };
}
