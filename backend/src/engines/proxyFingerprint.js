/**
 * proxyFingerprint.js — Proxy infrastructure fingerprinting.
 *
 * Passive recon helpers for an authorized bug-bounty agent: parse retrieved
 * PAC (wpad.dat) files for internal host references, recognize proxy
 * auto-configuration infrastructure, classify SOCKS endpoints from their
 * greeting-response bytes, and extract topology hints from proxy-added HTTP
 * headers (X-Forwarded-For chains, Via, injected headers, TTL anomalies).
 *
 * All functions are pure classifiers over data observed by the operator
 * (e.g. a wpad.dat fetched over HTTP, header sets returned by a target);
 * nothing here performs active probing or sends crafted packets.
 */

const INTERNAL_HOST_PATTERNS = [
  /\.internal$/i,
  /\.corp$/i,
  /\.local$/i,
  /\.intranet$/i,
  /\.lan$/i,
  /\.private$/i,
  /proxy/i,
  /gateway/i,
];

const PRIVATE_IP = /(?:^|[^0-9.])(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(?![0-9.])/g;

const SOCKS_VERSION_TABLE = [
  {
    version: 'SOCKS4',
    description: '0x00 0x5A — request granted (SOCKS4/SOCKS4a reply)',
    test: (b) => b.length >= 2 && b[0] === 0x00 && b[1] === 0x5a,
  },
  {
    version: 'SOCKS4',
    description: '0x00 0x5B — request rejected (SOCKS4 reply)',
    test: (b) => b.length >= 2 && b[0] === 0x00 && b[1] === 0x5b,
  },
  {
    version: 'SOCKS4',
    description: '0x00 0x5C — identd/auth failure (SOCKS4 reply)',
    test: (b) => b.length >= 2 && b[0] === 0x00 && b[1] === 0x5c,
  },
  {
    version: 'SOCKS5',
    description: '0x05 0x00 — method selection accepted, no auth required',
    test: (b) => b.length >= 2 && b[0] === 0x05 && b[1] === 0x00,
  },
  {
    version: 'SOCKS5',
    description: '0x05 0x02 — method selection accepted, username/password auth',
    test: (b) => b.length >= 2 && b[0] === 0x05 && b[1] === 0x02,
  },
  {
    version: 'SOCKS5',
    description: '0x05 0xFF — no acceptable auth method (endpoint reachable)',
    test: (b) => b.length >= 2 && b[0] === 0x05 && b[1] === 0xff,
  },
];

const SOCKS_AUTH_TABLE = {
  0x00: 'none',
  0x01: 'gssapi',
  0x02: 'username-password',
  0x80: 'chap',
  0xff: 'no-acceptable-method',
};

const PROXY_HEADER_TABLE = [
  { header: 'x-forwarded-for', meaning: 'client chain (original + intermediate hops)' },
  { header: 'forwarded', meaning: 'RFC 7239 proxy chain metadata' },
  { header: 'via', meaning: 'intermediate protocol/gateway identities' },
  { header: 'x-real-ip', meaning: 'client IP as seen by the outermost proxy' },
  { header: 'x-proxy-id', meaning: 'proxy appliance identity' },
  { header: 'x-cache', meaning: 'caching-proxy hit/miss status' },
  { header: 'x-squid-id', meaning: 'Squid proxy instance identity' },
  { header: 'x-bluecoat-via', meaning: 'BlueCoat/Symantec proxy marker' },
  { header: 'x-zscaler-id', meaning: 'Zscaler cloud proxy marker' },
  { header: 'proxy-agent', meaning: 'proxy software banner' },
];

const COMMON_PROXY_TTL = {
  linux: 64,
  windows: 128,
  cisco: 255,
};

/**
 * Analyze a retrieved wpad.dat / PAC file for internal host references.
 * Parses FindProxyForURL logic, shExpMatch patterns and proxy host lists.
 * Idea 561.
 *
 * @param {string} pacText Raw PAC file text (JavaScript).
 * @returns {{isPac:boolean, findProxyForUrl:boolean, internalHosts:string[], internalIps:string[], proxyHosts:string[], directPatterns:string[], evidence:string[]}}
 */
export function analyzeWPAD(pacText) {
  const text = String(pacText || '');
  const evidence = [];
  const isPac = /function\s+FindProxyForURL\s*\(/i.test(text);
  const findProxyForUrl = isPac;
  if (isPac) evidence.push('FindProxyForURL() defined — valid PAC file.');

  const stringLiterals = [...text.matchAll(/["']([^"']{2,120})["']/g)].map((m) => m[1]);

  const internalHosts = [
    ...new Set(
      stringLiterals.filter((s) => INTERNAL_HOST_PATTERNS.some((p) => p.test(s))),
    ),
  ];
  if (internalHosts.length) evidence.push(`Internal-style hostnames referenced: ${internalHosts.slice(0, 8).join(', ')}.`);

  const internalIps = [...new Set([...text.matchAll(PRIVATE_IP)].map((m) => m[1]))];
  if (internalIps.length) evidence.push(`Private IP literals referenced: ${internalIps.slice(0, 8).join(', ')}.`);

  const proxyHosts = [
    ...new Set(
      [...text.matchAll(/PROXY\s+([a-zA-Z0-9_.-]+)(?::(\d+))?/gi)].map((m) =>
        m[2] ? `${m[1]}:${m[2]}` : m[1],
      ),
    ),
  ];
  if (proxyHosts.length) evidence.push(`Explicit proxy endpoints in PAC: ${proxyHosts.slice(0, 8).join(', ')}.`);

  const directPatterns = [
    ...new Set([...text.matchAll(/shExpMatch\([^,]+,\s*["']([^"']+)["']\)/gi)].map((m) => m[1])),
  ];
  if (/["']DIRECT["']/i.test(text)) evidence.push('DIRECT branch present — bypass rules defined.');
  if (/SOCKS/i.test(text)) evidence.push('SOCKS directive present — SOCKS infrastructure advertised.');

  return {
    isPac,
    findProxyForUrl,
    internalHosts,
    internalIps,
    proxyHosts,
    directPatterns,
    evidence,
  };
}

/**
 * Test proxy auto-configuration behavior from observed network hints
 * (DHCP option-252 value, wpad.* DNS resolution, HTTP wpad.dat fetch).
 * Idea 562.
 *
 * @param {{dhcp252?:string, wpadDnsNames?:string[], wpadDatFetched?:boolean, wpadDatUrl?:string}} hints
 * @returns {{autoConfigDetected:boolean, infrastructure:string[], evidence:string[]}}
 */
export function detectProxyAutoConfig(hints = {}) {
  const { dhcp252 = '', wpadDnsNames = [], wpadDatFetched = false, wpadDatUrl = '' } = hints;
  const infrastructure = [];
  const evidence = [];

  if (dhcp252) {
    infrastructure.push('dhcp-option-252');
    evidence.push(`DHCP option 252 advertises PAC URL: ${dhcp252}.`);
  }
  const resolved = wpadDnsNames.filter(Boolean);
  if (resolved.length) {
    infrastructure.push('wpad-dns');
    evidence.push(`wpad.* hostname resolves: ${resolved.slice(0, 5).join(', ')}.`);
  }
  if (wpadDatFetched) {
    infrastructure.push('wpad-dat');
    evidence.push(`wpad.dat retrievable${wpadDatUrl ? ` at ${wpadDatUrl}` : ''} — PAC infrastructure live.`);
  }

  return {
    autoConfigDetected: infrastructure.length > 0,
    infrastructure,
    evidence,
  };
}

/**
 * Classify a SOCKS endpoint from its greeting-response bytes.
 * Idea 563.
 *
 * @param {number[]|Uint8Array|Buffer} responseBytes Raw bytes returned after the client greeting.
 * @returns {{version:string|null, authMethod:string|null, description:string|null, evidence:string}}
 */
export function probeSocksVersion(responseBytes) {
  const b = Array.isArray(responseBytes)
    ? responseBytes
    : Array.from(responseBytes || []);
  for (const sig of SOCKS_VERSION_TABLE) {
    if (sig.test(b)) {
      const authMethod =
        sig.version === 'SOCKS5' && b[1] in SOCKS_AUTH_TABLE ? SOCKS_AUTH_TABLE[b[1]] : null;
      return {
        version: sig.version,
        authMethod,
        description: sig.description,
        evidence: `Response bytes [${b.slice(0, 4).map((x) => `0x${x.toString(16).padStart(2, '0')}`).join(', ')}] → ${sig.description}.`,
      };
    }
  }
  return {
    version: null,
    authMethod: null,
    description: null,
    evidence: `Response bytes [${b.slice(0, 4).map((x) => `0x${x.toString(16).padStart(2, '0')}`).join(', ') || 'empty'}] match no known SOCKS greeting signature.`,
  };
}

/**
 * Analyze proxy-added HTTP headers for topology hints
 * (X-Forwarded-For chains, Via, RFC 7239 Forwarded, vendor markers).
 * Idea 564.
 *
 * @param {Record<string,string>} headers Response/request header map (case-insensitive keys).
 * @returns {{proxyDetected:boolean, hops:string[], proxyMarkers:{header:string,meaning:string,value:string}[], topologyHints:string[], evidence:string[]}}
 */
export function analyzeProxyHeaders(headers = {}) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), String(v)]),
  );
  const evidence = [];
  const proxyMarkers = [];
  let hops = [];

  for (const { header, meaning } of PROXY_HEADER_TABLE) {
    if (lower[header]) {
      proxyMarkers.push({ header, meaning, value: lower[header] });
    }
  }

  const xff = lower['x-forwarded-for'];
  if (xff) {
    hops = xff.split(',').map((h) => h.trim()).filter(Boolean);
    evidence.push(`X-Forwarded-For chain of ${hops.length} hop(s): ${hops.slice(0, 8).join(' → ')}.`);
  }
  const via = lower['via'];
  if (via) evidence.push(`Via header reveals intermediaries: ${via}.`);
  const forwarded = lower['forwarded'];
  if (forwarded) evidence.push(`RFC 7239 Forwarded header present: ${forwarded}.`);

  const topologyHints = [];
  const allValues = proxyMarkers.map((m) => m.value).join(' ');
  for (const ip of [...allValues.matchAll(PRIVATE_IP)].map((m) => m[1])) {
    topologyHints.push(`Private IP ${ip} leaks internal addressing in proxy headers.`);
  }
  if (hops.length > 1) topologyHints.push(`${hops.length} proxy hops suggest chained proxy topology.`);

  const proxyDetected = proxyMarkers.length > 0;
  if (!proxyDetected) evidence.push('No known proxy-added headers observed.');

  return { proxyDetected, hops, proxyMarkers, topologyHints, evidence };
}

