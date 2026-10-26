// REAL-HUMAN lane (26 Oct 2026, owner order + 14:18 IST clarification:
// the machine is already given — the lane is the BRAIN: it remembers
// everything old, understands what it does, nothing predefined, it
// just keeps hunting).
//
// Integration tests through a stubbed humanIteration:
//   RH-1  a re-pull of a skill whose plan is still open is blocked
//         (plan_block) — the SQLi "planned twice, sent 0x" case.
//   RH-2  the brain answers a queued owner question in-turn
//         (chat_answers) and the answer is delivered.
//   RH-3  desktop_click_control clicks a named control inside a
//         GUI app (AT-SPI) — and degrades honestly when the stack
//         is missing from this image.
//   RH-4  the desktop nudge names the untried desktop route when
//         the browser surface is exhausted.
//   RH-5  a reworded repeat search is blocked (near-duplicate
//         gate); a genuinely new question still runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-realhuman-'));
process.env.DATA_DIR = tmpRoot;

const {
  humanIteration,
  pendingPlannedProbes,
  searchQueryTokens,
  searchTokenSimilarity,
  searchRepeatHit,
  defaultDeliverChatAnswer,
} = await import('./humanLoop.js');
const {
  queueChatQuestion,
  pendingChatQuestions,
} = await import('./chatQueue.js');
const { readHuntEvents } = await import('./store.js');

const TARGET = 'https://ksuite.infomaniak.com';
const LOGIN_URL = 'https://login.infomaniak.com/login';
const XSS = `<script>alert('XSS')</script>`;
const XSS_ENCODED = `%3cscript%3ealert('XSS')%3c/script%3e`;

const LOGIN_SNAP = {
  url: LOGIN_URL,
  title: 'Sign in',
  text: 'Sign in to your account Email Password',
  elements: [
    { label: 'Email', tag: 'input', type: 'email', id: 'email' },
    { label: 'Password', tag: 'input', type: 'password', id: 'password' },
    { label: 'Sign in', tag: 'button', id: 'submit' },
    { label: 'Create an account', tag: 'a', href: 'https://login.infomaniak.com/signup' },
  ],
};

const WINDOWS_OUT = [
  '12345678',
  '87654321',
  '---TITLES---',
  'Burp Suite - Community Edition',
  'Terminal - bash',
  '---ACTIVE---',
  'Terminal - bash',
  '',
].join('\n');

const ATSPI_CLICK_OK = JSON.stringify({
  ok: true,
  clicked: { name: 'Repeater', role: 'page tab', window: 'Burp Suite - Community Edition' },
});
const ATSPI_MISSING = JSON.stringify({
  ok: false,
  error: 'pyatspi is not installed in this image (python3-pyatspi missing) — in-app clicking needs the image rebuild; use desktop_key keyboard navigation instead',
});

