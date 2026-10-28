// OS CONTROL — unit tests (28 Oct 2026, owner order: full OS control).
//
// The parent brain drives the whole Kali machine through osControl.js
// over the SAME helpers the AI loop uses. These tests run the layer
// with a fake container exec + fake GUI — no EC2, no Meta, no browser.
// Every assertion is about the contract that matters: the machine
// action either happened (ok:true + an observation naming what
// changed) or it is reported as failed (ok:false, never a fake
// success), and nothing is executed on a guess (unknown window,
// invalid keys, unvalidated coordinates are refusals, not attempts).
import test from 'node:test';
import assert from 'node:assert/strict';

const { executeOsAction, OS_CONTROL_ACTIONS, osControlDetail } = await import('./osControl.js');

const TARGET = 'http://172.17.0.1:3100/';

// A fake desktop: Chromium + Burp Suite open, Burp focused.
const WINDOWS_OUT = [
  '111',
  '222',
  '---TITLES---',
  'Chromium — DVWA',
  'Burp Suite',
  '---ACTIVE---',
  'Burp Suite',
  '',
].join('\n');

function fakeExecRaw(routes) {
  // routes: array of [substring, { stdout, stderr, code }]
  const calls = [];
  const execRaw = async (huntId, cmd, timeout, opts) => {
    const c = Array.isArray(cmd) ? cmd.join('\n') : String(cmd);
    calls.push(c);
    for (const [sub, res] of routes) {
      if (c.includes(sub)) return { stdout: res.stdout ?? '', stderr: res.stderr ?? '', code: res.code ?? 0 };
    }
    return { stdout: '', stderr: '', code: 0 };
  };
  return { execRaw, calls };
}

const TSV = [
  'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
  '5\t1\t1\t1\t1\t1\t100\t200\t80\t20\t90\tLog',
  '5\t1\t1\t1\t1\t2\t190\t200\t40\t20\t90\tin',
  '',
].join('\n');

test('OC-1: the surface lists every OS action the API brain has', () => {
  for (const k of ['browser_snapshot', 'screenshot', 'desktop_snapshot', 'desktop_click', 'desktop_key', 'desktop_click_at', 'desktop_click_control', 'list_controls', 'desktop_screenshot', 'see_screen', 'desktop_terminal', 'launch_tool', 'download_tool', 'proxy_start', 'intercept_list', 'intercept_read', 'intercept_replay']) {
    assert.ok(OS_CONTROL_ACTIONS.has(k), `missing ${k}`);
  }
});

test('OC-2: desktop_snapshot lists the windows + focused app', async () => {
  const { execRaw } = fakeExecRaw([['xdotool search', { stdout: WINDOWS_OUT }]]);
  const res = await executeOsAction('h_oc2', 'desktop_snapshot', {}, { target: TARGET, execRaw });
  assert.equal(res.ok, true);
  assert.match(res.observation, /Burp Suite/);
  assert.match(res.observation, /Chromium/);
});

test('OC-3: desktop down is a named failure, not an empty list', async () => {
  const { execRaw } = fakeExecRaw([['xdotool search', { stdout: '', stderr: "Can't open display: :99", code: 1 }]]);
  const res = await executeOsAction('h_oc3', 'desktop_snapshot', {}, { target: TARGET, execRaw });
  assert.equal(res.ok, false);
  assert.match(res.observation, /desktop is not running/i);
});

test('OC-4: desktop_click focuses a known window; an unknown one is refused with the list', async () => {
  const { execRaw, calls } = fakeExecRaw([
    ['xdotool search', { stdout: WINDOWS_OUT }],
    ['windowactivate', { stdout: 'clicked\n' }],
  ]);
  const ok = await executeOsAction('h_oc4', 'desktop_click', { window: 'Burp' }, { target: TARGET, execRaw });
  assert.equal(ok.ok, true);
  assert.match(ok.observation, /Focused window "Burp Suite"/);
  assert.ok(calls.some((c) => c.includes('windowactivate')), 'the click command ran');

  const { execRaw: exec2, calls: calls2 } = fakeExecRaw([['xdotool search', { stdout: WINDOWS_OUT }]]);
  const bad = await executeOsAction('h_oc4', 'desktop_click', { window: 'Wireshark' }, { target: TARGET, execRaw: exec2 });
  assert.equal(bad.ok, false);
  assert.match(bad.observation, /No window matches "Wireshark"/);
  assert.match(bad.observation, /Burp Suite/);
  assert.ok(!calls2.some((c) => c.includes('windowactivate')), 'nothing was clicked on a guess');
});

test('OC-5: desktop_key validates before any exec — bad keys never reach xdotool', async () => {
  const { execRaw, calls } = fakeExecRaw([['key ', { stdout: 'key_sent\n' }]]);
  const bad = await executeOsAction('h_oc5', 'desktop_key', { keys: 'ctrl+; rm -rf /' }, { target: TARGET, execRaw });
  assert.equal(bad.ok, false);
  assert.equal(calls.length, 0, 'no exec for unvalidated keys');
  const good = await executeOsAction('h_oc5', 'desktop_key', { keys: 'ctrl+l' }, { target: TARGET, execRaw });
  assert.equal(good.ok, true);
  assert.match(good.observation, /Sent keys ctrl\+l/);
});

