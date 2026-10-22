// Test for human mode (20 Oct 2026) — the single free hunter loop.
//
// This VM has no Docker and no local model, so the loop is proven
// end-to-end with injected fakes (the loop's deps seam exists exactly
// for this): a scripted brain, a fake container, a fake verifier.
// Proves:
//   - PERCEIVE: the screen carries target, memory briefing, live
//     machine state and the last action's result;
//   - THINK: the model's full reply is recorded verbatim as a
//     thinking event before parsing; the LAST JSON object is the
//     action (fences/prose tolerated); a prose-only reply earns a
//     corrective observation on the next screen;
//   - ACT: shell/search/write_file/browser_open/screenshot/
//     claim_finding all dispatch to the right machinery;
//   - LAW: the parsedScope requests-per-minute cap is paced between
//     shell actions; an out-of-scope host is blocked before exec;
//     a heavy scanner is blocked under noHeavyScan;
//   - TRUTH: a claim goes to the (fake) pipeline verifier and only
//     its verdict makes it a finding; with no verifier wired the
//     claim is recorded UNVERIFIED with the pending-verification mark;
//   - CHECKPOINT: session totals land on meta under humanLoop.
// A live-model run is NOT claimed here — that needs Docker + Ollama
// (the EC2 hunt box) and is the parent's deploy step.
//
// Run: node backend/scripts/test-human-loop.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-human-'));
process.env.DATA_DIR = tmp;

const { humanIteration, parseHumanAction, scopeViolation, repetitionLines, huntFactLines } = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// ---------------------------------------------------------------------------
// parseHumanAction units
// ---------------------------------------------------------------------------
check('parse: bare JSON', parseHumanAction('{"action":"shell","command":"id"}')?.action.command === 'id');
check('parse: fenced JSON', parseHumanAction('thinking...\n```json\n{"action":"note","text":"hi"}\n```')?.action.action === 'note');
check('parse: last object wins', parseHumanAction('{"action":"note","text":"a"} then {"action":"shell","command":"id"}')?.action.action === 'shell');
check('parse: prose only -> null', parseHumanAction('I wonder about the login form...') === null);
check('parse: JSON without action -> null', parseHumanAction('{"foo":1}') === null);
check('parse: braces inside strings survive', parseHumanAction('{"action":"write_file","name":"x.py","content":"print({\\"a\\": 1})"}')?.action.name === 'x.py');

// ---------------------------------------------------------------------------
// scopeViolation units
// ---------------------------------------------------------------------------
const PS = { domain: 'target.test', inScope: ['target.test'], outOfScope: [], rules: { noDoS: true, noHeavyScan: true, maxRequestsPerMin: 2 } };
check('scope: target allowed', scopeViolation('http://target.test/login', 'http://target.test', PS) === null);
check('scope: target subdomain allowed', scopeViolation('http://api.target.test/v1', 'http://target.test', PS) === null);
check('scope: foreign host blocked', scopeViolation('http://evil.example.com/x', 'http://target.test', PS) === 'http://evil.example.com/x');
check('scope: tool download host allowed', scopeViolation('https://github.com/ffuf/ffuf/releases', 'http://target.test', PS) === null);
check('scope: no parsedScope -> allowed', scopeViolation('http://anything.example/x', 'http://target.test', null) === null);

// ---------------------------------------------------------------------------
// Full scripted session with fakes
// ---------------------------------------------------------------------------
const HUNT = 'h_human_test';
const TARGET = 'http://target.test';

let clock = 0;
const sleeps = [];
const order = []; // interleaved exec/sleep order for the pacing proof
const events = [];
const notes = [];
const shellCommands = [];
const searches = [];
const writes = [];
const guiCalls = [];
const assessCalls = [];
const screens = [];
let metaStore = {
  huntId: HUNT,
  target: TARGET,
  mode: 'human',
  humanMode: true,
  parsedScope: PS,
};

