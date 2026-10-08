/**
 * rtmpHostDiscovery.js — Live-stream RTMP host discovery.
 *
 * Live-streaming products embed ingest/playback configuration in page
 * source or bundled JavaScript: rtmp://, rtmps://, SRT/WebRTC ingest
 * endpoints, and stream keys. Those ingest hosts are part of the target's
 * infrastructure and belong on the recon map.
 *
 * Passive analysis: this module parses HTML/JS text already collected
 * from in-scope pages. It extracts candidate endpoints only — it never
 * connects to them or tests stream keys.
 */

const INGEST_PATTERNS = {
  // rtmp(s)://host[:port]/app[/stream]
  rtmp: /\b(rtmps?):\/\/([a-z0-9.\-_:]+)(\/[a-z0-9\-._~%!$&'()*+,;=:@/]*)?/gi,
  // SRT ingest: srt://host:port?streamid=...
  srt: /\b(srt):\/\/([a-z0-9.\-_:]+)(\/[^"'`\s<>]*)?/gi,
  // Common JSON config keys: { "ingestUrl": "rtmp://...", "streamKey": "..." }
  ingestKey:
    /"(?:ingest_?url|ingest|rtmp_?url|publish_?url|stream_?url|playback_?url)"\s*:\s*"([^"]+)"/gi,
  // JS variable assignments: var ingestServer = "rtmp://live.example.com/app";
  jsAssign: /\b(?:ingest|rtmp|publish|stream)[A-Za-z]*\s*=\s*["'`](rtmps?:\/\/[^"'`]+)["'`]/gi,
  // WebRTC / Low-Latency HLS signalling hosts near stream config
  webrtcSignal: /"(?:signal(?:ing)?_?url|whip_?url|whep_?url)"\s*:\s*"(https?:\/\/[^"]+)"/gi,
};

/**
 * Extract RTMP ingest endpoints from arbitrary page/JS text.
 * @param {string} text HTML or JavaScript source
 * @param {string} [sourceUrl] page the text was collected from (for evidence)
 * @returns {object[]} findings: {protocol, url, host, app, evidence}
 */
export function extractIngestEndpoints(text, sourceUrl = '') {
  const body = String(text || '');
  const seen = new Set();
  const findings = [];
  const evidence = sourceUrl || '(inline)';

  const add = (protocol, url) => {
    const key = `${protocol}://${url}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    let host = '';
    let app = '';
    const m = url.match(/^([a-z0-9.\-_]+(?::\d+)?)(\/.*)?$/i);
    if (m) {
      host = m[1].toLowerCase();
      app = (m[2] || '').split('/').filter(Boolean)[0] || '';
    }
    findings.push({ protocol, url: `${protocol}://${url}`, host, app, evidence });
  };

  for (const key of ['rtmp', 'srt']) {
    const rx = INGEST_PATTERNS[key];
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(body)) !== null) add(m[1].toLowerCase(), m[2] + (m[3] || ''));
  }
  for (const key of ['ingestKey', 'jsAssign']) {
    const rx = INGEST_PATTERNS[key];
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(body)) !== null) {
      const u = m[1];
      const proto = u.match(/^([a-z]+):\/\//i);
      if (proto) add(proto[1].toLowerCase(), u.replace(/^[a-z]+:\/\//i, ''));
    }
  }
  const wrx = INGEST_PATTERNS.webrtcSignal;
  wrx.lastIndex = 0;
  let wm;
  while ((wm = wrx.exec(body)) !== null) {
    try {
      const u = new URL(wm[1]);
      const key = `signalling:${u.href}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push({
          protocol: 'webrtc-signalling',
          url: u.href,
          host: u.hostname.toLowerCase(),
          app: '',
          evidence,
        });
      }
    } catch {
      /* ignore */
    }
  }
  return findings;
}

/**
 * Detect whether an endpoint is likely a stream *key* (credential-ish material)
 * rather than a plain URL. Keys are REDACTED in output — this engine maps
 * infrastructure, it does not collect secrets.
 * @param {string} value candidate string
 * @returns {boolean}
 */
export function looksLikeStreamKey(value) {
  if (!value || typeof value !== 'string') return false;
  if (/^[a-z]+:\/\//i.test(value)) return false; // it's a URL, not a key
  return /^[A-Za-z0-9\-_]{12,128}$/.test(value.trim());
}

/**
 * Summarise distinct ingest hosts from findings.
 * @param {object[]} findings from extractIngestEndpoints
 * @returns {{host: string, protocols: string[], apps: string[]}[]}
 */
export function summariseIngestHosts(findings = []) {
  const map = new Map();
  for (const f of findings) {
    if (!f || !f.host) continue;
    if (!map.has(f.host)) map.set(f.host, { host: f.host, protocols: new Set(), apps: new Set() });
    const entry = map.get(f.host);
    entry.protocols.add(f.protocol);
    if (f.app) entry.apps.add(f.app);
  }
  return [...map.values()].map(e => ({
    host: e.host,
    protocols: [...e.protocols],
    apps: [...e.apps],
  }));
}

export const RTMP_DISCOVERY = {
  extractIngestEndpoints,
  looksLikeStreamKey,
  summariseIngestHosts,
};

export default RTMP_DISCOVERY;
