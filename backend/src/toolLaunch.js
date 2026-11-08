// Tools/OS autonomy (27 Oct 2026, owner order ~21:36 IST) — the brain
// uses tools like a human: it launches Burp Suite and Kali tools, works
// their GUIs, and downloads a missing tool when the task needs it.
//
// What already existed before this lane (and what it does NOT redo):
//   - the skill card (backend/skills/desktop-tools.md) tells the brain
//     WHICH tool fits which phase and that GUI apps launch from the
//     shell (`burpsuite &`) — knowledge, not an action.
//   - desktop_click / desktop_key / desktop_click_control /
//     desktop_click_at / see_screen let the brain focus a window, send
//     keys, press a NAMED control (AT-SPI), and click what the OCR
//     map shows — the hands, but no structured launch.
// What this lane adds:
//   (a) `launch_tool` — a NAMED tool from a registry (Burp first,
//       then ZAP, nmap, nikto, nuclei, sqlmap, ...). GUI tools are
//       launched detached, the driver WAITS for the window (Burp's
//       JVM is slow), and the observation is a fresh screen map
//       (AT-SPI control list first, OCR map as fallback). CLI tools
//       are verified present with their version. A repeat launch
//       just reports "already running" — it never spawns a second
//       copy. Every launch is logged like any other brain action
//       (dedupe-gated, Take-Control-paused, recorded in the ledger).
//   (b) `list_controls` — the AT-SPI control list of a window as
//       clickable map lines (the screenMap.js "second builder" the
//       OCR lane left unimplemented). The desktop_click_control prompt
//       already claimed the brain could list controls — no such
//       action existed; this is it. OCR-click stays the fallback.
//   (c) `download_tool` — install a MISSING tool from an allow-list
//       (apt packages, plus one pinned direct download). Anything
//       not on the list is refused BEFORE any exec. No silent large
//       downloads: direct downloads are size-capped, installs are
//       timeout-bounded, and everything is logged.
//   (d) Burp first-use — the first Burp launch in a hunt also walks
//       the first-run wizard, confirms the intercept proxy is
//       listening, opens the target in Burp's own browser, and
//       records {running, proxyUp, browserOpened, targetLoaded} in
//       the hunt memory (meta.tools). The brain only ever says
//       "launch burp"; the driver makes the launch actually work.
//
// Boundaries (standing owner decisions): authorised in-scope targets
// only, with scope/dedup/budget validation like any other brain
// action (30 Sep 2026: full Kali-machine access through a unified
// terminal-and-GUI workflow). No tool runs outside the hunt
// container. No URL ever comes from the brain for these actions —
// the Burp first-use target is the hunt's own target.

import { DESKTOP_DISPLAY, desktopKeyCommand, desktopTypeCommand } from './desktopControl.js';
import { listControlsCommand, clickControlCommand, parseAtspiOutput, shellQuote } from './desktopAtspi.js';
import { captureScreenMap, buildAtspiMap } from './screenMap.js';

// ---------------------------------------------------------------------------
// Registry. `launch` / `bin` are OUR strings, never brain input — the
// brain names an id, the registry supplies the command, so there is
// nothing to inject. Window titles are matched with xdotool search.
// ---------------------------------------------------------------------------

