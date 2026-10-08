/**
 * emailInfraIntel.js — Email infrastructure record parsing and mapping.
 *
 * Implements idea-bank items 00066–00070 as pure parsers over DNS/email
 * records supplied by the caller:
 *  - 00066: MX host enumeration + IP mapping into an org mail-infrastructure map.
 *  - 00067: SPF include-chain recursive expansion → every third-party mail sender.
 *  - 00068: DMARC rua/ruf report mailbox mining → mail-handling subdomains and vendors.
 *  - 00069: BIMI record parsing → logo-hosting URLs, marketing-asset subdomains, CDN hosts.
 *  - 00070: MTA-STS policy parsing → declared MX hostnames (incl. ones absent from MX).
 *
 * No network access: the caller fetches TXT/HTTPS records; this module parses.
 */

/**
 * Parse one or more MX record lines into {preference, host} pairs.
 * Accepts '10 mail.example.com' strings or {preference, exchange} objects.
 * @param {(string|{preference?: number, exchange?: string})[]} mxRecords
 * @returns {{preference: number, host: string}[]}
 */
export function parseMxRecords(mxRecords) {
  const out = [];
  for (const raw of mxRecords) {
    if (typeof raw === 'string') {
      const m = raw.trim().match(/^(\d+)\s+(\S+)$/);
      if (m) out.push({ preference: Number(m[1]), host: m[2].replace(/\.+$/, '').toLowerCase() });
    } else if (raw && raw.exchange) {
      out.push({
        preference: Number(raw.preference ?? 0),
        host: String(raw.exchange).replace(/\.+$/, '').toLowerCase(),
      });
    }
  }
  return out.sort((a, b) => a.preference - b.preference);
}

/**
 * Build an org mail-infrastructure map from MX records plus resolved IPs
 * (the caller supplies the IP mapping).
 * @param {{preference: number, host: string}[]} mx
 * @param {Record<string, string[]>} [hostToIps]
 * @returns {{hosts: {host: string, preference: number, ips: string[], provider: string}[], providers: string[], webmailCandidates: string[]}}
 */
export function mapMailInfrastructure(mx, hostToIps = {}) {
  const hosts = mx.map(m => ({
    host: m.host,
    preference: m.preference,
    ips: hostToIps[m.host] || hostToIps[m.host.toLowerCase()] || [],
    provider: guessMailProvider(m.host),
  }));
  const providers = [...new Set(hosts.map(h => h.provider))];
  const webmailCandidates = hosts
    .map(h => h.host.replace(/^mail\d*\./, 'webmail.'))
    .filter((h, i, arr) => arr.indexOf(h) === i);
  return { hosts, providers, webmailCandidates };
}

/**
 * Heuristic provider guess from an MX hostname (for triage, not attribution).
 * @param {string} host
 * @returns {string}
 */
export function guessMailProvider(host) {
  const h = host.toLowerCase();
  if (h.includes('google') || h.includes('googlemail')) return 'Google Workspace';
  if (h.includes('outlook') || h.includes('protection.outlook') || h.includes('hotmail'))
    return 'Microsoft 365';
  if (h.includes('zoho')) return 'Zoho Mail';
  if (h.includes('proton')) return 'Proton Mail';
  if (h.includes('fastmail') || h.includes('messagingengine')) return 'Fastmail';
  if (h.includes('rackspace')) return 'Rackspace';
  if (h.includes('mimecast')) return 'Mimecast';
  if (h.includes('proofpoint') || h.includes('pphosted')) return 'Proofpoint';
  if (h.includes('barracuda')) return 'Barracuda';
  if (h.includes('sendgrid')) return 'SendGrid';
  if (h.includes('amazonses') || h.includes('aws')) return 'Amazon SES';
  return 'self-hosted/unknown';
}

/**
 * Tokenise an SPF record into mechanisms.
 * @param {string} spfRecord e.g. 'v=spf1 include:_spf.google.com -all'
 * @returns {{qualifier: string, mechanism: string, value: string}[]}
 */
