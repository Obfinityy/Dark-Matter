// Dark Matter rule-based scanner — WebView JavaScript bridge probe
// (coverage row #511 [High] WebView JavaScript bridge abuse,
// CWE-749 | OWASP M1/M7; phase 114, 'webview-bridge').
//
// A WebView that exposes a native bridge to JavaScript lets page
// script call native code: Android's addJavascriptInterface(obj,
// "Name") exposes every @JavascriptInterface method of obj as
// window.Name, and iOS's WKScriptMessageHandler exposes
// window.webkit.messageHandlers.<Name>.postMessage. When the
// arguments of a bridge call come from attacker-controllable input
// — a URL parameter, a form field, or a postMessage payload —
// the attacker reaches native functionality (file access, intents,
// credential stores) from a crafted link or page. The row is a
// mobile class and this probe is its web-scanner interpretation:
// it mines the page's own served JS/HTML for the bridge code,
// exactly like documentDomain / secretsInJs.
//
// ORACLE (static, no judge, no LLM, $0): a finding fires ONLY on
// an observed bridge registration PLUS a reachable call path:
//   * registration — addJavascriptInterface(…, "Name"),
//     addScriptMessageHandler(… name: "Name"),
//     window.webkit.messageHandlers.<Name>, or
//     WebViewJavascriptBridge.registerHandler("Name", …), AND
//   * a call site for the SAME bridge name
//     (window.<Name>.<method>(…), <Name>.<method>(…),
//     webkit.messageHandlers.<Name>.postMessage(…),
//     WebViewJavascriptBridge.callHandler("Name", …)), AND
//   * reachability — the call's argument is tainted by
//     attacker-controllable input (URL parameter, input value,
//     postMessage event data, location hash/search), or the call
//     sits inside a message-event handler whose body reads event
//     data.
// A bridge name with no reachable call site is not a finding
// (the nonsense control: a registered-but-unused bridge stays
// quiet). A call site with no registration in the scanned code
// is not a finding either — the name alone proves nothing.
// Commented-out code and string-embedded fake calls never fire:
// call-site and taint matching runs on code with string literals
// and comments blanked out (offsets preserved), and
// registrations matched in the original text are accepted only
// when their offset is live code in the blanked text.
//
// GATES: none beyond the battery itself. Read-only GETs of the
// page's own same-origin script bundles (cap 5) plus inline
// <script> blocks (cap 10), same-origin only, vendor bundles
// excluded — the same feed and caps as documentDomain. Runs at
// every depth including 'quick'.
//
// HONEST LIMITS: no mobile (DVMA) lab exists today, so this is a
// static-mining probe — it proves the registration and the
// reachable call path as served, not a live exploit on a device.
// A bridge registered only in native code (Java/Kotlin/Swift,
// invisible to a web scan) is a miss, and a call path routed
// through a framework the miner does not model is a miss, never
// a false finding. The probe also cannot tell whether the
// exposed native methods are dangerous — the finding names the
// reachable method so a human can judge it.
//
// VERIFICATION: findings are class 'webview_bridge_abuse' —
// protocolFor routes it to the default protocol (judged on
// signalCorrelated, see differential.js). The class name
// deliberately contains neither 'xss' nor 'bypass' so no family
// branch claims it.
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';
import { isVendorBundle } from './domXssSinks.js';

const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes
const MAX_INLINE = 10;
const MAX_FINDINGS = 5;
const SNIPPET_RADIUS = 80;

// Attacker-controllable input sources in code: URL parameters,
// input field values, postMessage event data, location
// query/fragment. Matched against blanked code.
const INPUT_SOURCE_RE =
  /URLSearchParams|location\s*\.\s*(?:search|hash)|searchParams\s*\.\s*get|getQueryParam|getParameter|route\s*\.\s*params|\bparams\s*\.\s*get|useSearchParams\s*\(\)|(?:getElementById|querySelector)\s*\([^)]*\)\s*\.\s*value|(?:event|e|evt|message)\s*\.\s*data/;

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

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bridge';
}

