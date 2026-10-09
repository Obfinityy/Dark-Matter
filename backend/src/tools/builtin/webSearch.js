/**
 * webSearch.js — Elite Hunter mission (Oct 2026).
 *
 * Gives the hacking brain the ability to use the web like a human hunter:
 * look up CVEs, exploit techniques, bypass methods, and technology docs
 * mid-hunt. No API keys — uses DuckDuckGo's HTML endpoint.
 *
 * Two tools:
 *  - webSearch(query, maxResults) → [{ title, url, snippet }]
 *  - webFetch(url) → page text (for reading a specific result in depth)
 *
 * Defensive scope: search/fetch are read-only. Fetching a URL never sends
 * credentials and never posts data. Target-scope policy does NOT apply here
 * (these are public knowledge sources, not the hunt target), but the
 * executor still rate-limits and caps response sizes.
 */

const SEARCH_TIMEOUT_MS = 15000;
const FETCH_TIMEOUT_MS = 20000;
const MAX_FETCH_BYTES = 512 * 1024;

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchWithTimeout(url, { timeoutMs, headers }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search the web via DuckDuckGo HTML endpoint.
 * CVE queries are routed to the NVD API directly (reliable, no key).
 * @param {string} query
 * @param {number} maxResults
 * @returns {Promise<Array<{title:string,url:string,snippet:string}>>}
 */
export async function webSearch(query, maxResults = 8) {
  const q = String(query || '').trim().slice(0, 300);
  if (!q) throw new Error('web_search requires a query');
  const limit = Math.max(1, Math.min(20, Number(maxResults) || 8));

  // CVE IDs → NVD API (free, no key, structured). This is the most reliable
  // path and covers the agent's most common lookup ("what is CVE-20xx-xxxx?").
  const cveMatch = q.match(/CVE-\d{4}-\d{4,7}/i);
  if (cveMatch) {
    try {
      return await searchNvd(cveMatch[0].toUpperCase(), limit);
    } catch {
      /* fall through to DDG */
    }
  }

  const res = await fetchWithTimeout(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    { timeoutMs: SEARCH_TIMEOUT_MS, headers: { 'User-Agent': UA } }
  );
  if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
  const html = await res.text();

  const results = [];
  // DDG html endpoint: result blocks contain <a class="result__a" href="URL">Title</a>
  // and <a class="result__snippet">…</a>. Split on the result container.
  const blocks = html.split(/<div[^>]*class="result[^"]*"[^>]*>/i);
  for (let i = 1; i < blocks.length && results.length < limit; i++) {
    const b = blocks[i];
    const linkM = b.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    let url = linkM[1];
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try {
        url = decodeURIComponent(uddg[1]);
      } catch {
        /* keep wrapped */
      }
    }
    const title = linkM[2].replace(/<[^>]+>/g, '').trim().slice(0, 200);
    const snipM = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = snipM ? snipM[1].replace(/<[^>]+>/g, '').trim().slice(0, 400) : '';
    if (url.startsWith('http') && title) results.push({ title, url, snippet });
  }
  return results;
}

/** CVE lookup via the free NVD API (no key needed). */
async function searchNvd(cveId, limit) {
  const res = await fetchWithTimeout(
    `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`,
    { timeoutMs: SEARCH_TIMEOUT_MS, headers: { 'User-Agent': UA } }
  );
  if (!res.ok) throw new Error(`NVD lookup failed: HTTP ${res.status}`);
  const data = await res.json();
  const vulns = data.vulnerabilities || [];
  return vulns.slice(0, limit).map(v => {
    const cve = v.cve || {};
    const desc = (cve.descriptions || []).find(d => d.lang === 'en')?.value || '';
    const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0];
    const severity = metrics?.cvssData?.baseSeverity || '';
    const score = metrics?.cvssData?.baseScore ?? '';
    return {
      title: `${cve.id} ${severity ? `(${severity} ${score})` : ''}`.trim(),
      url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      snippet: desc.slice(0, 400),
    };
  });
}

/**
 * Fetch a public page as readable text.
 * @param {string} url
 * @returns {Promise<{url:string,title:string,text:string}>}
 */
export async function webFetch(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) throw new Error('web_fetch requires an http(s) URL');
  const res = await fetchWithTimeout(u, {
    timeoutMs: FETCH_TIMEOUT_MS,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_FETCH_BYTES) throw new Error('Page too large');
  const html = new TextDecoder().decode(buf);

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '';
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
  return { url: u, title, text };
}

export const WEB_SEARCH_TOOLS = { webSearch, webFetch };
export default WEB_SEARCH_TOOLS;