export function tokeniseSpf(spfRecord) {
  const body = String(spfRecord || '')
    .replace(/^"?(v=spf1)\s*/i, '')
    .replace(/"$/g, '');
  const tokens = [];
  for (const raw of body.split(/\s+/).filter(Boolean)) {
    const m = raw.match(/^([+\-~?]?)([a-z0-9]+)(?::([^/\s]+))?(\/\d+)?$/i);
    if (!m) continue;
    tokens.push({
      qualifier: m[1] || '+',
      mechanism: m[2].toLowerCase(),
      value: (m[3] || '').toLowerCase(),
    });
  }
  return tokens;
}

/**
 * Recursively expand an SPF include chain. The caller supplies a resolver
 * callback: (domain) => spfRecordString | null.
 * @param {string} spfRecord root SPF record text
 * @param {(domain: string) => string|null} resolveSpf
 * @param {number} [maxDepth]
 * @returns {{senders: {domain?: string, ip?: string, mechanism: string, via: string[]}[], includes: string[], redirects: string[], truncated: boolean}}
 */
export function expandSpfChain(spfRecord, resolveSpf, maxDepth = 10) {
  const senders = [];
  const includes = [];
  const redirects = [];
  const seen = new Set();
  let truncated = false;
  const walk = (record, via, depth) => {
    if (depth > maxDepth) {
      truncated = true;
      return;
    }
    for (const tok of tokeniseSpf(record)) {
      if (tok.mechanism === 'include') {
        if (!seen.has(tok.value)) {
          seen.add(tok.value);
          includes.push(tok.value);
          const child = resolveSpf(tok.value);
          if (child) walk(child, [...via, tok.value], depth + 1);
        }
      } else if (tok.mechanism === 'redirect') {
        redirects.push(tok.value);
        if (!seen.has(tok.value)) {
          seen.add(tok.value);
          const child = resolveSpf(tok.value);
          if (child) walk(child, [...via, tok.value], depth + 1);
        }
      } else if (['ip4', 'ip6', 'a', 'mx', 'ptr', 'exists'].includes(tok.mechanism)) {
        senders.push({
          mechanism: tok.mechanism,
          via: [...via],
          ...(tok.value ? { domain: tok.value } : {}),
        });
      }
    }
  };
  walk(spfRecord, [], 0);
  // Deduplicate senders on mechanism+value.
  const unique = [];
  const keys = new Set();
  for (const s of senders) {
    const key = `${s.mechanism}:${s.domain || ''}`;
    if (!keys.has(key)) {
      keys.add(key);
      unique.push(s);
    }
  }
  return { senders: unique, includes, redirects, truncated };
}

/**
 * Parse a DMARC record and mine rua/ruf report mailbox domains.
 * @param {string} dmarcRecord e.g. 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com'
 * @returns {{policy: string|null, rua: string[], ruf: string[], reportDomains: string[], pct: number|null}}
 */
export function parseDmarcRecord(dmarcRecord) {
  const text = String(dmarcRecord || '');
  const tag = name => {
    const m = text.match(new RegExp(`\\b${name}=([^;]+)`, 'i'));
    return m ? m[1].trim() : null;
  };
  const mailboxes = raw => {
    if (!raw) return [];
    return raw
      .split(',')
      .map(m => m.trim().replace(/^mailto:/i, ''))
      .filter(m => m.includes('@'));
  };
  const rua = mailboxes(tag('rua'));
  const ruf = mailboxes(tag('ruf'));
  const reportDomains = [...new Set([...rua, ...ruf].map(m => m.split('@')[1].toLowerCase()))];
  return {
    policy: tag('p'),
    rua,
    ruf,
    reportDomains,
    pct: tag('pct') ? Number(tag('pct')) : null,
  };
}

/**
 * Parse a BIMI record (default._bimi TXT) for the logo URL and authority evidence.
 * @param {string} bimiRecord e.g. 'v=BIMI1; l=https://cdn.example.com/logo.svg; a='
 * @returns {{version: string|null, logoUrl: string|null, logoHost: string|null, authority: string|null}}
 */
export function parseBimiRecord(bimiRecord) {
  const text = String(bimiRecord || '');
  const tag = name => {
    const m = text.match(new RegExp(`\\b${name}=([^;]*)`, 'i'));
    return m ? m[1].trim() : null;
  };
  const logoUrl = tag('l') || null;
  let logoHost = null;
  if (logoUrl) {
    try {
      logoHost = new URL(logoUrl).hostname.toLowerCase();
    } catch {
      logoHost = null;
    }
  }
  return {
    version: tag('v'),
    logoUrl,
    logoHost,
    authority: tag('a') || null,
  };
}

/**
 * Parse an MTA-STS policy body (fetched from https://mta-sts.<domain>/.well-known/mta-sts.txt).
 * @param {string} policyText
 * @returns {{version: string|null, mode: string|null, mx: string[], maxAge: number|null}}
 */
export function parseMtaStsPolicy(policyText) {
  const lines = String(policyText || '').split(/\r?\n/);
  const get = name => {
    const line = lines.find(l => l.trim().toLowerCase().startsWith(`${name}:`));
    return line ? line.split(':').slice(1).join(':').trim() : null;
  };
  const mx = lines
    .filter(l => l.trim().toLowerCase().startsWith('mx:'))
    .map(l => l.split(':').slice(1).join(':').trim().toLowerCase().replace(/\.+$/, ''))
    .filter(Boolean);
  const maxAge = get('max_age');
  return {
    version: get('version'),
    mode: get('mode'),
    mx: [...new Set(mx)],
    maxAge: maxAge ? Number(maxAge) : null,
  };
}

/**
 * Cross-reference MTA-STS declared MX hostnames against MX-record hostnames
 * to surface declared hosts missing from DNS MX (idea 00070).
 * @param {string[]} mtaStsMx
 * @param {{host: string}[]} mxRecords
 * @returns {{declared: string[], inMx: string[], missingFromMx: string[]}}
 */
export function compareMtaStsWithMx(mtaStsMx, mxRecords) {
  const declared = [...new Set(mtaStsMx.map(h => h.toLowerCase()))];
  const mxHosts = new Set(mxRecords.map(m => m.host.toLowerCase()));
  return {
    declared,
    inMx: declared.filter(h => mxHosts.has(h)),
    missingFromMx: declared.filter(h => !mxHosts.has(h)),
  };
}

export const EMAIL_INFRA_INTEL = {
  parseMxRecords,
  mapMailInfrastructure,
  guessMailProvider,
  tokeniseSpf,
  expandSpfChain,
  parseDmarcRecord,
  parseBimiRecord,
  parseMtaStsPolicy,
  compareMtaStsWithMx,
};
export default EMAIL_INFRA_INTEL;