export const TOOL_REGISTRY = {
  burp: { id: 'burp', name: 'Burp Suite', kind: 'gui', launch: 'burpsuite', windowMatch: 'Burp Suite', proxyPort: 8080, readyWaitMs: 150000 },
  zap: { id: 'zap', name: 'OWASP ZAP', kind: 'gui', launch: 'zaproxy', windowMatch: 'ZAP', readyWaitMs: 120000 },
  wireshark: { id: 'wireshark', name: 'Wireshark', kind: 'gui', launch: 'wireshark', windowMatch: 'Wireshark', readyWaitMs: 60000 },
  nmap: { id: 'nmap', name: 'nmap', kind: 'cli', bin: 'nmap', versionFlag: '--version' },
  nikto: { id: 'nikto', name: 'nikto', kind: 'cli', bin: 'nikto', versionFlag: '-Version' },
  nuclei: { id: 'nuclei', name: 'nuclei', kind: 'cli', bin: 'nuclei', versionFlag: '-version' },
  sqlmap: { id: 'sqlmap', name: 'sqlmap', kind: 'cli', bin: 'sqlmap', versionFlag: '--version' },
  ffuf: { id: 'ffuf', name: 'ffuf', kind: 'cli', bin: 'ffuf', versionFlag: '-V' },
  gobuster: { id: 'gobuster', name: 'gobuster', kind: 'cli', bin: 'gobuster', versionFlag: 'version' },
};

export const TOOL_IDS = Object.keys(TOOL_REGISTRY);

// Burp's first-run wizard buttons, tried in order (AT-SPI click by
// name). EC2 lab, 27 Oct 2026, scratch container from the live
// image: the FIRST screen is the EULA ("Terms and Conditions" with
// Accept / Decline), then the EDITION chooser ("Continue with Burp
// Suite Community Edition" — v2026.9; the lane's first lab missed
// this page entirely, so the walk ended at the EULA and the proxy
// never started), then the project-setup pages ("Next" — it appears
// on more than one page), then "Start Burp". The walk is a loop (see
// burpFirstUse): each round clicks the first candidate that exists
// right now, and ends when a whole round finds nothing. If no
// candidate exists the wizard is already past — that is a success,
// not a failure.
export const BURP_WIZARD_CLICKS = ['Accept', 'I Accept', 'Continue with Burp Suite Community Edition', 'Start Burp', 'Next'];
// The wizard has at most 5 real pages (EULA, edition, project,
// config, start); 6 rounds bounds a click that keeps "succeeding".
export const BURP_WIZARD_MAX_CLICKS = 6;
// The button that opens Burp's embedded browser (Proxy > Intercept).
// NOT clicked by burpFirstUse: in this container (root) the button is
// a silent no-op — Burp launches its bundled Chromium without
// --no-sandbox and Chromium refuses to start as root (EC2 lab 27 Oct
// 2026). burpFirstUse launches the same binary directly instead (see
// burpBrowserLaunchCommand). Kept so the name stays in one place.
export const BURP_OPEN_BROWSER_CONTROL = 'Open Browser';

// ---------------------------------------------------------------------------
// Download allow-list. Apt packages are installed from Kali's repos;
// direct downloads are ONE pinned file each, size-capped. Anything
// not listed here is refused before any command runs.
// ---------------------------------------------------------------------------

export const MAX_DIRECT_DOWNLOAD_BYTES = 1048576; // 1 MB
export const DOWNLOAD_TIMEOUT_MS = 300000; // apt can be slow on first update

export const DOWNLOAD_REGISTRY = {
  subfinder: { id: 'subfinder', method: 'apt', package: 'subfinder', bin: 'subfinder', why: 'subdomain enumeration' },
  amass: { id: 'amass', method: 'apt', package: 'amass', bin: 'amass', why: 'subdomain enumeration + asset discovery' },
  dnsenum: { id: 'dnsenum', method: 'apt', package: 'dnsenum', bin: 'dnsenum', why: 'DNS enumeration' },
  whatweb: { id: 'whatweb', method: 'apt', package: 'whatweb', bin: 'whatweb', why: 'web technology fingerprinting' },
  'jwt-tool': {
    id: 'jwt-tool', method: 'direct',
    url: 'https://raw.githubusercontent.com/ticarpi/jwt_tool/master/jwt_tool.py',
    dest: 'jwt_tool.py', maxBytes: MAX_DIRECT_DOWNLOAD_BYTES, bin: 'jwt_tool.py',
    why: 'JWT attack toolkit (single-file Python, ~60 KB)',
  },
};