// Blank string literals and comments out of a body, replacing
// every consumed character with a space (newlines kept), so the
// returned text has exactly the same offsets as the original.
// Call-site and taint patterns run on this text; argument text
// and snippets are sliced from the original at the same offsets.
export function blankStringsAndComments(body) {
  const text = typeof body === 'string' ? body : '';
  const out = text.split('');
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      blank(i, end === -1 ? text.length : end);
      i = end === -1 ? text.length : end;
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2;
          continue;
        }
        if (text[j] === quote) break;
        if (quote !== '`' && text[j] === '\n') break;
        j += 1;
      }
      blank(i, Math.min(text.length, j + 1));
      i = Math.min(text.length, j + 1);
    } else {
      i += 1;
    }
  }
  return out.join('');
}

function wordIn(text, word) {
  return new RegExp(`\\b${word.replace(/\$/g, '\\$')}\\b`).test(text);
}

// True when the offset sits in live code, not inside a string
// literal or a comment (the blanked text holds a space there).
function isLiveCode(blanked, offset) {
  return offset >= 0 && offset < blanked.length && blanked[offset] !== ' ';
}

// The body span of the function starting at the first `{` at or
// after `from`: [start, end) by brace matching. Returns null when
// the braces never balance.
function functionSpan(blanked, from) {
  const open = blanked.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < blanked.length; i += 1) {
    if (blanked[i] === '{') depth += 1;
    else if (blanked[i] === '}') {
      depth -= 1;
      if (depth === 0) return [open, i + 1];
    }
  }
  return null;
}

/**
 * Bridge registrations in a body: [{ name, kind, line, snippet }]
 * where kind is 'android' (addJavascriptInterface),
 * 'ios' (WKScriptMessageHandler / messageHandlers) or
 * 'jsbridge' (WebViewJavascriptBridge.registerHandler). Pure.
 */
export function scanBridgeRegistrations(body) {
  const text = typeof body === 'string' ? body : '';
  const blanked = blankStringsAndComments(text);
  const registrations = [];
  const seen = new Set();
  const add = (name, kind, index, length) => {
    if (!name || seen.has(`${kind}|${name}`)) return;
    if (!isLiveCode(blanked, index)) return;
    seen.add(`${kind}|${name}`);
    registrations.push({
      name,
      kind,
      line: lineOf(text, index),
      snippet: snippetAround(text, index, length),
    });
  };
  const androidRe = /addJavascriptInterface\s*\(\s*[^,]+,\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = androidRe.exec(text)) !== null) add(m[1], 'android', m.index, m[0].length);
  const iosHandlerRe = /addScriptMessageHandler\s*\([^)]*?name\s*:\s*['"]([^'"]+)['"]/g;
  while ((m = iosHandlerRe.exec(text)) !== null) add(m[1], 'ios', m.index, m[0].length);
  const messageHandlersRe = /window\s*\.\s*webkit\s*\.\s*messageHandlers\s*\.\s*([A-Za-z_$][\w$]*)/g;
  while ((m = messageHandlersRe.exec(blanked)) !== null) {
    add(m[1], 'ios', m.index, m[0].length);
  }
  const jsBridgeRe = /WebViewJavascriptBridge\s*\.\s*registerHandler\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = jsBridgeRe.exec(text)) !== null) add(m[1], 'jsbridge', m.index, m[0].length);
  return registrations;
}

/**
 * Variables tainted by attacker-controllable input, with the
 * source each one came from ({ varName: sourceLabel }). Three
 * passes propagate taint through intermediate variables. Pure.
 */
