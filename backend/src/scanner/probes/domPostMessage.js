// Dark Matter rule-based scanner — DOM XSS via postMessage probe
// (coverage row #274 [High] XSS — DOM via postMessage, CWE-79 |
// PortSwigger DOM XSS; phase 93, 'dom-postmessage').
//
// ORACLE (deterministic, no judge, no LLM, $0): an attacker page
// posts a message that the victim page sinks into innerHTML/eval.
// The page is vulnerable only if its own first-party JS registers
// a `message` event listener AND the posted data reaches an
// execution sink AND the payload actually executes. Listener
// presence alone is NOT a finding — the dom-xss-sinks probe already
// fingerprints sinks statically (class dom_sink, INFO). This probe
// goes one step further, in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for `message` listeners (addEventListener('message',
//   ...) / window.onmessage / onmessage =). ZERO listeners means no
//   code can sink a posted message at all — a proven true negative,
//   no browser needed. Each listener is classified by what sits
//   within a context window around it (execution sink / safe sink /
//   unknown) — a classification, not a flow proof: minified code
//   cannot be dataflow-traced by a window, so ANY listener triggers
//   tier 2.
//
//   TIER 2 — CDP EXECUTION DRIVE (only when tier 1 finds a
//   listener): a real headless browser (the same transient-container
//   + fixed-loopback-CDP pattern as renderDomAuthenticated)
//   navigates the pasted page, then posts a CONTROL message and two
//   canary messages to it and evaluates whether a canary executed.
//   Two canary shapes, because handlers sink data differently:
//     (E) eval-family: the posted data is the plain JS string
//         `window.__dmPostMsg_<rid>=1` — executes if the handler
//         passes event.data to eval / Function / setTimeout(string).
//     (M) markup: the posted data is
//         `<img src=x onerror="window.__dmPostMsg_<rid>=1">` —
//         executes ONLY if the handler sinks event.data into
//         innerHTML / document.write / bypassSecurityTrustHtml.
//   CONFIRM only when the control message leaves the flag unset
//   AND a canary message sets window.__dmPostMsg_<rid> to 1 AND the
//   message was actually delivered to the page (see below). The
//   flag name carries a per-scan random id so page code can never
//   set it by coincidence.
//
//   CROSS-ORIGIN DELIVERY (why the drive posts from an iframe):
//   a self-posted message (window.postMessage from the page's own
//   code) arrives with event.origin === the page's own origin, so
//   a handler that checks `e.origin === location.origin` — safe
//   against cross-origin attackers — would still execute the
//   canary and FALSELY confirm. The drive therefore posts from a
//   data:-URL iframe (opaque "null" origin — the origin a
//   sandboxed attacker page actually has): only a handler that
//   accepts cross-origin messages can execute the canary. A
//   delivery listener installed by the drive records whether each
//   posted message actually arrived at the window; a message that
//   never arrives (e.g. CSP frame-src blocking the data: iframe)
//   leaves the oracle uncalibrated — never a finding, and never a
//   false true negative either.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa /
// credential-stuffing); depth 'quick' skips the probe. BOUND: at
// most 1 browser drive per scan (control + at most 2 canary posts),
// at most 5 bundles + 10 inline blocks mined. Findings are class
// 'dom_sink' — the default confirmation protocol judges them on
// signalCorrelated (see domXssSinks.js: a class containing 'xss'
// would route to xss_reflected and stay unconfirmed forever).
// Severity follows the row (High) ONLY on observed execution; a
// true negative fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A listener that only exists
//   behind login is not reached — the probe reports no execution
//   with driveAttempted=true and says so in the evidence, never a
//   proven true negative.
// - The drive tests LOAD-time listeners only. A listener that is
//   registered only after user interaction is not exercised.
// - A handler that sinks only a SPECIFIC message shape (e.g. it
//   reads event.data.html, or requires event.data.type === 'x')
//   never receives that shape from this probe — the canaries post
//   a bare string as event.data. Such a handler is a true negative
//   BY THIS ORACLE, not proof of safety; the evidence says so.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code listening for messages
//   (e.g. a devtools bridge) is not the app's vulnerability.
// - The delivery check can be satisfied by the page's own internal
//   postMessage traffic arriving during the settle window, so a
//   blocked iframe on a chatty page could mask a delivery failure.
//   That can only hide an execution (a missed finding), never
//   create one: the flag still has to be set by the canary itself.

