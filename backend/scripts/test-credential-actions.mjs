// Test for Lane AI (24 Oct 2026) — brain vault actions end-to-end.
//
// A scripted humanIteration session with fakes (the loop's deps seam):
//   turn 1: save_credential with a SUPPLIED password
//   turn 2: save_credential with NO password (server generates one)
//   turn 3: browser_type the generated password (typed secret)
//   turn 4: use_saved_credential (server-side fill from the vault)
//   turn 5: fetch_verification_code (poll stub returns a code)
//   turn 6: note (so turn 5's one-turn code observation lands on a screen)
//
// The test then asserts the security invariant over EVERY recorded
// surface: no event, no reasoning note, and no session-log entry
// contains the supplied password, the generated password, or the
// verification code — while the vault file holds the passwords, the
// one-turn secrets DID reach the brain's next screen (the in-memory
// observation), and the server-side fill typed the real values.
//
// Run: node backend/scripts/test-credential-actions.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-ai-actions-'));
process.env.DATA_DIR = tmp;

const { humanIteration } = await import('../src/humanLoop.js');
const { getCredential } = await import('../src/credentials.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const HUNT = 'h_ai_test';
const TARGET = 'http://target.test';
const PS = { domain: 'target.test', inScope: ['target.test'], outOfScope: [], rules: { noDoS: true, noHeavyScan: true, maxRequestsPerMin: 0 } };

const events = [];
const notes = [];
const screens = [];
const guiCalls = [];
const metaStore = { huntId: HUNT, target: TARGET, mode: 'human', humanMode: true, parsedScope: PS };
let callCount = 0;
let pollCalls = 0;

const SUPPLIED = 'SuppliedPass123!x';
const CODE = '482917';

function handleFromEvents() {
  const ev = events.find((e) => e.type === 'tool_call' && e.tool === 'save_credential');
  return ev ? ev.detail : '';
}
function generatedPasswordFromScreen(screen) {
  const m = /One-time password for THIS turn only[^:]*: (\S+) —/.exec(screen);
  return m ? m[1] : '';
}

const chat = async (messages) => {
  callCount++;
  const screen = messages[0].text;
  screens.push(screen);
  if (callCount === 1) {
    return `I need an account here. Saving one first.\n{"action":"save_credential","site":"http://target.test","username":"obfinity-tester","password":"${SUPPLIED}"}`;
  }
  if (callCount === 2) {
    return `Now a second account, generated.\n{"action":"save_credential","site":"http://target.test","username":"obfinity-gen"}`;
  }
  if (callCount === 3) {
    const pw = generatedPasswordFromScreen(screen);
    return `Typing the generated password now.\n{"action":"browser_type","text":"${pw}","submit":false}`;
  }
  if (callCount === 4) {
    const handle = handleFromEvents();
    return `Filling the login form from the vault.\n{"action":"use_saved_credential","handle":"${handle}","usernameField":"Email","passwordField":"Password"}`;
  }
  if (callCount === 5) {
    const handle = handleFromEvents();
    return `Checking the inbox for the verification code.\n{"action":"fetch_verification_code","handle":"${handle}"}`;
  }
  return `Done with accounts.\n{"action":"note","text":"accounts handled"}`;
};

const result = await humanIteration(HUNT, TARGET, {
  turns: 6,
  deps: {
    chat,
    record: (h, ev) => { events.push(ev); },
    readMeta: () => metaStore,
    writeMeta: (h, m) => { Object.assign(metaStore, m); },
    readEvents: () => events,
    recordNote: (h, entry) => { notes.push(entry); },
    execRaw: async () => ({ stdout: 'workspace\n', stderr: '' }),
    buildBriefing: async () => '',
    buildStateOfMind: () => [],
    gui: {
      open: async () => ({ observation: 'opened' }),
      snapshot: async () => ({ observation: 'page text' }),
      click: async (h, text) => { guiCalls.push(['click', text]); return { observation: 'clicked' }; },
      type: async (h, text, submit) => { guiCalls.push(['type', text, submit]); return { observation: 'typed' }; },
      screenshot: async () => ({ observation: 'shot' }),
    },
    createInbox: async () => ({ provider: 'mail.tm', address: 'obfinity-t@stubmail.test', token: 'stub-token' }),
    pollCode: async () => { pollCalls++; return { ok: true, code: CODE, subject: 'Verify', from: 'noreply@target.test', polls: 1 }; },
    sleep: async () => {},
    assess: null,
  },
});

check('session: ran 6 turns', result.turnsRun === 6);

// ---- the vault holds the secrets (the one allowed place) --------------------
const vaultText = fs.readFileSync(path.join(tmp, 'agent-credentials.json'), 'utf8');
check('vault: supplied password persisted server-side', vaultText.includes(SUPPLIED));
const handle = handleFromEvents();
check('vault: handle recorded in tool_call event', /^cred:target\.test:[0-9a-f]{12}$/.test(handle));
const saved = handle ? getCredential(handle) : null;
check('vault: credential retrievable by handle', !!saved && saved.username === 'obfinity-tester');

// ---- no recorded surface leaks any secret ------------------------------------
const recorded = JSON.stringify(events) + '\n' + JSON.stringify(notes) + '\n' + JSON.stringify(result.log);
check('leak: supplied password absent from events+notes+log', !recorded.includes(SUPPLIED));
const generated = screens.length >= 3 ? generatedPasswordFromScreen(screens[2]) : '';
check('one-turn: generated password DID reach the next screen (in-memory only)', generated.length >= 16);
check('leak: generated password absent from events+notes+log', generated ? !recorded.includes(generated) : false);
check('leak: verification code absent from events+notes+log', !recorded.includes(CODE));
check('one-turn: code DID reach the following screen', screens.length >= 6 && screens[5].includes(CODE));
check('leak: code absent from reasoning notes specifically', !JSON.stringify(notes).includes(CODE));
check('leak: no [redacted] gap — typed secret scrubbed, not dropped silently',
  events.some((e) => e.tool === 'browser_type' && e.detail === '[redacted]'));

// ---- server-side fill used the real values without recording them ------------
const typedValues = guiCalls.filter(([k]) => k === 'type').map(([, v]) => v);
check('fill: server typed vault username + password into the form',
  typedValues.includes('obfinity-tester') && typedValues.includes(SUPPLIED));
check('fill: handle recorded, values not', events.some((e) => e.tool === 'use_saved_credential' && e.detail === handle));

// ---- verification marks the credential ---------------------------------------
check('verify: credential marked verified after code fetch', saved && getCredential(handle).verified === true);
check('poll: code poll ran once', pollCalls === 1);

// ---- timeout path (second short session) --------------------------------------
const events2 = [];
const notes2 = [];
let calls2 = 0;
const result2 = await humanIteration('h_ai_test2', TARGET, {
  turns: 2,
  deps: {
    chat: async () => {
      calls2++;
      return calls2 === 1
        ? `Saving.\n{"action":"save_credential","site":"http://target.test","username":"obfinity-t2"}`
        : `Polling.\n{"action":"fetch_verification_code","handle":"${events2.find((e) => e.tool === 'save_credential')?.detail || ''}"}`;
    },
    record: (h, ev) => { events2.push(ev); },
    readMeta: () => ({ huntId: 'h_ai_test2', target: TARGET, mode: 'human', humanMode: true, parsedScope: PS }),
    writeMeta: () => {},
    readEvents: () => events2,
    recordNote: (h, entry) => { notes2.push(entry); },
    execRaw: async () => ({ stdout: '', stderr: '' }),
    buildBriefing: async () => '',
    buildStateOfMind: () => [],
    gui: { open: async () => ({}), snapshot: async () => ({}), click: async () => ({}), type: async () => ({}), screenshot: async () => ({}) },
    createInbox: async () => ({ provider: 'mail.tm', address: 'obfinity-t2@stubmail.test', token: 'stub-token' }),
    pollCode: async () => ({ ok: false, reason: 'timeout', polls: 8 }),
    sleep: async () => {},
    assess: null,
  },
});
const timeoutLog = (result2.log || []).find((l) => l.action === 'fetch_verification_code');
check('timeout: observation names the blocker (no mail after polls)',
  !!timeoutLog && timeoutLog.observation.includes('No verification mail arrived') && timeoutLog.observation.includes('blocker'));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
