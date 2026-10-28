// Exhausted surfaces + page state + desktop control (Infinity level,
// 26 Oct 2026) — integration tests through a stubbed humanIteration.
//
// The loop-breaker, in one file: the (page, payload-class) surface
// closes after 3 blocks whatever the payload wording; every snapshot
// becomes a parsed page-state record the next turn is chosen
// against; use_saved_credential reports a refused fill instead of
// a false success; and the desktop actions (snapshot/click/key/
// screenshot) drive the XFCE desktop through xdotool with the
// control lock respected.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-exhausted-'));
process.env.DATA_DIR = tmpRoot;
const {
  humanIteration,
  classifyPayloadClass,
  isProbeDetail,
  surfaceBlockCounts,
  surfacePageOfUrl,
  exhaustedSurfaceHit,
  exhaustedSurfaceLines,
  exhaustedBlockObservation,
  credentialStateFor,
  pendingPlannedProbeLines,
  EXHAUSTED_MIN_BLOCKS,
} = await import('./humanLoop.js');
const { saveCredential } = await import('./credentials.js');

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

// ---------------------------------------------------------------------------
// Pure: payload classification + surface counting + the gate.
// ---------------------------------------------------------------------------

test('classifyPayloadClass: plain, encoded and SQLi payloads; credentials are not probes', () => {
  assert.equal(classifyPayloadClass(XSS), 'xss');
  assert.equal(classifyPayloadClass(XSS_ENCODED), 'xss', 'the live loop\'s dodge — an encoded variant is still XSS');
  assert.equal(classifyPayloadClass(`' OR 1=1--`), 'sqli');
  assert.equal(classifyPayloadClass(`1' AND 1=1--`), 'sqli', 'a boolean AND probe is SQLi, not a credential');
  assert.equal(classifyPayloadClass(`1' OR '1'='2'--`), 'sqli', 'the false-control OR probe is SQLi, not a credential');
  assert.equal(classifyPayloadClass('obfinity-hunter@example.com'), 'credential');
  assert.equal(classifyPayloadClass(''), 'credential');
});

test('isProbeDetail matches any probe class', () => {
  assert.equal(isProbeDetail(XSS), true);
  assert.equal(isProbeDetail(`curl -s ' OR 1=1--`), true);
  assert.equal(isProbeDetail('hello world'), false);
  assert.equal(isProbeDetail(''), false);
});

test('surfaceBlockCounts groups auth/dedupe blocks by (tool, page, payload class)', () => {
  const events = [
    { type: 'tool_call', tool: 'browser_open', detail: LOGIN_URL },
    { type: 'auth_block', tool: 'browser_type', detail: XSS },
    { type: 'auth_block', tool: 'browser_type', detail: XSS_ENCODED },
    { type: 'dedup_block', tool: 'browser_type', detail: XSS },
    { type: 'tool_call', tool: 'browser_open', detail: 'https://ksuite.infomaniak.com/dashboard' },
    { type: 'auth_block', tool: 'browser_type', detail: XSS },
  ];
  const counts = surfaceBlockCounts({ events, reasoningRows: [] });
  assert.equal(counts.get('browser_type|login.infomaniak.com|/login|xss').count, 3);
  assert.equal(counts.get('browser_type|ksuite.infomaniak.com|/dashboard|xss').count, 1);
  assert.equal(EXHAUSTED_MIN_BLOCKS, 3);
});

test('surfaceBlockCounts counts WRONG PAGE executions from the paired reasoning row', () => {
  const events = [
    { type: 'tool_call', tool: 'browser_open', detail: LOGIN_URL },
    { type: 'tool_call', tool: 'browser_type', detail: XSS },
  ];
  const rows = [
    { action: 'browser_type', result: `WRONG PAGE — you are on ${LOGIN_URL}, which is NOT your target.` },
  ];
  const counts = surfaceBlockCounts({ events, reasoningRows: rows });
  assert.equal(counts.get('browser_type|login.infomaniak.com|/login|xss').count, 1);
});

