// Dark Matter rule-based scanner — Mutation XSS probe
// (coverage row #116 [High] Mutation XSS (mXSS), CWE-79;
// phase 98, 'mutation-xss').
//
// ORACLE (deterministic, no judge, no LLM, $0): markup a sanitizer
// approves is re-parsed by the browser into script-executing
// markup. The page is vulnerable only if attacker-controlled input
// reaches an HTML sink (innerHTML / outerHTML / insertAdjacentHTML /
// document.write) AFTER passing through a parse+serialize round-trip
// (a sanitizer, DOMParser, createHTMLDocument, a fragment parse, or
// an innerHTML read-back) that mutates it — a single plain innerHTML
// reflection is DOM XSS, not mXSS, and is this probe's explicit
// non-target: the canaries below are inert under one conforming
// HTML parse, so they execute only when the page's handling
// re-parses them. This probe goes one step further, in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles (cap 5, vendor/framework
//   excluded) + inline <script> blocks (cap 10) are scanned for
//   HTML-write assignments. ZERO sinks means no code can put a
//   value into the DOM as markup at runtime — a proven true
//   negative, no browser needed. Each sink is classified by what
//   sits within a context window around it (an attacker-input
//   source nearby / a sanitizer or parse round-trip nearby / a
//   plain literal value / neither) — a classification, not a flow
//   proof: minified code cannot be dataflow-traced by a window, so
//   ANY sink triggers tier 2. Deliberately NOT counted: a bare
//   sanitizer call with no HTML insertion (the sanitized value
//   never reaches the DOM), `textContent` / `createTextNode`
//   writes (text, never markup), and fragment appends
//   (`appendChild(createContextualFragment(…))`) — the fragment
//   is live DOM, not a serialized round-trip, so it is outside
//   this oracle (a stated limit, not a proof of safety).
//
//   TIER 2 — CDP EXECUTION DRIVE (only when tier 1 finds a sink):
//   a real headless browser (the same transient-container +
//   fixed-loopback-CDP pattern as renderDomAuthenticated) navigates
//   the pasted page with a mutation canary in the two
//   attacker-controlled inputs a page can read without interaction
//   — the query string (?dmmxss=…) and the fragment (#…) — and
//   reads back a window flag the canary sets only if it executes.
//   Two canary shapes, both inert on a single parse (PortSwigger
//   mXSS material): the math/mglyph/style mutation, where the
//   second <img> sits inside the first img's title attribute until
//   a serialize + re-parse frees it, and the form/math nesting
//   mutation, where an unclosed <style> swallows the payload as
//   raw text until a round-trip rearranges it. CONFIRM only when
//   the full oracle holds: the control render (a unique literal
//   filler) leaves the flag unset, and a canary render sets the
//   flag in two separate renders. The flag name is unique enough
//   that a bare coincidence is implausible, and the control +
//   two-render guards together rule out a page that merely
//   reflects the canary as inert text.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa /
// credential-stuffing / dom-postmessage / csti / css-injection);
// depth 'quick' skips the probe. BOUND: at most 1 browser drive
// per scan (control + 2 canary renders per shape, 2 shapes,
// 2 vectors), at most 5 bundles + 10 inline blocks mined.
// Findings are class 'dom_sink' — the default confirmation
// protocol judges them on signalCorrelated (see domXssSinks.js: a
// class containing 'xss' would route to xss_reflected and stay
// unconfirmed forever). Severity follows the row (High) ONLY on
// observed execution; a true negative fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A sink that only exists behind
//   login is not reached — the probe reports no execution with
//   driveAttempted=true and says so in the evidence, never a
//   proven true negative.
// - Only the query string and the fragment are tested as input
//   vectors. A sink fed exclusively by an API response, a
//   postMessage, or user interaction is not exercised — such a
//   sink is a true negative BY THIS ORACLE, not proof of safety;
//   the evidence says so.
// - The oracle confirms that mutation-shaped markup executes in
//   the page's handling. The canaries are inert under a single
//   conforming HTML parse, so execution implies the page re-parsed
//   them — a page that executed them with no re-parse step at all
//   would still be reported under this class; that case is not
//   expected for a conforming parser.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code writing markup is not
//   the app's vulnerability.

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

const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes / domXssSinks
const MAX_INLINE = 10;
const WINDOW_CHARS = 300; // context window around a sink for input-source classification
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive navigation (SPA render is async)
const SNIPPET_RADIUS = 80;
const CANARY_PARAM = 'dmmxss';
const FLAG_NAME = '__dmmxss'; // window flag the canary sets only if it executes

// ---- tier-1: mutation-XSS sinks (pure) --------------------------------------

