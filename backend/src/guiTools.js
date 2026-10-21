// Dark Matter — GUI tools for human mode.
//
// The hunter's "hands and eyes" on its own machine's desktop browser.
// The brain (dm-hunter, text-only) is the sole decision-maker; these
// tools only expose the browser as text (DOM snapshots) plus a PNG
// screenshot artifact — the same brain-hierarchy rule as the rest of
// the system (eyes report, the brain decides).
//
// MECHANISM (v1, chosen for robustness):
//   1. CDP mode — when the desktop Chromium in the hunt container is
//      running with --remote-debugging-port=9222 (the hunt-desktop
//      lane starts it that way), a small Node driver script is written
//      into the container (/tmp/dm-gui/cdp.mjs) and speaks CDP over
//      the container's localhost: Page.navigate, Runtime.evaluate for
//      the DOM snapshot / click / focus, Input.insertText for typing,
//      Page.captureScreenshot for the PNG. Node >= 22 in the image
//      provides global fetch + WebSocket, so the driver has zero
//      dependencies.
//   2. Headless fallback — no CDP endpoint but a chromium binary
//      exists (true of today's hunt image): browser_open records the
//      URL as the current page and eyes work via
//      `chromium --headless=new --dump-dom` / `--screenshot`.
//      Click/type need a live page, so they degrade to a clear
//      "needs the live desktop browser" observation.
//   3. Neither — every action returns a clear "desktop not
//      available" observation. Nothing throws; the hunter falls back
//      to shell + curl, exactly like a human whose browser won't open.
//
// All container access goes through an injectable exec with the
// execInHuntContainer signature (huntId, cmd, timeoutMs, opts), so
// tests can stub the machine entirely.

import fs from 'node:fs';
import path from 'node:path';
import { execInHuntContainer } from './huntRunner.js';
import { artifactsDir } from './artifacts.js';

const GUI_DIR = '/tmp/dm-gui';
const CDP_PORT = 9222;
const NOT_AVAILABLE =
  'Desktop/browser not available on this machine (no Chromium, no display, no CDP endpoint). That is a fixed property of this environment — not something to install your way out of. Work through the shell instead — curl shows you the same pages as text.';
// Lane D (21 Oct 2026, Ezviz audit): the earlier fallback wording said
// the desktop was "not up yet" / "not controllable yet". The hunter
// read that as a defect IT could fix and burned ~14 turns over 82
// minutes on apt-get install attempts (including invented packages)
// for a Chromium that was already installed. Fallback text must state
// plainly: look-only, environment-fixed, not hunter-fixable.

