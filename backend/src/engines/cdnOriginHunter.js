/**
 * cdnOriginHunter.js — CDN origin-IP discovery via DNS side channels.
 *
 * Ideas 00578–00580: find the true origin server behind a CDN by
 * analyzing DNS records that the CDN cannot hide — MX records that
 * resolve outside the CDN's ranges, SPF records that expose direct
 * mail-server IPs, and historical DNS snapshots showing pre-CDN
 * A records.
 *
 * Pure, offline analysis of supplied DNS data: the functions never
 * perform lookups themselves. Results are candidate origins for the
 * agent to verify with the target's authorization before any active
 * testing, keeping the recon footprint within scope.
 */

/**
 * Well-known CDN edge host indicators (idea 578–580): hostnames that
 * look like CDN edge nodes. Records pointing OUTSIDE these families
 * are origin candidates.
 */
const CDN_EDGE_INDICATORS = [
  /cloudfront\.net$/i, /cloudflare\.net$/i, /fastly\.net$/i, /akamaihd\.net$/i,
  /akamaized\.net$/i, /edgesuite\.net$/i, /edgekey\.net$/i, /cdn77\.org$/i,
  /keycdn\.com$/i, /stackpathdns\.com$/i, /cdn\.verizon\.com$/i,
  /azureedge\.net$/i, /azurefd\.net$/i, /hwcdn\.net$/i,
];

/**
 * Mail-infrastructure host hints that mark a record as clearly
 * non-origin mail hosting rather than the web origin.
 */
const THIRDPARTY_MAIL_HOSTS = [
  /google\.com$/i, /googlemail\.com$/i, /outlook\.com$/i, /hotmail\.com$/i,
  /protection\.outlook\.com$/i, /messagelabs\.com$/i, /mimecast\.com$/i,
  /proofpoint\.com$/i, /barracuda\.com$/i, /secureserver\.net$/i,
];

/**
 * Check whether a hostname belongs to a known CDN edge family.
 * @param {string} host
 * @returns {boolean}
 */
export function isCdnEdgeHost(host) {
  return CDN_EDGE_INDICATORS.some((re) => re.test(String(host || '')));
}

/**
 * Check whether a hostname is third-party managed mail hosting
 * (not the target's own origin infrastructure).
 * @param {string} host
 * @returns {boolean}
 */
export function isThirdPartyMailHost(host) {
  return THIRDPARTY_MAIL_HOSTS.some((re) => re.test(String(host || '')));
}

/**
 * Discover origin IPs via MX records (idea 578). An MX host that does
 * not resolve to CDN edge infrastructure and is not third-party mail
 * hosting may reveal the target's own server IP — a common origin leak.
 *
 * @param {{mxRecords?: Array<{host?: string, priority?: number, resolvedIps?: string[]}>, domain?: string}} input
 * @returns {{domain?: string, candidates: Array<{mxHost: string, ips: string[], reason: string}>, summary: string}}
 */
export function discoverOriginViaMx({ mxRecords = [], domain = '' }) {
  const candidates = [];
  for (const rec of mxRecords) {
    const host = String(rec.host || '').trim().replace(/\.$/, '');
    const ips = (rec.resolvedIps || []).map((i) => String(i).trim()).filter(Boolean);
    if (!host || ips.length === 0) continue;
    if (isCdnEdgeHost(host)) continue;
    if (isThirdPartyMailHost(host)) continue;
    const reason = /mail|mx|smtp|exchange/i.test(host)
      ? 'Self-hosted mail exchanger resolving outside CDN ranges — may share infrastructure with the web origin.'
      : 'MX host resolving outside CDN ranges — potential direct server IP.';
    candidates.push({ mxHost: host, ips, reason });
  }
  return {
    domain,
    candidates,
    summary: candidates.length
      ? `${candidates.length} MX-derived origin candidate(s) for ${domain || 'the domain'}: ${candidates.map((c) => c.mxHost).join(', ')}.`
      : `No origin candidates found in MX records for ${domain || 'the domain'}.`,
  };
}

/**
 * Parse an SPF record string into its mechanisms.
 * @param {string} spf raw TXT record starting with "v=spf1"
 * @returns {{mechanisms: string[], directIps: string[], includes: string[], allMechanism?: string}}
 */
