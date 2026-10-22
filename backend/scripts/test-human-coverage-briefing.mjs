// Test for the human-mode UNPROBED LEADS + ENDPOINT COVERAGE section
// (Lane J, 22 Oct 2026).
//
// Live diagnosis on the Ezviz hunt (iter 148, 2,121 events, 633 tool
// calls, 0 genuine verified): 53% of tool calls were web searches;
// after a search the next action was another search 62% of the time.
// Lane G's briefing section named the unprobed classes but no page,
// no input and no payload — and the brain's own record shows a
// thinking block resolving to "send a real probe for command
// injection" followed by a plain registration POST with no payload.
// The discovered surface (/rest/user/login, /rest/user/profile?file=,
// /upload) was never shown back as coverage, so researched classes
// and known endpoints never met: file upload was researched while
// /upload never received one probe, and SQL injection (researched
// ×104) had exactly one glancing attempt — a typed `sql' --`.
//
// This suite proves the new perception section:
//   (a) discoveredEndpoints rebuilds the coverage map from the hunt's
//       own record (visits, input names, data sent, classes probed);
//   (b) unprobedLeadLines joins researched classes to concrete
//       endpoints/inputs/test values, including the glancing tier;
//   (c) probed endpoints and genuinely probed classes drop off;
//   (d) empty / lobby-only records render nothing (no placeholders);
//   (e) a real humanIteration screen carries the section early,
//       outside the memory briefing, and it updates as probes land.
//
// Run: node backend/scripts/test-human-coverage-briefing.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-j-'));
process.env.DATA_DIR = tmp;

const {
  humanIteration,
  discoveredEndpoints,
  unprobedLeadLines,
  probeSignatureHits,
  researchedNotProbedLines,
} = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const TARGET = 'https://t.test';
const tc = (tool, detail) => ({ type: 'tool_call', tool, detail, via: 'human-mode' });

// A fixture modelled on the live Ezviz pattern: heavy research, a
// glancing SQLi fragment, real LFI probes, an untouched upload page.
const baseEvents = [
  // research: SQLi x5 searches, cmdi x4, file upload x3, LFI x2
  ...Array.from({ length: 5 }, () => tc('search', 'sql injection login bypass techniques')),
  ...Array.from({ length: 4 }, () => tc('search', 'command injection patterns and techniques')),
  ...Array.from({ length: 3 }, () => tc('search', 'file upload vulnerability exploitation techniques')),
  ...Array.from({ length: 2 }, () => tc('search', 'local file inclusion path traversal')),
  // the one glancing SQLi attempt: a typed fragment in a form field
  tc('browser_type', "sql' --"),
  // surface discovery
  ...Array.from({ length: 6 }, () => tc('browser_open', 'https://t.test')),
  ...Array.from({ length: 3 }, () => tc('browser_open', 'https://t.test/login')),
  ...Array.from({ length: 2 }, () => tc('browser_open', 'https://t.test/upload')),
  tc('browser_open', 'https://other.example/elsewhere'),
  // ordinary (non-probe) traffic to the API login + register
  tc('shell', `curl -s -d 'username=test&password=<redacted>' -H 'Content-Type: application/json' -X POST https://t.test/rest/user/login`),
  tc('shell', `curl -s -d 'username=test&email=test@example.com&password=<redacted>' https://t.test/rest/user/register`),
  // genuine LFI probe series on the profile endpoint
  tc('shell', `curl -s -d 'file=/etc/passwd' https://t.test/rest/user/profile`),
  tc('browser_open', 'https://t.test/rest/user/profile?file=/etc/passwd'),
];
const baseRows = [
  { action: 'note to self', why: 'Look into SQL injection on the login form next', result: 'recorded', learned: '' },
];

// ---------------------------------------------------------------------------
// (a) discoveredEndpoints units
// ---------------------------------------------------------------------------
const eps = discoveredEndpoints(baseEvents, TARGET);
const byUrl = Object.fromEntries(eps.map((e) => [e.url, e]));
check('coverage: target-host endpoints discovered, off-host ignored',
  eps.length >= 5 && !eps.some((e) => e.url.includes('other.example')));
check('coverage: root visits counted', byUrl['https://t.test/'] && byUrl['https://t.test/'].visits === 6);
check('coverage: body parameter names extracted for the API login',
  byUrl['https://t.test/rest/user/login'] && byUrl['https://t.test/rest/user/login'].params.includes('username') &&
  byUrl['https://t.test/rest/user/login'].dataSent === true);
check('coverage: query parameter names extracted for the profile endpoint',
  byUrl['https://t.test/rest/user/profile'] && byUrl['https://t.test/rest/user/profile'].params.includes('file'));
check('coverage: LFI probe actions credited to the profile endpoint',
  byUrl['https://t.test/rest/user/profile'].probeActions === 2 &&
  byUrl['https://t.test/rest/user/profile'].probedClasses.includes('lfi'));
check('coverage: upload endpoint present but never probed',
  byUrl['https://t.test/upload'] && byUrl['https://t.test/upload'].visits === 2 &&
  byUrl['https://t.test/upload'].probeActions === 0);
check('coverage: empty record -> no endpoints', discoveredEndpoints([], TARGET).length === 0);

// ---------------------------------------------------------------------------
// (b) unprobedLeadLines units
// ---------------------------------------------------------------------------
const leads = unprobedLeadLines({ events: baseEvents, reasoningRows: baseRows, target: TARGET });
const leadsText = leads.join('\n');
check('leads: SQLi surfaces via the glancing tier with its research count',
  leads.some((l) => l.includes('SQL injection') && l.includes('×6') && l.includes('one glancing attempt')));
