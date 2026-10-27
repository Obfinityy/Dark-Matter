// Lab for the self-auth chain (27 Oct 2026, owner order) — the agent tries
// to make the account ITSELF first and only asks the owner after that path
// fails.
//
// Scripted humanIteration sessions with stubbed deps (DVWA target):
//   session A: brain asks request_details "fresh" with NO prior self-attempt
//     -> REFUSED ("try self first"), no request created.
//   session B: brain asks request_details "owner" with no self-attempt
//     -> ALLOWED (the owner's own existing account — ask first is correct).
//   session C: brain saves a credential for DVWA, then asks "fresh"
//     -> ALLOWED (the self path was tried first).
//   session D: full self path — save -> use_saved_credential (fill from
//     the vault) -> fetch_verification_code (temp-mail poll) -> the code
//     arrives one-turn only and NEVER appears in any recorded surface,
//     and no owner request was ever needed.
//
// Run: node backend/scripts/lab-self-auth-chain.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-self-auth-'));
process.env.DATA_DIR = tmp;

const { humanIteration } = await import('../src/humanLoop.js');
const { listDetailRequests, getPendingRequests } = await import('../src/userDetails.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const HUNT = 'h_self_auth_lab';
const TARGET = 'http://172.17.0.1:3100/';
const PS = { domain: '172.17.0.1', inScope: ['172.17.0.1'], outOfScope: [], rules: { noDoS: true, noHeavyScan: true, maxRequestsPerMin: 0 } };
const PASSWORD = 's3cret-dvwa-pass';
const CODE = '123456';

const events = [];
const notes = [];
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
    createInbox: async () => ({ provider: 'lab', address: 'obfinity-lab@mail.tm', token: 'lab-token' }),
    pollCode: async () => ({ ok: true, code: CODE, from: 'dvwa@172.17.0.1', subject: 'Verification code' }),
    gui: {
      open: async () => ({ observation: 'opened' }),
      snapshot: async () => ({ observation: 'page text' }),
      click: async () => ({ ok: true, observation: 'clicked' }),
      type: async () => ({ ok: true, observation: 'typed' }),
      screenshot: async () => ({ observation: 'shot' }),
    },
    sleep: async () => {},
    assess: null,
  };
}

const ASK_FRESH = `{"action":"request_details","title":"Login for DVWA","account":"fresh","site":"${TARGET}","fields":[{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"password"}]}`;
const ASK_OWNER = `{"action":"request_details","title":"Login for DVWA","account":"owner","site":"${TARGET}","fields":[{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"password"}]}`;

// ---- session A: fresh ask with no self-attempt -> refused ------------------
const resA = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async () => `I need a DVWA login.\n${ASK_FRESH}`),
});
check('A: one turn ran', resA.turnsRun === 1);
const logA = (resA.log || []).find((l) => l.action && l.action.startsWith('request_details'));
check('A: fresh ask refused without a self-attempt', !!logA && /Ask refused/.test(logA.observation || '') && /save_credential first/.test(logA.observation || ''));
check('A: no request created', listDetailRequests(HUNT).length === 0);
check('A: no request_details tool_call recorded', !events.some((e) => e.type === 'tool_call' && e.tool === 'request_details'));

// ---- session B: owner ask with no self-attempt -> allowed ------------------
const resB = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async () => `This is the owner's own account.\n${ASK_OWNER}`),
});
check('B: one turn ran', resB.turnsRun === 1);
check('B: owner ask allowed', getPendingRequests(HUNT).length === 1);
check('B: request_details tool_call recorded', events.some((e) => e.type === 'tool_call' && e.tool === 'request_details'));
// Clean up: cancel the owner request so session C starts fresh.
const { cancelDetailRequest } = await import('../src/userDetails.js');
cancelDetailRequest(getPendingRequests(HUNT)[0].id);

// ---- session C: save first, then a fresh ask -> allowed --------------------
const resC = await humanIteration(HUNT, TARGET, {
  turns: 2,
  deps: baseDeps(async (messages) => {
    const calls = events.filter((e) => e.type === 'tool_call' && e.tool === 'save_credential').length;
    if (calls === 0) return `Making the DVWA account myself.\n{"action":"save_credential","site":"${TARGET}","username":"obfinity-dvwa1","password":"${PASSWORD}"}`;
    return `Self path tried — now asking since I need the owner.\n${ASK_FRESH}`;
  }),
});
check('C: two turns ran', resC.turnsRun === 2);
check('C: save_credential recorded first', events.some((e) => e.type === 'tool_call' && e.tool === 'save_credential'));
check('C: fresh ask allowed after the self-attempt', getPendingRequests(HUNT).length === 1);
cancelDetailRequest(getPendingRequests(HUNT)[0].id);
const handle = (events.find((e) => e.type === 'tool_call' && e.tool === 'save_credential') || {}).detail || '';
check('C: handle names the DVWA host', /^cred:172\.17\.0\.1:[0-9a-f]{12}$/.test(handle));

// ---- session D: full self path, no owner ask needed ------------------------
let screenD = '';
const resD = await humanIteration(HUNT, TARGET, {
  turns: 3,
  deps: baseDeps(async (messages) => {
    screenD = messages[0].text;
    const used = events.filter((e) => e.type === 'tool_call' && e.tool === 'use_saved_credential').length;
    const fetched = events.filter((e) => e.type === 'tool_call' && e.tool === 'fetch_verification_code').length;
    if (used === 0) return `Filling the DVWA login from the vault.\n{"action":"use_saved_credential","handle":"${handle}","usernameField":"Username","passwordField":"Password"}`;
    if (fetched === 0) return `Checking my temp-mail inbox for the code.\n{"action":"fetch_verification_code","handle":"${handle}"}`;
    return `Code received — typing it now.\n{"action":"note","text":"DVWA self-login done, code used"}`;
  }),
});
check('D: three turns ran', resD.turnsRun === 3);
check('D: use_saved_credential ran', events.some((e) => e.type === 'tool_call' && e.tool === 'use_saved_credential'));
check('D: fetch_verification_code ran', events.some((e) => e.type === 'tool_call' && e.tool === 'fetch_verification_code'));
check('D: no owner request was ever needed', getPendingRequests(HUNT).length === 0 && listDetailRequests(HUNT).every((r) => r.status === 'cancelled'));
const recordedD = JSON.stringify(events) + '\n' + JSON.stringify(notes) + '\n' + JSON.stringify(resA.log) + '\n' + JSON.stringify(resB.log) + '\n' + JSON.stringify(resC.log) + '\n' + JSON.stringify(resD.log);
check('leak: password absent from events+notes+logs', !recordedD.includes(PASSWORD));
check('leak: verification code absent from events+notes+logs', !recordedD.includes(CODE));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