export const DOWNLOAD_IDS = Object.keys(DOWNLOAD_REGISTRY);

// ---------------------------------------------------------------------------
// Pure builders / parsers (unit-tested, no exec).
// ---------------------------------------------------------------------------

/** Normalise a brain-supplied tool id; null when it names nothing. */
export function normaliseToolId(raw) {
  const id = String(raw || '').trim().toLowerCase();
  return id || null;
}

/** Resolve a tool id against the registry. */
export function resolveTool(raw) {
  const id = normaliseToolId(raw);
  if (!id) return { ok: false, error: `no tool named — launch one of these: ${TOOL_IDS.join(', ')}` };
  const tool = TOOL_REGISTRY[id];
  if (!tool) return { ok: false, error: `"${id}" is not a known tool — launch one of these: ${TOOL_IDS.join(', ')}` };
  return { ok: true, tool };
}

/** Resolve a download id against the allow-list. */
export function resolveDownloadTool(raw) {
  const id = normaliseToolId(raw);
  if (!id) return { ok: false, error: `no tool named — installable tools are: ${DOWNLOAD_IDS.join(', ')}` };
  const entry = DOWNLOAD_REGISTRY[id];
  if (!entry) return { ok: false, error: `"${id}" is not installable — installable tools are: ${DOWNLOAD_IDS.join(', ')}. Anything else is refused before anything runs.` };
  return { ok: true, entry };
}

/** Detached GUI launch (log file per tool, so a failed start is diagnosable).
 * Two environment guards, both proven on EC2 27 Oct 2026:
 *   - DBUS_SESSION_BUS_ADDRESS from /tmp/dm-dbus-address (written by
 *     hunt-desktop.sh when the session starts): docker-exec shells do
 *     not inherit the session env, and without the address no GUI app
 *     can find the accessibility bus at all.
 *   - JAVA_TOOL_OPTIONS with the Java Access Bridge, only when the
 *     bridge files actually exist ([ -f ] follows symlinks, so the
 *     dangling libatk-wrapper.so symlink of the pre-fix image fails
 *     the guard and the app starts WITHOUT the bridge instead of
 *     dying with "Assistive Technology not found"). Same value as
 *     the Dockerfile ENV — keep them in sync. */
export const JAVA_BRIDGE_TOOL_OPTIONS = '-Djavax.accessibility.assistive_technologies=org.GNOME.Accessibility.AtkWrapper -Xbootclasspath/a:/usr/share/java/java-atk-wrapper.jar';
export function launchCommand(tool) {
  return `if [ -s /tmp/dm-dbus-address ]; then export DBUS_SESSION_BUS_ADDRESS="$(cat /tmp/dm-dbus-address)"; fi; if [ -f /usr/share/java/java-atk-wrapper.jar ] && [ -f /usr/lib/x86_64-linux-gnu/jni/libatk-wrapper.so ]; then export JAVA_TOOL_OPTIONS="${JAVA_BRIDGE_TOOL_OPTIONS}"; fi; DISPLAY=${DESKTOP_DISPLAY} nohup ${tool.launch} >/tmp/dm-tool-${tool.id}.log 2>&1 & echo started:$!`;
}

/** One xdotool probe for the tool's window (empty stdout = not up yet). */
export function windowPresentCommand(tool) {
  return `DISPLAY=${DESKTOP_DISPLAY} xdotool search --onlyvisible --name ${shellQuote(tool.windowMatch)} 2>/dev/null | head -1`;
}

/** A window id from the probe output, or null. */
export function parseWindowPresent(stdout) {
  const id = String(stdout || '').trim().split('\n').find((l) => /^\d+$/.test(l.trim()));
  return id ? id.trim() : null;
}

/** CLI presence + version probe. Marker on the last line when missing. */
export function cliCheckCommand(tool) {
  return `command -v ${tool.bin} >/dev/null 2>&1 && ${tool.bin} ${tool.versionFlag} 2>&1 | head -5 || echo __TOOL_MISSING__`;
}

