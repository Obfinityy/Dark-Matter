// Dark Matter rule-based scanner — Client-Side Template Injection probe
// (coverage row #190 [High] Client-Side Template Injection, CWE-79;
// phase 94, 'csti').
//
// ORACLE (deterministic, no judge, no LLM, $0): a client-side
// template engine (AngularJS $interpolate, Handlebars.compile,
// Mustache.render, _.template, doT, EJS, Nunjucks, Vue runtime
// compiler) evaluates attacker-controlled input as a template. The
// page is vulnerable only if its own first-party JS uses a runtime
// template engine AND attacker input reaches that engine AND the
// injected expression actually evaluates. Engine presence alone is
// NOT a finding — this probe goes one step further, in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for runtime template-engine markers (angular.module /
//   $interpolate, Handlebars.compile, Mustache.render, _.template,
//   doT.template, ejs.render, nunjucks.render, Vue.compile). ZERO
//   markers means no code can evaluate a template at runtime — a
//   proven true negative, no browser needed. Each marker is
//   classified by what sits within a context window around it (an
//   HTML sink / a safe text sink / neither) — a classification,
//   not a flow proof: minified code cannot be dataflow-traced by a
//   window, so ANY engine marker triggers tier 2.
//
//   TIER 2 — CDP EXECUTION DRIVE (only when tier 1 finds an
//   engine): a real headless browser (the same transient-container
//   + fixed-loopback-CDP pattern as renderDomAuthenticated)
//   navigates the pasted page with a template canary in the two
//   attacker-controlled inputs a page can read without interaction
//   — the query string (?dmcsti=...) and the fragment
//   (#...) — and reads back the rendered DOM. The canary is the
//   arithmetic expression `{{7*7*191}}`, which a runtime template
//   engine evaluates to 9352. CONFIRM only when the full SSTI
//   oracle holds on the rendered DOM (see oracleGuards.js, proven
//   in proof #18): the control render (a unique literal filler)
//   does NOT contain 9352, the canary render DOES contain 9352,
//   the literal `{{7*7*191}}` is ABSENT from the canary render,
//   and a repeat canary render shows 9352 at the SAME reflection
//   point (identical 40-char context window). The marker 9352 is
//   rare enough that a bare coincidence is implausible, and the
//   strip + same-point guards together rule out the fresh-token
//   coincidence that caused the proof-#18 false positive.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa /
// credential-stuffing / dom-postmessage); depth 'quick' skips the
// probe. BOUND: at most 1 browser drive per scan (control + 2
// canary renders per vector, 2 vectors), at most 5 bundles + 10
// inline blocks mined. Findings are class 'dom_sink' — the default
// confirmation protocol judges them on signalCorrelated (see
// domXssSinks.js: a class containing 'xss' would route to
// xss_reflected and stay unconfirmed forever). Severity follows
// the row (High) ONLY on observed evaluation; a true negative
// fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A template that only renders
//   behind login is not reached — the probe reports no execution
//   with driveAttempted=true and says so in the evidence, never a
//   proven true negative.
// - Only the query string and the fragment are tested as input
//   vectors. A template fed exclusively by an API response, a
//   postMessage, or user interaction is not exercised — such a
//   template is a true negative BY THIS ORACLE, not proof of
//   safety; the evidence says so.
// - A page that echoes the raw query/fragment value into the DOM
//   elsewhere (e.g. a search box value) keeps the literal canary
//   in the render, and the oracle then refuses to confirm even
//   when another slot evaluates it — the SSTI literal-absent rule,
//   applied conservatively. That can only hide an execution (a
//   missed finding), never create one.
// - Compiled-at-build-time frameworks (modern Angular, Vue SFC,
//   Svelte) do not re-evaluate `{{ }}` at runtime, so they carry
//   no runtime-engine marker and the probe reports a proven true
//   negative for them — correctly, for this oracle.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code is not the app's
//   vulnerability.

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
import { stripVolatileValues, sameReflectionPoint } from './oracleGuards.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes / domXssSinks
const MAX_INLINE = 10;
const MAX_FINDINGS = 1;
const WINDOW_CHARS = 300; // context window around an engine marker for sink classification
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive navigation (SPA render is async)
const SNIPPET_RADIUS = 80;
const CANARY_PARAM = 'dmcsti';
const MARKER = '9352'; // 7*7*191 — the same rare marker as the SSTI oracle