test('OC-6: desktop_click_at validates coordinates before any exec', async () => {
  const { execRaw, calls } = fakeExecRaw([['mousemove', { stdout: 'clicked\n' }]]);
  const bad = await executeOsAction('h_oc6', 'desktop_click_at', { x: -5, y: 99999 }, { target: TARGET, execRaw });
  assert.equal(bad.ok, false);
  assert.equal(calls.length, 0);
  const good = await executeOsAction('h_oc6', 'desktop_click_at', { x: 1240, y: 310 }, { target: TARGET, execRaw });
  assert.equal(good.ok, true);
  assert.match(good.observation, /Clicked at \(1240, 310\)/);
});

test('OC-7: see_screen returns the text map; a down desktop is a named failure', async () => {
  const { execRaw } = fakeExecRaw([
    ['scrot', { stdout: 'captured\n' }],
    ['tesseract', { stdout: TSV }],
  ]);
  const res = await executeOsAction('h_oc7', 'see_screen', {}, { target: TARGET, execRaw });
  assert.equal(res.ok, true);
  assert.match(res.observation, /Log/);
  assert.match(res.observation, /desktop_click_at/);

  const { execRaw: exec2 } = fakeExecRaw([['scrot', { stdout: '', stderr: '', code: 1 }]]);
  const down = await executeOsAction('h_oc7', 'see_screen', {}, { target: TARGET, execRaw: exec2 });
  assert.equal(down.ok, false);
  assert.match(down.observation, /desktop is not running/i);
});

test('OC-8: launch_tool refuses an unknown tool before any exec, naming the available ones', async () => {
  const { execRaw, calls } = fakeExecRaw([]);
  const res = await executeOsAction('h_oc8', 'launch_tool', { tool: 'teleport' }, { target: TARGET, execRaw });
  assert.equal(res.ok, false);
  assert.match(res.observation, /burp/);
  assert.equal(calls.length, 0);
});

test('OC-9: desktop_terminal refuses an out-of-scope URL before anything runs', async () => {
  const { execRaw, calls } = fakeExecRaw([]);
  const SCOPE = { domain: '172.17.0.1', inScope: ['172.17.0.1'], outOfScopeHosts: [], outOfScope: [] };
  const res = await executeOsAction('h_oc9', 'desktop_terminal', { command: 'curl http://evil.example/x' }, { target: TARGET, parsedScope: SCOPE, execRaw });
  assert.equal(res.ok, false);
  assert.match(res.observation, /OUT OF SCOPE/);
  assert.equal(calls.length, 0, 'nothing ran for a blocked command');
});

test('OC-10: desktop_terminal with an empty command is refused', async () => {
  const { execRaw } = fakeExecRaw([]);
  const res = await executeOsAction('h_oc10', 'desktop_terminal', { command: '   ' }, { target: TARGET, execRaw });
  assert.equal(res.ok, false);
  assert.match(res.observation, /Empty terminal command/);
});

test('OC-11: browser_snapshot / screenshot flow through the GUI binding', async () => {
  const gui = {
    snapshot: async () => ({ ok: true, observation: 'Page: Login :: Username Password Login' }),
    screenshot: async () => ({ ok: true, artifact: 'shot-1.png', observation: 'Screenshot saved as artifact shot-1.png' }),
  };
  const snap = await executeOsAction('h_oc11', 'browser_snapshot', {}, { target: TARGET, gui });
  assert.equal(snap.ok, true);
  assert.match(snap.observation, /Username/);
  const shot = await executeOsAction('h_oc11', 'screenshot', {}, { target: TARGET, gui });
  assert.equal(shot.ok, true);
  assert.equal(shot.artifact, 'shot-1.png');
});

test('OC-12: desktop_screenshot returns the artifact name for the live UI', async () => {
  const res = await executeOsAction('h_oc12', 'desktop_screenshot', {}, {
    target: TARGET,
    execRaw: fakeExecRaw([]).execRaw,
    desktopScreenshot: async () => ({ ok: true, name: 'desktop-20261028.jpg' }),
  });
  assert.equal(res.ok, true);
  assert.equal(res.artifact, 'desktop-20261028.jpg');
});

test('OC-13: intercept_replay with no capture is a named failure, nothing sent', async () => {
  const { execRaw } = fakeExecRaw([]);
  const res = await executeOsAction('h_oc13', 'intercept_replay', { index: 3 }, {
    target: TARGET,
    execRaw,
    exec: async () => { throw new Error('must not run'); },
  });
  assert.equal(res.ok, false);
  assert.match(res.observation, /proxy_start/);
});

test('OC-14: action-index details name the target, never just the tool', () => {
  assert.equal(osControlDetail('desktop_click', { window: 'Burp Suite' }), 'Burp Suite');
  assert.equal(osControlDetail('desktop_click_at', { x: 1240, y: 310 }), '1240,310');
  assert.equal(osControlDetail('launch_tool', { tool: 'burp' }), 'burp');
  assert.equal(osControlDetail('desktop_terminal', { command: 'nmap -sV x' }), 'nmap -sV x');
});