/** True when the CLI probe found the binary. */
export function parseCliCheck(stdout) {
  const text = String(stdout || '');
  if (text.includes('__TOOL_MISSING__')) return { ok: false, version: '' };
  return { ok: true, version: text.trim().slice(0, 400) };
}

/** Install command for an allow-listed download (apt needs an update first — the image cleans its lists). */
export function downloadCommand(entry) {
  if (entry.method === 'apt') {
    return `(apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y ${entry.package}) 2>&1 | tail -12; command -v ${entry.bin} || echo __INSTALL_FAILED__`;
  }
  // Direct: one pinned file, size-capped, into the hunt workspace.
  return `curl -fsSL --max-filesize ${entry.maxBytes} -o ${entry.dest} ${entry.url} 2>&1 | tail -3; ls -l ${entry.dest} 2>/dev/null || echo __INSTALL_FAILED__`;
}

/** True when the install output shows the tool present. */
export function parseDownloadResult(entry, stdout) {
  const text = String(stdout || '');
  if (text.includes('__INSTALL_FAILED__')) return { ok: false, detail: text.trim().slice(-400) };
  if (entry.method === 'apt') return { ok: true, detail: `installed ${entry.package} (${entry.bin} is on PATH)` };
  const m = /(\d+)\s+\S+\s+\d+\s+\d+:\d+\s+\S+/.exec(text);
  return { ok: true, detail: `downloaded ${entry.dest} (${m ? `${m[1]} bytes` : 'size shown in listing'})` };
}

/** xdotool probe for visible Chromium windows (Burp's embedded browser is one). */
export function browserWindowIdsCommand() {
  return `DISPLAY=${DESKTOP_DISPLAY} xdotool search --onlyvisible --name 'Chromium' 2>/dev/null`;
}

/** Window ids from the probe output (numbers only, in listed order). */
export function parseWindowIds(stdout) {
  return String(stdout || '').split('\n').map((l) => l.trim()).filter((l) => /^\d+$/.test(l));
}

/** Bring a window to the front (waits until it is active). */
export function windowActivateCommand(id) {
  return `DISPLAY=${DESKTOP_DISPLAY} xdotool windowactivate --sync ${id} 2>/dev/null && echo activated || echo activate_failed`;
}

/** Burp's bundled browser binary, extracted by Burp on first run
 * (~/.BurpSuite/burpbrowser/<version>/chrome). Launch it directly:
 * Burp's "Open browser" button is a silent no-op in this container
 * (EC2 lab 27 Oct 2026, proven three ways — AT-SPI click, real mouse
 * click at the button's rect centre, 180s of watching: no window, no
 * process, no new tab): Burp launches its bundled Chromium WITHOUT
 * --no-sandbox, and as root Chromium refuses to start ("Running as
 * root without --no-sandbox is not supported"; the setuid
 * chrome-sandbox does not help here). So launch the same binary
 * ourselves, with the flags Burp itself would use plus --no-sandbox,
 * its own profile (so it does not merge into the driver's Chromium
 * session through the singleton lock), and Burp's intercept proxy —
 * the traffic is intercepted exactly as if Burp had opened it. */
export function burpBrowserLaunchCommand(port = 8080) {
  const p = Math.max(1, Number(port) || 8080);
  return `BROWSER_BIN=$(ls -dv ~/.BurpSuite/burpbrowser/*/chrome 2>/dev/null | tail -1); if [ -n "$BROWSER_BIN" ]; then DISPLAY=${DESKTOP_DISPLAY} nohup "$BROWSER_BIN" --user-data-dir=/tmp/dm-burp-browser --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run --proxy-server=127.0.0.1:${p} about:blank >/tmp/dm-burp-browser.log 2>&1 & echo browser_started:$!; else echo __NO_BURP_BROWSER__; fi`;
}

