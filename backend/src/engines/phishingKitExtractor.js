/**
 * phishingKitExtractor.js — phishing-kit hostname and indicator extraction.
 *
 * Seized or reported phishing kits (HTML/PHP/JS bundles impersonating a brand)
 * contain the attacker's infrastructure: credential exfiltration endpoints,
 * C2 hosts, drop email addresses, and Telegram/Discord exfil channels. This
 * module parses kit contents supplied by the analyst and extracts those
 * indicators with line-level evidence, classifying each hostname by role.
 *
 * Defensive use only: it parses text the analyst already possesses. It never
 * fetches kits, never executes kit code, and never includes exploit payloads.
 */

const URL_RE = /\bhttps?:\/\/[^\s"'<>()\\]+/gi;
const BARE_DOMAIN_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)\b/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const TELEGRAM_BOT_RE = /api\.telegram\.org\/bot(\d+):([A-Za-z0-9_-]{10,})/gi;
const DISCORD_WEBHOOK_RE = /discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([A-Za-z0-9_-]{10,})/gi;

/**
 * File extensions that are not registrable domain TLDs in practice — prevents
 * bare-path fragments like "submit.php" from being extracted as hostnames.
 */
const NON_DOMAIN_EXTENSIONS = new Set([
  'php',
  'html',
  'htm',
  'js',
  'css',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'ico',
  'json',
  'xml',
  'txt',
  'pdf',
  'zip',
  'exe',
  'dll',
  'aspx',
  'jsp',
  'cgi',
  'woff',
  'woff2',
  'ttf',
  'map',
  'ts',
  'py',
  'rb',
  'pl',
  'sh',
]);

