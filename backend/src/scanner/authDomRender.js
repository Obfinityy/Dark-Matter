// Dark Matter rule-based scanner — authenticated DOM render
// (CDP authenticated-DOM-render lane, 8 Nov 2026).
//
// The plain dom-render phase runs `chromium --dump-dom` anonymously,
// so DOM probes never see post-login state. This module renders a
// page WITH the hunt's lab session: it starts the same hunt image
// as a detached chromium with a remote-debugging port, drives it
// through the standalone CDP client (cdpClient.js — zero deps, no
// huntRunner/guiTools imports), injects the session (cookies via
// Network.setCookie, bearer token into localStorage before page
// scripts run), navigates, and returns the rendered DOM as HTML —
// the same {ok, html, error} shape renderDom returns, so it slots
// into discoverDomForms as a drop-in renderer.
//
// BROWSER LIFECYCLE (transient container, same image as domRender):
//   docker run -d --rm --network host --entrypoint chromium
//     <image> --headless=new --no-sandbox --disable-gpu
//     --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0
//     about:blank
// The container is removed (`docker rm -f`) in a finally block —
// a render that dies mid-flight must not leak a browser. With
// --network host the browser binds the HOST loopback directly, so
// the CDP endpoint is the fixed http://127.0.0.1:9222 — no port
// is published, no `docker port` call is made, no endpoint is
// parsed. The browser is never exposed beyond the backend host:
// it listens on loopback only, and 0.0.0.0 is never published.
//
// WHY HOST NETWORK, NOT A PUBLISHED PORT (8 Nov 2026, two repair
// lanes — both proven live on EC2, proof #14):
// (1) The bridge-gateway repair published `-p 172.17.0.1:0:9222`
// and parsed the endpoint from `docker port <id> 9222`. That
// command prints the BARE form `172.17.0.1:32769`, but the parser
// required the full `9222/tcp -> 172.17.0.1:49153` shape (which
// only the no-arg `docker port <id>` prints) — so it returned
// null on every live run and the hunt failed with 'browser
// container published no debug port'. Never parse docker's output
// from an assumed shape again.
// (2) Even with a correct parse, the connect could not work: this
// Chrome build (154.0.8037.92, --headless=new) IGNORES
// --remote-debugging-address=0.0.0.0 — /proc/net/tcp inside the
// container proves DevTools listens on 127.0.0.1:9222 ONLY. Host
// connects to a published port fail (127.0.0.1 publish: RST, curl
// 56; 172.17.0.1 publish: instant Connection refused; direct
// bridge-IP connect: 000), while the browser answers inside the
// container and a fresh lab-xxe publish answers 200 — the
// forwarding, not the browser, is broken for this container.
// --network host sidesteps both: the debug port IS a host
// loopback socket (curl http://127.0.0.1:9222/json/version -> 200,
// proven live twice). Fixed-port collision note: MAX_CONCURRENT_
// HUNTS=1 and the dom-render phase runs once per hunt, so only
// one auth browser ever exists at a time.
//
// SAFETY: lab-gated by the caller (acquireLabSession already
// refused non-lab targets); this module itself never sees
// credentials — only the acquired session (token + cookies). The
// token is injected via Page.addScriptToEvaluateOnNewDocument, so it
// lives in the RENDERED page's localStorage only — it is never
// written to any file, log, or finding. A render without a session
// is refused ({ok:false, error:'no session'}) rather than silently
// rendering anonymously and pretending it was authenticated.
// Never throws — every failure is {ok:false, error}.

import { runCmd } from './runner.js';
import { DOM_RENDER_IMAGE } from './domRender.js';
import { connectCdp } from './cdpClient.js';