export function findTaintedVars(body) {
  const text = typeof body === 'string' ? body : '';
  const blanked = blankStringsAndComments(text);
  const tainted = new Map();
  const sourceLabel = (rhs) => {
    if (/URLSearchParams|location\s*\.\s*(?:search|hash)|searchParams\s*\.\s*get|getQueryParam|getParameter|route\s*\.\s*params|\bparams\s*\.\s*get|useSearchParams\s*\(\)/.test(rhs)) {
      return 'url parameter';
    }
    if (/(?:getElementById|querySelector)\s*\([^)]*\)\s*\.\s*value/.test(rhs)) return 'input value';
    if (/(?:event|e|evt|message)\s*\.\s*data/.test(rhs)) return 'postMessage data';
    return 'attacker-controlled input';
  };
  const assignRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]{0,300})/g;
  for (let pass = 0; pass < 3; pass += 1) {
    const rx = new RegExp(assignRe.source, assignRe.flags);
    let m;
    let grew = false;
    while ((m = rx.exec(blanked)) !== null) {
      const varName = m[1];
      if (tainted.has(varName)) continue;
      let label = null;
      if (INPUT_SOURCE_RE.test(m[2])) {
        label = sourceLabel(m[2]);
      } else {
        for (const [taintedVar, origin] of tainted) {
          if (wordIn(m[2], taintedVar)) {
            label = origin;
            break;
          }
        }
      }
      if (label !== null) {
        tainted.set(varName, label);
        grew = true;
      }
    }
    if (!grew) break;
  }
  return tainted;
}

