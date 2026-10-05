/**
 * phishingKitHostnameExtractor.js — phishing-kit hostname extraction engine.
 *
 * Covers idea-bank item 0307:
 *  - 0307 Phishing-kit hostname extraction — extract C2 and exfil hostnames
 *    from phishing kits impersonating the brand to map attacker
 *    infrastructure.
 *
 * Pure functions only: the engine parses raw kit text (HTML/PHP/JS/config
 * dumps supplied by the caller — e.g. from a seized kit archive) and pulls
 * out hostnames, flagging likely C2, exfiltration, and panel endpoints.
 * No network calls here.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s"'`<>(){}[\]]+/gi;
const IP_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g;

const EXFIL_HINTS = ['exfil', 'send', 'mail', 'smtp', 'telegram', 'bot', 'webhook', 'discord', 'receiver', 'result', 'logs'];
const C2_HINTS = ['panel', 'admin', 'gate', 'c2', 'cmd', 'control', 'dashboard', 'api', 'backend', 'server', 'botnet'];
const TRACKING_HINTS = ['pixel', 'track', 'analytics', 'beacon', 'click'];

const BENIGN_HOSTS = new Set([
  'localhost', 'example.com', 'example.org', 'w3.org', 'schema.org',
  'jquery.com', 'cdnjs.cloudflare.com', 'unpkg.com', 'jsdelivr.net',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'ajax.googleapis.com',
]);

/** File extensions that the hostname regex can mistake for a TLD when they
 * appear as path segments (e.g. gate.php inside a URL). */
const FILE_EXTENSION_TLDS = new Set([
  'php', 'html', 'htm', 'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg',
  'ico', 'webp', 'pdf', 'zip', 'tar', 'gz', 'xml', 'json', 'txt', 'exe',
  'dll', 'wav', 'mp3', 'mp4', 'avi', 'mov', 'apk', 'dmg', 'iso', 'rar',
  'csv', 'ttf', 'woff', 'woff2', 'eot', 'asp', 'aspx', 'jsp', 'log', 'bak',
]);

/**
 * Check whether a "hostname" is really a filename with an extension.
 * @param {string} host
 * @returns {boolean}
 */
export function isFilenameExtensionHost(host) {
  const tld = host.split('.').pop() || '';
  return FILE_EXTENSION_TLDS.has(tld);
}

/**
 * Normalize a hostname: lowercase, strip port and trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeKitHostname(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Guess the role of a hostname from the text surrounding its occurrences.
 *
 * @param {string} host Normalized hostname
 * @param {string[]} contexts Surrounding text snippets (lowercased)
 * @returns {{role: 'exfil'|'c2'|'tracking'|'brand-spoof'|'unknown', confidence: number, evidence: string[]}}
 */
export function inferHostnameRole(host, contexts = []) {
  const evidence = [];
  const joined = (contexts || []).join(' \n ').toLowerCase();
  const h = host.toLowerCase();

  const countHints = (hints) => hints.filter((w) => joined.includes(w) || h.includes(w));

  const exfil = countHints(EXFIL_HINTS);
  const c2 = countHints(C2_HINTS);
  const tracking = countHints(TRACKING_HINTS);

  let role = 'unknown';
  let confidence = 20;
  if (exfil.length >= c2.length && exfil.length > 0) {
    role = 'exfil';
    confidence = Math.min(95, 55 + exfil.length * 10);
    evidence.push(`exfil hints: ${exfil.join(', ')}`);
  } else if (c2.length > 0) {
    role = 'c2';
    confidence = Math.min(95, 55 + c2.length * 10);
    evidence.push(`panel/C2 hints: ${c2.join(', ')}`);
  } else if (tracking.length > 0) {
    role = 'tracking';
    confidence = Math.min(80, 40 + tracking.length * 10);
    evidence.push(`tracking hints: ${tracking.join(', ')}`);
  }
  return { role, confidence, evidence };
}

/**
 * Extract hostnames from raw phishing-kit text.
 *
 * @param {string|string[]} kitText Raw kit content (one string or an array of file contents)
 * @param {{brandTokens?: string[], contextRadius?: number}} [options]
 * @returns {{
 *   hostnames: {host: string, occurrences: number, role: string, confidence: number, evidence: string[], brandRelevant: boolean}[],
 *   ips: {ip: string, occurrences: number}[],
 *   summary: {total: number, brandRelevant: number, exfil: number, c2: number}
 * }}
 */
