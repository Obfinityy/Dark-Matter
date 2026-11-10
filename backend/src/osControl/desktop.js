// Split out of osControl.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeOsAction, moved verbatim except that
// dispatcher locals are read through the c context object.

import {
  DESKTOP_WINDOWS_CMD,
  DESKTOP_TERMINAL_LAUNCH_CMD,
  DESKTOP_TERMINAL_WINDOWS_CMD,
  DESKTOP_TERMINAL_COMMAND_CAP,
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
  captureDesktopScreenshot,
  desktopTerminalLogFile,
  desktopTerminalWrapCommand,
  parseTerminalExit,
} from '../desktopControl.js';
import { OBS_BUDGET, desktopDownObservation, readDesktopState } from './common.js';
import {
  captureScreenMap,
  parseClickAt,
  desktopClickAtCommand,
  screenMapErrorLine,
} from '../screenMap.js';
import {
  clickControlCommand,
  parseAtspiOutput,
  atspiFailureObservation,
  atspiSuccessObservation,
} from '../desktopAtspi.js';
import {
  TOOL_IDS,
  resolveTool,
  launchGuiTool,
  checkCliTool,
  downloadTool,
  listToolControls,
  recordToolState,
  burpFirstUseDone,
  burpFirstUse,
} from '../toolLaunch.js';
import { scopeViolation } from '../humanLoop.js';

export async function handleDesktopSnapshot(huntId, action, c) {
  // WHOLE-OS CONTROL: read the live desktop (windows + focused app)
  // via xdotool on :99. A desktop that is down is a reportable
  // state, not a silent empty list.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'desktop_snapshot is unavailable — no container exec.' };
  try {
    const res = await c.execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
    const out = String((res && res.stdout) || '');
    const errText = String((res && res.stderr) || '');
    if (!out.trim() && (errText || (res && res.code && res.code !== 0))) {
      return { ok: false, observation: desktopDownObservation(errText) };
    }
    const state = mergeDesktopState(emptyDesktopState(), parseDesktopWindows(out));
    return { ok: true, observation: desktopStateLines(state, { target: c.target }).join('\n'), desktopState: state };
  } catch (err) {
    return { ok: false, observation: `Desktop snapshot failed: ${err.message || err}. Open a page with browser_open first — that starts the desktop — then try again.` };
  }
}

export async function handleDesktopClick(huntId, action, c) {
  // Focus a window by title (resolved from a FRESH desktop read).
  // No matching window is a named refusal listing the windows that
  // DO exist — nothing is executed on a guess.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'desktop_click is unavailable — no container exec.' };
  const winName = String(action.window || '');
  let state;
  try {
    state = await readDesktopState(huntId, c.execRaw);
  } catch (err) {
    return { ok: false, observation: `Desktop click failed: ${err.message || err}. Take desktop_snapshot to check the desktop.` };
  }
  const win = resolveWindowForClick(state.windows, winName);
  if (!win) {
    const known = (state.windows || []).map((w) => w.title).filter(Boolean);
    return {
      ok: false,
      observation: known.length
        ? `No window matches "${winName}". Windows on this desktop: ${known.join(' | ')}. Take desktop_snapshot to refresh the list, then desktop_click one of them by title.`
        : `No window matches "${winName}" — and no windows are on the desktop right now. Take desktop_snapshot first, then desktop_click one of its windows by title.`,
    };
  }
  try {
    const res = await c.execRaw(huntId, desktopClickCommand(win), 15000, { bypassTmux: true });
    if (String((res && res.stdout) || '').includes('clicked')) {
      return { ok: true, observation: `Focused window "${win.title}" (clicked it). It now receives your desktop_key keystrokes — Tab/Return/arrows to move inside it, or type text with desktop_key.` };
    }
    return { ok: false, observation: `Could not click window "${win.title}" (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). The window may have closed — take desktop_snapshot to refresh the list.` };
  } catch (err) {
    return { ok: false, observation: `Desktop click failed: ${err.message || err}. Take desktop_snapshot to refresh the window list.` };
  }
}

