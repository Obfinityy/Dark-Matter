// Desktop control — WHOLE-OS control (Infinity level, 26 Oct 2026).
//
// The gap (owner order 13:17 IST): the agent had CDP (Chromium-only)
// + shell. It could launch a GUI tool from the shell (burpsuite &)
// but could NOT click the XFCE applications menu, could NOT click
// inside Burp/ZAP/Wireshark/the terminal, and could NOT see the
// desktop at all — its `screenshot` action captures the browser
// viewport only, and the whole-desktop frame existed solely as the
// owner's poller route (GET /:id/desktop.jpg). Thought and action
// were split: the brain could name "open Burp and click Repeater"
// and nothing could perform it.
//
// The channel (evidence, not preference): xdotool + scrot are
// ALREADY in the live hunt image (docker/Dockerfile.hunt: "xdotool —
// the agent's GUI hands (mouse/keyboard) inside its sandbox", and
// hunt-desktop.sh REQUIRES both before the desktop starts), on the
// same X server (:99) the Take Control x11vnc channel serves. So
// the agent drives the desktop through xdotool via the existing
// container-exec path — no image rebuild, no new network exposure,
// no new daemon. The alternative the brief names — a from-scratch
// RFB client in the backend speaking to the 5901 x11vnc — was NOT
// built: it would need a handshake/security/input implementation
// plus a second stdio tunnel beside the owner's, it would deliver
// pixel coordinates the text-only 8B brain cannot produce, and its
// input lands on exactly the same X server xdotool talks to. The
// control lock is enforced identically either way: the new action
// kinds join GUI_CONTROL_KINDS, so while the owner holds Take
// Control the agent's desktop actions pause like its browser ones.
//
// Grounding (the brain is TEXT-only — it never sees an image):
// every desktop action is by NAME, resolved deterministically by
// the loop. The brain names a window title (from the desktop-state
// text) and the loop resolves it to a window id; it names keys
// (Return, ctrl+c, Tab) and the loop validates them against a
// whitelist. Pixel coordinates are NEVER in the choice set — the
// brain cannot produce them, so offering them would be a planning
// action with no execution path. What the loop cannot ground it
// does not offer: clicking a BUTTON inside a GUI app needs an
// accessibility tree the image does not have (no AT-SPI), so the
// desktop click focuses a window and sends it a click; keyboard
// navigation (Tab/Return/arrows) is how the brain works inside an
// app after focusing it. The XFCE applications menu is the same
// shape: the brain launches GUI apps from the shell (proven —
// `burpsuite &`), which is what the menu does; clicking the menu
// button itself is owner territory.
//
// The desktop screenshot (scrot) reuses huntRunner's
// huntDesktopScreenshot — the owner's poller route — and saves the
// frame as a hunt artifact, exactly like the browser screenshot
// action. The brain gets the TEXT desktop state (windows, focused
// app) with the observation; the owner gets the image.
//
// State: the window list is re-read live on every desktop_snapshot
// (it is small — a dozen windows — and re-derivable, unlike a page
// snapshot whose text is truncated in the record), so there is no
// desktopState.json. What persists is the interaction history, in
// the permanent record: desktop_click/desktop_key tool_call events,
// which the loop counters (pageState.loopCounters) count from.
// The session keeps the merged state (windows + interacted titles)
// in memory only.
import fs from 'node:fs';
import path from 'node:path';

import { artifactsDir } from './artifacts.js';

export const DESKTOP_DISPLAY = ':99';
export const DESKTOP_WIDTH = 1280;
export const DESKTOP_HEIGHT = 800;
export const DESKTOP_MAX_WINDOWS = 40; // list cap — the state block stays small

// One exec, three sections: window ids (search order), window titles
// (same order), the active window's title. stderr is NOT suppressed
// — the caller reads it to tell "desktop down" from "no windows".
export const DESKTOP_WINDOWS_CMD = [
  `DISPLAY=${DESKTOP_DISPLAY} xdotool search --onlyvisible --name '.*'`,
  `echo ---TITLES---`,
  `DISPLAY=${DESKTOP_DISPLAY} xdotool search --onlyvisible --name '.*' getwindowname %@`,
  `echo ---ACTIVE---`,
  `DISPLAY=${DESKTOP_DISPLAY} xdotool getactivewindow getwindowname %@`,
].join('\n');

