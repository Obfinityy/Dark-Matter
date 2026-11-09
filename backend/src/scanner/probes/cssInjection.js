// Dark Matter rule-based scanner — CSS Injection probe
// (coverage row #194 [Medium] CSS Injection, CWE-79;
// phase 96, 'css-injection').
//
// ORACLE (deterministic, no judge, no LLM, $0): attacker-controlled
// input reaches a CSS context — an inline `style` attribute, a
// `<style>` block, or a runtime style write (`cssText`, a style
// property assignment, `setAttribute('style', …)`, `insertRule`) —
// and changes how the page renders. The page is vulnerable only if
// user input actually reaches such a context AND the injected CSS
// takes effect. A static style attribute or a compiled-in component
// stylesheet is NOT a finding — this probe goes one step further, in
// two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the served page HTML is scanned for CSS contexts (inline
//   `style="…"` attributes, `<style>` blocks) and the page's own
//   first-party bundles + inline <script> blocks for runtime CSS
//   writes. ZERO contexts means no code can put a value into CSS
//   at runtime — a proven true negative, no browser needed. Each
//   sink is classified by what sits within a context window around
//   it (an attacker-input source nearby / a plain literal value /
//   neither) — a classification, not a flow proof: minified code
//   cannot be dataflow-traced by a window, so ANY sink triggers
//   tier 2. Deliberately NOT counted: Angular component `styles:[…]`
//   arrays (static CSS compiled into the bundle), SVG `url(#…)` fill
//   / clip-path references, and `style="…"` string literals whose
//   value is a compile-time constant (e.g. a template that wraps a
//   user comment in a fixed-width span — the style value never
//   carries input; the comment content is an innerHTML matter, not
//   a CSS one). A bare `url(` in JS is SVG/static noise, never a
//   sink on its own.
//
//   TIER 2 — CDP EXECUTION DRIVE (only when tier 1 finds a sink):
//   a real headless browser (the same transient-container +
//   fixed-loopback-CDP pattern as renderDomAuthenticated) navigates
//   the pasted page with a CSS canary in the two attacker-controlled
//   inputs a page can read without interaction — the query string
//   (?dmcss=…) and the fragment (#…) — and reads back the computed
//   styles of every element. The canary sets a marker colour no
//   sane page uses, `#0b1621` (rgb(11, 22, 33)), in two shapes: a
//   declaration `color:#0b1621` (style-attribute / cssText /
//   style-property contexts) and a rule `*{color:#0b1621}`
//   (`<style>`-block context). CONFIRM only when the full oracle
//   holds: the control render (a unique literal filler) leaves NO
//   element with the marker colour, and a canary render shows the
//   marker colour on the SAME element in two separate renders.
//   The marker colour is rare enough that a bare coincidence is
//   implausible, and the control + same-element guards together
//   rule out a page that merely uses that colour already.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa /
// credential-stuffing / dom-postmessage / csti); depth 'quick'
// skips the probe. BOUND: at most 1 browser drive per scan
// (control + 2 canary renders per shape, 2 shapes, 2 vectors), at
// most 5 bundles + 10 inline blocks mined. Findings are class
// 'dom_sink' — the default confirmation protocol judges them on
// signalCorrelated (see domXssSinks.js: a class containing 'xss'
// would route to xss_reflected and stay unconfirmed forever).
// Severity follows the row (Medium) ONLY on observed execution; a
// true negative fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A style context that only exists
//   behind login is not reached — the probe reports no execution
//   with driveAttempted=true and says so in the evidence, never a
//   proven true negative.
// - Only the query string and the fragment are tested as input
//   vectors. A style context fed exclusively by an API response, a
//   postMessage, or user interaction is not exercised — such a
//   context is a true negative BY THIS ORACLE, not proof of
//   safety; the evidence says so.
// - The drive oracle observes COMPUTED STYLES only. A stylesheet
//   URL loaded from attacker input (`<link href=…>`, `@import`
//   with a variable) or a `url()` exfiltration fetch does not
//   change computed styles, so this oracle cannot confirm those
//   classes — a sink of those kinds alone drives, finds no
//   execution, and fires nothing. That is a stated limit of the
//   oracle, not a proof that the class is absent.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code writing styles is not
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

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes / domXssSinks
const MAX_INLINE = 10;
const MAX_FINDINGS = 1;
const WINDOW_CHARS = 300; // context window around a sink for input-source classification
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive navigation (SPA render is async)
const SNIPPET_RADIUS = 80;
const CANARY_PARAM = 'dmcss';
const MARKER_HEX = '#0b1621'; // marker colour — no sane page uses it as a default
const MARKER_COLOR = 'rgb(11, 22, 33)'; // getComputedStyle serialisation of MARKER_HEX