const replies = [
  'The site is up. Let me see what robots.txt hides before touching anything.\n{"action":"shell","command":"curl -s http://target.test/robots.txt"}',
  'Headers next — I want the server fingerprint.\n{"action":"shell","command":"curl -sI http://target.test/"}',
  'I wonder what else lives under /admin. Let me think about the sitemap first.',
  'I should check what is publicly known about this stack.\n{"action":"search","query":"target.test admin panel CVE"}',
  'Time to write my reflection probe as a script so I can reuse it.\n{"action":"write_file","name":"probe.py","content":"import sys\\nprint(\'probe\')"}',
  'Let me actually LOOK at the login page like a person would.\n{"action":"browser_open","url":"http://target.test/login"}',
  'I want a picture of this desktop for the record.\n{"action":"screenshot"}',
  'The search parameter reflected my script tag verbatim in the response — that is a reflected XSS. Claiming it with the exact command.\n{"action":"claim_finding","title":"Reflected XSS in search","evidence":"GET /search?q=<script>alert(1)</script> -> <script>alert(1)</script> reflected unencoded","command":"curl -s \'http://target.test/search?q=<script>alert(1)</script>\'",\"class\":\"xss\",\"counterevidence\":\"A plain-word query returned no script tag anywhere in the body; the tag appears only when injected\",\"confidence\":\"high\"}',
  'Let me pull the same data from a mirror I know.\n{"action":"shell","command":"curl -s http://evil.example.com/steal"}',
  'A full port sweep will map everything at once.\n{"action":"shell","command":"nmap -p- target.test"}',
];

const deps = {
  chat: async (messages) => {
    screens.push(messages[0].text);
    return replies.length ? replies.shift() : null;
  },
  exec: async (h, t, command) => {
    shellCommands.push(command);
    order.push(`exec:${command.slice(0, 40)}`);
    clock += 50;
    if (command.includes('robots.txt')) return { stdout: 'User-agent: *\nDisallow: /admin', stderr: '', code: 0 };
    return { stdout: 'HTTP/1.1 200 OK\nServer: targetd/1.0', stderr: '', code: 0 };
  },
  execRaw: async () => ({ stdout: '/root\n---\napp.py\nnotes.txt', stderr: '', code: 0 }),
  search: async (q) => {
    searches.push(q);
    return [
      { title: 'targetd 1.0 admin panel advisory', url: 'https://example.org/adv1', snippet: 'Default creds on /admin.' },
      { title: 'Reflected XSS patterns', url: 'https://example.org/xss', snippet: 'Check the q parameter.' },
    ];
  },
  writeFile: async (h, name, content) => {
    writes.push({ name, content });
    return { name, chars: content.length };
  },
  spill: () => 'spilled-output.log',
  record: (h, ev) => events.push(ev),
  readMeta: () => metaStore,
  writeMeta: (h, m) => { metaStore = m; },
  readEvents: () => [],
  recordNote: (h, entry) => notes.push(entry),
  assess: async (h, t, plan, result) => {
    assessCalls.push({ plan, result });
    return { verified: true, title: plan.test, severity: 'high', verification: 'confirmed (all 4 steps passed)' };
  },
  gui: {
    open: async (h, url) => {
      guiCalls.push(['open', url]);
      return { ok: true, observation: 'Opened http://target.test/login in your desktop browser.\nPage: Login — http://target.test/login\n--- visible text ---\nSign in to continue\n--- clickable / typeable elements ---\n- [button] "Sign in"' };
    },
    snapshot: async () => ({ ok: true, observation: 'Page: Login — snapshot' }),
    click: async () => ({ ok: true, observation: 'clicked' }),
    type: async () => ({ ok: true, observation: 'typed' }),
    screenshot: async () => {
      guiCalls.push(['screenshot']);
      return { ok: true, artifact: 'screenshot-20261020120000.png', observation: 'Screenshot saved as artifact screenshot-20261020120000.png in your hunt workspace. What the page shows:\nPage: Login — http://target.test/login' };
    },
  },
  sleep: async (ms) => { sleeps.push(ms); order.push(`sleep:${ms}`); clock += ms; },
  now: () => clock,
  buildBriefing: async () => 'BRIEFING: you previously found the login page reflects input.',
};

const findings = [];
const res = await humanIteration(HUNT, TARGET, { turns: 10, findings, deps });

