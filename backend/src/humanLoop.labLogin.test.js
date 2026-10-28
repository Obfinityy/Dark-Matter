// Login-first in the human loop (zero-genuine lane, 27 Oct 2026).
//
// Asserted here (hunt meta under a tmp DATA_DIR, fake DVWA browser
// + real vault, no network, no Meta):
//   - (c) A human-loop session on a known DVWA target logs in FIRST
//     — before the brain's first turn — with the vaulted default,
//     sets security to low, verifies the session from the served
//     page, and records meta.auth.dvwa { loggedIn: true,
//     securityLevel: 'low' }. The brain's first screen already
//     carries the DVWA SOM lines (logged in, security low).
//   - The gate does NOT fire on a target with no known app: no
//     login opens, no auth state written.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-lablogin-'));
process.env.DATA_DIR = tmpRoot;

const { humanIteration } = await import('./humanLoop.js');
const { readHuntMeta, writeHuntMetaCheckpoint } = await import('./store.js');
const { getCredential } = await import('./credentials.js');

const TARGET = 'http://172.17.0.1:3100/';

// A fake DVWA desktop: stateful enough to prove the login-first
// sequence (login page -> Logout page -> security page ->
// "Security level set to low").
function fakeDvwaGui() {
  let page = 'login'; // 'login' | 'home' | 'security' | 'security-low-pending' | 'security-low'
  const calls = [];
  const observation = () => {
    if (page === 'login') return 'Page: Login :: Damn Vulnerable Web Application — Username Password Login';
    if (page === 'home') return 'Page: Welcome to Damn Vulnerable Web Application — Logout vulnerabilities';
    if (page === 'security') return 'Page: DVWA Security — Security level is currently: impossible. low medium high impossible Submit';
    if (page === 'security-low-pending') return 'Page: DVWA Security — low selected. Submit';
    return 'Page: DVWA Security — Security level set to low. Logout';
  };
  return {
    calls,
    open: async (h, url) => {
      calls.push(`open:${url}`);
      if (String(url).includes('/security.php')) page = 'security';
      else if (String(url).includes('/login.php')) page = 'login';
      return { ok: true, observation: observation() };
    },
    snapshot: async () => ({ ok: true, observation: observation() }),
    click: async (h, text) => {
      calls.push(`click:${text}`);
      if (text === 'Login' && page === 'login') page = 'home';
      if (text === 'low' && page === 'security') page = 'security-low-pending';
      if (text === 'Submit' && page === 'security-low-pending') page = 'security-low';
      return { ok: true, observation: observation() };
    },
    type: async (h, target, text) => { calls.push(`type:${target}<-${text}`); return { ok: true, observation: observation() }; },
    screenshot: async () => ({ ok: true, observation: 'shot' }),
  };
}

function runSession(huntId, { gui, recorded, screens }) {
  let n = 0;
  const replies = ['{"action":"note","text":"done"}'];
  return humanIteration(huntId, TARGET, {
    turns: 1,
    deps: {
      chat: async (messages) => { screens.push(messages[0].text); return replies[n++]; },
      gui,
      execRaw: async () => ({ stdout: '', stderr: '' }),
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      search: async () => 'no results',
      record: (h, e) => { recorded.push(e); },
      recordNote: () => {},
      readMeta: (h) => readHuntMeta(h),
      writeMeta: (h, patch) => writeHuntMetaCheckpoint(h, patch),
      readEvents: () => [],
      buildBriefing: async () => '',
      machineControlled: () => false,
      desktopScreenshot: async () => ({ ok: true, name: 'desktop-shot.jpg' }),
      startDesktop: async () => {},
      createInbox: async () => { throw new Error('no inbox in test'); },
      assess: null,
    },
  });
}

test('DVWA session logs in first, sets security low, verifies the session', async () => {
  const huntId = 'h_lablogin_dvwa';
  writeHuntMetaCheckpoint(huntId, {
    target: TARGET,
    recon: { knownApp: 'dvwa', endpoints: ['/login.php', '/index.php'] },
  });
  const gui = fakeDvwaGui();
  const recorded = [];
  const screens = [];
  await runSession(huntId, { gui, recorded, screens });

  // The login-first flow ran before the brain's first turn.
  assert.ok(gui.calls.some((c) => c === `open:${TARGET}login.php`), 'login page opened first');
  assert.ok(gui.calls.some((c) => c === `open:${TARGET}security.php`), 'security page opened');
  assert.ok(gui.calls.includes('click:Login'), 'login submitted');
  // GUI-TYPE-TARGET (28 Oct 2026): each type names its field — the
  // username goes into Username, the password into Password, never
  // both into whatever happened to be focused.
  assert.ok(gui.calls.includes('type:Username<-admin'), 'username typed into the Username field');
  assert.ok(gui.calls.includes('type:Password<-password'), 'password typed into the Password field');
  assert.ok(gui.calls.includes('click:low') && gui.calls.includes('click:Submit'), 'security set to low');

  // Auth state persisted + recorded, and the vault holds the handle.
  const meta = readHuntMeta(huntId);
  assert.equal(meta.auth.dvwa.loggedIn, true);
  assert.equal(meta.auth.dvwa.securityLevel, 'low');
  assert.ok(meta.auth.dvwa.handle, 'credential handle recorded');
  assert.equal(getCredential(meta.auth.dvwa.handle).username, 'admin');
  assert.ok(recorded.some((e) => e.type === 'status' && e.state === 'dvwa_logged_in'), 'login recorded for the monitors');

  // The brain's first screen already knows the login is done.
  assert.ok(screens[0].includes('TARGET IS DVWA'), 'SOM names the app');
  assert.ok(screens[0].includes('LOGGED IN as admin, security level low'), 'SOM carries the verified login');
  assert.ok(screens[0].includes('WRONG APP'), 'SOM carries the wrong-app boundary');
});

test('no known app — no login is attempted', async () => {
  const huntId = 'h_lablogin_plain';
  writeHuntMetaCheckpoint(huntId, { target: TARGET, recon: { endpoints: ['/'] } });
  const gui = fakeDvwaGui();
  const recorded = [];
  const screens = [];
  await runSession(huntId, { gui, recorded, screens });

  assert.equal(gui.calls.filter((c) => c.startsWith('open:')).length, 0, 'no page was opened');
  const meta = readHuntMeta(huntId);
  assert.equal(meta.auth, undefined);
  assert.equal(screens[0].includes('TARGET IS DVWA'), false);
});
