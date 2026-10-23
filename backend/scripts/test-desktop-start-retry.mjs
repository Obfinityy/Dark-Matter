// Test for the desktop-start retry in the GUI action path
// (Lane Z, 24 Oct 2026).
//
// Live evidence it answers: on the DVWA hunt the desktop's first
// on-demand start died transiently under host RAM pressure (Chromium
// crashpad zombies) and every later browser action silently degraded
// to the look-only headless fallback for the rest of the session —
// the hunter could see pages but not click/type, and nothing retried
// the start. A manual hunt-desktop.sh start came up instantly: only
// the retry was missing.
//
// The container is faked through guiTools' deps.exec seam (a stateful
// fake whose CDP endpoint "comes up" once the injected starter runs),
// and the desktop starter through the deps.startDesktop seam. The
// throttle is huntRunner's SHARED failure cache — the same one the
// screenshot poller stamps — reset between cases via its test hook.
//
// Run: node backend/scripts/test-desktop-start-retry.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-z-'));
process.env.DATA_DIR = tmp;

const {
  guiBrowserOpen, guiBrowserClick, guiBrowserType, guiBrowserSnapshot, resetGuiProbeCache,
} = await import('../src/guiTools.js');
const { noteDesktopStartFailure, resetDesktopStartFailures } = await import('../src/huntRunner.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const PAGE_HTML = '<html><head><title>Fallback Page</title></head><body><h1>Headless view text</h1><a href="/login">Sign in</a></body></html>';
const CDP_SNAP = {
  url: 'http://target.test/', title: 'Desktop Page',
  text: 'Real desktop page text',
  elements: [{ tag: 'a', type: '', label: 'Sign in', href: '/login', id: '', name: '', placeholder: '' }],
};

// A fake hunt container. `state.cdpUp` models whether the desktop
// Chromium's CDP endpoint answers; the injected starter flips it.
function makeFakeExec(state) {
  return async (h, cmd) => {
    if (cmd.includes('command -v chromium')) {
      return {
        stdout: `chrome=/usr/bin/chromium\ncdp=${state.cdpUp ? '{"Browser":"fake-chrome"}' : ''}\nxsock=${state.cdpUp ? 'X0' : ''}\n`,
        stderr: '', code: 0,
      };
    }
    if (cmd.includes('cdp.mjs') && cmd.includes('base64 -d')) {
      return { stdout: '4321', stderr: '', code: 0 }; // length > 1000 = driver installed
    }
    if (cmd.includes('cdp.mjs navigate')) {
      return { stdout: JSON.stringify({ ...CDP_SNAP, url: state.currentUrl || CDP_SNAP.url }), stderr: '', code: 0 };
    }
    if (cmd.includes('cdp.mjs snapshot')) {
      return { stdout: JSON.stringify(CDP_SNAP), stderr: '', code: 0 };
    }
    if (cmd.includes('cdp.mjs click')) {
      return { stdout: JSON.stringify({ ok: true, clicked: 'Sign in', snapshot: CDP_SNAP }), stderr: '', code: 0 };
    }
    if (cmd.includes('cdp.mjs type')) {
      return { stdout: JSON.stringify({ ok: true, typed: 'x', snapshot: CDP_SNAP }), stderr: '', code: 0 };
    }
    if (cmd.includes('--dump-dom')) return { stdout: PAGE_HTML, stderr: '', code: 0 };
    if (cmd.includes('state.json')) {
      if (cmd.includes('base64 -d')) {
        try { state.currentUrl = JSON.parse(Buffer.from((/'([A-Za-z0-9+/=]+)'/.exec(cmd) || [])[1] || '', 'base64').toString('utf8')).currentUrl || ''; } catch { /* ignore */ }
        return { stdout: '', stderr: '', code: 0 };
      }
      return { stdout: state.currentUrl ? JSON.stringify({ currentUrl: state.currentUrl }) : '', stderr: '', code: 0 };
    }
    return { stdout: '', stderr: '', code: 0 };
  };
}

function resetAll() {
  resetGuiProbeCache();
  resetDesktopStartFailures();
}

// ---------------------------------------------------------------------------
// (1) CDP down + restart succeeds -> the action runs on the REAL
//     desktop; no headless fallback text anywhere.
// ---------------------------------------------------------------------------
{
  resetAll();
  const state = { cdpUp: false, currentUrl: '' };
  let startCalls = 0;
  const startDesktop = async () => { startCalls++; state.cdpUp = true; return { ok: true }; };
  const deps = { exec: makeFakeExec(state), startDesktop };

  const open = await guiBrowserOpen('h_z_retry_open', 'http://target.test/', deps);
  check('retry-open: start attempted exactly once', startCalls === 1);
  check('retry-open: opened on the real desktop', open.ok === true && open.observation.includes('Opened http://target.test/ in your desktop browser.'));
  check('retry-open: no look-only fallback text', !open.observation.includes('look-only'));
  check('retry-open: desktop page text shown', open.observation.includes('Real desktop page text'));

  const click = await guiBrowserClick('h_z_retry_open', 'Sign in', deps);
  check('retry-open: later click needs no second start', startCalls === 1);
  check('retry-open: click executed on the desktop', click.ok === true && click.observation.includes('Clicked "Sign in"'));
}

// (1b) Same recovery, entered through a click first.
{
  resetAll();
  const state = { cdpUp: false, currentUrl: '' };
  let startCalls = 0;
  const startDesktop = async () => { startCalls++; state.cdpUp = true; return { ok: true }; };
  const click = await guiBrowserClick('h_z_retry_click', 'Sign in', { exec: makeFakeExec(state), startDesktop });
  check('retry-click: start attempted exactly once', startCalls === 1);
  check('retry-click: click executed on the desktop', click.ok === true && click.observation.includes('Clicked "Sign in"'));
}

// ---------------------------------------------------------------------------
// (2) CDP down + restart fails -> honest fallback that RECORDS the
//     failed attempt; a second action inside the throttle window does
//     NOT pay for another start.
// ---------------------------------------------------------------------------
{
  resetAll();
  const state = { cdpUp: false, currentUrl: '' };
  let startCalls = 0;
  const startDesktop = async () => { startCalls++; return { ok: false, error: 'desktop_start_timeout' }; };
  const deps = { exec: makeFakeExec(state), startDesktop };

  const open = await guiBrowserOpen('h_z_fail', 'http://target.test/', deps);
  check('fail-open: start attempted exactly once', startCalls === 1);
  check('fail-open: headless fallback still returned', open.ok === true && open.observation.includes('look-only'));
  check('fail-open: fallback records the failed restart', open.observation.includes('automatically retried starting the desktop browser just now and the restart failed'));
  check('fail-open: page still visible via headless view', open.observation.includes('Headless view text'));

  const click = await guiBrowserClick('h_z_fail', 'Sign in', deps);
  check('fail-click: throttled — no second start attempt', startCalls === 1);
  check('fail-click: still refused', click.ok === false);
  check('fail-click: keeps the hunter-honesty wording', click.observation.includes('cannot be started or installed from inside the hunt'));
  check('fail-click: notes the recent failed restart', click.observation.includes('already attempted moments ago and failed'));

  const type = await guiBrowserType('h_z_fail', 'hello', false, deps);
  check('fail-type: throttled — no third start attempt', startCalls === 1);
  check('fail-type: still refused with the recent-attempt note', type.ok === false && type.observation.includes('already attempted moments ago and failed'));

  const snap = await guiBrowserSnapshot('h_z_fail', deps);
  check('fail-snapshot: throttled — no further start attempt', startCalls === 1);
  check('fail-snapshot: headless view labelled look-only with the note',
    snap.ok === true && snap.observation.includes('Look-only headless view') && snap.observation.includes('already attempted moments ago and failed'));

  // (4) After the throttle window (cache cleared via the test hook,
  //     as time passing clears it in production) a later action may
  //     attempt again — and now the start succeeds.
  resetDesktopStartFailures();
  const startDesktop2 = async () => { startCalls++; state.cdpUp = true; return { ok: true }; };
  const open2 = await guiBrowserOpen('h_z_fail', 'http://target.test/', { exec: deps.exec, startDesktop: startDesktop2 });
  check('after-window: a later action attempts the start again', startCalls === 2);
  check('after-window: the action lands on the real desktop', open2.ok === true && open2.observation.includes('in your desktop browser.') && !open2.observation.includes('look-only'));
}

// ---------------------------------------------------------------------------
// (2b) The throttle is SHARED: a failure stamped by another consumer
//      (the screenshot poller's startHuntDesktop) stops guiTools from
//      attempting at all.
// ---------------------------------------------------------------------------
{
  resetAll();
  const state = { cdpUp: false, currentUrl: '' };
  noteDesktopStartFailure('h_z_shared');
  let startCalls = 0;
  const startDesktop = async () => { startCalls++; state.cdpUp = true; return { ok: true }; };
  const open = await guiBrowserOpen('h_z_shared', 'http://target.test/', { exec: makeFakeExec(state), startDesktop });
  check('shared-cache: poller-stamped failure throttles the action path', startCalls === 0);
  check('shared-cache: fallback notes the recent attempt', open.ok === true && open.observation.includes('already attempted moments ago and failed'));
}

// ---------------------------------------------------------------------------
// (3) CDP up from the start -> the healthy path is untouched: zero
//     start attempts, no recovery wording.
// ---------------------------------------------------------------------------
{
  resetAll();
  const state = { cdpUp: true, currentUrl: '' };
  let startCalls = 0;
  const startDesktop = async () => { startCalls++; return { ok: true }; };
  const deps = { exec: makeFakeExec(state), startDesktop };

  const open = await guiBrowserOpen('h_z_healthy', 'http://target.test/', deps);
  check('healthy: no start attempted on open', startCalls === 0);
  check('healthy: desktop open unchanged', open.ok === true && open.observation.includes('Opened http://target.test/ in your desktop browser.'));
  const click = await guiBrowserClick('h_z_healthy', 'Sign in', deps);
  check('healthy: no start attempted on click', startCalls === 0 && click.ok === true);
  const type = await guiBrowserType('h_z_healthy', 'hello', false, deps);
  check('healthy: type works, still no start', startCalls === 0 && type.ok === true && type.observation.includes('Typed "hello"'));
  check('healthy: no recovery wording anywhere', !open.observation.includes('look-only') && !click.observation.includes('restart') && !type.observation.includes('restart'));
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