// HTML-write assignments in first-party JS: the value assigned must
// be an expression, not a bare read. `+=` counts (it still writes
// markup); a comparison (`el.innerHTML == 'x'`) does not. A bare
// sanitizer call is NOT a sink on its own — the sanitized value
// must reach an HTML write to matter; sanitizer / parse calls are
// classification markers (see classifyMxssSink), not sinks.
const JS_SINK_RES = [
  { kind: 'innerHTML', re: /\.(innerHTML|outerHTML)\s*\+?=(?!=)/g },
  { kind: 'insertAdjacentHTML', re: /\.insertAdjacentHTML\s*\(/g },
  { kind: 'document-write', re: /document\.write(?:ln)?\s*\(/g },
];

// Attacker-input sources a sink's window may mention: the page
// reading the query string, the fragment, the URL, a form value, or
// a fetch response and putting it somewhere.
const INPUT_SOURCE_RE =
  /location\.(search|hash|href)|document\.URL|URLSearchParams|getParameter|\.value\b|fetch\s*\(|responseText/;

// Mutation-prone handling a sink's window may mention: a sanitizer
// call, a DOM parse, a fragment parse, or a document build — the
// parse+serialize round-trip that turns approved markup into
// executable markup.
const MUTATION_RE =
  /DOMPurify\s*\.\s*sanitize|sanitizeHtml|sanitizeFor|new\s+Sanitizer|parseFromString|createHTMLDocument|createContextualFragment/;

// A sink assigned a plain string literal can never carry input:
// `el.innerHTML = "<b>hi</b>"` is a constant, not a flow.
const LITERAL_ASSIGN_RE = /=\s*["'][^"']*["']\s*[;,)]/;

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

// Classify one JS sink by what sits within WINDOW_CHARS of it: an
// attacker-input source nearby, a sanitizer / parse round-trip
// nearby, only a literal value nearby, or neither. The matched sink
// text itself is blanked out of the window before the input /
// mutation checks — the sink token (innerHTML, insertAdjacentHTML)
// is not evidence of an input source or a round-trip. A window is
// a classification, NOT a flow proof — minified code cannot be
// dataflow-traced this way, which is why any sink at all triggers
// the tier-2 drive.
export function classifyMxssSink(body, index, matchLength) {
  const text = typeof body === 'string' ? body : '';
  const start = Math.max(0, index - WINDOW_CHARS);
  const end = Math.min(text.length, index + WINDOW_CHARS);
  const windowText = text.slice(start, end);
  const blanked =
    windowText.slice(0, index - start) +
    ' '.repeat(Math.max(0, matchLength || 0)) +
    windowText.slice(index - start + (matchLength || 0));
  if (INPUT_SOURCE_RE.test(blanked)) return { nearSink: true, sinkKind: 'user-input', safeOnly: false };
  if (MUTATION_RE.test(blanked)) return { nearSink: true, sinkKind: 'mutation-surface', safeOnly: false };
  if (LITERAL_ASSIGN_RE.test(windowText)) return { nearSink: false, sinkKind: null, safeOnly: true };
  return { nearSink: false, sinkKind: null, safeOnly: false };
}

// All HTML-write assignments in one JS source body, each with its
// kind, line, snippet and sink classification. Pure — exported for
// unit tests.
export function findMxssJsSinks(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  for (const { kind, re } of JS_SINK_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const cls = classifyMxssSink(text, m.index, m[0].length);
      out.push({
        index: m.index,
        kind,
        line: lineOf(text, m.index),
        snippet: snippetAround(text, m.index, m[0].length),
        nearSink: cls.nearSink,
        sinkKind: cls.sinkKind,
        safeOnly: cls.safeOnly,
        exfil: false,
      });
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// Tier-1 verdict from a sink list: how many sinks, how many sit
// near an attacker-input source or a mutation surface, and whether
// the tier-2 drive is needed. Pure — exported for unit tests.
export function assessMxssFlow(sinks) {
  const list = Array.isArray(sinks) ? sinks : [];
  const nearSink = list.filter((r) => r && r.nearSink).length;
  return { mxssSinks: list.length, nearSink, drive: list.length > 0 };
}

// ---- tier-2: canary values + URL builders (pure) ---------------------------

// MathML / mglyph / style mutation (PortSwigger mXSS): inert on a
// single parse — the second <img> sits inside the first img's title
// attribute — and executable only after a parse+serialize round-trip
// rearranges the style / comment boundary.
export function canaryMath() {
  return (
    '<math><mtext><table><mglyph><style><!--</style>' +
    '<img title="--><img src=x onerror="window.__dmmxss=1">">'
  );
}

// Form / MathML nesting mutation (PortSwigger mXSS): the unclosed
// <style> swallows the rest of the markup as raw text on a single
// parse, and only a serialize + re-parse frees the <img> to execute.
export function canaryFormMath() {
  return (
    '<form><math><mtext></form><form><mglyph><style></math>' +
    '<img src=x onerror="window.__dmmxss=1">'
  );
}

export function flagName() {
  return FLAG_NAME;
}

// Control value: a unique literal filler. It carries the rid but
// never the flag setter, so the oracle cannot be satisfied by the
// control alone.
export function controlValue(rid) {
  return `dmcontrol-${String(rid || '')}`;
}

// Query-string vector: ?dmmxss=<value> (or & when a query exists).
export function queryCanaryUrl(pageUrl, value) {
  try {
    const u = new URL(pageUrl);
    u.searchParams.set(CANARY_PARAM, value);
    return u.toString();
  } catch {
    return null;
  }
}

// Fragment vector: #<value> — read by the page via location.hash.
export function fragmentCanaryUrl(pageUrl, value) {
  try {
    const u = new URL(pageUrl);
    u.hash = encodeURIComponent(value);
    return u.toString();
  } catch {
    return null;
  }
}

// The in-page expression that reports whether the canary executed,
// as the string 'true' or 'false'. Pure — the returned string is
// evaluated in the page via CDP.
export function flagExpr() {
  return `(() => String(window.${FLAG_NAME} === 1))()`;
}

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests. The flag must be absent from the control render, set
// in the canary render, and set again in a second canary render.
// Any deviation is uncalibrated or not-executed — never a finding.
export function assessDriveResult({ controlFlag, canaryFlag, stable }) {
  if (controlFlag) {
    return { verdict: 'uncalibrated', reason: 'execution flag already set in the control render — oracle uncalibrated' };
  }
  if (!canaryFlag) {
    return { verdict: 'not-executed', reason: 'mutation canary did not execute in the rendered DOM' };
  }
  if (!stable) {
    return { verdict: 'uncalibrated', reason: 'execution flag set but not stable across renders' };
  }
  return { verdict: 'confirmed', reason: 'mutation canary executed in two renders, control clean' };
}

// ---- tier-2: the CDP drive --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseFlag(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

/**
 * Drive the pasted page in a real headless browser: navigate with a
 * control value, then twice with each mutation canary shape, in the
 * query string and then in the fragment, and read back the execution
 * flag after each navigation. Reuses the authenticated-render
 * browser pattern (transient container, fixed host-loopback CDP
 * endpoint, container removed in a finally). Anonymous: no lab
 * session is carried, so only the logged-out surface is tested.
 * opts.runner / opts.cdpConnect / opts.image are the test seams
 * (defaults mirror authDomRender).
 * Returns { attempted, executed, vector, shape, error, rid,
 * marker }. Never throws.
 */
export async function driveMutationXssExecution(pageUrl, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const marker = flagName();
  const control = controlValue(rid);
  const out = {
    attempted: false,
    executed: false,
    vector: null,
    shape: null,
    error: null,
    rid,
    marker,
  };
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const cdpConnect = typeof opts.cdpConnect === 'function' ? opts.cdpConnect : connectCdp;
  const image = opts.image || DOM_RENDER_IMAGE;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : AUTH_RENDER_TIMEOUT_MS;
  const settleMs =
    Number.isFinite(opts.settleMs) && opts.settleMs >= 0 ? opts.settleMs : DRIVE_SETTLE_MS;
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

    // One render: navigate, let the SPA settle, read whether the
    // canary executed. A fresh navigation resets the window, so the
    // flag is per-render: a canary that executes sets it in each
    // render independently; a canary that merely reflects as inert
    // text never sets it.
    const flagState = async (url) => {
      await client.navigate(url);
      await sleep(settleMs);
      const raw = await client.evaluate(flagExpr());
      return parseFlag(raw);
    };

    const vectors = [
      { name: 'query', control: queryCanaryUrl(pageUrl, control) },
      { name: 'fragment', control: fragmentCanaryUrl(pageUrl, control) },
    ];
    const shapes = [
      { name: 'math', value: canaryMath() },
      { name: 'form-math', value: canaryFormMath() },
    ];
    for (const v of vectors) {
      if (!v.control) {
        out.error = `cannot build ${v.name} canary URL`;
        return out;
      }
      const controlFlag = await flagState(v.control);
      if (controlFlag === null) {
        out.error = 'execution flag unreadable';
        return out;
      }
      for (const s of shapes) {
        const canaryUrl =
          v.name === 'query'
            ? queryCanaryUrl(pageUrl, s.value)
            : fragmentCanaryUrl(pageUrl, s.value);
        if (!canaryUrl) {
          out.error = `cannot build ${v.name} canary URL`;
          return out;
        }
        const f1 = await flagState(canaryUrl);
        const f2 = await flagState(canaryUrl);
        if (f1 === null || f2 === null) {
          out.error = 'execution flag unreadable';
          return out;
        }
        const verdict = assessDriveResult({
          controlFlag,
          canaryFlag: f1,
          stable: f1 && f2,
        });
        if (verdict.verdict === 'confirmed') {
          out.executed = true;
          out.vector = v.name;
          out.shape = s.name;
          return out;
        }
        if (verdict.verdict === 'uncalibrated') {
          out.error = verdict.reason;
          return out;
        }
        // not-executed for this shape: try the next one.
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
 * Probe mutation XSS (#116).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, fetchPage, runner, cdpConnect, image,
 *   diagnostics }. fetchPage is the bundle-fetch seam (defaults to
 *   fingerprint.fetchPage); runner / cdpConnect / image are the
 *   CDP-drive seams.
 * @returns {object[]} findings (class 'dom_sink', high) — at most 1
 *   per scan: the first input vector whose mutation canary executes
 *   in two renders with a clean control.
 */
export async function probeMutationXss(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as basket-logic / workflow-skip /
  // session-fixation / twofa / credential-stuffing / dom-postmessage /
  // csti / css-injection): canary lab creds + allowWrite + lab host +
  // depth !== 'quick'. The drive navigates the target with a
  // mutation canary, so it never runs outside the lab gate.
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

  // TIER 1 — mine first-party code for HTML-write assignments.
  // Vendor / framework bundles are excluded by the same gates as
  // domXssSinks (framework code writing markup is not the app's
  // vuln). A bare sanitizer call with no HTML insertion is not a
  // sink — it is a classification marker for the sinks around it.
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
    for (const r of findMxssJsSinks(res.body)) {
      sinks.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findMxssJsSinks(body)) {
      sinks.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessMxssFlow(sinks);
  setDiag('mxssSinks', flow.mxssSinks);
  setDiag('mxssNearSink', flow.nearSink);
  if (!flow.drive) return findings; // proven true negative: no HTML-write sink at all

  // TIER 2 — drive the pasted page in a real browser and observe
  // whether a mutation canary executes.
  setDiag('driveAttempted', true);
  const drive = await driveMutationXssExecution(pageUrl, opts);
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, CDP unreachable, control
  // contaminated, flag unstable, flag unreadable) leaves the oracle
  // uncalibrated — never a finding, and never a proven true
  // negative either.
  if (drive.error) return findings;
  if (!drive.executed) return findings;

  const near = sinks.find((r) => r.nearSink);
  const canary =
    drive.shape === 'form-math' ? canaryFormMath() : canaryMath();
  const canaryUrl =
    drive.vector === 'fragment'
      ? fragmentCanaryUrl(pageUrl, canary)
      : queryCanaryUrl(pageUrl, canary);
  findings.push({
    class: 'dom_sink',
    id: 'mutation-xss-flag-execution',
    title: 'Mutation XSS — sanitizer-approved markup mutated by browser parsing into executable markup (HIGH)',
    severity: 'high',
    url: pageUrl,
    parameter: `dmmxss → window.${FLAG_NAME}=1 via ${drive.vector} (${drive.shape})`,
    evidence: {
      request:
        `GET ${canaryUrl} in a real browser — control dmmxss=dmcontrol-${drive.rid} first (window.${FLAG_NAME} stays unset ` +
        `in the rendered DOM), then the ${drive.shape} mutation canary twice via the ${drive.vector} vector.`,
      response:
        `Mutation-XSS canary executed in a real browser: window.${FLAG_NAME} was set to 1 ` +
        `in two separate renders, the control render is clean. ` +
        (near
          ? `Static mine found the sink in ${near.source} (line ${near.line}, ${near.kind}, ${
              near.sinkKind === 'user-input'
                ? 'near user input'
                : near.sinkKind === 'mutation-surface'
                  ? 'near a sanitizer / parse round-trip'
                  : 'no input source nearby'
            }): ${near.snippet} `
          : 'Static mine found an HTML sink in first-party code. ') +
        `The injected markup is attacker-controlled (any link can carry it in the ${drive.vector}) and the ` +
        `page's sanitizer / parse round-trip mutates it into executable markup.`,
      impact_demo:
        'Mutation XSS (mXSS) — markup a sanitizer approves is re-parsed by the browser into script-executing markup, so an attacker link runs script in the victim session (session hijack, account takeover) even though the markup passed sanitization. Never feed attacker-controlled markup through innerHTML / insertAdjacentHTML / document.write after a parse-serialize round-trip — render user input as text, or sanitize with a mutation-aware sanitizer and re-validate the serialized output before insertion (PortSwigger mutation XSS).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __mxssMeta = { phases: ['mutation-xss'], depth: ['standard', 'deep'] };
