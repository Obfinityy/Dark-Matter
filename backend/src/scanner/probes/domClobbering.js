// Dark Matter rule-based scanner — DOM Clobbering probe
// (coverage row #89 [Medium] DOM Clobbering, Technique (no single
// CVE) | PortSwigger DOM; phase 99, 'dom-clobbering').
//
// ORACLE (deterministic, no judge, no LLM, $0): attacker markup
// injected into the page creates an element whose id or name
// collides with a window property the app trusts; the page is
// vulnerable only if its own first-party JS reads such a global
// AND a sink consumes the clobbered value AND the consumption is
// observed in a real browser. Clobbering alone is NEVER a finding
// — window pollution without a sink effect is not exploitable —
// and sink presence alone is NOT a finding either: the
// dom-xss-sinks probe already fingerprints sinks statically (class
// dom_sink, INFO). This probe goes one step further, in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for global reads feeding a sink (a URL assignment, an
//   HTML sink, an eval sink), and the served page HTML is mined for
//   id=/name= attributes (elements the page already ships that
//   prove a global IS clobberable by markup). ZERO sink-feeding
//   global reads means no code can consume a clobbered value at
//   all — a proven true negative, no browser needed. Each sink is
//   classified by the global name it reads — a classification, not
//   a flow proof: minified code cannot be dataflow-traced by a
//   window, so ANY sink-feeding read triggers tier 2.
//
//   TIER 2 — CDP CLOBBER DRIVE (only when tier 1 finds a sink):
//   a real headless browser (the same transient-container +
//   fixed-loopback-CDP pattern as renderDomAuthenticated) loads the
//   pasted page, injects a crafted element — `<a id="<global>"
//   href="https://evil.example/__dmclob_<rid>">` — the way
//   attacker-injected markup would, and checks two things in
//   order: (1) window.<global> resolves to the injected node
//   (the clobber works), and (2) a sink CONSUMES it: the canary
//   URL appears on another element's src/href/action (URL
//   consumption), the browser navigates to the canary (navigation
//   consumption), or the page re-inserts the element's markup so
//   its id appears twice in the live DOM (HTML consumption).
//   CONFIRM only when BOTH hold. The canary host is evil.example
//   — the .example TLD never resolves — so a navigation to it is
//   observable without reaching a real server. The canary path
//   carries a per-scan random id so a coincidental match can never
//   confirm.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa); depth
// 'quick' skips the probe. BOUND: at most 1 browser drive per scan
// (at most 3 globals, one injection each), at most 5 bundles + 10
// inline blocks mined. Findings are class 'dom_sink' — the default
// confirmation protocol judges them on signalCorrelated (see
// domXssSinks.js: a class containing 'xss' would route to
// xss_reflected and stay unconfirmed forever). Severity follows the
// row (Medium) ONLY on observed sink consumption; a true negative
// fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive INJECTS the element itself (via CDP evaluate) to
//   simulate attacker markup. The finding proves the app consumes
//   a clobbered global; exploiting it additionally requires an
//   HTML-injection vector into the page (see the dom-xss-sinks
//   fingerprint for whether one exists) — the evidence says so,
//   and the impact note names the precondition.
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A sink that only exists behind
//   login is not reached — the probe reports no consumption with
//   driveAttempted=true and says so in the evidence, never a
//   proven true negative.
// - The drive tests LOAD-time sinks only. A sink that consumes
//   the global only on user interaction is not exercised.
// - A global the page reads only through a destructured or
//   computed access (window[name], a renamed import) is not mined
//   — tier 1 reads `window.<name>` and bare `<name>` only. Such a
//   read is a true negative BY THIS ORACLE, not proof of safety.
// - If the served page already ships an element with the same id,
//   window.<global> resolves to the SHIPPED element (first id
//   wins), so the injected canary is not the resolved value and
//   the drive cannot confirm — correctly: no attacker control was
//   demonstrated.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code reading globals (e.g.
//   a framework's own config object) is not the app's vuln.

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
const MAX_GLOBALS = 3; // candidate globals driven per scan
const MAX_SHIPPED_NAMES = 50; // id=/name= attributes mined from the served page
const WINDOW_CHARS = 300; // context window around a sink for global classification
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive step (sinks run async)
const SNIPPET_RADIUS = 80;

// The canary host: the .example TLD never resolves, so a navigation
// to it is observable without reaching a real server.
const CANARY_HOST = 'evil.example';

