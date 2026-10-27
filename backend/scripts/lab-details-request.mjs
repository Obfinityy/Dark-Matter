// Lab for the dynamic details request lane (27 Oct 2026, owner order).
//
// The agent asks the OWNER for details (a login) instead of creating its
// own account. Scripted humanIteration sessions with fakes:
//   session A: brain issues request_details for a kSuite login.
//   session B: brain re-asks while the request is open -> refused, wait.
//   (owner submits the login via submitDetailRequest, as the route does)
//   session C: brain sees DETAILS RECEIVED on its screen, types the login
//     with browser_type, then moves on without re-asking.
//
// Asserts the security invariant over EVERY recorded surface: no event,
// no reasoning note, and no session-log entry contains the email or the
// password — while the values DID reach the brain's next screen (in-memory
// only) and the server-side typing used the real values.
//
// Run: node backend/scripts/lab-details-request.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-details-request-'));
process.env.DATA_DIR = tmp;

const { humanIteration } = await import('../src/humanLoop.js');
const {
  createDetailRequest,
  submitDetailRequest,
  getPendingRequests,
  listDetailRequests,
  getDetailRequest,
} = await import('../src/userDetails.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const HUNT = 'h_details_lab';
const TARGET = 'https://ksuite.infomaniak.com';
const PS = { domain: 'ksuite.infomaniak.com', inScope: ['ksuite.infomaniak.com'], outOfScope: [], rules: { noDoS: true, noHeavyScan: true, maxRequestsPerMin: 0 } };
const EMAIL = 'owner@example.com';
const PASSWORD = 's3cret-kSuite-pass';

const events = [];
const notes = [];
const screens = [];
const guiCalls = [];
const metaStore = { huntId: HUNT, target: TARGET, mode: 'human', humanMode: true, parsedScope: PS };

function baseDeps(chat) {
  return {
    chat,
    record: (h, ev) => { events.push(ev); },
    readMeta: () => metaStore,
    writeMeta: (h, m) => { Object.assign(metaStore, m); },
    readEvents: () => events,
    recordNote: (h, entry) => { notes.push(entry); },
    execRaw: async () => ({ stdout: '', stderr: '' }),
    buildBriefing: async () => '',
    buildStateOfMind: () => [],
    gui: {
      open: async () => ({ observation: 'opened' }),
      snapshot: async () => ({ observation: 'page text' }),
      click: async (h, text) => { guiCalls.push(['click', text]); return { observation: 'clicked' }; },
      type: async (h, text, submit) => { guiCalls.push(['type', text, submit]); return { observation: 'typed' }; },
      screenshot: async () => ({ observation: 'shot' }),
    },
    sleep: async () => {},
    assess: null,
  };
}

const REQUEST_ACTION = `{"action":"request_details","title":"Login for kSuite","site":"https://ksuite.infomaniak.com","fields":[{"key":"email","label":"Login email","type":"email"},{"key":"password","label":"Password","type":"password"}]}`;

// ---- session A: the brain asks the owner ------------------------------------
const resA = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async (messages) => {
    screens.push(messages[0].text);
    return `I am stuck at the login wall — asking the owner for their account.\n${REQUEST_ACTION}`;
  }),
});
check('A: one turn ran', resA.turnsRun === 1);
const pendingA = getPendingRequests(HUNT);
check('A: exactly one pending request exists', pendingA.length === 1);
check('A: request title + fields are the brain\'s', pendingA[0].title === 'Login for kSuite' && pendingA[0].fields.length === 2);
check('A: tool_call records the request id only', events.some((e) => e.type === 'tool_call' && e.tool === 'request_details' && /^udet:/.test(e.detail || '')));
const requestId = pendingA[0].id;

// ---- session B: the brain re-asks while open -> refused, told to wait ------
let screenB = '';
const resB = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async (messages) => {
    screenB = messages[0].text;
    screens.push(screenB);
    return `Still need the login.\n${REQUEST_ACTION}`;
  }),
});
check('B: one turn ran', resB.turnsRun === 1);
check('B: screen says WAIT FOR THE OWNER', screenB.includes('WAITING FOR THE OWNER'));
check('B: still exactly one request (no duplicate)', listDetailRequests(HUNT).length === 1);
const lastLogB = (resB.log || []).find((l) => l.action === 'request_details');
check('B: re-ask observation says already open', !!lastLogB && /already open/.test(lastLogB.observation || ''));

// ---- the owner fills the card (as the submit route does) --------------------
const submitted = submitDetailRequest(requestId, { email: EMAIL, password: PASSWORD });
check('owner: submit succeeds', submitted.ok === true && submitted.request.status === 'filled');
check('owner: public form still carries no values', !('values' in submitted.request));

// ---- session C: the brain receives the values and types them ---------------
let screenC1 = '';
let screenC2 = '';
let callsC = 0;
const resC = await humanIteration(HUNT, TARGET, {
  turns: 2,
  deps: baseDeps(async (messages) => {
    callsC++;
    const screen = messages[0].text;
    screens.push(screen);
    if (callsC === 1) {
      screenC1 = screen;
      return `Got the owner's login — typing it now.\n{"action":"browser_type","text":"${EMAIL}","submit":false}`;
    }
    screenC2 = screen;
    return `Login typed, moving on to the dashboard.\n{"action":"note","text":"owner login used, dashboard next"}`;
  }),
});
check('C: two turns ran', resC.turnsRun === 2);
check('C: first screen carries DETAILS RECEIVED with the values', screenC1.includes('DETAILS RECEIVED') && screenC1.includes(EMAIL) && screenC1.includes(PASSWORD));
check('C: second screen does NOT re-show the values', !screenC2.includes(PASSWORD) && !screenC2.includes('DETAILS RECEIVED'));
check('C: request is marked used', getDetailRequest(requestId).status === 'used');
check('C: no second request was created', listDetailRequests(HUNT).length === 1);
check('C: server typed the real email into the form', guiCalls.some(([k, v]) => k === 'type' && v === EMAIL));

// ---- the security invariant over every recorded surface ---------------------
const recorded = JSON.stringify(events) + '\n' + JSON.stringify(notes) + '\n' + JSON.stringify(resA.log) + '\n' + JSON.stringify(resB.log) + '\n' + JSON.stringify(resC.log);
check('leak: email absent from events+notes+logs', !recorded.includes(EMAIL));
check('leak: password absent from events+notes+logs', !recorded.includes(PASSWORD));
check('leak: typed secret scrubbed to [redacted] in tool_call',
  events.some((e) => e.tool === 'browser_type' && e.detail === '[redacted]'));
const vaultText = fs.readFileSync(path.join(tmp, 'user-details.json'), 'utf8');
check('vault: values live in the user-details vault only', vaultText.includes(PASSWORD) && vaultText.includes(EMAIL));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
