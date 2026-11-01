// OS CONTROL (28 Oct 2026, owner order) — the full Kali machine, as
// JSON actions, for the parent brain.
//
// The API brain (humanLoop.js) already had this surface — browser +
// desktop + tools — but the parent path (brainMode.executeBrainAction)
// only supported shell / browser_open / browser_click / browser_type /
// recall / claim_finding. A parent acting as the API brain hit a wall:
// it could not snapshot the desktop, click a window, press a key,
// launch Burp, or read the screen. That is the gap this module closes.
//
// WHY A SEPARATE MODULE, NOT A REWRITE OF humanLoop (reason recorded,
// owner order 18:25 IST): the API brain's dispatch is a 600-line chain
// inside humanIteration, threaded through session state
// (sessionDesktopState, sessionOutputs, pacing, toolCall/note). Rewiring
// it mid-lane risks the live loop. This module implements each action
// over the SAME machine-touching helpers the loop already uses
// (desktopControl.js, screenMap.js, desktopAtspi.js, toolLaunch.js,
// proxyIntercept.js, guiTools.js) with the SAME commands, the SAME
// validation, and the SAME observations — so the machine behaviour is
// one shared path even though the two dispatches are still two call
// sites. The follow-up is to extract one dispatch both call; it is
// named in docs/brain-architecture.md, not silently skipped.
//
// STATELESS BY DESIGN: every call reads the desktop fresh (no cached
// sessionDesktopState). The parent path is one HTTP call per action, so
// there is no session to cache in — a fresh read is also the honest
// one (the desktop may have changed since the last action).
//
// NO FAKE SUCCESS: every action returns { ok, observation, ... }.
// ok:false means the machine refused or the effect did not happen,
// and executeBrainAction turns that into a FAILED step (never a
// task_complete) — the rule the DVWA login failure taught us.
// Read-only actions (snapshots, see_screen, list_controls,
// intercept_list/read) are never dedupe-gated anywhere; they are
// perception, and looking twice is how the brain confirms change.

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
} from './desktopControl.js';
import {
  captureScreenMap,
  parseClickAt,
  desktopClickAtCommand,
  screenMapErrorLine,
} from './screenMap.js';
import {
  clickControlCommand,
  parseAtspiOutput,
  atspiFailureObservation,
  atspiSuccessObservation,
} from './desktopAtspi.js';
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
} from './toolLaunch.js';
import {
  startInterceptProxy,
  listIntercept,
  readInterceptEntry,
  buildReplayRequest,
  buildReplayCurl,
  replaySignature,
} from './proxyIntercept.js';
import { scopeViolation } from './humanLoop.js';

const OBS_BUDGET = 3500; // chars of an action result shown on screen
const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

/** The full OS-control surface the parent brain may submit. */
export const OS_CONTROL_ACTIONS = new Set([
  'browser_snapshot',
  'screenshot',
  'desktop_snapshot',
  'desktop_click',
  'desktop_key',
  'desktop_click_at',
  'desktop_click_control',
  'list_controls',
  'desktop_screenshot',
  'see_screen',
  'desktop_terminal',
  'launch_tool',
  'download_tool',
  'proxy_start',
  'intercept_list',
  'intercept_read',
  'intercept_replay',
]);

/**
 * Detail line for the action index — WHAT was done, compact, so the
 * memory file can list it without the result. Mirrors the API brain's
 * detailForAction for these kinds (humanLoop.js).
 */
export function osControlDetail(kind, action) {
  switch (kind) {
    case 'browser_snapshot': return '';
    case 'screenshot': return '';
    case 'desktop_snapshot': return '';
    case 'desktop_click': return String(action.window || '').slice(0, 120);
    case 'desktop_key': return String(action.keys || action.text || '').slice(0, 80);
    case 'desktop_click_at': return `${String(action.x ?? '')},${String(action.y ?? '')}`;
    case 'desktop_click_control': return String(action.control || '').slice(0, 120);
    case 'list_controls': return String(action.window || '').slice(0, 120);
    case 'desktop_screenshot': return '';
    case 'see_screen': return '';
    case 'desktop_terminal': return String(action.command || '').slice(0, 160);
    case 'launch_tool': return String(action.tool || '').slice(0, 80);
    case 'download_tool': return String(action.tool || '').slice(0, 80);
    case 'proxy_start': return '';
    case 'intercept_list': return '';
    case 'intercept_read': return `#${String(action.index ?? '').slice(0, 12)}`;
    case 'intercept_replay': return replaySignature(action).slice(0, 160);
    default: return '';
  }
}

