/**
 * whoisGraphIntel.js — WHOIS/RDAP intelligence engine for defensive asset discovery.
 *
 * Covers idea-bank items 00031-00033:
 *  - 00031 WHOIS creation-date clustering: group domains by identical creation
 *    timestamps + registrar to spot bulk-registered campaign domains.
 *  - 00032 WHOIS nameserver-sharing graph: build a domain graph from shared
 *    (especially custom) nameservers to uncover related properties on the same
 *    DNS infrastructure.
 *  - 00033 RDAP history chain traversal: walk RDAP entity history and status
 *    changes to find previously associated domains and abandoned-but-still-
 *    resolving assets.
 *
 * All functions are pure: they take already-fetched WHOIS/RDAP data as input
 * and perform analysis. They never query registries themselves, so callers
 * control rate limits against public RDAP/WHOIS endpoints.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize a registrar name so trivial variants group together.
 * @param {string} name raw registrar string from WHOIS/RDAP
 * @returns {string} normalized key
 */
export function normalizeRegistrar(name) {
  if (!name) return 'unknown';
  return String(name)
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|pty|gmbh|sarl|sas|spa)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse the many WHOIS timestamp formats into a Date (or null).
 * Handles ISO 8601, `YYYY-MM-DD`, `DD-Mon-YYYY`, and epoch seconds/ms.
 * @param {string|number} value raw creation-date value
 * @returns {Date|null}
 */
export function parseWhoisTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value; // epoch seconds vs ms
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // DD-Mon-YYYY (e.g. "12-Jan-2021")
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (m) {
    d = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Cluster domains by identical creation date (+ optional registrar).
 * Bulk-registered campaign domains usually share the exact creation day and
 * registrar; clusters of size >= minClusterSize are campaign candidates.
 *
 * @param {{domain: string, creationDate: string|number|Date, registrar?: string}[]} records
 * @param {{minClusterSize?: number, windowDays?: number, groupByRegistrar?: boolean}} [options]
 * @returns {{key: string, date: string, registrar: string, size: number, domains: string[]}[]} largest clusters first
 */
export function clusterByCreationDate(records = [], options = {}) {
  const { minClusterSize = 2, windowDays = 0, groupByRegistrar = true } = options;
  const groups = new Map();

  for (const rec of records || []) {
    const date = parseWhoisTimestamp(rec?.creationDate);
    if (!date) continue;
    let day = date.toISOString().slice(0, 10);
    if (windowDays > 0) {
      // Snap into N-day windows so near-identical registrations group.
      const bucket = Math.floor(date.getTime() / (windowDays * DAY_MS));
      day = `window-${bucket}`;
    }
    const registrar = groupByRegistrar ? normalizeRegistrar(rec?.registrar) : 'any';
    const key = `${day}|${registrar}`;
    if (!groups.has(key)) {
      groups.set(key, { key, date: day, registrar, domains: [] });
    }
    const domain = String(rec?.domain || '')
      .toLowerCase()
      .trim();
    if (domain && !groups.get(key).domains.includes(domain)) {
      groups.get(key).domains.push(domain);
    }
  }

  return [...groups.values()]
    .filter(g => g.domains.length >= minClusterSize)
    .sort((a, b) => b.domains.length - a.domains.length)
    .map(g => ({
      key: g.key,
      date: g.date,
      registrar: g.registrar,
      size: g.domains.length,
      domains: [...g.domains],
    }));
}

/**
 * Check whether a nameserver looks custom (ns1.example.com) vs provider
 * default (awsdns, cloudflare, godaddy, ...).
 * @param {string} nameserver
 * @param {string} [domain] the target domain; NS under it counts as custom
 * @returns {boolean}
 */
export function isCustomNameserver(nameserver, domain = '') {
  const ns = String(nameserver || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!ns) return false;
  const d = String(domain || '').toLowerCase();
  if (d && (ns === d || ns.endsWith(`.${d}`))) return true;
  const providerPatterns = [
    /awsdns/i,
    /cloudflare/i,
    /godaddy/i,
    /namecheap/i,
    /dnsmadeeasy/i,
    /digitalocean/i,
    /linode/i,
    /azure-dns/i,
    /googledomains/i,
    /verisign/i,
    /registrar-servers/i,
    /domaincontrol\.com/i,
    /ns\d+\.worldnic/i,
  ];
  return !providerPatterns.some(p => p.test(ns));
}

/**
 * Build a domain graph from shared nameservers.
 * Domains sharing the target's *custom* nameservers are the strongest signal
 * of related properties on the same DNS infrastructure.
 *
 * @param {{domain: string, nameservers: string[]}[]} records
 * @param {string} targetDomain the authorized hunt target
 * @returns {{
 *   nodes: {domain: string, nameservers: string[]}[],
 *   nameserverIndex: Record<string, string[]>,
 *   edges: {from: string, to: string, nameserver: string, custom: boolean}[],
 *   relatedToTarget: {domain: string, sharedNameservers: string[], sharedCustom: boolean}[]
 * }}
 */
export function buildNameserverGraph(records = [], targetDomain = '') {
  const target = String(targetDomain || '')
    .toLowerCase()
    .trim();
  const nodes = (records || [])
    .map(r => ({
      domain: String(r?.domain || '')
        .toLowerCase()
        .trim(),
      nameservers: [
        ...new Set((r?.nameservers || []).map(n => String(n).toLowerCase().replace(/\.$/, ''))),
      ],
    }))
    .filter(n => n.domain);

  const nameserverIndex = {};
  for (const node of nodes) {
    for (const ns of node.nameservers) {
      (nameserverIndex[ns] = nameserverIndex[ns] || []).push(node.domain);
    }
  }

  const edges = [];
  const seenPairs = new Set();
  for (const [ns, domains] of Object.entries(nameserverIndex)) {
    const uniq = [...new Set(domains)];
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const pairKey = [uniq[i], uniq[j]].sort().join('|') + '|' + ns;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        edges.push({
          from: uniq[i],
          to: uniq[j],
          nameserver: ns,
          custom: isCustomNameserver(ns, target),
        });
      }
    }
  }

  const targetNode = nodes.find(n => n.domain === target);
  const relatedToTarget = [];
  if (targetNode) {
    for (const node of nodes) {
      if (node.domain === target) continue;
      const shared = node.nameservers.filter(ns => targetNode.nameservers.includes(ns));
      if (shared.length > 0) {
        relatedToTarget.push({
          domain: node.domain,
          sharedNameservers: shared,
          sharedCustom: shared.some(ns => isCustomNameserver(ns, target)),
        });
      }
    }
    relatedToTarget.sort((a, b) => Number(b.sharedCustom) - Number(a.sharedCustom));
  }

  return { nodes, nameserverIndex, edges, relatedToTarget };
}

