/**
 * wpadDatIntel.js — WPAD.dat internal host leak analysis (idea 00122).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. WPAD.dat is
 * the proxy auto-config file served at predictable paths (/wpad.dat,
 * /proxy/wpad.dat) for Web Proxy Auto-Discovery. Its proxy logic routinely
 * names internal hosts, domains, and subnets — because the file exists to
 * tell every client on the network how to reach the intranet. Parsing it
 * surfaces internal naming conventions, AD domains, and intranet zones.
 *
 * All functions are pure: they analyze WPAD.dat text supplied by the caller
 * and never fetch anything themselves. Shared PAC parsing primitives are
 * reused from pacFileIntel.js.
 */

import { extractPacHosts, extractProxyEndpoints, extractPacSubnets } from './pacFileIntel.js';

/**
 * Extract domains named in dnsDomainIs() calls — these are almost always
 * the organization's real internal/AD domains.
 *
 * @param {string} wpadText
 * @returns {string[]} Unique lower-cased domains.
 */
export function extractWpadDomains(wpadText) {
  const text = String(wpadText || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = new Set();
  const re = /dnsDomainIs\s*\([^,]*,\s*["']([^"']+)["']\s*\)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const d = m[1].trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
    if (d && /^[a-z0-9.-]+$/.test(d)) out.add(d);
  }
  return [...out].sort();
}

/**
 * Extract shell-expression URL patterns from shExpMatch(url, "pattern") —
 * these enumerate internal URL namespaces (intranet paths, admin consoles).
 *
 * @param {string} wpadText
 * @returns {Array<{ pattern: string, detail: string }>}
 */
export function extractWpadUrlPatterns(wpadText) {
  const text = String(wpadText || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = [];
  const seen = new Set();
  const re = /shExpMatch\s*\(\s*url\s*,\s*["']([^"']+)["']\s*\)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const pattern = m[1].trim();
    if (seen.has(pattern)) continue;
    seen.add(pattern);
    out.push({
      pattern,
      detail:
        `WPAD matches URLs against '${pattern}' — wildcard URL patterns in proxy ` +
        'logic enumerate internal web namespaces (intranet apps, consoles, portals).',
    });
  }
  return out;
}

/**
 * Extract weekdayRange()/dateRange()/timeRange() gating — WPAD files
 * sometimes encode business-hours proxying, which discloses operating
 * windows and timezones.
 *
 * @param {string} wpadText
 * @returns {Array<{ kind: string, args: string, detail: string }>}
 */
export function extractWpadTimeGates(wpadText) {
  const text = String(wpadText || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = [];
  const re = /\b(weekdayRange|dateRange|timeRange)\s*\(([^)]*)\)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      kind: m[1],
      args: m[2].replace(/\s+/g, ' ').trim(),
      detail:
        `${m[1]}(${m[2].replace(/\s+/g, ' ').trim()}) gates proxying on time — ` +
        "discloses the organization's operating hours and GMT offset conventions.",
    });
  }
  return out;
}

/**
 * Idea 00122 — WPAD.dat internal host leak analysis.
 *
 * Analyzes a WPAD.dat file and surfaces internal hosts, internal/AD
 * domains, URL patterns, private subnets, proxy endpoints, and time gates.
 *
 * @param {string} wpadText Raw WPAD.dat contents.
 * @returns {{
 *   internalHosts: string[],
 *   externalHosts: string[],
 *   domains: string[],
 *   urlPatterns: ReturnType<typeof extractWpadUrlPatterns>,
 *   proxyEndpoints: ReturnType<typeof extractProxyEndpoints>,
 *   subnets: ReturnType<typeof extractPacSubnets>,
 *   timeGates: ReturnType<typeof extractWpadTimeGates>,
 *   summary: { internalHosts: number, domains: number, subnets: number, proxies: number },
 *   findings: string[]
 * }}
 */
export function analyzeWpadDat(wpadText) {
  const text = String(wpadText || '');
  const pac = extractPacHosts(text);

  const internalHosts = pac.hosts.filter(h => h.kind === 'internal').map(h => h.host);
  const externalHosts = pac.hosts.filter(h => h.kind === 'external').map(h => h.host);
  const domains = extractWpadDomains(text);

  // Derive probable internal domains from internal multi-label hostnames.
  const derived = new Set();
  for (const h of internalHosts) {
    if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})$/.test(h)) continue;
    const labels = h.split('.');
    const tail = labels.slice(-2).join('.');
    if (/^\d+\.\d+$/.test(tail)) continue; // numeric tails are not domains
    if (labels.length >= 3) derived.add(tail);
    else if (labels.length === 2) derived.add(h);
  }
  for (const d of derived) if (!domains.includes(d)) domains.push(d);
  domains.sort();

  const urlPatterns = extractWpadUrlPatterns(text);
  const timeGates = extractWpadTimeGates(text);

  const summary = {
    internalHosts: internalHosts.length,
    domains: domains.length,
    subnets: pac.subnets.length,
    proxies: pac.proxyEndpoints.length,
  };

  const findings = [];
  if (internalHosts.length) {
    findings.push(
      `${internalHosts.length} internal host(s) leaked via WPAD: ` +
        `${internalHosts.slice(0, 12).join(', ')}${internalHosts.length > 12 ? ` (+${internalHosts.length - 12} more)` : ''} — ` +
        "WPAD is served to every client, so these names are the organization's own intranet map."
    );
  }
  if (domains.length) {
    findings.push(
      `Internal domain(s) named in WPAD logic: ${domains.join(', ')} — ` +
        'AD/internal domain names seed subdomain enumeration and Kerberos recon.'
    );
  }
  if (pac.proxyEndpoints.length) {
    findings.push(
      `Proxy endpoint(s): ${pac.proxyEndpoints.map(e => `${e.scheme} ${e.raw}`).join(', ')}.`
    );
  }
  if (pac.subnets.length) {
    findings.push(
      `Private subnet(s): ${pac.subnets.map(s => `${s.network}/${s.mask}`).join(', ')}.`
    );
  }
  if (urlPatterns.length) {
    findings.push(
      `${urlPatterns.length} URL pattern(s) enumerate internal web namespaces: ` +
        `${urlPatterns
          .slice(0, 6)
          .map(p => `'${p.pattern}'`)
          .join(', ')}${urlPatterns.length > 6 ? '…' : ''}.`
    );
  }
  if (timeGates.length) {
    findings.push(
      `${timeGates.length} time gate(s) disclose operating windows: ` +
        timeGates.map(t => `${t.kind}(${t.args})`).join(', ') +
        '.'
    );
  }

  return {
    internalHosts,
    externalHosts,
    domains,
    urlPatterns,
    proxyEndpoints: pac.proxyEndpoints,
    subnets: pac.subnets,
    timeGates,
    summary,
    findings,
  };
}