// Identifiers that are never a clobberable app global: builtins,
// browser objects, and the page's own plumbing.
const BUILTIN_NAMES = new Set([
  'document', 'window', 'location', 'console', 'navigator', 'screen',
  'history', 'localStorage', 'sessionStorage', 'self', 'top', 'parent',
  'undefined', 'this', 'Math', 'JSON', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Promise', 'Symbol', 'Error', 'RegExp', 'Date',
  'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'alert', 'confirm', 'prompt', 'event', 'exports', 'require', 'module',
]);

// ---- tier-1: clobber sinks (pure) ------------------------------------------

// A sink fed by a global: the right-hand side / argument is
// `window.<name>` or a bare `<name>` (optionally followed by a
// property access, e.g. `config.avatarUrl` — the base identifier
// is the clobberable global). URL sinks: src/href/action
// assignment, location assignment, window.open. HTML sinks:
// innerHTML assignment, document.write, insertAdjacentHTML. Eval
// sinks: eval / Function.
const CLOBBER_SINK_RES = [
  { kind: 'src-assignment', re: /\.(?:src|href|action)\s*=(?!=)\s*(?:window\s*\.\s*)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
  { kind: 'location-assignment', re: /(?:\b(?:window|document|self|top|parent)\.)?location\s*(?:\.\s*href\s*=(?!=)|\s*=(?!=))\s*(?:window\s*\.\s*)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
  { kind: 'window.open', re: /\bwindow\s*\.\s*open\s*\(\s*(?:window\s*\.\s*)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
  { kind: 'innerHTML', re: /\.innerHTML\s*=(?!=)\s*(?:window\s*\.\s*)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
  { kind: 'document.write', re: /document\.write(?:ln)?\s*\(\s*(?:window\s*\.\s*)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
  { kind: 'insertAdjacentHTML', re: /\.insertAdjacentHTML\s*\([^,]+,\s*(?:window\s*\.\s*)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
  { kind: 'eval', re: /\beval\s*\(\s*(?:window\s*\.\s*)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
  { kind: 'Function', re: /\bFunction\s*\(\s*(?:window\s*\.\s*)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
];

// A local declaration of a name in the same body — such a name is a
// local variable, not a clobberable window global.
const DECLARATION_RE = /\b(?:var|let|const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;

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

// Names declared locally in one source body. Pure — exported for
// unit tests.
export function declaredNames(body) {
  const text = typeof body === 'string' ? body : '';
  const out = new Set();
  const rx = new RegExp(DECLARATION_RE.source, DECLARATION_RE.flags);
  let m;
  while ((m = rx.exec(text)) !== null) out.add(m[1]);
  return out;
}

// id=/name= attribute values in served HTML — elements the page
// already ships, each of which proves its name IS clobberable by
// markup. Pure — exported for unit tests.
export function findShippedClobberNames(html) {
  const text = typeof html === 'string' ? html : '';
  const out = [];
  const seen = new Set();
  const rx = /\b(?:id|name)\s*=\s*["']([A-Za-z_$][A-Za-z0-9_\-$]*)["']/g;
  let m;
  while ((m = rx.exec(text)) !== null) {
    if (out.length >= MAX_SHIPPED_NAMES) break;
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

// All sink-feeding global reads in one source body, each with its
// kind, line, snippet and global name. A name is kept only when it
// is not a builtin and not declared locally in the same body.
// Pure — exported for unit tests.
export function findClobberSinks(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const declared = declaredNames(text);
  const out = [];
  for (const { kind, re } of CLOBBER_SINK_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const name = m[1];
      if (!name || BUILTIN_NAMES.has(name) || declared.has(name)) continue;
      out.push({
        index: m.index,
        kind,
        globalName: name,
        line: lineOf(text, m.index),
        snippet: snippetAround(text, m.index, m[0].length),
        nearSink: true,
      });
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// Tier-1 verdict from a sink list: how many sink-feeding reads,
// how many distinct globals, whether the tier-2 drive is needed,
// and the candidate globals (shipped names first — a global the
// page already ships an element for is the strongest candidate).
// Pure — exported for unit tests.
export function assessClobberFlow(sinks, shippedNames) {
  const list = Array.isArray(sinks) ? sinks : [];
  const shipped = new Set(Array.isArray(shippedNames) ? shippedNames : []);
  const globals = [];
  const seen = new Set();
  // Shipped globals first.
  for (const s of list) {
    if (s && shipped.has(s.globalName) && !seen.has(s.globalName)) {
      seen.add(s.globalName);
      globals.push(s.globalName);
    }
  }
  for (const s of list) {
    if (s && !seen.has(s.globalName)) {
      seen.add(s.globalName);
      globals.push(s.globalName);
    }
  }
  return {
    clobberSinks: list.length,
    clobberNearSink: list.length,
    drive: list.length > 0,
    globals: globals.slice(0, MAX_GLOBALS),
  };
}

// ---- tier-2: canary element (pure) -----------------------------------------

export function canaryUrl(rid) {
  return `https://${CANARY_HOST}/__dmclob_${String(rid || '').replace(/[^A-Za-z0-9]/g, '')}`;
}

// The crafted element: an anchor whose id clobbers the global and
// whose href carries the canary URL. Pure — exported for unit tests.
export function clobberElement(globalName, rid) {
  const name = String(globalName || '').replace(/[^A-Za-z0-9_$]/g, '');
  return `<a id="${name}" href="${canaryUrl(rid)}"></a>`;
}

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests. Clobbering without consumption is the central
// negative case: window pollution alone is NEVER a finding.
export function assessDriveResult({ clobbered, consumed }) {
  if (clobbered === false) {
    return { verdict: 'not-clobbered', reason: 'injected element did not resolve as window.<name> — global not clobberable by markup' };
  }
  if (consumed) {
    return { verdict: 'confirmed', reason: 'clobbered global was consumed by a sink in the live page' };
  }
  return { verdict: 'not-executed', reason: 'global clobbered but no sink consumed it — window pollution alone is not a finding' };
}

// ---- tier-2: the CDP drive --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripFragment(u) {
  try {
    const x = new URL(String(u));
    x.hash = '';
    return x.toString();
  } catch {
    return String(u || '').split('#')[0];
  }
}

// The in-page consumption probe: after the crafted element is
// injected, report whether the canary URL reached another element's
// src/href/action (URL consumption), the browser navigated to the
// canary (navigation consumption), or the element's markup was
// re-inserted so its id appears twice in the live DOM (HTML
// consumption). Pure builder — the returned string is evaluated in
// the page via CDP.
export function consumptionProbeExpr(globalName, rid) {
  const name = String(globalName || '').replace(/[^A-Za-z0-9_$]/g, '');
  const canary = canaryUrl(rid);
  return `(() => {
    const canary = ${JSON.stringify(canary)};
    const name = ${JSON.stringify(name)};
    let urlConsumed = false;
    document.querySelectorAll('[src],[href],[action]').forEach((e) => {
      if (e.id === name) return;
      if (e.getAttribute('src') === canary || e.getAttribute('href') === canary || e.getAttribute('action') === canary) urlConsumed = true;
    });
    const navigated = location.href === canary || location.href.indexOf(canary) === 0;
    const occurrences = document.documentElement.outerHTML.split('id="' + name + '"').length - 1;
    const htmlDuplicated = occurrences > 1;
    const signal = urlConsumed ? 'url' : navigated ? 'navigation' : htmlDuplicated ? 'html' : null;
    return { urlConsumed, navigated, htmlDuplicated, signal };
  })()`;
}

/**
 * Drive the pasted page in a real headless browser: inject a crafted
 * element clobbering each candidate global and observe whether a
 * sink consumes it. Reuses the authenticated-render browser pattern
 * (transient container, fixed host-loopback CDP endpoint, container
 * removed in a finally). Anonymous: no lab session is carried, so
 * only the logged-out surface is tested. opts.runner / opts.cdpConnect
 * / opts.image are the test seams (defaults mirror authDomRender).
 * Returns { attempted, executed, clobbered, shape, globalName,
 * error, rid, canary }. Never throws.
 */
export async function driveClobberExecution(pageUrl, globalNames, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const canary = canaryUrl(rid);
  const out = {
    attempted: false,
    executed: false,
    clobbered: null,
    shape: null,
    globalName: null,
    error: null,
    rid,
    canary,
  };
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const cdpConnect = typeof opts.cdpConnect === 'function' ? opts.cdpConnect : connectCdp;
  const image = opts.image || DOM_RENDER_IMAGE;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : AUTH_RENDER_TIMEOUT_MS;
  const base = stripFragment(pageUrl);
  if (!base) {
    out.error = 'no url';
    return out;
  }
  const globals = (Array.isArray(globalNames) ? globalNames : []).filter(Boolean).slice(0, MAX_GLOBALS);
  if (!globals.length) {
    out.error = 'no global to drive';
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

    for (const name of globals) {
      out.globalName = name;
      await client.navigate(base);
      await sleep(DRIVE_SETTLE_MS);
      // Inject the crafted element the way attacker-injected markup
      // would — then check the clobber, then the consumption.
      const injected = await client.evaluate(
        `(() => { try { document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(clobberElement(name, rid))}); return true; } catch (e) { return false; } })()`
      );
      if (!injected) {
        out.error = 'crafted element could not be injected';
        return out;
      }
      await sleep(DRIVE_SETTLE_MS);
      const clobbered =
        (await client.evaluate(
          `(() => { const w = window.${name}; return !!w && w.tagName === 'A' && w.id === ${JSON.stringify(name)} && w.href === ${JSON.stringify(canary)}; })()`
        )) === true;
      if (out.clobbered === null) out.clobbered = clobbered;
      else if (!clobbered) out.clobbered = false;
      if (!clobbered) continue;
      const consumption = await client.evaluate(consumptionProbeExpr(name, rid));
      const consumed = Boolean(
        consumption && (consumption.urlConsumed || consumption.navigated || consumption.htmlDuplicated)
      );
      if (consumed) {
        out.executed = true;
        out.shape = consumption.signal || 'consumed';
        return out;
      }
    }
    if (out.clobbered === null) out.clobbered = false;
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
 * Probe DOM Clobbering (#89).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body so a
 *   script-less page skips instead of fetching).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, fetchPage, runner, cdpConnect, image,
 *   pageBody, diagnostics }.
 *   fetchPage is the bundle-fetch seam (defaults to fingerprint.fetchPage);
 *   runner / cdpConnect / image are the CDP-drive seams; pageBody is
 *   the served page HTML (mined for shipped id=/name= attributes).
 * @returns {object[]} findings (class 'dom_sink', medium) — at most 1
 *   per scan: the first global whose clobbering a sink consumes.
 */
export async function probeDomClobbering(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as basket-logic / workflow-skip /
  // session-fixation / twofa): canary lab creds + allowWrite + lab host
  // + depth !== 'quick'. The drive injects markup into the target's
  // origin, so it never runs outside the lab gate.
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

  // TIER 1 — mine first-party code for sink-feeding global reads,
  // and the served page for shipped clobberable names. Vendor /
  // framework bundles are excluded by the same gates as domXssSinks
  // (framework code reading globals is not the app's vuln).
  const sinks = [];
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
    for (const r of findClobberSinks(res.body)) {
      sinks.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findClobberSinks(body)) {
      sinks.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  const shippedNames = findShippedClobberNames(opts.pageBody);
  const flow = assessClobberFlow(sinks, shippedNames);
  setDiag('clobberSinks', flow.clobberSinks);
  setDiag('clobberNearSink', flow.clobberNearSink);
  if (!flow.drive) return findings; // proven true negative: no sink consumes a global

  // TIER 2 — drive the pasted page in a real browser: inject a
  // crafted element per candidate global and observe whether a sink
  // consumes the clobbered value.
  setDiag('driveAttempted', true);
  const drive = await driveClobberExecution(pageUrl, flow.globals, opts);
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, CDP unreachable,
  // injection failed) leaves the oracle uncalibrated — never a
  // finding, and never a proven true negative either. Clobbering
  // without consumption is the central negative case — also never
  // a finding.
  const verdict = drive.error
    ? { verdict: 'uncalibrated', reason: drive.error }
    : assessDriveResult({ clobbered: drive.clobbered, consumed: drive.executed });
  if (verdict.verdict !== 'confirmed') return findings;

  const near = sinks.find((r) => r.globalName === drive.globalName);
  findings.push({
    class: 'dom_sink',
    id: 'dom-clobbering',
    title: 'DOM Clobbering — injected markup clobbers a global consumed by a sink (MEDIUM)',
    severity: 'medium',
    url: pageUrl,
    parameter: `window.${drive.globalName}`,
    evidence: {
      request:
        `Drive-injected element ${clobberElement(drive.globalName, drive.rid)} into ${stripFragment(pageUrl)} ` +
        `(window.${drive.globalName} resolved to the injected node; consumption signal: ${drive.shape})`,
      response:
        `Real-browser observation: after the crafted element was injected, window.${drive.globalName} resolved to ` +
        `the injected anchor (href ${drive.canary}) AND a sink consumed it (${drive.shape}). ` +
        (near
          ? `Static mine found the read in ${near.source} (line ${near.line}, ${near.kind} fed by window.${near.globalName}): ${near.snippet} `
          : 'Static mine found sink-feeding global reads in first-party code. ') +
        `The element was injected by the drive to simulate attacker markup — exploiting this additionally requires an ` +
        `HTML-injection vector into the page; the confirmed fact is that the app trusts the clobbered global in a sink.`,
      impact_demo:
        'DOM clobbering — attacker markup that creates an element named after a trusted global (e.g. a config or avatar URL) makes the app consume the attacker value (redirect, script load, HTML injection). Avoid trusting window globals: read configuration from a namespaced object the DOM cannot shadow, validate URLs against an allowlist before assigning them to src/href, and render untrusted values via textContent (PortSwigger DOM clobbering).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __domClobberMeta = { phases: ['dom-clobbering'], depth: ['standard', 'deep'] };
