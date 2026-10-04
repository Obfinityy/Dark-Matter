/**
 * commonCrawlWarcIntel.js — Common Crawl WARC header mining (idea 00202).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses WARC response-header record text to extract redirect chains
 * (Location headers) and host evidence — redirects often reveal alternate
 * or legacy hosts still pointing at a target's infrastructure.
 */

/**
 * Split raw WARC response-header text into individual header blocks.
 * @param {string} raw - Raw WARC header record text (HTTP headers as captured).
 * @returns {string[]} Header blocks.
 */
export function splitHeaderBlocks(raw) {
  return String(raw || '')
    .split(/\r?\n\r?\n/)
    .map(b => b.trim())
    .filter(Boolean);
}

/**
 * Parse one HTTP header block into { status, headers }.
 * @param {string} block - A single header block.
 * @returns {{ status: string, headers: Record<string, string> }}
 */
export function parseHeaderBlock(block) {
  const lines = String(block || '').split(/\r?\n/);
  const status = (lines.shift() || '').trim();
  const headers = {};
  for (const line of lines) {
    const m = line.match(/^([^:\s]+)\s*:\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2].trim();
  }
  return { status, headers };
}

/**
 * Extract redirect chains (hop-by-hop Location headers) from WARC header text.
 * @param {string} raw - Raw WARC response-header text.
 * @param {string} [startUrl] - The URL that produced the first response.
 * @returns {{ chains: Array<{ hops: Array<{ from, to, status }> }>, redirectHosts: string[] }}
 */
export function extractRedirectChains(raw, startUrl = '') {
  const blocks = splitHeaderBlocks(raw).map(parseHeaderBlock);
  const hops = [];
  let from = String(startUrl || '');
  for (const b of blocks) {
    const loc = b.headers.location;
    if (loc) {
      let to = loc;
      try { to = new URL(loc, from || undefined).toString(); } catch { /* keep raw */ }
      hops.push({ from, to, status: b.status });
      from = to;
    }
  }
  const hosts = new Set();
  for (const h of hops) {
    for (const u of [h.from, h.to]) {
      try {
        const host = new URL(u).hostname.toLowerCase();
        if (host) hosts.add(host);
      } catch { /* skip */ }
    }
  }
  return { chains: hops.length ? [{ hops }] : [], redirectHosts: [...hosts].sort() };
}

/**
 * Collect every distinct host that appears in WARC response headers
 * (Location, Refresh URL, Set-Cookie Domain, Link headers).
 * @param {string} raw - Raw WARC response-header text.
 * @returns {{ hosts: string[], hostHits: Array<{ host, sources: string[] }> }}
 */
export function extractWarcHosts(raw) {
  const blocks = splitHeaderBlocks(raw).map(parseHeaderBlock);
  const hits = new Map();
  const add = (host, source) => {
    host = String(host || '').trim().toLowerCase().replace(/^\./, '');
    if (!host) return;
    if (!hits.has(host)) hits.set(host, new Set());
    hits.get(host).add(source);
  };
  function addHostFromUrl(u, source) {
    try {
      const host = new URL(u, 'http://placeholder').hostname.toLowerCase();
      if (host && host !== 'placeholder') add(host, source);
    } catch { /* skip */ }
  }
  for (const b of blocks) {
    const h = b.headers;
    for (const key of ['location', 'content-location']) {
      if (h[key]) addHostFromUrl(h[key], key);
    }
    if (h.refresh) {
      const m = h.refresh.match(/url\s*=\s*['"]?([^'"\s;]+)/i);
      if (m) addHostFromUrl(m[1], 'refresh');
    }
    if (h['set-cookie']) {
      const m = h['set-cookie'].match(/domain=([^;\s]+)/i);
      if (m) add(m[1], 'set-cookie-domain');
    }
    if (h.link) {
      for (const m of h.link.matchAll(/<([^>]+)>/g)) addHostFromUrl(m[1], 'link-header');
    }
  }
  const hostHits = [...hits.entries()].map(([host, sources]) => ({ host, sources: [...sources] }));
  return { hosts: hostHits.map(x => x.host).sort(), hostHits };
}

/**
 * Idea 00202 — full WARC header mine: redirect chains + host evidence.
 * @param {string} raw - Raw WARC response-header text.
 * @param {string} [startUrl] - Starting URL for the chain.
 * @returns {{ redirectChains: Array<{ hops }>, redirectHosts: string[], hosts: string[], hostHits: Array, provenance: string }}
 */
export function mineWarcHeaders(raw, startUrl = '') {
  const { chains, redirectHosts } = extractRedirectChains(raw, startUrl);
  const { hosts, hostHits } = extractWarcHosts(raw);
  return { redirectChains: chains, redirectHosts, hosts, hostHits, provenance: 'common-crawl warc headers' };
}
