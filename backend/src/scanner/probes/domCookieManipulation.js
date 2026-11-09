// Dark Matter rule-based scanner — DOM-Based Cookie Manipulation probe
// (coverage row #90 [Medium] DOM-Based Cookie Manipulation,
// Technique (no single CVE) | PortSwigger DOM; phase 100,
// 'dom-cookie-manipulation').
//
// ORACLE (deterministic, no judge, no LLM, $0): attacker input in
// a URL parameter reaches a document.cookie write; the page is
// vulnerable only if its own first-party JS writes document.cookie
// from a location parameter AND the write sets or overwrites a
// SENSITIVE cookie (session / auth / token / CSRF) with the
// attacker value AND the control render does not set it. A cookie
// write alone is NOT a finding — the dom-xss-sinks probe already
// fingerprints sinks statically (class dom_sink, INFO) — and a
// write into a non-sensitive cookie (a theme, a preference) is
// never a finding either. This probe goes one step further, in two
// tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for document.cookie writes (assignment, +=, js-cookie
//   Cookies.set, jQuery $.cookie). ZERO writes means no code can
//   set a cookie from the DOM at all — a proven true negative, no
//   browser needed. Each write is classified by what sits within a
//   context window around it (a location-parameter read / nothing)
//   — a classification, not a flow proof: minified code cannot be
//   dataflow-traced by a window, so ANY write triggers tier 2.
//   Parameter names read near a write (.get('name')) are collected
//   so tier 2 drives the exact parameters the page actually reads;
//   when a write reads the query string wholesale (no named
//   parameter), tier 2 drives its own `dmcookie` parameter — a page
//   that copies location.search into a cookie still receives the
//   marker.
//
//   TIER 2 — CDP COOKIE DRIVE (only when tier 1 finds a write):
//   a real headless browser (the same transient-container +
//   fixed-loopback-CDP pattern as renderDomAuthenticated) loads the
//   pasted page WITH the hunt's lab session (the dom-render step
//   already acquired it — cookies via Network.setCookie, bearer
//   token into localStorage before page scripts run), navigates
//   with a CONTROL value first, then with a canary value
//   (`dmcookie-<rid>`), and snapshots document.cookie after each
//   navigation. CONFIRM only when a sensitive cookie carries the
//   canary marker in the canary render and does not in the control
//   render. The control render is the BASELINE DIFFERENTIAL that
//   separates DOM-set cookies from server-set ones: a server-set
//   cookie appears in BOTH renders with a server-chosen value (and
//   HttpOnly server cookies never appear in document.cookie at
//   all), so only a DOM write driven by the canary can produce the
//   marker. The marker is alphanumeric + hyphen, so it survives
//   URL encoding and cookie parsing unchanged.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa); depth
// 'quick' skips the probe. BOUND: at most 1 browser drive per scan
// (control + canary per parameter, at most 3 parameters), at most 5
// bundles + 10 inline blocks mined. Findings are class 'dom_sink'
// — the default confirmation protocol judges them on
// signalCorrelated (see domXssSinks.js: a class containing 'xss'
// would route to xss_reflected and stay unconfirmed forever).
// Severity follows the row (Medium) ONLY on an observed
// attacker-influenced write to a sensitive cookie; a true negative
// fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive needs the lab session: sensitive cookies exist
//   post-login. Without a session (login failed, no login route)
//   the drive is not attempted — the probe reports the mined
//   writes with driveAttempted=false, never a proven true negative
//   for the authenticated surface.
// - The drive tests LOAD-time writes only. A write that fires only
//   on user interaction is not exercised.
// - A write that reads a parameter name tier 1 could not extract
//   (a computed property, a destructured search string) never
//   receives the canary except through the wholesale-copy
//   `dmcookie` carrier — a miss there is a true negative BY THIS
//   ORACLE, not proof of safety; the evidence says so.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code writing cookies (e.g.
//   a framework's own consent banner) is not the app's vuln.

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
const WINDOW_CHARS = 300; // context window around a write for source classification
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive navigation (writes are async)
const SNIPPET_RADIUS = 80;

// A cookie name is sensitive when it carries session / auth /
// token / CSRF material — the only names a DOM write may confirm on.
export const SENSITIVE_COOKIE_RE = /session|auth|token|csrf|xsrf|jwt|sid|login/i;
// The canary carrier parameter: driven when tier 1 mines a write
// that reads the query string wholesale (no named parameter).
const CARRIER_PARAM = 'dmcookie';

// ---- tier-1: cookie writes (pure) ------------------------------------------

