/**
 * remoteAccessPortalDetector.js — Remote-access portal fingerprinting.
 *
 * Ideas 00571–00575: passive signature-based detection of enterprise
 * remote-access infrastructure exposed during an authorized assessment —
 * SSL-VPN login portals, Citrix Gateways, F5 BIG-IP devices, Palo Alto
 * GlobalProtect portals, and Zscaler cloud-node mapping.
 *
 * All detectors are pure, offline heuristics: they match captured HTTP
 * response metadata (URLs, status codes, headers, Set-Cookie names, and
 * body snippets) and DNS hostnames against vendor signature tables. They
 * perform no exploitation — they only name the exposed infrastructure so
 * the agent can scope and report the attack surface accurately.
 */

/**
 * Login-page signatures for common SSL-VPN portals (idea 571).
 * `body` matches against a captured login-page HTML snippet; `paths`
 * matches against the request URL path; `headers`/`cookies` against
 * response metadata.
 */
const SSL_VPN_SIGNATURES = [
  {
    vendor: 'Fortinet FortiGate / FortiOS SSL-VPN',
    weight: 3,
    paths: [/^\/remote\/login$/i, /\/sslvpn/i, /^\/remote\/index$/i],
    body: /fortigate|fortinet ssl-vpn|id="sslvpnsplash"|var fgt_lang|fortios/i,
    cookies: [/^apscookie$/i, /^svmcookie$/i, /^fgtserver/i],
  },
  {
    vendor: 'Ivanti Connect Secure (Pulse Secure)',
    weight: 3,
    paths: [/^\/dana-na\/auth/i, /^\/dana-admin/i, /^\/dana-cached/i],
    body: /pulse secure|dana|ivanti connect secure|DSIDLogin/i,
    cookies: [/^dsid$/i, /^dsps/i, /^dspreauth$/i],
  },
  {
    vendor: 'Cisco Secure Client / ASA SSL-VPN',
    weight: 3,
    paths: [/^\/\+webvpn\+/i, /^\/\+csco\+/i, /^\/\+webvpncli\+/i],
    body: /cisco anyconnect|webvpn|cisco secure client|csco_/i,
    cookies: [/^webvpncontext$/i, /^webvpn$/i],
  },
  {
    vendor: 'SonicWall SMA / NetExtender',
    weight: 2,
    paths: [/^\/cgi-bin\/welcome$/i, /\/netextender/i],
    body: /sonicwall|netextender|secure mobile access|swa_/i,
    cookies: [/^sessid$/i, /^swasession/i],
  },
  {
    vendor: 'Check Point Mobile Access / SNX',
    weight: 2,
    paths: [/^\/sslvpn/i, /\/portal/i],
    body: /check point mobile access|snx|checkpoint_ssl_network/i,
    cookies: [/^cp_/i],
  },
  {
    vendor: 'Array Networks AG',
    weight: 2,
    paths: [/^\/array_ssl_vpn/i],
    body: /array networks|array ssl vpn|speedtransfer/i,
    cookies: [],
  },
  {
    vendor: 'Barracuda SSL VPN',
    weight: 2,
    paths: [/^\/default\.cgi$/i],
    body: /barracuda ssl vpn|barracuda networks/i,
    cookies: [/^barracuda/i],
  },
];

/**
 * Detect an SSL-VPN portal from captured response metadata (idea 571).
 * Pure signature matching — never sends new requests.
 *
 * @param {{url?: string, status?: number, headers?: Record<string,string>, setCookies?: string[], body?: string}} input
 * @returns {{detected: boolean, vendor?: string, confidence: 'high'|'medium'|'low'|'none', matches: string[]}}
 */