test('exhaustedSurfaceHit fires at 3 blocks on the live page, never on another page or kind', () => {
  const counts = new Map([
    ['browser_type|login.infomaniak.com|/login|xss', { tool: 'browser_type', pageHost: 'login.infomaniak.com', pagePath: '/login', page: 'login.infomaniak.com/login', payloadClass: 'xss', count: 3 }],
    ['browser_type|ksuite.infomaniak.com|/dashboard|xss', { tool: 'browser_type', pageHost: 'ksuite.infomaniak.com', pagePath: '/dashboard', page: 'ksuite.infomaniak.com/dashboard', payloadClass: 'xss', count: 2 }],
  ]);
  const hit = exhaustedSurfaceHit('browser_type', { text: XSS_ENCODED }, LOGIN_URL, counts);
  assert.ok(hit);
  assert.equal(hit.count, 3);
  assert.equal(hit.pageHost, 'login.infomaniak.com');
  assert.equal(hit.pagePath, '/login');
  assert.equal(hit.page, 'login.infomaniak.com/login');
  assert.equal(hit.payloadClass, 'xss');
  assert.equal(exhaustedSurfaceHit('browser_type', { text: XSS }, 'https://ksuite.infomaniak.com/dashboard', counts), null, 'a different page is a different surface');
  assert.equal(exhaustedSurfaceHit('browser_type', { text: XSS }, 'https://login.infomaniak.com/signup', counts), null, 'the same host on a different path is a different surface');
  assert.equal(exhaustedSurfaceHit('browser_click', { text: 'Sign in' }, LOGIN_URL, counts), null, 'the gate is browser_type only');
  assert.equal(exhaustedSurfaceHit('browser_type', { text: XSS }, '', counts), null, 'an unknown page gates nothing');
});

test('exhaustedSurfaceLines closes the surface and names the auth-wall routes', () => {
  const counts = new Map([
    ['browser_type|login.infomaniak.com|/login|xss', { tool: 'browser_type', pageHost: 'login.infomaniak.com', pagePath: '/login', page: 'login.infomaniak.com/login', payloadClass: 'xss', count: 4 }],
  ]);
  const lines = exhaustedSurfaceLines({ counts, target: TARGET, credential: null, events: [] });
  assert.ok(lines.some((l) => l.includes('EXHAUSTED: typing XSS payloads on login.infomaniak.com')));
  assert.ok(lines.some((l) => l.includes('blocked ×4')));
  assert.ok(lines.some((l) => l.includes('AUTH WALL')));
  assert.ok(lines.some((l) => l.includes('save_credential')));
  assert.ok(lines.some((l) => l.includes('/robots.txt') && l.includes('/sitemap.xml')));
  const withCred = exhaustedSurfaceLines({
    counts, target: TARGET,
    credential: { saved: true, handle: 'cred:ksuite.infomaniak.com:ab12', verified: false },
    events: [],
  });
  assert.ok(withCred.some((l) => l.includes('cred:ksuite.infomaniak.com:ab12') && l.includes('use_saved_credential')));
  assert.ok(!withCred.some((l) => l.includes('save_credential for')));
});