export async function handleDesktopKey(huntId, action, c) {
  // Keys or literal text to the focused window. Keystrokes are
  // whitelist-validated BEFORE any exec (parseDesktopKeys) — an
  // unvalidated keysym would be an injection into xdotool.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'desktop_key is unavailable — no container exec.' };
  const keys = String(action.keys || '');
  const text = String(action.text || '');
  if (keys) {
    const parsed = parseDesktopKeys(keys);
    if (!parsed.ok) {
      return { ok: false, observation: `Keys not sent — ${parsed.error}. Send one keystroke: modifiers ctrl/alt/shift/super/meta plus one key (Return, Tab, Escape, space, BackSpace, Delete, arrows, Home, End, Page_Up, Page_Down, F1-F12, or a single letter/digit), e.g. {"action":"desktop_key","keys":"ctrl+l"}. To type words, use {"action":"desktop_key","text":"..."} instead.` };
    }
    try {
      const res = await c.execRaw(huntId, desktopKeyCommand(parsed.keys), 15000, { bypassTmux: true });
      if (String((res && res.stdout) || '').includes('key_sent')) {
        return { ok: true, observation: `Sent keys ${parsed.keys} to the focused window. Take desktop_snapshot or browser_snapshot to see what changed.` };
      }
      return { ok: false, observation: `Keys ${parsed.keys} may not have reached the focused window (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). Take desktop_snapshot to check which window is focused.` };
    } catch (err) {
      return { ok: false, observation: `Desktop keys failed: ${err.message || err}. Take desktop_snapshot to check the focused window.` };
    }
  }
  if (text) {
    try {
      const res = await c.execRaw(huntId, desktopTypeCommand(text), 15000, { bypassTmux: true });
      if (String((res && res.stdout) || '').includes('typed')) {
        return { ok: true, observation: `Typed ${text.length} chars into the focused window. Take desktop_snapshot or browser_snapshot to see what changed.` };
      }
      return { ok: false, observation: `Typing may not have reached the focused window (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). Take desktop_snapshot to check the focused window.` };
    } catch (err) {
      return { ok: false, observation: `Desktop typing failed: ${err.message || err}. Take desktop_snapshot to check the focused window.` };
    }
  }
  return { ok: false, observation: 'Nothing sent — give "keys" (e.g. "ctrl+l", "Return") or "text" (words to type) with desktop_key.' };
}

export async function handleDesktopClickAt(huntId, action, c) {
  // Click at a point FROM THE SCREEN MAP. Coordinates are validated
  // BEFORE any exec (parseClickAt) — an unvalidated number would be
  // an injection into xdotool.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'desktop_click_at is unavailable — no container exec.' };
  const parsed = parseClickAt(action);
  if (!parsed.ok) {
    return { ok: false, observation: `Click not sent — ${parsed.error}. Take see_screen first and use a point from the map.` };
  }
  try {
    const res = await c.execRaw(huntId, desktopClickAtCommand(parsed.x, parsed.y), 15000, { bypassTmux: true });
    if (String((res && res.stdout) || '').includes('clicked')) {
      return { ok: true, observation: `Clicked at (${parsed.x}, ${parsed.y}). Take see_screen to confirm what changed.` };
    }
    return { ok: false, observation: `Click at (${parsed.x}, ${parsed.y}) may not have landed (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). Take see_screen to check the screen.` };
  } catch (err) {
    return { ok: false, observation: `Desktop click failed: ${err.message || err}. Take see_screen to check the screen.` };
  }
}

export async function handleDesktopClickControl(huntId, action, c) {
  // Click a NAMED CONTROL inside a GUI app via its accessibility
  // tree (AT-SPI). When the app exposes no tree the helper says so
  // and the observation names the keyboard fallback — never a
  // pretended click.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'desktop_click_control is unavailable — no container exec.' };
  const controlName = String(action.control || '').trim().slice(0, 120);
  const windowSub = String(action.window || '').trim().slice(0, 120);
  if (!controlName) {
    return { ok: false, observation: 'Nothing clicked — give the control\'s visible name, e.g. {"action":"desktop_click_control","control":"Repeater","window":"Burp Suite"}. Take desktop_snapshot first if you do not know the window titles, or list a window\'s controls by naming it.' };
  }
  try {
    const res = await c.execRaw(huntId, clickControlCommand(controlName, windowSub), 20000, { bypassTmux: true });
    const parsed = parseAtspiOutput((res && res.stdout) || '');
    if (parsed.ok) return { ok: true, observation: atspiSuccessObservation(parsed.clicked) };
    return { ok: false, observation: atspiFailureObservation(parsed.error) };
  } catch (err) {
    return { ok: false, observation: atspiFailureObservation(`the click command failed: ${err.message || err}`) };
  }
}

export async function handleListControls(huntId, action, c) {
  // List a window's NAMED controls from its accessibility tree.
  // Read-only — it never clicks anything.
  const windowSub = String(action.window || '').trim().slice(0, 120);
  try {
    const res = await listToolControls(huntId, windowSub, { execRaw: c.execRaw });
    return { ok: res.ok !== false, observation: res.ok ? res.observation : res.error };
  } catch (err) {
    return { ok: false, observation: `Could not list controls: ${err.message || err}. Fall back to see_screen and desktop_click_at.` };
  }
}

