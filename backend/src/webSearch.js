// Dark Matter — Web Search for Hunt Agent.
// Lets the agent search for CVEs, techniques, and intelligence like a human would.

/**
 * Search the web for security intelligence.
 * Uses DuckDuckGo HTML (no API key needed).
 */
export async function webSearch(query, maxResults = 5) {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const results = [];
    // Simple regex to extract results (fragile but works without API)
    const regex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let m;
    while ((m = regex.exec(html)) !== null && results.length < maxResults) {
      results.push({ url: m[1], title: m[2].trim() });
    }
    return results;
  } catch {
    return [];
  }
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
