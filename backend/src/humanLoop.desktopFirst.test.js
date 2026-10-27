// Visible-desktop-first in the human loop (27 Oct 2026, owner order).
//
// The brain did its work via headless shell curls — invisible —
// while the live desktop sat on the DVWA login page for hours.
// Asserted here by driving humanIteration with a fake DVWA browser
// (mangled OCR labels, resolved by the real click resolver), a fake
// vault, and no network / no Meta:
//   - the per-turn desktop heartbeat is on every screen.
//   - a shell-only INTERACTIVE turn earns the desktop nudge next
//     turn; a shell-only probe turn and a desktop turn do not.
//   - a shell LOGIN earns the stronger nudge: the visible browser
//     is still logged out.
//   - the GUI login-first runs through the loop with the mangled
//     labels, records meta.auth.dvwa via 'gui', and the map
//     fallback is wired (a label too mangled for fuzzy is clicked
//     at its screen-map coordinates).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-desktopfirst-'));
process.env.DATA_DIR = tmpRoot;

const { humanIteration } = await import('./humanLoop.js');
const { readHuntMeta, writeHuntMetaCheckpoint } = await import('./store.js');
const { resolveClickTarget } = await import('./guiTools.js');

const TARGET = 'http://172.17.0.1:3100/';
const LOGIN_SNAP = 'Page: Login :: Damn Vulnerable Web Application — Username Password Login';
const LOGGED_IN_SNAP = 'Page: Welcome to Damn Vulnerable Web Application — Logout vulnerabilities';
const SECURITY_SNAP = 'Page: DVWA Security — Security level is currently: impossible. low medium high impossible Submit';
const SECURITY_DONE_SNAP = 'Page: DVWA Security — Security level set to low. Logout';

// A fake DVWA desktop: stateful (login -> home -> security ->
// security-low), whose CLICKABLE labels are the OCR-mangled ones
// from the live 22:50 failure, resolved by the REAL click
// resolver — so the login-first path is exercised exactly as live.
function fakeDvwaGui({ loginLabels = ['u ername', 'pa word', 'Login'] } = {}) {
  let page = 'login'; // 'login' | 'home' | 'security' | 'security-low-pending' | 'security-low'
  const calls = [];
  const observation = () => {
    if (page === 'login') return LOGIN_SNAP;
    if (page === 'home') return LOGGED_IN_SNAP;
    if (page === 'security') return SECURITY_SNAP;
    if (page === 'security-low-pending') return 'Page: DVWA Security — low selected. Submit';
    return SECURITY_DONE_SNAP;
  };
  const securityLabels = ['low', 'medium', 'high', 'impossible', 'Submit'];
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
      const labels = (page === 'security' || page === 'security-low-pending') ? securityLabels : loginLabels;
      const verdict = resolveClickTarget(text, labels);
      if (verdict.status === 'none' || !labels[verdict.index]) {
        return { ok: false, observation: `Click failed: no clickable element matches "${text}" — clickable labels on this page: ${labels.map((l) => `"${l}"`).join(', ')}` };
      }
      const hit = labels[verdict.index];
      if (hit === 'Login' && page === 'login') page = 'home';
      if (hit === 'low' && page === 'security') page = 'security-low-pending';
      if (hit === 'Submit' && page === 'security-low-pending') page = 'security-low';
      return { ok: true, observation: observation() };
    },
    type: async () => { calls.push('type'); return { ok: true, observation: observation() }; },
    screenshot: async () => ({ ok: true, observation: 'shot' }),
  };
}

