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
//
// RESULT QUALITY (Lane AA, 24 Oct 2026): pinning no market made Bing
// localize by datacenter IP, and its answer-box/dictionary cards parse
// as ordinary b_algo blocks — observed live in one night: a Cambridge
// Dictionary definition of "damn" as result #1 for the DVWA research
// query, and an unrelated regional Vimeo video as result #1 for an
// Ezviz registration query. The Bing request now pins mkt/setlang,
// and every provider's list passes refineResults() (dictionary
// hygiene for technical queries + a token-overlap relevance floor)
// before it reaches the hunter. See refineResults below.

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
  // Market pinned (Lane AA): without mkt/setlang, Bing localizes by
  // the caller's IP — from the EC2 datacenter that surfaced
  // local-language answer cards and unrelated regional results as
  // "research". en-US is the sanest market for security intelligence.
  const html = await fetchHtml(`https://www.bing.com/search?q=${encodeURIComponent(query)}&mkt=en-US&setlang=en`);
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

// Effective host of a result URL, unwrapping DuckDuckGo redirect
// links (duckduckgo.com/l/?uddg=<real-url>) so domain checks see the
// destination, not the redirector.
function resultHost(url) {
  try {
    const u = new URL(String(url || ''));
    if (/(^|\.)duckduckgo\.com$/i.test(u.hostname)) {
      const real = u.searchParams.get('uddg');
      if (real) return new URL(real).hostname.toLowerCase();
    }
    return u.hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * When a query carries an explicit site:domain restriction, keep only
 * results actually on that domain (Lane D, 21 Oct 2026 — Ezviz audit).
 * Providers routinely ignore the operator and return generic pages for
 * the query's keywords — observed live: "site:open.ys7.com security
 * headers" returned Wikipedia's "Security" article and a JustDial
 * listing for security guards in Jamnagar. Fed to the hunter as
 * "results", that junk reads as evidence the query found something,
 * and the identical query gets re-asked (17 times in the audited
 * hunt). An honest empty result is better information than junk:
 * it tells the hunter the index holds nothing for that query.
 */
export function filterSiteResults(query, results) {
  const m = /site:([a-z0-9.-]+)/i.exec(String(query || ''));
  if (!m) return results || [];
  const dom = m[1].toLowerCase().replace(/\/.*$/, '');
  return (results || []).filter((r) => {
    const h = resultHost(r && r.url);
    return h !== '' && (h === dom || h.endsWith('.' + dom));
  });
}

// ---------------------------------------------------------------------------
// Result-quality refinement (Lane AA, 24 Oct 2026).
//
// Two cheap, deterministic defences applied to every provider's list
// before it reaches the hunter (see RESULT QUALITY in the header):
//   1. Dictionary hygiene — for technical queries, drop results from
//      pure dictionary domains: they define words, they never carry
//      CVE/exploit intelligence.
//   2. A relevance floor — a result whose title+snippet shares no
//      significant token with the query is junk for that query and is
//      dropped. The floor NEVER empties a list: if every result fails
//      it, the list is returned untouched (an odd result beats a
//      silent empty from a provider that did answer).
// ---------------------------------------------------------------------------

const STOPWORD_TOKENS = new Set([
  'the', 'and', 'for', 'with', 'how', 'what', 'why', 'are', 'was', 'were',
  'from', 'this', 'that', 'you', 'your', 'all', 'any', 'can', 'com', 'www',
  'http', 'https',
]);

/**
 * Significant query tokens: lowercase words of length >= 3, minus a
 * small stopword set. The site: operator is stripped first — its
 * domain pieces are a filter, not research terms.
 */
export function significantTokens(query) {
  const q = String(query || '').replace(/site:\S+/gi, ' ');
  const out = new Set();
  for (const tok of q.toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length >= 3 && !STOPWORD_TOKENS.has(tok)) out.add(tok);
  }
  return [...out];
}

const TECHNICAL_SUBSTRINGS = ['vulnerab', 'exploit', 'injection', 'authentication', 'bypass'];
const TECHNICAL_TOKEN_RE = /\b(cve|sql|xss|api)\b/i;
const VERSION_TOKEN_RE = /\bv?\d+\.\d+/;

/**
 * Does this query look like security research (vs an everyday
 * question)? Gates the dictionary hygiene, so a plain "damn meaning"
 * query keeps its dictionary result. The short terms use word
 * boundaries so "capital" does not trip the "api" test.
 */
export function isTechnicalQuery(query) {
  const q = String(query || '').toLowerCase();
  return TECHNICAL_SUBSTRINGS.some((s) => q.includes(s))
    || TECHNICAL_TOKEN_RE.test(q)
    || VERSION_TOKEN_RE.test(q);
}

// Pure definition domains: they define words, they never carry
// vulnerability intelligence. Data-driven, deliberately tiny.
const DICTIONARY_DOMAINS = [
  'dictionary.cambridge.org',
  'merriam-webster.com',
  'dictionary.com',
  'oxfordlearnersdictionaries.com',
];

function isDictionaryResult(r) {
  const h = resultHost(r && r.url);
  return h !== '' && DICTIONARY_DOMAINS.some((d) => h === d || h.endsWith('.' + d));
}

// Words of a result's title+snippet, for token-overlap checks.
function resultTokens(r) {
  const text = `${(r && r.title) || ''} ${(r && r.snippet) || ''}`.toLowerCase();
  return new Set(text.split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
}

/**
 * Apply dictionary hygiene (technical queries only) and the
 * relevance floor to one provider's result list. Provider order is
 * preserved for survivors. Only the hygiene step may empty the list
 * (a technical query whose provider returned nothing but dictionary
 * cards); the caller treats that like other junk and falls through
 * to the next provider.
 */
export function refineResults(query, results) {
  const list = results || [];
  if (list.length === 0) return list;
  const afterHygiene = isTechnicalQuery(query)
    ? list.filter((r) => !isDictionaryResult(r))
    : list;
  const tokens = significantTokens(query);
  if (tokens.length === 0 || afterHygiene.length === 0) return afterHygiene;
  const survivors = afterHygiene.filter((r) => {
    const rt = resultTokens(r);
    return tokens.some((t) => rt.has(t));
  });
  return survivors.length > 0 ? survivors : afterHygiene;
}

/**
 * Search the web for security intelligence.
 * Tries providers in order until one returns results; [] only when
 * every provider fails (network down / all bot-walled) — or, for a
 * site:-restricted query, when no provider returns a single result
 * actually on that domain.
 */
export async function webSearch(query, maxResults = 5) {
  const siteRestricted = /site:/i.test(String(query || ''));
  for (const provider of [searchBing, searchDuckDuckGo]) {
    try {
      const raw = await provider(query, maxResults);
      if (raw.length > 0) {
        const r = refineResults(query, raw);
        // Hygiene emptied this provider's list (a technical query
        // answered only with dictionary cards) — junk, so fall
        // through to the next provider like off-domain site: junk.
        if (r.length === 0) continue;
        if (!siteRestricted) return r;
        const filtered = filterSiteResults(query, r);
        if (filtered.length > 0) return filtered;
        // All off-domain junk from this provider — fall through: the
        // next provider may honour the operator.
      }
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