test('exhaustedBlockObservation names the open routes (auth vs non-auth)', () => {
  const auth = exhaustedBlockObservation(
    { tool: 'browser_type', pageHost: 'login.infomaniak.com', payloadClass: 'xss', count: 3 },
    { target: TARGET, credential: null, events: [] },
  );
  assert.match(auth, /BLOCKED — EXHAUSTED SURFACE/);
  assert.match(auth, /save_credential/);
  assert.match(auth, /robots\.txt/);
  const authSaved = exhaustedBlockObservation(
    { tool: 'browser_type', pageHost: 'login.infomaniak.com', payloadClass: 'xss', count: 3 },
    { target: TARGET, credential: { saved: true, handle: 'cred:ksuite.infomaniak.com:ab12', verified: false }, events: [] },
  );
  assert.match(authSaved, /saved credential \(cred:ksuite\.infomaniak\.com:ab12/);
  assert.match(authSaved, /use_saved_credential/);
  assert.doesNotMatch(authSaved, /save_credential for/);
  const other = exhaustedBlockObservation(
    { tool: 'browser_type', pageHost: 'ksuite.infomaniak.com', payloadClass: 'sqli', count: 3 },
    { target: TARGET, credential: null, events: [] },
  );
  assert.match(other, /different page, a different payload class/);
  assert.doesNotMatch(other, /save_credential/);
  // DVWA shape: the login page is an auth surface by its PATH —
  // the host 172.17.0.1 carries no login marker, so the old
  // host-only check would have missed the auth wall entirely.
  const dvwaLogin = exhaustedBlockObservation(
    { tool: 'browser_type', pageHost: '172.17.0.1', pagePath: '/login.php', page: '172.17.0.1/login.php', payloadClass: 'credential', count: 3 },
    { target: 'http://172.17.0.1:3100/', credential: null, events: [] },
  );
  assert.match(dvwaLogin, /BLOCKED — EXHAUSTED SURFACE/);
  assert.match(dvwaLogin, /172\.17\.0\.1\/login\.php/);
  assert.match(dvwaLogin, /save_credential/);
});

test('surfacePageOfUrl strips query/hash and trailing slashes; bad URLs name no page', () => {
  assert.deepEqual(surfacePageOfUrl('http://172.17.0.1:3100/vulnerabilities/sqli/?id=1#top'), { host: '172.17.0.1', path: '/vulnerabilities/sqli' });
  assert.deepEqual(surfacePageOfUrl('http://172.17.0.1:3100/vulnerabilities/sqli/'), { host: '172.17.0.1', path: '/vulnerabilities/sqli' });
  assert.deepEqual(surfacePageOfUrl('http://172.17.0.1:3100/login.php'), { host: '172.17.0.1', path: '/login.php' });
  assert.deepEqual(surfacePageOfUrl('http://172.17.0.1:3100/'), { host: '172.17.0.1', path: '/' });
  assert.deepEqual(surfacePageOfUrl('not a url'), { host: '', path: '' });
  assert.deepEqual(surfacePageOfUrl(''), { host: '', path: '' });
});

// ---------------------------------------------------------------------------
// DVWA live shape (28 Oct 2026, 01:00-02:16 IST): the login-page
// credential budget must not close the SQLi page the brain is
// already logged into — same host, different page.
// ---------------------------------------------------------------------------

const DVWA_LOGIN = 'http://172.17.0.1:3100/login.php';
const DVWA_SQLI = 'http://172.17.0.1:3100/vulnerabilities/sqli/';
const DVWA_SQLI_UNION = `1' UNION SELECT user,password FROM users#`;

function dvwaLoginBlockedEvents() {
  return [
    { type: 'tool_call', tool: 'browser_open', detail: DVWA_LOGIN },
    { type: 'tool_call', tool: 'browser_type', detail: 'admin' }, // 22:50:05 executed
    { type: 'tool_call', tool: 'browser_open', detail: DVWA_LOGIN }, // 23:22:25 reload
    { type: 'tool_call', tool: 'browser_type', detail: 'password' }, // 23:06:49 executed
    { type: 'auth_block', tool: 'browser_type', detail: 'admin' }, // 23:44:28
    { type: 'auth_block', tool: 'browser_type', detail: 'admin' }, // 23:45:13
    { type: 'auth_block', tool: 'browser_type', detail: 'admin' }, // 23:48:22
    { type: 'tool_call', tool: 'browser_open', detail: DVWA_SQLI }, // brain on the SQLi page, logged in
  ];
}

test('DVWA live shape: login-page blocks do not close the SQLi page on the same host', () => {
  const counts = surfaceBlockCounts({ events: dvwaLoginBlockedEvents(), reasoningRows: [] });
  // The login budget lives on the login page only.
  assert.equal(counts.get('browser_type|172.17.0.1|/login.php|credential').count, 3);
  assert.equal(counts.get('browser_type|172.17.0.1|/vulnerabilities/sqli|credential'), undefined);
  // Payload typing on the SQLi page is allowed — baseline, boolean
  // probe, UNION probe, false control.
  assert.equal(exhaustedSurfaceHit('browser_type', { text: '1' }, DVWA_SQLI, counts), null, 'the baseline must reach the SQLi page');
  assert.equal(exhaustedSurfaceHit('browser_type', { text: `1' AND 1=1 --` }, DVWA_SQLI, counts), null);
  assert.equal(exhaustedSurfaceHit('browser_type', { text: DVWA_SQLI_UNION }, DVWA_SQLI, counts), null);
  assert.equal(exhaustedSurfaceHit('browser_type', { text: `1' OR '1'='2' --` }, DVWA_SQLI, counts), null);
  // The same text on another page of the same host is a different surface.
  assert.equal(exhaustedSurfaceHit('browser_type', { text: 'admin' }, 'http://172.17.0.1:3100/index.php', counts), null);
  // But the login re-type on the login page is still refused — the
  // loop protection the gate exists for.
  const loginHit = exhaustedSurfaceHit('browser_type', { text: 'admin' }, DVWA_LOGIN, counts);
  assert.ok(loginHit, 'the login re-type must stay blocked');
  assert.equal(loginHit.key, 'browser_type|172.17.0.1|/login.php|credential');
  assert.equal(loginHit.count, 3);
});

test('DVWA live shape: a true repeat loop on the SQLi page itself still closes that page', () => {
  const events = [
    { type: 'tool_call', tool: 'browser_open', detail: DVWA_SQLI },
    { type: 'dedup_block', tool: 'browser_type', detail: '1' },
    { type: 'dedup_block', tool: 'browser_type', detail: '1' },
    { type: 'auth_block', tool: 'browser_type', detail: '1' },
  ];
  const counts = surfaceBlockCounts({ events, reasoningRows: [] });
  const hit = exhaustedSurfaceHit('browser_type', { text: '1' }, DVWA_SQLI, counts);
  assert.ok(hit, 'three blocks on the SQLi page close the SQLi credential surface');
  assert.equal(hit.key, 'browser_type|172.17.0.1|/vulnerabilities/sqli|credential');
  assert.equal(hit.count, 3);
  // A different payload class on the same page is still open — the
  // gate closes a (page, class), never the whole page.
  assert.equal(exhaustedSurfaceHit('browser_type', { text: DVWA_SQLI_UNION }, DVWA_SQLI, counts), null);
  // And the login page is untouched by SQLi-page blocks.
  assert.equal(exhaustedSurfaceHit('browser_type', { text: 'admin' }, DVWA_LOGIN, counts), null);
});

// ---------------------------------------------------------------------------
// Pure: credential state + pending plans.
// ---------------------------------------------------------------------------

test('credentialStateFor reads the vault and counts uses from the record', () => {
  const rec = saveCredential({ site: TARGET, username: 'obfinity-test' });
  assert.ok(rec.handle.startsWith('cred:ksuite.infomaniak.com:'));
  const fresh = credentialStateFor({ events: [], target: TARGET });
  assert.equal(fresh.saved, true);
  assert.equal(fresh.handle, rec.handle);
  assert.equal(fresh.used, 0);
  const used = credentialStateFor({
    events: [{ type: 'tool_call', tool: 'use_saved_credential', detail: rec.handle }],
    target: TARGET,
  });
  assert.equal(used.used, 1);
  assert.equal(credentialStateFor({ events: [], target: 'https://other.example' }).saved, false);
});

test('pendingPlannedProbeLines names a pulled skill with no probe and its turns-since', () => {
  const events = [
    { type: 'tool_call', tool: 'load_skill', detail: 'sqli' },
    { type: 'tool_call', tool: 'shell', detail: 'curl -s https://ksuite.infomaniak.com/robots.txt' },
  ];
  const rows = [
    { action: 'load_skill: sqli' },
    { action: 'shell: curl -s https://ksuite.infomaniak.com/robots.txt' },
  ];
  const lines = pendingPlannedProbeLines({ events, reasoningRows: rows });
  assert.ok(lines.some((l) => l.includes('PENDING PLAN')));
  assert.ok(lines.some((l) => l.includes('sqli') && l.includes('1 turn ago')));
  assert.ok(lines.some((l) => l.includes('not_applicable')));
});

test('pendingPlannedProbeLines clears when a probe follows the pull', () => {
  const events = [
    { type: 'tool_call', tool: 'load_skill', detail: 'sqli' },
    { type: 'tool_call', tool: 'shell', detail: `curl -s "https://ksuite.infomaniak.com/?q=' OR 1=1--"` },
  ];
  const rows = [{ action: 'load_skill: sqli' }, { action: 'shell: curl sqli probe' }];
  assert.deepEqual(pendingPlannedProbeLines({ events, reasoningRows: rows }), []);
});

test('pendingPlannedProbeLines ignores skills with no probe topic', () => {
  const events = [{ type: 'tool_call', tool: 'load_skill', detail: 'desktop-tools' }];
  const rows = [{ action: 'load_skill: desktop-tools' }];
  assert.deepEqual(pendingPlannedProbeLines({ events, reasoningRows: rows }), []);
});

// ---------------------------------------------------------------------------
// Integration: stubbed humanIteration.
// ---------------------------------------------------------------------------

function stubSession(replies, { events = [], controlled = false, execImpl = null } = {}) {
  const recorded = [];
  const guiCalls = [];
  const execCalls = [];
  const screens = [];
  let n = 0;
  const execRaw = execImpl || (async (h, cmd) => {
    execCalls.push(String(cmd || ''));
    if (String(cmd || '').includes('xdotool search')) return { stdout: WINDOWS_OUT, stderr: '', code: 0 };
    if (String(cmd || '').includes('windowactivate')) return { stdout: 'clicked\n', stderr: '', code: 0 };
    if (String(cmd || '').includes('xdotool key')) return { stdout: 'key_sent\n', stderr: '', code: 0 };
    if (String(cmd || '').includes('xdotool type')) return { stdout: 'typed\n', stderr: '', code: 0 };
    return { stdout: '', stderr: '' };
  });
  return {
    recorded,
    guiCalls,
    execCalls,
    screens,
    run: () => humanIteration('h_test_exhausted', TARGET, {
      turns: replies.length,
      deps: {
        chat: async (messages) => { screens.push(messages[0].text); return replies[n++]; },
        gui: {
          open: async () => { guiCalls.push('open'); return { observation: 'opened', snapshot: LOGIN_SNAP }; },
          snapshot: async () => { guiCalls.push('snapshot'); return { observation: `Page: ${LOGIN_URL}\nSign in`, snapshot: LOGIN_SNAP }; },
          click: async () => { guiCalls.push('click'); return { ok: true, observation: 'clicked', snapshot: LOGIN_SNAP }; },
          type: async () => { guiCalls.push('type'); return { ok: true, observation: 'Typed.', snapshot: LOGIN_SNAP }; },
          screenshot: async () => { guiCalls.push('screenshot'); return { observation: 'shot', snapshot: LOGIN_SNAP }; },
        },
        execRaw,
        desktopScreenshot: async () => ({ ok: true, name: 'desktop-20261026130000.jpg' }),
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => ({}),
        readEvents: () => events,
        buildBriefing: async () => '',
        machineControlled: () => controlled,
        assess: null,
      },
    }),
  };
}

test('EX-1: the parsed page state renders on screen — the true page, its type, its untried elements', async () => {
  const s = stubSession(['I will snapshot.\n{"action":"browser_snapshot"}']);
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  const screen = s.screens[0];
  assert.match(screen, /CURRENT PAGE/);
  assert.match(screen, /login\.infomaniak\.com\/login/);
  assert.match(screen, /type: login/);
  assert.match(screen, /\[ \] not yet tried/);
  assert.match(screen, /"Email"/);
  assert.match(screen, /LOOP: snapshots/);
});

test('EX-2: an encoded XSS variant on a 3x-blocked login surface is refused by the exhausted gate', async () => {
  const events = [
    { type: 'tool_call', tool: 'browser_open', detail: LOGIN_URL },
    { type: 'auth_block', tool: 'browser_type', detail: XSS },
    { type: 'auth_block', tool: 'browser_type', detail: XSS_ENCODED },
    { type: 'dedup_block', tool: 'browser_type', detail: XSS },
  ];
  const s = stubSession(
    [`I will try the encoded payload.\n{"action":"browser_type","text":"${XSS_ENCODED}"}`],
    { events },
  );
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  assert.ok(!s.guiCalls.includes('type'), 'the type must never execute — the gate refuses it');
  const obs = res.log[0].observation;
  assert.match(obs, /BLOCKED — EXHAUSTED SURFACE/);
  assert.match(obs, /login\.infomaniak\.com/);
  // A credential is already saved for this target (the vault test
  // above saved one in the shared temp vault), so the observation
  // names the saved-credential route, not a fresh save_credential.
  // (The returned log truncates observations at 300 chars, so the
  // use_saved_credential redirect past the handle is asserted in
  // the pure exhaustedBlockObservation test instead; the brain sees
  // the full observation on screen.)
  assert.match(obs, /saved credential \(cred:ksuite\.infomaniak\.com:/);
  const blocked = s.recorded.find((e) => e.type === 'exhausted_block');
  assert.ok(blocked, 'an exhausted_block event must be recorded');
  assert.equal(blocked.count, 3);
  assert.equal(blocked.tool, 'browser_type');
});

test('EX-3: use_saved_credential reports a refused fill instead of a false success', async () => {
  const rec = saveCredential({ site: TARGET, username: 'obfinity-fill-test' });
  const guiCalls = [];
  const recorded = [];
  const res = await humanIteration('h_test_fill', TARGET, {
    turns: 1,
    deps: {
      chat: async () => `I will fill the login.\n{"action":"use_saved_credential","handle":"${rec.handle}","usernameField":"Email","passwordField":"Password"}`,
      gui: {
        open: async () => ({ observation: 'opened' }),
        snapshot: async () => ({ observation: `Page: ${LOGIN_URL}\nSign in`, snapshot: LOGIN_SNAP }),
        click: async () => { guiCalls.push('click'); return { ok: false, observation: `WRONG PAGE — you are on https://example.com, which is NOT your target.` }; },
        type: async () => { guiCalls.push('type'); return { ok: true, observation: 'Typed.' }; },
        screenshot: async () => ({ observation: 'shot' }),
      },
      execRaw: async () => ({ stdout: '', stderr: '' }),
      record: (h, e) => { recorded.push(e); },
      recordNote: () => {},
      readMeta: () => ({}),
      readEvents: () => [],
      buildBriefing: async () => '',
      machineControlled: () => false,
      assess: null,
    },
  });
  assert.equal(res.turnsRun, 1);
  assert.deepEqual(guiCalls, ['click'], 'the chain stops at the refused click — no typing into the wrong page');
  const obs = res.log[0].observation;
  assert.match(obs, /WRONG PAGE/);
  assert.doesNotMatch(obs, /Filled the login fields/);
  assert.ok(!recorded.some((e) => e.type === 'tool_call' && e.tool === 'use_saved_credential'), 'a fill that never happened must not be recorded as executed');
});

test('EX-4: desktop_snapshot shows the windows; desktop_click focuses one by title', async () => {
  const s = stubSession([
    'I will look at the desktop.\n{"action":"desktop_snapshot"}',
    'I will focus Burp.\n{"action":"desktop_click","window":"Burp Suite"}',
    'I will check the desktop again.\n{"action":"desktop_snapshot"}',
  ]);
  const res = await s.run();
  assert.equal(res.turnsRun, 3);
  assert.match(res.log[0].observation, /Burp Suite - Community Edition/);
  assert.match(res.log[0].observation, /Focused window: Terminal - bash/);
  assert.match(res.log[1].observation, /Focused window "Burp Suite - Community Edition"/);
  assert.ok(s.execCalls.some((c) => c.includes('xdotool search')), 'the snapshot runs xdotool search');
  assert.ok(s.execCalls.some((c) => c.includes('windowactivate') && c.includes('click --window')), 'the click focuses the window by id');
  assert.ok(s.screens[2].includes('[clicked]'), 'the third screen carries the desktop state with the Burp window marked clicked');
  assert.ok(s.recorded.some((e) => e.type === 'tool_call' && e.tool === 'desktop_click'), 'the click is recorded');
});

test('EX-5: desktop_key refuses an unvalidated keystroke before any exec', async () => {
  const s = stubSession(['I will type a command.\n{"action":"desktop_key","keys":"rm -rf /"}']);
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  assert.match(res.log[0].observation, /not a sendable key/);
  assert.ok(!s.execCalls.some((c) => c.includes('xdotool key')), 'no keystroke reaches xdotool');
  assert.ok(!s.recorded.some((e) => e.type === 'tool_call' && e.tool === 'desktop_key'), 'a refused keystroke is not recorded as executed');
});

test('EX-6: desktop_key sends a validated keystroke to the focused window', async () => {
  const s = stubSession(['I will focus the terminal.\n{"action":"desktop_key","keys":"ctrl+l"}']);
  const res = await s.run();
  assert.match(res.log[0].observation, /Sent keys ctrl\+l/);
  assert.ok(s.execCalls.some((c) => c.includes('xdotool key --clearmodifiers ctrl+l')));
});

test('EX-7: desktop_screenshot saves the whole-desktop frame and shows the desktop state', async () => {
  const s = stubSession(['I will capture the desktop.\n{"action":"desktop_screenshot"}']);
  const res = await s.run();
  assert.match(res.log[0].observation, /Desktop screenshot saved as artifact desktop-20261026130000\.jpg/);
  assert.match(res.log[0].observation, /Burp Suite - Community Edition/);
  assert.ok(s.recorded.some((e) => e.type === 'tool_call' && e.tool === 'desktop_screenshot'));
});

test('EX-8: desktop actions pause while the owner holds Take Control', async () => {
  const s = stubSession(
    ['I will focus Burp.\n{"action":"desktop_click","window":"Burp Suite"}'],
    { controlled: true },
  );
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  assert.ok(!s.execCalls.some((c) => c.includes('windowactivate')), 'no desktop input while the owner drives');
  assert.match(res.log[0].observation, /PAUSED — THE OWNER IS CONTROLLING THE MACHINE/);
  assert.ok(s.recorded.some((e) => e.type === 'control_pause' && e.tool === 'desktop_click'));
});

test('EX-9: a repeated desktop_click on the same window is deduped', async () => {
  // Turn 1 snapshots the desktop (the click needs known window
  // titles); turns 2-4 click the same window three times.
  const s = stubSession([
    'I will look at the desktop.\n{"action":"desktop_snapshot"}',
    'I will focus Burp.\n{"action":"desktop_click","window":"Burp Suite"}',
    'I will focus Burp again.\n{"action":"desktop_click","window":"Burp Suite"}',
    'I will focus Burp a third time.\n{"action":"desktop_click","window":"Burp Suite"}',
  ]);
  const res = await s.run();
  assert.equal(res.turnsRun, 4);
  // DEDUP_THRESHOLD is 2: the first two clicks execute, the third is blocked.
  assert.equal(s.execCalls.filter((c) => c.includes('windowactivate')).length, 2);
  assert.match(res.log[3].observation, /BLOCKED — ALREADY DONE/);
});

test('EX-10: DVWA live shape end-to-end — the baseline probe on the SQLi page executes after 3 login-page blocks', async () => {
  // The live record: three auth_loop blocks on 'admin' (login page,
  // 23:44-23:48 IST), the brain already logged in and on the SQLi
  // page. The baseline '1' must EXECUTE — the login-page budget
  // does not close the SQLi page — and no exhausted_block is
  // recorded. Meta says logged in, so login-first stays out.
  const SQLI_SNAP = {
    url: DVWA_SQLI,
    title: 'SQL Injection',
    text: 'SQL Injection User ID Submit',
    elements: [
      { label: 'User ID', tag: 'input', type: 'text', id: 'id' },
      { label: 'Submit', tag: 'button', id: 'submit' },
    ],
  };
  const guiCalls = [];
  const recorded = [];
  const res = await humanIteration('h_test_dvwa_exhausted', 'http://172.17.0.1:3100/', {
    turns: 1,
    deps: {
      chat: async () => `I will send the baseline probe.\n{"action":"browser_type","text":"1"}`,
      gui: {
        open: async () => { guiCalls.push('open'); return { observation: 'opened', snapshot: SQLI_SNAP }; },
        snapshot: async () => { guiCalls.push('snapshot'); return { observation: `Page: SQL Injection — ${DVWA_SQLI}\nUser ID: [ ] Submit`, snapshot: SQLI_SNAP }; },
        click: async () => { guiCalls.push('click'); return { ok: true, observation: 'clicked', snapshot: SQLI_SNAP }; },
        type: async () => { guiCalls.push('type'); return { ok: true, observation: 'Typed.', snapshot: SQLI_SNAP }; },
        screenshot: async () => { guiCalls.push('screenshot'); return { observation: 'shot', snapshot: SQLI_SNAP }; },
      },
      execRaw: async (h, cmd) => {
        if (String(cmd || '').includes('xdotool search')) return { stdout: WINDOWS_OUT, stderr: '', code: 0 };
        return { stdout: '', stderr: '' };
      },
      desktopScreenshot: async () => ({ ok: true, name: 'desktop-20261028120000.jpg' }),
      record: (h, e) => { recorded.push(e); },
      recordNote: () => {},
      readMeta: () => ({ auth: { dvwa: { loggedIn: true } } }),
      readEvents: () => dvwaLoginBlockedEvents(),
      buildBriefing: async () => '',
      machineControlled: () => false,
      assess: null,
    },
  });
  assert.equal(res.turnsRun, 1);
  assert.ok(guiCalls.includes('type'), 'the baseline probe must execute — the login-page budget does not close the SQLi page');
  assert.ok(!recorded.some((e) => e.type === 'exhausted_block'), 'no exhausted_block may be recorded for the SQLi-page type');
  assert.match(res.log[0].observation, /Typed/);
  assert.doesNotMatch(res.log[0].observation, /BLOCKED — EXHAUSTED SURFACE/);
});
