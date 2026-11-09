// Dark Matter rule-based scanner — DOM-Based Open Redirection probe
// (coverage row #91 [Medium] DOM-Based Open Redirection, CWE-601 |
// Client-Side & Browser; phase 98, 'dom-open-redirect').
//
// ORACLE (deterministic, no judge, no LLM, $0): an attacker link
// carries a redirect target in a URL parameter; the page is
// vulnerable only if its own first-party JS reads a location
// parameter AND the value reaches a redirect sink (location.assign
// / location.replace / location.href = / window.open) AND the
// browser actually navigates to the attacker target. Sink presence
// alone is NOT a finding — the dom-xss-sinks probe already
// fingerprints sinks statically (class dom_sink, INFO). This probe
// goes one step further, in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for redirect sinks. ZERO sinks means no code can
//   redirect the page at all — a proven true negative, no browser
//   needed. Each sink is classified by what sits within a context
//   window around it (a location-parameter read / a URL read /
//   nothing) — a classification, not a flow proof: minified code
//   cannot be dataflow-traced by a window, so ANY sink triggers
//   tier 2. Parameter names read near a sink (.get('name'),
//   getParameter('name')) are collected so tier 2 drives the exact
//   parameters the page actually reads.
//
//   TIER 2 — CDP REDIRECT DRIVE (only when tier 1 finds a sink):
//   a real headless browser (the same transient-container +
//   fixed-loopback-CDP pattern as renderDomAuthenticated) navigates
//   the pasted page with a CONTROL value first, then with a canary
//   redirect target, and observes whether the browser navigates to
//   it. Two canary shapes, because pages accept targets in
//   different forms:
//     (A) absolute: `https://evil.example/__dmredir_<rid>` — the
//         value assigned directly to a redirect sink.
//     (R) protocol-relative: `//evil.example/__dmredir_<rid>` —
//         the value a page accepts when it builds a URL from a
//         host-ish parameter.
//   The canary host is evil.example — the .example TLD never
//   resolves (the spreadsheet's own lab probe host), so the
//   navigation is observable (location.href becomes the canary)
//   without ever reaching a real server. CONFIRM only when the
//   control value leaves the browser on the pasted origin AND a
//   canary navigation lands on the canary target (same tab, or a
//   new tab opened by window.open — the drive lists targets after
//   each canary navigation). The canary path carries a per-scan
//   random id so a coincidental navigation can never match it.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa); depth
// 'quick' skips the probe. BOUND: at most 1 browser drive per scan
// (control + at most 2 canary shapes per parameter, at most 3
// parameters), at most 5 bundles + 10 inline blocks mined.
// Findings are class 'dom_sink' — the default confirmation
// protocol judges them on signalCorrelated (see domXssSinks.js: a
// class containing 'xss' would route to xss_reflected and stay
// unconfirmed forever). Severity follows the row (Medium) ONLY on
// observed navigation; a true negative fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A redirect sink that only exists
//   behind login is not reached — the probe reports no navigation
//   with driveAttempted=true and says so in the evidence, never a
//   proven true negative.
// - The drive tests LOAD-time sinks only. A sink that fires only
//   on user interaction (a click handler reading a parameter) is
//   not exercised.
// - A sink that reads a parameter name tier 1 could not extract
//   (a computed property, a destructured search string, a framework
//   router) never receives the canary — the drive falls back to the
//   generic names `redirect` / `next`, and a miss there is a true
//   negative BY THIS ORACLE, not proof of safety; the evidence
//   says so.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code redirecting (e.g. a
//   router) is not the app's vulnerability.

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
const MAX_PARAMS = 3; // candidate parameter names driven per scan
const WINDOW_CHARS = 300; // context window around a sink for source classification
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive navigation (redirects are async)
const SNIPPET_RADIUS = 80;

// Generic parameter names tried when tier 1 mines a redirect sink
// but extracts no parameter name the page reads.
const GENERIC_PARAMS = ['redirect', 'next'];
// The canary host: the .example TLD never resolves, so the browser
// shows an error page whose location.href is still the canary URL.
const CANARY_HOST = 'evil.example';

// ---- tier-1: redirect sinks (pure) -----------------------------------------

