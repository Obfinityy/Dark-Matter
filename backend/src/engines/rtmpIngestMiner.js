/**
 * rtmpIngestMiner.js — Live-stream RTMP ingest-host discovery engine.
 *
 * @idea 00292
 * Covers idea-bank item 00292:
 *  - 00292 Live-stream RTMP host discovery — find RTMP ingest hosts from
 *    streaming configs in page source.
 *
 * Pure functions only: the caller scrapes page HTML / JS player configs and
 * passes the raw text in. No live HTTP here.
 */

const RTMP_URL_RE = /\brtmps?:\/\/([^/:\s"'<>()]+)(?::(\d+))?(?:\/([^\s"'<>()]*))?/gi;

const RTMP_PROVIDER_HINTS = [
  { re: /\.live-video\.net$/i, vendor: 'aws-ivs', note: 'AWS Interactive Video Service ingest' },
  { re: /a\.akamaihd\.net$/i, vendor: 'akamai', note: 'Akamai live ingest edge' },
  { re: /\.ustream\.tv$/i, vendor: 'ustream', note: 'Ustream (IBM Cloud Video) ingest' },
  { re: /\.livenl\.vidible\.tv$/i, vendor: 'vidible', note: 'Vidible live ingest' },
  { re: /\.pscp\.tv$/i, vendor: 'periscope', note: 'Periscope live ingest' },
  { re: /live-api-s\.facebook\.com$/i, vendor: 'facebook', note: 'Facebook Live ingest' },
  { re: /ingest\.ps\.youtube\.com|a\.youtube\.com$/i, vendor: 'youtube', note: 'YouTube Live ingest' },
  { re: /\.contribute\.live-video\.net$/i, vendor: 'aws-ivs', note: 'AWS IVS contribution endpoint' },
  { re: /\.stream\.dable\.io$/i, vendor: 'dable', note: 'Dable live ingest' },
  { re: /\.cdn\.wowza\.com$/i, vendor: 'wowza', note: 'Wowza Streaming Cloud ingest' },
];

const DEFAULT_RTMP_PORTS = new Set(['1935', '443']);

/**
 * Normalize a hostname: lowercase, strip trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHost(host) {
  return String(host || '').trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Classify an RTMP ingest host against known provider fingerprints.
 * @param {string} host
 * @returns {{vendor: string, note: string}}
 */
export function classifyRtmpProvider(host) {
  const h = normalizeHost(host);
  for (const { re, vendor, note } of RTMP_PROVIDER_HINTS) {
    if (re.test(h)) return { vendor, note };
  }
  return { vendor: 'self-hosted', note: 'no known provider fingerprint — likely self-hosted media server (nginx-rtmp, Wowza, Ant Media)' };
}

/**
 * Extract RTMP/RTMPS ingest endpoints from page source or player configs.
 * Captures scheme, host, port, application path, and the surrounding config
 * context so the caller can see which player/embed referenced it.
 *
 * @param {string} source HTML, JS bundle excerpt, or player config JSON
 * @returns {{
 *   scheme: 'rtmp'|'rtmps', host: string, port: string, app: string,
 *   secure: boolean, provider: string, note: string, context: string
 * }[]}
 */
export function extractRtmpIngestHosts(source = '') {
  const text = String(source || '');
  const results = [];
  const seen = new Set();

  for (const m of text.matchAll(RTMP_URL_RE)) {
    const scheme = (m[0].split('://')[0] || '').toLowerCase();
    const host = normalizeHost(m[1]);
    if (!host || host === 'localhost' || host === '127.0.0.1') continue;
    const port = m[2] || (scheme === 'rtmps' ? '443' : '1935');
    const app = (m[3] || '').split(/[?#]/)[0].replace(/\/+$/, '');
    const key = `${scheme}|${host}|${port}|${app}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cls = classifyRtmpProvider(host);
    const start = Math.max(0, (m.index ?? 0) - 120);
    const end = Math.min(text.length, (m.index ?? 0) + m[0].length + 80);
    const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
    results.push({
      scheme,
      host,
      port,
      app,
      secure: scheme === 'rtmps' || port === '443',
      provider: cls.vendor,
      note: cls.note,
      context,
    });
  }

  return results.sort((a, b) => a.host.localeCompare(b.host) || a.port.localeCompare(b.port));
}

/**
 * Group discovered ingest hosts by provider, collapsing per-host entries.
 * @param {ReturnType<typeof extractRtmpIngestHosts>} found
 * @returns {{provider: string, hosts: string[], endpoints: number, note: string}[]}
 */
export function groupRtmpByProvider(found = []) {
  const byProvider = new Map();
  for (const f of found || []) {
    if (!byProvider.has(f.provider)) {
      byProvider.set(f.provider, { provider: f.provider, hosts: new Set(), endpoints: 0, note: f.note });
    }
    const entry = byProvider.get(f.provider);
    entry.hosts.add(f.host);
    entry.endpoints += 1;
  }
  return [...byProvider.values()]
    .map((e) => ({ provider: e.provider, hosts: [...e.hosts].sort(), endpoints: e.endpoints, note: e.note }))
    .sort((a, b) => b.endpoints - a.endpoints || a.provider.localeCompare(b.provider));
}

/**
 * Score RTMP findings: self-hosted ingest endpoints are the interesting
 * attack surface (exposed media servers), known providers are informational.
 * @param {ReturnType<typeof extractRtmpIngestHosts>} found
 * @returns {{host: string, score: number, reason: string}[]}
 */
export function scoreRtmpFindings(found = []) {
  return (found || []).map((f) => {
    let score = 40;
    let reason = 'third-party live ingest endpoint — confirm it is not a stale credential leak';
    if (f.provider === 'self-hosted') {
      score = 80;
      reason = 'self-hosted RTMP ingest server — exposed media-server surface, verify stream-key hygiene and TLS';
    }
    if (f.port !== '1935' && f.port !== '443') {
      score += 10;
      reason += '; non-default port widens probing surface';
    }
    return { host: f.host, score: Math.min(100, score), reason };
  }).sort((a, b) => b.score - a.score);
}
