// Desktop control (WHOLE-OS, 26 Oct 2026) — pure-function tests.
//
// The agent drives the XFCE desktop through xdotool on the same X
// :99 the Take Control x11vnc serves. The brain is text-only, so
// every desktop action is by NAME (window title, keysym), resolved
// deterministically here — pixel coordinates are never in the
// choice set. Keystrokes are whitelist-validated before any exec.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DESKTOP_WINDOWS_CMD,
  parseDesktopWindows,
  emptyDesktopState,
  mergeDesktopState,
  markWindowInteracted,
  desktopStateLines,
  resolveWindowForClick,
  desktopClickCommand,
  parseDesktopKeys,
  desktopKeyCommand,
  desktopTypeCommand,
  shellQuote,
} from './desktopControl.js';

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

test('parseDesktopWindows zips ids and titles and names the focused window', () => {
  const st = parseDesktopWindows(WINDOWS_OUT);
  assert.equal(st.windows.length, 2);
  assert.equal(st.windows[0].id, '12345678');
  assert.equal(st.windows[0].title, 'Burp Suite - Community Edition');
  assert.equal(st.windows[1].title, 'Terminal - bash');
  assert.equal(st.activeTitle, 'Terminal - bash');
});

test('parseDesktopWindows: empty output is an empty desktop, not an error', () => {
  assert.deepEqual(parseDesktopWindows(''), { windows: [], activeTitle: '' });
  assert.deepEqual(parseDesktopWindows('---TITLES---\n---ACTIVE---\n'), { windows: [], activeTitle: '' });
});

test('parseDesktopWindows drops a title-less id (a window that closed mid-read)', () => {
  const st = parseDesktopWindows(['111', '222', '---TITLES---', 'Only One', '---ACTIVE---', ''].join('\n'));
  assert.equal(st.windows.length, 1);
  assert.equal(st.windows[0].title, 'Only One');
});

test('resolveWindowForClick: exact, then starts-with, then contains, case-insensitive', () => {
  const wins = parseDesktopWindows(WINDOWS_OUT).windows;
  assert.equal(resolveWindowForClick(wins, 'Terminal - bash').id, '87654321');
  assert.equal(resolveWindowForClick(wins, 'terminal').id, '87654321');
  assert.equal(resolveWindowForClick(wins, 'Burp').id, '12345678');
  assert.equal(resolveWindowForClick(wins, 'Community Edition').id, '12345678');
  assert.equal(resolveWindowForClick(wins, 'Wireshark'), null);
  assert.equal(resolveWindowForClick(wins, ''), null);
  assert.equal(resolveWindowForClick([], 'Terminal'), null);
});

test('mergeDesktopState keeps interacted titles across snapshots', () => {
  let st = mergeDesktopState(emptyDesktopState(), parseDesktopWindows(WINDOWS_OUT));
  assert.equal(st.windows[0].interacted, false);
  st = markWindowInteracted(st, 'Burp Suite - Community Edition');
  assert.equal(st.windows[0].interacted, true);
  // A fresh snapshot (a new window id, same title) still shows it clicked.
  const again = parseDesktopWindows(WINDOWS_OUT.replace('12345678', '99999999'));
  st = mergeDesktopState(st, again);
  assert.equal(st.windows[0].interacted, true);
  assert.equal(st.windows[1].interacted, false);
});

test('desktopStateLines: no snapshot yet, then windows with marks', () => {
  const empty = desktopStateLines(emptyDesktopState());
  assert.ok(empty.some((l) => l.includes('No desktop snapshot yet')));
  let st = mergeDesktopState(emptyDesktopState(), parseDesktopWindows(WINDOWS_OUT));
  st = markWindowInteracted(st, 'Burp Suite - Community Edition');
  const lines = desktopStateLines(st);
  assert.ok(lines.some((l) => l.includes('Focused window: Terminal - bash')));
  assert.ok(lines.some((l) => l.includes('Burp Suite - Community Edition') && l.includes('[clicked]')));
  assert.ok(lines.some((l) => l.includes('Terminal - bash') && l.includes('[FOCUSED]')));
  assert.ok(lines.some((l) => l.includes('Untried windows (1)') && l.includes('Terminal - bash')));
});

test('desktopStateLines: every window clicked says so', () => {
  let st = mergeDesktopState(emptyDesktopState(), parseDesktopWindows(WINDOWS_OUT));
  st = markWindowInteracted(st, 'Burp Suite - Community Edition');
  st = markWindowInteracted(st, 'Terminal - bash');
  const lines = desktopStateLines(st);
  assert.ok(lines.some((l) => l.includes('Every window on this desktop has been clicked')));
});

test('parseDesktopKeys accepts modifiers + one key, rejects the rest', () => {
  assert.deepEqual(parseDesktopKeys('ctrl+alt+t'), { ok: true, keys: 'ctrl+alt+t' });
  assert.deepEqual(parseDesktopKeys('Return'), { ok: true, keys: 'Return' });
  assert.deepEqual(parseDesktopKeys('F5'), { ok: true, keys: 'F5' });
  assert.deepEqual(parseDesktopKeys('Ctrl+C'), { ok: true, keys: 'ctrl+c' });
  assert.deepEqual(parseDesktopKeys('Page_Down'), { ok: true, keys: 'Page_Down' });
  assert.equal(parseDesktopKeys('').ok, false);
  assert.equal(parseDesktopKeys('ctrl').ok, false, 'a lone modifier is not a keystroke');
  assert.equal(parseDesktopKeys('ctrl+alt+delete+extra+more').ok, false, 'max 4 parts');
  assert.match(parseDesktopKeys('rm -rf /').error, /not a sendable key/);
  assert.match(parseDesktopKeys('ctrl+;').error, /not a sendable key/);
  assert.match(parseDesktopKeys('$(reboot)').error, /not a sendable key/);
});

test('desktopClickCommand focuses the window and clicks it (no coordinates)', () => {
  const cmd = desktopClickCommand({ id: '12345678', title: 'Burp Suite' });
  assert.match(cmd, /DISPLAY=:99 xdotool windowactivate --sync 12345678 click --window 12345678 1/);
  assert.doesNotMatch(cmd, /mousemove/);
});

test('desktopKeyCommand / desktopTypeCommand quote safely', () => {
  assert.match(desktopKeyCommand('ctrl+l'), /xdotool key --clearmodifiers ctrl\+l/);
  const cmd = desktopTypeCommand("it's a test; rm -rf /");
  assert.match(cmd, /xdotool type --clearmodifiers -- /);
  assert.ok(cmd.includes(`'it'\\''s a test; rm -rf /'`), 'single quotes are escaped, the payload stays one argument');
});

test('shellQuote never lets a value break out of its quotes', () => {
  assert.equal(shellQuote("a'b"), `'a'\\''b'`);
  assert.equal(shellQuote('plain'), `'plain'`);
});

test('DESKTOP_WINDOWS_CMD lists ids, titles and the active window in one exec', () => {
  assert.match(DESKTOP_WINDOWS_CMD, /xdotool search --onlyvisible/);
  assert.match(DESKTOP_WINDOWS_CMD, /---TITLES---/);
  assert.match(DESKTOP_WINDOWS_CMD, /getactivewindow getwindowname/);
});