/** Parse the browser launch output. */
export function parseBurpBrowserLaunch(stdout) {
  const text = String(stdout || '');
  if (text.includes('__NO_BURP_BROWSER__')) return { ok: false, error: 'no Burp browser binary found (Burp extracts it on first run)' };
  if (/browser_started:\d+/.test(text)) return { ok: true };
  return { ok: false, error: 'Burp browser launch produced no output' };
}
export function proxyCheckCommand(port) {
  const p = Math.max(1, Number(port) || 8080);
  return `(ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -E ':${p}[[:space:]]' >/dev/null && echo proxy_up || echo proxy_down`;
}

/** True when the listener probe found the port. */
export function parseProxyCheck(stdout) {
  return String(stdout || '').includes('proxy_up');
}

/** Does the screen map show the target (its host in the address bar or page text)? Best-effort. */
export function mapShowsTarget(map, target) {
  let host = '';
  try { host = new URL(String(target || '')).hostname || ''; } catch { host = ''; }
  if (!host) return false;
  return String(map || '').toLowerCase().includes(host.toLowerCase());
}

// ---------------------------------------------------------------------------
// Orchestration (deps seam: { execRaw, sleep, readMeta, writeMeta }).
// execRaw(huntId, command, timeoutMs, opts) is the container exec the
// desktop branches already use; sleep is deps.sleep. Never throws —
// every failure is a { ok:false, error } the loop turns into an
// observation, never a crash.
// ---------------------------------------------------------------------------

const EXEC_OPTS = { bypassTmux: true };

async function execQuiet(huntId, command, timeoutMs, deps) {
  try {
    const res = await deps.execRaw(huntId, command, timeoutMs, EXEC_OPTS);
    return String((res && res.stdout) || '');
  } catch {
    return '';
  }
}

/**
 * Launch a GUI tool and wait for its window. Idempotent: a window
 * that is already up just reports its state (never a second copy).
 * Returns { ok, alreadyRunning, window, title, observation, via } —
 * via is 'atspi' (named controls), 'ocr' (screen map), or 'none'
 * (window up, screen unreadable). Never throws.
 */
export async function launchGuiTool(huntId, toolId, deps) {
  const resolved = resolveTool(toolId);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const tool = resolved.tool;
  if (tool.kind !== 'gui') return { ok: false, error: `"${tool.id}" is a CLI tool, not a GUI app — its version is checked with the same action, no window to wait for.` };
  const execRaw = deps?.execRaw;
  const sleep = deps?.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  if (typeof execRaw !== 'function') return { ok: false, error: 'exec_unavailable' };

  let windowId = parseWindowPresent(await execQuiet(huntId, windowPresentCommand(tool), 15000, deps));
  let alreadyRunning = Boolean(windowId);
  if (!windowId) {
    await execQuiet(huntId, launchCommand(tool), 15000, deps);
    const polls = Math.max(1, Math.ceil((tool.readyWaitMs || 60000) / 5000));
    for (let i = 0; i < polls && !windowId; i++) {
      await sleep(5000);
      windowId = parseWindowPresent(await execQuiet(huntId, windowPresentCommand(tool), 15000, deps));
    }
  }
  if (!windowId) {
    return { ok: false, error: `${tool.name} did not open a window within ${Math.round((tool.readyWaitMs || 60000) / 1000)}s — it may have failed to start (see /tmp/dm-tool-${tool.id}.log in the container) or the desktop may be down. Take desktop_snapshot to see the windows, then try again.` };
  }

  // The window is up — observe it: named controls first (AT-SPI),
  // the OCR screen map as fallback, plain state as last resort.
  let observation = '';
  let via = 'none';
  try {
    const listOut = await execQuiet(huntId, listControlsCommand(tool.windowMatch), 20000, deps);
    const parsed = parseAtspiOutput(listOut);
    if (parsed.ok && parsed.controls && parsed.controls.length) {
      observation = `${tool.name} is open (${tool.windowMatch}). Named controls — click one with desktop_click_control:\n${buildAtspiMap(parsed.controls)}`;
      via = 'atspi';
    }
  } catch { /* OCR fallback below */ }
  if (!observation) {
    try {
      const shot = await captureScreenMap(huntId, deps);
      if (shot.ok) {
        observation = `${tool.name} is open (${tool.windowMatch}). What the screen shows — click a point with desktop_click_at:\n${shot.map}`;
        via = 'ocr';
      }
    } catch { /* plain state below */ }
  }
  if (!observation) {
    observation = `${tool.name} is open (${tool.windowMatch}) but the screen could not be read (no accessibility tree and no OCR map). Take desktop_snapshot to see the windows.`;
  }
  if (alreadyRunning) observation = `${tool.name} is already running — no second copy started. ` + observation;
  return { ok: true, alreadyRunning, window: windowId, title: tool.windowMatch, observation, via };
}

