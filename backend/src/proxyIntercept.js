// Dark Matter — Proxy Intercept via mitmproxy (Lane U, 23 Oct 2026).
//
// Burp-style intercept workflow for the human-mode hunter, built on
// the topology the product actually has:
//
//   The hunter's browser lives INSIDE its per-hunt container, so the
//   intercepting proxy must live there too. (The previous version of
//   this file spawned mitmproxy on the HOST, where no hunt traffic
//   ever flows, kept its state in a process Map that died with the
//   backend, and read captures back by re-running mitmdump over a
//   binary flow file. It was referenced nowhere — dead code. This
//   rewrite replaces it in place; nothing imported the old API.)
//
//   - mitmweb runs inside the container: a real intercepting proxy
//     on 127.0.0.1:8080 plus its web dashboard on 127.0.0.1:8081,
//     which the hunter opens in its own Chromium (visible in the
//     owner's live PiP) to click through captured requests.
//   - A tiny addon (src/intercept/mitm_capture_addon.py, injected
//     into the container at start — the guiTools CDP-script pattern)
//     appends every completed flow as one JSON line to a per-hunt
//     capture file; the backend reads it with docker exec, the same
//     transport as every other container read.
//   - The proxy is PASSIVE (mitmproxy regular mode): requests are
//     captured, never held for approval. Burp's hold-and-release
//     queue would stall an autonomous browser on every request;
//     inspection + replay from the capture is the workflow here.
//
// Scope law is unchanged: this module never decides where traffic
// may go. humanLoop checks the final URL of every replay against
// the hunt's parsedScope before anything is sent, exactly as it
// does for shell and browser actions.

import fs from 'node:fs';

export const INTERCEPT_DIR = '/tmp/dm-intercept';
export const CAPTURE_PATH = `${INTERCEPT_DIR}/capture.jsonl`;
export const ADDON_PATH = `${INTERCEPT_DIR}/addon.py`;
export const PROXY_MARKER_PATH = `${INTERCEPT_DIR}/proxy.on`;
export const MITM_PID_PATH = `${INTERCEPT_DIR}/mitmweb.pid`;
export const MITM_LOG_PATH = `${INTERCEPT_DIR}/mitmweb.log`;
export const PROXY_PORT = 8080;
export const WEB_PORT = 8081;
export const PROXY_URL = `http://127.0.0.1:${PROXY_PORT}`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

const TAIL_LINES = 60; // capture lines read per list call
export const LIST_LIMIT = 15; // flows rendered per intercept_list
const READ_BODY_CAP = 1500; // chars of a body shown by intercept_read
const HEADER_LINE_CAP = 40; // header lines shown per message in a read

// Chromium flags mirror docker/hunt-desktop.sh exactly — the
// relaunched browser must be the same browser (same CDP endpoint),
// only routed through the proxy.
const CHROMIUM_FLAGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--start-maximized',
  '--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=9222',
];

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