export function detectSslVpnPortal({ url = '', status = 0, headers = {}, setCookies = [], body = '' }) {
  let path = '';
  try { path = new URL(url).pathname; } catch { path = url; }
  const cookieHeader = (setCookies || []).join('\n');
  const headerText = Object.entries(headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

  let best = null;
  let bestScore = 0;
  for (const sig of SSL_VPN_SIGNATURES) {
    let score = 0;
    const matches = [];
    if (sig.paths.some((re) => re.test(path))) { score += sig.weight; matches.push('path'); }
    if (sig.body && sig.body.test(body || '')) { score += sig.weight; matches.push('body'); }
    if (sig.cookies.some((re) => re.test(cookieHeader))) { score += sig.weight; matches.push('cookie'); }
    if (/ssl|vpn/i.test(headerText)) { score += 1; matches.push('header-hint'); }
    if (score > bestScore) { bestScore = score; best = { sig, matches }; }
  }

  const confidence = bestScore >= 6 ? 'high' : bestScore >= 3 ? 'medium' : bestScore > 0 ? 'low' : 'none';
  const result = { detected: bestScore > 0, confidence, matches: best ? best.matches : [] };
  if (best) result.vendor = best.sig.vendor;
  if (status >= 400 && bestScore > 0) result.note = `Non-200 status (${status}) — portal may be redirecting or erroring; treat vendor as provisional.`;
  return result;
}

/**
 * Citrix Gateway / NetScaler ADC fingerprint markers (idea 572).
 * Covers gateway portal paths, Citrix auth-flow endpoints, ICA
 * delivery markers, and NetScaler session cookies.
 */
const CITRIX_GATEWAY_SIGNATURES = {
  portalPaths: [
    /\/vpn\/index\.html$/i,
    /\/vpn\/tmindex\.html$/i,
    /\/logon\/logonpoint/i,
    /\/nf\/auth\/web/i,
    /\/citrix\/storeweb/i,
    /\/citrix\/.*\/auth/i,
  ],
  authFlowMarkers: [
    /\/epa\/epa\.html/i,
    /\/nsg_epa/i,
    /logonpoint\/tmindex/i,
    /agreecookie/i,
    /rfweb/i,
  ],
  icaMarkers: [/ica/i, /\.ica$/i, /launch\.ica/i, /citrix\.ica\.client/i, /x-citrix/i],
  cookies: [/^NSC_/i, /^NSC_TMAA/i, /^NSC_TMAS/i, /^NSC_VPN/i, /^CsrfToken/i],
  body: /citrix gateway|netscaler gateway|citrix receiver|storefront|agsso/i,
  serverHeaders: [/citrix/i, /netscaler/i, /citrix-ndh/i],
};

/**
 * Fingerprint a Citrix Gateway from captured traffic metadata (idea 572).
 * Looks at portal URLs, auth-flow endpoints, ICA delivery markers,
 * NetScaler session cookies, and HTML signatures.
 *
 * @param {{url?: string, headers?: Record<string,string>, setCookies?: string[], body?: string, icaDiscovered?: boolean}} input
 * @returns {{detected: boolean, confidence: 'high'|'medium'|'low'|'none', indicators: string[], product: string}}
 */
export function fingerprintCitrixGateway({ url = '', headers = {}, setCookies = [], body = '', icaDiscovered = false }) {
  let path = '';
  try { path = new URL(url).pathname; } catch { path = url; }
  const cookieHeader = (setCookies || []).join('\n');
  const headerText = Object.entries(headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

  const indicators = [];
  if (CITRIX_GATEWAY_SIGNATURES.portalPaths.some((re) => re.test(path))) indicators.push('gateway-portal-path');
  if (CITRIX_GATEWAY_SIGNATURES.authFlowMarkers.some((re) => re.test(path))) indicators.push('auth-flow-endpoint');
  if (CITRIX_GATEWAY_SIGNATURES.icaMarkers.some((re) => re.test(path))) indicators.push('ica-delivery-path');
  if (CITRIX_GATEWAY_SIGNATURES.cookies.some((re) => re.test(cookieHeader))) indicators.push('netscaler-session-cookie');
  if (CITRIX_GATEWAY_SIGNATURES.body.test(body || '')) indicators.push('portal-html-signature');
  if (CITRIX_GATEWAY_SIGNATURES.serverHeaders.some((re) => re.test(headerText))) indicators.push('citrix-server-header');
  if (/x-citrix/i.test(headerText)) indicators.push('citrix-response-header');
  if (icaDiscovered) indicators.push('ica-file-observed');

  const score = indicators.length;
  const confidence = score >= 3 ? 'high' : score === 2 ? 'medium' : score === 1 ? 'low' : 'none';
  const product =
    indicators.includes('gateway-portal-path') || indicators.includes('netscaler-session-cookie')
      ? 'Citrix Gateway (NetScaler ADC)'
      : 'Possible Citrix component';
  return { detected: score > 0, confidence, indicators, product };
}

/**
 * F5 BIG-IP detection signatures (idea 573): pool cookie formats,
 * device headers, and error-page markers.
 */
const F5_BIGIP_SIGNATURES = {
  cookieFormats: [
    { re: /^BIGipServer[\w.\-~]+=/im, label: 'BIGipServer pool cookie' },
    { re: /^BIGipServer<pool>/im, label: 'BIGipServer pool-cookie template' },
    { re: /^F5_fullWT/im, label: 'F5_fullWT cookie' },
    { re: /^MRHSession/im, label: 'MRHSession (F5 APM) cookie' },
    { re: /^LastMRH_Session/im, label: 'LastMRH_Session cookie' },
    { re: /^MRHSequence/im, label: 'MRHSequence cookie' },
  ],
  headers: [/^x-f5/i, /big-ip/i],
  body: [
    /big-?ip can not find/i,
    /the requested url .* was rejected/i,
    /f5 networks/i,
    /<title>\s*big-?ip/i,
  ],
  errorPaths: [/\/my\.policy$/i, /\/my\.logout\.php3$/i, /\/f5-w-/i],
  versions: [/BIG-IP\s+(\d+\.\d+(?:\.\d+)?)/i, /TMOS\s+v?(\d+\.\d+(?:\.\d+)?)/i],
};

/**
 * Detect F5 BIG-IP devices and estimate the version from passive
 * response metadata (idea 573). Cookie formats are the strongest
 * signal; version strings are only extracted when exposed.
 *
 * @param {{url?: string, status?: number, headers?: Record<string,string>, setCookies?: string[], body?: string}} input
 * @returns {{detected: boolean, confidence: 'high'|'medium'|'low'|'none', indicators: string[], estimatedVersion?: string}}
 */
export function detectF5BigIp({ url = '', status = 0, headers = {}, setCookies = [], body = '' }) {
  let path = '';
  try { path = new URL(url).pathname; } catch { path = url; }
  const cookieHeader = (setCookies || []).join('\n');
  const headerText = Object.entries(headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

  const indicators = [];
  for (const { re, label } of F5_BIGIP_SIGNATURES.cookieFormats) {
    if (re.test(cookieHeader)) { indicators.push(label); break; }
  }
  if (F5_BIGIP_SIGNATURES.headers.some((re) => re.test(headerText))) indicators.push('f5-response-header');
  if (F5_BIGIP_SIGNATURES.body.some((re) => re.test(body || ''))) indicators.push('bigip-error-page-signature');
  if (F5_BIGIP_SIGNATURES.errorPaths.some((re) => re.test(path))) indicators.push('f5-apm-policy-path');
  if (status === 503 && /big-?ip/i.test(body || '')) indicators.push('bigip-503-error-page');

  let estimatedVersion;
  for (const re of F5_BIGIP_SIGNATURES.versions) {
    const m = (body || '').match(re) || headerText.match(re);
    if (m) { estimatedVersion = m[1]; break; }
  }

  const score = indicators.length;
  const confidence = score >= 2 ? 'high' : score === 1 ? 'medium' : 'none';
  const result = { detected: score > 0, confidence, indicators };
  if (estimatedVersion) result.estimatedVersion = estimatedVersion;
  return result;
}

/**
 * Palo Alto GlobalProtect portal markers (idea 574): the prelogin
 * endpoint pattern plus portal page and cookie signals.
 */
const GLOBALPROTECT_SIGNATURES = {
  preloginPaths: [
    /\/global-protect\/prelogin\.esp$/i,
    /\/ssl-vpn\/prelogin\.esp$/i,
    /\/global-protect\/getconfig\.esp$/i,
    /\/ssl-vpn\/getconfig\.esp$/i,
  ],
  portalPaths: [/\/php\/login\.php$/i, /\/global-protect\/login\.esp$/i],
  body: /globalprotect|global protect portal|palo alto networks|pan_gp|gp_portal/i,
  cookies: [/^PHPSESSID$/i, /^SessId/i],
  headers: [/globalprotect/i],
};

/**
 * Detect a Palo Alto GlobalProtect portal from captured metadata (idea 574).
 * The prelogin endpoint (`/global-protect/prelogin.esp`) is the
 * definitive marker; portal HTML and session cookies corroborate.
 *
 * @param {{url?: string, status?: number, headers?: Record<string,string>, setCookies?: string[], body?: string}} input
 * @returns {{detected: boolean, confidence: 'high'|'medium'|'low'|'none', indicators: string[], preloginEndpoint: boolean}}
 */
export function detectGlobalProtect({ url = '', status = 0, headers = {}, setCookies = [], body = '' }) {
  let path = '';
  try { path = new URL(url).pathname; } catch { path = url; }
  const cookieHeader = (setCookies || []).join('\n');
  const headerText = Object.entries(headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

  const indicators = [];
  const preloginEndpoint = GLOBALPROTECT_SIGNATURES.preloginPaths.some((re) => re.test(path));
  if (preloginEndpoint) indicators.push('prelogin-endpoint');
  if (GLOBALPROTECT_SIGNATURES.portalPaths.some((re) => re.test(path))) indicators.push('portal-login-path');
  if (GLOBALPROTECT_SIGNATURES.body.test(body || '')) indicators.push('portal-html-signature');
  if (GLOBALPROTECT_SIGNATURES.cookies.some((re) => re.test(cookieHeader))) indicators.push('portal-session-cookie');
  if (GLOBALPROTECT_SIGNATURES.headers.some((re) => re.test(headerText))) indicators.push('globalprotect-header');

  const score = preloginEndpoint ? indicators.length + 2 : indicators.length;
  const confidence = score >= 3 ? 'high' : score === 2 ? 'medium' : score === 1 ? 'low' : 'none';
  return { detected: score > 0, confidence, indicators, preloginEndpoint };
}

/**
 * Zscaler cloud-node hostname/IP patterns (idea 575). Zscaler Internet
 * Access (ZIA) cloud nodes follow cloud-name + city-code conventions
 * across the zscaler.net / zsedge.net families.
 */
const ZSCALER_NODE_PATTERNS = {
  cloudHosts: [
    /(?:^|\.)([a-z0-9-]+)\.zscaler\.net$/i, // e.g. ams3.zscaler.net (city-coded ZEN)
    /(?:^|\.)([a-z0-9-]+)\.zsedge\.net$/i, // ZIA edge nodes
    /(?:^|\.)([a-z0-9-]+)\.zscalerone\.net$/i,
    /(?:^|\.)([a-z0-9-]+)\.zscalertwo\.net$/i,
    /(?:^|\.)([a-z0-9-]+)\.zscalerthree\.net$/i,
    /(?:^|\.)([a-z0-9-]+)\.zscalerbeta\.net$/i,
  ],
  servicePaths: [/\/broker/i, /\/zscloud/i, /\/pbroker/i],
  cityCodes: {
    ams3: 'Amsterdam', fra3: 'Frankfurt', lhr3: 'London', cdg3: 'Paris',
    iad2: 'Ashburn', sfo2: 'San Francisco', ord2: 'Chicago', dfw2: 'Dallas',
    bom3: 'Mumbai', hyd3: 'Hyderabad', maa3: 'Chennai', sin3: 'Singapore',
    hkg3: 'Hong Kong', nrt3: 'Tokyo', syd3: 'Sydney', gru3: 'São Paulo',
  },
};

/**
 * Map Zscaler cloud nodes from observed DNS hostnames (idea 575).
 * Given a list of hostnames/IPs seen in DNS or proxy logs, classify
 * which ones belong to Zscaler cloud infrastructure and resolve
 * city-code labels to human-readable locations.
 *
 * @param {{hostnames?: string[], dnsRecords?: Array<{host: string, ips?: string[]}>}} input
 * @returns {{nodeCount: number, nodes: Array<{host: string, cloud: string, location?: string, ips?: string[]}>, summary: string}}
 */
export function mapZscalerNodes({ hostnames = [], dnsRecords = [] }) {
  const seen = new Map();
  const candidates = [];
  for (const r of dnsRecords || []) candidates.push({ host: r.host, ips: r.ips || [] });
  for (const h of hostnames || []) candidates.push({ host: h, ips: [] });

  for (const { host, ips } of candidates) {
    const key = String(host || '').toLowerCase().trim().replace(/\.$/, '');
    if (!key || seen.has(key)) continue;
    for (const re of ZSCALER_NODE_PATTERNS.cloudHosts) {
      const m = key.match(re);
      if (m) {
        const sub = m[1].toLowerCase();
        const cityCode = Object.keys(ZSCALER_NODE_PATTERNS.cityCodes).find((c) => sub.startsWith(c));
        seen.set(key, {
          host: key,
          cloud: 'Zscaler',
          location: cityCode ? ZSCALER_NODE_PATTERNS.cityCodes[cityCode] : 'unmapped-cloud-node',
          ips,
        });
        break;
      }
    }
  }

  const nodes = [...seen.values()];
  const withLoc = nodes.filter((n) => n.location !== 'unmapped-cloud-node').length;
  return {
    nodeCount: nodes.length,
    nodes,
    summary: nodes.length
      ? `${nodes.length} Zscaler cloud node${nodes.length === 1 ? '' : 's'} identified (${withLoc} with resolved location).`
      : 'No Zscaler cloud nodes in the observed hostnames.',
  };
}
