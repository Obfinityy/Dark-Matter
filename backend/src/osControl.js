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

import { captureDesktopScreenshot } from './desktopControl.js';
import { replaySignature } from './proxyIntercept.js';
import { handleBrowserSnapshot } from './osControl/browser.js';
import { handleScreenshot } from './osControl/browser.js';
import { handleDesktopSnapshot } from './osControl/desktop.js';
import { handleDesktopClick } from './osControl/desktop.js';
import { handleDesktopKey } from './osControl/desktop.js';
import { handleDesktopClickAt } from './osControl/desktop.js';
import { handleDesktopClickControl } from './osControl/desktop.js';
import { handleListControls } from './osControl/desktop.js';
import { handleDesktopScreenshot } from './osControl/desktop.js';
import { handleSeeScreen } from './osControl/desktop.js';
import { handleDesktopTerminal } from './osControl/desktop.js';
import { handleLaunchTool } from './osControl/tools.js';
import { handleDownloadTool } from './osControl/tools.js';
import { handleProxyStart } from './osControl/intercept.js';
import { handleInterceptList } from './osControl/intercept.js';
import { handleInterceptRead } from './osControl/intercept.js';
import { handleInterceptReplay } from './osControl/intercept.js';

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

  const c = {
    target,
    parsedScope: ctx.parsedScope,
    execRaw,
    exec: ctx.exec,
    gui,
    sleep,
    readMeta: ctx.readMeta,
    writeMeta: ctx.writeMeta,
    getDesktopScreenshot,
    getStartDesktop,
  };

  if (kind === 'browser_snapshot') return handleBrowserSnapshot(huntId, action, c);

  if (kind === 'screenshot') return handleScreenshot(huntId, action, c);

  if (kind === 'desktop_snapshot') return handleDesktopSnapshot(huntId, action, c);

  if (kind === 'desktop_click') return handleDesktopClick(huntId, action, c);

  if (kind === 'desktop_key') return handleDesktopKey(huntId, action, c);

  if (kind === 'desktop_click_at') return handleDesktopClickAt(huntId, action, c);

  if (kind === 'desktop_click_control') return handleDesktopClickControl(huntId, action, c);

  if (kind === 'list_controls') return handleListControls(huntId, action, c);

  if (kind === 'desktop_screenshot') return handleDesktopScreenshot(huntId, action, c);

  if (kind === 'see_screen') return handleSeeScreen(huntId, action, c);

  if (kind === 'desktop_terminal') return handleDesktopTerminal(huntId, action, c);

  if (kind === 'launch_tool') return handleLaunchTool(huntId, action, c);

  if (kind === 'download_tool') return handleDownloadTool(huntId, action, c);

  if (kind === 'proxy_start') return handleProxyStart(huntId, action, c);

  if (kind === 'intercept_list') return handleInterceptList(huntId, action, c);

  if (kind === 'intercept_read') return handleInterceptRead(huntId, action, c);

  if (kind === 'intercept_replay') return handleInterceptReplay(huntId, action, c);

  return { ok: false, observation: `Unknown OS-control action "${kind}".` };
}