// ---------------------------------------------------------------------------
// In-container CDP driver (written on first use). Zero-dependency: Node's
// global fetch + WebSocket. Params arrive base64-encoded in DMGUI_P64 so
// shell quoting can never corrupt them.
// ---------------------------------------------------------------------------
const CDP_SCRIPT = `
const act = process.argv[2];
const params = JSON.parse(Buffer.from(process.env.DMGUI_P64 || 'e30=', 'base64').toString('utf8'));
const BASE = 'http://127.0.0.1:${CDP_PORT}';
const SNAP = \`(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const lab = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || el.name || el.id || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
  const els = [];
  document.querySelectorAll('a,button,input,select,textarea,[role="button"],[onclick]').forEach((el) => {
    if (!vis(el)) return;
    els.push({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '', label: lab(el), href: el.getAttribute('href') || '', id: el.id || '', name: el.getAttribute('name') || '', placeholder: el.getAttribute('placeholder') || '' });
  });
  return { url: location.href, title: document.title, text: (document.body ? document.body.innerText : '').slice(0, 6000), elements: els.slice(0, 60) };
})()\`;
async function getPage() {
  let list = await (await fetch(BASE + '/json/list')).json();
  let page = list.find((t) => t.type === 'page');
  if (!page) {
    try { await fetch(BASE + '/json/new?about:blank', { method: 'PUT' }); } catch {}
    list = await (await fetch(BASE + '/json/list')).json();
    page = list.find((t) => t.type === 'page');
  }
  if (!page) throw new Error('no page target on CDP endpoint');
  return page;
}
const page = await getPage();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP websocket failed')); });
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
  }
};
function send(method, params2 = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params: params2 }));
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('CDP timeout: ' + method)); } }, 20000);
  });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page JS error: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || 'evaluate failed'));
  return r.result ? r.result.value : undefined;
}
await send('Page.enable');
await send('Runtime.enable');
let out;
if (act === 'navigate') {
  await send('Page.navigate', { url: params.url });
  await new Promise((r) => setTimeout(r, 1800));
  out = await evaluate(SNAP);
} else if (act === 'snapshot') {
  out = await evaluate(SNAP);
} else if (act === 'click') {
  const expr = \`(() => {
    const want = \${JSON.stringify(params.text)}.toLowerCase();
    const raw = \${JSON.stringify(params.text)};
    let el = null;
    if (/^[#.\\[]/.test(raw)) { try { el = document.querySelector(raw); } catch {} }
    if (!el) {
      const cands = [...document.querySelectorAll('a,button,input,select,textarea,[role="button"],[onclick]')];
      const lab = (e) => (e.innerText || e.value || e.getAttribute('aria-label') || e.placeholder || e.name || e.id || '').trim().toLowerCase();
      el = cands.find((e) => lab(e) === want) || cands.find((e) => lab(e).includes(want));
    }
    if (!el) return { ok: false, error: 'no clickable element matches "' + raw + '"' };
    el.scrollIntoView({ block: 'center' });
    el.focus();
    el.click();
    return { ok: true, clicked: (el.innerText || el.value || el.id || el.tagName || '').trim().slice(0, 80), url: location.href };
  })()\`;
  const clicked = await evaluate(expr);
  await new Promise((r) => setTimeout(r, 1200));
  const snap = await evaluate(SNAP);
  out = { ...clicked, snapshot: snap };
} else if (act === 'type') {
  await evaluate(\`(() => {
    const editable = (e) => e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.isContentEditable);
    let el = document.activeElement;
    if (!editable(el)) {
      el = [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    }
    if (!el) return { ok: false, error: 'no typeable field found on this page' };
    el.scrollIntoView({ block: 'center' });
    el.focus();
    return { ok: true };
  })()\`);
  await send('Input.insertText', { text: params.text });
  if (params.submit) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise((r) => setTimeout(r, 1500));
  }
  const snap = await evaluate(SNAP);
  out = { ok: true, typed: params.text, snapshot: snap };
} else if (act === 'screenshot') {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  out = { screenshot_b64: shot.data || '' };
} else {
  throw new Error('unknown CDP action: ' + act);
}
console.log(JSON.stringify(out));
ws.close();
`;

// ---------------------------------------------------------------------------
// Probe + per-hunt cache. The desktop may appear after the hunt starts
// (the desktop lane starts it on demand), so a 'none' result is only
// cached briefly.
// ---------------------------------------------------------------------------
const probeCache = new Map(); // huntId -> { at, mode, chrome, display, scriptInstalled }
const PROBE_TTL_MS = 60 * 1000;

function resolveExec(deps) {
  return (deps && deps.exec) || ((h, c, t, o) => execInHuntContainer(h, c, t, o));
}

async function probeGui(huntId, deps = {}) {
  const exec = resolveExec(deps);
  const cached = probeCache.get(huntId);
  if (cached && Date.now() - cached.at < PROBE_TTL_MS && cached.mode !== 'none') return cached;
  let probe = { at: Date.now(), mode: 'none', chrome: '', display: false, scriptInstalled: cached ? cached.scriptInstalled : false };
  try {
    const cmd =
      `CHROME=$(command -v chromium || command -v chromium-browser || command -v google-chrome || command -v google-chrome-stable); ` +
      `CDP=$(curl -s --max-time 2 http://127.0.0.1:${CDP_PORT}/json/version); ` +
      `XS=$(ls /tmp/.X11-unix 2>/dev/null | head -1); ` +
      `echo "chrome=$CHROME"; echo "cdp=$CDP" | head -c 300; echo; echo "xsock=$XS"`;
    const r = await exec(huntId, cmd, 15000, { bypassTmux: true });
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    const chrome = (/chrome=(\S+)/.exec(out) || [])[1] || '';
    const hasCdp = /webSocketDebuggerUrl|"Browser"\s*:/.test(out);
    const display = /xsock=\S+/.test(out);
    probe = {
      at: Date.now(),
      mode: hasCdp ? 'cdp' : chrome ? 'headless' : 'none',
      chrome,
      display,
      scriptInstalled: probe.scriptInstalled,
    };
  } catch { /* probe failure = not available */ }
  probeCache.set(huntId, probe);
  return probe;
}