export async function handleDesktopScreenshot(huntId, action, c) {
  // The full desktop frame (scrot on :99), saved as a hunt artifact
  // — the frame the live UI shows and the owner watches.
  try {
    const shot = await c.getDesktopScreenshot()(huntId);
    if (shot && shot.ok) {
      let stateLines = '';
      try {
        const state = await readDesktopState(huntId, c.execRaw);
        stateLines = desktopStateLines(state, { target: c.target }).join('\n');
      } catch { /* the state read is best-effort beside the shot */ }
      return { ok: true, artifact: shot.name, observation: `Desktop screenshot saved as artifact ${shot.name} in your hunt workspace (the owner watches this desktop live). What the desktop shows:\n${stateLines}` };
    }
    return { ok: false, observation: `Desktop screenshot failed: ${(shot && shot.error) || 'unknown error'}. Open a page with browser_open first — that starts the desktop — then try again.` };
  } catch (err) {
    return { ok: false, observation: `Desktop screenshot failed: ${err.message || err}.` };
  }
}

export async function handleSeeScreen(huntId, action, c) {
  // THE VISION LOOP (28 Oct 2026, owner order): the agent SEES the
  // screen, takes a screenshot (photo), and SENDS it to the brain.
  // For the parent brain the photo is the live desktop frame in the
  // UI; the text map below is what the brain reads and clicks from.
  // For the API brain the same call returns the same map — the
  // multimodal photo leg waits for the API gate to lift (the brain
  // never sees the image until then). Perception, not dedupe-gated:
  // looking twice is how the brain confirms the screen changed.
  // A missing OCR install is a named state, not a silent empty map.
  try {
    const res = await captureScreenMap(huntId, { execRaw: c.execRaw });
    if (res.ok) {
      return {
        ok: true,
        observation: `${res.map}\n(To act on what you see: desktop_click_at with the (x, y) from the map, or desktop_key to type. Then see_screen again to confirm the screen changed.)`,
      };
    }
    return { ok: false, observation: screenMapErrorLine(res.error) };
  } catch (err) {
    return { ok: false, observation: `Could not read the screen: ${err.message || err}. Take desktop_snapshot instead.` };
  }
}

