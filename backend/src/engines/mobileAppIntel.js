/**
 * mobileAppIntel.js — Mobile application host-intelligence engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capabilities that parse mobile-app artefacts
 * (decompiled APK text, AndroidManifest.xml, network_security_config.xml,
 * iOS Info.plist files and pinning configuration) to enumerate the backend
 * hosts a target's mobile apps talk to. Covers idea-bank items 00041–00043:
 *
 *  00041 Mobile APK host extraction
 *  00042 iOS IPA plist host mining
 *  00043 Mobile app certificate-pinning host list
 *
 * All functions are pure and side-effect free: they parse text the caller
 * obtained legally during an authorized engagement (e.g. via `strings`,
 * apktool/jadx output, or plutil-converted plists). Decompiling itself is
 * intentionally left to the caller so the engine stays testable and safe to
 * run anywhere. No APK/IPA binaries are fetched or handled here.
 */

const URL_RE = /\b(?:https?|wss?|ftp):\/\/[^\s"'<>\\\]]+/gi;
const HOST_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const SOCKET_RE = /\b(?:tcp|udp|mqtt|mqtts|amqp|amqps|coap|coaps|stomp|xmpp|rtsp|rtmp|smtp|smpts|imap|pop3|grpc):\/\/[^\s"'<>\\\]]+/gi;
const PORT_RE = /:(\d{2,5})\b/;

/** Hosts that are noise in every mobile bundle and must be filtered out. */
const NOISE_HOSTS = new Set([
  'localhost', '127.0.0.1', 'schemas.android.com', 'www.w3.org',
  'apache.org', 'opensource.org', 'github.com', 'gradle.org',
]);

/**
 * Normalize a raw host candidate.
 * @param {string} host
 * @returns {string|null} Lowercased host, or null when it is noise.
 */
export function normalizeHost(host) {
  if (!host) return null;
  const h = host.toLowerCase().replace(/\.$/, '');
  if (NOISE_HOSTS.has(h)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const octets = h.split('.').map(Number);
    if (octets.some((o) => o > 255)) return null;
    if (h === '0.0.0.0' || h === '255.255.255.255') return null;
  }
  return h;
}

/**
 * Extract a hostname from a URL-like string.
 * @param {string} url
 * @returns {string|null}
 */
export function hostFromUrl(url) {
  if (!url) return null;
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

/**
 * Extract every hardcoded host, API base URL and socket endpoint from
 * decompiled APK text (idea 00041).
 *
 * Accepts the concatenated output of `strings`, jadx/apktool sources,
 * `res/values/strings.xml`, Gradle `BuildConfig` dumps, etc.
 *
 * @param {string} text Decompiled text to mine.
 * @returns {{hosts: string[], baseUrls: string[], sockets: string[], ips: string[]}}
 */
export function extractApkHosts(text) {
  const hosts = new Set();
  const baseUrls = new Set();
  const sockets = new Set();
  const ips = new Set();
  if (!text || typeof text !== 'string') return { hosts: [], baseUrls: [], sockets: [], ips: [] };

  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0].replace(/[),;.!?]+$/, '');
    const h = hostFromUrl(raw);
    if (h) {
      hosts.add(h);
      const proto = raw.split('://')[0].toLowerCase();
      if (proto === 'http' || proto === 'https') baseUrls.add(raw);
      else sockets.add(raw);
    }
  }
  for (const m of text.matchAll(SOCKET_RE)) {
    const raw = m[0].replace(/[),;.!?]+$/, '');
    sockets.add(raw);
    const h = hostFromUrl(raw);
    if (h) hosts.add(h);
  }
  for (const m of text.matchAll(HOST_RE)) {
    const h = normalizeHost(m[0]);
    if (h) hosts.add(h);
  }
  for (const m of text.matchAll(IPV4_RE)) {
    const h = normalizeHost(m[0]);
    if (h) ips.add(h);
  }
  return {
    hosts: [...hosts].sort(),
    baseUrls: [...baseUrls].sort(),
    sockets: [...sockets].sort(),
    ips: [...ips].sort(),
  };
}

/**
 * Parse AndroidManifest.xml text (idea 00041): package name, deep-link
 * schemes/hosts from intent-filters, and declared permissions.
 *
 * @param {string} xml
 * @returns {{packageName: string|null, deepLinks: {scheme: string, host: string|null}[], permissions: string[]}}
 */