import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';
import { runCmd } from '../runner.js';
import { DOM_RENDER_IMAGE } from '../domRender.js';
import { connectCdp } from '../cdpClient.js';
import {
  buildCdpContainerRunArgs,
  buildCdpContainerRmArgs,
  AUTH_RENDER_CONNECT_ATTEMPTS,
  AUTH_RENDER_CONNECT_DELAY_MS,
  AUTH_RENDER_TIMEOUT_MS,
  AUTH_RENDER_DEBUG_ENDPOINT,
} from '../authDomRender.js';
import { isVendorBundle, isFrameworkBundle } from './domXssSinks.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes / domXssSinks
const MAX_INLINE = 10;
const MAX_FINDINGS = 1;
const WINDOW_CHARS = 300; // context window around a listener for sink classification
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive post (message delivery is async)
const SNIPPET_RADIUS = 80;

// ---- tier-1: message listeners (pure) --------------------------------------

// addEventListener('message' | "message", ...) — optionally qualified
// (window/document/self/top/parent). onmessage = ... — optionally
// window-qualified. A bare word in a comment never matches: the call
// form requires the paren + quoted 'message', the assignment form
// requires the `=`.
const LISTENER_RES = [
  { kind: 'addEventListener', re: /(?:\b(?:window|document|self|top|parent)\.)?addEventListener\s*\(\s*['"]message['"]/g },
  { kind: 'onmessage', re: /(?:\bwindow\s*\.\s*)?onmessage\s*=(?!=)/g },
];

// Execution sinks posted data must reach to execute. innerHTML as a
// quoted literal (compiled binding) or an assignment; document.write;
// the Angular sanitizer bypass; eval / Function; insertAdjacentHTML;
// outerHTML assignment; jQuery .html(); setTimeout / setInterval with
// a string first argument (a function argument never executes text).
const EXEC_SINK_RES = [
  { kind: 'innerHTML', re: /["']innerHTML["']|\.innerHTML\s*=(?!=)/ },
  { kind: 'document.write', re: /document\.write(ln)?\s*\(/ },
  { kind: 'bypassSecurityTrustHtml', re: /\.bypassSecurityTrustHtml\s*\(/ },
  { kind: 'eval', re: /\beval\s*\(/ },
  { kind: 'Function', re: /\bFunction\s*\(/ },
  { kind: 'insertAdjacentHTML', re: /\.insertAdjacentHTML\s*\(/ },
  { kind: 'outerHTML', re: /\.outerHTML\s*=(?!=)/ },
  { kind: 'jQuery.html', re: /\.html\s*\(/ },
  { kind: 'setTimeout-string', re: /\bsetTimeout\s*\(\s*['"`]/ },
  { kind: 'setInterval-string', re: /\bsetInterval\s*\(\s*['"`]/ },
];

// Safe sinks: the value is rendered as text, never parsed as HTML.
const SAFE_SINK_RES = [
  { kind: 'textContent', re: /\.textContent\s*=/ },
  { kind: 'innerText', re: /\.innerText\s*=/ },
];

function lineOf(body, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < body.length; i += 1) {
    if (body[i] === '\n') n += 1;
  }
  return n;
}

function snippetAround(body, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + matchLength + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

// Classify one listener by what sits within WINDOW_CHARS of it:
// an execution sink nearby, only safe sinks nearby, or neither.
// A window is a classification, NOT a flow proof — minified code
// cannot be dataflow-traced this way, which is why any listener at
// all triggers the tier-2 drive.
export function classifyMessageListener(body, index) {
  const text = typeof body === 'string' ? body : '';
  const start = Math.max(0, index - WINDOW_CHARS);
  const end = Math.min(text.length, index + WINDOW_CHARS);
  const windowText = text.slice(start, end);
  for (const { kind, re } of EXEC_SINK_RES) {
    if (re.test(windowText)) return { nearSink: true, sinkKind: kind, safeOnly: false };
  }
  for (const { kind, re } of SAFE_SINK_RES) {
    if (re.test(windowText)) return { nearSink: false, sinkKind: kind, safeOnly: true };
  }
  return { nearSink: false, sinkKind: null, safeOnly: false };
}

// All `message` listeners in one source body, each with its kind,
// line, snippet and sink classification. Pure — exported for unit tests.
export function findMessageListeners(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  for (const { kind, re } of LISTENER_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const cls = classifyMessageListener(text, m.index);
      out.push({
        index: m.index,
        kind,
        line: lineOf(text, m.index),
        snippet: snippetAround(text, m.index, m[0].length),
        nearSink: cls.nearSink,
        sinkKind: cls.sinkKind,
        safeOnly: cls.safeOnly,
      });
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// Tier-1 verdict from a listener list: how many listeners, how many
// sit near an execution sink, and whether the tier-2 drive is needed.
// Pure — exported for unit tests.
export function assessMessageFlow(listeners) {
  const list = Array.isArray(listeners) ? listeners : [];
  const nearSink = list.filter((r) => r && r.nearSink).length;
  return { listeners: list.length, nearSink, drive: list.length > 0 };
}

// ---- tier-2: canary payloads (pure) ----------------------------------------

export function flagName(rid) {
  return `__dmPostMsg_${String(rid || '').replace(/[^A-Za-z0-9]/g, '')}`;
}

export function deliveredFlagName(rid) {
  return `__dmPostMsgRx_${String(rid || '').replace(/[^A-Za-z0-9]/g, '')}`;
}

// Control data: a benign object. It carries the rid but never the
// flag name itself, so the flag cannot be set by reflection alone.
export function controlData(rid) {
  return { dmcontrol: String(rid || '') };
}

// Eval-family canary: the posted data IS plain JS — executes if the
// handler passes event.data to eval / Function / setTimeout(string).
export function evalCanaryData(rid) {
  return `window.${flagName(rid)}=1`;
}

// Markup canary: executes ONLY if the handler sinks event.data into
// innerHTML / document.write / bypassSecurityTrustHtml.
export function markupCanaryData(rid) {
  return `<img src=x onerror="window.${flagName(rid)}=1">`;
}

// The in-page expression that posts `data` to the page from a
// cross-origin iframe: the iframe is a data: URL document (opaque
// "null" origin — the origin a sandboxed attacker page actually
// has), so only a handler that accepts cross-origin messages can
// act on it. Pure — the returned string is evaluated in the page
// via CDP; it posts exactly once and returns 'posted'.
export function iframePostExpr(data) {
  const html = `<script>parent.postMessage(${JSON.stringify(data)}, '*')</script>`;
  const src = `data:text/html,${encodeURIComponent(html)}`;
  return `(() => { const f = document.createElement('iframe'); f.src = ${JSON.stringify(src)}; document.body.appendChild(f); return 'posted'; })()`;
}

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests. A set flag on the CONTROL post means the oracle itself
// is contaminated (the random flag name cannot be set by page code,
// so a set control flag means the drive is untrustworthy); a message
// that was never delivered means the handler was never offered the
// payload at all.
export function assessDriveResult({ controlFlag, delivered, canaryFlag }) {
  if (controlFlag) {
    return { verdict: 'uncalibrated', reason: 'control message set the execution flag — oracle contaminated' };
  }
  if (delivered === false) {
    return { verdict: 'uncalibrated', reason: 'message was never delivered to the page — handler never offered the payload' };
  }
  if (canaryFlag) {
    return { verdict: 'confirmed', reason: 'canary message executed in the page' };
  }
  return { verdict: 'not-executed', reason: 'canary message reached the page but did not execute' };
}

// ---- tier-2: the CDP drive --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drive the pasted page in a real headless browser: post a control
 * message, then canary messages, from a cross-origin iframe, and
 * observe whether a canary executed. Reuses the authenticated-render
 * browser pattern (transient container, fixed host-loopback CDP
 * endpoint, container removed in a finally). Anonymous: no lab
 * session is carried, so only the logged-out surface is tested.
 * opts.runner / opts.cdpConnect / opts.image are the test seams
 * (defaults mirror authDomRender).
 * Returns { attempted, executed, delivered, controlFlag, reflected,
 * shape, error, rid, flag }. Never throws.
 */
export async function drivePostMessageExecution(pageUrl, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const flag = flagName(rid);
  const rxFlag = deliveredFlagName(rid);
  const out = {
    attempted: false,
    executed: false,
    delivered: null,
    controlFlag: false,
    reflected: false,
    shape: null,
    error: null,
    rid,
    flag,
  };
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const cdpConnect = typeof opts.cdpConnect === 'function' ? opts.cdpConnect : connectCdp;
  const image = opts.image || DOM_RENDER_IMAGE;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : AUTH_RENDER_TIMEOUT_MS;
  if (!pageUrl) {
    out.error = 'no url';
    return out;
  }
  let containerId = null;
  let client = null;
  try {
    const run = await runner('docker', buildCdpContainerRunArgs(image), { timeoutMs });
    if (!run || !run.ok || !String(run.stdout || '').trim()) {
      out.error = String((run && run.stderr) || '').trim().slice(0, 200) || 'browser container failed to start';
      return out;
    }
    containerId = String(run.stdout).trim().split(/\s+/)[0];
    out.attempted = true;

    let connected = null;
    let lastError = 'cdp endpoint unreachable';
    for (let i = 0; i < AUTH_RENDER_CONNECT_ATTEMPTS; i += 1) {
      const res = await cdpConnect(AUTH_RENDER_DEBUG_ENDPOINT, opts);
      if (res && res.ok) {
        connected = res;
        break;
      }
      lastError = (res && res.error) || lastError;
      if (i < AUTH_RENDER_CONNECT_ATTEMPTS - 1 && AUTH_RENDER_CONNECT_DELAY_MS > 0) {
        await sleep(AUTH_RENDER_CONNECT_DELAY_MS);
      }
    }
    if (!connected) {
      out.error = lastError;
      return out;
    }
    client = connected.client;

    const target = await client.newTarget('about:blank');
    await client.attach(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const flagExpr = `window.${flag} === 1`;
    const rxExpr = `window.${rxFlag} === 1`;
    const rxResetExpr = `window.${rxFlag} = 0`;
    const reflectedExpr = `document.documentElement.outerHTML.includes(${JSON.stringify(flag)})`;

    await client.navigate(pageUrl);
    await sleep(DRIVE_SETTLE_MS);

    // Install the delivery listener: it records whether each posted
    // message actually arrived at the window. Reset immediately
    // before every post so stale traffic cannot leak in.
    await client.evaluate(
      `(() => { window.${rxFlag} = 0; window.addEventListener('message', function () { window.${rxFlag} = 1; }); return 'installed'; })()`
    );

    // CONTROL: a benign object posted cross-origin must leave the
    // flag unset — and must arrive at all.
    await client.evaluate(iframePostExpr(controlData(rid)));
    await sleep(DRIVE_SETTLE_MS);
    const controlDelivered = (await client.evaluate(rxExpr)) === true;
    out.delivered = controlDelivered;
    if (!controlDelivered) {
      out.error = 'control message was not delivered to the page';
      return out;
    }
    const controlFlag = (await client.evaluate(flagExpr)) === true;
    out.controlFlag = controlFlag;
    if (controlFlag) {
      out.error = 'control message set the execution flag';
      return out;
    }

    // CANARY shapes, in order: eval-family first (bare string JS),
    // markup second (needs a handler that sinks data as HTML).
    const shapes = [
      { name: 'eval', data: evalCanaryData(rid) },
      { name: 'markup', data: markupCanaryData(rid) },
    ];
    for (const { name, data } of shapes) {
      await client.evaluate(rxResetExpr);
      await client.evaluate(iframePostExpr(data));
      await sleep(DRIVE_SETTLE_MS);
      const delivered = (await client.evaluate(rxExpr)) === true;
      if (!delivered) {
        out.error = 'canary message was not delivered to the page';
        return out;
      }
      const reflected = (await client.evaluate(reflectedExpr)) === true;
      if (reflected) out.reflected = true;
      const flagSet = (await client.evaluate(flagExpr)) === true;
      if (flagSet) {
        out.executed = true;
        out.shape = name;
        return out;
      }
    }
    return out;
  } catch (e) {
    out.error = e && e.message ? String(e.message).slice(0, 200) : String(e);
    return out;
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
        // container removal is best-effort
      }
    }
  }
}

// ---- the probe ---------------------------------------------------------------

/**
 * Probe DOM XSS via postMessage (#274).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body so a
 *   script-less page skips instead of fetching).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, fetchPage, runner, cdpConnect, image, diagnostics }.
 *   fetchPage is the bundle-fetch seam (defaults to fingerprint.fetchPage);
 *   runner / cdpConnect / image are the CDP-drive seams.
 * @returns {object[]} findings (class 'dom_sink', high) — at most 1 per
 *   scan: the first canary shape that executes.
 */
export async function probeDomPostMessage(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as basket-logic / workflow-skip /
  // session-fixation / twofa / credential-stuffing): canary lab creds
  // + allowWrite + lab host + depth !== 'quick'. The drive posts a
  // payload to the target's origin, so it never runs outside the lab gate.
  const creds = opts.labCreds;
  if (!creds || !creds.username || !creds.password) return findings;
  if (opts.allowWrite !== true) return findings;
  if (!isLabTargetHost(pageUrl, opts.labTargets)) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;

  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];

  // TIER 1 — mine first-party code for `message` listeners. Vendor /
  // framework bundles are excluded by the same gates as domXssSinks
  // (a devtools bridge listening for messages is framework code,
  // not the app's vuln).
  const listeners = [];
  for (const bundleUrl of bundles) {
    if (isVendorBundle(bundleUrl)) continue;
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    if (isFrameworkBundle(res.body)) continue;
    for (const r of findMessageListeners(res.body)) {
      listeners.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findMessageListeners(body)) {
      listeners.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessMessageFlow(listeners);
  setDiag('listeners', flow.listeners);
  setDiag('listenersNearSink', flow.nearSink);
  if (!flow.drive) return findings; // proven true negative: nothing listens for messages

  // TIER 2 — drive the pasted page in a real browser and observe
  // whether a canary message executes.
  setDiag('driveAttempted', true);
  const drive = await drivePostMessageExecution(pageUrl, opts);
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, CDP unreachable, control
  // contaminated, message undelivered) leaves the oracle
  // uncalibrated — never a finding, and never a proven true negative
  // either.
  const verdict = drive.error
    ? { verdict: 'uncalibrated', reason: drive.error }
    : assessDriveResult({
        controlFlag: drive.controlFlag,
        delivered: drive.delivered,
        canaryFlag: drive.executed,
      });
  if (verdict.verdict !== 'confirmed') return findings;

  const near = listeners.find((r) => r.nearSink);
  findings.push({
    class: 'dom_sink',
    id: 'dom-postmessage-xss',
    title: 'DOM XSS via postMessage — handler sinks cross-origin message data into an execution sink (HIGH)',
    severity: 'high',
    url: pageUrl,
    parameter: near ? `postMessage → ${near.sinkKind}` : 'postMessage data',
    evidence: {
      request:
        `POST cross-origin message to ${pageUrl} from a data:-URL iframe (opaque "null" origin): ` +
        `control {dmcontrol:'${drive.rid}'} first — flag unset; canary shape: ${drive.shape} ` +
        `(${drive.shape === 'markup' ? markupCanaryData(drive.rid) : evalCanaryData(drive.rid)}).`,
      response:
        `Canary message executed in a real browser: window.${drive.flag} === 1 after posting the ${drive.shape} payload ` +
        `from a cross-origin iframe, with delivery confirmed at the window. ` +
        (near
          ? `Static mine found the listener in ${near.source} (line ${near.line}, near ${near.sinkKind || 'a sink'}): ${near.snippet} `
          : 'Static mine found message listeners in first-party code. ') +
        `Reflected in the DOM as text: ${drive.reflected ? 'yes' : 'no'}. ` +
        `The message is attacker-controlled (any page can post to this origin) and the handler sinks it into an execution sink unencoded.`,
      impact_demo:
        'DOM XSS — an attacker page posting a crafted message executes script in the victim origin (session theft, actions as the user). Validate event.origin against an allowlist AND validate the message shape before use, and render data via textContent / the default sanitizer — never sink event.data into innerHTML, document.write, eval or a sanitizer bypass (OWASP DOM XSS Cheat Sheet).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __domPostMsgMeta = { phases: ['dom-postmessage'], depth: ['standard', 'deep'] };