// location.assign( / location.replace( — optionally qualified
// (window/self/top/parent/document). location.href = / location = —
// the assignment form (a bare `=` after location, never `==`).
// window.open( — a new-tab redirect sink.
const REDIRECT_SINK_RES = [
  { kind: 'location.assign', re: /(?:\b(?:window|document|self|top|parent)\.)?location\s*\.\s*assign\s*\(/g },
  { kind: 'location.replace', re: /(?:\b(?:window|document|self|top|parent)\.)?location\s*\.\s*replace\s*\(/g },
  { kind: 'location.href', re: /(?:\b(?:window|document|self|top|parent)\.)?location\s*(?:\.\s*href\s*=(?!=)|\s*=(?!=))/g },
  { kind: 'window.open', re: /\bwindow\s*\.\s*open\s*\(/g },
];

// A location-parameter read: location.search, location.hash,
// URLSearchParams, getParameter / getQueryParam calls.
const PARAM_READ_RES = [
  { kind: 'location.search', re: /(?:\b(?:window|document|self|top|parent)\.)?location\s*\.\s*search\b/ },
  { kind: 'location.hash', re: /(?:\b(?:window|document|self|top|parent)\.)?location\s*\.\s*hash\b/ },
  { kind: 'URLSearchParams', re: /\bURLSearchParams\b/ },
  { kind: 'getParameter', re: /\bget(?:Query)?Param(?:eter)?\s*\(/ },
];

// Parameter names read near a sink: .get('name') / .get("name") /
// getParameter('name') — the names tier 2 must drive.
const PARAM_NAME_RE = /(?:\.get|get(?:Query)?Param(?:eter)?)\s*\(\s*['"]([A-Za-z0-9_\-]{1,64})['"]/g;

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

// Parameter names read within a window of text. Pure — exported for
// unit tests.
export function extractParamNames(windowText) {
  const text = typeof windowText === 'string' ? windowText : '';
  const out = [];
  const seen = new Set();
  const rx = new RegExp(PARAM_NAME_RE.source, PARAM_NAME_RE.flags);
  let m;
  while ((m = rx.exec(text)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

// Classify one redirect sink by what sits within WINDOW_CHARS of
// it: a location-parameter read (query or fragment), or nothing.
// A window is a classification, NOT a flow proof — minified code
// cannot be dataflow-traced this way, which is why any sink at all
// triggers the tier-2 drive.
export function classifyRedirectSink(body, index) {
  const text = typeof body === 'string' ? body : '';
  const start = Math.max(0, index - WINDOW_CHARS);
  const end = Math.min(text.length, index + WINDOW_CHARS);
  const windowText = text.slice(start, end);
  let paramSource = 'unknown';
  for (const { kind, re } of PARAM_READ_RES) {
    if (re.test(windowText)) {
      paramSource = kind === 'location.hash' ? 'fragment' : 'query';
      break;
    }
  }
  return { paramSource, nearSink: paramSource !== 'unknown', paramNames: extractParamNames(windowText) };
}

// All redirect sinks in one source body, each with its kind, line,
// snippet, parameter source and nearby parameter names. Pure —
// exported for unit tests.
export function findRedirectSinks(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  for (const { kind, re } of REDIRECT_SINK_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const cls = classifyRedirectSink(text, m.index);
      out.push({
        index: m.index,
        kind,
        line: lineOf(text, m.index),
        snippet: snippetAround(text, m.index, m[0].length),
        paramSource: cls.paramSource,
        nearSink: cls.nearSink,
        paramNames: cls.paramNames,
      });
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// Tier-1 verdict from a sink list: how many sinks, how many sit
// near a location-parameter read, whether the tier-2 drive is
// needed, and the candidate parameter names (mined first, generic
// fallback when a query-sourced sink has no mined name). Pure —
// exported for unit tests.
export function assessRedirectFlow(sinks) {
  const list = Array.isArray(sinks) ? sinks : [];
  const nearSink = list.filter((r) => r && r.nearSink).length;
  const paramNames = [];
  const seen = new Set();
  for (const s of list) {
    for (const name of (s && s.paramNames) || []) {
      if (!seen.has(name)) {
        seen.add(name);
        paramNames.push(name);
      }
    }
  }
  const hasQuerySink = list.some((s) => s && s.paramSource === 'query');
  const hasFragmentSink = list.some((s) => s && s.paramSource === 'fragment');
  const fragmentOnly = list.length > 0 && list.every((s) => s && s.paramSource === 'fragment');
  if (list.length > 0 && paramNames.length === 0 && !fragmentOnly) {
    for (const name of GENERIC_PARAMS) {
      if (!seen.has(name)) {
        seen.add(name);
        paramNames.push(name);
      }
    }
  }
  return {
    redirectSinks: list.length,
    redirectNearSink: nearSink,
    drive: list.length > 0,
    paramNames: paramNames.slice(0, MAX_PARAMS),
    hasFragmentSink,
  };
}

// ---- tier-2: canary targets (pure) -----------------------------------------

export function canaryTarget(rid) {
  return `https://${CANARY_HOST}/__dmredir_${String(rid || '').replace(/[^A-Za-z0-9]/g, '')}`;
}

export function canaryTargetRelative(rid) {
  return `//${CANARY_HOST}/__dmredir_${String(rid || '').replace(/[^A-Za-z0-9]/g, '')}`;
}

export function controlValue(rid) {
  return `dmcontrol-${String(rid || '')}`;
}

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests. A control navigation that already lands on the canary
// target means the oracle itself is contaminated (the control value
// is a bare token, never a URL, so reaching the canary from it
// means the drive is untrustworthy).
export function assessDriveResult({ controlClean, canaryReached }) {
  if (controlClean === false) {
    return { verdict: 'uncalibrated', reason: 'control value navigated to the canary target — oracle contaminated' };
  }
  if (canaryReached) {
    return { verdict: 'confirmed', reason: 'canary redirect target was navigated to in the browser' };
  }
  return { verdict: 'not-executed', reason: 'canary target was offered but the page did not navigate to it' };
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

function withQuery(base, param, value) {
  try {
    const x = new URL(base);
    x.searchParams.set(param, value);
    return x.toString();
  } catch {
    const sep = String(base).includes('?') ? '&' : '?';
    return `${base}${sep}${encodeURIComponent(param)}=${encodeURIComponent(value)}`;
  }
}

// Default popup-target lister: GET /json/list on the CDP endpoint
// and return the target URLs. Best-effort — a failed list means
// window.open canaries are unobservable, never a finding.
async function defaultListTargets(client) {
  try {
    const endpoint = client && client.endpoint ? String(client.endpoint) : AUTH_RENDER_DEBUG_ENDPOINT;
    const res = await globalThis.fetch(`${endpoint.replace(/\/+$/, '')}/json/list`);
    if (!res || !res.ok) return [];
    const list = await res.json().catch(() => []);
    return Array.isArray(list) ? list.map((t) => String((t && t.url) || '')).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Drive the pasted page in a real headless browser: navigate with a
 * control value, then with canary redirect targets, and observe
 * whether the browser navigates to the canary. Reuses the
 * authenticated-render browser pattern (transient container, fixed
 * host-loopback CDP endpoint, container removed in a finally).
 * Anonymous: no lab session is carried, so only the logged-out
 * surface is tested. opts.runner / opts.cdpConnect / opts.image /
 * opts.listTargets are the test seams (defaults mirror
 * authDomRender). Returns { attempted, executed, shape, param,
 * error, rid, canary }. Never throws.
 */
export async function driveRedirectExecution(pageUrl, paramNames, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const canary = canaryTarget(rid);
  const canaryRel = canaryTargetRelative(rid);
  const out = {
    attempted: false,
    executed: false,
    shape: null,
    param: null,
    error: null,
    rid,
    canary,
  };
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const cdpConnect = typeof opts.cdpConnect === 'function' ? opts.cdpConnect : connectCdp;
  const listTargets = typeof opts.listTargets === 'function' ? opts.listTargets : defaultListTargets;
  const image = opts.image || DOM_RENDER_IMAGE;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : AUTH_RENDER_TIMEOUT_MS;
  const base = stripFragment(pageUrl);
  if (!base) {
    out.error = 'no url';
    return out;
  }
  const params = (Array.isArray(paramNames) ? paramNames : []).filter(Boolean).slice(0, MAX_PARAMS);
  const hasFragmentSink = opts.hasFragmentSink === true;
  if (!params.length && !hasFragmentSink) {
    out.error = 'no parameter to drive';
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

    const hrefExpr = 'location.href';
    const reached = (href) => typeof href === 'string' && href.indexOf(canary) === 0;
    const popupReached = async () => {
      try {
        const urls = await listTargets(client);
        return (urls || []).some((u) => typeof u === 'string' && u.indexOf(canary) === 0);
      } catch {
        return false;
      }
    };

    // QUERY parameters: control first (a bare token must not reach
    // the canary), then the absolute canary, then the
    // protocol-relative canary. A same-tab navigation to the canary
    // or a new tab opened on it both confirm.
    for (const param of params) {
      out.param = param;
      await client.navigate(withQuery(base, param, controlValue(rid)));
      await sleep(DRIVE_SETTLE_MS);
      const controlHref = await client.evaluate(hrefExpr);
      if (reached(controlHref) || (await popupReached())) {
        out.error = 'control value navigated to the canary target';
        return out;
      }
      for (const [shape, value] of [
        ['query-absolute', canary],
        ['query-protocol-relative', canaryRel],
      ]) {
        await client.navigate(withQuery(base, param, value));
        await sleep(DRIVE_SETTLE_MS);
        const href = await client.evaluate(hrefExpr);
        if (reached(href) || (await popupReached())) {
          out.executed = true;
          out.shape = shape;
          return out;
        }
      }
    }

    // FRAGMENT source: the page reads location.hash as the redirect
    // target, so the canary rides the fragment itself.
    if (hasFragmentSink) {
      await client.navigate(`${base}#${controlValue(rid)}`);
      await sleep(DRIVE_SETTLE_MS);
      const controlHref = await client.evaluate(hrefExpr);
      if (reached(controlHref) || (await popupReached())) {
        out.error = 'control value navigated to the canary target';
        return out;
      }
      await client.navigate(`${base}#${canary}`);
      await sleep(DRIVE_SETTLE_MS);
      const href = await client.evaluate(hrefExpr);
      if (reached(href) || (await popupReached())) {
        out.executed = true;
        out.shape = 'fragment';
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
 * Probe DOM-Based Open Redirection (#91).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body so a
 *   script-less page skips instead of fetching).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, fetchPage, runner, cdpConnect, image,
 *   listTargets, diagnostics }.
 *   fetchPage is the bundle-fetch seam (defaults to fingerprint.fetchPage);
 *   runner / cdpConnect / image / listTargets are the CDP-drive seams.
 * @returns {object[]} findings (class 'dom_sink', medium) — at most 1
 *   per scan: the first canary shape that navigates to the target.
 */
export async function probeDomOpenRedirect(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as basket-logic / workflow-skip /
  // session-fixation / twofa): canary lab creds + allowWrite + lab host
  // + depth !== 'quick'. The drive navigates the target's origin to
  // an attacker-controlled URL, so it never runs outside the lab gate.
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

  // TIER 1 — mine first-party code for redirect sinks. Vendor /
  // framework bundles are excluded by the same gates as domXssSinks
  // (a router redirecting is framework code, not the app's vuln).
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
    for (const r of findRedirectSinks(res.body)) {
      sinks.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findRedirectSinks(body)) {
      sinks.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessRedirectFlow(sinks);
  setDiag('redirectSinks', flow.redirectSinks);
  setDiag('redirectNearSink', flow.redirectNearSink);
  if (!flow.drive) return findings; // proven true negative: no redirect sink at all

  // TIER 2 — drive the pasted page in a real browser and observe
  // whether a canary redirect target is navigated to.
  setDiag('driveAttempted', true);
  const drive = await driveRedirectExecution(pageUrl, flow.paramNames, {
    ...opts,
    hasFragmentSink: flow.hasFragmentSink,
  });
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, CDP unreachable, control
  // contaminated) leaves the oracle uncalibrated — never a finding,
  // and never a proven true negative either.
  const verdict = drive.error
    ? { verdict: 'uncalibrated', reason: drive.error }
    : assessDriveResult({
        controlClean: true,
        canaryReached: drive.executed,
      });
  if (verdict.verdict !== 'confirmed') return findings;

  const near = sinks.find((r) => r.nearSink);
  findings.push({
    class: 'dom_sink',
    id: 'dom-open-redirect',
    title: 'DOM-Based Open Redirection — page redirects to an attacker-controlled URL (MEDIUM)',
    severity: 'medium',
    url: pageUrl,
    parameter: drive.param || (near ? near.kind : 'redirect target'),
    evidence: {
      request:
        `GET ${stripFragment(pageUrl)}${drive.param ? `?${drive.param}=` : '#'}${drive.shape === 'query-protocol-relative' ? canaryTargetRelative(drive.rid) : drive.canary} ` +
        `(control value ${controlValue(drive.rid)} first — browser stayed on the pasted origin; canary shape: ${drive.shape})`,
      response:
        `Real-browser navigation: after navigating the pasted page with the canary redirect target, ` +
        `location.href became ${drive.canary} (or a new tab opened on it) — the page redirects to an ` +
        `attacker-controlled URL. ` +
        (near
          ? `Static mine found the sink in ${near.source} (line ${near.line}, ${near.kind} fed by a location parameter): ${near.snippet} `
          : 'Static mine found redirect sinks in first-party code. ') +
        `The target is attacker-controlled (any link can carry it) and the page assigns it to a redirect sink unvalidated.`,
      impact_demo:
        'Open redirection — an attacker link on the trusted domain sends victims to a lookalike malicious site (phishing, credential theft). Allowlist redirect targets server-side (or validate them against the same origin) and never assign raw URL input to location.assign / location.replace / location.href / window.open (OWASP Unvalidated Redirects and Forwards Cheat Sheet).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __domOpenRedirectMeta = { phases: ['dom-open-redirect'], depth: ['standard', 'deep'] };