// document.cookie = / += — the assignment form (a bare `=` after
// .cookie, never `==`). js-cookie Cookies.set( and jQuery $.cookie(.
const COOKIE_WRITE_RES = [
  { kind: 'document.cookie', re: /document\s*\.\s*cookie\s*(?:=(?!=)|\+=)/g },
  { kind: 'Cookies.set', re: /\bCookies\s*\.\s*set\s*\(/g },
  { kind: 'jQuery.cookie', re: /\$\s*\.\s*cookie\s*\(/g },
];

// A location-parameter read: location.search, location.hash,
// URLSearchParams, getParameter / getQueryParam calls.
const PARAM_READ_RES = [
  { kind: 'location.search', re: /(?:\b(?:window|document|self|top|parent)\.)?location\s*\.\s*search\b/ },
  { kind: 'location.hash', re: /(?:\b(?:window|document|self|top|parent)\.)?location\s*\.\s*hash\b/ },
  { kind: 'URLSearchParams', re: /\bURLSearchParams\b/ },
  { kind: 'getParameter', re: /\bget(?:Query)?Param(?:eter)?\s*\(/ },
];

// Parameter names read near a write: .get('name') / .get("name") /
// getParameter('name').
const PARAM_NAME_RE = /(?:\.get|get(?:Query)?Param(?:eter)?)\s*\(\s*['"]([A-Za-z0-9_\-]{1,64})['"]/g;

// A write that starts with a quoted sensitive cookie name, e.g.
// document.cookie = 'session=' + value.
const SENSITIVE_LITERAL_RE = /=\s*['"]([A-Za-z0-9_\-]+)=/;

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

// Classify one cookie write by what sits within WINDOW_CHARS of
// it: a location-parameter read (query or fragment), or nothing,
// plus the literal cookie name when the write spells one out. A
// window is a classification, NOT a flow proof — minified code
// cannot be dataflow-traced this way, which is why any write at
// all triggers the tier-2 drive.
export function classifyCookieWrite(body, index) {
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
  const lit = SENSITIVE_LITERAL_RE.exec(windowText);
  return {
    paramSource,
    nearSink: paramSource !== 'unknown',
    paramNames: extractParamNames(windowText),
    sensitiveName: lit && SENSITIVE_COOKIE_RE.test(lit[1]) ? lit[1] : null,
  };
}

// All cookie writes in one source body, each with its kind, line,
// snippet, parameter source, nearby parameter names and literal
// cookie name when spelled out. Pure — exported for unit tests.
export function findCookieWrites(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  for (const { kind, re } of COOKIE_WRITE_RES) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const cls = classifyCookieWrite(text, m.index);
      out.push({
        index: m.index,
        kind,
        line: lineOf(text, m.index),
        snippet: snippetAround(text, m.index, m[0].length),
        paramSource: cls.paramSource,
        nearSink: cls.nearSink,
        paramNames: cls.paramNames,
        sensitiveName: cls.sensitiveName,
      });
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// Tier-1 verdict from a write list: how many writes, how many sit
// near a location-parameter read, whether the tier-2 drive is
// needed, and the candidate parameter names (mined first; the
// `dmcookie` carrier when a query-sourced write has no mined name).
// Pure — exported for unit tests.
export function assessCookieFlow(writes) {
  const list = Array.isArray(writes) ? writes : [];
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
  const hasQueryWrite = list.some((s) => s && s.paramSource === 'query');
  const hasFragmentWrite = list.some((s) => s && s.paramSource === 'fragment');
  const fragmentOnly = list.length > 0 && list.every((s) => s && s.paramSource === 'fragment');
  if (list.length > 0 && paramNames.length === 0 && !fragmentOnly) paramNames.push(CARRIER_PARAM);
  return {
    cookieSinks: list.length,
    cookieNearSink: nearSink,
    drive: list.length > 0,
    paramNames: paramNames.slice(0, MAX_PARAMS),
    hasFragmentWrite,
  };
}

// Parse a document.cookie string ("a=1; b=2") into a Map of
// name -> value. Pure — exported for unit tests.
export function parseCookieString(cookieString) {
  const out = new Map();
  const text = typeof cookieString === 'string' ? cookieString : '';
  for (const part of text.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    out.set(name, part.slice(eq + 1).trim());
  }
  return out;
}

// The differential: which sensitive cookies carry the canary marker
// in the canary render and do not in the control render. A cookie
// the server sets appears in BOTH renders with a server-chosen
// value, so it can never carry the marker; a DOM write driven by
// the canary is the only way the marker appears. Pure — exported
// for unit tests.
export function findCanaryCookies(controlCookies, canaryCookies, marker) {
  const control = controlCookies instanceof Map ? controlCookies : new Map();
  const canary = canaryCookies instanceof Map ? canaryCookies : new Map();
  const out = [];
  for (const [name, value] of canary) {
    if (!SENSITIVE_COOKIE_RE.test(name)) continue;
    if (!String(value || '').includes(marker)) continue;
    const controlValue = control.get(name);
    if (controlValue !== undefined && String(controlValue).includes(marker)) continue;
    out.push({ name, value: String(value) });
  }
  return out;
}

// ---- tier-2: canary values (pure) ------------------------------------------

export function canaryValue(rid) {
  return `dmcookie-${String(rid || '').replace(/[^A-Za-z0-9]/g, '')}`;
}

export function controlValue(rid) {
  return `dmcontrol-${String(rid || '')}`;
}

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests.
export function assessDriveResult({ canaryCookies }) {
  const list = Array.isArray(canaryCookies) ? canaryCookies : [];
  if (list.length > 0) {
    return { verdict: 'confirmed', reason: 'canary value landed in a sensitive cookie in the canary render only' };
  }
  return { verdict: 'not-executed', reason: 'no sensitive cookie carried the canary value' };
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

/**
 * Drive the pasted page in a real headless browser WITH the lab
 * session: navigate with a control value, then with a canary value,
 * and snapshot document.cookie after each navigation. Reuses the
 * authenticated-render browser pattern (transient container, fixed
 * host-loopback CDP endpoint, container removed in a finally;
 * session injected the way renderDomAuthenticated does it —
 * cookies via Network.setCookie, bearer token into localStorage
 * before page scripts run). opts.session is the acquired session
 * ({token, cookies}); without it the drive is not attempted.
 * opts.runner / opts.cdpConnect / opts.image are the test seams
 * (defaults mirror authDomRender). Returns { attempted, executed,
 * cookieName, param, shape, error, rid, canary }. Never throws.
 */
export async function driveCookieManipulation(pageUrl, paramNames, session, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const canary = canaryValue(rid);
  const out = {
    attempted: false,
    executed: false,
    cookieName: null,
    param: null,
    shape: null,
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
  if (!session || (typeof session !== 'object')) {
    out.error = 'no lab session';
    return out;
  }
  const hasToken = typeof session.token === 'string' && session.token.length > 0;
  const cookies = Array.isArray(session.cookies) ? session.cookies : [];
  if (!hasToken && cookies.length === 0) {
    out.error = 'no lab session';
    return out;
  }
  const params = (Array.isArray(paramNames) ? paramNames : []).filter(Boolean).slice(0, MAX_PARAMS);
  const hasFragmentWrite = opts.hasFragmentWrite === true;
  if (!params.length && !hasFragmentWrite) {
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
    await client.send('Network.enable');

    // Session injection, before any navigation: cookies ride the
    // requests, the token lands in localStorage before page scripts
    // run (the SPA reads it on boot) — same as renderDomAuthenticated.
    for (const cookie of cookies) {
      await client.setCookie(cookie);
    }
    if (hasToken) {
      const script = `try { localStorage.setItem('token', ${JSON.stringify(session.token)}); } catch (e) {}`;
      await client.addInitScript(script);
    }

    const cookieExpr = 'document.cookie';

    // QUERY parameters: control render first (the baseline that
    // separates server-set cookies from DOM-set ones), then the
    // canary render. A sensitive cookie carrying the marker in the
    // canary render only confirms.
    for (const param of params) {
      out.param = param;
      await client.navigate(withQuery(base, param, controlValue(rid)));
      await sleep(DRIVE_SETTLE_MS);
      const controlRaw = await client.evaluate(cookieExpr);
      const control = parseCookieString(controlRaw);
      await client.navigate(withQuery(base, param, canary));
      await sleep(DRIVE_SETTLE_MS);
      const canaryRaw = await client.evaluate(cookieExpr);
      const canaryMap = parseCookieString(canaryRaw);
      const hit = findCanaryCookies(control, canaryMap, canary);
      if (hit.length > 0) {
        out.executed = true;
        out.cookieName = hit[0].name;
        out.shape = 'query';
        return out;
      }
    }

    // FRAGMENT source: the page reads location.hash as the cookie
    // value, so the canary rides the fragment itself.
    if (hasFragmentWrite) {
      await client.navigate(`${base}#${controlValue(rid)}`);
      await sleep(DRIVE_SETTLE_MS);
      const controlRaw = await client.evaluate(cookieExpr);
      const control = parseCookieString(controlRaw);
      await client.navigate(`${base}#${canary}`);
      await sleep(DRIVE_SETTLE_MS);
      const canaryRaw = await client.evaluate(cookieExpr);
      const canaryMap = parseCookieString(canaryRaw);
      const hit = findCanaryCookies(control, canaryMap, canary);
      if (hit.length > 0) {
        out.executed = true;
        out.cookieName = hit[0].name;
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
 * Probe DOM-Based Cookie Manipulation (#90).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body so a
 *   script-less page skips instead of fetching).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, fetchPage, runner, cdpConnect, image, session,
 *   diagnostics }.
 *   fetchPage is the bundle-fetch seam (defaults to fingerprint.fetchPage);
 *   runner / cdpConnect / image are the CDP-drive seams; session is the
 *   hunt's acquired lab session ({token, cookies}) — without it the
 *   drive is not attempted.
 * @returns {object[]} findings (class 'dom_sink', medium) — at most 1
 *   per scan: the first sensitive cookie the canary lands in.
 */
export async function probeDomCookieManipulation(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as basket-logic / workflow-skip /
  // session-fixation / twofa): canary lab creds + allowWrite + lab host
  // + depth !== 'quick'. The drive navigates the target's origin with
  // a lab session, so it never runs outside the lab gate.
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

  // TIER 1 — mine first-party code for document.cookie writes.
  // Vendor / framework bundles are excluded by the same gates as
  // domXssSinks (framework code writing cookies is not the app's vuln).
  const writes = [];
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
    for (const r of findCookieWrites(res.body)) {
      writes.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findCookieWrites(body)) {
      writes.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessCookieFlow(writes);
  setDiag('cookieSinks', flow.cookieSinks);
  setDiag('cookieNearSink', flow.cookieNearSink);
  if (!flow.drive) return findings; // proven true negative: no cookie write at all

  // TIER 2 — drive the pasted page in a real browser WITH the lab
  // session and observe whether the canary lands in a sensitive
  // cookie. Without a session the authenticated surface was never
  // reached — no drive, no finding, no false true negative.
  const session = opts.session && typeof opts.session === 'object' ? opts.session : null;
  setDiag('sessionOk', Boolean(session && (session.token || (Array.isArray(session.cookies) && session.cookies.length))));
  if (!session || (!session.token && !(Array.isArray(session.cookies) && session.cookies.length))) {
    return findings;
  }
  setDiag('driveAttempted', true);
  const drive = await driveCookieManipulation(pageUrl, flow.paramNames, session, {
    ...opts,
    hasFragmentWrite: flow.hasFragmentWrite,
  });
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, CDP unreachable, session
  // injection failed) leaves the oracle uncalibrated — never a
  // finding, and never a proven true negative either.
  const verdict = drive.error
    ? { verdict: 'uncalibrated', reason: drive.error }
    : assessDriveResult({ canaryCookies: drive.executed ? [{ name: drive.cookieName }] : [] });
  if (verdict.verdict !== 'confirmed') return findings;

  const near = writes.find((r) => r.nearSink);
  findings.push({
    class: 'dom_sink',
    id: 'dom-cookie-manipulation',
    title: 'DOM-Based Cookie Manipulation — URL input overwrites a sensitive cookie (MEDIUM)',
    severity: 'medium',
    url: pageUrl,
    parameter: drive.param || 'URL parameter',
    evidence: {
      request:
        `GET ${stripFragment(pageUrl)}${drive.param ? `?${drive.param}=` : '#'}${drive.canary} with the lab session ` +
        `(control value ${controlValue(drive.rid)} first — cookie '${drive.cookieName}' did not carry the marker; canary shape: ${drive.shape})`,
      response:
        `Real-browser differential: after navigating the pasted page with the canary value, document.cookie carried ` +
        `'${drive.cookieName}' with the canary marker in its value, while the control render did not — a DOM write ` +
        `driven by URL input set a sensitive cookie. A server-set cookie would appear in BOTH renders with a ` +
        `server-chosen value, so the marker proves the write came from the page's own JavaScript. ` +
        (near
          ? `Static mine found the write in ${near.source} (line ${near.line}, ${near.kind} fed by a location parameter): ${near.snippet} `
          : 'Static mine found cookie writes in first-party code. ') +
        `The value is attacker-controlled (any link can carry it).`,
      impact_demo:
        'DOM cookie manipulation — an attacker link sets or overwrites a session/auth/CSRF cookie in the victim browser (session fixation, CSRF-token override, logic abuse). Never build cookie values from URL input; set sensitive cookies server-side with HttpOnly, Secure and SameSite, and validate any client-side value against an allowlist before writing it (OWASP DOM XSS / Session Management Cheat Sheets).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __domCookieMeta = { phases: ['dom-cookie-manipulation'], depth: ['standard', 'deep'] };