/** Verify a CLI tool is present and report its version. */
export async function checkCliTool(huntId, toolId, deps) {
  const resolved = resolveTool(toolId);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const tool = resolved.tool;
  if (tool.kind !== 'cli') return { ok: false, error: `"${tool.id}" is a GUI app — launch it to open its window.` };
  if (typeof deps?.execRaw !== 'function') return { ok: false, error: 'exec_unavailable' };
  const out = await execQuiet(huntId, cliCheckCommand(tool), 15000, deps);
  const parsed = parseCliCheck(out);
  if (!parsed.ok) {
    const dl = DOWNLOAD_REGISTRY[tool.id];
    return { ok: false, error: `${tool.name} is not installed in this image${dl ? ` — install it with {"action":"download_tool","tool":"${tool.id}"}` : ' — and it is not on the install allow-list, so it cannot be fetched from here'}.` };
  }
  return { ok: true, version: parsed.version, observation: `${tool.name} is ready:\n${parsed.version}` };
}

/** Install an allow-listed missing tool. Refuses unknown ids before any exec. */
export async function downloadTool(huntId, toolId, deps) {
  const resolved = resolveDownloadTool(toolId);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  if (typeof deps?.execRaw !== 'function') return { ok: false, error: 'exec_unavailable' };
  const entry = resolved.entry;
  const out = await execQuiet(huntId, downloadCommand(entry), DOWNLOAD_TIMEOUT_MS, deps);
  const parsed = parseDownloadResult(entry, out);
  if (!parsed.ok) return { ok: false, error: `Install of ${entry.id} failed (${entry.method}) — the install output ended: ${parsed.detail.slice(0, 300)}` };
  return { ok: true, detail: parsed.detail, observation: `${entry.id} installed (${entry.method}, ${entry.why}): ${parsed.detail}. It stays installed in this container — run it with a shell action.` };
}

/** List a window's named controls as clickable map lines (AT-SPI). */
export async function listToolControls(huntId, windowSub, deps) {
  if (typeof deps?.execRaw !== 'function') return { ok: false, error: 'exec_unavailable' };
  const out = await execQuiet(huntId, listControlsCommand(String(windowSub || '').trim()), 20000, deps);
  const parsed = parseAtspiOutput(out);
  if (!parsed.ok) {
    return { ok: false, error: `${parsed.error} — fall back to see_screen and desktop_click_at (OCR map) to work inside the window.` };
  }
  if (!parsed.controls || !parsed.controls.length) {
    return { ok: false, error: `The window${windowSub ? ` "${windowSub}"` : ''} exposes no named controls right now — it may only expose a tree while focused. Focus it with desktop_click first, then list again, or use see_screen and desktop_click_at.` };
  }
  return {
    ok: true,
    count: parsed.controls.length,
    windows: parsed.windows || [],
    map: buildAtspiMap(parsed.controls),
    observation: `Controls in ${windowSub ? `"${windowSub}"` : 'the active window'} (${parsed.controls.length}) — click one with desktop_click_control:\n${buildAtspiMap(parsed.controls)}`,
  };
}

