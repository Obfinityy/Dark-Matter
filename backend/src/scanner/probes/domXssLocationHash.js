// Dark Matter rule-based scanner — DOM XSS via location.hash probe
// (coverage row #275 [High] XSS — DOM via location.hash / fragment,
// CWE-79 | PortSwigger DOM XSS; phase 91, 'dom-xss-location-hash').
//
// ORACLE (deterministic, no judge, no LLM, $0): an attacker link
// carries a payload in the fragment; the page is vulnerable only if
// its own first-party JS reads location.hash AND the value reaches
// an execution sink AND the payload actually executes. Sink
// presence alone is NOT a finding — the dom-xss-sinks probe already
// fingerprints sinks statically (class dom_sink, INFO). This probe
// goes one step further, in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for location.hash reads (all spellings: location.hash,
//   window.location.hash, location['hash'], ...). ZERO reads means
//   no code can sink the fragment at all — a proven true negative,
//   no browser needed. Each read is classified by what sits within
//   a context window around it (execution sink / safe sink /
//   unknown) — a classification, not a flow proof: minified code
//   cannot be dataflow-traced by a window, so ANY read triggers
//   tier 2.
//
//   TIER 2 — CDP EXECUTION DRIVE (only when tier 1 finds a read):
//   a real headless browser (the same transient-container +
//   fixed-loopback-CDP pattern as renderDomAuthenticated) navigates
//   the pasted page with a CONTROL fragment first, then with a
//   canary fragment, and evaluates whether the canary executed.
//   Two canary shapes, because the fragment percent-encode set
//   forces different payloads through different sinks:
//     (E) eval-family: `window.__dmHashXss_<rid>=1` — plain JS, no
//         character the URL parser percent-encodes, so it executes
//         if the hash reaches eval / Function / setTimeout(string).
//     (M) markup: `<img src=x onerror="window.__dmHashXss_<rid>=1">`
//         — `<`, `>`, `"` and spaces are percent-encoded in
//         location.hash, so this executes ONLY if the page decodes
//         the hash before sinking it into innerHTML /
//         document.write / bypassSecurityTrustHtml.
//   CONFIRM only when the control fragment leaves the flag unset
//   AND a canary fragment sets window.__dmHashXss_<rid> to 1 AND
//   the fragment survived navigation (an SPA that strips or
//   redirects the hash away makes the drive uncalibrated, never a
//   finding). The flag name carries a per-scan random id so page
//   code can never set it by coincidence.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa); depth
// 'quick' skips the probe. BOUND: at most 1 browser drive per scan
// (control + at most 2 canary navigations), at most 5 bundles +
// 10 inline blocks mined. Findings are class 'dom_sink' — the
// default confirmation protocol judges them on signalCorrelated
// (see domXssSinks.js: a class containing 'xss' would route to
// xss_reflected and stay unconfirmed forever). Severity follows
// the row (High) ONLY on observed execution; a true negative
// fires nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A hash sink that only exists
//   behind login is not reached — the probe reports no execution
//   with driveAttempted=true and says so in the evidence, never a
//   proven true negative.
// - The drive tests LOAD-time sinks only. A sink that fires only
//   on user interaction (a click handler reading the hash) is not
//   exercised.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem and sanitizer-defining bundles are skipped whole (same
//   gates as domXssSinks) — framework code reading location.hash
//   (e.g. a router) is not the app's vulnerability.
// - A jQuery `$(location.hash)` selector sink is not reachable by
//   a fresh navigation: the fragment arrives percent-encoded, so
//   the selector never starts with `<`. Only a page that decodes
//   the hash first can be driven into that sink.

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
const WINDOW_CHARS = 300; // context window around a hash read for sink classification
const DRIVE_SETTLE_MS = 1000; // extra settle after each drive navigation (onerror is async)
const SNIPPET_RADIUS = 80;

// ---- tier-1: location.hash reads (pure) ------------------------------------