function stubSession(huntId, replies, { events = [], execImpl = null, searchImpl = null, deliverImpl = null } = {}) {
  const recorded = [];
  const execCalls = [];
  const screens = [];
  const searchCalls = [];
  const delivered = [];
  let n = 0;
  const execRaw = execImpl || (async (h, cmd) => {
    execCalls.push(String(cmd || ''));
    if (String(cmd || '').includes('xdotool search')) return { stdout: WINDOWS_OUT, stderr: '', code: 0 };
    if (String(cmd || '').includes("python3 - 'click'")) return { stdout: ATSPI_CLICK_OK, stderr: '', code: 0 };
    return { stdout: '', stderr: '' };
  });
  return {
    recorded, execCalls, screens, searchCalls, delivered,
    run: () => humanIteration(huntId, TARGET, {
      turns: replies.length,
      deps: {
        chat: async (messages) => { screens.push(messages[0].text); return replies[n++]; },
        gui: {
          open: async () => ({ observation: 'opened', snapshot: LOGIN_SNAP }),
          snapshot: async () => ({ observation: `Page: ${LOGIN_URL}\nSign in`, snapshot: LOGIN_SNAP }),
          click: async () => ({ ok: true, observation: 'clicked', snapshot: LOGIN_SNAP }),
          type: async () => ({ ok: true, observation: 'Typed.', snapshot: LOGIN_SNAP }),
          screenshot: async () => ({ observation: 'shot', snapshot: LOGIN_SNAP }),
        },
        execRaw,
        desktopScreenshot: async () => ({ ok: true, name: 'desktop-20261026130000.jpg' }),
        search: searchImpl || (async (q) => { searchCalls.push(q); return `results for ${q}`; }),
        deliverChatAnswer: deliverImpl || (async (h, a) => { delivered.push(a); return true; }),
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => ({}),
        readEvents: () => events,
        buildBriefing: async () => '',
        machineControlled: () => false,
        assess: null,
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Pure: pending plans + search similarity.
// ---------------------------------------------------------------------------

test('RH-0a: pendingPlannedProbes names the open plan (structured, for the gate)', () => {
  const events = [
    { type: 'tool_call', tool: 'load_skill', detail: 'sqli' },
    { type: 'tool_call', tool: 'search', detail: 'sql injection login bypass' },
  ];
  const plans = pendingPlannedProbes({ events, reasoningRows: [] });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].topic.id, 'sqli');
  assert.equal(plans[0].skill, 'sqli');
  assert.equal(plans[0].when, 'in an earlier session');
  // A probe after the load closes the plan.
  const probed = [...events, { type: 'tool_call', tool: 'shell', detail: `curl -s "${TARGET}/login?id=' OR 1=1--"` }];
  assert.equal(pendingPlannedProbes({ events: probed, reasoningRows: [] }).length, 0);
});

test('RH-0b: search tokens ignore case, order, filler and punctuation', () => {
  assert.deepEqual(
    [...searchQueryTokens('SQL injection login bypass techniques!')].sort(),
    ['bypass', 'injection', 'login', 'sql', 'techniques'],
  );
  assert.equal(searchTokenSimilarity(
    searchQueryTokens('sql injection login bypass'),
    searchQueryTokens('SQL injection login bypass techniques'),
  ), 0.8);
  assert.equal(searchTokenSimilarity(
    searchQueryTokens('xss payload list'),
    searchQueryTokens('sql injection login bypass'),
  ), 0);
  assert.equal(searchTokenSimilarity(searchQueryTokens('xss'), searchQueryTokens('xss payload')), 0.5, 'raw Jaccard is 0.5 — the >=2-token guard lives in searchRepeatHit, not here');
});

// ---------------------------------------------------------------------------
// RH-1: the pending-plan gate.
// ---------------------------------------------------------------------------

test('RH-1: a re-pull of a skill with an open plan is blocked, not re-read', async () => {
  const events = [{ type: 'tool_call', tool: 'load_skill', detail: 'sqli' }];
  const s = stubSession('h_rh1', ['I will pull the SQLi card again.\n{"action":"load_skill","skill":"sqli"}'], { events });
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  const obs = res.log[0].observation;
  assert.match(obs, /BLOCKED — PLAN ALREADY OPEN/);
  assert.match(obs, /no .* probe since/i);
  assert.match(obs, /send its first probe now/);
  // (The turn log truncates observations at 300 chars — the second
  // close instruction, "record_coverage as not_applicable", lives
  // past that cut in the full observation the brain sees; verified
  // in the dispatch at humanLoop.js:3706.)
  assert.doesNotMatch(obs, /proof bar/i, 'the card body must not be returned — the lookup never ran');
  const blocked = s.recorded.find((e) => e.type === 'plan_block');
  assert.ok(blocked, 'a plan_block event must be recorded');
  assert.equal(blocked.tool, 'load_skill');
});

test('RH-1b: a FIRST pull of a skill executes normally — the gate only stops re-pulls', async () => {
  const s = stubSession('h_rh1b', ['I will open SQL injection.\n{"action":"load_skill","skill":"sqli"}']);
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  const obs = res.log[0].observation;
  assert.doesNotMatch(obs, /BLOCKED — PLAN ALREADY OPEN/);
  assert.match(obs, /database query/i, 'the real card body is returned on a first pull');
  assert.ok(!s.recorded.some((e) => e.type === 'plan_block'));
});

// ---------------------------------------------------------------------------
// RH-2: the brain answers a queued owner question in-turn.
// ---------------------------------------------------------------------------

test('RH-2: the queued question rides the screen and the brain\'s chat_answer is delivered', async () => {
  const huntId = 'h_rh2';
  const { question } = queueChatQuestion(huntId, {
    chatId: 'chat-1', userId: 'u1', text: 'To fir aage ka kya kaam h', lang: 'hinglish',
  });
  const s = stubSession(huntId, [
    `Aage main password reset flow probe karunga.\n{"action":"note","text":"will probe reset flow","chat_answers":[{"q":"${question.id}","answer":"Aage main password reset flow ko probe karunga — login page band hai, to reset ka raasta try karunga."}]}`,
  ]);
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  assert.match(s.screens[0], /YOUR OWNER'S QUESTIONS/);
  assert.match(s.screens[0], /To fir aage ka kya kaam h/);
  assert.match(s.screens[0], /chat_answers/);
  assert.equal(s.delivered.length, 1);
  assert.equal(s.delivered[0].q, question.id);
  assert.match(s.delivered[0].answer, /password reset flow/);
});

test('RH-2b: the default delivery records the event, appends the thread message, and closes the question', async () => {
  const huntId = 'h_rh2b';
  const { question } = queueChatQuestion(huntId, {
    chatId: 'chat-9', userId: 'u9', text: 'What are you doing now', lang: 'english',
  });
  const ok = await defaultDeliverChatAnswer(huntId, {
    q: question.id,
    answer: 'Right now I am probing the password reset flow.',
    question,
  });
  assert.equal(ok, true);
  const events = readHuntEvents(huntId);
  const ev = events.find((e) => e.type === 'chat_answer');
  assert.ok(ev, 'a chat_answer event must be recorded');
  assert.equal(ev.questionId, question.id);
  assert.match(ev.answer, /password reset flow/);
  const msgFile = path.join(tmpRoot, 'chat-messages', 'u9', 'chat-9.json');
  const thread = JSON.parse(fs.readFileSync(msgFile, 'utf8'));
  assert.equal(thread.messages.length, 1);
  assert.equal(thread.messages[0].role, 'assistant');
  assert.match(thread.messages[0].text, /password reset flow/);
  assert.equal(pendingChatQuestions(huntId).length, 0, 'the question leaves the pending list');
});

// ---------------------------------------------------------------------------
// RH-3: in-app clicking (AT-SPI).
// ---------------------------------------------------------------------------

test('RH-3: desktop_click_control clicks the named control and names it in the observation', async () => {
  const s = stubSession('h_rh3', ['I will open the Repeater tab.\n{"action":"desktop_click_control","control":"Repeater","window":"Burp Suite"}']);
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  const obs = res.log[0].observation;
  assert.match(obs, /Clicked "Repeater" \(page tab\) in Burp Suite/);
  assert.ok(s.recorded.some((e) => e.type === 'tool_call' && e.tool === 'desktop_click_control'), 'the click must be recorded as executed');
  assert.ok(s.execCalls.some((c) => c.includes("python3 - 'click' 'Repeater'")), 'the AT-SPI helper must have run');
});

test('RH-3b: when AT-SPI is missing from the image the click degrades honestly to keyboard', async () => {
  const execImpl = async (h, cmd) => {
    if (String(cmd || '').includes('xdotool search')) return { stdout: WINDOWS_OUT, stderr: '', code: 0 };
    if (String(cmd || '').includes('python3 -')) return { stdout: ATSPI_MISSING, stderr: '', code: 0 };
    return { stdout: '', stderr: '' };
  };
  const s = stubSession('h_rh3b', ['I will open the Repeater tab.\n{"action":"desktop_click_control","control":"Repeater","window":"Burp Suite"}'], { execImpl });
  const res = await s.run();
  const obs = res.log[0].observation;
  assert.match(obs, /pyatspi is not installed/);
  assert.match(obs, /desktop_key/);
  assert.doesNotMatch(obs, /Clicked "/, 'no click is ever claimed when the stack is missing');
});

// ---------------------------------------------------------------------------
// RH-4: the desktop nudge.
// ---------------------------------------------------------------------------

test('RH-4: an exhausted browser surface + an untried desktop puts DESKTOP ROUTE OPEN on screen', async () => {
  const events = [
    { type: 'tool_call', tool: 'browser_open', detail: LOGIN_URL },
    { type: 'auth_block', tool: 'browser_type', detail: XSS },
    { type: 'auth_block', tool: 'browser_type', detail: XSS_ENCODED },
    { type: 'dedup_block', tool: 'browser_type', detail: XSS },
  ];
  const s = stubSession('h_rh4', ['I will think.\n{"action":"note","text":"thinking"}'], { events });
  await s.run();
  assert.match(s.screens[0], /DESKTOP ROUTE OPEN/);
  assert.match(s.screens[0], /desktop_snapshot/);
  assert.match(s.screens[0], /Burp or ZAP/);
});

// ---------------------------------------------------------------------------
// RH-5: the near-duplicate search gate.
// ---------------------------------------------------------------------------

test('RH-5a: searchRepeatHit blocks only at the family threshold — one re-ask is tolerated, the third is not', () => {
  const once = new Map([
    ['search|sql injection login bypass', { tool: 'search', detail: 'sql injection login bypass', count: 1, fullCount: 1, lastResult: 'ten links, none about the login form' }],
  ]);
  assert.equal(searchRepeatHit('SQL injection login bypass techniques', once), null,
    'a question asked once may be re-asked once — the Lane F tolerance');
  const twice = new Map([
    ['search|sql injection login bypass', { tool: 'search', detail: 'sql injection login bypass', count: 2, fullCount: 2, lastResult: 'ten links, none about the login form' }],
  ]);
  const hit = searchRepeatHit('SQL injection login bypass techniques', twice);
  assert.ok(hit);
  assert.equal(hit.earlier, 'sql injection login bypass');
  assert.equal(hit.familyCount, 2);
  assert.match(hit.lastResult, /ten links/);
  // Variant accumulation: two different wordings, one run each,
  // are the same question asked twice — the third wording blocks.
  const variants = new Map([
    ['search|sql injection login bypass', { tool: 'search', detail: 'sql injection login bypass', count: 1, fullCount: 1 }],
    ['search|sql injection login', { tool: 'search', detail: 'sql injection login', count: 1, fullCount: 1 }],
  ]);
  const vHit = searchRepeatHit('sql injection login bypass techniques', variants);
  assert.ok(vHit, 'two reworded runs accumulate to the family threshold');
  assert.equal(vHit.familyCount, 2);
  assert.equal(searchRepeatHit('xss payload list for the login form', twice), null);
  assert.equal(searchRepeatHit('sql', twice), null, 'one word is never enough');
});

test('RH-5b: a reworded repeat search is blocked at the family threshold; a single prior run still executes', async () => {
  // One prior run: the reworded search is tolerated (Lane F cadence).
  const once = [{ type: 'tool_call', tool: 'search', detail: 'sql injection login bypass' }];
  const sOnce = stubSession('h_rh5_once', ['I will search again.\n{"action":"search","query":"SQL injection login bypass techniques"}'], { events: once });
  await sOnce.run();
  assert.equal(sOnce.searchCalls.length, 1, 'one prior run — the re-ask still executes');

  // Two prior runs of the same wording: the third wording is blocked.
  const twice = [
    { type: 'tool_call', tool: 'search', detail: 'sql injection login bypass' },
    { type: 'tool_call', tool: 'search', detail: 'sql injection login bypass' },
  ];
  const s = stubSession('h_rh5', ['I will search again.\n{"action":"search","query":"SQL injection login bypass techniques"}'], { events: twice });
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  assert.equal(s.searchCalls.length, 0, 'the reworded search must never execute');
  const obs = res.log[0].observation;
  assert.match(obs, /BLOCKED — ALREADY SEARCHED/);
  assert.match(obs, /sql injection login bypass/);
  assert.match(obs, /2 times in this hunt/);
  assert.ok(s.recorded.some((e) => e.type === 'dedup_block' && e.tool === 'search'), 'a dedup_block event must be recorded');

  // Two prior runs in DIFFERENT wordings: the third wording is blocked too.
  const variants = [
    { type: 'tool_call', tool: 'search', detail: 'sql injection login bypass' },
    { type: 'tool_call', tool: 'search', detail: 'sql injection login' },
  ];
  const sV = stubSession('h_rh5v', ['I will search again.\n{"action":"search","query":"sql injection login bypass techniques"}'], { events: variants });
  await sV.run();
  assert.equal(sV.searchCalls.length, 0, 'variant accumulation must block the third wording');

  const s2 = stubSession('h_rh5b', ['I will search something new.\n{"action":"search","query":"xss payload list for the login form"}'], { events: twice });
  await s2.run();
  assert.equal(s2.searchCalls.length, 1, 'a genuinely new question still runs');
});
