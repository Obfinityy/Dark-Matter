/**
 * autoconfigMiner.js — Autoconfig XML host extraction (idea 00119).
 *
 * Thunderbird-style autoconfig files (mail/config-v1.1.xml, autodiscover)
 * list IMAP/SMTP/CalDAV hostnames the org operates. Parsing them maps mail
 * infrastructure without touching the mail servers themselves.
 */

const SERVER_BLOCK_RE = /<(\w+Server|incomingServer|outgoingServer)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
const TAG_VALUE_RE = /<(\w+)>([^<]*)<\/\1\s*>/g;

/**
 * Parse a Thunderbird-style autoconfig XML document into mail servers.
 * @param {string} xml — raw autoconfig XML body
 * @returns {{ valid: boolean, servers: { role, hostname, port, socketType, username, authentication }[], uniqueHosts: string[], notes: string[] }}
 */
export function parseAutoconfig(xml = '') {
  const notes = [];
  if (typeof xml !== 'string' || !/<clientConfig\b/i.test(xml)) {
    return { valid: false, servers: [], uniqueHosts: [], notes: ['Not an autoconfig clientConfig document'] };
  }

  const servers = [];
  const unique = new Set();
  let block;
  while ((block = SERVER_BLOCK_RE.exec(xml)) !== null) {
    const tagName = block[1];
    const body = block[2];
    const fields = {};
    let t;
    while ((t = TAG_VALUE_RE.exec(body)) !== null) {
      fields[t[1].toLowerCase()] = t[2].trim();
    }

    const role = /incoming/i.test(tagName) ? 'incoming' : /outgoing/i.test(tagName) ? 'outgoing' : 'server';
    const hostname = fields.hostname || null;
    if (hostname) unique.add(hostname);

    servers.push({
      role,
      hostname,
      port: fields.port ? Number(fields.port) : null,
      socketType: fields.sockettype || fields.socktype || null,
      username: fields.username || null,
      authentication: fields.authentication || null,
    });
  }

  if (servers.length === 0) notes.push('clientConfig present but no server blocks found');
  if (unique.size > 1) notes.push(`Mail infrastructure spans ${unique.size} host(s): ${[...unique].join(', ')}`);

  return { valid: true, servers, uniqueHosts: [...unique], notes };
}

/**
 * Canonical autoconfig probe URLs for a mail domain.
 * @param {string} domain — e.g. "example.com"
 * @returns {string[]}
 */
export function autoconfigUrls(domain) {
  const clean = String(domain).replace(/^https?:\/\//, '').split('/')[0];
  return [
    `https://autoconfig.${clean}/mail/config-v1.1.xml`,
    `https://${clean}/.well-known/autoconfig/mail/config-v1.1.xml`,
    `https://${clean}/mail/config-v1.1.xml`,
  ];
}

export const AUTOCONFIG_MINER = { parseAutoconfig, autoconfigUrls };
export default AUTOCONFIG_MINER;