// Dot access: location.hash, window.location.hash, document.location.hash,
// self/top/parent.location.hash. Bracket access: location['hash'].
// decodeURIComponent(location.hash) matches through the dot form.
const HASH_READ_RE =
  /(?:\b(?:window|document|self|top|parent)\.)?location\s*(?:\.\s*hash\b|\[\s*['"]hash['"]\s*\])/g;

// Execution sinks a hash value must reach to execute. innerHTML as a
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

// Classify one hash read by what sits within WINDOW_CHARS of it:
// an execution sink nearby, only safe sinks nearby, or neither.
// A window is a classification, NOT a flow proof — minified code
// cannot be dataflow-traced this way, which is why any read at all
// triggers the tier-2 drive.
export function classifyHashRead(body, index) {
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

// All location.hash reads in one source body, each with its line,
// snippet and sink classification. Pure — exported for unit tests.
export function findHashReads(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const rx = new RegExp(HASH_READ_RE.source, HASH_READ_RE.flags);
  const out = [];
  let m;
  while ((m = rx.exec(text)) !== null) {
    const cls = classifyHashRead(text, m.index);
    out.push({
      index: m.index,
      line: lineOf(text, m.index),
      snippet: snippetAround(text, m.index, m[0].length),
      nearSink: cls.nearSink,
      sinkKind: cls.sinkKind,
      safeOnly: cls.safeOnly,
    });
  }
  return out;
}

// Tier-1 verdict from a read list: how many reads, how many sit
// near an execution sink, and whether the tier-2 drive is needed.
// Pure — exported for unit tests.
export function assessHashFlow(reads) {
  const list = Array.isArray(reads) ? reads : [];
  const nearSink = list.filter((r) => r && r.nearSink).length;
  return { reads: list.length, nearSink, drive: list.length > 0 };
}

// ---- tier-2: canary payloads (pure) ----------------------------------------

export function flagName(rid) {
  return `__dmHashXss_${String(rid || '').replace(/[^A-Za-z0-9]/g, '')}`;
}

export function controlHash(rid) {
  return `dmcontrol-${String(rid || '')}`;
}

// Eval-family canary: plain JS, no character the URL parser
// percent-encodes — executes if the hash reaches eval / Function /
// setTimeout(string).
export function evalCanaryHash(rid) {
  return `window.${flagName(rid)}=1`;
}

// Markup canary: executes ONLY if the page decodes the hash before
// sinking it — `<`, `>`, `"` and spaces arrive percent-encoded in
// location.hash.
export function markupCanaryHash(rid) {
  return `<img src=x onerror="window.${flagName(rid)}=1">`;
}

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests. A set flag on the CONTROL run means the oracle itself
// is contaminated (the random flag name cannot be set by page code,
// so a set control flag means the drive is untrustworthy); a
// fragment that did not survive navigation means the sink was never
// offered the payload at all.
export function assessDriveResult({ controlFlag, canaryFlag, hashSurvived }) {
  if (controlFlag) {
    return { verdict: 'uncalibrated', reason: 'control fragment set the execution flag — oracle contaminated' };
  }
  if (hashSurvived === false) {
    return { verdict: 'uncalibrated', reason: 'fragment did not survive navigation — sink never offered the payload' };
  }
  if (canaryFlag) {
    return { verdict: 'confirmed', reason: 'canary fragment executed in the page' };
  }
  return { verdict: 'not-executed', reason: 'canary fragment reached the page but did not execute' };
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

/**
 * Drive the pasted page in a real headless browser with a control
 * fragment, then with the canary fragments, and observe whether the
 * canary executed. Reuses the authenticated-render browser pattern
 * (transient container, fixed host-loopback CDP endpoint, container
 * removed in a finally). Anonymous: no lab session is carried, so
 * only the logged-out surface is tested. opts.runner / opts.cdpConnect
 * / opts.image are the test seams (defaults mirror authDomRender).
 * Returns { attempted, executed, hashSurvived, reflected, shape, error }.
 * Never throws.
 */
export async function driveHashExecution(pageUrl, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const flag = flagName(rid);
  const out = {
    attempted: false,
    executed: false,
    hashSurvived: null,
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
  const base = stripFragment(pageUrl);
  if (!base) {
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
    const hashExpr = 'location.hash';
    const reflectedExpr = `document.documentElement.outerHTML.includes(${JSON.stringify(flag)})`;

    // CONTROL: a benign fragment must leave the flag unset.
    await client.navigate(`${base}#${controlHash(rid)}`);
    await sleep(DRIVE_SETTLE_MS);
    const controlFlag = (await client.evaluate(flagExpr)) === true;
    if (controlFlag) {
      out.error = 'control fragment set the execution flag';
      return out;
    }

    // CANARY shapes, in order: eval-family first (no encoding
    // needed), markup second (needs a page that decodes the hash).
    const shapes = [
      { name: 'eval', hash: evalCanaryHash(rid) },
      { name: 'markup', hash: markupCanaryHash(rid) },
    ];
    for (const { name, hash } of shapes) {
      await client.navigate(`${base}#${hash}`);
      await sleep(DRIVE_SETTLE_MS);
      const hashNow = await client.evaluate(hashExpr);
      const survived = typeof hashNow === 'string' && hashNow.length > 1;
      if (out.hashSurvived === null) out.hashSurvived = survived;
      else if (!survived) out.hashSurvived = false;
      if (!survived) continue;
      const reflected = (await client.evaluate(reflectedExpr)) === true;
      if (reflected) out.reflected = true;
      const flagSet = (await client.evaluate(flagExpr)) === true;
      if (flagSet) {
        out.executed = true;
        out.shape = name;
        return out;
      }
    }
    if (out.hashSurvived === null) out.hashSurvived = false;
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
 * Probe DOM XSS via location.hash (#275).
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
export async function probeDomXssLocationHash(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as basket-logic / workflow-skip /
  // session-fixation / twofa): canary lab creds + allowWrite + lab host
  // + depth !== 'quick'. The drive executes a payload in the target's
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

  // TIER 1 — mine first-party code for location.hash reads. Vendor /
  // framework bundles are excluded by the same gates as domXssSinks
  // (a router reading the hash is framework code, not the app's vuln).
  const reads = [];
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
    for (const r of findHashReads(res.body)) {
      reads.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findHashReads(body)) {
      reads.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessHashFlow(reads);
  setDiag('hashReads', flow.reads);
  setDiag('hashNearSink', flow.nearSink);
  if (!flow.drive) return findings; // proven true negative: nothing reads the hash

  // TIER 2 — drive the pasted page in a real browser and observe
  // whether a canary fragment executes.
  setDiag('driveAttempted', true);
  const drive = await driveHashExecution(pageUrl, opts);
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, CDP unreachable, control
  // contaminated) leaves the oracle uncalibrated — never a finding,
  // and never a proven true negative either.
  const verdict = drive.error
    ? { verdict: 'uncalibrated', reason: drive.error }
    : assessDriveResult({
        controlFlag: false,
        canaryFlag: drive.executed,
        hashSurvived: drive.hashSurvived,
      });
  if (verdict.verdict !== 'confirmed') return findings;

  const near = reads.find((r) => r.nearSink);
  findings.push({
    class: 'dom_sink',
    id: 'dom-hash-xss',
    title: 'DOM XSS via location.hash — fragment payload executes in the page (HIGH)',
    severity: 'high',
    url: pageUrl,
    parameter: 'location.hash',
    evidence: {
      request:
        `GET ${stripFragment(pageUrl)}#${drive.shape === 'markup' ? markupCanaryHash(drive.rid) : evalCanaryHash(drive.rid)} ` +
        `(control fragment #${controlHash(drive.rid)} first — flag unset; canary shape: ${drive.shape})`,
      response:
        `Canary fragment executed in a real browser: window.${drive.flag} === 1 after navigating the pasted page ` +
        `with the ${drive.shape} payload. ` +
        (near
          ? `Static mine found the read in ${near.source} (line ${near.line}, near ${near.sinkKind || 'a sink'}): ${near.snippet} `
          : 'Static mine found location.hash reads in first-party code. ') +
        `Reflected in the DOM as text: ${drive.reflected ? 'yes' : 'no'}. ` +
        `The fragment is attacker-controlled (any link can carry it) and the page sinks it into an execution sink unencoded.`,
      impact_demo:
        'DOM XSS — an attacker link carrying the fragment executes script in the victim origin (session theft, actions as the user). Read the fragment once, validate it against an allowlist, and render it via textContent / the default sanitizer — never sink location.hash into innerHTML, document.write, eval or a sanitizer bypass (OWASP DOM XSS Cheat Sheet).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __domHashXssMeta = { phases: ['dom-xss-location-hash'], depth: ['standard', 'deep'] };