export const AUTH_RENDER_CDP_PORT = 9222;
export const AUTH_RENDER_CONNECT_ATTEMPTS = 5;
export const AUTH_RENDER_CONNECT_DELAY_MS = 500;
export const AUTH_RENDER_TIMEOUT_MS = 60000;
// Host loopback: with --network host the browser binds the host's
// own 127.0.0.1:9222 (see the header note) — the CDP endpoint is
// fixed, never published, never parsed from docker output.
export const AUTH_RENDER_DEBUG_HOST = '127.0.0.1';
export const AUTH_RENDER_DEBUG_ENDPOINT = `http://${AUTH_RENDER_DEBUG_HOST}:${AUTH_RENDER_CDP_PORT}`;

/**
 * Pure builder for the detached-browser container command. The
 * --entrypoint override is load-bearing (same as domRender's
 * --dump-dom command): without it the hunt image's ENTRYPOINT
 * (/opt/hunt/run.sh) swallows the chromium args. --network host
 * is load-bearing too (see the header note): it puts the debug
 * port on the host loopback, so there is NO -p publish and no
 * `docker port` lookup afterwards.
 */
export function buildCdpContainerRunArgs(image) {
  return [
    'run',
    '-d',
    '--rm',
    '--network',
    'host',
    '--entrypoint',
    'chromium',
    image || DOM_RENDER_IMAGE,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${AUTH_RENDER_CDP_PORT}`,
    '--remote-debugging-address=0.0.0.0',
    'about:blank',
  ];
}

export function buildCdpContainerRmArgs(containerId) {
  return ['rm', '-f', String(containerId)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Render one URL in a real browser carrying the lab session.
 * session: {token, cookies:[{name, value, domain, path, ...}]}.
 * opts.runner is the docker seam (defaults to runCmd, same as
 * domRender); opts.cdpConnect is the CDP seam (defaults to
 * connectCdp); opts.image overrides the browser image. The CDP
 * endpoint is the fixed host loopback (AUTH_RENDER_DEBUG_ENDPOINT)
 * — there is no publish and no port lookup. Returns {ok:true,
 * html} or {ok:false, error}. Never throws.
 */
export async function renderDomAuthenticated(url, session, opts = {}) {
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const cdpConnect = typeof opts.cdpConnect === 'function' ? opts.cdpConnect : connectCdp;
  const image = opts.image || DOM_RENDER_IMAGE;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : AUTH_RENDER_TIMEOUT_MS;
  if (!url) return { ok: false, error: 'no url' };
  if (!session || (typeof session !== 'object')) return { ok: false, error: 'no session' };
  const hasToken = typeof session.token === 'string' && session.token.length > 0;
  const cookies = Array.isArray(session.cookies) ? session.cookies : [];
  if (!hasToken && cookies.length === 0) {
    return { ok: false, error: 'no session' };
  }

  let containerId = null;
  let client = null;
  const startedAt = Date.now();
  try {
    const run = await runner('docker', buildCdpContainerRunArgs(image), { timeoutMs });
    if (!run || !run.ok || !String(run.stdout || '').trim()) {
      const detail = String((run && run.stderr) || '').trim().slice(0, 300);
      return { ok: false, error: detail || 'browser container failed to start', durationMs: Date.now() - startedAt };
    }
    containerId = String(run.stdout).trim().split(/\s+/)[0];

    // Fixed host-loopback endpoint (--network host, see the header
    // note): no publish, no `docker port` lookup, nothing to parse.
    const endpoint = AUTH_RENDER_DEBUG_ENDPOINT;

    // Cold chromium answers /json/version a moment after the
    // container reports running — retry the connect, bounded.
    const attempts =
      Number.isInteger(opts.connectAttempts) && opts.connectAttempts > 0
        ? opts.connectAttempts
        : AUTH_RENDER_CONNECT_ATTEMPTS;
    const delayMs =
      Number.isFinite(opts.connectDelayMs) && opts.connectDelayMs >= 0
        ? opts.connectDelayMs
        : AUTH_RENDER_CONNECT_DELAY_MS;
    let connected = null;
    let lastError = 'cdp endpoint unreachable';
    for (let i = 0; i < attempts; i++) {
      const res = await cdpConnect(endpoint, opts);
      if (res && res.ok) {
        connected = res;
        break;
      }
      lastError = (res && res.error) || lastError;
      if (i < attempts - 1 && delayMs > 0) await sleep(delayMs);
    }
    if (!connected) {
      return { ok: false, error: lastError, durationMs: Date.now() - startedAt };
    }
    client = connected.client;

    const target = await client.newTarget('about:blank');
    await client.attach(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    // Session injection, before any navigation: cookies ride the
    // requests, the token lands in localStorage before page scripts
    // run (the SPA reads it on boot).
    for (const cookie of cookies) {
      await client.setCookie(cookie);
    }
    if (hasToken) {
      const script = `try { localStorage.setItem('token', ${JSON.stringify(session.token)}); } catch (e) {}`;
      await client.addInitScript(script);
    }

    await client.navigate(String(url), { timeoutMs });
    const html = await client.outerHTML();
    if (!html || !html.trim()) {
      return { ok: false, error: 'authenticated render produced no DOM', durationMs: Date.now() - startedAt };
    }
    return { ok: true, html: html.slice(0, 500000), error: null, durationMs: Date.now() - startedAt };
  } catch (e) {
    return {
      ok: false,
      error: e && e.message ? String(e.message).slice(0, 300) : String(e),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    try {
      if (client) await client.close();
    } catch {
      // close is best-effort
    }
    if (containerId) {
      try {
        await runner('docker', buildCdpContainerRmArgs(containerId), { timeoutMs: 15000 });
      } catch {
        // container removal is best-effort — a leaked container is
        // named (auth render) and --rm'd on exit where possible
      }
    }
  }
}

/**
 * Merge an authenticated render's analysis into the unauthenticated
 * one, deduplicating by identity: a form by action+method, an
 * input/textarea/select by name+form+page. The unauthenticated DOM
 * is the base — the authenticated pass only ADDS what login
 * reveals; it never removes or replaces. Mutates `base` and
 * returns the added items ({forms, inputs, textareas, selects,
 * buttons}) so the caller can rebuild crawl-shape forms and count
 * the phase extras. Pure except for the mutation it documents.
 */
export function mergeAuthAnalysis(base, auth) {
  const added = { forms: [], inputs: [], textareas: [], selects: [], buttons: [] };
  if (!base || !auth) return added;
  const formKey = (f) => `${String(f.action || '')}\n${String(f.method || '').toLowerCase()}`;
  const inputKey = (i) => `${String(i.name || '')}\n${i.form ? String(i.form.action || '') : ''}\n${String(i.page || '')}`;
  const seenForms = new Set((base.forms || []).map(formKey));
  for (const f of auth.forms || []) {
    if (!f) continue;
    const k = formKey(f);
    if (seenForms.has(k)) continue;
    seenForms.add(k);
    base.forms.push(f);
    added.forms.push(f);
  }
  const mergeInputs = (field, keyFn) => {
    const seen = new Set((base[field] || []).map(keyFn));
    for (const item of auth[field] || []) {
      if (!item) continue;
      const k = keyFn(item);
      if (seen.has(k)) continue;
      seen.add(k);
      base[field].push(item);
      added[field].push(item);
    }
  };
  mergeInputs('inputs', inputKey);
  mergeInputs('textareas', inputKey);
  mergeInputs('selects', inputKey);
  const buttonKey = (b) => `${String(b.label || b.text || '')}\n${String(b.page || '')}`;
  const seenButtons = new Set((base.buttons || []).map(buttonKey));
  for (const b of auth.buttons || []) {
    if (!b) continue;
    const k = buttonKey(b);
    if (seenButtons.has(k)) continue;
    seenButtons.add(k);
    base.buttons.push(b);
    added.buttons.push(b);
  }
  for (const p of auth.params || []) {
    if (!base.params.includes(p)) base.params.push(p);
  }
  return added;
}