export function parseSpfRecord(spf) {
  const text = String(spf || '').trim();
  if (!/^v=spf1/i.test(text)) return { mechanisms: [], directIps: [], includes: [] };
  const parts = text.split(/\s+/).slice(1);
  const mechanisms = [];
  const directIps = [];
  const includes = [];
  let allMechanism;
  for (let part of parts) {
    const m = part.match(/^([~+\-?]?)(.+)$/);
    const mech = m ? m[2] : part;
    mechanisms.push(part);
    if (/^ip4:/i.test(mech) || /^ip6:/i.test(mech)) directIps.push(mech.replace(/^ip[46]:/i, ''));
    else if (/^include:/i.test(mech)) includes.push(mech.replace(/^include:/i, ''));
    else if (/^all$/i.test(mech)) allMechanism = m[1] || '+';
  }
  return { mechanisms, directIps, includes, allMechanism };
}

/**
 * Extract origin mail-server IPs from SPF records (idea 579). SPF
 * `ip4:`/`ip6:` mechanisms that bypass the CDN point directly at the
 * target's own mail infrastructure — a frequent origin-IP leak.
 *
 * @param {{txtRecords?: string[], domain?: string}} input
 * @returns {{domain?: string, spfFound: boolean, directIps: string[], includes: string[], allMechanism?: string, summary: string}}
 */
export function discoverOriginViaSpf({ txtRecords = [], domain = '' }) {
  const spfTexts = (txtRecords || []).map((t) => String(t)).filter((t) => /^v=spf1/i.test(t.trim()));
  const directIps = [];
  const includes = [];
  let allMechanism;
  for (const spf of spfTexts) {
    const parsed = parseSpfRecord(spf);
    for (const ip of parsed.directIps) if (!directIps.includes(ip)) directIps.push(ip);
    for (const inc of parsed.includes) if (!includes.includes(inc)) includes.push(inc);
    if (parsed.allMechanism) allMechanism = parsed.allMechanism;
  }
  const result = { domain, spfFound: spfTexts.length > 0, directIps, includes, summary: '' };
  if (allMechanism) result.allMechanism = allMechanism;
  result.summary = !result.spfFound
    ? `No SPF record found for ${domain || 'the domain'} — mail-origin side channel unavailable.`
    : directIps.length
      ? `SPF exposes ${directIps.length} direct mail-server IP(s) bypassing the CDN (${directIps.join(', ')}) — candidate origin infrastructure.`
      : `SPF record present for ${domain || 'the domain'} but lists no direct IPs (includes only: ${includes.join(', ') || 'none'}).`;
  return result;
}

/**
 * Pull pre-CDN A records from DNS history to find origin IPs
 * (idea 580). Given snapshots of DNS history (`{date, aRecords[]}`),
 * the function finds IPs that appeared BEFORE the domain moved behind
 * the CDN and no longer appear in current records — classic
 * origin leaks from SecurityTrails-style history.
 *
 * @param {{historySnapshots?: Array<{date?: string, aRecords?: string[]}>, currentA?: string[], domain?: string}} input
 * @returns {{domain?: string, candidates: Array<{ip: string, lastSeen?: string, reason: string}>, summary: string}}
 */
export function discoverOriginViaDnsHistory({ historySnapshots = [], currentA = [], domain = '' }) {
  const current = new Set((currentA || []).map((i) => String(i).trim()).filter(Boolean));
  const seen = new Map(); // ip -> lastSeen date
  const sorted = [...historySnapshots].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  let cdnCutoverIndex = -1;
  for (const snap of sorted) {
    // A snapshot is "post-CDN" if any of its A records match current ones.
    if ((snap.aRecords || []).some((ip) => current.has(String(ip).trim()))) { cdnCutoverIndex = sorted.indexOf(snap); break; }
  }

  const preCdn = cdnCutoverIndex > 0 ? sorted.slice(0, cdnCutoverIndex) : sorted;
  for (const snap of preCdn) {
    for (const ip of snap.aRecords || []) {
      const clean = String(ip).trim();
      if (clean && !current.has(clean)) seen.set(clean, snap.date || 'unknown');
    }
  }

  const candidates = [...seen.entries()].map(([ip, lastSeen]) => ({
    ip,
    lastSeen,
    reason: 'Appeared in DNS history before the current (CDN) A records and is no longer advertised — likely the pre-CDN origin IP.',
  }));

  return {
    domain,
    candidates,
    summary: candidates.length
      ? `${candidates.length} pre-CDN origin candidate IP(s) from DNS history for ${domain || 'the domain'}: ${candidates.map((c) => c.ip).join(', ')}.`
      : `No pre-CDN A records found in DNS history for ${domain || 'the domain'}.`,
  };
}