/** Shell single-quote a value (no interpolation, no injection). */
export function shellQuote(s) {
  return `'${String(s || '').replace(/'/g, `'\\''`)}'`;
}

/**
 * Parse the DESKTOP_WINDOWS_CMD output into
 * { windows: [{ id, title }], activeTitle }.
 * The two searches run back-to-back, so ids and titles zip by line
 * order; a window that closed between them leaves a title-less id,
 * which is dropped. Pure.
 */
export function parseDesktopWindows(output) {
  const lines = String(output || '').split('\n').map((s) => s.trim());
  const tIdx = lines.indexOf('---TITLES---');
  const aIdx = lines.indexOf('---ACTIVE---');
  const idLines = (tIdx === -1 ? lines : lines.slice(0, tIdx)).filter((l) => /^\d+$/.test(l));
  const titleLines = tIdx === -1 ? [] : lines.slice(tIdx + 1, aIdx === -1 ? undefined : aIdx).filter(Boolean);
  const activeTitle = aIdx === -1 ? '' : (lines.slice(aIdx + 1).find(Boolean) || '');
  const windows = idLines
    .map((id, i) => ({ id, title: titleLines[i] || '' }))
    .filter((w) => w.title)
    .slice(0, DESKTOP_MAX_WINDOWS);
  return { windows, activeTitle };
}

/** An empty desktop state (no snapshot taken yet this session). */
export function emptyDesktopState() {
  return { windows: [], activeTitle: '', interacted: [] };
}

/**
 * Merge a fresh parse into the session state, keeping the interacted
 * titles across snapshots (a window that closed and reopened is
 * still "already clicked"). Pure.
 */
export function mergeDesktopState(prev, parsed) {
  const interacted = new Set([...(prev?.interacted || [])]);
  for (const w of parsed?.windows || []) {
    if (w && w.interacted) interacted.add(w.title);
  }
  const windows = (parsed?.windows || []).map((w) => ({ id: w.id, title: w.title, interacted: interacted.has(w.title) }));
  return { windows, activeTitle: parsed?.activeTitle || '', interacted: [...interacted] };
}

/** Mark one window title interacted-with (after a successful desktop_click). Pure. */
export function markWindowInteracted(state, title) {
  const t = String(title || '').trim();
  if (!t) return state || emptyDesktopState();
  const st = state || emptyDesktopState();
  const interacted = new Set([...(st.interacted || []), t]);
  return {
    ...st,
    windows: (st.windows || []).map((w) => (w.title === t ? { ...w, interacted: true } : w)),
    interacted: [...interacted],
  };
}

/**
 * The screen block for the desktop state — the text the brain
 * chooses its desktop actions against. Windows carry [FOCUSED] /
 * [clicked] marks; unclicked windows are the untried set, named so
 * a click that was never tried is never reported as exhausted.
 */
export function desktopStateLines(state, { target = '' } = {}) {
  const st = state || emptyDesktopState();
  const wins = Array.isArray(st.windows) ? st.windows : [];
  if (!wins.length && !st.activeTitle) {
    return [
      '=== DESKTOP — XFCE :99 (1280x800) ===',
      '- No desktop snapshot yet — take desktop_snapshot to see the windows on this machine.',
    ];
  }
  const lines = ['=== DESKTOP — XFCE :99 (1280x800) ==='];
  if (st.activeTitle) lines.push(`- Focused window: ${st.activeTitle}`);
  const untried = wins.filter((w) => !w.interacted);
  for (const w of wins.slice(0, 12)) {
    const marks = [w.title === st.activeTitle ? 'FOCUSED' : '', w.interacted ? 'clicked' : ''].filter(Boolean).join(', ');
    lines.push(`- Window: ${w.title}${marks ? ` [${marks}]` : ''}`);
  }
  if (wins.length > 12) lines.push(`- …and ${wins.length - 12} more windows (desktop_snapshot lists them all in the observation).`);
  if (untried.length) {
    lines.push(`- Untried windows (${untried.length}): ${untried.slice(0, 6).map((w) => w.title).join(' | ')} — desktop_click focuses one by title; a window never clicked is never exhausted.`);
  } else if (wins.length) {
    lines.push('- Every window on this desktop has been clicked at least once.');
  }
  lines.push('- GUI apps launch from the shell (burpsuite, zaproxy, wireshark, xfce4-terminal, thunar); desktop_click focuses a window by title, desktop_key sends keys to the focused window.');
  return lines;
}

/**
 * Resolve a window by title for desktop_click: exact title, then
 * title-starts-with, then title-contains (case-insensitive). Pure.
 */
export function resolveWindowForClick(windows, name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const list = (windows || []).filter((w) => w && w.title);
  return (
    list.find((w) => w.title.toLowerCase() === n) ||
    list.find((w) => w.title.toLowerCase().startsWith(n)) ||
    list.find((w) => w.title.toLowerCase().includes(n)) ||
    null
  );
}

/** Focus a window and send it a click (which focuses it). */
export function desktopClickCommand(win) {
  return `DISPLAY=${DESKTOP_DISPLAY} xdotool windowactivate --sync ${win.id} click --window ${win.id} 1 2>/dev/null && echo clicked || echo click_failed`;
}

// ---------------------------------------------------------------------------
// Keys. The whitelist is the whole contract: a keystroke the brain
// names must be one of these, or the action is refused BEFORE any
// exec — an unvalidated keysym string would be an injection into the
// xdotool command line. Modifiers are lowercase (xdotool's spelling);
// named keys keep their X keysym case.
// ---------------------------------------------------------------------------

const KEY_MODIFIERS = new Set(['ctrl', 'alt', 'shift', 'super', 'meta']);
const KEY_NAMES = new Set([
  'Return', 'Tab', 'Escape', 'space', 'BackSpace', 'Delete',
  'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'Page_Up', 'Page_Down',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

/**
 * Validate a '+'-joined keystroke ("ctrl+alt+t", "Return", "F5").
 * @returns {{ ok: true, keys: string } | { ok: false, error: string }}
 */
export function parseDesktopKeys(keys) {
  const parts = String(keys || '').split('+').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return { ok: false, error: 'empty keys' };
  if (parts.length > 4) return { ok: false, error: 'too many keys in one keystroke (max 4)' };
  const norm = [];
  for (const p of parts) {
    const low = p.toLowerCase();
    if (KEY_MODIFIERS.has(low)) { norm.push(low); continue; }
    if (KEY_NAMES.has(p)) { norm.push(p); continue; }
    if (/^[a-z0-9]$/.test(low)) { norm.push(low); continue; }
    return { ok: false, error: `not a sendable key: "${p}" (modifiers: ctrl/alt/shift/super/meta; keys: Return, Tab, Escape, space, BackSpace, Delete, arrows, Home, End, Page_Up, Page_Down, F1-F12, or a single letter/digit)` };
  }
  // A lone modifier is not a keystroke.
  if (norm.length === 1 && KEY_MODIFIERS.has(norm[0])) return { ok: false, error: `not a sendable key: "${parts[0]}" alone is a modifier, not a keystroke` };
  return { ok: true, keys: norm.join('+') };
}

/** Send a validated keystroke to the focused window. */
export function desktopKeyCommand(parsedKeys) {
  return `DISPLAY=${DESKTOP_DISPLAY} xdotool key --clearmodifiers ${parsedKeys} 2>/dev/null && echo key_sent || echo key_failed`;
}

/** Type literal text into the focused window (max 500 chars). */
export function desktopTypeCommand(text) {
  const t = String(text || '').slice(0, 500);
  return `DISPLAY=${DESKTOP_DISPLAY} xdotool type --clearmodifiers -- ${shellQuote(t)} 2>/dev/null && echo typed || echo type_failed`;
}

/**
 * Capture the WHOLE desktop (scrot on :99) and save the frame as a
 * hunt artifact, reusing huntRunner.huntDesktopScreenshot — the
 * owner's poller route (startHuntDesktop + scrot + copy out).
 * @returns {{ ok: true, name, contentType } | { ok: false, error }}
 */
export async function captureDesktopScreenshot(huntId) {
  try {
    const { huntDesktopScreenshot } = await import('./huntRunner.js');
    const shot = await huntDesktopScreenshot(huntId);
    if (!shot.ok) return { ok: false, error: shot.error || 'screenshot_failed' };
    const name = `desktop-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}.jpg`;
    const file = path.join(artifactsDir(huntId), name);
    fs.writeFileSync(file, shot.buffer);
    return { ok: true, name, contentType: shot.contentType || 'image/jpeg' };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}
