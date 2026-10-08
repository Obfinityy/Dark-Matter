/**
 * ntpConfigIntel.js — NTP server pool inference (idea 00123).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Time-sync
 * configuration is exposed on hosts in predictable places (ntp.conf,
 * chrony.conf, systemd-timesyncd, w32tm query output, config backups). The
 * NTP sources a host trusts map the organization's time infrastructure:
 * internal stratum servers, GPS-backed stratum-1 clocks, and pool usage —
 * all of which are network peers worth knowing about.
 *
 * All functions are pure: they analyze configuration text supplied by the
 * caller and never read files or touch the network themselves.
 */

const INTERNAL_TLDS = new Set([
  'local',
  'internal',
  'intranet',
  'corp',
  'lan',
  'home',
  'private',
  'localdomain',
  'invalid',
  'test',
]);

const INTERNAL_LABELS = new Set([
  'corp',
  'intranet',
  'internal',
  'lan',
  'localdomain',
  'mgmt',
  'private',
  'office',
  'hq',
  'datacenter',
  'dc',
  'site',
]);
/**
 * Classify a time source as internal infrastructure, public pool/service,
 * or unknown.
 * @param {string} host
 * @returns {'internal' | 'public' | 'unknown'}
 */
export function classifyNtpSource(host) {
  const h = String(host || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!h) return 'unknown';
  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})$/.test(h)) {
    const o = h.split('.').map(Number);
    const priv =
      o[0] === 10 ||
      (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
      (o[0] === 192 && o[1] === 168) ||
      o[0] === 127 ||
      (o[0] === 169 && o[1] === 254);
    return priv ? 'internal' : 'public';
  }
  if (!h.includes('.')) return 'internal';
  if (INTERNAL_TLDS.has(h.split('.').pop())) return 'internal';
  if (h.split('.').some(l => INTERNAL_LABELS.has(l))) return 'internal';
  if (/pool\.ntp\.org|time\.(google|windows|apple|cloudflare|nist)\.|ntp\./.test(h))
    return 'public';
  return 'unknown';
}

/**
 * Parse ntp.conf / chrony.conf style lines:
 *   server ntp1.corp.example.com iburst
 *   pool 0.pool.ntp.org iburst
 *   peer 192.168.1.2
 *
 * @param {string} text
 * @returns {Array<{ host: string, kind: string, source: string, options: string }>}
 */
export function parseNtpConfSources(text) {
  const out = [];
  const seen = new Set();
  for (const raw of String(text || '').split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^(server|pool|peer|refclock)\s+((?:\S+))/i);
    if (!m) continue;
    const host = m[2].replace(/["']/g, '');
    const key = `${m[1].toLowerCase()}|${host}`;
    if (seen.has(key) || !host || host.startsWith('/')) continue;
    seen.add(key);
    out.push({
      host,
      kind: m[1].toLowerCase(),
      source: 'ntp.conf/chrony',
      options: line.slice(m[0].length).trim(),
    });
  }
  return out;
}

/**
 * Parse systemd-timesyncd.conf [Time] section:
 *   NTP=ntp1.corp.example.com 10.0.0.5
 *   FallbackNTP=0.pool.ntp.org
 *
 * @param {string} text
 * @returns {Array<{ host: string, kind: string, source: string, options: string }>}
 */
export function parseTimesyncdSources(text) {
  const out = [];
  const seen = new Set();
  const re = /^\s*(NTP|FallbackNTP)\s*=\s*(.+)$/gim;
  let m;
  while ((m = re.exec(text)) !== null) {
    const kind = m[1].toLowerCase() === 'ntp' ? 'server' : 'pool';
    for (const host of m[2].split(/\s+/)) {
      const h = host.trim().replace(/["']/g, '');
      const key = `${kind}|${h}`;
      if (!h || seen.has(key)) continue;
      seen.add(key);
      out.push({ host: h, kind, source: 'systemd-timesyncd', options: m[1] });
    }
  }
  return out;
}

/**
 * Parse Windows w32tm query output:
 *   "Source: ntp1.corp.example.com,0x9 (ntp.m|0x9|...)"
 *   "Peer: time.windows.com,0x9"
 *
 * @param {string} text
 * @returns {Array<{ host: string, kind: string, source: string, options: string }>}
 */
export function parseW32tmSources(text) {
  const out = [];
  const seen = new Set();
  const re = /^(?:Source|Peer)\s*:\s*([^\s,()]+)/gim;
  let m;
  while ((m = re.exec(text)) !== null) {
    const host = m[1].trim();
    const key = `w32tm|${host}`;
    if (!host || seen.has(key)) continue;
    seen.add(key);
    out.push({ host, kind: 'server', source: 'w32tm', options: '' });
  }
  return out;
}

/**
 * Idea 00123 — NTP server pool inference.
 *
 * Extracts every NTP time source from supplied time-sync configuration
 * text (ntp.conf, chrony.conf, systemd-timesyncd, w32tm output) and
 * classifies each as internal infrastructure or a public pool/service.
 *
 * @param {string} configText Raw configuration or command-output text.
 * @returns {{
 *   sources: Array<{ host: string, kind: string, source: string, options: string, classification: 'internal' | 'public' | 'unknown', detail: string }>,
 *   internalSources: string[],
 *   publicSources: string[],
 *   summary: { total: number, internal: number, public: number },
 *   findings: string[]
 * }}
 */
export function extractNtpSources(configText) {
  const text = String(configText || '');
  const raw = [
    ...parseNtpConfSources(text),
    ...parseTimesyncdSources(text),
    ...parseW32tmSources(text),
  ];

  const seen = new Set();
  const sources = [];
  for (const s of raw) {
    const key = s.host.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const classification = classifyNtpSource(s.host);
    sources.push({
      ...s,
      classification,
      detail:
        `NTP ${s.kind} '${s.host}' (${s.source}) — classified ${classification}. ` +
        (classification === 'internal'
          ? 'Internal time servers are core infrastructure peers; stratum hierarchy often mirrors network trust zones.'
          : classification === 'public'
            ? 'Public time source — confirms the host syncs externally rather than to an internal clock.'
            : 'Unclassified source — resolve and probe to determine whether it is internal infrastructure.'),
    });
  }

  const internalSources = sources.filter(s => s.classification === 'internal').map(s => s.host);
  const publicSources = sources.filter(s => s.classification === 'public').map(s => s.host);

  const summary = {
    total: sources.length,
    internal: internalSources.length,
    public: publicSources.length,
  };

  const findings = [];
  if (internalSources.length) {
    findings.push(
      `${internalSources.length} internal NTP source(s): ${internalSources.join(', ')} — ` +
        'internal time infrastructure peers; map their stratum role and reachability.'
    );
  }
  if (publicSources.length) {
    findings.push(
      `${publicSources.length} public NTP source(s): ${publicSources.join(', ')} — ` +
        'external time sync; check whether internal hosts also sync here (egress path intel).'
    );
  }
  const hasRefclock = raw.some(
    s => s.kind === 'refclock' || /gps|pps|shm/i.test(s.host + s.options)
  );
  if (hasRefclock) {
    findings.push(
      'A reference clock (GPS/PPS/SHM) is configured — this host is a stratum-1 ' +
        'time source, typically hardened core infrastructure.'
    );
  }
  if (!sources.length) {
    findings.push(
      'No NTP sources parsed from the supplied text — confirm the input is ntp.conf, ' +
        'chrony.conf, timesyncd, or w32tm output.'
    );
  }

  return { sources, internalSources, publicSources, summary, findings };
}
