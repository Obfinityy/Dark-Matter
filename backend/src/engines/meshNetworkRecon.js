/**
 * meshNetworkRecon.js — Mesh-network reconnaissance for authorized bug bounty.
 *
 * Analyses mesh VPN coordination-plane disclosures observed during an
 * authorized assessment:
 *  - Nebula certificates (idea 641): mine node names, IPs and groups from
 *    `nebula-cert print` JSON output without touching the mesh itself.
 *  - WireGuard peer configs (idea 642): detect accidentally disclosed
 *    WireGuard peer configuration text (peer endpoints, public keys) in
 *    observed responses and grade the leak.
 *  - Headscale servers (idea 643): detect Headscale coordination servers by
 *    their API shape, headers and admin-console fingerprints.
 *  - Netmaker servers (idea 644): detect Netmaker servers by their UI
 *    branding, API paths and header fingerprints.
 *  - Innernet coordinators (idea 645): map CIDR allocations from innernet
 *    coordinator configuration disclosures.
 *
 * All functions are pure analysis of already-observed data. This module never
 * joins a mesh, never authenticates, and never probes coordination servers
 * beyond the passive observations handed to it.
 */

/** ------------------------------------------------------------------
 *  641 — Nebula certificate host mining
 * ------------------------------------------------------------------ */

/**
 * Parse a Nebula certificate (as emitted by `nebula-cert print -json`, or a
 * plain object with the same shape) into a node inventory entry.
 *
 * @param {object|string} cert parsed cert object or JSON string
 * @returns {object} { parsed, name, ips, groups, subnets, issuer, notBefore, notAfter, durationDays }
 */
export function parseNebulaCert(cert) {
  const empty = {
    parsed: false,
    name: '',
    ips: [],
    groups: [],
    subnets: [],
    issuer: '',
    notBefore: null,
    notAfter: null,
    durationDays: null,
  };
  let obj = cert;
  if (typeof cert === 'string') {
    try {
      obj = JSON.parse(cert);
    } catch {
      return empty;
    }
  }
  if (!obj || typeof obj !== 'object') return empty;
  const details = obj.details || obj;
  const name = String(details.name || '');
  const ips = Array.isArray(details.ips) ? details.ips.map(String) : [];
  const groups = Array.isArray(details.groups) ? details.groups.map(String) : [];
  const subnets = Array.isArray(details.subnets) ? details.subnets.map(String) : [];
  if (!name && ips.length === 0) return empty;

  const issuer =
    obj.issuer?.fingerprint || details.issuer || obj.issuer || '';
  const notBefore = details.not_before || details.notBefore || null;
  const notAfter = details.not_after || details.notAfter || null;
  let durationDays = null;
  const nb = notBefore ? Date.parse(notBefore) : NaN;
  const na = notAfter ? Date.parse(notAfter) : NaN;
  if (Number.isFinite(nb) && Number.isFinite(na) && na > nb) {
    durationDays = Math.round((na - nb) / 86400000);
  }
  return {
    parsed: true,
    name,
    ips,
    groups,
    subnets,
    issuer: String(issuer),
    notBefore,
    notAfter,
    durationDays,
  };
}

/**
 * Mine a batch of Nebula certificates into a mesh node inventory.
 * Highlights group overlap (nodes sharing groups can route to each other)
 * and duplicate IP assignments (misconfigurations).
 *
 * @param {Array<object|string>} certs Nebula certificate objects
 * @returns {object} { nodes, groupIndex, duplicateIps, meshSummary }
 */
export function mineNebulaCerts(certs = []) {
  const nodes = [];
  for (const c of certs) {
    const n = parseNebulaCert(c);
    if (n.parsed) nodes.push(n);
  }
  const groupIndex = {};
  const ipOwners = {};
  for (const n of nodes) {
    for (const g of n.groups) {
      groupIndex[g] = groupIndex[g] || [];
      if (!groupIndex[g].includes(n.name)) groupIndex[g].push(n.name);
    }
    for (const ip of n.ips) {
      ipOwners[ip] = ipOwners[ip] || [];
      if (!ipOwners[ip].includes(n.name)) ipOwners[ip].push(n.name);
    }
  }
  const duplicateIps = Object.entries(ipOwners)
    .filter(([, owners]) => owners.length > 1)
    .map(([ip, owners]) => ({ ip, owners }));
  const wideGroups = Object.entries(groupIndex)
    .filter(([, members]) => members.length > 4)
    .map(([group, members]) => ({ group, members }));
  return {
    nodes,
    groupIndex,
    duplicateIps,
    wideGroups,
    meshSummary: {
      nodeCount: nodes.length,
      groupCount: Object.keys(groupIndex).length,
      issuerCount: new Set(nodes.map((n) => n.issuer).filter(Boolean)).size,
    },
  };
}

