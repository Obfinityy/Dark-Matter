/**
 * pacFileIntel.js — Proxy Auto-Config (PAC) file host extraction (idea 00121).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. PAC files are
 * plain JavaScript served from predictable URLs (e.g. /proxy.pac) that encode
 * exactly how an organization routes browser traffic: which proxy clusters
 * serve which destinations, which hosts bypass the proxy, and which internal
 * networks route DIRECT. Parsing a PAC file the target willingly serves
 * enumerates proxy infrastructure, internal hostnames, and private subnets —
 * all first-class recon data.
 *
 * All functions are pure: they analyze PAC text supplied by the caller and
 * never fetch anything themselves.
 */

const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g;
const HOSTNAME_RE = /(?<![\w.-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?![\w.-])/g;

const INTERNAL_TLDS = new Set([
  'local', 'internal', 'intranet', 'corp', 'lan', 'home', 'private',
  'localdomain', 'invalid', 'test', 'example', 'wpad',
]);

/**
 * Remove // line comments and block comments from PAC JavaScript.
 * @param {string} text
 * @returns {string}
 */
export function stripPacComments(text) {
  return String(text || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * True for IPv4 literals.
 * @param {string} host
 */
export function isIpv4(host) {
  return /^(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})$/.test(host);
}

/**
 * True for RFC 1918 / loopback / link-local IPv4 addresses.
 * @param {string} ip
 */
export function isPrivateIpv4(ip) {
  if (!isIpv4(ip)) return false;
  const o = ip.split('.').map(Number);
  return (
    o[0] === 10 ||
    (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
    (o[0] === 192 && o[1] === 168) ||
    o[0] === 127 ||
    (o[0] === 169 && o[1] === 254)
  );
}

/**
 * Classify a host as internal (private IP, single label, or internal-only
 * suffix) vs externally resolvable.
 * @param {string} host
 * @returns {'internal' | 'external' | 'unresolved'}
 */
export function classifyPacHost(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!h) return 'unresolved';
  if (isIpv4(h)) return isPrivateIpv4(h) ? 'internal' : 'external';
  if (!h.includes('.')) return 'internal';
  const tld = h.split('.').pop();
  if (INTERNAL_TLDS.has(tld)) return 'internal';
  return 'external';
}

/**
 * Extract every proxy endpoint declared in the PAC file
 * (PROXY / HTTP / HTTPS / SOCKS / SOCKS5 directives).
 *
 * @param {string} pacText
 * @returns {Array<{ scheme: string, host: string, port: number | null, raw: string, detail: string }>}
 */
export function extractProxyEndpoints(pacText) {
  const clean = stripPacComments(pacText);
  const hits = [];
  const seen = new Set();
  const re = /\b(PROXY|HTTP|HTTPS|SOCKS5?|SOCKS4)\s+([^\s;"')]+)/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const raw = m[2].replace(/[),]+$/, '');
    const [hostPart, portPart] = raw.split(':');
    const key = `${m[1].toUpperCase()}|${raw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const host = (hostPart || '').replace(/^\[|\]$/g, '');
    if (!host) continue;
    hits.push({
      scheme: m[1].toUpperCase(),
      host,
      port: portPart && /^\d+$/.test(portPart) ? Number(portPart) : null,
      raw,
      detail: `PAC proxy endpoint: ${m[1].toUpperCase()} ${raw} (${classifyPacHost(host)} host). ` +
        'Proxy clusters named in PAC files are internet-reachable infrastructure ' +
        'worth fingerprinting for the target\'s egress architecture.',
    });
  }
  return hits;
}

/**
 * Extract all string literals from the PAC file together with the PAC
 * built-in call (if any) that immediately precedes them.
 *
 * @param {string} pacText
 * @returns {Array<{ value: string, context: string }>} context is one of
 *   proxy-rule, dnsResolve, shExpMatch, dnsDomainIs, isInNet, dnsDomainLevels,
 *   localHostOrDomainIs, host-literal.
 */
export function extractPacStringLiterals(pacText) {
  const clean = stripPacComments(pacText);
  const out = [];
  const re = /(["'])((?:\\.|(?!\1)[^\n\\])*)\1/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const before = clean.slice(Math.max(0, m.index - 48), m.index);
    let context = 'host-literal';
    if (/PROXY\s*$|SOCKS5?\s*$|HTTP\s*$|HTTPS\s*$/i.test(before)) context = 'proxy-rule';
    else if (/dnsResolve\s*\(\s*$/i.test(before)) context = 'dnsResolve';
    else if (/shExpMatch\s*\([^,]*,\s*$/i.test(before)) context = 'shExpMatch';
    else if (/dnsDomainIs\s*\([^,]*,\s*$/i.test(before)) context = 'dnsDomainIs';
    else if (/isInNet\s*\([^,]*,[^,]*,\s*$/i.test(before)) context = 'isInNet';
    else if (/dnsDomainLevels\s*\(\s*$/i.test(before)) context = 'dnsDomainLevels';
    else if (/localHostOrDomainIs\s*\([^,]*,\s*$/i.test(before)) context = 'localHostOrDomainIs';
    else if (/isPlainHostName\s*\(\s*$/i.test(before)) context = 'isPlainHostName';
    out.push({ value: m[2], context });
  }
  return out;
}

/**
 * Extract `isInNet(host, "network", "mask")` subnet declarations.
 *
 * @param {string} pacText
 * @returns {Array<{ network: string, mask: string, detail: string }>}
 */
export function extractPacSubnets(pacText) {
  const clean = stripPacComments(pacText);
  const out = [];
  const seen = new Set();
  const re = /isInNet\s*\(\s*host\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const key = `${m[1]}/${m[2]}`;
    if (seen.has(key) || !isIpv4(m[1])) continue;
    seen.add(key);
    out.push({
      network: m[1],
      mask: m[2],
      detail: `PAC routes ${m[1]}/${m[2]} via a special path — private subnets enumerated ` +
        'in proxy logic map the target\'s internal network ranges.',
    });
  }
  return out;
}

/**
 * Extract conditions that return "DIRECT" (proxy bypasses).
 *
 * @param {string} pacText
 * @returns {Array<{ condition: string, detail: string }>}
 */
export function extractDirectBypasses(pacText) {
  const clean = stripPacComments(pacText);
  const out = [];
  const re = /if\s*\(([\s\S]{1,220}?)\)\s*\{?\s*return\s+["']DIRECT["']/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const condition = m[1].replace(/\s+/g, ' ').trim();
    out.push({
      condition,
      detail: `DIRECT bypass when (${condition}) — hosts matching this condition never ` +
        'touch the proxy, which identifies internal or trusted destinations.',
    });
  }
  return out;
}

/**
 * Idea 00121 — PAC file host extraction.
 *
 * Parses a proxy auto-config file and extracts every host named in proxy
 * rules, DNS-resolution calls, match patterns, and string literals, along
 * with proxy endpoints, private subnets, and DIRECT bypass conditions.
 *
 * @param {string} pacText Raw PAC file contents.
 * @returns {{
 *   proxyEndpoints: ReturnType<typeof extractProxyEndpoints>,
 *   hosts: Array<{ host: string, kind: 'internal' | 'external' | 'unresolved', contexts: string[], detail: string }>,
 *   subnets: ReturnType<typeof extractPacSubnets>,
 *   directBypasses: ReturnType<typeof extractDirectBypasses>,
 *   summary: { proxyCount: number, internalHostCount: number, externalHostCount: number, subnetCount: number },
 *   findings: string[]
 * }}
 */
export function extractPacHosts(pacText) {
  const text = String(pacText || '');
  const proxyEndpoints = extractProxyEndpoints(text);
  const literals = extractPacStringLiterals(text);
  const subnets = extractPacSubnets(text);
  const directBypasses = extractDirectBypasses(text);
  const masks = new Set(subnets.map(s => s.mask.toLowerCase()));

  const hostContexts = new Map(); // host -> Set(context)
  const addHost = (host, context) => {
    const h = String(host || '').trim().replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
    if (!h || h === 'direct' || /^\d+$/.test(h)) return;
    if (masks.has(h)) return; // subnet masks are not hosts
    if (!hostContexts.has(h)) hostContexts.set(h, new Set());
    hostContexts.get(h).add(context);
  };

  for (const ep of proxyEndpoints) addHost(ep.host, 'proxy-rule');

  for (const lit of literals) {
    const v = lit.value.trim();
    if (!v) continue;
    // Whole-literal host (dnsResolve("intranet01"), PROXY "proxy:8080" args)
    if (/^[A-Za-z0-9._:-]+$/.test(v) && (isIpv4(v.split(':')[0]) || v.split(':')[0].includes('.') || !v.includes(' '))) {
      const bare = v.split(':')[0];
      if (isIpv4(bare) || bare.includes('.') || lit.context === 'dnsResolve') {
        if (!/[*?/]/.test(bare)) addHost(bare, lit.context);
      }
    }
    // Hosts embedded in patterns / URLs inside the literal
    for (const hm of v.matchAll(HOSTNAME_RE)) addHost(hm[0], lit.context);
    for (const im of v.matchAll(IPV4_RE)) addHost(im[0], lit.context);
  }

  const hosts = [...hostContexts.entries()].map(([host, contexts]) => {
    const kind = classifyPacHost(host);
    const ctx = [...contexts];
    return {
      host,
      kind,
      contexts: ctx,
      detail: `'${host}' appears in PAC logic (${ctx.join(', ')}) — classified ${kind}. ` +
        (kind === 'internal'
          ? 'Internal names in proxy rules enumerate intranet infrastructure to pivot into.'
          : 'External names reveal CDN, SaaS, or partner destinations in the routing policy.'),
    };
  }).sort((a, b) => a.host.localeCompare(b.host));

  const summary = {
    proxyCount: proxyEndpoints.length,
    internalHostCount: hosts.filter(h => h.kind === 'internal').length,
    externalHostCount: hosts.filter(h => h.kind === 'external').length,
    subnetCount: subnets.length,
  };

  const findings = [];
  if (proxyEndpoints.length) {
    findings.push(`${proxyEndpoints.length} proxy endpoint(s) declared: ` +
      proxyEndpoints.map(e => `${e.scheme} ${e.raw}`).join(', ') +
      ' — fingerprint these for egress-architecture intel.');
  }
  const internal = hosts.filter(h => h.kind === 'internal').map(h => h.host);
  if (internal.length) {
    findings.push(`${internal.length} internal host(s) named in proxy logic: ${internal.slice(0, 12).join(', ')}` +
      (internal.length > 12 ? ` (+${internal.length - 12} more)` : '') +
      ' — each is a candidate intranet asset.');
  }
  if (subnets.length) {
    findings.push(`${subnets.length} private subnet(s) enumerated: ` +
      subnets.map(s => `${s.network}/${s.mask}`).join(', ') + ' — internal ranges from routing policy.');
  }
  if (directBypasses.length) {
    findings.push(`${directBypasses.length} DIRECT bypass rule(s) — conditions that skip the proxy ` +
      'identify trusted/internal destinations.');
  }

  return { proxyEndpoints, hosts, subnets, directBypasses, summary, findings };
}