export async function handleDesktopTerminal(huntId, action, c) {
  // GUI-VISIBLE TERMINAL: the command runs in a terminal window ON
  // the GUI desktop, typed visibly, so the owner watches it live.
  // Same scope rule as shell (out-of-scope URLs refused before
  // anything runs). The heavy-scan pattern gate is BYPASSED here
  // with reason (see brainMode.js gate list): its patterns live
  // unexported inside humanLoop.js and the parent is a human
  // choosing one command at a time, not an AI looping. The output
  // comes back WITHOUT re-running: the typed line tees it into a
  // per-hunt log file and this call reads that file back.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'desktop_terminal is unavailable — no container exec.' };
  const command = String(action.command || '').replace(/[\r\n]+/g, ' ').trim().slice(0, DESKTOP_TERMINAL_COMMAND_CAP);
  if (!command) return { ok: false, observation: 'Empty terminal command — nothing ran. Give a real command.' };
  const badUrl = (() => {
    try {
      const urls = command.match(/(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s'"<>)|\]]+/gi) || [];
      for (const u of urls) {
        const v = scopeViolation(u, c.target, c.parsedScope || null);
        if (v) return v;
      }
      return null;
    } catch { return null; }
  })();
  if (badUrl) {
    return { ok: false, observation: `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. Only test ${c.target} and its listed assets. Nothing was sent.` };
  }
  const logFile = desktopTerminalLogFile(huntId);
  const typed = desktopTerminalWrapCommand(command, logFile);
  // (1) Desktop up? Start it when xdotool cannot reach :99.
  let windowsOut = '';
  try {
    const res = await c.execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
    windowsOut = String((res && res.stdout) || '');
  } catch { /* desktop down — start it below */ }
  if (!windowsOut.trim()) {
    try {
      await c.getStartDesktop()(huntId);
      await c.sleep(4000);
      const res = await c.execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
      windowsOut = String((res && res.stdout) || '');
    } catch { /* start failure reports below */ }
  }
  if (!windowsOut.trim()) {
    return { ok: false, observation: 'The desktop is not running right now (xdotool could not reach display :99, and starting it did not bring it up). Open a page with browser_open first — that starts the desktop — then try desktop_terminal again.' };
  }
  // (2) Terminal open? Find one by window class; launch when none.
  let termWin = null;
  try {
    const res = await c.execRaw(huntId, DESKTOP_TERMINAL_WINDOWS_CMD, 15000, { bypassTmux: true });
    termWin = (parseDesktopWindows(String((res && res.stdout) || '')).windows || [])[0] || null;
  } catch { /* launch below */ }
  if (!termWin) {
    try {
      await c.execRaw(huntId, DESKTOP_TERMINAL_LAUNCH_CMD, 15000, { bypassTmux: true });
      await c.sleep(2500);
      const res = await c.execRaw(huntId, DESKTOP_TERMINAL_WINDOWS_CMD, 15000, { bypassTmux: true });
      termWin = (parseDesktopWindows(String((res && res.stdout) || '')).windows || [])[0] || null;
    } catch { /* reports below */ }
  }
  if (!termWin) {
    return { ok: false, observation: 'Could not open a terminal window on the desktop (xfce4-terminal did not appear). Take desktop_snapshot to see what is on the desktop, then try again.' };
  }
  // (3) Focus, type visibly, Return.
  let typedOk = false;
  try {
    const clickRes = await c.execRaw(huntId, desktopClickCommand(termWin), 15000, { bypassTmux: true });
    const typeRes = await c.execRaw(huntId, desktopTypeCommand(typed), 15000, { bypassTmux: true });
    const keyRes = await c.execRaw(huntId, desktopKeyCommand('Return'), 15000, { bypassTmux: true });
    typedOk = String((clickRes && clickRes.stdout) || '').includes('clicked')
      && String((typeRes && typeRes.stdout) || '').includes('typed')
      && String((keyRes && keyRes.stdout) || '').includes('key_sent');
  } catch { typedOk = false; }
  if (!typedOk) {
    return { ok: false, observation: `Could not type into the terminal window "${termWin.title || 'Terminal'}" — the focus, type, or Return step failed. Take desktop_snapshot to check the desktop, then try again.` };
  }
  // (4) Poll the tee log until the exit marker lands, then read
  // it back, screenshot. FIX (#368): the old code slept a fixed
  // 3000ms and read once, so any command slower than 3s came back
  // truncated — the brain saw partial output and had to chase the
  // rest by hand. Polls are cheap tail reads: the marker is the
  // log's LAST line (see desktopTerminalWrapCommand), so a
  // 256-byte tail decides completion exactly like a full read,
  // and the full log is read once, after completion or at the
  // poll cap. Quick commands now return faster than the old fixed
  // 3000ms; commands up to ~30s complete in-call; slower ones keep
  // the honest still-running observation below (unchanged text).
  // The cap counts POLLS, not wall seconds, so a stubbed sleep
  // keeps tests instant while production polls are ~1s apart.
  let logText = '';
  for (let poll = 0; poll < 30; poll++) {
    let done = false;
    try {
      const tailRes = await c.execRaw(huntId, `tail -c 256 ${shellQuote(logFile)} 2>/dev/null || true`, 15000, { bypassTmux: true });
      done = parseTerminalExit(String((tailRes && tailRes.stdout) || '')) !== null;
    } catch { /* a failed tail read is just "not finished yet" */ }
    if (done) break;
    await c.sleep(1000);
  }
  try {
    const logRes = await c.execRaw(huntId, `cat ${shellQuote(logFile)} 2>/dev/null || echo __DT_NO_LOG__`, 15000, { bypassTmux: true });
    logText = String((logRes && logRes.stdout) || '');
  } catch { /* empty log reports below */ }
  let shotName = '';
  try {
    const shot = await c.getDesktopScreenshot()(huntId);
    if (shot && shot.ok) shotName = shot.name;
  } catch { /* screenshot is best-effort beside the output */ }
  const exitCode = parseTerminalExit(logText);
  const body = logText.replace(/__DT_EXIT__:\d+\s*$/, '').replace(/__DT_NO_LOG__\s*$/, '').trim();
  if (exitCode === null) {
    return {
      ok: true,
      artifact: shotName || undefined,
      observation: `Typed visibly into the terminal ("${termWin.title || 'Terminal'}") and pressed Return — the command is STILL RUNNING on the desktop (no exit marker yet). What it has printed so far:\n${body ? body.slice(0, OBS_BUDGET) : '(nothing yet)'}${shotName ? `\nDesktop screenshot saved as artifact ${shotName} — the owner watches it live.` : ''}\nRead the rest with a shell action: cat ${logFile}`,
    };
  }
  const outText = body || `(command finished with no output, exit code ${exitCode})`;
  return {
    ok: true,
    artifact: shotName || undefined,
    observation: `Ran visibly in the terminal ("${termWin.title || 'Terminal'}") — the owner watched it live. Exit code ${exitCode}${shotName ? ` · desktop screenshot ${shotName}` : ''}:\n${outText.length > OBS_BUDGET ? `${outText.slice(0, OBS_BUDGET)}\n[output truncated on screen — ${body.length} chars total]` : outText}`,
  };
}