/** Code patterns that indicate credential/result exfiltration in kit sources. */
export const EXFIL_PATTERNS = [
  {
    name: 'php-mail-exfil',
    pattern: /\bmail\s*\(/i,
    description: 'PHP mail() call — credentials emailed to attacker',
  },
  {
    name: 'post-harvest',
    pattern: /\$_(POST|REQUEST)\b/,
    description: 'reads submitted form fields (credential harvesting)',
  },
  {
    name: 'raw-input-harvest',
    pattern: /file_get_contents\s*\(\s*['"]php:\/\/input['"]\s*\)/i,
    description: 'reads raw POST body (credential harvesting)',
  },
  {
    name: 'curl-exfil',
    pattern: /\bcurl_(init|exec)\b/i,
    description: 'cURL call — results pushed to remote host',
  },
  {
    name: 'fetch-exfil',
    pattern: /\bfetch\s*\(\s*['"`]https?:/i,
    description: 'fetch() to remote URL — browser-side exfiltration',
  },
  {
    name: 'query-exfil',
    pattern: /[?&](?:data|result|credentials|dump|info)=/i,
    description: 'exfil parameter in request URL',
  },
  {
    name: 'encoded-payload',
    pattern: /\bbase64_(decode|encode)\b/i,
    description: 'base64 obfuscation of exfiltrated data or config',
  },
  {
    name: 'file-write',
    pattern: /\bfwrite\s*\(|\bfile_put_contents\s*\(/i,
    description: 'writes harvested data to a local drop file',
  },
  {
    name: 'header-redirect',
    pattern: /\bheader\s*\(\s*['"]Location:/i,
    description: 'redirects victim after harvesting',
  },
];

/**
 * Extract the hostname from a URL string.
 * @param {string} url
 * @returns {string|null}
 */
export function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * All unique hostnames referenced anywhere in the kit text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractHostnames(text) {
  const src = String(text || '');
  const hosts = new Set();
  for (const m of src.match(URL_RE) || []) {
    const h = hostnameFromUrl(m.replace(/[.,;:!?]+$/, ''));
    if (h) hosts.add(h);
  }
  for (const m of src.match(BARE_DOMAIN_RE) || []) {
    const tld = m.split('.').pop().toLowerCase();
    if (NON_DOMAIN_EXTENSIONS.has(tld)) continue; // file path, not a hostname
    hosts.add(m.toLowerCase());
  }
  return [...hosts];
}

/**
 * Hostnames referenced on the same lines as exfiltration patterns — the
 * strongest signal that a host is an exfil endpoint rather than a decoy.
 * @param {string} text
 * @returns {Map<string, string[]>} host -> exfil pattern names seen nearby
 */
export function exfilLineHosts(text) {
  const map = new Map();
  for (const line of String(text || '').split('\n')) {
    const hits = EXFIL_PATTERNS.filter(p => p.pattern.test(line)).map(p => p.name);
    if (!hits.length) continue;
    for (const host of extractHostnames(line)) {
      const prev = map.get(host) || [];
      map.set(host, [...new Set([...prev, ...hits])]);
    }
  }
  return map;
}

/** Email addresses found in the kit (attacker drop boxes, not victims'). */
export function extractEmails(text) {
  return [...new Set((String(text || '').match(EMAIL_RE) || []).map(e => e.toLowerCase()))];
}

/** IPv4 addresses found in the kit (validated octets). */
export function extractIps(text) {
  const out = new Set();
  for (const m of String(text || '').match(IPV4_RE) || []) {
    if (m.split('.').every(o => Number(o) <= 255)) out.add(m);
  }
  return [...out];
}

/**
 * Telegram bot exfil channels. Bot tokens are masked — only the bot id is
 * kept, which is sufficient for abuse reporting to Telegram.
 */
export function extractTelegramBots(text) {
  const out = [];
  for (const m of String(text || '').matchAll(TELEGRAM_BOT_RE)) {
    out.push({
      channel: 'telegram',
      botId: m[1],
      token: '<redacted>',
      raw: `api.telegram.org/bot${m[1]}:<redacted>`,
    });
  }
  return out;
}

/**
 * Discord webhook exfil channels. Webhook tokens are masked — the webhook id
 * is kept for abuse reporting to Discord.
 */
export function extractDiscordWebhooks(text) {
  const out = [];
  for (const m of String(text || '').matchAll(DISCORD_WEBHOOK_RE)) {
    out.push({
      channel: 'discord',
      webhookId: m[1],
      token: '<redacted>',
      raw: `discord.com/api/webhooks/${m[1]}/<redacted>`,
    });
  }
  return out;
}

/** Exfiltration code patterns present anywhere in the kit. */
export function detectExfilPatterns(text) {
  const src = String(text || '');
  return EXFIL_PATTERNS.filter(p => p.pattern.test(src)).map(p => ({
    name: p.name,
    description: p.description,
  }));
}

/**
 * Classify an extracted hostname by its likely role.
 * @param {string} host
 * @param {{brand?: string, orgDomains?: string[], exfilHosts?: Set<string>}} ctx
 * @returns {{host: string, role: 'phishing-impersonation'|'exfil-endpoint'|'attacker-owned'|'org-domain'|'third-party'|'unknown', evidence: string}}
 */
export function classifyExtractedHost(host, ctx = {}) {
  const h = String(host || '').toLowerCase();
  const brand = String(ctx.brand || '').toLowerCase();
  const org = new Set((ctx.orgDomains || []).map(d => String(d).toLowerCase()));
  const exfil = ctx.exfilHosts instanceof Set ? ctx.exfilHosts : new Set();

  if (org.has(h) || [...org].some(o => h === o || h.endsWith(`.${o}`))) {
    return { host: h, role: 'org-domain', evidence: `matches org domain portfolio` };
  }
  if (exfil.has(h)) {
    return {
      host: h,
      role: 'exfil-endpoint',
      evidence: `referenced on lines containing exfiltration code patterns`,
    };
  }
  if (brand && h.includes(brand)) {
    return {
      host: h,
      role: 'phishing-impersonation',
      evidence: `contains brand "${brand}" but is not an org domain`,
    };
  }
  if (/[^\x00-\x7F]/.test(h)) {
    return {
      host: h,
      role: 'phishing-impersonation',
      evidence: `non-ASCII hostname suggests IDN homograph lure`,
    };
  }
  if (/^(api\.telegram\.org|discord\.com|discordapp\.com)$/.test(h)) {
    return {
      host: h,
      role: 'exfil-endpoint',
      evidence: `messaging platform used as exfil channel`,
    };
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    return {
      host: h,
      role: 'attacker-owned',
      evidence: `bare IP literal — typical of bulletproof/throwaway infra`,
    };
  }
  return { host: h, role: 'unknown', evidence: `no brand, org, or exfil signal; review manually` };
}

/**
 * Full kit analysis: hostnames with roles, drop contacts, exfil channels.
 * @param {string} kitText kit file contents supplied by the analyst
 * @param {{brand?: string, orgDomains?: string[]}} [opts]
 */
export function analyzePhishingKit(kitText, opts = {}) {
  const exfilMap = exfilLineHosts(kitText);
  const hosts = extractHostnames(kitText);
  const ctx = {
    brand: opts.brand,
    orgDomains: opts.orgDomains,
    exfilHosts: new Set(exfilMap.keys()),
  };
  const hostnames = hosts.map(h => {
    const c = classifyExtractedHost(h, ctx);
    const patterns = exfilMap.get(h);
    return { ...c, exfilPatterns: patterns || [] };
  });
  hostnames.sort((a, b) => {
    const rank = {
      'phishing-impersonation': 0,
      'exfil-endpoint': 1,
      'attacker-owned': 2,
      unknown: 3,
      'third-party': 4,
      'org-domain': 5,
    };
    return rank[a.role] - rank[b.role];
  });
  const exfilPatterns = detectExfilPatterns(kitText);
  return {
    hostnames,
    emails: extractEmails(kitText),
    ips: extractIps(kitText),
    telegramBots: extractTelegramBots(kitText),
    discordWebhooks: extractDiscordWebhooks(kitText),
    exfilPatterns,
    summary:
      `${hostnames.length} hostname(s) extracted: ` +
      `${hostnames.filter(h => h.role === 'phishing-impersonation').length} impersonation, ` +
      `${hostnames.filter(h => h.role === 'exfil-endpoint').length} exfil endpoint(s); ` +
      `${exfilPatterns.length} exfil code pattern(s) detected.`,
  };
}

export const PHISHING_KIT_EXTRACTOR = {
  EXFIL_PATTERNS,
  hostnameFromUrl,
  extractHostnames,
  exfilLineHosts,
  extractEmails,
  extractIps,
  extractTelegramBots,
  extractDiscordWebhooks,
  detectExfilPatterns,
  classifyExtractedHost,
  analyzePhishingKit,
};

export default PHISHING_KIT_EXTRACTOR;
