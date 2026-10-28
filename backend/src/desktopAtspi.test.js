// In-app clicking via AT-SPI (REAL-HUMAN lane, 26 Oct 2026).
//
// The brain names a control ("Repeater", "Send") and the helper
// resolves it in the app's accessibility tree and clicks it —
// pixel coordinates are never in the choice set. When the tree is
// missing (Java apps without the Access Bridge, or AT-SPI not
// installed in this image) the helper reports the missing piece
// and the loop falls back to keyboard navigation — never a crash,
// never a silent no-op.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  atspiCommand,
  listControlsCommand,
  clickControlCommand,
  parseAtspiOutput,
  atspiFailureObservation,
  atspiSuccessObservation,
} from './desktopAtspi.js';

test('clickControlCommand: the control name and window travel as quoted args, never interpolated', () => {
  const cmd = clickControlCommand('Repeater', 'Burp Suite');
  assert.match(cmd, /python3 - 'click' 'Repeater' 'Burp Suite'/);
  assert.match(cmd, /^if \[ -s \/tmp\/dm-dbus-address \]; then export DBUS_SESSION_BUS_ADDRESS=/);
  assert.match(cmd, /echo [A-Za-z0-9+/=]+ \| base64 -d \| python3 - /);
  // A hostile control name is single-quote-escaped, never interpolated:
  // the ; stays inside the quotes, so the shell sees one argument.
  const hostile = clickControlCommand("x'; rm -rf /; echo '", 'Burp');
  assert.match(hostile, /'x'\\''; rm -rf \/; echo '\\''/);
  assert.doesNotMatch(hostile, /'click' 'x'; rm/);
});

test('atspiCommand: the session bus is exported from /tmp/dm-dbus-address before the helper runs', () => {
  // The container runs two session buses (autolaunch + the xfce
  // session); without this export the helper's /proc scan can attach
  // to the wrong bus and see no windows at all.
  const cmd = atspiCommand(['list', 'Burp Suite']);
  assert.match(cmd, /export DBUS_SESSION_BUS_ADDRESS="\$\(cat \/tmp\/dm-dbus-address\)"/);
  assert.match(cmd, /python3 - 'list' 'Burp Suite'/);
});

test('desktopAtspi.py: the showing check uses STATE_SHOWING (25), never the raw 9 (EXPANDABLE)', () => {
  // Regression guard (27 Oct 2026, EC2 lab): state.contains(9)
  // checks EXPANDABLE, not SHOWING — the walk collected zero
  // controls for every app (GTK and Java alike), so Burp's EULA
  // "Accept" button was never found and the proxy never started.
  const src = fs.readFileSync(new URL('./desktopAtspi.py', import.meta.url), 'utf8');
  assert.match(src, /state\.contains\(pyatspi\.STATE_SHOWING\)/);
  assert.doesNotMatch(src, /state\.contains\(9\)/);
});

test('listControlsCommand: no window means the active window', () => {
  assert.match(listControlsCommand(), /python3 - 'list'/);
  assert.match(listControlsCommand('Terminal'), /python3 - 'list' 'Terminal'/);
});

test('parseAtspiOutput: a successful click parses to the clicked control', () => {
  const out = parseAtspiOutput(JSON.stringify({
    ok: true,
    clicked: { name: 'Repeater', role: 'page tab', window: 'Burp Suite - Community Edition' },
  }));
  assert.equal(out.ok, true);
  assert.equal(out.clicked.name, 'Repeater');
  assert.match(atspiSuccessObservation(out.clicked), /Clicked "Repeater" \(page tab\) in Burp Suite/);
});

test('parseAtspiOutput: a list result parses to windows + controls', () => {
  const out = parseAtspiOutput(JSON.stringify({
    ok: true,
    windows: ['Terminal - bash'],
    controls: [{ name: 'Terminal', role: 'terminal', rect: [0, 0, 1280, 800] }],
  }));
  assert.equal(out.ok, true);
  assert.equal(out.windows[0], 'Terminal - bash');
  assert.equal(out.controls[0].role, 'terminal');
});

test('parseAtspiOutput: every failure shape degrades to an honest observation, never a crash', () => {
  const missing = parseAtspiOutput(JSON.stringify({
    ok: false,
    error: 'pyatspi is not installed in this image (python3-pyatspi missing) — in-app clicking needs the image rebuild; use desktop_key keyboard navigation instead',
  }));
  assert.equal(missing.ok, false);
  assert.match(atspiFailureObservation(missing.error), /pyatspi is not installed/);
  assert.match(atspiFailureObservation(missing.error), /desktop_key/);

  const empty = parseAtspiOutput('');
  assert.equal(empty.ok, false);
  assert.match(empty.error, /no output/);

  const garbage = parseAtspiOutput('Traceback (most recent call last):\n  File "<stdin>", line 1\n');
  assert.equal(garbage.ok, false);
  assert.match(garbage.error, /not JSON/);

  const bare = parseAtspiOutput(JSON.stringify({ ok: false }));
  assert.equal(bare.ok, false);
  assert.match(bare.error, /without a reason/);
});
