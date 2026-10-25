// Chromium supervisor — docker/hunt-desktop.sh tests.
//
// 25 Oct 2026: Chromium died silently (11:35:11Z) and nothing revived
// it, because the script's early exit only checked Xvfb + the ready
// file. These tests run the ACTUAL script (not a re-implementation)
// with stub binaries on PATH and a temp HOME: the stubs record every
// launch and answer liveness questions from state files, so each
// scenario drives the real guard / wedge / relaunch logic. The script
// never touches the real /tmp paths here — DM_DESKTOP_READY_FILE and
// DM_DESKTOP_LOG_FILE point it at the temp dir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const SCRIPT = new URL('../../docker/hunt-desktop.sh', import.meta.url).pathname;

const CDP_VERSION =
  '{"Browser":"Chrome/150.0.7871.181","webSocketDebuggerUrl":"ws://127.0.0.1:9222/devtools/browser/x"}';

function stubScript(name, body) {
  return `#!/bin/sh\n${body}\n`;
}

async function makeHarness(t, initialState, { withCurl = true, minimalPath = false, withXfconf = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dm-desktop-test-'));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
  const binDir = join(dir, 'bin');
  const homeDir = join(dir, 'home');
  const stateDir = join(dir, 'state');
  await mkdir(binDir, { recursive: true });
  await mkdir(homeDir, { recursive: true });
  await mkdir(stateDir, { recursive: true });
  const logPath = join(dir, 'calls.log');
  const readyPath = join(dir, 'dm-desktop.ready');
  const scriptLogPath = join(dir, 'dm-desktop.log');
  await writeFile(logPath, '');

  const writeStub = async (name, body) => {
    const p = join(binDir, name);
    await writeFile(p, stubScript(name, body));
    await chmod(p, 0o755);
  };

  // pgrep answers liveness from state files (0/1) and records its args.
  await writeStub(
    'pgrep',
    `echo "pgrep $*" >> "$STUB_LOG"
if [ "$1" = "-x" ]; then
  case "$2" in
    Xvfb) [ "$(cat "$STUB_STATE_DIR/xvfb")" = "1" ] && exit 0 || exit 1;;
    xfce4-session) [ "$(cat "$STUB_STATE_DIR/xfce")" = "1" ] && exit 0 || exit 1;;
    x11vnc) [ "$(cat "$STUB_STATE_DIR/x11vnc")" = "1" ] && exit 0 || exit 1;;
    *) exit 1;;
  esac
fi
if [ "$1" = "-f" ]; then
  case "$2" in
    *922*) [ "$(cat "$STUB_STATE_DIR/chromium")" = "1" ] && exit 0 || exit 1;;
    *websockify*) [ "$(cat "$STUB_STATE_DIR/websockify")" = "1" ] && exit 0 || exit 1;;
    *) exit 1;;
  esac
fi
exit 1`,
  );
  // pkill records its args and flips the chromium state to dead.
  await writeStub(
    'pkill',
    `echo "pkill $*" >> "$STUB_LOG"
case "$*" in
  *922*) echo 0 > "$STUB_STATE_DIR/chromium";;
esac
exit 0`,
  );
  // curl answers the CDP probe from state (exit 7 = connection refused).
  if (withCurl) {
    await writeStub(
      'curl',
      `echo "curl $*" >> "$STUB_LOG"
if [ "$(cat "$STUB_STATE_DIR/cdp")" = "1" ]; then
  printf '%s' '${CDP_VERSION}'
  exit 0
fi
exit 7`,
    );
  }
  // xfconf-query stub (25 Oct 2026, Kali theme lane): answers the readiness
  // probe (-l) and the ThemeName / panel-plugin reads from state files, so
  // the theme apply in the real script can be driven end to end. Every
  // call is recorded. xfconf-dead=1 makes every call fail (unreachable
  // xfconfd). xfce4-panel is a recording stub (the script restarts it
  // after a menu-button swap).
  if (withXfconf) {
    await writeStub(
      'xfconf-query',
      `echo "xfconf-query $*" >> "$STUB_LOG"
if [ "$(cat "$STUB_STATE_DIR/xfconf-dead" 2>/dev/null)" = "1" ]; then exit 1; fi
case "$*" in
  *"-l"*) exit 0;;
esac
case "$*" in
  *"/Net/ThemeName"*)
    case "$*" in
      *" -s "*) echo "$*" | sed 's/.* -s //' > "$STUB_STATE_DIR/xfconf-theme"; exit 0;;
      *) cat "$STUB_STATE_DIR/xfconf-theme"; exit 0;;
    esac;;
esac
case "$*" in
  *"/plugins/plugin-"*)
    case "$*" in
      *" -s "*) exit 0;;
      *)
        n=$(echo "$*" | sed -E 's/.*plugin-([0-9]+).*/\\1/')
        cat "$STUB_STATE_DIR/xfconf-panel$n" 2>/dev/null || exit 1
        exit 0;;
    esac;;
esac
exit 0`,
    );
    await writeStub('xfce4-panel', `echo "xfce4-panel $*" >> "$STUB_LOG"\nexit 0`);
  }
  // Recording stubs for everything the script launches or probes.
  for (const name of ['chromium', 'Xvfb', 'startxfce4', 'xfce4-terminal', 'x11vnc', 'websockify', 'xdotool', 'scrot']) {
    await writeStub(name, `echo "${name} $*" >> "$STUB_LOG"\nexit 0`);
  }

  for (const [key, value] of Object.entries({
    xvfb: 0,
    xfce: 0,
    x11vnc: 0,
    websockify: 0,
    chromium: 0,
    cdp: 0,
    'xfconf-theme': 'Adwaita',
    'xfconf-panel1': 'applicationsmenu',
    'xfconf-dead': 0,
    ...initialState,
  })) {
    await writeFile(join(stateDir, key), String(value));
  }

  const run = async (extraEnv = {}) => {
    // minimalPath: PATH holds only the stubs + symlinks to the real
    // binaries the script needs — no system dirs, so `command -v curl`
    // genuinely fails (SS-6 exercises the no-curl fallback).
    let pathValue = `${binDir}:${process.env.PATH}`;
    if (minimalPath) {
      const minBin = join(dir, 'minbin');
      await mkdir(minBin, { recursive: true });
      for (const name of ['bash', 'sleep', 'seq', 'cat', 'mkdir', 'touch', 'tr', 'grep', 'nohup']) {
        const real = ['/usr/bin', '/bin'].map((d) => join(d, name)).find((p) => existsSync(p));
        if (!real) throw new Error(`cannot locate real binary for minimal PATH: ${name}`);
        try {
          await symlink(real, join(minBin, name));
        } catch {
          /* already linked */
        }
      }
      pathValue = `${binDir}:${minBin}`;
    }
    try {
      const { stdout, stderr } = await execFileAsync('bash', [SCRIPT], {
        timeout: 15000,
        env: {
          PATH: pathValue,
          HOME: homeDir,
          STUB_LOG: logPath,
          STUB_STATE_DIR: stateDir,
          DM_DESKTOP_READY_FILE: readyPath,
          DM_DESKTOP_LOG_FILE: scriptLogPath,
          DM_DESKTOP_URL: 'about:blank',
          ...extraEnv,
        },
      });
      return { code: 0, stdout, stderr };
    } catch (err) {
      return { code: err.code, stdout: err.stdout || '', stderr: err.stderr || '' };
    }
  };
  const calls = async () => readFile(logPath, 'utf8');
  const scriptLog = async () =>
    readFile(scriptLogPath, 'utf8').catch(() => '');
  const hasCall = async (prefix) =>
    (await calls()).split('\n').some((line) => line.startsWith(prefix));
  return { dir, readyPath, run, calls, scriptLog, hasCall };
}

const ALL_UP = { xvfb: 1, xfce: 1, x11vnc: 1, websockify: 1, chromium: 1, cdp: 1 };

test('SS-1: script is a no-op when the desktop is up and CDP answers', async (t) => {
  const h = await makeHarness(t, ALL_UP);
  await writeFile(h.readyPath, '');
  const res = await h.run();
  assert.equal(res.code, 0);
  assert.match(res.stdout, /desktop already running/);
  assert.equal(await h.hasCall('chromium '), false, 'chromium must not relaunch');
  assert.equal(await h.hasCall('Xvfb '), false, 'Xvfb must not restart');
});

test('SS-2: script revives a dead Chromium (ready file + Xvfb alive, no CDP)', async (t) => {
  const h = await makeHarness(t, { ...ALL_UP, chromium: 0, cdp: 0 });
  await writeFile(h.readyPath, '');
  const res = await h.run();
  assert.equal(res.code, 0);
  assert.equal(await h.hasCall('chromium '), true, 'chromium must be relaunched');
  const log = await h.calls();
  const launch = log.split('\n').find((line) => line.startsWith('chromium '));
  assert.match(launch, /--remote-debugging-port=9222/);
  assert.match(launch, /--remote-debugging-address=127\.0\.0\.1/);
  assert.match(launch, /about:blank/);
  assert.equal(await h.hasCall('Xvfb '), false, 'Xvfb stays up, no restart');
  assert.match(await h.scriptLog(), /starting chromium/);
});

test('SS-3: script kills a wedged Chromium (process alive, CDP silent) and relaunches', async (t) => {
  const h = await makeHarness(t, { ...ALL_UP, cdp: 0 });
  await writeFile(h.readyPath, '');
  const res = await h.run();
  assert.equal(res.code, 0);
  const log = await h.calls();
  const pkillLine = log.split('\n').find((line) => line.startsWith('pkill '));
  assert.ok(pkillLine, 'the stale process must be killed first');
  assert.match(pkillLine, /922\[2\]/, 'pkill uses the bracket trick, never the literal');
  assert.equal(await h.hasCall('chromium '), true, 'chromium must be relaunched after the kill');
  assert.match(await h.scriptLog(), /wedged/);
});

test('SS-4: cold start launches the whole stack and touches the ready file', async (t) => {
  const h = await makeHarness(t, {});
  const res = await h.run();
  assert.equal(res.code, 0);
  for (const name of ['Xvfb ', 'startxfce4 ', 'chromium ', 'x11vnc ', 'websockify ']) {
    assert.equal(await h.hasCall(name), true, `${name.trim()} must start`);
  }
  assert.match(res.stdout, /desktop ready on :99/);
  await readFile(h.readyPath, 'utf8'); // throws if the ready file was not created
});

test('SS-5: every pgrep/pkill check uses the bracket trick, never the literal pattern', async (t) => {
  const h = await makeHarness(t, { ...ALL_UP, cdp: 0 });
  await writeFile(h.readyPath, '');
  await h.run();
  const log = await h.calls();
  const checks = log.split('\n').filter((line) => line.startsWith('pgrep -f') || line.startsWith('pkill -f'));
  assert.ok(checks.length > 0, 'the run must perform pattern checks');
  for (const line of checks) {
    assert.ok(!line.includes('remote-debugging-port=9222'), `literal pattern must never appear: ${line}`);
  }
  assert.ok(checks.some((line) => line.includes('922[2]')), 'the bracket form must be used');
});

test('SS-6: without curl, a live Chromium process still counts as healthy (never killed)', async (t) => {
  // No curl stub AND no system curl on PATH (minimalPath): the script
  // must fall back to the pgrep signal instead of treating a healthy
  // browser as dead.
  const h = await makeHarness(t, ALL_UP, { withCurl: false, minimalPath: true });
  await writeFile(h.readyPath, '');
  const res = await h.run();
  assert.equal(res.code, 0);
  assert.match(res.stdout, /desktop already running/);
  assert.equal(await h.hasCall('pkill '), false, 'a healthy chromium must never be killed');
  assert.equal(await h.hasCall('chromium '), false, 'a healthy chromium must not relaunch');
});

test('SS-7: the bracket trick itself — literal pattern matches the checking shell, bracket does not', async (t) => {
  // Runs the REAL pgrep (not a stub): the trap the script avoids.
  const literal = await execFileAsync('sh', [
    '-c',
    "pgrep -f 'remote-debugging-port=9222' >/dev/null 2>&1",
  ]).then(
    () => 0,
    (err) => err.code,
  );
  assert.equal(literal, 0, 'the literal pattern matches the sh running the check itself');
  const bracket = await execFileAsync('sh', [
    '-c',
    "pgrep -f 'remote-debugging-port=922[2]' >/dev/null 2>&1",
  ]).then(
    () => 0,
    (err) => err.code,
  );
  assert.equal(bracket, 1, 'the bracket pattern never self-matches');
});

// --- Real Kali look (25 Oct 2026) -----------------------------------------
// The image now ships kali-themes (Kali-Dark GTK + xfwm4, Flat-Remix-
// Blue-Dark icons, kali-cubes dragon wallpaper, whisker menu). The script
// enforces the same look on the live session via xfconf-query. These tests
// run the ACTUAL script with a stub xfconf-query and a fake theme dir /
// wallpaper file (DM_KALI_THEME_DIR / DM_KALI_WALLPAPER), so they prove
// the apply logic without the real Kali packages.

test('KT-1: cold start with the Kali theme installed applies it (theme, icons, wallpaper, dragon menu)', async (t) => {
  const h = await makeHarness(t, {}, { withXfconf: true });
  const themeDir = join(h.dir, 'Kali-Dark');
  const wallpaper = join(h.dir, 'kali-wallpaper.jpg');
  await mkdir(themeDir);
  await writeFile(wallpaper, 'fake wallpaper');
  const res = await h.run({ DM_KALI_THEME_DIR: themeDir, DM_KALI_WALLPAPER: wallpaper });
  assert.equal(res.code, 0);
  const log = await h.calls();
  for (const want of [
    'xfconf-query -c xsettings -p /Net/ThemeName -n -t string -s Kali-Dark',
    'xfconf-query -c xsettings -p /Net/IconThemeName -n -t string -s Flat-Remix-Blue-Dark',
    'xfconf-query -c xsettings -p /Gtk/FontName -n -t string -s Cantarell 11',
    'xfconf-query -c xfwm4 -p /general/theme -n -t string -s Kali-Dark',
    `xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/workspace0/image-path -n -t string -s ${wallpaper}`,
    'xfconf-query -c xfce4-panel -p /plugins/plugin-1 -t string -s whiskermenu',
    'xfconf-query -c xfce4-panel -p /plugins/plugin-1/button-icon -n -t string -s kali-panel-menu',
    'xfce4-panel -r',
  ]) {
    assert.ok(log.includes(want), `missing call: ${want}`);
  }
  assert.match(await h.scriptLog(), /kali theme applied/);
  await readFile(h.readyPath, 'utf8'); // throws if the ready file was not created
});

test('KT-2: without the Kali theme installed, no xfconf call is made and the desktop still starts', async (t) => {
  const h = await makeHarness(t, {}, { withXfconf: true });
  // Point the theme dir at a path that does not exist, so the test is
  // hermetic even on a machine that happens to have the Kali theme.
  const res = await h.run({ DM_KALI_THEME_DIR: join(h.dir, 'no-such-theme') });
  assert.equal(res.code, 0);
  assert.equal(await h.hasCall('xfconf-query '), false, 'no theme, no xfconf calls');
  await readFile(h.readyPath, 'utf8');
});

test('KT-3: theme already Kali-Dark — the apply is a no-op (idempotent supervisor re-runs)', async (t) => {
  const h = await makeHarness(t, { 'xfconf-theme': 'Kali-Dark' }, { withXfconf: true });
  const themeDir = join(h.dir, 'Kali-Dark');
  const wallpaper = join(h.dir, 'kali-wallpaper.jpg');
  await mkdir(themeDir);
  await writeFile(wallpaper, 'fake wallpaper');
  const res = await h.run({ DM_KALI_THEME_DIR: themeDir, DM_KALI_WALLPAPER: wallpaper });
  assert.equal(res.code, 0);
  const log = await h.calls();
  assert.equal(log.includes(' -s Kali-Dark'), false, 'no set calls when already Kali-Dark');
  assert.equal(log.includes('whiskermenu'), false, 'no panel swap when already Kali-Dark');
  assert.equal(await h.hasCall('xfce4-panel '), false, 'no panel restart when already Kali-Dark');
});

test('KT-4: xfconf unreachable — the desktop still starts and the theme is skipped, never fatal', async (t) => {
  const h = await makeHarness(t, { 'xfconf-dead': 1 }, { withXfconf: true });
  const themeDir = join(h.dir, 'Kali-Dark');
  await mkdir(themeDir);
  const res = await h.run({ DM_KALI_THEME_DIR: themeDir });
  assert.equal(res.code, 0);
  assert.match(await h.scriptLog(), /xfconf not reachable/);
  await readFile(h.readyPath, 'utf8');
});
