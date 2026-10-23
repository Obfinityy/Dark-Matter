// Test for the site: honesty filter in webSearch (Lane D, 21 Oct 2026),
// extended with the result-quality refinement (Lane AA, 24 Oct 2026):
// market pinning, dictionary hygiene and the relevance floor, and the
// DuckDuckGo Lite provider (Lane AC, 24 Oct 2026).
//
// Providers ignore the site: operator and return generic pages for
// the query keywords — observed live in the Ezviz hunt: the query
// "site:open.ys7.com security headers" returned Wikipedia's "Security"
// article and a JustDial listing for security guards in Jamnagar.
// The hunter read those as results and re-asked the identical query
// 17 times. filterSiteResults keeps only results actually on the
// restricted domain; an honest [] beats junk. Pure function — no
// network in this suite.
//
// Run: node backend/scripts/test-websearch.mjs
import { filterSiteResults, refineResults, significantTokens, isTechnicalQuery, webSearch } from '../src/webSearch.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const junk = [
  { title: 'Security - Wikipedia', url: 'https://en.wikipedia.org/wiki/Security', snippet: 'Security is protection...' },
  { title: 'Security Services in Jamnagar, Gujarat - Justdial', url: 'https://www.justdial.com/Jamnagar/Security-Services', snippet: '...' },
];
check('site: all-junk -> empty', filterSiteResults('site:open.ys7.com security headers', junk).length === 0);

const mixed = [
  ...junk,
  { title: 'Ezviz open platform docs', url: 'https://open.ys7.com/docs', snippet: '...' },
  { title: 'Console', url: 'https://console.open.ys7.com/', snippet: '...' },
];
const kept = filterSiteResults('site:open.ys7.com security headers', mixed);
check('site: on-domain kept, subdomain kept, junk dropped', kept.length === 2 && kept[0].url.includes('open.ys7.com/docs') && kept[1].url.includes('console.open.ys7.com'));

check('site: lookalike domain dropped', filterSiteResults('site:open.ys7.com x', [{ title: 't', url: 'https://open.ys7.com.evil.com/', snippet: '' }]).length === 0);
check('no site: -> results untouched', filterSiteResults('ezviz camera CVE 2024', junk).length === 2);
check('site: with path suffix on the domain token', filterSiteResults('site:open.ys7.com/login page', mixed).length === 2);
check('empty results stay empty', filterSiteResults('site:open.ys7.com x', []).length === 0);

