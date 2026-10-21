// Test for the site: honesty filter in webSearch (Lane D, 21 Oct 2026).
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
import { filterSiteResults } from '../src/webSearch.js';

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

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