// Spans of message-event handlers: addEventListener('message', …)
// and onmessage assignments. A bridge call inside one of these
// spans runs on an incoming postMessage, i.e. on
// attacker-influenced input, when the span also reads event data.
// The listener regex runs on the ORIGINAL text (the 'message'
// string literal is blanked out of the blanked text) with a
// live-code guard; brace matching runs on the blanked text
// (offsets are identical).
function messageHandlerSpans(blanked, text) {
  const spans = [];
  const listenerRe = /addEventListener\s*\(\s*['"]message['"]/g;
  let m;
  while ((m = listenerRe.exec(text)) !== null) {
    if (!isLiveCode(blanked, m.index)) continue;
    const span = functionSpan(blanked, m.index + m[0].length);
    if (span) spans.push(span);
  }
  const onMessageRe = /(?:window\s*\.\s*)?onmessage\s*=/g;
  while ((m = onMessageRe.exec(blanked)) !== null) {
    const span = functionSpan(blanked, m.index + m[0].length);
    if (span) spans.push(span);
  }
  return spans;
}

/**
 * Bridge call sites in a body: [{ bridge, method, argText, line,
 * snippet, offset }] — every `window.<Name>.<method>(…)`,
 * `<Name>.<method>(…)`,
 * `window.webkit.messageHandlers.<Name>.postMessage(…)` and
 * `WebViewJavascriptBridge.callHandler("Name", …)` occurrence,
 * whether or not the bridge is registered. Pure.
 */
export function scanBridgeCallSites(body) {
  const text = typeof body === 'string' ? body : '';
  const blanked = blankStringsAndComments(text);
  const sites = [];
  const seenOffsets = new Set();
  const add = (bridge, method, argText, index, length) => {
    if (!bridge || seenOffsets.has(index)) return;
    seenOffsets.add(index);
    sites.push({
      bridge,
      method,
      argText,
      line: lineOf(text, index),
      snippet: snippetAround(text, index, length),
      offset: index,
    });
  };
  const webkitRe = /window\s*\.\s*webkit\s*\.\s*messageHandlers\s*\.\s*([A-Za-z_$][\w$]*)\s*\.\s*postMessage\s*\(\s*([^;)\n]{0,300})/g;
  let m;
  // The argument text is the full original statement, from the
  // call to its `;`: slicing from the blanked group offset would
  // skip a leading string literal (the `\s*` after `(` consumes
  // the blanked literal). Statement text is what the taint and
  // inline-source checks read.
  const statementText = (index) => {
    const stmtEnd = blanked.indexOf(';', index);
    return text.slice(index, stmtEnd === -1 ? text.length : stmtEnd);
  };
  while ((m = webkitRe.exec(blanked)) !== null) {
    add(m[1], 'postMessage', statementText(m.index), m.index, m[0].length);
  }
  const windowBridgeRe = /\bwindow\s*\.\s*([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(\s*([^;)\n]{0,300})/g;
  while ((m = windowBridgeRe.exec(blanked)) !== null) {
    // Skip the webkit.messageHandlers prefix itself (handled
    // above) and the bare `window.webkit` object. Registration
    // calls (addJavascriptInterface / addScriptMessageHandler)
    // are not bridge call sites.
    if (m[1] === 'webkit') continue;
    if (m[2] === 'addJavascriptInterface' || m[2] === 'addScriptMessageHandler') continue;
    add(m[1], m[2], statementText(m.index), m.index, m[0].length);
  }
  const bareBridgeRe = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(\s*([^;)\n]{0,300})/g;
  while ((m = bareBridgeRe.exec(blanked)) !== null) {
    if (m[1] === 'window' || m[1] === 'webkit' || m[1] === 'messageHandlers') continue;
    if (m[2] === 'addJavascriptInterface' || m[2] === 'addScriptMessageHandler' || m[2] === 'registerHandler') continue;
    add(m[1], m[2], statementText(m.index), m.index, m[0].length);
  }
  const callHandlerRe = /WebViewJavascriptBridge\s*\.\s*callHandler\s*\(\s*['"]([^'"]+)['"]\s*,?\s*([^;)\n]{0,300})?/g;
  while ((m = callHandlerRe.exec(text)) !== null) {
    if (!isLiveCode(blanked, m.index)) continue;
    add(m[1], 'callHandler', m[2] || '', m.index, m[0].length);
  }
  return sites;
}

/**
 * Judge one bridge call site: is it reachable from
 * attacker-controllable input? 'confirmed' when the call's
 * argument references a tainted variable / inline source, or the
 * call sits inside a message-event handler that reads event data.
 * Pure.
 */
export function assessBridgeReachability({ argText, offset, tainted, handlerSpans, blanked }) {
  const arg = typeof argText === 'string' ? argText : '';
  for (const [varName, origin] of tainted) {
    if (wordIn(arg, varName)) {
      return { verdict: 'confirmed', via: `argument references ${origin} variable '${varName}'` };
    }
  }
  if (INPUT_SOURCE_RE.test(arg)) {
    return { verdict: 'confirmed', via: 'argument carries attacker-controlled input inline' };
  }
  for (const [start, end] of handlerSpans || []) {
    if (offset >= start && offset < end) {
      const spanText = (blanked || '').slice(start, end);
      if (/(?:event|e|evt|message)\s*\.\s*data/.test(spanText)) {
        return { verdict: 'confirmed', via: 'call sits inside a message-event handler that reads event data' };
      }
    }
  }
  return { verdict: 'rejected', reason: 'no attacker-controlled input reaches the call' };
}

/**
 * Scan one source body for confirmed WebView bridge abuse.
 * Returns { reachable, registrations, callSites } where each
 * reachable entry carries { bridge, method, registration,
 * callSite, via }. A bridge is reported ONLY when it is both
 * registered in this body and called from attacker-controllable
 * input. Pure.
 */
export function scanWebViewBridges(body) {
  const text = typeof body === 'string' ? body : '';
  const blanked = blankStringsAndComments(text);
  const registrations = scanBridgeRegistrations(text);
  const registered = new Map(registrations.map((r) => [r.name, r]));
  const callSites = scanBridgeCallSites(text);
  const tainted = findTaintedVars(text);
  const handlerSpans = messageHandlerSpans(blanked, text);
  const reachable = [];
  for (const site of callSites) {
    const registration = registered.get(site.bridge);
    if (!registration) continue;
    const judged = assessBridgeReachability({
      argText: site.argText,
      offset: site.offset,
      tainted,
      handlerSpans,
      blanked,
    });
    if (judged.verdict !== 'confirmed') continue;
    reachable.push({ bridge: site.bridge, method: site.method, registration, callSite: site, via: judged.via });
  }
  return { reachable, registrations, callSites };
}

// Scan one source body and push findings for its reachable
// bridges. `sourceUrl` is the URL the finding is filed under;
// `sourceLabel` names the source in the evidence.
function scanBody(body, sourceUrl, sourceLabel, findings, seen, diag) {
  if (findings.length >= MAX_FINDINGS) return;
  const scan = scanWebViewBridges(body);
  diag.bridgesRegistered = (diag.bridgesRegistered || 0) + scan.registrations.length;
  diag.callSites = (diag.callSites || 0) + scan.callSites.length;
  diag.reachableCalls = (diag.reachableCalls || 0) + scan.reachable.length;
  for (const hit of scan.reachable) {
    if (findings.length >= MAX_FINDINGS) return;
    const dedupKey = `${sourceLabel}|${hit.bridge}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    findings.push({
      class: 'webview_bridge_abuse',
      id: `webview-bridge-${slug(hit.bridge)}`,
      title: `WebView JavaScript bridge abuse — bridge "${hit.bridge}" reachable from attacker-controlled input`,
      severity: 'high',
      url: sourceUrl,
      parameter: hit.bridge,
      evidence: {
        request:
          sourceLabel.startsWith('inline')
            ? `inline <script> block on ${sourceUrl} (page body already fetched)`
            : `GET ${sourceUrl} (same-origin script bundle)`,
        response:
          `WebView bridge "${hit.bridge}" (${hit.registration.kind} registration, line ${hit.registration.line}: ${hit.registration.snippet}) ` +
          `is called from attacker-controlled input — ${hit.via} — at line ${hit.callSite.line}: ${hit.callSite.snippet}. ` +
          `Static mining only — the registration and the reachable call path are observed as served; ` +
          `no mobile device was driven, and whether the exposed native method is dangerous needs a human read of the native side.`,
        impact_demo:
          'Native-code reachability from web content — a crafted link or page can drive the exposed bridge method with attacker-chosen arguments, reaching native functionality (file access, intents, stored credentials) outside the WebView sandbox. Expose only the minimal methods the page needs, validate every argument natively, and never bridge a WebView that loads untrusted content (OWASP MASVS V5 / MSTG-WEBVIEW).',
        signalCorrelated: true,
      },
    });
  }
}

/**
 * Probe WebView JavaScript bridge exposure in first-party
 * client-side JS (#511).
 * @param {string} pageUrl — the pasted page URL (findings on inline
 *   scripts are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] }
 *   from extractSecretTargets (runScan computes it from the page
 *   body so a script-less page skips instead of fetching).
 * @param {object} opts — { timeoutMs, headers, fetchPage, diagnostics }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'webview_bridge_abuse',
 *   high) — at most 1 per (source, bridge), max 5 per scan.
 */
export async function probeWebViewBridge(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  try {
    new URL(pageUrl);
  } catch {
    return findings;
  }
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];
  const seen = new Set();
  const diagAcc = {};
  let scanned = 0;
  for (const bundleUrl of bundles) {
    if (isVendorBundle(bundleUrl)) continue;
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    scanned += 1;
    scanBody(res.body, bundleUrl, `script bundle ${bundleUrl}`, findings, seen, diagAcc);
    if (findings.length >= MAX_FINDINGS) break;
  }
  if (findings.length < MAX_FINDINGS) {
    inline.forEach((body, i) => {
      if (findings.length >= MAX_FINDINGS) return;
      scanned += 1;
      scanBody(body, pageUrl, `inline <script> block #${i + 1} on ${pageUrl}`, findings, seen, diagAcc);
    });
  }
  setDiag('bundlesScanned', scanned);
  setDiag('bridgesRegistered', diagAcc.bridgesRegistered || 0);
  setDiag('callSites', diagAcc.callSites || 0);
  setDiag('reachableCalls', diagAcc.reachableCalls || 0);
  return findings;
}

export const __webviewBridgeMeta = { phases: ['webview-bridge'], depth: ['quick', 'standard', 'deep'] };