// DuckDuckGo redirect links unwrap to the real destination host.
const ddg = [
  { title: 'Real doc', url: 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fopen.ys7.com%2Fapi', snippet: '' },
  { title: 'Off domain', url: 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F', snippet: '' },
];
const ddgKept = filterSiteResults('site:open.ys7.com api', ddg);
check('ddg redirect unwrapped for the host check', ddgKept.length === 1 && ddgKept[0].title === 'Real doc');

// ---------------------------------------------------------------------------
// Lane AA (24 Oct 2026): market pinning + result-quality refinement.
//
// Live from EC2, the unpinned Bing scrape localized by datacenter IP
// and returned a Cambridge Dictionary definition of "damn" as result
// #1 for "Damn Vulnerable Web Application (DVWA) v1.10
// vulnerabilities", and an unrelated Vimeo video ("Jungle mein Mangal
// karte hue pakda Gaya Gaya Jila Bihar") as result #1 for
// "open.ys7.com registration process vulnerabilities". The pure
// helpers are checked directly; webSearch itself is checked against
// fixture Bing pages with fetch stubbed (DuckDuckGo bot-walled, as in
// production).
// ---------------------------------------------------------------------------

// --- significantTokens ---
const dvwaTokens = significantTokens('Damn Vulnerable Web Application (DVWA) v1.10 vulnerabilities');
check('tokens: research words kept', dvwaTokens.includes('dvwa') && dvwaTokens.includes('damn') && dvwaTokens.includes('vulnerabilities'));
check('tokens: version fragments dropped', !dvwaTokens.includes('v1') && !dvwaTokens.includes('10'));
const siteTokens = significantTokens('site:open.ys7.com security headers');
check('tokens: site: operator stripped', siteTokens.includes('security') && siteTokens.includes('headers') && !siteTokens.includes('open') && !siteTokens.includes('ys7') && !siteTokens.includes('com'));

// --- isTechnicalQuery ---
check('technical: vulnerability wording', isTechnicalQuery('Damn Vulnerable Web Application (DVWA) v1.10 vulnerabilities') === true);
check('technical: cve + exploit', isTechnicalQuery('wordpress CVE-2024-1234 exploit') === true);
check('technical: sql injection', isTechnicalQuery('sql injection guide') === true);
check('technical: version number alone', isTechnicalQuery('openssl 3.0 changelog') === true);
check('not technical: damn meaning', isTechnicalQuery('damn meaning') === false);
check('not technical: capital does not trip the api test', isTechnicalQuery('capital of France') === false);
check('not technical: everyday question', isTechnicalQuery('best hiking trails') === false);

// --- refineResults (pure) ---
const dictResult = { title: 'DAMN | English meaning - Cambridge Dictionary', url: 'https://dictionary.cambridge.org/dictionary/english/damn', snippet: 'DAMN definition: an expression of anger.' };
const vimeoResult = { title: 'Jungle mein Mangal karte hue pakda Gaya Gaya Jila Bihar', url: 'https://vimeo.com/385442718', snippet: 'Watch this video recorded in the jungle region with local people and folk music.' };
const hikingResult = { title: 'Best hiking trails in the Alps', url: 'https://example.com/hiking', snippet: 'Mountain routes, huts and seasonal advice for walkers.' };

check('hygiene: dictionary dropped for a technical query', refineResults('dvwa sql injection', [dictResult]).length === 0);
check('hygiene: dictionary subdomain dropped too', refineResults('xss bypass techniques', [{ title: 'XSS - Merriam-Webster', url: 'https://www.merriam-webster.com/dictionary/xss', snippet: 'Definition of XSS.' }]).length === 0);
check('hygiene: dictionary kept for a non-technical query', refineResults('damn meaning', [dictResult]).length === 1);
check('floor: never empties a list', refineResults('ezviz camera firmware update', [hikingResult]).length === 1);
check('floor: zero-overlap dropped, survivors keep provider order', (() => {
  const goodA = { title: 'Ezviz registration process', url: 'https://a.example/1', snippet: 'How accounts are created.' };
  const goodB = { title: 'ys7 platform vulnerabilities writeup', url: 'https://b.example/2', snippet: 'Findings and fixes.' };
  const out = refineResults('open.ys7.com registration process vulnerabilities', [vimeoResult, goodA, hikingResult, goodB]);
  return out.length === 2 && out[0].url === goodA.url && out[1].url === goodB.url;
})());

// --- webSearch end-to-end against fixture Bing pages (fetch stubbed) ---
const realFetch = globalThis.fetch;
const fetchedUrls = [];
let bingFixture = '';
globalThis.fetch = async (url) => {
  const u = String(url);
  fetchedUrls.push(u);
  if (u.includes('bing.com')) return { ok: true, text: async () => bingFixture };
  return { ok: false, status: 202, text: async () => '' }; // DDG bot-walled, as in production
};

const bingBlock = (href, title, snippet) =>
  `<li class="b_algo"><h2><a href="${href}">${title}</a></h2><p>${snippet}</p></li>`;

// (a)+(e): dictionary card first on the DVWA query; market pinned.
bingFixture = '<html><body><ol>'
  + bingBlock('https://dictionary.cambridge.org/dictionary/english/damn', 'DAMN | English meaning - Cambridge Dictionary', 'DAMN definition: 1. an expression of anger. 2. to criticize someone or something strongly.')
  + bingBlock('https://www.exploit-db.com/exploits/50139', 'Damn Vulnerable Web Application (DVWA) - SQL Injection', 'Exploit for DVWA. Damn Vulnerable Web Application (DVWA) v1.10 suffers from an authenticated SQL injection vulnerability.')
  + '</ol></body></html>';
const dvwaRes = await webSearch('Damn Vulnerable Web Application (DVWA) v1.10 vulnerabilities');
check('e2e dvwa: dictionary card dropped, exploit writeup is the only result', dvwaRes.length === 1 && dvwaRes[0].url.includes('exploit-db.com'));
const bingUrl = fetchedUrls.find((u) => u.includes('bing.com/search'));
check('e2e: bing request pins mkt + setlang', !!bingUrl && bingUrl.includes('mkt=en-US') && bingUrl.includes('setlang=en'));

// (b): zero-overlap Vimeo junk dropped by the floor.
bingFixture = '<html><body><ol>'
  + bingBlock('https://vimeo.com/385442718', 'Jungle mein Mangal karte hue pakda Gaya Gaya Jila Bihar', 'Watch this video recorded in the jungle region with local people and folk music.')
  + bingBlock('https://research.example.org/ezviz-registration', 'Ezviz registration flow — research notes', 'Notes on the open.ys7.com registration process, email verification and account activation weaknesses.')
  + '</ol></body></html>';
const ezvizRes = await webSearch('open.ys7.com registration process vulnerabilities');
check('e2e ezviz: vimeo junk dropped, research note survives', ezvizRes.length === 1 && ezvizRes[0].url.includes('research.example.org'));

// (c): non-technical query keeps its dictionary result.
bingFixture = '<html><body><ol>'
  + bingBlock('https://dictionary.cambridge.org/dictionary/english/damn', 'DAMN | English meaning - Cambridge Dictionary', 'DAMN definition: an expression of anger, or to criticize strongly.')
  + '</ol></body></html>';
const damnRes = await webSearch('damn meaning');
check('e2e damn meaning: dictionary result kept', damnRes.length === 1 && damnRes[0].url.includes('dictionary.cambridge.org'));

// (d): all-irrelevant page comes back untouched (floor never empties).
bingFixture = '<html><body><ol>'
  + bingBlock('https://example.com/hiking', 'Best hiking trails in the Alps', 'Mountain routes, huts and seasonal advice for walkers.')
  + bingBlock('https://example.com/cake', 'Chocolate cake recipe', 'Mix flour, cocoa and sugar, then bake for thirty minutes.')
  + '</ol></body></html>';
const irrRes = await webSearch('ezviz camera firmware update');
check('e2e all-irrelevant: original list returned in order', irrRes.length === 2 && irrRes[0].url.includes('/hiking') && irrRes[1].url.includes('/cake'));

// Composition: site: honesty (Lane D) still holds through refineResults.
bingFixture = '<html><body><ol>'
  + bingBlock('https://en.wikipedia.org/wiki/Security', 'Security - Wikipedia', 'Security is protection against harm and loss.')
  + bingBlock('https://open.ys7.com/docs', 'Ezviz open platform docs', 'Security headers reference for the open platform API.')
  + '</ol></body></html>';
const siteRes = await webSearch('site:open.ys7.com security headers');
check('e2e site:: on-domain result only, through refinement', siteRes.length === 1 && siteRes[0].url.includes('open.ys7.com/docs'));

globalThis.fetch = realFetch;

// ---------------------------------------------------------------------------
// Lane AC (24 Oct 2026): DuckDuckGo Lite provider, first in the order.
//
// Bing turned actively harmful from the EC2 datacenter IP (all-
// dictionary unpinned, porn spam pinned), while lite.duckduckgo.com
// answered 200 with parseable results the same night. The fixtures
// below model the real lite markup captured live: result anchors
// with class='result-link' (single quotes, href before class, hrefs
// usually the //duckduckgo.com/l/?uddg=… redirector), each followed
// by a <td class='result-snippet'> row. One row deliberately flips
// attribute order and quote style — the parser must be liberal.
// ---------------------------------------------------------------------------

const fetched2 = [];
let liteFixture = '';
let bingFixture2 = '';
globalThis.fetch = async (url) => {
  const u = String(url);
  fetched2.push(u);
  if (u.includes('lite.duckduckgo.com')) return { ok: true, text: async () => liteFixture };
  if (u.includes('bing.com')) return { ok: true, text: async () => bingFixture2 };
  return { ok: false, status: 202, text: async () => '' }; // DDG html bot-walled
};

const liteRow = (anchor, snippet) => `
      <tr><td valign="top">1.&nbsp;</td><td>${anchor}</td></tr>
      <tr><td>&nbsp;&nbsp;&nbsp;</td><td class='result-snippet'>${snippet}</td></tr>
      <tr><td>&nbsp;&nbsp;&nbsp;</td><td><span class='link-text'>x</span></td></tr>`;

liteFixture = '<html><head><title>DVWA vulnerabilities exploit at DuckDuckGo</title></head><body><table border="0">'
  + liteRow(
    '<a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2Fj0wittmann%2FAttacking-DVWA&amp;rut=bf986068" class=\'result-link\'>GitHub - Attacking DVWA: step-by-step exploit guide</a>',
    '<b>DVWA</b> (Damn Vulnerable Web Application) is an intentionally vulnerable web app for practicing common web <b>exploits</b>.')
  + liteRow(
    '<a class="result-link" href="https://www.exploit-db.com/exploits/50139">DVWA - SQL Injection exploit</a>',
    'Exploit for DVWA. Damn Vulnerable Web Application v1.10 suffers from an authenticated SQL injection vulnerability.')
  + liteRow(
    '<a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.golinuxcloud.com%2Fdvwa-command-injection%2F&amp;rut=86af8a" class=\'result-link\'>DVWA &#39;command injection&#39; &amp; more</a>',
    'Walkthrough of DVWA command injection vulnerabilities and how to exploit them.')
  + '</table></body></html>';
bingFixture2 = '';

fetched2.length = 0;
const liteRes = await webSearch('DVWA vulnerabilities exploit');
check('lite e2e: 3 results parsed in page order', liteRes.length === 3
  && liteRes[0].url.includes('github.com/j0wittmann')
  && liteRes[1].url.includes('exploit-db.com')
  && liteRes[2].url.includes('golinuxcloud.com'));
check('lite e2e: uddg wrapper unwrapped (rut dropped), direct href untouched', liteRes.length === 3
  && liteRes[0].url === 'https://github.com/j0wittmann/Attacking-DVWA'
  && liteRes[1].url === 'https://www.exploit-db.com/exploits/50139');
check('lite e2e: title entities decoded', liteRes.length === 3 && liteRes[2].title === "DVWA 'command injection' & more");
check('lite e2e: snippets extracted, highlight tags stripped', liteRes.length === 3
  && liteRes[0].snippet.includes('intentionally vulnerable web app')
  && !liteRes[0].snippet.includes('<b>'));
check('order: lite answers -> bing and ddg-html never fetched', fetched2.length > 0
  && fetched2.every((u) => u.includes('lite.duckduckgo.com')));

// Bot/landing page: big title, no result-link anchors -> [], never a
// pseudo-result parsed out of page furniture.
liteFixture = '<html><head><title>DuckDuckGo</title></head><body><h1>DuckDuckGo — Privacy, simplified.</h1><p>The search engine that does not track you.</p></body></html>';
bingFixture2 = '<html><body><ol></ol></body></html>';
const botRes = await webSearch('DVWA vulnerabilities exploit');
check('lite bot page: no pseudo-result, chain returns []', botRes.length === 0);

// Order: lite empty -> Bing serves.
liteFixture = '<html><body><p>No results found.</p></body></html>';
bingFixture2 = '<html><body><ol>'
  + bingBlock('https://research.example.org/ezviz-registration', 'Ezviz registration flow — research notes', 'Notes on the open.ys7.com registration process, email verification and account activation weaknesses.')
  + '</ol></body></html>';
fetched2.length = 0;
const fallRes = await webSearch('open.ys7.com registration process vulnerabilities');
check('order: lite empty -> bing fetched and serves', fallRes.length === 1
  && fallRes[0].url.includes('research.example.org')
  && fetched2.some((u) => u.includes('bing.com')));

// Order: lite + bing both empty -> DDG html is fetched (and its
// bot-wall answer ends the chain at []).
liteFixture = '<html><body><p>No results found.</p></body></html>';
bingFixture2 = '<html><body></body></html>';
fetched2.length = 0;
const emptyRes = await webSearch('DVWA vulnerabilities exploit');
check('order: lite+bing empty -> ddg-html fetched, chain returns []', emptyRes.length === 0
  && fetched2.some((u) => u.includes('html.duckduckgo.com')));

globalThis.fetch = realFetch;

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
