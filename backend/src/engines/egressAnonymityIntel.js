/**
 * egressAnonymityIntel.js — Egress / anonymity-network intelligence.
 *
 * Ideas 00576–00577: correlate observed login / network activity against
 * known anonymity-network egress data — Cloudflare WARP egress ranges in
 * logs, and Tor exit nodes during authentication — so the agent can add
 * account-takeover context to suspicious sessions.
 *
 * Pure, offline analysis: the functions only compare supplied IPs against
 * embedded reference data (Cloudflare's published IP ranges; a Tor
 * exit-node list the caller supplies). They never scan, never fingerprint
 * users, and are used strictly to enrich defensive auth-anomaly reports.
 */

/**
 * Cloudflare's published IPv4/IPv6 egress ranges (idea 576). Consumer and
 * enterprise WARP traffic exits from these ranges, so a login whose
 * source IP sits inside them travelled over WARP egress. Source:
 * https://www.cloudflare.com/ips (reference snapshot).
 */
const CLOUDFLARE_EGRESS_RANGES = [
  // IPv4
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  // IPv6
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

/**
 * Check whether an IPv4 address is inside a CIDR block (IPv4 only).
 * @param {string} ip dotted-quad
 * @param {string} cidr e.g. '162.158.0.0/15'
 * @returns {boolean}
 */
function ipv4InCidr(ip, cidr) {
  const toInt = s => s.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
  try {
    const [net, bits] = cidr.split('/');
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || !/^\d+\.\d+\.\d+\.\d+$/.test(net)) return false;
    const mask = bits === '0' ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
    return (toInt(ip) & mask) === (toInt(net) & mask);
  } catch {
    return false;
  }
}

/**
 * Fully expand an IPv6 address to 8 zero-padded hextets.
 * @param {string} addr
 * @returns {string[]|null}
 */
function expandIPv6(addr) {
  try {
    const clean = String(addr).trim().toLowerCase().split('%')[0].split('/')[0];
    const parts = clean.split('::');
    if (parts.length > 2) return null;
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    if (parts.length === 1 && left.length !== 8) return null;
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    return [...left, ...Array(missing).fill('0'), ...right].map(h => h.padStart(4, '0'));
  } catch {
    return null;
  }
}

/**
 * Match an IP (v4 or v6) against the Cloudflare range table.
 * @param {string} ip
 * @returns {string|null} matching range, or null
 */
export function matchCloudflareRange(ip) {
  const clean = String(ip || '')
    .trim()
    .toLowerCase();
  if (!clean) return null;
  const isV6 = clean.includes(':');
  for (const range of CLOUDFLARE_EGRESS_RANGES) {
    if (isV6) {
      if (!range.includes(':')) continue;
      const [prefix, bits] = range.split('/');
      const nibbles = Math.floor(Number(bits) / 4);
      const a = expandIPv6(prefix);
      const b = expandIPv6(clean);
      if (!a || !b) continue;
      if (a.join('').slice(0, nibbles) === b.join('').slice(0, nibbles)) return range;
    } else if (!range.includes(':') && ipv4InCidr(clean, range)) {
      return range;
    }
  }
  return null;
}

/**
 * Map Cloudflare WARP egress IPs inside captured log entries (idea 576).
 * Each entry carries a source IP; entries whose IP sits in Cloudflare's
 * egress ranges are flagged as WARP-routed so analysts can understand
 * the user path (e.g. a remote employee tunnelling through WARP).
 *
 * @param {{logEntries?: Array<{ip?: string, user?: string, ts?: string, endpoint?: string}>}} input
 * @returns {{total: number, warpCount: number, warpEntries: Array<{ip: string, range: string, user?: string, ts?: string, endpoint?: string}>, summary: string}}
 */
export function mapWarpEgress({ logEntries = [] }) {
  const warpEntries = [];
  for (const entry of logEntries) {
    const ip = String(entry.ip || '').trim();
    if (!ip) continue;
    const range = matchCloudflareRange(ip);
    if (range) {
      warpEntries.push({ ip, range, user: entry.user, ts: entry.ts, endpoint: entry.endpoint });
    }
  }
  const uniqueIps = new Set(warpEntries.map(e => e.ip)).size;
  return {
    total: logEntries.length,
    warpCount: warpEntries.length,
    warpEntries,
    summary: warpEntries.length
      ? `${warpEntries.length} of ${logEntries.length} log entr${logEntries.length === 1 ? 'y' : 'ies'} from ${uniqueIps} unique IP(s) inside Cloudflare egress ranges (WARP-routed user path).`
      : 'No Cloudflare WARP egress IPs found in the supplied log entries.',
  };
}

/**
 * Tor-related risk heuristics (idea 577). A Tor exit node alone is not
 * evidence of compromise — it becomes account-takeover context when
 * combined with auth anomalies such as failures, impossible travel, or
 * new devices.
 */
const TOR_CONTEXT_RULES = [
  {
    name: 'tor-plus-login-failures',
    weight: 3,
    test: e => e.torExit && (e.failedAttempts || 0) >= 3,
  },
  { name: 'tor-plus-new-device', weight: 3, test: e => e.torExit && e.newDevice === true },
  { name: 'tor-plus-password-reset', weight: 2, test: e => e.torExit && e.passwordReset === true },
  {
    name: 'tor-plus-impossible-travel',
    weight: 3,
    test: e => e.torExit && e.impossibleTravel === true,
  },
  { name: 'tor-plus-mfa-failure', weight: 2, test: e => e.torExit && e.mfaFailed === true },
  { name: 'tor-baseline', weight: 1, test: e => e.torExit },
];

/**
 * Correlate login events against a Tor exit-node list for
 * account-takeover context (idea 577). The caller supplies the
 * exit-node list (e.g. a snapshot of the Tor Project exit list); the
 * function matches source IPs and then applies defensive anomaly rules.
 *
 * @param {{loginEvents?: Array<{user?: string, ip?: string, ts?: string, failedAttempts?: number, newDevice?: boolean, passwordReset?: boolean, impossibleTravel?: boolean, mfaFailed?: boolean}>, torExitIps?: string[]}} input
 * @returns {{analyzed: number, torSessions: number, flagged: Array<{user?: string, ip?: string, ts?: string, risk: 'critical'|'high'|'medium'|'low', triggers: string[]}>, summary: string}}
 */
export function correlateTorExits({ loginEvents = [], torExitIps = [] }) {
  const exits = new Set(
    (torExitIps || []).map(ip => String(ip).trim().toLowerCase()).filter(Boolean)
  );
  const flagged = [];
  let torSessions = 0;

  for (const event of loginEvents) {
    const ip = String(event.ip || '')
      .trim()
      .toLowerCase();
    const torExit = ip && exits.has(ip);
    if (!torExit) continue;
    torSessions += 1;

    const triggers = [];
    let score = 0;
    for (const rule of TOR_CONTEXT_RULES) {
      if (rule.test({ ...event, torExit })) {
        triggers.push(rule.name);
        score += rule.weight;
      }
    }
    const risk = score >= 6 ? 'critical' : score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low';
    flagged.push({ user: event.user, ip: event.ip, ts: event.ts, risk, triggers });
  }

  flagged.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.risk] - order[b.risk];
  });

  const critical = flagged.filter(f => f.risk === 'critical').length;
  return {
    analyzed: loginEvents.length,
    torSessions,
    flagged,
    summary: torSessions
      ? `${torSessions} Tor-exit login session(s) among ${loginEvents.length} analyzed; ${flagged.length} with anomaly context (${critical} critical).`
      : `No Tor exit-node logins found among ${loginEvents.length} analyzed events.`,
  };
}