// ---- tier-1: runtime template engines (pure) -------------------------------

// Runtime template engines: the page must CALL one of these for a
// `{{ }}` expression to evaluate at runtime. Compiled-at-build-time
// frameworks (modern Angular, Vue SFC, Svelte) never appear here —
// they cannot evaluate user input as a template, so they are a true
// negative by construction, not a gap.
const ENGINE_RES = [
  { kind: 'angularjs', re: /angular\.module\s*\(|\$interpolate\s*\(|ng-bind-html|\$sce\.trustAsHtml\s*\(/g },
  { kind: 'handlebars', re: /Handlebars\.(compile|template)\s*\(/g },
  { kind: 'mustache', re: /Mustache\.(render|to_html)\s*\(/g },
  { kind: 'underscore', re: /_\.template\s*\(/g },
  { kind: 'dot', re: /doT\.template\s*\(/g },
  { kind: 'ejs', re: /ejs\.(render|compile)\s*\(/g },
  { kind: 'nunjucks', re: /nunjucks\.(render|renderString|compile)\s*\(/g },
  { kind: 'vue-runtime', re: /Vue\.compile\s*\(/g },
];

// HTML sinks a template's output must reach to execute in the DOM.
// v-html / ng-bind-html / $sce.trustAsHtml are template-aware sinks:
// they render template output as HTML instead of text.
const SINK_RES = [
  { kind: 'innerHTML', re: /["']innerHTML["']|\.innerHTML\s*=(?!=)/ },
  { kind: 'document.write', re: /document\.write(ln)?\s*\(/ },
  { kind: 'bypassSecurityTrustHtml', re: /\.bypassSecurityTrustHtml\s*\(/ },
  { kind: 'insertAdjacentHTML', re: /\.insertAdjacentHTML\s*\(/ },
  { kind: 'outerHTML', re: /\.outerHTML\s*=(?!=)/ },
  { kind: 'jQuery.html', re: /\.html\s*\(/ },
  { kind: 'v-html', re: /v-html/ },
  { kind: 'ng-bind-html', re: /ng-bind-html/ },
  { kind: 'trustAsHtml', re: /\$sce\.trustAsHtml\s*\(/ },
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

// Classify one engine marker by what sits within WINDOW_CHARS of it:
// an HTML sink nearby, only safe sinks nearby, or neither. A window
// is a classification, NOT a flow proof — minified code cannot be
// dataflow-traced this way, which is why any engine at all triggers
// the tier-2 drive.
export function classifyTemplateEngine(body, index) {
  const text = typeof body === 'string' ? body : '';
  const start = Math.max(0, index - WINDOW_CHARS);
  const end = Math.min(text.length, index + WINDOW_CHARS);
  const windowText = text.slice(start, end);
  for (const { kind, re } of SINK_RES) {
    if (re.test(windowText)) return { nearSink: true, sinkKind: kind, safeOnly: false };
  }
  for (const { kind, re } of SAFE_SINK_RES) {
    if (re.test(windowText)) return { nearSink: false, sinkKind: kind, safeOnly: true };
  }
  return { nearSink: false, sinkKind: null, safeOnly: false };
}

// All runtime template-engine markers in one source body, each with
// its kind, line, snippet and sink classification. Pure — exported
// for unit tests.
export function findTemplateEngines(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  for (const { kind, re } of ENGINE_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const cls = classifyTemplateEngine(text, m.index);
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

// Tier-1 verdict from an engine list: how many engines, how many sit
// near an HTML sink, and whether the tier-2 drive is needed. Pure —
// exported for unit tests.
export function assessTemplateFlow(engines) {
  const list = Array.isArray(engines) ? engines : [];
  const nearSink = list.filter((r) => r && r.nearSink).length;
  return { engines: list.length, nearSink, drive: list.length > 0 };
}

// ---- tier-2: canary values + URL builders (pure) ---------------------------

// The arithmetic expression a runtime template engine evaluates to
// 9352. The marker is the same rare 4-digit value as the SSTI
// oracle — a bare coincidence in page text is implausible, and the
// strip + same-point guards rule out the fresh-token coincidence
// that caused the proof-#18 false positive.
export function canaryValue() {
  return '{{7*7*191}}';
}

export function markerValue() {
  return MARKER;
}

// Control value: a unique literal filler. It carries the rid but
// never the marker or the canary, so the oracle cannot be satisfied
// by the control alone.
export function controlValue(rid) {
  return `dmcontrol-${String(rid || '')}`;
}

// Query-string vector: ?dmcsti=<value> (or & when a query exists).
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

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests. Mirrors the SSTI oracle exactly: the marker must be
// present in the canary render, absent from the control render, the
// literal canary must be absent from the canary render, and the
// marker must sit at the same reflection point in two separate
// canary renders. Any deviation is uncalibrated or not-executed —
// never a finding.
export function assessDriveResult({ controlMarker, canaryMarker, literalPresent, samePoint }) {
  if (controlMarker) {
    return { verdict: 'uncalibrated', reason: 'marker 9352 already present in the control render — oracle uncalibrated' };
  }
  if (!canaryMarker) {
    return { verdict: 'not-executed', reason: 'canary was not evaluated in the rendered DOM' };
  }
  if (literalPresent) {
    return { verdict: 'not-executed', reason: 'canary reflected literally, not evaluated' };
  }
  if (!samePoint) {
    return { verdict: 'uncalibrated', reason: 'marker present but not at a stable reflection point' };
  }
  return { verdict: 'confirmed', reason: 'canary evaluated to 9352 at the same reflection point in two renders, control clean' };
}

// ---- tier-2: the CDP drive --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drive the pasted page in a real headless browser: navigate with a
 * control value, then twice with the template canary, in the query
 * string and then in the fragment, and read back the rendered DOM
 * after each navigation. Reuses the authenticated-render browser
 * pattern (transient container, fixed host-loopback CDP endpoint,
 * container removed in a finally). Anonymous: no lab session is
 * carried, so only the logged-out surface is tested.
 * opts.runner / opts.cdpConnect / opts.image are the test seams
 * (defaults mirror authDomRender).
 * Returns { attempted, executed, vector, reflected, error, rid,
 * marker }. Never throws.
 */
export async function driveCstiExecution(pageUrl, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const marker = markerValue();
  const canary = canaryValue();
  const control = controlValue(rid);
  const out = {
    attempted: false,
    executed: false,
    vector: null,
    reflected: false,
    error: null,
    rid,
    marker,
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

    // One render: navigate, let the SPA settle, read the serialised
    // DOM. The serialised DOM is the reflection surface: a template
    // evaluation shows up here as the evaluated value, a literal
    // reflection as the canary text itself.
    const renderedHtml = async (url) => {
      await client.navigate(url);
      await sleep(DRIVE_SETTLE_MS);
      const html = await client.evaluate('document.documentElement.outerHTML');
      return typeof html === 'string' ? html : null;
    };

    const vectors = [
      { name: 'query', control: queryCanaryUrl(pageUrl, control), canary: queryCanaryUrl(pageUrl, canary) },
      { name: 'fragment', control: fragmentCanaryUrl(pageUrl, control), canary: fragmentCanaryUrl(pageUrl, canary) },
    ];
    for (const v of vectors) {
      if (!v.control || !v.canary) {
        out.error = `cannot build ${v.name} canary URL`;
        return out;
      }
      const controlRaw = await renderedHtml(v.control);
      const c1Raw = await renderedHtml(v.canary);
      const c2Raw = await renderedHtml(v.canary);
      if (controlRaw === null || c1Raw === null || c2Raw === null) {
        out.error = 'rendered DOM unavailable';
        return out;
      }
      // Guard (a): strip per-request random values from all three
      // renders before the differential, so the oracle can never
      // match inside a fresh token.
      const controlHtml = stripVolatileValues(controlRaw);
      const c1 = stripVolatileValues(c1Raw);
      const c2 = stripVolatileValues(c2Raw);
      if (c1.includes(canary)) out.reflected = true;
      const verdict = assessDriveResult({
        controlMarker: controlHtml.includes(marker),
        canaryMarker: c1.includes(marker),
        literalPresent: c1.includes(canary),
        samePoint: sameReflectionPoint(c1, c2, marker),
      });
      if (verdict.verdict === 'confirmed') {
        out.executed = true;
        out.vector = v.name;
        return out;
      }
      if (verdict.verdict === 'uncalibrated') {
        out.error = verdict.reason;
        return out;
      }
      // not-executed on this vector: try the next one.
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
 * Probe client-side template injection (#190).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body so a
 *   script-less page skips instead of fetching).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, fetchPage, runner, cdpConnect, image, diagnostics }.
 *   fetchPage is the bundle-fetch seam (defaults to fingerprint.fetchPage);
 *   runner / cdpConnect / image are the CDP-drive seams.
 * @returns {object[]} findings (class 'dom_sink', high) — at most 1 per
 *   scan: the first input vector whose canary evaluates.
 */
export async function probeCsti(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as basket-logic / workflow-skip /
  // session-fixation / twofa / credential-stuffing / dom-postmessage):
  // canary lab creds + allowWrite + lab host + depth !== 'quick'.
  // The drive navigates the target with a template canary, so it
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

  // TIER 1 — mine first-party code for runtime template engines.
  // Vendor / framework bundles are excluded by the same gates as
  // domXssSinks (framework code calling a template API is not the
  // app's vuln).
  const engines = [];
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
    for (const r of findTemplateEngines(res.body)) {
      engines.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findTemplateEngines(body)) {
      engines.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessTemplateFlow(engines);
  setDiag('engines', flow.engines);
  setDiag('enginesNearSink', flow.nearSink);
  if (!flow.drive) return findings; // proven true negative: no runtime template engine

  // TIER 2 — drive the pasted page in a real browser and observe
  // whether the template canary evaluates.
  setDiag('driveAttempted', true);
  const drive = await driveCstiExecution(pageUrl, opts);
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, CDP unreachable, control
  // contaminated, marker unstable, rendered DOM unavailable) leaves
  // the oracle uncalibrated — never a finding, and never a proven
  // true negative either.
  if (drive.error) return findings;
  if (!drive.executed) return findings;

  const near = engines.find((r) => r.nearSink);
  const canaryUrl =
    drive.vector === 'fragment'
      ? fragmentCanaryUrl(pageUrl, canaryValue())
      : queryCanaryUrl(pageUrl, canaryValue());
  findings.push({
    class: 'dom_sink',
    id: 'csti-template-eval',
    title: 'Client-side template injection — page evaluates {{7*7*191}} to 9352 in a client-side template (HIGH)',
    severity: 'high',
    url: pageUrl,
    parameter: `{{7*7*191}} → 9352 via ${drive.vector}`,
    evidence: {
      request:
        `GET ${canaryUrl} in a real browser — control dmcsti=dmcontrol-${drive.rid} first (no 9352 in the ` +
        `rendered DOM), then the canary {{7*7*191}} twice via the ${drive.vector} vector.`,
      response:
        `Template canary evaluated in a real browser: the rendered DOM contains 9352 at the same reflection ` +
        `point in two separate renders, the control render is clean, and the literal {{7*7*191}} is absent. ` +
        (near
          ? `Static mine found the engine in ${near.source} (line ${near.line}, ${near.kind}, near ${near.sinkKind || 'a sink'}): ${near.snippet} `
          : 'Static mine found a runtime template engine in first-party code. ') +
        `The injected expression is attacker-controlled (any link can carry it in the ${drive.vector}) and the ` +
        `page's template engine evaluates it unencoded.`,
      impact_demo:
        'Client-side template injection — an attacker link carrying {{7*7}} (or a sandbox-escape chain after it) executes script in the victim origin (session theft, actions as the user). Never pass user input to a template engine as a template — render data with context-aware encoding / textContent, and compile templates from trusted sources only (PortSwigger client-side template injection).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __cstiMeta = { phases: ['csti'], depth: ['standard', 'deep'] };