check('session: aiOk', res.aiOk === true);
check('session: 10 turns run', res.turnsRun === 10);
check('perceive: screen 1 has target + briefing + machine state', screens[0].includes(TARGET) && screens[0].includes('BRIEFING: you previously found') && screens[0].includes('/root') && screens[0].includes('notes.txt'));
check('perceive: screen 2 shows last action result (robots)', screens[1].includes('Disallow: /admin'));
check('think: full first reply recorded verbatim as thinking event', events.some((e) => e.type === 'thinking' && e.text === 'The site is up. Let me see what robots.txt hides before touching anything.\n{"action":"shell","command":"curl -s http://target.test/robots.txt"}'));
check('think: tool_call events recorded', events.some((e) => e.type === 'tool_call' && e.tool === 'shell') && events.some((e) => e.type === 'tool_call' && e.tool === 'browser_open'));
check('parse feedback: prose-only reply corrected on next screen', screens[3].includes('NO parseable action JSON'));
check('pacing: rate-limit sleep before 2nd shell action', (() => {
  const firstExec = order.findIndex((o) => o.startsWith('exec:'));
  const secondExec = order.findIndex((o, i) => o.startsWith('exec:') && i > firstExec);
  const sleepIdx = order.findIndex((o) => o.startsWith('sleep:'));
  return sleepIdx > firstExec && sleepIdx < secondExec && sleeps[0] >= 29000;
})());
check('search: dispatched with the model query', searches.length === 1 && searches[0] === 'target.test admin panel CVE');
check('search: results on next screen', screens[4].includes('targetd 1.0 admin panel advisory'));
check('write_file: dispatched with name + content', writes.length === 1 && writes[0].name === 'probe.py' && writes[0].content.includes('print'));
check('gui: browser_open dispatched with URL', guiCalls.some((c) => c[0] === 'open' && c[1] === 'http://target.test/login'));
check('gui: open snapshot visible on next screen', screens[6].includes('Sign in to continue'));
check('gui: screenshot artifact handle on next screen', screens[7].includes('screenshot-20261020120000.png'));
check('claim: verifier called with title + reproducing command', assessCalls.length === 1 && assessCalls[0].plan.test === 'Reflected XSS in search' && assessCalls[0].plan.command.includes('search?q='));
check('claim: verified record pushed to findings', findings.length === 1 && findings[0].verified === true && res.newFindings.length === 1);
check('claim: VERIFIED verdict on next screen', screens[8].includes('VERIFIED by the independent verifier'));
check('law: out-of-scope shell blocked before exec', !shellCommands.some((c) => c.includes('evil.example.com')));
check('law: out-of-scope block explained on next screen', screens[9].includes('OUT OF SCOPE'));
check('law: heavy scan blocked under noHeavyScan', !shellCommands.some((c) => c.includes('nmap')));
check('law: only 2 shell commands ever executed', shellCommands.length === 2);
check('notebook: reasoning notes recorded', notes.length >= 5);
check('checkpoint: meta humanLoop totals written', metaStore.humanLoop && metaStore.humanLoop.turnsTotal === 10 && metaStore.humanLoop.sessions === 1);

// ---------------------------------------------------------------------------
// Claim with NO verifier wired -> recorded UNVERIFIED, never verified
// ---------------------------------------------------------------------------
const events2 = [];
let meta2 = { huntId: 'h_human_test2', parsedScope: PS };
const res2 = await humanIteration('h_human_test2', TARGET, {
  turns: 1,
  deps: {
    ...deps,
    chat: async () => 'Found it.\n{"action":"claim_finding","title":"SQLi in login","class":"sqli","evidence":"The login response returned the full admin row (id 1, role admin) for a wrong password once the injection closed the query","command":"curl -s http://target.test/login","counterevidence":"The same login with a plain wrong password and no injection returned 401 invalid credentials","confidence":"high"}',
    record: (h, ev) => events2.push(ev),
    readMeta: () => meta2,
    writeMeta: (h, m) => { meta2 = m; },
    assess: null, // explicitly disabled — no lazy pipeline import
  },
});
const claimEvent = events2.find((e) => e.type === 'finding');
check('no-verifier claim: recorded as a finding event', Boolean(claimEvent));
check('no-verifier claim: verified === false', claimEvent && claimEvent.verified === false);
check('no-verifier claim: pending-verification mark', claimEvent && claimEvent.verification === 'human-mode claim — pending pipeline verification');
check('no-verifier claim: nothing pushed to newFindings', res2.newFindings.length === 0);