async function readDesktopState(huntId, execRaw) {
  const res = await execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
  return mergeDesktopState(emptyDesktopState(), parseDesktopWindows(String((res && res.stdout) || '')));
}

function desktopDownObservation(errText) {
  return `The desktop is not running right now (xdotool could not reach display :99${errText ? `: ${String(errText).slice(0, 160)}` : ''}). Open a page with browser_open first — that starts the desktop — then take desktop_snapshot again.`;
}

/**
 * Execute ONE OS-control action.
 *
 * ctx: { target, execRaw, exec, gui, desktopScreenshot, startDesktop,
 *        readMeta, writeMeta, sleep }
 *   execRaw — raw container exec (huntRunner.execInHuntContainerWithRespawn)
 *   exec    — shell exec (executeWithEvasion), for intercept_replay only
 *   gui     — { snapshot, screenshot } (guiTools, bound like the loop)
 *   desktopScreenshot — () => captureDesktopScreenshot, defaulted
 *   startDesktop — () => huntRunner.startHuntDesktop, defaulted
 *   readMeta/writeMeta — hunt meta access, for Burp/tool state
 *   sleep   — defaults to setTimeout
 * Tests pass fakes for every field; production fills them in brainMode.
 *
 * Returns { ok, observation, artifact? } — artifact is the saved
 * screenshot name when the action produced one (the live UI polls it).
 */