/**
 * Detect transparent (intercepting) proxies via IP TTL anomalies and
 * injected-header anomalies between a direct and a proxied view.
 * Idea 565.
 *
 * @param {{observedTtl?:number, expectedTtl?:number, osHint?:'linux'|'windows'|'cisco', injectedHeaders?:string[], headerCountDelta?:number}} input
 * @returns {{transparentProxyLikely:boolean, confidence:'high'|'medium'|'low', evidence:string[]}}
 */
export function detectTransparentProxy(input = {}) {
  const {
    observedTtl = null,
    expectedTtl = null,
    osHint = 'linux',
    injectedHeaders = [],
    headerCountDelta = 0,
  } = input;
  const evidence = [];
  let score = 0;

  const baseline = expectedTtl ?? COMMON_PROXY_TTL[osHint] ?? COMMON_PROXY_TTL.linux;
  if (observedTtl !== null && observedTtl < baseline) {
    const delta = baseline - observedTtl;
    score += 2;
    evidence.push(`TTL ${observedTtl} is ${delta} below the expected ${baseline} (${osHint}) — extra hop(s) between target and observer.`);
  } else if (observedTtl !== null) {
    evidence.push(`TTL ${observedTtl} matches expected ${baseline} — no TTL anomaly.`);
  }

  const injected = injectedHeaders.filter(Boolean);
  if (injected.length) {
    score += 2;
    evidence.push(`Proxy-injected headers observed: ${injected.join(', ')}.`);
  }
  if (headerCountDelta > 2) {
    score += 1;
    evidence.push(`Header count grew by ${headerCountDelta} versus the direct view.`);
  }

  const transparentProxyLikely = score >= 2;
  const confidence = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  return { transparentProxyLikely, confidence, evidence };
}

export const PROXY_FINGERPRINT = {
  analyzeWPAD,
  detectProxyAutoConfig,
  probeSocksVersion,
  analyzeProxyHeaders,
  detectTransparentProxy,
  SOCKS_VERSION_TABLE,
  PROXY_HEADER_TABLE,
};
export default PROXY_FINGERPRINT;