export function parseAndroidManifest(xml) {
  const out = { packageName: null, deepLinks: [], permissions: [] };
  if (!xml || typeof xml !== 'string') return out;
  const pkg = xml.match(/<manifest[^>]*\bpackage\s*=\s*["']([^"']+)["']/i);
  if (pkg) out.packageName = pkg[1];
  const permRe = /<uses-permission[^>]*android:name\s*=\s*["']([^"']+)["']/gi;
  for (const m of xml.matchAll(permRe)) out.permissions.push(m[1]);
  const dataRe = /<data[^>]*>/gi;
  for (const m of xml.matchAll(dataRe)) {
    const tag = m[0];
    const scheme = (tag.match(/android:scheme\s*=\s*["']([^"']+)["']/i) || [])[1];
    const host = (tag.match(/android:host\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (scheme) out.deepLinks.push({ scheme, host: host ? normalizeHost(host) : null });
  }
  return out;
}

/**
 * Parse a network_security_config.xml dump (idea 00043): per-domain
 * pin sets, cleartext-traffic flags and debug overrides.
 *
 * @param {string} xml
 * @returns {{domains: {domain: string, includeSubdomains: boolean, cleartextPermitted: boolean, pins: string[], expiration: string|null}[]}}
 */
export function parseNetworkSecurityConfig(xml) {
  const domains = [];
  if (!xml || typeof xml !== 'string') return { domains };
  const dcRe = /<domain-config[^>]*>([\s\S]*?)<\/domain-config>/gi;
  for (const m of xml.matchAll(dcRe)) {
    const block = m[0];
    const cleartext = /cleartextTrafficPermitted\s*=\s*["']true["']/i.test(block);
    const pinBlock = block.match(/<pin-set[^>]*>([\s\S]*?)<\/pin-set>/i);
    const pins = [];
    let expiration = null;
    if (pinBlock) {
      for (const p of pinBlock[1].matchAll(/<pin[^>]*>([^<]+)<\/pin>/gi)) {
        pins.push(p[1].trim());
      }
      const exp = pinBlock[0].match(/expiration\s*=\s*["']([^"']+)["']/i);
      if (exp) expiration = exp[1];
    }
    const domainRe = /<domain([^>]*)>([^<]+)<\/domain>/gi;
    for (const d of block.matchAll(domainRe)) {
      const attrs = d[1] || '';
      const includeSub = /includeSubdomains\s*=\s*["']true["']/i.test(attrs);
      const domain = normalizeHost(d[2].trim());
      if (domain) domains.push({ domain, includeSubdomains: includeSub, cleartextPermitted: cleartext, pins, expiration });
    }
  }
  return { domains };
}

/**
 * Parse an OkHttp `CertificatePinner` builder snippet (idea 00043).
 * e.g. `new CertificatePinner.Builder().add("api.example.com", "sha256/AAAA...")`.
 *
 * @param {string} text Decompiled Java/Kotlin or smali-ish text.
 * @returns {{host: string, pins: string[]}[]}
 */
export function parseOkHttpCertificatePinner(text) {
  const out = [];
  if (!text || typeof text !== 'string') return out;
  const re = /\.add\(\s*["']([^"']+)["']\s*,\s*((?:"sha256\/[^"']+"|[^)]+))\)/g;
  for (const m of text.matchAll(re)) {
    const host = normalizeHost(m[1]);
    if (!host) continue;
    const pins = [...m[2].matchAll(/"([^"]+)"/g)].map((p) => p[1]).filter((p) => /^sha256\//.test(p));
    out.push({ host, pins });
  }
  return out;
}

/**
 * Parse a TrustKit / react-native pinning configuration blob (idea 00043).
 *
 * @param {string} text Raw config text (JSON-ish, XML or JS).
 * @returns {{host: string, pins: string[]}[]}
 */
export function parseTrustKitConfig(text) {
  const out = [];
  if (!text || typeof text !== 'string') return out;
  const re = /["']?([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63})["']?\s*[:=]\s*\{[^}]*?(?:pin|publicKeyHashes|pins)[^}]*?\}/gi;
  for (const m of text.matchAll(re)) {
    const host = normalizeHost(m[1]);
    if (!host) continue;
    const pins = [...m[0].matchAll(/"((?:sha256\/)?[A-Za-z0-9+/=]{20,})"/g)]
      .map((p) => p[1])
      .filter((p) => /sha256\//.test(p) || /^[A-Za-z0-9+/=]{40,}$/.test(p));
    out.push({ host, pins: [...new Set(pins)] });
  }
  return out;
}

/**
 * Consolidate every pinned host from every supported pinning format
 * (idea 00043).
 *
 * @param {{networkSecurityXml?: string, okhttpText?: string, trustKitText?: string}} inputs
 * @returns {{host: string, sources: string[], pins: string[], cleartextPermitted: boolean}[]}
 */
export function consolidatePinningHosts(inputs = {}) {
  const byHost = new Map();
  const add = (host, source, pins = [], cleartext = false) => {
    if (!host) return;
    const cur = byHost.get(host) || { host, sources: [], pins: [], cleartextPermitted: false };
    if (!cur.sources.includes(source)) cur.sources.push(source);
    for (const p of pins) if (!cur.pins.includes(p)) cur.pins.push(p);
    cur.cleartextPermitted = cur.cleartextPermitted || cleartext;
    byHost.set(host, cur);
  };
  if (inputs.networkSecurityXml) {
    for (const d of parseNetworkSecurityConfig(inputs.networkSecurityXml).domains) {
      add(d.domain, 'network_security_config', d.pins, d.cleartextPermitted);
    }
  }
  if (inputs.okhttpText) {
    for (const p of parseOkHttpCertificatePinner(inputs.okhttpText)) add(p.host, 'okhttp', p.pins);
  }
  if (inputs.trustKitText) {
    for (const p of parseTrustKitConfig(inputs.trustKitText)) add(p.host, 'trustkit', p.pins);
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Parse an iOS Info.plist (XML form) for ATS exceptions and embedded URLs
 * (idea 00042).
 *
 * @param {string} plist Plist XML text (convert binary plists with plutil first).
 * @returns {{atsExceptions: {domain: string, allowsInsecureLoads: boolean, includesSubdomains: boolean, minimumTLS: string|null}[], urlSchemes: string[], embeddedUrls: string[], bundleId: string|null}}
 */
export function parseIosPlist(plist) {
  const out = { atsExceptions: [], urlSchemes: [], embeddedUrls: [], bundleId: null };
  if (!plist || typeof plist !== 'string') return out;
  const bundleId = plist.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/i);
  if (bundleId) out.bundleId = bundleId[1].trim();

  // Scan the whole plist for NSExceptionDomains entries directly: a domain-like
  // <key> followed by a <dict> whose contents mention NSException keys.
  const domainRe = /<key>([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63})<\/key>\s*<dict>([\s\S]*?)(?:<\/dict>|$)/gi;
  for (const m of plist.matchAll(domainRe)) {
    const domain = normalizeHost(m[1].trim());
    if (!domain) continue;
    const cfg = m[2];
    if (!/NSException|NSTemporaryException|NSIncludesSubdomains/i.test(cfg)) continue;
    const allowsInsecure = /<key>NSExceptionAllowsInsecureHTTPLoads<\/key>\s*<true\/>/i.test(cfg)
      || /<key>NSTemporaryExceptionAllowsInsecureHTTPLoads<\/key>\s*<true\/>/i.test(cfg);
    const includesSub = /<key>NSIncludesSubdomains<\/key>\s*<true\/>/i.test(cfg);
    const tls = cfg.match(/<key>NSExceptionMinimumTLSVersion<\/key>\s*<string>([^<]+)<\/string>/i);
    out.atsExceptions.push({
      domain, allowsInsecureLoads: allowsInsecure, includesSubdomains: includesSub,
      minimumTLS: tls ? tls[1].trim() : null,
    });
  }

  const urlTypes = plist.match(/<key>CFBundleURLTypes<\/key>\s*<array>([\s\S]*?)<\/array>/i);
  if (urlTypes) {
    for (const m of urlTypes[1].matchAll(/<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)(?:<\/array>|$)/gi)) {
      for (const s of m[1].matchAll(/<string>([^<]+)<\/string>/g)) out.urlSchemes.push(s[1].trim());
    }
  }

  for (const m of plist.matchAll(URL_RE)) {
    const raw = m[0].replace(/[),;.!?]+$/, '');
    out.embeddedUrls.push(raw);
  }
  out.embeddedUrls = [...new Set(out.embeddedUrls)].sort();
  return out;
}

/**
 * Rank mobile-app hosts by how "interesting" they are for an authorized
 * bug-bounty hunt: API/staging/dev labels score highest.
 *
 * @param {string[]} hosts
 * @returns {{host: string, score: number, reasons: string[]}[]}
 */
export function rankMobileHosts(hosts) {
  const interesting = ['api', 'staging', 'stage', 'dev', 'test', 'qa', 'uat', 'internal', 'beta', 'preprod', 'sandbox', 'admin'];
  return [...new Set(hosts)]
    .filter(Boolean)
    .map((host) => {
      const lower = host.toLowerCase();
      const reasons = [];
      let score = 1;
      for (const kw of interesting) {
        if (lower.includes(kw)) { score += 3; reasons.push(`contains '${kw}'`); }
      }
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) { score += 2; reasons.push('bare IPv4 address'); }
      if (PORT_RE.test(host)) { score += 1; reasons.push('explicit port'); }
      return { host, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}

export default {
  extractApkHosts,
  parseAndroidManifest,
  parseNetworkSecurityConfig,
  parseOkHttpCertificatePinner,
  parseTrustKitConfig,
  consolidatePinningHosts,
  parseIosPlist,
  rankMobileHosts,
  normalizeHost,
  hostFromUrl,
};