// ---- tier-1: CSS sinks (pure) ------------------------------------------------

// Runtime CSS writes in first-party JS: the value assigned must be
// an expression, not a bare read. `.style.cssText =` is listed
// separately from the generic style-property assignment (which
// excludes cssText so one write is never counted twice).
// `setProperty(` takes (name, value) — the value is the second
// argument, so the call form alone is the sink shape. `insertRule` /
// `addRule` mutate a live stylesheet. `@import` counts only when
// its argument is NOT a quoted literal or url("…") — a static
// import is a build-time constant, never attacker input. Two forms
// are caught: a dynamic argument (template placeholder, url(var))
// and a string-concat ('@import ' + x, where the closing quote
// hides the dynamic part from the first form).
const JS_SINK_RES = [
  { kind: 'cssText', re: /\.cssText\s*=(?!=)/g },
  { kind: 'style-prop', re: /\.style\s*\.\s*(?!cssText\b)[A-Za-z][A-Za-z0-9]*\s*=(?!=)/g },
  { kind: 'style-prop', re: /\.style\s*\.\s*setProperty\s*\(/g },
  { kind: 'style-attr-set', re: /\.setAttribute\s*\(\s*['"]style['"]/g },
  { kind: 'stylesheet-rule', re: /\.(insertRule|addRule)\s*\(/g },
  { kind: 'css-import', re: /@import\s+(?!["']|url\(\s*["'])|@import\s*["']\s*\+/g },
];

// HTML CSS contexts: an inline style attribute or a <style> block.
// The served value is what the server already produced — a
// reflection of user input would be visible here, which is exactly
// what the tier-2 drive tests with its canary.
const STYLE_ATTR_RE = /<[^>]*\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;

// Attacker-input sources a sink's window may mention: the page
// reading the query string, the fragment, the URL, a form value, or
// a fetch response and putting it somewhere.
const INPUT_SOURCE_RE =
  /location\.(search|hash|href)|document\.URL|URLSearchParams|getParameter|\.value\b|fetch\s*\(|responseText|innerHTML/;

// A sink assigned a plain string literal can never carry input:
// `el.style.cssText = "color:red"` is a constant, not a flow.
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
// attacker-input source nearby, only a literal value nearby, or
// neither. A window is a classification, NOT a flow proof —
// minified code cannot be dataflow-traced this way, which is why
// any sink at all triggers the tier-2 drive.
export function classifyCssSink(body, index) {
  const text = typeof body === 'string' ? body : '';
  const start = Math.max(0, index - WINDOW_CHARS);
  const end = Math.min(text.length, index + WINDOW_CHARS);
  const windowText = text.slice(start, end);
  if (INPUT_SOURCE_RE.test(windowText)) return { nearSink: true, sinkKind: 'user-input', safeOnly: false };
  if (LITERAL_ASSIGN_RE.test(windowText)) return { nearSink: false, sinkKind: null, safeOnly: true };
  return { nearSink: false, sinkKind: null, safeOnly: false };
}

// All CSS contexts in one served HTML body: inline style attributes
// and <style> blocks. A block carrying an attribute-selector
// exfiltration shape (`[value^=…]` + `url(`) is flagged on the
// record — that is the classic CSS-exfiltration mechanism — but
// still counts once, as one block. Pure — exported for unit tests.
export function findCssHtmlSinks(html) {
  const text = typeof html === 'string' ? html : '';
  if (!text) return [];
  const out = [];
  let m;
  const attrRx = new RegExp(STYLE_ATTR_RE.source, STYLE_ATTR_RE.flags);
  while ((m = attrRx.exec(text)) !== null) {
    out.push({
      index: m.index,
      kind: 'style-attr',
      line: lineOf(text, m.index),
      snippet: snippetAround(text, m.index, m[0].length),
      nearSink: false,
      sinkKind: null,
      safeOnly: false,
      exfil: false,
    });
  }
  const blockRx = new RegExp(STYLE_BLOCK_RE.source, STYLE_BLOCK_RE.flags);
  while ((m = blockRx.exec(text)) !== null) {
    const inner = m[1] || '';
    out.push({
      index: m.index,
      kind: 'style-block',
      line: lineOf(text, m.index),
      snippet: snippetAround(text, m.index, m[0].length),
      nearSink: false,
      sinkKind: null,
      safeOnly: false,
      exfil: /\[value/i.test(inner) && /url\s*\(/i.test(inner),
    });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// All runtime CSS writes in one JS source body, each with its kind,
// line, snippet and sink classification. Pure — exported for unit tests.
export function findCssJsSinks(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  for (const { kind, re } of JS_SINK_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const cls = classifyCssSink(text, m.index);
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
// near an attacker-input source, and whether the tier-2 drive is
// needed. Pure — exported for unit tests.
export function assessCssFlow(sinks) {
  const list = Array.isArray(sinks) ? sinks : [];
  const nearSink = list.filter((r) => r && r.nearSink).length;
  return { cssSinks: list.length, nearSink, drive: list.length > 0 };
}

// ---- tier-2: canary values + URL builders (pure) ---------------------------

// Declaration shape: valid as a style-attribute value, a cssText
// value, or a style-property value. Rule shape: valid inside a
// <style> block. One canary cannot be both — the drive tries each
// shape in turn.
export function canaryDeclaration() {
  return `color:${MARKER_HEX}`;
}

export function canaryRule() {
  return `*{color:${MARKER_HEX}}`;
}

export function markerHex() {
  return MARKER_HEX;
}

export function markerColor() {
  return MARKER_COLOR;
}

// Control value: a unique literal filler. It carries the rid but
// never the marker colour, so the oracle cannot be satisfied by
// the control alone.
export function controlValue(rid) {
  return `dmcontrol-${String(rid || '')}`;
}

// Query-string vector: ?dmcss=<value> (or & when a query exists).
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

// The in-page expression that lists the elements whose computed
// colour is the marker colour, as a JSON array of element indices.
// Pure — the returned string is evaluated in the page via CDP.
export function markerElementsExpr() {
  return (
    `(() => { const hit = []; const els = document.querySelectorAll('*'); ` +
    `for (let i = 0; i < els.length; i++) { try { ` +
    `if (getComputedStyle(els[i]).color === ${JSON.stringify(MARKER_COLOR)}) hit.push(i); ` +
    `} catch (e) {} } return JSON.stringify(hit); })()`
  );
}

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests. The marker colour must be absent from the control
// render, present on at least one element in the canary render,
// and present on the SAME element in two separate canary renders.
// Any deviation is uncalibrated or not-executed — never a finding.
export function assessDriveResult({ controlMarker, canaryMarker, samePoint }) {
  if (controlMarker) {
    return { verdict: 'uncalibrated', reason: 'marker colour already present in the control render — oracle uncalibrated' };
  }
  if (!canaryMarker) {
    return { verdict: 'not-executed', reason: 'canary CSS did not change any computed style in the rendered DOM' };
  }
  if (!samePoint) {
    return { verdict: 'uncalibrated', reason: 'marker colour present but not on a stable element across renders' };
  }
  return { verdict: 'confirmed', reason: 'canary CSS changed the computed style of the same element in two renders, control clean' };
}

// ---- tier-2: the CDP drive --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMarkerElements(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((n) => Number.isInteger(n));
  } catch {
    return null;
  }
}

function sameElements(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  return left.some((n) => right.includes(n));
}

/**
 * Drive the pasted page in a real headless browser: navigate with a
 * control value, then twice with each CSS canary shape, in the query
 * string and then in the fragment, and read back the computed
 * styles after each navigation. Reuses the authenticated-render
 * browser pattern (transient container, fixed host-loopback CDP
 * endpoint, container removed in a finally). Anonymous: no lab
 * session is carried, so only the logged-out surface is tested.
 * opts.runner / opts.cdpConnect / opts.image are the test seams
 * (defaults mirror authDomRender).
 * Returns { attempted, executed, vector, shape, error, rid,
 * marker }. Never throws.
 */
export async function driveCssInjectionExecution(pageUrl, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const marker = markerHex();
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

    // One render: navigate, let the SPA settle, read which elements
    // carry the marker colour. The element-index list is the
    // reflection surface: a canary that takes effect shows up here
    // as the same index in two renders; a canary that merely
    // reflects as text never appears.
    const markerElements = async (url) => {
      await client.navigate(url);
      await sleep(settleMs);
      const raw = await client.evaluate(markerElementsExpr());
      return parseMarkerElements(raw);
    };

    const vectors = [
      { name: 'query', control: queryCanaryUrl(pageUrl, control) },
      { name: 'fragment', control: fragmentCanaryUrl(pageUrl, control) },
    ];
    const shapes = [
      { name: 'declaration', value: canaryDeclaration() },
      { name: 'rule', value: canaryRule() },
    ];
    for (const v of vectors) {
      if (!v.control) {
        out.error = `cannot build ${v.name} canary URL`;
        return out;
      }
      const controlRaw = await markerElements(v.control);
      if (controlRaw === null) {
        out.error = 'computed styles unavailable';
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
        const c1 = await markerElements(canaryUrl);
        const c2 = await markerElements(canaryUrl);
        if (c1 === null || c2 === null) {
          out.error = 'computed styles unavailable';
          return out;
        }
        const verdict = assessDriveResult({
          controlMarker: controlRaw.length > 0,
          canaryMarker: c1.length > 0,
          samePoint: sameElements(c1, c2),
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
 * Probe CSS injection (#194).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body so a
 *   script-less page still mines its HTML — the served page itself is
 *   the primary CSS-injection surface, unlike the JS-only probes).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, pageBody, fetchPage, runner, cdpConnect, image,
 *   diagnostics }. pageBody is the pasted page's served HTML (runScan
 *   passes it); fetchPage is the bundle-fetch seam (defaults to
 *   fingerprint.fetchPage); runner / cdpConnect / image are the
 *   CDP-drive seams.
 * @returns {object[]} findings (class 'dom_sink', medium) — at most 1
 *   per scan: the first input vector whose canary changes a computed
 *   style.
 */
export async function probeCssInjection(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as basket-logic / workflow-skip /
  // session-fixation / twofa / credential-stuffing / dom-postmessage /
  // csti): canary lab creds + allowWrite + lab host + depth !==
  // 'quick'. The drive navigates the target with a CSS canary, so it
  // never runs outside the lab gate.
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
  const pageBody = typeof opts.pageBody === 'string' ? opts.pageBody : '';

  // TIER 1 — mine the served page HTML for CSS contexts AND
  // first-party code for runtime CSS writes. Vendor / framework
  // bundles are excluded by the same gates as domXssSinks
  // (framework code writing styles is not the app's vuln). The
  // served HTML is mined even when the page carries no scripts:
  // a server-rendered page with zero JS can still reflect input
  // into a style attribute — gating this probe on script targets
  // would leave exactly that surface untested.
  const sinks = [];
  for (const r of findCssHtmlSinks(pageBody)) {
    sinks.push({ ...r, source: pageUrl });
  }
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
    for (const r of findCssJsSinks(res.body)) {
      sinks.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findCssJsSinks(body)) {
      sinks.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessCssFlow(sinks);
  setDiag('cssSinks', flow.cssSinks);
  setDiag('cssNearSink', flow.nearSink);
  if (!flow.drive) return findings; // proven true negative: no CSS context at all

  // TIER 2 — drive the pasted page in a real browser and observe
  // whether the CSS canary changes a computed style.
  setDiag('driveAttempted', true);
  const drive = await driveCssInjectionExecution(pageUrl, opts);
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, CDP unreachable, control
  // contaminated, marker unstable, computed styles unavailable)
  // leaves the oracle uncalibrated — never a finding, and never a
  // proven true negative either.
  if (drive.error) return findings;
  if (!drive.executed) return findings;

  const near = sinks.find((r) => r.nearSink);
  const canary =
    drive.shape === 'rule' ? canaryRule() : canaryDeclaration();
  const canaryUrl =
    drive.vector === 'fragment'
      ? fragmentCanaryUrl(pageUrl, canary)
      : queryCanaryUrl(pageUrl, canary);
  findings.push({
    class: 'dom_sink',
    id: 'css-injection-computed-style',
    title: 'CSS injection — attacker input reflected into a CSS context changes computed styles (MEDIUM)',
    severity: 'medium',
    url: pageUrl,
    parameter: `dmcss → computed color ${MARKER_HEX} via ${drive.vector} (${drive.shape})`,
    evidence: {
      request:
        `GET ${canaryUrl} in a real browser — control dmcss=dmcontrol-${drive.rid} first (no element ` +
        `carries the marker colour ${MARKER_COLOR} in the rendered DOM), then the canary ${canary} twice via the ${drive.vector} vector.`,
      response:
        `CSS canary took effect in a real browser: the same element carries the computed colour ${MARKER_COLOR} ` +
        `in two separate renders, the control render is clean. ` +
        (near
          ? `Static mine found the sink in ${near.source} (line ${near.line}, ${near.kind}, near user input): ${near.snippet} `
          : 'Static mine found a CSS context in first-party code. ') +
        `The injected value is attacker-controlled (any link can carry it in the ${drive.vector}) and the ` +
        `page applies it as CSS unencoded.`,
      impact_demo:
        'CSS injection — an attacker link carrying a crafted style value restyles the victim page (UI redress / phishing: fake login forms, hidden security warnings) and, where the value reaches a <style> block, enables attribute-selector exfiltration of form data via url() fetches. Never interpolate user input into a style attribute, a <style> block, cssText, or a stylesheet rule — render values as text and allowlist style values server-side (PortSwigger CSS injection).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __cssMeta = { phases: ['css-injection'], depth: ['standard', 'deep'] };
