// In-app clicking via AT-SPI (REAL-HUMAN lane, 26 Oct 2026).
//
// The elite lane's honest limit: clicking a BUTTON inside a GUI
// app needs an accessibility tree the image did not have (no
// AT-SPI) — desktop_click could only focus a window, and keyboard
// navigation was how the brain worked inside an app. The owner
// then ordered FULL machine control, so this builds the missing
// stack: the AT-SPI accessibility tree, driven by the
// desktopAtspi.py helper inside the container.
//
// The channel, decided from live evidence on the real container
// (26 Oct 2026, read-only probe): the D-Bus session bus IS running
// (dbus-daemon --session under xfce4-session), libatspi.so.0 IS
// present, but at-spi2-registryd and pyatspi are NOT — the image
// needs at-spi2-core + python3-pyatspi (+ libatk-wrapper-java for
// Burp/ZAP, which are Java and need the Java Access Bridge to
// expose any tree at all). Those packages are NOT in the live
// image yet — the Dockerfile plan was dropped per the owner's
// 14:18 IST clarification (machine already given, no provisioning
// in this lane); adding at-spi2-core + python3-pyatspi (+
// libatk-wrapper-java) is a separate deploy-time decision. Until
// the image rebuilds, every call degrades GRACEFULLY: the helper reports the missing
// piece as its error, and the loop turns that into an observation
// telling the brain to fall back to desktop_key — never a crash,
// never a silent no-op.
//
// Grounding (same contract as desktop_click): the brain names a
// CONTROL by its visible name ("Repeater", "Send"), never pixel
// coordinates — the helper resolves the name in the tree and
// performs the click there. The script itself is piped into the
// container base64-encoded (no file install, no image change
// needed for the script — only the packages are image work).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The helper script, base64-encoded, read from the repo at call time. */
export function atspiScriptB64() {
  const src = fs.readFileSync(path.join(__dirname, 'desktopAtspi.py'), 'utf8');
  return Buffer.from(src, 'utf8').toString('base64');
}

/** Shell single-quote a value (no interpolation, no injection). */
export function shellQuote(s) {
  return `'${String(s || '').replace(/'/g, `'\\''`)}'`;
}

/**
 * The container command for one helper invocation: the script is
 * piped in base64 (no file install) and run as `python3 - <args>`.
 * Pure — the caller runs it through execRaw.
 */
export function atspiCommand(args) {
  const b64 = atspiScriptB64();
  const quoted = args.map((a) => shellQuote(String(a))).join(' ');
  return `echo ${b64} | base64 -d | python3 - ${quoted}`;
}

/** `list` the controls of a window (or the active window when empty). */
export function listControlsCommand(windowSub = '') {
  return atspiCommand(windowSub ? ['list', windowSub] : ['list']);
}

/** Click a named control, optionally scoped to a window title. */
export function clickControlCommand(control, windowSub = '') {
  const args = ['click', String(control || '')];
  if (windowSub) args.push(windowSub);
  return atspiCommand(args);
}

/**
 * Parse the helper's stdout: exactly one JSON object, {ok} either
 * way. Anything else (a traceback, empty output, a cut stream) is
 * an unavailable-AT-SPI failure with the raw text kept short for
 * the observation. Pure.
 */
export function parseAtspiOutput(stdout) {
  const raw = String(stdout || '').trim();
  if (!raw) return { ok: false, error: 'AT-SPI helper produced no output — the desktop session may be down; use desktop_key keyboard navigation instead' };
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: `AT-SPI helper output was not JSON (${raw.slice(0, 160)}) — the helper may have crashed; use desktop_key keyboard navigation instead` };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'AT-SPI helper returned an unusable result — use desktop_key keyboard navigation instead' };
  if (parsed.ok === true) return { ok: true, windows: parsed.windows || [], controls: parsed.controls || [], clicked: parsed.clicked || null };
  return { ok: false, error: String(parsed.error || 'AT-SPI helper failed without a reason — use desktop_key keyboard navigation instead').slice(0, 400) };
}

/**
 * The observation for a failed in-app click — the helper's own
 * error, which already names the missing piece and the fallback.
 * Pure.
 */
export function atspiFailureObservation(error) {
  return `Could not click inside the app: ${String(error || 'AT-SPI unavailable').slice(0, 400)}`;
}

/**
 * The observation for a successful in-app click.
 */
export function atspiSuccessObservation(clicked) {
  if (!clicked || !clicked.name) return 'Clicked inside the app.';
  return `Clicked "${clicked.name}"${clicked.role ? ` (${clicked.role})` : ''}${clicked.window ? ` in ${clicked.window}` : ''}. Take desktop_snapshot or browser_snapshot to see what changed.`;
}