/** Test hook: forget cached probe state. */
export function resetGuiProbeCache() {
  probeCache.clear();
}

// ---------------------------------------------------------------------------
// Snapshot shaping — the model's "eyes". Same output shape for CDP and
// headless snapshots.
// ---------------------------------------------------------------------------
function formatSnapshot(snap, budgetChars = 4200) {
  if (!snap) return '(empty page snapshot)';
  const lines = [`Page: ${snap.title || '(untitled)'} — ${snap.url || ''}`, '--- visible text ---'];
  lines.push(String(snap.text || '').slice(0, 2600) || '(no visible text)');
  const els = Array.isArray(snap.elements) ? snap.elements : [];
  if (els.length) {
    lines.push('--- clickable / typeable elements (use the label EXACTLY with browser_click) ---');
    for (const el of els.slice(0, 40)) {
      const bits = [`[${el.tag}${el.type ? ' type=' + el.type : ''}]`];
      if (el.label) bits.push(`"${el.label}"`);
      if (el.placeholder && el.placeholder !== el.label) bits.push(`placeholder="${el.placeholder}"`);
      if (el.name) bits.push(`name=${el.name}`);
      if (el.id) bits.push(`id=${el.id}`);
      if (el.href) bits.push(`-> ${el.href}`);
      lines.push('- ' + bits.join(' '));
    }
  }
  return lines.join('\n').slice(0, budgetChars);
}