// ---------------------------------------------------------------------------
// Brain silence -> honest aiOk:false (the hunt loop's circuit breaker input)
// ---------------------------------------------------------------------------
const res3 = await humanIteration('h_human_test3', TARGET, {
  turns: 3,
  deps: {
    ...deps,
    chat: async () => null,
    readMeta: () => ({ huntId: 'h_human_test3', parsedScope: PS }),
    writeMeta: () => {},
  },
});
check('brain silence: aiOk false + failKind no_reply', res3.aiOk === false && res3.failKind === 'no_reply');

// ---------------------------------------------------------------------------
// Perception facts (Lane D, 21 Oct 2026): in-scope surface, the
// no-credentials fact, and exact-repeat counts — all rendered from
// the hunt's own records. Ezviz audit: 59% of the hunter's actions
// were exact repeats and it POSTed guessed credentials, because the
// screen carried none of these facts.
// ---------------------------------------------------------------------------
check('unit: repetitionLines counts exact repeats', (() => {
  const evs = [];
  for (let i = 0; i < 6; i++) evs.push({ type: 'tool_call', tool: 'browser_open', detail: 'https://x.test/login' });
  for (let i = 0; i < 3; i++) evs.push({ type: 'tool_call', tool: 'search', detail: 'q1' });
  for (let i = 0; i < 2; i++) evs.push({ type: 'tool_call', tool: 'search', detail: 'q2' });
  const lines = repetitionLines(evs).join('\n');
  return lines.includes('×6') && lines.includes('×3') && !lines.includes('q2');
})());
check('unit: huntFactLines flags missing credentials', huntFactLines({}).join(' ').includes('No test-account credentials'));
check('unit: huntFactLines quiet when accounts exist', huntFactLines({ testAccounts: [{ user: 'a@b.c' }] }).length === 0);

const PS4 = { domain: 'open.ys7.com', inScope: ['open.ys7.com', 'www.ezviz.com', 'api.ezvizlife.com'], outOfScope: [], outOfScopeHosts: ['test.ys7.com'], rules: { noDoS: true, noHeavyScan: true, maxRequestsPerMin: 20 } };
const pastEvents = [];
for (let i = 0; i < 27; i++) pastEvents.push({ type: 'tool_call', tool: 'browser_open', detail: 'https://open.ys7.com/login', via: 'human-mode' });
for (let i = 0; i < 17; i++) pastEvents.push({ type: 'tool_call', tool: 'search', detail: 'site:open.ys7.com security headers', via: 'human-mode' });
for (let i = 0; i < 2; i++) pastEvents.push({ type: 'tool_call', tool: 'search', detail: 'a rare query', via: 'human-mode' });
const screens4 = [];
let meta4 = { huntId: 'h_human_test4', target: 'https://open.ys7.com', parsedScope: PS4 };
await humanIteration('h_human_test4', 'https://open.ys7.com', {
  turns: 1,
  deps: {
    ...deps,
    chat: async (messages) => { screens4.push(messages[0].text); return 'Noted.\n{"action":"note","text":"ok"}'; },
    readMeta: () => meta4,
    writeMeta: (h, m) => { meta4 = m; },
    readEvents: () => pastEvents,
    record: () => {},
    recordNote: () => {},
  },
});
check('perceive: screen lists the in-scope programme surface', screens4[0].includes('IN SCOPE FOR THIS PROGRAMME') && screens4[0].includes('www.ezviz.com') && screens4[0].includes('api.ezvizlife.com'));
check('perceive: repetition check shows exact counts', screens4[0].includes('REPETITION CHECK') && screens4[0].includes('×27') && screens4[0].includes('×17'));
check('perceive: below-threshold repeats not shown', !screens4[0].includes('a rare query'));
check('perceive: no-credentials fact shown when hunt holds none', screens4[0].includes('No test-account credentials were provided'));

const screens5 = [];
let meta5 = { huntId: 'h_human_test5', target: 'https://open.ys7.com', parsedScope: PS4, testAccounts: [{ user: 'owner@example.com' }] };
await humanIteration('h_human_test5', 'https://open.ys7.com', {
  turns: 1,
  deps: {
    ...deps,
    chat: async (messages) => { screens5.push(messages[0].text); return 'Noted.\n{"action":"note","text":"ok"}'; },
    readMeta: () => meta5,
    writeMeta: (h, m) => { meta5 = m; },
    readEvents: () => [],
    record: () => {},
    recordNote: () => {},
  },
});
check('perceive: credentials fact hidden when accounts exist', !screens5[0].includes('No test-account credentials were provided'));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