const clip = (s, n) => {
  const t = String(s ?? '');
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// ---------------------------------------------------------------------------
// Pure capture shaping (unit-tested without Docker)
// ---------------------------------------------------------------------------

/** Parse one capture line; null when the line is not a flow record. */
export function parseCaptureLine(line) {
  const t = String(line || '').trim();
  if (!t) return null;
  try {
    const obj = JSON.parse(t);
    if (!obj || typeof obj !== 'object' || typeof obj.method !== 'string' || typeof obj.url !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * Assign absolute indices to capture lines: line i of the file is
 * capture #i, forever (the file is append-only). Unparseable lines
 * consume an index but produce no entry, so an index the hunter was
 * shown can never silently point at a different request later.
 * `lines` are the raw lines read; `startIndex` is the absolute
 * index of lines[0] (nonzero when the read was a tail window).
 * Returns [{ index, flow }] ascending.
 */
export function indexCaptureLines(lines, startIndex = 0) {
  const out = [];
  (lines || []).forEach((line, i) => {
    const flow = parseCaptureLine(line);
    if (flow) out.push({ index: startIndex + i, flow });
  });
  return out;
}

/** Parse a whole JSONL capture text into indexed entries. */
export function parseCaptureJsonl(text, startIndex = 0) {
  return indexCaptureLines(String(text || '').split('\n'), startIndex);
}

function headerPairs(headers) {
  const pairs = [];
  for (const [k, v] of Object.entries(headers || {})) {
    if (Array.isArray(v)) for (const one of v) pairs.push([k, String(one)]);
    else pairs.push([k, String(v)]);
  }
  return pairs;
}

function headerLines(headers, cap = HEADER_LINE_CAP) {
  const pairs = headerPairs(headers);
  const lines = pairs.slice(0, cap).map(([k, v]) => `${k}: ${clip(v, 300)}`);
  if (pairs.length > cap) lines.push(`… and ${pairs.length - cap} more header(s)`);
  return lines;
}

/** intercept_list observation for indexed entries (ascending). */
export function shapeInterceptList(entries, { total = null, limit = LIST_LIMIT } = {}) {
  const all = entries || [];
  const shown = all.slice(-limit);
  const totalCount = total == null ? all.length : total;
  if (!shown.length) {
    return 'The intercept capture is empty — no completed requests captured yet. Start the proxy with {"action":"proxy_start"}, then browse the target in your browser: every request and response is captured as you go.';
  }
  const lines = [
    `Captured requests — newest last. The # is the index for intercept_read and intercept_replay (${totalCount} captured in total):`,
  ];
  for (const { index, flow } of shown) {
    lines.push(`#${index} ${flow.method} ${flow.status == null ? '?' : flow.status} ${clip(flow.url, 110)} — resp ${flow.resp_len ?? 0} B${flow.req_len ? `, req body ${flow.req_len} B` : ''}`);
  }
  if (all.length > shown.length || totalCount > shown.length) {
    lines.push(`(showing the last ${shown.length} — older captures stay in the file; read any of them by index)`);
  }
  return lines.join('\n');
}

/** intercept_read observation for one indexed entry. */
export function shapeInterceptRead(entry) {
  const { index, flow } = entry || {};
  if (!flow) return 'That capture does not exist.';
  const lines = [
    `Captured request #${index} — ${flow.ts || ''}`,
    `${flow.method} ${flow.url} → ${flow.status == null ? '(no response)' : `HTTP ${flow.status}`}`,
    '--- request headers ---',
    ...(headerLines(flow.req_headers).length ? headerLines(flow.req_headers) : ['(none)']),
    `--- request body (${flow.req_len ?? 0} bytes${flow.req_body_truncated ? ', capture holds the first 4096 chars' : ''}) ---`,
    flow.req_body ? clip(flow.req_body, READ_BODY_CAP) : '(empty)',
    '--- response headers ---',
    ...(headerLines(flow.resp_headers).length ? headerLines(flow.resp_headers) : ['(none)']),
    `--- response body (${flow.resp_len ?? 0} bytes total, showing up to ${READ_BODY_CAP} chars) ---`,
    flow.resp_body ? clip(flow.resp_body, READ_BODY_CAP) : '(empty)',
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Replay construction (pure)
// ---------------------------------------------------------------------------

const HOP_BY_HOP = new Set([
  'host', 'content-length', 'connection', 'keep-alive', 'proxy-connection',
  'transfer-encoding', 'te', 'trailer', 'proxy-authorization',
  'proxy-authenticate', 'upgrade',
]);

/**
 * Build the effective replay request from a captured flow plus the
 * hunter's modifications ({ url?, headers?, body? }). Header mods
 * replace same-named headers case-insensitively; a null value
 * removes the header. Returns { ok, method, url, headers, body } or
 * { ok: false, error } — a captured body the addon had to truncate
 * cannot be replayed verbatim (it would send corrupted bytes as if
 * they were the real request), so it demands an explicit body.
 */
export function buildReplayRequest(flow, mods = {}) {
  if (!flow || typeof flow.url !== 'string') {
    return { ok: false, error: 'That capture does not exist — run intercept_list and pick a real index.' };
  }
  let body = null;
  if ((flow.req_len ?? 0) > 0 || flow.req_body) {
    if (flow.req_body_truncated && (mods.body === undefined || mods.body === null)) {
      return {
        ok: false,
        error: `The captured request body was ${flow.req_len} bytes and the capture only stored its first 4096 chars, so it cannot be replayed verbatim. Pass the full "body" you want to send in the replay action, or re-capture the request.`,
      };
    }
    body = flow.req_body || '';
  }
  if (mods.body !== undefined && mods.body !== null) body = String(mods.body);
  let pairs = headerPairs(flow.req_headers);
  const modHeaders = mods.headers && typeof mods.headers === 'object' ? mods.headers : {};
  for (const [k, v] of Object.entries(modHeaders)) {
    const name = String(k);
    pairs = pairs.filter(([pk]) => pk.toLowerCase() !== name.toLowerCase());
    if (v !== null && v !== undefined) pairs.push([name, String(v)]);
  }
  return {
    ok: true,
    method: String(flow.method || 'GET').toUpperCase(),
    url: mods.url ? String(mods.url) : flow.url,
    headers: pairs,
    body,
  };
}

/** Render a built replay request as one curl command (all args quoted). */
export function buildReplayCurl(req) {
  const parts = ['curl', '-s', '-i', '--max-time', '25', '-X', req.method];
  for (const [k, v] of req.headers || []) {
    if (HOP_BY_HOP.has(String(k).toLowerCase())) continue;
    parts.push('-H', shellQuote(`${k}: ${v}`));
  }
  if (req.body !== null && req.body !== undefined) parts.push('--data-raw', shellQuote(req.body));
  parts.push(shellQuote(req.url));
  return parts.join(' ');
}

/**
 * The canonical identity of a replay action, shared by the dedupe
 * gate, the tool_call record and the session journal so all three
 * judge the same bytes: which capture, to which final URL, with
 * which header mods and body. Pure over the raw action object.
 */
export function replaySignature(action) {
  const a = action || {};
  const idx = Number.isInteger(a.index) ? a.index : (a.index == null ? null : Number(a.index));
  const modHeaders = a.headers && typeof a.headers === 'object' ? a.headers : {};
  const h = Object.entries(modHeaders)
    .map(([k, v]) => [String(k).toLowerCase(), v == null ? '' : String(v)])
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
  return JSON.stringify({ i: Number.isFinite(idx) ? idx : null, u: a.url ? String(a.url) : '', h, b: a.body == null ? '' : String(a.body) });
}

// ---------------------------------------------------------------------------
// Container operations. `exec` has the execInHuntContainer signature
// (huntId, cmd, timeoutMs, opts) — injectable, like guiTools.
// ---------------------------------------------------------------------------

let addonCache = null; // { b64, size } — the repo file, read once
function addonPayload() {
  if (!addonCache) {
    const src = fs.readFileSync(new URL('./intercept/mitm_capture_addon.py', import.meta.url), 'utf8');
    addonCache = { b64: Buffer.from(src, 'utf8').toString('base64'), size: Buffer.byteLength(src, 'utf8') };
  }
  return addonCache;
}

/** Write the capture addon into the container when missing/stale. */
export async function ensureInterceptAddon(huntId, exec) {
  const { b64, size } = addonPayload();
  const probe = await exec(huntId, `wc -c < ${ADDON_PATH} 2>/dev/null || echo 0`, 10000, { bypassTmux: true });
  if (Number(String(probe.stdout || '').trim()) === size) return true;
  const r = await exec(
    huntId,
    `mkdir -p ${INTERCEPT_DIR} && printf %s '${b64}' | base64 -d > ${ADDON_PATH} && wc -c < ${ADDON_PATH}`,
    20000,
    { bypassTmux: true },
  );
  return Number(String(r.stdout || '').trim()) === size;
}

async function proxyAlive(huntId, exec) {
  const r = await exec(
    huntId,
    `P=$(cat ${MITM_PID_PATH} 2>/dev/null); if [ -n "$P" ] && kill -0 "$P" 2>/dev/null; then echo alive; else echo dead; fi`,
    10000,
    { bypassTmux: true },
  );
  return String(r.stdout || '').includes('alive');
}

/**
 * The dashboard URL mitmweb printed into its log, or null when the
 * log has no URL yet. The printed URL carries the access token —
 * the bare WEB_URL root answers 403 without it. This is the single
 * log-parsing helper: dashboardUrl (display) and the start
 * readiness probe both read the log through here, so they can
 * never disagree about what the URL is.
 */
async function loggedDashboardUrl(huntId, exec) {
  try {
    const r = await exec(
      huntId,
      `grep -oE 'https?://127\\.0\\.0\\.1:${WEB_PORT}[^[:space:]"<>]*' ${MITM_LOG_PATH} 2>/dev/null | head -1`,
      10000,
      { bypassTmux: true },
    );
    const url = String(r.stdout || '').trim().split('\n')[0];
    return url || null;
  } catch {
    return null;
  }
}

async function dashboardUrl(huntId, exec) {
  return (await loggedDashboardUrl(huntId, exec)) || WEB_URL;
}

/**
 * One HTTP status probe inside the container; '' when curl itself
 * produced nothing, '000' when nothing answered (connection refused
 * prints 000 — an HTTP status line it is not).
 */
async function httpStatus(huntId, exec, url) {
  const probe = await exec(
    huntId,
    `curl -s --max-time 2 -o /dev/null -w '%{http_code}' ${shellQuote(url)} || true`,
    10000,
    { bypassTmux: true },
  );
  return String(probe.stdout || '').trim();
}

const NOT_INSTALLED =
  'mitmproxy is NOT installed on this machine. It ships in the standard hunt image, so this machine\'s image predates it — a fixed property of this environment, not something to install your way out of mid-hunt. Keep working through your browser and shell/curl, which see the same traffic less conveniently, and note the gap in a note to self.';

/**
 * Start the intercept proxy + dashboard inside the hunt container
 * (idempotent) and route the hunt Chromium through it. Returns
 * { ok, observation, alreadyRunning?, webUrl? } — never throws.
 */
export async function startInterceptProxy(huntId, deps = {}) {
  const exec = deps.exec;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  if (typeof exec !== 'function') return { ok: false, observation: 'Intercept proxy unavailable: no container exec wired.' };
  try {
    const which = await exec(huntId, 'command -v mitmweb || true', 10000, { bypassTmux: true });
    if (!String(which.stdout || '').trim()) {
      return { ok: false, installed: false, observation: NOT_INSTALLED };
    }
    if (await proxyAlive(huntId, exec)) {
      const webUrl = await dashboardUrl(huntId, exec);
      const count = await captureCount(huntId, exec);
      return {
        ok: true,
        alreadyRunning: true,
        webUrl,
        observation:
          `The intercept proxy is already running on this machine (dashboard: ${webUrl}). Your browser routes through it and ${count} request(s) are captured so far. ` +
          'Use {"action":"intercept_list"} to see them, {"action":"intercept_read","index":N} to read one in full, {"action":"intercept_replay","index":N} to resend one with changes.',
      };
    }
    if (!(await ensureInterceptAddon(huntId, exec))) {
      return { ok: false, observation: 'The intercept capture addon could not be written into this machine — the proxy was not started. Keep hunting through the browser and shell.' };
    }
    // One process: mitmweb IS the proxy (listen 8080) + dashboard
    // (8081) + our capture addon — the dashboard and the capture
    // file always show the same flows. PYTHONUNBUFFERED is load
    // bearing: without it Python block-buffers mitmweb's stdout when
    // it is redirected to the log file, the "Web server listening
    // at …" line (which carries the dashboard token URL) may not
    // land for minutes, and both the readiness probe and
    // dashboardUrl read that log — the start looks dead on a
    // healthy proxy (live-proven 23 Oct 2026).
    const start = await exec(
      huntId,
      `mkdir -p ${INTERCEPT_DIR} && printf %s ${shellQuote(PROXY_URL)} > ${PROXY_MARKER_PATH} && ` +
      `DM_CAPTURE_FILE=${CAPTURE_PATH} PYTHONUNBUFFERED=1 nohup mitmweb --listen-host 127.0.0.1 --listen-port ${PROXY_PORT} ` +
      `--web-host 127.0.0.1 --web-port ${WEB_PORT} --no-web-open-browser ` +
      `-s ${ADDON_PATH} --set confdir=${INTERCEPT_DIR}/conf >${MITM_LOG_PATH} 2>&1 & echo $! > ${MITM_PID_PATH}; echo launched`,
      20000,
      { bypassTmux: true },
    );
    if (start.containerMissing) {
      return { ok: false, observation: 'Your hunt machine (container) is not running, so the intercept proxy cannot start.' };
    }
    // Wait for the dashboard to answer (the proxy listens with
    // it). Probe the TOKEN URL from the log when it is there — that
    // is the URL that answers 2xx. The bare root never can:
    // mitmweb answers / without its token with 403 (the SPA shell
    // behind an auth wall), so the old 2xx/3xx-on-/ probe reported
    // "failed to start" on a healthy proxy (live-proven 23 Oct
    // 2026). Any HTTP answer from / — the 403 included — still
    // proves the server is listening, so keep polling for the URL
    // while it is missing and declare failure only when the whole
    // budget passes in total silence (no token-URL success AND no
    // HTTP response from / at all).
    let up = false;
    let heardHttp = false;
    for (let i = 0; i < 15 && !up; i++) {
      const logged = await loggedDashboardUrl(huntId, exec);
      const code = await httpStatus(huntId, exec, logged || `${WEB_URL}/`);
      if (/^[23]\d\d$/.test(code)) up = true;
      else if (/^\d{3}$/.test(code) && code !== '000') heardHttp = true;
      if (!up) await sleep(1000);
    }
    if (!up && heardHttp) up = true;
    if (!up || !(await proxyAlive(huntId, exec))) {
      const tail = await exec(huntId, `tail -n 5 ${MITM_LOG_PATH} 2>/dev/null`, 10000, { bypassTmux: true }).catch(() => ({ stdout: '' }));
      return {
        ok: false,
        observation: `The intercept proxy failed to start on this machine. Its log tail: ${clip(String(tail.stdout || '').trim(), 300) || '(empty log)'}. Keep hunting through the browser and shell.`,
      };
    }
    const webUrl = await dashboardUrl(huntId, exec);
    // Route the CURRENT browser through the proxy: Chromium cannot
    // change proxy settings at runtime, so it is relaunched with the
    // same flags hunt-desktop.sh uses, plus --proxy-server. When no
    // desktop browser is up, the marker file makes hunt-desktop.sh
    // add the flag at the next desktop start instead.
    let browserNote = 'No desktop browser is currently running on this machine — the proxy will route it automatically when the desktop starts (re-open your target then).';
    const cdp = await exec(huntId, `curl -s --max-time 2 http://127.0.0.1:9222/json/version | head -c 200`, 10000, { bypassTmux: true });
    if (/"Browser"\s*:/.test(String(cdp.stdout || ''))) {
      await exec(
        huntId,
        `pkill -f 'remote-debugging-port=9222' 2>/dev/null; sleep 1; ` +
        `DISPLAY=:99 nohup chromium ${CHROMIUM_FLAGS.join(' ')} --proxy-server=${PROXY_URL} about:blank ` +
        `>>${INTERCEPT_DIR}/chromium.log 2>&1 & echo relaunched`,
        20000,
        { bypassTmux: true },
      );
      let back = false;
      for (let i = 0; i < 12 && !back; i++) {
        const probe = await exec(huntId, `curl -s --max-time 2 http://127.0.0.1:9222/json/version | head -c 200`, 10000, { bypassTmux: true });
        back = /"Browser"\s*:/.test(String(probe.stdout || ''));
        if (!back) await sleep(1000);
      }
      browserNote = back
        ? 'Your browser was restarted through the proxy (its open tabs were closed) — re-open your target page; everything it loads now is captured.'
        : 'Your browser is being restarted through the proxy (it takes a few seconds to come back) — re-open your target page next turn; everything it loads will be captured.';
    }
    return {
      ok: true,
      webUrl,
      observation:
        `Intercept proxy is LIVE on this machine (mitmproxy in regular pass-through mode: every request is captured, none are held or altered). ${browserNote}\n` +
        `- Intercept dashboard — open this in your browser to click through captured requests visually, like Burp: ${webUrl}\n` +
        '- Then work the capture: {"action":"intercept_list"} lists captured requests, {"action":"intercept_read","index":N} reads one in full (headers + body + response), {"action":"intercept_replay","index":N,"headers":{...},"body":"...","url":"..."} resends one with your changes — one parameter at a time, like a human in Burp\'s Repeater.',
    };
  } catch (err) {
    return { ok: false, observation: `proxy_start failed: ${err.message || err}` };
  }
}

/** Number of lines (flows) in the capture file; 0 when absent. */
export async function captureCount(huntId, exec) {
  try {
    const r = await exec(huntId, `wc -l < ${CAPTURE_PATH} 2>/dev/null || echo 0`, 10000, { bypassTmux: true });
    const n = Number(String(r.stdout || '').trim());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Read the capture tail with absolute indices. Returns
 * { total, entries } — entries ascending, the last TAIL_LINES flows.
 */
export async function readCaptureTail(huntId, exec, tailLines = TAIL_LINES) {
  const r = await exec(
    huntId,
    `if [ -f ${CAPTURE_PATH} ]; then wc -l < ${CAPTURE_PATH}; tail -n ${tailLines} ${CAPTURE_PATH}; else echo 0; fi`,
    20000,
    { bypassTmux: true },
  );
  const raw = String(r.stdout || '');
  const nl = raw.indexOf('\n');
  const total = Number((nl >= 0 ? raw.slice(0, nl) : raw).trim()) || 0;
  const body = nl >= 0 ? raw.slice(nl + 1) : '';
  const lines = body.split('\n').filter((l) => l.trim().length > 0);
  const startIndex = Math.max(0, total - lines.length);
  return { total, entries: indexCaptureLines(lines, startIndex) };
}

/** intercept_list operation: read + shape. Never throws. */
export async function listIntercept(huntId, deps = {}) {
  const exec = deps.exec;
  if (typeof exec !== 'function') return { ok: false, observation: 'Intercept list unavailable: no container exec wired.' };
  try {
    const { total, entries } = await readCaptureTail(huntId, exec);
    return { ok: true, total, entries, observation: shapeInterceptList(entries, { total }) };
  } catch (err) {
    return { ok: false, observation: `intercept_list failed: ${err.message || err}` };
  }
}

/**
 * Read one capture entry by absolute index. Returns
 * { ok, entry?, observation } — on success the observation is the
 * shaped full read (shapeInterceptRead). Never throws.
 */
export async function readInterceptEntry(huntId, index, deps = {}) {
  const exec = deps.exec;
  if (typeof exec !== 'function') return { ok: false, observation: 'Intercept read unavailable: no container exec wired.' };
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0) {
    return { ok: false, observation: `intercept_read needs a valid capture index (a non-negative integer from intercept_list) — got ${JSON.stringify(index)}.` };
  }
  try {
    const total = await captureCount(huntId, exec);
    if (total === 0) {
      return { ok: false, observation: 'The intercept capture is empty — nothing to read yet. Start the proxy with {"action":"proxy_start"} and browse the target first.' };
    }
    if (idx >= total) {
      return { ok: false, observation: `Capture #${idx} does not exist — the capture holds ${total} request(s), indexed 0..${total - 1}. Run {"action":"intercept_list"} to see them.` };
    }
    const r = await exec(huntId, `sed -n '${idx + 1}p' ${CAPTURE_PATH}`, 10000, { bypassTmux: true });
    const flow = parseCaptureLine(r.stdout);
    if (!flow) {
      return { ok: false, observation: `Capture #${idx} could not be read (its record is damaged). Pick another index from intercept_list.` };
    }
    const entry = { index: idx, flow };
    return { ok: true, entry, observation: shapeInterceptRead(entry) };
  } catch (err) {
    return { ok: false, observation: `intercept_read failed: ${err.message || err}` };
  }
}