// Crude rendered-HTML -> snapshot for the headless --dump-dom fallback.
function snapshotFromHtml(html, url) {
  const text0 = String(html || '');
  const title = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(text0) || [])[1] || '').trim();
  const elements = [];
  const pushEl = (tag, attrs, inner) => {
    const get = (n) => ((new RegExp(`${n}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs) || [])[1] || '');
    const label = String(inner || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
      || get('value') || get('aria-label') || get('placeholder') || get('name') || get('id');
    elements.push({ tag, type: get('type'), label, href: get('href'), id: get('id'), name: get('name'), placeholder: get('placeholder') });
  };
  for (const m of text0.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) pushEl('a', m[1], m[2]);
  for (const m of text0.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) pushEl('button', m[1], m[2]);
  for (const m of text0.matchAll(/<input\b([^>]*?)>/gi)) pushEl('input', m[1], '');
  for (const m of text0.matchAll(/<textarea\b([^>]*)>/gi)) pushEl('textarea', m[1], '');
  const text = text0
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // JS/CSS banner comments that survive as text nodes in a DOM dump
    // (the Ezviz SPA leads with a long /*! ... @ezviz/ezd ... */ banner)
    // are not page content — they ate the head of every snapshot's
    // visible-text budget and taught the hunter the page was code.
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return { url, title, text: text.slice(0, 6000), elements: elements.slice(0, 60) };
}

// ---------------------------------------------------------------------------
// CDP plumbing
// ---------------------------------------------------------------------------
async function ensureCdpScript(huntId, exec, probe) {
  if (probe.scriptInstalled) return true;
  const b64 = Buffer.from(CDP_SCRIPT, 'utf8').toString('base64');
  const r = await exec(huntId, `mkdir -p ${GUI_DIR} && printf %s '${b64}' | base64 -d > ${GUI_DIR}/cdp.mjs && wc -c < ${GUI_DIR}/cdp.mjs`, 20000, { bypassTmux: true });
  const ok = r.code === 0 && Number(String(r.stdout).trim()) > 1000;
  if (ok) probe.scriptInstalled = true;
  return ok;
}

async function cdpAction(huntId, action, params, deps = {}) {
  const exec = resolveExec(deps);
  const probe = await probeGui(huntId, deps);
  if (probe.mode !== 'cdp') return null;
  if (!(await ensureCdpScript(huntId, exec, probe))) {
    return { ok: false, observation: 'The desktop browser is running but its control channel (CDP driver) could not be installed in the container.' };
  }
  const p64 = Buffer.from(JSON.stringify(params || {}), 'utf8').toString('base64');
  const r = await exec(huntId, `DMGUI_P64='${p64}' node ${GUI_DIR}/cdp.mjs ${action}`, 60000, { bypassTmux: true });
  const raw = String(r.stdout || '').trim();
  const line = raw.split('\n').filter(Boolean).pop() || '';
  try {
    return JSON.parse(line);
  } catch {
    return { ok: false, observation: `Browser control failed: ${String(r.stderr || raw || 'no output').slice(0, 300)}` };
  }
}

// Current-page state for the stateless headless fallback.
async function readState(huntId, exec) {
  try {
    const r = await exec(huntId, `cat ${GUI_DIR}/state.json 2>/dev/null`, 10000, { bypassTmux: true });
    return JSON.parse(String(r.stdout || '').trim() || '{}');
  } catch {
    return {};
  }
}
async function writeState(huntId, exec, state) {
  const b64 = Buffer.from(JSON.stringify(state), 'utf8').toString('base64');
  await exec(huntId, `mkdir -p ${GUI_DIR} && printf %s '${b64}' | base64 -d > ${GUI_DIR}/state.json`, 10000, { bypassTmux: true });
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

async function headlessSnapshot(huntId, url, deps = {}) {
  const exec = resolveExec(deps);
  const probe = await probeGui(huntId, deps);
  const chrome = probe.chrome || 'chromium';
  const r = await exec(
    huntId,
    `${chrome} --headless=new --no-sandbox --disable-gpu --virtual-time-budget=5000 --dump-dom ${shellQuote(url)} 2>/dev/null | head -c 400000`,
    60000,
    { bypassTmux: true }
  );
  return snapshotFromHtml(r.stdout || '', url);
}

async function savePngArtifact(huntId, b64) {
  const name = `screenshot-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}.png`;
  const file = path.join(artifactsDir(huntId), name);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return name;
}

// ---------------------------------------------------------------------------
// Public actions. Every one returns { ok, observation, artifact? } and
// NEVER throws — a broken desktop must degrade to text, not kill a hunt.
// ---------------------------------------------------------------------------
export async function guiBrowserOpen(huntId, url, deps = {}) {
  const exec = resolveExec(deps);
  try {
    const probe = await probeGui(huntId, deps);
    if (probe.mode === 'none') return { ok: false, observation: NOT_AVAILABLE };
    if (probe.mode === 'cdp') {
      const res = await cdpAction(huntId, 'navigate', { url }, deps);
      if (res && !res.observation) return { ok: true, observation: `Opened ${url} in your desktop browser.\n${formatSnapshot(res)}` };
      if (res) return res;
    }
    await writeState(huntId, exec, { currentUrl: url });
    const snap = await headlessSnapshot(huntId, url, deps);
    return {
      ok: true,
      observation:
        `Opened ${url} (headless preview — this browser is look-only: the clickable desktop is not running in this environment and nothing you install can change that. You can SEE pages here; to interact with a page, use shell + curl).\n` +
        formatSnapshot(snap),
    };
  } catch (err) {
    return { ok: false, observation: `browser_open failed: ${err.message || err}` };
  }
}

export async function guiBrowserSnapshot(huntId, deps = {}) {
  const exec = resolveExec(deps);
  try {
    const probe = await probeGui(huntId, deps);
    if (probe.mode === 'none') return { ok: false, observation: NOT_AVAILABLE };
    if (probe.mode === 'cdp') {
      const res = await cdpAction(huntId, 'snapshot', {}, deps);
      if (res && !res.observation) return { ok: true, observation: formatSnapshot(res) };
      if (res) return res;
    }
    const state = await readState(huntId, exec);
    if (!state.currentUrl) return { ok: false, observation: 'No page is open yet — use browser_open first.' };
    const snap = await headlessSnapshot(huntId, state.currentUrl, deps);
    return { ok: true, observation: formatSnapshot(snap) };
  } catch (err) {
    return { ok: false, observation: `browser_snapshot failed: ${err.message || err}` };
  }
}

export async function guiBrowserClick(huntId, text, deps = {}) {
  try {
    const probe = await probeGui(huntId, deps);
    if (probe.mode === 'none') return { ok: false, observation: NOT_AVAILABLE };
    if (probe.mode !== 'cdp') {
      return { ok: false, observation: 'Clicking needs the live desktop browser (CDP). It is not running in this environment and cannot be started or installed from inside the hunt — do not spend turns trying to fix it. Use browser_open/browser_snapshot to look, and shell + curl to act.' };
    }
    const res = await cdpAction(huntId, 'click', { text: String(text || '') }, deps);
    if (!res) return { ok: false, observation: NOT_AVAILABLE };
    if (res.observation) return res;
    if (res.ok === false) return { ok: false, observation: `Click failed: ${res.error || 'element not found'}. Take a browser_snapshot and use an exact label from it.` };
    return { ok: true, observation: `Clicked "${res.clicked || text}". The page now shows:\n${formatSnapshot(res.snapshot)}` };
  } catch (err) {
    return { ok: false, observation: `browser_click failed: ${err.message || err}` };
  }
}

export async function guiBrowserType(huntId, text, submit = false, deps = {}) {
  try {
    const probe = await probeGui(huntId, deps);
    if (probe.mode === 'none') return { ok: false, observation: NOT_AVAILABLE };
    if (probe.mode !== 'cdp') {
      return { ok: false, observation: 'Typing needs the live desktop browser (CDP). It is not running in this environment and cannot be started or installed from inside the hunt — do not spend turns trying to fix it. Use shell + curl to send data instead.' };
    }
    const res = await cdpAction(huntId, 'type', { text: String(text || ''), submit: Boolean(submit) }, deps);
    if (!res) return { ok: false, observation: NOT_AVAILABLE };
    if (res.observation) return res;
    if (res.ok === false) return { ok: false, observation: `Type failed: ${res.error || 'no field'}. Take a browser_snapshot first.` };
    return { ok: true, observation: `Typed ${JSON.stringify(String(text).slice(0, 120))}${submit ? ' and pressed Enter' : ''}. The page now shows:\n${formatSnapshot(res.snapshot)}` };
  } catch (err) {
    return { ok: false, observation: `browser_type failed: ${err.message || err}` };
  }
}

export async function guiBrowserScreenshot(huntId, deps = {}) {
  const exec = resolveExec(deps);
  try {
    const probe = await probeGui(huntId, deps);
    if (probe.mode === 'none') return { ok: false, observation: NOT_AVAILABLE };
    if (probe.mode === 'cdp') {
      const res = await cdpAction(huntId, 'screenshot', {}, deps);
      if (res && res.screenshot_b64) {
        const name = await savePngArtifact(huntId, res.screenshot_b64);
        const snapRes = await cdpAction(huntId, 'snapshot', {}, deps);
        const snapText = snapRes && !snapRes.observation ? formatSnapshot(snapRes) : '(page text unavailable)';
        return { ok: true, artifact: name, observation: `Screenshot saved as artifact ${name} in your hunt workspace (the owner watches this desktop live). What the page shows:\n${snapText}` };
      }
      if (res && res.observation) return res;
    }
    // Headless fallback: render the current page to PNG and pull it out.
    const state = await readState(huntId, exec);
    if (!state.currentUrl) return { ok: false, observation: 'No page is open yet — use browser_open first, then screenshot.' };
    const chrome = probe.chrome || 'chromium';
    const shotPath = `${GUI_DIR}/shot.png`;
    const r = await exec(
      huntId,
      `${chrome} --headless=new --no-sandbox --disable-gpu --window-size=1280,900 --screenshot=${shotPath} ${shellQuote(state.currentUrl)} 2>/dev/null; base64 -w0 ${shotPath} 2>/dev/null | head -c 3800000`,
      60000,
      { bypassTmux: true }
    );
    const b64 = String(r.stdout || '').trim();
    if (!b64) return { ok: false, observation: 'Screenshot failed: the headless browser produced no image.' };
    const name = await savePngArtifact(huntId, b64);
    const snap = await headlessSnapshot(huntId, state.currentUrl, deps);
    return { ok: true, artifact: name, observation: `Screenshot saved as artifact ${name} in your hunt workspace. What the page shows:\n${formatSnapshot(snap)}` };
  } catch (err) {
    return { ok: false, observation: `screenshot failed: ${err.message || err}` };
  }
}

/** One-call availability probe for callers that want the mode up front. */
export async function guiMode(huntId, deps = {}) {
  const probe = await probeGui(huntId, deps);
  return probe.mode;
}