/**
 * Record tool state in the hunt memory (meta.tools, checkpoint-merge
 * write — never a full meta write, which could race the running
 * loop's own checkpoint writes). Best-effort: returns the stored
 * state or null when no meta seam is present.
 */
export async function recordToolState(huntId, toolId, patch, deps) {
  const readMeta = deps?.readMeta;
  const writeMeta = deps?.writeMeta;
  if (typeof readMeta !== 'function' || typeof writeMeta !== 'function') return null;
  try {
    const meta = readMeta(huntId) || {};
    const tools = { ...((meta.tools && typeof meta.tools === 'object') ? meta.tools : {}) };
    tools[toolId] = { ...(tools[toolId] || {}), ...patch, at: new Date().toISOString() };
    writeMeta(huntId, { tools });
    return tools[toolId];
  } catch {
    return null;
  }
}

/** Has this hunt already done Burp first-use (recorded in meta.tools)? */
export function burpFirstUseDone(meta) {
  return Boolean(meta && meta.tools && meta.tools.burp && meta.tools.burp.firstUseDone === true);
}

/**
 * Burp first-use, end to end: launch Burp, walk the first-run
 * wizard, confirm the intercept proxy is listening, open the target
 * in Burp's own browser, and record the state in the hunt memory.
 * Steps that fail degrade honestly — a failed browser-open never
 * pretends the proxy is down, and a missing accessibility tree
 * falls back to the OCR map + coordinate clicks. Returns
 * { ok, state, notes, observation } where ok means Burp is running
 * AND the proxy is up (the interceptable part); browserOpened /
 * targetLoaded are reported separately. Never throws.
 */
