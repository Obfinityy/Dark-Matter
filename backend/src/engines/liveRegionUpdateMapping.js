/**
 * liveRegionUpdateMapping.js — Live-region update mapping.
 *
 * Idea 00920: map aria-live regions to dynamic content endpoints.
 *
 * Defensive engine: finds aria-live / role="status|alert|log" regions in
 * operator-collected page HTML/JS of an authorized target, and correlates each
 * region with nearby dynamic-content wiring (fetch/XHR calls, WebSocket topics,
 * polling timers) to map which backend endpoints feed live updates. Pure
 * parsing — no network calls.
 */

const FETCH_REGEX = /(fetch\s*\(\s*|axios\.(get|post)\s*\(\s*|\.ajax\s*\(\s*|XMLHttpRequest|new\s+EventSource\s*\(\s*|new\s+WebSocket\s*\()\s*["'`]([^"'`]+)["'`]/g;
const TIMER_REGEX = /(setInterval|setTimeout)\s*\(\s*(?:async\s*)?\(\)\s*=>\s*\{?[^;]{0,200}?(fetch|\.ajax|axios)/g;

/**
 * Find aria-live regions in page HTML.
 * @param {string} html
 * @returns {{tag: string, id: string|null, politeness: string, role: string|null, atomic: boolean}[]}
 */
export function findLiveRegions(html = '') {
  const text = String(html);
  const regions = [];
  const re = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const attrs = m[2];
    const liveMatch = attrs.match(/\baria-live=["']([^"']+)["']/i);
    const role = (attrs.match(/\brole=["']([^"']+)["']/i) || [])[1] || null;
    const implicitLive = role && /^(status|alert|log|marquee|timer)$/i.test(role);
    if (!liveMatch && !implicitLive) continue;
    regions.push({
      tag: m[1].toLowerCase(),
      id: (attrs.match(/\bid=["']([^"']+)["']/i) || [])[1] || null,
      politeness: liveMatch ? liveMatch[1].toLowerCase() : (role === 'alert' ? 'assertive' : 'polite'),
      role,
      atomic: /\baria-atomic=["']true["']/i.test(attrs),
    });
  }
  return regions;
}

/**
 * Extract dynamic-content endpoints (fetch/XHR/SSE/WS URLs) from page JS.
 * @param {string} js - Page JS text (or full HTML; script bodies are scanned).
 * @param {string} [baseUrl]
 * @returns {{url: string, transport: string}[]}
 */
export function extractDynamicEndpoints(js = '', baseUrl = '') {
  const text = String(js);
  const endpoints = [];
  const seen = new Set();
  let m;
  FETCH_REGEX.lastIndex = 0;
  while ((m = FETCH_REGEX.exec(text)) !== null) {
    const raw = m[3].trim();
    if (!raw || /^(data:|blob:|javascript:)/i.test(raw) || seen.has(raw)) continue;
    seen.add(raw);
    let url = raw;
    if (baseUrl && raw.startsWith('/')) {
      try { url = new URL(raw, baseUrl).href; } catch { /* keep raw */ }
    }
    const call = m[1];
    const transport = /EventSource/i.test(call) ? 'sse' : /WebSocket/i.test(call) ? 'websocket' : /XMLHttpRequest/i.test(call) ? 'xhr' : 'fetch';
    endpoints.push({ url, transport });
  }
  return endpoints;
}

/**
 * Correlate live regions with the dynamic endpoints likely feeding them.
 * Heuristic: a region with an id referenced near a fetch call is linked to it.
 * @param {string} html - Full page HTML (markup + scripts).
 * @param {string} [baseUrl]
 * @returns {{mappings: {region: object, endpoints: {url: string, transport: string, link: string}[]}[]}}
 */
export function mapLiveRegionUpdates(html = '', baseUrl = '') {
  const text = String(html);
  const regions = findLiveRegions(html);
  const endpoints = extractDynamicEndpoints(html, baseUrl);
  const mappings = regions.map(region => {
    const linked = [];
    for (const ep of endpoints) {
      let link = 'page-level';
      if (region.id) {
        const idRe = new RegExp(`getElementById\\(['"]${region.id}['"]\\)|#${region.id}\\b|\\$\\(['"]#${region.id}['"]\\)`, 'i');
        const idIdx = text.search(new RegExp(`id=["']${region.id}["']`, 'i'));
        const epIdx = text.indexOf(ep.url.split('?')[0].slice(-40));
        if (idRe.test(text) && idIdx >= 0 && epIdx >= 0 && Math.abs(idIdx - epIdx) < 4000) {
          link = 'id-referenced';
        }
      }
      linked.push({ ...ep, link });
    }
    const polled = TIMER_REGEX.test(text);
    return { region, endpoints: linked, polled };
  });
  return { mappings };
}
