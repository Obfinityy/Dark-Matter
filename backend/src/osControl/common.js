// Split out of osControl.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; osControl.js re-exports the public names so callers are unchanged.

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

export const OBS_BUDGET = 3500; // chars of an action result shown on screen

export async function readDesktopState(huntId, execRaw) {
  const res = await execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
  return mergeDesktopState(emptyDesktopState(), parseDesktopWindows(String((res && res.stdout) || '')));
}

export function desktopDownObservation(errText) {
  return `The desktop is not running right now (xdotool could not reach display :99${errText ? `: ${String(errText).slice(0, 160)}` : ''}). Open a page with browser_open first — that starts the desktop — then take desktop_snapshot again.`;
}