check('leads: SQLi lead is concrete — endpoint, input and differential test values',
  leads.some((l) => l.includes('SQL injection') && l.includes('https://t.test/rest/user/login') &&
    l.includes('username') && l.includes("' OR 1=1") && l.includes("' OR 1=2")));
check('leads: command injection lead present with its canonical test value',
  leads.some((l) => l.includes('command injection') && l.includes('never probed') && l.includes('test; id')));
check('leads: file upload lead targets the discovered upload endpoint with curl -F',
  leads.some((l) => l.includes('file upload') && l.includes('https://t.test/upload') && l.includes('curl -F')));
check('leads: genuinely probed LFI gets no topic lead',
  !leads.some((l) => l.includes('LFI / path traversal') && l.includes('Concrete next probe')));
check('leads: probed profile endpoint drops off the coverage list',
  !leadsText.includes('https://t.test/rest/user/profile'));
check('leads: unprobed register endpoint stays on the coverage list with its parameters',
  leads.some((l) => l.includes('https://t.test/rest/user/register') && l.includes('never probed') && l.includes('username')));
check('leads: the bare root is never offered as a coverage lead',
  !leads.some((l) => l.startsWith('- https://t.test —') || l.startsWith('- https://t.test/ —')));
check('leads: capped at the limit', leads.length <= 6);
check('leads: probeSignatureHits counts payload actions per class',
  probeSignatureHits(baseEvents, { probes: [/\ballert\b/] }) === 0 &&
  probeSignatureHits(baseEvents, { probes: [/\/etc\/passwd/] }) === 2);

// ---------------------------------------------------------------------------
// (c) drop-off: once real probes land, the leads go away
// ---------------------------------------------------------------------------
const probedEvents = [
  ...baseEvents,
  tc('shell', `curl -s "https://t.test/rest/user/login?username=' OR 1=1--"`),
  tc('shell', `curl -s "https://t.test/rest/user/login?username=' OR 1=2--"`),
  tc('shell', `curl -s -F 'file=@test.txt' https://t.test/upload`),
];
const probedLeads = unprobedLeadLines({ events: probedEvents, reasoningRows: baseRows, target: TARGET });
check('drop-off: SQLi lead gone after a real differential pair ran',
  !probedLeads.some((l) => l.includes('SQL injection')));
check('drop-off: file upload lead gone after a multipart probe ran',
  !probedLeads.some((l) => l.includes('file upload')));
check('drop-off: upload endpoint gone from coverage after the probe',
  !probedLeads.some((l) => l.includes('https://t.test/upload')));

// ---------------------------------------------------------------------------
// (d) empty states are clean
// ---------------------------------------------------------------------------
check('empty: no record -> no leads', unprobedLeadLines({ events: [], reasoningRows: [], target: TARGET }).length === 0);
check('empty: lobby-only record -> no leads',
  unprobedLeadLines({ events: [tc('browser_open', 'https://t.test'), tc('browser_open', 'https://t.test')], reasoningRows: [], target: TARGET }).length === 0);
check('regression: Lane G section still renders its own lines unchanged',
  researchedNotProbedLines({ events: baseEvents, reasoningRows: baseRows })
    .some((l) => l.includes('command injection') && l.includes('candidate next action')));

// ---------------------------------------------------------------------------
// (e) screen level: a real humanIteration turn carries the section
// ---------------------------------------------------------------------------
function fakeDeps(events) {
  const screens = [];
  return {
    screens,
    deps: {
      chat: async (msgs) => { screens.push(msgs[0].text); return 'Thinking.\n{"action":"note","text":"ok"}'; },
      execRaw: async () => ({ stdout: '/root', stderr: '', code: 0 }),
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      search: async () => [],
      writeFile: async () => ({ name: 'x', chars: 0 }),
      spill: () => '',
      record: () => {},
      readMeta: () => ({}),
      writeMeta: () => {},
      readEvents: () => events,
      recordNote: () => {},
      assess: null,
      sleep: async () => {},
      buildBriefing: async () => 'BRIEFING-BODY',
    },
  };
}

const s1 = fakeDeps(baseEvents);
await humanIteration('h_lane_j_screen', TARGET, { turns: 2, deps: s1.deps });
const screen = s1.screens[0] || '';
check('screen: carries the UNPROBED LEADS section', screen.includes('UNPROBED LEADS — CONCRETE NEXT PROBES'));
check('screen: SQLi concrete probe is on the screen',
  screen.includes('SQL injection') && screen.includes("' OR 1=1") && screen.includes('https://t.test/rest/user/login'));
check('screen: section sits before the memory briefing (outside its cap)',
  screen.indexOf('UNPROBED LEADS') >= 0 && screen.indexOf('UNPROBED LEADS') < screen.indexOf('=== WHAT YOU KNOW'));
check('screen: closing line states a search is not a test',
  screen.includes('A search result is not a test'));

const s2 = fakeDeps(probedEvents);
await humanIteration('h_lane_j_screen2', TARGET, { turns: 1, deps: s2.deps });
const screen2 = s2.screens[0] || '';
check('screen: SQLi lead absent once the differential pair is in the record',
  !screen2.includes('one glancing attempt'));

const s3 = fakeDeps([]);
await humanIteration('h_lane_j_screen3', TARGET, { turns: 1, deps: s3.deps });
const screen3 = s3.screens[0] || '';
check('screen: empty record -> no leads section, no placeholder', !screen3.includes('UNPROBED LEADS'));

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
