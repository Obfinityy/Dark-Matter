// Dark Matter — Web Search for Hunt Agent.
// Lets the agent search for CVEs, techniques, and intelligence like a human would.
//
// PROVIDER HISTORY (20 Oct 2026, parent audit): the original provider
// was DuckDuckGo's HTML endpoint. From the EC2 datacenter IP it now
// returns HTTP 202 with a bot-challenge page (no result markup), so
// webSearch silently returned [] for every query — the agent's
// SEARCH: command has been answering empty without anyone noticing.
// Verified live from EC2 20 Oct 2026: DDG html + lite both 202,
// Mojeek 403, Bing 200 with 10 parseable results. Bing is now the
// primary provider; DDG is kept as a fallback for environments
// where it is not bot-walled (e.g. residential IPs). A provider that
// returns zero parseable results falls through to the next one, and
// titles/snippets are HTML-entity-decoded; Bing's redirect URLs are
// unwrapped to the real destination where possible.

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, '')).trim();
}

// Bing wraps result URLs in /ck/a?…&u=a1<base64url-of-real-url>.
function unwrapBingUrl(u) {
  try {
    const m = String(u).match(/[?&]u=a1([A-Za-z0-9_-]+)/);
    if (!m) return u;
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    return /^https?:\/\//.test(decoded) ? decoded : u;
  } catch {
    return u;
  }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return '';
  return res.text();
}

async function searchBing(query, maxResults) {
  const html = await fetchHtml(`https://www.bing.com/search?q=${encodeURIComponent(query)}`);
  if (!html) return [];
  const results = [];
  const blocks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || [];
  for (const b of blocks) {
    if (results.length >= maxResults) break;
    const m = b.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!m) continue;
    const s = b.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    results.push({
      url: unwrapBingUrl(decodeEntities(m[1])),
      title: stripTags(m[2]),
      snippet: s ? stripTags(s[1]).slice(0, 300) : '',
    });
  }
  return results;
}

async function searchDuckDuckGo(query, maxResults) {
  const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!html) return [];
  const results = [];
  const regex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = regex.exec(html)) !== null && results.length < maxResults) {
    results.push({ url: decodeEntities(m[1]), title: stripTags(m[2]), snippet: '' });
  }
  return results;
}

/**
 * Search the web for security intelligence.
 * Tries providers in order until one returns results; [] only when
 * every provider fails (network down / all bot-walled).
 */
export async function webSearch(query, maxResults = 5) {
  for (const provider of [searchBing, searchDuckDuckGo]) {
    try {
      const r = await provider(query, maxResults);
      if (r.length > 0) return r;
    } catch { /* fall through to the next provider */ }
  }
  return [];
}

/**
 * Search for CVE details.
 */
export async function searchCVE(technology, version = '') {
  const query = `CVE ${technology} ${version} vulnerability exploit`;
  return webSearch(query, 3);
}

/**
 * Search for hacking techniques.
 */
export async function searchTechnique(technique, target = '') {
  const query = `${technique} ${target} bug bounty technique`;
  return webSearch(query, 3);
}