export async function executeOsAction(huntId, kind, action, ctx = {}) {
  const target = String(ctx.target || '');
  const execRaw = ctx.execRaw;
  const sleep = ctx.sleep || sleepDefault;
  const gui = ctx.gui || {};
  const getDesktopScreenshot = () => {
    if (ctx.desktopScreenshot) return ctx.desktopScreenshot;
    return (h) => captureDesktopScreenshot(h);
  };
  const getStartDesktop = () => {
    if (ctx.startDesktop) return ctx.startDesktop;
    return async (h) => {
      const { startHuntDesktop } = await import('./huntRunner.js');
      return startHuntDesktop(h);
    };
  };

  if (kind === 'browser_snapshot') {
    if (typeof gui.snapshot !== 'function') return { ok: false, observation: 'browser_snapshot is unavailable — no GUI binding.' };
    const res = await gui.snapshot(huntId);
    return { ok: res.ok !== false, observation: (res && res.observation) || '(no observation)' };
  }

  if (kind === 'screenshot') {
    if (typeof gui.screenshot !== 'function') return { ok: false, observation: 'screenshot is unavailable — no GUI binding.' };
    const res = await gui.screenshot(huntId);
    return { ok: res.ok !== false, observation: (res && res.observation) || '(no observation)', artifact: res && res.artifact };
  }

  if (kind === 'desktop_snapshot') {
    // WHOLE-OS CONTROL: read the live desktop (windows + focused app)
    // via xdotool on :99. A desktop that is down is a reportable
    // state, not a silent empty list.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'desktop_snapshot is unavailable — no container exec.' };
    try {
      const res = await execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
      const out = String((res && res.stdout) || '');
      const errText = String((res && res.stderr) || '');
      if (!out.trim() && (errText || (res && res.code && res.code !== 0))) {
        return { ok: false, observation: desktopDownObservation(errText) };
      }
      const state = mergeDesktopState(emptyDesktopState(), parseDesktopWindows(out));
      return { ok: true, observation: desktopStateLines(state, { target }).join('\n'), desktopState: state };
    } catch (err) {
      return { ok: false, observation: `Desktop snapshot failed: ${err.message || err}. Open a page with browser_open first — that starts the desktop — then try again.` };
    }
  }

  if (kind === 'desktop_click') {
    // Focus a window by title (resolved from a FRESH desktop read).
    // No matching window is a named refusal listing the windows that
    // DO exist — nothing is executed on a guess.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'desktop_click is unavailable — no container exec.' };
    const winName = String(action.window || '');
    let state;
    try {
      state = await readDesktopState(huntId, execRaw);
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
      const res = await execRaw(huntId, desktopClickCommand(win), 15000, { bypassTmux: true });
      if (String((res && res.stdout) || '').includes('clicked')) {
        return { ok: true, observation: `Focused window "${win.title}" (clicked it). It now receives your desktop_key keystrokes — Tab/Return/arrows to move inside it, or type text with desktop_key.` };
      }
      return { ok: false, observation: `Could not click window "${win.title}" (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). The window may have closed — take desktop_snapshot to refresh the list.` };
    } catch (err) {
      return { ok: false, observation: `Desktop click failed: ${err.message || err}. Take desktop_snapshot to refresh the window list.` };
    }
  }

  if (kind === 'desktop_key') {
    // Keys or literal text to the focused window. Keystrokes are
    // whitelist-validated BEFORE any exec (parseDesktopKeys) — an
    // unvalidated keysym would be an injection into xdotool.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'desktop_key is unavailable — no container exec.' };
    const keys = String(action.keys || '');
    const text = String(action.text || '');
    if (keys) {
      const parsed = parseDesktopKeys(keys);
      if (!parsed.ok) {
        return { ok: false, observation: `Keys not sent — ${parsed.error}. Send one keystroke: modifiers ctrl/alt/shift/super/meta plus one key (Return, Tab, Escape, space, BackSpace, Delete, arrows, Home, End, Page_Up, Page_Down, F1-F12, or a single letter/digit), e.g. {"action":"desktop_key","keys":"ctrl+l"}. To type words, use {"action":"desktop_key","text":"..."} instead.` };
      }
      try {
        const res = await execRaw(huntId, desktopKeyCommand(parsed.keys), 15000, { bypassTmux: true });
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
        const res = await execRaw(huntId, desktopTypeCommand(text), 15000, { bypassTmux: true });
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

  if (kind === 'desktop_click_at') {
    // Click at a point FROM THE SCREEN MAP. Coordinates are validated
    // BEFORE any exec (parseClickAt) — an unvalidated number would be
    // an injection into xdotool.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'desktop_click_at is unavailable — no container exec.' };
    const parsed = parseClickAt(action);
    if (!parsed.ok) {
      return { ok: false, observation: `Click not sent — ${parsed.error}. Take see_screen first and use a point from the map.` };
    }
    try {
      const res = await execRaw(huntId, desktopClickAtCommand(parsed.x, parsed.y), 15000, { bypassTmux: true });
      if (String((res && res.stdout) || '').includes('clicked')) {
        return { ok: true, observation: `Clicked at (${parsed.x}, ${parsed.y}). Take see_screen to confirm what changed.` };
      }
      return { ok: false, observation: `Click at (${parsed.x}, ${parsed.y}) may not have landed (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). Take see_screen to check the screen.` };
    } catch (err) {
      return { ok: false, observation: `Desktop click failed: ${err.message || err}. Take see_screen to check the screen.` };
    }
  }

  if (kind === 'desktop_click_control') {
    // Click a NAMED CONTROL inside a GUI app via its accessibility
    // tree (AT-SPI). When the app exposes no tree the helper says so
    // and the observation names the keyboard fallback — never a
    // pretended click.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'desktop_click_control is unavailable — no container exec.' };
    const controlName = String(action.control || '').trim().slice(0, 120);
    const windowSub = String(action.window || '').trim().slice(0, 120);
    if (!controlName) {
      return { ok: false, observation: 'Nothing clicked — give the control\'s visible name, e.g. {"action":"desktop_click_control","control":"Repeater","window":"Burp Suite"}. Take desktop_snapshot first if you do not know the window titles, or list a window\'s controls by naming it.' };
    }
    try {
      const res = await execRaw(huntId, clickControlCommand(controlName, windowSub), 20000, { bypassTmux: true });
      const parsed = parseAtspiOutput((res && res.stdout) || '');
      if (parsed.ok) return { ok: true, observation: atspiSuccessObservation(parsed.clicked) };
      return { ok: false, observation: atspiFailureObservation(parsed.error) };
    } catch (err) {
      return { ok: false, observation: atspiFailureObservation(`the click command failed: ${err.message || err}`) };
    }
  }

  if (kind === 'list_controls') {
    // List a window's NAMED controls from its accessibility tree.
    // Read-only — it never clicks anything.
    const windowSub = String(action.window || '').trim().slice(0, 120);
    try {
      const res = await listToolControls(huntId, windowSub, { execRaw });
      return { ok: res.ok !== false, observation: res.ok ? res.observation : res.error };
    } catch (err) {
      return { ok: false, observation: `Could not list controls: ${err.message || err}. Fall back to see_screen and desktop_click_at.` };
    }
  }

  if (kind === 'desktop_screenshot') {
    // The full desktop frame (scrot on :99), saved as a hunt artifact
    // — the frame the live UI shows and the owner watches.
    try {
      const shot = await getDesktopScreenshot()(huntId);
      if (shot && shot.ok) {
        let stateLines = '';
        try {
          const state = await readDesktopState(huntId, execRaw);
          stateLines = desktopStateLines(state, { target }).join('\n');
        } catch { /* the state read is best-effort beside the shot */ }
        return { ok: true, artifact: shot.name, observation: `Desktop screenshot saved as artifact ${shot.name} in your hunt workspace (the owner watches this desktop live). What the desktop shows:\n${stateLines}` };
      }
      return { ok: false, observation: `Desktop screenshot failed: ${(shot && shot.error) || 'unknown error'}. Open a page with browser_open first — that starts the desktop — then try again.` };
    } catch (err) {
      return { ok: false, observation: `Desktop screenshot failed: ${err.message || err}.` };
    }
  }

  if (kind === 'see_screen') {
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
      const res = await captureScreenMap(huntId, { execRaw });
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

  if (kind === 'desktop_terminal') {
    // GUI-VISIBLE TERMINAL: the command runs in a terminal window ON
    // the GUI desktop, typed visibly, so the owner watches it live.
    // Same scope rule as shell (out-of-scope URLs refused before
    // anything runs). The heavy-scan pattern gate is BYPASSED here
    // with reason (see brainMode.js gate list): its patterns live
    // unexported inside humanLoop.js and the parent is a human
    // choosing one command at a time, not an AI looping. The output
    // comes back WITHOUT re-running: the typed line tees it into a
    // per-hunt log file and this call reads that file back.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'desktop_terminal is unavailable — no container exec.' };
    const command = String(action.command || '').replace(/[\r\n]+/g, ' ').trim().slice(0, DESKTOP_TERMINAL_COMMAND_CAP);
    if (!command) return { ok: false, observation: 'Empty terminal command — nothing ran. Give a real command.' };
    const badUrl = (() => {
      try {
        const urls = command.match(/(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s'"<>)|\]]+/gi) || [];
        for (const u of urls) {
          const v = scopeViolation(u, target, ctx.parsedScope || null);
          if (v) return v;
        }
        return null;
      } catch { return null; }
    })();
    if (badUrl) {
      return { ok: false, observation: `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. Only test ${target} and its listed assets. Nothing was sent.` };
    }
    const logFile = desktopTerminalLogFile(huntId);
    const typed = desktopTerminalWrapCommand(command, logFile);
    // (1) Desktop up? Start it when xdotool cannot reach :99.
    let windowsOut = '';
    try {
      const res = await execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
      windowsOut = String((res && res.stdout) || '');
    } catch { /* desktop down — start it below */ }
    if (!windowsOut.trim()) {
      try {
        await getStartDesktop()(huntId);
        await sleep(4000);
        const res = await execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
        windowsOut = String((res && res.stdout) || '');
      } catch { /* start failure reports below */ }
    }
    if (!windowsOut.trim()) {
      return { ok: false, observation: 'The desktop is not running right now (xdotool could not reach display :99, and starting it did not bring it up). Open a page with browser_open first — that starts the desktop — then try desktop_terminal again.' };
    }
    // (2) Terminal open? Find one by window class; launch when none.
    let termWin = null;
    try {
      const res = await execRaw(huntId, DESKTOP_TERMINAL_WINDOWS_CMD, 15000, { bypassTmux: true });
      termWin = (parseDesktopWindows(String((res && res.stdout) || '')).windows || [])[0] || null;
    } catch { /* launch below */ }
    if (!termWin) {
      try {
        await execRaw(huntId, DESKTOP_TERMINAL_LAUNCH_CMD, 15000, { bypassTmux: true });
        await sleep(2500);
        const res = await execRaw(huntId, DESKTOP_TERMINAL_WINDOWS_CMD, 15000, { bypassTmux: true });
        termWin = (parseDesktopWindows(String((res && res.stdout) || '')).windows || [])[0] || null;
      } catch { /* reports below */ }
    }
    if (!termWin) {
      return { ok: false, observation: 'Could not open a terminal window on the desktop (xfce4-terminal did not appear). Take desktop_snapshot to see what is on the desktop, then try again.' };
    }
    // (3) Focus, type visibly, Return.
    let typedOk = false;
    try {
      const clickRes = await execRaw(huntId, desktopClickCommand(termWin), 15000, { bypassTmux: true });
      const typeRes = await execRaw(huntId, desktopTypeCommand(typed), 15000, { bypassTmux: true });
      const keyRes = await execRaw(huntId, desktopKeyCommand('Return'), 15000, { bypassTmux: true });
      typedOk = String((clickRes && clickRes.stdout) || '').includes('clicked')
        && String((typeRes && typeRes.stdout) || '').includes('typed')
        && String((keyRes && keyRes.stdout) || '').includes('key_sent');
    } catch { typedOk = false; }
    if (!typedOk) {
      return { ok: false, observation: `Could not type into the terminal window "${termWin.title || 'Terminal'}" — the focus, type, or Return step failed. Take desktop_snapshot to check the desktop, then try again.` };
    }
    // (4) Let it run, read the tee log back, screenshot.
    await sleep(3000);
    let logText = '';
    try {
      const logRes = await execRaw(huntId, `cat ${shellQuote(logFile)} 2>/dev/null || echo __DT_NO_LOG__`, 15000, { bypassTmux: true });
      logText = String((logRes && logRes.stdout) || '');
    } catch { /* empty log reports below */ }
    let shotName = '';
    try {
      const shot = await getDesktopScreenshot()(huntId);
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

  if (kind === 'launch_tool') {
    // Launch a NAMED tool from the registry and wait for it to be
    // ready. GUI tools open on the desktop; CLI tools are verified
    // present with their version. A repeat launch just reports
    // "already running" — never a second copy. The first Burp launch
    // in a hunt also runs the first-use path (wizard, proxy, target
    // in Burp's browser) and records it in the hunt memory.
    const toolId = String(action.tool || '').trim().toLowerCase().slice(0, 80);
    const resolved = resolveTool(toolId);
    if (!resolved.ok) return { ok: false, observation: `${resolved.error} (available: ${TOOL_IDS.join(', ')})` };
    if (resolved.tool.kind === 'gui') {
      try {
        let firstUse = null;
        if (toolId === 'burp') {
          try { firstUse = burpFirstUseDone(ctx.readMeta ? ctx.readMeta(huntId) : {}); } catch { firstUse = false; }
        }
        if (toolId === 'burp' && firstUse === false) {
          const res = await burpFirstUse(huntId, target, { execRaw, sleep, readMeta: ctx.readMeta, writeMeta: ctx.writeMeta });
          if (!res.ok) return { ok: false, observation: `Burp first-use did not complete: ${res.error || res.observation}` };
          try { await recordToolState(huntId, 'burp', { ...res.state }, { readMeta: ctx.readMeta, writeMeta: ctx.writeMeta }); } catch { /* best-effort */ }
          return { ok: true, observation: res.observation };
        }
        const res = await launchGuiTool(huntId, toolId, { execRaw, sleep });
        if (res.ok) {
          try { await recordToolState(huntId, toolId, { running: true, via: res.via, window: res.window || '' }, { readMeta: ctx.readMeta, writeMeta: ctx.writeMeta }); } catch { /* best-effort */ }
          return { ok: true, observation: res.observation };
        }
        return { ok: false, observation: res.error };
      } catch (err) {
        return { ok: false, observation: `Tool launch failed: ${err.message || err}` };
      }
    }
    try {
      const res = await checkCliTool(huntId, toolId, { execRaw });
      if (res.ok) {
        try { await recordToolState(huntId, toolId, { running: true, version: String(res.version || '').slice(0, 120) }, { readMeta: ctx.readMeta, writeMeta: ctx.writeMeta }); } catch { /* best-effort */ }
        return { ok: true, observation: res.observation };
      }
      return { ok: false, observation: res.error };
    } catch (err) {
      return { ok: false, observation: `Tool check failed: ${err.message || err}` };
    }
  }

  if (kind === 'download_tool') {
    // Install a MISSING tool from the allow-list. Anything not listed
    // is refused BEFORE any exec — the refusal names the installable
    // tools, so the brain can pick a real one instead of guessing.
    const toolId = String(action.tool || '').trim().toLowerCase().slice(0, 80);
    try {
      const res = await downloadTool(huntId, toolId, { execRaw });
      if (res.ok) {
        try { await recordToolState(huntId, toolId, { running: true, installedVia: 'download_tool' }, { readMeta: ctx.readMeta, writeMeta: ctx.writeMeta }); } catch { /* best-effort */ }
        return { ok: true, observation: res.observation };
      }
      return { ok: false, observation: res.error };
    } catch (err) {
      return { ok: false, observation: `Tool install failed: ${err.message || err}` };
    }
  }

  if (kind === 'proxy_start') {
    // Start the intercept proxy + dashboard inside the hunter's own
    // container and route its Chromium through it. Idempotent — a
    // re-run only reports state. Touches only the hunter's own
    // machine; no traffic leaves.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'proxy_start is unavailable — no container exec.' };
    const ex = (h, c, t, o) => execRaw(h, c, t, o);
    const res = await startInterceptProxy(huntId, { exec: ex });
    return { ok: res.ok !== false, observation: res.observation || '(no observation)' };
  }

  if (kind === 'intercept_list') {
    // Read the hunter's own capture file. Read-only, like recall.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'intercept_list is unavailable — no container exec.' };
    const ex = (h, c, t, o) => execRaw(h, c, t, o);
    const res = await listIntercept(huntId, { exec: ex });
    return { ok: res.ok !== false, observation: res.observation || '(no observation)' };
  }

  if (kind === 'intercept_read') {
    // One captured flow in full. Read-only.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'intercept_read is unavailable — no container exec.' };
    const ex = (h, c, t, o) => execRaw(h, c, t, o);
    const res = await readInterceptEntry(huntId, action.index, { exec: ex });
    return { ok: res.ok !== false, observation: res.observation || '(no observation)' };
  }

  if (kind === 'intercept_replay') {
    // Burp-Repeater work: resend one captured request with the
    // brain's modifications. This DOES send traffic, so it is treated
    // exactly like a shell probe: scope-checked on the FINAL url
    // (a captured third-party request may not be replayed out of
    // programme) and executed through the same shell exec.
    if (typeof execRaw !== 'function') return { ok: false, observation: 'intercept_replay is unavailable — no container exec.' };
    if (typeof ctx.exec !== 'function') return { ok: false, observation: 'intercept_replay is unavailable — no shell exec.' };
    const ex = (h, c, t, o) => execRaw(h, c, t, o);
    const read = await readInterceptEntry(huntId, action.index, { exec: ex });
    if (!read.ok || !read.entry) {
      return { ok: false, observation: read.observation || 'That capture could not be read — run intercept_list and pick a real index.' };
    }
    const built = buildReplayRequest(read.entry.flow, { url: action.url, headers: action.headers, body: action.body });
    if (!built.ok) return { ok: false, observation: built.error };
    const badUrl = scopeViolation(built.url, target, ctx.parsedScope || null);
    if (badUrl) {
      return { ok: false, observation: `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. A replay may only be sent to ${target} and its listed assets. Nothing was sent.` };
    }
    try {
      const result = await ctx.exec(huntId, target, buildReplayCurl(built));
      const combined = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
      const statusLine = /^HTTP\/\S+ \d{3}[^\n]*/m.exec(combined);
      const head = `Replayed capture #${read.entry.index} as ${built.method} ${built.url} — ${statusLine ? statusLine[0] : 'no HTTP response received'}.`;
      let observation = combined ? `${head}\n${combined.slice(0, OBS_BUDGET)}` : `${head} (the replay produced no output)`;
      if (combined.length > OBS_BUDGET) observation += `\n[response truncated on screen — ${combined.length} chars total]`;
      if (result.code && result.code !== 0) observation += `\n[curl exit code ${result.code}]`;
      return { ok: true, observation };
    } catch (err) {
      return { ok: false, observation: `Replay failed to run: ${err.message || err}` };
    }
  }

  return { ok: false, observation: `Unknown OS-control action "${kind}".` };
}