/**
 * Walk RDAP entity history for a set of domains.
 * Flags status transitions (e.g. active -> inactive/pendingDelete), extracts
 * previously associated domains from entity linkages, and surfaces abandoned-
 * but-still-resolving assets (dangling infrastructure takeover candidates).
 *
 * @param {{
 *   domain: string,
 *   status?: string[],
 *   events?: {eventAction: string, eventDate: string}[],
 *   nameServers?: string[],
 *   resolves?: boolean,
 *   relatedDomains?: {domain: string, relation: string}[]
 * }[]} entries
 * @returns {{
 *   timelines: Record<string, {action: string, date: string}[]>,
 *   statusTransitions: {domain: string, from: string, to: string, date: string}[],
 *   previouslyAssociated: {domain: string, via: string, relation: string}[],
 *   abandonedButResolving: {domain: string, status: string[], nameServers: string[]}[]
 * }}
 */
export function traverseRdapHistory(entries = []) {
  const timelines = {};
  const statusTransitions = [];
  const previouslyAssociated = [];
  const abandonedButResolving = [];
  const INACTIVE_MARKERS = [
    'inactive',
    'pendingdelete',
    'pending delete',
    'redemptionperiod',
    'clienthold',
    'serverhold',
  ];

  for (const entry of entries || []) {
    const domain = String(entry?.domain || '')
      .toLowerCase()
      .trim();
    if (!domain) continue;

    const events = (entry?.events || [])
      .map(e => ({ action: String(e?.eventAction || 'unknown'), date: String(e?.eventDate || '') }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    timelines[domain] = events;

    // Derive status transitions from explicit status-change events where present.
    for (const e of events) {
      const m = e.action.match(/status[:\s-]+(.+?)\s*(?:->|to)\s*(.+)/i);
      if (m) {
        statusTransitions.push({
          domain,
          from: m[1].trim().toLowerCase(),
          to: m[2].trim().toLowerCase(),
          date: e.date,
        });
      }
    }

    for (const rel of entry?.relatedDomains || []) {
      const rd = String(rel?.domain || '')
        .toLowerCase()
        .trim();
      if (rd && rd !== domain) {
        previouslyAssociated.push({
          domain: rd,
          via: domain,
          relation: String(rel?.relation || 'associated'),
        });
      }
    }

    const statuses = (entry?.status || []).map(s => String(s).toLowerCase());
    const looksAbandoned = statuses.some(s => INACTIVE_MARKERS.some(m => s.includes(m)));
    if (looksAbandoned && entry?.resolves === true) {
      abandonedButResolving.push({
        domain,
        status: entry.status,
        nameServers: entry?.nameServers || [],
      });
    }
  }

  return { timelines, statusTransitions, previouslyAssociated, abandonedButResolving };
}