export async function burpFirstUse(huntId, target, deps) {
  const sleep = deps?.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const notes = [];
  const state = { running: false, proxyUp: false, browserOpened: false, targetLoaded: false, wizardHandled: false, firstUseDone: false };

  const launched = await launchGuiTool(huntId, 'burp', deps);
  if (!launched.ok) return { ok: false, state, notes, error: launched.error };
  state.running = true;
  notes.push(`Burp window up (${launched.via === 'atspi' ? 'accessibility tree' : launched.via === 'ocr' ? 'OCR map' : 'window only'})`);
  const launchObservation = String(launched.observation || '');

  // (1) First-run wizard: a multi-page walk — EULA ("Accept")
  // first, then the project-setup pages ("Next" appears on more
  // than one page), then "Start Burp". Each round clicks the first
  // candidate that exists right now; the walk ends when a whole
  // round finds nothing (wizard done, or no accessibility tree).
  const wizardClicked = [];
  for (let round = 0; round < BURP_WIZARD_MAX_CLICKS; round++) {
    let clicked = null;
    for (const name of BURP_WIZARD_CLICKS) {
      const out = await execQuiet(huntId, clickControlCommand(name, 'Burp Suite'), 20000, deps);
      if (parseAtspiOutput(out).ok) { clicked = name; break; }
    }
    if (!clicked) break;
    wizardClicked.push(clicked);
    state.wizardHandled = true;
    notes.push(`wizard: clicked "${clicked}"`);
    await sleep(3000);
  }
  if (!state.wizardHandled) notes.push('wizard: no "Accept"/"Start Burp"/"Next" button found — already past it, or AT-SPI unavailable');

  // (2) Intercept proxy listening on 127.0.0.1:8080 (poll — the
  // listener comes up after the JVM finishes starting Burp; EC2 lab
  // 27 Oct 2026: ~60s on a loaded box, so poll a full minute).
  for (let i = 0; i < 12 && !state.proxyUp; i++) {
    if (i > 0) await sleep(5000);
    const out = await execQuiet(huntId, proxyCheckCommand(8080), 15000, deps);
    state.proxyUp = parseProxyCheck(out);
  }
  notes.push(state.proxyUp ? 'proxy listening on 127.0.0.1:8080' : 'proxy NOT listening after 60s');

  // (3) Open the target in Burp's own browser (direct launch — see
  // burpBrowserLaunchCommand for why the "Open Browser" button is
  // not clicked). Snapshot the Chromium windows FIRST: the hunt's
  // own driver browser is also a Chromium window, so the new one is
  // the id that appears only AFTER the launch.
  const beforeIds = new Set(parseWindowIds(await execQuiet(huntId, browserWindowIdsCommand(), 15000, deps)));
  const launchOut = await execQuiet(huntId, burpBrowserLaunchCommand(8080), 20000, deps);
  const browserLaunch = parseBurpBrowserLaunch(launchOut);
  const browserOpened = browserLaunch.ok;
  if (!browserLaunch.ok) {
    notes.push(`Burp browser could not be launched (${browserLaunch.error}) — open it from Proxy > Intercept`);
  }
  // The Burp browser opens as its own Chromium window, which is NOT
  // necessarily the active window (EC2 lab 27 Oct 2026: Burp's main
  // window stayed active, so ctrl+l went to Burp, not the browser).
  // Wait for the NEW Chromium window and activate it before typing.
  // Chromium's cold start is slow (EC2 lab run 3: no window 30s
  // after a successful launch) — poll a full 90s before giving up.
  let browserWindow = null;
  if (browserOpened) {
    for (let i = 0; i < 18 && !browserWindow; i++) {
      if (i > 0) await sleep(5000);
      const ids = parseWindowIds(await execQuiet(huntId, browserWindowIdsCommand(), 15000, deps));
      browserWindow = ids.find((id) => !beforeIds.has(id)) || null;
    }
    if (browserWindow) {
      await execQuiet(huntId, windowActivateCommand(browserWindow), 15000, deps);
    }
  }
  if (browserOpened && browserWindow) {
    state.browserOpened = true;
    notes.push('Burp browser opened');
    await sleep(2000);
    // Navigate: address bar, type the target, Return — then look.
    try {
      await execQuiet(huntId, desktopKeyCommand('ctrl+l'), 15000, deps);
      await execQuiet(huntId, desktopTypeCommand(String(target || '').slice(0, 500)), 15000, deps);
      await execQuiet(huntId, desktopKeyCommand('Return'), 15000, deps);
      await sleep(5000);
      const shot = await captureScreenMap(huntId, deps);
      if (shot.ok && mapShowsTarget(shot.map, target)) {
        state.targetLoaded = true;
        notes.push('target visible in Burp browser');
      } else {
        notes.push('target typed in Burp browser — page text not confirmed on screen');
      }
    } catch {
      notes.push('navigation keys failed — Burp browser is open, type the target yourself');
    }
  } else if (browserOpened) {
    notes.push('Burp browser launched but its window never appeared within 90s — it may still be starting; open it from Proxy > Intercept');
  }
  // (when the launch itself failed, the note above already says so)

  state.firstUseDone = state.running && state.proxyUp;
  const observation =
    `Burp first-use: ${state.running ? 'running' : 'NOT running'} · proxy ${state.proxyUp ? 'listening on 127.0.0.1:8080' : 'NOT listening'} · Burp browser ${state.browserOpened ? 'opened' : 'not opened'} · target ${state.targetLoaded ? 'visible in the Burp browser' : 'not confirmed on screen'}. ` +
    `(${notes.join('; ')}) ` +
    (state.proxyUp
      ? 'The target is interceptable through Burp now — work the flow in the Burp browser and use desktop_click_control / desktop_key inside Burp.'
      : 'Burp is up but the proxy is not listening yet — wait a cycle and check again, or restart Burp from the shell.') +
    (launchObservation ? `\n${launchObservation}` : '');
  return { ok: state.running && state.proxyUp, state, notes, observation };
}