function runSession(huntId, { gui, replies, execRaw } = {}) {
  let n = 0;
  const recorded = [];
  const screens = [];
  const usedGui = gui || fakeDvwaGui();
  return {
    recorded,
    screens,
    gui: usedGui,
    done: humanIteration(huntId, TARGET, {
      turns: 2,
      deps: {
        chat: async (messages) => { screens.push(messages[0].text); return replies[n++]; },
        gui: usedGui,
        execRaw: execRaw || (async () => ({ stdout: '', stderr: '' })),
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
    }),
  };
}

function seedHunt(huntId) {
  writeHuntMetaCheckpoint(huntId, {
    target: TARGET,
    recon: { knownApp: 'dvwa', endpoints: ['/login.php', '/index.php'] },
  });
}

const NOTE = '{"action":"note","text":"done"}';

test('heartbeat is on every screen; GUI login runs with mangled labels, via gui', async () => {
  const huntId = 'h_df_heartbeat';
  seedHunt(huntId);
  const s = runSession(huntId, { replies: [NOTE, NOTE] });
  await s.done;
  assert.equal(s.screens.length, 2);
  for (const screen of s.screens) {
    assert.ok(screen.includes('WHAT IS ON YOUR SCREEN RIGHT NOW'), 'heartbeat block on the screen');
  }
  assert.ok(s.screens[1].includes('Logout'), 'heartbeat shows the logged-in page');
  const meta = readHuntMeta(huntId);
  assert.equal(meta.auth.dvwa.loggedIn, true);
  assert.equal(meta.auth.dvwa.securityLevel, 'low');
  assert.equal(meta.auth.dvwa.via, 'gui');
  assert.ok(s.gui.calls.includes('click:Username'), 'login clicked Username through the fuzzy tier');
  assert.ok(s.gui.calls.includes('click:Password'), 'login clicked Password through the fuzzy tier');
});

test('shell-only interactive turn earns the desktop nudge next turn', async () => {
  const huntId = 'h_df_nudge';
  seedHunt(huntId);
  const turn1 = 'Thinking: logging in via curl.\n{"action":"shell","command":"curl -s http://172.17.0.1:3100/login.php","task":"log into DVWA with default creds"}';
  const s = runSession(huntId, { replies: [turn1, NOTE] });
  await s.done;
  assert.equal(s.screens.length, 2);
  assert.ok(s.screens[1].includes('Your last turn did interactive work'), 'nudge names the shell-only interactive turn');
  assert.ok(s.screens[1].includes('visible desktop'), 'nudge routes to the visible desktop');
});

test('shell login earns the stronger nudge: the visible browser is still logged out', async () => {
  const huntId = 'h_df_shelllogin';
  seedHunt(huntId);
  const turn1 = 'Thinking: posting the login.\n{"action":"shell","command":"curl -s -X POST http://172.17.0.1:3100/login.php -d \\"username=admin&password=password&Login=Login\\"","task":"probe the login page"}';
  const s = runSession(huntId, { replies: [turn1, NOTE] });
  await s.done;
  assert.ok(s.screens[1].includes('STILL LOGGED OUT'), 'nudge says the visible browser is still logged out');
  assert.ok(s.screens[1].includes('browser_open the login page'), 'nudge names the GUI login');
});

test('no nudge: a shell-only probe turn, and a desktop turn', async () => {
  const huntId = 'h_df_nonudge';
  seedHunt(huntId);
  const probe = 'Thinking: probing.\n{"action":"shell","command":"curl -s \'http://172.17.0.1:3100/vulnerabilities/sqli/?id=1\'","task":"probe SQLi on the login page"}';
  const s1 = runSession(huntId, { replies: [probe, NOTE] });
  await s1.done;
  assert.equal(s1.screens[1].includes('Your last turn did interactive work'), false, 'a probe turn earns no nudge');
  assert.equal(s1.screens[1].includes('STILL LOGGED OUT'), false);

  const huntId2 = 'h_df_nonudge2';
  seedHunt(huntId2);
  const open = 'Thinking: opening the module.\n{"action":"browser_open","url":"http://172.17.0.1:3100/vulnerabilities/sqli/","task":"open the SQLi module page"}';
  const s2 = runSession(huntId2, { replies: [open, NOTE] });
  await s2.done;
  assert.equal(s2.screens[1].includes('Your last turn did interactive work'), false, 'a desktop turn earns no nudge');
});

test('map fallback is wired through the loop: too-mangled label clicks at map coordinates', async () => {
  const huntId = 'h_df_mapfallback';
  seedHunt(huntId);
  // 'uname' is distance 3 from 'Username' — past the fuzzy
  // threshold — so the label click misses and the loop's injected
  // screenMap + clickAt must carry the login.
  const gui = fakeDvwaGui({ loginLabels: ['uname', 'pa word', 'Login'] });
  const clickAts = [];
  const TSV_HEADER = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const tsv = [
    TSV_HEADER,
    '5\t1\t1\t1\t1\t1\t600\t300\t80\t20\t90\tuname',
    '5\t1\t1\t1\t2\t1\t600\t340\t30\t20\t90\tpa',
    '5\t1\t1\t1\t2\t2\t640\t340\t50\t20\t90\tword',
    '5\t1\t1\t1\t3\t1\t600\t380\t60\t20\t92\tLogin',
  ].join('\n');
  const execRaw = async (h, cmd) => {
    const c = String(cmd || '');
    if (c.includes('tesseract')) return { stdout: tsv, stderr: '', code: 0 };
    if (c.includes('scrot')) return { stdout: 'captured', stderr: '', code: 0 };
    if (c.includes('getdisplaygeometry')) return { stdout: '1280 800', stderr: '', code: 0 };
    if (c.includes('xdotool mousemove')) {
      const m = /mousemove (\d+) (\d+)/.exec(c);
      if (m) clickAts.push([Number(m[1]), Number(m[2])]);
      return { stdout: 'clicked', stderr: '', code: 0 };
    }
    return { stdout: '', stderr: '' };
  };
  const s = runSession(huntId, { gui, replies: [NOTE, NOTE], execRaw });
  await s.done;
  assert.deepEqual(clickAts, [[640, 310]], 'the Username field was clicked at its map coordinates');
  const meta = readHuntMeta(huntId);
  assert.equal(meta.auth.dvwa.loggedIn, true);
  assert.equal(meta.auth.dvwa.via, 'gui');
});