/** ------------------------------------------------------------------
 *  642 — WireGuard peer-config leak detection
 * ------------------------------------------------------------------ */

const WG_SECTION_RE = /^\s*\[(Interface|Peer)\]\s*$/gim;
const WG_ENDPOINT_RE = /^\s*Endpoint\s*=\s*([^\s#;]+)\s*$/gim;
const WG_PUBKEY_RE = /^\s*PublicKey\s*=\s*([A-Za-z0-9+/=]{43,44})\s*$/gim;
const WG_ALLOWEDIPS_RE = /^\s*AllowedIPs\s*=\s*([^\s#;]+)\s*$/gim;

/**
 * Detect WireGuard configuration text accidentally disclosed in an observed
 * response (HTTP body, config backup, debug page). Grades the leak:
 *  - critical: peer endpoints + public keys visible (enough to map peers)
 *  - medium: key material without endpoints
 *  - low: fragmentary (interface stanzas only)
 *
 * Defensive purpose: alert the asset owner that peer configs are exposed.
 * Never uses the material to connect anywhere.
 *
 * @param {string} text observed response body or file content
 * @param {string} [source] where the text was observed (URL, path)
 * @returns {object} { found, grade, peers, evidence }
 */
export function detectWireGuardPeerLeaks(text, source = '') {
  const body = String(text || '');
  const sections = body.match(WG_SECTION_RE) || [];
  if (sections.length === 0) {
    return { found: false, grade: 'none', peers: [], evidence: '' };
  }
  const endpoints = [...body.matchAll(WG_ENDPOINT_RE)].map((m) => m[1]);
  const publicKeys = [...body.matchAll(WG_PUBKEY_RE)].map((m) => m[1]);
  const allowedIps = [...body.matchAll(WG_ALLOWEDIPS_RE)].map((m) => m[1]);

  // Split per-peer blocks: text between [Peer] markers.
  const blocks = body.split(/^\s*\[Peer\]\s*$/gim).slice(1);
  const endpointInBlock = (block) => [...block.matchAll(/^\s*Endpoint\s*=\s*([^\s#;]+)\s*$/gim)].map((m) => m[1]);
  const allowedInBlock = (block) => [...block.matchAll(/^\s*AllowedIPs\s*=\s*([^\s#;]+)\s*$/gim)].map((m) => m[1]);
  const pubkeyInBlock = /^\s*PublicKey\s*=\s*[A-Za-z0-9+/=]{43,44}\s*$/gim;
  const peers = blocks.map((block, i) => {
    pubkeyInBlock.lastIndex = 0; // /g regexes are stateful — reset before each test
    return {
      index: i,
      endpoint: endpointInBlock(block),
      allowedIps: allowedInBlock(block),
      hasPublicKey: pubkeyInBlock.test(block),
    };
  });

  const hasEndpoints = endpoints.length > 0;
  const hasKeys = publicKeys.length > 0;
  let grade = 'low';
  if (hasEndpoints && hasKeys) grade = 'critical';
  else if (hasKeys || (hasEndpoints && allowedIps.length > 0)) grade = 'medium';

  return {
    found: true,
    grade,
    peers,
    endpointCount: endpoints.length,
    publicKeyCount: publicKeys.length,
    evidence:
      `WireGuard config text observed${source ? ` at ${source}` : ''}: ` +
      `${sections.length} stanza(s), ${endpoints.length} peer endpoint(s), ` +
      `${publicKeys.length} public key(s).`,
  };
}

/** ------------------------------------------------------------------
 *  643 — Headscale coordination-server detection
 * ------------------------------------------------------------------ */

const HEADSCALE_API_PATHS = [
  '/api/v1/apikey',
  '/api/v1/policy',
  '/api/v1/node',
  '/api/v1/preauthkey',
  '/api/v1/user',
  '/api/v1/tailcfg',
  '/api/v1/debug',
];

const HEADSCALE_BODY_SIGS = [
  /headscale/i,
  /tailscale.{0,40}headscale/i,
  /"headscale"/i,
];

const HEADSCALE_HEADER_SIGS = [
  { header: 'x-headscale-version', weight: 3 },
  { header: 'server', pattern: /headscale/i, weight: 2 },
  { header: 'x-tailscale-force-https', weight: 1 },
];

/** OIDC/admin branding that is specific enough not to double-count a bare "headscale" mention. */
const HEADSCALE_ADMIN_HINT = /(headscale-admin|hskey|headscale[\w-]*oidc|oidc[\w-]*headscale)/i;

/** Match an observed path against a known API prefix on segment boundaries. */
function pathMatchesApi(observedPaths, apiPaths) {
  return (observedPaths || []).filter((p) =>
    apiPaths.some((api) => p === api || p.startsWith(`${api}/`) || p.startsWith(`${api}?`))
  );
}

/**
 * Detect a Headscale coordination server from observed HTTP evidence.
 * Scores the characteristic Headscale admin-API shape, headers and UI
 * branding; never calls the API itself.
 *
 * @param {{headers?: object, body?: string, observedPaths?: string[]}} evidence
 * @returns {object} { detected, confidence, score, indicators }
 */
export function detectHeadscaleServer({ headers = {}, body = '', observedPaths = [] } = {}) {
  const indicators = [];
  let score = 0;
  const norm = {};
  for (const [k, v] of Object.entries(headers)) {
    norm[k.toLowerCase()] = String(v);
  }
  for (const { header, pattern, weight } of HEADSCALE_HEADER_SIGS) {
    const value = norm[header];
    if (value && (!pattern || pattern.test(value))) {
      score += weight;
      indicators.push(`header ${header}: ${value.slice(0, 60)}`);
    }
  }
  const text = String(body || '');
  for (const sig of HEADSCALE_BODY_SIGS) {
    if (sig.test(text)) {
      score += 2;
      indicators.push(`body signature ${sig}`);
      break;
    }
  }
  if (HEADSCALE_ADMIN_HINT.test(text)) {
    score += 1;
    indicators.push('Headscale admin/OIDC branding hint');
  }
  const matchedPaths = pathMatchesApi(observedPaths, HEADSCALE_API_PATHS);
  if (matchedPaths.length > 0) {
    score += 3;
    indicators.push(`Headscale API paths observed: ${matchedPaths.slice(0, 3).join(', ')}`);
  }
  const confidence = score >= 5 ? 'high' : score >= 3 ? 'medium' : score >= 1 ? 'low' : 'none';
  return {
    detected: confidence !== 'none',
    confidence,
    score,
    indicators,
    apiPaths: matchedPaths,
  };
}

/** ------------------------------------------------------------------
 *  644 — Netmaker server detection
 * ------------------------------------------------------------------ */

const NETMAKER_API_PATHS = [
  '/api/serverinfo',
  '/api/networks',
  '/api/nodes',
  '/api/enrollment-keys',
  '/api/oauth',
  '/api/hosts',
];

const NETMAKER_BODY_SIGS = [
  /netmaker/i,
  /"netmaker-version"/i,
  /netclient/i,
];

const NETMAKER_HEADER_SIGS = [
  { header: 'server', pattern: /netmaker/i, weight: 2 },
  { header: 'x-netmaker', weight: 3 },
];

/**
 * Detect a Netmaker server from observed HTTP evidence (UI branding, API
 * paths, headers). Passive only — never calls the Netmaker API.
 *
 * @param {{headers?: object, body?: string, observedPaths?: string[]}} evidence
 * @returns {object} { detected, confidence, score, indicators }
 */
export function detectNetmakerServer({ headers = {}, body = '', observedPaths = [] } = {}) {
  const indicators = [];
  let score = 0;
  const norm = {};
  for (const [k, v] of Object.entries(headers)) {
    norm[k.toLowerCase()] = String(v);
  }
  for (const { header, pattern, weight } of NETMAKER_HEADER_SIGS) {
    const value = norm[header];
    if (value && (!pattern || pattern.test(value))) {
      score += weight;
      indicators.push(`header ${header}: ${value.slice(0, 60)}`);
    }
  }
  const text = String(body || '');
  for (const sig of NETMAKER_BODY_SIGS) {
    if (sig.test(text)) {
      score += 2;
      indicators.push(`body signature ${sig}`);
      break;
    }
  }
  const matchedPaths = pathMatchesApi(observedPaths, NETMAKER_API_PATHS);
  if (matchedPaths.length > 0) {
    score += 3;
    indicators.push(`Netmaker API paths observed: ${matchedPaths.slice(0, 3).join(', ')}`);
  }
  const confidence = score >= 5 ? 'high' : score >= 3 ? 'medium' : score >= 1 ? 'low' : 'none';
  return {
    detected: confidence !== 'none',
    confidence,
    score,
    indicators,
    apiPaths: matchedPaths,
  };
}

/** ------------------------------------------------------------------
 *  645 — Innernet CIDR mapping
 * ------------------------------------------------------------------ */

/**
 * Parse an innernet coordinator configuration disclosure (TOML-style or
 * JSON with `networks`/`peers`) and map CIDR allocations to peers.
 * Flags overlapping CIDRs and CIDRs advertised by multiple peers.
 *
 * @param {string|object} config raw coordinator config text or parsed object
 * @returns {object} { mapped, networks, overlaps, peerCount }
 */
export function mapInnernetCidr(config) {
  const result = { mapped: false, networks: [], overlaps: [], peerCount: 0 };
  let obj = config;
  if (typeof config === 'string') {
    try {
      obj = JSON.parse(config);
    } catch {
      obj = parseInnernetToml(config);
    }
  }
  if (!obj || typeof obj !== 'object') return result;

  const networks = [];
  if (obj.networks && typeof obj.networks === 'object') {
    for (const [name, def] of Object.entries(obj.networks)) {
      networks.push({
        name,
        cidr: String(def.cidr || def),
        peers: Array.isArray(def.peers) ? def.peers.map(String) : [],
      });
    }
  }
  // Flat TOML style: [networks.<name>] cidr = "..." is folded by parseInnernetToml
  // into networks.<name>.cidr above; top-level peer list also supported.
  const peers = Array.isArray(obj.peers) ? obj.peers.map(String) : [];
  if (networks.length === 0) return result;

  const overlaps = [];
  for (let i = 0; i < networks.length; i++) {
    for (let j = i + 1; j < networks.length; j++) {
      const a = networks[i];
      const b = networks[j];
      if (cidrOverlap(a.cidr, b.cidr)) {
        overlaps.push({ networkA: a.name, cidrA: a.cidr, networkB: b.name, cidrB: b.cidr });
      }
    }
  }
  return {
    mapped: true,
    networks,
    overlaps,
    peerCount: peers.length || new Set(networks.flatMap((n) => n.peers)).size,
    totalAddresses: networks.reduce((sum, n) => sum + cidrSize(n.cidr), 0),
  };
}

/** Minimal TOML-ish parser for innernet coordinator configs. */
function parseInnernetToml(text) {
  const out = { networks: {}, peers: [] };
  const lines = String(text).split(/\r?\n/);
  let section = null;
  for (const raw of lines) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      section = sec[1].trim();
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    let value = kv[2].trim().replace(/^["']|["']$/g, '');
    const arrayMatch = kv[2].trim().match(/^\[(.*)\]$/s);
    if (arrayMatch) {
      value = arrayMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
    if (section && section.startsWith('networks.')) {
      const net = section.slice('networks.'.length);
      out.networks[net] = out.networks[net] || {};
      out.networks[net][key] = value;
    } else if (section === 'peers' && key === 'name' && Array.isArray(value)) {
      out.peers = value;
    } else if (section === null && key === 'peers' && Array.isArray(value)) {
      out.peers = value;
    }
  }
  return out;
}

/** Convert an IPv4 CIDR to a [start, end] integer range; null if invalid. */
function cidrRange(cidr) {
  const m = String(cidr).trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!m) return null;
  const octets = m[1].split('.').map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return null;
  const prefix = Number(m[2]);
  if (prefix < 0 || prefix > 32) return null;
  const ip = ((octets[0] * 256 ** 3) + (octets[1] * 256 ** 2) + (octets[2] * 256) + octets[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const start = (ip & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return [start, end];
}

function cidrOverlap(a, b) {
  const ra = cidrRange(a);
  const rb = cidrRange(b);
  if (!ra || !rb) return false;
  return ra[0] <= rb[1] && rb[0] <= ra[1];
}

function cidrSize(cidr) {
  const r = cidrRange(cidr);
  if (!r) return 0;
  return r[1] - r[0] + 1;
}

export const MESH_NETWORK_RECON = {
  parseNebulaCert,
  mineNebulaCerts,
  detectWireGuardPeerLeaks,
  detectHeadscaleServer,
  detectNetmakerServer,
  mapInnernetCidr,
};

export default MESH_NETWORK_RECON;