export function extractKitHostnames(kitText, options = {}) {
  const texts = Array.isArray(kitText) ? kitText : [kitText];
  const radius = options.contextRadius ?? 120;
  const brandTokens = (options.brandTokens || []).map((t) => String(t || '').toLowerCase()).filter(Boolean);

  const counts = new Map();
  const contexts = new Map();

  const addContext = (host, fullText, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(fullText.length, index + host.length + radius);
    if (!contexts.has(host)) contexts.set(host, []);
    contexts.get(host).push(fullText.slice(start, end).toLowerCase());
  };

  for (const raw of texts) {
    const text = String(raw || '');
    if (!text) continue;

    let m;
    HOSTNAME_RE.lastIndex = 0;
    while ((m = HOSTNAME_RE.exec(text)) !== null) {
      const host = normalizeKitHostname(m[0]);
      if (!host || BENIGN_HOSTS.has(host) || isFilenameExtensionHost(host)) continue;
      counts.set(host, (counts.get(host) || 0) + 1);
      addContext(host, text, m.index);
    }

    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(text)) !== null) {
      try {
        const host = normalizeKitHostname(new URL(m[0]).hostname);
        if (!host || BENIGN_HOSTS.has(host)) continue;
        counts.set(host, (counts.get(host) || 0) + 1);
        addContext(host, text, m.index);
      } catch {
        // Not a parseable URL — hostname regex above already covered it.
      }
    }
  }

  const ipCounts = new Map();
  for (const raw of texts) {
    const text = String(raw || '');
    IP_RE.lastIndex = 0;
    let m;
    while ((m = IP_RE.exec(text)) !== null) {
      if (m[0].startsWith('127.') || m[0].startsWith('10.') || m[0].startsWith('192.168.')) continue;
      ipCounts.set(m[0], (ipCounts.get(m[0]) || 0) + 1);
    }
  }

  const hostnames = [];
  for (const [host, occurrences] of counts) {
    const { role, confidence, evidence } = inferHostnameRole(host, contexts.get(host) || []);
    const brandRelevant = brandTokens.some((t) => t && host.includes(t));
    hostnames.push({ host, occurrences, role, confidence, evidence, brandRelevant });
  }

  hostnames.sort((a, b) => {
    const rank = { exfil: 0, c2: 1, tracking: 2, 'brand-spoof': 3, unknown: 4 };
    return (rank[a.role] ?? 4) - (rank[b.role] ?? 4) || b.confidence - a.confidence || b.occurrences - a.occurrences;
  });

  return {
    hostnames,
    ips: [...ipCounts.entries()]
      .map(([ip, occurrences]) => ({ ip, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences),
    summary: {
      total: hostnames.length,
      brandRelevant: hostnames.filter((h) => h.brandRelevant).length,
      exfil: hostnames.filter((h) => h.role === 'exfil').length,
      c2: hostnames.filter((h) => h.role === 'c2').length,
    },
  };
}

/**
 * Map kit-extracted infrastructure into blocklist-ready indicators:
 * C2/exfil hosts plus IPs, deduplicated and annotated for takedown context.
 *
 * @param {ReturnType<typeof extractKitHostnames>} extraction
 * @param {string} [kitName]
 * @returns {{type: 'domain'|'ipv4', value: string, role: string, confidence: number, context: string}[]}
 */
export function buildKitIndicatorList(extraction, kitName = '') {
  const out = [];
  const seen = new Set();
  const ctx = kitName ? `phishing kit "${kitName}"` : 'phishing kit';
  for (const h of extraction?.hostnames || []) {
    if (h.role !== 'exfil' && h.role !== 'c2') continue;
    if (seen.has(h.host)) continue;
    seen.add(h.host);
    out.push({ type: 'domain', value: h.host, role: h.role, confidence: h.confidence, context: ctx });
  }
  for (const { ip } of extraction?.ips || []) {
    if (seen.has(ip)) continue;
    seen.add(ip);
    out.push({ type: 'ipv4', value: ip, role: 'infrastructure', confidence: 40, context: ctx });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}
